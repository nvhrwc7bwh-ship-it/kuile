/* 见证席面板精简（2026-11-23 用户逐条指定）
   —— 断言 6 条改动：
      ① 「想试试能不能打破平台期」（目标理由）删掉
      ② 「起始 65kg → 目标 63.5kg · 当前 65kg」→ 只留起始 → 目标
      ③ 「我这一票 · 第 N / M 个节点」徽章删掉
      ④ 「还剩 6 小时 · 见证门槛进度 1/2」→ 只显示还剩多久（挪成倒计时徽章）
      ⑤ 「起始 → 本次称重」那一栏整块删掉
      ⑥ 物证材料区整理（去掉重复预告、清单化、去掉重复按钮）
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const fakeEl = () => ({
  style: {}, dataset: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
  appendChild(){}, removeChild(){}, addEventListener(){}, removeEventListener(){},
  setAttribute(){}, getAttribute(){ return null; }, querySelector: () => fakeEl(),
  querySelectorAll: () => [], remove(){}, innerHTML: '', textContent: '', value: '',
  focus(){}, click(){},
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
const appSrc   = fs.readFileSync(path.join(__dirname, '..', 'js','app.js'),'utf8');
const pagesSrc = fs.readFileSync(path.join(__dirname, '..', 'js','pages.js'),'utf8');
const cssSrc   = fs.readFileSync(path.join(__dirname, '..', 'css','app.css'),'utf8');

vm.runInContext('initState()', sandbox);
vm.runInContext("INJECTORS.newUserWithFlags()", sandbox);
vm.runInContext("INJECTORS.witness()", sandbox);

let fails = 0;
function check(cond, msg){
  if(!cond){ console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}

const rawHtml = PAGES.verdict();
/* ⚠️ 只检查【用户看得见的】内容 —— 源码里的注释块不算 */
const visible = rawHtml.replace(/<!--[\s\S]*?-->/g, '');
/* 只要见证席面板里那张卡（第一个 .card） */
const cardStart = visible.indexOf('<div class="card"');
const card = visible.slice(cardStart, cardStart + 12000);

/* ─────────────────────────────────────────────
   ① 目标理由删掉
   ───────────────────────────────────────────── */
console.log('=== ① 目标理由删掉 ===');
check(!/想试试能不能打破平台期/.test(visible), '面板里没有「想试试能不能打破平台期」');
check(!/f\.reason/.test(card), '面板不再渲染 f.reason');
check(!/「\$\{f\.reason\}」/.test(pagesSrc), 'pages.js 不再有理由的渲染行');

/* ─────────────────────────────────────────────
   ② 只展示起始 → 目标
   ───────────────────────────────────────────── */
console.log('\n=== ② 只展示起始 → 目标 ===');
check(/起始 \$\{f\.startWeight\}kg → 目标 \$\{f\.targetWeight\}kg/.test(pagesSrc), '体重行是「起始 Xkg → 目标 Ykg」');
check(!/当前 <b/.test(pagesSrc), '体重行不再有「当前 xx kg」');
check(!/\$\{f\.curWeight\}/.test(card), '见证席卡片里不出现当前体重');
check(/起始 58\.2kg → 目标 55kg/.test(card), '渲染出的卡片有「起始 58.2kg → 目标 55kg」');

/* ─────────────────────────────────────────────
   ③ 「我这一票 · 第 N / M 个节点」删掉
   ───────────────────────────────────────────── */
