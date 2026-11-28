/**
 * 亏了 · 正式上线版 · 领域规则引擎
 * ===========================================================================
 * 【小白须知】这个文件是整个后端的「业务大脑」。
 *   它把《参数速查表》里的所有规则写成了代码。
 *
 *   ⚠️ 改这个文件 = 改产品规则。改之前先想清楚，
 *      并且改完一定要跑 `npm test`（自带的对账测试）。
 *
 * 【对应文档】原始项目的「参数速查表.md」
 * ===========================================================================
 */

/* ===========================================================================
 * 一、周期与节点（参数表 1.1 ~ 1.10）
 * ========================================================================= */

/* ⚠️ 两个分值别搞混（参数表 3.3）：
 *   successPayout     = 结束到账那一笔的分值
 *   successCreditTotal = 整个周期成功一共加多少分（= 中期到账合计 + successPayout）
 *   结算入账用的是 successCreditTotal（见 CREDIT_EVENTS） */
const PERIODS = {
  7:  {
    totalDays: 7,  judgeCount: 2, breakLimit: 0,
    nodeDays: [1, 7],            midPayoutDays: [],
    depositMin: 100,  depositMax: 500,   depositOptions: [100, 200, 300, 500],
    successPayout: 5,  successCreditTotal: 5,  failCredit: -5,
    creditCap: 45, witnessFullCredit: 4,
  },
  14: {
    totalDays: 14, judgeCount: 3, breakLimit: 1,
    nodeDays: [1, 7, 14],        midPayoutDays: [7],
    depositMin: 200,  depositMax: 1000,  depositOptions: [200, 300, 500, 1000],
    successPayout: 5,  successCreditTotal: 10, failCredit: -5,
    creditCap: 60, witnessFullCredit: 6,
  },
  30: {
    totalDays: 30, judgeCount: 4, breakLimit: 2,
    nodeDays: [1, 10, 20, 30],   midPayoutDays: [7],
    depositMin: 500,  depositMax: 2000,  depositOptions: [500, 1000, 1500, 2000],
    successPayout: 10, successCreditTotal: 15, failCredit: -10,
    creditCap: 70, witnessFullCredit: 8,
  },
  90: {
    totalDays: 90, judgeCount: 4, breakLimit: 4,
    nodeDays: [1, 30, 60, 90],   midPayoutDays: [7, 30],
    depositMin: 1000, depositMax: 5000, depositOptions: [1000, 1500, 2000, 5000],
    successPayout: 20, successCreditTotal: 35, failCredit: -20,
    creditCap: 80, witnessFullCredit: 8,
  },
};

/** 节点命名（参数表 1.5） */
function nodeNames(periodDays) {
  if (periodDays === 7)  return ['起始称重', '结束称重'];
  if (periodDays === 14) return ['起始称重', '中期称重', '结束称重'];
  if (periodDays === 30) return ['起始称重', '中期称重', '中期复核', '结束称重'];
  return ['起始称重', '中期称重', '中期复核', '结束称重'];
}

/**
 * 计算日期（参数表 1.2）
 *   生效日 = 发起当天 + 24 小时
 *   第 N 天 = 生效日 + (N - 1) 天
 *   结束日 = 生效日 + (周期 - 1) 天
 */
function calcDates(periodDays, prepEndAt) {
  const start = new Date(prepEndAt);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + (periodDays - 1));
  const toDateStr = (d) => d.toISOString().slice(0, 10);
  return { startDate: toDateStr(start), endDate: toDateStr(end) };
}

/** 今天是第几天（1 ~ 周期） */
function dayIndexOf(periodDays, startDate, now = new Date()) {
  const s = new Date(startDate + 'T00:00:00Z').getTime();
  const n = new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z').getTime();
  const diff = Math.floor((n - s) / 86400000) + 1;
  if (diff < 1) return 0;
  if (diff > periodDays) return periodDays + 1;
  return diff;
}

