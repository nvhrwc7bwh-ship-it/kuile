/**
 * 亏了 · 底部半屏抽屉
 * ===========================================================================
 * 【对应 demo 的 #sheet】
 *   demo 里的底部半屏浮层（筛选、分享渠道、召集令报名情况等都用它）。
 *
 * 【怎么用】
 *   WXML:
 *     <k-sheet visible="{{showSheet}}" title="筛选" bind:close="closeSheet">
 *       <view>这里放内容</view>
 *     </k-sheet>
 *
 *   JS:
 *     data: { showSheet: false }
 *     openSheet() { this.setData({ showSheet: true }); }
 *     closeSheet() { this.setData({ showSheet: false }); }
 *
 * 【属性】
 *   visible   是否显示
 *   title     标题（可选）
 *   sub       副标题（可选）
 *   closable  点遮罩能否关闭（默认 true）
 * ===========================================================================
 */
Component({
  options: {
    multipleSlots: true,
    styleIsolation: 'apply-shared',
  },

  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '' },
    sub: { type: String, value: '' },
    closable: { type: Boolean, value: true },
  },

  methods: {
    onMaskTap() {
      if (this.data.closable) {
        this.triggerEvent('close');
      }
    },

    onCloseTap() {
      this.triggerEvent('close');
    },

    /* 阻止点击内容区时冒泡到遮罩 */
    noop() {},
  },
});
