/**
 * 亏了 · 正式上线版 · 规则对账测试
 * ===========================================================================
 * 【小白须知】这个文件是「规则的自检」。
 *   它把《参数速查表》里的数字一条一条写成断言，
 *   每次改完规则跑一遍 `npm test`，全绿说明规则没跑偏。
 *
 * 【怎么跑】
 *   cd 02-后端
 *   npm test
 *
 * 【它测什么】
 *   ✓ 周期天数、结束日、节点位置
 *   ✓ 断卡容忍次数与断卡后果
 *   ✓ 强度档位分级与系数
 *   ✓ 信用分区间、等级分档、分段到账
 *   ✓ 押金区间、扣收比例、失败损失
 *   ✓ 新人保护
 *   ✓ 见证席判定聚合与结算分值
 *   ✓ 成功/失败判定
 * ===========================================================================
 */
const assert = require('assert');
const R = require('../src/domain/rules');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
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

console.log('══════ 亏了 · 规则对账测试 ══════');

/* ---------------------------------------------------------------------------
 * 一、周期与节点（参数表 1.1 ~ 1.6）
 * ------------------------------------------------------------------------ */
group('周期与节点');

test('7 天档：7 个打卡日、2 次判定、节点第 1/7 天', () => {
  const p = R.PERIODS[7];
  assert.strictEqual(p.totalDays, 7);
  assert.strictEqual(p.judgeCount, 2);
  assert.deepStrictEqual(p.nodeDays, [1, 7]);
});

test('14 天档：14 个打卡日、3 次判定、节点第 1/7/14 天', () => {
  const p = R.PERIODS[14];
  assert.strictEqual(p.totalDays, 14);
  assert.strictEqual(p.judgeCount, 3);
  assert.deepStrictEqual(p.nodeDays, [1, 7, 14]);
});

test('30 天档：30 个打卡日、4 次判定、节点第 1/10/20/30 天', () => {
  const p = R.PERIODS[30];
  assert.strictEqual(p.totalDays, 30);
  assert.strictEqual(p.judgeCount, 4);
  assert.deepStrictEqual(p.nodeDays, [1, 10, 20, 30]);
});

test('90 天档：90 个打卡日、4 次判定、节点第 1/30/60/90 天', () => {
  const p = R.PERIODS[90];
  assert.strictEqual(p.totalDays, 90);
  assert.strictEqual(p.judgeCount, 4);
  assert.deepStrictEqual(p.nodeDays, [1, 30, 60, 90]);
});

test('结束日 = 生效日 + (周期 - 1) 天', () => {
  const prep = new Date('2026-11-26T12:00:00Z');
  const r7 = R.calcDates(7, prep);
  const r14 = R.calcDates(14, prep);
  const r30 = R.calcDates(30, prep);
  const r90 = R.calcDates(90, prep);
  assert.strictEqual(r7.startDate, '2026-11-26');
  assert.strictEqual(r7.endDate, '2026-12-02');
  assert.strictEqual(r14.endDate, '2026-12-09');
  assert.strictEqual(r30.endDate, '2026-12-25');
  assert.strictEqual(r90.endDate, '2027-02-23');
});

test('第 N 天 = 生效日 + (N - 1) 天', () => {
  assert.strictEqual(R.dayIndexOf(30, '2026-11-26', new Date('2026-11-26T05:00:00Z')), 1);
  assert.strictEqual(R.dayIndexOf(30, '2026-11-26', new Date('2026-11-27T05:00:00Z')), 2);
  assert.strictEqual(R.dayIndexOf(30, '2026-11-26', new Date('2026-12-25T05:00:00Z')), 30);
  /* 结束日之后 → 超出周期 */
  assert.strictEqual(R.dayIndexOf(30, '2026-11-26', new Date('2026-12-26T05:00:00Z')), 31);
});

