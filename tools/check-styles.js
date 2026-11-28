/**
 * 亏了 · 样式令牌体检
 * ===========================================================================
 * 【这个脚本干什么】
 *   检查 styles/tokens.wxss（从 demo 转换来的样式）里，
 *   有没有「在小程序里会失效」的写法，并统计影响面。
 *
 * 【为什么要查】
 *   demo 的 CSS 有一个设计习惯：元素的颜色/背景/圆角往往【继承】自父级，
 *   或者靠【内联 style】给。
 *   浏览器里这样很省事，搬进小程序就会变成「白底白字」「透明卡片」。
 *   这个脚本把这类写法找出来，作为第 2 轮重写 WXML 时的清单。
 *
 * 【怎么跑】
 *   node tools/check-styles.js
 * ===========================================================================
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TOKENS = path.resolve(ROOT, '正式上线版/03-小程序前端/styles/tokens.wxss');
const ADAPTER = path.resolve(ROOT, '正式上线版/03-小程序前端/styles/adapter.wxss');

/* ---------------------------------------------------------------------------
 * 检查项
 *   每项：{ 名称, 正则, 说明, 严重度 }
 * ------------------------------------------------------------------------- */
const CHECKS = [
  {
    name: '依赖继承的颜色/背景',
    re: /(color|background|border-color)\s*:\s*inherit/g,
    desc: '在小程序里会取到父级色，往往是「看不见」',
    level: 'high',
  },
  {
    name: '依赖继承的圆角',
    re: /border-radius\s*:\s*inherit/g,
    desc: '会变成直角或继承父级的圆角',
    level: 'mid',
  },
  {
    name: 'CSS 变量未展开',
    re: /var\(--/g,
    desc: 'WXSS 不支持 CSS 变量，必须展开成字面值',
    level: 'high',
  },
  {
    name: 'backdrop-filter',
    re: /backdrop-filter\s*:/g,
    desc: '小程序不支持，会被忽略',
    level: 'low',
  },
  {
    name: 'color-mix()',
    re: /color-mix\(/g,
    desc: '小程序不支持，要预计算成实色',
    level: 'low',
  },
  {
    name: 'position:sticky',
    re: /position\s*:\s*sticky/g,
    desc: '小程序支持，但需要祖先有滚动容器',
    level: 'low',
  },
  {
    name: 'aspect-ratio',
    re: /aspect-ratio\s*:/g,
    desc: '较新基础库支持，低版本可能无效',
    level: 'low',
  },
  {
    name: 'CSS 伪元素 ::before/::after',
    re: /::(before|after)/g,
    desc: '小程序支持 content 属性，但用法受限',
    level: 'low',
  },
  {
    name: 'grid 布局',
    re: /display\s*:\s*grid/g,
    desc: '较新基础库支持，低版本可能无效',
    level: 'low',
  },
  {
    name: 'vh/vw 单位',
    re: /\d(vh|vw)\b/g,
    desc: '小程序支持，但与 rpx 混用要注意',
    level: 'low',
  },
];

function scan(file) {
  const css = fs.readFileSync(file, 'utf8');
  const lines = css.split(/\r?\n/);
  const result = [];

  for (const c of CHECKS) {
    const hits = [];
    lines.forEach((line, i) => {
      c.re.lastIndex = 0;
      if (c.re.test(line)) {
        hits.push({ line: i + 1, text: line.trim().slice(0, 90) });
      }
    });
    if (hits.length) {
      result.push({ check: c, hits });
    }
  }
  return result;
}

function main() {
  console.log('');
  console.log('════ 样式令牌体检 ════');
  console.log('');

  const files = [
    { name: 'tokens.wxss（demo 转换）', path: TOKENS },
    { name: 'adapter.wxss（适配层）', path: ADAPTER },
  ];

  let highCount = 0;

  for (const f of files) {
    if (!fs.existsSync(f.path)) {
      console.log(`⚠️  找不到 ${f.name}`);
      continue;
    }
    const res = scan(f.path);
    console.log(`── ${f.name} ──`);
    if (res.length === 0) {
      console.log('   ✅ 没有发现问题');
    }
    for (const r of res) {
      const mark = r.check.level === 'high' ? '❌' : r.check.level === 'mid' ? '⚠️ ' : 'ℹ️ ';
      console.log(`   ${mark} ${r.check.name} —— ${r.hits.length} 处`);
      console.log(`      ${r.check.desc}`);
      if (r.check.level === 'high') highCount += r.hits.length;
      r.hits.slice(0, 3).forEach(h => {
        console.log(`      · L${h.line}: ${h.text}`);
      });
      if (r.hits.length > 3) {
        console.log(`      · …… 还有 ${r.hits.length - 3} 处`);
      }
    }
    console.log('');
  }

  console.log('════════════════════════════════════');
  if (highCount > 0) {
    console.log(`⚠️  tokens.wxss 有 ${highCount} 处「高危」写法`);
    console.log('');
    console.log('【这些不是错误，是 demo 的设计习惯】');
    console.log('demo 的样式经常靠父级或内联 style 给颜色/背景/圆角，');
    console.log('浏览器里没问题，搬进小程序会「透明」。');
    console.log('');
    console.log('【怎么办】');
    console.log('  · 第 2 轮重写 WXML 时，按 demo 的效果逐页落实这些类');
    console.log('  · adapter.wxss 已给 .btn / .card 补了默认外观');
    console.log('  · 其余的按需在页面 .wxss 里补');
  } else {
    console.log('✅ 未发现高危写法');
  }
  console.log('');
}

main();