/** 某天是不是称重节点日 */
function isNodeDay(periodDays, dayIndex) {
  return PERIODS[periodDays].nodeDays.includes(dayIndex);
}

/** 第几个节点（1 起）；不是节点日返回 0 */
function nodeIndexOf(periodDays, dayIndex) {
  const idx = PERIODS[periodDays].nodeDays.indexOf(dayIndex);
  return idx >= 0 ? idx + 1 : 0;
}

/* ===========================================================================
 * 二、强度档位 T0–T3（参数表第 2 章）
 * ========================================================================= */

/** 见证席人数 → 档位 */
function tierByAttendance(attendedCount) {
  if (attendedCount <= 0) return 'T0';
  if (attendedCount <= 2) return 'T1';
  if (attendedCount <= 4) return 'T2';
  return 'T3';
}

/** 档位 → 系数（成功加分 / 失败扣分都用它） */
const TIER_FACTOR = { T0: 0.6, T1: 0.8, T2: 1.0, T3: 1.0 };

/**
 * 有效档位只降不升（参数表 2.5）
 *   取所有节点里最低的那个档位作为最终有效档位。
 * @param {Array<string>} tierHistory 各节点结算时的档位
 */
function effectiveTier(tierHistory) {
  if (!tierHistory || !tierHistory.length) return 'T0';
  const order = { T0: 0, T1: 1, T2: 2, T3: 3 };
  let min = 'T3';
  for (const t of tierHistory) {
    if (t in order && order[t] < order[min]) min = t;
  }
  return min;
}

/* ===========================================================================
 * 三、信用分（参数表第 3 章）
 * ========================================================================= */

const CREDIT = {
  initial: 60,
  max: 100,
  min: 45,
};

/** 信用分 → 等级 */
function creditTierOf(score) {
  if (score >= 90) return '卓越';
  if (score >= 80) return '优秀';
  if (score >= 70) return '良好';
  if (score >= 60) return '普通';
  if (score >= 45) return '受限';
  return '受限';
}

/** 信用等级 → 押金上限 / 失败扣收比例 / 可立周期（参数表 5.2） */
const CREDIT_TIER_RULES = {
  '受限': { depositMax: 200,  failRate: 0.40, periods: [7] },
  '普通': { depositMax: 500,  failRate: 0.35, periods: [7, 14] },
  '良好': { depositMax: 1000, failRate: 0.30, periods: [7, 14, 30] },
  '优秀': { depositMax: 2000, failRate: 0.25, periods: [7, 14, 30, 90] },
  '卓越': { depositMax: 5000, failRate: 0.20, periods: [7, 14, 30, 90] },
};

/** 事件码 → 名义分值（参数表 3.1） */
const CREDIT_EVENTS = {
  flag_success_7:   { raw: 5,   scale: true },
  flag_success_14:  { raw: 10,  scale: true },
  flag_success_30:  { raw: 15,  scale: true },
  flag_success_90:  { raw: 35,  scale: true },
  flag_fail_7:      { raw: -5,  scale: true },
  flag_fail_14:     { raw: -5,  scale: true },
  flag_fail_30:     { raw: -10, scale: true },
  flag_fail_90:     { raw: -20, scale: true },
  flag_cheat:       { raw: -30, scale: false },
  milestone_7day:   { raw: 1,   scale: false },
  witness_pass:     { raw: 2,   scale: false },
  witness_cheat:    { raw: 3,   scale: false },
  witness_false:    { raw: -8,  scale: false },
  witness_missed:   { raw: -5,  scale: false },
  supervisor_upheld:{ raw: 1,   scale: false },
  supervisor_reject:{ raw: -8,  scale: false },
  witness_doubt:    { raw: 0,   scale: false },
  witness_norespond:{ raw: 0,   scale: false },
};

/**
 * 算一次信用分入账后的新分值（带上下限）
 */
function applyCredit(current, delta) {
  return Math.max(CREDIT.min, Math.min(CREDIT.max, current + delta));
}

