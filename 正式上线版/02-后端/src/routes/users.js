/**
 * 亏了 · 正式上线版 · 用户主页接口
 * ---------------------------------------------------------------------------
 * 【接口说明】
 *   GET /api/users/:id          用户主页
 *   GET /api/users/:id/flags    该用户的公开 Flag
 *
 * 【挂载】app.use('/api/users', require('./routes/users'))
 */
const express = require('express');
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');
const { ok, BizError, ERR } = require('../utils');
const R = require('../domain/rules');

const router = express.Router();

/* ---------------------------------------------------------------------------
 * 用户主页
 * ------------------------------------------------------------------------ */

router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const u = await db.queryOne('SELECT * FROM user WHERE id = ?', [req.params.id]);
    if (!u) throw new BizError(ERR.NOT_FOUND, '这个用户不存在');

    const stat = await db.queryOne('SELECT * FROM user_stat WHERE user_id = ?', [req.params.id]);
    const flagCount = await db.queryOne(
      `SELECT COUNT(*) AS c FROM flag WHERE user_id = ? AND status IN ('running','success','failed')`,
      [req.params.id]
    );
    const successCount = await db.queryOne(
      `SELECT COUNT(*) AS c FROM flag WHERE user_id = ? AND status = 'success'`,
      [req.params.id]
    );

    const isFollowing = req.userId
      ? !!(await db.queryOne(
          'SELECT id FROM follow WHERE from_user = ? AND to_user = ?',
          [req.userId, req.params.id]
        ))
      : false;

    res.json(ok({
      id: u.id,
      name: u.nickname,
      avatar: u.avatar_url,
      bio: u.bio,
      creditScore: u.credit_score,
      creditTier: R.creditTierOf(u.credit_score),
      flagCount: Number(flagCount.c) || 0,
      successCount: Number(successCount.c) || 0,
      witnessRate: stat ? Number(stat.witness_rate) : null,
      interactionCount: stat ? stat.interaction_count : 0,
      isFollowing,
      isMe: req.userId === u.id,
    }));
  } catch (e) {
    next(e);
  }
});

router.get('/:id/flags', optionalAuth, async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT * FROM flag WHERE user_id = ? AND status IN ('running','success','failed')
        ORDER BY created_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json(ok({
      list: rows.map(f => ({
        id: f.id,
        title: f.title,
        startWeight: Number(f.start_weight),
        curWeight: f.cur_weight === null ? null : Number(f.cur_weight),
        targetWeight: Number(f.target_weight),
        days: f.period_days,
        status: f.status,
        tier: f.tier,
        checkedDays: f.checked_days,
        totalDays: f.period_days,
        endDate: f.end_date,
        createdAt: f.created_at,
      })),
    }));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
