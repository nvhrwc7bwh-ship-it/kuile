/**
 * 亏了 · Demo CSS → 小程序 WXSS 转换器
 * ===========================================================================
 * 【这个脚本干什么】
 *   demo/css/app.css 是浏览器专用的样式表，用了小程序 WXSS 不支持的东西：
 *     · CSS 变量      var(--brand)          → 展开成字面值
 *     · px 单位                            → rpx（375pt 基准，1px = 2rpx）
 *     · color-mix()                        → 预计算好的混合色
 *     · backdrop-filter                    → 降级成不透明背景
 *     · :not([width]) 之类复杂选择器         → 尽量保留，不能用的单独处理
 *     · @media（桌面外壳专用）               → 整块丢弃（小程序不需要）
 *
 * 【怎么跑】
 *   node tools/build-wxss.js
 *
 * 【产物】
 *   正式上线版/03-小程序前端/styles/tokens.wxss   ← 变量展开后的设计令牌
 *   正式上线版/03-小程序前端/styles/base.wxss     ← 基础组件样式
 * ===========================================================================
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEMO_CSS = path.resolve(ROOT, 'demo/css/app.css');
const OUT_DIR = path.resolve(ROOT, '正式上线版/03-小程序前端/styles');

/* ---------------------------------------------------------------------------
 * 1. 设计令牌 —— 从 demo 的 :root 里抄下来（含颜色语义）
 * ------------------------------------------------------------------------- */
const TOKENS = {
  /* 品牌色：高饱和亮橙 */
  brand: '#FF6B00',
  'brand-600': '#E85A00',
  'brand-400': '#FF8A2B',
  'brand-tint': '#FFF1E4',
  'brand-tint-2': '#FFE0C6',
  'brand-deep': '#C94A00',
  'brand-lite': '#FFA04D',

  /* 强调色 */
  coral: '#FF5A3C',
  'coral-tint': '#FFEDE8',
  amber: '#F59300',
  'amber-tint': '#FFF4DC',
  sky: '#3B82F6',
  'sky-tint': '#EAF2FE',
  violet: '#8B5CF6',
  'violet-tint': '#F3EBFF',
  rose: '#F0413E',
  'rose-tint': '#FFECEC',
  mint: '#0FBE7E',
  'mint-tint': '#E3F9F0',

  /* 中性：暖白系 */
  bg: '#FAF7F4',
  surface: '#FFFFFF',
  'surface-2': '#FDFAF7',
  'surface-3': '#F0E9E1',
  line: '#F0E8E0',
  'line-2': '#E6DACF',

  ink: '#1C1613',
  'ink-2': '#4A423B',
  'ink-3': '#857A6F',
  'ink-4': '#B3A79A',

  /* 圆角 */
  'r-xs': '8px',
  'r-sm': '12px',
  r: '16px',
  'r-lg': '20px',
  'r-xl': '26px',
  'r-full': '999px',

  /* 阴影：暖调 */
  'sh-1': '0 1px 2px rgba(74,52,32,.04), 0 1px 3px rgba(74,52,32,.06)',
  'sh-2': '0 2px 8px rgba(74,52,32,.07), 0 1px 3px rgba(74,52,32,.04)',
  'sh-3': '0 8px 24px rgba(74,52,32,.09), 0 2px 6px rgba(74,52,32,.05)',
  'sh-4': '0 16px 48px rgba(74,52,32,.16), 0 4px 12px rgba(74,52,32,.07)',
  'sh-brand': '0 6px 20px rgba(255,107,0,.34)',
  'sh-brand-sm': '0 2px 8px rgba(255,107,0,.32)',
  'sh-brand-md': '0 8px 24px rgba(255,107,0,.36)',
  'sh-brand-lg': '0 14px 36px rgba(255,107,0,.40)',
  'sh-brand-ring': '0 0 0 3px rgba(255,107,0,.14)',
  'sh-lift': '0 1px 2px rgba(74,52,32,.05), 0 4px 12px rgba(74,52,32,.06)',
  'sh-lift-sm': '0 1px 2px rgba(74,52,32,.04), 0 2px 8px rgba(74,52,32,.05)',
  'sh-lift-lg': '0 4px 12px rgba(74,52,32,.07), 0 12px 32px rgba(74,52,32,.09)',

  /* 字体 */
  font: '-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","HarmonyOS Sans SC","Microsoft YaHei","Noto Sans CJK SC",system-ui,sans-serif',
  'font-num': '"SF Pro Display",-apple-system,"Helvetica Neue",Inter,system-ui,sans-serif',

  /* 尺寸 */
  'nav-h': '52px',
  'tab-h': '62px',
};