test('中期到账日：14/30 档第 7 天，90 档第 7+30 天，7 档无', () => {
  assert.deepStrictEqual(R.PERIODS[7].midPayoutDays, []);
  assert.deepStrictEqual(R.PERIODS[14].midPayoutDays, [7]);
  assert.deepStrictEqual(R.PERIODS[30].midPayoutDays, [7]);
  assert.deepStrictEqual(R.PERIODS[90].midPayoutDays, [7, 30]);
});

/* ---------------------------------------------------------------------------
 * 二、断卡（参数表 1.7 ~ 1.9）
 * ------------------------------------------------------------------------ */
group('断卡');

test('断卡容忍：7 天 0 次 / 14 天 1 次 / 30 天 2 次 / 90 天 4 次', () => {
  assert.strictEqual(R.PERIODS[7].breakLimit, 0);
  assert.strictEqual(R.PERIODS[14].breakLimit, 1);
  assert.strictEqual(R.PERIODS[30].breakLimit, 2);
  assert.strictEqual(R.PERIODS[90].breakLimit, 4);
});

test('7 天档断 1 次直接失败', () => {
  assert.strictEqual(R.breakState(0, 1), 'fail');
});

test('14 天档断 1 次进危险区，断 2 次失败', () => {
  assert.strictEqual(R.breakState(1, 1), 'danger');
  assert.strictEqual(R.breakState(1, 2), 'fail');
});

test('30 天档断 1 次归零降权，断 2 次危险区，断 3 次失败', () => {
  assert.strictEqual(R.breakState(2, 1), 'reset');
  assert.strictEqual(R.breakState(2, 2), 'danger');
  assert.strictEqual(R.breakState(2, 3), 'fail');
});

test('90 天档断 4 次危险区，断 5 次失败', () => {
  assert.strictEqual(R.breakState(4, 4), 'danger');
  assert.strictEqual(R.breakState(4, 5), 'fail');
});

test('断卡预警文案：还剩 ≥2 次是软提示', () => {
  const w = R.breakWarning(4, 2);
  assert.strictEqual(w.level, 'soft');
  assert.strictEqual(w.text, '你还可以断 2 次');
});

test('断卡预警文案：还剩 0 次是强提示', () => {
  const w = R.breakWarning(2, 2);
  assert.strictEqual(w.text, '再断 1 次，这个 Flag 就结束了');
});

/* ---------------------------------------------------------------------------
 * 三、强度档位（参数表 2.1 ~ 2.7）
 * ------------------------------------------------------------------------ */
group('强度档位');

test('档位分级：0 人=T0，1-2=T1，3-4=T2，5+=T3', () => {
  assert.strictEqual(R.tierByAttendance(0), 'T0');
  assert.strictEqual(R.tierByAttendance(1), 'T1');
  assert.strictEqual(R.tierByAttendance(2), 'T1');
  assert.strictEqual(R.tierByAttendance(3), 'T2');
  assert.strictEqual(R.tierByAttendance(4), 'T2');
  assert.strictEqual(R.tierByAttendance(5), 'T3');
  assert.strictEqual(R.tierByAttendance(10), 'T3');
});

test('档位系数：T0=0.6 T1=0.8 T2/T3=1.0', () => {
  assert.strictEqual(R.TIER_FACTOR.T0, 0.6);
  assert.strictEqual(R.TIER_FACTOR.T1, 0.8);
  assert.strictEqual(R.TIER_FACTOR.T2, 1.0);
  assert.strictEqual(R.TIER_FACTOR.T3, 1.0);
});

test('有效档位只降不升：取历史最低档', () => {
  assert.strictEqual(R.effectiveTier(['T2', 'T2', 'T2', 'T2']), 'T2');
  assert.strictEqual(R.effectiveTier(['T3', 'T3', 'T3', 'T3']), 'T3');
  assert.strictEqual(R.effectiveTier(['T3', 'T2', 'T1', 'T2']), 'T1');
  assert.strictEqual(R.effectiveTier(['T0']), 'T0');
  assert.strictEqual(R.effectiveTier([]), 'T0');
});

/* ---------------------------------------------------------------------------
 * 四、信用分（参数表 3.1 ~ 3.3）
 * ------------------------------------------------------------------------ */
