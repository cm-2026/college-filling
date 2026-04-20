const API = `http://${window.location.hostname || 'localhost'}:3000/api`;

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

// 院校排序优先级：985=1, 211=2, 双一流=3, 公办本科=4, 民办本科=5, 公办专科=6, 民办专科=7, 其他=8
function getSchoolOrder(school) {
    const is985 = String(school.is_985 || '').includes('985');
    const is211 = String(school.is_211 || '').includes('211');
    const isDouble = String(school.is_double_first_class || '').includes('双一流') || String(school.is_double_first_class || '').includes('1');
    const pp = String(school.public_private || '').trim();
    const ug = String(school.undergraduate_graduate || '').trim();

    if (is985) return 1;
    if (is211) return 2;
    if (isDouble) return 3;
    if (pp.includes('公办') && ug.includes('本科')) return 4;
    if (pp.includes('民办') && ug.includes('本科')) return 5;
    if (pp.includes('公办') && ug.includes('专科')) return 6;
    if (pp.includes('民办') && ug.includes('专科')) return 7;
    // 兜底：根据 major_level 判断
    const ml = String(school.major_level || '').trim();
    if (ml.includes('本科') && pp.includes('公办')) return 4;
    if (ml.includes('本科') && pp.includes('民办')) return 5;
    if (ml.includes('专科') && pp.includes('公办')) return 6;
    if (ml.includes('专科') && pp.includes('民办')) return 7;
    return 8;
}

// 状态
let majorName = '';
let majorType = ''; // undergraduate（本科）或 specialist（专科）
let allSchools = [];
let schoolPage = 0;
const SCHOOL_PAGE_SIZE = 20;

// 获取URL参数
function getUrlParam(key) {
    const params = new URLSearchParams(window.location.search);
    return params.get(key) ? decodeURIComponent(params.get(key)) : '';
}

// 页面加载
document.addEventListener('DOMContentLoaded', async () => {
    majorName = getUrlParam('major');
    majorType = getUrlParam('type') || 'undergraduate'; // 默认为本科
    if (!majorName) {
        showError('缺少专业名称参数');
        return;
    }
    const typeText = majorType === 'specialist' ? '（专科）' : '（本科）';
    document.title = `${majorName}${typeText} - 专业详情`;
    await loadMajorFullDetail();
});

