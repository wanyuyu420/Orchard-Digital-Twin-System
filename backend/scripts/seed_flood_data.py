"""
Seed flood visualization scenarios with mock data.

Usage:
    cd backend
    PYTHONPATH=. python scripts/seed_flood_data.py
"""
import asyncio
from datetime import datetime
from shapely.geometry import Point, MultiPolygon, Polygon
from shapely import wkb
from geoalchemy2.shape import from_shape

from app.database import AsyncSessionLocal
from app.models import FloodScenario, FloodFrame


# 乌鲁木齐河流域大致位置 (WGS84)
URUMQI_RIVER_CENTER = (87.58, 43.79)  # 乌鲁木齐市区
MAQUAN_CENTER = (87.52, 43.48)  # 马圈沟水库区域


def create_expanding_polygon(
    center: tuple[float, float],
    base_size: float,
    expansion_factor: float,
    irregular: bool = True
) -> Polygon:
    """Create a polygon that expands from center.

    Args:
        center: (lng, lat) center point
        base_size: base size in degrees (~0.01 = ~1km)
        expansion_factor: 0-1 scale factor for expansion
        irregular: add irregularity to make it look natural
    """
    import random
    random.seed(42)  # Reproducible

    lng, lat = center
    size = base_size * (0.2 + 0.8 * expansion_factor)

    # Create a rough polygon shape
    points = []
    num_points = 8
    for i in range(num_points):
        angle = 2 * 3.14159 * i / num_points
        r = size
        if irregular:
            r *= (0.7 + 0.3 * random.random())
        px = lng + r * 1.2 * (1 if i < num_points//2 else -1) * \
            abs(angle - 3.14159) / 3.14159
        py = lat + r * (0.5 if i % 2 == 0 else -0.5) * \
            (1 - abs(i - num_points/2) / (num_points/2))
        # Simplified: create ellipse-like shape
        import math
        px = lng + r * math.cos(angle)
        py = lat + r * math.sin(angle) * 0.7  # Flatten for river-like shape
        points.append((px, py))

    points.append(points[0])  # Close the polygon
    return Polygon(points)


def generate_urumqi_river_scenario() -> tuple[FloodScenario, list[FloodFrame]]:
    """Generate flood scenario for Urumqi River downtown area."""
    scenario = FloodScenario(
        code="URUMQI_RIVER_2024",
        name="乌鲁木齐河洪水演进模拟",
        region_center=from_shape(Point(*URUMQI_RIVER_CENTER), srid=4326),
        region_extent=15.0,
        description="基于历史洪水数据的乌鲁木齐河流域洪水演进模拟，覆盖城区段。"
    )

    frames = []
    # Generate 15 frames from t=0 to t=100
    time_steps = [0, 7, 15, 22, 30, 40, 50, 60, 70, 80, 85, 90, 95, 98, 100]

    for i, t in enumerate(time_steps):
        # Water level rises then stabilizes
        if t <= 50:
            water_level = 1.0 + (t / 50) * 4.5  # Rise to 5.5m
        else:
            water_level = 5.5 - ((t - 50) / 50) * 1.5  # Recede to 4.0m

        # Area expands then contracts
        if t <= 60:
            area_factor = t / 60
        else:
            area_factor = 1.0 - (t - 60) / 60

        area_km2 = 0.5 + area_factor * 8.5  # 0.5 to 9.0 km²

        # Create expanding polygon
        poly = create_expanding_polygon(
            URUMQI_RIVER_CENTER,
            base_size=0.03,  # ~3km base
            expansion_factor=area_factor
        )

        frame = FloodFrame(
            time_step=t,
            water_level=round(water_level, 2),
            area_km2=round(area_km2, 3),
            polygons=from_shape(MultiPolygon([poly]), srid=4326)
        )
        frames.append(frame)

    return scenario, frames


def generate_maquan_reservoir_scenario() -> tuple[FloodScenario, list[FloodFrame]]:
    """Generate flood scenario for Maquan Reservoir area."""
    scenario = FloodScenario(
        code="MAQUAN_RESERVOIR_2024",
        name="马圈沟水库淹没模拟",
        region_center=from_shape(Point(*MAQUAN_CENTER), srid=4326),
        region_extent=10.0,
        description="马圈沟水库库区在不同水位下的淹没范围模拟。"
    )

    frames = []
    time_steps = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

    for i, t in enumerate(time_steps):
        # Steady rise in water level (dam scenario)
        water_level = 2.0 + (t / 100) * 6.0  # 2.0 to 8.0m
        area_km2 = 1.0 + (t / 100) * 5.0  # 1.0 to 6.0 km²

        poly = create_expanding_polygon(
            MAQUAN_CENTER,
            base_size=0.025,
            expansion_factor=t / 100
        )

        frame = FloodFrame(
            time_step=t,
            water_level=round(water_level, 2),
            area_km2=round(area_km2, 3),
            polygons=from_shape(MultiPolygon([poly]), srid=4326)
        )
        frames.append(frame)

    return scenario, frames


async def seed_flood_data():
    """Insert flood scenarios into database."""
    from sqlalchemy import select, delete

    async with AsyncSessionLocal() as session:
        # Check if data already exists
        existing = await session.execute(select(FloodScenario))
        if existing.scalars().first() is not None:
            print("⚠️  Flood scenarios already exist. Deleting and re-seeding...")
            await session.execute(delete(FloodFrame))
            await session.execute(delete(FloodScenario))
            await session.commit()

        # Seed Urumqi River scenario
        scenario1, frames1 = generate_urumqi_river_scenario()
        session.add(scenario1)
        await session.flush()
        for f in frames1:
            f.scenario_id = scenario1.id
            session.add(f)

        # Seed Maquan Reservoir scenario
        scenario2, frames2 = generate_maquan_reservoir_scenario()
        session.add(scenario2)
        await session.flush()
        for f in frames2:
            f.scenario_id = scenario2.id
            session.add(f)

        await session.commit()

        print(f"✅ Seeded {2} flood scenarios:")
        print(f"   - {scenario1.name}: {len(frames1)} frames")
        print(f"   - {scenario2.name}: {len(frames2)} frames")


if __name__ == "__main__":
    asyncio.run(seed_flood_data())
