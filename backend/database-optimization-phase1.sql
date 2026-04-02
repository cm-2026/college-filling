-- ========================================
-- 阶段1：紧急优化（立即实施）
-- 目标：快速提升查询速度 50%
-- 执行时间：约5-10分钟
-- 风险：低（只添加索引，不修改数据）
-- ========================================

USE gaokao;

-- ===== 1. 核心查询索引优化 =====

-- 1.1 3+1+2模式核心索引（河南、福建、广西、重庆等）
-- 覆盖最常见的查询场景：WHERE source_province AND subject_type AND score
-- 预计提升：50-70%
CREATE INDEX idx_31_2_score ON admission_plan (
  source_province,          -- 生源地（选择度高：河南60585条、北京5751条等）
  subject_type,             -- 科目类型（选择度低：物理类/历史类，但必需过滤）
  group_min_score_1,        -- 专业组最低分（用于范围查询）
  min_score_1               -- 专业最低分（fallback字段）
) COMMENT '3+1+2模式核心查询索引';

-- 1.2 3+3模式核心索引（北京、天津、上海、山东、浙江、海南）
-- 覆盖3+3模式查询：WHERE source_province AND score（无subject_type过滤）
-- 预计提升：40-60%
CREATE INDEX idx_33_score ON admission_plan (
  source_province,          -- 生源地
  group_min_score_1,        -- 专业组最低分
  min_score_1               -- 专业最低分
) COMMENT '3+3模式核心查询索引';

-- 1.3 专业最低分单独索引
-- 用于部分查询使用min_score_1而非group_min_score_1
-- 预计提升：20-30%
CREATE INDEX idx_min_score ON admission_plan (min_score_1) 
COMMENT '专业最低分索引（单列）';

-- ===== 2. 组合查询优化索引 =====

-- 2.1 生源地 + 选科要求 + 分数（3+3模式OR查询优化）
-- 虽然OR查询无法完全使用索引，但单条件查询可使用
CREATE INDEX idx_province_require_score ON admission_plan (
  source_province,
  subject_require,
  group_min_score_1,
  min_score_1
) COMMENT '生源地+选科要求+分数组合索引';

-- ===== 3. 辅助查询索引 =====

-- 3.1 院校名录查询优化（dxmessage表）
-- 用于 GET /api/colleges 接口
CREATE INDEX idx_colleges_ranking ON dxmessage (
  ranking,
  school_name
) COMMENT '院校排名+名称索引（用于名录查询）';

-- ===== 4. 验证索引创建结果 =====

-- 查看新增索引
SELECT 
  TABLE_NAME,
  INDEX_NAME,
  COLUMN_NAME,
  SEQ_IN_INDEX,
  CARDINALITY,
  INDEX_COMMENT
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'gaokao'
  AND TABLE_NAME = 'admission_plan'
  AND INDEX_NAME IN (
    'idx_31_2_score',
    'idx_33_score',
    'idx_min_score',
    'idx_province_require_score'
  )
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- ===== 5. 性能测试查询 =====

-- 测试查询1：3+1+2模式（河南500分物理类）
EXPLAIN SELECT 
  college_name, major_name, group_min_score_1, min_score_1
FROM admission_plan
WHERE source_province = '河南'
  AND subject_type = '物理'
  AND COALESCE(group_min_score_1, min_score_1) BETWEEN 480 AND 510
LIMIT 20;

-- 测试查询2：3+3模式（北京500分）
EXPLAIN SELECT 
  college_name, major_name, group_min_score_1, min_score_1
FROM admission_plan
WHERE source_province = '北京'
  AND COALESCE(group_min_score_1, min_score_1) BETWEEN 480 AND 510
LIMIT 20;

-- ===== 6. 索引维护建议 =====

-- 定期分析表（优化查询计划）
ANALYZE TABLE admission_plan;
ANALYZE TABLE dxmessage;
ANALYZE TABLE user_recommendations;

-- ===== 完成提示 =====
SELECT '✅ 阶段1索引优化完成！' AS status,
       '预计性能提升：50%' AS improvement,
       '下一步：修改server.js优化连接池配置' AS next_step;
