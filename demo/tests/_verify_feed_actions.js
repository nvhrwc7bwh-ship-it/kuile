/* 广场卡片底部操作行 —— 点赞 / 留言 / 监督人数（2026-11-23 用户口径）
   —— 断言：
      ① 底部一行同时有 点赞 / 留言 / 监督人数
      ② 点赞弹窗一横排 4 个短语（不换行）
      ③ 赞数显示在点赞右边；不论选哪个短语都 +1；一天最多 +1 次；颜色变化
      ④ 留言是从底部升起的半屏，没有多余解释文案
      ⑤ 监督人数是纯文本、不可点击
      ⑥ 数据行改为「开始体重 → 目标体重」
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const fakeEl = () => ({
  style: {}, dataset: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
  appendChild(){}, removeChild(){}, addEventListener(){}, removeEventListener(){},
  setAttribute(){}, getAttribute(){ return null; }, querySelector: () => fakeEl(),
  querySelectorAll: () => [], remove(){}, innerHTML: '', textContent: '', value: '',
  focus(){}, click(){},
});
const sandbox = {
  console, window: fakeEl(),
  document: {
    querySelector: () => fakeEl(), querySelectorAll: () => [],
    getElementById: () => fakeEl(), addEventListener(){}, removeEventListener(){},
    createElement: () => fakeEl(), body: fakeEl(),
  },
  localStorage: { getItem: () => null, setItem(){} },
  setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame: () => 0,
  location: { href: 'http://localhost/', pathname: '/' },
  history: { pushState(){}, replaceState(){} },
};
vm.createContext(sandbox);
for (const f of ['info.js','avatars.js','data.js','state.js','pages.js','app.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js',f),'utf8'), sandbox, { filename: f });
}
const PAGES = vm.runInContext('PAGES', sandbox);
const appSrc  = fs.readFileSync(path.join(__dirname, '..', 'js','app.js'),'utf8');
const pagesSrc = fs.readFileSync(path.join(__dirname, '..', 'js','pages.js'),'utf8');
const stateSrc = fs.readFileSync(path.join(__dirname, '..', 'js','state.js'),'utf8');
const infoSrc  = fs.readFileSync(path.join(__dirname, '..', 'js','info.js'),'utf8');
const cssSrc  = fs.readFileSync(path.join(__dirname, '..', 'css','app.css'),'utf8');

vm.runInContext('initState()', sandbox);
vm.runInContext("INJECTORS.newUserWithFlags()", sandbox);

let fails = 0;
function check(cond, msg){
  if(!cond){ console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}

/* ─────────────────────────────────────────────
   ① 底部一行：点赞 / 留言 / 监督（全是「图标 + 数字」）
   ⚠️ 2026-11-24 用户口径：「把点赞和留言文字删掉吧，只保留图标就行，
      不然位置不够了，点赞、留言、监督都显示数值。」
   ───────────────────────────────────────────── */
console.log('=== ① 底部操作行 ===');
const squareHtml = PAGES.square();
const cardStart = squareHtml.indexOf('<div class="feed-card"');
/* ⚠️ 卡片里有超长的头像 data-URI，所以窗口要开得够大 */
const card = squareHtml.slice(cardStart, cardStart + 20000);
check(/data-act="doFeedLike"/.test(card), '卡片有「点赞」按钮');
/* ⚠️ 2026-11-24（本轮）：卡片上的「留言」按钮去掉了 ——
   广场窄卡只留 点赞 + 眼睛（监督）两个，留言统一收到目标详情页。 */
