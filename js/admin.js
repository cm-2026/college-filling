var API_BASE = 'http://' + (window.location.hostname || 'localhost') + ':3000/api';
var currentPage = 1;
var pageSize = 20;
var totalUsers = 0;
var totalPages = 0;
var currentTab = 'users';
var sortField = '';
var sortOrder = '';
var echartsLoaded = false;

function loadEcharts(callback) {
    if (window.echarts) {
        echartsLoaded = true;
        if (callback) callback();
        return;
    }
    var script = document.createElement('script');
    script.src = 'https://cdn.bootcdn.net/ajax/libs/echarts/5.4.3/echarts.min.js';
    script.onload = function() {
        echartsLoaded = true;
        if (callback) callback();
    };
    document.head.appendChild(script);
}

function sortBy(field) {
    if (sortField === field) {
        sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        sortField = field;
        sortOrder = 'desc';
    }
    
    document.querySelectorAll('.sort-icon').forEach(icon => {
        icon.classList.remove('asc', 'desc');
    });
    
    var currentIcon = document.getElementById('sort-' + field);
    if (currentIcon) {
        currentIcon.classList.add(sortOrder);
    }
    
    currentPage = 1;
    loadUsers();
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('usersTab').style.display = tab === 'users' ? 'block' : 'none';
    document.getElementById('dashboardTab').style.display = tab === 'dashboard' ? 'block' : 'none';
    document.getElementById('majorCategoryTab').style.display = tab === 'majorCategory' ? 'block' : 'none';
    document.getElementById('admissionPlanTab').style.display = tab === 'admissionPlan' ? 'block' : 'none';
    if (tab === 'dashboard') {
        if (!echartsLoaded) {
            loadEcharts(loadDashboard);
        } else {
            loadDashboard();
        }
    }
    if (tab === 'majorCategory') {
        loadMajorCategory();
    }
    if (tab === 'admissionPlan') {
        loadAdmissionPlanProvinces();
        loadAdmissionPlan();
    }
}

async function loadStats() {
    try {
        var viewerRole = localStorage.getItem('qd_role') || 'user';
        var viewerId = localStorage.getItem('qd_userId') || '';
        var res = await fetch(API_BASE + '/admin/stats?viewerRole=' + encodeURIComponent(viewerRole) + '&viewerId=' + encodeURIComponent(viewerId));
        var data = await res.json();
        if (data.success) {
            document.getElementById('statTotal').textContent = data.data.total;
            document.getElementById('statToday').textContent = data.data.todayNew;
            document.getElementById('statActive').textContent = data.data.active;
            document.getElementById('statDisabled').textContent = data.data.disabled;
        }
    } catch (e) { console.error('加载统计失败:', e); }
}

async function loadUsers() {
    var search = document.getElementById('searchInput').value;
    var status = document.getElementById('statusFilter').value;
    var viewerRole = localStorage.getItem('qd_role') || 'user';
    var viewerId = localStorage.getItem('qd_userId') || '';
    var params = 'page=' + currentPage + '&pageSize=' + pageSize;
    params += '&viewerRole=' + encodeURIComponent(viewerRole);
    params += '&viewerId=' + encodeURIComponent(viewerId);
    if (search) params += '&search=' + encodeURIComponent(search);
    if (status !== '') params += '&status=' + status;
    if (sortField) params += '&sortField=' + encodeURIComponent(sortField);
    if (sortOrder) params += '&sortOrder=' + encodeURIComponent(sortOrder);

    try {
        var res = await fetch(API_BASE + '/admin/users?' + params);
        var data = await res.json();
        if (data.success) {
            totalUsers = data.pagination?.total || data.data.length;
            totalPages = data.pagination?.totalPages || Math.ceil(totalUsers / pageSize);
            renderUsers(data.data);
            renderPagination();
        } else {
            document.getElementById('tableBody').innerHTML = '<tr><td colspan="9" class="loading">' + (data.message || '加载失败') + '</td></tr>';
        }
    } catch (e) {
        console.error('加载用户失败:', e);
        document.getElementById('tableBody').innerHTML = '<tr><td colspan="9" class="loading">网络错误</td></tr>';
    }
}

function renderUsers(users) {
    if (!users || users.length === 0) {
        document.getElementById('tableBody').innerHTML = '<tr><td colspan="9" class="loading">暂无数据</td></tr>';
        document.getElementById('cardList').innerHTML = '<div class="loading">暂无数据</div>';
        return;
    }

    var tableHtml = '';
    var cardHtml = '';
    
    for (var i = 0; i < users.length; i++) {
        var user = users[i];
        var statusBadge = user.status === 1 
            ? '<span class="badge active">已启用</span>' 
            : '<span class="badge disabled">已禁用</span>';
        
        var toggleBtn = user.status === 1
            ? '<button class="btn btn-disable" onclick="toggleStatus(' + user.id + ',0)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>禁用</button>'
            : '<button class="btn btn-enable" onclick="toggleStatus(' + user.id + ',1)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>启用</button>';

        var role = user.role || 'user';
        var currentRole = localStorage.getItem('qd_role') || 'user';
        var roleSelect = '';
        var roleLabel = '';
        
        if (currentRole === 'root') {
            roleSelect = '<select class="role-select" onchange="changeRole(' + user.id + ',this.value)"><option value="user"' + (role==='user'?' selected':'') + '>用户</option><option value="admin"' + (role==='admin'?' selected':'') + '>管理员</option><option value="root"' + (role==='root'?' selected':'') + '>root</option></select>';
            roleLabel = role === 'admin' ? '管理员' : (role === 'root' ? 'root' : '用户');
        } else {
            roleLabel = role === 'admin' ? '管理员' : (role === 'root' ? 'root' : '用户');
            roleSelect = '<span style="color:#9ca3af;">' + roleLabel + '</span>';
        }

        tableHtml += '<tr><td>' + user.id + '</td><td>' + escapeHtml(user.username) + '</td><td>' + escapeHtml(user.phone) + '</td><td>******</td><td>' + statusBadge + '</td><td>' + roleSelect + '</td><td>' + formatDate(user.created_at) + '</td><td>' + (user.last_login ? formatDate(user.last_login) : '-') + '</td><td>' + toggleBtn + '<button class="btn btn-reset" onclick="resetPwd(' + user.id + ')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>重置</button><button class="btn btn-delete" onclick="deleteUser(' + user.id + ')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>删除</button></td></tr>';
        
        cardHtml += '<div class="user-card"><div class="user-card-header"><div><div class="user-card-name">' + escapeHtml(user.username) + '</div><div class="user-card-id">ID: ' + user.id + '</div></div><div>' + statusBadge + '</div></div><div class="user-card-info"><div class="user-card-info-item"><span class="user-card-label">手机号</span><span class="user-card-value">' + escapeHtml(user.phone) + '</span></div><div class="user-card-info-item"><span class="user-card-label">身份</span><span class="user-card-value">' + roleLabel + '</span></div><div class="user-card-info-item"><span class="user-card-label">注册时间</span><span class="user-card-value">' + formatDate(user.created_at) + '</span></div><div class="user-card-info-item"><span class="user-card-label">最后登录</span><span class="user-card-value">' + (user.last_login ? formatDate(user.last_login) : '-') + '</span></div></div><div class="user-card-actions">' + toggleBtn + '<button class="btn btn-reset" onclick="resetPwd(' + user.id + ')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>重置</button><button class="btn btn-delete" onclick="deleteUser(' + user.id + ')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>删除</button></div></div>';
    }
    document.getElementById('tableBody').innerHTML = tableHtml;
    document.getElementById('cardList').innerHTML = cardHtml;
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    var d = new Date(dateStr);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

async function toggleStatus(userId, newStatus) {
    if (!confirm(newStatus === 1 ? '确认启用该用户？' : '确认禁用该用户？')) return;
    try {
        var res = await fetch(API_BASE + '/admin/users/' + userId + '/status', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({status: newStatus})
        });
        var data = await res.json();
        alert(data.message || (data.success ? '操作成功' : '操作失败'));
        if (data.success) { loadUsers(); loadStats(); }
    } catch (e) { alert('网络错误'); }
}

