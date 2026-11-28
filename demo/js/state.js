/* ============================================================
   亏了 · 状态层
   ------------------------------------------------------------
   整个 demo 的「关于我」的数据都收拢在这里。
   页面一律从 STATE 读，不直接读硬编码常量。

   新用户 = 首次登录状态：
     - 没有任何 Flag
     - 信用分 60（起始分）
     - 没有订阅、没有通知、没有见证任务
     - 广场里别人的 Flag 仍然存在（那是公共内容）

   右侧调试面板可注入内容，模拟「用了一段时间之后」的状态。
   ============================================================ */

/* ---------- 状态定义 ---------- */

const NEW_USER = {
  credit: 60,
  witnessCount: 0,
  supervisorCount: 0,
  doneFlags: 0,
  failedFlags: 0,
  myFlags: [],      // 我发起的 Flag
  subscribed: [],   // 我监督的 Flag id
  following: [],    // 我关注的人（用户名）—— 见需求规格 R2.12
  notifs: [],       // 通知
  verdictTasks: [], // 见证席待判定
  checkinLogs: {},  // flagId -> 日志数组
  creditLogs: [],
  seenIntro: false,
  /* 打卡页草稿：待上传的补充照片（见需求规格 R2.6）
     ⚠️ 上传动作独立于打卡按钮 —— 先传图、再打卡，两件事分开做。
     extra 是 {src, slot}[]，第 1 个（slot=0）即封面图。 */
  checkinDraft: { flagId: null, extra: [], shot: null, note: '' },
  /* ⚠️ 2026-11-24（本轮）：打卡页模式 —— 'checkin'（打今天的卡） / 'makeup'（补昨天的卡）
     —— 补卡**不是另一个页面**，是今日打卡页的另一种模式（见需求规格 R2.30②） */
  checkinMode: 'checkin',
  /* 已看过的打卡物证：flagId -> [day, ...]
     —— 记录「他看过哪几天」（⚠️ 2026-11-24 起不再承担异议前置） */
  seenEvidence: {},
  /* 登录态：false = 游客（可浏览，实质性动作时才要求登录） */
  loggedIn: false,
  /* ⚠️ 2026-11-24：demo 的默认态 loggedIn 也是 false（登录不是进入 demo 的前置），
     所以「用户主动切到游客态」跟「还没登录过」需要区分开 ——
     这个标记只给演示面板用，让左栏能如实显示「游客态」。 */
  isGuest: false,
  /* 登录页当前方式：'wx' = 微信登录，'phone' = 手机号登录（默认微信） */
  loginTab: 'wx',
  /* 协议是否已勾选（登录页与半屏浮层共用同一状态） */
  privacyAgreed: false,
  /* 信用分周进度（见需求规格 8.1.4） */
  witnessWeekCredit: 0,   // 本周见证加分累计（上限 +8，见需求规格 8.1）
  witnessWeekKey: '',     // 自然周标识，用于跨周重置
  /* 押金（见需求规格 R10） */
  periodSel: 30,          // 选中的周期（7 / 14 / 30 / 90 天）
  depSel: 120,            // 当前选中的押金档位（元）
  /* 立 Flag 分步引导草稿（见「立 Flag 分步流程」）
     第一次立 Flag 走 4 步引导：目标 → 周期 → 押金 → 支付。
     周期与押金复用上面的 periodSel / depSel，不另设字段，避免两套状态。 */
  createDraft: {
    title: '', start: '', target: '',
    agreedPay: false,
  },
  /* 见证席相关（见需求规格 4.9） */
  fullSupervised: 0,     // 完整监督次数（已出结局 + 陪了 ≥3 天 + 互动过）
  inPool: false,         // 是否已在见证席候选池
  poolApplied: false,    // 是否已提交过入池申请
  myWitnessedFlags: [],  // 我完整监督过的 Flag id（同一发起人只计 1 次）
  /* ⚠️ 2026-11-24 用户口径（改）：「成为见证席的理由，简化为累计完成 10 次互动就行了，
     点赞或留言。」
     —— 门槛从「完整监督 1 次」换成「累计互动 10 次」。
     —— 互动 = 点赞 + 留言（两者都算 1 次），由 doLike() / addPublicMsg() 累加。 */
  interactions: 0,       // 累计互动次数（点赞 + 留言）
  /* 见证席召集令（见需求规格 R5.6）—— ⚠️ 2026-11-22 用户口径（改）：
     召集令不再是一个独立页面 —— 点「发布见证席召集令」就地发布，
     按钮变成「见证席召集令已发布」，再点它从底部升起半屏看报名情况。
     所以这里只需要记「发没发」和「谁来报名了」。 */
  recruitPublished: false,   // 召集令是否已发布
  recruitApplicants: [],     // 报名者：{id, name, avatar, color, credit, rate, flagsWitnessed, status}
                             // status: 'applied' 已报名待处理 / 'accepted' 已接受 / 'declined' 已拒绝
  poolSort: 'relation',      // 候选池排序维度：relation / credit / rate（见 4.9.4）
  /* 候选池「邀请」状态（见需求规格 R5.9.4.3）
     ⚠️ 2026-11-23 用户口径：点「邀请」后按钮变「已邀请」——
        邀请是一次性动作，按钮必须自己记住状态。 */
  poolInvited: {},           // id -> 1（已发出邀请）
  /* 点赞（见需求规格 R2.18）—— flagId -> { count: 赞数, lastDay: 最近点赞日, phrase: 选的短语 }
     ⚠️ 一天最多 +1 次：同一天再点不再加数（见 doLike） */
  likes: {},
  /* ⚠️ 2026-11-23 用户口径（新增）：首页「我见证的 Flag」——
     只放我作为见证席正在盯的局，【哪怕还没到判定节点】也照样展示。
     这跟「订阅」是两件事：订阅只等结局，见证要担责任。 */
  witnessing: [],            // 我正在见证的 Flag id
  /* ⚠️ 2026-11-24 用户口径（新增）：我申请参加见证席的局 ——
     「见证席面板应该展示目前正在招募见证的列表，可以选择参加」
     「当用户点击超过3个的时候，弹出提示最多一次申请3个」
     —— 这里存我已申请（待对方接受）的 Flag id。
        与「不允许中途加入」呼应：一旦被接受，这一局就锁死，不能再退出。 */
  witnessApplying: [],       // 我申请参加见证席的 Flag id（待接受）
  /* ⚠️ 2026-11-24 用户口径（新增）：个人资料（可编辑）——
     年龄 / 加入时间 / ID号 / 个性签名 / 所在省份。
     默认值在 data.js 的 ME.profile 里，这里存用户改过的版本。 */
  profile: null,
  /* ⚠️ 2026-11-24（本轮）：通知 Tab 分两栏 ——
     「全部」= 所有通知；「判定·邀请」= 需要我行动的那部分（待判定 / 见证席邀请 / 异议投票）。
     —— 为什么分两栏：通知里有三类东西 ——【要我做事】【告诉我结果】【别人对我有动作】。
        第一类不处理就会有后果，混在平铺列表里会被埋掉。
        这一类单独成栏 = 收件箱。 */
  notifTab: 'all',          // 'all' | 'action'
  /* ⚠️ 2026-11-24（本轮修复）：已读通知的【记忆清单】——
     通知分两类：
       ① 存在 STATE.notifs 里的【固定通知】—— 未读状态存在通知对象上
       ② 每次打开页面【现算出来】的通知（待判定节点 / 见证席邀请 / 异议进展）
          —— 它们没有存盘的地方，每次调用 actionNotifs() 都重新生成
     —— 原来的 bug：「全部已读」只清了 ①，② 每次都被写死成 unread:true，
        所以角标和数字永远降不下来。
     —— 修法：给「已读」一个能记住的地方。这里存 ② 的 key。
        在这个清单里 = 已读；不在 = 未读。 */
  notifReadKeys: [],
  /* ⚠️ 2026-11-24（本轮）：我收到的【见证席邀请】——
     之前邀请机制只有「发起人那头」（坑位 / 12 小时过期 / 候选池邀请），
     被邀请的人那头没有任何入口知道「你被邀请了」—— 闭环缺口。
     这里是【被邀请方】的记录：{ flagId, from, ts, status }
     status: 'pending' 待回应 / 'accepted' 已接受 / 'declined' 已拒绝 / 'expired' 已过期 */
  witnessInvites: [],
  /* ⚠️ 2026-11-24（本轮）：广场的三个内容视图 ——
     'rec'    推荐（现在的瀑布流）
     'follow' 关注的人正在跑的局
     'recruit'正在招募见证席的局
     —— 为什么要分视图：「关注」这个功能以前几乎没有落点 ——
        关注了一个人之后，除了「我关注的人」列表，
        【没有任何地方能看到关注的人的局】，点了等于没点。
        这个视图把那个承诺兑现出来。 */
  squareView: 'rec',
  /* ⚠️ 2026-11-24（本轮）：广场筛选条件（真的能筛出结果）——
     以前筛选是个「点了没反应」的假控件：chips 画得像能点，
     但筛完广场还是原来那些局。 */
  sqFilter: { status: 'all', days: 'all', tier: 'all' },
}

/* 演示用「有内容」的种子数据 */
const SEED_FLAGS = [
  {
    id: 'f_new_1', mine: true,
    user: { name: '老王', avatar: '王', color: '#FF6B00' },
    title: '30 天，把体脂从 26% 降到 23%',
    reason: '体检报告说超重，先从轻的来',
    startWeight: 72.5, curWeight: 71.2, targetWeight: 68.0,
    start: '2026-11-15', end: '2026-12-14', days: 30,
    status: 'running', statusText: '进行中', tier: 'T2', deposit: 500,
    /* ⚠️ 2026-11-23 用户口径：首页打卡卡片要能跟着打卡动作实时变
       「今天还没打卡 / 今天已打卡」—— 所以种子停在「今天还没打卡」，
       用户点进去打卡、回到首页就能看到文案翻转。 */
    checkedDays: 1, totalDays: 30, streak: 1, breaks: 0,
    witnesses: [WITNESSES[0], WITNESSES[1], WITNESSES[2]],
    supervisorCount: 12,
    node: 'daily',
    history: [
      { d: 1, w: 72.5, ok: true, note: '起始称重' },
    ],
    nodes: [
      { name: '起始称重', date: '2026-11-15', state: 'done', note: '已验证 · 72.5kg' },
      { name: '中期称重', date: '2026-11-24', state: 'future', note: '' },
      { name: '中期复核', date: '2026-12-04', state: 'future', note: '' },
      { name: '结束称重', date: '2026-12-14', state: 'future', note: '' },
    ],
    msgs: [], quote: '',
  },
  {
    id: 'f_new_2', mine: true,
    user: { name: '老王', avatar: '王', color: '#FF6B00' },
    title: '14 天，每天早睡不熬夜',
    reason: '连续熬夜半年，肝功能异常',
    startWeight: 68.0, curWeight: 68.0, targetWeight: 67.5,
    start: '2026-11-12', end: '2026-11-25', days: 14,
    /* ⚠️ 这局是【已取消】的 —— 同一时间只能有一个进行中的 Flag（见 R1.6），
       所以种子里只留 f_new_1 在跑，f_new_2 用来演示「取消后按未达标结算」。 */
    status: 'failed', statusText: '未达标', tier: 'T1', deposit: 200,
    canceled: true, failedReason: '发起人主动取消',
    lostAmount: 70, creditDelta: -5,
    checkedDays: 4, totalDays: 14, streak: 0, breaks: 0,
    witnesses: [WITNESSES[3]],
    supervisorCount: 6,
    node: 'daily',
    history: [
      { d: 1, w: 68.0, ok: true, note: '起始称重' },
      { d: 2, w: 68.0, ok: true }, { d: 3, w: 68.0, ok: true },
      { d: 4, w: 68.0, ok: true },
    ],
    nodes: [
      { name: '起始称重', date: '2026-11-12', state: 'done', note: '已验证 · 68.0kg' },
      { name: '中期称重', date: '2026-11-18', state: 'now', note: '还有 2 天' },
      { name: '结束称重', date: '2026-11-25', state: 'future', note: '' },
    ],
    msgs: [], quote: '',
  },
];

const SEED_CHECKIN = {
  f_new_1: [
    { d: 1, date: '11-15', w: 72.5, state: 'done', node: '起始称重', ai: '完整审核通过', photo: true },
  ],
  f_new_2: [
    { d: 1, date: '11-12', w: 68.0, state: 'done', node: '起始称重', ai: '完整审核通过', photo: true },
    { d: 2, date: '11-13', w: 68.0, state: 'done', ai: '查重通过' },
    { d: 3, date: '11-14', w: 68.0, state: 'done', ai: '查重通过' },
    { d: 4, date: '11-15', w: 68.0, state: 'done', ai: '查重通过' },
  ],
};

/* ---------- 状态实例 ---------- */

let STATE = null;

function freshState() {
  return JSON.parse(JSON.stringify(NEW_USER));
}

function initState() {
  STATE = freshState();
  return STATE;
}

/* ---------- 读取器 ---------- */

/** 按 id 找任意 Flag（公共的或我自己的） */
function findFlag(id) {
  if (!id) return myMainFlag() || FLAGS.f_own;
  return FLAGS[id] || STATE.myFlags.find(f => f.id === id) || null;
}

/* ============================================================
   点赞（广场卡片，见需求规格 R2.18）
   ⚠️ 2026-11-23 用户口径：「点赞右边显示一共有多少赞（不论选择什么短语，
      都是+1，一天最多+1次，点之前和点之后颜色会有变化）」
   —— 规则：
      · 不论选哪个预设短语，都只 +1 赞（短语只是「附带的表达」，不是权重）
      · **一天最多 +1 次**（同一天再点不再加）
      · 点赞前 / 点赞后颜色不同（`.feed-like.on`）
   ============================================================ */

/** 这局今天有没有赞过（一天最多 +1 次） */
function likedToday(flagId) {
  const rec = (STATE.likes || {})[flagId];
  if (!rec) return false;
  return rec.lastDay === DEMO_TODAY;
}

/**
 * 这局的赞数（显示在点赞按钮右边）
 * —— 初始值来自种子动态流里已有的「赞」事件，之后每点一次 +1。
 */
function likeCountOf(flagId) {
  const rec = (STATE.likes || {})[flagId];
  if (rec) return rec.count;
  const f = FLAGS[flagId] || STATE.myFlags.find(x => x.id === flagId);
  if (f) activityOf(f);           /* 保证种子动态流已经生成 */
  return seedLikeBase(flagId);
}

/**
 * 点赞
 * ⚠️ 2026-11-23 用户口径：「点赞删除掉短语选择，就改成一个普通的点击按钮，
 *    点了变色，带一点小小的特效就行。」
 * —— 所以 `phrase` 变成【可选参数】：不再有短语选择弹窗。
 * @returns {{ok:boolean, reason:string}} ok=false 表示今天已经点过了
 */
function doLike(flagId, phrase) {
  const f = findFlag(flagId);
  if (!f) return { ok: false, reason: '找不到这个 Flag' };
  if (!STATE.likes) STATE.likes = {};
  let rec = STATE.likes[flagId];
  if (!rec) {
    /* ⚠️ 先 activityOf() 把种子的动态流补齐，再取初始赞数 ——
       否则「没种过的旗子」会先读到 0、后面又补出种子，造成前后不一致。 */
    activityOf(f);
    rec = { count: seedLikeBase(flagId), lastDay: '', phrase: '' };
    STATE.likes[flagId] = rec;
  }
  /* ⚠️ 一天最多 +1 次 —— 今天点过了就不再加数 */
  if (rec.lastDay === DEMO_TODAY) {
    return { ok: false, reason: '今天已经点过赞了' };
  }
  rec.count += 1;
  rec.lastDay = DEMO_TODAY;
  rec.phrase = phrase || '';
  /* ⚠️ 2026-11-24：点赞算 1 次互动（成为见证席的门槛，见 R5.9.2.3） */
  addInteraction('点赞');
  /* ⚠️ 没有短语了 —— 只写一条「点赞」事件，不带内容 */
  activityOf(f).unshift({ type: 'like', who: '我', count: 1, time: '刚刚' });
  return { ok: true, reason: '' };
}

/**
 * 这局的留言条数（公开留言 + 目标人的回声区）
 * ⚠️ 2026-11-23 用户口径：「点赞、留言、监督都显示数值。」
 */
function msgCountOf(flagId) {
  const f = findFlag(flagId);
  if (!f) return 0;
  return publicMsgsOf(f).length + (f.msgs ? f.msgs.length : 0);
}

/**
 * 切换「监督这一局」
 * ⚠️ 2026-11-23 用户口径：「监督也可以点，点了就监督了，颜色改变，
 *    再点一次取消监督。」
 * —— 监督数是【动态人数】，所以点下去的同时 +1，取消时 -1。
 * @returns {{on:boolean, count:number}}
 */
function toggleSupervise(flagId) {
  const f = findFlag(flagId);
  if (!f) return { on: false, count: 0 };
  if (STATE.subscribed.includes(flagId)) {
    unsubscribeFlag(flagId);
    f.supervisorCount = Math.max(0, (f.supervisorCount || 0) - 1);
    return { on: false, count: f.supervisorCount };
  }
  subscribeFlag(flagId);
  f.supervisorCount = (f.supervisorCount || 0) + 1;
  return { on: true, count: f.supervisorCount };
}

/** 初始赞数 —— 从种子里已有的「赞」事件数推出来 */
function seedLikeBase(flagId) {
  const acts = ACTIVITY[flagId] || [];
  return acts.filter(a => a.type === 'like').reduce((s, a) => s + (a.count || 1), 0);
}

/* ---------- 见证席面板（见需求规格 R5.2.1）----------
   ⚠️ 2026-11-23 用户口径（改）：「见证席面板……除了点击到需要判定的节点，
      三选一以外，作为见证席应该能看到用户的完整 FLAG 的，
      并且清晰知道自己的判定在那个阶段。」
   —— 所以面板按 Flag 分组：
      · 一个 Flag 一张卡，卡上是这个 Flag 的【完整信息】（目标 / 周期 / 节点进度）
      · 节点条上标出：哪些步我已经判过、哪一步是现在要判的
      · 待判的那一步才出「三选一」
   ============================================================ */

/** 我作为见证席的全部判定任务 */
function myVerdictTasks() {
  return STATE.verdictTasks || [];
}

