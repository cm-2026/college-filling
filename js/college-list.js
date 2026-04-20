/**
 * college-list.js - 院校列表页面脚本
 * 
 * 功能：
 * - 院校数据加载与展示
 * - 多维度筛选（省份、类型、特色、性质）
 * - 实时搜索
 * - 响应式筛选面板
 * 
 * 数据源：
 * - 院校信息：dxmessage表
 * - 院校特色：college_features表
 * 
 * @author 高级开发者
 * @version 2.0
 */

// ==================== 配置常量 ====================
const CONFIG = {
    API_BASE: `http://${window.location.hostname || 'localhost'}:3000/api`,
    DEBOUNCE_DELAY: 300,           // 防抖延迟（毫秒）
    DEFAULT_DISPLAY_COUNT: 100,    // 默认显示院校数量
    DEBUG: false                   // 调试模式开关
};

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

// 筛选类型映射（统一管理，避免重复定义）
const FILTER_MAP = {
    province: 'provinceFilters',
    type: 'typeFilters',
    feature: 'featureFilters',
    nature: 'natureFilters'
};

// 筛选标签名称映射
const FILTER_LABELS = {
    province: '省份',
    type: '类型',
    feature: '特色',
    nature: '性质'
};

// ==================== 全局状态 ====================
let allColleges = [];              // 所有院校数据
let collegeFeatures = {};          // 院校特色标签映射

// 筛选状态（双状态管理：临时 + 应用）
let currentFilters = createEmptyFilters();  // 当前应用的筛选条件
let tempFilters = createEmptyFilters();     // 临时筛选条件（未确认）

let isFilterPanelExpanded = false; // 筛选面板展开状态
let filterDebounceTimer = null;    // 防抖计时器

// DOM元素缓存（提升性能）
const DOM = {
    filterPanel: null,
    filterHint: null,
    searchInput: null,
    collegeList: null,
    filteredCount: null,
    totalCount: null,
    loading: null,
    error: null,
    errorMessage: null,
    filterBadge: null,
    filterSelectedTags: null,
    filterSelectedEmpty: null
};

// ==================== 工具函数 ====================

/**
 * 创建空的筛选条件对象
 */
function createEmptyFilters() {
    return {
        province: [],
        type: [],
        feature: [],
        nature: []
    };
}

/**
 * 调试日志（仅在调试模式启用时输出）
 */
function debug(...args) {
    if (CONFIG.DEBUG) {
        console.log('[DEBUG]', ...args);
    }
}

/**
 * 缓存DOM元素引用
 */
function cacheDOMElements() {
    DOM.filterPanel = document.getElementById('filterPanel');
    DOM.filterHint = document.getElementById('filterHint');
    DOM.searchInput = document.getElementById('searchInput');
    DOM.collegeList = document.getElementById('collegeList');
    DOM.filteredCount = document.getElementById('filteredCount');
    DOM.totalCount = document.getElementById('totalCount');
    DOM.loading = document.getElementById('loading');
    DOM.error = document.getElementById('error');
    DOM.errorMessage = document.getElementById('errorMessage');
    DOM.filterBadge = document.getElementById('filterBadge');
    DOM.filterSelectedTags = document.getElementById('filterSelectedTags');
    DOM.filterSelectedEmpty = document.getElementById('filterSelectedEmpty');
}

/**
 * 深拷贝筛选条件对象
 */
function cloneFilters(filters) {
    return {
        province: [...filters.province],
        type: [...filters.type],
        feature: [...filters.feature],
        nature: [...filters.nature]
    };
}

// ==================== 筛选面板控制 ====================

/**
 * 切换筛选面板展开/折叠
 */
function toggleFilterPanel() {
    isFilterPanelExpanded = !isFilterPanelExpanded;
    
    const panel = DOM.filterPanel;
    const hint = DOM.filterHint;
    
    if (isFilterPanelExpanded) {
        panel.classList.add('expanded');
        if (hint) hint.textContent = '收起';
    } else {
        panel.classList.remove('expanded');
        if (hint) hint.textContent = '筛选';
    }
}

/**
 * 确认筛选 - 应用临时筛选条件
 */
function confirmFilters() {
    debug('确认筛选:', tempFilters);
    
    // 将临时筛选条件应用到当前筛选条件
    currentFilters = cloneFilters(tempFilters);
    
    // 执行筛选
    applyFilters();
    
    // 关闭筛选面板
    toggleFilterPanel();
}

/**
 * 重置所有筛选条件
 */
