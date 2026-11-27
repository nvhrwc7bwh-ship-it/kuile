/**
 * 亏了 · 正式上线版 · 记录卡
 * ---------------------------------------------------------------------------
 * 【这个页面回答什么】
 *   「这一局的结果是什么」—— 结局产物，可以分享出去
 */
const api = require('../../utils/api');

Page({
  data: {
    flagId: '',
    card: null,
    loading: true,
  },

  onLoad(options) {
    if (!options.id) return;
    this.setData({ flagId: options.id });
  },

  onShow() {
    this.load();
  },

  load() {
    const that = this;
    api.get('/api/record-cards/' + this.data.flagId).then(function (res) {
      if (res && res.code === 0) {
        that.setData({ card: res.data, loading: false });
      } else {
        that.setData({ loading: false });
      }
    }).catch(function () {
      that.setData({ loading: false });
    });
  },

  shareCard() {
    wx.showToast({ title: '点击右上角菜单分享', icon: 'none' });
  },

  onShareAppMessage() {
    const c = this.data.card;
    return {
      title: c ? (c.outcome === 'success'
        ? c.user.name + ' 减肥成功了：' + c.title
        : c.user.name + ' 这次没成：' + c.title) : '亏了',
      path: '/pages/record/index?id=' + this.data.flagId,
    };
  },

  /** 返回上一页 */
  onBack() {
    wx.navigateBack();
  },
});
