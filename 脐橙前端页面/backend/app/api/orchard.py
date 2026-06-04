"""
Orchard (脐橙冠层三维解析) API endpoints
"""
import os
import uuid
import shutil
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session

router = APIRouter(prefix="", tags=["orchard"])

# ============ In-memory mock storage ============

_mock_uploaded_files: dict = {}
_mock_analysis_results: dict = {}
_mock_fertilization_plans: dict = {}
_mock_render_params: Optional[dict] = None
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../../uploads")


# ============ Schemas ============

class FruitTreePoi(BaseModel):
    id: str
    name: str
    longitude: float
    latitude: float
    altitude: Optional[float] = None
    variety: str = "纽荷尔脐橙"
    treeAge: int = 5
    canopyHeight: float = 2.5
    canopyDiameter: float = 3.0
    canopyVolume: float = 10.0
    leafAreaIndex: float = 3.0
    ndvi: float = 0.7
    healthStatus: str = "healthy"
    orchardId: str = "orchard_001"
    orchardName: str = "示范果园A区"
    updatedAt: str = ""


class OrchardStatistics(BaseModel):
    totalArea: float = 120.5
    averageNdvi: float = 0.72
    averageLai: float = 3.2
    averageCanopyHeight: float = 2.8
    averageCanopyVolume: float = 11.5
    healthyCount: int = 850
    warningCount: int = 120
    criticalCount: int = 30
    varietyDistribution: dict = {"纽荷尔脐橙": 600, "朋娜脐橙": 250, "奈维林娜": 150}


class TsomQueryParams(BaseModel):
    rangeType: str = "rectangle"
    coordinates: list = []
    radius: Optional[float] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    varieties: Optional[List[str]] = None
    healthStatuses: Optional[List[str]] = None


class TsomQueryResult(BaseModel):
    id: str
    queryParams: TsomQueryParams
    totalTrees: int
    pois: List[FruitTreePoi]
    statistics: OrchardStatistics
    executedAt: str


class AnalysisResult(BaseModel):
    id: str
    name: str
    type: str = "ndvi"
    fileId: str = ""
    executedAt: str = ""
    status: str = "completed"
    data: Optional[dict] = None
    fertilizationPlan: Optional[dict] = None


class UploadedFile(BaseModel):
    id: str
    name: str
    size: int = 0
    type: str = "image"
    uploadProgress: int = 100
    status: str = "completed"
    uploadedAt: str = ""
    analysisResults: List[AnalysisResult] = []
    childFiles: list = []


class FertilizationPlan(BaseModel):
    id: str
    name: str
    orchardId: str
    analysisId: str
    fertilizerType: str = "复合肥"
    amountPerMu: float = 25.0
    areaGeoJson: Optional[dict] = None
    recommendedDate: str = ""
    createdAt: str = ""
    status: str = "draft"
    renderParams: Optional[dict] = None


class RenderParams(BaseModel):
    colorScheme: str = "ndvi"
    ndviMin: float = 0.2
    ndviMax: float = 0.9
    laiMin: float = 0.5
    laiMax: float = 6.0
    canopyHeightMin: float = 0.5
    canopyHeightMax: float = 5.0
    opacity: float = 0.8
    showContour: bool = False
    contourInterval: float = 0.1


class GeoServerLayer(BaseModel):
    name: str
    title: str
    workspace: str = "gannan_orchard"
    type: str = "wms"
    url: str = ""
    visible: bool = True
    opacity: float = 1.0
    zIndex: int = 0


# ============ Helper: generate mock data ============

def _generate_mock_trees(count: int = 50, orchard_id: str = "orchard_001") -> List[FruitTreePoi]:
    """Generate mock fruit tree POI data."""
    import random
    random.seed(42)
    base_lng, base_lat = 115.89, 28.68
    varieties = ["纽荷尔脐橙", "朋娜脐橙", "奈维林娜"]
    statuses = ["healthy", "healthy", "healthy", "warning", "critical"]
    trees = []
    for i in range(count):
        trees.append(FruitTreePoi(
            id=f"tree_{orchard_id}_{i+1:04d}",
            name=f"果树-{orchard_id}-{i+1:04d}",
            longitude=round(base_lng + random.uniform(-0.02, 0.02), 6),
            latitude=round(base_lat + random.uniform(-0.02, 0.02), 6),
            altitude=round(random.uniform(80, 120), 2),
            variety=random.choice(varieties),
            treeAge=random.randint(3, 12),
            canopyHeight=round(random.uniform(1.5, 4.5), 2),
            canopyDiameter=round(random.uniform(2.0, 4.5), 2),
            canopyVolume=round(random.uniform(5, 30), 2),
            leafAreaIndex=round(random.uniform(1.5, 6.0), 2),
            ndvi=round(random.uniform(0.3, 0.95), 3),
            healthStatus=random.choice(statuses),
            orchardId=orchard_id,
            orchardName=f"示范果园{chr(65 + int(orchard_id[-1]) - 1)}区" if orchard_id[-1].isdigit() else orchard_id,
            updatedAt=(datetime.now() - timedelta(hours=random.randint(1, 72))).isoformat(),
        ))
    return trees


