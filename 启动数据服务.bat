@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   果园数据服务启动中...
echo   端口: 8766
echo   数据目录: D:\Esri_data_4people\qc_data
echo   启动后请勿关闭此窗口
echo ============================================
python scripts\serve_orchard.py
pause