async function changeRole(userId, newRole) {
    if (!confirm('确认修改用户身份？')) { loadUsers(); return; }
    var operatorRole = localStorage.getItem('qd_role') || 'user';
    try {
        var res = await fetch(API_BASE + '/admin/users/' + userId + '/role', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({role: newRole, operatorRole: operatorRole})
        });
        var data = await res.json();
        alert(data.message || (data.success ? '操作成功' : '操作失败'));
        if (data.success) { loadUsers(); loadStats(); }
        else loadUsers();
    } catch (e) { alert('网络错误'); loadUsers(); }
}

async function resetPwd(userId) {
    var pwd = prompt('请输入新密码（至少6位）：');
    if (!pwd || pwd.length < 6) { alert('密码长度至少6位'); return; }
    try {
        var res = await fetch(API_BASE + '/admin/users/' + userId + '/reset-password', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({newPassword: pwd})
        });
        var data = await res.json();
        alert(data.message || (data.success ? '重置成功' : '重置失败'));
    } catch (e) { alert('网络错误'); }
}

async function deleteUser(userId) {
    if (!confirm('确认删除该用户？此操作不可恢复！')) return;
    try {
        var res = await fetch(API_BASE + '/admin/users/' + userId, {method: 'DELETE'});
        var data = await res.json();
        alert(data.message || (data.success ? '删除成功' : '删除失败'));
        if (data.success) { loadUsers(); loadStats(); }
    } catch (e) { alert('网络错误'); }
}

function renderPagination() {
    if (totalPages <= 1) {
        var oldPagination = document.getElementById('paginationContainer');
        if (oldPagination) oldPagination.remove();
        return;
    }
    
    var paginationHtml = '<div class="pagination"><span class="pagination-info">' + currentPage + '/' + totalPages + '</span><button class="btn btn-secondary" onclick="goToPage(1)" ' + (currentPage === 1 ? 'disabled' : '') + '>首页</button><button class="btn btn-secondary" onclick="goToPage(' + (currentPage - 1) + ')" ' + (currentPage === 1 ? 'disabled' : '') + '>上一页</button><button class="btn btn-secondary" onclick="goToPage(' + (currentPage + 1) + ')" ' + (currentPage >= totalPages ? 'disabled' : '') + '>下一页</button><button class="btn btn-secondary" onclick="goToPage(' + totalPages + ')" ' + (currentPage >= totalPages ? 'disabled' : '') + '>末页</button></div>';

    var oldPagination = document.getElementById('paginationContainer');
    if (oldPagination) oldPagination.remove();

    var usersTab = document.getElementById('usersTab');
    var paginationDiv = document.createElement('div');
    paginationDiv.id = 'paginationContainer';
    paginationDiv.innerHTML = paginationHtml;
    usersTab.appendChild(paginationDiv);
}

function goToPage(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    loadUsers();
}

function showLoginInfo() {
    var username = localStorage.getItem('qd_username') || '未知用户';
    var role = localStorage.getItem('qd_role') || 'user';
    var roleLabel = role === 'root' ? 'root' : (role === 'admin' ? '管理员' : '用户');
    document.getElementById('pageTitle').textContent = username + ' (' + roleLabel + ')';
}

function logout() {
    localStorage.removeItem('qd_userId');
    localStorage.removeItem('qd_username');
    localStorage.removeItem('qd_role');
    window.location.href = 'login.html';
}

async function loadDashboard() {
    try {
        var res = await fetch(API_BASE + '/admin/dashboard');
        var data = await res.json();
        if (data.success) { renderDashboard(data.data); }
    } catch (e) { console.error('加载看板失败:', e); }
}

function renderDashboard(d) {
    document.getElementById('dashTodayPv').textContent = d.today.pv;
    document.getElementById('dashTodayUv').textContent = d.today.uv;
    document.getElementById('dashTodayRecommend').textContent = d.today.recommendations;
    document.getElementById('dashTodayExport').textContent = d.today.exports;
    document.getElementById('dashOnline').textContent = d.realtime.onlineUsers;
    renderCharts(d);
}

function renderCharts(d) {
    renderProvinceMap(d);
    renderCollegeRank(d);
    renderBehaviorPie(d);
}

