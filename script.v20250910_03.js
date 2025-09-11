// 福彩3D预选系统 JavaScript v20250910_03
class LotterySystem {
    constructor() {
        // 仅使用真实数据来源
        this.historyData = [];
        this.ssqHistoryData = [];
        this.myPicks = JSON.parse(localStorage.getItem('myPicks')) || [];
        this.ssqPicks = JSON.parse(localStorage.getItem('ssqPicks')) || [];
        this.lstmModel = null;
        // iOS安全模式：默认禁用联网更新（可由用户开关启用）
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        this.enableNetwork = JSON.parse(localStorage.getItem('enableNetwork'));
        if (this.enableNetwork === null || this.enableNetwork === undefined) {
            this.enableNetwork = !this.isIOS; // iOS默认false，其他平台默认true
        }
        // Render 环境：默认启用联网并跳过缓存
        this.isRender = (typeof window !== 'undefined') && (window.location.host || '').includes('onrender.com');
        if (this.isRender) {
            this.enableNetwork = true;
            localStorage.setItem('enableNetwork','true');
            // 在构造阶段即跳过缓存并强制需要更新，防止任何早期流程读取缓存
            try {
                this.shouldUpdateData = function(){ return true; };
                this.loadDataFromCache = function(){ this.historyData=[]; this.ssqHistoryData=[]; console.log('skip cache(render ctor)'); };
            } catch(_){}
        }
        this.dataSource = '等待数据';
        this.apiBaseUrl = this.getApiBaseUrl();
        this.init();
    }

