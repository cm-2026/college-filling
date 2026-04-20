class AuthManager {
  constructor() {
    this.tokenKey = 'qd_token';
    this.userKey = 'qd_user';
  }

  /**
   * 登录成功后存储Token和用户信息
   */
  login(token, user) {
    try {
      localStorage.setItem(this.tokenKey, token);
      localStorage.setItem(this.userKey, JSON.stringify(user));
      console.log('✅ 登录成功，Token已保存');
      return true;
    } catch (error) {
      console.error('登录信息存储失败:', error);
      return false;
    }
  }

  /**
   * 获取存储的Token
   */
  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  /**
   * 获取存储的用户信息
   */
  getUser() {
    try {
      const userStr = localStorage.getItem(this.userKey);
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('解析用户信息失败:', error);
      return null;
    }
  }

  /**
   * 检查用户是否已登录
   */
  isLoggedIn() {
    return this.getToken() !== null && this.getToken() !== '';
  }

  /**
   * 登出，清除本地存储
   */
  logout() {
    try {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.userKey);
      console.log('✅ 已退出登录');
      return true;
    } catch (error) {
      console.error('登出失败:', error);
      return false;
    }
  }

  /**
   * 获取Authorization头
   */
  getAuthHeader() {
    const token = this.getToken();
    return token ? `Bearer ${token}` : '';
  }
}

// 创建全局认证管理器实例
const auth = new AuthManager();
