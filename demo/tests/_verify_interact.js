/* ============================================================
   交互逻辑走查修复复验（2026-11-24）
   —— 这一轮修了 9 个问题，每个配一组断言，防止以后被改回去：
     ① 异议提交接上 submitObjection()（原来只有 data-toast，异议根本没进库）
     ② 同一天不能重复打卡
     ③ 「全部已读」按钮的出现条件
     ④ 「我想参加」等责任动作要拦登录
     ⑤ 点「去判定/查看」要把该条通知标记已读
     ⑥ 「已判定」通知不带跳转目标
     ⑨ 广场招募视图的「参加」死分支删掉了
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
  closest(){ return null; },
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
sandbox.ICON = new Proxy({}, { get: () => '<svg class="stub"></svg>' });
sandbox.ic = () => '';
/* pages.js 里的页面函数会用 app.js 定义的 route / routeId —— 这里给个桩 */
sandbox.route = 'home';
sandbox.routeId = null;
sandbox.routeDay = null;
vm.createContext(sandbox);
for (const f of ['info.js','avatars.js','data.js','state.js','pages.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js',f),'utf8'), sandbox, { filename: f });
}
const run = (code) => vm.runInContext(code, sandbox);

/* ============================================================
   ① 异议提交要真的进库
   ============================================================ */
