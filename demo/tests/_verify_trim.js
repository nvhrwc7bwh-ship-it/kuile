/* 12 项精简 + 新增功能巡检（2026-11-21 用户口径）
   —— 断言：删减项确实删干净、新增项确实能用 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const fakeEl = () => ({
  style: {}, dataset: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
  appendChild(){}, removeChild(){}, addEventListener(){}, removeEventListener(){},
  setAttribute(){}, getAttribute(){ return null; }, querySelector: () => fakeEl(),
  querySelectorAll: () => [], remove(){}, innerHTML: '', textContent: '',
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
const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js','app.js'),'utf8');
const pagesSrc = fs.readFileSync(path.join(__dirname, '..', 'js','pages.js'),'utf8');
const dataSrc = fs.readFileSync(path.join(__dirname, '..', 'js','data.js'),'utf8');
const stateSrc = fs.readFileSync(path.join(__dirname, '..', 'js','state.js'),'utf8');
const cssSrc = fs.readFileSync(path.join(__dirname, '..', 'css','app.css'),'utf8');

vm.runInContext('initState()', sandbox);
vm.runInContext("INJECTORS.newUserWithFlags()", sandbox);
vm.runInContext("INJECTORS.subscribe()", sandbox);

let fails = 0;
function check(cond, msg){
  if(!cond){ console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}

/* ─────────────────────────────────────────────
   1–3. 筛选 —— 半屏抽屉，不再是独立页面
   ⚠️ 用户口径（2026-11-22）：「不单独一个页面了，弄成半屏，从页面底部往上那种。」
   ───────────────────────────────────────────── */