/* ---------------------------------------------------------------------------
 * 2. 工具函数
 * ------------------------------------------------------------------------- */

/** 十六进制色 → [r,g,b] */
function hex2rgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** 两个颜色按比例混合 —— 用来替代 color-mix() */
function mix(colorA, colorB, ratio) {
  const a = hex2rgb(colorA);
  const b = hex2rgb(colorB);
  const out = a.map((v, i) => Math.round(v + (b[i] - v) * ratio));
  return '#' + out.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * px → rpx
 * 375pt 宽的设备上，1px = 2rpx（750rpx = 屏幕宽）
 */
const PX2RPX = 2;

function px2rpx(value) {
  return String(value).replace(/(-?[\d.]+)px/g, (_, n) => {
    const rpx = Math.round(parseFloat(n) * PX2RPX * 100) / 100;
    return rpx + 'rpx';
  });
}

/* ---------------------------------------------------------------------------
 * 3. 降级处理表
 * ------------------------------------------------------------------------- */

/**
 * color-mix(in srgb, COLOR PCT%, transparent)
 * → 半透明的实色（小程序不支持 color-mix）
 * 做法：把 COLOR 按 PCT% 与白色混合，再给对应的透明度
 */
function replaceColorMix(css) {
  return css.replace(
    /color-mix\(\s*in\s+srgb\s*,\s*([^,]+?)\s+(\d+(?:\.\d+)?)%\s*,\s*transparent\s*\)/gi,
    (_, color, pct) => {
      const p = parseFloat(pct) / 100;
      /* 与背景色 #FAF7F4 混合，得到视觉上等效的实色 */
      return mix('#FAF7F4', color.trim(), p);
    }
  );
}

/**
 * backdrop-filter —— 小程序不支持
 * 做法：把声明整个删掉（含前导分号）
 * ⚠️ 不能只匹配「独占一行」的情况 —— demo 里多数是内联在一条声明里的：
 *    background:rgba(255,255,255,.9);backdrop-filter:blur(4px);
 */
function dropBackdropFilter(css) {
  return css
    /* 内联情况：前面有分号 */
    .replace(/;\s*backdrop-filter\s*:[^;}]*/gi, '')
    /* 内联情况：在声明开头（前面是 { 或换行） */
    .replace(/(\{|\})\s*backdrop-filter\s*:[^;}]*/gi, '$1')
    /* 独占一行 */
    .replace(/^[^\n{};]*backdrop-filter\s*:[^;\n]*;?[^\n]*$/gim, '');
}

/* ---------------------------------------------------------------------------
 * 4. 主转换
 * ------------------------------------------------------------------------- */

/**
 * 展开 CSS 变量：var(--x) → 字面值
 * 支持嵌套：var(--x, var(--y))
 */
function expandVars(css) {
  let out = css;
  /* 反复替换，直到没有 var() 为止（处理嵌套与相互引用） */
  for (let i = 0; i < 10; i++) {
    const before = out;
    out = out.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\s*\)/g,
      (m, name, fallback) => {
        if (Object.prototype.hasOwnProperty.call(TOKENS, name)) {
          return TOKENS[name];
        }
        return fallback ? fallback.trim() : 'inherit';
      });
    if (out === before) break;
  }
  return out;
}

/**
 * 丢弃桌面外壳专用的 CSS
 * demo 里的 .rail / .stage / .device / .screen / .statusbar / .island
 * 是浏览器里「手机模型 + 左侧导览栏」的外壳，小程序里完全没有。
 */
const SHELL_SELECTORS = [
  '.shell', '.rail', '.rail-top', '.rail-logo', '.rl-dog', '.rail-sub',
  '.rail-body', '.rail-label', '.rail-nav', '.rail-tips', '.rail-foot',
  '.stage', '.device', '.btn-side', '.screen', '.statusbar', '.sb-time',
  '.sb-icons', '.sb-cell', '.sb-wifi', '.sb-batt', '.island', '.viewport',
  '#devPanel', '.dp-head', '.dp-title', '.dp-sub', '.dp-body', '.dp-group',
  '.dp-btn', '.dp-foot', '.dp-stat',
  '.sheet-handle',
  /* 图片查看器 —— 小程序用 wx.previewImage 替代，这一整块不要 */
  '.pv', '.pv-head', '.pv-title', '.pv-count', '.pv-close', '.pv-slide',
  '.pv-dots', '.pv-dot', '.pv-track', '.pv-foot',
  '.scrim', '.toast',
];

