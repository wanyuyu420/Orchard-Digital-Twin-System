"""
HEC-RAS Scenario Seeder - Populates hec_ras_scenarios table with KB and Flow scenarios.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.hec_ras import HecRasScenario


DEFAULT_HEC_RAS_SCENARIOS = [
    {
        "code": "kb",
        "name": "KB 水库区域",
        "description": "克孜尔水库仿真场景，展示水位变化过程",
        "extent_west": 78.39340761853362,
        "extent_south": 39.70807277277257,
        "extent_east": 78.70916873023513,
        "extent_north": 39.865953328623334,
        "camera_height": 150000,
        "camera_heading": 0,
        "camera_pitch": -90,
        "frames_path": "/simulation/hec-ras/kb/frames",
        "stats_path": "/simulation/hec-ras/kb/stats.json",
        "total_frames": 433,
        "frame_extension": "webp",
        "legend_title": "水位标高 (m)",
        "legend_min": 1120,
        "legend_max": 1125,
        "is_enabled": True,
    },
    {
        "code": "flow",
        "name": "Flow 河道区域",
        "description": "下游河道洪水演进仿真场景",
        "extent_west": 85.61303950442203,
        "extent_south": 46.96844597723123,
        "extent_east": 90.47827004670474,
        "extent_north": 48.029314937329616,
        "camera_height": 150000,
        "camera_heading": 0,
        "camera_pitch": -90,
        "frames_path": "/simulation/hec-ras/flow/frames",
        "stats_path": "/simulation/hec-ras/flow/stats.json",
        "total_frames": 1197,
        "frame_extension": "webp",
        "legend_title": "水深范围 (m)",
        "legend_min": 0,
        "legend_max": 5,
        "is_enabled": True,
    },
]


async def seed_hec_ras_scenarios(session: AsyncSession) -> int:
    """
    Seed HEC-RAS scenarios if table is empty.
    Returns number of scenarios created.
    """
    # Check if any scenarios exist
    result = await session.execute(select(HecRasScenario).limit(1))
    if result.scalars().first():
        return 0  # Already seeded

    count = 0
    for scenario_data in DEFAULT_HEC_RAS_SCENARIOS:
        scenario = HecRasScenario(**scenario_data)
        session.add(scenario)
        count += 1

    await session.commit()
    print(f"[seed] Created {count} HEC-RAS scenarios")
    return count