console.log('=== 1-3. 筛选半屏抽屉 ===');
const filterHtml = vm.runInContext('filterPanel()', sandbox);
check(!/排序/.test(filterHtml), '① 筛选没有「排序」区块');
check(!/Game Status 独立成维度/.test(filterHtml), '② 没有「Game Status 独立成维度」');
check(!/>只看</.test(filterHtml), '③ 没有「只看」整块');
check(!/我认识的人/.test(filterHtml), '③ 没有「我认识的人」');
check(!/有见证背书的/.test(filterHtml), '③ 没有「有见证背书的」');
// 保留的三个维度还在
check(/状态/.test(filterHtml), '保留「状态」维度');
check(/周期/.test(filterHtml), '保留「周期」维度');
check(/见证席强度/.test(filterHtml), '保留「见证席强度」维度');
// 筛选不再是独立页面
check(typeof PAGES.filter === 'undefined', '筛选不再是独立页面（PAGES.filter 已移除）');
check(!/filter:\{t:'筛选'/.test(appSrc), 'app.js 不再有 filter 路由');
check(/data-act="openFilter"/.test(PAGES.square()), '广场筛选按钮走 openFilter 动作');
check(/case 'openFilter'/.test(appSrc), 'app.js 有 openFilter 动作');
check(/openSheet\('筛选', filterPanel\(\)\)/.test(appSrc), 'openFilter 打开底部半屏抽屉');
check(/\.filter-panel\{/.test(cssSrc), 'CSS 定义 .filter-panel');
check(/\.sheet\{[\s\S]*?bottom:0/.test(cssSrc), '半屏浮层从底部升起（bottom:0）');

/* ─────────────────────────────────────────────
   4. 广场冷启动介绍弹窗
   ───────────────────────────────────────────── */
console.log('\n=== 4. 广场页冷启动介绍 ===');
const squareHtml = PAGES.square();
check(!/围观他人的 Flag，给他们压力/.test(squareHtml), '广场页没有冷启动介绍条');
check(!/info\('coldStart'/.test(squareHtml), '广场页不引用 coldStart 弹层');

/* ─────────────────────────────────────────────
   5–7. 订阅页文案
   ───────────────────────────────────────────── */
console.log('\n=== 5-7. 订阅页文案精简 ===');
const subsHtml = PAGES.subs();
check(!/推送规则/.test(subsHtml), '⑤ 订阅页没有「推送规则」文案');
check(!/data-info="subscribe"/.test(subsHtml), '⑤ 订阅页导航栏没有推送规则帮助按钮');
check(!/只看你订阅的人，结局第一时间知道/.test(subsHtml), '⑥ 没有「只看你订阅的人，结局第一时间知道」');
check(!/通知只推关键节点/.test(subsHtml), '⑦ 没有「通知只推关键节点 —— ……整句」');
check(!/日常体重变化不推送/.test(subsHtml), '⑦ 没有「日常体重变化不推送」重复说明');
/* ⚠️ 2026-11-24 用户口径：「断卡、判负、结算正常提醒，没什么开关。
   每日打卡不提醒。」—— 所以【通知开关整块删掉】，改成纯说明。 */
check(!/class="switch/.test(subsHtml), '订阅页不再有通知开关');
/* ⚠️ 2026-11-24（本轮）：通知承诺说明从「监督」页挪到了「我的」页的法律与安全区 ——
   理由：它是【全局产品承诺】说明，不是「我监督的局」这一页该承载的东西；
   而且原来那四行画成了可以拨动但点不动的假开关。 */
check(!/断卡提醒/.test(subsHtml), '监督页不再有「断卡提醒」说明（已挪到「我的」页）');
check(!/结算提醒/.test(subsHtml), '监督页不再有「结算提醒」说明（已挪到「我的」页）');
check(!/每日打卡提醒/.test(subsHtml), '监督页不再有「每日打卡提醒」说明（已挪到「我的」页）');

/* ─────────────────────────────────────────────
   8. 我的页三块统计磁贴：进行中 / 已达成 / 没做成
   ⚠️ 用户口径演进：
     · 2026-11-22：「进行中、已达成、没做成，在我的页面，还是按原来的加回去。」
     · 2026-11-24：先改成【不可点的纯展示】
     · 2026-11-24（最新）：「这个页面里的进行中、已达成、没做成不显示。」
       —— 【三块磁贴整块删掉】。理由：资料卡底下已经有【四格社交数据】
          （点赞 / 留言 / 关注 / 见证）占了「概览」这个位置，
          再放一组状态数字 = 同一屏两组互不相干的计数器，互相削弱；
          而且状态在下面的「我的记录」列表里按状态列着，磁贴是重复。
   ⚠️ 只删「我的」页这一块 —— 用户主页（Ta 的主页）的三块磁贴保留。
   ───────────────────────────────────────────── */
console.log('\n=== 8. 我的页统计磁贴（已整块删除） ===');
const profileHtml = PAGES.profile();
check(!/class="tile"/.test(profileHtml), '我的页没有磁贴（.tile）');
check(!/class="tiles/.test(profileHtml), '我的页没有磁贴块（.tiles）');
check(!/class="t-l">进行中/.test(profileHtml), '我的页没有「进行中」磁贴');
check(!/class="t-l">已达成/.test(profileHtml), '我的页没有「已达成」磁贴');
check(!/class="t-l">没做成/.test(profileHtml), '我的页没有「没做成」磁贴');
/* ⚠️ 2026-11-24 用户口径（最新）：磁贴整块删除，明细在下面的「我的记录」列表里 */
check(/我的记录/.test(profileHtml), '明细仍在「我的记录」列表里');
check(!/data-go="myFlags"[^>]*class="tile/.test(profileHtml), '没有磁贴跳「我的 Flag」列表');

/* ─────────────────────────────────────────────
   9. 他人主页（长期档案）
   ───────────────────────────────────────────── */
console.log('\n=== 9. 他人主页（长期档案）===');
const detailOther = PAGES.flagDetail('f_3');
const detailMine  = PAGES.flagDetail('f_own');
check(/function userProfile\(/.test(dataSrc), 'data.js 有 userProfile()');
check(/PAGES\.userProfile = /.test(pagesSrc), 'pages.js 有 userProfile 页面');
check(/userProfile:\{t:'用户主页'/.test(appSrc), 'app.js 注册了 userProfile 路由');
check(/nav-id tap" data-go="userProfile"/.test(detailOther), '围观者版目标详情的导航身份条可点进「Ta 的主页」');
check(!/的主页<\/div>/.test(detailOther), '围观者版目标详情不再有下方「Ta 的主页」按钮');
check(!/data-go="userProfile"/.test(detailMine), '本人版目标详情没有这个入口');
const upHtml = PAGES.userProfile('小美');
check(/信用分/.test(upHtml), '用户主页有信用分');
check(/见证情况/.test(upHtml), '用户主页有见证情况');
check(/Ta 的 Flag/.test(upHtml), '用户主页有 Ta 的 Flag 列表');
check(/判定成立率/.test(upHtml), '用户主页有判定成立率');
check(/当过见证席/.test(upHtml), '用户主页有「当过见证席」');
// 找不到的人有空态
check(/找不到这个人/.test(PAGES.userProfile('不存在的人')), '用户主页有「找不到这个人」空态');

/* ─────────────────────────────────────────────
   10. 判定三选一小框
   ───────────────────────────────────────────── */
console.log('\n=== 10. 判定三选一小框 ===');
const vdHtml = PAGES.verdictDetail();
check(/data-act="openVerdictPicker"/.test(vdHtml), '判定详情页「去判定」触发 openVerdictPicker');
check(!/data-go="verdict"[^>]*>去判定/.test(vdHtml), '「去判定」不再直接跳面板');
check(/function openVerdictPicker\(/.test(appSrc), 'app.js 有 openVerdictPicker()');
check(/const VERDICT_OPTS = \[/.test(appSrc), 'app.js 定义 VERDICT_OPTS');
check(/物证合规、进度真实/.test(appSrc), '选项①：通过 —— 物证合规、进度真实');
check(/我看不懂 \/ 不确定 —— 直接转人工复核/.test(appSrc), '选项②：存疑 —— 我看不懂 / 不确定 —— 直接转人工复核');
check(/我确认他在糊弄 —— 这就是一次实名举报，直接转人工复核/.test(appSrc), '选项③：作弊 —— 我确认他在糊弄 —— 这就是一次实名举报，直接转人工复核');
check(/data-vpick="ok"/.test(appSrc), '小框有「提交判定」按钮');
check(/\.dialog\.dlg-pick\{/.test(cssSrc), 'CSS 定义 .dlg-pick（三选一小框）');
/* ⚠️ 2026-11-23 用户口径（改）：「见证席面板，删除你的判定……除了点击到需要判定的节点，三选一以外」
   —— 三选一不再常驻在面板上，而是点【需要判定的那个节点】时弹出来。 */
vm.runInContext("INJECTORS.witness()", sandbox);
const verdictHtml = PAGES.verdict();
check(!/data-verdict="pass"/.test(verdictHtml), '见证席面板不再常驻「通过」选项');
check(!/data-verdict="doubt"/.test(verdictHtml), '见证席面板不再常驻「存疑」选项');
check(!/data-verdict="cheat"/.test(verdictHtml), '见证席面板不再常驻「作弊」选项');
check(/data-act="openVerdictPicker"/.test(verdictHtml), '见证席面板在需要判定的节点上提供「去判定」入口');
/* ⚠️ 2026-11-23 用户口径：「我这一票.第2/3个节点，这个按钮取消掉，直接不要了。」
   —— 节点条上的「我这一票 · 第 N / M 个节点」徽章整条删掉。
      「我走到第几步」改由节点条自身的视觉表达承担：
      已判的步骤打勾 + 「已判」角标，待判的那一步高亮（.wf-step.now）。 */
check(!/我这一票/.test(verdictHtml), '见证席面板不再有「我这一票 · 第 N / M 个节点」徽章');
check(!/第 \d+ \/ \d+ 个节点/.test(verdictHtml), '见证席面板不再显示「第 N / M 个节点」');
/* 已判的步骤仍然要能看出判过了 */
check(/wf-step-flag done">已判/.test(verdictHtml), '已判过的节点仍有「已判」角标');
check(/wf-step now/.test(verdictHtml), '待判的那一步在节点条上高亮');

/* ─────────────────────────────────────────────
   11. 打卡心情 / 体悟
   ───────────────────────────────────────────── */
console.log('\n=== 11. 打卡心情 / 体悟 ===');
const checkinHtml = PAGES.checkin('f_own');
check(/id="checkinNote"/.test(checkinHtml), '今日打卡页有心情输入框');
check(/maxlength="15"/.test(checkinHtml), '输入框有 maxlength 限制（渲染后为 15）');
check(/maxlength="\$\{CHECKIN_NOTE_MAX\}"/.test(pagesSrc), 'pages.js 用 CHECKIN_NOTE_MAX 变量控制上限');
check(/今天的心情 \/ 体悟/.test(checkinHtml), '有「今天的心情 / 体悟」标题');
check(/id="noteCount"/.test(checkinHtml), '有字数计数');
check(/const CHECKIN_NOTE_MAX = 15/.test(stateSrc), '上限是 15 字');
check(/function setCheckinNote\(/.test(stateSrc), 'state.js 有 setCheckinNote()');
check(/function commitCheckinNote\(/.test(stateSrc), 'state.js 有 commitCheckinNote()');
check(/function noteOf\(/.test(stateSrc), 'state.js 有 noteOf()');
check(/commitCheckinNote\(f\.id, f\.checkedDays\)/.test(appSrc), '提交打卡时把心情落库');
// 落库 + 围观者可见
vm.runInContext("setCheckinNote('今天没吃夜宵')", sandbox);
const committed = vm.runInContext("commitCheckinNote('f_own', 68)", sandbox);
check(committed === '今天没吃夜宵', '心情能落到当天那格');
check(vm.runInContext("noteOf(FLAGS.f_own, 68)", sandbox) === '今天没吃夜宵', 'noteOf() 能读回');
const itemHtml = PAGES.checkinLogItem('f_own', 68);
check(/class="ev-note"/.test(itemHtml), '打卡详情页有心情展示块');
check(/今天没吃夜宵/.test(itemHtml), '打卡详情页能看到当天的留言');
check(/\.ev-note\{/.test(cssSrc), 'CSS 定义 .ev-note');

/* ─────────────────────────────────────────────
   12. 我的-功能里删掉订阅按钮
   ───────────────────────────────────────────── */
console.log('\n=== 12. 我的-功能精简 ===');
const funcPart = profileHtml.slice(profileHtml.indexOf('功能'));
/* ⚠️ 2026-11-24（本轮）：「我监督的局」从【底部 Tab「监督」】挪进了「我的」页功能区 ——
   底部那个位置让给了「通知」。 */
check(/data-go="subs"/.test(funcPart), '「功能」区有「我监督的局」入口');
check(/data-go="verdict"/.test(funcPart), '保留「见证席面板」');
/* ⚠️ 2026-11-24（本轮）：「见证席候选池」这一行删掉了 ——
   用户口径：「我的里面的见证席候选池还有必要单独设吗？
     因为筹备期可以在首页里面进入，感觉没太必要。」
   —— 候选池是【发起人】在筹备期挑人的工具，入口在首页筹备期。 */
check(!/data-go="witnessPool"/.test(funcPart), '「我的」页已删掉「见证席候选池」这一行');
/* ⚠️ 2026-11-23 用户口径：「我的页面，『申请成为见证席』整个删掉了，
     用户第一次通过点击『见证席面板』就能申请了，这里不需要单独弄一个页面。」 */
check(!/data-go="witnessApply"/.test(funcPart), '「功能」区已删掉「申请成为见证席」入口');
check(/data-go="verdict"/.test(funcPart), '申请入口改由「见证席面板」承担');
/* 申请按钮在【见证席面板的空态】里（还没成为见证席时） */
const verdictEmptyHtml = (() => {
  vm.runInContext('STATE.verdictTasks = []', sandbox);
  return PAGES.verdict();
})();
check(/data-act="applyWitness"/.test(verdictEmptyHtml), '见证席面板空态里有「申请成为见证席」按钮');

/* ─────────────────────────────────────────────
   13. 关注（follow）—— R2.14
   ───────────────────────────────────────────── */
console.log('\n=== 13. 关注（follow）===');
check(/following: \[\]/.test(stateSrc), 'STATE 有 following（我关注的人）');
check(/function followUser\(/.test(stateSrc), 'state.js 有 followUser()');
check(/function unfollowUser\(/.test(stateSrc), 'state.js 有 unfollowUser()');
check(/function isFollowing\(/.test(stateSrc), 'state.js 有 isFollowing()');
check(/function myFollowingFlags\(/.test(stateSrc), 'state.js 有 myFollowingFlags()');
check(/case 'doFollow'/.test(appSrc), 'app.js 有 doFollow 动作');
check(/following:\{t:'我关注的人'/.test(appSrc), 'app.js 注册了 following 路由');
check(/PAGES\.following = /.test(pagesSrc), 'pages.js 有 following 页面');
check(/data-act="doFollow"/.test(PAGES.userProfile('小美')), '用户主页有「关注」按钮');
check(/data-go="following"/.test(profileHtml), '我的页有「我关注的人」入口');
// 关注 → 状态 → 广场角标 + 首页关注流
vm.runInContext("followUser('小美')", sandbox);
check(vm.runInContext("isFollowing('小美')", sandbox) === true, '关注后 isFollowing 为真');
check(vm.runInContext("STATE.following.length", sandbox) === 1, 'following 里有 1 个人');
check(vm.runInContext("followUser('小美')", sandbox) === false, '重复关注返回 false');
check(vm.runInContext("followUser('老王')", sandbox) === false, '不能关注自己');
check(vm.runInContext("myFollowingFlags().length", sandbox) >= 1, '关注的人的局进入关注流');
check(/feed-followed/.test(pagesSrc), 'pages.js 有「已关注」角标');
check(/\.feed-followed\{/.test(cssSrc), 'CSS 定义 .feed-followed');
check(/已关注/.test(PAGES.square()), '广场卡片出现「已关注」角标');
/* ⚠️ 2026-11-23 用户口径：首页的「我关心的 Flag」（订阅 + 关注）整块改成
   「我见证的 Flag」—— 只放我正在见证的局，订阅/关注不再进首页。 */
const homeHtml2 = PAGES.home();
check(/我见证的 Flag/.test(homeHtml2), '首页有「我见证的 Flag」区块');
check(!/我关心的 Flag/.test(homeHtml2), '首页不再出现「我关心的 Flag」');
check(!/你关注的人/.test(homeHtml2), '首页不再把关注的人混进列表');
check(/myWitnessingFlags/.test(stateSrc), 'state.js 有 myWitnessingFlags()');
check(/function isWitnessing\(/.test(stateSrc), 'state.js 有 isWitnessing()');
// 取消关注 → 角标消失
vm.runInContext("unfollowUser('小美')", sandbox);
check(vm.runInContext("isFollowing('小美')", sandbox) === false, '取消关注后 isFollowing 为假');
check(!/已关注/.test(PAGES.square()), '取消关注后广场角标消失');

console.log(fails === 0 ? '\n✅ 全部通过' : `\n❌ ${fails} 条失败`);
process.exit(fails === 0 ? 0 : 1);