group('信用分');

test('信用分区间：初始 60，上限 100，下限 45', () => {
  assert.strictEqual(R.CREDIT.initial, 60);
  assert.strictEqual(R.CREDIT.max, 100);
  assert.strictEqual(R.CREDIT.min, 45);
});

test('信用分等级分档：45-59 受限 / 60-69 普通 / 70-79 良好 / 80-89 优秀 / 90-100 卓越', () => {
  assert.strictEqual(R.creditTierOf(45), '受限');
  assert.strictEqual(R.creditTierOf(59), '受限');
  assert.strictEqual(R.creditTierOf(60), '普通');
  assert.strictEqual(R.creditTierOf(69), '普通');
  assert.strictEqual(R.creditTierOf(70), '良好');
  assert.strictEqual(R.creditTierOf(79), '良好');
  assert.strictEqual(R.creditTierOf(80), '优秀');
  assert.strictEqual(R.creditTierOf(89), '优秀');
  assert.strictEqual(R.creditTierOf(90), '卓越');
  assert.strictEqual(R.creditTierOf(100), '卓越');
});

test('信用分结算会卡在上下限', () => {
  assert.strictEqual(R.applyCredit(98, 35), 100);
  assert.strictEqual(R.applyCredit(47, -30), 45);
  assert.strictEqual(R.applyCredit(60, 15), 75);
});

test('成功加分乘档位系数：30 天档 T0 得 +9，T2 得 +15', () => {
  assert.strictEqual(R.settleCreditDelta(30, 'T0', true), Math.round(15 * 0.6));
  assert.strictEqual(R.settleCreditDelta(30, 'T1', true), Math.round(15 * 0.8));
  assert.strictEqual(R.settleCreditDelta(30, 'T2', true), 15);
  assert.strictEqual(R.settleCreditDelta(30, 'T3', true), 15);
});

test('失败扣分乘档位系数：90 天档 T0 得 -12，T3 得 -20', () => {
  assert.strictEqual(R.settleCreditDelta(90, 'T0', false), Math.round(-20 * 0.6));
  assert.strictEqual(R.settleCreditDelta(90, 'T3', false), -20);
});

test('判负 -30 固定不乘系数', () => {
  assert.strictEqual(R.CREDIT_EVENTS.flag_cheat.raw, -30);
  assert.strictEqual(R.CREDIT_EVENTS.flag_cheat.scale, false);
});

test('见证席分值不乘系数：+2 / +3 / -8 / -5 / 0 / 0', () => {
  assert.strictEqual(R.CREDIT_EVENTS.witness_pass.raw, 2);
  assert.strictEqual(R.CREDIT_EVENTS.witness_cheat.raw, 3);
  assert.strictEqual(R.CREDIT_EVENTS.witness_false.raw, -8);
  assert.strictEqual(R.CREDIT_EVENTS.witness_missed.raw, -5);
  assert.strictEqual(R.CREDIT_EVENTS.witness_doubt.raw, 0);
  assert.strictEqual(R.CREDIT_EVENTS.witness_norespond.raw, 0);
});

test('打卡里程碑 +1 不乘系数', () => {
  assert.strictEqual(R.CREDIT_EVENTS.milestone_7day.raw, 1);
  assert.strictEqual(R.CREDIT_EVENTS.milestone_7day.scale, false);
});

test('分段到账合计：7=5 / 14=10 / 30=15 / 90=35', () => {
  const sum = (d) => {
    const p = R.PERIODS[d];
    const mid = p.midPayoutDays.reduce((s, day) => s + R.midPayoutCredit(d, day), 0);
    return mid + p.successPayout;
  };
  assert.strictEqual(sum(7), 5);
  assert.strictEqual(sum(14), 10);
  assert.strictEqual(sum(30), 15);
  assert.strictEqual(sum(90), 35);
});

