/* 校验：见证席规则简化 + 我的页重构（2026-11-24 本轮 7 条用户口径） */
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
const ROUTES = vm.runInContext('ROUTES', sandbox);
const INFO  = vm.runInContext('INFO', sandbox);
const run  = (code) => vm.runInContext(code, sandbox);

let fails = 0;
function assert(cond, msg){
  if (!cond) { console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}

console.log('\n=== ① 取消「退出见证」 ===');
assert(!Object.keys(ROUTES).some(k => /witnessQuit/.test(k)), '路由表里没有「退出见证」');
assert(!Object.keys(PAGES).some(k => /witnessQuit/.test(k)), '页面表里没有「退出见证」页');
run("initState()");
run("INJECTORS.witness()");
const verdictHtml = PAGES.verdict();
const verdictVisible = verdictHtml.replace(/<!--[\s\S]*?-->/g, '');
assert(!/退出见证/.test(verdictVisible), '见证席面板上没有「退出见证」按钮');
assert(!/data-go="witnessQuit"/.test(verdictVisible), '见证席面板上没有跳转退出页的入口');
const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js','app.js'),'utf8');
const pagesSrc = fs.readFileSync(path.join(__dirname, '..', 'js','pages.js'),'utf8');
assert(!/case 'quitWitness'/.test(appSrc), 'app.js 里没有 quitWitness 动作');
assert(!/'quitWitness'/.test(appSrc), 'app.js 的登录门槛表里没有 quitWitness');
/* 不允许中途加入 —— 招募列表里的局一律是「筹备期冻结前」的 */
const recruitSrc = fs.readFileSync(path.join(__dirname, '..', 'js','data.js'),'utf8');
assert(/recruiting\s*=\s*true/.test(recruitSrc), 'data.js 里用 recruiting 字段标记「正在招募」');

console.log('\n=== ② 首页删掉 ? 号 ===');
run("initState()");
const homeEmpty = PAGES.home();
assert(!/empty-hint/.test(homeEmpty), '首页空态没有问号提示行');
assert(!/data-info="newUser"/.test(homeEmpty), '首页空态没有 newUser 问号');
assert(!/data-info="returningUser"/.test(homeEmpty), '首页空态没有 returningUser 问号');
assert(!INFO.returningUser, 'returningUser 弹层已删除（没有入口了）');
assert(/立我的第一个 Flag/.test(homeEmpty), '「立我的第一个 Flag」按钮还在');

console.log('\n=== ③ 条件框居中 + 返回不留残影 ===');
const css = fs.readFileSync(path.join(__dirname, '..', 'css','app.css'),'utf8');
const titleRule = css.match(/\.wa-req-title\{[^}]*\}/);
const subRule   = css.match(/\.wa-req-sub\{[^}]*\}/);
assert(!!titleRule && /text-align:center/.test(titleRule[0]), '「累计互动 N 次」标题居中');
assert(!!subRule && /text-align:center/.test(subRule[0]), '「点赞或留言都算 1 次」副标题居中');
/* render() 换页前先关弹窗 */
assert(/if \(lastDialog\) closeDialog\(\);/.test(appSrc), 'render() 换页时先关掉还开着的弹窗');
const dialogSrc = fs.readFileSync(path.join(__dirname, '..', 'js','app.js'),'utf8');
assert(/#screen'\)\.appendChild\(el\)/.test(dialogSrc) || /#screen/.test(dialogSrc),
  '弹窗挂在 #screen 上（所以换页必须显式关掉）');

console.log('\n=== ④ 见证席面板不再放招募列表（改走广场 + 通知）===');
run("initState()");
run("INJECTORS.witness()");
const v2 = PAGES.verdict();
/* ⚠️ 2026-11-24（本轮）：见证席面板里的【正在招募见证席】整块删掉了 ——
   用户口径：「见证席面板里面，正在招募见证席不合理的，
     如果其他用户点击你，希望你能做他的见证，把这个消息放到通知-判定邀请里就行了。」
   —— 招募的【发现】在广场「招募中」视图；【收到】走通知「判定·邀请」栏。 */
