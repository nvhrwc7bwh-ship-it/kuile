/**
 * 亏了 · 正式上线版 · 立一个 Flag
 * ===========================================================================
 * 【这个页面回答什么】
 *   「我要立什么 Flag、押多少、怎么开始」
 *
 * 【分三步】
 *   ① 立什么    —— 标题 / 理由 / 起始体重 / 目标体重
 *   ② 立多久    —— 7 / 14 / 30 / 90 天（受信用分限制）
 *   ③ 确认并支付 —— 押金档位（新人保护可能免押金）→ 调起微信支付
 *
 * 【重要】所有规则（哪些周期能选、押金能押多少）都从服务器拉，
 *   前端不写死。信用分变了，前端自动跟着变。
 *
 * 【内测阶段 · 暂不收押金】
 *   服务器配置 DEPOSIT_ENABLED=false 时：
 *     · 押金档位【照常显示、照常选】—— 按钮与文案全部保持原样
 *     · 点「确认并支付」不再调起微信支付，而是弹出提示：
 *       「内测阶段，暂不收取押金」
 *     · 点「知道了」之后 Flag 照样立成功，正常进入目标详情页
 * ===========================================================================
 */
const api = require('../../utils/api');
const store = require('../../utils/store');

Page({
  data: {
    step: 1,             // 1 / 2 / 3
    config: null,
    periods: [],
    credit: null,

    /* 第一步 */
    title: '',
    reason: '',
    startWeight: '',
    targetWeight: '',

    /* 第二步 */
    periodDays: 14,

    /* 第三步 */
    depositOptions: [],
    depositAmount: 0,
    depositIndex: 0,
    isFree: false,
    /* 服务器是否开启真实收押金（false = 内测阶段暂不收取押金）
     * ⚠️ 仅作参考显示用，【不要用它做分支判断】——
     *    它可能来自本地缓存（会过期）。
     *    「收不收钱」的判断权在服务器 /api/pay/create，看它返回的 beta 标记。 */
    depositEnabled: true,

    submitting: false,
  },

  onLoad() {
    this.loadConfig();
  },

  loadConfig() {
    const that = this;
    const cached = store.get('config');
    if (cached) this.applyConfig(cached);

    api.get('/api/flags/config').then(function (res) {
      if (res && res.code === 0) {
        store.set('config', res.data);
        that.applyConfig(res.data);
      }
    }).catch(function () {
      if (!cached) {
        wx.showToast({ title: '加载失败，请检查网络', icon: 'none' });
      }
    });
  },

  applyConfig(cfg) {
    const that = this;
    const periods = (cfg.periods || []).map(function (p) {
      return Object.assign({}, p, {
        label: p.days + ' 天',
        sub: p.judgeCount + ' 次见证判定 · 可断卡 ' + p.breakLimit + ' 次',
      });
    });
    /* 默认选中第一个能选的周期 */
    const firstOk = periods.filter(function (p) { return p.allowed; })[0];
    const periodDays = firstOk ? firstOk.days : 14;

    this.setData({
      config: cfg,
      periods: periods,
      credit: cfg.credit,
      periodDays: periodDays,
      /* 内测阶段标记（服务器没给就按正式收押金处理，避免误判） */
      depositEnabled: cfg.depositEnabled === undefined ? true : !!cfg.depositEnabled,
    });
    this.refreshDepositOptions();
  },

  /** 根据当前周期刷新押金档位 */
  refreshDepositOptions() {
    const p = (this.data.periods || []).filter(function (x) {
      return x.days === this.data.periodDays;
    }, this)[0];
    if (!p) return;

    if (p.free) {
      this.setData({
        depositOptions: [{ amount: 0, label: '免费', disabled: false }],
        depositAmount: 0,
        depositIndex: 0,
        isFree: true,
      });
      return;
    }

    /* 押金上限取「周期上限」与「信用上限」中较小的 */
    const creditMax = this.data.credit ? this.data.credit.depositMax : p.depositMax;
    const cap = Math.min(p.depositMax, creditMax);
    const options = (p.depositOptions || []).map(function (a) {
      return {
        amount: a,
        label: a + ' 元',
        disabled: a > cap,
        disabledReason: a > cap ? '信用分不够' : '',
      };
    });
    const firstOk = options.filter(function (o) { return !o.disabled; })[0];

    this.setData({
      depositOptions: options,
      depositAmount: firstOk ? firstOk.amount : p.depositMin,
      depositIndex: firstOk ? options.indexOf(firstOk) : 0,
      isFree: false,
    });
  },

  /* ---------------- 第一步表单 ---------------- */

  onTitle(e) { this.setData({ title: e.detail.value }); },
  onReason(e) { this.setData({ reason: e.detail.value }); },
  onStartWeight(e) { this.setData({ startWeight: e.detail.value }); },
  onTargetWeight(e) { this.setData({ targetWeight: e.detail.value }); },

  nextFromStep1() {
    const { title, startWeight, targetWeight } = this.data;
    if (!title.trim()) {
      wx.showToast({ title: '写一个标题吧', icon: 'none' });
      return;
    }
    const sw = Number(startWeight);
    const tw = Number(targetWeight);
    if (!(sw > 0) || !(tw > 0)) {
      wx.showToast({ title: '请填写起始体重和目标体重', icon: 'none' });
      return;
    }
    if (tw >= sw) {
      wx.showToast({ title: '目标体重要小于起始体重', icon: 'none' });
      return;
    }
    this.setData({ step: 2 });
  },

  /* ---------------- 第二步：选周期 ---------------- */

  selectPeriod(e) {
    const days = Number(e.currentTarget.dataset.days);
    const p = (this.data.periods || []).filter(function (x) { return x.days === days; })[0];
    if (!p) return;
    if (!p.allowed) {
      wx.showToast({ title: p.disabledReason || '这个周期不能选', icon: 'none' });
      return;
    }
    this.setData({ periodDays: days });
    this.refreshDepositOptions();
  },

  nextFromStep2() {
    this.setData({ step: 3 });
  },

  /* ---------------- 第三步：选押金 ---------------- */

  selectDeposit(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const opt = this.data.depositOptions[idx];
    if (!opt) return;
    if (opt.disabled) {
      wx.showToast({ title: opt.disabledReason || '这个档位选不了', icon: 'none' });
      return;
    }
    this.setData({ depositIndex: idx, depositAmount: opt.amount });
  },

  /* ---------------- 提交 ---------------- */

  /**
   * 点「确认并支付」
   *
   * 【重要】这里【不判断】是不是内测阶段 —— 判断权交给服务器。
   *   原因：前端把参数存在本地缓存里，如果服务器把开关从 true 改成 false
   *   （或者反过来），缓存没过期时前端会用旧值走错分支。
   *   最严重的情况是：缓存说「内测」而服务器说「正式」——
   *   前端会直接跳过支付，用户的押金就永远收不到钱了。
   *   所以：本地只负责【提交】，【收不收钱】一律听 /api/pay/create 的。
   */
  submit() {
    const {
      title, reason, startWeight, targetWeight, periodDays, depositAmount,
    } = this.data;

    const that = this;
    this.setData({ submitting: true });

    api.post('/api/flags', {
      title: title.trim(),
      reason: (reason || '').trim(),
      startWeight: Number(startWeight),
      targetWeight: Number(targetWeight),
      periodDays: periodDays,
      depositAmount: depositAmount,
    }).then(function (res) {
      if (!res || res.code !== 0) {
        that.setData({ submitting: false });
        return;
      }
      /* 押金 → 交给服务器决定是「内测免收」还是「调起微信支付」 */
      that.payDeposit(res.data.id);
    }).catch(function () {
      that.setData({ submitting: false });
    });
  },

  /**
   * 内测阶段提示：内测阶段，暂不收取押金
   * 点「知道了」→ Flag 照样立成功，正常进入目标详情页
   */
  showBetaNotice(flagId) {
    const that = this;
    wx.showModal({
      title: '内测阶段',
      content: '内测阶段，暂不收取押金',
      showCancel: false,
      confirmText: '知道了',
      success: function (res) {
        if (res.confirm) {
          that.onFlagCreated(flagId);
        } else {
          that.setData({ submitting: false });
        }
      },
      fail: function () {
        that.onFlagCreated(flagId);
      },
    });
  },

  /**
   * 立成功后的统一出口
   */
  onFlagCreated(flagId) {
    wx.showToast({ title: '立好了', icon: 'success' });
    setTimeout(function () {
      wx.redirectTo({ url: '/pages/flag/index?id=' + flagId });
    }, 800);
  },

  /**
   * 调起微信支付
   *
   * 【内测阶段】服务器会返回 beta:true —— 这时【不调微信支付】，
   *   只弹一句「内测阶段，暂不收取押金」。
   *   服务器同时已经把这局标记成「押金已支付（内测免收）」，状态不会脏。
   */
  payDeposit(flagId) {
    const that = this;
    api.post('/api/pay/create', { flagId: flagId }).then(function (res) {
      if (!res || res.code !== 0) {
        that.setData({ submitting: false });
        return;
      }
      const d = res.data;

      /* 内测阶段：服务器直接免收 → 弹提示，不调微信支付 */
      if (d.beta) {
        that.showBetaNotice(flagId);
        return;
      }

      /* 新人保护：本局免押金 → 直接成功 */
      if (d.free) {
        that.onFlagCreated(flagId);
        return;
      }

      wx.requestPayment({
        timeStamp: d.payParams.timeStamp,
        nonceStr: d.payParams.nonceStr,
        package: d.payParams.package,
        signType: d.payParams.signType,
        paySign: d.payParams.paySign,
        success: function () {
          wx.showToast({ title: '支付成功', icon: 'success' });
          setTimeout(function () {
            wx.redirectTo({ url: '/pages/flag/index?id=' + flagId });
          }, 800);
        },
        fail: function () {
          that.setData({ submitting: false });
          wx.showModal({
            title: '支付未完成',
            content: '押金还没付成功。可以去「我的 Flag」里重新支付。',
            showCancel: false,
          });
        },
      });
    }).catch(function () {
      that.setData({ submitting: false });
    });
  },

  back() {
    if (this.data.step === 1) {
      wx.navigateBack();
    } else {
      this.setData({ step: this.data.step - 1 });
    }
  },
});
