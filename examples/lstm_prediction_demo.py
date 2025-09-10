#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
福彩3D LSTM深度学习预测模型
注意：此模型仅用于学习和研究，不保证预测准确性
"""

import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.optimizers import Adam
from sklearn.preprocessing import MinMaxScaler
import warnings
warnings.filterwarnings('ignore')

class LotteryLSTMPredictor:
    def __init__(self, sequence_length=10):
        self.sequence_length = sequence_length
        self.model = None
        self.scaler = MinMaxScaler()
        self.feature_scalers = {}
        
    def generate_sequence_data(self, num_periods=1000):
        """生成序列数据"""
        data = []
        
        for i in range(num_periods):
            # 生成随机号码
            number = np.random.randint(0, 1000)
            digits = [number // 100, (number // 10) % 10, number % 10]
            
            # 计算额外特征
            sum_value = sum(digits)
            span_value = max(digits) - min(digits)
            odd_count = sum(1 for d in digits if d % 2 == 1)
            big_count = sum(1 for d in digits if d >= 5)
            
            # 时间特征
            day_of_week = i % 7
            month = (i // 30) % 12 + 1
            
            data.append([
                digits[0], digits[1], digits[2],  # 百位、十位、个位
                sum_value, span_value, odd_count, big_count,
                day_of_week, month
            ])
        
        return np.array(data)
    
    def create_sequences(self, data):
        """创建时间序列数据"""
        X, y = [], []
        
        for i in range(self.sequence_length, len(data)):
            # 输入序列：前sequence_length个时间步
            X.append(data[i-self.sequence_length:i])
            # 输出：当前时间步的号码
            y.append(data[i][:3])  # 只预测百位、十位、个位
        
        return np.array(X), np.array(y)
    
    def build_model(self, input_shape):
        """构建LSTM模型"""
        model = Sequential([
            LSTM(64, return_sequences=True, input_shape=input_shape),
            Dropout(0.2),
            LSTM(32, return_sequences=False),
            Dropout(0.2),
            Dense(16, activation='relu'),
            Dense(3, activation='sigmoid')  # 输出3个数字，使用sigmoid激活
        ])
        
        model.compile(
            optimizer=Adam(learning_rate=0.001),
            loss='mse',
            metrics=['mae']
        )
        
        return model
    
    def train_model(self, data, epochs=100, batch_size=32):
        """训练模型"""
        # 创建序列数据
        X, y = self.create_sequences(data)
        
        # 标准化数据
        X_scaled = self.scaler.fit_transform(X.reshape(-1, X.shape[-1])).reshape(X.shape)
        y_scaled = y / 9.0  # 将0-9的数字标准化到0-1
        
        # 分割训练和验证数据
        split_idx = int(0.8 * len(X_scaled))
        X_train, X_val = X_scaled[:split_idx], X_scaled[split_idx:]
        y_train, y_val = y_scaled[:split_idx], y_scaled[split_idx:]
        
        # 构建模型
        self.model = self.build_model((X_train.shape[1], X_train.shape[2]))
        
        # 训练模型
        history = self.model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=epochs,
            batch_size=batch_size,
            verbose=1
        )
        
        return history
    
    def predict_next(self, last_sequence):
        """预测下一个号码"""
        if self.model is None:
            raise ValueError("模型尚未训练")
        
        # 标准化输入
        last_sequence_scaled = self.scaler.transform(last_sequence.reshape(-1, last_sequence.shape[-1])).reshape(1, last_sequence.shape[0], last_sequence.shape[1])
        
        # 预测
        prediction = self.model.predict(last_sequence_scaled, verbose=0)
        
        # 反标准化并转换为整数
        predicted_digits = np.round(prediction[0] * 9).astype(int)
        predicted_digits = np.clip(predicted_digits, 0, 9)
        
        return predicted_digits
    
    def evaluate_model(self, test_data):
        """评估模型性能"""
        X_test, y_test = self.create_sequences(test_data)
        X_test_scaled = self.scaler.transform(X_test.reshape(-1, X_test.shape[-1])).reshape(X_test.shape)
        y_test_scaled = y_test / 9.0
        
        # 预测
        predictions = self.model.predict(X_test_scaled, verbose=0)
        predictions = np.round(predictions * 9).astype(int)
        predictions = np.clip(predictions, 0, 9)
        
        # 计算准确率
        exact_matches = np.sum(np.all(predictions == y_test, axis=1))
        total_predictions = len(predictions)
        accuracy = exact_matches / total_predictions
        
        return accuracy, predictions, y_test

def main():
    """主函数演示"""
    print("🧠 福彩3D LSTM深度学习预测模型")
    print("=" * 50)
    
    # 创建LSTM预测器
    lstm_predictor = LotteryLSTMPredictor(sequence_length=10)
    
    # 生成数据
    print("📊 生成训练数据...")
    data = lstm_predictor.generate_sequence_data(1000)
    print(f"数据形状: {data.shape}")
    
    # 训练模型
    print("🤖 训练LSTM模型...")
    history = lstm_predictor.train_model(data, epochs=50, batch_size=32)
    print("模型训练完成！")
    
    # 进行预测
    print("\n🔮 进行预测...")
    last_sequence = data[-10:]  # 使用最后10个时间步
    prediction = lstm_predictor.predict_next(last_sequence)
    predicted_number = f"{prediction[0]}{prediction[1]}{prediction[2]}"
    print(f"LSTM预测号码: {predicted_number}")
    
    # 评估模型
    print("\n📈 模型评估...")
    test_data = lstm_predictor.generate_sequence_data(200)
    accuracy, predictions, actual = lstm_predictor.evaluate_model(test_data)
    print(f"模型准确率: {accuracy:.4f} ({accuracy*100:.2f}%)")
    
    # 显示一些预测结果
    print("\n🎯 预测结果对比:")
    for i in range(5):
        pred_num = f"{predictions[i][0]}{predictions[i][1]}{predictions[i][2]}"
        actual_num = f"{actual[i][0]}{actual[i][1]}{actual[i][2]}"
        match = "✅" if predictions[i][0] == actual[i][0] and predictions[i][1] == actual[i][1] and predictions[i][2] == actual[i][2] else "❌"
        print(f"  预测: {pred_num} | 实际: {actual_num} {match}")
    
    # 生成多个预测
    print("\n🎲 生成多个LSTM预测:")
    for i in range(5):
        # 使用不同的历史序列
        start_idx = np.random.randint(0, len(data) - 10)
        sequence = data[start_idx:start_idx + 10]
        pred = lstm_predictor.predict_next(sequence)
        number = f"{pred[0]}{pred[1]}{pred[2]}"
        print(f"  预测 {i+1}: {number}")
    
    print("\n⚠️  重要提醒:")
    print("1. LSTM模型仅用于学习和研究目的")
    print("2. 彩票具有随机性，深度学习也无法准确预测")
    print("3. 模型准确率通常很低，因为彩票本质上是随机的")
    print("4. 请理性购彩，不要依赖任何预测模型")

if __name__ == "__main__":
    main()
