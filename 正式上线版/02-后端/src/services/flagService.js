/**
 * 亏了 · 正式上线版 · Flag 业务服务
 * ===========================================================================
 * 【小白须知】这个文件负责「一个减肥目标从立下到结束的全过程」。
 *
 *   流程：
 *     发起 → 筹备期（24 小时，冻结名单、拍定档位）
 *          → 进行中（每天打卡，到节点开判定）
 *          → 结算中（节点判定聚合 + 押金结算 + 信用分入账）
 *          → 成功 / 失败（生成记录卡）
 * ===========================================================================
 */
const db = require('../db');
const logger = require('../logger');
const R = require('../domain/rules');
const { newId, BizError, ERR, todayStr, addDays } = require('../utils');
const aiReview = require('./aiReview');

/* ===========================================================================
 * 一、创建
 * ========================================================================= */

/**
 * 创建一个 Flag（未支付状态）
 */
async function createFlag(p) {
  const { userId, title, reason, startWeight, targetWeight, periodDays, depositAmount } = p;

  /* ---- 参数校验 ---- */
  if (!title || !title.trim()) throw new BizError(ERR.PARAM, '写一个标题吧');
  if (title.length > 60) throw new BizError(ERR.PARAM, '标题最多 60 字');
  if (reason && reason.length > 120) throw new BizError(ERR.PARAM, '理由最多 120 字');
  if (!(Number(startWeight) > 0) || !(Number(targetWeight) > 0)) {
    throw new BizError(ERR.PARAM, '请填写起始体重和目标体重');
  }
  if (Number(targetWeight) >= Number(startWeight)) {
    throw new BizError(ERR.PARAM, '目标体重要小于起始体重');
  }
  if (!R.PERIODS[periodDays]) throw new BizError(ERR.PARAM, '周期只能是 7 / 14 / 30 / 90 天');

  /* ---- 查用户 ---- */
  const user = await db.queryOne('SELECT * FROM user WHERE id = ?', [userId]);
  if (!user) throw new BizError(ERR.NOT_FOUND, '用户不存在');

  /* ---- 新人保护与押金校验 ---- */
  const free = R.depositRequired(user.flags_created, periodDays);
  let amount = Number(depositAmount) || 0;
  if (free.free) {
    amount = 0;
  } else {
    const v = R.validateDeposit(user.credit_score, periodDays, amount);
    if (!v.ok) throw new BizError(ERR.PARAM, v.reason);
  }

  /* ---- 日期 ---- */
  const now = new Date();
  const prepEndAt = new Date(now.getTime() + 24 * 3600 * 1000);
  const { startDate, endDate } = R.calcDates(periodDays, prepEndAt);

  const creditTier = R.creditTierOf(user.credit_score);
  const failRate = R.CREDIT_TIER_RULES[creditTier].failRate;

  const flagId = newId('flg');
  await db.execute(
    `INSERT INTO flag
       (id, user_id, title, reason, start_weight, target_weight, cur_weight,
        period_days, created_at, prep_end_at, start_date, end_date, status,
        tier, tier_history, deposit_amount, deposit_paid, deposit_rate, deposit_status,
        checked_days, streak, breaks, break_limit, watch_count, like_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'prep', 'T0', JSON_ARRAY(), ?, 0, ?, 'none', 0, 0, 0, ?, 0, 0)`,
    [
      flagId, userId, title.trim(), (reason || '').trim(),
      startWeight, targetWeight, startWeight,
      periodDays, now, prepEndAt, startDate, endDate,
      amount, failRate, R.PERIODS[periodDays].breakLimit,
    ]
  );

  /* 第 1 天 = 生效日，起始称重当天必须打卡 */
  await db.execute(
    `INSERT INTO checkin (id, flag_id, user_id, day_index, check_date, weight, handwrite, status, is_node_day)
     VALUES (?, ?, ?, 1, ?, ?, '', 'pending', 1)`,
    [newId('cki'), flagId, userId, startDate, startWeight]
  );

  /* 累计发起数 +1 —— 新人保护「第 1 个 Flag 免费」靠这个字段判断。
   * ⚠️ 必须自增，否则 flags_created 永远是 0，所有人的第一局都永远免费。 */
  await db.execute(
    'UPDATE user SET flags_created = flags_created + 1 WHERE id = ?',
    [userId]
  );

  logger.info('Flag 已创建', { flagId, userId, periodDays, amount });
  return getFlag(flagId, userId);
}