function renderProvinceMap(d) {
    const chartDom = document.getElementById('provinceMapChart');
    if (!chartDom || !d.rankings.hotSearches || d.rankings.hotSearches.length === 0) return;
    
    const chart = echarts.init(chartDom, null, { renderer: 'canvas', devicePixelRatio: window.devicePixelRatio || 2 });
    
    fetch('china.json')
        .then(res => res.json())
        .then(geoJson => {
            echarts.registerMap('china', geoJson);
            const geoProvinceNames = geoJson.features.map(f => f.properties.name);
            const top10 = d.rankings.hotSearches.slice(0, 10);
            
            const provinceNameMap = {
                '北京': '北京市', '天津': '天津市', '上海': '上海市', '重庆': '重庆市',
                '河北': '河北省', '山西': '山西省', '辽宁': '辽宁省', '吉林': '吉林省',
                '黑龙江': '黑龙江省', '江苏': '江苏省', '浙江': '浙江省', '安徽': '安徽省',
                '福建': '福建省', '江西': '江西省', '山东': '山东省', '河南': '河南省',
                '湖北': '湖北省', '湖南': '湖南省', '广东': '广东省', '海南': '海南省',
                '四川': '四川省', '贵州': '贵州省', '云南': '云南省', '陕西': '陕西省',
                '甘肃': '甘肃省', '青海': '青海省', '台湾': '台湾省',
                '内蒙古': '内蒙古自治区', '广西': '广西壮族自治区', 
                '西藏': '西藏自治区', '宁夏': '宁夏回族自治区', '新疆': '新疆维吾尔自治区',
                '香港': '香港特别行政区', '澳门': '澳门特别行政区'
            };
            
            const mapData = top10.map((item, index) => {
                let provinceName = item.keyword.replace(/"/g, '').trim();
                let matchedName = provinceName;
                
                if (geoProvinceNames.includes(provinceName)) {
                    matchedName = provinceName;
                } else if (provinceNameMap[provinceName]) {
                    matchedName = provinceNameMap[provinceName];
                } else {
                    const fuzzyMatch = geoProvinceNames.find(geoName => 
                        geoName.includes(provinceName) || provinceName.includes(geoName.replace(/省|市|自治区|特别行政区/g, ''))
                    );
                    if (fuzzyMatch) matchedName = fuzzyMatch;
                }
                
                return { name: matchedName, value: item.count, rank: index + 1, originalName: provinceName };
            });
            
            const maxValue = Math.max(...mapData.map(d => d.value));
            const minValue = Math.min(...mapData.map(d => d.value));
            
            const option = {
                backgroundColor: 'transparent',
                tooltip: {
                    trigger: 'item',
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderColor: '#334155',
                    borderWidth: 1,
                    padding: [10, 14],
                    textStyle: { color: '#e2e8f0', fontSize: 12 },
                    formatter: function(params) {
                        if (params.data && params.data.value) {
                            return `<div style="font-weight:600;margin-bottom:4px;">🏆 第${params.data.rank}名 - ${params.data.originalName}</div><div style="color:#3b82f6;font-size:13px;">📊 ${params.data.value} 次查询</div>`;
                        }
                        return params.name;
                    }
                },
                visualMap: {
                    type: 'continuous',
                    left: 15,
                    bottom: 30,
                    min: minValue,
                    max: maxValue,
                    calculable: true,
                    orient: 'vertical',
                    itemWidth: 12,
                    itemHeight: 120,
                    text: ['高', '低'],
                    textStyle: { color: '#475569', fontSize: 11 },
                    inRange: { color: ['#dbeafe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e3a8a'] }
                },
                series: [{
                    type: 'map',
                    map: 'china',
                    roam: true,
                    zoom: 1.2,
                    center: [105, 36],
                    selectedMode: false,
                    label: { show: false },
                    emphasis: { label: { show: false }, itemStyle: { areaColor: '#f59e0b', shadowBlur: 10, shadowColor: 'rgba(245, 158, 11, 0.5)' } },
                    itemStyle: { borderColor: '#94a3b8', borderWidth: 1, areaColor: '#f1f5f9' },
                    data: mapData
                }]
            };
            chart.setOption(option);
        })
        .catch(err => console.error('地图加载失败:', err));
    
    window.addEventListener('resize', () => chart.resize());
}

function renderCollegeRank(d) {
    const chartDom = document.getElementById('collegeRankChart');
    if (!chartDom || !d.rankings.popularColleges || d.rankings.popularColleges.length === 0) return;
    
    const chart = echarts.init(chartDom, null, { renderer: 'canvas', devicePixelRatio: window.devicePixelRatio || 2 });
    const colors = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#84cc16'];
    const data = d.rankings.popularColleges.slice(0, 10);
    
    const option = {
        backgroundColor: 'transparent',
        grid: { top: 10, right: 50, bottom: 10, left: 10, containLabel: true },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: '#334155',
            borderWidth: 1,
            padding: [8, 12],
            textStyle: { color: '#e2e8f0', fontSize: 11 },
            formatter: function(params) {
                return `<div style="font-weight:500;">${params[0].name}</div><div style="color:#3b82f6;">📊 ${params[0].value} 次</div>`;
            }
        },
        xAxis: {
            type: 'value',
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: '#94a3b8', fontSize: 10 },
            splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }
        },
        yAxis: {
            type: 'category',
            inverse: true,
            data: data.map(i => i.college_name),
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: '#475569', fontSize: 10, fontWeight: '500' }
        },
        series: [{
            type: 'bar',
            data: data.map((item, index) => ({
                value: item.count,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                        { offset: 0, color: colors[index] },
                        { offset: 1, color: colors[index] + '99' }
                    ]),
                    borderRadius: [0, 4, 4, 0]
                }
            })),
            barWidth: '50%',
            barMaxWidth: 20,
            label: { show: true, position: 'right', color: '#475569', fontSize: 10, fontWeight: '600' }
        }]
    };
    
    chart.setOption(option);
    window.addEventListener('resize', () => chart.resize());
}

function renderBehaviorPie(d) {
    const chartDom = document.getElementById('behaviorPieChart');
    if (!chartDom || !d.today) return;
    
    const chart = echarts.init(chartDom, null, { renderer: 'canvas', devicePixelRatio: window.devicePixelRatio || 2 });
    const data = [
        { name: '搜索', value: d.today.searches || 0 },
        { name: '推荐', value: d.today.recommendations || 0 },
        { name: '导出', value: d.today.exports || 0 }
    ];
    
    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: '#334155',
            borderWidth: 1,
            padding: [8, 12],
            textStyle: { color: '#e2e8f0', fontSize: 11 },
            formatter: '{b}: {c} ({d}%)'
        },
        legend: { orient: 'horizontal', bottom: 10, textStyle: { color: '#64748b', fontSize: 11 }, itemWidth: 12, itemHeight: 12 },
        series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            center: ['50%', '45%'],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
            label: {
                show: true,
                position: 'center',
                formatter: function() {
                    const total = data.reduce((sum, item) => sum + item.value, 0);
                    return `{total|${total}}\n{label|总计}`;
                },
                rich: {
                    total: { fontSize: 24, fontWeight: '700', color: '#1e293b', lineHeight: 30 },
                    label: { fontSize: 11, color: '#94a3b8', lineHeight: 20 }
                }
            },
            emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' }, itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.3)' } },
            labelLine: { show: false },
            data: data,
            color: ['#3b82f6', '#8b5cf6', '#f59e0b']
        }]
    };
    
    chart.setOption(option);
    window.addEventListener('resize', () => chart.resize());
}

window.addEventListener('DOMContentLoaded', function() {
    var userId = localStorage.getItem('qd_userId');
    var role = localStorage.getItem('qd_role');

    if (!userId) {
        window.location.href = 'login.html';
        return;
    }

    if (role !== 'admin' && role !== 'root') {
        alert('您没有管理员权限');
        window.location.href = 'index-mysql.html';
        return;
    }

    // 只有 root 身份才能看到专业分类面板
    if (role !== 'root') {
        var mcBtns = document.querySelectorAll('[onclick="switchTab(\'majorCategory\')"]');
        mcBtns.forEach(function(btn) {
            btn.style.display = 'none';
        });
    }

    showLoginInfo();
    loadStats();
    loadUsers();
});

// ====================================================
// 专业分类管理
// ====================================================
var mcData = [];
var mcAllData = [];
var mcExpandedNodes = new Set(); // 记录展开的节点ID

async function loadMajorCategory() {
    try {
        var res = await fetch(API_BASE + '/major-category');
        var data = await res.json();
        if (data.success) {
            mcAllData = data.data || [];
            console.log('[loadMajorCategory] 原始数据条数:', mcAllData.length);
            console.log('[loadMajorCategory] 数据样例 (前5条):', mcAllData.slice(0, 5));
            
            // 检查 parent_id 分布
            var parentIdStats = {};
            mcAllData.forEach(function(item) {
                var key = item.parent_id == null ? 'null' : (item.parent_id === 0 ? '0' : String(item.parent_id));
                parentIdStats[key] = (parentIdStats[key] || 0) + 1;
            });
            console.log('[loadMajorCategory] parent_id 分布:', parentIdStats);
            
            // 检查 level 分布
            var levelStats = {};
            mcAllData.forEach(function(item) {
                var key = String(item.level);
                levelStats[key] = (levelStats[key] || 0) + 1;
            });
            console.log('[loadMajorCategory] level 分布:', levelStats);
            
            mcData = buildTree(mcAllData);
            renderMajorCategoryTree();
        } else {
            document.getElementById('majorCategoryTree').innerHTML = '<div class="loading">加载失败: ' + (data.error || '未知错误') + '</div>';
        }
    } catch (e) {
        console.error('加载专业分类失败:', e);
        document.getElementById('majorCategoryTree').innerHTML = '<div class="loading">网络错误</div>';
    }
}

