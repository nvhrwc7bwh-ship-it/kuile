/**
 * 亏了 · 正式上线版 · 见证席接口
 * ---------------------------------------------------------------------------
 * 【接口说明】
 *   GET  /api/witness/tasks              我的见证任务（待判定）
 *   GET  /api/witness/panel/:flagId      见证席面板（某局的判定入口）
 *   POST /api/witness/invite             邀请好友当见证席
 *   POST /api/witness/respond            响应邀请（接受/拒绝）
 *   POST /api/witness/verdict            提交判定
 *   GET  /api/witness/pool               见证席候选池
 *   POST /api/witness/pool/apply         申请进入候选池
 *   POST /api/witness/pool/invite        从候选池邀请
 *   POST /api/witness/recruit            发布招募
 *   POST /api/witness/recruit/apply      报名招募
 *   POST /api/witness/recruit/accept     接受报名
 */
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { ok, BizError, ERR, newId } = require('../utils');
const R = require('../domain/rules');

const router = express.Router();

/* ---------------------------------------------------------------------------
 * 我的见证任务
 * ------------------------------------------------------------------------ */

router.get('/tasks', requireAuth, async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT v.*, f.title AS flag_title, f.days, f.target_weight, f.start_weight,
              f.start_date, f.period_days,
              u.nickname AS owner_name, u.avatar_url AS owner_avatar
         FROM flag_witness fw
         JOIN flag f ON f.id = fw.flag_id
         JOIN user u ON u.id = f.user_id
         LEFT JOIN verdict v
           ON v.flag_id = fw.flag_id AND v.witness_id = fw.user_id
        WHERE fw.user_id = ? AND fw.status = 'accepted'
        ORDER BY f.end_date ASC`,
      [req.userId]
    );

    const tasks = [];
    for (const r of rows) {
      const f = {
        id: r.flag_id,
        title: r.flag_title,
        owner: { name: r.owner_name, avatar: r.owner_avatar },
        days: r.period_days,
        targetWeight: Number(r.target_weight),
        startWeight: Number(r.start_weight),
        endDate: r.end_date,
      };
      const nodeDays = R.PERIODS[r.period_days].nodeDays;
      const verdicts = await db.query(
        'SELECT node_index, decision FROM verdict WHERE flag_id = ? AND witness_id = ?',
        [r.flag_id, req.userId]
      );
      const doneMap = {};
      verdicts.forEach(v => { doneMap[v.node_index] = v.decision; });

      const nodes = nodeDays.map((day, i) => ({
        index: i + 1,
        day,
        name: R.nodeNames(r.period_days)[i],
        date: r.start_date,
        decision: doneMap[i + 1] === undefined ? null : doneMap[i + 1],
      }));

      tasks.push({
        flag: f,
        nodes,
        pending: nodes.filter(n => n.decision === null).length,
        done: nodes.filter(n => n.decision !== null).length,
        total: nodes.length,
      });
    }

    res.json(ok({ list: tasks }));
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------------------------
 * 见证席面板
 * ------------------------------------------------------------------------ */

router.get('/panel/:flagId', requireAuth, async (req, res, next) => {
  try {
    const flagId = req.params.flagId;
    const f = await db.queryOne('SELECT * FROM flag WHERE id = ?', [flagId]);
    if (!f) throw new BizError(ERR.NOT_FOUND, 'Flag 不存在');

    const mine = await db.queryOne(
      `SELECT * FROM flag_witness WHERE flag_id = ? AND user_id = ?`,
      [flagId, req.userId]
    );
    const isWitness = mine && mine.status === 'accepted';

    const verdicts = await db.query(
      `SELECT v.*, u.nickname, u.avatar_url
         FROM verdict v JOIN user u ON u.id = v.witness_id
        WHERE v.flag_id = ? ORDER BY v.node_index ASC`,
      [flagId]
    );

    const period = R.PERIODS[f.period_days];
    const nodes = period.nodeDays.map((day, i) => {
      const nv = verdicts.filter(v => v.node_index === i + 1);
      const agg = R.aggregateVerdict(nv);
      return {
        index: i + 1,
        day,
        name: R.nodeNames(f.period_days)[i],
        date: f.start_date,
        agg,
        votes: nv.map(v => ({
          witnessId: v.witness_id,
          name: v.nickname,
          avatar: v.avatar_url,
          decision: v.decision,
          reason: v.reason,
          at: v.decided_at,
        })),
      };
    });

    res.json(ok({
      flagId,
      isWitness,
      myStatus: mine ? mine.status : 'none',
      days: f.period_days,
      nodes,
      judgeCount: period.judgeCount,
      quorum: R.witnessQuorum(
        (await db.queryOne(
          `SELECT COUNT(*) AS c FROM flag_witness WHERE flag_id = ? AND status = 'accepted'`,
          [flagId]
        )).c,
        period.judgeCount
      ),
    }));
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------------------------
 * 邀请见证席
 * ------------------------------------------------------------------------ */

router.post('/invite', requireAuth, async (req, res, next) => {
  try {
    const { flagId, userIds } = req.body || {};
    if (!flagId) throw new BizError(ERR.PARAM, '缺少 Flag ID');
    if (!Array.isArray(userIds) || !userIds.length) throw new BizError(ERR.PARAM, '请选择见证席');

    const f = await db.queryOne('SELECT * FROM flag WHERE id = ?', [flagId]);
    if (!f) throw new BizError(ERR.NOT_FOUND, 'Flag 不存在');
    if (f.user_id !== req.userId) throw new BizError(ERR.FORBIDDEN, '这不是你的 Flag');
    if (f.status !== 'prep') throw new BizError(ERR.CONFLICT, '筹备期结束后不能再邀请见证席');

    const accepted = Number(
      (await db.queryOne(
        `SELECT COUNT(*) AS c FROM flag_witness WHERE flag_id = ? AND status = 'accepted'`,
        [flagId]
      )).c
    );
    if (accepted + userIds.length > 5) {
      throw new BizError(ERR.PARAM, '见证席最多 5 位');
    }

    const ttl = new Date(Date.now() + 48 * 3600 * 1000);
    const ids = [];
    for (const uid of userIds) {
      const exist = await db.queryOne(
        'SELECT id FROM flag_witness WHERE flag_id = ? AND user_id = ?',
        [flagId, uid]
      );
      if (exist) continue;
      await db.execute(
        `INSERT INTO flag_witness (id, flag_id, user_id, status, invited_by, expire_at)
         VALUES (?, ?, ?, 'invited', ?, ?)`,
        [newId('fw'), flagId, uid, req.userId, ttl]
      );
      await db.execute(
        `INSERT INTO notification (id, user_id, type, title, content, flag_id)
         VALUES (?, ?, 'witness_invite', '你被邀请当见证席', ?, ?)`,
        [newId('ntf'), uid, f.title, flagId]
      );
      ids.push(uid);
    }
    res.json(ok({ invited: ids.length }, '邀请已发出'));
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------------------------
 * 响应邀请
 * ------------------------------------------------------------------------ */

router.post('/respond', requireAuth, async (req, res, next) => {
  try {
    const { flagId, accept } = req.body || {};
    const row = await db.queryOne(
      'SELECT * FROM flag_witness WHERE flag_id = ? AND user_id = ?',
      [flagId, req.userId]
    );
    if (!row) throw new BizError(ERR.NOT_FOUND, '没有这条邀请');
    if (row.status !== 'invited') throw new BizError(ERR.CONFLICT, '这条邀请已经处理过了');
    if (row.expire_at && new Date(row.expire_at).getTime() < Date.now()) {
      throw new BizError(ERR.CONFLICT, '这条邀请已经过期了');
    }

    await db.execute(
      `UPDATE flag_witness SET status = ?, respond_at = NOW() WHERE id = ?`,
      [accept ? 'accepted' : 'declined', row.id]
    );
    res.json(ok(null, accept ? '已接受' : '已拒绝'));
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------------------------
 * 提交判定
 * ------------------------------------------------------------------------ */

router.post('/verdict', requireAuth, async (req, res, next) => {
  try {
    const { flagId, nodeIndex, decision, reason } = req.body || {};
    if (!['pass', 'cheat', 'doubt'].includes(decision)) {
      throw new BizError(ERR.PARAM, '判定只能是「通过」「判作弊」「存疑」');
    }

    const fw = await db.queryOne(
      `SELECT * FROM flag_witness WHERE flag_id = ? AND user_id = ?`,
      [flagId, req.userId]
    );
    if (!fw || fw.status !== 'accepted') {
      throw new BizError(ERR.FORBIDDEN, '你不是这个 Flag 的见证席');
    }

    const f = await db.queryOne('SELECT * FROM flag WHERE id = ?', [flagId]);
    const period = R.PERIODS[f.period_days];
    const n = Number(nodeIndex);
    if (!Number.isInteger(n) || n < 1 || n > period.judgeCount) {
      throw new BizError(ERR.PARAM, '节点序号不合法');
    }

    const exist = await db.queryOne(
      'SELECT id FROM verdict WHERE flag_id = ? AND node_index = ? AND witness_id = ?',
      [flagId, n, req.userId]
    );
    if (exist) throw new BizError(ERR.CONFLICT, '这个节点你已经判过了');

    await db.execute(
      `INSERT INTO verdict (id, flag_id, node_index, witness_id, decision, reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newId('vd'), flagId, n, req.userId, decision, (reason || '').slice(0, 300)]
    );

    /* 通知发起人 */
    await db.execute(
      `INSERT INTO notification (id, user_id, type, title, content, flag_id)
       VALUES (?, ?, 'verdict_done', '你的见证席完成了判定', ?, ?)`,
      [newId('ntf'), f.user_id, `${f.title} · 第 ${n} 个节点`, flagId]
    );

    res.json(ok(null, '判定已提交'));
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------------------------
 * 候选池
 * ------------------------------------------------------------------------ */

