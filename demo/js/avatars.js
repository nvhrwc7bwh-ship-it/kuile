/* ============================================================
   亏了 · 真人头像系统
   真实人像照片（Unsplash CDN）+ 多级降级到本地矢量人像
   按姓名稳定选取，同一个人永远同一张脸
   ============================================================ */

/* 真实人像照片池（Unsplash 图源，固定裁切成方形头像） */
const PHOTO_POOL = [
  'photo-1494790108377-be9c29b29330',
  'photo-1500648767791-00dcc994a43e',
  'photo-1534528741775-53994a69daeb',
  'photo-1507003211169-0a1dd7228f2d',
  'photo-1438761681033-6461ffad8d80',
  'photo-1502685104226-ee32379fefbe',
  'photo-1531123897727-8f129e1688ce',
  'photo-1517841905240-472988babdf9',
  'photo-1506794778202-cad84cf45f1d',
  'photo-1544005313-94ddf0286df2',
  'photo-1547425260-76bcadfb4f2c',
  'photo-1552058544-f2b08422138a',
  'photo-1580489944761-15a19d654956',
  'photo-1592621385612-4d7129426394',
  'photo-1615109398623-88346a601842',
  'photo-1607746882042-944635dfe10e',
  'photo-1573497019940-1c28c88b4f3e',
  'photo-1568602471122-7832951cc4c5',
  'photo-1472099645785-5658abf4ff4e',
  'photo-1546069901-ba9599a7e63c',
];

/* ------------------------------------------------------------------
   本地矢量人像：网络不可用 / 图片加载失败时的兜底
   ------------------------------------------------------------------ */
const SKIN = [
  { f:'#F2D3BC', s:'#E0B89C', hair:'#2E2320' },
  { f:'#EDC9AC', s:'#D9A98A', hair:'#3A2B25' },
  { f:'#E5B694', s:'#CE9A76', hair:'#1F1A18' },
  { f:'#D9A17C', s:'#C08460', hair:'#2B201B' },
  { f:'#C98F68', s:'#AE7550', hair:'#241B17' },
  { f:'#B87B54', s:'#9A6444', hair:'#1A1412' },
];

const HAIR_BG = ['#6B5B4E','#8C8C8C','#C9A227','#1F1A18','#4A3728','#A0522D','#5A5A5A','#2C2C2C'];
const HAIR_STYLE = 6;

/** 生成写实人像的 data URI（兜底用） */
function avatarURI(seed) {
  let s = seed * 2654435761 % 4294967296;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;

  const sk = SKIN[Math.floor(rnd() * SKIN.length)];
  const hair = rnd() < 0.72 ? sk.hair : HAIR_BG[Math.floor(rnd() * HAIR_BG.length)];
  const style = Math.floor(rnd() * HAIR_STYLE);
  const shirt = HAIR_BG[Math.floor(rnd() * HAIR_BG.length)];
  const shirt2 = ['#3E6B8E','#4C7A5E','#8E5B4C','#6B5B8E','#8E7A4C','#4A6B7E','#7E4C5E','#5C5C6B'][Math.floor(rnd() * 8)];
  const glasses = rnd() < 0.26;
  const beard = rnd() < 0.22 && style !== 3;

  const bg = ['#E8EAED','#EDE7DF','#E4E9EC','#F0EBE4','#E6E4EA'][Math.floor(rnd() * 5)];
  const bg2 = ['#DCE1E6','#E2DAD0','#D7E2E8','#E8E0D6','#DBD9E2'][Math.floor(rnd() * 5)];

  let hairShape = '';
  switch (style) {
    case 0:
      hairShape = `<path d="M22 44c0-13 10-22 26-22s26 9 26 22c0 4-1 8-2 10-1-9-6-14-12-16-8 5-22 6-30 1-4 3-6 8-6 15-1-2-2-6-2-10z" fill="${hair}"/>`;
      break;
    case 1:
      hairShape = `<path d="M21 45c-1-14 10-23 27-23s28 9 27 23c-1-9-4-14-9-17-6 3-14 5-22 4-9-1-15-4-16-8-5 4-7 11-7 21z" fill="${hair}"/>
                   <path d="M27 28c-4 8-4 18-2 26-3-6-4-17 2-26z" fill="${hair}"/>
                   <path d="M69 28c4 8 4 18 2 26 3-6 4-17-2-26z" fill="${hair}"/>`;
      break;
    case 2:
      hairShape = `<path d="M20 46c0-14 11-24 28-24s28 10 28 24v26c-4-2-6-8-6-14 0-10-8-16-22-16s-22 6-22 16c0 6-2 12-6 14z" fill="${hair}"/>
                   <path d="M22 44c0-13 11-22 26-22s26 9 26 22c0 4-1 8-2 10-1-9-6-14-12-16-8 5-22 6-30 1-4 3-6 8-6 15-1-2-2-6-2-10z" fill="${hair}"/>`;
      break;
    case 3:
      hairShape = `<circle cx="48" cy="13" r="9" fill="${hair}"/>
                   <path d="M22 44c0-13 10-22 26-22s26 9 26 22c0 4-1 8-2 10-1-9-6-14-12-16-8 5-22 6-30 1-4 3-6 8-6 15-1-2-2-6-2-10z" fill="${hair}"/>`;
      break;
    case 4:
      hairShape = `<path d="M23 42c0-12 11-21 25-21s25 9 25 21c0 3-1 6-2 8-1-8-6-12-11-14-8 4-20 5-28 1-4 3-7 7-7 13-1-2-2-5-2-8z" fill="${hair}" opacity=".95"/>`;
      break;
    default:
      hairShape = `<path d="M22 44c0-6 1-11 4-15 0-5 5-8 10-8 2-4 7-6 12-5 4-3 10-2 13 2 6 0 10 5 9 11 3 4 4 9 4 15 0 4-1 7-2 9-1-8-5-12-10-14-7 5-20 6-28 1-5 3-8 8-8 14-1-2-4-6-4-10z" fill="${hair}"/>`;
      break;
  }

  const beardShape = beard
    ? `<path d="M30 60c2 12 9 18 18 18s16-6 18-18c-6 6-12 8-18 8s-12-2-18-8z" fill="${hair}" opacity=".28"/>`
    : '';

  const glassesShape = glasses
    ? `<g fill="none" stroke="#2A2E34" stroke-width="2.4" opacity=".85">
         <rect x="27" y="44" width="17" height="13" rx="5"/>
         <rect x="52" y="44" width="17" height="13" rx="5"/>
         <path d="M44 49h8M27 48l-6-3M69 48l6-3"/>
       </g>`
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${bg2}"/>
    </linearGradient>
    <clipPath id="c"><rect width="96" height="96" rx="48"/></clipPath>
  </defs>
  <g clip-path="url(#c)">
    <rect width="96" height="96" fill="url(#bg)"/>
    <path d="M12 96c0-19 16-30 36-30s36 11 36 30z" fill="${shirt2}"/>
    <path d="M36 62h24v10c-2 4-6 6-12 6s-10-2-12-6z" fill="${sk.s}"/>
    <path d="M30 96c1-12 5-20 12-24l6 10 6-10c7 4 11 12 12 24z" fill="${shirt}"/>
    <ellipse cx="48" cy="66" rx="13" ry="5" fill="${sk.f}" opacity=".5"/>
    ${hairShape}
    <ellipse cx="48" cy="47" rx="21" ry="25" fill="${sk.f}"/>
    <ellipse cx="27" cy="50" rx="4" ry="6" fill="${sk.f}"/>
    <ellipse cx="69" cy="50" rx="4" ry="6" fill="${sk.f}"/>
    <path d="M38 45c2-2 5-2 7 0M51 45c2-2 5-2 7 0" stroke="${hair}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <ellipse cx="41" cy="51" rx="2.4" ry="2.8" fill="#231F20"/>
    <ellipse cx="55" cy="51" rx="2.4" ry="2.8" fill="#231F20"/>
    <circle cx="42" cy="50" r=".8" fill="#fff"/>
    <circle cx="56" cy="50" r=".8" fill="#fff"/>
    <path d="M38 58c3 2 6 3 10 3s7-1 10-3" stroke="${sk.s}" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${beardShape}
    ${glassesShape}
  </g>
</svg>`;

  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* ------------------------------------------------------------------
   稳定散列 + 多级降级
   ------------------------------------------------------------------ */
function hashKey(key) {
  let h = 2166136261;
  const k = String(key || 'u');
  for (let i = 0; i < k.length; i++) {
    h ^= k.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 主图源：Unsplash 真实人像 */
function photoURL(key) {
  const h = hashKey(key);
  const id = PHOTO_POOL[h % PHOTO_POOL.length];
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&crop=faces&w=160&h=160&q=80`;
}

