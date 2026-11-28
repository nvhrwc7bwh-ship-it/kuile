/**
 * 亏了 · 正式上线版 · 后端主入口
 * ===========================================================================
 * 【小白须知】这个文件是后端的启动入口。
 *   服务器上执行： node src/server.js
 *   就把服务跑起来了。
 *
 * 【它做了什么】
 *   1. 启动 HTTP 服务
 *   2. 注册所有 API 路由
 *   3. 每分钟跑一次定时任务（推进 Flag 状态、判断卡、结算）
 *   4. 统一处理错误，返回固定格式
 * ===========================================================================
 */
const express = require('express');
const cors = require('cors');
const config = require('./config');
const logger = require('./logger');
const db = require('./db');
const { ok, fail, BizError, ERR } = require('./utils');

/* ---------------------------------------------------------------------------
 * 应用
 * ------------------------------------------------------------------------ */
const app = express();

/* 信任反向代理（Nginx 在前面），这样 req.ip 才是真实客户端 IP */
app.set('trust proxy', true);
app.disable('x-powered-by');

/* CORS：小程序开发工具和 Web 调试需要，正式版小程序不受影响 */
app.use(cors());

/* 解析 JSON 请求体，限制 2MB */
app.use(express.json({ limit: '2mb' }));

/* 微信支付回调需要原始报文，这里把原文挂到 req.body.__raw */
app.use((req, res, next) => {
  if (req.originalUrl === '/api/pay/notify' && req.body) {
    req.body.__raw = JSON.stringify(req.body);
  }
  next();
});

/* 访问日志 */
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - started;
    const line = `${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`;
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.info(line);
  });
  next();
});

/* ---------------------------------------------------------------------------
 * 路由
 * ------------------------------------------------------------------------ */

/** 健康检查 —— 部署时用它确认服务活着 */
app.get('/api/health', async (req, res) => {
  let dbOk = false;
  try {
    dbOk = await db.ping();
  } catch (e) {
    logger.error('健康检查：数据库连接失败', { err: e.message });
  }
  res.json(ok({
    service: 'kuile-api',
    version: require('../package.json').version,
    time: new Date().toISOString(),
    db: dbOk,
    env: config.env,
    /* 押金总开关：false = 内测阶段暂不收取押金 */
    depositEnabled: config.deposit.enabled,
  }, dbOk ? 'ok' : '数据库不可用'));
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/flags', require('./routes/flags'));
app.use('/api/social', require('./routes/social'));
app.use('/api/witness', require('./routes/witness'));
app.use('/api/pay', require('./routes/pay'));
app.use('/api/users', require('./routes/users'));
app.use('/api/me', require('./routes/me'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api', require('./routes/notifications'));

/* ---------------------------------------------------------------------------
 * 404
 * ------------------------------------------------------------------------ */
app.use((req, res) => {
  res.status(404).json(fail(ERR.NOT_FOUND, `接口不存在：${req.method} ${req.path}`));
});

/* ---------------------------------------------------------------------------
 * 统一错误处理
 * ------------------------------------------------------------------------ */
app.use((err, req, res, next) => {
  if (err instanceof BizError) {
    res.status(400).json(fail(err.code, err.message));
    return;
  }
  logger.error('未捕获异常', {
    path: req.originalUrl,
    err: err.message,
    stack: err.stack,
  });
  res.status(500).json(fail(ERR.SERVER, '服务器开小差了，请稍后再试'));
});

/* ---------------------------------------------------------------------------
 * 定时任务
 * ------------------------------------------------------------------------ */

/**
 * 推进 Flag 生命周期：
 *   · 筹备期到期 → 进行中
 *   · 打卡日次日凌晨 → 判断卡
 *   · 结束日 → 结算
 */
async function tick() {
  try {
    const flagService = require('./services/flagService');
    const r = await flagService.syncLifecycles();
    if (r.prep || r.settled) {
      logger.info('生命周期推进', r);
    }
  } catch (e) {
    logger.error('定时任务执行失败', { err: e.message, stack: e.stack });
  }
}

let timer = null;
function startScheduler() {
  if (timer) return;
  /* 每 60 秒跑一次 */
  timer = setInterval(tick, 60 * 1000);
  /* 服务刚启动时先跑一次 */
  setTimeout(tick, 3000);
  logger.info('定时任务已启动（每 60 秒）');
}

/* ---------------------------------------------------------------------------
 * 启动
 * ------------------------------------------------------------------------ */
async function start() {
  try {
    /* 先确认数据库通 */
    /* SKIP_DB_CHECK=1 时跳过（仅供无数据库环境下的路由冒烟测试用） */
    if (process.env.SKIP_DB_CHECK === '1') {
      logger.warn('已跳过数据库连接检查（SKIP_DB_CHECK=1）—— 仅用于接口路由冒烟测试');
    } else {
      const okDb = await db.ping();
      if (!okDb) {
        logger.error('数据库连接失败，服务无法启动。请检查 .env 里的 DB_* 配置。');
        process.exit(1);
      }
      logger.info('数据库连接正常');
    }

    app.listen(config.port, '0.0.0.0', () => {
      logger.info('亏了 · 后端服务已启动', {
        port: config.port,
        env: config.env,
        apiBaseUrl: config.apiBaseUrl,
      });
    });

    startScheduler();
  } catch (e) {
    logger.error('服务启动失败', { err: e.message, stack: e.stack });
    process.exit(1);
  }
}

/* 优雅退出：收到停止信号时先关数据库 */
async function shutdown(signal) {
  logger.info('收到退出信号，正在关闭服务', { signal });
  if (timer) clearInterval(timer);
  try { await db.close(); } catch (e) { /* 忽略 */ }
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

/* 未捕获的 Promise 异常也要记下来，不能让服务静默死掉 */
process.on('unhandledRejection', (reason) => {
  logger.error('未处理的 Promise 异常', { reason: String(reason) });
});

if (require.main === module) {
  start();
}

module.exports = { app, start, tick };
