/**
 * 公共工具函数 - 提取自多个文件重复定义
 * 包含：认证、API请求、HTML转义等通用功能
 */

// 获取认证 Token
function getAuthToken() {
    const token = localStorage.getItem('qd_token');
    if (!token) {
        console.warn('未找到认证 Token，请先登录');
        return null;
    }
    return token;
}

// 封装 API 请求，自动添加 Token
async function apiFetch(url, options = {}) {
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        // 如果返回 401，跳转到登录页
        if (response.status === 401) {
            localStorage.removeItem('qd_token');
            window.location.href = 'login.html';
            throw new Error('未授权，请重新登录');
        }

        return response;
    } catch (error) {
        console.error('API 请求失败:', error);
        throw error;
    }
}

// HTML转义 - 防止XSS攻击
function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 导出到全局
window.getAuthToken = getAuthToken;
window.apiFetch = apiFetch;
window.escapeHtml = escapeHtml;
