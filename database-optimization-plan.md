# 数据库查询性能优化方案

## 问题分析

**当前情况**：
- admission_plan表：169,558条记录（6个省份）
- 查询时间长，用户体验差

**性能瓶颈**：
1. 缺少关键索引
2. CASE WHEN计算开销大
3. 多条件OR查询
4. 返回数据量大

---

## 优化方案

### 阶段1：添加索引（立即见效）

#### 1.1 核心索引

```sql
-- 生源地+科目类型+位次组合索引（最重要）
CREATE INDEX idx_source_subject_rank ON admission_plan(source_province, subject_type, min_rank_1);

-- 生源地+科目类型+分数组合索引
CREATE INDEX idx_source_subject_score ON admission_plan(source_province, subject_type, min_score_1);

-- 选科要求索引
CREATE INDEX idx_subject_require ON admission_plan(subject_require);

-- 院校代码索引（用于分组查询）
CREATE INDEX idx_college_code ON admission_plan(college_code);
```

#### 1.2 覆盖索引（减少回表）

```sql
-- 包含常用查询字段的覆盖索引
CREATE INDEX idx_cover ON admission_plan(
  source_province, 
  subject_type, 
  min_rank_1,
  college_name,
  major_name,
  min_score_1
);
```

**预期效果**：查询时间减少50%-70%

---

### 阶段2：查询优化

#### 2.1 移除CASE WHEN计算

**当前问题**：
```sql
CASE
  WHEN subject_require IN (...) THEN 0
  WHEN subject_require IN (...) THEN 1
  WHEN subject_require IN (...) THEN 2
  ELSE 99
END AS match_priority
```

**优化方案**：
- 在前端计算优先级
- 或使用UNION ALL替代（更高效）

```sql
-- 优先级1：完全匹配
SELECT ... WHERE subject_require IN (...) AND ...
UNION ALL
-- 优先级2：匹配2门
SELECT ... WHERE subject_require IN (...) AND ...
UNION ALL
-- 优先级3：匹配1门
SELECT ... WHERE subject_require IN (...) AND ...
```

#### 2.2 限制返回数量

```sql
-- 添加LIMIT，避免返回过多数据
ORDER BY match_priority, min_rank_1
LIMIT 100;  -- 限制最多返回100条
```

#### 2.3 延迟关联

```sql
-- 先查ID，再批量查询详情
SELECT a.* FROM admission_plan a
INNER JOIN (
  SELECT id FROM admission_plan
  WHERE source_province = ? AND subject_type = ? AND min_rank_1 >= ?
  ORDER BY min_rank_1
  LIMIT 100
) b ON a.id = b.id;
```

**预期效果**：查询时间减少30%-50%

---

### 阶段3：应用层优化

#### 3.1 Redis缓存

```javascript
// 缓存热门查询结果（TTL 1小时）
const cacheKey = `recommend:${sourceProvince}:${subjectType}:${userRank}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

// 执行查询
const results = await queryDatabase();

// 缓存结果
await redis.setex(cacheKey, 3600, JSON.stringify(results));
```

#### 3.2 分页加载

```javascript
// 前端分页请求
app.get('/api/recommend-from-db', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = 20;
  const offset = (page - 1) * pageSize;
  
  const query = `
    SELECT ... 
    ORDER BY min_rank_1
    LIMIT ${pageSize} OFFSET ${offset}
  `;
});
```

#### 3.3 异步加载

```javascript
// 先返回院校列表，再异步加载专业详情
app.get('/api/college-list', async (req, res) => {
  // 只返回院校基本信息
  const colleges = await getCollegeList();
  res.json({ colleges });
});

// 前端需要时再请求专业详情
app.get('/api/major-details/:collegeCode', async (req, res) => {
  const majors = await getMajorDetails(req.params.collegeCode);
  res.json({ majors });
});
```

**预期效果**：首次响应时间减少70%-80%

---

### 阶段4：数据库配置优化

#### 4.1 连接池配置

```javascript
// 增加连接池大小
const pool = mysql.createPool({
  connectionLimit: 50,  // 从10增加到50
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'gaokao'
});
```

#### 4.2 MySQL配置优化

```ini
[mysqld]
# 增加缓冲池大小
innodb_buffer_pool_size = 2G

# 增加查询缓存
query_cache_size = 256M
query_cache_type = 1

# 增加连接数
max_connections = 500

# 优化排序缓冲区
sort_buffer_size = 8M
join_buffer_size = 8M
```

**预期效果**：并发能力提升2-3倍

---

## 实施优先级

### 🔥 立即实施（1小时内）

1. ✅ 添加核心索引（idx_source_subject_rank）
2. ✅ 添加LIMIT限制返回数量
3. ✅ 增加连接池大小

**预期效果**：查询时间从10秒降至2-3秒

### ⏰ 短期实施（1-3天）

1. 添加覆盖索引
2. 实施Redis缓存
3. 前端分页加载

**预期效果**：查询时间降至1秒以内

### 🎯 中期实施（1-2周）

1. 查询语句重构（UNION ALL替代CASE WHEN）
2. 延迟关联优化
3. 异步加载架构

**预期效果**：查询时间降至500ms以内

---

## 监控指标

```sql
-- 查看慢查询
SHOW VARIABLES LIKE 'slow_query%';
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;

-- 查看索引使用情况
EXPLAIN SELECT ... FROM admission_plan WHERE ...;

-- 查看表状态
SHOW TABLE STATUS LIKE 'admission_plan';

-- 分析查询性能
ANALYZE TABLE admission_plan;
```

---

## 预期总体效果

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 查询时间 | 10-15秒 | 0.5-1秒 | 90%+ |
| 并发能力 | 5 QPS | 100+ QPS | 20倍 |
| 用户体验 | 差 | 流畅 | 显著 |

---

## 执行步骤

### Step 1：备份数据库
```bash
mysqldump -u root -p gaokao > backup_$(date +%Y%m%d).sql
```

### Step 2：执行索引优化
```bash
mysql -u root -p gaokao < add_indexes.sql
```

### Step 3：修改代码
- 添加LIMIT限制
- 增加连接池大小
- 实施缓存机制

### Step 4：测试验证
- 压力测试
- 慢查询分析
- 用户体验测试

---

## 常见问题

**Q: 添加索引会影响写入性能吗？**
A: 会轻微影响（约5-10%），但对于读多写少的场景，收益远大于成本。

**Q: Redis缓存失效策略？**
A: 建议设置TTL=1小时，用户主动刷新时清除缓存。

**Q: 分页加载如何实现？**
A: 前端使用滚动加载或分页组件，后端提供分页接口。

**Q: 如何监控优化效果？**
A: 使用MySQL慢查询日志和应用性能监控（APM）工具。