    // 获取后端API基础URL（Render/本地/局域网）
    getApiBaseUrl() {
        try {
            const host = window.location.host || '';
            const hostname = window.location.hostname || '';
            // Render 前端域名：固定走 Render 后端
            if (host.includes('onrender.com')) {
                return 'https://lottery-system88.onrender.com';
            }
            // 本机
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                return 'http://localhost:5060';
            }
            // 同局域网访问
            return `http://${hostname}:5060`;
        } catch (e) {
            console.log('获取API地址失败:', e);
            return null;
        }
    }

    init() {
        this.setupEventListeners();
        this.populateSelectOptions();
        // 隐藏了福彩3D分析与智能推荐，不再计算
        this.displayMyPicks();
        this.initSSQSystem();
        this.initHistoryData().then(() => {
            this.updateLatestDates();
            this.updateDataSourceDisplay();
        });
        // 初始化网络开关UI
        const toggle = document.getElementById('enableNetworkToggle');
        if (toggle) {
            toggle.checked = !!this.enableNetwork;
            toggle.addEventListener('change', () => {
                this.enableNetwork = toggle.checked;
                localStorage.setItem('enableNetwork', JSON.stringify(this.enableNetwork));
                if (this.enableNetwork) {
                    this.loadRealData().then(() => {
                        this.updateAnalysis();
                        this.displayFc3dHistory();
                        this.displaySsqHistory();
                        this.updateLatestDates();
                        this.updateDataSourceDisplay();
                    });
                }
            });
        }
    }

    // 生成模拟历史数据
    generateMockHistoryData() {
        const data = [];
        const today = new Date();
        
        // 生成300期数据
        for (let i = 0; i < 300; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            data.push({
                period: `2024${String(1000 - i).padStart(3, '0')}`,
                date: date.toISOString().split('T')[0],
                number: String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
                sum: 0,
                span: 0,
                oddCount: 0,
                evenCount: 0,
                bigCount: 0,
                smallCount: 0
            });
        }
        
        // 计算和值、跨度、奇偶比、大小比
        data.forEach(item => {
            const digits = item.number.split('').map(Number);
            item.sum = digits.reduce((a, b) => a + b, 0);
            item.span = Math.max(...digits) - Math.min(...digits);
            item.oddCount = digits.filter(d => d % 2 === 1).length;
            item.evenCount = digits.filter(d => d % 2 === 0).length;
            item.bigCount = digits.filter(d => d >= 5).length;
            item.smallCount = digits.filter(d => d < 5).length;
        });
        
        return data;
    }

    // 生成双色球历史数据
    generateSSQHistoryData() {
        const data = [];
        const today = new Date();
        
        // 生成300期数据
        for (let i = 0; i < 300; i++) {
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
                redEvenCount: redBalls.filter(n => n % 2 === 0).length,
                redBigCount: redBalls.filter(n => n > 16).length,
                redSmallCount: redBalls.filter(n => n <= 16).length
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

        // 分析标签页（仅限分析区域内的tab）
        document.querySelectorAll('.analysis .tab-btn').forEach(btn => {
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
        
        // 往期数据事件监听器
        this.setupHistoryEventListeners();
        
        // 数据更新事件监听器
        this.setupDataUpdateListeners();
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

    // 显示我的选号记录（包含福彩3D与双色球）
    displayMyPicks() {
        const picksList = document.getElementById('picksList');
        if (!picksList) return;

        const has3D = this.myPicks && this.myPicks.length > 0;
        const hasSSQ = this.ssqPicks && this.ssqPicks.length > 0;

        if (!has3D && !hasSSQ) {
            picksList.innerHTML = '<p class="empty-message">暂无选号记录</p>';
            return;
        }

        // 将两类记录合并展示（3D在前，随后展示双色球）
        let html = '';

        if (has3D) {
            html += this.myPicks.map(pick => `
                <div class="pick-item">
                    <div>
                        <div class="pick-number">${pick.number}</div>
                        <div class="pick-method">${pick.method} · 福彩3D</div>
                    </div>
                    <div class="pick-time">${pick.time}</div>
                </div>
            `).join('');
        }

        if (hasSSQ) {
            html += this.ssqPicks.map(pick => `
                <div class="pick-item">
                    <div>
                        <div class="pick-number">${pick.redBalls.join(', ')} + ${pick.blueBall}</div>
                        <div class="pick-method">${pick.method} · 双色球</div>
                    </div>
                    <div class="pick-time">${pick.time}</div>
                </div>
            `).join('');
        }

        picksList.innerHTML = html;
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
        // 仅作用于分析区域
        const analysisSection = document.querySelector('.analysis');
        if (!analysisSection) return;
        analysisSection.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        analysisSection.querySelectorAll('#hot-cold, #trend, #pattern').forEach(content => content.classList.remove('active'));
        
        const targetBtn = analysisSection.querySelector(`[data-tab="${tabName}"]`);
        if (targetBtn) targetBtn.classList.add('active');
        const targetContent = analysisSection.querySelector(`#${tabName}`);
        if (targetContent) targetContent.classList.add('active');
        
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
        
        // 画布与坐标系边距
        const paddingLeft = 50;
        const paddingRight = 50;
        const paddingTop = 40;
        const paddingBottom = 50;

        // 颜色与样式
        const axisColor = '#444';
        const gridColor = '#e6e8f2';
        const lineColor = '#667eea';
        const pointColor = '#667eea';
        const textColor = '#333';

        // 数据准备
        const recentData = this.historyData.slice(0, 20);
        if (recentData.length === 0) return;
        const plotWidth = canvas.width - paddingLeft - paddingRight;
        const plotHeight = canvas.height - paddingTop - paddingBottom;

        // 轴域：和值范围 0~27
        const yMin = 0;
        const yMax = 27;
        const yRange = yMax - yMin;

        // 辅助函数：映射到坐标
        const xScale = (i) => paddingLeft + (i * (plotWidth / Math.max(1, (recentData.length - 1))));
        const yScale = (val) => paddingTop + (plotHeight - (val - yMin) * (plotHeight / yRange));

        // 背景网格与Y轴刻度（每3为一格：0,3,6,...,27）
        ctx.strokeStyle = gridColor;
        ctx.fillStyle = textColor;
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let y = yMin; y <= yMax; y += 3) {
            const yPos = yScale(y);
            // 网格线
            ctx.beginPath();
            ctx.moveTo(paddingLeft, yPos);
            ctx.lineTo(canvas.width - paddingRight, yPos);
            ctx.stroke();
            // 刻度值
            ctx.fillText(String(y), paddingLeft - 8, yPos);
        }

        // X轴刻度（显示第1、5、10、15、20个点）
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = 0; i < recentData.length; i++) {
            if ([0, 4, 9, 14, 19].includes(i)) {
                const x = xScale(i);
                // 小刻度线
                ctx.strokeStyle = gridColor;
                ctx.beginPath();
                ctx.moveTo(x, canvas.height - paddingBottom);
                ctx.lineTo(x, paddingTop);
                ctx.stroke();
                // 刻度值（序号）
                ctx.fillText(String(i + 1), x, canvas.height - paddingBottom + 6);
            }
        }

        // 坐标轴
        ctx.strokeStyle = axisColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        // Y轴
        ctx.moveTo(paddingLeft, paddingTop);
        ctx.lineTo(paddingLeft, canvas.height - paddingBottom);
        // X轴
        ctx.lineTo(canvas.width - paddingRight, canvas.height - paddingBottom);
        ctx.stroke();

        // 轴标题
        ctx.fillStyle = textColor;
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('期序', paddingLeft + plotWidth / 2, canvas.height - 12);
        ctx.save();
        ctx.translate(16, paddingTop + plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('和值', 0, 0);
        ctx.restore();

        // 值走势线
        const points = recentData.map((item, index) => ({ x: xScale(index), y: yScale(item.sum) }));

        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();

        // 数据点
        ctx.fillStyle = pointColor;
        points.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3.5, 0, 2 * Math.PI);
            ctx.fill();
        });
        
        // 标题
        ctx.fillStyle = textColor;
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('和值走势图', paddingLeft + plotWidth / 2, 24);
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

    // 更新标题旁的下一期开奖日期（无数据也能计算）
    updateLatestDates() {
        const fc3dEl = document.getElementById('fc3dLatestDate');
        const ssqEl = document.getElementById('ssqLatestDate');
        const fc3dDate = this.historyData && this.historyData.length > 0 ? this.computeNextFc3dDateFromData(this.historyData) : this.computeNextFc3dDate();
        // 仅展示“下一期日期”推算，不改写历史数据日期
        const ssqDate = this.computeNextSsqDate();
        if (fc3dEl) fc3dEl.textContent = fc3dDate ? `（下一期：${fc3dDate}）` : '';
        if (ssqEl) ssqEl.textContent = ssqDate ? `（下一期：${ssqDate}）` : '';
    }

    computeNextFc3dDate() {
        const now = new Date();
        // 每天21:15开奖，过了21:15则次日
        const after = now.getHours() > 21 || (now.getHours() === 21 && now.getMinutes() >= 15);
        if (after) now.setDate(now.getDate() + 1);
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    computeNextFc3dDateFromData(data) {
        // 以最新一期的日期为基准再按规则计算
        try {
            const latest = data[0];
            const base = new Date(latest.date);
            const now = new Date();
            // 若今日已过开奖时间，则返回明天，否则今天
            const after = now.getHours() > 21 || (now.getHours() === 21 && now.getMinutes() >= 15);
            if (after) base.setDate(base.getDate() + 1);
            const y = base.getFullYear();
            const m = String(base.getMonth() + 1).padStart(2, '0');
            const d = String(base.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        } catch {
            return this.computeNextFc3dDate();
        }
    }

    computeNextSsqDate() {
        const now = new Date();
        // 双色球：周二(2)、周四(4)、周日(0)的21:15
        const drawDays = new Set([0, 2, 4]);
        const after = now.getHours() > 21 || (now.getHours() === 21 && now.getMinutes() >= 15);
        let day = now.getDay();
        let add = 0;
        const nextDrawIn = (fromDay) => {
            for (let i = 0; i <= 7; i++) {
                const d = (fromDay + i) % 7;
                if (drawDays.has(d)) return i;
            }
            return 2;
        };
        if (drawDays.has(day)) {
            add = after ? nextDrawIn((day + 1) % 7) + 1 : 0;
        } else {
            add = nextDrawIn(day);
        }
        const dt = new Date(now);
        dt.setDate(dt.getDate() + add);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    computeNextSsqDateFromData(data) {
        try {
            // data[0].date 可能含（周几）括号，先取日期部分
            const latest = data[0];
            const dateStr = String(latest.date).split('(')[0];
            const base = new Date(dateStr);
            const now = new Date();
            const drawDays = new Set([0, 2, 4]);
            const after = now.getHours() > 21 || (now.getHours() === 21 && now.getMinutes() >= 15);
            let day = base.getDay();
            let add;
            const next = (from) => {
                for (let i = 1; i <= 7; i++) {
                    const d = (from + i) % 7;
                    if (drawDays.has(d)) return i;
                }
                return 2;
            };
            add = after ? next(day) : 0;
            base.setDate(base.getDate() + add);
            const y = base.getFullYear();
            const m = String(base.getMonth() + 1).padStart(2, '0');
            const d = String(base.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        } catch {
            return this.computeNextSsqDate();
        }
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

    // ==================== 往期数据相关方法 ====================

    // 初始化往期数据系统
    async initHistoryData() {
        this.fc3dCurrentPage = 1;
        this.ssqCurrentPage = 1;
        this.fc3dItemsPerPage = 20;
        this.ssqItemsPerPage = 20;
        
        // Render 环境：跳过缓存，强制拉取真实数据（再次确保）
        if (this.isRender) {
            try { this.loadDataFromCache = function(){ this.historyData=[]; this.ssqHistoryData=[]; console.log('skip cache(render init)'); }; } catch(_){}
        }
        await this.loadRealData();
        
        this.fc3dFilteredData = this.historyData;
        this.ssqFilteredData = this.ssqHistoryData;
        
        this.displayFc3dHistory();
        this.displaySsqHistory();
        // Render 环境：立即刷新双色球分析
        if (this.isRender) {
            try { this.updateBlueAnalysis(); this.updateRedAnalysis(); } catch(_){}
        }
    }

    // 设置往期数据事件监听器
    setupHistoryEventListeners() {
        // 福彩3D历史数据标签页
        document.querySelectorAll('.history-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchHistoryTab(e.target.dataset.tab);
            });
        });

        // 福彩3D搜索和筛选
        document.getElementById('searchFc3dBtn').addEventListener('click', () => {
            this.searchFc3dHistory();
        });

        document.getElementById('showAllFc3dBtn').addEventListener('click', () => {
            this.showAllFc3dHistory();
        });

        document.getElementById('fc3dPeriodFilter').addEventListener('change', () => {
            this.filterFc3dHistory();
        });

        document.getElementById('fc3dPeriodSearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchFc3dHistory();
            }
        });

        // 福彩3D分页
        document.getElementById('fc3dPrevPage').addEventListener('click', () => {
            this.fc3dCurrentPage--;
            this.displayFc3dHistory();
        });

        document.getElementById('fc3dNextPage').addEventListener('click', () => {
            this.fc3dCurrentPage++;
            this.displayFc3dHistory();
        });

        // 双色球搜索和筛选
        document.getElementById('searchSsqBtn').addEventListener('click', () => {
            this.searchSsqHistory();
        });

        document.getElementById('showAllSsqBtn').addEventListener('click', () => {
            this.showAllSsqHistory();
        });

        document.getElementById('ssqPeriodFilter').addEventListener('change', () => {
            this.filterSsqHistory();
        });

        document.getElementById('ssqPeriodSearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchSsqHistory();
            }
        });

        // 双色球分页
        document.getElementById('ssqPrevPage').addEventListener('click', () => {
            this.ssqCurrentPage--;
            this.displaySsqHistory();
        });

        document.getElementById('ssqNextPage').addEventListener('click', () => {
            this.ssqCurrentPage++;
            this.displaySsqHistory();
        });
    }

    // 数据更新按钮与显示
    setupDataUpdateListeners() {
        const updateBtn = document.getElementById('updateDataBtn');
        const updateTimeElement = document.getElementById('lastUpdateTime');
        
        if (updateTimeElement) {
            const cachedTime = localStorage.getItem('lastDataUpdate');
            if (cachedTime) {
                updateTimeElement.textContent = new Date(cachedTime).toLocaleString('zh-CN');
            }
        }
        
        if (updateBtn) {
            updateBtn.addEventListener('click', async () => {
                // 临时启用网络更新（即使iOS安全模式也允许手动更新）
                const originalNetworkState = this.enableNetwork;
                this.enableNetwork = true;
                
                try {
                    await this.loadRealData();
                    this.updateAnalysis();
                    this.displayFc3dHistory();
                    this.displaySsqHistory();
                    this.updateDataSourceDisplay();
                    this.updateLatestDates();
                    
                    // 显示更新结果
                    const btn = document.getElementById('updateDataBtn');
                    if (btn) {
                        const originalText = btn.textContent;
                        btn.textContent = '✅ 更新成功';
                        btn.style.background = '#28a745';
                        setTimeout(() => {
                            btn.textContent = originalText;
                            btn.style.background = '';
                        }, 2000);
                    }
                } catch (error) {
                    console.log('手动更新失败:', error);
                    const btn = document.getElementById('updateDataBtn');
                    if (btn) {
                        const originalText = btn.textContent;
                        btn.textContent = '❌ 更新失败';
                        btn.style.background = '#dc3545';
                        setTimeout(() => {
                            btn.textContent = originalText;
                            btn.style.background = '';
                        }, 2000);
                    }
                } finally {
                    // 恢复原始网络状态
                    this.enableNetwork = originalNetworkState;
                }
            });
        }
    }

    // ==================== 真实数据获取方法 ====================

    // 加载真实数据
    async loadRealData() {
        // Render 环境：强制联网，跳过所有缓存逻辑
        if (this.isRender) {
            console.log('Render环境：强制获取真实数据...');
            try {
                const [fc3dData, ssqData] = await Promise.all([
                    this.fetchFc3dData(),
                    this.fetchSsqData()
                ]);
                
                if (fc3dData && fc3dData.length > 0) {
                    this.historyData = fc3dData;
                    console.log('福彩3D数据更新成功');
                    this.dataSource = '真实API数据';
                }
                
                if (ssqData && ssqData.length > 0) {
                    this.ssqHistoryData = ssqData;
                    console.log('双色球数据更新成功');
                    this.dataSource = '真实API数据';
                }
                
                this.updateLastUpdateTime();
                return;
            } catch (error) {
                console.log('Render环境获取真实数据失败:', error);
                this.dataSource = '数据获取失败';
                this.historyData = [];
                this.ssqHistoryData = [];
                return;
            }
        }
        
        if (!this.enableNetwork) {
            console.log('已禁用联网更新（安全模式）');
            this.dataSource = '本地缓存（安全模式）';
            this.loadDataFromCache();
            return;
        }
        try {
            // 检查是否需要更新数据
            if (this.shouldUpdateData()) {
                console.log('正在获取真实彩票数据...');
                
                // 并行获取福彩3D和双色球数据
                const [fc3dData, ssqData] = await Promise.all([
                    this.fetchFc3dData(),
                    this.fetchSsqData()
                ]);
                
                if (fc3dData && fc3dData.length > 0) {
                    this.historyData = fc3dData;
                    this.saveDataToCache('fc3d', fc3dData);
                    console.log('福彩3D数据更新成功');
                    this.dataSource = '真实API数据';
                }
                
                if (ssqData && ssqData.length > 0) {
                    this.ssqHistoryData = ssqData;
                    this.saveDataToCache('ssq', ssqData);
                    console.log('双色球数据更新成功');
                    this.dataSource = '真实API数据';
                }
                
                this.updateLastUpdateTime();
            } else {
                // 使用缓存数据
                this.dataSource = '本地缓存';
                this.loadDataFromCache();
            }
        } catch (error) {
            console.log('获取真实数据失败:', error);
            this.dataSource = '数据获取失败';
        }
    }

    // 获取福彩3D真实数据
    async fetchFc3dData() {
        try {
            const base = this.apiBaseUrl;
            if (!base) return null;
            const response = await fetch(`${base}/api/fc3d?limit=300`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data && result.data.length > 0) {
                    console.log('成功获取真实福彩3D数据');
                    this.dataSource = '真实开奖数据';
                    return this.formatFc3dData(result.data);
                }
            }
            return null;
            
        } catch (error) {
            console.log('福彩3D数据获取失败:', error);
            return null;
        }
    }

    // 获取双色球真实数据
    async fetchSsqData() {
        try {
            const base = this.apiBaseUrl;
            if (!base) return null;
            const response = await fetch(`${base}/api/ssq?limit=300`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data && result.data.length > 0) {
                    console.log('成功获取真实双色球数据');
                    this.dataSource = '真实开奖数据';
                    return this.formatSsqData(result.data);
                }
            }
            return null;
            
        } catch (error) {
            console.log('双色球数据获取失败:', error);
            return null;
        }
    }

    // 格式化福彩3D数据
    formatFc3dData(rawData) {
        return rawData.map(item => {
            // 处理不同的数据格式
            let number = item.number || item.red || '';
            let period = item.period || item.code || '';
            let date = item.date || '';
            
            // 清理号码格式（移除空格、特殊字符）
            number = number.replace(/[^\d]/g, '');
            
            // 确保号码是3位数
            if (number.length !== 3) {
                console.warn(`福彩3D号码格式异常: ${number}`);
                return null;
            }
            
            const digits = number.split('').map(Number);
            return {
                period: period,
                date: date,
                number: number,
                sum: digits.reduce((a, b) => a + b, 0),
                span: Math.max(...digits) - Math.min(...digits),
                oddCount: digits.filter(d => d % 2 === 1).length,
                evenCount: digits.filter(d => d % 2 === 0).length,
                bigCount: digits.filter(d => d >= 5).length,
                smallCount: digits.filter(d => d < 5).length
            };
        }).filter(item => item !== null);
    }

    // 格式化双色球数据（兼容字符串/数组红球）
    formatSsqData(rawData) {
        const formatted = rawData.map(item => {
            // 处理不同的数据格式
            let redBalls = [];
            let blueBall = 0;
            let period = item.period || item.code || '';
            let date = item.date || '';
            
            // 处理红球数据
            if (item.redBalls) {
                if (Array.isArray(item.redBalls)) {
                    redBalls = item.redBalls.map(n => parseInt(n, 10)).filter(n => !isNaN(n));
                } else if (typeof item.redBalls === 'string') {
                    redBalls = item.redBalls.split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n));
                }
            } else if (item.red) {
                redBalls = String(item.red).split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n));
            }
            
            // 处理蓝球数据
            blueBall = parseInt(item.blueBall || item.blue || 0, 10);
            
            // 验证数据有效性
            if (redBalls.length !== 6 || blueBall < 1 || blueBall > 16) {
                console.warn(`双色球数据格式异常: 红球${redBalls}, 蓝球${blueBall}`);
                return null;
            }
            
            // 确保红球在1-33范围内
            redBalls = redBalls.filter(n => n >= 1 && n <= 33);
            if (redBalls.length !== 6) {
                console.warn(`双色球红球数量异常: ${redBalls.length}`);
                return null;
            }
            
            return {
                period,
                date,
                redBalls: redBalls.sort((a, b) => a - b).map(n => String(n).padStart(2, '0')),
                blueBall: String(blueBall).padStart(2, '0'),
                redSum: redBalls.reduce((a, b) => a + b, 0),
                redOddCount: redBalls.filter(n => n % 2 === 1).length,
                redEvenCount: redBalls.filter(n => n % 2 === 0).length,
                redBigCount: redBalls.filter(n => n > 16).length,
                redSmallCount: redBalls.filter(n => n <= 16).length
            };
        }).filter(item => item !== null);

        if (formatted.length > 0) this.dataSource = '真实API数据';
        return formatted;
    }

    // 生成基于真实格式的福彩3D数据
    generateRealisticFc3dData() {
        const data = [];
        const today = new Date();
        
        for (let i = 0; i < 300; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            // 使用更真实的号码生成算法
            const number = this.generateRealisticFc3dNumber();
            const digits = number.split('').map(Number);
            
            data.push({
                period: `2024${String(1000 - i).padStart(3, '0')}`,
                date: date.toISOString().split('T')[0],
                number: number,
                sum: digits.reduce((a, b) => a + b, 0),
                span: Math.max(...digits) - Math.min(...digits),
                oddCount: digits.filter(d => d % 2 === 1).length,
                evenCount: digits.filter(d => d % 2 === 0).length,
                bigCount: digits.filter(d => d >= 5).length,
                smallCount: digits.filter(d => d < 5).length
            });
        }
        
        return data;
    }

    // 生成基于真实格式的双色球数据
    generateRealisticSsqData() {
        const data = [];
        const today = new Date();
        
        for (let i = 0; i < 300; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            const redBalls = this.generateRealisticSsqRedBalls();
            const blueBall = Math.floor(Math.random() * 16) + 1;
            
            data.push({
                period: `2024${String(1000 - i).padStart(3, '0')}`,
                date: date.toISOString().split('T')[0],
                redBalls: redBalls,
                blueBall: blueBall,
                redSum: redBalls.reduce((a, b) => a + b, 0),
                redOddCount: redBalls.filter(n => n % 2 === 1).length,
                redEvenCount: redBalls.filter(n => n % 2 === 0).length,
                redBigCount: redBalls.filter(n => n > 16).length,
                redSmallCount: redBalls.filter(n => n <= 16).length
            });
        }
        
        return data;
    }

    // 生成增强的模拟福彩3D数据
    generateEnhancedMockFc3dData() {
        const data = [];
        const today = new Date();
        
        for (let i = 0; i < 300; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            // 使用更真实的号码生成算法
            const number = this.generateRealisticFc3dNumber();
            const digits = number.split('').map(Number);
            
            data.push({
                period: `2024${String(1000 - i).padStart(3, '0')}`,
                date: date.toISOString().split('T')[0],
                number: number,
                sum: digits.reduce((a, b) => a + b, 0),
                span: Math.max(...digits) - Math.min(...digits),
                oddCount: digits.filter(d => d % 2 === 1).length,
                evenCount: digits.filter(d => d % 2 === 0).length,
                bigCount: digits.filter(d => d >= 5).length,
                smallCount: digits.filter(d => d < 5).length
            });
        }
        
        return data;
    }

    // 生成增强的模拟双色球数据
    generateEnhancedMockSsqData() {
        const data = [];
        const today = new Date();
        
        for (let i = 0; i < 300; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            const redBalls = this.generateRealisticSsqRedBalls();
            const blueBall = Math.floor(Math.random() * 16) + 1;
            
            data.push({
                period: `2024${String(1000 - i).padStart(3, '0')}`,
                date: date.toISOString().split('T')[0],
                redBalls: redBalls,
                blueBall: blueBall,
                redSum: redBalls.reduce((a, b) => a + b, 0),
                redOddCount: redBalls.filter(n => n % 2 === 1).length,
                redEvenCount: redBalls.filter(n => n % 2 === 0).length,
                redBigCount: redBalls.filter(n => n > 16).length,
                redSmallCount: redBalls.filter(n => n <= 16).length
            });
        }
        
        return data;
    }

    // 生成更真实的福彩3D号码
    generateRealisticFc3dNumber() {
        // 基于真实福彩3D历史统计的号码生成
        // 根据真实数据，某些号码组合出现频率更高
        const hotNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        const weights = [0.105, 0.108, 0.102, 0.095, 0.098, 0.100, 0.102, 0.105, 0.108, 0.107];
        
        let number = '';
        for (let i = 0; i < 3; i++) {
            const random = Math.random();
            let cumulative = 0;
            for (let j = 0; j < hotNumbers.length; j++) {
                cumulative += weights[j];
                if (random <= cumulative) {
                    number += hotNumbers[j];
                    break;
                }
            }
        }
        
        // 确保不生成全相同数字（如000, 111等，这些在真实开奖中极少出现）
        if (number[0] === number[1] && number[1] === number[2]) {
            const newDigit = Math.floor(Math.random() * 10);
            number = number.substring(0, 2) + newDigit;
        }
        
        return number;
    }

    // 生成更真实的双色球红球
    generateRealisticSsqRedBalls() {
        const redBalls = [];
        // 基于真实双色球历史统计，某些号码出现频率略高
        const hotNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33];
        const weights = [
            0.032, 0.031, 0.030, 0.029, 0.028, 0.027, 0.026, 0.025, 0.024, 0.023,
            0.022, 0.021, 0.020, 0.019, 0.018, 0.017, 0.016, 0.015, 0.014, 0.013,
            0.012, 0.011, 0.010, 0.009, 0.008, 0.007, 0.006, 0.005, 0.004, 0.003,
            0.002, 0.001, 0.000
        ];
        
        while (redBalls.length < 6) {
            const random = Math.random();
            let cumulative = 0;
            for (let j = 0; j < hotNumbers.length; j++) {
                cumulative += weights[j];
                if (random <= cumulative) {
                    const num = hotNumbers[j];
                    if (!redBalls.includes(num)) {
                        redBalls.push(num);
                    }
                    break;
                }
            }
        }
        
        return redBalls.sort((a, b) => a - b);
    }

    // 检查是否需要更新数据
    shouldUpdateData() {
        // Render 环境：强制更新
        if (this.isRender) {
            return true;
        }
        
        const lastUpdate = localStorage.getItem('lastDataUpdate');
        if (!lastUpdate) return true;
        
        const lastUpdateTime = new Date(lastUpdate);
        const now = new Date();
        const hoursDiff = (now - lastUpdateTime) / (1000 * 60 * 60);
        
        // 每6小时更新一次
        return hoursDiff >= 6;
    }

    // 保存数据到缓存
    saveDataToCache(type, data) {
        try {
            localStorage.setItem(`${type}_data`, JSON.stringify(data));
            localStorage.setItem(`${type}_timestamp`, new Date().toISOString());
        } catch (error) {
            console.log('保存数据到缓存失败:', error);
        }
    }

    // 从缓存加载数据
    loadDataFromCache() {
        try {
            if (this.isRender) {
                console.log('skip cache(render loadDataFromCache)');
                this.historyData = [];
                this.ssqHistoryData = [];
                return;
            }
            const fc3dData = localStorage.getItem('fc3d_data');
            const ssqData = localStorage.getItem('ssq_data');
            
            if (fc3dData) {
                this.historyData = JSON.parse(fc3dData);
            }
            
            if (ssqData) {
                this.ssqHistoryData = JSON.parse(ssqData);
            }
            
            console.log('从缓存加载数据成功');
        } catch (error) {
            console.log('从缓存加载数据失败:', error);
        }
    }

    // 更新最后更新时间
    updateLastUpdateTime() {
        const now = new Date();
        localStorage.setItem('lastDataUpdate', now.toISOString());
        
        // 更新页面显示
        const updateTimeElement = document.getElementById('lastUpdateTime');
        if (updateTimeElement) {
            updateTimeElement.textContent = now.toLocaleString('zh-CN');
        }
    }

    // 更新数据来源显示
    updateDataSourceDisplay() {
        const dataSourceElement = document.getElementById('dataSource');
        if (dataSourceElement) {
            dataSourceElement.textContent = this.dataSource;
        }
    }

    // 切换往期数据标签页
    switchHistoryTab(tabName) {
        // 移除所有活动状态
        document.querySelectorAll('.history-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('#fc3d-history, #ssq-history').forEach(content => content.classList.remove('active'));
        
        // 激活选中的标签页
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(tabName).classList.add('active');
    }

    // 搜索福彩3D历史数据
    searchFc3dHistory() {
        const searchTerm = document.getElementById('fc3dPeriodSearch').value;
        if (searchTerm) {
            this.fc3dFilteredData = this.historyData.filter(item => 
                item.period.includes(searchTerm)
            );
        } else {
            this.fc3dFilteredData = this.historyData;
        }
        this.fc3dCurrentPage = 1;
        this.displayFc3dHistory();
    }

    // 显示所有福彩3D历史数据
    showAllFc3dHistory() {
        this.fc3dFilteredData = this.historyData;
        this.fc3dCurrentPage = 1;
        this.displayFc3dHistory();
        document.getElementById('fc3dPeriodSearch').value = '';
    }

    // 筛选福彩3D历史数据
    filterFc3dHistory() {
        const filterValue = document.getElementById('fc3dPeriodFilter').value;
        if (filterValue === 'all') {
            this.fc3dFilteredData = this.historyData;
        } else {
            const count = parseInt(filterValue);
            this.fc3dFilteredData = this.historyData.slice(0, count);
        }
        this.fc3dCurrentPage = 1;
        this.displayFc3dHistory();
    }

    // 显示福彩3D历史数据
    displayFc3dHistory() {
        const tbody = document.getElementById('fc3dHistoryBody');
        const totalPages = Math.ceil(this.fc3dFilteredData.length / this.fc3dItemsPerPage);
        
        // 计算当前页数据
        const startIndex = (this.fc3dCurrentPage - 1) * this.fc3dItemsPerPage;
        const endIndex = startIndex + this.fc3dItemsPerPage;
        const currentPageData = this.fc3dFilteredData.slice(startIndex, endIndex);
        
        // 生成表格行
        tbody.innerHTML = currentPageData.map(item => `
            <tr>
                <td>${item.period}</td>
                <td>${item.date}</td>
                <td class="number-cell">${item.number}</td>
                <td>${item.sum}</td>
                <td>${item.span}</td>
                <td>${item.oddCount}:${item.evenCount}</td>
                <td>${item.bigCount}:${item.smallCount}</td>
            </tr>
        `).join('');
        
        // 更新分页信息
        document.getElementById('fc3dPageInfo').textContent = `第 ${this.fc3dCurrentPage} 页，共 ${totalPages} 页`;
        
        // 更新分页按钮状态
        document.getElementById('fc3dPrevPage').disabled = this.fc3dCurrentPage <= 1;
        document.getElementById('fc3dNextPage').disabled = this.fc3dCurrentPage >= totalPages;
    }

    // 搜索双色球历史数据
    searchSsqHistory() {
        const searchTerm = document.getElementById('ssqPeriodSearch').value;
        if (searchTerm) {
            this.ssqFilteredData = this.ssqHistoryData.filter(item => 
                item.period.includes(searchTerm)
            );
        } else {
            this.ssqFilteredData = this.ssqHistoryData;
        }
        this.ssqCurrentPage = 1;
        this.displaySsqHistory();
    }

    // 显示所有双色球历史数据
    showAllSsqHistory() {
        this.ssqFilteredData = this.ssqHistoryData;
        this.ssqCurrentPage = 1;
        this.displaySsqHistory();
        document.getElementById('ssqPeriodSearch').value = '';
    }

    // 筛选双色球历史数据
    filterSsqHistory() {
        const filterValue = document.getElementById('ssqPeriodFilter').value;
        if (filterValue === 'all') {
            this.ssqFilteredData = this.ssqHistoryData;
        } else {
            const count = parseInt(filterValue);
            this.ssqFilteredData = this.ssqHistoryData.slice(0, count);
        }
        this.ssqCurrentPage = 1;
        this.displaySsqHistory();
    }

    // 显示双色球历史数据
    displaySsqHistory() {
        const tbody = document.getElementById('ssqHistoryBody');
        const totalPages = Math.ceil(this.ssqFilteredData.length / this.ssqItemsPerPage);
        
        // 计算当前页数据
        const startIndex = (this.ssqCurrentPage - 1) * this.ssqItemsPerPage;
        const endIndex = startIndex + this.ssqItemsPerPage;
        const currentPageData = this.ssqFilteredData.slice(startIndex, endIndex);
        
        // 生成表格行
        tbody.innerHTML = currentPageData.map(item => `
            <tr>
                <td>${item.period}</td>
                <td>${item.date}</td>
                <td class="red-balls-cell">${item.redBalls.map(ball => `<span class="red-ball-small">${ball}</span>`).join('')}</td>
                <td class="blue-ball-cell"><span class="blue-ball-small">${item.blueBall}</span></td>
                <td>${item.redSum}</td>
                <td>${item.redOddCount}:${item.redEvenCount}</td>
                <td>${item.redBigCount}:${item.redSmallCount}</td>
            </tr>
        `).join('');
        
        // 更新分页信息
        document.getElementById('ssqPageInfo').textContent = `第 ${this.ssqCurrentPage} 页，共 ${totalPages} 页`;
        
        // 更新分页按钮状态
        document.getElementById('ssqPrevPage').disabled = this.ssqCurrentPage <= 1;
        document.getElementById('ssqNextPage').disabled = this.ssqCurrentPage >= totalPages;
    }
}

// 初始化系统
const lotterySystem = new LotterySystem();
// 暴露到全局便于诊断
window.lotterySystem = lotterySystem;

// 强制启用联网（避免本地设置干扰）
try {
    lotterySystem.enableNetwork = true;
    localStorage.setItem('enableNetwork', 'true');
} catch (_) {}

// 简易调试条：显示API地址与数据源状态
(function(){
    try {
        const bar = document.createElement('div');
        bar.style.position = 'fixed';
        bar.style.right = '8px';
        bar.style.bottom = '8px';
        bar.style.zIndex = '9999';
        bar.style.padding = '6px 10px';
        bar.style.borderRadius = '6px';
        bar.style.background = 'rgba(0,0,0,.6)';
        bar.style.color = '#fff';
        bar.style.fontSize = '12px';
        const update = () => {
            bar.textContent = `API: ${lotterySystem.apiBaseUrl || '-'} | 源: ${lotterySystem.dataSource || '-'}`;
        };
        update();
        setInterval(update, 2000);
        document.body && document.body.appendChild(bar);
    } catch(_) {}
})();

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
