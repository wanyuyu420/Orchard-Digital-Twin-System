# 赣南脐橙果园数字孪生系统

基于 **Cesium + FastAPI + GeoScene（易智瑞）** 的脐橙果园三维数字孪生与精准农情决策平台。通过无人机正射影像 + YOLO/SAM 大模型，实现树冠识别、生长指数反演、变量施肥决策与三维空间诊断。

> 本项目为「易智瑞（GeoScene）开发竞赛」参赛作品。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Vue 3 + Vite + TypeScript + Cesium 1.144 + Element Plus + Pinia + ECharts |
| 后端 | FastAPI + SQLAlchemy + PostGIS（演示可用 SQLite） |
| GIS | GeoScene Server（空间查询/要素写入）、Cesium 3D Tiles |
| AI | YOLOv8 树冠检测 + SAM 边缘分割 + 冠层高度反演 |

## 目录结构

```
├── src/                    # 前端源码（Vue 3）
│   ├── views/              # 页面（果园态势/冠层解析/农情决策/数据管理）
│   ├── components/cesium/  # Cesium 3D 图层与渲染
│   ├── components/orchard/ # 果园业务组件（查询/详情/施肥等）
│   ├── cesium/gis/         # GIS 工具库（绘图/测量/剖面/体积）
│   ├── stores/             # Pinia 状态管理
│   └── api/                # 前端接口封装
├── backend/                # 后端源码（FastAPI）
│   ├── app/api/            # API 路由（orange / layers）
│   ├── app/models/         # 数据模型（orange_trees / gis_layers）
│   ├── app/services/       # 服务（geoscene / yolo / sam / tif / height）
│   ├── alembic/            # 数据库迁移
│   └── scripts/            # 数据脚本（训练/播种/导出）
├── public/                 # 静态资源（Cesium 库、3D 模型）
├── scripts/                # 前端/数据工具脚本
└── pics/                   # 界面截图
```

## 环境要求

- **Node.js** ≥ 18，npm
- **Python** ≥ 3.10
- **GeoScene Server**（后端强依赖，需可访问的 FeatureServer）
- **果园 2.0 数据集**（3D Tiles，可选，用于加载真实果园模型）

## 快速开始

### 1. 后端

```bash
cd backend
pip install -r requirements.txt

# 配置 GeoScene 环境变量（必填，缺了后端无法启动）
cp .env.example .env
# 编辑 .env，填入 GEOSCENE_SERVER_URL / FEATURE_SERVER_URL / USERNAME / PASSWORD

# 初始化数据库（演示默认 SQLite，无需额外配置；生产用 PostgreSQL + PostGIS）
alembic upgrade head

# 启动后端（http://127.0.0.1:8000）
uvicorn app.main:app --reload --port 8000
```

> ⚠️ 后端启动时会校验 GeoScene Server 连通性，连不上会直接退出。请先确认 `.env` 配置正确、GeoScene Server 可访问。

### 2. 前端

```bash
npm install
npm run dev          # http://localhost:5173
```

前端通过 Vite 代理把 `/api` 转发到 `http://127.0.0.1:8000`（可用 `VITE_API_TARGET` 环境变量覆盖）。

### 3. 一键同时启动

```bash
npm run dev:all
```

### 4. 3D Tiles 静态服务（可选）

若前端要加载本地「果园 2.0」3D Tiles 数据（跨域加载），单独起一个静态服务：

```bash
python scripts/serve_orchard.py [--port 8765]
```

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动前端开发服务器 |
| `npm run dev:backend` | 启动后端（uvicorn） |
| `npm run dev:all` | 同时启动前后端 |
| `npm run build` | 前端类型检查 + 生产构建 |
| `npm run type-check` | 仅 Vue-TS 类型检查 |
| `npm run test` | 运行 Vitest 单元测试 |
| `alembic upgrade head` | 执行数据库迁移（在 backend/ 下） |

## 数据库迁移

迁移链（线性）：

```
fbe21847efec (init_schema) → a1b2c3d4e5f6 (gis_layers) → 1f2badb4efd8 (orange_tree)
```

演示环境使用 SQLite（`demo.db`，已 gitignore）。生产环境使用 PostgreSQL + PostGIS，在 `.env` 中配置 `DATABASE_URL`。

## 部署 / 竞赛提交

```bash
npm run build        # 生成 dist/ 生产构建产物
```

构建产物在 `dist/`，可由任意静态服务器托管（Nginx 等），并将 `/api`、`/tiles/`、`/terrain/` 反向代理到后端。
