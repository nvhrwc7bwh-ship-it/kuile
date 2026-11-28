/* 通知 Tab 巡检（2026-11-24 本轮新增）
   —— 断言：底部 Tab 换成了「通知」、分两栏、见证席邀请闭环补上了 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const fakeEl = () => ({
  style: {}, dataset: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
  appendChild(){}, removeChild(){}, addEventListener(){}, removeEventListener(){},
  setAttribute(){}, getAttribute(){ return null; }, querySelector: () => fakeEl(),
  querySelectorAll: () => [], remove(){}, innerHTML: '', textContent: '',
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
};
vm.createContext(sandbox);
for (const f of ['info.js','avatars.js','data.js','state.js','pages.js','app.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js',f),'utf8'), sandbox, { filename: f });
}
const PAGES = vm.runInContext('PAGES', sandbox);
const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js','app.js'),'utf8');
const pagesSrc = fs.readFileSync(path.join(__dirname, '..', 'js','pages.js'),'utf8');
const stateSrc = fs.readFileSync(path.join(__dirname, '..', 'js','state.js'),'utf8');
const cssSrc = fs.readFileSync(path.join(__dirname, '..', 'css','app.css'),'utf8');

let fails = 0;
function check(cond, msg){
  if(!cond){ console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}

/* 先初始化状态 —— 页面渲染函数依赖 STATE */
vm.runInContext('initState()', sandbox);
vm.runInContext("INJECTORS.newUserWithFlags()", sandbox);
vm.runInContext("INJECTORS.subscribe()", sandbox);

console.log('\n=== ① 底部 Tab 换成了「通知」 ===');
check(/key:'notifs'/.test(appSrc), 'TABS 里有 notifs');
check(/icon:'bell'/.test(appSrc), '通知 tab 用铃铛图标');
check(/label:'通知'/.test(appSrc), '通知 tab 标签是「通知」');
check(!/key:'subs'/.test(appSrc), 'TABS 里不再有「监督」tab');
check(/notifs:\{t:'通知',r:'notifs',tab:'notifs'\}/.test(appSrc), '通知路由归属 notifs 这个 tab');
check(/tabStack = \{home:\[\],square:\[\],notifs:\[\],me:\[\]\}/.test(appSrc), 'tabStack 换掉了 subs');
check(/badge:'notif'/.test(appSrc), '通知 tab 带角标标记');
check(/class="tab-badge"/.test(appSrc), '底栏渲染未读角标');
check(/unreadNotifCount\(\)/.test(appSrc), '角标用 unreadNotifCount()');

