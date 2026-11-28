/* 打卡照片公开专项巡检（见需求规格 R2.5 / D2.6 / W7.1）
   —— 断言广场封面、日历条、物证详情、异议前置、隐私开关 */
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
const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js','app.js'),'utf8');
const pagesSrc = fs.readFileSync(path.join(__dirname, '..', 'js','pages.js'),'utf8');
const dataSrc = fs.readFileSync(path.join(__dirname, '..', 'js','data.js'),'utf8');
const cssSrc = fs.readFileSync(path.join(__dirname, '..', 'css','app.css'),'utf8');

vm.runInContext('initState()', sandbox);
vm.runInContext("INJECTORS.newUserWithFlags()", sandbox);
vm.runInContext("INJECTORS.subscribe()", sandbox);

let fails = 0;
function check(cond, msg){
  if(!cond){ console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}

/* ─────────────────────────────────────────────
   1. 素材资源
   ───────────────────────────────────────────── */
console.log('=== 1. 真实打卡照片素材 ===');
const ckDir = path.join(__dirname, '..', 'assets', 'checkin');
/* ⚠️ 2026-11-23：素材从「程序生成的卡通占位图」换成「Unsplash 真实照片」，
   扩展名同步从 .png 改成 .jpg（PNG 重编码体积暴涨 5 倍）。 */
const ckFiles = fs.existsSync(ckDir) ? fs.readdirSync(ckDir).filter(f => f.endsWith('.jpg')) : [];
check(ckFiles.length >= 12, `assets/checkin/ 下有 12 张真实打卡照片（实际 ${ckFiles.length}）`);
check(ckFiles.every(f => fs.statSync(path.join(ckDir, f)).size > 5000), '每张打卡照片都有实际内容（非空文件）');
/* JPEG 的文件头必须是 FFD8 —— 防止「后缀是 .jpg 但内容还是 PNG」的假素材 */
check(ckFiles.every(f => {
  const fd = fs.openSync(path.join(ckDir, f), 'r');
  const buf = Buffer.alloc(2); fs.readSync(fd, buf, 0, 2, 0); fs.closeSync(fd);
  return buf[0] === 0xFF && buf[1] === 0xD8;
}), '每张打卡照片都是真正的 JPEG（文件头 FFD8）');
check(/const CK_PHOTO_POOL = \[/.test(dataSrc), 'data.js 用 CK_PHOTO_POOL（避免与 avatars.js 的 PHOTO_POOL 撞名）');
check(!/const PHOTO_POOL = \[/.test(dataSrc), 'data.js 不再声明顶层 PHOTO_POOL');

/* ─────────────────────────────────────────────
   2. 照片模型函数
   ───────────────────────────────────────────── */
console.log('\n=== 2. 照片模型 ===');
check(/function photosOf\(/.test(dataSrc), 'data.js 有 photosOf(f)');
check(/function recentPhotos\(/.test(dataSrc), 'data.js 有 recentPhotos(f, n)');
check(/function photoFor\(/.test(dataSrc), 'data.js 有 photoFor(day, offset)');
check(/function photoOn\(/.test(dataSrc), 'data.js 有 photoOn(f, day)');

const photosOf = vm.runInContext('photosOf', sandbox);
const recentPhotos = vm.runInContext('recentPhotos', sandbox);
const photoFor = vm.runInContext('photoFor', sandbox);
const FLAGS = vm.runInContext('FLAGS', sandbox);

const f3 = FLAGS.f_3;
const pl = photosOf(f3);
check(pl.length > 0, `photosOf(f_3) 返回 ${pl.length} 条`);
check(pl.every(p => p.d >= 1 && typeof p.d === 'number'), '每条照片都有数字 d');
check(pl.every(p => p.src && p.src.startsWith('assets/checkin/')), '每条照片都指向 assets/checkin/');
check(pl.every(p => p.st !== 'future'), '未来天不出照片');
// 稳定性：同一天永远同一张
check(photoFor(5, 0) === photoFor(5, 0), 'photoFor 稳定（同一天永远同一张）');
check(photoFor(5, 0) !== photoFor(6, 0), '不同天取到不同素材');
// 断卡天不出照片
const missDays = pl.filter(p => p.st === 'miss');
check(missDays.every(p => !p.src), '断卡天没有照片（是空格子，不是灰图）');
check(missDays.every(p => p.src === null), '断卡天 src 严格为 null（不是空串/别的天的图）');
// ⚠️ 回归：断卡格里绝不能塞别的天的照片 —— 那是伪造证据
const sqHtml = PAGES.square();
const cardList = sqHtml.split('<div class="feed-card"').slice(1);
let badCells = 0, missSeen = 0;
for (const c of cardList) {
  const s = c.indexOf('<div class="feed-strip">');
  const e = c.indexOf('<div class="feed-weight">', s);
  if (s < 0 || e < 0) continue;
  for (const cell of c.slice(s, e).split('<div class="fs-cell').slice(1)) {
    const cls = (cell.match(/^([^"]*)"/) || [])[1] || '';
    const hasImg = /<img /.test(cell);
    const isMiss = /\bmiss\b/.test(cls);
    const isLast = /\blast\b/.test(cls);
    if (isMiss) { missSeen++; if (hasImg) badCells++; }
    if (!isMiss && !isLast && !hasImg) badCells++;
  }
}
check(badCells === 0, `广场每张卡的日历条：断卡格无图、非末格都有图（异常 ${badCells} 处）`);
// 日历条长度
const rp = recentPhotos(f3, 8);
check(rp.length === 8, `recentPhotos(f_3, 8) 返回 8 格（实际 ${rp.length}）`);
check(rp.every(p => typeof p.d === 'number'), '日历条每格都有 d');
check(rp[rp.length-1].st !== 'future', '日历条最后一格不是未来');
check(rp.filter(p => p.src).length > 0, '日历条里有照片');

/* ─────────────────────────────────────────────
   3. 广场卡片：大图模式（见需求规格 R2.6）
   ───────────────────────────────────────────── */
console.log('\n=== 3. 广场卡片（大图模式） ===');
const square = PAGES.square();
check(/class="feed-cover"/.test(square), '广场卡片有 .feed-cover 封面容器');
check(/class="feed-cover-top"/.test(square), '广场卡片有 .feed-cover-top（左上角作者浮层）');
check(/class="feed-meta-line"/.test(square), '广场卡片有 .feed-meta-line（体重 + 监督数据条）');
check(/class="feed-prog"/.test(square), '广场卡片有 .feed-prog（进展条）');
const coverImgs = (square.match(/<div class="feed-cover">\s*<img/g)||[]).length;
check(coverImgs > 0, `封面用 <img>（不是 CSS 背景）（${coverImgs} 处）`);
check(!/class="feed-cover-fb"/.test(square) || /feed-cover-fb/.test(cssSrc), 'fallback 卡片样式已定义');

/* ⚠️ 2026-11-21 大图模式：8 格缩略图条已从广场卡移除 —— 展示内容太多，用户没法聚焦 */
check(!/class="feed-strip"/.test(square), '广场卡片【不再有】.feed-strip 8 格缩略图条');
check(!/class="fs-cell/.test(square), '广场卡片【不再有】.fs-cell 缩略图格子');
check(!/class="feed-top"/.test(square), '广场卡片不再用「封面 + 标题并排」的旧布局');

// 封面必须是竖版 3:4（双列瀑布流，见需求规格 R2.7）
check(/\.feed-cover\{[\s\S]*?aspect-ratio:3\/4/.test(cssSrc), 'CSS 定义 .feed-cover 为 3:4 竖图（双列瀑布流）');
check(/\.feed-cover-top\{/.test(cssSrc), 'CSS 定义 .feed-cover-top（作者浮层）');
check(/\.feed-meta-line\{/.test(cssSrc), 'CSS 定义 .feed-meta-line（数据条）');
check(/\.feed-prog\{/.test(cssSrc), 'CSS 定义 .feed-prog（进展条）');
check(/\.feed-cover-n\{/.test(cssSrc), 'CSS 定义 .feed-cover-n（补充照片张数角标）');

/* ⚠️ 2026-11-21 二次调整：广场改双列瀑布流 —— 单列大图占了整屏，一屏只看得到 1 张 */
check(/class="feed-grid"/.test(square), '广场用 .feed-grid 双列容器');
check(/\.feed-grid\{[\s\S]*?grid-template-columns:repeat\(2/.test(cssSrc), 'CSS 定义 .feed-grid 为 2 列网格');
check(/\.feed-grid\{[\s\S]*?align-items:start/.test(cssSrc), 'CSS .feed-grid 用 align-items:start（卡片各自贴顶 = 瀑布流）');
check(/\.feed-grid \.feed-card\{margin-bottom:0/.test(cssSrc), '瀑布流卡片靠 grid gap 撑开，不用 margin');
// 卡片必须包在 feed-grid 里（不能是顶层裸卡片）
const gridInner = (square.match(/<div class="feed-grid">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/) || [])[1] || '';
check(/class="feed-card"/.test(gridInner), '所有 feed-card 都在 .feed-grid 容器内');
// 封面素材必须是竖版 600×800
check(/W, H = 600, 800/.test(fs.readFileSync(path.join(__dirname, '..', '..', '工具', '_gen_life_photos.py'), 'utf8')),
  '生活照素材生成器输出 600×800 竖版（与 3:4 封面一致）');
// ⚠️ 2026-11-23 用户口径：「这个截图中 67.4KG 4.2KG 的数据展示，改为用户定的开始体重和目标体重。」
// —— 广场卡片的数据行改显示【起始体重 → 目标体重】，不再显示「当前体重 / 还差多少」
check(!/↓\d/.test(square), '广场窄栏不再显示「↓ 还差多少 kg」');
check(!/距目标/.test(square), '广场窄栏不再出现「距目标」三字（避免撑破列宽）');
check(/fml-arrow/.test(square), '广场窄栏用「→」分隔起始体重与目标体重');
// 断卡/补卡格子样式仍需保留 —— 异议页与物证页还在用同一套
check(/\.fs-cell\.miss\{/.test(cssSrc), 'CSS 定义 .fs-cell.miss（空格子样式，物证详情页仍在用）');
check(/\.fs-cell\.last\{/.test(cssSrc), 'CSS 定义 .fs-cell.last（最新一天品牌橙描边）');
check(/\.fs-cell\.makeup\{/.test(cssSrc), 'CSS 定义 .fs-cell.makeup（补卡）');
check(/\.fs-badge/.test(cssSrc), 'CSS 定义 .fs-badge（补卡角标）');

/* ─────────────────────────────────────────────
   3b. 补充照片 / 封面优先级（见需求规格 R2.6）
   ───────────────────────────────────────────── */
console.log('\n=== 3b. 补充照片与封面优先级 ===');
check(/const LIFE_PHOTO_POOL = \[/.test(dataSrc), 'data.js 有 LIFE_PHOTO_POOL（生活照素材池）');
check(/const MAX_EXTRA_PHOTOS = 3/.test(dataSrc), 'data.js 定义 MAX_EXTRA_PHOTOS = 3');
check(/function extraPhotosOf\(/.test(dataSrc), 'data.js 有 extraPhotosOf(f)');
check(/function coverPhotoOf\(/.test(dataSrc), 'data.js 有 coverPhotoOf(f)');
check(/function lifePhotoFor\(/.test(dataSrc), 'data.js 有 lifePhotoFor(flagId, day, slot)');

const extraPhotosOf = vm.runInContext('extraPhotosOf', sandbox);
const coverPhotoOf = vm.runInContext('coverPhotoOf', sandbox);
const MAX_EXTRA_PHOTOS = vm.runInContext('MAX_EXTRA_PHOTOS', sandbox);
check(MAX_EXTRA_PHOTOS === 3, `额外照片上限 = 3（实际 ${MAX_EXTRA_PHOTOS}）`);

// 素材文件真的存在
const lifeDir = path.join(__dirname, '..', 'assets', 'life');
const lifeFiles = fs.existsSync(lifeDir) ? fs.readdirSync(lifeDir).filter(f => f.endsWith('.jpg')) : [];
check(lifeFiles.length >= 12, `assets/life/ 下有 12 张真实生活照（实际 ${lifeFiles.length}）`);
check(lifeFiles.every(f => fs.statSync(path.join(lifeDir, f)).size > 5000), '每张生活照都有实际内容（非空文件）');
check(lifeFiles.every(f => {
  const fd = fs.openSync(path.join(lifeDir, f), 'r');
  const buf = Buffer.alloc(2); fs.readSync(fd, buf, 0, 2, 0); fs.closeSync(fd);
  return buf[0] === 0xFF && buf[1] === 0xD8;
}), '每张生活照都是真正的 JPEG（文件头 FFD8）');

// 数量上限
check(extraPhotosOf(FLAGS.f_own).length <= 3, 'extraPhotosOf 不超过 3 张');
check(extraPhotosOf(FLAGS.f_own).length > 0, 'f_own 显式种了补充照，至少返回 1 张');
check(extraPhotosOf({ id:'f_none', checkedDays:5, totalDays:30, history:[], days:30 }).length === 0,
  '⚠️ 没上传过补充照时返回空数组（不能自动生成占位 —— 否则分不清封面来源）');

// ⚠️ 核心规则：第 1 张补充照片 = 封面图
const exOwn = extraPhotosOf(FLAGS.f_own);
const covOwn = coverPhotoOf(FLAGS.f_own);
check(covOwn && covOwn.kind === 'life', '有补充照片时，封面来自补充照片');
check(covOwn && covOwn.src === exOwn[0].src, '封面 = 第 1 张补充照片（上传的第一张就是首页图）');

// 没补充照片时回退到打卡照
const noExtra = { id:'f_tmp', checkedDays:3, totalDays:30, history:[], days:30 };
const covFallback = coverPhotoOf(noExtra);
check(covFallback && covFallback.kind === 'checkin', '没补充照片时封面回退到打卡照');
// 什么都没有时返回 null（走 fallback 文字卡）
check(coverPhotoOf({ id:'f_x', checkedDays:0, totalDays:30, history:[], days:30 }) === null, '既没补充照片也没打卡照时返回 null（走文字卡 fallback）');

/* ─────────────────────────────────────────────
   4. 详情页照片条
   ───────────────────────────────────────────── */
console.log('\n=== 4. 详情页照片条 ===');
/* ⚠️ 2026-11-21 起详情页分两个身份渲染（见需求规格 R2.9）：
   - 本人（f_own）：状态在前，照片条在【打卡日历】区块内
   - 围观者（f_3）：照片前置到页面顶部（.photo-first），底部日历区不再重复 */
const detail = PAGES.flagDetail('f_own');
check(/class="photo-strip"/.test(detail), '本人版 Flag 详情页有 .photo-strip 照片条');
check(/class="ps-cell/.test(detail), '照片条用 .ps-cell 格子');
check(/data-go="checkinLogItem" data-id="[^"]+" data-day="\d+"/.test(detail), '照片条格子带 flagId + day，可点进物证详情');
check(/\.photo-strip\{/.test(cssSrc), 'CSS 定义 .photo-strip');
check(/\.ps-cell\{/.test(cssSrc), 'CSS 定义 .ps-cell');
check(/打卡照片在平台内公开/.test(detail), '详情页有「打卡照片在平台内公开」说明');
// 日历格也能点进去
/* ⚠️ 2026-11-24（本轮，用户口径 Part I⑤）：日历格点击由【整页跳转】
   改成【半屏弹出】（data-act="openDaySheet"）。 */
check(/class="cal-d [^"]*" data-act="openDaySheet" data-id="[^"]+" data-day="\d+"/.test(detail), '打卡日历格可点开半屏（带 day）');
// 围观者版：照片前置 + 底部不再重复
const detailSpec = PAGES.flagDetail('f_3');
check((detailSpec.match(/class="photo-strip/g) || []).length === 1, '围观者版照片条只出现一次（前置到顶部，底部不重复）');

/* ─────────────────────────────────────────────
   5. 物证详情页（参数化）
   ───────────────────────────────────────────── */
console.log('\n=== 5. 物证详情页（flagId + day） ===');
const ev = PAGES.checkinLogItem('f_3', 5);
check(/class="ev-photo"/.test(ev), '物证详情页有 .ev-photo');
check(/<img src="assets\/checkin\//.test(ev), '物证详情页显示打卡原图');
check(/第 5 天/.test(ev), '物证详情页按 day 定位（第 5 天）');
check(!/第 37 天 · 09-25/.test(ev), '物证详情页不再写死「第 37 天」');
// 不同 day 出不同内容
const ev7 = PAGES.checkinLogItem('f_3', 7);
check(ev !== ev7, '不同 day 渲染出不同内容');
// 断卡天
const missDay = pl.find(p => p.st === 'miss');
if (missDay) {
  const evMiss = PAGES.checkinLogItem('f_3', missDay.d);
  check(/ev-miss/.test(evMiss), `断卡天（第 ${missDay.d} 天）显示「这一天没有打卡」`);
  check(!/<img src="assets\/checkin\//.test(evMiss), '断卡天不显示照片');
}
check(/\.ev-photo\{/.test(cssSrc), 'CSS 定义 .ev-photo');
check(/\.ev-photo\.ev-miss\{/.test(cssSrc), 'CSS 定义 .ev-photo.ev-miss');

/* ─────────────────────────────────────────────
   6. 路由支持第二参数
   ───────────────────────────────────────────── */
console.log('\n=== 6. 路由第二参数（day） ===');
check(/routeDay = \(opt\.day/.test(appSrc), 'app.js 有 routeDay 状态');
check(/render\(target, id, \{ day \}\)/.test(appSrc), 'app.js 点击跳转把 data-day 传给 render');
check(/\(id, routeDay\)/.test(appSrc), 'app.js 渲染时把 day 作为第二参数传给页面模板');
check(/day: routeDay/.test(appSrc), 'app.js 导航栈保存 day（返回时能还原）');
check(/data-day/.test(pagesSrc), 'pages.js 有元素带 data-day');

/* ─────────────────────────────────────────────
   7. 异议页（2026-11-24 用户口径改）
   ─────────────────────────────────────────────
   「提出异议这一页，只需要展示当天的照片，不需要之前的。」
   「至少看过 3 天的打卡照片才能提交异议……删掉这个。」
   「只能选证据相关的理由 —— 不能对『进度』提异议」删掉。
   「异议是『对事』判定是『对人』……恶意异议扣分 -8」删掉。
   「你的名字对平台实名，对发起人匿名……每 Flag 全周期最多提 3 次」删掉。
   ───────────────────────────────────────────── */
console.log('\n=== 7. 异议页（只展示当天照片 + 无前置 + 不写规则说明） ===');
/* ⚠️ 去掉 HTML 注释 —— 否则断言会命中注释里写的「删掉了 XXX」说明文字 */
const objHtml = PAGES.objection('f_3').replace(/<!--[\s\S]*?-->/g,'');
const objection = objHtml;
/* ① 只展示当天的照片 */
check(/今天的照片/.test(objection), '异议页有「今天的照片」区块');
check(/data-act="openPhoto"/.test(objection), '异议页照片格点开放大查看器');
check(!/先看物证/.test(objection), '异议页不再有「先看物证」区块');
/* ② 没有「看过 N 天」前置 */
check(!/至少看过/.test(objection), '异议页不再说明「至少看过 N 天」');
check(!/disabled/.test(objection), '提交按钮【没有】禁用态（看完就能投）');
check(!/投的是「进度」，不是「证据」/.test(objection), '异议页不再出现「投的是进度不是证据」的解释');
/* ③ 页面不写规则说明 */
check(!/异议是「对事」/.test(objection), '异议页不再写「异议是对事，判定是对人」');
check(!/恶意异议扣分/.test(objection), '异议页不再写「恶意异议扣分」');
check(!/只能选/.test(objection), '异议页不再写「只能选证据相关的理由」');
check(!/对发起人匿名/.test(objection), '异议页不再写「名字对平台实名对发起人匿名」');
check(!/最多提 3 次/.test(objection), '异议页不再写「每 Flag 全周期最多提 3 次」');
/* ④ 理由清单本身保留（5 项证据相关） */
check(/体重秤读数被修改/.test(objection), '异议理由清单保留「体重秤读数被修改」');
check(/修图伪造物证/.test(objection), '异议理由清单保留「修图伪造物证」');
/* ⑤ 已看过物证的状态仍在，但不再 gate 提交 */
check(/seenEvidence/.test(fs.readFileSync(path.join(__dirname, '..', 'js','state.js'),'utf8')), 'state.js 有 seenEvidence 状态（只做记录，不再前置）');

/* ─────────────────────────────────────────────
   8. 隐私：全部公开，无开关
   ⚠️ 2026-11-24 用户口径：「『我的』右上角的设置页删掉。
      …… 每日打卡不提醒。隐私都公开。」
   —— 设置页【整个删掉】：照片一律公开，不提供关闭开关；
      断卡 / 判负 / 结算正常提醒，也没有开关。
   ───────────────────────────────────────────── */
console.log('\n=== 8. 隐私一律公开（无设置页 / 无开关） ===');
check(!PAGES.settings, '设置页已删除');
check(!/settings/.test(appSrc.match(/ROUTES[\s\S]{0,4000}/) ? appSrc.match(/ROUTES[\s\S]{0,4000}/)[0] : ''), 'ROUTES 里没有 settings 路由');
const stateSrc = fs.readFileSync(path.join(__dirname, '..', 'js','state.js'),'utf8');
check(!/photoPublic/.test(stateSrc), 'state.js 里没有 photoPublic 开关状态');
check(!/isPhotoPublic/.test(stateSrc), 'state.js 里没有 isPhotoPublic()');
check(!/case 'togglePhotoPublic'/.test(appSrc), 'app.js 没有 togglePhotoPublic 动作');
const profileHtml = PAGES.profile();
check(!/data-go="settings"/.test(profileHtml), '「我的」右上角没有设置入口');
const privacyTxt = PAGES.privacy();
check(/不提供关闭开关/.test(privacyTxt), '隐私政策说明照片一律公开、无关闭开关');
check(!/设置 → 隐私/.test(privacyTxt), '隐私政策不再指向设置页');
const infoSrc = fs.readFileSync(path.join(__dirname, '..', 'js','info.js'),'utf8');
check(!/设置 → 隐私/.test(infoSrc), 'info.js 说明不再指向设置页');
check(/一律在平台内公开/.test(infoSrc), 'info.js 说明「一律在平台内公开」');
const subsHtml = PAGES.subs();
check(!/class="switch/.test(subsHtml), '监督页不再有通知开关');
/* ⚠️ 2026-11-24（本轮）：通知承诺说明从「监督」页挪到了「我的」页的法律与安全区 ——
   理由：它是【全局产品承诺】说明，不是「我监督的局」这一页该承载的东西；
   而且原来那四行画成了可以拨动但点不动的假开关。 */
check(!/断卡提醒/.test(subsHtml) && !/结算提醒/.test(subsHtml), '监督页不再有通知承诺说明（已挪到「我的」页）');
const profileHtml2 = PAGES.profile();
check(/断卡、判负、结算会通知你/.test(profileHtml2), '「我的」页法律与安全区上方写明断卡 / 判负 / 结算会提醒');
check(/每日打卡不提醒/.test(profileHtml2), '「我的」页写明每日打卡不提醒');

/* ─────────────────────────────────────────────
   9. 打卡页公开提示 + 隐私政策改写
   ───────────────────────────────────────────── */
console.log('\n=== 9. 打卡页提示 / 隐私政策 ===');
const checkin = PAGES.checkin('f_own');
/* ⚠️ 2026-11-21：这两条提示已从打卡页删除（见需求规格 R2.8）——
   公开口径移到隐私政策与照片条旁的「?」说明弹层里，打卡页不再重复。
   断言写在 9b 节（作为「已删除」的回归）。 */
const privacy = PAGES.privacy();
check(/打卡照片/.test(privacy) && /平台内公开/.test(privacy), '隐私政策写明打卡照片在平台内公开');
check(!/100% 私密/.test(privacy), '隐私政策不再出现「100% 私密」（虚假告知）');
check(/不提供关闭开关/.test(privacy), '隐私政策写明照片一律公开、无关闭开关');
check(/避开卧室、浴室/.test(privacy), '隐私政策有拍照提示');

/* ─────────────────────────────────────────────
   9b. 打卡页补充照片（见需求规格 R2.6）
   ───────────────────────────────────────────── */
console.log('\n=== 9b. 打卡页补充照片 ===');
const stateSrc2 = fs.readFileSync(path.join(__dirname, '..', 'js','state.js'),'utf8');
check(/checkinDraft/.test(stateSrc2), 'state.js 有 checkinDraft 草稿状态');
check(/function addExtraPhoto\(/.test(stateSrc2), 'state.js 有 addExtraPhoto(src)');
check(/function removeExtraPhoto\(/.test(stateSrc2), 'state.js 有 removeExtraPhoto(slot)');
check(/function setCoverPhoto\(/.test(stateSrc2), 'state.js 有 setCoverPhoto(slot)');
check(/function commitExtraPhotos\(/.test(stateSrc2), 'state.js 有 commitExtraPhotos(flagId, day)');

check(/class="ex-grid"/.test(checkin), '打卡页有 .ex-grid 补充照片区');
check(/data-act="addExtraPhoto"/.test(checkin), '打卡页有「+」号框入口');
check(/data-act="rmExtraPhoto"/.test(checkin) || /ex-add/.test(checkin), '打卡页有删除入口');
check(/data-act="doCheckin"/.test(checkin), '打卡页仍有「提交打卡」按钮');
// 上传动作独立于打卡按钮 —— 两件事不绑死
check(/case 'addExtraPhoto'/.test(appSrc), 'app.js 有 addExtraPhoto 动作');
check(/case 'rmExtraPhoto'/.test(appSrc), 'app.js 有 rmExtraPhoto 动作');
check(/case 'setCoverPhoto'/.test(appSrc), 'app.js 有 setCoverPhoto 动作');
check(/设为封面/.test(pagesSrc), 'pages.js 有「设为封面」入口文案');

// ⚠️ 2026-11-21 打卡页简化（见需求规格 R2.8）—— 四块内容被删/折叠
check(/今日随机词/.test(checkin), '打卡页标题是「今日随机词」');
check(!/>随机词</.test(checkin), '打卡页不再用裸的「随机词」标签');
check(/打卡说明/.test(checkin), '打卡页有「打卡说明」折叠区');
check(/体重秤/.test(checkin) && /手写随机词/.test(checkin), '「打卡说明」里写了拍照要求（体重秤 + 手写随机词）');
check(!/照片必须包含三样东西/.test(checkin), '打卡页【删掉】「照片必须包含三样东西」');
check(!/今天做了 AI 轻量校验/.test(checkin), '打卡页【删掉】「今天做了 AI 轻量校验」');
check(!/这张照片会在平台内公开/.test(checkin), '打卡页【删掉】「这张照片会在平台内公开」');
check(!/拍照时请避开他人与私密空间/.test(checkin), '打卡页【删掉】「拍照时请避开他人与私密空间」');
check(!/ex-acts/.test(checkin), '打卡页【删掉】「现拍 / 相册」两个按钮条（点 + 号框就是拍照）');
check(!/不传也行/.test(checkin), '打卡页【删掉】说明文案卡（设计太复杂）');
check(!/第 1 张就是你的封面图/.test(checkin), '打卡页【删掉】「第 1 张就是你的封面图」提示条');

vm.runInContext('resetCheckinDraft("f_test")', sandbox);
const addExtraPhoto = vm.runInContext('addExtraPhoto', sandbox);
const pendingExtraPhotos = vm.runInContext('pendingExtraPhotos', sandbox);
addExtraPhoto('assets/life/lf01.jpg');
addExtraPhoto('assets/life/lf02.jpg');
const checkinWithPhoto = PAGES.checkin('f_own');
check(/ex-badge">封面/.test(checkinWithPhoto), '上传后第 1 张标「封面」角标');
check(/data-act="setCoverPhoto"/.test(checkinWithPhoto), '非封面图有「设为封面」入口');

/* ⚠️ 打卡照必填（见需求规格 R2.8）：没拍照不能提交打卡 */
console.log('\n=== 9c. 打卡照必填 ===');
check(/function pendingCheckinShot\(/.test(stateSrc2), 'state.js 有 pendingCheckinShot()');
check(/function hasCheckinShot\(/.test(stateSrc2), 'state.js 有 hasCheckinShot()');
check(/function setCheckinShot\(/.test(stateSrc2), 'state.js 有 setCheckinShot(src, weight)');
check(/function commitCheckinShot\(/.test(stateSrc2), 'state.js 有 commitCheckinShot(flagId, day)');
check(/case 'takeCheckinShot'/.test(appSrc), 'app.js 有 takeCheckinShot 动作（拍照）');
check(/data-act="takeCheckinShot"/.test(checkin), '打卡页有拍照入口');
check(/if \(!hasCheckinShot\(\)\)/.test(appSrc), 'app.js 在 doCheckin 里拦截「没拍照」');

vm.runInContext('resetCheckinDraft("f_test")', sandbox);
const hasCheckinShot = vm.runInContext('hasCheckinShot', sandbox);
check(hasCheckinShot() === false, '没拍照时 hasCheckinShot() = false');
const checkinNoShot = PAGES.checkin('f_own');
check(/disabled/.test(checkinNoShot), '没拍照时「提交打卡」按钮是 disabled');
check(/先拍张照才能打卡/.test(checkinNoShot), '没拍照时按钮文案提示「先拍张照才能打卡」');
// ⚠️ 补充照再多也不能替代打卡照
const addExtraPhoto2 = vm.runInContext('addExtraPhoto', sandbox);
addExtraPhoto2('assets/life/lf01.jpg');
addExtraPhoto2('assets/life/lf02.jpg');
addExtraPhoto2('assets/life/lf03.jpg');
check(hasCheckinShot() === false, '⚠️ 传满 3 张补充照后 hasCheckinShot() 仍是 false');
const checkinOnlyExtra = PAGES.checkin('f_own');
check(/disabled/.test(checkinOnlyExtra), '⚠️ 只有补充照没有打卡照时，按钮仍是 disabled');
// 拍了打卡照 → 可提交
vm.runInContext('setCheckinShot("assets/checkin/ck01.jpg", 68.2)', sandbox);
check(hasCheckinShot() === true, '拍了打卡照后 hasCheckinShot() = true');
const checkinShotReady = PAGES.checkin('f_own');
check(!/先拍张照才能打卡/.test(checkinShotReady), '拍了照后按钮文案变回「提交打卡」');
check(!/disabled/.test(checkinShotReady), '拍了照后按钮不再是 disabled');
vm.runInContext('resetCheckinDraft("f_test")', sandbox);

/* 逻辑验证：加到 3 张就停；第 1 张是封面；上传不影响打卡 */
vm.runInContext('resetCheckinDraft("f_test")', sandbox);
addExtraPhoto('assets/life/lf01.jpg');
addExtraPhoto('assets/life/lf02.jpg');
addExtraPhoto('assets/life/lf03.jpg');
const fourth = addExtraPhoto('assets/life/lf04.jpg');
check(fourth === false, '第 4 张被拒绝（上限 3 张）');
check(pendingExtraPhotos().length === 3, '暂存区最多 3 张');
check(pendingExtraPhotos()[0].src === 'assets/life/lf01.jpg', '暂存区第 1 张就是封面');
const setCoverPhoto = vm.runInContext('setCoverPhoto', sandbox);
setCoverPhoto(2);
check(pendingExtraPhotos()[0].src === 'assets/life/lf03.jpg', 'setCoverPhoto(2) 把第 3 张换到封面位');
const removeExtraPhoto = vm.runInContext('removeExtraPhoto', sandbox);
removeExtraPhoto(0);
check(pendingExtraPhotos().length === 2, '删除一张后剩 2 张');
check(pendingExtraPhotos()[0].src === 'assets/life/lf01.jpg', '删掉封面后，第 2 张顺延成为封面');
// ⚠️ 上传不影响打卡 —— 打卡天数 / 连续天数 / 打卡日志都不该被碰
const flagBefore = vm.runInContext('(function(){const f=FLAGS.f_own; return JSON.stringify({d:f.checkedDays,s:f.streak});})()', sandbox);
check(flagBefore.includes('"d":68'), '上传补充照不改变打卡天数（f_own 仍 68 天）');
vm.runInContext('resetCheckinDraft("f_test")', sandbox);

/* ─────────────────────────────────────────────
   10. 围观者版详情页：照片前置（见需求规格 R2.9）
   ───────────────────────────────────────────── */
console.log('\n=== 10. 围观者版详情页（照片前置） ===');
const detailOther = PAGES.flagDetail('f_3');   // 别人的 Flag
const detailMine  = PAGES.flagDetail('f_own');  // 我的 Flag

/* ⚠️ 2026-11-21 用户口径（第二轮调整）：
   ① 「Ta 今天的照片」缩略图行（1~4 张，一行排完）→ 在【目标卡之前】
   ② 体重信息（体重 / 打卡天数 / 监督）→ 目标卡
   ③ 「打卡照片 · 平台内公开」条（左右滑选某一天）→ 在【目标卡之后】
   ④ 点某一天 → 进【打卡详情页】（不是图片查看器）*/

// ① 缩略图行在目标卡之前
const iRowOther  = detailOther.indexOf('today-row');
const iCardOther = detailOther.indexOf('class="card"');
check(iRowOther > -1, '围观者版有「Ta 今天的照片」缩略图行（.today-row）');
check(iCardOther > -1 && iRowOther < iCardOther, '围观者版：缩略图行在目标卡【之前】');
check(/class="tr-cell"/.test(detailOther), '缩略图行用 .tr-cell 格子');
// 1~4 张，一行排完（不横滑）
const rowCells = (detailOther.match(/class="tr-cell"/g) || []).length;
check(rowCells >= 1 && rowCells <= 4, `缩略图行是 1~4 张（实际 ${rowCells} 张）`);
check(!/today-row[^"]*"[\s\S]{0,2000}overflow-x/.test(detailOther), '缩略图行不横滑（一行展示完）');

// ③ 打卡照片条在目标卡之后、断卡卡之前
const iStripOther = detailOther.indexOf('photo-strip big');
const iBreakOther = detailOther.indexOf('brk-card');
check(iStripOther > -1, '围观者版有放大的打卡照片条（.photo-strip.big）');
check(iCardOther > -1 && iStripOther > iCardOther, '围观者版：打卡照片条在目标卡【之后】');
check(iBreakOther > -1 && iStripOther < iBreakOther, '围观者版：打卡照片条在断卡/状态区【之前】');
check(/打卡照片 · 平台内公开/.test(detailOther), '围观者版有「打卡照片 · 平台内公开」标题');

// ④ 点某一天 → 进打卡详情页（不是图片查看器）
check(/class="ps-cell[^"]*"[\s\S]{0,300}data-go="checkinLogItem" data-id="[^"]+" data-day="\d+"/.test(detailOther), '围观者版打卡照点格子进【打卡详情页】');

// 缩略图行 → 图片查看器
check(/data-act="openPhoto"/.test(detailOther), '围观者版缩略图可点开查看器（data-act="openPhoto"）');
// 生活照画廊不再单独占一块（已并进顶部缩略图行）
check(!/class="ex-gallery big"/.test(detailOther), '围观者版不再有独立的生活照画廊区');

// 本人版：状态在前，照片在后（保持原样）
/* ⚠️ 2026-11-24（本轮，用户口径 Part II③）：本人视角现在也展示
   当天的打卡照片和心情留言（与广场对齐），没发布时保留空位。 */
const iPhotoMine  = detailMine.indexOf('photo-strip');
const iBreakMine  = detailMine.indexOf('brk-card');
check(iBreakMine > -1 && iPhotoMine > iBreakMine, '本人版：状态区在照片区【之前】（维持原布局）');
check(/我今天的照片/.test(detailMine), '本人版出现「我今天的照片」（Part II③ 对齐广场）');
check(/class="today-row"/.test(detailMine), '本人版有缩略图行');
check(/tr-empty/.test(detailMine), '本人版没发布时保留空位（tr-empty）');
check(!/photo-strip big/.test(detailMine), '本人版照片条不是放大版');
/* 本人版照片仍走物证详情页（不是查看器） */
check(/data-go="checkinLogItem"/.test(detailMine), '本人版照片仍点进物证详情页');

// 图片查看器
check(/function openPhotoViewer\(/.test(appSrc), 'app.js 有 openPhotoViewer()');
check(/case 'openPhoto'/.test(appSrc), 'app.js 有 openPhoto 动作');
check(/\.pv\{/.test(cssSrc), 'CSS 定义 .pv（图片查看器）');
check(/\.pv-track\{/.test(cssSrc), 'CSS 定义 .pv-track（横向滑动）');
check(/\.today-row\{/.test(cssSrc), 'CSS 定义 .today-row（缩略图行）');
check(/\.tr-cell\{/.test(cssSrc), 'CSS 定义 .tr-cell（缩略图格子）');
check(/id="pv"/.test(fs.readFileSync(path.join(__dirname,'..','DEMO.html'),'utf8')), 'DEMO.html 有图片查看器容器');
// 查看打卡照会记为「已看物证」→ 异议前置条件（见 R4.3 ②）
check(/markEvidenceSeen\(p\.evidenceId, p\.evidenceDay\)/.test(appSrc), '查看打卡照会标记「已看物证」');
// recentPhotosRow —— 缩略图行的数据源
check(/function recentPhotosRow\(/.test(fs.readFileSync(path.join(__dirname, '..', 'js','data.js'),'utf8')), 'data.js 有 recentPhotosRow()');

/* ─────────────────────────────────────────────
   10b. 导航栏身份条（见需求规格 R2.9）
   ───────────────────────────────────────────── */
console.log('\n=== 10b. 导航栏身份条 ===');
check(/function navIdentity\(/.test(pagesSrc), 'pages.js 有 navIdentity()');
check(/class="nav-id( tap)?"/.test(detailOther), '围观者版导航栏有身份条（.nav-id）');
/* ⚠️ 身份条整条可点 → 直接进「Ta 的主页」（下方独立按钮已删除） */
check(/class="nav-id tap" data-go="userProfile"/.test(detailOther), '身份条可点进「Ta 的主页」');
check(/class="nav-id-slot"/.test(detailOther), '身份条放在返回键右边的槽位（.nav-id-slot）');
// 内容：身份条只留【头像 + 名字】（2026-11-22 用户口径：周期与档位挪到屏幕右边）
check(/nav-id[\s\S]{0,400}class="avatar/.test(detailOther), '身份条有头像');
check(/nav-id-name">小美</.test(detailOther), '身份条有目标人名字');
check(!/nav-id-days"/.test(detailOther), '身份条不再有周期天数（已挪到右侧）');
check(!/nav-id-tier"/.test(detailOther), '身份条不再有强度档位名（已挪到右侧）');
check(!/nav-id-go/.test(detailOther), '身份条右侧没有多余的「›」箭头');
// 右侧：「90 天 · 押金 ¥500」
// ⚠️ 2026-11-22 用户口径：「在目标详情页，最上面的强见证、轻见证改为显示用户的押金金额。」
check(/function navTier\(/.test(pagesSrc), 'pages.js 有 navTier()');
check(/class="nav-tier"/.test(detailOther), '导航栏右侧有「周期 · 押金」块（.nav-tier）');
/* ⚠️ 2026-11-23 用户口径：「把右上角的 90 天删掉，不用展示了，押金和 T3 正常展示。」
   —— 右侧现在是「押金 ¥1000 · T3」，周期天数拿掉。 */
check(!/nav-tier-days/.test(detailOther), '右侧不再有周期天数（90 天）');
check(/nav-tier-dep">押金 ¥/.test(detailOther), '右侧显示押金金额');
check(/nav-tier-t">T3</.test(detailOther), '右侧显示 T 档位');
check(!/nav-tier-name">/.test(detailOther), '右侧不再显示强度档位名（已改为押金金额）');
check(!/nav-tier[\s\S]{0,400}class="tag violet">T3</.test(detailOther), '右侧不再有 T3 标签');
// 位置：返回键之后
const iBack  = detailOther.indexOf('nav-back');
const iIdSlot = detailOther.indexOf('nav-id-slot');
check(iBack > -1 && iIdSlot > iBack, '身份条在返回键【右边】');
// 位置：右侧块在身份条之后（屏幕最右）
const iTierSlot = detailOther.indexOf('nav-tier-slot');
check(iTierSlot > iIdSlot, '「周期 · 押金」在身份条之后（屏幕右边）');
// 目标卡里不再重复画身份（围观者版）
const cardPart = detailOther.slice(detailOther.indexOf('class="card"'));
check(!/nav-id/.test(cardPart), '围观者版目标卡里不再重复画身份条');
// 本人版：身份仍在目标卡，导航栏不放身份条
check(!/class="nav-id"/.test(detailMine), '本人版导航栏没有身份条');
check(/class="avatar sm"/.test(detailMine), '本人版身份仍在目标卡里');
check(/data-go="flagMenu"/.test(detailMine), '本人版导航栏仍有 ••• 菜单');
// CSS
check(/\.nav-id\{/.test(cssSrc), 'CSS 定义 .nav-id');
check(/\.nav-id-slot\{/.test(cssSrc), 'CSS 定义 .nav-id-slot');
check(/\.nav-tier\{/.test(cssSrc), 'CSS 定义 .nav-tier');
check(/\.nav-tier-slot\{/.test(cssSrc), 'CSS 定义 .nav-tier-slot');
check(/\.nav\.scrolled \.nav-id\{display:none;\}/.test(cssSrc), '导航栏收起时身份条让位给标题');

/* ─────────────────────────────────────────────
   11. info 弹层
   ───────────────────────────────────────────── */
console.log('\n=== 11. photoPrivacy 弹层 ===');
const INFO = vm.runInContext('INFO', sandbox);
check(!!INFO.photoPrivacy, 'INFO.photoPrivacy 存在');
check(/原图，不打码/.test(INFO.photoPrivacy), '弹层写明「原图，不打码」');
check(/一律在平台内公开/.test(INFO.photoPrivacy), '弹层写明一律公开、无关闭开关');
check(/不提供关闭开关/.test(INFO.photoPrivacy), '弹层写明不提供关闭开关');
check(/先征得对方同意/.test(INFO.photoPrivacy), '弹层提示第三方同意');
check(/站外/.test(INFO.photoPrivacy), '弹层写明站外不带照片');
check(/物证照片/.test(INFO.privacy) && /平台内公开/.test(INFO.privacy), 'INFO.privacy 写明照片在平台内公开');
check(!/100% 私密/.test(INFO.privacy), 'INFO.privacy 已删「100% 私密」');

/* ─────────────────────────────────────────────
   12. 合规文案同步
   ───────────────────────────────────────────── */
console.log('\n=== 12. 文档同步 ===');
const repoRoot = path.join(__dirname, '..', '..');
const readMd = f => { try { return fs.readFileSync(path.join(repoRoot, '文档', f), 'utf8'); } catch(e){ return ''; } };
const xq = readMd('需求规格.md');
// 2026-11-25：《合规红线.md》(W) 已整份删除并入《需求规格.md》+《上线清单.md》，
//             所以「平台内公开」这条口径现在由需求规格 R2.5 + 上线清单承担。
check(/### R2\.5 打卡照片公开/.test(xq), '需求规格有 R2.5');
check(/平台内公开/.test(xq) && /原图.{0,6}不打码/.test(xq), '需求规格 R2.5 写明照片平台内公开、原图不打码');
const xqPlain = xq.replace(/\*\*/g, '');
check(!/100% 私密/.test(xqPlain), '需求规格无「100% 私密」残影');
check(/一律公开/.test(xq) && /不提供关闭开关/.test(xq), '需求规格写明一律公开、不提供关闭开关');
// ⚠️ 2026-11-25：原先断言「需求规格用 ~~删除线~~ 标注『必须先看过物证才能投』」。
//    文档清理后终稿只留**现行规则**（不设「先看过物证」前置），不再保留划掉的旧规则，
//    所以这里改为断言「现行口径写清了」——既守住规则本身，也守住终稿不留历史标记。
check(!/~~必须先看过物证才能投~~/.test(xq), '需求规格不再用删除线保留旧规则（终稿只留现行口径）');
check(/不设「先看过物证才能投」的前置/.test(xq), '需求规格 R4.3 ② 写明异议不设「先看过物证」前置');
check(/异议页只展示「当天的照片」/.test(xq), '需求规格写明异议页只展示当天的照片');
const sj2 = readMd('设计说明.md');
check(/### D6\.13/.test(sj2), '设计说明有 D6.13（异议页只展示当天照片）');
const sj = readMd('设计说明.md');
// 2026-11-25：D2 章已合并为「D2.7 物证与隐私」等 5 节，旧编号以别名形式保留在
//             「旧编号别名」行里，所以 D2.6 / D2.7 都能查到。
check(/### D2\.[67]/.test(sj) && /旧编号别名.*D2\.6/.test(sj), '设计说明有 D2.6（并入 D2.7，保留别名）');
const ss = readMd('上线清单.md');
check(/## 打卡照片公开/.test(ss), '上线清单有「打卡照片公开」小节');
// 2026-11-21：大图模式 + 补充照片
check(/### R2\.6 打卡之外的补充照片/.test(xq), '需求规格有 R2.6（打卡之外的补充照片）');
check(/大图模式/.test(xq), '需求规格写明广场「大图模式」');
check(/### D2\.7/.test(sj), '设计说明有 D2.7');
check(/补充照片/.test(ss), '上线清单有「补充照片」小节');

console.log(fails === 0 ? '\n✅ 全部通过' : `\n❌ ${fails} 项失败`);
process.exit(fails === 0 ? 0 : 1);
