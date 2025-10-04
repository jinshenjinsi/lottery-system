#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
真实彩票数据服务器
从官方数据源获取真实的福彩3D和双色球开奖数据
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
        
        # 重试配置
        self.max_retries = 3
        self.retry_delay = 2  # 秒
        
        # 配置请求超时
        self.timeout = (5, 15)  # (连接超时, 读取超时)
    
    def get_fc3d_data(self, limit=300):
        """获取福彩3D历史数据"""
        try:
            # 从中国福彩网获取数据
            data = self._scrape_fc3d_from_cwl()
            if data and len(data) > 0:
                logger.info(f"成功从中国福彩网获取福彩3D数据，共{len(data)}期")
                return data[:limit]
            
            # 从中彩网获取数据
            data = self._scrape_fc3d_from_zhcw()
            if data and len(data) > 0:
                logger.info(f"成功从中彩网获取福彩3D数据，共{len(data)}期")
                return data[:limit]
            
            logger.error("无法获取福彩3D数据")
            return []
            
        except Exception as e:
            logger.error(f"获取福彩3D数据失败: {e}")
            return []
    
    def get_ssq_data(self, limit=300):
        """获取双色球历史数据"""
        try:
            # 从中国福彩网获取数据
            data = self._scrape_ssq_from_cwl()
            if data and len(data) > 0:
                logger.info(f"成功从中国福彩网获取双色球数据，共{len(data)}期")
                return data[:limit]
            
            # 从中彩网获取数据
            data = self._scrape_ssq_from_zhcw()
            if data and len(data) > 0:
                logger.info(f"成功从中彩网获取双色球数据，共{len(data)}期")
                return data[:limit]
            
            logger.error("无法获取双色球数据")
            return []
            
        except Exception as e:
            logger.error(f"双色球 API错误: {e}")
            return []
    
    def _scrape_fc3d_from_cwl(self):
        """从中国福彩网获取福彩3D数据"""
        try:
            url = "https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice"
            params = {
                'name': '3d',
                'issueCount': '300',
                'issueStart': '',
                'issueEnd': '',
                'dayStart': '',
                'dayEnd': ''
            }
            
            headers = {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Referer': 'https://www.cwl.gov.cn/',
                'Origin': 'https://www.cwl.gov.cn',
                'X-Requested-With': 'XMLHttpRequest'
            }
            
            for retry in range(self.max_retries):
                try:
                    response = self.session.get(url, params=params, headers=headers, timeout=self.timeout)
                    if response.status_code == 200:
                        data = self._parse_fc3d_from_cwl_api(response)
                        if data and len(data) > 0:
                            return data
                except requests.Timeout:
                    logger.warning(f"中国福彩网请求超时，第 {retry + 1} 次重试")
                    if retry < self.max_retries - 1:
                        time.sleep(self.retry_delay)
                except Exception as e:
                    logger.error(f"请求中国福彩网失败: {e}")
                    if retry < self.max_retries - 1:
                        time.sleep(self.retry_delay)
            
            return []
            
        except Exception as e:
            logger.error(f"从中国福彩网获取福彩3D数据失败: {e}")
            return []
    
    def _scrape_fc3d_from_zhcw(self):
        """从中彩网获取福彩3D数据"""
        try:
            urls = [
                "https://www.zhcw.com/kjxx/3d/",
                "https://www.zhcw.com/kj/3d/"
            ]
            
            for url in urls:
                try:
                    response = self.session.get(url, timeout=self.timeout)
                    if response.status_code == 200:
                        data = self._parse_fc3d_from_zhcw_html(response)
                        if data and len(data) > 0:
                            return data
                except Exception as e:
                    logger.warning(f"中彩网URL {url} 失败: {e}")
            
            return []
            
        except Exception as e:
            logger.error(f"从中彩网获取福彩3D数据失败: {e}")
            return []
    
    def _scrape_ssq_from_cwl(self):
        """从中国福彩网获取双色球数据"""
        try:
            url = "https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice"
            params = {
                'name': 'ssq',
                'issueCount': '300',
                'issueStart': '',
                'issueEnd': '',
                'dayStart': '',
                'dayEnd': ''
            }
            
            headers = {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Referer': 'https://www.cwl.gov.cn/',
                'Origin': 'https://www.cwl.gov.cn',
                'X-Requested-With': 'XMLHttpRequest'
            }
            
            for retry in range(self.max_retries):
                try:
                    response = self.session.get(url, params=params, headers=headers, timeout=self.timeout)
                    if response.status_code == 200:
                        data = self._parse_ssq_from_cwl_api(response)
                        if data and len(data) > 0:
                            return data
                except requests.Timeout:
                    logger.warning(f"中国福彩网请求超时，第 {retry + 1} 次重试")
                    if retry < self.max_retries - 1:
                        time.sleep(self.retry_delay)
                except Exception as e:
                    logger.error(f"请求中国福彩网失败: {e}")
                    if retry < self.max_retries - 1:
                        time.sleep(self.retry_delay)
            
            return []
            
        except Exception as e:
            logger.error(f"从中国福彩网获取双色球数据失败: {e}")
            return []
    
    def _scrape_ssq_from_zhcw(self):
        """从中彩网获取双色球数据"""
        try:
            urls = [
                "https://www.zhcw.com/kjxx/ssq/",
                "https://www.zhcw.com/kj/ssq/"
            ]
            
            for url in urls:
                try:
                    response = self.session.get(url, timeout=self.timeout)
                    if response.status_code == 200:
                        data = self._parse_ssq_from_zhcw_html(response)
                        if data and len(data) > 0:
                            return data
                except Exception as e:
                    logger.warning(f"中彩网URL {url} 失败: {e}")
            
            return []
            
        except Exception as e:
            logger.error(f"从中彩网获取双色球数据失败: {e}")
            return []
    
    def _parse_fc3d_from_cwl_api(self, response):
        """从中国福彩网API解析福彩3D数据"""
        try:
            result = response.json()
            if result.get('state') == 0 and result.get('result'):
                data = []
                for item in result['result']:
                    try:
                        # 解析开奖号码
                        number = item.get('red', '').replace(' ', '')
                        if not number or len(number) != 3:
                            continue
                            
                        # 解析日期和期号
                        date = item.get('date', '').split(' ')[0]
                        period = item.get('code', '')
                        if not date or not period:
                            continue
                            
                        # 计算统计数据
                        digits = [int(d) for d in number]
                        data.append({
                            'period': period,
                            'date': date,
                            'number': number,
                            'sum': sum(digits),
                            'span': max(digits) - min(digits),
                            'oddCount': len([d for d in digits if d % 2 == 1]),
                            'evenCount': len([d for d in digits if d % 2 == 0]),
                            'bigCount': len([d for d in digits if d >= 5]),
                            'smallCount': len([d for d in digits if d < 5])
                        })
                    except Exception as e:
                        logger.debug(f"解析单条福彩3D数据失败: {e}")
                        continue
                        
                return data
            return []
        except Exception as e:
            logger.error(f"解析福彩3D数据失败: {e}")
            return []
    
    def _parse_fc3d_from_zhcw_html(self, response):
        """从中彩网HTML解析福彩3D数据"""
        try:
            data = []
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 尝试多种表格选择器
            selectors = [
                'table.history-table',
                'table.kj-table',
                'table.lott-table',
                'table[class*="table"]',
                'table'
            ]
            
            for selector in selectors:
                table = soup.select_one(selector)
                if table:
                    rows = table.find_all('tr')[1:]  # 跳过表头
                    for row in rows:
                        try:
                            cells = row.find_all(['td', 'th'])
                            if len(cells) < 3:
                                continue
                            
                            # 提取期号
                            period_text = cells[0].get_text(strip=True)
                            period_match = re.search(r'\d{7}', period_text)
                            if not period_match:
                                continue
                            period = period_match.group()
                            
                            # 提取日期
                            date_text = cells[1].get_text(strip=True)
                            date_match = re.search(r'\d{4}-\d{2}-\d{2}', date_text)
                            if not date_match:
                                continue
                            date = date_match.group()
                            
                            # 提取号码
                            number_text = cells[2].get_text(strip=True)
                            number_match = re.search(r'\d{3}', number_text)
                            if not number_match:
                                continue
                            number = number_match.group()
                            
                            # 计算统计数据
                            digits = [int(d) for d in number]
                            data.append({
                                'period': period,
                                'date': date,
                                'number': number,
                                'sum': sum(digits),
                                'span': max(digits) - min(digits),
                                'oddCount': len([d for d in digits if d % 2 == 1]),
                                'evenCount': len([d for d in digits if d % 2 == 0]),
                                'bigCount': len([d for d in digits if d >= 5]),
                                'smallCount': len([d for d in digits if d < 5])
                            })
                        except Exception as e:
                            logger.debug(f"解析单条福彩3D数据失败: {e}")
                            continue
                    
                    if data:
                        break
            
            return data
        except Exception as e:
            logger.error(f"解析福彩3D HTML数据失败: {e}")
            return []
    
    def _parse_ssq_from_cwl_api(self, response):
        """从中国福彩网API解析双色球数据"""
        try:
            result = response.json()
            if result.get('state') == 0 and result.get('result'):
                data = []
                for item in result['result']:
                    try:
                        # 解析红球
                        red = item.get('red', '').replace(' ', '')
                        if not red:
                            continue
                        redBalls = [int(x) for x in red.split(',')]
                        if len(redBalls) != 6:
                            continue
                            
                        # 解析蓝球
                        blueBall = int(item.get('blue', '0'))
                        if not blueBall:
                            continue
                            
                        # 解析日期和期号
                        date = item.get('date', '').split(' ')[0]
                        period = item.get('code', '')
                        if not date or not period:
                            continue
                            
                        data.append({
                            'period': period,
                            'date': date,
                            'redBalls': redBalls,
                            'blueBall': blueBall,
                            'redSum': sum(redBalls),
                            'redOddCount': len([n for n in redBalls if n % 2 == 1]),
                            'redEvenCount': len([n for n in redBalls if n % 2 == 0]),
                            'redBigCount': len([n for n in redBalls if n > 16]),
                            'redSmallCount': len([n for n in redBalls if n <= 16])
                        })
                    except Exception as e:
                        logger.debug(f"解析单条双色球数据失败: {e}")
                        continue
                        
                return data
            return []
        except Exception as e:
            logger.error(f"解析双色球数据失败: {e}")
            return []
    
    def _parse_ssq_from_zhcw_html(self, response):
        """从中彩网HTML解析双色球数据"""
        try:
            data = []
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 尝试多种表格选择器
            selectors = [
                'table.history-table',
                'table.kj-table',
                'table.lott-table',
                'table[class*="table"]',
                'table'
            ]
            
            for selector in selectors:
                table = soup.select_one(selector)
                if table:
                    rows = table.find_all('tr')[1:]  # 跳过表头
                    for row in rows:
                        try:
                            cells = row.find_all(['td', 'th'])
                            if len(cells) < 4:
                                continue
                            
                            # 提取期号
                            period_text = cells[0].get_text(strip=True)
                            period_match = re.search(r'\d{7}', period_text)
                            if not period_match:
                                continue
                            period = period_match.group()
                            
                            # 提取日期
                            date_text = cells[1].get_text(strip=True)
                            date_match = re.search(r'\d{4}-\d{2}-\d{2}', date_text)
                            if not date_match:
                                continue
                            date = date_match.group()
                            
                            # 提取红球
                            red_text = cells[2].get_text(strip=True)
                            red_numbers = re.findall(r'\d{2}', red_text)
                            if len(red_numbers) != 6:
                                continue
                            redBalls = [int(x) for x in red_numbers]
                            
                            # 提取蓝球
                            blue_text = cells[3].get_text(strip=True)
                            blue_match = re.search(r'\d{2}', blue_text)
                            if not blue_match:
                                continue
                            blueBall = int(blue_match.group())
                            
                            data.append({
                                'period': period,
                                'date': date,
                                'redBalls': redBalls,
                                'blueBall': blueBall,
                                'redSum': sum(redBalls),
                                'redOddCount': len([n for n in redBalls if n % 2 == 1]),
                                'redEvenCount': len([n for n in redBalls if n % 2 == 0]),
                                'redBigCount': len([n for n in redBalls if n > 16]),
                                'redSmallCount': len([n for n in redBalls if n <= 16])
                            })
                        except Exception as e:
                            logger.debug(f"解析单条双色球数据失败: {e}")
                            continue
                    
                    if data:
                        break
            
            return data
        except Exception as e:
            logger.error(f"解析双色球HTML数据失败: {e}")
            return []

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
        'message': '真实彩票数据服务器运行正常'
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