/* 全站巡检 —— 渲染全部页面，做结构校验 + 信息密度统计
 *
 * 合并了原先的 tools-check.js（结构校验）与 tools-audit.js（密度巡检）：
 * 两者都要把 demo 的 js 跑进 vm 沙箱取 PAGES，重复的加载样板没必要拆两份。
 *
 * 用法：node 巡检全站.js
 */
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
// 初始化状态层（否则读 STATE 的页面全部渲染失败）
vm.runInContext('initState()', sandbox);
try {
  vm.runInContext('INJECTORS.newUserWithFlags()', sandbox);
  vm.runInContext('INJECTORS.subscribe()', sandbox);
} catch (e) { /* INJECTORS 可能不存在，忽略 */ }

const names = Object.keys(PAGES);
console.log('页面数:', names.length);

const problems = [];
const stats = [];
const avatarPages = new Set();

for (const name of names) {
  let html;
  try { html = PAGES[name](); }
  catch (e) { problems.push(`${name}: RENDER ${e.message}`); continue; }
  if (typeof html !== 'string' || !html.trim()) { problems.push(`${name}: 空页面`); continue; }

  // HTML 注释不参与渲染 —— 扫描 emoji / 模板残留前先剥掉
  const vis = html.replace(/<!--[\s\S]*?-->/g, '');

  /* ── 结构校验 ── */
  // 1. 未替换的模板占位
  if (/\{\{|\}\}|\$\{/.test(vis)) problems.push(`${name}: 模板占位未替换`);
  // 2. 残留 emoji
  const em = vis.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}]/gu);
  if (em) problems.push(`${name}: 残留 emoji ${em.join(' ')}`);
  // 3. 未定义的图标（渲染出空 svg）
  if (/<div class="row-icon">\s*<\/div>/g.test(vis)) problems.push(`${name}: 空图标槽`);
  if (/<div class="[^"]*icon[^"]*">\s*<\/div>/.test(vis)) problems.push(`${name}: 空图标槽`);
  // 4. 标签配平
  for (const [tag, open, close] of [
    ['div', (vis.match(/<div/g)||[]).length, (vis.match(/<\/div>/g)||[]).length],
    ['span', (vis.match(/<span[\s>]/g)||[]).length, (vis.match(/<\/span>/g)||[]).length],
    ['button', (vis.match(/<button[\s>]/g)||[]).length, (vis.match(/<\/button>/g)||[]).length],
  ]) {
    if (open !== close) problems.push(`${name}: ${tag} 不平衡 ${open}/${close}`);
  }
  // 5. 引号总数必须为偶数
  const q = (vis.match(/"/g)||[]).length;
  if (q % 2) problems.push(`${name}: 引号总数为奇数 (${q})`);
  // 6. style 属性的括号配平 + 空声明
  (vis.match(/style="([^"]*)"/g) || []).forEach(s => {
    const val = s.slice(7, -1);
    const clean = val.replace(/\$\{[^}]*\}/g, 'X');
    const o = (clean.match(/\(/g)||[]).length, c = (clean.match(/\)/g)||[]).length;
    if (o !== c) problems.push(`${name}: style 括号不配平 -> ${clean.slice(0,60)}`);
    if (/;;/.test(clean)) problems.push(`${name}: style 有空声明 -> ${clean.slice(0,60)}`);
  });
  // 7. 未闭合的模板字符串
  if (/\$\{[^}]*$/.test(vis)) problems.push(`${name}: 模板字符串未闭合`);
  // 8. 头像页面记录
  if (/<img class="avatar/g.test(vis)) avatarPages.add(name);

  /* ── 信息密度统计 ── */
  stats.push({
    name,
    nums: (html.match(/>\s*\d+(?:\.\d+)?\s*</g)||[]).length,
    rows: (html.match(/class="row[ "]/g)||[]).length,
    tags: (html.match(/class="tag/g)||[]).length,
    len: html.length,
  });
}

console.log('\n=== 信息密度排行（数字块 / 行 / 标签） ===');
stats.sort((a,b)=>b.nums-a.nums).slice(0,12).forEach(s =>
  console.log(` ${s.name.padEnd(18)} 数字${String(s.nums).padStart(3)} 行${String(s.rows).padStart(3)} 标签${String(s.tags).padStart(3)} 长度${s.len}`));

console.log('\n含头像页面:', [...avatarPages].join(', '));

/* ── 素材路径完整性 ── */
console.log('\n=== 素材路径 ===');
const cssSrc = fs.readFileSync(path.join(__dirname, '..', 'css', 'app.css'), 'utf8');
const allHtml = stats.map(() => '').join('') +
  Object.keys(PAGES).map(n => { try { return PAGES[n](); } catch (e) { return ''; } }).join('');
const imgSrcs = [...new Set([...allHtml.matchAll(/src="(assets\/[^"]+)"/g)].map(m => m[1]))];
let missingImg = 0;
for (const s of imgSrcs) {
  if (!fs.existsSync(path.join(__dirname, '..', s))) { problems.push(`素材缺失: ${s}`); missingImg++; }
}
console.log('  <img src="assets/..."> 引用 %d 个，缺失 %d 个  %s',
  imgSrcs.length, missingImg, missingImg ? '*** MISMATCH ***' : 'OK');

const cssUrls = [...new Set([...cssSrc.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)].map(m => m[1]))];
let missingCss = 0;
for (const u of cssUrls) {
  if (/^(https?:|data:|#)/.test(u)) continue;
  if (!fs.existsSync(path.join(__dirname, '..', u))) { problems.push(`CSS 素材缺失: ${u}`); missingCss++; }
}
console.log('  CSS url() 引用 %d 个，缺失 %d 个  %s',
  cssUrls.length, missingCss, missingCss ? '*** MISMATCH ***' : 'OK');

console.log('\n=== 结构问题 ===');
if (problems.length) problems.forEach(p=>console.log(' -', p));
else console.log(' ? 无结构问题');

console.log('\n问题数:', problems.length);
process.exit(problems.length ? 1 : 0);