function resetFilters() {
    // 重置临时筛选条件
    tempFilters = createEmptyFilters();
    
    // 清空搜索输入框
    if (DOM.searchInput) {
        DOM.searchInput.value = '';
    }
    
    // 重置所有UI
    document.querySelectorAll('.filter-tags').forEach(container => {
        container.querySelectorAll('.filter-tag').forEach(tag => tag.classList.remove('active'));
        const allTag = container.querySelector('.filter-tag[data-value=""]');
        if (allTag) allTag.classList.add('active');
    });
    
    updateFilterDisplay();
    
    debug('已重置所有筛选条件和搜索框');
}

/**
 * 移除单个筛选条件（自动应用筛选）
 */
function removeFilter(filterType, value, event) {
    event.stopPropagation();
    
    // 从临时数组中移除指定值
    tempFilters[filterType] = tempFilters[filterType].filter(v => v !== value);
    
    // 同步到当前筛选条件（删除即生效）
    currentFilters = cloneFilters(tempFilters);
    
    // 更新UI
    const containerId = FILTER_MAP[filterType];
    if (containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const tag = container.querySelector(`.filter-tag[data-value="${value}"]`);
        if (tag) tag.classList.remove('active');
        
        // 如果没有选中的，自动选中"全部"
        if (tempFilters[filterType].length === 0) {
            const allTag = container.querySelector('.filter-tag[data-value=""]');
            if (allTag) allTag.classList.add('active');
        }
    }
    
    // 更新显示
    updateFilterDisplay();
    
    // 自动重新应用筛选
    applyFilters();
}

// ==================== 筛选UI更新 ====================

/**
 * 更新筛选数量徽章
 */
function updateFilterBadge() {
    const badge = DOM.filterBadge;
    if (!badge) return;
    
    const count = Object.values(currentFilters).reduce((sum, arr) => sum + arr.length, 0);
    
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
}

/**
 * 更新已选筛选标签显示
 */
function updateFilterDisplay() {
    const container = DOM.filterSelectedTags;
    const emptyText = DOM.filterSelectedEmpty;
    
    let html = '';
    let hasFilters = false;
    
    // 使用 tempFilters 显示当前选择的筛选条件
    Object.entries(FILTER_LABELS).forEach(([key, label]) => {
        const values = tempFilters[key];
        if (values && values.length > 0) {
            hasFilters = true;
            values.forEach(value => {
                html += `
                    <span class="filter-selected-tag" data-filter="${key}" data-value="${value}">
                        ${label}：${value}
                        <span class="remove" onclick="removeFilter('${key}', '${value}', event)">×</span>
                    </span>
                `;
            });
        }
    });
    
    if (container) {
        container.innerHTML = html;
    }
    
    // 空提示文字已通过CSS隐藏，不再需要JS控制
    
    updateFilterBadge();
}

/**
 * 更新筛选标签UI状态（根据tempFilters）
 */
function updateFilterUIState() {
    Object.entries(FILTER_MAP).forEach(([filterKey, containerId]) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // 先移除所有active状态
        container.querySelectorAll('.filter-tag').forEach(tag => {
            tag.classList.remove('active');
        });
        
        // 获取临时筛选条件的值
        const values = tempFilters[filterKey];
        
        if (values && values.length > 0) {
            // 添加active状态到选中的标签
            values.forEach(value => {
                const tag = container.querySelector(`.filter-tag[data-value="${value}"]`);
                if (tag) tag.classList.add('active');
            });
        } else {
            // 如果没有选中任何值，选中"全部"
            const allTag = container.querySelector('.filter-tag[data-value=""]');
            if (allTag) allTag.classList.add('active');
        }
    });
}

// ==================== 筛选逻辑 ====================

/**
 * 防抖筛选函数（优化性能）
 */
function debouncedApplyFilters() {
    // 显示加载状态
    if (DOM.filteredCount) {
        DOM.filteredCount.textContent = '筛选中...';
    }
    
    // 清除之前的计时器
    if (filterDebounceTimer) {
        clearTimeout(filterDebounceTimer);
    }
    
    // 设置新的计时器
    filterDebounceTimer = setTimeout(() => {
        // 使用requestAnimationFrame确保在下一帧执行
        requestAnimationFrame(() => {
            applyFilters();
        });
    }, CONFIG.DEBOUNCE_DELAY);
}

/**
 * 设置多选筛选事件
 */
