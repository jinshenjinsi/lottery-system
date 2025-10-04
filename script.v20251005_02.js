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