_mock_trees_cache: dict = {}


def _get_mock_trees(orchard_id: str = "orchard_001") -> List[FruitTreePoi]:
    if orchard_id not in _mock_trees_cache:
        _mock_trees_cache[orchard_id] = _generate_mock_trees(50, orchard_id)
    return _mock_trees_cache[orchard_id]


def _generate_default_analysis(file_id: str) -> AnalysisResult:
    return AnalysisResult(
        id=f"analysis_{uuid.uuid4().hex[:8]}",
        name=f"冠层分析_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        type=random.choice(["ndvi", "lai", "canopy", "health"]),
        fileId=file_id,
        executedAt=datetime.now().isoformat(),
        status="completed",
        data={"summary": "分析完成", "avgNdvi": 0.72, "avgLai": 3.1},
    )


import random


# ============ Orchard Endpoints ============

@router.get("/orchard/list")
async def list_orchards():
    """获取所有园区列表"""
    return [
        {"id": "orchard_001", "name": "示范果园A区", "area": 120.5, "treeCount": 1000},
        {"id": "orchard_002", "name": "示范果园B区", "area": 95.0, "treeCount": 780},
        {"id": "orchard_003", "name": "核心试验区", "area": 45.0, "treeCount": 350},
    ]


@router.get("/orchard/{orchard_id}/statistics")
async def get_orchard_statistics(orchard_id: str):
    """获取园区统计数据"""
    import random
    random.seed(hash(orchard_id) % (2**32))
    return OrchardStatistics(
        totalArea=round(random.uniform(40, 150), 1),
        averageNdvi=round(random.uniform(0.6, 0.85), 2),
        averageLai=round(random.uniform(2.5, 4.5), 1),
        averageCanopyHeight=round(random.uniform(2.0, 3.5), 1),
        averageCanopyVolume=round(random.uniform(8, 18), 1),
        healthyCount=random.randint(300, 900),
        warningCount=random.randint(50, 200),
        criticalCount=random.randint(10, 60),
        varietyDistribution={"纽荷尔脐橙": random.randint(200, 600),
                             "朋娜脐橙": random.randint(100, 300),
                             "奈维林娜": random.randint(50, 200)},
    )


@router.get("/orchard/{orchard_id}/trees")
async def get_orchard_trees(
    orchard_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
):
    """获取指定园区的所有果树"""
    trees = _get_mock_trees(orchard_id)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "items": trees[start:end],
        "total": len(trees),
        "page": page,
        "page_size": page_size,
        "total_pages": (len(trees) + page_size - 1) // page_size,
    }


@router.get("/orchard/trees/{tree_id}")
async def get_fruit_tree_by_id(tree_id: str):
    """根据POI ID获取果树详细信息"""
    for orchard_id in ["orchard_001", "orchard_002", "orchard_003"]:
        for tree in _get_mock_trees(orchard_id):
            if tree.id == tree_id:
                return tree
    raise HTTPException(status_code=404, detail="Fruit tree not found")


@router.post("/orchard/tsom/query")
async def query_tsom(params: TsomQueryParams):
    """TSOM空间查询 - 根据绘制范围查询果树POI"""
    import random
    trees = _get_mock_trees("orchard_001")
    # Simulate spatial filtering
    filtered = random.sample(trees, min(len(trees), random.randint(5, 20)))
    healthy = sum(1 for t in filtered if t.healthStatus == "healthy")
    warning = sum(1 for t in filtered if t.healthStatus == "warning")
    critical = sum(1 for t in filtered if t.healthStatus == "critical")
    varieties = {}
    for t in filtered:
        varieties[t.variety] = varieties.get(t.variety, 0) + 1

    return TsomQueryResult(
        id=f"tsom_{uuid.uuid4().hex[:8]}",
        queryParams=params,
        totalTrees=len(filtered),
        pois=filtered,
        statistics=OrchardStatistics(
            totalArea=round(random.uniform(5, 30), 1),
            averageNdvi=round(sum(t.ndvi for t in filtered) / len(filtered), 2) if filtered else 0,
            averageLai=round(sum(t.leafAreaIndex for t in filtered) / len(filtered), 1) if filtered else 0,
            averageCanopyHeight=round(sum(t.canopyHeight for t in filtered) / len(filtered), 1) if filtered else 0,
            averageCanopyVolume=round(sum(t.canopyVolume for t in filtered) / len(filtered), 1) if filtered else 0,
            healthyCount=healthy,
            warningCount=warning,
            criticalCount=critical,
            varietyDistribution=varieties,
        ),
        executedAt=datetime.now().isoformat(),
    )


# ============ Upload Endpoints ============

@router.get("/upload/files")
async def list_uploaded_files():
    """获取上传文件列表"""
    return list(_mock_uploaded_files.values())


