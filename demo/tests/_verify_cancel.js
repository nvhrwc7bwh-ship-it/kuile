/* 取消 Flag 专项巡检（见需求规格 R1.6）
   —— 断言「同一时间只能有一个进行中的 Flag」+ 取消入口 + 二次确认 + 失败口径结算 */
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

vm.runInContext('initState()', sandbox);
vm.runInContext("INJECTORS.newUserWithFlags()", sandbox);

const canCancelFlag = vm.runInContext('canCancelFlag', sandbox);
const canCreateFlag = vm.runInContext('canCreateFlag', sandbox);
const cancelMyFlag  = vm.runInContext('cancelMyFlag', sandbox);
const myActiveFlags = vm.runInContext('myActiveFlags', sandbox);

/* ─────────────────────────────────────────────
   1. 规则函数存在
   ───────────────────────────────────────────── */
console.log('=== 1. 规则函数 ===');
check(/function canCancelFlag\(/.test(stateSrc), 'state.js 有 canCancelFlag(f)');
check(/function cancelMyFlag\(/.test(stateSrc), 'state.js 有 cancelMyFlag(flagId)');
check(/function canCreateFlag\(/.test(stateSrc), 'state.js 有 canCreateFlag()');
check(/function myActiveFlags\(/.test(stateSrc), 'state.js 有 myActiveFlags()');

/* ─────────────────────────────────────────────
   2. 同一时间只能有一个进行中的 Flag
   ───────────────────────────────────────────── */
console.log('\n=== 2. 同时只能有一个进行中的 Flag ===');
const active = myActiveFlags();
check(active.length === 1, `种子里只有 1 个进行中的 Flag（实际 ${active.length}）`);
check(canCreateFlag().ok === false, '有进行中的 Flag 时 canCreateFlag() = false');
check(!!canCreateFlag().current, 'canCreateFlag() 返回当前占着的那个 Flag');

// 全空时应该可以立
vm.runInContext('initState()', sandbox);
check(canCreateFlag().ok === true, '没有任何 Flag 时 canCreateFlag() = true');
check(canCancelFlag(null).ok === false, 'canCancelFlag(null) = false');
// 别人的 Flag 不能取消
const FLAGS = vm.runInContext('FLAGS', sandbox);
check(canCancelFlag(FLAGS.f_3).ok === false, '别人的 Flag 不能取消');
// 已结束的不能取消
check(canCancelFlag(FLAGS.f_5).ok === false, '已结束的 Flag 不能取消');

/* ─────────────────────────────────────────────
   3. 取消入口（不显眼）
   ───────────────────────────────────────────── */
console.log('\n=== 3. 取消入口 ===');
vm.runInContext("INJECTORS.newUserWithFlags()", sandbox);
const myFlagsHtml = PAGES.myFlags();
check(/data-act="doCancelFlag"/.test(myFlagsHtml), '「我的 Flag」页面有取消按钮');
check(/class="cancel-link"/.test(myFlagsHtml), '取消按钮用 .cancel-link 样式（淡色小字）');
check(/取消这个 Flag/.test(myFlagsHtml), '取消按钮文案是「取消这个 Flag」');
// 按钮要低调 —— 不能做成主按钮
check(!/class="btn[^"]*"[^>]*data-act="doCancelFlag"/.test(myFlagsHtml), '取消按钮不是 .btn 主按钮样式');
check(/\.cancel-link\{/.test(cssSrc), 'CSS 定义 .cancel-link');
check(/color:var\(--ink-4\)/.test(cssSrc.match(/\.cancel-link\{[\s\S]*?\}/)[0]), '.cancel-link 用最淡的 ink-4（不显眼）');

// 详情页也有入口
const activeNow = myActiveFlags()[0];
const detailOwn = PAGES.flagDetail(activeNow.id);
check(/data-act="doCancelFlag"/.test(detailOwn), '目标详情页有取消入口');
/* ⚠️ 2026-11-24（本轮，用户口径 Part II⑥）：小字文案改成
   「取消这个 Flag 需按未达标结算，押金不退还」，并且**居中对齐**。 */
check(/取消这个 Flag 需按未达标结算，押金不退还/.test(detailOwn), '详情页写明「取消这个 Flag 需按未达标结算，押金不退还」');
/* 居中：.fd-cancel 是 block + text-align:center，小字是独立的 block */
check(/<div class="fd-cancel">[\s\S]*?class="fd-cancel-hint">/.test(detailOwn), '详情页取消小字是独立的块（可居中）');
const cssSrc2 = cssSrc;
check(/\.fd-cancel\{[^}]*text-align:center/.test(cssSrc2), 'CSS：.fd-cancel 整体居中');
check(/\.fd-cancel-hint\{[^}]*text-align:center/.test(cssSrc2), 'CSS：.fd-cancel-hint 小字居中');
// 别人的详情页不能有
const detailOther = PAGES.flagDetail('f_3');
check(!/data-act="doCancelFlag"/.test(detailOther), '别人的 Flag 详情页没有取消入口');

/* ─────────────────────────────────────────────
   4. 二次确认弹窗
   ───────────────────────────────────────────── */
console.log('\n=== 4. 二次确认弹窗 ===');
check(/case 'doCancelFlag'/.test(appSrc), 'app.js 有 doCancelFlag 动作');
/* 按下标切出 doCancelFlag 这个 case 的完整代码块（正则会被块里提前出现的 return 截断） */
const cancelStart = appSrc.indexOf("case 'doCancelFlag'");
const cancelEnd = appSrc.indexOf("\n    case '", cancelStart + 10);
const cancelCase = appSrc.slice(cancelStart, cancelEnd);
check(/dialog\(/.test(cancelCase), 'doCancelFlag 用 dialog 弹二次确认');
check(/不可撤销/.test(cancelCase), '弹窗写明「不可撤销」');
check(/不退还/.test(cancelCase), '弹窗写明押金「不退还」');
check(/未达标/.test(cancelCase), '弹窗写明按「未达标」结算');
check(/确认取消/.test(cancelCase), '确认按钮文案是「确认取消」');
/* 二次确认 = 必须先弹窗、点了确认才真的取消 */
check(cancelCase.indexOf('dialog(') < cancelCase.indexOf('cancelMyFlag('),
  '先弹窗、后执行 —— 取消不是一点就生效');

/* ─────────────────────────────────────────────
   5. 取消 = 按失败结算（押金扣收 + 信用分扣减）
   ───────────────────────────────────────────── */
console.log('\n=== 5. 取消后按失败结算 ===');
vm.runInContext("INJECTORS.newUserWithFlags()", sandbox);
const myActive = myActiveFlags()[0];
const creditBefore = vm.runInContext('STATE.credit', sandbox);
const depBefore = myActive.deposit;

const r = cancelMyFlag(myActive.id);
check(!!r && r.ok === true, '取消成功');
check(myActive.status === 'failed', '取消后状态 = failed');
check(myActive.canceled === true, '取消后标记 canceled');
check(myActive.failedReason === '发起人主动取消', '失败原因是「发起人主动取消」');
check(myActive.lostAmount > 0, `记了实际损失金额（${myActive.lostAmount} 元）`);
check(r.creditDelta < 0, `信用分扣减为负（${r.creditDelta}）`);
check(vm.runInContext('STATE.credit', sandbox) < creditBefore, '信用分真的掉了');

// 押金按信用比例扣收
const ct = vm.runInContext('creditTierOf', sandbox)(creditBefore);
const expectLoss = Math.round(depBefore * ct.rate / 100);
check(r.loss === expectLoss, `押金损失 = 押金 × 信用费率（${expectLoss} 元）`);

// 取消后可以再立新的
check(canCreateFlag().ok === true, '取消后可以立新的 Flag');
check(myActiveFlags().length === 0, '取消后没有进行中的 Flag 了');

// 已取消的不能再取消
const r2 = cancelMyFlag(myActive.id);
check(r2 && r2.ok === false, '已取消的 Flag 不能重复取消');

/* ─────────────────────────────────────────────
   6. 入口拦截：不能绕过
   ───────────────────────────────────────────── */
console.log('\n=== 6. 入口拦截 ===');
check(/if \(\(target === 'create' \|\| target === 'createGoal'\) && !canCreateFlag\(\)\.ok\)/.test(appSrc),
  'app.js 在跳转发起页时拦截（有进行中的 Flag 就不让进）');
check(/const gate = canCreateFlag\(\)/.test(appSrc), 'submitFlag 里也有最后一道闸');
check(/doCancelFlag/.test(appSrc.match(/const NEED_LOGIN_ACTS = \[[\s\S]*?\]/)[0]), '取消动作需要登录');

/* ─────────────────────────────────────────────
   7. 页面呈现
   ───────────────────────────────────────────── */
console.log('\n=== 7. 页面呈现 ===');
vm.runInContext("INJECTORS.newUserWithFlags()", sandbox);
const homeHtml = PAGES.home();
/* ⚠️ 2026-11-21 用户要求：首页删掉「同一时间只能立一个 Flag」降级提示块 + 「我的数据」块 */
check(!/同一时间只能立一个 Flag/.test(homeHtml), '首页不再出现「同一时间只能立一个 Flag」提示');
check(!/<div class="cta-card off">/.test(homeHtml), '首页删除了降级态 CTA 块');
check(!/我的数据/.test(homeHtml), '首页删除了「我的数据」块');
check(!/展开明细/.test(homeHtml), '首页删除了「展开明细」折叠');
check(!/home-mine/.test(homeHtml), '首页删除了 home-mine 折叠');
/* 有进行中的 Flag 时，首页连「立一个新的 Flag」入口都不出（约束由发起页拦截 + 取消入口承担） */
check(!/立一个新的 Flag/.test(homeHtml), '有进行中的 Flag 时首页不出「立一个新的 Flag」入口');

const myFlags2 = PAGES.myFlags();
check(/同一时间只能有/.test(myFlags2), '「我的 Flag」页面提示同一时间只能有一个');
check(/disabled/.test(myFlags2), '「立一个新的 Flag」按钮在有进行中的 Flag 时是 disabled');

/* ⚠️ 2026-11-24（本轮，用户口径 Part II⑦）：「我的 Flag」菜单页（flagMenu）
   里的「取消这个 Flag」选项**已删除** —— 所以这里反过来断言它不存在。 */
const menuHtml = PAGES.flagMenu('f_new_1').replace(/<!--[\s\S]*?-->/g, '');
check(!/data-act="doCancelFlag"/.test(menuHtml), '「我的 Flag」菜单页不再有取消按钮（Part II⑦ 已删）');
check(!/取消这个 Flag/.test(menuHtml), '「我的 Flag」菜单页不再有「取消这个 Flag」文案');
check(!/押金不退还/.test(menuHtml), '「我的 Flag」菜单页不再写押金不退还');
check(!/积分不返还/.test(menuHtml), '「我的 Flag」菜单页不再写积分不返还');
check(!/fm-cancel/.test(menuHtml), '「我的 Flag」菜单页不再有 .fm-cancel 取消块');
/* ⚠️ 菜单页的其他三项保留 */
check(/打卡历史/.test(menuHtml), '「我的 Flag」菜单页保留「打卡历史」');
check(/立据/.test(menuHtml), '「我的 Flag」菜单页保留「立据」凭证');
check(/分享/.test(menuHtml), '「我的 Flag」菜单页保留「分享」');

// 状态胶囊：已取消要说清楚
const seedCancelled = vm.runInContext("STATE.myFlags.find(f => f.canceled)", sandbox);
check(!!seedCancelled, '种子里有一个已取消的 Flag');
const pillHtml = PAGES.myFlags();
check(/已取消/.test(pillHtml), '已取消的 Flag 状态胶囊显示「已取消」');

console.log(fails === 0 ? '\n✅ 全部通过' : `\n❌ ${fails} 项失败`);
process.exit(fails === 0 ? 0 : 1);