// 加载专业完整详情（合并 major_introduction + major_info）
async function loadMajorFullDetail() {
    try {
        const res = await apiFetch(`${API}/major-full-detail?major_name=${encodeURIComponent(majorName)}&major_type=${majorType}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || '未找到该专业');
        renderMajorDetail(json.data);
        hideLoading();
    } catch (e) {
        console.error('加载专业详情失败:', e);
        showError(e.message);
    }
}

// 渲染专业详情
function renderMajorDetail(data) {
    // 专业名称
    const majorNameEl = document.getElementById('majorName');
    if (majorNameEl) {
        majorNameEl.textContent = data.major_name || majorName;
    }
    
    // 专业代码
    const majorCodeEl = document.getElementById('majorCode');
    if (data.major_code && majorCodeEl) {
        majorCodeEl.textContent = data.major_code;
    }

    // 学科门类
    const majorCategoryEl = document.getElementById('majorCategory');
    if (data.subject_category && majorCategoryEl) {
        majorCategoryEl.textContent = data.subject_category;
    }

    // 专业类
    const majorClassEl = document.getElementById('majorClass');
    if (data.major_class && majorClassEl) {
        majorClassEl.textContent = data.major_class;
    }

    // 关键信息图标区（现在只显示学历层次、修业年限、授予学位、男女比例）
    renderInfoIcons(data);

    // 专业介绍（优先使用 major_introduction.major_intro）
    const intro = data.major_intro || data.introduction;
    const introBlock = document.getElementById('introBlock');
    const majorIntro = document.getElementById('majorIntro');
    if (intro && introBlock && majorIntro) {
        introBlock.style.display = '';
        majorIntro.textContent = intro;
    }

    // 培养内容 (major_content)
    const content = data.major_content;
    const contentBlock = document.getElementById('contentBlock');
    const majorContent = document.getElementById('majorContent');
    if (content && contentBlock && majorContent) {
        contentBlock.style.display = '';
        majorContent.textContent = content;
    }

    // 主修课程 (优先使用 major_info.courses)
    const courses = data.courses;
    const coursesBlock = document.getElementById('coursesBlock');
    const courseTags = document.getElementById('courseTags');
    if (courses && coursesBlock && courseTags) {
        coursesBlock.style.display = '';
        let courseList = [];
        if (typeof courses === 'string') {
            // 尝试按常见分隔符拆分
            courseList = courses.split(/[、，,;\n]/).map(s => s.trim()).filter(s => s.length > 0);
        } else if (Array.isArray(courses)) {
            courseList = courses;
        }
        if (courseList.length > 0) {
            courseTags.innerHTML = courseList.map(c =>
                `<span class="course-tag">${escapeHtml(c)}</span>`
            ).join('');
        } else {
            // 如果拆分不出标签，直接显示文本
            courseTags.innerHTML = `<div class="description-text">${escapeHtml(courses)}</div>`;
        }
    }

    // 就业方向 (优先使用 major_info.career_path，其次使用 major_introduction.career_direction)
    const career = data.career_path || data.career_direction;
    const careerBlock = document.getElementById('careerBlock');
    const careerDirection = document.getElementById('careerDirection');
    if (career && careerBlock && careerDirection) {
        careerBlock.style.display = '';
        careerDirection.textContent = career;
    }

    // 就业分布
    renderEmploymentDistribution(data);

    // 开设院校
    loadSchoolsForMajor();
}

// 渲染关键信息图标区
function renderInfoIcons(data) {
    const rowAll = document.getElementById('infoRowAll');
    const iconsContainer = document.getElementById('majorInfoIcons');

    // 图标数据（只显示学历层次、修业年限、授予学位、男女比例）
    const allIcons = [];
    if (data.level) {
        allIcons.push({ type: 'level', value: data.level, label: '学历层次', icon: '🎓' });
    }
    if (data.study_years) {
        // 如果 study_years 已经包含"年"字，不再添加
        const yearsValue = String(data.study_years).includes('年') ? data.study_years : data.study_years + '年';
        allIcons.push({ type: 'years', value: yearsValue, label: '修业年限', icon: '📅' });
    }
    if (data.degree) {
        allIcons.push({ type: 'degree', value: data.degree, label: '授予学位', icon: '🏅' });
    }
    if (data.gender_ratio) {
        allIcons.push({ type: 'gender', value: data.gender_ratio, label: '男女比例', icon: '👥' });
    }

    // 渲染所有图标到一行
    if (allIcons.length > 0 && rowAll) {
        rowAll.innerHTML = allIcons.map(icon => {
            // 男女比例数据在手机端添加换行符
            let value = icon.value;
            if (icon.type === 'gender' && value.includes('、')) {
                value = value.replace('、', '<br>');
            }
            return `
            <div class="info-icon-item">
                <div class="info-icon ${icon.type}">${icon.icon}</div>
                <div class="info-icon-value">${icon.type === 'gender' ? value : escapeHtml(value)}</div>
                <div class="info-icon-label">${escapeHtml(icon.label)}</div>
            </div>
        `}).join('');
    } else if (iconsContainer) {
        iconsContainer.style.display = 'none';
    }
}

// 渲染就业分布
function renderEmploymentDistribution(data) {
    const sections = [
        { key: 'employment_region', blockId: 'regionBlock', listId: 'employmentRegion' },
        { key: 'employment_industry', blockId: 'industryBlock', listId: 'employmentIndustry' },
        { key: 'employment_position', blockId: 'positionBlock', listId: 'employmentPosition' },
        { key: 'employment_destination', blockId: 'destinationBlock', listId: 'employmentDestination' }
    ];

    sections.forEach(s => {
        const raw = data[s.key];
        if (!raw) return;

        const listEl = document.getElementById(s.listId);
        const blockEl = document.getElementById(s.blockId);
        if (!listEl || !blockEl) return;

        let items = [];
        try {
            if (typeof raw === 'string') {
                items = JSON.parse(raw);
            } else if (Array.isArray(raw)) {
                items = raw;
            }
        } catch (e) {
            // 就业去向分布直接整行显示文本
            if (s.key === 'employment_destination') {
                listEl.innerHTML = `<div class="description-text">${escapeHtml(raw)}</div>`;
                blockEl.style.display = '';
                return;
            }
            
            // 解析失败，根据类型选择分隔符
            // 就业岗位分布使用 "、"，其他使用 "；"
            const separator = s.key === 'employment_position' ? '、' : '；';
            const parts = String(raw).split(separator).filter(p => p.trim());
            if (parts.length > 0) {
                // 提取每个部分的百分比
                const parsedItems = parts.map(part => {
                    const match = part.match(/(.+?)[：:](\d+(?:\.\d+)?)%/);
                    if (match) {
                        return { name: match[1].trim(), percent: parseFloat(match[2]) };
                    }
                    return null;
                }).filter(item => item);
                
                if (parsedItems.length > 0) {
                    const maxPercent = Math.max(...parsedItems.map(item => item.percent));
                    listEl.innerHTML = parsedItems.map(item => {
                        const barWidth = maxPercent > 0 ? (item.percent / maxPercent * 100) : 0;
                        return `<div class="distribution-card">
                            <div class="distribution-card-header">
                                <span class="distribution-card-name">${escapeHtml(item.name)}</span>
                                <span class="distribution-card-percent">${item.percent}%</span>
                            </div>
                            <div class="distribution-card-bar">
                                <div class="distribution-card-progress" style="width: ${barWidth}%"></div>
                            </div>
                        </div>`;
                    }).join('');
                    blockEl.style.display = '';
                    return;
                }
            }
            // 如果拆分失败，直接显示文本
            listEl.innerHTML = `<div class="description-text">${escapeHtml(raw)}</div>`;
            blockEl.style.display = '';
            return;
        }

        if (items.length > 0) {
            // 就业去向分布直接整行显示文本
            if (s.key === 'employment_destination') {
                listEl.innerHTML = `<div class="description-text">${escapeHtml(raw)}</div>`;
                blockEl.style.display = '';
                return;
            }
            
            // 找到最大百分比用于计算进度条
            const maxPercent = Math.max(...items.map(item => parseFloat(item.percent || item.percentage || 0)));
            listEl.innerHTML = items.map(item => {
                const name = item.name || item.region || item.industry || item.position || item.destination || '';
                const percent = parseFloat(item.percent || item.percentage || 0);
                const barWidth = maxPercent > 0 ? (percent / maxPercent * 100) : 0;
                return `<div class="distribution-card">
                    <div class="distribution-card-header">
                        <span class="distribution-card-name">${escapeHtml(name)}</span>
                        <span class="distribution-card-percent">${percent}%</span>
                    </div>
                    <div class="distribution-card-bar">
                        <div class="distribution-card-progress" style="width: ${barWidth}%"></div>
                    </div>
                </div>`;
            }).join('');
            blockEl.style.display = '';
        }
    });
}

// 加载开设院校
async function loadSchoolsForMajor() {
    try {
        const res = await apiFetch(`${API}/major-detail?major_name=${encodeURIComponent(majorName)}&major_type=${majorType}`);
        const json = await res.json();
        if (!json.success) return;

        // 对院校进行去重，只保留唯一的院校名称
        const schoolsMap = new Map();
        (json.data || []).forEach(school => {
            if (school.school_name && !schoolsMap.has(school.school_name)) {
                schoolsMap.set(school.school_name, school);
            }
        });
        
        // 转换为数组并按院校属性排序：985 > 211 > 双一流 > 公办本科 > 民办本科 > 公办专科 > 民办专科
        allSchools = Array.from(schoolsMap.values()).sort((a, b) => {
            const orderA = getSchoolOrder(a);
            const orderB = getSchoolOrder(b);
            if (orderA !== orderB) return orderA - orderB;
            return (a.school_name || '').localeCompare(b.school_name || '', 'zh-CN');
        });
        
        schoolPage = 0;
        renderSchools(true);
    } catch (e) {
        console.error('加载开设院校失败:', e);
    }
}

// 渲染院校列表
function renderSchools(reset) {
    const container = document.getElementById('schoolList');
    const start = reset ? 0 : schoolPage * SCHOOL_PAGE_SIZE;
    const end = start + SCHOOL_PAGE_SIZE;
    const pageData = allSchools.slice(start, end);

    if (reset) container.innerHTML = '';

    pageData.forEach(school => {
        const item = document.createElement('a');
        item.className = 'school-item';
        item.href = `school-detail.html?schoolName=${encodeURIComponent(school.school_name)}`;
        item.innerHTML = `
            <span class="school-name">${escapeHtml(school.school_name)}</span>
        `;
        container.appendChild(item);
    });

    schoolPage++;
    const hasMore = schoolPage * SCHOOL_PAGE_SIZE < allSchools.length;
    const schoolMoreWrap = document.getElementById('schoolMoreWrap');
    if (schoolMoreWrap) {
        schoolMoreWrap.style.display = hasMore ? '' : 'none';
    }
}

// 加载更多院校
function loadMoreSchools() {
    renderSchools(false);
}

// Tab切换
function switchTab(tabName) {
    // 更新Tab导航
    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        }
    });

    // 更新Tab内容
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === `tab-${tabName}`) {
            pane.classList.add('active');
        }
    });

    // 滚动到页面顶部，确保顶部工具栏可见
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 隐藏加载
function hideLoading() {
    const loadingEl = document.getElementById('loading');
    const contentEl = document.getElementById('content');
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = '';
}

// 显示错误
function showError(msg) {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const errorMsgEl = document.getElementById('errorMessage');
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) errorEl.style.display = '';
    if (errorMsgEl) errorMsgEl.textContent = msg;
}

// HTML转义
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
