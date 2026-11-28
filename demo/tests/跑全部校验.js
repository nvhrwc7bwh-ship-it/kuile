/* 一键跑全部校验脚本
 *
 * 用法：
 *   node 跑全部校验.js          跑全部
 *   node 跑全部校验.js photos   只跑名字里含 photos 的
 *
 * 每个 _verify_*.js 都是独立进程跑（它们各自建 vm 沙箱，共享进程会串状态）。
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const D = __dirname;
const filter = process.argv[2] || '';

const files = fs.readdirSync(D)
  .filter(f => /^_verify.*\.js$/.test(f))
  .filter(f => !filter || f.includes(filter))
  .sort();

if (!files.length) {
  console.error('没有匹配的校验脚本（filter=%s）', filter);
  process.exit(1);
}

let failed = 0;
console.log('跑 %d 个校验脚本\n', files.length);

for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(D, f)], {
    encoding: 'utf8',
    cwd: D,
  });
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status === 0) {
    // 只打印结论行，细节刷屏没意义
    const last = out.trim().split('\n').filter(Boolean).pop() || '';
    console.log('  ✅ ' + f.padEnd(28) + ' ' + last.slice(0, 60));
  } else {
    failed++;
    console.log('  ❌ ' + f.padEnd(28) + ' (exit ' + r.status + ')');
    console.log(out.split('\n').filter(l => /FAIL|❌|Error|错误/.test(l))
      .slice(0, 12).map(l => '       ' + l.trim()).join('\n'));
  }
}

console.log('\n%s', failed ? `❌ ${failed} 个脚本失败` : '✅ 全部通过');
process.exit(failed ? 1 : 0);
