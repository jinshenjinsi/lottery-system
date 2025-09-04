#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
彩票数据代理服务器
获取真实的福彩3D和双色球开奖数据
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import json
import re
from datetime import datetime, timedelta
import time
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # 允许跨域请求

class LotteryDataScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
    
    def get_fc3d_data(self, limit=300):
        """获取福彩3D历史数据"""
        try:
            # 尝试多个数据源
            data_sources = [
                self._scrape_fc3d_from_500(),
                self._scrape_fc3d_from_cwl(),
                self._scrape_fc3d_from_sina()
            ]
            
            for data in data_sources:
                if data and len(data) > 0:
                    logger.info(f"成功获取福彩3D数据，共{len(data)}期")
                    return data[:limit]
            
            # 如果所有源都失败，返回空列表
            logger.warning("所有福彩3D数据源都失败")
            return []
            
        except Exception as e:
            logger.error(f"获取福彩3D数据失败: {e}")
            return []
    
    def get_ssq_data(self, limit=300):
        """获取双色球历史数据"""
        try:
            # 尝试多个数据源
            data_sources = [
                self._scrape_ssq_from_500(),
                self._scrape_ssq_from_cwl(),
                self._scrape_ssq_from_sina()
            ]
            
            for data in data_sources:
                if data and len(data) > 0:
                    logger.info(f"成功获取双色球数据，共{len(data)}期")
                    return data[:limit]
            
            # 如果所有源都失败，返回空列表
            logger.warning("所有双色球数据源都失败")
            return []
            
        except Exception as e:
            logger.error(f"获取双色球数据失败: {e}")
            return []
    
    def _scrape_fc3d_from_500(self):
        """从500.com获取福彩3D数据"""
        try:
            # 使用更简单的URL
            url = "https://datachart.500.com/fc3d/history/newinc/history.php?limit=300"
            response = self.session.get(url, timeout=15)
            response.encoding = 'gb2312'
            
            # 如果直接访问失败，尝试其他方式
            if response.status_code != 200:
                url = "https://datachart.500.com/fc3d/history/newinc/history.php"
                response = self.session.get(url, timeout=15)
                response.encoding = 'gb2312'
            
            soup = BeautifulSoup(response.text, 'html.parser')
            data = []
            
            # 查找开奖数据表格
            table = soup.find('table', {'id': 'tdata'})
            if not table:
                # 尝试其他可能的表格选择器
                table = soup.find('table', class_='tb_0')
            
            if table:
                rows = table.find_all('tr')[1:]  # 跳过表头
                for row in rows:
                    cells = row.find_all('td')
                    if len(cells) >= 4:
                        period = cells[0].text.strip()
                        date = cells[1].text.strip()
                        number = cells[2].text.strip()
                        
                        if period and date and number and len(number) == 3:
                            data.append({
                                'period': period,
                                'date': date,
                                'number': number
                            })
            
            logger.info(f"从500.com获取到{len(data)}期福彩3D数据")
            return data
            
        except Exception as e:
            logger.error(f"从500.com获取福彩3D数据失败: {e}")
            return []
    
    def _scrape_fc3d_from_cwl(self):
        """从中国福彩网获取福彩3D数据"""
        try:
            url = "http://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice"
            params = {
                'name': 'fc3d',
                'issueCount': '300',
                'issueStart': '',
                'issueEnd': '',
                'dayStart': '',
                'dayEnd': ''
            }
            
            response = self.session.get(url, params=params, timeout=10)
            result = response.json()
            
            data = []
            if result.get('state') == 0 and result.get('result'):
                for item in result['result']:
                    data.append({
                        'period': item.get('code', ''),
                        'date': item.get('date', ''),
                        'number': item.get('red', '')
                    })
            
            return data
            
        except Exception as e:
            logger.error(f"从中国福彩网获取福彩3D数据失败: {e}")
            return []
    
    def _scrape_fc3d_from_sina(self):
        """从新浪获取福彩3D数据"""
        try:
            url = "https://match.lottery.sina.com.cn/lotto/pc_zst/index?lottoType=fc3d&actionType=chzs"
            response = self.session.get(url, timeout=10)
            response.encoding = 'utf-8'
            
            soup = BeautifulSoup(response.text, 'html.parser')
            data = []
            
            # 查找开奖数据
            rows = soup.find_all('tr', class_='tb_0')
            for row in rows:
                cells = row.find_all('td')
                if len(cells) >= 4:
                    period = cells[0].text.strip()
                    date = cells[1].text.strip()
                    number = cells[2].text.strip()
                    
                    if period and date and number:
                        data.append({
                            'period': period,
                            'date': date,
                            'number': number
                        })
            
            return data
            
        except Exception as e:
            logger.error(f"从新浪获取福彩3D数据失败: {e}")
            return []
    
    def _scrape_ssq_from_500(self):
        """从500.com获取双色球数据"""
        try:
            url = "https://datachart.500.com/ssq/history/newinc/history.php"
            response = self.session.get(url, timeout=10)
            response.encoding = 'gb2312'
            
            soup = BeautifulSoup(response.text, 'html.parser')
            data = []
            
            # 查找开奖数据表格
            table = soup.find('table', {'id': 'tdata'})
            if table:
                rows = table.find_all('tr')[1:]  # 跳过表头
                for row in rows:
                    cells = row.find_all('td')
                    if len(cells) >= 4:
                        period = cells[0].text.strip()
                        date = cells[1].text.strip()
                        red_balls = cells[2].text.strip()
                        blue_ball = cells[3].text.strip()
                        
                        if period and date and red_balls and blue_ball:
                            data.append({
                                'period': period,
                                'date': date,
                                'redBalls': red_balls,
                                'blueBall': blue_ball
                            })
            
            return data
            
        except Exception as e:
            logger.error(f"从500.com获取双色球数据失败: {e}")
            return []
    
    def _scrape_ssq_from_cwl(self):
        """从中国福彩网获取双色球数据"""
        try:
            url = "http://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice"
            params = {
                'name': 'ssq',
                'issueCount': '300',
                'issueStart': '',
                'issueEnd': '',
                'dayStart': '',
                'dayEnd': ''
            }
            
            response = self.session.get(url, params=params, timeout=10)
            result = response.json()
            
            data = []
            if result.get('state') == 0 and result.get('result'):
                for item in result['result']:
                    data.append({
                        'period': item.get('code', ''),
                        'date': item.get('date', ''),
                        'redBalls': item.get('red', ''),
                        'blueBall': item.get('blue', '')
                    })
            
            return data
            
        except Exception as e:
            logger.error(f"从中国福彩网获取双色球数据失败: {e}")
            return []
    
    def _scrape_ssq_from_sina(self):
        """从新浪获取双色球数据"""
        try:
            url = "https://match.lottery.sina.com.cn/lotto/pc_zst/index?lottoType=ssq&actionType=chzs"
            response = self.session.get(url, timeout=10)
            response.encoding = 'utf-8'
            
            soup = BeautifulSoup(response.text, 'html.parser')
            data = []
            
            # 查找开奖数据
            rows = soup.find_all('tr', class_='tb_0')
            for row in rows:
                cells = row.find_all('td')
                if len(cells) >= 4:
                    period = cells[0].text.strip()
                    date = cells[1].text.strip()
                    red_balls = cells[2].text.strip()
                    blue_ball = cells[3].text.strip()
                    
                    if period and date and red_balls and blue_ball:
                        data.append({
                            'period': period,
                            'date': date,
                            'redBalls': red_balls,
                            'blueBall': blue_ball
                        })
            
            return data
            
        except Exception as e:
            logger.error(f"从新浪获取双色球数据失败: {e}")
            return []

