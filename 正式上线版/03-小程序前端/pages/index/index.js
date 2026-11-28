/**
 * 亏了 · 正式上线版 · 首页
 * ---------------------------------------------------------------------------
 * 【这个页面回答什么】
 *   「我今天该干什么」——
 *     · 有正在跑的 Flag → 显示今日打卡卡片
 *     · 筹备期（24 小时）→ 显示倒计时 + 招人
 *     · 没有 → 显示「立一个 Flag」的引导
 *     · 有断卡预警 → 顶部红条提示
 *
 * 【三种状态（对应 demo 的 homeEmpty / homePrep / 进行中）】
 *   ① 没有任何 Flag        → empty-hero 空态引导
 *   ② status === 'prep'   → 24 小时筹备期倒计时（逐秒）+ 招人
 *   ③ 其他（running）      → 打卡主卡
 *   已结算（success/failed/broken）→ 走 ①，文案变成「立下我的 FLAG」
 *
 * 【重要】demo 里已结算的局【不在首页展示】，去「我的 → 我的记录」看。
 */
const api = require('../../utils/api');
const store = require('../../utils/store');

/* 筹备期倒计时的定时器句柄 */
let prepTimer = null;

Page({
  data: {
    user: null,
    mainFlag: null,
    todayDone: false,
    canCreate: true,
    breakWarn: '',
    loading: true,
    notifUnread: 0,

    /* 筹备期倒计时文字，形如 "23:45:12" */
    prepCountdown: '',
    /* 主卡进度百分比 */
    progress: 0,
    /* 产品说明弹层 */
    showAbout: false,
    aboutHtml: '',
  },

  onLoad() {
    this.ensureLogin();
  },

  onShow() {
    this.loadData();
  },

  onUnload() {
    this.clearPrepTimer();
  },

  onHide() {
    this.clearPrepTimer();
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
      const days = Number(main && main.days) || 0;
      const checked = Number(main && main.checkedDays) || 0;

      that.setData({
        mainFlag: main,
        user: user || null,
        breakWarn: breakWarn,
        canCreate: !main,
        notifUnread: res[1] && res[1].data ? res[1].data.count : 0,
        progress: days > 0 ? Math.round(checked / days * 100) : 0,
        loading: false,
      });

      /* 筹备期才启动倒计时 */
      if (main && main.status === 'prep') {
        that.startPrepTimer(main);
      } else {
        that.clearPrepTimer();
      }
    }).catch(function () {
      that.setData({ loading: false });
    });
  },

  /* ---------------- 24 小时筹备期倒计时 ---------------- */

  /**
   * 启动倒计时
   *
   * ⚠️ 为什么不用后端返回的剩余时间？
   *   后端给的是「筹备期还剩多久」，但页面每帧都要显示，
   *   所以本地从「截止时刻」开始自己递减 —— 这样秒数是连续走的，
   *   不会因为接口刷新而跳变。
   *
   * 截止时刻的来源优先级：
   *   ① 后端给的 prepEndAt（毫秒时间戳）
   *   ② 后端给的剩余秒数 prepRemainSec
   *   ③ 按 24 小时估算（兜底）
   */
  startPrepTimer(flag) {
    const that = this;
    this.clearPrepTimer();

    let endAt = Number(flag.prepEndAt) || 0;
    if (!endAt) {
      const remain = Number(flag.prepRemainSec || flag.prepRemain) || 0;
      if (remain > 0) {
        endAt = Date.now() + remain * 1000;
      } else {
        endAt = Date.now() + 24 * 3600 * 1000;
      }
    }

    const tick = function () {
      const ms = Math.max(0, endAt - Date.now());
      if (ms <= 0) {
        that.setData({ prepCountdown: '筹备期已结束' });
        that.clearPrepTimer();
        /* 到点了自动刷新一次，把筹备期切成进行中 */
        that.loadData();
        return;
      }
      const total = Math.floor(ms / 1000);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      const pad = function (n) { return n < 10 ? '0' + n : '' + n; };
      that.setData({ prepCountdown: pad(h) + ':' + pad(m) + ':' + pad(s) });
    };

    tick();
    prepTimer = setInterval(tick, 1000);
  },

  clearPrepTimer() {
    if (prepTimer) {
      clearInterval(prepTimer);
      prepTimer = null;
    }
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

  goWitnessPool() {
    wx.navigateTo({ url: '/pages/witness/index?tab=pool' });
  },

  goNotifs() {
    wx.switchTab({ url: '/pages/notifs/index' });
  },

  goMe() {
    wx.switchTab({ url: '/pages/me/index' });
  },

  /* ---------------- 产品说明弹层 ---------------- */

  showAbout() {
    this.setData({
      showAbout: true,
      aboutHtml:
        '<p>公开立减肥目标，<b>熟人见证，陌生人围观，失败留痕</b>。</p>' +
        '<p>你在一个有硬性周期的期限里，公开承诺一个减重目标，' +
        '每天提交带物证的打卡照片，由你邀请的「见证席」在几个关键节点各判定一次，' +
        '陌生人可以在广场围观。</p>' +
        '<p><b>见证席</b> —— 你主动邀请的微信好友，有判定权也有责任。<br/>' +
        '<b>监督席</b> —— 扫码进来看热闹的人，只有「看」和「传」两项权力。<br/>' +
        '<b>押金</b> —— 履约保证金，达标全额退还，失败按信用等级扣收一小部分。</p>',
    });
  },

  closeAbout() {
    this.setData({ showAbout: false });
  },
});
