#!/bin/bash
# 停止高考志愿推荐系统服务

echo "正在停止服务..."
pkill -f "node server.js"
echo "✅ 服务已停止"
