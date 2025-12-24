import mimetypes
from app.config import get_settings
import os
import asyncio
import random
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query, Depends, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, desc, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from .utils.stats import calculate_overview_stats, get_warning_data
from .utils.mock_data import get_mock_flood_events, get_mock_rain_grid_frames, get_mock_iot_devices, get_mock_3d_resources
from .websocket import manager
from app.database import get_session
from app.models import Sensor, SensorMetric, SensorReading, ModelProduct, RasterProduct, VectorProduct
from app.api.router import api_router
from app.schemas.data import WaterLevelOut, RainfallOut, StatsOut, WarningOut, MetricLatestOut
from app.tasks import realtime_push_task

app = FastAPI(title="Water Digital Twin Backend", version="1.0.0")

# --- GIS Data Path Configuration ---
_settings = get_settings()


def resolve_data_path(subpath: str) -> Path:
    """Resolve data path from GIS_DATA_DIR or fallback to project data/"""
    if _settings.gis_data_dir:
        return Path(_settings.gis_data_dir) / subpath
    # Fallback: project root / data / subpath
    return Path(__file__).parent.parent.parent / "data" / subpath


# --- OSGB 3D Tiles Static Files ---
# Mount OSGB 3D Tiles data (倾斜摄影)
OSGB_TILES_PATH = resolve_data_path("osgb")
if OSGB_TILES_PATH.exists():
    app.mount("/tiles/osgb",
              StaticFiles(directory=str(OSGB_TILES_PATH)), name="osgb_tiles")
    print(
        f"[startup] OSGB 3D Tiles mounted at /tiles/osgb from {OSGB_TILES_PATH}")

# Mount BIM 3D Tiles data
BIM_TILES_PATH = resolve_data_path("bim")
if BIM_TILES_PATH.exists():
    app.mount("/tiles/bim",
              StaticFiles(directory=str(BIM_TILES_PATH)), name="bim_tiles")
    print(
        f"[startup] BIM 3D Tiles mounted at /tiles/bim from {BIM_TILES_PATH}")

# --- DOM TMS Tiles Static Files ---
# Mount DOM (Digital Orthophoto Map) TMS tiles - multiple resolutions
DOM_20CM_PATH = resolve_data_path("dom/tiles/dom20cm")
if DOM_20CM_PATH.exists():
    app.mount("/tiles/dom/20cm",
              StaticFiles(directory=str(DOM_20CM_PATH)), name="dom_tiles_20cm")
    print(
        f"[startup] DOM 20cm Tiles mounted at /tiles/dom/20cm from {DOM_20CM_PATH}")

DOM_8CM_PATH = resolve_data_path("dom/tiles/dom8cm")
if DOM_8CM_PATH.exists():
    app.mount("/tiles/dom/8cm",
              StaticFiles(directory=str(DOM_8CM_PATH)), name="dom_tiles_8cm")
    print(
        f"[startup] DOM 8cm Tiles mounted at /tiles/dom/8cm from {DOM_8CM_PATH}")

# --- Local Terrain Tiles Static Files ---
# Mount local terrain tiles (quantized-mesh format from CTB)
LOCAL_TERRAIN_PATH = resolve_data_path("terrain/xinjiang")

# Add custom MIME type for .terrain
mimetypes.add_type('application/vnd.quantized-mesh', '.terrain')
mimetypes.add_type('application/octet-stream', '.terrain')


@app.middleware("http")
async def add_terrain_headers(request, call_next):
    response = await call_next(request)
    if request.url.path.endswith(".terrain"):
        # Cesium expects quantized-mesh headers
        response.headers["Content-Encoding"] = "gzip"
        response.headers["Access-Control-Allow-Origin"] = "*"
    return response

if LOCAL_TERRAIN_PATH.exists() and (LOCAL_TERRAIN_PATH / "layer.json").exists():
    app.mount("/terrain/local",
              StaticFiles(directory=str(LOCAL_TERRAIN_PATH)), name="terrain_local")
    print(
        f"[startup] Local Terrain mounted at /terrain/local from {LOCAL_TERRAIN_PATH}")

# Background task reference
_realtime_task = None