function setupMultiSelectFilters(containerId, filterKey) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`容器 ${containerId} 不存在`);
        return;
    }
    
    debug(`设置筛选事件: ${containerId} -> ${filterKey}`);
    
    container.querySelectorAll('.filter-tag').forEach(tag => {
        tag.addEventListener('click', function() {
            const value = this.dataset.value;
            const isAll = value === '';
            
            debug(`点击筛选标签: ${filterKey} = ${value}`);
            
            if (isAll) {
                // 点击"全部"，清空其他所有选择
                tempFilters[filterKey] = [];
                container.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
            } else {
                // 点击具体选项
                const allTag = container.querySelector('.filter-tag[data-value=""]');
                allTag.classList.remove('active');
                
                if (this.classList.contains('active')) {
                    // 已选中，取消选择
                    this.classList.remove('active');
                    tempFilters[filterKey] = tempFilters[filterKey].filter(v => v !== value);
                    
                    // 如果没有选中的，自动选中"全部"
                    if (tempFilters[filterKey].length === 0) {
                        allTag.classList.add('active');
                    }
                } else {
                    // 未选中，添加选择
                    this.classList.add('active');
                    if (!tempFilters[filterKey].includes(value)) {
                        tempFilters[filterKey].push(value);
                    }
                }
            }
            
            debug('临时筛选条件:', tempFilters);
            
            // 只更新已选条件显示，不执行筛选
            updateFilterDisplay();
        });
    });
}

/**
 * 设置筛选事件
 */
function setupFilterEvents() {
    // 省份、类型、性质筛选
    setupMultiSelectFilters(FILTER_MAP.province, 'province');
    setupMultiSelectFilters(FILTER_MAP.type, 'type');
    setupMultiSelectFilters(FILTER_MAP.nature, 'nature');
    // 特色筛选在loadCollegeFeatures()中单独绑定
}

/**
 * 应用筛选
 */
function applyFilters() {
    const startTime = performance.now();
    
    const keyword = DOM.searchInput ? DOM.searchInput.value.trim().toLowerCase() : '';
    
    debug('应用筛选, 关键词:', keyword);
    debug('筛选条件:', currentFilters);
    debug('总院校数:', allColleges.length);
    
    // 更新已选筛选显示
    updateFilterDisplay();
    
    // 性能优化：提前计算筛选条件
    const hasProvinceFilter = currentFilters.province.length > 0;
    const hasTypeFilter = currentFilters.type.length > 0;
    const hasFeatureFilter = currentFilters.feature.length > 0;
    const hasNatureFilter = currentFilters.nature.length > 0;
    const hasKeyword = keyword.length > 0;
    
    let filtered = allColleges.filter(college => {
        // 省份筛选
        if (hasProvinceFilter) {
            const province = college.location || college.city || '';
            const match = currentFilters.province.some(p => province.includes(p));
            if (!match) return false;
        }
        
        // 类型筛选
        if (hasTypeFilter) {
            const match = currentFilters.type.includes(college.school_type);
            if (!match) return false;
        }
        
        // 特色筛选
        if (hasFeatureFilter) {
            const features = collegeFeatures[college.school_name] || [];
            const match = currentFilters.feature.some(f => features.includes(f));
            if (!match) return false;
        }
        
        // 性质筛选
        if (hasNatureFilter) {
            const publicPrivate = college.public_private || '';
            const undergraduateGraduate = college.undergraduate_graduate || '';
            
            // 判断本科/专科
            const isUndergraduate = undergraduateGraduate.includes('本科') || 
                                   undergraduateGraduate.includes('本') || 
                                   undergraduateGraduate === '本科';
            const isSpecialty = undergraduateGraduate.includes('专科') || 
                               undergraduateGraduate.includes('专') || 
                               undergraduateGraduate === '专科';
            
            const match = currentFilters.nature.some(nature => {
                if (nature === '公办') return publicPrivate === '公办';
                if (nature === '民办') return publicPrivate === '民办';
                if (nature === '本科') return isUndergraduate;
                if (nature === '专科') return isSpecialty;
                return false;
            });
            
            if (!match) return false;
        }
        
        // 关键词搜索
        if (hasKeyword) {
            return (
                college.school_name?.toLowerCase().includes(keyword) ||
                college.location?.toLowerCase().includes(keyword) ||
                college.city?.toLowerCase().includes(keyword) ||
                college.school_type?.toLowerCase().includes(keyword) ||
                college.affiliation?.toLowerCase().includes(keyword)
            );
        }
        
        return true;
    });
    
    // 排序：公办优先，再按特色标签数量降序
    filtered.sort((a, b) => {
        // 公办排前面
        const aIsPublic = a.public_private === '公办' ? 0 : 1;
        const bIsPublic = b.public_private === '公办' ? 0 : 1;
        if (aIsPublic !== bIsPublic) {
            return aIsPublic - bIsPublic;
        }
        // 特色标签数量降序
        const featuresA = collegeFeatures[a.school_name] || [];
        const featuresB = collegeFeatures[b.school_name] || [];
        return featuresB.length - featuresA.length;
    });
    
    // 如果没有任何筛选条件，只显示前100个院校
    const hasAnyFilter = hasProvinceFilter || hasTypeFilter || hasFeatureFilter || hasNatureFilter || hasKeyword;
    if (!hasAnyFilter && filtered.length > 100) {
        filtered = filtered.slice(0, 100);
    }
    
    const endTime = performance.now();
    
    if (CONFIG.DEBUG) {
        console.log(`✅ 筛选完成: ${filtered.length} 条结果, 耗时 ${(endTime - startTime).toFixed(2)}ms`);
    }
    
    displayColleges(filtered);
    
    // 同步 currentFilters 到 tempFilters
    tempFilters = cloneFilters(currentFilters);
    
    // 更新UI状态
    updateFilterUIState();
}

