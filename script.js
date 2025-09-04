// 福彩3D预选系统 JavaScript
class LotterySystem {
    constructor() {
        this.historyData = this.generateMockHistoryData();
        this.ssqHistoryData = this.generateSSQHistoryData();
        this.myPicks = JSON.parse(localStorage.getItem('myPicks')) || [];
        this.ssqPicks = JSON.parse(localStorage.getItem('ssqPicks')) || [];
        this.lstmModel = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.populateSelectOptions();
        this.updateAnalysis();
        this.displayMyPicks();
        this.generateRecommendations();
        this.initSSQSystem();
    }

    // 生成模拟历史数据
    generateMockHistoryData() {
        const data = [];
        const today = new Date();
        
        for (let i = 0; i < 100; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            data.push({
                period: `2024${String(1000 - i).padStart(3, '0')}`,
                date: date.toISOString().split('T')[0],
                number: String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
                sum: 0,
                span: 0
            });
        }
        
        // 计算和值和跨度
        data.forEach(item => {
            const digits = item.number.split('').map(Number);
            item.sum = digits.reduce((a, b) => a + b, 0);
            item.span = Math.max(...digits) - Math.min(...digits);
        });
        
        return data;
    }

    // 生成双色球历史数据
    generateSSQHistoryData() {
        const data = [];
        const today = new Date();
        
        for (let i = 0; i < 100; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            // 生成红球（1-33，6个不重复）
            const redBalls = [];
            while (redBalls.length < 6) {
                const num = Math.floor(Math.random() * 33) + 1;
                if (!redBalls.includes(num)) {
                    redBalls.push(num);
                }
            }
            redBalls.sort((a, b) => a - b);
            
            // 生成蓝球（1-16）
            const blueBall = Math.floor(Math.random() * 16) + 1;
            
            data.push({
                period: `2024${String(1000 - i).padStart(3, '0')}`,
                date: date.toISOString().split('T')[0],
                redBalls: redBalls,
                blueBall: blueBall,
                redSum: redBalls.reduce((a, b) => a + b, 0),
                redOddCount: redBalls.filter(n => n % 2 === 1).length,
                redBigCount: redBalls.filter(n => n > 16).length
            });
        }
        
        return data;
    }

    // 设置事件监听器
    setupEventListeners() {
        // 快速选号按钮
        document.getElementById('randomBtn').addEventListener('click', () => {
            this.generateRandomNumber();
        });

        document.getElementById('luckyBtn').addEventListener('click', () => {
            this.generateLuckyNumber();
        });

        document.getElementById('analyzeBtn').addEventListener('click', () => {
            this.generateAnalyzedNumber();
        });

        // 手动选号
        document.getElementById('confirmBtn').addEventListener('click', () => {
            this.confirmManualPick();
        });

        // 分析标签页
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // 刷新推荐
        document.getElementById('refreshRecommendations').addEventListener('click', () => {
            this.generateRecommendations();
        });

        // 清空记录
        document.getElementById('clearPicks').addEventListener('click', () => {
            this.clearMyPicks();
        });

        // 双色球事件监听器
        this.setupSSQEventListeners();
    }

    // 设置双色球事件监听器
    setupSSQEventListeners() {
        // 蓝球预测
        document.getElementById('predictBlueBtn').addEventListener('click', () => {
            this.predictBlueBall();
        });

        document.getElementById('randomBlueBtn').addEventListener('click', () => {
            this.generateRandomBlueBall();
        });

        // 红球生成
        document.getElementById('generateRedBtn').addEventListener('click', () => {
            this.generateRedBalls();
        });

        document.getElementById('smartRedBtn').addEventListener('click', () => {
            this.generateSmartRedBalls();
        });

        // 完整双色球
        document.getElementById('generateCompleteBtn').addEventListener('click', () => {
            this.generateCompleteSSQ();
        });

        document.getElementById('saveCompleteBtn').addEventListener('click', () => {
            this.saveCompleteSSQ();
        });
    }

