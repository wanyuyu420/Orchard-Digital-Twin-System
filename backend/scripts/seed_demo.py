#!/usr/bin/env python3
"""
Create and seed the demo SQLite database with mock data.
This script can be run standalone or is called on app startup when enable_seed_data=True.
"""
import asyncio
from datetime import datetime, timedelta
import random

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# We need to import models to register them with Base
from app.database import Base
from app.config import get_settings
from app.models import (
    MonitoringFacility,
    MonitoringSection,
    SensorType,
    Sensor,
    SensorMetric,
    SensorReading,
    SimulatedDevice,
    ModelProduct,
    RasterProduct,
    VectorProduct,
)


# ============ Mock Data ============

# Water level stations (reservoirs + hydrological)
WATER_LEVEL_STATIONS = [
    {"name": "乌鲁瓦提水库", "value": 1962.5, "warn_high": 1968},
    {"name": "大西海子水库", "value": 846.8, "warn_high": 850},
    {"name": "克孜尔水库", "value": 1120, "warn_high": 1130},
    {"name": "阿拉尔水文站", "value": 1012.5, "warn_high": 1050},
    {"name": "英巴扎水文站", "value": 892, "warn_high": 950},
]

# Rainfall stations
RAINFALL_STATIONS = [
    {"name": "天山北坡雨量站", "value": 12.5, "warn_high": 50},
    {"name": "伊犁河谷雨量站", "value": 25, "warn_high": 50},
    {"name": "阿尔泰山雨量站", "value": 8.5, "warn_high": 50},
]

# Pore pressure sensors
PORE_PRESSURE_SENSORS = [
    {"name": "钢岔管段-渗压计Pcg-1", "value": 0.35, "warn_high": 0.5},
    {"name": "钢岔管段-渗压计Pcg-2", "value": 0.42, "warn_high": 0.5},
    {"name": "混凝土段-渗压计Pcg-3", "value": 0.28, "warn_high": 0.5},
    {"name": "进水口-渗压计Pcg-4", "value": 0.52, "warn_high": 0.5},  # Warning!
]

# Stress sensors
STRESS_SENSORS = [
    {"name": "钢岔管段-应力计M4f-1", "value": 125.5, "warn_high": 200},
    {"name": "钢岔管段-应力计M4f-2", "value": 138.2, "warn_high": 200},
    {"name": "钢筋计-Nf-1", "value": 85.6, "warn_high": 150},
    {"name": "锚杆计-Df-1", "value": 42.3, "warn_high": 80},
]

# IoT Devices
MOCK_IOT_DEVICES = [
    {"device_id": "iot_lvl_001", "name": "水位遥测终端-阿拉尔", "protocol": "SL651-2014",
        "station_id": "hyd_001", "metrics": ["waterLevel", "flow"], "freq_sec": 300, "status": "online"},
    {"device_id": "iot_lvl_002", "name": "水位遥测终端-英巴扎", "protocol": "SL651-2014",
        "station_id": "hyd_002", "metrics": ["waterLevel", "flow"], "freq_sec": 300, "status": "online"},
    {"device_id": "iot_gate_001", "name": "闸门控制器-大西海子", "protocol": "ModbusRTU",
        "station_id": "res_002", "metrics": ["gateStatus"], "freq_sec": 120, "status": "online"},
    {"device_id": "iot_rain_001", "name": "雨量站终端-伊犁", "protocol": "RS485",
        "station_id": "rain_002", "metrics": ["rainfall"], "freq_sec": 600, "status": "online"},
    {"device_id": "iot_pressure_001", "name": "渗压监测终端-钢岔管", "protocol": "RS485",
        "station_id": "pressure_001", "metrics": ["pore_pressure"], "freq_sec": 600, "status": "online"},
]


