"""水文站 API 路由"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models import HydrologicalStation, Sensor, SensorMetric, SensorReading
from app.schemas.hydrological import (
    HydrologicalStationOut,
    FlowRateOut,
    StationReadingOut,
    StationReadingsResponse,
)
from geoalchemy2.shape import to_shape

router = APIRouter(prefix="/hydrological_stations", tags=["hydrological"])


async def get_latest_readings(session: AsyncSession, station_id: int) -> dict:
    """获取站点最新读数"""
    # 查找该站点关联的传感器
    sensor_stmt = select(Sensor).where(
        Sensor.hydrological_station_id == station_id)
    sensors = (await session.execute(sensor_stmt)).scalars().all()

    latest = {
        "flow_rate": None,
        "velocity": None,
        "water_level": None,
        "time": None,
    }

    for sensor in sensors:
        # 获取每个指标的最新读数
        for metric_key in ["flow_rate", "velocity", "water_level"]:
            metric_stmt = select(SensorMetric).where(
                SensorMetric.sensor_id == sensor.id,
                SensorMetric.metric_key == metric_key,
            )
            metric = (await session.execute(metric_stmt)).scalars().first()
            if metric:
                reading_stmt = (
                    select(SensorReading)
                    .where(SensorReading.metric_id == metric.id)
                    .order_by(desc(SensorReading.reading_time))
                    .limit(1)
                )
                reading = (await session.execute(reading_stmt)).scalars().first()
                if reading:
                    latest[metric_key] = reading.value_num
                    if latest["time"] is None or (
                        reading.reading_time and reading.reading_time.isoformat(
                        ) > latest["time"]
                    ):
                        latest["time"] = reading.reading_time.isoformat(
                        ) if reading.reading_time else None

    return latest


@router.get("", response_model=list[HydrologicalStationOut])
async def list_stations(
    is_simulated: Optional[bool] = None,
    session: AsyncSession = Depends(get_session),
):
    """获取水文站列表"""
    stmt = select(HydrologicalStation)
    if is_simulated is not None:
        stmt = stmt.where(HydrologicalStation.is_simulated == is_simulated)

    stations = (await session.execute(stmt)).scalars().all()

    results = []
    for station in stations:
        latest = await get_latest_readings(session, station.id)
        results.append(
            HydrologicalStationOut(
                id=station.id,
                station_code=station.station_code,
                station_name=station.station_name,
                river_name=station.river_name,
                basin_name=station.basin_name,
                datum_elevation=station.datum_elevation,
                lng=to_shape(
                    station.location).x if station.location is not None else None,
                lat=to_shape(
                    station.location).y if station.location is not None else None,
                is_simulated=station.is_simulated,
                latest_flow_rate=latest["flow_rate"],
                latest_velocity=latest["velocity"],
                latest_water_level=latest["water_level"],
                latest_time=latest["time"],
            )
        )

    return results


@router.get("/{station_id}", response_model=HydrologicalStationOut)
async def get_station(
    station_id: int,
    session: AsyncSession = Depends(get_session),
):
    """获取单个水文站详情"""
    stmt = select(HydrologicalStation).where(
        HydrologicalStation.id == station_id)
    station = (await session.execute(stmt)).scalars().first()
    if not station:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Station not found")

    latest = await get_latest_readings(session, station.id)
    return HydrologicalStationOut(
        id=station.id,
        station_code=station.station_code,
        station_name=station.station_name,
        river_name=station.river_name,
        basin_name=station.basin_name,
        datum_elevation=station.datum_elevation,
        lng=to_shape(
            station.location).x if station.location is not None else None,
        lat=to_shape(
            station.location).y if station.location is not None else None,
        is_simulated=station.is_simulated,
        latest_flow_rate=latest["flow_rate"],
        latest_velocity=latest["velocity"],
        latest_water_level=latest["water_level"],
        latest_time=latest["time"],
    )


@router.get("/{station_id}/readings", response_model=StationReadingsResponse)
async def get_station_readings(
    station_id: int,
    start_time: Optional[datetime] = Query(None, description="开始时间"),
    end_time: Optional[datetime] = Query(None, description="结束时间"),
    metric: Optional[str] = Query(
        None, description="指标类型: flow_rate, velocity, water_level"),
    limit: int = Query(100, le=1000, description="返回数量限制"),
    session: AsyncSession = Depends(get_session),
):
    """获取站点历史读数"""
    # 获取站点
    stmt = select(HydrologicalStation).where(
        HydrologicalStation.id == station_id)
    station = (await session.execute(stmt)).scalars().first()
    if not station:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Station not found")

    # 获取传感器
    sensor_stmt = select(Sensor).where(
        Sensor.hydrological_station_id == station_id)
    sensors = (await session.execute(sensor_stmt)).scalars().all()
    sensor_ids = [s.id for s in sensors]

    if not sensor_ids:
        return StationReadingsResponse(
            station_id=station.id,
            station_code=station.station_code,
            station_name=station.station_name,
            readings=[],
            total_count=0,
        )

    # 获取指标
    metric_stmt = select(SensorMetric).where(
        SensorMetric.sensor_id.in_(sensor_ids))
    if metric:
        metric_stmt = metric_stmt.where(SensorMetric.metric_key == metric)
    metrics = (await session.execute(metric_stmt)).scalars().all()
    metric_map = {m.id: m for m in metrics}

    if not metrics:
        return StationReadingsResponse(
            station_id=station.id,
            station_code=station.station_code,
            station_name=station.station_name,
            readings=[],
            total_count=0,
        )

    # 获取读数
    reading_stmt = (
        select(SensorReading)
        .where(SensorReading.metric_id.in_([m.id for m in metrics]))
        .order_by(desc(SensorReading.reading_time))
        .limit(limit)
    )
    if start_time:
        reading_stmt = reading_stmt.where(
            SensorReading.reading_time >= start_time)
    if end_time:
        reading_stmt = reading_stmt.where(
            SensorReading.reading_time <= end_time)

    readings = (await session.execute(reading_stmt)).scalars().all()

    return StationReadingsResponse(
        station_id=station.id,
        station_code=station.station_code,
        station_name=station.station_name,
        readings=[
            StationReadingOut(
                reading_time=r.reading_time,
                metric_key=metric_map[r.metric_id].metric_key,
                value=r.value_num,
                unit=metric_map[r.metric_id].unit,
            )
            for r in readings
            if r.metric_id in metric_map
        ],
        total_count=len(readings),
    )


# 独立的流量数据端点
flow_router = APIRouter(tags=["hydrological"])


@flow_router.get("/flow_rates", response_model=list[FlowRateOut])
async def list_flow_rates(
    is_simulated: Optional[bool] = None,
    session: AsyncSession = Depends(get_session),
):
    """获取所有站点最新流量数据"""
    stmt = select(HydrologicalStation)
    if is_simulated is not None:
        stmt = stmt.where(HydrologicalStation.is_simulated == is_simulated)

    stations = (await session.execute(stmt)).scalars().all()

    results = []
    for station in stations:
        latest = await get_latest_readings(session, station.id)
        results.append(
            FlowRateOut(
                station_id=station.id,
                station_code=station.station_code,
                station_name=station.station_name,
                latest_flow_rate=latest["flow_rate"],
                latest_velocity=latest["velocity"],
                latest_water_level=latest["water_level"],
                unit="m³/s",
                time=latest["time"],
                is_simulated=station.is_simulated,
            )
        )

    return results
