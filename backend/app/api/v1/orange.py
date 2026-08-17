import os
import shutil
import uuid
import math
import json as json_mod
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, UploadFile, HTTPException, status
from pydantic import BaseModel

from app.config import get_settings
from app.services.geoscene_service import GeoSceneService, GeoSceneError
from app.schemas.orange import (
    SpatialQuerySchema,
    DiagnoseResultSchema,
    FertilizerStat,
    OrangeTreeOut,
    HistoricalTreesOut,
    growth_index_to_status,
    fertilizer_level_to_kg,
)
from app.services.tif_service import TifService
from pyproj import Transformer
from app.services.sam_service import SamInferenceService
from app.services.yolo_service import YoloService
import rasterio
import cv2
import numpy as np

router = APIRouter(prefix="/orange", tags=["脐橙三维空间大屏诊断API"])


def _build_orange_tree(a: dict, g: dict) -> OrangeTreeOut:
    """把 GeoScene FeatureServer 特征映射为 OrangeTreeOut（字段名与 FeatureServer 实际 schema 对齐）。"""
    lng, lat = None, None
    if g and "x" in g:
        lng, lat = round(g["x"], 6), round(g["y"], 6)
    return OrangeTreeOut(
        id=a.get("id"),
        batch_id=a.get("batch_id") or "",
        lng=lng or 0.0,
        lat=lat or 0.0,
        confidence=a.get("confidence"),
        compactness=a.get("compactness"),
        shape_length=a.get("shape_length"),
        shape_area=a.get("shape_area"),
        value_field=a.get("value"),
        count_field=a.get("count"),
        area_m2=a.get("area_m2"),
        height_m=a.get("height_m"),
        crown_diameter=a.get("crown_diameter"),
        volume_m3=a.get("volume_m3"),
        growth_index=a.get("growth_index"),
        slope_degree=a.get("slope_degree"),
        aspect=a.get("aspect"),
        fertilizer_level=a.get("fertilizer_level") or 0,
    )


def _health_label(index: float | None) -> str:
    """growth_index → 前端 healthStatus 英文标签（镜像 src/utils/spatial.ts 的 growthIndexToHealth）。"""
    if index is None:
        return "warning"
    if index >= 0.7:
        return "healthy"
    if index >= 0.4:
        return "warning"
    return "critical"


class FilterQuerySchema(BaseModel):
    """精确查询（全量果树，不按空间范围过滤）请求参数。"""
    healthStatuses: Optional[List[str]] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None



@router.post(
    "/spatial-diagnose",
    response_model=DiagnoseResultSchema,
    status_code=status.HTTP_200_OK,
    summary="大屏鼠标拉框空间相交诊断接口",
)
async def spatial_diagnose(
    payload: SpatialQuerySchema,
):
    """
    大屏拉框空间诊断接口：
    1. 接收前端 Cesium 传过来的 WGS84 闭合多边形
    2. 调用 GeoScene FeatureServer 执行空间查询
    3. 返回框内树木 + 聚合看板指标
    """
    coords = payload.coordinates

    # 智能识别经纬度顺序 + 自动强行闭合
    ring = []
    for pt in coords:
        if len(pt) < 2:
            continue
        if pt[0] < pt[1]:  # pt[0]是纬度(≈27)，pt[1]是经度(≈116)，调换
            lng, lat = pt[1], pt[0]
        else:
            lng, lat = pt[0], pt[1]
        ring.append([lng, lat])

    if ring and ring[0] != ring[-1]:
        ring.append(ring[0])

    geometry = {"rings": [ring], "spatialReference": {"wkid": 4326}}

    try:
        stats = GeoSceneService.query_stats(geometry=geometry)
        features = GeoSceneService.query_features(
            geometry=geometry,
            geometry_type="esriGeometryPolygon",
            spatial_rel="esriSpatialRelContains",
            out_sr=4326,
            limit=2000,
            return_geometry=True,
        )
    except GeoSceneError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"GeoScene Server spatial query failed: {e}",
        )

    trees_out = [_build_orange_tree(feat.get("attributes", {}), feat.get("geometry", {})) for feat in features]

    return DiagnoseResultSchema(
        total_count=stats["total_count"],
        avg_height=stats["avg_height"],
        avg_area=stats["avg_area"],
        avg_growth_index=stats["avg_growth_index"],
        fertilizer_recommendation=FertilizerStat(
            light_level_count=stats["light_count"],
            medium_level_count=stats["medium_count"],
            heavy_level_count=stats["heavy_count"],
        ),
        trees=trees_out,
    )


