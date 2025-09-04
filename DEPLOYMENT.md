# 部署指南

## GitHub仓库创建步骤

### 1. 创建GitHub仓库
1. 访问 [GitHub.com](https://github.com)
2. 点击右上角的 "+" 号，选择 "New repository"
3. 仓库名称建议：`lottery-prediction-system` 或 `彩票预选系统`
4. 描述：`彩票预选系统 - 福彩3D和双色球预测，支持LSTM算法和移动端优化`
5. 选择 "Public"（公开仓库）
6. **不要**勾选 "Add a README file"（我们已经有了）
7. 点击 "Create repository"

### 2. 推送代码到GitHub
在终端中执行以下命令：

```bash
# 添加远程仓库（替换YOUR_USERNAME为您的GitHub用户名）
git remote add origin https://github.com/YOUR_USERNAME/lottery-prediction-system.git

# 推送代码到GitHub
git branch -M main
git push -u origin main
```

### 3. Render部署配置

#### 3.1 创建Render账户
1. 访问 [Render.com](https://render.com)
2. 点击右上角的 "Sign Up" 按钮
3. 选择 "Sign up with GitHub" 使用GitHub账户登录
4. 授权Render访问您的GitHub仓库

#### 3.2 创建Static Site（推荐方式）
1. 在Render控制台点击 "New +"
2. 选择 "Static Site"
3. 连接您的GitHub仓库：
   - 点击 "Connect GitHub"
   - 选择您刚创建的仓库
   - 点击 "Connect"
4. 配置设置：
   - **Name**: `lottery-prediction-system`
   - **Branch**: `main`（或您的主分支）
   - **Root Directory**: 留空
   - **Build Command**: 留空
   - **Publish Directory**: `.`（表示根目录）

#### 3.3 高级配置（可选）
如果需要自定义配置：
- **Auto-Deploy**: 保持开启（代码推送时自动部署）
- **Pull Request Previews**: 可开启（预览PR效果）
- **Environment Variables**: 通常不需要

#### 3.4 部署过程
1. 点击 "Create Static Site"
2. Render会自动：
   - 从GitHub拉取代码
   - 检测到这是一个静态网站
   - 开始部署过程
3. 等待部署完成（通常需要1-3分钟）
4. 部署成功后，您会看到：
   - 绿色状态指示器
   - 网站URL，例如：`https://lottery-prediction-system.onrender.com`

#### 3.5 验证部署
1. 点击提供的URL访问您的网站
2. 检查所有功能是否正常工作：
   - 福彩3D选号功能
   - 双色球预测功能
   - 数据分析功能
   - 移动端适配

#### 3.6 自定义域名（可选）
如果您有自己的域名：
1. 在Render控制台点击您的项目
2. 进入 "Settings" 标签
3. 在 "Custom Domains" 部分添加您的域名
4. 按照提示配置DNS记录

## 本地开发

### 运行项目
```bash
# 直接在浏览器中打开
open index.html

# 或使用Python简单服务器
python3 -m http.server 8000
# 然后访问 http://localhost:8000
```

### 项目结构
```
彩票预选系统/
├── index.html          # 主页面
├── styles.css          # 样式文件（移动端优化）
├── script.js           # JavaScript功能
├── README.md           # 项目说明
├── requirements.txt    # Python依赖（AI模型演示）
├── ai_prediction_demo.py      # 随机森林AI模型演示
├── lstm_prediction_demo.py    # LSTM模型演示
└── DEPLOYMENT.md       # 部署指南
```

## 功能特性

### 福彩3D预选系统
- 🎲 随机选号
- 🍀 幸运号码
- 📊 智能分析
- 🔥 热号冷号统计
- 📈 走势分析
- 🔍 号码规律分析

### 双色球预测系统
- 🧠 LSTM蓝球预测
- 🎯 智能红球组合
- 📊 数据分析
- 💾 选号记录保存

### 移动端优化
- 📱 响应式设计
- 🎨 现代化UI
- ⚡ 流畅动画
- 👆 触摸优化

## 注意事项

1. **彩票随机性**: 本系统仅供学习和娱乐，不保证中奖
2. **理性购彩**: 请根据个人经济能力合理投注
3. **数据模拟**: 系统使用模拟历史数据，实际应用中应接入真实数据
4. **AI局限性**: LSTM模型无法突破彩票的随机性本质

## 技术支持

如有问题，请检查：
1. GitHub仓库是否正确创建
2. Render部署配置是否正确
3. 浏览器控制台是否有错误信息
4. 网络连接是否正常
