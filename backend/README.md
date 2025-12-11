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

## API 端点

| 类别 | 端点 |
|------|------|
| 健康检查 | `GET /api/health` |
| 水位 | `GET /api/water_levels` |
| 雨量 | `GET /api/rainfall_data` |
| 渗压 | `GET /api/pore_pressures` |
| 应力 | `GET /api/stress_data` |
| 设备 | `GET /api/iot_devices` |
| 事件 | `GET /api/events` |
| 统计 | `GET /api/stats` |
| 告警 | `GET /api/warnings` |