/** 次级图源：pravatar 真人照片 */
function pravatarURL(key) {
  const h = hashKey(key);
  return `https://i.pravatar.cc/160?img=${(h % 70) + 1}`;
}

/** 终极兜底：本地矢量人像 */
function fallbackURL(key) {
  return avatarURI(hashKey(key) % 9973);
}

const _avaCache = {};
/** 完整的三级降级链 */
function avatarChain(key) {
  const k = String(key || 'u');
  if (!_avaCache[k]) _avaCache[k] = [photoURL(k), pravatarURL(k), fallbackURL(k)];
  return _avaCache[k];
}

/** 只取主图源 */
function avatarOf(key) {
  return avatarChain(key)[0];
}

/**
 * 生成头像 <img>
 * onerror 逐级降级：Unsplash -> pravatar -> 本地矢量
 *
 * ⚠️ 2026-11-24（本轮，见需求规格 R2.30⑦）：**支持自定义头像** ——
 * —— 用户口径：「『我的』页面头像不能变更；需支持点击头像，弹出更换头像照片的入口。」
 * —— 用户换过的头像存在 STATE.myAvatar（真实环境是 CDN 地址）。
 *    这里统一在这里接管 —— 所以**所有**出现「我」的地方
 *    （我的页、目标详情页的发起人、见证席面板…）都是同一张脸，
 *    不会出现「我的页是新头像、别处还是旧头像」的割裂。
 * —— 降级链怎么处理自定义头像：
 *    自定义头像就是本地/远程的一个真实地址，没有降级链 ——
 *    加载失败就退回默认头像（Unsplash 那套）。
 */
function ava(key, cls = '', alt = '') {
  const k = String(key || 'u');
  /* 自定义头像：只有「我」才有 */
  const custom = (typeof STATE !== 'undefined' && STATE.myAvatar)
    && (typeof ME !== 'undefined' && k === ME.name)
    ? STATE.myAvatar : '';
  if (custom) {
    return `<img class="avatar ${cls}" src="${custom}" alt="${String(alt || key || '')}" referrerpolicy="no-referrer">`;
  }
  const chain = avatarChain(k);
  const name = String(alt || key || '');
  return `<img class="avatar ${cls}" src="${chain[0]}" data-fb1="${chain[1]}" data-fb2="${chain[2]}" alt="${name}" loading="lazy" referrerpolicy="no-referrer">`;
}
