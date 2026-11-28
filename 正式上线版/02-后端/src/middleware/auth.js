/**
 * 亏了 · 正式上线版 · 登录鉴权中间件
 * ---------------------------------------------------------------------------
 * 【小白须知】这个文件负责「确认你是谁」。
 *
 * 【登录流程是什么样子】
 *   1. 小程序调 wx.login 拿到一个临时的 code
 *   2. 小程序把 code 发给后端：POST /api/auth/login
 *   3. 后端拿 code 去微信换 openid，同时签发一个 token
 *   4. token 存在小程序本地，以后每次请求都带上：Authorization: Bearer <token>
 *   5. 后端每次收到请求就查一下 token 对应谁
 *
 * 【安全要点】
 *   · token 存在数据库里，可以随时作废（用户换设备、注销时）
 *   · 过期自动失效，默认 30 天
 */
const config = require('../config');
const db = require('../db');
const logger = require('../logger');
const { newToken, BizError, ERR } = require('../utils');

/* ---------------------------------------------------------------------------
 * 微信登录：code 换 openid
 * ------------------------------------------------------------------------ */

/**
 * 用 wx.login 拿到的 code 换取 openid / session_key
 * @param {string} code 小程序 wx.login 的返回值
 */
async function code2Openid(code) {
  const url = 'https://api.weixin.qq.com/sns/jscode2session'
    + `?appid=${encodeURIComponent(config.wechat.appid)}`
    + `&secret=${encodeURIComponent(config.wechat.appsecret)}`
    + `&js_code=${encodeURIComponent(code)}`
    + '&grant_type=authorization_code';

  const res = await fetch(url);
  const data = await res.json();
  if (data.errcode) {
    throw new BizError(ERR.WECHAT, `微信登录失败（${data.errcode}）：${data.errmsg}`);
  }
  return { openid: data.openid, unionid: data.unionid || '', sessionKey: data.session_key };
}

/* ---------------------------------------------------------------------------
 * 会话
 * ------------------------------------------------------------------------ */

/**
 * 签发 token
 */
async function issueToken(userId) {
  const token = newToken();
  const expires = new Date(Date.now() + config.token.expireDays * 86400000);
  await db.execute(
    'INSERT INTO session (token, user_id, expires_at) VALUES (?, ?, ?)',
    [token, userId, expires]
  );
  return { token, expiresAt: expires };
}

/**
 * 校验 token，返回用户信息；无效则抛错
 */
async function resolveUser(token) {
  if (!token) throw new BizError(ERR.UNAUTHORIZED, '请先登录');
  const row = await db.queryOne(
    `SELECT s.token, s.expires_at, u.id AS user_id, u.credit_score, u.flags_created,
            u.nickname, u.avatar_url, u.bio
       FROM session s JOIN user u ON u.id = s.user_id
      WHERE s.token = ?`,
    [token]
  );
  if (!row) throw new BizError(ERR.UNAUTHORIZED, '登录已失效，请重新进入小程序');
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.execute('DELETE FROM session WHERE token = ?', [token]);
    throw new BizError(ERR.TOKEN_EXPIRED, '登录已过期，请重新进入小程序');
  }
  return row;
}

/* ---------------------------------------------------------------------------
 * Express 中间件
 * ------------------------------------------------------------------------ */

/**
 * 必须登录
 */
async function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.query.token || '');
    const user = await resolveUser(token);
    req.user = user;
    req.userId = user.user_id;
    next();
  } catch (e) {
    /* 业务错误原样抛出（401 等） */
    if (e && e.biz) {
      next(e);
      return;
    }
    /* 其它异常（数据库不通等）一律按「未登录」处理，避免把内部错误泄露给客户端 */
    logger.error('鉴权过程出错', { err: e.message });
    next(new BizError(ERR.UNAUTHORIZED, '请先登录'));
  }
}

/**
 * 可选登录：登录了就带 req.user，没登录也放行
 */
async function optionalAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token) {
      req.user = await resolveUser(token);
      req.userId = req.user.user_id;
    }
  } catch (e) {
    /* 静默忽略，走游客逻辑 */
  }
  next();
}

module.exports = { code2Openid, issueToken, resolveUser, requireAuth, optionalAuth };
