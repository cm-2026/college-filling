/**
 * 独立智能客服页面 - 权鼎小助手
 * 完整对话界面，支持 Markdown 渲染、流式响应、会话持久化
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
                sessionId: 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
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

    // ========== 配置加载 ==========
    var ChatConfig = {
        enabled: true,
        welcome: '你好！我是权鼎小助手 👋\n\n关于高考志愿填报的任何问题都可以问我哦！',
        quickQuestions: ['怎么使用这个系统？', '志愿填报策略', '位次和分数怎么选？', '女生适合什么专业？', '什么专业就业前景好？'],
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
                        self.quickQuestions = (config.quickQuestions && config.quickQuestions.length > 0) ? config.quickQuestions : self.quickQuestions;
                        self.petName = config.petName || self.petName;
                    }
                })
                .catch(function () { /* 使用默认配置 */ });
        }
    };

    // ========== Markdown 渲染 ==========
    function escapeHTMLBasic(str) {
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#39;');
    }

    function renderMarkdown(str) {
        var div = document.createElement('div');
        div.textContent = str;
        var html = div.innerHTML;
        
        // 按行分割处理
        var lines = html.split('\n');
        var inTable = false;
        var tableBuffer = [];
        var listType = ''; // 'ul' | 'ol' | ''
        var listBuffer = [];
        var result = [];
        var paragraph = []; // 收集连续普通行
        
        // 将收集的普通行合并为 <p> 段落
        function flushParagraph() {
            if (paragraph.length > 0) {
                result.push('<p>' + paragraph.join('<br>') + '</p>');
                paragraph = [];
            }
        }
        
        // 将收集的列表项合并为完整的列表
        function flushList() {
            if (listType && listBuffer.length > 0) {
                result.push('<' + listType + '>' + listBuffer.join('') + '</' + listType + '>');
            }
            listType = '';
            listBuffer = [];
        }
        
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            
            // 处理标题（任何行开头都匹配）
            if (line.trim().startsWith('### ')) {
                flushList(); flushParagraph();
                line = line.replace(/^###\s*(.+)/, '<h4>$1</h4>');
                result.push(line);
                continue;
            } else if (line.trim().startsWith('## ')) {
                flushList(); flushParagraph();
                line = line.replace(/^##\s*(.+)/, '<h3>$1</h3>');
                result.push(line);
                continue;
            } else if (line.trim().startsWith('# ')) {
                flushList(); flushParagraph();
                line = line.replace(/^#\s*(.+)/, '<h2>$1</h2>');
                result.push(line);
                continue;
            }
            
            // 处理表格行
            if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
                flushList(); flushParagraph();
                if (!inTable) {
                    inTable = true;
                    tableBuffer = [];
                }
                tableBuffer.push(line);
                continue;
            } else if (inTable) {
                flushList(); flushParagraph();
                // 表格结束，处理整个表格
                if (tableBuffer.length >= 2) {
                    var headerRow = tableBuffer[0];
                    var separatorRow = tableBuffer[1];
                    var bodyRows = tableBuffer.slice(2);
                    
                    var headers = headerRow.trim().split('|').filter(function(cell) {
                        return cell.trim().length > 0;
                    }).map(function(cell) {
                        return cell.trim();
                    });
                    
                    var processedBodyRows = bodyRows.filter(function(row) {
                        return row.trim().length > 0;
                    }).map(function(row) {
                        return row.trim().split('|').filter(function(cell) {
                            return cell.trim().length >= 0;
                        }).map(function(cell) {
                            return cell.trim();
                        }).slice(1, -1);
                    });
                    
                    var tableHtml = '<div><table>';
                    tableHtml += '<thead><tr>';
                    headers.forEach(function(h) {
                        tableHtml += '<th>' + h + '</th>';
                    });
                    tableHtml += '</tr></thead><tbody>';
                    processedBodyRows.forEach(function(r, idx) {
                        tableHtml += '<tr>';
                        r.forEach(function(cell) {
                            tableHtml += '<td>' + cell + '</td>';
                        });
                        tableHtml += '</tr>';
                    });
                    tableHtml += '</tbody></table></div>';
                    result.push(tableHtml);
                }
                inTable = false;
                tableBuffer = [];
                // 当前行不属表格，继续处理
            }
            
            // 处理无序列表
            var ulMatch = line.match(/^(\s*)[-*+]\s+(.*)/);
            if (ulMatch) {
                flushParagraph();
                if (listType !== 'ul') { flushList(); listType = 'ul'; }
                listBuffer.push('<li>' + ulMatch[2] + '</li>');
                continue;
            }
            
            // 处理有序列表
            var olMatch = line.match(/^(\s*)\d+\.\s+(.*)/);
            if (olMatch) {
                flushParagraph();
                if (listType !== 'ol') { flushList(); listType = 'ol'; }
                listBuffer.push('<li>' + olMatch[2] + '</li>');
                continue;
            }
            
            // 处理引用
            var quoteMatch = line.match(/^>\s+(.*)/);
            if (quoteMatch) {
                flushList(); flushParagraph();
                result.push('<blockquote>' + quoteMatch[1] + '</blockquote>');
                continue;
            }
            
            // 处理分隔线
            if (line.trim().match(/^([\-*_])\s*\1\s*\1+$/)) {
                flushList(); flushParagraph();
                result.push('<hr>');
                continue;
            }
            
            // 普通行
            if (line.trim().length > 0) {
                flushList();
                paragraph.push(line);
            } else {
                // 空行分段
                flushList(); flushParagraph();
            }
        }
        // 处理末尾列表和段落
        flushList();
        flushParagraph();
        
        // 如果文件结束时还在表格
        if (inTable && tableBuffer.length >= 2) {
            var headerRow = tableBuffer[0];
            var separatorRow = tableBuffer[1];
            var bodyRows = tableBuffer.slice(2);
            
            var headers = headerRow.trim().split('|').filter(function(cell) {
                return cell.trim().length > 0;
            }).map(function(cell) {
                return cell.trim();
            });
            
            var processedBodyRows = bodyRows.filter(function(row) {
                return row.trim().length > 0;
            }).map(function(row) {
                return row.trim().split('|').filter(function(cell) {
                    return cell.trim().length >= 0;
                }).map(function(cell) {
                    return cell.trim();
                }).slice(1, -1);
            });
            
            var tableHtml = '<div><table>';
            tableHtml += '<thead><tr>';
            headers.forEach(function(h) {
                tableHtml += '<th>' + h + '</th>';
            });
            tableHtml += '</tr></thead><tbody>';
            processedBodyRows.forEach(function(r, idx) {
                tableHtml += '<tr>';
                r.forEach(function(cell) {
                    tableHtml += '<td>' + cell + '</td>';
                });
                tableHtml += '</tr>';
            });
            tableHtml += '</tbody></table></div>';
            result.push(tableHtml);
        }
        
        html = result.join('');
        
        // 处理代码块
        var codeBlockRegex = /```([\s\S]*?)```/g;
        html = html.replace(codeBlockRegex, '<pre><code>$1</code></pre>');
        
        // 行内元素
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
        html = html.replace(/`(.+?)`/g, '<code>$1</code>');
        html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
        
        return html;
    }

    // ========== 全局变量 ==========
    var sessionManager = new ChatSessionManager();
    var isSending = false;
    var messagesEl = document.getElementById('chatMessages');
    var inputEl = document.getElementById('chatInput');
    var sendBtn = document.getElementById('btnSend');
    var clearBtn = document.getElementById('btnClearChat');

    // ========== 工具函数 ==========
    function scrollToBottom() {
        setTimeout(function () {
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }, 50);
    }

    function autoResizeTextarea() {
        inputEl.style.height = 'auto';
        var scrollHeight = inputEl.scrollHeight;
        var maxHeight = 200;
        inputEl.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    }

    // ========== 消息渲染 ==========
    function appendMessage(role, content) {
        var cls = role === 'user' ? 'user' : 'bot';
        var renderedContent = role === 'bot' ? renderMarkdown(content) : escapeHTMLBasic(content);
        var html = '<div class="pet-msg ' + cls + '">' + renderedContent + '</div>';
        messagesEl.insertAdjacentHTML('beforeend', html);
        scrollToBottom();
    }

    function showTyping() {
        var html = '<div class="pet-msg-typing" id="chatTyping">' +
            '<div class="pet-typing-dot"></div>' +
            '<div class="pet-typing-dot"></div>' +
            '<div class="pet-typing-dot"></div>' +
            '</div>';
        messagesEl.insertAdjacentHTML('beforeend', html);
        scrollToBottom();
    }

    function hideTyping() {
        var typing = document.getElementById('chatTyping');
        if (typing) typing.remove();
    }

    function renderWelcome() {
        var welcomeMsg = ChatConfig.welcome || '你好！我是权鼎小助手 👋\n\n关于高考志愿填报的任何问题都可以问我哦！';
        var html = '<div class="pet-msg bot pet-welcome">' +
            '<div class="pet-welcome-content">' +
            renderMarkdown(welcomeMsg) +
            '</div>';
        
        if (ChatConfig.quickQuestions && ChatConfig.quickQuestions.length > 0) {
            html += '<div class="pet-quick-questions">' +
                '<div class="pet-quick-list">' +
                ChatConfig.quickQuestions.map(function (q) {
                    return '<button class="pet-quick-btn" data-question="' + escapeAttr(q) + '">' + escapeHTMLBasic(q) + '</button>';
                }).join('') +
                '</div>' +
                '</div>';
        }

        html += '</div>';
        messagesEl.innerHTML = html;

        // 绑定快捷提问点击
        messagesEl.querySelectorAll('.pet-quick-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var question = this.getAttribute('data-question');
                inputEl.value = question;
                autoResizeTextarea();
                sendMessage();
            });
        });
    }

    function renderHistoryMessages(messages) {
        messagesEl.innerHTML = '';
        // 先渲染欢迎语+快速提问
        renderWelcomeOnly();
        // 再渲染历史消息
        for (var i = 0; i < messages.length; i++) {
            var msg = messages[i];
            appendMessage(msg.role, msg.content);
        }
    }

    function renderWelcomeOnly() {
        var welcomeMsg = ChatConfig.welcome || '你好！我是权鼎小助手 👋\n\n关于高考志愿填报的任何问题都可以问我哦！';
        var html = '<div class="pet-msg bot pet-welcome">' +
            '<div class="pet-welcome-content">' +
            renderMarkdown(welcomeMsg) +
            '</div>';

        if (ChatConfig.quickQuestions && ChatConfig.quickQuestions.length > 0) {
            html += '<div class="pet-quick-questions">' +
                '<div class="pet-quick-list">' +
                ChatConfig.quickQuestions.map(function (q) {
                    return '<button class="pet-quick-btn" data-question="' + escapeAttr(q) + '">' + escapeHTMLBasic(q) + '</button>';
                }).join('') +
                '</div>' +
                '</div>';
        }

        html += '</div>';
        messagesEl.innerHTML = html;

        // 绑定快捷提问点击
        messagesEl.querySelectorAll('.pet-quick-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var question = this.getAttribute('data-question');
                inputEl.value = question;
                autoResizeTextarea();
                sendMessage();
            });
        });
    }

    function escapeAttr(str) {
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ========== 发送消息 ==========
    function sendMessage() {
        var text = inputEl.value.trim();
        if (!text || isSending) return;

        isSending = true;
        inputEl.value = '';
        inputEl.style.height = 'auto';
        sendBtn.disabled = true;

        // 显示用户消息
        appendMessage('user', text);
        sessionManager.addMessage('user', text);

        // 显示加载指示器
        showTyping();

        // 构建上下文消息列表
        var token = localStorage.getItem('qd_token');
        var session = sessionManager.getSession();
        var contextMessages = [];
        if (session && session.messages && session.messages.length > 0) {
            var recentMessages = session.messages.slice(-12);
            recentMessages.forEach(function(msg) {
                contextMessages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                });
            });
        }

        // 创建流式消息元素
        hideTyping();
        var botMsgEl = document.createElement('div');
        botMsgEl.className = 'pet-msg bot';
        botMsgEl.innerHTML = '<span class="bot-content"></span><span class="typing-cursor">|</span>';
        messagesEl.appendChild(botMsgEl);
        scrollToBottom();

        var fullReply = '';
        var lastProcessedLen = 0;
        var botContentEl = botMsgEl.querySelector('.bot-content');
        var cursorEl = botMsgEl.querySelector('.typing-cursor');

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
                        if (buffer) {
                            processBuffer(buffer);
                        }
                        if (cursorEl) cursorEl.style.display = 'none';
                        botContentEl.innerHTML = renderMarkdown(fullReply);
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
                    botContentEl.innerHTML = '网络好像出了点问题，请检查网络后重试~';
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
                                var newText = fullReply.substring(lastProcessedLen);
                                lastProcessedLen = fullReply.length;
                                var newHtml = escapeHTMLBasic(newText).replace(/\n/g, '<br>');
                                if (newHtml) {
                                    botContentEl.insertAdjacentHTML('beforeend', newHtml);
                                    scrollToBottom();
                                }
                            } else if (data.type === 'error') {
                                botContentEl.innerHTML = escapeHTMLBasic(data.content);
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
            appendMessage('bot', '网络好像出了点问题，请检查网络后重试~');
            sessionManager.addMessage('bot', '网络好像出了点问题，请检查网络后重试~');
            finishSending();
        });
    }

    function finishSending() {
        isSending = false;
        sendBtn.disabled = false;
        inputEl.focus();
    }

    // ========== 清空对话 ==========
    function clearChat() {
        sessionManager.clearSession();
        messagesEl.innerHTML = '';
        renderWelcome();
    }

    // ========== 初始化 ==========
    function init() {
        // 加载配置
        ChatConfig.load();

        // 自动增长textarea
        inputEl.addEventListener('input', autoResizeTextarea);
        
        // 发送事件
        sendBtn.addEventListener('click', sendMessage);
        inputEl.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // 清空按钮
        clearBtn.addEventListener('click', clearChat);
        
        // 恢复历史消息
        var session = sessionManager.getSession();
        if (session && session.messages && session.messages.length > 0) {
            renderHistoryMessages(session.messages);
        } else {
            renderWelcome();
        }
        
        // 聚焦输入框
        setTimeout(function () {
            inputEl.focus();
        }, 300);
    }

    // DOM Ready 后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
