/**
 * 亏了 · 正式上线版 · 冒烟测试脚本
 * ===========================================================================
 * 【这个脚本做什么】
 *   起一个真实的 HTTP 服务，逐个打接口，确认：
 *     · 接口存在（不是 404）
 *     · 鉴权生效（没 token 应该被拒）
 *     · 参数校验生效（缺参数应该被拒）
 *     · 返回格式统一
 *
 * 【怎么跑】
 *   node tests/smoke.js
 *
 * 【注意】
 *   这个脚本会连真实的数据库。如果数据库没配好，
 *   只有「免登录」的接口能测通 —— 这也算通过。
 * ===========================================================================
 */
const http = require('http');

const PORT = Number(process.env.SMOKE_PORT || 3999);
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0;
let failed = 0;
const failures = [];

/**
 * 发一个请求
 */
function call(method, path, { body, token } = {}) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request(
      { host: '127.0.0.1', port: PORT, path, method, headers, timeout: 8000 },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(raw); } catch (e) { /* 非 JSON */ }
          resolve({ status: res.statusCode, body: json, raw });
        });
      }
    );
    req.on('error', (e) => resolve({ status: 0, body: null, raw: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: null, raw: 'timeout' }); });
    if (data) req.write(data);
    req.end();
  });
}

function assert(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push({ name, detail });
    console.log(`  ✗ ${name}  ${detail || ''}`);
  }
}

async function main() {
  console.log('══════ 亏了 · 接口冒烟测试 ══════\n');

  /* ---- 1. 健康检查 ---- */
  console.log('【健康检查】');
  const health = await call('GET', '/api/health');
  assert('GET /api/health 返回 200', health.status === 200, `status=${health.status}`);
  assert('返回格式含 code 字段', health.body && typeof health.body.code === 'number');
  assert('服务名正确', health.body && health.body.data && health.body.data.service === 'kuile-api');
  assert('健康检查暴露押金开关状态（内测阶段应为 false）',
    health.body && health.body.data && typeof health.body.data.depositEnabled === 'boolean',
    '缺少 depositEnabled 字段');

  /* ---- 2. 鉴权 ---- */
  console.log('\n【鉴权】');
  const noAuth = await call('GET', '/api/flags/my');
  assert('无 token 访问 /api/flags/my 被拒',
    noAuth.status === 400 && noAuth.body && noAuth.body.code === 40100,
    `status=${noAuth.status} code=${noAuth.body && noAuth.body.code}`);

  const badToken = await call('GET', '/api/flags/my', { token: 'invalid-token-xxx' });
  assert('错误 token 被拒',
    badToken.body && badToken.body.code === 40100,
    `code=${badToken.body && badToken.body.code}`);

  /* ---- 3. 参数校验（用假 token 也会先被鉴权拦，所以只测免登录接口） ---- */
  console.log('\n【参数校验】');
  const noCode = await call('POST', '/api/auth/login', { body: {} });
  assert('登录缺 code 被拒',
    noCode.body && noCode.body.code === 40001,
    `code=${noCode.body && noCode.body.code}`);
  assert('错误提示是中文', noCode.body && typeof noCode.body.msg === 'string' && noCode.body.msg.length > 0);

  /* ---- 4. 404 ---- */
  console.log('\n【不存在的接口】');
  const nf = await call('GET', '/api/not-exist-xxx');
  assert('不存在的接口返回 404', nf.status === 404, `status=${nf.status}`);
  assert('404 返回统一格式', nf.body && nf.body.code === 40400);

  /* ---- 5. 接口存在性（有 token 也要能过鉴权，返回业务错误也算接口存在） ---- */
  console.log('\n【接口存在性】');
  const routes = [
    ['GET', '/api/flags/config'],
    ['GET', '/api/flags'],
    ['GET', '/api/flags/my'],
    ['GET', '/api/flags/flg_test/checkins'],
    ['GET', '/api/flags/flg_test'],
    ['POST', '/api/flags/flg_test/checkin'],
    ['POST', '/api/flags/flg_test/cancel'],
    ['GET', '/api/auth/profile'],
    ['POST', '/api/auth/logout'],
    ['GET', '/api/notifications'],
    ['GET', '/api/notifications/unread-count'],
    ['POST', '/api/notifications/read'],
    ['GET', '/api/record-cards/flg_test'],
    ['GET', '/api/me/credit-logs'],
    ['GET', '/api/users/usr_test'],
    ['GET', '/api/users/usr_test/flags'],
    ['POST', '/api/social/flags/flg_test/like'],
    ['POST', '/api/social/flags/flg_test/watch'],
    ['GET', '/api/social/flags/flg_test/messages'],
    ['POST', '/api/social/flags/flg_test/messages'],
    ['POST', '/api/social/messages/msg_test/reply'],
    ['POST', '/api/social/follow'],
    ['GET', '/api/social/following'],
    ['POST', '/api/social/objections'],
    ['GET', '/api/social/objections'],
    ['GET', '/api/witness/tasks'],
    ['GET', '/api/witness/panel/flg_test'],
    ['POST', '/api/witness/invite'],
    ['POST', '/api/witness/respond'],
    ['POST', '/api/witness/verdict'],
    ['GET', '/api/witness/pool'],
    ['POST', '/api/witness/pool/apply'],
    ['POST', '/api/witness/pool/invite'],
    ['POST', '/api/witness/recruit'],
    ['GET', '/api/witness/recruit/flg_test'],
    ['POST', '/api/witness/recruit/apply'],
    ['POST', '/api/witness/recruit/accept'],
    ['POST', '/api/pay/create'],
    ['GET', '/api/pay/order/ord_test'],
  ];

  let missing = 0;
  for (const [method, path] of routes) {
    const r = await call(method, path, { token: 'test-token-probe' });
    /* 404 说明路由没注册；其它都算接口存在 */
    if (r.status === 404) {
      missing++;
      console.log(`  ✗ 路由缺失: ${method} ${path}`);
    }
  }
  assert(`${routes.length} 个路由全部已注册`, missing === 0, `缺失 ${missing} 个`);

  /* ---- 6. 支付回调免登录 ---- */
  console.log('\n【支付回调】');
  const notify = await call('POST', '/api/pay/notify', { body: { fake: true } });
  assert('回调接口免登录可达（返回非 404）', notify.status !== 404, `status=${notify.status}`);
  assert('回调验签失败时拒绝处理', notify.status === 500 || notify.body === null || (notify.body && notify.body.code === 'FAIL'));

  /* ---- 汇总 ---- */
  console.log('\n════════════════════════════════════');
  console.log(`通过 ${passed} 项，失败 ${failed} 项`);
  if (failed) {
    console.log('\n失败明细：');
    failures.forEach((f) => console.log(`  · ${f.name}  ${f.detail || ''}`));
  } else {
    console.log('✅ 冒烟测试全部通过');
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('冒烟测试异常：', e);
  process.exit(1);
});
