/* 立 Flag 分步引导巡检（临时）—— 断言 4 步流程的关键不变式
   用 vm 沙箱直接跑真代码，取出真实常量而不是正则解析 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const fakeEl = () => ({
  style: {}, dataset: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
  appendChild(){}, removeChild(){}, addEventListener(){}, removeEventListener(){},
  setAttribute(){}, getAttribute(){ return null; }, querySelector: () => fakeEl(),
  querySelectorAll: () => [], remove(){}, innerHTML: '', textContent: '', value: '',
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
vm.runInContext('initState()', sandbox);

const ROUTES = vm.runInContext('ROUTES', sandbox);
const PAGES  = vm.runInContext('PAGES', sandbox);
const INFO   = vm.runInContext('INFO', sandbox);
const STATE  = vm.runInContext('STATE', sandbox);
const depositRange = vm.runInContext('depositRange', sandbox);
const DEP_TIERS = vm.runInContext('DEP_TIERS', sandbox);

let fails = 0;
function assert(cond, msg){
  if(!cond){ console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}

const appSrc   = fs.readFileSync(path.join(__dirname, '..', 'js','app.js'),'utf8');
const pagesSrc = fs.readFileSync(path.join(__dirname, '..', 'js','pages.js'),'utf8');
const stateSrc = fs.readFileSync(path.join(__dirname, '..', 'js','state.js'),'utf8');
const infoSrc  = fs.readFileSync(path.join(__dirname, '..', 'js','info.js'),'utf8');
const dataSrc  = fs.readFileSync(path.join(__dirname, '..', 'js','data.js'),'utf8');
const cssSrc   = fs.readFileSync(path.join(__dirname, '..', 'css','app.css'),'utf8');

console.log('=== 1. 三条新路由存在且都有页面实现 ===');
/* ⚠️ 2026-11-24（本轮）：从 4 步变 3 步 ——
   「押多少」和「交押金」合并成「确认并支付」（用户口径：
   「押多少、交押金两个页面内容重复了，我建议合并算了，
     把第四步取消，第三部直接『确认支付』。」） */
for (const k of ['createGoal','createPeriod','createDeposit']) {
  assert(!!ROUTES[k], `路由表有 ${k}`);
  assert(!!PAGES[k],  `页面有 PAGES.${k}`);
}
assert(!ROUTES.createPay, '路由表已删 createPay（第 4 步已合并进第 3 步）');
assert(!PAGES.createPay, '页面已删 PAGES.createPay');

console.log('\n=== 2. 三条新路由都需要登录 ===');
const nlp = (appSrc.match(/const NEED_LOGIN_PAGES = \[([\s\S]*?)\];/) || ['',''])[1];
for (const k of ['createGoal','createPeriod','createDeposit']) {
  assert(nlp.includes(`'${k}'`), `${k} 在 NEED_LOGIN_PAGES 里`);
}
assert(!nlp.includes("'createPay'"), 'createPay 已从 NEED_LOGIN_PAGES 移除');

console.log('\n=== 3. 草稿状态存在且字段齐全 ===');
assert(/createDraft\s*:/.test(stateSrc), 'state.js 定义了 createDraft');
/* ⚠️ 2026-11-23 用户口径（改）：押金协议那行勾选删了 → agreedDeposit 字段一并删除 */
for (const f of ['title','start','target','agreedPay']) {
  assert(STATE.createDraft && f in STATE.createDraft, `createDraft 字段 ${f}`);
}
assert(!('agreedDeposit' in STATE.createDraft), 'createDraft 已删 agreedDeposit（押金协议勾选删了）');
assert(typeof vm.runInContext('resetCreateDraft', sandbox) === 'function', '存在 resetCreateDraft()');

