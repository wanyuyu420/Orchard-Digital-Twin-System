"""
Default Layer Seeder - Auto-populates gis_layers table with predefined layers
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.gis_layer import GISLayer


DEFAULT_LAYERS = [
    {
        "code": "terrain_global",
        "name": "全球地形 (Cesium)",
        "group_name": "Terrain",
        "layer_type": "terrain",
        "url": None,
        "is_visible": False,
        "is_enabled": True,
        "icon": "fa-solid fa-globe",
        "order": 1,
        "config": {
            "provider": "cesium_world_terrain",
            "exclusive_group": "terrain"
        }
    },
    {
        "code": "terrain_xinjiang",
        "name": "新疆高精度地形 (云端)",
        "group_name": "Terrain",
        "layer_type": "terrain",
        "url": None,
        "is_visible": False,
        "is_enabled": True,
        "icon": "fa-solid fa-mountain-sun",
        "order": 2,
        "config": {
            "provider": "ion",
            "assetId": 4260109,
            "exclusive_group": "terrain"
        }
    },
    {
        "code": "terrain_local",
        "name": "新疆高精度地形 (本地)",
        "group_name": "Terrain",
        "layer_type": "terrain",
        "url": "/terrain/local",
        "is_visible": False,
        "is_enabled": True,
        "icon": "fa-solid fa-hard-drive",
        "order": 3,
        "config": {
            "provider": "custom",
            "exclusive_group": "terrain"
        }
    },
    {
        "code": "osgb_tiles",
        "name": "倾斜摄影",
        "group_name": "3D Models",
        "layer_type": "3dtiles",
        "url": "/tiles/osgb/tileset.json",
        "is_visible": False,
        "is_enabled": True,
        "icon": "fa-solid fa-city",
        "order": 10,
        "config": {
            "ellipsoidOffset": 12,
            "terrainOffset": 8
        }
    },
    {
        "code": "bim_tiles",
        "name": "BIM 模型",
        "group_name": "3D Models",
        "layer_type": "3dtiles",
        "url": "/tiles/bim/tileset.json",
        "is_visible": False,
        "is_enabled": True,
        "icon": "fa-solid fa-cube",
        "order": 11,
        "config": {
            "alignment": {
                "longitude": 78.42108125522402,
                "latitude": 39.7811204696115,
                "height": 1125,
                "rotationX": -90,
                "rotationY": 0,
                "rotationZ": 0,
                "scale": 1
            }
        }
    },
    {
        "code": "hydrology_stations",
        "name": "水雨情站",
        "group_name": "Sensors",
        "layer_type": "api_point",
        "url": "/hydrological_stations",  # No /api/v1 prefix - apiClient adds it
        "is_visible": False,
        "is_enabled": True,
        "icon": "fa-solid fa-water",
        "order": 20,
        "config": {
            "mapping": {"lng": "lng", "lat": "lat", "id": "id", "name": "station_name"},
            "labelField": "station_name",
            "autoFlyTo": True,
            "pointStyle": {
                "color": "#00BFFF",
                "pixelSize": 12
            },
            "realtime": {
                "enabled": True,
                "type": "websocket",
                "updateFields": ["latest_water_level", "latest_flow_rate", "latest_velocity"]
            }
        }
    },
    {
        "code": "monitoring_facilities",
        "name": "监测设施",
        "group_name": "Sensors",
        "layer_type": "api_point",
        "url": "/admin/facilities",  # No /api/v1 prefix
        "is_visible": False,
        "is_enabled": True,
        "icon": "fa-solid fa-video",
        "order": 21,
        "config": {
            "mapping": {"lng": "lng", "lat": "lat", "id": "id", "name": "name"},
            "labelField": "name",
            "autoFlyTo": True,
            "responseKey": "items",  # API returns {items: [...]}
            "requestParams": {"page_size": 100},
            "pointStyle": {
                "color": "#FFD700",
                "pixelSize": 10
            }
        }
    },
    {
        "code": "dom_20cm",
        "name": "正射影像 (20cm)",
        "group_name": "Imagery",
        "layer_type": "imagery",
        "url": "/tiles/dom/20cm/{z}/{x}/{reverseY}.png",
        "is_visible": False,
        "is_enabled": True,
        "icon": "fa-solid fa-satellite",
        "order": 5,
        "config": {
            "provider": "tms",
            "urlTemplate": "/tiles/dom/20cm/{z}/{x}/{reverseY}.png",
            "minimumLevel": 10,
            "maximumLevel": 18,
            "bounds": {
                "west": 78.38535297721101,
                "south": 39.72655175723501,
                "east": 78.47498082390356,
                "north": 39.79644281186187
            },
            "autoFlyTo": True,
            "flyToHeight": 2000,
            "colorToAlpha": "#FFFFFF",
            "colorToAlphaThreshold": 0.1
        }
    },
    {
        "code": "dom_8cm",
        "name": "高清正射 (8cm)",
        "group_name": "Imagery",
        "layer_type": "imagery",
        "url": "/tiles/dom/8cm/{z}/{x}/{reverseY}.png",
        "is_visible": False,
        "is_enabled": True,
        "icon": "fa-solid fa-satellite-dish",
        "order": 6,
        "config": {
            "provider": "tms",
            "urlTemplate": "/tiles/dom/8cm/{z}/{x}/{reverseY}.png",
            "minimumLevel": 10,
            "maximumLevel": 20,
            "bounds": {
                "west": 78.38535297721101,
                "south": 39.72655175723501,
                "east": 78.47498082390356,
                "north": 39.79644281186187
            },
            "autoFlyTo": True,
            "flyToHeight": 500,
            "colorToAlpha": "#FFFFFF",
            "colorToAlphaThreshold": 0.1
        }
    },
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
    print(f"[seed] Created {count} default GIS layers")
    return count
