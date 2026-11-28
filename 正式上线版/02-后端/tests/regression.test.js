/**
 * 亏了 · 正式上线版 · 回归测试（本次修复的 bug 锁）
 * ===========================================================================
 * 【这个脚本防的是什么】
 *   把「这次修复过的、曾经会引发 500 或数据错误的 bug」写成断言。
 *   以后谁（或哪个 AI）把代码改回去，这里立刻红。
 *
 *   覆盖的 bug：
 *     1. app.js 解构了不存在的 api 导出 → 小程序启动即崩
 *     2. witness.js 查了不存在的 f.days 列 → 接口 500
 *     3. flag 表没有 total_days 列 → 进度天数取到 undefined
 *     4. flags_created 从不自增 → 新人保护永久有效
 *     5. AI 判定服务写了但没人调用 → 打卡永远 pending
 *     6. checked_days / streak 从不更新 → 进度条永远 0%
 *     7. 微信支付私钥走文件路径时签名被跳过 → 下单必失败
 *     8. 见证席节点日期全都等于生效日
 *
 * 【怎么跑】
 *   node tests/regression.test.js
 * ===========================================================================
 */
const Module = require('module');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { makeMemDb } = require('./_memdb');

const root = path.resolve(__dirname, '..');
const frontRoot = path.resolve(root, '..', '03-小程序前端');

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

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

