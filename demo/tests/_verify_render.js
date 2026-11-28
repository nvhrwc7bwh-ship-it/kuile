/* 渲染巡检（临时）—— 带上 state.js，验证改动后的页面能正常渲染 */
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
vm.runInContext('initState()', sandbox);
vm.runInContext("INJECTORS.newUserWithFlags()", sandbox);
vm.runInContext("INJECTORS.subscribe()", sandbox);
vm.runInContext("INJECTORS.notifs()", sandbox);
vm.runInContext("INJECTORS.supervised()", sandbox);
vm.runInContext("INJECTORS.witness()", sandbox);

let fails = 0;
const problems = [];
for (const name of Object.keys(PAGES)) {
  let html;
  try { html = PAGES[name](); } catch (e) { problems.push(`${name}: RENDER ${e.message}`); continue; }
  const q = (html.match(/"/g)||[]).length;
  if (q % 2) problems.push(`${name}: 引号总数为奇数 (${q})`);
  const spanO = (html.match(/<span[\s>]/g)||[]).length, spanC = (html.match(/<\/span>/g)||[]).length;
  if (spanO !== spanC) problems.push(`${name}: span 不平衡 ${spanO}/${spanC}`);
  const divO = (html.match(/<div[\s>]/g)||[]).length, divC = (html.match(/<\/div>/g)||[]).length;
  if (divO !== divC) problems.push(`${name}: div 不平衡 ${divO}/${divC}`);
  if (/\$\{[^}]*$/.test(html)) problems.push(`${name}: 模板字符串未闭合`);
  if (/undefined|NaN|\[object Object\]/.test(html) && !/agreement|privacy/.test(name)) problems.push(`${name}: 渲染出 undefined / NaN / [object Object]`);
}

if (problems.length){
  console.log('✗ 结构问题：');
  problems.forEach(p => console.log('   - ' + p));
  fails = problems.length;
} else {
  console.log(`✓ ${Object.keys(PAGES).length} 个页面全部渲染通过（无 undefined / 标签不平衡 / 模板未闭合）`);
}

// 抽查改动点是否真的出现在渲染结果里
const detail = PAGES.flagDetail('f_own');
/* ⚠️ 2026-11-24 用户口径：单页快速填写整块删除 —— 立 Flag 只有 3 步分步引导。
   所以「发起页」这一组抽查改到分步引导的对应步骤上。 */
const createGoal = PAGES.createGoal();
const createPeriod = PAGES.createPeriod();
const createDeposit = PAGES.createDeposit();
const create = createGoal + createPeriod + createDeposit;
const witness = PAGES.verdict();
const earnings = PAGES.witnessEarnings();
/* ⚠️ 2026-11-22 用户口径（改）：见证席召集令不再有独立页面 —— 没有 PAGES.recruit。
   它的文案是 recruitCopy()，报名情况是半屏（app.js 的 openRecruitSheet）。 */
const recruit = vm.runInContext('recruitCopy()', sandbox);
const created = PAGES.created('f_own');
const home = PAGES.home ? PAGES.home() : '';
/* app.js 源码（用于断言新增的半屏函数存在） */
const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js','app.js'),'utf8');

function check(cond, msg){
  if(!cond){ console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}
console.log('\n=== 改动点抽查 ===');
check(/中期复核/.test(detail), 'Flag 详情页出现「中期复核」节点');
/* ⚠️ 2026-11-24（本轮，用户口径 Part I⑥）：见证席判定区改成「形式从简」——
   节点条只留圆圈 + 名字，**不再有节点数量提示**、不再有日期 / 已验证数值。 */
check(!/个节点/.test(detail), 'Flag 详情页不再显示节点数量提示');
/* ⚠️ 2026-11-24：节点数 / 见证席坑位这些内容原来在单页发起页上，
   单页删除后它们随「见证席在筹备期里找」一起搬到发起成功页（见 R16）。
   ⚠️ 2026-11-24（再改）：见证席面板正文**不再放任何规则说明** ——
   「判定次数按周期定：7 天 2 个 / 14 天 3 个 / 30 天 4 个 / 90 天 4 个」
   已经搬进右上角「?」弹层（witnessApply），面板里只留节点条（画出来的）。
   —— 所以这里改成【断言面板里没有这段说明】。 */
check(!/7 天 2 个/.test(witness) && !/判定次数按周期定/.test(witness), '见证席面板正文不再放「判定次数按周期定」');
check(/7 天 <b>2<\/b> 个节点/.test(vm.runInContext('INFO.witnessApply', sandbox)), '「判定次数按周期定」在右上角问号弹层里');
check(/陪到底按周期/.test(earnings), '见证席收益页显示陪到底按周期递增');
check(!/在 3 个节点/.test(detail + create + witness + earnings), '改动范围内不再出现「在 3 个节点」');

// ── 见证席机制简化重构（筹备期 / 见证门槛 / 有效档位）──
/* ⚠️ 2026-11-24：见证席不在发起页选了 —— 24 小时筹备期里慢慢找。
   所以「24 小时筹备期」与「坑位计数」现在在【发起成功页】上。 */
check(/筹备期是 <b>24 小时<\/b>/.test(created), '发起成功页显示 24 小时筹备期');
check(/已接受 \d+ 位/.test(created), '发起成功页显示已接受人数');
check(/已占 \d+\/10/.test(created), '发起成功页显示坑位计数（已占 N/10）');
check(/prep-timer/.test(created), '发起成功页显示筹备期倒计时');
check(/data-prep-timer/.test(created), '发起成功页倒计时绑定真实时钟');
check(/我押了 500 块/.test(recruit), '召集令文案保留「我押了 500 块」');
check(!/48 小时/.test(recruit), '召集令无 48 小时残影');
check(/见证门槛进度/.test(witness), '见证席面板显示「见证门槛进度」');
/* ⚠️ 2026-11-24（本轮，用户口径 Part I②）：档位说明原来在「见证席 N 位」卡片里，
   那块卡按用户口径**整块删掉** —— 档位说明挪到【见证席名单半屏】里。 */
check(!/初始档位/.test(detail), 'Flag 详情页不再有档位说明（已挪进见证席名单半屏）');
check(/初始档位 <b>\$\{init\}<\/b> → 有效档位 <b>\$\{eff\}<\/b>/.test(appSrc), '见证席名单半屏里有档位说明（初始 → 有效）');
check(!/24 小时筹备期结束时定档，之后只降不升/.test(detail), 'Flag 详情页已删档位说明里的长句解释（已移入问号）');
/* ⚠️ 2026-11-24（本轮，用户口径 Part I④）：断卡情况并进日历卡片 ——
   独立的「断卡情况」卡删掉了，所以「还能断 N 次」和 breakRules 问号
   都不在详情页正文里（改成日历折叠头的「断卡 N/M 次」）。 */
check(/cal-brk/.test(detail), 'Flag 详情页日历折叠头带断卡次数');
check(!/还能断 <b>\d+<\/b> 次/.test(detail), 'Flag 详情页不再显示「还能断 N 次」');
/* ⚠️ 断言要看【渲染结果】，代码注释里提到「断卡情况」不算 */
const detailNoCmt = detail.replace(/<!--[\s\S]*?-->/g, '');
check(!/断卡情况/.test(detailNoCmt), 'Flag 详情页不再有独立的「断卡情况」卡');
check(!/data-info="breakRules"/.test(detail), 'Flag 详情页不再挂 breakRules 问号');
/* 档位说明挪进了见证席名单半屏 —— 半屏 HTML 在 app.js 里，源码断言 */
check(/初始档位 <b>\$\{init\}<\/b> → 有效档位 <b>\$\{eff\}<\/b>/.test(appSrc), '见证席名单半屏里有档位说明（初始 → 有效）');
check(/function openDaySheet\(/.test(appSrc), 'app.js 有 openDaySheet（日期半屏）');
check(/function openWitnessListSheet\(/.test(appSrc), 'app.js 有 openWitnessListSheet（见证席名单半屏）');
check(/function openVerdictSummarySheet\(/.test(appSrc), 'app.js 有 openVerdictSummarySheet（判定汇总半屏）');
check(!/预设短语是<b>公开内容<\/b>/.test(detail), 'Flag 详情页已删「预设短语是公开内容」解释');
check(!/10 分钟反悔期/.test(create + created + recruit + detail + witness + home), '全站无「10 分钟反悔期」残影');
check(!/3 天宽限期/.test(create + created + recruit + detail + witness + home), '全站无「3 天宽限期」残影');
check(!/标注加入日期/.test(detail), 'Flag 详情页无「标注加入日期」旧口径（名单已冻结）');

// ── demo 精简：死链 / 死代码巡检 ──
const INFO = vm.runInContext('INFO', sandbox);
const ROUTES = vm.runInContext('ROUTES', sandbox);
const pagesSrc = fs.readFileSync(path.join(__dirname, '..', 'js','pages.js'),'utf8');
const goTargets = new Set();
const infoTargets = new Set();
for (const m of pagesSrc.matchAll(/data-go="([a-zA-Z][a-zA-Z0-9_]*)"/g)) goTargets.add(m[1]);
for (const m of pagesSrc.matchAll(/info\('([a-zA-Z][a-zA-Z0-9_]*)'/g)) infoTargets.add(m[1]);
for (const m of pagesSrc.matchAll(/data-info="([a-zA-Z][a-zA-Z0-9_]*)"/g)) infoTargets.add(m[1]);
/* ⚠️ 2026-11-24：info(key, cls) 的第二个参数是 CSS 类（'sm' / 'lg'），不是弹层 key。
   所以把 info(...) 调用里出现的所有字符串字面量都收进来，再扣掉已知的 CSS 类。 */
const INFO_CLS = new Set(['sm','lg','md','xs']);
for (const m of pagesSrc.matchAll(/info\(([^)]*)\)/g)) {
  for (const q of m[1].matchAll(/'([a-zA-Z][a-zA-Z0-9_]*)'/g)) {
    if (!INFO_CLS.has(q[1])) infoTargets.add(q[1]);
  }
}

console.log('\n=== 死链 / 死代码巡检 ===');
const deadLinks = [...goTargets].filter(t => !ROUTES[t]);
check(deadLinks.length === 0, `所有 data-go 目标都存在${deadLinks.length ? '（失效：' + deadLinks.join(', ') + '）' : ''}`);
const deadInfo = [...infoTargets].filter(t => !INFO[t]);
check(deadInfo.length === 0, `所有 info 弹层都存在${deadInfo.length ? '（缺失：' + deadInfo.join(', ') + '）' : ''}`);
const unusedInfo = Object.keys(INFO).filter(k => !infoTargets.has(k));
check(unusedInfo.length === 0, `没有无人引用的弹层${unusedInfo.length ? '（死代码：' + unusedInfo.join(', ') + '）' : ''}`);
const routeNoPage = Object.keys(ROUTES).filter(k => !PAGES[k]);
check(routeNoPage.length === 0, `每个路由都有页面实现${routeNoPage.length ? '（缺：' + routeNoPage.join(', ') + '）' : ''}`);
const pageNoRoute = Object.keys(PAGES).filter(k => !ROUTES[k]);
check(pageNoRoute.length === 0, `每个页面都有路由条目${pageNoRoute.length ? '（缺：' + pageNoRoute.join(', ') + '）' : ''}`);

console.log(fails === 0 ? '\n✅ 全部通过' : `\n❌ ${fails} 项失败`);
process.exit(fails === 0 ? 0 : 1);