function buildTree(data) {
    console.log('[buildTree] 开始构建树，数据条数:', data.length);
    
    var map = {};
    var roots = [];
    
    // 第一步：创建所有节点的映射
    data.forEach(function(item) {
        map[item.id] = item;
        item.children = [];
    });
    
    // 第二步：建立父子关系
    data.forEach(function(item) {
        // 检查 parent_id 是否有效（不是 null、0、undefined、空字符串）
        var hasValidParent = item.parent_id != null && item.parent_id !== 0 && item.parent_id !== '';
        
        if (hasValidParent && map[item.parent_id]) {
            // 有有效的父节点，添加到父节点的 children 中
            map[item.parent_id].children.push(item);
        } else {
            // 没有有效的父节点，作为根节点
            // 但只有 level=1 的节点才是真正的根节点
            if (item.level === 1) {
                roots.push(item);
            } else {
                // 如果 level 不是 1 但没有父节点，可能是数据问题，输出警告
                console.warn('[buildTree] 发现孤儿节点:', item);
            }
        }
    });
    
    // 按 code 排序根节点
    roots.sort(function(a, b) {
        return (a.code || '').localeCompare(b.code || '');
    });
    
    // 递归排序子节点
    function sortChildren(nodes) {
        nodes.forEach(function(node) {
            if (node.children && node.children.length > 0) {
                node.children.sort(function(a, b) {
                    return (a.code || '').localeCompare(b.code || '');
                });
                sortChildren(node.children);
            }
        });
    }
    sortChildren(roots);
    
    console.log('[buildTree] 构建完成，根节点数:', roots.length);
    return roots;
}

function renderMajorCategoryTree() {
    var container = document.getElementById('majorCategoryTree');
    if (!mcData || mcData.length === 0) {
        container.innerHTML = '<div class="loading">暂无数据</div>';
        return;
    }
    
    container.innerHTML = renderTreeNode(mcData, 0);
}

function renderTreeNode(nodes, depth) {
    var html = '';
    nodes.forEach(function(node) {
        var hasChildren = node.children && node.children.length > 0;
        var levelName = ['', '顶层', '学科门类', '专业类', '专业'][node.level] || '未知';
        var indent = depth * 24;
        var statusClass = node.status === 1 ? 'status-active' : 'status-disabled';
        
        html += '<div class="tree-node" data-id="' + node.id + '" style="padding-left:' + indent + 'px;">';
        html += '<div class="tree-node-content">';
        
        var isExpanded = mcExpandedNodes.has(node.id);
        
        if (hasChildren) {
            html += '<span class="tree-toggle ' + (isExpanded ? 'expanded' : 'collapsed') + '" onclick="toggleTreeNode(this)">▶</span>';
        } else {
            html += '<span class="tree-toggle"></span>';
        }
        
        html += '<span class="tree-code">' + escapeHtml(node.code) + '</span>';
        html += '<span class="tree-name">' + escapeHtml(node.name) + '</span>';
        html += '<span class="tree-level">' + levelName + '</span>';
        html += '<span class="tree-status ' + statusClass + '">' + (node.status === 1 ? '正常' : '禁用') + '</span>';
        
        if (node.category_name) {
            html += '<span class="tree-extra">门类: ' + escapeHtml(node.category_name) + '</span>';
        }
        if (node.class_name) {
            html += '<span class="tree-extra">类: ' + escapeHtml(node.class_name) + '</span>';
        }
        
        html += '<div class="tree-actions">';
        if (node.level < 4) {
            html += '<button class="btn btn-sm btn-success" onclick="addChildMajorCategory(' + node.id + ', ' + node.level + ')">添加子节点</button>';
        }
        html += '<button class="btn btn-sm btn-primary" onclick="editMajorCategory(' + node.id + ')">编辑</button>';
        html += '<button class="btn btn-sm btn-danger" onclick="deleteMajorCategory(' + node.id + ')">删除</button>';
        html += '</div>';
        
        html += '</div>';
        
        if (hasChildren) {
            html += '<div class="tree-children" style="display:' + (isExpanded ? 'block' : 'none') + ';">';
            html += renderTreeNode(node.children, depth + 1);
            html += '</div>';
        }
        
        html += '</div>';
    });
    return html;
}

function toggleTreeNode(el) {
    var node = el.closest('.tree-node');
    var children = node.querySelector('.tree-children');
    if (!children) return;
    
    var nodeId = parseInt(node.dataset.id);
    
    if (el.classList.contains('expanded')) {
        el.classList.remove('expanded');
        el.classList.add('collapsed');
        el.textContent = '▶';
        children.style.display = 'none';
        mcExpandedNodes.delete(nodeId);
    } else {
        el.classList.remove('collapsed');
        el.classList.add('expanded');
        el.textContent = '▼';
        children.style.display = 'block';
        mcExpandedNodes.add(nodeId);
    }
}

function addChildMajorCategory(parentId, parentLevel) {
    // 子节点层级 = 父节点层级 + 1
    var childLevel = parentLevel + 1;
    
    // 确保父节点展开
    mcExpandedNodes.add(parentId);
    
    // 根据父节点生成默认编码
    var parent = mcAllData.find(function(i) { return i.id === parentId; });
    var defaultCode = generateDefaultCode(parent, childLevel);
    
    showMajorCategoryModal(parentId, childLevel, defaultCode);
}

function generateDefaultCode(parent, childLevel) {
    if (!parent) return '';
    
    // 获取同父节点下的所有子节点
    var siblings = mcAllData.filter(function(i) { return i.parent_id === parent.id; });
    
    if (childLevel === 2) {
        // 学科门类：两位数字，找最大值+1
        var maxCode = 0;
        siblings.forEach(function(s) {
            var codeNum = parseInt(s.code) || 0;
            if (codeNum > maxCode) maxCode = codeNum;
        });
        return String(maxCode + 1).padStart(2, '0');
    } else if (childLevel === 3) {
        // 专业类：父级门类编码 + 两位序号
        var prefix = parent.code;
        var maxSuffix = 0;
        siblings.forEach(function(s) {
            if (s.code && s.code.startsWith(prefix)) {
                var suffix = parseInt(s.code.slice(prefix.length)) || 0;
                if (suffix > maxSuffix) maxSuffix = suffix;
            }
        });
        return prefix + String(maxSuffix + 1).padStart(2, '0');
    } else if (childLevel === 4) {
        // 专业：父级专业类编码 + 两位序号
        var prefix = parent.code;
        var maxSuffix = 0;
        siblings.forEach(function(s) {
            if (s.code && s.code.startsWith(prefix)) {
                var suffix = parseInt(s.code.slice(prefix.length)) || 0;
                if (suffix > maxSuffix) maxSuffix = suffix;
            }
        });
        return prefix + String(maxSuffix + 1).padStart(2, '0');
    }
    
    return '';
}

