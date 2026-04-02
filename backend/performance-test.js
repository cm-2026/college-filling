const mysql = require('mysql2/promise');

async function performanceTest() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'cm1990131',
    database: 'gaokao'
  });

  console.log('📊 数据库性能测试\n');
  console.log('====================================\n');

  // 测试1: 3+1+2模式查询（河南500分物理类）
  console.log('测试1: 3+1+2模式查询（河南500分物理类）');
  const start1 = Date.now();
  const [result1] = await conn.execute(`
    SELECT college_name, major_name, group_min_score_1, min_score_1
    FROM admission_plan
    WHERE source_province = '河南'
      AND subject_type = '物理'
      AND COALESCE(group_min_score_1, min_score_1) BETWEEN 480 AND 510
    LIMIT 20
  `);
  const time1 = Date.now() - start1;
  console.log(`  ✅ 查询耗时: ${time1}ms`);
  console.log(`  📋 返回记录: ${result1.length}条\n`);

  // 测试2: 3+3模式查询（北京500分）
  console.log('测试2: 3+3模式查询（北京500分）');
  const start2 = Date.now();
  const [result2] = await conn.execute(`
    SELECT college_name, major_name, group_min_score_1, min_score_1
    FROM admission_plan
    WHERE source_province = '北京'
      AND COALESCE(group_min_score_1, min_score_1) BETWEEN 480 AND 510
    LIMIT 20
  `);
  const time2 = Date.now() - start2;
  console.log(`  ✅ 查询耗时: ${time2}ms`);
  console.log(`  📋 返回记录: ${result2.length}条\n`);

  // 测试3: 院校名录查询
  console.log('测试3: 院校名录查询（全部院校）');
  const start3 = Date.now();
  const [result3] = await conn.execute(`
    SELECT id, school_name, province, city, school_type, ranking
    FROM dxmessage
    ORDER BY ranking ASC, school_name ASC
    LIMIT 100
  `);
  const time3 = Date.now() - start3;
  console.log(`  ✅ 查询耗时: ${time3}ms`);
  console.log(`  📋 返回记录: ${result3.length}条\n`);

  // 测试4: 专业查询（热门专业）
  console.log('测试4: 专业查询（计算机类）');
  const start4 = Date.now();
  const [result4] = await conn.execute(`
    SELECT college_name, major_name, min_score_1
    FROM admission_plan
    WHERE major_name LIKE '%计算机%'
    LIMIT 20
  `);
  const time4 = Date.now() - start4;
  console.log(`  ✅ 查询耗时: ${time4}ms`);
  console.log(`  📋 返回记录: ${result4.length}条\n`);

  // 使用EXPLAIN分析查询计划
  console.log('====================================');
  console.log('📈 查询计划分析（EXPLAIN）\n');

  console.log('测试1查询计划:');
  const [explain1] = await conn.execute(`
    EXPLAIN SELECT college_name, major_name, group_min_score_1, min_score_1
    FROM admission_plan
    WHERE source_province = '河南'
      AND subject_type = '物理'
      AND COALESCE(group_min_score_1, min_score_1) BETWEEN 480 AND 510
    LIMIT 20
  `);
  console.log('  索引:', explain1[0].key || '无');
  console.log('  扫描行数:', explain1[0].rows);
  console.log('  额外信息:', explain1[0].Extra || '无');

  console.log('\n测试2查询计划:');
  const [explain2] = await conn.execute(`
    EXPLAIN SELECT college_name, major_name, group_min_score_1, min_score_1
    FROM admission_plan
    WHERE source_province = '北京'
      AND COALESCE(group_min_score_1, min_score_1) BETWEEN 480 AND 510
    LIMIT 20
  `);
  console.log('  索引:', explain2[0].key || '无');
  console.log('  扫描行数:', explain2[0].rows);
  console.log('  额外信息:', explain2[0].Extra || '无');

  console.log('\n====================================');
  console.log('📊 性能总结:\n');
  console.log(`  3+1+2模式查询: ${time1}ms`);
  console.log(`  3+3模式查询: ${time2}ms`);
  console.log(`  院校名录查询: ${time3}ms`);
  console.log(`  专业查询: ${time4}ms`);
  console.log(`  平均响应时间: ${(time1 + time2 + time3 + time4) / 4}ms`);

  console.log('\n✅ 性能测试完成！');
  console.log('💡 提示: 如果查询时间仍>200ms，建议执行阶段2优化（添加虚拟列）');

  await conn.end();
}

performanceTest().catch(console.error);
