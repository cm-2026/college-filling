// 从URL获取学校名称参数
function getSchoolNameFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return decodeURIComponent(urlParams.get('schoolName') || '');
}

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

// 加载学校详情
async function loadSchoolDetail() {
    const schoolName = getSchoolNameFromURL();

    if (!schoolName) {
        showError('未指定学校名称');
        return;
    }

    try {
        const response = await apiFetch(`${window.location.protocol}//${window.location.hostname || 'localhost'}:3000/api/school-detail?schoolName=${encodeURIComponent(schoolName)}`);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || '加载失败');
        }

        displaySchoolDetail(result.data);
    } catch (error) {
        console.error('加载学校详情失败:', error);
        showError(error.message || '网络连接失败，请确保后端服务已启动');
    }
}

// 显示学校详情
function displaySchoolDetail(school) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';

    // 学校名称
    document.getElementById('schoolName').textContent = school.school_name;

    // 徽章
    const badges = [];
    if (school.is_985 === '是') badges.push('<span class="badge badge-985">985工程</span>');
    if (school.is_211 === '是') badges.push('<span class="badge badge-211">211工程</span>');
    if (school.is_double_first_class === '是') badges.push('<span class="badge badge-double">双一流</span>');
    if (school.is_national_key === '是') badges.push('<span class="badge badge-national">国家重点</span>');
    document.getElementById('badges').innerHTML = badges.join('');

    // 基本信息
    document.getElementById('location').textContent = `${school.province || '-'} ${school.city || ''}`;
    document.getElementById('schoolType').textContent = school.school_type || '-';
    document.getElementById('affiliation').textContent = school.affiliation || '-';
    document.getElementById('educationLevel').textContent = school.undergraduate_graduate || '-';
    document.getElementById('publicPrivate').textContent = school.public_private || '-';
    document.getElementById('establishedDate').textContent = school.established_date || '-';

    // 排名与实力
    document.getElementById('ranking').textContent = school.ranking ? `第 ${school.ranking} 名` : '暂无排名';
    document.getElementById('nationalKey').textContent = school.national_or_provincial || '-';
    document.getElementById('masterPoints').textContent = school.master_points ? `${school.master_points} 个` : '-';
    document.getElementById('doctorPoints').textContent = school.doctor_points ? `${school.doctor_points} 个` : '-';
    document.getElementById('graduateRate').textContent = school.graduate_school_rate || '-';

    // 特色专业 - 改进的标签展示
    const nationalMajorsHTML = displayMajorTags(school.national_major_features, '国家级');
    document.getElementById('nationalMajors').innerHTML = nationalMajorsHTML;

    const provincialMajorsHTML = displayMajorTags(school.provincial_major_features, '省级');
    document.getElementById('provincialMajors').innerHTML = provincialMajorsHTML;

    // 学生构成
    document.getElementById('femaleRatio').textContent = school.female_ratio || '-';
    document.getElementById('maleRatio').textContent = school.male_ratio || '-';

    // 联系方式
    document.getElementById('phone').textContent = school.admission_phone || '-';
    document.getElementById('email').innerHTML = school.email ?
        `<a href="mailto:${school.email}" class="contact-link">${school.email}</a>` : '-';
    document.getElementById('address').textContent = school.address || '-';

    const websiteLink = document.getElementById('website');
    if (school.website) {
        websiteLink.href = school.website;
        websiteLink.textContent = school.website;
    } else {
        websiteLink.textContent = '-';
    }

    // 学校简介 - 格式化排版
    const descriptionText = school.description || '';
    const descriptionContainer = document.getElementById('description');
    const showMoreBtn = document.getElementById('showMoreBtn');

    if (descriptionText.length > 200) {
        // 内容超过200字，需要截断显示
        descriptionContainer.innerHTML = formatDescription(descriptionText);
        descriptionContainer.classList.add('truncated');
        descriptionContainer.dataset.fullText = descriptionText;
        showMoreBtn.style.display = 'inline-flex';
    } else {
        // 内容较短，直接显示
        descriptionContainer.innerHTML = formatDescription(descriptionText);
        showMoreBtn.style.display = 'none';
    }
}

