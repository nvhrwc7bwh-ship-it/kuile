/* ============================================================
   验证：新增的「真实状态」场景（2026-11-24）
   ------------------------------------------------------------
   ⚠️ 用户口径：「为了让整个 demo 更接近真实的软件的使用的感觉，
      左边的主流程、右边的演示状态还需要增加什么内容？
      注意，尽量做增加而不是减少。」

   —— 这一组验的是【新增的那批状态】能不能造出来、能不能正确渲染。
      原有 8 个场景一个都没删 —— 下面也顺带验一下它们还在。
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const fakeEl = () => ({
  style:{}, dataset:{},
  classList:{add(){},remove(){},toggle(){},contains(){return false;}},
  appendChild(){}, removeChild(){}, addEventListener(){}, removeEventListener(){},
  setAttribute(){}, getAttribute(){return null;},
  querySelector:()=>fakeEl(), querySelectorAll:()=>[],
  remove(){}, innerHTML:'', textContent:'', value:'', focus(){}, click(){},
});
const sandbox = {
  console,
  window: fakeEl(),
  document: {
    querySelector:()=>fakeEl(), querySelectorAll:()=>[], getElementById:()=>fakeEl(),
    addEventListener(){}, removeEventListener(){}, createElement:()=>fakeEl(), body: fakeEl(),
  },
  localStorage:{getItem:()=>null,setItem(){}},
  setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame:()=>0,
  location:{href:'http://localhost/',pathname:'/'},
  history:{pushState(){},replaceState(){}},
};
vm.createContext(sandbox);
for (const f of ['info.js','avatars.js','data.js','state.js','pages.js','app.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js',f),'utf8'), sandbox, { filename:f });
}
const PAGES = vm.runInContext('PAGES', sandbox);
const appSrc   = fs.readFileSync(path.join(__dirname, '..', 'js','app.js'),'utf8');
const stateSrc = fs.readFileSync(path.join(__dirname, '..', 'js','state.js'),'utf8');
const pagesSrc = fs.readFileSync(path.join(__dirname, '..', 'js','pages.js'),'utf8');
const cssSrc   = fs.readFileSync(path.join(__dirname, '..', 'css','app.css'),'utf8');
const panelSrc = fs.readFileSync(path.join(__dirname, '..', 'js','devpanel.js'),'utf8');

let fails = 0;
function check(cond, msg){
  if(!cond){ console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}
/** 注入一个场景，返回关键页面的 HTML */
function scene(name) {
  vm.runInContext(`inject('${name}')`, sandbox);
  const get = (expr) => vm.runInContext(expr, sandbox);
  return {
    get,
    flagDetail: () => get("PAGES.flagDetail(myMainFlag().id)"),
    appeal:     () => get("PAGES.appeal()"),
    subs:       () => get("PAGES.subs()"),
    home:       () => get("PAGES.home()"),
    verdict:    () => get("PAGES.verdict()"),
  };
}

/* ─────────────────────────────────────────────
   ① 原有 8 个场景一个都没删
   ───────────────────────────────────────────── */
console.log('=== ① 原有场景都还在 ===');
const INJ = vm.runInContext('Object.keys(INJECTORS)', sandbox);
['reset','newUserWithFlags','subscribe','prep','notifs','supervised','witness','veteran']
  .forEach(k => check(INJ.includes(k), `原有场景「${k}」还在`));
check(INJ.length === 22, `场景总数 22 个（原有 8 + 新增 14），实际 ${INJ.length}`);

/* ─────────────────────────────────────────────
   ② 新增场景：断卡
   ───────────────────────────────────────────── */