function showMajorCategoryModal(parentId, level, defaultCode) {
    document.getElementById('mcModalTitle').textContent = '新增专业分类';
    document.getElementById('mcId').value = '';
    document.getElementById('mcCode').value = defaultCode || '';
    document.getElementById('mcName').value = '';
    document.getElementById('mcLevel').value = level || '2';
    document.getElementById('mcStatus').value = '1';
    
    updateParentOptions();
    
    if (parentId) {
        document.getElementById('mcParentId').value = parentId;
    }
    
    document.getElementById('majorCategoryModal').style.display = 'flex';
}

function closeMajorCategoryModal() {
    document.getElementById('majorCategoryModal').style.display = 'none';
}

function updateParentOptions() {
    var level = parseInt(document.getElementById('mcLevel').value);
    var parentLevel = level - 1;
    var parentSelect = document.getElementById('mcParentId');
    
    var options = '<option value="">无</option>';
    
    if (parentLevel >= 1) {
        var parents = mcAllData.filter(function(item) { return item.level === parentLevel; });
        parents.forEach(function(p) {
            options += '<option value="' + p.id + '">' + escapeHtml(p.code) + ' - ' + escapeHtml(p.name) + '</option>';
        });
    }
    
    parentSelect.innerHTML = options;
    
    // 显示/隐藏父级选择
    document.getElementById('mcParentGroup').style.display = parentLevel >= 1 ? 'block' : 'none';
}

async function editMajorCategory(id) {
    var item = mcAllData.find(function(i) { return i.id === id; });
    if (!item) return;
    
    document.getElementById('mcModalTitle').textContent = '编辑专业分类';
    document.getElementById('mcId').value = item.id;
    document.getElementById('mcCode').value = item.code;
    document.getElementById('mcName').value = item.name;
    document.getElementById('mcLevel').value = item.level;
    document.getElementById('mcStatus').value = item.status;
    
    updateParentOptions();
    
    if (item.parent_id) {
        document.getElementById('mcParentId').value = item.parent_id;
    }
    
    document.getElementById('majorCategoryModal').style.display = 'flex';
}

async function deleteMajorCategory(id) {
    if (!confirm('确认删除此分类？如果存在子分类，将一并删除！')) return;
    
    try {
        var res = await fetch(API_BASE + '/major-category/' + id, {
            method: 'DELETE'
        });
        var data = await res.json();
        alert(data.message || (data.success ? '删除成功' : '删除失败'));
        if (data.success) {
            loadMajorCategory();
        }
    } catch (e) {
        alert('网络错误');
    }
}

document.getElementById('mcForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    var id = document.getElementById('mcId').value;
    var code = document.getElementById('mcCode').value.trim();
    var name = document.getElementById('mcName').value.trim();
    var level = parseInt(document.getElementById('mcLevel').value);
    var parentId = document.getElementById('mcParentId').value;
    var status = parseInt(document.getElementById('mcStatus').value);
    
    if (!code || !name) {
        alert('请填写编码和名称');
        return;
    }
    
    var body = {
        code: code,
        name: name,
        level: level,
        status: status
    };
    
    if (parentId) {
        body.parent_id = parseInt(parentId);
    }
    
    // 设置冗余字段和 top_code
    if (level >= 2) {
        var parent = mcAllData.find(function(i) { return i.id === parseInt(parentId); });
        if (parent) {
            // 设置 top_code
            body.top_code = parent.top_code || parent.code;
            
            if (level === 2) {
                body.category_code = code;
                body.category_name = name;
            } else if (level === 3) {
                body.category_code = parent.category_code || parent.code;
                body.category_name = parent.category_name || parent.name;
                body.class_code = code;
                body.class_name = name;
            } else if (level === 4) {
                body.category_code = parent.category_code || parent.code;
                body.category_name = parent.category_name || parent.name;
                body.class_code = parent.class_code || parent.code;
                body.class_name = parent.class_name || parent.name;
            }
        }
    } else if (level === 1) {
        // 顶层节点，top_code 就是自己的 code
        body.top_code = code;
    }
    
    try {
        var url = API_BASE + '/major-category' + (id ? '/' + id : '');
        var method = id ? 'PUT' : 'POST';
        
        var res = await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
        var data = await res.json();
        if (data.success) {
            closeMajorCategoryModal();
            loadMajorCategory();
        } else {
            alert(data.message || '保存失败');
        }
    } catch (e) {
        alert('网络错误');
    }
});

// ====================================================
// 招生计划管理
// ====================================================
var apCurrentPage = 1;
var apPageSize = 10; // 每页显示10条
var apTotalPages = 0;
var apTotalCount = 0; // 总数据量

async function loadAdmissionPlanProvinces() {
    try {
        var res = await fetch(API_BASE + '/admission-plan/provinces');
        var data = await res.json();
        if (data.success) {
            var select = document.getElementById('apProvinceFilter');
            select.innerHTML = '<option value="">全部省份</option>';
            data.data.forEach(function(province) {
                select.innerHTML += '<option value="' + escapeHtml(province) + '">' + escapeHtml(province) + '</option>';
            });
        }
    } catch (e) {
        console.error('加载省份列表失败:', e);
    }
}

async function loadAdmissionPlan() {
    var province = document.getElementById('apProvinceFilter').value;
    var subjectType = document.getElementById('apSubjectTypeFilter').value;
    var search = document.getElementById('apSearchInput').value;
    
    var params = 'page=' + apCurrentPage + '&pageSize=' + apPageSize;
    if (province) params += '&province=' + encodeURIComponent(province);
    if (subjectType) params += '&subject_type=' + encodeURIComponent(subjectType);
    if (search) params += '&search=' + encodeURIComponent(search);

    try {
        var res = await fetch(API_BASE + '/admission-plan?' + params);
        var data = await res.json();
        if (data.success) {
            renderAdmissionPlan(data.data);
            apTotalPages = data.pagination.totalPages;
            apTotalCount = data.pagination.total;
            renderAdmissionPlanPagination();
        } else {
            document.getElementById('admissionPlanBody').innerHTML = '<tr><td colspan="26" class="loading">' + (data.message || '加载失败') + '</td></tr>';
        }
    } catch (e) {
        console.error('加载招生计划失败:', e);
        document.getElementById('admissionPlanBody').innerHTML = '<tr><td colspan="26" class="loading">网络错误</td></tr>';
    }
}