@app.on_event("startup")
async def startup_event():
    """Start background tasks and initialize SQLite demo database if needed."""
    global _realtime_task

    # Auto-initialize SQLite demo database if not using PostgreSQL
    from app.config import get_settings
    settings = get_settings()
    if settings.is_sqlite:
        from app.database import Base, engine
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("[startup] SQLite tables created/verified")

        # Seed demo data if enabled
        if settings.enable_seed_data:
            from scripts.seed_demo import seed_database
            from app.database import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
                await seed_database(session)

    # Always seed default layers (idempotent)
    from scripts.seed_layers import seed_default_layers
    from scripts.seed_hec_ras import seed_hec_ras_scenarios
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        await seed_default_layers(session)
        await seed_hec_ras_scenarios(session)

    _realtime_task = asyncio.create_task(realtime_push_task())
    print("[startup] Real-time push task started")


@app.on_event("shutdown")
async def shutdown_event():
    """Cancel background tasks on app shutdown."""
    global _realtime_task
    if _realtime_task:
        _realtime_task.cancel()
        try:
            await _realtime_task
        except asyncio.CancelledError:
            pass
    print("[shutdown] Real-time push task stopped")

app.include_router(api_router, prefix="/api/v1")

# --- WebSocket Real-time Endpoint ---


