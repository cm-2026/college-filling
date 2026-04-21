-- 智能客服配置相关表

-- 1. 客服基础配置表（单行配置）
CREATE TABLE IF NOT EXISTS chat_basic_config (
    id INT PRIMARY KEY DEFAULT 1,
    enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用智能客服',
    welcome TEXT COMMENT '欢迎语',
    quick_questions JSON COMMENT '快捷问题列表',
    pet_name VARCHAR(50) DEFAULT '权鼎小助手' COMMENT '宠物名称',
    deepseek_enabled TINYINT(1) DEFAULT 0 COMMENT '是否启用DeepSeek AI',
    deepseek_api_key VARCHAR(500) DEFAULT '' COMMENT 'DeepSeek API Key',
    deepseek_model VARCHAR(100) DEFAULT 'deepseek-chat' COMMENT 'DeepSeek模型名称',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 插入默认配置
INSERT INTO chat_basic_config (id, enabled, welcome, quick_questions, pet_name)
VALUES (1, 1, '你好！我是权鼎小助手 👋\n关于高考志愿填报的任何问题都可以问我哦！',
    '["怎么使用这个系统？", "志愿填报策略", "位次和分数怎么选？"]',
    '权鼎小助手')
ON DUPLICATE KEY UPDATE id=id;

-- 2. 问答规则表
CREATE TABLE IF NOT EXISTS chat_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    keywords VARCHAR(500) NOT NULL COMMENT '关键词，逗号分隔',
    response TEXT NOT NULL COMMENT '自动回复内容',
    priority INT DEFAULT 0 COMMENT '优先级，数字越大越高',
    status TINYINT(1) DEFAULT 1 COMMENT '状态：1启用 0禁用',
    hit_count INT DEFAULT 0 COMMENT '命中次数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_priority (priority DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 插入默认规则
INSERT INTO chat_rules (keywords, response, priority, status) VALUES
('你好,嗨,在吗,你是谁,hello,hi', '你好呀！我是权鼎教育的小助手~ 有什么关于高考志愿填报的问题都可以问我哦！', 0, 1),
('怎么用,怎么操作,使用方法,帮助,help', '使用方法很简单：\n1. 选择你所在的省份\n2. 输入你的高考分数或位次\n3. 选择你的选科组合\n4. 点击"开始推荐"即可\n\n还可以通过筛选功能精确查找目标院校！', 0, 1),
('分数,多少分,录取分,分数线', '你可以在首页输入你的分数，系统会根据历年数据为你智能推荐匹配的院校和专业。试试看吧！', 0, 1),
('选科,科目,选什么科,选科组合', '新高考模式下，你需要选择：\n• 必选科目：物理或历史（二选一）\n• 再选科目：政治、地理、化学、生物中选2门\n\n不同专业对选科有不同要求，建议先确定感兴趣的专业方向。', 0, 1),
('位次,排名,省排名', '位次比分数更准确哦！建议使用位次来查询，因为每年的分数线会波动，但位次相对稳定。你可以切换到"位次"模式输入。', 0, 1),
('专业,什么专业好,推荐专业,选什么专业', '选专业要结合兴趣和就业前景综合考虑。你可以点击"专业名录"浏览所有专业，也可以在推荐结果中按专业类筛选。有什么感兴趣的方向吗？', 0, 1),
('学校,大学,院校,哪个学校好', '选学校要看多个因素：院校层次、地理位置、专业实力等。你可以在"院校名录"中浏览，或者直接输入分数获取推荐列表！', 0, 1),
('批次,一本,二本,本科,专科,提前批', '系统会根据你的分数自动匹配相应批次的院校。结果页可以按批次筛选，查看不同批次的录取机会。', 0, 1),
('冲稳保,怎么填,志愿,填报策略', '填报建议遵循"冲-稳-保"原则：\n• 冲：选几所录取概率较低但心仪的学校\n• 稳：选录取概率适中的学校\n• 保：选录取概率高的学校保底\n\n每个志愿组都要拉开梯度！', 0, 1);

-- 3. 对话日志表
CREATE TABLE IF NOT EXISTS chat_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(100) COMMENT '会话ID',
    user_id VARCHAR(50) COMMENT '用户ID',
    user_message TEXT COMMENT '用户消息',
    bot_reply TEXT COMMENT '机器人回复',
    source VARCHAR(20) DEFAULT 'default' COMMENT '回复来源：rule/db/deepseek/default',
    matched_rule_id INT COMMENT '匹配的规则ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session (session_id),
    INDEX idx_user (user_id),
    INDEX idx_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