/**
 * 把判定任务按 Flag 分组（一个 Flag 一组，组内按节点日排序）
 * 返回 [{ flag, tasks, pending }] —— pending = 还没判的那一步
 */
function verdictGroups() {
  const tasks = myVerdictTasks();
  const map = new Map();
  tasks.forEach(t => {
    if (!map.has(t.flagId)) map.set(t.flagId, []);
    map.get(t.flagId).push(t);
  });
  const out = [];
  map.forEach((list, flagId) => {
    list.sort((a, b) => (a.nodeDay || 0) - (b.nodeDay || 0));
    const pending = list.find(t => !t.myVerdict) || null;
    out.push({ flagId, tasks: list, pending, flag: findFlag(flagId) });
  });
  /* 待判的排前面 —— 聚焦点在「现在要判的那一步」 */
  out.sort((a, b) => (b.pending ? 1 : 0) - (a.pending ? 1 : 0));
  return out;
}

/**
 * 某个 Flag 的完整节点进度条（见证席视角）
 * 返回 [{ name, day, state, mine }] —— state: done / now / future / fail
 *         mine: 'pass' | 'doubt' | 'cheat' | null（我在这一步的判定）
 */
function witnessNodeTrack(flagId, tasks) {
  const f = findFlag(flagId);
  const plan = f && f.days ? (NODE_PLAN[f.days] || []) : [];
  const names = f && f.days ? (NODE_NAMES[f.days] || []) : [];
  const myMap = new Map();
  (tasks || []).forEach(t => myMap.set(t.nodeName, t.myVerdict || null));
  const out = [];
  plan.forEach((day, i) => {
    const nm = names[i];
    const hit = (f && f.nodes || []).find(n => n.name === nm);
    out.push({
      name: nm, day,
      state: hit ? hit.state : 'future',
      note: hit ? hit.note : '',
      mine: myMap.has(nm) ? myMap.get(nm) : undefined,
    });
  });
  return out;
}

/** 我在某个 Flag 上已经判了几步 / 共几步 */
function witnessProgressOf(group) {
  const total = group.tasks.length;
  const done = group.tasks.filter(t => t.myVerdict).length;
  return { done, total };
}

/**
 * 把某个判定任务标记为「我已判」（见需求规格 R5.2.1）
 * 见证席面板的节点条靠这个显示「我判到第几步」
 */
function markVerdictDone(taskId, kind) {
  const list = STATE.verdictTasks || [];
  const t = list.find(x => x.id === taskId);
  if (!t) return false;
  t.myVerdict = kind || 'pass';
  t.deadline = '已判定';
  /* ⚠️ 2026-11-24（用户口径改）：判定完之后，通知里那一条
     要从「待你判定」变成「已判定」—— 不是直接消失。
     —— 消失的话，用户会以为这条通知丢了；留着变灰，
        用户才看得见「这件事我做完了」。 */
  t.verdictAt = nowStamp();
  /* 已判定的人数 +1 */
  t.judged = (t.judged || 0) + 1;
  return true;
}

/** 我的进行中 Flag（第一个） */
function myMainFlag() {
  const running = STATE.myFlags.filter(f => f.status === 'running' || f.status === 'ending');
  return running[0] || STATE.myFlags[0] || null;
}

/** 我的全部 Flag，按状态分组 */
function myFlagsByState() {
  const g = { running: [], ending: [], done: [], broken: [] };
  STATE.myFlags.forEach(f => {
    if (f.status === 'running') g.running.push(f);
    else if (f.status === 'ending') g.ending.push(f);
    else if (f.status === 'failed' || f.status === 'success') g.done.push(f);
    else if (f.status === 'broken') g.broken.push(f);
  });
  return g;
}

/** 该 Flag 现在还能不能取消（见需求规格 R1.6）
 *  只能取消【进行中】的 Flag —— 已结算的（成功 / 失败）不可取消，
 *  断卡的（broken）也不可取消（它已经是失败结局的一种）。
 *  ⚠️ 筹备期（prep）里的 Flag 也不给取消：押金已付、周期已锁死，
 *     筹备期只能继续找见证人（见 R1.1 / INFO.rulesLock）。 */
function canCancelFlag(f) {
  if (!f || !f.mine) return { ok: false, reason: '这不是你的 Flag' };
  if (f.status === 'prep') return { ok: false, reason: '24 小时筹备期内不能取消 —— 这段时间只能继续找见证人' };
  if (f.status !== 'running' && f.status !== 'ending') {
    return { ok: false, reason: '这个 Flag 已经结束了，不能取消' };
  }
  return { ok: true, reason: '' };
}

/** 我当前进行中的 Flag（筹备期 + 进行中 + 即将结算都算「占着」） */
function myActiveFlags() {
  return STATE.myFlags.filter(f =>
    f.status === 'prep' || f.status === 'running' || f.status === 'ending');
}

/** 现在还能不能立新的 Flag（见需求规格 R1.6「同时只能有一个进行中的 Flag」）
 *  有进行中的 Flag 时不能新开 —— 想开新的，先把原来的取消掉。 */
function canCreateFlag() {
  const act = myActiveFlags();
  if (!act.length) return { ok: true, reason: '', current: null };
  const cur = act[0];
  return {
    ok: false,
    reason: '你已经有一个进行中的 Flag 了',
    current: cur,
  };
}

/**
 * 取消一个进行中的 Flag（见需求规格 R1.6）
 * ⚠️ 结算口径 = 【按失败处理】：
 *    押金按信用等级比例扣收（不退还）、信用分按周期扣减。
 *    这跟「押金一经支付不退还」的口径一致 —— 取消不是撤销，
 *    而是一局没撑完的赌局按失败结算。
 * @param {string} flagId
 * @returns {object|null} { flag, loss, creditDelta, reason }
 */
function cancelMyFlag(flagId) {
  const f = findFlag(flagId) || myMainFlag();
  if (!f) return null;
  const can = canCancelFlag(f);
  if (!can.ok) return { flag: f, ok: false, reason: can.reason, loss: 0, creditDelta: 0 };

  // 押金按信用等级比例扣收（见 R10.3：失败实际损失 = 押金 × 信用等级费率）
  const loss = failureLoss(f.deposit || 0, STATE.credit);
  // 信用分按周期扣减（与失败结局同口径，见 R8.4）
  const creditDelta = -creditFailPenaltyFor(f);

  f.status = 'failed';
  f.statusText = '未达标';
  f.failedReason = '发起人主动取消';
  f.lostAmount = loss;
  f.creditDelta = creditDelta;
  f.canceled = true;
  f.deposit = 0;
  f.streak = 0;

  // 信用分扣减（不扣到 45 以下 —— applyCredit 自带下限）
  if (creditDelta) addCredit(creditDelta, `取消「${f.title}」`, '目标失败');

  return { flag: f, ok: true, reason: '', loss, creditDelta };
}

/** 我监督的 Flag 对象列表 */
function mySubscribed() {
  return STATE.subscribed.map(id => FLAGS[id]).filter(Boolean);
}

/* =========================================================
   关注（follow）—— 见需求规格 R2.12
   ⚠️ 关注的是【人】，不是某一局 —— 与「监督结局」是两件事：
      监督 = 盯一局的结局通知（Flag 级）
      关注 = 盯一个人（人级），他新开的局我会看到
   ========================================================= */

/** 关注一个用户 */
function followUser(name) {
  if (!name || name === ME.name) return false;
  if (STATE.following.includes(name)) return false;
  STATE.following.unshift(name);
  return true;
}

/** 取消关注 */
function unfollowUser(name) {
  const i = STATE.following.indexOf(name);
  if (i >= 0) STATE.following.splice(i, 1);
}

/** 是否已关注 */
function isFollowing(name) {
  return !!name && STATE.following.includes(name);
}

/** 我关注的人（按关注时间倒序） */
function myFollowing() {
  return STATE.following.slice();
}

/**
 * 我关注的人正在跑的 Flag 列表
 * ⚠️ 关注是【人级】关系 —— 关注了谁，他**所有**在跑的局都会进我的关注流，
 *    不是我关注的某一局（那是订阅）。
 * @returns {Array} Flag 对象数组
 */
function myFollowingFlags() {
  if (!STATE.following.length) return [];
  const names = STATE.following;
  return Object.keys(FLAGS)
    .map(id => FLAGS[id])
    .filter(f => f && !f.mine && f.user && names.includes(f.user.name))
    .sort((a, b) => (b.checkedDays || 0) - (a.checkedDays || 0));
}

/** 未读通知数
 *  ⚠️ 2026-11-24（本轮）：改用 unreadNotifCount() ——
 *  底部 Tab 角标和首页铃铛角标现在用同一个口径（纯通知 + 需要我行动的）。
 *  这里保留这个函数是为了兼容首页铃铛的旧调用点。 */
function unreadNotifs() {
  return unreadNotifCount();
}

/* =========================================================
   我正在见证的 Flag（见首页「我见证的 Flag」）
   ⚠️ 2026-11-23 用户口径：「首页中，把『我关心的 Flag』改为『我见证的 Flag』，
      点进去以后就是正常的目标详情，区别于订阅 —— 这里只展示我正在见证的 Flag
      （哪怕没到节点）。」
   —— 所以这里的口径是【见证关系】，不是订阅：
      · 只要我在这局的见证席名单里（已被邀约 / 已接受 / 正在判定）就算
      · 哪怕还没到下一个判定节点，也照样出现在首页
      · 点进去走的就是普通的目标详情页（围观者视角），不做特殊跳转
   ============================================================ */

/** 我是否在见证这一局 */
function isWitnessing(id) {
  if (!id) return false;
  if ((STATE.witnessing || []).includes(id)) return true;
  /* 有判定任务 = 一定在见证 */
  return (STATE.verdictTasks || []).some(t => t.flagId === id);
}

/** 加入见证（接受邀约 / 被指派时调用） */
function addWitnessing(id) {
  if (!id) return false;
  if ((STATE.witnessing || []).includes(id)) return false;
  STATE.witnessing.unshift(id);
  return true;
}

/**
 * 我正在见证的全部 Flag（对象数组）
 * ⚠️ 去重 + 排除自己的局 —— 自己立的局不算「见证」
 */
function myWitnessingFlags() {
  const ids = new Set();
  (STATE.witnessing || []).forEach(id => ids.add(id));
  (STATE.verdictTasks || []).forEach(t => { if (t.flagId) ids.add(t.flagId); });
  const out = [];
  ids.forEach(id => {
    const f = findFlag(id);
    if (f && !f.mine) out.push(f);
  });
  /* 待判的排前面 —— 有事要做的先看 */
  out.sort((a, b) => {
    const pa = (STATE.verdictTasks || []).some(t => t.flagId === a.id && !t.myVerdict) ? 1 : 0;
    const pb = (STATE.verdictTasks || []).some(t => t.flagId === b.id && !t.myVerdict) ? 1 : 0;
    if (pa !== pb) return pb - pa;
    return (b.checkedDays || 0) - (a.checkedDays || 0);
  });
  return out;
}

/** 打卡日志（按 flagId） */
function logsOf(flagId) {
  return STATE.checkinLogs[flagId] || [];
}

/** 标记「已看过这天的物证」（⚠️ 2026-11-24 起不再承担异议前置，见 R4.3） */
function markEvidenceSeen(flagId, day) {
  if (!flagId || !day) return;
  STATE.seenEvidence = STATE.seenEvidence || {};
  const list = STATE.seenEvidence[flagId] || (STATE.seenEvidence[flagId] = []);
  if (!list.includes(Number(day))) list.push(Number(day));
}

/** 已看过的物证天数 */
function seenEvidenceDays(flagId) {
  return (STATE.seenEvidence && STATE.seenEvidence[flagId]) || [];
}

/* ============================================================
   补充照片（生活照）—— 见需求规格 R2.6
   ⚠️ 与打卡照是【两套东西】：
     - 打卡照 = 物证（证明今天称过重），不能删
     - 补充照 = 内容（饮食 / 运动 / 穿搭 / 个人照），最多 3 张
   上传动作【独立于打卡按钮】—— 先传图、再打卡，两件事分开做。
   ============================================================ */

/** 当前打卡页待上传的补充照片（暂存在草稿里，不落到 Flag 上） */
function pendingExtraPhotos() {
  if (!STATE.checkinDraft) STATE.checkinDraft = { flagId: null, extra: [], shot: null, note: '' };
  return STATE.checkinDraft.extra;
}

/**
 * 今日打卡的心情 / 体悟（见需求规格 R2.11）
 * ⚠️ 口径（用户 2026-11-21 明确要求）：
 *    「给用户一个框，能填写今天的一些心情或者体悟，字数限制不超过 15 字」
 *    —— 打卡照是【物证】，这句话是【内容】。两者不互相替代。
 *    围观者点目标详情时，除了看到当天拍的照片，还能看到这天的留言。
 * ⚠️ 上限 15 字 —— 硬限制，超了不收。
 */
const CHECKIN_NOTE_MAX = 15;

/** 当前草稿里的心情 / 体悟 */
function pendingCheckinNote() {
  if (!STATE.checkinDraft) STATE.checkinDraft = { flagId: null, extra: [], shot: null, note: '' };
  return STATE.checkinDraft.note || '';
}

/** 写入心情 / 体悟（超过 15 字截断） */
function setCheckinNote(text) {
  if (!STATE.checkinDraft) STATE.checkinDraft = { flagId: null, extra: [], shot: null, note: '' };
  STATE.checkinDraft.note = String(text || '').slice(0, CHECKIN_NOTE_MAX);
  return STATE.checkinDraft.note;
}

/**
 * 把心情 / 体悟落到打卡记录上（打卡时调用）
 * ⚠️ 按天存 —— photos 序列的每一格可以带 note 字段。
 *    围观者看「第 N 天」时，照片下面就是这天的留言。
 * @returns {string|null} 落库的字串
 */
function commitCheckinNote(flagId, day) {
  const note = pendingCheckinNote().trim();
  if (!note) return null;
  const f = FLAGS[flagId] || myMainFlag();
  if (!f) return null;
  if (!f.photos) f.photos = photosOf(f);
  const hit = f.photos.find(p => p.d === day);
  if (hit) hit.note = note;
  else f.photos.push({ d: day, st: 'done', src: null, w: null, note });
  return note;
}

/** 某一天的心情 / 体悟（没有就返回 null） */
function noteOf(f, day) {
  const list = photosOf(f);
  const hit = list.find(p => p.d === day);
  return (hit && hit.note) ? hit.note : null;
}

/** 切换打卡页的草稿目标（进页面时重置） */
function resetCheckinDraft(flagId) {
  STATE.checkinDraft = { flagId: flagId || null, extra: [], shot: null, note: '' };
  return STATE.checkinDraft;
}

/* ============================================================
   补卡模式（⚠️ 2026-11-24 本轮新增，见需求规格 R2.30②）
   ------------------------------------------------------------
   「补卡页面复用今日打卡页：补卡功能保留；点击补卡进入的页面内容与今日打卡
     完全一致，区别仅在于打卡对象是昨天的卡。」

   —— 所以【补卡不是另一个页面】，它是【今日打卡页的另一种模式】：
      照片区、随机词、心情输入框、生活照、打卡说明 —— 全部一样。
      唯一不同的是：**这一张卡是打给哪一天的**。
   —— 单一真相源在这里：STATE.checkinMode = 'checkin' | 'makeup'
      · 打卡对象日（makeupDay）在补卡模式下 = 昨天
      · 提交时走 doMakeup 而不是 doCheckin
   —— 为什么用「模式」而不是「另一个页面」：
      补卡要拍物证、要写心情、要传生活照 —— 这些【逐条都跟打卡一样】。
      做成两套页面，两套页面就会慢慢分叉（补卡页少传一张照片之类），
      而用户要的就是「跟打卡一模一样，只是日期不同」。
   ============================================================ */

/** 当前是打卡模式还是补卡模式 */
function checkinMode() {
  return STATE.checkinMode === 'makeup' ? 'makeup' : 'checkin';
}

/** 是否处于补卡模式 */
function isMakeupMode() {
  return checkinMode() === 'makeup';
}

/**
 * 这次打卡 / 补卡打在【哪一天】
 * @returns {number} 天序号（补卡 = 昨天那一天；打卡 = 今天）
 */
function checkinTargetDay(f) {
  if (!isMakeupMode()) return (f && (f.checkedDays || 0)) + 1;
  /* 补卡：补的是【漏掉的那一天】 —— 用 missedOn 推算它在第几天 */
  const day = makeupMissedDayIndex(f);
  return day || ((f && (f.checkedDays || 0)) + 1);
}

/**
 * 漏掉的那天是第几天（1-based）
 * ⚠️ 以 f.missedOn 为准 —— 它记的是【日期】，
 *    而 history 里记的是【天序号】；两者用 daysBetween 换算。
 */
function makeupMissedDayIndex(f) {
  if (!f || !f.missedOn || !f.start) return 0;
  const n = daysBetween(f.start, f.missedOn) + 1;
  return n > 0 ? n : 0;
}

/** 进入补卡模式（进打卡页前调） */
function enterMakeupMode(flagId) {
  STATE.checkinMode = 'makeup';
  STATE.checkinDraft = { flagId: flagId || null, extra: [], shot: null, note: '' };
  return STATE.checkinMode;
}

/** 回到普通打卡模式 */
function exitMakeupMode() {
  STATE.checkinMode = 'checkin';
  return STATE.checkinMode;
}

/**
 * 本次打卡的打卡照（物证）
 * ⚠️ 打卡照是【必填项】—— 没拍就不能提交打卡（见需求规格 R2.8）。
 *    补充照再多也不能替代它（补充照是内容，不是物证）。
 * @returns {{src:string, w:number}|null}
 */
function pendingCheckinShot() {
  if (!STATE.checkinDraft) STATE.checkinDraft = { flagId: null, extra: [], shot: null, note: '' };
  return STATE.checkinDraft.shot;
}

/** 是否已经拍了打卡照 —— 决定「提交打卡」按钮是否可点 */
function hasCheckinShot() {
  const s = pendingCheckinShot();
  return !!(s && s.src);
}

/** 拍打卡照（demo：模拟一次拍照；真实环境是 takePhoto + 上传） */
function setCheckinShot(src, weight) {
  if (!src) return false;
  if (!STATE.checkinDraft) STATE.checkinDraft = { flagId: null, extra: [], shot: null, note: '' };
  STATE.checkinDraft.shot = { src: src, w: weight || null };
  return true;
}

