/**
 * 亏了 · 正式上线版 · 见证席面板
 * ===========================================================================
 * 【这个页面回答什么】
 *   「我要见证的这一局，现在该我判什么」
 *
 * 【两种进入方式】
 *   · 带 flagId → 只看这一个局
 *   · 不带 flagId → 看我所有待判定的任务
 *
 * 【判定只有三个选项】
 *   通过 —— 打卡照和体重读数看着没问题
 *   判作弊 —— 明显造假
 *   存疑 —— 看不清、拿不准
 *
 * 【重要】判定了不能反悔。每个节点每人只能判一次。
 * ===========================================================================
 */
const api = require('../../utils/api');

Page({
  data: {
    flagId: '',
    panel: null,        /* 带 flagId 时的面板数据 */
    tasks: [],          /* 我的全部任务 */
    mode: 'panel',      /* panel / tasks */
    showJudge: false,
    judgeNode: null,
    judgeDecision: '',
    judgeReason: '',
    submitting: false,
  },

  onLoad(options) {
    if (options.flagId) {
      this.setData({ flagId: options.flagId, mode: 'panel' });
      this.loadPanel();
    } else {
      this.setData({ mode: 'tasks' });
      this.loadTasks();
    }
  },

  onShow() {
    if (this.data.mode === 'panel' && this.data.flagId) this.loadPanel();
    else this.loadTasks();
  },

  loadPanel() {
    const that = this;
    api.get('/api/witness/panel/' + this.data.flagId).then(function (res) {
      if (res && res.code === 0) {
        that.setData({ panel: res.data });
      }
    });
  },

  loadTasks() {
    const that = this;
    api.get('/api/witness/tasks').then(function (res) {
      if (res && res.code === 0) {
        that.setData({ tasks: res.data.list || [] });
      }
    });
  },

  /* ---------------- 判定 ---------------- */

  openJudge(e) {
    const nodeIndex = Number(e.currentTarget.dataset.node);
    const node = (this.data.panel ? this.data.panel.nodes : []).filter(function (n) {
      return n.index === nodeIndex;
    })[0];
    if (!node) return;
    this.setData({
      showJudge: true,
      judgeNode: node,
      judgeDecision: '',
      judgeReason: '',
    });
  },

  closeJudge() {
    this.setData({ showJudge: false, judgeNode: null, judgeDecision: '', judgeReason: '' });
  },

  selectDecision(e) {
    this.setData({ judgeDecision: e.currentTarget.dataset.key });
  },

  onReasonInput(e) {
    this.setData({ judgeReason: e.detail.value });
  },

  submitJudge() {
    const { judgeDecision, judgeReason, judgeNode, flagId } = this.data;
    if (!judgeDecision) {
      wx.showToast({ title: '请选择一个判定', icon: 'none' });
      return;
    }
    const that = this;
    this.setData({ submitting: true });

    api.post('/api/witness/verdict', {
      flagId: flagId,
      nodeIndex: judgeNode.index,
      decision: judgeDecision,
      reason: judgeReason,
    }).then(function (res) {
      if (res && res.code === 0) {
        wx.showToast({ title: '判定已提交', icon: 'success' });
        that.closeJudge();
        that.loadPanel();
      }
      that.setData({ submitting: false });
    }).catch(function () {
      that.setData({ submitting: false });
    });
  },

  /* ---------------- 任务列表 ---------------- */

  goTaskFlag(e) {
    wx.navigateTo({ url: '/pages/flag/index?id=' + e.currentTarget.dataset.id });
  },

  /** 返回上一页 */
  onBack() {
    wx.navigateBack();
  },

  /** 空函数 —— 用于阻止弹层内点击冒泡 */
  noop() {},
});
