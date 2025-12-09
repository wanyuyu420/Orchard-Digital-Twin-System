# 贡献指南

## 入门

### 克隆仓库

```bash
git clone https://github.com/Epawse/water-digital-twin-platform.git
cd water-digital-twin-platform
```

### 配置环境

详见 [DEVELOPMENT.md](DEVELOPMENT.md)

### 启动开发

前端（终端 1）:
```bash
npm install
npm run dev
```

后端（终端 2）:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

访问 `http://localhost:5173`

## 代码规范

### 分支

- `main`: 生产分支
- feature 分支从 `main` 创建:

```bash
git checkout -b feature/description
```

### 提交信息

```
feat: 新增功能
fix: 修复 BUG
docs: 文档更新
style: 格式调整
refactor: 代码重构
perf: 性能优化
test: 测试
```

### 风格

**前端**: TypeScript + Vue 3 Composition API, Prettier, ESLint

**后端**: Python 3.10+, FastAPI 异步, SQLAlchemy ORM

## 常见任务

### 新增 API 端点

1. 创建模型: `backend/app/models/`
2. 创建模式: `backend/app/schemas/`
3. 创建路由: `backend/app/api/`
4. 在 router.py 中注册

### 新增前端页面

1. 创建视图: `src/views/`
2. 添加路由: `src/router/index.ts`
3. 菜单注册: TopRibbon.vue

### 修改数据库

```bash
cd backend
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## 调试

### 前端

VS Code 调试配置在 `.vscode/` 中，浏览器 F12，Vue DevTools 扩展

### 后端

```bash
DEBUG=true uvicorn app.main:app --reload
```

## 报告问题

- 创建 GitHub Issue
- 说明问题和复现步骤
- 提供环境信息

## 许可证

MIT License