/**
 * 添加一张补充照片
 * @param src 图片地址（demo 里是素材路径；真实环境是上传后的 CDN 地址）
 * @returns {boolean} 是否添加成功（超出上限返回 false）
 */
function addExtraPhoto(src) {
  if (!src) return false;
  const list = pendingExtraPhotos();
  if (list.length >= MAX_EXTRA_PHOTOS) return false;
  list.push({ src: src, slot: list.length });
  return true;
}

/** 删除一张补充照片（删掉中间的，第 1 张的"封面"身份会顺延给下一张） */
function removeExtraPhoto(slot) {
  const list = pendingExtraPhotos();
  const i = list.findIndex(x => x.slot === Number(slot));
  if (i < 0) return false;
  list.splice(i, 1);
  list.forEach((x, k) => { x.slot = k; });
  return true;
}

/** 指定哪一张是封面（第 1 张默认是封面） */
function setCoverPhoto(slot) {
  const list = pendingExtraPhotos();
  const i = list.findIndex(x => x.slot === Number(slot));
  if (i <= 0) return false;          // 第 1 张本来就是封面
  const [it] = list.splice(i, 1);
  list.unshift(it);
  list.forEach((x, k) => { x.slot = k; });
  return true;
}

/**
 * 把待上传的补充照片落到 Flag 上（打卡时调用）
 * ⚠️ 打卡照是物证，补充照是内容 —— 两者分开存，不混进 photos 序列。
 *
 * ⚠️ 2026-11-25（本轮修复）：**追加**，不再整段覆盖 ——
 *    原来这里是 `f.extraPhotos = stamped`（整体替换）：
 *    用户第 68 天传了 3 张生活照，第 69 天再传 1 张 → 前 3 张直接消失，
 *    详情页「生活照 N 张 · 第 1 张是封面」变成只剩 1 张，
 *    而且**封面也跟着换了**（用户没主动换封面，封面却自己变了）。
 *    —— 生活照是【按天累积的内容】，补一次打卡不该抹掉历史。
 *    —— 顺序口径：老照片在前（封面稳定 = 第 1 张仍然是第一张传上去的），
 *       新照片追加在后；slot 继续往下编号，保证序号连续不重复。
 * @returns {Array} 本次新增的照片条目
 */
function commitExtraPhotos(flagId, day) {
  const list = pendingExtraPhotos();
  if (!list.length) return [];
  const f = FLAGS[flagId] || myMainFlag();
  if (!f) return [];
  /* 先物化，避免覆盖到别处写过的历史 */
  if (!Array.isArray(f.extraPhotos)) f.extraPhotos = [];
  /* 已有照片里最大的 slot —— 新照片从它后面接着排 */
  let maxSlot = -1;
  f.extraPhotos.forEach(x => {
    const s = Number(x.slot);
    if (!isNaN(s) && s > maxSlot) maxSlot = s;
  });
  const stamped = list.map((x, i) => ({ src: x.src, day: day, slot: maxSlot + 1 + i }));
  f.extraPhotos = f.extraPhotos.concat(stamped);
  return stamped;
}

/**
 * 把打卡照（物证）落到 Flag 的 photos 序列上
 * ⚠️ 这是唯一往 photos 里写入口子的地方 —— 打卡照按天索引，
 *    断卡天是 src:null 的空格子（见合规红线 W7.1）。
 *    补充照【绝不】走这里。
 *
 * ⚠️ photosOf(f) 在没有种子时会按 checkedDays 反推生成整段序列，
 *    所以这里必须【先物化整段序列】再替换当天那一格 ——
 *    直接 f.photos.push 会丢掉之前 68 天的历史。
 */
function commitCheckinShot(flagId, day) {
  const shot = pendingCheckinShot();
  const f = FLAGS[flagId] || myMainFlag();
  if (!shot || !shot.src || !f) return null;
  if (!f.photos) f.photos = photosOf(f);          // 先物化，避免丢历史
  const hit = f.photos.find(p => p.d === day);
  if (hit) {
    hit.st = 'done';
    hit.src = shot.src;
    hit.w = shot.w;
  } else {
    f.photos.push({ d: day, st: 'done', src: shot.src, w: shot.w });
  }
  f.photos.sort((a, b) => a.d - b.d);
  return shot;
}

/** 打卡提交后清空草稿 */
function clearCheckinDraft(flagId) {
  STATE.checkinDraft = { flagId: flagId || null, extra: [], shot: null, note: '' };
  return STATE.checkinDraft;
}

/** 信用等级对象 */
function myCreditTier() {
  return creditTierOf(STATE.credit);
}

/* ---------- 见证席候选池（见需求规格 4.9） ---------- */

/** 候选池列表：默认排序 = 关联度 > 信用分 > 成立率 */
/* ============================================================
   见证席候选池排序（见需求规格 4.9.4）
   ⚠️ 2026-11-22 用户口径（改）：「按关联度 · 信用分 · 成立率排序，点击以后，
      能对候选人进行排序，之前只是文字，点不了。」
   —— 排序维度从【说明文字】变成【可点的控件】。
   ============================================================ */

/** 候选池排序维度：relation 关联度 / credit 信用分 / rate 成立率 */
const POOL_SORTS = [
  { key:'relation', label:'关联度', desc:'共同好友 > 共同监督 > 无关系' },
  { key:'credit',   label:'信用分', desc:'信用分从高到低' },
  { key:'rate',     label:'成立率', desc:'见证席成立率从高到低' },
];

/** 当前排序维度（默认关联度） */
function poolSortKey() {
  return STATE.poolSort || 'relation';
}

/** 设置排序维度 */
function setPoolSort(key) {
  if (!POOL_SORTS.some(s => s.key === key)) return false;
  STATE.poolSort = key;
  return true;
}

/** 按指定维度排序候选池 —— 维度之间的先后顺序固定，不因切换而乱 */
function witnessPool(sortKey) {
  const key = sortKey || poolSortKey();
  const list = WITNESS_POOL.slice();
  if (key === 'credit') {
    list.sort((a, b) => (b.credit - a.credit) || (b.rate - a.rate));
  } else if (key === 'rate') {
    list.sort((a, b) => (b.rate - a.rate) || (b.credit - a.credit));
  } else {
    /* 默认：关联度 > 信用分 > 成立率 */
    list.sort((a, b) => {
      if (a.relationLevel !== b.relationLevel) return b.relationLevel - a.relationLevel;
      if (a.credit !== b.credit) return b.credit - a.credit;
      return b.rate - a.rate;
    });
  }
  return list;
}

/** 我是否够格申请入池
 *  ⚠️ 2026-11-24 用户口径（改）：「成为见证席的理由，简化为累计完成 10 次互动就行了，
 *     点赞或留言。」
 *  —— 门槛从「完整监督 1 次」换成【累计互动 10 次】（点赞 + 留言都算）。 */

/** 累计互动次数（点赞 + 留言） */
function interactionCount() {
  return STATE.interactions || 0;
}

/** 成为见证席需要的互动次数 */
function witnessApplyNeed() {
  return WITNESS_APPLY_INTERACTIONS;
}

/** 我是否够格申请入池（累计互动 10 次，见 R5.9.2.3） */
function canApplyToPool() {
  return interactionCount() >= witnessApplyNeed();
}

/* ---------- 候选池「邀请」状态（见需求规格 R5.9.4.3）----------
   ⚠️ 2026-11-23 用户口径：「见证席候选池，当用户点击『邀请』以后，
      按钮变为『已邀请』。」
   —— 邀请是【一次性动作】，按钮必须自己变状态，不能一直停在「邀请」。
   邀请后进入【待对方接受】：对方接受才算占坑位。 */

/** 是否已经邀请过这个人 */
function poolInvited(id) {
  return !!(STATE.poolInvited && STATE.poolInvited[id]);
}

/** 发出见证邀请 —— 幂等，重复点不会重复发 */
function inviteFromPool(id) {
  if (!id) return false;
  if (!STATE.poolInvited) STATE.poolInvited = {};
  if (STATE.poolInvited[id]) return false;
  STATE.poolInvited[id] = 1;
  return true;
}

/** 按 id 找一位候选人（点头像看详情用，见 R5.9.4.4） */
function poolCandidate(id) {
  return WITNESS_POOL.find(p => p.id === id) || null;
}

/* ============================================================
   见证席召集令（见需求规格 R5.6）
   ⚠️ 2026-11-22 用户口径（改）：「用户点击『发布见证席召集令』，
      不用单独进入一个页面，按钮变成了『见证席召集令已发布』，
      然后点击『见证席召集令已发布』，有个从下往上的半框，能展示报名的情况就行。」
   —— 所以召集令是【就地发布 + 半屏看报名】，不是一个独立页面。
   ============================================================ */

/** 报名窗口还剩几小时（20 小时，见 R5.6） */
function recruitHoursLeft() {
  return RECRUIT_WINDOW_HOURS;
}

/** 发布召集令 —— 就地发布，不跳页 */
function publishRecruit() {
  if (STATE.recruitPublished) return false;
  STATE.recruitPublished = true;
  /* 首次发布时种几个报名者（demo 用）—— 真实环境来自服务端推送 */
  if (!STATE.recruitApplicants.length) {
    STATE.recruitApplicants = RECRUIT_SEED.map(a => ({ ...a, status: 'applied' }));
  }
  return true;
}

/** 报名者列表（按报名先后） */
function recruitApplicants() {
  return (STATE.recruitApplicants || []).slice();
}

/** 报名人数（不含已拒绝） */
function recruitApplicantCount() {
  return recruitApplicants().filter(a => a.status !== 'declined').length;
}

/** 接受一位报名者 —— 接受后才占坑位、才计入档位
 *  ⚠️ 2026-11-24（本轮）：处理过的（接受过 / 拒绝过）不能再处理 ——
 *     报名情况列表里「接受 / 拒绝」两个按钮，处理完就换成状态标签，
 *     按钮不会再出现；这里是同一道保险（防止连点 / 越界调用）。
 *
 *  ⚠️ 2026-11-25（本轮修复）：**接受之后必须同步进这一局的见证席名单** ——
 *     原来这里只改了 STATE.recruitApplicants 里那一条的 status，
 *     f.witnesses 完全没动。后果：
 *       ① 「已接受 N 位」永远停在接受前的数字（页面读的是 f.witnesses）；
 *       ② 档位永远不跟着变（档位按 f.witnesses 里 accepted 的人数定）；
 *       ③ 坑位数不涨（坑位是 accepted + pending 的合计）；
 *       ④ 见证席名单半屏里根本看不到这个被接受的人 ——
 *          数据说「他已是见证席」，名单里却没有他。
 *     —— 报名 → 接受 是进入见证席名单的**唯一入口**，
 *        所以这里必须把状态同步过去，而不是各算各的。
 *     —— 档位重算：档位按【已接受人数】定，接受一个人档位可能升档。
 *        筹备期还没结束（名单未冻结）时可以升；冻结后不升（档位定死）。
 * @param {string} id 报名者 id
 * @param {string} [flagId] 所属 Flag id（缺省取我当前占着的那个）
 */
function acceptApplicant(id, flagId) {
  const a = (STATE.recruitApplicants || []).find(x => x.id === id);
  if (!a || a.status === 'accepted' || a.status === 'declined') return false;
  a.status = 'accepted';
  /* 同步进该局的见证席名单 */
  const f = (flagId && findFlag(flagId)) || myActiveFlags()[0] || myMainFlag();
  if (f) {
    if (!Array.isArray(f.witnesses)) f.witnesses = [];
    const already = f.witnesses.some(w => w.id === a.id || w.name === a.name);
    if (!already) {
      f.witnesses.push({
        id: a.id, name: a.name, avatar: a.avatar, color: a.color,
        role: '见证席', status: 'accepted', verdict: null, joined: '刚刚',
        responseRate: a.rate, flagsWitnessed: a.flagsWitnessed, realName: true,
        fromRecruit: true,
      });
    }
    /* 档位重算：按【已接受人数】定档（筹备期未冻结时可升档） */
    const tier = tierByCount(witnessAccepted(f.witnesses));
    if (!witnessListFrozen(f)) f.tier = tier;
    if (!f.initialTier) f.initialTier = tier;
  }
  return true;
}

/** 拒绝一位报名者
 *  ⚠️ 2026-11-24（本轮）：同 acceptApplicant ——
 *     已接受 / 已拒绝的不能再改状态。 */
function declineApplicant(id) {
  const a = (STATE.recruitApplicants || []).find(x => x.id === id);
  if (!a || a.status === 'accepted' || a.status === 'declined') return false;
  a.status = 'declined';
  return true;
}

/* ============================================================
   见证席机制：筹备期 / 见证门槛 / 有效档位
   （见需求规格 R1.1 / R1.2.1 / R5.3 / R5.5）
   ============================================================ */

/** 筹备期剩余小时数（24h，见 R1.1） */
function prepHoursLeft(f) {
  if (!f || !f.prepEnd) return 0;
  // demo 用「发起当天」当今天，筹备期固定 24 小时
  const started = f.start || DEMO_TODAY;
  const left = PREP_HOURS - (daysBetween(started, DEMO_TODAY) * 24);
  return Math.max(0, Math.min(PREP_HOURS, left));
}

/** 筹备期剩余毫秒数 —— 真实时钟（见 R1.1 / D10.3.3）
 *  prepEndAt = 发起那一刻 + 24h，逐秒递减；到 0 即名单冻结、档位定死。
 *  种子数据没有 prepEndAt 时退回「按天估算」，保证页面永远有个可显示的数。 */
function prepRemainMs(f) {
  if (!f) return 0;
  if (f.prepEndAt) return Math.max(0, f.prepEndAt - Date.now());
  return prepHoursLeft(f) * 3600 * 1000;
}

/** 两个 ISO 日期之间相差几天 */
function daysBetween(a, b) {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  const da = new Date(pa[0], pa[1]-1, pa[2]);
  const db = new Date(pb[0], pb[1]-1, pb[2]);
  return Math.round((db - da) / 86400000);
}

/** 名单是否已冻结（筹备期结束，见 R1.3 / R5.5.3） */
function witnessListFrozen(f) {
  return prepHoursLeft(f) <= 0;
}

/**
 * 筹备期 → 进行中 的状态推进（见需求规格 R1.1 / R1.3）
 *
 * ⚠️ 2026-11-25（本轮修复）：**这条状态流转之前根本不存在** ——
 *    Flag 发起后 status 一直是 'prep'，永远没人把它改成 'running'。
 *    后果：
 *      ① 首页永远是「筹备期」的倒计时 + 招人形态 —— 24 小时过去了也不变；
 *      ② 打卡入口永远开不了（打卡页只在 running/ending 下能进）；
 *      ③ 名单永远不冻结（witnessListFrozen 靠 prepHoursLeft 判断，
 *         种子数据里 prepEnd 在过去 → 算是冻结了，但新建的局 prepEnd 在未来 → 永远不冻结）。
 *    —— 需求规格 R1.3 写得很清楚：
 *       「筹备期 24 小时结束 → 在途邀约作废 → 已接受名单锁定 → 档位定死 → Flag 生效」
 *    —— 所以这里补一个**幂等**的状态推进：
 *       筹备期到了（prepRemainMs <= 0）就把这一局推进到 running，
 *       并冻结名单、定死档位、作废在途邀约。
 *    —— 幂等是关键：render 每次都会调它，不能重复推进、不能重复扣分。
 *
 * @param {object} f Flag
 * @returns {boolean} 本次是否发生了推进
 */
function advancePrepToRunning(f) {
  if (!f || f.status !== 'prep') return false;
  /* ⚠️ 2026-11-25（本轮修复）：**只有走【立据流程】建的局才推进** ——
     判据是 f.prepEnd（立据时按「发起日 + 24 小时」算死）。
     —— 广场里那四个「招募中」的种子局（f_2 / f_8 / f_11 / f_17）
        只有 status:'prep' + recruiting 标记，**没有 prepEnd**（它们不是本局立出来的），
        它们是【别人家的局在招人】，永远处于筹备期 —— 不能被推进成「进行中」，
        否则广场的「招募中」视图就空了（招募窗口会立刻失效）。
     —— 没有 prepEnd → 不推进。 */
  if (!f.prepEnd) return false;
  /* 筹备期还没到 —— 不推进 */
  if (prepRemainMs(f) > 0) return false;
  /* ① 名单冻结：档位按【已接受人数】定死（待接受的邀约作废，不再计入） */
  const accepted = witnessAccepted(f.witnesses || []);
  const tier = tierByCount(accepted);
  f.tier = tier;
  f.initialTier = tier;
  f.effectiveTier = tier;
  /* ② 在途邀约作废 —— pending 的见证人不占坑位了 */
  (f.witnesses || []).forEach(w => {
    if (w.status === 'pending') w.status = 'expired';
  });
  /* ③ 状态推进 */
  f.status = 'running';
  f.statusText = '进行中';
  /* ④ 生效日 = 筹备期结束日 = 第 1 天 */
  if (f.prepEnd) f.start = f.prepEnd;
  /* ⑤ 节点状态：第一个节点进入「待打卡」，其余按计划 */
  if (Array.isArray(f.nodes) && f.nodes.length) {
    f.nodes = f.nodes.map((n, i) => (i === 0 ? { ...n, state: 'now', note: n.note || '待打卡' } : n));
    f.node = 'daily';
  }
  return true;
}

/**
 * 把所有「筹备中」的局推进一遍（render 时调，见 R1.3）
 * ⚠️ 幂等：只有 status === 'prep' 且筹备期已过的局会被推进，推进后就不再命中。
 * @returns {number} 本次推进的局数
 */
function syncFlagLifecycle() {
  let n = 0;
  const all = [];
  (STATE.myFlags || []).forEach(f => all.push(f));
  Object.keys(FLAGS || {}).forEach(id => { if (FLAGS[id]) all.push(FLAGS[id]); });
  all.forEach(f => { if (advancePrepToRunning(f)) n++; });
  return n;
}

