# 开发环境配置

## 前端

### Node.js

```bash
node --version  # 需要 18+
npm --version
npm install
```

### 环境变量

创建 `.env.local`:

```env
VITE_TIANDITU_KEY=YOUR_TIANDITU_KEY
```

申请地址: https://console.tianditu.gov.cn/

### 开发服务器

```bash
npm run dev
# http://localhost:5173
```

### Cesium 定制库

项目使用 Cesium 1.136-epawse（含 Globe 滤镜和水体优化）。

库文件: `public/Cesium-1.136-epawse/`

修改配置编辑:
- `src/utils/ctrlCesium/`
- `src/components/cesium/`

### 生产构建

```bash
npm run build
```

## 后端

### Python 环境

```bash
python3 --version  # 需要 3.10+
cd backend
pip install -r requirements.txt
```

### 快速启动（SQLite 演示模式）

默认使用 SQLite，无需配置数据库：

```bash
uvicorn app.main:app --reload --port 8000
# 首次启动自动创建 demo.db 并填充演示数据
```

### 生产环境（PostgreSQL）

创建 `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/dbname
DATABASE_URL_SYNC=postgresql+psycopg2://user:password@localhost:5432/dbname
```

### 数据库迁移

```bash
alembic upgrade head
```

新建迁移:
```bash
alembic revision --autogenerate -m "description"
alembic upgrade head
```

### 启动服务

```bash
uvicorn app.main:app --reload --port 8000
```

## 本地忽略规则


`.gitignore` 中的规则对所有开发者保持一致。若需额外忽略文件:

```bash
git update-index --assume-unchanged <file>
git update-index --no-assume-unchanged <file>  # 恢复
```

## IDE 配置

### VS Code

安装推荐扩展: 见 `.vscode/extensions.json`

### PyCharm

后端路径: `backend/`

标记为 Sources Root，Python 解释器指向 `backend/venv/bin/python`

## 故障排查

### npm 依赖问题

```bash
rm -rf node_modules package-lock.json
npm install
```

### Python 虚拟环境问题

```bash
rm -rf backend/venv
python3 -m venv backend/venv
source backend/venv/bin/activate
pip install -r backend/requirements.txt
```

### 数据库连接失败

检查 PostgreSQL 运行状态:
```bash
psql -U user -d dbname -c "SELECT version();"
```

验证 PostGIS:
```bash
psql -U user -d dbname -c "SELECT postgis_version();"
```

### Cesium 加载错误

验证库文件:
```bash
ls -la public/Cesium-1.136-epawse/Cesium.js
```

浏览器控制台查看网络错误。

## 性能优化

### 前端

- Vite 开发服务器自动 HMR（Hot Module Replacement）
- 生产构建启用代码分割和 Tree-shaking

### 后端

- FastAPI 异步支持，使用 SQLAlchemy 2 async ORM
- 连接池: `pool_size=10, max_overflow=20`
- 查询优化: 使用 `joinedload` 减少 N+1 查询



## 容器化（可选）

```bash
docker-compose build
docker-compose up
```

Dockerfile 和 docker-compose.yml 已配置。
