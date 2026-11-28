/* 品牌名与文案改造的渲染层验证 —— 直接在 Node 里跑 demo 的真实渲染函数 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 极简 DOM stub —— 让 app.js 的顶层 DOM 操作不炸
function stubEl() {
  return {
    addEventListener() {}, removeEventListener() {}, appendChild() {}, removeChild() {},
    setAttribute() {}, getAttribute: () => null, remove() {}, focus() {}, blur() {},
    scrollTop: 0, style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    querySelector: () => stubEl(), querySelectorAll: () => [],
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
    setPointerCapture() {}, releasePointerCapture() {},
    insertAdjacentHTML() {}, closest: () => null,
    textContent: '', innerHTML: '',
  };
}

const ctx = {
  console,
  window: { addEventListener() {}, location: { hash: '' } },
  document: {
    addEventListener() {}, querySelector: () => stubEl(), querySelectorAll: () => [],
    createElement: () => stubEl(),
    body: { appendChild() {}, classList: { add() {} } },
    documentElement: { style: {} },
    getElementById: () => stubEl(),
  },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  setTimeout, clearTimeout, Date, Math, JSON,
};
ctx.globalThis = ctx;
vm.createContext(ctx);

// app.js 里只取 ICON_RAW/ICON/ic 那一段（图标在路由表之前，pages.js 依赖它）
const D = path.join(__dirname, '..');
const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const iconStart = appSrc.indexOf('const ICON_RAW');
const iconEnd = appSrc.indexOf('/* ---------------- 路由表');
const iconChunk = appSrc.slice(iconStart, iconEnd);

const files = ['js/data.js', 'js/state.js', 'js/info.js', 'js/avatars.js'];
let src = iconChunk + '\n' + files.map(f => `/* ==== ${f} ==== */\n` + fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');

// pages.js 也需要 ICON，但 pages.js 内部定义 PAGES —— 顺序：ICON → data/state/info → pages
src += '\n/* ==== js/pages.js ==== */\n' + fs.readFileSync(path.join(__dirname, '..', 'js', 'pages.js'), 'utf8');

// 末尾导出
const wrapped = src
  + '\n;globalThis.__PAGES = PAGES;'
  + '\n;try{ initState(); globalThis.__STATE = STATE; }catch(e){ console.log("initState ERR:", e.message); }';

try {
  vm.runInContext(wrapped, ctx, { filename: 'demo-bundle.js' });
} catch (e) {
  console.log('LOAD ERR →', e.message);
  console.log((e.stack || '').split('\n').slice(1, 4).join('\n'));
}

const PAGES = ctx.__PAGES;
/* ⚠️ 2026-11-22 用户口径（改）：召集令不再有独立页面 —— 文案由 recruitCopy() 提供 */
const recruitText = vm.runInContext('recruitCopy()', ctx);
if (!PAGES) { console.log('PAGES 未定义'); process.exit(1); }

const checks = [
  ['品牌名：启动页显示「亏了」', () => PAGES.splash().includes('亏了')],
  ['品牌名：启动页不再显示「立了」', () => !PAGES.splash().includes('立了')],
  ['召集令首句 = 我押了 500 块', () => recruitText.includes('我押了 500 块，30 天后见分晓')],
  ['召集令不再以体重开头', () => !recruitText.includes('我立了一个 30 天的 Flag：68.4kg')],
  ['召集令保留"丢的是自己的脸"', () => recruitText.includes('丢的是自己的脸')],
  /* ⚠️ 2026-11-23 用户口径：文案要突出「为什么要找见证」 */
  ['召集令说明了"为什么找见证"', () => recruitText.includes('不是我一个人说了算')],
  ['召集令说明了"被盯着"的理由', () => recruitText.includes('有人盯着') || recruitText.includes('被人盯着')],
  ['记录卡：成功 = 挣了 500 元', () => PAGES.recordCard('f_success').includes('挣了 500 元')],
  ['记录卡：失败 = 亏了 175 元', () => PAGES.recordCard('f_5').includes('亏了 175 元')],
  ['分享页无码版 = 挣回了 500 块', () => PAGES.share().includes('30 天，我挣回了 500 块')],
  ['分享页无码版不再以"我立了"开头', () => !PAGES.share().includes('我立了 30 天的 Flag，最后一天体重')],
  ['状态胶囊：失败 = 亏了', () => {
    // statusPill 在 pages.js 内部，直接验证首页广场里的状态胶囊
    return PAGES.square().includes('>亏了<') || PAGES.home().includes('>亏了<');
  }],
  ['押金页：挣了 / 亏了 对称', () => {
    /* ⚠️ 2026-11-24：押金流程统一到立 Flag 第 3 步「③ 确认并支付」——
       第 4 步 `createPay` 已删，账目汇总也搬进了第 3 步，所以改验那一屏。
       ⚠️ 2026-11-24（再改，本轮）：账目汇总那块（.card.flat）**整块删掉** ——
          顶部 wiz-lead 已经说了「完成目标押金 100% 退还」，
          档位区已经显示了押金数额 —— 所以「挣了（达标）/ 亏了（失败）」两行
          不再在正文里出现，改验**顶部文案**里这两个词。 */
    const all = PAGES.createDeposit().replace(/<!--[\s\S]*?-->/g, '');
    return /押金 <b>100% 退还<\/b>/.test(all)
        && /失败按信用比例扣收/.test(all)
        && !/挣了（达标）/.test(all);
  }],
  ['立据页结局说明用新词', () => PAGES.credDetail().includes('挣了 / 亏了')],
  ['启动页文案共 3 行（问句 1 + 标语 2）', () => {
    const h = PAGES.splash();
    // 问句单行：不能有 <br>
    const q = h.match(/<div class="sp-q">([^<]*)<\/div>/);
    if (!q || q[1].includes('<br>')) return false;
    // 标语两行：内部恰好 1 个 <br>
    const s = h.match(/<div class="sp-s">([\s\S]*?)<\/div>/);
    if (!s) return false;
    return (s[1].match(/<br>/g) || []).length === 1;
  }],
  ['启动页：文案内容未被改动', () => {
    const h = PAGES.splash();
    return h.includes('你还能穿回那件衣服吗？')
      && h.includes('公开立减肥目标，熟人见证')
      && h.includes('陌生人围观，失败留痕');
  }],
  /* ⚠️ 2026-11-24 用户口径：「『亏了』品牌图标统一用这个狗头的形象」 */
  ['品牌图标：记录卡用狗头形象', () => {
    const h = PAGES.recordCard('f_success');
    return h.includes('<img class="rcb-dog" src="assets/dog_new.png"')
      && h.includes('class="rc-badge"') && h.includes('class="rc-brand"');
  }],
  ['全局：残留的「立了」品牌名已清零', () => {
    const probe = ['splash', 'login', 'home', 'square', 'myFlags', 'profile'];
    return probe.every(p => !PAGES[p]().includes('立了'));
  }],
];

let fail = 0;
for (const [name, fn] of checks) {
  let ok = false, err = '';
  try { ok = fn(); } catch (e) { err = e.message; }
  if (!ok) fail++;
  console.log(`  ${ok ? '[ OK ]' : '[FAIL]'} ${name}${err ? '  → ' + err : ''}`);
}
console.log(fail === 0 ? '\n全部通过' : `\n${fail} 项失败`);
