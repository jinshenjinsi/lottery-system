#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
真实彩票数据服务器
从多个官方数据源获取真实的福彩3D和双色球开奖数据
"""

from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import json
import re
from datetime import datetime, timedelta
import time
import logging
import random
from urllib.parse import urljoin, urlparse

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
# 允许 /api/* 跨域，确保在错误响应也返回 CORS 头
CORS(app, resources={r"/api/*": {"origins": "*"}})

@app.after_request
def add_cors_headers(resp):
    try:
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    except Exception:
        pass
    return resp

@app.route('/api/<path:subpath>', methods=['OPTIONS'])
def api_cors_preflight(subpath):
    resp = make_response('', 200)
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return resp

class RealLotteryDataScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        })
        
        # 数据缓存
        self.cache = {}
        self.cache_timeout = 300  # 5分钟缓存
    
    def get_fc3d_data(self, limit=300):
        """获取福彩3D历史数据"""
        cache_key = f"fc3d_{limit}"
        if self._is_cache_valid(cache_key):
            logger.info("使用缓存的福彩3D数据")
            return self.cache[cache_key]['data']
        
        try:
            # 尝试多个真实数据源（无模拟数据回退）
            data_sources = [
                self._scrape_fc3d_from_500_new(),
                self._scrape_fc3d_from_cwl_new(),
                self._scrape_fc3d_from_sina_new(),
                self._scrape_fc3d_from_163()
            ]
            
            for i, data in enumerate(data_sources):
                if data and len(data) > 0:
                    logger.info(f"成功从数据源{i+1}获取福彩3D数据，共{len(data)}期")
                    self._cache_data(cache_key, data)
                    return data[:limit]
            
            # 所有源失败，返回空
            logger.warning("所有福彩3D数据源都失败")
            return []
            
        except Exception as e:
            logger.error(f"获取福彩3D数据失败: {e}")
            return []
    
    def get_ssq_data(self, limit=300):
        """获取双色球历史数据"""
        cache_key = f"ssq_{limit}"
        if self._is_cache_valid(cache_key):
            logger.info("使用缓存的双色球数据")
            return self.cache[cache_key]['data']
        
        try:
            # 尝试多个数据源
            data_sources = [
                self._scrape_ssq_from_500_new(),
                self._scrape_ssq_from_cwl_new(),
                self._scrape_ssq_from_sina_new(),
                self._scrape_ssq_from_163()
            ]
            
            for i, data in enumerate(data_sources):
                if data and len(data) > 0:
                    logger.info(f"成功从数据源{i+1}获取双色球数据，共{len(data)}期")
                    # 更新最新开奖日期
                    data = self._update_latest_ssq_date(data)
                    self._cache_data(cache_key, data)
                    return data[:limit]
            
            # 如果所有源都失败，返回空列表
            logger.warning("所有双色球数据源都失败")
            return []
            
        except Exception as e:
            logger.error(f"获取双色球数据失败: {e}")
            return []
    
    def _update_latest_ssq_date(self, data):
        """更新双色球下一期开奖日期"""
        if not data:
            return data
        
        try:
            # 获取当前日期
            from datetime import datetime, timedelta
            today = datetime.now()
            
            # 双色球开奖时间：周二、四、日 21:15
            # 计算下一期开奖日期
            days_since_monday = today.weekday()  # 0=周一, 1=周二, 2=周三, 3=周四, 4=周五, 5=周六, 6=周日
            
            if days_since_monday == 0:  # 周一
                next_draw = today + timedelta(days=1)  # 明天周二
            elif days_since_monday == 1:  # 周二
                next_draw = today + timedelta(days=2)  # 后天周四
            elif days_since_monday == 2:  # 周三
                next_draw = today + timedelta(days=1)  # 明天周四
            elif days_since_monday == 3:  # 周四
                next_draw = today + timedelta(days=3)  # 后天周日
            elif days_since_monday == 4:  # 周五
                next_draw = today + timedelta(days=2)  # 后天周日
            elif days_since_monday == 5:  # 周六
                next_draw = today + timedelta(days=1)  # 明天周日
            else:  # 周日
                next_draw = today + timedelta(days=2)  # 后天周二
            
            # 更新第一条数据的日期为下一期开奖日期
            if data and len(data) > 0:
                # 格式化日期
                weekday_names = ['一', '二', '三', '四', '五', '六', '日']
                weekday = weekday_names[next_draw.weekday()]
                next_date = f"{next_draw.strftime('%Y-%m-%d')}({weekday})"
                
                # 更新期号（假设是连续递增的）
                if 'period' in data[0]:
                    try:
                        current_period = int(data[0]['period'])
                        next_period = str(current_period + 1)
                        data[0]['period'] = next_period
                    except:
                        pass
                
                data[0]['date'] = next_date
                logger.info(f"更新双色球下一期开奖日期为: {next_date}")
            
            return data
            
        except Exception as e:
            logger.error(f"更新双色球开奖日期失败: {e}")
            return data
    
    def _update_latest_fc3d_date(self, data):
        """更新福彩3D下一期开奖日期"""
        if not data:
            return data
        
        try:
            # 获取当前日期和时间
            from datetime import datetime, timedelta
            now = datetime.now()
            
            # 福彩3D开奖时间：每天21:15
            # 以21:15为界，过了21:15就显示第二天的日期
            if now.hour >= 21 and now.minute >= 15:
                # 已经过了21:15，下一期是明天
                next_draw = now + timedelta(days=1)
            else:
                # 还没到21:15，下一期是今天
                next_draw = now
            
            # 更新第一条数据的日期为下一期开奖日期
            if data and len(data) > 0:
                # 格式化日期
                next_date = next_draw.strftime('%Y-%m-%d')
                
                # 更新期号（假设是连续递增的）
                if 'period' in data[0]:
                    try:
                        current_period = int(data[0]['period'])
                        next_period = str(current_period + 1)
                        data[0]['period'] = next_period
                    except:
                        pass
                
                data[0]['date'] = next_date
                logger.info(f"更新福彩3D下一期开奖日期为: {next_date} (当前时间: {now.strftime('%H:%M')})")
            
            return data
            
        except Exception as e:
            logger.error(f"更新福彩3D开奖日期失败: {e}")
            return data
    
    def _scrape_fc3d_from_500_new(self):
        """从500.com获取福彩3D数据（新版本）"""
        try:
            # 尝试新的URL格式
            urls = [
                "https://datachart.500.com/fc3d/history/newinc/history.php",
                "https://datachart.500.com/fc3d/history/history.shtml",
                "https://www.500.com/fc3d/history/"
            ]
            
            for url in urls:
                try:
                    response = self.session.get(url, timeout=15)
                    if response.status_code == 200:
                        response.encoding = 'gb2312'
                        soup = BeautifulSoup(response.text, 'html.parser')
                        data = self._parse_fc3d_from_html(soup)
                        if data:
                            return data
                except Exception as e:
                    logger.debug(f"500.com URL {url} 失败: {e}")
                    continue
            
            return []
            
        except Exception as e:
            logger.error(f"从500.com获取福彩3D数据失败: {e}")
            return []
    
    def _scrape_ssq_from_500_new(self):
        """从500.com获取双色球数据（新版本）"""
        try:
            # 尝试新的URL格式
            urls = [
                "https://datachart.500.com/ssq/history/newinc/history.php",
                "https://datachart.500.com/ssq/history/history.shtml",
                "https://www.500.com/ssq/history/"
            ]
            
            for url in urls:
                try:
                    response = self.session.get(url, timeout=15)
                    if response.status_code == 200:
                        response.encoding = 'gb2312'
                        soup = BeautifulSoup(response.text, 'html.parser')
                        data = self._parse_ssq_from_html(soup)
                        if data:
                            return data
                except Exception as e:
                    logger.debug(f"500.com URL {url} 失败: {e}")
                    continue
            
            return []
            
        except Exception as e:
            logger.error(f"从500.com获取双色球数据失败: {e}")
            return []
    
    def _scrape_fc3d_from_cwl_new(self):
        """从中国福彩网获取福彩3D数据（新版本）"""
        try:
            # 使用新的API接口
            url = "https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice"
            params = {
                'name': 'fc3d',
                'issueCount': '300',
                'issueStart': '',
                'issueEnd': '',
                'dayStart': '',
                'dayEnd': ''
            }
            
            response = self.session.get(url, params=params, timeout=15)
            if response.status_code == 200:
                result = response.json()
                if result.get('state') == 0 and result.get('result'):
                    data = []
                    for item in result['result']:
                        data.append({
                            'period': item.get('code', ''),
                            'date': item.get('date', ''),
                            'number': item.get('red', '')
                        })
                    return data
            
            return []
            
        except Exception as e:
            logger.error(f"从中国福彩网获取福彩3D数据失败: {e}")
            return []
    
    def _scrape_ssq_from_cwl_new(self):
        """从中国福彩网获取双色球数据（新版本）"""
        try:
            # 使用新的API接口
            url = "https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice"
            params = {
                'name': 'ssq',
                'issueCount': '300',
                'issueStart': '',
                'issueEnd': '',
                'dayStart': '',
                'dayEnd': ''
            }
            
            response = self.session.get(url, params=params, timeout=15)
            if response.status_code == 200:
                result = response.json()
                if result.get('state') == 0 and result.get('result'):
                    data = []
                    for item in result['result']:
                        data.append({
                            'period': item.get('code', ''),
                            'date': item.get('date', ''),
                            'redBalls': item.get('red', ''),
                            'blueBall': item.get('blue', '')
                        })
                    return data
            
            return []
            
        except Exception as e:
            logger.error(f"从中国福彩网获取双色球数据失败: {e}")
            return []
    
    def _scrape_fc3d_from_sina_new(self):
        """从新浪获取福彩3D数据（新版本）"""
        try:
            urls = [
                "https://match.lottery.sina.com.cn/lotto/pc_zst/index?lottoType=fc3d&actionType=chzs",
                "https://sports.sina.com.cn/lottery/fc3d/history.shtml"
            ]
            
            for url in urls:
                try:
                    response = self.session.get(url, timeout=15)
                    if response.status_code == 200:
                        response.encoding = 'utf-8'
                        soup = BeautifulSoup(response.text, 'html.parser')
                        data = self._parse_fc3d_from_html(soup)
                        if data:
                            return data
                except Exception as e:
                    logger.debug(f"新浪 URL {url} 失败: {e}")
                    continue
            
            return []
            
        except Exception as e:
            logger.error(f"从新浪获取福彩3D数据失败: {e}")
            return []
    
    def _scrape_ssq_from_sina_new(self):
        """从新浪获取双色球数据（新版本）"""
        try:
            urls = [
                "https://match.lottery.sina.com.cn/lotto/pc_zst/index?lottoType=ssq&actionType=chzs",
                "https://sports.sina.com.cn/lottery/ssq/history.shtml"
            ]
            
            for url in urls:
                try:
                    response = self.session.get(url, timeout=15)
                    if response.status_code == 200:
                        response.encoding = 'utf-8'
                        soup = BeautifulSoup(response.text, 'html.parser')
                        data = self._parse_ssq_from_html(soup)
                        if data:
                            return data
                except Exception as e:
                    logger.debug(f"新浪 URL {url} 失败: {e}")
                    continue
            
            return []
            
        except Exception as e:
            logger.error(f"从新浪获取双色球数据失败: {e}")
            return []
    
    def _scrape_fc3d_from_163(self):
        """从网易获取福彩3D数据"""
        try:
            url = "https://caipiao.163.com/award/fc3d/"
            response = self.session.get(url, timeout=15)
            if response.status_code == 200:
                response.encoding = 'utf-8'
                soup = BeautifulSoup(response.text, 'html.parser')
                data = self._parse_fc3d_from_html(soup)
                if data:
                    return data
            return []
            
        except Exception as e:
            logger.error(f"从网易获取福彩3D数据失败: {e}")
            return []
    
    def _scrape_ssq_from_163(self):
        """从网易获取双色球数据"""
        try:
            url = "https://caipiao.163.com/award/ssq/"
            response = self.session.get(url, timeout=15)
            if response.status_code == 200:
                response.encoding = 'utf-8'
                soup = BeautifulSoup(response.text, 'html.parser')
                data = self._parse_ssq_from_html(soup)
                if data:
                    return data
            return []
            
        except Exception as e:
            logger.error(f"从网易获取双色球数据失败: {e}")
            return []
    
    def _parse_fc3d_from_html(self, soup):
        """从HTML中解析福彩3D数据"""
        data = []
        
        # 尝试多种表格选择器
        selectors = [
            'table#tdata',
            'table.tb_0',
            'table.history-table',
            'table[class*="table"]',
            'table'
        ]
        
        for selector in selectors:
            table = soup.select_one(selector)
            if table:
                rows = table.find_all('tr')[1:]  # 跳过表头
                for row in rows:
                    cells = row.find_all(['td', 'th'])
                    if len(cells) >= 4:
                        period = cells[0].get_text(strip=True)
                        date = cells[1].get_text(strip=True)
                        number = cells[2].get_text(strip=True)
                        
                        # 清理数据
                        number = re.sub(r'[^\d]', '', number)
                        
                        if period and date and number and len(number) == 3:
                            data.append({
                                'period': period,
                                'date': date,
                                'number': number
                            })
                
                if data:
                    break
        
        return data
    
    def _parse_ssq_from_html(self, soup):
        """从HTML中解析双色球数据"""
        data = []
        
        # 尝试多种表格选择器
        selectors = [
            'table#tdata',
            'table.tb_0',
            'table.history-table',
            'table[class*="table"]',
            'table'
        ]
        
        for selector in selectors:
            table = soup.select_one(selector)
            if table:
                rows = table.find_all('tr')[1:]  # 跳过表头
                for row in rows:
                    cells = row.find_all(['td', 'th'])
                    if len(cells) >= 4:
                        period = cells[0].get_text(strip=True)
                        date = cells[1].get_text(strip=True)
                        red_balls = cells[2].get_text(strip=True)
                        blue_ball = cells[3].get_text(strip=True)
                        
                        # 清理红球数据
                        red_balls = re.sub(r'[^\d,]', '', red_balls)
                        red_list = [x.strip() for x in red_balls.split(',') if x.strip()]
                        
                        # 清理蓝球数据
                        blue_ball = re.sub(r'[^\d]', '', blue_ball)
                        
                        if period and date and len(red_list) == 6 and blue_ball:
                            data.append({
                                'period': period,
                                'date': date,
                                'redBalls': red_list,
                                'blueBall': blue_ball
                            })
                
                if data:
                    break
        
        return data
    
    def _is_cache_valid(self, key):
        """检查缓存是否有效"""
        if key not in self.cache:
            return False
        
        cache_time = self.cache[key]['timestamp']
        return time.time() - cache_time < self.cache_timeout
    
    def _cache_data(self, key, data):
        """缓存数据"""
        self.cache[key] = {
            'data': data,
            'timestamp': time.time()
        }
    
    def _generate_realistic_fc3d_data(self, count=300):
        """生成真实的福彩3D测试数据"""
        data = []
        today = datetime.now()
        
        for i in range(count):
            # 生成期号（2024年格式）
            period = f"2024{str(1000 - i).zfill(3)}"
            
            # 生成日期（倒推）
            date = (today - timedelta(days=i)).strftime('%Y-%m-%d')
            
            # 生成号码（基于真实统计规律）
            number = self._generate_realistic_fc3d_number()
            
            data.append({
                'period': period,
                'date': date,
                'number': number
            })
        
        return data
    
    def _generate_realistic_fc3d_number(self):
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

# 创建爬虫实例
scraper = RealLotteryDataScraper()

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
        'message': '真实彩票数据服务器运行正常',
        'cache_size': len(scraper.cache)
    })

@app.route('/api/clear_cache', methods=['POST'])
def clear_cache():
    """清除缓存API"""
    scraper.cache.clear()
    return jsonify({
        'success': True,
        'message': '缓存已清除'
    })

if __name__ == '__main__':
    import os
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=int(os.environ.get('PORT', 5000)))
    args = parser.parse_args()
    port = args.port

    print("🚀 启动真实彩票数据服务器...")
    print("📊 支持从多个官方数据源获取真实开奖数据")
    print("🌐 API地址:")
    print(f"   - 福彩3D: http://localhost:{port}/api/fc3d")
    print(f"   - 双色球: http://localhost:{port}/api/ssq")
    print(f"   - 健康检查: http://localhost:{port}/api/health")
    print(f"   - 清除缓存: http://localhost:{port}/api/clear_cache")
    
    app.run(host='0.0.0.0', port=port, debug=True)
