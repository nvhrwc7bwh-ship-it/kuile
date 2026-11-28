/* ============================================================
   验证：R2.31 三组调整（2026-11-24）
   ------------------------------------------------------------
   一、已结束 Flag・我的记录
      1. 「我的」页面里的记录小卡片不再能直接跳转到「记录卡」，
         删掉小卡片上显示的「记录卡」几个字。
      2. 结束目标详情页底部「看记录卡」和「分享这一局」两个按钮
         合并为一个，仅保留【分享记录卡】；去掉「分享这一局」按钮。
   二、「我的」页面・资料编辑
      1. 编辑页改为全屏（原来半屏弹出）。
      2. 删除「注册即固定不可修改」提示。
   三、用户主页・小卡片文案
      1. 「点赞」改为「累计点赞」；「关注我」「我见证过」保持不变。
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const fakeEl = () => ({
  style:{}, dataset:{},
  classList:{add(){},remove(){},toggle(){},contains(){return false;}},
  appendChild(){}, removeChild(){}, addEventListener(){}, removeEventListener(){},
  setAttribute(){}, getAttribute(){return null},
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
const get = (expr) => vm.runInContext(expr, sandbox);
vm.runInContext('initState()', sandbox);

const cssSrc = fs.readFileSync(path.join(__dirname, '..', 'css','app.css'),'utf8');
const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js','app.js'),'utf8');
const pagesSrc = fs.readFileSync(path.join(__dirname, '..', 'js','pages.js'),'utf8');

let fails = 0;
function check(cond, msg){
  if (!cond) { console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}
/* 去掉注释（注释里可能还留着旧口径的说明文字） */
const noCmt = (h) => h.replace(/<!--[\s\S]*?-->/g, '');

console.log('\n=== 一① 「我的记录」列表：不再有「记录卡」入口 ===');
{
  vm.runInContext("inject('settled')", sandbox);
  const me = noCmt(get("PAGES.profile()"));
  check(!/data-go="recordCard"/.test(me), '「我的」页记录小卡片不再跳记录卡');
  check(!/class="rc-link"/.test(me), '「我的」页记录小卡片没有「记录卡」角标');
  check(!/>记录卡</.test(me), '「我的」页记录小卡片不再显示「记录卡」三个字');
  /* 「我的 Flag」页共用同一份列表渲染 */
  const mf = noCmt(get("PAGES.myFlags()"));
  check(!/class="rc-link"/.test(mf), '「我的 Flag」页也没有「记录卡」角标');
  /* 整行仍然跳目标详情页 —— 记录卡从那里进 */
  check(/data-go="flagDetail"/.test(me), '记录小卡片整行仍然跳目标详情页');
}

console.log('\n=== 一② 结束目标详情页底部：只剩【分享记录卡】 ===');
{
  const html = noCmt(get("PAGES.flagDetail('f_success')"));
  /* 只看【底部 CTA 区】—— 页面顶部的状态横幅里那个「看记录卡」是另一回事，
     它是「这一局挣回来了」这条结果横幅上的一个入口，不在底部。 */
  const cta = html.slice(html.indexOf('<div class="sticky-cta">'));
  check(/sticky-cta/.test(html), '有底部 CTA 区');
  check(!/看记录卡/.test(cta), '底部没有「看记录卡」按钮');
  check(!/分享这一局/.test(cta), '底部没有「分享这一局」按钮');
  check(/data-act="shareRecordCard"/.test(cta), '底部有「分享记录卡」按钮');
  check(/分享记录卡/.test(cta), '按钮文案是「分享记录卡」');
  /* 整宽按钮 —— 不再是 btn-row 的两列 */
  check(!/class="btn-row"/.test(cta), '不再有双按钮行（.btn-row）');
  check(/class="btn block" data-act="shareRecordCard"/.test(cta), '是整宽的 block 按钮');

  /* 失败的那一局也一样 */
  const html2 = noCmt(get("PAGES.flagDetail('f_stop')"));
  const cta2 = html2.slice(html2.indexOf('<div class="sticky-cta">'));
  check(!/分享这一局/.test(cta2) && !/看记录卡/.test(cta2), '亏了的那一局底部也只剩一个按钮');
  check(/分享记录卡/.test(cta2), '亏了的那一局底部按钮也是「分享记录卡」');
}

