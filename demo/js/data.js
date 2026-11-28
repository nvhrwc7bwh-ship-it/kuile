/* ============================================================
   亏了 · Mock 数据
   ============================================================ */

/* ME 现在只保留「不变的身份信息」。
   所有会变化的数值（信用分 / 见证次数 / 我的 Flag …）
   都放在 js/state.js 的 STATE 里，由页面动态读取。 */
const ME = {
  id: 'u_me',
  name: '老王',
  avatar: '王',
  color: '#FF6B00',
  phone: '138****6688',
  /* ⚠️ 2026-11-24 用户口径：「『我的』在最上面，除了现在有的头像、见证席次数，
     还包括用户的年龄、加入『亏了』的时间，ID号（这个需要备注号，
     每一个账户有独一无二的ID号，把编号 A7K3M9 改为ID号）、
     个性签名、所在省份，右上角增加一个编辑资料的按钮。」
     —— 这些是【可编辑的个人资料】，所以放 STATE（用户在「编辑资料」里能改）。
        这里只放默认值。 */
  profile: {
    /* 唯一 ID 号 —— 每个人一个，公开可见（用于互相识别，不是隐私） */
    userCode: 'A7K3M9',
    age: 32,
    /* 性别 */
    gender: '男',
    /* 加入「亏了」的时间 */
    joinedAt: '2026-09-08',
    /* 个性签名 */
    bio: '不靠意志力，靠有人盯着。',
    /* 所在省份 */
    province: '浙江',
  },
  /* 性别可选值 */
  genders: ['男', '女', '保密'],
  /* 可选省份列表（编辑资料时用） */
  provinces: ['北京','上海','天津','重庆','河北','山西','辽宁','吉林','黑龙江','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','广西','海南','四川','贵州','云南','陕西','甘肃','青海','内蒙古','西藏','宁夏','新疆'],
};

const TIER_META = {
  T0: { name: '独自打卡', tier: 0, desc: '0 位见证席', creditMul: 0.6, back: '标「独立打卡」', weight: '不进推荐位' },
  T1: { name: '轻见证',   tier: 1, desc: '1–2 位',     creditMul: 0.8, back: '显示 1–2 人头像', weight: '常规' },
  T2: { name: '标准见证', tier: 2, desc: '3–4 位',     creditMul: 1.0, back: '完整背书', weight: '常规' },
  T3: { name: '强见证',   tier: 3, desc: '5 位以上',   creditMul: 1.0, back: '完整背书 + 优先推荐', weight: '加权' },
};

/* ---------- 信用分（见需求规格 R8） ----------
   初始 60 / 上限 100 / 下限 45 / 5 档（受限·普通·良好·优秀·卓越）
   ⚠️ 数组必须按 min 升序排列：creditNextAt() 依赖顺序取"下一个 min > score"
   ⚠️ 2026-11-25（本轮修复）：**5 档必须 5 个不同的 cls**。
      原来「良好」和「优秀」共用 `lv-good`，而 CSS 里也只有 4 个等级色 ——
      结果 70 分和 80 分在页面上看起来一模一样，但押金上限差一倍（1000 vs 2000）、
      失败扣收差 5 个点（30% vs 25%），用户完全看不出自己处在哪一档。
      现在「优秀」单独用 `lv-great`（见 app.css 的 `.lv-great`）。
   depCap = 押金上限；rate = 失败扣收比例（%） */
const CREDIT_TIERS = [
  { min: 45, max: 59,  name: '受限', cls: 'lv-limited',   depCap: 200,  rate: 40, maxFlag: '7 天' },
  { min: 60, max: 69,  name: '普通', cls: 'lv-normal',    depCap: 500,  rate: 35, maxFlag: '7 / 14 天' },
  { min: 70, max: 79,  name: '良好', cls: 'lv-good',      depCap: 1000, rate: 30, maxFlag: '7 / 14 / 30 天' },
  { min: 80, max: 89,  name: '优秀', cls: 'lv-great',     depCap: 2000, rate: 25, maxFlag: '7 / 14 / 30 / 90 天' },
  { min: 90, max: 100, name: '卓越', cls: 'lv-excellent', depCap: 5000, rate: 20, maxFlag: '7 / 14 / 30 / 90 天' },
];

const CREDIT_BASE = { init: 60, max: 100, min: 45 };

/* Flag 周期 → 信用分基础分（分段到账，见需求规格 R8.1 / R8.3）
   mid: 中期到账节点 [第N天, 分值]  ·  end: 结束到账分值  ·  fail: 失败扣分 */
const CREDIT_FLAG = {
  7:  { mid: [],                    end: 5,  fail: 5  },
  14: { mid: [[7, 5]],              end: 5,  fail: 5  },
  30: { mid: [[7, 5]],              end: 10, fail: 10 },
  90: { mid: [[7, 5], [30, 10]],    end: 20, fail: 20 },
};

/* 见证席分值（按节点，见需求规格 R8.1）
   每节点 +2 不变；陪到底收益按周期递增（见 R8.1 边界说明）
   ⚠️ 每周上限从 +6 提到 +8 —— 否则 30/90 天局（4 节点）一次就顶格，规则自相矛盾 */
const CREDIT_WITNESS = { pass: 2, cheat: 3, misreport: -8, miss: -5, weeklyCap: 8, maxConcurrent: 3 };

/* ---------- 见证席判定节点计划（见需求规格 R5.4）----------
   判定次数按周期缩放：7 天 2 次 / 14 天 3 次 / 30 天 4 次 / 90 天 4 次
   ⚠️ 节点位置写死，不随见证席人数变化；发起时算好写入规则快照 */
const NODE_PLAN = {
  7:  [1, 7],
  14: [1, 7, 14],
  30: [1, 10, 20, 30],
  90: [1, 30, 60, 90],
};

/* 节点名：首尾固定，中间是「中期称重 / 中期复核」—— 不区分会出现两条一样的「中期称重」 */
const NODE_NAMES = {
  7:  ['起始称重', '结束称重'],
  14: ['起始称重', '中期称重', '结束称重'],
  30: ['起始称重', '中期称重', '中期复核', '结束称重'],
  90: ['起始称重', '中期称重', '中期复核', '结束称重'],
};

/** 某个周期陪到底的信用分收益（= 节点数 × 每节点 +2） */
function witnessFullTotal(days){
  return (NODE_PLAN[days] || []).length * CREDIT_WITNESS.pass;
}

/* ---------- 筹备期与见证席邀约（见需求规格 R1.1 / R5.5）----------
   筹备期 = 发起后 24 小时，只能继续找见证人，其他一概不可改
   邀约有效期 12 小时 —— 到期作废并释放坑位，让发起人 24h 内还能继续邀
   坑位上限 10：accepted + pending 合并计算 */
const PREP_HOURS = 24;             // 筹备期时长（小时）
const INVITE_TTL_HOURS = 12;       // 单个邀约的有效期（小时）
const RECRUIT_WINDOW_HOURS = 20;   // 召集令报名窗口（小时），必须 < 筹备期
const WITNESS_MAX = 10;            // 见证席坑位上限
/* ⚠️ 2026-11-24（本轮新增）：【按周期定的见证席坑位数】——
   招募详情页要展示「已有几个坑位、还差几位」——
   坑位数按周期定（跟判定节点数同一套口径，见需求规格 R5.4）：
   7 天 2 个 / 14 天 3 个 / 30 天 4 个 / 90 天 4 个。 */
const WITNESS_SLOTS_BY_DAYS = { 7:2, 14:3, 30:4, 90:4 };
/* ⚠️ 2026-11-24 用户口径（改）：「成为见证席的理由，简化为累计完成 10 次互动就行了，
   点赞或留言。」
   —— 门槛从「完整监督 1 次」换成【累计互动 10 次】。
   —— 放在 data.js（不是 state.js），因为 info.js 要用它 —— info.js 加载得比 state.js 早。 */
const WITNESS_APPLY_INTERACTIONS = 10;
/* ⚠️ 2026-11-24 用户口径：「当用户点击超过3个的时候，弹出提示最多一次申请3个。」
   —— 一次最多同时申请参加 3 个正在招募见证的 Flag。
      （同一个原因，太多会被发起人当成「广撒网」，反而没人当真。） */
const WITNESS_JOIN_MAX = 3;

/* 见证席邀约状态 */
const WITNESS_STATUS = {
  pending:   { name: '待接受', occupy: true  },
  accepted:  { name: '已接受', occupy: true  },
  declined:  { name: '已拒绝', occupy: false },
  expired:   { name: '已过期', occupy: false },
  withdrawn: { name: '已退出', occupy: false },
};

/* ---------- 见证门槛与有效档位（见需求规格 R1.2.1 / R5.3）----------
   见证门槛 = min(应到人数, max(2, ceil(应到×50%)))
   ⚠️ min 这一层不能省：没有它，应到 1 人时门槛 = 2 而已判定数最大为 1 → 永远降级 */
function witnessQuorum(expected){
  const n = Math.max(0, expected | 0);
  return Math.min(n, Math.max(2, Math.ceil(n * 0.5)));
}

/** 按人数取档位 —— 0→T0 / 1–2→T1 / 3–4→T2 / 5+→T3 */
function tierByCount(count){
  const n = Math.max(0, count | 0);
  if (n === 0) return 'T0';
  if (n <= 2) return 'T1';
  if (n <= 4) return 'T2';
  return 'T3';
}

/** 有效档位只降不升：返回两个档位里更低的那个（T0 < T1 < T2 < T3） */
function tierMin(a, b){
  const order = ['T0','T1','T2','T3'];
  const ia = order.indexOf(a), ib = order.indexOf(b);
  if (ia < 0) return b;
  if (ib < 0) return a;
  return ia <= ib ? a : b;
}

/** 见证席坑位占用数 = 已接受 + 待接受（见 R5.5.2） */
function witnessSlots(witnesses){
  return (witnesses || []).filter(w =>
    w.status === 'accepted' || w.status === 'pending'
  ).length;
}

/** 已接受人数 —— 定档依据（待接受不算） */
function witnessAccepted(witnesses){
  return (witnesses || []).filter(w => w.status === 'accepted').length;
}

/** demo 里的「今天」—— 与 calCalendar / daysLeft 用同一个口径 */
/** 立据时间格式化：YYYY-MM-DD HH:mm（见 D10.3.3）
 *  优先用 flag.createdAt（发起那一刻的真实时刻）；没有则退回 start 日期。 */