async def seed_database(session: AsyncSession):
    """Seed the database with comprehensive demo data for dashboard."""

    # Check if already seeded
    result = await session.execute(select(MonitoringFacility).limit(1))
    if result.scalars().first():
        print("[seed] Database already seeded, skipping...")
        return

    print("[seed] Seeding comprehensive demo data...")

    # 1. Create demo facility
    facility = MonitoringFacility(
        code="DEMO_FACILITY",
        name="MMK发电引水洞演示监测设施",
        facility_type="hydropower",
        is_simulated=True,
    )
    session.add(facility)
    await session.flush()

    # 2. Create demo section
    section = MonitoringSection(
        facility_id=facility.id,
        code="DEMO_SECTION",
        name="发电引水洞监测断面",
        section_type="tunnel",
        is_simulated=True,
    )
    session.add(section)
    await session.flush()

    # 3. Create sensor types
    sensor_types = {
        "water_level": SensorType(code="water_level", name="水位计", unit="m", is_simulated=True),
        "rainfall": SensorType(code="rainfall", name="雨量计", unit="mm", is_simulated=True),
        "pore_pressure": SensorType(code="pore_pressure", name="渗压计", unit="MPa", is_simulated=True),
        "stress": SensorType(code="stress", name="应力计", unit="MPa", is_simulated=True),
    }
    for st in sensor_types.values():
        session.add(st)
    await session.flush()

    now = datetime.now()
    sensor_count = 0
    reading_count = 0

    # 4a. Create water level sensors
    for station in WATER_LEVEL_STATIONS:
        sensor = Sensor(
            section_id=section.id,
            sensor_type_id=sensor_types["water_level"].id,
            point_code=station["name"],
            status="active",
            is_simulated=True,
        )
        session.add(sensor)
        await session.flush()
        sensor_count += 1

        metric = SensorMetric(
            sensor_id=sensor.id,
            metric_key="water_level",
            name_cn="水位",
            unit="m",
            warn_high=station.get("warn_high"),
            is_simulated=True,
        )
        session.add(metric)
        await session.flush()

        # 7 days of hourly readings
        for hour in range(24 * 7):
            reading_time = now - timedelta(hours=hour)
            variation = random.uniform(-0.05, 0.05) * station["value"]
            reading = SensorReading(
                sensor_id=sensor.id,
                metric_id=metric.id,
                reading_time=reading_time,
                value_num=round(station["value"] + variation, 2),
                is_simulated=True,
            )
            session.add(reading)
            reading_count += 1

    # 4b. Create rainfall sensors
    for station in RAINFALL_STATIONS:
        sensor = Sensor(
            section_id=section.id,
            sensor_type_id=sensor_types["rainfall"].id,
            point_code=station["name"],
            status="active",
            is_simulated=True,
        )
        session.add(sensor)
        await session.flush()
        sensor_count += 1

        metric = SensorMetric(
            sensor_id=sensor.id,
            metric_key="rainfall",
            name_cn="降雨量",
            unit="mm",
            warn_high=station.get("warn_high"),
            is_simulated=True,
        )
        session.add(metric)
        await session.flush()

        for hour in range(24 * 7):
            reading_time = now - timedelta(hours=hour)
            # Rainfall varies more
            variation = random.uniform(-0.3, 0.5) * station["value"]
            reading = SensorReading(
                sensor_id=sensor.id,
                metric_id=metric.id,
                reading_time=reading_time,
                value_num=max(0, round(station["value"] + variation, 2)),
                is_simulated=True,
            )
            session.add(reading)
            reading_count += 1

    # 4c. Create pore pressure sensors
    for station in PORE_PRESSURE_SENSORS:
        sensor = Sensor(
            section_id=section.id,
            sensor_type_id=sensor_types["pore_pressure"].id,
            point_code=station["name"],
            status="active",
            is_simulated=True,
        )
        session.add(sensor)
        await session.flush()
        sensor_count += 1

        metric = SensorMetric(
            sensor_id=sensor.id,
            metric_key="pore_pressure",
            name_cn="渗压",
            unit="MPa",
            warn_high=station.get("warn_high"),
            is_simulated=True,
        )
        session.add(metric)
        await session.flush()

        for hour in range(24 * 7):
            reading_time = now - timedelta(hours=hour)
            variation = random.uniform(-0.02, 0.02)
            reading = SensorReading(
                sensor_id=sensor.id,
                metric_id=metric.id,
                reading_time=reading_time,
                value_num=round(station["value"] + variation, 3),
                is_simulated=True,
            )
            session.add(reading)
            reading_count += 1

    # 4d. Create stress sensors
    for station in STRESS_SENSORS:
        sensor = Sensor(
            section_id=section.id,
            sensor_type_id=sensor_types["stress"].id,
            point_code=station["name"],
            status="active",
            is_simulated=True,
        )
        session.add(sensor)
        await session.flush()
        sensor_count += 1

        metric = SensorMetric(
            sensor_id=sensor.id,
            metric_key="stress",
            name_cn="应力",
            unit="MPa",
            warn_high=station.get("warn_high"),
            is_simulated=True,
        )
        session.add(metric)
        await session.flush()

        for hour in range(24 * 7):
            reading_time = now - timedelta(hours=hour)
            variation = random.uniform(-2, 2)
            reading = SensorReading(
                sensor_id=sensor.id,
                metric_id=metric.id,
                reading_time=reading_time,
                value_num=round(station["value"] + variation, 2),
                is_simulated=True,
            )
            session.add(reading)
            reading_count += 1

    # 5. Create simulated devices
    for device in MOCK_IOT_DEVICES:
        d = SimulatedDevice(
            device_id=device["device_id"],
            name=device["name"],
            protocol=device["protocol"],
            station_id=device["station_id"],
            metrics=device["metrics"],
            freq_sec=device["freq_sec"],
            status=device["status"],
            is_simulated=True,
        )
        session.add(d)

    # 6. Create demo products
    model_products = [
        ModelProduct(domain="flood", name="洪水演练模型", version="1.0",
                     product_type="flood_simulation", is_simulated=True),
        ModelProduct(domain="hydro", name="水文预报模型", version="2.1",
                     product_type="hydro_forecast", is_simulated=True),
    ]
    for mp in model_products:
        session.add(mp)

    raster_products = [
        RasterProduct(domain="rainfall", name="降雨格点数据",
                      product_type="rainfall_grid", is_simulated=True),
        RasterProduct(domain="terrain", name="DEM地形数据",
                      product_type="dem", is_simulated=True),
    ]
    for rp in raster_products:
        session.add(rp)

    vector_products = [
        VectorProduct(domain="hydro", name="河流矢量",
                      product_type="river_network", is_simulated=True),
        VectorProduct(domain="admin", name="行政区划",
                      product_type="admin_boundary", is_simulated=True),
    ]
    for vp in vector_products:
        session.add(vp)

    await session.commit()
    print(f"[seed] Demo data seeded successfully!")
    print(
        f"[seed] Created {sensor_count} sensors with {reading_count} readings")
    print(f"[seed] Created {len(MOCK_IOT_DEVICES)} IoT devices")
    print(
        f"[seed] Created {len(model_products)} model + {len(raster_products)} raster + {len(vector_products)} vector products")


async def create_tables_and_seed():
    """Create tables and seed data for SQLite."""
    settings = get_settings()

    if not settings.is_sqlite:
        print("[seed] Not using SQLite, skipping auto-seed. Use alembic for PostgreSQL.")
        return

    print(f"[seed] Creating tables in SQLite: {settings.database_url}")

    engine = create_async_engine(settings.database_url, echo=False)

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed data
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        await seed_database(session)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(create_tables_and_seed())
