/* 目标详情页精简（2026-11-23 用户逐条指定）
   —— 断言 9 条改动：
      ① 右上角的「90 天」删掉（押金和 T3 保留）
      ② 「67.4KG」→ 展示「71.2 → 63.2 kg」（起始 → 目标）
      ③ 「已减 3.8 kg · 还差 4.2 kg」删掉
      ④ 「第 52 天 · 点开看大图」删掉
      ⑤ 目标标题只能一行
      ⑥ 「还有 38 天」删掉
      ⑦ 「71.2 → 63.2 kg」（进度条下面那行）删掉
      ⑧ 「左右滑选某一天 —— 点开进打卡详情页」删掉
      ⑨ 「他们发过的短语」删掉
      ⑩ 「见证席判定节点按周期定：…」删掉
   外加：见证席面板底部三个「?」与两行说明删掉（2026-11-23 用户口径）
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const fakeEl = () => ({
  style: {}, dataset: {},
  classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
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
const PAGES   = vm.runInContext('PAGES', sandbox);
const INFO    = vm.runInContext('INFO', sandbox);
const appSrc   = fs.readFileSync(path.join(__dirname, '..', 'js','app.js'),'utf8');
const pagesSrc = fs.readFileSync(path.join(__dirname, '..', 'js','pages.js'),'utf8');
const infoSrc  = fs.readFileSync(path.join(__dirname, '..', 'js','info.js'),'utf8');
const cssSrc   = fs.readFileSync(path.join(__dirname, '..', 'css','app.css'),'utf8');

vm.runInContext('initState()', sandbox);
vm.runInContext("INJECTORS.newUserWithFlags()", sandbox);
vm.runInContext("INJECTORS.witness()", sandbox);

let fails = 0;
function check(cond, msg){
  if(!cond){ console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}

/* ⚠️ 只检查【用户看得见的】内容 —— 源码里的注释块不算 */
const strip = h => h.replace(/<!--[\s\S]*?-->/g, '');
const detail = strip(PAGES.flagDetail('f_3'));
const verdict = strip(PAGES.verdict());

/* ─────────────────────────────────────────────
   ① 右上角天数删掉，押金和 T3 保留
   ───────────────────────────────────────────── */
