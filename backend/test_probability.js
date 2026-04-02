// 测试录取概率计算逻辑

function calculateProbability(userScore, minScore) {
  const scoreDiff = userScore - minScore;
  
  let probability;
  if (scoreDiff <= -20) {
    probability = 10;
  } else if (scoreDiff <= 0) {
    probability = 10 + (scoreDiff + 20) * 2;
  } else if (scoreDiff <= 10) {
    probability = 50 + scoreDiff * 3;
  } else if (scoreDiff <= 20) {
    probability = 80 + (scoreDiff - 10) * 1.5;
  } else {
    probability = Math.min(99, 95 + (scoreDiff - 20) * 0.4);
  }
  
  if (scoreDiff > 50) probability = 99;
  if (scoreDiff < -30) probability = 5;
  
  return Math.round(probability);
}

// 测试用例
console.log('===== 录取概率计算测试 =====\n');

console.log('用户分数：400分\n');

console.log('1. 专业最低分392分：');
const prob1 = calculateProbability(400, 392);
console.log(`   分差 = 400 - 392 = 8`);
console.log(`   概率 = ${prob1}%`);
console.log(`   推荐类型：${prob1 >= 80 ? '保' : (prob1 >= 50 ? '稳' : '冲')}\n`);

console.log('2. 专业最低分498分：');
const prob2 = calculateProbability(400, 498);
console.log(`   分差 = 400 - 498 = -98`);
console.log(`   概率 = ${prob2}%`);
console.log(`   推荐类型：${prob2 >= 80 ? '保' : (prob2 >= 50 ? '稳' : '冲')}\n`);

console.log('3. 专业最低分400分（相等）：');
const prob3 = calculateProbability(400, 400);
console.log(`   分差 = 400 - 400 = 0`);
console.log(`   概率 = ${prob3}%`);
console.log(`   推荐类型：${prob3 >= 80 ? '保' : (prob3 >= 50 ? '稳' : '冲')}\n`);

console.log('4. 专业最低分410分：');
const prob4 = calculateProbability(400, 410);
console.log(`   分差 = 400 - 410 = -10`);
console.log(`   概率 = ${prob4}%`);
console.log(`   推荐类型：${prob4 >= 80 ? '保' : (prob4 >= 50 ? '稳' : '冲')}\n`);

console.log('5. 专业最低分390分：');
const prob5 = calculateProbability(400, 390);
console.log(`   分差 = 400 - 390 = 10`);
console.log(`   概率 = ${prob5}%`);
console.log(`   推荐类型：${prob5 >= 80 ? '保' : (prob5 >= 50 ? '稳' : '冲')}\n`);

console.log('6. 专业最低分420分：');
const prob6 = calculateProbability(400, 420);
console.log(`   分差 = 400 - 420 = -20`);
console.log(`   概率 = ${prob6}%`);
console.log(`   推荐类型：${prob6 >= 80 ? '保' : (prob6 >= 50 ? '稳' : '冲')}\n`);

console.log('7. 专业最低分380分：');
const prob7 = calculateProbability(400, 380);
console.log(`   分差 = 400 - 380 = 20`);
console.log(`   概率 = ${prob7}%`);
console.log(`   推荐类型：${prob7 >= 80 ? '保' : (prob7 >= 50 ? '稳' : '冲')}\n`);
