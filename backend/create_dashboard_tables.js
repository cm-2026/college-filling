// 执行数据看板建表SQL
const mysql = require('mysql2/promise');

async function createDashboardTables() {
  const pool = await mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'cm1990131',
    database: 'gaokao'
  });

  console.log('🔨 开始创建数据看板表...\n');

  try {
    // 1. 创建 user_behaviors 表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS user_behaviors (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT,
        behavior_type VARCHAR(50) NOT NULL COMMENT '行为类型: login, search, recommend, export, view',
        behavior_data TEXT COMMENT 'JSON格式详细数据',
        ip VARCHAR(50),
        user_agent VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_behavior_type (behavior_type),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户行为记录表'
    `);
    console.log('  ✅ user_behaviors 表创建成功');

    // 2. 创建 admin_logs 表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        admin_id INT NOT NULL,
        admin_name VARCHAR(50),
        action VARCHAR(50) COMMENT '操作类型: login, delete_user, update_user, reset_password',
        target_type VARCHAR(50) COMMENT '目标类型: user, college, major',
        target_id INT,
        detail TEXT COMMENT 'JSON格式操作详情',
        ip VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_admin_id (admin_id),
        INDEX idx_action (action),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员操作日志表'
    `);
    console.log('  ✅ admin_logs 表创建成功\n');

    // 验证表创建
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME, TABLE_COMMENT, CREATE_TIME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = 'gaokao'
      AND TABLE_NAME IN ('user_behaviors', 'admin_logs')
    `);

    console.log('📊 已创建的表:');
    tables.forEach(t => {
      console.log(`  ${t.TABLE_NAME} - ${t.TABLE_COMMENT}`);
    });

    console.log('\n💡 提示:');
    console.log('  - 用户登录、推荐查询、导出数据时会自动记录行为');
    console.log('  - 数据看板会实时展示用户行为统计');
    console.log('  - 请重新登录或进行推荐查询来生成数据');

  } catch (error) {
    console.error('❌ 创建表失败:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

createDashboardTables().catch(e => {
  console.error('执行失败:', e.message);
  process.exit(1);
});
