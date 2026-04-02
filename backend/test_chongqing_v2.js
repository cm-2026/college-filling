const mysql = require('mysql2/promise');

async function testChongqing() {
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
    console.log('===== 测试重庆数据查询 =====\n');

    // 1. 查看重庆数据的基本情况
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        COUNT(group_min_score_1) as has_group_score,
        COUNT(min_score_1) as has_major_score,
        MIN(min_score_1) as min_score,
        MAX(min_score_1) as max_score
      FROM admission_plan 
      WHERE source_province = '重庆'
    `);
    console.log('📊 重庆数据统计:');
    console.log(`  - 总记录数: ${stats[0].total}`);
    console.log(`  - 有专业组最低分: ${stats[0].has_group_score}`);
    console.log(`  - 有专业最低分: ${stats[0].has_major_score}`);
    console.log(`  - 分数范围: ${stats[0].min_score} ~ ${stats[0].max_score}\n`);

    // 2. 查看选科要求情况
    const [subjectStats] = await pool.execute(`
      SELECT subject_type, subject_require, COUNT(*) as count
      FROM admission_plan 
      WHERE source_province = '重庆'
      GROUP BY subject_type, subject_require
      ORDER BY count DESC
      LIMIT 10
    `);
    console.log('📚 重庆选科要求分布（前10）:');
    subjectStats.forEach(row => {
      console.log(`  - ${row.subject_type} | ${row.subject_require || '空'}: ${row.count}条`);
    });
    console.log('');

    // 3. 模拟查询：重庆物理类，分数500，选科"物理,化学,生物"
    const score = 500;
    const requiredSubject = '物理';
    const optional1 = '化学';
    const optional2 = '生物';

    console.log(`🔍 模拟查询:`);
    console.log(`  - 生源地: 重庆`);
    console.log(`  - 分数: ${score}`);
    console.log(`  - 选科: ${requiredSubject}, ${optional1}, ${optional2}`);
    console.log(`  - 分数范围: ${score - 20} ~ ${score + 10}\n`);

    const [rows] = await pool.execute(`
      SELECT
        college_name, college_code, major_name, major_code,
        major_group_name AS major_group, major_group_code,
        group_min_score_1, min_score_1 AS min_score,
        subject_type, subject_require,
        COALESCE(group_min_score_1, min_score_1) AS effective_score
      FROM admission_plan
      WHERE source_province = ?
        AND subject_type = ?
        AND (
          subject_require IN (?, ?)
          OR subject_require IN (?, ?)
          OR subject_require = '不限'
        )
        AND COALESCE(group_min_score_1, min_score_1) >= ?
        AND COALESCE(group_min_score_1, min_score_1) <= ?
      ORDER BY COALESCE(group_min_score_1, min_score_1) DESC, min_score_1 DESC
      LIMIT 10
    `, [
      '重庆', requiredSubject,
      `${optional1}和${optional2}`, `${optional2}和${optional1}`,
      optional1, optional2,
      score - 20, score + 10
    ]);

    console.log(`✅ 查询到 ${rows.length} 条记录:\n`);
    rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.college_name} - ${row.major_name}`);
      console.log(`   组最低分: ${row.group_min_score_1 || '无'} | 专业最低分: ${row.min_score} | 有效分数: ${row.effective_score}`);
      console.log(`   选科要求: ${row.subject_require || '不限'} | 科目类型: ${row.subject_type}\n`);
    });

  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

testChongqing();