/**
 * 算「这个 Flag 结算时，信用分该加/扣多少」
 */
function settleCreditDelta(periodDays, tier, success) {
  const key = `${success ? 'flag_success' : 'flag_fail'}_${periodDays}`;
  const ev = CREDIT_EVENTS[key];
  if (!ev) return 0;
  const factor = ev.scale ? TIER_FACTOR[tier] : 1;
  return Math.round(ev.raw * factor);
}

/* ===========================================================================
 * 四、押金（参数表第 5 章）
 * ========================================================================= */

/**
 * 新人保护：第 1 个 Flag 免费（参数表 5.7）
 */
function depositRequired(flagsCreated, periodDays) {
  if (flagsCreated === 0 && (periodDays === 7 || periodDays === 14)) {
    return { amount: 0, free: true, reason: '新人保护：第 1 个 Flag 免费' };
  }
  const p = PERIODS[periodDays];
  return { amount: p.depositMin, free: false, reason: '' };
}

/**
 * 押金校验：能不能选这个周期 + 这个金额
 */
function validateDeposit(creditScore, periodDays, amount) {
  const tierName = creditTierOf(creditScore);
  const rule = CREDIT_TIER_RULES[tierName];
  const p = PERIODS[periodDays];

  if (!rule.periods.includes(periodDays)) {
    return { ok: false, reason: `信用分 ${creditScore}（${tierName}）不能立 ${periodDays} 天的 Flag` };
  }
  if (amount < p.depositMin) {
    return { ok: false, reason: `${periodDays} 天的押金不能低于 ${p.depositMin} 元` };
  }
  if (amount > rule.depositMax) {
    return { ok: false, reason: `信用分 ${creditScore}（${tierName}）押金上限 ${rule.depositMax} 元` };
  }
  if (amount > p.depositMax) {
    return { ok: false, reason: `${periodDays} 天的押金不能超过 ${p.depositMax} 元` };
  }
  return { ok: true, tierName, failRate: rule.failRate, depositMax: rule.depositMax };
}

/**
 * 押金结算（参数表 5.4）
 * @returns {{refund:number, deduct:number}}
 */
function settleDeposit(paid, tierName, success) {
  if (success) return { refund: paid, deduct: 0 };
  const rate = (CREDIT_TIER_RULES[tierName] || CREDIT_TIER_RULES['普通']).failRate;
  const paidCents = Math.round(paid * 100);
  const deductCents = Math.round(paidCents * rate);
  return {
    refund: (paidCents - deductCents) / 100,
    deduct: deductCents / 100,
  };
}

/* ===========================================================================
 * 五、断卡（参数表 1.7 ~ 1.10）
 * ========================================================================= */

/**
 * 断卡后处于什么状态（参数表 1.8）
 * @returns {'fail'|'danger'|'reset'}
 */
function breakState(breakLimit, breaks) {
  if (breaks > breakLimit) return 'fail';
  if (breaks === breakLimit) return 'danger';
  return 'reset';
}

/** 断卡预警文案（参数表 1.9） */
function breakWarning(breakLimit, breaks) {
  const remain = breakLimit - breaks;
  if (remain >= 2) return { level: 'soft', text: `你还可以断 ${remain} 次` };
  if (remain >= 0) return { level: 'strong', text: '再断 1 次，这个 Flag 就结束了' };
  return { level: 'strong', text: '立即判负，生成失败记录卡' };
}

/** 补卡窗口：12 小时（参数表 1.10） */
const MAKEUP_WINDOW_HOURS = 12;

/* ===========================================================================
 * 六、见证席判定与结算（参数表第 4 章）
 * ========================================================================= */

const DECISION = {
  PASS: 'pass',
  CHEAT: 'cheat',
  DOUBT: 'doubt',
  NONE: null,
};

/**
 * 见证门槛检查（参数表 4.5）
 */