/* ===========================================================================
 * 二、读取
 * ========================================================================= */

/**
 * 读取 Flag 详情（带见证席、节点、打卡概览）
 */
async function getFlag(flagId, viewerId) {
  const f = await db.queryOne(
    `SELECT f.*, u.nickname, u.avatar_url, u.credit_score
       FROM flag f JOIN user u ON u.id = f.user_id
      WHERE f.id = ?`,
    [flagId]
  );
  if (!f) throw new BizError(ERR.NOT_FOUND, '这个 Flag 不存在');

  const witnessList = await db.query(
    `SELECT fw.status, u.id AS user_id, u.nickname, u.avatar_url
       FROM flag_witness fw JOIN user u ON u.id = fw.user_id
      WHERE fw.flag_id = ? AND fw.status IN ('accepted','invited')
      ORDER BY fw.status ASC, fw.invited_at ASC`,
    [flagId]
  );

  const checkins = await db.query(
    `SELECT day_index, check_date, weight, handwrite, status, is_makeup, is_node_day
       FROM checkin WHERE flag_id = ? ORDER BY day_index ASC`,
    [flagId]
  );

  const msgs = await db.query(
    `SELECT m.id, m.content, m.is_anonymous, m.reply_content, m.reply_at, m.is_owner_reply,
            m.created_at, m.user_id, u.nickname, u.avatar_url
       FROM message m JOIN user u ON u.id = m.user_id
      WHERE m.flag_id = ? ORDER BY m.created_at DESC LIMIT 50`,
    [flagId]
  );

  const names = R.nodeNames(f.period_days);
  const nodes = R.PERIODS[f.period_days].nodeDays.map((day, i) => {
    const ck = checkins.find(c => c.day_index === day);
    let state = 'future';
    if (ck) {
      if (ck.status === 'ok') state = 'done';
      else if (ck.status === 'pending') state = 'now';
      else state = 'rejected';
    }
    return {
      index: i + 1,
      name: names[i],
      day,
      date: addDays(f.start_date, day - 1),
      state,
      weight: ck && ck.weight !== null ? Number(ck.weight) : null,
    };
  });

  const dayNow = R.dayIndexOf(f.period_days, f.start_date);
  const accepted = witnessList.filter(w => w.status === 'accepted').length;

  return {
    id: f.id,
    title: f.title,
    reason: f.reason,
    user: {
      id: f.user_id,
      name: f.nickname,
      avatar: f.avatar_url,
      creditScore: f.credit_score,
    },
    startWeight: Number(f.start_weight),
    curWeight: f.cur_weight === null ? null : Number(f.cur_weight),
    targetWeight: Number(f.target_weight),
    days: f.period_days,
    startDate: f.start_date,
    endDate: f.end_date,
    status: f.status,
    tier: f.tier,
    deposit: Number(f.deposit_amount),
    depositStatus: f.deposit_status,
    checkedDays: f.checked_days,
    streak: f.streak,
    breaks: f.breaks,
    breakLimit: f.break_limit,
    watchCount: f.watch_count,
    likeCount: f.like_count,
    dayNow,
    nodes,
    witnesses: witnessList.map(w => ({
      userId: w.user_id,
      name: w.nickname,
      avatar: w.avatar_url,
      status: w.status,
    })),
    acceptedWitnessCount: accepted,
    quorum: R.witnessQuorum(accepted, R.PERIODS[f.period_days].judgeCount),
    checkins: checkins.map(c => ({
      day: c.day_index,
      date: c.check_date,
      weight: c.weight === null ? null : Number(c.weight),
      handwrite: c.handwrite,
      status: c.status,
      isMakeup: !!c.is_makeup,
      isNodeDay: !!c.is_node_day,
    })),
    messages: msgs.map(m => ({
      id: m.id,
      content: m.content,
      anonymous: !!m.is_anonymous,
      nickname: m.is_anonymous ? '监督席' : m.nickname,
      avatar: m.is_anonymous ? '' : m.avatar_url,
      userId: m.user_id,
      reply: m.reply_content ? {
        content: m.reply_content,
        isOwner: !!m.is_owner_reply,
        at: m.reply_at,
      } : null,
      createdAt: m.created_at,
    })),
    isMine: viewerId === f.user_id,
  };
}