console.log('\n=== ② 通知页分两栏 ===');
check(/function notifRow\(/.test(pagesSrc), 'pages.js 有 notifRow()');
check(/判定·邀请/.test(pagesSrc), '第二栏叫「判定·邀请」');
check(/data-act="setNotifTab"/.test(pagesSrc), '切换栏目的动作是 setNotifTab');
check(/case 'setNotifTab'/.test(appSrc), 'app.js 有 setNotifTab 动作');
check(/function setNotifTab\(/.test(stateSrc), 'state.js 有 setNotifTab()');
check(/function notifTab\(/.test(stateSrc), 'state.js 有 notifTab()');
check(/function actionNotifs\(/.test(stateSrc), 'state.js 有 actionNotifs()');
check(/function notifsOf\(/.test(stateSrc), 'state.js 有 notifsOf()');
check(/\.notif-row\{/.test(cssSrc), 'CSS 定义 .notif-row');
check(/\.notif-seg\{/.test(cssSrc), 'CSS 定义 .notif-seg');
check(/\.notif-act\{/.test(cssSrc), 'CSS 定义 .notif-act');

console.log('\n=== ③ 「我监督的局」挪进「我的」页，「我提的异议」挪进通知 ===');
const profileHtml = PAGES.profile();
check(/data-go="subs"/.test(profileHtml), '「我的」页有「我监督的局」入口');
check(/我监督的局/.test(profileHtml), '入口标题是「我监督的局」');
const subsHtml = PAGES.subs();
check(!/我提的异议/.test(subsHtml), '监督页不再有「我提的异议」');
check(!/class="switch/.test(subsHtml), '监督页没有假开关');
check(/我提的异议/.test(PAGES.notifs()), '通知页有「我提的异议」');

console.log('\n=== ④ 通知承诺说明挪到「我的」页法律与安全区 ===');
check(/断卡、判负、结算会通知你/.test(profileHtml), '「我的」页写明断卡/判负/结算会提醒');
check(/每日打卡不提醒/.test(profileHtml), '「我的」页写明每日打卡不提醒');
check(!/断卡提醒/.test(subsHtml), '监督页不再有「断卡提醒」行');

console.log('\n=== ⑤ 见证席邀请闭环 ===');
check(/witnessInvites/.test(stateSrc), 'STATE 有 witnessInvites');
check(/function replyWitnessInvite\(/.test(stateSrc), 'state.js 有 replyWitnessInvite()');
check(/function myWitnessInvites\(/.test(stateSrc), 'state.js 有 myWitnessInvites()');
check(/case 'replyInvite'/.test(appSrc), 'app.js 有 replyInvite 动作');
check(/case 'declineInvite'/.test(appSrc), 'app.js 有 declineInvite 动作');
check(/invited\(\)/.test(stateSrc), 'INJECTORS 有 invited 场景');
check(/k: 'invited'/.test(fs.readFileSync(path.join(__dirname, '..', 'js','devpanel.js'),'utf8')), '演示面板有「+被邀请」');

console.log('\n=== ⑥ 运行时行为 ===');
vm.runInContext('initState()', sandbox);
vm.runInContext("INJECTORS.newUserWithFlags()", sandbox);
vm.runInContext("INJECTORS.invited()", sandbox);
const nHtml = PAGES.notifs();
check(/邀请你当见证席/.test(nHtml), '通知页显示见证席邀请');
check(/接受/.test(nHtml) && /拒绝/.test(nHtml), '邀请带「接受 / 拒绝」两个动作');
check(/已过期/.test(nHtml), '过期邀请显示灰态');

/* 切到第二栏 */
vm.runInContext("setNotifTab('action')", sandbox);
const actHtml = PAGES.notifs();
check(/邀请你当见证席/.test(actHtml), '「判定·邀请」栏里有见证席邀请');
check(/接受/.test(actHtml), '「判定·邀请」栏里能接受');

/* 接受邀请 → 进入见证 */
vm.runInContext("replyWitnessInvite('f_3', true)", sandbox);
check(vm.runInContext("(STATE.witnessInvites||[]).find(x=>x.flagId==='f_3').status", sandbox) === 'accepted', '接受后状态变成 accepted');
check(vm.runInContext("(STATE.witnessing||[]).includes('f_3')", sandbox) === true, '接受后我就在见证这一局');

/* 拒绝邀请 */
vm.runInContext("replyWitnessInvite('f_9', false)", sandbox);
check(vm.runInContext("(STATE.witnessInvites||[]).find(x=>x.flagId==='f_9').status", sandbox) === 'declined', '拒绝后状态变成 declined');

/* 未读数 */
vm.runInContext("INJECTORS.witness()", sandbox);
check(vm.runInContext("unreadNotifCount()", sandbox) > 0, '未读数大于 0');
check(vm.runInContext("unreadNotifCountOf('action')", sandbox) > 0, '「判定·邀请」栏未读数大于 0');

console.log('\n=== ⑦ 删掉的页面确实没了 ===');
check(typeof PAGES.interact === 'undefined', '支持与留言页已删');
check(typeof PAGES.depositPick === 'undefined', '选择押金页已删');
check(typeof PAGES.depositPay === 'undefined', '支付押金页已删');
check(typeof PAGES.depositDone === 'undefined', '押金已支付页已删');
check(typeof PAGES.subscribe === 'undefined', '「监督这一局」页已删');

console.log('\n=== ⑧ 两栏对得上：标了 cat:"action" 的通知必须出现在「判定·邀请」栏 ===');
vm.runInContext('initState()', sandbox);
vm.runInContext('INJECTORS.notifs()', sandbox);
vm.runInContext("setNotifTab('all')", sandbox);
const allHtml = PAGES.notifs();
vm.runInContext("setNotifTab('action')", sandbox);
const actHtml2 = PAGES.notifs();
check(/待你判定/.test(allHtml), '「全部」栏里有「待你判定」这条');
check(/待你判定/.test(actHtml2), '「判定·邀请」栏里也有「待你判定」这条（两栏一致）');
/* 同一条不能在「全部」栏出现两次 */
const cnt = (allHtml.match(/待你判定/g) || []).length;
check(cnt === 1, '「全部」栏里「待你判定」只出现一次（去重生效）');

console.log('\n=== ⑨ 通知上的动作按钮都有对应处理（不是死按钮） ===');
check(/case 'goVerdict'/.test(appSrc), 'app.js 有 goVerdict 动作');
check(/case 'goObjection'/.test(appSrc), 'app.js 有 goObjection 动作');
check(/case 'goGeneric'/.test(appSrc), 'app.js 有 goGeneric 动作');
check(/data-go="\$\{n\.go \|\| ''\}"/.test(pagesSrc), 'notifRow 把跳转目标带在 data-go 上');

console.log('\n=== ⑩ 筛选抽屉的 chip 真的能点（不是死控件） ===');
check(/\$\$\('\.chip', chip\.parentElement\)/.test(appSrc), 'chip 用 $$ 取全部（$ 返回单元素，forEach 会报错）');
check(/querySelector\('#sheetBody'\)/.test(appSrc), '重画抽屉用的是 #sheetBody（不是不存在的 .sheet-body）');

console.log('\n=== ⑪ 弹窗不会叠层（同时只有一个 .dialog） ===');
check(/\$\$\('#screen \.dialog'\)\.forEach/.test(appSrc), 'mountDialog 先把已有弹窗清掉');
check(/old\.remove\(\)/.test(appSrc), '旧弹窗是立刻移除的（不是等 260ms —— 否则点确认会点到旧的）');

console.log('\n=== ⑫ flagTier 兜底 null（以前一个 null 就整页崩） ===');
check(/flag && TIER_META\[flag\.tier\]/.test(fs.readFileSync(path.join(__dirname, '..', 'js','data.js'),'utf8')), 'flagTier 对 null 有兜底');

console.log('\n=== ⑬ 全站每个 data-act 都有处理逻辑（不许有死按钮） ===');
/* ⚠️ 这一条是本轮最有价值的断言 —— R2.23 抓到的「去判定 / 查看」死按钮
   就是这么发现的：界面上有按钮、点了没反应，但没有任何测试能报出来。
   这里把每一页渲染出来的 data-act 收集起来，逐个到 app.js 里查对应处理。 */
const routeKeys = vm.runInContext('Object.keys(ROUTES)', sandbox);
const allActs = new Set();
vm.runInContext('initState()', sandbox);
vm.runInContext('INJECTORS.veteran()', sandbox);
routeKeys.forEach(r => {
  try {
    const h = vm.runInContext(`PAGES[${JSON.stringify(r)}] ? PAGES[${JSON.stringify(r)}]('f_3') : ''`, sandbox);
    if (typeof h !== 'string') return;
    const re = /data-act="([^"]+)"/g;
    let m;
    while ((m = re.exec(h)) !== null) allActs.add(m[1]);
  } catch (e) { /* 某些页需要别的参数，跳过 */ }
});
const missing = [...allActs].filter(a => !appSrc.includes(`case '${a}'`));
check(missing.length === 0, `全站 ${allActs.size} 个 data-act 都有对应处理（缺失：${missing.join(', ') || '无'}）`);
check(allActs.size > 20, `收集到的动作数合理（${allActs.size} 个）`);

console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 全部通过');
process.exit(fails ? 1 : 0);
