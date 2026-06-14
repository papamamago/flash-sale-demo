// test.js — 命令行并发压力测试
const http = require('http');

const BASE_URL = process.env.URL || 'http://localhost:3000';
const USERS = parseInt(process.env.USERS || '1000');
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '100');
const PRODUCT = process.env.PRODUCT || 'iphone-16';

let success = 0, fail = 0, start = 0;
let done = 0;

function flashBuy(userId) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ userId, productId: PRODUCT, quantity: 1 });
    const req = http.request(`${BASE_URL}/api/flash-buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          resolve(j);
        } catch { resolve({ code: -1 }); }
      });
    });
    req.on('error', () => resolve({ code: -1 }));
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log(`\n🔥 高并发秒杀压力测试`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  目标:   ${BASE_URL}`);
  console.log(`  用户:   ${USERS}`);
  console.log(`  并发:   ${CONCURRENCY}`);
  console.log(`  商品:   ${PRODUCT}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  start = Date.now();
  const users = Array.from({ length: USERS }, (_, i) => `loadtest_${String(i+1).padStart(5,'0')}`);

  for (let i = 0; i < users.length; i += CONCURRENCY) {
    const batch = users.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(uid => flashBuy(uid)));

    for (const r of results) {
      if (r.code === 0) success++;
      else fail++;
    }

    done = Math.min(i + CONCURRENCY, users.length);
    const pct = (done / users.length * 100).toFixed(1);
    process.stdout.write(`\r  📊 进度: ${pct}% |  成功: ${success}  |  失败: ${fail}`);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  const total = success + fail;
  const rate = total > 0 ? (success / total * 100).toFixed(1) : '0';

  console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ✅ 测试完成`);
  console.log(`  ⏱  耗时:    ${elapsed}s`);
  console.log(`  📦 总请求:  ${total}`);
  console.log(`  ✅ 成功:    ${success}`);
  console.log(`  ❌ 失败:    ${fail}`);
  console.log(`  📈 成功率:  ${rate}%`);
  if (elapsed > 0) {
    console.log(`  ⚡ QPS:     ${(total / parseFloat(elapsed)).toFixed(0)}/s`);
  }
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

run().catch(console.error);