/* ===========================================================================
 * 三、生命周期推进（定时任务每分钟调一次）
 * ========================================================================= */

/**
 * 推进所有 Flag 的状态
 */
async function syncLifecycles() {
  const now = new Date();

  /* ---- 1. 筹备期 → 进行中 ---- */
  const prepFlags = await db.query(
    `SELECT * FROM flag WHERE status = 'prep' AND prep_end_at <= ?`,
    [now]
  );
  for (const f of prepFlags) {
    await db.transaction(async (tx) => {
      /* 冻结名单：仍在「已邀请」未响应的，视为未接受 */
      await tx.execute(
        `UPDATE flag_witness SET status = 'removed'
          WHERE flag_id = ? AND status = 'invited'`,
        [f.id]
      );
      const accepted = await tx.queryOne(
        `SELECT COUNT(*) AS c FROM flag_witness WHERE flag_id = ? AND status = 'accepted'`,
        [f.id]
      );
      const cnt = Number(accepted.c) || 0;
      const tier = R.tierByAttendance(cnt);
      await tx.execute(
        `UPDATE flag SET status = 'running', tier = ?, tier_history = ? WHERE id = ?`,
        [tier, JSON.stringify([{ node: 0, attended: cnt, tier }]), f.id]
      );
      await tx.execute(
        `INSERT INTO notification (id, user_id, type, title, content, flag_id)
         VALUES (?, ?, 'flag_running', '筹备期结束，你的 Flag 开始了', '见证席名单已冻结，现在开始每天打卡', ?)`,
        [newId('ntf'), f.user_id, f.id]
      );
    });
    logger.info('筹备期结束，转入进行中', { flagId: f.id });
  }

  /* ---- 2. 断卡判定（每个打卡日的次日凌晨） ---- */
  const running = await db.query(`SELECT * FROM flag WHERE status = 'running'`);
  for (const f of running) {
    const dayNow = R.dayIndexOf(f.period_days, f.start_date, now);
    /* 断卡次数要在循环里累加 —— 不能在循环外只读一次。
     * 否则一天断多天时，每天的 breaks 都算成同一个值。 */
    let currentBreaks = Number(f.breaks);
    for (let d = 1; d < dayNow; d++) {
      /* ⚠️ 必须先把这一天的记录补出来再判。
       * checkin 改成懒生成后，没打过的日子本来就没有记录，
       * 而下面 `if (!ck) continue` 会直接跳过 —— 断卡就永远判不出来。 */
      const ck = await ensureCheckin(f, d);
      if (ck.status !== 'pending') continue;

      const breaks = currentBreaks + 1;
      const state = R.breakState(f.break_limit, breaks);
      await db.execute('UPDATE flag SET breaks = ? WHERE id = ?', [breaks, f.id]);
      currentBreaks = breaks;
      await db.execute(
        `UPDATE checkin SET status = 'rejected', ai_verdict = '断卡未打卡' WHERE id = ?`,
        [ck.id]
      );
      logger.info('断卡判定', { flagId: f.id, day: d, breaks, state });

      if (state === 'fail') {
        await settleFlag(f.id, { reason: 'break', cheatEstablished: false });
        break;   /* 已判负，不再继续数断卡 */
      }
    }
  }

  /* ---- 3. 结束日 → 结算 ---- */
  const due = await db.query(
    `SELECT * FROM flag WHERE status = 'running' AND end_date < ?`,
    [todayStr(now)]
  );
  for (const f of due) {
    await settleFlag(f.id, { reason: 'auto', cheatEstablished: false });
  }

  return { prep: prepFlags.length, running: running.length, settled: due.length };
}