@app.websocket("/ws/realtime")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time data streaming."""
    await manager.connect(websocket)
    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connection",
            "status": "connected",
            "timestamp": datetime.now().isoformat()
        })

        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Wait for any incoming message (ping/pong or commands)
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                # Echo back for ping-pong
                if data == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                # Send heartbeat to keep connection alive
                await websocket.send_json({"type": "heartbeat", "timestamp": datetime.now().isoformat()})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


@app.get("/api/v1/events")
async def get_events():
    """获取洪水事件列表"""
    return get_mock_flood_events()


@app.get("/api/v1/rain_frames")
async def get_rain_frames():
    """获取降雨格网帧列表"""
    return get_mock_rain_grid_frames()


@app.get("/api/v1/iot_devices")
async def get_iot_devices(is_simulated: bool | None = None, session: AsyncSession = Depends(get_session)):
    """获取IoT设备列表（数据库，如果无记录则回退模拟数据）"""
    from app.models.sensor import SimulatedDevice

    stmt = select(SimulatedDevice)
    if is_simulated is not None:
        stmt = stmt.where(SimulatedDevice.is_simulated == is_simulated)
    res = (await session.execute(stmt)).scalars().all()
    if res:
        return [
            {
                "id": d.id,
                "device_id": d.device_id,
                "name": d.name,
                "protocol": d.protocol,
                "station_id": d.station_id,
                "metrics": d.metrics,
                "freq_sec": d.freq_sec,
                "status": d.status,
                "is_simulated": d.is_simulated,
            }
            for d in res
        ]
    # fallback to mock
    return get_mock_iot_devices()


@app.get("/api/v1/models")
async def get_3d_models():
    """获取三维资源列表"""
    return get_mock_3d_resources()

# --- New DB-backed endpoints ---


async def _latest_readings_for_metric(
    session: AsyncSession,
    metric_keys: list[str] | None = None,
    is_simulated: bool | None = None,
    warn_only: bool = False,
):
    metrics_stmt = select(SensorMetric).options(
        selectinload(SensorMetric.sensor))
    if metric_keys:
        metrics_stmt = metrics_stmt.where(
            SensorMetric.metric_key.in_(metric_keys))
    if warn_only:
        metrics_stmt = metrics_stmt.where(
            or_(SensorMetric.warn_low.is_not(None), SensorMetric.warn_high.is_not(None)))
    if is_simulated is not None:
        metrics_stmt = metrics_stmt.join(Sensor).where(
            Sensor.is_simulated == is_simulated)
    metrics_res = (await session.execute(metrics_stmt)).scalars().all()
    results = []
    for metric in metrics_res:
        sensor = metric.sensor
        reading_stmt = (
            select(SensorReading)
            .where(SensorReading.metric_id == metric.id)
            .order_by(desc(SensorReading.reading_time))
            .limit(1)
        )
        reading = (await session.execute(reading_stmt)).scalars().first()
        results.append((sensor, metric, reading))
    return results


@app.get("/api/v1/water_levels", response_model=list[WaterLevelOut])
async def api_water_levels(is_simulated: bool | None = None, session: AsyncSession = Depends(get_session)):
    """获取水位数据（数据库）"""
    rows = await _latest_readings_for_metric(session, ["water_level"], is_simulated)
    return [
        {
            "sensor_id": sensor.id,
            "station_name": sensor.point_code,
            "latest_level": reading.value_num if reading else None,
            "unit": metric.unit,
            "time": reading.reading_time.isoformat() if reading and reading.reading_time else None,
            "is_simulated": sensor.is_simulated,
        }
        for sensor, metric, reading in rows
    ]


@app.get("/api/v1/rainfall_data", response_model=list[RainfallOut])
async def api_rainfall(is_simulated: bool | None = None, session: AsyncSession = Depends(get_session)):
    """获取雨量数据（数据库）"""
    rows = await _latest_readings_for_metric(session, ["rainfall"], is_simulated)
    return [
        {
            "sensor_id": sensor.id,
            "station_name": sensor.point_code,
            "latest_rainfall": reading.value_num if reading else None,
            "unit": metric.unit,
            "time": reading.reading_time.isoformat() if reading and reading.reading_time else None,
            "is_simulated": sensor.is_simulated,
        }
        for sensor, metric, reading in rows
    ]


@app.get("/api/v1/model_products")
async def api_model_products(is_simulated: bool | None = None, session: AsyncSession = Depends(get_session)):
    stmt = select(ModelProduct)
    if is_simulated is not None:
        stmt = stmt.where(ModelProduct.is_simulated == is_simulated)
    res = (await session.execute(stmt)).scalars().all()
    return [
        {
            "id": mp.id,
            "domain": mp.domain,
            "name": mp.name,
            "version": mp.version,
            "valid_from": mp.valid_from,
            "valid_to": mp.valid_to,
            "product_type": mp.product_type,
            "path": mp.path,
            "meta": mp.meta,
            "is_simulated": mp.is_simulated,
        }
        for mp in res
    ]


@app.get("/api/v1/raster_products")
async def api_raster_products(is_simulated: bool | None = None, session: AsyncSession = Depends(get_session)):
    stmt = select(RasterProduct)
    if is_simulated is not None:
        stmt = stmt.where(RasterProduct.is_simulated == is_simulated)
    res = (await session.execute(stmt)).scalars().all()
    return [
        {
            "id": rp.id,
            "domain": rp.domain,
            "name": rp.name,
            "product_type": rp.product_type,
            "path": rp.path,
            "time_start": rp.time_start,
            "time_end": rp.time_end,
            "crs": rp.crs,
            "resolution": rp.resolution,
            "meta": rp.meta,
            "is_simulated": rp.is_simulated,
        }
        for rp in res
    ]


@app.get("/api/v1/vector_products")
async def api_vector_products(is_simulated: bool | None = None, session: AsyncSession = Depends(get_session)):
    stmt = select(VectorProduct)
    if is_simulated is not None:
        stmt = stmt.where(VectorProduct.is_simulated == is_simulated)
    res = (await session.execute(stmt)).scalars().all()
    return [
        {
            "id": vp.id,
            "domain": vp.domain,
            "name": vp.name,
            "product_type": vp.product_type,
            "path": vp.path,
            "time_start": vp.time_start,
            "time_end": vp.time_end,
            "srid": vp.srid,
            "meta": vp.meta,
            "is_simulated": vp.is_simulated,
        }
        for vp in res
    ]


@app.get("/api/v1/pore_pressures", response_model=list[MetricLatestOut])
async def api_pore_pressures(is_simulated: bool | None = None, session: AsyncSession = Depends(get_session)):
    """获取渗压计最新读数"""
    rows = await _latest_readings_for_metric(session, ["pore_pressure"], is_simulated)
    return [
        {
            "sensor_id": sensor.id,
            "station_name": sensor.point_code,
            "metric": metric.metric_key,
            "value": reading.value_num if reading else None,
            "unit": metric.unit,
            "time": reading.reading_time.isoformat() if reading and reading.reading_time else None,
            "is_simulated": sensor.is_simulated,
        }
        for sensor, metric, reading in rows
    ]


@app.get("/api/v1/stress_data", response_model=list[MetricLatestOut])
async def api_stress(is_simulated: bool | None = None, session: AsyncSession = Depends(get_session)):
    """获取应力计最新读数"""
    rows = await _latest_readings_for_metric(session, ["stress"], is_simulated)
    return [
        {
            "sensor_id": sensor.id,
            "station_name": sensor.point_code,
            "metric": metric.metric_key,
            "value": reading.value_num if reading else None,
            "unit": metric.unit,
            "time": reading.reading_time.isoformat() if reading and reading.reading_time else None,
            "is_simulated": sensor.is_simulated,
        }
        for sensor, metric, reading in rows
    ]

# 配置 CORS，允许前端访问
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",  # Vite default port
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Water Digital Twin API is running", "status": "ok"}


@app.get("/api/v1/health")
async def health_check():
    return {"status": "healthy", "service": "fastapi"}


async def _latest_by_metric(session: AsyncSession, metric_key: str):
    return await _latest_readings_for_metric(session, [metric_key], is_simulated=None)


@app.get("/api/v1/stats", response_model=StatsOut)
async def get_overview_stats(is_simulated: bool | None = None, session: AsyncSession = Depends(get_session)):
    """获取项目总览统计数据（优先 DB，无数据时回退旧逻辑）"""
    water_rows = await _latest_readings_for_metric(session, ["water_level"], is_simulated)
    rain_rows = await _latest_readings_for_metric(session, ["rainfall"], is_simulated)
    if not water_rows and not rain_rows:
        return calculate_overview_stats()
    total_devices = len({sensor.id for sensor, _, _ in water_rows + rain_rows})
    online_devices = max(0, total_devices - 0)  # no status now
    avg_rain = (
        round(
            sum(r.value_num for _, _, r in rain_rows if r and r.value_num is not None)
            / max(1, len([r for _, _, r in rain_rows if r and r.value_num is not None])),
            2,
        )
        if rain_rows
        else 0
    )
    stats = {
        "online_devices": online_devices,
        "total_devices": total_devices,
        "today_alerts": 0,
        "reservoir_capacity_percent": 0,
        "average_rainfall_mm": avg_rain,
    }
    return stats


@app.get("/api/v1/warnings", response_model=list[WarningOut])
async def get_all_warnings(is_simulated: bool | None = None, session: AsyncSession = Depends(get_session)):
    """获取所有告警信息（依据 warn_low/warn_high，包含渗压/应力/水位/雨量等设置了阈值的指标）"""
    rows = await _latest_readings_for_metric(session, None, is_simulated, warn_only=True)
    warnings = []
    for sensor, metric, reading in rows:
        if not reading or reading.value_num is None:
            continue
        value = reading.value_num
        if metric.warn_high is not None and value > metric.warn_high:
            warnings.append(
                {
                    "sensor_id": sensor.id,
                    "metric": metric.metric_key,
                    "level": "Yellow",
                    "message": f"{sensor.point_code} {metric.name_cn or metric.metric_key} 超限: {value}{metric.unit or ''}",
                    "time": reading.reading_time.isoformat(),
                    "is_simulated": sensor.is_simulated,
                }
            )
        if metric.warn_low is not None and value < metric.warn_low:
            warnings.append(
                {
                    "sensor_id": sensor.id,
                    "metric": metric.metric_key,
                    "level": "Yellow",
                    "message": f"{sensor.point_code} {metric.name_cn or metric.metric_key} 低于下限: {value}{metric.unit or ''}",
                    "time": reading.reading_time.isoformat(),
                    "is_simulated": sensor.is_simulated,
                }
            )
    if warnings:
        return warnings
    # 回退旧逻辑，补全字段
    fallback = []
    for w in get_warning_data():
        fallback.append(
            {
                "sensor_id": None,
                "metric": "unknown",
                "level": w.get("level", "Yellow"),
                "message": w.get("message", ""),
                "time": w.get("time"),
                "is_simulated": True,
            }
        )
    return fallback
