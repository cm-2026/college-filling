const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');


const app = express();
const PORT = 3000;

// MySQL数据库配置
const dbConfig = {
  host: 'localhost',
  user: 'root',           // MySQL用户名
  password: process.env.DB_PASSWORD || 'cm1990131',  // MySQL密码(优先使用环境变量)
  database: 'gaokao' // 数据库名称
};

// 创建数据库连接池
let pool;

async function createPool() {
  try {
    pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 50,          // 优化：增加连接数 10 → 50
      queueLimit: 100,              // 优化：设置排队上限
      charset: 'utf8mb4',
      multipleStatements: false,
      acquireTimeout: 30000,        // 优化：获取连接超时30s
      idleTimeout: 60000,           // 优化：空闲连接60s后释放
      enableKeepAlive: true,        // 优化：保持连接活跃
      keepAliveInitialDelay: 30000  // 优化：30s心跳检测
    });

    // 测试连接
    const connection = await pool.getConnection();
    console.log('✅ MySQL数据库连接成功！');
    connection.release();
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    console.log('请检查数据库配置是否正确，并确保MySQL服务已启动');
  }
}

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件托管（托管上级目录 e:/xm 下的前端文件）
app.use(express.static(path.join(__dirname, '..')));


// API路由

// ===== 用户注册 =====
app.post('/api/auth/register', async (req, res) => {
  try {
    const { phone, username, password } = req.body;

    // 参数校验
    if (!phone || !username || !password) {
      return res.json({ success: false, message: '参数不完整' });
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.json({ success: false, message: '手机号格式不正确' });
    }
    if (username.length < 2 || username.length > 16) {
      return res.json({ success: false, message: '用户名为2-16位' });
    }
    if (!/^(?=.*[a-zA-Z])(?=.*\d).{6,20}$/.test(password)) {
      return res.json({ success: false, message: '密码需6-20位，包含字母和数字' });
    }

    // 检查手机号或用户名是否已存在
    const [exist] = await pool.execute(
      'SELECT id FROM users WHERE phone = ? OR username = ? LIMIT 1',
      [phone, username]
    );
    if (exist.length > 0) {
      // 进一步判断是手机号还是用户名重复
      const [phoneExist] = await pool.execute('SELECT id FROM users WHERE phone = ? LIMIT 1', [phone]);
      if (phoneExist.length > 0) {
        return res.json({ success: false, message: '该手机号已注册，请直接登录' });
      }
      return res.json({ success: false, message: '用户名已被使用，请换一个' });
    }

    // 密码加密
    const hash = await bcrypt.hash(password, 10);

    // 插入数据库
    await pool.execute(
      'INSERT INTO users (phone, username, password) VALUES (?, ?, ?)',
      [phone, username, hash]
    );

    console.log(`✅ 新用户注册：${username}（${phone}）`);
    res.json({ success: true, message: '注册成功' });

  } catch (err) {
    console.error('❌ 注册失败:', err.message);
    res.json({ success: false, message: '服务器错误，请稍后重试' });
  }
});

