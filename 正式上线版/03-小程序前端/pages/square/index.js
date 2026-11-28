/**
 * 亏了 · 正式上线版 · 广场
 * ---------------------------------------------------------------------------
 * 【这个页面回答什么】
 *   「现在有哪些人在减肥、他们的 Flag 是什么」
 *
 * 【排序】
 *   · 最新 —— 按发起时间
 *   · 最热 —— 按围观人数
 *   · 强见证 —— 按档位（T3 优先）
 */
const api = require('../../utils/api');

Page({
  data: {
    list: [],
    sort: 'new',
    sorts: [
      { key: 'new', label: '最新' },
      { key: 'hot', label: '最热' },
      { key: 'tier', label: '强见证' },
    ],
    statusFilter: '',
    filters: [
      { key: '', label: '全部' },
      { key: 'running', label: '进行中' },
      { key: 'success', label: '已达标' },
      { key: 'failed', label: '未达标' },
    ],
    loading: true,
  },

  onShow() {
    this.loadList();
  },

  onPullDownRefresh() {
    this.loadList().then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    this.loadList(true);
  },

  loadList(more) {
    const that = this;
    const page = more ? (this.data.page || 1) + 1 : 1;
    this.setData({ loading: !more });

    api.get('/api/flags', {
      sort: this.data.sort,
      status: this.data.statusFilter || undefined,
      page: page,
      size: 20,
    }).then(function (res) {
      if (!res || res.code !== 0) {
        that.setData({ loading: false });
        return;
      }
      const list = res.data.list || [];
      that.setData({
        list: more ? that.data.list.concat(list) : list,
        page: page,
        loading: false,
      });
    }).catch(function () {
      that.setData({ loading: false });
    });
  },

  selectSort(e) {
    this.setData({ sort: e.currentTarget.dataset.key });
    this.loadList();
  },

  selectFilter(e) {
    this.setData({ statusFilter: e.currentTarget.dataset.key });
    this.loadList();
  },

  goFlag(e) {
    wx.navigateTo({ url: '/pages/flag/index?id=' + e.currentTarget.dataset.id });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/create/index' });
  },
});
