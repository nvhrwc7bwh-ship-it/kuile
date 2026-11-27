/**
 * 亏了 · 正式上线版 · 微信支付服务（押金）
 * ===========================================================================
 * 【小白须知】这个文件负责「收钱和退钱」。
 *
 * 【关键概念】
 *   · 商户号 (mch_id)   —— 你的微信支付商户平台账号的编号
 *   · APIv3 密钥        —— 32 位字符串，用来给报文加密签名，极其重要，泄露=钱被刷
 *   · 证书序列号        —— 平台证书的编号，用来验证微信回调是不是真的
 *   · 商户证书私钥      —— 用来给你发给微信的请求签名
 *   · 订单号 out_trade_no —— 你自己生成的每笔订单的唯一编号
 *
 * 【最重要的安全原则】
 *   ❶ 金额以「分」为单位传，不要传「元」—— 传错一位就是 100 倍损失。
 *   ❷ 回调必须验签，没验签的回调一律拒绝。
 *   ❸ 回调必须幂等 —— 微信会重复通知，同一订单只能处理一次。
 *   ❹ 退款只能原路退回，不能转账到余额。
 *
 * 【前置条件】微信支付商户平台必须完成全部认证，否则这些接口调不通。
 * ===========================================================================
 */
const crypto = require('crypto');
const https = require('https');
const config = require('../config');
const logger = require('../logger');
const db = require('../db');

/* ---------------------------------------------------------------------------
 * 工具
 * ------------------------------------------------------------------------ */

/** 元 → 分（务必用整数，避免浮点误差） */
function toCents(yuan) {
  return Math.round(Number(yuan) * 100);
}

/** 分 → 元 */
function toYuan(cents) {
  return cents / 100;
}

/** 商户私钥：优先读文件，其次读环境变量 */
function getPrivateKey() {
  if (config.pay.privateKeyPath) {
    try {
      const fs = require('fs');
      const path = require('path');
      const p = path.isAbsolute(config.pay.privateKeyPath)
        ? config.pay.privateKeyPath
        : path.resolve(process.cwd(), config.pay.privateKeyPath);
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
    } catch (e) {
      logger.error('读取商户私钥文件失败', { err: e.message });
    }
  }
  return config.pay.privateKey || '';
}

/**
 * 生成 RSA 签名（RSA2 / SHA256withRSA）
 */
function sign(message) {
  const key = getPrivateKey();
  if (!key) throw new Error('缺少商户私钥，无法签名');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(message, 'utf8');
  return sign.sign(key, 'base64');
}

/**
 * 构造 Authorization 头（微信支付 APIv3）
 */
function buildAuthHeader(method, urlPath, timestamp, nonceStr, body) {
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${body}\n`;
  const signature = sign(message);
  return `WECHATPAY2-SHA256-RSA2048 mchid="${config.pay.mchId}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${config.pay.serialNo}"`;
}

/**
 * 通用 HTTPS 请求
 */
function request({ method, urlPath, body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://api.mch.weixin.qq.com${urlPath}`);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = crypto.randomBytes(16).toString('hex');
    const payload = body ? JSON.stringify(body) : '';

    const opts = {
      method,
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'kuile-api/1.0',
        ...headers,
      },
    };
    if (payload) {
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (config.pay.serialNo && config.pay.privateKey) {
      opts.headers['Authorization'] = buildAuthHeader(method, url.pathname, timestamp, nonceStr, payload);
    }

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch (e) { parsed = { raw: data }; }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          const msg = parsed && parsed.message ? parsed.message : data.slice(0, 300);
          reject(new Error(`微信支付接口 ${res.statusCode}：${msg}`));
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/* ---------------------------------------------------------------------------
 * 下单（JSAPI / 小程序支付）
 * ------------------------------------------------------------------------ */

/**
 * 创建押金支付订单，返回小程序端调起支付所需参数
 *
 * @param {object} p
 * @param {string} p.outTradeNo 商户订单号
 * @param {string} p.description 商品描述
 * @param {number} p.amountYuan 金额（元）
 * @param {string} p.openid 付款人 openid
 * @param {string} p.attach 附加数据（回调时原样返回）
 * @returns {Promise<object>} { timeStamp, nonceStr, package, signType, paySign }
 */
async function createPayment({ outTradeNo, description, amountYuan, openid, attach }) {
  const amount = toCents(amountYuan);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`支付金额非法：${amountYuan} 元`);
  }

  const body = {
    appid: config.wechat.appid,
    mchid: config.pay.mchId,
    description,
    out_trade_no: outTradeNo,
    time_expire: new Date(Date.now() + 30 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    notify_url: config.pay.notifyUrl,
    amount: { total: amount, currency: 'CNY' },
    payer: { openid },
    attach: attach || '',
  };

  const resp = await request({ method: 'POST', urlPath: '/v3/pay/transactions/jsapi', body });

  /* 调起支付所需的 5 个参数 */
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const packageStr = `prepay_id=${resp.prepay_id}`;

  const signMessage = `${timeStamp}\n${nonceStr}\n${packageStr}\n`;
  const paySign = sign(signMessage);

  return {
    timeStamp,
    nonceStr,
    package: packageStr,
    signType: 'RSA',
    paySign,
  };
}

