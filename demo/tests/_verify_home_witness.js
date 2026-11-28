/**
 * 校验：2026-11-23 用户口径三项
 *   1. 首页「我关心的 Flag」→ 「我见证的 Flag」（只放我正在见证的局，点进去是普通目标详情）
 *   2. 今日打卡页：「今天的心情 / 体悟」排在「生活照（可选）」上面；提示语删掉「围观者能看到」
 *   3. 首页打卡卡片：提交当日打卡后，「今天还没打卡」动态变「今天已打卡」
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const pagesSrc = read('js/pages.js');
const stateSrc = read('js/state.js');
const appSrc = read('js/app.js');

let fails = 0;
function check(cond, msg) {
  console.log((cond ? '  ✓ ' : '  ✗ ') + msg);
  if (!cond) fails++;
}

/* ---- 沙箱 ---- */
const fakeEl = () => ({
  style: {}, dataset: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
  appendChild(){}, removeChild(){}, addEventListener(){}, removeEventListener(){},
  setAttribute(){}, getAttribute(){ return null; }, querySelector: () => fakeEl(),
  querySelectorAll: () => [], remove(){}, innerHTML: '', textContent: '',
});
const sandbox = {
  console,
  window: fakeEl(),
  document: {
    querySelector: () => fakeEl(), querySelectorAll: () => [],
    getElementById: () => fakeEl(), addEventListener(){}, removeEventListener(){},
    createElement: () => fakeEl(), body: fakeEl(),
  },
  localStorage: { getItem: () => null, setItem(){} },
  setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame: () => 0,
  location: { href: 'http://localhost/', pathname: '/' },
  history: { pushState(){}, replaceState(){} },
  Date, Math, JSON, Map, Set, Object, Array, String, Number, Boolean, RegExp, Error,
  isNaN, parseInt, parseFloat,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
['info.js','avatars.js','data.js','state.js','pages.js','app.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), sandbox, { filename: f });
});
const PAGES = vm.runInContext('PAGES', sandbox);

/* =========================================================
   1. 首页「我见证的 Flag」
   ========================================================= */
console.log('\n=== 1. 首页「我见证的 Flag」 ===');
check(/我见证的 Flag/.test(pagesSrc), 'pages.js 有「我见证的 Flag」标题');
/* ⚠️ 「我关心的 Flag」只允许出现在注释里（记录改动历史），不得出现在渲染文案里 */
check(!/我关心的 Flag/.test(pagesSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')),
  'pages.js 渲染文案里不再有「我关心的 Flag」');
check(/function homeWitnessSection\(/.test(pagesSrc), 'pages.js 有 homeWitnessSection()');
check(/function myWitnessingFlags\(/.test(stateSrc), 'state.js 有 myWitnessingFlags()');
check(/function isWitnessing\(/.test(stateSrc), 'state.js 有 isWitnessing()');
check(/function addWitnessing\(/.test(stateSrc), 'state.js 有 addWitnessing()');
check(/witnessing: \[\]/.test(stateSrc), 'STATE 有 witnessing 字段');

// 注入「见证席」状态 → 首页应出现我见证的 Flag
vm.runInContext("initState(); INJECTORS.witness()", sandbox);
const homeHtml = PAGES.home();
check(/我见证的 Flag/.test(homeHtml), '首页渲染出「我见证的 Flag」');
check(!/我关心的 Flag/.test(homeHtml), '首页不再出现「我关心的 Flag」');
check(!/你关注的人/.test(homeHtml), '首页不再混入关注的人');
/* 点进去是普通目标详情（不是特殊页面） */
check(/data-go="flagDetail" data-id="f_1"/.test(homeHtml), '见证条目点进去是普通目标详情页（flagDetail）');
/* 哪怕没到节点的局也在列表里 */
const witnessList = vm.runInContext("myWitnessingFlags().map(f => f.id)", sandbox);
check(Array.isArray(witnessList) && witnessList.length >= 2, `见证列表有 ${witnessList.length} 个局（含未到节点的）`);
check(witnessList.indexOf('f_6') >= 0, '还没到判定节点的 f_6 也在见证列表里');
/* 订阅的不进这个列表 */
vm.runInContext("subscribeFlag('f_3')", sandbox);
const wl2 = vm.runInContext("myWitnessingFlags().map(f => f.id)", sandbox);
check(wl2.indexOf('f_3') < 0, '订阅的 Flag 不进「我见证的 Flag」');

/* =========================================================
   2. 今日打卡页：心情在生活照上面
   ========================================================= */
console.log('\n=== 2. 今日打卡页排版 ===');
const checkinHtml = PAGES.checkin('f_own');
const iNote = checkinHtml.indexOf('今天的心情 / 体悟');
const iLife = checkinHtml.indexOf('生活照（可选）');
check(iNote > -1, '打卡页有「今天的心情 / 体悟」');
check(iLife > -1, '打卡页有「生活照（可选）」');
check(iNote > -1 && iLife > -1 && iNote < iLife, '心情 / 体悟 排在生活照【上面】');
check(!/围观者能看到/.test(checkinHtml), '提示语里删掉了「围观者能看到」');
check(/可选 —— 打卡照是物证，这句话是你的心情。/.test(checkinHtml), '保留「可选 —— 打卡照是物证，这句话是你的心情。」');
check(/id="checkinNote"/.test(checkinHtml), '心情输入框还在');

/* =========================================================
   3. 首页「今天已打卡」动态变化
   ========================================================= */
console.log('\n=== 3. 首页打卡卡片动态变化 ===');
check(/function checkedToday\(/.test(stateSrc), 'state.js 有 checkedToday()');
check(/f\.checkedOn = DEMO_TODAY/.test(stateSrc), 'doCheckin 写下了 checkedOn 标记');
check(/今天已打卡/.test(pagesSrc), 'pages.js 有「今天已打卡」文案');

/* 新用户种子：今天还没打卡 */
vm.runInContext("INJECTORS.newUserWithFlags()", sandbox);
const hBefore = PAGES.home();
check(/今天还没打卡/.test(hBefore), '打卡前首页显示「今天还没打卡」');
check(!/今天已打卡/.test(hBefore), '打卡前首页不显示「今天已打卡」');

/* 提交一次打卡 → 文案翻转 */
vm.runInContext("doCheckin(STATE.myFlags[0].id, 71.0)", sandbox);
const hAfter = PAGES.home();
check(/今天已打卡/.test(hAfter), '打卡后首页显示「今天已打卡」');
check(!/今天还没打卡/.test(hAfter), '打卡后首页不再显示「今天还没打卡」');
check(/连续 \d+ 天/.test(hAfter), '已打卡卡片显示连续天数');

console.log(fails === 0 ? '\n✅ 全部通过' : `\n❌ ${fails} 项失败`);
process.exit(fails === 0 ? 0 : 1);
