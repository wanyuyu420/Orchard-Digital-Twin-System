"""
Default Layer Seeder - Auto-populates gis_layers table with predefined layers
Open Source Version: Minimal demo configuration
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.gis_layer import GISLayer


DEFAULT_LAYERS = [
    # ============ Terrain Layers ============
    {
        "code": "terrain_global",
        "name": "全球地形",
        "group_name": "地形数据",
        "layer_type": "terrain",
        "url": None,
        "is_visible": True,  # Default terrain
        "is_enabled": True,
        "icon": "fa-solid fa-globe",
        "order": 1,
        "config": {
            "provider": "cesium_world_terrain",
            "exclusive_group": "terrain"
        }
    },
    {
        "code": "terrain_ellipsoid",
        "name": "无地形模式",
        "group_name": "地形数据",
        "layer_type": "terrain",
        "url": None,
        "is_visible": False,
        "is_enabled": True,
        "icon": "fa-solid fa-circle",
        "order": 2,
        "config": {
            "provider": "ellipsoid",
            "exclusive_group": "terrain"
        }
    },
    # ============ 3D Models ============
    # NOTE: Add your own Cesium Ion asset IDs or local 3D Tiles URLs.
    # Example:
    # {
    #     "code": "custom_3dtiles",
    #     "name": "Custom 3D Model",
    #     "group_name": "3D Models",
    #     "layer_type": "3dtiles",
    #     "url": "/tiles/model/tileset.json",  # Or use Ion: config.provider="ion", config.assetId=XXX
    #     "is_visible": False,
    #     "is_enabled": True,
    #     "icon": "fa-solid fa-city",
    #     "order": 10,
    #     "config": {}
    # },
    # ============ Sensor Points ============
    # NOTE: Add sensor point layers when you have data with coordinates.
    # Example:
    # {
    #     "code": "monitoring_points",
    #     "name": "Monitoring Stations",
    #     "group_name": "Sensors",
    #     "layer_type": "api_point",
    #     "url": "/your_api_endpoint",
    #     "is_visible": False,
    #     "is_enabled": True,
    #     "icon": "fa-solid fa-location-dot",
    #     "order": 20,
    #     "config": {
    #         "mapping": {"lng": "longitude", "lat": "latitude", "id": "id", "name": "name"},
    #         "labelField": "name",
    #         "pointStyle": {"color": "#00BFFF", "pixelSize": 12}
    #     }
    # },
]


async def seed_default_layers(session: AsyncSession) -> int:
    """
    Seed default layers if table is empty.
    Returns number of layers created.
    """
    # Check if any layers exist
    result = await session.execute(select(GISLayer).limit(1))
    if result.scalars().first():
        return 0  # Already seeded

    count = 0
    for layer_data in DEFAULT_LAYERS:
        layer = GISLayer(**layer_data)
        session.add(layer)
        count += 1

    await session.commit()
    print(f"[seed] Created {count} default GIS layers (demo mode)")
    return count
