const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({host:'localhost',user:'root',password:'cm1990131',database:'gaokao',connectionLimit:5});
  const [rows] = await pool.execute(
    `SELECT college_name, major_name, major_group_name, major_group_code
     FROM admission_plan
     WHERE source_province = '河南'
       AND min_score_1 BETWEEN 500 AND 540
     LIMIT 5`
  );
  console.log(JSON.stringify(rows, null, 2));
  await pool.end();
})().catch(e => console.error(e.message));
