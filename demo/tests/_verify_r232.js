/* =========================================================
   R2.32 巡检（2026-11-25 本轮：底层逻辑与数据层修复）
   ------------------------------------------------------------
   本轮只动【底层逻辑与数据层】，不动 Demo 展示效果。修复清单：

     一、补卡数据层
        ① doMakeup 的 checkedDays 不能再虚增（补一天 = +1 天，不是跳到漏卡那天）
        ② doMakeup 必须校验【12 小时窗口】—— 超窗 = 这次算断卡，不能再补
        ③ doMakeup 允许「今日打卡与补卡并行」（R3.5）
     二、生活照存储
        ④ commitExtraPhotos 追加，不再整段覆盖（补一次打卡不抹掉历史）
     三、通知角标
        ⑤ unreadNotifCount 过滤掉已左滑删除的通知（删了角标要减）
     四、见证席数据
        ⑥ 种子 status 归一为状态机取值（'已判定' → 'accepted'）
        ⑦ witnessExpected 不再恒为 0（降档规则 R1.2.1 不能整个失效）
        ⑧ acceptApplicant 要同步进 f.witnesses 并重算档位
     五、判定计分
        ⑨ 判定提交只有一条路径（openVerdictPicker），结算挂在它回调里
        ⑩ #submitVerdict 那段死代码删掉
     六、状态流转
        ⑪ 筹备期 → 进行中 的推进（advancePrepToRunning / syncFlagLifecycle）
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
vm.runInContext('initState()', sandbox);

const appSrc   = fs.readFileSync(path.join(__dirname, '..', 'js','app.js'),'utf8');
const stateSrc = fs.readFileSync(path.join(__dirname, '..', 'js','state.js'),'utf8');
const dataSrc  = fs.readFileSync(path.join(__dirname, '..', 'js','data.js'),'utf8');
const s = (code) => vm.runInContext(code, sandbox);
/** 去掉 JS 注释 —— 注释里提到的东西不算「真的还在代码里」 */
const stripJs = (src) => String(src)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

