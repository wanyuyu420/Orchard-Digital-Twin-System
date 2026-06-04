from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_session
from app.models import SensorReading, SensorMetric
from app.schemas.sensor import SensorReadingOut

router = APIRouter()


@router.get("", response_model=list[SensorReadingOut])
async def list_readings(
    limit: int = 100,
    sensor_id: Optional[int] = None,
    metric_key: Optional[str] = None,
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    is_simulated: Optional[bool] = None,
    session: AsyncSession = Depends(get_session),
):
    stmt = select(SensorReading).join(SensorMetric)
    if sensor_id:
        stmt = stmt.where(SensorReading.sensor_id == sensor_id)
    if metric_key:
        stmt = stmt.where(SensorMetric.metric_key == metric_key)
    if start:
        stmt = stmt.where(SensorReading.reading_time >= start)
    if end:
        stmt = stmt.where(SensorReading.reading_time <= end)
    if is_simulated is not None:
        stmt = stmt.where(SensorReading.is_simulated == is_simulated)
    stmt = stmt.order_by(desc(SensorReading.reading_time)).limit(limit)
    rows = (await session.execute(stmt)).scalars().all()
    return [
        SensorReadingOut(
            id=r.id,
            sensor_id=r.sensor_id,
            metric_id=r.metric_id,
            reading_time=r.reading_time,
            value_num=r.value_num,
            unit=r.unit,
            is_simulated=r.is_simulated,
        )
        for r in rows
    ]