function renderAdmissionPlan(data) {
    if (!data || data.length === 0) {
        document.getElementById('admissionPlanBody').innerHTML = '<tr><td colspan="26" class="loading">暂无数据</td></tr>';
        return;
    }

    var html = '';
    data.forEach(function(item) {
        html += '<tr>';
        html += '<td>' + escapeHtml(item.id || '-') + '</td>';
        html += '<td>' + escapeHtml(item.year || '-') + '</td>';
        html += '<td>' + escapeHtml(item.college_code || '-') + '</td>';
        html += '<td>' + escapeHtml(item.college_name || '-') + '</td>';
        html += '<td>' + escapeHtml(item.major_name || '-') + '</td>';
        html += '<td>' + escapeHtml(item.major_code || '-') + '</td>';
        html += '<td>' + escapeHtml(item.major_group_code || '-') + '</td>';
        html += '<td>' + escapeHtml(item.subject_type || '-') + '</td>';
        html += '<td>' + escapeHtml(item.subject_require || '-') + '</td>';
        html += '<td>' + escapeHtml(item.major_level || '-') + '</td>';
        html += '<td>' + escapeHtml(item.source_province || '-') + '</td>';
        html += '<td>' + escapeHtml(item.category || '-') + '</td>';
        html += '<td>' + escapeHtml(item.major_category || '-') + '</td>';
        html += '<td>' + (item.min_score_1 != null ? item.min_score_1 : '-') + '</td>';
        html += '<td>' + (item.min_rank_1 != null ? Number(item.min_rank_1).toLocaleString() : '-') + '</td>';
        html += '<td>' + (item.group_min_score_1 != null ? item.group_min_score_1 : '-') + '</td>';
        html += '<td>' + (item.group_min_rank_1 != null ? Number(item.group_min_rank_1).toLocaleString() : '-') + '</td>';
        html += '<td>' + (item.avg_score_1 != null ? item.avg_score_1 : '-') + '</td>';
        html += '<td>' + (item.avg_rank_1 != null ? Number(item.avg_rank_1).toLocaleString() : '-') + '</td>';
        html += '<td>' + (item.plan_count_1 != null ? item.plan_count_1 : '-') + '</td>';
        html += '<td>' + (item.admit_count_1 != null ? item.admit_count_1 : '-') + '</td>';
        html += '<td>' + (item.group_admit_count_1 != null ? item.group_admit_count_1 : '-') + '</td>';
        html += '<td>' + escapeHtml(item.batch || '-') + '</td>';
        html += '<td>' + escapeHtml(item.batch_remark || '-') + '</td>';
        html += '<td>' + escapeHtml(item.major_remark || '-') + '</td>';
        html += '<td>';
        html += '<button class="btn btn-sm btn-primary" onclick="editAdmissionPlan(' + item.id + ')">编辑</button>';
        html += '<button class="btn btn-sm btn-danger" onclick="deleteAdmissionPlan(' + item.id + ')">删除</button>';
        html += '</td>';
        html += '</tr>';
    });
    
    document.getElementById('admissionPlanBody').innerHTML = html;
}

function renderAdmissionPlanPagination() {
    if (apTotalPages <= 1) {
        var oldPagination = document.getElementById('apPagination');
        if (oldPagination) oldPagination.innerHTML = '<span class="pagination-info">共 ' + apTotalCount + ' 条记录</span>';
        return;
    }
    
    var paginationHtml = '<span class="pagination-info">第' + apCurrentPage + '/' + apTotalPages + '页，共 ' + apTotalCount + ' 条</span>';
    paginationHtml += '<button class="btn btn-secondary" onclick="goToAdmissionPlanPage(1)" ' + (apCurrentPage === 1 ? 'disabled' : '') + '>首页</button>';
    paginationHtml += '<button class="btn btn-secondary" onclick="goToAdmissionPlanPage(' + (apCurrentPage - 1) + ')" ' + (apCurrentPage === 1 ? 'disabled' : '') + '>上一页</button>';
    paginationHtml += '<button class="btn btn-secondary" onclick="goToAdmissionPlanPage(' + (apCurrentPage + 1) + ')" ' + (apCurrentPage >= apTotalPages ? 'disabled' : '') + '>下一页</button>';
    paginationHtml += '<button class="btn btn-secondary" onclick="goToAdmissionPlanPage(' + apTotalPages + ')" ' + (apCurrentPage >= apTotalPages ? 'disabled' : '') + '>末页</button>';

    document.getElementById('apPagination').innerHTML = paginationHtml;
}

function goToAdmissionPlanPage(page) {
    if (page < 1 || page > apTotalPages) return;
    apCurrentPage = page;
    loadAdmissionPlan();
}

function showAdmissionPlanModal(id) {
    document.getElementById('apModalTitle').textContent = id ? '编辑招生计划' : '新增招生计划';
    document.getElementById('apId').value = '';
    document.getElementById('apYear').value = '2025';
    document.getElementById('apCollegeCode').value = '';
    document.getElementById('apCollegeName').value = '';
    document.getElementById('apMajorCode').value = '';
    document.getElementById('apMajorName').value = '';
    document.getElementById('apMajorGroupCode').value = '';
    document.getElementById('apSourceProvince').value = '河北';
    document.getElementById('apSubjectType').value = '物理';
    document.getElementById('apSubjectRequire').value = '';
    document.getElementById('apMajorLevel').value = '本科';
    document.getElementById('apCategory').value = '';
    document.getElementById('apMajorCategory').value = '';
    document.getElementById('apMinScore').value = '';
    document.getElementById('apMinRank').value = '';
    document.getElementById('apGroupMinScore').value = '';
    document.getElementById('apGroupMinRank').value = '';
    document.getElementById('apAvgScore').value = '';
    document.getElementById('apAvgRank').value = '';
    document.getElementById('apPlanCount').value = '';
    document.getElementById('apAdmitCount').value = '';
    document.getElementById('apGroupAdmitCount').value = '';
    document.getElementById('apBatch').value = '';
    document.getElementById('apBatchRemark').value = '';
    document.getElementById('apMajorRemark').value = '';
    
    document.getElementById('admissionPlanModal').style.display = 'flex';
}

function closeAdmissionPlanModal() {
    document.getElementById('admissionPlanModal').style.display = 'none';
}

async function editAdmissionPlan(id) {
    // 直接通过ID查询该条记录
    try {
        var res = await fetch(API_BASE + '/admission-plan/' + id);
        var data = await res.json();
        if (data.success) {
            var item = data.data;
            
            document.getElementById('apModalTitle').textContent = '编辑招生计划';
            document.getElementById('apId').value = item.id;
            document.getElementById('apYear').value = item.year || '2025';
            document.getElementById('apCollegeCode').value = item.college_code || '';
            document.getElementById('apCollegeName').value = item.college_name || '';
            document.getElementById('apMajorCode').value = item.major_code || '';
            document.getElementById('apMajorName').value = item.major_name || '';
            document.getElementById('apMajorGroupCode').value = item.major_group_code || '';
            document.getElementById('apSourceProvince').value = item.source_province || '河北';
            document.getElementById('apSubjectType').value = item.subject_type || '物理';
            document.getElementById('apSubjectRequire').value = item.subject_require || '';
            document.getElementById('apMajorLevel').value = item.major_level || '本科';
            document.getElementById('apCategory').value = item.category || '';
            document.getElementById('apMajorCategory').value = item.major_category || '';
            document.getElementById('apMinScore').value = item.min_score_1 || '';
            document.getElementById('apMinRank').value = item.min_rank_1 || '';
            document.getElementById('apGroupMinScore').value = item.group_min_score_1 || '';
            document.getElementById('apGroupMinRank').value = item.group_min_rank_1 || '';
            document.getElementById('apAvgScore').value = item.avg_score_1 || '';
            document.getElementById('apAvgRank').value = item.avg_rank_1 || '';
            document.getElementById('apPlanCount').value = item.plan_count_1 || '';
            document.getElementById('apAdmitCount').value = item.admit_count_1 || '';
            document.getElementById('apGroupAdmitCount').value = item.group_admit_count_1 || '';
            document.getElementById('apBatch').value = item.batch || '';
            document.getElementById('apBatchRemark').value = item.batch_remark || '';
            document.getElementById('apMajorRemark').value = item.major_remark || '';
            
            document.getElementById('admissionPlanModal').style.display = 'flex';
        } else {
            alert('未找到记录');
        }
    } catch (e) {
        alert('网络错误');
    }
}