test('结束到账分值：7=5 / 14=5 / 30=10 / 90=20', () => {
  assert.strictEqual(R.PERIODS[7].successPayout, 5);
  assert.strictEqual(R.PERIODS[14].successPayout, 5);
  assert.strictEqual(R.PERIODS[30].successPayout, 10);
  assert.strictEqual(R.PERIODS[90].successPayout, 20);
});

test('成功合计与信用分事件表一致（不会算两遍）', () => {
  for (const d of [7, 14, 30, 90]) {
    assert.strictEqual(
      R.PERIODS[d].successCreditTotal,
      R.CREDIT_EVENTS[`flag_success_${d}`].raw,
      `${d} 天档的成功合计与事件表不一致`
    );
  }
});

/* ---------------------------------------------------------------------------
 * 五、押金（参数表 5.1 ~ 5.7）
 * ------------------------------------------------------------------------ */
group('押金');

test('押金区间：7天100-500 / 14天200-1000 / 30天500-2000 / 90天1000-5000', () => {
  assert.strictEqual(R.PERIODS[7].depositMin, 100);
  assert.strictEqual(R.PERIODS[7].depositMax, 500);
  assert.strictEqual(R.PERIODS[14].depositMin, 200);
  assert.strictEqual(R.PERIODS[14].depositMax, 1000);
  assert.strictEqual(R.PERIODS[30].depositMin, 500);
  assert.strictEqual(R.PERIODS[30].depositMax, 2000);
  assert.strictEqual(R.PERIODS[90].depositMin, 1000);
  assert.strictEqual(R.PERIODS[90].depositMax, 5000);
});

test('押金上限随信用等级：受限200 / 普通500 / 良好1000 / 优秀2000 / 卓越5000', () => {
  assert.strictEqual(R.CREDIT_TIER_RULES['受限'].depositMax, 200);
  assert.strictEqual(R.CREDIT_TIER_RULES['普通'].depositMax, 500);
  assert.strictEqual(R.CREDIT_TIER_RULES['良好'].depositMax, 1000);
  assert.strictEqual(R.CREDIT_TIER_RULES['优秀'].depositMax, 2000);
  assert.strictEqual(R.CREDIT_TIER_RULES['卓越'].depositMax, 5000);
});

test('失败扣收比例：受限40% / 普通35% / 良好30% / 优秀25% / 卓越20%', () => {
  assert.strictEqual(R.CREDIT_TIER_RULES['受限'].failRate, 0.40);
  assert.strictEqual(R.CREDIT_TIER_RULES['普通'].failRate, 0.35);
  assert.strictEqual(R.CREDIT_TIER_RULES['良好'].failRate, 0.30);
  assert.strictEqual(R.CREDIT_TIER_RULES['优秀'].failRate, 0.25);
  assert.strictEqual(R.CREDIT_TIER_RULES['卓越'].failRate, 0.20);
});

test('可立周期：受限仅7天 / 普通7+14 / 良好7+14+30 / 优秀卓越全档', () => {
  assert.deepStrictEqual(R.CREDIT_TIER_RULES['受限'].periods, [7]);
  assert.deepStrictEqual(R.CREDIT_TIER_RULES['普通'].periods, [7, 14]);
  assert.deepStrictEqual(R.CREDIT_TIER_RULES['良好'].periods, [7, 14, 30]);
  assert.deepStrictEqual(R.CREDIT_TIER_RULES['优秀'].periods, [7, 14, 30, 90]);
  assert.deepStrictEqual(R.CREDIT_TIER_RULES['卓越'].periods, [7, 14, 30, 90]);
});

test('押金校验：信用 45（受限）不能立 14 天', () => {
  const r = R.validateDeposit(45, 14, 200);
  assert.strictEqual(r.ok, false);
});

test('押金校验：信用 45（受限）押金不能超过 200', () => {
  const r = R.validateDeposit(45, 7, 300);
  assert.strictEqual(r.ok, false);
});

test('押金校验：信用 90（卓越）可以立 90 天押 5000', () => {
  const r = R.validateDeposit(90, 90, 5000);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.failRate, 0.20);
});