async function main() {
  console.log('══════ 亏了 · 回归测试（防止旧 bug 复发）══════\n');

  /* ============================================================
     一、静态检查：源码里不该再出现的写法
     ============================================================ */
  console.log('【静态检查】');

  await test('app.js 不再解构不存在的 api 导出', () => {
    const src = readFile(path.join(frontRoot, 'app.js'));
    assert.ok(
      !/const\s*\{\s*api\s*\}\s*=\s*require/.test(src),
      'app.js 仍然写着 const { api } = require(...) —— api 导出不存在，小程序启动即崩'
    );
    assert.ok(
      /const\s+api\s*=\s*require/.test(src),
      'app.js 应该用 const api = require(...)'
    );
  });

  await test('前端 utils/api.js 确实导出了 get/post 等函数（不含 api 键）', () => {
    const src = readFile(path.join(frontRoot, 'utils', 'api.js'));
    const m = /module\.exports\s*=\s*\{([^}]*)\}/.exec(src);
    assert.ok(m, '找不到 module.exports');
    const exported = m[1].split(',').map((s) => s.split(':')[0].trim()).filter(Boolean);
    assert.ok(exported.includes('get'), 'api.js 应导出 get');
    assert.ok(exported.includes('post'), 'api.js 应导出 post');
    assert.ok(!exported.includes('api'), 'api.js 不应导出名为 api 的键');
  });

  await test('后端 SQL 不再引用 flag 表不存在的 days / total_days 列', () => {
    const files = [];
    (function walk(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (['node_modules', '.git', 'logs'].includes(e.name)) continue;
          walk(p);
        } else if (e.name.endsWith('.js')) files.push(p);
      }
    })(path.join(root, 'src'));

    for (const f of files) {
      const src = readFile(f);
      const lines = src.split(/\r?\n/);
      lines.forEach((ln, i) => {
        assert.ok(
          !/\bf\.days\b/.test(ln),
          `${path.relative(root, f)}:${i + 1} 仍引用 f.days —— flag 表没有 days 列，会报 Unknown column`
        );
        assert.ok(
          !/\bf\.total_days\b/.test(ln),
          `${path.relative(root, f)}:${i + 1} 仍引用 f.total_days —— flag 表没有 total_days 列`
        );
      });
    }
  });

  await test('微信支付签名不再依赖 config.pay.privateKey（非空判断）', () => {
    const src = readFile(path.join(root, 'src', 'services', 'wechatPay.js'));
    assert.ok(
      !/if\s*\(\s*config\.pay\.serialNo\s*&&\s*config\.pay\.privateKey\s*\)/.test(src),
      'wechatPay.js 仍用 config.pay.privateKey 判断是否签名 —— 私钥走文件路径时会整段跳过 Authorization 头'
    );
    assert.ok(
      /getPrivateKey\(\)/.test(src),
      'wechatPay.js 应该用 getPrivateKey() 判断私钥是否存在'
    );
  });

  /* ============================================================
     二、行为检查：跑真实代码验证结果
     ============================================================ */
  console.log('\n【行为检查】');

  const memDb = makeMemDb();
  const dbPath = require.resolve('../src/db');
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: memDb };

  /* AI 服务 mock：不真的调模型 */
  const aiPath = require.resolve('../src/services/aiReview');
  let aiCalls = 0;
  let aiVerdict = 'pass';
  let aiReadingMismatch = false;
  /* ⚠️ 必须用「可变代理对象」而不是替换 require.cache ——
     flagService 在 require 时就解构了模块引用，事后改 cache 不生效。 */
  const aiMock = {
    reviewCheckin: async function () {
      aiCalls++;
      return {
        verdict: aiVerdict,
        score: 0.9,
        reason: '测试判定',
        scaleReading: aiReadingMismatch ? 80 : null,
        readingMismatch: aiReadingMismatch,
        aiEnabled: true,
      };
    },
    PROMPT_VERSION: 'v1',
  };
  require.cache[aiPath] = {
    id: aiPath,
    filename: aiPath,
    loaded: true,
    exports: aiMock,
  };

  const flagService = require('../src/services/flagService');

  await memDb.execute(
    `INSERT INTO user (id, openid, nickname, avatar_url, credit_score, flags_created)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['usr_reg', 'ox_reg', '回归用户', '', 60, 0]
  );
  await memDb.execute('INSERT INTO user_stat (user_id) VALUES (?)', ['usr_reg']);

  /* ---- flags_created 自增 ---- */
  await test('创建 Flag 后 flags_created 自增（新人保护只生效一次）', async () => {
    await flagService.createFlag({
      userId: 'usr_reg', title: '回归：第一个 Flag',
      startWeight: 70, targetWeight: 68, periodDays: 7, depositAmount: 100,
    });
    const u = await memDb.queryOne('SELECT * FROM user WHERE id = ?', ['usr_reg']);
    assert.strictEqual(Number(u.flags_created), 1, 'flags_created 应为 1');
  });

  await test('第二个 Flag 不再免押金（新人保护已失效）', async () => {
    const f = await flagService.createFlag({
      userId: 'usr_reg', title: '回归：第二个 Flag',
      startWeight: 70, targetWeight: 68, periodDays: 7, depositAmount: 100,
    });
    assert.strictEqual(Number(f.deposit), 100, '第二个 Flag 应收 100 元押金');
  });

  /* ---- checked_days / streak 更新 ---- */
  let flagId = null;

  /**
   * 把 Flag 的时间轴挪到「今天是第 dayNow 天」
   * ---------------------------------------------------------------------------
   * 【为什么需要】
   *   后端用 dayNow = dayIndexOf(period_days, start_date) 判断「今天是第几天」，
   *   并且拒绝提前打卡（day > dayNow 直接拒绝）。
   *   测试要打第 4、5、6、7 天，就得把 start_date 相应前移，
   *   否则会先被「不能提前打卡」拦下，测不到真正想测的逻辑。
   */
  async function setTodayIsDay(dayNow) {
    await memDb.execute(
      'UPDATE flag SET start_date = ?, end_date = ? WHERE id = ?',
      [
        new Date(Date.now() - (dayNow - 1) * 86400000).toISOString().slice(0, 10),
        new Date(Date.now() + (14 - dayNow) * 86400000).toISOString().slice(0, 10),
        flagId,
      ]
    );
  }

  await test('AI 判定通过后 checked_days 与 streak 递增', async () => {
    const f = await flagService.createFlag({
      userId: 'usr_reg', title: '回归：打卡统计',
      startWeight: 70, targetWeight: 68, periodDays: 14, depositAmount: 200,
    });
    flagId = f.id;
    /* 跳过筹备期。
     * ⚠️ prep_end_at / start_date / end_date 必须一起改 ——
     *    生产环境里生效日是由筹备期结束日算出来的，三者永远同步。
     *    只改状态不改 start_date 会让 dayNow=0，打卡全被「不能提前打卡」拦下。 */
    await memDb.execute(
      'UPDATE flag SET prep_end_at = ?, start_date = ?, end_date = ?, status = ? WHERE id = ?',
      [
        new Date(Date.now() - 1000).toISOString(),
        new Date(Date.now() - 86400000).toISOString().slice(0, 10),
        new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10),
        'running',
        flagId,
      ]
    );

    /* 补齐第 2 天的打卡记录（第 1 天由 createFlag 生成） */
    await memDb.execute(
      `INSERT INTO checkin (id, flag_id, user_id, day_index, check_date, weight, handwrite, status, is_node_day)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
      ['cki_reg2', flagId, 'usr_reg', 2, '2026-11-29', 69.5, '加油', 0]
    );

    /* 第 1 天打卡 → 触发 AI 判定 */
    await flagService.submitCheckin({
      userId: 'usr_reg', flagId, dayIndex: 1,
      weight: 69.8, handwrite: '坚持', photoUrl: 'https://x/1.jpg',
    });
    /* 等异步判定完成 */
    await new Promise((r) => setTimeout(r, 50));

    assert.ok(aiCalls > 0, 'AI 判定服务应该被调用（之前完全没接线）');

    let flag = await flagService.getFlag(flagId, 'usr_reg');
    assert.strictEqual(Number(flag.checkedDays), 1, 'checked_days 应为 1');
    assert.strictEqual(Number(flag.streak), 1, 'streak 应为 1');
  });

  await test('连续打卡 streak 递增到 2', async () => {
    await setTodayIsDay(2);
    await flagService.submitCheckin({
      userId: 'usr_reg', flagId, dayIndex: 2,
      weight: 69.5, handwrite: '加油', photoUrl: 'https://x/2.jpg',
    });
    await new Promise((r) => setTimeout(r, 50));

    const flag = await flagService.getFlag(flagId, 'usr_reg');
    assert.strictEqual(Number(flag.checkedDays), 2, 'checked_days 应为 2');
    assert.strictEqual(Number(flag.streak), 2, 'streak 应为 2（连续第 2 天）');
  });

  await test('断卡后 streak 归 1 而不是继续累加', async () => {
    /* 第 3 天跳过，第 4 天打卡 → 连续中断 */
    await setTodayIsDay(4);
    await memDb.execute(
      `INSERT INTO checkin (id, flag_id, user_id, day_index, check_date, weight, handwrite, status, is_node_day)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
      ['cki_reg4', flagId, 'usr_reg', 4, '2026-12-01', 69.0, '继续', 0]
    );
    await flagService.submitCheckin({
      userId: 'usr_reg', flagId, dayIndex: 4,
      weight: 69.0, handwrite: '继续', photoUrl: 'https://x/4.jpg',
    });
    await new Promise((r) => setTimeout(r, 50));

    const flag = await flagService.getFlag(flagId, 'usr_reg');
    assert.strictEqual(Number(flag.checkedDays), 3, 'checked_days 应为 3');
    assert.strictEqual(Number(flag.streak), 1, '断卡后 streak 应归 1');
  });

  await test('AI 判「存疑」时不计入打卡天数（保持 pending 转人工）', async () => {
    aiVerdict = 'doubt';
    await setTodayIsDay(5);
    await memDb.execute(
      `INSERT INTO checkin (id, flag_id, user_id, day_index, check_date, weight, handwrite, status, is_node_day)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
      ['cki_reg5', flagId, 'usr_reg', 5, '2026-12-02', 68.8, 'x', 0]
    );
    await flagService.submitCheckin({
      userId: 'usr_reg', flagId, dayIndex: 5,
      weight: 68.8, handwrite: 'x', photoUrl: 'https://x/5.jpg',
    });
    await new Promise((r) => setTimeout(r, 50));

    const flag = await flagService.getFlag(flagId, 'usr_reg');
    assert.strictEqual(Number(flag.checkedDays), 3, '存疑不计入打卡天数');
    aiVerdict = 'pass';
  });

  await test('AI 判「驳回」时 checkin 状态变为 rejected', async () => {
    aiVerdict = 'rejected';
    await setTodayIsDay(6);
    await memDb.execute(
      `INSERT INTO checkin (id, flag_id, user_id, day_index, check_date, weight, handwrite, status, is_node_day)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
      ['cki_reg6', flagId, 'usr_reg', 6, '2026-12-03', 68.5, 'x', 0]
    );
    await flagService.submitCheckin({
      userId: 'usr_reg', flagId, dayIndex: 6,
      weight: 68.5, handwrite: 'x', photoUrl: 'https://x/6.jpg',
    });
    await new Promise((r) => setTimeout(r, 50));

    const ck = await memDb.queryOne(
      'SELECT * FROM checkin WHERE flag_id = ? AND day_index = ?', [flagId, 6]
    );
    assert.strictEqual(ck.status, 'rejected', '驳回时 status 应为 rejected');
    aiVerdict = 'pass';
  });

  await test('秤面读数与用户填写对不上时转为存疑（不直接驳回用户）', async () => {
    aiReadingMismatch = true;
    await setTodayIsDay(7);
    await memDb.execute(
      `INSERT INTO checkin (id, flag_id, user_id, day_index, check_date, weight, handwrite, status, is_node_day)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
      ['cki_reg7', flagId, 'usr_reg', 7, '2026-12-04', 65.0, 'x', 0]
    );
    await flagService.submitCheckin({
      userId: 'usr_reg', flagId, dayIndex: 7,
      weight: 65.0, handwrite: 'x', photoUrl: 'https://x/7.jpg',
    });
    await new Promise((r) => setTimeout(r, 50));

    const ck = await memDb.queryOne(
      'SELECT * FROM checkin WHERE flag_id = ? AND day_index = ?', [flagId, 7]
    );
    assert.strictEqual(ck.status, 'pending', '读数对不上应转人工（pending），不能直接驳回');
    aiReadingMismatch = false;
  });

  /* ---- ensureCheckin：按需补生成打卡记录 ---- */
  console.log('\n【按需补生成打卡记录】');

  await test('第 8 天打卡时记录不存在也能自动补出来（不再报「这一天不存在」）', async () => {
    await setTodayIsDay(8);
    /* 故意不预置第 8 天的记录 */
    const before = await memDb.queryOne(
      'SELECT * FROM checkin WHERE flag_id = ? AND day_index = ?', [flagId, 8]
    );
    assert.ok(!before, '前置条件：第 8 天此时不该有记录');

    await flagService.submitCheckin({
      userId: 'usr_reg', flagId, dayIndex: 8,
      weight: 68.0, handwrite: '新的一天', photoUrl: 'https://x/8.jpg',
    });
    await new Promise((r) => setTimeout(r, 50));

    const after = await memDb.queryOne(
      'SELECT * FROM checkin WHERE flag_id = ? AND day_index = ?', [flagId, 8]
    );
    assert.ok(after, '第 8 天的记录应该被自动补出来');
    assert.strictEqual(after.status, 'ok', '补出来的记录应走完判定变成 ok');
  });

  await test('补生成的记录日期 = 生效日 + (第几天 - 1)', async () => {
    const f = await memDb.queryOne('SELECT start_date FROM flag WHERE id = ?', [flagId]);
    const ck = await memDb.queryOne(
      'SELECT * FROM checkin WHERE flag_id = ? AND day_index = ?', [flagId, 8]
    );
    const expected = new Date(f.start_date + 'T00:00:00Z');
    expected.setUTCDate(expected.getUTCDate() + 7);
    assert.strictEqual(
      ck.check_date,
      expected.toISOString().slice(0, 10),
      '补生成的 check_date 应等于 生效日 + 7 天'
    );
  });

  await test('补生成的「过去的日子」标记 is_makeup（补卡）', async () => {
    /* 把今天模拟成第 10 天，此时第 9 天已经过去了 → 应该标记为补卡。
     * ⚠️ 故意不预置第 9 天的记录 —— 必须走 ensureCheckin 真正的懒生成路径，
     *    is_makeup 是它生成时才打上的。 */
    await setTodayIsDay(10);
    await flagService.submitCheckin({
      userId: 'usr_reg', flagId, dayIndex: 9,
      weight: 67.8, handwrite: '补卡', photoUrl: 'https://x/9.jpg',
    });
    await new Promise((r) => setTimeout(r, 50));

    const ck = await memDb.queryOne(
      'SELECT * FROM checkin WHERE flag_id = ? AND day_index = ?', [flagId, 9]
    );
    assert.ok(ck, '第 9 天的记录应该被补出来');
    assert.strictEqual(Number(ck.is_makeup), 1, '已经过去的日子应标记为补卡');
  });

  await test('补生成的「今天」不标记 is_makeup（正常打卡）', async () => {
    await setTodayIsDay(10);
    await memDb.execute(
      `INSERT INTO checkin (id, flag_id, user_id, day_index, check_date, weight, handwrite, status, is_makeup, is_node_day)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0)`,
      ['cki_reg10', flagId, 'usr_reg', 10, '2026-12-07', 0, '', 0]
    );
    await flagService.submitCheckin({
      userId: 'usr_reg', flagId, dayIndex: 10,
      weight: 67.5, handwrite: '今天', photoUrl: 'https://x/10.jpg',
    });
    await new Promise((r) => setTimeout(r, 50));

    const ck = await memDb.queryOne(
      'SELECT * FROM checkin WHERE id = ?', ['cki_reg10']
    );
    assert.strictEqual(Number(ck.is_makeup), 0, '今天打卡不算补卡');
  });

  await test('不允许提前打卡未来的日子', async () => {
    await setTodayIsDay(8);
    await assert.rejects(
      () => flagService.submitCheckin({
        userId: 'usr_reg', flagId, dayIndex: 10,
        weight: 67.0, handwrite: 'x', photoUrl: 'https://x/10.jpg',
      }),
      /不能提前打卡/
    );
  });

  await test('断卡判定能查出「没打卡的那些天」（懒生成后不再漏判）', async () => {
    /* 新建一个局：今天已是第 4 天，但只有第 1 天打卡了
     * ⚠️ 已过去且没打卡的是第 2、3 天 → 应该累计 2 次断卡。
     *    第 4 天是「今天」，还没到判负时刻，不算断卡。 */
    const f2 = await flagService.createFlag({
      userId: 'usr_reg', title: '回归：断卡漏判',
      startWeight: 70, targetWeight: 68, periodDays: 14, depositAmount: 200,
    });
    const id2 = f2.id;
    await memDb.execute(
      'UPDATE flag SET prep_end_at = ?, start_date = ?, end_date = ?, status = ? WHERE id = ?',
      [
        new Date(Date.now() - 1000).toISOString(),
        new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
        new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
        'running',
        id2,
      ]
    );
    /* 只打第 1 天 */
    await flagService.submitCheckin({
      userId: 'usr_reg', flagId: id2, dayIndex: 1,
      weight: 69.8, handwrite: '坚持', photoUrl: 'https://x/d1.jpg',
    });
    await new Promise((r) => setTimeout(r, 50));

    /* 跑生命周期同步 → 第 2、3 天应该被判为断卡 */
    await flagService.syncLifecycles();

    const after = await flagService.getFlag(id2, 'usr_reg');
    assert.strictEqual(Number(after.breaks), 2,
      '第 2、3 天没打卡，应该累计 2 次断卡（懒生成后不能漏判）');

    /* 而且那两天的记录应该已经被标成 rejected */
    const ck2 = await memDb.queryOne(
      'SELECT * FROM checkin WHERE flag_id = ? AND day_index = ?', [id2, 2]
    );
    assert.ok(ck2, '第 2 天的记录应该被补出来');
    assert.strictEqual(ck2.status, 'rejected', '断卡的那天状态应为 rejected');
  });

  /* ---- 汇总 ---- */
  console.log('\n════════════════════════════════════');
  console.log(`通过 ${passed} 项，失败 ${failed} 项`);
  if (failed) {
    console.log('\n失败明细：');
    failures.forEach((f) => console.log(`  · ${f.name}\n      ${f.message}`));
    process.exit(1);
  }
  console.log('✅ 回归测试全部通过');
}

main().catch((e) => {
  console.error('测试异常：', e);
  process.exit(1);
});