async function deleteAdmissionPlan(id) {
    if (!confirm('确认删除此招生计划？')) return;
    
    try {
        var res = await fetch(API_BASE + '/admission-plan/' + id, {
            method: 'DELETE'
        });
        var data = await res.json();
        alert(data.message || (data.success ? '删除成功' : '删除失败'));
        if (data.success) {
            loadAdmissionPlan();
        }
    } catch (e) {
        alert('网络错误');
    }
}

document.getElementById('apForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    var id = document.getElementById('apId').value;
    var body = {
        year: document.getElementById('apYear').value || 2025,
        college_code: document.getElementById('apCollegeCode').value.trim(),
        college_name: document.getElementById('apCollegeName').value.trim(),
        major_code: document.getElementById('apMajorCode').value.trim() || null,
        major_name: document.getElementById('apMajorName').value.trim(),
        major_group_code: document.getElementById('apMajorGroupCode').value.trim() || null,
        subject_type: document.getElementById('apSubjectType').value,
        subject_require: document.getElementById('apSubjectRequire').value.trim() || null,
        major_level: document.getElementById('apMajorLevel').value || '本科',
        source_province: document.getElementById('apSourceProvince').value.trim() || '河北',
        category: document.getElementById('apCategory').value.trim() || null,
        major_category: document.getElementById('apMajorCategory').value.trim() || null,
        min_score_1: document.getElementById('apMinScore').value || null,
        min_rank_1: document.getElementById('apMinRank').value || null,
        group_min_score_1: document.getElementById('apGroupMinScore').value || null,
        group_min_rank_1: document.getElementById('apGroupMinRank').value || null,
        avg_score_1: document.getElementById('apAvgScore').value || null,
        avg_rank_1: document.getElementById('apAvgRank').value || null,
        plan_count_1: document.getElementById('apPlanCount').value || null,
        admit_count_1: document.getElementById('apAdmitCount').value || null,
        group_admit_count_1: document.getElementById('apGroupAdmitCount').value || null,
        batch: document.getElementById('apBatch').value.trim() || null,
        batch_remark: document.getElementById('apBatchRemark').value.trim() || null,
        major_remark: document.getElementById('apMajorRemark').value.trim() || null
    };
    
    if (!body.college_code || !body.college_name || !body.major_name) {
        alert('院校代码、院校名称、专业名称不能为空');
        return;
    }
    
    try {
        var url = API_BASE + '/admission-plan' + (id ? '/' + id : '');
        var method = id ? 'PUT' : 'POST';
        
        var res = await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
        var data = await res.json();
        if (data.success) {
            closeAdmissionPlanModal();
            loadAdmissionPlan();
        } else {
            alert(data.message || '保存失败');
        }
    } catch (e) {
        alert('网络错误');
    }
});

// ====================================================
// Excel批量导入招生计划
// ====================================================
var excelDataCache = []; // 缓存解析后的Excel数据

// 显示导入模态框
function showImportModal() {
    document.getElementById('importModal').style.display = 'flex';
    resetImportModal();
}

// 关闭导入模态框
function closeImportModal() {
    document.getElementById('importModal').style.display = 'none';
    resetImportModal();
}

// 重置导入模态框状态
function resetImportModal() {
    document.getElementById('excelFile').value = '';
    document.getElementById('previewSection').style.display = 'none';
    document.getElementById('progressSection').style.display = 'none';
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('importBtn').disabled = true;
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressText').textContent = '0%';
    excelDataCache = [];
}

// 切换字段映射说明展开/收起
function toggleFieldMapping() {
    var content = document.getElementById('fieldMappingContent');
    var arrow = document.getElementById('fieldMappingArrow');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        arrow.style.transform = 'rotate(180deg)';
    } else {
        content.style.display = 'none';
        arrow.style.transform = 'rotate(0deg)';
    }
}

// 下载Excel模板（xlsx格式）
function downloadTemplate() {
    // 表头
    var headers = [
        '年份', '院校代码', '院校名称', '专业代码', '专业名称',
        '专业组代码', '科类', '选科要求', '专业层次', '生源地省份',
        '门类', '专业类', '最低分', '最低位次', '组最低分',
        '组最低位次', '平均分', '平均位次', '计划数', '录取数',
        '组录取数', '批次', '批次备注', '专业备注'
    ];
    
    // 示例数据行
    var sampleRow = [
        2025, '10001', '北京大学', '010101', '哲学',
        '01', '物理', '不限', '本科', '河北',
        '综合类', '哲学', 650, 1000, 655,
        800, 660, 900, 10, 10,
        50, '本科批', '', ''
    ];
    
    // 创建数据数组
    var data = [headers, sampleRow];
    
    // 使用SheetJS生成xlsx文件
    var ws = XLSX.utils.aoa_to_sheet(data);
    
    // 设置列宽
    var colWidths = [
        { wch: 8 },  // 年份
        { wch: 12 }, // 院校代码
        { wch: 20 }, // 院校名称
        { wch: 12 }, // 专业代码
        { wch: 20 }, // 专业名称
        { wch: 12 }, // 专业组代码
        { wch: 8 },  // 科类
        { wch: 12 }, // 选科要求
        { wch: 10 }, // 专业层次
        { wch: 12 }, // 生源地省份
        { wch: 12 }, // 院校类型
        { wch: 12 }, // 专业类别
        { wch: 8 },  // 最低分
        { wch: 10 }, // 最低位次
        { wch: 10 }, // 组最低分
        { wch: 12 }, // 组最低位次
        { wch: 8 },  // 平均分
        { wch: 10 }, // 平均位次
        { wch: 8 },  // 计划数
        { wch: 8 },  // 录取数
        { wch: 10 }, // 组录取数
        { wch: 12 }, // 批次
        { wch: 15 }, // 批次备注
        { wch: 15 }  // 专业备注
    ];
    ws['!cols'] = colWidths;
    
    // 创建工作簿
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '招生计划模板');
    
    // 下载文件
    XLSX.writeFile(wb, '招生计划导入模板.xlsx');
}

// 处理文件选择
function handleFileSelect(event) {
    var file = event.target.files[0];
    if (!file) return;
    
    readExcelFile(file);
}