test('押金校验：30 天档押金不能低于 500', () => {
  assert.strictEqual(R.validateDeposit(90, 30, 300).ok, false);
});

test('押金结算：达标全额退还', () => {
  const r = R.settleDeposit(1000, '卓越', true);
  assert.strictEqual(r.refund, 1000);
  assert.strictEqual(r.deduct, 0);
});

test('押金结算：失败按信用等级扣收比例', () => {
  const r = R.settleDeposit(1000, '普通', false);
  assert.strictEqual(r.deduct, 350);
  assert.strictEqual(r.refund, 650);
});

test('押金结算金额无浮点误差（0.1 元 × 35% = 0.035 → 3.5 分）', () => {
  const r = R.settleDeposit(0.1, '普通', false);
  assert.strictEqual(r.deduct, 0.04);
  assert.strictEqual(r.refund, 0.06);
});

test('新人保护：第 1 个 Flag 立 7 天或 14 天免费', () => {
  assert.strictEqual(R.depositRequired(0, 7).amount, 0);
  assert.strictEqual(R.depositRequired(0, 14).amount, 0);
  assert.strictEqual(R.depositRequired(0, 14).free, true);
});

test('新人保护：第 2 个 Flag 收下限，30 天档收 500', () => {
  assert.strictEqual(R.depositRequired(1, 30).amount, 500);
  assert.strictEqual(R.depositRequired(1, 90).amount, 1000);
});

/* ---------------------------------------------------------------------------
 * 六、见证席判定（参数表 4.1 ~ 4.9）
 * ------------------------------------------------------------------------ */
group('见证席判定');

test('判定聚合：全部通过 → pass', () => {
  const agg = R.aggregateVerdict([
    { decision: 'pass' }, { decision: 'pass' }, { decision: 'pass' },
  ]);
  assert.strictEqual(agg.outcome, 'pass');
  assert.strictEqual(agg.cheat, false);
  assert.strictEqual(agg.pass, 3);
});

test('判定聚合：作弊票达 1/3 → cheat', () => {
  const agg = R.aggregateVerdict([
    { decision: 'cheat' }, { decision: 'pass' }, { decision: 'pass' },
  ]);
  assert.strictEqual(agg.cheat, true);
  assert.strictEqual(agg.outcome, 'cheat');
});

test('判定聚合：仅 1 票作弊但总数多 → 不成立', () => {
  const agg = R.aggregateVerdict([
    { decision: 'cheat' }, { decision: 'pass' }, { decision: 'pass' },
    { decision: 'pass' }, { decision: 'pass' }, { decision: 'pass' },
  ]);
  assert.strictEqual(agg.cheat, false);
});

test('判定聚合：全未响应 → none', () => {
  const agg = R.aggregateVerdict([{ decision: null }, { decision: null }]);
  assert.strictEqual(agg.outcome, 'none');
});

test('判定聚合：只有存疑 → doubt', () => {
  const agg = R.aggregateVerdict([{ decision: 'doubt' }, { decision: null }]);
  assert.strictEqual(agg.outcome, 'doubt');
});

test('见证门槛：判定次数的一半（向上取整）', () => {
  assert.strictEqual(R.witnessQuorum(1, 2).need, 1);
  assert.strictEqual(R.witnessQuorum(2, 3).need, 2);
  assert.strictEqual(R.witnessQuorum(2, 4).need, 2);
  assert.strictEqual(R.witnessQuorum(0, 4).met, false);
});

test('见证席结算分值：认真判作弊成立 +3', () => {
  const agg = { outcome: 'cheat' };
  const d = R.settleVerdictCredit('witness', agg, {
    respondent: true, cheatEstablished: true, missedCheat: false,
  });
  assert.strictEqual(d, 3);
});

test('见证席结算分值：漏报 -5', () => {
  const agg = { outcome: 'pass' };
  const d = R.settleVerdictCredit('witness', agg, {
    respondent: true, cheatEstablished: false, factCheatButPassed: true,
  });
  assert.strictEqual(d, -5);
});

