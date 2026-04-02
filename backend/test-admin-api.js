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
    console.log('🧪 测试管理员API逻辑...\n');

    // 模拟API请求
    const search = '';
    const status = '';
    const page = 1;
    const pageSize = 20;
    const offset = (page - 1) * pageSize;

    let whereConditions = [];
    let params = [];

    if (search) {
      whereConditions.push('(username LIKE ? OR phone LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status !== undefined && status !== '') {
      whereConditions.push('status = ?');
      params.push(parseInt(status));
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    console.log('SQL WHERE:', whereClause || '(无筛选条件)');
    console.log('参数:', params.length > 0 ? params : '(无参数)');

    // 查询总数
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params
    );
    const total = countRows[0].total;
    console.log(`\n✅ 总记录数: ${total}`);

    // 查询用户列表
    const queryParams = [...params, pageSize, offset];
    const [rows] = await pool.execute(
      `SELECT id, phone, username, status, created_at, last_login 
       FROM users ${whereClause}
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      queryParams
    );

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
