/* =========================================================
   R2.29 巡检（2026-11-24 第三轮新增）
   ------------------------------------------------------------
   本轮用户口径八部分：
     一、筹备期首页「我的 Flag」卡片 → 仅作展示，不可点击
     二、筹备期・见证席召集令（半框）
        ① 点头像跳主页时，半框必须关闭
        ② 从主页返回 → 回到「见证席召集令（已发布）」半框
     三、筹备期・见证席候选池
        ① 点头像或名字 → 进人主页
        ② 从主页返回 → 回到候选池页面
     四、照片占位（本人页 & 他人详情页通用）
        无照片位置：不写「空位」文字、不用灰底，透明底 + 线框
     五、本人 Flag 详情页
        ① 有留言正常展示
        ② 删除「30 天把体脂从 26% 降到 23%」目标描述句
        ③ 姓名 / 头像等小标签放到页面上方，不与下方卡片混排
     六、打卡页文案
        ① 删「可选 —— 打卡照是物证，这句话是你的心情」
        ② 补卡提示只留「12 小时内可以补上昨天的卡」
     七、首页・今日已打卡
        去掉「查看」按钮、卡片不可点击，只作常驻展示框
     八、首页通知入口
        删掉右上角铃铛按钮
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

const strip = s => String(s).replace(/<!--[\s\S]*?-->/g, '');

let fails = 0;
function check(cond, msg) {
  if (!cond) { console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}

/* =========================================================
   一、筹备期首页「我的 Flag」卡片不可点击
   ========================================================= */
console.log('\n=== 一、筹备期首页「我的 Flag」卡片不可点击 ===');
/* 用注入器造一个筹备期的局 */
vm.runInContext('INJECTORS.prep()', sandbox);
const prepHome = strip(PAGES.home());check(/prep-hero prep-hero-static/.test(prepHome), '筹备卡带 .prep-hero-static');
check(/data-no-nav="1"/.test(prepHome), '筹备卡带 data-no-nav="1"（事件层拦截）');
check(!/class="hero prep-hero" data-go="created"/.test(prepHome), '筹备卡上不再有 data-go 跳转');
check(/查看我的立据/.test(prepHome), '「查看我的立据」按钮仍在（真正的入口）');
check(/从见证席候选池选/.test(prepHome), '「从见证席候选池选」按钮仍在');
check(/\.prep-hero\.prep-hero-static\{[^}]*cursor:default/.test(cssSrc), 'CSS：筹备卡不是手型光标');
/* 拦截必须排在 data-go 之前 */
const guardIdx = appSrc.indexOf("if (e.target.closest('[data-no-nav]'))");
const goIdx   = appSrc.indexOf("const goEl = e.target.closest('[data-go]')");
check(guardIdx > 0 && goIdx > 0 && guardIdx < goIdx, 'data-no-nav 拦截在 data-go 跳转之前');

/* =========================================================
   二、召集令半框：跳主页时关闭 + 返回落点
   ========================================================= */
console.log('\n=== 二、召集令半框跳主页 ===');
check(/data-from="recruit"/.test(appSrc), '半屏里有 data-from="recruit" 的头像/名字');
check(/pendingSheetBack === 'recruit'/.test(appSrc), 'goBack 处理 pendingSheetBack === "recruit"');
check(/if \(goEl\.dataset\.from === 'recruit'\)/.test(appSrc), '点击分发器记录 pendingSheetBack');
check(/if \(goEl\.dataset\.from\) closeSheet\(\);/.test(appSrc),
  '从半屏跳走时先 closeSheet()（半框必须关闭）');
/* 关闭必须在 render 之前 */
const closeIdx = appSrc.indexOf('if (goEl.dataset.from) closeSheet();');
const renderIdx = appSrc.indexOf('render(target, id, { day });');
check(closeIdx > 0 && renderIdx > 0 && closeIdx < renderIdx, '关半屏发生在跳转渲染之前');
check(!/function openApplicantSheet/.test(appSrc), '旧的报名者详情半屏不存在');

/* =========================================================
   三、候选池跳主页 + 返回落点
   ========================================================= */
