/**
 * 亏了 · 正式上线版 · Flag 详情页
 * ---------------------------------------------------------------------------
 * 【这个页面回答什么】
 *   「这个人的减肥目标具体是什么、进行到哪了、有没有人看着」
 *
 * 【按身份显示不同内容】
 *   · 发起人 → 能打卡、能取消、能邀请见证席、能回复留言
 *   · 见证席 → 能进判定面板投票
 *   · 围观群众 → 能点赞、围观、留言、能提异议
 */
const api = require('../../utils/api');

Page({
  data: {
    flagId: '',
    flag: null,
    loading: true,
    messageInput: '',
    replyTo: null,
    replyText: '',
    showReplyBox: false,
    liked: false,
    watching: false,
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
    api.get('/api/flags/' + this.data.flagId).then(function (res) {
      if (!res || res.code !== 0) {
        that.setData({ loading: false });
        return;
      }
      that.setData({ flag: res.data, loading: false });
    }).catch(function () {
      that.setData({ loading: false });
    });
  },

  /* ---------------- 打卡 ---------------- */

  goCheckin() {
    wx.navigateTo({ url: '/pages/checkin/index?flagId=' + this.data.flagId });
  },

  /* ---------------- 点赞 / 围观 ---------------- */

  toggleLike() {
    const that = this;
    api.post('/api/social/flags/' + this.data.flagId + '/like', {}).then(function (res) {
      if (res && res.code === 0) {
        that.setData({ liked: res.data.liked });
        that.load();
      }
    });
  },

  toggleWatch() {
    const that = this;
    api.post('/api/social/flags/' + this.data.flagId + '/watch', {}).then(function (res) {
      if (res && res.code === 0) {
        that.setData({ watching: res.data.watching });
        this.load();
      }
    });
  },

  /* ---------------- 留言 ---------------- */

  onMessageInput(e) {
    this.setData({ messageInput: e.detail.value });
  },

  sendMessage() {
    const content = (this.data.messageInput || '').trim();
    if (!content) return;
    const that = this;
    api.post('/api/social/flags/' + this.data.flagId + '/messages', {
      content: content,
      anonymous: true,
    }).then(function (res) {
      if (res && res.code === 0) {
        that.setData({ messageInput: '' });
        that.load();
      }
    });
  },

  /* ---------------- 回复 ---------------- */

  openReply(e) {
    this.setData({
      replyTo: e.currentTarget.dataset.id,
      replyText: '',
      showReplyBox: true,
    });
  },

  closeReply() {
    this.setData({ showReplyBox: false, replyTo: null, replyText: '' });
  },

  onReplyInput(e) {
    this.setData({ replyText: e.detail.value });
  },

  sendReply() {
    const content = (this.data.replyText || '').trim();
    if (!content || !this.data.replyTo) return;
    const that = this;
    api.post('/api/social/messages/' + this.data.replyTo + '/reply', {
      content: content,
    }).then(function (res) {
      if (res && res.code === 0) {
        that.closeReply();
        that.load();
      }
    });
  },

  /* ---------------- 见证席 ---------------- */

  goWitness() {
    wx.navigateTo({ url: '/pages/witness/index?flagId=' + this.data.flagId });
  },

  /* ---------------- 其他 ---------------- */

  goProfile(e) {
    const uid = e.currentTarget.dataset.uid;
    if (!uid) return;
    wx.navigateTo({ url: '/pages/profile/index?id=' + uid });
  },

  goRecord() {
    wx.navigateTo({ url: '/pages/record/index?id=' + this.data.flagId });
  },

  reportFlag() {
    const that = this;
    wx.showActionSheet({
      itemList: ['体重造假', '照片造假', '身份造假', '其他'],
      success: function (res) {
        const codes = ['weight_fake', 'photo_fake', 'identity_fake', 'other'];
        api.post('/api/social/objections', {
          flagId: that.data.flagId,
          type: 'report',
          reasonCode: codes[res.tapIndex],
          content: '',
        }).then(function (r) {
          if (r && r.code === 0) {
            wx.showToast({ title: '已提交，我们会核实', icon: 'none' });
          }
        });
      },
    });
  },

  shareFlag() {
    wx.showToast({ title: '点击右上角菜单分享', icon: 'none' });
  },

  onShareAppMessage() {
    const f = this.data.flag;
    return {
      title: f ? f.title : '亏了 · 公开立减肥目标',
      path: '/pages/flag/index?id=' + this.data.flagId,
    };
  },

  /** 返回上一页 */
  onBack() {
    wx.navigateBack();
  },

  /** 空函数 —— 用于阻止弹层内点击冒泡 */
  noop() {},
});