function fmtStamp(ts, fallbackIso) {
  let d;
  if (ts) d = new Date(ts);
  else if (fallbackIso) {
    const p = fallbackIso.split('-').map(Number);
    d = new Date(p[0], p[1] - 1, p[2], 9, 30);
  } else return '';
  const p2 = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** demo 里的「今天」—— 与 calCalendar / daysLeft 同一个口径 */
const DEMO_TODAY = '2026-11-16';

/** 把日期加 n 天，输出 YYYY-MM-DD（本地时区，不走 UTC，避免跨时区错一天） */
function isoAddDays(iso, n){
  const p = iso.split('-').map(Number);
  const d = new Date(p[0], p[1]-1, p[2]);
  d.setDate(d.getDate() + n);
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return d.getFullYear() + '-' + m + '-' + dd;
}

/** 按周期展开节点列表（见需求规格 R5.4）
 *  手写的 nodes 只有 起始 / 中期 / 结束 三条，这里按 NODE_PLAN 补齐
 *  30 天档缺的第 20 天、90 天档缺的第 60 天 —— 也就是「中期复核」 */
function expandNodes(f){
  const plan = NODE_PLAN[f.days];
  if (!plan) return f.nodes || [];
  const names = NODE_NAMES[f.days] || [];
  const lastActive = f.checkedDays || 0;
  const out = [];
  plan.forEach((day, i) => {
    const iso = isoAddDays(f.start, day - 1);
    const hit = (f.nodes || []).find(n => n.name === names[i] && n.date === iso);
    if (hit) { out.push(hit); return; }
    // 自动补出来的节点：状态按打卡进度推
    let state = 'future';
    if (day <= lastActive) state = 'done';
    else if (iso === DEMO_TODAY) state = 'now';
    out.push({
      name: names[i], date: iso, state,
      note: state === 'done' ? '已验证' : (state === 'now' ? '就是今天' : ''),
    });
  });
  return out;
}

/* 监督席分值（见需求规格 R8.1） */
const CREDIT_SUPERVISOR = { valid: 1, invalid: -8 };

/* 不乘强度系数的固定扣分（见需求规格 R8.1 / R8.4）
   判负固定 -30 不按周期
   ⚠️ 「举报成立 -20 / 不成立 -8」已删除 —— 见证席举报 = 判定面板的「作弊」，
      成立走见证席判定口径（+3）、发起人侧走判负 -30；不成立走见证席误报 -8 */
const CREDIT_PENALTY = { judgedNegative: -30, milestone: 1 };

/* ---------- 断卡规则（见需求规格 第九节） ----------
   容忍次数按周期缩放，由完成率反推：
     7 天  0 次（入门档必须能闭环）
     14 天 1 次（92.9%）
     30 天 2 次（93.3%）
     90 天 4 次（95.6%）
   ⚠️ 断卡 ≠ 立即失败：次数用尽之前只走软惩罚（9.3）
   ⚠️ 补卡窗口 12 小时：超窗才算断卡，补卡标「补」不标红（9.5） */
const BREAK_RULES = {
  limits: { 7: 0, 14: 1, 30: 2, 90: 4 },
  makeupWindowHours: 12,
};

/** 某个周期允许的断卡次数 */
function breakLimitOf(days) {
  const L = BREAK_RULES.limits;
  if (L[days] !== undefined) return L[days];
  const ks = Object.keys(L).map(Number).sort((a,b)=>a-b);
  let v = L[ks[0]];
  for (const k of ks) if (days >= k) v = L[k];
  return v;
}

/** 某个 Flag 剩余可断卡次数 */
function breakLeftOf(f) {
  if (!f) return 0;
  return Math.max(0, breakLimitOf(f.totalDays || f.days || 30) - (f.breaks || 0));
}

/* ---------- 押金区间（见需求规格 R10.2） ----------
   周期决定「下限 ~ 上限」，信用等级决定上限（depCap）；
   可选区间 = [ 周期下限 , min(信用上限, 周期上限) ]
   可立周期 = 周期下限 < 信用上限（严格小于 → 不产生单档格）

   ⚠️ 2026-11-22 用户口径（改）：「取消掉固定 0 元这个设定了，相关的都删了，
      还是改成只有首次可以 0 元……只有第一次可以选这个。
      首次免费只有 7、14 因为用户信用分选不了其他的。」
      —— 0 元不是「随时可选的档位」，是【一次性新人礼】：
         只在【第一个 Flag】时出现，且只覆盖 7 / 14 天（信用分 60 起只解锁这两档）。 */
const FLAG_DEP_RANGE = {
  7:  { min: 100,  max: 500,  label: '7 天'  },
  14: { min: 200,  max: 1000, label: '14 天' },
  30: { min: 500,  max: 2000, label: '30 天' },
  90: { min: 1000, max: 5000, label: '90 天' },
};

/* 全局押金阶梯（9 档，见需求规格 R10.2）
   每个周期固定给出 4 个档位（2×2 展示），且周期上限档必在其中 —— 否则信用上限就形同虚设：
   卓越能押 5000、优秀只能押 2000，这个差别必须体现在可选档位上。 */
const DEP_TIERS = [100, 200, 300, 500, 1000, 1500, 2000, 3000, 5000];

/* 0 元（首次免费）—— 只在第一个 Flag 时提供，且只覆盖 7 / 14 天 */
const DEP_ZERO = 0;

/* 首次免费覆盖的周期（见需求规格 R10.4）
   ⚠️ 只有 7 / 14 天 —— 新用户 60 分只解锁这两档（30 天要 70 分、90 天要 80 分），
      所以「首次免费」天然就是 7 / 14 这一段，不会出现「第一次就能白嫖 90 天」。 */
const FIRST_FREE_PERIODS = [7, 14];

/* 每周期固定 4 档：区间内阶梯超过 4 个时，保留前 3 档 + 周期上限档 */
const DEP_TIER_COUNT = 4;
function depTiersFor(days){
  const fr = FLAG_DEP_RANGE[days];
  if(!fr) return [];
  const inRange = DEP_TIERS.filter(v => v >= fr.min && v <= fr.max);
  if(inRange.length <= DEP_TIER_COUNT) return inRange;
  return inRange.slice(0, DEP_TIER_COUNT - 1).concat(inRange[inRange.length - 1]);
}

/* ---------- 见证席 ----------
   ⚠️ 2026-11-25（本轮修复）：status 必须是**状态机取值**，不能是展示态文案。
   原来这里写的是 status:'已判定' —— 那是【页面上显示的字】，不是状态。
   后果：witnessExpected() 统计的是 `w.status === 'accepted'`，
        种子全是 '已判定' → **应到人数恒为 0** → 见证门槛恒为 0
        → 任何节点都能「零人判定通过」，降档规则（R1.2.1）整个失效。
   —— 展示态文案由页面自己拼（名单半屏用 w.verdict 显示「通过 / 见证中」），
      数据层只存状态。
   —— 状态取值：accepted 已接受 / pending 待接受 / declined 已拒绝 / expired 已过期 */
const WITNESSES = [
  { id:'w1', name:'小李', avatar:'李', color:'#2C5A87', role:'见证席', status:'accepted', verdict:'通过', joined:'第 1 天', responseRate:100, flagsWitnessed:12, realName:true },
  { id:'w2', name:'阿May', avatar:'M', color:'#8A6D1F', role:'见证席', status:'accepted', verdict:'通过', joined:'第 1 天', responseRate:95,  flagsWitnessed:8,  realName:true },
  { id:'w3', name:'大壮', avatar:'壮', color:'#9B3A2E', role:'见证席', status:'accepted', verdict:'通过', joined:'第 1 天', responseRate:88,  flagsWitnessed:5,  realName:true },
  { id:'w4', name:'小美', avatar:'美', color:'#5B7C99', role:'见证席', status:'accepted', verdict:'通过', joined:'第 12 天', responseRate:100, flagsWitnessed:3, realName:true },
  { id:'w5', name:'老周', avatar:'周', color:'#6B7B8C', role:'见证席', status:'accepted', verdict:'通过', joined:'第 1 天', responseRate:92, flagsWitnessed:7, realName:true },
];

/* ---------- 发起页的见证席草稿（见需求规格 R5.5）----------
   名单在筹备期（24h）结束时冻结 —— 之后不能再加、也不能移除
   邀约有效期 12 小时，到期作废并释放坑位
   状态：accepted 已接受 / pending 待接受 / declined 已拒绝 / expired 已过期
   ⚠️ 已接受名单在定档前决定初始档位；pending 不计入 */
const CREATE_WITNESSES = [
  { id:'w1', name:'小李', avatar:'李', color:'#2C5A87', role:'见证席', status:'accepted', responseRate:100, flagsWitnessed:12, realName:true },
  { id:'w2', name:'阿May', avatar:'M', color:'#8A6D1F', role:'见证席', status:'accepted', responseRate:95,  flagsWitnessed:8,  realName:true },
  { id:'w3', name:'大壮', avatar:'壮', color:'#9B3A2E', role:'见证席', status:'accepted', responseRate:88,  flagsWitnessed:5,  realName:true },
  { id:'w4', name:'小美', avatar:'美', color:'#5B7C99', role:'见证席', status:'accepted', responseRate:100, flagsWitnessed:3,  realName:true },
  { id:'w5', name:'老周', avatar:'周', color:'#6B7B8C', role:'见证席', status:'pending',  responseRate:92,  flagsWitnessed:7,  realName:true },
];

/* ---------- 见证席候选池（见需求规格 4.9.4） ----------
   卡片四个字段：信用分 / 见证席成立率 / 已见证次数 / 与发起人的关联度
   默认排序：关联度 > 信用分 > 成立率 */
const WITNESS_POOL = [
  { id:'p1', name:'林一',   avatar:'林', color:'#2C5A87', credit:92, rate:96, flagsWitnessed:14, supervised:7, relation:'共同好友', relationLevel:3 },
  { id:'p2', name:'苏晴',   avatar:'苏', color:'#8A6D1F', credit:88, rate:92, flagsWitnessed:9,  supervised:5, relation:'共同监督', relationLevel:2 },
  { id:'p3', name:'果果',   avatar:'果', color:'#9B3A2E', credit:81, rate:88, flagsWitnessed:6,  supervised:4, relation:'共同监督', relationLevel:2 },
  { id:'p4', name:'阿May',  avatar:'M',  color:'#5B7C99', credit:76, rate:85, flagsWitnessed:5,  supervised:3, relation:'共同好友', relationLevel:3 },
  { id:'p5', name:'大壮',   avatar:'壮', color:'#6B7B8C', credit:72, rate:74, flagsWitnessed:3,  supervised:2, relation:'—',        relationLevel:0 },
  { id:'p6', name:'小美',   avatar:'美', color:'#3F6B5C', credit:68, rate:67, flagsWitnessed:2,  supervised:1, relation:'—',        relationLevel:0 },
  { id:'p7', name:'阿强',   avatar:'强', color:'#7A5C8E', credit:64, rate:60, flagsWitnessed:1,  supervised:1, relation:'—',        relationLevel:0 },
];

/* ---------- 见证席召集令的报名者（见需求规格 R5.6）----------
   ⚠️ 2026-11-22 用户口径（改）：召集令不再跳独立页面 ——
      点「发布见证席召集令」就地发布，按钮变「见证席召集令已发布」，
      再点它从底部升起半屏看报名情况。所以报名者是【状态】而不是【另一个页面】。 */
const RECRUIT_SEED = [
  { id:'r1', name:'苏晴',   avatar:'苏', color:'#A85C7A', credit:90, rate:94, flagsWitnessed:12 },
  { id:'r2', name:'阿凯',   avatar:'凯', color:'#4A6B52', credit:82, rate:86, flagsWitnessed:6  },
  { id:'r3', name:'老周',   avatar:'周', color:'#6B7B8C', credit:74, rate:79, flagsWitnessed:4  },
];

/* ---------- 监督席（匿名，只计数） ---------- */
const SUPERVISORS = { count: 37, supporters: 41, phrases: 12, msgs: 3 };

/* ---------- 实时动态流（见需求规格 3.5） ----------
   事件类型：
     like    点赞聚合    → 「3 位监督席为你加油」
     phrase  预设短语    → 「林一 发送了「我盯着呢」」（短语内容可公开，见 22.2）
     msg     留言        → 「小李 留言：「…」」
                          ⚠️ 2026-11-23 口径反转：留言改成【公开可见】，
                             所以 msg 事件现在【带内容】了（原来只记事件不带内容）。
     echo    目标人回声  → 「老王 回了一句「…」」【所有人可见】（3.5.1） */
const ACTIVITY = {
  f_own: [
    { type:'echo',  who:'老王', text:'收到，今天称了 63.8', time:'1 小时前' },
    { type:'msg',   who:'林一', text:'别急，节奏挺稳的', time:'2 小时前' },
    { type:'like',  count:3, time:'2 小时前' },
    { type:'echo',  who:'老王', text:'谢谢，第 20 天那天就靠这句撑过去的', time:'2 天前' },
    { type:'phrase', who:'林一', text:'我盯着呢', time:'3 天前' },
  ],
  f_1: [
    { type:'like',  count:5, time:'刚刚' },
    { type:'phrase', who:'苏晴', text:'加油', time:'8 分钟前' },
    { type:'msg',   who:'大壮', text:'赌一顿火锅这个理由我笑了', time:'26 分钟前' },
  ],
  f_3: [
    { type:'phrase', who:'果果', text:'今天也别放弃', time:'12 分钟前' },
    { type:'like',  count:2, time:'40 分钟前' },
    { type:'msg',   who:'小李', text:'别急，节奏挺稳的，继续', time:'1 小时前' },
  ],
  f_6: [
    { type:'like',  count:1, time:'刚刚' },
    { type:'msg',   who:'陈默', text:'戒糖 14 天，我赌你第 10 天会破戒', time:'3 小时前' },
  ],
};

/** 取某个 Flag 的动态流；没有种子数据时按围观人数生成一份（见需求规格 3.5） */
function activityOf(f) {
  if (!f) return [];
  if (ACTIVITY[f.id]) return ACTIVITY[f.id];
  const seed = [
    { type:'like',   count: Math.max(1, Math.round(f.supervisorCount / 8)), time:'刚刚' },
    { type:'phrase', who:'果果',  text:'加油',         time:'12 分钟前' },
    { type:'msg',    who:'林一',  text:'我盯着呢',     time:'半小时前' },
    { type:'like',   count:2,                          time:'1 小时前' },
  ];
  ACTIVITY[f.id] = seed;
  return seed;
}

/* ---------- Flags ---------- */
const FLAGS = {
  f_own: {
    id:'f_own', mine:true,
    user:{name:'老王', avatar:'王', color:'#1F5F4E'},
    title:'婚礼前 90 天，瘦到能穿回那件西装',
    reason:'10 月 18 号的婚礼，同事都说我胖了两年了',
    startWeight: 68.4, curWeight: 63.1, targetWeight: 60.0,
    start:'2026-09-08', end:'2026-12-06', days: 90,
    status:'running', statusText:'进行中', tier:'T2', deposit:1000,
    checkedDays: 68, totalDays: 90, streak: 12, breaks: 1,
    witnesses: [WITNESSES[0],WITNESSES[1],WITNESSES[2],WITNESSES[3]], supervisorCount: 37,
    node: 'mid', // 当前处于中期节点前
    history: [
      { d:1,  w:68.4, ok:true,  note:'起始称重' },
      { d:2,  w:68.1, ok:true }, { d:3, w:67.9, ok:true }, { d:4, w:67.5, ok:true },
      { d:5,  w:null, ok:false, note:'断卡' },
      { d:6,  w:null, ok:true, makeup:true, note:'补卡' },
      { d:7,  w:67.2, ok:true }, { d:8, w:66.8, ok:true }, { d:9, w:66.5, ok:true },
    ],
    nodes: [
      { name:'起始称重', date:'2026-09-08', state:'done', note:'已验证 · 68.4kg'},
      { name:'中期称重', date:'2026-10-07', state:'done', note:'已验证 · 64.9kg · 见证席判定通过'},
      { name:'结束称重', date:'2026-12-06', state:'future'},
    ],
    msgs: [
      { from:'监督席', anon:true,  text:'老王加油，我盯着呢', time:'2 小时前',
        reply:{ text:'收到，今天称了 63.8', time:'1 小时前' } },
      { from:'监督席', anon:true,  text:'第 12 天那次断卡看得我心慌，还好你回来了', time:'昨天',
        reply:null },
      { from:'小李',   anon:false, text:'别急，节奏挺稳的，继续', time:'3 天前',
        reply:{ text:'谢谢，第 20 天那天就靠这句撑过去的', time:'2 天前' } },
    ],
    quote:'第 35 天想过放弃，但评论区那句「我盯着呢」让我第二天照常称了。',
  },

  f_1: {
    id:'f_1', mine:false,
    user:{name:'阿May', avatar:'M', color:'#8A6D1F'},
    title:'30 天从 58.2 降到 55，赌一顿火锅',
    reason:'体检报告出来了，血脂偏高',
    startWeight: 58.2, curWeight: 56.1, targetWeight: 55.0,
    start:'2026-10-28', end:'2026-11-26', days:30,
    status:'running', statusText:'进行中', tier:'T2', deposit:500,
    checkedDays:19, totalDays:30, streak:7, breaks:0,
    witnesses:[WITNESSES[0],WITNESSES[1],WITNESSES[2]], supervisorCount:52,
    node:'daily',
    history:[],
    nodes:[
      { name:'起始称重', date:'2026-10-28', state:'done', note:'已验证 · 58.2kg'},
      { name:'中期称重', date:'2026-11-06', state:'done', note:'已验证'},
      { name:'结束称重', date:'2026-11-26', state:'future'},
    ],
    msgs:[],
    quote:'',
  },

  f_2: {
    id:'f_2', mine:false,
    user:{name:'大壮', avatar:'壮', color:'#9B3A2E'},
    title:'14 天不喝奶茶，体重必须掉 2 公斤',
    reason:'被女朋友说胖了，这次要争口气',
    startWeight: 76.5, curWeight: 76.5, targetWeight: 74.5,
    start:'2026-11-14', end:'2026-11-27', days:14,
    status:'running', statusText:'进行中', tier:'T0', deposit:200,
    checkedDays:1, totalDays:14, streak:0, breaks:1,
    witnesses:[], supervisorCount:8,
    node:'daily',
    history:[{d:1,w:76.5,ok:true,note:'起始称重'},{d:2,w:null,ok:false,note:'断卡'}],
    nodes:[
      { name:'起始称重', date:'2026-11-14', state:'done', note:'已验证 · 76.5kg'},
      { name:'中期称重', date:'2026-11-20', state:'future'},
      { name:'结束称重', date:'2026-11-27', state:'future'},
    ],
    msgs:[], quote:'',
  },

  f_3: {
    id:'f_3', mine:false,
    user:{name:'小美', avatar:'美', color:'#5B7C99'},
    title:'90 天备孕前减 8 公斤，把体检指标拉回正常',
    reason:'医生说多囊需要先减重',
    startWeight: 71.2, curWeight: 67.4, targetWeight: 63.2,
    start:'2026-09-25', end:'2026-12-23', days:90,
    status:'running', statusText:'进行中', tier:'T3', deposit:1000,
    checkedDays:52, totalDays:90, streak:23, breaks:0,
    witnesses:[WITNESSES[0],WITNESSES[1],WITNESSES[2],WITNESSES[3],WITNESSES[4]], supervisorCount:128,
    node:'daily',
    history:[],
    nodes:[
      { name:'起始称重', date:'2026-09-25', state:'done', note:'已验证 · 71.2kg'},
      { name:'中期称重', date:'2026-10-24', state:'done', note:'已验证 · 69.1kg · 见证席判定通过'},
      { name:'结束称重', date:'2026-12-23', state:'future'},
    ],
    msgs:[], quote:'',
  },

  f_4: {
    id:'f_4', mine:false,
    user:{name:'老周', avatar:'周', color:'#6B7B8C'},
    title:'30 天把体脂从 25% 降到 21%',
    reason:'去年买的西装又穿不上了',
    startWeight: 80.0, curWeight: 79.2, targetWeight: 77.0,
    start:'2026-10-18', end:'2026-11-16', days:30,
    status:'ending', statusText:'即将结算', tier:'T1', deposit:500,
    checkedDays:29, totalDays:30, streak:29, breaks:0,
    witnesses:[WITNESSES[2]], supervisorCount:24,
    node:'ending',
    history:[],
    nodes:[
      { name:'起始称重', date:'2026-10-18', state:'done', note:'已验证 · 80.0kg'},
      { name:'中期称重', date:'2026-10-27', state:'done', note:'已验证 · 79.6kg'},
      { name:'结束称重', date:'2026-11-16', state:'now', note:'还有 1 天'},
    ],
    msgs:[], quote:'',
  },

  f_5: {
    id:'f_5', mine:false,
    user:{name:'果果', avatar:'果', color:'#A8756B'},
    title:'30 天没吃夜宵，从 62 到 58',
    reason:'连续熬夜一年了',
    startWeight: 62.0, curWeight: 58.6, targetWeight: 58.0,
    start:'2026-10-18', end:'2026-11-16', days:30,
    status:'failed', statusText:'未达标', tier:'T1', deposit:500,
    checkedDays:27, totalDays:30, streak:0, breaks:3,
    lostAmount: 175, creditDelta: -8,
    /* ⚠️ 2026-11-24：押金原值 —— 结算后 deposit 会被清零，
       但记录卡要显示「这一局当时押了多少钱」。 */
    depositPaid: 500,
    witnesses:[WITNESSES[0]], supervisorCount:41,
    node:'done',
    history:[],
    nodes:[
      { name:'起始称重', date:'2026-10-18', state:'done', note:'已验证 · 62.0kg'},
      { name:'中期称重', date:'2026-10-27', state:'done', note:'已验证 · 60.1kg'},
      { name:'结束称重', date:'2026-11-16', state:'fail', note:'未达标'},
    ],
    msgs:[],
    quote:'虽然没到 58，但 27 天没吃夜宵是我这半年最大的胜利。',
  },

  f_6: {
    id:'f_6', mine:false,
    user:{name:'阿凯', avatar:'凯', color:'#4A6B52'},
    title:'14 天戒糖，等着看体重秤',
    reason:'想试试能不能打破平台期',
    startWeight: 65.0, curWeight: 65.0, targetWeight: 63.5,
    start:'2026-11-10', end:'2026-11-23', days:14,
    status:'running', statusText:'进行中', tier:'T1', deposit:200,
    checkedDays:6, totalDays:14, streak:6, breaks:0,
    witnesses:[WITNESSES[3]], supervisorCount:15,
    node:'daily',
    history:[],
    nodes:[
      { name:'起始称重', date:'2026-11-10', state:'done', note:'已验证 · 65.0kg'},
      { name:'中期称重', date:'2026-11-16', state:'now', note:'就是今天'},
      { name:'结束称重', date:'2026-11-23', state:'future'},
    ],
    msgs:[], quote:'',
  },

  f_success: {
    id:'f_success', mine:true,
    user:{name:'老王', avatar:'王', color:'#1F5F4E'},
    title:'30 天减 5 公斤',
    reason:'体检报告说超重，先从轻的来',
    startWeight: 73.2, curWeight: 68.2, targetWeight: 68.2,
    start:'2026-06-18', end:'2026-07-17', days:30,
    status:'success', statusText:'已达标', tier:'T2', deposit:500,
    checkedDays:30, totalDays:30, streak:30, breaks:0,
    /* ⚠️ 2026-11-24：已结算的局要有结算数据 —— 记录卡和详情页都要读它
       （押金原值 / 全额退回多少 / 信用分变化）。 */
    depositPaid:500, refunded:500, lostAmount:0, creditDelta:3,
    witnesses:[WITNESSES[0],WITNESSES[1],WITNESSES[2]], supervisorCount:83,
    node:'done',
    history:[],
    nodes:[
      { name:'起始称重', date:'2026-06-18', state:'done', note:'已验证 · 73.2kg'},
      { name:'中期称重', date:'2026-06-27', state:'done', note:'已验证 · 70.7kg'},
      { name:'结束称重', date:'2026-07-17', state:'done', note:'已达标 · 68.2kg'},
    ],
    msgs:[],
    quote:'第 18 天想放弃，是见证席那句「别急」让我撑过去。',
  },

  f_stop: {
    id:'f_stop', mine:true,
    user:{name:'老王', avatar:'王', color:'#1F5F4E'},
    title:'产后 90 天恢复计划',
    reason:'医生说先从核心肌群开始',
    startWeight: 76.0, curWeight: 74.2, targetWeight: 72.0,
    start:'2026-08-19', end:'2026-11-16', days:90,
    status:'failed', statusText:'未达标', tier:'T2', deposit:1000,
    checkedDays:41, totalDays:90, streak:12, breaks:0,
    /* ⚠️ 2026-11-24：已结算的局要有结算数据 —— 记录卡和详情页都要读它
       （押金原值 / 实际扣了多少 / 信用分变化）。 */
    depositPaid:1000, lostAmount:350, creditDelta:-8,
    witnesses:[WITNESSES[0],WITNESSES[1],WITNESSES[2]], supervisorCount:29,
    node:'done',
    history:[],
    nodes:[
      { name:'起始称重', date:'2026-08-19', state:'done', note:'已验证 · 76.0kg'},
      { name:'中期称重', date:'2026-09-17', state:'done', note:'已验证 · 75.1kg'},
      { name:'结束称重', date:'2026-11-16', state:'fail', note:'未达标 · 结束体重未到目标'},
    ],
    msgs:[],
    quote:'医生说需要暂停，我还是撑到了最后一天 —— 没到目标，但记录是完整的。',
  },
};

/* ---------- 广场信息流 ---------- */
/* 排序策略：强见证 / 即将结算 / 进行中优先，同状态按监督人数降序 */
const FEED = [
  'f_3','f_4','f_1','f_6','f_2','f_5',
  'f_7','f_9','f_10','f_8','f_12','f_11',
  'f_13','f_14','f_15','f_16','f_17',
];

/* ---------- 广场扩充数据（更多真实用户） ---------- */
Object.assign(FLAGS, {  f_7: {
    id:'f_7', mine:false,
    user:{name:'林一', avatar:'林', color:'#3D6B4A'},
    title:'30 天每天跑 5 公里，跑到能连续不喘',
    reason:'体检静息心率偏高',
    startWeight: 64.0, curWeight: 61.8, targetWeight: 60.0,
    start:'2026-10-30', end:'2026-11-28', days:30,
    status:'running', statusText:'进行中', tier:'T3', deposit:500,
    checkedDays:17, totalDays:30, streak:9, breaks:0,
    witnesses:[WITNESSES[0],WITNESSES[3],WITNESSES[4],WITNESSES[1],WITNESSES[2]],
    supervisorCount:186, node:'daily', history:[], msgs:[], quote:'',
    nodes:[
      { name:'起始称重', date:'2026-10-30', state:'done', note:'已验证 · 64.0kg'},
      { name:'中期称重', date:'2026-11-08', state:'done', note:'已验证'},
      { name:'结束称重', date:'2026-11-28', state:'future'},
    ],
  },
  f_8: {
    id:'f_8', mine:false,
    user:{name:'陈默', avatar:'陈', color:'#5B5F8C'},
    title:'14 天每天早睡，把作息调回来',
    reason:'连续熬夜半年，肝功能异常',
    startWeight: 68.5, curWeight: 67.9, targetWeight: 67.0,
    start:'2026-11-11', end:'2026-11-24', days:14,
    status:'running', statusText:'进行中', tier:'T1', deposit:200,
    checkedDays:5, totalDays:14, streak:5, breaks:0,
    witnesses:[WITNESSES[2]], supervisorCount:12, node:'daily', history:[], msgs:[], quote:'',
    nodes:[
      { name:'起始称重', date:'2026-11-11', state:'done', note:'已验证 · 68.5kg'},
      { name:'中期称重', date:'2026-11-17', state:'future'},
      { name:'结束称重', date:'2026-11-24', state:'future'},
    ],
  },
  f_9: {
    id:'f_9', mine:false,
    user:{name:'苏晴', avatar:'苏', color:'#A85C7A'},
    title:'90 天备孕，把体脂压到 22%',
    reason:'医生说先把体重降下来',
    startWeight: 63.2, curWeight: 60.4, targetWeight: 57.0,
    start:'2026-10-03', end:'2026-12-31', days:90,
    status:'running', statusText:'进行中', tier:'T3', deposit:1000,
    checkedDays:44, totalDays:90, streak:31, breaks:0,
    witnesses:[WITNESSES[0],WITNESSES[1],WITNESSES[2],WITNESSES[3],WITNESSES[4]],
    supervisorCount:247, node:'daily', history:[], msgs:[], quote:'',
    nodes:[
      { name:'起始称重', date:'2026-10-03', state:'done', note:'已验证 · 63.2kg'},
      { name:'中期称重', date:'2026-11-01', state:'done', note:'已验证 · 60.9kg'},
      { name:'结束称重', date:'2026-12-31', state:'future'},
    ],
  },
  f_10: {
    id:'f_10', mine:false,
    user:{name:'赵岩', avatar:'赵', color:'#7A5230'},
    title:'30 天戒掉游戏时间，重新跑起来',
    reason:'体检有三项指标飘红',
    startWeight: 82.0, curWeight: 79.6, targetWeight: 77.0,
    start:'2026-10-19', end:'2026-11-17', days:30,
    status:'ending', statusText:'即将结算', tier:'T2', deposit:500,
    checkedDays:28, totalDays:30, streak:28, breaks:0,
    witnesses:[WITNESSES[1],WITNESSES[3]], supervisorCount:67, node:'ending',
    history:[], msgs:[], quote:'',
    nodes:[
      { name:'起始称重', date:'2026-10-19', state:'done', note:'已验证 · 82.0kg'},
      { name:'中期称重', date:'2026-10-28', state:'done', note:'已验证 · 80.4kg'},
      { name:'结束称重', date:'2026-11-17', state:'future'},
    ],
  },
  f_11: {
    id:'f_11', mine:false,
    user:{name:'吴迪', avatar:'吴', color:'#2F6B6B'},
    title:'14 天不点外卖，自己做饭',
    reason:'想省下每天 30 块',
    startWeight: 71.5, curWeight: 70.8, targetWeight: 69.5,
    start:'2026-11-11', end:'2026-11-24', days:14,
    status:'running', statusText:'进行中', tier:'T0', deposit:200,
    checkedDays:4, totalDays:14, streak:0, breaks:1,
    witnesses:[], supervisorCount:9, node:'daily',
    history:[{d:1,w:71.5,ok:true,note:'起始称重'},{d:2,w:71.2,ok:true},{d:3,w:71.0,ok:true},{d:4,w:null,ok:false,note:'断卡'}],
    msgs:[], quote:'',
    nodes:[
      { name:'起始称重', date:'2026-11-11', state:'done', note:'已验证 · 71.5kg'},
      { name:'中期称重', date:'2026-11-17', state:'future'},
      { name:'结束称重', date:'2026-11-24', state:'future'},
    ],
  },
  f_12: {
    id:'f_12', mine:false,
    user:{name:'何瑜', avatar:'何', color:'#8C6A3F'},
    title:'30 天把引体向上从 0 拉到 5 个',
    reason:'想做力量训练但从没坚持过',
    startWeight: 59.8, curWeight: 59.2, targetWeight: 58.5,
    start:'2026-10-31', end:'2026-11-29', days:30,
    status:'running', statusText:'进行中', tier:'T2', deposit:500,
    checkedDays:16, totalDays:30, streak:4, breaks:0,
    witnesses:[WITNESSES[0],WITNESSES[2],WITNESSES[4]], supervisorCount:54,
    node:'daily', history:[], msgs:[], quote:'',
    nodes:[
      { name:'起始称重', date:'2026-10-31', state:'done', note:'已验证 · 59.8kg'},
      { name:'中期称重', date:'2026-11-09', state:'done', note:'已验证'},
      { name:'结束称重', date:'2026-11-29', state:'future'},
    ],
  },
  f_13: {
    id:'f_13', mine:false,
    user:{name:'郑爽', avatar:'郑', color:'#4F6FA8'},
    title:'30 天不喝奶茶，一杯都不喝',
    reason:'一个月花掉 900 块',
    startWeight: 55.6, curWeight: 53.4, targetWeight: 52.5,
    start:'2026-10-18', end:'2026-11-16', days:30,
    status:'success', statusText:'已达标', tier:'T2', deposit:500,
    checkedDays:30, totalDays:30, streak:30, breaks:0,
    witnesses:[WITNESSES[1],WITNESSES[3]], supervisorCount:73,
    node:'done', history:[], msgs:[], quote:'30 天，一杯都没破戒。省下 900 块，减了 2.1 公斤。',
    nodes:[
      { name:'起始称重', date:'2026-10-18', state:'done', note:'已验证 · 55.6kg'},
      { name:'中期称重', date:'2026-10-27', state:'done', note:'已验证 · 54.3kg'},
      { name:'结束称重', date:'2026-11-16', state:'done', note:'已达标 · 53.4kg'},
    ],
  },
  f_14: {
    id:'f_14', mine:false,
    user:{name:'刘欢', avatar:'刘', color:'#8A5A5A'},
    title:'90 天产后恢复核心，先学会不疼',
    reason:'医生说要先练腹横肌',
    startWeight: 70.4, curWeight: 69.1, targetWeight: 67.0,
    start:'2026-10-09', end:'2027-01-06', days:90,
    status:'running', statusText:'进行中', tier:'T3', deposit:1000,
    checkedDays:38, totalDays:90, streak:14, breaks:0,
    witnesses:[WITNESSES[0],WITNESSES[1],WITNESSES[2],WITNESSES[3],WITNESSES[4]],
    supervisorCount:152, node:'daily', history:[], msgs:[], quote:'',
    nodes:[
      { name:'起始称重', date:'2026-10-09', state:'done', note:'已验证 · 70.4kg'},
      { name:'中期称重', date:'2026-11-07', state:'done', note:'已验证 · 69.5kg'},
      { name:'结束称重', date:'2027-01-06', state:'future'},
    ],
  },
  f_15: {
    id:'f_15', mine:false,
    user:{name:'孙浩', avatar:'孙', color:'#5F7A4A'},
    title:'14 天把每天步数从 2000 提到 10000',
    reason:'久坐太多，腰疼',
    startWeight: 79.5, curWeight: 78.4, targetWeight: 77.5,
    start:'2026-11-09', end:'2026-11-22', days:14,
    status:'running', statusText:'进行中', tier:'T1', deposit:200,
    checkedDays:7, totalDays:14, streak:7, breaks:0,
    witnesses:[WITNESSES[4]], supervisorCount:21, node:'daily', history:[], msgs:[], quote:'',
    nodes:[
      { name:'起始称重', date:'2026-11-09', state:'done', note:'已验证 · 79.5kg'},
      { name:'中期称重', date:'2026-11-15', state:'done', note:'已验证'},
      { name:'结束称重', date:'2026-11-22', state:'future'},
    ],
  },
  f_16: {
    id:'f_16', mine:false,
    user:{name:'钱朵', avatar:'钱', color:'#9A6B8A'},
    title:'30 天从 68 掉到 62，只做有氧',
    reason:'不想节食，怕掉肌肉',
    startWeight: 68.0, curWeight: 64.6, targetWeight: 62.0,
    start:'2026-11-01', end:'2026-11-30', days:30,
    status:'running', statusText:'进行中', tier:'T2', deposit:500,
    checkedDays:14, totalDays:30, streak:2, breaks:1,
    witnesses:[WITNESSES[2],WITNESSES[3]], supervisorCount:38,
    node:'daily', history:[], msgs:[], quote:'',
    nodes:[
      { name:'起始称重', date:'2026-11-01', state:'done', note:'已验证 · 68.0kg'},
      { name:'中期称重', date:'2026-11-10', state:'done', note:'已验证'},
      { name:'结束称重', date:'2026-11-30', state:'future'},
    ],
  },
  /* 7 天 = 新手入门档（见需求规格 23.2）：押金最低 30 元 · 无中期到账 */
  f_17: {
    id:'f_17', mine:false,
    user:{name:'林一', avatar:'林', color:'#4F7A6B'},
    title:'7 天把每天的步数走到一万',
    reason:'先试试这个平台靠不靠谱',
    startWeight: 71.0, curWeight: 70.2, targetWeight: 70.0,
    start:'2026-11-12', end:'2026-11-18', days:7,
    status:'running', statusText:'进行中', tier:'T0', deposit:100,
    checkedDays:4, totalDays:7, streak:4, breaks:0,
    witnesses:[], supervisorCount:11,
    node:'daily', history:[], msgs:[], quote:'',
    nodes:[
      { name:'起始称重', date:'2026-11-12', state:'done', note:'已验证 · 71.0kg'},
      { name:'结束称重', date:'2026-11-18', state:'future'},
    ],
  },
});

/* ---------- 正在招募见证席的 Flag（⚠️ 2026-11-24 新增 / 同日修正） ----------
   ⚠️ 用户口径（本轮修正）：「既然是招募中，说明还没开始，为什么会有打卡记录呢？
      按理说招募中就是一个简单的横条，是否申请参加就行了。」
   —— 所以这四个局的状态必须是【筹备中】而不是【进行中】：
      筹备中 = 还没开跑 = 没打卡 = 打卡天数 0 = 体重还没开始称。
   —— 原来它们标着 status:'running' + checkedDays:1~5 + 已验证的节点，
      广场卡片上就出现「1/14 天」「已打卡 1 天」—— 跟「还在招人」自相矛盾。

   ⚠️ 用户口径（本轮再修正）：「见证席面板里面，正在招募见证席不合理的，
      如果其他用户点击你，希望你能做他的见证，把这个消息放到通知-判定邀请里就行了。」
   —— 所以【见证席面板】不再放这个列表；广场的「招募中」视图是唯一的发现入口，
      而「收到邀请」走通知的「判定·邀请」栏。

   ⚠️ 「还剩 6 小时」这类静态文字改成【真实截止时刻】——
      倒计时必须有「到什么时候为止」的时间点才能走。
      四个局各给一个不同的时长（6 / 12 / 3 / 18 小时），
      这样列表里的倒计时各不相同，一眼能看出是在走的。 */
/* ⚠️ 关键：上面不能直接用 Object.assign 覆盖 —— 那会把 f_2 / f_8 / f_11 / f_17
   整个 Flag 对象换成一个只剩 recruiting 的空壳（标题、体重、节点全没了）。
   所以这里是【就地改字段】，不替换对象。 */
['f_2', 'f_8', 'f_11', 'f_17'].forEach((id, i) => {
  const hours = [6, 12, 3, 18][i];
  const f = FLAGS[id];
  if (!f) return;
  f.recruiting = true;
  /* 招募截止时刻（真实时钟）—— 倒计时从这里往回数 */
  f.recruitEndAt = Date.now() + hours * 3600 * 1000;
  /* ⚠️ 状态改成【筹备中】：还没开跑，所以没有打卡记录 */
  f.status = 'prep';
  f.statusText = '筹备中';
  f.checkedDays = 0;
  f.streak = 0;
  f.breaks = 0;
  /* 当前体重 = 起始体重（还没开始称） */
  f.curWeight = f.startWeight;
  /* 打卡历史清空 */
  f.history = [];
  /* 节点全部「未到」 */
  f.nodes = (f.nodes || []).map(n => ({ name: n.name, date: n.date, state: 'future', note: '' }));
});

/* ---------- 招募中各局的【报名者】名单（见需求规格 R2.24）----------
   ⚠️ 为什么需要它：用户口径：「点击进入以后，我建议是招募的情况，
      单独新设计一个页面，让用户知道目前招募的状态……」
   —— 招募详情页要展示「已经报名的人」—— 用户需要知道
      【跟他一起当见证席的都是什么人】，这直接影响他参不参加。
   —— 原来报名者只存在「见证席召集令」那侧（发起人自己那一头的功能），
      按局存一份才能让每个局有自己的名单。 */
const RECRUIT_APPLICANTS_SEED = {
  f_2: [
    { id:'a1', name:'苏晴',   avatar:'苏', color:'#A85C7A', credit:90, rate:94, flagsWitnessed:12, status:'accepted' },
    { id:'a2', name:'阿凯',   avatar:'凯', color:'#4A6B52', credit:82, rate:86, flagsWitnessed:6,  status:'applied' },
    { id:'a3', name:'老周',   avatar:'周', color:'#6B7B8C', credit:74, rate:79, flagsWitnessed:4,  status:'applied' },
  ],
  f_8: [
    { id:'a1', name:'何瑜',   avatar:'何', color:'#8C6A3F', credit:86, rate:91, flagsWitnessed:9,  status:'applied' },
    { id:'a2', name:'钱朵',   avatar:'朵', color:'#7A5230', credit:78, rate:83, flagsWitnessed:5,  status:'applied' },
  ],
  f_11: [
    { id:'a1', name:'果果',   avatar:'果', color:'#9B3A2E', credit:81, rate:88, flagsWitnessed:6,  status:'applied' },
    { id:'a2', name:'孙浩',   avatar:'浩', color:'#2F6B6B', credit:76, rate:85, flagsWitnessed:5,  status:'accepted' },
  ],
  f_17: [
    { id:'a1', name:'阿May',  avatar:'M',  color:'#5B7C99', credit:76, rate:85, flagsWitnessed:5,  status:'accepted' },
  ],
};
Object.keys(RECRUIT_APPLICANTS_SEED).forEach(id => {
  if (FLAGS[id]) FLAGS[id].recruitApplicants = RECRUIT_APPLICANTS_SEED[id];
});
/* 按周期展开节点（见需求规格 R5.4）
   ⚠️ 30/90 天档的「中期复核」是自动补出来的（第 20 天 / 第 60 天），
      手写的 nodes 只覆盖 起始 / 中期 / 结束 三条 */
Object.keys(FLAGS).forEach(id => {
  const f = FLAGS[id];
  if (f && f.days && f.start) f.nodes = expandNodes(f);
});

/* ---------- 补充照片（生活照）种子 ----------
   ⚠️ 口径（见需求规格 R2.6）：
     - 打卡照是【物证】，生活照是【内容】—— 两者不是一回事
     - 第 1 张生活照 = 该 Flag 的【封面图】= 广场大图模式的主体
     - 用户没上传时，extraPhotosOf() 会按 checkedDays 稳定生成 1–3 张占位
   这里给几个 Flag 显式种上「用户真的上传过」的形态，让广场有变化。

   ⚠️⚠️ 必须逐个合并，不能用 Object.assign(FLAGS, {...}) ——
      那会把整个 Flag 对象覆盖掉（只剩 extraPhotos），user/title 全没了。 */
const EXTRA_PHOTO_SEEDS = {
  f_own: [
    { src: 'assets/life/lf01.jpg', day: 68, slot: 0 },
    { src: 'assets/life/lf05.jpg', day: 66, slot: 1 },
    { src: 'assets/life/lf10.jpg', day: 64, slot: 2 },
  ],
  f_3: [
    { src: 'assets/life/lf02.jpg', day: 52, slot: 0 },
    { src: 'assets/life/lf07.jpg', day: 49, slot: 1 },
  ],
  f_7: [
    { src: 'assets/life/lf06.jpg', day: 17, slot: 0 },
    { src: 'assets/life/lf09.jpg', day: 15, slot: 1 },
    { src: 'assets/life/lf11.jpg', day: 13, slot: 2 },
  ],
  f_9: [
    { src: 'assets/life/lf03.jpg', day: 44, slot: 0 },
  ],
  f_13: [
    { src: 'assets/life/lf08.jpg', day: 30, slot: 0 },
    { src: 'assets/life/lf12.jpg', day: 22, slot: 1 },
  ],
  /* 饮食类 */
  f_1: [
    { src: 'assets/life/lf04.jpg', day: 19, slot: 0 },
    { src: 'assets/life/lf03.jpg', day: 16, slot: 1 },
  ],
  f_5: [
    { src: 'assets/life/lf01.jpg', day: 27, slot: 0 },
  ],
  f_11: [
    { src: 'assets/life/lf02.jpg', day: 4, slot: 0 },
  ],
  /* 运动类 */
  f_10: [
    { src: 'assets/life/lf07.jpg', day: 28, slot: 0 },
    { src: 'assets/life/lf09.jpg', day: 25, slot: 1 },
  ],
  f_12: [
    { src: 'assets/life/lf06.jpg', day: 16, slot: 0 },
  ],
  f_15: [
    { src: 'assets/life/lf09.jpg', day: 7, slot: 0 },
    { src: 'assets/life/lf07.jpg', day: 5, slot: 1 },
  ],
  /* 穿搭 / 个人类 */
  f_14: [
    { src: 'assets/life/lf11.jpg', day: 38, slot: 0 },
    { src: 'assets/life/lf10.jpg', day: 33, slot: 1 },
  ],
  f_16: [
    { src: 'assets/life/lf12.jpg', day: 14, slot: 0 },
    { src: 'assets/life/lf08.jpg', day: 11, slot: 1 },
  ],
  f_4: [
    { src: 'assets/life/lf05.jpg', day: 29, slot: 0 },
  ],
  f_6: [
    { src: 'assets/life/lf04.jpg', day: 6, slot: 0 },
  ],
  f_8: [
    { src: 'assets/life/lf10.jpg', day: 5, slot: 0 },
  ],
  f_17: [
    { src: 'assets/life/lf11.jpg', day: 4, slot: 0 },
  ],
};
Object.keys(EXTRA_PHOTO_SEEDS).forEach(id => {
  if (FLAGS[id]) FLAGS[id].extraPhotos = EXTRA_PHOTO_SEEDS[id];
});

/* ---------- 打卡历史（我的） ---------- */
const CHECKIN_LOG = [
  { d:1,  date:'08-20', w:68.4, state:'done', node:'起始称重', ai:'完整审核通过', photo:true },
  { d:2,  date:'08-21', w:68.1, state:'done', ai:'查重通过' },
  { d:3,  date:'08-22', w:67.9, state:'done', ai:'查重通过' },
  { d:4,  date:'08-23', w:67.5, state:'done', ai:'查重通过' },
  { d:5,  date:'08-24', w:null, state:'miss', ai:'未打卡' },
  { d:6,  date:'08-25', w:67.2, state:'done', ai:'查重通过' },
  { d:7,  date:'08-26', w:66.8, state:'done', ai:'查重通过' },
  { d:8,  date:'08-27', w:66.5, state:'done', ai:'查重通过' },
  { d:9,  date:'08-28', w:66.1, state:'done', ai:'查重通过' },
  { d:10, date:'08-29', w:65.8, state:'done', ai:'查重通过' },
  { d:12, date:'08-31', w:65.4, state:'done', ai:'查重通过' },
  { d:13, date:'09-01', w:65.1, state:'done', ai:'查重通过' },
  { d:14, date:'09-02', w:64.9, state:'done', ai:'查重通过' },
  { d:35, date:'09-23', w:64.9, state:'done', node:'中期称重', ai:'完整审核通过' },
  { d:36, date:'09-24', w:64.6, state:'done', ai:'查重通过' },
  { d:37, date:'09-25', w:64.4, state:'done', ai:'查重通过' },
  { d:38, date:'09-26', w:64.2, state:'done', ai:'查重通过' },
];

/* ---------- 见证席判定任务（我作为见证席） ----------
   ⚠️ 2026-11-23 用户口径（改）：「见证席面板……作为见证席应该能看到用户的完整 FLAG 的，
      并且清晰知道自己的判定在那个阶段。」
   —— 所以任务多了两个字段：
      · nodeDay   这个节点是周期的第几天（用来定位「我的判定在第几步」）
      · myVerdict 我在这个节点上的判定（null = 还没判；'pass'/'doubt'/'cheat' = 已判）
      面板按 flagId 把任务分组，一个 Flag 一张卡，节点条上标出哪几步我已经判过。 */
const MY_VERDICT_TASKS = [
  {
    id:'vt1', flagId:'f_1', nodeName:'中期复核', nodeDay:20, flagUser:'阿May', color:'#8A6D1F',
    title:'30 天从 58.2 降到 55，赌一顿火锅',
    weight:'58.2kg → 56.1kg', nodeWeight:'56.0kg',
    deadline:'还剩 44 小时', quorumNeed:2, judged:2, total:4,
    deadlineTs:'2026-11-18T20:00:00',
    evidence:['体重秤读数','手写随机词：白芷'],
    myVerdict:null,
  },
  {
    id:'vt2', flagId:'f_6', nodeName:'中期称重', nodeDay:7, flagUser:'阿凯', color:'#4A6B52',
    title:'14 天戒糖，等着看体重秤',
    weight:'65.0kg → 65.0kg', nodeWeight:'64.6kg',
    deadline:'还剩 6 小时', quorumNeed:2, judged:1, total:2,
    deadlineTs:'2026-11-17T06:00:00',
    evidence:['体重秤读数','手写随机词：青柑'],
    myVerdict:null,
  },
  {
    /* ⚠️ 同一个 Flag 的上一个节点 —— 我已经判过了。
       面板要能看出「我已经走到第几步」（见需求规格 R5.2.1）。
       ⚠️ 2026-11-24（本轮）：补上 verdictAt ——
          通知里那条「XX 的中期称重已判定」显示的是这个时间，
          没有它就会回退成「刚刚」—— 一条几周前的判定显示「刚刚」是错的。 */
    id:'vt3', flagId:'f_1', nodeName:'中期称重', nodeDay:10, flagUser:'阿May', color:'#8A6D1F',
    title:'30 天从 58.2 降到 55，赌一顿火锅',
    weight:'58.2kg → 56.1kg', nodeWeight:'56.4kg',
    deadline:'已判定', quorumNeed:2, judged:3, total:4,
    deadlineTs:'2026-11-06T12:00:00',
    evidence:['体重秤读数','手写随机词：青柑'],
    myVerdict:'pass',
    verdictAt:'11-06 12:00',
  },
];

/* ---------- 异议理由清单（见需求规格 R4.3） ----------
   ⚠️ 2026-11-24（本轮）：提出异议页的这几项原来直接写死在模板里，
      而且开关只是纯装饰（点了不记录选了哪几条）。
   —— 现在抽成数据 + data-obj-reason，提交时一起带走。

   ⚠️ 用户口径：「只能选证据相关的理由 —— 不能对「进度」提异议」——
      所以下面这几条**全部是关于物证的**，没有一条是关于进度的。
      理由本身也要能直接呈现在通知 / 进度条里（reason 字段），所以要短。 */
const OBJECTION_REASONS = [
  { t:'体重秤读数被修改', d:'换秤 / 垫脚 / 遮挡数字' },
  { t:'照片与前几日不连续', d:'衣着 / 角度变化' },
  { t:'疑似他人代称', d:'体重与本人对不上' },
  { t:'修图伪造物证', d:'秤面读数被改过' },
  { t:'复用旧图', d:'今天的照片跟前几天是同一张' },
];

/* ---------- 见证席收益（分值见需求规格 8.1.3：每节点 +2 / +3 / -8 / -5） ---------- */
const WITNESS_EARNINGS = [
  { flag:'阿May 的 30 天', node:'中期称重', verdict:'作弊', pending:'人工复核中 · 预计 24 小时内', ts:'10-02 09:18' },
  { flag:'阿凯 的 14 天', node:'中期称重', verdict:'通过', pending:'AI 筛查中 · 预计 1 小时内', ts:'10-02 08:41' },
  { flag:'小美 的 90 天', node:'中期称重', verdict:'通过', delta:'+2', ts:'09-24 20:14', type:'good' },
  { flag:'阿May 的 30 天', node:'起始称重', verdict:'通过', delta:'+2', ts:'09-20 15:02', type:'good' },
  { flag:'大壮 的 14 天', node:'结束称重', verdict:'作弊', delta:'+3', ts:'09-16 09:31', type:'good' },
  { flag:'老周 的 30 天', node:'中期称重', verdict:'通过', delta:'+2', ts:'09-11 21:08', type:'good' },
  { flag:'果果 的 30 天', node:'结束称重', verdict:'通过', delta:'+2', ts:'09-05 19:44', type:'good' },
  { flag:'小美 的 90 天', node:'中期称重', verdict:'存疑', delta:'0', ts:'08-28 10:22', type:'good' },
  { flag:'阿凯 的 14 天', node:'结束称重', verdict:'作弊', delta:'-8', ts:'08-20 09:00', type:'bad' },
  { flag:'小美 的 90 天', node:'中期复核', verdict:'通过', delta:'+2', ts:'10-28 19:40', type:'good' },
];

/* ---------- 信用分明细 ---------- */
const CREDIT_LOGS = [
  { t:'见证席有效判定', d:'见证「阿May 的 30 天」', v:2, ts:'09-24' },
  { t:'连续打卡里程碑', d:'连续打卡满 7 天', v:1, ts:'09-24' },
  { t:'目标成功', d:'「30 天减 5 公斤」达成', v:15, ts:'07-18' },
  { t:'见证席有效判定', d:'见证「大壮 的 14 天」', v:2, ts:'06-20' },
  { t:'目标失败', d:'「21 天跑步」未达标', v:-10, ts:'05-09' },
  { t:'见证席有效判定', d:'见证「老周 的 30 天」', v:2, ts:'04-16' },
  { t:'目标成功', d:'「14 天断糖」达成', v:10, ts:'03-28' },
];

/* ---------- 通知 ---------- */
const NOTIFS = [
  { id:'n1', icon:'alert', title:'你的 Flag 断了', body:'今天没打卡，连续天数已归零', ts:'2 小时前', unread:true, type:'warn' },
  { id:'n2', icon:'eyeOpen', title:'阿May 的 Flag 断卡了', body:'「老王的 Flag 断了，今天没打卡」', ts:'3 小时前', unread:true, type:'info' },
  { id:'n3', icon:'checkCircle', title:'小美 的中期称重待你判定', body:'还剩 31 小时 · 需要你点一下', ts:'5 小时前', unread:true, type:'good' },
  { id:'n4', icon:'sparkle', title:'果果 的 30 天结算了', body:'未达标，但坚持了 27 天 —— 记录卡已生成', ts:'昨天', unread:false, type:'info' },
  { id:'n5', icon:'message', title:'小李 给你留了言', body:'「别急，节奏挺稳的，继续」', ts:'昨天', unread:false, type:'info' },
  { id:'n6', icon:'trend', title:'你的连续打卡里程碑', d:'已连续打卡 12 天，信用分 +1', body:'', ts:'2 天前', unread:false, type:'good' },
];

/* ---------- 订阅的 Flag ---------- */
const SUBSCRIBED = ['f_1','f_3','f_4','f_5'];

/* ---------- 工具函数 ---------- */
/* ⚠️ 2026-11-24：加个空值兜底 —— 以前 flag 一旦传 null 就整个页面崩掉
   （Cannot read properties of null）。找不到就退回 T0，不让一页跟着挂。 */
function flagTier(flag){ return (flag && TIER_META[flag.tier]) || TIER_META.T0; }

/**
 * 信用分 → 等级对象
 * ⚠️ 2026-11-25（本轮修复）：越界兜底的方向原来反了 ——
 *    原来返回 `CREDIT_TIERS[CREDIT_TIERS.length-1]`（最高档「卓越」）。
 *    结果 creditTierOf(44) / (0) / (-10) 全返回卓越 —— 押金上限 5000、费率 20%。
 *    低于下限应该落到**最低档「受限」**（200 元、40%），绝不能给最高权限。
 *    这条是资损级的：低信用用户一旦被算出卓越，就能押 5000 而只扣 20%。
 *    正常流程进不到这里（applyCredit 已做 [45,100] 钳制），
 *    但 STATE.credit 在 state.js 有多处直接赋值，漏一处钳制就会踩到。
 */
function creditTierOf(score){
  const s = Number(score);
  if (!Number.isFinite(s)) return CREDIT_TIERS[0];      // 非法值 → 最低档
  for (const t of CREDIT_TIERS) if (s >= t.min && s <= t.max) return t;
  // 越界：**向下**落到最低档（分数太低）/ **向上**落到最高档（分数超出上限）
  return s < CREDIT_TIERS[0].min ? CREDIT_TIERS[0] : CREDIT_TIERS[CREDIT_TIERS.length - 1];
}

/** 下一等级的门槛分（已封顶则返回 100） */
function creditNextAt(score){
  for (const t of CREDIT_TIERS) if (score < t.min) return t.min;
  return CREDIT_BASE.max;
}

/** 押金可选区间（见需求规格 R10.2）
 *  可选区间 = [ 周期下限 , min(信用上限, 周期上限) ]
 *  可立周期 = 周期下限 < 信用上限
 *  返回 { allowed, min, max, options, tiers, rate, creditCap }
 *  options = 当前可点的档位（受信用上限裁剪）
 *  tiers   = 该周期固定 4 档全量（超信用上限的标记 locked:true，灰、不可点）
 *  allowed=false 时该周期不可发起（区间为空）
 *
 *  ⚠️ 2026-11-22 用户口径（改）：0 元档不再是「任何周期都有、永远可选」的常驻档，
 *     收回成【首次免费】—— 只有【第一个 Flag】才能选，且只覆盖 7 / 14 天。
 *     参数 firstFree 由调用方传入（= 现在是不是用户的第一个 Flag）。
 *     ⚠️ 首次免费**照常产生分值**（跟 R10.4 一致：14 天免费一局 +10 分跨过 70 门槛），
 *        所以它跟「体验档 · 不加分」是两回事，hasZero 只表示「押金为 0」。 */
function depositRange(credit, days, firstFree){
  const ct = creditTierOf(credit);
  const fr = FLAG_DEP_RANGE[days];
  const creditCap = ct.depCap || 0;
  /* ⚠️ 首次免费只覆盖 7 / 14 天 —— 30 / 90 天即使是第一个 Flag 也按下限缴（见 R10.4 边界） */
  const zeroAllowed = !!firstFree && FIRST_FREE_PERIODS.includes(Number(days));
  if (!fr){
    /* 周期档位不存在 —— 区间为空，什么都不可选（0 元档也不在此时出现） */
    return { allowed:false, min:0, max:0, options:[], tiers:[], rate:ct.rate, creditCap, hasZero:false };
  }
  const min = fr.min;
  const max = Math.min(creditCap, fr.max);
  const allowed = min < max;
  const all = depTiersFor(days);
  const tiers = allowed
    ? all.map(v => ({ value:v, locked: v > max }))
    : all.map(v => ({ value:v, locked:true }));
  /* ⚠️ 0 元档排在最前，但【只在首次免费时出现】—— 它是新人礼，不是常驻档位 */
  const zeroTier = { value: DEP_ZERO, locked: false, zero: true, firstFree: true };
  const allTiers = zeroAllowed ? [zeroTier].concat(tiers) : tiers;
  const options = (zeroAllowed ? [DEP_ZERO] : [])
    .concat(allowed ? tiers.filter(t => !t.locked).map(t => t.value) : []);
  return { allowed, min, max, options, tiers: allTiers, rate: ct.rate, creditCap, hasZero: zeroAllowed };
}

/** 该信用等级可立的周期列表（由公式推导，见 R10.2）
 *  ⚠️ 这里【不看首次免费】—— 首次免费是押金档位上的优惠，不是周期权限。
 *     周期能不能立，只看「周期下限 < 信用上限」。 */
function allowedPeriods(credit){
  return Object.keys(FLAG_DEP_RANGE)
    .map(Number)
    .filter(d => depositRange(credit, d).allowed)
    .sort((a,b) => a - b);
}

function creditMulOf(tierKey){ return (TIER_META[tierKey]||TIER_META.T0).creditMul; }

/* ---------- 信用分计算（见需求规格 8.1） ---------- */

/** 信用分加减（自动封顶 100、下限 45；超出 100 的部分不计入任何系统） */
function applyCredit(score, delta){
  const raw = score + delta;
  const value = Math.max(CREDIT_BASE.min, Math.min(CREDIT_BASE.max, raw));
  const overflow = Math.max(0, raw - CREDIT_BASE.max);
  return { value, overflow };
}

/** 自己的 Flag 成功加分（分段到账）：返回每笔 {day, value}（已乘强度系数） */
function creditEarnSchedule(days, tierKey){
  const cfg = CREDIT_FLAG[days];
  if (!cfg) return [];
  const mul = creditMulOf(tierKey);
  const out = [];
  cfg.mid.forEach(([day, v]) => out.push({ day, value: Math.round(v * mul), stage: 'mid' }));
  out.push({ day: days, value: Math.round(cfg.end * mul), stage: 'end' });
  return out;
}

/** 自己的 Flag 失败扣分（已乘强度系数；所有基础分都是 5 的倍数 → 结果必为整数） */
function creditFailPenalty(days, tierKey){
  const cfg = CREDIT_FLAG[days];
  if (!cfg) return 0;
  return Math.round(cfg.fail * creditMulOf(tierKey));
}

/**
 * 这个 Flag 是不是「押金为 0」的局（= 首次免费，见需求规格 R10.4）
 * ⚠️ 2026-11-22 用户口径（改）：0 元档已从「常驻体验档」收回成【首次免费】——
 *    只有第一个 Flag 能用，且**照常产生全部分值**（14 天免费一局 +10 分，直接跨过 70 门槛）。
 *    所以它跟以前那个「体验档 · 不加分」完全相反，这里只做【显示用】的判断。
 *
 * 判定依据用【押金原值】而不是 f.deposit —— 因为押金在结算后会被清零
 * （失败 / 取消后 f.deposit = 0），所以要额外留一个 zeroDeposit 标记。
 */
function isZeroDepositFlag(flag){
  if (!flag) return false;
  if (typeof flag.zeroDeposit === 'boolean') return flag.zeroDeposit;
  return depositPaidOf(flag) === 0;
}

/**
 * 这个 Flag **当时押了多少钱** —— 详情页 / 首页要显示的是原始押金，
 * 而不是结算后被清零的 f.deposit。
 */
function depositPaidOf(flag){
  if (!flag) return 0;
  if (typeof flag.depositPaid === 'number') return flag.depositPaid;
  return flag.deposit || 0;
}

/**
 * 按「该笔到账时的有效档位」算分（见需求规格 R1.2.1 / R8.4）
 * ⚠️ 中期到账用中期时点的有效档位，结束结算用结束时的有效档位。
 *    「按当时」实际上只有起始节点可用（中期到账时点前只关闭了起始称重节点），
 *    所以这里统一用 flag 的 effectiveTier —— 若中途降过档，min 已经体现。
 * @param {object} flag
 */
function creditEarnScheduleFor(flag){
  /* ⚠️ 首次免费（押金 0 元）**照常产生分值** —— 它是新人礼，不是「不加分」的体验档 */
  const tierKey = (flag && (flag.effectiveTier || flag.tier)) || 'T0';
  return creditEarnSchedule(flag.days || flag.totalDays, tierKey);
}

/** 按有效档位算失败扣分（见 R1.2.1 / R8.4） */
function creditFailPenaltyFor(flag){
  const tierKey = (flag && (flag.effectiveTier || flag.tier)) || 'T0';
  return creditFailPenalty(flag.days || flag.totalDays, tierKey);
}

/** 见证席单次节点判定分值 */
function creditWitnessValue(kind){
  const w = CREDIT_WITNESS;
  return kind === 'pass' ? w.pass
       : kind === 'cheat' ? w.cheat
       : kind === 'misreport' ? w.misreport
       : w.miss;
}

/** 失败实际损失 */
function failureLoss(deposit, credit){
  const ct = creditTierOf(credit);
  return Math.round(deposit * ct.rate / 100);
}

/* =========================================================
   打卡照片（见需求规格 R2.5「打卡照片公开」）
   ⚠️ 口径：
     - 照片只在【平台内】公开（广场 / 详情页 / 日历条），不进分享图与站外
     - 不打码 —— 体重读数、背景都原样可见
     - 断卡那天没有照片（那天没打卡）→ 日历条上是一个【空格子】，不是灰图
     - 补卡那天有照片，角标标「补」
   ========================================================= */
const CK_PHOTO_POOL = [
  'ck01','ck02','ck03','ck04','ck05','ck06',
  'ck07','ck08','ck09','ck10','ck11','ck12',
];

/* =========================================================
   生活照 / 封面照（见需求规格 R2.6「打卡之外的补充照片」）
   ⚠️ 口径：
     - 打卡照（秤读数 + 手写随机词）是【物证】，不能删 —— 它证明"你今天称了"
     - 生活照是【内容】—— 饮食 / 运动 / 穿搭 / 个人照
     - 用户可额外上传最多 3 张，【第 1 张即封面图】
     - 没上传生活照时，封面回退到打卡照（再没有就回退到目标文字卡）
   ========================================================= */
const LIFE_PHOTO_POOL = [
  'lf01','lf02','lf03','lf04','lf05','lf06',
  'lf07','lf08','lf09','lf10','lf11','lf12',
];

/** 额外上传照片的上限（见需求规格 R2.6） */
const MAX_EXTRA_PHOTOS = 3;

/** 按 day 序号稳定地取一张素材（同一天永远同一张，避免每次渲染跳动） */
function photoFor(day, offset){
  const i = ((day || 1) - 1 + (offset || 0)) % CK_PHOTO_POOL.length;
  return 'assets/checkin/' + CK_PHOTO_POOL[(i + CK_PHOTO_POOL.length) % CK_PHOTO_POOL.length] + '.jpg';
}

/**
 * 某个 Flag 的打卡照片序列（按天）
 * ⚠️ 没有 photos 种子数据时，按 checkedDays 反推生成 —— 让每个 Flag 都有照片，
 *    状态与 history 对齐（history 里的断卡日不出照片）。
 * @returns {Array<{d:number, st:'done'|'miss'|'makeup', src:string, w:number|null}>}
 */
function photosOf(f){
  if (!f) return [];
  if (f.photos) return f.photos;
  const total = f.totalDays || f.days || 30;
  const checked = f.checkedDays || 0;
  const hist = {};
  (f.history || []).forEach(h => {
    if (h && h.d) hist[h.d] = h.makeup ? 'makeup' : (h.ok === false ? 'miss' : 'done');
  });
  const out = [];
  const offset = (f.id || '').charCodeAt(f.id.length - 1) % CK_PHOTO_POOL.length;
  for (let d = 1; d <= total; d++){
    let st = d <= checked ? 'done' : 'future';
    if (hist[d]) st = hist[d];
    if (st === 'future') continue;              // 未来的天不出照片
    /* ⚠️ 断卡那天没有照片 —— 那天根本没打卡。
       错在这里会变成「断卡格里塞一张别的天的照片」——
       那是伪造证据，比空格子严重得多。 */
    out.push({ d, st, src: st === 'miss' ? null : photoFor(d, offset), w: null });
  }
  /* 把「今天的心情 / 体悟」种上去（见需求规格 R2.11）
     ⚠️ 只种在【最近一次打卡的那天】—— 详情页顶部只展示今天的。 */
  const seed = NOTE_SEEDS[f.id];
  if (seed) {
    const day = out.length ? out[out.length - 1].d : 0;
    const hit = out.find(p => p.d === day);
    if (hit && seed[day]) hit.note = seed[day];
  }
  return out;
}

/**
 * 「今天的心情 / 体悟」种子（见需求规格 R2.11）
 * ⚠️ key = flagId，value = { 天数: 留言 }。挂在【最近一次打卡的那天】上。
 */
const NOTE_SEEDS = {
  f_3:    { 52: '今天终于不饿了' },
  f_own:  { 68: '差 3 斤就能穿上了' },
  f_7:    { 17: '今天偷懒了一天' },
  f_9:    { 44: '平台期，只能熬' },
  f_13:   { 30: '慢慢来比较快' },
};

/** 某一天的公开照片；断卡天返回 null（那天没照片） */
function photoOn(f, day){
  const list = photosOf(f);
  return list.find(p => p.d === day) || null;
}

/* =========================================================
   补充照片（生活照）—— 见需求规格 R2.6
   ⚠️ 与打卡照是两套东西，不要混：
     - 打卡照 = 物证（证明今天称过重）
     - 生活照 = 内容（给广场一点好看的东西）
   ========================================================= */

/** 按 flagId + 天数稳定地取一张生活照素材（同一天永远同一张） */
function lifePhotoFor(flagId, day, slot){
  const base = (flagId || 'x').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const i = (base + (day || 1) * 3 + (slot || 0) * 5) % LIFE_PHOTO_POOL.length;
  return 'assets/life/' + LIFE_PHOTO_POOL[(i + LIFE_PHOTO_POOL.length) % LIFE_PHOTO_POOL.length] + '.jpg';
}

/**
 * 某个 Flag 的补充照片（生活照）列表
 * ⚠️ 只有【用户真的上传过】才返回照片。
 *    没上传就返回空数组 —— 封面回退到打卡照（见 coverPhotoOf）。
 *    ⚠️ 这里绝不能"自动生成"占位图：那样就分不清
 *       「用户传了生活照」与「用户没传」，封面的来源口径就废了。
 * @returns {Array<{src:string, day:number, slot:number}>}
 */
function extraPhotosOf(f){
  if (!f) return [];
  if (f.extraPhotos && f.extraPhotos.length) return f.extraPhotos;
  return [];
}

/**
 * 「Ta 今天的照片」—— 围观者详情页顶部的缩略图行（见需求规格 R2.9）
 * ⚠️ 口径（用户 2026-11-21 明确要求）：
 *    「先略缩图展示用户今天的照片，1-4 张。一行展示完。」
 *   —— 指的是【这一局最近的照片】(1~4 张)，一行排完，不横滑。
 *
 *   取法：生活照优先（内容更好看），不够就用打卡照补齐；
 *   最多 4 张，按时间从新到旧。
 * @returns {Array<{src:string, kind:'life'|'checkin', day:number}>}
 */
function recentPhotosRow(f, n){
  n = Math.min(4, n || 4);
  const out = [];
  /* 打卡照（从新到旧） */
  const ck = photosOf(f).filter(p => p.src).slice().reverse();
  ck.forEach(p => out.push({ src: p.src, kind: 'checkin', day: p.d }));
  /* 生活照插在前面（内容更好看，优先给人看） */
  const ex = extraPhotosOf(f).slice().reverse();
  ex.forEach(x => out.unshift({ src: x.src, kind: 'life', day: x.day }));
  return out.slice(0, n);
}

/**
 * 「Ta 今天的照片」—— 只放【今天】拍的那几张
 * ⚠️ 口径（用户 2026-11-21 第二轮明确要求）：
 *    「只展示今天打卡+拍照的照片，其他日子的不需要展示。」
 *   —— 之前这里是「最近 4 张」（跨了好几天），标题写着「今天」却在放历史照片，
 *      口径是假的。现在严格按天取：今天的打卡照 + 今天补的生活照。
 * @param {object} f Flag
 * @returns {Array<{src:string, kind:'life'|'checkin', day:number}>}
 */
function todayPhotosRow(f){
  if (!f) return [];
  const day = latestDayOf(f);
  if (!day) return [];
  const out = [];
  /* 今天补的生活照（内容）—— 在前面，内容更好看，优先给人看 */
  extraPhotosOf(f).forEach(x => {
    if (x.day === day && x.src) out.push({ src: x.src, kind: 'life', day });
  });
  /* 今天的打卡照（物证） */
  const ck = photosOf(f).find(p => p.d === day && p.src);
  if (ck) out.push({ src: ck.src, kind: 'checkin', day });
  return out;
}

/**
 * 这个 Flag 的「今天」= 最近一次打卡的那一天
 * ⚠️ demo 里没有真实时钟推进，统一用 checkedDays 作为「今天」——
 *    断卡那天没有打卡照，那这天的照片行就是空的（符合预期）。
 */
function latestDayOf(f){
  if (!f) return 0;
  const checked = f.checkedDays || 0;
  const list = photosOf(f);
  const lastPhoto = list.length ? list[list.length - 1].d : 0;
  return Math.max(checked, lastPhoto);
}

/* ---------- 他人资料档案（⚠️ 2026-11-24 新增）----------
   「Ta 的主页」的资料卡要和「我的」页**同一套形式**（见需求规格 R2.20 ⑫）：
     左头像 + 右三行（名字 / ID号 / 性别·年龄·省份·加入亏了XX天）+ 三格社交数据。
   —— 所以每个用户都得有【ID号 / 年龄 / 性别 / 省份 / 加入时间】这些字段，
      否则别人的主页就没法用同一张卡渲染。
   ⚠️ 「加入亏了 XX 天」由 joinedAt 与 DEMO_TODAY 算出（daysBetween），
      跟「我的」页的 myDaysInApp() 同一个口径。
   followers = 有多少人关注他（demo 里用固定种子近似，保证不为 0）。 */
const USER_PROFILES = {
  '小美':  { userCode:'B3K7Q2', age:29, gender:'女', province:'广东', joinedAt:'2026-04-18', followers:52, bio:'医生说多囊需要先减重，那就先减。' },
  '阿May': { userCode:'K5R1D8', age:26, gender:'女', province:'江苏', joinedAt:'2026-06-02', followers:31, bio:'赌一顿火锅。' },
  '大壮':  { userCode:'M9T4H2', age:30, gender:'男', province:'山东', joinedAt:'2026-08-11', followers:18, bio:'被女朋友说胖了，这次要争口气。' },
  '老周':  { userCode:'P2X6L5', age:38, gender:'男', province:'四川', joinedAt:'2026-03-25', followers:24, bio:'去年买的西装又穿不上了。' },
  '果果':  { userCode:'Q7W3N9', age:24, gender:'女', province:'湖南', joinedAt:'2026-09-07', followers:41, bio:'连续熬夜一年了。' },
  '阿凯':  { userCode:'R4Y8C3', age:27, gender:'男', province:'北京', joinedAt:'2026-10-09', followers:12, bio:'想试试能不能打破平台期。' },
  '林一':  { userCode:'S8J2F6', age:33, gender:'男', province:'福建', joinedAt:'2026-02-14', followers:76, bio:'跑到能连续不喘。' },
  '陈默':  { userCode:'T3V7B1', age:31, gender:'男', province:'湖北', joinedAt:'2026-10-20', followers:9,  bio:'把作息调回来。' },
  '苏晴':  { userCode:'U6D4S8', age:29, gender:'女', province:'浙江', joinedAt:'2026-01-19', followers:63, bio:'先把体重降下来。' },
  '赵岩':  { userCode:'V1F9R5', age:35, gender:'男', province:'陕西', joinedAt:'2026-07-30', followers:27, bio:'有三项指标飘红。' },
  '吴迪':  { userCode:'W5A2P7', age:28, gender:'男', province:'江苏', joinedAt:'2026-09-28', followers:14, bio:'想省下每天 30 块。' },
  '何瑜':  { userCode:'X9G3T4', age:34, gender:'男', province:'江西', joinedAt:'2026-05-16', followers:36, bio:'从 0 拉到 5 个。' },
  '郑爽':  { userCode:'Y2H7M9', age:25, gender:'女', province:'上海', joinedAt:'2026-03-03', followers:58, bio:'一杯都不喝。' },
  '刘欢':  { userCode:'Z8C5K3', age:32, gender:'女', province:'河南', joinedAt:'2026-06-21', followers:44, bio:'先学会不疼。' },
  '孙浩':  { userCode:'A4L6N1', age:36, gender:'男', province:'天津', joinedAt:'2026-08-08', followers:21, bio:'腰疼，得走起来。' },
  '钱朵': { userCode:'B7Q3P8', age:27, gender:'女', province:'浙江', joinedAt:'2026-09-15', followers:33, bio:'只做有氧，怕掉肌肉。' },
  /* ⚠️ 2026-11-24（本轮）新增：见证席名单半屏里点头像可以进这个人主页 ——
     —— 见证席（小李 / 小美 / 老周 等）也是平台上的用户，
        他们出现在别人的见证席名单里，就必须也有自己的主页 ——
        否则「点头像进主页」会跳到一个「找不到这个人」的页面。
     —— 这三个人是 WITNESSES 里的常客（见 data.js 的 WITNESSES）。 */
  '小李':  { userCode:'C1D5N7', age:31, gender:'男', province:'北京', joinedAt:'2026-03-11', followers:45, bio:'我盯着呢。' },
  '老王':  { userCode:'D3E7P2', age:35, gender:'男', province:'山东', joinedAt:'2026-02-08', followers:28, bio:'说到做到。' },
};

/**
 * 某个用户的【长期档案】—— 他人主页用（见需求规格 R2.10）
 * ⚠️ 关键区分（用户 2026-11-21 明确提出）：
 *    「目标详情是这次打卡的记录，而用户的信息是用户长期的信息。」
 *   —— 目标详情页 = 【单局记录】；用户主页 = 【长期档案】：
 *      信用分、见证情况、历次 Flag、成就。
 * @param {string} name 用户名
 * @returns {object|null} { name, credit, creditTier, flags, running, done, broken,
 *                           witnessCount, witnessFlags, tier, tags }
 */
function userProfile(name){
  if (!name) return null;
  const flags = Object.keys(FLAGS)
    .map(id => FLAGS[id])
    .filter(f => f && f.user && f.user.name === name);
  /* ⚠️ 2026-11-24（本轮）：见证席名单半屏里可以点头像进这个人主页 ——
     —— 见证席（小李 等）**没有自己发起的局**，只有「他给别人当见证席」这层身份。
        原来这里 `if (!flags.length) return null;` 直接把他判成「找不到这个人」——
        点了头像跳到一个空页面，是死路。
     —— 所以：【见证席身份】也算一种存在 ——
        他当过见证席（WITNESSES / WITNESS_POOL 里有名）→ 就有主页，
        只是「Ta 的 Flag」那块是空的（他没自己立过 Flag）。 */
  const asWitness = WITNESSES.find(w => w.name === name)
                || WITNESS_POOL.find(w => w.name === name);
  if (!flags.length && !asWitness) return null;
  /* 信用分：demo 里按该用户跑过的局数稳定生成（真实环境来自服务端）
     —— 没有自己发起的局时（纯见证席），按见证记录数生成，保证不是同一个数。 */
  const seed = flags.length
    ? flags.reduce((a, f) => a + (f.totalDays || 30) + (f.checkedDays || 0), 0)
    : (asWitness.flagsWitnessed || 3) * 37 + 11;
  const credit = Math.max(45, Math.min(100, 60 + (seed % 41)));
  const creditTier = creditTierOf(credit);
  /* 见证情况：他当过见证席的局（demo 里用 WITNESS_POOL 里的记录表示） */
  const wp = WITNESS_POOL.find(w => w.name === name);
  const witnessFlags = wp ? (wp.flagsWitnessed || 0)
    : (asWitness && asWitness.flagsWitnessed ? asWitness.flagsWitnessed : 0);
  const witnessRate  = wp ? (wp.rate || 0)
    : (asWitness && asWitness.responseRate ? asWitness.responseRate : 0);
  const running = flags.filter(f => f.status === 'running' || f.status === 'ending');
  const done = flags.filter(f => f.status === 'success');
  const broken = flags.filter(f => f.status === 'failed' || f.status === 'broken');
  /* 最强档位 */
  const bestTier = flags.length
    ? flags.reduce((a, f) => Math.max(a, (TIER_META[f.tier] || TIER_META.T0).tier), 0)
    : 1;   /* 纯见证席：按 T1 起步（有见证记录，至少不是 T0） */
  /* ⚠️ 2026-11-24：资料卡改成与「我的」页同一套形式（见需求规格 R2.20 ⑫）——
     所以别人的档案也得有【ID号 / 年龄 / 性别 / 省份 / 加入时间】。
     没登记过的用户给一份兜底（ID号按名字生成，保证不空）。 */
  const prof = USER_PROFILES[name] || {};
  const daysInApp = prof.joinedAt ? Math.max(0, daysBetween(prof.joinedAt, DEMO_TODAY)) : 0;
  return {
    name,
    credit,
    creditTier,
    flags,
    running,
    done,
    broken,
    witnessFlags,
    witnessCount: witnessFlags,
    witnessRate,
    bestTier,
    /* 资料卡字段 */
    userCode: prof.userCode || ('U' + String(name.charCodeAt(0) % 90 + 10) + name.length + 'K'),
    age: prof.age || 0,
    gender: prof.gender || '保密',
    province: prof.province || '中国',
    joinedAt: prof.joinedAt || '',
    daysInApp,
    bio: prof.bio || '',
    followers: prof.followers || 0,
    isMe: name === ME.name,
  };
}

/**
 * 封面图选择（见需求规格 R2.6）
 * ⚠️ 优先级：第 1 张补充照片 > 最新打卡照 > 无（走 fallback 文字卡）
 *    —— 「上传的第一张就是首页图」是用户明确要的规则。
 * @returns {{src:string, kind:'life'|'checkin'}|null}
 */
function coverPhotoOf(f){
  if (!f) return null;
  const ex = extraPhotosOf(f);
  if (ex.length && ex[0].src) return { src: ex[0].src, kind: 'life' };
  const list = photosOf(f).filter(p => p.src);
  if (list.length) return { src: list[list.length - 1].src, kind: 'checkin' };
  return null;
}

/** 最近 N 天的照片条（广场卡片用 —— 只看最近，90 格没人会看）
 *  @param n 取最近几天（默认 8）
 *  @returns 数组，长度 = N（断卡天是 st:'miss' 的空格子占位） */
function recentPhotos(f, n){
  n = n || 8;
  const list = photosOf(f);
  const total = f.totalDays || f.days || 30;
  const checked = f.checkedDays || 0;
  const hist = {};
  (f.history || []).forEach(h => {
    if (h && h.d) hist[h.d] = h.makeup ? 'makeup' : (h.ok === false ? 'miss' : 'done');
  });
  const last = Math.max(checked, list.length ? list[list.length-1].d : 0);
  const startDay = Math.max(1, last - n + 1);
  const out = [];
  for (let d = startDay; d <= last; d++){
    const p = list.find(x => x.d === d);
    if (p) { out.push(p); continue; }
    // 没有照片的那天 —— 断卡（空格子）还是未来（半透明占位）
    const st = hist[d] === 'miss' ? 'miss' : (hist[d] === 'makeup' ? 'makeup' : 'future');
    out.push({ d, st, src: null, w: null });
  }
  return out;
}

/**
 * 某个打卡日的【见证席审核最终结果】
 * ⚠️ 2026-11-23 用户口径：「目标详情中的打卡日历，点进去以后，
 *    能看到见证席的审核情况，只需要最终结果就行，
 *    不用展开审核人数、多少人通过、多少人判定这种。」
 * —— 所以这里只返回【结论】，不返回人数/比例。
 * @param {object} f Flag
 * @param {number} day 第几天
 * @returns {null|{state:'pass'|'fail'|'pending'|'none', text:string, detail:string}}
 */
function dayVerdictOf(f, day){
  if (!f || !day) return null;
  /* 打卡日 → 该日对应的见证节点（起始 / 中期 / 中期复核 / 结束）。
     见证节点只在称重日，普通的打卡日没有见证审核 —— 返回 null 表示「无审核」。 */
  const nodes = f.nodes || [];
  const node = nodes.find(n => {
    const nd = Math.round((new Date(n.date) - new Date(f.start)) / 86400000) + 1;
    return nd === day;
  });
  if (!node) return null;
  const st = node.state;
  if (st === 'done') {
    /* 节点已完成 —— 结论看节点的备注（已验证 / 已达标 / 未达标） */
    if (/未达标/.test(node.note || '')) {
      return { state:'fail', text:'见证席判定：未达标', detail:'该节点的物证经见证席审核，未通过。' };
    }
    return { state:'pass', text:'见证席判定：通过', detail:'该节点的物证经见证席审核，通过。' };
  }
  if (st === 'fail') {
    return { state:'fail', text:'见证席判定：未达标', detail:'该节点的物证经见证席审核，未通过。' };
  }
  if (st === 'now') {
    return { state:'pending', text:'见证席审核中', detail:'该节点正在等待见证席提交判定。' };
  }
  return null;
}

function calCalendar(flag){
  const cells = [];
  const total = flag.totalDays || flag.days;
  const checked = flag.checkedDays;
  const start = new Date(flag.start);
  const today = new Date('2026-11-16');
  const firstDow = start.getDay();
  /* ⚠️ 2026-11-24 用户口径：「当一个 FLAG 结算后，点击这个结算的 FLAG，
       在它的目标详情页，打卡日历、进度应该都是完成了的。」
     —— 已结算的局，日历上【不再有「未来」的格子】：
        周期已经走完了，没打卡的那几天就是【没打卡】，不是「还没到」。
        留着半透明的「未来」格是在说一件假话（这一局早就结束了）。 */
  const settled = flag.status === 'success' || flag.status === 'failed' || flag.status === 'broken';
  // 从 history 取每天的状态：断卡标红、补卡标「补」（见需求规格 9.3 / 9.5）
  const hist = {};
  (flag.history || []).forEach(h => {
    if (h && h.d) hist[h.d] = h.makeup ? 'makeup' : (h.ok === false ? 'miss' : 'done');
  });
  for (let i=0;i<firstDow;i++) cells.push({t:'pad'});
  for (let d=1; d<=total; d++){
    const dt = new Date(start.getTime() + (d-1)*86400000);
    let st = 'future';
    if (d <= checked) st = 'done';
    if (hist[d]) st = hist[d];
    if (settled) {
      /* 已结算：没打卡的那天 = 真的没打卡（标红），不是「未来」 */
      if (st === 'future') st = 'miss';
    } else if (dt > today && st !== 'miss' && st !== 'makeup') st = 'future';
    cells.push({t:'day', d, st, today: !settled && dt.toDateString()===today.toDateString()});
  }
  return cells;
}

/** 剩余天数（含结束日当天 —— 结束日 = 第 N 天，当天必须打卡）
 *  ⚠️ 口径见需求规格 R1.1 / R3.1：打卡日闭区间 [第1天 .. 第N天] */
function daysLeft(flag){
  const end = new Date(flag.end);
  const today = new Date('2026-11-16');
  // 结束日当天也算 1 天（今天就是最后一天 → 「还有 1 天」）
  return Math.max(0, Math.floor((end - today)/86400000) + 1);
}
