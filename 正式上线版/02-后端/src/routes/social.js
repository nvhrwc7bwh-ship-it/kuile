/**
 * 亏了 · 正式上线版 · 社交互动接口
 * ---------------------------------------------------------------------------
 * 【接口说明】
 *   POST   /api/social/flags/:id/like       点赞 / 取消点赞
 *   POST   /api/social/flags/:id/watch      围观（监督席）
 *   GET    /api/social/flags/:id/messages   留言列表
 *   POST   /api/social/flags/:id/messages   留言
 *   POST   /api/social/messages/:id/reply   回复留言
 *   POST   /api/social/follow               关注用户
 *   DELETE /api/social/follow               取消关注
 *   GET    /api/social/following            我关注的人
 *   POST   /api/social/objections           提出异议 / 举报
 *   GET    /api/social/objections           我提的异议
 */
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { ok, BizError, ERR, newId } = require('../utils');

const router = express.Router();

/* ---------------------------------------------------------------------------
 * 点赞
 * ------------------------------------------------------------------------ */

router.post('/flags/:id/like', requireAuth, async (req, res, next) => {
  try {
    const flagId = req.params.id;
    const f = await db.queryOne('SELECT id, user_id FROM flag WHERE id = ?', [flagId]);
    if (!f) throw new BizError(ERR.NOT_FOUND, '这个 Flag 不存在');
    if (f.user_id === req.userId) throw new BizError(ERR.FORBIDDEN, '不能给自己点赞');

    const existing = await db.queryOne(
      'SELECT id FROM `like` WHERE flag_id = ? AND user_id = ?',
      [flagId, req.userId]
    );
    if (existing) {
      await db.execute('DELETE FROM `like` WHERE id = ?', [existing.id]);
      await db.execute('UPDATE flag SET like_count = GREATEST(0, like_count - 1) WHERE id = ?', [flagId]);
      res.json(ok({ liked: false }, '已取消点赞'));
    } else {
      await db.execute(
        'INSERT INTO `like` (id, flag_id, user_id, phrase) VALUES (?, ?, ?, ?)',
        [newId('lik'), flagId, req.userId, (req.body && req.body.phrase) || '']
      );
      await db.execute('UPDATE flag SET like_count = like_count + 1 WHERE id = ?', [flagId]);
      res.json(ok({ liked: true }, '已点赞'));
    }
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------------------------
 * 围观
 * ------------------------------------------------------------------------ */

router.post('/flags/:id/watch', requireAuth, async (req, res, next) => {
  try {
    const flagId = req.params.id;
    const f = await db.queryOne('SELECT id FROM flag WHERE id = ?', [flagId]);
    if (!f) throw new BizError(ERR.NOT_FOUND, '这个 Flag 不存在');

    const existing = await db.queryOne(
      'SELECT id FROM supervise WHERE flag_id = ? AND user_id = ?',
      [flagId, req.userId]
    );
    if (existing) {
      await db.execute('DELETE FROM supervise WHERE id = ?', [existing.id]);
      await db.execute('UPDATE flag SET watch_count = GREATEST(0, watch_count - 1) WHERE id = ?', [flagId]);
      res.json(ok({ watching: false }, '已取消围观'));
    } else {
      await db.execute(
        'INSERT INTO supervise (id, flag_id, user_id) VALUES (?, ?, ?)',
        [newId('sup'), flagId, req.userId]
      );
      await db.execute('UPDATE flag SET watch_count = watch_count + 1 WHERE id = ?', [flagId]);
      res.json(ok({ watching: true }, '已围观'));
    }
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------------------------
 * 留言
 * ------------------------------------------------------------------------ */

router.get('/flags/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT m.id, m.content, m.is_anonymous, m.reply_content, m.reply_at, m.is_owner_reply,
              m.created_at, m.user_id, u.nickname, u.avatar_url
         FROM message m JOIN user u ON u.id = m.user_id
        WHERE m.flag_id = ? ORDER BY m.created_at DESC LIMIT 100`,
      [req.params.id]
    );
    res.json(ok({
      list: rows.map(m => ({
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
    }));
  } catch (e) {
    next(e);
  }
});

router.post('/flags/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const { content, anonymous } = req.body || {};
    if (!content || !String(content).trim()) throw new BizError(ERR.PARAM, '写点什么吧');
    if (String(content).length > 300) throw new BizError(ERR.PARAM, '留言最多 300 字');

    const f = await db.queryOne('SELECT id FROM flag WHERE id = ?', [req.params.id]);
    if (!f) throw new BizError(ERR.NOT_FOUND, '这个 Flag 不存在');

    const id = newId('msg');
    await db.execute(
      `INSERT INTO message (id, flag_id, user_id, is_anonymous, content)
       VALUES (?, ?, ?, ?, ?)`,
      [id, req.params.id, req.userId, anonymous === false ? 0 : 1, String(content).trim()]
    );
    res.json(ok({ id }, '已留言'));
  } catch (e) {
    next(e);
  }
});

router.post('/messages/:id/reply', requireAuth, async (req, res, next) => {
  try {
    const { content } = req.body || {};
    if (!content || !String(content).trim()) throw new BizError(ERR.PARAM, '回复不能为空');

    const msg = await db.queryOne('SELECT * FROM message WHERE id = ?', [req.params.id]);
    if (!msg) throw new BizError(ERR.NOT_FOUND, '这条留言不存在');

    const f = await db.queryOne('SELECT user_id FROM flag WHERE id = ?', [msg.flag_id]);
    const isOwner = f && f.user_id === req.userId;

    await db.execute(
      `UPDATE message SET reply_content = ?, reply_at = NOW(), is_owner_reply = ? WHERE id = ?`,
      [String(content).trim().slice(0, 300), isOwner ? 1 : 0, msg.id]
    );
    res.json(ok(null, '已回复'));
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------------------------
 * 关注
 * ------------------------------------------------------------------------ */

router.post('/follow', requireAuth, async (req, res, next) => {
  try {
    const toUser = req.body && req.body.userId;
    if (!toUser) throw new BizError(ERR.PARAM, '缺少用户 ID');
    if (toUser === req.userId) throw new BizError(ERR.PARAM, '不能关注自己');

    const exists = await db.queryOne(
      'SELECT id FROM follow WHERE from_user = ? AND to_user = ?',
      [req.userId, toUser]
    );
    if (!exists) {
      await db.execute(
        'INSERT INTO follow (id, from_user, to_user) VALUES (?, ?, ?)',
        [newId('fol'), req.userId, toUser]
      );
      /* 关注也算一次互动 —— 影响见证席申请门槛 */
      await db.execute(
        'UPDATE user_stat SET interaction_count = interaction_count + 1 WHERE user_id = ?',
        [req.userId]
      );
    }
    res.json(ok(null, '已关注'));
  } catch (e) {
    next(e);
  }
});

router.delete('/follow', requireAuth, async (req, res, next) => {
  try {
    const toUser = req.body && req.body.userId;
    await db.execute('DELETE FROM follow WHERE from_user = ? AND to_user = ?', [req.userId, toUser]);
    res.json(ok(null, '已取消关注'));
  } catch (e) {
    next(e);
  }
});

router.get('/following', requireAuth, async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT u.id, u.nickname, u.avatar_url, u.credit_score
         FROM follow f JOIN user u ON u.id = f.to_user
        WHERE f.from_user = ? ORDER BY f.created_at DESC`,
      [req.userId]
    );
    res.json(ok({
      list: rows.map(u => ({
        id: u.id, name: u.nickname, avatar: u.avatar_url, creditScore: u.credit_score,
      })),
    }));
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------------------------
 * 异议 / 举报
 * ------------------------------------------------------------------------ */

/** 允许的异议理由 */
const REASON_CODES = [
  'weight_fake',
  'photo_fake',
  'identity_fake',
  'other',
];

router.post('/objections', requireAuth, async (req, res, next) => {
  try {
    const { flagId, type = 'report', reasonCode, content, evidenceUrl } = req.body || {};
    if (!flagId) throw new BizError(ERR.PARAM, '缺少 Flag ID');
    if (!REASON_CODES.includes(reasonCode)) throw new BizError(ERR.PARAM, '请选择理由');

    const f = await db.queryOne('SELECT id, user_id FROM flag WHERE id = ?', [flagId]);
    if (!f) throw new BizError(ERR.NOT_FOUND, '这个 Flag 不存在');
    if (f.user_id === req.userId) throw new BizError(ERR.FORBIDDEN, '不能对自己的 Flag 提出异议');

    const id = newId('obj');
    await db.execute(
      `INSERT INTO objection (id, flag_id, user_id, type, reason_code, content, evidence_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id, flagId, req.userId,
        type === 'doubt' ? 'doubt' : 'report',
        reasonCode,
        (content || '').slice(0, 500),
        (evidenceUrl || '').slice(0, 512),
      ]
    );

    await db.execute(
      'UPDATE user_stat SET interaction_count = interaction_count + 1 WHERE user_id = ?',
      [req.userId]
    );

    res.json(ok({ id }, '已提交，我们会尽快核实'));
  } catch (e) {
    next(e);
  }
});

router.get('/objections', requireAuth, async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT o.*, f.title FROM objection o JOIN flag f ON f.id = o.flag_id
        WHERE o.user_id = ? ORDER BY o.created_at DESC`,
      [req.userId]
    );
    res.json(ok({
      list: rows.map(o => ({
        id: o.id,
        flagId: o.flag_id,
        flagTitle: o.title,
        type: o.type,
        reasonCode: o.reason_code,
        content: o.content,
        status: o.status,
        handleNote: o.handle_note,
        createdAt: o.created_at,
      })),
    }));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
module.exports.REASON_CODES = REASON_CODES;
