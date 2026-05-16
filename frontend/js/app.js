/**
 * APS 智能排产演示系统 - 主应用逻辑
 */
const App = (() => {
    // ==============================
    // 状态管理
    // ==============================
    const state = {
        currentPage: 'dashboard',
        sidebarCollapsed: false,
        scheduleResultId: null,
        scheduleData: null,
        ganttChart: null,
        optimizing: false,
        importedFileCount: 0,
    };

    // ==============================
    // 工具函数
    // ==============================
    function toast(message, type = 'info', duration = 3500) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle',
        };

        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `
            <i class="fas ${icons[type] || icons.info}"></i>
            <span class="toast-msg">${message}</span>
            <button class="toast-close" onclick="App.dismissToast(this.parentElement)">&times;</button>
        `;
        container.appendChild(el);

        setTimeout(() => {
            el.classList.add('removing');
            setTimeout(() => el.remove(), 300);
        }, duration);
    }

    function dismissToast(el) {
        el.classList.add('removing');
        setTimeout(() => el.remove(), 300);
    }

    function showModal(title, bodyHtml, footerHtml, large) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        overlay.innerHTML = `
            <div class="modal ${large ? 'modal-lg' : ''}">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">${bodyHtml}</div>
                ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    function formatDate(d) {
        if (!d) return '-';
        if (d instanceof Date) return d.toLocaleDateString('zh-CN');
        return d;
    }

    function getAttrColor(attr) {
        const colors = {
            '精密A1': '#FF6B00', '精密A2': '#409EFF', '精密A3': '#2D8C5A', '精密A4': '#E6A23C',
            '标准B1': '#909399', '标准B2': '#FF6B00', '标准B3': '#F56C6C', '标准B4': '#409EFF',
        };
        return colors[attr] || '#909399';
    }

    function getStatusBadge(status) {
        const map = {
            0: { text: '待排产', cls: 'badge-gray' },
            1: { text: '已排产', cls: 'badge-blue' },
            2: { text: '生产中', cls: 'badge-orange' },
            3: { text: '已完成', cls: 'badge-green' },
            4: { text: '已取消', cls: 'badge-red' },
        };
        const s = map[status] || map[0];
        return `<span class="badge ${s.cls}">${s.text}</span>`;
    }

    function getPriorityBadge(p) {
        if (p <= 2) return `<span class="badge badge-red">高</span>`;
        if (p <= 4) return `<span class="badge badge-orange">中</span>`;
        return `<span class="badge badge-gray">普通</span>`;
    }

    function getPriorityColor(p) {
        if (p <= 2) return '#F56C6C';
        if (p <= 4) return '#E6A23C';
        return '#909399';
    }

    // ==============================
    // 导航系统
    // ==============================
    function navigate(page) {
        state.currentPage = page;

        // Update nav items
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.page === page);
        });

        // Update page title
        const titles = {
            'dashboard': '总览看板',
            'employees': '人员管理',
            'equipment': '设备管理',
            'materials': '物料管理',
            'methods': '工法管理',
            'orders': 'ERP订单管理',
            'urgent': '加急订单',
            'mes-lines': 'MES产线管理',
            'schedule': '排产计划',
            'safety': '安全管理',
            'quality': '质量监控',
            'anomaly': '异常管理',
            'charts': '数据可视化',
            'sys-config': '系统配置',
            'sys-users': '用户管理',
            'sys-security': '安全管理',
            'sys-compliance': '行为合规',
            'sys-logs': '日志管理',
        };
        document.getElementById('page-title').textContent = titles[page] || '总览看板';

        renderPage(page);
    }

    function toggleSidebar() {
        state.sidebarCollapsed = !state.sidebarCollapsed;
        document.querySelector('.sidebar').classList.toggle('collapsed', state.sidebarCollapsed);
    }

    // ==============================
    // 页面渲染
    // ==============================
    const contentEl = () => document.getElementById('page-content');

    function renderPage(page) {
        const el = contentEl();
        switch (page) {
            case 'dashboard': renderDashboard(el); break;
            case 'schedule': renderSchedule(el); break;
            case 'orders': renderOrders(el); break;
            case 'urgent': renderUrgent(el); break;
            case 'employees': renderEmployees(el); break;
            case 'equipment': renderEquipment(el); break;
            case 'materials': renderMaterials(el); break;
            case 'methods': renderMethods(el); break;
            case 'mes-lines': renderMesLines(el); break;
            case 'safety': renderSafety(el); break;
            case 'quality': renderQuality(el); break;
            case 'anomaly': renderAnomaly(el); break;
            case 'charts': renderCharts(el); break;
            case 'sys-config': renderSysConfig(el); break;
            case 'sys-users': renderSysUsers(el); break;
            case 'sys-security': renderSysSecurity(el); break;
            case 'sys-compliance': renderSysCompliance(el); break;
            case 'sys-logs': renderSysLogs(el); break;
            default: renderDashboard(el);
        }
    }

    // ========================
    // 仪表盘 (Dashboard)
    // ========================
    async function renderDashboard(el) {
        el.innerHTML = `
            <div class="page-header">
                <div>
                    <h1>总览看板</h1>
                    <div class="subtitle">生产运营核心指标一览</div>
                </div>
                <div>
                    <button class="btn btn-outline" onclick="App.refreshDashboard()">
                        <i class="fas fa-sync-alt"></i> 刷新数据
                    </button>
                </div>
            </div>

            <div class="grid-4 mb-16" id="dash-stats">
                <div class="stat-card"><div class="spinner" style="margin:20px auto"></div></div>
                <div class="stat-card"><div class="spinner" style="margin:20px auto"></div></div>
                <div class="stat-card"><div class="spinner" style="margin:20px auto"></div></div>
                <div class="stat-card"><div class="spinner" style="margin:20px auto"></div></div>
            </div>

            <div class="grid-2 mb-16">
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">订单达成率趋势</div>
                            <div class="card-subtitle">近12个月</div>
                        </div>
                    </div>
                    <div class="chart-container" id="chart-orders"></div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">设备 OEE</div>
                            <div class="card-subtitle">设备综合效率</div>
                        </div>
                    </div>
                    <div class="chart-container" id="chart-oee"></div>
                </div>
            </div>

            <div class="grid-2">
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">生产效率对比</div>
                            <div class="card-subtitle">计划 vs 实际产出</div>
                        </div>
                    </div>
                    <div class="chart-container" id="chart-efficiency"></div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">停机分析</div>
                            <div class="card-subtitle">停机原因分布</div>
                        </div>
                    </div>
                    <div class="chart-container" id="chart-downtime"></div>
                </div>
            </div>
        `;

        await loadDashboardStats();
        loadDashboardCharts();
    }

    async function loadDashboardStats() {
        try {
            const stats = await API.dashboard.scheduleStats();
            const totalOrders = await API.orders.list({ page: 1, page_size: 1 });
            const equip = await API.dashboard.equipment();

            const running = equip.filter(e => e.status === 0).length;
            const total = equip.length;

            document.getElementById('dash-stats').innerHTML = `
                <div class="stat-card">
                    <div class="stat-label">总订单数</div>
                    <div class="stat-value">${totalOrders.total || 0}</div>
                    <div class="stat-change up"><i class="fas fa-arrow-up"></i> 较上月 +5.2%</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">设备运行率</div>
                    <div class="stat-value">${total ? Math.round(running / total * 100) : 0}%</div>
                    <div class="stat-change ${running > 0 ? 'up' : 'down'}">${running}/${total} 台运行中</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">排产优化提升</div>
                    <div class="stat-value">${stats.has_data ? stats.improvement + '%' : '--'}</div>
                    <div class="stat-change up">切换次数减少</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">批次合格率</div>
                    <div class="stat-value">${stats.has_data ? stats.batch_rate_after + '%' : '--'}</div>
                    <div class="stat-change up">优化后提升</div>
                </div>
            `;
        } catch (e) {
            console.error('Dashboard stats error:', e);
        }
    }

    async function loadDashboardCharts() {
        try {
            const data = await API.dashboard.mockChart();

            // Order completion trend
            const chartOrders = echarts.init(document.getElementById('chart-orders'));
            chartOrders.setOption({
                tooltip: { trigger: 'axis' },
                grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                xAxis: { type: 'category', data: data.order_completion.labels, axisLine: { lineStyle: { color: '#DCDFE6' } } },
                yAxis: { type: 'value', min: 60, max: 100, splitLine: { lineStyle: { color: '#EBEEF5', type: 'dashed' } } },
                series: [{
                    type: 'line', smooth: true, data: data.order_completion.trend,
                    lineStyle: { color: '#FF6B00', width: 2 },
                    areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [{ offset: 0, color: 'rgba(255,107,0,0.15)' }, { offset: 1, color: 'rgba(255,107,0,0.01)' }] } },
                    symbol: 'circle', symbolSize: 5,
                }]
            });

            // OEE
            const chartOee = echarts.init(document.getElementById('chart-oee'));
            const oeeData = data.oee.filter(d => d.oee > 0);
            chartOee.setOption({
                tooltip: { trigger: 'axis' },
                grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                xAxis: { type: 'category', data: oeeData.map(d => d.name), axisLine: { lineStyle: { color: '#DCDFE6' } } },
                yAxis: { type: 'value', max: 100, splitLine: { lineStyle: { color: '#EBEEF5', type: 'dashed' } } },
                series: [{
                    type: 'bar', data: oeeData.map(d => d.oee),
                    itemStyle: { color: '#FF6B00' },
                    barWidth: '40%', borderRadius: [2, 2, 0, 0],
                }]
            });

            // Efficiency
            const chartEff = echarts.init(document.getElementById('chart-efficiency'));
            chartEff.setOption({
                tooltip: { trigger: 'axis' },
                legend: { data: ['计划产出', '实际产出'], textStyle: { color: '#606266' } },
                grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                xAxis: { type: 'category', data: data.production_efficiency.labels, axisLine: { lineStyle: { color: '#DCDFE6' } } },
                yAxis: { type: 'value', splitLine: { lineStyle: { color: '#EBEEF5', type: 'dashed' } } },
                series: [
                    { name: '计划产出', type: 'bar', data: data.production_efficiency.planned, barWidth: '35%',
                        itemStyle: { color: '#DCDFE6', borderRadius: [2, 2, 0, 0] } },
                    { name: '实际产出', type: 'bar', data: data.production_efficiency.actual, barWidth: '35%',
                        itemStyle: { color: '#FF6B00', borderRadius: [2, 2, 0, 0] } },
                ]
            });

            // Downtime pie
            const chartDtn = echarts.init(document.getElementById('chart-downtime'));
            chartDtn.setOption({
                tooltip: { trigger: 'item', formatter: '{b}: {c} min ({d}%)' },
                series: [{
                    type: 'pie', radius: ['45%', '70%'],
                    data: data.downtime_analysis.labels.map((l, i) => ({
                        name: l, value: data.downtime_analysis.values[i],
                    })),
                    label: { color: '#606266', fontSize: 12 },
                    itemStyle: {
                        color: ['#FF6B00', '#E6A23C', '#409EFF', '#F56C6C', '#909399'],
                    },
                }]
            });

            window.addEventListener('resize', () => {
                chartOrders.resize();
                chartOee.resize();
                chartEff.resize();
                chartDtn.resize();
            });
        } catch (e) {
            console.error('Charts error:', e);
        }
    }

    async function refreshDashboard() {
        await loadDashboardStats();
        loadDashboardCharts();
        toast('数据已刷新', 'success');
    }

    // ========================
    // 排产计划 (核心页面)
    // ========================
    async function renderSchedule(el) {
        let products = [];
        let constraints = [];
        try {
            products = await API.products.list();
            constraints = await API.constraints.list();
        } catch (e) { /* ignore */ }

        el.innerHTML = `
            <div class="page-header">
                <div>
                    <h1>排产计划</h1>
                    <div class="subtitle">基于 ALNS 自适应大邻域搜索算法</div>
                </div>
                <div class="optimize-actions">
                    <button class="btn btn-outline" onclick="App.scheduleUpload()">
                        <i class="fas fa-upload"></i> 导入订单
                    </button>
                    <button class="btn btn-primary btn-lg" id="btn-optimize" onclick="App.runOptimize()">
                        <i class="fas fa-play"></i> 执行排产优化
                    </button>
                    <button class="btn btn-success" id="btn-export" style="display:none" onclick="App.exportSchedule()">
                        <i class="fas fa-download"></i> 导出CSV
                    </button>
                </div>
            </div>

            <!-- 优化进度 -->
            <div class="card mb-16" id="progress-card" style="display:none">
                <div class="card-header">
                    <div class="card-title"><i class="fas fa-spinner fa-spin optimizing"></i> 排产优化中...</div>
                </div>
                <div class="card-body">
                    <div class="optimize-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" id="optimize-progress-fill" style="width:0%"></div>
                        </div>
                        <span class="progress-text" id="optimize-progress-text">0%</span>
                    </div>
                    <div class="mt-8" style="font-size:12px;color:var(--text-muted)" id="optimize-status">
                        正在初始化 ALNS 算法参数...
                    </div>
                </div>
            </div>

            <div class="grid-2-1 mb-16">
                <!-- 参数配置 -->
                <div class="card">
                    <div class="card-header">
                        <div class="card-title"><i class="fas fa-sliders-h" style="color:var(--accent)"></i> 算法参数配置</div>
                        <button class="btn btn-sm btn-outline" onclick="App.toggleCollapse('params-body')">
                            <i class="fas fa-chevron-up"></i> 折叠
                        </button>
                    </div>
                    <div class="collapse-body open" id="params-body">
                        <div class="schedule-params-panel">
                            ${constraints.map(c => `
                                <div class="param-item">
                                    <label>${c.constraint_name}</label>
                                    <div class="param-input-group">
                                        <span>最小批次</span>
                                        <input type="number" class="constraint-input" data-name="${c.constraint_name}" data-field="min_batch" value="${c.min_batch}">
                                        <span>最大批次</span>
                                        <input type="number" class="constraint-input" data-name="${c.constraint_name}" data-field="max_batch" value="${c.max_batch}">
                                        <span>间隔</span>
                                        <input type="number" class="constraint-input" data-name="${c.constraint_name}" data-field="gap_limit" value="${c.gap_limit}">
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="mt-16">
                            <button class="btn btn-sm btn-secondary" onclick="App.saveConstraints()">
                                <i class="fas fa-save"></i> 保存配置
                            </button>
                            <span class="text-muted" style="margin-left:12px;font-size:12px">
                                <i class="fas fa-info-circle"></i> 排产约束参数，影响批次聚合和切换频率
                            </span>
                        </div>
                    </div>
                </div>

                <!-- 指标对比 -->
                <div class="card">
                    <div class="card-header">
                        <div class="card-title"><i class="fas fa-chart-bar" style="color:var(--success)"></i> 优化指标对比</div>
                    </div>
                    <div class="card-body" id="metrics-body">
                        <div class="empty-state" id="metrics-empty">
                            <i class="fas fa-chart-simple"></i>
                            <h3>暂无排产数据</h3>
                            <p>请先执行排产优化</p>
                        </div>
                        <div id="metrics-content" style="display:none"></div>
                    </div>
                </div>
            </div>

            <!-- 甘特图 -->
            <div class="card mb-16">
                <div class="card-header">
                    <div class="card-title"><i class="fas fa-chart-gantt" style="color:var(--accent)"></i> 排产甘特图</div>
                </div>
                <div class="card-body">
                    <div class="chart-container chart-container-lg" id="gantt-chart"></div>
                    <div class="empty-state" id="gantt-empty">
                        <i class="fas fa-chart-gantt"></i>
                        <h3>暂无排产结果</h3>
                        <p>执行排产优化后查看甘特图</p>
                    </div>
                </div>
            </div>

            <!-- 排产顺序列表 -->
            <div class="grid-2">
                <div class="card">
                    <div class="card-header">
                        <div class="card-title"><i class="fas fa-list-ol" style="color:var(--accent-orange)"></i> 生产顺序列表</div>
                        <span class="text-muted" style="font-size:12px"><i class="fas fa-grip-lines"></i> 拖拽调整顺序</span>
                    </div>
                    <div class="card-body">
                        <div class="prod-seq-list" id="seq-list">
                            <div class="empty-state">
                                <i class="fas fa-list-ol"></i>
                                <h3>暂无排产数据</h3>
                                <p>执行优化后显示排产顺序</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <div class="card-title"><i class="fas fa-calculator" style="color:#409EFF"></i> 优化详情</div>
                    </div>
                    <div class="card-body" id="optimize-detail">
                        <div class="empty-state">
                            <i class="fas fa-calculator"></i>
                            <h3>等待执行</h3>
                            <p>点击"执行排产优化"查看详细指标</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 隐藏的上传input -->
            <input type="file" id="file-upload" accept=".csv,.xlsx" style="display:none" onchange="App.handleFileUpload(this)">
        `;

        // Show imported file info if any
        if (state.importedFileCount > 0) {
            // Use setTimeout to ensure the DOM is rendered first
            setTimeout(() => showImportedInfo(state.importedFileCount), 0);
        }
    }

    // 排产优化执行
    async function runOptimize() {
        if (state.optimizing) return;

        // Show progress
        const progressCard = document.getElementById('progress-card');
        progressCard.style.display = 'block';
        state.optimizing = true;

        const btn = document.getElementById('btn-optimize');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 优化中...';

        const progressFill = document.getElementById('optimize-progress-fill');
        const progressText = document.getElementById('optimize-progress-text');
        const progressStatus = document.getElementById('optimize-status');

        const steps = [
            { pct: 10, msg: '正在初始化 ALNS 算法参数...' },
            { pct: 25, msg: '构建初始排产方案...' },
            { pct: 40, msg: '执行邻域搜索 (2-opt / relocation)...' },
            { pct: 55, msg: '评估约束条件 (批次/间隔/切换)...' },
            { pct: 70, msg: '自适应权重调整...' },
            { pct: 85, msg: '收敛优化中...' },
            { pct: 95, msg: '生成排产结果...' },
        ];

        let stepIdx = 0;
        const progressInterval = setInterval(() => {
            if (stepIdx < steps.length) {
                const s = steps[stepIdx];
                progressFill.style.width = s.pct + '%';
                progressText.textContent = s.pct + '%';
                progressStatus.textContent = s.msg;
                stepIdx++;
            }
        }, 600);

        try {
            const result = await API.schedule.optimize();
            state.scheduleResultId = result.result_id;
            state.scheduleData = result.data;

            clearInterval(progressInterval);
            progressFill.style.width = '100%';
            progressText.textContent = '100%';
            progressStatus.textContent = '✓ 排产优化完成！';

            setTimeout(() => {
                progressCard.style.display = 'none';
            }, 1500);

            // Show results
            displayScheduleResult(result.data);
            document.getElementById('btn-export').style.display = 'inline-flex';

            toast(`排产优化完成！切换次数减少 ${result.data.before.switch_count - result.data.after.switch_count} 次`, 'success');
        } catch (e) {
            clearInterval(progressInterval);
            progressCard.style.display = 'none';
            toast('排产优化失败: ' + e.message, 'error');
        } finally {
            state.optimizing = false;
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-play"></i> 执行排产优化';
        }
    }

    function displayScheduleResult(data) {
        // Metrics comparison
        const metricsEl = document.getElementById('metrics-body');
        document.getElementById('metrics-empty').style.display = 'none';
        const mc = document.getElementById('metrics-content');
        mc.style.display = 'block';

        const before = data.before;
        const after = data.after;
        const switchImprove = before.switch_count - after.switch_count;
        const batchImprove = after.batch_rate - before.batch_rate;
        const gapImprove = after.gap_rate - before.gap_rate;

        mc.innerHTML = `
            <div style="margin-bottom:8px">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                    <span class="badge badge-green" style="font-size:13px;padding:4px 16px">
                        <i class="fas fa-arrow-up"></i> 综合评分优化 ${Math.round((before.score - after.score) / before.score * 100)}%
                    </span>
                </div>
            </div>
            <div class="comparison-row">
                <span class="comparison-label">切换次数</span>
                <div class="comparison-bars">
                    <div class="comp-bar-group">
                        <div class="comp-bar-label">优化前 ${before.switch_count} 次</div>
                        <div class="comp-bar-track">
                            <div class="comp-bar-fill before" style="width:100%">${before.switch_count}</div>
                        </div>
                    </div>
                    <div class="comp-bar-group">
                        <div class="comp-bar-label">优化后 ${after.switch_count} 次</div>
                        <div class="comp-bar-track">
                            <div class="comp-bar-fill after" style="width:${Math.round(after.switch_count / before.switch_count * 100)}%">${after.switch_count}</div>
                        </div>
                    </div>
                </div>
                <span class="improvement-badge">-${Math.round(switchImprove / before.switch_count * 100)}%</span>
            </div>
            <div class="comparison-row">
                <span class="comparison-label">批次合格率</span>
                <div class="comparison-bars">
                    <div class="comp-bar-group">
                        <div class="comp-bar-label">优化前 ${before.batch_rate}%</div>
                        <div class="comp-bar-track">
                            <div class="comp-bar-fill before" style="width:${before.batch_rate}%">${before.batch_rate}%</div>
                        </div>
                    </div>
                    <div class="comp-bar-group">
                        <div class="comp-bar-label">优化后 ${after.batch_rate}%</div>
                        <div class="comp-bar-track">
                            <div class="comp-bar-fill after" style="width:${after.batch_rate}%">${after.batch_rate}%</div>
                        </div>
                    </div>
                </div>
                <span class="improvement-badge">+${Math.round(batchImprove)}%</span>
            </div>
            <div class="comparison-row" style="border-bottom:none">
                <span class="comparison-label">间隔合格率</span>
                <div class="comparison-bars">
                    <div class="comp-bar-group">
                        <div class="comp-bar-label">优化前 ${before.gap_rate}%</div>
                        <div class="comp-bar-track">
                            <div class="comp-bar-fill before" style="width:${before.gap_rate}%">${before.gap_rate}%</div>
                        </div>
                    </div>
                    <div class="comp-bar-group">
                        <div class="comp-bar-label">优化后 ${after.gap_rate}%</div>
                        <div class="comp-bar-track">
                            <div class="comp-bar-fill after" style="width:${after.gap_rate}%">${after.gap_rate}%</div>
                        </div>
                    </div>
                </div>
                <span class="improvement-badge">+${Math.round(gapImprove)}%</span>
            </div>
        `;

        // Render Gantt chart
        renderGanttChart(data.sequence_detail);

        // Render sequence list
        renderSequenceList(data.sequence_detail);

        // Render optimization details
        renderOptimizeDetails(data);
    }

    function renderGanttChart(details) {
        document.getElementById('gantt-empty').style.display = 'none';

        if (state.ganttChart) {
            state.ganttChart.dispose();
        }

        const chartDom = document.getElementById('gantt-chart');
        state.ganttChart = echarts.init(chartDom);

        // Color map by product
        const products = [...new Set(details.map(d => d.product_name))];
        const colorMap = {};
        const colors = ['#FF6B00', '#409EFF', '#2D8C5A', '#E6A23C', '#909399', '#F56C6C', '#607D8B', '#9C27B0'];
        products.forEach((p, i) => { colorMap[p] = colors[i % colors.length]; });

        // Generate time slots: start today 08:00, each task = 1h duration, 1h gap
        const today = new Date();
        today.setHours(8, 0, 0, 0);
        const slotMs = 2 * 3600 * 1000;   // 2h per slot
        const workMs = 1 * 3600 * 1000;   // 1h work duration
        const baseTime = today.getTime();

        // Build stacked-bar Gantt: each task = invisible spacer + visible work bar
        const ganttSeries = [];
        const taskNames = [];

        details.forEach((d, i) => {
            const startOffset = i * slotMs;
            const color = colorMap[d.product_name] || '#FF6B00';
            const taskName = `${d.order_no || '#' + (i + 1)}`;
            taskNames.push(taskName);

            // Invisible spacer — positions the bar at the correct start time
            ganttSeries.push({
                name: taskName,
                type: 'bar',
                stack: `g_${i}`,
                data: [startOffset],
                itemStyle: { color: 'transparent', borderColor: 'transparent' },
                barWidth: 20,
                emphasis: { itemStyle: { color: 'transparent' } },
                silent: true,
                z: 1,
            });
            // Visible work bar — shows the 1h duration
            ganttSeries.push({
                name: taskName,
                type: 'bar',
                stack: `g_${i}`,
                data: [workMs],
                itemStyle: {
                    color: color,
                    borderRadius: [3, 3, 3, 3],
                    opacity: 0.85,
                },
                barWidth: 20,
                label: {
                    show: true,
                    position: 'right',
                    formatter: d.product_name,
                    color: '#606266',
                    fontSize: 11,
                },
                z: 2,
            });
        });

        const totalMs = details.length * slotMs;

        state.ganttChart.setOption({
            tooltip: {
                trigger: 'item',
                formatter: (p) => {
                    const idx = Math.floor(p.seriesIndex / 2);
                    const d = details[idx];
                    if (!d) return '';
                    const tStart = baseTime + idx * slotMs;
                    const tEnd = tStart + workMs;
                    const fmt = (t) => {
                        const dt = new Date(t);
                        return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                    };
                    return `<strong>${d.order_no}</strong><br/>
                        产品: ${d.product_name}<br/>
                        排产时间: ${fmt(tStart)} - ${fmt(tEnd)}<br/>
                        属性A: ${d.attr_a || '-'} | 属性B: ${d.attr_b || '-'}<br/>
                        数量: ${d.quantity} | 交期: ${d.deadline || '-'}<br/>
                        批次: #${d.batch_id}`;
                },
            },
            grid: {
                left: '3%',
                right: '28%',
                bottom: '8%',
                top: '3%',
                containLabel: false,
            },
            xAxis: {
                type: 'value',
                min: 0,
                max: totalMs,
                axisLabel: {
                    formatter: (val) => {
                        const dt = new Date(baseTime + val);
                        return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                    },
                    color: '#909399',
                    fontSize: 11,
                },
                splitLine: {
                    show: true,
                    lineStyle: { color: '#EBEEF5', type: 'dashed' },
                },
                axisLine: { show: false },
                axisTick: { show: false },
            },
            yAxis: {
                type: 'category',
                data: taskNames,
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: { color: '#303133', fontSize: 12, fontWeight: 500 },
                splitLine: { lineStyle: { color: '#EBEEF5', type: 'solid' } },
            },
            series: ganttSeries,
        });

        window.addEventListener('resize', () => {
            if (state.ganttChart) state.ganttChart.resize();
        });
    }

    function renderSequenceList(details) {
        const el = document.getElementById('seq-list');
        el.innerHTML = '';

        details.forEach((d, i) => {
            const item = document.createElement('div');
            item.className = 'seq-item';
            item.dataset.orderId = d.order_id;
            item.innerHTML = `
                <span class="drag-handle"><i class="fas fa-grip-lines"></i></span>
                <span class="seq-num">${i + 1}</span>
                <div class="seq-info">
                    <div class="seq-name">${d.product_name}</div>
                    <div class="seq-desc">${d.order_no} · ${d.attr_a || '-'}/${d.attr_b || '-'} · 数量:${d.quantity}</div>
                </div>
                ${getPriorityBadge(d.priority)}
            `;
            el.appendChild(item);
        });

        // Initialize SortableJS
        if (window.Sortable) {
            Sortable.create(el, {
                handle: '.drag-handle',
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                onEnd: () => {
                    toast('生产顺序已调整（演示功能）', 'info');
                },
            });
        }
    }

    function renderOptimizeDetails(data) {
        const el = document.getElementById('optimize-detail');
        const before = data.before;
        const after = data.after;

        el.innerHTML = `
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-value" style="color:#FF6B00">${after.score}</div>
                    <div class="metric-label">优化后评分</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px">原 ${before.score}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value" style="color:#2D8C5A">${after.batch_rate}%</div>
                    <div class="metric-label">批次合格率</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
                        <span class="text-green">↑ ${Math.round(after.batch_rate - before.batch_rate)}%</span>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-value" style="color:#409EFF">${after.switch_count}</div>
                    <div class="metric-label">切换次数</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
                        <span class="text-green">↓ ${before.switch_count - after.switch_count}次</span>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-value" style="color:#909399">${after.gap_rate}%</div>
                    <div class="metric-label">间隔合格率</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
                        <span class="text-green">↑ ${Math.round(after.gap_rate - before.gap_rate)}%</span>
                    </div>
                </div>
            </div>
            <div class="mt-16" style="padding:12px;background:#FAFAFA;border:1px solid var(--border-color);border-radius:2px;font-size:12px;color:var(--text-muted)">
                <i class="fas fa-microchip" style="color:#FF6B00"></i>
                ALNS 算法经过 50 次迭代优化，采用 2-opt、relocation、exchange 等多邻域搜索策略，
                结合自适应权重调整，在保证批次合格率的前提下最小化属性切换次数。
            </div>
        `;
    }

    // 约束保存
    async function saveConstraints() {
        const inputs = document.querySelectorAll('.constraint-input');
        const groups = {};
        inputs.forEach(inp => {
            const name = inp.dataset.name;
            if (!groups[name]) groups[name] = { constraint_name: name };
            groups[name][inp.dataset.field] = parseInt(inp.value) || 0;
        });

        try {
            await API.constraints.update(Object.values(groups));
            toast('约束配置已保存', 'success');
        } catch (e) {
            toast('保存失败: ' + e.message, 'error');
        }
    }

    // 上传订单
    function scheduleUpload() {
        document.getElementById('file-upload').click();
    }

    async function handleFileUpload(input) {
        const file = input.files[0];
        if (!file) return;

        try {
            const result = await API.orders.importFile(file);
            const count = result.count || 0;
            state.importedFileCount = count;
            input.value = '';

            if (count > 0) {
                toast(`成功导入 ${count} 条订单`, 'success');
                showImportedInfo(count);
            } else {
                toast('导入完成，但没有匹配到有效订单数据', 'warning');
            }
        } catch (e) {
            toast('导入失败: ' + e.message, 'error');
        }
    }

    function showImportedInfo(count) {
        let info = document.getElementById('imported-info');
        const refEl = document.querySelector('.page-header');
        if (refEl && refEl.nextElementSibling) {
            if (!info) {
                info = document.createElement('div');
                info.id = 'imported-info';
                info.className = 'card mb-16';
                info.style.cssText = 'padding:12px 20px;border-left:3px solid var(--success)';
                refEl.parentNode.insertBefore(info, refEl.nextElementSibling);
            }
            info.innerHTML = `
                <div style="display:flex;align-items:center;gap:12px">
                    <i class="fas fa-file-excel" style="color:var(--success);font-size:16px"></i>
                    <span style="font-size:13px;color:var(--text-secondary)">
                        已导入 <strong style="color:var(--text-primary)">${count}</strong> 条订单，点击"执行排产优化"开始排产
                    </span>
                </div>
            `;
        }
    }

    // 导出CSV
    function exportSchedule() {
        if (state.scheduleResultId) {
            window.open(API.schedule.exportResult(state.scheduleResultId), '_blank');
            toast('排产结果已导出', 'success');
        }
    }

    // ========================
    // 假功能模块页面
    // ========================
    function renderFakeModule(el, title, description, extraContent = '') {
        el.innerHTML = `
            <div class="page-header">
                <div>
                    <h1>${title}</h1>
                    <div class="subtitle">${description}</div>
                </div>
            </div>
            ${extraContent}
            <div class="card text-center" style="padding:80px 20px">
                <i class="fas fa-tools" style="font-size:64px;color:var(--text-muted);opacity:0.2;margin-bottom:20px"></i>
                <h2 style="color:var(--text-secondary);margin-bottom:8px">功能开发中</h2>
                <p style="color:var(--text-muted)">此模块正在建设中，敬请期待后续版本</p>
            </div>
        `;
    }

    // ---- 人员管理 ----
    async function renderEmployees(el) {
        let data = [];
        try { data = await API.dashboard.employees(); } catch (e) { /* mock */ }
        if (data.length === 0) data = [
            { name: '张三', role: '生产主管', team: 'A班', status: 1 },
            { name: '李四', role: '操作工', team: 'A班', status: 1 },
            { name: '王五', role: '技术员', team: 'B班', status: 1 },
            { name: '赵六', role: '质检员', team: 'A班', status: 1 },
            { name: '孙七', role: '操作工', team: 'B班', status: 0 },
            { name: '周八', role: '维修工', team: '维修组', status: 2 },
        ];

        el.innerHTML = `
            <div class="page-header">
                <div>
                    <h1>人员管理</h1>
                    <div class="subtitle">员工信息与排班管理</div>
                </div>
                <button class="btn btn-outline" onclick="App.devNotice()"><i class="fas fa-plus"></i> 添加人员</button>
            </div>
            <div class="card">
                <div class="table-container">
                    <table>
                        <thead><tr>
                            <th>姓名</th><th>角色</th><th>班组</th><th>联系方式</th><th>状态</th>
                        </tr></thead>
                        <tbody>
                            ${data.map(e => `
                                <tr>
                                    <td><strong>${e.name}</strong></td>
                                    <td>${e.role}</td>
                                    <td>${e.team}</td>
                                    <td>${e.phone || '-'}</td>
                                    <td>${e.status === 1 ? '<span class="badge badge-green">在岗</span>' :
                                        e.status === 0 ? '<span class="badge badge-gray">离线</span>' :
                                        '<span class="badge badge-orange">休假</span>'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ---- 设备管理 ----
    async function renderEquipment(el) {
        let data = [];
        try { data = await API.dashboard.equipment(); } catch (e) { /* ignore */ }
        const statusMap = { 0: { text: '运行中', cls: 'badge-green' }, 1: { text: '停机', cls: 'badge-red' }, 2: { text: '维修', cls: 'badge-orange' }, 3: { text: '待机', cls: 'badge-gray' } };

        if (data.length === 0) data = [
            { name: '设备一', type: 'CNC', status: 0, oee: 85.5, temperature: 42.3 },
            { name: '设备二', type: '注塑机', status: 0, oee: 92.1, temperature: 58.7 },
            { name: '设备三', type: '冲压机', status: 1, oee: 0, temperature: 35.2 },
        ];

        el.innerHTML = `
            <div class="page-header">
                <div>
                    <h1>设备管理</h1>
                    <div class="subtitle">生产设备状态监控</div>
                </div>
                <button class="btn btn-outline" onclick="App.devNotice()"><i class="fas fa-plus"></i> 添加设备</button>
            </div>
            <div class="grid-4 mb-16">
                <div class="stat-card"><div class="stat-label">设备总数</div><div class="stat-value">${data.length}</div></div>
                <div class="stat-card"><div class="stat-label">运行中</div><div class="stat-value" style="color:#2D8C5A">${data.filter(d => d.status === 0).length}</div></div>
                <div class="stat-card"><div class="stat-label">停机/维修</div><div class="stat-value" style="color:#F56C6C">${data.filter(d => d.status !== 0).length}</div></div>
                <div class="stat-card"><div class="stat-label">平均OEE</div><div class="stat-value">${Math.round(data.filter(d => d.oee > 0).reduce((s, d) => s + d.oee, 0) / Math.max(data.filter(d => d.oee > 0).length, 1))}%</div></div>
            </div>
            <div class="card">
                <div class="table-container">
                    <table>
                        <thead><tr><th>设备名称</th><th>类型</th><th>状态</th><th>OEE</th><th>温度</th><th>操作</th></tr></thead>
                        <tbody>
                            ${data.map(d => {
                                const s = statusMap[d.status] || statusMap[0];
                                return `<tr>
                                    <td><strong>${d.name}</strong></td>
                                    <td>${d.type || '-'}</td>
                                    <td><span class="badge ${s.cls}">${s.text}</span></td>
                                    <td>${d.oee || 0}%</td>
                                    <td>${d.temperature || '-'}°C</td>
                                    <td><button class="btn btn-sm btn-outline" onclick="App.devNotice()">查看</button></td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ---- 物料管理 ----
    async function renderMaterials(el) {
        let data = [];
        try { data = await API.dashboard.materials(); } catch (e) { /* ignore */ }
        if (data.length === 0) data = [
            { name: '铝合金板材', stock: 5000, min_stock: 1000, unit: 'kg', supplier: '供应商A' },
            { name: '特种钢材', stock: 1200, min_stock: 500, unit: 'kg', supplier: '供应商B' },
        ];

        el.innerHTML = `
            <div class="page-header">
                <div>
                    <h1>物料管理</h1>
                    <div class="subtitle">库存管理与采购计划</div>
                </div>
                <button class="btn btn-outline" onclick="App.devNotice()"><i class="fas fa-plus"></i> 添加物料</button>
            </div>
            <div class="card">
                <div class="table-container">
                    <table>
                        <thead><tr><th>物料名称</th><th>库存量</th><th>安全库存</th><th>单位</th><th>供应商</th><th>状态</th></tr></thead>
                        <tbody>
                            ${data.map(m => {
                                const isLow = m.stock <= m.min_stock;
                                return `<tr>
                                    <td><strong>${m.name}</strong></td>
                                    <td>${m.stock}</td>
                                    <td>${m.min_stock}</td>
                                    <td>${m.unit}</td>
                                    <td>${m.supplier || '-'}</td>
                                    <td>${isLow ? '<span class="badge badge-red">库存不足</span>' : '<span class="badge badge-green">正常</span>'}</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ---- 工法管理 ----
    function renderMethods(el) {
        renderFakeModule(el, '工法管理', '工艺路线与SOP文档管理', `
            <div class="grid-3 mb-16">
                <div class="card text-center" style="cursor:pointer" onclick="App.devNotice()">
                    <i class="fas fa-route" style="font-size:32px;color:#409EFF;margin-bottom:8px"></i>
                    <div style="font-weight:500">工艺路线</div>
                    <div style="font-size:12px;color:var(--text-muted)">8 条路线</div>
                </div>
                <div class="card text-center" style="cursor:pointer" onclick="App.devNotice()">
                    <i class="fas fa-file-alt" style="font-size:32px;color:#2D8C5A;margin-bottom:8px"></i>
                    <div style="font-weight:500">SOP 文档</div>
                    <div style="font-size:12px;color:var(--text-muted)">24 份文档</div>
                </div>
                <div class="card text-center" style="cursor:pointer" onclick="App.devNotice()">
                    <i class="fas fa-clock" style="font-size:32px;color:var(--accent-orange);margin-bottom:8px"></i>
                    <div style="font-weight:500">标准工时</div>
                    <div style="font-size:12px;color:var(--text-muted)">已定义 36 项</div>
                </div>
            </div>
        `);
    }

    // ---- ERP订单管理 ----
    async function renderOrders(el) {
        let data = [];
        try {
            const res = await API.orders.list({ page_size: 100 });
            data = res.data || [];
        } catch (e) { /* ignore */ }

        const totalQty = data.reduce((s, o) => s + o.quantity, 0);

        el.innerHTML = `
            <div class="page-header">
                <div>
                    <h1>ERP订单管理</h1>
                    <div class="subtitle">订单列表与状态跟踪</div>
                </div>
                <button class="btn btn-outline" onclick="App.devNotice()"><i class="fas fa-plus"></i> 新建订单</button>
            </div>
            <div class="grid-3 mb-16">
                <div class="stat-card"><div class="stat-label">总订单数</div><div class="stat-value">${data.length}</div></div>
                <div class="stat-card"><div class="stat-label">总数量</div><div class="stat-value">${totalQty}</div></div>
                <div class="stat-card"><div class="stat-label">待排产</div><div class="stat-value" style="color:var(--accent-orange)">${data.filter(o => o.status === 0).length}</div></div>
            </div>
            <div class="card">
                <div class="table-container">
                    <table>
                        <thead><tr>
                            <th>订单号</th><th>产品</th><th>数量</th><th>交期</th><th>优先级</th><th>状态</th><th>操作</th>
                        </tr></thead>
                        <tbody>
                            ${data.map(o => `
                                <tr>
                                    <td><strong style="font-family:var(--font-mono);font-size:12px">${o.order_no}</strong></td>
                                    <td>${o.product_name || '-'}</td>
                                    <td>${o.quantity}</td>
                                    <td>${o.deadline || '-'}</td>
                                    <td>${getPriorityBadge(o.priority)}</td>
                                    <td>${getStatusBadge(o.status)}</td>
                                    <td>
                                        <button class="btn btn-sm btn-outline" onclick="App.devNotice()">详情</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ---- 加急订单 ----
    function renderUrgent(el) {
        el.innerHTML = `
            <div class="page-header">
                <div><h1>加急订单</h1><div class="subtitle">插单评估、锁单保护、计划调整</div></div>
                <button class="btn btn-primary" onclick="App.urgentEval()"><i class="fas fa-bolt"></i> 插单评估</button>
            </div>
            <div class="grid-2 mb-16">
                <div class="card">
                    <div class="card-header"><div class="card-title"><i class="fas fa-bolt" style="color:var(--accent-orange)"></i> 加急申请列表</div></div>
                    <div class="table-container">
                        <table>
                            <thead><tr><th>申请编号</th><th>订单号</th><th>原因</th><th>状态</th><th>操作</th></tr></thead>
                            <tbody>
                                <tr><td>URG-2026-001</td><td>ORD-2026-0012</td><td>客户紧急需求</td><td><span class="badge badge-orange">待审批</span></td><td><button class="btn btn-sm btn-outline" onclick="App.devNotice()">处理</button></td></tr>
                                <tr><td>URG-2026-002</td><td>ORD-2026-0005</td><td>产线异常补单</td><td><span class="badge badge-green">已通过</span></td><td><button class="btn btn-sm btn-outline" onclick="App.devNotice()">查看</button></td></tr>
                                <tr><td>URG-2026-003</td><td>ORD-2026-0017</td><td>战略客户加急</td><td><span class="badge badge-blue">已排产</span></td><td><button class="btn btn-sm btn-outline" onclick="App.devNotice()">查看</button></td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><div class="card-title"><i class="fas fa-lock" style="color:#F56C6C"></i> 锁单保护状态</div></div>
                    <div class="table-container">
                        <table>
                            <thead><tr><th>订单号</th><th>锁区</th><th>锁定时间</th><th>原因</th></tr></thead>
                            <tbody>
                                <tr><td>ORD-2026-0001</td><td><span class="badge badge-red">冻结区</span></td><td>2026-05-16</td><td>生产中</td></tr>
                                <tr><td>ORD-2026-0005</td><td><span class="badge badge-orange">牢固区</span></td><td>2026-05-16</td><td>交期锁定</td></tr>
                                <tr><td>ORD-2026-0012</td><td><span class="badge badge-green">灵活区</span></td><td>2026-05-15</td><td>可调整</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    function urgentEval() {
        showModal('插单评估', `
            <p style="color:var(--text-secondary);margin-bottom:16px">系统将对加急订单进行可行性评估，分析对现有排产计划的影响。</p>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">选择加急订单</label>
                    <select class="form-select">
                        <option>ORD-2026-0005 - 客户D (优先级1)</option>
                        <option>ORD-2026-0017 - 客户A (优先级1)</option>
                        <option>ORD-2026-0012 - 客户E (优先级1)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">期望完成日期</label>
                    <input class="form-input" type="date" value="2026-05-20">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">加急原因</label>
                <textarea class="form-textarea">客户紧急需求，需提前交付</textarea>
            </div>
        `, `
            <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove();App.devNotice('插单评估完成，影响分析报告已生成')">开始评估</button>
        `);
    }

    // ---- MES产线管理 ----
    async function renderMesLines(el) {
        let data = [];
        try { data = await API.dashboard.mesLines(); } catch (e) { /* ignore */ }

        el.innerHTML = `
            <div class="page-header">
                <div><h1>MES产线管理</h1><div class="subtitle">产线实时状态看板</div></div>
                <button class="btn btn-outline" onclick="App.devNotice()"><i class="fas fa-sync-alt"></i> 刷新</button>
            </div>
            <div class="grid-2">
                ${data.length > 0 ? data.map(line => {
                    const statusMap = { 0: { text: '停机', cls: 'badge-red', icon: 'fa-circle-stop' },
                        1: { text: '运行中', cls: 'badge-green', icon: 'fa-play' },
                        2: { text: '待料', cls: 'badge-orange', icon: 'fa-pause' },
                        3: { text: '换线中', cls: 'badge-blue', icon: 'fa-rotate' } };
                    const s = statusMap[line.status] || statusMap[0];
                    return `<div class="card">
                        <div class="card-header">
                            <div class="card-title"><i class="fas ${s.icon}" style="color:${s.cls === 'badge-green' ? '#2D8C5A' : '#F56C6C'}"></i> ${line.line_name}</div>
                            <span class="badge ${s.cls}">${s.text}</span>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center">
                            <div><div style="font-size:20px;font-weight:700;color:#409EFF">${line.today_qty}/${line.plan_qty}</div><div style="font-size:11px;color:var(--text-muted)">产出/计划</div></div>
                            <div><div style="font-size:20px;font-weight:700;color:#409EFF">${line.speed}%</div><div style="font-size:11px;color:var(--text-muted)">运行速度</div></div>
                            <div><div style="font-size:20px;font-weight:700;color:#2D8C5A">${line.product_name}</div><div style="font-size:11px;color:var(--text-muted)">当前产品</div></div>
                        </div>
                        <div class="mt-8"><div class="progress-bar"><div class="progress-fill" style="width:${Math.round(line.today_qty / Math.max(line.plan_qty, 1) * 100)}%"></div></div></div>
                    </div>`;
                }).join('') : '<div class="card text-center" style="grid-column:1/-1;padding:60px"><i class="fas fa-industry" style="font-size:48px;color:var(--text-muted);opacity:0.2"></i><h3 class="mt-8" style="color:var(--text-secondary)">暂无产线数据</h3></div>'}
            </div>
        `;
    }

    // ---- 安全/质量/异常 ----
    function renderSafety(el) {
        el.innerHTML = `
            <div class="page-header">
                <div><h1>安全管理</h1><div class="subtitle">安全巡检与隐患排查</div></div>
                <button class="btn btn-outline" onclick="App.devNotice()"><i class="fas fa-plus"></i> 新增巡检</button>
            </div>
            <div class="grid-3 mb-16">
                <div class="card text-center"><div style="font-size:32px;font-weight:700;color:#2D8C5A">128</div><div style="font-size:12px;color:var(--text-muted)">累计安全天数</div></div>
                <div class="card text-center"><div style="font-size:32px;font-weight:700;color:#409EFF">36</div><div style="font-size:12px;color:var(--text-muted)">本月巡检次数</div></div>
                <div class="card text-center"><div style="font-size:32px;font-weight:700;color:var(--accent-orange)">2</div><div style="font-size:12px;color:var(--text-muted)">待整改隐患</div></div>
            </div>
            <div class="card">
                <div class="table-container">
                    <table><thead><tr><th>巡检日期</th><th>检查区域</th><th>检查人</th><th>发现隐患</th><th>状态</th></tr></thead>
                        <tbody>
                            <tr><td>2026-05-16</td><td>A车间-生产线一</td><td>张三</td><td>安全通道堆放物料</td><td><span class="badge badge-orange">整改中</span></td></tr>
                            <tr><td>2026-05-15</td><td>B车间-仓库</td><td>李四</td><td>灭火器过期</td><td><span class="badge badge-green">已整改</span></td></tr>
                            <tr><td>2026-05-14</td><td>A车间-生产线二</td><td>王五</td><td>无</td><td><span class="badge badge-green">合格</span></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    async function renderQuality(el) {
        let data = null;
        try { data = await API.dashboard.quality(); } catch (e) { /* ignore */ }

        el.innerHTML = `
            <div class="page-header">
                <div><h1>质量监控</h1><div class="subtitle">产品质量数据监控</div></div>
            </div>
            <div class="grid-3 mb-16">
                <div class="card text-center"><div style="font-size:32px;font-weight:700;color:#2D8C5A">97.2%</div><div style="font-size:12px;color:var(--text-muted)">综合良品率</div></div>
                <div class="card text-center"><div style="font-size:32px;font-weight:700;color:#409EFF">99.1%</div><div style="font-size:12px;color:var(--text-muted)">设备一良品率</div></div>
                <div class="card text-center"><div style="font-size:32px;font-weight:700;color:var(--accent-orange)">94.8%</div><div style="font-size:12px;color:var(--text-muted)">设备四良品率</div></div>
            </div>
            <div class="card">
                <div class="card-header"><div class="card-title">近14天良品率趋势</div></div>
                <div class="chart-container" id="quality-chart"></div>
            </div>
        `;

        if (data) {
            setTimeout(() => {
                const chart = echarts.init(document.getElementById('quality-chart'));
                chart.setOption({
                    tooltip: { trigger: 'axis' },
                    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                    xAxis: { type: 'category', data: data.dates, axisLine: { lineStyle: { color: '#DCDFE6' } } },
                    yAxis: [
                        { type: 'value', min: 90, max: 100, splitLine: { lineStyle: { color: '#EBEEF5', type: 'dashed' } } },
                        { type: 'value', splitLine: { show: false } },
                    ],
                    series: [
                        { name: '良品率', type: 'line', smooth: true, data: data.yield_rate, lineStyle: { color: '#2D8C5A', width: 2 }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(45,140,90,0.15)' }, { offset: 1, color: 'rgba(45,140,90,0.01)' }] } }, symbol: 'circle' },
                        { name: '缺陷数', type: 'bar', yAxisIndex: 1, data: data.defect_count, itemStyle: { color: 'rgba(245,108,108,0.5)', borderRadius: [2, 2, 0, 0] }, barWidth: '40%' },
                    ],
                });
                window.addEventListener('resize', () => chart.resize());
            }, 100);
        }
    }

    function renderAnomaly(el) {
        el.innerHTML = `
            <div class="page-header">
                <div><h1>异常管理</h1><div class="subtitle">异常报警与处理记录</div></div>
                <button class="btn btn-outline" onclick="App.devNotice()"><i class="fas fa-bell"></i> 报警设置</button>
            </div>
            <div class="card">
                <div class="table-container">
                    <table><thead><tr><th>时间</th><th>异常类型</th><th>来源</th><th>级别</th><th>状态</th><th>操作</th></tr></thead>
                        <tbody>
                            <tr><td>2026-05-16 08:23</td><td>温度异常</td><td>设备三</td><td><span class="badge badge-orange">警告</span></td><td><span class="badge badge-gray">待处理</span></td><td><button class="btn btn-sm btn-outline" onclick="App.devNotice()">处理</button></td></tr>
                            <tr><td>2026-05-16 07:15</td><td>振动超标</td><td>设备一</td><td><span class="badge badge-red">严重</span></td><td><span class="badge badge-green">已处理</span></td><td><button class="btn btn-sm btn-outline" onclick="App.devNotice()">查看</button></td></tr>
                            <tr><td>2026-05-15 22:00</td><td>物料短缺</td><td>物料B</td><td><span class="badge badge-orange">警告</span></td><td><span class="badge badge-green">已处理</span></td><td><button class="btn btn-sm btn-outline" onclick="App.devNotice()">查看</button></td></tr>
                            <tr><td>2026-05-15 14:30</td><td>良率下降</td><td>产线二</td><td><span class="badge badge-blue">提示</span></td><td><span class="badge badge-gray">待处理</span></td><td><button class="btn btn-sm btn-outline" onclick="App.devNotice()">处理</button></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ---- 数据可视化 ----
    async function renderCharts(el) {
        let data = null;
        try { data = await API.dashboard.mockChart(); } catch (e) { /* ignore */ }

        el.innerHTML = `
            <div class="page-header">
                <div><h1>数据可视化</h1><div class="subtitle">生产数据分析与报表</div></div>
            </div>
            <div class="grid-2 mb-16">
                <div class="card"><div class="card-header"><div class="card-title">订单达成率趋势</div></div><div class="chart-container" id="chart-v1"></div></div>
                <div class="card"><div class="card-header"><div class="card-title">生产效率对比</div></div><div class="chart-container" id="chart-v2"></div></div>
            </div>
            <div class="grid-2">
                <div class="card"><div class="card-header"><div class="card-title">设备 OEE 分布</div></div><div class="chart-container" id="chart-v3"></div></div>
                <div class="card"><div class="card-header"><div class="card-title">停机原因分析</div></div><div class="chart-container" id="chart-v4"></div></div>
            </div>
        `;

        if (data) {
            setTimeout(() => {
                const c1 = echarts.init(document.getElementById('chart-v1'));
                c1.setOption({
                    tooltip: { trigger: 'axis' }, grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                    xAxis: { type: 'category', data: data.order_completion.labels, axisLine: { lineStyle: { color: '#DCDFE6' } } },
                    yAxis: { type: 'value', min: 60, max: 100, splitLine: { lineStyle: { color: '#EBEEF5', type: 'dashed' } } },
                    series: [{ type: 'line', smooth: true, data: data.order_completion.trend, lineStyle: { color: '#FF6B00', width: 2 }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(255,107,0,0.15)' }, { offset: 1, color: 'rgba(255,107,0,0.01)' }] } }, symbol: 'circle' }]
                });

                const c2 = echarts.init(document.getElementById('chart-v2'));
                c2.setOption({
                    tooltip: { trigger: 'axis' }, legend: { data: ['计划', '实际'], textStyle: { color: '#606266' } }, grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                    xAxis: { type: 'category', data: data.production_efficiency.labels, axisLine: { lineStyle: { color: '#DCDFE6' } } },
                    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#EBEEF5', type: 'dashed' } } },
                    series: [{ name: '计划', type: 'bar', data: data.production_efficiency.planned, barWidth: '35%', itemStyle: { color: '#DCDFE6', borderRadius: [2, 2, 0, 0] } }, { name: '实际', type: 'bar', data: data.production_efficiency.actual, barWidth: '35%', itemStyle: { color: '#FF6B00', borderRadius: [2, 2, 0, 0] } }]
                });

                const c3 = echarts.init(document.getElementById('chart-v3'));
                const oeeData = data.oee.filter(d => d.oee > 0);
                c3.setOption({
                    tooltip: { trigger: 'axis' }, grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                    xAxis: { type: 'category', data: oeeData.map(d => d.name), axisLine: { lineStyle: { color: '#DCDFE6' } } },
                    yAxis: { type: 'value', max: 100, splitLine: { lineStyle: { color: '#EBEEF5', type: 'dashed' } } },
                    series: [{ type: 'bar', data: oeeData.map(d => d.oee), itemStyle: { color: '#FF6B00' }, barWidth: '40%', borderRadius: [2, 2, 0, 0] }]
                });

                const c4 = echarts.init(document.getElementById('chart-v4'));
                c4.setOption({
                    tooltip: { trigger: 'item', formatter: '{b}: {c} min ({d}%)' },
                    series: [{ type: 'pie', radius: ['45%', '70%'], data: data.downtime_analysis.labels.map((l, i) => ({ name: l, value: data.downtime_analysis.values[i] })), label: { color: '#606266', fontSize: 12 }, itemStyle: { color: ['#FF6B00', '#E6A23C', '#409EFF', '#F56C6C', '#909399'] } }]
                });

                const charts = [c1, c2, c3, c4];
                window.addEventListener('resize', () => charts.forEach(c => c.resize()));
            }, 100);
        }
    }

    // ---- 系统管理 ----
    function renderSysConfig(el) {
        el.innerHTML = `
            <div class="page-header"><div><h1>系统配置</h1><div class="subtitle">系统参数与业务规则配置</div></div></div>
            <div class="card mb-16">
                <div class="card-header"><div class="card-title">基本配置</div></div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">系统名称</label><input class="form-input" value="APS智能排产演示系统"></div>
                    <div class="form-group"><label class="form-label">系统语言</label><select class="form-select"><option>简体中文</option><option>English</option></select></div>
                    <div class="form-group"><label class="form-label">时区</label><select class="form-select"><option>Asia/Shanghai (UTC+8)</option></select></div>
                </div>
                <button class="btn btn-primary mt-16" onclick="App.devNotice()"><i class="fas fa-save"></i> 保存配置</button>
            </div>
        `;
    }

    function renderSysUsers(el) {
        el.innerHTML = `
            <div class="page-header"><div><h1>用户管理</h1><div class="subtitle">系统用户与权限管理</div></div><button class="btn btn-outline" onclick="App.devNotice()"><i class="fas fa-plus"></i> 添加用户</button></div>
            <div class="card">
                <div class="table-container">
                    <table><thead><tr><th>用户名</th><th>角色</th><th>部门</th><th>状态</th><th>最后登录</th></tr></thead>
                        <tbody>
                            <tr><td>admin</td><td><span class="badge badge-red">管理员</span></td><td>生产部</td><td><span class="badge badge-green">在线</span></td><td>2026-05-16 09:00</td></tr>
                            <tr><td>zhangsan</td><td><span class="badge badge-blue">计划员</span></td><td>生管部</td><td><span class="badge badge-green">在线</span></td><td>2026-05-16 08:30</td></tr>
                            <tr><td>lisi</td><td><span class="badge badge-gray">操作工</span></td><td>生产部</td><td><span class="badge badge-gray">离线</span></td><td>2026-05-15 17:00</td></tr>
                            <tr><td>wangwu</td><td><span class="badge badge-purple">质检员</span></td><td>品质部</td><td><span class="badge badge-green">在线</span></td><td>2026-05-16 08:45</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    function renderSysSecurity(el) {
        renderFakeModule(el, '安全管理', '安全策略与访问控制配置');
    }

    function renderSysCompliance(el) {
        renderFakeModule(el, '行为合规', '操作合规审计与风险监控');
    }

    function renderSysLogs(el) {
        el.innerHTML = `
            <div class="page-header"><div><h1>日志管理</h1><div class="subtitle">系统操作日志与审计</div></div><button class="btn btn-outline" onclick="App.devNotice()"><i class="fas fa-filter"></i> 筛选</button></div>
            <div class="card">
                <div class="table-container">
                    <table><thead><tr><th>时间</th><th>用户</th><th>模块</th><th>操作</th><th>状态</th></tr></thead>
                        <tbody>
                            <tr><td>2026-05-16 09:00:00</td><td>admin</td><td>排产计划</td><td>执行排产优化</td><td><span class="badge badge-green">成功</span></td></tr>
                            <tr><td>2026-05-16 08:55:00</td><td>zhangsan</td><td>订单管理</td><td>更新订单优先级</td><td><span class="badge badge-green">成功</span></td></tr>
                            <tr><td>2026-05-16 08:30:00</td><td>zhangsan</td><td>订单管理</td><td>导入订单</td><td><span class="badge badge-green">成功</span></td></tr>
                            <tr><td>2026-05-16 08:00:00</td><td>admin</td><td>系统配置</td><td>更新约束参数</td><td><span class="badge badge-green">成功</span></td></tr>
                            <tr><td>2026-05-15 17:30:00</td><td>admin</td><td>用户管理</td><td>修改用户权限</td><td><span class="badge badge-green">成功</span></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ========================
    // 工具方法
    // ========================
    function devNotice(msg) {
        toast(msg || '功能开发中，敬请期待！', 'info');
    }

    function toggleCollapse(id) {
        const body = document.getElementById(id);
        const header = body.previousElementSibling;
        if (!body || !header) return;
        body.classList.toggle('open');
        header.querySelector('i')?.classList.toggle('fa-chevron-up');
        header.querySelector('i')?.classList.toggle('fa-chevron-down');
    }

    // ========================
    // 时钟
    // ========================
    function startClock() {
        function update() {
            const now = new Date();
            const el = document.getElementById('topbar-time');
            if (el) {
                el.textContent = now.toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
            }
        }
        update();
        setInterval(update, 1000);
    }

    // ========================
    // 初始化
    // ========================
    function init() {
        startClock();

        // Nav click handlers
        document.querySelectorAll('.nav-item').forEach(el => {
            el.addEventListener('click', () => {
                navigate(el.dataset.page);
                // Close mobile sidebar
                document.querySelector('.sidebar')?.classList.remove('open');
                document.getElementById('sidebar-overlay')?.classList.remove('show');
            });
        });

        // Sidebar toggle
        document.getElementById('sidebar-toggle-btn')?.addEventListener('click', toggleSidebar);

        // Mobile sidebar toggle
        document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
            document.querySelector('.sidebar')?.classList.toggle('open');
            document.getElementById('sidebar-overlay')?.classList.toggle('show');
        });

        document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
            document.querySelector('.sidebar')?.classList.remove('open');
            document.getElementById('sidebar-overlay')?.classList.remove('show');
        });

        // Notification bell
        document.getElementById('notif-btn')?.addEventListener('click', () => {
            devNotice('暂无新通知');
        });

        // Start on dashboard
        navigate('dashboard');
    }

    // Return public API
    return {
        init,
        navigate,
        toggleSidebar,
        refreshDashboard,
        runOptimize,
        saveConstraints,
        scheduleUpload,
        handleFileUpload,
        exportSchedule,
        toggleCollapse,
        devNotice,
        devModal: devNotice,
        urgentEval,
        dismissToast,
        showModal,
        toast,
    };
})();

// Bootstrap
document.addEventListener('DOMContentLoaded', () => App.init());
