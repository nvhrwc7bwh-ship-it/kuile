/**
 * 亏了 · 正式上线版 · 通用工具
 * ---------------------------------------------------------------------------
 * 【小白须知】这个文件放一些到处都要用的小工具函数。
 */
const crypto = require('crypto');

/** 生成带前缀的业务 ID */
function newId(prefix) {
  return prefix + '_' + crypto.randomBytes(12).toString('hex');
}

/** 生成随机 token（登录态用） */
function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

/** 生成订单号：年月日时分秒 + 随机数（微信要求唯一且 ≤32 位） */
function newTradeNo(prefix = 'KL') {
  const d = new Date();
  const p = (n, len = 2) => String(n).padStart(len, '0');
  const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return `${prefix}${ts}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

/** 计算字符串 SHA256 签名（回调防重放、参数校验用） */
function sha256(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

/** 生成 UTC 日期字符串 */
function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** 给日期加天数 */
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 两个日期相差几天（b - a） */
function diffDays(a, b) {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  return Math.floor((db - da) / 86400000);
}

/** 标准 API 返回格式 */
function ok(data = null, msg = 'ok') {
  return { code: 0, msg, data };
}

/** 失败返回格式 */
function fail(code, msg, data = null) {
  return { code, msg, data };
}

/** 业务错误（会被统一转成 HTTP 400 + code） */
class BizError extends Error {
  constructor(code, msg) {
    super(msg);
    this.code = code;
    this.biz = true;
  }
}

/** 常用错误码 */
const ERR = {
  PARAM: 40001,        // 参数不对
  UNAUTHORIZED: 40100, // 没登录
  TOKEN_EXPIRED: 40101,
  FORBIDDEN: 40300,    // 没权限
  NOT_FOUND: 40400,    // 找不到
  CONFLICT: 40900,     // 状态冲突
  SERVER: 50000,       // 服务器内部错误
  WECHAT: 50200,       // 微信接口错误
  AI: 50300,           // AI 服务错误
};

module.exports = {
  newId,
  newToken,
  newTradeNo,
  sha256,
  todayStr,
  addDays,
  diffDays,
  ok,
  fail,
  BizError,
  ERR,
};
