const mysql = require('mysql2/promise');

async function checkDatabase() {
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
    console.log('🔍 检查数据库连接...');
    const conn = await pool.getConnection();
    console.log('✅ 数据库连接成功');

    // 检查users表是否存在
    const [tables] = await conn.execute("SHOW TABLES LIKE 'users'");
    if (tables.length === 0) {
      console.log('❌ users表不存在，正在创建...');
      
      await conn.execute(`
        CREATE TABLE users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          phone VARCHAR(11) NOT NULL UNIQUE,
          username VARCHAR(50) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          status TINYINT DEFAULT 1 COMMENT '1=启用, 0=禁用',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP NULL,
          INDEX idx_phone (phone),
          INDEX idx_username (username),
          INDEX idx_status (status),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      console.log('✅ users表创建成功');
    } else {
      console.log('✅ users表已存在');
      
      // 查看表结构
      const [columns] = await conn.execute('DESCRIBE users');
      console.log('\n📋 表结构:');
      columns.forEach(col => {
        console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? 'DEFAULT ' + col.Default : ''}`);
      });
      
      // 查看数据
      const [count] = await conn.execute('SELECT COUNT(*) as total FROM users');
      console.log(`\n📊 数据统计: ${count[0].total} 条记录`);
      
      if (count[0].total > 0) {
        const [sample] = await conn.execute('SELECT id, phone, username, status, created_at, last_login FROM users LIMIT 3');
        console.log('\n📝 示例数据:');
        sample.forEach(row => {
          console.log(`  ID: ${row.id}, 用户名: ${row.username}, 手机: ${row.phone}, 状态: ${row.status}`);
        });
      }
    }

    conn.release();
    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

checkDatabase();
