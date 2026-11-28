/**
 * 亏了 · 正式上线版 · 后端配置
 * ---------------------------------------------------------------------------
 * 【小白须知】这个文件负责「读 .env 里的配置 + 提供默认值」。
 *   一般不需要改。改配置请改 .env，不要改这里。
 */
const path = require('path');
const fs = require('fs');

/* 手动解析 .env —— 不引入 dotenv 依赖，少一个包少一份风险 */
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    /* 去掉引号 */
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadEnv();

function req(key, def) {
  const v = process.env[key];
  if (v === undefined || v === '') {
    if (def !== undefined) return def;
    throw new Error(`缺少必需的环境变量：${key}（请检查 .env 文件）`);
  }
  return v;
}
function num(key, def) {
  const v = process.env[key];
  if (v === undefined || v === '') return def;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`环境变量 ${key} 不是数字：${v}`);
  return n;
}
function bool(key, def) {
  const v = process.env[key];
  if (v === undefined || v === '') return def;
  return v === 'true' || v === '1' || v === 'yes';
}

const config = {
  env: req('NODE_ENV', 'development'),
  port: num('PORT', 3000),
  apiBaseUrl: req('API_BASE_URL', 'http://127.0.0.1:3000'),

  wechat: {
    appid: req('WECHAT_APPID', ''),
    appsecret: req('WECHAT_APPSECRET', ''),
  },
  db: {
    /* 【自建 MySQL】默认连本机 —— 数据库和后端在同一台服务器上，
     * 只监听 127.0.0.1，不对公网开放，因此不需要任何安全组放行。 */
    host: req('DB_HOST', '127.0.0.1'),
    port: num('DB_PORT', 3306),
    database: req('DB_NAME', 'kuile'),
    user: req('DB_USER', 'kuile'),
    password: req('DB_PASSWORD', ''),
    connectionLimit: num('DB_POOL_SIZE', 10),
  },

  cos: {
    region: req('COS_REGION', 'ap-guangzhou'),
    bucket: req('COS_BUCKET', ''),
    secretId: req('COS_SECRET_ID', ''),
    secretKey: req('COS_SECRET_KEY', ''),
    sessionToken: process.env.COS_SESSION_TOKEN || '',
    cdnUrl: req('COS_CDN_URL', ''),
  },

  ai: {
    enabled: bool('AI_VERIFY_ENABLED', false),
    apiKey: req('ARK_API_KEY', ''),
    endpointId: req('ARK_ENDPOINT_ID', ''),
    model: req('ARK_MODEL', 'doubao-1-5-vision-pro-250528'),
    timeoutMs: num('AI_TIMEOUT_MS', 20000),
  },

  pay: {
    mchId: req('WECHAT_PAY_MCH_ID', ''),
    serialNo: req('WECHAT_PAY_SERIAL_NO', ''),
    privateKeyPath: req('WECHAT_PAY_PRIVATE_KEY_PATH', ''),
    privateKey: req('WECHAT_PAY_PRIVATE_KEY', ''),
    apiV3Key: req('WECHAT_PAY_API_V3_KEY', ''),
    notifyUrl: req('WECHAT_PAY_NOTIFY_URL', ''),
    platformCert: req('WECHAT_PAY_PLATFORM_CERT', ''),
  },

  /* ---------------------------------------------------------------------------
   * 押金总开关
   * ---------------------------------------------------------------------------
   * 【小白须知】这是「要不要真的收押金」的总开关。
   *
   *   DEPOSIT_ENABLED=false（默认）→ 内测阶段
   *       · 押金档位照常显示、照常记录（数据库里存的是「名义押金」）
   *       · 但【不真的收钱】：不下单、不调微信支付
   *       · 结算时【不扣收、不退款】
   *       · 用户在「确认并支付」时看到提示「内测阶段，暂不收取押金」
   *
   *   DEPOSIT_ENABLED=true → 正式收押金（走微信支付全额流程）
   *
   * 【怎么改】改 .env 里的这一行，改完重启服务（pm2 restart kuile-api）。
   * ------------------------------------------------------------------------- */
  deposit: {
    enabled: bool('DEPOSIT_ENABLED', false),
  },

  token: {
    /* 生产环境强制要求自定义密钥 —— 用默认密钥等于没有加密 */
    secret: (function () {
      if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
      if (req('NODE_ENV', 'development') === 'production') {
        throw new Error(
          '生产环境必须设置 JWT_SECRET（生成方法：openssl rand -hex 32）'
        );
      }
      return 'dev-only-insecure-secret';
    })(),
    expireDays: num('TOKEN_EXPIRE_DAYS', 30),
  },

  tpns: {
    enabled: bool('TPNS_ENABLED', false),
    accessId: req('TPNS_ACCESS_ID', ''),
    accessKey: req('TPNS_ACCESS_KEY', ''),
  },

  log: {
    level: req('LOG_LEVEL', 'info'),
    dir: req('LOG_DIR', './logs'),
  },
};

module.exports = config;
