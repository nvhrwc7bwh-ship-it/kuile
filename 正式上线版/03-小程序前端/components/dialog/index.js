/**
 * 亏了 · 居中弹窗
 * ===========================================================================
 * 【对应 demo 的 dialog()】
 *   demo 用的是自定义弹窗（不是 confirm）——
 *   标题 + 正文（可带 HTML）+ 两个按钮。
 *
 * 【为什么不用 wx.showModal】
 *   wx.showModal 不支持：
 *     · 富文本（demo 的正文里要加粗、要换行）
 *     · 三个及以上按钮
 *     · 自定义按钮样式
 *
 * 【怎么用】
 *   WXML:
 *     <k-dialog visible="{{dlg.visible}}" title="{{dlg.title}}" content="{{dlg.content}}"
 *              confirm-text="确认支付" cancel-text="取消"
 *              bind:confirm="onConfirm" bind:cancel="onCancel" />
 *
 *   JS:
 *     showDialog() {
 *       this.setData({ dlg: { visible: true, title: '确认支付？', content: '交完这一笔…' } });
 *     }
 *
 * 【属性】
 *   visible      是否显示
 *   title        标题
 *   content      正文（支持 \n 换行）
 *   richContent  富文本正文（HTML 字符串，优先于 content）
 *   confirmText  确认按钮文案
 *   cancelText   取消按钮文案
 *   showCancel   是否显示取消按钮（默认 true）
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
    content: { type: String, value: '' },
    richContent: { type: String, value: '' },
    confirmText: { type: String, value: '确认' },
    cancelText: { type: String, value: '取消' },
    showCancel: { type: Boolean, value: true },
    danger: { type: Boolean, value: false },
  },

  methods: {
    onConfirm() {
      this.triggerEvent('confirm');
    },

    onCancel() {
      this.triggerEvent('cancel');
    },

    onMaskTap() {
      /* 点遮罩不关闭 —— demo 的弹窗也是这样（必须做出选择） */
    },

    noop() {},
  },
});
