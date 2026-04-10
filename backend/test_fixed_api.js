// 模拟前端修改后的调用逻辑
const http = require('http');

function testAPI(subjectCombination) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      schoolCode: '2100',
      groupCode: '102',
      region: '河南',
      subjectCombination: subjectCombination,
      schoolName: '西安建筑科技大学'
    });

    const url = `http://localhost:3000/api/school-group-majors?${params.toString()}`;
    console.log(`\n测试 subjectCombination='${subjectCombination}'`);

    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.success) {
            const typeCount = {};
            result.data.forEach(r => {
              typeCount[r.subject_type] = (typeCount[r.subject_type] || 0) + 1;
            });
            console.log(`  结果: ${result.data.length}条, subject_type分布: ${JSON.stringify(typeCount)}`);
            if (result.data.length > 0) {
              console.log(`  第一条数据:`, JSON.stringify(result.data[0], null, 2));
            }
            resolve(result.data.length);
          } else {
            console.log(`  错误: ${result.error}`);
            resolve(0);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('========== 测试修改后的API ==========');

  // 测试1：完整选科组合
  await testAPI('物理,化学,生物');

  // 测试2：只有必选科目（修改后的前端会发送这个）
  await testAPI('物理');

  // 测试3：空字符串（用户完全没选）
  await testAPI('');

  // 测试4：历史类
  await testAPI('历史,政治,地理');

  console.log('\n测试完成');
}

runTests().catch(console.error);
