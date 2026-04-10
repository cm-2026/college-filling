const mysql = require('mysql2/promise');

async function check() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'cm1990131',
    database: 'gaokao',
    charset: 'utf8mb4'
  });

  // 直接查询数据库
  const [rows] = await pool.execute(`
    SELECT id, major_name, subject_type, subject_require
    FROM admission_plan
    WHERE college_code = '2100'
      AND major_group_code = '102'
      AND source_province = '河南'
      AND college_name = '西安建筑科技大学'
    ORDER BY id
    LIMIT 5
  `);

  console.log('数据库中的数据（前5条）:');
  rows.forEach(r => {
    console.log(`ID: ${r.id}, 专业: ${r.major_name}, subject_type: '${r.subject_type}', subject_require: '${r.subject_require}'`);
  });

  await pool.end();
}

check().catch(console.error);
