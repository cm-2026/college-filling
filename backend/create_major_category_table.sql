-- 创建专业分类表
CREATE TABLE IF NOT EXISTS `major_category` (
  `id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '主键',
  `code` VARCHAR(20) NOT NULL COMMENT '专业编码（如010101）',
  `name` VARCHAR(50) NOT NULL COMMENT '专业名称',
  `level` TINYINT NOT NULL COMMENT '1本科 2门类 3专业类 4专业',
  `parent_id` INT DEFAULT NULL COMMENT '父ID',
  
  `category_code` VARCHAR(20) DEFAULT NULL COMMENT '门类编码（01）',
  `category_name` VARCHAR(50) DEFAULT NULL COMMENT '门类名称（哲学）',
  `class_code` VARCHAR(20) DEFAULT NULL COMMENT '专业类编码（0101）',
  `class_name` VARCHAR(50) DEFAULT NULL COMMENT '专业类名称（哲学类）',
  
  `status` TINYINT DEFAULT 1 COMMENT '1正常 0禁用',
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_level` (`level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='专业分类表（固定结构）';
