/* =========================================================
   R2.30 巡检（2026-11-24 第四轮新增）
   ------------------------------------------------------------
   本轮用户口径七部分：
     一、本人目标详情页・打卡日历
        ① 删除断卡提示整句（已断 N/M，X 月 X 日未打卡，12 小时内可补）
     二、今日打卡页・昨日补卡
        ① 删除补卡提示小卡片（昨天忘了打卡…）
        ② 补卡页面复用今日打卡页（内容一致，区别只在于打哪一天）
     三、见证席申请弹窗
        ① 「取消」「申请」两个按钮居中且等大
     四、见证席判定独立页面
        ① 删除「本次打卡的物证」标题
     五、广场・招募详情页
        ① 见证席人数上限统一为 10 人；去掉三个点的占位展示
     六、通知列表
        ① 支持左滑删除
     七、「我的」页面头像
        ① 增加头像更换入口（点头像弹出更换头像的操作）
   ========================================================= */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const fakeEl = () => ({
  style: {}, dataset: {},
  classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
  appendChild(){}, removeChild(){}, addEventListener(){}, removeEventListener(){},
  setAttribute(){}, getAttribute(){ return null; },
  querySelector: () => fakeEl(), querySelectorAll: () => [], remove(){},
  innerHTML: '', textContent: '', value: ''
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
vm.runInContext('initState()', sandbox);

const appSrc   = fs.readFileSync(path.join(__dirname, '..', 'js','app.js'),'utf8');
const pagesSrc = fs.readFileSync(path.join(__dirname, '..', 'js','pages.js'),'utf8');
const cssSrc   = fs.readFileSync(path.join(__dirname, '..', 'css','app.css'),'utf8');
const stateSrc = fs.readFileSync(path.join(__dirname, '..', 'js','state.js'),'utf8');
const avaSrc   = fs.readFileSync(path.join(__dirname, '..', 'js','avatars.js'),'utf8');

/** 去掉 HTML 注释 —— 注释里的话不算「展示」 */
const strip = s => String(s).replace(/<!--[\s\S]*?-->/g, '');
const s = (code) => vm.runInContext(code, sandbox);

let fails = 0;
function check(cond, msg) {
  if (!cond) { console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}

/* =========================================================
   一、本人目标详情页・打卡日历：删除断卡提示整句
   ========================================================= */
console.log('\n=== 一、打卡日历：删除断卡提示整句 ===');
vm.runInContext("INJECTORS.missedCheckin()", sandbox);
const det = strip(PAGES.flagDetail('f_own'));
check(!/已断\s*<b>/.test(det), '不再有「已断 N / M」那句');
check(!/未打卡，12 小时内可补/.test(det), '不再有「X 月 X 日未打卡，12 小时内可补」');
check(!/未打卡，已超过 12 小时/.test(det), '不再有「未打卡，已超过 12 小时」');
check(!/class="brk-ratio/.test(det), '不再有 .brk-ratio 那一行');
/* 折叠头右侧仍然有断卡次数（不能把信息也一起删掉） */
check(/断卡 \d+\/\d+ 次/.test(det), '折叠头右侧仍有「断卡 N/M 次」');
/* 告警条保留 */
check(/再断 1 次，这个 Flag 就结束了|断卡次数超过上限/.test(det)
  || /brk-msg/.test(pagesSrc), '告警条（.brk-msg）保留');
/* CSS 也清掉了 */
check(!/\.brk-ratio\{/.test(cssSrc), 'CSS 里 .brk-ratio 样式已删');

/* =========================================================
   二、今日打卡页・昨日补卡
   ========================================================= */
console.log('\n=== 二、打卡页・补卡 ===');
const ci = strip(PAGES.checkin('f_own'));
check(!/昨天忘了打卡/.test(ci), '补卡提示小卡片已删');
check(!/补一张昨天的卡/.test(ci), '打卡页里没有「补一张昨天的卡」按钮');
check(!/12 小时内/.test(ci), '打卡页没有「12 小时内」补卡文案');

/* ② 补卡复用今日打卡页 —— 两种模式结构一致 */
s("enterMakeupMode('f_own')");
const mk = strip(PAGES.checkin('f_own'));
s("exitMakeupMode()");/* 两种模式都必须有的元素（渲染结果里的痕迹，不是源码里的函数名） */
['ci-hero-word', 'ci-guide', 'checkinNote', 'noteCount', 'ci-shot']
  .forEach(k => {
    check(ci.indexOf(k) >= 0 && mk.indexOf(k) >= 0, `两种模式都有「${k}」`);
  });
/* 生活照那一栏：标题 + 计数上限 */
check(/生活照（可选）/.test(ci) && /生活照（可选）/.test(mk), '两种模式都有「生活照（可选）」栏');
check(/0 \/ 3/.test(ci) && /0 \/ 3/.test(mk), '两种模式的生活照计数上限一致（0 / 3）');
/* 打卡照（物证）区 */
check(/ci-hero/.test(ci) && /ci-hero/.test(mk), '两种模式都有打卡照（物证）区 .ci-hero');
/* 打卡页与补卡页结构相同：关键区块数一致 */
const blocks = h => (h.match(/class="section"/g) || []).length;
check(blocks(ci) === blocks(mk), `两种模式 section 数一致（${blocks(ci)} vs ${blocks(mk)}）`);
/* 区别只在「打哪一天」 */
check(/今日打卡/.test(ci) && !/补昨天的卡/.test(ci), '打卡模式标题是「今日打卡」');
check(/补昨天的卡/.test(mk) && !/今日打卡/.test(mk), '补卡模式标题是「补昨天的卡」');
check(/补第 \d+ 天/.test(mk), '补卡模式写明补的是第几天');
check(/data-act="doMakeupCheckin"/.test(mk), '补卡模式提交按钮走 doMakeupCheckin');
check(/data-act="doCheckin"/.test(ci), '打卡模式提交按钮走 doCheckin');
check(/补上这张卡|先拍张照才能补卡/.test(mk), '补卡按钮文案是「补上这张卡」');
check(/提交打卡|先拍张照才能打卡/.test(ci), '打卡按钮文案是「提交打卡」');
/* 拍了照之后，按钮就变成可提交的那个 */
s("enterMakeupMode('f_own')");
s("setCheckinShot('assets/checkin/ck01.jpg', 70)");
const mkShot = strip(PAGES.checkin('f_own'));
check(/补上这张卡/.test(mkShot), '拍完照后补卡按钮是「补上这张卡」（可提交）');
check(!/disabled/.test(mkShot.split('sticky-cta')[1] || ''), '拍完照后补卡按钮不是禁用态');
s("clearCheckinDraft('f_own')");
s("exitMakeupMode()");

/* 状态层：补卡模式 */
check(/function enterMakeupMode/.test(stateSrc), 'state 有 enterMakeupMode()');
check(/function exitMakeupMode/.test(stateSrc), 'state 有 exitMakeupMode()');
check(/function isMakeupMode/.test(stateSrc), 'state 有 isMakeupMode()');
check(/function checkinTargetDay/.test(stateSrc), 'state 有 checkinTargetDay()');
check(s("checkinMode()") === 'checkin', '默认是打卡模式');
s("enterMakeupMode('f_own')");
check(s("checkinMode()") === 'makeup', 'enterMakeupMode 切到补卡模式');
check(s("checkinTargetDay(FLAGS.f_own)") > 0, '补卡模式有目标天');
s("exitMakeupMode()");
check(s("checkinMode()") === 'checkin', 'exitMakeupMode 回到打卡模式');

/* 补卡入口：首页的补卡提醒卡 → 进补卡模式的打卡页 */
const home = strip(PAGES.home());
check(/data-makeup-btn/.test(home), '首页补卡提醒卡仍有补卡按钮');
check(/function enterMakeup\(/.test(appSrc), 'app.js 有 enterMakeup()（进补卡模式）');
check(!/doMakeupAction/.test(appSrc), '旧的一键补完 doMakeupAction 已删');
check(/case 'doMakeupCheckin'/.test(appSrc), 'app.js 有 doMakeupCheckin 动作');
check(/function submitMakeupCheckin/.test(appSrc), 'app.js 有 submitMakeupCheckin()');
/* 补卡也要落物证 / 生活照 / 心情 */
check(/commitCheckinShot\(f\.id, day\)/.test(appSrc), '补卡也落打卡照（物证）');
check(/commitExtraPhotos\(f\.id, day\)/.test(appSrc), '补卡也落生活照');
check(/commitCheckinNote\(f\.id, day\)/.test(appSrc), '补卡也落心情 / 体悟');

/* doMakeup 支持指定天 */
check(/function doMakeup\(flagId, weight, targetDay\)/.test(stateSrc), 'doMakeup 接受 targetDay');

/* =========================================================
   三、见证席申请弹窗：按钮居中且等大
   ========================================================= */
console.log('\n=== 三、见证席申请弹窗按钮 ===');
check(/dlg-apply[\s\S]{0,600}?dlg-actions-even/.test(appSrc), '申请弹窗按钮行带 .dlg-actions-even');
check(/\.dialog-actions\.dlg-actions-even\{[^}]*justify-content:center/.test(cssSrc), '按钮行居中');
check(/\.dialog-actions\.dlg-actions-even \.btn\{[^}]*flex:1 1 0/.test(cssSrc), '两个按钮等宽（flex:1 1 0）');
check(!/\.dialog-actions\.dlg-actions-even \.btn\{[^}]*min-width:104px/.test(cssSrc), '不再用 min-width（那样只是「至少一样宽」）');

/* =========================================================
   四、见证席判定独立页面：删除「本次打卡的物证」
   ========================================================= */
console.log('\n=== 四、见证席判定页面 ===');
check(!/>本次打卡的物证</.test(pagesSrc), 'pages.js 里没有「本次打卡的物证」标题');
check(!/class="wf-shots-t"/.test(pagesSrc), '标题元素 .wf-shots-t 已删');
check(!/\.wf-shots-t\{/.test(cssSrc), 'CSS 里 .wf-shots-t 已删');
/* 照片行本身保留 */
check(/class="wf-shots"/.test(pagesSrc), '照片行 .wf-shots 保留');

/* =========================================================
   五、招募详情页：见证席上限统一 10 人
   ========================================================= */
console.log('\n=== 五、招募详情页 ===');
/* 找一个在招募中的局 */
vm.runInContext("INJECTORS.recruiting()", sandbox);
const recFlag = vm.runInContext(
  "Object.values(FLAGS).find(f=>f.recruiting) ? Object.values(FLAGS).find(f=>f.recruiting).id : ''", sandbox);
const rd = strip(PAGES.recruitDetail(recFlag));
check(/已有见证席/.test(rd), '招募详情有「已有见证席」');
check(/\/ 10/.test(rd), '见证席上限是 10（写作 N / 10）');
check(/还差 \d+ 位/.test(rd) || /已招满/.test(rd), '有「还差 N 位 / 已招满」');
/* 三个点的占位去掉 */
check(!/class="rd-st-slots"/.test(rd), '不再有 .rd-st-slots（三个点的占位）');
check(!/\.rd-st-slots\{/.test(cssSrc), 'CSS 里 .rd-st-slots 规则已删');
check(!/WITNESS_SLOTS_BY_DAYS\[f\.days\]/.test(pagesSrc), '不再按周期分档算坑位');
check(/const slots = WITNESS_MAX/.test(pagesSrc), '坑位数直接用 WITNESS_MAX');
check(s('WITNESS_MAX') === 10, 'WITNESS_MAX = 10');

/* =========================================================
   六、通知列表：左滑删除
   ========================================================= */
console.log('\n=== 六、通知左滑删除 ===');
vm.runInContext("INJECTORS.notifs()", sandbox);
const nt = strip(PAGES.notifs());
check(/class="swipe"/.test(nt), '通知行包在 .swipe 里');
check(/class="swipe-del"/.test(nt), '有删除按钮 .swipe-del');
check(/data-act="dismissNotif"/.test(nt), '删除按钮走 dismissNotif 动作');
check(/data-swipe/.test(nt), '容器带 data-swipe');
check(/case 'dismissNotif'/.test(appSrc), 'app.js 有 dismissNotif 动作');
check(/function dismissNotif/.test(stateSrc), 'state 有 dismissNotif()');
check(/function isNotifDismissed/.test(stateSrc), 'state 有 isNotifDismissed()');
/* 手势 */
check(/function swipeDelete/.test(appSrc) || /swipeDelete\(\)/.test(appSrc), 'app.js 有左滑手势处理');
check(/pointerdown/.test(appSrc) && /pointermove/.test(appSrc) && /pointerup/.test(appSrc),
  '手势用 pointer 事件（同时覆盖触摸与鼠标）');
/* CSS */
check(/\.swipe\{[^}]*overflow:hidden/.test(cssSrc), '.swipe 裁掉滑出部分');
check(/\.swipe-del\{/.test(cssSrc), '.swipe-del 样式存在');
check(/\.swipe-content\{/.test(cssSrc), '.swipe-content 样式存在');
check(/\.swipe\.open \.swipe-content\{[^}]*translateX\(-76px\)/.test(cssSrc), '展开态位移 -76px');
check(/touch-action:pan-y/.test(cssSrc), '纵向滑动仍归页面滚动');
/* 删掉之后真的不显示了 */
const before = s("notifsOf('all').length");
s("dismissNotif(notifsOf('all')[0].key)");
const after = s("notifsOf('all').length");
check(after === before - 1, `删掉一条后列表少一条（${before} → ${after}）`);

/* =========================================================
   七、「我的」页面头像更换
   ========================================================= */
console.log('\n=== 七、头像更换入口 ===');
const prof = strip(PAGES.profile());
check(/data-act="openAvatarPicker"/.test(prof), '「我的」页头像可点（data-act="openAvatarPicker"）');
check(/me-ava-cam/.test(prof), '头像右下角有相机徽标');
check(/function openAvatarPickerSheet/.test(appSrc), 'app.js 有 openAvatarPickerSheet()');
check(/case 'openAvatarPicker'/.test(appSrc), 'app.js 有 openAvatarPicker 动作');
check(/case 'pickAvatar'/.test(appSrc), 'app.js 有 pickAvatar 动作');
check(/case 'resetAvatar'/.test(appSrc), 'app.js 有 resetAvatar 动作');
check(/function setMyAvatar/.test(stateSrc), 'state 有 setMyAvatar()');
check(/function myAvatar/.test(stateSrc), 'state 有 myAvatar()');
check(/function resetMyAvatar/.test(stateSrc), 'state 有 resetMyAvatar()');
/* 换头像后全局生效 */
s("setMyAvatar('assets/checkin/ck01.jpg')");
check(s("myAvatar()") === 'assets/checkin/ck01.jpg', '换头像写进了 STATE');
const prof2 = strip(PAGES.profile());
check(/assets\/checkin\/ck01\.jpg/.test(prof2), '「我的」页显示新头像');
/* 别的页面（目标详情页的发起人）也是同一张 */
const det2 = strip(PAGES.flagDetail('f_own'));
check(/assets\/checkin\/ck01\.jpg/.test(det2), '别处看到的「我」也是同一张脸');
s("resetMyAvatar()");
check(s("myAvatar()") === null, '可以恢复默认头像');

/* CSS */
check(/\.me-ava-cam\{/.test(cssSrc), '.me-ava-cam 样式存在');
check(/\.ava-pick-grid\{/.test(cssSrc), '.ava-pick-grid 样式存在');
check(/\.ava-pick-act\{/.test(cssSrc), '.ava-pick-act 样式存在');

/* ========================================================= */
console.log(fails === 0 ? '\n✅ 全部通过' : `\n❌ ${fails} 条失败`);
process.exit(fails === 0 ? 0 : 1);
