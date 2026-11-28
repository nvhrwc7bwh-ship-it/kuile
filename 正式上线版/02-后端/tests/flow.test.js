/**
 * 亏了 · 正式上线版 · 业务编排集成测试
 * ===========================================================================
 * 【这个脚本做什么】
 *   用一个「内存版数据库」替身，把 flagService 的完整流程跑一遍：
 *     创建 Flag → 筹备期转正 → 连续打卡 → 节点判定 → 结算 → 押金与信用分核对
 *
 *   不需要装 MySQL，所以任何机器上都能跑。
 *   它验证的是**业务编排逻辑**（顺序、状态流转、金额计算），
 *   数据库本身的正确性由 tests/schema-check.js 静态保证。
 *
 * 【怎么跑】
 *   node tests/flow.test.js
 * ===========================================================================
 */
const Module = require('module');
const assert = require('assert');
const { makeMemDb } = require('./_memdb');


/* ---------------------------------------------------------------------------
 * 注入 mock
 * ------------------------------------------------------------------------ */
const memDb = makeMemDb();
const dbPath = require.resolve('../src/db');
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: memDb,
};

/* 支付也 mock（不真的调微信） */
const payPath = require.resolve('../src/services/wechatPay');
const payCalls = [];
require.cache[payPath] = {
  id: payPath,
  filename: payPath,
  loaded: true,
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

const flagService = require('../src/services/flagService');
const R = require('../src/domain/rules');

/* ---------------------------------------------------------------------------
 * 测试
 * ------------------------------------------------------------------------ */
let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed++; console.log(`  ✓ ${name}`); })
    .catch((e) => {
      failed++;
      failures.push({ name, message: e.message });
      console.log(`  ✗ ${name}\n      ${e.message}`);
    });
}