@router.post(
    "/trees/filter",
    response_model=DiagnoseResultSchema,
    status_code=status.HTTP_200_OK,
    summary="精确查询 — 全量果树按条件过滤（不限制空间范围）",
)
async def filter_trees(payload: FilterQuerySchema):
    """
    菜单"精细查询"：全量扫描 FeatureServer 中所有果树，按健康状态过滤。
    品种/时间字段在 FeatureServer 中不存在，过滤不生效（返回全量）。
    """
    try:
        features = GeoSceneService.query_features(
            where="1=1",
            limit=1000,
            return_geometry=True,
            timeout=90,
        )
    except GeoSceneError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"GeoScene Server query failed: {e}",
        )

    trees = [_build_orange_tree(feat.get("attributes", {}), feat.get("geometry", {})) for feat in features]

    if payload.healthStatuses:
        allowed = set(payload.healthStatuses)
        trees = [t for t in trees if _health_label(t.growth_index) in allowed]

    heights = [t.height_m for t in trees if t.height_m]
    areas = [t.area_m2 for t in trees if t.area_m2]
    gis = [t.growth_index for t in trees if t.growth_index is not None]

    def _fertilizer_count(level: int) -> int:
        return sum(1 for t in trees if t.fertilizer_level == level)

    return DiagnoseResultSchema(
        total_count=len(trees),
        avg_height=round(sum(heights) / len(heights), 2) if heights else 0.0,
        avg_area=round(sum(areas) / len(areas), 2) if areas else 0.0,
        avg_growth_index=round(sum(gis) / len(gis), 4) if gis else 0.0,
        fertilizer_recommendation=FertilizerStat(
            light_level_count=_fertilizer_count(1),
            medium_level_count=_fertilizer_count(2),
            heavy_level_count=_fertilizer_count(3),
        ),
        trees=trees,
    )

@router.get(
    "/historical-trees",
    response_model=HistoricalTreesOut,
    status_code=status.HTTP_200_OK,
    summary="开屏静态会师 — 历史老树全量坐标与属性",
)
async def get_historical_trees():
    """
    大屏开屏时前端一次性拉取全部历史老树（batch_id=historical_zone）的
    经纬度坐标与长势/施肥属性，用于在 3D 底图模型表面铺设隐形拾取点。

    所有空间数据查询均通过 GeoScene FeatureServer。
    """
    try:
        features = GeoSceneService.query_features(
            where="batch_id='historical_zone'",
            out_sr=4326,
            limit=10000,
            return_geometry=True,
        )
    except GeoSceneError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"GeoScene Server query failed: {e}",
        )

    trees_out = [_build_orange_tree(feat.get("attributes", {}), feat.get("geometry", {})) for feat in features]

    return HistoricalTreesOut(total=len(trees_out), trees=trees_out)


UPLOAD_DIR = "data/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class TifUploadResponse(BaseModel):
    success: bool
    message: str
    file_path: str
    spatial_info: Dict[str, Any]
    task_id: str = ""


