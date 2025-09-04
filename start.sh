#!/bin/bash

echo "🚀 启动彩票预选系统..."
echo ""

# 检查Python环境
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 未安装，请先安装Python3"
    exit 1
fi

# 检查pip
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 未安装，请先安装pip3"
    exit 1
fi

# 安装依赖
echo "📦 安装Python依赖..."
pip3 install -r requirements.txt

# 启动后端服务器
echo "🔧 启动真实数据服务器..."
python3 real_server.py &
SERVER_PID=$!

# 等待服务器启动
sleep 3

# 检查服务器是否启动成功
if curl -s http://localhost:5000/api/health > /dev/null; then
    echo "✅ 后端服务器启动成功"
else
    echo "❌ 后端服务器启动失败"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# 启动前端服务器
echo "🌐 启动前端服务器..."
python3 -m http.server 8000 &
FRONTEND_PID=$!

echo ""
echo "🎉 系统启动完成！"
echo ""
echo "📱 访问地址："
echo "   前端: http://localhost:8000"
echo "   后端API: http://localhost:5000"
echo ""
echo "🔧 API接口："
echo "   福彩3D: http://localhost:5000/api/fc3d"
echo "   双色球: http://localhost:5000/api/ssq"
echo "   健康检查: http://localhost:5000/api/health"
echo ""
echo "⏹️  按 Ctrl+C 停止服务"

# 等待用户中断
trap "echo ''; echo '🛑 正在停止服务...'; kill $SERVER_PID $FRONTEND_PID 2>/dev/null; echo '✅ 服务已停止'; exit 0" INT

# 保持脚本运行
wait
