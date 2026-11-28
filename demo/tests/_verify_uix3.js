/* 2026-11-24 本轮（第三批）交互调整的验证脚本
   覆盖三块：
     一、「确认并支付」页面（createDeposit）—— 5 小条
     二、见证席召集令 · 报名情况（openRecruitSheet）—— 3 小条
     三、筹备中状态页面（homePrep）—— 2 小条
   验证方式：静态源码断言 + 真实渲染（vm 沙箱里跑 PAGES.*） */
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

const pagesSrc = fs.readFileSync(path.join(__dirname, '..', 'js','pages.js'),'utf8');
const appSrc   = fs.readFileSync(path.join(__dirname, '..', 'js','app.js'),'utf8');
const cssSrc   = fs.readFileSync(path.join(__dirname, '..', 'css','app.css'),'utf8');

let fails = 0;
function assert(cond, msg){
  if(!cond){ console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}

/* =========================================================
   一、「确认并支付」页面
   ========================================================= */
console.log('\n=== 一.1 金额选择框统一并排（4-5 个一行） ===');
/* 用户口径：「多个金额选项框宽高保持一致，尽量在同一行内横向排完（4 个或 5 个）；
   旁边的解释说明文字字号可适当缩小。」 */
assert(/\.dep-grid\{[^}]*display:flex/.test(cssSrc), '.dep-grid 是横向 flex 排布');
assert(!/\.dep-grid\{[^}]*grid-template-columns/.test(cssSrc), '.dep-grid 已不是网格（原来 2 列）');
assert(/\.dep-grid\.g5 \.dep-pick\{[^}]*flex:1 1 0/.test(cssSrc), '.dep-grid.g5 每格等分宽度');
assert(/\.dep-grid\.g4 \.dep-pick\{[^}]*flex:1 1 0/.test(cssSrc), '.dep-grid.g4 每格等分宽度');
assert(/\n\.dep-pick\{[^}]*min-height:\d+px/.test(cssSrc), '.dep-pick 有固定最小高度（宽高一致）');
assert(/\.dep-v\{[^}]*white-space:nowrap/.test(cssSrc), '.dep-v 不折行（「1000 元」不撑高卡片）');
assert(/\.dep-grid\.g5 \.dep-s\{[^}]*font-size:1\d(\.\d+)?px/.test(cssSrc), 'g5 档位说明文字字号已缩小');

const depHtml = PAGES.createDeposit();
assert(/class="dep-grid g5"/.test(depHtml), '首次用户押金档位是 g5（5 个一行）');
assert((depHtml.match(/class="dep-pick /g) || []).length === 5, '渲染 5 个档位卡');

console.log('\n=== 一.2 重复文案删除 + 文字居中 ===');
/* 用户口径：标题栏已有「失败你会损失」，删掉卡片内重复的「失败实际损失」；
   卡片内「175 元」「信用 60 分」「普通失败扣 35」等文字居中对齐。 */
assert(/失败你会损失/.test(depHtml), '标题栏是「失败你会损失」');
assert(!/失败你会实际损失/.test(depHtml), '标题栏不再写「失败你会实际损失」');
/* 卡片内的「失败实际损失」标签删掉了 —— 但要确认说明文字还在别处（问号弹层） */
assert(!/class="v-label">失败实际损失/.test(depHtml), '卡片内重复的「失败实际损失」标签已删');
assert(/class="vault vault-center"/.test(depHtml), '损失卡加了 .vault-center（居中）');
assert(/\.vault\.vault-center\{[^}]*text-align:center/.test(cssSrc), '.vault-center 文字居中对齐');
assert(/v-amount loss/.test(depHtml), '金额仍用 .v-amount.loss');
assert(/v-sub">信用 \d+ 分 · \S+ · 失败扣收 \d+%/.test(depHtml), '信用分说明仍在卡内');

console.log('\n=== 一.3 删除冗余说明句 ===');
/* 用户口径：保留顶部「完成目标押金百分百退还，失败按信用比例扣收」；
   删除下方「你现在 60 分普通扣 35」这句话。 */
assert(/完成目标，押金 <b>100% 退还<\/b>。失败按信用比例扣收。/.test(depHtml), '顶部规则句保留');
assert(!/你现在 \d+ 分（\S+），<b>扣/.test(depHtml), '顶部不再写「你现在 X 分（X），扣 Y%」');
/* 「普通失败扣 35」只在代码注释里出现过（说明用户口径），
   渲染结果里不能有 —— 这里查渲染后的 HTML（去掉注释），不是源码。 */
const depText = depHtml.replace(/<!--[\s\S]*?-->/g, '');
assert(!/普通失败扣/.test(depText), '渲染结果里没有「普通失败扣」这类冗余说明句');
assert(!/失败实际损失/.test(depText), '渲染结果里没有重复的「失败实际损失」文案');

console.log('\n=== 一.4 支付弹窗按钮等宽居中 + 删底部小字 ===');
/* 用户口径：「取消」「确认支付」两个按钮居中对齐、尺寸大小一致；
   删除最下面一行小字（押金 500 / 14 天目标这类描述）。 */
assert(/function dialog\(title, body, okText = '确定', onOk, evenBtns = false\)/.test(appSrc),
  'dialog() 新增 evenBtns 参数');
assert(/dlg-actions-even/.test(appSrc), '弹窗按钮行带 .dlg-actions-even');
assert(/\.dialog-actions\.dlg-actions-even\{[^}]*justify-content:center/.test(cssSrc), '两个按钮居中');
assert(/\.dialog-actions\.dlg-actions-even \.btn\{[^}]*min-width/.test(cssSrc), '两个按钮同宽');
/* 二次确认弹窗正文里不再有「押金 ¥X · N 天 · 目标「...」」那一行 */
const cpaIdx = appSrc.indexOf("case 'confirmPayAndSubmit'");
const cpaBlock = appSrc.slice(cpaIdx, cpaIdx + 2200);
assert(!/押金 <b>¥\$\{deposit\}\.00<\/b> · \$\{days\} 天 · 目标/.test(cpaBlock),
  '二次确认弹窗删掉了底部「押金 / 天数 / 目标」小字');
assert(/公开生效/.test(cpaBlock) && /24 小时/.test(cpaBlock), '二次确认保留「公开生效 + 24 小时」');

console.log('\n=== 一.5 删除目标信息模块 ===');
/* 用户口径：删除页面内「目标周期、押金、挣了 / 亏了」这一整块信息。 */
assert(!/bar-row/.test(depHtml), '账目汇总整块（bar-row）已删');
assert(!/挣了（达标）/.test(depHtml), '「挣了（达标）」行已删');
assert(!/亏了（失败）/.test(depHtml), '「亏了（失败）」行已删');
assert(!/目标<\/span><span>\$\{d\.title/.test(depHtml), '「目标」行已删');
assert(!/周期<\/span><span>\$\{days\} 天/.test(depHtml), '「周期」行已删');
/* 但支付方式 / 打钩确认 / 底部按钮都还在 */
assert(/微信支付/.test(depHtml), '支付方式仍在');
assert(/data-check="createDeposit"/.test(depHtml), '打钩确认仍在');
assert(/确认支付/.test(depHtml), '底部「确认支付」按钮仍在');

/* =========================================================
   二、见证席召集令 · 报名情况
   ========================================================= */
console.log('\n=== 二.1 报名行新增「拒绝」按钮（与「接受」同尺寸） ===');
assert(/data-act="declineApplicant"/.test(appSrc), '报名行有「拒绝」动作');
assert(/data-act="acceptApplicant"/.test(appSrc), '报名行有「接受」动作');
assert(/\.row-acts\{[^}]*display:flex/.test(cssSrc), '.row-acts 是横向排布（两个按钮一行）');
assert(/\.row-acts \.btn\{[^}]*min-width/.test(cssSrc), '.row-acts 两个按钮同宽');
assert(/拒绝/.test(appSrc) && /接受/.test(appSrc), '两个按钮文案都在');

console.log('\n=== 二.2 点击后状态更新为「已接受」/「已拒绝」 ===');
assert(/a\.status === 'accepted'[\s\S]{0,120}已接受/.test(appSrc), '接受后显示「已接受」');
assert(/a\.status === 'declined'[\s\S]{0,120}已拒绝/.test(appSrc), '拒绝后显示「已拒绝」');
/* 真实状态机：接受 / 拒绝后 applicant.status 变掉，且行里不再有按钮 */
run(`resetCreateDraft(); STATE.periodSel = 14; STATE.depSel = 500;
     submitFlag({ title:'测试局', start:68, target:63, period:14, deposit:500, witnesses:[] });
     publishRecruit();`);
const appList = run('JSON.stringify(recruitApplicants())');
const before = JSON.parse(appList);
const applied = before.find(a => a.status === 'applied');
assert(!!applied, '有「待处理」的报名者可用于测试');
run(`acceptApplicant('${applied.id}')`);
const afterAcc = JSON.parse(run('JSON.stringify(recruitApplicants())'));
assert(afterAcc.find(a => a.id === applied.id).status === 'accepted', 'acceptApplicant() 把 status 改成 accepted');
const applied2 = afterAcc.find(a => a.status === 'applied');
run(`declineApplicant('${applied2.id}')`);
const afterDec = JSON.parse(run('JSON.stringify(recruitApplicants())'));
assert(afterDec.find(a => a.id === applied2.id).status === 'declined', 'declineApplicant() 把 status 改成 declined');
/* 重复处理要挡掉 */
assert(run(`acceptApplicant('${applied.id}')`) === false, '已处理过的报名者不能再接受');
assert(run(`declineApplicant('${applied2.id}')`) === false, '已处理过的报名者不能再拒绝');

console.log('\n=== 二.3 点头像/名字跳用户主页 + 返回回到报名情况 ===');
assert(!/function openApplicantSheet/.test(appSrc), '独立小框弹窗 openApplicantSheet 已删');
assert(!/case 'viewApplicant'/.test(appSrc), 'viewApplicant 动作已删');
assert(/data-go="userProfile"[^>]*data-id="\$\{a\.name\}"/.test(appSrc), '报名行头像/名字跳 userProfile');
assert(/pendingSheetBack/.test(appSrc), 'app.js 记了 pendingSheetBack');
assert(/pendingSheetBack === 'recruit'/.test(appSrc), 'goBack() 优先回到报名情况半屏');
/* 报名者列表可取到 */
const sheetBody = run("(()=>{const l=recruitApplicants(); return l.map(a=>a.name).join('|');})()");
assert(!!sheetBody, '报名者列表可取到（' + sheetBody + '）');

/* =========================================================
   三、筹备中状态页面
   ========================================================= */
console.log('\n=== 三.1 按钮文案改为「查看我的立据」 ===');
/* 旧文案只留在代码注释里（记录用户口径），渲染结果里不能有 */
const prepHtml = run(`PAGES.home()`);
const prepText = prepHtml.replace(/<!--[\s\S]*?-->/g, '');
assert(!/分享立据 · 邀请人来见证/.test(prepText), '旧的「分享立据 · 邀请人来见证」已删（渲染结果）');
assert(/查看我的立据/.test(prepText), '新文案「查看我的立据」已用');
assert(/data-go="created"/.test(prepText), '按钮仍然进立据页（created）');

console.log('\n=== 三.2 倒计时卡片改为不可点击 ===');
assert(/prep-clock-static/.test(pagesSrc), '倒计时块带 .prep-clock-static');
assert(/data-no-nav="1"/.test(pagesSrc), '倒计时块带 data-no-nav="1"');
assert(/\.prep-clock-block\.prep-clock-static\{[^}]*cursor:default/.test(cssSrc), '倒计时块不再是手型光标');
assert(/closest\('\[data-no-nav\]'\)/.test(appSrc), 'app.js 在事件层拦掉 data-no-nav 的点击');
/* 关键：拦截必须发生在 data-go 处理【之前】，否则会穿透到外层的 .prep-hero */
const guardIdx = appSrc.indexOf("if (e.target.closest('[data-no-nav]'))");
const goIdx   = appSrc.indexOf("const goEl = e.target.closest('[data-go]')");
assert(guardIdx > 0 && goIdx > 0 && guardIdx < goIdx, 'data-no-nav 拦截在 data-go 跳转之前（不会被穿透）');
/* ⚠️ 2026-11-24（本轮，用户口径 Part 一①）：整张筹备期灰卡改为【不可点击】——
   —— 用户口径：「筹备期状态下，首页『我的 Flag』灰色卡片当前仍可点击进入；
      调整为仅作展示，不可点击。」
   —— 所以原来那句「整张卡的其他部分仍然可点」**作废**了：
      现在整张卡都只是展示，要操作走下面那三个明确按钮。 */
assert(/class="hero prep-hero prep-hero-static" data-no-nav="1"/.test(pagesSrc),
  '整张筹备卡改为不可点击（prep-hero-static + data-no-nav）');
assert(!/class="hero prep-hero" data-go="created"/.test(pagesSrc),
  '筹备卡上不再有 data-go="created" 跳转');
assert(/\.prep-hero\.prep-hero-static\{[^}]*cursor:default/.test(cssSrc),
  '筹备卡不再是手型光标');

console.log('\n' + (fails ? `❌ ${fails} 项失败` : '✅ 全部通过'));
process.exit(fails ? 1 : 0);