/* ===========================================================================
 * 四、打卡
 * ========================================================================= */

/**
 * 确保某一天的打卡记录存在（懒生成）
 * ---------------------------------------------------------------------------
 * 【为什么需要】
 *   建 Flag 时只预生成了「第 1 天」那一条记录（因为第 1 天是生效日，
 *   必须当天打卡）。后面的天数如果等「用到时再生成」，就会出现
 *   「第 2 天打卡提示『这一天不存在』」的死锁。
 *
 * 【怎么生成】
 *   打卡日期 = 生效日 + (第几天 - 1)。
 *   如果这一天已经过去了 → 属于「补卡」，打 is_makeup 标记。
 *
 * 【注意】
 *   补卡窗口是 12 小时（参数表 1.10），但**窗口的判定不放在这里**——
 *   窗口是由 syncLifecycles() 每天凌晨把过期的 pending 记录改成
 *   rejected 来实现的。这里只负责「把记录补出来」，让用户还有机会打卡。
 *   窗口真的过期时，submitCheckin 会在上面拦下（status === 'rejected'）。
 *
 * @param {object} f    flag 行
 * @param {number} day  第几天（1 ~ period_days）
 * @returns {Promise<object>} checkin 行
 */
async function ensureCheckin(f, day) {
  const existing = await db.queryOne(
    'SELECT * FROM checkin WHERE flag_id = ? AND day_index = ?',
    [f.id, day]
  );
  if (existing) return existing;

  /* 第 1 天由 createFlag 预生成，走到这里说明数据异常 */
  if (day === 1) {
    throw new BizError(ERR.NOT_FOUND, '这一天不存在');
  }

  const checkDate = addDays(f.start_date, day - 1);
  const now = new Date();
  const todayStrNow = todayStr(now);

  /* 这天已经过去了 → 补卡 */
  const isMakeup = checkDate < todayStrNow ? 1 : 0;

  /* 是否称重节点日 */
  const nodeDay = R.isNodeDay(f.period_days, day) ? 1 : 0;

  const id = newId('cki');
  await db.execute(
    `INSERT INTO checkin
       (id, flag_id, user_id, day_index, check_date, weight, handwrite, status, is_makeup, is_node_day)
     VALUES (?, ?, ?, ?, ?, 0, '', 'pending', ?, ?)`,
    [id, f.id, f.user_id, day, checkDate, isMakeup, nodeDay]
  );

  logger.info('按需补生成打卡记录', { flagId: f.id, day, checkDate, isMakeup: !!isMakeup });

  return db.queryOne('SELECT * FROM checkin WHERE id = ?', [id]);
}

/**
 * 提交打卡
 */
