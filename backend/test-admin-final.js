const mysql = require('mysql2/promise');

async function testAdminAPI() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'cm1990131',
    database: 'gaokao',
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4'
  });

  try {
    console.log('🧪 测试最终修复版本...\n');

    const page = 1;
    const pageSize = 20;
    const offset = (page - 1) * pageSize;

    let sql = 'SELECT id, phone, username, status, created_at, last_login FROM users';
    let countSql = 'SELECT COUNT(*) as total FROM users';
    let conditions = [];
    let params = [];

    // 无筛选条件

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      sql += whereClause;
      countSql += whereClause;
    }

    // 查询总数
    const [countRows] = await pool.execute(countSql, params);
    const total = countRows[0].total;
    console.log(`✅ 总记录数: ${total}`);

    // 查询用户列表
    sql += ` ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
    const [rows] = await pool.execute(sql, params);

    console.log(`✅ 返回 ${rows.length} 条记录:\n`);
    rows.forEach(row => {
      console.log(`  ID: ${row.id}, 用户名: ${row.username}, 手机: ${row.phone}, 状态: ${row.status}`);
    });

    console.log('\n✅ API测试成功！');

  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

testAdminAPI();
