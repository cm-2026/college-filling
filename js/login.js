// ===== 背景浮点 =====
(function createDots() {
    const container = document.getElementById('bgDots');
    for (let i = 0; i < 14; i++) {
        const d = document.createElement('div');
        d.className = 'dot';
        const size = 4 + Math.random() * 8;
        d.style.cssText = `
            width:${size}px; height:${size}px;
            left:${Math.random() * 100}%;
            animation-duration:${10 + Math.random() * 18}s;
            animation-delay:${-Math.random() * 20}s;
            opacity:${0.3 + Math.random() * 0.5};
        `;
        container.appendChild(d);
    }
})();

// ===== Tab 切换 =====
function switchTab(tab) {
    clearMsg();
    document.getElementById('loginForm').classList.toggle('active', tab === 'login');
    document.getElementById('registerForm').classList.toggle('active', tab === 'register');
    document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
    document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
}

// ===== 消息提示 =====
function showMsg(text, type) {
    const box = document.getElementById('msgBox');
    box.className = 'msg-box show ' + type;
    document.getElementById('msgText').textContent = text;
}
function clearMsg() {
    document.getElementById('msgBox').className = 'msg-box';
}

// 显示页面选择对话框（管理员/root）
function showPageChoice(role) {
    const roleLabel = role === 'admin' ? '管理员' : 'root';
    
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        animation: fadeIn 0.3s ease;
    `;
    
    // 创建选择框
    overlay.innerHTML = `
        <div style="
            background: linear-gradient(135deg, #1a2332 0%, #0f172a 100%);
            border: 1px solid rgba(59, 159, 232, 0.3);
            border-radius: 16px;
            padding: 30px 40px;
            text-align: center;
            max-width: 400px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            position: relative;
        ">
            <button onclick="closePageChoice()" style="
                position: absolute;
                top: 12px;
                right: 12px;
                width: 28px;
                height: 28px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                color: #9ca3af;
                font-size: 18px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            " onmouseover="this.style.background='rgba(239, 68, 68, 0.3)';this.style.color='#f87171'" onmouseout="this.style.background='rgba(255, 255, 255, 0.1)';this.style.color='#9ca3af'">×</button>
            <div style="
                font-size: 20px;
                font-weight: 600;
                color: #3b9fe8;
                margin-bottom: 10px;
            ">欢迎，${roleLabel}</div>
            <div style="
                font-size: 14px;
                color: #9ca3af;
                margin-bottom: 25px;
            ">请选择要进入的页面</div>
            <div style="display: flex; gap: 15px; justify-content: center;">
                <button onclick="goToPage('index-mysql.html')" style="
                    flex: 1;
                    padding: 12px 24px;
                    background: rgba(59, 159, 232, 0.15);
                    border: 1px solid rgba(59, 159, 232, 0.4);
                    color: #3b9fe8;
                    border-radius: 8px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                " onmouseover="this.style.background='rgba(59, 159, 232, 0.25)'" onmouseout="this.style.background='rgba(59, 159, 232, 0.15)'">
                    🏠 首页
                </button>
                <button onclick="goToPage('admin.html')" style="
                    flex: 1;
                    padding: 12px 24px;
                    background: rgba(239, 68, 68, 0.15);
                    border: 1px solid rgba(239, 68, 68, 0.4);
                    color: #f87171;
                    border-radius: 8px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                " onmouseover="this.style.background='rgba(239, 68, 68, 0.25)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.15)'">
                    ⚙️ 后台
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

function closePageChoice() {
    const overlay = document.querySelector('div[style*="z-index: 9999"]');
    if (overlay) {
        overlay.remove();
    }
}

function goToPage(page) {
    window.location.href = page;
}

// ===== 字段校验辅助 =====
function setFieldError(inputId, errId, msg, hasError) {
    const input = document.getElementById(inputId);
    const err = document.getElementById(errId);
    if (hasError) {
        input.classList.add('invalid');
        if (msg) err.textContent = msg;
        err.classList.add('show');
    } else {
        input.classList.remove('invalid');
        err.classList.remove('show');
    }
    return !hasError;
}

// ===== 密码显示切换 =====
function togglePwd(inputId, btn) {
    const input = document.getElementById(inputId);
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    btn.innerHTML = isText
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="eye-off">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
           </svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
           </svg>`;
}

// ===== 密码强度检测 =====
function checkStrength(pwd) {
    const el = document.getElementById('pwdStrength');
    const segs = [document.getElementById('seg1'), document.getElementById('seg2'),
                  document.getElementById('seg3'), document.getElementById('seg4')];
    const label = document.getElementById('strengthLabel');

    if (!pwd) { el.classList.remove('show'); return; }
    el.classList.add('show');

    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[a-zA-Z]/.test(pwd) && /\d/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

    const levels = ['', 'weak', 'fair', 'good', 'strong'];
    const names  = ['', '弱', '一般', '较强', '强'];
    segs.forEach((s, i) => {
        s.className = 'strength-seg' + (i < score ? ' ' + levels[score] : '');
    });
    label.textContent = '密码强度：' + (names[score] || '弱');
}


const API_BASE = `http://${window.location.hostname || 'localhost'}:3000`;

// ===== 登录逻辑 =====
async function handleLogin(e) {
    e.preventDefault();
    clearMsg();
    const account  = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    let ok = true;
    ok = setFieldError('loginUsername', 'loginUsernameErr', '请输入手机号或用户名', !account) && ok;
    ok = setFieldError('loginPassword', 'loginPasswordErr', '请输入密码', !password) && ok;
    if (!ok) return false;

    const btn = document.getElementById('loginBtn');
    btn.classList.add('loading');
    btn.innerHTML = '<span class="spinner"></span>登录中...';

    try {
        const resp = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ account, password })
        });
        const data = await resp.json();
        if (data.success) {
            showMsg(`登录成功，欢迎回来 ${data.username}！`, 'success');
            localStorage.setItem('qd_userId', data.userId);
            localStorage.setItem('qd_username', data.username);
            localStorage.setItem('qd_role', data.role || 'user');
            
            // 记住我功能
            if (rememberMe) {
                localStorage.setItem('qd_rememberedAccount', account);
                localStorage.setItem('qd_rememberedPassword', password);
            } else {
                localStorage.removeItem('qd_rememberedAccount');
                localStorage.removeItem('qd_rememberedPassword');
            }
            
            // 根据角色跳转
            const role = data.role || 'user';
            if (role === 'user') {
                // 普通用户直接跳转首页
                setTimeout(() => { window.location.href = 'index-mysql.html'; }, 800);
            } else {
                // 管理员或root显示选择框
                showPageChoice(role);
            }
        } else {
            showMsg(data.message || '登录失败，请重试', 'error');
        }
    } catch (err) {
        showMsg('无法连接服务器，请检查后端是否启动', 'error');
    } finally {
        btn.classList.remove('loading');
        btn.innerHTML = '登 录';
    }

    return false;
}

