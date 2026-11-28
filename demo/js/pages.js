/* ============================================================
   亏了 · 页面模板 v2
   ============================================================ */

/* ---------- 小组件 ---------- */
/** 「立 Flag」的入口路由：
 *  ⚠️ 2026-11-24 用户口径（改）：**一律走 4 步分步引导**。
 *     「当存在结算项目的时候，点击『首页』-『立一个 FLAG』，
 *       立 flag 的流程和正常的不一样了，你检查一下，弄错了吧？
 *       应该是分四个步骤引导的。不过没有 0 元选项。」
 *
 *  —— 之前的分流逻辑是「第一次走分步、之后走单页」，这条规则【已经作废】：
 *        走单页的那个入口是「一屏堆 5 个区块」的老页面，
 *        和分步引导不是同一套流程 —— 用户会以为自己立 flag 的方式变了。
 *     现在【只有一条路】：① 立什么 → ② 立多久 → ③ 押多少 → ④ 交押金。
 *
 *  —— ⚠️ 「没有 0 元选项」不是「去掉 0 元档」，而是「本来就该没有」：
 *        0 元档（首次免费）的判据是 `isFirstFlag()`（我发起的 Flag 数量 === 0）。
 *        有过结算项目的人**不是第一个 Flag**，所以 0 元档**本来就不会出现**。
 *        之前出问题是因为走的是单页 `create` —— 单页把押金档位写死了
 *        （硬编码的 `depositOptions` 之类），绕过了 `depositRange(..., isFirstFlag())`。
 *        统一走分步引导之后，0 元档的判据自然是对的。
 */
function createEntryRoute() {
  return 'createGoal';
}
/** 当前选中的周期 —— 如果它对新用户不可选（押金上限不够），退回到能选的最长周期。
 *  否则会出现「默认 30 天，但 30 天是锁死的」这种自相矛盾的状态。 */
function selPeriod() {
  const allowed = allowedPeriods(STATE.credit);
  const cur = STATE.periodSel || 30;
  if (depositRange(STATE.credit, cur).allowed) return cur;
  return allowed.length ? Math.max(...allowed) : 7;
}
/** 现在是不是用户的【第一个 Flag】—— 决定能不能用「首次免费」的 0 元档
 *  ⚠️ 2026-11-22 用户口径（改）：0 元档已从常驻「体验档」收回成【一次性新人礼】——
 *     只有第一个 Flag 能选，且只覆盖 7 / 14 天（见需求规格 R10.4）。
 *  ⚠️ 用「我发起的 Flag 数量」判定 —— 不看有没有取消过：
 *     取消的局也是发过的局，新人礼不会退回来。 */
function isFirstFlag() {
  return (STATE.myFlags || []).length === 0;
}
/** 当前选中的押金档位 —— 必须落在当前周期的可选区间内。
 *  ⚠️ 不能直接用 STATE.depSel：默认值是 120，而新用户 14 天局的区间是 200–500，
 *  120 不在里面，提交时会把区间外的金额写进 Flag。 */
function selDeposit() {
  const days = selPeriod();
  const dr = depositRange(STATE.credit, days, isFirstFlag());
  const list = dr.options || [];
  if (list.indexOf(STATE.depSel) >= 0) return STATE.depSel;
  return list.length ? list[list.length-1] : 0;
}
function info(key, cls) {
  return `<span class="info-dot ${cls||''}" data-info="${key}">?</span>`;
}
function navBack(title) {
  return `<div class="nav-row">
    <button class="nav-back" data-back>${ICON.chevL}</button>
    <div class="nav-title">${title}</div>
  </div>`;
}
/** 押金档位选择区（2×2 网格）
 *  dr   = depositRange() 的返回值
 *  sel  = 当前选中的金额
 *  超出信用上限的档位显示为锁定态（灰、不可点），标注「信用分不够」
 *
 *  ⚠️ 2026-11-22：0 元档 =【首次免费】，排在最前，标注「首次免费」。
 *     它只出现在第一个 Flag 上（7 / 14 天），且**照常加分** —— 所以用品牌橙，
 *     跟其他档位一样是「有分值的承诺」，不再是以前那个灰色的「体验档」。 */
/* ---------- 押金档位选择（见需求规格 R2.22 ① / R10.x）
   ⚠️ 2026-11-24（本轮）：原来是 2 列网格（2 行 4 个），现在要求
   **多个金额选项框宽高一致、尽量在同一行内横向排完（4 个或 5 个）**。
   —— 所以改成一行 5 列的 flex 布局，宽度均分、高度一致。
   —— 「旁边解释说明文字字号可适当缩小」：.section-sub 里的问号说明
      那一行本来就挤，改成 .dep-grid-note 字号更小、允许换行。 */
function depGrid(dr, sel) {
  const tiers = dr.tiers || [];
  if (!tiers.length) return '';
  /* ⚠️ 2026-11-25（本轮，用户口径）：金额选项卡里的顺序改成
        **金额 → 说明文字 → 选中小圈**（圆圈移到最下面）。
     —— 用户口径：「金额在上，文字解释，圆圈在下面。」
     —— 金额是主体（用户先看「押多少」），说明文字是金额的注解
        （「首次免费」「信用分不够」），圆圈是选中态的徽记、排在最后。
        之前的「金额 → 圆圈 → 说明」把圈夹在中间，
        注解被挤到最底、和卡片边缘贴在一起，读起来像附注而不是注解。 */
  return `
    <div class="dep-grid ${tiers.length >= 5 ? 'g5' : 'g4'}">
      ${tiers.map(t => `
      <div class="dep-pick ${t.locked ? 'lock' : ''} ${t.zero ? 'zero' : ''} ${!t.locked && sel === t.value ? 'on' : ''}" ${t.locked ? 'data-dep-lock="1"' : `data-dep="${t.value}"`}>
        <div class="dep-v">${t.value === 0 ? '0 元' : t.value + ' 元'}</div>
        ${t.zero ? '<div class="dep-s">首次免费</div>' : (t.locked ? '<div class="dep-s">信用分不够</div>' : '')}
        <div class="dep-radio"></div>
      </div>`).join('')}
    </div>`;
}
function navRow(title, actions = '', identity = '', tier = '') {
  return `<div class="nav-row">
    <button class="nav-back" data-back>${ICON.chevL}</button>
    ${identity ? `<div class="nav-id-slot">${identity}</div>` : ''}
    <div class="nav-title">${title}</div>
    ${tier ? `<div class="nav-tier-slot">${tier}</div>` : ''}
    <div class="nav-actions">${actions}</div>
  </div>`;
}
/**
 * 导航栏「目标人身份条」—— 放在返回键右边（见需求规格 R2.9）
 * ⚠️ 用户口径（2026-11-21）：「小美的头像、名字、90天、强见证，T3，放到返回键的右边。」
 *    —— 围观者进详情页第一眼要确认「**这是谁的局**」，所以身份信息必须在最顶上，
 *    而不是埋在下面的目标卡里。
 * ⚠️ 用户口径（2026-11-22 第二轮）：
 *    「目标详情页T3右边有个>，取消掉。把90天、强见证T3单独放到屏幕右边。」
 *   —— 所以身份条只留【头像 + 名字】（整条可点进主页），
 *      「90 天 · 强见证 T3」挪到导航栏【最右边】（见 navTier）。
 * @param {object} f  Flag 对象
 */
function navIdentity(f) {
  return `<div class="nav-id tap" data-go="userProfile" data-id="${f.user.name}">
    ${ava(f.user.name, 'xs')}
    <span class="nav-id-name">${f.user.name}</span>
  </div>`;
}
/**
 * 导航栏右侧的「周期 · 押金」标记 —— 90 天 · 押金 ¥500
 * ⚠️ 用户口径（2026-11-22）：「在目标详情页，最上面的强见证、轻见证改为显示用户的押金金额。」
 *    —— 之前这里放的是「强见证 T3」这类**强度**信息，但围观者最想知道的是
 *       「这局压了多少钱」—— 那是这局的分量。所以换成年押金金额。
 * ⚠️ 2026-11-23 用户口径（改）：「围观人员点进目标详情，在右上角天数、押金金额旁边，
 *    展示 T 几（也就是见证席的强度）。」
 *    —— 所以押金旁边【加回】T 档位：天数 · 押金 ¥500 · T2。
 *       押金 = 这局分量，T 档 = 背书强度，两个都要。
 * @param {object} f Flag 对象
 * @param {string} tierName 强度档位名（不再展示，保留参数以兼容调用方）
 */
function navTier(f, tierName) {
  /* ⚠️ 押金在结算后会被清零 —— 详情页要显示「这局当时押了多少钱」 */
  const dep = depositPaidOf(f);
  const isZero = isZeroDepositFlag(f);
  const tier = f.tier || 'T0';
  /* ⚠️ 2026-11-23 用户口径：「把右上角的 90 天删掉，不用展示了，押金和 T3 正常展示。」
     —— 天数从导航栏拿掉 —— 周期长度在目标标题、节点条、打卡日历里都已经出现过，
        再在导航栏挂一遍是冗余；押金（这局分量）和 T 档（背书强度）才是围观者
        进这一页最想知道的两个数。 */
  return `<div class="nav-tier">
    <span class="nav-tier-dep">${isZero ? '押金 ¥0' : `押金 ¥${dep}`}</span>
    <span class="nav-id-sep">·</span>
    <span class="nav-tier-t">${tier}</span>
  </div>`;
}
function navBig(title, actions = '') {
  return `<div class="nav-row">
    <div class="nav-title big">${title}</div>
    <div class="nav-actions">${actions}</div>
  </div>`;
}
function tile(v, l, cls = '') {
  return `<div class="tile"><div class="t-v ${cls}">${v}</div><div class="t-l">${l}</div></div>`;
}
function ring(pct, val, label, size = 74, stroke = 8, color = 'var(--brand)') {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${stroke}"/>
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"/>
    </svg>
    <div class="ring-t">
      <div class="ring-v" style="color:${color}">${val}</div>
      <div class="ring-l">${label}</div>
    </div>
  </div>`;
}
function statusPill(f) {
  /* ⚠️ 取消的 Flag 走的是失败结算，但结局要单独说清楚 ——
     用户主动取消 ≠ 没做到，说「已取消」更诚实（见需求规格 R1.6）。 */
  if (f.canceled && f.status === 'failed') {
    return `<span class="status-pill done"><i class="pulse"></i>已取消</span>`;
  }
  const m = {
    running:['live','进行中'], broken:['broke','已断卡'],
    ending:['soon','即将结算'], failed:['done','亏了'],
    success:['live','挣了'],
    /* ⚠️ 2026-11-24（本轮）：「筹备中」——
       正在招募见证席的局是【筹备期】状态 —— 还没开跑，所以是筹备中。 */
    prep:['soon','筹备中'],
  }[f.status] || ['done', f.statusText];
  return `<span class="status-pill ${m[0]}"><i class="pulse"></i>${m[1]}</span>`;
}
function tierTag(tier) {
  const c = {T0:'outline', T1:'sky', T2:'brand', T3:'violet'}[tier] || 'outline';
  return `<span class="tag ${c}">${tier}</span>`;
}

/* ---------- 折叠区 ---------- */
function fold(label, inner, id = '') {
  return `<div class="fold" data-fold="${id}">
    <button class="fold-btn">${label} ${ICON.chevR}</button>
    <div class="fold-body"><div class="fold-inner">${inner}</div></div>
  </div>`;
}
function iconRow(icon, title, sub = '', color = '') {
  return `<div class="icon-row">
    <div class="ir-ico" ${color ? `style="background:${color}bg;color:${color}"` : ''}>${ic(icon)}</div>
    <div style="flex:1;min-width:0">
      <div class="ir-t">${title}</div>
      ${sub ? `<div class="ir-s">${sub}</div>` : ''}
    </div>
  </div>`;
}
function metric(v, l, cls = '') {
  return `<div class="metric"><div class="m-v ${cls}">${v}</div><div class="m-l">${l}</div></div>`;
}

/* =========================================================
   1. 启动页
   ========================================================= */
const PAGES = {};

PAGES.splash = () => `
<div class="splash">
  <div class="sp-logo">亏了</div>
  <div class="sp-q">你还能穿回那件衣服吗？</div>
  <div class="sp-s">公开立减肥目标，熟人见证<br>陌生人围观，失败留痕</div>
  <button class="btn block sp-btn" id="splashBtn">开始</button>
  <div class="sp-foot">本产品不提供医疗建议</div>
</div>`;

/* =========================================================
   2. 登录
   ========================================================= */

/* 登录方式切换：默认微信，点「手机号登录」才显示手机号表单
   —— 药丸分段控件 + 可左右拖拽跟手切换 */
function loginTabs(tab) {
  const t = tab === 'phone' ? 'phone' : 'wx';
  return `
    <div class="login-tabs" data-seg="login">
      <span class="seg-thumb" aria-hidden="true"></span>
      <button class="${t==='wx'?'on':''}" data-login-tab="wx">微信登录</button>
      <button class="${t==='phone'?'on':''}" data-login-tab="phone">手机号登录</button>
    </div>`;
}

/* 协议勾选 —— 在卡片内、登录按钮上方；两个按钮都被它 gate 住 */
function loginAgreement() {
  return `
    <label class="check login-check ${STATE.privacyAgreed?'on':''}" data-check="privacy">
      <span class="box">${ICON.check}</span>
      <span>我已阅读并同意 <b class="tap-val" data-info="agreement">《用户协议》</b><b class="tap-val" data-info="privacy">《隐私政策》</b></span>
    </label>`;
}

/* 登录表单卡片（登录页与半屏浮层共用一份，保证两边完全一致）
   ⚠️ 2026-11-22 用户口径：「微信登录的页面，跟手机登录相比，框内留白的地方太多了，
      我希望你压缩一下 …… 实质是压缩留白区域的尺寸，切换的时候整体画面不会动。」

   做法（关键）：**卡片的固定高度按【手机号态】的内容高度定，两态共用。**
   · 手机号态是三行（手机号 / 验证码 / 登录）—— 它决定卡片需要多高；
   · 微信态只有一颗按钮，天然比手机号态矮 —— 差出来的那段就是微信态的留白；
   · 把手机号态的输入框、行距、按钮高度全部压缩，卡片整体变矮，
     **微信态的留白就跟着变小** —— 这才是真正在压缩留白区，而不是把卡片改自适应。

   ⚠️ 为什么不把卡片改成自适应高度（height:auto）？
   —— 那会让卡片在切 Tab 时长高变矮，卡片下方的「先吃瓜围观」和底部协议链接
      就会跟着上下跳 —— 用户说的「整体画面不动」就破了。
   · 固定高度 + 两个面板绝对定位叠在一起 + 透明度交叉淡入 = 切换时**什么都不动**，只有内容交叉渐变。 */
function loginCard() {
  const on = t => STATE.loginTab === t ? 'on' : '';
  return `
    <div class="login-card">
      ${loginAgreement()}

      <div class="login-panes">
        <!-- 微信方式 -->
        <div class="login-pane ${on('wx')}" data-pane="wx">
          <button class="btn wx block ${STATE.privacyAgreed?'':'disabled'}" data-act="doLoginWx">${ICON.wechat} 微信一键登录</button>
        </div>

        <!-- 手机号方式：只显示手机号表单，不出现微信 -->
        <div class="login-pane ${on('phone')}" data-pane="phone">
          <div class="field">
            <input class="input" type="tel" placeholder="手机号" value="13800006688">
          </div>
          <div class="field">
            <div class="code-row">
              <input class="input" style="flex:1" placeholder="6 位验证码" value="886611">
              <button class="btn ghost sm code-btn">获取验证码</button>
            </div>
          </div>
          <button class="btn block ${STATE.privacyAgreed?'':'disabled'}" data-act="doLoginPhone">登录</button>
        </div>
      </div>
    </div>`;
}

PAGES.login = () => `
<div class="screen-scroll">
  <div class="page login-page">
    <div class="login-deco" aria-hidden="true">
      <span class="ld-arc ld-a"></span>
      <span class="ld-arc ld-b"></span>
      <span class="ld-arc ld-c"></span>
      <span class="ld-arc ld-d"></span>
      <span class="ld-arc ld-e"></span>
    </div>

    <div class="login-top">
      <img class="lh-dog" src="assets/dog_new.png" alt="亏了">
      <div class="lh-logo">亏了</div>
    </div>

    ${loginTabs(STATE.loginTab)}

    ${loginCard()}

    <button class="guest-link" data-go="square">先吃瓜围观</button>

    <div class="login-foot">
      <span class="tap-val" data-info="agreement">用户协议</span>
      <span class="sep">|</span>
      <span class="tap-val" data-info="privacy">隐私政策</span>
    </div>
  </div>
</div>`;

/* =========================================================
   3. 我的 Flag（底栏中间 · 每日高频）
   ========================================================= */

/**
 * 「我的记录」的列表行 —— 「我的」页和「我的 Flag」页共用同一份渲染
 * ⚠️ 2026-11-24（本轮）：原来两处各写一遍，内容一样但标题不同（「我的记录」/「我的 Flag」），
 *    用户会困惑「这两个地方有什么不一样」。
 *    —— 现在统一成一个函数，两处共用，标题也统一成「我的记录」。
 */
function myRecordRows() {
  return STATE.myFlags.map(f => {
    /* ⚠️ 2026-11-24：断卡（broken）也是「没做成」的一种 ——
       之前它被归到「进行中」，跟首页已经改成空态的行为对不上。 */
    const m = f.status === 'success' ? ['mint', '挣了']
            : f.status === 'failed' || f.status === 'broken' ? ['', '亏了']
            : ['brand', '进行中'];
    /* ⚠️ 2026-11-24（本轮，用户口径 Part 一①）：【删掉「记录卡」入口】——
       「任务结束后，『我的』页面里的记录小卡片不再能直接跳转到『记录卡』，
        删掉小卡片上显示的『记录卡』几个字。」
       —— 记录卡不再从列表里直接跳 —— 已结束的局点整行进【目标详情页】，
          那里底部有唯一的「分享记录卡」按钮（Part 一②）。
          —— 为什么：列表里两个入口（整行跳详情 + 角标跳记录卡）互相打架，
             而「看记录卡 / 分享这一局」这两个动作在详情页已经能做完。 */
    return `
    <div class="row tap" data-go="flagDetail" data-id="${f.id}">
      <div class="row-icon" style="background:var(--brand-tint);color:var(--brand)">${ic("target")}</div>
      <div class="row-main"><div class="row-title">${f.title}</div><div class="row-sub">${f.statusText} · 打卡 ${f.checkedDays}/${f.totalDays}</div></div>
      <span class="tag ${m[0]}">${m[1]}</span></div>`;
  }).join('');
}

/** 「我的记录」列表 —— 「我的」页与「我的 Flag」页共用 */
function myRecordList() {
  return `<div class="list">${myRecordRows()}</div>
    <div class="field-hint mt">失败记录<b>不可删除</b>（设计如此）</div>`;
}

PAGES.myFlags = () => {
  const g = myFlagsByState();
  const active = [...g.running, ...g.ending];
  const done = g.done;
  const other = [...g.broken];
  const total = STATE.myFlags.length;

  /* ---- 空态：什么都没有 ---- */
  if (!total) {
    return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navBig('我的 Flag')}</div>

    <div class="empty-hero">
      <div class="empty-ico">${ic("target")}</div>
      <div class="empty-t">你还没有立下任何 Flag</div>
      <div class="empty-s">立一个目标，有人盯着你，才算数。</div>
      <button class="btn block" data-go="${createEntryRoute()}" style="margin-top:18px">立我的第一个 Flag</button>
      <div class="empty-hint">${info('newUser','sm')}</div>
    </div>

    <div class="section">
      <div class="section-head">
        <div class="section-title">新用户能做什么</div>
      </div>
      <div class="list sparse">
        <div class="row"><div class="row-icon">${ic("checkCircle")}</div>
          <div class="row-main"><div class="row-title">第一个 Flag 免费</div><div class="row-sub">押金 0 元，这一局照常加信用分</div></div></div>
        <div class="row"><div class="row-icon">${ic("users")}</div>
          <div class="row-main"><div class="row-title">0 位见证席也能发起</div><div class="row-sub">强度 T0 独自打卡，先跑通流程</div></div></div>
        <div class="row"><div class="row-icon">${ic("trend")}</div>
          <div class="row-main"><div class="row-title">打卡越长，信用分越高</div><div class="row-sub">每满 7 天 +1 分，决定你以后能押多少</div></div></div>
        <div class="row"><div class="row-icon">${ic("eyeOpen")}</div>
          <div class="row-main"><div class="row-title">监督别人，进度可见</div><div class="row-sub">结局第一时间推给你</div></div></div>
      </div>
    </div>
  </div>
</div>`;
  }

  /* ---- 有内容 ---- */
  const card = f => {
    const left = daysLeft(f);
    const prog = Math.round(f.checkedDays / f.totalDays * 100);
    const need = (f.curWeight - f.targetWeight).toFixed(1);
    const done2 = f.status === 'failed' || f.status === 'success';
    /* 取消入口（见需求规格 R1.6）：只有进行中的 Flag 能取消，
       按钮刻意做得很淡 —— 不主动引导，但用户找得到。 */
    const canCancel = canCancelFlag(f).ok;
    /* ⚠️ 2026-11-24（本轮，用户口径 Part 一①）：【删掉「记录卡」入口】——
       「我的 Flag」页的记录卡片同样不再挂「记录卡」角标 ——
       记录卡统一从【目标详情页底部】的「分享记录卡」进。
       —— 为什么：同一个东西在两个列表页有两种入口，位置还不一样，
          用户会以为「记录卡」有两种。收敛成一条路径。 */
    return `
    <div class="feed-card" data-go="flagDetail" data-id="${f.id}">
      <div class="feed-head">
        <div style="flex:1;min-width:0">
          <div class="feed-name">${f.title}</div>
          <div class="feed-meta">${f.days} 天 · ${TIER_META[f.tier].name} · ${isZeroDepositFlag(f) ? '押金 ¥0' : `押金 ¥${depositPaidOf(f)}`} · ${f.start.slice(5)} 起</div>
        </div>
        ${statusPill(f)}
      </div>
      <div class="feed-weight">
        <div class="fw-cur"><span class="fw-v">${f.curWeight}</span><span class="fw-u">kg</span></div>
        <div class="fw-side">
          <div class="fw-l">${done2 ? '最终体重' : '距目标'}</div>
          <div class="fw-d ${done2 && f.status !== 'success' ? '' : 'good'}">${f.status === 'success' ? '挣回了' : need + ' kg'}</div>
        </div>
        <div class="fw-prog">
          <div class="bar ${f.status==='broken'?'rose':f.status==='ending'?'amber':done2?'':'mint'}"><i style="width:${prog}%"></i></div>
          <div class="fw-prog-l">${f.checkedDays}/${f.totalDays} 天${done2?'':` · 剩 ${left} 天`}</div>
        </div>
      </div>
      <div class="feed-foot">
        <span class="ff-l">${ic('users')} ${f.supervisorCount} 人监督 · 连续 ${f.streak} 天</span>
        <span class="ff-r">${f.status==='broken'?`断卡 ${f.breaks} 次`:done2?'已结束':'去看'} ${ic('chevR')}</span>
      </div>
      ${canCancel ? `<div class="feed-cancel"><button class="cancel-link" data-act="doCancelFlag" data-id="${f.id}">取消这个 Flag</button></div>` : ''}
    </div>`;
  };

  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">
      ${navBig('我的记录', `<button class="nav-btn" data-go="flagMenu">${ICON.list}</button>`)}
    </div>

    ${/* 立 Flag 入口（见需求规格 R1.6）—— 同一时间只能有一个进行中的 Flag。
        已有进行中的 Flag 时，按钮降级成提示态：告诉用户得先取消原来那个。 */
      canCreateFlag().ok
        ? `<button class="btn block mt" data-go="${createEntryRoute()}">${ic("plus")} 立一个新的 Flag</button>`
        : `<div class="btn block mt disabled" style="display:flex;align-items:center;justify-content:center;gap:8px">
             ${ic("plus")} 立一个新的 Flag
           </div>
           <div class="field-hint" style="text-align:center;margin-top:8px">
             同一时间只能有<b>一个</b>进行中的 Flag —— 取消现在这个，才能开新的。
           </div>`}

    ${active.length ? `
    <div class="section">
      <div class="section-head">
        <div class="section-title">进行中</div>
        <div class="section-sub">${active.length} 个</div>
      </div>
      ${active.map(card).join('')}
    </div>` : ''}

    ${done.length ? `
    <div class="section">
      <div class="section-head">
        <div class="section-title">已结束</div>
        <div class="section-sub">失败记录不可删除</div>
      </div>
      ${done.map(card).join('')}
    </div>` : ''}

    ${other.length ? `
    <div class="section">
      <div class="section-head"><div class="section-title">其它</div></div>
      ${other.map(card).join('')}
    </div>` : ''}
  </div>
</div>`;
};
/* =========================================================
   4. 首页（订阅流）
   ========================================================= */

/**
 * 首页 · 筹备期版本（见需求规格 R1.1.3）
 * ⚠️ 2026-11-22 用户口径：「当用户刚立了一个 flag，24 小时期间，这里应该是一个
 *    显眼的 24 小时倒计时（因为还没能正式开始打卡，这个时候主要是招募为主）
 *    以及见证席的申请情况、已有的见证人数量。
 *    24 小时内，点进去应该是发起成功那个页面，主要是分享、看见证席的申请情况，
 *    以及邀请人见证。等 24 小时过了，才变成正常的打卡页面。」
 *
 * —— 关键：筹备期里**这一局还不能打卡**（第 1 天还没开始），
 *    所以首页不能出现「今天还没打卡 / 去打卡」—— 那会引导用户去做一件现在做不到的事。
 *    这一版的主视觉是【倒计时 + 招人】，点进去是发起成功页。
 */
function homePrep(my, tasks) {
  const accepted = witnessAccepted(my.witnesses || []);
  const pending = (my.witnesses || []).filter(w => w.status === 'pending').length;
  const applicants = recruitApplicants();
  const appCount = applicants.filter(a => a.status !== 'declined').length;
  const appAccepted = applicants.filter(a => a.status === 'accepted').length;
  const recruitOn = !!STATE.recruitPublished;
  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">
      ${navBig('亏了', `<button class="nav-btn" data-info="product">?</button>`)}
    </div>

    <!-- 主角：筹备期的 Flag —— 倒计时 + 招人（不是打卡）
         ⚠️ 2026-11-24（本轮，用户口径 Part 一①）：**整张卡改为不可点击** ——
            —— 用户口径：「筹备期状态下，首页『我的 Flag』灰色卡片当前仍可点击进入；
               调整为仅作展示，不可点击。」
            —— 原因：筹备期这一段的主任务是【找人】（见下面那张「这 24 小时，任务只有一个」卡），
               而**真正能操作的那一页是发起成功页**（立据 / 倒计时 / 召集令都在那儿）。
               灰卡上写着「我的 Flag」，点它跳到一个**不能操作的详情页** —— 那是误导。
            —— 所以：灰卡只做展示；要看立据、去招人，走下面那三个明确按钮。
         ⚠️ 点整张卡进的是【发起成功页】，不是目标详情页（见 R1.1.3）。
         ⚠️ 2026-11-24（本轮，用户口径）：**倒计时卡片改为不可点击** ——
            原来灰色倒计时块跟着整张卡一起可点，点了就进立据页。
            —— 为什么不能点：倒计时是一个【被看的东西】，不是一个【入口】。
               它上面没有任何可点的操作暗示，用户点它多半是「想看看还剩多久」，
               结果被弹到另一个页面 —— 那是误触，不是意图。
            —— 所以：倒计时块自己**不响应点击**（CSS 掐掉指针事件 +
               去掉它的可点暗示），整张卡的其他地方照旧可点。 -->
    <div class="hero prep-hero prep-hero-static" data-no-nav="1">
      <div class="h-top">
        <span class="h-label">我的 Flag</span>
        <span class="h-badge prep-badge">${ic('clock')} 筹备中</span>
      </div>
      <div class="h-title">${my.title}</div>
      <div class="h-dep">押金 ${isZeroDepositFlag(my) ? '¥0（首次免费）' : `¥${depositPaidOf(my)}`} · ${my.days} 天</div>

      <!-- 显眼的 24 小时倒计时（真实时钟，逐秒递减）
           ⚠️ 2026-11-24（本轮）：prep-clock-static = 不可点击 -->
      <div class="prep-clock-block prep-clock-static" data-prep-timer data-prep-end="${my.prepEndAt || 0}" data-no-nav="1">
        <div class="pcb-label">距离正式开始还有</div>
        <div class="pcb-clock" data-prep-clock>--:--:--</div>
        <div class="pcb-note">这 24 小时里<b>还不能打卡</b> —— 先把见证人找齐。</div>
      </div>

      <!-- 招人状态：已有见证人数 + 申请情况 -->
      <div class="prep-recruit">
        <div class="pr-cell">
          <div class="pr-v">${accepted}</div>
          <div class="pr-l">已有见证席</div>
        </div>
        <div class="pr-cell">
          <div class="pr-v">${appCount}</div>
          <div class="pr-l">收到申请</div>
        </div>
        <div class="pr-cell">
          <div class="pr-v">${pending + appAccepted}</div>
          <div class="pr-l">待接受</div>
        </div>
        <div class="pr-cell">
          <!-- ⚠️ 2026-11-23 用户口径（改）：「独立打卡」这几个字太大了，小一点
             —— 档位名是中文（4 个字），不能跟数字共用 21px 的字号，
                否则一格放不下还会顶到分隔线。 -->
          <div class="pr-v pr-v-txt">${TIER_META[my.tier].name}</div>
          <div class="pr-l">当前档位</div>
        </div>
      </div>

      <div class="prep-bar-row">
        <div class="bar mint"><i style="width:${Math.min(100, accepted / WITNESS_MAX * 100)}%"></i></div>
        <div class="prep-bar-note">已占 ${witnessSlots(my.witnesses || [])}/${WITNESS_MAX} 个坑位 · 档位按<b>已接受</b>的人数定</div>
      </div>
    </div>

    <!-- 招募为主：这一段的主动作是「找人」，不是「打卡」 -->
    <div class="card mt prep-actions">
      <div class="prep-act-h">
        <div style="font-size:15px;font-weight:680">这 24 小时，任务只有一个：找人</div>
        <div class="field-hint" style="margin:6px 0 0">
          0 位见证席也能跑（档位 T0 独自打卡）—— 但<b>见证人越多，信用分系数越高</b>。
        </div>
      </div>
      <!-- ⚠️ 2026-11-24（本轮）：按钮文案从「分享立据 · 邀请人来见证」
           改成「查看我的立据」——
           —— 原因：这一屏的主角是**筹备期**（还剩多久、招到几个人），
              「邀请人来见证」是动作，但用户此刻最想看的是
              **「我立的那张据到底长什么样」**（要分享也得先看得见）。
              而且下面紧接着就是「发布见证席召集令」「从候选池选」两个招人动作 ——
              再加一个「邀请人来见证」就是三个招人按钮，抢戏。 -->
      <button class="btn block mt" data-go="created" data-id="${my.id}">${ic('doc')} 查看我的立据</button>
      ${recruitOn ? `
      <button class="btn ghost block mt" data-act="openRecruitSheet">${ic('megaphone')} 见证席召集令已发布${appCount ? ` · ${appCount} 人报名` : ''}</button>
      ` : `
      <button class="btn ghost block mt" data-act="publishRecruit">${ic('megaphone')} 发布见证席召集令</button>
      `}
      <button class="btn ghost block mt" data-go="witnessPool">${ic('users')} 从见证席候选池选</button>
    </div>

    ${tasks.length ? `
    <!-- 见证席待办 -->
    <div class="section">
      <div class="card" style="padding:14px 16px">
        <div style="display:flex;align-items:center;gap:11px">
          <div style="width:38px;height:38px;border-radius:12px;background:var(--amber-tint);display:flex;align-items:center;justify-content:center;color:#A97108;flex:0 0 38px">
            ${ic('gavel')}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:15px;font-weight:650">${tasks.length} 个判定等你点</div>
            <div style="font-size:12px;color:var(--ink-3);margin-top:2px">最近一个还剩 6 小时</div>
          </div>
          <button class="btn sm" data-go="verdict">去处理</button>
        </div>
      </div>
    </div>` : ''}

    <!-- 我见证的 Flag（筹备期也照样展示 —— 见证关系跟打卡无关） -->
    ${homeWitnessSection()}
  </div>
</div>`;
}

/**
 * 首页 ·「没有进行中的 Flag」那一版
 *
 * ⚠️ 2026-11-24 用户口径：
 *   「已结算的时候，首页不需要展示卡片了，用户能在『我的』-『我的记录』中点击查看就行。
 *     也不存在『今日未打卡』，参考新用户刚进入的时候的页面，
 *     只不过文案从『立下我的第一个 flag』改成了『立下我的 FLAG』。」
 *
 * —— 两种情况共用这一版：
 *      · kind='first'  全新用户（一个 Flag 都没有）
 *      · kind='again'  上一局已结算（success / failed / broken）
 * —— 两种的差别只在【按钮文案】：
 *      · first → 「立我的第一个 Flag」（真的是第一次）
 *      · again → 「立下我的 FLAG」（第 N 次了，不该再说「第一个」）
 *
 * —— ⚠️ 为什么已结算不再挂一张卡：
 *      首页的主角位回答的是「**我现在要做什么**」。
 *      已结算的用户现在没有要做的打卡 —— 硬挂一张「今天还没打卡」是在说一件假话，
 *      而且把旧记录天天摆在首屏，真正在办的事（见证判定 / 回留言）反而被挤下去。
 *      旧记录去「我的 → 我的记录」里看，那本来就是它该在的地方。
 */
