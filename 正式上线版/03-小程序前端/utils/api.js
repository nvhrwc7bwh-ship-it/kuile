/**
 * 亏了 · 正式上线版 · 网络请求封装
 * ===========================================================================
 * 【小白须知】这个文件负责「跟服务器说话」。
 *
 *   所有请求都走这里的 api.get / api.post，
 *   这样可以统一处理：
 *     · 自动带上登录身份（token）
 *     · 服务器返回错误时统一提示
 *     · 登录过期时自动跳登录
 *
 * 【服务器地址在哪改】
 *   看 config/index.js 里的 baseUrl。
 * ===========================================================================
 */
const store = require('./store');
const { BASE_URL, TIMEOUT } = require('../config/index');

/* ---------------------------------------------------------------------------
 * 核心请求
 * ------------------------------------------------------------------------ */

/**
 * @param {string} url    接口路径，如 '/api/flags'
 * @param {string} method GET / POST / PUT / DELETE
 * @param {object} data   请求参数
 * @param {boolean} noAuth 是否不带 token（默认带）
 */
function request(url, method, data, noAuth) {
  return new Promise(function (resolve, reject) {
    const header = { 'Content-Type': 'application/json' };
    if (!noAuth) {
      const token = store.get('token');
      if (token) header.Authorization = 'Bearer ' + token;
    }

    wx.request({
      url: BASE_URL + url,
      method: method || 'GET',
      data: data || {},
      header: header,
      timeout: TIMEOUT,
      success: function (res) {
        const body = res.data;
        /* 服务器返回非 0 → 业务错误 */
        if (body && typeof body.code === 'number' && body.code !== 0) {
          handleBizError(body.code, body.msg);
          reject(body);
          return;
        }
        resolve(body);
      },
      fail: function (err) {
        wx.showToast({
          title: '网络连接失败，请检查网络',
          icon: 'none',
          duration: 2000,
        });
        reject(err);
      },
    });
  });
}

/**
 * 处理业务错误码
 */
function handleBizError(code, msg) {
  /* 40100 / 40101：登录失效 → 清 token 重新登录 */
  if (code === 40100 || code === 40101) {
    store.remove('token');
    store.remove('user');
    wx.showToast({ title: msg || '请重新进入小程序', icon: 'none' });
    setTimeout(function () {
      wx.reLaunch({ url: '/pages/index/index' });
    }, 1200);
    return;
  }
  wx.showToast({ title: msg || '操作失败', icon: 'none', duration: 2200 });
}

/* ---------------------------------------------------------------------------
 * 对外方法
 * ------------------------------------------------------------------------ */

function get(url, data) {
  return request(url, 'GET', data);
}

function post(url, data) {
  return request(url, 'POST', data);
}

function put(url, data) {
  return request(url, 'PUT', data);
}

function del(url, data) {
  return request(url, 'DELETE', data);
}

/* ---------------------------------------------------------------------------
 * 登录
 * ------------------------------------------------------------------------ */

/**
 * 小程序静默登录
 *   wx.login 拿 code → 发给服务器换 token
 */
function login() {
  return new Promise(function (resolve, reject) {
    wx.login({
      success: function (r) {
        if (!r.code) {
          reject(new Error('微信登录失败'));
          return;
        }
        request('/api/auth/login', 'POST', { code: r.code }, true)
          .then(function (res) {
            if (res && res.code === 0 && res.data) {
              store.set('token', res.data.token);
              store.set('user', res.data.user);
              const app = getApp();
              if (app) {
                app.globalData.token = res.data.token;
                app.globalData.user = res.data.user;
              }
            }
            resolve(res);
          })
          .catch(reject);
      },
      fail: function () {
        reject(new Error('微信登录失败'));
      },
    });
  });
}

/* ---------------------------------------------------------------------------
 * 文件上传（打卡照片）
 * ------------------------------------------------------------------------ */

/**
 * 上传打卡照片到服务器
 * @param {string} filePath 本地文件路径
 * @returns {Promise<{url:string}>}
 */
function uploadPhoto(filePath) {
  return new Promise(function (resolve, reject) {
    const token = store.get('token');
    wx.uploadFile({
      url: BASE_URL + '/api/upload/photo',
      filePath: filePath,
      name: 'file',
      header: token ? { Authorization: 'Bearer ' + token } : {},
      success: function (res) {
        try {
          const body = JSON.parse(res.data);
          if (body.code === 0) {
            resolve(body.data);
          } else {
            wx.showToast({ title: body.msg || '上传失败', icon: 'none' });
            reject(body);
          }
        } catch (e) {
          reject(e);
        }
      },
      fail: function (err) {
        wx.showToast({ title: '照片上传失败', icon: 'none' });
        reject(err);
      },
    });
  });
}

module.exports = { get, post, put, del, login, uploadPhoto, BASE_URL };