// 切换简介展开/收起
function toggleDescription() {
    const descriptionContainer = document.getElementById('description');
    const showMoreBtn = document.getElementById('showMoreBtn');
    const btnText = showMoreBtn.querySelector('span');

    if (descriptionContainer.classList.contains('truncated')) {
        // 展开
        descriptionContainer.classList.remove('truncated');
        showMoreBtn.classList.add('expanded');
        btnText.textContent = '收起';
    } else {
        // 收起
        descriptionContainer.classList.add('truncated');
        showMoreBtn.classList.remove('expanded');
        btnText.textContent = '显示更多';
        // 滚动到简介区域顶部
        descriptionContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// 格式化学校简介
function formatDescription(description) {
    if (!description || description.trim() === '') {
        return '<p style="color: var(--text-secondary);">暂无简介</p>';
    }

    // 清理文本
    let text = description.trim();

    // 替换多个连续空格为单个空格
    text = text.replace(/\s+/g, ' ');

    // 智能分段：根据句号、问号、感叹号、换行符分段
    // 保留原有的换行符，并按标点符号分段
    const sentences = text.split(/([。！？\n])/);

    let result = '';
    let currentParagraph = '';
    let sentenceCount = 0;

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];

        // 跳过空字符串
        if (!sentence || sentence.trim() === '') continue;

        // 如果是标点符号，加到当前段落
        if (['。', '！', '？', '\n'].includes(sentence)) {
            currentParagraph += sentence;
            sentenceCount++;

            // 每3-4句话结束一段，或者遇到换行符
            if (sentenceCount >= 3 || sentence === '\n') {
                // 过滤掉纯换行符的情况
                if (currentParagraph.replace(/[\n\s]/g, '').length > 0) {
                    result += `<p>${currentParagraph}</p>`;
                }
                currentParagraph = '';
                sentenceCount = 0;
            }
        } else {
            // 普通文本，加到当前段落
            // 如果是段落开头，首字母大写（中文不需要）
            currentParagraph += sentence;
        }
    }

    // 处理剩余的文本
    if (currentParagraph.trim().length > 0) {
        result += `<p>${currentParagraph}</p>`;
    }

    // 如果分段后仍然是单一长段落，强制按固定长度分段
    if (result === '' || text.length > 500 && !result.includes('</p><p>')) {
        const paragraphs = [];
        const chunkSize = 300; // 每段约300字
        for (let i = 0; i < text.length; i += chunkSize) {
            paragraphs.push(`<p>${text.substr(i, chunkSize)}</p>`);
        }
        result = paragraphs.join('');
    }

    // 如果没有分段，至少保持为一个段落
    if (!result) {
        result = `<p>${text}</p>`;
    }

    return result;
}

// 展示特色专业列表
function displayMajorTags(majorString, type) {
    if (!majorString || majorString.trim() === '') {
        return '<span style="color: var(--text-secondary); padding: 20px 0; display: block;">暂无数据</span>';
    }

    // 支持多种分隔符：逗号(中英文)、顿号、空格、分号、斜杠
    const separators = /[,，、；;、\s\n]+/;
    const majors = majorString.split(separators)
        .map(m => m.trim())
        .filter(m => m && m.length > 0); // 过滤空字符串

    if (majors.length === 0) {
        return '<span style="color: var(--text-secondary); padding: 20px 0; display: block;">暂无数据</span>';
    }

    // 为每个专业创建列表项
    const items = majors.map(major => {
        return `<div class="major-item">${major}</div>`;
    });

    return items.join('');
}

// 显示错误
function showError(message) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
}

// 页面加载时执行
document.addEventListener('DOMContentLoaded', loadSchoolDetail);
