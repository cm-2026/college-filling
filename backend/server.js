const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('./middleware/auth');


const app = express();
const PORT = 3000;

// 院校信息缓存（省份、城市）
let collegeInfoCache = new Map(); // key: school_name, value: {province, city}

// 用户行为记录函数
async function recordBehavior(userId, behaviorType, behaviorData, req) {
  try {
    const ip = req.ip || req.connection.remoteAddress || '';
    const userAgent = req.get('User-Agent') || '';
    
    await pool.execute(
      'INSERT INTO user_behaviors (user_id, behavior_type, behavior_data, ip, user_agent) VALUES (?, ?, ?, ?, ?)',
      [userId, behaviorType, JSON.stringify(behaviorData), ip, userAgent.substring(0, 500)]
    );
  } catch (error) {
    console.error('[WARN] 记录行为失败:', error.message);
  }
}

// 管理员操作日志函数
async function recordAdminLog(adminId, adminName, action, targetType, targetId, detail, req) {
  try {
    const ip = req.ip || req.connection.remoteAddress || '';
    
    await pool.execute(
      'INSERT INTO admin_logs (admin_id, admin_name, action, target_type, target_id, detail, ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [adminId, adminName, action, targetType, targetId, JSON.stringify(detail), ip]
    );
  } catch (error) {
    console.error('[WARN] 记录管理员日志失败:', error.message);
  }
}

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

    // 记录登录行为
    await recordBehavior(user.id, 'login', { username: user.username }, req);

    // 生成 JWT Token
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role || 'user' },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '7d' } // Token有效期7天
    );

    console.log(`✅ 用户登录：${user.username} (角色: ${user.role || 'user'})`);
    res.json({
      success: true,
      message: '登录成功',
      token: token,
      userId: user.id,
      username: user.username,
      role: user.role || 'user'
    });

  } catch (err) {
    console.error('❌ 登录失败:', err.message);
    res.json({ success: false, message: '服务器错误，请稍后重试' });
  }
});