/* ---------------------------------------------------------------------------
 * 退款
 * ------------------------------------------------------------------------ */

/**
 * 申请退款（押金退还 / 失败扣收）
 *
 * @param {object} p
 * @param {string} p.outTradeNo 原商户订单号
 * @param {string} p.refundNo    商户退款单号（每笔退款唯一）
 * @param {number} p.amountYuan  退款金额（元）
 * @param {string} p.reason      退款原因
 * @returns {Promise<object>}
 */
async function refund({ outTradeNo, refundNo, amountYuan, reason }) {
  const body = {
    out_trade_no: outTradeNo,
    out_refund_no: refundNo,
    reason: (reason || '押金退还').slice(0, 80),
    notify_url: config.pay.notifyUrl,
    amount: {
      refund: toCents(amountYuan),
      /* total 填 0 表示不校验原订单总额（按 refund 金额退） */
      total: 0,
      currency: 'CNY',
    },
  };
  return request({ method: 'POST', urlPath: '/v3/refund/domestic/refunds', body });
}

/**
 * 查询退款状态
 */
async function queryRefund(refundNo) {
  return request({ method: 'GET', urlPath: `/v3/refund/domestic/refunds/${refundNo}` });
}

/* ---------------------------------------------------------------------------
 * 回调验签
 * ------------------------------------------------------------------------ */

/**
 * 验证微信回调签名 + 解密资源
 *
 * ⚠️ 这是安全关键。必须验签通过才处理业务。
 *
 * @param {object} headers HTTP 头（wechatpay-timestamp 等）
 * @param {string} rawBody 原始请求体（不能先 JSON.parse，要用原文验签）
 * @returns {object} 解密后的业务数据
 */