function homeEmpty(kind) {
  const first = kind !== 'again';
  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">
      ${navBig('亏了', `<button class="nav-btn" data-info="product">?</button>`)}
    </div>

    <div class="empty-hero">
      <div class="empty-ico">${ic("target")}</div>
      <div class="empty-t">${first ? '你还没有立下任何 Flag' : '你目前没有进行中的 Flag'}</div>
      <div class="empty-s">立一个目标，让别人盯着你，才算数。</div>
      <button class="btn block lg" data-go="${createEntryRoute()}" style="margin-top:20px">${ic("plus")} ${first ? '立我的第一个 Flag' : '立下我的 FLAG'}</button>
      <!-- ⚠️ 2026-11-24 用户口径：「在首页中『立我的第一个FLAG』按钮下面的？号，删掉。」
           —— 原来这里挂着一个 info-dot（讲「第一个 Flag 免费」/押金规则）。
              新用户最想做的就是立下去，不是读规则 —— 问号去掉，
              规则在立 Flag 的第 3 步（押金那一步）本来就有。 -->
    </div>

    <div class="section">
      <div class="section-head"><div class="section-title">立 Flag 会发生什么</div></div>
      <div class="list sparse">
        <div class="row"><div class="row-icon">${ic("users")}</div>
          <div class="row-main"><div class="row-title">有人盯着，才不鸽自己</div><div class="row-sub">见证席 + 监督席，全程公开可查</div></div></div>
        <div class="row"><div class="row-icon">${ic("coin")}</div>
          <div class="row-main"><div class="row-title">押金押上，达标全退</div><div class="row-sub">没做到按信用比例扣，信用越高扣得越少</div></div></div>
        <div class="row"><div class="row-icon">${ic("trend")}</div>
          <div class="row-main"><div class="row-title">守信攒信用，越走越远</div><div class="row-sub">信用分越高，能押越多、能立越久</div></div></div>
      </div>
    </div>

    <!-- ⚠️ 2026-11-23 用户口径：首页的列表是「我见证的 Flag」——
         新用户即使自己没立 Flag，只要在见证别人的局，这里也要有内容。 -->
    ${homeWitnessSection()}
  </div>
</div>`;
}

/**
 * 首页 ·「我见证的 Flag」区块
 * ⚠️ 2026-11-23 用户口径：「首页中，把『我关心的 Flag』改为『我见证的 Flag』，
 *    点进去以后就是正常的目标详情，区别于订阅 —— 这里只展示我正在见证的 Flag
 *    （哪怕没到节点）。」
 * —— 所以：
 *    · 列表只装【我正在见证】的局（见证席名单里有我 / 我有待判任务）
 *    · 哪怕下一判定节点还没到，这一局照样在列表里
 *    · 点进去走的就是普通的目标详情页（data-go="flagDetail"），不做特殊跳转
 *    · 监督的局不在这里 —— 监督在「我的 → 监督」里单独管
 */
function homeWitnessSection() {
  const list = myWitnessingFlags();
  const tasks = STATE.verdictTasks || [];
  return `
    <!-- 我见证的 Flag -->
    <div class="section">
      <div class="card" style="padding:14px 0 0">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0 16px 12px">
          <div style="font-size:15px;font-weight:680">我见证的 Flag</div>
          <span class="tiny muted">${list.length} 个</span>
        </div>
        ${list.length ? list.map(s => {
          const pending = tasks.find(t => t.flagId === s.id && !t.myVerdict);
          const mine = tasks.filter(t => t.flagId === s.id);
          return `
        <div class="row tap" data-go="flagDetail" data-id="${s.id}" style="border-top:1px solid var(--line);padding:11px 16px">
          ${ava(s.user.name, 'sm')}
          <div class="row-main">
            <div class="row-title" style="font-size:13.5px">${s.user.name} · ${s.title.slice(0,14)}${s.title.length>14?'…':''}</div>
            <div class="row-sub" style="margin-top:2px">${s.checkedDays}/${s.totalDays} 天 · ${
              pending
                ? `<b style="color:var(--brand)">待你判定 · ${pending.nodeName}</b>`
                : mine.length
                  ? `你已判定 ${mine.filter(t=>t.myVerdict).length}/${mine.length} 步 · 下一个节点还没到`
                  : '你是见证席 · 下一个节点还没到'
            }</div>
          </div>
          ${statusPill(s)}
        </div>`;
        }).join('') : `
        <div style="border-top:1px solid var(--line);padding:22px 16px;text-align:center">
          <div style="font-size:13px;color:var(--ink-3)">还没在见证任何 Flag</div>
          <div style="margin-top:10px"><button class="btn ghost sm" data-go="verdict">去见证席面板</button></div>
        </div>`}
      </div>
    </div>`;
}

PAGES.home = () => {
  /* ⚠️ 2026-11-23 用户口径：首页列表不再是「我关心的 Flag」（订阅 + 关注），
     改成「我见证的 Flag」—— 只放我正在见证的局（见 homeWitnessSection）。
     监督在「我的 → 监督」里管，关注在「我的 → 我关注的人」里管。 */
  const my = myMainFlag();
  const tasks = STATE.verdictTasks;

  /* ---------- 空态：全新用户 ---------- */
  if (!my) {
    return homeEmpty('first');
  }

  /* ---------- 有内容 ---------- */
  const lost = (my.startWeight - my.curWeight).toFixed(1);
  const need = (my.curWeight - my.targetWeight).toFixed(1);
  const left = daysLeft(my);

  /* ⚠️ 2026-11-24 用户口径：
     「已结算的时候，首页不需要展示卡片了，用户能在『我的』-『我的记录』中点击查看就行。
       也不存在『今日未打卡』，参考新用户刚进入的时候的页面，
       只不过文案从『立下我的第一个 flag』改成了『立下我的 FLAG』。」
     —— 所以【已结算的局】走【空态那一版首页】：
        没有主角卡、没有打卡卡、没有补卡提醒、没有断卡预警。
        旧的记录去「我的 → 我的记录」里看。
     —— 差别只在一处：【按钮文案】
        · 全新用户 → 「立我的第一个 Flag」（真的是第一次）
        · 已结算   → 「立下我的 FLAG」（第 N 次了，不该再说「第一个」）
     —— ⚠️ 断卡（broken）也归到这里 —— 断卡是失败结局的一种，
        同样不需要在首页挂着一张「今天还没打卡」的卡。 */
  if (my.status === 'success' || my.status === 'failed' || my.status === 'broken') {
    return homeEmpty('again');
  }

  /* ⚠️ 2026-11-22 用户口径：「当用户刚立了一个 flag，24 小时期间，这里应该是一个
     显眼的 24 小时倒计时（因为还没能正式开始打卡，这个时候主要是招募为主）
     以及见证席的申请情况、已有的见证人数量。
     24 小时内，点进去应该是发起成功那个页面……
     等 24 小时过了，才变成正常的打卡页面。」
     —— 所以筹备期的首页主视觉完全换掉：
        不是「今天还没打卡 / 去打卡」，而是【倒计时 + 招人】。 */
  if (my.status === 'prep') {
    return homePrep(my, tasks);
  }

  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">
      ${navBig('亏了', `<button class="nav-btn" data-info="product">?</button>`)}
    </div>

    <!-- 主角：我的 Flag -->
    <div class="hero" data-go="flagDetail" data-id="${my.id}">
      <div class="h-top">
        <span class="h-label">我的 Flag</span>
        <span class="h-badge">${ic('fire')} ${my.streak} 天</span>
      </div>
      <div class="h-title">${my.title}</div>
      <!-- ⚠️ 2026-11-22 用户口径：「首页中，我的FLAG要展示我的押金金额。」 -->
      <div class="h-dep">押金 ${isZeroDepositFlag(my) ? '¥0（首次免费）' : `¥${depositPaidOf(my)}`}</div>
      <div class="hero-nums">
        <div class="hn">
          <div class="hn-v">${my.startWeight}</div>
          <div class="hn-l">起始</div>
        </div>
        <div class="hn">
          <div class="hn-v">${my.curWeight}</div>
          <div class="hn-l">现在</div>
        </div>
        <div class="hn">
          <div class="hn-v">${my.targetWeight}</div>
          <div class="hn-l">目标</div>
        </div>
      </div>
      <div class="bar mint" style="position:relative;z-index:1"><i style="width:${Math.round(my.checkedDays/my.totalDays*100)}%"></i></div>
      <div class="bar-row" style="position:relative;z-index:1;margin:7px 0 0">
        <span>已减 ${lost} kg</span>
        <span>还差 ${need} kg · 剩 ${left} 天</span>
      </div>
    </div>

    <!-- 断卡预警（见需求规格 9.4）：额度用尽 → 再断 1 次就结束
         ⚠️ 2026-11-24 用户口径（改）：
           「『首页』中的『还剩 1 次断卡额度』，删除掉，
             只有在用户已经用完断卡额度，再漏打卡就要失败了，才提醒，
             而不是还剩 1 次就提醒，平时看的话用户点进去详情页看断卡情况就行。」
         —— 所以【额度只剩 1 次时那条 amber 预警整块删掉】。
         —— 剩下的两种情况保留：
              · limit === 0（这个 Flag 不允许断卡）—— 今天必须打卡
              · left === 0（额度用完了）—— 再断 1 次就结束
         —— 额度还剩几次平时不吵，想看就点详情页看「断卡情况」。 -->
    ${(() => {
      const limit = breakLimitOf(my.totalDays || my.days);
      const left = breakLeftOf(my);
      if (limit === 0) {
        return `
    <div class="kicker rose mt">
      ${ic('alert')}
      <span><b>这个 Flag 不允许断卡</b> —— 断 1 次就结束。今天必须打卡。</span>
    </div>`;
      }
      if (left === 0) {
        return `
    <div class="kicker rose mt">
      ${ic('alert')}
      <span><b>再断 1 次，这个 Flag 就结束了。</b><br>你的 ${limit} 次断卡额度已经用完了。</span>
    </div>`;
      }
      return '';
    })()}

    <!-- 今日打卡：唯一的主行动
         ⚠️ 2026-11-23 用户口径：「首页中，当提交当日打卡以后，『今天没打卡』要改为已打卡，
            目前是不会动态变动的。」
         —— 所以这里按 checkedToday(my) 分两态渲染，提交打卡后回到首页立刻变。 -->
    ${(() => {
      const done = checkedToday(my);
      if (done) {
        /* ⚠️ 2026-11-24（本轮，用户口径 Part 七①）：
           「当天已打卡后，首页不再显示『查看』按钮，卡片不可点击进入；
             仅作为常驻展示框，显示『今日已打卡』即可。」
           —— 为什么：打过卡之后没有「马上要做的动作」——
              「查看」给的是一个不存在的紧急感，用户点它只是为了确认「我今天到底打了没」。
              而这个确认，卡片上那行「今天已打卡」已经说完了。
           —— 所以：去掉右侧的「查看 ›」，整块不再是可点的入口。 */
        return `
    <div class="card mt" style="display:flex;align-items:center;gap:13px;padding:14px 16px">
      <div style="width:44px;height:44px;border-radius:14px;background:var(--mint-tint);display:flex;align-items:center;justify-content:center;color:#3F7A58;flex:0 0 44px">
        ${ic('checkCircle')}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:15.5px;font-weight:650">今天已打卡</div>
        <div style="font-size:12px;color:var(--ink-3);margin-top:2px">连续 ${my.streak} 天 · 第 ${my.totalDays - left} / ${my.totalDays} 天</div>
      </div>
    </div>`;
      }
      return `
    <div class="card mt" data-go="checkin" data-id="${my.id}" style="display:flex;align-items:center;gap:13px;padding:14px 16px">
      <div style="width:44px;height:44px;border-radius:14px;background:var(--brand-tint);display:flex;align-items:center;justify-content:center;color:var(--brand);flex:0 0 44px">
        ${ic('camera')}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:15.5px;font-weight:650">今天还没打卡</div>
        <div style="font-size:12px;color:var(--ink-3);margin-top:2px">第 ${my.totalDays - left} / ${my.totalDays} 天</div>
      </div>
      <span style="color:var(--brand);font-weight:600;font-size:14px">去打卡 ›</span>
    </div>`;
    })()}

    <!-- 补卡提醒（⚠️ 2026-11-24 用户口径新增）
         口径：断卡提醒应该是几月几日未打卡，给用户一个按钮，点击补卡，
         并且做 12 小时倒计时。断卡的提醒不放目标详情页，
         放到首页「打卡卡」的下面，做一个提醒。
         因为今天的打卡和昨天的补卡是可以同步进行的，只不过补卡倒计时 12 小时而已。
         —— 所以：① 位置在打卡卡的下面；
            ② 说的是【几月几日没打卡】（不是笼统的「这一局断了」）；
            ③ 有【补卡按钮】；
            ④ 有【12 小时倒计时】；
            ⑤ 今天的打卡和昨天的补卡【不冲突】—— 两个入口并列，各做各的。 -->
    ${(() => {
      const mw = makeupWindow(my);
      if (mw.state !== 'open') return '';
      return `
    <div class="card mk-card mt" data-makeup="${my.id}">
      <div class="mk-top">
        <div class="mk-ico">${ic('clock')}</div>
        <div class="mk-main">
          <div class="mk-t">${shortDate(mw.missedOn)} 没打卡</div>
          <div class="mk-d">可以补卡 · <b data-makeup-clock="${mw.endAt}">${makeupRemainText(mw.remainMs)}</b></div>
        </div>
        <button class="btn sm" data-makeup-btn="${my.id}">补卡</button>
      </div>
    </div>`;
    })()}

    <!-- 立 Flag：低频动作，但要做成显眼的一级入口
         ⚠️ 2026-11-21 用户要求删掉首页的「单 Flag 限制」降级提示块。
            单 Flag 规则本身不变（见需求规格 R1.6），只是**首页不再解释它** ——
            约束由「发起入口拦截 + 详情页/菜单页取消入口」承担，首页只管展示我的承诺。
            没有进行中的 Flag 时才显示这个入口。 -->
    ${canCreateFlag().ok ? `
    <button class="cta-card" data-go="${createEntryRoute()}">
      <span class="cta-ico">${ic("plus")}</span>
      <span class="cta-main">
        <span class="cta-t">立一个新的 Flag</span>
        <span class="cta-s">24 小时筹备期 · 第一次免费</span>
      </span>
      ${ICON.chevR}
    </button>` : ''}

    ${tasks.length ? `
    <!-- 见证席待办 -->
    <div class="section">
      <div class="card" style="padding:14px 16px">
        <div style="display:flex;align-items:center;gap:11px">
          <div style="width:38px;height:38px;border-radius:12px;background:var(--amber-tint);display:flex;align-items:center;justify-content:center;color:#A97108;flex:0 0 38px">
            ${ic('gavel')}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:15px;font-weight:650">${tasks.length} 个判定等你点</div>
            <div style="font-size:12px;color:var(--ink-3);margin-top:2px">最近一个还剩 6 小时</div>
          </div>
          <button class="btn sm" data-go="verdict">去处理</button>
        </div>
      </div>
    </div>` : ''}

    <!-- ⚠️ 2026-11-24 用户口径：「为了让整个 demo 更接近真实的软件的使用的感觉……」
         —— 真实软件里，首页不只有「待打卡」，还有别的【等着我做的事】：
            有人给我留言（我要不要回一句）、我提的异议（到几票了）。
            以前首页只承载了「打卡 + 判定」两件事，
            所以这里把【待回声的留言】也提上来 —— 它是一个真实的日常动作。 -->
    ${(() => {
      const my = myMainFlag();
      if (!my || !my.msgs) return '';
      const waiting = my.msgs.map((m, i) => ({ m, i })).filter(x => !x.m.reply);
      if (!waiting.length) return '';
      return `
    <div class="section">
      <div class="card" style="padding:14px 16px">
        <div style="display:flex;align-items:center;gap:11px">
          <div style="width:38px;height:38px;border-radius:12px;background:var(--sky-tint);display:flex;align-items:center;justify-content:center;color:#35648F;flex:0 0 38px">
            ${ic('message')}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:15px;font-weight:650">${waiting.length} 条留言等你回一句</div>
            <div style="font-size:12px;color:var(--ink-3);margin-top:2px">「${waiting[0].m.text.slice(0, 18)}${waiting[0].m.text.length > 18 ? '…' : ''}」</div>
          </div>
          <button class="btn sm" data-go="flagDetail" data-id="${my.id}">去回</button>
        </div>
      </div>
    </div>`;
    })()}

    <!-- 我见证的 Flag -->
    ${homeWitnessSection()}
  </div>
</div>`;
};

/* =========================================================
   广场内容卡 —— 双列瀑布流（小红书式，见需求规格 R2.7）
   ⚠️ 2026-11-21 二次调整：单列 4:3 大图占了整屏宽度，一屏只看得到 1 张，
      用户反馈「照片占据的画面太大」。改为 2 列瀑布流：
        · 封面改竖版 3:4（600×800），窄栏不裁切
        · 卡片信息压缩：标题 2 行 + 一行紧凑数据 + 细进展条
        · 保留产品特色：体重 / 距目标 / 监督人数 / 进展
        · 8 格缩略图条（.feed-strip）仍然没有 —— 那是详情页的东西
   ⚠️ 物证与内容分离：封面只是「内容图」，不参与打卡校验
      （打卡照在详情页/物证页，物证链路不受影响）
   ========================================================= */
/* ⚠️ 2026-11-24（本轮）：原来这个函数带一个 view 参数，
   里面有一段 `view === 'recruit'` 的「参加」按钮分支 ——
   但招募视图早就改用 recruitStrip() 了，feedCard 在招募视图里**根本不会被调用**，
   那段是永远执行不到的死代码（而且文案还是旧的「参加」）。
   —— 现在招募视图走横条，这个分支整块删掉，view 参数也一并去掉。 */
function feedCard(f) {
  if (!f) return '';
  const left = daysLeft(f);
  const prog = Math.round(f.checkedDays / f.totalDays * 100);
  const done = f.status === 'failed' || f.status === 'success';
  const cover = coverPhotoOf(f);
  /* ⚠️ 「已关注」角标（见需求规格 R2.14）—— 关注是【人级】关系，
     所以角标标在【这张卡的作者】上，不是标在某一局上。 */
  const followed = isFollowing(f.user.name);
  /* ⚠️ 2026-11-23 用户口径：点赞数显示在点赞按钮右边；一天最多 +1 次 */
  const liked = likedToday(f.id);
  const likeCount = likeCountOf(f.id);
  /* ⚠️ 2026-11-24 用户口径：监督可以点（点了就监督了，颜色改变，再点取消） */
  const supervised = isSubscribed(f.id);
  return `
<div class="feed-card" data-go="flagDetail" data-id="${f.id}">
  <!-- 封面竖图：3:4，视觉主体 -->
  <div class="feed-cover">
    ${cover
      ? `<img src="${cover.src}" alt="封面图" loading="lazy">`
      : `<div class="feed-cover-fb">
           <div class="fcf-l">${f.startWeight} → ${f.targetWeight}</div>
           <div class="fcf-s">${f.days} 天</div>
         </div>`}
    <!-- 左上角：作者（窄栏只留头像，名字在图下） -->
    <div class="feed-cover-top">
      ${ava(f.user.name, 'sm')}
      <div class="fcv-name">${f.user.name}</div>
      ${statusPill(f)}
    </div>
    ${followed ? `<div class="feed-followed">${ic('check')} 已关注</div>` : ''}
    <!-- 右下角：押金金额
         ⚠️ 2026-11-23 用户口径：「把现在展示用户本次拍了多少张照片的数量地方，
            替换为用户的押金金额展示。」
         —— 照片数只是内容量，押金才是这局的【分量】，围观者更想知道这个。 -->
    <div class="feed-cover-n">${ic('coin')} ${isZeroDepositFlag(f) ? '首次免费' : depositPaidOf(f) + ' 元'}</div>
  </div>

  <!-- 图下：标题 + 紧凑数据条 -->
  <div class="feed-body">
    <div class="feed-title clamp2">${f.title}</div>
    <!-- 一行：开始体重 → 目标体重
         ⚠️ 2026-11-23 用户口径：「这个截图中 67.4KG 4.2KG 的数据展示，
            改为用户定的开始体重和目标体重。」
         —— 所以这里不再显示「当前体重 / 还差多少」，
            改显示【用户自己定的两个数】：起始体重 → 目标体重。 -->
    <div class="feed-meta-line">
      <span class="fml-w">
        <b>${f.startWeight}</b><i>kg</i>
        <span class="fml-arrow">→</span>
        <b>${f.targetWeight}</b><i>kg</i>
      </span>
    </div>
    <!-- 细进展条：天数 + 剩余 -->
    <div class="feed-prog">
      <div class="bar ${f.status==='broken'?'rose':f.status==='ending'?'amber':done?'':'mint'}"><i style="width:${prog}%"></i></div>
      <div class="feed-prog-l">
        <span>${f.checkedDays}/${f.totalDays}天${done ? '' : ` · 剩${left}天`}</span>
      </div>
    </div>
    <!-- ⚠️ 2026-11-24（本轮）：这一行从【三个按钮】减成【两个】——
         原来有 点赞 / 留言 / 监督 三个，只剩 153px 宽，每个都被挤得读不清。
         —— 去掉的是「留言」：
            ① 留言的点击率天然低 —— 点它不是「看一眼」，是要停下来打字；
               在信息流里用户不会为刚刷到的局停下来写一句话。
            ② 留言本来就是「进到这局里再说」的动作，放在窄卡上反而不自然。
         —— 留言的入口【统一收到目标详情页】：那里的留言框会升起和广场同一个半屏，
            全站留言只剩一种形态、一套数据（见下方「目标详情页留言入口」）。
         —— 留下的两个：① 点赞（图标 + 赞数）② 监督（眼睛图标 + 监督数，可点）
            文字全删 —— 窄栏只放得下「图标 + 数字」。 -->
    <div class="feed-actions">
      <button class="feed-like ${liked ? 'on' : ''}" data-act="doFeedLike" data-id="${f.id}">
        ${ic('thumbsUp')}<span>${likeCount}</span>
      </button>
      <button class="feed-sup ${supervised ? 'on' : ''}" data-act="toggleSupervise" data-id="${f.id}">
        ${ic('eyeOpen')}<span>${f.supervisorCount}</span>
      </button>
    </div>
  </div>
</div>`;
}

/* =========================================================
   4. 广场
   ========================================================= */

/**
 * 广场「招募中」视图的横条
 * ⚠️ 2026-11-24（本轮）：这个视图原来是【双列大卡片】（走 feedCard）——
 *    但招募中的局连封面照都没有（还在筹备期，没人拍照片），
 *    卡片里是一大块灰色占位，看着很怪。
 *    而且用户在这个视图里只做一件事 —— 看看有没有想参加的，
 *    不需要看体重曲线和进度条。所以改成【横条】。
 *
 * —— 横条上有什么（用户口径）：
 *    ① 删掉 T0 那一档等级（横条不展示档位，档位是详情页的事）
 *    ② 「招募还剩 6 小时」改成【真正的倒计时】05:39 ——
 *       「招募还剩」四个字也删了，一个数字摆在末尾，扫一眼就知道是倒计时
 *    ③ 「参加」改成「我想参加」
 *    ④ 整行点一下 → 进【招募详情】页（新页面）
 */
function recruitStrip(f) {
  const joined = witnessApplying(f.id);
  const slots = (f.witnesses || []).length;
  const ms = recruitRemainMs(f);
  return `
  <div class="recruit-strip ${joined ? 'joined' : ''}" data-go="recruitDetail" data-id="${f.id}">
    <div class="rs-ava">${ava(f.user.name, 'sm')}</div>
    <div class="rs-main">
      <div class="rs-title">${f.user.name} · ${f.title}</div>
      <div class="rs-sub">
        <span>${f.days} 天</span>
        <span>押金 ¥${depositPaidOf(f)}</span>
        <span>已有 ${slots} 位见证席</span>
        <span class="rs-clock" data-recruit-clock="${f.id}">${fmtRecruitRemain(ms)}</span>
      </div>
    </div>
    <button class="btn xs ${joined ? 'ghost' : ''}" ${joined ? 'disabled' : ''} data-act="applyJoinWitness" data-id="${f.id}">${joined ? '我想参加过了' : '我想参加'}</button>
  </div>`;
}

PAGES.square = () => {
  const view = squareView();
  const list = squareFilteredFlags();
  const fl = squareFilterLabel();
  const views = [
    { k: 'rec',     label: '推荐' },
    { k: 'follow',  label: '关注的人' },
    { k: 'recruit', label: '招募中' },
  ];
  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">
      ${navBig('广场', `<button class="nav-btn" data-act="openFilter">${ICON.filter}${fl ? `<span class="fp-badge">${fl}</span>` : ''}</button>`)}
    </div>

    <!-- ⚠️ 2026-11-24（本轮）：三个内容视图 ——
         推荐 = 广场推荐流；关注的人 = 我关注的人正在跑的局；招募中 = 正在招见证席的局。
         —— 为什么要「关注的人」这个视图：
            以前「关注」这个动作几乎没有落点 —— 关注了一个人之后，
            除了「我关注的人」列表，【没有任何地方能看到他的局】，点了等于没点。
            这个视图把那个承诺兑现出来。
         —— 「招募中」同理：见证席一直缺人，但招募中的局没有固定入口，
            只能靠刷推荐流碰运气。 -->
    <div class="seg sq-seg">
      ${views.map(v => `
      <button class="${view === v.k ? 'on' : ''}" data-act="setSquareView" data-view="${v.k}">${v.label}</button>`).join('')}
    </div>

    ${fl ? `
    <div class="sq-filterbar">
      <span>${ic('filter')}${fl}</span>
      <span class="sq-filterbar-x" data-act="clearSquareFilter">清除</span>
    </div>` : ''}

    ${list.length ? (view === 'recruit' ? `
    <!-- ⚠️ 2026-11-24（本轮）：「招募中」视图不走双列瀑布流，改成一列横条。
         理由见 recruitStrip() 的注释。 -->
    <div class="recruit-list">
      ${list.map(recruitStrip).join('')}
    </div>` : `
    <!-- 双列瀑布流（小红书式，见需求规格 R2.7）
         CSS Grid 2 列 + align-items:start —— 卡片高度各自独立不拉伸。
         封面固定 3:4、标题最多 2 行，所以两列高度天然接近瀑布流，
         且保持信息流「从左到右」的阅读顺序（CSS columns 会打乱顺序，不要用）。 -->
    <div class="feed-grid">
      ${list.map(f => feedCard(f)).join('')}
    </div>`) : `
    <div class="empty-hero" style="margin-top:10px">
      <div class="empty-ico">${ic(view === 'follow' ? 'users' : view === 'recruit' ? 'clipboard' : 'filter')}</div>
      <div class="empty-t">${view === 'follow' ? '你关注的人还没有在跑的局' : view === 'recruit' ? '暂时没有在招见证席的局' : '没有符合条件的 Flag'}</div>
      <div class="empty-s">${view === 'follow' ? '关注之后，他新开的局会出现在这里' : view === 'recruit' ? '有局在招人的时候会出现在这里' : '换个条件试试，或者清除筛选'}</div>
      ${fl ? `<button class="btn block" style="margin-top:18px" data-act="clearSquareFilter">清除筛选</button>`
           : `<button class="btn block" style="margin-top:18px" data-act="setSquareView" data-view="rec">回到推荐</button>`}
    </div>`}
  </div>
</div>`;
};

/* =========================================================
   5. 筛选 —— 半屏底部抽屉（不是独立页面）
   ⚠️ 用户口径（2026-11-22）：「不单独一个页面了，弄成半屏，
      从页面底部往上那种。」—— 筛选是【调节动作】，不是【目的地】。
      独立页面会让用户以为"进了另一个地方"，回退还得再点一次。
      半屏抽屉的好处：广场还在背景里，用户调完直接看结果。
   ========================================================= */
function filterPanel() {
  const f = STATE.sqFilter || { status: 'all', days: 'all', tier: 'all' };
  /* 「查看 N 个 Flag」上的 N 是实时算出来的 —— 以前这里是写死的「128」，
     跟广场里实际有多少个 Flag 没有任何关系（假数据）。 */
  const n = squareFilteredFlags().length;
  return `
    <div class="filter-panel">
      <div class="fp-sec">
        <div class="fp-t">状态</div>
        <div class="chips">
          <div class="chip ${f.status==='all'?'on':''}" data-fkey="status" data-fval="all">全部</div>
          <div class="chip ${f.status==='running'?'on':''}" data-fkey="status" data-fval="running">进行中</div>
          <div class="chip ${f.status==='ending'?'on':''}" data-fkey="status" data-fval="ending">即将结算</div>
          <div class="chip ${f.status==='broken'?'on':''}" data-fkey="status" data-fval="broken">已断卡</div>
          <div class="chip ${f.status==='ended'?'on':''}" data-fkey="status" data-fval="ended">已结束</div>
        </div>
      </div>

      <div class="fp-sec">
        <div class="fp-t">周期</div>
        <div class="chips">
          <div class="chip ${f.days==='all'?'on':''}" data-fkey="days" data-fval="all">全部</div>
          <div class="chip ${f.days==='7'?'on':''}" data-fkey="days" data-fval="7">7 天</div>
          <div class="chip ${f.days==='14'?'on':''}" data-fkey="days" data-fval="14">14 天</div>
          <div class="chip ${f.days==='30'?'on':''}" data-fkey="days" data-fval="30">30 天</div>
          <div class="chip ${f.days==='90'?'on':''}" data-fkey="days" data-fval="90">90 天</div>
        </div>
      </div>

      <div class="fp-sec">
        <div class="fp-t">见证席强度</div>
        <div class="fp-sub">${info('tierStrength','sm')} ${info('effectiveTier','sm')}</div>
        <div class="chips">
          <div class="chip ${f.tier==='all'?'on':''}" data-fkey="tier" data-fval="all">全部</div>
          <div class="chip ${f.tier==='T0'?'on':''}" data-fkey="tier" data-fval="T0">T0</div>
          <div class="chip ${f.tier==='T1'?'on':''}" data-fkey="tier" data-fval="T1">T1</div>
          <div class="chip ${f.tier==='T2'?'on':''}" data-fkey="tier" data-fval="T2">T2</div>
          <div class="chip ${f.tier==='T3'?'on':''}" data-fkey="tier" data-fval="T3">T3</div>
        </div>
      </div>

      <div class="fp-foot">
        <button class="btn ghost fp-clear" data-act="clearSquareFilter">清除条件</button>
        <button class="btn fp-cta" data-act="applyFilter">查看 ${n} 个 Flag</button>
      </div>
    </div>`;
}

/* =========================================================
   6. 发起页
   ------------------------------------------------------------
   ⚠️ 2026-11-24 用户口径（改）：【单页快速填写整块删除】。
      「当存在结算项目的时候，点击『首页』-『立一个 FLAG』，
        立 flag 的流程和正常的不一样了，你检查一下，弄错了吧？
        应该是分四个步骤引导的。不过没有 0 元选项。」

   —— 之前的分流是「第一次走分步、之后走单页」。那条规则已作废：
      走单页的那条路是【一屏堆 5 个区块】的老页面，和分步引导不是同一套流程 ——
      用户会以为自己立 flag 的方式变了。
   —— 现在【只有一条路】：① 立什么 → ② 立多久 → ③ 押多少 → ④ 交押金。
   —— ⚠️ 「没有 0 元选项」不是「去掉 0 元档」，而是「本来就该没有」：
      0 元档（首次免费）的判据是 isFirstFlag()（我发起的 Flag 数量 === 0）。
      有过结算项目的人不是第一个 Flag，0 元档本来就不会出现。
      —— 之前出问题正是因为走了单页：单页把押金档位硬编码了，
         绕过了 depositRange(..., isFirstFlag())。

   —— 这个路由保留下来只为【兼容旧链接 / 外部跳转】：直接转第 1 步。
   ========================================================= */
PAGES.create = () => {
  /* 一律走 4 步分步引导（见 createEntryRoute()）*/
  return PAGES.createGoal();
};

/* =========================================================
   6.5 立 Flag 分步引导（唯一路径）
   ------------------------------------------------------------
   4 步：① 立什么 → ② 立多久 → ③ 押多少 → ④ 交押金
   见证人不在这里选 —— 留到发起成功页的 24h 筹备期里慢慢找。
   每步只聚焦一件事，引导提示直白，尽量减少交互。
   ========================================================= */

/** 顶部 4 步进度条 */
function wizSteps(cur) {
  /* ⚠️ 2026-11-24（本轮）：从 4 步变 3 步 ——
     「押多少」和「交押金」合并成「确认并支付」（用户口径：
     「押多少、交押金两个页面内容重复了，我建议合并算了，
       把第四步取消，第三部直接『确认支付』。」） */
  const names = ['立什么', '立多久', '确认并支付'];  let html = '';
  names.forEach((n, i) => {
    const idx = i + 1;
    const cls = idx === cur ? 'on' : (idx < cur ? 'done' : '');
    if (i > 0) html += `<div class="wiz-bar ${idx <= cur ? 'done' : ''}"></div>`;
    html += `<div class="wiz-step"><div class="wiz-dot ${cls}">${idx < cur ? ICON.check : idx}</div></div>`;
  });
  return `<div class="wiz-steps">${html}</div>`;
}

/* ---------- ① 立什么 ---------- */
PAGES.createGoal = () => {
  const d = STATE.createDraft || {};
  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('① 立什么')}</div>
    ${wizSteps(1)}

    <div class="wiz-lead">
      <span style="flex:0 0 auto;margin-top:1px">${ic("target")}</span>
      <div>
        <span class="wl-t">你在立一个<b>可被公开验证的承诺</b></span>
        目标、周期、押金一经提交，<b>不再允许调整</b>。
      </div>
    </div>

    <div class="section">
      <div class="section-head"><div class="section-title">目标</div></div>
      <div class="field">
        <div class="field-label">一句话目标 <span class="req">*</span></div>
        <input class="input" id="cgTitle" placeholder="例如：婚礼前 30 天，瘦到能穿回那件西装"
          value="${(d.title || '').replace(/"/g, '&quot;')}">
        <div class="field-hint">目标将展示在广场。</div>
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <div class="section-title">体重</div>
      </div>
      <div class="wiz-2col">
        <div class="field">
          <div class="field-label">起始 (kg) <span class="req">*</span></div>
          <input class="input" type="number" id="cgStart" placeholder="68.4"
            value="${d.start || ''}">
        </div>
        <div class="field">
          <div class="field-label">目标 (kg) <span class="req">*</span></div>
          <input class="input" type="number" id="cgTarget" placeholder="63.4"
            value="${d.target || ''}">
        </div>
      </div>
    </div>

    <div class="sticky-cta wiz-cta">
      <button class="btn block" data-act="nextCreateGoal">下一步：立多久</button>
    </div>
  </div>
</div>`;
};

