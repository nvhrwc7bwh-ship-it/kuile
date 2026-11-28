// ============================================================================
// 亏了 · 正式上线版 · 小程序入口
// ---------------------------------------------------------------------------
// 【小白须知】这个文件相当于小程序的「启动开关」。
//   app.js 里做三件事：
//     1. 读出本地存的登录身份（token）
//     2. 启动时向服务器要一次全局配置
//     3. 监听前后台切换，回来时刷新数据
// ============================================================================
const api = require('./utils/api');
const store = require('./utils/store');

App({
  globalData: {
    /** 登录身份 */
    token: '',
    user: null,
    /** 服务器下发的规则参数（周期、押金档位、信用分上限等） */
    config: null,
  },

  onLaunch() {
    /* 1. 读出上次登录的身份 */
    const token = store.get('token');
    const user = store.get('user');
    this.globalData.token = token || '';
    this.globalData.user = user || null;

    /* 2. 有身份就去服务器核对一下（顺便拉配置） */
    if (this.globalData.token) {
      this.refreshSession();
    }
  },

  onShow() {
    /* 3. 从后台切回前台时，静默刷新身份 */
    if (this.globalData.token) {
      this.refreshSession();
    }
  },

  /**
   * 刷新登录态 + 拉全局配置
   */
  refreshSession() {
    const that = this;
    api.get('/api/auth/profile')
      .then(function (res) {
        if (res && res.code === 0) {
          that.globalData.user = res.data;
          store.set('user', res.data);
        }
        return api.get('/api/flags/config');
      })
      .then(function (res) {
        if (res && res.code === 0) {
          that.globalData.config = res.data;
          store.set('config', res.data);
        }
      })
      .catch(function () {
        /* 网络问题不打断使用，等用户下次操作时再试 */
      });
  },
});