# 创建爬虫实例
scraper = LotteryDataScraper()

@app.route('/api/fc3d', methods=['GET'])
def get_fc3d():
    """获取福彩3D数据API"""
    try:
        limit = request.args.get('limit', 300, type=int)
        data = scraper.get_fc3d_data(limit)
        
        if data:
            return jsonify({
                'success': True,
                'data': data,
                'count': len(data),
                'source': '真实开奖数据'
            })
        else:
            return jsonify({
                'success': False,
                'message': '无法获取福彩3D数据',
                'data': []
            }), 500
            
    except Exception as e:
        logger.error(f"福彩3D API错误: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'data': []
        }), 500

@app.route('/api/ssq', methods=['GET'])
def get_ssq():
    """获取双色球数据API"""
    try:
        limit = request.args.get('limit', 300, type=int)
        data = scraper.get_ssq_data(limit)
        
        if data:
            return jsonify({
                'success': True,
                'data': data,
                'count': len(data),
                'source': '真实开奖数据'
            })
        else:
            return jsonify({
                'success': False,
                'message': '无法获取双色球数据',
                'data': []
            }), 500
            
    except Exception as e:
        logger.error(f"双色球 API错误: {e}")
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
        'message': '彩票数据代理服务器运行正常'
    })

if __name__ == '__main__':
    print("🚀 启动彩票数据代理服务器...")
    print("📊 支持福彩3D和双色球真实数据获取")
    print("🌐 API地址:")
    print("   - 福彩3D: http://localhost:5000/api/fc3d")
    print("   - 双色球: http://localhost:5000/api/ssq")
    print("   - 健康检查: http://localhost:5000/api/health")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
