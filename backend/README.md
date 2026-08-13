# 后端服务

赣南脐橙数字孪生平台 FastAPI 后端。

## 快速开始

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

> ⚠️ 启动强依赖 **GeoScene Server**：`main.py` 在 lifespan 阶段会做连通性校验，连不上会直接退出。请先在 `.env` 中配置 `GEOSCENE_*` 环境变量。

---

## 配置

创建 `.env` 文件（参考 `.env.example`）：

```env
# 数据库（默认 SQLite，无需额外配置）
# 生产环境 PostgreSQL + PostGIS：
# DATABASE_URL=postgresql+asyncpg://用户名:密码@localhost:5432/navel_orange_twin
# DATABASE_URL_SYNC=postgresql+psycopg2://用户名:密码@localhost:5432/navel_orange_twin

# GeoScene Server（必填）
GEOSCENE_SERVER_URL=http://<host>:6443/arcgis
GEOSCENE_FEATURE_SERVER_URL=http://<host>:6443/arcgis/rest/services/OrangeTrees/FeatureServer
GEOSCENE_USERNAME=admin
GEOSCENE_PASSWORD=***
```

### 数据库初始化（PostgreSQL 生产环境）

```bash
alembic upgrade head
python -m scripts.seed_historical_trees  # 可选：填充历史老树演示数据
```

---

## API 端点

| 类别 | 端点 |
|------|------|
| 健康检查 | `GET /api/v1/health` |
| 空间诊断 | `POST /api/v1/orange/spatial-diagnose` |
| 精确查询 | `POST /api/v1/orange/trees/filter` |
| 历史老树 | `GET /api/v1/orange/historical-trees` |
| TIF 上传 | `POST /api/v1/orange/upload-tif` |
| 上传解读 | `POST /api/v1/orange/upload-and-interpret` |
| 任务状态 | `GET /api/v1/orange/upload-and-interpret/{task_id}` |
| 图层 CRUD | `GET/POST/PUT/PATCH/DELETE /api/v1/layers` |

---

## 数据模型

| 表 | 说明 |
|----|------|
| `orange_trees` | 赣南脐橙树木空间要素（冠幅/树高/生长指数/施肥等级等） |
| `gis_layers` | GIS 图层配置（地形/影像/3D Tiles 等） |

---

## 核心服务

| 服务 | 说明 |
|------|------|
| `geoscene_service` | GeoScene FeatureServer 空间查询与要素写入 |
| `yolo_service` | YOLO 树冠检测 |
| `sam_service` | SAM 树冠边缘分割 |
| `height_service` / `elevation_service` | 冠层高度反演 + 坡度坡向 |
| `tif_service` | 无人机正射 TIF 切片处理 |

---

## 数据脚本

| 脚本 | 说明 |
|------|------|
| `seed_historical_trees.py` | 填充历史老树演示数据 |
| `train_yolov8s.py` / `train_orange_finetune.py` | YOLO 模型训练 |
| `shp_to_yolo_labels.py` | SHP 转 YOLO 标注 |
| `export_orange_trees.py` | 导出树木要素 |
| `run_orchard_demo_v2.py` | 果园演示流程 |

---

## GIS 数据目录配置

可通过 `GIS_DATA_DIR` 环境变量配置独立数据目录，避免在项目根目录存放大规模 GIS 数据：

```env
# Windows
GIS_DATA_DIR=D:\para\data\gis-data

# macOS / Ubuntu
GIS_DATA_DIR=/home/user/data/gis-data
```