async function submitCheckin({ userId, flagId, dayIndex, weight, handwrite, photoUrl }) {
  const f = await db.queryOne('SELECT * FROM flag WHERE id = ?', [flagId]);
  if (!f) throw new BizError(ERR.NOT_FOUND, '这个 Flag 不存在');
  if (f.user_id !== userId) throw new BizError(ERR.FORBIDDEN, '这不是你的 Flag');
  if (f.status !== 'running') throw new BizError(ERR.CONFLICT, '当前状态不能打卡');

  const day = Number(dayIndex);
  if (!Number.isInteger(day) || day < 1 || day > f.period_days) {
    throw new BizError(ERR.PARAM, '打卡天数不合法');
  }
  /* ⚠️ 不许提前打卡未来的日子。
   * checkin 记录改成懒生成之后，如果不拦这一条，用户可以直接打第 7 天，
   * 把进度条一次性刷满、顺便把节点日的体重写掉。
   * 允许打的范围：今天及之前（过去的是补卡）。 */
  const dayNow = R.dayIndexOf(f.period_days, f.start_date);
  if (day > dayNow) {
    throw new BizError(ERR.CONFLICT, '还没到这一天，不能提前打卡');
  }
  if (!(Number(weight) > 0)) throw new BizError(ERR.PARAM, '请填写体重秤读数');
  if (!handwrite || !handwrite.trim()) {
    throw new BizError(ERR.PARAM, '请写一个手写词');
  }
  if (handwrite.length > 200) throw new BizError(ERR.PARAM, '手写词最多 200 字');

  const ck = await ensureCheckin(f, day);
  if (ck.status === 'ok') throw new BizError(ERR.CONFLICT, '这天已经打过卡了');
  if (ck.status === 'rejected') throw new BizError(ERR.CONFLICT, '这天已经错过补卡窗口');

  await db.execute(
    `UPDATE checkin
        SET weight = ?, handwrite = ?, photo_url = ?, status = 'pending',
            is_node_day = ?, updated_at = NOW()
      WHERE id = ?`,
    [weight, handwrite.trim(), photoUrl || '', R.isNodeDay(f.period_days, day) ? 1 : 0, ck.id]
  );

  await db.execute('UPDATE flag SET cur_weight = ? WHERE id = ?', [weight, flagId]);

  logger.info('打卡已提交，等待 AI 判定', { flagId, day, weight });

  /* ---- 触发 AI 判定（异步，不阻塞接口返回）----
   * 前端提交后立刻返回「已提交」，然后轮询 GET /api/flags/:id/checkins 看结果。
   * 判定是「初筛」：AI 说通过 → 计入打卡天数；AI 说驳回 → 转人工复核。
   * ⚠️ 这里是 fire-and-forget：AI 挂了也不能让用户打卡失败。 */
  runAiReview({
    checkinId: ck.id,
    flagId,
    day,
    weight,
    handwrite: handwrite.trim(),
    photoUrl: photoUrl || '',
  }).catch((e) => {
    logger.error('AI 判定调度失败', { checkinId: ck.id, err: e.message });
  });

  return { checkinId: ck.id, status: 'pending' };
}

/**
 * 执行 AI 判定，并把结果写回 checkin + flag 统计字段
 *
 * 【为什么不阻塞 submitCheckin】
 *   AI 调用要几秒到几十秒。放在接口里同步等，用户会以为卡死了；
 *   抛错还会让「打卡」直接失败。所以拆成异步任务，由前端轮询结果。
 */
async function runAiReview({ checkinId, flagId, day, weight, handwrite, photoUrl }) {
  /* 没有照片没法判 —— 直接置为通过，交给人工复核 */
  if (!photoUrl) {
    await applyVerdict({ checkinId, flagId, day, verdict: 'pass', score: null, reason: '未上传照片，转人工复核' });
    return;
  }

  let r;
  try {
    r = await aiReview.reviewCheckin({ photoUrl, userWeight: weight, userHandwrite: handwrite, checkinId });
  } catch (e) {
    logger.error('AI 判定异常，转人工复核', { checkinId, err: e.message });
    /* 模型故障不能直接驳回用户 —— 一律「存疑」转人工 */
    await applyVerdict({ checkinId, flagId, day, verdict: 'doubt', score: null, reason: 'AI 判定异常，转人工复核' });
    return;
  }

  /* AI 说「通过」，但读到的秤面读数跟用户填的对不上 → 转人工复核，不直接驳回 */
  let verdict = r.verdict;
  if (verdict === 'pass' && r.readingMismatch) {
    verdict = 'doubt';
  }

  /* AI 的 verdict 取值：pass / rejected / doubt
   * 对应 checkin.status：ok / rejected / pending（存疑保持待审，转人工） */
  const status = verdict === 'pass' ? 'ok' : (verdict === 'rejected' ? 'rejected' : 'pending');

  await applyVerdict({
    checkinId, flagId, day,
    verdict: status,
    score: r.score,
    reason: r.reason,
  });
}

