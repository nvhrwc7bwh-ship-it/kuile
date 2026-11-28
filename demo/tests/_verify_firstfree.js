/* 首次免费功能的端到端行为验证（临时脚本）
   验证：0 元档只在第一个 Flag 时出现、只覆盖 7/14 天、且照常产生分值 */
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
const run = (code) => vm.runInContext(code, sandbox);

let fails = 0;
function assert(cond, msg){
  if(!cond){ console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}

console.log('=== A. 新用户（第一个 Flag）===');
assert(run('isFirstFlag()') === true, '初始状态 isFirstFlag() = true');
const dr14 = run('depositRange(STATE.credit, 14, isFirstFlag())');
assert(dr14.options.includes(0), '首次 14 天可选 0 元档');
const dr30 = run('depositRange(STATE.credit, 30, isFirstFlag())');
assert(!dr30.options.includes(0), '首次 30 天无 0 元档');
assert(dr30.min === 500, `首次 30 天押金下限仍是 500 元`);

console.log('\n=== B. 押金页渲染 ===');
const depHtml = PAGES.createDeposit();
assert(depHtml.includes('首次免费'), '押多少页出现「首次免费」文案');
assert(!depHtml.includes('体验档'), '押多少页不再出现「体验档」');
assert(!depHtml.includes('不产生任何分值'), '押多少页不再出现「不产生任何分值」');
/* ⚠️ 2026-11-23 用户口径（改）：押金档位区的脚注整条删了
   （「可选区间 = …，区间内自选。第一个 Flag 免费 —— 0 元这一档只有一次机会，用完就没了；这一局照常加分。」）
   —— 断言针对的是【脚注那几句】，不是页面里任何「照常加分」字样
      （引导条里的「这一局照常加分」是另一句话，讲的是你选中的那一档）。 */
assert(!depHtml.includes('区间内自选'), '押多少页不再有「区间内自选」脚注');
assert(!depHtml.includes('只有一次机会'), '押多少页不再有「只有一次机会」脚注');
assert(!depHtml.includes('可选区间 = [周期下限'), '押多少页不再有「可选区间 = …」公式行');
assert(!/min\(信用上限, 周期上限\)/.test(depHtml), '押多少页不再有区间公式');
assert(!depHtml.includes('用完就没了'), '押多少页不再有「用完就没了」');

console.log('\n=== C. 立一个 0 元的首发局 ===');
const before = { credit: STATE.credit };
run(`resetCreateDraft(); STATE.periodSel = 14; STATE.depSel = 0;`);
assert(run('selDeposit()') === 0, '首个 Flag 时 selDeposit() 落到 0 元档');
run(`submitFlag({ title:'测试第一局', start:68, target:63, period:14, deposit:0, witnesses:[] })`);
assert(STATE.myFlags.length === 1, '第一个 Flag 已创建');
assert(STATE.myFlags[0].depositPaid === 0, '押金原值 = 0');
assert(STATE.myFlags[0].zeroDeposit === true, 'zeroDeposit 标记 = true');
assert(run('typeof isNoScoreFlag') === 'undefined', 'isNoScoreFlag 已彻底移除（分值抑制逻辑不再存在）');
assert(run('isFirstFlag()') === false, '立完第一个 Flag 后 isFirstFlag() = false');

console.log('\n=== D. 第二个 Flag 不再有 0 元档 ===');
const dr2 = run('depositRange(STATE.credit, 14, isFirstFlag())');
assert(!dr2.options.includes(0), '第二个 Flag 的 14 天不再有 0 元档');
assert(dr2.tiers.length === 4, '第二个 Flag 只展示 4 个付费档位');
const depHtml2 = PAGES.createDeposit();
assert(!depHtml2.includes('首次免费'), '第二个 Flag 的押多少页不再显示「首次免费」');
/* ⚠️ 2026-11-23 用户口径（改）：「押金从周期下限起算」那句在脚注里，脚注整条删了 */
assert(!depHtml2.includes('押金从周期下限起算'), '第二个 Flag 不再有「押金从周期下限起算」脚注');

console.log('\n=== E. 0 元局照样产生信用分 ===');
const f = STATE.myFlags[0];
const sched = run('creditEarnScheduleFor')(f);
assert(sched.length > 0, `0 元局的信用分到账表非空（${sched.length} 笔）`);
/* ⚠️ 0 位见证席 = T0 = 系数 ×0.6（见 R1.2.1），所以 14 天是 +6 分而不是 +10 分 */
assert(f.tier === 'T0', '0 位见证席 → 强度 T0');
assert(sched.reduce((s,x)=>s+x.value,0) === 6, `14 天 0 元局合计 +6 分（T0 系数 ×0.6，实际 ${sched.reduce((s,x)=>s+x.value,0)}）`);
const penalty = run('creditFailPenaltyFor')(f);
assert(penalty === 3, `失败也照扣信用分（T0 系数 ×0.6 = 扣 ${penalty} 分，调用方取负）`);
/* 见证席加进来 → T2 → 系数 ×1.0 → 14 天 +10 分，跨过 70 门槛 */
f.tier = 'T2'; f.effectiveTier = 'T2';
const sched2 = run('creditEarnScheduleFor')(f);
assert(sched2.reduce((s,x)=>s+x.value,0) === 10, `T2 强度下 14 天 0 元局合计 +10 分（跨过 70 门槛，实际 ${sched2.reduce((s,x)=>s+x.value,0)}）`);

console.log('\n=== F. 打卡也照常加信用分 ===');
run(`doCheckin('${f.id}', 67.5)`);
assert(f.streak === 1, '打卡成功');
assert(STATE.credit >= before.credit, '打卡未破坏信用分');

console.log('\n=== G. 取消 0 元局：信用分照扣 ===');
/* ⚠️ 筹备期内不能取消（见 R1.6）—— 先把它推进到「进行中」 */
f.status = 'running';
const creditBefore = STATE.credit;
const r = run(`cancelMyFlag('${f.id}')`);
assert(r && r.ok, '0 元局可以取消');
assert(STATE.credit < creditBefore, `取消后信用分被扣（${creditBefore} → ${STATE.credit}）`);
assert(f.deposit === 0 && f.depositPaid === 0, '取消后押金原值仍为 0');

console.log('\n' + (fails===0 ? '✅ 全部通过' : `❌ ${fails} 项失败`));
process.exit(fails===0?0:1);