console.log('\n=== 三、候选池跳主页 ===');
const pool = strip(PAGES.witnessPool());
check(/data-go="userProfile"[^>]*data-from="pool"/.test(pool), '候选池头像/名字 → userProfile + data-from="pool"');
check(!/data-act="viewPoolCandidate"/.test(pool), '不再有 viewPoolCandidate 入口');
check(!/function openPoolCandidateSheet/.test(appSrc), 'openPoolCandidateSheet() 已删除');
check(!/case 'viewPoolCandidate'/.test(appSrc), 'viewPoolCandidate 动作已删除');
check(/pendingSheetBack === 'pool'/.test(appSrc), 'goBack 处理 pendingSheetBack === "pool"');
check(/render\('witnessPool'/.test(appSrc), '返回时重新渲染候选池页');

/* =========================================================
   四、照片占位规则
   ========================================================= */
console.log('\n=== 四、照片占位规则 ===');
/* 换成「有一个进行中的局」的状态，才能测本人视角 */
vm.runInContext('INJECTORS.newUserWithFlags()', sandbox);
const own = strip(PAGES.flagDetail('f_own'));
check(/tr-empty/.test(own), '本人视角保留空位格');
check(!/空位/.test(own), '空位格里不写「空位」文字');
check(!/<span class="tr-empty-t">/.test(pagesSrc), '代码里不再有 tr-empty-t 文字节点');
check(/\.tr-cell\.tr-empty\{[^}]*background:transparent/.test(cssSrc), 'CSS：空位是透明底');
check(/\.tr-cell\.tr-empty\{[^}]*border:1px dashed/.test(cssSrc), 'CSS：空位是虚线框');
check(!/\.tr-cell\.tr-empty\{[^}]*repeating-linear-gradient/.test(cssSrc), 'CSS：斜纹灰底已去掉');
/* 见证席面板 + 异议页的占位也统一 */
check(!/tr-empty-t/.test(pagesSrc), '全站不再有「空位」文字');

/* =========================================================
   五、本人 Flag 详情页
   ========================================================= */
console.log('\n=== 五、本人 Flag 详情页 ===');
const other = strip(PAGES.flagDetail('f_3'));
check(!/fd-title/.test(own), '本人视角不展示目标描述句（.fd-title）');
check(/fd-title/.test(other), '他人视角仍然展示目标描述句');
check(!/体脂从 26% 降到 23%/.test(own), '本人视角不出现目标描述文字');
check(/fd-mine-id/.test(own), '本人视角有独立的小标签块（.fd-mine-id）');
check(!/fd-mine-id/.test(other), '他人视角不用这个块（它在导航栏身份条里）');
/* 位置：fd-mine-id 必须在 .card 之前 */
const iMine = own.indexOf('fd-mine-id');
const iCard = own.indexOf('<div class="card">');
check(iMine > 0 && iCard > 0 && iMine < iCard, '小标签块在目标卡【之前】（页面上方，不混排）');
check(/\.fd-mine-id\{[^}]*display:flex/.test(cssSrc), 'CSS：.fd-mine-id 是独立的横条');
/* 留言 */
check(/msg-ticker|msg-entry/.test(own), '本人视角留言正常展示');
check(/data-act="openMsgSheet"/.test(own), '本人视角能点开留言半屏');

/* =========================================================
   六、打卡页文案
   ========================================================= */
console.log('\n=== 六、打卡页文案 ===');
const ci = strip(vm.runInContext('PAGES.checkin(STATE.myFlags.find(f=>f.status===\'running\').id)', sandbox));
check(!/打卡照是物证，这句话是你的心情/.test(ci), '删掉「可选 —— 打卡照是物证，这句话是你的心情」');
/* 那句话只允许出现在【注释里】（说明它被删了），不允许出现在渲染结果里 */
check(!/>可选 —— 打卡照是物证/.test(pagesSrc) && !/field-hint">可选 —— 打卡照是物证/.test(pagesSrc),
  '源码里也没有这句（只存在于注释中）');
check(/noteCount/.test(ci), '字数计数器还在（输入框右下角）');
/* ⚠️ 2026-11-24（R2.30）：补卡提示小卡片**整张删掉**（用户口径 Part 二①），
   而且补卡**复用今日打卡页**（Part 二②）——
   所以打卡页里不应该再出现「昨天忘了打卡」那张卡。
   —— 补卡入口改在【首页的补卡提醒卡】上（见 R2.30 那一节的断言）。 */
check(!/昨天忘了打卡/.test(ci), '补卡提醒块已删掉');
check(!/12 小时内/.test(ci), '打卡页不再有「12 小时内」补卡提示');
check(!/不算断卡/.test(ci), '删掉「日历上补不算断卡」');
check(!/连续天数不增加/.test(ci), '删掉「连续天数不增加」');
check(!/还允许断 \d+ 次/.test(ci), '删掉「这个周期还允许断 N 次」');
/* 规则细节仍然在 ? 弹层里（info('breakRules')）—— 只是不在打卡页正文里 */
check(/info\('breakRules'/.test(pagesSrc) || /info\('breakRules'/.test(appSrc),
  '规则细节在 ? 弹层（breakRules）');

/* =========================================================
   七、首页「今日已打卡」
   ========================================================= */
console.log('\n=== 七、首页「今日已打卡」 ===');
vm.runInContext(`
  (function(){ var f = STATE.myFlags.find(x=>x.status==='running'); f.checkedOn = DEMO_TODAY; })();
`, sandbox);
const homeChecked = strip(PAGES.home());
check(/今天已打卡/.test(homeChecked), '显示「今天已打卡」');
check(!/查看 ›/.test(homeChecked), '不再有「查看 ›」入口');
/* 已打卡那张卡上没有 data-go="checkin" */
const cardDone = homeChecked.match(/今天已打卡[\s\S]{0,400}/);
const beforeCard = homeChecked.slice(0, homeChecked.indexOf('今天已打卡'));
check(!/data-go="checkin"[^>]*>[\s\S]{0,400}今天已打卡/.test(beforeCard.slice(-400)),
  '「今天已打卡」这张卡上没有 data-go="checkin" 跳转');
/* 未打卡那张卡仍然可点 */
vm.runInContext(`
  (function(){ var f = STATE.myFlags.find(x=>x.status==='running'); f.checkedOn = null; })();
`, sandbox);
const homeTodo = strip(PAGES.home());
check(/今天还没打卡/.test(homeTodo), '未打卡时显示「今天还没打卡」');
check(/data-go="checkin"/.test(homeTodo), '未打卡那张卡仍然可点（去打卡）');
check(/去打卡 ›/.test(homeTodo), '未打卡时有「去打卡 ›」入口');

/* =========================================================
   八、首页通知入口（铃铛）
   ========================================================= */
console.log('\n=== 八、首页铃铛按钮 ===');
check(!/data-go="notifs"/.test(prepHome), '筹备期首页没有铃铛');
check(!/data-go="notifs"/.test(homeTodo), '进行中首页没有铃铛');
check(!/ICON\.bell/.test(pagesSrc), 'pages.js 里不再有铃铛图标');
check(/data-info="product"/.test(homeTodo), '「?」按钮保留');

console.log(fails === 0 ? '\n✅ 全部通过' : `\n❌ ${fails} 项失败`);
process.exit(fails === 0 ? 0 : 1);
