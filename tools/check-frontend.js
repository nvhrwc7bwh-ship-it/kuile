/**
 * 亏了 · 小程序前端自检
 * ===========================================================================
 * 【这个脚本干什么】
 *   在提交之前，把「开发者工具才能发现的问题」先查一遍。
 *
 * 【查什么】
 *   1. JSON 语法（app.json / 各页面 .json / 组件 .json）
 *   2. app.json 里 pages 列的页面，四个文件是否齐全
 *   3. usingComponents 指向的组件是否真实存在
 *   4. WXML 里用到的组件标签，是否在 usingComponents 里注册
 *   5. WXML 里引用的 data 字段，JS 里有没有定义
 *   6. WXSS 语法（花括号配平、var() 残留）
 *   7. 图标名是否真实存在
 *
 * 【怎么跑】
 *   node tools/check-frontend.js
 * ===========================================================================
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP = path.resolve(ROOT, '正式上线版/03-小程序前端');

let errors = [];
let warns = [];
let oks = [];

function err(msg) { errors.push(msg); }
function warn(msg) { warns.push(msg); }
function ok(msg) { oks.push(msg); }

/* ---------------------------------------------------------------------------
 * 1. 收集文件
 * ------------------------------------------------------------------------- */
function listDir(dir, ext) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...listDir(p, ext));
    else if (!ext || name.endsWith(ext)) out.push(p);
  }
  return out;
}

const appJsonPath = path.join(APP, 'app.json');
if (!fs.existsSync(appJsonPath)) {
  console.error('❌ 找不到 app.json');
  process.exit(1);
}

/* ---------------------------------------------------------------------------
 * 2. JSON 语法
 * ------------------------------------------------------------------------- */
const jsonFiles = [appJsonPath, ...listDir(path.join(APP, 'pages'), '.json'), ...listDir(path.join(APP, 'components'), '.json')];
const parsed = {};

for (const f of jsonFiles) {
  const rel = path.relative(APP, f);
  try {
    parsed[rel] = JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    err(`JSON 语法错误 ${rel}：${e.message}`);
  }
}
ok(`JSON 语法检查：${jsonFiles.length} 个文件`);

const appJson = parsed['app.json'] || {};

/* ---------------------------------------------------------------------------
 * 3. 页面四件套
 * ------------------------------------------------------------------------- */
const pageDirs = new Set();
for (const rel of Object.keys(parsed)) {
  if (rel.startsWith('pages' + path.sep)) {
    /* pages\index\index.json → pages\index\index
     * （去掉【扩展名】，保留页面名本身） */
    const parts = rel.split(path.sep);
    parts[parts.length - 1] = parts[parts.length - 1].replace(/\.json$/, '');
    pageDirs.add(parts.join('/'));
  }
}
for (const p of appJson.pages || []) {
  pageDirs.add(p);
}
for (const dir of pageDirs) {
  const rel = dir.split('/').join(path.sep);
  for (const ext of ['.js', '.wxml', '.wxss', '.json']) {
    const f = path.join(APP, rel + ext);
    if (!fs.existsSync(f)) {
      err(`页面文件缺失：${dir}${ext}`);
    }
  }
}
ok(`页面四件套检查：${pageDirs.size} 个页面`);

/* ---------------------------------------------------------------------------
 * 4. usingComponents 指向的组件是否存在
 * ------------------------------------------------------------------------- */
function checkUsingComponents(jsonObj, jsonRel) {
  const using = jsonObj.usingComponents || {};
  for (const [tag, target] of Object.entries(using)) {
    /* 相对路径以 / 开头表示项目根目录 */
    let base;
    if (target.startsWith('/')) {
      base = path.join(APP, target);
    } else if (target.startsWith('.')) {
      base = path.resolve(path.dirname(path.join(APP, jsonRel)), target);
    } else {
      continue;
    }
    if (!fs.existsSync(base + '.js')) {
      err(`组件不存在：${jsonRel} 里的 "${tag}" → ${target}`);
    }
    /* 组件自己的 .json 里如果也声明了 usingComponents，也要查 */
    const compJsonPath = base + '.json';
    if (fs.existsSync(compJsonPath)) {
      const rel = path.relative(APP, compJsonPath);
      try {
        const cj = JSON.parse(fs.readFileSync(compJsonPath, 'utf8'));
        checkUsingComponents(cj, rel);
      } catch (e) {
        /* 已在上面报过 */
      }
    }
  }
}
for (const [rel, obj] of Object.entries(parsed)) {
  checkUsingComponents(obj, rel);
}
ok('组件路径检查完成');