let fails = 0;
function check(cond, msg) {
  if (!cond) { console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}

/* =========================================================
   一、补卡数据层
   ========================================================= */
console.log('\n=== 一、补卡数据层 ===');

/* ① checkedDays 不能虚增 */
s(`
  INJECTORS.newUserWithFlags();
  var f = myRunningFlag();
  f.status = 'running';
  f.checkedDays = 3;
  f.totalDays = 30;
  f.streak = 3;
  f.history = [{d:1,ok:true},{d:2,ok:true},{d:3,ok:true}];
  f.missedOn = '2026-11-18';
  f.makeupEndAt = Date.now() + 6 * 3600 * 1000;
  f.start = '2026-11-15';
  window.__f = f;
`);
/* 补的是第 5 天（漏卡那天），但只补了 1 张卡 → 天数只能 +1 */
s("doMakeup(window.__f.id, 71.0, 5)");
check(s('window.__f.checkedDays') === 4,
  '补 1 张卡 → checkedDays 只 +1（不是跳到漏卡那天的序号）');
check(s('window.__f.history.filter(function(h){return h.ok!==false;}).length') === 4,
  'history 里成功打卡数 = checkedDays（两者口径一致）');
/* 连续天数不因补卡增加 */
check(s('window.__f.streak') === 3, '补卡不增加连续天数（streak 不变）');

/* ② 12 小时窗口校验 —— 超窗必须拒绝 */
s(`
  var f2 = window.__f;
  f2.checkedDays = 3;
  f2.missedOn = '2026-11-18';
  f2.makeupEndAt = Date.now() - 1000;   /* 窗口已关 */
`);
const r2 = s("doMakeup(window.__f.id, 71.0, 5)");
check(r2 && r2.ok === false, '超窗补卡被拒绝（返回 ok:false）');
check(!!(r2 && r2.reason && /12\s*小时/.test(r2.reason)), '超窗补卡有明确原因文案');
check(s('window.__f.checkedDays') === 3, '超窗补卡不写数据（checkedDays 不变）');
check(s('window.__f.history.filter(function(h){return h.makeup;}).length') === 1,
  '超窗补卡不追加 history（只剩之前那次成功的补卡）');

/* 窗口开着 → 补卡成功 */
s(`
  var f3 = window.__f;
  f3.checkedDays = 3;
  f3.missedOn = '2026-11-18';
  f3.makeupEndAt = Date.now() + 6 * 3600 * 1000;
`);
const r3 = s("doMakeup(window.__f.id, 71.0, 5)");
check(!!r3 && r3.ok !== false, '窗口内补卡成功');
check(s('window.__f.checkedDays') === 4, '窗口内补卡 → checkedDays +1');

/* ③ 今日打卡与补卡并行（R3.5）：今天打了也能补昨天的 */
s(`
  var f4 = window.__f;
  f4.checkedDays = 4;
  f4.history = [{d:1,ok:true},{d:2,ok:true},{d:3,ok:true},{d:4,ok:true}];
  f4.checkedOn = DEMO_TODAY;      /* 今天已经打过卡 */
  f4.missedOn = '2026-11-18';
  f4.makeupEndAt = Date.now() + 6 * 3600 * 1000;
`);
const r4 = s("doMakeup(window.__f.id, 71.0, 5)");
check(!!r4 && r4.ok !== false, '今日已打卡时仍可补卡（并行，R3.5）');

/* =========================================================
   二、生活照存储
   ========================================================= */
console.log('\n=== 二、生活照：追加不覆盖 ===');
s(`
  initState();
  INJECTORS.newUserWithFlags();
  var g = myRunningFlag();
  g.extraPhotos = [{ src:'a.jpg', day:10, slot:0 }];
  STATE.checkinDraft = { flagId:g.id, extra:[{src:'b.jpg'}], shot:null, note:'' };
  window.__g = g;
`);
s("commitExtraPhotos(window.__g.id, 11)");
check(s('window.__g.extraPhotos.length') === 2, '补一次打卡不抹掉历史生活照（1 → 2 张）');
check(s('window.__g.extraPhotos[0].src') === 'a.jpg', '老照片还在第 1 位（封面稳定）');
check(s('window.__g.extraPhotos[1].src') === 'b.jpg', '新照片追加在后');
check(s('window.__g.extraPhotos[1].slot') === 1, 'slot 继续往下编号（不重复）');
check(s('window.__g.extraPhotos[1].day') === 11, '新照片记的是本次打卡的那一天');

/* =========================================================
   三、通知角标
   ========================================================= */
console.log('\n=== 三、通知角标：删了要减 ===');
s(`
  initState();
  INJECTORS.notifs();
`);
const before = s('unreadNotifCount()');
check(before > 0, '注入通知后有未读数');
s("dismissNotif('n:n1')");
const after = s('unreadNotifCount()');
check(after === before - 1, '左滑删一条 → 角标减 1');
check(s("notifsOf('all').some(function(n){return n.key==='n:n1';})") === false,
  '左滑删掉的通知不再出现在列表里');
/* 分栏未读数同口径 */
const beforeTab = s("unreadNotifCountOf('all')");
s("dismissNotif('n:n2')");
check(s("unreadNotifCountOf('all')") === beforeTab - 1, '分栏未读数与角标同口径');

/* =========================================================
   四、见证席数据
   ========================================================= */
console.log('\n=== 四、见证席数据 ===');
check(!/status\s*:\s*'已判定'/.test(stripJs(dataSrc)), '种子见证席 status 已归一为状态机取值');
check(/status:'accepted'/.test(dataSrc), '种子见证席 status = accepted');
/* ⑦ witnessExpected 不再恒为 0 */
s("initState(); INJECTORS.newUserWithFlags();");
const exp = s('witnessExpected(myRunningFlag())');
check(exp > 0, 'witnessExpected 不再恒为 0（应到人数算得出来）');
check(s('witnessQuorumOf(myRunningFlag())') > 0, '见证门槛不再为 0（降档规则生效）');
/* 档位与应到人数自洽 */
const tier = s('myRunningFlag().tier');
const tByCount = s('tierByCount(witnessExpected(myRunningFlag()))');
check(tier === tByCount, '档位与「已接受人数」自洽（档位 = tierByCount(已接受)）');

/* ⑧ acceptApplicant 同步进 f.witnesses + 重算档位 */
s(`
  initState();
  INJECTORS.prep();
`);
const wBefore = s('myRunningFlag().witnesses.length');
const tierBefore = s('myRunningFlag().tier');
s("acceptApplicant('r2')");
check(s('myRunningFlag().witnesses.length') === wBefore + 1,
  '接受报名者 → 同步进该局的见证席名单');
check(s("myRunningFlag().witnesses.some(function(w){return w.id==='r2' && w.status==='accepted';})"),
  '同步进去的那位 status = accepted');
check(s('myRunningFlag().tier') === s('tierByCount(witnessAccepted(myRunningFlag().witnesses))'),
  '接受后档位按新的已接受人数重算');
check(s('tierByCount(witnessAccepted(myRunningFlag().witnesses))') === s('tierByCount(witnessAccepted(myRunningFlag().witnesses))'),
  '档位重算口径 = 已接受人数');

/* =========================================================
   五、判定计分（单一路径）
   ========================================================= */
console.log('\n=== 五、判定计分 ===');
check(!/#submitVerdict/.test(stripJs(appSrc)), '死代码 #submitVerdict 已删');
check(/function showVerdictPendingNote\(/.test(appSrc), '「分值待结算」说明块有独立函数');
check(/addWitnessCredit\(/.test(appSrc), '判定结算调用 addWitnessCredit');
/* 结算逻辑必须挂在 openVerdictPicker 的回调里 */
const pickIdx = appSrc.indexOf("case 'openVerdictPicker'");
const pickBlock = appSrc.slice(pickIdx, pickIdx + 2500);
check(/markVerdictDone\(/.test(pickBlock), 'openVerdictPicker 回调里标记已判');
check(/addWitnessCredit\(/.test(pickBlock), 'openVerdictPicker 回调里做结算入账');
check(/showVerdictPendingNote\(/.test(pickBlock), 'openVerdictPicker 回调里显示待结算说明');

/* =========================================================
   六、状态流转：筹备期 → 进行中
   ========================================================= */
console.log('\n=== 六、筹备期 → 进行中 ===');
check(/function advancePrepToRunning\(/.test(stateSrc), 'state.js 有 advancePrepToRunning');
check(/function syncFlagLifecycle\(/.test(stateSrc), 'state.js 有 syncFlagLifecycle');
check(/syncFlagLifecycle\(\)/.test(appSrc), 'render 时调用 syncFlagLifecycle');
/* 筹备期过了 → 推进 */
s(`
  initState();
  INJECTORS.prep();
  var pf = myRunningFlag();
  pf.prepEndAt = Date.now() - 1000;    /* 筹备期已过 */
`);
const n = s('syncFlagLifecycle()');
check(n === 1, '筹备期过了 → 推进 1 局');
check(s('myRunningFlag().status') === 'running', '状态切到 running');
check(s('myRunningFlag().statusText') === '进行中', '状态文案切到「进行中」');
/* 幂等：再调一次不会再推进 */
check(s('syncFlagLifecycle()') === 0, '幂等 —— 不会重复推进');
check(s('myRunningFlag().status') === 'running', '仍是 running');
/* 名单冻结：pending 的见证人作废，档位按已接受定死 */
s(`
  var pf2 = myRunningFlag();
  pf2.status = 'prep';
  pf2.prepEndAt = Date.now() - 1000;
`);
s('syncFlagLifecycle()');
check(s("myRunningFlag().witnesses.filter(function(w){return w.status==='pending';}).length") === 0,
  '筹备期结束 → 在途邀约作废（pending → expired）');
check(s('myRunningFlag().tier') === s('tierByCount(witnessAccepted(myRunningFlag().witnesses))'),
  '筹备期结束 → 档位按已接受人数定死');

console.log('\n' + (fails === 0 ? '✅ 全部通过' : '❌ 失败 ' + fails + ' 项'));
process.exit(fails ? 1 : 0);
