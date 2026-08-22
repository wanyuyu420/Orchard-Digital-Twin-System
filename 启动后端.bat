@echo off
chcp 65001 >nul
cd /d "%~dp0backend"
echo ============================================
echo   果园后端服务启动中...
echo   端口: 8000
echo   环境: geoai (conda)
echo   模式: --no-reload（防止改代码重启杀掉推理入库任务）
echo   启动后请勿关闭此窗口
echo ============================================
C:\Users\asus\miniconda3\envs\geoai\python.exe -m uvicorn app.main:app --no-reload --host 0.0.0.0 --port 8000
pause
