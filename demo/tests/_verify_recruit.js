/* 见证席召集令 + 候选池排序 的端到端行为验证（临时脚本）
   ⚠️ 2026-11-22 用户口径（改）：
     - 召集令不再有独立页面 —— 就地发布，按钮变「已发布」，点它升起半屏看报名
     - 报名者可以点开看账户信息，再决定接受 / 不接受
     - 候选池排序从「说明文字」变成「可点的控件」
     - 候选池页删掉「我的位置」整块与「申请进入候选池」按钮
   验证：这些新交互在真实渲染 + 真实状态机上成立 */
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

const STATE = vm.runInContext('STATE', sandbox);
const PAGES  = vm.runInContext('PAGES', sandbox);
const run = (code) => vm.runInContext(code, sandbox);

let fails = 0;
function assert(cond, msg){
  if(!cond){ console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}

console.log('=== A. 召集令不再有独立页面 ===');
assert(run('typeof PAGES.recruit') === 'undefined', 'PAGES 里已删掉 recruit 独立页');
assert(run('typeof ROUTES.recruit') === 'undefined', '路由表里已删掉 recruit');
assert(run('typeof recruitCopy') === 'function', '召集令文案改由 recruitCopy() 提供');
assert(run('recruitCopy()').includes('我押了 500 块'), '召集令文案内容保留');

console.log('\n=== A2. 召集令文案：突出「为什么要找见证」（2026-11-23 用户口径）===');
{
  const copy = run('recruitCopy()');
  const plain = copy.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');
  /* 首句只说押注 —— 不露体重、不露减肥意图（先承诺，后揭示） */
  assert(/^我押了 \d+ 块，\d+ 天后见分晓。/.test(plain.trim()),
    '首句仍是「我押了 X 块，X 天后见分晓」（先承诺，后揭示）');
  assert(!/\d+(\.\d+)?\s*kg/.test(plain), '文案里不出现任何体重数字');
  assert(!plain.includes('减肥') && !plain.includes('瘦'), '文案里不暴露减肥意图');
  /* 必须回答「为什么要找见证」 */
  assert(plain.includes('不是我一个人说了算'), '说明押金结局不由我一个人说了算');
  assert(plain.includes('有人') && (plain.includes('盯着')), '说明有人盯着才不容易放弃');
  /* 对方要做的事说得轻 */
  assert(plain.includes('2 位见证人'), '说清还差几位见证人');
  assert(plain.includes('点一下判定'), '把对方的动作说得简单');
  /* 旧的「解释为什么第一句不写体重」不该再出现在弹层里 */
  assert(!/为什么第一句不写体重/.test(fs.readFileSync(path.join(__dirname, '..', 'js','app.js'),'utf8')),
    '发布弹层里已删掉「为什么第一句不写体重」的解释');
}

console.log('\n=== B. 发布前只做二次确认，不展示文案（2026-11-23 用户口径改）===');
const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js','app.js'),'utf8');
assert(/case 'publishRecruit'/.test(appSrc), "app.js 有 publishRecruit 动作");
assert(/case 'confirmRecruit'/.test(appSrc), "app.js 有 confirmRecruit 动作（确认后才真发）");
/* ⚠️ 2026-11-23 用户口径（改）：「点击『发布见证席召集令』，弹出『再想想』和确认发布
   『就行了，不需要文案。』—— 弹层里只有两个按钮，不再展示召集令文案。 */
assert(!/recruitCopy\(\)/.test(appSrc), '发布确认弹层里不再渲染召集令文案');
assert(!/你的文案/.test(appSrc), '发布确认弹层里删掉「你的文案」标题');
assert(/再想想/.test(appSrc), '弹层里有「再想想」');
assert(/确认发布/.test(appSrc), '弹层里有「确认发布」');
assert(/case 'openRecruitSheet'/.test(appSrc), "app.js 有 openRecruitSheet 动作");
assert(/case 'acceptApplicant'/.test(appSrc), "app.js 有 acceptApplicant 动作");
assert(/case 'declineApplicant'/.test(appSrc), "app.js 有 declineApplicant 动作");
assert(/function openRecruitSheet/.test(appSrc), 'app.js 有 openRecruitSheet() 半屏函数');
/* ⚠️ 2026-11-24（本轮）：报名者详情半屏（小框）**删掉了** ——
   用户口径：「点击用户姓名或头像，直接跳转到该用户主页，取消当前独立小框式弹窗」
   —— 现在点头像/名字 = data-go="userProfile"，返回键回到报名情况半屏。 */
assert(!/function openApplicantSheet/.test(appSrc), 'app.js 已删 openApplicantSheet() 小框弹窗');
assert(!/case 'viewApplicant'/.test(appSrc), "app.js 已删 viewApplicant 动作");
assert(/data-go="userProfile"/.test(appSrc), '报名情况里点头像/名字直接跳 userProfile');
assert(/pendingSheetBack/.test(appSrc), 'app.js 记了 pendingSheetBack（返回时回到报名情况）');

console.log('\n=== C. 发起成功页：按钮状态随发布变化 ===');
run(`resetCreateDraft(); STATE.periodSel = 14; STATE.depSel = 500;
     submitFlag({ title:'测试局', start:68, target:63, period:14, deposit:500, witnesses:[] })`);
const createdBefore = PAGES.created(STATE.myFlags[0].id);
assert(createdBefore.includes('发布见证席召集令'), '未发布时按钮是「发布见证席召集令」');
assert(createdBefore.includes('data-act="publishRecruit"'), '按钮是就地发布动作（publishRecruit）');
assert(!createdBefore.includes('data-go="recruit"'), '不再跳转到 recruit 独立页');

run('publishRecruit()');
const createdAfter = PAGES.created(STATE.myFlags[0].id);
assert(createdAfter.includes('见证席召集令已发布'), '发布后按钮变成「见证席召集令已发布」');
assert(createdAfter.includes('data-act="openRecruitSheet"'), '「已发布」按钮点开报名情况半屏');
/* ⚠️ 2026-11-23 用户口径（改）：「报名窗口还剩 N 小时 · 已接受 N 位 —— 点上面看报名情况」整行删了 */
assert(!createdAfter.includes('报名窗口还剩'), 'created 页已删「报名窗口还剩 N 小时」提示行');
assert(!createdAfter.includes('点上面看报名情况'), 'created 页已删「点上面看报名情况」提示行');
assert(createdAfter.includes('人报名'), '显示报名人数');

console.log('\n=== D. 报名者：先看账户，再决定接受 ===');
const apps = run('recruitApplicants()');
assert(apps.length === 3, `召集令有 3 位报名者（实际 ${apps.length}）`);
assert(apps.every(a => a.status === 'applied'), '报名初始状态都是「已报名待处理」');
assert(run('recruitApplicantCount()') === 3, '报名人数 = 3');
/* 接受 → 状态流转 */
assert(run('acceptApplicant("r1")') === true, '可以接受一位报名者');
assert(run('recruitApplicants().find(a => a.id==="r1").status') === 'accepted', '接受后状态变「已接受」');
assert(run('recruitApplicantCount()') === 3, '已接受仍计入报名人数');
assert(run('acceptApplicant("r1")') === false, '同一位不能重复接受');
/* 拒绝 → 从报名人数里剔除 */
assert(run('declineApplicant("r2")') === true, '可以拒绝一位报名者');
assert(run('recruitApplicantCount()') === 2, '拒绝后报名人数 = 2');

console.log('\n=== E. 候选池排序：可点的控件 ===');
const poolHtml = PAGES.witnessPool();
assert(poolHtml.includes('data-act="setPoolSort"'), '排序维度是可点的按钮（setPoolSort）');
assert(poolHtml.includes('>关联度<'), '有关联度维度');
assert(poolHtml.includes('>信用分<'), '有信用分维度');
assert(poolHtml.includes('>成立率<'), '有成立率维度');
/* 渲染结果里会带 HTML 注释（保留用户原话），断言前先剥掉注释 */
const poolHtmlNoComment = poolHtml.replace(/<!--[\s\S]*?-->/g, '');
assert(!/按关联度 · 信用分 · 成立率排序/.test(poolHtmlNoComment), '旧的「只是文字」的排序说明已删（渲染结果里没有）');
const poolSrc = fs.readFileSync(path.join(__dirname, '..', 'js','pages.js'),'utf8');
assert(/按关联度 · 信用分 · 成立率排序，点击以后/.test(poolSrc), '（代码注释保留用户原话）');

/* 默认排序 = 关联度 */
const byRel = run('witnessPool().map(p => p.name)');
assert(byRel[0] === '林一', `默认按关联度排序，第一位是共同好友林一（实际 ${byRel[0]}）`);
assert(byRel.indexOf('林一') < byRel.indexOf('大壮'), '共同好友排在无关系的人前面');

/* 切到信用分 */
run('setPoolSort("credit")');
const byCredit = run('witnessPool().map(p => p.name)');
assert(byCredit[0] === '林一', `按信用分排序，第一位是信用分最高的林一（实际 ${byCredit[0]}）`);
assert(byCredit.indexOf('林一') < byCredit.indexOf('大壮'), '高信用分排前面');
assert(run('poolSortKey()') === 'credit', '排序维度状态记住了');
assert(PAGES.witnessPool().includes('class="on"'), '当前维度的按钮是高亮态');

/* 切到成立率 */
run('setPoolSort("rate")');
const byRate = run('witnessPool().map(p => p.name)');
assert(byRate[0] === '林一', `按成立率排序，第一位是成立率最高的林一（实际 ${byRate[0]}）`);
assert(byRate.indexOf('林一') < byRate.indexOf('大壮'), '高成立率排前面');
assert(run('setPoolSort("bogus")') === false, '非法排序维度被拒绝');

console.log('\n=== F. 候选池页删掉「我的位置」===');
assert(!poolHtml.includes('我的位置'), '「我的位置」整块已删');
assert(!poolHtml.includes('申请进入候选池'), '「申请进入候选池」按钮已删');
assert(!poolHtml.includes('完整监督过至少 1 个 Flag'), '顶部的说明块已删');
assert(!poolHtml.includes('信用分和成立率全部公开'), '顶部的说明块已删（第二句）');

console.log('\n=== G. 24 小时内可反复进入发起成功页 ===');
const detailHtml = PAGES.flagDetail(STATE.myFlags[0].id);
assert(detailHtml.includes('data-go="created"'), '本人版详情页有回到发起成功页的入口');
assert(detailHtml.includes('回到发起成功页'), '入口文案是「回到发起成功页」');
assert(detailHtml.includes('24 小时内可反复进入'), '入口说明写了 24 小时内可反复进入');
assert(run('ROUTES.created') !== undefined, 'created 路由仍在（可以被反复进入）');
/* 结算后（名单冻结）入口消失 */
run(`STATE.myFlags[0].status = 'running';`);
assert(!PAGES.flagDetail(STATE.myFlags[0].id).includes('回到发起成功页'),
  '名单冻结后这个入口消失（24 小时外没有意义）');

console.log('\n=== H. 立据卡文案与居中 ===');
const c = PAGES.created(STATE.myFlags[0].id);
assert(c.includes('class="v-no center"'), '立据编号居中');
assert(c.includes('class="v-invite-t center"'), '「邀请你成为我的见证」居中');
assert(c.includes('体重目标'), '「目标」改为「体重目标」');
assert(c.includes('我在「押了」立下'), '立据文案：我在「押了」立下');
assert(c.includes('作为赌注'), '立据文案：押金作为赌注');
assert(c.includes('诚邀你来当见证官'), '立据文案：诚邀你来当见证官');
assert(c.includes('到点监督我是否达标'), '立据文案：到点监督我是否达标');
assert(c.includes('扫码就位'), '立据文案：扫码就位');
assert(c.includes('守住这笔押金'), '立据文案：守住这笔押金');
assert(!c.includes('想找几个人一起撑过'), '旧文案已删');
assert(!c.includes('扫码就能成为我的见证'), '旧文案已删');

console.log(fails === 0 ? '\n✅ 全部通过' : `\n❌ ${fails} 项失败`);
process.exit(fails === 0 ? 0 : 1);