console.log('\n=== ② 断卡 ===');
let s = scene('broken');
check(s.get("myMainFlag().status") === 'broken', '状态是 broken');
check(s.get("myMainFlag().streak") === 0, '连续天数归零');
check(s.get("myMainFlag().creditDelta") === -5, '信用分 -5');
let h = s.flagDetail();
/* ⚠️ 2026-11-24 用户口径：断卡提醒挪到首页了，详情页不再有断卡横幅 */
check(!/这一局断了/.test(h), '详情页不再有断卡横幅（提醒挪到首页了）');
check(!/st-banner rose/.test(h), '详情页没有断卡用的红色横幅');

/* ─────────────────────────────────────────────
   ③ 新增场景：已结算（押金退回）
   ───────────────────────────────────────────── */
console.log('\n=== ③ 已结算 ===');
s = scene('settled');
check(s.get("myMainFlag().status") === 'success', '状态是 success');
check(s.get("myMainFlag().refunded") > 0, '押金已记退回金额');
h = s.flagDetail();
check(/这一局挣回来了/.test(h), '详情页有结算横幅');
check(/全额退回/.test(h), '横幅说明押金已退');

/* ─────────────────────────────────────────────
   ④ 新增场景：押金被扣 + 申诉审核中
   ───────────────────────────────────────────── */
console.log('\n=== ④ 押金被扣 · 申诉中 ===');
s = scene('appealed');
check(s.get("!!myMainFlag().appeal"), 'Flag 上有申诉记录');
check(s.get("myMainFlag().appeal.status") === 'reviewing', '申诉状态是审核中');
h = s.flagDetail();
check(/st-banner/.test(h), '详情页有状态横幅');
check(/审核中/.test(h), '横幅显示审核中');
check(/ap-steps/.test(h), '横幅里有 4 步进度条');
check(/ap-step now/.test(h), '当前在「人工复核」那一步');
h = s.appeal();
check(/押金扣收有异议 · 审核中/.test(h), '申诉页列出进行中的申诉');
check(/ap-steps/.test(h), '申诉页有进度条');
check(/我要申诉/.test(h), '申诉页保留原有入口（没删）');

/* ─────────────────────────────────────────────
   ④-2 已结算的失败局：详情页不给申诉入口（⚠️ 2026-11-24 用户口径）
   ───────────────────────────────────────────── */
console.log('\n=== ④-2 已结算的失败局不给申诉入口 ===');
s = scene('newUserWithFlags');
/* 造一局「已结算的失败」：没有 appeal 记录 */
s.get("(() => { const g = myRunningFlag(); g.status='failed'; g.statusText='未达标';"
     + " g.creditDelta=-8; g.lostAmount=Math.round(g.deposit*0.3);"
     + " g.failedReason='未在周期内达到目标体重'; focusMyFlag(g); return 1; })()");
h = s.flagDetail();
check(/这一局没做成/.test(h), '详情页有失败横幅');
check(/押金已扣 ¥\d+/.test(h), '横幅告诉用户扣了多少钱');
check(/信用分 -\d+/.test(h), '横幅显示信用分变化');
/* ⚠️ 关键：横幅里不能有申诉入口 */
const failBanner = (h.match(/<div class="st-banner rose">[\s\S]*?<\/div>\s*<\/div>/) || [''])[0];
check(!/data-go="appeal"/.test(failBanner), '失败横幅里没有「我要申诉」按钮');
check(!/我要申诉/.test(failBanner), '失败横幅里没有「我要申诉」文案');
/* 参照「挣了」的风格：只说结果，不给动作 */
const successHtml = scene('settled').flagDetail();
check(/押金 ¥\d+ 已全额退回/.test(successHtml), '挣了那条说清押金退了');
check(/data-go="recordCard"/.test(successHtml), '挣了那条给「看记录卡」入口（结果可查，不是申诉）');
/* ─────────────────────────────────────────────
   ⑤ 新增场景：异议待投票
   ───────────────────────────────────────────── */
