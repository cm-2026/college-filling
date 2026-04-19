const API = `http://${window.location.hostname || 'localhost'}:3000/api`;

// 状态管理
let currentType = 'undergraduate'; // undergraduate, vocational, specialist
let currentCategory = 'all';
let allCategories = [];
let allMajors = [];
let filteredMajors = [];

// 门类名称映射（用于显示）
const categoryNames = {
    '01': '哲学',
    '02': '经济学',
    '03': '法学',
    '04': '教育学',
    '05': '文学',
    '06': '历史学',
    '07': '理学',
    '08': '工学',
    '09': '农学',
    '10': '医学',
    '11': '军事学',
    '12': '管理学',
    '13': '艺术学',
    '41': '农林牧渔大类',
    '42': '资源环境与安全大类',
    '43': '能源动力与材料大类',
    '44': '土木建筑大类',
    '45': '水利大类',
    '46': '装备制造大类',
    '47': '生物与化工大类',
    '48': '轻工纺织大类',
    '49': '食品药品与粮食大类',
    '50': '交通运输大类',
    '51': '电子信息大类',
    '52': '医药卫生大类',
    '53': '财经商贸大类',
    '54': '旅游大类',
    '55': '文化艺术大类',
    '56': '新闻传播大类',
    '57': '教育与体育大类',
    '58': '公安与司法大类',
    '59': '公共管理与服务大类',
    '60': '其他大类',
    '61': '其他大类',
    '62': '其他大类',
    '63': '其他大类',
    '64': '其他大类',
    '65': '其他大类',
    '66': '其他大类',
    '67': '其他大类',
    '68': '其他大类',
    '69': '其他大类'
};

document.addEventListener('DOMContentLoaded', async () => {
    await loadMajors();
    await loadCategories();
});

// 加载门类数据
async function loadCategories() {
    try {
        // 从 major_category 表获取门类数据（level=2）
        const res = await fetch(`${API}/major-category?level=2`);
        const json = await res.json();
        if (json.success) {
            allCategories = json.data || [];
            renderCategoryFilter();
        }
    } catch (e) {
        console.error('加载门类失败:', e);
    }
}