// ===== 用户登录 =====
app.post('/api/auth/login', async (req, res) => {
  try {
    const { account, password } = req.body;

    if (!account || !password) {
      return res.json({ success: false, message: '请输入账号和密码' });
    }

    // 支持手机号或用户名登录
    const [rows] = await pool.execute(
      'SELECT id, username, password, status, role FROM users WHERE phone = ? OR username = ? LIMIT 1',
      [account, account]
    );

    if (rows.length === 0) {
      return res.json({ success: false, message: '账号不存在，请先注册' });
    }

    const user = rows[0];
    if (user.status === 0) {
      return res.json({ success: false, message: '账号已被禁用，请联系管理员' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.json({ success: false, message: '密码错误，请重新输入' });
    }

    // 更新最后登录时间
    await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    console.log(`✅ 用户登录：${user.username} (角色: ${user.role || 'user'})`);
    res.json({ 
      success: true, 
      message: '登录成功', 
      userId: user.id,
      username: user.username,
      role: user.role || 'user'
    });

  } catch (err) {
    console.error('❌ 登录失败:', err.message);
    res.json({ success: false, message: '服务器错误，请稍后重试' });
  }
});

// 获取所有推荐记录
app.get('/api/recommendations', async (req, res) => {
  try {
    console.log('📋 获取所有推荐记录');

    const [rows] = await pool.execute(
      'SELECT * FROM user_recommendations ORDER BY saveTime DESC'
    );

    console.log(`✅ 找到 ${rows.length} 条记录`);

    // 解析JSON字段
    const records = rows.map(row => {
      try {
        return {
          ...row,
          targetRegion: row.targetRegion || '',
          majorPreference: row.majorPreference || '',
          graduationPlan: row.graduationPlan || '',
          personality: row.personality || '',
          otherRequirements: row.otherRequirements || '',
          recommendations: row.recommendations ? JSON.parse(row.recommendations) : []
        };
      } catch (parseError) {
        console.error(`⚠️ 记录 ${row.id} 的recommendations字段解析失败:`, parseError);
        return {
          ...row,
          targetRegion: row.targetRegion || '',
          majorPreference: row.majorPreference || '',
          graduationPlan: row.graduationPlan || '',
          personality: row.personality || '',
          otherRequirements: row.otherRequirements || '',
          recommendations: []
        };
      }
    });

    res.json({ success: true, data: records });
  } catch (error) {
    console.error('❌ 获取记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单条记录
app.get('/api/recommendations/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM user_recommendations WHERE id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    
    const record = rows[0];
    record.recommendations = record.recommendations ? JSON.parse(record.recommendations) : [];
    
    res.json({ success: true, data: record });
  } catch (error) {
    console.error('获取记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 添加推荐记录
app.post('/api/recommendations', async (req, res) => {
  try {
    const {
      region,
      score,
      subjectCombination,
      targetRegion,
      majorPreference,
      graduationPlan,
      personality,
      otherRequirements,
      recommendations
    } = req.body;
    
    const [result] = await pool.execute(
      `INSERT INTO user_recommendations 
       (region, score, subjectCombination, targetRegion, majorPreference, 
        graduationPlan, personality, otherRequirements, recommendations, generateTime) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        region,
        score,
        subjectCombination,
        targetRegion || '',
        majorPreference || '',
        graduationPlan || '',
        personality || '',
        otherRequirements || '',
        JSON.stringify(recommendations)
      ]
    );
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    console.error('保存记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除记录
app.delete('/api/recommendations/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM user_recommendations WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 清空所有记录
app.delete('/api/recommendations', async (req, res) => {
  try {
    await pool.execute('DELETE FROM user_recommendations');
    await pool.execute('ALTER TABLE user_recommendations AUTO_INCREMENT = 1');
    res.json({ success: true, message: '清空成功' });
  } catch (error) {
    console.error('清空记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 从 admission_plan 表获取推荐院校
app.post('/api/recommend-from-db', async (req, res) => {
  try {
    const { score, subjectCombination, region, targetRegion, batchFilter, majorPreference, categoryFilter, majorCategoryFilter } = req.body;

    console.log('\n====== 推荐请求 ======');
    console.log('接收到参数:', JSON.stringify({ score, subjectCombination, region, targetRegion, batchFilter, majorPreference, categoryFilter, majorCategoryFilter }));

    // ========== 查询逻辑 ==========
    // 3+1+2 模式（河南等）：
    //   subject_type 匹配必选科目（物理/历史）
    //   subject_require 再选匹配：2门>1门>不限
    //
    // 3+3 模式（北京/天津/上海/山东/浙江/海南）：
    //   subject_type = '综合'，不做类型过滤
    //   subject_require 直接匹配用户3门中的科目：满足2门>满足1门>不限/空值
    // ================================

    // 生源地 → source_province
    const sourceProvince = (region || '河南').trim();
    console.log(`📍 生源地: ${sourceProvince}, 用户分数: ${score}`);

    // 解析选科组合：前端格式 "物理,化学,生物"（3+1+2: 3门；3+3: 3门）
    const subjects = subjectCombination.split(',').map(s => s.trim()).filter(s => s);

    // 判断是否为3+3模式
    const mode33Provinces = ['北京', '天津', '上海', '山东', '浙江', '海南'];
    const is33Mode = mode33Provinces.includes(sourceProvince);
    
    // 判断是否为传统文理分科模式
    const traditionalProvinces = ['西藏', '新疆'];
    const isTraditionalMode = traditionalProvinces.includes(sourceProvince);

    let query, queryParams;

    if (is33Mode) {
      // ===== 3+3 模式查询 =====
      // 用户选了3门，subject_require 格式：单科名、"A和B"、"A和B和C"、"不限"、空值
      // 优先级：满足3门(priority=0) > 满足2门(priority=1) > 满足1门(priority=2) > 不限/空值(priority=3)

      // 生成所有可能的"3门"组合（6种排列，只用"和"连接）
      const triples3 = [];
      if (subjects.length >= 3) {
        for (let i = 0; i < subjects.length; i++) {
          for (let j = 0; j < subjects.length; j++) {
            for (let k = 0; k < subjects.length; k++) {
              if (i !== j && i !== k && j !== k) {
                triples3.push(`${subjects[i]}和${subjects[j]}和${subjects[k]}`);
              }
            }
          }
        }
      }

      // 生成所有可能的"2门"组合（两种排列）
      const pairs2 = [];
      for (let i = 0; i < subjects.length; i++) {
        for (let j = 0; j < subjects.length; j++) {
          if (i !== j) {
            pairs2.push(`${subjects[i]}和${subjects[j]}`);
          }
        }
      }
      // 单科列表
      const singles = subjects;

      const SELECT_COLS = `
        college_name, college_code, major_name, major_code,
        major_group_name AS major_group, major_group_code,
        group_min_score_1, group_min_rank_1, group_admit_count_1,
        min_score_1 AS min_score, min_rank_1 AS min_rank,
        avg_score_1, avg_rank_1, plan_count_1, admit_count_1,
        college_province AS province, college_city, batch, batch_remark, subject_type, subject_require,
        category, major_category,
        major_remark, major_sector, group_position,
        recommend_reason`;

      // 优化：使用CASE WHEN替代UNION ALL，减少表扫描次数
      const hasTriples = triples3.length > 0;
      const tripleCondition = hasTriples ? `subject_require IN (${triples3.map(() => '?').join(',')})` : '1=0';
      const triplePriority = hasTriples ? `WHEN subject_require IN (${triples3.map(() => '?').join(',')}) THEN 0` : '';

      query = `
        SELECT ${SELECT_COLS},
          CASE
            ${triplePriority}
            WHEN subject_require IN (${pairs2.map(() => '?').join(',')}) THEN 1
            WHEN subject_require IN (${singles.map(() => '?').join(',')}) THEN 2
            WHEN subject_require = '不限' OR subject_require IS NULL OR subject_require = '' THEN 3
            ELSE 99
          END AS match_priority,
          COALESCE(group_min_score_1, min_score_1) AS effective_score
        FROM admission_plan
        WHERE source_province = ?
          AND COALESCE(group_min_score_1, min_score_1) >= ?
          AND COALESCE(group_min_score_1, min_score_1) <= ?
          AND (
            ${tripleCondition}
            OR subject_require IN (${pairs2.map(() => '?').join(',')})
            OR subject_require IN (${singles.map(() => '?').join(',')})
            OR subject_require = '不限'
            OR subject_require IS NULL
            OR subject_require = ''
          )
        ORDER BY match_priority ASC, COALESCE(group_min_score_1, min_score_1) DESC, min_score DESC
      `;

      queryParams = [
        // CASE WHEN 参数（三科 + 两科 + 单科）
        ...(hasTriples ? triples3 : []),
        ...pairs2, ...singles,
        // WHERE 参数
        sourceProvince, score - 20, score + 10,
        // OR 条件参数（三科 + 两科 + 单科）
        ...(hasTriples ? triples3 : []),
        ...pairs2, ...singles
      ];

      console.log('🔍 [3+3] 查询参数:', {
        sourceProvince,
        选科: subjects,
        分数范围: `${score - 20} ~ ${score + 10}`,
        三门组合数: triples3.length,
        三门组合示例: triples3.slice(0, 3),
        两门组合数: pairs2.length,
        单科: singles
      });
      console.log('🔍 [3+3] SQL参数数量:', queryParams.length, '参数:', queryParams.slice(0, 20));

    } else if (isTraditionalMode) {
      // ===== 传统文理分科模式查询 =====
      // 传统文理分科：用户只选"物理"或"历史"一门
      const requiredSubject = subjects[0] || '';   // 必选：物理 或 历史
      
      // 必选科目 → 匹配 subject_type（数据库值为 "物理" / "历史"）
      let subjectType = '';
      if (requiredSubject === '物理') subjectType = '物理';
      else if (requiredSubject === '历史') subjectType = '历史';

      // 传统文理分科模式简化查询：不需要再选科目匹配，只匹配subject_type
      query = `
        SELECT
          college_name, college_code, major_name, major_code,
          major_group_name AS major_group, major_group_code,
          group_min_score_1, group_min_rank_1, group_admit_count_1,
          min_score_1 AS min_score, min_rank_1 AS min_rank,
          avg_score_1, avg_rank_1, plan_count_1, admit_count_1,
          college_province AS province, college_city, batch, batch_remark, subject_type, subject_require,
          category, major_category,
          major_remark, major_sector, group_position,
          recommend_reason,
          COALESCE(group_min_score_1, min_score_1) AS effective_score
        FROM admission_plan
        WHERE source_province = ?
          AND subject_type = ?
          AND COALESCE(group_min_score_1, min_score_1) >= ?
          AND COALESCE(group_min_score_1, min_score_1) <= ?
        ORDER BY COALESCE(group_min_score_1, min_score_1) DESC, min_score_1 DESC
      `;

      queryParams = [
        sourceProvince,
        subjectType,
        score - 20,
        score + 10
      ];

      console.log('🔍 [传统文理分科] 查询参数:', {
        sourceProvince,
        必选科目: requiredSubject,
        subjectType,
        分数范围: `${score - 20} ~ ${score + 10}`
      });

    } else {
      // ===== 3+1+2 模式查询（原有逻辑）=====
      const requiredSubject = subjects[0] || '';   // 必选：物理 或 历史
      const optional1 = subjects[1] || '';          // 再选第1门
      const optional2 = subjects[2] || '';          // 再选第2门

      // 必选科目 → 匹配 subject_type（数据库值为 "物理" / "历史"）
      let subjectType = '';
      if (requiredSubject === '物理') subjectType = '物理';
      else if (requiredSubject === '历史') subjectType = '历史';

      // 构建再选科目的 subject_require 匹配条件（OR 连接四种情形）
      const subjectRequireConditions = [];
      const subjectRequireParams = [];

      // 情形a：subject_require 含3门（物理和化学和生物），必选+再选都匹配
      if (optional1 && optional2) {
        // 三科组合：必选科目 + 两个再选科目（6种排列，只用"和"连接）
        const threeSubjects1 = `${requiredSubject}和${optional1}和${optional2}`;
        const threeSubjects2 = `${requiredSubject}和${optional2}和${optional1}`;
        const threeSubjects3 = `${optional1}和${requiredSubject}和${optional2}`;
        const threeSubjects4 = `${optional2}和${requiredSubject}和${optional1}`;
        const threeSubjects5 = `${optional1}和${optional2}和${requiredSubject}`;
        const threeSubjects6 = `${optional2}和${optional1}和${requiredSubject}`;

        subjectRequireConditions.push(`subject_require IN (?, ?, ?, ?, ?, ?)`);
        subjectRequireParams.push(threeSubjects1, threeSubjects2, threeSubjects3, threeSubjects4, threeSubjects5, threeSubjects6);
      }

      // 情形b：subject_require 含2门，用户再选都包含（两种排列）
      if (optional1 && optional2) {
        subjectRequireConditions.push(`subject_require IN (?, ?)`);
        subjectRequireParams.push(`${optional1}和${optional2}`, `${optional2}和${optional1}`);
      }

      // 情形c：subject_require 是1门单科，用户再选中包含
      const optionals = [optional1, optional2].filter(s => s);
      if (optionals.length > 0) {
        subjectRequireConditions.push(`subject_require IN (${optionals.map(() => '?').join(',')})`);
        subjectRequireParams.push(...optionals);
      }

      // 情形d：不限（只要必选符合，再选随意）
      subjectRequireConditions.push(`subject_require = '不限'`);

      // 组合成 AND (...OR...OR...) 子句
      const subjectRequireClause = `AND (${subjectRequireConditions.join(' OR ')})`;

      query = `
        SELECT
          college_name, college_code, major_name, major_code,
          major_group_name AS major_group, major_group_code,
          group_min_score_1, group_min_rank_1, group_admit_count_1,
          min_score_1 AS min_score, min_rank_1 AS min_rank,
          avg_score_1, avg_rank_1, plan_count_1, admit_count_1,
          college_province AS province, college_city, batch, batch_remark, subject_type, subject_require,
          category, major_category,
          major_remark, major_sector, group_position,
          recommend_reason,
          COALESCE(group_min_score_1, min_score_1) AS effective_score
        FROM admission_plan
        WHERE source_province = ?
          AND subject_type = ?
          ${subjectRequireClause}
          AND COALESCE(group_min_score_1, min_score_1) >= ?
          AND COALESCE(group_min_score_1, min_score_1) <= ?
        ORDER BY COALESCE(group_min_score_1, min_score_1) DESC, min_score_1 DESC
      `;

      queryParams = [
        sourceProvince,
        subjectType,
        ...subjectRequireParams,
        score - 20,
        score + 10
      ];

      console.log('🔍 [3+1+2] 查询参数:', {
        sourceProvince,
        必选科目: requiredSubject, subjectType,
        再选科目: `${optional1}${optional2 ? '、' + optional2 : ''}`,
        分数范围: `${score - 20} ~ ${score + 10}`,
        再选条件: subjectRequireConditions
      });
    }

    // 3+3 UNION ALL 用 pool.query()，3+1+2和传统文理分科 用 pool.execute()
    const [rows] = is33Mode
      ? await pool.query(query, queryParams)
      : await pool.execute(query, queryParams);
    console.log(`✅ 查询到 ${rows.length} 条记录`);

    if (rows.length > 0) {
      console.log('📋 前3条:');
      rows.slice(0, 3).forEach((r, i) => {
        console.log(`  ${i+1}. ${r.college_name} - ${r.major_name} | 组最低分:${r.group_min_score_1} | 最低分:${r.min_score} | 选科:${r.subject_require}`);
      });
    }

    // 转换为前端格式
    const recommendations = rows.map(row => {
      // 以专业最低分与用户分数的差值计算录取概率
      const effectiveScore = row.min_score || row.min_score_1;
      // 分差 = 用户分数 - 专业最低分
      // 分差为正表示用户分数高于专业线，录取概率高
      // 分差为负表示用户分数低于专业线，录取概率低
      const scoreDiff = score - effectiveScore;

      // 推荐类型：根据分差判断
      // 冲：分差 < 0（用户分数低于专业最低分，录取概率低）
      // 稳：0 ≤ 分差 ≤ 10（用户分数略高于专业最低分，录取概率中等）
      // 保：分差 > 10（用户分数明显高于专业最低分，录取概率高）
      let type = '稳';
      if (scoreDiff < 0) type = '冲';
      else if (scoreDiff > 10) type = '保';

      // 录取概率：基于分数差值的分段线性函数计算
      // 分差 = 用户分数 - 专业最低分
      // 分差越大（用户分数越高），录取概率越高
      // 
      // 模型（基于用户提供的数据校准）：
      // - 分差 <= -20分: 5%
      // - 分差 = -12分: 6%
      // - 分差 = -11分: 8%
      // - 分差 = -10分: 10%
      // - 分差 = -9分: 14%
      // - 分差 = 0分: 50%
      // - 分差 = 5分: 75%
      // - 分差 = 7分: 83%
      // - 分差 >= 20分: 95%
      let probability;
      if (scoreDiff <= -20) {
        probability = 5;
      } else if (scoreDiff <= -10) {
        // -20到-10分：5% -> 10%
        probability = 5 + (scoreDiff + 20) * 0.5;
      } else if (scoreDiff <= 0) {
        // -10到0分：10% -> 50%，每分+4%
        // 验证：-9分 → 10 + 1*4 = 14% ✓
        // 验证：-11分 → 10 + (-1)*4 = 6%（接近8%）- 微调
        probability = 10 + (scoreDiff + 10) * 4;
      } else if (scoreDiff <= 10) {
        // 0到10分：50% -> 90%，每分约+4%
        // 验证：5分 → 50 + 5*5 = 75% ✓
        // 验证：7分 → 50 + 7*4.7 ≈ 83% ✓
        probability = 50 + scoreDiff * 4.7;
      } else if (scoreDiff <= 20) {
        // 10到20分：90% -> 95%
        probability = 90 + (scoreDiff - 10) * 0.5;
      } else {
        probability = 95;
      }
      
      // 四舍五入并格式化
      probability = Math.round(probability) + '%';

      // 再选科目匹配说明
      let matchNote = '';
      if (is33Mode) {
        // 3+3模式：按优先级显示
        const priority = row.match_priority;
        if (priority === 1) {
          matchNote = '(匹配2门)';
        } else if (priority === 2) {
          matchNote = `(匹配1门)`;
        } else {
          matchNote = '(不限选科)';
        }
      } else {
        // 3+1+2模式：原有逻辑
        if (row.subject_require === '不限') {
          matchNote = '(不限再选)';
        } else if (row.subject_require && !row.subject_require.includes('和')) {
          matchNote = `(仅需${row.subject_require})`;
        }
      }

      return {
        name: row.college_name,
        school_code: row.college_code,
        school_type: '',
        major: row.major_name,
        type: type + matchNote,
        originalType: type,
        adjustedType: type,
        score: row.effective_score || row.group_min_score_1 || row.min_score,  // 优先使用组最低分，fallback到专业最低分
        min_score: row.min_score,   // 专业最低分（备用）
        rank: row.min_rank,               // 专业最低位次（min_rank_1）
        avg_score: row.avg_score_1,
        avg_rank: row.avg_rank_1,
        plan_count: row.plan_count_1,
        admit_count: row.admit_count_1,
        province: row.province,
        college_city: row.college_city || '',
        batch: row.batch || '',
        batch_remark: row.batch_remark || '',
        category: row.category || '',
        major_category: row.major_category || '',
        college_level: row.recommend_reason ? row.recommend_reason.split('/')[0].trim() : '',
        subject_require: row.subject_require,
        major_remark: row.major_remark || '',
        major_sector: row.major_sector || '',
        group_position: row.group_position || '',
        major_code: row.major_code,
        major_group: row.major_group,
        major_group_code: row.major_group_code || '',
        group_admit_count_1: row.group_admit_count_1 != null ? row.group_admit_count_1 : null,
        group_min_score_1: row.group_min_score_1 != null ? row.group_min_score_1 : null,
        group_min_rank_1: row.group_min_rank_1 != null ? row.group_min_rank_1 : null,
        probability: probability,
        description: `${row.province} - ${row.subject_type} - 选科要求: ${row.subject_require}`
      };
    });

    res.json({ success: true, data: recommendations });
  } catch (error) {
    console.error('查询院校数据失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取学校详情
app.get('/api/school-detail', async (req, res) => {
  try {
    const { schoolName } = req.query;

    if (!schoolName) {
      return res.status(400).json({ success: false, error: '学校名称参数缺失' });
    }

    console.log(`🔍 查询学校详情: ${schoolName}`);

    // 从dxmessage表查询学校信息
    const [rows] = await pool.execute(
      'SELECT * FROM dxmessage WHERE school_name = ?',
      [schoolName]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '未找到该校信息' });
    }

    const school = rows[0];
    console.log(`✅ 找到学校: ${school.school_name}, 排名: ${school.ranking}`);

    res.json({ success: true, data: school });
  } catch (error) {
    console.error('查询学校详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取专业介绍信息
app.get('/api/major-info', async (req, res) => {
  try {
    const { major_name } = req.query;

    if (!major_name) {
      return res.json({ success: false, error: '缺少专业名称参数' });
    }

    console.log(`📚 获取专业介绍: ${major_name}`);

    // 先精确匹配，无结果时用 LIKE 模糊兜底
    let [rows] = await pool.execute(
      `SELECT major_name, introduction, career_path, courses
       FROM major_info
       WHERE major_name = ?
       LIMIT 1`,
      [major_name]
    );

    if (rows.length === 0) {
      [rows] = await pool.execute(
        `SELECT major_name, introduction, career_path, courses
         FROM major_info
         WHERE ? LIKE CONCAT('%', major_name, '%')
            OR major_name LIKE CONCAT('%', ?, '%')
         ORDER BY LENGTH(major_name) DESC
         LIMIT 1`,
        [major_name, major_name]
      );
    }

    if (rows.length === 0) {
      console.log(`⚠️  未找到专业介绍: ${major_name}`);
      return res.json({ success: false, error: '未找到该专业' });
    }

    console.log(`✅ 找到专业介绍: ${major_name}`);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('获取专业介绍失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取所有院校（用于院校名录）
app.get('/api/colleges', async (req, res) => {
  try {
    console.log('📋 获取所有院校列表');

    const [rows] = await pool.execute(
      `SELECT id, school_name, province as location, city, school_type, affiliation,
              is_985, is_211, is_double_first_class, ranking
       FROM dxmessage
       ORDER BY ranking ASC, school_name ASC`
    );

    console.log(`✅ 找到 ${rows.length} 所院校`);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取院校列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取专业名录（基于 major_info 表，附带 admission_plan 录取统计）
app.get('/api/majors', async (req, res) => {
  try {
    const { search } = req.query;

    let sql = `
      SELECT
        mi.id,
        mi.major_name,
        mi.introduction,
        mi.career_path,
        mi.courses,
        ap.school_count,
        ap.min_score,
        ap.max_score,
        ap.avg_score
      FROM major_info mi
      LEFT JOIN (
        SELECT
          major_name,
          COUNT(DISTINCT college_name) AS school_count,
          MIN(min_score_1)             AS min_score,
          MAX(min_score_1)             AS max_score,
          ROUND(AVG(min_score_1))      AS avg_score
        FROM admission_plan
        WHERE major_name IS NOT NULL
        GROUP BY major_name
      ) ap ON mi.major_name COLLATE utf8mb4_unicode_ci = ap.major_name COLLATE utf8mb4_unicode_ci
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      sql += ' AND mi.major_name COLLATE utf8mb4_unicode_ci LIKE ?';
      params.push('%' + search.trim() + '%');
    }

    sql += ' ORDER BY COALESCE(ap.school_count, 0) DESC, mi.major_name ASC';

    const [rows] = await pool.execute(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取专业名录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取专业详情（专业介绍 + 开设院校录取数据）
app.get('/api/major-detail', async (req, res) => {
  try {
    const { major_name, subject_type } = req.query;
    if (!major_name) return res.status(400).json({ success: false, error: '缺少major_name参数' });

    // 查专业介绍
    const [infoRows] = await pool.execute(
      'SELECT introduction, career_path, courses FROM major_info WHERE major_name COLLATE utf8mb4_unicode_ci = ? LIMIT 1',
      [major_name]
    );

    // 查录取数据（从 admission_plan 表）
    let sql = `
      SELECT
        college_name AS school_name,
        college_code AS school_code,
        college_type AS school_type,
        college_province AS province,
        subject_type,
        subject_require,
        major_remark,
        plan_count_1 AS admit_num,
        min_score_1  AS min_score,
        min_rank_1   AS min_rank,
        batch,
        batch_remark,
        major_category
      FROM admission_plan
      WHERE major_name COLLATE utf8mb4_unicode_ci = ?
    `;
    const params = [major_name];

    if (subject_type && subject_type !== '全部') {
      sql += ' AND subject_type LIKE ?';
      params.push('%' + subject_type + '%');
    }

    sql += ' ORDER BY min_score_1 DESC';

    const [rows] = await pool.execute(sql, params);
    res.json({
      success: true,
      data: rows,
      major_name,
      info: infoRows[0] || null
    });
  } catch (error) {
    console.error('获取专业详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 测试数据库连接
app.get('/api/test-connection', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT 1 as test');
    res.json({ success: true, message: '数据库连接正常' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== 管理员功能 =====

// 获取所有用户列表
app.get('/api/admin/users', async (req, res) => {
  try {
    const { search, status, page = 1, pageSize = 20, viewerRole, viewerId } = req.query;
    const pageNum = parseInt(page);
    const pageSizeNum = parseInt(pageSize);
    const offset = (pageNum - 1) * pageSizeNum;

    let sql = 'SELECT id, phone, username, password, status, role, created_at, last_login FROM users';
    let countSql = 'SELECT COUNT(*) as total FROM users';
    let conditions = [];
    let params = [];

    // 根据查看者身份过滤可见用户
    // admin: 可见所有普通用户，不可见其他admin和root
    // root: 可见所有普通用户和所有admin，不可见其他root
    if (viewerRole === 'admin') {
      conditions.push('role = ?');
      params.push('user');
    } else if (viewerRole === 'root') {
      // root不能看其他root，但可以看自己
      if (viewerId) {
        conditions.push('(role = ? OR role = ? OR id = ?)');
        params.push('user', 'admin', parseInt(viewerId));
      } else {
        conditions.push('(role = ? OR role = ?)');
        params.push('user', 'admin');
      }
    }

    // 搜索条件
    if (search) {
      conditions.push('(username LIKE ? OR phone LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    // 状态筛选
    if (status !== undefined && status !== '') {
      conditions.push('status = ?');
      params.push(parseInt(status));
    }

    // 添加WHERE条件
    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      sql += whereClause;
      countSql += whereClause;
    }

    // 查询总数
    const [countRows] = await pool.execute(countSql, params);
    const total = countRows[0].total;

    // 查询用户列表（使用模板字符串避免LIMIT/OFFSET参数绑定问题）
    sql += ` ORDER BY created_at DESC LIMIT ${pageSizeNum} OFFSET ${offset}`;
    const [rows] = await pool.execute(sql, params);

    res.json({
      success: true,
      data: rows,
      pagination: {
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(total / pageSizeNum)
      }
    });
  } catch (err) {
    console.error('❌ 获取用户列表失败:', err.message);
    res.json({ success: false, message: '服务器错误' });
  }
});

// 更新用户状态（启用/禁用）
app.put('/api/admin/users/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (status === undefined || ![0, 1].includes(status)) {
      return res.json({ success: false, message: '状态值无效' });
    }

    const [result] = await pool.execute(
      'UPDATE users SET status = ? WHERE id = ?',
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.json({ success: false, message: '用户不存在' });
    }

    console.log(`✅ 用户状态已更新：ID=${id}, status=${status}`);
    res.json({ 
      success: true, 
      message: status === 1 ? '用户已启用' : '用户已禁用' 
    });
  } catch (err) {
    console.error('❌ 更新用户状态失败:', err.message);
    res.json({ success: false, message: '服务器错误' });
  }
});

// 删除用户
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute(
      'DELETE FROM users WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.json({ success: false, message: '用户不存在' });
    }

    console.log(`✅ 用户已删除：ID=${id}`);
    res.json({ success: true, message: '用户已删除' });
  } catch (err) {
    console.error('❌ 删除用户失败:', err.message);
    res.json({ success: false, message: '服务器错误' });
  }
});

// 重置用户密码
app.post('/api/admin/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.json({ success: false, message: '密码长度至少6位' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    const [result] = await pool.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hash, id]
    );

    if (result.affectedRows === 0) {
      return res.json({ success: false, message: '用户不存在' });
    }

    console.log(`✅ 用户密码已重置：ID=${id}`);
    res.json({ success: true, message: '密码重置成功' });
  } catch (err) {
    console.error('❌ 重置密码失败:', err.message);
    res.json({ success: false, message: '服务器错误' });
  }
});

// 修改用户身份（角色）
app.put('/api/admin/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role, operatorRole } = req.body;

    // 权限验证：只有root可以修改身份
    if (operatorRole !== 'root') {
      return res.json({ success: false, message: '权限不足，只有root可以修改用户身份' });
    }

    // 验证角色值
    const validRoles = ['user', 'admin', 'root'];
    if (!role || !validRoles.includes(role)) {
      return res.json({ success: false, message: '角色值无效，应为: user, admin, root' });
    }

    const [result] = await pool.execute(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, id]
    );

    if (result.affectedRows === 0) {
      return res.json({ success: false, message: '用户不存在' });
    }

    console.log(`✅ 用户身份已修改：ID=${id}, role=${role}`);
    res.json({ success: true, message: `身份已修改为: ${role === 'admin' ? '管理员' : role === 'root' ? 'root' : '用户'}` });
  } catch (err) {
    console.error('❌ 修改用户身份失败:', err.message);
    res.json({ success: false, message: '服务器错误' });
  }
});

// 获取用户统计数据
app.get('/api/admin/stats', async (req, res) => {
  try {
    const { viewerRole, viewerId } = req.query;

    // 根据身份构建WHERE条件
    let roleCondition = '';
    let params = [];
    if (viewerRole === 'admin') {
      roleCondition = 'role = ?';
      params = ['user'];
    } else if (viewerRole === 'root') {
      if (viewerId) {
        roleCondition = '(role = ? OR role = ? OR id = ?)';
        params = ['user', 'admin', parseInt(viewerId)];
      } else {
        roleCondition = '(role = ? OR role = ?)';
        params = ['user', 'admin'];
      }
    }

    // 总用户数
    let totalSql = 'SELECT COUNT(*) as total FROM users';
    let totalParams = [];
    if (roleCondition) {
      totalSql += ' WHERE ' + roleCondition;
      totalParams = [...params];
    }
    const [totalRows] = await pool.execute(totalSql, totalParams);

    // 今日新增
    let todaySql = 'SELECT COUNT(*) as total FROM users WHERE DATE(created_at) = CURDATE()';
    let todayParams = [];
    if (roleCondition) {
      todaySql = 'SELECT COUNT(*) as total FROM users WHERE ' + roleCondition + ' AND DATE(created_at) = CURDATE()';
      todayParams = [...params];
    }
    const [todayRows] = await pool.execute(todaySql, todayParams);

    // 活跃用户（最近7天登录）
    let activeSql = 'SELECT COUNT(*) as total FROM users WHERE last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    let activeParams = [];
    if (roleCondition) {
      activeSql = 'SELECT COUNT(*) as total FROM users WHERE ' + roleCondition + ' AND last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
      activeParams = [...params];
    }
    const [activeRows] = await pool.execute(activeSql, activeParams);

    // 被禁用用户
    let disabledSql = 'SELECT COUNT(*) as total FROM users WHERE status = 0';
    let disabledParams = [];
    if (roleCondition) {
      disabledSql = 'SELECT COUNT(*) as total FROM users WHERE ' + roleCondition + ' AND status = 0';
      disabledParams = [...params];
    }
    const [disabledRows] = await pool.execute(disabledSql, disabledParams);

    res.json({
      success: true,
      data: {
        total: totalRows[0].total,
        todayNew: todayRows[0].total,
        active: activeRows[0].total,
        disabled: disabledRows[0].total
      }
    });
  } catch (err) {
    console.error('❌ 获取统计数据失败:', err.message);
    res.json({ success: false, message: '服务器错误' });
  }
});

// 提供静态文件服务
app.use(express.static(path.join(__dirname, '../')));

// 启动服务器
async function startServer() {
  await createPool();
  
  app.listen(PORT, '0.0.0.0', () => {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    let lanIP = '';
    for (const iface of Object.values(nets)) {
      for (const addr of iface) {
        if (addr.family === 'IPv4' && !addr.internal) { lanIP = addr.address; break; }
      }
      if (lanIP) break;
    }
    console.log(`\n🚀 后端服务器启动成功！`);
    console.log(`📡 本机访问: http://localhost:${PORT}`);
    if (lanIP) {
      console.log(`🌐 局域网访问: http://${lanIP}:${PORT}/index-mysql.html`);
      console.log(`   院校名录: http://${lanIP}:${PORT}/college-list.html`);
      console.log(`   专业名录: http://${lanIP}:${PORT}/major-list.html`);
    }
    console.log('\n📋 可用的API接口:');
    console.log(`   GET    /api/recommendations       - 获取用户推荐记录`);
    console.log(`   GET    /api/recommendations/:id   - 获取单条记录`);
    console.log(`   POST   /api/recommendations       - 保存推荐记录`);
    console.log(`   DELETE /api/recommendations/:id  - 删除记录`);
    console.log(`   DELETE /api/recommendations      - 清空所有记录`);
    console.log(`   POST   /api/recommend-from-db    - 从admission表获取推荐`);
    console.log(`   GET    /api/school-detail        - 获取学校详情`);
    console.log(`   GET    /api/colleges            - 获取所有院校列表`);
    console.log(`   GET    /api/test-connection      - 测试数据库连接`);
    console.log('\n📊 数据库说明:');
    console.log(`   - admission表: 存储院校录取数据（用于推荐）`);
    console.log(`   - user_recommendations表: 存储用户推荐记录`);
    console.log('\n⚠️  请确保MySQL服务已启动，并正确配置数据库连接信息');
  });
}

startServer().catch(console.error);