/* ---------- ② 立多久 ---------- */
PAGES.createPeriod = () => {
  const d = STATE.createDraft || {};
  const days = selPeriod();
  const allowed = allowedPeriods(STATE.credit);
  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('② 立多久')}</div>
    ${wizSteps(2)}

    <div class="wiz-lead wiz-lead-1line">
      <span style="flex:0 0 auto;margin-top:1px">${ic("calendar")}</span>
      <div>
        <span class="wl-t">周期决定这局有多重</span>
        <span class="wl-1line">周期越长，<b>押金要求越高</b>，完成后<b>增加的信用分越多</b>。</span>
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <div class="section-title">选一个周期</div>
        <!-- ⚠️ 2026-11-24：单页发起页删除后，safeStop 问号挂到第 2 步 ——
             它的正文讲【安全减重须知】（禁止行为 + 只有两个结局），
             放在选周期这一页最对得上。第 1 步不放（那边只做纯填表）。 -->
        <div class="section-sub">${info('createPeriod','sm')} ${info('safeStop','sm')}</div>
      </div>
      <div class="opt-grid">
        ${[7,14,30,90].map(p => {
          const r = depositRange(STATE.credit, p);
          const locked = !r.allowed;
          const reason = locked ? '信用分不够' : `${r.min}–${r.max} 元`;
          return `
        <div class="opt-card ${days===p?'on':''} ${locked?'locked':''}" data-period="${locked?'':p}" ${locked?'data-locked="1"':''}>
          <div class="o-t">${p} 天</div>
          <div class="o-s">${reason}</div>
        </div>`;
        }).join('')}
      </div>

      <div class="note brand" style="margin-top:12px;display:flex;gap:9px;align-items:flex-start">
        <span style="flex:0 0 auto;margin-top:1px">${ic("shield")}</span>
        <div style="flex:1">
          <b>${days} 天周期可以断卡 ${breakLimitOf(days)} 次</b>
          <br>断卡 = 当天没打卡，12 小时内没补卡。
        </div>
      </div>

      <div class="field-hint" style="margin-top:10px">
        以你现在的信用分（${STATE.credit} 分），能立的最长周期是 <b>${Math.max(...allowed)} 天</b>。
      </div>
    </div>

    <div class="sticky-cta wiz-cta">
      <button class="btn block" data-act="nextCreatePeriod">下一步：押多少</button>
    </div>
  </div>
</div>`;
};

/* ---------- ③ 确认并支付（唯一的一步，取代原来的第 3 步 + 第 4 步） ----------
   ⚠️ 2026-11-24（本轮）：第 3 步「押多少」和第 4 步「交押金」合并成一步 ——
   —— 用户口径：「押多少、交押金两个页面内容重复了，我建议合并算了，
      把第四步取消，第三部直接『确认支付』。把第四步的打钩确认放到第三步里。」
   —— 原来第 4 步的账目汇总（目标 / 周期 / 押金 / 挣了 / 亏了）
      是把第 3 步刚算过的数**又列一遍** —— 两屏说同一件事 = 一屏是废话。
   —— 现在这一屏干四件事：
      ① 选押金档位
      ② 「失败你会实际损失」那张卡 —— 里面同时装着这一局的账目
         （用户口径：「放到实际你会损失这个卡片里，原来的内容不要了」）
      ③ 支付方式（从第 4 步搬过来）
      ④ 打钩确认 + 「确认支付」按钮（从第 4 步搬过来）
   —— 点「确认支付」弹二次确认（app.js 的 confirmPayAndSubmit），
      弹窗里说清「承诺公开生效 / 24 小时找见证人 / 见证人不影响目标达成」。
   ============================================================ */
PAGES.createDeposit = () => {
  const d = STATE.createDraft || {};
  const ct = creditTierOf(STATE.credit);
  const days = selPeriod();
  const dr = depositRange(STATE.credit, days, isFirstFlag());
  const depSel = selDeposit();
  /* ⚠️ 首次免费（押金 0 元）：没有押金可赔，但照常加分 —— 这一栏要整体改口径 */
  const isZero = depSel === 0;
  const loss = isZero ? 0 : Math.round(depSel * ct.rate / 100);
  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('③ 确认并支付', `<button class="nav-btn" data-info="deposit">?</button>`)}</div>
    ${wizSteps(3)}

    <div class="wiz-lead">
      <span style="flex:0 0 auto;margin-top:1px">${ic("wallet")}</span>
      <div>
        <span class="wl-t">押的不是钱，是对那个更好的自己的承诺</span>
        ${isZero
          ? `你的第一个 Flag —— 押金 <b>0 元</b>，照常加分，只有一次。`
          : `完成目标，押金 <b>100% 退还</b>。失败按信用比例扣收。`}
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <div class="section-title">选一个档位</div>
        <!-- ⚠️ 2026-11-24（本轮）：旧的「选择押金」页删掉后，
             「押金区间怎么算」和「失败实际损失怎么算」两个说明弹层就没人引用了 ——
             它们讲的正是这一屏要说的事，所以挂回这一屏的标题旁。 -->
        <div class="section-sub">${info('depositFormula','sm')} ${info('lossCalc','sm')}</div>
      </div>
      <div>
        ${depGrid(dr, depSel)}
      </div>
    </div>

    <!-- ⚠️ 2026-11-24（本轮）：这一块现在是【失败实际损失】卡 ——
         用户口径：
           ① 标题栏已经有「失败你会损失」，卡片内重复的「失败实际损失」删掉
           ② 卡片内「175 元」「信用 60 分」「普通失败扣 35」等文字**居中对齐**
           ③ 顶部保留「完成目标押金百分百退还，失败按信用比例扣收」，
              删掉「你现在 60 分普通扣 35」这类重复说明
           ⑤ **「目标周期、押金、挣了 / 亏了」这一整块删掉** ——
              顶部 wiz-lead 已经说了「完成目标押金 100% 退还」，
              档位区已经显示了押金数额，这里再列一遍是第三次重复。
         —— 所以账目汇总那块（.card.flat）整块删掉，
            剩下的只有一张居中的「你会损失多少」卡。 -->
    <div class="section">
      <div class="section-head">
        <div class="section-title">${isZero ? '首次免费 · 这一局怎么算' : '失败你会损失'}</div>
        <div class="section-sub">${info('createDeposit','sm')}</div>
      </div>
      ${isZero ? `
      <!-- ⚠️ 2026-11-25（本轮，用户口径）：0 元档这张卡**文案结构与有金额的版本一致** ——
           —— 把数字换成 0 元、副标题换成信用信息，整段说明文字全部删掉。
              之前是「薄荷绿 + 一大段说明」，读起来太啰嗦、也没说清 0 元在信用分体系里的位置。
           —— 但**卡片颜色保持原来的薄荷绿**（用户口径：「卡片颜色换了，文案不换」）：
              绿色 = 这一局照常加分、是一次性新人礼，与橙色（要真金白银押钱）区分开。
              只有文案结构对齐有金额的版本，**颜色不变**。 -->
      <div class="vault vault-center zero-vault">
        <div class="v-amount loss">0 <span style="font-size:15px;font-weight:600;opacity:.85">元</span></div>
        <div class="v-sub">信用 ${STATE.credit} 分 · ${ct.name} · 失败扣收 ${ct.rate}%</div>
      </div>` : `
      <div class="vault vault-center">
        <div class="v-amount loss">${loss} <span style="font-size:15px;font-weight:600;opacity:.85">元</span></div>
        <div class="v-sub">信用 ${STATE.credit} 分 · ${ct.name} · 失败扣收 ${ct.rate}%</div>
      </div>`}
    </div>

    ${isZero ? '' : `
    <div class="section">
      <div class="section-head">
        <div class="section-title">支付方式</div>
        <!-- ⚠️ 2026-11-24（本轮）：押金相关条款移进这个问号里（原第 4 步） -->
        <div class="section-sub">${info('compliance','sm')}</div>
      </div>
      <div class="list">
        <div class="row"><div class="row-icon">${ic("wechat")}</div><div class="row-main">
          <div class="row-title">微信支付</div></div>
          <span style="color:var(--brand);font-weight:700">${ICON.check}</span></div>
      </div>
    </div>`}

    <!-- 打钩确认 —— 从原第 4 步搬过来。
         ⚠️ 合规要求：不可逆后果告知必须【读到才有效】，
            所以没打钩时支付按钮是灰的、点不动。
            载体从第 4 步挪到第 3 步，原则没变。 -->
    <label class="check ${d.agreedPay?'on':''}" data-check="createDeposit" style="margin-top:14px">
      <span class="box">${ICON.check}</span>
      <span>${isZero
        ? `我已知晓<b>这是我的第一个 Flag，押金 0 元（仅此一次）</b>，并理解承诺<b>同样公开生效、同样不能改目标、不能改周期</b>，且<b>这一局照常产生信用分</b>。`
        : `我已知晓<b>押金一经支付，目标任务完成前不退还</b>，并理解交押金后<b>不能改目标、不能改周期</b>。`}</span>
    </label>

    <div class="sticky-cta wiz-cta">
      <button class="btn block ${d.agreedPay?'':'disabled'}" data-act="confirmPayAndSubmit">确认支付${isZero ? '' : ` ¥${depSel}.00`}</button>
    </div>
  </div>
</div>`;
};

/* =========================================================
   7. 发起成功（立据）
   ========================================================= */
PAGES.created = (id) => {
  const f = findFlag(id) || myMainFlag() || FLAGS.f_own;
  const accepted = witnessAccepted(f.witnesses || []);
  const pending = (f.witnesses || []).filter(w => w.status === 'pending').length;
  const tier = tierByCount(accepted);
  /* ⚠️ 2026-11-22 用户口径（改）：召集令不再跳独立页面 ——
     「发布见证席召集令」就地发布，按钮变「见证席召集令已发布」，
     再点它从底部升起半屏看报名情况（见 R5.6）。 */
  const recruitOn = !!STATE.recruitPublished;
  const applicants = recruitApplicants();
  const appCount = applicants.filter(a => a.status !== 'declined').length;
  const acceptedCount = applicants.filter(a => a.status === 'accepted').length;
  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('发起成功')}</div>

    <!-- ① 立据 —— 发起成功的第一屏就是承诺本身（见 D10.3.3） -->
    <div class="created-hero">
      <div class="created-hero-t">你的承诺已经立下</div>
      <div class="created-hero-s">${f.startWeight}kg → ${f.targetWeight}kg / ${f.days} 天 · ${isZeroDepositFlag(f) ? '首次免费 · 押金 0 元' : `押金 ${f.deposit} 元已交`}</div>
    </div>

    <div class="voucher">
      <!-- ⚠️ 2026-11-22 用户口径：「立据 · 编号 A7K3M9 居中。」 -->
      <div class="v-no center">立据 · 编号 A7K3M9</div>
      <div class="v-line"></div>
      <div class="v-kv"><span class="v-k">发起人</span><span class="v-v">${ME.name}</span></div>
      <div class="v-kv"><span class="v-k">体重目标</span><span class="v-v">${f.startWeight}kg → ${f.targetWeight}kg / ${f.days} 天</span></div>
      <div class="v-kv"><span class="v-k">监督席</span><span class="v-v">开放</span></div>
      <div class="v-kv"><span class="v-k">押金</span><span class="v-v">${isZeroDepositFlag(f) ? '0 元（首次免费）' : `${f.deposit} 元（已支付）`}</span></div>
      <div class="v-line"></div>
      <div class="v-kv"><span class="v-k">立据时间</span><span class="v-v">${fmtStamp(f.createdAt, f.start)}</span></div>
      <!-- 立据的意义：这是一份邀请，不只是一张凭证（见 D10.3.3） -->
      <div class="v-invite">
        <!-- ⚠️ 2026-11-22 用户口径：「邀请你成为我的见证 居中。」 -->
        <div class="v-invite-t center">邀请你成为我的见证</div>
        <div class="v-invite-d">我在「押了」立下 ${f.days} 天目标，${isZeroDepositFlag(f) ? '押金 0 元' : `${f.deposit} 元`}作为赌注。<br>诚邀你来当见证官，到点监督我是否达标。<br>扫码就位，一起看看我能不能守住这笔押金。</div>
      </div>
      <div class="v-qr">
        <img class="v-qr-img" src="assets/qr_voucher.png" alt="扫码成为见证人">
        <div class="v-qr-cap">扫码见证</div>
      </div>
      <div class="v-foot">「这张图是承诺的开始，${f.days} 天后，这里会有结局。」</div>
    </div>

    <!-- 分享紧跟立据 —— 这张图本身就是邀请函（见 D10.3.3） -->
    <button class="btn block mt" data-act="openShareChannels">${ic("upload")} 分享出去</button>

    <!-- ② 筹备期倒计时 —— 真实时钟，逐秒递减（见 D10.3.3） -->
    <div class="prep-timer" data-prep-timer data-prep-end="${f.prepEndAt || 0}">
      <div class="pt-label">筹备期剩余</div>
      <div class="pt-clock" data-prep-clock>--:--:--</div>
      <div class="pt-note">筹备期是 <b>24 小时</b> —— 目标、周期、押金都已锁定，这段时间你只能专心<b>找见证人</b>。${info('prepPeriod','sm')}</div>
    </div>

    <div class="card mt" style="padding:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:15px;font-weight:650">见证席</div>
        <span class="tag brand lg">${tier}${info('tierStrength','sm')}</span>
      </div>
      <div class="bar" style="margin-bottom:8px"><i style="width:${Math.min(100, accepted / WITNESS_MAX * 100)}%"></i></div>
      <div class="field-hint" style="margin:0">
        <b>已接受 ${accepted} 位</b>${pending ? ` · 待接受 ${pending} 位` : ''} · 已占 ${witnessSlots(f.witnesses || [])}/${WITNESS_MAX}
        <br>档位按<b>已接受</b>的人数定 —— 待接受的邀约不计入。
      </div>
      ${accepted === 0 ? `
      <!-- ⚠️ 2026-11-23 用户口径（改）：这一整块原本是 4 句 60 多字
           （现状说明 + T0 档位说明 + 24 小时慢慢找 + 档位越高越好）
           现在只剩一句「见证人越多，信用分系数越高」——
           「0 人也能跑」由旁边的 T0 格 + 强度弹层表达，不靠这句话说。 -->
      <div class="note amber mt" style="display:flex;gap:8px;align-items:flex-start;margin-bottom:10px">
        <span style="flex:0 0 auto">${ic("users")}</span>
        <div style="flex:1">
          <b>见证人越多，信用分系数越高。</b>
        </div>
      </div>` : ''}
      <!-- ⚠️ 2026-11-22 用户口径（改）：召集令就地发布，不跳独立页面 -->
      ${recruitOn ? `
      <button class="btn ghost block sm mt" data-act="openRecruitSheet">${ic("megaphone")} 见证席召集令已发布${appCount ? ` · ${appCount} 人报名` : ''}</button>
      ` : `
      <button class="btn ghost block sm mt" data-act="publishRecruit">${ic("megaphone")} 发布见证席召集令${info('recruit','sm')}</button>
      `}
      <button class="btn ghost block sm mt" data-go="witnessPool">${ic("users")} 从见证席候选池选</button>
    </div>

    <div class="sticky-cta">
      <!-- ⚠️ 2026-11-23 用户口径（改）：「发起成功以后，点击『进入我的 flag』应该是进入首页」
         —— 筹备期里首页才是操作台（倒计时 + 招人），目标详情页这时候还不能打卡。 -->
      <button class="btn block" data-go="home">进入首页</button>
    </div>
  </div>
</div>`;
};

/* =========================================================
   8. 打卡页
   ========================================================= */

/**
 * 补充照片区块（见需求规格 R2.6）
 * ⚠️ 这是【内容】，不是【物证】——
 *   - 打卡照（秤读数 + 手写随机词）是物证，缺了不能打卡
 *   - 补充照是给广场看的封面/生活照，可传可不传，不影响打卡
 * 上传动作独立于打卡按钮 —— 传完再打卡、或者打卡完再回来传，都行。
 */
/* =========================================================
   打卡照片区（物证）—— 见需求规格 R2.8
   ⚠️ 打卡照是【必填】—— 没拍就不能提交打卡。
      补充照（内容）再多也不能替代它。
   ========================================================= */
function checkinPhotoBlock(f) {
  const shot = pendingCheckinShot();
  const shotSrc = shot && shot.src ? shot.src : null;
  return `
<div class="ci-shot">
  ${shotSrc
    ? `<img class="ci-shot-img" src="${shotSrc}" alt="今日打卡照片">
       <button class="ci-shot-retake" data-act="takeCheckinShot">${ic('camera')} 重拍</button>`
    : `<button class="ci-shot-empty" data-act="takeCheckinShot">
         <span class="ci-shot-ico">${ic('camera')}</span>
         <span class="ci-shot-t">点击拍照</span>
         <span class="ci-shot-s">拍完才能提交打卡</span>
       </button>`}
</div>`;
}

/* =========================================================
   补充照片（生活照）区块 —— 见需求规格 R2.6 / R2.8
   ⚠️ 设计简化（2026-11-21）：删掉说明文案卡、说明条、
      「现拍/相册」两个按钮 —— 只留一排缩略图 + 「+」号框。
      点「+」号框就是拍照（真实环境走 takePhoto，demo 里是占位）。
   ========================================================= */
function extraPhotoBlock(f) {
  const list = pendingExtraPhotos();
  const left = MAX_EXTRA_PHOTOS - list.length;
  return `
<div class="ex-grid">
  ${list.map((x, i) => `
    <div class="ex-cell ${i===0?'cover':''}">
      <img src="${x.src}" alt="补充照片 ${i+1}">
      ${i===0 ? '<i class="ex-badge">封面</i>' : ''}
      ${i>0 ? `<button class="ex-set" data-act="setCoverPhoto" data-slot="${x.slot}">设为封面</button>` : ''}
      <button class="ex-del" data-act="rmExtraPhoto" data-slot="${x.slot}" aria-label="删除">${ic('close')}</button>
    </div>`).join('')}
  ${left > 0 ? `
    <button class="ex-add" data-act="addExtraPhoto" aria-label="加一张">
      ${ic('plus')}
    </button>` : ''}
</div>`;
}

PAGES.checkin = (id) => {
  const f = findFlag(id) || myMainFlag() || FLAGS.f_own;
  const shotReady = hasCheckinShot();
  /* ⚠️ 2026-11-24（本轮，用户口径 Part 二②）：**补卡复用今日打卡页** ——
     —— 用户口径：「补卡功能保留；点击补卡进入的页面内容与今日打卡完全一致，
        区别仅在于打卡对象是昨天的卡（今日打卡打当天，补卡打前一天）。」
     —— 所以这一页有两个【模式】：
        · checkin（默认）—— 打今天的卡
        · makeup         —— 打昨天（漏掉的那天）的卡
        两种模式的**页面结构完全一样**：随机词 → 物证照片 → 打卡说明 →
        心情 / 体悟 → 生活照 → 提交按钮。
        **唯一的差别**是：
          ① 导航栏标题（今日打卡 / 补昨天的卡）
          ② 提交按钮的文案与它打的是哪一天
          ③ 顶部一行提示：这是补的那一天
     —— 为什么必须做成「同一页的两种模式」而不是两套页面：
        补卡要拍物证、要写心情、要传生活照 —— 这些**逐条都跟打卡一样**。
        做成两套页面，两套页面就会慢慢分叉（补卡页少传一张照片之类），
        而用户要的就是「跟打卡一模一样，只是日期不同」。
     —— ⚠️ 2026-11-24（本轮修复）：同一天不能重复打卡 ——
     原来这一页【不管来没来过】都渲染成「拍照 → 提交打卡」，
     用户可以打卡 → 返回 → 再进 → 再提交，checkedDays 会 +2。
     —— 现在今天已经打过卡时，这一页改成【已打卡状态】：
        不再显示随机词与物证区，底部按钮指向今天的打卡记录。
        （补卡模式**不受**这个拦截 —— 今天打了卡，正好可以补昨天那张。） */
  const makeup = isMakeupMode();
  const doneToday = checkedToday(f) && !makeup;
  if (doneToday) {
    return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('今日打卡', `<span class="tiny muted">第 ${f.totalDays - daysLeft(f)} 天</span>`)}</div>

    <div class="card mt" style="display:flex;align-items:center;gap:13px;padding:16px">
      <div style="width:44px;height:44px;border-radius:14px;background:var(--mint-tint);display:flex;align-items:center;justify-content:center;color:#3F7A58;flex:0 0 44px">
        ${ic('checkCircle')}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:15.5px;font-weight:650">今天已经打过卡了</div>
        <div style="font-size:12px;color:var(--ink-3);margin-top:2px">连续 ${f.streak} 天 · 第 ${f.totalDays - daysLeft(f)} / ${f.totalDays} 天</div>
      </div>
    </div>

    <div class="note sky" style="margin-top:12px">
      <b>一天只能打一次卡。</b><br>
      今天这一张已经记上了 —— 明天再来打下一张。
      ${info('breakRules','sm')}
    </div>

    <div class="section">
      <div class="section-head">
        <div class="section-title">打卡记录</div>
      </div>
      <div class="list">
        <div class="row tap" data-go="checkinLog" data-id="${f.id}">
          <div class="row-main">
            <div class="row-title">看全部打卡历史</div>
            <div class="row-sub">每天的体重、照片、物证校验</div>
          </div>
          <span class="row-arrow">${ICON.chevR}</span>
        </div>
      </div>
    </div>

    <div class="sticky-cta">
      <button class="btn block ghost" data-go="checkinLog" data-id="${f.id}">看打卡记录</button>
    </div>
  </div>
</div>`;
  }
  /* 补卡模式：要补的是哪一天 */
  const mw = makeupWindow(f);
  const mkDay = checkinTargetDay(f);
  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow(
      makeup ? '补昨天的卡' : '今日打卡',
      `<span class="tiny muted">${makeup ? `补第 ${mkDay} 天` : `第 ${f.totalDays - daysLeft(f)} 天`}</span>`)}</div>

    <!-- ⚠️ 2026-11-24（本轮）：补卡模式顶部的一行提示 ——
         —— 补卡页和打卡页**内容完全一致**，唯一必须让用户知道的是
            「这一张是补哪一天的」—— 不然他会以为自己在重打今天的卡。 -->
    ${makeup ? `
    <div class="card flat mt" style="background:var(--amber-tint);border-color:rgba(169,113,8,.18)">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="flex:0 0 auto">${ic('clock')}</span>
        <div style="flex:1;font-size:12.5px;color:var(--ink-2);line-height:1.6">
          正在<b>补 ${mw.missedOn ? shortDate(mw.missedOn) : '昨天'}</b> 的卡 —— 内容和今天打卡完全一样。
        </div>
      </div>
    </div>` : ''}

    <!-- ============ 打卡照（物证）：必填 ============
         ⚠️ 2026-11-21 简化（见 R2.8）：打卡照两项清单与校验说明都收进下面的折叠区，
            照片公开提示与拍照避人提示已删。 -->
    <div class="ci-hero">
      <div class="ci-hero-tag">${makeup ? '补卡随机词' : '今日随机词'}</div>
      <div class="ci-hero-word">青柑</div>

      <!-- 打卡照（物证）：拍完才能提交 -->
      ${checkinPhotoBlock(f)}

      <!-- 打卡说明：点开看拍照要求 -->
      ${fold('打卡说明', `
        <div class="ci-guide">
          <div class="ci-guide-row">
            <div class="ci-guide-ico">${ic('scale2')}</div>
            <div>
              <div class="ci-guide-t">体重秤</div>
              <div class="ci-guide-s">拍到秤上的读数</div>
            </div>
          </div>
          <div class="ci-guide-row">
            <div class="ci-guide-ico">${ic('pencil')}</div>
            <div>
              <div class="ci-guide-t">手写随机词</div>
              <div class="ci-guide-s">把今天的随机词手写在纸上，一起拍进去</div>
            </div>
          </div>
        </div>`, 'ciGuide')}
    </div>

    <!-- ============ 心情 / 体悟：可选，最多 15 字 ============
         ⚠️ 2026-11-23 用户口径（改）：两处调整 ——
            ① 「今天的心情 / 体悟」要排在「生活照（可选）」【上面】（先写字，再传图）
            ② 提示语末尾那句关于围观者可见性的说明删掉，只留前半句
         —— 打卡照是【物证】，这句话是【内容】—— 两者不互相替代
         ⚠️ 字数硬上限 15 字 —— 超了不收（见需求规格 R2.11）。 -->
    <div class="section">
      <div class="section-head">
        <div class="section-title">今天的心情 / 体悟</div>
        <!-- ⚠️ 2026-11-24（本轮）：字数计数器从【标题旁】移到【输入框下方】——
             用户还没开始打字，标题旁就挂一个「0 / 15」，是个"你还没做"的红牌，
             而且摆在最显眼的位置。真实产品都放在输入框右下角。 -->
      </div>
      <div class="card">
        <textarea class="note-input" id="checkinNote" maxlength="${CHECKIN_NOTE_MAX}"
          placeholder="例：今天没吃夜宵，坚持第 23 天"
          rows="2">${pendingCheckinNote()}</textarea>
        <div class="note-foot">
          <!-- ⚠️ 2026-11-24（本轮，用户口径 Part 六①）：删掉
               「可选 —— 打卡照是物证，这句话是你的心情。」
               —— 原因：这一栏已经写了标题「今天的心情 / 体悟」，
                  「可选」两个字是多余的强调，
                  而「打卡照是物证」是**规则**（讲拍照那一栏的事），
                  放在这里等于**第三次**说同一件事。
               —— 现在只留字数计数器（放在输入框右下角）。 -->
          <span class="note-count"><span id="noteCount">${pendingCheckinNote().length}</span> / ${CHECKIN_NOTE_MAX}</span>
        </div>
      </div>
    </div>

    <!-- ============ 补充照片（生活照）：可选，最多 3 张 ============
         ⚠️ 与打卡照是两件事：
           - 打卡照 = 物证，【必须拍】，缺了不能提交打卡
           - 补充照 = 内容，自己挑，可传可不传，【不影响打卡】
         ⚠️ 2026-11-23 用户口径：生活照排在心情/体悟【下面】。
         设计简化：一排缩略图 + 「+」号框，点「+」号框就拍照（见 R2.8）。 -->
    <div class="section">
      <div class="section-head">
        <div class="section-title">生活照（可选）</div>
        <div class="section-sub">${pendingExtraPhotos().length} / ${MAX_EXTRA_PHOTOS}</div>
      </div>
      ${extraPhotoBlock(f)}
    </div>

    <!-- ⚠️ 2026-11-24（本轮，用户口径 Part 二①）：补卡提示小卡片**整个删掉** ——
         —— 用户口径：「今日打卡页面内『昨天忘了打卡，12 小时内可以补上昨天的卡』
            这张提示卡片删除，不再展示。」
         —— 原因：这一屏**就是**补卡页本身（补卡复用今日打卡页），
            再挂一张「要不要补」的提示卡 = 在补卡页上催你补卡。
         —— 而且首页已经有那张补卡提醒卡（「11 月 15 日 没打卡 · 补卡」+ 倒计时），
            同一件事在两个地方各说一遍 = 冗余。
         —— 入口改到【首页的补卡提醒卡】上（见 R2.29 那一轮加的 data-makeup-btn）。 -->

    <div class="sticky-cta">
      <button class="btn block ${shotReady ? '' : 'disabled'}" data-act="${makeup ? 'doMakeupCheckin' : 'doCheckin'}" ${shotReady ? '' : 'disabled'}>
        ${makeup
          ? (shotReady ? '补上这张卡' : '先拍张照才能补卡')
          : (shotReady ? '提交打卡' : '先拍张照才能打卡')}
      </button>
    </div>
  </div>
</div>`;
};

PAGES.checkinDone = (id) => {
  const f = findFlag(id) || myMainFlag() || FLAGS.f_own;
  const chg = (f.startWeight - f.curWeight).toFixed(1);
  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('打卡成功')}</div>

    <div style="text-align:center;padding:44px 20px 30px">
      <div style="width:76px;height:76px;border-radius:50%;background:var(--mint-tint);display:flex;align-items:center;justify-content:center;margin:0 auto;color:#3F7A58">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L19 7"/></svg>
      </div>
      <div style="font-size:22px;font-weight:730;margin-top:14px;letter-spacing:-.4px">打卡成功</div>
      <div style="font-size:13.5px;color:var(--ink-3);margin-top:4px">连续打卡 ${f.streak} 天${f.justMilestone ? ' · 信用分 +1' : ''}</div>
    </div>

    <div class="tiles">
      ${tile(f.curWeight, '今日体重 kg')}
      ${tile(chg, '累计变化 kg', 'brand')}
      ${tile(`${f.checkedDays}/${f.totalDays}`, '打卡天数')}
    </div>

    <!-- ⚠️ 2026-11-24（本轮）：「刚刚也发了的人」改用【真实数据】——
         原来写死三个人名和体重（阿May 56.1kg / 小美 67.4kg / 阿凯 64.6kg），
         而且每行点不动 —— 56.1 / 67.4 恰好是用户前面明确删掉的数字。
         —— 现在扫【所有别人的局】，挑出社区里最近刚打卡的那几个：
            天数、体重都是从那个局的打卡记录里读出来的（跟日历同一份数据），
            每一行都能点进那个人的目标详情页。
         —— 没有真实数据时这一整块不显示 —— 空列表比假数据诚实。 -->
    ${(() => {
      const others = recentCheckinFeed(3);
      if (!others.length) return '';
      return `
    <div class="section">
      <div class="section-head"><div class="section-title">刚刚也发了的人</div></div>
      <div class="list">
        ${others.map(o => `
        <div class="row tap" data-go="flagDetail" data-id="${o.id}">
          ${ava(o.name, 'sm')}
          <div class="row-main">
            <div class="row-title">${o.name} 刚打卡</div>
            <div class="row-sub">第 ${o.day} 天${o.weight != null ? ` · ${o.weight}kg` : ''}</div>
          </div>
          <span class="row-arrow">${ICON.chevR}</span>
        </div>`).join('')}
      </div>
    </div>`;
    })()}

    <div class="sticky-cta">
      <button class="btn block" data-go="home">回到首页</button>
    </div>
  </div>
</div>`;
};

/* =========================================================
   9. 打卡历史
   ========================================================= */