/**
 * 某个判定节点的【判定汇总】（见需求规格 R2.26⑤）
 * —— 用户口径：「半框内展示：应判多少人、实判多少人，
 *   以及通过多少、存疑多少、作弊多少三项判定数量和判定时间；
 *   不展示具体是谁判定的。」
 *
 * ⚠️ 为什么这里要**推算**而不是读一个现成字段：
 *   demo 的种子数据里没有「每个节点有几票通过 / 几票存疑」这种字段
 *   —— 有的是「见证席名单 + 节点状态」。
 *   所以这里按【这一局实际的样子】推：
 *     · 应判多少人 = 这一局的见证席人数（冻结名册）
 *     · 实判多少人 = 已判定节点的见证席人数；未判定的节点 = 0
 *     · 通过 / 存疑 / 作弊 = 按节点状态 + 种子里的种子判定记录推
 *   —— 推出来的数字是**这局的样子**，不是随机的，
 *      这样点开半屏看到的数字和这一局在页面上的表现是一致的。
 *
 * @returns {{expected:number, judged:number, pass:number, doubt:number, cheat:number,
 *            time:string, state:string}}
 */
function verdictSummaryOf(f, node) {
  const ws = (f && f.witnesses) || [];
  const expected = ws.length;
  const st = node && node.state;
  /* 已判定的节点：应判 = 见证席人数，实判 = 同一批人（节点一旦判定就是全票收齐） */
  const judged = (st === 'done' || st === 'fail') ? expected : 0;
  /* 判定时间 = 节点日期 */
  const time = (node && node.date) ? shortDate(node.date) : '—';
  /* 通过 / 存疑 / 作弊 —— 按节点状态 + 备注判定 */
  let pass = 0, doubt = 0, cheat = 0;
  if (judged > 0) {
    const note = (node && node.note) || '';
    if (st === 'fail' || /未达标/.test(note)) {
      /* 判定不通过 —— 可能是「作弊成立」（整个 Flag 判负） */
      cheat = judged;
    } else {
      pass = judged;
    }
  }
  /* 「存疑」：节点在判定窗口内转了人工复核 —— 用 flags 上的复核状态判断 */
  const obj = (typeof objectionsOf === 'function') ? objectionsOf(f.id) : [];
  const rev = obj.find(o => o.node === (node && node.name) && o.status !== 'rejected');
  if (rev && judged > 0) {
    doubt = judged;
    pass = 0;
    cheat = 0;
  }
  return { expected, judged, pass, doubt, cheat, time, state: st || 'future' };
}

/** 应到人数 = 冻结名册人数（见 R5.3） */
function witnessExpected(f) {
  return (f.witnesses || []).filter(w => w.status === 'accepted').length;
}

/** 见证门槛（见 R5.3）：min(应到, max(2, ceil(应到×50%))) */
function witnessQuorumOf(f) {
  return witnessQuorum(witnessExpected(f));
}

/**
 * 节点档位 = tier(该节点实到人数)（见 R1.2.1）
 * 实到 = 通过 + 存疑 + 作弊；未响应不算
 */
function nodeTierByAttendance(attended) {
  return tierByCount(attended);
}

/**
 * 有效档位只降不升（见 R1.2.1）
 * 每个节点判定窗口关闭 → 有效档位 = min(有效档位, 节点档位)
 */
function applyTierDowngrade(f, attended) {
  const nodeTier = nodeTierByAttendance(attended);
  const before = f.effectiveTier || f.tier || 'T0';
  f.effectiveTier = tierMin(before, nodeTier);
  f.tier = f.effectiveTier;          // 对外展示的档位 = 有效档位
  return { before, nodeTier, after: f.effectiveTier };
}

/** 信用分系数：取有效档位的系数（见 R8.4） */
function effectiveCreditMul(f) {
  const tier = (f && (f.effectiveTier || f.tier)) || 'T0';
  return (TIER_META[tier] || TIER_META.T0).creditMul;
}

/**
 * 名单冻结后不能再加人（见 R5.5.3）
 * @returns {{ok:boolean, reason:string}}
 */
function canInviteWitness(f) {
  if (witnessListFrozen(f)) {
    return { ok:false, reason:'筹备期已结束，名单已冻结，不能再加人' };
  }
  if (witnessSlots(f.witnesses || []) >= WITNESS_MAX) {
    return { ok:false, reason:`坑位已满（${WITNESS_MAX} 个），等在途邀约过期或被拒绝后再说` };
  }
  return { ok:true, reason:'' };
}

/** 邀约是否已过期（12h，见 R5.5.2） */
function inviteExpired(w, now) {
  if (!w || !w.inviteAt) return false;
  return (now || DEMO_TODAY) >= w.inviteAt;
}

/* ============================================================
   异议（见需求规格 R4.3）
   ⚠️ 2026-11-24 用户口径：「为了让整个 demo 更接近真实的软件的使用的感觉……」
   —— 以前只能【投】异议，投完就没下文了 —— 但真实软件里，
      投完是有一段【等待期】的：票在攒，攒够 3 票转人工。
      所以这里补了异议的状态记录。

   —— 状态机：
      waiting（票在攒）→ reviewing（已转人工复核）→ passed（异议成立）/ rejected（不成立）
   ============================================================ */

/** 我提过的异议（按时间倒序） */
function myObjections() {
  return (STATE.objections || []).slice();
}

/** 某个 Flag 上的异议 */
function objectionsOf(flagId) {
  return (STATE.objections || []).filter(o => o.flagId === flagId);
}

/**
 * 投一条异议
 * @returns {{ok:boolean, reason:string}}
 */
function submitObjection(cfg) {
  const f = findFlag(cfg.flagId);
  if (!f) return { ok: false, reason: '找不到这个 Flag' };
  if (!STATE.objections) STATE.objections = [];
  /* 同一局满 3 次就不再计入统计（见需求规格 R4.3） */
  const mine = STATE.objections.filter(o => o.flagId === f.id && o.myVote);
  if (mine.length >= 3) return { ok: false, reason: '这一局最多提 3 次异议' };
  STATE.objections.unshift({
    id: 'ob' + (STATE.objections.length + 1),
    flagId: f.id,
    flagUser: f.user.name,
    node: cfg.node || '物证',
    day: cfg.day || f.checkedDays,
    reason: cfg.reason || '物证可疑',
    ts: cfg.ts || '刚刚',
    votes: 1, need: 3, myVote: true, status: 'waiting',
  });
  return { ok: true, reason: '' };
}

/**
 * 给一条异议投票（其他人）
 * —— 票够 3 票就转人工复核
 */
function voteObjection(id) {
  const o = (STATE.objections || []).find(x => x.id === id);
  if (!o) return false;
  if (o.myVote) return false;
  o.votes += 1;
  o.myVote = true;
  if (o.votes >= o.need) o.status = 'reviewing';
  return true;
}

/**
 * 记一次互动（点赞 / 留言）
 * ⚠️ 2026-11-24 用户口径：「成为见证席的理由，简化为累计完成 10 次互动就行了，
 *    点赞或留言。」
 * —— 互动是【成为见证席的唯一门槛】，所以它必须有一个**单一真相源**。
 * —— 只在被真正接受的互动上 +1（点赞被「今天已点过」拒绝时**不加**，
 *    空留言**不加**）。
 * @param {string} kind '点赞' | '留言'
 */
function addInteraction(kind) {
  STATE.interactions = (STATE.interactions || 0) + 1;
  STATE.interactionLog = STATE.interactionLog || [];
  STATE.interactionLog.unshift({ kind, ts: nowStamp() });
  return STATE.interactions;
}

/** 申请进入候选池 */
function applyToPool() {
  if (!canApplyToPool()) return false;
  STATE.poolApplied = true;
  STATE.inPool = true;
  return true;
}

/* ============================================================
   个人资料（⚠️ 2026-11-24 新增）
   —— 年龄 / 加入时间 / ID号 / 个性签名 / 所在省份。
   默认值在 data.js 的 ME.profile，用户改过的存在 STATE.profile 里。
   ============================================================ */

/** 读我的资料（合并默认值 + 用户改过的） */
function myProfile() {
  const base = ME.profile || {};
  const mine = STATE.profile || {};
  return {
    userCode: base.userCode || 'A7K3M9',   // ID号 —— 唯一且不可改
    age: mine.age != null ? mine.age : (base.age || 0),
    gender: mine.gender != null ? mine.gender : (base.gender || '保密'),
    joinedAt: base.joinedAt || '',          // 加入时间 —— 注册即固定，不可改
    bio: mine.bio != null ? mine.bio : (base.bio || ''),
    /* ⚠️ 2026-11-24 用户口径：「省份（不填默认中国）」——
       没填省份时展示「中国」，而不是空 —— 用户没填 ≠ 用户在国外，
       展示成「中国」更符合直觉（也更像主流社交产品的做法）。
       ⚠️ 注意口径：用户【主动清空】省份时（存了空串），要落到「中国」；
          只有【从没填过】才用默认值 —— 所以这里判的是「null/undefined」，
          不是「空字符串」（空字符串要能透传下去，再由下面兜底成中国）。 */
    province: (mine.province != null ? mine.province : base.province) || '中国',
  };
}

/** 改我的资料（只改可改的字段：年龄 / 性别 / 签名 / 省份） */
function updateMyProfile(patch) {
  const cur = myProfile();
  STATE.profile = Object.assign({}, STATE.profile || {}, {
    age: patch.age != null ? Number(patch.age) : cur.age,
    gender: patch.gender != null ? String(patch.gender) : cur.gender,
    bio: patch.bio != null ? String(patch.bio) : cur.bio,
    province: patch.province != null ? String(patch.province) : cur.province,
  });
  return myProfile();
}

/* ============================================================
   头像（⚠️ 2026-11-24 本轮新增，见需求规格 R2.30⑦）
   ------------------------------------------------------------
   「『我的』页面头像不能变更；需支持点击头像，弹出更换头像照片的操作按钮 / 入口。」

   —— 单一真相源：STATE.myAvatar = 图片地址（src）
      没换过就是 null —— 页面照旧用 ava(ME.name) 那套（Unsplash → pravatar → 本地矢量）。
   —— 为什么不用「随机换一张」那套头像池来模拟：
      用户看到自己的头像变了，但这个头像在**别人眼里**也应该是一致的
      （别人看我的主页，看到的是同一张）。所以这里存的是**真实的 src**，
      换过之后所有地方都用同一个 src。
   —— demo 里没有真实的相册 / 相机通道 ——
      所以「换头像」是：从内置的候选头像里挑一张（相当于选了张照片）。
      真实环境：chooseMedia → 上传 → 拿到 CDN 地址 → setMyAvatar(cdnUrl)。
   ============================================================ */

/** 我现在的头像地址（null = 没换过，用默认那套） */
function myAvatar() {
  return STATE.myAvatar || null;
}

/** 换成某个头像 */
function setMyAvatar(src) {
  if (!src) return null;
  STATE.myAvatar = src;
  return src;
}

/** 恢复默认头像 */
function resetMyAvatar() {
  STATE.myAvatar = null;
  return null;
}

/** 候选头像（demo 用的照片池 —— 真实环境是用户从相册里选） */
const AVATAR_OPTIONS = [
  'assets/checkin/ck01.jpg', 'assets/checkin/ck02.jpg', 'assets/checkin/ck03.jpg',
  'assets/checkin/ck04.jpg', 'assets/checkin/ck05.jpg', 'assets/checkin/ck06.jpg',
  'assets/life/lf01.jpg', 'assets/life/lf02.jpg', 'assets/life/lf03.jpg',
  'assets/life/lf04.jpg', 'assets/life/lf05.jpg', 'assets/life/lf06.jpg',
];

/** 我加入「亏了」多少天了（用加入时间算，demo 里以 DEMO_TODAY 为今天） */
function myDaysInApp() {
  const joined = (ME.profile && ME.profile.joinedAt) || '';
  if (!joined) return 0;
  const d = daysBetween(joined, DEMO_TODAY);
  return d > 0 ? d : 0;
}

/* ============================================================
   我的社交统计（点赞 / 留言 / 关注 / 见证）
   ⚠️ 2026-11-24 用户口径：「下面文字，点赞、留言、关注（是指用户被关注的数量）见证。」
   —— 这四个数是【我的个人档案数字】，跟下面那三块「我的 Flag 状态磁贴」是两回事：
      磁贴回答「我的局怎么样了」，这四个回答「我在这个社区里留下了什么」。
   ============================================================ */

/** 我的累计点赞数（我发的局被人点了多少赞） */
function myLikeCount() {
  return STATE.myFlags.reduce((s, f) => s + (likeCountOf(f.id) || 0), 0);
}

/** 我的累计留言数（我发的局收到的公开留言 + 我的回声） */
function myMsgCount() {
  return STATE.myFlags.reduce((s, f) => s + msgCountOf(f.id), 0);
}

/** 我被关注的人数（有多少人在「我关注的人」之外关注了我）
 *  ⚠️ demo 里没有「关注者」这个真实关系表 —— 用我关注的别人数做反向近似，
 *     再加一个固定的种子数，保证这个数字不是 0。 */
function myFollowerCount() {
  const pool = (WITNESS_POOL || []).length;
  return STATE.following.length + (pool ? 3 : 0);
}

/* ============================================================
   他人的社交统计（⚠️ 2026-11-24 新增）
   ⚠️ 「Ta 的主页」的资料卡要和「我的」页同一套形式（见需求规格 R2.20 ⑫），
      所以这些数也要能按【用户名】取。

   ⚠️ 2026-11-24 用户口径（最新）：
      · 「留言」这一格**删掉** —— 资料卡上三个数就够了：
        点赞 / 关注我 / 我见证过
      · 「关注」改叫「**关注我**」 —— 明确是「有多少人关注我」，
        不是「我关注了谁」（那两个方向完全相反）
      · 「见证」改叫「**我见证过**」 —— 讲的是「我当过见证席」这件事
   ============================================================ */

/** 某个用户收到的累计点赞数（他发的局被人点了多少赞） */
function userLikeCount(name) {
  return Object.values(FLAGS)
    .filter(f => f && f.user && f.user.name === name)
    .reduce((s, f) => s + (likeCountOf(f.id) || 0), 0);
}

/** 某个用户被关注的人数 */
function userFollowerCount(name) {
  const up = userProfile(name);
  return up ? (up.followers || 0) : 0;
}

/** 某个用户当过见证席的次数（= 他见证过的局数） */
function userWitnessCount(name) {
  const up = userProfile(name);
  return up ? (up.witnessFlags || 0) : 0;
}

/* ============================================================
   正在招募见证席的 Flag（⚠️ 2026-11-24 新增）
   ⚠️ 用户口径：「成为见证席以后，见证席面板应该展示目前正在招募见证的列表，
      可以选择参加」「『我的』页面『见证席面板』……列出招募中的 FLAG 就行。」

   —— 招人中的局 = 还在筹备期（名单冻结前）、见证席坑位没满的那些局。
      名单一冻结就锁死 —— 【不允许中途加入】（用户口径）。
   —— 我自己发起的局不在这里（我是发起人，不是来当见证席的）。
   ============================================================ */

/** 正在招募见证席的 Flag 列表（排除我自己的局）
 *  ⚠️ 2026-11-24（本轮）：筛选条件收紧为【筹备中】——
 *  原来是「进行中 or 筹备中」—— 但「进行中」的局早就开跑了，
 *  不可能在招人。筹备中 = 还没开跑 = 在招人，一一对应。
 *  —— 这也是本轮修正那四个种子的原因：它们原来是 running。 */
function recruitingFlags() {
  return Object.values(FLAGS)
    .filter(f => f && f.recruiting && !f.mine)
    .filter(f => f.status === 'prep')
    .sort((a, b) => (a.recruitEndAt || 0) - (b.recruitEndAt || 0));
}

/** 我已申请参加见证席的局 */
function myWitnessApplying() {
  return (STATE.witnessApplying || []).slice();
}

/* ---------- 招募倒计时（真实时钟） ----------
   ⚠️ 2026-11-24（本轮）：招募剩余时间原来是一句静态文字（「还剩 6 小时」）——
      静态文字做不了倒计时。倒计时必须有一个「到什么时候为止」的时间点。
   —— 这里从 recruitEndAt 算剩余毫秒，页面每秒递减。 */
function recruitRemainMs(f) {
  if (!f || !f.recruitEndAt) return 0;
  return Math.max(0, f.recruitEndAt - Date.now());
}
/** 剩余毫秒 → 「05:39」这种分:秒 */
function fmtRecruitRemain(ms) {
  if (ms <= 0) return '00:00';
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const p = n => String(n).padStart(2, '0');
  /* 超过一小时才显示小时位 —— 6 小时以内就 MM:SS，更紧凑 */
  return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}
/** 招募是否已截止（截止后这一局不再出现在招募列表里） */
function recruitClosed(f) {
  return recruitRemainMs(f) <= 0;
}

/* ============================================================
   广场的三个内容视图 + 真的能筛出结果的筛选（2026-11-24 本轮）
   ============================================================ */

/** 切换广场视图 */
function setSquareView(v) {
  STATE.squareView = (v === 'follow' || v === 'recruit') ? v : 'rec';
}

/** 当前广场视图 */
function squareView() {
  return STATE.squareView || 'rec';
}

/** 设置广场筛选条件（key: status / days / tier） */
function setSquareFilter(key, val) {
  if (!STATE.sqFilter) STATE.sqFilter = { status: 'all', days: 'all', tier: 'all' };
  STATE.sqFilter[key] = val;
}

/** 清空筛选 */
function clearSquareFilter() {
  STATE.sqFilter = { status: 'all', days: 'all', tier: 'all' };
}

/** 筛选是不是全空（全空就显示「全部」） */
function squareFilterEmpty() {
  const f = STATE.sqFilter || {};
  return f.status === 'all' && f.days === 'all' && f.tier === 'all';
}

/**
 * 当前视图下、符合筛选条件的 Flag 列表
 * —— 三个视图各给一份底稿，再统一过筛选：
 *    'rec'     → 广场推荐流（FEED 顺序）
 *    'follow'  → 我关注的人正在跑的局
 *    'recruit' → 正在招募见证席的局
 */
function squareFilteredFlags() {
  const view = squareView();
  let list;
  if (view === 'follow') {
    list = myFollowingFlags();
  } else if (view === 'recruit') {
    list = recruitingFlags();
  } else {
    list = FEED.map(id => FLAGS[id]).filter(Boolean);
  }
  return applySquareFilter(list);
}

