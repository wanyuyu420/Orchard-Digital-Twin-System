from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_session
from app.models import Sensor, SensorMetric
from app.schemas.sensor import SensorOut, SensorMetricOut
from geoalchemy2.shape import to_shape

router = APIRouter()


@router.get("", response_model=list[SensorOut])
async def list_sensors(is_simulated: bool | None = None, session: AsyncSession = Depends(get_session)):
    stmt = select(Sensor)
    if is_simulated is not None:
        stmt = stmt.where(Sensor.is_simulated == is_simulated)
    sensors = (await session.execute(stmt)).scalars().all()
    return [
        SensorOut(
            id=s.id,
            code=s.point_code,
            section_id=s.section_id,
            sensor_type_id=s.sensor_type_id,
            is_simulated=s.is_simulated,
            lng=to_shape(s.location).x if s.location is not None else None,
            lat=to_shape(s.location).y if s.location is not None else None,
        )
        for s in sensors
    ]


@router.get("/{sensor_id}/metrics", response_model=list[SensorMetricOut])
async def list_sensor_metrics(sensor_id: int, session: AsyncSession = Depends(get_session)):
    stmt = select(SensorMetric).where(SensorMetric.sensor_id == sensor_id)
    metrics = (await session.execute(stmt)).scalars().all()
    return [
        SensorMetricOut(
            id=m.id,
            metric_key=m.metric_key,
            name_cn=m.name_cn,
            unit=m.unit,
            warn_low=m.warn_low,
            warn_high=m.warn_high,
            is_simulated=m.is_simulated,
        )
        for m in metrics
    ]
