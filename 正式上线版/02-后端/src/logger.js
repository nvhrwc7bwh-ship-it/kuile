/**
 * 亏了 · 正式上线版 · 日志工具
 * ---------------------------------------------------------------------------
 * 【小白须知】这个文件负责「把程序运行过程记下来」。
 *   出问题时第一件事就是看日志。它会把日志同时写到：
 *     · 控制台（你在终端里能直接看到）
 *     · 文件（logs/ 目录，服务器上看）
 */
const fs = require('fs');
const path = require('path');
const config = require('./config');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const COLORS = { error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[36m', debug: '\x1b[90m' };
const RESET = '\x1b[0m';

let stream = null;
function getStream() {
  if (stream) return stream;
  try {
    const dir = path.isAbsolute(config.log.dir)
      ? config.log.dir
      : path.resolve(process.cwd(), config.log.dir);
    fs.mkdirSync(dir, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    stream = fs.createWriteStream(path.join(dir, `app-${day}.log`), { flags: 'a' });
  } catch (e) {
    stream = { write: () => true };
  }
  return stream;
}

function write(level, msg, meta) {
  if (LEVELS[level] > LEVELS[config.log.level]) return;
  const ts = new Date().toISOString();
  const metaStr = meta && Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  const line = `${ts} [${level.toUpperCase()}] ${msg}${metaStr}`;
  const color = COLORS[level] || '';
  const out = level === 'error' ? console.error : console.log;
  out(`${color}${line}${RESET}`);
  try { getStream().write(line + '\n'); } catch (e) { /* 写日志失败不能影响主流程 */ }
}

module.exports = {
  error: (msg, meta) => write('error', msg, meta),
  warn: (msg, meta) => write('warn', msg, meta),
  info: (msg, meta) => write('info', msg, meta),
  debug: (msg, meta) => write('debug', msg, meta),
};