    // 填充选择器选项
    populateSelectOptions() {
        const selects = ['hundredsSelect', 'tensSelect', 'onesSelect'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            for (let i = 0; i <= 9; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = i;
                select.appendChild(option);
            }
        });
    }

    // 生成随机号码
    generateRandomNumber() {
        const number = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
        this.displayNumber(number);
        this.addToMyPicks(number, '随机选号');
    }

    // 生成幸运号码
    generateLuckyNumber() {
        // 基于一些"幸运"算法
        const luckyFactors = [7, 13, 21, 28, 35, 42, 49, 56, 63, 70];
        const factor = luckyFactors[Math.floor(Math.random() * luckyFactors.length)];
        const number = String(factor * Math.floor(Math.random() * 15)).padStart(3, '0');
        this.displayNumber(number);
        this.addToMyPicks(number, '幸运号码');
    }

    // 生成分析号码
    generateAnalyzedNumber() {
        // 基于历史数据分析
        const hotNumbers = this.getHotNumbers();
        const coldNumbers = this.getColdNumbers();
        
        // 结合热号和冷号生成
        let number = '';
        for (let i = 0; i < 3; i++) {
            if (Math.random() < 0.6) {
                // 60%概率选择热号
                number += hotNumbers[i][Math.floor(Math.random() * hotNumbers[i].length)];
            } else {
                // 40%概率选择冷号
                number += coldNumbers[i][Math.floor(Math.random() * coldNumbers[i].length)];
            }
        }
        
        this.displayNumber(number);
        this.addToMyPicks(number, '智能分析');
    }

    // 显示号码
    displayNumber(number) {
        const digits = number.split('');
        document.getElementById('hundreds').textContent = digits[0];
        document.getElementById('tens').textContent = digits[1];
        document.getElementById('ones').textContent = digits[2];
        
        // 添加动画效果
        document.querySelectorAll('.number-box').forEach((box, index) => {
            box.style.animation = 'none';
            setTimeout(() => {
                box.style.animation = 'fadeIn 0.5s ease-in-out';
            }, index * 100);
        });
    }

    // 确认手动选号
    confirmManualPick() {
        const hundreds = document.getElementById('hundredsSelect').value;
        const tens = document.getElementById('tensSelect').value;
        const ones = document.getElementById('onesSelect').value;
        
        if (hundreds === '' || tens === '' || ones === '') {
            alert('请选择完整的号码！');
            return;
        }
        
        const number = hundreds + tens + ones;
        this.displayNumber(number);
        this.addToMyPicks(number, '手动选号');
        
        // 重置选择器
        document.getElementById('hundredsSelect').value = '';
        document.getElementById('tensSelect').value = '';
        document.getElementById('onesSelect').value = '';
    }

    // 添加到我的选号记录
    addToMyPicks(number, method) {
        const pick = {
            number: number,
            method: method,
            time: new Date().toLocaleString('zh-CN')
        };
        
        this.myPicks.unshift(pick);
        if (this.myPicks.length > 50) {
            this.myPicks = this.myPicks.slice(0, 50);
        }
        
        localStorage.setItem('myPicks', JSON.stringify(this.myPicks));
        this.displayMyPicks();
    }

    // 显示我的选号记录
    displayMyPicks() {
        const picksList = document.getElementById('picksList');
        
        if (this.myPicks.length === 0) {
            picksList.innerHTML = '<p class="empty-message">暂无选号记录</p>';
            return;
        }
        
        picksList.innerHTML = this.myPicks.map(pick => `
            <div class="pick-item">
                <div>
                    <div class="pick-number">${pick.number}</div>
                    <div class="pick-method">${pick.method}</div>
                </div>
                <div class="pick-time">${pick.time}</div>
            </div>
        `).join('');
    }

    // 清空选号记录
    clearMyPicks() {
        if (confirm('确定要清空所有选号记录吗？')) {
            this.myPicks = [];
            localStorage.removeItem('myPicks');
            this.displayMyPicks();
        }
    }

    // 切换分析标签页
    switchTab(tabName) {
        // 移除所有活动状态
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // 激活选中的标签页
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(tabName).classList.add('active');
        
        // 如果是走势分析标签页，绘制图表
        if (tabName === 'trend') {
            this.drawTrendChart();
        }
    }

    // 更新分析数据
    updateAnalysis() {
        this.updateHotColdNumbers();
        this.updatePatternAnalysis();
    }

    // 更新热号冷号
    updateHotColdNumbers() {
        const hotNumbers = this.getHotNumbers();
        const coldNumbers = this.getColdNumbers();
        
        // 显示热号
        const hotContainer = document.getElementById('hotNumbers');
        hotContainer.innerHTML = '';
        
        for (let pos = 0; pos < 3; pos++) {
            const positionNames = ['百位', '十位', '个位'];
            const positionDiv = document.createElement('div');
            positionDiv.innerHTML = `<h4>${positionNames[pos]}</h4>`;
            
            const numbersDiv = document.createElement('div');
            numbersDiv.className = 'number-grid';
            
            hotNumbers[pos].forEach(num => {
                const numDiv = document.createElement('div');
                numDiv.className = 'number-item hot';
                numDiv.textContent = num;
                numbersDiv.appendChild(numDiv);
            });
            
            positionDiv.appendChild(numbersDiv);
            hotContainer.appendChild(positionDiv);
        }
        
        // 显示冷号
        const coldContainer = document.getElementById('coldNumbers');
        coldContainer.innerHTML = '';
        
        for (let pos = 0; pos < 3; pos++) {
            const positionNames = ['百位', '十位', '个位'];
            const positionDiv = document.createElement('div');
            positionDiv.innerHTML = `<h4>${positionNames[pos]}</h4>`;
            
            const numbersDiv = document.createElement('div');
            numbersDiv.className = 'number-grid';
            
            coldNumbers[pos].forEach(num => {
                const numDiv = document.createElement('div');
                numDiv.className = 'number-item cold';
                numDiv.textContent = num;
                numbersDiv.appendChild(numDiv);
            });
            
            positionDiv.appendChild(numbersDiv);
            coldContainer.appendChild(positionDiv);
        }
    }

    // 获取热号
    getHotNumbers() {
        const recentData = this.historyData.slice(0, 30);
        const positions = [[], [], []];
        
        // 统计每个位置数字出现次数
        recentData.forEach(item => {
            const digits = item.number.split('').map(Number);
            digits.forEach((digit, index) => {
                if (!positions[index][digit]) {
                    positions[index][digit] = 0;
                }
                positions[index][digit]++;
            });
        });
        
        // 获取每个位置出现次数最多的数字
        return positions.map(pos => {
            return Object.entries(pos)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([num]) => parseInt(num));
        });
    }

    // 获取冷号
    getColdNumbers() {
        const recentData = this.historyData.slice(0, 30);
        const positions = [[], [], []];
        
        // 统计每个位置数字出现次数
        recentData.forEach(item => {
            const digits = item.number.split('').map(Number);
            digits.forEach((digit, index) => {
                if (!positions[index][digit]) {
                    positions[index][digit] = 0;
                }
                positions[index][digit]++;
            });
        });
        
        // 获取每个位置出现次数最少的数字
        return positions.map(pos => {
            return Object.entries(pos)
                .sort((a, b) => a[1] - b[1])
                .slice(0, 5)
                .map(([num]) => parseInt(num));
        });
    }

    // 更新规律分析
    updatePatternAnalysis() {
        const recentData = this.historyData.slice(0, 30);
        
        // 奇偶比例
        let oddCount = 0, evenCount = 0;
        recentData.forEach(item => {
            const digits = item.number.split('').map(Number);
            digits.forEach(digit => {
                if (digit % 2 === 0) evenCount++;
                else oddCount++;
            });
        });
        document.getElementById('oddEvenRatio').textContent = `${oddCount}:${evenCount}`;
        
        // 大小比例 (0-4为小，5-9为大)
        let bigCount = 0, smallCount = 0;
        recentData.forEach(item => {
            const digits = item.number.split('').map(Number);
            digits.forEach(digit => {
                if (digit >= 5) bigCount++;
                else smallCount++;
            });
        });
        document.getElementById('bigSmallRatio').textContent = `${bigCount}:${smallCount}`;
        
        // 和值范围
        const sums = recentData.map(item => item.sum);
        const minSum = Math.min(...sums);
        const maxSum = Math.max(...sums);
        document.getElementById('sumRange').textContent = `${minSum}-${maxSum}`;
        
        // 跨度分析
        const spans = recentData.map(item => item.span);
        const avgSpan = (spans.reduce((a, b) => a + b, 0) / spans.length).toFixed(1);
        document.getElementById('spanAnalysis').textContent = `平均${avgSpan}`;
    }

    // 绘制走势图
    drawTrendChart() {
        const canvas = document.getElementById('trendCanvas');
        const ctx = canvas.getContext('2d');
        
        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 设置样式
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 2;
        ctx.fillStyle = '#667eea';
        
        // 绘制坐标轴
        ctx.beginPath();
        ctx.moveTo(50, 50);
        ctx.lineTo(50, canvas.height - 50);
        ctx.lineTo(canvas.width - 50, canvas.height - 50);
        ctx.stroke();
        
        // 绘制和值走势
        const recentData = this.historyData.slice(0, 20);
        const points = recentData.map((item, index) => ({
            x: 50 + (index * (canvas.width - 100) / (recentData.length - 1)),
            y: canvas.height - 50 - (item.sum * (canvas.height - 100) / 27)
        }));
        
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach(point => {
            ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
        
        // 绘制数据点
        points.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
            ctx.fill();
        });
        
        // 添加标签
        ctx.fillStyle = '#333';
        ctx.font = '14px Arial';
        ctx.fillText('和值走势图', canvas.width / 2 - 50, 30);
    }

    // 生成推荐号码
    generateRecommendations() {
        const recommendations = [];
        const hotNumbers = this.getHotNumbers();
        const coldNumbers = this.getColdNumbers();
        
        // 生成5个推荐号码
        for (let i = 0; i < 5; i++) {
            let number = '';
            for (let pos = 0; pos < 3; pos++) {
                if (Math.random() < 0.7) {
                    // 70%概率选择热号
                    const hotNum = hotNumbers[pos][Math.floor(Math.random() * hotNumbers[pos].length)];
                    number += hotNum;
                } else {
                    // 30%概率选择冷号
                    const coldNum = coldNumbers[pos][Math.floor(Math.random() * coldNumbers[pos].length)];
                    number += coldNum;
                }
            }
            recommendations.push(number);
        }
        
        // 显示推荐号码
        const container = document.getElementById('recommendations');
        container.innerHTML = recommendations.map(num => `
            <div class="recommendation-item" onclick="lotterySystem.displayNumber('${num}')">
                ${num}
            </div>
        `).join('');
    }

    // ==================== 双色球相关方法 ====================

    // 初始化双色球系统
    initSSQSystem() {
        this.updateSSQAnalysis();
        this.displaySSQPicks();
    }

    // LSTM蓝球预测（模拟）
    predictBlueBall() {
        // 模拟LSTM预测过程
        const recentBlueBalls = this.ssqHistoryData.slice(0, 30).map(item => item.blueBall);
        
        // 简单的LSTM模拟算法
        const prediction = this.simulateLSTMPrediction(recentBlueBalls);
        
        this.displayBlueBall(prediction);
        this.updateBlueAnalysis();
    }

    // 模拟LSTM预测算法
    simulateLSTMPrediction(sequence) {
        // 基于历史序列的简单预测
        const weights = [0.3, 0.25, 0.2, 0.15, 0.1]; // 时间权重
        let weightedSum = 0;
        
        for (let i = 0; i < Math.min(weights.length, sequence.length); i++) {
            weightedSum += sequence[i] * weights[i];
        }
        
        // 添加一些随机性
        const randomFactor = (Math.random() - 0.5) * 4;
        const prediction = Math.round(weightedSum + randomFactor);
        
        // 确保在1-16范围内
        return Math.max(1, Math.min(16, prediction));
    }

    // 生成随机蓝球
    generateRandomBlueBall() {
        const blueBall = Math.floor(Math.random() * 16) + 1;
        this.displayBlueBall(blueBall);
    }

    // 显示蓝球
    displayBlueBall(blueBall) {
        document.getElementById('blueBall').textContent = blueBall;
        
        // 添加动画效果
        const blueBallElement = document.getElementById('blueBall');
        blueBallElement.style.animation = 'none';
        setTimeout(() => {
            blueBallElement.style.animation = 'fadeIn 0.5s ease-in-out';
        }, 10);
    }

    // 生成红球号码
    generateRedBalls() {
        const redBalls = [];
        while (redBalls.length < 6) {
            const num = Math.floor(Math.random() * 33) + 1;
            if (!redBalls.includes(num)) {
                redBalls.push(num);
            }
        }
        redBalls.sort((a, b) => a - b);
        
        this.displayRedBalls(redBalls);
    }

    // 智能红球组合
    generateSmartRedBalls() {
        const recentData = this.ssqHistoryData.slice(0, 30);
        
        // 统计红球出现频率
        const frequency = {};
        for (let i = 1; i <= 33; i++) {
            frequency[i] = 0;
        }
        
        recentData.forEach(item => {
            item.redBalls.forEach(ball => {
                frequency[ball]++;
            });
        });
        
        // 选择热号和冷号的组合
        const hotBalls = Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([num]) => parseInt(num));
        
        const coldBalls = Object.entries(frequency)
            .sort((a, b) => a[1] - b[1])
            .slice(0, 10)
            .map(([num]) => parseInt(num));
        
        // 生成智能组合：3个热号 + 3个冷号
        const redBalls = [];
        
        // 选择3个热号
        for (let i = 0; i < 3; i++) {
            const randomHot = hotBalls[Math.floor(Math.random() * hotBalls.length)];
            if (!redBalls.includes(randomHot)) {
                redBalls.push(randomHot);
            }
        }
        
        // 选择3个冷号
        while (redBalls.length < 6) {
            const randomCold = coldBalls[Math.floor(Math.random() * coldBalls.length)];
            if (!redBalls.includes(randomCold)) {
                redBalls.push(randomCold);
            }
        }
        
        redBalls.sort((a, b) => a - b);
        this.displayRedBalls(redBalls);
    }

    // 显示红球
    displayRedBalls(redBalls) {
        for (let i = 0; i < 6; i++) {
            const element = document.getElementById(`redBall${i + 1}`);
            element.textContent = redBalls[i];
            
            // 添加动画效果
            element.style.animation = 'none';
            setTimeout(() => {
                element.style.animation = 'fadeIn 0.3s ease-in-out';
            }, i * 100);
        }
    }

    // 生成完整双色球号码
    generateCompleteSSQ() {
        // 生成红球
        this.generateSmartRedBalls();
        
        // 生成蓝球
        this.predictBlueBall();
        
        // 更新完整显示
        this.updateCompleteDisplay();
    }

    // 更新完整显示
    updateCompleteDisplay() {
        // 获取当前红球
        const redBalls = [];
        for (let i = 1; i <= 6; i++) {
            const value = document.getElementById(`redBall${i}`).textContent;
            if (value !== '0') {
                redBalls.push(parseInt(value));
            }
        }
        
        // 获取当前蓝球
        const blueBall = parseInt(document.getElementById('blueBall').textContent);
        
        // 更新完整显示
        for (let i = 0; i < 6; i++) {
            document.getElementById(`completeRed${i + 1}`).textContent = redBalls[i] || 0;
        }
        document.getElementById('completeBlue').textContent = blueBall;
    }

    // 保存完整双色球号码
    saveCompleteSSQ() {
        const redBalls = [];
        for (let i = 1; i <= 6; i++) {
            const value = document.getElementById(`redBall${i}`).textContent;
            if (value !== '0') {
                redBalls.push(parseInt(value));
            }
        }
        
        const blueBall = parseInt(document.getElementById('blueBall').textContent);
        
        if (redBalls.length === 6 && blueBall > 0) {
            const ssqPick = {
                redBalls: redBalls,
                blueBall: blueBall,
                time: new Date().toLocaleString('zh-CN'),
                method: '双色球预测'
            };
            
            this.ssqPicks.unshift(ssqPick);
            if (this.ssqPicks.length > 50) {
                this.ssqPicks = this.ssqPicks.slice(0, 50);
            }
            
            localStorage.setItem('ssqPicks', JSON.stringify(this.ssqPicks));
            this.displaySSQPicks();
            
            alert(`双色球号码已保存：${redBalls.join(', ')} + ${blueBall}`);
        } else {
            alert('请先生成完整的双色球号码！');
        }
    }

    // 更新双色球分析
    updateSSQAnalysis() {
        this.updateBlueAnalysis();
        this.updateRedAnalysis();
    }

    // 更新蓝球分析
    updateBlueAnalysis() {
        const recentData = this.ssqHistoryData.slice(0, 30);
        const blueBalls = recentData.map(item => item.blueBall);
        
        // 统计蓝球频率
        const frequency = {};
        for (let i = 1; i <= 16; i++) {
            frequency[i] = 0;
        }
        
        blueBalls.forEach(ball => {
            frequency[ball]++;
        });
        
        // 热号（出现频率最高的前3个）
        const hotBalls = Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([num]) => num);
        
        // 冷号（出现频率最低的前3个）
        const coldBalls = Object.entries(frequency)
            .sort((a, b) => a[1] - b[1])
            .slice(0, 3)
            .map(([num]) => num);
        
        document.getElementById('blueHotNumbers').textContent = hotBalls.join(', ');
        document.getElementById('blueColdNumbers').textContent = coldBalls.join(', ');
        document.getElementById('blueAccuracy').textContent = '约6.25%';
    }

    // 更新红球分析
    updateRedAnalysis() {
        const recentData = this.ssqHistoryData.slice(0, 30);
        
        // 计算和值范围
        const sums = recentData.map(item => item.redSum);
        const minSum = Math.min(...sums);
        const maxSum = Math.max(...sums);
        
        // 计算奇偶比例
        const oddCounts = recentData.map(item => item.redOddCount);
        const avgOddCount = (oddCounts.reduce((a, b) => a + b, 0) / oddCounts.length).toFixed(1);
        const avgEvenCount = (6 - avgOddCount).toFixed(1);
        
        // 计算大小比例
        const bigCounts = recentData.map(item => item.redBigCount);
        const avgBigCount = (bigCounts.reduce((a, b) => a + b, 0) / bigCounts.length).toFixed(1);
        const avgSmallCount = (6 - avgBigCount).toFixed(1);
        
        document.getElementById('redSumRange').textContent = `${minSum}-${maxSum}`;
        document.getElementById('redOddEven').textContent = `${avgOddCount}:${avgEvenCount}`;
        document.getElementById('redBigSmall').textContent = `${avgBigCount}:${avgSmallCount}`;
    }

    // 显示双色球选号记录
    displaySSQPicks() {
        // 这里可以添加双色球选号记录的显示逻辑
        // 暂时合并到主选号记录中
        if (this.ssqPicks.length > 0) {
            console.log('双色球选号记录:', this.ssqPicks);
        }
    }
}

// 初始化系统
const lotterySystem = new LotterySystem();

// 添加一些实用函数
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('号码已复制到剪贴板！');
    });
}

// 添加键盘快捷键
document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
        lotterySystem.generateRandomNumber();
    } else if (e.key === 'l' || e.key === 'L') {
        lotterySystem.generateLuckyNumber();
    } else if (e.key === 'a' || e.key === 'A') {
        lotterySystem.generateAnalyzedNumber();
    }
});

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('福彩3D预选系统已启动！');
    console.log('快捷键：R-随机选号，L-幸运号码，A-智能分析');
});
