/* ============================================================
   验证：记录卡重做 + 已结算 Flag 详情页状态（2026-11-24）
   ------------------------------------------------------------
   ⚠️ 用户口径（7 条）：
      1. 「已结算了的亏了的项目，也有记录卡的，目前没有，参考『挣了』加上。」
      2. 「记录卡的设计上，挣了的记录卡搞错了，应该是体现用户赚回了押金，
           同时达成了自己的目标，很骄傲的文案。」
      3. 「这张卡片记的是过程，不是结果承诺。失败记录卡照样出图，
           而且和成功卡同规格 —— 围观者要的是完整的结局。这种说明删掉。」
      4. 「『这张卡上写的是什么』整个删掉。」
      5. 「『记录卡』中的『生成我的记录卡』按钮取消，
           用户点击分享按钮后可直接分享。」
      6. 「记录卡上增加记录点赞数、留言数、监督人数、见证席人数，
           T1 轻见证就不用了。」
      7. 「当一个 FLAG 结算后，点击这个结算的 FLAG，在它的目标详情页，
           打卡日历、进度应该都是完成了的……那些『今日打卡』，
           『打卡历史』怎么还会有呢？」
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

let fails = 0;
function check(cond, msg){
  if(!cond){ console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}
/** 去掉 HTML 注释 —— 否则断言会命中注释里的说明文字 */
const noCmt = (html) => html.replace(/<!--[\s\S]*?-->/g,'');

console.log('\n=== ① 记录卡：挣了 / 亏了 都有卡 ===');
for (const [id, label] of [['f_success','挣了'], ['f_5','亏了'], ['f_stop','亏了(90天)']]) {
  const html = noCmt(get(`PAGES.recordCard('${id}')`));
  check(html.includes('class="rc-title"'), `${label}：记录卡能出图（有标题）`);
}

