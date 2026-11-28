/* =========================================================
   R2.26 / R2.27 巡检（2026-11-24 本轮新增）
   ------------------------------------------------------------
   本轮用户口径三部分：
     一、广场目标详情页（他人视角）
        ① 顶部「打卡天数」→「点赞数量」
        ② 删掉断卡下方的「见证席 N 位」「监督席 N 人」两块独立卡
        ③ 顶部「N 位见证席」可点 → 半屏名单，点头像进用户主页
        ④ 断卡并入日历卡片（断卡次数），日历只标断卡当天
        ⑤ 日历点某一天 → 半屏（只有照片 + 留言）
        ⑥ 「进度」→「见证席判定」，形式从简，判定入口可点弹半屏
     二、「我的 Flag」（本人视角）
        ① 不展示目标 / 体重变化数据
        ② 基础信息卡对齐广场（点赞数量 / 人监督 / 位见证席）
        ③ 当天照片 + 留言，空位保留
        ④ 状态数据对齐广场
        ⑤ 他人留言可见
        ⑥ 取消提示小字居中
        ⑦ 三点菜单删掉「取消 Flag」
        ⑧ 删掉底部「今日打卡」「打卡历史」
     三、「确认并支付」金额选项：选中小圈在金额文字下方，整体居中
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
vm.runInContext('INJECTORS.newUserWithFlags()', sandbox);

const appSrc   = fs.readFileSync(path.join(__dirname, '..', 'js','app.js'),'utf8');
const pagesSrc = fs.readFileSync(path.join(__dirname, '..', 'js','pages.js'),'utf8');
const cssSrc   = fs.readFileSync(path.join(__dirname, '..', 'css','app.css'),'utf8');

/* 去注释（代码注释里提到旧文案不算渲染结果） */
const strip = s => String(s).replace(/<!--[\s\S]*?-->/g, '');