PAGES.checkinLog = (id) => {
  /* ⚠️ 2026-11-24 用户口径：「『亏了』详情页也是，应该是部分打卡了，
     那些『今日打卡』、『打卡历史』怎么还会有呢？」
     —— 已结算的局：打卡历史【仍然要看得到】（那是这一局留下的记录），
        但页面不能再说「还没有打卡记录 / 现在去打第一次卡」。
     —— 所以带 id 进来（从已结算的详情页点进来）时，
        日历按这一局渲染，最近记录用 photosOf 反推。 */
  const f = (id && findFlag(id)) || myMainFlag() || FLAGS.f_own;
  const settled = f.status === 'success' || f.status === 'failed' || f.status === 'broken';
  const cells = calCalendar(f);
  const logs = logsOf(f.id);
  /* 已结算的局没有 checkinLogs（那是实时打卡时写的）——
     用 photosOf 反推一份「这一局每天的打卡记录」。 */
  const derived = settled ? photosOf(f).slice().reverse().map(p => ({
    d: p.d, date: '', w: p.w, state: p.st === 'miss' ? 'miss' : 'done',
    ai: p.st === 'miss' ? '未打卡' : (p.st === 'makeup' ? '补卡通过' : '查重通过'),
  })) : [];
  const rows = logs.length ? logs.slice().reverse() : derived;
  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('打卡历史')}</div>

    <div class="card">
      <div class="bar-row" style="margin-bottom:11px">
        <span style="color:var(--ink);font-weight:600">${f.start ? f.start.slice(0,7) : ''} – ${f.end ? f.end.slice(0,7) : ''}</span>
        <span>${f.checkedDays} / ${f.totalDays} 天</span>
      </div>
      <div class="cal">
        ${['日','一','二','三','四','五','六'].map(d => `<div class="cal-h">${d}</div>`).join('')}
        ${cells.map(c => c.t === 'pad' ? '<div></div>'
          : `<div class="cal-d ${c.st} ${c.today?'today':''}" data-go="checkinLogItem" data-id="${f.id}" data-day="${c.d}">${c.d}</div>`).join('')}
      </div>
      <div class="cal-legend">
        <span><i style="background:var(--brand-tint)"></i>已打卡</span>
        <span><i style="background:var(--rose-tint)"></i>断卡</span>
        <span><i style="background:var(--amber-tint)"></i>补卡</span>
        <span><i style="background:var(--surface-2)"></i>未打卡</span>
      </div>
    </div>

    <div class="section">
      <div class="section-head"><div class="section-title">最近记录</div></div>
      ${rows.length ? `
      <div class="list">
        ${rows.slice(0,10).map(l => `
        <div class="row tap" data-go="checkinLogItem" data-id="${f.id}" data-day="${l.d}">
          <div class="row-icon" style="background:${l.state==='done'?'var(--mint-tint)':'var(--rose-tint)'};color:${l.state==='done'?'#0B7C4B':'#C4373C'}">
            ${l.state==='done'?ICON.check:ic("close")}</div>
          <div class="row-main">
            <div class="row-title">第 ${l.d} 天 · ${l.w ? l.w+' kg' : '未打卡'}</div>
            <div class="row-sub">${l.date}${l.node?' · '+l.node:''} · ${l.ai}</div>
          </div>
          <span class="row-arrow">${ICON.chevR}</span>
        </div>`).join('')}
      </div>` : `
      <div class="card" style="text-align:center;padding:28px 20px">
        <div style="width:50px;height:50px;border-radius:16px;margin:0 auto 12px;background:var(--mint-tint);color:#0B7C4B;display:flex;align-items:center;justify-content:center">
          ${ic("calendar")}
        </div>
        <div style="font-size:15px;font-weight:680">还没有打卡记录</div>
        <div style="font-size:12.5px;color:var(--ink-3);margin-top:6px">第一次打卡完成后，记录会出现在这里</div>
        <button class="btn sm" style="margin-top:16px" data-go="checkin" data-id="${f.id}">现在去打第一次卡</button>
      </div>`}
    </div>

    <div class="note mt">
      <b>记录只追加</b> —— 写入后不提供编辑接口。纠错走「作废并重打」并留痕。
      ${info('antiCheat','sm')}
    </div>
  </div>
