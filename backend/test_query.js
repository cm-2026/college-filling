const mysql = require('mysql2/promise');
async function test() {
  const pool = mysql.createPool({host:'localhost',user:'root',password:'cm1990131',database:'gaokao',charset:'utf8mb4'});
  
  // P1测试
  const [r1] = await pool.execute(
    'SELECT COUNT(*) as cnt FROM admission_plan WHERE source_province=? AND min_score_1 BETWEEN ? AND ? AND subject_type=? AND subject_require IN (?,?)',
    ['河南', 530, 570, '物理', '化学和生物', '生物和化学']
  );
  console.log('P1 count:', r1[0].cnt);
  
  // P2测试
  const [r2] = await pool.execute(
    'SELECT COUNT(*) as cnt FROM admission_plan WHERE source_province=? AND min_score_1 BETWEEN ? AND ? AND subject_type=? AND subject_require IN (?,?)',
    ['河南', 530, 570, '物理', '化学', '生物']
  );
  console.log('P2 count:', r2[0].cnt);
  
  // P3测试
  const [r3] = await pool.execute(
    "SELECT COUNT(*) as cnt FROM admission_plan WHERE source_province=? AND min_score_1 BETWEEN ? AND ? AND subject_type=? AND subject_require='不限'",
    ['河南', 530, 570, '物理']
  );
  console.log('P3 count:', r3[0].cnt);
  
  // 完整UNION查询测试
  const q = `
    (SELECT college_name, major_name, min_score_1, subject_require, 1 as mp FROM admission_plan
     WHERE source_province=? AND min_score_1 BETWEEN ? AND ? AND subject_type=? AND subject_require IN (?,?))
    UNION ALL
    (SELECT college_name, major_name, min_score_1, subject_require, 2 as mp FROM admission_plan
     WHERE source_province=? AND min_score_1 BETWEEN ? AND ? AND subject_type=? AND subject_require IN (?,?))
    UNION ALL
    (SELECT college_name, major_name, min_score_1, subject_require, 3 as mp FROM admission_plan
     WHERE source_province=? AND min_score_1 BETWEEN ? AND ? AND subject_type=? AND subject_require='不限')
    ORDER BY mp, min_score_1
    LIMIT 5
  `;
  const params = [
    '河南',530,570,'物理','化学和生物','生物和化学',
    '河南',530,570,'物理','化学','生物',
    '河南',530,570,'物理'
  ];
  const [rows] = await pool.execute(q, params);
  console.log('UNION总计:', rows.length);
  rows.forEach(r => console.log(` P${r.mp}: ${r.college_name} - ${r.major_name} | 分数:${r.min_score_1} | 选科:${r.subject_require}`));
  
  pool.end();
}
test().catch(e => console.error('ERROR:', e.message));