/**
 * 把判定结果写回 checkin，并同步 flag 的打卡统计
 */
async function applyVerdict({ checkinId, flagId, day, verdict, score, reason }) {
  await db.execute(
    `UPDATE checkin
        SET status = ?, ai_verdict = ?, ai_score = ?, ai_reason = ?, updated_at = NOW()
      WHERE id = ?`,
    [verdict, reason || '', score, reason || '', checkinId]
  );

  if (verdict !== 'ok') {
    logger.info('打卡判定未通过', { checkinId, flagId, day, verdict });
    return;
  }

  /* 只有「通过」才计入打卡天数 */
  const f = await db.queryOne('SELECT checked_days, streak FROM flag WHERE id = ?', [flagId]);
  if (!f) return;

  /* 连续天数：今天（或昨天）打过卡就 +1，否则归 1 */
  const prevDay = await db.queryOne(
    `SELECT day_index FROM checkin
      WHERE flag_id = ? AND status = 'ok' AND day_index < ?
      ORDER BY day_index DESC LIMIT 1`,
    [flagId, day]
  );
  const streak = prevDay && Number(prevDay.day_index) === day - 1 ? Number(f.streak) + 1 : 1;
  const checkedDays = Number(f.checked_days) + 1;

  await db.execute(
    'UPDATE flag SET checked_days = ?, streak = ? WHERE id = ?',
    [checkedDays, streak, flagId]
  );
  logger.info('打卡判定通过', { checkinId, flagId, day, checkedDays, streak });
}

/* ===========================================================================
 * 五、结算
 * ========================================================================= */

/**
 * 结算一个 Flag
 */
