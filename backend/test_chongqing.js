const mysql = require('mysql2/promise');

async function test() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'cm1990131',
    database: 'gaokao',
    waitForConnections: true,
    connectionLimit: 10
  });

  const score = 550;
  const sourceProvince = '重庆';
  const subjectType = '物理';
  const optional1 = '化学';
  const optional2 = '生物';

  // 构建条件
  const subjectRequireConditions = [];
  const subjectRequireParams = [];

  // 情形a：subject_require 含2门
  if (optional1 && optional2) {
    subjectRequireConditions.push(`subject_require IN (?, ?)`);
    subjectRequireParams.push(`${optional1}和${optional2}`, `${optional2}和${optional1}`);
  }

  // 情形b：subject_require 是1门单科
  const optionals = [optional1, optional2].filter(s => s);
  if (optionals.length > 0) {
    subjectRequireConditions.push(`subject_require IN (${optionals.map(() => '?').join(',')})`);
    subjectRequireParams.push(...optionals);
  }

  // 情形c：不限
  subjectRequireConditions.push(`subject_require = '不限'`);

  const subjectRequireClause = `AND (${subjectRequireConditions.join(' OR ')})`;

  const query = `
    SELECT
      college_name, major_name, min_score_1, subject_type, subject_require,
      COALESCE(group_min_score_1, min_score_1) AS effective_score
    FROM admission_plan
    WHERE source_province = ?
      AND subject_type = ?
      ${subjectRequireClause}
      AND COALESCE(group_min_score_1, min_score_1) >= ?
      AND COALESCE(group_min_score_1, min_score_1) <= ?
    ORDER BY COALESCE(group_min_score_1, min_score_1) DESC, min_score_1 DESC
    LIMIT 10
  `;

  const queryParams = [
    sourceProvince,
    subjectType,
    ...subjectRequireParams,
    score - 20,
    score + 10
  ];

  console.log('SQL:', query);
  console.log('Params:', queryParams);

  const [rows] = await pool.execute(query, queryParams);
  console.log('结果数量:', rows.length);
  console.log('前3条:', rows.slice(0, 3));

  await pool.end();
}

test().catch(console.error);
