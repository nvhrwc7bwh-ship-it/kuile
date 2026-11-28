/**
 * 亏了 · 正式上线版 · 冒烟测试启动器
 * ---------------------------------------------------------------------------
 * 【小白须知】这个脚本会自动：
 *   1. 在 3999 端口起一个测试服务
 *   2. 跑 tests/smoke.js 打接口
 *   3. 关掉测试服务
 *
 * 【怎么跑】
 *   node tests/run-smoke.js
 */
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

console.log('▶ 启动测试服务…');

const server = spawn(process.execPath, [path.join(ROOT, 'src', 'server.js')], {
  env: { ...process.env, PORT: '3999', NODE_ENV: 'test', SKIP_DB_CHECK: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d.toString(); });
server.stderr.on('data', (d) => { serverLog += d.toString(); });

/* 等服务起来 */
let waited = 0;
function waitForServer(then) {
  const http = require('http');
  const req = http.get('http://127.0.0.1:3999/api/health', (res) => {
    res.resume();
    then(true);
  });
  req.on('error', () => {
    waited += 500;
    if (waited > 15000) { then(false); return; }
    setTimeout(() => waitForServer(then), 500);
  });
}

waitForServer((up) => {
  if (!up) {
    console.error('✗ 测试服务启动失败');
    console.error(serverLog.slice(-1500));
    server.kill();
    process.exit(1);
  }

  console.log('✓ 测试服务已启动，开始跑冒烟测试…\n');

  const smoke = spawn(process.execPath, [path.join(ROOT, 'tests', 'smoke.js')], {
    stdio: 'inherit',
    env: { ...process.env, SMOKE_PORT: '3999' },
  });

  smoke.on('exit', (code) => {
    server.kill();
    setTimeout(() => process.exit(code), 300);
  });
});
