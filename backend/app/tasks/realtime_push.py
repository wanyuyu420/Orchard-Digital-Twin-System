"""Background task for pushing real-time sensor data via WebSocket."""
import asyncio
from datetime import datetime
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.models import Sensor, SensorMetric, SensorReading
from app.websocket import manager


import random

# Track random walk state for sensors to ensure smooth transitions
_sensor_walk_state: dict[str, float] = {}


async def get_latest_readings():
    """Fetch latest sensor readings from database and add small fluctuations."""
    async with AsyncSessionLocal() as session:
        # Get all metrics with their sensors
        stmt = (
            select(SensorMetric)
            .options(selectinload(SensorMetric.sensor))
            .where(SensorMetric.metric_key.in_([
                "water_level", "rainfall", "pore_pressure", "stress",
                "flow_rate", "velocity", "surface_elevation"
            ]))
        )
        metrics = (await session.execute(stmt)).scalars().all()

        readings = []
        for metric in metrics:
            # Get latest reading for this metric
            reading_stmt = (
                select(SensorReading)
                .where(SensorReading.metric_id == metric.id)
                .order_by(desc(SensorReading.reading_time))
                .limit(1)
            )
            reading = (await session.execute(reading_stmt)).scalars().first()

            if reading and metric.sensor:
                val = reading.value_num

                # Add pseudo-realtime fluctuation (Random Walk)
                # This makes static mock data look "alive" on charts
                key = f"{metric.sensor.id}:{metric.metric_key}"
                current_drift = _sensor_walk_state.get(key, 0.0)

                # Small step (-0.05% to 0.05% of base value)
                step = val * random.uniform(-0.0005, 0.0005)
                new_drift = current_drift + step

                # Clamp drift to stay within 1% of original value
                limit = val * 0.01
                new_drift = max(-limit, min(limit, new_drift))

                _sensor_walk_state[key] = new_drift
                fluctuated_value = val + new_drift

                readings.append({
                    "sensor_id": metric.sensor.id,
                    "station_name": metric.sensor.point_code,
                    "metric": metric.metric_key,
                    "value": round(fluctuated_value, 4),
                    "unit": metric.unit,
                    "timestamp": reading.reading_time.isoformat() if reading.reading_time else None,
                })

        return readings


async def check_warnings():
    """Check for threshold violations and return warnings."""
    async with AsyncSessionLocal() as session:
        stmt = (
            select(SensorMetric)
            .options(selectinload(SensorMetric.sensor))
            .where(
                (SensorMetric.warn_low.is_not(None)) | (
                    SensorMetric.warn_high.is_not(None))
            )
        )
        metrics = (await session.execute(stmt)).scalars().all()

        warnings = []
        for metric in metrics:
            reading_stmt = (
                select(SensorReading)
                .where(SensorReading.metric_id == metric.id)
                .order_by(desc(SensorReading.reading_time))
                .limit(1)
            )
            reading = (await session.execute(reading_stmt)).scalars().first()

            if not reading or reading.value_num is None:
                continue

            value = reading.value_num
            sensor = metric.sensor

            if metric.warn_high is not None and value > metric.warn_high:
                warnings.append({
                    "sensor_id": sensor.id,
                    "metric": metric.metric_key,
                    "level": "Yellow",
                    "message": f"{sensor.point_code} {metric.name_cn or metric.metric_key} 超限: {value}{metric.unit or ''}",
                    "timestamp": reading.reading_time.isoformat() if reading.reading_time else None,
                })

            if metric.warn_low is not None and value < metric.warn_low:
                warnings.append({
                    "sensor_id": sensor.id,
                    "metric": metric.metric_key,
                    "level": "Yellow",
                    "message": f"{sensor.point_code} {metric.name_cn or metric.metric_key} 低于下限: {value}{metric.unit or ''}",
                    "timestamp": reading.reading_time.isoformat() if reading.reading_time else None,
                })

        return warnings


# Track previously sent warnings to avoid duplicates
_last_warning_ids: set = set()


async def realtime_push_task():
    """Background task that pushes sensor data every 2 seconds."""
    global _last_warning_ids

    while True:
        try:
            # Only broadcast if there are connected clients
            if manager.connection_count > 0:
                # Push sensor readings
                readings = await get_latest_readings()
                if readings:
                    await manager.broadcast({
                        "type": "sensor_update",
                        "data": readings,
                        "timestamp": datetime.now().isoformat()
                    })

                # Check and push warnings
                warnings = await check_warnings()
                # Create unique IDs for deduplication
                current_warning_ids = {
                    f"{w['sensor_id']}:{w['metric']}:{w['level']}" for w in warnings
                }

                # Only send new warnings
                new_warnings = [
                    w for w in warnings
                    if f"{w['sensor_id']}:{w['metric']}:{w['level']}" not in _last_warning_ids
                ]

                if new_warnings:
                    await manager.broadcast({
                        "type": "alert_new",
                        "data": new_warnings,
                        "timestamp": datetime.now().isoformat()
                    })

                _last_warning_ids = current_warning_ids

        except Exception as e:
            # Log error but keep running
            print(f"[realtime_push] Error: {e}")

        await asyncio.sleep(2)  # Push every 2 seconds
