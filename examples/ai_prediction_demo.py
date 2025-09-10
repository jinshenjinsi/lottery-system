#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
福彩3D AI预测模型演示
注意：此模型仅用于学习和研究，不保证预测准确性
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import warnings
warnings.filterwarnings('ignore')

class LotteryAIPredictor:
    def __init__(self):
        self.models = {}
        self.scalers = {}
        self.feature_names = [
            'period', 'day_of_week', 'month', 'hundreds', 'tens', 'ones',
            'sum_value', 'span_value', 'odd_count', 'even_count',
            'big_count', 'small_count', 'consecutive_count'
        ]
    
    def generate_training_data(self, num_periods=1000):
        """生成训练数据"""
        data = []
        
        for i in range(num_periods):
            # 生成随机号码
            number = np.random.randint(0, 1000)
            digits = [number // 100, (number // 10) % 10, number % 10]
            
            # 计算特征
            features = self.calculate_features(i, digits)
            data.append(features)
        
        return pd.DataFrame(data, columns=self.feature_names)
    
    def calculate_features(self, period, digits):
        """计算特征值"""
        hundreds, tens, ones = digits
        
        # 基础特征
        sum_value = sum(digits)
        span_value = max(digits) - min(digits)
        odd_count = sum(1 for d in digits if d % 2 == 1)
        even_count = 3 - odd_count
        big_count = sum(1 for d in digits if d >= 5)
        small_count = 3 - big_count
        
        # 连续数字特征
        consecutive_count = 0
        if abs(hundreds - tens) == 1 or abs(tens - ones) == 1:
            consecutive_count = 1
        
        # 时间特征
        day_of_week = period % 7
        month = (period // 30) % 12 + 1
        
        return [
            period, day_of_week, month, hundreds, tens, ones,
            sum_value, span_value, odd_count, even_count,
            big_count, small_count, consecutive_count
        ]
    
    def train_models(self, data):
        """训练多个模型"""
        # 为每个位置训练单独的模型
        positions = ['hundreds', 'tens', 'ones']
        
        for pos in positions:
            # 准备特征和目标
            X = data.drop(['hundreds', 'tens', 'ones'], axis=1)
            y = data[pos]
            
            # 标准化特征
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            
            # 训练随机森林模型
            model = RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                n_jobs=-1
            )
            model.fit(X_scaled, y)
            
            # 保存模型和标准化器
            self.models[pos] = model
            self.scalers[pos] = scaler
    
    def predict_next_number(self, last_period_data):
        """预测下一个号码"""
        predictions = {}
        
        for pos in ['hundreds', 'tens', 'ones']:
            # 准备特征
            X = last_period_data.drop(['hundreds', 'tens', 'ones'], axis=1)
            X_scaled = self.scalers[pos].transform(X)
            
            # 预测
            pred = self.models[pos].predict(X_scaled)[0]
            
            # 将预测结果限制在0-9范围内
            predictions[pos] = max(0, min(9, round(pred)))
        
        return predictions
    
    def get_feature_importance(self):
        """获取特征重要性"""
        importance_data = {}
        
        for pos, model in self.models.items():
            importance_data[pos] = dict(zip(
                [f for f in self.feature_names if f not in ['hundreds', 'tens', 'ones']],
                model.feature_importances_
            ))
        
        return importance_data

def main():
    """主函数演示"""
    print("🎲 福彩3D AI预测模型演示")
    print("=" * 50)
    
    # 创建预测器
    predictor = LotteryAIPredictor()
    
    # 生成训练数据
    print("📊 生成训练数据...")
    training_data = predictor.generate_training_data(1000)
    print(f"训练数据形状: {training_data.shape}")
    
    # 训练模型
    print("🤖 训练AI模型...")
    predictor.train_models(training_data)
    print("模型训练完成！")
    
    # 显示特征重要性
    print("\n📈 特征重要性分析:")
    importance = predictor.get_feature_importance()
    
    for pos, features in importance.items():
        print(f"\n{pos.upper()}位特征重要性:")
        sorted_features = sorted(features.items(), key=lambda x: x[1], reverse=True)
        for feature, score in sorted_features[:5]:
            print(f"  {feature}: {score:.4f}")
    
    # 进行预测
    print("\n🔮 进行预测...")
    last_data = training_data.iloc[-1:].copy()
    prediction = predictor.predict_next_number(last_data)
    
    predicted_number = f"{prediction['hundreds']}{prediction['tens']}{prediction['ones']}"
    print(f"AI预测号码: {predicted_number}")
    
    # 生成多个预测
    print("\n🎯 生成多个预测结果:")
    for i in range(5):
        # 模拟不同的历史数据
        random_data = training_data.sample(1).copy()
        pred = predictor.predict_next_number(random_data)
        number = f"{pred['hundreds']}{pred['tens']}{pred['ones']}"
        print(f"  预测 {i+1}: {number}")
    
    print("\n⚠️  重要提醒:")
    print("1. 此模型仅用于学习和研究目的")
    print("2. 彩票具有随机性，任何预测都无法保证准确性")
    print("3. 请理性购彩，量力而行")
    print("4. 本模型不构成投资建议")

if __name__ == "__main__":
    main()
