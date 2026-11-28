/**
 * 亏了 · 正式上线版 · 打卡页
 * ===========================================================================
 * 【这个页面回答什么】
 *   「今天怎么打卡」——
 *     ① 拍一张含体重秤的照片（体重秤读数 + 手写词）
 *     ② 填体重秤读数
 *     ③ 写一个手写词
 *     ④ 提交 → 服务器交给豆包 AI 判定 → 告诉你通过还是需要重拍
 *
 * 【为什么只要两项】
 *   产品规则：L2 每日打卡只提交「体重秤读数」+「手写词」两项。
 *   照片是这两项的载体（AI 从照片里读秤面读数和手写词）。
 * ===========================================================================
 */
const api = require('../../utils/api');

Page({
  data: {
    flagId: '',
    flag: null,
    dayIndex: 0,
    weight: '',
    handwrite: '',
    photoPath: '',
    photoUrl: '',
    submitting: false,
    result: null,      // 判定结果
    needPhoto: true,
  },

  onLoad(options) {
    const flagId = options.flagId || options.id;
    if (!flagId) {
      wx.showToast({ title: '缺少 Flag 参数', icon: 'none' });
      return;
    }
    this.setData({ flagId: flagId });
    this.loadFlag();
  },

  loadFlag() {
    const that = this;
    api.get('/api/flags/' + this.data.flagId).then(function (res) {
      if (!res || res.code !== 0) return;
      const f = res.data;
      /* 找到今天该打的那一天 */
      const today = f.dayNow || 1;
      const pending = (f.checkins || []).filter(function (c) {
        return c.status === 'pending';
      })[0];
      const target = pending ? pending.day : today;

      that.setData({
        flag: f,
        dayIndex: target,
        weight: pending && pending.weight ? String(pending.weight) : '',
        handwrite: pending ? (pending.handwrite || '') : '',
      });
    });
  },

  /* ---------------- 拍照 ---------------- */

  takePhoto() {
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: ['compressed'],
      success: function (res) {
        const p = res.tempFiles[0].tempFilePath;
        that.setData({ photoPath: p, photoUrl: '', result: null });
      },
      fail: function () { /* 用户取消 */ },
    });
  },

  /* ---------------- 表单 ---------------- */

  onWeightInput(e) {
    this.setData({ weight: e.detail.value });
  },

  onHandwriteInput(e) {
    this.setData({ handwrite: e.detail.value });
  },

  /* ---------------- 提交 ---------------- */

  submit() {
    const { flagId, dayIndex, weight, handwrite, photoPath } = this.data;

    if (!photoPath) {
      wx.showToast({ title: '先拍一张打卡照', icon: 'none' });
      return;
    }
    const w = Number(weight);
    if (!(w > 0)) {
      wx.showToast({ title: '请填写体重秤读数', icon: 'none' });
      return;
    }
    if (!handwrite || !handwrite.trim()) {
      wx.showToast({ title: '写一个手写词', icon: 'none' });
      return;
    }

    const that = this;
    this.setData({ submitting: true });

    /* 第 1 步：上传照片 */
    api.uploadPhoto(photoPath)
      .then(function (up) {
        /* 第 2 步：提交打卡 */
        return api.post('/api/flags/' + flagId + '/checkin', {
          dayIndex: dayIndex,
          weight: w,
          handwrite: handwrite.trim(),
          photoUrl: up.url,
        });
      })
      .then(function () {
        wx.showToast({ title: '已提交，正在判定', icon: 'none' });
        /* 第 3 步：轮询判定结果 */
        that.pollVerdict(0);
      })
      .catch(function () {
        that.setData({ submitting: false });
      });
  },

  /**
   * 轮询 AI 判定结果
   * AI 判定要几秒到几十秒，所以每隔 2 秒查一次，最多查 15 次
   */
  pollVerdict(times) {
    const that = this;
    if (times > 15) {
      that.setData({ submitting: false });
      wx.showToast({ title: '判定较慢，稍后到打卡历史查看', icon: 'none' });
      return;
    }
    api.get('/api/flags/' + this.data.flagId + '/checkins').then(function (res) {
      if (!res || res.code !== 0) return;
      const list = res.data.list || [];
      const ck = list.filter(function (c) { return c.day === that.data.dayIndex; })[0];
      if (!ck) {
        setTimeout(function () { that.pollVerdict(times + 1); }, 2000);
        return;
      }
      if (ck.status === 'pending') {
        setTimeout(function () { that.pollVerdict(times + 1); }, 2000);
        return;
      }
      /* 有结果了 */
      that.setData({
        submitting: false,
        result: {
          ok: ck.status === 'ok',
          verdict: ck.aiVerdict || '',
          status: ck.status,
        },
      });
      if (ck.status === 'ok') {
        wx.showToast({ title: '打卡通过', icon: 'success' });
      } else {
        wx.showModal({
          title: '这张照片没通过',
          content: ck.aiVerdict || '请重拍一张：照片里要能清楚看到体重秤读数，并写上手写词。',
          showCancel: false,
        });
      }
    }).catch(function () {
      setTimeout(function () { that.pollVerdict(times + 1); }, 2000);
    });
  },

  /** 重拍 */
  retake() {
    this.setData({ result: null, photoPath: '', photoUrl: '', weight: '', handwrite: '' });
  },

  goFlag() {
    wx.redirectTo({ url: '/pages/flag/index?id=' + this.data.flagId });
  },
});
