/**
 * 亏了 · 正式上线版 · 腾讯云 COS 对象存储
 * ===========================================================================
 * 【小白须知】这个文件负责「把照片存到云上，并把网址给前端」。
 *
 * 【为什么要存云上】
 *   打卡照片不能存在手机里（手机会删文件），
 *   也不能存在后端服务器本地（服务器重装就丢了）。
 *   腾讯云 COS（对象存储）就是专门存图片文件的服务。
 *
 * 【关键概念】
 *   · bucket（存储桶）—— 相当于一个文件夹
 *   · region（地域）    —— 服务器放在哪，选离用户近的
 *   · SecretId / SecretKey —— 访问密钥，等于账号密码
 *   · CDN URL          —— 图片的访问网址
 *
 * 【安全提醒】
 *   打卡照片是**公开**的（这是产品设计：大家要能看到打卡证据）。
 *   所以图片链接是公开可访问的，不要传身份证等隐私图。
 * ===========================================================================
 */
const crypto = require('crypto');
const https = require('https');
const config = require('../config');
const logger = require('../logger');

/**
 * 生成 COS 上传签名
 * 腾讯云 COS 的签名算法（简化版，与官方文档一致）
 */
function buildAuthorization({ method, pathname, expires }) {
  const signKey = 'qcs::cam::uin/' + config.cos.secretId + ':uin/' + config.cos.secretId;
  const signTime = `${Math.floor(Date.now() / 1000 - 60)};${Math.floor(Date.now() / 1000 + expires)}`;
  const httpString = `${method.toLowerCase()}\n${pathname}\n\n\n${signTime}\n`;
  const stringToSign = `sha1\n${signTime}\n${crypto.createHash('sha1').update(httpString).digest('hex')}\n`;
  const sign = crypto.createHmac('sha1', signKey).update(stringToSign).digest('base64');
  return `q-sign-algorithm=sha1&q-ak=${config.cos.secretId}&q-sign-time=${signTime}&q-key-time=${signTime}&q-header-list=&q-url-param-list=&q-signature=${sign}`;
}

/**
 * 把二进制数据直传到 COS
 * @param {Buffer} buffer 文件内容
 * @param {string} key    文件名（含路径）
 * @param {string} mime   文件类型
 */
function putObject(buffer, key, mime) {
  const bucket = config.cos.bucket;
  const region = config.cos.region;
  const hostname = `${bucket}.cos.${region}.myqcloud.com`;
  const pathname = `/${key}`;

  const auth = buildAuthorization({
    method: 'PUT',
    pathname,
    expires: 600,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      method: 'PUT',
      hostname,
      path: pathname,
      headers: {
        Host: hostname,
        Authorization: auth,
        'Content-Type': mime || 'image/jpeg',
        'Content-Length': buffer.length,
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ url: buildUrl(key) });
        } else {
          reject(new Error(`COS 上传失败 ${res.statusCode}：${data.slice(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

/**
 * 拼出可访问的 URL
 */
function buildUrl(key) {
  if (config.cos.cdnUrl) {
    return `${config.cos.cdnUrl.replace(/\/$/, '')}/${key}`;
  }
  return `https://${config.cos.bucket}.cos.${config.cos.region}.myqcloud.com/${key}`;
}

/**
 * 生成存储路径：checkin/2026-11-26/xxx.jpg
 */
function buildKey(prefix, ext) {
  const day = new Date().toISOString().slice(0, 10);
  const rand = crypto.randomBytes(12).toString('hex');
  const e = (ext || 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  return `${prefix}/${day}/${rand}.${e}`;
}

/**
 * 上传打卡照片
 * @param {Buffer} buffer
 * @param {string} ext 文件扩展名
 */
async function uploadCheckinPhoto(buffer, ext) {
  const key = buildKey('checkin', ext);
  const r = await putObject(buffer, key, 'image/jpeg');
  logger.info('照片已上传 COS', { key, size: buffer.length });
  return r;
}

module.exports = { uploadCheckinPhoto, putObject, buildKey, buildUrl };
