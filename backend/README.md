# 后端服务

水利数字孪生平台 FastAPI 后端。

## 快速开始

默认使用 SQLite 数据库，无需额外配置：

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

首次启动时自动创建 `demo.db` 并填充演示数据。

### 演示数据

| 类型 | 数量 | API 端点 |
|------|------|----------|
| 水位传感器 | 5 | `/api/water_levels` |
| 雨量传感器 | 3 | `/api/rainfall_data` |
| 渗压传感器 | 4 | `/api/pore_pressures` |
| 应力传感器 | 4 | `/api/stress_data` |
| IoT 设备 | 5 | `/api/iot_devices` |
| 洪水事件 | 3 | `/api/events` |

每个传感器包含 7 天逐小时历史数据。

---

## 生产环境（PostgreSQL）

### 环境要求

- Python 3.10+
- PostgreSQL 15+ 及 PostGIS 扩展

### 配置

创建 `.env` 文件：

```env
DATABASE_URL=postgresql+asyncpg://用户名:密码@localhost:5432/water_twin
DATABASE_URL_SYNC=postgresql+psycopg2://用户名:密码@localhost:5432/water_twin
ENABLE_SEED_DATA=false
```

### 初始化

```bash
alembic upgrade head
python -m scripts.seed_data  # 可选
```

---

## GIS 数据目录配置

为避免在项目根目录存放大规模 GIS 数据，可通过 `GIS_DATA_DIR` 环境变量配置独立的数据目录：

```env
# Windows
GIS_DATA_DIR=D:\para\data\gis-data

# macOS / Ubuntu
GIS_DATA_DIR=/home/user/data/gis-data
```

**目录结构**（在 `GIS_DATA_DIR` 下）：

```
osgb/           # 倾斜摄影 3D Tiles
bim/            # BIM 3D Tiles
dom/tiles/      # DOM 正射影像
```

未设置时，回退到项目 `data/` 目录。

---

## API 端点

| 类别 | 端点 |
|------|------|
| 健康检查 | `GET /api/health` |
| 图层配置 | `GET /api/v1/layers` |
| 水位 | `GET /api/v1/water_levels` |
| 雨量 | `GET /api/v1/rainfall_data` |
| 渗压 | `GET /api/v1/pore_pressures` |
| 应力 | `GET /api/v1/stress_data` |
| 设备 | `GET /api/v1/iot_devices` |
| 事件 | `GET /api/v1/events` |
| 统计 | `GET /api/v1/stats` |
| 告警 | `GET /api/v1/warnings` |

---

## 图层管理

图层配置存储在数据库 `gis_layers` 表中，首次启动时自动填充默认图层。

### 默认图层

| 图层代码 | 名称 | 类型 | 说明 |
|---------|------|------|------|
| `terrain_global` | 全球地形 | terrain | Cesium World Terrain |
| `terrain_ellipsoid` | 无地形模式 | terrain | 椭球体（无地形） |

### 添加自定义图层

编辑 `scripts/seed_layers.py` 中的 `DEFAULT_LAYERS` 列表，然后删除 `demo.db` 重启服务。

**支持的图层类型：**

| layer_type | 说明 | 配置示例 |
|------------|------|----------|
| `terrain` | 地形数据 | `{"provider": "cesium_world_terrain"}` |
| `imagery` | 正射影像 | `{"provider": "ion", "assetId": 12345}` |
| `3dtiles` | 3D Tiles 模型 | `{"provider": "ion", "assetId": 12345}` 或 URL |
| `api_point` | API 点位数据 | `{"mapping": {"lng": "lng", "lat": "lat"}}` |

**示例 - 添加 Cesium Ion 3D Tiles：**

```python
{
    "code": "my_model",
    "name": "我的模型",
    "group_name": "三维模型",
    "layer_type": "3dtiles",
    "url": None,
    "is_visible": False,
    "is_enabled": True,
    "icon": "fa-solid fa-city",
    "order": 10,
    "config": {
        "provider": "ion",
        "assetId": 12345  # 替换为你的 Ion Asset ID
    }
}