test('见证席结算分值：正常通过 +2', () => {
  const agg = { outcome: 'pass' };
  const d = R.settleVerdictCredit('witness', agg, {
    respondent: true, cheatEstablished: false, factCheatButPassed: false,
  });
  assert.strictEqual(d, 2);
});

test('见证席结算分值：未响应 0，存疑 0', () => {
  assert.strictEqual(
    R.settleVerdictCredit('witness', { outcome: 'none' }, { respondent: false }),
    0
  );
  assert.strictEqual(
    R.settleVerdictCredit('witness', { outcome: 'doubt' }, { respondent: true }),
    0
  );
});

test('监督席：异议成立 +1，不成立 -8', () => {
  assert.strictEqual(
    R.settleVerdictCredit('supervisor', {}, { respondent: true, cheatEstablished: true }),
    1
  );
  assert.strictEqual(
    R.settleVerdictCredit('supervisor', {}, { respondent: true, cheatEstablished: false }),
    -8
  );
});

/* ---------------------------------------------------------------------------
 * 七、结局判定（参数表 10.1 ~ 10.2）
 * ------------------------------------------------------------------------ */
group('结局判定');

test('成功：体重达标 + 天数够 + 未断卡超限', () => {
  const r = R.judgeOutcome({
    periodDays: 30, checkedDays: 30, finalWeight: 79, targetWeight: 80,
    breaks: 0, cheatEstablished: false,
  });
  assert.strictEqual(r.success, true);
});

test('失败：体重没达标', () => {
  const r = R.judgeOutcome({
    periodDays: 30, checkedDays: 30, finalWeight: 81, targetWeight: 80,
    breaks: 0, cheatEstablished: false,
  });
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.reason, 'not_reached');
});

test('失败：作弊成立', () => {
  const r = R.judgeOutcome({
    periodDays: 30, checkedDays: 30, finalWeight: 79, targetWeight: 80,
    breaks: 0, cheatEstablished: true,
  });
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.reason, 'cheat');
});

test('失败：断卡超出上限', () => {
  const r = R.judgeOutcome({
    periodDays: 7, checkedDays: 7, finalWeight: 79, targetWeight: 80,
    breaks: 1, cheatEstablished: false,
  });
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.reason, 'break');
});

test('成功：30 天档允许 2 次断卡', () => {
  const r = R.judgeOutcome({
    periodDays: 30, checkedDays: 28, finalWeight: 79, targetWeight: 80,
    breaks: 2, cheatEstablished: false,
  });
  assert.strictEqual(r.success, true);
});

test('成功：7 天档不允许断卡（断 1 次即失败）', () => {
  const r = R.judgeOutcome({
    periodDays: 7, checkedDays: 7, finalWeight: 79, targetWeight: 80,
    breaks: 1, cheatEstablished: false,
  });
  assert.strictEqual(r.success, false);
});

/* ---------------------------------------------------------------------------
 * 八、节点命名
 * ------------------------------------------------------------------------ */
group('节点命名');

test('30/90 天档有 4 个节点：起始称重 / 中期称重 / 中期复核 / 结束称重', () => {
  assert.deepStrictEqual(R.nodeNames(30), ['起始称重', '中期称重', '中期复核', '结束称重']);
  assert.deepStrictEqual(R.nodeNames(90), ['起始称重', '中期称重', '中期复核', '结束称重']);
});

test('7 天档 2 个节点，14 天档 3 个节点', () => {
  assert.strictEqual(R.nodeNames(7).length, 2);
  assert.strictEqual(R.nodeNames(14).length, 3);
});

/* ---------------------------------------------------------------------------
 * 汇总
 * ------------------------------------------------------------------------ */
console.log('\n════════════════════════════════════');
console.log(`通过 ${passed} 项，失败 ${failed} 项`);
if (failed) {
  console.log('\n失败明细：');
  failures.forEach(f => console.log(`  · ${f.name}\n      ${f.message}`));
  process.exit(1);
}
console.log('✅ 全部通过 —— 规则与参数速查表一致');