check(!/data-act="openMsgSheet"/.test(card), '卡片没有「留言」按钮了（收到详情页）');
check(/data-act="toggleSupervise"/.test(card), '卡片有「监督」按钮（可点）');
/* 两个都是 button */
check(/<button class="feed-like/.test(card), '点赞是 button');
check(/<button class="feed-sup/.test(card), '监督是 button');
/* 顺序：点赞 → 监督
   ⚠️ 类名后面跟的是模板表达式（`${liked ? 'on' : ''}`），所以只匹配到类名即可 */
const order = ['class="feed-like', 'class="feed-sup'].map(k => card.indexOf(k));
check(order.every((v,i) => v >= 0 && (i === 0 || v > order[i-1])), '顺序是 点赞 → 监督');
/* ⚠️ 文字全部删掉 —— 只保留图标 + 数字
   （渲染结果里不能有「点赞」「留言」这两个词） */
const feedActions = card.slice(card.indexOf('class="feed-actions"'), card.indexOf('class="feed-actions"') + 2000);
check(!/点赞/.test(feedActions), '操作行里没有「点赞」文字');
check(!/留言/.test(feedActions), '操作行里没有「留言」文字');
/* ⚠️ 两个都显示数值 —— 渲染结果里每个按钮后面都跟着一个数字 */
const likeBtn = feedActions.match(/class="feed-like[^"]*"[\s\S]*?<\/button>/);
const supBtn  = feedActions.match(/class="feed-sup[^"]*"[\s\S]*?<\/button>/);
check(likeBtn && /<span>\d+<\/span>/.test(likeBtn[0]), '点赞按钮里显示赞数');
check(supBtn && /<span>\d+<\/span>/.test(supBtn[0]), '监督按钮里显示监督数');
/* ⚠️ 监督图标改成眼睛（跟最下栏一致） */
check(supBtn && /viewBox="0 0 24 24"[\s\S]*?M2 12s3\.6/.test(supBtn[0]), '监督用的是眼睛图标（eyeOpen 的路径）');
/* CSS */
check(/\.feed-like,\.feed-msg,\.feed-sup\{/.test(cssSrc), 'CSS：三个按钮共用一套样式');
check(/\.feed-sup\.on\{/.test(cssSrc), 'CSS：监督点过之后变色');
check(/@keyframes feedPop/.test(cssSrc), 'CSS：有点赞的小特效（feedPop）');
check(/\.feed-like\.pop svg/.test(cssSrc), 'CSS：特效作用在图标上');
/* 旧的类名不能再出现 */
check(!/feed-like-n/.test(card + cssSrc), '旧的 .feed-like-n 已删除');
check(!/feed-sup-n/.test(card + cssSrc), '旧的 .feed-sup-n 已删除');
check(!/feed-msg-n/.test(card + cssSrc), '旧的 .feed-msg-n 已删除');
/* 模板里两个数值分别取自哪里 */
check(/class="feed-like[^"]*"[\s\S]{0,160}?\$\{likeCount\}/.test(pagesSrc), '赞数取自 likeCount');
check(/class="feed-sup[^"]*"[\s\S]{0,160}?\$\{f\.supervisorCount\}/.test(pagesSrc), '监督数取自 f.supervisorCount');
check(/ic\('eyeOpen'\)/.test(pagesSrc.slice(pagesSrc.indexOf('class="feed-sup'))), '监督用 eyeOpen 图标');

/* ─────────────────────────────────────────────
   ② 点赞：普通按钮，无短语弹窗
   ⚠️ 2026-11-24 用户口径：「点赞删除掉短语选择，就改成一个普通的点击按钮，
      点了变色，带一点小小的特效就行。」
   ───────────────────────────────────────────── */
console.log('\n=== ② 点赞是普通按钮 ===');
/* ⚠️ 注释里还留着「openLikePicker」这些名字（说明为什么删），
   所以要剥掉注释再查 */
const appCode = appSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const cssCode = cssSrc.replace(/\/\*[\s\S]*?\*\//g, '');
check(!/openLikePicker/.test(appCode), 'app.js 没有 openLikePicker（短语弹窗已删）');
check(!/LIKE_PHRASES/.test(appCode), 'app.js 没有 LIKE_PHRASES');
check(!/dlg-like/.test(cssCode), 'CSS 没有 .dlg-like');
check(!/data-like=/.test(appCode), '没有 data-like 短语按钮');
check(/case 'doFeedLike'/.test(appCode), 'app.js 注册了 doFeedLike 动作');
/* 点一下就 +1，不弹窗 */
check(/doLike\(fid, ''\)/.test(appCode), '点赞直接 doLike，不选短语');

/* ─────────────────────────────────────────────
   ③ 赞数 / +1 / 一天一次 / 颜色
   ───────────────────────────────────────────── */
console.log('\n=== ③ 赞数规则 ===');
check(/function likeCountOf\(/.test(stateSrc), 'state.js 有 likeCountOf()');
check(/function likedToday\(/.test(stateSrc), 'state.js 有 likedToday()');
check(/function doLike\(/.test(stateSrc), 'state.js 有 doLike()');
const base = vm.runInContext("likeCountOf('f_3')", sandbox);
check(typeof base === 'number' && base >= 0, `初始赞数来自种子（f_3 = ${base}）`);
const r1 = vm.runInContext("doLike('f_3','')", sandbox);
check(r1.ok === true, '第一次点赞成功');
const after1 = vm.runInContext("likeCountOf('f_3')", sandbox);
check(after1 === base + 1, `赞数 +1（${base} → ${after1}）`);
check(vm.runInContext("likedToday('f_3')", sandbox) === true, '今天标记为已赞');
const r2 = vm.runInContext("doLike('f_3','')", sandbox);
check(r2.ok === false, '同一天第二次点赞被拒（一天最多 +1 次）');
check(vm.runInContext("likeCountOf('f_3')", sandbox) === after1, '第二次点赞赞数不再增加');
/* 另一个旗子 —— 验证 +1 */
const base4 = vm.runInContext("likeCountOf('f_4')", sandbox);
vm.runInContext("doLike('f_4','')", sandbox);
check(vm.runInContext("likeCountOf('f_4')", sandbox) === base4 + 1, '点赞 +1');
/* 颜色变化 */
check(/\.feed-like\.on/.test(cssSrc), 'CSS 有 .feed-like.on（点赞后颜色变化）');
check(/class="feed-like \$\{liked \? 'on' : ''\}"/.test(pagesSrc), 'pages.js 按已赞状态加 on 类');

/* ─────────────────────────────────────────────
   ③b 监督：可点、变色、再点取消（2026-11-24）
   ───────────────────────────────────────────── */
console.log('\n=== ③b 监督可点 ===');
check(/function toggleSupervise\(/.test(stateSrc), 'state.js 有 toggleSupervise()');
check(/function msgCountOf\(/.test(stateSrc), 'state.js 有 msgCountOf()');
const before = vm.runInContext("findFlag('f_9').supervisorCount", sandbox);
const sub0 = vm.runInContext("isSubscribed('f_9')", sandbox);
const t1 = vm.runInContext("toggleSupervise('f_9')", sandbox);
check(t1.on !== sub0, '点一下切换监督状态');
check(vm.runInContext("isSubscribed('f_9')", sandbox) !== sub0, '监督状态写进 STATE.subscribed');
check(vm.runInContext("findFlag('f_9').supervisorCount", sandbox) === before + (sub0 ? -1 : 1), '监督数跟着 +1 / -1');
const t2 = vm.runInContext("toggleSupervise('f_9')", sandbox);
check(t2.on === sub0, '再点一次回到原状态（取消监督）');
check(vm.runInContext("findFlag('f_9').supervisorCount", sandbox) === before, '监督数回到原值');
/* 留言数 */
const mc = vm.runInContext("msgCountOf('f_3')", sandbox);
check(typeof mc === 'number' && mc > 0, `留言数取自公开留言（f_3 = ${mc}）`);

/* ─────────────────────────────────────────────
   ④ 留言半屏
   ───────────────────────────────────────────── */
console.log('\n=== ④ 留言半屏 ===');
check(/function openMsgSheet\(/.test(appSrc), 'app.js 有 openMsgSheet()');
check(/case 'openMsgSheet'/.test(appSrc), 'app.js 注册了 openMsgSheet 动作');
check(/openSheet\('',/.test(appSrc), '留言用底部半屏（openSheet）');
check(/id="feedMsgInput"/.test(appSrc), '半屏有留言输入框');
check(/id="feedMsgSend"/.test(appSrc), '半屏有发送按钮');
check(/'留言'|留言/.test(appSrc.slice(appSrc.indexOf('function openMsgSheet'))) === true, '有留言相关文案');
/* 没有多余解释文案（只看渲染出来的 markup）
   ⚠️ 2026-11-23：留言半屏改成三段式，markup 里出现了【嵌套的模板字符串】
      —— 所以不能用非贪婪正则截取（会在嵌套的反引号处断掉）。
      改成：取整个 openMsgSheet 函数体，再把 HTML 注释剥掉。 */
const fnStart = appSrc.indexOf('function openMsgSheet');
const fnEnd   = appSrc.indexOf('\nfunction ', fnStart + 10);
const msgSheet = appSrc.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 8000);
const msgMarkup = msgSheet.replace(/<!--[\s\S]*?-->/g, '');
check(msgMarkup.length > 0, '能提取到留言半屏的 markup');
check(!/仅目标人可见|不会公开|看不到|说明|留言会|只有/.test(msgMarkup), '留言半屏的 markup 里没有多余解释文案');
check(!/class="ms-title"|class="ms-hint"/.test(msgMarkup), '留言半屏没有额外的标题/说明行');
check(/<input class="input"/.test(msgMarkup), '留言半屏有：一个输入框');
check(/<button class="btn sm"/.test(msgMarkup), '留言半屏有：一个发送按钮');

/* ⚠️ 2026-11-23 用户口径：留言改为【公开可见】，半屏改成三段式
   ① 目标人今天（照片 + 心情 + 时间）② 围观者的留言（头像/名称/日期/正文/独立点赞）③ 输入框 */
console.log('\n=== ④b 公开留言半屏（三段式）===');
check(/class="msg-sheet-top"/.test(msgMarkup), '① 顶部是「目标人今天」块');
check(/today-row/.test(msgMarkup), '① 展示目标人今天拍的照片');
check(/class="ms-note"/.test(msgMarkup), '① 展示目标人的心情留言');
check(/class="ms-time"/.test(msgMarkup), '① 展示时间');
check(/class="ms-list"/.test(msgMarkup), '② 有围观者留言列表');
check(/class="ms-item"/.test(msgMarkup), '② 留言条目');
check(/ava\(m\.name, 'xs'\)/.test(msgMarkup), '② 展示围观者头像');
check(/class="ms-who"/.test(msgMarkup), '② 展示围观者名称');
check(/class="ms-when"/.test(msgMarkup), '② 展示日期');
check(/class="ms-text"/.test(msgMarkup), '② 展示留言正文');
check(/class="ms-like/.test(msgMarkup), '② 每条留言有独立点赞按钮');
check(/data-act="likeMsg"/.test(msgMarkup), '② 点赞按钮绑了 likeMsg 动作');
check(/class="ms-input"/.test(msgMarkup), '③ 最下面是输入框');
/* 三段的顺序 */
const iTop = msgMarkup.indexOf('msg-sheet-top');
const iList = msgMarkup.indexOf('ms-list');
const iInput = msgMarkup.indexOf('ms-input');
check(iTop >= 0 && iTop < iList && iList < iInput, '三段顺序：目标人今天 → 留言列表 → 输入框');
/* 公开可见：不再有「仅目标人可见」 */
check(!/仅目标人可见/.test(appSrc), '全站没有「仅目标人可见」残留');
check(/addPublicMsg/.test(appSrc), '发送留言走 addPublicMsg（公开留言）');
/* 时间倒序 */
check(/b\.ts - a\.ts/.test(stateSrc), '公开留言按时间倒序（新的排最高）');
/* 留言不限次数 */
check(!/监督席每日 1 条/.test(pagesSrc + infoSrc), '没有「监督席每日 1 条」的配额');
check(!/见证席每日 3 条/.test(pagesSrc + infoSrc), '没有「见证席每日 3 条」的配额');
check(/不限次数/.test(pagesSrc + infoSrc), '写的是「不限次数」');

/* ─────────────────────────────────────────────
   ⑤ 监督：动态人数 + 可点切换（2026-11-24）
   ───────────────────────────────────────────── */
console.log('\n=== ⑤ 监督 ===');
check(/\$\{f\.supervisorCount\}/.test(pagesSrc), '监督人数取自 f.supervisorCount');
check(!/data-act="openSup"/.test(pagesSrc), '没有「打开监督面板」的动作');
check(/data-act="toggleSupervise"/.test(pagesSrc), '监督可点（toggleSupervise）');

/* ─────────────────────────────────────────────
   ⑥ 数据行：开始体重 → 目标体重
   ───────────────────────────────────────────── */
console.log('\n=== ⑥ 开始体重 → 目标体重 ===');
check(/\$\{f\.startWeight\}/.test(pagesSrc), '数据行显示开始体重');
check(/\$\{f\.targetWeight\}/.test(pagesSrc), '数据行显示目标体重');
check(!/\$\{f\.curWeight\}/.test(card), '数据行不再显示当前体重');
check(!/fml-diff/.test(card), '数据行不再显示「还差多少」');
check(/fml-arrow/.test(card), '有「→」分隔');
check(/\.fml-arrow\{/.test(cssSrc), 'CSS 定义 .fml-arrow');

/* ─────────────────────────────────────────────
   ⑦ 目标详情页留言框的间距（2026-11-23 用户口径）
   ───────────────────────────────────────────── */
console.log('\n=== ⑦ 留言框跟上下卡片拉开距离 ===');
check(/class="card msg-box-card"/.test(pagesSrc), '留言框用独立的 .msg-box-card（不再用 .mt 通用间距）');
check(/\.msg-box-card\{[^}]*margin-top:22px/.test(cssSrc), '留言框上间距 22px');
check(/\.msg-box-card\{[^}]*margin-bottom:22px/.test(cssSrc), '留言框下间距 22px');
check(!/class="card mt"[^>]*>\s*<div[^>]*>\s*<input class="input" id="flagMsgInput"/.test(pagesSrc), '留言框不再用 .mt');

/* ─────────────────────────────────────────────
   ⑧ 留言入口统一（2026-11-24 本轮）
   —— 目标详情页不再自己放输入框，改成一行引导按钮，点了升起广场那个半屏
   ───────────────────────────────────────────── */
console.log('\n=== ⑧ 留言入口统一到半屏 ===');
check(!/id="flagMsgInput"/.test(pagesSrc), '详情页的留言输入框删掉了');
check(!/id="flagMsgSend"/.test(pagesSrc), '详情页的留言发送按钮删掉了');
check(/class="msg-entry"[^>]*data-act="openMsgSheet"/.test(pagesSrc), '详情页留言入口是一行引导按钮，点了开半屏');
check(!/id="flagMsgSend"/.test(appSrc), 'app.js 里原来的输入框事件绑定也删掉了');
check(/\.msg-entry\{/.test(cssSrc), 'CSS 定义了 .msg-entry');

console.log(fails === 0 ? '\n✅ 全部通过' : `\n❌ ${fails} 条失败`);
process.exit(fails === 0 ? 0 : 1);
