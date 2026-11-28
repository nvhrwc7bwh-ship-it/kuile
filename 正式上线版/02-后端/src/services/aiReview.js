/**
 * 亏了 · 正式上线版 · AI 打卡判定服务（豆包 / 火山方舟）
 * ===========================================================================
 * 【小白须知】这个文件负责「让 AI 看打卡照片，判定这次打卡合不合格」。
 *
 * 【它具体做什么】
 *   打卡照片提交后，AI 看三件事：
 *     ① 照片里有没有体重秤？秤面读数是多少？（读出来跟用户填的数字对不对）
 *     ② 手写词是什么？有没有写？（要求手写词）
 *     ③ 照片本身合不合格：是不是模糊、是不是根本不是体重秤、
 *        有没有明显的 PS 痕迹、有没有翻拍屏幕的迹象。
 *   然后给出一个「通过 / 驳回 / 存疑」的结论 + 一句人话理由。
 *
 * 【重要】AI 的每一次判定都会完整存进 ai_review 表。
 *   这是合规要求 —— 用户投诉打卡造假时，我们要能拿出来「当时 AI 怎么判的」。
 *
 * 【为什么不直接用 AI 定生死】
 *   AI 判定只做「初筛」。AI 说驳回不代表用户一定造假，
 *   所以驳回会进人工复核队列，由人工最终定性。
 * ===========================================================================
 */
const crypto = require('crypto');
const config = require('../config');
const logger = require('../logger');
const db = require('../db');

/* ---------------------------------------------------------------------------
 * 提示词
 * -------------------------------------------------------------------------
 * 【为什么要写版本号 prompt_version】
 *   以后你可能会改判定标准（比如一开始允许手写词写错别字，后来要求必须对）。
 *   改了之后，老记录还是按老标准判的 —— 留个版本号，将来复核时能说清楚
 *   「这一条是按 v1 标准判的」，不会出现「明明当时合规现在说违规」的争议。
 * ------------------------------------------------------------------------ */
const PROMPT_VERSION = 'v1';

const CHECKIN_PROMPT = `你是一个严谨的打卡审核员。用户提交了一张减肥打卡照片，你需要审核这次打卡是否合规。

请严格检查以下 4 项：

1. 是否包含体重秤：照片中必须能清楚看到一台体重秤或秤面读数。如果没有体重秤，读数为 null。
2. 秤面读数：从照片中读出体重秤显示的数字（单位千克）。读不出来则为 null。
3. 手写词：照片中是否有一张手写的纸条/卡片，上面写着一个词。读出这个词；没有则为 null。
4. 照片质量与真实性：照片是否清晰、是否是翻拍屏幕或照片、是否有明显 PS 痕迹、是否与减肥打卡场景无关。

判定口径：
- verdict = "pass"：能清楚读到秤面读数，有手写词，照片清晰且是真实拍摄的体重秤照片。
- verdict = "doubt"：照片里确实有体重秤，但读数或手写词部分看不清、模棱两可，无法确认。
- verdict = "rejected"：完全没有体重秤、照片严重模糊、与打卡场景无关、明显翻拍屏幕或有明显 PS 痕迹。
- 手写词写错别字但有手写内容，算 "pass"，不要因为错别字驳回。
- 秤面读数与用户自己填的数字对不上，不要在这里驳回（对账在后端做），只如实读出你看到的数字。

只输出 JSON，不要任何解释文字、不要 markdown 代码块。格式：
{"verdict":"pass|doubt|rejected","scale_reading":数字或null,"handwrite":"词或null","has_scale":true或false,"photo_ok":true或false,"reason":"一句中文理由，不超过40字","confidence":0到1之间的小数}`;

/* ---------------------------------------------------------------------------
 * 豆包 / 火山方舟 调用
 * ------------------------------------------------------------------------ */

/**
 * 调用火山方舟的推理接口
 * @param {Array} messages 消息数组
 * @returns {Promise<object>} 模型返回的 JSON
 */
async function callArk(messages) {
  const url = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

  /* 有接入点就优先用接入点（这样模型升级不用改代码） */
  const model = config.ai.endpointId || config.ai.model;

  const payload = {
    model,
    messages,
    temperature: 0.1,        // 判定类任务要稳定，不要发挥
    max_tokens: 800,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`方舟接口返回 ${res.status}：${text.slice(0, 300)}`);
    }

    const data = await res.json();
    const content = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';

    return {
      content,
      requestId: data.id || '',
      usage: data.usage || {},
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 从模型返回里抠出 JSON
 * 模型有时会返回 ```json ... ``` 这种带围栏的，需要剥掉。
 */
function parseJsonLoose(text) {
  if (!text) return null;
  let t = String(text).trim();
  /* 去掉 markdown 围栏 */
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch (e) { /* 继续尝试 */ }
  /* 找第一个 { 到最后一个 } */
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { /* 放弃 */ }
  }
  return null;
}

