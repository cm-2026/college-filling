/**
 * 电子宠物组件 - 像素风智能客服
 * 包含：宠物行为控制、对话框管理、跨页面会话持久化
 */
(function () {
    'use strict';

    // ========== 跨页面会话管理器 ==========
    class ChatSessionManager {
        constructor() {
            this.storageKey = 'qd_pet_session';
            this.sessionExpiry = 30 * 60 * 1000; // 30分钟过期
        }

        getSession() {
            try {
                var raw = localStorage.getItem(this.storageKey);
                if (!raw) return null;
                var session = JSON.parse(raw);
                if (Date.now() - session.lastActive > this.sessionExpiry) {
                    this.clearSession();
                    return null;
                }
                return session;
            } catch (e) {
                return null;
            }
        }

        createSession() {
            var session = {
                sessionId: 'pet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                messages: [],
                context: {},
                createdAt: Date.now(),
                lastActive: Date.now()
            };
            this.saveSession(session);
            return session;
        }

        saveSession(session) {
            session.lastActive = Date.now();
            localStorage.setItem(this.storageKey, JSON.stringify(session));
        }

        addMessage(role, content) {
            var session = this.getSession() || this.createSession();
            session.messages.push({
                role: role,
                content: content,
                time: Date.now()
            });
            // 最多保留50条消息
            if (session.messages.length > 50) {
                session.messages = session.messages.slice(-50);
            }
            this.saveSession(session);
            return session;
        }

        clearSession() {
            localStorage.removeItem(this.storageKey);
        }

        getSessionId() {
            var session = this.getSession();
            return session ? session.sessionId : null;
        }
    }

    // ========== 规则引擎（从后端动态加载） ==========
    var RuleEngine = {
        rules: [],  // 空数组，初始化时从后端加载
        loaded: false,

        // 从后端加载规则
        load: function () {
            var self = this;
            fetch('/api/chat/rules')
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    if (data.success && data.data) {
                        self.rules = data.data.map(function (r) {
                            return {
                                keywords: (r.keywords || '').split(',').map(function(k) { return k.trim(); }).filter(function(k) { return k; }),
                                response: r.response
                            };
                        });
                        self.loaded = true;
                    }
                })
                .catch(function () {
                    // 加载失败使用内置兜底规则
                    self.rules = [
                        { keywords: ['你好', '嗨', '在吗'], response: '你好呀！我是权鼎教育的小助手~ 有什么关于高考志愿填报的问题都可以问我哦！' },
                        { keywords: ['怎么用', '使用方法', '帮助'], response: '使用方法很简单：\n1. 选择省份\n2. 输入分数或位次\n3. 选择选科组合\n4. 点击"开始推荐"' },
                        { keywords: ['分数', '录取分', '分数线'], response: '你可以在首页输入分数，系统会根据历年数据推荐匹配的院校和专业。' },
                        { keywords: ['选科', '科目'], response: '必选科目：物理或历史（二选一）\n再选科目：政治、地理、化学、生物中选2门' },
                        { keywords: ['位次', '排名'], response: '位次比分数更准确！建议使用位次来查询，因为分数线会波动，但位次相对稳定。' },
                        { keywords: ['专业', '什么专业好'], response: '选专业要结合兴趣和就业前景综合考虑。可以点击"专业名录"浏览。' },
                        { keywords: ['学校', '大学', '院校'], response: '选学校要看院校层次、地理位置、专业实力等。可以输入分数获取推荐列表！' },
                        { keywords: ['冲稳保', '志愿', '填报策略'], response: '遵循"冲-稳-保"原则：\n冲：录取概率低但心仪的学校\n稳：录取概率适中的学校\n保：录取概率高的学校保底' },
                        { keywords: ['批次', '一本', '二本', '本科'], response: '系统会根据你的分数自动匹配批次。结果页可按批次筛选。' }
                    ];
                    self.loaded = true;
                });
        },

        match(input) {
            var text = input.toLowerCase().trim();
            for (var i = 0; i < this.rules.length; i++) {
                var rule = this.rules[i];
                for (var j = 0; j < rule.keywords.length; j++) {
                    if (text.indexOf(rule.keywords[j]) !== -1) {
                        return rule.response;
                    }
                }
            }
            return null;
        }
    };

    // ========== 前端配置（从后端加载） ==========
    var PetConfig = {
        enabled: true,
        welcome: '你好！我是权鼎小助手 👋\n关于高考志愿填报的任何问题都可以问我哦！',
        quickQuestions: ['怎么使用这个系统？', '志愿填报策略', '位次和分数怎么选？'],
        petName: '权鼎小助手',

        load: function () {
            var self = this;
            fetch('/api/chat/config')
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    if (data.success && data.data) {
                        var config = data.data;
                        self.enabled = config.enabled !== false;
                        self.welcome = config.welcome || self.welcome;
                        self.quickQuestions = config.quickQuestions || self.quickQuestions;
                        self.petName = config.petName || self.petName;

                        // 如果禁用，移除宠物
                        if (!self.enabled) {
                            var container = document.getElementById('petContainer');
                            if (container) container.remove();
                            return;
                        }

                        // 更新对话框标题
                        var titleSpan = document.querySelector('.pet-dialog-title span:last-child');
                        if (titleSpan) titleSpan.textContent = self.petName;
                    }
                })
                .catch(function () { /* 使用默认配置 */ });
        }
    };

    // ========== 宠物组件主类 ==========
    var sessionManager = new ChatSessionManager();
    var isOpen = false;
    var isSending = false;
    var blinkTimer = null;

    // 创建宠物 HTML 结构
    function createPetHTML() {
        return '<div class="pet-container" id="petContainer">' +
            '<div class="pet-dialog-wrapper" id="petDialogWrapper">' +
                '<div class="pet-dialog">' +
                    '<div class="pet-dialog-header">' +
                        '<div class="pet-dialog-title">' +
                            '<div class="pet-title-text">' +
                                '<span class="pet-name">权鼎小助手</span>' +
                            '</div>' +
                        '</div>' +
                        '<div class="pet-header-actions">' +
                            '<button class="pet-action-btn" id="petClearBtn" title="清空对话">🗑️</button>' +
                            '<button class="pet-action-btn pet-close-btn" id="petDialogClose" title="关闭">✕</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="pet-dialog-messages" id="petDialogMessages"></div>' +
                    '<div class="pet-dialog-input-area">' +
                        '<div class="pet-input-wrapper">' +
                            '<input type="text" class="pet-dialog-input" id="petDialogInput" placeholder="输入你的问题，按回车发送..." maxlength="200">' +
                            '<button class="pet-dialog-send" id="petDialogSend">' +
                                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                                    '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>' +
                                '</svg>' +
                            '</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="pet-character" id="petCharacter" title="点击和我聊天">' +
                '<div class="pet-pixel-art">' +
                    '<div class="pet-head">' +
                        '<div class="pet-eyes">' +
                            '<div class="pet-eye"></div>' +
                            '<div class="pet-eye"></div>' +
                        '</div>' +
                        '<div class="pet-mouth"></div>' +
                    '</div>' +
                    '<div class="pet-body"></div>' +
                    '<div class="pet-legs">' +
                        '<div class="pet-leg pet-leg-left"></div>' +
                        '<div class="pet-leg pet-leg-right"></div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    }

    // 初始化
    function init() {
        // 先加载配置和规则
        PetConfig.load();
        RuleEngine.load();

        // 插入 HTML
        document.body.insertAdjacentHTML('beforeend', createPetHTML());

        // 获取元素
        var petChar = document.getElementById('petCharacter');
        var dialogWrapper = document.getElementById('petDialogWrapper');
        var dialogClose = document.getElementById('petDialogClose');
        var dialogClear = document.getElementById('petClearBtn');
        var dialogInput = document.getElementById('petDialogInput');
        var dialogSend = document.getElementById('petDialogSend');
        var dialogMessages = document.getElementById('petDialogMessages');

        // 点击宠物切换对话框
        petChar.addEventListener('click', function (e) {
            e.stopPropagation();
            if (isOpen) {
                closeDialog();
            } else {
                openDialog();
            }
        });

        // 关闭按钮
        dialogClose.addEventListener('click', function (e) {
            e.stopPropagation();
            closeDialog();
        });

        // 清空对话按钮
        dialogClear.addEventListener('click', function (e) {
            e.stopPropagation();
            if (confirm('确定要清空当前对话吗？')) {
                sessionManager.clearSession();
                dialogMessages.innerHTML = '';
                showWelcome();
            }
        });

        // 点击外部关闭
        document.addEventListener('click', function (e) {
            if (isOpen && !document.getElementById('petContainer').contains(e.target)) {
                closeDialog();
            }
        });

        // 发送消息
        dialogSend.addEventListener('click', sendMessage);

        // 回车发送
        dialogInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // 阻止对话框点击冒泡
        dialogWrapper.addEventListener('click', function (e) {
            e.stopPropagation();
        });

        // 启动眨眼定时器
        startBlinking();

        // 恢复历史会话
        var session = sessionManager.getSession();
        if (session && session.messages.length > 0) {
            renderHistoryMessages(session.messages);
        }
    }

    // 打开对话框（异空间拖出）
    function openDialog() {
        var wrapper = document.getElementById('petDialogWrapper');
        wrapper.classList.remove('closing');
        // 先强制重绘
        void wrapper.offsetWidth;
        wrapper.classList.add('open');
        isOpen = true;

        // 如果没有消息，显示欢迎语
        var messages = document.getElementById('petDialogMessages');
        if (messages.children.length === 0) {
            showWelcome();
        }

        // 聚焦输入框
        setTimeout(function () {
            document.getElementById('petDialogInput').focus();
        }, 400);
    }

    // 关闭对话框（缩回异空间）
    function closeDialog() {
        var wrapper = document.getElementById('petDialogWrapper');
        wrapper.classList.remove('open');
        wrapper.classList.add('closing');
        isOpen = false;
        setPetState('normal');
    }

    // 设置宠物表情状态
    function setPetState(state) {
        var petChar = document.getElementById('petCharacter');
        petChar.classList.remove('blinking', 'speaking');
        if (state !== 'normal') {
            petChar.classList.add(state);
        }
    }

    // 眨眼定时器
    function startBlinking() {
        blinkTimer = setInterval(function () {
            if (isSending) return;
            setPetState('blinking');
            setTimeout(function () {
                setPetState('normal');
            }, 200);
        }, 4000 + Math.random() * 2000);
    }

    // 显示欢迎消息
    function showWelcome() {
        var welcomeMsg = PetConfig.welcome || '你好！我是权鼎小助手 👋\n\n关于高考志愿填报的任何问题都可以问我哦！';
        var quickQuestions = PetConfig.quickQuestions;

        var html = '<div class="pet-msg bot pet-welcome">' +
            '<div class="pet-welcome-content">' +
            escapeHTML(welcomeMsg).replace(/\n/g, '<br>') +
            '</div>';

        if (quickQuestions && quickQuestions.length > 0) {
            html += '<div class="pet-quick-questions">' +
                '<div class="pet-quick-title">💡 快速提问</div>' +
                '<div class="pet-quick-list">' +
                quickQuestions.map(function (q) {
                    return '<button class="pet-quick-btn" data-question="' + escapeAttr(q) + '">' + escapeHTML(q) + '</button>';
                }).join('') +
                '</div>' +
            '</div>';
        }

        html += '</div>';

        var messagesEl = document.getElementById('petDialogMessages');
        messagesEl.insertAdjacentHTML('beforeend', html);

        // 绑定快捷问题点击
        messagesEl.querySelectorAll('.pet-quick-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var question = this.getAttribute('data-question');
                document.getElementById('petDialogInput').value = question;
                sendMessage();
            });
        });

        scrollMessages();
        sessionManager.addMessage('bot', welcomeMsg);
    }

    // 渲染历史消息
    function renderHistoryMessages(messages) {
        var messagesEl = document.getElementById('petDialogMessages');
        var html = '';
        for (var i = 0; i < messages.length; i++) {
            var msg = messages[i];
            var cls = msg.role === 'user' ? 'user' : 'bot';
            html += '<div class="pet-msg ' + cls + '">' +
                escapeHTML(msg.content).replace(/\n/g, '<br>') +
            '</div>';
        }
        messagesEl.innerHTML = html;
        scrollMessages();
    }

    // 发送消息
    function sendMessage() {
        var input = document.getElementById('petDialogInput');
        var text = input.value.trim();
        if (!text || isSending) return;

        isSending = true;
        input.value = '';
        document.getElementById('petDialogSend').disabled = true;

        // 显示用户消息
        appendMessage('user', text);
        sessionManager.addMessage('user', text);

        // 宠物开始说话状态
        setPetState('speaking');

        // 显示加载指示器
        showTyping();

        // 先尝试规则引擎
        var ruleResponse = RuleEngine.match(text);
        if (ruleResponse) {
            setTimeout(function () {
                hideTyping();
                appendMessage('bot', ruleResponse);
                sessionManager.addMessage('bot', ruleResponse);
                finishSending();
            }, 500 + Math.random() * 500);
        } else {
            // 调用后端 API
            callChatAPI(text);
        }
    }

    // 调用后端聊天 API（流式版本）
    function callChatAPI(text) {
        var token = localStorage.getItem('qd_token');
        var session = sessionManager.getSession();

        // 构建上下文消息列表（最近6轮）
        var contextMessages = [];
        if (session && session.messages && session.messages.length > 0) {
            var recentMessages = session.messages.slice(-12); // 最近6轮（每轮2条）
            recentMessages.forEach(function(msg) {
                contextMessages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                });
            });
        }

        // 创建流式消息元素
        hideTyping();
        var messagesEl = document.getElementById('petDialogMessages');
        var botMsgEl = document.createElement('div');
        botMsgEl.className = 'pet-msg bot';
        botMsgEl.innerHTML = '<span class="bot-content"></span><span class="typing-cursor">|</span>';
        messagesEl.appendChild(botMsgEl);
        scrollMessages();

        var fullReply = '';  // 收集完整回复
        var botContentEl = botMsgEl.querySelector('.bot-content');
        var cursorEl = botMsgEl.querySelector('.typing-cursor');

        // 使用 fetch + ReadableStream 接收流式数据
        fetch('/api/chat/stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? 'Bearer ' + token : ''
            },
            body: JSON.stringify({
                message: text,
                sessionId: session ? session.sessionId : null,
                context: contextMessages
            })
        })
        .then(function(res) {
            if (!res.ok) {
                throw new Error('请求失败');
            }
            return res.body.getReader();
        })
        .then(function(reader) {
            var decoder = new TextDecoder();
            var buffer = '';

            function read() {
                reader.read().then(function(result) {
                    if (result.done) {
                        // 处理剩余缓冲区数据
                        if (buffer) {
                            processBuffer(buffer);
                        }
                        // 隐藏光标，结束
                        if (cursorEl) cursorEl.style.display = 'none';
                        sessionManager.addMessage('bot', fullReply);
                        finishSending();
                        return;
                    }

                    buffer += decoder.decode(result.value, { stream: true });
                    processBuffer(buffer);
                    buffer = '';
                    read();
                }).catch(function(err) {
                    console.error('流式读取错误:', err);
                    botContentEl.innerHTML = escapeHTML('网络好像出了点问题，请检查网络后重试~');
                    if (cursorEl) cursorEl.style.display = 'none';
                    sessionManager.addMessage('bot', '网络好像出了点问题，请检查网络后重试~');
                    finishSending();
                });
            }

            function processBuffer(buffer) {
                var lines = buffer.split('\n');
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i].trim();
                    if (line.startsWith('data: ')) {
                        try {
                            var data = JSON.parse(line.slice(6));
                            if (data.type === 'char') {
                                fullReply += data.content;
                                // 实时显示字符
                                var displayText = escapeHTML(fullReply).replace(/\n/g, '<br>');
                                botContentEl.innerHTML = displayText;
                                scrollMessages();
                            } else if (data.type === 'error') {
                                botContentEl.innerHTML = escapeHTML(data.content);
                                if (cursorEl) cursorEl.style.display = 'none';
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }

            read();
        })
        .catch(function(err) {
            console.error('流式请求错误:', err);
            botMsgEl.remove();
            var fallback = '网络好像出了点问题，请检查网络后重试~';
            appendMessage('bot', fallback);
            sessionManager.addMessage('bot', fallback);
            finishSending();
        });
    }

    // 完成发送状态
    function finishSending() {
        isSending = false;
        document.getElementById('petDialogSend').disabled = false;
        // 延迟恢复正常表情
        setTimeout(function () {
            if (!isSending) {
                setPetState('normal');
            }
        }, 1000);
    }

    // 追加消息到对话框
    function appendMessage(role, content) {
        var messagesEl = document.getElementById('petDialogMessages');
        var cls = role === 'user' ? 'user' : 'bot';
        messagesEl.insertAdjacentHTML('beforeend',
            '<div class="pet-msg ' + cls + '">' + escapeHTML(content).replace(/\n/g, '<br>') + '</div>'
        );
        scrollMessages();
    }

    // 显示正在输入指示器
    function showTyping() {
        var messagesEl = document.getElementById('petDialogMessages');
        messagesEl.insertAdjacentHTML('beforeend',
            '<div class="pet-msg-typing" id="petTyping">' +
                '<div class="pet-typing-dot"></div>' +
                '<div class="pet-typing-dot"></div>' +
                '<div class="pet-typing-dot"></div>' +
            '</div>'
        );
        scrollMessages();
    }

    // 隐藏正在输入指示器
    function hideTyping() {
        var typing = document.getElementById('petTyping');
        if (typing) typing.remove();
    }

    // 滚动到最新消息
    function scrollMessages() {
        var messagesEl = document.getElementById('petDialogMessages');
        setTimeout(function () {
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }, 50);
    }

    // HTML 转义 + Markdown 简单格式化
    function escapeHTML(str) {
        var div = document.createElement('div');
        div.textContent = str;
        var html = div.innerHTML;
        // 将 ### 标题 转为 <h4>标题</h4>
        html = html.replace(/^###\s*(.+)$/gm, '<h4 style="margin:8px 0 4px;font-size:15px;color:#1e293b;">$1</h4>');
        // 将 ## 标题 转为 <h3>标题</h3>
        html = html.replace(/^##\s*(.+)$/gm, '<h3 style="margin:10px 0 4px;font-size:16px;color:#1e293b;">$1</h3>');
        // 将 # 标题 转为 <h2>标题</h2>
        html = html.replace(/^#\s*(.+)$/gm, '<h2 style="margin:12px 0 4px;font-size:17px;color:#1e293b;">$1</h2>');
        // 将 **粗体** 转为 <strong>粗体</strong>
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // 将 *斜体* 转为 <em>斜体</em>
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        // 将 `代码` 转为 <code>代码</code>
        html = html.replace(/`(.+?)`/g, '<code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;font-size:12px;color:#ef4444;">$1</code>');
        // 将 --- 或 *** 或 ___ 分隔线转为 <hr>
        html = html.replace(/^[\-*_]\s*[\-*_]\s*[\-*_]+\s*$/gm, '<hr style="border:none;border-top:1px solid #e2e8f0;margin:8px 0;">');
        return html;
    }

    // 属性值转义
    function escapeAttr(str) {
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // DOM Ready 后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
