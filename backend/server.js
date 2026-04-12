const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');


const app = express();
const PORT = 3000;

// 院校信息缓存（省份、城市）
let collegeInfoCache = new Map(); // key: school_name, value: {province, city}

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

// 加载院校信息缓存（省份、城市）
async function loadCollegeInfo() {
  try {
    console.log('📊 正在加载院校信息缓存...');
    const [rows] = await pool.execute(
      'SELECT school_name, province, city FROM dxmessage WHERE school_name IS NOT NULL'
    );
    
    rows.forEach(row => {
      collegeInfoCache.set(row.school_name, {
        province: row.province || '',
        city: row.city || ''
      });
    });
    
    console.log(`[OK] 已加载 ${collegeInfoCache.size} 所院校信息到缓存`);
  } catch (error) {
    console.error('[ERROR] 加载院校信息失败:', error.message);
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

// 根据分数查询位次（cumulative_count）
app.post('/api/get-rank-by-score', async (req, res) => {
  try {
    const { score, subjectCombination, region } = req.body;
    
    console.log('\n====== 查询位次 ======');
    console.log('参数:', { score, subjectCombination, region });
    
    if (!score || !region) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    
    const userScore = parseInt(score);
    const sourceProvince = region.trim();
    
    // 解析选科组合，确定科类
    const subjects = subjectCombination ? subjectCombination.split(',').map(s => s.trim()).filter(s => s) : [];
    
    // 判断是否为3+3模式
    const mode33Provinces = ['北京', '天津', '上海', '山东', '浙江', '海南'];
    const is33Mode = mode33Provinces.includes(sourceProvince);
    
    // 确定subject_type
    let subjectType;
    if (is33Mode) {
      subjectType = '综合';
    } else {
      // 3+1+2模式：根据必选科目确定科类
      if (subjects.includes('物理')) {
        subjectType = '物理';
      } else if (subjects.includes('历史')) {
        subjectType = '历史';
      } else {
        return res.status(400).json({ success: false, error: '无法确定科类，请检查选科组合' });
      }
    }
    
    console.log(`生源地: ${sourceProvince}, 科类: ${subjectType}, 分数: ${userScore}`);
    
    // 查询score_rank_table
    // 1. 先查询精确匹配的分数
    let query = `
      SELECT cumulative_count, batch
      FROM score_rank_table
      WHERE province = ? AND subject_type = ? AND score = ?
      ORDER BY batch
      LIMIT 1
    `;
    
    let [rows] = await pool.execute(query, [sourceProvince, subjectType, userScore]);
    
    // 如果没有精确匹配，查询最接近的分数（向下取整）
    if (rows.length === 0) {
      query = `
        SELECT cumulative_count, batch, score
        FROM score_rank_table
        WHERE province = ? AND subject_type = ? AND score <= ?
        ORDER BY score DESC
        LIMIT 1
      `;
      [rows] = await pool.execute(query, [sourceProvince, subjectType, userScore]);
    }
    
    if (rows.length === 0) {
      return res.json({ 
        success: false, 
        error: '未找到对应的位次数据',
        data: null
      });
    }
    
    const result = rows[0];
    console.log(`查询到位次: ${result.cumulative_count}, 批次: ${result.batch}`);
    
    res.json({
      success: true,
      data: {
        rank: result.cumulative_count,
        batch: result.batch,
        score: result.score || userScore,
        subjectType: subjectType
      }
    });
    
  } catch (error) {
    console.error('查询位次失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 根据位次查询分数
app.post('/api/get-score-by-rank', async (req, res) => {
  try {
    const { rank, subjectCombination, region } = req.body;
    
    console.log('\n====== 查询分数 ======');
    console.log('参数:', { rank, subjectCombination, region });
    
    if (!rank || !region) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    
    const userRank = parseInt(rank);
    const sourceProvince = region.trim();
    
    // 解析选科组合，确定科类
    const subjects = subjectCombination ? subjectCombination.split(',').map(s => s.trim()).filter(s => s) : [];
    
    // 判断是否为3+3模式
    const mode33Provinces = ['北京', '天津', '上海', '山东', '浙江', '海南'];
    const is33Mode = mode33Provinces.includes(sourceProvince);
    
    // 确定subject_type
    let subjectType;
    if (is33Mode) {
      subjectType = '综合';
    } else {
      // 3+1+2模式：根据必选科目确定科类
      if (subjects.includes('物理')) {
        subjectType = '物理';
      } else if (subjects.includes('历史')) {
        subjectType = '历史';
      } else {
        return res.status(400).json({ success: false, error: '无法确定科类，请检查选科组合' });
      }
    }
    
    console.log(`生源地: ${sourceProvince}, 科类: ${subjectType}, 位次: ${userRank}`);
    
    // 查询score_rank_table
    // 位次越小排名越高，cumulative_count越大排名越低
    // 查询cumulative_count >= 用户位次的最接近的分数
    let query = `
      SELECT score, batch, cumulative_count
      FROM score_rank_table
      WHERE province = ? AND subject_type = ? AND cumulative_count >= ?
      ORDER BY cumulative_count ASC
      LIMIT 1
    `;
    
    let [rows] = await pool.execute(query, [sourceProvince, subjectType, userRank]);
    
    // 如果没有结果，尝试查询位次小于用户位次的最接近分数
    if (rows.length === 0) {
      query = `
        SELECT score, batch, cumulative_count
        FROM score_rank_table
        WHERE province = ? AND subject_type = ? AND cumulative_count <= ?
        ORDER BY cumulative_count DESC
        LIMIT 1
      `;
      [rows] = await pool.execute(query, [sourceProvince, subjectType, userRank]);
    }
    
    if (rows.length === 0) {
      return res.json({ 
        success: false, 
        error: '未找到对应的分数数据',
        data: null
      });
    }
    
    const result = rows[0];
    console.log(`查询到分数: ${result.score}, 批次: ${result.batch}, 实际位次: ${result.cumulative_count}`);
    
    res.json({
      success: true,
      data: {
        score: result.score,
        batch: result.batch,
        actualRank: result.cumulative_count,
        subjectType: subjectType
      }
    });
    
  } catch (error) {
    console.error('查询分数失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 从 admission_plan 表获取推荐院校
app.post('/api/recommend-from-db', async (req, res) => {
  try {
    const { score, rank, scoreMode, subjectCombination, region, targetRegion, batchFilter, majorPreference, categoryFilter, majorCategoryFilter } = req.body;

    console.log('\n====== 推荐请求 ======');
    console.log('接收到参数:', JSON.stringify({ score, rank, scoreMode, subjectCombination, region, targetRegion, batchFilter, majorPreference, categoryFilter, majorCategoryFilter }));

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
    
    // 解析选科组合：前端格式 "物理,化学,生物"（3+1+2: 3门；3+3: 3门）
    const subjects = subjectCombination.split(',').map(s => s.trim()).filter(s => s);
    
    // 判断是否为3+3模式
    const mode33Provinces = ['北京', '天津', '上海', '山东', '浙江', '海南'];
    const is33Mode = mode33Provinces.includes(sourceProvince);
    
    // 判断是否为传统文理分科模式
    const traditionalProvinces = ['西藏', '新疆'];
    const isTraditionalMode = traditionalProvinces.includes(sourceProvince);
    
    // 确定查询条件（分数范围或位次范围）
    let whereCondition, orderCondition, rangeParams;
    
    // ========== 新逻辑：从score_rank_table获取位次 ==========
    // 根据选科确定subject_type（用于查询score_rank_table）
    let subjectTypeForRank;
    if (is33Mode) {
      subjectTypeForRank = '综合';
    } else {
      // 3+1+2模式：第一门是必选（物理/历史）
      subjectTypeForRank = subjects[0] || '物理';
    }
    
    // 从score_rank_table查询位次
    let userRank = null;
    let rankMinus10 = null;
    
    if (scoreMode === 'rank' && rank) {
      // 位次模式：根据位次查询最接近的分数
      const [rankRows] = await pool.execute(`
        SELECT score, cumulative_count
        FROM score_rank_table
        WHERE province = ? AND subject_type = ?
        ORDER BY ABS(cumulative_count - ?)
        LIMIT 1
      `, [sourceProvince, subjectTypeForRank, rank]);
      
      if (rankRows.length > 0) {
        const nearestScore = rankRows[0].score;
        console.log(`📊 位次模式：用户位次${rank}对应最接近分数${nearestScore}`);
        
        // 查询该分数-10分对应的位次
        const [scoreRows] = await pool.execute(`
          SELECT cumulative_count
          FROM score_rank_table
          WHERE province = ? AND subject_type = ? AND score = ?
          LIMIT 1
        `, [sourceProvince, subjectTypeForRank, nearestScore - 10]);
        
        userRank = rank;
        rankMinus10 = scoreRows.length > 0 ? scoreRows[0].cumulative_count : Math.floor(rank * 1.2);
        
        console.log(`📍 生源地: ${sourceProvince}, 科目类型: ${subjectTypeForRank}, 用户位次: ${userRank}, 分数-10位次: ${rankMinus10}`);
      } else {
        // 如果score_rank_table没有数据，使用原有逻辑
        userRank = rank;
        rankMinus10 = Math.floor(rank * 1.2);
        console.log(`⚠️ score_rank_table无数据，使用默认位次范围: ${userRank} ~ ${rankMinus10}`);
      }
    } else if (scoreMode === 'score' && score) {
      // 分数模式：查询用户分数和分数-10对应的位次
      const [scoreRows] = await pool.execute(`
        SELECT score, cumulative_count
        FROM score_rank_table
        WHERE province = ? AND subject_type = ? AND score = ?
        LIMIT 1
      `, [sourceProvince, subjectTypeForRank, score]);
      
      if (scoreRows.length > 0) {
        userRank = scoreRows[0].cumulative_count;
        console.log(`📊 分数模式：用户分数${score}对应位次${userRank}`);
      } else {
        // 如果没有精确匹配，查询最接近的
        const [nearestRows] = await pool.execute(`
          SELECT score, cumulative_count
          FROM score_rank_table
          WHERE province = ? AND subject_type = ?
          ORDER BY ABS(score - ?)
          LIMIT 1
        `, [sourceProvince, subjectTypeForRank, score]);
        
        if (nearestRows.length > 0) {
          userRank = nearestRows[0].cumulative_count;
          console.log(`📊 分数模式：最接近分数${nearestRows[0].score}对应位次${userRank}`);
        }
      }
      
      // 查询分数-10对应的位次
      const [minus10Rows] = await pool.execute(`
        SELECT cumulative_count
        FROM score_rank_table
        WHERE province = ? AND subject_type = ? AND score = ?
        LIMIT 1
      `, [sourceProvince, subjectTypeForRank, score - 10]);
      
      if (minus10Rows.length > 0) {
        rankMinus10 = minus10Rows[0].cumulative_count;
      } else {
        // 如果没有精确匹配，查询最接近的
        const [nearestMinus10Rows] = await pool.execute(`
          SELECT cumulative_count
          FROM score_rank_table
          WHERE province = ? AND subject_type = ?
          ORDER BY ABS(score - ?)
          LIMIT 1
        `, [sourceProvince, subjectTypeForRank, score - 10]);
        
        rankMinus10 = nearestMinus10Rows.length > 0 ? nearestMinus10Rows[0].cumulative_count : Math.floor((userRank || 10000) * 1.2);
      }
      
      console.log(`📍 生源地: ${sourceProvince}, 科目类型: ${subjectTypeForRank}, 用户分数: ${score}, 用户位次: ${userRank}, 分数-10位次: ${rankMinus10}`);
    }
    
    // 设置查询条件：使用位次范围
    if (userRank && rankMinus10) {
      // 位次范围：用户位次 ~ 用户分数-10对应的位次
      // 注意：位次越小分数越高，所以 rankMinus10 > userRank
      whereCondition = `AND min_rank_1 >= ? AND min_rank_1 <= ?`;
      orderCondition = `min_rank_1 ASC`;
      rangeParams = [userRank, rankMinus10];

      console.log(`✅ 使用位次查询: 专业最低位次 ${userRank} ~ ${rankMinus10}（分数${score} ~ ${score - 10}）`);
    } else {
      // 降级方案：使用分数查询
      // 分数查询：分数范围（上10分下20分）
      whereCondition = `AND COALESCE(group_min_score_1, min_score_1) >= ? AND COALESCE(group_min_score_1, min_score_1) <= ?`;
      orderCondition = `COALESCE(group_min_score_1, min_score_1) DESC`;
      rangeParams = [score - 20, score + 10];
      
      console.log(`⚠️ 无位次数据，使用分数范围: ${score - 20} ~ ${score + 10}`);
    }

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
        major_group_code AS major_group, major_group_code,
        group_min_score_1, group_min_rank_1, group_admit_count_1,
        min_score_1 AS min_score, min_rank_1 AS min_rank,
        avg_score_1, avg_rank_1, plan_count_1, admit_count_1,
        batch, batch_remark, subject_type, subject_require,
        category, major_category,
        major_remark`;

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
          ${whereCondition}
          AND (
            ${tripleCondition}
            OR subject_require IN (${pairs2.map(() => '?').join(',')})
            OR subject_require IN (${singles.map(() => '?').join(',')})
            OR subject_require = '不限'
            OR subject_require IS NULL
            OR subject_require = ''
          )
        ORDER BY match_priority ASC, ${orderCondition}, min_score DESC
      `;

      queryParams = [
        // CASE WHEN 参数（三科 + 两科 + 单科）
        ...(hasTriples ? triples3 : []),
        ...pairs2, ...singles,
        // WHERE 参数
        sourceProvince, ...rangeParams,
        // OR 条件参数（三科 + 两科 + 单科）
        ...(hasTriples ? triples3 : []),
        ...pairs2, ...singles
      ];

      console.log('🔍 [3+3] 查询参数:', {
        sourceProvince,
        选科: subjects,
        查询范围: rangeParams,
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
          major_group_code AS major_group, major_group_code,
          group_min_score_1, group_min_rank_1, group_admit_count_1,
          min_score_1 AS min_score, min_rank_1 AS min_rank,
          avg_score_1, avg_rank_1, plan_count_1, admit_count_1,
          batch, batch_remark, subject_type, subject_require,
          category, major_category,
          major_remark,
          COALESCE(group_min_score_1, min_score_1) AS effective_score
        FROM admission_plan
        WHERE source_province = ?
          AND subject_type = ?
          ${whereCondition}
        ORDER BY ${orderCondition}, min_score_1 DESC
      `;

      queryParams = [
        sourceProvince,
        subjectType,
        ...rangeParams
      ];

      console.log('🔍 [传统文理分科] 查询参数:', {
        sourceProvince,
        必选科目: requiredSubject,
        subjectType,
        查询范围: rangeParams
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
          major_group_code AS major_group, major_group_code,
          group_min_score_1, group_min_rank_1, group_admit_count_1,
          min_score_1 AS min_score, min_rank_1 AS min_rank,
          avg_score_1, avg_rank_1, plan_count_1, admit_count_1,
          batch, batch_remark, subject_type, subject_require,
          category, major_category,
          major_remark,
          COALESCE(group_min_score_1, min_score_1) AS effective_score
        FROM admission_plan
        WHERE source_province = ?
          AND subject_type = ?
          ${subjectRequireClause}
          ${whereCondition}
        ORDER BY ${orderCondition}, min_score_1 DESC
      `;

      queryParams = [
        sourceProvince,
        subjectType,
        ...subjectRequireParams,
        ...rangeParams
      ];

      console.log('🔍 [3+1+2] 查询参数:', {
        sourceProvince,
        必选科目: requiredSubject, subjectType,
        再选科目: `${optional1}${optional2 ? '、' + optional2 : ''}`,
        查询范围: rangeParams,
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
      // 录取概率计算：基于位次差
      let probability;
      let type;
      const majorRank = row.min_rank; // 专业最低位次

      console.log(`📊 推荐计算: userRank=${userRank}, majorRank=${majorRank}, college=${row.college_name}, major=${row.major_name}`);

      // 使用位次差计算概率
      if (userRank && majorRank && majorRank > 0) {
        // 位次差 = 专业最低位次 - 用户位次
        // 位次差 >= 0（已通过查询条件保证）
        const rankDiff = majorRank - userRank;

        // 概率计算：指数增长模型
        // P = 50 + 49 × (1 - e^(-位次差/k))
        // 效果：
        // - 位次差 = 0（压线）：P = 50%
        // - 位次差 = 3000：P ≈ 90%
        // - 位次差 = 6000：P ≈ 95%
        // - 位次差 -> 无穷大：P -> 99%
        const k = 3000;
        probability = 50 + 49 * (1 - Math.exp(-rankDiff / k));

        // 确保概率在合理范围
        probability = Math.max(50, Math.min(99, probability));

        // 推荐类型：基于位次差判断
        if (rankDiff >= 3000) {
          type = '保'; // 领先3000位以上，概率约90%以上，极稳妥
        } else if (rankDiff >= 1000) {
          type = '稳'; // 领先1000-3000位，概率约70%-90%，较稳妥
        } else {
          type = '冲'; // 领先1000位以内，概率约50%-70%，需要冲刺
        }
      } else {
        // 无位次数据：使用默认值
        probability = 50;
        type = '稳';
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
        province: collegeInfoCache.get(row.college_name)?.province || '',
        college_city: collegeInfoCache.get(row.college_name)?.city || '',
        batch: row.batch || '',
        batch_remark: row.batch_remark || '',
        category: row.category || '',
        major_category: row.major_category || '',
        subject_require: row.subject_require,
        major_remark: row.major_remark || '',
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

    // 严格精确匹配，不使用模糊查询
    // 从 major_introduction 表查询，字段映射：major_intro → introduction, career_direction → career_path, major_content → courses
    const [rows] = await pool.execute(
      `SELECT major_name, 
              major_intro as introduction, 
              career_direction as career_path, 
              major_content as courses
       FROM major_introduction
       WHERE major_name = ?
       LIMIT 1`,
      [major_name]
    );

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
              is_985, is_211, is_double_first_class, ranking, public_private, undergraduate_graduate
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

// 获取学校专业组的全部专业
app.get('/api/school-group-majors', async (req, res) => {
  try {
    const { schoolCode, groupCode, region, subjectCombination, schoolName } = req.query;
    
    if (!schoolCode || !groupCode) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    // 判断是3+3模式还是3+1+2模式
    const mode33Provinces = ['北京', '天津', '上海', '山东', '浙江', '海南'];
    const isMode33 = mode33Provinces.includes(region);
    
    console.log(`📋 获取学校专业组专业: schoolCode=${schoolCode}, groupCode=${groupCode}, region=${region}, subjectCombination=${subjectCombination}, schoolName=${schoolName}`);
    console.log(`   isMode33: ${isMode33}, subjects: ${subjectCombination ? subjectCombination.split(',').filter(s => s.trim()) : '无'}`);

    // 查询该学校该专业组的全部专业
    let sql = `
      SELECT 
        id,
        college_code AS school_code,
        college_name AS school_name,
        major_name AS major,
        major_code,
        major_category,
        major_group_code,
        subject_require,
        subject_type,
        min_score_1 AS min_score,
        min_rank_1 AS \`rank\`,
        admit_count_1 AS admit_count,
        batch,
        batch_remark
      FROM admission_plan
      WHERE college_code = ? AND major_group_code = ?
    `;
    const params = [schoolCode, groupCode];

    // 生源地筛选
    if (region) {
      sql += ` AND source_province = ?`;
      params.push(region);
    }

    // 院校名称筛选（精确匹配）
    if (schoolName) {
      sql += ` AND college_name = ?`;
      params.push(schoolName);
    }

    // 选科筛选
    if (subjectCombination) {
      // 解析选科组合
      const subjects = subjectCombination.split(',').filter(s => s.trim());
      
      if (isMode33) {
        // 3+3模式：用subject_require筛选
        // 专业要求必须在用户的选科范围内
        // 即：专业要求的每一门科目，用户都必须选了
        // 实现方式：排除那些要求了用户未选科目的专业
        const allSubjects = ['物理', '化学', '生物', '政治', '历史', '地理', '技术'];
        const userNotSelected = allSubjects.filter(s => !subjects.includes(s));
        
        // 专业不能要求用户未选的科目
        userNotSelected.forEach(s => {
          sql += ` AND (subject_require IS NULL OR subject_require = '' OR subject_require NOT LIKE ?)`;
          params.push(`%${s}%`);
        });
      } else {
        // 3+1+2模式或传统文理：仅用subject_type筛选，不判断subject_require
        // 注意：数据库中 subject_type 存储的是 "物理" 或 "历史"，不是 "物理类" 或 "历史类"
        if (subjects.includes('物理')) {
          sql += ` AND subject_type LIKE ?`;
          params.push('%物理%');
        } else if (subjects.includes('历史')) {
          sql += ` AND subject_type LIKE ?`;
          params.push('%历史%');
        } else if (subjects.includes('理科')) {
          sql += ` AND subject_type LIKE ?`;
          params.push('%理科%');
        } else if (subjects.includes('文科')) {
          sql += ` AND subject_type LIKE ?`;
          params.push('%文科%');
        }
        // 3+1+2模式不判断subject_require，只根据subject_type（物理/历史）筛选
      }
    }

    sql += ` ORDER BY min_score_1 ASC`;

    console.log(`🔍 执行SQL: ${sql}`);
    console.log(`   参数: ${JSON.stringify(params)}`);

    const [rows] = await pool.execute(sql, params);

    console.log(`✅ 查询到 ${rows.length} 条记录`);
    if (rows.length > 0) {
      const typeCount = {};
      rows.forEach(r => {
        typeCount[r.subject_type] = (typeCount[r.subject_type] || 0) + 1;
      });
      console.log(`   subject_type分布: ${JSON.stringify(typeCount)}`);
    }

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('获取专业组专业失败:', error);
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

// 获取专业推荐顺序
app.get('/api/major-recommend-order', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT discipline_category, major_category, sort_order FROM major_recommend_order ORDER BY sort_order'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('❌ 获取专业推荐顺序失败:', err.message);
    res.json({ success: false, message: '服务器错误' });
  }
});

// 获取院校特色标签
app.get('/api/college-features', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT school_name, is_985, is_211, is_double_first_class, is_postgrad_recommended,
              feature_1, feature_2, feature_3, feature_4, feature_5, feature_6, feature_7, feature_8,
              feature_9, feature_10, feature_11, feature_12, feature_13, feature_14, feature_15, feature_16,
              feature_17, feature_18, feature_19, feature_20, feature_21, feature_22, feature_23, feature_24,
              feature_25, feature_26, feature_27, feature_28, feature_29, feature_30, feature_31, feature_32
       FROM college_features`
    );
    
    // 转换为以院校名称为键的Map，方便前端查询
    const featuresMap = {};
    const allFeaturesSet = new Set(); // 收集所有特色标签
    
    rows.forEach(row => {
      const features = [];
      if (row.is_985) { features.push('985'); allFeaturesSet.add('985'); }
      if (row.is_211) { features.push('211'); allFeaturesSet.add('211'); }
      if (row.is_double_first_class) { features.push('双一流'); allFeaturesSet.add('双一流'); }
      if (row.is_postgrad_recommended) { features.push('保研'); allFeaturesSet.add('保研'); }
      
      // 添加特色标签
      for (let i = 1; i <= 32; i++) {
        const feature = row[`feature_${i}`];
        if (feature && feature.trim()) {
          features.push(feature.trim());
          allFeaturesSet.add(feature.trim());
        }
      }
      
      // 精确匹配：只用原始名称
      featuresMap[row.school_name] = features;
    });
    
    // 返回特色标签Map和所有去重的标签列表
    const allFeatures = [...allFeaturesSet].sort((a, b) => {
      // 985、211、双一流、保研排在最前面
      const priority = ['985', '211', '双一流', '保研'];
      const aIdx = priority.indexOf(a);
      const bIdx = priority.indexOf(b);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.localeCompare(b, 'zh-CN');
    });
    
    res.json({ success: true, data: featuresMap, allFeatures });
  } catch (err) {
    console.error('获取院校特色标签失败:', err.message);
    res.json({ success: false, message: '服务器错误' });
  }
});

// 生成院校简化名称（用于模糊匹配）
function generateSimplifiedNames(fullName) {
  const names = new Set();
  
  // 去掉"中国人民解放军"前缀
  let simplified = fullName.replace(/^中国人民解放军/, '');
  if (simplified !== fullName) {
    names.add(simplified);
  }
  
  // 去掉"(男)"、"(女)"、"(定向)"等后缀
  simplified = fullName.replace(/\([^)]+\)$/, '');
  if (simplified !== fullName) {
    names.add(simplified);
  }
  
  // 同时去掉前缀和后缀
  let combined = fullName.replace(/^中国人民解放军/, '').replace(/\([^)]+\)$/, '');
  if (combined !== fullName && combined.length > 0) {
    names.add(combined);
  }
  
  return [...names];
}

// 获取特色专业数据
app.get('/api/featured-majors', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT feature_type, majors FROM featured_majors`
    );

    // 转换为以特色类型为键的Map
    const featuredMajorsMap = {};
    rows.forEach(row => {
      if (row.majors) {
        // mysql2可能已自动解析JSON为数组，检查类型
        if (Array.isArray(row.majors)) {
          featuredMajorsMap[row.feature_type] = row.majors;
        } else if (typeof row.majors === 'string') {
          try {
            featuredMajorsMap[row.feature_type] = JSON.parse(row.majors);
          } catch (e) {
            console.warn('解析特色专业JSON失败:', row.feature_type);
          }
        }
      }
    });

    res.json({ success: true, data: featuredMajorsMap });
  } catch (err) {
    console.error('获取特色专业数据失败:', err.message);
    res.json({ success: false, message: '服务器错误' });
  }
});

// 导出Excel API
app.post('/api/export-excel', async (req, res) => {
  try {
    const { region, score, rank, subject, schools } = req.body;
    
    console.log('📊 导出Excel请求:', { region, score, rank, subject, schoolCount: schools?.length });
    
    if (!schools || schools.length === 0) {
      return res.json({ success: false, message: '没有数据可导出' });
    }
    
    const { execSync } = require('child_process');
    const path = require('path');
    const fs = require('fs');
    
    // 使用时间戳生成唯一文件名，避免并发冲突
    const timestamp = Date.now();
    const tempJsonPath = path.join(__dirname, `temp_export_data_${timestamp}.json`);
    const tempExcelPath = path.join(__dirname, `temp_export_${timestamp}.xlsx`);
    
    const exportData = {
      region,
      score,
      rank,
      subject,
      schools
    };
    
    // 写入JSON数据
    fs.writeFileSync(tempJsonPath, JSON.stringify(exportData, null, 2), 'utf8');
    console.log('📝 已写入JSON数据:', tempJsonPath);
    
    // 同步调用Python脚本生成Excel
    const pythonScript = path.join(__dirname, 'export_excel.py');
    // Linux服务器使用python3，Windows使用python
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    try {
      const result = execSync(`"${pythonCmd}" "${pythonScript}" "${tempJsonPath}" "${tempExcelPath}"`, {
        encoding: 'utf8',
        timeout: 30000  // 30秒超时
      });
      console.log('[OK] Python脚本输出:', result);
    } catch (pyError) {
      console.error('❌ Python执行失败:', pyError.message);
      if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath);
      return res.json({ success: false, message: 'Excel生成失败: ' + pyError.message });
    }
    
    // 检查文件是否生成成功
    if (!fs.existsSync(tempExcelPath)) {
      console.error('❌ Excel文件未生成');
      if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath);
      return res.json({ success: false, message: 'Excel文件未生成' });
    }
    
    // 检查文件大小
    const stats = fs.statSync(tempExcelPath);
    console.log(`📊 Excel文件已生成: ${tempExcelPath}, 大小: ${stats.size} bytes`);
    
    if (stats.size < 100) {
      console.error('❌ Excel文件太小，可能损坏');
      fs.unlinkSync(tempJsonPath);
      fs.unlinkSync(tempExcelPath);
      return res.json({ success: false, message: 'Excel文件生成异常' });
    }
    
    // 发送文件
    const fileName = `志愿推荐_${new Date().toISOString().slice(0,10)}.xlsx`;
    res.download(tempExcelPath, fileName, (err) => {
      // 清理临时文件
      try {
        if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath);
        if (fs.existsSync(tempExcelPath)) fs.unlinkSync(tempExcelPath);
        console.log('🧹 临时文件已清理');
      } catch (e) {
        console.error('清理临时文件失败:', e);
      }
      if (err) console.error('下载失败:', err);
    });
    
  } catch (err) {
    console.error('❌ 导出Excel失败:', err.message);
    res.json({ success: false, message: '服务器错误: ' + err.message });
  }
});

// 提供静态文件服务
app.use(express.static(path.join(__dirname, '../')));

// 启动服务器
async function startServer() {
  await createPool();
  
  // 加载院校信息缓存
  await loadCollegeInfo();
  
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
    console.log(`   POST   /api/get-rank-by-score   - 根据分数查询位次`);
    console.log(`   POST   /api/get-score-by-rank   - 根据位次查询分数`);
    console.log(`   POST   /api/recommend-from-db   - 从admission表获取推荐（支持分数/位次查询）`);
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