let fails = 0;
function check(cond, msg) {
  if (!cond) { console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}

const other = strip(PAGES.flagDetail('f_3'));   /* 他人视角（广场点开） */
const own   = strip(PAGES.flagDetail('f_own')); /* 本人视角 */
const menu  = strip(PAGES.flagMenu('f_own'));   /* 三点菜单 */

/* =========================================================
   一、广场目标详情页（他人视角）
   ========================================================= */
console.log('\n=== 一-① 顶部小卡片：「打卡天数」→「点赞数量」 ===');
check(/点赞数量/.test(other), '顶部指标卡出现「点赞数量」');
check(!/打卡天数/.test(other), '顶部指标卡不再出现「打卡天数」');
check(/人监督/.test(other), '顶部保留「人监督」');
check(/位见证席/.test(other), '顶部保留「位见证席」');

console.log('\n=== 一-② 删除多余席位卡片 ===');
check(!/监督席 \d+ 人/.test(other), '独立的「监督席 N 人」卡片已删除');
check(!/见证席 \d+ 位/.test(other), '独立的「见证席 N 位」卡片已删除');
check(!/断卡情况/.test(other), '独立的「断卡情况」卡片已删除（并入日历）');

console.log('\n=== 一-③ 见证席点击弹半框 ===');
check(/data-act="openWitnessList"/.test(other), '顶部见证席卡可点（openWitnessList）');
check(/metric-tap/.test(other), '见证席卡用了可点的 metric-tap 样式');
check(/function openWitnessListSheet\(/.test(appSrc), 'app.js 有 openWitnessListSheet()');
check(/data-go="userProfile"[^>]*data-from="witness"/.test(appSrc),
  '半屏里点头像 → data-go="userProfile" + data-from="witness"');
check(/pendingSheetBack === 'witness'/.test(appSrc),
  '从半屏跳主页后，返回键回到见证席名单半屏');
check(/function userProfile\(/.test(fs.readFileSync(path.join(__dirname, '..', 'js','data.js'),'utf8')),
  'data.js 有 userProfile()');

console.log('\n=== 一-④ 打卡日历合并断卡信息 + 只标断卡 ===');
check(/cal-brk/.test(other), '日历折叠头带断卡次数（cal-brk）');
check(/cal-lite/.test(other), '日历用「只标断卡」版式（cal-lite）');
check(/cal-d \$\{c\.st\} \$\{c\.st==='miss'\?'brk':''\}/.test(pagesSrc),
  '只有断卡当天带 brk 小圆点标记');
check(/\.cal-lite \.cal-d\.brk\{/.test(cssSrc), 'CSS 定义了断卡当天的小圆点标记');
check(/cal-dot-mark/.test(cssSrc) && /cal-legend i\.cal-dot-mark/.test(cssSrc),
  'CSS 定义了图例里的小圆点');

console.log('\n=== 一-⑤ 日期点击改半屏 ===');
check(/data-act="openDaySheet"/.test(other), '日历格点击 → openDaySheet（半屏）');
check(!/class="cal-d [^"]*" data-go="checkinLogItem"/.test(other), '日历格不再跳整页 checkinLogItem');
check(/function openDaySheet\(/.test(appSrc), 'app.js 有 openDaySheet()');
/* 半屏里只有照片 + 留言 */
const daySheetSrc = appSrc.slice(appSrc.indexOf('function openDaySheet('), appSrc.indexOf('function openWitnessListSheet('));
check(/ev-photo/.test(daySheetSrc), '日期半屏展示当天打卡照片');
check(/ev-note/.test(daySheetSrc), '日期半屏展示当天留言');
check(!/当日体重/.test(daySheetSrc), '日期半屏不展示体重');
check(!/dayVerdictOf/.test(daySheetSrc), '日期半屏不展示见证席审核结果');

console.log('\n=== 一-⑥ 见证席判定 ===');
check(/见证席判定/.test(other), '区块名是「见证席判定」');
check(!/>进度</.test(other), '区块名不再是「进度」');
check(/data-act="openVerdictSummary"/.test(other), '节点名可点（openVerdictSummary）');
check(!/已验证/.test(other), '页面不展示「已验证 · 68.4kg」这类具体数值');
check(!/已验证/.test(other) && !/见证席判定通过/.test(other), '页面不展示判定结果文案');
check(/tl-dot/.test(other) && /tl done/.test(other), '保留节点圆圈的颜色区分（深=已判定）');
/* 浅色态 = 未判定节点（skip / now / future）—— 源码层断言 */
check(/st==='skip'\?'skip'/.test(pagesSrc), '未判定节点保留浅色态（skip 类名）');
check(/这一局没走到这里/.test(pagesSrc), 'skip 节点说明「这一局没走到这里」');
check(/\.tl\.skip \.tl-dot\{/.test(cssSrc), 'CSS 定义了 skip 节点的浅色样式');
check(/\.tl\.done \.tl-dot\{/.test(cssSrc) && /\.tl\.skip \.tl-dot\{/.test(cssSrc),
  '已判定=深色 / 未判定=浅色，两种圆圈样式都在');
check(/function openVerdictSummarySheet\(/.test(appSrc), 'app.js 有 openVerdictSummarySheet()');
const vsSrc = appSrc.slice(appSrc.indexOf('function openVerdictSummarySheet('), appSrc.indexOf('function openDaySheet('));
check(/应判人数/.test(vsSrc) && /实判人数/.test(vsSrc), '半屏展示「应判人数」「实判人数」');
check(/通过/.test(vsSrc) && /存疑/.test(vsSrc) && /作弊/.test(vsSrc), '半屏展示通过 / 存疑 / 作弊三项');
check(/判定时间/.test(vsSrc), '半屏展示判定时间');
check(!/w\.name/.test(vsSrc) && !/判决人|判定人/.test(vsSrc), '半屏不展示是谁判定的');
check(/function verdictSummaryOf\(/.test(fs.readFileSync(path.join(__dirname, '..', 'js','state.js'),'utf8')),
  'state.js 有 verdictSummaryOf()');

/* =========================================================
   二、「我的 Flag」（本人视角）
   ========================================================= */
console.log('\n=== 二-① 目标数据不展示 ===');
check(!/lead-range/.test(own), '本人视角不展示「起始 → 目标」体重');
check(/lead-range/.test(other), '他人视角仍然展示「起始 → 目标」体重');
check(!/72\.5/.test(own) && !/68\.0/.test(own), '本人视角不出现目标体重数值');

console.log('\n=== 二-② 基础信息卡对齐广场 ===');
check(/点赞数量/.test(own), '本人视角有「点赞数量」');
check(/人监督/.test(own), '本人视角有「人监督」');
check(/位见证席/.test(own), '本人视角有「位见证席」');
check(!/打卡天数/.test(own), '本人视角无「打卡天数」');

console.log('\n=== 二-③ 当日动态展示 ===');
check(/我今天的照片/.test(own), '本人视角展示「我今天的照片」');
check(/tr-empty/.test(own), '本人视角没发布时保留空位');
/* 留言位：f_own 有留言，f_new_1（新建的局）没留言 */
const ownNew = strip(PAGES.flagDetail(vm.runInContext("STATE.myFlags.find(f=>f.status==='running').id", sandbox)));
check(/今天还没有留言/.test(ownNew), '本人视角没留言时保留留言位（空态提示）');
check(/Ta 今天的照片/.test(other), '他人视角仍是「Ta 今天的照片」');

console.log('\n=== 二-④ 状态数据对齐广场 ===');
check(/cal-brk/.test(own), '本人视角断卡并入日历');
check(/cal-lite/.test(own), '本人视角日历只标断卡');
check(/见证席判定/.test(own), '本人视角区名也是「见证席判定」');
check(/data-act="openVerdictSummary"/.test(own), '本人视角判定入口也可点');

console.log('\n=== 二-⑤ 留言可见 ===');
check(/msg-ticker|msg-entry/.test(own), '本人视角能看到留言预览');
check(/data-act="openMsgSheet"/.test(own), '本人视角能点开留言半屏');

console.log('\n=== 二-⑥ 取消提示小字居中 ===');
check(/取消这个 Flag 需按未达标结算，押金不退还/.test(own), '小字文案已更新');
check(/\.fd-cancel\{[^}]*text-align:center/.test(cssSrc), 'CSS：.fd-cancel 整体居中');
check(/\.fd-cancel-hint\{[^}]*text-align:center/.test(cssSrc), 'CSS：.fd-cancel-hint 小字居中');
check(/\.fd-cancel-hint\{[^}]*display:block/.test(cssSrc), 'CSS：小字是独立块（换行到按钮下面）');

console.log('\n=== 二-⑦ 三点菜单删掉「取消 Flag」 ===');
check(!/doCancelFlag/.test(menu), '三点菜单不再有取消按钮');
check(!/取消这个 Flag/.test(menu), '三点菜单不再有「取消这个 Flag」文案');
check(!/fm-cancel/.test(menu), '三点菜单不再有 .fm-cancel 取消块');
check(/打卡历史/.test(menu) && /立据/.test(menu) && /分享/.test(menu), '三点菜单其他三项保留');

console.log('\n=== 二-⑧ 取消底部两个按钮 ===');
check(!/今日打卡/.test(own), '本人视角底部无「今日打卡」');
check(!/>打卡历史</.test(own), '本人视角底部无「打卡历史」');
check(!/sticky-cta/.test(own), '本人视角（进行中）整块不渲染底部 CTA');
/* 已结算的局仍保留「看记录卡 / 分享这一局」 */
const ownSettled = strip(PAGES.flagDetail('f_success'));
check(/看记录卡/.test(ownSettled), '已结算的局保留「看记录卡」');

/* =========================================================
   三、「确认并支付」金额选项
   ========================================================= */
console.log('\n=== 三-① 选中圈位置 ===');
const depHtml = vm.runInContext('depGrid(depositRange(STATE.credit, 30, false), 500)', sandbox);
const pick = depHtml.match(/<div class="dep-pick[\s\S]*?<\/div>\s*<\/div>/);
check(!!pick, 'depGrid 渲染出 .dep-pick 卡片');
check(/dep-v/.test(depHtml) && /dep-radio/.test(depHtml), '卡片里有金额和选中圈');
/* DOM 顺序：金额在前，小圈在后 */
const firstCard = depHtml.slice(depHtml.indexOf('dep-pick'), depHtml.indexOf('dep-pick') + 400);
check(firstCard.indexOf('dep-v') < firstCard.indexOf('dep-radio'), 'DOM 顺序：金额在上，选中圈在下');
check(/\.dep-pick\{[^}]*flex-direction:column/.test(cssSrc), 'CSS：.dep-pick 竖排');
check(/\.dep-pick\{[^}]*align-items:center/.test(cssSrc), 'CSS：.dep-pick 水平居中');
check(/\.dep-pick\{[^}]*justify-content:center/.test(cssSrc), 'CSS：.dep-pick 垂直居中');
check(/\.dep-pick \.dep-v\{[^}]*text-align:center/.test(cssSrc), 'CSS：金额文字居中');

console.log(fails === 0 ? '\n✅ 全部通过' : `\n❌ ${fails} 项失败`);
process.exit(fails === 0 ? 0 : 1);
