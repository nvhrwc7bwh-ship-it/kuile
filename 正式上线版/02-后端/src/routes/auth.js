/**
 * 亏了 · 正式上线版 · 认证相关接口
 * ---------------------------------------------------------------------------
 * 【接口说明】
 *   POST /api/auth/login      小程序登录（wx.login 的 code 换 token）
 *   POST /api/auth/logout     退出登录
 *   GET  /api/auth/profile    获取当前用户资料 + 信用分
 *   PUT  /api/auth/profile    修改资料（昵称 / 头像 / 简介）
 */
const express = require('express');
const db = require('../db');
const { requireAuth, code2Openid, issueToken } = require('../middleware/auth');
const { ok, BizError, ERR, newId } = require('../utils');
const R = require('../domain/rules');

const router = express.Router();

/* ---------------------------------------------------------------------------
 * 登录
 * ------------------------------------------------------------------------ */

/**
 * POST /api/auth/login
 * body: { code: "wx.login 的 code", nickname?: "昵称", avatarUrl?: "头像" }
 */
router.post('/login', async (req, res, next) => {
  try {
    const { code, nickname, avatarUrl } = req.body || {};
    if (!code) throw new BizError(ERR.PARAM, '缺少登录凭证');

    const { openid, unionid } = await code2Openid(code);

    let user = await db.queryOne('SELECT * FROM user WHERE openid = ?', [openid]);
    let isNew = false;

    if (!user) {
      /* 新用户：初始信用分 60 */
      isNew = true;
      const userId = newId('usr');
      await db.execute(
        `INSERT INTO user (id, openid, unionid, nickname, avatar_url, credit_score)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId, openid, unionid || null,
          (nickname || '新朋友').slice(0, 64),
          (avatarUrl || '').slice(0, 512),
          R.CREDIT.initial,
        ]
      );
      await db.execute('INSERT INTO user_stat (user_id) VALUES (?)', [userId]);
      user = await db.queryOne('SELECT * FROM user WHERE id = ?', [userId]);
    } else {
      /* 老用户：只在传了昵称/头像时更新 */
      if (nickname || avatarUrl) {
        await db.execute(
          `UPDATE user SET nickname = ?, avatar_url = ? WHERE id = ?`,
          [
            (nickname || user.nickname).slice(0, 64),
            (avatarUrl || user.avatar_url).slice(0, 512),
            user.id,
          ]
        );
      }
    }

    const { token, expiresAt } = await issueToken(user.id);

    res.json(ok({
      token,
      expiresAt,
      isNew,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatar_url,
        creditScore: user.credit_score,
        creditTier: R.creditTierOf(user.credit_score),
        flagsCreated: user.flags_created,
      },
    }));
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------------------------
 * 退出
 * ------------------------------------------------------------------------ */

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    await db.execute('DELETE FROM session WHERE token = ?', [token]);
    res.json(ok(null, '已退出'));
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------------------------
 * 资料
 * ------------------------------------------------------------------------ */

router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const u = await db.queryOne('SELECT * FROM user WHERE id = ?', [req.userId]);
    const stat = await db.queryOne('SELECT * FROM user_stat WHERE user_id = ?', [req.userId]);
    res.json(ok({
      id: u.id,
      nickname: u.nickname,
      avatarUrl: u.avatar_url,
      bio: u.bio,
      creditScore: u.credit_score,
      creditTier: R.creditTierOf(u.credit_score),
      depositMax: R.CREDIT_TIER_RULES[R.creditTierOf(u.credit_score)].depositMax,
      failRate: R.CREDIT_TIER_RULES[R.creditTierOf(u.credit_score)].failRate,
      flagsCreated: u.flags_created,
      interactionCount: stat ? stat.interaction_count : 0,
      witnessRate: stat ? Number(stat.witness_rate) : 1,
    }));
  } catch (e) {
    next(e);
  }
});

router.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const { nickname, avatarUrl, bio } = req.body || {};
    const u = await db.queryOne('SELECT * FROM user WHERE id = ?', [req.userId]);
    await db.execute(
      `UPDATE user SET nickname = ?, avatar_url = ?, bio = ? WHERE id = ?`,
      [
        (nickname !== undefined ? String(nickname) : u.nickname).slice(0, 64),
        (avatarUrl !== undefined ? String(avatarUrl) : u.avatar_url).slice(0, 512),
        (bio !== undefined ? String(bio) : u.bio).slice(0, 200),
        req.userId,
      ]
    );
    res.json(ok(null, '已保存'));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
