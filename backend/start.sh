#!/bin/bash
# 高考志愿推荐系统启动脚本

echo "======================================"
echo "  高考志愿推荐系统启动脚本"
echo "======================================"

# 进入后端目录
cd "$(dirname "$0")"

# 检查node_modules是否存在
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 启动服务
echo "🚀 启动服务器..."
echo "服务地址: http://服务器IP:3000"
echo "按 Ctrl+C 停止服务"
echo ""

node server.js