/* ---------------------------------------------------------------------------
 * 主流程
 * ------------------------------------------------------------------------ */

/**
 * 判定一次打卡照片
 *
 * @param {object} p
 * @param {string} p.photoUrl  打卡照 URL（必须是公网可访问的）
 * @param {number} p.userWeight 用户自己填的体重
 * @param {string} p.userHandwrite 用户自己填的手写词
 * @param {string} p.checkinId  打卡 ID（用于留痕）
 * @returns {Promise<{verdict:string, score:number, reason:string, scaleReading:number|null,
 *                    handwrite:string, aiEnabled:boolean}>}
 */
async function reviewCheckin({ photoUrl, userWeight, userHandwrite, checkinId }) {
  /* AI 没开 → 直接放行，交给人工 */
  if (!config.ai.enabled) {
    logger.info('AI 判定未启用，跳过', { checkinId });
    return {
      verdict: 'pass',
      score: null,
      reason: 'AI 判定未启用，本次不作自动判定',
      scaleReading: null,
      handwrite: userHandwrite || '',
      aiEnabled: false,
    };
  }

  const started = Date.now();
  const messages = [
    { role: 'system', content: CHECKIN_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: `这是用户提交的打卡照片。用户自报体重 ${userWeight} 千克，自报手写词「${userHandwrite || '未填写'}」。请审核这张照片。` },
        { type: 'image_url', image_url: { url: photoUrl } },
      ],
    },
  ];

  let raw = null;
  let parsed = null;
  let requestId = '';
  let error = '';

  try {
    const out = await callArk(messages);
    raw = out;
    requestId = out.requestId;
    parsed = parseJsonLoose(out.content);
    if (!parsed) error = '模型返回内容无法解析为 JSON';
  } catch (e) {
    error = e.message;
    logger.error('AI 判定调用失败', { checkinId, err: e.message });
  }

  const costMs = Date.now() - started;

  /* ---- 归一化模型输出 ---- */
  let verdict = 'doubt';
  let score = null;
  let reason = '';
  let scaleReading = null;
  let handwrite = userHandwrite || '';

  if (parsed) {
    const v = String(parsed.verdict || '').toLowerCase();
    if (v === 'pass') verdict = 'pass';
    else if (v === 'rejected') verdict = 'rejected';
    else verdict = 'doubt';

    score = typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence))
      : null;
    reason = String(parsed.reason || '').slice(0, 200);
    if (typeof parsed.scale_reading === 'number') scaleReading = parsed.scale_reading;
    if (parsed.handwrite) handwrite = String(parsed.handwrite).slice(0, 100);
  } else {
    /* 模型挂了 → 一律「存疑」，交人工，不能因为模型故障直接驳回用户 */
    verdict = 'doubt';
    reason = 'AI 判定未完成，转人工复核';
  }

  /* ---- 留痕（无论成功失败都要记） ---- */
  try {
    await db.execute(
      `INSERT INTO ai_review
         (id, biz_type, biz_id, model, prompt_version, request_id, raw_response, verdict, score, reason, cost_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'rev_' + crypto.randomBytes(12).toString('hex'),
        'checkin',
        checkinId || '',
        config.ai.endpointId || config.ai.model,
        PROMPT_VERSION,
        requestId,
        raw ? JSON.stringify(raw) : JSON.stringify({ error }),
        verdict,
        score,
        reason,
        costMs,
      ]
    );
  } catch (e) {
    logger.error('AI 留痕写入失败', { checkinId, err: e.message });
  }

  /* ---- 自检：模型读到的秤面读数跟用户填的对不上 ---- */
  /* 这里只做「标记」，不改判罚 —— 对账在后端 service 层做 */
  let readingMismatch = false;
  if (scaleReading !== null && typeof userWeight === 'number') {
    const diff = Math.abs(scaleReading - userWeight);
    /* 允许 0.3kg 的误差（秤本身精度 + 拍照角度） */
    readingMismatch = diff > 0.3;
  }

  logger.info('AI 判定完成', {
    checkinId, verdict, score, costMs, scaleReading, userWeight, readingMismatch,
  });

  return {
    verdict,
    score,
    reason,
    scaleReading,
    handwrite,
    readingMismatch,
    aiEnabled: true,
  };
}

module.exports = { reviewCheckin, PROMPT_VERSION };
