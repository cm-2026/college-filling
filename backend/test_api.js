const http = require('http');
const body = JSON.stringify({score:550,subjectCombination:'物理,化学,生物',region:'河南',targetRegion:''});
const req = http.request({
  hostname:'localhost',port:3000,
  path:'/api/recommend-from-db',method:'POST',
  headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
}, res => {
  let data='';
  res.on('data', d => data+=d);
  res.on('end', () => {
    const j = JSON.parse(data);
    console.log('count:', j.data ? j.data.length : 'no data');
    if(j.data && j.data.length > 0) {
      j.data.slice(0,3).forEach(r => console.log('  ', r.name, '|', r.major, '| 分:', r.score, '| P' + r.matchPriority));
    } else {
      console.log('error:', j.error || 'unknown');
    }
  });
});
req.write(body);
req.end();