/* ---------------------------------------------------------------------------
 * 5. 全局组件标签 + WXML 里的标签
 * ------------------------------------------------------------------------- */
const globalTags = Object.keys(appJson.usingComponents || {});

/* 收集所有 WXML 里用到的自定义标签 */
const knownTags = new Set([
  'view', 'text', 'image', 'button', 'input', 'textarea', 'scroll-view',
  'swiper', 'swiper-item', 'navigator', 'form', 'label', 'picker', 'picker-view',
  'picker-view-column', 'checkbox', 'checkbox-group', 'radio', 'radio-group',
  'slider', 'switch', 'movable-area', 'movable-view', 'cover-view', 'cover-image',
  'rich-text', 'progress', 'icon', 'camera', 'map', 'video', 'canvas', 'web-view',
  'block', 'template', 'import', 'include', 'wxs', 'slot',
]);

const wxmlFiles = listDir(path.join(APP, 'pages'), '.wxml').concat(listDir(path.join(APP, 'components'), '.wxml'));

for (const f of wxmlFiles) {
  const rel = path.relative(APP, f);
  const src = fs.readFileSync(f, 'utf8');
  /* 找 <k-xxx 这样的标签 */
  const re = /<\/?([a-z][a-z0-9-]*)\b/g;
  let m;
  const found = new Set();
  while ((m = re.exec(src)) !== null) {
    found.add(m[1]);
  }
  for (const tag of found) {
    if (knownTags.has(tag)) continue;
    /* 自定义组件：k- 前缀的是全局组件 */
    if (tag.startsWith('k-')) {
      if (!globalTags.includes(tag)) {
        err(`未注册的自定义组件 <${tag}> —— ${rel}（需要在 app.json 的 usingComponents 里注册）`);
      }
      continue;
    }
    /* 其它驼峰/连字符标签：本地组件，需要在同目录的 .json 里注册 */
    warn(`未知标签 <${tag}> —— ${rel}`);
  }
}
ok(`WXML 标签检查：${wxmlFiles.length} 个文件`);

/* ---------------------------------------------------------------------------
 * 6. WXML 用到的 data 字段 vs JS 定义
 * ------------------------------------------------------------------------- */
for (const f of listDir(path.join(APP, 'pages'), '.wxml')) {
  const rel = path.relative(APP, f);
  const wxml = fs.readFileSync(f, 'utf8');
  const jsPath = f.replace(/\.wxml$/, '.js');
  if (!fs.existsSync(jsPath)) continue;
  const js = fs.readFileSync(jsPath, 'utf8');

  /* 收集 wxml 里 {{ xxx }} 的字段名 */
  const fields = new Set();
  const fre = /\{\{\s*([a-zA-Z_$][\w$]*)/g;
  let m;
  while ((m = fre.exec(wxml)) !== null) {
    const name = m[1];
    /* 字面量（true/false/null/undefined）不是数据字段 */
    if (['true', 'false', 'null', 'undefined'].includes(name)) continue;
    fields.add(name);
  }
  /* 收集 js 里 data: { ... } 的键 */
  const dataKeys = new Set();
  const dre = /data\s*:\s*\{([\s\S]*?)\n\s{0,4}\}/g;
  let dm;
  while ((dm = dre.exec(js)) !== null) {
    const body = dm[1];
    const kre = /(?:^|[,{\s])([a-zA-Z_$][\w$]*)\s*:/g;
    let km;
    while ((km = kre.exec(body)) !== null) {
      dataKeys.add(km[1]);
    }
  }
  /* 循环变量等，用 wx:for-item 声明的 */
  for (const item of ['item', 'index', 'value', 'key']) {
    dataKeys.add(item);
  }
  /* 扫 wxml 里的 wx:for-item="xxx" —— 那是自定义的循环变量名 */
  const fiRe = /wx:for-item\s*=\s*"([^"]+)"/g;
  let fim;
  while ((fim = fiRe.exec(wxml)) !== null) {
    dataKeys.add(fim[1]);
  }
  /* 扫 wxml 里的 wx:key —— 有时也用作变量 */
  const keyRe = /wx:key\s*=\s*"([^"]+)"/g;
  let keym;
  while ((keym = keyRe.exec(wxml)) !== null) {
    dataKeys.add(keym[1]);
  }
  /* 事件里 setData 的字段也算 */
  const sd = /setData\(\s*\{([\s\S]*?)\}\)/g;
  let sm;
  while ((sm = sd.exec(js)) !== null) {
    const kre = /(?:^|[,{\s])([a-zA-Z_$][\w$]*)\s*:/g;
    let km;
    while ((km = kre.exec(sm[1])) !== null) {
      dataKeys.add(km[1]);
    }
  }

  for (const fld of fields) {
    if (!dataKeys.has(fld)) {
      warn(`数据字段未定义：${rel} 里的 {{${fld}}} —— JS 的 data 里没有`);
    }
  }
}
ok('WXML 数据字段检查完成');

