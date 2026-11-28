/* 登录页结构 & 样式验证 —— 纯 Node，不依赖浏览器 */
const fs = require('fs');
const path = require('path');
const D = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(D, f), 'utf8');
const pages = read('js/pages.js');
const css = read('css/app.css');
const app = read('js/app.js');

let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };

/* ---- 结构 ---- */
ok(/function loginTabs\(/.test(pages), 'loginTabs() 存在');
ok(!/function loginBlock\(/.test(pages), '旧的 loginBlock() 已移除');
ok(!/login-seg/.test(pages), '旧 .login-seg 分段控件已移除');
ok(!/login-seg/.test(css),  'CSS 里 .login-seg 已移除');
ok(/class="login-tabs"/.test(pages), 'Tab 容器 .login-tabs 存在');

const mTabs = pages.match(/\$\{loginTabs\(STATE\.loginTab\)\}/);
ok(!!mTabs, 'PAGES.login 调用 loginTabs()');

/* ⚠️ 2026-11-22：登录表单卡片抽成 loginCard() 助手（登录页与半屏浮层共用一份）
   —— 所以「Tab 在卡片外」「勾选框在卡片内」这两条断言要改成看助手函数本体。 */
const cardFn = pages.slice(pages.indexOf('function loginCard('), pages.indexOf('PAGES.login ='));

/* Tab 必须在 .login-card 之外 —— 卡片助手里不能出现 loginTabs 调用 */
ok(!/loginTabs\(/.test(cardFn), '卡片内部不含 Tab');

/* 勾选框必须在 .login-card 内部 */
const agreementInside = /<div class="login-card">\s*\$\{loginAgreement\(\)\}/.test(cardFn);
ok(agreementInside, '协议勾选框在 .login-card 内');

/* 卡片助手必须被登录页与半屏浮层同时调用（保证两边完全一致） */
ok(/\$\{loginCard\(\)\}/.test(pages.slice(pages.indexOf('PAGES.login ='))), '登录页调用 loginCard()');
ok(/\$\{loginCard\(\)\}/.test(app), '半屏浮层也调用 loginCard()');
/* 协议文字加粗 */
ok(/<b class="tap-val" data-info="agreement">/.test(pages), '《用户协议》加粗');
ok(/<b class="tap-val" data-info="privacy">/.test(pages), '《隐私政策》加粗');

/* 底部协议链接行仍在 */
ok(/class="login-foot"/.test(pages), '底部协议链接行保留');
ok(/data-info="agreement">用户协议</.test(pages), '底部「用户协议」保留');
ok(/data-info="privacy">隐私政策</.test(pages), '底部「隐私政策」保留');

/* 浮层同步新结构 */
ok(/\$\{loginTabs\(STATE\.loginTab\)\}/.test(app), '浮层也用 loginTabs()');
ok(/class="login-card"/.test(cardFn), '登录卡片助手里有 .login-card');

/* ---- 样式 ---- */
ok(/\.login-tabs\{/.test(css), 'CSS 有 .login-tabs');
ok(/\.login-tabs \.seg-thumb\{/.test(css), '有滑动指示块 .seg-thumb');
ok(/background:var\(--brand\)/.test(css), '指示块用品牌色');
ok(/\.login-tabs button\.on\{color:#fff/.test(css), '选中态白字');
ok(/border-radius:999px/.test(css), '药丸圆角');
ok(/\.login-check\{margin:0 0 10px;padding:0/.test(css), '勾选框在卡片内、按钮上方');
ok(/\.login-check b\{/.test(css), '协议文字加粗样式');
ok(/transform:translateX/.test(css), '指示块用 transform 定位');

/* 药丸式：容器是灰底，指示块是橙底 */
ok(/padding:4px;background:var\(--surface-2\);border-radius:999px/.test(css), '容器灰底药丸');

/* 可拖拽：pointer 事件三件套 */
ok(/pointerdown/.test(app), '绑定了 pointerdown');
ok(/pointermove/.test(app), '绑定了 pointermove');
ok(/pointerup/.test(app), '绑定了 pointerup');
ok(/setPointerCapture/.test(app), '使用了指针捕获');
ok(/segSuppressClick/.test(app), '拖拽后抑制 click');
ok(/initSegThumb/.test(app), '初始化指示块');
ok(/touch-action:pan-y/.test(css), '纵向滚动不被抢');

/* 微信按钮仍是绿色 */
ok(/\.btn\.wx\{background:#07C160/.test(css), '微信按钮保持微信绿');
ok(/\.btn\.wx\.disabled/.test(css), '微信按钮禁用态变灰');

/* ---- 装饰色块背景层 ---- */
ok(/class="login-deco"/.test(pages), '登录页有装饰色块层 .login-deco');
ok(/class="ld-arc ld-a"/.test(pages) && /class="ld-arc ld-e"/.test(pages), '装饰色块 a~e 齐备');
ok(!/class="lh-mark"/.test(pages), '左上角大色块 .lh-mark 已删除');
ok(!/lh-blocks/.test(pages), '大色块图片已删除');
ok(!/\.lh-mark\{/.test(css), 'CSS 里 .lh-mark 已删除');
ok(!/\.lh-blocks\{/.test(css), 'CSS 里 .lh-blocks 已删除');
ok(/\.login-deco\{/.test(css), 'CSS 有 .login-deco');
ok(/pointer-events:none/.test(css), '装饰层不拦截点击');
ok(/z-index:0/.test(css), '装饰层在底层');
ok(/\.login-card\{position:relative;z-index:1/.test(css), '白色卡片浮在装饰层之上');
ok(/\.login-top\{position:relative;z-index:1/.test(css), '标题区浮在装饰层之上');
ok(/\.login-tabs\{\s*position:relative;z-index:1/.test(css), '分段控件浮在装饰层之上');
ok(/opacity:\.\d+/.test(css), '装饰色块用了透明度');

/* ---- 两态布局锁定：切 Tab 时画面完全不动 ---- */
ok(/height:206px/.test(css), '登录卡片高度固定（两态等高）');
ok(/\.login-card\{[\s\S]*?display:flex;flex-direction:column/.test(css), '卡片内部是纵向 flex');
ok(/\.login-panes\{position:relative;flex:1;min-height:0/.test(css), '面板容器撑满卡片剩余高度');
ok(/\.login-pane\{[\s\S]*?position:absolute;inset:0/.test(css), '两面板绝对定位叠加（切 Tab 时无位移）');
ok(/\.login-pane\{[\s\S]*?opacity:0/.test(css) && /\.login-pane\.on\{opacity:1/.test(css), '两面板用透明度交叉淡入（平滑切换）');
ok(/transition:opacity \.26s/.test(css), '面板切换有淡入过渡');
ok(/justify-content:center/.test(css), '面板内容垂直居中（微信态不留大空白）');
ok(!/justify-content:center/.test(css.split('.login-pane.on')[0].split('.login-page{').pop().split('}')[0] || ''), '页面本身不居中（避免两态位置跳动）');

/* ---- 压缩留白：微信态的空白区要比旧版小 ---- */
ok(/height:206px/.test(css) && !/height:238px/.test(css), '卡片高度已从 238px 压到 206px');
ok(/\.login-card \.input\{padding:10px 13px/.test(css), '登录卡输入框上下 padding 已收窄');
ok(/\.login-pane \.field\{margin-bottom:8px/.test(css), '输入框间距已收紧');
ok(/\.login-card \.btn\{height:42px/.test(css), '登录按钮高度已收窄');
ok(/\.login-check\{margin:0 0 10px/.test(css), '勾选框下方留白已收窄');
ok(/\.login-check\{margin:0 0 10px;padding:0/.test(css), '勾选框在卡片内、按钮上方');

console.log('\n' + (fail ? 'FAILURES: ' + fail : 'ALL PASS'));
process.exit(fail ? 1 : 0);
