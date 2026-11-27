/**
 * 亏了 · 正式上线版 · 通知
 * ---------------------------------------------------------------------------
 * 【这个页面回答什么】
 *   「有什么在等我处理」——
 *     · 待判定的见证席任务
 *     · 见证席邀请
 *     · 留言回复
 *     · 断卡与结算结果
 */
const api = require('../../utils/api');

Page({
  data: {
    list: [],
    loading: true,
    filter: 'all',
    filters: [
      { key: 'all', label: '全部' },
      { key: 'todo', label: '待处理' },
      { key: 'done', label: '已处理' },
    ],
  },

  onShow() {
    this.load();
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },

  load() {
    const that = this;
    api.get('/api/notifications').then(function (res) {
      if (!res || res.code !== 0) {
        that.setData({ loading: false });
        return;
      }
      that.setData({ list: res.data.list || [], loading: false });
      /* 拉完就标记已读 */
      api.post('/api/notifications/read', {}).then(function () {
        const app = getApp();
        if (app) app.globalData.unreadCount = 0;
      });
    }).catch(function () {
      that.setData({ loading: false });
    });
  },

  selectFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.key });
  },

  /** 判断这条通知是不是「待处理」 */
  isTodo(item) {
    const todoTypes = ['witness_invite', 'verdict_todo'];
    return todoTypes.indexOf(item.type) >= 0;
  },

  openItem(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const item = this.data.list[idx];
    if (!item) return;
    if (item.flagId) {
      wx.navigateTo({ url: '/pages/flag/index?id=' + item.flagId });
    }
  },

  goWitness() {
    wx.navigateTo({ url: '/pages/witness/index' });
  },
});