// 加载专业数据
async function loadMajors() {
    try {
        // 根据当前类型加载不同数据
        const typeParam = currentType === 'specialist' ? 'specialist' : 'undergraduate';
        const res = await fetch(`${API}/major-category?type=${typeParam}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error);

        allMajors = json.data || [];
        console.log('加载专业数据:', allMajors.length, '条');
        console.log('level分布:', {
            level2: allMajors.filter(m => m.level === 2).length,
            level3: allMajors.filter(m => m.level === 3).length,
            level4: allMajors.filter(m => m.level === 4).length
        });
        filterAndRender();
    } catch (e) {
        document.getElementById('majorList').innerHTML =
            `<div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <h3>加载失败</h3>
                <p>${e.message}</p>
            </div>`;
    }
}

// 渲染门类筛选 - 根据实际数据动态生成
function renderCategoryFilter() {
    const container = document.getElementById('categoryFilter');

    let html = `<button type="button" class="category-item ${currentCategory === 'all' ? 'active' : ''}" onclick="selectCategory('all')">全部</button>`;

    // 从实际数据中统计有哪些门类
    const categorySet = new Set();
    allMajors.forEach(m => {
        if (m.level === 2) {
            categorySet.add(m.code);
        } else if (m.level === 3 || m.level === 4) {
            // 通过 category_code 或 code 前缀获取门类
            const catCode = m.category_code || m.top_code;
            if (catCode) {
                categorySet.add(catCode);
            } else if (m.code && m.code.length >= 2) {
                categorySet.add(m.code.substring(0, 2));
            }
        }
    });

    // 转换为数组并排序
    const categories = Array.from(categorySet).sort();

    // 生成门类按钮
    categories.forEach(code => {
        const name = categoryNames[code] || code;
        html += `<button type="button" class="category-item ${currentCategory === code ? 'active' : ''}" onclick="selectCategory('${code}')">${name}</button>`;
    });

    container.innerHTML = html;
}

// 切换类型
function switchType(type) {
    currentType = type;
    currentCategory = 'all';

    // 更新类型按钮样式
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === type) {
            btn.classList.add('active');
        }
    });

    // 清空当前数据并重新加载
    allMajors = [];
    allCategories = [];
    document.getElementById('majorList').innerHTML = `
        <div class="loading">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">加载中...</span>
            </div>
            <h4 class="mt-3">正在加载${type === 'undergraduate' ? '本科' : '专科'}专业数据...</h4>
        </div>
    `;

    // 重新加载数据
    loadMajors().then(() => {
        loadCategories();
    });
}

// 选择门类
function selectCategory(code) {
    currentCategory = code;
    
    // 更新样式
    document.querySelectorAll('.category-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.classList.add('active');
    
    filterAndRender();
}

// 过滤并渲染
function filterAndRender() {
    const keyword = '';

    console.log('开始过滤，当前类型:', currentType, '当前门类:', currentCategory);

    // 不过滤数据，显示全部
    let filtered = [...allMajors];

    console.log('数据总量:', filtered.length, '条');
    console.log('level分布:', {
        level2: filtered.filter(m => m.level === 2).length,
        level3: filtered.filter(m => m.level === 3).length,
        level4: filtered.filter(m => m.level === 4).length
    });
    
    // 根据门类过滤（仅用于筛选显示）
    if (currentCategory !== 'all') {
        filtered = filtered.filter(m => {
            if (m.level === 2) return m.code === currentCategory;
            if (m.level === 3) {
                return m.code.startsWith(currentCategory) || m.category_code === currentCategory;
            }
            if (m.level === 4) {
                return m.code.startsWith(currentCategory) || 
                       m.category_code === currentCategory ||
                       m.top_code === currentCategory;
            }
            return false;
        });
        console.log('门类筛选后:', filtered.length, '条');
    }
    
    // 根据关键词过滤
    if (keyword) {
        filtered = filtered.filter(m => {
            const name = (m.name || '').toLowerCase();
            const code = (m.code || '').toLowerCase();
            return name.includes(keyword) || code.includes(keyword);
        });
    }
    
    filteredMajors = filtered;
    console.log('最终过滤结果:', filteredMajors.length, '条');
    renderMajorList();
    updateStats();
}

// 渲染专业列表（按门类分组）
function renderMajorList() {
    const container = document.getElementById('majorList');
    
    if (filteredMajors.length === 0) {
        container.innerHTML =
            `<div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <h3>未找到匹配的专业</h3>
                <p>请尝试其他关键词或筛选条件</p>
            </div>`;
        return;
    }
    
    // 构建层级结构
    const tree = buildTree(filteredMajors);
    
    // 渲染
    let html = '';
    tree.forEach(category => {
        const categoryCode = category.code;
        const categoryName = category.name || categoryNames[categoryCode] || categoryCode;
        
        // 统计专业类和专业数量
        let classCount = 0;
        let majorCount = 0;
        category.children.forEach(cls => {
            classCount++;
            majorCount += cls.children ? cls.children.length : 0;
        });
        
        html += `
        <div class="major-category-section">
            <div class="category-header">
                <div class="category-title">
                    ${categoryName}
                    <span class="category-code">(${categoryCode})</span>
                </div>
                <div class="category-stats">
                    <span>${classCount}</span> 个专业类，<span>${majorCount}</span> 个专业
                </div>
            </div>
            <div class="major-class-list">
                ${category.children.map(cls => renderMajorClass(cls)).join('')}
            </div>
        </div>`;
    });
    
    container.innerHTML = html;
}

// 渲染专业类
function renderMajorClass(cls) {
    const className = cls.name || '';
    const classCode = cls.code || '';
    
    // 获取专业类下的所有专业（level=4）
    const majors = cls.children || [];
    
    // 如果没有专业，显示提示
    if (majors.length === 0) {
        return `
        <div class="major-class-item">
            <div class="major-class-header">
                <span class="major-class-name">${className}</span>
                <span class="major-class-code">(${classCode})</span>
            </div>
            <div class="no-major-tip" style="color: #999; font-size: 13px; padding: 8px 0;">暂无专业数据</div>
        </div>`;
    }
    
    return `
    <div class="major-class-item">
        <div class="major-class-header">
            <span class="major-class-name">${className}</span>
            <span class="major-class-code">(${classCode})</span>
        </div>
        <div class="major-grid">
            ${majors.map(major => `
                <div class="major-item" onclick="goToMajorDetail('${escapeHtml(major.name)}')">
                    ${escapeHtml(major.name)}
                </div>
            `).join('')}
        </div>
    </div>`;
}

// 构建树形结构
function buildTree(data) {
    const map = {};
    const roots = [];
    
    // 只处理 level 2,3,4 的数据
    const validData = data.filter(item => item.level >= 2 && item.level <= 4);
    
    // 先创建映射
    validData.forEach(item => {
        map[item.id] = { ...item, children: [] };
    });
    
    // 构建层级关系
    validData.forEach(item => {
        const node = map[item.id];
        
        if (item.parent_id && map[item.parent_id]) {
            // parent_id 存在且在 map 中，正常挂载
            map[item.parent_id].children.push(node);
        } else if (item.level === 2) {
            // 门类作为根节点
            roots.push(node);
        } else if (item.level === 3) {
            // 专业类：尝试通过 category_code 找到门类
            const parentCode = item.category_code || (item.code ? item.code.substring(0, 2) : '');
            const parent = validData.find(p => p.level === 2 && p.code === parentCode);
            if (parent && map[parent.id]) {
                map[parent.id].children.push(node);
            } else {
                // 找不到父节点，创建虚拟门类
                const virtualParent = {
                    id: 'virtual_' + parentCode,
                    code: parentCode,
                    name: categoryNames[parentCode] || parentCode,
                    level: 2,
                    children: [node]
                };
                map[virtualParent.id] = virtualParent;
                roots.push(virtualParent);
            }
        } else if (item.level === 4) {
            // 专业：尝试通过 class_code 找到专业类
            const parentCode = item.class_code || (item.code ? item.code.substring(0, 4) : '');
            const parent = validData.find(p => p.level === 3 && p.code === parentCode);
            if (parent && map[parent.id]) {
                map[parent.id].children.push(node);
            } else {
                // 尝试通过 category_code 找到专业类
                const catCode = item.category_code || (item.code ? item.code.substring(0, 2) : '');
                const classItems = validData.filter(p => p.level === 3 && p.category_code === catCode);
                if (classItems.length > 0) {
                    // 挂载到第一个匹配的专业类下
                    map[classItems[0].id].children.push(node);
                } else {
                    // 创建虚拟专业类
                    const virtualClass = {
                        id: 'virtual_class_' + parentCode,
                        code: parentCode,
                        name: '专业类 ' + parentCode,
                        level: 3,
                        children: [node]
                    };
                    map[virtualClass.id] = virtualClass;
                    
                    // 为虚拟专业类找到或创建门类
                    const catParent = validData.find(p => p.level === 2 && p.code === catCode);
                    if (catParent && map[catParent.id]) {
                        map[catParent.id].children.push(virtualClass);
                    } else {
                        const virtualCatParent = {
                            id: 'virtual_cat_' + catCode,
                            code: catCode,
                            name: categoryNames[catCode] || catCode,
                            level: 2,
                            children: [virtualClass]
                        };
                        map[virtualCatParent.id] = virtualCatParent;
                        roots.push(virtualCatParent);
                    }
                }
            }
        }
    });
    
    // 按 code 排序
    roots.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    roots.forEach(root => {
        root.children.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        root.children.forEach(child => {
            if (child.children) {
                child.children.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
            }
        });
    });
    
    console.log('树形结构:', roots.length, '个门类');
    roots.forEach(r => {
        console.log(`  ${r.name}(${r.code}): ${r.children.length}个专业类`);
        r.children.forEach(c => {
            console.log(`    ${c.name}(${c.code}): ${c.children ? c.children.length : 0}个专业`);
        });
    });
    
    return roots;
}

// 更新统计信息
function updateStats() {
    const totalCount = allMajors.filter(m => m.level === 4).length;
    const totalEl = document.getElementById('totalCount');
    if (totalEl) {
        totalEl.textContent = totalCount;
    }
}

// 跳转到专业详情
function goToMajorDetail(majorName) {
    const clickedElement = event.currentTarget;
    clickedElement.classList.add('clicked');
    try {
        const encodedName = encodeURIComponent(majorName.trim());
        const typeParam = currentType === 'specialist' ? 'specialist' : 'undergraduate';
        window.open(`major-detail.html?major=${encodedName}&type=${typeParam}`, '_blank');
    } catch (error) {
        console.error('跳转失败:', error);
    }
    setTimeout(() => {
        clickedElement.classList.remove('clicked');
    }, 300);
}

// HTML转义
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');
}