</div>`;
};

/* =========================================================
   10. 目标详情
   ========================================================= */

/* -------------------------------------------------------------
   照片区块（围观者前置用）—— 见需求规格 R2.9
   ⚠️ 2026-11-21 新增：「我的 Flag」和「别人的 Flag」是两个不同的页面。
      - 本人：状态在前（还剩几天 / 能不能断卡），照片在后
      - 围观者：照片在前 —— 广场用封面把内容前置了，详情页也要跟上
   两个视图共用下面这几个函数，保证内容一致、只是顺序不同。
   ------------------------------------------------------------- */

/** 生活照画廊 —— 围观者版第一张当大图首屏（对齐广场封面 3:4） */
function lifePhotosBlock(f, big) {
  const ex = extraPhotosOf(f);
  if (!ex.length) return '';
  return `
  <div class="ex-gallery ${big ? 'big' : ''}">
    ${ex.map((x, i) => `
      <div class="eg-cell ${i===0?'cover':''}"
           ${i===0 ? `data-act="openPhoto" data-id="${f.id}" data-kind="life" data-src="${x.src}" data-idx="0"` : ''}>
        <img src="${x.src}" alt="生活照 ${i+1}" loading="lazy">
        ${i===0 ? '<i class="eg-badge">封面</i>' : ''}
      </div>`).join('')}
  </div>`;
}

/** 打卡照片条（围观者版）—— 横向可滑，**点格子进打卡详情页**
 *  ⚠️ 2026-11-21 用户口径：「然后才是打卡照片 · 平台内公开，
 *     能左右滑动选择具体某一天。**点击以后，可以进入到打卡详情页。**」
 *     —— 围观者点某一天 = 直接进那一天的【打卡详情页】，不是图片查看器。
 *     图片查看器只留给顶部的「今天的照片」缩略图行。 */
function photoStripBlock(f, photos, big) {
  const list = photos.filter(x => x.src);
  if (!list.length) return '';
  const strip = list.slice().reverse();
  const cls = big ? 'photo-strip big' : 'photo-strip';
  return `
  <div class="${cls}">
    ${strip.map(x => `
      <div class="ps-cell ${x.st==='miss'?'miss':''} ${x.st==='makeup'?'makeup':''}"
           ${big
             ? `data-go="checkinLogItem" data-id="${f.id}" data-day="${x.d}"`
             : `data-go="checkinLogItem" data-id="${f.id}" data-day="${x.d}"`}>
        <img src="${x.src}" alt="第 ${x.d} 天打卡" loading="lazy">
        ${x.st==='makeup' ? '<i class="fs-badge">补</i>' : ''}
        <span class="ps-d">${x.d}</span>
      </div>`).join('')}
  </div>`;
}

/**
 * 「我的这一局，现在处于什么状态」横幅
 * ⚠️ 2026-11-24 用户口径：「为了让整个 demo 更接近真实的软件的使用的感觉……」
 * —— 真实软件里，用户的 Flag 会有**各种中间状态**：
 *    押金被扣了、申诉审核中、异议待投票、判定被驳回……
 *    这些状态以前造不出来（没有对应的 STATE 字段），
 *    所以现在补上 —— 它们是「**用户真的会遇到的事**」。
 *
 * —— 这一块只给【本人】看（`isMine`）—— 围观者看到的应该是别人的进展，
 *    不是别人的申诉进度。
 *
 * @param {object} f  Flag
 * @returns {string} HTML（空串 = 没有特殊状态）
 */
function myFlagStatusBanner(f) {
  if (!f) return '';

  /* ① 押金被扣 · 申诉审核中 */
  if (f.appeal && f.appeal.status === 'reviewing') {
    return `
    <div class="st-banner amber">
      <div class="st-ico">${ic('clock')}</div>
      <div class="st-main">
        <div class="st-t">${f.appeal.type} · 审核中</div>
        <div class="st-d">${f.appeal.type} · 提交于 ${f.appeal.submittedAt} · ${f.appeal.deadline}</div>
        <div class="st-r">${f.appeal.reason}</div>
        <div class="ap-steps mt">
          <div class="ap-step done"><i>${ic('check')}</i><span>已提交</span></div>
          <div class="ap-step done"><i>${ic('check')}</i><span>材料核验</span></div>
          <div class="ap-step now"><i>3</i><span>人工复核</span></div>
          <div class="ap-step"><i>4</i><span>出结果</span></div>
        </div>
      </div>
      <button class="btn ghost sm" data-go="appeal">看进度</button>
    </div>`;
  }

  /* ② 断卡
     ⚠️ 2026-11-24 用户口径（改）：「断卡的提醒我不建议放目标详情这里，
        放到首页『今天还没打卡』的下面，做一个提醒。」
     —— 所以【详情页的断卡横幅整块删掉】，提醒挪到首页（带补卡按钮 + 12 小时倒计时）。
     —— 详情页保留的是【断卡情况】那张卡（额度用了几次 / 还能断几次）——
        那是「状态」，不是「提醒」。用户主动进来看断卡情况就在这里看。 */

  /* ③ 未达标 · 押金已扣
     ⚠️ 2026-11-24 用户口径（改）：「当一个 flag 已经结算，用户如果失败了，
        不能在目标详情页申诉，参考挣了的风格，告诉用户扣了多少钱就行。」
     —— 所以【「我要申诉」按钮整块删掉】。
     —— 参照【挣了】那一条的写法：只说清楚「押金扣了多少 · 信用分加减多少 · 为什么」。
     —— ⚠️ 为什么已结算就没有申诉：
        申诉是针对【判定过程有误】的 —— 而失败已经**结算完成**（押金已按比例扣收），
        申诉没有可推翻的对象。已经结算的局只能看结果，不能翻案。
        （押金被扣是「发起人主动取消 / 作弊坐实」这类特殊路径时才有申诉，
          见上面 ① —— 那时候还没结算完。）
     —— 信用分还是要显示 —— 信用分是可恢复的（后续正常打卡能涨回来），
        只告诉用户「扣了多少钱」会漏掉「怎么恢复」这条信息。 */
  if (f.status === 'failed' && !f.appeal) {
    return `
    <div class="st-banner rose">
      <div class="st-ico">${ic('alert')}</div>
      <div class="st-main">
        <div class="st-t">这一局没做成</div>
        <div class="st-d">押金已扣 ¥${f.lostAmount || 0} · 信用分 ${f.creditDelta || -8}</div>
        <div class="st-r">${f.failedReason || '未在周期内达到目标体重'}</div>
      </div>
      <!-- ⚠️ 2026-11-24 用户口径：「已结算了的亏了的项目，也有记录卡的，
           目前没有，参考『挣了』加上。」
           —— 所以失败也有【看记录卡】入口 —— 失败记录卡照样出图，
              而且和成功卡同规格（围观者要的是完整的结局）。 -->
      <button class="btn ghost sm" data-go="recordCard" data-id="${f.id}">看记录卡</button>
    </div>`;
  }

  /* ④ 已达标 · 押金已退 */
  if (f.status === 'success') {
    return `
    <div class="st-banner mint">
      <div class="st-ico">${ic('checkCircle')}</div>
      <div class="st-main">
        <div class="st-t">这一局挣回来了</div>
        <div class="st-d">押金 ¥${f.refunded || f.deposit || 0} 已全额退回 · 信用分 +${f.creditDelta || 3}</div>
      </div>
      <button class="btn ghost sm" data-go="recordCard" data-id="${f.id}">看记录卡</button>
    </div>`;
  }

  return '';
}

/** 围观者版顶部缩略图行 —— 「Ta 今天的照片」，**只放今天拍的那几张**  *  ⚠️ 用户口径（2026-11-21）：「先略缩图展示用户今天的照片，1-4 张。一行展示完。
 *     然后展示用户的体重信息（体重、打卡日期、监督等等）」
 *  —— 所以这一行在【目标卡之前】。
 *
 *  ⚠️ 用户口径（2026-11-21 第二轮）：「只展示今天打卡+拍照的照片，其他日子的不需要展示。」
 *     —— 之前这里放的是「最近 4 张」，标题写「今天」却在放历史照片，口径是假的。
 *        现在严格按天取：今天的打卡照 + 今天补的生活照。
 *
 * ⚠️ 2026-11-23 用户口径（改）：「目标详情页，用户 Ta 今天的照片太大了，
 *    要求一行能放下 4 个，如果当前只拍了 1 个，剩下三个的位置也要空着，
 *    用户点击某一张照片，能放大观看就行了。」
 *    —— ① 固定一行 4 格（不是 flex:1 自适应铺满）；② 不足 4 张补空格子；
 *       ③ 点击进【放大看图】（沿用 openPhoto），不跳打卡详情页。 */
function todayRowBlock(f, own) {
  const list = todayPhotosRow(f);
  const day = latestDayOf(f);
  const note = noteOf(f, day);
  /* ⚠️ 2026-11-24（本轮，用户口径 Part II③）：**本人视角**下，
     当天没发布时，图片和留言位置**仍保留占位空位**。
     —— 原来 `if (!list.length && !note) return '';` 这一句会把整块**直接删掉**：
        没打卡 → 这一屏连照片位都没有 → 用户看不出「今天该发点什么」。
     —— 现在本人视角永远显示这 4 个格子（空的也是格子）+ 留言位，
        空位上写一句提示（今天还没打卡 / 今天没有留言），
        让用户知道「这里该有东西，还没放」。
     —— 围观者视角保持原样：没内容就不占位置（他不需要这个提醒）。 */
  const ownEmpty = !!own;
  if (!list.length && !note && !ownEmpty) return '';
  /* ⚠️ 固定 4 格 —— 不足的补空位，让整行高度稳定、不会一张就撑满 */
  const SLOTS = 4;
  const cells = [];
  for (let i = 0; i < SLOTS; i++) {
    const x = list[i];
    if (x) {
      cells.push(`
        <div class="tr-cell" data-act="openPhoto" data-id="${f.id}"
             data-kind="${x.kind}" data-src="${x.src}" data-idx="${i}">
          <img src="${x.src}" alt="Ta 的照片 ${i+1}" loading="lazy">
          ${x.kind === 'checkin' ? `<span class="tr-d">第 ${x.day} 天</span>` : ''}
        </div>`);
    } else {
      /* ⚠️ 2026-11-24（本轮，用户口径 Part 四）：空位**不写「空位」两个字** ——
         —— 用户口径：「有照片则显示照片，无照片位置不要写『空位』文字，
            也不用灰色底，统一用透明底 + 线框占位，占住空白位置即可。」
         —— 原因：「空位」两个字是**解释**，而这一行要的是**占位** ——
            用户看一眼就知道这里该有东西，不需要再加三个字说明。
            灰色底 + 斜纹底 = 「这是一块被占用的区域」；
            透明底 + 线框 = 「这里本来就该有一张」，更轻、更像版面的一部分。 */
      cells.push(`<div class="tr-cell tr-empty"></div>`);
    }
  }
  return `
  <div class="section photo-first">
    <div class="section-head">
      <div class="section-title">${own ? '我今天的照片' : 'Ta 今天的照片'}</div>
      <!-- ⚠️ 2026-11-23 用户口径：「第 52 天 · 点开看大图这里删了。」
           —— 这一行副标题原本是「第 N 天 · 点开看大图」——
              「第 N 天」在照片格子左下角已经标着（.tr-d），重复；
              「点开看大图」是**操作说明**，不是内容 —— 点一下就知道能放大，
              而且照片本身点得开，不用文字教一遍。 -->
    </div>
    <div class="today-row">
      ${cells.join('')}
    </div>
    ${note ? `
    <div class="ev-note mt">
      <div>${note}</div>
    </div>` : ownEmpty ? `
    <div class="ev-note mt">
      <div>今天还没有留言。</div>
    </div>` : ''}
  </div>`;
}

/** 围观者版打卡照片条 —— 横向可滑，点某一天进【打卡详情页】
 *  ⚠️ 用户口径（2026-11-21）：「然后才是打卡照片 · 平台内公开，
 *     能左右滑动选择具体某一天。**点击以后，可以进入到打卡详情页。**」
 *  —— 位置在【目标卡之后】（体重信息之后）。 */
function photoStripSection(f, photos) {
  const ck = photoStripBlock(f, photos, true);
  if (!ck) return '';
  return `
  <div class="section photo-strip-sec">
    <div class="section-head">
      <div class="section-title">打卡照片 · 平台内公开</div>
      <div class="section-sub">${photos.filter(x=>x.src).length} 张 · 左右滑选一天 ${info('photoPrivacy','sm')}</div>
    </div>
    <div class="card" style="padding:12px 0 4px">
      ${ck}
      <!-- ⚠️ 2026-11-23 用户口径：「左右滑选某一天 —— 点开进打卡详情页，删了。」
           —— 这行提示是【操作说明】，而且它描述的动作在界面上并不存在：
              照片条点开是**放大看图**，不是「进打卡详情页」。
              留着它 = 界面教了一个用户点不到的动作。 -->
    </div>
  </div>`;
}

PAGES.flagDetail = (id) => {
  const f = findFlag(id);
  const tm = flagTier(f);
  const prog = Math.round(f.checkedDays / f.totalDays * 100);
  const isMine = f.mine;
  /* ⚠️ 2026-11-24 用户口径：「当一个 FLAG 结算后，点击这个结算的 FLAG，
       在它的目标详情页，打卡日历、进度应该都是完成了的，
       现在的 demo，我点开『挣了』的这个 FLAG 的详情页，还是日常打卡的页面，调整下。
       『亏了』详情页也是，应该是部分打卡了，那些『今日打卡』、『打卡历史』怎么还会有呢？」

     —— 所以【已结算的局】要用「结局视图」，不是「日常操作视图」：
        · 打卡日历 → 全部按【这一局实际发生的样子】渲染（成功=全打卡 / 失败=断卡格标红）
        · 进度条   → 走到结算为止（成功=100% / 失败=按打卡天数）
        · 底部条   → 【今日打卡 / 打卡历史】整块换成「看记录卡 / 分享」
        · 断卡情况 → 已结算的局不再显示「还能断 N 次」（那是进行中才有的状态） */
  const settled = f.status === 'success' || f.status === 'failed' || f.status === 'broken';
  // 实时动态流（见需求规格 3.5）：对所有身份可见
  const activity = activityOf(f);
  // 打卡照片（见需求规格 R2.5）：平台内公开给所有人
  const photos = photosOf(f);

  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('目标详情',
      isMine ? `<button class="nav-btn" data-go="flagMenu" data-id="${f.id}">•••</button>` : '',
      isMine ? '' : navIdentity(f),
      isMine ? '' : navTier(f, TIER_META[f.tier].name))}</div>

    <!-- ⚠️ 2026-11-24（本轮，用户口径 Part 五③）：**本人视角**的身份小标签
         （头像 + 名字 + 天数 · 档位）**提到页面上方**，不再混在下面的目标卡里。
         —— 用户口径：「姓名、头像等小标签应放在页面上方，不要与下方卡片混排在一起。」
         —— 原因：那一行是**「这是谁的局」的身份标识**，不是这张卡的内容。
            混在卡里，它会跟标题、指标挤在一起，看起来像卡的一部分。
            提到卡片外面、放在页面顶部，它就是**一条独立的信息**，
            跟围观者版的导航栏身份条（navIdentity）位置逻辑一致。 -->
    ${isMine ? `
    <div class="fd-mine-id">
      ${ava(f.user.name, 'sm')}
      <div style="flex:1;min-width:0">
        <div style="font-size:14.5px;font-weight:650">${f.user.name}</div>
        <div style="font-size:11.5px;color:var(--ink-3);margin-top:1px">${f.days} 天 · ${TIER_META[f.tier].name}</div>
      </div>
      ${tierTag(f.tier)}
    </div>` : ''}

    <!-- ⚠️ 2026-11-24（本轮，用户口径 Part II③）：**本人视角**也要展示
         当天的打卡照片和心情留言 —— 与广场（他人视角）一致。
         —— 本人视角：照片位 + 留言位**永远保留**（没发布时是空位 + 提示），
            用户退出后可以去打卡。
         —— 他人视角：维持原来的「有才显示」。 -->
    ${isMine ? todayRowBlock(f, true) : todayRowBlock(f, false)}

    <!-- ⚠️ 2026-11-24 用户口径：「为了让整个 demo 更接近真实的软件的使用的感觉……」
         —— 真实软件里，围观者也会关心「这一局有没有被质疑」——
            如果有异议在攒票，围观者应该知道这件事正在发生。
            （对发起人是匿名的，但「有没有人在质疑」是公开状态。） -->
    ${(() => {
      const objs = objectionsOf(f.id);
      if (!objs.length) return '';
      const o = objs[0];
      const st = { waiting: '等待更多监督席投票', reviewing: '已转人工复核', passed: '异议成立', rejected: '异议不成立' };
      return `
    <div class="st-banner rose" style="margin-bottom:12px">
      <div class="st-ico">${ic('alert')}</div>
      <div class="st-main">
        <div class="st-t">这一局有异议 · ${st[o.status] || o.status}</div>
        <div class="st-d">${o.node} · ${o.votes} / ${o.need} 票</div>
        <div class="st-r">异议不直接产生判定 —— 满 ${o.need} 票才转平台人工复核。</div>
      </div>
    </div>`;
    })()}

    <!-- ⚠️ 2026-11-24 用户口径：「为了让整个 demo 更接近真实的软件的使用的感觉……」
         —— 真实软件里用户的 Flag 会有各种【中间状态】（申诉中 / 断卡 / 已退款）。
            这些状态以前造不出来，所以现在补一个横幅 —— 它只给本人看。 -->
    ${isMine ? myFlagStatusBanner(f) : ''}

    <!-- ⚠️ 2026-11-22 用户口径：「发起成功这个页面，在 24 小时有效期内，
         应该是能多次重复点击进入的，你帮我安排一个合适的入口，看看放哪里合适。」
         —— 入口放在【本人版的顶部横幅】：筹备期里「发起成功页」就是这个局的操作台
            （立据 / 倒计时 / 找见证人 / 召集令都在那儿），
            用户从「进入我的 Flag」走出去之后，必须有一条明确的路能再回去。
            横幅只在筹备期出现 —— 名单冻结后这个页面就没有意义了。 -->
    ${isMine && f.status === 'prep' ? `
    <div class="prep-back">
      <div class="prep-back-t">${ic("target")} 还在筹备期 · 你可以随时回去</div>
      <div class="prep-back-d">立据、倒计时、找见证人都在那一页 —— 24 小时内可反复进入。</div>
      <button class="btn ghost block sm mt" data-go="created" data-id="${f.id}">回到发起成功页</button>
    </div>` : ''}

    <div class="card">
      <!-- ⚠️ 围观者版：身份信息已上移到导航栏（返回键右边，见需求规格 R2.9）
           —— 这里不再重复画头像 / 名字 / 天数 / 档位
         ⚠️ 2026-11-24（本轮，用户口径 Part 五③）：**本人视角**的身份小标签
           也提到了【页面上方】（.fd-mine-id），不再混在这张卡里。 -->

      <!-- ⚠️ 2026-11-23 用户口径：「『90 天备孕前减 8 公斤，把体检指标拉回正常。』文字只能一行。」
           —— 目标标题**单行 + 超出省略**（.fd-title）：
              标题下面就是主角数字和指标，标题占两行会把整张卡往上撑，
              而围观者扫一眼只需要知道「这是个什么局」。
         ⚠️ 2026-11-24（本轮，用户口径 Part 五②）：**本人视角**连这句目标描述也**删掉** ——
           —— 用户口径：「删除『30 天把体脂从 26% 降到 23%』这句目标描述
              （此前已要求去除，当前仍残留）。」
           —— 这一轮把「起始 → 目标体重」（R2.27①）和「目标描述句」一起清掉了 ——
              **对内视角**只回答「今天怎么样、还剩几天」，
              目标是什么是**发起时自己写的**，天天看它没有信息量，却占掉整张卡最好的位置。
           —— 他人视角**保留**目标描述（那是**对外的承诺**，别人必须能读到）。 -->
      ${isMine ? '' : `<div class="fd-title">${f.title}</div>`}

      <!-- ⚠️ 2026-11-24（本轮，用户口径 Part II①）：**本人视角**不展示
           「起始 → 目标体重」这个主角数字。
           —— 用户口径：「进入后，卡片内不展示『30 天把体脂从 20.6 降到 3%』
              『72.5 到 68』这类目标 / 体重变化数据。」
           —— 为什么：本人看自己这一局，第一诉求是「**今天怎么样 / 还剩几天**」，
              不是「我要从多少减到多少」—— 那个目标他自己在发起时就知道了，
              而且这个主角数字正占掉整张卡最重要的位置。
           —— 目标标题保留（那是「我要做成什么」，不是数据）。
           —— 结算结局（亏了 / 挣回了）保留 —— 那是**结果**，不是目标数据。 -->
      ${isMine ? '' : `
      <div class="lead lead-range" style="margin:20px 0 0">
        <span class="l-v">${f.startWeight}</span>
        <span class="l-arrow">→</span>
        <span class="l-v">${f.targetWeight}</span>
        <span class="l-u">kg</span>
      </div>
      `}
      ${f.status === 'failed' ? `
      <div class="lead-sub">亏了 ${f.lostAmount || 0} 元</div>` :
      f.status === 'success' ? `
      <div class="lead-sub">挣回了全部押金</div>` : ''}

      <!-- ⚠️ 2026-11-24（本轮，用户口径）：顶部小卡片改版 ——
           ① 「打卡天数」改成「点赞数量」（围观者最想知道的是「多少人认这一局」；
              打卡天数在下面的日历折叠头里已经有了）
           ② 下面【断卡情况下方】那两块独立卡片（见证席 N 位 / 监督席 N 人）**整块删掉** ——
              它们跟顶部这三张卡是同一个信息的两个副本。
              删掉之后，顶部这三张就是这些数据的**唯一出处**。
           ③ 「位见证席」这张**可点** —— 点开弹半屏看见证席名单，点人头像进他主页。
              （原来要滚到下面展开「名单与责任」才能看到，
                现在围观者想看「谁在替他背书」点一下就有。）
         —— 顶部三张卡：点赞数量 / 人监督 / 位见证席（可点）。 -->
      <div class="metrics">
        ${metric(likeCountOf(f.id), '点赞数量', 'hot')}
        ${metric(f.supervisorCount, '人监督')}
        <button class="metric metric-tap" data-act="openWitnessList" data-id="${f.id}">
          <div class="m-v">${f.witnesses.length}</div>
          <div class="m-l">位见证席${ic('chevR')}</div>
        </button>
      </div>

      <!-- ⚠️ 2026-11-23 用户口径：「还有 38 天删了」「71.2 → 63.2 kg 这里删了。」
           —— 进度条下面那一行两样都删：
              · 「还有 N 天」—— 打卡天数（52 / 90）已经在上面的指标里了，再写一遍天数是重复；
              · 「起始 → 目标」—— 上面主角数字就是它，不能出现两次。
           —— 只留进度条本身。 -->
      <div class="bar ${f.status==='broken'?'rose':f.status==='ending'?'amber':f.status==='failed'?'':'mint'}"><i style="width:${prog}%"></i></div>

      <!-- ⚠️ 用户口径（2026-11-22）：「目标详情页，删除掉目标理由。」 —— 理由不再在详情页展示 -->
    </div>

    <!-- ⚠️ 围观者版：长期档案入口已上移到导航栏身份条（点击「头像 + 名字 + 天数 + 档位」即可进入）
         目标详情 = 这一局的记录；用户主页 = 这个人的长期信息（信用分 / 见证情况）。
         ⚠️ 本人版不放这个入口 —— 自己的档案在「我的」里。 -->

    <!-- ⚠️ 2026-11-23 用户口径：「留言功能需要大幅度简化，围观群众能有个输入框，
         留言就行，不用废话，留言按钮放到目标详情页偏上的地方。」
         ⚠️ 2026-11-24（本轮）：这里【不再自己放输入框】——
         —— 原来详情页是一个输入框 + 「留言」按钮，发完留在原页面，
            用户【看不到别人已经说了什么】—— 会重复说别人说过的话。
         —— 现在改成一行引导按钮，点了升起【广场那个留言半屏】：
            ① 上面是目标人今天的照片 / 心情 / 时间
            ② 下面是全部留言（时间倒序），每条能单独点赞
            ③ 最下面是输入框
         —— 这样全站留言只有【一种形态、一套数据】：
            从广场进和从详情页进，看到的是同一批留言。

         ⚠️ 2026-11-24（本轮，用户口径 Part II⑤）：**本人视角也要能看到留言** ——
         —— 用户口径：「参照广场目标详情页设计，他人对本人的留言可在此页面查看。」
         —— 原来这一块是 isMine ? '' : ... —— 本人看不到别人给他留了什么。
            本人看自己这一局，最想知道的就是「**大家怎么说**」——
            那是外界对这一局的反馈，是继续坚持下去的动力来源。
         —— 所以本人视角**用同一套轮播预览 + 同一个留言半屏**：
            数据源完全一样（publicMsgsOf），没有第二套逻辑。 -->
    ${(() => {
      /* ⚠️ 2026-11-24（本轮）：留言入口改成【轮播的流动文字】——
         用户口径：「目标详情里的留言的展示，可以做成流动的文字，
           这样用户就知道点击可以看到里面的内容，同时还能写留言。」

         —— 原来这里只有一个静态的「💬 说点什么…」按钮 ——
            用户完全看不出里面有什么。真正的留言内容只存在于那个半屏里。
         —— 现在把半屏里的内容搬到详情页上做一条预览（轮播，不是无限滚动）：
            ① 零条留言 → 退回成原来那个「说点什么…」按钮（空态不该显示空轮播器）
            ② 只有一条 → 静态显示那一条，不轮播（轮播一条毫无意义）
            ③ 正文太短（少于十二个字）→ 间隔拉到六秒（每四秒切一条短的会很跳）
            ④ 右下角「2/3 ›」既是进度指示，也是「点进去看全部」的箭头
         —— 关键：这个块必须同时是【预览】和【入口】——
            只做预览不给入口，用户看完还是不知道去哪看全部。 */
      const msgs = publicMsgsOf(f);
      if (!msgs.length) {
        return `
    <div class="card msg-box-card">
      <button class="msg-entry" data-act="openMsgSheet" data-id="${f.id}">
        ${ic('message')}<span>${isMine ? '还没有留言' : '说点什么…'}</span>
      </button>
    </div>`;
      }
      return `
    <div class="card msg-box-card">
      <button class="msg-ticker" data-act="openMsgSheet" data-id="${f.id}" data-ticker="1">
        <span class="mt-ico">${ic('message')}</span>
        <span class="mt-track">
          ${msgs.map((m, i) => `
          <span class="mt-item ${i === 0 ? 'on' : ''}" data-mi="${i}">
            <span class="mt-name">${m.name}</span>
            <span class="mt-text">${m.text}</span>
          </span>`).join('')}
        </span>
        <span class="mt-count">1/${msgs.length} ${ICON.chevR}</span>
      </button>
    </div>`;
    })()}

    <!-- ⚠️ 围观者版：打卡照片条在目标卡（体重信息）之后，可左右滑选某一天 -->
    ${isMine ? '' : photoStripSection(f, photos)}

    <!-- ⚠️ 2026-11-24（本轮，用户口径）：原来在日历**上方**那块独立的
         「断卡情况」卡片 —— **整块删除**。
         —— 它的数据（已断 N 次 / 共 M 次）已经挪进日历折叠头的右侧
            （见下面【打卡日历】那块），告警文案挪进日历展开后的正文。
         —— 原因：断卡是【日历上的事】。断在哪一天，日历上一目了然；
            单独一块卡放在日历上面，是把同一件事拆成两个地方讲，
            而且两个地方的数据可能不同步（一个断卡了，另一个还写着"还能断 N 次"）。 -->

    <!-- ⚠️ 2026-11-24（本轮，用户口径）：断卡情况下方那两块 ——「见证席 N 位」和
         「监督席 N 人」—— **整块移除**。
         —— 原因：它们跟顶部三张指标卡是【同一批数据的两个副本】。
            顶部已经有「N 人监督」「N 位见证席」了（见证席那张还能点开看名单），
            这里再来一遍就是同一个数字在一次滚动里出现两次。
         —— 见证席的名单与责任 → 移到顶部那张卡的半屏里（见 R2.26①③）。
         —— 监督席的人数 → 顶部指标卡。
         —— 「互动明细与隐私说明」那个折叠（点赞 / 短语 / 留言 + 隐私说明）：
            **一并删掉** —— 它跟被删的「监督席 N 人」是同一张卡里的东西，
            而其中的「点赞 / 短语 / 留言」三个数字也跟别处重复
            （点赞数在顶部指标卡、留言数在留言半屏）；
            只剩下「匿名但计数 / 留言公开可见」这句隐私口径 ——
            它已经在「留言」那个问号弹层（info('messageBoard')）里有了，
            不用在正文里再说一遍。 -->

    ${activity.length ? `
    <div class="section">
      <div class="section-head">
        <div class="section-title">刚刚发生了什么</div>
        <div class="section-sub">${info('messageBoard','sm')}</div>
      </div>
      <div class="card act">
        ${activity.map(a => {
          let body = '';
          if (a.type === 'like')       body = `<b>${a.count} 位监督席</b>为你加油`;
          else if (a.type === 'phrase') body = `<b>${a.who}</b> 发送了<span class="act-q">「${a.text}」</span>`;
          else if (a.type === 'msg')    body = `<b>${a.who}</b> 留言：<span class="act-q">「${a.text}」</span>`;
          else if (a.type === 'echo')   body = `<b>${a.who}</b> 回了一句<span class="act-q">「${a.text}」</span>`;
          return `
        <div class="act-row ${a.type==='echo'?'echo':''}">
          <span class="act-ico">${a.type==='echo'?ic('reply'):a.type==='like'?ic('thumbsUp'):a.type==='phrase'?ic('sparkle'):ic('message')}</span>
          <div style="flex:1;min-width:0">
            <div class="act-txt">${body}</div>
            <div class="act-time">${a.time}</div>
          </div>
        </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    ${isMine && f.msgs.length ? `
    <div class="section">
      <div class="section-head">
        <div class="section-title">你的回声</div>
        <div class="section-sub">${info('messageBoard','sm')}</div>
      </div>
      <div class="card">
        ${f.msgs.map((m,i) => `
        <div class="msg ${m.anon?'':'mine'}">
          ${m.anon ? `<div class="avatar xs" style="background:var(--ink-4)">匿</div>` : ava(m.from, 'xs')}
          <div style="flex:1;min-width:0">
            <div class="msg-bubble">${m.text}</div>
            <div class="msg-meta">${m.from} · ${m.time}</div>
            ${m.reply ? `
            <div class="msg-reply">
              <span class="mr-tag">你的回声</span>
              <span class="mr-text">${m.reply.text}</span>
              <span class="mr-time">${m.reply.time}</span>
            </div>` : `
            <button class="btn ghost sm mt" data-reply="${i}">${ic('reply')} 回一句</button>`}
          </div>
        </div>`).join('')}
        <div class="field-hint mt">
          你可以回一句 —— <b>回声所有人可见</b>。<br>
          回声是<b>终点</b>：没人能回复你的回声。
        </div>
      </div>
    </div>` : ''}

    <!-- ⚠️ 2026-11-23 用户口径：「目标详情中的进度，移到打卡日历上面。」
         —— 「进度」（见证席判定节点时间轴）移到【打卡日历】的正上方。
            两者是同一件事的两面：日历是每一天，进度是节点，挨着放最好读。

         ⚠️ 2026-11-24（本轮，用户口径）：这一区改名叫【见证席判定】，形式从简 ——
         —— 用户口径：「进度区改为『见证席判定』，对各节点进行判定，形式从简；
                        保留现有节点圆圈的颜色区分：已判定节点颜色加深，未判定节点保持浅色；
                        不在页面直接展示判定人名字、时间、起始重量及
                        『已验证 7.7、11.2』『已验证 69.1』等具体数值；
                        判定入口文字可点击，点开弹出半框。」
         —— 所以：
            ① 区名从「进度」改成「见证席判定」
            ② 节点条**只留**：圆圈（深=已判定 / 浅=未判定）+ 节点名字
            ③ 节点里的日期 / 「已验证 · 68.4kg」/「见证席判定通过」/判定人 —— **全删**
               （那些是这一局的**物证数据**，不在这一屏展示；
                 具体判定结果点开半屏看）
            ④ 节点名字**可点** → 弹半屏（见 openVerdictSummarySheet）：
               应判多少人 / 实判多少人 / 通过 / 存疑 / 作弊 三项数量 + 判定时间 -->
    <div class="section">
      <div class="section-head">
        <div class="section-title">见证席判定</div>
        <div class="section-sub">${info('stateMachine','sm')}</div>
      </div>
      <div class="card">
        <div class="timeline">
          ${f.nodes.map((n, i) => {
            /* ⚠️ 2026-11-24 用户口径：「当一个 FLAG 结算后……进度应该都是完成了的」
               —— 已结算的局，【没走到的节点】不再是「未来」——
                  那一局已经结束了，那些节点就是「没走到」。
               —— 状态：'skip'（没走到）。视觉上用 fail 的样式（灰掉），但文案说清楚。
               ⚠️ 2026-11-24（本轮，Part I⑥）：节点条现在**只留圆圈 + 名字**，
                  日期 / 「已验证 · 68.4kg」这些数值全删了。
               —— 但 skip 状态要说明「这一局没走到这里」——
                  这是【状态说明】不是【这一局的数值】，所以保留。 */
            let st = n.state;
            let note = '';
            if (settled && (st === 'future' || st === 'now')) {
              st = 'skip';
              note = '这一局没走到这里';
            }
            return `
          <div class="tl ${st==='done'?'done':st==='now'?'now':st==='fail'?'fail':st==='skip'?'skip':''}">
            <div class="tl-dot"></div>
            <div class="tl-body">
              <button class="tl-t tl-tap" data-act="openVerdictSummary" data-id="${f.id}" data-node="${i}">
                ${n.name}${ICON.chevR}
              </button>
              ${note ? `<div class="tl-d">${note}</div>` : ''}
            </div>
          </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- ⚠️ 2026-11-24（本轮）：打卡日历改成【默认收起】——
         用户口径：「打卡日历应该正常是隐藏的，点开可以展开，不然太占地方了。」

         —— 原来日历是全展开的：每格正方形、一行七个，
            三十天的局五行，九十天的局十三行 —— 这一个区块就吃掉一整屏。
         —— 而它的信息密度极低：九十个格子里大部分是灰的「未打卡」。
            用户真正想看的只有两件事 —— 今天打了没、断了几天，
            而这两件事上面已经有了（进度条、断卡情况、照片条）。
         —— 所以默认只留一行标题栏，点开才展开日历本身。
            折叠用产品里已有的 .fold 组件，不另造一套。

         ⚠️ 2026-11-24（本轮，再改）：**断卡情况并进日历卡片** ——
         —— 用户口径：「底部打卡日历压缩小卡片右侧备注断卡次数：
            断了多少次 / 共多少次（将原断卡情况合并到日历卡片内）」
         —— 原来「断卡情况」是日历**上方**一块独立的卡（有进度点、有告警），
            现在它的数据（已断 N 次 / 共 M 次）挪到日历折叠头的**右侧**。
         —— 为什么：断卡是【日历上的事】—— 断在哪一天，日历上一目了然。
            单独一块卡放在日历上面，是把同一件事拆成两个地方讲。
         —— 告警文案（超窗未补 / 再断 1 次就结束）留在日历**展开后的正文**里 ——
            折叠头只放数字，展开才看到提醒。
         —— 下面那一整块独立的「断卡情况」卡片**删掉**。 -->
    ${(() => {
      const bs = breakStatusOf(f);
      const limit = bs.limit;
      const left = bs.left;
      const used = bs.used;
      const dots = Array.from({length: limit}, (_,i) => i < used ? 'used' : 'left').join('');
      const danger = left === 0 && f.status !== 'failed' && f.status !== 'success';
      const dead = f.status === 'failed' && f.failedReason === '断卡次数用尽';
      /* 折叠头右侧的断卡计数 —— 「断了多少次 / 共多少次」 */
      const brkCount = limit
        ? `断卡 ${used}/${limit} 次`
        : '不能断卡';
      return `
    <div class="section">
      <div class="card brk-card ${dead?'dead':danger?'danger':''}" style="padding:0">
        <div class="fold" data-fold="cal" style="margin:0;padding:0;border-top:0">
          <button class="fold-btn cal-fold-btn">
            <span>打卡日历 · ${f.checkedDays}/${f.totalDays} 天</span>
            <span class="cal-brk">${brkCount}</span>
            ${ICON.chevR}
          </button>
          <div class="fold-body"><div class="fold-inner">
            <!-- ⚠️ 2026-11-24（本轮，用户口径 Part 一①）：**断卡提示整句删除** ——
                 —— 用户口径：「打卡日历展开后，『已断 0/21，11 月 15 号未打卡，
                    12 小时内可补』这句话整句删除，不再展示。」
                 —— 为什么：日历上**断卡当天本来就带一个小圆点**（.cal-d.brk）——
                    「哪天断了」在日历上一目了然。
                    而「已断 N / M」这个数在**折叠头的右侧**已经写着（「断卡 0/2 次」）。
                    展开后再把这两件事用文字重讲一遍 = 同一件事说三遍，
                    而且文字版本还多了个「11 月 15 日未打卡，12 小时内可补」——
                    那是【行动提示】，它属于首页的补卡提醒卡，不属于日历。
                 —— 所以整块 .brk-ratio 删除；折叠头的「断卡 N/M 次」保留。
                 —— 真正要命的告警（超上限结束 / 再断 1 次就结束）**保留** ——
                    那两条是「再不看就晚了」，不是重复。 -->
            ${dead ? `
            <div class="brk-msg dead">
              <b>断卡次数超过上限，这个 Flag 提前结束了。</b>
            </div>` : danger ? `
            <div class="brk-msg danger">
              <b>再断 1 次，这个 Flag 就结束了。</b>
            </div>` : ''}
            <div class="cal cal-lite">
              ${['日','一','二','三','四','五','六'].map(d => `<div class="cal-h">${d}</div>`).join('')}
              ${calCalendar(f).map(c => c.t==='pad'?'<div></div>'
                : `<div class="cal-d ${c.st} ${c.st==='miss'?'brk':''} ${c.today?'today':''}" data-act="openDaySheet" data-id="${f.id}" data-day="${c.d}">${c.d}</div>`).join('')}
            </div>
            <!-- ⚠️ 2026-11-24（本轮）：图例收窄 ——
                 —— 用户口径：「日历日期中，仅对断卡当天做小标记，正常打卡日期不添加标记。」
                 —— 原来正常打卡日是整格淡绿底、图例里还有「已打卡 / 补卡 / 未打卡」三色，
                    满屏都是底色 = 满屏都是标记。
                 —— 现在：**只有断卡当天带小圆点标记**，其余日期一律素面。
                    「断卡」这一个是真正需要被一眼看见的异常。
                 —— 补卡是「断过但补回来了」—— 补回来了就不算异常，不需要标记。 -->
            <div class="cal-legend">
              <span><i class="cal-dot-mark"></i>断卡当天</span>
            </div>
            ${photos.some(x=>x.src) ? `
            <!-- 打卡照片条：横向可滑，点开看原图（见需求规格 R2.5）
                 ⚠️ 围观者版照片已前置到页面顶部（见 R2.9），这里不再重复一遍 -->
            ${isMine ? `
            ${photoStripBlock(f, photos, false)}
            <!-- ⚠️ 2026-11-24（本轮）：这句提示拆成两半 ——
                 ① 「点任意一天看原图」是【操作说明】—— 照片条一点就放大，不用教；
                 ② 「打卡照片在平台内公开」是【隐私知情】，必须留。
                 —— 所以只留后半句，前半句删掉。 -->
            <div class="field-hint" style="margin-top:8px">打卡照片在平台内公开。</div>` : ''}` : ''}
          </div></div>
        </div>
      </div>
    </div>`;
    })()}

    <!-- 补充照片（生活照）—— 见需求规格 R2.6
         ⚠️ 与打卡日历是两块内容：日历是【物证轨迹】，这里是他自己发的【生活照】
         ⚠️ 围观者版生活照已前置（见 R2.9），这里不再重复 -->
    ${isMine ? (() => {
      const ex = extraPhotosOf(f);
      if (!ex.length) return '';
      return `
    <div class="section">
      <div class="section-head">
        <div class="section-title">生活照</div>
        <div class="section-sub">${ex.length} 张 · 第 1 张是封面</div>
      </div>
      ${lifePhotosBlock(f, false)}
    </div>`;
    })() : ''}

    ${f.quote ? `
    <div class="note mt" style="font-style:italic;text-align:center">「${f.quote}」</div>` : ''}

    <!-- 取消入口（见需求规格 R1.6）—— 淡色小字，不抢主行动
         ⚠️ 2026-11-24（本轮，用户口径 Part II⑥）：这行小字**居中对齐** ——
         —— 用户口径：「目标详情内『取消这个 Flag 需按未达标结算，押金不退还』
            这行小字，居中对齐。」
         —— 原来它跟按钮并排（flex 横排），看起来像按钮的一部分；
            现在按钮在上、小字在下、整块居中。 -->
    ${isMine && canCancelFlag(f).ok ? `
    <div class="fd-cancel">
      <button class="cancel-link" data-act="doCancelFlag" data-id="${f.id}">取消这个 Flag</button>
      <span class="fd-cancel-hint">取消这个 Flag 需按未达标结算，押金不退还</span>
    </div>` : ''}

    ${!isMine ? `
    <!-- ⚠️ 2026-11-23 用户口径：「目标详情页，把『你的动作』整个删掉了，
         提出异议放在页面的最下面，单独一个。」
         —— 「你的动作」整块删除；留言已上移到目标卡下面（一个输入框）；
            点赞移到广场页；这里只剩【提出异议】，放在页面最底部单独一个。 -->
    <div class="section">
      <div class="list sparse">
        <div class="row tap" data-go="objection" data-id="${f.id}"><div class="row-icon" style="background:var(--rose-tint);color:#B03B40">${ic('alert')}</div><div class="row-main">
          <div class="row-title">提出异议</div><div class="row-sub">匿名 · 对物证 · 满 3 票转人工</div></div>
          <span class="row-arrow">${ICON.chevR}</span></div>
      </div>
    </div>` : ''}

    <!-- ⚠️ 2026-11-24（本轮，用户口径 Part 一②）：底部按钮合并 ——
         「进入已结束目标详情页，底部『看记录卡』和『分享这一局』两个按钮合并为一个，
          仅保留【分享记录卡】；去掉『分享这一局』按钮。」
       —— 落法：已结算的本人视角，底部**只剩一个**整宽按钮【分享记录卡】。
       —— 为什么这样合并：
          「看记录卡」是**看**，但记录卡页面里那张图 + 4 个计数 + 品牌落款
          本来就是要分享出去的图 —— 「看」和「分享」其实是同一件东西的两面。
          分成两个按钮，用户点「看」看完还得再找一次「分享」。
       —— 所以现在：**分享半屏顶部就是那张海报**（所见即所得），
          用户既看得到，也能直接转发 —— 一个按钮把两件事都做了。 -->
    ${isMine && !settled ? '' : `
    <div class="sticky-cta">
      ${isMine ? `
      <!-- ⚠️ 2026-11-24 用户口径：「当一个 FLAG 结算后……那些『今日打卡』、
           『打卡历史』怎么还会有呢？」
           —— 已结算的局【没有今天要打的卡】—— 那两个按钮是进行中才有的动作。
           —— 现在只剩一个【分享记录卡】：这一局已经结束，
              用户唯一还能做的事就是【把这一局分享出去】。 -->
      <button class="btn block" data-act="shareRecordCard" data-id="${f.id}">${ic("upload")} 分享记录卡</button>` : `
      <!-- ⚠️ 2026-11-24（本轮）：「监督这一局」不再跳独立页面 ——
           改成和广场卡片一样的【眼睛图标】，点一下就监督、再点一下取消。
           —— 原因：原来同一个「监督」动作两套做法 ——
              广场：点眼睛一下就生效；详情页：要先进一个页面，
                    页面里还有一个装样子的假开关（结局/断卡/判负通知，点了不动），
                    再点「确认监督」才生效。同一个动作两次点击 + 一个假控件。
           —— 那些假开关整个删掉了 —— 用户之前就明确说过「没什么开关」。
           —— 取消监督的【二次确认】保留在「我监督的局」列表里（那是列表页，有整行可点），
              这里跟广场一样是轻量的一下切换。 -->
      <button class="btn block fd-sup ${isSubscribed(f.id) ? 'on' : ''}" data-act="toggleSupervise" data-id="${f.id}">
        ${ic('eyeOpen')}<span>${isSubscribed(f.id) ? '已监督' : '监督这一局'}</span><span class="fd-sup-n">${f.supervisorCount}</span>
      </button>`}
    </div>`}
  </div>
</div>`;};

/* =========================================================
   11. 见证席面板
   ⚠️ 2026-11-23 用户口径（改，本轮）：
      「见证席面板，删除你的判定，删除说明（放到右上角？就行），
        删除见证席的三项收益，除了点击到需要判定的节点，三选一以外，
        作为见证席应该能看到用户的完整 FLAG 的，
        并且清晰知道自己的判定在那个阶段，信息不用多，聚焦点。」
   —— 落法：
      1. 「你的判定」三选一从【面板正文】移走 —— 只在【点开某个待判节点】时弹（openVerdictPicker）。
      2. 说明类内容（见证席是什么 / 判定说明 / 连带责任 / 分值到账 / 三项收益）全部收进右上角「？」。
      3. 「见证席的三项收益」整块删除 —— 它已经在右上角「？」里（witnessApply 复用 WITNESS_BENEFIT_HTML）。
      4. 面板主体 = 我正在见证的每一个 Flag 的【完整视图】：
         目标 / 周期 / 押金 / 当前进度 / 全部节点条（标出我在哪几步判过、哪一步现在要判）。
      5. 聚焦点：待判的那一步用品牌色高亮，节点条一眼能看出「我走到第几步」。
   ========================================================= */

/** 见证席面板 · 单个 Flag 的完整视图（见证席视角） */
function witnessFlagCard(group) {
  const { flag: f, tasks, pending } = group;
  const t = pending || tasks[0];
  const track = witnessNodeTrack(group.flagId, tasks);
  const prog = f ? Math.round((f.checkedDays || 0) / (f.totalDays || f.days || 30) * 100) : 0;
  const { done, total } = witnessProgressOf(group);
  const u = f ? f.user : null;

  return `
<div class="card" style="padding:0">
  <!-- 头部：这个 Flag 是谁的 + 完整目标 -->
  <div class="wf-head">
    <div style="display:flex;align-items:center;gap:10px">
      ${ava(group.flagId, 'sm')}
      <div style="flex:1;min-width:0">
        <div style="font-size:15px;font-weight:680;letter-spacing:-.2px">${u ? u.name : t.flagUser}</div>
        <div style="font-size:11.5px;color:var(--ink-3);margin-top:1px">${f ? f.days : '—'} 天 · 押金 ¥${f ? f.deposit : 0}</div>
      </div>
      ${statusPill(f || { status: 'running' })}
    </div>
    <div class="wf-goal">${f ? f.title : t.title}</div>
    <!-- ⚠️ 2026-11-23 用户口径：「『想试试能不能打破平台期』删掉。」
         —— 见证席面板不再展示【目标理由】。
            理由是发起人给自己的私下动机（"想试试能不能打破平台期"），
            对见证席没有判断价值 —— 见证席要判的是【物证真不真】，不是【动机够不够】。
            目标标题本身已经说明了要做成什么。 -->
  </div>

  <!-- 进度条：这个 Flag 走到哪了 -->
  <div style="padding:0 16px 14px">
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:7px">
      <div style="font-size:12px;color:var(--ink-3)">第 ${f ? f.checkedDays : 0} / ${f ? f.totalDays : 0} 天</div>
      <div style="font-size:12px;font-weight:700;color:var(--brand)">${prog}%</div>
    </div>
    <div class="bar"><i style="width:${prog}%"></i></div>
    <!-- ⚠️ 2026-11-23 用户口径：「起始 65kg → 目标 63.5kg · 当前 65kg，
         改为只展示起始 65kg → 目标 63.5kg。」
         —— 只留【用户自己定的两个数】；当前体重由进展条与天数表达，不在这里重复。 -->
    ${f ? `<div class="tiny muted" style="margin-top:7px">
      起始 ${f.startWeight}kg → 目标 ${f.targetWeight}kg
    </div>` : ''}
  </div>

  <!-- 节点条：我判到第几步了（见证席最需要知道的一件事） -->
  <div class="wf-steps">
    ${track.map((n, i) => {
      const isNow = pending && n.name === pending.nodeName;
      const mark = n.mine === 'pass' ? '✓' : n.mine === 'doubt' ? '?' : n.mine === 'cheat' ? '!' : '';
      const cls = isNow ? 'now' : (n.mine ? 'done' : n.state);
      return `
      <div class="wf-step ${cls} ${isNow ? 'tap' : ''}" ${isNow ? `data-act="openVerdictPicker" data-id="${pending.id}"` : ''}>
        <div class="wf-step-dot">${mark || (i + 1)}</div>
        <div class="wf-step-name">${n.name}</div>
        <div class="wf-step-day">第 ${n.day} 天</div>
        ${!isNow && n.mine ? `<div class="wf-step-flag done">已判</div>` : ''}
      </div>`;
    }).join('')}
  </div>

  <!-- 待判那一步：唯一的聚焦点 -->
  ${pending ? `
  <div class="wf-act">
    <!-- ⚠️ 2026-11-23 用户口径：「『轮到你判 · 第 7 天「中期称重」，
         还剩 6 小时 · 见证门槛进度 1/2』删掉，找个合适的地方显示判定还剩多少时间就够了。」
         —— 标题行只留「轮到你判 · 第 N 天「节点名」」；
            【还剩多久】挪到标题右侧的倒计时徽章上（一眼可见、且不占额外一行）；
            【见证门槛进度 1/2】整条删掉 —— 那是别的见证席判了几个，不是「我」的事，
            放在聚焦点里会让人误以为那是我的进度。 -->
    <div class="wf-act-head">
      <div class="wf-act-t">轮到你判 · 第 ${pending.nodeDay} 天「${pending.nodeName}」</div>
      <div class="wf-act-timer ${pending.deadline === '已判定' ? 'done' : ''}">${ic('clock')}<span>${pending.deadline}</span></div>
    </div>
    <!-- ⚠️ 2026-11-23 用户口径：「见证席面板中，删掉关于『物证材料』的内容，
         在『去判定』的按钮上方，展示用户本次打卡的照片就行了，
         还是 4 张照片放一行，没有四张也占位，用户可以点击放大任意一张。」
         —— 「物证材料」那一整块（标题 + 文字清单 + 跳转到判定详情页的按钮）全删；
            判定详情页的入口也没了 —— 见证席在面板上直接看原图就够了，不用再跳一页。
            「去判定」上方改成【本次打卡的物证照片行】：
              · 4 格固定一行，不足 4 张补空位（整行高度稳定）；
              · 点任意一张放大看图（复用 openPhoto 查看器）。 -->
    ${witnessShotRow(group, pending)}
    <button class="btn block" data-act="openVerdictPicker" data-id="${pending.id}">去判定</button>
  </div>` : `
  <div class="wf-act" style="background:var(--mint-tint);border-color:rgba(63,122,88,.2)">
    <div class="wf-act-t" style="color:#3F7A58">这一局我判完了 · ${done}/${total} 步</div>
    <div class="wf-act-s" style="color:#3F7A58">下一个节点到了会推给你</div>
  </div>`}

  <!-- ⚠️ 2026-11-23 用户口径：「把见证席面板中的判定怎么算、见证门槛、物证怎么判删了。」
       —— 这一行三个「?」入口（.wf-foot）整条删掉。
          说明类内容已经在**右上角那个「?」**里（witnessApply 弹层），
          同一个页面底部再挂三个问号 = 同一件事两个入口 = 冗余。
          底部说明条同时还占了卡片底部一条横线，删掉后卡片收得更紧。 -->
</div>`;
}

/**
 * 见证席面板里的【本次打卡物证照片行】
 * ⚠️ 2026-11-23 用户口径：「在『去判定』的按钮上方，展示用户本次打卡的照片就行了，
 *    还是 4 张照片放一行，没有四张也占位，用户可以点击放大任意一张。」
 *
 * —— 取的是【本次节点对应的那几天】的打卡照（物证），不是生活照：
 *    见证席判的是「称重有没有被糊弄」，要看的正是称重秤读数那张照片。
 * —— 固定 4 格，不足补空位（与围观者「今天的照片」行同一套 .tr-cell 样式）。
 * —— 点任意一张 → openPhoto 查看器放大；不跳判定详情页。
 */
function witnessShotRow(group, pending) {
  const f = group.flag;
  if (!f) return '';
  /* 本次节点对应的打卡日：节点日就是打卡到的那一天 */
  const day = pending.nodeDay || latestDayOf(f);
  /* 该天往前数（含当天）最多 4 张打卡照 —— 从新到旧 */
  const shots = photosOf(f)
    .filter(p => p.src && p.d <= day)
    .slice(-4)
    .reverse();
  const SLOTS = 4;
  const cells = [];
  for (let i = 0; i < SLOTS; i++) {
    const x = shots[i];
    if (x) {
      cells.push(`
        <div class="tr-cell" data-act="openWitnessShot" data-id="${group.flagId}"
             data-src="${x.src}" data-day="${x.d}" data-idx="${i}">
          <img src="${x.src}" alt="第 ${x.d} 天打卡物证" loading="lazy">
          <span class="tr-d">第 ${x.d} 天</span>
        </div>`);
    } else {
      cells.push('<div class="tr-cell tr-empty"></div>');
    }
  }
  return `
  <div class="wf-shots">
    <!-- ⚠️ 2026-11-24（本轮，用户口径 Part 四①）：删掉「本次打卡的物证」这个标题 ——
         —— 用户口径：「见证席面板对判定节点进行判定的独立页面中，
            删除『本次打卡的证物』这句话。」
         —— 为什么：这个标题是【解释】，而照片行**自己就说清楚了** ——
            4 格固定一行、点开能放大，正对着「去判定」按钮。
            而且「物证」这个词在见证席语境里是**判定依据**，
            挂成标题反而像在给这排照片下一个定义 —— 不如让它就是照片。
         —— ⚠️ 保留的仍然是照片行本身 —— 见证席要判的就是「称重有没有被糊弄」，
            那些照片正是他要看的（原图放大看，不跳页）。 -->
    <div class="today-row">${cells.join('')}</div>
  </div>`;
}

/* ⚠️ 2026-11-24（本轮）：见证席面板里的【正在招募见证席】整块删掉 ——
   原来这里有一个 recruitingFlagsBlock() 函数，被面板的【空态】和【有任务】两处共用。
   现在整块删掉了。

   用户口径：「见证席面板里面，正在招募见证席不合理的，
     如果其他用户点击你，希望你能做他的见证，把这个消息放到通知-判定邀请里就行了。」

   —— 这个改法的道理：
      找人当见证席应该是【发起人主动发邀请】，不是【见证席自己去广场接单】。
      发起人那头已经有两套完整的找人机制（候选池邀请 / 见证席召集令），
      而且邀请本来就是以【通知】的形式推给对方的 ——
      就在通知 Tab 的「判定·邀请」栏里（带接受 / 拒绝，12 小时过期）。
      所以面板里那个列表 = 同一件事的第二个入口，而且是个弱入口
      （广场只是「看得到」，通知才是「真的收到」）。
   —— 面板现在只管【判定】：待我判定 / 已判定 / 被驳回。
   —— 广场的「招募中」视图保留（那是【发现】）；通知的「判定·邀请」栏是【收到】。 */

PAGES.verdict = () => {
  const tasks = STATE.verdictTasks;
  const t = tasks[0];
  const groups = verdictGroups();

  /* 空态：还没成为见证席
     ⚠️ 2026-11-23 用户口径（改）：「我的页面，『申请成为见证席』整个删掉了，
        用户第一次通过点击『见证席面板』就能申请了，这里不需要单独弄一个页面。
        当用户在见证席面板中，点击申请成为见证席，会在页面中间弹出一个小框，
        评估用户是否达到见证席的标准。」
     —— 所以申请入口只在见证席面板里，点了弹【居中小框】当场评估。
     ⚠️ 本轮追加：空态里也不放「见证席是什么」四行说明了 ——
        说明统一进右上角「？」（witnessApply），面板只留「申请」这一个动作。 */
  if (!t) {
    return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('见证席面板', `<button class="nav-btn" data-info="witnessApply">?</button>`)}</div>
    <div class="empty-hero" style="margin-top:10px">
      <div class="empty-ico">${ic("gavel")}</div>
      <div class="empty-t">还没有待你判定的节点</div>
      <div class="empty-s">成为见证席后，别人 Flag 的<br>起始 / 中期 / 结束称重会推给你</div>
      <button class="btn block" style="margin-top:18px" data-act="applyWitness">${ic("clipboard")} 申请成为见证席</button>
      <!-- ⚠️ 2026-11-24（本轮）：这一块的招募列表整块删掉了 ——
           招募是【发现】（广场的「招募中」视图），收到邀请是【通知】（判定·邀请栏）。
           面板只管判定。 -->
      <div class="empty-hint">${info('witnessSystem','sm')}</div>
    </div>
  </div>
</div>`;
  }

  const pendingTotal = tasks.filter(x => !x.myVerdict).length;

  return `
<div class="screen-scroll">
  <div class="page">
    <!-- ⚠️ 2026-11-23 用户口径：「在见证席面板右上角，增加一个？，
         里面是见证席的说明和介绍。」
         ⚠️ 本轮：说明类内容全部收进这个「？」—— 面板正文不再放任何说明块。 -->
    <div class="nav">${navRow('见证席面板', `<button class="nav-btn" data-info="witnessApply">?</button>`)}</div>

    <!-- 聚焦点摘要：几个局 · 几个待判 -->
    <div class="wf-summary">
      <div class="wf-sum">
        <div class="wf-sum-v">${groups.length}</div>
        <div class="wf-sum-l">在见证的局</div>
      </div>
      <div class="wf-sum">
        <div class="wf-sum-v ${pendingTotal ? 'brand' : ''}">${pendingTotal}</div>
        <div class="wf-sum-l">待你判定</div>
      </div>
      <div class="wf-sum">
        <div class="wf-sum-v">${tasks.length - pendingTotal}</div>
        <div class="wf-sum-l">已判定</div>
      </div>
    </div>

    <!-- ⚠️ 2026-11-24（本轮）：这一块的招募列表整块删掉了 ——
         招募是【发现】（广场的「招募中」视图），收到邀请是【通知】（判定·邀请栏）。
         面板只管判定。 -->

    <!-- ⚠️ 2026-11-24 用户口径：「为了让整个 demo 更接近真实的软件的使用的感觉……」
         —— 真实软件里，见证席的判定是【会被复核的】：
            目标人申诉成功 → 你的判定被驳回 → 本次不计分。
            以前这个面板只有「待判 / 已判」，没有「我判错了」这一档 ——
            所以现在补一条横幅（只在有被驳回的判定时出现）。 -->
    ${(() => {
      const rej = tasks.filter(x => x.rejected);
      if (!rej.length) return '';
      return `
    <div class="st-banner rose" style="margin-bottom:12px">
      <div class="st-ico">${ic('alert')}</div>
      <div class="st-main">
        <div class="st-t">${rej.length} 次判定被驳回</div>
        <div class="st-d">${rej.map(x => `${x.flagUser} 的${x.nodeName}`).join(' · ')}</div>
        <div class="st-r">${rej[0].rejectReason || '复核后维持原判定 —— 本次判定不计分。'}</div>
      </div>
    </div>`;
    })()}

    <!-- 一个 Flag 一张卡：完整 Flag + 我的判定进度 -->
    ${groups.map(g => witnessFlagCard(g)).join('')}

    <!-- ⚠️ 2026-11-24 用户口径：「取消退出见证这个功能，
         在这个第一版本里，成为见证人，就不能退出了，也不允许中途加入了。
         咱们尽量简单点，不然太复杂了。」
         —— 所以【退出见证】整块删掉：没有「退出」按钮，也没有独立的退出页。
            见证席的身份一旦成立就跟着这一局走完 —— 不想判就用「存疑」，
            那不扣分、还触发复验。 -->
  </div>
</div>`;
};

PAGES.verdictDetail = () => {
  /* ⚠️ 2026-11-23 用户口径（改，本轮）：判定详情页跟着当前待判节点走 ——
     物证、体重、随机词都要对应到「我正要判的那一步」，不能是写死的一套数。 */
  const g = verdictGroups();
  const group = g.find(x => x.pending) || g[0];
  const t = group ? (group.pending || group.tasks[0]) : null;
  const f = group ? group.flag : null;
  const startW = t ? t.weight.split('→')[0].trim() : '—';
  const nodeW = t ? t.nodeWeight : '—';
  const word = (t && t.evidence.length > 1) ? (t.evidence[1].replace('手写随机词：', '')) : '青柑';
  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('判定详情')}</div>

    ${t ? `
    <div class="wf-head" style="border-radius:var(--r-md);margin-top:12px">
      <div style="display:flex;align-items:center;gap:10px">
        ${ava(group.flagId, 'sm')}
        <div style="flex:1;min-width:0">
          <div style="font-size:14.5px;font-weight:680">${f ? f.user.name : t.flagUser}</div>
          <div style="font-size:11.5px;color:var(--ink-3);margin-top:1px">第 ${t.nodeDay} 天 · ${t.nodeName} · ${t.deadline}</div>
        </div>
      </div>
      <div class="wf-goal" style="font-size:13.5px">${f ? f.title : t.title}</div>
    </div>` : ''}

    <div style="background:linear-gradient(150deg,#FF8A2B 0%,#FF6B00 60%,#E85A00 100%);border-radius:var(--r-xl);height:200px;display:flex;align-items:center;justify-content:center;color:#fff;position:relative;overflow:hidden">
      <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,rgba(255,255,255,.07),transparent 70%)"></div>
      <div style="text-align:center;position:relative">
        <div style="font-size:34px;margin-bottom:6px">${ic("image")}</div>
        <div style="font-size:14px;font-weight:600">物证原图</div>
        <div style="font-size:11.5px;opacity:.6;margin-top:4px">含水印 · 服务器时间 + 编号</div>
      </div>
    </div>

    <div class="tiles c2 mt">
      ${tile(startW, '起始 kg')}
      ${tile(nodeW, '本次 kg', 'brand')}
    </div>

    <div class="card mt">
      <div style="font-size:13.5px;font-weight:650;margin-bottom:9px">AI 筛查结果</div>
      <div style="font-size:13px;color:var(--ink-2);line-height:1.95">
        <div class="chk">${ic("checkCircle")}<span>秤读数 OCR 置信度 0.94</span></div>
        <div class="chk">${ic("checkCircle")}<span>体重变化速率正常</span></div>
        <div class="chk">${ic("checkCircle")}<span>手写随机词匹配「${word}」</span></div>
      </div>
      <div class="field-hint mt">低置信度才会转人工。当前置信度高，但<b>最终判定权在你</b> —— AI 只查物证真假，不判"进度是否真实"。</div>
    </div>

    <div class="sticky-cta">
      <button class="btn block" data-act="openVerdictPicker" data-id="${t ? t.id : ''}" ${t && t.myVerdict ? 'disabled' : ''}>${t && t.myVerdict ? '这一步我已判过' : '去判定'}</button>
    </div>
  </div>
