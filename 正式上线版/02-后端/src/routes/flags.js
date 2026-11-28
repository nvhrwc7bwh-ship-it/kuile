/**
 * 亏了 · 正式上线版 · Flag 业务接口
 * ---------------------------------------------------------------------------
 * 【接口说明】
 *   GET  /api/flags              广场列表（可筛选）
 *   GET  /api/flags/my           我的 Flag
 *   GET  /api/flags/:id          Flag 详情
 *   POST /api/flags              发起一个 Flag
 *   POST /api/flags/:id/cancel   取消（仅筹备期）
 *   POST /api/flags/:id/checkin  打卡
 *   GET  /api/flags/:id/checkins 打卡历史
 *   GET  /api/config             前端要用的参数（周期 / 押金档位 / 规则常量）
 */
const express = require('express');
const db = require('../db');
const config = require('../config');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { ok, BizError, ERR, newId } = require('../utils');
const R = require('../domain/rules');
const flagService = require('../services/flagService');

const router = express.Router();

/* ---------------------------------------------------------------------------
 * 前端参数配置（下单前先拉一次，避免前端写死规则）
 * ------------------------------------------------------------------------ */

router.get('/config', requireAuth, async (req, res, next) => {
  try {
    const user = await db.queryOne('SELECT * FROM user WHERE id = ?', [req.userId]);
    const score = Number(user.credit_score);
    const tierName = R.creditTierOf(score);
    const rule = R.CREDIT_TIER_RULES[tierName];

    const periods = Object.keys(R.PERIODS).map(Number).map(d => {
      const p = R.PERIODS[d];
      const free = R.depositRequired(user.flags_created, d);
      return {
        days: d,
        totalDays: p.totalDays,
        judgeCount: p.judgeCount,
        breakLimit: p.breakLimit,
        nodeDays: p.nodeDays,
        nodeNames: R.nodeNames(d),
        depositMin: p.depositMin,
        depositMax: p.depositMax,
        depositOptions: p.depositOptions,
        allowed: rule.periods.includes(d),
        free: free.free,
        depositRequired: free.amount,
        disabledReason: rule.periods.includes(d)
          ? ''
          : `信用分 ${score}（${tierName}）不能立 ${d} 天的 Flag`,
      };
    });

    res.json(ok({
      periods,
      credit: {
        score,
        tier: tierName,
        depositMax: rule.depositMax,
        failRate: rule.failRate,
        allowedPeriods: rule.periods,
      },
      /* 【内测阶段】押金总开关 —— 前端据此决定「确认并支付」点下去弹什么 */
      depositEnabled: config.deposit.enabled,
      constants: {
        prepHours: 24,
        makeupWindowHours: R.MAKEUP_WINDOW_HOURS,
        maxExtraPhotos: 3,
        witnessMaxConcurrent: 3,
        witnessApplyMaxFlags: 3,
        recruitWindowHours: 24,
        inviteTtlHours: 48,
        tierFactor: R.TIER_FACTOR,
        creditRange: { min: R.CREDIT.min, max: R.CREDIT.max, initial: R.CREDIT.initial },
      },
    }));
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------------------------
 * 广场列表
 * ------------------------------------------------------------------------ */

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { status, sort = 'new', page = 1, size = 20, keyword } = req.query;
    const where = [];
    const params = [];

    if (status) {
      const list = String(status).split(',');
      where.push(`f.status IN (${list.map(() => '?').join(',')})`);
      params.push(...list);
    }
    if (keyword) {
      where.push('(f.title LIKE ? OR f.reason LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const orderSql = sort === 'hot' ? 'ORDER BY f.watch_count DESC, f.like_count DESC'
      : sort === 'tier' ? "ORDER BY FIELD(f.tier,'T3','T2','T1','T0'), f.created_at DESC"
      : 'ORDER BY f.created_at DESC';

    const limit = Math.min(Number(size) || 20, 50);
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

    const rows = await db.query(
      `SELECT f.*, u.nickname, u.avatar_url,
              (SELECT COUNT(*) FROM flag_witness fw WHERE fw.flag_id = f.id AND fw.status = 'accepted') AS witness_count
         FROM flag f JOIN user u ON u.id = f.user_id
         ${whereSql}
         ${orderSql}
         LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const total = await db.queryOne(
      `SELECT COUNT(*) AS c FROM flag f ${whereSql}`,
      params
    );

    res.json(ok({
      total: Number(total.c) || 0,
      page: Number(page) || 1,
      list: rows.map(f => ({
        id: f.id,
        title: f.title,
        reason: f.reason,
        user: { id: f.user_id, name: f.nickname, avatar: f.avatar_url },
        startWeight: Number(f.start_weight),
        curWeight: f.cur_weight === null ? null : Number(f.cur_weight),
        targetWeight: Number(f.target_weight),
        days: f.period_days,
        startDate: f.start_date,
        endDate: f.end_date,
        status: f.status,
        tier: f.tier,
        deposit: Number(f.deposit_amount),
        checkedDays: f.checked_days,
        totalDays: f.period_days,
        streak: f.streak,
        breaks: f.breaks,
        breakLimit: f.break_limit,
        watchCount: f.watch_count,
        likeCount: f.like_count,
        witnessCount: Number(f.witness_count) || 0,
        createdAt: f.created_at,
      })),
    }));
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------------------------
 * 我的 Flag
 * ------------------------------------------------------------------------ */

router.get('/my', requireAuth, async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT f.*, u.nickname, u.avatar_url,
              (SELECT COUNT(*) FROM flag_witness fw WHERE fw.flag_id = f.id AND fw.status = 'accepted') AS witness_count
         FROM flag f JOIN user u ON u.id = f.user_id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC`,
      [req.userId]
    );
    res.json(ok({
      list: rows.map(f => ({
        id: f.id,
        title: f.title,
        reason: f.reason,
        user: { id: f.user_id, name: f.nickname, avatar: f.avatar_url },
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
        totalDays: f.period_days,
        streak: f.streak,
        breaks: f.breaks,
        breakLimit: f.break_limit,
        /* 筹备期截止时刻 —— 首页的 24 小时倒计时要用它。
         * ⚠️ 必须给【毫秒时间戳】（小程序里要自己递减，不能只给秒数）。
         *    prep_end_at 是 DATETIME，转成 Date 再取毫秒。
         *    已经是数字（后端有些地方直接给时间戳）就原样用。 */
        prepEndAt: f.prep_end_at ? new Date(f.prep_end_at).getTime() : 0,
        /* 距离筹备期结束还剩多少秒 —— 兜底用（万一客户端时区/时间戳不对） */
        prepRemainSec: f.prep_end_at
          ? Math.max(0, Math.floor((new Date(f.prep_end_at).getTime() - Date.now()) / 1000))
          : 0,
        watchCount: f.watch_count,
        likeCount: f.like_count,
        witnessCount: Number(f.witness_count) || 0,
        createdAt: f.created_at,
      })),
    }));
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------------------------
 * 发起
 * ------------------------------------------------------------------------ */

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, reason, startWeight, targetWeight, periodDays, depositAmount } = req.body || {};
    const flag = await flagService.createFlag({
      userId: req.userId,
      title, reason,
      startWeight: Number(startWeight),
      targetWeight: Number(targetWeight),
      periodDays: Number(periodDays),
      depositAmount: Number(depositAmount) || 0,
    });
    res.json(ok(flag, '立好了'));
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------------------------
 * 详情
 * ------------------------------------------------------------------------ */

router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const flag = await flagService.getFlag(req.params.id, req.userId || null);
    res.json(ok(flag));
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------------------------
 * 取消
 * ------------------------------------------------------------------------ */

router.post('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const r = await flagService.cancelFlag(req.userId, req.params.id);
    res.json(ok(r, '已取消'));
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------------------------
 * 打卡
 * ------------------------------------------------------------------------ */

router.post('/:id/checkin', requireAuth, async (req, res, next) => {
  try {
    const { dayIndex, weight, handwrite, photoUrl } = req.body || {};
    const r = await flagService.submitCheckin({
      userId: req.userId,
      flagId: req.params.id,
      dayIndex: Number(dayIndex),
      weight: Number(weight),
      handwrite,
      photoUrl,
    });
    res.json(ok(r, '打卡已提交'));
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------------------------
 * 打卡历史
 * ------------------------------------------------------------------------ */

router.get('/:id/checkins', optionalAuth, async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT day_index, check_date, weight, handwrite, photo_url, status, is_makeup, is_node_day, ai_verdict
         FROM checkin WHERE flag_id = ? ORDER BY day_index ASC`,
      [req.params.id]
    );
    res.json(ok({
      list: rows.map(c => ({
        day: c.day_index,
        date: c.check_date,
        weight: c.weight === null ? null : Number(c.weight),
        handwrite: c.handwrite,
        photoUrl: c.photo_url,
        status: c.status,
        isMakeup: !!c.is_makeup,
        isNodeDay: !!c.is_node_day,
        aiVerdict: c.ai_verdict,
      })),
    }));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