@router.post("/upload-tif", response_model=TifUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_orange_tif(file: UploadFile = File(...)):
    """
    接口 B: 接收前端上传的最新无人机正射二进制 TIF 文件并安全落地 + 现场空间参考扣留
    """
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in [".tif", ".tiff"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="非法文件格式！系统只接受 .tif 或 .tiff 格式的无人机正射影像。"
        )
        
    unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
    target_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    try:
        # 3.1 阶段：流式对拷物理落地
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        if os.path.exists(target_path):
            os.remove(target_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件流写入服务器硬盘失败: {str(e)}"
        )
    finally:
        await file.close()

    # 获取落地的绝对物理路径
    absolute_file_path = os.path.abspath(target_path)
    
    # ==================== 【3.2 关键合流】：大总台实例化并提取空间参考 ====================
    try:
        # 1. 实例化方法类，交接物理文件路径的接力棒
        # 使用 rasterio 直接提取空间参考（TifService 替代旧 TifResolver）
        
        # 2. 利用 rasterio 直接读取空间参考
        import rasterio as _rio
        with _rio.open(absolute_file_path) as _src:
            spatial_data = {
                "crs": str(_src.crs),
                "transform": [t for t in _src.transform] if _src.transform else [],
            }
        
    except Exception as geo_err:
        # 如果 rasterio 在读取地理头信息时崩溃（如 TIF 损坏或 conda 依赖损坏），及时报错
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"【3.2 空间参考扣留失败】请检查 Conda 环境中的 rasterio 依赖: {str(geo_err)}"
        )
    # ==================================================================================

    # Start real YOLO+SAM inference task
    task_id = uuid.uuid4().hex[:12]
    with _task_lock:
        _task_store[task_id] = {
            "task_id": task_id,
            "status": "pending",
            "message": "Task created",
            "total_trees": 0,
            "fresh_trees": [],
            "progress": 0.0,
        }

    asyncio.create_task(asyncio.to_thread(_run_inference_task, task_id, absolute_file_path))

    return TifUploadResponse(
        success=True,
        message="Upload success, YOLO+SAM inference started in background",
        file_path=absolute_file_path,
        spatial_info=spatial_data,
        task_id=task_id,
    )
import asyncio
import threading
from datetime import datetime


# ===== Async task store =====

_task_store: dict = {}
_task_lock = threading.Lock()


class TaskStatusOut(BaseModel):
    task_id: str
    status: str  # pending | processing | completed | failed
    message: str = ""
    total_trees: int = 0
    fresh_trees: list = []
    progress: float = 0.0  # 0.0 ~ 1.0


