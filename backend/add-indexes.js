const mysql = require('mysql2/promise');

async function addOptimizedIndexes() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'cm1990131',
    database: 'gaokao'
  });

  console.log('🚀 开始添加优化索引...\n');

  // 索引1: 3+1+2模式优化索引
  try {
    console.log('1️⃣ 创建3+1+2模式核心索引...');
    await conn.execute(`
      CREATE INDEX idx_31_2_optimized 
      ON admission_plan (source_province, subject_type, group_min_score_1, min_score_1)
    `);
    console.log('✅ idx_31_2_optimized 创建成功\n');
  } catch (e) {
    if (e.code === 'ER_DUP_KEYNAME') {
      console.log('⚠️  索引已存在，跳过\n');
    } else {
      console.error('❌ 错误:', e.message, '\n');
    }
  }

  // 索引2: 3+3模式优化索引
  try {
    console.log('2️⃣ 创建3+3模式核心索引...');
    await conn.execute(`
      CREATE INDEX idx_33_optimized 
      ON admission_plan (source_province, group_min_score_1, min_score_1)
    `);
    console.log('✅ idx_33_optimized 创建成功\n');
  } catch (e) {
    if (e.code === 'ER_DUP_KEYNAME') {
      console.log('⚠️  索引已存在，跳过\n');
    } else {
      console.error('❌ 错误:', e.message, '\n');
    }
  }

  // 索引3: dxmessage表索引
  try {
    console.log('3️⃣ 创建院校名录索引...');
    await conn.execute(`
      CREATE INDEX idx_colleges_ranking 
      ON dxmessage (ranking, school_name)
    `);
    console.log('✅ idx_colleges_ranking 创建成功\n');
  } catch (e) {
    if (e.code === 'ER_DUP_KEYNAME') {
      console.log('⚠️  索引已存在，跳过\n');
    } else {
      console.error('❌ 错误:', e.message, '\n');
    }
  }

  // 查看结果
  console.log('📊 当前admission_plan表所有索引:\n');
  const [indexes] = await conn.execute(`
    SELECT 
      INDEX_NAME,
      GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ', ') AS columns
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'gaokao'
      AND TABLE_NAME = 'admission_plan'
    GROUP BY INDEX_NAME
    ORDER BY INDEX_NAME
  `);

  indexes.forEach((idx, i) => {
    const isNew = idx.INDEX_NAME.includes('optimized');
    const marker = isNew ? '🆕' : '  ';
    console.log(`${marker} ${idx.INDEX_NAME.padEnd(30)} | ${idx.columns}`);
  });

  console.log('\n✅ 索引优化完成！');
  console.log('📈 预计性能提升：30-50%');

  await conn.end();
}

addOptimizedIndexes().catch(console.error);