function witnessQuorum(acceptedCount, judgeCount) {
  const need = Math.max(1, Math.ceil(judgeCount / 2));
  return { need, met: acceptedCount >= need, acceptedCount };
}

/**
 * 聚合判定结果（参数表 4.4 / 4.7）
 */
function aggregateVerdict(verdicts) {
  let pass = 0, cheatVotes = 0, doubt = 0, none = 0;
  for (const v of verdicts) {
    if (v.decision === DECISION.PASS) pass++;
    else if (v.decision === DECISION.CHEAT) cheatVotes++;
    else if (v.decision === DECISION.DOUBT) doubt++;
    else none++;
  }
  const total = verdicts.length;
  const cheatThreshold = total > 0 ? Math.ceil(total / 3) : 0;
  const cheat = cheatVotes > 0 && cheatVotes >= cheatThreshold;
  let outcome;
  if (cheat) outcome = 'cheat';
  else if (pass > 0) outcome = 'pass';
  else if (doubt > 0) outcome = 'doubt';
  else outcome = 'none';

  return { outcome, cheat, pass, cheatVotes, doubt, none, total };
}

/**
 * 结算分值对照（参数表 4.9）——「分值唯一真相来源」
 */
function settleVerdictCredit(role, agg, ctx) {
  if (role === 'supervisor') {
    return ctx.respondent ? (ctx.cheatEstablished ? 1 : -8) : 0;
  }
  if (!ctx.respondent) return 0;
  if (agg.outcome === 'doubt') return 0;
  if (ctx.cheatEstablished) {
    return ctx.missedCheat ? -5 : 3;
  }
  if (agg.outcome === 'pass') {
    return ctx.factCheatButPassed ? -5 : 2;
  }
  return 0;
}

/* ===========================================================================
 * 七、成功/失败判定与结局（参数表第 10 章）
 * ========================================================================= */

/**
 * 成功判定条件（参数表 10.2）
 */
function judgeOutcome({ periodDays, checkedDays, finalWeight, targetWeight, breaks, cheatEstablished }) {
  if (cheatEstablished) {
    return { success: false, reason: 'cheat', reasonText: '作弊成立，判负' };
  }
  const limit = PERIODS[periodDays].breakLimit;
  if (breaks > limit) {
    return { success: false, reason: 'break', reasonText: '断卡超出上限，判负' };
  }
  if (checkedDays < PERIODS[periodDays].totalDays - limit) {
    return { success: false, reason: 'break', reasonText: '打卡天数不足，判负' };
  }
  if (finalWeight === null || finalWeight === undefined) {
    return { success: false, reason: 'no_data', reasonText: '缺少最终体重数据，判负' };
  }
  if (finalWeight > targetWeight) {
    return { success: false, reason: 'not_reached', reasonText: '未达到目标体重，判负' };
  }
  return { success: true, reason: 'success', reasonText: '达标，押金全额退还' };
}

/* ===========================================================================
 * 八、中期到账（参数表 1.6 / 3.3）
 * ========================================================================= */

function midPayoutCredit(periodDays, payoutDay) {
  if (periodDays === 7) return 0;
  if (payoutDay === 7) return 5;
  if (payoutDay === 30) return 10;
  return 0;
}

module.exports = {
  PERIODS,
  nodeNames,
  calcDates,
  dayIndexOf,
  isNodeDay,
  nodeIndexOf,

  tierByAttendance,
  TIER_FACTOR,
  effectiveTier,

  CREDIT,
  CREDIT_EVENTS,
  creditTierOf,
  CREDIT_TIER_RULES,
  applyCredit,
  settleCreditDelta,

  depositRequired,
  validateDeposit,
  settleDeposit,

  breakState,
  breakWarning,
  MAKEUP_WINDOW_HOURS,

  DECISION,
  witnessQuorum,
  aggregateVerdict,
  settleVerdictCredit,

  judgeOutcome,

  midPayoutCredit,
};
