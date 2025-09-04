#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试版彩票数据服务器
提供真实格式的测试数据
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import random
from datetime import datetime, timedelta
import json

app = Flask(__name__)
CORS(app)

def generate_realistic_fc3d_data(count=300):
    """生成真实的福彩3D测试数据"""
    data = []
    today = datetime.now()
    
    for i in range(count):
        # 生成期号（2024年格式）
        period = f"2024{str(1000 - i).zfill(3)}"
        
        # 生成日期（倒推）
        date = (today - timedelta(days=i)).strftime('%Y-%m-%d')
        
        # 生成号码（基于真实统计规律）
        number = generate_realistic_fc3d_number()
        
        data.append({
            'period': period,
            'date': date,
            'number': number
        })
    
    return data

def generate_realistic_ssq_data(count=300):
    """生成真实的双色球测试数据"""
    data = []
    today = datetime.now()
    
    for i in range(count):
        # 生成期号（2024年格式）
        period = f"2024{str(1000 - i).zfill(3)}"
        
        # 生成日期（倒推）
        date = (today - timedelta(days=i)).strftime('%Y-%m-%d')
        
        # 生成红球和蓝球
        red_balls = generate_realistic_ssq_red_balls()
        blue_ball = random.randint(1, 16)
        
        data.append({
            'period': period,
            'date': date,
            'redBalls': red_balls,
            'blueBall': blue_ball
        })
    
    return data

def generate_realistic_fc3d_number():
    """生成真实的福彩3D号码"""
    # 基于真实统计的权重
    weights = [0.105, 0.108, 0.102, 0.095, 0.098, 0.100, 0.102, 0.105, 0.108, 0.107]
    
    number = ''
    for _ in range(3):
        rand = random.random()
        cumulative = 0
        for i, weight in enumerate(weights):
            cumulative += weight
            if rand <= cumulative:
                number += str(i)
                break
    
    # 避免全相同数字
    if number[0] == number[1] == number[2]:
        number = number[:2] + str(random.randint(0, 9))
    
    return number

def generate_realistic_ssq_red_balls():
    """生成真实的双色球红球"""
    red_balls = []
    while len(red_balls) < 6:
        num = random.randint(1, 33)
        if num not in red_balls:
            red_balls.append(num)
    
    return sorted(red_balls)

@app.route('/api/fc3d', methods=['GET'])
def get_fc3d():
    """获取福彩3D数据API"""
    try:
        limit = int(request.args.get('limit', 300))
        data = generate_realistic_fc3d_data(limit)
        
        return jsonify({
            'success': True,
            'data': data,
            'count': len(data),
            'source': '真实格式测试数据'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e),
            'data': []
        }), 500

@app.route('/api/ssq', methods=['GET'])
def get_ssq():
    """获取双色球数据API"""
    try:
        limit = int(request.args.get('limit', 300))
        data = generate_realistic_ssq_data(limit)
        
        return jsonify({
            'success': True,
            'data': data,
            'count': len(data),
            'source': '真实格式测试数据'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e),
            'data': []
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查API"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'message': '测试版彩票数据服务器运行正常'
    })

if __name__ == '__main__':
    print("🚀 启动测试版彩票数据服务器...")
    print("📊 提供真实格式的测试数据")
    print("🌐 API地址:")
    print("   - 福彩3D: http://localhost:5000/api/fc3d")
    print("   - 双色球: http://localhost:5000/api/ssq")
    print("   - 健康检查: http://localhost:5000/api/health")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
