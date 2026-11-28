/**
 * 亏了 · 图标渲染工具
 * ===========================================================================
 * 【这个脚本干什么】
 *   把 utils/icons.js 里的 SVG 字符串转成小程序 <image> 能用的 data URI。
 *
 * 【为什么不能直接用 SVG】
 *   1. 小程序 WXML 里不能写 <svg> 标签 —— 微信不支持。
 *   2. <image> 的 src 支持 SVG data URI，但 SVG 里不能用 currentColor
 *      （那是网页里的说法，小程序不认识）—— 必须换成具体的颜色值。
 *
 * 【怎么用】
 *   const icon = require('../../utils/icon');
 *
 *   // WXML 里：
 *   // <image class="ico" src="{{icoHome}}" />
 *   // JS 里：
 *   // data: { icoHome: icon.iconSrc('home', '#FF6B00') }
 *
 * 【性能】
 *   同一个图标 + 同一个颜色只会转一次（结果缓存在内存里），
 *   所以列表里反复用同一个图标不会卡。
 * ===========================================================================
 */
const icons = require('./icons');

/* ---------------------------------------------------------------------------
 * 缓存 —— key 是「图标名+颜色」，避免重复转换
 * ------------------------------------------------------------------------- */
const cache = {};

/**
 * 把 SVG 里的 currentColor 换成实际颜色
 * @param {string} svg   SVG 字符串
 * @param {string} color 颜色，如 '#FF6B00'
 */
function applyColor(svg, color) {
  return svg
    /* stroke="currentColor" → stroke="#FF6B00" */
    .replace(/stroke="currentColor"/g, 'stroke="' + color + '"')
    /* fill="currentColor" → fill="#FF6B00" */
    .replace(/fill="currentColor"/g, 'fill="' + color + '"');
}

/**
 * 取图标的 data URI
 * @param {string} name  图标名（见 icons.js）
 * @param {string} color 颜色，默认继承品牌橙
 * @returns {string} data URI，可直接给 <image src>
 */
function iconSrc(name, color) {
  const c = color || '#FF6B00';
  const key = name + '|' + c;
  if (cache[key]) return cache[key];

  const svg = icons[name];
  if (!svg) {
    /* 图标不存在时给一个空图，避免报错但页面不崩 */
    console.warn('[icons] 找不到图标：' + name);
    return '';
  }

  const colored = applyColor(svg, c);
  /* encodeURIComponent 会把 # 之类编码掉，data URI 才能正常用 */
  const uri = 'data:image/svg+xml,' + encodeURIComponent(colored);
  cache[key] = uri;
  return uri;
}

/**
 * 批量取一组图标（页面里一次准备完，setData 一次）
 * @param {string[]} names 图标名数组
 * @param {string} color  颜色
 * @returns {object} { name: dataUri, ... }
 */
function iconSet(names, color) {
  const out = {};
  names.forEach(n => {
    out[n] = iconSrc(n, color);
  });
  return out;
}

module.exports = { iconSrc, iconSet, applyColor, icons };