/**
 * 提取一段 CSS 里「选择器列表」中的单个选择器
 */
function splitSelectors(selectorText) {
  /* 简易分割：逗号分隔，但不拆逗号在括号里的 */
  const parts = [];
  let depth = 0;
  let buf = '';
  for (const ch of selectorText) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

/** 判断选择器是不是桌面外壳专用 */
function isShellSelector(sel) {
  const s = sel.trim();
  if (!s) return false;
  /* 命中外壳类名 */
  for (const shell of SHELL_SELECTORS) {
    if (s === shell || s.startsWith(shell + ' ') || s.startsWith(shell + ':') ||
        s.startsWith(shell + '.') || s.startsWith(shell + '>')) {
      return true;
    }
  }
  /* id 选择器（demo 专用的） */
  if (/^#/.test(s)) return true;
  return false;
}

/**
 * 把 CSS 解析成「规则列表」
 * 每条规则 = { selectors: string[], body: string }
 *
 * ⚠️ 不能用简单的正则 [^{}]+ 因为：
 *    · 注释里有 { 和 }（比如「{ 发起 + 24h }」）
 *    · @media 里有嵌套规则
 *    必须手写扫描器，跳过注释、正确配对花括号。
 */
function parseRules(css) {
  const rules = [];
  let i = 0;
  let selStart = 0;
  const len = css.length;

  while (i < len) {
    const ch = css[i];

    /* 跳过注释 */
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? len : end + 2;
      continue;
    }

    /* 字符串字面量 */
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < len && css[j] !== quote) {
        if (css[j] === '\\') j++;
        j++;
      }
      i = j + 1;
      continue;
    }

    if (ch === '{') {
      /* 取选择器文本 —— 必须剔除其中的注释。
       * 否则注释紧挨着选择器时（demo 里到处都是），
       * 选择器会带上注释文字，匹配不上外壳名单。 */
      const selectorText = css.slice(selStart, i)
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .trim();
      /* 找配对的右花括号 */
      let depth = 1;
      let j = i + 1;
      let bodyStart = i + 1;
      while (j < len && depth > 0) {
        const c2 = css[j];
        if (c2 === '/' && css[j + 1] === '*') {
          const e = css.indexOf('*/', j + 2);
          j = e === -1 ? len : e + 2;
          continue;
        }
        if (c2 === '"' || c2 === "'") {
          const quote = c2;
          let k = j + 1;
          while (k < len && css[k] !== quote) {
            if (css[k] === '\\') k++;
            k++;
          }
          j = k + 1;
          continue;
        }
        if (c2 === '{') depth++;
        else if (c2 === '}') depth--;
        j++;
      }
      const body = css.slice(bodyStart, j - 1);
      rules.push({ selectors: splitSelectors(selectorText), body });
      i = j;
      selStart = j;
      continue;
    }

    i++;
  }

  return { rules, tail: css.slice(selStart) };
}

/**
 * 删除所有以 atRule 开头的块（@media / @supports / @keyframes 等）
 * 用扫描器找花括号配对，正确处理嵌套与注释
 */
