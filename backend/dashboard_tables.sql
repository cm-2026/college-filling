-- ============================================
-- 数据看板相关数据表
-- 创建时间：2026-04-12
-- ============================================

-- 1. 用户行为记录表
CREATE TABLE IF NOT EXISTS user_behaviors (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  behavior_type VARCHAR(50) NOT NULL COMMENT '行为类型: login, search, recommend, export, view',
  behavior_data TEXT COMMENT 'JSON格式详细数据',
  ip VARCHAR(50),
  user_agent VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_behavior_type (behavior_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户行为记录表';

-- 2. 管理员操作日志表
CREATE TABLE IF NOT EXISTS admin_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_id INT NOT NULL,
  admin_name VARCHAR(50),
  action VARCHAR(50) COMMENT '操作类型: login, delete_user, update_user, reset_password',
  target_type VARCHAR(50) COMMENT '目标类型: user, college, major',
  target_id INT,
  detail TEXT COMMENT 'JSON格式操作详情',
  ip VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_id (admin_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员操作日志表';

-- 验证表创建
SELECT 
  TABLE_NAME,
  TABLE_COMMENT,
  CREATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'gaokao'
AND TABLE_NAME IN ('user_behaviors', 'admin_logs');
