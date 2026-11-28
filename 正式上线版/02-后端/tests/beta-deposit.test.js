/**
 * 亏了 · 正式上线版 · 内测阶段「暂不收押金」专项测试
 * ===========================================================================
 * 【小白须知】这个文件专门盯一件事：
 *   内测阶段（DEPOSIT_ENABLED=false）不真的收押金，
 *   但【押金档位照常显示、照常记录】，
 *   而且【结算时不能扣收、不能退款】。
 *
 * 【怎么跑】
 *   cd 02-后端
 *   node tests/beta-deposit.test.js
 *
 * 【它测什么】
 *   ✓ 内测开关默认是关的（安全默认值）
 *   ✓ 内测模式下 /api/pay/create 不创建订单、不调微信支付
 *   ✓ 内测模式下结算不扣收押金、不发起退款
 *   ✓ 内测模式下结算通知不说「押金已退」（避免虚假告知）
 *   ✓ 正式收押金模式下结算照常扣收与退款
 *   ✓ 名义押金（deposit_amount）始终保留在数据库里
 *   ✓ 开关中途翻转不会资损（收过的钱一定退，没收过的钱绝不退）
 * ===========================================================================
 */
const assert = require('assert');
const { makeMemDb } = require('./_memdb');

/* ---------------------------------------------------------------------------
 * 1. 注入 mock：数据库 / 微信支付 / 配置开关
 * ------------------------------------------------------------------------ */
const memDb = makeMemDb();
const dbPath = require.resolve('../src/db');
require.cache[dbPath] = {
  id: dbPath, filename: dbPath, loaded: true, exports: memDb,
};

/* 支付 mock（不真的调微信），顺便记录有没有发起过退款 */
const payPath = require.resolve('../src/services/wechatPay');
const payCalls = [];
require.cache[payPath] = {
  id: payPath, filename: payPath, loaded: true,
  exports: {
    refundDeposit: async function (p) {
      payCalls.push(p);
      return { refundNo: 'rf_test', status: 'SUCCESS', amount: p.refundAmount };
    },
    createPayment: async () => ({}),
    queryOrder: async () => ({ tradeState: 'SUCCESS' }),
    onPaySuccess: async () => ({}),
    verifyAndDecryptNotify: () => ({}),
  },
};

/* 配置 mock：让我们能随时切换「内测 / 正式收押金」 */
const configPath = require.resolve('../src/config');
const config = require(configPath);
require.cache[configPath] = {
  id: configPath, filename: configPath, loaded: true, exports: config,
};

const flagService = require('../src/services/flagService');
const R = require('../src/domain/rules');

/* 记录有没有真的调过「创建微信支付单」 */
let createPaymentCalls = 0;
const payPath2 = require.resolve('../src/services/wechatPay');
const realPay = require.cache[payPath2].exports;
require.cache[payPath2].exports = Object.assign({}, realPay, {
  createPayment: async function (p) {
    createPaymentCalls++;
    return { timeStamp: '1', nonceStr: 'n', package: 'p', signType: 'RSA', paySign: 's' };
  },
});

/* Express 路由测试用的迷你宿主：直接调路由 handler */
const payRouter = require('../src/routes/pay');

/**
 * 直接调用一个 express 路由的 handler
 *
 * 【为什么要自己搭这个迷你宿主】
 *   真实请求要起 HTTP 服务、要真数据库。这里用内存数据库 + 直接调 handler，
 *   就能在【不装 MySQL、不连微信】的前提下测路由分支。
 *
 * 【注意】express 的 handler 调 res.json() 之后【不会再调 next()】，
 *   所以必须由 res.json 主动把 Promise 解掉，否则会挂住。
 */