/** 按筛选条件过滤一份 Flag 列表 */
function applySquareFilter(list) {
  const f = STATE.sqFilter || { status: 'all', days: 'all', tier: 'all' };
  return list.filter(flag => {
    if (!flag) return false;
    /* 状态 */
    if (f.status !== 'all') {
      if (f.status === 'running' && flag.status !== 'running' && flag.status !== 'ending' && flag.status !== 'prep') return false;
      if (f.status === 'ending' && flag.status !== 'ending') return false;
      if (f.status === 'broken' && flag.status !== 'broken') return false;
      if (f.status === 'ended' && flag.status !== 'success' && flag.status !== 'failed') return false;
    }
    /* 周期 */
    if (f.days !== 'all' && String(flag.days) !== String(f.days)) return false;
    /* 见证席强度 */
    if (f.tier !== 'all' && flag.tier !== f.tier) return false;
    return true;
  });
}

/** 筛选条件的可读描述（给导航栏上的小标签用） */
function squareFilterLabel() {
  const f = STATE.sqFilter || {};
  const bits = [];
  const stMap = { running: '进行中', ending: '即将结算', broken: '已断卡', ended: '已结束' };
  if (f.status !== 'all') bits.push(stMap[f.status] || f.status);
  if (f.days !== 'all') bits.push(f.days + ' 天');
  if (f.tier !== 'all') bits.push(f.tier);
  return bits.join(' · ');
}

/** 我是否已经申请过这个局 */
function witnessApplying(id) {
  return (STATE.witnessApplying || []).indexOf(id) >= 0;
}

/** 我申请参加的局数 */
function witnessApplyingCount() {
  return (STATE.witnessApplying || []).length;
}

/** 申请参加一个正在招募的局
 *  @return {string} 'ok' 成功 / 'max' 已达上限 / 'dup' 重复申请 / 'closed' 已不在招募
 */
function applyJoinWitness(flagId) {
  const f = findFlag(flagId);
  if (!f || !f.recruiting) return 'closed';
  if (witnessApplying(flagId)) return 'dup';
  if (witnessApplyingCount() >= WITNESS_JOIN_MAX) return 'max';
  STATE.witnessApplying = (STATE.witnessApplying || []).concat([flagId]);
  return 'ok';
}

/* ---------- 变更器 ---------- */

/** 新建一个 Flag */
function addMyFlag(cfg) {
  const id = 'f_new_' + (STATE.myFlags.length + 1) + '_' + Date.now().toString(36).slice(-4);
  const days = cfg.days || 30;
  const start = cfg.start || '2026-11-16';
  // 筹备期 24 小时（见需求规格 R1.1）：发起日 + 24h = 生效日 = 第 1 天
  const prepEnd = isoAddDays(start, 1);
  // 真实时钟的筹备期截止时刻 —— 页面倒计时逐秒递减用（见 D10.3.3）
  const prepEndAt = Date.now() + PREP_HOURS * 3600 * 1000;
  // 结束日 = 生效日 + (周期 - 1) 天（见需求规格 R1.1：结束日由周期算死，不可自定义）
  const endD = new Date(start);
  endD.setDate(endD.getDate() + days);
  const end = endD.toISOString().slice(0, 10);
  // 节点计划按周期写死（见需求规格 R5.4）：7天2个 / 14天3个 / 30天4个 / 90天4个
  const plan = NODE_PLAN[days] || NODE_PLAN[30];
  const names = NODE_NAMES[days] || NODE_NAMES[30];
  const nodeList = plan.map((day, i) => {
    const d = new Date(prepEnd);
    d.setDate(d.getDate() + day - 1);
    const iso = d.toISOString().slice(0, 10);
    const isFirst = i === 0, isLast = i === plan.length - 1;
    return {
      name: names[i], date: iso,
      state: isFirst ? 'now' : 'future',
      note: isFirst ? '待打卡' : '',
    };
  });

  // 见证席名单：带状态（见 R5.5）；初始档位按「已接受」人数定
  // ⚠️ 种子里的 WITNESSES 用的是展示态文案（'已判定'），这里统一归一到状态机取值
  const STATUS_ALIAS = { '已判定':'accepted', '已接受':'accepted', '待接受':'pending' };
  const witnesses = (cfg.witnesses || []).map(w => ({
    ...w,
    status: STATUS_ALIAS[w.status] || w.status || 'accepted',
  }));
  const initialTier = tierByCount(witnessAccepted(witnesses));

  const flag = {
    id, mine: true,
    user: { name: ME.name, avatar: ME.avatar, color: '#FF6B00' },
    title: cfg.title || '我还没写目标',
    reason: cfg.reason || '',
    startWeight: Number(cfg.startWeight) || 0,
    curWeight: Number(cfg.startWeight) || 0,
    targetWeight: Number(cfg.targetWeight) || 0,
    start, prepEnd, prepEndAt, end, days,
    createdAt: Date.now(),   // 立据时刻（立据页显示「立据时间」，见 D10.3.3）
    status: 'prep', statusText: '筹备中',
    tier: initialTier,
    initialTier,          // 24h 定档时的初始档位
    effectiveTier: initialTier,  // 有效档位：只降不升（见 R1.2.1）
    deposit: cfg.deposit || 0,
    /* ⚠️ 押金「原值」—— 结算后 f.deposit 会被清零（失败 / 取消后 = 0），
       但详情页要显示「这局当时押了多少钱」。所以原值单独存一份。 */
    depositPaid: cfg.deposit || 0,
    /* ⚠️ 押金为 0 的标记（首次免费，见需求规格 R10.4）
       这个局的押金是 0，但**照常产生全部分值** —— 它是新人礼，不是「不加分」的体验档。
       必须单独存一个字段：押金在结算后会被清零（失败/取消后 f.deposit = 0），
       只看 deposit 就分不清「本来就是首次免费」和「已经结算完了」。 */
    zeroDeposit: (cfg.deposit || 0) === 0,
    checkedDays: 0, totalDays: days, streak: 0, breaks: 0,
    witnesses,
    supervisorCount: 0,
    node: 'daily',
    history: [],
    nodes: nodeList,
    msgs: [], quote: '',
  };

  STATE.myFlags.unshift(flag);
  STATE.checkinLogs[id] = [];

  return flag;
}

/**
 * 今天是否已经打过卡（首页「今天已打卡 / 今天还没打卡」用）
 * ⚠️ 2026-11-23 用户口径：「首页中，当提交当日打卡以后，『今天没打卡』要改为已打卡，
 *    目前是不会动态变动的。」—— 所以首页的文案必须跟着打卡动作实时变。
 * 判定口径（按优先级）：
 *   1. f.checkedOn === 今天 —— doCheckin 提交时写下的显式标记（最准）
 *   2. 兜底：history 里「今天那一格」是打卡成功（ok !== false）
 */
function checkedToday(f) {
  if (!f) return false;
  if (f.checkedOn && f.checkedOn === DEMO_TODAY) return true;
  if (!f.start) return false;
  const day = daysBetween(f.start, DEMO_TODAY) + 1;
  if (day < 1) return false;
  const hit = (f.history || []).find(h => h && h.d === day);
  return !!(hit && hit.ok !== false);
}

/* =========================================================
   刚刚也发了的人（真实数据驱动）—— 见 R2.21 ⑭
   ---------------------------------------------------------
   ⚠️ 2026-11-24（本轮）：这一块原来写死了三个人名和体重
      （阿May 56.1kg / 小美 67.4kg / 阿凯 64.6kg），而且每行点不动。
      —— 56.1 / 67.4 恰好是用户前面几轮明确要求删掉的数字。
      —— 打卡成功后这一屏是用户最有成就感的一刻，
         在最该真实的地方放假数据，恰恰是最伤的地方。

   —— 现在改成扫【所有别人的局】，挑出今天真的打卡成功的：
      ① 判断口径 = checkedToday()（跟首页「今天已打卡」同一套逻辑）
      ② 第几天   = 开始日期到今天的天数（跟详情页日历同一口径）
      ③ 今天体重 = 该局最新一次打卡记录里的体重（跟日历读同一份）
      ④ 排序     = 打卡时间倒序，越晚打的越前
      ⑤ 每一行都真的能点进去（进那个人的目标详情页）

   —— 没有真实数据时整块不显示 —— 空列表比假数据诚实。
   ============================================================ */

/** 取一个局今天的打卡记录（没有就返回 null） */
function todayCheckinOf(f) {
  if (!f || !f.start) return null;
  const day = daysBetween(f.start, DEMO_TODAY) + 1;
  if (day < 1) return null;
  const hit = (f.history || []).find(h => h && h.d === day && h.ok !== false);
  return hit ? { day, rec: hit } : null;
}

/**
 * 别人（广场里的）这个局今天打了卡没有
 * ⚠️ 为什么不能用 checkedToday()：
 *    checkedToday() 依赖 f.history 里「今天那一格」——
 *    但广场里别人的局，history 大多是空的（种子只给了 checkedDays），
 *    所以 checkedToday 对它们一律返回 false —— 会让这一块永远空着。
 * —— 这里的口径跟【打卡日历】完全一致（见 calCalendar）：
 *    第几天 ≤ checkedDays → 打了；history 里那天标了断卡 → 没打。
 */
function othersCheckedToday(f) {
  if (!f || !f.start) return false;
  const day = daysBetween(f.start, DEMO_TODAY) + 1;
  const total = f.totalDays || f.days || 0;
  if (day < 1 || day > total) return false;
  const hist = (f.history || []).find(h => h && h.d === day);
  if (hist && hist.ok === false) return false;
  return day <= (f.checkedDays || 0);
}

/**
 * 一个局【最近一次打卡】是第几天
 * ⚠️ 口径跟日历一致：
 *   ① history 里最后一条打卡成功的天（优先，它带真实体重）
 *   ② 没有 history 就用 checkedDays（种子数据的进度）
 * @returns {number} 0 = 一次都没打过
 */
function lastCheckinDayOf(f) {
  if (!f) return 0;
  const hist = (f.history || []).filter(h => h && h.d && h.ok !== false);
  if (hist.length) return Math.max.apply(null, hist.map(h => h.d));
  return f.checkedDays || 0;
}

/** 一个局当前最新一次打卡记录的体重（详情页日历读的是同一份数据） */
function latestWeightOf(f) {
  if (!f) return null;
  const list = photosOf(f) || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    if (p && p.st !== 'miss' && p.w != null) return p.w;
  }
  const hist = (f.history || []).filter(h => h && h.ok !== false && h.w != null);
  if (hist.length) return hist[hist.length - 1].w;
  return f.curWeight != null ? f.curWeight : null;
}

/**
 * 「刚刚也发了的人」—— 扫所有别人的局，挑出**最近刚打卡**的那几个
 *
 * ⚠️ 为什么口径是「社区里最近一次打卡」而不是死抠「今天」：
 *    demo 里社区的进度各不相同 —— 有的局今天打了、有的昨天打了、
 *    有的还差一天。如果硬按「今天打卡」筛，很可能一个人都筛不出来，
 *    这一块就永远是空的（空列表虽然诚实，但作为氛围块就白做了）。
 *    —— 所以口径改成【社区里最近的那次打卡】：
 *       谁的最近一次打卡最靠后，就排最前。
 *    —— 这依然是【真实数据】：天数、体重都是从那个局的打卡记录里读出来的，
 *       点进去能对上；只是「刚刚」的参照系是社区，而不是日历的今天。
 *
 * @returns {Array<{id:string, name:string, day:number, weight:number|null, title:string}>}
 */
function recentCheckinFeed(limit) {
  const n = limit || 3;
  const out = [];
  const ids = (typeof FEED !== 'undefined' && FEED.length)
    ? FEED.slice()
    : Object.keys(FLAGS).filter(k => !FLAGS[k].mine);
  ids.forEach(id => {
    const f = FLAGS[id];
    if (!f || f.mine) return;                 // 只看别人的局
    if (f.status !== 'running' && f.status !== 'ending') return;
    const last = lastCheckinDayOf(f);
    if (last < 1) return;                     // 一次都没打过卡的不要
    /* 今天打过卡的排在最前 —— 它是字面意义上的「刚刚」 */
    const todayHit = othersCheckedToday(f);
    out.push({
      id: f.id,
      name: f.user ? f.user.name : '',
      day: todayHit ? daysBetween(f.start, DEMO_TODAY) + 1 : last,
      weight: latestWeightOf(f),
      title: f.title || '',
      todayHit,
    });
  });
  /* 排序：今天打的排最前 → 其次按最近打卡的天数倒序 → 再按 id 稳定排序 */
  out.sort((a, b) =>
    (b.todayHit - a.todayHit) || (b.day - a.day) || (a.id < b.id ? -1 : 1));
  return out.slice(0, n);
}

/** 完成一次打卡
 *  ⚠️ 2026-11-24（本轮修复）：原来这里**没有「今天已经打过卡」的拦截** ——
 *     打卡页的按钮只看「有没有拍照」，不看来没来过。
 *     结果：打卡 → 返回 → 再进打卡页 → 再拍一张 → 再提交，
  *     checkedDays 会 +2、streak 虚增、信用分里程碑（每满 7 天 +1）能被刷。
 *  —— 现在开头就挡掉：同一天只能打一次卡。
 *  @returns {null|{ok:false, reason:string}} 返回 {ok:false} 表示被拦下了
 */
function doCheckin(flagId, weight) {
  const f = FLAGS[flagId] || myMainFlag();
  if (!f) return null;
  /* ⚠️ 同一天不能重复打卡 —— 见上面的说明 */
  if (checkedToday(f)) return { ok: false, reason: '今天已经打过卡了' };
  const w = weight ? Number(weight) : f.curWeight;

  f.checkedDays = Math.min(f.totalDays, f.checkedDays + 1);
  f.streak += 1;
  f.curWeight = w;
  /* ⚠️ 2026-11-23：显式记下「今天打过卡」—— 首页据此把「今天还没打卡」改成「今天已打卡」 */
  f.checkedOn = DEMO_TODAY;
  f.history = f.history || [];
  f.history.push({ d: f.checkedDays, w, ok: true });

  const logs = STATE.checkinLogs[flagId] || (STATE.checkinLogs[flagId] = []);
  logs.push({
    d: f.checkedDays,
    date: (f.start ? f.start.slice(5) : '').replace('-', '/'),
    w, state: 'done', ai: '查重通过',
  });

  // 信用分：打卡每满 7 天 +1（见需求规格 8.1.5）—— 不是每天 +1
  {
    const milestone = Math.floor(f.streak / 7);
    const done = f.creditMilestone || 0;
    if (milestone > done) {
      f.creditMilestone = milestone;
      f.justMilestone = true;
      addCredit(+1, '连续打卡 ' + f.streak + ' 天', '打卡里程碑');
    }
  }

  return f;
}

/* ============================================================
   断卡与补卡（见需求规格 第九节）
   ============================================================ */

/**
 * 判断某个 Flag 现在是否处于「可补卡」状态。
 * 规则（9.5）：打卡日 + 12 小时内可补打昨天/前天的卡。
 *
 * ⚠️ 关键：补卡发生在「断卡被记录之前」—— 12 小时内还没打，就还没算断卡。
 *    所以【额度用完（left === 0）时依然可以补卡】，而且这恰恰是最该补的时候：
 *    额度用完的用户如果再断一次就结束了，补卡能把他救回来。
 * @returns {{ok:boolean, reason:string, days:number, limit:number}}
 */
function makeupState(f) {
  if (!f) return { ok:false, reason:'找不到这个 Flag', days:0, limit:0 };
  if (f.status !== 'running' && f.status !== 'ending') return { ok:false, reason:'这个 Flag 已经结束了', days:0, limit:0 };
  const limit = breakLimitOf(f.totalDays || f.days || 30);
  const left = Math.max(0, limit - (f.breaks || 0));
  // ⚠️ 不因为 left === 0 而拒绝补卡 —— 见上方说明
  return { ok:true, reason:'12 小时内可补卡', days:left, limit };
}

/* ============================================================
   补卡窗口（⚠️ 2026-11-24 用户口径新增）
   ------------------------------------------------------------
   「最上面的断卡提醒，应该是几月几日未打卡，给用户一个按钮，点击补卡，
     并且做 12 小时倒计时。」

   —— 之前「补卡」是一个【无条件可点】的按钮（详情页断卡卡下面），
      没有说「你还有多久能补」。现在补卡变成一个【有时限的动作】：
      漏打卡之后 12 小时内可以补，超过 12 小时就真的算断卡了。

   —— 所以这里需要两个字段：
        missedOn  哪一天漏了（ISO 日期）—— 用户要知道「几月几日未打卡」
        makeupEndAt  补卡窗口的截止时刻（时间戳）—— 倒计时用
   ============================================================ */

/** 补卡窗口时长（小时）—— 与 BREAK_RULES.makeupWindowHours 同一个口径 */
function makeupWindowHours() {
  return BREAK_RULES.makeupWindowHours || 12;
}

/**
 * 这局当前有没有「待补卡」—— 今天还没打卡、且昨天（或更早）漏了
 * ⚠️ 判定口径：
 *   ① Flag 还在跑
 *   ② **今天还没打卡**（checkedToday 为假）—— 今天还没打，就还有补卡机会
 *   ③ 已经漏过卡了（有 missedOn），或者昨天就没打
 * @returns {{state:'none'|'open'|'expired', missedOn:string|null, endAt:number, remainMs:number}}
 *          state='open'    → 12 小时窗口内，还能补
 *          state='expired' → 超窗了，这次漏卡已经算断卡
 *          state='none'    → 没有漏卡（或今天已经打了）
 */