// ==================== 数据加载 ====================

/**
 * 加载院校特色标签
 * 数据来源: college_features表
 */
async function loadCollegeFeatures() {
    try {
        debug('开始加载院校特色标签（数据来源: college_features表）...');

        const response = await apiFetch(`${CONFIG.API_BASE}/college-features`);

        const result = await response.json();

        if (result.success) {
            collegeFeatures = result.data;
            const allFeatures = result.allFeatures;
            
            debug(`API返回 ${allFeatures.length} 个特色标签`);
            
            // 渲染院校特色筛选标签
            const featureFiltersContainer = document.getElementById(FILTER_MAP.feature);
            if (!featureFiltersContainer) {
                console.error('找不到 featureFilters 容器');
                return;
            }
            
            let html = '<span class="filter-tag active" data-value="">全部</span>';
            
            allFeatures.forEach(feature => {
                html += `<span class="filter-tag" data-value="${feature}">${feature}</span>`;
            });
            
            featureFiltersContainer.innerHTML = html;
            
            // 重新设置特色筛选事件
            setupMultiSelectFilters(FILTER_MAP.feature, 'feature');
        } else {
            console.error('API返回失败:', result);
        }
    } catch (error) {
        console.error('加载院校特色标签失败:', error);
    }
}

/**
 * 加载所有院校数据
 * 数据来源: dxmessage表
 */
async function loadColleges() {
    try {
        if (DOM.loading) DOM.loading.style.display = 'block';
        if (DOM.error) DOM.error.style.display = 'none';
        
        const response = await apiFetch(`${CONFIG.API_BASE}/colleges`);
        const text = await response.text();

        if (!text || text.trim() === '') {
            throw new Error('服务器返回空响应');
        }

        const result = JSON.parse(text);

        if (!result.success) {
            throw new Error(result.error || '获取院校数据失败');
        }

        allColleges = result.data || [];
        
        debug(`✅ 加载了 ${allColleges.length} 所院校（数据来源: dxmessage表）`);
        
        // 按特色标签数量降序排序
        allColleges.sort((a, b) => {
            const featuresA = collegeFeatures[a.school_name] || [];
            const featuresB = collegeFeatures[b.school_name] || [];
            return featuresB.length - featuresA.length;
        });
        
        // 只显示排名前N的院校
        const topColleges = allColleges.slice(0, CONFIG.DEFAULT_DISPLAY_COUNT);
        
        debug(`📊 默认显示前 ${topColleges.length} 所院校（按特色标签数量排序）`);
        
        if (DOM.totalCount) {
            DOM.totalCount.textContent = allColleges.length;
        }
        
        displayColleges(topColleges);
        
        if (DOM.loading) DOM.loading.style.display = 'none';
    } catch (error) {
        console.error('加载院校数据失败:', error);
        showError(error.message);
    }
}

// ==================== 数据展示 ====================

/**
 * 显示院校列表
 */
