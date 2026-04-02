const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'cm1990131',
    database: 'gaokao'
  });

  const [rows] = await conn.query(
    "SELECT major_name, major_remark FROM admission_plan WHERE major_remark IS NOT NULL AND major_remark != '' LIMIT 10"
  );

  console.log('有major_remark的记录:');
  rows.forEach(r => {
    console.log('  ' + r.major_name + ' | 备注: ' + r.major_remark);
  });

  console.log('\n总条数:', rows.length);

  await conn.end();
})();