function dropAtBlocks(css, atRule) {
  let out = '';
  let i = 0;
  const len = css.length;
  while (i < len) {
    /* 找下一个 at-rule 的起点（atRule 传的是不带 @ 的名字，如 'media'） */
    const at = css.indexOf('@' + atRule, i);
    if (at === -1) {
      out += css.slice(i);
      break;
    }
    out += css.slice(i, at);
    /* 找到该 at-rule 的第一个 { */
    let j = at;
    while (j < len && css[j] !== '{' && css[j] !== ';') j++;
    if (css[j] === ';') {
      /* 没有块的（如 @import）—— 连它一起删 */
      i = j + 1;
      continue;
    }
    /* 扫描配对花括号 */
    let depth = 1;
    let k = j + 1;
    while (k < len && depth > 0) {
      const c = css[k];
      if (c === '/' && css[k + 1] === '*') {
        const e = css.indexOf('*/', k + 2);
        k = e === -1 ? len : e + 2;
        continue;
      }
      if (c === '"' || c === "'") {
        const q = c;
        let m = k + 1;
        while (m < len && css[m] !== q) {
          if (css[m] === '\\') m++;
          m++;
        }
        k = m + 1;
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      k++;
    }
    i = k;
  }
  return out;
}

/**
 * 重新序列化规则列表
 */
function serializeRules(rules) {
  return rules.map(r => r.selectors.join(',') + '{' + r.body + '}').join('\n');
}

/**
 * 删除桌面外壳相关的规则
 * 做法：逐条规则解析，丢弃选择器全部命中外壳的
 */
function dropShellRules(css) {
  const { rules } = parseRules(css);
  const kept = rules.map(r => {
    const k = r.selectors.filter(s => !isShellSelector(s));
    if (k.length === 0) return null;
    if (k.length !== r.selectors.length) {
      return { selectors: k, body: r.body };
    }
    return r;
  }).filter(Boolean);
  return serializeRules(kept);
}

/**
 * 处理小程序不支持的伪类
 * · ::-webkit-scrollbar —— 不支持，删
 * · svg:not([width]) —— WXSS 不支持这种复杂形式，遇到就删整条
 */
function dropUnsupportedSelectors(css) {
  const { rules } = parseRules(css);
  const kept = rules.map(r => {
    const k = r.selectors.filter(s => {
      if (/::-webkit/.test(s)) return false;
      if (/svg:not\(\[/.test(s)) return false;
      return true;
    });
    if (k.length === 0) return null;
    if (k.length !== r.selectors.length) {
      return { selectors: k, body: r.body };
    }
    return r;
  }).filter(Boolean);
  return serializeRules(kept);
}

/* ---------------------------------------------------------------------------
 * 5. 主流程
 * ------------------------------------------------------------------------- */
function build() {
  if (!fs.existsSync(DEMO_CSS)) {
    console.error('❌ 找不到 demo/css/app.css');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let css = fs.readFileSync(DEMO_CSS, 'utf8');

  const before = css.length;

  /* 步骤 1：删掉 @media 块（小程序不需要桌面响应式）
   * 做法：用扫描器找到 @media 的花括号配对，整块删掉 */
  css = dropAtBlocks(css, 'media');

  /* 步骤 2：删掉桌面外壳规则 */
  css = dropShellRules(css);

  /* 步骤 3：删掉不支持的选择器 */
  css = dropUnsupportedSelectors(css);

  /* 步骤 4：color-mix → 预计算实色 */
  css = replaceColorMix(css);

  /* 步骤 5：backdrop-filter → 删除 */
  css = dropBackdropFilter(css);

  /* 步骤 6：展开 CSS 变量 */
  css = expandVars(css);

  /* 步骤 7：px → rpx */
  css = px2rpx(css);

  /* 步骤 8：清理多余的 :root 块（变量已经展开） */
  css = css.replace(/:root\s*\{[^}]*\}/g, '');

  /* 步骤 9：清掉空规则 */
  css = css.replace(/\n\s*\n\s*\n+/g, '\n\n');

  /* ---- 输出 ---- */
  const header = `/* ============================================================================
 * 亏了 · 设计令牌（由 tools/build-wxss.js 自动生成，请勿手改）
 * ---------------------------------------------------------------------------
 * 来源：demo/css/app.css
 * 转换：CSS 变量展开 · px→rpx · color-mix 预计算 · backdrop-filter 降级
 * ============================================================================ */
`;

  const tokensFile = path.join(OUT_DIR, 'tokens.wxss');
  fs.writeFileSync(tokensFile, header + css, 'utf8');

  console.log('✅ 已生成 tokens.wxss');
  console.log(`   ${before} 字节 → ${css.length} 字节`);
  console.log(`   ${path.relative(ROOT, tokensFile)}`);

  /* ---- 检查还有没有没展开的 var() ---- */
  const leftover = (css.match(/var\(--/g) || []).length;
  if (leftover > 0) {
    console.warn(`\n⚠️ 仍有 ${leftover} 处 var() 未展开，请检查 tokens 字典`);
  } else {
    console.log('   所有 CSS 变量已展开 ✓');
  }
}

build();
