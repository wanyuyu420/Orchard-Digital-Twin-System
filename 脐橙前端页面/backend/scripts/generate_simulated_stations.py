#!/usr/bin/env python3
"""
模拟水文站数据生成脚本
基于马圈沟水文站数据规范生成模拟站点数据
"""
import asyncio
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import select

# 添加 backend 到 path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import AsyncSessionLocal
from app.models import (
    MonitoringFacility,
    MonitoringSection,
    SensorType,
    Sensor,
    SensorMetric,
    SensorReading,
    HydrologicalStation,
)

# 模拟站点配置
SIMULATED_STATIONS = [
    {
        "code": "BFG",
        "name": "板房沟水文站",
        "river_name": "板房沟",
        "basin_name": "乌鲁木齐河流域",
        "base_flow": 0.8,  # 基准流量 m³/s
        "base_velocity": 0.6,  # 基准流速 m/s
        "base_level": 0.15,  # 基准水位 m
    },
    {
        "code": "HYC",
        "name": "红雁池水文站",
        "river_name": "乌鲁木齐河",
        "basin_name": "乌鲁木齐河流域",
        "base_flow": 1.2,
        "base_velocity": 0.7,
        "base_level": 0.2,
    },
    {
        "code": "WLB",
        "name": "乌拉泊水文站",
        "river_name": "乌拉泊河",
        "basin_name": "乌鲁木齐河流域",
        "base_flow": 0.5,
        "base_velocity": 0.45,
        "base_level": 0.12,
    },
]

# 指标配置
METRICS_CONFIG = {
    "water_level": {"name_cn": "水位", "unit": "m"},
    "velocity": {"name_cn": "流速", "unit": "m/s"},
    "flow_rate": {"name_cn": "瞬时流量", "unit": "m³/s"},
    "surface_elevation": {"name_cn": "水面高程", "unit": "m"},
}


async def get_or_create_sensor_type(session, code: str, name: str) -> SensorType:
    """获取或创建传感器类型"""
    stmt = select(SensorType).where(SensorType.code == code)
    result = await session.execute(stmt)
    sensor_type = result.scalars().first()
    if not sensor_type:
        sensor_type = SensorType(code=code, name=name, is_simulated=True)
        session.add(sensor_type)
        await session.flush()
    return sensor_type


async def get_or_create_facility(session, config: dict) -> MonitoringFacility:
    """获取或创建监测设施"""
    facility_code = f"{config['code']}_FACILITY"
    stmt = select(MonitoringFacility).where(MonitoringFacility.code == facility_code)
    result = await session.execute(stmt)
    facility = result.scalars().first()
    if not facility:
        facility = MonitoringFacility(
            code=facility_code,
            name=f"{config['name']}监测设施",
            facility_type="hydrological_station",
            is_simulated=True,
        )
        session.add(facility)
        await session.flush()
    return facility


async def get_or_create_section(session, facility: MonitoringFacility, config: dict) -> MonitoringSection:
    """获取或创建监测断面"""
    section_code = f"{config['code']}_MAIN"
    stmt = select(MonitoringSection).where(
        MonitoringSection.facility_id == facility.id,
        MonitoringSection.code == section_code,
    )
    result = await session.execute(stmt)
    section = result.scalars().first()
    if not section:
        section = MonitoringSection(
            facility_id=facility.id,
            code=section_code,
            name=f"{config['name']}主断面",
            section_type="hydrological",
            is_simulated=True,
        )
        session.add(section)
        await session.flush()
    return section


async def get_or_create_station(session, facility: MonitoringFacility, config: dict) -> HydrologicalStation:
    """获取或创建水文站"""
    stmt = select(HydrologicalStation).where(HydrologicalStation.station_code == config["code"])
    result = await session.execute(stmt)
    station = result.scalars().first()
    if not station:
        station = HydrologicalStation(
            facility_id=facility.id,
            station_code=config["code"],
            station_name=config["name"],
            river_name=config["river_name"],
            basin_name=config["basin_name"],
            is_simulated=True,
        )
        session.add(station)
        await session.flush()
    return station


