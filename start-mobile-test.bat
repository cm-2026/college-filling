@echo off
chcp 65001 >nul
echo ========================================
echo 启动高考志愿系统 - 手机测试模式
echo ========================================
echo.
echo 📱 手机测试步骤:
echo 1. 确保手机和电脑连接同一WiFi
echo 2. 启动后查看下方显示的局域网地址
echo 3. 在手机浏览器输入显示的地址
echo.
echo ========================================
echo.

cd /d e:\xm\backend

echo 正在启动后端服务...
echo.

node server.js

pause
