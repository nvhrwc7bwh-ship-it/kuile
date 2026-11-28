/* ============================================================
   R2.24 走查复验：通知压扁 + 招募横条 + 招募详情页 + 合并第三步
   —— 本轮的五项改动，各配一组断言，防止以后被改回去。
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let fails = 0;
function assert(cond, msg) {
  if (!cond) { console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}

const appSrc   = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const pagesSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'pages.js'), 'utf8');
const stateSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'state.js'), 'utf8');
const dataSrc  = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const cssSrc   = fs.readFileSync(path.join(__dirname, '..', 'css', 'app.css'), 'utf8');

/* ---------- 沙箱（跟 _verify_recruit.js 同款，需要 document） ---------- */
const fakeEl = () => ({
  style: {}, dataset: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
  appendChild(){}, removeChild(){}, addEventListener(){}, removeEventListener(){},
  setAttribute(){}, getAttribute(){ return null; }, querySelector: () => fakeEl(),
  querySelectorAll: () => [], remove(){}, innerHTML: '', textContent: '', value: '',
});
const sandbox = {
  console, window: fakeEl(),
  document: {
    querySelector: () => fakeEl(), querySelectorAll: () => [],
    getElementById: () => fakeEl(), addEventListener(){}, removeEventListener(){},
    createElement: () => fakeEl(), body: fakeEl(),
  },
  localStorage: { getItem: () => null, setItem(){} },
  setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame: () => 0,
  location: { href: 'http://localhost/', pathname: '/' },
  history: { pushState(){}, replaceState(){} },
  Date, Math, JSON,
};
/* pages.js 里用到的 ICON / ic 在 app.js 里，这里补个够用的桩 */
sandbox.ICON = new Proxy({}, { get: () => '<svg class="stub"></svg>' });
sandbox.ic = () => '';
vm.createContext(sandbox);
for (const f of ['info.js','avatars.js','data.js','state.js','pages.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js',f),'utf8'), sandbox, { filename: f });
}
const run = (code) => vm.runInContext(code, sandbox);

/* ============================================================
   ① 通知行压扁 + 「全部已读」真的清零
   ============================================================ */