// 读取Excel文件
function readExcelFile(file) {
    var reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            var data = new Uint8Array(e.target.result);
            var workbook = XLSX.read(data, { type: 'array' });
            
            // 读取第一个工作表
            var firstSheetName = workbook.SheetNames[0];
            var worksheet = workbook.Sheets[firstSheetName];
            
            // 转换为JSON
            var jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (jsonData.length < 2) {
                alert('Excel文件数据不完整，请至少包含表头和一行数据');
                return;
            }
            
            // 解析数据
            var headers = jsonData[0];
            var rows = jsonData.slice(1).filter(function(row) {
                return row.length > 0 && row[0]; // 过滤空行
            });
            
            if (rows.length === 0) {
                alert('未找到有效数据');
                return;
            }
            
            if (rows.length > 1000) {
                alert('单次导入不能超过1000条，请分批导入');
                return;
            }
            
            // 转换数据格式
            excelDataCache = convertExcelData(headers, rows);
            
            // 显示预览
            showPreview(headers, rows.slice(0, 5));
            
            // 启用导入按钮
            document.getElementById('importBtn').disabled = false;
            
            alert('成功解析 ' + excelDataCache.length + ' 条数据，请预览后点击导入');
            
        } catch (err) {
            console.error('解析Excel失败:', err);
            alert('解析Excel文件失败: ' + err.message);
        }
    };
    
    reader.onerror = function() {
        alert('读取文件失败');
    };
    
    reader.readAsArrayBuffer(file);
}

// Excel列名到数据库字段的映射（支持中文和英文列名）
var fieldMapping = {
    // 中文列名
    '年份': 'year',
    '院校代码': 'college_code',
    '院校名称': 'college_name',
    '专业代码': 'major_code',
    '专业名称': 'major_name',
    '专业组代码': 'major_group_code',
    '科类': 'subject_type',
    '选科要求': 'subject_require',
    '专业层次': 'major_level',
    '生源地省份': 'source_province',
    '院校类型': 'category',
    '专业类别': 'major_category',
    '最低分': 'min_score_1',
    '最低位次': 'min_rank_1',
    '组最低分': 'group_min_score_1',
    '组最低位次': 'group_min_rank_1',
    '平均分': 'avg_score_1',
    '平均位次': 'avg_rank_1',
    '计划数': 'plan_count_1',
    '录取数': 'admit_count_1',
    '组录取数': 'group_admit_count_1',
    '批次': 'batch',
    '批次备注': 'batch_remark',
    '专业备注': 'major_remark',
    // 英文列名
    'year': 'year',
    'college_code': 'college_code',
    'college_name': 'college_name',
    'major_code': 'major_code',
    'major_name': 'major_name',
    'major_group_code': 'major_group_code',
    'subject_type': 'subject_type',
    'subject_require': 'subject_require',
    'major_level': 'major_level',
    'source_province': 'source_province',
    'category': 'category',
    'major_category': 'major_category',
    'min_score_1': 'min_score_1',
    'min_rank_1': 'min_rank_1',
    'group_min_score_1': 'group_min_score_1',
    'group_min_rank_1': 'group_min_rank_1',
    'avg_score_1': 'avg_score_1',
    'avg_rank_1': 'avg_rank_1',
    'plan_count_1': 'plan_count_1',
    'admit_count_1': 'admit_count_1',
    'group_admit_count_1': 'group_admit_count_1',
    'batch': 'batch',
    'batch_remark': 'batch_remark',
    'major_remark': 'major_remark'
};

// 转换Excel数据为API所需格式
function convertExcelData(headers, rows) {
    return rows.map(function(row) {
        var obj = {};
        headers.forEach(function(header, index) {
            var fieldName = fieldMapping[header];
            if (fieldName) {
                var value = row[index];
                // 数字字段转换
                if (['year', 'min_score_1', 'min_rank_1', 'group_min_score_1', 'group_min_rank_1',
                     'avg_score_1', 'avg_rank_1', 'plan_count_1', 'admit_count_1', 'group_admit_count_1'].indexOf(fieldName) !== -1) {
                    value = value !== undefined && value !== '' ? Number(value) : null;
                } else {
                    value = value !== undefined ? String(value).trim() : null;
                }
                obj[fieldName] = value;
            }
        });
        return obj;
    });
}

// 显示数据预览
function showPreview(headers, previewRows) {
    var thead = document.querySelector('#previewTable thead');
    var tbody = document.querySelector('#previewTable tbody');
    
    // 表头
    var headerHtml = '<tr>';
    headers.forEach(function(h) {
        headerHtml += '<th>' + escapeHtml(String(h)) + '</th>';
    });
    headerHtml += '</tr>';
    thead.innerHTML = headerHtml;
    
    // 数据行
    var bodyHtml = '';
    previewRows.forEach(function(row) {
        bodyHtml += '<tr>';
        row.forEach(function(cell) {
            bodyHtml += '<td>' + escapeHtml(String(cell !== undefined ? cell : '')) + '</td>';
        });
        bodyHtml += '</tr>';
    });
    tbody.innerHTML = bodyHtml;
    
    document.getElementById('previewCount').textContent = '共 ' + excelDataCache.length + ' 条';
    document.getElementById('previewSection').style.display = 'block';
}

// 开始导入数据
async function importExcelData() {
    if (excelDataCache.length === 0) {
        alert('请先选择Excel文件');
        return;
    }
    
    if (!confirm('确认导入 ' + excelDataCache.length + ' 条数据？')) {
        return;
    }
    
    document.getElementById('importBtn').disabled = true;
    document.getElementById('progressSection').style.display = 'block';
    
    try {
        var res = await fetch(API_BASE + '/admission-plan/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: excelDataCache })
        });
        
        var data = await res.json();
        
        // 更新进度条为100%
        document.getElementById('progressFill').style.width = '100%';
        document.getElementById('progressText').textContent = '100%';
        
        // 显示结果
        showImportResult(data);
        
        if (data.success) {
            // 刷新列表
            loadAdmissionPlan();
        }
        
    } catch (err) {
        console.error('导入失败:', err);
        alert('导入失败: ' + err.message);
        document.getElementById('importBtn').disabled = false;
    }
}

// 显示导入结果
function showImportResult(response) {
    var resultContent = document.getElementById('resultContent');
    var html = '';
    
    if (response.success) {
        var result = response.data;
        html += '<div class="result-success">';
        html += '<p>✅ ' + response.message + '</p>';
        html += '<div class="result-stats">';
        html += '<span class="stat-item">总计: ' + result.total + '</span>';
        html += '<span class="stat-item success">成功: ' + result.success + '</span>';
        if (result.failed > 0) {
            html += '<span class="stat-item error">失败: ' + result.failed + '</span>';
        }
        html += '</div>';
        
        // 显示错误详情（如果有）
        if (result.errorRecords && result.errorRecords.length > 0) {
            html += '<div class="error-details">';
            html += '<p>❌ 失败详情（前10条）:</p>';
            html += '<ul>';
            result.errorRecords.forEach(function(err) {
                html += '<li>第' + err.index + '行: ' + escapeHtml(err.error) + '</li>';
            });
            html += '</ul>';
            html += '</div>';
        }
        html += '</div>';
    } else {
        html += '<div class="result-error">';
        html += '<p>❌ 导入失败: ' + escapeHtml(response.message) + '</p>';
        html += '</div>';
    }
    
    resultContent.innerHTML = html;
    document.getElementById('resultSection').style.display = 'block';
}

// 拖拽上传支持
var uploadArea = document.getElementById('fileUploadArea');
if (uploadArea) {
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        var files = e.dataTransfer.files;
        if (files.length > 0) {
            var file = files[0];
            if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                readExcelFile(file);
            } else {
                alert('请上传.xlsx或.xls格式的Excel文件');
            }
        }
    });
}
