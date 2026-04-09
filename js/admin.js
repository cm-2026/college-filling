var API_BASE = 'http://' + (window.location.hostname || 'localhost') + ':3000/api';
var currentPage = 1;
var pageSize = 20;

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
    } catch (e) {
        console.error('加载统计失败:', e);
    }
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
            renderUsers(data.data);
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

    // 电脑端表格HTML
    var tableHtml = '';
    // 手机端卡片HTML
    var cardHtml = '';
    
    for (var i = 0; i < users.length; i++) {
        var user = users[i];
        var statusBadge = user.status === 1 
            ? '<span class="badge active">已启用</span>' 
            : '<span class="badge disabled">已禁用</span>';
        
        var toggleBtn = user.status === 1
            ? '<button class="btn btn-disable" onclick="toggleStatus(' + user.id + ',0)">禁用</button>'
            : '<button class="btn btn-enable" onclick="toggleStatus(' + user.id + ',1)">启用</button>';

        var role = user.role || 'user';
        var currentRole = localStorage.getItem('qd_role') || 'user';
        var roleSelect = '';
        var roleLabel = '';
        
        if (currentRole === 'root') {
            // root可以修改为任何身份
            roleSelect = '<select class="role-select" onchange="changeRole(' + user.id + ',this.value)">' +
                '<option value="user"' + (role==='user'?' selected':'') + '>用户</option>' +
                '<option value="admin"' + (role==='admin'?' selected':'') + '>管理员</option>' +
                '<option value="root"' + (role==='root'?' selected':'') + '>root</option>' +
                '</select>';
            roleLabel = role === 'admin' ? '管理员' : (role === 'root' ? 'root' : '用户');
        } else {
            // admin只能显示当前身份，不可修改
            roleLabel = role === 'admin' ? '管理员' : (role === 'root' ? 'root' : '用户');
            roleSelect = '<span style="color:#9ca3af;">' + roleLabel + '</span>';
        }

        // 电脑端表格行
        tableHtml += '<tr>' +
            '<td>' + user.id + '</td>' +
            '<td>' + escapeHtml(user.username) + '</td>' +
            '<td>' + escapeHtml(user.phone) + '</td>' +
            '<td>******</td>' +
            '<td>' + statusBadge + '</td>' +
            '<td>' + roleSelect + '</td>' +
            '<td>' + formatDate(user.created_at) + '</td>' +
            '<td>' + (user.last_login ? formatDate(user.last_login) : '-') + '</td>' +
            '<td>' + toggleBtn + '<button class="btn btn-reset" onclick="resetPwd(' + user.id + ')">重置密码</button><button class="btn btn-delete" onclick="deleteUser(' + user.id + ')">删除</button></td>' +
            '</tr>';
        
        // 手机端卡片
        cardHtml += '<div class="user-card">' +
            '<div class="user-card-header">' +
                '<div>' +
                    '<div class="user-card-name">' + escapeHtml(user.username) + '</div>' +
                    '<div class="user-card-id">ID: ' + user.id + '</div>' +
                '</div>' +
                '<div>' + statusBadge + '</div>' +
            '</div>' +
            '<div class="user-card-info">' +
                '<div class="user-card-info-item">' +
                    '<span class="user-card-label">手机号</span>' +
                    '<span class="user-card-value">' + escapeHtml(user.phone) + '</span>' +
                '</div>' +
                '<div class="user-card-info-item">' +
                    '<span class="user-card-label">身份</span>' +
                    '<span class="user-card-value">' + roleLabel + '</span>' +
                '</div>' +
                '<div class="user-card-info-item">' +
                    '<span class="user-card-label">注册时间</span>' +
                    '<span class="user-card-value">' + formatDate(user.created_at) + '</span>' +
                '</div>' +
                '<div class="user-card-info-item">' +
                    '<span class="user-card-label">最后登录</span>' +
                    '<span class="user-card-value">' + (user.last_login ? formatDate(user.last_login) : '-') + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="user-card-actions">' +
                toggleBtn +
                '<button class="btn btn-reset" onclick="resetPwd(' + user.id + ')">重置密码</button>' +
                '<button class="btn btn-delete" onclick="deleteUser(' + user.id + ')">删除</button>' +
            '</div>' +
        '</div>';
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
    return d.getFullYear() + '-' + 
           String(d.getMonth()+1).padStart(2,'0') + '-' + 
           String(d.getDate()).padStart(2,'0') + ' ' + 
           String(d.getHours()).padStart(2,'0') + ':' + 
           String(d.getMinutes()).padStart(2,'0');
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
    } catch (e) {
        alert('网络错误');
    }
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
    } catch (e) {
        alert('网络错误');
        loadUsers();
    }
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
    } catch (e) {
        alert('网络错误');
    }
}

async function deleteUser(userId) {
    if (!confirm('确认删除该用户？此操作不可恢复！')) return;
    try {
        var res = await fetch(API_BASE + '/admin/users/' + userId, {method: 'DELETE'});
        var data = await res.json();
        alert(data.message || (data.success ? '删除成功' : '删除失败'));
        if (data.success) { loadUsers(); loadStats(); }
    } catch (e) {
        alert('网络错误');
    }
}

// 显示当前登录账号信息
function showLoginInfo() {
    var username = localStorage.getItem('qd_username') || '未知用户';
    var role = localStorage.getItem('qd_role') || 'user';
    var roleLabel = role === 'root' ? 'root' : (role === 'admin' ? '管理员' : '用户');
    document.getElementById('pageTitle').textContent = username + ' (' + roleLabel + ')';
}

// 页面加载
showLoginInfo();
loadStats();
loadUsers();
