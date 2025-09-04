#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试福彩3D数据源
"""

import requests
from bs4 import BeautifulSoup
import json

def test_cwl_fc3d():
    """测试中国福彩网福彩3D API"""
    try:
        url = "http://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice"
        params = {
            'name': 'fc3d',
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
                    print(f"期号: {item.get('code')}, 日期: {item.get('date')}, 号码: {item.get('red')}")
                return True
        
        return False
        
    except Exception as e:
        print(f"API请求失败: {e}")
        return False

def test_500_fc3d():
    """测试500.com福彩3D数据"""
    try:
        url = "https://datachart.500.com/fc3d/history/newinc/history.php"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=15)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            response.encoding = 'gb2312'
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 查找表格
            table = soup.find('table', {'id': 'tdata'})
            if not table:
                table = soup.find('table', {'id': 'tablelist'})
            
            if table:
                print("找到表格")
                rows = table.find_all('tr')[1:]  # 跳过表头
                print(f"数据行数: {len(rows)}")
                
                # 解析前几行数据
                for i, row in enumerate(rows[:5]):
                    cells = row.find_all('td')
                    if len(cells) >= 4:
                        period = cells[0].get_text(strip=True)
                        date = cells[1].get_text(strip=True)
                        number = cells[2].get_text(strip=True)
                        
                        print(f"第{i+1}行: 期号={period}, 日期={date}, 号码={number}")
                
                return True
            else:
                print("未找到表格")
                # 打印页面内容的一部分
                print("页面内容片段:")
                print(response.text[:1000])
        
        return False
        
    except Exception as e:
        print(f"请求失败: {e}")
        return False

if __name__ == '__main__':
    print("🔍 测试福彩3D数据源...")
    
    print("\n1. 测试中国福彩网福彩3D API:")
    test_cwl_fc3d()
    
    print("\n2. 测试500.com福彩3D数据:")
    test_500_fc3d()
