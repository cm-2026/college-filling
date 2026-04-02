const mysql = require('mysql2/promise');

async function checkData() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'cm1990131',
    database: 'gaokao',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  
  try {
    // 检查西藏数据（已有的传统文理分科地区）
    const [rows] = await pool.execute(
      'SELECT subject_type, subject_require, COUNT(*) as cnt FROM admission_plan WHERE source_province = ? GROUP BY subject_type, subject_require',
      ['西藏']
    );
    
    console.log('西藏地区数据格式:');
    if (rows.length === 0) {
      console.log('  没有找到西藏数据');
    } else {
      rows.forEach(row => {
        console.log(`  subject_type: '${row.subject_type}', subject_require: '${row.subject_require}', 数量: ${row.cnt}`);
      });
    }
    
    // 检查河南数据（3+1+2模式）作为对比
    const [rows2] = await pool.execute(
      'SELECT subject_type, subject_require, COUNT(*) as cnt FROM admission_plan WHERE source_province = ? GROUP BY subject_type, subject_require LIMIT 5',
      ['河南']
    );
    
    console.log('\n河南地区数据格式（前5种）:');
    rows2.forEach(row => {
      console.log(`  subject_type: '${row.subject_type}', subject_require: '${row.subject_require}', 数量: ${row.cnt}`);
    });
    
  } catch (error) {
    console.error('查询出错:', error);
  } finally {
    await pool.end();
  }
}

checkData();