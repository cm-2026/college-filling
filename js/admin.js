var API_BASE = 'http://' + (window.location.hostname || 'localhost') + ':3000/api';
var currentPage = 1;
var pageSize = 20;
var totalUsers = 0;
var totalPages = 0;
var currentTab = 'users';

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('usersTab').style.display = tab === 'users' ? 'block' : 'none';
    document.getElementById('dashboardTab').style.display = tab === 'dashboard' ? 'block' : 'none';
    if (tab === 'dashboard') { loadDashboard(); }
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
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    
    var paginationHtml = '<div class="pagination"><span class="pagination-info">共 ' + totalUsers + ' 条记录，第 ' + currentPage + '/' + totalPages + ' 页</span><button class="btn btn-secondary" onclick="goToPage(1)" ' + (currentPage === 1 ? 'disabled' : '') + '>首页</button><button class="btn btn-secondary" onclick="goToPage(' + (currentPage - 1) + ')" ' + (currentPage === 1 ? 'disabled' : '') + '>上一页</button><button class="btn btn-secondary" onclick="goToPage(' + (currentPage + 1) + ')" ' + (currentPage >= totalPages ? 'disabled' : '') + '>下一页</button><button class="btn btn-secondary" onclick="goToPage(' + totalPages + ')" ' + (currentPage >= totalPages ? 'disabled' : '') + '>末页</button></div>';

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

    showLoginInfo();
    loadStats();
    loadUsers();
});
