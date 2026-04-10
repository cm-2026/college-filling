-- =====================================================
-- 数据库性能优化 - 索引优化
-- 执行时间：约1-2分钟
-- 预期效果：查询时间减少50%-70%
-- =====================================================

USE gaokao;

-- 1. 核心组合索引（最重要）
-- 用途：加速按生源地+科目类型+位次的查询
CREATE INDEX idx_source_subject_rank 
ON admission_plan(source_province, subject_type, min_rank_1);

-- 2. 核心组合索引（分数查询）
-- 用途：加速按生源地+科目类型+分数的查询
CREATE INDEX idx_source_subject_score 
ON admission_plan(source_province, subject_type, min_score_1);

-- 3. 选科要求索引
-- 用途：加速选科匹配查询
CREATE INDEX idx_subject_require 
ON admission_plan(subject_require);

-- 4. 院校代码索引
-- 用途：加速按院校分组查询
CREATE INDEX idx_college_code 
ON admission_plan(college_code);

-- 5. 专业组代码索引
-- 用途：加速专业组查询
CREATE INDEX idx_major_group_code 
ON admission_plan(major_group_code);

-- 6. 覆盖索引（减少回表）
-- 用途：包含常用查询字段，避免回表查询
CREATE INDEX idx_cover 
ON admission_plan(
  source_province, 
  subject_type, 
  min_rank_1,
  college_name,
  college_code,
  major_name,
  major_code,
  min_score_1,
  subject_require
);

-- 查看索引创建结果
SHOW INDEX FROM admission_plan;

-- 分析表（更新统计信息）
ANALYZE TABLE admission_plan;

-- 验证优化效果（执行测试查询）
EXPLAIN SELECT 
  college_name, 
  major_name, 
  min_score_1, 
  min_rank_1
FROM admission_plan 
WHERE source_province = '河南' 
  AND subject_type = '物理类' 
  AND min_rank_1 >= 30000
ORDER BY min_rank_1
LIMIT 100;

-- 完成
SELECT '✅ 索引优化完成！' AS status;