console.log('\n=== ② 挣了的卡要体现「赚回押金 + 达成目标」的骄傲 ===');
{
  const html = noCmt(get("PAGES.recordCard('f_success')"));
  const title = (html.match(/class="rc-title">([^<]*)/)||[])[1] || '';
  check(/我说到做到/.test(title), `标题是骄傲的（现为「${title}」）`);
  const keys = (html.match(/class="rpp-k">([^<]*)/g)||[]).map(x=>x.replace(/.*">/,''));
  check(keys.includes('押金'), '骄傲块里有「押金」维度');
  check(keys.includes('目标'), '骄傲块里有「目标」维度');
  check(/全额拿回|全部退回/.test(html), '副标题写明押金全额拿回');
  check(/达成目标/.test(html), '写明「达成目标」');
  /* 旧口径不该再出现 */
  check(!/我按自己的方式记录了 30 天/.test(html), '不再用中性过程叙述当成功卡标题');
}

console.log('\n=== ③ ④ ⑤ 说明性文案与冗余按钮全删 ===');
{
  for (const id of ['f_success','f_5']) {
    const html = noCmt(get(`PAGES.recordCard('${id}')`));
    check(!/这张卡片记的是过程/.test(html), `${id}：删掉「这张卡片记的是过程…」说明`);
    check(!/这张卡上写的是什么/.test(html), `${id}：删掉「这张卡上写的是什么」区块`);
    check(!/失败记录卡照样出图/.test(html), `${id}：删掉「失败记录卡照样出图…」说明`);
    check(!/生成我的记录卡/.test(html), `${id}：删掉「生成我的记录卡」按钮`);
    /* ⚠️ 2026-11-24 用户口径（改）：
       「用户点击『分享这张记录卡』，直接这个这卡片，包括下面的 4 个记录，
        截一张图分享就很好，现在是点击以后，进入一个专门的页面，那个效果不好。」
      —— 所以分享入口改成【就地分享动作】，不再跳独立的 share 页。 */
    check(/data-act="shareRecordCard"/.test(html), `${id}：分享入口改成直接分享动作`);
    check(!/data-go="share"/.test(html), `${id}：不再跳独立 share 页`);
  }
}

console.log('\n=== ⑥ 四个互动计数 + 去掉 T1 轻见证 ===');
{
  const html = noCmt(get("PAGES.recordCard('f_5')"));
  const cnt = (html.match(/class="rc-count"/g)||[]).length;
  check(cnt === 4, `有 4 个互动计数（现为 ${cnt} 个）`);
  for (const label of ['点赞','留言','监督','见证席']) {
    check(html.includes(`rcc-l">${label}`), `计数里有「${label}」`);
  }
  /* f_5 是 T1 —— 标签应该不显示 */
  check(!/>T1</.test(html), 'T1 档位标签不显示在记录卡上');
  /* CSS 要有对应的样式 */
  check(/\.rc-counts/.test(cssSrc), 'CSS 有 .rc-counts');
  check(/\.rc-proud/.test(cssSrc), 'CSS 有 .rc-proud（骄傲块）');
}

console.log('\n=== ⑥-2 品牌「亏了」落在记录卡上（不突兀但看得见）===');
{
  for (const id of ['f_success','f_5']) {
    const html = noCmt(get(`PAGES.recordCard('${id}')`));
    /* 卡头右上角的一枚品牌徽标 */
    check(/class="rc-badge"/.test(html), `${id}：卡头有品牌徽标`);
    check(/class="rcb-word">亏了</.test(html), `${id}：徽标上写着「亏了」`);
    /* 卡底一行品牌落款 */
    check(/class="rc-brand"/.test(html), `${id}：卡底有品牌落款`);
    check(/class="rcb-name">亏了</.test(html), `${id}：落款写着「亏了」`);
    check(/rcb-slogan">公开立目标，熟人见证</.test(html), `${id}：落款带一句 slogan`);
    /* 品牌标记统一用狗头形象（assets/dog_new.png） */
    check(/<img class="rcb-dog" src="assets\/dog_new\.png"/.test(html), `${id}：品牌标记用了狗头形象`);
  }
  /* CSS 要有这些样式 */
  check(/\.rc-badge/.test(cssSrc), 'CSS 有 .rc-badge（卡头品牌徽标）');
  check(/\.rc-brand/.test(cssSrc), 'CSS 有 .rc-brand（卡底落款）');
  check(/\.rcb-dog/.test(cssSrc), 'CSS 有 .rcb-dog（狗头品牌图标）');
}

console.log('\n=== ⑥-3 记录卡 + 4 个计数 = 一张可分享的海报 ===');
{
  const html = noCmt(get("PAGES.recordCard('f_success')"));
  check(/class="rc-poster"/.test(html), '有 .rc-poster 海报容器');
  /* 计数与凭据主体必须在同一个容器里
     （用未去注释的原文来切，因为闭合标记是 HTML 注释） */
  const raw = get("PAGES.recordCard('f_success')");
  const poster = (raw.match(/<div class="rc-poster"[\s\S]*?<\/div><!-- \/\.rc-poster -->/) || [''])[0];
  check(poster.length > 0, '海报容器闭合完整');
  check(/class="receipt"/.test(poster), '凭据主体在海报里');
  check(/class="rc-counts"/.test(poster), '4 个互动计数在海报里');
  check(/class="rc-brand"/.test(poster), '品牌落款在海报里');
  /* 分享半屏的样式 */
  check(/\.share-poster-wrap/.test(cssSrc), 'CSS 有 .share-poster-wrap（分享半屏里的海报）');
  check(/\.share-channels/.test(cssSrc), 'CSS 有 .share-channels（分享渠道）');
  /* app.js 里要有分享动作 */
  const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  check(/case 'shareRecordCard'/.test(appSrc), 'app.js 有 shareRecordCard 动作');
  check(/case 'shareRecordTo'/.test(appSrc), 'app.js 有 shareRecordTo 渠道动作');
  check(/rcPoster/.test(appSrc), 'app.js 把页面上的海报搬进分享半屏');
}

console.log('\n=== ⑦ 已结算的详情页 = 回顾展，不是操作台 ===');
{
  /* —— 挣了 —— */
  const html = noCmt(get("PAGES.flagDetail('f_success')"));
  check(!/data-go="checkin"/.test(html), '挣了：没有「今日打卡」');
  check(!/data-go="checkinLog"/.test(html), '挣了：没有「打卡历史」');
  check(/data-go="recordCard"/.test(html), '挣了：有「看记录卡」入口');
  const cal = JSON.parse(get("JSON.stringify(calCalendar(FLAGS.f_success))")).filter(c=>c.t==='day');
  check(cal.every(c=>c.st==='done'), '挣了：日历全部已打卡');
  check(cal.every(c=>!c.today), '挣了：日历没有「今天」高亮');
  check(!/tl-skip|tl "skip"/.test(html) && !/class="tl skip"/.test(html), '挣了：没有「没走到」的节点');

  /* —— 亏了 —— */
  const html2 = noCmt(get("PAGES.flagDetail('f_stop')"));
  check(!/data-go="checkin"/.test(html2), '亏了：没有「今日打卡」');
  check(!/data-go="checkinLog"/.test(html2), '亏了：没有「打卡历史」');
  check(/data-go="recordCard"/.test(html2), '亏了：有「看记录卡」入口');
  const cal2 = JSON.parse(get("JSON.stringify(calCalendar(FLAGS.f_stop))")).filter(c=>c.t==='day');
  const done = cal2.filter(c=>c.st==='done').length;
  const miss = cal2.filter(c=>c.st==='miss').length;
  const future = cal2.filter(c=>c.st==='future').length;
  check(future === 0, `亏了：日历没有「未来」格（现为 ${future} 个）`);
  check(done === 41, `亏了：打卡 41 天（现为 ${done}）`);
  check(miss === 49, `亏了：没打卡的 49 天标红（现为 ${miss}）`);
  check(/class="tl skip"/.test(html2), '亏了：没走到的节点标为 skip');
  check(/这一局没走到这里/.test(html2), '亏了：skip 节点写明「这一局没走到这里」');
  /* ⚠️ 2026-11-24（R2.30 Part 一①）：断卡那句「已断 N / M，X 月 X 日未打卡，12 小时内可补」
     **整句删掉**了 —— 现在页面上没有「已断」这两个字，
     断卡次数改由日历**折叠头右侧**的「断卡 N/M 次」承担。 */
  check(!/已断/.test(html2), '亏了：不再显示「已断 N 次」那句（已删）');
  check(/断卡/.test(html2), '亏了：仍有断卡信息（日历折叠头的「断卡 N/M 次」）');
  check(!/还能断/.test(html2), '亏了：断卡卡不再说「还能断 N 次」');
}

console.log('\n=== ⑧ 失败局的横幅也有「看记录卡」入口 ===');
{
  const banner = noCmt(get("myFlagStatusBanner(FLAGS.f_stop)"));
  check(/data-go="recordCard"/.test(banner), '亏了的横幅有「看记录卡」按钮');
  const banner2 = noCmt(get("myFlagStatusBanner(FLAGS.f_success)"));
  check(/data-go="recordCard"/.test(banner2), '挣了的横幅有「看记录卡」按钮');
}

console.log('\n=== ⑨ 「我的记录」列表：不再有记录卡入口（⚠️ 2026-11-24 R2.31 改）===');
{
  /* 造一个「已结算」的场景（我的记录列表读的是 STATE.myFlags） */
  vm.runInContext("inject('settled')", sandbox);
  const me = noCmt(get("PAGES.profile()"));
  /* ⚠️ 用户口径 Part 一①：「任务结束后，『我的』页面里的记录小卡片
     不再能直接跳转到『记录卡』，删掉小卡片上显示的『记录卡』几个字。」 */
  check(!/data-go="recordCard"/.test(me), '「我的记录」里不再有记录卡入口');
  check(!/class="rc-link"/.test(me), '「我的记录」里不再有「记录卡」角标');
  check(!/>记录卡</.test(me), '「我的记录」里不再出现「记录卡」三个字');
  /* 「我的 Flag」页的记录卡同样删掉 */
  const mf = noCmt(get("PAGES.myFlags()"));
  check(!/class="rc-link"/.test(mf), '「我的 Flag」页里不再有「记录卡」角标');
}

console.log('\n=== ⑩ 打卡历史页对已结算的局也能看 ===');
{
  const log = noCmt(get("PAGES.checkinLog('f_stop')"));
  check(log.includes('第 41 天'), '打卡历史页反推出这一局每天的记录');
  check(!/现在去打第一次卡/.test(log), '已结算的局不出现「现在去打第一次卡」');
}

console.log(fails === 0 ? '\n✅ 全部通过' : `\n❌ ${fails} 项失败`);
process.exit(fails === 0 ? 0 : 1);
