-- 高考志愿智能推荐系统数据库结构
-- 创建数据库
CREATE DATABASE IF NOT EXISTS gaokao CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE gaokao;

-- 创建用户推荐记录表
CREATE TABLE IF NOT EXISTS user_recommendations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    region VARCHAR(50) NOT NULL COMMENT '地区',
    score INT NOT NULL COMMENT '高考分数',
    subjectCombination VARCHAR(50) NOT NULL COMMENT '选科组合',
    targetRegion VARCHAR(100) DEFAULT '' COMMENT '目标地区偏好',
    majorPreference VARCHAR(50) DEFAULT '' COMMENT '专业方向意向',
    graduationPlan VARCHAR(20) DEFAULT '' COMMENT '毕业意向规划',
    personality VARCHAR(20) DEFAULT '' COMMENT '性格类型',
    otherRequirements TEXT COMMENT '其他要求',
    recommendations JSON COMMENT '推荐结果（JSON格式）',
    generateTime DATETIME NOT NULL COMMENT '生成时间',
    saveTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '保存时间',
    
    INDEX idx_score (score),
    INDEX idx_region (region),
    INDEX idx_saveTime (saveTime)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户志愿推荐记录表';

-- 插入测试数据（可选）
/*
INSERT INTO user_recommendations 
(region, score, subjectCombination, targetRegion, majorPreference, graduationPlan, personality, otherRequirements, recommendations, generateTime)
VALUES 
('北京', 650, '物理+化学+生物', '北京,上海', '理工类', '考研', '理性型', '优先考虑985院校', 
'[
  {"name": "清华大学", "major": "计算机科学与技术", "type": "冲", "score": 680, "probability": "30%"},
  {"name": "北京大学", "major": "生物科学", "type": "冲", "score": 675, "probability": "35%"},
  {"name": "浙江大学", "major": "生物医学工程", "type": "稳", "score": 650, "probability": "70%"}
]', 
NOW());
*/

-- 查询示例
-- SELECT * FROM recommendations ORDER BY saveTime DESC;
-- SELECT * FROM recommendations WHERE score >= 600 AND score <= 700;
-- SELECT COUNT(*) as total FROM recommendations;

-- 查看表结构
-- DESCRIBE recommendations;
