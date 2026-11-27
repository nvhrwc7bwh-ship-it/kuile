/**
 * 亏了 · 正式上线版 · 用户主页
 * ---------------------------------------------------------------------------
 * 【这个页面回答什么】
 *   「这个人是谁、他立过哪些 Flag、他的信用分怎么样」
 */
const api = require('../../utils/api');

Page({
  data: {
    userId: '',
    user: null,
    flags: [],
    loading: true,
  },

  onLoad(options) {
    if (!options.id) return;
    this.setData({ userId: options.id });
  },

  onShow() {
    this.load();
  },

  load() {
    const that = this;
    Promise.all([
      api.get('/api/users/' + this.data.userId),
      api.get('/api/users/' + this.data.userId + '/flags'),
    ]).then(function (res) {
      that.setData({
        user: res[0] && res[0].code === 0 ? res[0].data : null,
        flags: res[1] && res[1].code === 0 ? res[1].data.list : [],
        loading: false,
      });
    }).catch(function () {
      that.setData({ loading: false });
    });
  },

  toggleFollow() {
    const that = this;
    const u = this.data.user;
    if (!u) return;
    if (u.isMe) {
      wx.showToast({ title: '这是你自己', icon: 'none' });
      return;
    }
    const method = u.isFollowing ? 'del' : 'post';
    api[method]('/api/social/follow', { userId: u.id }).then(function (res) {
      if (res && res.code === 0) {
        that.setData({ 'user.isFollowing': !u.isFollowing });
      }
    });
  },

  goFlag(e) {
    wx.navigateTo({ url: '/pages/flag/index?id=' + e.currentTarget.dataset.id });
  },

  /** 返回上一页 */
  onBack() {
    wx.navigateBack();
  },
});
