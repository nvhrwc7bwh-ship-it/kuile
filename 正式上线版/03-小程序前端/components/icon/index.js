/**
 * 亏了 · 图标组件
 * ===========================================================================
 * 【怎么用】
 *   WXML:
 *     <k-icon name="target" color="#FF6B00" size="32" />
 *     <k-icon name="bell" color="#FFFFFF" size="24" />
 *
 * 【属性】
 *   name   图标名（见 utils/icons.js）
 *   color  颜色，默认品牌橙
 *   size   尺寸（rpx），默认 32
 *
 * 【原理】
 *   小程序 WXML 不能写 <svg>，但 <image> 能显示 SVG 的 data URI。
 *   所以把 SVG 转成 data URI 再交给 <image>。
 *   颜色在转换时就把 currentColor 换成实际色值。
 * ===========================================================================
 */
const { iconSrc } = require('../../utils/icon');

Component({
  options: {
    styleIsolation: 'apply-shared',
  },

  properties: {
    name: { type: String, value: '' },
    color: { type: String, value: '#FF6B00' },
    size: { type: [Number, String], value: 32 },
  },

  data: {
    src: '',
  },

  observers: {
    'name, color': function (name, color) {
      if (!name) {
        this.setData({ src: '' });
        return;
      }
      this.setData({ src: iconSrc(name, color) });
    },
  },
});