async def get_or_create_sensor(
    session,
    section: MonitoringSection,
    sensor_type: SensorType,
    station: HydrologicalStation,
    point_code: str,
) -> Sensor:
    """获取或创建传感器"""
    stmt = select(Sensor).where(Sensor.section_id == section.id, Sensor.point_code == point_code)
    result = await session.execute(stmt)
    sensor = result.scalars().first()
    if not sensor:
        sensor = Sensor(
            section_id=section.id,
            sensor_type_id=sensor_type.id,
            hydrological_station_id=station.id,
            point_code=point_code,
            status="active",
            is_simulated=True,
        )
        session.add(sensor)
        await session.flush()
    return sensor


async def get_or_create_metric(session, sensor: Sensor, metric_key: str) -> SensorMetric:
    """获取或创建指标"""
    stmt = select(SensorMetric).where(SensorMetric.sensor_id == sensor.id, SensorMetric.metric_key == metric_key)
    result = await session.execute(stmt)
    metric = result.scalars().first()
    if not metric:
        cfg = METRICS_CONFIG.get(metric_key, {})
        metric = SensorMetric(
            sensor_id=sensor.id,
            metric_key=metric_key,
            name_cn=cfg.get("name_cn", metric_key),
            unit=cfg.get("unit"),
            data_type="number",
            is_simulated=True,
        )
        session.add(metric)
        await session.flush()
    return metric


def generate_readings(
    sensor_id: int,
    metrics: dict[str, SensorMetric],
    config: dict,
    days: int = 7,
    interval_minutes: int = 5,
) -> list[SensorReading]:
    """生成模拟读数"""
    readings = []
    now = datetime.now()
    start_time = now - timedelta(days=days)

    current_time = start_time
    while current_time <= now:
        # 添加日变化和随机波动
        hour = current_time.hour
        # 日变化因子：白天流量稍大
        day_factor = 1.0 + 0.1 * (1 - abs(hour - 12) / 12)
        # 随机波动 ±10%
        random_factor = random.uniform(0.9, 1.1)

        flow_rate = config["base_flow"] * day_factor * random_factor
        velocity = config["base_velocity"] * day_factor * random.uniform(0.95, 1.05)
        water_level = config["base_level"] * random.uniform(0.9, 1.1)
        surface_elevation = 2130 + water_level  # 假设基准高程 2130m

        for metric_key, value in [
            ("water_level", water_level),
            ("velocity", velocity),
            ("flow_rate", flow_rate),
            ("surface_elevation", surface_elevation),
        ]:
            if metric_key in metrics:
                readings.append(
                    SensorReading(
                        sensor_id=sensor_id,
                        metric_id=metrics[metric_key].id,
                        reading_time=current_time,
                        value_num=round(value, 4),
                        is_simulated=True,
                    )
                )

        current_time += timedelta(minutes=interval_minutes)

    return readings


async def main():
    """主函数"""
    print("=" * 60)
    print("模拟水文站数据生成")
    print("=" * 60)

    async with AsyncSessionLocal() as session:
        # 获取或创建传感器类型
        radar_type = await get_or_create_sensor_type(session, "radar_flow_meter", "雷达流量计")

        for config in SIMULATED_STATIONS:
            print(f"\n[生成] {config['name']} ({config['code']})")

            # 创建设施、断面、站点
            facility = await get_or_create_facility(session, config)
            section = await get_or_create_section(session, facility, config)
            station = await get_or_create_station(session, facility, config)

            # 创建传感器
            sensor = await get_or_create_sensor(
                session, section, radar_type, station, f"{config['code']}_RADAR"
            )

            # 创建指标
            metrics = {}
            for metric_key in METRICS_CONFIG:
                metrics[metric_key] = await get_or_create_metric(session, sensor, metric_key)

            # 生成读数
            readings = generate_readings(sensor.id, metrics, config, days=7, interval_minutes=5)
            session.add_all(readings)
            print(f"  生成 {len(readings)} 条读数 (7天，5分钟间隔)")

        await session.commit()

    print("\n" + "=" * 60)
    print("模拟数据生成完成!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