async function callRoute(router, method, path, body, userId) {
  const layer = router.stack.find(l => l.route && l.route.path === path
    && l.route.methods[method.toLowerCase()]);
  if (!layer) throw new Error('路由没找到：' + method + ' ' + path);

  /* 造一个能通过的登录态 */
  const token = 'test-token-' + userId;
  await memDb.execute(
    `INSERT INTO session (token, user_id, expires_at) VALUES (?, ?, ?)`,
    [token, userId, new Date(Date.now() + 86400000).toISOString()]
  );

  const req = {
    body: body || {},
    headers: { authorization: 'Bearer ' + token },
    query: {},
    params: {},
  };

  let result = null;
  let resolveDone;
  const done = new Promise(r => { resolveDone = r; });

  const res = {
    json(v) {
      result = v;
      resolveDone();
      return this;
    },
    status() { return this; },
  };

  /* 依次跑这一层的所有 handler（鉴权 → 业务） */
  const handlers = layer.route.stack.map(l => l.handle);
  let i = 0;
  const next = (err) => {
    if (err) {
      result = { code: err.code || 50000, msg: err.message };
      return resolveDone();
    }
    if (i >= handlers.length) {
      /* 没有 handler 调 res.json —— 视为失败，而不是静默通过 */
      result = { code: 59999, msg: '路由没有响应（没有调用 res.json）' };
      return resolveDone();
    }
    const h = handlers[i++];
    try {
      const r = h(req, res, next);
      if (r && typeof r.then === 'function') r.catch(e => next(e));
    } catch (e) {
      next(e);
    }
  };
  next();

  await done;
  return result;
}

/* ---------------------------------------------------------------------------
 * 2. 测试脚手架
 * ------------------------------------------------------------------------ */
let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    failures.push({ name, message: e.message });
    console.log(`  ✗ ${name}\n      ${e.message}`);
  }
}

function group(title) {
  console.log(`\n【${title}】`);
}

/**
 * 造一个用户 + 一个「注定失败」的 7 天 Flag（押金已实付 200 元）
 * 返回 flagId
 */
async function makeFailingFlag(userId, depositPaid) {
  const f = await flagService.createFlag({
    userId,
    title: '内测测试局',
    reason: '',
    startWeight: 70,
    targetWeight: 60,     /* 目标远低于起始 → 必定没达标 */
    periodDays: 7,
    depositAmount: 200,
  });
  const id = f.id;
  await memDb.execute(
    'UPDATE flag SET prep_end_at = ?, status = ?, deposit_paid = ?, deposit_amount = ? WHERE id = ?',
    [new Date(Date.now() - 1000).toISOString(), 'running', depositPaid, 200, id]
  );
  /* 打卡 7 天，但体重没降 */
  for (let d = 1; d <= 7; d++) {
    await memDb.execute(
      `INSERT INTO checkin (id, flag_id, user_id, day_index, check_date, weight, handwrite, status, is_node_day)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ok', ?)`,
      ['bc_' + userId + '_' + d, id, userId, d, '2026-12-0' + d, 70.5, 'x', d === 7 ? 1 : 0]
    );
  }
  await memDb.execute('UPDATE flag SET checked_days = 7 WHERE id = ?', [id]);
  return id;
}

/* ---------------------------------------------------------------------------
 * 3. 测试
 * ------------------------------------------------------------------------ */