</div>`;
};

/* =========================================================
   12. 见证席收益
   ========================================================= */
PAGES.witnessEarnings = () => `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('见证席收益')}</div>

    <div class="tiles">
      ${tile(STATE.witnessCount, '已见证', 'brand')}
      ${tile('96%', '成立率')}
      ${tile('1', '误报扣分', 'rose')}
    </div>

    <div class="section">
      <div class="section-head">
        <div class="section-title">三项收益</div>
        <div class="section-sub">${info('witnessBenefit','sm')}</div>
      </div>
      <div class="list">
        <div class="row"><div class="row-icon">${ic("trend")}</div>
          <div class="row-main"><div class="row-title">B1 信用分</div><div class="row-sub">每个节点判定 +2（结算后到账）· 陪到底按周期：7 天 +4 / 14 天 +6 / 30 天 +8 / 90 天 +8 · 本周 ${STATE.witnessWeekCredit || 0} / ${CREDIT_WITNESS.weeklyCap}</div></div>
          <span class="row-val brand">+72</span></div>
        <div class="row"><div class="row-icon">${ic("ticket")}</div>
          <div class="row-main"><div class="row-title">B2 特权</div><div class="row-sub">被分配到高信用用户 Flag 的概率提升</div></div></div>
        <div class="row"><div class="row-icon">${ic("medal")}</div>
          <div class="row-main"><div class="row-title">B3 荣誉</div><div class="row-sub">记录卡头像墙</div></div>
          <span class="tag">12 个</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <div class="section-title">判定记录</div>
        <div class="section-sub">${info('witnessCalib','sm')}</div>
      </div>
      <div class="list">
        ${WITNESS_EARNINGS.map(e => e.pending ? `
        <div class="row">
          <div class="row-main">
            <div class="row-title">${e.flag} · ${e.node}</div>
            <div class="row-sub">${e.ts} · 判定「${e.verdict}」· <span style="color:#A97108">⏳ ${e.pending}</span></div>
          </div>
          <div class="row-val" style="color:var(--ink-3);font-weight:650">待结算</div>
        </div>` : `
        <div class="row">
          <div class="row-main">
            <div class="row-title">${e.flag} · ${e.node}</div>
            <div class="row-sub">${e.ts} · 判定「${e.verdict}」</div>
          </div>
          <div class="row-val" style="color:${e.type==='good'?'var(--brand)':'var(--rose)'};font-weight:650">${e.delta}</div>
        </div>`).join('')}
      </div>
      <div class="center tiny muted mt">分值在事实结论确定后到账 ${info('asyncSettle','sm')}</div>
    </div>

    <div class="section">
      <div class="section-head">
        <div class="section-title">见证席资格</div>
        <div class="section-sub">${info('tierStrength','sm')}</div>
      </div>
      <div class="card">
        <div style="font-size:13px;color:var(--ink-2);line-height:2">
          <div class="chk">${ic("checkCircle")}<span>见证席成立率 ≥ 80%（当前 96%）</span></div>
          <div class="chk">${ic("checkCircle")}<span>无累计 3 次未响应</span></div>
        </div>
      </div>
    </div>
  </div>
</div>`;

/* =========================================================
   13. 个人中心
   ⚠️ 2026-11-24 用户口径（本轮 3 条）：
      ① 顶部资料卡扩展：年龄、加入「亏了」的时间、ID号、个性签名、所在省份，
         右上角加「编辑资料」按钮；
      ② 见证席面板入口改成展示【招募中的 FLAG】列表（给围观群众申请加入用的）；
      ③ 「进行中 / 已达成 / 没做成」三块磁贴改为不可点击（纯展示）。
   ========================================================= */
PAGES.profile = () => {
  const p = myProfile();
  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">
      ${navBig('我的', `<button class="nav-btn icon-only" data-act="editProfile" aria-label="编辑资料">${ic("pencil")}</button>`)}
    </div>

    <!-- 个人资料卡 -->
    <div class="card me-card">
      <div class="me-top">
        <!-- ⚠️ 2026-11-24（本轮，用户口径 Part 七①）：头像可点，弹出更换头像的入口 ——
             —— 用户口径：「当前头像不能变更；需支持点击头像，
                弹出更换头像照片的操作按钮 / 入口。」
             —— 为什么用「点头像」而不是再加一个按钮：
                头像是页面上唯一【属于我】的东西，也是最直观的一个。
                在头像右下角加一个小相机徽标，等于多一个要解释的图形；
                而「点自己的头像 → 换头像」是所有社交产品的通用动作，
                用户不需要学。
             —— ⚠️ 换完的头像是**全局**的：别处看到的「我」也是这张
                （见 avatars.js 的 ava()）。 -->
        <div class="me-ava tap" data-act="openAvatarPicker">
          ${ava(ME.name, 'xl ring')}
          <span class="me-ava-cam" aria-hidden="true">${ic('pencil')}</span>
        </div>
        <div class="me-info">
          <!-- ⚠️ 2026-11-24 用户口径（改）：「第一行老王，第二行 ID：A7K3M9（浅灰色字就行），
               第三方是性别、年龄、加入亏了XX天，字可以稍微小一点。」
               —— 所以信息区是【三行】，不是一堆小标签：
                  第一行：名字（大字，唯一的主角）
                  第二行：ID号（浅灰小字 —— 证件号是「备查」信息，不该抢戏）
                  第三行：性别 / 年龄 / 加入亏了 XX 天（小一点的字，安静地跟在后面）
               —— 为什么 ID号 不再跟其他项并排成一排标签：
                  其他三项是【他的属性】，ID号 是【他的编号】——
                  前者要一起被读，后者只是让人能报出他的号。放在独立一行、压成浅灰，
                  既能被人找到，又不参与「这个人是谁」的属性阅读。 -->
          <div class="me-name">${ME.name}</div>
          <div class="me-id">ID：${p.userCode}</div>
          <div class="me-sub">
            ${p.gender ? `<span>${p.gender}</span>` : ''}
            ${p.age ? `<span>${p.age}岁</span>` : ''}
            <span>${p.province || '中国'}</span>
            <span>加入亏了 ${myDaysInApp()} 天</span>
          </div>
          ${p.bio ? `<div class="me-bio">${p.bio}</div>` : ''}
        </div>
      </div>

      <!-- 三格社交数据：累计点赞 / 关注我 / 我见证过
           ⚠️ 2026-11-24 用户口径（最新）：
              · 「留言」这一格删掉 —— 三个数就够看了
              · 「关注」改叫「关注我」 —— 明确方向是「有多少人关注我」
              · 「见证」改叫「我见证过」 —— 讲「我当过见证席」这件事
           ⚠️ 2026-11-24（本轮，用户口径 Part 三①）：
              · 「点赞」改叫「累计点赞」 —— 这个数是历史累加的，
                叫「点赞」容易被理解成「我给别人点了多少赞」 -->
      <div class="me-stats cols3">
        <div class="me-stat">
          <div class="me-stat-v">${myLikeCount()}</div>
          <div class="me-stat-l">累计点赞</div>
        </div>
        <div class="me-stat">
          <div class="me-stat-v">${myFollowerCount()}</div>
          <div class="me-stat-l">关注我</div>
        </div>
        <div class="me-stat">
          <div class="me-stat-v">${STATE.witnessCount}</div>
          <div class="me-stat-l">我见证过</div>
        </div>
      </div>
    </div>

    <!-- ⚠️ 2026-11-24 用户口径（改）：「这个页面里的进行中、已达成、没做成不显示。」
         —— 三块状态磁贴整块删掉。
         —— 为什么删：资料卡底下的【社交数据】（点赞 / 关注我 / 我见证过）
            已经占了「概览」这个位置。再往下放「进行中 / 已达成 / 没做成」，
            两块都是概览、都是数字，读起来是**同一屏里两组互不相干的计数器**，
            反而互相削弱。而且这组状态数字在下面的「我的记录」列表里按状态列着，
            磁贴是重复（见 R2.15 / R2.20）。
         —— ⚠️ 只删「我的」页的这一块；用户主页（Ta 的主页）的三块磁贴保留
            —— 那是别人来看「Ta 的战绩」，没有「我的记录」列表可对照。 -->
    <div class="section">
      <div class="section-head">
        <div class="section-title">信用分</div>
        <div class="section-sub">${info('creditScore','sm')}</div>
      </div>
      <div class="credit-panel">
        <div class="credit-v" style="color:var(--brand)">${STATE.credit}<span class="credit-v-tier ${creditTierOf(STATE.credit).cls}">${creditTierOf(STATE.credit).name}</span></div>
        <div class="credit-lv">${STATE.credit >= 100 ? '已到顶' : `距下一等级还差 ${creditNextAt(STATE.credit) - STATE.credit} 分`}</div>
        <div class="bar" style="margin-top:14px"><i style="width:${(STATE.credit-60)/40*100}%"></i></div>
        <div class="credit-scale"><span>60</span><span>80 优秀</span><span>90 卓越</span></div>
      </div>
    </div>

    ${STATE.myFlags.length ? `
    <div class="section">
      <div class="section-head">
        <div class="section-title">我的记录</div>
        ${/* ⚠️ 2026-11-24（本轮）：「全部 ›」只在记录多于一屏时才显示 ——
             记录少的时候用户本来就在这一屏看得到，再跳一次是白跳。
             两处（「我的」页 / 「我的 Flag」页）现在共用同一份列表渲染。 */
          STATE.myFlags.length > 3
            ? `<span class="tiny muted" data-go="myFlags" style="color:var(--brand)">全部 ›</span>`
            : ''}
      </div>
      ${myRecordList()}
    </div>` : `
    <div class="section">
      <div class="section-head"><div class="section-title">我的记录</div></div>
      <div class="card" style="text-align:center;padding:26px 20px">
        <div style="width:50px;height:50px;border-radius:16px;margin:0 auto 12px;background:var(--brand-tint);color:var(--brand);display:flex;align-items:center;justify-content:center">
          ${ic("target")}
        </div>
        <div style="font-size:15px;font-weight:680">还没有任何记录</div>
        <div style="font-size:12.5px;color:var(--ink-3);margin-top:6px;line-height:1.7">立一个 Flag 之后，<br>打卡记录和结局都会留在这里</div>
        <button class="btn sm" style="margin-top:16px" data-go="${createEntryRoute()}">立第一个 Flag</button>
      </div>
    </div>`}

    <div class="section">
      <div class="section-head">
        <div class="section-title">功能</div>
      </div>
      <div class="list sparse">
        <div class="row tap" data-go="following"><div class="row-icon">${ic("users")}</div>
          <div class="row-main"><div class="row-title">我关注的人</div><div class="row-sub">${STATE.following.length ? `${STATE.following.length} 个人` : '关注后他新开的局你会看到'}</div></div>
          <span class="row-arrow">${ICON.chevR}</span></div>
        <!-- ⚠️ 2026-11-24（本轮）：「我监督的局」挪进「我的」页 ——
             原来它在【底部 Tab「监督」】里。底部那个位置让给了「通知」，
             而「我监督的局」是【我的东西】（跟「我关注的人」「我的记录」同一类），
             所以放这儿最自然。
             —— 列表页原样保留（带头像、进度条、取消监督 + 二次确认）。 -->
        <div class="row tap" data-go="subs"><div class="row-icon">${ic("eyeOpen")}</div>
          <div class="row-main"><div class="row-title">我监督的局</div><div class="row-sub">${STATE.subscribed.length ? `${STATE.subscribed.length} 个` : '在广场点眼睛就监督了这一局'}</div></div>
          <span class="row-arrow">${ICON.chevR}</span></div>
        <!-- ⚠️ 2026-11-24（本轮）：这一行的副标题改成【待判定数】——
             原来写的是「N 个局正在招募见证席」，
             但本轮见证席面板已经不再展示招募列表了（改走广场 + 通知），
             面板现在只管判定 —— 所以副标题要跟面板首屏对得上。 -->
        <div class="row tap" data-go="verdict"><div class="row-icon">${ic("bell")}</div>
          <div class="row-main"><div class="row-title">见证席面板</div><div class="row-sub">${(() => {
            const tasks = STATE.verdictTasks || [];
            const pending = tasks.filter(t => !t.myVerdict).length;
            return pending ? `${pending} 个节点待你判定` : (tasks.length ? '暂无待判定的节点' : '成为见证席后，判定节点会推给你');
          })()}</div></div>
          <span class="row-arrow">${ICON.chevR}</span></div>
        <!-- ⚠️ 2026-11-24（本轮）：「见证席候选池」这一行删掉 ——
             用户口径：「我的里面的见证席候选池还有必要单独设吗？
               因为筹备期可以在首页里面进入，感觉没太必要。」
             —— 候选池是【发起人】在筹备期挑人的工具，
                入口在首页筹备期的「从见证席候选池选」，不需要在「我的」页再放一个。
             —— 但候选池【页面本身保留】（首页那个入口还要用）。 -->
        <!-- ⚠️ 2026-11-23 用户口径：「我的页面，『申请成为见证席』整个删掉了，
             用户第一次通过点击『见证席面板』就能申请了。」—— 这一行已删。 -->
      </div>

      ${fold('更多功能', `
        <div class="list sparse" style="margin:0 -16px">
          <div class="row tap" data-go="witnessEarnings"><div class="row-icon">${ic("scale2")}</div>
            <div class="row-main"><div class="row-title">见证席收益</div></div>
            <span class="row-val">${STATE.witnessCount}</span><span class="row-arrow">${ICON.chevR}</span></div>
          <div class="row tap" data-go="supervisorCard"><div class="row-icon">${ic("ticket")}</div>
            <div class="row-main"><div class="row-title">我的记录卡</div><div class="row-sub">「我监督了 30 天」</div></div>
            <span class="row-arrow">${ICON.chevR}</span></div>
        </div>
      `, 'pf-more')}
    </div>

    <!-- ⚠️ 2026-11-24（本轮）：通知承诺说明挪到这里 ——
         原来它挂在【底部 Tab「监督」】页里，画成了四个可以拨动的开关
         （结局通知 / 断卡通知 / 判负通知 / 每日打卡提醒），但**全部点不动**。
         —— 那四行本质是【产品承诺的说明】，不是一个可以设置的东西：
            用户会本能地去拨它，拨完发现什么也没发生。
            用户之前就明确说过「没什么开关」。
         —— 现在它是【一行普通文字】，放在「法律与安全」区上方 ——
            断卡 / 判负 / 结算会提醒你；每日打卡不提醒。
            承诺说明放在这里是对的（它是全局规则，不是某个页面的东西）。 -->
    <div class="section">
      <div class="section-head"><div class="section-title">法律与安全</div></div>
      <div class="field-hint" style="margin:-4px 0 10px">
        断卡、判负、结算会通知你；每日打卡不提醒。所有通知都在「通知」里。
      </div>
      <div class="list sparse">
        <div class="row tap" data-go="agreement"><div class="row-icon">${ic("doc")}</div>
          <div class="row-main"><div class="row-title">用户协议</div></div><span class="row-arrow">${ICON.chevR}</span></div>
        <div class="row tap" data-go="privacy"><div class="row-icon">${ic("lock")}</div>
          <div class="row-main"><div class="row-title">隐私政策</div></div><span class="row-arrow">${ICON.chevR}</span></div>
        <div class="row tap" data-go="safeStop"><div class="row-icon">${ic("stop")}</div>
          <div class="row-main"><div class="row-title">安全减重须知</div></div><span class="row-arrow">${ICON.chevR}</span></div>
        <div class="row tap" data-go="depositAgreement"><div class="row-icon">${ic("wallet")}</div>
          <div class="row-main"><div class="row-title">押金协议</div></div><span class="row-arrow">${ICON.chevR}</span></div>
        <div class="row tap" data-go="appeal"><div class="row-icon">${ic("megaphone")}</div>
          <div class="row-main"><div class="row-title">客服 / 申诉</div><div class="row-sub">受理时限 15 个工作日</div></div>
          <span class="row-arrow">${ICON.chevR}</span></div>
      </div>
    </div>
  </div>
</div>`;
};

/* =========================================================
   15.5 编辑资料（全屏页）
   ⚠️ 2026-11-24（本轮，用户口径 Part 二）：
      1. 「编辑页改为全屏：右上角修改资料按钮当前为半屏弹出，改为全屏页面打开。」
      2. 「删除固定不可修改提示：删除『注册即固定不可修改』这句话。」

   —— 为什么从「居中小框」改成【全屏页面】：
      居中小框只适合「确认 / 取消」这种一秒决策的事。改资料是**填表**，
      五个字段摆在小框里要来回滚，而且小框有自己的滚动区，
      在半屏里滚两层非常难受 —— 全屏页有完整的滚动空间、固定的底部保存条。
   —— 底部条固定【保存】按钮 —— 跟立 Flag 的多步流程一致（全屏页 + 底部 CTA）。
   —— ⚠️ 【ID号 / 加入时间】依然不给改，但**不再写「不可修改」的解释**——
      用户口径明确要求删掉那句话（Part 二②）。
      字段本身保留（它们是资料的一部分），禁用态足够表达「这不能动」。
   ========================================================= */
PAGES.editProfile = () => {
  const p = myProfile();
  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('编辑资料')}</div>

    <div class="card edit-profile-card">
      <div class="field">
        <div class="field-label">ID号</div>
        <input class="input" value="${p.userCode}" disabled>
      </div>
      <div class="field">
        <div class="field-label">年龄</div>
        <input class="input" id="epAge" type="number" min="10" max="100" placeholder="你的年龄" value="${p.age || ''}">
      </div>
      <div class="field">
        <div class="field-label">性别</div>
        <select class="select" id="epGender">
          ${(ME.genders || ['男','女','保密']).map(g => `<option value="${g}" ${g===p.gender?'selected':''}>${g}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <div class="field-label">所在省份</div>
        <select class="select" id="epProv">
          <option value="">中国</option>
          ${(ME.provinces || []).map(pv2 => `<option value="${pv2}" ${pv2===p.province?'selected':''}>${pv2}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <div class="field-label">个性签名</div>
        <textarea class="textarea" id="epBio" maxlength="40" placeholder="一句话介绍你自己">${p.bio || ''}</textarea>
        <div class="field-hint">最多 40 字 —— 这句话会出现在你的资料页。</div>
      </div>
      <div class="field" style="margin-bottom:0">
        <div class="field-label">加入时间</div>
        <input class="input" value="${p.joinedAt || '—'}" disabled>
      </div>
    </div>

    <div class="sticky-cta">
      <button class="btn block" data-act="saveProfile">保存</button>
    </div>
  </div>
</div>`;
};

/* =========================================================
   16. 记录卡
   ⚠️ 2026-11-24 用户口径（改，本轮 7 条）：
      1. 「已结算了的亏了的项目，也有记录卡的，目前没有，参考『挣了』加上。」
      2. 「记录卡的设计上，挣了的记录卡搞错了，应该是体现用户赚回了押金，
           同时达成了自己的目标，很骄傲的文案。」
      3. 「这张卡片记的是过程，不是结果承诺。失败记录卡照样出图，
           而且和成功卡同规格 —— 围观者要的是完整的结局。这种说明删掉。」
      4. 「『这张卡上写的是什么』整个删掉。」
      5. 「『记录卡』中的『生成我的记录卡』按钮取消，
           用户点击分享按钮后可直接分享。」
      6. 「记录卡上增加记录点赞数、留言数、监督人数、见证席人数，
           T1 轻见证就不用了。」

   —— 落法：
      · 卡片按【真实 Flag】渲染（不再是写死的假数据）——
        挣了 / 亏了两种结局都有卡，同一张卡模板。
      · 成功卡文案改口径：讲【赚回押金 + 达成目标 + 骄傲】，
        不再是「我按自己的方式记录了 30 天」这种中性过程叙述。
      · 说明性文字块（「这张卡片记的是过程…」+「这张卡上写的是什么」）整块删除。
      · 底部只留一个「分享」按钮 —— 点开就是分享半屏。
      · 卡片底部加 4 个互动计数：点赞 / 留言 / 监督 / 见证席。
   ========================================================= */

/** 记录卡的结局口径 —— 成功与失败**两套文案**
 *  ⚠️ 2026-11-24：成功卡不能是中性过程叙述 ——
 *     用户要求「体现用户赚回了押金，同时达成了自己的目标，很骄傲的文案」。
 *     失败卡才回到「过程记录」的口径（强调坚持，不写「失败」大字）。
 */
function recordCardOutcome(f) {
  const success = f && f.status === 'success';
  const days = f ? (f.checkedDays || 0) : 0;
  const total = f ? (f.totalDays || f.days || 0) : 0;
  const start = f ? f.startWeight : 0;
  const end = f ? f.curWeight : 0;
  const lost = f ? (f.lostAmount || 0) : 0;
  const refund = f ? (f.refunded || f.depositPaid || f.deposit || 0) : 0;
  const drop = Math.max(0, Math.round((start - end) * 10) / 10);

  if (success) {
    const reached = end <= f.targetWeight;
    return {
      /* 挣了 —— 骄傲的口吻：押金回来了 + 目标达成了 */
      badge: '记录卡',
      title: '我说到做到',
      /* ⚠️ 副标题保留「挣了 N 元」的对称口径（R6.3）——
         但后面接一句「押金全额拿回」，把「挣」具体化成「押金回来了」。 */
      sub: `${f.user.name} 的 ${total} 天 · 挣了 ${refund} 元（押金全额拿回）`,
      result: '挣回了全部押金',
      resultCls: 'mint',
      /* 骄傲感来自三件事：押金拿回 / 目标达成 / 有人见证 */
      proud: [
        { k: '押金', v: `${refund} 元`, d: '一分没少，全部退回' },
        { k: '目标', v: `${start} → ${end} kg`, d: reached ? '说到做到，达成目标' : '这一局我做到了' },
        { k: '见证', v: `${f.witnesses.length} 位见证席`, d: `有人盯着的 ${total} 天` },
      ],
      stats: [
        [String(days), '坚持天数'],
        [String(total), '打卡天数'],
        [String(drop), '减重 kg'],
      ],
    };
  }
  /* 亏了 —— 口径回到「过程记录」：强调坚持，不写红色失败大字 */
  return {
    badge: '记录卡',
    title: '我按自己的方式记录了这些天',
    sub: `${f.user.name} 的 ${total} 天 · 亏了 ${lost} 元`,
      result: `差 ${Math.max(0, Math.round((end - f.targetWeight) * 10) / 10)} kg 没到目标`,
      resultCls: 'outline',
    /* 失败卡讲的是「坚持了什么」—— 不写失败，写过程 */
    proud: [
      { k: '押金', v: `亏了 ${lost} 元`, d: '认账，下一局再来' },
      { k: '体重', v: `${start} → ${end} kg`, d: `减了 ${drop} kg` },
      { k: '坚持', v: `${days} / ${total} 天`, d: '没到终点，但没停' },
    ],
    stats: [
      [String(days), '坚持天数'],
      [String(days), '打卡天数'],
      [String(drop), '减重 kg'],
    ],
  };
}

/**
 * 记录卡的【海报主体】—— 一张可分享的图
 * ⚠️ 2026-11-24 用户口径：「用户点击『分享这张记录卡』，
 *    直接这个这卡片，包括下面的 4 个记录，截一张图分享就很好。」
 * —— 所以【凭据主体 + 4 个互动计数 + 品牌落款】必须裹在同一个 .rc-poster 里：
 *    它就是「一张可分享的图」的完整边界（截图时不会把 4 个计数切在图外）。
 *
 * ⚠️ 2026-11-24（本轮，用户口径 Part 一②）：
 *    「结束目标详情页底部『看记录卡』和『分享这一局』两个按钮合并为一个，
 *     仅保留【分享记录卡】。」
 * —— 合并之后，**分享半屏里的那张海报必须能自己渲染出来** ——
 *    因为用户不再经过「记录卡页」这一层了。
 *    所以把海报抽成一个独立函数，两处共用：
 *      ① 记录卡页（PAGES.recordCard）
 *      ② 目标详情页的「分享记录卡」半屏
 */
function recordCardPoster(f) {
  const o = recordCardOutcome(f);
  const likes = f ? likeCountOf(f.id) : 0;
  const msgs = f ? ((f.pubMsgs && f.pubMsgs.length) || (f.msgs && f.msgs.length) || 0) : 0;
  const sup = f ? (f.supervisorCount || 0) : 0;
  const wit = f ? (f.witnesses || []).length : 0;
  return `
    <div class="receipt">
      <div class="receipt-head">
        <!-- ⚠️ 2026-11-24 用户口径：「增加产品的名字『亏了』，
             如何表现不会突兀但是人能看到？」
          —— 品牌落在【卡头右上角的一枚小徽标】：柴犬头像（狗头形象）+ 白字「亏了」，
             位置在视线第一落点，但不与标题抢注意力。 -->
        <div class="rc-badge">
          <img class="rcb-dog" src="assets/dog_new.png" alt="亏了">
          <span class="rcb-word">亏了</span>
        </div>
        <div class="rc-kicker">${o.badge}</div>
        <div class="rc-title">${o.title}</div>
        <div class="rc-sub">${o.sub}</div>
      </div>
      <div class="receipt-body">
        <div class="receipt-weight">
          <span class="w-from">${f.startWeight}</span>
          <span class="w-arrow">→</span>
          <span class="w-to">${f.curWeight}</span>
          <span class="w-unit">kg</span>
        </div>
        <div class="receipt-stats">
          ${o.stats.map(s => `<div class="receipt-stat"><div class="rs-v">${s[0]}</div><div class="rs-l">${s[1]}</div></div>`).join('')}
        </div>
      </div>
      <!-- ⚠️ 2026-11-24：挣了的卡要体现「赚回押金 + 达成目标」的骄傲感 ——
           所以这一块不是一句话，而是三行【拿到了什么】。 -->
      <div class="rc-proud">
        ${o.proud.map(p => `
        <div class="rc-proud-row">
          <span class="rpp-k">${p.k}</span>
          <span class="rpp-v">${p.v}</span>
          <span class="rpp-d">${p.d}</span>
        </div>`).join('')}
      </div>
      ${f.quote ? `<div class="receipt-quote"><span>${f.quote}</span></div>` : ''}
      <div class="receipt-foot">
        <div style="display:flex;gap:7px;align-items:center">
          <!-- ⚠️ 2026-11-24 用户口径：「记录卡上增加记录点赞数、留言数、监督人数、见证席人数，
               T1 轻见证就不用了。」
               —— 所以【T1 档位标签不显示】（T1 = 轻见证，信息量太低，不值得占一个标签位）。
                  见证席人数改由下面的「见证席」计数承担。 -->
          ${f.tier === 'T1' ? '' : `<span class="tag ${f.tier==='T0'?'outline':f.tier==='T2'?'brand':'violet'}">${f.tier}</span>`}
          <span class="tag ${o.resultCls}">${o.result}</span>
        </div>
        <span style="font-size:12px;color:var(--ink-4)">${f.start ? f.start.slice(0,10) : ''}</span>
      </div>
    </div>

    <!-- ⚠️ 2026-11-24 用户口径：「记录卡上增加记录点赞数、留言数、监督人数、见证席人数，
         T1 轻见证就不用了。」
         —— 所以【T1 档位标签不显示】（T1 是「轻见证」，信息量太低，不值得占一个标签位），
            换成 4 个互动计数。 -->
    <div class="rc-counts">
      <div class="rc-count">
        <span class="rcc-ico">${ic("thumbsUp")}</span>
        <span class="rcc-v">${likes}</span>
        <span class="rcc-l">点赞</span>
      </div>
      <div class="rc-count">
        <span class="rcc-ico">${ic("message")}</span>
        <span class="rcc-v">${msgs}</span>
        <span class="rcc-l">留言</span>
      </div>
      <div class="rc-count">
        <span class="rcc-ico">${ic("eyeOpen")}</span>
        <span class="rcc-v">${sup}</span>
        <span class="rcc-l">监督</span>
      </div>
      <div class="rc-count">
        <span class="rcc-ico">${ic("users")}</span>
        <span class="rcc-v">${wit}</span>
        <span class="rcc-l">见证席</span>
      </div>
    </div>

    <!-- ⚠️ 2026-11-24 用户口径：「增加产品的名字『亏了』，
         如何表现不会突兀但是人能看到？希望其他人知道是这个产品。」
      —— 卡底一行【品牌落款】：狗头形象 +「亏了」+ 一句产品 slogan。
         它是这张图流出到微信群 / 朋友圈时，别人第一眼能认出的落款。 -->
    <div class="rc-brand">
      <img class="rcb-dog" src="assets/dog_new.png" alt="亏了">
      <span class="rcb-name">亏了</span>
      <span class="rcb-sep"></span>
      <span class="rcb-slogan">公开立目标，熟人见证</span>
    </div>`;
}

PAGES.recordCard = (id) => {
  const f = findFlag(id) || FLAGS.f_success || FLAGS.f_5;

  return `
<div class="screen-scroll">
  <div class="page">
    <!-- ⚠️ 2026-11-24：右上角「?」按结局指向不同的规则说明 ——
         挣了看【记录卡规则】，亏了看【失败记录卡】。 -->
    <div class="nav">${navRow('记录卡', f.status === 'success'
      ? `<button class="nav-btn" data-info="recordCard">?</button>`
      : `<button class="nav-btn" data-info="failCard">?</button>`)}</div>

    <div class="rc-poster" id="rcPoster">
    ${recordCardPoster(f)}
    </div><!-- /.rc-poster -->

    <!-- ⚠️ 2026-11-24 用户口径：「用户点击『分享这张记录卡』，
         直接这个这卡片，包括下面的 4 个记录，截一张图分享就很好，
         现在是点击以后，进入一个专门的页面，那个效果不好。」
      —— 所以不再跳独立的 share 页，而是就地升起【分享半屏】，
         半屏顶部就是这张海报（所见即所得），下面是分享渠道。 -->
    <div class="sticky-cta">
      <button class="btn block" data-act="shareRecordCard" data-id="${f.id}">${ic("upload")} 分享这张记录卡</button>
    </div>
  </div>
</div>`;
};


/* =========================================================
   17. 监督席记录卡
   ========================================================= */
PAGES.supervisorCard = () => `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('我的记录卡', `<button class="nav-btn" data-info="supervisorCard">?</button>`)}</div>

    <div class="receipt" style="background:linear-gradient(160deg,var(--brand-400) 0%,var(--brand-600) 100%);box-shadow:0 16px 44px rgba(169,79,12,.3)">
      <div class="receipt-head" style="background:transparent;padding:24px 22px 20px">
        <div class="rc-kicker">监督席记录卡</div>
        <div class="rc-title">我围观了一个 30 天的 Flag</div>
        <div class="rc-sub">见证席 4 位 · 监督 37 人</div>
      </div>
      <div class="receipt-body">
        <div class="receipt-stats">
          <div class="receipt-stat" style="background:rgba(255,255,255,.12)">
            <div class="rs-v" style="color:#fff">30</div><div class="rs-l" style="color:rgba(255,255,255,.75)">围观天数</div></div>
          <div class="receipt-stat" style="background:rgba(255,255,255,.12)">
            <div class="rs-v" style="color:#fff">12</div><div class="rs-l" style="color:rgba(255,255,255,.75)">互动次数</div></div>
          <div class="receipt-stat" style="background:rgba(255,255,255,.12)">
            <div class="rs-v" style="color:#fff">3</div><div class="rs-l" style="color:rgba(255,255,255,.75)">留言数</div></div>
        </div>
      </div>
      <div class="receipt-quote" style="background:rgba(255,255,255,.14);color:#fff;margin-bottom:18px">
        <span>「我看着呢」</span></div>
    </div>

    <div class="section">
      <div class="section-head"><div class="section-title">这张卡的特点</div></div>
      <div class="list">
        <div class="row"><div class="row-main"><div class="row-title">叙事</div></div>
          <span class="row-val brand">「我参与了别人的故事」</span></div>
        <div class="row"><div class="row-main"><div class="row-title">可复制性</div></div>
          <span class="row-val brand">高 · 多人可发同一张</span></div>
        <div class="row"><div class="row-main"><div class="row-title">接力性</div></div>
          <span class="row-val brand">高</span></div>
      </div>
      <!-- ⚠️ 2026-11-24（本轮）：「记录卡可以导出分享」删掉 ——
           这是【操作说明】：页面上就有一个「分享」按钮，用户点得到。
           留着只是噪音，还会把同一块里真正重要的说明（可复制性 / 接力性）淹掉。 -->
    </div>

    <div class="sticky-cta">
      <button class="btn block" data-go="share">分享出去</button>
    </div>
  </div>
</div>`;

/* =========================================================
   18. 互动（已删）
   ⚠️ 2026-11-24 用户口径（本轮）：「支持与留言」页整个删掉 ——
   —— 原因：全站**没有任何入口**指向它（零死链）。
      留言功能早就搬到了两处：
        ① 广场卡片的留言按钮 → 底部半屏（openMsgSheet）
        ② 目标详情页目标卡下方的留言框
      这页只剩「预设短语 + 四段说明文字」，而且预设短语也早被删了
      （用户口径：「点赞删除掉短语选择，就改成一个普通的点击按钮」）。
   —— 留着的风险：从左栏导览点进去会看到一套已经废弃的留言交互，
      看原型的人会以为产品里留言的正确入口是这个页面。
   ============================================================ */

/* =========================================================
   19. 提出异议（仅监督席）
   ========================================================= */
PAGES.objection = () => {
  const f = findFlag(routeId) || FLAGS.f_3;
  /* ⚠️ 2026-11-24 用户口径（改）：「提出异议这一页，只需要展示当天的照片，不需要之前的。」
     —— 以前这里列的是最近 8 天的打卡照（还带「已看过 N / 3」的计数），
        现在只放【今天拍的】—— 固定 4 格，不足补空位，点开进放大查看器。
     —— 同时，「至少看过 3 天才能投」的前置条件【整个删掉】（见 R4.3）：
        异议页是「看完今天的照片就能投」，不再要求用户先逛三天。 */
  const row = todayPhotosRow(f);
  const SLOTS = 4;
  const cells = [];
  for (let i = 0; i < SLOTS; i++) {
    const x = row[i];
    if (x) {
      cells.push(`
        <div class="tr-cell" data-act="openPhoto" data-id="${f.id}"
             data-kind="${x.kind}" data-src="${x.src}" data-idx="${i}">
          <img src="${x.src}" alt="Ta 今天的照片 ${i+1}" loading="lazy">
          ${x.kind === 'checkin' ? `<span class="tr-d">第 ${x.day} 天</span>` : ''}
        </div>`);
    } else {
      cells.push('<div class="tr-cell tr-empty"></div>');
    }
  }
  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('提出异议')}</div>

    <!-- ⚠️ 2026-11-24 用户口径（改）：整段「异议是「对事」，判定是「对人」……
         需满 3 票才会转人工复核 —— 恶意异议扣分 -8」说明【整个删掉】——
         那是【给设计者看的规则说明】，不是给用户看的内容；
         规则保留在右上角「?」弹层（INFO.witnessSystem）与文档层。 -->

    <!-- ⚠️ 2026-11-24 用户口径：「为了让整个 demo 更接近真实的软件的使用的感觉……」
         —— 以前投完异议就没下文了，但真实软件里投完是有一段【等待期】的：
            票在攒，攒够 3 票转人工。所以这里补上「我已经投过了 / 现在什么进度」。 -->
    ${(() => {
      const mine = objectionsOf(f.id).filter(o => o.myVote);
      if (!mine.length) return '';
      const o = mine[0];
      const st = { waiting: '等待更多监督席投票', reviewing: '已转人工复核', passed: '异议成立', rejected: '异议不成立' };
      return `
    <div class="st-banner ${o.status==='reviewing'?'amber':o.status==='passed'?'mint':'rose'}" style="margin-top:12px">
      <div class="st-ico">${ic('alert')}</div>
      <div class="st-main">
        <div class="st-t">你已提出异议 · ${st[o.status] || o.status}</div>
        <div class="st-d">${o.node} · ${o.ts} · ${o.votes} / ${o.need} 票</div>
        <div class="st-r">${o.reason}</div>
      </div>
    </div>`;
    })()}

    <!-- ⚠️ 2026-11-24 用户口径：「只需要展示当天的照片，不需要之前的。」 -->
    <div class="section" style="margin-top:0">
      <div class="section-head">
        <div class="section-title">今天的照片</div>
      </div>
      <div class="today-row">${cells.join('')}</div>
      ${row.length ? '' : `
      <div class="card" style="padding:18px;text-align:center">
        <div style="font-size:13px;color:var(--ink-3)">Ta 今天还没有拍照</div>
      </div>`}
    </div>

    <div class="card mt">
      <!-- ⚠️ 2026-11-24（本轮修复）：「当前进度」原来写死「1 / 3 票」——
         不管用户投没投过异议、投了几次，都显示 1/3。
         —— 现在它读【我在这局上最新的那条异议】的真实票数。
            没投过异议时，这整块不显示（没有进度可言）。 -->
      ${(() => {
        const mine = objectionsOf(f.id).filter(o => o.myVote);
        if (!mine.length) return '';
        const o = mine[0];
        const need = o.need || 3;
        const left = Math.max(0, need - (o.votes || 0));
        const bar = o.status === 'reviewing' ? 'amber' : o.status === 'passed' ? 'mint' : 'rose';
        return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:13.5px;font-weight:650">当前进度</div>
        <div style="font-size:13px;font-weight:700;color:var(--${bar})">${o.votes || 0} / ${need} 票</div>
      </div>
      <div style="display:flex;gap:6px">
        ${Array.from({length: need}, (_, i) => `
          <div style="flex:1;height:6px;border-radius:3px;background:${i < (o.votes || 0) ? `var(--${bar})` : 'var(--line)'}"></div>`).join('')}
      </div>
      <div class="center tiny muted" style="margin-top:8px">${
        o.status === 'reviewing' ? '已启动人工复核'
        : o.status === 'passed' ? '异议成立'
        : o.status === 'rejected' ? '异议不成立'
        : `再需 <b>${left}</b> 票即启动人工复核`
      }</div>`;
      })()}

      <div style="font-size:13.5px;font-weight:650;margin:18px 0 10px">异议理由 <span style="color:var(--rose)">*</span>
        <span class="tiny muted" style="font-weight:400">至少选一条</span></div>
      <div class="list" style="box-shadow:none;border:1px solid var(--line)">
        ${OBJECTION_REASONS.map((r, i) => `
        <div class="row"><div class="row-main">
          <div class="row-title">${r.t}</div><div class="row-sub">${r.d}</div></div>
          <div class="switch" data-obj-reason="${i}"></div></div>`).join('')}
      </div>
      <!-- ⚠️ 2026-11-24 用户口径：「只能选证据相关的理由 —— 不能对「进度」提异议」删掉。
           （理由清单本身保留 —— 上面那几项全都是证据相关的。） -->

      <div style="font-size:13.5px;font-weight:650;margin:16px 0 8px">补充说明 <span class="tiny muted" style="font-weight:400">选填</span></div>
      <textarea class="textarea" id="objNote" placeholder="说说你的怀疑依据…"></textarea>

      <div style="font-size:13.5px;font-weight:650;margin:16px 0 8px">上传物证 <span class="tiny muted" style="font-weight:400">选填</span></div>
      <button class="btn ghost block" style="height:60px;font-size:13.5px">${ic("paperclip")} 上传截图 / 对比图</button>

      <!-- ⚠️ 2026-11-24 用户口径：「至少看过 3 天的打卡照片才能提交异议」删掉 ——
           按钮【不再有前置禁用态】，看完今天的照片就能投。
           ⚠️ 2026-11-24（本轮修复）：这个按钮原来只有 data-toast ——
              点下去弹一句「异议已提交」就结束了，**异议根本没进库**：
              state.js 里的 submitObjection() 逻辑是齐的（3 票上限、状态机），
              但从来没有被调用过 —— 所以「你已提出异议」的进度条、通知里的
              「我提的异议」、人工复核链路全是走不到的死逻辑。
           —— 现在按钮真的走 submitObjection()，选中的理由一起提交。 -->
      <button class="btn block mt" data-act="submitObjection" data-id="${f.id}">提交异议</button>
      <div class="center tiny muted mt">异议成立 +1 信用分；不成立 -8 ${info('creditScore','sm')}</div>
    </div>

    <!-- ⚠️ 2026-11-24 用户口径：「你的名字对平台实名，对发起人匿名……
         每个 Flag 全周期最多提 3 次，超出不计入统计。」删掉。 -->
  </div>