function verifyAndDecryptNotify(headers, rawBody) {
  const timestamp = headers['wechatpay-timestamp'];
  const nonce = headers['wechatpay-nonce'];
  const signature = headers['wechatpay-signature'];
  const serial = headers['wechatpay-serial'];

  if (!timestamp || !nonce || !signature) {
    throw new Error('回调缺少验签请求头');
  }

  /* 时间戳防重放：超过 5 分钟的回调直接拒 */
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    throw new Error('回调时间戳超出有效范围');
  }

  const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
  const cert = config.pay.platformCert;
  if (!cert) {
    throw new Error('缺少平台证书，无法验签');
  }
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(message, 'utf8');
  const ok = verifier.verify(cert, signature, 'base64');
  if (!ok) {
    throw new Error('回调验签失败');
  }

  const payload = JSON.parse(rawBody);
  if (!payload.resource) {
    /* 明文通知（如支付成功）直接返回 */
    return payload;
  }

  /* AEAD 解密 */
  const { ciphertext, nonce: cNonce, associated_data: aad } = payload.resource;
  const authTag = ciphertext.slice(-16);
  const encData = Buffer.from(ciphertext.slice(0, -16), 'base64');
  const key = Buffer.from(config.pay.apiV3Key, 'utf8');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(cNonce, 'utf8'));
  decipher.setAuthTag(authTag);
  if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'));
  const decrypted = Buffer.concat([decipher.update(encData), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

/* ---------------------------------------------------------------------------
 * 高层封装：押金收取 / 退还
 * ------------------------------------------------------------------------ */

/**
 * 押金支付成功后的账务处理（幂等）
 *
 * @param {object} p
 * @param {string} p.outTradeNo 商户订单号
 * @param {string} p.transactionId 微信交易号
 * @param {string} p.attach 附加数据（JSON，含 flagId）
 */
async function onPaySuccess({ outTradeNo, transactionId, attach }) {
  return db.transaction(async (tx) => {
    /* 幂等：已处理过就直接返回 */
    const order = await tx.queryOne(
      'SELECT * FROM pay_order WHERE out_trade_no = ? FOR UPDATE',
      [outTradeNo]
    );
    if (!order) throw new Error(`订单不存在：${outTradeNo}`);
    if (order.status === 'success') {
      logger.info('支付回调重复，已跳过', { outTradeNo });
      return { duplicated: true, order };
    }

    await tx.execute(
      `UPDATE pay_order
          SET status = 'success', transaction_id = ?, paid_at = NOW()
        WHERE id = ?`,
      [transactionId, order.id]
    );

    /* 押金入账流水 */
    await tx.execute(
      `INSERT INTO deposit_ledger (id, flag_id, user_id, type, amount, reason, order_id)
       VALUES (?, ?, ?, 'in', ?, '押金缴入', ?)`,
      ['led_' + crypto.randomBytes(12).toString('hex'), order.flag_id, order.user_id, order.amount, order.id]
    );

    /* 更新 Flag 的押金状态 */
    if (order.flag_id) {
      await tx.execute(
        `UPDATE flag SET deposit_status = 'paid', deposit_paid = ? WHERE id = ?`,
        [order.amount, order.flag_id]
      );
    }

    logger.info('押金支付成功', { outTradeNo, amount: order.amount });
    return { duplicated: false, orderId: order.id, flagId: order.flag_id, amount: order.amount };
  });
}

/**
 * 押金退还（达标全额退 / 失败部分退）
 *
 * @param {object} p
 * @param {string} p.flagId
 * @param {number} p.refundAmount 退还金额（元）
 * @param {string} p.reason
 * @returns {Promise<object>}
 */
async function refundDeposit({ flagId, refundAmount, reason }) {
  const order = await db.queryOne(
    `SELECT * FROM pay_order
      WHERE flag_id = ? AND type = 'deposit' AND status = 'success'
      ORDER BY paid_at DESC LIMIT 1`,
    [flagId]
  );
  if (!order) {
    logger.warn('押金退还：找不到已支付订单', { flagId });
    return { skipped: true, reason: '没有已支付的押金订单' };
  }
  const already = Number(order.refund_amount || 0);
  const remain = Number(order.amount) - already;
  if (refundAmount > remain + 0.001) {
    throw new Error(`退还金额 ${refundAmount} 超过可退余额 ${remain}`);
  }
  if (refundAmount <= 0) return { skipped: true, reason: '无需退还' };

  const refundNo = 'rf_' + crypto.randomBytes(12).toString('hex');
  const res = await refund({
    outTradeNo: order.out_trade_no,
    refundNo,
    amountYuan: refundAmount,
    reason,
  });

  await db.transaction(async (tx) => {
    await tx.execute(
      `UPDATE pay_order
          SET refund_amount = refund_amount + ?, status = ?, refunded_at = NOW()
        WHERE id = ?`,
      [refundAmount, refundAmount >= Number(order.amount) ? 'refunded' : 'partial_refunded', order.id]
    );
    await tx.execute(
      `INSERT INTO deposit_ledger (id, flag_id, user_id, type, amount, reason, order_id)
       VALUES (?, ?, ?, 'out', ?, ?, ?)`,
      ['led_' + crypto.randomBytes(12).toString('hex'), flagId, order.user_id, refundAmount, reason, order.id]
    );
    await tx.execute(
      `UPDATE flag SET deposit_status = ? WHERE id = ?`,
      [refundAmount >= Number(order.amount) ? 'refunded' : 'part_refunded', flagId]
    );
  });

  logger.info('押金退还已发起', { flagId, refundAmount, refundNo, status: res.status });
  return { refundNo, status: res.status, amount: refundAmount };
}

/**
 * 查询订单状态（前端主动查，用于支付后轮询）
 */
async function queryOrder(outTradeNo) {
  try {
    const res = await request({ method: 'GET', urlPath: `/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${config.pay.mchId}` });
    return { tradeState: res.trade_state, transactionId: res.transaction_id || '' };
  } catch (e) {
    logger.error('查询订单失败', { outTradeNo, err: e.message });
    return { tradeState: 'UNKNOWN', error: e.message };
  }
}

module.exports = {
  createPayment,
  refund,
  refundDeposit,
  queryRefund,
  queryOrder,
  onPaySuccess,
  verifyAndDecryptNotify,
  toCents,
  toYuan,
};
