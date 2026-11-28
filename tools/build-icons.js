/**
 * 亏了 · Demo 图标提取器
 * ===========================================================================
 * 【这个脚本干什么】
 *   demo/js/app.js 里有一个 ICON_RAW 对象，装着 75 枚 SVG 图标（描边风格）。
 *   小程序 WXML 不能直接写 SVG，所以要把它们提取出来，做成一个 JS 模块。
 *
 * 【为什么不用 iconfont】
 *   demo 的图标全是 stroke="currentColor" 的描边风格。
 *   转成字体需要「描边转填充路径」，复杂且容易变形失真。
 *   而用 base64 SVG 的方案：
 *     · 不引入 .ttf 文件（少一个可能加载失败的环节）
 *     · 颜色可以在调用时传（currentColor 换成实际色值）
 *     · 尺寸任意，不糊
 *
 * 【怎么跑】
 *   node tools/build-icons.js
 *
 * 【产物】
 *   正式上线版/03-小程序前端/utils/icons.js   ← 图标库（name → SVG 字符串）
 * ===========================================================================
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEMO_APP = path.resolve(ROOT, 'demo/js/app.js');
const OUT_FILE = path.resolve(ROOT, '正式上线版/03-小程序前端/utils/icons.js');

/* ---------------------------------------------------------------------------
 * 提取 ICON_RAW
 * ------------------------------------------------------------------------- */
function extractIcons(src) {
  const icons = {};
  /* 匹配形如  name: '<svg ...>...</svg>',  的行 */
  const re = /^\s*([a-zA-Z][\w]*)\s*:\s*('(?:[^'\\]|\\.)*')\s*,?\s*$/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    let value = m[2];
    /* 反转义单引号字符串 */
    value = value.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    if (value.indexOf('<svg') === -1) continue;
    icons[name] = value;
  }
  return icons;
}

/**
 * 规范化 SVG
 * · 保证有 viewBox="0 0 24 24"（小程序渲染时需要确定的坐标系）
 * · 去掉多余的空白
 */
function normalize(svg) {
  let s = svg.trim();
  if (s.indexOf('viewBox=') === -1) {
    s = s.replace('<svg', '<svg viewBox="0 0 24 24"');
  }
  return s.replace(/\s+/g, ' ');
}

/* ---------------------------------------------------------------------------
 * 主流程
 * ------------------------------------------------------------------------- */
function build() {
  if (!fs.existsSync(DEMO_APP)) {
    console.error('❌ 找不到 demo/js/app.js');
    process.exit(1);
  }
  const src = fs.readFileSync(DEMO_APP, 'utf8');
  const raw = extractIcons(src);

  const names = Object.keys(raw);
  if (names.length === 0) {
    console.error('❌ 没提取到任何图标，demo/js/app.js 的结构可能变了');
    process.exit(1);
  }

  /* 同一个 SVG 被多个名字共用（demo 里有），去重后按名字索引 */
  const icons = {};
  names.forEach(n => {
    icons[n] = normalize(raw[n]);
  });

  /* 生成 JS 模块 */
  const entries = names.map(n => {
    const svg = icons[n];
    /* 用单引号包裹，内部的单引号（属性值里的）需要转义 */
    const escaped = svg.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `  ${n}: '${escaped}',`;
  }).join('\n');

  const out = `/**
 * 亏了 · 图标库（由 tools/build-icons.js 自动生成，请勿手改）
 * ---------------------------------------------------------------------------
 * 来源：demo/js/app.js 的 ICON_RAW
 * 数量：${names.length} 枚
 *
 * 【怎么用】
 *   const icons = require('../../utils/icons');
 *   const svg = icons.target;          // 拿到 SVG 字符串
 *
 *   渲染时用 utils/icon.js 的 iconSrc()，它会把 currentColor 换成实际颜色，
 *   再转成 base64 data URI 交给 <image>。
 * ===========================================================================
 */
module.exports = {
${entries}
};
`;

  fs.writeFileSync(OUT_FILE, out, 'utf8');

  console.log('✅ 已生成 icons.js');
  console.log(`   ${names.length} 枚图标 → ${path.relative(ROOT, OUT_FILE)}`);

  /* 重复的 SVG（不同名字同一个图形）—— 提个醒 */
  const seen = new Map();
  const dups = [];
  names.forEach(n => {
    if (seen.has(icons[n])) dups.push(`${seen.get(icons[n])} / ${n}`);
    else seen.set(icons[n], n);
  });
  if (dups.length) {
    console.log(`   （有 ${dups.length} 组图形重复：${dups.join(', ')}）`);
  }

  /* 完整性检查 */
  const noViewBox = names.filter(n => icons[n].indexOf('viewBox=') === -1);
  if (noViewBox.length) {
    console.warn(`   ⚠️ 这些图标缺 viewBox：${noViewBox.join(', ')}`);
  }
}

build();
