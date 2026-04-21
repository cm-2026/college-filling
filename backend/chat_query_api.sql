-- 智能客服增强功能 - 查询接口
-- 用于从数据库查询真实数据,而不是AI生成

-- 1. 查询院校推荐(根据分数和选科)
-- 接口: POST /api/chat/query-schools
-- 参数: { score, subjectCombination, region }
-- 返回: 院校推荐列表(前5-10所)

-- 2. 查询专业推荐(根据选科)
-- 接口: POST /api/chat/query-majors
-- 参数: { subjectCombination, region }
-- 返回: 专业推荐列表(前10个)

-- 3. 查询院校详情
-- 接口: GET /api/chat/school-detail?schoolName=xxx
-- 返回: 院校详细信息

-- 4. 查询专业详情
-- 接口: GET /api/chat/major-detail?majorName=xxx
-- 返回: 专业介绍、就业前景、开设院校等

-- 5. 查询院校的专业列表
-- 接口: GET /api/chat/school-majors?schoolName=xxx
-- 返回: 该院校开设的专业

-- 示例SQL查询(供参考)
-- SELECT college_name, college_code, subject_type, subject_require, min_score_1, batch
-- FROM admission_plan
-- WHERE score BETWEEN ? AND ?
-- AND subject_type = ?
-- AND subject_require LIKE ?
-- ORDER BY min_score_1 DESC
-- LIMIT 10;
