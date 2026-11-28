/**
 * 亏了 · 正式上线版 · 支付接口（押金）
 * ---------------------------------------------------------------------------
 * 【接口说明】
 *   POST /api/pay/create     创建押金支付订单，返回小程序调起支付的参数
 *   GET  /api/pay/order/:id 查询订单状态
 *   POST /api/pay/notify    微信支付回调（这个接口不需要登录，要验签）
 *
 * 【重要】notify 是微信服务器调你的，必须：
 *   · 公网可访问（HTTPS）
 *   · 验签
 *   · 快速返回（微信要求 5 秒内响应，否则会重复通知）
 *   · 幂等（重复通知不能重复处理）
 */
const express = require('express');
const db = require('../db');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');
const { ok, BizError, ERR, newId, newTradeNo } = require('../utils');
const wechatPay = require('../services/wechatPay');
const flagService = require('../services/flagService');
const logger = require('../logger');

const router = express.Router();

/* ---------------------------------------------------------------------------
 * 创建支付订单
 * ------------------------------------------------------------------------ */

/**
 * POST /api/pay/create
 * body: { flagId }
 *
 * 【内测阶段（DEPOSIT_ENABLED=false）】
 *   不创建订单、不调微信支付，直接把这一局标记成「押金已支付（内测免收）」。
 *   数据库里的 deposit_amount 照常保留（名义押金），deposit_paid 记 0（实收 0）。
 *   前端据此弹「内测阶段，暂不收取押金」。
 */
