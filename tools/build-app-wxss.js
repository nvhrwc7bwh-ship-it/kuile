/**
 * 亏了 · 小程序全局样式生成器
 * ===========================================================================
 * 【这个脚本干什么】
 *   把三份东西拼成最终的 app.wxss：
 *     ① styles/tokens.wxss   —— 从 demo 自动转换来的设计令牌与组件样式
 *     ② styles/adapter.wxss  —— 小程序专属适配层 + 老类名兼容（手写，不覆盖）
 *     ③ styles/app.head      —— 文件头注释
 *
 * 【为什么不用 @import】
 *   小程序的 @import 有两个坑：
 *     · 不支持相对路径之外的引用，路径写错就静默失效
 *     · 样式优先级顺序不直观 —— 冲突时哪边生效很难预测
 *   直接拼接成一个文件，顺序完全可控，出问题一眼能看到。
 *
 * 【怎么跑】
 *   node tools/build-app-wxss.js
 *
 * 【产物】
 *   正式上线版/03-小程序前端/app.wxss
 * ===========================================================================
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP_DIR = path.resolve(ROOT, '正式上线版/03-小程序前端');

const FILES = [
  { src: 'styles/tokens.wxss', label: '设计令牌（来自 demo 自动转换）' },
  { src: 'styles/adapter.wxss', label: '小程序适配层 + 老类名兼容' },
];

const OUT = path.join(APP_DIR, 'app.wxss');

const HEAD = `/* ==========================================================================
 * 亏了 · 正式上线版 · 全局样式
 * --------------------------------------------------------------------------
 * 【重要】这个文件是【自动生成】的，不要手改！
 *   要改样式，改这两份源文件，然后重新跑：
 *     node tools/build-app-wxss.js
 *
 * 【来源】
 *   ① styles/tokens.wxss   —— 由 tools/build-wxss.js 从 demo/css/app.css 转换
 *   ② styles/adapter.wxss  —— 小程序专属适配（安全区/rpx）与旧类名兼容
 *
 * 【顺序说明】
 *   适配层在后面，所以同名类以适配层为准 ——
 *   这样 demo 的样式能直接用，老页面的类名也不会失效。
 *
 * 【颜色速查】（来自 demo 设计系统）
 *   品牌橙 #FF6B00  背景米 #FAF7F4  文字深 #1C1613  文字灰 #857A6F
 *   成功绿 #0FBE7E  失败红 #F0413E  见证紫 #8B5CF6  信息蓝 #3B82F6
 * ========================================================================== */

`;

function build() {
  const parts = [];

  for (const f of FILES) {
    const p = path.join(APP_DIR, f.src);
    if (!fs.existsSync(p)) {
      console.error(`❌ 找不到 ${f.src}`);
      console.error('   先跑 node tools/build-wxss.js 生成 tokens.wxss');
      process.exit(1);
    }
    const body = fs.readFileSync(p, 'utf8');
    parts.push(`/* ============================================================================
 * ${f.label}
 * 来源：${f.src}
 * ============================================================================ */
${body.trim()}
`);
  }

  const out = HEAD + parts.join('\n');
  fs.writeFileSync(OUT, out, 'utf8');

  console.log('✅ 已生成 app.wxss');
  console.log(`   ${(out.length / 1024).toFixed(1)} KB`);

  /* 语法检查：花括号配平 */
  const open = (out.match(/\{/g) || []).length;
  const close = (out.match(/\}/g) || []).length;
  if (open !== close) {
    console.error(`   ❌ 花括号不配平：{ = ${open}, } = ${close}`);
    process.exit(1);
  }
  console.log('   花括号配平 ✓');

  /* 检查有没有残留 CSS 变量 */
  const leftover = (out.match(/var\(--/g) || []).length;
  if (leftover > 0) {
    console.warn(`   ⚠️ 有 ${leftover} 处 var() 未展开`);
  } else {
    console.log('   CSS 变量已全部展开 ✓');
  }
}

build();