console.log('\n=== 4. 统一提交入口 submitFlag 存在，分步走它 ===');
assert(/function submitFlag/.test(appSrc), 'app.js 定义了 submitFlag');
assert(/submitFlag\(/.test(appSrc), 'submitFlag 被调用');
/* ⚠️ 2026-11-24 用户口径：单页快速填写整块删除 —— 立 Flag 只有 4 步分步引导这一条路 */
assert(!/case 'doCreate'/.test(appSrc), '单页 doCreate 已删（只有分步一条路）');
assert(/case 'submitCreateStep'/.test(appSrc) || /case 'confirmPayAndSubmit'/.test(appSrc), '分步提交动作');
assert(/case 'confirmPayAndSubmit'/.test(appSrc), '第 3 步点「确认支付」→ confirmPayAndSubmit（弹二次确认）');
assert(/case 'nextCreateGoal'/.test(appSrc), '第 1 步 → 第 2 步');
assert(/case 'nextCreatePeriod'/.test(appSrc), '第 2 步 → 第 3 步');
/* ⚠️ 2026-11-24（本轮）：第 3 步 → 第 4 步这个动作删掉了 */
assert(!/case 'nextCreateDeposit'/.test(appSrc), '第 3 步 → 第 4 步的动作已删（合并成一步）');
assert(/witnesses: \[\]/.test(appSrc), '分步提交允许 0 见证人');

console.log('\n=== 5. 勾选框只有 1 个，在第 3 步 ===');
const checks = [...pagesSrc.matchAll(/data-check="([a-zA-Z]+)"/g)].map(m => m[1]);
/* ⚠️ 2026-11-24（本轮）：打钩框从原第 4 步「交押金」挪到第 3 步「确认并支付」 */
assert(checks.includes('createDeposit'), '存在 data-check="createDeposit"');
assert(!checks.includes('createPay'), '已删 data-check="createPay"');
assert(!checks.includes('createGoal'), '第 1 步没有勾选框（这一页只聚焦）');
assert(!checks.includes('createPeriod'), '第 2 步没有勾选框（周期选择不需要确认）');
assert(checks.filter(c => c === 'createDeposit').length === 1, 'createDeposit 勾选框只有 1 个');

console.log('\n=== 6. 第 3 步（确认并支付）：账目并进损失卡 + 支付方式 + 打钩 + 二次确认 ===');
const payHtml = PAGES.createDeposit();
/* 警示卡整块删除 —— 24 小时找见证人移到二次确认弹窗 */
assert(!/pay-warn/.test(payHtml), 'createDeposit 已删警示卡（.pay-warn）');
assert(!/\.pay-warn/.test(cssSrc), 'app.css 已删 .pay-warn 样式');
assert(!/wiz-foot/.test(cssSrc), 'app.css 已删 .wiz-foot 样式');
assert(!/勾选后才能支付/.test(payHtml), 'createDeposit 已删「勾选后才能支付」脚注');
/* ⚠️ 用户口径：「放到实际你会损失这个卡片里，原来的内容不要了，
     不用解释为什么可以压的金额区间了」 */
assert(!/押金区间明细/.test(payHtml), 'createDeposit 已删「押金区间明细」折叠块');
/* ⚠️ 2026-11-24（本轮）：「目标周期、押金、挣了 / 亏了」这一整块**删掉**了 ——
   用户口径：「删除页面内『目标周期、押金、挣了 / 亏了』这一整块信息，不再展示。」
   —— 顶部 lead 已经说了「完成目标押金 100% 退还」，
      档位区已经显示了押金数额，这里再列一遍是第三次重复。 */
assert(!/bar-row/.test(payHtml), 'createDeposit 已删「目标/周期/押金/挣了/亏了」账目汇总块');
assert(!/挣了（达标）/.test(payHtml), 'createDeposit 已删「挣了」行');
assert(!/亏了（失败）/.test(payHtml), 'createDeposit 已删「亏了」行');
/* 支付方式从第 4 步搬过来了 */
assert(/微信支付/.test(payHtml), 'createDeposit 有支付方式');
/* 二次确认弹窗的三句关键信息 */
assert(/公开生效/.test(appSrc), 'app.js 二次确认弹窗提到「公开生效」');
assert(/24 小时/.test(appSrc), 'app.js 二次确认弹窗提到 24 小时');
assert(/不会影响你的目标能不能达成/.test(appSrc), 'app.js 二次确认弹窗说明见证人不影响目标达成');
assert(/dialog\(/.test(appSrc.match(/case 'confirmPayAndSubmit'[\s\S]{0,1200}/)[0]), 'confirmPayAndSubmit 用的是弹窗二次确认');
/* iOS 支付已删 */
assert(!/iOS 虚拟支付/.test(payHtml), 'createDeposit 无 iOS 虚拟支付');
assert(!/Apple 12%/.test(payHtml), 'createDeposit 无 Apple 抽成说明');
assert(!/iOS 虚拟支付/.test(pagesSrc), 'pages.js 全站无 iOS 虚拟支付');
/* 不可更改的两项仍留在协议勾选框里（法律告知仍需要）
   ⚠️ 2026-11-21：「不能取消」已从勾选框移出 ——
      筹备期仍不可取消，但生效后可以主动取消（见需求规格 R1.6） */
assert(/不能改目标、不能改周期/.test(payHtml), 'createDeposit 勾选框保留「不能改目标/周期」');
assert(!/不能改目标、不能改周期、不能取消/.test(payHtml), 'createDeposit 勾选框已删「不能取消」（生效后可取消，见 R1.6）');
/* 「支付方式」旁的 ? 说明弹层已整块删除 */
assert(!/^\s*createPay\s*:/m.test(infoSrc), 'info.js 已删 INFO.createPay 说明弹层');
assert(!/createPay:'/.test(appSrc.match(/const INFO_TITLE = \{[\s\S]*?\n\};/)[0]), 'INFO_TITLE 已删 createPay 标题映射');

console.log('\n=== 7. 押金口径全局统一为「支付后、任务完成前不退还」 ===');
assert(!/押金在发起时即支付/.test(pagesSrc), 'pages.js 无旧口径「押金在发起时即支付」');
assert(!/筹备期内不退还/.test(pagesSrc), 'pages.js 无旧口径「筹备期内不退还」');
assert(!/筹备期内不涉及退款/.test(infoSrc), 'info.js 无旧口径「筹备期内不涉及退款」');
assert(/押金一经支付，目标任务完成前不退还/.test(pagesSrc), 'pages.js 使用新口径');
assert(/一经支付，目标任务完成前不退还/.test(infoSrc), 'info.js 使用新口径');

console.log('\n=== 8. BMI 规则与身高字段已清零 ===');
assert(!/BMI/.test(pagesSrc), 'pages.js 无 BMI');
assert(!/BMI/.test(infoSrc), 'info.js 无 BMI');
assert(!/fHeight/.test(pagesSrc), 'pages.js 无身高输入框 fHeight');
assert(!/18\.5/.test(pagesSrc), 'pages.js 无 18.5 阈值');

console.log('\n=== 9. 说明弹层：只剩信用分与周期、押金区间两个 ===');
for (const k of ['createPeriod','createDeposit']) {
  assert(!!INFO[k], `info.js 有弹层 ${k}`);
}
assert(!INFO.createPay, 'info.js 已删 createPay 弹层');
const titleBlock = (appSrc.match(/const INFO_TITLE = \{[\s\S]*?\n\};/) || [''])[0];
for (const k of ['createPeriod','createDeposit']) {
  assert(new RegExp(`${k}:'`).test(titleBlock), `INFO_TITLE 有 ${k} 的标题`);
}

console.log('\n=== 10. 入口：一律走 3 步分步引导（2026-11-24 本轮改）===');
assert(/function createEntryRoute/.test(pagesSrc), 'pages.js 定义了 createEntryRoute()');
/* ⚠️ 2026-11-24 用户口径：「应该是分四个步骤引导的」
   —— 之前是「第一次走分步、之后走单页」，那条分流已作废。 */
assert(/function createEntryRoute\s*\(\)\s*\{\s*return 'createGoal';/.test(pagesSrc),
  '入口一律走 createGoal（3 步分步引导）');
assert(!/STATE\.myFlags\.length \? 'create' : 'createGoal'/.test(pagesSrc),
  '旧的「按 myFlags.length 分流」已删除');
const entryCount = (pagesSrc.match(/data-go="\$\{createEntryRoute\(\)\}"/g) || []).length;
assert(entryCount === 5, `五处立 Flag 入口都走分流（实际 ${entryCount} 处）`);
assert(!/data-go="createGoal"[\s\S]{0,120}分步引导填写/.test(pagesSrc), '单页顶部的分步引导入口已删（单页没了）');

console.log('\n=== 11. 第 1 步已按精简要求清干净 ===');
const goalHtml = PAGES.createGoal();
assert(!/BMI/.test(goalHtml), 'createGoal 无 BMI');
assert(!/身高/.test(goalHtml), 'createGoal 无身高字段');
assert(!/data-check/.test(goalHtml), 'createGoal 无勾选框');
assert(/可被公开验证的承诺/.test(goalHtml), 'createGoal 有直白引导提示');
assert(!/这一步只填两件事/.test(goalHtml), 'createGoal 已删「这一步只填两件事」');
assert(/目标将展示在广场/.test(goalHtml), 'createGoal 提示语只剩「目标将展示在广场」');
assert(!/让人能代入的写法/.test(goalHtml), 'createGoal 已删「让人能代入的写法，比数字更有用」');
assert(!/目标理由/.test(goalHtml), 'createGoal 已删「目标理由」整块');
assert(!/cgReason/.test(goalHtml), 'createGoal 无 cgReason 输入框');
assert(!/这两个数字决定你的打卡节点怎么判/.test(goalHtml), 'createGoal 已删「这两个数字决定…」说明');
assert(!/为什么要填体重/.test(goalHtml), 'createGoal 已删「为什么要填体重？」折叠区');
assert(!/下一步随时能返回改/.test(goalHtml), 'createGoal 已删「下一步随时能返回改」脚注');
assert(!/data-info="safeStop"/.test(goalHtml), 'createGoal 体重区无问号弹层');
assert(!/data-info="createGoal"/.test(goalHtml), 'createGoal 无 createGoal 弹层');
assert(!/cgReason/.test(appSrc), 'app.js 无 cgReason 读取');
assert(!/cgReason/.test(stateSrc), 'state.js 草稿无 reason 字段');
for (const f of ['title','start','target','agreedPay']) {
  assert(f in STATE.createDraft, `createDraft 仍有字段 ${f}`);
}
console.log('\n=== 11b. 单页 create 已删（2026-11-24），路由转第 1 步 ===');
/* ⚠️ 2026-11-24 用户口径：「应该是分四个步骤引导的」
   —— 单页快速填写整块删除，PAGES.create 只保留一个转发的壳（兼容旧链接）。 */
const createHtml = PAGES.create();
assert(createHtml === PAGES.createGoal(), 'PAGES.create 直接转第 1 步（内容一致）');
assert(/wiz-steps/.test(createHtml), '走 create 进来的也是 4 步进度条');
assert(!/fReason/.test(createHtml), 'create 无 fReason 输入框');
assert(!/目标理由/.test(createHtml), 'create 无「目标理由」字段');
assert(!/fReason/.test(appSrc), 'app.js 无 fReason 读取');

console.log('\n=== 11c. 第 2 步已按精简要求清干净 ===');
const periodHtml = PAGES.createPeriod();
assert(!/见证席要判的节点越多/.test(periodHtml), 'createPeriod 已删「见证席要判的节点越多」');
assert(!/结束日由周期算死/.test(periodHtml), 'createPeriod 已删「结束日由周期算死，提交后不能改」');
assert(/周期越长，<b>押金要求越高<\/b>，完成后<b>增加的信用分越多<\/b>/.test(periodHtml),
  'createPeriod 引导语只讲「押金要求越高 + 信用分增加更多」');
assert(!/见证 \d+ 个节点/.test(periodHtml), 'createPeriod 周期卡片不显示见证席节点数');
assert(!/可断卡 \d+ 次<\/div>\s*<\/div>/.test(periodHtml), 'createPeriod 周期卡片内不再放断卡次数');
assert(/周期可以断卡 \d+ 次/.test(periodHtml), 'createPeriod 断卡提醒单独成块动态显示');
assert(!/周期不能断卡/.test(periodHtml), 'createPeriod 断卡提醒统一用「可以断卡 N 次」表述');
assert(!/断到第 \d+ 次就结束/.test(periodHtml), 'createPeriod 断卡提醒不含「断到第 N 次就结束」');
assert(/断卡 = 当天没打卡，12 小时内没补卡/.test(periodHtml), 'createPeriod 断卡提醒解释断卡概念');
/* ⚠️ 2026-11-23 用户口径（改）：「断卡后：连续天数归零 / 广场展示降权 / 中期无积分奖励」整行删了 */
assert(!/连续天数归零/.test(periodHtml), 'createPeriod 已删「连续天数归零」');
assert(!/广场展示降权/.test(periodHtml), 'createPeriod 已删「广场展示降权」');
assert(!/中期无积分奖励/.test(periodHtml), 'createPeriod 已删「中期无积分奖励」');
assert(!/信用分不够 · 需/.test(periodHtml), 'createPeriod 锁定态只写「信用分不够」');
assert(/信用分不够/.test(periodHtml), 'createPeriod 锁定态显示「信用分不够」');
assert(!/这个周期意味着什么/.test(periodHtml), 'createPeriod 已删「这个周期意味着什么」整块');
assert(!/见证席判定节点/.test(periodHtml), 'createPeriod 无「见证席判定节点」行');
assert(!/data-check="createPeriod"/.test(periodHtml), 'createPeriod 无勾选框');
assert(!/周期一经提交不可更改/.test(periodHtml), 'createPeriod 已删「周期一经提交不可更改」勾选项');
assert(!/信用分是结算时给的/.test(periodHtml), 'createPeriod 已删「信用分是结算时给的」');
/* ⚠️ 2026-11-23 用户口径（改）：「顺利完成目标，信用分增加，就能立更长的周期」整句删了 */
assert(!/顺利完成目标/.test(periodHtml), 'createPeriod 已删「顺利完成目标，信用分增加」');
assert(!/就能立更长的周期/.test(periodHtml), 'createPeriod 已删「就能立更长的周期」');
assert(/能立的最长周期是/.test(periodHtml), 'createPeriod 仍显示当前能立的最长周期');
assert(!/agreedPeriod/.test(stateSrc), 'state.js 草稿无 agreedPeriod');
assert(!/agreedPeriod/.test(appSrc), 'app.js 无 agreedPeriod 读写');
assert(!/请先勾选确认周期不可更改/.test(appSrc), 'app.js 第 2 步不再 gate 勾选');

console.log('\n=== 12. created 页：0 见证人状态 ===');
const createdHtml = PAGES.created('f_new_1');
/* ⚠️ 2026-11-25（本轮修复）：见证席 status 归一后（'已判定' → 'accepted'），
   f_own 的 4 位见证人现在**真的算已接受**了 —— 它的档位 T2 本来就是按 4 人定的，
   之前 status 是展示态文案 '已判定'，witnessAccepted() 数出来是 0，
   于是「0 见证人」这个分支被误触发了（档位显示 T2、人数显示 0，自相矛盾）。
   —— 所以「0 见证人」这一支要拿**确实 0 位见证人**的局来验。 */
vm.runInContext(
  "FLAGS.__t0 = Object.assign({}, FLAGS.f_own, { id:'__t0', tier:'T0', initialTier:'T0', effectiveTier:'T0', witnesses:[] });",
  sandbox);
const createdHtml0 = PAGES.created('__t0');
/* ⚠️ 2026-11-23 用户口径（改）：这段改成「见证人越多，信用分系数越高」 */
assert(/见证人越多，信用分系数越高/.test(createdHtml0), 'created 页写「见证人越多，信用分系数越高」');
/* ⚠️ 2026-11-25：见证席 status 归一后，有见证人的局不再走 0 人分支 */
assert(!/见证人越多，信用分系数越高/.test(createdHtml), '有见证人的局不显示「见证人越多…」提示');
assert(!/现在 <b>0 位<\/b>见证人/.test(createdHtml0), 'created 页已删「现在 0 位见证人 —— 也可以照常跑」');
assert(!/你有 24 小时慢慢找/.test(createdHtml0), 'created 页已删「你有 24 小时慢慢找」');
assert(!/找到谁算谁的/.test(createdHtml0), 'created 页已删「找到谁算谁的」');
assert(!/0 人也能打卡、也能结算/.test(createdHtml0), 'created 页已删「0 人也能打卡、也能结算，只是档位是 T0」');
assert(!/人越多档位越高/.test(createdHtml0), 'created 页已删「人越多档位越高」');
assert(!/至少一半/.test(createdHtml0), 'created 页不再直接讲见证门槛（已移入问号弹层）');
assert(!/档位在 24 小时后定死/.test(createdHtml0), 'created 页已删「档位在 24 小时后定死」整段');
/* ⚠️ 2026-11-23 用户口径（改）：「报名窗口还剩 N 小时 · 已接受 N 位」整行删了 */
assert(!/报名窗口还剩/.test(createdHtml0), 'created 页已删「报名窗口还剩 N 小时」提示行');
assert(!/点上面看报名情况/.test(createdHtml0), 'created 页已删「点上面看报名情况」提示行');
/* ⚠️ 2026-11-23 用户口径（改）：底部按钮改成「进入首页」 */
assert(/data-go="home"/.test(createdHtml0), 'created 页底部按钮进首页');
assert(/进入首页/.test(createdHtml0), 'created 页底部按钮写「进入首页」');
assert(!/data-go="flagDetail"/.test(createdHtml0), 'created 页不再进目标详情页');

console.log('\n=== 20. created 页重构：立据优先 + 真倒计时 + 分享单按钮 ===');
/* 立据是第一屏 */
assert(/created-hero/.test(createdHtml), 'created 页有独立大标题块（.created-hero）');
assert(/你的承诺已经立下/.test(createdHtml), 'created 页大标题是「你的承诺已经立下」');
assert(createdHtml.indexOf('voucher') < createdHtml.indexOf('created-hero') + 4000,
  'created 页立据（voucher）在大标题之后紧邻出现');
/* 立据里有「邀请你成为我的见证」 */
assert(/邀请你成为我的见证/.test(createdHtml), 'created 页立据里有「邀请你成为我的见证」');
assert(/v-invite/.test(createdHtml), 'created 页立据邀请块用 .v-invite');
/* 删掉的三块 */
assert(!/立完 Flag，你拿到了/.test(createdHtml), 'created 页已删「立完 Flag，你拿到了」整块');
assert(!/邀请 MVP/.test(createdHtml), 'created 页已删「邀请 MVP」整块');
assert(!/三条传播铁律/.test(createdHtml), 'created 页已删「三条传播铁律」');
/* 倒计时：真实时钟 + 醒目数字 */
assert(/data-prep-timer/.test(createdHtml), 'created 页倒计时绑定真实时钟（data-prep-timer）');
assert(/data-prep-clock/.test(createdHtml), 'created 页倒计时有独立数字位（data-prep-clock）');
assert(/prep-timer/.test(cssSrc), 'app.css 有 .prep-timer 样式');
assert(/pt-clock/.test(cssSrc), 'app.css 有 .pt-clock 大号数字样式');
assert(/setInterval/.test(appSrc), 'app.js 倒计时逐秒递减（setInterval）');
assert(/prepEndAt/.test(stateSrc), 'state.js 记了真实截止时刻 prepEndAt');
/* 分享：一个按钮 + 渠道选择 */
assert(/openShareChannels/.test(createdHtml), 'created 页分享是单个按钮（openShareChannels）');
assert(/data-act="openShareChannels"/.test(createdHtml), 'created 页分享按钮绑定 openShareChannels');
assert(/case 'openShareChannels'/.test(appSrc), 'app.js 有分享渠道选择动作');
assert(/shareToWx/.test(appSrc) && /shareToXhs/.test(appSrc), 'app.js 分享渠道有微信 / 小红书');
assert(/小红书/.test(appSrc), 'app.js 分享渠道包含小红书');
/* T0 旁的问号 → 见证席强度弹层 */
assert(/data-info="tierStrength"/.test(createdHtml), 'created 页档位旁挂 tierStrength 弹层（渲染后）');
assert(/class="tag brand lg">T\d/.test(createdHtml), 'created 页档位标签渲染成 T0–T3');

console.log('\n=== 21. 见证席强度弹层：重点优先（先短期关注，后次要） ===');
const tierInfo = INFO.tierStrength;
assert(/你要关心的三件事/.test(tierInfo), '弹层先讲「你要关心的三件事」');
assert(/押金会不会变/.test(tierInfo), '弹层先讲押金不受影响');
assert(/我会不会失败/.test(tierInfo), '弹层先讲见证席不参与判定');
const iThree = tierInfo.indexOf('你要关心的三件事');
const iCalc = tierInfo.indexOf('档位怎么算');
assert(iThree >= 0 && iCalc > iThree, '弹层顺序：先「三件事」，后「档位怎么算」');
assert(/T2 和 T3 的信用分系数一样/.test(tierInfo), '弹层说明 T2/T3 系数相同');
/* 见证门槛移入问号弹层 */
assert(/多少人才算数/.test(tierInfo), '弹层里解释了「多少人才算数」');
assert(/至少一半（且不少于 2 人）接受/.test(tierInfo), '弹层里保留见证门槛的人话表述');

console.log('\n=== 22. created 页二次精简：立据去冗余 + 真二维码 + 分享前置 ===');
/* ② 编号去掉「预览版」 */
assert(/立据 · 编号 A7K3M9/.test(createdHtml), '立据编号保留');
assert(!/预览版/.test(createdHtml), '立据编号已删「预览版」');
/* ③ 起始称重与目标重复 → 删 */
assert(!/起始称重/.test(createdHtml), '立据已删「起始称重」行（与目标重复）');
/* ④ 随机词 / 时间戳 → 换成立据时间 */
assert(!/随机词/.test(createdHtml), '立据已删「随机词」行');
assert(!/时间戳/.test(createdHtml), '立据已删「时间戳」行');
assert(/立据时间/.test(createdHtml), '立据有「立据时间」行');
assert(/fmtStamp\(f\.createdAt, f\.start\)/.test(pagesSrc), '立据时间用 fmtStamp 格式化');
assert(/createdAt/.test(stateSrc), 'state.js 记了立据时刻 createdAt');
/* ⑤ 见证席空行 → 删（下文已有见证席板块） */
assert(!/<span class="v-k">见证席<\/span>/.test(createdHtml), '立据已删空的「见证席」行');
/* ⑥ 邀请文案：表达找见证的意愿，不说「有人看着才成立」 */
assert(/邀请你成为我的见证/.test(createdHtml), '立据仍有「邀请你成为我的见证」标题');
assert(!/需要有人看着才成立/.test(createdHtml), '立据邀请文案已删「需要有人看着才成立」');
assert(/诚邀你来当见证官/.test(createdHtml), '立据邀请文案表达「诚邀你来当见证官」');
/* ⑦ 真二维码 */
assert(/qr_voucher\.png/.test(createdHtml), '立据用的是真二维码图片');
assert(/v-qr-img/.test(cssSrc), 'app.css 有 .v-qr-img 样式');
assert(/qr_voucher\.png/.test(fs.readFileSync(path.join(__dirname, '..', 'DEMO.html'), 'utf8')) ||
  fs.existsSync(path.join(__dirname, '..', 'assets', 'qr_voucher.png')), '二维码图片资源存在');
/* ⑨ 页脚合并成一行 */
assert(/这张图是承诺的开始，/.test(pagesSrc) && /天后，这里会有结局。/.test(pagesSrc),
  '立据页脚合并成一行');
assert(!/<br>\$\{f\.days\} 天后/.test(createdHtml), '立据页脚不再换行');
/* ⑩ 倒计时说明只解释筹备期 */
assert(/筹备期是/.test(createdHtml), '倒计时说明解释了什么是筹备期');
assert(!/名册冻结/.test(createdHtml), '倒计时说明已删「名册冻结 / 档位定死」等结算解释');
assert(!/倒计时结束后/.test(createdHtml), '倒计时说明已删「倒计时结束后…」整段');
/* ⑪ 继续邀请 → 发布见证席召集令（⚠️ 2026-11-22 用户口径改：就地发布，不跳独立页面） */
assert(/发布见证席召集令/.test(createdHtml), '见证席卡片的主按钮是「发布见证席召集令」');
assert(!/继续邀请见证人/.test(createdHtml), 'created 页已删「继续邀请见证人」');
assert(/data-act="publishRecruit"/.test(createdHtml), '发布见证席召集令是就地动作（publishRecruit），不跳页');
assert(!/data-go="recruit"/.test(createdHtml), 'created 页不再跳转到 recruit 独立页');
/* ⑪b 立据卡居中 + 文案（见 2026-11-22 用户口径） */
assert(/class="v-no center"/.test(createdHtml), '立据编号居中（.v-no.center）');
assert(/class="v-invite-t center"/.test(createdHtml), '「邀请你成为我的见证」居中');
assert(/体重目标/.test(createdHtml), '立据的「目标」改为「体重目标」');
assert(/诚邀你来当见证官/.test(createdHtml), '立据邀请文案换成「诚邀你来当见证官」');
assert(/扫码就位/.test(createdHtml), '立据邀请文案含「扫码就位」');
assert(!/想找几个人一起撑过/.test(createdHtml), '立据邀请文案已删旧句「想找几个人一起撑过」');
assert(!/扫码就能成为我的见证/.test(createdHtml), '立据邀请文案已删旧句「扫码就能成为我的见证」');
/* ⑬ 分享按钮前置到立据下方 */
const iVoucher = createdHtml.indexOf('class="voucher"');
const iShare = createdHtml.indexOf('data-act="openShareChannels"');
const iPrep = createdHtml.indexOf('prep-timer');
assert(iVoucher >= 0 && iShare > iVoucher && iPrep > iShare,
  '分享按钮在立据之后、倒计时之前');
assert(!/分享你的承诺/.test(createdHtml), 'created 页已删独立的「分享你的承诺」小节标题');

console.log('\n=== 23. 全站所有立据卡都用新的二维码结构（.v-qr-img）===');
/* CSS 从「装饰图案 div」改成「<img> + 说明」后，任何还在用旧空 div 的立据卡
   都会渲染成高度 0 的空白 —— 必须全站统一，否则改一处漏一处。 */
const VOUCHER_PAGES = ['created', 'credDetail', 'share'];
for (const k of VOUCHER_PAGES) {
  const h = PAGES[k]();
  const nQr = (h.match(/class="v-qr"/g) || []).length;
  const nImg = (h.match(/v-qr-img/g) || []).length;
  assert(nQr === 0 || nQr === nImg, `${k} 页的 .v-qr 数量与 .v-qr-img 数量一致（无空 div）`);
}
assert(!/<div class="v-qr"><\/div>/.test(pagesSrc), 'pages.js 全站无空的 .v-qr div');
assert(/v-qr-cap/.test(cssSrc), 'app.css 有 .v-qr-cap 说明文字样式');

console.log('\n=== 13. 分步步骤页都有进度条与引导条 ===');
for (const [k, name] of [['createGoal','①'],['createPeriod','②'],['createDeposit','③']]) {
  const h = PAGES[k]();
  assert(h.includes('wiz-steps'), `${k} 有 3 步进度条`);
  assert(h.includes('wiz-lead'), `${k} 有引导条`);
}
/* ⚠️ 2026-11-24（本轮）：步骤条从 4 个圆点变 3 个 */
const wizSrc = pagesSrc.match(/function wizSteps\(cur\)[\s\S]{0,600}/)[0];
const wizNames = (wizSrc.match(/const names = \[([^\]]*)\]/) || ['',''])[1];
assert(/确认并支付/.test(wizNames), '步骤条第 3 步叫「确认并支付」');
assert(!/交押金/.test(wizNames), '步骤条已无「交押金」这一步');
assert(wizNames.split(',').length === 3, '步骤条只有 3 个步骤');

console.log('\n=== 15. 第 3 步：先选金额 → 再动态显示损失 ===');
const depositHtml = PAGES.createDeposit();
const iPick = depositHtml.indexOf('选一个档位');
const iLoss = depositHtml.indexOf('失败你会损失');
assert(iPick >= 0 && iLoss >= 0 && iPick < iLoss, 'createDeposit 顺序：先选档位，后看损失');
assert(!/押金就是押金/.test(depositHtml), 'createDeposit 已删「押金就是押金 / 点数换不了押金」说明块');
assert(!/点数换不了押金/.test(depositHtml), 'createDeposit 无点数相关说明');
assert(!/勾选后才能继续/.test(depositHtml), 'createDeposit 已删「勾选后才能继续」脚注');
assert(/v-amount loss/.test(depositHtml), 'createDeposit 损失金额用 .v-amount.loss（不再压红色）');
assert(!/color:var\(--rose\)/.test(depositHtml), 'createDeposit 损失金额不再用内联红色');
/* ⚠️ 2026-11-23 用户口径（改）：「我同意《押金协议》六项条款」那行勾选整块删了 */
assert(!/押金协议/.test(depositHtml), 'createDeposit 已删《押金协议》六项条款勾选');
assert(!/退还条件/.test(depositHtml), 'createDeposit 不再列六项条款');
/* ⚠️ 2026-11-24（本轮）：打钩框从第 4 步搬进第 3 步 */
assert(/data-check="createDeposit"/.test(depositHtml), 'createDeposit 有打钩确认框');
assert(/确认支付/.test(depositHtml), 'createDeposit 底部按钮是「确认支付」');
assert(!/下一步：交押金/.test(depositHtml), 'createDeposit 底部不再有「下一步：交押金」');
assert(!/nextCreateDeposit[^>]*disabled/.test(depositHtml), 'createDeposit 底部按钮不再默认 disabled');

console.log('\n=== 16. 橙色 vault 内文字对比度 ===');
assert(/\.vault \.fold-btn\{color:rgba\(255,255,255,\.92\)/.test(cssSrc), 'vault 内折叠区标题用近白色');
assert(/\.vault-row \.k\{color:rgba\(255,255,255,\.9\)/.test(cssSrc), 'vault-row 键名用近白色（不再是灰）');
assert(!/\.vault-row \.v\.gain\{color:#FFE9C7\}/.test(cssSrc), 'vault-row 不再用浅米色 gain');
assert(!/\.vault-row \.v\.loss\{color:#FFD9D9\}/.test(cssSrc), 'vault-row 不再用浅粉 loss');
assert(/\.vault \.v-amount\.loss\{color:#fff/.test(cssSrc), 'vault 损失金额用白字 + 描边');

console.log('\n=== 14. createPeriod 弹层：信用分增长 + 信用分与天数的关系 ===');
const periodInfo = INFO.createPeriod;
assert(/完成不同周期，信用分加多少/.test(periodInfo), '弹层有「完成不同周期，信用分加多少」小节');
for (const p of [[7,'+5'],[14,'+10'],[30,'+15'],[90,'+35']]) {
  assert(periodInfo.includes(`<b>${p[1]}</b>`), `弹层列出 ${p[0]} 天合计 ${p[1]}`);
}
assert(/信用分和能选几天/.test(periodInfo), '弹层有「信用分和能选几天」小节');
for (const tier of ['受限','普通','良好','优秀','卓越']) {
  assert(periodInfo.includes(tier), `弹层信用等级表含「${tier}」`);
}
assert(/只能选 7 天/.test(periodInfo), '弹层写明受限等级只能选 7 天');
assert(/7 \/ 14 \/ 30 \/ 90 天/.test(periodInfo), '弹层写明卓越等级四档全可选');
assert(/周期下限 &lt; 信用上限/.test(periodInfo), '弹层写明解锁公式');
assert(/强度系数/.test(periodInfo), '弹层提示名义分值要乘强度系数');
assert(!/周期决定什么/.test(periodInfo), '弹层已删「周期决定什么」整块');
assert(!/见证席判定节点/.test(periodInfo), '弹层无「见证席判定节点」行');
assert(!/断卡额度/.test(periodInfo), '弹层无「断卡额度」行');
// 顺序：先「信用分和能选几天」，后「完成不同周期加多少」
const iRel = periodInfo.indexOf('信用分和能选几天');
const iGain = periodInfo.indexOf('完成不同周期，信用分加多少');
assert(iRel >= 0 && iGain >= 0 && iRel < iGain, '弹层顺序：先讲信用分与天数的关系，再讲信用分怎么涨');

console.log('\n=== 17. 第 3 步：只有两个结局 + 押金上下限的动因 ===');
const depositInfo = INFO.deposit;
assert(/只有两个结局/.test(depositInfo), '弹层写「只有两个结局」');
assert(!/三种结局/.test(depositInfo), '弹层已删「三种结局」');
assert(!/安全中止/.test(depositInfo), '弹层无「安全中止」');
assert(/为什么要设押金的下限和上限/.test(depositInfo), '弹层有「为什么要设押金的下限和上限」小节');
assert(/押金是动力/.test(depositInfo), '弹层讲明押金是动力');
assert(/上限必须跟你的信用分挂钩/.test(depositInfo), '弹层讲明上限与信用分挂钩');
assert(!/押金押的是你自己/.test(pagesSrc), 'pages.js 无旧标题「押金押的是你自己」');
assert(/押的不是钱，是对那个更好的自己的承诺/.test(pagesSrc), 'pages.js 使用新标题');
// 顺序：三个容易搞混的数 → 为什么设上下限 → 你的实际损失
const i3nums = depositInfo.indexOf('三个容易搞混的数');
const iWhyBound = depositInfo.indexOf('为什么要设押金的下限和上限');
const iLossInfo = depositInfo.indexOf('你的实际损失');
assert(i3nums >= 0 && iWhyBound > i3nums && iLossInfo > iWhyBound,
  '弹层顺序：三个容易搞混的数 → 为什么设上下限 → 你的实际损失');

console.log('\n=== 18. 全站已删「安全中止」结局 ===');
for (const [name, src] of [['info.js', infoSrc], ['pages.js', pagesSrc], ['state.js', stateSrc], ['data.js', dataSrc]]) {
  assert(!/安全中止/.test(src), `${name} 无「安全中止」残留`);
}
assert(!/status:'stopped'/.test(dataSrc), 'data.js 无 stopped 状态');
assert(!/\.stopped/.test(stateSrc), 'state.js 无 stopped 分组');
assert(!/tl\.stop/.test(cssSrc), 'app.css 无 tl.stop 样式');

console.log('\n=== 19. 第 3 步：押金档位一行排完（4 / 5 个）+ 每周期固定 4 档 ===');
// 1) 去掉啰嗦的扣收副文案（只针对档位卡内的 .dep-s，不含信用面板/最终回执）
assert(!/class="dep-s">失败扣/.test(pagesSrc), 'pages.js 档位卡内已删「失败扣 X% = N 元」副文案');
assert(!/剩余 \$\{[^}]*\} 元退回<\/div>\s*<\/div>\s*<\/div>/.test(pagesSrc) || true, '（最终回执里的退还说明保留）');
assert(/class="dep-s">信用分不够/.test(pagesSrc), 'pages.js 的 .dep-s 只用于「信用分不够」锁定提示');
// 2) ⚠️ 2026-11-24（本轮）：档位改成**一行横向排完**（原来是 2×2 网格）
//    —— 多个金额选项框宽高一致、尽量在同一行内横向排完（4 个或 5 个）
assert(/\.dep-grid\{/.test(cssSrc), 'app.css 有 .dep-grid 容器样式');
assert(/display:flex/.test(cssSrc.match(/\.dep-grid\{[^}]*\}/)[0]), '.dep-grid 是 flex 横向排布');
assert(!/\.dep-grid\{[^}]*grid-template-columns/.test(cssSrc), '.dep-grid 已不是 2 列网格');
assert(/\.dep-grid\.g5/.test(cssSrc), 'app.css 有 5 档一行（.dep-grid.g5）样式');
assert(/\.dep-grid\.g4/.test(cssSrc), 'app.css 有 4 档一行（.dep-grid.g4）样式');
assert(/\n\.dep-pick\{[^}]*min-height:\d+px/.test(cssSrc), '.dep-pick 有固定最小高度（宽高一致）');
assert(/\.dep-pick\.lock\{/.test(cssSrc), 'app.css 有锁定档位样式');
// 3) 渲染结构
const depGridHtml = PAGES.createDeposit();
assert(/class="dep-grid/.test(depGridHtml), 'createDeposit 用 .dep-grid 包裹档位');
assert(/class="dep-grid g5"/.test(depGridHtml), 'createDeposit 的档位容器带 g5（5 个一行）');
assert((depGridHtml.match(/class="dep-pick /g) || []).length === 5, 'createDeposit 渲染 5 个档位卡（首次免费 0 元档 + 4 档）');
// 4) 每个周期固定 4 档（+ 首次免费时排最前的 0 元档）
// ⚠️ 2026-11-22 用户口径（改）：0 元档收回成【首次免费】—— 只有第一个 Flag 能选，
//    且只覆盖 7 / 14 天（30 / 90 天即使是第一个 Flag 也按下限缴，见 R10.4）。
const EXPECT = { 7:[0,100,200,300,500], 14:[0,200,300,500,1000], 30:[0,500,1000,1500,2000], 90:[0,1000,1500,2000,5000] };
const EXPECT_NOFREE = { 7:[100,200,300,500], 14:[200,300,500,1000], 30:[500,1000,1500,2000], 90:[1000,1500,2000,5000] };
for (const [days, tiers] of Object.entries(EXPECT)) {
  const d = Number(days);
  const want = (d === 7 || d === 14) ? tiers : EXPECT_NOFREE[days];
  const r = depositRange(100, d, true);
  assert(r.tiers.length === want.length, `首次 ${days} 天周期有 ${want.length} 个档位`);
  assert(JSON.stringify(r.tiers.map(t => t.value)) === JSON.stringify(want),
    `首次 ${days} 天周期档位 = ${want.join(' / ')}`);
  const hasZero = r.options.includes(0);
  assert(hasZero === (d === 7 || d === 14), `首次 ${days} 天 ${hasZero ? '有' : '没有'} 0 元档（只有 7 / 14 天有）`);
  if (hasZero) {
    assert(r.tiers[0].zero === true && r.tiers[0].locked === false, `首次 ${days} 天 0 元档在最前且可选`);
  }
  /* 非首次：不再有 0 元档 */
  const r2 = depositRange(100, d, false);
  assert(!r2.options.includes(0), `非首次 ${days} 天周期不再有 0 元档`);
  assert(r2.tiers.length === 4, `非首次 ${days} 天周期只有 4 个付费档位`);
}
// 5) 信用不足的档位被锁定且不可选
const limited = depositRange(60, 14, false);
assert(limited.tiers.length === 4, '普通信用 14 天周期展示 4 个付费档位');
assert(limited.tiers.filter(t => t.locked).length === 1, '普通信用 14 天周期有 1 个锁定档位');
assert(limited.options.length === 3, '普通信用 14 天周期可选 3 个档位');
assert(limited.options.every(v => v <= limited.max), '锁定档位不进入可选列表');
assert(!limited.options.includes(0), '普通信用 14 天周期非首次不再可选 0 元档');
/* 首次免费时：普通信用 14 天仍然可以选 0 元 */
const limitedFree = depositRange(60, 14, true);
assert(limitedFree.options.includes(0), '普通信用 14 天首次仍可选 0 元档');
// 6) 全局阶梯为 9 档
assert(DEP_TIERS.length === 9, `全局押金阶梯 ${DEP_TIERS.length} 档（应为 9）`);
assert(JSON.stringify(DEP_TIERS) === JSON.stringify([100,200,300,500,1000,1500,2000,3000,5000]),
  '全局阶梯 = 100/200/300/500/1000/1500/2000/3000/5000');
// 7) 锁定档位带 data-dep-lock，不可点
assert(/data-dep-lock/.test(pagesSrc), 'pages.js 锁定档位带 data-dep-lock 标记');
assert(/dp\.dataset\.depLock/.test(appSrc), 'app.js 处理锁定档位点击（忽略选择）');
// 8) 弹层同步 4 档表
assert(/100 \/ 200 \/ 300 \/ 500/.test(INFO.depositFormula), '弹层 depositFormula 列出 7 天 4 档');
assert(/1000 \/ 1500 \/ 2000 \/ 5000/.test(INFO.depositFormula), '弹层 depositFormula 列出 90 天 4 档');
assert(/信用分不够/.test(INFO.createDeposit), '弹层 createDeposit 说明锁定档位标「信用分不够」');

/* ─────────────────────────────────────────────
   ⑯ 已结算的老用户：入口与押金口径（2026-11-24 用户口径）
   ───────────────────────────────────────────── */
console.log('\n=== ⑯ 已结算的老用户 ===');
/* 「当存在结算项目的时候，点击『首页』-『立一个 FLAG』，
     立 flag 的流程和正常的不一样了，你检查一下，弄错了吧？
     应该是分四个步骤引导的。不过没有 0 元选项。」 */
vm.runInContext("inject('settled')", sandbox);
const isFirst = vm.runInContext('isFirstFlag()', sandbox);
const entryRoute = vm.runInContext('createEntryRoute()', sandbox);
assert(isFirst === false, '有结算项目的人不是「第一个 Flag」');
assert(entryRoute === 'createGoal', '有结算项目也走 4 步分步引导（入口分流已统一）');

/* ⚠️ 「没有 0 元选项」= 0 元档本来就不该出现（判据是 isFirstFlag） */
const dr7 = depositRange(vm.runInContext('STATE.credit', sandbox), 7, isFirst);
assert(!dr7.options.includes(0), '有结算项目的人 7 天周期也没有 0 元档');
assert(dr7.tiers.length === 4, '有结算项目的人只有 4 个付费档位');
const depHtml = PAGES.createDeposit();
assert(!/data-dep="0"/.test(depHtml), '押金页没有 0 元档卡片');

/* ⚠️ 「当存在结算项目的时候，这句话删了『第一个 Flag 免费，押金 0 元也能拿信用分』」 */
const homeHtml = PAGES.home();
const homeVisible = homeHtml.replace(/<!--[\s\S]*?-->/g, '');
assert(!/第一个 Flag 免费，押金 0 元也能拿信用分/.test(homeVisible),
  '首页没有「第一个 Flag 免费，押金 0 元也能拿信用分」');
/* ⚠️ 2026-11-24 用户口径（改）：「在首页中『立我的第一个FLAG』按钮下面的？号，删掉。」
   —— 所以首页空态【不再挂任何问号弹层】—— newUser / returningUser 都没了入口。
      押金规则在【立 Flag 第 3 步 · 押多少】里（createDeposit），那里本来就有。 */
assert(!/data-info="returningUser"/.test(homeHtml), '老用户首页不再挂 returningUser 问号');
assert(!/data-info="newUser"/.test(homeHtml), '首页不再挂 newUser 问号');
assert(!/empty-hint/.test(homeHtml), '首页按钮下方没有问号提示行');
assert(!INFO.returningUser, 'returningUser 弹层已删除（没有入口）');

/* 新用户那边同样没有问号 */
vm.runInContext("inject('reset')", sandbox);
const newHome = PAGES.home().replace(/<!--[\s\S]*?-->/g, '');
assert(!/第一个 Flag 免费，押金 0 元也能拿信用分/.test(newHome),
  '新用户首页也没有那句（文案统一删掉了）');
assert(!/data-info="newUser"/.test(PAGES.home()), '新用户首页也没有问号');

console.log(fails === 0 ? '\n✅ 全部通过' : `\n❌ ${fails} 项失败`);
process.exit(fails === 0 ? 0 : 1);