async function main() {
  console.log('══════ 内测阶段 · 暂不收押金 专项测试 ══════');

  /* ---- 一、开关默认值 ---- */
  group('押金总开关');

  await test('默认配置里 DEPOSIT_ENABLED 是 false（安全默认值：不收钱）', () => {
    /* 直接读真实 config 对象 —— 未显式设置环境变量时必须是关闭状态 */
    const raw = require('fs').readFileSync(require.resolve('../src/config'), 'utf8');
    assert.ok(
      /bool\('DEPOSIT_ENABLED',\s*false\)/.test(raw),
      'config.js 里 DEPOSIT_ENABLED 的默认值必须是 false'
    );
  });

  await test('config.deposit.enabled 是布尔值（能被 .env 覆盖）', () => {
    assert.strictEqual(typeof config.deposit.enabled, 'boolean');
  });

  /* ---- 二、内测模式：结算不扣收 ---- */
  group('内测阶段（DEPOSIT_ENABLED=false）');

  await memDb.execute(
    `INSERT INTO user (id, openid, nickname, avatar_url, credit_score, flags_created)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['usr_beta', 'ox_beta', '内测用户', '', 60, 0]
  );
  await memDb.execute('INSERT INTO user_stat (user_id) VALUES (?)', ['usr_beta']);

  await test('内测阶段结算失败：押金扣收金额为 0', async () => {
    config.deposit.enabled = false;
    const before = payCalls.length;
    /* ⚠️ 内测局：名义押金 200，但【实收 0】—— 这正是内测期的真实状态
       （/api/pay/create 在内测模式下把 deposit_paid 写成 0） */
    const id = await makeFailingFlag('usr_beta', 0);
    const r = await flagService.settleFlag(id, { reason: 'auto' });

    assert.strictEqual(r.success, false, '应当判定失败');
    assert.strictEqual(r.deduct, 0, `内测阶段不应扣收押金，实际 ${r.deduct}`);
    assert.strictEqual(r.refund, 0, '内测阶段不应有退款');
    assert.strictEqual(payCalls.length, before, '内测阶段不应发起微信退款');
  });

  await test('内测阶段：数据库里的 lost_amount 记 0', async () => {
    const rows = await memDb.query(
      `SELECT lost_amount FROM flag WHERE user_id = ? AND status = 'failed'`,
      ['usr_beta']
    );
    assert.ok(rows.length >= 1, '应有结算失败的记录');
    assert.strictEqual(Number(rows[0].lost_amount), 0, 'lost_amount 应为 0');
  });

  await test('内测阶段：名义押金 deposit_amount 仍然保留在数据库里', async () => {
    const f = await memDb.queryOne(
      `SELECT deposit_amount, deposit_paid FROM flag WHERE user_id = ? AND status = 'failed'`,
      ['usr_beta']
    );
    assert.strictEqual(Number(f.deposit_amount), 200, '名义押金应保留（内测期统计要用）');
    assert.strictEqual(Number(f.deposit_paid), 0, '实收应为 0（内测期确实没收钱）');
  });

  await test('内测阶段：结算通知不说「押金已退」（避免虚假告知）', async () => {
    const n = await memDb.queryOne(
      `SELECT content FROM notification WHERE user_id = ? AND type = 'flag_failed'`,
      ['usr_beta']
    );
    assert.ok(n, '应有结算通知');
    assert.ok(
      !/押金.*退回|已原路退回/.test(n.content),
      `通知里不该出现「押金已退回」，实际：${n.content}`
    );
    assert.ok(/内测阶段/.test(n.content), `通知里应说明「内测阶段」，实际：${n.content}`);
  });

  await test('内测阶段：失败仍然照常扣信用分（承诺本身照样生效）', async () => {
    const u = await memDb.queryOne('SELECT credit_score FROM user WHERE id = ?', ['usr_beta']);
    assert.strictEqual(Number(u.credit_score), 57, '7 天失败 T0 应扣 3 分（60 → 57）');
  });

  /* ---- 三、正式模式：结算照常扣收与退款 ---- */
  group('正式收押金（DEPOSIT_ENABLED=true）');

  await memDb.execute(
    `INSERT INTO user (id, openid, nickname, avatar_url, credit_score, flags_created)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['usr_pay', 'ox_pay', '正式用户', '', 60, 0]
  );
  await memDb.execute('INSERT INTO user_stat (user_id) VALUES (?)', ['usr_pay']);

  await test('正式模式：结算失败按规则扣收押金并发起退款', async () => {
    config.deposit.enabled = true;
    const before = payCalls.length;
    const id = await makeFailingFlag('usr_pay', 200);
    const r = await flagService.settleFlag(id, { reason: 'auto' });

    /* 普通等级 60 分 → 失败扣收 35% → 扣 70 元，退 130 元 */
    assert.strictEqual(r.deduct, 70, `应扣 70 元，实际 ${r.deduct}`);
    assert.strictEqual(r.refund, 130, `应退 130 元，实际 ${r.refund}`);
    assert.strictEqual(payCalls.length, before + 1, '正式模式应发起一次微信退款');
  });

  await test('正式模式：lost_amount 记真实扣收额', async () => {
    const f = await memDb.queryOne(
      `SELECT lost_amount FROM flag WHERE user_id = ? AND status = 'failed'`,
      ['usr_pay']
    );
    assert.strictEqual(Number(f.lost_amount), 70, 'lost_amount 应为真实扣收额');
  });

  await test('正式模式：结算通知照常写「押金已退」', async () => {
    const n = await memDb.queryOne(
      `SELECT content FROM notification WHERE user_id = ? AND type = 'flag_failed'`,
      ['usr_pay']
    );
    assert.ok(n, '应有结算通知');
    assert.ok(/扣收押金/.test(n.content), `正式模式通知应写「扣收押金」，实际：${n.content}`);
  });

  /* ---- 四、开关翻转：内测建的局，等开关打开后才结算 ---- */
  group('开关中途翻转（最容易出资损的场景）');

  /* ⚠️ 每个场景用【独立用户】——
     因为每结算一次就会扣一次信用分，信用分变了费率就会变（60 分普通档 35%，
     57 分还是普通档，但再往下就可能跨档），会让断言互相干扰。 */
  await memDb.execute(
    `INSERT INTO user (id, openid, nickname, avatar_url, credit_score, flags_created)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['usr_flip_a', 'ox_flip_a', '翻转用户A', '', 60, 0]
  );
  await memDb.execute('INSERT INTO user_stat (user_id) VALUES (?)', ['usr_flip_a']);

  await memDb.execute(
    `INSERT INTO user (id, openid, nickname, avatar_url, credit_score, flags_created)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['usr_flip_b', 'ox_flip_b', '翻转用户B', '', 60, 0]
  );
  await memDb.execute('INSERT INTO user_stat (user_id) VALUES (?)', ['usr_flip_b']);

  await test('内测期建的局（实收 0），即使后来打开开关，结算也不退款不扣收', async () => {
    /* 内测期建局：名义押金 200，实收 0 */
    config.deposit.enabled = false;
    const id = await makeFailingFlag('usr_flip_a', 0);
    const f0 = await memDb.queryOne('SELECT deposit_amount FROM flag WHERE id = ?', [id]);
    assert.strictEqual(Number(f0.deposit_amount), 200, '名义押金应是 200');

    /* ⚠️ 关键：结算之前把开关打开了 —— 这一局仍然不该退款 */
    config.deposit.enabled = true;
    const before = payCalls.length;
    const r = await flagService.settleFlag(id, { reason: 'auto' });

    assert.strictEqual(r.deduct, 0, '不该扣收');
    assert.strictEqual(r.refund, 0, '不该退款');
    assert.strictEqual(payCalls.length, before, '绝不能发起从未收到过钱的退款');
  });

  await test('开关翻转后：通知仍按「内测阶段不扣押金」口径', async () => {
    const n = await memDb.queryOne(
      `SELECT content FROM notification WHERE user_id = ? AND type = 'flag_failed'`,
      ['usr_flip_a']
    );
    assert.ok(n, '应有结算通知');
    assert.ok(
      !/扣收押金|已原路退回/.test(n.content),
      `不该出现「扣收押金 / 已退回」，实际：${n.content}`
    );
  });

  await test('正式期建的局（实收 200），即使后来关掉开关，结算照常退款', async () => {
    /* 正式期建局：实收 200 */
    config.deposit.enabled = true;
    const id = await makeFailingFlag('usr_flip_b', 200);

    /* ⚠️ 关键：结算之前把开关关掉了 —— 这一局仍然必须退款 */
    config.deposit.enabled = false;
    const before = payCalls.length;
    const r = await flagService.settleFlag(id, { reason: 'auto' });

    assert.strictEqual(r.deduct, 70, `应扣 70 元，实际 ${r.deduct}`);
    assert.strictEqual(r.refund, 130, `应退 130 元，实际 ${r.refund}`);
    assert.strictEqual(payCalls.length, before + 1, '收了钱就必须退，不能因为开关关了就不退');
  });

  /* ---- 五、/api/pay/create 内测分支 ---- */
  group('支付接口（/api/pay/create）');

  await memDb.execute(
    `INSERT INTO user (id, openid, nickname, avatar_url, credit_score, flags_created)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['usr_api', 'ox_api', '接口用户', '', 60, 0]
  );
  await memDb.execute('INSERT INTO user_stat (user_id) VALUES (?)', ['usr_api']);

  await test('内测模式：/api/pay/create 返回 beta:true 且不创建微信支付单', async () => {
    config.deposit.enabled = false;
    const before = createPaymentCalls;

    /* 建一局有名义押金的（模拟第 2 个 Flag，绕过新人保护） */
    const f = await flagService.createFlag({
      userId: 'usr_api',
      title: '接口测试局',
      reason: '',
      startWeight: 70,
      targetWeight: 68,
      periodDays: 7,
      depositAmount: 200,
    });
    /* 绕过新人保护，直接把名义押金写成 200 */
    await memDb.execute(
      'UPDATE flag SET deposit_amount = ?, deposit_status = ?, flags_created = ? WHERE id = ?',
      [200, 'none', 1, f.id]
    );

    const res = await callRoute(payRouter, 'POST', '/create', { flagId: f.id }, 'usr_api');
    assert.ok(res && res.code === 0, `应返回成功，实际：${JSON.stringify(res)}`);
    assert.strictEqual(res.data.beta, true, '应带 beta 标记');
    assert.strictEqual(res.data.amount, 0, '实收应为 0');
    assert.strictEqual(res.data.nominalAmount, 200, '名义押金应保留并回传');
    assert.ok(/内测阶段/.test(res.data.message), `提示语应为内测口径，实际：${res.data.message}`);
    assert.strictEqual(createPaymentCalls, before, '内测模式绝不能调微信支付下单');
  });

  await test('内测模式：这一局的 deposit_paid 记 0、deposit_amount 保留 200', async () => {
    const f = await memDb.queryOne(
      `SELECT deposit_amount, deposit_paid, deposit_status FROM flag WHERE title = ?`,
      ['接口测试局']
    );
    assert.strictEqual(Number(f.deposit_amount), 200, '名义押金应保留');
    assert.strictEqual(Number(f.deposit_paid), 0, '实收应为 0');
    assert.strictEqual(f.deposit_status, 'paid', '状态应标为已支付（免收）');
  });

  await test('内测模式：没有生成任何微信支付订单', async () => {
    const orders = await memDb.query('SELECT * FROM pay_order');
    assert.strictEqual(orders.length, 0, `不该有支付订单，实际 ${orders.length} 条`);
  });

  await test('正式模式：/api/pay/create 会真正下单并返回支付参数', async () => {
    config.deposit.enabled = true;
    const before = createPaymentCalls;

    const f = await flagService.createFlag({
      userId: 'usr_api',
      title: '接口测试局2',
      reason: '',
      startWeight: 70,
      targetWeight: 68,
      periodDays: 7,
      depositAmount: 200,
    });
    await memDb.execute(
      'UPDATE flag SET deposit_amount = ?, deposit_status = ? WHERE id = ?',
      [200, 'none', f.id]
    );

    const res = await callRoute(payRouter, 'POST', '/create', { flagId: f.id }, 'usr_api');
    assert.ok(res && res.code === 0, `应返回成功，实际：${JSON.stringify(res)}`);
    assert.strictEqual(res.data.beta, undefined, '正式模式不应带 beta 标记');
    assert.strictEqual(res.data.amount, 200, '应付金额应是 200');
    assert.ok(res.data.payParams, '应返回微信支付参数');
    assert.strictEqual(createPaymentCalls, before + 1, '正式模式应调一次微信支付下单');
  });

  await test('正式模式：内测期建过的局仍能补缴（不会被「已支付」挡住）', async () => {
    /* 这一局是内测期建的：deposit_status='paid' 但实收 0 */
    const f = await memDb.queryOne(
      `SELECT id FROM flag WHERE title = ?`,
      ['接口测试局']
    );
    const res = await callRoute(payRouter, 'POST', '/create', { flagId: f.id }, 'usr_api');
    assert.ok(res && res.code === 0, `内测局应能补缴，实际：${JSON.stringify(res)}`);
    assert.strictEqual(res.data.amount, 200, '应付金额应是 200');
  });

  /* 收尾：把开关恢复成默认（内测） */
  config.deposit.enabled = false;

  /* ---- 汇总 ---- */
  console.log('\n════════════════════════════════════');
  console.log(`通过 ${passed} 项，失败 ${failed} 项`);
  if (failed) {
    console.log('\n失败明细：');
    failures.forEach(f => console.log(`  · ${f.name}\n      ${f.message}`));
    process.exit(1);
  }
  console.log('✅ 内测阶段「暂不收押金」行为全部符合预期');
}

main().catch((e) => {
  console.error('测试异常：', e);
  process.exit(1);
});
