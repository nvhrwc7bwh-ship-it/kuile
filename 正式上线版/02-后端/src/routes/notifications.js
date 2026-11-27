/**
 * 亏了 · 正式上线版 · 通知 / 记录卡 接口
 * ---------------------------------------------------------------------------
 * 【接口说明】
 *   GET  /api/notifications               我的通知
 *   POST /api/notifications/read          标记已读
 *   GET  /api/notifications/unread-count  未读数
 *   GET  /api/record-cards/:flagId        记录卡
 */
const express = require('express');
const db = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { ok, BizError, ERR } = require('../utils');

const router = express.Router();

/* ---------------------------------------------------------------------------
 * 通知
 * ------------------------------------------------------------------------ */

router.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT * FROM notification WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
      [req.userId]
    );
    res.json(ok({
      list: rows.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        content: n.content,
        flagId: n.flag_id,
        isRead: !!n.is_read,
        createdAt: n.created_at,
      })),
    }));
  } catch (e) {
    next(e);
  }
});

router.post('/notifications/read', requireAuth, async (req, res, next) => {
  try {
    const { ids } = req.body || {};
    if (Array.isArray(ids) && ids.length) {
      await db.execute(
        `UPDATE notification SET is_read = 1 WHERE user_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
        [req.userId, ...ids]
      );
    } else {
      await db.execute('UPDATE notification SET is_read = 1 WHERE user_id = ?', [req.userId]);
    }
    res.json(ok(null, '已标记为已读'));
  } catch (e) {
    next(e);
  }
});

router.get('/notifications/unread-count', requireAuth, async (req, res, next) => {
  try {
    const row = await db.queryOne(
      'SELECT COUNT(*) AS c FROM notification WHERE user_id = ? AND is_read = 0',
      [req.userId]
    );
    res.json(ok({ count: Number(row.c) || 0 }));
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------------------------
 * 记录卡
 * ------------------------------------------------------------------------ */

router.get('/record-cards/:flagId', optionalAuth, async (req, res, next) => {
  try {
    const rc = await db.queryOne('SELECT * FROM record_card WHERE flag_id = ?', [req.params.flagId]);
    if (!rc) throw new BizError(ERR.NOT_FOUND, '这个记录卡还不存在');

    const f = await db.queryOne(
      `SELECT f.*, u.nickname, u.avatar_url FROM flag f JOIN user u ON u.id = f.user_id WHERE f.id = ?`,
      [req.params.flagId]
    );

    res.json(ok({
      id: rc.id,
      flagId: rc.flag_id,
      outcome: rc.outcome,
      tier: rc.tier,
      witnesses: JSON.parse(rc.witness_ids || '[]'),
      quote: rc.quote,
      shareCount: rc.share_count,
      user: { id: f.user_id, name: f.nickname, avatar: f.avatar_url },
      title: f.title,
      startWeight: Number(f.start_weight),
      targetWeight: Number(f.target_weight),
      finalWeight: f.cur_weight === null ? null : Number(f.cur_weight),
      days: f.period_days,
      checkedDays: f.checked_days,
      breaks: f.breaks,
      /* 名义押金（这一局「本来要押多少」）—— 内测阶段不真收钱，但它仍然是这一局的分量 */
      depositAmount: Number(f.deposit_amount),
      depositPaid: Number(f.deposit_paid),
      lostAmount: Number(f.lost_amount),
      /* 这一局到底收没收过押金 —— 按【实收金额】判断，不按全局开关。
         内测局实收 0 → 页面写「内测阶段未收取」，不能写「已全退」（虚假告知）。 */
      depositEnabled: Number(f.deposit_paid) > 0,
      creditDelta: f.credit_delta,
      settledAt: f.settled_at,
    }));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