@router.post("/upload/file")
async def upload_file(file: UploadFile = File(...)):
    """上传文件"""
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_id = f"file_{uuid.uuid4().hex[:12]}"
    file_path = os.path.join(UPLOAD_DIR, file.filename or file_id)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Create analysis result for this file
    analysis = _generate_default_analysis(file_id)

    uploaded = UploadedFile(
        id=file_id,
        name=file.filename or file_id,
        size=len(content),
        type=file.content_type or "application/octet-stream",
        uploadProgress=100,
        status="completed",
        uploadedAt=datetime.now().isoformat(),
        analysisResults=[analysis],
        childFiles=[],
    )
    _mock_uploaded_files[file_id] = uploaded
    _mock_analysis_results[analysis.id] = analysis
    return uploaded


@router.get("/upload/files/{file_id}/children")
async def get_child_files(file_id: str):
    """获取上传文件的子级分析文件"""
    return []


@router.delete("/upload/files/{file_id}")
async def delete_uploaded_file(file_id: str):
    """删除上传文件"""
    if file_id not in _mock_uploaded_files:
        raise HTTPException(status_code=404, detail="File not found")
    file_info = _mock_uploaded_files[file_id]
    file_path = os.path.join(UPLOAD_DIR, file_info.name)
    if os.path.exists(file_path):
        os.remove(file_path)
    del _mock_uploaded_files[file_id]
    return {"message": "File deleted", "id": file_id}


# ============ Analysis Endpoints ============

@router.get("/analysis/list")
async def list_analysis_results(
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    """获取分析结果列表"""
    results = list(_mock_analysis_results.values())
    if type:
        results = [r for r in results if r.type == type]
    if status:
        results = [r for r in results if r.status == status]
    return results


@router.get("/analysis/{analysis_id}")
async def get_analysis_result(analysis_id: str):
    """获取分析结果详情"""
    if analysis_id not in _mock_analysis_results:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return _mock_analysis_results[analysis_id]


# ============ Fertilization Endpoints ============

@router.get("/fertilization/list")
async def list_fertilization_plans(orchard_id: Optional[str] = Query(None)):
    """获取施肥方案列表"""
    plans = list(_mock_fertilization_plans.values())
    if orchard_id:
        plans = [p for p in plans if p.orchardId == orchard_id]
    return plans


@router.get("/fertilization/{plan_id}")
async def get_fertilization_plan(plan_id: str):
    """获取施肥方案详情"""
    if plan_id not in _mock_fertilization_plans:
        raise HTTPException(status_code=404, detail="Fertilization plan not found")
    return _mock_fertilization_plans[plan_id]


# ============ Render Params Endpoints ============

@router.get("/render/params")
async def get_render_params():
    """获取当前渲染参数"""
    global _mock_render_params
    if _mock_render_params is None:
        _mock_render_params = RenderParams().model_dump()
    return _mock_render_params


@router.post("/render/params")
async def save_render_params(params: RenderParams):
    """保存/更新颜色渲染参数"""
    global _mock_render_params
    _mock_render_params = params.model_dump()
    return _mock_render_params


# ============ GeoServer Endpoints ============

@router.get("/geoserver/layers")
async def list_geoserver_layers():
    """获取GeoServer图层配置"""
    return [
        GeoServerLayer(
            name="gannan_orchard:ortho_2024",
            title="2024年正射影像",
            workspace="gannan_orchard",
            type="wms",
            url="/geoserver/gannan_orchard/wms",
            visible=True,
            opacity=1.0,
            zIndex=1,
        ),
        GeoServerLayer(
            name="gannan_orchard:ndvi_2024q3",
            title="2024Q3 NDVI",
            workspace="gannan_orchard",
            type="wms",
            url="/geoserver/gannan_orchard/wms",
            visible=False,
            opacity=0.7,
            zIndex=2,
        ),
        GeoServerLayer(
            name="gannan_orchard:soil_moisture",
            title="土壤墒情",
            workspace="gannan_orchard",
            type="wms",
            url="/geoserver/gannan_orchard/wms",
            visible=False,
            opacity=0.6,
            zIndex=3,
        ),
        GeoServerLayer(
            name="gannan_orchard:orchard_boundary",
            title="果园边界",
            workspace="gannan_orchard",
            type="wfs",
            url="/geoserver/gannan_orchard/wfs",
            visible=True,
            opacity=1.0,
            zIndex=0,
        ),
    ]


# ============ Download Endpoint ============

@router.get("/download/{file_id}")
async def download_file(file_id: str):
    """下载分析结果文件"""
    if file_id not in _mock_uploaded_files:
        raise HTTPException(status_code=404, detail="File not found")
    file_info = _mock_uploaded_files[file_id]
    file_path = os.path.join(UPLOAD_DIR, file_info.name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    from fastapi.responses import FileResponse
    return FileResponse(file_path, filename=file_info.name)
