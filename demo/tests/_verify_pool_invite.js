/* 候选池邀请 / 候选人详情 / 广场押金角标 的行为验证（临时脚本）
   ⚠️ 2026-11-23 用户口径：
     1、见证席候选池，当用户点击「邀请」以后，按钮变为「已邀请」。
     2、见证席候选池，点击候选人头像，也能进入看到候选人的具体信息。
     3、广场页，把现在展示用户本次拍了多少张照片的数量地方，替换为用户的押金金额展示。
   验证：按钮状态翻转、头像可点开详情、广场角标是押金而不是照片数 */
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
function section(t){ console.log('\n=== ' + t + ' ==='); }

const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js','app.js'),'utf8');
const stateSrc = fs.readFileSync(path.join(__dirname, '..', 'js','state.js'),'utf8');

/* ------------------------------------------------------------------ */
section('1. 候选池「邀请」→ 按钮变「已邀请」');
{
  const before = PAGES.witnessPool();
  assert(/data-act="inviteFromPool"/.test(before), '未邀请时按钮是「邀请」（inviteFromPool 动作）');
  assert((before.match(/>邀请</g) || []).length >= 1, '有「邀请」文案');
  assert(!/>已邀请</.test(before), '未邀请时不显示「已邀请」');

  /* 点一次 */
  assert(run('inviteFromPool("p1")') === true, '第一次邀请返回 true');
  assert(run('poolInvited("p1")') === true, 'p1 已标记为已邀请');
  const after = PAGES.witnessPool();
  assert(/已邀请/.test(after), '邀请后按钮变「已邀请」');
  assert(!/data-act="inviteFromPool" data-id="p1"/.test(after), 'p1 的邀请按钮已失效');
  /* 其他人还是「邀请」 */
  assert(/data-act="inviteFromPool" data-id="p2"/.test(after), '其他候选人仍是「邀请」');

  /* 幂等 */
  assert(run('inviteFromPool("p1")') === false, '重复邀请返回 false（不重复发）');

  /* app.js 有动作处理 */
  assert(/case 'inviteFromPool'/.test(appSrc), "app.js 有 inviteFromPool 动作");
  assert(/'inviteFromPool'/.test(appSrc), 'inviteFromPool 在需要登录的动作列表里');
}

section('2. 候选池点头像 / 名字 → 跳用户主页（2026-11-24 改）');
{
  const pool = PAGES.witnessPool();
  /* ⚠️ 2026-11-24（本轮，用户口径 Part 三①）：点头像 / 名字**跳用户主页**，
     候选人详情半屏（viewPoolCandidate / openPoolCandidateSheet）整个删掉。 */
  assert(/data-go="userProfile" data-id="[^"]+" data-from="pool"/.test(pool),
    '候选人头像可点进用户主页（userProfile + data-from="pool"）');
  assert(!/data-act="viewPoolCandidate"/.test(pool), '不再有 viewPoolCandidate 入口');
  assert(!/function openPoolCandidateSheet/.test(appSrc), 'app.js 里的 openPoolCandidateSheet() 已删除');
  assert(!/case 'viewPoolCandidate'/.test(appSrc), 'app.js 里的 viewPoolCandidate 动作已删除');
  /* 返回落点：回候选池 */
  assert(/pendingSheetBack === 'pool'/.test(appSrc), 'goBack 处理 pendingSheetBack === "pool"');
  assert(/render\('witnessPool'/.test(appSrc), '返回时重新渲染候选池页');
  assert(/function poolCandidate/.test(stateSrc), 'state.js 有 poolCandidate()');
  assert(run('poolCandidate("p1").name') === '林一', '能按 id 找到候选人');
  assert(run('poolCandidate("nope")') === null, '找不到时返回 null');
}

section('3. 广场：照片数角标 → 押金金额');
{
  const sq = PAGES.square();
  /* 不再显示照片数量角标 */
  const noComment = sq.replace(/<!--[\s\S]*?-->/g, '');
  assert(!/\$\{extra\.length\}/.test(noComment), '角标不再用照片数量 extra.length');
  assert(/feed-cover-n/.test(noComment), '还有角标（feed-cover-n）');
  /* 渲染结果里：coin 图标 + 押金金额 */
  const badge = (sq.match(/<div class="feed-cover-n">[\s\S]*?<\/div>/) || [''])[0];
  assert(/coin|<svg/.test(badge), '角标带图标');
  assert(/元/.test(badge), '角标带「元」字（押金金额）');
  assert(/\d+ 元/.test(badge), '角标是押金金额（数字 + 元）');
  assert(!/首次免费/.test(badge), '非 0 元押金局显示具体金额');
}

section('4. 回归：候选池排序 / 顶部说明块 仍然对');
{
  assert(/data-act="setPoolSort"/.test(PAGES.witnessPool()), '排序控件还在');
  const html = PAGES.witnessPool().replace(/<!--[\s\S]*?-->/g, '');
  assert(!/我的位置/.test(html), '「我的位置」仍然没有');
  assert(!/申请进入候选池/.test(html), '「申请进入候选池」仍然没有');
}

/* ------------------------------------------------------------------ */
console.log('\n' + (fails ? `FAILED (${fails})` : 'ALL PASSED'));
process.exit(fails ? 1 : 0);
