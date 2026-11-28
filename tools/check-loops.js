/**
 * 亏了 · WXML 循环变量体检
 * ===========================================================================
 * 【这个脚本干什么】
 *   找出 WXML 里的「循环变量用错」的问题。
 *
 * 【为什么要有这个】
 *   小程序的 wx:for 默认变量名是 item。
 *   如果写 wx:for="{{list}}" 却用 {{p.xxx}}（而不是 {{item.xxx}}），
 *   或者忘了写 wx:for-item="p"，这一块就渲染不出来 —— 而且【不报错】，
 *   只是静默空白，非常难查。
 *
 * 【怎么跑】
 *   node tools/check-loops.js
 * ===========================================================================
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP = path.resolve(ROOT, '正式上线版/03-小程序前端');

function listDir(dir, ext) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) out.push(...listDir(p, ext));
    else if (name.endsWith(ext)) out.push(p);
  }
  return out;
}

/**
 * 把 WXML 按标签切成「区块」
 * 每个区块记录：起始标签的属性、结束位置
 * 用来判断某个 {{var}} 引用是否落在某个 wx:for 区块内
 */
function parseBlocks(src) {
  const blocks = [];
  const tagRe = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  const stack = [];
  let m;
  while ((m = tagRe.exec(src)) !== null) {
    const [full, closing, tagName, attrs, selfClose] = m;
    if (closing) {
      const top = stack.pop();
      if (top) {
        top.end = m.index;
        blocks.push(top);
      }
    } else if (!selfClose) {
      const hasFor = /\bwx:for\s*=/.test(attrs);
      const hasForItem = /\bwx:for-item\s*=\s*"([^"]+)"/.exec(attrs);
      const hasForIndex = /\bwx:for-index\s*=\s*"([^"]+)"/.exec(attrs);
      stack.push({
        start: m.index,
        end: -1,
        tagName,
        hasFor,
        itemVar: hasForItem ? hasForItem[1] : 'item',
        indexVar: hasForIndex ? hasForIndex[1] : 'index',
      });
    }
  }
  return blocks;
}

/** 收集一段源码里用到的「顶层变量名」（只取 {{ xxx. 的 xxx 部分） */
function collectRootVars(text) {
  const vars = new Set();
  const re = /\{\{\s*([a-zA-Z_$][\w$]*)\s*[.\[\]]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    vars.add(m[1]);
  }
  return vars;
}

const problems = [];
let checked = 0;

for (const f of listDir(path.join(APP, 'pages'), '.wxml')) {
  const rel = path.relative(APP, f);
  const src = fs.readFileSync(f, 'utf8');
  checked++;

  const blocks = parseBlocks(src);

  /* 每个 wx:for 区块里，允许使用的变量名 */
  for (const b of blocks) {
    if (!b.hasFor) continue;
    const inner = src.slice(b.start, b.end);

    /* 收集这个区块里（不含嵌套 for）用到的根变量 */
    const nested = blocks.filter(x => x !== b && x.start > b.start && x.end <= b.end && x.hasFor);
    let innerText = inner;
    /* 把嵌套区块的内容挖掉，避免重复报告 */
    for (const n of nested.sort((x, y) => y.start - x.start)) {
      innerText = innerText.slice(0, n.start - b.start) + innerText.slice(n.end - b.start);
    }

    const used = collectRootVars(innerText);
    const allowed = new Set([b.itemVar, b.indexVar]);

    /* 这个区块【外面】的循环也提供了变量 —— 外层变量在内层是合法的。
     * 判定：变量在【循环表达式本身】里出现过（如 wx:for="{{flag.witnesses}}"
     * 里的 flag），说明它是外层作用域的变量，不是用错的循环变量。 */
    const outerVars = new Set();
    const forRe = /wx:for\s*=\s*"\{\{([^}]*)\}\}"/g;
    let fm;
    while ((fm = forRe.exec(b.start >= 0 ? src.slice(0, b.start) : '')) !== null) {
      const om = fm[1].match(/([a-zA-Z_$][\w$]*)/);
      if (om) outerVars.add(om[1]);
    }
    /* 同一个标签上，wx:for 表达式里的根变量也是外层的 */
    const selfFor = /wx:for\s*=\s*"\{\{([^}]*)\}\}"/.exec(
      src.slice(b.start, b.start + 200)
    );
    if (selfFor) {
      const om = selfFor[1].match(/([a-zA-Z_$][\w$]*)/);
      if (om) outerVars.add(om[1]);
    }
    /* 这个区块所在的 JS 文件里，data 里的字段也是合法变量 */
    /* （循环变量名如果和 data 字段同名，以 data 为准） */

    for (const v of used) {
      if (allowed.has(v)) continue;
      if (outerVars.has(v)) continue;
      problems.push({
        rel,
        line: src.slice(0, b.start).split(/\r?\n/).length,
        v,
        itemVar: b.itemVar,
        snippet: src.slice(b.start, Math.min(b.start + 110, b.end)).split(/\n/)[0].trim(),
      });
    }
  }
}

console.log('');
console.log('════ WXML 循环变量体检 ════');
console.log(`   扫描 ${checked} 个 WXML 文件`);
console.log('');

if (problems.length === 0) {
  console.log('✅ 没有发现循环变量用错的问题');
  console.log('');
} else {
  console.log(`❌ 发现 ${problems.length} 个问题：`);
  console.log('');
  for (const p of problems) {
    console.log(`  ${p.rel} : ${p.line}`);
    console.log(`     用了 {{${p.v}}}，但这个循环的变量名是「${p.itemVar}」`);
    console.log(`     ${p.snippet}`);
    console.log('');
    console.log(`     【怎么修】加 wx:for-item="${p.v}"：`);
    console.log(`     wx:for="{{...}}" wx:for-item="${p.v}" wx:key="..."`);
    console.log('');
  }
  console.log('════════════════════════════════════');
  process.exit(1);
}
console.log('');