console.log('\n=== ③ 「我这一票」徽章删掉 ===');
check(!/我这一票/.test(visible), '面板没有「我这一票」');
check(!/个节点/.test(visible.replace(/判定次数按周期定[^<]*/g,'')), '面板没有「第 N / M 个节点」徽章');
check(!/stepIdx/.test(pagesSrc), 'pages.js 不再算 stepIdx');
check(/wf-step-flag done">已判/.test(visible), '已判过的节点仍保留「已判」角标');
check(/class="wf-step now/.test(visible), '待判那一步在节点条上高亮（.wf-step.now）');

/* ─────────────────────────────────────────────
   ④ 只显示还剩多久
   ───────────────────────────────────────────── */
console.log('\n=== ④ 判定倒计时 ===');
check(/wf-act-timer/.test(visible), '有倒计时徽章 .wf-act-timer');
check(/wf-act-timer[\s\S]{0,400}?还剩 \d+ 小时/.test(visible), '徽章里显示还剩多久（还剩 N 小时）');
check(/wf-act-timer[\s\S]{0,400}?\$\{pending\.deadline\}/.test(pagesSrc), 'pages.js 用 pending.deadline 渲染倒计时');
check(!/见证门槛进度/.test(visible), '「见证门槛进度 N/M」整条删掉');
check(!/\$\{pending\.judged\}\/\$\{pending\.quorumNeed\}/.test(pagesSrc), 'pages.js 不再渲染门槛进度');
check(/\.wf-act-timer\{/.test(cssSrc), 'CSS 定义 .wf-act-timer');
check(/\.wf-act-head\{/.test(cssSrc), 'CSS 定义 .wf-act-head（标题 + 倒计时同一行）');
check(/\.wf-act-timer svg\{/.test(cssSrc), '倒计时徽章有时钟图标');

/* ─────────────────────────────────────────────
   ⑤ 「起始 → 本次称重」那一栏删掉
   ───────────────────────────────────────────── */
console.log('\n=== ⑤ 称重对照栏删掉 ===');
check(!/wf-act-row/.test(visible), '面板没有「起始 → 本次称重」那一栏');
check(!/本次称重/.test(visible), '面板没有「本次称重」字样');
check(!/wf-act-metric/.test(visible), '面板没有起始/本次两个指标块');
check(!/pending\.nodeWeight/.test(card), '卡片里不引用 nodeWeight');
/* 判定详情页【仍然要能看到】本次称重 —— 那是物证内容，不是这里 */
const detailHtml = PAGES.verdictDetail();
check(/本次 kg/.test(detailHtml), '判定详情页仍然展示「本次 kg」（物证内容没丢）');

/* ─────────────────────────────────────────────
   ⑥ 物证材料区 → 改成「本次打卡的物证照片行」
   ───────────────────────────────────────────── */
console.log('\n=== ⑥ 本次打卡物证照片行 ===');
check(!/物证材料/.test(visible), '面板没有「物证材料」这一块');
check(!/wf-evi-list/.test(visible), '面板没有旧的物证文字清单');
check(!/wf-evi-item/.test(visible), '面板没有旧的物证清单项');
check(!/点开可看物证材料/.test(visible), '聚焦点不再预告「点开可看物证材料 N 项」');
/* 照片行在「去判定」按钮【上方】 */
check(/wf-shots/.test(visible), '有物证照片行 .wf-shots');
/* ⚠️ 2026-11-24（R2.30 Part 四①）：「本次打卡的物证」标题**删掉** ——
   —— 用户口径：「见证席面板对判定节点进行判定的独立页面中，
      删除『本次打卡的证物』这句话。」 */
check(!/本次打卡的物证/.test(visible), '照片行不再有标题「本次打卡的物证」');
check(!/wf-shots-t/.test(pagesSrc), '标题元素 .wf-shots-t 已删');
const shotsIdx = visible.indexOf('wf-shots');
const btnIdx   = visible.lastIndexOf('data-act="openVerdictPicker"');
check(shotsIdx > 0 && btnIdx > shotsIdx, '照片行排在「去判定」按钮上方');
/* 固定 4 格，不足补空位 */
check(/const SLOTS = 4/.test(pagesSrc), '固定 4 格（SLOTS = 4）');
check(/tr-empty/.test(pagesSrc), '不足 4 张用空格子占位');
check(/tr-cell/.test(pagesSrc), '照片格用 .tr-cell（固定 4 列）');
/* 点放大，不跳页面 */
check(/openWitnessShot/.test(visible), '照片格可以点（openWitnessShot）');
check(/case 'openWitnessShot'/.test(appSrc), 'app.js 有 openWitnessShot 处理');
check(!/data-go="verdictDetail"/.test(visible), '面板不再跳转到判定详情页');
check(/openPhotoViewer/.test(appSrc), 'openWitnessShot 走图片查看器（放大）');
check(/\.wf-shots\{/.test(cssSrc), 'CSS 定义 .wf-shots');
/* 判定详情页本身保留（它是独立的路由，不是死代码） */
check(/物证原图/.test(PAGES.verdictDetail()), '判定详情页本身仍然保留');

console.log(fails === 0 ? '\n✅ 全部通过' : `\n❌ ${fails} 条失败`);
process.exit(fails === 0 ? 0 : 1);