console.log('\n=== ① 异议提交（原来只有 data-toast，异议根本没进库） ===');
{
  /* 1.1 UI 上不能只有 data-toast */
  run("initState(); inject('veteran');");
  const objHtml = run("PAGES.objection()");
  assert(/data-act="submitObjection"/.test(objHtml), '异议页按钮走 submitObjection 动作（不是 data-toast）');
  assert(!/data-toast="异议已提交/.test(objHtml), '异议页不再只有 data-toast');

  /* 1.2 app.js 里必须有这个动作的处理分支 */
  assert(/case 'submitObjection'/.test(appSrc), 'app.js 有 submitObjection 动作分支');
  assert(/submitObjection\(\{/.test(appSrc), '动作里真的调用了 state 的 submitObjection()');

  /* 1.3 理由开关要能收集 —— 带 data-obj-reason */
  assert(/data-obj-reason=/.test(objHtml), '理由开关带 data-obj-reason（能收集用户选了哪几条）');
  assert(/OBJECTION_REASONS/.test(pagesSrc), '理由清单抽成了 OBJECTION_REASONS');
  assert(/const OBJECTION_REASONS/.test(dataSrc), 'OBJECTION_REASONS 定义在 data.js');

  /* 1.4 「当前进度」不能写死 1 / 3 —— 查源码（渲染结果依赖有没有投过异议） */
  assert(!/1 \/ 3 票<\/div>/.test(pagesSrc), '「当前进度」不再是写死的 1 / 3 票');
  assert(/objectionsOf\(f\.id\)/.test(pagesSrc), '「当前进度」读的是真实的异议记录');
  assert(/\$\{o\.votes \|\| 0\} \/ \$\{need\} 票/.test(pagesSrc), '票数是按真实记录渲染的');

  /* 1.5 提交后要真的进库 —— 走一遍完整链路 */
  run("initState();");
  const r = run("submitObjection({flagId:'f_3', reason:'体重秤读数被修改', ts:'刚刚'})");
  assert(r && r.ok === true, 'submitObjection() 提交成功');
  assert(run("(STATE.objections||[]).length") === 1, '异议真的进了 STATE.objections');
  assert(run("(STATE.objections||[])[0].myVote") === true, '新异议标记为「我投的」');
  assert(run("(STATE.objections||[])[0].status") === 'waiting', '新异议状态是「等待投票」');

  /* 1.6 3 票上限还在 */
  run("initState(); submitObjection({flagId:'f_3', reason:'a'}); submitObjection({flagId:'f_3', reason:'b'}); submitObjection({flagId:'f_3', reason:'c'});");
  const r4 = run("submitObjection({flagId:'f_3', reason:'d'})");
  assert(r4 && r4.ok === false, '同一局第 4 次异议被拒（3 票上限）');
}

/* ============================================================
   ② 同一天不能重复打卡
   ============================================================ */
console.log('\n=== ② 同一天不能重复打卡 ===');
{
  run("initState(); inject('newUserWithFlags');");
  const f = run("myMainFlag()");
  const before = run(`myMainFlag().checkedDays`);
  const streakBefore = run(`myMainFlag().streak`);
  /* 打第一次 */
  run(`doCheckin(myMainFlag().id, 60.0)`);
  const after1 = run(`myMainFlag().checkedDays`);
  assert(after1 === before + 1, `第一次打卡成功（${before} → ${after1} 天）`);

  /* 打第二次 —— 必须被拦下 */
  const r2 = run(`doCheckin(myMainFlag().id, 59.9)`);
  assert(r2 && r2.ok === false, '同一天第二次打卡被拦下');
  assert(run(`myMainFlag().checkedDays`) === after1, '打卡天数没有再 +1');
  assert(run(`myMainFlag().streak`) === streakBefore + 1, '连续天数没有虚增');

  /* 打卡页在已打卡时不该再渲染「提交打卡」 */
  const ciHtml = run("PAGES.checkin()");
  assert(/今天已经打过卡了/.test(ciHtml), '打卡页在已打卡时显示「今天已经打过卡了」');
  assert(!/data-act="doCheckin"/.test(ciHtml), '已打卡时没有「提交打卡」按钮');
  assert(/data-go="checkinLog"/.test(ciHtml), '已打卡时给的是「看打卡记录」入口');

  /* app.js 的动作分支也要挡一道 */
  assert(/if \(checkedToday\(f\)\)/.test(appSrc), 'app.js 的 doCheckin 分支也挡了「今天已打卡」');
}

/* ============================================================
   ③ 「全部已读」按钮的出现条件
   ============================================================ */
console.log('\n=== ③ 「全部已读」按钮的出现条件 ===');
{
  /* 关键场景：只有现算通知（STATE.notifs 是空的），角标有数字但按钮必须出现 */
  run("initState(); inject('witness');");
  assert(run("(STATE.notifs||[]).length") === 0, '这个场景下 STATE.notifs 是空的（只有现算通知）');
  assert(run("unreadNotifCount()") > 0, `但未读数是 ${run("unreadNotifCount()")}`);
  const html = run("PAGES.notifs()");
  assert(/data-act="readAllNotifs"/.test(html), '有未读时「全部已读」按钮出现（不再依赖 STATE.notifs.length）');
  assert(!/STATE\.notifs\.length \?/.test(pagesSrc), '源码里不再用 STATE.notifs.length 判断');

  /* 全部读完后按钮应该消失 */
  run("markAllNotifsRead();");
  const html2 = run("PAGES.notifs()");
  assert(!/data-act="readAllNotifs"/.test(html2), '全部读完后「全部已读」按钮消失');
}

/* ============================================================
   ④ 责任动作要拦登录
   ============================================================ */
console.log('\n=== ④ 责任动作要拦登录 ===');
{
  const need = (appSrc.match(/const NEED_LOGIN_ACTS = \[([\s\S]*?)\];/) || [])[1] || '';
  ['applyJoinWitness', 'replyInvite', 'declineInvite', 'openVerdictPicker'].forEach(a => {
    assert(new RegExp(`'${a}'`).test(need), `「${a}」在登录拦截名单里`);
  });
  /* 抽查没被误伤 */
  ['doFeedLike', 'doFollow', 'likeMsg'].forEach(a => {
    assert(!new RegExp(`'${a}'`).test(need), `「${a}」是围观层动作，不该被拦`);
  });
  /* ⚠️ 提异议【不能】拦登录 —— 需求规格 R0.2 / R4.1：
     监督席 = 匿名围观者，能提异议。异议的账记在平台侧，匿名也能记。 */
  assert(!/'submitObjection'/.test(need), '「submitObjection」不拦登录（监督席异议本就是匿名围观层动作，R4.1）');
}

/* ============================================================
   ⑤ 点「去判定/查看」要标记已读
   ============================================================ */
console.log('\n=== ⑤ 点动作按钮要把该条通知标记已读 ===');
{
  assert(/function markClickedNotifRead/.test(appSrc), '有 markClickedNotifRead 辅助函数');
  ['goVerdict', 'goObjection', 'goGeneric', 'replyInvite', 'declineInvite'].forEach(a => {
    const seg = appSrc.split(`case '${a}':`)[1] || '';
    const body = seg.split('\n    case ')[0];
    assert(/markClickedNotifRead\(el\)/.test(body), `「${a}」里调了 markClickedNotifRead(el)`);
  });
  /* 行为验证：标记后未读数下降 */
  run("initState(); inject('veteran');");
  const n1 = run("unreadNotifCount()");
  const key = run("actionNotifs().filter(function(n){return n.key.indexOf('task:')===0;})[0].key");
  run(`markNotifRead(${JSON.stringify(key)})`);
  assert(run("unreadNotifCount()") === n1 - 1, `标记后未读数 ${n1} → ${run("unreadNotifCount()")}`);
}

/* ============================================================
   ⑥ 「已判定」通知不带跳转目标
   ============================================================ */
console.log('\n=== ⑥ 「已判定」通知不带跳转目标 ===');
{
  run("initState(); inject('veteran');");
  const done = run("actionNotifs().filter(function(n){return n.done;})[0]");
  assert(!!done, '有一条「已判定」的通知');
  assert(done.go === '', '「已判定」不带跳转目标（点它只标已读，不跳去需登录的面板）');
  assert(done.goId === '', '「已判定」也没有 goId');

  /* 种子里的 vt3 要有 verdictAt —— 否则显示「刚刚」，一条几周前的判定显示「刚刚」是错的 */
  const vt3 = run("MY_VERDICT_TASKS.filter(function(t){return t.id==='vt3';})[0]");
  assert(!!vt3.verdictAt, `种子 vt3 补了 verdictAt（${vt3.verdictAt}）`);
  const doneTs = run("actionNotifs().filter(function(n){return n.done;})[0].ts");
  assert(doneTs && doneTs !== '刚刚', `「已判定」显示的是真实时间（${doneTs}），不是「刚刚」`);
}

/* ============================================================
   ⑨ 广场招募视图的死分支删掉了
   ============================================================ */
console.log('\n=== ⑨ 广场招募视图的死分支 ===');
{
  /* feedCard 函数体里不该再有招募视图的分支 —— 用函数体切片来判，别扫全文 */
  const feedCardBody = (pagesSrc.split('function feedCard(f) {')[1] || '').split('\nfunction ')[0];
  assert(!/view === 'recruit'/.test(feedCardBody), 'feedCard 里没有招募视图的死分支');
  assert(!/feed-join/.test(pagesSrc), '模板里不再有 .feed-join');
  assert(!/\.feed-join\{/.test(cssSrc), 'CSS 里不再有 .feed-join 规则');
  assert(/function feedCard\(f\)/.test(pagesSrc), 'feedCard 不再带用不到的 view 参数');
  /* 招募视图本身还在，走横条 —— 切到 recruit 视图再看 */
  run("setSquareView('recruit');");
  const sq = run("PAGES.square()");
  assert(/recruit-list/.test(sq), '广场的招募视图还在（走横条）');
  assert(/我想参加/.test(run("recruitStrip(FLAGS.f_2)")), '横条上有「我想参加」按钮');
}

console.log('\n' + (fails ? `❌ ${fails} 条断言失败` : '✅ 全部通过'));
process.exit(fails ? 1 : 0);