</div>`;
};

/* =========================================================
   20. 我监督的局（从「我的」页进入）
   ⚠️ 2026-11-24（本轮）：这个页面原来是【底部 Tab「监督」】，现在改成
      「我的」页功能区的一个二级页面 —— 因为底栏那个位置让给了「通知」。
   —— 内容变化：
      · 「我监督的 Flag」列表 —— 原样保留（带头像、进度条、取消监督 + 二次确认）
      · 「我提的异议」—— 挪到【通知】页（异议本来就是靠通知推送的，见 R2.21）
      · 4 行假开关 —— 整个删掉（那是产品承诺说明，不是能设置的东西）
   ============================================================ */
PAGES.subs = () => `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">
      ${navRow('我监督的局')}
    </div>

    <div class="section" style="margin-top:0">
      <div class="section-head">
        <div class="section-title">我监督的 Flag</div>
        <div class="section-sub">${STATE.subscribed.length} 个</div>
      </div>
      ${STATE.subscribed.length ? `
      <div class="list">
        ${STATE.subscribed.map(id => {
          const f = FLAGS[id];
          const left = daysLeft(f);
          const done = f.status === 'failed' || f.status === 'success';
          const prog = Math.round(f.checkedDays / f.totalDays * 100);
          return `
        <div class="row tap" data-go="flagDetail" data-id="${id}" style="align-items:flex-start;padding:13px 16px">
          ${ava(f.user.name, 'sm')}
          <div class="row-main">
            <div class="row-title">${f.user.name}</div>
            <div class="row-sub" style="margin-top:2px">${f.title.slice(0,14)}${f.title.length>14?'…':''}</div>
            <div class="bar ${f.status==='broken'?'rose':f.status==='ending'?'amber':done?'':'mint'}" style="margin-top:8px">
              <i style="width:${prog}%"></i>
            </div>
            <div class="row-sub" style="margin-top:5px;font-size:11px">${f.checkedDays}/${f.totalDays} 天${done?'':` · 剩 ${left} 天`}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:0 0 auto">
            ${statusPill(f)}
            <!-- ⚠️ 2026-11-23 用户口径：「我监督的 Flag，把右边的按钮改为『取消监督』，
                 用户点击后，小窗二次确认。」
                 —— 原来是开关，现在换成明确的文字按钮 + 二次确认。
                 —— ⚠️ 2026-11-24（本轮）：二次确认【保留在这里】——
                    广场卡片和详情页的眼睛图标是轻量的一下切换（那里没有整行可点），
                    但这里是列表页、取消是不可逆的，必须确认。 -->
            <button class="btn ghost sm" data-act="doUnsubscribe" data-id="${id}">取消监督</button>
          </div>
        </div>`;
        }).join('')}
      </div>` : `
      <div class="card" style="text-align:center;padding:30px 20px">
        <div style="width:52px;height:52px;border-radius:16px;margin:0 auto 13px;background:var(--brand-tint);color:var(--brand);display:flex;align-items:center;justify-content:center">
          ${ic("eyeOpen")}
        </div>
        <div style="font-size:15.5px;font-weight:680">还没监督任何人</div>
        <div style="font-size:12.5px;color:var(--ink-3);margin-top:6px;line-height:1.7">监督之后，别人 Flag 的断卡和结局<br>第一时间推给你</div>
        <button class="btn sm" style="margin-top:16px" data-go="square">去广场挑一个</button>
      </div>`}
    </div>

    <!-- ⚠️ 2026-11-24 用户口径：「断卡、判负、结算正常提醒，没什么开关。
         每日打卡不提醒。」
         —— 这里【不再有任何开关】：断卡 / 判负 / 结算一律会提醒（这是产品承诺），
            每日打卡【不提醒】（那是用户自己的事，不该用推送去追）。
         —— 改成【纯说明】，把开关去掉。
         ⚠️ 2026-11-24（本轮）：这一整块【挪到「我的」页的法律与安全区】——
            它是【全局的产品承诺】说明，不是「我监督的局」这一页该承载的东西。
            放在这儿会让用户以为这是可以逐条设置的东西。 -->
  </div>
</div>`;

/* =========================================================
   20b. 我关注的人（见需求规格 R2.12）
   ⚠️ 关注的是【人】—— 他新开的局我会看到。
      与「监督」不同：监督盯的是一局的结局通知，关注盯的是一个人。
   ========================================================= */
PAGES.following = () => {
  const names = myFollowing();
  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('我关注的人')}</div>
    ${names.length ? `
    <div class="list">
      ${names.map(name => {
        const up = userProfile(name);
        const running = up ? up.running.length : 0;
        return `
      <div class="row tap" data-go="userProfile" data-id="${name}">
        ${ava(name, 'sm')}
        <div class="row-main">
          <div class="row-title">${name}</div>
          <div class="row-sub">${up ? `信用 ${up.credit} · ${up.creditTier.name}` : '这个人已经不在广场上了'}${running ? ` · ${running} 局进行中` : ''}</div>
        </div>
        <button class="btn xs ghost" data-act="doFollow" data-name="${name}">已关注</button>
      </div>`;
      }).join('')}
    </div>
    <div class="field-hint mt">关注后，他新开的 Flag 会出现在广场里 —— 你能看到，不算监督。</div>
    ` : `
    <div class="empty-hero" style="margin-top:10px">
      <div class="empty-ico">${ic("users")}</div>
      <div class="empty-t">还没关注任何人</div>
      <div class="empty-s">在某个人的主页点「关注」，<br>他新开的局你会第一时间看到</div>
      <button class="btn block" style="margin-top:18px" data-go="square">去广场看看别人的 Flag</button>
    </div>`}
  </div>
</div>`;
};

/* =========================================================
   21. 通知（底部 Tab · 2026-11-24 本轮升级）
   ⚠️ 为什么升级：
      原来通知只藏在【首页右上角一个铃铛】里，是二级入口 ——
      用户在别的页面想看通知得先回首页。而这个产品的通知密度本来就高：
      待判定 / 留言 / 见证席邀请 / 断卡 / 结算 / 异议进展，每一类都"错过要出事"。
      现在通知是【底部 Tab】，带未读角标。

   ⚠️ 为什么分两栏：
      通知有三类 ——【要我做事】【告诉我结果】【别人对我有动作】。
      第一类不处理就会有后果（错过判定节点 / 见证席邀约过期 / 异议被刷掉），
      混在平铺列表里会被埋掉 —— 所以单独成栏（收件箱性质）。
   ============================================================ */

/** 通知的一行 —— 「要我行动」的带动作按钮
 *  ⚠️ 2026-11-24（本轮，用户口径 Part 六①）：**支持左滑删除** ——
 *  —— 用户口径：「通知条目支持左滑删除；当前没有该操作，需补上。」
 *  —— 结构：每一行包在 `.swipe` 里 ——
 *        .swipe           定位容器（overflow:hidden）
 *          .swipe-del     底层【删除按钮】（红色，在右边）
 *          .swipe-content  上层【内容】（可以左右拖）
 *     手指往左拖 → .swipe-content 露出底下的删除按钮 → 松手停在「删除」位置，
 *     再左拖 / 点删除 → 删掉这条通知。
 *  —— 为什么不做成「直接左滑就删」：
 *     直接删**没有反悔机会** —— 通知里可能有「见证席邀请 · 12 小时过期」这种
 *     删错了要出事的。停在删除按钮上、点一下才删，是**两步确认**。
 */
function notifRow(n) {
  const expired = !!n.expired;
  const done = !!n.done;   /* 已判定 —— 灰态、无动作按钮 */
  /* ⚠️ 2026-11-24（本轮）：通知行压扁 ——
     —— 时间从【底部那一行】提到【正文行的右边】；
        正文只留一行；
        动作按钮也【并到正文行右边】，不再单独占一行。
     —— 这样做为什么：通知是一个「扫一眼」的列表 —— 重要的信息在标题里；
        动作按钮是少数派，绝大多数通知本来就没有按钮，
        原来每条通知都白白占一行（时间那行 + 按钮那行）。
     —— 压扁后：有按钮的、没按钮的，高度统一在一行半以内。

     ⚠️ 2026-11-24（本轮，用户口径改）：正文行改成【上下居中对齐】——
        原来用的是 baseline（基线对齐），而正文是 12px 小字、时间是 11px 更小字，
        基线对齐会让正文浮在上面、时间和按钮沉到下面去，看起来「偏下」。
        —— 现在整行用 center 对齐：正文、时间、按钮在同一条水平中线上。 */
  const hasAct = !!(n.act || expired) && !done;
  /* 行本身带跳转目标时整行可点（点行 = 标记已读 + 跳过去） */
  const rowGo = (n.go && !expired && n.act !== 'replyInvite')
    ? ` data-go="${n.go}" data-id="${n.goId || ''}"` : '';
  return `
  <div class="swipe" data-swipe>
    <button class="swipe-del" data-act="dismissNotif" data-key="${n.key}">${ic('close')}<span>删除</span></button>
    <div class="swipe-content notif-row ${n.unread ? 'unread' : ''} ${done ? 'done' : ''}" data-notif-key="${n.key}"${rowGo}>
      <div class="notif-ico">${ic(n.icon)}</div>
      <div class="notif-main">
        <div class="notif-title">${n.title}</div>
        <div class="notif-line">
          <div class="notif-body">${n.body || ''}</div>
          ${n.ts ? `<span class="notif-ts">${n.ts}</span>` : ''}
        </div>
      </div>
      ${hasAct ? `
      <div class="notif-acts">
        ${n.act === 'replyInvite' && !expired ? `
          <span class="notif-act ghost" data-act="declineInvite" data-id="${n.goId || ''}">拒绝</span>
          <span class="notif-act" data-act="replyInvite" data-id="${n.goId || ''}">接受</span>` : ''}
        ${n.act && n.act !== 'replyInvite' && !expired
          ? `<span class="notif-act" data-act="${n.act}" data-id="${n.goId || ''}" data-go="${n.go || ''}">${n.actLabel}</span>` : ''}
        ${expired ? `<span class="notif-act expired">${n.actLabel}</span>` : ''}
      </div>` : ''}
      ${n.unread ? '<span class="notif-dot"></span>' : ''}
    </div>
  </div>`;
}

PAGES.notifs = () => {
  const tab = notifTab();
  const list = notifsOf(tab);
  const nAll = unreadNotifCountOf('all');
  const nAct = unreadNotifCountOf('action');
  const tabs = [
    { k: 'all', label: '全部', n: nAll },
    { k: 'action', label: '判定·邀请', n: nAct },
  ];
  return `
<div class="screen-scroll">
  <div class="page">
    <!-- ⚠️ 2026-11-24（本轮修复）：「全部已读」的显示条件原来写的是
         STATE.notifs.length（只有【静态种子】通知的长度）。
         —— 但角标数的是 unreadNotifCount()，那个走 allNotifs()，
            **包含现算出来的**「待判定 / 见证席邀请 / 异议进展」。
         —— 结果：STATE.notifs 初始是 []，所以角标亮着 3、4、5，
            右上角却**根本没有「全部已读」这个按钮** ——
            用户看得到未读数，却找不到清除入口。
         —— 现在条件统一用 unreadNotifCount()：有未读才显示。 -->
    <div class="nav">${navBig('通知', unreadNotifCount() > 0 ? `<span class="tiny muted" data-act="readAllNotifs">全部已读</span>` : '')}</div>

    <!-- ⚠️ 2026-11-24（本轮）：通知分两栏 ——
         「全部」= 所有通知；「判定·邀请」= 需要我行动的那部分。 -->
    <div class="seg notif-seg">
      ${tabs.map(t => `
      <button class="${tab === t.k ? 'on' : ''}" data-act="setNotifTab" data-tab="${t.k}">
        ${t.label}${t.n ? ` <b class="seg-n">${t.n}</b>` : ''}
      </button>`).join('')}
    </div>

    ${list.length ? `
    <div class="notif-list">
      ${list.map(notifRow).join('')}
    </div>` : (tab === 'action' ? `
    <div class="empty-hero" style="margin-top:10px">
      <div class="empty-ico">${ic("checkCircle")}</div>
      <div class="empty-t">没有要你处理的事</div>
      <div class="empty-s">待判定的节点、见证席邀请、异议进展<br>都会出现在这里</div>
      <button class="btn block" style="margin-top:18px" data-go="square">去广场看看别人的 Flag</button>
    </div>` : `
    <div class="empty-hero" style="margin-top:10px">
      <div class="empty-ico">${ic("bell")}</div>
      <div class="empty-t">还没有通知</div>
      <div class="empty-s">断卡提醒、见证席判定、结局通知<br>都会出现在这里</div>
      <button class="btn block" style="margin-top:18px" data-go="square">去广场看看别人的 Flag</button>
    </div>`)}

    <!-- ⚠️ 2026-11-24（本轮）：「我提的异议」从「监督」页挪到这里 ——
         异议本来就是靠通知推送的（有新票、有转人工、有结果），
         它属于「需要你关注的事」，正好是通知的范畴。
         —— 只有「全部」栏展示完整列表（含已出结果的）；
            「判定·邀请」栏里，投票中的异议已经作为【待办】出现了。 -->
    ${tab === 'all' ? (() => {
      const objs = myObjections();
      if (!objs.length) return '';
      const st = { waiting: '等待投票', reviewing: '人工复核中', passed: '异议成立', rejected: '异议不成立' };
      return `
    <div class="section">
      <div class="section-head">
        <div class="section-title">我提的异议</div>
        <div class="section-sub">${objs.length} 条</div>
      </div>
      <div class="list">
        ${objs.map(o => `
        <div class="row tap" data-go="objection" data-id="${o.flagId}" style="align-items:flex-start;padding:13px 16px">
          <div class="row-icon" style="background:var(--rose-tint);color:#B03B40">${ic('alert')}</div>
          <div class="row-main">
            <div class="row-title">${o.flagUser} · ${o.node}</div>
            <div class="row-sub" style="margin-top:2px">${o.reason}</div>
            <div class="row-sub" style="margin-top:5px;font-size:11px">
              ${o.votes} / ${o.need} 票 · ${o.ts}
              ${o.status === 'waiting' ? `· <b style="color:var(--rose)">还差 ${o.need - o.votes} 票转人工</b>` : ''}
            </div>
          </div>
          <div style="flex:0 0 auto;align-self:center">
            <span class="tag ${o.status==='passed'?'brand':o.status==='rejected'?'coral':'outline'}">${st[o.status] || o.status}</span>
          </div>
        </div>`).join('')}
      </div>
    </div>`;
    })() : ''}
  </div>
</div>`;
};

/* =========================================================
   23. 分享
   ========================================================= */
PAGES.share = () => `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('分享')}</div>

    <div class="card">
      <div style="font-size:13.5px;font-weight:650;margin-bottom:11px">带码版 <span class="tiny muted" style="font-weight:400">微信朋友圈 / 群</span></div>
      <div class="voucher" style="padding:16px">
        <div class="v-no">立据 · 编号 A7K3M9</div>
        <div class="v-line"></div>
        <div class="v-kv"><span class="v-k">发起人</span><span class="v-v">老王</span></div>
        <div class="v-kv"><span class="v-k">目标</span><span class="v-v">68.4kg → 63.4kg / 30 天</span></div>
        <div class="v-kv"><span class="v-k">见证席</span><span class="v-v">@小李 @阿May @大壮 @小美</span></div>
        <div class="v-qr">
          <img class="v-qr-img" src="assets/qr_voucher.png" alt="扫码见证">
          <div class="v-qr-cap">扫码见证</div>
        </div>
      </div>
      <button class="btn block mt" data-toast="已分享到微信">分享到微信</button>
    </div>

    <div class="card mt">
      <div style="font-size:13.5px;font-weight:650;margin-bottom:11px">无码版 <span class="tiny muted" style="font-weight:400">小红书 / 微博等站外</span></div>
      <div class="note" style="font-size:14px;line-height:1.8;color:var(--ink-2)">
        <div style="font-size:15px;font-weight:650;color:var(--ink);margin-bottom:8px">30 天，我挣回了 500 块</div>
        起始 68.4 → 最后一天 64.6kg ｜ 打卡 26/30 天 ｜ 见证席 4 位
      </div>
      <div class="field-hint mt">
        ${ic("alert")} 无码版<b>不含任何码、不提微信</b> —— 一张图同时带码 + 提到微信，在小红书是<b>双重违规</b>。
        ${info('spread','sm')}
      </div>
      <button class="btn ghost block mt" data-toast="已复制话术">复制话术</button>
    </div>

    <div class="section">
      <div class="section-head">
        <div class="section-title">三条传播铁律</div>
        <div class="section-sub">${info('spread','sm')}</div>
      </div>
      <div class="list">
        <div class="row"><div class="row-icon">${ic('num1')}</div><div class="row-main">
          <div class="row-title">用「X 人监督」不用「X 人围观」</div><div class="row-sub">更有分量，也更符合实际</div></div></div>
        <div class="row"><div class="row-icon">${ic('num2')}</div><div class="row-main">
          <div class="row-title">记录卡不承诺效果</div></div></div>
        <div class="row"><div class="row-icon">${ic('num3')}</div><div class="row-main">
          <div class="row-title">不做小红书带码图</div></div></div>
      </div>
    </div>
  </div>
</div>`;

/* =========================================================
   25. 见证席召集令
   ⚠️ 2026-11-22 用户口径（改）：「用户点击『发布见证席召集令』，
      不用单独进入一个页面，按钮变成了『见证席召集令已发布』，
      然后点击『见证席召集令已发布』，有个从下往上的半框，能展示报名的情况就行。」
   —— 所以召集令【没有独立页面】：文案用弹层确认，报名情况用半屏。
   ============================================================ */

/** 召集令文案 —— 发布前给用户看一眼（发布是对外动作，不能黑箱操作）
 *
 * ⚠️ 2026-11-23 用户口径（改）：「文案很差，重新调整，突出为什么要找见证。
 *      为什么第一句不写体重 ——『我押了 500 块，30 天后见分晓』说的是押注，
 *      不暴露体重、不暴露减肥意图，羞耻感最低；等对方点进来成为见证席，
 *      再看到具体目标。先承诺，后揭示。删掉，解释不需要」
 *
 * 写法要点：
 *   ① 首句只说【押注】，不露体重、不露减肥意图 —— 先承诺，后揭示
 *   ② 中间必须回答「为什么要找见证」—— 不是描述任务，而是给出【理由】：
 *      押金结局不由我一个人说了算 + 有人盯着才不容易放弃
 *   ③ 对方要做的事要说得轻（点几下而已），别把人吓跑
 */
function recruitCopy() {
  return `我押了 500 块，30 天后见分晓。<br>
    这钱最后归谁，不是我一个人说了算 —— 到期得有人替我判定，到底做到没做到。<br>
    我中途会不会偷懒，也一样得有人到点来看一眼。<br>
    <br>
    所以还差 <b>2 位见证人</b>。你要做的事很简单：30 天里在 <b>4 个节点</b>各点一下判定。<br>
    被人盯着，是我不中途放弃的理由。<br>
    <br>
    敢来的扫码，编号 A7K3M9。<br>
    <b>做成不好，我丢的是自己的脸。</b>`;
}

/* =========================================================
   26. 押金选择 / 支付（已删）
   ⚠️ 2026-11-24 用户口径（本轮）：旧的「选择押金 / 支付押金 / 押金已支付」
      三页链路整个删掉 ——
   —— 原因：立 Flag 的分步引导第 3、4 步（③ 押多少 / ④ 交押金）已经内联了
      「选档位」和「确认支付」这两件事，这三页是上一版的遗留，
      全站**没有任何入口**走得到（零死链）。
   —— 留着的风险：从左栏导览点进去会看到一套已经废弃的押金支付流程，
      看原型的人会以为产品有两套押金支付方式。
   —— 押金的关键信息（押多少 / 挣了退多少 / 亏了扣多少 / 到账时限）
      现在统一在第 4 步「交押金」那一屏说完，不再分散在两页里重复。
   ============================================================ */

/* =========================================================
   27. 文本协议页
   ========================================================= */
function textPage(title, html) {
  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow(title)}</div>
    <div class="card">
      ${html}
    </div>
  </div>
</div>`;
}
const T = {s:'font-size:13.5px;line-height:1.9;color:var(--ink-2);margin-bottom:10px'};

PAGES.agreement = () => textPage('用户协议', `
  <div style="font-size:14.5px;font-weight:680;margin-bottom:8px">一、产品性质</div>
  <p style="${T.s}">本产品是<b>记录与监督工具</b>，不是减重、健身或健康指导项目。本产品不提供医疗建议；如需减重请咨询专业医师。</p>
  <div style="font-size:14.5px;font-weight:680;margin:18px 0 8px">二、结果认定依据</div>
  <p style="${T.s}">本产品的奖励对象是<b>用户完全可控的行为</b>（提交物证、按时打卡、如实称重），不是任何随机结果。</p>
  <div style="font-size:14.5px;font-weight:680;margin:18px 0 8px">三、押金条款</div>
  <p style="${T.s}">押金由持牌支付机构独立代收、逐用户独立记账、专款专用，不归集为资金池、不向任何用户分配。失败扣收部分不构成平台收益。达标必须 100% 全额退还。退还时限 ≤ 3 个工作日。</p>
  <div style="font-size:14.5px;font-weight:680;margin:18px 0 8px">四、监督席权利限制</div>
  <p style="${T.s}">监督席<b>永远只有"看"和"传"两项权力，没有判定权</b>，且不享有任何经济利益。</p>
  <div style="font-size:14.5px;font-weight:680;margin:18px 0 8px">五、失败记录</div>
  <p style="${T.s}">失败记录将被永久留痕，不可删除。用户在发起时对此已有单独确认。</p>
  <div style="font-size:14.5px;font-weight:680;margin:18px 0 8px">六、争议处理</div>
  <p style="${T.s}">任何判负均提供申诉通道，申诉受理时限 15 个工作日。</p>
`);

PAGES.privacy = () => textPage('隐私政策', `
  <div style="font-size:14.5px;font-weight:680;margin-bottom:8px">一、物证照片</div>
  <p style="${T.s}">打卡照片<b>在平台内公开</b> —— 广场卡片、目标详情页、打卡日历条对<b>平台内所有用户</b>可见，<b>原图不打码</b>，含<b>秤上的体重读数与拍摄背景</b>。这是本产品的核心机制，<b>不提供关闭开关</b>。默认体重私密。<b>明确不用于 AI 训练</b>。</p>
  <div style="font-size:14.5px;font-weight:680;margin:18px 0 8px">二、敏感个人信息</div>
  <p style="${T.s}">体重、身高、围度属<b>敏感个人信息</b>，需单独同意方可采集。</p>
  <div style="font-size:14.5px;font-weight:680;margin:18px 0 8px">三、定位</div>
  <p style="${T.s}">可选，仅用于打卡地点一致性，<b>不做持续采集</b>。不做后台定位。</p>
  <div style="font-size:14.5px;font-weight:680;margin:18px 0 8px">四、拍照提示</div>
  <p style="${T.s}">请避开卧室、浴室等私密空间；画面里如有他人，<b>先征得对方同意</b>。</p>
`);

PAGES.safeStop = () => textPage('安全减重须知', `
  <div style="font-size:14.5px;font-weight:680;margin-bottom:10px">加入前该问的 8 个问题</div>
  <ol style="font-size:13.5px;line-height:2.1;color:var(--ink-2)">
    <li>你的目标体重是安全的吗？（不要低于医生给你建议的下限）</li>
    <li>你会在 30 天内改变用药吗？</li>
    <li>你能接受每周至少 3 次打卡吗？</li>
    <li>你知道失败会被永久留痕吗？</li>
    <li>你能接受体重平台期吗？</li>
    <li>你会为了打卡而作弊吗？</li>
    <li>你的押金是能承受的损失吗？</li>
    <li>你有医生支持吗？</li>
  </ol>
  <div style="font-size:14.5px;font-weight:680;margin:18px 0 8px">禁止行为（抓到即除名 + 留痕 + 扣信用分）</div>
  <ul style="font-size:13.5px;line-height:1.95;color:var(--ink-2)">
    <li>• 暴食后称重 / 为操控体重而灌水</li>
    <li>• 催吐（自诱导呕吐）</li>
    <li>• 过度脱水</li>
    <li>• 对秤读数做手脚（换秤、垫脚、遮挡数字）</li>
    <li>• 修图伪造物证</li>
    <li>• 期间进行减重手术 / 使用减重药物</li>
    <li>• 找他人代称</li>
  </ul>
`);

PAGES.depositAgreement = () => textPage('押金协议', `
  <div style="font-size:14.5px;font-weight:680;margin-bottom:8px">一、退还条件</div>
  <p style="${T.s}">达标：100% 全额退还。失败：按信用等级扣收 20% / 25% / 30% / 35% / 40%，剩余部分全额退还。</p>
  <div style="font-size:14.5px;font-weight:680;margin:18px 0 8px">二、退还流程</div>
  <p style="${T.s}">结算后自动发起退款，无需用户申请。</p>
  <div style="font-size:14.5px;font-weight:680;margin:18px 0 8px">三、处理时限</div>
  <p style="${T.s}">≤ 3 个工作日原路退回。</p>
  <div style="font-size:14.5px;font-weight:680;margin:18px 0 8px">四、押金金额与扣除标准、计算方式</div>
  <p style="${T.s}">押金可选区间 = [周期下限, min(信用等级上限, 周期上限)]，发起前明示区间与可选档位。</p>
  <p style="${T.s}">实际扣除金额 = 押金 × 信用等级对应扣收比例。</p>
  <div style="font-size:14.5px;font-weight:680;margin:18px 0 8px">五、不可扣除的情形</div>
  <p style="${T.s}">平台原因、不可抗力。</p>
  <div style="font-size:14.5px;font-weight:680;margin:18px 0 8px">六、争议处理与申诉渠道</div>
  <p style="${T.s}">24 小时申诉期 + 平台人工复核，受理时限 15 个工作日。</p>