function displayColleges(colleges) {
    const startTime = performance.now();
    
    const container = DOM.collegeList;
    const filteredCountEl = DOM.filteredCount;
    
    if (filteredCountEl) {
        filteredCountEl.textContent = colleges.length;
    }
    
    if (!container) return;
    
    // 空结果提示
    if (colleges.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px; grid-column: 1/-1;">
                <div style="font-size: 3rem; margin-bottom: 20px;">🔍</div>
                <h3 style="color: var(--text-secondary);">未找到匹配的院校</h3>
                <p style="color: var(--text-secondary);">请尝试其他筛选条件</p>
            </div>
        `;
        return;
    }
    
    // 构建HTML
    let html = '';
    colleges.forEach(college => {
        // 获取特色标签
        const features = collegeFeatures[college.school_name] || [];
        
        // 性质信息
        const publicPrivate = college.public_private || '';
        const undergraduateGraduate = college.undergraduate_graduate || '';
        
        // 判断本科/专科
        const isUndergraduate = undergraduateGraduate.includes('本科') || 
                               undergraduateGraduate.includes('本') || 
                               undergraduateGraduate === '本科';
        const isSpecialty = undergraduateGraduate.includes('专科') || 
                           undergraduateGraduate.includes('专') || 
                           undergraduateGraduate === '专科';
        const eduLevel = isUndergraduate ? '本科' : (isSpecialty ? '专科' : '');
        
        // 组合显示
        const nature = `${publicPrivate}${eduLevel ? ' · ' + eduLevel : ''}`.trim() || '未知';
        
        html += `
            <div class="college-card" onclick="openSchoolDetail('${college.school_name}')">
                <div class="college-name">${college.school_name}</div>
                <div class="college-features">
                    ${features.map(f => `<span class="feature-text">${f}</span>`).join('')}
                </div>
                <div class="college-info-bottom">
                    <span class="info-text">${college.city || college.location || '未知'}</span>
                    <span class="info-separator">/</span>
                    <span class="info-text">${college.school_type || '未知'}</span>
                    <span class="info-separator">/</span>
                    <span class="info-text">${nature}</span>
                    ${college.affiliation ? `<span class="info-separator">/</span><span class="info-text">${college.affiliation}</span>` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    const endTime = performance.now();
    
    if (CONFIG.DEBUG) {
        console.log(`✅ 渲染完成: ${colleges.length} 个卡片, 耗时 ${(endTime - startTime).toFixed(2)}ms`);
    }
}

/**
 * 搜索院校
 */
function searchColleges() {
    debouncedApplyFilters();
}

// ==================== 滚动固定 ====================

/**
 * 搜索框滚动固定
 */
function setupStickySearch() {
    const searchBox = document.querySelector('.search-box');
    if (!searchBox) return;
    
    const searchBoxOffset = searchBox.offsetTop;
    
    window.addEventListener('scroll', function() {
        if (window.pageYOffset > searchBoxOffset) {
            searchBox.classList.add('sticky');
        } else {
            searchBox.classList.remove('sticky');
        }
    });
}

/**
 * 筛选面板滚动固定
 */
function setupStickyFilterPanel() {
    const filterPanel = DOM.filterPanel;
    const logoSection = document.querySelector('.logo-section');
    
    if (!filterPanel) return;
    
    // 记录初始位置
    let initialTop = filterPanel.offsetTop;
    let isSticky = false;
    
    // 更新固定状态
    function updateStickyState() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const logoHeight = logoSection ? logoSection.offsetHeight : 0;
        const threshold = initialTop - logoHeight - 10;
        
        // 当滚动超过阈值时，添加sticky类
        if (scrollTop > threshold && !isSticky) {
            filterPanel.classList.add('filter-panel-sticky');
            isSticky = true;
        } else if (scrollTop <= threshold && isSticky) {
            filterPanel.classList.remove('filter-panel-sticky');
            isSticky = false;
        }
    }
    
    // 监听滚动事件
    window.addEventListener('scroll', updateStickyState, { passive: true });
    
    // 初始化检查
    updateStickyState();
}

// ==================== 工具函数 ====================

/**
 * 打开学校详情页
 */
function openSchoolDetail(schoolName) {
    const url = `school-detail.html?schoolName=${encodeURIComponent(schoolName)}`;
    window.open(url, '_blank');
}

/**
 * 显示错误
 */
function showError(message) {
    if (DOM.loading) DOM.loading.style.display = 'none';
    if (DOM.error) DOM.error.style.display = 'block';
    if (DOM.errorMessage) DOM.errorMessage.textContent = message;
}

// ==================== 页面初始化 ====================

/**
 * 页面加载完成后初始化
 */
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // 1. 缓存DOM元素
        cacheDOMElements();
        
        // 2. 设置静态筛选事件（省份、类型、性质）
        setupFilterEvents();
        
        // 3. 加载院校特色标签（内部会绑定特色筛选事件）
        await loadCollegeFeatures();
        
        // 4. 加载院校数据
        await loadColleges();
        
        // 5. 添加搜索事件
        if (DOM.searchInput) {
            // 回车搜索
            DOM.searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    searchColleges();
                }
            });
            
            // 实时搜索
            DOM.searchInput.addEventListener('input', function() {
                searchColleges();
            });
        }
        
        // 6. 设置滚动固定
        setupStickySearch();
        setupStickyFilterPanel();
        
    } catch (error) {
        console.error('初始化失败:', error);
        showError('系统初始化失败：' + error.message);
    }
});