/* ---------------------------------------------------------------------------
 * 7. WXSS 语法
 * ------------------------------------------------------------------------- */
const wxssFiles = listDir(path.join(APP), '.wxss');
for (const f of wxssFiles) {
  const rel = path.relative(APP, f);
  const css = fs.readFileSync(f, 'utf8');
  const open = (css.match(/\{/g) || []).length;
  const close = (css.match(/\}/g) || []).length;
  if (open !== close) {
    err(`WXSS 花括号不配平：${rel}（{ = ${open}, } = ${close}）`);
  }
  if (/var\(--/.test(css)) {
    err(`WXSS 有未展开的 CSS 变量：${rel}`);
  }
}
ok(`WXSS 语法检查：${wxssFiles.length} 个文件`);

/* ---------------------------------------------------------------------------
 * 8. 图标名是否存在
 * ------------------------------------------------------------------------- */
const iconsPath = path.join(APP, 'utils/icons.js');
if (fs.existsSync(iconsPath)) {
  const icons = require(iconsPath);
  const names = new Set(Object.keys(icons));
  /* 扫所有文件里的 name="xxx"（图标组件用法） */
  for (const f of wxmlFiles) {
    const src = fs.readFileSync(f, 'utf8');
    const re = /<k-icon[^>]*\sname="([^"]+)"/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      if (!names.has(m[1])) {
        err(`图标不存在：${path.relative(APP, f)} 用了 name="${m[1]}"`);
      }
    }
  }
  /* 扫 JS 里 iconSrc('xxx') */
  for (const f of listDir(path.join(APP, 'pages'), '.js')) {
    const src = fs.readFileSync(f, 'utf8');
    const re = /iconSrc\(\s*'([^']+)'/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      if (!names.has(m[1])) {
        err(`图标不存在：${path.relative(APP, f)} 调用了 iconSrc('${m[1]}')`);
      }
    }
  }
  ok(`图标检查：${names.size} 枚可用`);
}

/* ---------------------------------------------------------------------------
 * 8. JS 里的 require 路径是否真实存在
 * ------------------------------------------------------------------------- */
const jsFiles = listDir(path.join(APP, 'pages'), '.js')
  .concat(listDir(path.join(APP, 'components'), '.js'))
  .concat(listDir(path.join(APP, 'utils'), '.js'));

for (const f of jsFiles) {
  const rel = path.relative(APP, f);
  const src = fs.readFileSync(f, 'utf8');
  /* 先去掉注释 —— 否则注释里的示例代码会被当成真的 require */
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')   /* 块注释 */
    .replace(/(^|[^:])\/\/.*$/gm, '$1'); /* 行注释（避开 http://） */
  const re = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const target = m[1];
    /* 只查相对路径（以 . 开头） */
    if (!target.startsWith('.')) continue;
    const resolved = path.resolve(path.dirname(f), target);
    /* 可能是 .js / .json / 目录下的 index.js */
    const cands = [
      resolved,
      resolved + '.js',
      resolved + '.json',
      path.join(resolved, 'index.js'),
      path.join(resolved, 'index.json'),
    ];
    if (!cands.some(c => fs.existsSync(c))) {
      err(`require 路径不存在：${rel} 里的 require('${target}')`);
    }
  }
}
ok(`require 路径检查：${jsFiles.length} 个 JS 文件`);

/* ---------------------------------------------------------------------------
 * 输出
 * ------------------------------------------------------------------------- */
console.log('');
console.log('════ 小程序前端自检 ════');
console.log('');
oks.forEach(o => console.log('  ✅ ' + o));
if (warns.length) {
  console.log('');
  console.log(`  ⚠️  警告 ${warns.length} 条：`);
  warns.forEach(w => console.log('     · ' + w));
}
if (errors.length) {
  console.log('');
  console.log(`  ❌ 错误 ${errors.length} 条：`);
  errors.forEach(e => console.log('     · ' + e));
}
console.log('');
console.log('════════════════════════════════════');
if (errors.length) {
  console.log(`❌ 有 ${errors.length} 个错误，必须修完才能提交`);
  console.log('');
  process.exit(1);
} else {
  console.log(`✅ 检查通过（${warns.length} 条警告不阻塞）`);
  console.log('');
}
