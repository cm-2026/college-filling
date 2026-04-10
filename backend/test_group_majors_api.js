const mysql = require('mysql2/promise');

async function testAPI() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'cm1990131',
    database: 'gaokao',
    charset: 'utf8mb4'
  });

  // 模拟前端参数
  const params = {
    schoolCode: '4103',  // 西安建筑科技大学的代码，需要确认
    groupCode: '102',
    region: '河南',
    subjectCombination: '物理,化学,生物',  // 假设用户选了物理
    schoolName: '西安建筑科技大学'
  };

  console.log('测试参数:', params);

  // 查询院校代码
  const [codeRows] = await pool.execute(`
    SELECT DISTINCT college_code 
    FROM admission_plan 
    WHERE college_name = '西安建筑科技大学' AND source_province = '河南'
    LIMIT 1
  `);
  
  if (codeRows.length > 0) {
    params.schoolCode = codeRows[0].college_code;
    console.log('查询到院校代码:', params.schoolCode);
  }

  // 模拟API查询逻辑
  let sql = `
    SELECT 
      id,
      college_code AS school_code,
      college_name AS school_name,
      major_name AS major,
      major_code,
      major_category,
      major_group_code,
      major_group_name,
      subject_require,
      subject_type,
      min_score_1 AS min_score,
      min_rank_1 AS \`rank\`,
      admit_count_1 AS admit_count,
      batch,
      batch_remark,
      college_province,
      college_city,
      recommend_reason
    FROM admission_plan
    WHERE college_code = ? AND major_group_code = ?
  `;
  const queryParams = [params.schoolCode, params.groupCode];

  // 生源地筛选
  if (params.region) {
    sql += ` AND source_province = ?`;
    queryParams.push(params.region);
  }

  // 院校名称筛选
  if (params.schoolName) {
    sql += ` AND college_name = ?`;
    queryParams.push(params.schoolName);
  }

  // 判断模式
  const mode33Provinces = ['北京', '天津', '上海', '山东', '浙江', '海南'];
  const isMode33 = mode33Provinces.includes(params.region);
  console.log('isMode33:', isMode33);

  // 选科筛选
  if (params.subjectCombination) {
    const subjects = params.subjectCombination.split(',').filter(s => s.trim());
    console.log('解析选科:', subjects);

    if (isMode33) {
      console.log('3+3模式，使用subject_require筛选');
    } else {
      console.log('3+1+2模式，使用subject_type筛选');
      if (subjects.includes('物理')) {
        sql += ` AND subject_type LIKE ?`;
        queryParams.push('%物理%');
        console.log('添加subject_type筛选: %物理%');
      } else if (subjects.includes('历史')) {
        sql += ` AND subject_type LIKE ?`;
        queryParams.push('%历史%');
        console.log('添加subject_type筛选: %历史%');
      }
    }
  } else {
    console.log('未传递subjectCombination，不筛选subject_type');
  }

  sql += ` ORDER BY min_score_1 ASC`;

  console.log('\nSQL:', sql);
  console.log('参数:', queryParams);

  const [rows] = await pool.execute(sql, queryParams);

  console.log('\n查询结果:', rows.length, '条');
  
  // 统计subject_type分布
  const typeCount = {};
  rows.forEach(r => {
    typeCount[r.subject_type] = (typeCount[r.subject_type] || 0) + 1;
  });
  console.log('subject_type分布:', typeCount);

  // 如果没有subjectCombination，也测试一下
  console.log('\n========== 测试无subjectCombination的情况 ==========');
  let sql2 = `
    SELECT id, major_name, subject_type
    FROM admission_plan
    WHERE college_code = ? AND major_group_code = ?
      AND source_province = ?
      AND college_name = ?
    ORDER BY min_score_1 ASC
  `;
  const [rows2] = await pool.execute(sql2, [params.schoolCode, params.groupCode, params.region, params.schoolName]);
  console.log('无subject_type筛选:', rows2.length, '条');
  
  const typeCount2 = {};
  rows2.forEach(r => {
    typeCount2[r.subject_type] = (typeCount2[r.subject_type] || 0) + 1;
  });
  console.log('subject_type分布:', typeCount2);

  await pool.end();
}

testAPI().catch(console.error);