console.log('\n=== ① 通知行压扁 + 全部已读 ===');
{
  run("initState(); inject('veteran');");
  const PAGES = run('PAGES');

  /* 1.1 时间跟正文同一行，不再单独一行 */
  const notifHtml = PAGES.notifs();
  assert(/class="notif-line"/.test(notifHtml), '通知有 .notif-line（正文 + 时间同一行）');
  assert(/notif-ts/.test(notifHtml), '时间在 .notif-line 里');
  assert(!/class="notif-foot"/.test(notifHtml), '通知不再有独立的 .notif-foot 那一行');
  /* 1.2 动作按钮挂在整行右侧 */
  assert(/class="notif-acts"/.test(notifHtml), '动作按钮在 .notif-acts 里');
  assert(/\.notif-row\{[^}]*align-items:center/.test(cssSrc), '通知行用 align-items:center（按钮跟整行居中）');
  assert(/\.notif-line\{[^}]*align-items:center/.test(cssSrc), '正文行也用 center（不再用 baseline —— baseline 会让按钮看着偏下）');
  /* 1.3 CSS：正文单行裁切 + 行高压缩 */
  assert(/\.notif-body\{[^}]*white-space:nowrap/.test(cssSrc), '正文只有一行（nowrap + ellipsis）');
  assert(/\.notif-row\{[^}]*padding:8px/.test(cssSrc), '通知行内边距压到 8px');

  /* 1.4 「全部已读」要真的把未读数清零 —— 原来只清固定通知，
        现算出来的那一类每次都重新生成、未读写死 true，所以角标永远降不下来 */
  const before = run('unreadNotifCount()');
  assert(before > 0, `初始有 ${before} 条未读`);
  run('markAllNotifsRead()');
  const after = run('unreadNotifCount()');
  assert(after === 0, `「全部已读」之后未读数归零（实际 ${after}）`);
  assert(run("unreadNotifCountOf('action')") === 0, '「判定·邀请」栏的未读数也归零');
  assert(run('(STATE.notifReadKeys || []).length') > 0, '已读清单被记住了（notifReadKeys）');

  /* 1.5 单条已读 */
  run("initState(); inject('veteran');");
  const n1 = run('unreadNotifCount()');
  const oneKey = run('allNotifs()[0].key');
  run(`markNotifRead(${JSON.stringify(oneKey)})`);
  assert(run('unreadNotifCount()') === n1 - 1, `点一条之后未读数 ${n1} → ${run('unreadNotifCount()')}`);
  /* 1.6 点通知行 = 标记已读 + 跳转 */
  assert(/data-notif-key="\$\{n\.key\}"/.test(pagesSrc), '通知行带 data-notif-key（点行能标已读）');
  assert(/case 'readAllNotifs'/.test(appSrc), 'app.js 有 readAllNotifs 动作');

  /* 1.7 「待判定」这两个字不再出现在时间位（2026-11-24 用户口径改）——
        标题里已经写了「待你判定」，时间位再写一遍是重复；
        而且那一格占的是【时间】的位置，写「待判定」会让人误以为那是时间。 */
  const taskNotifs = run('actionNotifs().filter(function(n){ return n.key.indexOf("task:") === 0; })');
  assert(taskNotifs.length > 0, `有 ${taskNotifs.length} 条待判定通知`);
  taskNotifs.forEach(n => {
    assert(n.ts !== '待判定', `${n.key} 的时间位不是「待判定」（实际「${n.ts}」）`);
  });
  assert(!/ts: t\.dueText \|\| '待判定'/.test(stateSrc), "源码里不再有 `|| '待判定'` 的兜底");

  /* 1.8 判定完之后，通知变成「已判定」留在原地（不是消失） */
  const vid = run('(STATE.verdictTasks || [])[0].id');
  const beforeTask = run(`(function(){ var n = actionNotifs().filter(function(x){return x.key === "task:" + ${JSON.stringify(vid)}; }); return n[0] || null; })()`);
  assert(beforeTask && beforeTask.act === 'goVerdict', '判定前：这条通知带「去判定」动作');
  run(`markVerdictDone(${JSON.stringify(vid)}, 'pass')`);
  const afterTask = run(`(function(){ var n = actionNotifs().filter(function(x){return x.key === "task:" + ${JSON.stringify(vid)}; }); return n[0] || null; })()`);
  assert(!!afterTask, '判定后：这条通知**还在**（不是直接消失）');
  assert(/已判定/.test(afterTask.title), `判定后：标题变成「已判定」（实际「${afterTask.title}」）`);
  assert(afterTask.done === true, '判定后：标记为 done（灰态）');
  assert(!afterTask.act, '判定后：没有动作按钮了');
  assert(afterTask.unread === false, '判定后：不算未读');
  /* 已判定的那些不进「判定·邀请」栏（那个栏是「要我现在做事」的收件箱） */
  const inActionTab = run(`(function(){ var l = notifsOf('action'); return l.filter(function(x){return x.key === "task:" + ${JSON.stringify(vid)}; }).length; })()`);
  assert(inActionTab === 0, '判定后：不在「判定·邀请」栏里（那一栏只放还要我做的事）');
  /* 但在「全部」栏里还在（灰态） */
  const inAllTab = run(`(function(){ var l = notifsOf('all'); return l.filter(function(x){return x.key === "task:" + ${JSON.stringify(vid)}; }).length; })()`);
  assert(inAllTab === 1, '判定后：在「全部」栏里还在（看得见「我做完了」）');
  /* 渲染层：done 的行有灰态 class、没有按钮 */
  const doneHtml = run(`PAGES.notifs()`);
  assert(/notif-row[^\n]*\bdone\b/.test(doneHtml), '已判定那行带 .done class');
  assert(/\.notif-row\.done\{/.test(cssSrc), 'CSS 有 .notif-row.done 灰态样式');
}

/* ============================================================
   ② 见证席面板不再放招募列表（改走广场 + 通知）
   ============================================================ */
console.log('\n=== ② 见证席面板不再放招募列表 ===');
{
  run("initState(); inject('veteran');");
  const v = run('PAGES.verdict()');
  assert(!/正在招募见证席/.test(v), '见证席面板没有招募列表了');
  assert(!/data-act="applyJoinWitness"/.test(v), '见证席面板没有「我想参加」按钮');
  assert(!/function recruitingFlagsBlock/.test(pagesSrc), 'recruitingFlagsBlock 整个函数删掉了');
}

/* ============================================================
   ③ 广场「招募中」= 横条；招募中的局必须是筹备期、零打卡
   ============================================================ */
console.log('\n=== ③ 招募横条 + 筹备期语义 ===');
{
  run("initState(); inject('veteran');");
  const list = run('recruitingFlags()');
  assert(list.length > 0, `有 ${list.length} 个局在招募`);
  list.forEach(f => {
    assert(f.status === 'prep', `${f.id} 状态是筹备中（实际 ${f.status}）`);
    assert((f.checkedDays || 0) === 0, `${f.id} 打卡天数为 0`);
    assert(!f.history || f.history.length === 0, `${f.id} 没有打卡历史`);
    assert(!!f.recruitEndAt, `${f.id} 有真实的招募截止时刻（倒计时能走）`);
  });
  /* 横条而不是大卡片 */
  const strip = run(`(function(){ var f = recruitingFlags()[0]; return recruitStrip(f); })()`);
  assert(/recruit-strip/.test(strip), '广场招募视图渲染的是 .recruit-strip 横条');
  assert(/我想参加/.test(strip), '横条按钮文案是「我想参加」');
  assert(!/T0|T1|T2|T3/.test(strip.replace(/<[^>]*>/g, ' ')), '横条不展示档位');
  assert(!/招募还剩/.test(strip), '横条没有「招募还剩」四个字');
  assert(/data-go="recruitDetail"/.test(strip), '横条整行点进招募详情页');
  assert(/data-recruit-clock/.test(strip), '横条带真实倒计时');
  /* 广场视图分流 */
  assert(/view === 'recruit'/.test(pagesSrc), '广场按视图分流渲染');
  assert(/recruit-list/.test(cssSrc), 'CSS 有 .recruit-list');
}

/* ============================================================
   ④ 新增「招募详情」页
   ============================================================ */
console.log('\n=== ④ 招募详情页 ===');
{
  run("initState(); inject('veteran');");
  const fid = run('recruitingFlags()[0].id');
  const html = run(`PAGES.recruitDetail(${JSON.stringify(fid)})`);
  assert(/招募详情/.test(html), '页面标题是「招募详情」');
  assert(/data-go="userProfile"/.test(html), '发起人头像可点进用户主页');
  assert(/rd-goal/.test(html), '展示「他立的 Flag 是什么」');
  assert(/rd-status/.test(html), '展示「招募状态」');
  assert(/已有见证席/.test(html), '状态里有「已有见证席」');
  assert(/已报名/.test(html), '状态里有「已报名」');
  assert(/招募截止/.test(html), '状态里有「招募截止」');
  assert(/已经报名的人/.test(html), '展示「已经报名的人」（公开名单）');
  assert(/data-act="applyJoinWitness"/.test(html), '底部有「我想参加」按钮');
  assert(/data-recruit-clock/.test(html), '招募截止是真实倒计时');
  /* 路由 */
  assert(/recruitDetail/.test(appSrc), 'app.js 路由表有 recruitDetail');
  assert(/recruitDetail:\{/.test(appSrc), 'recruitDetail 有路由条目');
  /* 报名者数据按局存 —— 这一页要读得到 */
  assert(/recruitApplicants/.test(dataSrc), '每个局存了自己的报名者名单');
  assert(/RECRUIT_APPLICANTS_SEED/.test(dataSrc), '种子里有各局的报名者');
}

/* ============================================================
   ⑤ 目标详情：打卡日历默认收起 + 留言做成轮播
   ============================================================ */
console.log('\n=== ⑤ 日历收起 + 留言轮播 ===');
{
  run("initState(); inject('veteran');");
  const html = run("PAGES.flagDetail('f_9')");
  assert(/cal-fold-btn/.test(html), '打卡日历有折叠头');
  assert(/data-fold="cal"/.test(html), '打卡日历包在 .fold 里');
  assert(!/data-fold="cal"[^>]*class="open"/.test(html), '打卡日历默认是收起的（没有 open）');
  assert(/打卡日历 · /.test(html), '折叠头写了一句话摘要（几/几天 · 断几次）');
  /* 留言轮播 */
  assert(/msg-ticker/.test(html), '留言入口是轮播块 .msg-ticker');
  assert(/mt-item/.test(html), '轮播里有留言条目');
  assert(/data-ticker="1"/.test(html), '轮播块带 data-ticker');
  assert(/@keyframes|transition:opacity/.test(cssSrc), 'CSS 有轮播的淡入淡出');
  assert(/function bindMsgTicker/.test(appSrc), 'app.js 有 bindMsgTicker');
  /* 零条留言时退回成「说点什么…」按钮 */
  run('initState();');
  const empty = run("PAGES.flagDetail('f_4')");
  assert(/class="msg-entry"/.test(empty), '没有留言时退回成「说点什么…」按钮');
}

/* ============================================================
   ⑥ 立 Flag 从 4 步合并成 3 步
   ============================================================ */
console.log('\n=== ⑥ 立 Flag 合并成 3 步 ===');
{
  assert(!/createPay:\{/.test(appSrc), '路由表没有 createPay（第 4 步已删）');
  assert(!/PAGES\.createPay\s*=/.test(pagesSrc), '页面没有 PAGES.createPay');
  assert(!/case 'nextCreateDeposit'/.test(appSrc), '没有「第 3 步 → 第 4 步」这个动作');
  assert(/case 'confirmPayAndSubmit'/.test(appSrc), '第 3 步点「确认支付」→ 二次确认');
  /* 二次确认里必须说清那三件事（见证人不是来使绊的） */
  const cpa = appSrc.match(/case 'confirmPayAndSubmit'[\s\S]{0,1500}/)[0];
  assert(/公开生效/.test(cpa), '二次确认里说了「公开生效」');
  assert(/24 小时/.test(cpa), '二次确认里说了「24 小时」');
  assert(/不会影响你的目标能不能达成/.test(cpa), '二次确认里说了「见证人不影响目标达成」');
  /* ⚠️ 2026-11-24（本轮）：账目汇总块整块删掉了 ——
     用户口径：「删除页面内『目标周期、押金、挣了 / 亏了』这一整块信息，不再展示。」 */
  const dep = run('PAGES.createDeposit()');
  assert(/失败你会损失/.test(dep), '第 3 步有「失败你会损失」卡');
  assert(!/挣了（达标）/.test(dep), '账目汇总块已删（挣了）');
  assert(!/亏了（失败）/.test(dep), '账目汇总块已删（亏了）');
  assert(!/bar-row/.test(dep), '账目汇总块已删（整块）');
  assert(!/押金区间明细/.test(dep), '「押金区间明细」折叠块删了');
  assert(/微信支付/.test(dep), '支付方式搬进第 3 步');
  assert(/data-check="createDeposit"/.test(dep), '打钩确认在第 3 步');
  assert(/确认支付/.test(dep), '第 3 步底部按钮是「确认支付」');
  /* 步骤条三个 */
  const wiz = pagesSrc.match(/const names = \[([^\]]*)\]/)[1];
  assert(wiz.split(',').length === 3, '步骤条只有 3 步');
}

/* ============================================================
   ⑦ 「我的」页删掉「见证席候选池」
   ============================================================ */
console.log('\n=== ⑦ 我的页删掉见证席候选池 ===');
{
  run("initState(); inject('veteran');");
  const html = run('PAGES.profile()');
  assert(!/data-go="witnessPool"/.test(html), '「我的」页没有「见证席候选池」这一行');
  assert(/data-go="verdict"/.test(html), '「我的」页还有「见证席面板」');
  assert(/data-go="subs"/.test(html), '「我的」页还有「我监督的局」');
  /* 候选池页面本身保留（首页筹备期还要用） */
  assert(/PAGES\.witnessPool\s*=/.test(pagesSrc), '见证席候选池页面本身保留（首页入口要用）');
  assert(/witnessPool:\{/.test(appSrc), 'witnessPool 路由还在');
}

console.log('\n' + (fails ? `❌ ${fails} 条失败` : '✅ 全部通过'));
process.exit(fails ? 1 : 0);
