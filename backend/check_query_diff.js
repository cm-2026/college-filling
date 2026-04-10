const mysql = require('mysql2/promise');

async function check() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'cm1990131',
    database: 'gaokao',
    charset: 'utf8mb4'
  });
  
  // 查询1：用户提供的精确查询
  const [rows1] = await pool.execute(`
    SELECT id, major_name, subject_type, subject_require
    FROM admission_plan 
    WHERE source_province = '河南' 
      AND college_name = '西安建筑科技大学' 
      AND subject_type = '物理' 
      AND major_group_code = '102'
    ORDER BY id
  `);
  console.log('查询1（精确匹配subject_type）:', rows1.length, '条');
  console.log('ID列表:', rows1.map(r => r.id).join(', '));
  
  // 查询2：使用LIKE '%物理%'
  const [rows2] = await pool.execute(`
    SELECT id, major_name, subject_type, subject_require
    FROM admission_plan 
    WHERE source_province = '河南' 
      AND college_name = '西安建筑科技大学' 
      AND subject_type LIKE '%物理%' 
      AND major_group_code = '102'
    ORDER BY id
  `);
  console.log('\n查询2（LIKE %物理%）:', rows2.length, '条');
  console.log('ID列表:', rows2.map(r => r.id).join(', '));
  
  // 找出差异
  if (rows1.length !== rows2.length) {
    const ids1 = new Set(rows1.map(r => r.id));
    const diff = rows2.filter(r => !ids1.has(r.id));
    console.log('\n差异记录（在查询2中但不在查询1中）:');
    diff.forEach(r => {
      console.log(`  ID: ${r.id}, 专业: ${r.major_name}, subject_type: '${r.subject_type}'`);
    });
  } else {
    console.log('\n两个查询结果一致');
  }
  
  // 查询所有可能的subject_type值
  const [rows3] = await pool.execute(`
    SELECT DISTINCT subject_type, COUNT(*) as cnt
    FROM admission_plan 
    WHERE source_province = '河南' 
      AND college_name = '西安建筑科技大学' 
      AND major_group_code = '102'
    GROUP BY subject_type
  `);
  console.log('\n所有subject_type值:', rows3);
  
  await pool.end();
}

check().catch(console.error);
