/**
 * 亏了 · 正式上线版 · 我的
 * ---------------------------------------------------------------------------
 * 【这个页面回答什么】
 *   「我的信用分多少、我立的 Flag、我当见证席的情况」
 */
const api = require('../../utils/api');
const store = require('../../utils/store');

Page({
  data: {
    user: null,
    flags: [],
    witnessCount: 0,
    loading: true,
  },

  onShow() {
    this.load();
  },

  load() {
    const that = this;
    Promise.all([
      api.get('/api/auth/profile'),
      api.get('/api/flags/my'),
      api.get('/api/witness/tasks'),
    ]).then(function (res) {
      const u = res[0] && res[0].code === 0 ? res[0].data : null;
      const f = res[1] && res[1].code === 0 ? res[1].data.list : [];
      const w = res[2] && res[2].code === 0 ? res[2].data.list : [];
      if (u) store.set('user', u);
      that.setData({
        user: u,
        flags: f,
        witnessCount: w.length,
        loading: false,
      });
    }).catch(function () {
      that.setData({ loading: false });
    });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/create/index' });
  },

  goWitness() {
    wx.navigateTo({ url: '/pages/witness/index' });
  },

  goFlag(e) {
    wx.navigateTo({ url: '/pages/flag/index?id=' + e.currentTarget.dataset.id });
  },

  goProfile() {
    const u = this.data.user;
    if (u) wx.navigateTo({ url: '/pages/profile/index?id=' + u.id });
  },

  goRecord(e) {
    wx.navigateTo({ url: '/pages/record/index?id=' + e.currentTarget.dataset.id });
  },

  goCreditLogs() {
    wx.showToast({ title: '信用分明细即将上线', icon: 'none' });
  },

  goAgreement() {
    wx.showToast({ title: '用户协议与隐私政策已内置在提审材料中', icon: 'none' });
  },
});