function makeupWindow(f, opt) {
  const none = { state:'none', missedOn:null, endAt:0, remainMs:0 };
  if (!f) return none;
  if (f.status !== 'running' && f.status !== 'ending') return none;
  /* 今天已经打了 —— 默认「没有补卡这回事」。
     ⚠️ 但 R3.5 允许「今日打卡与补卡并行」，
        所以数据层校验（doMakeup）需要的是【窗口本身】而不是【UI 入口状态】，
        用 {ignoreToday:true} 跳过这条判断。 */
  if (!(opt && opt.ignoreToday) && checkedToday(f)) return none;

  /* 漏卡的日期：优先用显式标记，否则从 history 里找最近一个【还没被记成断卡】的日子 */
  let missedOn = f.missedOn || null;
  if (!missedOn && f.history && f.history.length) {
    for (let i = f.history.length - 1; i >= 0; i--) {
      const h = f.history[i];
      /* ⚠️ 只认还没记成断卡的那一条 —— 已经 doBreak() 记过的不能再算「待补卡」 */
      if (h && h.ok === false && h.d && !h.broken) { missedOn = h.date || null; break; }
    }
  }
  /* 兜底：昨天没打卡 = 漏了昨天 */
  if (!missedOn && f.start) {
    const day = daysBetween(f.start, DEMO_TODAY) + 1;
    if (day >= 2) missedOn = isoAddDays(DEMO_TODAY, -1);
  }
  if (!missedOn) return none;

  /* 截止时刻：f.makeupEndAt（真实时钟），没有就按「漏卡那天 24:00 + 12 小时」估算 */
  let endAt = Number(f.makeupEndAt || 0);
  if (!endAt) endAt = makeupEndAtOf(missedOn);
  const remainMs = Math.max(0, endAt - Date.now());
  /* 超窗 → 窗口关闭（真断卡了） */
  if (remainMs <= 0) return { state:'expired', missedOn, endAt, remainMs:0 };
  return { state:'open', missedOn, endAt, remainMs };
}

/**
 * 补卡窗口的截止时刻（毫秒时间戳）
 * ⚠️ 2026-11-24：demo 的「今天」是固定日期（2026-11-16），真实时钟早就走过去了。
 *    如果按固定日期算「昨天 24:00 + 12 小时」，算出来的截止时刻永远是「已过期」，
 *    倒计时就没得看了。
 *    所以当**没有显式给 makeupEndAt** 时，锚在【真实现在】上：
 *    「昨天漏了，窗口还剩 12 小时」—— 演示时能看到它在走。
 */
function makeupEndAtOf(missedOn) {
  if (!missedOn) return 0;
  const p = String(missedOn).split('-').map(Number);
  if (p.length !== 3 || isNaN(p[0])) return 0;
  /* demo 的「今天」和真实时钟差得远时，用真实时钟兜底 */
  const demoMidnight = new Date(p[0], p[1]-1, p[2], 24, 0, 0).getTime();
  const drift = Date.now() - demoMidnight;
  if (Math.abs(drift) > 86400000) return Date.now() + makeupWindowHours() * 3600 * 1000;
  return demoMidnight + makeupWindowHours() * 3600 * 1000;
}

/**
 * 断卡状态汇总（目标详情页「断卡情况」用）
 * ⚠️ 2026-11-24 用户口径：「如果超过了 12 小时还没有补卡，
 *    目标详情页这里的『断卡情况』，要能体现出来，可以用 1/3 表示。」
 * —— 所以这里把【已断次数 / 额度】算清楚，并且把「超窗未补」的那一次**算进去**
 *    （超窗那一刻它就是一次断卡，只是还没走 doBreak()）。
 * @returns {{limit:number, used:number, left:number, expired:boolean, pending:boolean, missedOn:string|null}}
 */
function breakStatusOf(f) {
  const limit = breakLimitOf(f.totalDays || f.days || 30);
  const mw = makeupWindow(f);
  /* 已记进 f.breaks 的断卡 */
  const recorded = f.breaks || 0;
  /* 超窗未补的那一次，也要算数 —— 否则详情页会少显示一次断卡 */
  const pendingCount = (mw.state === 'expired') ? 1 : 0;
  const used = recorded + pendingCount;
  const left = Math.max(0, limit - used);
  return {
    limit, used, left,
    expired: mw.state === 'expired',
    pending: mw.state === 'open',
    missedOn: mw.missedOn,
  };
}

/** 补卡窗口还剩多少（人话） */
function makeupRemainText(ms) {
  if (ms <= 0) return '已过期';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `还剩 ${h} 小时 ${m} 分`;
  if (m > 0) return `还剩 ${m} 分钟`;
  return '还剩不到 1 分钟';
}

/** 「11 月 15 日」这种短日期 */
function shortDate(iso) {
  if (!iso) return '';
  const p = String(iso).split('-').map(Number);
  if (p.length !== 3 || isNaN(p[0])) return iso;
  return `${p[1]} 月 ${p[2]} 日`;
}

/**
 * 补卡：补上昨天的卡。
 * ⚠️ 补卡只影响「连续性」，不影响打卡天数、押金扣收、信用分（见 9.6）
 * ⚠️ 补卡不给「连续打卡里程碑」（连续性已被破坏）
 * ⚠️ 2026-11-24（本轮）：补卡页 = 今日打卡页的**另一种模式**（见 R2.30②），
 *    所以这个函数现在接收**明确的天序号**（targetDay）——
 *    打卡照 / 心情 / 生活照都落到那一天，跟打卡一样。
 * @param {string} flagId
 * @param {number} weight
 * @param {number} [targetDay] 补的是第几天（默认 = 上次打卡天数 + 1）
 */
function doMakeup(flagId, weight, targetDay) {
  const f = FLAGS[flagId] || myMainFlag();
  if (!f) return null;
  const st = makeupState(f);
  if (!st.ok) return null;
  /* ⚠️ 2026-11-25（本轮修复）：补卡必须校验【12 小时窗口】——
     原来这里只查 makeupState()（它只查状态，不查时间），
     导致：用户在打卡页停留超过 12 小时后点「补上这张卡」，
     补卡照样成功 —— 违反 R3.5「超过 12 小时就算断卡」的硬规则。
     —— 补卡是【有时间闸门】的动作，闸门必须落在【写数据的这一层】，
        不能只靠 UI 入口拦（入口拦不住「页面开着不动」这种情况）。
     —— 超窗 = 这次算断卡，不能再补。 */
  const mw = makeupWindow(f, { ignoreToday: true });
  if (mw.state === 'expired') return { ok: false, reason: '12 小时已过，这次算断卡了' };

  const w = weight ? Number(weight) : f.curWeight;
  /* ⚠️ 补的是【漏掉的那一天】—— 不是「上次打卡天数 + 1」——
     漏卡可能漏了好几天（漏的那天还没补上，后面又漏了一天）。
     补的是最早那个还没补上的坑。 */
  const day = Number(targetDay) || (f.checkedDays + 1);
  /* ⚠️ 2026-11-25（本轮修复）：打卡天数不能虚增 ——
     原来这里是 `Math.max(f.checkedDays + 1, day)`：
     漏卡日为第 5 天、checkedDays=3 时 → max(4,5)=5，
     【只补了 1 张卡，打卡天数却 +2】——
     结果详情页显示「5/30 天」，日历上却只有 4 格是已打卡，自相矛盾。
     —— 正确口径：打卡天数 = 「已打卡的天数」，必须等于日历上「已打卡」的格数。
        补一天 → 天数 +1（不管这天是第几天）。
        补的那天是第几天（day）只影响【日历上落在哪一格】。 */
  const before = f.checkedDays || 0;
  f.checkedDays = Math.min(f.totalDays, before + 1);
  f.curWeight = w;
  f.history = f.history || [];
  f.history.push({ d: day, w, ok: true, makeup: true });

  const logs = STATE.checkinLogs[flagId] || (STATE.checkinLogs[flagId] = []);
  logs.push({
    d: day,
    date: (f.start ? f.start.slice(5) : '').replace('-', '/'),
    w, state: 'done', ai: '查重通过 · 补卡', makeup: true,
  });
  /* ⚠️ 2026-11-24：补完卡，补卡窗口关闭（不再提醒） */
  f.missedOn = null;
  f.makeupEndAt = 0;
  return f;
}

/**
 * 记一次断卡（超过 12 小时没打卡）。
 * ⚠️ 断卡不等于失败 —— 只有次数【超过】上限才判负（见 9.2）
 * @returns {{failed:boolean, left:number, level:string}}
 */
function doBreak(flagId) {
  const f = FLAGS[flagId] || myMainFlag();
  if (!f) return null;
  f.breaks = (f.breaks || 0) + 1;
  f.streak = 0;                                  // 软惩罚①：连续天数归零

  const limit = breakLimitOf(f.totalDays || f.days || 30);
  const used = f.breaks;
  const left = Math.max(0, limit - used);
  // ⚠️ 失败条件是「超过上限」（used > limit），不是「用满了」（left === 0）
  //    limit=1 时：断第 1 次 → used=1 ≤ 1 → 不失败；断第 2 次 → used=2 > 1 → 失败
  const failed = used > limit;

  // 软惩罚④：中期到账那笔不给（该时点前断过卡 → 这笔不发，已给的保留）
  f.midPaid = false;

  let level = 'warn';
  if (failed) {
    // 次数超出上限 → 立即判负
    f.status = 'failed';
    f.statusText = '未达标';
    f.failedReason = '断卡次数用尽';
    f.deposit = 0;
    level = 'dead';
  } else if (left === 0) {
    level = 'danger';                            // 软惩罚：预警（9.4）
  }

  f.history = f.history || [];
  f.history.push({ d: f.checkedDays, w: null, ok: false, note: '断卡' });

  return { failed, left, level, limit };
}
function addCredit(delta, desc, title){
  const r = applyCredit(STATE.credit, delta);
  STATE.credit = r.value;
  STATE.creditLogs = STATE.creditLogs || [];
  STATE.creditLogs.unshift({ t: title || '信用分变化', d: desc, v: delta, ts: nowStamp().slice(0, 5) });
  return r.value;
}


/** 见证席节点判定结算：按节点计分，且受每周 +8 上限约束
 *  ⚠️ 2026-11-22：首次免费（押金 0 元）的局**照常计分** ——
 *     它是新人礼，不是「不加分」的体验档。 */
function addWitnessCredit(kind, desc, flagId){
  const raw = creditWitnessValue(kind);
  // 只有正向加分受每周上限约束，扣分不受限
  if (raw > 0) {
    const used = STATE.witnessWeekCredit || 0;
    const room = Math.max(0, CREDIT_WITNESS.weeklyCap - used);
    if (room <= 0) {
      STATE.creditLogs = STATE.creditLogs || [];
      STATE.creditLogs.unshift({ t: '见证判定', d: desc + '（本周见证加分已满 ' + CREDIT_WITNESS.weeklyCap + '，本周不计分）', v: 0, ts: nowStamp().slice(0, 5) });
      return STATE.credit;
    }
    const give = Math.min(raw, room);
    STATE.witnessWeekCredit = used + give;
    addCredit(give, desc, '见证判定');
    return STATE.credit;
  }
  addCredit(raw, desc, '见证判定');
  return STATE.credit;
}

/** 订阅一个 Flag */
function subscribeFlag(id) {
  if (STATE.subscribed.includes(id)) return false;
  STATE.subscribed.unshift(id);
  return true;
}

function unsubscribeFlag(id) {
  const i = STATE.subscribed.indexOf(id);
  if (i >= 0) STATE.subscribed.splice(i, 1);
}

/** 是否已监督这一局 —— 目标详情页的按钮据此在「监督这一局 / 已监督」之间切换 */
function isSubscribed(id) {
  return !!id && STATE.subscribed.includes(id);
}

/**
 * 目标人回声：回复一条留言（见需求规格 3.5.1）
 * ⚠️ 铁律④：回声是终点 —— 每条留言只能有一条回声，回声不可被回复
 * ⚠️ 回声内容对所有人可见（动态流），但留言原文仍然只有目标人可见
 */
function replyToMsg(flagId, msgIdx, text) {
  const f = findFlag(flagId);
  if (!f || !f.msgs || !f.msgs[msgIdx]) return null;
  const m = f.msgs[msgIdx];
  if (m.reply) return null;                    // 一条留言只能回一次
  const t = String(text || '').trim().slice(0, 30);
  if (!t) return null;
  m.reply = { text: t, time: '刚刚' };
  // 同步写入动态流（所有人可见）
  activityOf(f).unshift({ type:'echo', who:ME.name, text:t, time:'刚刚' });
  return m.reply;
}

/** 留言者回复目标人的回声 —— ⛔ 铁律④：不存在此路径，这里是为了把边界写死 */
function replyToEcho() {
  return null;
}

/* ============================================================
   公开留言（2026-11-23 用户口径：留言改为公开可见）
   ⚠️ 口径反转：
      原来 —— 留言【仅目标人可见】，围观者之间互相看不见（匿名但计数）；
      现在 —— 留言【所有人可见】，而且要展示【头像 + 名称 + 日期 + 正文】，
              每条留言还有【自己的点赞按钮】。
   ============================================================ */

/**
 * 公开留言的种子（按 Flag）
 * ⚠️ 结构：
 *   { id, name, text, ts, likes }
 *   - ts    = 排序用的时间戳（数字，越大越新）—— 展示时格式化成「日期」
 *   - likes = 这条留言自己的点赞数（**独立于 Flag 的点赞**，互不影响）
 *   - liked = 我有没有点过这条（我只能点一次）
 */
const MSG_SEEDS = {
  f_3: [
    { id:'m1', name:'林一',   text:'第 20 天那次断卡看得我心慌，还好你回来了', ts: 100, likes: 12 },
    { id:'m2', name:'果果',   text:'这个体脂曲线比我自己的还好看',                 ts: 90, likes: 8  },
    { id:'m3', name:'阿凯',   text:'备孕前先把指标拉回来，这事值得认真做',           ts: 80, likes: 5  },
    { id:'m4', name:'苏晴',   text:'第 40 天开始每天两杯咖啡，扛住',               ts: 70, likes: 3  },
  ],
  f_1: [
    { id:'m1', name:'大壮',   text:'赌一顿火锅这个理由我笑了',                     ts: 100, likes: 15 },
    { id:'m2', name:'苏晴',   text:'58.2 到 55，30 天减 3 公斤很稳',                ts: 60, likes: 6  },
  ],
  f_6: [
    { id:'m1', name:'陈默',   text:'戒糖 14 天，我赌你第 10 天会破戒',              ts: 100, likes: 9 },
    { id:'m2', name:'钱朵',   text:'等着看体重秤 —— 我赌它不动',                    ts: 50, likes: 4  },
  ],
  f_9: [
    { id:'m1', name:'何瑜',   text:'备孕减脂有人一起才走得远',                     ts: 100, likes: 22 },
    { id:'m2', name:'孙浩',   text:'90 天里最难的其实是第 35-40 天',               ts: 85, likes: 11 },
  ],
};

/**
 * 某个 Flag 的公开留言（按时间倒序 —— 新的排最高）
 * ⚠️ 「今天」的留言也在这里 —— 目标人自己发的那条会标 target:true。
 * @returns {Array<{id,name,text,ts,likes,liked,date,target}>}
 */
function publicMsgsOf(f) {
  if (!f) return [];
  if (!f.pubMsgs) {
    f.pubMsgs = (MSG_SEEDS[f.id] || []).map(m => ({
      ...m, liked: false, target: false,
    }));
  }
  /* ⚠️ 时间倒序 —— 新的排最高（用户口径 2026-11-23） */
  return f.pubMsgs.slice().sort((a, b) => b.ts - a.ts);
}

/**
 * 发一条公开留言
 * @param {string} flagId
 * @param {string} text
 * @param {object} [opt] { name, target }
 * @returns {object|null} 新建的留言
 */
function addPublicMsg(flagId, text, opt) {
  const f = findFlag(flagId);
  if (!f) return null;
  const t = String(text || '').trim().slice(0, 60);
  if (!t) return null;
  if (!f.pubMsgs) f.pubMsgs = (MSG_SEEDS[f.id] || []).map(m => ({ ...m, liked: false, target: false }));
  /* ⚠️ ts 必须在现有最大 ts 之上 —— 否则新留言排不到最前面 */
  const maxTs = f.pubMsgs.reduce((m, x) => Math.max(m, x.ts || 0), 0);
  const msg = {
    id: 'm' + Date.now(),
    name: (opt && opt.name) || ME.name,
    text: t,
    ts: maxTs + 1,
    likes: 0,
    liked: false,
    target: !!(opt && opt.target),
  };
  f.pubMsgs.push(msg);
  /* ⚠️ 2026-11-24：留言算 1 次互动（成为见证席的门槛，见 R5.9.2.3） */
  addInteraction('留言');
  /* ⚠️ 留言现在是【公开的】—— 动态流里可以直接带内容（原来只记事件不带内容） */
  activityOf(f).unshift({ type:'msg', who: msg.name, text: msg.text, time:'刚刚' });
  return msg;
}

/**
 * 给一条公开留言点赞
 * ⚠️ 每个人每条留言【只能点一次】；点过之后颜色变化、不能再加。
 * @returns {{ok:boolean, msg:object|null, reason:string}}
 */
function likePublicMsg(flagId, msgId) {
  const f = findFlag(flagId);
  if (!f || !f.pubMsgs) return { ok: false, msg: null, reason: '找不到这个 Flag' };
  const m = f.pubMsgs.find(x => x.id === msgId);
  if (!m) return { ok: false, msg: null, reason: '找不到这条留言' };
  if (m.liked) return { ok: false, msg: m, reason: '已经点过了' };
  m.liked = true;
  m.likes = (m.likes || 0) + 1;
  return { ok: true, msg: m, reason: '' };
}

