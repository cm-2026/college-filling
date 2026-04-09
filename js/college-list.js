const API_BASE = `http://${window.location.hostname || 'localhost'}:3000/api`;
let allColleges = [];

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async function() {
    try {
        await loadColleges();

        // 添加搜索回车事件
        document.getElementById('searchInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchColleges();
            }
        });

        // 实时搜索
        document.getElementById('searchInput').addEventListener('input', function() {
            searchColleges();
        });

        // 搜索框滚动固定
        setupStickySearch();
    } catch (error) {
        console.error('初始化失败:', error);
        showError('系统初始化失败：' + error.message);
    }
});

// 搜索框滚动固定
function setupStickySearch() {
    const searchBox = document.querySelector('.search-box');
    const searchBoxOffset = searchBox.offsetTop;

    window.addEventListener('scroll', function() {
        if (window.pageYOffset > searchBoxOffset) {
            searchBox.classList.add('sticky');
        } else {
            searchBox.classList.remove('sticky');
        }
    });
}

// 加载所有院校数据
async function loadColleges() {
    try {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('error').style.display = 'none';

        const response = await fetch(`${API_BASE}/colleges`);
        const text = await response.text();

        if (!text || text.trim() === '') {
            throw new Error('服务器返回空响应');
        }

        const result = JSON.parse(text);

        if (!result.success) {
            throw new Error(result.error || '获取院校数据失败');
        }

        allColleges = result.data || [];
        console.log(`✅ 加载了 ${allColleges.length} 所院校`);

        // 只显示排名前100的院校
        const top100Colleges = allColleges.slice(0, 100);
        console.log(`📊 默认显示前 ${top100Colleges.length} 所院校`);

        document.getElementById('totalCount').textContent = allColleges.length;
        displayColleges(top100Colleges);

        document.getElementById('loading').style.display = 'none';
    } catch (error) {
        console.error('加载院校数据失败:', error);
        showError(error.message);
    }
}

// 显示院校列表
function displayColleges(colleges) {
    const container = document.getElementById('collegeList');
    document.getElementById('filteredCount').textContent = colleges.length;

    if (colleges.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px; grid-column: 1/-1;">
                <div style="font-size: 3rem; margin-bottom: 20px;">🔍</div>
                <h3 style="color: var(--text-secondary);">未找到匹配的院校</h3>
                <p style="color: var(--text-secondary);">请尝试其他关键词</p>
            </div>
        `;
        return;
    }

    let html = '';
    colleges.forEach(college => {
        const tags = [];

        // 处理985/211/双一流的布尔值和字符串
        const is985 = college.is_985 === true || college.is_985 === '是';
        const is211 = college.is_211 === true || college.is_211 === '是';
        const isDouble = college.is_double_first_class === true || college.is_double_first_class === '是';

        if (is985) tags.push('<span class="college-tag 985">985</span>');
        if (is211) tags.push('<span class="college-tag 211">211</span>');
        if (isDouble) tags.push('<span class="college-tag double">双一流</span>');

        html += `
            <div class="college-card" onclick="openSchoolDetail('${college.school_name}')">
                <div class="college-name">${college.school_name}</div>
                <div class="college-info">
                    <span class="college-info-item">${college.city || college.location || '未知'}</span>
                    <span class="college-info-separator">|</span>
                    <span class="college-info-item">${college.school_type || '未知'}</span>
                    <span class="college-info-separator">|</span>
                    <span class="college-info-item">${college.affiliation || '未知'}</span>
                </div>
                <div class="college-tags">
                    ${tags.join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// 搜索院校
function searchColleges() {
    const keyword = document.getElementById('searchInput').value.trim().toLowerCase();

    // 如果搜索框为空，显示前100名
    if (!keyword) {
        const top100Colleges = allColleges.slice(0, 100);
        displayColleges(top100Colleges);
        return;
    }

    // 搜索时搜索所有院校
    const filtered = allColleges.filter(college => {
        return (
            college.school_name?.toLowerCase().includes(keyword) ||
            college.location?.toLowerCase().includes(keyword) ||
            college.city?.toLowerCase().includes(keyword) ||
            college.school_type?.toLowerCase().includes(keyword) ||
            college.affiliation?.toLowerCase().includes(keyword)
        );
    });

    displayColleges(filtered);
}

// 打开学校详情页
function openSchoolDetail(schoolName) {
    const url = `school-detail.html?schoolName=${encodeURIComponent(schoolName)}`;
    window.open(url, '_blank');
}

// 显示错误
function showError(message) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
}