assert(!/正在招募见证席/.test(v2), '见证席面板没有「正在招募见证席」区块');
assert(!/data-act="applyJoinWitness"/.test(v2), '见证席面板没有「我想参加」按钮');
const recruitCount = run("recruitingFlags().length");
assert(recruitCount >= 3, `有 ${recruitCount} 个局在招募（够测上限）`);
const JOIN_MAX = run("WITNESS_JOIN_MAX");
assert(JOIN_MAX === 3, '单次最多申请 3 个（WITNESS_JOIN_MAX = 3）');
/* 实际跑一遍申请逻辑 */
run("initState()");
const ids = run("recruitingFlags().map(f => f.id)");
const results = ids.map(id => run(`applyJoinWitness(${JSON.stringify(id)})`));
assert(results[0] === 'ok' && results[1] === 'ok' && results[2] === 'ok', '前 3 个申请成功');
assert(results[3] === 'max', '第 4 个被拦（返回 max）');
assert(run("witnessApplyingCount()") === 3, '只记住了 3 个申请');
assert(run(`applyJoinWitness(${JSON.stringify(ids[0])})`) === 'dup', '重复申请被识别');

console.log('\n=== ⑤ 「我的」页见证席面板入口 = 招募列表 ===');
run("initState()");
const profile1 = PAGES.profile();
assert(/个局正在招募见证席/.test(profile1), '入口副标题是「N 个局正在招募见证席」');
assert(!/个节点待判定/.test(profile1.replace(/<!--[\s\S]*?-->/g, '')), '入口不再写「待判定」（可见内容里）');

console.log('\n=== ⑥ 磁贴整块删掉（2026-11-24 用户口径） ===');
run("initState()");
run("INJECTORS.newUserWithFlags()");
const profile2 = PAGES.profile();
/* ⚠️ 注意：「进行中」这三个字在下面的「我的记录」列表里还会出现（那是每行的状态标签），
   所以这里不能全页搜这三个字 —— 要精确地找【磁贴】这一种结构。 */