/** 留言的展示日期 —— 今天 / 昨天 / M 月 D 日 */
function msgDateOf(m) {
  if (!m) return '';
  if (m.date) return m.date;
  const t = m.ts || 0;
  /* ⚠️ demo 里没有真实时钟，用相对量表示：ts 越大越新。
     种子里的 ts 是 100/90/80… 递减的，所以按 ts 反推一个合理日期。 */
  const d = new Date();
  d.setDate(d.getDate() - Math.max(0, Math.round((100 - t) / 5)));
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 注入通知 */
function pushNotif(n) {
  STATE.notifs.unshift({
    id: 'n' + (STATE.notifs.length + 1),
    icon: n.icon || 'bell', title: n.title, body: n.body || '',
    ts: '刚刚', unread: true, type: n.type || 'info',
    /* ⚠️ 2026-11-24（本轮）：通知要分栏，所以每条都得带一个「类别」——
       'action' = 需要我行动（进「判定·邀请」栏，带动作按钮）
       其它 = 纯信息（只进「全部」栏）
       另加 go / goId = 点这条通知跳去哪里。 */
    cat: n.cat || 'info',
    go: n.go || '', goId: n.goId || '',
  });
}

/* ============================================================
   通知（2026-11-24 本轮新增：通知 Tab 分两栏）
   —— 底部「监督」Tab 换成了「通知」Tab（见 R2.21）。
      通知分两栏：
        「全部」      = 所有通知，按时间倒序
        「判定·邀请」 = 需要我行动的那部分（收件箱性质）

   —— 为什么要有第二栏：通知有三类 ——【要我做事】【告诉我结果】【别人对我有动作】。
      第一类不处理就会有后果（错过判定节点 / 见证席邀约过期 / 异议被刷掉），
      混在平铺列表里会被埋掉 —— 所以单独成栏。
   ============================================================ */

/** 切换通知栏目 */
function setNotifTab(tab) {
  STATE.notifTab = tab === 'action' ? 'action' : 'all';
}

/* ============================================================
   通知左滑删除（⚠️ 2026-11-24 本轮新增，见需求规格 R2.30⑥）
   ------------------------------------------------------------
   「通知条目支持左滑删除。」

   —— 单一真相源：STATE.notifDismissed = [key, ...]
      被删掉的通知**只是被隐藏**（key 进这个清单），
      不去动 STATE.notifs —— 因为一部分通知是【现算出来的】
      （待判定 / 见证席邀请 / 异议进展），
      删了底层数据会导致「待判定」这件事本身消失（那是业务状态，不是消息）。
   —— 为什么要「隐藏」而不是「真删」：
      · 通知是**状态的外显** —— 待判定的事还在，只是我不想看见这条提醒
      · 用户随时可以在「全部已读」那套逻辑里恢复（这里不做，但架构上留了口子）
   ============================================================ */

/** 删掉一条通知（左滑删除） */
function dismissNotif(key) {
  if (!key) return false;
  const list = STATE.notifDismissed || (STATE.notifDismissed = []);
  if (list.indexOf(key) >= 0) return false;
  list.push(key);
  return true;
}

/** 这条通知是不是已经被删掉了 */
function isNotifDismissed(key) {
  return (STATE.notifDismissed || []).indexOf(key) >= 0;
}

/** 清掉所有已删除标记（恢复全部通知） */
function restoreDismissedNotifs() {
  STATE.notifDismissed = [];
  return true;
}

/** 当前栏目 */
function notifTab() {
  return STATE.notifTab === 'action' ? 'action' : 'all';
}

/** 判定结果 → 一句话说明（通知里「已判定」那一条的正文用） */
const VERDICT_RESULT_TEXT = {
  pass:  '判定通过 · 分值待结算',
  doubt: '判定存疑 · 分值待结算',
  cheat: '判定作弊成立 · 分值待结算',
};

/**
 * 「需要我行动」的通知 —— 判定·邀请栏的真相源
 * 分类来源（全部是真实数据，不是写死的）：
 *   ① 待我判定的见证席节点  → myVerdictTasks() 里还没判的那几条
 *   ② 邀请我当见证席        → STATE.witnessInvites 里还 pending 的
 *   ③ 我提的异议的投票进展  → myObjections() 里还在 waiting / reviewing 的
 * @returns {Array<{key,icon,title,body,ts,type,unread,act,actLabel,go,goId}>}
 */
function actionNotifs() {
  const out = [];
  /* ⚠️ 2026-11-24（本轮修复）：现算出来的通知没有存盘的地方，
     每次调用都重新生成 —— 所以「未读」不能写死，要查【已读清单】。 */
  const readSet = new Set(STATE.notifReadKeys || []);
  const unreadOf = (key) => !readSet.has(key);

  /* ① 待我判定 */
  (STATE.verdictTasks || []).forEach(t => {
    const f = findFlag(t.flagId);
    const who = f && f.user ? f.user.name : '某人';
    const key = 'task:' + (t.id || t.flagId + ':' + t.nodeName);
    /* ⚠️ 2026-11-24（用户口径改）：已判定的那几条**不删掉**，
       变成「已判定」留在原地（灰态、无动作按钮）。
       —— 理由：通知是「我做过的 / 要我做的事」的流水，
          直接消失会让用户以为这条通知丢了。
          而「已判定」这三个字同时也是【完成状态的正反馈】。 */
    if (t.myVerdict) {
      out.push({
        key,
        icon: 'checkCircle',
        title: `${who} 的${t.nodeName || '节点'}已判定`,
        body: VERDICT_RESULT_TEXT[t.myVerdict] || '你的判定已提交 · 分值待结算',
        ts: t.verdictAt || '已判定',
        type: 'info',
        unread: false,
        act: null, actLabel: '',
        done: true,
        /* ⚠️ 2026-11-24（本轮，用户口径改）：【已判定】这一条不带跳转目标。
           —— 理由：它是【回顾】，不是【入口】。
              ① 跳转目标是见证席面板，那是一个「要我现在做事」的页面 ——
                 而这条已经做完了，点它不该把人拽回待办堆里；
              ② 见证席面板是需要登录的页面 —— 一个几周前就判完的通知，
                 点下去却弹登录，说不通。
           —— 现在点它只是标记已读、原地不动。 */
        go: '', goId: '',
      });
      return;
    }
    out.push({
      key,
      icon: 'gavel',
      title: `${who} 的${t.nodeName || '节点'}待你判定`,
      body: '需要你点一下 · 这个节点要由见证席共同确认',
      /* ⚠️ 2026-11-24（用户口径改）：右侧那一格不再写「待判定」——
         标题里已经有「待你判定」，再写一遍是重复；而且它占的正是
         【时间】的位置，会让人误以为这是时间。
         —— 现在这里只放真正的时间信息（还剩多久 / 什么时候截止）；
            拿不到时间就整格留空（不硬凑一个字）。 */
      ts: t.dueText || (t.deadline && t.deadline !== '已判定' ? t.deadline : ''),
      type: 'good',
      unread: unreadOf(key),
      act: 'goVerdict', actLabel: '去判定',
      go: 'verdict', goId: t.flagId,
    });
  });

  /* ② 邀请我当见证席 */
  (STATE.witnessInvites || []).forEach(inv => {
    if (inv.status !== 'pending') return;
    const f = findFlag(inv.flagId);
    /* ⚠️ 过期只看【邀约自己的 12 小时有效期】（inv.expired）——
       不要用 witnessListFrozen() —— 那是【名册冻结】（筹备期 24h 结束），
       跟邀约有没有过期是两件事。 */
    const expired = !!inv.expired;
    const key = 'invite:' + inv.flagId;
    out.push({
      key,
      icon: 'clipboard',
      title: `${inv.from || '有人'} 邀请你当见证席`,
      body: f ? `${f.title} · ${f.days} 天 · 押金 ¥${f.deposit || 0}` : '有一局想请你当见证',
      ts: inv.ts || '刚刚',
      type: 'info',
      unread: unreadOf(key),
      act: expired ? null : 'replyInvite',
      actLabel: expired ? '已过期' : '接受 / 拒绝',
      go: 'flagDetail', goId: inv.flagId,
      expired,
    });
  });

  /* ③ 我提的异议 —— 票在攒 */
  (STATE.objections || []).forEach(o => {
    if (o.status !== 'waiting' && o.status !== 'reviewing') return;
    out.push({
      key: 'obj:' + o.id,
      icon: 'alert',
      title: `你的异议 · ${o.flagUser} 的${o.node}`,
      body: o.status === 'reviewing'
        ? '已转人工复核 · 结果出来会通知你'
        : `${o.votes} / ${o.need} 票 · 还差 ${Math.max(0, o.need - o.votes)} 票转人工`,
      ts: o.ts || '刚刚',
      type: 'info',
      unread: false,
      act: 'goObjection',
      actLabel: '查看',
      go: 'objection', goId: o.flagId,
    });
  });

  /* ④ 普通通知里标了 cat:'action' 的那几条（比如种子里的「待你判定」）
        —— 它们是【静态种子】而不是从 verdictTasks 推导出来的，
        所以要在这里补进来，否则「全部」栏有、「判定·邀请」栏没有（两栏对不上）。 */
  (STATE.notifs || []).forEach(n => {
    if (n.cat !== 'action') return;
    out.push({
      key: 'n:' + n.id,
      icon: n.icon, title: n.title, body: n.body || '',
      ts: n.ts || '刚刚',
      type: n.type || 'info',
      unread: !!n.unread,
      act: n.go === 'verdict' ? 'goVerdict' : (n.go === 'objection' ? 'goObjection' : 'goGeneric'),
      actLabel: n.actLabel || '去处理',
      go: n.go || '', goId: n.goId || '',
    });
  });

  return out;
}
function allNotifs() {
  const plain = (STATE.notifs || []).map(n => ({
    key: 'n:' + n.id,
    icon: n.icon, title: n.title, body: n.body || '',
    ts: n.ts, type: n.type || 'info',
    unread: !!n.unread,
    go: n.go || '', goId: n.goId || '',
    act: n.cat === 'action' ? (n.go === 'verdict' ? 'goVerdict' : (n.go === 'objection' ? 'goObjection' : 'goGeneric')) : null,
    actLabel: n.cat === 'action' ? (n.actLabel || '去处理') : '',
  }));
  /* ⚠️ 2026-11-24（本轮修复）：actionNotifs() 里也包含了「普通通知里标了
     cat:'action' 的那几条」（key 同样是 'n:xxx'）—— 如果直接 concat，
     同一条通知会在「全部」栏出现两次。所以这里按 key 去重。
     ⚠️ 2026-11-24（用户口径改）：「已判定」的那些不能带动作 ——
        否则点那条「已判定」的通知会跳去一个已经判完的节点。 */
  const seen = new Set(plain.map(n => n.key));
  const act = actionNotifs()
    .filter(a => !seen.has(a.key))
    .map(a => a.done
      ? { ...a, act: null, actLabel: '' }
      : { ...a, act: a.act === 'goVerdict' || a.act === 'goObjection' || a.act === 'goGeneric' ? a.act : 'replyInvite' });
  return plain.concat(act);
}

/** 某一栏的通知 */
function notifsOf(tab) {
  /* ⚠️ 2026-11-24（用户口径改）：「判定·邀请」栏是【要我现在做事】的收件箱 ——
     判完的（done）不再需要我做事，不该占这个栏的位置。
     它留在「全部」栏里（灰态），让用户看得见「这件事我做完了」。 */
  const list = tab === 'action'
    ? actionNotifs().filter(a => !a.done)
    : allNotifs();
  /* 待办排前面（先看要处理的），其余按时间倒序 */
  const actKeys = new Set(actionNotifs().filter(a => !a.done).map(a => a.key));
  /* ⚠️ 2026-11-24（本轮）：**左滑删掉的通知不再出现**（见 R2.30⑥） */
  return list.filter(x => !isNotifDismissed(x.key)).sort((a, b) => {
    const pa = actKeys.has(a.key) ? 0 : 1;
    const pb = actKeys.has(b.key) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return 0;
  });
}

/** 未读数（底部角标）
 *  ⚠️ 2026-11-24（本轮修复）：原来是「固定通知未读数 + 现算通知条数」直接相加 ——
 *     两个问题：① 现算通知里有一半本来就是「已处理」的（异议那几条 unread:false），
 *     被算成未读；② 同一条通知在两处都出现时被数两遍。
 *  —— 现在统一走 allNotifs()，按 key 去重后数未读的。
 *
 *  ⚠️ 2026-11-25（本轮修复）：**已左滑删除的通知不再计入未读** ——
 *     notifsOf() 已经过滤掉 isNotifDismissed 的通知（列表里看不见了），
 *     但角标还在数它 —— 用户左滑删了 3 条，角标还是 3，
 *     「删了没反应」是最典型的假功能。
 *     —— 口径统一：**列表里看得见的，才可能未读**。 */
function unreadNotifCount() {
  const seen = new Set();
  let n = 0;
  allNotifs().forEach(x => {
    if (seen.has(x.key)) return;
    seen.add(x.key);
    /* 已删除（左滑清掉）的通知：不显示也不计数 */
    if (isNotifDismissed(x.key)) return;
    if (x.unread) n++;
  });
  return n;
}

/** 某一栏的未读数 */
function unreadNotifCountOf(tab) {
  /* ⚠️ 2026-11-24（用户口径改）：「判定·邀请」栏的未读数只算【还要我做】的 ——
     判完的（done）unread 恒为 false，本来也不会被算进去，
     这里过滤掉是为了跟 notifsOf() 的口径完全一致。 */
  const list = tab === 'action'
    ? actionNotifs().filter(a => !a.done)
    : allNotifs();
  const seen = new Set();
  let n = 0;
  list.forEach(x => {
    if (seen.has(x.key)) return;
    seen.add(x.key);
    /* ⚠️ 2026-11-25：与 unreadNotifCount() 同口径 —— 已左滑删除的不计未读 */
    if (isNotifDismissed(x.key)) return;
    if (x.unread) n++;
  });
  return n;
}

/** 标记全部已读
 *  ⚠️ 2026-11-24（本轮修复）：原来只清了 STATE.notifs ——
 *     现算出来的那一类（待判定 / 见证席邀请）每次都重新生成、
 *     未读状态写死成 true，所以「全部已读」按下去角标一点没少。
 *  —— 现在把当前所有通知的 key 全部记进已读清单。 */
function markAllNotifsRead() {
  (STATE.notifs || []).forEach(n => { n.unread = false; });
  const keys = allNotifs().map(n => n.key);
  STATE.notifReadKeys = Array.from(new Set((STATE.notifReadKeys || []).concat(keys)));
}

/** 标记单条已读（点开一条通知时用） */
function markNotifRead(key) {
  if (!key) return;
  (STATE.notifs || []).forEach(n => {
    if ('n:' + n.id === key) n.unread = false;
  });
  if ((STATE.notifReadKeys || []).indexOf(key) < 0) {
    STATE.notifReadKeys = (STATE.notifReadKeys || []).concat([key]);
  }
}

/* ---------- 见证席邀请（被邀请方）---------- */

/** 我收到的、还在等待回应的见证席邀请 */
function myWitnessInvites() {
  return (STATE.witnessInvites || []).slice();
}

/** 回应一个见证席邀请
 *  @param {string} flagId
 *  @param {boolean} accept true=接受 / false=拒绝
 *  @return {string} 'ok' | 'closed' | 'dup'
 */
function replyWitnessInvite(flagId, accept) {
  const inv = (STATE.witnessInvites || []).find(x => x.flagId === flagId);
  if (!inv) return 'closed';
  if (inv.status !== 'pending') return 'dup';
  if (accept) {
    inv.status = 'accepted';
    /* 接受 = 加入那一局的见证席 —— 走现有的加入逻辑（不允许中途加入，成立即锁死） */
    addWitnessing(flagId);
  } else {
    inv.status = 'declined';
  }
  return 'ok';
}

/** 把过期的邀请标成 expired（12 小时有效期，见 R5.5.2） */
function expireWitnessInvites() {
  (STATE.witnessInvites || []).forEach(inv => {
    if (inv.status === 'pending' && inv.expired) inv.status = 'expired';
  });
}

function nowStamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ---------- 调试面板：注入内容 ---------- */

/**
 * 取「我那个正在跑的 Flag」—— 注入器专用
 * ⚠️ 2026-11-24：种子里有两局（f_new_1 在跑、f_new_2 是已取消的旧局），
 *   而且 `STATE.myFlags` 里 f_new_2 排在前面（addMyFlag 是 unshift）。
 *   所以**不能用 `STATE.myFlags[0]`** —— 那是那局旧的。
 *   也不能用 `myMainFlag()` —— 注入器改了 status 之后它会指向别的局。
 *   这里明确按 status 找「正在跑的那一局」。
 */
function myRunningFlag() {
  return STATE.myFlags.find(f => f.status === 'running' || f.status === 'ending')
      || STATE.myFlags.find(f => f.status === 'prep')
      || null;
}

/**
 * 把某一局挪到「我的」列表的最前面 —— 注入器专用
 * ⚠️ 为什么要挪：注入器改完 status 之后，`myMainFlag()` 的
 *   「running[0] || myFlags[0]」会落到种子里的那局旧 Flag 上，
 *   于是首页展示的、详情页展示的就都不是注入器改的那一局。
 *   把它挪到最前面，全站（首页 / 详情页 / 我的 Flag）就都指向它了。
 */
function focusMyFlag(f) {
  if (!f) return;
  const i = STATE.myFlags.indexOf(f);
  if (i > 0) {
    STATE.myFlags.splice(i, 1);
    STATE.myFlags.unshift(f);
  }
}

const INJECTORS = {
  /** 一键恢复「全新用户」 */
  reset() {
    initState();
    return '已重置为新用户';
  },

  /** 模拟：发起了 2 个 Flag、打卡几天
   *  ⚠️ 同一时间只能有一个进行中的 Flag（见 R1.6）——
   *     所以 f_new_1 在跑，f_new_2 是已取消的旧局。 */
  newUserWithFlags() {
    initState();
    SEED_FLAGS.forEach(cfg => {
      const f = addMyFlag({
        title: cfg.title, reason: cfg.reason,
        startWeight: cfg.startWeight, targetWeight: cfg.targetWeight,
        days: cfg.days, tier: cfg.tier, deposit: cfg.deposit,
        witnesses: cfg.witnesses,
      });
      // 覆盖种子里的精确数值
      f.curWeight = cfg.curWeight;
      f.checkedDays = cfg.checkedDays;
      f.streak = cfg.streak;
      f.history = cfg.history;
      f.nodes = expandNodes(cfg);
      f.supervisorCount = cfg.supervisorCount;
      // 种子是「筹备期已过」的状态 —— 名单已冻结、档位已定（见 R1.1 / R1.3）
      f.start = cfg.start;
      f.prepEnd = isoAddDays(cfg.start, 1);
      f.end = cfg.end;
      f.status = cfg.status;
      f.statusText = cfg.statusText;
      f.initialTier = cfg.tier || f.initialTier;
      f.effectiveTier = cfg.effectiveTier || cfg.tier || f.initialTier;
      f.tier = f.effectiveTier;
      /* 取消的旧局：把结局信息一并写上（见 R1.6） */
      if (cfg.canceled) {
        f.canceled = true;
        f.failedReason = cfg.failedReason;
        f.lostAmount = cfg.lostAmount;
        f.creditDelta = cfg.creditDelta;
        f.deposit = 0;
      }
      STATE.checkinLogs[f.id] = (SEED_CHECKIN[cfg.id] || []).map(l => ({ ...l }));
    });
    STATE.credit = 66;
    return '已注入 1 个进行中的 Flag + 1 个已取消的';
  },

  /** 模拟：监督了几个人的 Flag */
  subscribe() {
    ['f_1', 'f_3', 'f_7'].forEach(id => subscribeFlag(id));
    return '已监督 3 个 Flag';
  },

  /** 模拟：刚立了一个 Flag，还在 24 小时筹备期里（见需求规格 R1.1）
   *  ⚠️ 2026-11-22 用户口径：筹备期里首页不是「打卡」状态 ——
   *     主视觉是【显眼的 24 小时倒计时】+【见证席申请情况】+【已有见证人数】，
   *     点进去是【发起成功页】（分享 / 看报名 / 邀请见证），
   *     24 小时过了才变成正常的打卡页。
   *  所以这个状态要造的东西是：一个 prep 状态的 Flag + 已发的召集令 + 几个报名者。 */
  prep() {
    initState();
    const f = addMyFlag({
      title: '30 天，把体脂从 26% 降到 23%',
      reason: '体检报告说超重，先从轻的来',
      startWeight: 72.5, targetWeight: 68.0,
      days: 30, tier: 'T2', deposit: 500,
      /* 已有 2 位见证人（1 位已接受 + 1 位待接受）—— 演示「已有见证人数」 */
      witnesses: [
        { ...WITNESSES[0], status: 'accepted' },
        { ...WITNESSES[1], status: 'pending' },
      ],
    });
    /* 召集令已发布 + 3 位报名者（1 位已接受）—— 演示「见证席申请情况」 */
    publishRecruit();
    acceptApplicant(RECRUIT_SEED[0].id);
    STATE.credit = 66;
    return '已注入：筹备期中的 Flag（24h 倒计时 + 2 位见证人 + 3 位报名者）';
  },

  /** 模拟：收到一堆通知 */
  notifs() {
    initState();
    STATE.notifs = [
      { id: 'n1', icon: 'sparkle', title: '欢迎来到「亏了」', body: '先立一个 Flag，让别人盯着你', ts: '刚刚', unread: true, type: 'info' },
      { id: 'n2', icon: 'eyeOpen', title: '阿May 也在立 Flag', body: '「30 天从 58.2 降到 55」', ts: '1 小时前', unread: true, type: 'info' },
      { id: 'n3', icon: 'checkCircle', title: '小美 的中期称重待你判定', body: '还剩 31 小时 · 需要你点一下', ts: '3 小时前', unread: true, type: 'good' },
    ];
    /* ⚠️ 2026-11-24（本轮修复）：这条是【要我行动】的 —— 标上 cat:'action' + 跳转目标，
       否则它只会出现在「全部」栏，「判定·邀请」栏是空的（两栏对不上）。 */
    STATE.notifs[2].cat = 'action';
    STATE.notifs[2].go = 'verdict';
    STATE.notifs[2].goId = 'f_3';
    STATE.notifs[2].actLabel = '去判定';
    return '已注入 3 条通知';
  },

  /** 模拟：完整监督 1 次（见需求规格 4.9.3） */
  supervised() {
    STATE.fullSupervised = Math.max(STATE.fullSupervised || 0, 1);
    STATE.myWitnessedFlags = ['f_7'];
    return '已完整监督 1 次（可申请进入候选池）';
  },

  /** 模拟：互动攒够了（可申请成为见证席）
   *  ⚠️ 2026-11-24 用户口径（改）：门槛换成【累计互动 10 次】——
   *  旧的「+完整监督」场景只演示「完整监督过」，不再代表入池资格。 */
  interacted() {
    this.newUserWithFlags();
    STATE.interactions = WITNESS_APPLY_INTERACTIONS;
    return `已累计互动 ${WITNESS_APPLY_INTERACTIONS} 次（可以申请成为见证席）`;
  },

  /** 模拟：昨天漏打卡（12 小时补卡窗口还开着）
   *  ⚠️ 2026-11-24 用户口径新增：
   *   「最上面的断卡提醒，应该是几月几日未打卡，给用户一个按钮，点击补卡，
   *     并且做 12 小时倒计时。」 */
  missedCheckin() {
    this.newUserWithFlags();
    const f = myRunningFlag();
    if (!f) return '没有可操作的 Flag';
    /* 昨天漏了 —— 今天还没打卡 */
    f.checkedOn = null;
    f.missedOn = isoAddDays(DEMO_TODAY, -1);
    /* 补卡窗口：真实时间戳，倒计时真在走
       ⚠️ 为什么要用 Date.now() 而不是「昨天 24:00 + 12 小时」——
          demo 的「今天」是固定日期（2026-11-16），而真实时钟早就走过去了，
          按固定日期算出来的截止时刻永远是「已过期」，倒计时就没得看了。
          所以这里锚在「现在」，剩 11.5 小时 —— 演示时能看到它在走。 */
    f.makeupEndAt = Date.now() + 11.5 * 3600 * 1000;
    /* 漏的是「昨天」那一格 —— day 要用真实的第几天，不是 checkedDays */
    const day = f.start ? daysBetween(f.start, DEMO_TODAY) + 1 : f.checkedDays + 1;
    f.history = (f.history || []).concat([{ d: day, w: null, ok: false, date: f.missedOn }]);
    focusMyFlag(f);
    return '已注入：昨天漏打卡（首页有补卡提醒 + 12 小时倒计时）';
  },

  /** 模拟：昨天漏打卡，而且 12 小时已经过了（断卡已生效）
   *  ⚠️ 2026-11-24 用户口径：「如果超过了 12 小时还没有补卡，
   *   目标详情页这里的『断卡情况』，要能体现出来，可以用 1/3 表示。」 */
  breakExpired() {
    this.missedCheckin();
    const f = myRunningFlag();
    if (!f) return '没有可操作的 Flag';
    /* 窗口已经关掉 */
    f.makeupEndAt = Date.now() - 3600 * 1000;
    /* 而且这一次的断卡已经记上了 */
    f.breaks = (f.breaks || 0) + 1;
    f.streak = 0;
    focusMyFlag(f);
    return '已注入：昨天漏打卡且已超过 12 小时（断卡情况显示 1/3）';
  },

  /** 模拟：成为见证席，有待判定任务 */
  witness() {
    if (!STATE) initState();
    STATE.verdictTasks = MY_VERDICT_TASKS.map(t => ({ ...t }));
    /* ⚠️ 2026-11-23 用户口径：首页「我见证的 Flag」——
       除了有待判节点的局，正在见证但还没到节点的局也要出现在首页。 */
    STATE.witnessing = ['f_1', 'f_6'];
    STATE.witnessCount = 4;
    return '已注入 2 个见证席待判定';
  },

  /** 模拟：老用户（全部内容都有） */
  veteran() {
    this.newUserWithFlags();
    this.subscribe();
    this.supervised();
    this.witness();
    STATE.credit = 88;
    STATE.witnessCount = 4;
    STATE.supervisorCount = 7;
    STATE.doneFlags = 3;
    STATE.failedFlags = 1;
    STATE.notifs = [
      { id: 'n1', icon: 'alert', title: '你的 Flag 断了', body: '今天没打卡，连续天数已归零', ts: '2 小时前', unread: true, type: 'warn' },
      { id: 'n2', icon: 'eyeOpen', title: '阿May 的 Flag 断卡了', body: '「老王的 Flag 断了，今天没打卡」', ts: '3 小时前', unread: true, type: 'info' },
      { id: 'n3', icon: 'checkCircle', title: '小美 的中期称重待你判定', body: '还剩 31 小时 · 需要你点一下', ts: '5 小时前', unread: true, type: 'good', cat: 'action', go: 'verdict', goId: 'f_3', actLabel: '去判定' },
      { id: 'n4', icon: 'sparkle', title: '果果 的 30 天结算了', body: '未达标，但坚持了 27 天 —— 记录卡已生成', ts: '昨天', unread: false, type: 'info' },
      { id: 'n5', icon: 'message', title: '小李 给你留了言', body: '「别急，节奏挺稳的，继续」', ts: '昨天', unread: false, type: 'info' },
    ];
    return '已注入完整老用户状态';
  },

  /* ⚠️ 2026-11-24 用户口径：「为了让整个 demo 更接近真实的软件的使用的感觉，
     左边的主流程、右边的演示状态还需要增加什么内容？
     注意，尽量做增加而不是减少。」

     —— 所以下面这批注入器是在【原有 8 个】之外【增加】的，
        不改原有的任何一个 —— 原来那 8 个场景都满意，不动。

     —— 设计原则：每个注入器都造一个【真实软件里会遇到的、但现在造不出来】的状态。
        判据是「用户在真实使用中一定会遇到」—— 比如：
        · 钱没到账（结算待发放）
        · 押金被扣了但我想申诉
        · 我的 Flag 断卡了（首页要变红）
        · 我提了异议，正在等别人投票
        · 我刚被驳回了一个 Flag（为什么被驳回？）

  /* ─────────────────────────────────────────────
     ⑨ 断卡（我的 Flag 断了）
     ───────────────────────────────────────────── */
  broken() {
    this.newUserWithFlags();
    /* ⚠️ 目标必须【先取好】—— 改了 status 之后 myMainFlag() 会指向另一局
       （种子里的 f_new_2 是「已取消」的旧局，在数组前面）。 */
    const f = myRunningFlag();
    if (!f) return '没有可操作的 Flag';
    f.status = 'broken';
    f.statusText = '断卡';
    f.streak = 0;
    f.breaks = 1;
    f.creditDelta = -5;
    f.lostAmount = Math.round(f.deposit * 0.1);
    /* 断卡日没有照片 —— history 里补一条 ok:false */
    f.history = (f.history || []).concat([{ d: f.checkedDays + 1, w: null, ok: false, note: '断卡', broken: true, date: isoAddDays(DEMO_TODAY, -1) }]);
    /* ⚠️ 2026-11-24：断卡的提醒挪到首页了（带补卡按钮 + 12 小时倒计时），
       所以这里【不再有补卡窗口】—— 已经断了，就是断了。 */
    f.missedOn = null;
    f.makeupEndAt = 0;
    /* ⚠️ 把它挪到最前面 —— 否则全站展示的还是另一局 */
    focusMyFlag(f);
    STATE.notifs = [{
      id: 'nb1', icon: 'alert', title: '你的 Flag 断了',
      body: '今天没打卡，连续天数已归零', ts: '2 小时前', unread: true, type: 'warn',
    }];
    return '已注入：我的 Flag 断卡了（连续天数归零 + 信用分 -5）';
  },

  /* ─────────────────────────────────────────────
     ⑩ 已结算 · 押金退回（挣回来了）
     ───────────────────────────────────────────── */
  settled() {
    this.newUserWithFlags();
    const f = myRunningFlag();
    if (!f) return '没有可操作的 Flag';
    f.status = 'success';
    f.statusText = '已达标';
    f.checkedDays = f.totalDays;
    f.streak = f.totalDays;
    f.creditDelta = 3;
    f.lostAmount = 0;
    f.refunded = f.deposit;
    /* ⚠️ 2026-11-24：结算成「挣了」之后，体重必须**真的到目标**——
       否则记录卡上会出现「72.5 → 71.2 kg · 说到做到，达成目标」这种自相矛盾的话。 */
    f.curWeight = f.targetWeight;
    f.depositPaid = f.deposit;
    focusMyFlag(f);
    STATE.doneFlags = (STATE.doneFlags || 0) + 1;
    STATE.credit = 72;
    STATE.notifs = [{
      id: 'ns1', icon: 'sparkle', title: '你的 Flag 结算了',
      body: '已达标 —— 押金 ¥' + (f.deposit || 0) + ' 已全额退回', ts: '1 小时前', unread: true, type: 'good',
    }];
    return '已注入：我的 Flag 已达标结算（押金全额退回）';
  },

  /* ─────────────────────────────────────────────
     ⑪ 押金被扣 · 待申诉（争议状态）
     ───────────────────────────────────────────── */
  appealed() {
    this.newUserWithFlags();
    const f = myRunningFlag();
    if (!f) return '没有可操作的 Flag';
    f.status = 'failed';
    f.statusText = '未达标';
    f.creditDelta = -8;
    f.lostAmount = Math.round(f.deposit * 0.2);
    f.depositHeld = true;      /* 押金已被扣，还没退 */
    f.appeal = {
      status: 'reviewing',     /* 审核中 */
      type: '押金扣收有异议',
      submittedAt: '2026-11-16 09:20',
      deadline: '还剩 18 小时',
      reason: '这一局我确实断了卡，但中间出差三天，系统没有提醒我',
    };
    focusMyFlag(f);
    STATE.credit = 58;
    STATE.notifs = [{
      id: 'na1', icon: 'alert', title: '押金扣收有异议',
      body: '你的申诉已提交，平台人工复核中', ts: '3 小时前', unread: true, type: 'warn',
    }];
    return '已注入：押金被扣 + 申诉审核中（可看申诉进度）';
  },

  /* ─────────────────────────────────────────────
     ⑫ 我提了异议 · 等别人投票（3 票门槛）
     ───────────────────────────────────────────── */
  objectionPending() {
    this.subscribe();
    /* 物证前置：必须先看过物证才能投（见需求规格 R4.3 ②） */
    const f = FLAGS.f_3;
    if (f) {
      STATE.seenEvidence = STATE.seenEvidence || {};
      STATE.seenEvidence[f.id] = [1, 2, 3];
    }
    STATE.objections = [{
      id: 'ob1', flagId: 'f_3', flagUser: '小美',
      node: '中期称重', day: 30,
      reason: '照片里的体重秤读数和照片时间对不上',
      ts: '今天 10:24',
      votes: 2, need: 3, myVote: true, status: 'waiting',
    }];
    STATE.notifs = [{
      id: 'no1', icon: 'eyeOpen', title: '你的异议已收到',
      body: '还需 1 票转人工复核', ts: '5 小时前', unread: true, type: 'info',
    }];
    return '已注入：我提了异议，2/3 票（还差 1 票转人工）';
  },

  /* ─────────────────────────────────────────────
     ⑬ 见证席判定被驳回（为什么被驳回？）
     ───────────────────────────────────────────── */
  verdictRejected() {
    this.witness();
    /* 我的一个判定被判「不成立」—— 目标人申诉成功 */
    const t = (STATE.verdictTasks || [])[0];
    if (t) {
      t.myVerdict = 'cheat';
      t.judged = 2;
      t.rejected = true;
      t.rejectReason = '复核后认定打卡照真实有效 —— 你的「作弊」判定不成立，本次判定不计分。';
    }
    STATE.notifs = [{
      id: 'nv1', icon: 'alert', title: '你的判定被驳回',
      body: '「小美 的中期称重」复核后维持通过', ts: '1 天前', unread: true, type: 'warn',
    }];
    return '已注入：我的见证判定被驳回（不计分 + 说明原因）';
  },

  /* ─────────────────────────────────────────────
     ⑭ 有留言待我回声（目标人视角）
     ───────────────────────────────────────────── */
  msgsWaiting() {
    this.newUserWithFlags();
    const f = myRunningFlag();
    if (!f) return '没有可操作的 Flag';
    /* 有人给我留言，但还没回 */
    f.msgs = [
      { from: '林一', text: '第一天就掉了 1.2kg，节奏挺快的', ts: '今天 08:12', reply: null },
      { from: '苏晴', text: '出差那几天记得也拍一张，不然断卡', ts: '昨天 21:40', reply: null },
    ];
    f.pubMsgs = [];
    focusMyFlag(f);
    return '已注入：2 条留言待我回声（目标人视角）';
  },

  /* ─────────────────────────────────────────────
     ⑮ 候选池已入池（见证席 · 已提交申请）
     ───────────────────────────────────────────── */
  inPool() {
    this.supervised();
    this.subscribe();
    this.interacted();
    STATE.poolApplied = true;
    STATE.inPool = true;
    STATE.witnessCount = 2;
    STATE.credit = 74;
    return '已注入：我已在见证席候选池里';
  },

  /* ─────────────────────────────────────────────
     ⑯ 召集令已发 · 报名者待处理
     ───────────────────────────────────────────── */
  recruiting() {
    this.prep();
    const f = myRunningFlag();
    if (f) {
      f.witnesses = [
        { ...WITNESSES[0], status: 'accepted' },
        { ...WITNESSES[1], status: 'pending' },
        { ...WITNESSES[2], status: 'pending' },
      ];
    }
    return '已注入：召集令已发布，3 位报名者待处理（1 位已接受）';
  },

  /* ─────────────────────────────────────────────
     ⑰ 我关注的人（关注列表不是空的）
     ───────────────────────────────────────────── */
  following() {
    this.newUserWithFlags();
    ['阿May', '林一', '小美'].forEach(n => {
      if (!STATE.following.includes(n)) STATE.following.push(n);
    });
    return '已注入：我关注了 3 个人';
  },

  /* ─────────────────────────────────────────────
     ⑲ 游客态（未登录）—— 看看未登录能看什么
     ───────────────────────────────────────────── */
  guest() {
    initState();
    /* ⚠️ demo 的默认态 loggedIn 就是 false（登录不是进入 demo 的前置），
       所以光看 loggedIn 判断不了「用户主动切到了游客态」——
       这里用一个**显式标记**，让左栏能如实显示「游客态」。 */
    STATE.isGuest = true;
    return '已注入：游客态（未登录，可浏览但不能做实质性动作）';
  },

  /* ─────────────────────────────────────────────
     ⑳ 我被邀请当见证席（通知里能收到邀约）
     ───────────────────────────────────────────── */
  invited() {
    this.newUserWithFlags();
    /* ⚠️ 2026-11-24（本轮）：这是【闭环缺口】——
       原来邀请机制只有发起人那头（坑位 / 12 小时过期 / 候选池邀请），
       被邀请的人这边【完全没有入口】知道「你被邀请了」。
       —— 通知 Tab 的「判定·邀请」栏就是那个入口。 */
    STATE.witnessInvites = [
      { flagId: 'f_3', from: '小美', ts: '1 小时前', status: 'pending' },
      { flagId: 'f_9', from: '苏晴', ts: '9 小时前', status: 'pending', expired: true },
    ];
    return '已注入：2 个见证席邀请（1 个待回应 + 1 个已过期）';
  },
};

function inject(name) {
  const fn = INJECTORS[name];
  if (!fn) return '未知操作: ' + name;
  return fn.call(INJECTORS);
}
