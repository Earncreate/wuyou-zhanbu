@echo off
chcp 65001 >nul
cd /d %~dp0
if not exist ..\.venv\Scripts\python.exe (
  echo 没有找到虚拟环境，先创建并安装依赖...
  "C:\Users\Yaojiawei\.workbuddy\binaries\python\versions\3.13.12\python.exe" -m venv ..\.venv
  ..\.venv\Scripts\python.exe -m pip install -r requirements.txt
)
echo 启动无忧占卜云同步服务： http://127.0.0.1:8123
echo 接口文档： http://127.0.0.1:8123/docs
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8123
pause
