/* 「申请成为见证席」的行为验证（临时脚本）
   ⚠️ 2026-11-22 用户口径：
     - 问号里除了「怎么成为见证席」，还要放「见证席的四项收益」
     - 问号的位置调一下，放在右上角（导航栏）
     - 在显眼位置说明成为见证席的要求：「完整监督 1 次」
       —— 至少监督 1 个 flag 三天 · 期间互动过一次
   ⚠️ 2026-11-23 用户口径（改）：
     - 「申请成为见证席」独立页面整个删掉 —— 入口在见证席面板
     - 点申请会在页面中间弹出一个小框，当场评估是否达到见证席标准
     - 见证席面板右上角加一个「?」，里面是见证席的说明和介绍
   验证：门槛卡、问号位置、弹层内容、两种状态（够格/不够格）、
        独立页面已删、申请入口在见证席面板都成立 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
};
vm.createContext(sandbox);
for (const f of ['info.js','avatars.js','data.js','state.js','pages.js','app.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js',f),'utf8'), sandbox, { filename: f });
}
vm.runInContext('initState()', sandbox);

const STATE = vm.runInContext('STATE', sandbox);
const PAGES  = vm.runInContext('PAGES', sandbox);
const INFO   = vm.runInContext('INFO', sandbox);
const run = (code) => vm.runInContext(code, sandbox);

let fails = 0;
function assert(cond, msg){
  if(!cond){ console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}
function section(t){ console.log('\n=== ' + t + ' ==='); }

const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js','app.js'),'utf8');
const pagesSrc = fs.readFileSync(path.join(__dirname, '..', 'js','pages.js'),'utf8');

/* ------------------------------------------------------------------ */
section('A. 独立页面已删（2026-11-23）');
assert(typeof PAGES.witnessApply === 'undefined', 'PAGES 里已删掉 witnessApply 独立页');
assert(run('typeof ROUTES.witnessApply') === 'undefined', '路由表里已删掉 witnessApply');
assert(!/witnessApply:\{t:'申请见证席'/.test(appSrc), 'ROUTES 里没有 witnessApply 条目');
assert(!/data-go="witnessApply"/.test(pagesSrc), 'pages.js 里没有残留的 data-go="witnessApply" 入口');
assert(!/data-go="witnessApply"/.test(appSrc), 'app.js 里没有残留的 data-go="witnessApply" 入口');

section('B. 申请入口在见证席面板，点它弹居中小框');
run('STATE.verdictTasks = []');
const verdictHtml = PAGES.verdict();
assert(verdictHtml.includes('data-act="applyWitness"'), '见证席面板里有「申请成为见证席」按钮');
assert(!verdictHtml.includes('data-go="witnessApply"'), '不再跳独立页面');
assert(/function openWitnessApplyDialog/.test(appSrc), 'app.js 有 openWitnessApplyDialog()');
assert(/case 'applyWitness'/.test(appSrc), "app.js 有 applyWitness 动作");
assert(/dialog dlg-apply/.test(appSrc), '小框用 .dlg-apply（居中弹窗）');

section('C. 小框里门槛要求在显眼位置');
const dlg = run('witnessApplyDialogHTML()');
assert(dlg.includes('wa-req'), '小框里有门槛高亮卡 .wa-req');
/* ⚠️ 2026-11-24 用户口径（改）：「成为见证席的理由，简化为累计完成 10 次互动就行了，
   点赞或留言，同时这个页面简化，信息太多了，不用太多解释性的说明。」 */
assert(dlg.includes('累计互动 10 次'), '门槛卡写明「累计互动 10 次」');
assert(dlg.includes('点赞或留言都算 1 次'), '门槛卡写明「点赞或留言都算 1 次」');
assert(!dlg.includes('完整监督'), '门槛卡不再提「完整监督」');
/* 简化：所有解释性说明都删掉 */
assert(!dlg.includes('wa-dlg-ok'), '删掉了「够格了」结论块');
assert(!dlg.includes('wa-dlg-no'), '删掉了「还差一点点」提醒块');
assert(!dlg.includes('wa-dlg-list'), '删掉了四行明细（担保人 / 平台审核 / 判定次数 / 漏报误报）');
assert(!dlg.includes('担保人'), '不再出现「担保人」');
assert(!dlg.includes('平台审核'), '不再出现「平台审核」');
assert(!dlg.includes('漏报 / 误报'), '不再出现「漏报 / 误报」明细');
/* 门槛卡必须在最上面 */
assert(dlg.indexOf('<div class="wa-req">') >= 0 && dlg.indexOf('<div class="wa-req">') === dlg.indexOf('<div'),
  '门槛卡是小框的第一块内容');

section('D. 问号在见证席面板右上角，内容 = 见证席说明 + 四项收益');
assert(/<div class="nav">\$\{navRow\('见证席面板', `<button class="nav-btn" data-info="witnessApply">\?<\/button>/.test(pagesSrc),
  '见证席面板导航栏 actions 位挂了「?」');
/* 有任务时也要有 */
run(`STATE.verdictTasks = MY_VERDICT_TASKS.map(t => ({ ...t }))`);
const verdictFull = PAGES.verdict();
assert(verdictFull.includes('data-info="witnessApply"'), '有待判定任务时导航栏也有「?」');
const infoDots = (verdictHtml + verdictFull).match(/data-info="witnessApply"/g) || [];
assert(infoDots.length === 2, `空态和有任务态各 1 个问号（实际 ${infoDots.length}）`);

const info = INFO.witnessApply;
assert(info.includes('怎么成为见证席'), '弹层含「怎么成为见证席」');
assert(info.includes('见证席的三项收益'), '弹层含「见证席的三项收益」');
assert(info.includes('信用分') && info.includes('特权') && info.includes('荣誉'),
  '三项收益（B1 信用分 / B2 特权 / B3 荣誉）都在弹层里');
assert(info.includes('判对了加分，判错了扣分'), '弹层含加减分对照表');
assert(/witnessApply:'怎么成为见证席'/.test(appSrc), 'INFO_TITLE 里 witnessApply 有标题');

section('E. 收益文案共用片段（不会两处漂移）');
const infoSrc = fs.readFileSync(path.join(__dirname, '..', 'js','info.js'),'utf8');
assert(/const WITNESS_BENEFIT_HTML = `/.test(infoSrc), 'info.js 抽出共用片段 WITNESS_BENEFIT_HTML');
assert(/witnessBenefit:\s*`\$\{WITNESS_BENEFIT_HTML\}`/.test(infoSrc), 'witnessBenefit 弹层复用共用片段');
assert(/\$\{WITNESS_BENEFIT_HTML\}/.test(infoSrc), 'witnessApply 弹层复用共用片段');
/* ⚠️ 2026-11-23：witnessApply 弹层在收益段落之后又追加了「面板怎么用 / 连带责任 / 物证怎么判」
   —— 所以现在是「包含」关系，不是「完全相等」。 */
assert(INFO.witnessApply.includes(INFO.witnessBenefit),
  'witnessApply 弹层完整包含共用收益片段');

section('F. 两种状态都成立');
/* ⚠️ 2026-11-24：门槛改成「累计互动 10 次」 */
run('STATE.interactions = 0');
const h0 = run('witnessApplyDialogHTML()');
assert(h0.includes('还差 10 次'), '不够格时明确说「还差 10 次」');
assert(h0.includes('0 / 10'), '不够格时进度是 0 / 10');
assert(h0.includes('去广场'), '不够格时给出下一步（去广场互动）');
assert(run('canApplyToPool()') === false, '互动不够时不能申请');
run('STATE.interactions = 10');
const h1 = run('witnessApplyDialogHTML()');
assert(h1.includes('已满足'), '够格时明确说「已满足」');
assert(h1.includes('10 / 10'), '够格时进度是 10 / 10');
assert(!h1.includes('去广场'), '够格时不再给「去广场」提示');
assert(run('canApplyToPool()') === true, '互动够了可以申请');

/* ------------------------------------------------------------------ */
section('G. 互动计数：点赞 / 留言各算 1 次');
run('initState()');
const before = run('interactionCount()');
assert(before === 0, '初始互动数是 0');
/* 点赞 +1 */
run("doLike('f_1','')");
assert(run('interactionCount()') === 1, '点赞 1 次 = 互动 +1');
/* 同一天同一局重复点赞不再加（互动也不加） */
run("doLike('f_1','')");
assert(run('interactionCount()') === 1, '同一天重复点赞，互动不再加');
/* 留言 +1 */
run("addPublicMsg('f_1','测试留言')");
assert(run('interactionCount()') === 2, '留言 1 次 = 互动 +1');
/* 空留言不算 */
run("addPublicMsg('f_2','   ')");
assert(run('interactionCount()') === 2, '空留言不算互动');
/* 攒够 10 次就能申请 */
run('STATE.interactions = 10');
assert(run('canApplyToPool()') === true, '攒够 10 次可以申请');
run('STATE.interactions = 9');
assert(run('canApplyToPool()') === false, '9 次还不够');

/* ------------------------------------------------------------------ */
section('H. 全站不再说「完整监督 1 次即可申请」');
const allSrc = pagesSrc + appSrc + fs.readFileSync(path.join(__dirname, '..', 'js','info.js'),'utf8');
assert(!allSrc.includes('完整监督 1 次即可申请'), '「我的」页不再说「完整监督 1 次即可申请」');
assert(!allSrc.includes('还没满足条件：完整监督'), 'toast 不再说「完整监督」');
assert(allSrc.includes('累计互动'), '全站改成「累计互动」口径');

/* ------------------------------------------------------------------ */
console.log('\n' + (fails ? `FAILED (${fails})` : 'ALL PASSED'));
process.exit(fails ? 1 : 0);