router.get('/pool', requireAuth, async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT p.*, u.nickname, u.avatar_url, u.credit_score, s.interaction_count, s.witness_rate
         FROM witness_pool p
         JOIN user u ON u.id = p.user_id
         LEFT JOIN user_stat s ON s.user_id = p.user_id
        WHERE p.status = 'open'
        ORDER BY u.credit_score DESC, p.created_at ASC
        LIMIT 100`
    );
    res.json(ok({
      list: rows.map(p => ({
        userId: p.user_id,
        name: p.nickname,
        avatar: p.avatar_url,
        creditScore: p.credit_score,
        creditTier: R.creditTierOf(p.credit_score),
        interactionCount: Number(p.interaction_count) || 0,
        witnessRate: Number(p.witness_rate),
        invited: false,
      })),
    }));
  } catch (e) {
    next(e);
  }
});

router.post('/pool/apply', requireAuth, async (req, res, next) => {
  try {
    const stat = await db.queryOne('SELECT * FROM user_stat WHERE user_id = ?', [req.userId]);
    const interactions = Number(stat && stat.interaction_count) || 0;
    if (interactions < 10) {
      throw new BizError(ERR.PARAM, `需要累计互动 10 次才能进入候选池（当前 ${interactions} 次）`);
    }
    const exist = await db.queryOne('SELECT id FROM witness_pool WHERE user_id = ?', [req.userId]);
    if (exist) {
      await db.execute(`UPDATE witness_pool SET status = 'open' WHERE id = ?`, [exist.id]);
    } else {
      await db.execute(
        'INSERT INTO witness_pool (id, user_id, interaction_count) VALUES (?, ?, ?)',
        [newId('wp'), req.userId, interactions]
      );
    }
    res.json(ok(null, '已进入候选池'));
  } catch (e) {
    next(e);
  }
});

router.post('/pool/invite', requireAuth, async (req, res, next) => {
  try {
    const { flagId, userId } = req.body || {};
    const f = await db.queryOne('SELECT * FROM flag WHERE id = ?', [flagId]);
    if (!f) throw new BizError(ERR.NOT_FOUND, 'Flag 不存在');
    if (f.user_id !== req.userId) throw new BizError(ERR.FORBIDDEN, '这不是你的 Flag');
    if (f.status !== 'prep') throw new BizError(ERR.CONFLICT, '筹备期结束后不能再邀请见证席');

    const ttl = new Date(Date.now() + 48 * 3600 * 1000);
    const exist = await db.queryOne(
      'SELECT id FROM flag_witness WHERE flag_id = ? AND user_id = ?',
      [flagId, userId]
    );
    if (exist) throw new BizError(ERR.CONFLICT, '这个人已经在名单里了');
    await db.execute(
      `INSERT INTO flag_witness (id, flag_id, user_id, status, invited_by, expire_at)
       VALUES (?, ?, ?, 'invited', ?, ?)`,
      [newId('fw'), flagId, userId, req.userId, ttl]
    );
    await db.execute(
      `INSERT INTO notification (id, user_id, type, title, content, flag_id)
       VALUES (?, ?, 'witness_invite', '你被邀请当见证席', ?, ?)`,
      [newId('ntf'), userId, f.title, flagId]
    );
    res.json(ok(null, '邀请已发出'));
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------------------------
 * 招募
 * ------------------------------------------------------------------------ */

router.post('/recruit', requireAuth, async (req, res, next) => {
  try {
    const { flagId, slots = 3, deadlineHours = 24 } = req.body || {};
    const f = await db.queryOne('SELECT * FROM flag WHERE id = ?', [flagId]);
    if (!f) throw new BizError(ERR.NOT_FOUND, 'Flag 不存在');
    if (f.user_id !== req.userId) throw new BizError(ERR.FORBIDDEN, '这不是你的 Flag');

    const exist = await db.queryOne(
      `SELECT id FROM recruit WHERE flag_id = ? AND status = 'open'`,
      [flagId]
    );
    if (exist) throw new BizError(ERR.CONFLICT, '这一局已经在招募中了');

    const id = newId('rc');
    const deadline = new Date(Date.now() + Number(deadlineHours) * 3600 * 1000);
    await db.execute(
      `INSERT INTO recruit (id, flag_id, publisher_id, slots, deadline_at, status)
       VALUES (?, ?, ?, ?, ?, 'open')`,
      [id, flagId, req.userId, Math.min(Number(slots) || 3, 5), deadline]
    );
    res.json(ok({ id }, '招募已发布'));
  } catch (e) {
    next(e);
  }
});

router.get('/recruit/:flagId', requireAuth, async (req, res, next) => {
  try {
    const r = await db.queryOne(
      `SELECT * FROM recruit WHERE flag_id = ? AND status = 'open'`,
      [req.params.flagId]
    );
    if (!r) {
      res.json(ok({ open: false }));
      return;
    }
    const applicants = await db.query(
      `SELECT ra.*, u.nickname, u.avatar_url, u.credit_score
         FROM recruit_applicant ra JOIN user u ON u.id = ra.user_id
        WHERE ra.recruit_id = ? AND ra.status = 'applied'
        ORDER BY ra.created_at ASC`,
      [r.id]
    );
    res.json(ok({
      open: true,
      id: r.id,
      slots: r.slots,
      deadlineAt: r.deadline_at,
      applicants: applicants.map(a => ({
        userId: a.user_id,
        name: a.nickname,
        avatar: a.avatar_url,
        creditScore: a.credit_score,
        at: a.created_at,
      })),
    }));
  } catch (e) {
    next(e);
  }
});

router.post('/recruit/apply', requireAuth, async (req, res, next) => {
  try {
    const { recruitId } = req.body || {};
    const r = await db.queryOne('SELECT * FROM recruit WHERE id = ?', [recruitId]);
    if (!r) throw new BizError(ERR.NOT_FOUND, '这个招募不存在');
    if (r.status !== 'open') throw new BizError(ERR.CONFLICT, '招募已经结束了');
    if (new Date(r.deadline_at).getTime() < Date.now()) {
      throw new BizError(ERR.CONFLICT, '招募已经截止了');
    }
    const exist = await db.queryOne(
      'SELECT id FROM recruit_applicant WHERE recruit_id = ? AND user_id = ?',
      [recruitId, req.userId]
    );
    if (exist) throw new BizError(ERR.CONFLICT, '你已经报名过了');
    await db.execute(
      'INSERT INTO recruit_applicant (id, recruit_id, user_id) VALUES (?, ?, ?)',
      [newId('ra'), recruitId, req.userId]
    );
    res.json(ok(null, '报名成功'));
  } catch (e) {
    next(e);
  }
});

router.post('/recruit/accept', requireAuth, async (req, res, next) => {
  try {
    const { recruitId, userId } = req.body || {};
    const r = await db.queryOne('SELECT * FROM recruit WHERE id = ?', [recruitId]);
    if (!r) throw new BizError(ERR.NOT_FOUND, '这个招募不存在');
    if (r.publisher_id !== req.userId) throw new BizError(ERR.FORBIDDEN, '不是你的招募');

    const accepted = Number(
      (await db.queryOne(
        `SELECT COUNT(*) AS c FROM flag_witness WHERE flag_id = ? AND status = 'accepted'`,
        [r.flag_id]
      )).c
    );
    if (accepted >= r.slots) throw new BizError(ERR.CONFLICT, '坑位已满');

    await db.execute(
      `INSERT INTO flag_witness (id, flag_id, user_id, status, invited_by)
       VALUES (?, ?, ?, 'accepted', ?)`,
      [newId('fw'), r.flag_id, userId, req.userId]
    );
    await db.execute(
      `UPDATE recruit_applicant SET status = 'accepted' WHERE recruit_id = ? AND user_id = ?`,
      [recruitId, userId]
    );
    res.json(ok(null, '已加入见证席'));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
