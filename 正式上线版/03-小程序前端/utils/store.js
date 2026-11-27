/**
 * 亏了 · 正式上线版 · 本地存储工具
 * ---------------------------------------------------------------------------
 * 【小白须知】小程序的本地存储像一个「小抽屉」，关掉小程序再打开，
 *   东西还在（最多 10MB）。我们用它存：
 *     · token（登录身份）
 *     · 用户资料
 *     · 服务器下发的规则参数
 */
const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const CONFIG_KEY = 'config';

function get(key) {
  try {
    return wx.getStorageSync(key);
  } catch (e) {
    return '';
  }
}

function set(key, value) {
  try {
    wx.setStorageSync(key, value);
  } catch (e) {
    console.error('存储失败', key, e);
  }
}

function remove(key) {
  try {
    wx.removeStorageSync(key);
  } catch (e) {
    /* 忽略 */
  }
}

module.exports = {
  get,
  set,
  remove,
  TOKEN_KEY,
  USER_KEY,
  CONFIG_KEY,
};
