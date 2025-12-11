# 水利数字孪生基础平台

基于 Vue3 + TypeScript + Cesium 1.136 构建的水利数字孪生可视化平台。提供数字流域、气象监测、设备管理、数据治理等功能模块。

## 系统截图

### 数据看板
![数据看板](pics/dashboard.png)

### 气象监测
![气象监测](pics/meteo.png)

### 设备管理
![设备管理](pics/device.png)

### 数据治理
![数据治理](pics/data.png)

### 仿真模拟
![仿真模拟](pics/simulation.png)

### AI 工程
![AI工程](pics/ai.png)

## 技术栈

### 前端
- 框架: Vue 3.5 + TypeScript 5.6
- 构建工具: Vite 6
- 3D 引擎: Cesium 1.136（定制版本，含 Globe 滤镜）
- 状态管理: Pinia
- UI 组件: Element Plus
- 图表: ECharts 5

### 后端
- 框架: FastAPI + Python 3.10+
- 数据库: PostgreSQL 15 + PostGIS
- ORM: SQLAlchemy 2 (async)
- 迁移工具: Alembic

## 项目结构

```
water-digital-new/
├── src/                    # 前端源码
│   ├── components/         # 组件
│   │   ├── business/       # 业务组件
│   │   ├── cesium/         # Cesium 相关
│   │   ├── charts/         # 图表
│   │   └── common/         # 通用
│   ├── views/              # 页面
│   ├── stores/             # 状态管理
│   ├── utils/              # 工具
│   └── api/                # API
├── backend/                # 后端服务
│   ├── app/                # FastAPI 应用
│   ├── alembic/            # 数据库迁移
│   └── scripts/            # 脚本
├── public/                 # 静态资源
│   └── Cesium-1.136-epawse/ # Cesium 库
└── docs/                   # 文档
```

## 快速开始

详细配置指南见 [DEVELOPMENT.md](DEVELOPMENT.md)。

### 前端

```bash
npm install
cp .env.example .env.local
# 编辑 .env.local，填写天地图 Key
npm run dev
# http://localhost:5173
```

### 后端

默认使用 SQLite，无需配置数据库：

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# 首次启动自动创建 demo.db 并填充演示数据
```

生产环境 PostgreSQL 配置见 [backend/README.md](backend/README.md)。

## 环境变量

### 前端 (.env.local)

```env
VITE_TIANDITU_KEY=YOUR_TIANDITU_KEY
```

### 后端 (.env)
```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/dbname
DATABASE_URL_SYNC=postgresql+psycopg2://user:password@localhost:5432/dbname
API_PREFIX=/api
DEBUG=true
```

更多配置信息见 [DEVELOPMENT.md](DEVELOPMENT.md)。

## 功能模块

- 数据看板: 实时数据概览、关键指标监控
- 气象监测: 雷达回波/降雨分屏、数据可视化
- 设备管理: 设备状态监控、地图标注
- 数据治理: 数据资产管理、ETL
- 仿真模拟: 洪水演进、水动力学模拟
- AI 工程: 智能分析、预测模型

## 许可证

MIT License

## 贡献

贡献指南见 [CONTRIBUTING.md](CONTRIBUTING.md)。