async function settleFlag(flagId, opt = {}) {
  const f = await db.queryOne('SELECT * FROM flag WHERE id = ?', [flagId]);
  if (!f) throw new BizError(ERR.NOT_FOUND, 'Flag 不存在');
  if (['success', 'failed', 'cancelled'].includes(f.status)) {
    return { skipped: true, reason: '已结算过' };
  }

  await db.execute(`UPDATE flag SET status = 'settling' WHERE id = ?`, [flagId]);

  try {
    const period = R.PERIODS[f.period_days];

    /* ---- 1. 聚合各节点判定 ---- */
    const verdicts = await db.query(
      'SELECT * FROM verdict WHERE flag_id = ? ORDER BY node_index ASC',
      [flagId]
    );
    let cheatEstablished = false;
    const nodeAggs = [];
    for (let n = 1; n <= period.judgeCount; n++) {
      const nodeVerdicts = verdicts.filter(v => v.node_index === n);
      const agg = R.aggregateVerdict(nodeVerdicts);
      nodeAggs.push({ node: n, agg });
      if (agg.cheat) cheatEstablished = true;
    }

    /* ---- 2. 有效档位（只降不升） ---- */
    const tierHistory = [];
    for (let n = 1; n <= period.judgeCount; n++) {
      const nodeVerdicts = verdicts.filter(v => v.node_index === n);
      const responded = nodeVerdicts.filter(v => v.decision !== null).length;
      tierHistory.push({ node: n, attended: responded, tier: R.tierByAttendance(responded) });
    }
    const tier = R.effectiveTier(tierHistory.map(t => t.tier));

    /* ---- 3. 结局 ---- */
    const finalCk = await db.queryOne(
      `SELECT weight FROM checkin
        WHERE flag_id = ? AND status = 'ok' AND is_node_day = 1
        ORDER BY day_index DESC LIMIT 1`,
      [flagId]
    );
    const finalWeight = finalCk
      ? Number(finalCk.weight)
      : (f.cur_weight === null ? null : Number(f.cur_weight));

    const outcome = R.judgeOutcome({
      periodDays: f.period_days,
      checkedDays: f.checked_days,
      finalWeight,
      targetWeight: Number(f.target_weight),
      breaks: f.breaks,
      cheatEstablished: cheatEstablished || !!opt.cheatEstablished,
    });

    /* ---- 4. 押金结算 ----
     * 【关键】实收金额只看 deposit_paid（真的收到过多少钱），
     *   不看 deposit_amount（名义押金）。
     *
     *   为什么不能看全局开关？
     *   因为「收没收钱」是【这一局自己的事实】：
     *     · 内测期建的局 → 实收 0 → 结算时不能扣、也不能退（那笔钱从没进来过）
     *     · 正式期建的局 → 实收 200 → 结算时照常扣 / 退
     *   如果拿全局开关来判断，会出两种错：
   *     ① 内测建的局，等你把开关打开后才结算 → 退一笔从没收到的钱（资损）
     *     ② 正式期建的局，你把开关关掉后结算 → 收了钱却不退（违规）
     *
     *   名义押金（deposit_amount）照常保留在库里，内测期统计要用。
     */
    const paid = Number(f.deposit_paid) || 0;
    const owner = await db.queryOne('SELECT credit_score FROM user WHERE id = ?', [f.user_id]);
    const creditTierName = R.creditTierOf(Number(owner.credit_score));
    const dep = R.settleDeposit(paid, creditTierName, outcome.success);

    let refundError = '';
    if (paid > 0 && dep.refund > 0) {
      try {
        const { refundDeposit } = require('../services/wechatPay');
        await refundDeposit({
          flagId,
          refundAmount: dep.refund,
          reason: outcome.success
            ? '达标全额退还'
            : `失败扣收 ${dep.deduct} 元，退还余额`,
        });
      } catch (e) {
        refundError = e.message;
        logger.error('押金退还失败', { flagId, err: e.message });
      }
    }

    /* ---- 5. 信用分入账 ---- */
    const evKey = `${outcome.success ? 'flag_success' : 'flag_fail'}_${f.period_days}`;
    let creditDelta = R.settleCreditDelta(f.period_days, tier, outcome.success);
    if (outcome.reason === 'cheat') {
      creditDelta = R.CREDIT_EVENTS.flag_cheat.raw;
    }
    const newCredit = R.applyCredit(Number(owner.credit_score), creditDelta);
    await db.execute('UPDATE user SET credit_score = ? WHERE id = ?', [newCredit, f.user_id]);
    await db.execute(
      `INSERT INTO credit_log (id, user_id, flag_id, event, delta, raw_delta, tier_at, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId('cl'), f.user_id, flagId, evKey,
        creditDelta, R.CREDIT_EVENTS[evKey].raw, tier, outcome.reasonText,
      ]
    );

    /* ---- 6. 写回 Flag + 生成记录卡 ---- */
    const finalStatus = outcome.success ? 'success' : 'failed';
    await db.execute(
      `UPDATE flag
          SET status = ?, tier = ?, tier_history = ?, result = ?, lost_amount = ?,
              credit_delta = ?, settled_at = NOW(), settle_note = ?
        WHERE id = ?`,
      [
        finalStatus, tier, JSON.stringify(tierHistory),
        outcome.success ? 'success' : outcome.reason,
        outcome.success ? 0 : dep.deduct,
        creditDelta,
        outcome.reasonText + (refundError ? `（退款异常：${refundError}）` : ''),
        flagId,
      ]
    );

    const witnesses = await db.query(
      `SELECT u.id, u.nickname, u.avatar_url
         FROM flag_witness fw JOIN user u ON u.id = fw.user_id
        WHERE fw.flag_id = ? AND fw.status = 'accepted'`,
      [flagId]
    );
    await db.execute(
      `INSERT INTO record_card (id, flag_id, user_id, outcome, tier, witness_ids)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE outcome = VALUES(outcome), tier = VALUES(tier)`,
      [
        newId('rc'), flagId, f.user_id,
        outcome.success ? 'success' : 'failed', tier,
        JSON.stringify(witnesses.map(w => ({ id: w.id, name: w.nickname, avatar: w.avatar_url }))),
      ]
    );

    /* ---- 7. 通知发起人 ---- */
    /* 【口径】按【这一局实收了多少】来说话 —— 不按全局开关。
       内测局实收 0 → 不能说「押金已退」（那是虚假告知）；
       正式局实收 > 0 → 照常写「押金已退」。 */
    const betaMode = paid <= 0;
    await db.execute(
      `INSERT INTO notification (id, user_id, type, title, content, flag_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        newId('ntf'), f.user_id,
        outcome.success ? 'flag_success' : 'flag_failed',
        outcome.success ? '你成功了' : '这次没成',
        betaMode
          ? (outcome.success
            ? `达标！内测阶段不收押金，信用分 ${creditDelta >= 0 ? '+' : ''}${creditDelta}`
            : `${outcome.reasonText}。内测阶段不扣押金，信用分 ${creditDelta >= 0 ? '+' : ''}${creditDelta}`)
          : (outcome.success
            ? `达标！押金 ${dep.refund} 元已原路退回，信用分 ${creditDelta >= 0 ? '+' : ''}${creditDelta}`
            : `${outcome.reasonText}。扣收押金 ${dep.deduct} 元，信用分 ${creditDelta >= 0 ? '+' : ''}${creditDelta}`),
        flagId,
      ]
    );

    logger.info('Flag 结算完成', {
      flagId, success: outcome.success, tier, creditDelta,
      refund: dep.refund, deduct: dep.deduct,
    });

    return {
      success: outcome.success,
      reason: outcome.reason,
      reasonText: outcome.reasonText,
      tier,
      creditDelta,
      refund: dep.refund,
      deduct: dep.deduct,
      refundError,
    };
  } catch (e) {
    logger.error('结算失败', { flagId, err: e.message });
    await db.execute(`UPDATE flag SET status = 'running' WHERE id = ?`, [flagId]);
    throw e;
  }
}