console.log('=== ① 右上角：天数删掉，押金 + T3 保留 ===');
check(!/nav-tier-days/.test(detail), '导航栏右侧没有周期天数');
check(/nav-tier-dep">押金 ¥1000</.test(detail), '右侧显示押金 ¥1000');
check(/nav-tier-t">T3</.test(detail), '右侧显示 T3');
check(!/>90 天</.test(detail), '页面可见文本里没有「90 天」这一项');

/* ─────────────────────────────────────────────
   ② 主角数字 = 起始 → 目标
   ───────────────────────────────────────────── */
console.log('\n=== ② 主角数字 = 起始 → 目标 ===');
check(/lead lead-range/.test(detail), '主角块是 .lead.lead-range');
check(/<span class="l-v">71\.2<\/span>/.test(detail), '显示起始体重 71.2');
check(/<span class="l-v">63\.2<\/span>/.test(detail), '显示目标体重 63.2');
check(/l-arrow">→</.test(detail), '两个数之间有箭头');
check(!/67\.4/.test(detail), '不再显示当前体重 67.4');
check(!/\$\{f\.curWeight\}/.test(detail), '详情页不再渲染 curWeight');

/* ─────────────────────────────────────────────
   ③ 已减 x kg · 还差 y kg 删掉
   ───────────────────────────────────────────── */
console.log('\n=== ③ 「已减 · 还差」删掉 ===');
check(!/已减/.test(detail), '没有「已减」');
check(!/还差 \d/.test(detail), '没有「还差 N kg」');
check(!/\$\{lost\}/.test(detail), '详情页不再算 lost');
check(!/\$\{need\}/.test(detail), '详情页不再算 need');
/* 结算态的结果仍然要留 */
check(/lead-sub">亏了 \$\{f\.lostAmount/.test(pagesSrc), '结算态仍显示「亏了 N 元」');
check(/lead-sub">挣回了全部押金/.test(pagesSrc), '成功态仍显示「挣回了全部押金」');

/* ─────────────────────────────────────────────
   ④ 「第 N 天 · 点开看大图」删掉
   ───────────────────────────────────────────── */
console.log('\n=== ④ 「第 N 天 · 点开看大图」删掉 ===');
check(!/点开看大图/.test(detail), '没有「点开看大图」');
check(!/第 \d+ 天 · 点开看大图/.test(detail), '照片区没有「第 N 天 · 点开看大图」');
check(/section-title">Ta 今天的照片</.test(detail), '照片区标题还在');

/* ─────────────────────────────────────────────
   ⑤ 目标标题只能一行
   ───────────────────────────────────────────── */
console.log('\n=== ⑤ 目标标题一行 ===');
check(/class="fd-title"/.test(detail), '标题用 .fd-title');
check(/\.fd-title\{[^}]*white-space:nowrap/.test(cssSrc), '.fd-title 单行不换行');
check(/\.fd-title\{[^}]*text-overflow:ellipsis/.test(cssSrc), '.fd-title 超出省略号');

/* ─────────────────────────────────────────────
   ⑥⑦ 「还有 N 天」和「起始 → 目标」那行删掉
   ───────────────────────────────────────────── */
console.log('\n=== ⑥⑦ 进度条下面那行删掉 ===');
check(!/还有 \d+ 天/.test(detail), '没有「还有 N 天」');
check(!/还有 \$\{daysLeft/.test(pagesSrc), '详情页不再渲染 daysLeft');
check(!/\$\{f\.startWeight\} → \$\{f\.targetWeight\} kg/.test(detail), '进度条下面没有「起始 → 目标」');
check(/class="bar /.test(detail), '进度条本身还在');

/* ─────────────────────────────────────────────
   ⑧ 「左右滑选某一天 —— 点开进打卡详情页」删掉
   ───────────────────────────────────────────── */
console.log('\n=== ⑧ 照片条的操作提示删掉 ===');
check(!/左右滑选某一天/.test(detail), '没有「左右滑选某一天」');
check(!/点开进打卡详情页/.test(detail), '没有「点开进打卡详情页」');
check(/section-sub">\d+ 张 · 左右滑选一天/.test(detail), '照片条小标题还在（那是内容不是操作说明）');
/* ⚠️ 2026-11-24：设置页删掉后，照片公开口径的说明挂到照片条小标题的问号上。 */
check(/section-sub">\d+ 张 · 左右滑选一天[\s\S]{0,120}data-info="photoPrivacy"/.test(detail), '照片条小标题挂着「打卡照片公开」说明问号');

/* ─────────────────────────────────────────────
   ⑨ 「他们发过的短语」删掉
   ───────────────────────────────────────────── */
console.log('\n=== ⑨ 「他们发过的短语」删掉 ===');
check(!/他们发过的短语/.test(detail), '没有「他们发过的短语」');
check(!/class="chips"/.test(detail), '短语 chip 条删了');
check(!/我盯着呢/.test(detail), '短语内容删了');

/* ─────────────────────────────────────────────
   ⑩ 「见证席判定节点按周期定」删掉
   ───────────────────────────────────────────── */
console.log('\n=== ⑩ 节点说明删掉 ===');
check(!/见证席判定节点按周期定/.test(detail), '没有「见证席判定节点按周期定」');
check(!/个节点（\d+ 天档）/.test(detail), '没有「共 N 个节点（X 天档）」');

/* ─────────────────────────────────────────────
   见证席面板：底部三个「?」+ 两行说明删掉
   ───────────────────────────────────────────── */
console.log('\n=== 见证席面板：底部说明删掉 ===');
check(!/wf-foot/.test(verdict), '面板没有 .wf-foot（底部三个「?」）');
check(!/判定怎么算/.test(verdict), '没有「判定怎么算」');
check(!/见证门槛/.test(verdict), '没有「见证门槛」');
check(!/物证怎么判/.test(verdict), '没有「物证怎么判」');
check(!/判定次数按周期定/.test(verdict), '没有「判定次数按周期定」');
check(!/见证席之间不协商/.test(verdict), '没有「见证席之间不协商」');
/* 但右上角那个「?」还在，说明没丢 */
check(/data-info="witnessApply"/.test(verdict), '右上角仍有「?」（witnessApply）');
/* 被删掉的三个说明弹层，内容并进 witnessApply —— 不能丢 */
check(/见证门槛细则/.test(INFO.witnessApply), 'witnessApply 里并入了门槛细则');
check(/判定状态（4 种）/.test(INFO.witnessApply), 'witnessApply 里并入了判定状态');
check(/打卡照两项/.test(INFO.witnessApply), 'witnessApply 里并入了打卡照两项（秤读数 + 手写随机词）');
check(!/人脸|视频|参照物|哈希/.test(INFO.witnessApply), 'witnessApply 里不再有人脸 / 视频 / 参照物 / 哈希');
check(!INFO.verdict, '独立的 verdict 说明弹层已删');
check(!INFO.witnessQuorum, '独立的 witnessQuorum 说明弹层已删');
check(!INFO.evidence, '独立的 evidence 说明弹层已删');
check(!/verdict:'判定状态'/.test(appSrc), 'INFO_TITLE 里的 verdict 已删');
check(!/witnessQuorum:'见证门槛'/.test(appSrc), 'INFO_TITLE 里的 witnessQuorum 已删');
check(!/evidence:'三层物证'/.test(appSrc), 'INFO_TITLE 里的 evidence 已删');

console.log(fails === 0 ? '\n✅ 全部通过' : `\n❌ ${fails} 条失败`);
process.exit(fails === 0 ? 0 : 1);