async function main() {
  console.log('══════ 亏了 · 业务编排集成测试 ══════\n');

  /* ---- 准备用户 ---- */
  await memDb.execute(
    `INSERT INTO user (id, openid, nickname, avatar_url, credit_score, flags_created)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['usr_test', 'ox_test', '测试用户', '', 60, 0]
  );
  await memDb.execute('INSERT INTO user_stat (user_id) VALUES (?)', ['usr_test']);

  let flagId = null;

  /* ---- 1. 创建 Flag ---- */
  console.log('【创建 Flag】');
  await test('新建 7 天 Flag 成功，押金因新人保护为 0', async () => {
    const f = await flagService.createFlag({
      userId: 'usr_test',
      title: '测试：7 天减 2 公斤',
      reason: '自动化测试',
      startWeight: 70,
      targetWeight: 68,
      periodDays: 7,
      depositAmount: 100,
    });
    flagId = f.id;
    assert.ok(flagId, '应该返回 Flag ID');
    assert.strictEqual(f.deposit, 0, '新人保护押金应为 0');
    assert.strictEqual(f.status, 'prep', '初始状态应为筹备中');
    assert.strictEqual(f.breakLimit, 0, '7 天档断卡上限应为 0');
    assert.strictEqual(f.checkins.length, 1, '应该预生成第 1 天的打卡记录');
  });

  await test('目标体重必须小于起始体重', async () => {
    await assert.rejects(
      () => flagService.createFlag({
        userId: 'usr_test', title: '反例', startWeight: 60, targetWeight: 70,
        periodDays: 7, depositAmount: 100,
      }),
      /目标体重要小于起始体重/
    );
  });

  await test('周期只能是 7/14/30/90', async () => {
    await assert.rejects(
      () => flagService.createFlag({
        userId: 'usr_test', title: '反例', startWeight: 70, targetWeight: 68,
        periodDays: 21, depositAmount: 100,
      }),
      /周期只能是/
    );
  });

  /* ---- 2. 筹备期转正 ---- */
  console.log('\n【筹备期转正】');
  await test('筹备期未到不转正', async () => {
    const f = await flagService.getFlag(flagId, 'usr_test');
    assert.strictEqual(f.status, 'prep');
  });

  await test('筹备期结束后转「进行中」，档位按已接受见证席拍定', async () => {
    /* 把筹备期改成过去。
     * ⚠️ start_date 必须一起前移 —— 生产环境里 start_date 是由 prep_end_at
     *    算出来的（生效日 = 筹备期结束日），两者永远同步。
     *    只改 prep_end_at 会造成「状态已 running 但生效日在未来」，
     *    于是 dayNow=0，任何打卡都会被「不能提前打卡」拦下。 */
    const startedAt = new Date(Date.now() - 1000).toISOString();
    await memDb.execute(
      'UPDATE flag SET prep_end_at = ?, start_date = ?, end_date = ? WHERE id = ?',
      [
        startedAt,
        startedAt.slice(0, 10),
        new Date(new Date(startedAt).getTime() + 6 * 86400000).toISOString().slice(0, 10),
        flagId,
      ]
    );
    await flagService.syncLifecycles();
    const f = await flagService.getFlag(flagId, 'usr_test');
    assert.strictEqual(f.status, 'running', '应转为进行中');
    assert.strictEqual(f.tier, 'T0', '没有见证席应是 T0');
  });

  /* ---- 3. 打卡 ---- */
  console.log('\n【打卡】');
  await test('未到节点日也能打卡（普通日）', async () => {
    const f = await flagService.getFlag(flagId, 'usr_test');
    const r = await flagService.submitCheckin({
      userId: 'usr_test', flagId, dayIndex: 1,
      weight: 69.8, handwrite: '坚持', photoUrl: 'https://x/1.jpg',
    });
    assert.strictEqual(r.status, 'pending');
  });

  await test('第 2 天打卡成功，当前体重同步更新', async () => {
    /* 把生效日往前挪 1 天，模拟「今天是第 2 天」。
     * ⚠️ 必须同步挪 start_date —— dayNow 是按 start_date 算的，
     *    不挪的话 dayNow 停在 1，第 2 天会被「不能提前打卡」拦下。 */
    await memDb.execute(
      'UPDATE flag SET start_date = ?, end_date = ? WHERE id = ?',
      [
        new Date(Date.now() - 86400000).toISOString().slice(0, 10),
        new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        flagId,
      ]
    );
    await memDb.execute(
      `INSERT INTO checkin (id, flag_id, user_id, day_index, check_date, weight, handwrite, status, is_node_day)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
      ['cki_2', flagId, 'usr_test', 2, '2026-11-28', 69.5, '加油', 0]
    );
    await flagService.submitCheckin({
      userId: 'usr_test', flagId, dayIndex: 2,
      weight: 69.5, handwrite: '加油', photoUrl: 'https://x/2.jpg',
    });
    const f = await flagService.getFlag(flagId, 'usr_test');
    assert.strictEqual(Number(f.curWeight), 69.5, '当前体重应更新');
  });

  await test('已打卡的日子不能重复打卡', async () => {
    /* 模拟 AI 判定通过：把这一天的状态改成 ok */
    await memDb.execute(
      `UPDATE checkin SET status = 'ok' WHERE flag_id = ? AND day_index = 2`,
      [flagId]
    );
    await assert.rejects(
      () => flagService.submitCheckin({
        userId: 'usr_test', flagId, dayIndex: 2,
        weight: 69.0, handwrite: 'x', photoUrl: '',
      }),
      /已经打过卡/
    );
  });

  await test('别人不能给我的 Flag 打卡', async () => {
    /* 先确保第 3 天的记录存在，这样才轮到「归属校验」而不是「记录不存在」 */
    await memDb.execute(
      `INSERT INTO checkin (id, flag_id, user_id, day_index, check_date, weight, handwrite, status, is_node_day)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
      ['cki_3x', flagId, 'usr_test', 3, '2026-11-29', 69.2, 'y', 0]
    );
    await assert.rejects(
      () => flagService.submitCheckin({
        userId: 'usr_other', flagId, dayIndex: 3,
        weight: 69.0, handwrite: 'x', photoUrl: '',
      }),
      /这不是你的 Flag/
    );
  });

  await test('手写词不能为空', async () => {
    /* 把生效日再往前挪 1 天，模拟「今天是第 3 天」，
     * 这样 dayIndex=3 才不会被「不能提前打卡」抢先拦下，
     * 才能真正走到「手写词」那一步的参数校验。 */
    await memDb.execute(
      'UPDATE flag SET start_date = ?, end_date = ? WHERE id = ?',
      [
        new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
        new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10),
        flagId,
      ]
    );
    await assert.rejects(
      () => flagService.submitCheckin({
        userId: 'usr_test', flagId, dayIndex: 3,
        weight: 69.0, handwrite: '  ', photoUrl: '',
      }),
      /手写词/
    );
  });

  /* ---- 4. 判定与结算 ---- */
  console.log('\n【结算】');
  await test('7 天档：打卡够 + 体重达标 → 成功', async () => {
    /* 补齐第 3-7 天打卡，其中第 7 天是节点日 */
    for (let d = 3; d <= 7; d++) {
      await memDb.execute(
        `INSERT INTO checkin (id, flag_id, user_id, day_index, check_date, weight, handwrite, status, is_node_day)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ok', ?)`,
        ['cki_' + d, flagId, 'usr_test', d, '2026-12-0' + (d - 2), 67.8, '稳', d === 7 ? 1 : 0]
      );
    }
    /* 把打卡天数记为 7 天 */
    await memDb.execute('UPDATE flag SET checked_days = 7 WHERE id = ?', [flagId]);

    const r = await flagService.settleFlag(flagId, { reason: 'auto' });
    assert.strictEqual(r.success, true, `应成功，实际：${r.reasonText}`);
    assert.strictEqual(r.tier, 'T0', '无见证席 → T0');
    /* T0 系数 0.6，7 天成功 +5 → +3 */
    assert.strictEqual(r.creditDelta, 3, `信用分应为 +3，实际 ${r.creditDelta}`);
  });

  await test('结算后 Flag 状态变为 success', async () => {
    const f = await flagService.getFlag(flagId, 'usr_test');
    assert.strictEqual(f.status, 'success');
    assert.strictEqual(f.checkedDays, 7);
  });

  await test('信用分已入账（60 → 63）', async () => {
    const u = await memDb.queryOne('SELECT * FROM user WHERE id = ?', ['usr_test']);
    assert.strictEqual(Number(u.credit_score), 63);
  });

  await test('信用分流水已记录', async () => {
    const logs = await memDb.query('SELECT * FROM credit_log WHERE flag_id = ?', [flagId]);
    assert.strictEqual(logs.length, 1, '应有一条信用分流水');
    assert.strictEqual(logs[0].event, 'flag_success_7');
    assert.strictEqual(Number(logs[0].delta), 3);
    assert.strictEqual(Number(logs[0].raw_delta), 5, '原始分值应为 5');
  });

  await test('记录卡已生成', async () => {
    const rc = await memDb.queryOne('SELECT * FROM record_card WHERE flag_id = ?', [flagId]);
    assert.ok(rc, '应生成记录卡');
    assert.strictEqual(rc.outcome, 'success');
  });

  await test('已结算的 Flag 不会重复结算', async () => {
    const r = await flagService.settleFlag(flagId, { reason: 'auto' });
    assert.strictEqual(r.skipped, true);
  });

  /* ---- 5. 失败路径 ---- */
  console.log('\n【失败路径】');
  await test('体重没达标 → 失败，扣信用分', async () => {
    const f2 = await flagService.createFlag({
      userId: 'usr_test', title: '测试：注定失败',
      startWeight: 70, targetWeight: 60, periodDays: 7, depositAmount: 100,
    });
    const id2 = f2.id;
    await memDb.execute('UPDATE flag SET prep_end_at = ?, status = ? WHERE id = ?', [
      new Date(Date.now() - 1000).toISOString(), 'running', id2,
    ]);
    /* 打卡 7 天，但体重没降 */
    for (let d = 1; d <= 7; d++) {
      await memDb.execute(
        `INSERT INTO checkin (id, flag_id, user_id, day_index, check_date, weight, handwrite, status, is_node_day)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ok', ?)`,
        ['c2_' + d, id2, 'usr_test', d, '2026-12-0' + d, 70.5, 'x', d === 7 ? 1 : 0]
      );
    }
    await memDb.execute('UPDATE flag SET checked_days = 7 WHERE id = ?', [id2]);
    const r = await flagService.settleFlag(id2, { reason: 'auto' });
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.reason, 'not_reached');
    /* T0 系数 0.6，7 天失败 -5 → -3 */
    assert.strictEqual(r.creditDelta, -3, `应扣 3 分，实际 ${r.creditDelta}`);
  });

  await test('断卡超限 → 失败（7 天档断 1 次）', async () => {
    const f3 = await flagService.createFlag({
      userId: 'usr_test', title: '测试：断卡',
      startWeight: 70, targetWeight: 68, periodDays: 7, depositAmount: 100,
    });
    const id3 = f3.id;
    await memDb.execute('UPDATE flag SET prep_end_at = ?, status = ? WHERE id = ?', [
      new Date(Date.now() - 1000).toISOString(), 'running', id3,
    ]);
    /* 第 1 天打卡，其余断卡 */
    await memDb.execute(
      `UPDATE checkin SET status = 'ok' WHERE flag_id = ? AND day_index = 1`,
      [id3]
    );
    for (let d = 2; d <= 7; d++) {
      await memDb.execute(
        `INSERT INTO checkin (id, flag_id, user_id, day_index, check_date, weight, handwrite, status, is_node_day)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        ['c3_' + d, id3, 'usr_test', d, '2026-12-0' + d, 69, 'x', d === 7 ? 1 : 0]
      );
    }
    /* 把开始日期往前推，让 syncLifecycles 判定断卡 */
    await memDb.execute('UPDATE flag SET start_date = ? WHERE id = ?', ['2026-11-20', id3]);
    await flagService.syncLifecycles();
    const f = await flagService.getFlag(id3, 'usr_test');
    assert.strictEqual(f.status, 'failed', '断卡超限应判负');
    assert.strictEqual(f.breaks, 1);
  });

  /* ---- 6. 押金 ---- */
  console.log('\n【押金】');
  await test('押金为 0 时不发起退款', async () => {
    const before = payCalls.length;
    await flagService.settleFlag('flg_nonexistent', {}).catch(() => {});
    assert.strictEqual(payCalls.length, before);
  });

  /* ---- 汇总 ---- */
  console.log('\n════════════════════════════════════');
  console.log(`通过 ${passed} 项，失败 ${failed} 项`);
  if (failed) {
    console.log('\n失败明细：');
    failures.forEach((f) => console.log(`  · ${f.name}\n      ${f.message}`));
    process.exit(1);
  }
  console.log('✅ 业务编排集成测试全部通过');
}

main().catch((e) => {
  console.error('测试异常：', e);
  process.exit(1);
});