assert(!/class="tile"/.test(profile2), '「我的」页没有磁贴（.tile）');
assert(!/class="tiles/.test(profile2), '「我的」页没有磁贴块（.tiles）');
assert(!/class="t-l">进行中/.test(profile2), '「我的」页没有「进行中」磁贴');
assert(!/class="t-l">已达成/.test(profile2), '「我的」页没有「已达成」磁贴');
assert(!/class="t-l">没做成/.test(profile2), '「我的」页没有「没做成」磁贴');

console.log('\n=== ⑦ 我的页顶部资料扩展 + 编辑 ===');
run("initState()");
const profile3 = PAGES.profile();
/* ⚠️ 2026-11-24 用户口径（最终版，参照参考图）：
   左头像 + 右信息三行（名字 / ID:A7K3M9 浅灰 / 性别·年龄·省份·加入亏了XX天）+ 底下四格（点赞 / 留言 / 关注 / 见证）。 */
assert(/class="card me-card"/.test(profile3), '资料卡是横排布局（.me-card）');
assert(/class="me-top"/.test(profile3) && /class="me-ava[^"]*"/.test(profile3), '左边是头像');
assert(/class="me-info"/.test(profile3) && /class="me-name"/.test(profile3), '右边是名字');
assert(!/ME\.phone/.test(profile3), '手机号码不展示');
/* 三行结构：第一行名字 / 第二行 ID / 第三行属性 */
assert(/class="me-name">/.test(profile3), '第一行是名字（.me-name）');
assert(/class="me-id">ID：/.test(profile3), '第二行是「ID：A7K3M9」（.me-id）');
assert(/class="me-sub"/.test(profile3), '第三行是属性（.me-sub）');
const subPart = profile3.slice(profile3.indexOf('class="me-sub'), profile3.indexOf('class="me-bio'));
assert(/男/.test(subPart), '第三行有性别');
assert(/32岁/.test(subPart), '第三行有年龄');
assert(/浙江/.test(subPart), '第三行有省份');
assert(/加入亏了\s*\d+\s*天/.test(subPart), '第三行有「加入亏了 XX 天」');
assert(!/class="me-tags"/.test(profile3), '不再用小标签行承载资料');
/* 三格社交数据 */
const statsPart = profile3.slice(profile3.indexOf('class="me-stats'), profile3.indexOf('class="section'));
assert(/me-stat-v/.test(statsPart), '有三格社交数据');
/* ⚠️ 2026-11-24（R2.31 Part 三①）：「点赞」改叫「累计点赞」 */
assert(/>累计点赞</.test(statsPart), '有「累计点赞」');
assert(!/>点赞</.test(statsPart), '没有单独的「点赞」（改成「累计点赞」）');
assert(/>关注我</.test(statsPart), '有「关注我」（被关注的人数）');
assert(/>我见证过</.test(statsPart), '有「我见证过」');
assert(!/>留言</.test(statsPart), '没有「留言」（2026-11-24 用户口径删掉）');
assert(/me-stats cols3/.test(profile3), '社交数据是三格（.cols3）');
assert(/me-bio/.test(profile3), '有个性签名');
assert(/data-act="editProfile"/.test(profile3), '右上角有「编辑资料」入口');
/* ⚠️ 2026-11-24 用户口径：「编辑资料几个字不需要用文字，用一个修改的符号表示就行了。」 */
assert(!/>编辑资料</.test(profile3), '导航栏不再有「编辑资料」文字');
assert(/nav-btn icon-only/.test(profile3), '导航栏是纯图标按钮（.icon-only）');
assert(/nav-btn icon-only"[^>]*>\$\{ic\("pencil"\)\}/.test(pagesSrc), '图标是铅笔（修改符号）');
/* 状态层 */
const p = run("myProfile()");
assert(p.userCode === 'A7K3M9', 'myProfile() 返回 ID号');
assert(p.age === 32, 'myProfile() 返回年龄');
assert(p.gender === '男', 'myProfile() 返回性别');
assert(p.province === '浙江', 'myProfile() 返回省份');
assert(p.joinedAt === '2026-09-08', 'myProfile() 返回加入时间');
run("updateMyProfile({ province: '' })");
assert(run("myProfile().province") === '中国', '省份不填默认「中国」');
run("updateMyProfile({ age: 35, gender: '女', province: '广东', bio: '新签名' })");
const p2 = run("myProfile()");
assert(p2.age === 35 && p2.gender === '女' && p2.province === '广东' && p2.bio === '新签名', 'updateMyProfile() 能改这几项');
assert(p2.userCode === 'A7K3M9' && p2.joinedAt === '2026-09-08', 'ID号与加入时间不可改');
/* ⚠️ 2026-11-24（R2.31 Part 二）：编辑资料改成【全屏页】——
   —— 不再有居中小框（openEditProfileDialog / data-ep="yes"），
      改成 PAGES.editProfile 全屏页 + data-act="saveProfile"。
   —— 而且【「注册即固定不可修改」那句提示删掉了】（Part 二②）。 */
assert(!/openEditProfileDialog/.test(appSrc), 'app.js 里没有「编辑资料」小框函数了');
assert(!/data-ep="yes"/.test(appSrc), '没有小框的保存按钮');
assert(/editProfile/.test(appSrc), 'app.js 里有 editProfile 路由 / 跳转');
assert(/case 'saveProfile'/.test(appSrc), 'app.js 里有 saveProfile 动作');
assert(ROUTES.editProfile && ROUTES.editProfile.r === 'editProfile', '路由表里有 editProfile');
assert(typeof PAGES.editProfile === 'function', '页面表里有 editProfile 全屏页');
const epHtml = PAGES.editProfile();
assert(/id="epGender"/.test(epHtml), '全屏编辑页有性别选项');
assert(/id="epAge"/.test(epHtml) && /id="epBio"/.test(epHtml) && /id="epProv"/.test(epHtml),
  '全屏编辑页有年龄 / 签名 / 省份');
assert(/data-act="saveProfile"/.test(epHtml), '全屏编辑页有保存按钮');
/* ⚠️ Part 二②：删掉「注册即固定 —— 不可修改。」/「你的唯一编号 —— 不可修改。」 */
assert(!/不可修改/.test(epHtml), '编辑页不再有「不可修改」那句提示');
assert(!/注册即固定/.test(epHtml), '编辑页不再有「注册即固定」那句提示');

console.log('\n=== ⑨ 「Ta 的主页」与「我的」页同一套资料卡（2026-11-24 用户口径） ===');
const upPage = PAGES.userProfile('小美');
assert(/class="card me-card"/.test(upPage), '「Ta 的主页」用同一张资料卡（.me-card）');
assert(/class="me-top"/.test(upPage) && /class="me-ava"/.test(upPage), '左边是头像');
assert(/class="me-id">ID：/.test(upPage), '第二行是「ID：xxx」');
assert(/class="me-sub"/.test(upPage), '第三行是属性（.me-sub）');
assert(/加入亏了\s*\d+\s*天/.test(upPage), '有「加入亏了 XX 天」');
/* ⚠️ 2026-11-24 用户口径：「删掉进行中、已达成、没做成，但需要保留 + 关注按钮」 */
assert(!/class="tile/.test(upPage), '「Ta 的主页」没有磁贴（进行中/已达成/没做成）');
assert(/data-act="doFollow"/.test(upPage), '「Ta 的主页」保留关注按钮');
assert(/class="me-follow"/.test(upPage), '关注按钮在资料卡内（.me-follow）');
/* 三格社交数据，口径与「我的」页一致 */
const upStats = upPage.slice(upPage.indexOf('class="me-stats'), upPage.indexOf('class="me-follow'));
assert(/me-stats cols3/.test(upPage), '「Ta 的主页」也是三格');
/* ⚠️ 2026-11-24（R2.31 Part 三①）：「点赞」改叫「累计点赞」 */
assert(/>累计点赞</.test(upStats) && />关注我</.test(upStats) && />我见证过</.test(upStats),
  '三格是「累计点赞 / 关注我 / 我见证过」');
assert(!/>点赞</.test(upStats), '没有单独的「点赞」');
assert(!/>留言</.test(upStats), '没有「留言」');
/* 数据层 */
const upData = run("userProfile('小美')");
assert(!!upData.userCode && upData.userCode.length >= 5, 'userProfile() 返回 ID号');
assert(upData.age > 0 && upData.gender && upData.province, 'userProfile() 返回年龄/性别/省份');
assert(upData.daysInApp > 0, 'userProfile() 返回「加入亏了 XX 天」的天数');
assert(run("userLikeCount('小美')") >= 0, 'userLikeCount() 可用');
assert(run("userFollowerCount('小美')") >= 0, 'userFollowerCount() 可用');
assert(run("userWitnessCount('小美')") >= 0, 'userWitnessCount() 可用');

console.log('\n=== ⑧ 布局样式 ===');
assert(/\.me-id\s*\{/.test(css), 'CSS 有 .me-id（ID号浅灰行）');
assert(/\.me-sub\s*\{/.test(css), 'CSS 有 .me-sub（第三行属性）');
assert(/\.me-top\s*\{/.test(css), 'CSS 有 .me-top（横排布局）');
assert(/\.me-stats\s*\{/.test(css), 'CSS 有 .me-stats（社交数据）');
assert(/\.me-stats\.cols3/.test(css), 'CSS 有 .me-stats.cols3（三格）');
assert(!/\.me-facts\s*\{/.test(css), 'CSS 里旧的 .me-facts 网格已删');
/* ⚠️ 2026-11-24（R2.31 Part 二）：编辑资料的全屏页样式；
   旧的小框样式（.dlg-edit）已删。 */
assert(/\.edit-profile-card/.test(css), 'CSS 有编辑资料全屏页样式（.edit-profile-card）');
assert(!/\.dialog\.dlg-edit/.test(css), 'CSS 里旧的小框样式（.dlg-edit）已删');
assert(/\.nav-btn\.icon-only/.test(css), 'CSS 有纯图标导航按钮');
assert(/\.me-follow/.test(css), 'CSS 有「Ta 的主页」关注按钮容器');

console.log(fails === 0 ? '\n✅ 全部通过' : `\n❌ ${fails} 项失败`);
process.exit(fails === 0 ? 0 : 1);