// 获取所有推荐记录（需要认证）
app.get('/api/recommendations', authenticateToken, async (req, res) => {
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

// 获取单条记录（需要认证）
app.get('/api/recommendations/:id', authenticateToken, async (req, res) => {
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

// 添加推荐记录（需要认证）
app.post('/api/recommendations', authenticateToken, async (req, res) => {
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

// 删除记录（需要认证）
app.delete('/api/recommendations/:id', authenticateToken, async (req, res) => {
  try {
    await pool.execute('DELETE FROM user_recommendations WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 清空所有记录（需要认证）
app.delete('/api/recommendations', authenticateToken, async (req, res) => {
  try {
    await pool.execute('DELETE FROM user_recommendations');
    await pool.execute('ALTER TABLE user_recommendations AUTO_INCREMENT = 1');
    res.json({ success: true, message: '清空成功' });
  } catch (error) {
    console.error('清空记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 根据分数查询位次（cumulative_count）（需要认证）
app.post('/api/get-rank-by-score', authenticateToken, async (req, res) => {
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

// 根据位次查询分数（需要认证）
app.post('/api/get-score-by-rank', authenticateToken, async (req, res) => {
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

// 从 admission_plan 表获取推荐院校（需要认证）
app.post('/api/recommend-from-db', authenticateToken, async (req, res) => {
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

    // 记录推荐查询行为（如果有用户ID）
    const userId = req.body.userId || null;
    if (userId || score || region) {
      await recordBehavior(userId, 'recommend', {
        score,
        rank,
        region,
        subjectCombination,
        resultCount: recommendations.length
      }, req);
    }

    res.json({ success: true, data: recommendations });
  } catch (error) {
    console.error('查询院校数据失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取学校详情（需要认证）
app.get('/api/school-detail', authenticateToken, async (req, res) => {
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

// 获取专业完整详情（合并 major_introduction + major_info）（需要认证）
app.get('/api/major-full-detail', authenticateToken, async (req, res) => {
  try {
    const { major_name, major_type } = req.query;
    if (!major_name) {
      return res.json({ success: false, error: '缺少专业名称参数' });
    }

    console.log(`📚 获取专业完整详情: ${major_name}, 类型: ${major_type || '未指定'}`);

    // 查询 major_introduction 表 - 根据类型筛选
    let introSql = `SELECT major_name, major_code, subject_category, major_class, level, study_years, degree, gender_ratio,
                    major_intro, major_content, career_direction, employment_destination, employment_region,
                    employment_industry, employment_position
             FROM major_introduction
             WHERE major_name COLLATE utf8mb4_unicode_ci = ?`;
    const introParams = [major_name];

    // 如果指定了类型，根据类型筛选
    if (major_type === 'undergraduate') {
      introSql += ' AND (level = ? OR level LIKE ? OR level IS NULL)';
      introParams.push('本科', '%本科%');
    } else if (major_type === 'specialist') {
      introSql += ' AND (level = ? OR level LIKE ? OR level IS NULL)';
      introParams.push('专科', '%专科%');
    }

    introSql += ' LIMIT 1';

    const [introRows] = await pool.execute(introSql, introParams);

    // 查询 major_info 表 - 目前没有level字段，只能按名称查询
    const [infoRows] = await pool.execute(
      `SELECT introduction, career_path, courses
       FROM major_info
       WHERE major_name COLLATE utf8mb4_unicode_ci = ?
       LIMIT 1`,
      [major_name]
    );

    if (introRows.length === 0 && infoRows.length === 0) {
      console.log(`⚠️  未找到专业详情: ${major_name}, 类型: ${major_type}`);
      return res.json({ success: false, error: '未找到该专业信息' });
    }

    // 合并数据，major_info 字段优先
    const result = {
      ...(introRows[0] || {}),
      introduction: infoRows[0]?.introduction || introRows[0]?.major_intro || null,
      career_path: infoRows[0]?.career_path || introRows[0]?.career_direction || null,
      courses: infoRows[0]?.courses || introRows[0]?.major_content || null
    };

    console.log(`✅ 找到专业详情: ${major_name}, 类型: ${major_type || '未指定'}`);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取专业完整详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取专业介绍信息（需要认证）
app.get('/api/major-info', authenticateToken, async (req, res) => {
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

// 获取所有院校（用于院校名录）（需要认证）
app.get('/api/colleges', authenticateToken, async (req, res) => {
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

// 获取专业名录（基于 major_info 表，附带 admission_plan 录取统计）（需要认证）
app.get('/api/majors', authenticateToken, async (req, res) => {
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

// 获取专业详情（专业介绍 + 开设院校录取数据）（需要认证）
app.get('/api/major-detail', authenticateToken, async (req, res) => {
  try {
    const { major_name, subject_type, major_type } = req.query;
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
        major_category,
        major_level
      FROM admission_plan
      WHERE major_name COLLATE utf8mb4_unicode_ci = ?
    `;
    const params = [major_name];

    // 根据专业类型筛选
    if (major_type === 'undergraduate') {
      sql += ' AND (major_level = ? OR major_level LIKE ? OR major_level IS NULL)';
      params.push('本科', '%本科%');
    } else if (major_type === 'specialist') {
      sql += ' AND (major_level = ? OR major_level LIKE ? OR major_level IS NULL)';
      params.push('专科', '%专科%');
    }

    if (subject_type && subject_type !== '全部') {
      sql += ' AND subject_type LIKE ?';
      params.push('%' + subject_type + '%');
    }

    sql += ' ORDER BY min_score_1 DESC';

    const [rows] = await pool.execute(sql, params);

    // 获取去重后的院校名称，查询 dxmessage 获取院校属性
    const schoolNames = [...new Set(rows.map(r => r.school_name).filter(Boolean))];
    let schoolAttrs = {};
    if (schoolNames.length > 0) {
      const placeholders = schoolNames.map(() => '?').join(',');
      const [attrRows] = await pool.execute(
        `SELECT school_name, is_985, is_211, is_double_first_class, public_private, undergraduate_graduate
         FROM dxmessage WHERE school_name IN (${placeholders})`,
        schoolNames
      );
      attrRows.forEach(r => { schoolAttrs[r.school_name] = r; });
    }

    // 为每条记录附加院校属性
    rows.forEach(row => {
      const attr = schoolAttrs[row.school_name];
      if (attr) {
        row.is_985 = attr.is_985;
        row.is_211 = attr.is_211;
        row.is_double_first_class = attr.is_double_first_class;
        row.public_private = attr.public_private;
        row.undergraduate_graduate = attr.undergraduate_graduate;
      }
    });

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

// 获取学校专业组的全部专业（需要认证）
app.get('/api/school-group-majors', authenticateToken, async (req, res) => {
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
        batch_remark,
        group_min_score_1,
        group_min_rank_1
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

// 获取所有用户列表（需要认证）
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    const { search, status, page = 1, pageSize = 20, viewerRole, viewerId, sortField, sortOrder } = req.query;
    const pageNum = parseInt(page);
    const pageSizeNum = parseInt(pageSize);
    const offset = (pageNum - 1) * pageSizeNum;
    
    const allowedSortFields = ['id', 'created_at', 'last_login'];
    const validSortField = allowedSortFields.includes(sortField) ? sortField : 'created_at';
    const validSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

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
    sql += ` ORDER BY ${validSortField} ${validSortOrder} LIMIT ${pageSizeNum} OFFSET ${offset}`;
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

// 更新用户状态（启用/禁用）（需要认证）
app.put('/api/admin/users/:id/status', authenticateToken, async (req, res) => {
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

// 删除用户（需要认证）
app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
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

// 重置用户密码（需要认证）
app.post('/api/admin/users/:id/reset-password', authenticateToken, async (req, res) => {
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

// 修改用户身份（角色）（需要认证）
app.put('/api/admin/users/:id/role', authenticateToken, async (req, res) => {
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

// 获取用户统计数据（需要认证）
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
  try {
    const { viewerRole, viewerId } = req.query;

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

    let whereClause = roleCondition ? ' WHERE ' + roleCondition : '';
    let sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as todayNew,
        SUM(CASE WHEN last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as disabled
      FROM users
      ${whereClause}
    `;
    
    const [rows] = await pool.execute(sql, params);
    const stats = rows[0];

    res.json({
      success: true,
      data: {
        total: stats.total,
        todayNew: stats.todayNew || 0,
        active: stats.active || 0,
        disabled: stats.disabled || 0
      }
    });
  } catch (err) {
    console.error('❌ 获取统计数据失败:', err.message);
    res.json({ success: false, message: '服务器错误' });
  }
});

// 数据看板API（需要认证）
app.get('/api/admin/dashboard', authenticateToken, async (req, res) => {
  try {
    const dashboard = {};

    // 1. 今日数据
    const [todayBehaviors] = await pool.execute(`
      SELECT 
        behavior_type,
        COUNT(*) as count,
        COUNT(DISTINCT user_id) as unique_users
      FROM user_behaviors 
      WHERE DATE(created_at) = CURDATE()
      GROUP BY behavior_type
    `);

    // 查询今日UV(唯一访客数)
    const [todayUv] = await pool.execute(
      'SELECT COUNT(DISTINCT user_id) as count FROM user_behaviors WHERE DATE(created_at) = CURDATE() AND user_id IS NOT NULL'
    );

    const todayStats = {
      pv: todayBehaviors.reduce((sum, b) => sum + b.count, 0),
      uv: todayUv[0].count,
      searches: todayBehaviors.find(b => b.behavior_type === 'search')?.count || 0,
      recommendations: todayBehaviors.find(b => b.behavior_type === 'recommend')?.count || 0,
      exports: todayBehaviors.find(b => b.behavior_type === 'export')?.count || 0
    };

    // 今日新增用户
    const [todayUsers] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE DATE(created_at) = CURDATE()'
    );
    todayStats.newUsers = todayUsers[0].count;

    dashboard.today = todayStats;

    // 2. 实时在线用户（5分钟内活跃）
    const [onlineUsers] = await pool.execute(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM user_behaviors
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      AND user_id IS NOT NULL
    `);
    dashboard.realtime = { onlineUsers: onlineUsers[0].count };

    // 3. 省份查询排行榜 - 返回所有31个省份（或数据库中有的所有省份）
    const [provinceRank] = await pool.execute(`
      SELECT 
        JSON_EXTRACT(behavior_data, '$.region') as keyword,
        COUNT(*) as count
      FROM user_behaviors
      WHERE behavior_type = 'recommend'
      AND behavior_data IS NOT NULL
      AND JSON_EXTRACT(behavior_data, '$.region') IS NOT NULL
      GROUP BY keyword
      ORDER BY count DESC
      LIMIT 34
    `);
    dashboard.rankings = { 
      hotSearches: provinceRank
        .filter(s => s.keyword && s.keyword !== 'null')
        .map(s => ({
          keyword: s.keyword.replace(/"/g, ''),
          count: s.count
        }))
    };

    // 6. 热门院校Top10（从推荐查询的college提取）
    const [hotColleges] = await pool.execute(`
      SELECT 
        JSON_EXTRACT(behavior_data, '$.college') as college_name,
        COUNT(*) as count
      FROM user_behaviors
      WHERE behavior_type = 'recommend'
      AND behavior_data IS NOT NULL
      AND JSON_EXTRACT(behavior_data, '$.college') IS NOT NULL
      GROUP BY college_name
      ORDER BY count DESC
      LIMIT 10
    `);
    dashboard.rankings.popularColleges = hotColleges
      .filter(c => c.college_name && c.college_name !== 'null')
      .map(c => ({
        college_name: c.college_name.replace(/"/g, ''),
        count: c.count
      }));

    // 7. 地区分布（保留用于备选显示）
    const [regionDist] = await pool.execute(`
      SELECT 
        JSON_EXTRACT(behavior_data, '$.region') as province,
        COUNT(*) as count
      FROM user_behaviors
      WHERE behavior_type = 'recommend'
      AND behavior_data IS NOT NULL
      GROUP BY province
      ORDER BY count DESC
      LIMIT 10
    `);
    dashboard.distributions = {
      regions: regionDist
        .filter(r => r.province && r.province !== 'null')
        .map(r => ({
          province: r.province.replace(/"/g, ''),
          count: r.count
        }))
    };

    res.json({ success: true, data: dashboard });
  } catch (err) {
    console.error('❌ 获取数据看板失败:', err.message);
    res.json({ success: false, message: '服务器错误' });
  }
});

// 获取专业推荐顺序（需要认证）
app.get('/api/major-recommend-order', authenticateToken, async (req, res) => {
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

// 获取院校特色标签（需要认证）
app.get('/api/college-features', authenticateToken, async (req, res) => {
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

// 获取特色专业数据（需要认证）
app.get('/api/featured-majors', authenticateToken, async (req, res) => {
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

// 导出Excel API（需要认证）
app.post('/api/export-excel', authenticateToken, async (req, res) => {
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
    
    // 记录导出行为
    const userId = req.body.userId || null;
    await recordBehavior(userId, 'export', {
      region,
      score,
      schoolCount: schools.length
    }, req);

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

// ===== 专业分类管理 API =====
// 获取专业分类列表（需要认证）
app.get('/api/major-category', authenticateToken, async (req, res) => {
  try {
    const { level, category_code, search, type } = req.query;

    let sql = 'SELECT * FROM major_category WHERE 1=1';
    const params = [];

    if (level) {
      sql += ' AND level = ?';
      params.push(parseInt(level));
    }

    if (category_code) {
      sql += ' AND category_code = ?';
      params.push(category_code);
    }

    if (search) {
      sql += ' AND (name LIKE ? OR code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // 根据类型筛选本科或专科数据
    if (type === 'undergraduate') {
      // 本科：code以01-13开头（包括门类、专业类、专业）
      sql += ` AND (
        code REGEXP "^(0[1-9]|1[0-3])"
        OR category_code REGEXP "^(0[1-9]|1[0-3])"
        OR top_code REGEXP "^(0[1-9]|1[0-3])"
      )`;
    } else if (type === 'specialist') {
      // 专科：code以4-9开头（根据实际数据41-99）
      sql += ` AND (
        code REGEXP "^([4-9][0-9])"
        OR category_code REGEXP "^([4-9][0-9])"
        OR top_code REGEXP "^([4-9][0-9])"
      )`;
    }

    sql += ' ORDER BY level, code';

    const [rows] = await pool.execute(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('获取专业分类失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 新增专业分类（需要认证）
app.post('/api/major-category', authenticateToken, async (req, res) => {
  try {
    const { code, name, level, parent_id, category_code, category_name, class_code, class_name, status, top_code } = req.body;
    
    if (!code || !name || !level) {
      return res.status(400).json({ success: false, message: '编码、名称和层级不能为空' });
    }
    
    // 检查编码是否重复
    const [existing] = await pool.execute('SELECT id FROM major_category WHERE code = ?', [code]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: '编码已存在' });
    }
    
    // 确定 top_code
    let finalTopCode = top_code;
    if (!finalTopCode && parent_id) {
      // 从父节点获取 top_code
      const [parentRows] = await pool.execute('SELECT top_code, code, level FROM major_category WHERE id = ?', [parent_id]);
      if (parentRows.length > 0) {
        finalTopCode = parentRows[0].top_code || parentRows[0].code;
      }
    }
    
    const sql = `
      INSERT INTO major_category (code, name, level, parent_id, category_code, category_name, class_code, class_name, status, top_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [code, name, level, parent_id || null, category_code || null, category_name || null, class_code || null, class_name || null, status || 1, finalTopCode || null];
    
    const [result] = await pool.execute(sql, params);
    res.json({ success: true, message: '新增成功', data: { id: result.insertId, code, name } });
  } catch (err) {
    console.error('新增专业分类失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 更新专业分类（需要认证）
app.put('/api/major-category/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, level, parent_id, category_code, category_name, class_code, class_name, status, top_code } = req.body;
    
    if (!code || !name || !level) {
      return res.status(400).json({ success: false, message: '编码、名称和层级不能为空' });
    }
    
    // 检查编码是否与其他记录重复
    const [existing] = await pool.execute('SELECT id FROM major_category WHERE code = ? AND id != ?', [code, id]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: '编码已被其他记录使用' });
    }
    
    // 确定 top_code
    let finalTopCode = top_code;
    if (!finalTopCode && parent_id) {
      const [parentRows] = await pool.execute('SELECT top_code, code, level FROM major_category WHERE id = ?', [parent_id]);
      if (parentRows.length > 0) {
        finalTopCode = parentRows[0].top_code || parentRows[0].code;
      }
    }
    
    const sql = `
      UPDATE major_category 
      SET code = ?, name = ?, level = ?, parent_id = ?, category_code = ?, category_name = ?, class_code = ?, class_name = ?, status = ?, top_code = ?
      WHERE id = ?
    `;
    const params = [code, name, level, parent_id || null, category_code || null, category_name || null, class_code || null, class_name || null, status || 1, finalTopCode || null, id];
    
    await pool.execute(sql, params);
    res.json({ success: true, message: '更新成功' });
  } catch (err) {
    console.error('更新专业分类失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 删除专业分类（级联删除子节点）（需要认证）
app.delete('/api/major-category/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 递归获取所有子节点ID
    const getChildIds = async (parentId) => {
      const [children] = await pool.execute('SELECT id FROM major_category WHERE parent_id = ?', [parentId]);
      let ids = children.map(c => c.id);
      for (const childId of ids) {
        const childIds = await getChildIds(childId);
        ids = ids.concat(childIds);
      }
      return ids;
    };
    
    const childIds = await getChildIds(id);
    const allIds = [parseInt(id), ...childIds];
    
    // 批量删除
    if (allIds.length > 0) {
      const placeholders = allIds.map(() => '?').join(',');
      await pool.execute(`DELETE FROM major_category WHERE id IN (${placeholders})`, allIds);
    }
    
    res.json({ success: true, message: `已删除 ${allIds.length} 条记录` });
  } catch (err) {
    console.error('删除专业分类失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== 招生计划管理 API =====
// 获取招生计划列表（分页）（需要认证）
app.get('/api/admission-plan', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const { province, subject_type, search } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (province) {
      whereClause += ' AND source_province = ?';
      params.push(province);
    }

    if (subject_type) {
      whereClause += ' AND subject_type = ?';
      params.push(subject_type);
    }

    if (search) {
      whereClause += ' AND (college_name LIKE ? OR major_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // 查询总数
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM admission_plan ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    // 确保页码和页面大小有效
    const validPageSize = Math.max(1, Math.min(100, pageSize));
    const validOffset = Math.max(0, (page - 1) * validPageSize);

    // 查询数据 - 返回所有字段
    const sql = `
      SELECT
        id, year, college_code, college_name, major_name, major_code,
        major_group_code, subject_type, subject_require, major_level,
        min_score_1, min_rank_1, plan_count_1, admit_count_1,
        batch, batch_remark, major_remark, source_province,
        category, major_category,
        group_min_score_1, group_min_rank_1, group_admit_count_1,
        avg_score_1, avg_rank_1
      FROM admission_plan
      ${whereClause}
      ORDER BY id DESC
      LIMIT ${validPageSize} OFFSET ${validOffset}
    `;

    const [rows] = await pool.execute(sql, params);

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: page,
        pageSize: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (err) {
    console.error('获取招生计划失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取省份列表（用于筛选）- 添加缓存
let provincesCache = null;
let provincesCacheTime = 0;
app.get('/api/admission-plan/provinces', async (req, res) => {
  try {
    // 使用缓存（10分钟有效期）
    const now = Date.now();
    if (provincesCache && (now - provincesCacheTime) < 600000) {
      return res.json({ success: true, data: provincesCache });
    }

    const [rows] = await pool.execute(
      'SELECT DISTINCT source_province FROM admission_plan WHERE source_province IS NOT NULL ORDER BY source_province'
    );
    provincesCache = rows.map(r => r.source_province);
    provincesCacheTime = now;
    res.json({ success: true, data: provincesCache });
  } catch (err) {
    console.error('获取省份列表失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 新增招生计划（需要认证）
app.post('/api/admission-plan', authenticateToken, async (req, res) => {
  try {
    const {
      year, college_code, college_name, major_name, major_code,
      major_group_code, subject_type, subject_require, major_level,
      source_province, category, major_category,
      min_score_1, min_rank_1, plan_count_1, admit_count_1,
      batch, batch_remark, major_remark,
      group_min_score_1, group_min_rank_1, group_admit_count_1,
      avg_score_1, avg_rank_1
    } = req.body;

    if (!college_code || !college_name || !major_name) {
      return res.status(400).json({ success: false, message: '院校代码、院校名称、专业名称不能为空' });
    }

    // 获取当前最大ID
    const [maxIdRows] = await pool.execute('SELECT MAX(id) as maxId FROM admission_plan');
    const nextId = (maxIdRows[0].maxId || 0) + 1;

    const sql = `
      INSERT INTO admission_plan (
        id, year, college_code, college_name, major_name, major_code,
        major_group_code, subject_type, subject_require, major_level,
        min_score_1, min_rank_1, plan_count_1, admit_count_1,
        batch, batch_remark, major_remark, source_province,
        category, major_category,
        group_min_score_1, group_min_rank_1, group_admit_count_1,
        avg_score_1, avg_rank_1
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await pool.execute(sql, [
      nextId, year || 2025, college_code, college_name, major_name, major_code || null,
      major_group_code || null, subject_type || '物理', subject_require || '不限', major_level || '本科',
      min_score_1 || null, min_rank_1 || null, plan_count_1 || null, admit_count_1 || null,
      batch || '本科批', batch_remark || null, major_remark || null, source_province || '河北',
      category || null, major_category || null,
      group_min_score_1 || null, group_min_rank_1 || null, group_admit_count_1 || null,
      avg_score_1 || null, avg_rank_1 || null
    ]);

    res.json({ success: true, message: '新增成功' });
  } catch (err) {
    console.error('新增招生计划失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 更新招生计划（需要认证）
app.put('/api/admission-plan/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      year, college_code, college_name, major_name, major_code,
      major_group_code, subject_type, subject_require, major_level,
      source_province, category, major_category,
      min_score_1, min_rank_1, plan_count_1, admit_count_1,
      batch, batch_remark, major_remark,
      group_min_score_1, group_min_rank_1, group_admit_count_1,
      avg_score_1, avg_rank_1
    } = req.body;

    if (!college_code || !college_name || !major_name) {
      return res.status(400).json({ success: false, message: '院校代码、院校名称、专业名称不能为空' });
    }

    const sql = `
      UPDATE admission_plan SET
        year = ?, college_code = ?, college_name = ?, major_name = ?, major_code = ?,
        major_group_code = ?, subject_type = ?, subject_require = ?, major_level = ?,
        source_province = ?, category = ?, major_category = ?,
        min_score_1 = ?, min_rank_1 = ?, plan_count_1 = ?, admit_count_1 = ?,
        batch = ?, batch_remark = ?, major_remark = ?,
        group_min_score_1 = ?, group_min_rank_1 = ?, group_admit_count_1 = ?,
        avg_score_1 = ?, avg_rank_1 = ?
      WHERE id = ?
    `;

    const [result] = await pool.execute(sql, [
      year || 2025, college_code, college_name, major_name, major_code || null,
      major_group_code || null, subject_type || '物理', subject_require || '不限', major_level || '本科',
      source_province || '河北', category || null, major_category || null,
      min_score_1 || null, min_rank_1 || null, plan_count_1 || null, admit_count_1 || null,
      batch || '本科批', batch_remark || null, major_remark || null,
      group_min_score_1 || null, group_min_rank_1 || null, group_admit_count_1 || null,
      avg_score_1 || null, avg_rank_1 || null,
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }

    res.json({ success: true, message: '更新成功' });
  } catch (err) {
    console.error('更新招生计划失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 删除招生计划（需要认证）
app.delete('/api/admission-plan/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM admission_plan WHERE id = ?', [id]);
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('删除招生计划失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 获取单条招生计划详情（需要认证）
app.get('/api/admission-plan/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      `SELECT
        id, year, college_code, college_name, major_name, major_code,
        major_group_code, subject_type, subject_require, major_level,
        min_score_1, min_rank_1, plan_count_1, admit_count_1,
        batch, batch_remark, major_remark, source_province,
        category, major_category,
        group_min_score_1, group_min_rank_1, group_admit_count_1,
        avg_score_1, avg_rank_1
      FROM admission_plan WHERE id = ?`,
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('获取招生计划详情失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 批量导入招生计划（Excel导入）（需要认证）
app.post('/api/admission-plan/batch', authenticateToken, async (req, res) => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ success: false, message: '数据不能为空' });
    }

    if (data.length > 1000) {
      return res.status(400).json({ success: false, message: '单次导入不能超过1000条' });
    }

    // 获取当前最大ID
    const [maxIdRows] = await pool.execute('SELECT MAX(id) as maxId FROM admission_plan');
    let nextId = (maxIdRows[0].maxId || 0) + 1;

    const successRecords = [];
    const errorRecords = [];

    // 使用事务
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        // 基本校验
        if (!row.college_code || !row.college_name || !row.major_name) {
          errorRecords.push({ index: i + 1, data: row, error: '院校代码、院校名称、专业名称不能为空' });
          continue;
        }

        const sql = `
          INSERT INTO admission_plan (
            id, year, college_code, college_name, major_name, major_code,
            major_group_code, subject_type, subject_require, major_level,
            min_score_1, min_rank_1, plan_count_1, admit_count_1,
            batch, batch_remark, major_remark, source_province,
            category, major_category,
            group_min_score_1, group_min_rank_1, group_admit_count_1,
            avg_score_1, avg_rank_1
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
          nextId++,
          row.year || 2025,
          row.college_code,
          row.college_name,
          row.major_name,
          row.major_code || null,
          row.major_group_code || null,
          row.subject_type || '物理',
          row.subject_require || '不限',
          row.major_level || '本科',
          row.min_score_1 || null,
          row.min_rank_1 || null,
          row.plan_count_1 || null,
          row.admit_count_1 || null,
          row.batch || '本科批',
          row.batch_remark || null,
          row.major_remark || null,
          row.source_province || '河北',
          row.category || null,
          row.major_category || null,
          row.group_min_score_1 || null,
          row.group_min_rank_1 || null,
          row.group_admit_count_1 || null,
          row.avg_score_1 || null,
          row.avg_rank_1 || null
        ];

        try {
          await connection.execute(sql, params);
          successRecords.push({ index: i + 1, college_name: row.college_name, major_name: row.major_name });
        } catch (insertErr) {
          errorRecords.push({ index: i + 1, data: row, error: insertErr.message });
        }
      }

      await connection.commit();
    } catch (transactionErr) {
      await connection.rollback();
      throw transactionErr;
    } finally {
      connection.release();
    }

    console.log(`✅ 批量导入完成: 成功 ${successRecords.length} 条, 失败 ${errorRecords.length} 条`);

    res.json({
      success: true,
      message: `导入完成: 成功 ${successRecords.length} 条, 失败 ${errorRecords.length} 条`,
      data: {
        total: data.length,
        success: successRecords.length,
        failed: errorRecords.length,
        successRecords: successRecords.slice(0, 10), // 只返回前10条成功记录
        errorRecords: errorRecords.slice(0, 10) // 只返回前10条错误记录
      }
    });
  } catch (err) {
    console.error('❌ 批量导入失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ========== 智能客服聊天 API ==========

// 规则缓存
let chatRulesCache = null;
let chatRulesCacheTime = 0;
const CHAT_RULES_CACHE_TTL = 60 * 1000; // 1分钟缓存

// 获取规则（带缓存）
async function getChatRules() {
  const now = Date.now();
  if (chatRulesCache && (now - chatRulesCacheTime) < CHAT_RULES_CACHE_TTL) {
    return chatRulesCache;
  }
  try {
    const [rows] = await pool.execute(
      'SELECT id, keywords, response, priority, status, hit_count FROM chat_rules WHERE status = 1 ORDER BY priority DESC, id ASC'
    );
    chatRulesCache = rows;
    chatRulesCacheTime = now;
    return rows;
  } catch (err) {
    console.error('[Chat Rules Cache] 加载失败:', err.message);
    return [];
  }
}

// 清除规则缓存
function clearChatRulesCache() {
  chatRulesCache = null;
  chatRulesCacheTime = 0;
}

// 从请求头提取用户ID（如果存在有效的JWT令牌）
function extractUserIdFromRequest(req) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return null;
    
    const token = authHeader.split(' ')[1];
    if (!token) return null;
    
    // 使用相同的JWT密钥验证令牌（jwt已在文件顶部引入）
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.userId || null;
  } catch (err) {
    // 令牌无效或过期，返回null（不抛出错误，因为聊天API允许匿名访问）
    return null;
  }
}

// 聊天接口
app.post('/api/chat', async (req, res) => {
  let replySource = 'default';
  let matchedRuleId = null;

  try {
    const { message, sessionId, context } = req.body;

    // 检查是否启用
    try {
      const [configRows] = await pool.execute('SELECT enabled FROM chat_basic_config WHERE id = 1');
      if (configRows.length > 0 && !configRows[0].enabled) {
        return res.json({ success: true, reply: '智能客服暂时关闭，请稍后再试。' });
      }
    } catch (e) { /* 配置表可能不存在，忽略 */ }

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, reply: '请输入你的问题。' });
    }

    const text = message.trim();

    // 提取用户ID（如果用户已登录）
    const userId = extractUserIdFromRequest(req);
    
    // 从数据库读取规则
    const rules = await getChatRules();
    for (const rule of rules) {
      const keywords = rule.keywords.split(',').map(k => k.trim()).filter(k => k);
      if (keywords.some(kw => text.includes(kw))) {
        // 命中规则，更新命中计数
        pool.execute('UPDATE chat_rules SET hit_count = hit_count + 1 WHERE id = ?', [rule.id]).catch(() => {});
        replySource = 'rule';
        matchedRuleId = rule.id;
        // 记录日志（包含用户ID）
        logChatMessage(sessionId, userId, text, rule.response, 'rule', rule.id);
        return res.json({ success: true, reply: rule.response });
      }
    }
    
    // 尝试从数据库查询相关专业/院校信息（AI增强版）
    const dbReply = await tryEnhancedDbQuery(text, context, userId);
    if (dbReply) {
      replySource = 'db_enhanced';
      logChatMessage(sessionId, userId, text, dbReply, 'db_enhanced', null);
      return res.json({ success: true, reply: dbReply });
    }

    // 尝试 DeepSeek AI 回复
    const deepseekReply = await tryDeepSeek(text, context);
    if (deepseekReply) {
      replySource = 'deepseek';
      logChatMessage(sessionId, userId, text, deepseekReply, 'deepseek', null);
      return res.json({ success: true, reply: deepseekReply });
    }

    // 默认回复
    const defaultReplies = [
      '这个问题比较复杂，建议你先在首页输入分数进行查询，系统会给出详细的推荐结果。',
      '抱歉，这个问题我还不太确定答案。你可以尝试更具体的提问，比如"怎么选专业"或"冲稳保策略"。',
      '我目前主要擅长高考志愿填报相关的问题，其他问题暂时无法回答哦~'
    ];
    const reply = defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
    logChatMessage(sessionId, userId, text, reply, 'default', null);
    return res.json({ success: true, reply });

  } catch (error) {
    console.error('[Chat API Error]', error.message);
    return res.status(500).json({ success: false, reply: '服务器出了点问题，请稍后再试。' });
  }
});

// 流式聊天接口 - 支持逐字显示
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { message, sessionId, context } = req.body;

    // 检查是否启用
    try {
      const [configRows] = await pool.execute('SELECT enabled FROM chat_basic_config WHERE id = 1');
      if (configRows.length > 0 && !configRows[0].enabled) {
        return res.json({ success: true, reply: '智能客服暂时关闭，请稍后再试。' });
      }
    } catch (e) { /* 配置表可能不存在，忽略 */ }

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, reply: '请输入你的问题。' });
    }

    const text = message.trim();
    const userId = extractUserIdFromRequest(req);

    // 设置 Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 发送数据的辅助函数
    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // 发送错误并结束
    const sendError = (message) => {
      sendEvent({ type: 'error', content: message });
      res.end();
    };

    // 从数据库读取规则
    const rules = await getChatRules();
    for (const rule of rules) {
      const keywords = rule.keywords.split(',').map(k => k.trim()).filter(k => k);
      if (keywords.some(kw => text.includes(kw))) {
        // 命中规则，更新命中计数
        pool.execute('UPDATE chat_rules SET hit_count = hit_count + 1 WHERE id = ?', [rule.id]).catch(() => {});
        // 流式发送回复（一个字一个字）
        await streamText(rule.response, sendEvent);
        logChatMessage(sessionId, userId, text, rule.response, 'rule', rule.id);
        return res.end();
      }
    }
    
    // 尝试从数据库查询
    const dbReply = await tryEnhancedDbQuery(text, context, userId);
    if (dbReply) {
      await streamText(dbReply, sendEvent);
      logChatMessage(sessionId, userId, text, dbReply, 'db_enhanced', null);
      return res.end();
    }

    // 尝试 DeepSeek AI 流式回复
    const deepseekSuccess = await tryDeepSeekStream(text, context, sendEvent);
    if (deepseekSuccess) {
      logChatMessage(sessionId, userId, text, '[流式回复]', 'deepseek', null);
      return res.end();
    }

    // 默认回复
    const defaultReplies = [
      '这个问题比较复杂，建议你先在首页输入分数进行查询，系统会给出详细的推荐结果。',
      '抱歉，这个问题我还不太确定答案。你可以尝试更具体的提问，比如"怎么选专业"或"冲稳保策略"。',
      '我目前主要擅长高考志愿填报相关的问题，其他问题暂时无法回答哦~'
    ];
    const reply = defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
    await streamText(reply, sendEvent);
    logChatMessage(sessionId, userId, text, reply, 'default', null);
    res.end();

  } catch (error) {
    console.error('[Chat Stream API Error]', error.message);
    res.write(`data: ${JSON.stringify({ type: 'error', content: '服务器出了点问题，请稍后再试。' })}\n\n`);
    res.end();
  }
});

// 流式发送文本（一个字一个字）
async function streamText(text, sendEvent) {
  // 发送开始信号
  sendEvent({ type: 'start' });
  
  // 逐字发送
  for (let i = 0; i < text.length; i++) {
    sendEvent({ type: 'char', content: text[i] });
    // 添加小延迟，让显示效果更明显
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  
  // 发送完成信号
  sendEvent({ type: 'end' });
}

// DeepSeek 流式回复
async function tryDeepSeekStream(text, context, sendEvent) {
  try {
    // 读取 DeepSeek 配置
    const [configRows] = await pool.execute(
      'SELECT deepseek_enabled, deepseek_api_key, deepseek_model FROM chat_basic_config WHERE id = 1'
    );
    if (!configRows.length || !configRows[0].deepseek_enabled || !configRows[0].deepseek_api_key) {
      return false;
    }

    const apiKey = configRows[0].deepseek_api_key;
    const model = configRows[0].deepseek_model || 'deepseek-chat';

    // 构建系统提示词
    const systemPrompt = `你是"权鼎教育"的高考志愿填报智能助手，名字叫"权鼎小助手"。你的职责是：
1. 回答用户关于高考志愿填报的问题，包括选科、专业选择、院校对比、录取分数线、位次分析、冲稳保策略等。
2. 给出专业、客观、实用的建议，帮助考生和家长做出更好的选择。
3. 如果用户问的问题与高考志愿填报无关，礼貌地引导回相关话题。
4. 回复要简洁明了，使用要点式回答，避免过长的段落。
5. 【重要】关于具体院校和专业是否存在、录取分数线、招生计划等事实性问题，必须以系统数据库查询结果为准。如果数据库中没有查询到相关数据，必须明确告知用户"系统中暂未找到该院校/专业的数据"，绝对禁止编造或推测任何具体数据。
6. 对于通用性建议（如填报策略、选科建议等），可以基于你的知识回答，但涉及具体数值时必须注明"请以系统查询结果为准"。`;

    // 构建消息列表
    const messages = [
      { role: 'system', content: systemPrompt },
    ];

    // 如果有上下文对话历史，加入
    if (context && Array.isArray(context) && context.length > 0) {
      const recentContext = context.slice(-6);
      recentContext.forEach(function(msg) {
        messages.push({ role: msg.role || 'user', content: msg.content });
      });
    }

    // 添加当前用户消息
    messages.push({ role: 'user', content: text });

    // 调用 DeepSeek API（流式）
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 500,
        temperature: 0.7,
        stream: true  // 启用流式
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[DeepSeek Stream API] 请求失败:', response.status, errText);
      return false;
    }

    // 发送开始信号
    sendEvent({ type: 'start' });

    // 读取流式数据
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // 处理 SSE 格式的数据
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            sendEvent({ type: 'end' });
            return true;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
              const char = parsed.choices[0].delta.content;
              sendEvent({ type: 'char', content: char });
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

    sendEvent({ type: 'end' });
    return true;

  } catch (err) {
    console.error('[DeepSeek Stream API] 调用异常:', err.message);
    return false;
  }
}

// 记录聊天日志
function logChatMessage(sessionId, userId, userMessage, botReply, source, ruleId) {
  pool.execute(
    'INSERT INTO chat_logs (session_id, user_id, user_message, bot_reply, source, matched_rule_id) VALUES (?, ?, ?, ?, ?, ?)',
    [sessionId || null, userId || null, userMessage, botReply, source, ruleId]
  ).catch(err => console.error('[Chat Log] 记录失败:', err.message));
}

// 数据库辅助查询
async function tryDbQuery(text, context) {
  try {
    // ========== 新增：解析推荐查询（省份+分数+选科）==========
    const recommendResult = await tryParseRecommend(text);
    if (recommendResult) {
      return recommendResult;
    }
    // ========================================================

    // 原有逻辑：查询学校信息
    let searchName = text
      .replace(/什么|哪个|哪个大学|学校|院校|怎么样|好不好|介绍|了解|查|查查|看看|一下|的|了|吗|呢|啊/g, '')
      .trim();

    if (searchName.length >= 2 && searchName.length <= 20) {
      const [rows] = await pool.execute(
        `SELECT DISTINCT school_name, province, school_type, school_level 
         FROM admission 
         WHERE school_name LIKE ? 
         LIMIT 1`,
        [`%${searchName}%`]
      );

      if (rows.length > 0) {
        const school = rows[0];
        return `${school.school_name}（${school.province || ''}）\n类型：${school.school_type || '暂无'}\n层次：${school.school_level || '暂无'}\n\n你可以在首页输入分数查询该院校的具体录取数据和匹配专业！`;
      }
    }

    // 原有逻辑：查询专业信息
    let majorName = text
      .replace(/什么|哪个|专业|介绍|怎么样|好不好|了解|查|查查|看看|一下|的|了|吗|呢|啊|学/g, '')
      .trim();

    if (majorName.length >= 2 && majorName.length <= 20) {
      const [rows] = await pool.execute(
        `SELECT DISTINCT major_name, major_category 
         FROM admission 
         WHERE major_name LIKE ? 
         LIMIT 1`,
        [`%${majorName}%`]
      );

      if (rows.length > 0) {
        const major = rows[0];
        return `${major.major_name}\n专业类：${major.major_category || '暂无'}\n\n你可以点击"专业名录"查看更多专业详情，或在首页查询开设该专业的院校！`;
      }
    }

    return null;
  } catch (err) {
    console.error('[DB Query for Chat]', err.message);
    return null;
  }
}

// ========== 新增：解析推荐查询函数 ==========
async function tryParseRecommend(text) {
  // 省份列表
  const provinces = ['北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江', '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '广西', '海南', '重庆', '四川', '贵州', '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆'];
  
  // 科目列表
  const subjects = ['物理', '化学', '生物', '历史', '政治', '地理', '技术'];
  // 科目缩写映射
  const subjectAbbr = {
    '物': '物理',
    '化': '化学', 
    '生': '生物',
    '史': '历史',
    '政': '政治',
    '地': '地理',
    '技': '技术'
  };
  
  // 解析省份
  let province = null;
  for (const p of provinces) {
    if (text.includes(p)) {
      province = p;
      break;
    }
  }
  
  // 解析分数（匹配数字）
  let score = null;
  const scoreMatch = text.match(/(\d{2,3})\s*[分档]?/);
  if (scoreMatch) {
    score = parseInt(scoreMatch[1], 10);
    if (score < 100 || score > 800) {
      score = null;
    }
  }
  
  // 解析选科组合
  let selectedSubjects = [];
  // 先检查完整科目名称
  for (const s of subjects) {
    if (text.includes(s)) {
      selectedSubjects.push(s);
    }
  }
  // 如果未找到完整名称，检查缩写
  if (selectedSubjects.length === 0) {
    for (const [abbr, full] of Object.entries(subjectAbbr)) {
      if (text.includes(abbr)) {
        selectedSubjects.push(full);
      }
    }
  }
  
  // 判断是否为推荐查询：需要省份+分数，或省份+选科，或分数+选科
  const hasProvince = province !== null;
  const hasScore = score !== null;
  const hasSubjects = selectedSubjects.length >= 1;
  
  // 必须有省份和分数，或至少有省份和选科
  if (!hasProvince) return null;
  if (!hasScore && !hasSubjects) return null;
  
  // 如果没有分数但有选科，设置默认分数（基于选科推测）
  if (!hasScore && hasSubjects) {
    // 默认给500分
    score = 500;
  }
  
  // 如果没有选科但有省份，设置默认选科（物理+化学+生物或历史+政治+地理）
  if (!hasSubjects) {
    // 默认为物理组合
    selectedSubjects = ['物理', '化学', '生物'];
  }
  
  console.log(`[推荐解析] 省份: ${province}, 分数: ${score}, 选科: ${selectedSubjects.join(',')}`);
  
  try {
    // 调用推荐查询逻辑
    const result = await queryRecommendations(province, score, selectedSubjects.join(','), 'score');
    if (result && result.length > 0) {
      return formatRecommendResponse(result, province, score, selectedSubjects);
    }
  } catch (err) {
    console.error('[推荐查询失败]', err.message);
  }
  
  return null;
}

// 从 admission_plan 表查询推荐院校
async function queryRecommendations(sourceProvince, score, subjectCombination, scoreMode) {
  const subjects = subjectCombination.split(',').map(s => s.trim()).filter(s => s);
  
  // 判断是否为3+3模式
  const mode33Provinces = ['北京', '天津', '上海', '山东', '浙江', '海南'];
  const is33Mode = mode33Provinces.includes(sourceProvince);
  
  // 判断是否为传统文理分科模式
  const traditionalProvinces = ['西藏', '新疆'];
  const isTraditionalMode = traditionalProvinces.includes(sourceProvince);
  
  // 确定查询条件：使用分数范围（向下5分）
  const whereCondition = `AND COALESCE(group_min_score_1, min_score_1) >= ? AND COALESCE(group_min_score_1, min_score_1) <= ?`;
  const orderCondition = `COALESCE(group_min_score_1, min_score_1) DESC`;
  const rangeParams = [Math.max(score - 5, 0), score];
  
  let query, queryParams;
  
  if (is33Mode) {
    // 3+3 模式查询
    const pairs2 = [];
    for (let i = 0; i < subjects.length; i++) {
      for (let j = 0; j < subjects.length; j++) {
        if (i !== j) {
          pairs2.push(`${subjects[i]}和${subjects[j]}`);
        }
      }
    }
    const singles = subjects;
    
    query = `
      SELECT
        college_name, major_name,
        group_min_score_1, min_score_1 AS min_score,
        min_rank_1 AS min_rank, subject_require,
        batch, major_category,
        COALESCE(group_min_score_1, min_score_1) AS effective_score
      FROM admission_plan
      WHERE source_province = ?
        ${whereCondition}
        AND (
          subject_require IN (${pairs2.map(() => '?').join(',')})
          OR subject_require IN (${singles.map(() => '?').join(',')})
          OR subject_require = '不限'
          OR subject_require IS NULL
          OR subject_require = ''
        )
      ORDER BY effective_score DESC
      LIMIT 100
    `;
    
    queryParams = [sourceProvince, ...rangeParams, ...pairs2, ...singles];
    
  } else if (isTraditionalMode) {
    // 传统文理分科模式
    const subjectType = subjects[0] === '历史' ? '历史' : '物理';
    
    query = `
      SELECT
        college_name, major_name,
        min_score_1 AS min_score, min_rank_1 AS min_rank,
        subject_type, batch, major_category,
        COALESCE(group_min_score_1, min_score_1) AS effective_score
      FROM admission_plan
      WHERE source_province = ?
        AND subject_type = ?
        ${whereCondition}
      ORDER BY effective_score DESC
      LIMIT 100
    `;
    
    queryParams = [sourceProvince, subjectType, ...rangeParams];
    
  } else {
    // 3+1+2 模式
    const requiredSubject = subjects[0] || '物理';
    const optional1 = subjects[1] || '';
    const optional2 = subjects[2] || '';
    
    let subjectType = requiredSubject === '历史' ? '历史' : '物理';
    
    const subjectRequireConditions = [];
    const subjectRequireParams = [];
    
    // 三科组合
    if (optional1 && optional2) {
      subjectRequireConditions.push(`subject_require IN (?, ?, ?, ?, ?, ?)`);
      subjectRequireParams.push(
        `${requiredSubject}和${optional1}和${optional2}`,
        `${requiredSubject}和${optional2}和${optional1}`,
        `${optional1}和${requiredSubject}和${optional2}`,
        `${optional2}和${requiredSubject}和${optional1}`,
        `${optional1}和${optional2}和${requiredSubject}`,
        `${optional2}和${optional1}和${requiredSubject}`
      );
    }
    
    // 两科组合
    const pairs = [];
    if (optional1) {
      pairs.push(`${requiredSubject}和${optional1}`);
      pairs.push(`${optional1}和${requiredSubject}`);
    }
    if (optional2) {
      pairs.push(`${requiredSubject}和${optional2}`);
      pairs.push(`${optional2}和${requiredSubject}`);
    }
    if (optional1 && optional2) {
      pairs.push(`${optional1}和${optional2}`);
      pairs.push(`${optional2}和${optional1}`);
    }
    if (pairs.length > 0) {
      subjectRequireConditions.push(`subject_require IN (${pairs.map(() => '?').join(',')})`);
      subjectRequireParams.push(...pairs);
    }
    
    // 单科
    const singleSubjects = [requiredSubject];
    if (optional1) singleSubjects.push(optional1);
    if (optional2) singleSubjects.push(optional2);
    subjectRequireConditions.push(`subject_require IN (${singleSubjects.map(() => '?').join(',')})`);
    subjectRequireParams.push(...singleSubjects);
    
    // 不限
    subjectRequireConditions.push(`subject_require = '不限'`);
    
    const subjectRequireClause = `AND (${subjectRequireConditions.join(' OR ')})`;
    
    query = `
      SELECT
        college_name, major_name,
        group_min_score_1, min_score_1 AS min_score,
        min_rank_1 AS min_rank, subject_require,
        batch, major_category,
        COALESCE(group_min_score_1, min_score_1) AS effective_score
      FROM admission_plan
      WHERE source_province = ?
        AND subject_type = ?
        ${subjectRequireClause}
        ${whereCondition}
      ORDER BY effective_score DESC
      LIMIT 100
    `;
    
    queryParams = [sourceProvince, subjectType, ...subjectRequireParams, ...rangeParams];
  }
  
  console.log(`[queryRecommendations] 执行查询: ${query}`);
  console.log(`[queryRecommendations] 参数:`, queryParams);
  const [rows] = await pool.execute(query, queryParams);
  console.log(`[queryRecommendations] 查询: ${sourceProvince}, 分数: ${score}, 选科: ${subjectCombination}, 结果数: ${rows.length}`);
  return rows;
}

// 格式化推荐结果
function formatRecommendResponse(rows, province, score, subjects) {
  if (!rows || rows.length === 0) {
    return `在${province}省，针对${score}分${subjects.join('')}组合，暂时没有找到匹配的院校数据。\n\n建议：\n1. 尝试调整分数或选科组合\n2. 在首页输入分数进行更精确的查询`;
  }
  
  let response = `📊 ${province}省 ${score}分 ${subjects.join('')}组合 推荐院校：\n\n`;
  
  // 按学校分组展示
  const schoolMap = new Map();
  rows.forEach(row => {
    const schoolName = row.college_name;
    if (!schoolMap.has(schoolName)) {
      schoolMap.set(schoolName, []);
    }
    schoolMap.get(schoolName).push(row);
  });
  
  // 最多展示5所学校
  const schools = Array.from(schoolMap.entries()).slice(0, 5);
  
  schools.forEach(([schoolName, majors], index) => {
    const topMajor = majors[0];
    const scoreDisplay = topMajor.group_min_score_1 || topMajor.min_score || '暂无';
    const batchDisplay = topMajor.batch || '本科批';
    
    response += `${index + 1}. 🏫 ${schoolName}\n`;
    response += `   📈 录取最低分：${scoreDisplay} | ${batchDisplay}\n`;
    response += `   📚 选科要求：${topMajor.subject_require || '不限'}\n`;
    
    // 显示该校的几个专业
    if (majors.length > 1) {
      const majorNames = majors.slice(0, 2).map(m => m.major_name).join('、');
      response += `   🔧 相关专业：${majorNames}等\n`;
    } else if (majors[0].major_name) {
      response += `   🔧 专业：${majors[0].major_name}\n`;
    }
    response += '\n';
  });
  
  response += `💡 以上为根据你的分数和选科推荐的院校，实际录取情况请以招生考试院公布为准。`;

  return response;
}

// 根据选科推荐专业
async function queryMajorRecommendations(subjectCombination) {
  const subjects = subjectCombination.split(',').map(s => s.trim()).filter(s => s);

  // 构建选科匹配条件
  let subjectRequireConditions = [];
  let subjectRequireParams = [];

  // 三科组合(3+3模式)
  if (subjects.length === 3) {
    const pairs2 = [];
    for (let i = 0; i < subjects.length; i++) {
      for (let j = 0; j < subjects.length; j++) {
        if (i !== j) {
          pairs2.push(`${subjects[i]}和${subjects[j]}`);
        }
      }
    }

    subjectRequireConditions.push(`subject_require IN (${pairs2.map(() => '?').join(',')})`);
    subjectRequireParams.push(...pairs2);
  }
  // 两科组合(3+1+2模式)
  else if (subjects.length === 2) {
    const pair = `${subjects[0]}和${subjects[1]}`;
    subjectRequireConditions.push(`subject_require = ?`);
    subjectRequireParams.push(pair);
  }
  // 单科组合
  else if (subjects.length === 1) {
    subjectRequireConditions.push(`subject_require = ?`);
    subjectRequireParams.push(subjects[0]);
  }

  // 查询匹配的专业
  const query = `
    SELECT
      mi.major_name,
      mi.major_category,
      mi.introduction,
      ap.min_score_1,
      ap.school_count
    FROM major_info mi
    LEFT JOIN (
      SELECT
        major_name,
        MIN(min_score_1) AS min_score_1,
        COUNT(DISTINCT college_name) AS school_count
      FROM admission_plan
      WHERE ${subjectRequireConditions.join(' OR ')}
      GROUP BY major_name
    ) ap ON mi.major_name COLLATE utf8mb4_unicode_ci = ap.major_name COLLATE utf8mb4_unicode_ci
    WHERE 1=1
    ORDER BY ap.school_count DESC, mi.major_name ASC
    LIMIT 15
  `;

  try {
    const [rows] = await pool.execute(query, subjectRequireParams);
    console.log(`[queryMajorRecommendations] 返回 ${rows.length} 个专业`);

    // 按专业类分组
    const categoryMap = new Map();
    rows.forEach(row => {
      const category = row.major_category || '其他';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category).push(row);
    });

    // 格式化返回
    const result = [];
    categoryMap.forEach((majors, category) => {
      result.push({
        category: category,
        majors: majors.slice(0, 3) // 每类最多3个专业
      });
    });

    return result;
  } catch (error) {
    console.error('[queryMajorRecommendations] 查询失败:', error.message);
    return null;
  }
}

// ========== AI增强智能助手核心函数 ==========

// 个性化上下文管理器
class PersonalizationManager {
  constructor(userId) {
    this.userId = userId;
    this.profile = {
      preferences: {},      // 用户偏好
      history: [],         // 历史交互
      patterns: {}         // 行为模式
    };
  }
  
  async loadUserProfile() {
    try {
      // 从数据库加载用户历史行为
      const [history] = await pool.execute(`
        SELECT behavior_type, behavior_data, created_at 
        FROM user_behaviors 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 50
      `, [this.userId]);
      
      // 分析用户偏好
      this.profile.preferences = this.analyzePreferences(history);
      this.profile.patterns = this.extractPatterns(history);
      this.profile.history = history;
      
      return this.profile;
    } catch (err) {
      console.error('[PersonalizationManager] 加载用户资料失败:', err.message);
      return this.profile;
    }
  }
  
  analyzePreferences(history) {
    const regionPref = this.extractRegionPreference(history);
    const majorPref = this.extractMajorPreference(history);
    const schoolTypePref = this.extractSchoolTypePreference(history);
    const batchPref = this.extractBatchPreference(history);
    
    return {
      region: regionPref,
      major: majorPref,
      schoolType: schoolTypePref,
      batch: batchPref
    };
  }
  
  extractRegionPreference(history) {
    const regionCounts = {};
    history.forEach(record => {
      try {
        const data = JSON.parse(record.behavior_data || '{}');
        if (data.region) {
          regionCounts[data.region] = (regionCounts[data.region] || 0) + 1;
        }
      } catch (e) {}
    });
    
    // 返回出现次数最多的地区
    const sorted = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : null;
  }
  
  extractMajorPreference(history) {
    const majorCounts = {};
    history.forEach(record => {
      try {
        const data = JSON.parse(record.behavior_data || '{}');
        if (data.majorPreference) {
          majorCounts[data.majorPreference] = (majorCounts[data.majorPreference] || 0) + 1;
        }
      } catch (e) {}
    });
    
    const sorted = Object.entries(majorCounts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : null;
  }
  
  extractSchoolTypePreference(history) {
    const typeCounts = {};
    history.forEach(record => {
      try {
        const data = JSON.parse(record.behavior_data || '{}');
        if (data.categoryFilter) {
          typeCounts[data.categoryFilter] = (typeCounts[data.categoryFilter] || 0) + 1;
        }
      } catch (e) {}
    });
    
    const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : null;
  }
  
  extractBatchPreference(history) {
    const batchCounts = {};
    history.forEach(record => {
      try {
        const data = JSON.parse(record.behavior_data || '{}');
        if (data.batchFilter) {
          batchCounts[data.batchFilter] = (batchCounts[data.batchFilter] || 0) + 1;
        }
      } catch (e) {}
    });
    
    const sorted = Object.entries(batchCounts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : null;
  }
  
  extractPatterns(history) {
    const patterns = {
      searchFrequency: history.filter(h => h.behavior_type === 'search').length,
      recommendationFrequency: history.filter(h => h.behavior_type === 'recommend').length,
      lastActive: history.length > 0 ? history[0].created_at : null
    };
    return patterns;
  }
  
  // 获取用户上下文信息
  getUserContext() {
    return {
      preferences: this.profile.preferences,
      patterns: this.profile.patterns,
      hasHistory: this.profile.history.length > 0
    };
  }
}

// AI辅助意图分析
async function analyzeIntentWithAI(text, context, userId = null) {
  try {
    // 1. 如果用户ID不为空，加载用户个性化资料
    let userProfile = null;
    if (userId) {
      const pm = new PersonalizationManager(userId);
      userProfile = await pm.loadUserProfile();
    }
    
    // 2. 构建AI意图分析提示词
    const systemPrompt = `你是高考志愿填报专家，需要分析用户问题意图。
用户问题："${text}"
${userId ? '这是已登录用户，请考虑个性化推荐。' : '这是未登录用户，提供通用建议。'}
${userProfile ? `用户历史偏好：地区偏好=${userProfile.preferences.region || '无'}，专业偏好=${userProfile.preferences.major || '无'}` : ''}

请分析：
1. 主要意图（recommend/rank_conversion/school_info/major_info/strategy/score_line/general）
2. 关键参数（省份、分数、选科、院校名、专业名等）
3. 隐含需求（如：担心就业、考虑地区、预算限制等）

以JSON格式返回分析结果，格式：
{
  "type": "recommend",
  "confidence": 0.8,
  "params": {
    "province": "河南",
    "score": 550,
    "selectedSubjects": ["物理", "化学", "生物"]
  },
  "hiddenNeeds": ["考虑就业前景", "偏好大城市"]
}`;
    
    // 3. 调用DeepSeek AI进行意图分析
    const [configRows] = await pool.execute(
      'SELECT deepseek_enabled, deepseek_api_key, deepseek_model FROM chat_basic_config WHERE id = 1'
    );
    
    if (!configRows.length || !configRows[0].deepseek_enabled || !configRows[0].deepseek_api_key) {
      // AI未启用，使用规则匹配
      return await analyzeIntentWithRules(text, userProfile);
    }
    
    const apiKey = configRows[0].deepseek_api_key;
    const model = configRows[0].deepseek_model || 'deepseek-chat';
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ];
    
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 500,
        temperature: 0.3, // 较低温度以获得更确定的输出
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      console.error('[AI Intent Analysis] API请求失败:', response.status);
      return await analyzeIntentWithRules(text, userProfile);
    }
    
    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      try {
        const result = JSON.parse(data.choices[0].message.content.trim());
        // 添加用户上下文信息
        result.userContext = userProfile ? {
          preferences: userProfile.preferences || {},
          patterns: userProfile.patterns || {},
          hasHistory: userProfile.history && userProfile.history.length > 0
        } : null;
        return result;
      } catch (parseErr) {
        console.error('[AI Intent Analysis] JSON解析失败:', parseErr.message);
        return await analyzeIntentWithRules(text, userProfile);
      }
    }
    
    return await analyzeIntentWithRules(text, userProfile);
    
  } catch (err) {
    console.error('[AI Intent Analysis] 异常:', err.message);
    return await analyzeIntentWithRules(text, null);
  }
}

// 规则匹配意图分析（AI备用方案）
async function analyzeIntentWithRules(text, userProfile) {
  const lowerText = text.toLowerCase();
  
  // 省份列表
  const provinces = ['北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江', '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '广西', '海南', '重庆', '四川', '贵州', '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆'];
  
  // 科目列表
  const subjects = ['物理', '化学', '生物', '历史', '政治', '地理', '技术'];
  // 科目缩写映射
  const subjectAbbr = {
    '物': '物理',
    '化': '化学', 
    '生': '生物',
    '史': '历史',
    '政': '政治',
    '地': '地理',
    '技': '技术'
  };
  
  // 1. 推荐查询意图
  if (/(推荐|能上|适合|什么学校|多少分|考多少|报什么)/.test(lowerText)) {
    let province = null;
    for (const p of provinces) {
      if (text.includes(p)) {
        province = p;
        break;
      }
    }
    
    let score = null;
    const scoreMatch = text.match(/(\d{2,3})\s*[分档]?/);
    if (scoreMatch) {
      const s = parseInt(scoreMatch[1], 10);
      if (s >= 100 && s <= 800) score = s;
    }
    
    let selectedSubjects = [];
    // 先检查完整科目名称
    for (const s of subjects) {
      if (text.includes(s)) selectedSubjects.push(s);
    }
    // 如果未找到完整名称，检查缩写
    if (selectedSubjects.length === 0) {
      for (const [abbr, full] of Object.entries(subjectAbbr)) {
        if (text.includes(abbr)) {
          selectedSubjects.push(full);
        }
      }
    }
    
    // 如果没有省份但有用户历史偏好，使用偏好省份
    if (!province && userProfile && userProfile.preferences.region) {
      province = userProfile.preferences.region;
    }
    
    if (province && (score !== null || selectedSubjects.length > 0)) {
      return {
        type: 'recommend',
        confidence: 0.7,
        params: {
          province,
          score: score || (selectedSubjects.length > 0 ? 500 : null),
          selectedSubjects: selectedSubjects.length > 0 ? selectedSubjects : ['物理', '化学', '生物']
        },
        userContext: userProfile ? {
          preferences: userProfile.preferences || {},
          patterns: userProfile.patterns || {},
          hasHistory: userProfile.history && userProfile.history.length > 0
        } : null
      };
    }
  }
  
  // 2. 位次换算意图
  if (/(位次|换算|对应|排名|排位)/.test(lowerText)) {
    const numMatch = text.match(/\b(\d{2,6})\b/);
    const num = numMatch ? parseInt(numMatch[1], 10) : null;
    
    const isScore = (num && num <= 800) || text.includes('分');
    const isRank = (num && num > 800) || text.includes('位次');
    
    let province = null;
    for (const p of provinces) {
      if (text.includes(p)) {
        province = p;
        break;
      }
    }
    
    // 如果没有省份但有用户历史偏好，使用偏好省份
    if (!province && userProfile && userProfile.preferences.region) {
      province = userProfile.preferences.region;
    }
    
    let selectedSubjects = [];
    // 先检查完整科目名称
    for (const s of subjects) {
      if (text.includes(s)) selectedSubjects.push(s);
    }
    // 如果未找到完整名称，检查缩写
    if (selectedSubjects.length === 0) {
      for (const [abbr, full] of Object.entries(subjectAbbr)) {
        if (text.includes(abbr)) {
          selectedSubjects.push(full);
        }
      }
    }
    
    return {
      type: 'rank_conversion',
      confidence: 0.6,
      params: {
        value: num,
        valueType: isScore ? 'score' : (isRank ? 'rank' : 'unknown'),
        province,
        subjects: selectedSubjects.length > 0 ? selectedSubjects : []
      },
      userContext: userProfile ? {
        preferences: userProfile.preferences || {},
        patterns: userProfile.patterns || {},
        hasHistory: userProfile.history && userProfile.history.length > 0
      } : null
    };
  }
  
  // 3. 院校信息意图
  if (/(学校|大学|学院|怎么样|好不好|介绍)/.test(lowerText)) {
    // 简单的院校名称提取（去除常见疑问词）
    let schoolName = text
      .replace(/什么|哪个|哪个大学|学校|院校|怎么样|好不好|介绍|了解|查|查查|看看|一下|的|了|吗|呢|啊/g, '')
      .trim();
    
    if (schoolName.length >= 2 && schoolName.length <= 20) {
      return {
        type: 'school_info',
        confidence: 0.5,
        params: { schoolName },
        userContext: userProfile ? {
          preferences: userProfile.preferences || {},
          patterns: userProfile.patterns || {},
          hasHistory: userProfile.history && userProfile.history.length > 0
        } : null
      };
    }
  }
  
  // 4. 专业信息意图
  if (/(专业|学什么|就业|前景|课程)/.test(lowerText)) {
    let majorName = text
      .replace(/什么|哪个|专业|介绍|怎么样|好不好|了解|查|查查|看看|一下|的|了|吗|呢|啊|学/g, '')
      .trim();
    
    if (majorName.length >= 2 && majorName.length <= 20) {
      return {
        type: 'major_info',
        confidence: 0.5,
        params: { majorName },
        userContext: userProfile ? {
          preferences: userProfile.preferences || {},
          patterns: userProfile.patterns || {},
          hasHistory: userProfile.history && userProfile.history.length > 0
        } : null
      };
    }
  }
  
  // 5. 策略咨询意图
  if (/(冲稳保|志愿填报|策略|怎么填|顺序|填报技巧)/.test(lowerText)) {
    return {
      type: 'strategy',
      confidence: 0.8,
      params: {},
      userContext: userProfile ? {
        preferences: userProfile.preferences || {},
        patterns: userProfile.patterns || {},
        hasHistory: userProfile.history && userProfile.history.length > 0
      } : null
    };
  }
  
  // 6. 分数线查询意图
  if (/(分数线|录取分数|最低分|往年分数)/.test(lowerText)) {
    let province = null;
    for (const p of provinces) {
      if (text.includes(p)) {
        province = p;
        break;
      }
    }
    
    // 如果没有省份但有用户历史偏好，使用偏好省份
    if (!province && userProfile && userProfile.preferences.region) {
      province = userProfile.preferences.region;
    }
    
    let schoolName = text.replace(/分数线|录取分数|最低分|往年分数|的|了|吗|呢|啊/g, '').trim();
    
    return {
      type: 'score_line',
      confidence: 0.6,
      params: {
        province,
        schoolName: schoolName || null
      },
      userContext: userProfile ? {
        preferences: userProfile.preferences || {},
        patterns: userProfile.patterns || {},
        hasHistory: userProfile.history && userProfile.history.length > 0
      } : null
    };
  }
  
  // 7. 一般问题
  return {
    type: 'general',
    confidence: 0.3,
    params: {},
    userContext: userProfile ? {
      preferences: userProfile.preferences || {},
      patterns: userProfile.patterns || {},
      hasHistory: userProfile.history && userProfile.history.length > 0
    } : null
  };
}

// AI增强结果处理器
async function enhanceResultsWithAI(rawResults, intent, userContext) {
  try {
    // 1. 如果没有AI配置或用户选择不增强，直接返回原始结果
    const [configRows] = await pool.execute(
      'SELECT deepseek_enabled, deepseek_api_key FROM chat_basic_config WHERE id = 1'
    );
    
    if (!configRows.length || !configRows[0].deepseek_enabled || !configRows[0].deepseek_api_key) {
      return { data: rawResults, insights: null, personalizedTips: null };
    }
    
    // 2. 构建AI增强提示词
    const systemPrompt = `你是一个高考志愿填报专家，需要基于查询结果为用户提供个性化分析和建议。

【重要约束】你收到的"查询结果"全部来自系统数据库，是事实性数据。你的分析和建议必须严格基于这些查询结果，绝对禁止编造、推测或补充任何不在查询结果中的具体数据（如院校名称、专业名称、分数线、招生计划等）。

用户查询意图：${intent.type}
${intent.params.province ? `用户省份：${intent.params.province}` : ''}
${intent.params.score ? `用户分数：${intent.params.score}` : ''}
${intent.params.selectedSubjects ? `用户选科：${intent.params.selectedSubjects.join(',')}` : ''}
${userContext ? `用户历史偏好：${JSON.stringify(userContext.preferences, null, 2)}` : ''}

查询结果（来自数据库的事实数据）：
${JSON.stringify(rawResults, null, 2)}

请基于上述查询结果提供：
1. 3个关键洞察（机会、风险、建议）
2. 2个个性化提醒（基于用户历史偏好）
3. 1个后续行动建议

用通俗易懂的语言回复，格式如下：
【关键洞察】
1. 机会：...
2. 风险：...
3. 建议：...

【个性化提醒】
1. ...
2. ...

【后续行动】
...`;
    
    const apiKey = configRows[0].deepseek_api_key;
    const model = configRows[0].deepseek_model || 'deepseek-chat';
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请分析这些结果并提供建议。' }
    ];
    
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 800,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      console.error('[AI Results Enhancement] API请求失败:', response.status);
      return { data: rawResults, insights: null, personalizedTips: null };
    }
    
    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      const aiAnalysis = data.choices[0].message.content.trim();
      
      // 3. 生成个性化提示
      let personalizedTips = null;
      if (userContext && userContext.preferences) {
        personalizedTips = generatePersonalizedTips(userContext, rawResults);
      }
      
      return {
        data: rawResults,
        insights: aiAnalysis,
        personalizedTips: personalizedTips
      };
    }
    
    return { data: rawResults, insights: null, personalizedTips: null };
    
  } catch (err) {
    console.error('[AI Results Enhancement] 异常:', err.message);
    return { data: rawResults, insights: null, personalizedTips: null };
  }
}

// 生成个性化提示
function generatePersonalizedTips(userContext, results) {
  const tips = [];
  
  if (userContext.preferences.region && results.length > 0) {
    // 检查结果中是否有用户偏好地区的院校
    const hasPreferredRegion = results.some(r => r.province === userContext.preferences.region);
    if (hasPreferredRegion) {
      tips.push(`📌 根据你的历史查询，我发现你常关注${userContext.preferences.region}地区的院校，结果中有符合你偏好的选项。`);
    } else {
      tips.push(`💡 你通常查询${userContext.preferences.region}地区的院校，但本次结果中没有该地区的选项，可以考虑调整筛选条件。`);
    }
  }
  
  if (userContext.preferences.major && results.length > 0) {
    // 检查结果中是否有用户偏好专业的院校
    const hasPreferredMajor = results.some(r => 
      r.major_name && r.major_name.includes(userContext.preferences.major)
    );
    if (hasPreferredMajor) {
      tips.push(`🎯 你之前关注过${userContext.preferences.major}相关专业，结果中有匹配的专业方向。`);
    }
  }
  
  if (userContext.patterns && userContext.patterns.searchFrequency > 10) {
    tips.push(`🔍 看起来你经常查询志愿信息，建议收藏感兴趣的院校方便后续比较。`);
  }
  
  return tips.length > 0 ? tips : null;
}

// 增强的数据库查询（AI辅助）
async function tryEnhancedDbQuery(text, context, userId = null) {
  try {
    // 1. 意图分析（AI辅助）
    const intent = await analyzeIntentWithAI(text, context, userId);
    
    console.log(`[tryEnhancedDbQuery] 意图分析结果:`, JSON.stringify(intent));
    
    // 2. 根据意图调用相应功能
    let rawResults = null;
    switch (intent.type) {
      case 'recommend':
        if (intent.params.province && intent.params.score !== null) {
          const subjectStr = (intent.params.selectedSubjects || []).join(',');
          console.log(`[tryEnhancedDbQuery] 调用queryRecommendations, 参数: province=${intent.params.province}, score=${intent.params.score}, subjects=${subjectStr}`);
          rawResults = await queryRecommendations(intent.params.province, intent.params.score, subjectStr, 'score');
          console.log(`[tryEnhancedDbQuery] queryRecommendations返回结果数:`, rawResults ? rawResults.length : 0);
        } else if (intent.params.selectedSubjects && intent.params.selectedSubjects.length > 0) {
          // 专门推荐专业(根据选科)
          const subjectStr = intent.params.selectedSubjects.join(',');
          console.log(`[tryEnhancedDbQuery] 调用queryMajorRecommendations, 参数: subjects=${subjectStr}`);
          rawResults = await queryMajorRecommendations(subjectStr);
          console.log(`[tryEnhancedDbQuery] queryMajorRecommendations返回结果数:`, rawResults ? rawResults.length : 0);
        }
        break;
        
      case 'rank_conversion':
        // 位次换算逻辑
        if (intent.params.value && intent.params.province) {
          // 这里可以调用现有的位次换算API逻辑
          // 简化处理：返回提示信息
          rawResults = { type: 'rank_conversion', params: intent.params };
        }
        break;
        
      case 'school_info':
        if (intent.params.schoolName) {
          const [rows] = await pool.execute(
            `SELECT DISTINCT school_name, province, school_type, school_level 
             FROM admission 
             WHERE school_name LIKE ? 
             LIMIT 5`,
            [`%${intent.params.schoolName}%`]
          );
          rawResults = rows;
        }
        break;
        
      case 'major_info':
        if (intent.params.majorName) {
          const [rows] = await pool.execute(
            `SELECT DISTINCT major_name, major_category 
             FROM admission 
             WHERE major_name LIKE ? 
             LIMIT 5`,
            [`%${intent.params.majorName}%`]
          );
          rawResults = rows;
        }
        break;
        
      case 'strategy':
        // 策略知识库
        rawResults = { type: 'strategy', content: getStrategyContent() };
        break;
        
      case 'score_line':
        // 分数线查询
        if (intent.params.schoolName) {
          const [rows] = await pool.execute(
            `SELECT college_name, major_name, min_score_1, batch, year
             FROM admission_plan 
             WHERE college_name LIKE ? 
             ORDER BY year DESC 
             LIMIT 5`,
            [`%${intent.params.schoolName}%`]
          );
          rawResults = rows;
        }
        break;
        
      case 'general':
        // 一般问题，交由DeepSeek处理
        return null;
    }
    
    // 3. 如果没有结果，返回null交由DeepSeek处理

    // 调试日志
    console.log(`[tryEnhancedDbQuery] 意图类型: ${intent.type}, 参数:`, intent.params);
    console.log(`[tryEnhancedDbQuery] rawResults:`, rawResults);
    
    // 3. 如果没有结果，返回null交由DeepSeek处理
    if (!rawResults || (Array.isArray(rawResults) && rawResults.length === 0)) {
      return null;
    }
    
    // 4. AI增强结果
    const enhanced = await enhanceResultsWithAI(rawResults, intent, intent.userContext);
    
    // 5. 格式化最终回复
    return formatEnhancedResponse(intent.type, enhanced, intent.params);
    
  } catch (err) {
    console.error('[Enhanced DB Query] 异常:', err.message);
    return null;
  }
}

// 策略内容
function getStrategyContent() {
  return {
    title: '高考志愿填报策略指南',
    sections: [
      {
        title: '冲稳保策略',
        content: '🚀 冲：选择录取线略高于你分数的院校（录取概率20-40%）\n⚖️ 稳：选择录取线与你分数相当的院校（录取概率50-70%）\n🛡️ 保：选择录取线低于你分数的院校（录取概率80%以上）'
      },
      {
        title: '志愿填报顺序',
        content: '1. 按兴趣排序：最想去的院校专业放前面\n2. 按梯度排序：冲、稳、保合理分布\n3. 按批次排序：提前批、本科批、专科批'
      },
      {
        title: '专业选择建议',
        content: '• 结合兴趣和特长\n• 考虑就业前景\n• 了解专业课程设置\n• 查看院校专业排名'
      }
    ]
  };
}

// 格式化增强回复
function formatEnhancedResponse(intentType, enhancedData, params) {
  const { data, insights, personalizedTips } = enhancedData;
  
  let response = '';
  
  switch (intentType) {
    case 'recommend':
      if (!data || data.length === 0) {
        response = `根据您提供的信息（${params.province}省，${params.score}分，${params.selectedSubjects.join('')}），系统中暂未找到完全匹配的院校数据。\n\n建议：\n1. 尝试调整分数范围±20分\n2. 在首页进行更精确的查询\n3. 考虑增加备选院校类型\n4. 当前数据库可能未收录该分数段的所有院校`;
      } else {
        response = `📊 ${params.province}省 ${params.score}分 ${params.selectedSubjects.join('')}组合推荐院校：\n\n`;
        
        // 按学校分组展示
        const schoolMap = new Map();
        data.forEach(row => {
          const schoolName = row.college_name;
          if (!schoolMap.has(schoolName)) {
            schoolMap.set(schoolName, []);
          }
          schoolMap.get(schoolName).push(row);
        });
        
        const schools = Array.from(schoolMap.entries()).slice(0, 5);
        schools.forEach(([schoolName, majors], index) => {
          const topMajor = majors[0];
          const scoreDisplay = topMajor.group_min_score_1 || topMajor.min_score || '暂无';
          const batchDisplay = topMajor.batch || '本科批';
          
          response += `${index + 1}. 🏫 ${schoolName}\n`;
          response += `   📈 录取最低分：${scoreDisplay}分 | ${batchDisplay}\n`;
          response += `   📚 选科要求：${topMajor.subject_require || '不限'}\n`;
          
          if (majors.length > 1) {
            const majorNames = majors.slice(0, 2).map(m => m.major_name).join('、');
            response += `   🔧 相关专业：${majorNames}等\n`;
          } else if (majors[0].major_name) {
            response += `   🔧 专业：${majors[0].major_name}\n`;
          }
          response += '\n';
        });
        
        response += `💡 以上为根据你的分数和选科智能推荐的院校。`;
      }
      break;
      
    case 'school_info':
      if (data && data.length > 0) {
        const school = data[0];
        response = `🏫 ${school.school_name}\n`;
        response += `📍 地区：${school.province || '未知'}\n`;
        response += `🎓 类型：${school.school_type || '暂无'}\n`;
        response += `⭐ 层次：${school.school_level || '暂无'}\n\n`;
        response += `你可以在首页输入分数查询该院校的具体录取数据和匹配专业！`;
      } else {
        response = `系统中暂未找到"${params.schoolName}"的相关数据。\n\n建议：\n1. 检查院校名称是否准确\n2. 在"院校名录"中浏览系统收录的所有院校\n3. 该院校可能不在当前数据库收录范围内`;
      }
      break;
      
    case 'major_info':
      if (data && data.length > 0) {
        const major = data[0];
        response = `📚 ${major.major_name}\n`;
        response += `🏷️ 专业类：${major.major_category || '暂无'}\n`;
        response += `📊 录取最低分：${major.min_score_1 || '暂无'}\n`;
        response += `🏫 开设院校数：${major.school_count || '暂无'}\n\n`;
        response += `你可以点击"专业名录"查看更多专业详情，或在首页查询开设该专业的院校！`;
      } else {
        response = `系统中暂未找到"${params.majorName}"的相关数据。\n\n建议：\n1. 检查专业名称是否准确\n2. 在"专业名录"中浏览系统收录的所有专业\n3. 该专业可能不在当前数据库收录范围内`;
      }
      break;

    case 'recommend':
      // 专业推荐(根据选科)
      if (data && Array.isArray(data)) {
        response = `📚 根据你的选科 ${params.selectedSubjects.join('')}，推荐以下专业方向：\n\n`;

        data.forEach((category, index) => {
          response += `${index + 1}. **${category.category}**\n`;
          category.majors.forEach((major, idx) => {
            const scoreDisplay = major.min_score_1 ? `${major.min_score_1}分` : '暂无';
            const schoolCount = major.school_count || 0;
            response += `   ${idx + 1}. ${major.major_name} (${scoreDisplay}, ${schoolCount}所院校)\n`;
          });
          response += '\n';
        });

        response += `💡 以上为根据选科智能推荐的专业，你可以点击"专业名录"查看所有专业，或输入具体专业名称了解详情。`;
      } else if (data && data.length > 0 && data[0].majors) {
        // 兼容旧格式
        response = `📚 根据你的选科 ${params.selectedSubjects.join('')}，推荐以下专业方向：\n\n`;

        data.forEach((category, index) => {
          response += `${index + 1}. **${category.category}**\n`;
          category.majors.forEach((major, idx) => {
            const scoreDisplay = major.min_score_1 ? `${major.min_score_1}分` : '暂无';
            const schoolCount = major.school_count || 0;
            response += `   ${idx + 1}. ${major.major_name} (${scoreDisplay}, ${schoolCount}所院校)\n`;
          });
          response += '\n';
        });

        response += `💡 以上为根据选科智能推荐的专业，你可以点击"专业名录"查看所有专业，或输入具体专业名称了解详情。`;
      }
      break;
      
    case 'strategy':
      const strategy = data.content;
      response = `📖 ${strategy.title}\n\n`;
      strategy.sections.forEach(section => {
        response += `### ${section.title}\n`;
        response += `${section.content}\n\n`;
      });
      break;
      
    case 'rank_conversion':
      response = `🔄 位次换算功能\n\n`;
      response += `请提供以下信息进行精确换算：\n`;
      response += `1. 省份：${params.province || '请指定'}\n`;
      response += `2. 分数或位次：${params.value || '请提供'}\n`;
      response += `3. 选科组合：${params.subjects.join(',') || '请指定'}\n\n`;
      response += `你可以在首页使用"位次换算"功能进行详细查询。`;
      break;
      
    case 'score_line':
      if (data && data.length > 0) {
        response = `📈 ${params.schoolName || '院校'}历年录取分数线：\n\n`;
        data.slice(0, 5).forEach((row, idx) => {
          response += `${idx + 1}. ${row.college_name} - ${row.major_name || '综合'}\n`;
          response += `   年份：${row.year || '未知'} | 最低分：${row.min_score_1 || '未知'} | 批次：${row.batch || '未知'}\n`;
        });
      } else {
        response = `系统中暂未找到${params.schoolName ? `"${params.schoolName}"` : '该院校'}的历年分数线数据。\n\n建议：\n1. 检查院校名称是否准确\n2. 该院校可能不在当前数据库收录范围内\n3. 可在首页使用分数查询功能获取推荐结果`;
      }
      break;
  }
  
  // 去掉AI洞察和个性化提示，只保留推荐结果
  // 如果需要启用AI分析，取消下面注释即可
  /*
  if (insights) {
    response += `\n\n🤖 AI分析：\n${insights}`;
  }
  
  if (personalizedTips && personalizedTips.length > 0) {
    response += `\n\n✨ 个性化提醒：\n`;
    personalizedTips.forEach(tip => {
      response += `• ${tip}\n`;
    });
  }
  */
  
  return response;
}

// ===========================================

// DeepSeek AI 回复
async function tryDeepSeek(text, context) {
  try {
    // 读取 DeepSeek 配置
    const [configRows] = await pool.execute(
      'SELECT deepseek_enabled, deepseek_api_key, deepseek_model FROM chat_basic_config WHERE id = 1'
    );
    if (!configRows.length || !configRows[0].deepseek_enabled || !configRows[0].deepseek_api_key) {
      return null;
    }

    const apiKey = configRows[0].deepseek_api_key;
    const model = configRows[0].deepseek_model || 'deepseek-chat';

    // 构建系统提示词
    const systemPrompt = `你是"权鼎教育"的高考志愿填报智能助手，名字叫"权鼎小助手"。你的职责是：
1. 回答用户关于高考志愿填报的问题，包括选科、专业选择、院校对比、录取分数线、位次分析、冲稳保策略等。
2. 给出专业、客观、实用的建议，帮助考生和家长做出更好的选择。
3. 如果用户问的问题与高考志愿填报无关，礼貌地引导回相关话题。
4. 回复要简洁明了，使用要点式回答，避免过长的段落。
5. 【重要】关于具体院校和专业是否存在、录取分数线、招生计划等事实性问题，必须以系统数据库查询结果为准。如果数据库中没有查询到相关数据，必须明确告知用户"系统中暂未找到该院校/专业的数据"，绝对禁止编造或推测任何具体数据。
6. 对于通用性建议（如填报策略、选科建议等），可以基于你的知识回答，但涉及具体数值时必须注明"请以系统查询结果为准"。`;

    // 构建消息列表
    const messages = [
      { role: 'system', content: systemPrompt },
    ];

    // 如果有上下文对话历史，加入
    if (context && Array.isArray(context) && context.length > 0) {
      // 只取最近6轮对话避免 token 过多
      const recentContext = context.slice(-6);
      recentContext.forEach(function(msg) {
        messages.push({ role: msg.role || 'user', content: msg.content });
      });
    }

    // 添加当前用户消息
    messages.push({ role: 'user', content: text });

    // 调用 DeepSeek API（使用 Node.js 内置 fetch）
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[DeepSeek API] 请求失败:', response.status, errText);
      return null;
    }

    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content.trim();
    }

    return null;
  } catch (err) {
    console.error('[DeepSeek API] 调用异常:', err.message);
    return null;
  }
}

// ========== 智能客服配置管理 API ==========

// 获取基础配置
app.get('/api/chat-config/basic', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM chat_basic_config WHERE id = 1');
    if (rows.length > 0) {
      const config = rows[0];
      // 解析 JSON 字段
      let quickQuestions = [];
      try { quickQuestions = JSON.parse(config.quick_questions || '[]'); } catch(e) {}
      res.json({
        success: true,
        data: {
          enabled: !!config.enabled,
          welcome: config.welcome || '',
          quickQuestions: quickQuestions,
          petName: config.pet_name || '权鼎小助手',
          deepseekEnabled: !!config.deepseek_enabled,
          deepseekApiKey: config.deepseek_api_key || '',
          deepseekModel: config.deepseek_model || 'deepseek-chat'
        }
      });
    } else {
      res.json({ success: true, data: { enabled: true, welcome: '', quickQuestions: [], petName: '权鼎小助手', deepseekEnabled: false, deepseekApiKey: '', deepseekModel: 'deepseek-chat' } });
    }
  } catch (err) {
    console.error('[Chat Config] 获取基础配置失败:', err.message);
    res.json({ success: true, data: { enabled: true, welcome: '', quickQuestions: [], petName: '权鼎小助手', deepseekEnabled: false, deepseekApiKey: '', deepseekModel: 'deepseek-chat' } });
  }
});

// 保存基础配置
app.post('/api/chat-config/basic', async (req, res) => {
  try {
    const { enabled, welcome, quickQuestions, petName, deepseekEnabled, deepseekApiKey, deepseekModel } = req.body;
    const qs = JSON.stringify(quickQuestions || []);
    const dsEnabled = deepseekEnabled ? 1 : 0;
    const dsApiKey = deepseekApiKey || '';
    const dsModel = deepseekModel || 'deepseek-chat';
    await pool.execute(
      `INSERT INTO chat_basic_config (id, enabled, welcome, quick_questions, pet_name, deepseek_enabled, deepseek_api_key, deepseek_model) 
       VALUES (1, ?, ?, ?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE enabled = ?, welcome = ?, quick_questions = ?, pet_name = ?, deepseek_enabled = ?, deepseek_api_key = ?, deepseek_model = ?`,
      [enabled ? 1 : 0, welcome || '', qs, petName || '权鼎小助手', dsEnabled, dsApiKey, dsModel,
       enabled ? 1 : 0, welcome || '', qs, petName || '权鼎小助手', dsEnabled, dsApiKey, dsModel]
    );
    res.json({ success: true, message: '保存成功' });
  } catch (err) {
    console.error('[Chat Config] 保存基础配置失败:', err.message);
    res.status(500).json({ success: false, message: '保存失败: ' + err.message });
  }
});

// 获取规则列表
app.get('/api/chat-config/rules', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM chat_rules ORDER BY priority DESC, id ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Chat Config] 获取规则失败:', err.message);
    res.json({ success: true, data: [] });
  }
});

// 新增规则
app.post('/api/chat-config/rules', async (req, res) => {
  try {
    const { keywords, response, priority, status } = req.body;
    if (!keywords || !response) {
      return res.status(400).json({ success: false, message: '关键词和回复内容不能为空' });
    }
    const [result] = await pool.execute(
      'INSERT INTO chat_rules (keywords, response, priority, status) VALUES (?, ?, ?, ?)',
      [keywords, response, priority || 0, status !== undefined ? status : 1]
    );
    clearChatRulesCache();
    res.json({ success: true, message: '添加成功', data: { id: result.insertId } });
  } catch (err) {
    console.error('[Chat Config] 新增规则失败:', err.message);
    res.status(500).json({ success: false, message: '添加失败: ' + err.message });
  }
});

// 更新规则
app.put('/api/chat-config/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { keywords, response, priority, status } = req.body;
    
    // 构建动态更新
    const fields = [];
    const values = [];
    if (keywords !== undefined) { fields.push('keywords = ?'); values.push(keywords); }
    if (response !== undefined) { fields.push('response = ?'); values.push(response); }
    if (priority !== undefined) { fields.push('priority = ?'); values.push(priority); }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    
    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: '没有需要更新的字段' });
    }
    
    values.push(id);
    await pool.execute(`UPDATE chat_rules SET ${fields.join(', ')} WHERE id = ?`, values);
    clearChatRulesCache();
    res.json({ success: true, message: '更新成功' });
  } catch (err) {
    console.error('[Chat Config] 更新规则失败:', err.message);
    res.status(500).json({ success: false, message: '更新失败: ' + err.message });
  }
});

// 删除规则
app.delete('/api/chat-config/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM chat_rules WHERE id = ?', [id]);
    clearChatRulesCache();
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[Chat Config] 删除规则失败:', err.message);
    res.status(500).json({ success: false, message: '删除失败: ' + err.message });
  }
});

// 获取对话日志
app.get('/api/chat-config/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const userId = req.query.userId ? String(req.query.userId).trim() : null;
    
    let rows;
    if (userId) {
      [rows] = await pool.execute(
        "SELECT * FROM chat_logs WHERE user_id = ? AND user_id != '' AND user_id IS NOT NULL ORDER BY created_at DESC LIMIT " + limit,
        [userId]
      );
    } else {
      [rows] = await pool.execute(
        'SELECT * FROM chat_logs ORDER BY created_at DESC LIMIT ' + limit
      );
    }
    
    // 获取总数
    let total = 0;
    try {
      if (userId) {
        const [countRows] = await pool.execute("SELECT COUNT(*) as cnt FROM chat_logs WHERE user_id = ? AND user_id != '' AND user_id IS NOT NULL", [userId]);
        total = countRows[0].cnt;
      } else {
        const [countRows] = await pool.execute('SELECT COUNT(*) as cnt FROM chat_logs');
        total = countRows[0].cnt;
      }
    } catch(e) {}
    
    res.json({ success: true, data: rows, total: total });
  } catch (err) {
    console.error('[Chat Config] 获取日志失败:', err.message);
    res.json({ success: true, data: [], total: 0 });
  }
});

// 前端获取规则（供 pet.js 使用）
app.get('/api/chat/rules', async (req, res) => {
  try {
    const rules = await getChatRules();
    res.json({ success: true, data: rules });
  } catch (err) {
    res.json({ success: true, data: [] });
  }
});

// 前端获取基础配置（供 pet.js 使用）
app.get('/api/chat/config', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM chat_basic_config WHERE id = 1');
    if (rows.length > 0) {
      const config = rows[0];
      let quickQuestions = [];
      try { quickQuestions = JSON.parse(config.quick_questions || '[]'); } catch(e) {}
      res.json({
        success: true,
        data: {
          enabled: !!config.enabled,
          welcome: config.welcome || '',
          quickQuestions: quickQuestions,
          petName: config.pet_name || '权鼎小助手'
        }
      });
    } else {
      res.json({ success: true, data: { enabled: true, welcome: '', quickQuestions: [], petName: '权鼎小助手' } });
    }
  } catch (err) {
    res.json({ success: true, data: { enabled: true, welcome: '', quickQuestions: [], petName: '权鼎小助手' } });
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