console.log('\n=== ⑤ 异议待投票 ===');
s = scene('objectionPending');
check(s.get("(STATE.objections||[]).length") === 1, '有一条异议记录');
check(s.get("STATE.objections[0].votes") === 2, '票数是 2/3');
check(s.get("STATE.objections[0].myVote") === true, '是我投的');
h = s.subs();
check(!/我提的异议/.test(h), '监督页不再有「我提的异议」区块（已挪到通知页）');
/* ⚠️ 2026-11-24（本轮）：「我提的异议」挪到通知页了 —— 异议本来就是靠通知推送的。 */
h = s.get("PAGES.notifs()");
check(/我提的异议/.test(h), '通知页有「我提的异议」区块');
check(/还差 1 票转人工/.test(h), '显示还差几票');
h = s.get("PAGES.flagDetail('f_3')");
check(/这一局有异议/.test(h), '围观者在详情页也能看到有人在质疑');

/* ─────────────────────────────────────────────
   ⑥ 新增场景：见证判定被驳回
   ───────────────────────────────────────────── */
console.log('\n=== ⑥ 判定被驳回 ===');
s = scene('verdictRejected');
check(s.get("STATE.verdictTasks[0].rejected") === true, '任务标记为被驳回');
check(s.get("!!STATE.verdictTasks[0].rejectReason"), '有驳回原因');
h = s.verdict();
check(/判定被驳回/.test(h), '见证席面板有驳回横幅');
check(/不计分/.test(h), '横幅说明不计分');

/* ─────────────────────────────────────────────
   ⑦ 新增场景：留言待回声
   ───────────────────────────────────────────── */
console.log('\n=== ⑦ 待回声留言 ===');
s = scene('msgsWaiting');
check(s.get("myMainFlag().msgs.length") === 2, '有 2 条留言');
check(s.get("myMainFlag().msgs.every(m=>!m.reply)"), '都还没回');
h = s.home();
check(/条留言等你回一句/.test(h), '首页有「留言等你回一句」区块');
check(/去回/.test(h), '区块给出「去回」入口');

/* ─────────────────────────────────────────────
   ⑧ 其他新场景（只要能造出来、不报错）
   ───────────────────────────────────────────── */
console.log('\n=== ⑧ 其他新场景 ===');
s = scene('inPool');
check(s.get("STATE.inPool === true"), '已在候选池');
check(s.get("interactionCount() >= 10"), '互动次数够门槛');
s = scene('interacted');
check(s.get("interactionCount() === 10"), '互动场景造出 10 次互动');
check(s.get("canApplyToPool() === true"), '互动够了可以申请');
s = scene('supervised');
check(s.get("STATE.fullSupervised >= 1"), '完整监督记录还在（不再代表入池资格）');s = scene('recruiting');
check(s.get("(STATE.recruitApplicants||[]).length") >= 3, '有报名者待处理');
check(s.get("myRunningFlag() ? myRunningFlag().witnesses.length : 0") >= 3, '见证席名单 3 人');
s = scene('following');
check(s.get("STATE.following.length") === 3, '关注了 3 个人');
s = scene('guest');
check(s.get("STATE.loggedIn") === false, '游客态未登录');
check(s.get("STATE.isGuest") === true, '游客态有显式标记');
check(s.get("STATE.myFlags.length") === 0, '游客态没有 Flag');

/* ─────────────────────────────────────────────
   ⑧-2 补卡窗口 / 断卡情况（⚠️ 2026-11-24 用户口径）
   ───────────────────────────────────────────── */
