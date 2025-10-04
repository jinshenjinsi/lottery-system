// 福彩3D预选系统 JavaScript v20250929_01
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
            // 本机
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                return 'http://localhost:5050';
            }
            // 同局域网访问
            return `http://${hostname}:5050`;
        } catch (e) {
            console.log('获取API地址失败:', e);
            return null;
        }
    }

    init() {
        // 等待 DOM 加载完成后再初始化
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initAfterDOMLoaded());
        } else {
            this.initAfterDOMLoaded();
        }
    }

    initAfterDOMLoaded() {
        try {
            // 强制启用联网
            this.enableNetwork = true;
            localStorage.setItem('enableNetwork', 'true');
            
            // 初始化UI
            this.setupEventListeners();
            this.populateSelectOptions();
            this.displayMyPicks();
            this.initSSQSystem();
            
            // 加载数据
            this.initHistoryData().then(() => {
                this.updateLatestDates();
                this.updateDataSourceDisplay();
            });
            
            // 扫码验奖事件
            this.setupScanValidate();
            
            // 初始化网络开关UI
            const toggle = document.getElementById('enableNetworkToggle');
            if (toggle) {
                toggle.checked = true;
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
            
            console.log('系统初始化完成');
        } catch (error) {
            console.error('初始化过程中出错:', error);
        }
    }

    // 设置事件监听器
    setupEventListeners() {
        try {
            // 快速选号按钮
            this.addEventListenerSafely('randomBtn', 'click', () => {
                console.log('点击随机选号按钮');
                this.generateRandomNumber();
            });

            this.addEventListenerSafely('luckyBtn', 'click', () => {
                console.log('点击幸运号码按钮');
                this.generateLuckyNumber();
            });

            this.addEventListenerSafely('analyzeBtn', 'click', () => {
                console.log('点击智能分析按钮');
                this.generateAnalyzedNumber();
            });

            // 手动选号已移除（保持兼容，若存在则绑定）
            const manualConfirmBtn = document.getElementById('confirmBtn');
            if (manualConfirmBtn) {
                manualConfirmBtn.addEventListener('click', () => {
                    console.log('点击确认选号按钮');
                    this.confirmManualPick();
                });
            }

            // 分析标签页（仅限分析区域内的tab）
            document.querySelectorAll('.analysis .tab-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    console.log('点击分析标签页:', e.target.dataset.tab);
                    this.switchTab(e.target.dataset.tab);
                });
            });

            // 刷新推荐
            this.addEventListenerSafely('refreshRecommendations', 'click', () => {
                console.log('点击刷新推荐按钮');
                this.generateRecommendations();
            });

            // 清空记录
            this.addEventListenerSafely('clearPicks', 'click', () => {
                console.log('点击清空记录按钮');
                this.clearMyPicks();
            });

            // 双色球事件监听器
            this.setupSSQEventListeners();
            
            // 往期数据事件监听器
            this.setupHistoryEventListeners();
            
            // 数据更新事件监听器
            this.setupDataUpdateListeners();

            console.log('所有事件监听器设置完成');
        } catch (error) {
            console.error('设置事件监听器时出错:', error);
        }
    }

    // 安全地添加事件监听器
    addEventListenerSafely(elementId, eventType, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener(eventType, handler);
            console.log(`成功为 ${elementId} 添加 ${eventType} 事件监听器`);
        } else {
            console.error(`未找到元素: ${elementId}`);
        }
    }

    // 生成随机号码
    generateRandomNumber() {
        try {
            console.log('生成随机号码');
            const number = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
            this.displayNumber(number);
            this.addToMyPicks(number, '随机选号');
        } catch (error) {
            console.error('生成随机号码失败:', error);
        }
    }

    // 生成幸运号码
    generateLuckyNumber() {
        try {
            console.log('生成幸运号码');
            if (this.historyData && this.historyData.length > 0) {
                const recentNumbers = this.historyData.slice(0, 10);
                const digits = [[], [], []];
                
                // 统计每个位置的数字频率
                recentNumbers.forEach(item => {
                    const nums = item.number.split('');
                    nums.forEach((num, i) => {
                        digits[i].push(parseInt(num));
                    });
                });
                
                // 从每个位置的数字中随机选择
                const number = digits.map(pos => {
                    const idx = Math.floor(Math.random() * pos.length);
                    return pos[idx];
                }).join('');
                
                this.displayNumber(number);
                this.addToMyPicks(number, '幸运号码');
            } else {
                // 如果没有历史数据，生成随机号码
                this.generateRandomNumber();
            }
        } catch (error) {
            console.error('生成幸运号码失败:', error);
            // 出错时生成随机号码
            this.generateRandomNumber();
        }
    }

    // 生成分析号码
    generateAnalyzedNumber() {
        try {
            console.log('生成分析号码');
            if (this.historyData && this.historyData.length > 0) {
                // 分析最近30期数据
                const recentData = this.historyData.slice(0, 30);
                const digits = [[], [], []];
                
                // 统计每个位置的数字出现次数
                recentData.forEach(item => {
                    const nums = item.number.split('');
                    nums.forEach((num, i) => {
                        digits[i].push(parseInt(num));
                    });
                });
                
                // 计算每个位置的热号和冷号
                const hotCold = digits.map(pos => {
                    const freq = {};
                    pos.forEach(num => {
                        freq[num] = (freq[num] || 0) + 1;
                    });
                    
                    // 按出现次数排序
                    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
                    return {
                        hot: sorted.slice(0, 3).map(([num]) => parseInt(num)),
                        cold: sorted.slice(-3).map(([num]) => parseInt(num))
                    };
                });
                
                // 生成号码：70%概率选择热号，30%概率选择冷号
                const number = hotCold.map(pos => {
                    if (Math.random() < 0.7) {
                        return pos.hot[Math.floor(Math.random() * pos.hot.length)];
                    } else {
                        return pos.cold[Math.floor(Math.random() * pos.cold.length)];
                    }
                }).join('');
                
                this.displayNumber(number);
                this.addToMyPicks(number, '智能分析');
            } else {
                // 如果没有历史数据，生成随机号码
                this.generateRandomNumber();
            }
        } catch (error) {
            console.error('生成分析号码失败:', error);
            // 出错时生成随机号码
            this.generateRandomNumber();
        }
    }

    // 显示号码
    displayNumber(number) {
        try {
            console.log('显示号码:', number);
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
        } catch (error) {
            console.error('显示号码失败:', error);
        }
    }

    // 添加到我的选号记录
    addToMyPicks(number, method) {
        try {
            console.log('添加选号记录:', number, method);
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
        } catch (error) {
            console.error('添加选号记录失败:', error);
        }
    }

    // 显示我的选号记录
    displayMyPicks() {
        try {
            console.log('显示选号记录');
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
        } catch (error) {
            console.error('显示选号记录失败:', error);
        }
    }

    // 清空选号记录
    clearMyPicks() {
        try {
            console.log('清空选号记录');
            if (confirm('确定要清空所有选号记录吗？')) {
                this.myPicks = [];
                localStorage.removeItem('myPicks');
                this.displayMyPicks();
            }
        } catch (error) {
            console.error('清空选号记录失败:', error);
        }
    }

    // 填充选择器选项
    populateSelectOptions() {
        try {
            console.log('填充选择器选项');
            const selects = ['hundredsSelect', 'tensSelect', 'onesSelect'];
            selects.forEach(selectId => {
                const select = document.getElementById(selectId);
                if (select) {
                    for (let i = 0; i <= 9; i++) {
                        const option = document.createElement('option');
                        option.value = i;
                        option.textContent = i;
                        select.appendChild(option);
                    }
                }
            });
        } catch (error) {
            console.error('填充选择器选项失败:', error);
        }
    }

    // 初始化历史数据
    async initHistoryData() {
        try {
            console.log('初始化历史数据');
            // 设置分页参数
            this.fc3dCurrentPage = 1;
            this.ssqCurrentPage = 1;
            this.fc3dItemsPerPage = 20;
            this.ssqItemsPerPage = 20;
            
            // 从API获取数据
            await this.loadRealData();
            
            // 初始化筛选数据
            this.fc3dFilteredData = this.historyData;
            this.ssqFilteredData = this.ssqHistoryData;
            
            // 显示数据
            this.displayFc3dHistory();
            this.displaySsqHistory();
            
            console.log('历史数据初始化完成');
        } catch (error) {
            console.error('初始化历史数据失败:', error);
        }
    }

    // 加载真实数据
    async loadRealData() {
        try {
            console.log('正在获取真实彩票数据...');
            console.log('API地址:', this.apiBaseUrl);
            
            if (!this.apiBaseUrl) {
                throw new Error('API地址未配置');
            }
            
            // 先测试健康检查API
            try {
                const healthResponse = await fetch(`${this.apiBaseUrl}/api/health`);
                if (!healthResponse.ok) {
                    throw new Error(`健康检查失败: ${healthResponse.status}`);
                }
                const healthData = await healthResponse.json();
                console.log('健康检查结果:', healthData);
            } catch (error) {
                throw new Error(`服务器连接失败: ${error.message}`);
            }
            
            // 并行获取福彩3D和双色球数据
            const [fc3dData, ssqData] = await Promise.all([
                this.fetchFc3dData(),
                this.fetchSsqData()
            ]);
            
            if (fc3dData && fc3dData.length > 0) {
                this.historyData = fc3dData;
                console.log('福彩3D数据更新成功');
                this.dataSource = '真实API数据';
            } else {
                console.warn('未获取到福彩3D数据');
            }
            
            if (ssqData && ssqData.length > 0) {
                this.ssqHistoryData = ssqData;
                console.log('双色球数据更新成功');
                this.dataSource = '真实API数据';
            } else {
                console.warn('未获取到双色球数据');
            }
            
            this.updateLastUpdateTime();
            
        } catch (error) {
            console.error('获取真实数据失败:', error);
            this.dataSource = `数据获取失败: ${error.message}`;
        }
    }

    // 获取福彩3D数据
    async fetchFc3dData() {
        try {
            console.log('获取福彩3D数据');
            const response = await fetch(`${this.apiBaseUrl}/api/fc3d`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            if (result.success && result.data) {
                return result.data;
            }
            throw new Error('数据格式错误');
        } catch (error) {
            console.error('获取福彩3D数据失败:', error);
            return null;
        }
    }

    // 获取双色球数据
    async fetchSsqData() {
        try {
            console.log('获取双色球数据');
            const response = await fetch(`${this.apiBaseUrl}/api/ssq`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            if (result.success && result.data) {
                return result.data;
            }
            throw new Error('数据格式错误');
        } catch (error) {
            console.error('获取双色球数据失败:', error);
            return null;
        }
    }

    // 更新最后更新时间
    updateLastUpdateTime() {
        try {
            console.log('更新最后更新时间');
            const now = new Date();
            localStorage.setItem('lastDataUpdate', now.toISOString());
            
            const updateTimeElement = document.getElementById('lastUpdateTime');
            if (updateTimeElement) {
                updateTimeElement.textContent = now.toLocaleString('zh-CN');
            }
        } catch (error) {
            console.error('更新最后更新时间失败:', error);
        }
    }

    // 更新数据来源显示
    updateDataSourceDisplay() {
        try {
            console.log('更新数据来源显示:', this.dataSource);
            const dataSourceElement = document.getElementById('dataSource');
            if (dataSourceElement) {
                dataSourceElement.textContent = this.dataSource;
            }
        } catch (error) {
            console.error('更新数据来源显示失败:', error);
        }
    }

    // 更新最新开奖日期显示
    updateLatestDates() {
        try {
            console.log('更新最新开奖日期显示');
            // 更新福彩3D最新日期
            if (this.historyData && this.historyData.length > 0) {
                const fc3dLatest = this.historyData[0];
                const fc3dElement = document.getElementById('fc3dLatestDate');
                if (fc3dElement) {
                    fc3dElement.textContent = `最新: ${fc3dLatest.date} 第${fc3dLatest.period}期`;
                }
            }
            
            // 更新双色球最新日期
            if (this.ssqHistoryData && this.ssqHistoryData.length > 0) {
                const ssqLatest = this.ssqHistoryData[0];
                const ssqElement = document.getElementById('ssqLatestDate');
                if (ssqElement) {
                    ssqElement.textContent = `最新: ${ssqLatest.date} 第${ssqLatest.period}期`;
                }
            }
        } catch (error) {
            console.error('更新最新日期显示失败:', error);
        }
    }

    // 初始化双色球系统
    initSSQSystem() {
        try {
            console.log('初始化双色球系统');
            // 初始化显示
            this.displayRedBalls([0, 0, 0, 0, 0, 0]);
            this.displayBlueBall(0);
            
            // 更新分析数据
            if (this.ssqHistoryData && this.ssqHistoryData.length > 0) {
                this.updateSSQAnalysis();
            }
            
            // 显示选号记录
            this.displaySSQPicks();
            
            console.log('双色球系统初始化完成');
        } catch (error) {
            console.error('初始化双色球系统失败:', error);
        }
    }

    // 设置双色球事件监听器
    setupSSQEventListeners() {
        try {
            // 蓝球预测
            this.addEventListenerSafely('predictBlueBtn', 'click', () => {
                console.log('点击LSTM预测蓝球按钮');
                this.predictBlueBall();
            });

            this.addEventListenerSafely('randomBlueBtn', 'click', () => {
                console.log('点击随机蓝球按钮');
                this.generateRandomBlueBall();
            });

            // 红球生成
            this.addEventListenerSafely('generateRedBtn', 'click', () => {
                console.log('点击生成红球号码按钮');
                this.generateRedBalls();
            });

            this.addEventListenerSafely('smartRedBtn', 'click', () => {
                console.log('点击智能红球组合按钮');
                this.generateSmartRedBalls();
            });

            // 生成完整号码按钮已移除（若存在则兼容绑定）
            const generateCompleteBtn = document.getElementById('generateCompleteBtn');
            if (generateCompleteBtn) {
                generateCompleteBtn.addEventListener('click', () => {
                    this.generateCompleteSSQ();
                });
            }

            this.addEventListenerSafely('saveCompleteBtn', 'click', () => {
                console.log('点击保存号码按钮');
                this.saveCompleteSSQ();
            });

            console.log('双色球事件监听器设置完成');
        } catch (error) {
            console.error('设置双色球事件监听器时出错:', error);
        }
    }

    // 生成随机蓝球
    generateRandomBlueBall() {
        try {
            console.log('生成随机蓝球');
            const blueBall = Math.floor(Math.random() * 16) + 1;
            this.displayBlueBall(blueBall);
        } catch (error) {
            console.error('生成随机蓝球失败:', error);
        }
    }

    // 预测蓝球
    predictBlueBall() {
        try {
            console.log('预测蓝球');
            if (this.ssqHistoryData && this.ssqHistoryData.length > 0) {
                // 基于最近30期数据预测
                const recentBlueBalls = this.ssqHistoryData.slice(0, 30).map(item => item.blueBall);
                
                // 统计频率
                const freq = {};
                recentBlueBalls.forEach(ball => {
                    freq[ball] = (freq[ball] || 0) + 1;
                });
                
                // 按频率排序
                const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
                
                // 选择频率最高的前3个作为热号
                const hotBalls = sorted.slice(0, 3).map(([num]) => parseInt(num));
                document.getElementById('blueHotNumbers').textContent = hotBalls.join(', ');
                
                // 选择频率最低的前3个作为冷号
                const coldBalls = sorted.slice(-3).map(([num]) => parseInt(num));
                document.getElementById('blueColdNumbers').textContent = coldBalls.join(', ');
                
                // 从热号中随机选择一个
                const blueBall = hotBalls[Math.floor(Math.random() * hotBalls.length)];
                this.displayBlueBall(blueBall);
            } else {
                this.generateRandomBlueBall();
            }
        } catch (error) {
            console.error('预测蓝球失败:', error);
            this.generateRandomBlueBall();
        }
    }

    // 生成红球
    generateRedBalls() {
        try {
            console.log('生成红球');
            const redBalls = [];
            while (redBalls.length < 6) {
                const num = Math.floor(Math.random() * 33) + 1;
                if (!redBalls.includes(num)) {
                    redBalls.push(num);
                }
            }
            redBalls.sort((a, b) => a - b);
            this.displayRedBalls(redBalls);
        } catch (error) {
            console.error('生成红球失败:', error);
        }
    }

    // 智能红球组合
    generateSmartRedBalls() {
        try {
            console.log('智能红球组合');
            if (this.ssqHistoryData && this.ssqHistoryData.length > 0) {
                // 分析最近30期数据
                const recentData = this.ssqHistoryData.slice(0, 30);
                
                // 统计每个红球出现的次数
                const freq = {};
                for (let i = 1; i <= 33; i++) {
                    freq[i] = 0;
                }
                recentData.forEach(item => {
                    item.redBalls.forEach(ball => {
                        freq[ball]++;
                    });
                });
                
                // 按频率排序
                const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
                
                // 选择3个热号和3个冷号
                const hotBalls = sorted.slice(0, 10).map(([num]) => parseInt(num));
                const coldBalls = sorted.slice(-10).map(([num]) => parseInt(num));
                
                const redBalls = [];
                
                // 选择3个热号
                while (redBalls.length < 3) {
                    const ball = hotBalls[Math.floor(Math.random() * hotBalls.length)];
                    if (!redBalls.includes(ball)) {
                        redBalls.push(ball);
                    }
                }
                
                // 选择3个冷号
                while (redBalls.length < 6) {
                    const ball = coldBalls[Math.floor(Math.random() * coldBalls.length)];
                    if (!redBalls.includes(ball)) {
                        redBalls.push(ball);
                    }
                }
                
                redBalls.sort((a, b) => a - b);
                this.displayRedBalls(redBalls);
            } else {
                this.generateRedBalls();
            }
        } catch (error) {
            console.error('智能红球组合失败:', error);
            this.generateRedBalls();
        }
    }

    // 显示蓝球
    displayBlueBall(blueBall) {
        try {
            console.log('显示蓝球:', blueBall);
            document.getElementById('blueBall').textContent = blueBall;
            document.getElementById('completeBlue').textContent = blueBall;
            
            // 添加动画效果
            const blueBallElement = document.getElementById('blueBall');
            blueBallElement.style.animation = 'none';
            setTimeout(() => {
                blueBallElement.style.animation = 'fadeIn 0.5s ease-in-out';
            }, 10);
        } catch (error) {
            console.error('显示蓝球失败:', error);
        }
    }

    // 显示红球
    displayRedBalls(redBalls) {
        try {
            console.log('显示红球:', redBalls);
            for (let i = 0; i < 6; i++) {
                document.getElementById(`redBall${i + 1}`).textContent = redBalls[i];
                document.getElementById(`completeRed${i + 1}`).textContent = redBalls[i];
                
                // 添加动画效果
                const element = document.getElementById(`redBall${i + 1}`);
                element.style.animation = 'none';
                setTimeout(() => {
                    element.style.animation = 'fadeIn 0.3s ease-in-out';
                }, i * 100);
            }
        } catch (error) {
            console.error('显示红球失败:', error);
        }
    }

    // 保存完整双色球号码
    saveCompleteSSQ() {
        try {
            console.log('保存双色球号码');
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
        } catch (error) {
            console.error('保存双色球号码失败:', error);
        }
    }

    // 显示双色球选号记录
    displaySSQPicks() {
        try {
            console.log('显示双色球选号记录');
            const picksList = document.getElementById('picksList');
            
            if (this.ssqPicks.length === 0) {
                return;
            }
            
            const ssqHtml = this.ssqPicks.map(pick => `
                <div class="pick-item">
                    <div>
                        <div class="pick-number">
                            ${pick.redBalls.join(' ')} + ${pick.blueBall}
                        </div>
                        <div class="pick-method">${pick.method}</div>
                    </div>
                    <div class="pick-time">${pick.time}</div>
                </div>
            `).join('');
            
            if (this.myPicks.length === 0) {
                picksList.innerHTML = ssqHtml;
            } else {
                picksList.innerHTML += ssqHtml;
            }
        } catch (error) {
            console.error('显示双色球选号记录失败:', error);
        }
    }

    // 显示双色球历史数据
    displaySsqHistory() {
        try {
            console.log('显示双色球历史数据');
            if (!this.ssqHistoryData || this.ssqHistoryData.length === 0) {
                return;
            }

            // 使用已筛选的数据
            let data = this.ssqFilteredData || this.ssqHistoryData;

            // 计算分页
            const totalPages = Math.ceil(data.length / this.ssqItemsPerPage);
            const start = (this.ssqCurrentPage - 1) * this.ssqItemsPerPage;
            const end = start + this.ssqItemsPerPage;
            const pageData = data.slice(start, end);

            // 生成表格HTML
            const tbody = document.getElementById('ssqHistoryBody');
            tbody.innerHTML = pageData.map(item => `
                <tr>
                    <td>${item.period}</td>
                    <td>${item.date}</td>
                    <td class="red-balls">${item.redBalls.join(' ')}</td>
                    <td class="blue-ball">${item.blueBall}</td>
                    <td>${item.redSum}</td>
                    <td>${item.redOddCount}:${item.redEvenCount}</td>
                    <td>${item.redBigCount}:${item.redSmallCount}</td>
                </tr>
            `).join('');

            // 更新分页信息
            document.getElementById('ssqPageInfo').textContent = `第 ${this.ssqCurrentPage} 页，共 ${totalPages} 页`;

            // 更新分页按钮状态
            document.getElementById('ssqPrevPage').disabled = this.ssqCurrentPage === 1;
            document.getElementById('ssqNextPage').disabled = this.ssqCurrentPage === totalPages;

            console.log('双色球历史数据显示完成');
        } catch (error) {
            console.error('显示双色球历史数据失败:', error);
        }
    }

    // 更新双色球分析数据
    updateSSQAnalysis() {
        try {
            console.log('更新双色球分析数据');
            if (!this.ssqHistoryData || this.ssqHistoryData.length === 0) {
                return;
            }

            // 分析最近30期数据
            const recentData = this.ssqHistoryData.slice(0, 30);

            // 统计红球数据
            const redFreq = {};
            for (let i = 1; i <= 33; i++) {
                redFreq[i] = 0;
            }
            let redSumMin = Infinity;
            let redSumMax = -Infinity;
            let totalRedOdd = 0;
            let totalRedEven = 0;
            let totalRedBig = 0;
            let totalRedSmall = 0;

            recentData.forEach(item => {
                // 更新红球频率
                item.redBalls.forEach(ball => {
                    redFreq[ball]++;
                });

                // 更新和值范围
                const sum = item.redSum;
                redSumMin = Math.min(redSumMin, sum);
                redSumMax = Math.max(redSumMax, sum);

                // 更新奇偶、大小统计
                totalRedOdd += item.redOddCount;
                totalRedEven += item.redEvenCount;
                totalRedBig += item.redBigCount;
                totalRedSmall += item.redSmallCount;
            });

            // 统计蓝球数据
            const blueFreq = {};
            for (let i = 1; i <= 16; i++) {
                blueFreq[i] = 0;
            }
            recentData.forEach(item => {
                blueFreq[item.blueBall]++;
            });

            // 更新显示
            // 1. 红球分析
            document.getElementById('redSumRange').textContent = `${redSumMin}-${redSumMax}`;
            document.getElementById('redOddEven').textContent = `${(totalRedOdd / (totalRedOdd + totalRedEven) * 100).toFixed(1)}%`;
            document.getElementById('redBigSmall').textContent = `${(totalRedBig / (totalRedBig + totalRedSmall) * 100).toFixed(1)}%`;

            // 2. 蓝球分析
            const sortedBlueFreq = Object.entries(blueFreq).sort((a, b) => b[1] - a[1]);
            const blueHot = sortedBlueFreq.slice(0, 3).map(([num]) => num).join(', ');
            const blueCold = sortedBlueFreq.slice(-3).map(([num]) => num).join(', ');
            document.getElementById('blueHotNumbers').textContent = blueHot;
            document.getElementById('blueColdNumbers').textContent = blueCold;

            // 3. 更新最新期号显示
            const latestSSQ = this.ssqHistoryData[0];
            if (latestSSQ) {
                document.getElementById('ssqLatestDate').textContent = `最新：${latestSSQ.period}期 (${latestSSQ.date})`;
            }

            console.log('双色球分析数据更新完成');
        } catch (error) {
            console.error('更新双色球分析数据失败:', error);
        }
    }

    // 设置往期数据事件监听器
    setupHistoryEventListeners() {
        try {
            console.log('设置往期数据事件监听器');
            
            // 标签页切换
            document.querySelectorAll('.history-tabs .tab-btn').forEach(btn => {
                if (btn) {
                    btn.addEventListener('click', (e) => {
                        console.log('点击历史数据标签页:', e.target.dataset.tab);
                        this.switchTab(e.target.dataset.tab);
                    });
                }
            });

            // 福彩3D历史数据相关
            this.addEventListenerSafely('searchFc3dBtn', 'click', () => {
                const period = document.getElementById('fc3dPeriodSearch').value;
                this.searchFc3dHistory(period);
            });

            this.addEventListenerSafely('showAllFc3dBtn', 'click', () => {
                document.getElementById('fc3dPeriodSearch').value = '';
                this.showAllFc3dHistory();
            });

            const fc3dPeriodFilter = document.getElementById('fc3dPeriodFilter');
            if (fc3dPeriodFilter) {
                fc3dPeriodFilter.addEventListener('change', () => {
                    this.filterFc3dHistory();
                });
            }

            this.addEventListenerSafely('fc3dPrevPage', 'click', () => {
                if (this.fc3dCurrentPage > 1) {
                    this.fc3dCurrentPage--;
                    this.displayFc3dHistory();
                }
            });

            this.addEventListenerSafely('fc3dNextPage', 'click', () => {
                const totalPages = Math.ceil(this.historyData.length / this.fc3dItemsPerPage);
                if (this.fc3dCurrentPage < totalPages) {
                    this.fc3dCurrentPage++;
                    this.displayFc3dHistory();
                }
            });

            // 双色球历史数据相关
            this.addEventListenerSafely('searchSsqBtn', 'click', () => {
                const period = document.getElementById('ssqPeriodSearch').value;
                this.searchSsqHistory(period);
            });

            this.addEventListenerSafely('showAllSsqBtn', 'click', () => {
                document.getElementById('ssqPeriodSearch').value = '';
                this.showAllSsqHistory();
            });

            const ssqPeriodFilter = document.getElementById('ssqPeriodFilter');
            if (ssqPeriodFilter) {
                ssqPeriodFilter.addEventListener('change', () => {
                    this.filterSsqHistory();
                });
            }

            this.addEventListenerSafely('ssqPrevPage', 'click', () => {
                if (this.ssqCurrentPage > 1) {
                    this.ssqCurrentPage--;
                    this.displaySsqHistory();
                }
            });

            this.addEventListenerSafely('ssqNextPage', 'click', () => {
                const totalPages = Math.ceil(this.ssqHistoryData.length / this.ssqItemsPerPage);
                if (this.ssqCurrentPage < totalPages) {
                    this.ssqCurrentPage++;
                    this.displaySsqHistory();
                }
            });

            console.log('往期数据事件监听器设置完成');
        } catch (error) {
            console.error('设置往期数据事件监听器失败:', error);
        }
    }

    // 切换历史数据标签页
    switchTab(tab) {
        try {
            console.log('切换历史数据标签页:', tab);
            // 更新标签页按钮状态
            document.querySelectorAll('.history-tabs .tab-btn').forEach(btn => {
                if (btn.dataset.tab === tab) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            // 更新内容区域显示
            document.querySelectorAll('.tab-content').forEach(content => {
                if (content.id === tab) {
                    content.classList.add('active');
                    // 显示对应的数据
                    if (tab === 'fc3d-history') {
                        this.displayFc3dHistory();
                    } else if (tab === 'ssq-history') {
                        this.displaySsqHistory();
                    }
                } else {
                    content.classList.remove('active');
                }
            });
        } catch (error) {
            console.error('切换历史数据标签页失败:', error);
        }
    }

    // 显示福彩3D历史数据
    displayFc3dHistory() {
        try {
            console.log('显示福彩3D历史数据');
            if (!this.historyData || this.historyData.length === 0) {
                return;
            }

            // 获取筛选条件
            const filter = document.getElementById('fc3dPeriodFilter').value;
            let data = this.historyData;
            if (filter !== 'all') {
                data = data.slice(0, parseInt(filter));
            }

            // 计算分页
            const totalPages = Math.ceil(data.length / this.fc3dItemsPerPage);
            const start = (this.fc3dCurrentPage - 1) * this.fc3dItemsPerPage;
            const end = start + this.fc3dItemsPerPage;
            const pageData = data.slice(start, end);

            // 生成表格HTML
            const tbody = document.getElementById('fc3dHistoryBody');
            tbody.innerHTML = pageData.map(item => `
                <tr>
                    <td>${item.period}</td>
                    <td>${item.date}</td>
                    <td>${item.number}</td>
                    <td>${item.sum}</td>
                    <td>${item.span}</td>
                    <td>${item.oddCount}:${item.evenCount}</td>
                    <td>${item.bigCount}:${item.smallCount}</td>
                </tr>
            `).join('');

            // 更新分页信息
            document.getElementById('fc3dPageInfo').textContent = `第 ${this.fc3dCurrentPage} 页，共 ${totalPages} 页`;

            // 更新分页按钮状态
            document.getElementById('fc3dPrevPage').disabled = this.fc3dCurrentPage === 1;
            document.getElementById('fc3dNextPage').disabled = this.fc3dCurrentPage === totalPages;

            console.log('福彩3D历史数据显示完成');
        } catch (error) {
            console.error('显示福彩3D历史数据失败:', error);
        }
    }

    // 搜索福彩3D历史数据
    searchFc3dHistory(period) {
        try {
            console.log('搜索福彩3D历史数据:', period);
            if (!period) {
                this.showAllFc3dHistory();
                return;
            }

            const filteredData = this.historyData.filter(item => 
                item.period.includes(period)
            );

            if (filteredData.length > 0) {
                this.fc3dFilteredData = filteredData;
                this.fc3dCurrentPage = 1;
                this.displayFc3dHistory();
            } else {
                alert('未找到匹配的期号');
            }
        } catch (error) {
            console.error('搜索福彩3D历史数据失败:', error);
        }
    }

    // 显示所有福彩3D历史数据
    showAllFc3dHistory() {
        try {
            console.log('显示所有福彩3D历史数据');
            this.fc3dFilteredData = this.historyData;
            this.fc3dCurrentPage = 1;
            this.displayFc3dHistory();
        } catch (error) {
            console.error('显示所有福彩3D历史数据失败:', error);
        }
    }

    // 筛选福彩3D历史数据
    filterFc3dHistory() {
        try {
            console.log('筛选福彩3D历史数据');
            const filter = document.getElementById('fc3dPeriodFilter').value;
            let data = this.historyData;
            if (filter !== 'all') {
                data = data.slice(0, parseInt(filter));
            }
            this.fc3dFilteredData = data;
            this.fc3dCurrentPage = 1;
            this.displayFc3dHistory();
        } catch (error) {
            console.error('筛选福彩3D历史数据失败:', error);
        }
    }

    // 搜索双色球历史数据
    searchSsqHistory(period) {
        try {
            console.log('搜索双色球历史数据:', period);
            if (!period) {
                this.showAllSsqHistory();
                return;
            }

            const filteredData = this.ssqHistoryData.filter(item => 
                item.period.includes(period)
            );

            if (filteredData.length > 0) {
                this.ssqFilteredData = filteredData;
                this.ssqCurrentPage = 1;
                this.displaySsqHistory();
            } else {
                alert('未找到匹配的期号');
            }
        } catch (error) {
            console.error('搜索双色球历史数据失败:', error);
        }
    }

    // 显示所有双色球历史数据
    showAllSsqHistory() {
        try {
            console.log('显示所有双色球历史数据');
            this.ssqFilteredData = this.ssqHistoryData;
            this.ssqCurrentPage = 1;
            this.displaySsqHistory();
        } catch (error) {
            console.error('显示所有双色球历史数据失败:', error);
        }
    }

    // 筛选双色球历史数据
    filterSsqHistory() {
        try {
            console.log('筛选双色球历史数据');
            const filter = document.getElementById('ssqPeriodFilter').value;
            let data = this.ssqHistoryData;
            if (filter !== 'all') {
                data = data.slice(0, parseInt(filter));
            }
            this.ssqFilteredData = data;
            this.ssqCurrentPage = 1;
            this.displaySsqHistory();
        } catch (error) {
            console.error('筛选双色球历史数据失败:', error);
        }
    }

    // 设置扫码验奖相关功能
    setupScanValidate() {
        try {
            console.log('设置扫码验奖功能');
            // 扫码验奖功能现在由独立的ScanValidate类处理
            // 这里只做一些基本的状态检查
            this.scanValidateAvailable = true;
            console.log('扫码验奖功能已就绪');
        } catch (error) {
            console.error('设置扫码验奖功能失败:', error);
        }
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

// ===== 扫码验奖功能实现 =====

class ScanValidate {
    constructor() {
        this.cameraActive = false;
        this.stream = null;
        this.updateStatusDelay = 1000; // 延迟初始化UI
        setTimeout(() => this.initScanValidateUI(), this.updateStatusDelay);
    }

    async initScanValidateUI() {
        try {
            console.log('初始化扫码验奖界面...');
            
            // 等待DOM元素创建完成
            await this.waitForElement('scanLotteryType');
            
            // 设置事件监听器
            this.setupScanEventListeners();
            
            // 初始化彩种选择
            this.switchLotteryType('ssq');
            
            console.log('扫码验奖界面初始化完成');
        } catch (error) {
            console.error('扫码验奖界面初始化失败:', error);
        }
    }

    async waitForElement(elementId, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkElement = () => {
                if (document.getElementById(elementId)) {
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error(`元素 ${elementId} 未找到`));
                } else {
                    setTimeout(checkElement, 100);
                }
            };
            checkElement();
        });
    }

    setupScanEventListeners() {
        try {
            // 彩种切换
            const lotteryTypeSelect = document.getElementById('scanLotteryType');
            if (lotteryTypeSelect) {
                lotteryTypeSelect.addEventListener('change', (e) => {
                    this.switchLotteryType(e.target.value);
                });
            }

            // 摄像头控制
            this.addEventListenerScan('startCameraBtn', 'click', () => this.startCamera());
            this.addEventListenerScan('stopCameraBtn', 'click', () => this.stopCamera());
            this.addEventListenerScan('captureBtn', 'click', () => this.captureAndOCR());
            
            // 文件输入
            const ticketImageInput = document.getElementById('ticketImage');
            if (ticketImageInput) {
                ticketImageInput.addEventListener('change', (e) => this.handleFileUpload(e));
            }

            // OCR识别按钮
            this.addEventListenerScan('ocrBtn', 'click', () => this.performOCR());

            // 验证按钮
            this.addEventListenerScan('validateBtn', 'click', () => this.validateTicket());

            console.log('扫码验证事件监听器设置完成');
        } catch (error) {
            console.error('设置扫码验证事件监听器失败:', error);
        }
    }

    addEventListenerScan(elementId, eventType, handler) {
        try {
            const element = document.getElementById(elementId);
            if (element && handler) {
                element.addEventListener(eventType, handler);
                console.log(`成功为 ${elementId} 添加 ${eventType} 事件监听器`);
            } else if (element && eventType === 'click') {
                // 如果是OCR按钮点击事件
                element.addEventListener('click', () => this.performOCR());
                console.log(`为 ${elementId} 添加默认点击事件监听器`);
            }
        } catch (error) {
            console.error(`为 ${elementId} 添加事件监听器失败:`, error);
        }
    }

    switchLotteryType(type) {
        try {
            console.log('切换彩种类型:', type);
            const ssqCorrect = document.getElementById('ssqCorrect');
            const fc3dCorrect = document.getElementById('fc3dCorrect');
            
            if (ssqCorrect && fc3dCorrect) {
                if (type === 'ssq') {
                    ssqCorrect.style.display = 'block';
                    fc3dCorrect.style.display = 'none';
                } else {
                    ssqCorrect.style.display = 'none';
                    fc3dCorrect.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('切换彩种类型失败:', error);
        }
    }

    async startCamera() {
        try {
            console.log('启动摄像头...');
            this.updateCameraStatus('正在启动摄像头...');

            const video = document.getElementById('cameraVideo');
            const startBtn = document.getElementById('startCameraBtn');
            const stopBtn = document.getElementById('stopCameraBtn');
            const captureBtn = document.getElementById('captureBtn');

            const constraints = {
                video: {
                    facingMode: 'environment', // 使用后置摄像头
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = this.stream;
            video.style.display = 'block';
            
            // 显示控制按钮
            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-block';
            captureBtn.style.display = 'inline-block';
            
            this.cameraActive = true;
            this.updateCameraStatus('摄像头已启动，请对准彩票票面');

            console.log('摄像头启动成功');
        } catch (error) {
            console.error('摄像头启动失败:', error);
            let errorMessage = '摄像头启动失败: ';
            
            if (error.name === 'NotAllowedError') {
                errorMessage += '请允许访问摄像头权限';
            } else if (error.name === 'NotFoundError') {
                errorMessage += '未找到摄像头设备';
            } else {
                errorMessage += error.message;
            }
            
            this.updateCameraStatus(errorMessage);
            alert(errorMessage);
        }
    }

    stopCamera() {
        try {
            console.log('关闭摄像头...');
            
            const video = document.getElementById('cameraVideo');
            const startBtn = document.getElementById('startCameraBtn');
            const stopBtn = document.getElementById('stopCameraBtn');
            const captureBtn = document.getElementById('captureBtn');

            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }

            video.style.display = 'none';
            video.srcObject = null;
            
            // 隐藏控制按钮
            startBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
            captureBtn.style.display = 'none';
            
            this.cameraActive = false;
            this.updateCameraStatus('摄像头已关闭');

            console.log('摄像头关闭成功');
        } catch (error) {
            console.error('关闭摄像头失败:', error);
        }
    }

    async captureAndOCR() {
        try {
            console.log('拍照并进行OCR识别...');
            this.updateCameraStatus('正在拍照...');

            const video = document.getElementById('cameraVideo');
            const canvas = document.getElementById('cameraCanvas');
            const previewImg = document.getElementById('ticketPreview');

            // 设置canvas尺寸
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // 绘制视频帧到canvas
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);

            // 转换为图片
            const dataURL = canvas.toDataURL('image/png');
            previewImg.src = dataURL;
            previewImg.style.display = 'block';

            this.updateCameraStatus('拍照完成，正在进行OCR识别...');

            // 执行OCR识别
            await this.performOCR(dataURL);

        } catch (error) {
            console.error('拍照OCR失败:', error);
            this.updateCameraStatus('拍照失败: ' + error.message);
        }
    }

    handleFileUpload(event) {
        try {
            const file = event.target.files[0];
            if (!file) return;

            console.log('处理文件上传:', file.name);
            this.updateCameraStatus('正在加载图片...');

            const reader = new FileReader();
            reader.onload = async (e) => {
                const previewImg = document.getElementById('ticketPreview');
                previewImg.src = e.target.result;
                previewImg.style.display = 'block';
                
                await this.performOCR(e.target.result);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('文件处理失败:', error);
            this.updateCameraStatus('文件处理失败: ' + error.message);
        }
    }

    async performOCR(imageData = null) {
        try {
            console.log('开始OCR识别...');
            this.updateCameraStatus('正在进行OCR文字识别...');

            let img = imageData;
            if (!img) {
                const previewImg = document.getElementById('ticketPreview');
                if (!previewImg.src) {
                    throw new Error('请先上传图片或使用摄像头拍照');
                }
                img = previewImg.src;
            }

            // 使用Tesseract.js进行OCR识别
            const worker = Tesseract.createWorker({
                logger: m => console.log('OCR进展:', m)
            });

            await worker.load();
            await worker.loadLanguage('chi_sim+eng'); // 加载中文简体+英文
            await worker.initialize('chi_sim+eng');

            const { data: { text } } = await worker.recognize(img);
            
            await worker.terminate();

            // 显示OCR结果
            this.displayOCRResult(text);
            
            // 自动解析号码
            this.parseLotteryNumbers(text);
            
            this.updateCameraStatus('OCR识别完成');

            console.log('OCR识别成功:', text);
        } catch (error) {
            console.error('OCR识别失败:', error);
            this.updateCameraStatus('OCR识别失败: ' + error.message);
        }
    }

    displayOCRResult(text) {
        try {
            const ocrResult = document.getElementById('ocrResult');
            const rawOcrText = document.getElementById('rawOcrText');
            
            if (ocrResult && rawOcrText) {
                ocrResult.style.display = 'block';
                rawOcrText.textContent = text || '未识别到文字';
            }
        } catch (error) {
            console.error('显示OCR结果失败:', error);
        }
    }

    parseLotteryNumbers(text) {
        try {
            console.log('解析彩票号码...');
            
            const lotteryType = document.getElementById('scanLotteryType').value;
            
            if (lotteryType === 'ssq') {
                this.parseSSQNumbers(text);
            } else {
                this.parseFC3DNumbers(text);
            }
        } catch (error) {
            console.error('解析彩票号码失败:', error);
        }
    }

    parseSSQNumbers(text) {
        try {
            // 解析双色球号码
            const periodMatch = text.match(/(\d{7})/);
            if (periodMatch) {
                document.getElementById('scanPeriod').value = periodMatch[1];
            }

            // 解析红球号码
            const redMatches = text.match(/\b([1-3]?[0-9])\b/g);
            if (redMatches && redMatches.length >= 6) {
                const redNumbers = redMatches.slice(0, 6).map(num => parseInt(num).toString().padStart(2, '0'));
                redNumbers.forEach((num, index) => {
                    const input = document.getElementById(`scanRed${index + 1}`);
                    if (input) input.value = num;
                });
            }

            // 解析蓝球号码
            const blueMatch = text.match(/\b([1-9]|[1-2][0-6])\b/);
            if (blueMatch) {
                document.getElementById('scanBlue').value = blueMatch[1].padStart(2, '0');
            }

            console.log('双色球号码解析完成');
        } catch (error) {
            console.error('解析双色球号码失败:', error);
        }
    }

    parseFC3DNumbers(text) {
        try {
            // 解析福彩3D期号
            const periodMatch = text.match(/(\d{7})/);
            if (periodMatch) {
                document.getElementById('scan3dPeriod').value = periodMatch[1];
            }

            // 解析福彩3D号码
            const fc3dMatch = text.match(/(\d{3})/);
            if (fc3dMatch) {
                document.getElementById('scan3d').value = fc3dMatch[1];
            }

            console.log('福彩3D号码解析完成');
        } catch (error) {
            console.error('解析福彩3D号码失败:', error);
        }
    }

    async validateTicket() {
        try {
            console.log('验证彩票中奖情况...');
            
            const lotteryType = document.getElementById('scanLotteryType').value;
            let result = null;

            if (lotteryType === 'ssq') {
                result = await this.validateSSQTicket();
            } else {
                result = await this.validateFC3DTicket();
            }

            this.displayValidationResult(result);

        } catch (error) {
            console.error('验证彩票失败:', error);
            this.displayValidationResult({
                success: false,
                message: '验证失败: ' + error.message
            });
        }
    }

    async validateSSQTicket() {
        try {
            const period = document.getElementById('scanPeriod').value;
            const redBalls = [];
            for (let i = 1; i <= 6; i++) {
                const red = document.getElementById(`scanRed${i}`).value;
                if (red) redBalls.push(parseInt(red));
            }
            const blueBall = parseInt(document.getElementById('scanBlue').value);

            if (!period || redBalls.length !== 6 || !blueBall) {
                throw new Error('请填写完整的双色球号码信息');
            }

            // 检查当前历史数据中是否有对应的开奖结果
            const historyData = window.lotterySystem.ssqHistoryData;
            if (!historyData || historyData.length === 0) {
                throw new Error('当前无历史数据，无法验证');
            }

            const drawData = historyData.find(item => item.period === period);
            if (!drawData) {
                return {
                    success: false,
                    message: `未找到第${period}期的开奖记录`,
                    isDrawFound: false
                };
            }

            // 检查中奖情况
            const matchingReds = redBalls.filter(ball => drawData.redBalls.includes(ball)).length;
            const matchingBlue = blueBall === drawData.blueBall;

            let prize = '未中奖';
            let resultMessage = `第${period}期开奖号码: ${drawData.redBalls.join(' ')} + ${drawData.blueBall}`;

            if (matchingReds === 6 && matchingBlue) {
                prize = '一等奖 (6红+1蓝)';
            } else if (matchingReds === 6 && !matchingBlue) {
                prize = '二等奖 (6红+0蓝)';
            } else if (matchingReds === 5 && matchingBlue) {
                prize = '三等奖 (5红+1蓝)';
            } else if (matchingReds === 5 || (matchingReds === 4 && matchingBlue)) {
                prize = '四等奖';
            } else if (matchingReds === 4 || (matchingReds === 3 && matchingBlue)) {
                prize = '五等奖';
            } else if (matchingBlue || matchingReds >= 4) {
                prize = '六等奖';
            }

            return {
                success: true,
                lotteryType: '双色球',
                period: period,
                drawInfo: drawData,
                resultMessage: resultMessage,
                prize: prize,
                matchingReds: matchingReds,
                matchingBlue: matchingBlue
            };

        } catch (error) {
            console.error('双色球验证失败:', error);
            throw error;
        }
    }

    async validateFC3DTicket() {
        try {
            const period = document.getElementById('scan3dPeriod').value;
            const number = document.getElementById('scan3d').value;

            if (!period || !number || number.length !== 3) {
                throw new Error('请填写完整的福彩3D号码信息');
            }

            // 检查当前历史数据中是否有对应的开奖结果
            const historyData = window.lotterySystem.historyData;
            if (!historyData || historyData.length === 0) {
                throw new Error('当前无历史数据，无法验证');
            }

            const drawData = historyData.find(item => item.period === period);
            if (!drawData) {
                return {
                    success: false,
                    message: `未找到第${period}期的开奖记录`,
                    isDrawFound: false
                };
            }

            // 检查中奖情况
            let prize = '未中奖';
            let resultMessage = `第${period}期开奖号码: ${drawData.number}`;

            if (number === drawData.number) {
                prize = '直选 (顺序完全相同)';
            } else {
                const inputDigits = number.split('').map(d => parseInt(d)).sort();
                const drawDigits = drawData.number.split('').map(d => parseInt(d)).sort();
                
                if (inputDigits.join('') === drawDigits.join('')) {
                    prize = '组选 (数字相同但顺序不同)';
                }
            }

            return {
                success: true,
                lotteryType: '福彩3D',
                period: period,
                drawInfo: drawData,
                resultMessage: resultMessage,
                prize: prize,
                userNumber: number,
                drawNumber: drawData.number
            };

        } catch (error) {
            console.error('福彩3D验证失败:', error);
            throw error;
        }
    }

    displayValidationResult(result) {
        try {
            const resultDiv = document.getElementById('validateResult');
            const detailsDiv = document.getElementById('resultDetails');
            
            if (!resultDiv || !detailsDiv) return;

            if (!result.success) {
                detailsDiv.innerHTML = `
                    <div style="color: #d32f2f; font-weight: bold;">
                        ❌ ${result.message}
                    </div>
                `;
            } else {
                const color = result.prize === '未中奖' ? '#666' : '#1976d2';
                detailsDiv.innerHTML = `
                    <div style="font-size: 16px; font-weight: bold; color: ${color}; margin-bottom: 10px;">
                        ${result.prize === '未中奖' ? '😔' : '🎉'} ${result.prize}
                    </div>
                    <div style="margin-bottom: 8px;">
                        <strong>${result.resultMessage}</strong>
                    </div>
                    <div style="font-size: 14px; color: #666;">
                        ${result.lotteryType} / 第${result.period}期
                    </div>
                `;
            }

            resultDiv.style.display = 'block';

        } catch (error) {
            console.error('显示验证结果失败:', error);
        }
    }

    updateCameraStatus(message) {
        try {
            const statusElement = document.getElementById('cameraStatus');
            if (statusElement) {
                statusElement.textContent = message;
                console.log('摄像头状态:', message);
            }
        } catch (error) {
            console.error('更新摄像头状态失败:', error);
        }
    }
}

// 初始化扫码验证系统
let scanValidateSystem = null;
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        try {
            scanValidateSystem = new ScanValidate();
            window.scanValidateSystem = scanValidateSystem; // 暴露到全局便于调试
        } catch (error) {
            console.error('扫码验证系统初始化失败:', error);
        }
    }, 2000); // 延迟2秒确保其他组件初始化完成
});