// ====================================================
    // 公共配置
    // ====================================================
    const API_BASE = `http://${window.location.hostname || 'localhost'}:3000/api`;

    // 院校特色标签数据（院校名称 -> 特色标签数组）
    let collegeFeaturesMap = {};
    let allFeatureTags = []; // 所有特色标签列表（去重后）
    
    // 特色专业数据（特色类型 -> 专业数组）
    let featuredMajorsMap = {};


    // ====================================================
    // 视图切换
    // ====================================================
    function showFormView() {
        document.getElementById('viewForm').style.display = 'block';
        document.getElementById('viewResult').style.display = 'none';
        
        // 清空所有筛选条件
        const filterIds = ['filterProvince', 'filterCity', 'filterCategory', 'filterMajorCategory', 'filterBatch', 'filterBatchRemark', 'filterCollegeLevel', 'filterSubjectRequire'];
        filterIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.getElementById('filterSchool').value = '';
        document.getElementById('filterMajor').value = '';
        
        // 清空筛选条件显示
        updateFilterDisplay();
        
        // 关闭筛选面板
        closeFilterPanel();
    }

    // ====================================================
    // 分数/位次切换
    // ====================================================
    function toggleScoreMode(mode) {
        const scoreInput = document.getElementById('score');
        const scoreModeInput = document.getElementById('scoreMode');
        const buttons = document.querySelectorAll('.toggle-btn');
        
        // 更新按钮状态
        buttons.forEach(btn => {
            if (btn.dataset.mode === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // 更新隐藏字段
        scoreModeInput.value = mode;
        
        // 清空输入框
        scoreInput.value = '';
        
        // 更新输入框
        if (mode === 'score') {
            scoreInput.placeholder = '请输入高考分数';
            scoreInput.max = 750;
        } else {
            scoreInput.placeholder = '请输入高考位次';
            scoreInput.removeAttribute('max');
        }
    }

    function showResultView() {
        document.getElementById('viewForm').style.display = 'none';
        document.getElementById('viewResult').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // 切换筛选面板显示/隐藏
    function toggleFilterPanel() {
        const filterBar = document.getElementById('filterBar');
        const filterBtn = document.getElementById('filterToggleBtn');

        if (!filterBar.classList.contains('active')) {
            // 显示筛选面板
            filterBar.classList.add('active');
            filterBtn.classList.add('active');
            filterBar.classList.add('active');
            filterBtn.classList.add('active');
        } else {
            // 隐藏筛选面板
            closeFilterPanel();
        }
    }

    // ====================================================
    // 页面初始化
    // ====================================================
    document.addEventListener('DOMContentLoaded', async () => {
        // 初始化选科标签
        initSubjectTags();

        // 加载院校特色标签数据
        try {
            const res = await fetch(`${API_BASE}/college-features`);
            const json = await res.json();
            if (json.success && json.data) {
                collegeFeaturesMap = json.data;
                allFeatureTags = json.allFeatures || [];
                console.log(`已加载 ${Object.keys(collegeFeaturesMap).length} 所院校的特色标签，共 ${allFeatureTags.length} 种标签`);
            }
        } catch (err) {
            console.warn('加载院校特色标签失败:', err.message);
        }
        
        // 加载特色专业数据
        try {
            const res = await fetch(`${API_BASE}/featured-majors`);
            const json = await res.json();
            if (json.success && json.data) {
                featuredMajorsMap = json.data;
                console.log(`已加载 ${Object.keys(featuredMajorsMap).length} 种特色专业的优势专业数据`);
            }
        } catch (err) {
            console.warn('加载特色专业数据失败:', err.message);
        }
    });

    // ====================================================
    // 高考模式 & 省份
    // ====================================================
    const gaokaoModes = {
        mode312: ['广东','江苏','河北','福建','湖北','湖南','辽宁','重庆','吉林','黑龙江','安徽','江西','广西','贵州','甘肃','河南','山西','陕西','内蒙古','宁夏','青海','四川','云南'],
        mode33: ['北京','天津','上海','山东','浙江','海南'],
        modeTraditional: ['西藏','新疆']
    };
    const PROVINCES = [
        {name:'河南',mode:'3+1+2'},{name:'广东',mode:'3+1+2'},{name:'江苏',mode:'3+1+2'},{name:'河北',mode:'3+1+2'},{name:'福建',mode:'3+1+2'},
        {name:'湖北',mode:'3+1+2'},{name:'湖南',mode:'3+1+2'},{name:'辽宁',mode:'3+1+2'},{name:'重庆',mode:'3+1+2'},{name:'吉林',mode:'3+1+2'},
        {name:'黑龙江',mode:'3+1+2'},{name:'安徽',mode:'3+1+2'},{name:'江西',mode:'3+1+2'},{name:'广西',mode:'3+1+2'},{name:'贵州',mode:'3+1+2'},
        {name:'甘肃',mode:'3+1+2'},{name:'山西',mode:'3+1+2'},{name:'陕西',mode:'3+1+2'},{name:'内蒙古',mode:'3+1+2'},{name:'宁夏',mode:'3+1+2'},
        {name:'青海',mode:'3+1+2'},{name:'四川',mode:'3+1+2'},{name:'云南',mode:'3+1+2'},
        {name:'北京',mode:'3+3'},{name:'天津',mode:'3+3'},{name:'上海',mode:'3+3'},{name:'山东',mode:'3+3'},{name:'浙江',mode:'3+3'},{name:'海南',mode:'3+3'},
        {name:'西藏',mode:'文理'},{name:'新疆',mode:'文理'}
    ];
    const PINYIN_MAP = {'河南':'hn','广东':'gd','江苏':'js','河北':'hb','福建':'fj','湖北':'hb','湖南':'hn','辽宁':'ln','重庆':'cq','吉林':'jl','黑龙江':'hlj','安徽':'ah','江西':'jx','广西':'gx','贵州':'gz','甘肃':'gs','山西':'sx','陕西':'sx','内蒙古':'nmg','宁夏':'nx','青海':'qh','四川':'sc','云南':'yn','北京':'bj','天津':'tj','上海':'sh','山东':'sd','浙江':'zj','海南':'hi','西藏':'xz','新疆':'xj'};

    // ====================================================
    // 地区 Combobox
    // ====================================================
    function initRegionCombobox() {
        const input    = document.getElementById('regionInput');
        const hidden   = document.getElementById('region');
        const dropdown = document.getElementById('regionDropdown');
        let highlightIdx = -1, filtered = [];

        function renderDropdown(kw) {
            kw = (kw || '').trim().toLowerCase();
            filtered = kw ? PROVINCES.filter(p => p.name.includes(kw) || (PINYIN_MAP[p.name]||'').startsWith(kw)) : PROVINCES;
            if (!filtered.length) { dropdown.innerHTML = '<div class="region-no-result">未找到匹配省份</div>'; }
            else {
                const groups = [
                    {label:'3+1+2 新高考',tag:'blue', items:filtered.filter(p=>p.mode==='3+1+2')},
                    {label:'3+3 新高考',  tag:'gold', items:filtered.filter(p=>p.mode==='3+3')},
                    {label:'传统文理分科',tag:'gray', items:filtered.filter(p=>p.mode==='文理')},
                ];
                let html='', gi=0;
                groups.forEach(g=>{
                    if(!g.items.length) return;
                    if(!kw) html+=`<div class="region-group-label">${g.label}</div>`;
                    g.items.forEach(p=>{
                        const tc=g.tag==='gold'?'gold':g.tag==='gray'?'gray':'';
                        let dn=p.name;
                        if(kw){const idx=p.name.indexOf(kw);if(idx>=0)dn=p.name.substring(0,idx)+`<span class="match-highlight">${p.name.substring(idx,idx+kw.length)}</span>`+p.name.substring(idx+kw.length);}
                        html+=`<div class="region-option" data-value="${p.name}" data-idx="${gi}"><span>${dn}</span><span class="mode-tag ${tc}">${p.mode}</span></div>`;
                        gi++;
                    });
                });
                dropdown.innerHTML=html;
            }
            highlightIdx=-1;
            dropdown.querySelectorAll('.region-option').forEach(el=>{el.addEventListener('mousedown',e=>{e.preventDefault();selectProvince(el.dataset.value);});});
        }
        function selectProvince(name){hidden.value=name;input.value=name;closeDropdown();hidden.dispatchEvent(new Event('change'));}
        function openDropdown(kw){renderDropdown(kw);dropdown.classList.add('open');}
        function closeDropdown(){dropdown.classList.remove('open');highlightIdx=-1;}
        function moveHighlight(dir){
            const opts=dropdown.querySelectorAll('.region-option');
            if(!opts.length)return;
            opts.forEach(o=>o.classList.remove('highlighted'));
            highlightIdx=(highlightIdx+dir+opts.length)%opts.length;
            const cur=opts[highlightIdx];cur.classList.add('highlighted');cur.scrollIntoView({block:'nearest'});
        }
        input.addEventListener('focus',()=>openDropdown(''));
        input.addEventListener('click',()=>openDropdown(''));
        input.addEventListener('input',()=>{openDropdown(input.value);hidden.value='';});
        input.addEventListener('keydown',e=>{
            if(!dropdown.classList.contains('open')){openDropdown('');return;}
            if(e.key==='ArrowDown'){e.preventDefault();moveHighlight(1);}
            else if(e.key==='ArrowUp'){e.preventDefault();moveHighlight(-1);}
            else if(e.key==='Enter'){e.preventDefault();const opts=dropdown.querySelectorAll('.region-option');if(highlightIdx>=0&&opts[highlightIdx])selectProvince(opts[highlightIdx].dataset.value);else if(filtered.length===1)selectProvince(filtered[0].name);}
            else if(e.key==='Escape')closeDropdown();
        });
        input.addEventListener('blur',()=>{
            setTimeout(()=>{
                const match=PROVINCES.find(p=>p.name===input.value.trim());
                if(match){hidden.value=match.name;}
                else if(hidden.value){input.value=hidden.value;}
                else{input.value='河南';hidden.value='河南';}
                closeDropdown();
            },150);
        });
        document.addEventListener('click',e=>{if(!document.getElementById('regionCombobox').contains(e.target))closeDropdown();});
    }

    // ====================================================
    // 选科标签
    // ====================================================
    function initSubjectTags() {
        initRegionCombobox();
        renderSubjectSelection();
        document.getElementById('region').addEventListener('change',()=>{
            document.getElementById('subjectCombination').value='';
            renderSubjectSelection();
            showToast('选科模式已根据地区自动切换','info');
        });
    }

    function renderSubjectSelection() {
        const container = document.getElementById('subjectSelection');
        const region = document.getElementById('region').value;
        let mode = gaokaoModes.mode312.includes(region)?'mode312':gaokaoModes.mode33.includes(region)?'mode33':gaokaoModes.modeTraditional.includes(region)?'modeTraditional':'mode312';
        let html='';
        if(mode==='mode312'){
            html=`<input type="hidden" id="subjectCombination" required>
            <div class="invalid-feedback" id="subjectError" style="display:none;">请选择必选科目（1门）和再选科目（2门）</div>
            <div class="mb-3"><label class="form-label">必选科目（物理/历史二选一，100分）</label>
            <div class="subject-tags"><div class="subject-tag" data-type="required" data-value="物理">物理</div><div class="subject-tag" data-type="required" data-value="历史">历史</div></div></div>
            <div><label class="form-label">再选科目（政治、地理、化学、生物中选2门，各100分）</label>
            <div class="subject-tags"><div class="subject-tag" data-type="optional" data-value="化学">化学</div><div class="subject-tag" data-type="optional" data-value="生物">生物</div><div class="subject-tag" data-type="optional" data-value="政治">政治</div><div class="subject-tag" data-type="optional" data-value="地理">地理</div></div></div>`;
        } else if(mode==='mode33'){
            const region = document.getElementById('region').value;
            const hasTech = (region === '浙江'); // 只有浙江有技术科目
            const subjectCount = hasTech ? '7选3' : '6选3';
            const techTag = hasTech ? '<div class="subject-tag" data-type="mode33" data-value="技术">技术</div>' : '';
            html=`<input type="hidden" id="subjectCombination" required>
            <div class="invalid-feedback" id="subjectError" style="display:none;">请选择选科组合</div>
            <div><label class="form-label">选考科目（${subjectCount}，各100分）</label>
            <div class="subject-tags"><div class="subject-tag" data-type="mode33" data-value="物理">物理</div><div class="subject-tag" data-type="mode33" data-value="化学">化学</div><div class="subject-tag" data-type="mode33" data-value="生物">生物</div><div class="subject-tag" data-type="mode33" data-value="政治">政治</div><div class="subject-tag" data-type="mode33" data-value="历史">历史</div><div class="subject-tag" data-type="mode33" data-value="地理">地理</div>${techTag}</div></div>`;
        } else {
            html=`<input type="hidden" id="subjectCombination" required>
            <div class="invalid-feedback" id="subjectError" style="display:none;">请选择文理分科</div>
            <div><label class="form-label">文理分科（文综/理综，300分）</label>
            <div class="subject-tags"><div class="subject-tag" data-type="traditional" data-value="理科">理科（理综）</div><div class="subject-tag" data-type="traditional" data-value="文科">文科（文综）</div></div></div>`;
        }
        container.innerHTML=html;
        setupSubjectTagEvents(mode);
    }

    function setupSubjectTagEvents(mode) {
        const tags=document.querySelectorAll('.subject-tag');
        const hiddenInput=document.getElementById('subjectCombination');
        const errorDiv=document.getElementById('subjectError');
        if(!hiddenInput||!errorDiv)return;

        tags.forEach(tag=>{
            tag.addEventListener('click',function(){
                const type=this.dataset.type, value=this.dataset.value;
                if(type==='required'){
                    document.querySelectorAll('[data-type="required"]').forEach(t=>t.classList.remove('selected'));
                    this.classList.add('selected');updateCombo();
                } else if(type==='optional'){
                    const sel=document.querySelectorAll('[data-type="optional"].selected');
                    if(this.classList.contains('selected')){this.classList.remove('selected');}
                    else if(sel.length<2){this.classList.add('selected');}
                    else{showToast('再选科目最多选择2门！','warning');return;}
                    updateCombo();
                } else if(type==='mode33'){
                    const sel=document.querySelectorAll('[data-type="mode33"].selected');
                    if(this.classList.contains('selected')){this.classList.remove('selected');}
                    else if(sel.length<3){this.classList.add('selected');}
                    else{showToast('选考科目最多选择3门！','warning');return;}
                    updateCombo();
                } else if(type==='traditional'){
                    document.querySelectorAll('[data-type="traditional"]').forEach(t=>t.classList.remove('selected'));
                    this.classList.add('selected');
                    hiddenInput.value=value;errorDiv.style.display='none';return;
                }
                validateSubject();
            });
        });

        function updateCombo(){
            let subjects=[];
            if(mode==='mode312'){
                const req=document.querySelector('[data-type="required"].selected');
                const opt=document.querySelectorAll('[data-type="optional"].selected');
                if(req&&opt.length===2){subjects=[req.dataset.value,opt[0].dataset.value,opt[1].dataset.value];hiddenInput.value=subjects.join(',');errorDiv.style.display='none';}
                else hiddenInput.value='';
            } else if(mode==='mode33'){
                const sel=document.querySelectorAll('[data-type="mode33"].selected');
                if(sel.length===3){sel.forEach(t=>subjects.push(t.dataset.value));hiddenInput.value=subjects.join(',');errorDiv.style.display='none';}
                else hiddenInput.value='';
            }
        }
        function validateSubject(){
            let ok=false;
            if(mode==='mode312'){const req=document.querySelector('[data-type="required"].selected');const opt=document.querySelectorAll('[data-type="optional"].selected');ok=req&&opt.length===2;}
            else if(mode==='mode33'){ok=document.querySelectorAll('[data-type="mode33"].selected').length===3;}
            else{ok=!!document.querySelector('[data-type="traditional"].selected');}
            errorDiv.style.display=ok?'none':'block';
            return ok;
        }
    }

    // ====================================================
    // 表单提交
    // ====================================================
    document.getElementById('recommendationForm').addEventListener('submit', async function(e){
        e.preventDefault();
        const score=document.getElementById('score').value;
        const subjectCombination=document.getElementById('subjectCombination').value;
        const region=document.getElementById('region').value;
        const scoreMode=document.getElementById('scoreMode').value; // 获取当前模式
        
        if(!region){document.getElementById('regionInput').focus();showToast('请选择有效的地区省份！','warning');return;}
        if(!score||!subjectCombination){if(!subjectCombination)document.getElementById('subjectError').style.display='block';showToast('请填写所有必填项！','warning');return;}
        
        // 根据模式进行不同的验证
        const scoreValue = parseInt(score);
        if (scoreMode === 'score') {
            // 分数模式：验证0-750
            if(scoreValue<0||scoreValue>750){showToast('分数必须在0-750之间！','warning');return;}
        } else {
            // 位次模式：验证1-500000
            if(scoreValue<1||scoreValue>500000){showToast('位次必须在1-500000之间！','warning');return;}
        }

        document.getElementById('loading').style.display='block';
        setTimeout(async ()=>{
            await doQueryAndShowResult(region, score, subjectCombination);
            document.getElementById('loading').style.display='none';
        }, 800);
    });

    async function doQueryAndShowResult(region, score, subjectCombination) {
        // 填写信息栏
        document.getElementById('infoRegion').textContent = region;
        document.getElementById('infoSubject').textContent = subjectCombination;

        // 获取当前模式（分数/位次）
        const scoreMode = document.getElementById('scoreMode').value;
        let userScore = parseInt(score) || 0;
        let userRank = null;

        // 如果是分数模式，先查询位次
        if (scoreMode === 'score') {
            document.getElementById('infoScore').textContent = score + '分';
            document.getElementById('infoRank').textContent = '-';
            
            try {
                // 调用API查询位次
                const rankResp = await fetch(`${API_BASE}/get-rank-by-score`, {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({score: userScore, subjectCombination, region})
                });
                const rankResult = await rankResp.json();
                
                if (rankResult.success && rankResult.data) {
                    userRank = rankResult.data.rank;
                    window.currentUserRank = userRank; // 设置全局用户位次
                    console.log(`分数${userScore}对应位次: ${userRank}`);
                    // 在信息栏显示位次
                    document.getElementById('infoRank').textContent = userRank;
                } else {
                    console.warn('未查询到位次数据:', rankResult.error);
                    // 如果查询位次失败，仍然继续用分数查询
                }
            } catch (err) {
                console.error('查询位次失败:', err);
                // 继续用分数查询
            }
        } else {
            // 位次模式，查询对应的分数用于显示
            userRank = userScore;
            window.currentUserRank = userRank; // 设置全局用户位次
            document.getElementById('infoRank').textContent = userRank;
            document.getElementById('infoScore').textContent = '-';
            
            try {
                // 调用API查询分数
                const scoreResp = await fetch(`${API_BASE}/get-score-by-rank`, {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({rank: userRank, subjectCombination, region})
                });
                const scoreResult = await scoreResp.json();
                
                if (scoreResult.success && scoreResult.data) {
                    const queryScore = scoreResult.data.score;
                    console.log(`位次${userRank}对应分数: ${queryScore}`);
                    // 在信息栏显示分数
                    document.getElementById('infoScore').textContent = queryScore + '分';
                } else {
                    console.warn('未查询到分数数据:', scoreResult.error);
                    // 如果查询分数失败，分数显示为-
                }
            } catch (err) {
                console.error('查询分数失败:', err);
                // 分数显示为-
            }
        }

        // 切换到结果视图，先显示加载中
        showResultView();
        document.getElementById('resultBody').innerHTML='';
        document.getElementById('resultLoading').style.display='block';
        document.getElementById('paginationBar').style.display='none';

        try {
            const resp = await fetch(`${API_BASE}/recommend-from-db`, {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({
                    score: userScore,
                    rank: userRank,
                    scoreMode: scoreMode,
                    subjectCombination, 
                    region
                })
            });
            const result = await resp.json();
            if(!result.success) throw new Error(result.error||'接口返回失败');

            allData = result.data || [];
            
            // 如果是分数模式，仍然需要按分数过滤
            if (scoreMode === 'score') {
                allData = allData.filter(r => {
                    const minScore = r.min_score != null ? parseInt(r.min_score) : null;
                    return minScore != null && minScore <= userScore;
                });
            }
            
            document.getElementById('infoTotal').textContent = new Set(allData.map(r=>r.name)).size;
            document.getElementById('infoMajorTotal').textContent = new Set(allData.map(r=>r.major)).size; // 专业名称去重

            document.getElementById('resultLoading').style.display='none';

            if(allData.length===0){
                document.getElementById('resultBody').innerHTML=`<div class="empty-state"><div style="font-size:2rem;margin-bottom:12px;">🔍</div><div>未找到符合条件的推荐数据，请尝试调整分数或选科</div></div>`;
                return;
            }

            // 重置筛选框（清空旧数据）
            const filterIds = ['filterProvince', 'filterCity', 'filterCategory', 'filterMajorCategory', 'filterBatch', 'filterBatchRemark', 'filterCollegeLevel', 'filterSubjectRequire'];
            filterIds.forEach(id => {
                document.getElementById(id).value = '';
            });
            document.getElementById('filterSchool').value='';
            document.getElementById('filterMajor').value='';
            currentPage=1; pageSize=10;

            // 先加载专业推荐顺序，再初始化筛选选项
            await loadMajorOrder();
            initFilterOptions();
            filteredData=[...allData];
            document.getElementById('filteredCount').textContent=filteredData.length;
            renderTable(filteredData);

        } catch(err) {
            document.getElementById('resultLoading').style.display='none';
            document.getElementById('resultBody').innerHTML=`<div class="empty-state"><div style="font-size:2rem;margin-bottom:12px;">❌</div><div>查询失败：${err.message}<br><small>请确认后端服务已启动（http://localhost:3000）</small></div></div>`;
        }
    }

    // ====================================================
    // 辅助函数
    // ====================================================
    function resetForm() {
        document.getElementById('recommendationForm').reset();
        document.getElementById('region').value='河南';
        document.getElementById('regionInput').value='河南';

        // 清空选科标签
        document.querySelectorAll('.subject-tag.selected').forEach(tag => {
            tag.classList.remove('selected');
        });
        const subjectCombination = document.getElementById('subjectCombination');
        if (subjectCombination) {
            subjectCombination.value = '';
        }
        const subjectError = document.getElementById('subjectError');
        if (subjectError) {
            subjectError.style.display = 'none';
        }

        showToast('表单已重置！','info');
    }
    function openCollegeList(){ window.open('college-list.html','_blank'); }

    function showToast(message, type='info') {
        const toastEl=document.getElementById('liveToast');
        const msgEl=document.getElementById('toastMessage');
        const titleEl=document.getElementById('toastTitle');
        const types={success:{header:'✅ 成功',cls:'text-success',border:'rgba(16,185,129,0.4)'},error:{header:'❌ 错误',cls:'text-danger',border:'rgba(239,68,68,0.4)'},warning:{header:'⚠️ 警告',cls:'text-warning',border:'rgba(245,158,11,0.4)'},info:{header:'ℹ️ 提示',cls:'text-info',border:'rgba(59,159,232,0.4)'}};
        const s=types[type]||types.info;
        titleEl.textContent=s.header; msgEl.className=`toast-body ${s.cls}`; msgEl.textContent=message; toastEl.style.borderColor=s.border;
        new bootstrap.Toast(toastEl).show();
    }

    // ====================================================
    // 结果页：数据、筛选、渲染
    // ====================================================
    let allData=[], filteredData=[], majorOrderMap={}; // major_category -> sort_order
    let topMajors=new Set(); // 前85个推荐专业类
    let currentPage=1, pageSize=3, totalPages=1;

    // 获取专业推荐顺序
    async function loadMajorOrder() {
        try {
            const resp = await fetch(`${API_BASE}/major-recommend-order`);
            const result = await resp.json();
            if (result.success && result.data) {
                result.data.forEach(item => {
                    majorOrderMap[item.major_category] = item.sort_order;
                    // 标记前85个专业类
                    if (item.sort_order <= 85) {
                        topMajors.add(item.major_category);
                    }
                });
            }
        } catch (e) {
            console.warn('获取专业推荐顺序失败，使用默认排序');
        }
    }

    function initFilterOptions() {
        const pOptions=[...new Set(allData.map(r=>r.province).filter(Boolean))].sort();
        const cOptions=[...new Set(allData.map(r=>r.college_city).filter(Boolean))].sort();
        // 门类和专业类按推荐顺序排序
        const catOptions=[...new Set(allData.map(r=>r.category).filter(Boolean))].sort((a, b) => {
            const orderA = Math.min(...allData.filter(d => d.category === a).map(d => majorOrderMap[d.major_category] || 999));
            const orderB = Math.min(...allData.filter(d => d.category === b).map(d => majorOrderMap[d.major_category] || 999));
            return orderA - orderB;
        });
        const mcOptions=[...new Set(allData.map(r=>r.major_category).filter(Boolean))].sort((a, b) => {
            const aIsTest = a.includes('试验班');
            const bIsTest = b.includes('试验班');
            if (aIsTest && !bIsTest) return -1;
            if (!aIsTest && bIsTest) return 1;
            return (majorOrderMap[a] || 999) - (majorOrderMap[b] || 999);
        });
        const bOptions=[...new Set(allData.map(r=>r.batch).filter(Boolean))].sort();
        const brOptions=[...new Set(allData.map(r=>r.batch_remark).filter(Boolean))].sort();
        // 特色标签从当前查询结果中的院校名称动态获取
        const featureSet = new Set();
        allData.forEach(r => {
            const features = collegeFeaturesMap[r.name] || [];
            features.forEach(f => featureSet.add(f));
        });
        const fOptions = [...featureSet].sort((a, b) => {
            const priority = ['985', '211', '双一流', '保研'];
            const aIdx = priority.indexOf(a);
            const bIdx = priority.indexOf(b);
            if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
            if (aIdx !== -1) return -1;
            if (bIdx !== -1) return 1;
            return a.localeCompare(b, 'zh-CN');
        });
        const sOptions=[...new Set(allData.map(r=>r.subject_require).filter(Boolean))].sort();

        const fillSelect = (id, opts) => {
            const sel = document.getElementById(id);
            const currentVal = sel.value;
            sel.innerHTML = '<option value="">全部</option>';
            opts.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt;
                sel.appendChild(o);
            });
            if (currentVal && opts.includes(currentVal)) {
                sel.value = currentVal;
            }
        };
        fillSelect('filterProvince', pOptions);
        fillSelect('filterCity', cOptions);
        fillSelect('filterCategory', catOptions);
        fillSelect('filterMajorCategory', mcOptions);
        fillSelect('filterBatch', bOptions);
        fillSelect('filterBatchRemark', brOptions);
        fillSelect('filterCollegeLevel', fOptions);
        fillSelect('filterSubjectRequire', sOptions);

        // 更新选项数量显示
        updateFilterOptionCounts();
    }

    // 更新筛选选项数量显示
    function updateFilterOptionCounts() {
        const counts = {
            countProvince: 'filterProvince',
            countCity: 'filterCity',
            countCategory: 'filterCategory',
            countMajorCategory: 'filterMajorCategory',
            countBatch: 'filterBatch',
            countBatchRemark: 'filterBatchRemark',
            countCollegeLevel: 'filterCollegeLevel',
            countSubjectRequire: 'filterSubjectRequire'
        };

        for (const [countId, filterId] of Object.entries(counts)) {
            const sel = document.getElementById(filterId);
            const countEl = document.getElementById(countId);
            if (sel && countEl) {
                // 统计非"全部"选项的数量
                countEl.textContent = sel.options.length - 1;
            }
        }
    }

    // 联动筛选：更新其他下拉框选项
    function updateFilterOptions(excludeField) {
        const fieldMap = {
            province: 'filterProvince',
            college_city: 'filterCity',
            category: 'filterCategory',
            major_category: 'filterMajorCategory',
            batch: 'filterBatch',
            batch_remark: 'filterBatchRemark',
            feature: 'filterCollegeLevel', // 特色标签字段改为feature
            subject_require: 'filterSubjectRequire'
        };

        for (const [field, selectId] of Object.entries(fieldMap)) {
            if (field === excludeField) continue;
            const sel = document.getElementById(selectId);
            const currentVal = sel.value;
            let options;

            // 特色标签特殊处理：从filteredData中的院校名称获取对应的特色标签
            if (field === 'feature') {
                const featureSet = new Set();
                filteredData.forEach(r => {
                    const features = collegeFeaturesMap[r.name] || [];
                    features.forEach(f => featureSet.add(f));
                });
                options = [...featureSet].sort((a, b) => {
                    const priority = ['985', '211', '双一流', '保研'];
                    const aIdx = priority.indexOf(a);
                    const bIdx = priority.indexOf(b);
                    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
                    if (aIdx !== -1) return -1;
                    if (bIdx !== -1) return 1;
                    return a.localeCompare(b, 'zh-CN');
                });
            } else {
                options = [...new Set(filteredData.map(r => r[field]).filter(Boolean))];
                // 门类和专业类按推荐顺序排序
                if (field === 'major_category') {
                    options.sort((a, b) => {
                        const aIsTest = a.includes('试验班');
                        const bIsTest = b.includes('试验班');
                        if (aIsTest && !bIsTest) return -1;
                        if (!aIsTest && bIsTest) return 1;
                        return (majorOrderMap[a] || 999) - (majorOrderMap[b] || 999);
                    });
                } else if (field === 'category') {
                    options.sort((a, b) => {
                        const orderA = Math.min(...filteredData.filter(d => d.category === a).map(d => majorOrderMap[d.major_category] || 999));
                        const orderB = Math.min(...filteredData.filter(d => d.category === b).map(d => majorOrderMap[d.major_category] || 999));
                        return orderA - orderB;
                    });
                } else {
                    options.sort();
                }
            }

            sel.innerHTML = '<option value="">全部</option>';
            options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt;
                sel.appendChild(o);
            });
            if (currentVal && options.includes(currentVal)) {
                sel.value = currentVal;
            }
        }

        // 更新选项数量显示
        updateFilterOptionCounts();
    }

    function resetFilter(){
        document.getElementById('filterSchool').value='';
        document.getElementById('filterMajor').value='';
        const filterIds = ['filterProvince', 'filterCity', 'filterCategory', 'filterMajorCategory', 'filterBatch', 'filterBatchRemark', 'filterCollegeLevel', 'filterSubjectRequire'];
        filterIds.forEach(id => {
            document.getElementById(id).value = '';
        });
        initFilterOptions();
        updateFilterDisplay();
        applyFilter();
    }

    function closeFilterPanel(){
        // 关闭筛选面板
        const filterBar = document.getElementById('filterBar');
        const filterBtn = document.getElementById('filterToggleBtn');

        if(filterBar){
            filterBar.classList.remove('active');
        }
        if(filterBtn){
            filterBtn.classList.remove('active');
        }
        
        // 更新统计数据为筛选后的实际数据
        const schoolCount = new Set(filteredData.map(r => r.name)).size;
        const majorCount = new Set(filteredData.map(r => r.major)).size; // 专业名称去重
        document.getElementById('infoTotal').textContent = schoolCount;
        document.getElementById('infoMajorTotal').textContent = majorCount;
    }

    // 按专业类筛选（点击专业名称按钮）
    function filterByMajor(majorCategory){
        const filterMajorCategory = document.getElementById('filterMajorCategory');
        if(filterMajorCategory){
            filterMajorCategory.value = majorCategory;
            // 打开筛选面板
            const filterBar = document.getElementById('filterBar');
            const filterBtn = document.getElementById('filterToggleBtn');
            if(filterBar) filterBar.classList.add('active');
            if(filterBtn) filterBtn.classList.add('active');
            // 应用筛选
            updateFilterDisplay();
            applyFilter();
        }
    }

    // ====================================================
    // 专业详情模态框
    // ====================================================
    function showMajorModal(majorName){
        const modal = document.getElementById('majorModal');
        const title = document.getElementById('majorModalTitle');
        const body = document.getElementById('majorModalBody');
        
        title.textContent = majorName;
        body.innerHTML = '<div class="major-modal-loading">加载中…</div>';
        modal.classList.add('active');
        
        // 使用缓存
        if(majorCache[majorName]!==undefined){
            renderMajorModalContent(majorCache[majorName]);
            return;
        }
        
        fetch(`${API_BASE}/major-info?major_name=${encodeURIComponent(majorName)}`)
            .then(r=>r.json())
            .then(res=>{
                if(res.success&&res.data)majorCache[majorName]=res.data;
                renderMajorModalContent(res.success?res.data:null);
            })
            .catch(err=>{
                body.innerHTML='<div class="major-modal-none">加载失败</div>';
            });
    }
    
    function renderMajorModalContent(data){
        const body = document.getElementById('majorModalBody');
        if(!data){body.innerHTML='<div class="major-modal-none">暂无专业介绍</div>';return;}
        let h='';
        if(data.introduction)h+=`<div class="major-modal-section"><div class="major-modal-section-label">专业介绍</div><div class="major-modal-section-body">${formatContent(data.introduction)}</div></div>`;
        if(data.career_path)h+=`<div class="major-modal-section"><div class="major-modal-section-label">就业方向</div><div class="major-modal-section-body career-path-list">${formatCareerPath(data.career_path)}</div></div>`;
        if(data.courses)h+=`<div class="major-modal-section"><div class="major-modal-section-label">主要课程</div><div class="major-modal-section-body">${formatContent(data.courses)}</div></div>`;
        if(!h)h='<div class="major-modal-none">暂无专业介绍</div>';
        body.innerHTML=h;
    }
    
    function closeMajorModal(){
        const modal = document.getElementById('majorModal');
        modal.classList.remove('active');
    }
    
    // 点击模态框背景关闭
    document.getElementById('majorModal')?.addEventListener('click',function(e){
        if(e.target===this)closeMajorModal();
    });

    function applyFilter(excludeField){
        const school=document.getElementById('filterSchool').value.trim().toLowerCase();
        const major=document.getElementById('filterMajor').value.trim().toLowerCase();
        const province=document.getElementById('filterProvince').value;
        const city=document.getElementById('filterCity').value;
        const category=document.getElementById('filterCategory').value;
        const majorCategory=document.getElementById('filterMajorCategory').value;
        const batch=document.getElementById('filterBatch').value;
        const batchRemark=document.getElementById('filterBatchRemark').value;
        const featureTag=document.getElementById('filterCollegeLevel').value; // 特色标签
        const subj=document.getElementById('filterSubjectRequire').value;
        filteredData=allData.filter(r=>{
            if(school&&!(r.name||'').toLowerCase().includes(school))return false;
            if(major&&!(r.major||'').toLowerCase().includes(major))return false;
            if(province&&r.province!==province)return false;
            if(city&&r.college_city!==city)return false;
            if(category&&r.category!==category)return false;
            if(majorCategory&&r.major_category!==majorCategory)return false;
            if(batch&&r.batch!==batch)return false;
            if(batchRemark&&r.batch_remark!==batchRemark)return false;
            // 特色标签筛选：检查院校是否包含选中的特色标签
            if(featureTag){
                const schoolFeatures = collegeFeaturesMap[r.name] || [];
                if(!schoolFeatures.includes(featureTag)) return false;
            }
            if(subj&&r.subject_require!==subj)return false;
            return true;
        });
        document.getElementById('filteredCount').textContent=filteredData.length;
        currentPage=1;renderTable(filteredData);

        // 联动更新其他下拉框选项
        if (excludeField) {
            updateFilterOptions(excludeField);
        }
    }

    // 各下拉框联动筛选触发函数
    function onFilterChange(field) {
        updateFilterDisplay();
        applyFilter(field);
    }
    
    // 更新筛选条件显示
    function updateFilterDisplay() {
        const filters = [
            { id: 'filterProvince', displayId: 'displayProvince', valueId: 'displayProvinceValue' },
            { id: 'filterCity', displayId: 'displayCity', valueId: 'displayCityValue' },
            { id: 'filterMajorCategory', displayId: 'displayMajorCategory', valueId: 'displayMajorCategoryValue' },
            { id: 'filterBatchRemark', displayId: 'displayBatchRemark', valueId: 'displayBatchRemarkValue' }
        ];
        
        filters.forEach(item => {
            const select = document.getElementById(item.id);
            const displayEl = document.getElementById(item.displayId);
            const valueEl = document.getElementById(item.valueId);
            
            if (select && displayEl && valueEl) {
                const value = select.value;
                if (value && value !== '') {
                    valueEl.textContent = value;
                    displayEl.style.display = 'inline-flex';
                } else {
                    displayEl.style.display = 'none';
                }
            }
        });
    }

    // 分页相关变量
    function goPage(p){if(p<1||p>totalPages)return;currentPage=p;renderTable(filteredData);}

    function escHtml(str){return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

    function renderTable(data){
        const container=document.getElementById('resultBody');
        if(!data.length){
            container.innerHTML=`<div class="empty-state"><div style="font-size:2rem;margin-bottom:12px;">🔍</div><div>没有符合筛选条件的数据</div></div>`;
            document.getElementById('paginationBar').style.display='none';return;
        }
        const schoolMap=new Map();
        data.forEach(row=>{const key=(row.school_code||'')+'|'+(row.name||'');if(!schoolMap.has(key))schoolMap.set(key,[]);schoolMap.get(key).push(row);});

        // 院校层次优先级：985 > 211 > 双一流 > 公办本科 > 民办本科 > 公办专科 > 民办专科
        function getLvPrio(lv){
            if(!lv) return 99;
            if(lv==='985'||lv.includes('985')) return 1;
            if(lv==='211'||lv.includes('211')) return 2;
            if(lv.includes('双一流')||lv.includes('一流')) return 3;
            // 公办本科
            if(lv.includes('公办')&&lv.includes('本科')) return 4;
            if(lv==='公办') return 4; // 兼容旧数据
            // 民办本科
            if(lv.includes('民办')&&lv.includes('本科')) return 5;
            if(lv==='民办') return 5; // 兼容旧数据
            // 公办专科
            if(lv.includes('公办')&&lv.includes('专科')) return 6;
            // 民办专科
            if(lv.includes('民办')&&lv.includes('专科')) return 7;
            return 99;
        }
        
        // 计算院校是否有大拇指（特色专业）
        function hasThumb(majors, schoolFeatures) {
            for (const m of majors) {
                const majorCategory = m.major_category || '';
                for (const feature of schoolFeatures) {
                    if (featuredMajorsMap[feature] && featuredMajorsMap[feature].includes(majorCategory)) {
                        return true;
                    }
                }
            }
            return false;
        }
        
        // 排序：1.有大拇指排前面 2.特色标签数量降序 3.院校层次优先级
        const groups=[...schoolMap.values()].sort((ga,gb)=>{
            const schoolNameA = ga[0].name || '';
            const schoolNameB = gb[0].name || '';
            const schoolFeaturesA = collegeFeaturesMap[schoolNameA] || [];
            const schoolFeaturesB = collegeFeaturesMap[schoolNameB] || [];
            
            // 1. 有大拇指的排前面
            const hasThumbA = hasThumb(ga, schoolFeaturesA);
            const hasThumbB = hasThumb(gb, schoolFeaturesB);
            if(hasThumbA !== hasThumbB) return hasThumbB ? 1 : -1;
            
            // 2. 特色标签数量降序
            const featureCountA = schoolFeaturesA.length;
            const featureCountB = schoolFeaturesB.length;
            if(featureCountA !== featureCountB) return featureCountB - featureCountA;
            
            // 3. 院校层次优先级
            return getLvPrio(ga[0].college_level||'') - getLvPrio(gb[0].college_level||'');
        });

        const ps=pageSize===0?groups.length:pageSize;
        totalPages=pageSize===0?1:Math.ceil(groups.length/ps);
        if(currentPage>totalPages)currentPage=Math.max(1,totalPages);
        const start=(currentPage-1)*ps;
        const pageGroups=groups.slice(start,start+ps);

        let html='';
        pageGroups.forEach(majors=>{
            const school=majors[0];
            // 检测是否为移动端
            const isMobileHeader = window.innerWidth <= 768;

            // 获取该院校所有符合条件的专业名称（全部显示，自动换行）
            // 先排序：试验班优先，然后按推荐顺序
            const sortedMajorNames = [...majors].sort((a, b) => {
                const aIsTest = (a.major_category || '').includes('试验班');
                const bIsTest = (b.major_category || '').includes('试验班');
                if (aIsTest && !bIsTest) return -1;
                if (!aIsTest && bIsTest) return 1;
                return (majorOrderMap[a.major_category] || 999) - (majorOrderMap[b.major_category] || 999);
            });
            // 专业名称标签颜色：试验班=橙色，前85个专业类=红色，其他=蓝色
            // 获取该院校的特色标签
            const schoolFeatures = collegeFeaturesMap[school.name] || [];
            
            const majorNamesHtml = sortedMajorNames.map(m => {
                const isTestMajor = (m.major_category || '').includes('试验班');
                const isTopMajor = topMajors.has(m.major_category);
                
                // 检查是否为特色专业（需要添加大拇指）
                let isFeaturedMajor = false;
                const majorCategory = m.major_category || '';
                
                // 遍历院校的所有特色标签，检查专业是否在特色专业列表中
                for (const feature of schoolFeatures) {
                    if (featuredMajorsMap[feature]) {
                        // 检查专业类是否在该特色类型的优势专业列表中
                        if (featuredMajorsMap[feature].includes(majorCategory)) {
                            isFeaturedMajor = true;
                            break;
                        }
                    }
                }
                
                let style;
                if (isTestMajor) {
                    // 试验班：高对比橙色 - 深橙文字+亮橙背景+粗边框
                    style = 'display:inline-block;background:linear-gradient(135deg, #ff9800 0%, #f57c00 100%);color:#fff;padding:4px 10px;border-radius:6px;font-size:0.8rem;margin-right:6px;margin-bottom:6px;border:2px solid #e65100;white-space:nowrap;vertical-align:middle;font-weight:700;box-shadow:0 2px 4px rgba(230,81,0,0.3);';
                } else if (isTopMajor) {
                    // 推荐专业：蓝色背景
                    style = 'display:inline-block;background:linear-gradient(135deg, #42a5f5 0%, #1976d2 100%);color:#fff;padding:4px 10px;border-radius:6px;font-size:0.8rem;margin-right:6px;margin-bottom:6px;border:2px solid #0d47a1;white-space:nowrap;vertical-align:middle;font-weight:600;box-shadow:0 2px 4px rgba(13,71,161,0.2);';
                } else {
                    // 不推荐专业：无背景，黑色字体和边框
                    style = 'display:inline-block;background:transparent;color:#333;padding:4px 10px;border-radius:6px;font-size:0.8rem;margin-right:6px;margin-bottom:6px;border:2px solid #333;white-space:nowrap;vertical-align:middle;font-weight:500;';
                }
                // 如果 major_remark 包含"中外"，在专业名称后面添加"（中外合作）"
                const majorName = m.major || '-';
                const majorRemark = m.major_remark || '';
                const displayMajorName = majorRemark.includes('中外') ? majorName + '（中外合作）' : majorName;
                // 如果是特色专业，添加大拇指图标
                const thumbIcon = isFeaturedMajor ? '<span style="margin-right:4px;">👍</span>' : '';
                return `<button class="major-tag-btn" type="button" style="${style}cursor:pointer;transition:all 0.2s;" onclick="showMajorModal('${escHtml(majorName)}')">${thumbIcon}${escHtml(displayMajorName)}</button>`;
            }).join('');

            // 专业数量标签
            const majorCountTag = `<span class="school-major-count" style="margin-left:12px;flex-shrink:0;">共 <strong>${majors.length}</strong> 个专业</span>`;

            // 获取院校特色标签
            const features = collegeFeaturesMap[school.name] || [];
            const featuresHtml = features.length > 0 ? features.map(f => {
                // 根据标签类型设置不同颜色 - 使用实心背景提高清晰度
                let bgColor, borderColor, textColor;
                if (f === '985') {
                    bgColor = '#FFB800';
                    borderColor = '#E5A600';
                    textColor = '#fff';
                } else if (f === '211') {
                    bgColor = '#3B9FE8';
                    borderColor = '#2B8FD8';
                    textColor = '#fff';
                } else if (f === '双一流') {
                    bgColor = '#A855F7';
                    borderColor = '#9333EA';
                    textColor = '#fff';
                } else if (f === '保研') {
                    bgColor = '#10B981';
                    borderColor = '#059669';
                    textColor = '#fff';
                } else {
                    bgColor = '#FB923C';
                    borderColor = '#EA580C';
                    textColor = '#fff';
                }
                return `<span style="display:inline-block;font-size:0.7rem;padding:2px 8px;border-radius:5px;background:${bgColor};border:1.5px solid ${borderColor};color:${textColor};white-space:nowrap;font-weight:700;margin-left:6px;box-shadow:0 1px 3px rgba(0,0,0,0.2);">${escHtml(f)}</span>`;
            }).join('') : '';

            // 获取专业组信息（用于显示组按钮）- 提前计算
            const groupMap=new Map();
            majors.forEach(row=>{const gk=row.major_group_code!=null?String(row.major_group_code):'__nogroup__';if(!groupMap.has(gk))groupMap.set(gk,[]);groupMap.get(gk).push(row);});
            const groupKeys=[...groupMap.keys()].sort((a,b)=>{if(a==='__nogroup__')return 1;if(b==='__nogroup__')return -1;return Number(a)-Number(b);});
            const hasGroups=groupKeys.length>1||(groupKeys.length===1&&groupKeys[0]!=='__nogroup__');

            // 显示院校代码、批次、批次备注、地址区域 - 提前计算
            const schoolCode = school.school_code || majors[0]?.school_code || '-';
            const batch = school.batch || majors[0]?.batch || '-';
            const batchRemark = school.batch_remark || majors[0]?.batch_remark || '';
            const collegeProvince = school.province || school.college_province || majors[0]?.province || majors[0]?.college_province || '';
            const collegeCity = school.college_city || majors[0]?.college_city || '';
            const provinceTag = collegeProvince ? `<span style="cursor:default;font-weight:600;color:#fff;background:rgba(244,114,182,0.15);padding:2px 10px;border-radius:4px;border:1px solid rgba(244,114,182,0.3);">${escHtml(collegeProvince)}</span>` : '';
            const cityTag = collegeCity ? `<span style="cursor:default;font-weight:600;color:#fff;background:rgba(244,114,182,0.15);padding:2px 10px;border-radius:4px;border:1px solid rgba(244,114,182,0.3);">${escHtml(collegeCity)}</span>` : '';
            const locationTags = (provinceTag || cityTag) ? `${provinceTag}${collegeProvince && collegeCity ? ' ' : ''}${cityTag}` : '<span style="color:var(--text-secondary);">-</span>';

            html+=`
            <div class="school-card collapsed">
                <div class="school-header" onclick="this.closest('.school-card').classList.toggle('collapsed')">
                    <div class="school-header-left">
                        <div class="school-name-row">
                            <div class="school-name-wrapper">
                                <a class="school-link" onclick="event.stopPropagation();window.open('school-detail.html?schoolName=${encodeURIComponent(school.name)}','_blank')" href="#">${escHtml(school.name||'-')}</a>
                                ${majorCountTag}${featuresHtml}
                            </div>
                        </div>
                    </div>
                    <div class="school-header-right">
                        <span class="expand-hint">
                            <span class="expand-text">点击展开</span>
                            <span class="expand-icon">▼</span>
                        </span>
                    </div>
                </div>
                <div class="school-code-bar" style="padding:8px 20px;background:#B5BAC7;border-bottom:1px solid rgba(59,159,232,0.08);color:var(--text-secondary);font-size:0.85rem;display:flex;align-items:center;gap:12px;flex-wrap:wrap;"><span style="display:flex;align-items:center;gap:8px;"><span style="color:var(--accent-cyan);font-weight:600;">院校代码：</span><span style="font-family:'Courier New',monospace;font-weight:700;color:#fff;background:rgba(59,159,232,0.15);padding:2px 10px;border-radius:4px;border:1px solid rgba(59,159,232,0.3);">${escHtml(String(schoolCode))}</span></span><span style="display:flex;align-items:center;gap:8px;"><span style="color:var(--accent-cyan);font-weight:600;">地址：</span>${locationTags}</span><span style="display:flex;align-items:center;gap:8px;"><span style="color:var(--accent-cyan);font-weight:600;">批次：</span><span style="font-weight:600;color:#fff;background:rgba(168,85,247,0.15);padding:2px 10px;border-radius:4px;border:1px solid rgba(168,85,247,0.3);">${escHtml(batch)}</span></span>${batchRemark?`<span style="display:flex;align-items:center;gap:8px;"><span style="color:var(--accent-cyan);font-weight:600;">备注：</span><span style="color:var(--text-secondary);">${escHtml(batchRemark)}</span></span>`:''}</div>
                <div class="school-majors-bar" style="padding:10px 20px;background:#D1D5DB;border-bottom:1px solid rgba(59,159,232,0.08);">
                    ${majorNamesHtml}
                </div>
                <div class="major-body" data-school-key="${escHtml((school.school_code||'')+'|'+(school.name||''))}">`;

            // 显示专业组按钮（可点击筛选）
            if(hasGroups){
                html+=`<div class="group-buttons" style="display:flex;flex-wrap:wrap;gap:8px;padding:12px 20px;background:#E5E7EB;border-bottom:1px solid rgba(59,159,232,0.12);">`;
                groupKeys.forEach((gk, idx)=>{
                    const label=gk==='__nogroup__'?'未分组':`第 ${gk} 组`;
                    const groupMajors = groupMap.get(gk);
                    const cnt = groupMajors.length;

                    // 计算专业组统计信息（使用实际数据）
                    const groupMinScore = groupMajors.reduce((min, r) => {
                        const score = r.min_score || r.min_score_1;
                        return score != null && (min === null || score < min) ? score : min;
                    }, null);
                    const groupMinRank = groupMajors.reduce((min, r) => {
                        const rank = r.rank || r.min_rank || r.min_rank_1;
                        return rank != null && (min === null || rank < min) ? rank : min;
                    }, null);

                    const stats = [];
                    stats.push(`${cnt}个专业`);
                    if(groupMinScore!=null) stats.push(`最低${groupMinScore}分`);
                    if(groupMinRank!=null) stats.push(`位次${Number(groupMinRank).toLocaleString()}`);
                    const statsText = stats.join(' · ');

                    // 判断是否高亮：专业组最低位次 >= 用户位次
                    const isHighlight = window.currentUserRank && groupMinRank && parseInt(groupMinRank) >= window.currentUserRank;
                    const highlightStyle = isHighlight ? 
                        'background:linear-gradient(135deg, rgba(16,185,129,0.2), rgba(59,159,232,0.2));border:2px solid rgba(16,185,129,0.6);box-shadow:0 2px 8px rgba(16,185,129,0.3);' : 
                        'background:rgba(59,159,232,0.15);border:1px solid rgba(59,159,232,0.3);';

                    html+=`<button class="group-btn${idx===0?' active':''}" onclick="showGroupModal('${escHtml(school.school_code||'')}', '${escHtml(school.name||'')}', '${escHtml(gk)}', '${escHtml(label)}')" data-group="${escHtml(gk)}" style="position:relative;display:inline-flex;align-items:center;gap:6px;${highlightStyle}border-radius:6px;padding:4px 10px;font-size:0.8rem;color:var(--accent-cyan);min-width:180px;cursor:pointer;transition:all 0.2s;"><span style="font-weight:600;min-width:60px;">${escHtml(label)}</span><span style="color:var(--text-secondary);font-size:0.75rem;">${statsText}</span></button>`;
                });
                html+=`</div>`;
            }

            // 直接显示所有符合条件的专业（不按组分开）
            // 先对专业排序：试验班优先，然后按推荐顺序
            const sortedMajors = [...majors].sort((a, b) => {
                const aIsTest = (a.major_category || '').includes('试验班');
                const bIsTest = (b.major_category || '').includes('试验班');
                if (aIsTest && !bIsTest) return -1;
                if (!aIsTest && bIsTest) return 1;
                return (majorOrderMap[a.major_category] || 999) - (majorOrderMap[b.major_category] || 999);
            });

            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                html+=`<div class="major-list-header"><span>专业名称</span><span>编号</span><span>最低分</span><span>概率</span></div>`;
            } else {
                html+=`<div class="major-list-header"><span>专业名称</span><span>专业编号</span><span>专业门类</span><span>最低分</span><span>最低位次</span><span>选科要求</span><span>招生计划</span><span>录取概率</span></div>`;
            }
            const isMobileView = window.innerWidth <= 768;
            sortedMajors.forEach(row=>{
                const sc=row.subject_require==='不限'?'unlimited':'';
                const pc=row.adjustedType==='冲'?'rush':(row.adjustedType==='保'?'safe':'stable');
                // 限制备注最多显示10个字
                let remarkText = row.major_remark || '';
                const displayRemark = remarkText.length > 10 ? remarkText.substring(0, 10) + '...' : remarkText;
                const remark=remarkText?`<span class="major-remark-text" title="${escHtml(remarkText)}">${escHtml(displayRemark)}</span>`:'';
                const gk = row.major_group_code != null ? String(row.major_group_code) : '__nogroup__';
                
                // 如果 major_remark 包含"中外"，在专业名称后面添加"（中外合作）"
                const majorName = row.major || '-';
                const displayMajorName = remarkText.includes('中外') ? majorName + '（中外合作）' : majorName;
                
                if (isMobileView) {
                    // 移动端只显示4列：专业名称、专业编号、最低分、录取概率
                    html+=`
                    <div class="major-row" data-group-code="${escHtml(gk)}">
                        <div class="major-row-left">
                            <span class="major-name-result" data-major="${(row.major||'').replace(/"/g,'&quot;')}">${escHtml(displayMajorName)}</span>
                            ${remark}
                        </div>
                        <div class="major-row-cell"><span style="color:var(--text-secondary);font-size:0.78rem;">${escHtml(row.major_code||'-')}</span></div>
                        <div class="major-row-cell"><span style="color:var(--accent-cyan);font-size:0.78rem;font-weight:600;">${row.min_score!=null?row.min_score:'-'}</span></div>
                        <div class="major-row-cell"><span style="font-size:0.78rem;">${escHtml(row.probability||'-')}</span></div>
                    </div>`;
                } else {
                    // 桌面端显示全部列
                    html+=`
                    <div class="major-row" data-group-code="${escHtml(gk)}">
                        <div class="major-row-left">
                            <span class="major-name-result" data-major="${(row.major||'').replace(/"/g,'&quot;')}">${escHtml(displayMajorName)}</span>
                            ${remark}
                        </div>
                        <div class="major-row-cell"><span style="color:var(--text-secondary);font-size:0.78rem;">${escHtml(row.major_code||'-')}</span></div>
                        <div class="major-row-cell"><span class="major-category-text${topMajors.has(row.major_category)?' top-major':''}">${escHtml(row.major_category||'-')}</span></div>
                        <div class="major-row-cell"><span class="score-val">${row.min_score!=null?row.min_score:'-'}</span></div>
                        <div class="major-row-cell"><span class="rank-val">${row.rank!=null?Number(row.rank).toLocaleString():'-'}</span></div>
                        <div class="major-row-cell"><span class="subject-badge ${sc}">${escHtml(row.subject_require||'-')}</span></div>
                        <div class="major-row-cell"><span style="color:var(--text-secondary);font-size:0.85rem;">${row.admit_count!=null?row.admit_count+'人':'-'}</span></div>
                        <div class="major-row-cell"><span class="prob-badge ${pc}">${escHtml(row.probability||'-')}</span></div>
                    </div>`;
                }
            });
            html+=`</div></div>`;
        });

        container.innerHTML=html;

        const pBar=document.getElementById('paginationBar');
        if(totalPages>1||pageSize===0){
            pBar.style.display='flex';
            document.getElementById('pageInfo').textContent = `第 ${currentPage} / ${totalPages} 页`;
            document.getElementById('btnFirst').disabled=currentPage===1;
            document.getElementById('btnPrev').disabled=currentPage===1;
            document.getElementById('btnNext').disabled=currentPage===totalPages;
            document.getElementById('btnLast').disabled=currentPage===totalPages;
        } else {pBar.style.display='none';}
    }

    function filterByGroup(btnEl, groupCode){
        // 切换按钮激活状态
        const buttons = btnEl.parentElement.querySelectorAll('.group-btn');
        buttons.forEach(b => {
            b.classList.remove('active');
            b.style.background = 'rgba(59,159,232,0.15)';
            b.style.borderColor = 'rgba(59,159,232,0.3)';
        });
        btnEl.classList.add('active');
        btnEl.style.background = 'rgba(59,159,232,0.35)';
        btnEl.style.borderColor = 'rgba(59,159,232,0.6)';
        
        // 筛选专业列表
        const majorBody = btnEl.closest('.major-body');
        const allRows = majorBody.querySelectorAll('.major-row');
        allRows.forEach(row => {
            const rowGroupCode = row.getAttribute('data-group-code');
            if (groupCode === '__all__' || rowGroupCode === groupCode) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    function switchGroupTab(tabEl){
        const majorBody=tabEl.closest('.group-tabs').parentElement;
        const panels=majorBody.querySelectorAll('.group-panel');
        const tabs=tabEl.closest('.group-tabs').querySelectorAll('.group-tab');
        const idx=[...tabs].indexOf(tabEl);
        tabs.forEach(t=>{
            t.classList.remove('active');
            // 电脑端：隐藏统计信息
            const statsDiv = t.querySelector('.tab-stats');
            if(statsDiv) statsDiv.style.display = 'none';
        });
        panels.forEach(p=>p.classList.remove('active'));
        tabEl.classList.add('active');
        if(panels[idx])panels[idx].classList.add('active');
        
        // 电脑端：显示选中选项卡的统计信息
        const isMobile = window.innerWidth <= 768;
        if(!isMobile){
            const statsDiv = tabEl.querySelector('.tab-stats');
            if(statsDiv) statsDiv.style.display = 'block';
        }
    }

    // ====================================================
    // 专业介绍 Tooltip（结果页）
    // ====================================================
    const tooltip=document.getElementById('majorTooltip');
    const ttTitle=document.getElementById('ttTitle');
    const ttBody=document.getElementById('ttBody');
    const majorCache={};
    let hideTimer=null, pendingMajor='';

    function showTooltipMajor(e, majorName){
        clearTimeout(hideTimer);pendingMajor=majorName;
        ttTitle.textContent=majorName;
        positionTooltip(); // 固定在窗口中间
        tooltip.classList.add('visible');
        if(majorCache[majorName]!==undefined){renderTooltipContent(majorCache[majorName]);return;}
        ttBody.innerHTML='<div class="tooltip-loading">加载中…</div>';
        fetch(`${API_BASE}/major-info?major_name=${encodeURIComponent(majorName)}`)
            .then(r=>r.json())
            .then(res=>{
                if(res.success&&res.data)majorCache[majorName]=res.data;
                if(pendingMajor===majorName){renderTooltipContent(res.success?res.data:null);tooltip.classList.add('visible');}
            })
            .catch(err=>{if(pendingMajor===majorName)ttBody.innerHTML=`<div class="tooltip-none">加载失败</div>`;});
    }
    // 格式化内容：关键词另起一行
    function formatContent(text){
        if(!text)return '';
        let result=escHtml(text);
        // 将"关键词："开头的部分另起一行
        result=result.replace(/关键词：/g,'<br><strong style="color:#6366f1;">关键词：</strong>');
        // 移除开头可能的多余换行
        if(result.startsWith('<br>'))result=result.substring(4);
        return result;
    }
    // 格式化就业方向：分号换行
    function formatCareerPath(text){
        if(!text)return '';
        let result=escHtml(text);
        // 将中英文分号替换为换行
        result=result.replace(/[;；]/g,'<br>');
        return result;
    }
    function renderTooltipContent(data){
        if(!data){ttBody.innerHTML='<div class="tooltip-none">暂无专业介绍</div>';return;}
        let h='';
        if(data.introduction)h+=`<div class="tooltip-section"><div class="tooltip-section-label">专业介绍</div><div class="tooltip-section-body">${formatContent(data.introduction)}</div></div>`;
        if(data.career_path)h+=`<div class="tooltip-section"><div class="tooltip-section-label">就业方向</div><div class="tooltip-section-body career-path-list">${formatCareerPath(data.career_path)}</div></div>`;
        if(data.courses)h+=`<div class="tooltip-section"><div class="tooltip-section-label">主要课程</div><div class="tooltip-section-body">${formatContent(data.courses)}</div></div>`;
        if(!h)h='<div class="tooltip-none">暂无专业介绍</div>';
        ttBody.innerHTML=h;
    }
    function positionTooltip(){
        // 固定在浏览器窗口中间
        tooltip.style.left='50%';
        tooltip.style.top='50%';
        tooltip.style.transform='translate(-50%, -50%)';
    }
    function hideTooltip(){hideTimer=setTimeout(()=>tooltip.classList.remove('visible'),300);}
    tooltip.addEventListener('mouseenter',()=>clearTimeout(hideTimer));
    tooltip.addEventListener('mouseleave',()=>hideTooltip());
    document.addEventListener('mouseover',e=>{const el=e.target.closest('.major-name-result');if(el)showTooltipMajor(e,el.dataset.major||el.textContent.trim());});
    // 移除 mousemove 监听，因为不再跟随鼠标
    document.addEventListener('mouseout',e=>{if(e.target.closest('.major-name-result'))hideTooltip();});

    // ====================================================
    // 院校描述 Tooltip（结果页）
    // ====================================================
    const schoolTooltip=document.getElementById('schoolTooltip');
    const schoolTtTitle=document.getElementById('schoolTtTitle');
    const schoolTtBody=document.getElementById('schoolTtBody');
    const schoolCache={};
    let schoolHideTimer=null, pendingSchool='';

    function showTooltipSchool(e, schoolName){
        clearTimeout(schoolHideTimer);pendingSchool=schoolName;
        schoolTtTitle.textContent=schoolName;
        document.getElementById('schoolTtMeta').innerHTML = '';
        positionSchoolTooltip();
        schoolTooltip.classList.add('visible');
        if(schoolCache[schoolName]!==undefined){renderSchoolTooltipContent(schoolCache[schoolName]);return;}
        schoolTtBody.innerHTML='<div class="school-tooltip-loading">加载中…</div>';
        fetch(`${API_BASE}/school-detail?schoolName=${encodeURIComponent(schoolName)}`)
            .then(r=>r.json())
            .then(res=>{
                if(res.success&&res.data)schoolCache[schoolName]=res.data;
                if(pendingSchool===schoolName){renderSchoolTooltipContent(res.success?res.data:null);schoolTooltip.classList.add('visible');}
            })
            .catch(err=>{if(pendingSchool===schoolName)schoolTtBody.innerHTML=`<div class="school-tooltip-none">加载失败</div>`;});
    }
    function renderSchoolTooltipContent(data){
        if(!data){schoolTtBody.innerHTML='<div class="school-tooltip-none">暂无院校介绍</div>';return;}
        
        // 渲染摘要信息（标题下方）
        const schoolTtMeta = document.getElementById('schoolTtMeta');
        let metaHtml = '';
        if(data.undergraduate_graduate){
            metaHtml += `<span class="school-tooltip-meta-item"><span class="school-tooltip-meta-label">办学层次</span><span class="school-tooltip-meta-value">${escHtml(data.undergraduate_graduate)}</span></span>`;
        }
        if(data.public_private){
            metaHtml += `<span class="school-tooltip-meta-item"><span class="school-tooltip-meta-label">办学性质</span><span class="school-tooltip-meta-value">${escHtml(data.public_private)}</span></span>`;
        }
        if(data.national_or_provincial){
            metaHtml += `<span class="school-tooltip-meta-item"><span class="school-tooltip-meta-label">隶属关系</span><span class="school-tooltip-meta-value">${escHtml(data.national_or_provincial)}</span></span>`;
        }
        schoolTtMeta.innerHTML = metaHtml;
        
        // 智能截取description前500字（到句号）
        function truncateDescription(text, maxLen=500){
            if(!text) return '';
            let result = text.substring(0, maxLen);
            // 如果结尾不是句号，继续截取到最近的句号
            if(result.length < text.length && !result.endsWith('。')){
                const lastPeriod = text.indexOf('。', maxLen);
                if(lastPeriod > -1 && lastPeriod < maxLen + 100){ // 最多再取100字
                    result = text.substring(0, lastPeriod + 1);
                }
            }
            return result;
        }
        
        // 渲染正文内容
        let h='';
        
        // 硕士点、博士点、升学率 - 紧凑标签式设计
        let infoTags = [];
        if(data.master_points){
            infoTags.push(`<div class="info-tag"><span class="info-tag-icon">🎓</span><span class="info-tag-text">硕士点 <strong>${escHtml(data.master_points)}</strong>个</span></div>`);
        }
        if(data.doctor_points){
            infoTags.push(`<div class="info-tag"><span class="info-tag-icon">📖</span><span class="info-tag-text">博士点 <strong>${escHtml(data.doctor_points)}</strong>个</span></div>`);
        }
        if(data.graduate_school_rate){
            infoTags.push(`<div class="info-tag"><span class="info-tag-icon">📈</span><span class="info-tag-text">保研率 <strong>${escHtml(data.graduate_school_rate)}</strong></span></div>`);
        }
        if(infoTags.length > 0){
            h += `<div class="school-tooltip-section"><div class="school-tooltip-section-label">办学实力</div><div class="school-tooltip-section-body info-tags-wrap">${infoTags.join('')}</div></div>`;
        }
        
        // 将特色专业字符串转换为标签
        function formatMajorTags(text, tagClass){
            if(!text) return '';
            const majors = text.split(/[;；]/).filter(m => m.trim());
            if(majors.length === 0) return '';
            return majors.map(m => `<span class="${tagClass}">${escHtml(m.trim())}</span>`).join('');
        }
        
        // 国家特色专业
        if(data.national_major_features){
            const tagsHtml = formatMajorTags(data.national_major_features, 'major-tag major-tag-national');
            h += `<div class="school-tooltip-section"><div class="school-tooltip-section-label">国家特色专业</div><div class="school-tooltip-section-body major-tags-wrap">${tagsHtml}</div></div>`;
        }
        
        // 省级特色专业
        if(data.provincial_major_features){
            const tagsHtml = formatMajorTags(data.provincial_major_features, 'major-tag major-tag-provincial');
            h += `<div class="school-tooltip-section"><div class="school-tooltip-section-label">省级特色专业</div><div class="school-tooltip-section-body major-tags-wrap">${tagsHtml}</div></div>`;
        }
        
        // 院校描述（description字段，智能截取前500字）
        if(data.description){
            const shortDesc = truncateDescription(data.description, 500);
            h += `<div class="school-tooltip-section"><div class="school-tooltip-section-label">院校简介</div><div class="school-tooltip-section-body">${formatContent(shortDesc)}</div></div>`;
        }
        
        if(!h) h='<div class="school-tooltip-none">暂无院校介绍</div>';
        schoolTtBody.innerHTML=h;
    }
    function positionSchoolTooltip(){
        schoolTooltip.style.left='50%';
        schoolTooltip.style.top='50%';
        schoolTooltip.style.transform='translate(-50%, -50%)';
    }
    function hideSchoolTooltip(){schoolHideTimer=setTimeout(()=>schoolTooltip.classList.remove('visible'),300);}
    schoolTooltip.addEventListener('mouseenter',()=>clearTimeout(schoolHideTimer));
    schoolTooltip.addEventListener('mouseleave',()=>hideSchoolTooltip());
    document.addEventListener('mouseover',e=>{const el=e.target.closest('.school-link');if(el){e.preventDefault();showTooltipSchool(e,el.textContent.trim());}});
    document.addEventListener('mouseout',e=>{if(e.target.closest('.school-link'))hideSchoolTooltip();});

    // 显示专业组模态框
    async function showGroupModal(schoolCode, schoolName, groupCode, groupLabel) {
        const modal = document.getElementById('groupModal');
        const title = document.getElementById('groupModalTitle');
        const body = document.getElementById('groupModalBody');
        
        title.textContent = `${schoolName} - ${groupLabel}`;
        body.innerHTML = '<div class="modal-empty-state"><div class="spinner-border" role="status"></div><p>加载中...</p></div>';
        modal.classList.add('active');
        
        try {
            const region = document.getElementById('region').value || '河南';
            let subjectCombination = document.getElementById('subjectCombination').value || '';
            
            // 如果subjectCombination为空，尝试从已选标签中提取必选科目（物理/历史）
            if (!subjectCombination) {
                const requiredTag = document.querySelector('[data-type="required"].selected');
                if (requiredTag) {
                    // 用户至少选了必选科目，用它来筛选
                    subjectCombination = requiredTag.dataset.value;
                    console.log(`⚠️ 用户未完整选择选科组合，仅使用必选科目筛选: ${subjectCombination}`);
                } else {
                    console.log('⚠️ 用户未选择任何选科组合，将返回该专业组所有专业');
                }
            }
            
            // 构建查询参数
            const params = new URLSearchParams({
                schoolCode: schoolCode,
                groupCode: groupCode,
                region: region,
                subjectCombination: subjectCombination,
                schoolName: schoolName
            });
            
            const resp = await fetch(`${API_BASE}/school-group-majors?${params.toString()}`);
            const result = await resp.json();
            
            if (!result.success) {
                const errorMsg = result.error === '缺少必要参数' ? '没有分组' : (result.error || '未知错误');
                body.innerHTML = `<div class="modal-empty-state error"><div style="font-size:2rem;margin-bottom:12px;">⚠️</div><div>${errorMsg}</div></div>`;
                return;
            }
            
            const majors = result.data || [];
            if (majors.length === 0) {
                body.innerHTML = '<div class="modal-empty-state"><div style="font-size:2rem;margin-bottom:12px;">📋</div><div>暂无数据</div></div>';
                return;
            }
            
            // 计算专业组的统计信息
            const totalMajors = majors.length;
            const minScore = majors.reduce((min, r) => r.min_score != null && (min === null || r.min_score < min) ? r.min_score : min, null);
            const minRank = majors.reduce((min, r) => r.rank != null && (min === null || r.rank < min) ? r.rank : min, null);
            
            // 构建统计信息文本
            const stats = [];
            stats.push(`共 ${totalMajors} 个专业`);
            if (minScore != null) stats.push(`组最低分 ${minScore}`);
            if (minRank != null) stats.push(`最低位次 ${Number(minRank).toLocaleString()}`);
            
            // 更新标题
            title.innerHTML = `${schoolName} - ${groupLabel} <span style="font-size:0.85rem;color:var(--text-secondary);font-weight:400;margin-left:12px;">${stats.join(' · ')}</span>`;
            
            // 渲染专业列表
            // 先排序：试验班优先，然后按推荐顺序
            const sortedModalMajors = [...majors].sort((a, b) => {
                const aIsTest = (a.major_category || '').includes('试验班');
                const bIsTest = (b.major_category || '').includes('试验班');
                if (aIsTest && !bIsTest) return -1;
                if (!aIsTest && bIsTest) return 1;
                return (majorOrderMap[a.major_category] || 999) - (majorOrderMap[b.major_category] || 999);
            });

            let html = '<div class="modal-major-list">';
            html += '<div class="modal-major-header"><span>专业名称</span><span>专业编号</span><span>专业门类</span><span>最低分</span><span>最低位次</span><span>选科要求</span><span>招生计划</span></div>';

            sortedModalMajors.forEach(row => {
                const sc = row.subject_require === '不限' ? 'unlimited' : '';
                
                // 判断该专业是否高亮：专业最低位次 >= 用户位次
                const majorRank = row.rank != null ? parseInt(row.rank) : null;
                const isHighlight = window.currentUserRank && majorRank && majorRank >= window.currentUserRank;
                const rowClass = isHighlight ? 'modal-major-row within-score' : 'modal-major-row';

                html += `
                <div class="${rowClass}">
                    <div class="modal-major-name">${escHtml(row.major || '-')}</div>
                    <div class="modal-major-cell">${escHtml(row.major_code || '-')}</div>
                    <div class="modal-major-cell${topMajors.has(row.major_category)?' top-major':''}">${escHtml(row.major_category || '-')}</div>
                    <div class="modal-major-cell"><span class="score-val">${row.min_score != null ? row.min_score : '-'}</span></div>
                    <div class="modal-major-cell">${row.rank != null ? Number(row.rank).toLocaleString() : '-'}</div>
                    <div class="modal-major-cell"><span class="subject-badge ${sc}">${escHtml(row.subject_require || '-')}</span></div>
                    <div class="modal-major-cell">${row.admit_count != null ? row.admit_count + '人' : '-'}</div>
                </div>`;
            });
            
            html += '</div>';
            body.innerHTML = html;
        } catch (err) {
            body.innerHTML = `<div class="modal-empty-state error"><div style="font-size:2rem;margin-bottom:12px;">⚠️</div><div>加载失败：${err.message}</div></div>`;
        }
    }
    
    // 关闭模态框
    function closeGroupModal() {
        document.getElementById('groupModal').classList.remove('active');
    }
    
    // 点击模态框背景关闭
    document.addEventListener('DOMContentLoaded', function() {
        document.getElementById('groupModal').addEventListener('click', function(e) {
            if (e.target === this) closeGroupModal();
        });
    });

    // ESC键关闭模态框和筛选面板
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('groupModal');
            const filterBar = document.getElementById('filterBar');
            if (modal && modal.classList.contains('active')) {
                closeGroupModal();
            } else if (filterBar && filterBar.classList.contains('active')) {
                closeFilterPanel();
            }
        }
    });