console.log('\n=== ⑧-2 补卡窗口与断卡情况 ===');
s = scene('missedCheckin');
check(s.get("makeupWindow(myMainFlag()).state") === 'open', '昨天漏打卡，12 小时窗口开着');
check(s.get("!!myMainFlag().missedOn"), '记下了漏卡日期');
check(s.get("makeupWindow(myMainFlag()).remainMs > 0"), '窗口还剩时间');
h = s.home();
check(/mk-card/.test(h), '首页有补卡提醒卡');
check(/没打卡/.test(h), '提醒卡说明哪一天没打卡');
check(/data-makeup-btn/.test(h), '提醒卡有补卡按钮');
check(/data-makeup-clock/.test(h), '提醒卡有 12 小时倒计时');
check(/还剩 \d+ 小时/.test(h), '倒计时文案是人话');
/* ⚠️ 补卡卡必须在打卡卡的【下面】 */
check(h.indexOf('今天还没打卡') < h.indexOf('mk-card'), '补卡提醒在打卡卡的下面');
/* 详情页不再有补卡按钮（提醒挪走了） */
h = s.flagDetail();
check(!/data-makeup-btn/.test(h), '详情页没有补卡按钮');
/* ⚠️ 2026-11-24（R2.30 Part 一①）：详情页日历里的
   「已断 N / M，X 月 X 日未打卡，12 小时内可补」**整句删掉** ——
   断卡次数改由日历【折叠头右侧】的「断卡 N/M 次」承担。 */
check(!/class="brk-ratio"/.test(h), '详情页不再有 .brk-ratio 那行');
check(!/已断 <b>/.test(h), '详情页不再显示「已断 N / M」那句');
check(/断卡 \d+\/\d+ 次/.test(h), '折叠头右侧有「断卡 N/M 次」');
/* 超窗 */
s = scene('breakExpired');
check(s.get("makeupWindow(myMainFlag()).state") === 'expired', '超窗后窗口关闭');
h = s.flagDetail();
/* ⚠️ 超窗那一次【仍然算进断卡次数】—— 只是不再用「已断 N/M」那句文字表达 */
const bs = s.get("breakStatusOf(myMainFlag())");
check(bs.used >= 1, `超窗的那一次算进断卡次数（used=${bs.used}）`);
check(/断卡 \d+\/\d+ 次/.test(h), '超窗后折叠头仍显示断卡次数');

/* ─────────────────────────────────────────────
   ⑧-3 已结算的首页（⚠️ 2026-11-24 用户口径）
   ───────────────────────────────────────────── */
console.log('\n=== ⑧-3 已结算的首页 ===');
/* 新用户 */
vm.runInContext("inject('reset')", sandbox);
h = vm.runInContext("PAGES.home()", sandbox);
check(/empty-hero/.test(h), '新用户首页是空态');
check(/立我的第一个 Flag/.test(h), '新用户按钮文案是「立我的第一个 Flag」');
check(!/今天还没打卡/.test(h), '新用户首页没有「今天还没打卡」');
/* 已结算 */
s = scene('settled');
h = s.home();
check(/empty-hero/.test(h), '已结算首页也是空态');
check(/立下我的 FLAG/.test(h), '已结算按钮文案是「立下我的 FLAG」');
check(!/立我的第一个 Flag/.test(h), '已结算不再说「第一个」');
check(!/class="hero"/.test(h), '已结算首页没有主角卡');
check(!/今天还没打卡/.test(h), '已结算首页没有「今天还没打卡」');
check(!/今天已打卡/.test(h), '已结算首页没有「今天已打卡」');
check(!/mk-card/.test(h), '已结算首页没有补卡提醒');
/* 断卡也归空态 */
s = scene('broken');
h = s.home();
check(/empty-hero/.test(h), '断卡首页也是空态');
check(!/class="hero"/.test(h), '断卡首页没有主角卡');
/* 进行中仍有卡 */
s = scene('newUserWithFlags');
h = s.home();
check(/class="hero"/.test(h), '进行中仍有主角卡');
check(/今天还没打卡/.test(h), '进行中有「今天还没打卡」');
/* 旧记录在「我的 → 我的记录」里 */
h = vm.runInContext("PAGES.profile()", sandbox);
check(/我的记录/.test(h), '「我的」页有「我的记录」区块');

/* ─────────────────────────────────────────────
   ⑨ 演示面板：分组 + 全部场景都在
   ───────────────────────────────────────────── */console.log('\n=== ⑨ 演示面板 ===');