router.post('/create', requireAuth, async (req, res, next) => {
  try {
    const { flagId } = req.body || {};
    if (!flagId) throw new BizError(ERR.PARAM, '缺少 Flag ID');

    const f = await db.queryOne('SELECT * FROM flag WHERE id = ?', [flagId]);
    if (!f) throw new BizError(ERR.NOT_FOUND, 'Flag 不存在');
    if (f.user_id !== req.userId) throw new BizError(ERR.FORBIDDEN, '这不是你的 Flag');
    if (f.status !== 'prep') throw new BizError(ERR.CONFLICT, '当前状态不能支付');

    const amount = Number(f.deposit_amount) || 0;

    /* ---- 内测阶段：不真的收钱 ----
     * 【口径】押金档位照常显示、照常记录（deposit_amount 保留名义押金），
     *   但实收写 0（deposit_paid = 0）—— 因为这笔钱确实没进来过。
     *   结算时按【实收金额】判断，所以这一局不会被扣、也不会被退。
     */
    if (!config.deposit.enabled) {
      await db.execute(
        `UPDATE flag SET deposit_status = 'paid', deposit_paid = 0 WHERE id = ?`,
        [flagId]
      );
      logger.info('内测阶段免收押金', { flagId, nominalAmount: amount });
      res.json(ok({
        free: true,
        beta: true,
        amount: 0,
        nominalAmount: amount,
        message: '内测阶段，暂不收取押金',
      }));
      return;
    }

    /* ---- 正式收押金 ----
     * 【边界】内测期建过的局，deposit_status 已经是 'paid'，但实收是 0。
     *   所以这里不能只看 deposit_status —— 要看【实收有没有到账】。
     *   否则内测建的局在开启押金后就再也补缴不了了。 */
    const paid = Number(f.deposit_paid) || 0;
    if (f.deposit_status === 'paid' && paid > 0) {
      throw new BizError(ERR.CONFLICT, '押金已支付过了');
    }

    /* 押金为 0（新人保护）→ 不需要支付，直接把 Flag 置为已支付 */
    if (amount <= 0) {
      await db.execute(
        `UPDATE flag SET deposit_status = 'paid', deposit_paid = 0 WHERE id = ?`,
        [flagId]
      );
      res.json(ok({ free: true, amount: 0 }, '新人保护，本局免押金'));
      return;
    }

    /* 已有未关闭的订单 → 复用，避免重复下单 */
    const exist = await db.queryOne(
      `SELECT * FROM pay_order
        WHERE flag_id = ? AND status IN ('created','paying')
        ORDER BY created_at DESC LIMIT 1`,
      [flagId]
    );

    let order = exist;
    if (!order) {
      const orderId = newId('ord');
      const outTradeNo = newTradeNo('KL');
      await db.execute(
        `INSERT INTO pay_order (id, flag_id, user_id, out_trade_no, amount, type, status)
         VALUES (?, ?, ?, ?, ?, 'deposit', 'created')`,
        [orderId, flagId, req.userId, outTradeNo, amount]
      );
      await db.execute(`UPDATE flag SET deposit_status = 'paying' WHERE id = ?`, [flagId]);
      order = await db.queryOne('SELECT * FROM pay_order WHERE id = ?', [orderId]);
    }

    const user = await db.queryOne('SELECT openid FROM user WHERE id = ?', [req.userId]);
    const payParams = await wechatPay.createPayment({
      outTradeNo: order.out_trade_no,
      description: `亏了 · ${f.title} 押金`,
      amountYuan: Number(order.amount),
      openid: user.openid,
      attach: JSON.stringify({ flagId, orderId: order.id }),
    });

    res.json(ok({
      free: false,
      orderId: order.id,
      outTradeNo: order.out_trade_no,
      amount: Number(order.amount),
      payParams,
    }));
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------------------------
 * 查询订单状态
 * ------------------------------------------------------------------------ */

router.get('/order/:orderId', requireAuth, async (req, res, next) => {
  try {
    const order = await db.queryOne(
      'SELECT * FROM pay_order WHERE id = ? AND user_id = ?',
      [req.params.orderId, req.userId]
    );
    if (!order) throw new BizError(ERR.NOT_FOUND, '订单不存在');

    let tradeState = order.status === 'success' ? 'SUCCESS' : 'NOTPAY';
    if (order.status !== 'success' && order.status !== 'refunded') {
      const q = await wechatPay.queryOrder(order.out_trade_no);
      tradeState = q.tradeState;
      /* 主动查询也能兜住漏掉的回调 */
      if (tradeState === 'SUCCESS' && order.status !== 'success') {
        await wechatPay.onPaySuccess({
          outTradeNo: order.out_trade_no,
          transactionId: q.transactionId,
          attach: '',
        });
      }
    }

    res.json(ok({
      orderId: order.id,
      status: order.status,
      tradeState,
      amount: Number(order.amount),
      refundAmount: Number(order.refund_amount),
      paidAt: order.paid_at,
    }));
  } catch (e) {
    next(e);
  }
});

/* ---------------------------------------------------------------------------
 * 微信支付回调
 * ------------------------------------------------------------------------ */

/**
 * POST /api/pay/notify
 * ⚠️ 这个接口【不需要登录】，因为是微信服务器调过来的。
 *    安全性靠验签保证。
 */
router.post('/notify', async (req, res, next) => {
  try {
    const raw = req.body && req.body.__raw ? req.body.__raw : JSON.stringify(req.body || {});
    const data = wechatPay.verifyAndDecryptNotify(req.headers, raw);

    const eventType = data.event_type || (data.id ? 'TRANSACTION.SUCCESS' : '');
    logger.info('收到微信支付回调', { eventType });

    if (eventType === 'TRANSACTION.SUCCESS') {
      const { out_trade_no: outTradeNo, transaction_id: transactionId } = data;
      await wechatPay.onPaySuccess({ outTradeNo, transactionId, attach: data.attach || '' });
    } else if (eventType === 'REFUND.SUCCESS') {
      const { out_refund_no: refundNo, refund_id: refundId } = data;
      logger.info('退款成功', { refundNo, refundId });
    }

    /* 必须快速返回 SUCCESS，否则微信会一直重推 */
    res.json({ code: 'SUCCESS', message: '成功' });
  } catch (e) {
    logger.error('微信支付回调处理失败', { err: e.message });
    res.status(500).json({ code: 'FAIL', message: e.message });
  }
});

module.exports = router;