/* ===========================================================================
 * 六、取消
 * ========================================================================= */

/**
 * 取消自己的 Flag（仅筹备期可取消，已付款原路退回）
 */
async function cancelFlag(userId, flagId) {
  const f = await db.queryOne('SELECT * FROM flag WHERE id = ?', [flagId]);
  if (!f) throw new BizError(ERR.NOT_FOUND, 'Flag 不存在');
  if (f.user_id !== userId) throw new BizError(ERR.FORBIDDEN, '这不是你的 Flag');
  if (f.status !== 'prep') {
    throw new BizError(ERR.CONFLICT, '只有筹备期内的 Flag 可以取消');
  }
  /* 【按实收金额退】只看 deposit_paid —— 名义押金不等于真的收到过钱。
     内测期建的局实收 0 → 不发起退款（那笔钱从没进来过）。 */
  const paid = Number(f.deposit_paid) || 0;
  if (paid > 0) {
    const { refundDeposit } = require('../services/wechatPay');
    await refundDeposit({ flagId, refundAmount: paid, reason: '发起人取消，全额退还' });
  }
  await db.execute(`UPDATE flag SET status = 'cancelled', settled_at = NOW() WHERE id = ?`, [flagId]);
  logger.info('Flag 已取消', { flagId });
  return { ok: true, refunded: paid };
}

module.exports = {
  createFlag,
  getFlag,
  submitCheckin,
  settleFlag,
  cancelFlag,
  syncLifecycles,
  runAiReview,
  applyVerdict,
};
