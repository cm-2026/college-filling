/**
 * ui-enhancements.js - UI交互增强工具库
 * 
 * 功能：
 * - 页面加载动画控制
 * - 平滑滚动
 * - 交互动画
 * - Toast通知
 * - 模态框管理
 * - 无障碍支持
 * 
 * @version 1.0
 */

(function() {
    'use strict';

    // ========== 页面加载管理 ==========
    const PageLoader = {
        loader: null,
        
        init() {
            // 创建加载器元素
            this.loader = document.createElement('div');
            this.loader.className = 'page-loading';
            this.loader.innerHTML = `
                <div class="loading-spinner"></div>
                <div class="loading-text">正在加载<span class="loading-dots"></span></div>
            `;
            document.body.appendChild(this.loader);
            
            // 页面加载完成后隐藏
            window.addEventListener('load', () => {
                this.hide();
            });
        },
        
        show() {
            if (this.loader) {
                this.loader.classList.remove('fade-out');
                this.loader.style.display = 'flex';
            }
        },
        
        hide() {
            if (this.loader) {
                this.loader.classList.add('fade-out');
                setTimeout(() => {
                    this.loader.style.display = 'none';
                }, 500);
            }
        }
    };

    // ========== Toast 通知系统 ==========
    const Toast = {
        container: null,
        
        init() {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            this.container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 99999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            `;
            document.body.appendChild(this.container);
        },
        
        show(message, type = 'info', duration = 3000) {
            if (!this.container) this.init();
            
            const toast = document.createElement('div');
            toast.className = `toast toast-${type} toast-enter`;
            toast.style.cssText = `
                background: white;
                border-radius: 12px;
                padding: 16px 20px;
                box-shadow: 0 10px 40px -10px rgba(0,0,0,0.2);
                display: flex;
                align-items: center;
                gap: 12px;
                min-width: 280px;
                max-width: 400px;
                pointer-events: auto;
                border-left: 4px solid;
            `;
            
            const icons = {
                success: '✓',
                error: '✕',
                warning: '⚠',
                info: 'ℹ'
            };
            
            const colors = {
                success: '#10b981',
                error: '#ef4444',
                warning: '#f59e0b',
                info: '#3b82f6'
            };
            
            toast.style.borderLeftColor = colors[type];
            
            toast.innerHTML = `
                <span style="
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: ${colors[type]}20;
                    color: ${colors[type]};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    flex-shrink: 0;
                ">${icons[type]}</span>
                <span style="flex: 1; color: #1f2937; font-size: 0.95rem;">${message}</span>
                <button onclick="this.parentElement.remove()" style="
                    background: none;
                    border: none;
                    color: #9ca3af;
                    cursor: pointer;
                    font-size: 1.2rem;
                    padding: 0;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                ">×</button>
            `;
            
            this.container.appendChild(toast);
            
            // 自动移除
            setTimeout(() => {
                toast.classList.remove('toast-enter');
                toast.classList.add('toast-exit');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        },
        
        success(message, duration) {
            this.show(message, 'success', duration);
        },
        
        error(message, duration) {
            this.show(message, 'error', duration);
        },
        
        warning(message, duration) {
            this.show(message, 'warning', duration);
        },
        
        info(message, duration) {
            this.show(message, 'info', duration);
        }
    };

    // ========== 模态框管理 ==========
    const Modal = {
        activeModal: null,
        
        init() {
            // ESC键关闭模态框
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.activeModal) {
                    this.close(this.activeModal);
                }
            });
            
            // 点击背景关闭
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-overlay') && this.activeModal) {
                    this.close(this.activeModal);
                }
            });
        },
        
        open(modalId) {
            const modal = document.getElementById(modalId);
            if (!modal) return;
            
            this.activeModal = modal;
            modal.style.display = 'flex';
            modal.classList.add('modal-enter');
            
            // 禁止背景滚动
            document.body.style.overflow = 'hidden';
            
            // 焦点管理
            const focusable = modal.querySelectorAll('button, input, select, textarea, [href]');
            if (focusable.length) {
                focusable[0].focus();
            }
        },
        
        close(modal) {
            if (typeof modal === 'string') {
                modal = document.getElementById(modal);
            }
            if (!modal) return;
            
            modal.classList.remove('modal-enter');
            modal.classList.add('modal-exit');
            
            setTimeout(() => {
                modal.style.display = 'none';
                modal.classList.remove('modal-exit');
                this.activeModal = null;
                document.body.style.overflow = '';
            }, 200);
        }
    };

    // ========== 平滑滚动 ==========
    const SmoothScroll = {
        init() {
            document.querySelectorAll('a[href^="#"]').forEach(anchor => {
                anchor.addEventListener('click', (e) => {
                    const targetId = anchor.getAttribute('href');
                    if (targetId === '#') return;
                    
                    const target = document.querySelector(targetId);
                    if (target) {
                        e.preventDefault();
                        this.scrollTo(target);
                    }
                });
            });
        },
        
        scrollTo(element, offset = 80) {
            if (!element || !element.getBoundingClientRect) {
                console.warn('[ui-enhancements] scrollTo: 元素不存在或无效');
                return;
            }
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        },
        
        scrollToTop() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
    };

    // ========== 输入防抖 ==========
    function debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ========== 输入节流 ==========
    function throttle(func, limit = 100) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // ========== 初始化 ==========
    function init() {
        // 初始化页面加载器
        PageLoader.init();
        
        // 初始化Toast
        Toast.init();
        
        // 初始化模态框
        Modal.init();
        
        // 初始化平滑滚动
        SmoothScroll.init();
        
        // 添加全局CSS变量
        document.documentElement.style.setProperty('--viewport-height', window.innerHeight + 'px');
        window.addEventListener('resize', debounce(() => {
            document.documentElement.style.setProperty('--viewport-height', window.innerHeight + 'px');
        }, 100));
    }

    // DOM加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 暴露全局API
    window.UI = {
        PageLoader,
        Toast,
        Modal,
        SmoothScroll,
        debounce,
        throttle
    };

})();