// ===== 注册逻辑 =====
async function handleRegister(e) {
    e.preventDefault();
    clearMsg();
    const phone    = document.getElementById('regPhone').value.trim();
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirm  = document.getElementById('regConfirm').value;
    let ok = true;

    ok = setFieldError('regPhone', 'regPhoneErr', '请输入正确的11位手机号', !/^1[3-9]\d{9}$/.test(phone)) && ok;
    ok = setFieldError('regUsername', 'regUsernameErr', '用户名为2-16位字母、数字或汉字', username.length < 2 || username.length > 16) && ok;
    ok = setFieldError('regPassword', 'regPasswordErr', '密码需6-20位，包含字母和数字',
        !/^(?=.*[a-zA-Z])(?=.*\d).{6,20}$/.test(password)) && ok;
    ok = setFieldError('regConfirm', 'regConfirmErr', '两次输入的密码不一致', password !== confirm) && ok;

    if (!ok) return false;

    const btn = document.getElementById('registerBtn');
    btn.classList.add('loading');
    btn.innerHTML = '<span class="spinner"></span>注册中...';

    try {
        const resp = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, username, password })
        });
        const data = await resp.json();
        if (data.success) {
            showMsg('注册成功！请使用新账号登录', 'success');
            // 自动填入用户名并切换到登录页
            setTimeout(() => {
                switchTab('login');
                document.getElementById('loginUsername').value = username;
            }, 1200);
        } else {
            showMsg(data.message || '注册失败，请重试', 'error');
        }
    } catch (err) {
        showMsg('无法连接服务器，请检查后端是否启动', 'error');
    } finally {
        btn.classList.remove('loading');
        btn.innerHTML = '立即注册';
    }

    return false;
}

// ===== 忘记密码 =====
function showForgot() {
    showMsg('请联系管理员重置密码', 'error');
}

// ===== 清除字段错误（输入时） =====
document.addEventListener('input', function(e) {
    if (e.target.classList.contains('form-input')) {
        e.target.classList.remove('invalid');
        const errId = e.target.id + 'Err';
        const errEl = document.getElementById(errId);
        if (errEl) errEl.classList.remove('show');
    }
});

// ===== 页面加载时检查记住的账号密码 =====
(function loadRememberedCredentials() {
    const rememberedAccount = localStorage.getItem('qd_rememberedAccount');
    const rememberedPassword = localStorage.getItem('qd_rememberedPassword');
    
    if (rememberedAccount && rememberedPassword) {
        document.getElementById('loginUsername').value = rememberedAccount;
        document.getElementById('loginPassword').value = rememberedPassword;
        document.getElementById('rememberMe').checked = true;
    }
})();
