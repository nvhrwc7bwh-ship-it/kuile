/**
 * 亏了 · 正式上线版 · 首页
 * ---------------------------------------------------------------------------
 * 【这个页面回答什么】
 *   「我今天该干什么」——
 *     · 有正在跑的 Flag → 显示今日打卡卡片
 *     · 没有 → 显示「立一个 Flag」的引导
 *     · 有断卡预警 → 顶部红条提示
 */
const api = require('../../utils/api');
const store = require('../../utils/store');

Page({
  data: {
    user: null,
    mainFlag: null,
    todayDone: false,
    canCreate: true,
    breakWarn: '',
    loading: true,
    notifUnread: 0,
  },

  onLoad() {
    this.ensureLogin();
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh());
  },

  /** 确保已登录 */
  ensureLogin() {
    if (store.get('token')) {
      this.loadData();
      return;
    }
    const that = this;
    api.login()
      .then(function () { return that.loadData(); })
      .catch(function () {
        that.setData({ loading: false });
        wx.showToast({ title: '登录失败，请重试', icon: 'none' });
      });
  },

  /** 拉取首页数据 */
  loadData() {
    const that = this;
    return Promise.all([
      api.get('/api/flags/my'),
      api.get('/api/notifications/unread-count'),
    ]).then(function (res) {
      const list = res[0] && res[0].data ? res[0].data.list : [];
      const running = list.filter(function (f) {
        return f.status === 'prep' || f.status === 'running';
      });
      const main = running.length ? running[0] : null;

      /* 断卡预警 —— 口径对齐后端 rules.breakWarning()
       * ⚠️ 原来写的是 breaks >= breakLimit，在 7 天档（breakLimit=0）恒为真，
       *    用户一进首页就看到「再断 1 次就结束了」，属于误报。
       * 正确口径：还剩 1 次容错时才预警，而且必须已经断过卡。 */
      let breakWarn = '';
      if (main) {
        const remain = Number(main.breakLimit) - Number(main.breaks);
        if (Number(main.breaks) > 0 && remain <= 1) {
          breakWarn = '再断 1 次，这个 Flag 就结束了';
        }
      }

      const user = store.get('user');
      that.setData({
        mainFlag: main,
        user: user || null,
        breakWarn: breakWarn,
        canCreate: !main,
        notifUnread: res[1] && res[1].data ? res[1].data.count : 0,
        loading: false,
      });
    }).catch(function () {
      that.setData({ loading: false });
    });
  },

  /* ---------------- 交互 ---------------- */

  goCreate() {
    wx.navigateTo({ url: '/pages/create/index' });
  },

  goCheckin() {
    if (!this.data.mainFlag) return;
    wx.navigateTo({
      url: '/pages/checkin/index?flagId=' + this.data.mainFlag.id,
    });
  },

  goFlag() {
    if (!this.data.mainFlag) return;
    wx.navigateTo({
      url: '/pages/flag/index?id=' + this.data.mainFlag.id,
    });
  },

  goNotifs() {
    wx.switchTab({ url: '/pages/notifs/index' });
  },

  goMe() {
    wx.switchTab({ url: '/pages/me/index' });
  },
});
