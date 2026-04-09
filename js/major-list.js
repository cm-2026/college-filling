const API = `http://${window.location.hostname || 'localhost'}:3000/api`;
let allMajors = [];
// 已加载过详情的专业缓存
const detailCache = {};

document.addEventListener('DOMContentLoaded', async () => {
    await loadMajors();
    bindSearch();
    setupStickySearch();
});

// 搜索框滚动固定
function setupStickySearch() {
    const searchBar = document.querySelector('.search-bar');
    const searchBarOffset = searchBar.offsetTop;

    window.addEventListener('scroll', function() {
        if (window.pageYOffset > searchBarOffset) {
            searchBar.classList.add('sticky');
        } else {
            searchBar.classList.remove('sticky');
        }
    });
}

async function loadMajors() {
    try {
        const res = await fetch(`${API}/majors`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        allMajors = json.data;
        document.getElementById('totalCount').textContent = allMajors.length;
        document.getElementById('totalCountStat').textContent = allMajors.length;
        renderList(allMajors);
    } catch (e) {
        document.getElementById('majorList').innerHTML =
            `<div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <h3>加载失败</h3>
                <p>${e.message}</p>
                <p style="font-size:0.85rem;margin-top:8px">请确认后端服务已启动（3000端口）</p>
            </div>`;
    }
}

function bindSearch() {
    const searchInput = document.getElementById('searchInput');
    let timer;
    searchInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(filterAndRender, 200);
    });
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') filterAndRender(); });
}

function filterAndRender() {
    const kw = document.getElementById('searchInput').value.trim().toLowerCase();
    const list = kw ? allMajors.filter(m => m.major_name && m.major_name.toLowerCase().includes(kw)) : allMajors;
    renderList(list);
}

function renderList(list) {
    document.getElementById('resultCount').textContent = list.length;

    if (!list.length) {
        document.getElementById('majorList').innerHTML =
            `<div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <h3>未找到匹配的专业</h3>
                <p>请尝试其他关键词</p>
            </div>`;
        return;
    }

    const cards = list.map((m, idx) => {
        const introPreview = m.introduction
            ? m.introduction.replace(/<[^>]*>/g, '').substring(0, 80) + (m.introduction.length > 80 ? '…' : '')
            : '暂无专业介绍';

        const schoolCount = m.school_count != null ? m.school_count : '-';

        return `
        <div class="major-card" id="card-${idx}">
            <div class="major-card-header" onclick="toggleCard(${idx}, '${escapeHtml(m.major_name)}')">
                <div class="major-index">${idx + 1}</div>
                <div class="major-info-main">
                    <div class="major-name-text">${escapeHtml(m.major_name)}</div>
                </div>
                <div class="major-meta">
                    <div class="meta-item">
                        <div class="meta-label">开设院校</div>
                        <div class="meta-value school">${schoolCount} 所</div>
                    </div>
                </div>
                <div class="expand-icon" id="icon-${idx}">▼</div>
            </div>
            <div class="major-card-body" id="body-${idx}">
                <div class="loading-mask"><div class="spinner"></div><span>加载中...</span></div>
            </div>
        </div>`;
    }).join('');

    document.getElementById('majorList').innerHTML = cards;
}

async function toggleCard(idx, majorName) {
    const body = document.getElementById(`body-${idx}`);
    const icon = document.getElementById(`icon-${idx}`);

    if (body.classList.contains('show')) {
        body.classList.remove('show');
        icon.classList.remove('open');
        return;
    }

    body.classList.add('show');
    icon.classList.add('open');

    // 已缓存直接展示
    if (detailCache[majorName]) {
        body.innerHTML = detailCache[majorName];
        return;
    }

    // 从列表找到该专业的 major_info 数据
    const m = allMajors.find(x => x.major_name === majorName);
    // 同时请求录取数据
    try {
        const res = await fetch(`${API}/major-detail?major_name=${encodeURIComponent(majorName)}`);
        const json = await res.json();
        const admitRows = json.success ? json.data : [];

        let html = '';

        // 专业介绍
        if (m && m.introduction) {
            html += `
            <div class="info-section">
                <div class="info-section-title">专业介绍</div>
                <div class="info-section-content">${escapeHtml(m.introduction)}</div>
            </div>`;
        }

        // 就业前景
        if (m && m.career_path) {
            html += `
            <div class="info-section">
                <div class="info-section-title">就业前景 & AI影响</div>
                <div class="info-section-content">${escapeHtml(m.career_path)}</div>
            </div>`;
        }

        // 录取院校
        html += `<div class="info-section">
            <div class="info-section-title">开设院校（河南招生录取数据，共 ${admitRows.length} 条）</div>`;

        if (admitRows.length) {
            const tableRows = admitRows.map(r => `
                <tr>
                    <td><strong>${escapeHtml(r.school_name)}</strong></td>
                    <td>${r.province || '-'}</td>
                    <td>${r.school_type || '-'}</td>
                    <td>${r.college_level || '-'}</td>
                    <td>${r.subject_type || '-'}</td>
                    <td>${r.subject_require || '-'}</td>
                    <td>${r.batch || '-'}${r.batch_remark ? ' · ' + r.batch_remark : ''}</td>
                    <td class="score-col">${r.min_score || '-'}</td>
                    <td class="rank-col">${r.min_rank ? r.min_rank.toLocaleString() : '-'}</td>
                    <td style="color:#888;font-size:0.8rem">${r.major_remark ? r.major_remark.substring(0, 30) : '-'}</td>
                </tr>`).join('');

            html += `<div class="admit-table-wrap">
                <table class="admit-table">
                    <thead>
                        <tr>
                            <th>院校名称</th><th>省份</th><th>办学性质</th><th>院校层次</th>
                            <th>科类</th><th>选科要求</th><th>批次</th>
                            <th>最低分</th><th>最低位次</th>
                            <th>备注</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>`;
        } else {
            html += '<div class="no-admit">暂无河南省录取数据</div>';
        }
        html += '</div>';

        if (!m || (!m.introduction && !m.career_path)) {
            html = `<div class="empty-state" style="padding:20px 0">
                <div class="empty-state-icon" style="font-size:2rem">📋</div>
                <p>暂无专业详情</p>
            </div>` + html;
        }

        detailCache[majorName] = html;
        body.innerHTML = html;
    } catch (e) {
        body.innerHTML = `<div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <h3>加载失败</h3>
            <p>${e.message}</p>
        </div>`;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
