/**
 * 亏了 · 一键验证
 * ===========================================================================
 * 【这个脚本干什么】
 *   把所有检查跑一遍。改完代码后跑这一个就行。
 *
 * 【怎么跑】
 *   node tools/verify.js
 * ===========================================================================
 */
const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TOOLS = path.join(__dirname);

const STEPS = [
  { name: '生成样式令牌（demo CSS → WXSS）', script: 'build-wxss.js' },
  { name: '生成图标库（demo SVG → JS）', script: 'build-icons.js' },
  { name: '拼装 app.wxss', script: 'build-app-wxss.js' },
  { name: '前端静态自检', script: 'check-frontend.js' },
  { name: 'WXML 循环变量体检', script: 'check-loops.js' },
  { name: '首页逻辑模拟测试', script: 'simulate-home.js' },
];

console.log('');
console.log('════════════ 亏了 · 一键验证 ════════════');
console.log('');

let failed = 0;

for (const step of STEPS) {
  process.stdout.write(`▶ ${step.name} ... `);
  try {
    const out = execFileSync(process.execPath, [path.join(TOOLS, step.script)], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    console.log('✅');
    /* 把脚本里的 ❌ 行显示出来（如果有） */
    const bad = out.split(/\r?\n/).filter(l => l.includes('❌'));
    if (bad.length) {
      bad.forEach(l => console.log('    ' + l.trim()));
    }
  } catch (e) {
    console.log('❌ 失败');
    failed++;
    const out = (e.stdout || '') + (e.stderr || '');
    out.split(/\r?\n/)
      .filter(l => l.trim())
      .slice(-25)
      .forEach(l => console.log('    ' + l));
  }
}

console.log('');
console.log('════════════════════════════════════════');
if (failed > 0) {
  console.log(`❌ 有 ${failed} 项没通过`);
  console.log('');
  process.exit(1);
} else {
  console.log('✅ 全部通过');
  console.log('');
}
