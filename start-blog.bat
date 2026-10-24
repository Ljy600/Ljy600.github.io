@echo off
chcp 65001 >nul
cd /d %~dp0
title 博客写作环境（关闭此窗口即停止服务）
echo 正在启动博客环境，稍后会自动打开写作后台...
start "" cmd /c "timeout /t 3 >nul & start http://localhost:5555/admin/"
node build.js && node serve.js
pause