console.log('\n=== 一③ 分享半屏能自己渲染海报（不再经过记录卡页） ===');
{
  /* 海报抽成了 recordCardPoster(f) —— 两处共用 */
  check(/function recordCardPoster/.test(pagesSrc), '海报抽成了 recordCardPoster(f)');
  check(/\$\{recordCardPoster\(f\)\}/.test(pagesSrc), '记录卡页用 recordCardPoster(f)');
  /* app.js 的分享动作：页面上没有海报时就自己渲染 */
  check(/recordCardPoster\(pf\)/.test(appSrc), 'app.js 里能自己渲染海报');
  check(/id="sharePosterScale"/.test(appSrc), '分享半屏里还是那块海报区');
  /* 渲染出来的海报内容完整 */
  const poster = noCmt(get("recordCardPoster(FLAGS.f_success)"));
  check(/class="receipt"/.test(poster), '海报有凭据主体');
  check(/class="rc-counts"/.test(poster), '海报有 4 个互动计数');
  check(/class="rc-brand"/.test(poster), '海报有品牌落款');
}

console.log('\n=== 二① 编辑资料 = 全屏页（不再是半屏弹出） ===');
{
  const ROUTES = get("ROUTES");
  check(!!ROUTES.editProfile, '路由表里有 editProfile');
  check(ROUTES.editProfile.r === 'editProfile', 'editProfile 指向独立页面');
  check(ROUTES.editProfile.tab === null, 'editProfile 不是 Tab（是全屏页）');
  check(typeof get("PAGES.editProfile") === 'function', '页面表里有 PAGES.editProfile');

  const ep = noCmt(get("PAGES.editProfile()"));
  check(/class="nav-row"/.test(ep) && /nav-back/.test(ep), '有返回键（.nav-back）');
  check(/>编辑资料</.test(ep), '标题是「编辑资料」');
  check(/class="screen-scroll"/.test(ep), '是完整的滚动页');
  check(/data-act="saveProfile"/.test(ep), '底部有保存按钮');
  check(/id="epAge"/.test(ep), '有年龄字段');
  check(/id="epGender"/.test(ep), '有性别字段');
  check(/id="epProv"/.test(ep), '有省份字段');
  check(/id="epBio"/.test(ep), '有个性签名字段');

  /* 旧的小框已经不存在了 */
  check(!/openEditProfileDialog/.test(appSrc), 'app.js 里没有 openEditProfileDialog');
  check(!/data-ep="yes"/.test(appSrc), '没有小框的保存按钮');
  check(!/\.dialog\.dlg-edit/.test(cssSrc), 'CSS 里旧的小框样式（.dlg-edit）已删');
  check(/\.edit-profile-card/.test(cssSrc), 'CSS 里有全屏页样式（.edit-profile-card）');

  /* 入口改成跳页面 */
  check(/case 'editProfile'/.test(appSrc), 'app.js 有 editProfile 动作');
  check(/render\('editProfile'\)/.test(appSrc), 'editProfile 动作跳到全屏页');
  check(/case 'saveProfile'/.test(appSrc), 'app.js 有 saveProfile 动作');
}

console.log('\n=== 二② 删掉「注册即固定不可修改」提示 ===');
{
  const ep = noCmt(get("PAGES.editProfile()"));
  check(!/不可修改/.test(ep), '编辑页没有「不可修改」');
  check(!/注册即固定/.test(ep), '编辑页没有「注册即固定」');
  check(!/你的唯一编号/.test(ep), '编辑页没有「你的唯一编号」');
  /* 整个 app.js / pages.js 的可见文案里也不再有这句 */
  check(!/注册即固定 —— 不可修改/.test(appSrc + pagesSrc), '代码里没有「注册即固定 —— 不可修改」');
  /* ID号 / 加入时间这两个字段还在（禁用态），只是不解释了 */
  check(/ID号/.test(ep) && /加入时间/.test(ep), 'ID号 / 加入时间字段仍然保留');
}

console.log('\n=== 三① 「点赞」→ 「累计点赞」 ===');
{
  vm.runInContext("initState()", sandbox);
  const me = noCmt(get("PAGES.profile()"));
  const stats = me.slice(me.indexOf('class="me-stats'), me.indexOf('class="section"'));
  check(/>累计点赞</.test(stats), '「我的」页是「累计点赞」');
  check(!/>点赞</.test(stats), '「我的」页没有单独的「点赞」');
  check(/>关注我</.test(stats), '「关注我」保持不变');
  check(/>我见证过</.test(stats), '「我见证过」保持不变');

  const up = noCmt(get("PAGES.userProfile('小美')"));
  const upStats = up.slice(up.indexOf('class="me-stats'), up.indexOf('class="me-follow"'));
  check(/>累计点赞</.test(upStats), '「Ta 的主页」是「累计点赞」');
  check(!/>点赞</.test(upStats), '「Ta 的主页」没有单独的「点赞」');
  check(/>关注我</.test(upStats), '「Ta 的主页」的「关注我」保持不变');
  check(/>我见证过</.test(upStats), '「Ta 的主页」的「我见证过」保持不变');
}

console.log(fails === 0 ? '\n✅ 全部通过' : `\n❌ ${fails} 项失败`);
process.exit(fails === 0 ? 0 : 1);
