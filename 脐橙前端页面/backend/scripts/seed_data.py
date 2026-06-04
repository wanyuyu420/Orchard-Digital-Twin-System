"""
Seed script to insert simulated data into PostgreSQL.
- Inserts sensor types
- Converts mock_stations to sensors/metrics/readings (is_simulated=true)
- Inserts mock events/grids/resources into product tables
Run with: python -m backend.scripts.seed_data
"""
import asyncio
from datetime import datetime
from sqlalchemy import select
from app.database import AsyncSessionLocal, engine, Base
from app.models import (
    MonitoringFacility,
    MonitoringSection,
    SensorType,
    Sensor,
    SensorMetric,
    SensorReading,
    RasterProduct,
    VectorProduct,
    ModelProduct,
)
from app.utils.mock_data import MOCK_STATIONS, MOCK_FLOOD_EVENTS, MOCK_RAIN_GRID_FRAMES, MOCK_3D_RESOURCES
from app.utils.mock_data import MOCK_IOT_DEVICES
from app.models.sensor import SimulatedDevice


async def seed_sensor_types(session):
    types = [
        ("water_level", "电测水位计", "m"),
        ("pore_pressure", "渗压计", "kPa"),
        ("strain_plate", "钢板计", "10^-6"),
        ("rebar_stress", "钢筋应力计", "MPa"),
        ("displacement_4pt", "四点式变位计", "mm"),
        ("displacement_2pt", "二点式变位计", "mm"),
        ("joint_meter", "测缝计", "mm"),
        ("temperature", "温度计", "℃"),
        ("stress_free", "无应力计", "10^-6"),
        ("anchor_stress", "锚杆应力计", "MPa"),
        ("rain", "雨量站", "mm"),
    ]
    for code, name, unit in types:
        exists = await session.scalar(select(SensorType).where(SensorType.code == code))
        if exists:
            continue
        session.add(SensorType(code=code, name=name, unit=unit, is_simulated=True))


async def seed_sections(session) -> int:
    facility = await session.scalar(select(MonitoringFacility).where(MonitoringFacility.code == "SIM_FAC"))
    if not facility:
        facility = MonitoringFacility(code="SIM_FAC", name="模拟设施", is_simulated=True)
        session.add(facility)
        await session.flush()

    section = await session.scalar(
        select(MonitoringSection).where(MonitoringSection.facility_id == facility.id, MonitoringSection.code == "SIM_SEC")
    )
    if not section:
        section = MonitoringSection(
            facility_id=facility.id,
            code="SIM_SEC",
            name="模拟断面",
            section_type="simulated",
            is_simulated=True,
        )
        session.add(section)
        await session.flush()
    return section.id


async def seed_sensors(session, section_id: int):
    for s in MOCK_STATIONS:
        stype_code = "water_level" if s["type"] in ("reservoir", "hydrological") else "rain"
        stype = await session.scalar(select(SensorType).where(SensorType.code == stype_code))
        if not stype:
            continue
        sensor = await session.scalar(select(Sensor).where(Sensor.point_code == s["id"]))
        if not sensor:
            sensor = Sensor(
                section_id=section_id,
                sensor_type_id=stype.id if stype else None,
                point_code=s["id"],
                install_location_desc=s["name"],
                status="active",
                is_simulated=True,
            )
            session.add(sensor)
            await session.flush()
        metric_key = "water_level" if s["type"] in ("reservoir", "hydrological") else "rainfall"
        metric = await session.scalar(
            select(SensorMetric).where(SensorMetric.sensor_id == sensor.id, SensorMetric.metric_key == metric_key)
        )
        if not metric:
            metric = SensorMetric(
                sensor=sensor,
                metric_key=metric_key,
                name_cn="水位" if metric_key == "water_level" else "降雨量",
                unit="m" if metric_key == "water_level" else "mm",
                is_simulated=True,
            )
            session.add(metric)
            await session.flush()
        # only insert one latest reading per sensor/metric for seed
        has_reading = await session.scalar(
            select(SensorReading.id).where(SensorReading.sensor_id == sensor.id, SensorReading.metric_id == metric.id)
        )
        if not has_reading:
            session.add(
                SensorReading(
                    sensor_id=sensor.id,
                    metric_id=metric.id,
                    reading_time=datetime.utcnow(),
                    value_num=s.get("waterLevel") or s.get("rainfall") or 0,
                    unit=metric.unit,
                    is_simulated=True,
                )
            )


async def seed_products(session):
    for evt in MOCK_FLOOD_EVENTS:
        exists = await session.scalar(
            select(ModelProduct.id).where(
                ModelProduct.product_type == "flood_event",
                ModelProduct.name == evt["name"],
                ModelProduct.version == evt["id"],
            )
        )
        if exists:
            continue
        session.add(
            ModelProduct(
                domain="flood_forecast",
                name=evt["name"],
                version=evt["id"],
                valid_from=evt["start"],
                valid_to=evt["end"],
                product_type="flood_event",
                path="",
                meta=evt,
                is_simulated=True,
            )
        )
    for frame in MOCK_RAIN_GRID_FRAMES:
        exists = await session.scalar(
            select(RasterProduct.id).where(
                RasterProduct.product_type == "rain_grid",
                RasterProduct.name == frame["id"],
                RasterProduct.time_start == frame["time"],
            )
        )
        if exists:
            continue
        session.add(
            RasterProduct(
                domain="meteorology_grid",
                name=frame["id"],
                product_type="rain_grid",
                path=frame["grid"],
                time_start=frame["time"],
                is_simulated=True,
            )
        )
    for res in MOCK_3D_RESOURCES:
        exists = await session.scalar(
            select(VectorProduct.id).where(VectorProduct.product_type == "3d_resource", VectorProduct.name == res["name"])
        )
        if exists:
            continue
        session.add(
            VectorProduct(
                domain="resource_catalog",
                name=res["name"],
                product_type="3d_resource",
                path=res["tilesetUrl"],
                meta=res,
                is_simulated=True,
            )
        )

async def seed_iot_devices(session):
    """Insert simulated IoT devices."""
    for dev in MOCK_IOT_DEVICES:
        exists = await session.scalar(select(SimulatedDevice).where(SimulatedDevice.device_id == dev["id"]))
        if exists:
            continue
        session.add(
            SimulatedDevice(
                device_id=dev["id"],
                name=dev["name"],
                protocol=dev.get("protocol"),
                station_id=dev.get("stationId"),
                metrics=dev.get("metrics"),
                freq_sec=dev.get("freqSec"),
                status=dev.get("status"),
                is_simulated=True,
            )
        )


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as session:
        await seed_sensor_types(session)
        section_id = await seed_sections(session)
        await seed_sensors(session, section_id)
        await seed_products(session)
        await seed_iot_devices(session)
        await session.commit()


if __name__ == "__main__":
    asyncio.run(main())
