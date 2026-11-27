/**
 * 亏了 · 正式上线版 · 「我的」相关接口
 * ---------------------------------------------------------------------------
 * 【接口说明】
 *   GET /api/me/credit-logs   我的信用分明细
 *
 * 【挂载】app.use('/api/me', require('./routes/me'))
 */
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { ok } = require('../utils');

const router = express.Router();

router.get('/credit-logs', requireAuth, async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT * FROM credit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
      [req.userId]
    );
    res.json(ok({
      list: rows.map(l => ({
        id: l.id,
        event: l.event,
        delta: l.delta,
        rawDelta: l.raw_delta,
        tier: l.tier_at,
        note: l.note,
        flagId: l.flag_id,
        createdAt: l.created_at,
      })),
    }));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
