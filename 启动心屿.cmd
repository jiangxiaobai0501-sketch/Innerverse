@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 22.12 或以上版本，然后重新打开此文件。
  pause
  exit /b 1
)
if not exist node_modules (
  echo 正在安装依赖，请保持网络连接...
  call npm.cmd ci
  if errorlevel 1 goto failed
)
echo 启动后请打开 http://127.0.0.1:5173/
echo 关闭此窗口会停止网站。日记已保存在浏览器中。
call npm.cmd run dev
if errorlevel 1 goto failed
exit /b 0
:failed
echo 启动失败，请查看上方错误信息。若端口被占用，请先关闭已运行的心屿。
pause
exit /b 1