`);

PAGES.appeal = () => {
  /* ⚠️ 2026-11-24 用户口径：「为了让整个 demo 更接近真实的软件的使用的感觉……」
     —— 以前这个页面只有 5 个静态入口，看不出「我提交的申诉怎么样了」。
        真实软件里，申诉是一个【有进度的流程】 —— 所以这里补上：
        ① 我正在进行的申诉（状态 + 进度 + 截止时间）
        ② 提交记录（已结案的那些） */
  const myFlags = STATE.myFlags || [];
  const appeals = myFlags.map(f => f.appeal ? { f, ap: f.appeal } : null).filter(Boolean);
  const reviewing = appeals.filter(x => x.ap.status === 'reviewing');
  const closed = appeals.filter(x => x.ap.status !== 'reviewing');
  const myObjs = (STATE.objections || []).filter(o => o.myVote);
  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('客服 / 申诉')}</div>

    <!-- ① 正在进行的申诉 -->
    ${reviewing.map(x => `
    <div class="st-banner amber" style="margin-bottom:12px">
      <div class="st-ico">${ic('clock')}</div>
      <div class="st-main">
        <div class="st-t">${x.ap.type} · 审核中</div>
        <div class="st-d">${x.f.title} · 提交于 ${x.ap.submittedAt} · ${x.ap.deadline}</div>
        <div class="st-r">${x.ap.reason}</div>
        <div class="ap-steps mt">
          <div class="ap-step done"><i>${ic('check')}</i><span>已提交</span></div>
          <div class="ap-step done"><i>${ic('check')}</i><span>材料核验</span></div>
          <div class="ap-step now"><i>3</i><span>人工复核</span></div>
          <div class="ap-step"><i>4</i><span>出结果</span></div>
        </div>
      </div>
    </div>`).join('')}

    <!-- ② 我提过的异议（也在申诉体系里） -->
    ${myObjs.length ? `
    <div class="section" style="margin-top:0">
      <div class="section-head"><div class="section-title">我提的异议</div></div>
      <div class="card">
        ${myObjs.map(o => {
          const st = { waiting: '等待投票', reviewing: '人工复核中', passed: '异议成立', rejected: '异议不成立' };
          return `
        <div class="mini">
          <span class="mini-k">${o.flagUser} · ${o.node}</span>
          <span class="mini-v" style="color:${o.status==='passed'?'var(--brand)':'var(--ink-3)'};font-weight:600">${st[o.status] || o.status}</span>
          <div style="font-size:11.5px;color:var(--ink-4);margin-top:2px">${o.votes} / ${o.need} 票 · ${o.ts}</div>
        </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- ③ 已结案 -->
    ${closed.length ? `
    <div class="section">
      <div class="section-head"><div class="section-title">已结案</div></div>
      <div class="card">
        ${closed.map(x => `
        <div class="mini">
          <span class="mini-k">${x.ap.type}</span>
          <span class="mini-v" style="color:var(--ink-3)">${x.ap.status === 'passed' ? '申诉成立 · 已退回' : '申诉不成立'}</span>
          <div style="font-size:11.5px;color:var(--ink-4);margin-top:2px">${x.f.title} · ${x.ap.submittedAt}</div>
        </div>`).join('')}
      </div>
    </div>` : ''}

    <div class="card">
      <div style="font-size:14.5px;font-weight:680;margin-bottom:11px">我要申诉</div>
      <div class="list" style="box-shadow:none;border:1px solid var(--line)">
        <div class="row tap"><div class="row-main"><div class="row-title">被判负 / 判负有异议</div></div>
          <span class="row-arrow">${ICON.chevR}</span></div>
        <div class="row tap"><div class="row-main"><div class="row-title">押金扣收有异议</div></div>
          <span class="row-arrow">${ICON.chevR}</span></div>
        <div class="row tap"><div class="row-main">
          <div class="row-title">打卡被判定无效</div><div class="row-sub">24 小时补交视频通道</div></div>
          <span class="row-arrow">${ICON.chevR}</span></div>
        <div class="row tap"><div class="row-main"><div class="row-title">信用分申诉</div></div>
          <span class="row-arrow">${ICON.chevR}</span></div>
        <div class="row tap"><div class="row-main"><div class="row-title">异议 / 留言处理</div></div>
          <span class="row-arrow">${ICON.chevR}</span></div>
      </div>
    </div>
    <div class="note mt">
      <b>受理时限</b>：15 个工作日
    </div>
  </div>
</div>`;
};

/* =========================================================
   28. 他人主页（长期档案）—— 见需求规格 R2.10
   ⚠️ 关键区分（用户 2026-11-21 明确提出）：
      「目标详情是这次打卡的记录，而用户的信息是用户长期的信息。」
      —— 目标详情页 = 【单局记录】；本页 = 【长期档案】：
         信用分、见证情况、历次 Flag、成就。
   ========================================================= */
PAGES.userProfile = (name) => {
  const up = userProfile(name);
  if (!up) {
    return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('用户主页')}</div>
    <div class="empty-hero" style="margin-top:10px">
      <div class="empty-ico">${ic("user")}</div>
      <div class="empty-t">找不到这个人</div>
      <div class="empty-s">他可能已经注销了账号</div>
    </div>
  </div>
</div>`;
  }
  const best = TIER_META[['T0','T1','T2','T3'][up.bestTier]] || TIER_META.T0;
  /* ⚠️ 关注按钮（见需求规格 R2.12）—— 关注【人】，不是某一局 */
  const following = isFollowing(up.name);
  /* ⚠️ 2026-11-24 用户口径：「点击看其他用户的主页的时候也是这样这个卡片的形式，
     删掉进行中、已达成、没做成，但需要保留 + 关注按钮」
     —— 所以「Ta 的主页」的资料卡改成和「我的」页【同一套形式】：
        左头像 + 右三行（名字 / ID号 / 性别·年龄·省份·加入亏了XX天）
        + 三格社交数据（点赞 / 关注我 / 我见证过）
        + 关注按钮
     —— 为什么别人的主页要跟「我的」页长得一样：
        一张卡两处用，用户看谁都是同一套读法 —— 不用学两次。
        如果「我的」页是横排、别人页是竖排居中，用户会以为这是两个不同的页面。 */
  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow(up.name)}</div>

    <!-- 资料卡（与「我的」页同一套形式，见需求规格 R2.20 ⑫） -->
    <div class="card me-card">
      <div class="me-top">
        <div class="me-ava">${ava(up.name, 'xl ring')}</div>
        <div class="me-info">
          <div class="me-name">${up.name}</div>
          <div class="me-id">ID：${up.userCode}</div>
          <div class="me-sub">
            ${up.gender ? `<span>${up.gender}</span>` : ''}
            ${up.age ? `<span>${up.age}岁</span>` : ''}
            <span>${up.province || '中国'}</span>
            ${up.daysInApp ? `<span>加入亏了 ${up.daysInApp} 天</span>` : ''}
          </div>
          ${up.bio ? `<div class="me-bio">${up.bio}</div>` : ''}
        </div>
      </div>

      <!-- 三格社交数据：累计点赞 / 关注我 / 我见证过（与「我的」页一致）
           ⚠️ 2026-11-24（本轮，用户口径 Part 三①）：「点赞」改叫「累计点赞」 -->
      <div class="me-stats cols3">
        <div class="me-stat">
          <div class="me-stat-v">${userLikeCount(up.name)}</div>
          <div class="me-stat-l">累计点赞</div>
        </div>
        <div class="me-stat">
          <div class="me-stat-v">${userFollowerCount(up.name)}</div>
          <div class="me-stat-l">关注我</div>
        </div>
        <div class="me-stat">
          <div class="me-stat-v">${userWitnessCount(up.name)}</div>
          <div class="me-stat-l">我见证过</div>
        </div>
      </div>

      <!-- 关注按钮（保留） -->
      ${up.isMe ? '' : `
      <div class="me-follow">
        <button class="btn ${following ? 'ghost' : ''} block" data-act="doFollow" data-name="${up.name}">
          ${following ? `${ic('check')} 已关注` : `${ic('plus')} 关注`}
        </button>
      </div>`}
    </div>

    <div class="section">
      <div class="section-head">
        <div class="section-title">信用分</div>
        <div class="section-sub">${info('creditScore','sm')}</div>
      </div>
      <div class="credit-panel">
        <div class="credit-v" style="color:var(--brand)">${up.credit}<span class="credit-v-tier ${up.creditTier.cls}">${up.creditTier.name}</span></div>
        <div class="credit-lv">${up.credit >= 100 ? '已到顶' : `距下一等级还差 ${creditNextAt(up.credit) - up.credit} 分`}</div>
        <div class="bar" style="margin-top:14px"><i style="width:${(up.credit-60)/40*100}%"></i></div>
        <div class="credit-scale"><span>60</span><span>80 优秀</span><span>90 卓越</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <div class="section-title">见证情况</div>
      </div>
      <div class="list">
        <div class="row"><div class="row-icon">${ic("gavel")}</div>
          <div class="row-main"><div class="row-title">当过见证席</div><div class="row-sub">为别人的 Flag 背过书</div></div>
          <span class="row-val">${up.witnessFlags} 次</span></div>
        <div class="row"><div class="row-icon">${ic("scale2")}</div>
          <div class="row-main"><div class="row-title">完整监督</div><div class="row-sub">从头跟到尾的局</div></div>
          <span class="row-val">${up.witnessFlags} 次</span></div>
        <div class="row"><div class="row-icon">${ic("checkCircle")}</div>
          <div class="row-main"><div class="row-title">判定成立率</div><div class="row-sub">判过的节点里成立的比例</div></div>
          <span class="row-val">${up.witnessRate ? up.witnessRate + '%' : '—'}</span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <div class="section-title">Ta 的 Flag</div>
        <div class="section-sub">${up.flags.length} 局</div>
      </div>
      <div class="list">
        ${up.flags.map(f => {
          const done = f.status === 'failed' || f.status === 'success';
          const m = done
            ? (f.status === 'success' ? ['mint', '挣了'] : ['', '亏了'])
            : ['brand', '进行中'];
          return `
        <div class="row tap" data-go="flagDetail" data-id="${f.id}">
          ${ava(f.user.name, 'sm')}
          <div class="row-main">
            <div class="row-title">${f.title}</div>
            <div class="row-sub">${f.totalDays} 天 · 打卡 ${f.checkedDays}/${f.totalDays} · ${TIER_META[f.tier].name}</div>
          </div>
          <span class="tag ${m[0]}">${m[1]}</span>
        </div>`;
        }).join('')}
      </div>
    </div>
  </div>
</div>`;
};

/* =========================================================
   29. Flag 菜单 / 立据
   ========================================================= */
PAGES.flagMenu = (id) => {
  /* ⚠️ 2026-11-21：新增「取消这个 Flag」入口（见需求规格 R1.6）
     取消 = 一局没撑完，按失败结算 —— 押金不退还。
     入口做得很淡：它是例外通道，不是常规操作。
     ⚠️ 2026-11-24（本轮，用户口径 Part II⑦）：这个「取消这个 Flag」**删掉** ——
     —— 用户口径：「删除目标详情右上角『・・・』菜单中的
        『取消 Flag（取消后押金不退还）』选项，该选项不再保留。」
     —— 所以这个菜单页里不再有取消入口（canCancel 那段整块删掉）。
        详情页正文底部那个「取消这个 Flag」入口也一并删（见 R2.27⑥）——
        也就是说产品里**不再有「主动取消」这条路**。
     —— 保留的是这个菜单里的另外三项（打卡历史 / 立据凭证 / 分享）。 */
  const f = findFlag(id) || myMainFlag();
  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('我的 Flag')}</div>
    <div class="list">
      <div class="row tap" data-go="checkinLog"><div class="row-icon">${ic("calendar")}</div>
        <div class="row-main"><div class="row-title">打卡历史</div></div>
        <span class="row-arrow">${ICON.chevR}</span></div>
      <div class="row tap" data-go="credDetail"><div class="row-icon">${ic("clipboard")}</div>
        <div class="row-main"><div class="row-title">「立据」凭证</div><div class="row-sub">不可编辑的承诺凭证</div></div>
        <span class="row-arrow">${ICON.chevR}</span></div>
      <div class="row tap" data-go="share"><div class="row-icon">${ic("upload")}</div>
        <div class="row-main"><div class="row-title">分享</div></div>
        <span class="row-arrow">${ICON.chevR}</span></div>
    </div>

    <!-- ⚠️ 2026-11-24（本轮，用户口径 Part II⑦）：「取消这个 Flag」入口**整块删除** ——
         —— 用户口径：「删除目标详情右上角『・・・』菜单中的
            『取消 Flag（取消后押金不退还）』选项，该选项不再保留。」
         —— 原来这里有一块「取消这个 Flag + 取消后押金不退还」，
            现在**整块删掉**。 -->

    <div class="note mt">
      发起后规则已锁死，<b>不可改目标、不可改规则</b>。24 小时筹备期已过，名单已冻结。${info('rulesLock','sm')}
    </div>
  </div>
</div>`;
};

PAGES.credDetail = () => `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('立据凭证')}</div>
    <div class="voucher">
      <div class="v-no">立据 · 编号 A7K3M9</div>
      <div class="v-line"></div>
      <div class="v-kv"><span class="v-k">发起人</span><span class="v-v">老王</span></div>
      <div class="v-kv"><span class="v-k">目标</span><span class="v-v">68.4kg → 63.4kg / 30 天</span></div>
      <div class="v-kv"><span class="v-k">见证席</span><span class="v-v">@小李 @阿May @大壮 @小美</span></div>
      <div class="v-kv"><span class="v-k">监督席</span><span class="v-v">37 人</span></div>
      <div class="v-kv"><span class="v-k">押金</span><span class="v-v">500 元（30 天 · 区间 500–2000）</span></div>
      <div class="v-line"></div>
      <div class="v-kv"><span class="v-k">随机词</span><span class="v-v">青柑</span></div>
      <div class="v-kv"><span class="v-k">时间戳</span><span class="v-v">2026-09-08 09:41:07 锁定</span></div>
      <div class="v-qr">
        <img class="v-qr-img" src="assets/qr_voucher.png" alt="扫码查看立据">
        <div class="v-qr-cap">扫码见证</div>
      </div>
      <div class="v-foot">「这张图是承诺的开始，30 天后，这里会有结局。」</div>
    </div>
    <div class="note mt">
      <b>这张凭证会更新结局。</b>发起后「立据」页持续更新，最终显示：挣了 / 亏了。
      ${info('credible','sm')}
    </div>
  </div>
</div>`;

/* =========================================================
   「监督这一局」独立页（已删）
   ⚠️ 2026-11-24（本轮）：这个页面整个删掉 ——
   —— 原因：它和广场卡片上的眼睛图标做的是【同一件事】，却要走两条路：
      广场：点眼睛 → 一下就监督成功
      详情页：点「监督这一局」→ 进这个页 → 页里还有一个大眼睛图标
              + 三个装样子的开关（结局通知 / 断卡通知 / 判负通知，**点了根本不动**）
              → 再点「确认监督」才生效
   —— 那三个假开关是最伤的：它们**看起来可以关掉，实际点了没反应**。
      用户会以为「我把断卡通知关了」，结果什么也没发生 ——
      这种「假可用」比没有这个功能更让人困惑。
   —— 用户之前就明确说过「没什么开关」。
   —— 现在详情页底部的「监督这一局」改成了和广场一样的眼睛图标（见 flagDetail 页）。
   ============================================================ */

/* 打卡详情（物证详情）—— 按 flagId + day 定位
   ⚠️ 见需求规格 R2.5：照片在平台内公开给所有人 —— 围观者点日历条就能看原图 */
PAGES.checkinLogItem = (id, day) => {
  const f = findFlag(id) || myMainFlag() || FLAGS.f_own;
  const photos = photosOf(f);
  const d = day || (photos.length ? photos[photos.length - 1].d : 1);
  const p = photos.find(x => x.d === d) || null;
  const isMiss = !p || p.st === 'miss';
  /* 看过 = 记一笔「他看过这天的物证」（⚠️ 2026-11-24 起不再承担异议前置，见 R4.3） */
  if (p && p.src) markEvidenceSeen(f.id, d);
  const prev = photos.filter(x => x.d < d).slice(-1)[0];
  const w = p && p.w ? p.w : null;
  const wPrev = prev && prev.w ? prev.w : null;
  const delta = (w && wPrev) ? (w - wPrev).toFixed(1) : null;
  const dateStr = isoAddDays(f.start, d - 1).slice(5);
  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow(`第 ${d} 天 · ${dateStr}`)}</div>

    <!-- 打卡照片：平台内公开，不打码（见需求规格 R2.5） -->
    ${isMiss ? `
    <div class="ev-photo ev-miss">
      ${ic("close")}
      <div style="font-size:14px;font-weight:600;margin-top:6px">这一天没有打卡</div>
      <div style="font-size:11.5px;opacity:.72;margin-top:3px">断卡 · 连续天数归零</div>
    </div>` : `
    <div class="ev-photo">
      <img src="${p.src}" alt="第 ${d} 天打卡照片">
      <div class="ev-wm">${f.user.name} · ${dateStr} · 服务器时间 + 编号</div>
      ${p.st === 'makeup' ? '<div class="ev-badge">补卡</div>' : ''}
    </div>`}

    ${isMiss ? '' : `
    <div class="tiles c2 mt">
      ${tile(w ? w.toFixed(1) : '—', '当日体重 kg')}
      ${tile(delta !== null ? (delta > 0 ? '+' + delta : delta) : '—', '较昨日 kg', delta !== null && delta <= 0 ? 'brand' : '')}
    </div>`}

    <!-- ⚠️ 当天的心情 / 体悟（见需求规格 R2.11）
         打卡照是【物证】，这句话是【内容】—— 围观者除了看照片，还能看到这天的留言。 -->
    ${(() => {
      const nt = noteOf(f, d);
      if (!nt) return '';
      return `
    <div class="ev-note">
      <div>${nt}</div>
    </div>`;
    })()}

    <!-- ⚠️ 2026-11-23 用户口径：「目标详情中的打卡日历，点进去以后，
         能看到见证席的审核情况，只需要最终结果就行，
         不用展开审核人数、多少人通过、多少人判定这种。」
         —— 所以打卡详情里只放一块【最终结果】，不写人数、不写比例。 -->
    ${(() => {
      const vd = dayVerdictOf(f, d);
      if (!vd) return '';
      const cls = vd.state === 'pass' ? 'mint' : vd.state === 'fail' ? 'rose' : 'amber';
      const ico = vd.state === 'pass' ? 'checkCircle' : vd.state === 'fail' ? 'close' : 'clock';
      return `
    <div class="card mt">
      <div style="display:flex;align-items:center;gap:9px">
        <span class="ev-verdict-ico ${cls}">${ic(ico)}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13.5px;font-weight:680">${vd.text}</div>
          <div style="font-size:12px;color:var(--ink-3);margin-top:2px">${vd.detail}</div>
        </div>
      </div>
    </div>`;
    })()}

    <div class="card mt">
      <div style="font-size:13.5px;font-weight:650;margin-bottom:9px">AI 轻量校验</div>
      <div style="font-size:13px;color:var(--ink-2);line-height:1.95">
        <div class="chk">${ic("checkCircle")}<span>服务端水印已压</span></div>
        <div class="chk">${ic("checkCircle")}<span>手写随机词「青柑」匹配</span></div>
      </div>
      <div class="divider"></div>
      <div class="note">记录只追加，写入后不提供编辑接口。纠错走「作废并重打」并留痕。${info('antiCheat','sm')}</div>
    </div>

    <!-- 同一局的其他打卡照片（围观者能一路翻下去） -->
    ${photos.length > 1 ? `
    <div class="section">
      <div class="section-head"><div class="section-title">这一局的打卡照片</div>
        <div class="section-sub">${photos.filter(x=>x.src).length} 张</div>
      </div>
      <div class="feed-strip" style="padding:0;overflow-x:auto;gap:6px">
        ${photos.slice().reverse().map(x => `
          <div class="fs-cell ${x.st==='miss'?'miss':''} ${x.d===d?'last':''}" style="flex:0 0 62px" data-go="checkinLogItem" data-id="${f.id}" data-day="${x.d}">
            ${x.src ? `<img src="${x.src}" alt="第 ${x.d} 天">` : ''}
          </div>`).join('')}
      </div>
    </div>` : ''}

    <!-- 该 Flag 的补充照片（生活照）—— 见需求规格 R2.6
         ⚠️ 与上面的打卡照是【两套东西】：打卡照 = 物证，这里 = 内容 -->
    ${(() => {
      const ex = extraPhotosOf(f);
      if (!ex.length) return '';
      return `
    <div class="section">
      <div class="section-head"><div class="section-title">Ta 的生活照</div>
        <div class="section-sub">${ex.length} 张</div>
      </div>
      <div class="ex-gallery">
        ${ex.map((x, i) => `
          <div class="eg-cell ${i===0?'cover':''}">
            <img src="${x.src}" alt="生活照 ${i+1}" loading="lazy">
            ${i===0 ? '<i class="eg-badge">封面</i>' : ''}
          </div>`).join('')}
      </div>
      <div class="field-hint" style="margin-top:8px">生活照是 Ta 自己发的生活片段 —— 不是打卡物证。</div>
    </div>`;
    })()}
  </div>
</div>`;
};

/* =========================================================
   29. 申请见证席
   ⚠️ 2026-11-23 用户口径（改）：「我的页面，『申请成为见证席』整个删掉了，
      用户第一次通过点击『见证席面板』就能申请了，这里不需要单独弄一个页面。
      当用户在见证席面板中，点击申请成为见证席，会在页面中间弹出一个小框，
      评估用户是否达到见证席的标准。」
   —— 所以【没有独立页面】了。申请入口在见证席面板，
      点了弹【居中小框】当场评估够不够格。
   下面的 witnessApplyDialogHTML() 是那个小框的内容（app.js 的 applyWitness 动作渲染）。
   ============================================================ */

/**
 * 「申请成为见证席」小框的内容
 * ⚠️ 2026-11-24 用户口径（改，本轮）：
 *    「成为见证席的理由，简化为累计完成 10 次互动就行了，点赞或留言，
 *      同时这个页面简化，信息太多了，不用太多解释性的说明。」
 *
 * —— 所以这一版做了三件事：
 *    ① 门槛从「完整监督 1 次（至少监督 1 个 Flag 三天 · 期间互动过一次）」
 *       换成【累计互动 10 次】（点赞或留言都算 1 次）—— 门槛更直白、更好懂。
 *    ② **删掉所有解释性说明**：担保人/平台审核/判定次数/漏报误报 那四行明细、
 *       「够格了。」那段话、进度条下方的解释句 —— 全删。
 *    ③ 只留【三样东西】：门槛是什么 + 当前进度 + 够不够格。
 *
 * —— 为什么删得这么狠 —— 这一屏是【一个门槛 + 一个按钮】。
 *    规则细节（判定怎么算、漏报怎么扣）都在右上角「?」里，
 *    小框里重复一遍只会让人读不完、然后随便点掉。
 */
function witnessApplyDialogHTML() {
  const need = witnessApplyNeed();
  const done = Math.min(need, interactionCount());
  const ok = canApplyToPool();
  return `
  <div class="wa-req">
    <div class="wa-req-top">
      <span class="wa-req-tag">成为见证席的条件</span>
      <span class="wa-req-count ${ok?'ok':''}">${done} / ${need}</span>
    </div>
    <div class="wa-req-title">累计互动 ${need} 次</div>
    <div class="wa-req-sub">点赞或留言都算 1 次</div>
    <div class="wa-req-bar"><i style="width:${Math.round(done/need*100)}%"></i></div>
    <div class="wa-req-foot">
      ${ok
        ? `<span class="wa-req-yes">${ic("checkCircle","",15)} 已满足</span>`
        : `<span class="wa-req-no">${ic("alert","",15)} 还差 ${need - done} 次</span>`}
    </div>
  </div>
  ${ok ? '' : `
  <button class="btn ghost block" data-act="goSquareFromApply">${ic("compass")} 去广场互动</button>
  `}
  `;
}

/* =========================================================
   30-2. 招募详情（点广场「招募中」横条进来的那个页面）
   ⚠️ 2026-11-24（本轮新增）。用户口径：
      「点击进入以后，我建议是招募的情况，单独新设计一个页面，
        让用户知道目前招募的状态，立的flag是什么，能点击头像进入用户介绍。」

   —— 为什么单独做一个页面（而不是进目标详情页）：
      目标详情页是给【围观者】看的：看体重、看打卡照片、看留言。
      而从「招募中」点进来的人心里问的是完全不同的问题 ——
      【这一局现在招募得怎么样？我值不值得参加？】
      这三个问题在目标详情页里一个都答不了：
      那里没有坑位图、没有报名人数、没有截止时间。
   —— 页面四块内容：
      ① 发起人（头像可点 → 用户主页）
      ② 他立的 Flag 是什么（标题 / 体重 / 周期 / 押金）
      ③ 招募状态（核心：坑位 / 报名数 / 接受数 / 截止倒计时）
      ④ 已经报名的人（公开名单 —— 用户要判断「跟他一起当见证席的都是什么人」）
   ========================================================= */
PAGES.recruitDetail = (id) => {
  const f = findFlag(id);
  if (!f || !f.recruiting) {
    return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('招募详情')}</div>
    <div class="empty-hero" style="margin-top:10px">
      <div class="empty-ico">${ic("clipboard")}</div>
      <div class="empty-t">这一局已经不在招募了</div>
      <div class="empty-s">可能已经招满，或者招募已经截止</div>
    </div>
  </div>
</div>`;
  }
  const up = userProfile(f.user.name);
  const witnesses = f.witnesses || [];
  const accepted = witnesses.filter(w => (w.status || 'accepted') === 'accepted');
  const apps = (f.recruitApplicants || []).filter(a => a.status !== 'declined');
  const acceptedApps = apps.filter(a => a.status === 'accepted');
  const joined = witnessApplying(f.id);
  const ms = recruitRemainMs(f);
  /* ⚠️ 2026-11-24（本轮，用户口径 Part 五①）：见证席人数上限**统一为 10 人** ——
     —— 用户口径：「招募状态里的『已有见证席』人数上限固定为 10 人，
        不区分目标或个人，所有已有见证席统一按 10 人计；
        当前的三点（占位 / 不定人数）展示方式不合适，需去除。」
     —— 所以这里**不再按周期算坑位**（WITNESS_SLOTS_BY_DAYS 那种 2/3/4/4 的分档），
        一律用 WITNESS_MAX = 10。
     —— 为什么统一：坑位数分档是【判定节点数】的口径（见 R5.4），
        跟「这局能招几个见证席」本来就不是一回事 ——
        拿它当招募上限，等于把「几个节点要判」和「能招几个人」混成一个数。
        招募上限就是一个固定的、可预期的数字：10。
     —— 三个点的占位展示也删掉（见下面那一行）。 */
  const slots = WITNESS_MAX;
  const filled = accepted.length + acceptedApps.length;

  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('招募详情')}</div>

    <!-- ① 发起人 —— 头像可点进用户主页 -->
    <div class="card rd-owner">
      <div class="rd-ava tap" data-go="userProfile" data-id="${f.user.name}">${ava(f.user.name, 'lg')}</div>
      <div style="flex:1;min-width:0">
        <div class="rd-owner-name">${f.user.name}</div>
        ${up ? `
        <div class="rd-owner-id">ID：${up.userCode}</div>
        <div class="rd-owner-sub">
          ${up.gender ? `<span>${up.gender}</span>` : ''}
          ${up.age ? `<span>${up.age} 岁</span>` : ''}
          ${up.province ? `<span>${up.province}</span>` : ''}
          ${up.daysInApp ? `<span>加入亏了 ${up.daysInApp} 天</span>` : ''}
        </div>` : ''}
      </div>
      ${statusPill(f)}
    </div>

    <!-- ② 他立的 Flag 是什么 -->
    <div class="section">
      <div class="card rd-goal">
        <div class="rd-goal-t">${f.title}</div>
        <div class="rd-goal-s">起始 ${f.startWeight}kg → 目标 ${f.targetWeight}kg</div>
        <div class="rd-goal-meta">
          <span>${f.days} 天</span>
          <span>押金 ¥${depositPaidOf(f)}</span>
          <span>已有 ${accepted.length} 位见证席</span>
        </div>
      </div>
    </div>

    <!-- ③ 招募状态 —— 这一页的核心 -->
    <div class="section">
      <div class="section-head">
        <div class="section-title">招募状态</div>
      </div>
      <div class="card rd-status">
        <div class="rd-st-row">
          <span class="rd-st-k">已有见证席</span>
          <!-- ⚠️ 2026-11-24（本轮，用户口径 Part 五①）：三个点的占位展示**删掉** ——
               —— 用户口径：「当前的三点（占位 / 不定人数）展示方式不合适，需去除。」
               —— 原因：三个点画的是「按周期分的坑位档」（2/3/4），
                  现在上限统一是 10 人 —— 画 3 个点却写着「2 / 10」，
                  点和数字对不上，是**自相矛盾**的视觉。
               —— 现在只留一个数字：已招 N / 10。 -->
          <span class="rd-st-v">${filled} / ${slots}${filled < slots ? ` · 还差 ${slots - filled} 位` : ' · 已招满'}</span>
        </div>
        <div class="rd-st-row">
          <span class="rd-st-k">已报名</span>
          <span class="rd-st-v">${apps.length} 位</span>
        </div>
        <div class="rd-st-row">
          <span class="rd-st-k">已接受</span>
          <span class="rd-st-v">${acceptedApps.length} 位</span>
        </div>
        <div class="rd-st-row">
          <span class="rd-st-k">招募截止</span>
          <span class="rd-st-v rd-st-clock" data-recruit-clock="${f.id}">${fmtRecruitRemain(ms)}</span>
        </div>
      </div>
    </div>

    <!-- ④ 已经报名的人 —— 名单公开，用户要判断「跟他一起当见证席的都是什么人」 -->
    ${apps.length ? `
    <div class="section">
      <div class="section-head">
        <div class="section-title">已经报名的人</div>
        <div class="section-sub">${apps.length} 位</div>
      </div>
      <div class="list">
        ${apps.map(a => `
        <div class="row">
          <span class="row-ava">${ava(a.name, 'sm')}</span>
          <div class="row-main">
            <div class="row-title">${a.name}</div>
            <div class="row-sub">信用 ${a.credit} · 成立率 ${a.rate}% · 见证 ${a.flagsWitnessed} 次</div>
          </div>
          ${a.status === 'accepted' ? '<span class="tag mint">已接受</span>' : ''}
        </div>`).join('')}
      </div>
    </div>` : ''}

    <div class="sticky-cta">
      <button class="btn block" ${joined ? 'disabled' : ''} data-act="applyJoinWitness" data-id="${f.id}">
        ${joined ? '我想参加过了' : '我想参加'}
      </button>
    </div>
  </div>
</div>`;
};

/* =========================================================
   30. 见证席候选池
   ========================================================= */
PAGES.witnessPool = () => {
  const pool = witnessPool();
  const sortKey = poolSortKey();
  return `
<div class="screen-scroll">
  <div class="page">
    <div class="nav">${navRow('见证席候选池', `<button class="nav-btn" data-info="witnessPool">?</button>`)}</div>

    <div class="section">
      <div class="section-head">
        <div class="section-title">推荐给你</div>
        <div class="section-sub">${POOL_SORTS.find(s => s.key === sortKey).desc}</div>
      </div>
      <!-- ⚠️ 2026-11-22 用户口径（改）：「按关联度 · 信用分 · 成立率排序，点击以后，
           能对候选人进行排序，目前只是文字，点不了。」
           —— 排序维度从「说明文字」变成「可点的分段控件」。 -->
      <div class="seg" style="margin-bottom:12px">
        ${POOL_SORTS.map(s => `
        <button class="${s.key===sortKey?'on':''}" data-act="setPoolSort" data-key="${s.key}">${s.label}</button>`).join('')}
      </div>
      <div class="list">
        ${pool.map(p => `
        <div class="row">
          <!-- ⚠️ 2026-11-24（本轮，用户口径 Part 三①）：点头像**或名字**进他的用户主页。
               —— 用户口径：「在首页筹备阶段，可从见证席候选池中挑选用户；
                  点击用户头像或名字，进入该用户主页。」
               —— 原来点头像弹的是【候选人详情半屏】（openPoolCandidateSheet）——
                  那一层只重复了列表里已有的信用分 / 成立率，
                  而用户主页上有**完整的长期档案**（信用等级、见证情况、Ta 的 Flag）。
                  挑人是件大事，值得跳一个完整的页面去看。
               —— data-from="pool"：从主页点返回要回到【候选池】继续挑（见 Part 三②）。 -->
          <div class="tap" data-go="userProfile" data-id="${p.name}" data-from="pool">${ava(p.name, 'sm')}</div>
          <div class="row-main tap" data-go="userProfile" data-id="${p.name}" data-from="pool">
              <div class="row-title">${p.name}</div>
            <div class="row-sub">信用 ${p.credit} · 成立率 ${p.rate}% · 见证 ${p.flagsWitnessed} 次</div>
            <div style="margin-top:4px">
              ${p.relationLevel ? `<span class="tag ${p.relationLevel===3?'brand':'mint'}" style="font-size:10px;padding:1px 7px">${p.relation}</span>` : '<span style="font-size:11px;color:var(--ink-4)">无共同关系</span>'}
            </div>
          </div>
          <!-- ⚠️ 2026-11-23 用户口径：点「邀请」后按钮变「已邀请」。 -->
          ${poolInvited(p.id)
            ? `<button class="btn ghost sm" disabled>已邀请</button>`
            : `<button class="btn ghost sm" data-act="inviteFromPool" data-id="${p.id}">邀请</button>`}
        </div>`).join('')}
      </div>
    </div>
  </div>
</div>`;
};
