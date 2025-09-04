#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试爬虫功能
"""

import requests
from bs4 import BeautifulSoup
import json

def test_500_ssq():
    """测试500.com双色球数据"""
    try:
        url = "https://datachart.500.com/ssq/history/newinc/history.php"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=15)
        print(f"状态码: {response.status_code}")
        print(f"编码: {response.encoding}")
        
        # 尝试不同编码
        for encoding in ['gb2312', 'gbk', 'utf-8']:
            try:
                response.encoding = encoding
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # 查找表格
                table = soup.find('table', {'id': 'tablelist'})
                if table:
                    print(f"找到表格，编码: {encoding}")
                    rows = table.find_all('tr')[2:]  # 跳过表头
                    print(f"数据行数: {len(rows)}")
                    
                    # 解析前几行数据
                    for i, row in enumerate(rows[:5]):
                        cells = row.find_all('td')
                        if len(cells) >= 8:
                            period = cells[0].get_text(strip=True)
                            red_balls = []
                            for j in range(1, 7):
                                red_balls.append(cells[j].get_text(strip=True))
                            blue_ball = cells[7].get_text(strip=True)
                            
                            print(f"第{i+1}行: 期号={period}, 红球={red_balls}, 蓝球={blue_ball}")
                    
                    return True
                    
            except Exception as e:
                print(f"编码 {encoding} 失败: {e}")
                continue
        
        return False
        
    except Exception as e:
        print(f"请求失败: {e}")
        return False

def test_cwl_api():
    """测试中国福彩网API"""
    try:
        url = "http://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice"
        params = {
            'name': 'ssq',
            'issueCount': '10',
            'issueStart': '',
            'issueEnd': '',
            'dayStart': '',
            'dayEnd': ''
        }
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'http://www.cwl.gov.cn/'
        }
        
        response = requests.get(url, params=params, headers=headers, timeout=15)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"API响应: {json.dumps(result, ensure_ascii=False, indent=2)[:500]}...")
            
            if result.get('state') == 0 and result.get('result'):
                print(f"获取到 {len(result['result'])} 期数据")
                for item in result['result'][:3]:
                    print(f"期号: {item.get('code')}, 日期: {item.get('date')}, 红球: {item.get('red')}, 蓝球: {item.get('blue')}")
                return True
        
        return False
        
    except Exception as e:
        print(f"API请求失败: {e}")
        return False

if __name__ == '__main__':
    print("🔍 测试数据源...")
    print("\n1. 测试500.com双色球数据:")
    test_500_ssq()
    
    print("\n2. 测试中国福彩网API:")
    test_cwl_api()
