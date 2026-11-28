/* ============================================================
   亏了 · 调试面板（Demo 专用）
   ------------------------------------------------------------
   右侧一列按钮，模拟「用户用了不同长度的时间」：
     · 新用户 / 有 Flag / 已监督 / 有通知 / 见证席 / 老用户
   任何注入都会重渲染当前页面，立刻看到变化。

   ⚠️ 2026-11-24 用户口径：「为了让整个 demo 更接近真实的软件的使用的感觉，
      你评估下左边的主流程、右边的演示状态还需要增加什么内容？
      注意，尽量做增加而不是减少，因为目前已有的内容基本很满意，
      除非与新功能有冲突或者重复的。」

   —— 所以这里是【增加】而不是重做：
      ① 原来的 8 个场景**一个都没删、没改**，只是**重新分了组**（分组是为了好找，不是为了减）
      ② 新增了一批「真实软件里一定会遇到」的状态
   ============================================================ */

(function () {
  const PANEL_ID = 'devPanel';

  /* ---------- 场景分组 ----------
     分组顺序 = 「用户生命周期」的顺序：
     新手 → 有 Flag → 有互动 → 有麻烦 → 资深。
     这样从上面点到下面，就是一个用户从注册到成熟的全过程。 */
  const GROUPS = [
    {
      name: '起点',
      items: [
        { k: 'reset',            t: '新用户',     d: '清空一切，回到首次登录' },
        { k: 'guest',            t: '游客',       d: '未登录 —— 只能浏览，不能做动作' },
      ],
    },
    {
      name: '我的 Flag',
      items: [
        { k: 'prep',             t: '筹备期',     d: '刚立完，24h 倒计时 + 招人' },
        { k: 'recruiting',       t: '召集令已发', d: '3 位报名者待处理' },
        { k: 'newUserWithFlags', t: '+1 个 Flag', d: '1 个进行中的 + 1 个已取消' },
        { k: 'missedCheckin',    t: '昨天漏打卡', d: '首页补卡提醒 + 12 小时倒计时' },
        { k: 'breakExpired',     t: '补卡超窗',   d: '超过 12 小时 —— 断卡 1/3' },
        { k: 'broken',           t: '断卡',       d: '连续天数归零 + 信用分 -5' },
        { k: 'settled',          t: '已结算',     d: '已达标 —— 押金全额退回' },
        { k: 'appealed',         t: '押金被扣',   d: '未达标扣收 + 申诉审核中' },
      ],
    },
    {
      name: '我的互动',
      items: [
        { k: 'subscribe',        t: '+监督',      d: '监督 3 个别人的 Flag' },
        { k: 'following',        t: '+关注',      d: '关注 3 个人' },
        { k: 'msgsWaiting',      t: '+待回声',    d: '2 条留言等我回复' },
        { k: 'objectionPending', t: '+异议',      d: '我提了异议，2/3 票' },
        { k: 'notifs',           t: '+通知',      d: '收到 3 条通知' },
      ],
    },
    {
      name: '见证席',
      items: [
        { k: 'supervised',       t: '+完整监督',  d: '完整监督 1 次' },
        { k: 'interacted',       t: '+互动达标',  d: `累计互动 ${10} 次 · 可申请见证席` },
        { k: 'inPool',           t: '已在候选池', d: '可以被人邀请当见证席' },
        { k: 'invited',          t: '+被邀请',    d: '通知里收到见证席邀约（1 个已过期）' },
        { k: 'witness',          t: '+见证席',    d: '成为见证席，有待判定' },
        { k: 'verdictRejected',  t: '判定被驳回', d: '我的判定不成立 + 原因' },
      ],
    },
    {
      name: '全部',
      items: [
        { k: 'veteran',          t: '老用户',     d: '所有内容都齐全' },
      ],
    },
  ];

  /* 展平成一维（保留旧的 ACTIONS 形状，方便外部引用） */
  const ACTIONS = GROUPS.flatMap(g => g.items);

  function ensure() {
    let el = document.getElementById(PANEL_ID);
    if (el) return el;

    el = document.createElement('aside');
    el.id = PANEL_ID;
    el.innerHTML = `
      <div class="dp-head">
        <div class="dp-title">演示状态</div>
        <div class="dp-sub">注入内容 → 看页面变化</div>
      </div>
      <div class="dp-body"></div>
      <div class="dp-foot">
        <div class="dp-stat"></div>
      </div>`;
    document.body.appendChild(el);
    renderBtns(el.querySelector('.dp-body'));
    return el;
  }

  function renderBtns(box) {
    box.innerHTML = '';
    GROUPS.forEach(g => {
      /* 分组标题 */
      const h = document.createElement('div');
      h.className = 'dp-group';
      h.textContent = g.name;
      box.appendChild(h);
      g.items.forEach(a => {
        const b = document.createElement('button');
        b.className = 'dp-btn';
        b.dataset.k = a.k;
        b.innerHTML = `<b>${a.t}</b><span>${a.d}</span>`;
        b.addEventListener('click', () => {
          const msg = inject(a.k);
          if (window.toast) toast(msg);
          refresh();
        });
        box.appendChild(b);
      });
    });
  }

  function refresh() {
    const el = ensure();
    const st = el.querySelector('.dp-stat');
    if (st && typeof STATE !== 'undefined' && STATE) {
      st.innerHTML = `
        <div><span>我的 Flag</span><b>${STATE.myFlags.length}</b></div>
        <div><span>监督</span><b>${STATE.subscribed.length}</b></div>
        <div><span>通知</span><b>${STATE.notifs.length}</b></div>
        <div><span>信用分</span><b>${STATE.credit}</b></div>
        <div><span>互动</span><b>${STATE.interactions || 0}</b></div>
        <div><span>候选池</span><b>${STATE.inPool ? '已入池' : '未入池'}</b></div>`;
      /* 左栏同步显示当前状态 —— ⚠️ 2026-11-24：这里原来只有三档，
         现在跟着注入的场景给出【更具体的描述】，
         让人一眼知道「我现在在一个什么状态里」。 */
      const rs = document.getElementById('railState');
      if (rs) {
        let label = '首次登录（空态）';
        const f = (typeof myMainFlag === 'function') ? myMainFlag() : null;
        if (f) {
          /* ⚠️ 2026-11-24：跟着注入的场景给出【具体】描述，
             让人一眼知道「我现在在一个什么状态里」。 */
          const st2 = {
            prep: '筹备期（24h 招人）',
            broken: '我的 Flag 断卡了',
            success: '我的 Flag 已结算（押金已退）',
            failed: f.appeal ? '押金被扣 · 申诉审核中' : '我的 Flag 未达标',
          };
          label = st2[f.status] || '使用中（有进行中的 Flag）';
        } else if (STATE.verdictTasks.length) {
          label = '见证席（有待判定）';
        } else if (STATE.isGuest) {
          label = '游客态（未登录）';
        } else if (STATE.myFlags.length) {
          label = '使用中（有 Flag）';
        }
        rs.innerHTML = `<b style="color:var(--brand-400)">${label}</b>`;
      }
    }
    /* 重渲染当前页面 */
    if (typeof render === 'function' && typeof route === 'string') {
      if (route === 'splash' || route === 'login') return;
      const keepId = routeId;
      render(route, keepId, { push: false });
    }
  }

  function boot() {
    if (typeof initState === 'function') initState();
    ensure();
    refresh();
    /* 首次进入时如果路由未初始化，等 app.js 起来再刷一次 */
    setTimeout(refresh, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.__devPanel = { refresh, inject, ACTIONS, GROUPS };
})();