check(/GROUPS/.test(panelSrc), '面板按组渲染');
check(/dp-group/.test(cssSrc), 'CSS 有分组标题样式');
check(/overflow-y:auto/.test(cssSrc), '面板正文可滚动（19 个场景放得下）');
/* 面板里的每个场景 key 都必须真的存在 */
const panelKeys = [...panelSrc.matchAll(/\{ k: '([a-zA-Z]+)'/g)].map(m => m[1]);
check(panelKeys.length === 22, `面板列出 22 个场景，实际 ${panelKeys.length}`);
panelKeys.forEach(k => check(INJ.includes(k), `面板的「${k}」在 INJECTORS 里存在`));
/* 关键：面板不能把原有场景搞丢 */
['reset','newUserWithFlags','subscribe','prep','notifs','supervised','witness','veteran']
  .forEach(k => check(panelKeys.includes(k), `面板仍保留原有场景「${k}」`));

/* ─────────────────────────────────────────────
   ⑩ 状态层：异议状态机 + 申诉字段
   ───────────────────────────────────────────── */
console.log('\n=== ⑩ 状态层 ===');
check(/function submitObjection\(/.test(stateSrc), '有 submitObjection()');
check(/function voteObjection\(/.test(stateSrc), '有 voteObjection()');
check(/function myObjections\(/.test(stateSrc), '有 myObjections()');
check(/function objectionsOf\(/.test(stateSrc), '有 objectionsOf()');
check(/function focusMyFlag\(/.test(stateSrc), '有 focusMyFlag()（注入器要把目标局挪到最前）');
check(/function myRunningFlag\(/.test(stateSrc), '有 myRunningFlag()');
/* 异议状态机 */
vm.runInContext("initState()", sandbox);
const sub = vm.runInContext("submitObjection({flagId:'f_3', reason:'读数对不上'})", sandbox);
check(sub.ok === true, '能投异议');
const o1 = vm.runInContext("STATE.objections[0]", sandbox);
check(o1.votes === 1 && o1.status === 'waiting', '投完是 1 票 / 等待中');
const voted = vm.runInContext("voteObjection('" + o1.id + "')", sandbox);
check(voted === false, '同一人不能重复投票');
/* 3 票转人工 */
vm.runInContext("STATE.objections[0].votes = 2; STATE.objections[0].myVote = false;", sandbox);
vm.runInContext("voteObjection('" + o1.id + "')", sandbox);
check(vm.runInContext("STATE.objections[0].status", sandbox) === 'reviewing', '满 3 票转人工复核');
/* 满 3 次不再计入 */
vm.runInContext("initState()", sandbox);
vm.runInContext("submitObjection({flagId:'f_3'}); submitObjection({flagId:'f_3'}); submitObjection({flagId:'f_3'});", sandbox);
const r4 = vm.runInContext("submitObjection({flagId:'f_3'})", sandbox);
check(r4.ok === false, '同一局满 3 次异议后不再计入');

/* ─────────────────────────────────────────────
   ⑪ CSS 有对应的样式
   ───────────────────────────────────────────── */
console.log('\n=== ⑪ CSS ===');
check(/\.st-banner\{/.test(cssSrc), 'CSS 有 .st-banner');
check(/\.st-banner\.amber/.test(cssSrc) && /\.st-banner\.rose/.test(cssSrc) && /\.st-banner\.mint/.test(cssSrc), '横幅有 3 种色调');
check(/\.ap-steps\{/.test(cssSrc), 'CSS 有 .ap-steps');
check(/\.ap-step\.done/.test(cssSrc) && /\.ap-step\.now/.test(cssSrc), '步骤条有完成态和当前态');

console.log(fails === 0 ? '\n✅ 全部通过' : `\n❌ ${fails} 条失败`);
process.exit(fails === 0 ? 0 : 1);