def _calc_growth_fields(mask: np.ndarray, gsd: float, height_m: float = None) -> dict:
    """Calculate canopy growth fields from SAM segmentation mask and optional height."""
    contours, _ = cv2.findContours(
        mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return {"area_m2": 0, "crown_diameter": 0, "shape_length": 0,
                "compactness": 0, "volume_m3": None, "height_m": None,
                "growth_index": None, "fertilizer_level": 0}

    area_px = int(cv2.contourArea(contours[0]))
    perimeter_px = cv2.arcLength(contours[0], closed=True)
    if perimeter_px == 0:
        return {"area_m2": 0, "crown_diameter": 0, "shape_length": 0,
                "compactness": 0, "volume_m3": None, "height_m": None,
                "growth_index": None, "fertilizer_level": 0}

    area_m2 = area_px * gsd * gsd
    shape_length = perimeter_px * gsd
    crown_diameter = 2.0 * math.sqrt(area_m2 / math.pi)
    compactness = (4.0 * math.pi * area_px) / (perimeter_px * perimeter_px)

    # Volume: cone approximation (area * height / 3)
    volume_m3 = (area_m2 * height_m / 3.0) if height_m and height_m > 0 else None

    # Growth index: composite 0-1 score from compactness + height-to-crown ratio
    if height_m and height_m > 0 and crown_diameter > 0:
        hc_ratio = height_m / crown_diameter
        hc_score = max(0.0, 1.0 - abs(hc_ratio - 1.0))
        growth_index = round(compactness * 0.5 + hc_score * 0.5, 4)
    else:
        growth_index = round(compactness, 4)

    # Fertilizer recommendation based on growth index
    if growth_index >= 0.7:
        fertilizer_level = 1   # light
    elif growth_index >= 0.4:
        fertilizer_level = 2   # medium
    else:
        fertilizer_level = 3   # heavy

    return {
        "area_pixels": area_px,
        "area_m2": round(area_m2, 4),
        "shape_length": round(shape_length, 4),
        "crown_diameter": round(crown_diameter, 4),
        "compactness": round(compactness, 4),
        "height_m": round(height_m, 2) if height_m and height_m > 0 else None,
        "volume_m3": round(volume_m3, 4) if volume_m3 else None,
        "growth_index": growth_index,
        "fertilizer_level": fertilizer_level,
    }


# ===== GeoScene Server integration now handled by GeoSceneService (see app/services/geoscene_service.py) =====


def _persist_trees_sync(trees_data: list, batch_id: str):
    """Persist detected trees to DB via sync connection (runs in background thread)."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.models.orange import OrangeTree

    if not trees_data:
        return

    settings = get_settings()
    engine = create_engine(settings.database_url_sync, echo=False)
    try:
        with Session(engine) as session:
            for tree in trees_data:
                session.add(OrangeTree(
                    batch_id=batch_id,
                    geom=f"POINT({tree['utm_x']} {tree['utm_y']})",
                    confidence=tree.get("iou_score"),
                    compactness=tree.get("compactness"),
                    shape_length=tree.get("shape_length"),
                    shape_area=tree.get("shape_area"),
                    value_field=tree.get("value"),
                    area_m2=tree.get("area_m2"),
                    height_m=tree.get("height_m"),
                    crown_diameter=tree.get("crown_diameter"),
                    volume_m3=tree.get("volume_m3"),
                    growth_index=tree.get("growth_index"),
                    slope_degree=tree.get("slope_degree"),
                    aspect=tree.get("aspect"),
                    fertilizer_level=tree.get("fertilizer_level", 0),
                ))
            session.commit()
            print(f"[Persist] {len(trees_data)} trees saved to DB (batch: {batch_id})")
    except Exception as e:
        print(f"[Persist] Failed to save trees: {e}")
    finally:
        engine.dispose()


def _make_geojson_from_mask(
    mask: np.ndarray,
    window_x: int,
    window_y: int,
    transform,
    wgs84_transformer,
) -> dict | None:
    """
    将SAM输出的二进制分割mask转为WGS84 GeoJSON Polygon。
    抽取最大外轮廓 → 简化顶点 → 像素坐标转WGS84经纬度 → 闭合环。
    """
    contours, _ = cv2.findContours(
        mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    largest = max(contours, key=cv2.contourArea)
    perimeter = cv2.arcLength(largest, closed=True)
    if perimeter < 4.0:
        return None

    epsilon = 0.005 * perimeter  # 保留 99.5% 周长精度，大幅压缩顶点数
    simplified = cv2.approxPolyDP(largest, epsilon, closed=True)

    coords = []
    for pt in simplified:
        px, py = pt[0]
        global_px = window_x + float(px)
        global_py = window_y + float(py)
        geo_x, geo_y = rasterio.transform.xy(transform, global_py, global_px)
        lng, lat = wgs84_transformer.transform(geo_x, geo_y)
        coords.append([round(lng, 8), round(lat, 8)])

    if len(coords) < 4:
        return None

    # GeoJSON 要求首尾坐标一致
    if coords[0] != coords[-1]:
        coords.append(coords[0])

    return {"type": "Polygon", "coordinates": [coords]}


def _detect_trees(file_path: str, batch_id: str, progress_cb=None) -> list[dict]:
    """核心推理：YOLO 检测 + SAM 分割 + 计算生长字段，返回检测到的树列表（不含入库发布）。

    上传推理和一次性入库脚本共用此函数，保证字段计算完全一致。
    progress_cb(tile_count, total_tiles) 为可选的进度回调（上传任务用，入库脚本不传）。
    """
    yolo_model = YoloService.get_instance()
    sam_predictor = SamInferenceService.get_instance()

    import rasterio as _rio
    with _rio.open(file_path) as _src:
        tif_crs = str(_src.crs)
        gsd = float(_src.res[0])  # meters per pixel

    transformer = Transformer.from_crs(tif_crs, "EPSG:4326", always_xy=True)
    transformer_utm = Transformer.from_crs("EPSG:4326", "EPSG:32650", always_xy=True)

    # Step 0: Predict full canopy height map from RGB
    try:
        from app.services.height_service import HeightService
        from app.services.elevation_service import ElevationService
        height_map = HeightService.predict_height_map(file_path)
    except Exception as e:
        print(f"[Warning] Height prediction failed: {e}, skipping height fields")
        height_map = None

    all_detected_trees = []
    tile_count = 0
    rio_ds = rasterio.open(file_path)
    # 预读整张单波段进内存，循环里每棵树直接内存索引，避免逐像素磁盘 I/O
    band1 = rio_ds.read(1)

    tiles = list(TifService.slice_tif_generator(file_path, overlap=112))
    total_tiles = len(tiles)

    for tile_info in tiles:
        tile_rgb = tile_info["tile_data"]
        valid_mask = tile_info["valid_mask"]
        window_x = tile_info["window_x"]
        window_y = tile_info["window_y"]
        transform = tile_info["transform"]

        # Smart skip: blank or low-contrast tiles
        if tile_rgb.max() < 10 or tile_rgb.std() < 5:
            tile_count += 1
            if progress_cb:
                progress_cb(tile_count, total_tiles)
            continue

        # Step 1: YOLO detects tree canopy boxes
        boxes = YoloService.detect_boxes(tile_rgb, yolo_model, conf=0.135)
        if len(boxes) == 0:
            tile_count += 1
            if progress_cb:
                progress_cb(tile_count, total_tiles)
            continue

        # Step 2: SAM refines each box with Box Prompt
        local_trees = SamInferenceService.infer_tile_with_boxes(
            tile_rgb, valid_mask, boxes, sam_predictor)

        # Step 3: Coordinate conversion + post-processing growth fields
        for tree in local_trees:
            local_cx, local_cy = tree["local_centroid"]
            global_px = window_x + local_cx
            global_py = window_y + local_cy
            geo_x, geo_y = rasterio.transform.xy(
                transform, global_py, global_px, offset="center")
            lng, lat = transformer.transform(geo_x, geo_y)
            utm_x, utm_y = transformer_utm.transform(lng, lat)
            bbox = tree.get("bbox", (0, 0, 0, 0))
            if height_map is not None:
                # 树高：height_map 是 DSM-DEM（dem2.tif 坐标），用 utm 坐标转像素，
                # 取树冠中心附近窗口的 90 分位数（接近树冠顶、抗噪声）。
                # 注意：RGB 影像与 DSM-DEM 尺寸/像元不同，不能直接用 global_px/global_py 索引。
                HM_ORIGIN_X = 399004.9068
                HM_ORIGIN_Y = 2903721.04768
                HM_RES = 0.12836
                hm_px = int((utm_x - HM_ORIGIN_X) / HM_RES)
                hm_py = int((HM_ORIGIN_Y - utm_y) / HM_RES)
                H, W = height_map.shape
                if 0 <= hm_py < H and 0 <= hm_px < W:
                    win = height_map[max(0, hm_py - 7):min(H, hm_py + 8), max(0, hm_px - 7):min(W, hm_px + 8)]
                    win = win[win > 0]
                    tree_h = float(np.percentile(win, 90)) if win.size > 0 else None
                else:
                    tree_h = None
            else:
                tree_h = None
            growth = _calc_growth_fields(tree["segmentation_mask"], gsd, tree_h)
            slope_info = ElevationService.get_slope_aspect(lat, lng, utm_x, utm_y)
            band_val = tile_rgb[int(local_cy), int(local_cx)].tolist()
            raw_val = float(band1[int(global_py), int(global_px)]) if 0 <= int(global_py) < band1.shape[0] and 0 <= int(global_px) < band1.shape[1] else None
            geojson = _make_geojson_from_mask(
                tree["segmentation_mask"], window_x, window_y,
                transform, transformer)
            tree_uuid = f"tree_{uuid.uuid4().hex[:8]}"
            all_detected_trees.append({
                "id": tree_uuid,
                "batch_id": batch_id,
                "lng": round(lng, 8),
                "lat": round(lat, 8),
                "utm_x": round(utm_x, 4),
                "utm_y": round(utm_y, 4),
                "iou_score": round(tree.get("iou_score", 0), 4),
                "bbox_local": [round(float(v), 2) for v in bbox],
                "shape_area": growth.get("area_m2", 0),
                "band_value": band_val, "value": raw_val, **slope_info,
                **growth,
                "growth_status": growth_index_to_status(growth.get("growth_index")),
                "fertilizer_kg": fertilizer_level_to_kg(growth.get("fertilizer_level", 0)),
                "geometry": geojson,
            })

        tile_count += 1
        if progress_cb:
            progress_cb(tile_count, total_tiles)

    rio_ds.close()
    return all_detected_trees


def _run_inference_task(task_id: str, file_path: str):
    with _task_lock:
        _task_store[task_id]["status"] = "processing"

    batch_id = os.path.splitext(os.path.basename(file_path))[0]

    def _progress_cb(tile_count, total_tiles):
        _update_progress(task_id, tile_count, total_tiles)

    try:
        all_detected_trees = _detect_trees(file_path, batch_id, _progress_cb)

        # Persist detected trees to database for spatial-diagnose
        _persist_trees_sync(all_detected_trees, batch_id)

        with _task_lock:
            _task_store[task_id]["status"] = "completed"
            _task_store[task_id]["total_trees"] = len(all_detected_trees)
            _task_store[task_id]["fresh_trees"] = all_detected_trees
    except Exception as e:
        with _task_lock:
            _task_store[task_id]["status"] = "failed"
            _task_store[task_id]["message"] = str(e)
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


def _update_progress(task_id, tile_count, total_tiles, msg: str = None):
    progress = tile_count / max(total_tiles, 1)
    with _task_lock:
        _task_store[task_id]["progress"] = progress
        _task_store[task_id]["message"] = msg if msg else f"{tile_count}/{total_tiles} tiles"


@router.post("/upload-and-interpret", response_model=TaskStatusOut)
async def upload_and_interpret_tif(file: UploadFile = File(...)):
    temp_dir = "temp_storage"
    os.makedirs(temp_dir, exist_ok=True)
    unique_name = f"{uuid.uuid4().hex}_{file.filename}"
    temp_file_path = os.path.join(temp_dir, unique_name)

    with open(temp_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    task_id = uuid.uuid4().hex[:12]
    with _task_lock:
        _task_store[task_id] = {
            "task_id": task_id,
            "status": "pending",
            "message": "Task created",
            "total_trees": 0,
            "fresh_trees": [],
            "progress": 0.0,
        }

    asyncio.create_task(asyncio.to_thread(_run_inference_task, task_id, temp_file_path))

    return {
        "task_id": task_id,
        "status": "pending",
        "message": "Task created, processing in background",
        "total_trees": 0,
        "fresh_trees": [],
        "progress": 0.0,
    }


@router.get("/upload-and-interpret/{task_id}", response_model=TaskStatusOut)
async def get_interpret_task(task_id: str):
    with _task_lock:
        task = _task_store.get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task