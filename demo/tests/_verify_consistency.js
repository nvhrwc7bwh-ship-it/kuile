/* 一致性巡检 —— 跨「文档 + 代码」检查同一口径是否一致
 *
 * 目的：节点按周期缩放 + 异议链路简化这两轮重构改动面很大，
 * 散落在 8 个文件里。人工容易漏改，漏改的后果是「文档说 +8、代码说 +6」。
 * 这个脚本把「必须一致」的几组数字钉死。
 *
 * 用法：node _verify_consistency.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
// readMd 读「文档/」下的 md；readCode 读仓库根下的代码文件
const readMd = (p) => fs.readFileSync(path.join(ROOT, '文档', p), 'utf8');
const readCode = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const FILES = {
  spec:   '需求规格.md',
  design: '设计说明.md',
  tech:   '技术选型.md',
  layout: '页面布局与交互规格.md',
  info:   'demo/js/info.js',
  pages:  'demo/js/pages.js',
  data:   'demo/js/data.js',
  state:  'demo/js/state.js',
  pits:   '问题与坑.md',
};

const T = {};
for (const [k, f] of Object.entries(FILES)) T[k] = f.endsWith('.md') ? readMd(f) : readCode(f);

let fails = 0;
const problems = [];
// 剥掉 markdown 加粗标记，让 "**+4** / **+6**" 这类写法也能被匹配到
const strip = (s) => s.replace(/\*\*/g, '');
function check(cond, msg){
  if (!cond) { console.log('  [FAIL] ' + msg); fails++; }
  else console.log('  [ OK ] ' + msg);
}
function group(title){ console.log('\n=== ' + title + ' ==='); }

// ─────────────────────────────────────────────
// 1. 周上限必须是 +8（全网不得再出现 +6 上限）
// ─────────────────────────────────────────────
group('1. 每周见证加分上限 = +8（不留 +6 残影）');
{
  // 需求规格：上限只允许 +8
  check(/每周上限 \+8/.test(strip(T.spec)), '需求规格 R5.7 写明「每周上限 +8」');
  check(/见证席加分\*\*每周上限 \+8\*\*/.test(T.spec), '需求规格 R8.1 汇总表写明 +8');
  check(!/每周上限 \+6/.test(strip(T.spec)), '需求规格无「每周上限 +6」残影');

  // 设计说明不应出现 +6 上限（只允许出现在「+6 → +8」的迁移说明里）
  check(!/每周见证加分上限 \+6/.test(strip(T.design)), '设计说明无「每周见证加分上限 +6」残影');
  check(!/每周上限 \+6/.test(strip(T.layout)), '页面布局规格无 +6 上限残影');

  // demo 代码：常量 +8
  check(/weeklyCap:\s*8/.test(T.data), 'data.js CREDIT_WITNESS.weeklyCap = 8');
  check(!/weeklyCap:\s*6/.test(T.data), 'data.js 无 weeklyCap: 6');

  // demo 文本：不得出现「上限 +6」
  check(!/上限 \+6/.test(T.info), 'info.js 无「上限 +6」文案');
  check(!/上限 \+6/.test(T.pages), 'pages.js 无「上限 +6」文案');
  check(/上限 \+8/.test(T.info), 'info.js 存在「上限 +8」文案');
}

// ─────────────────────────────────────────────
// 2. 陪到底收益必须与节点数一致（+4/+6/+8/+8）
// ─────────────────────────────────────────────
group('2. 陪到底收益 +4 / +6 / +8 / +8 与节点数对齐');
{
  // 先剥掉 markdown 加粗标记，避免 "**+4**" 这种写法匹配不到
  const seq = /\+4 \/ \+6 \/ \+8 \/ \+8/;
  // 逐档校验映射关系：7 天→+4 / 14 天→+6 / 30 天→+8 / 90 天→+8
  const MAP = [[7, 4], [14, 6], [30, 8], [90, 8]];
  const targets = [
    ['spec', T.spec], ['design', T.design], ['info', T.info], ['pages', T.pages],
  ];
  for (const [name, txt] of targets) {
    const s = strip(txt);
    let ok = true;
    const bad = [];
    for (const [d, v] of MAP) {
      // "7 天" 后面 80 字内必须出现 "+4"
      const re = new RegExp(`${d} 天[\\s\\S]{0,80}?\\+${v}(?!\\d)`);
      if (!re.test(s)) { ok = false; bad.push(`${d}天→+${v}`); }
    }
    check(ok, `${FILES[name]} 陪到底映射 7→+4 / 14→+6 / 30→+8 / 90→+8${ok ? '' : '（缺: ' + bad.join(', ') + '）'}`);
  }
  // 旧口径「陪到底 +6」不得出现在当前规则里
  check(!/陪到底 \+6/.test(strip(T.spec)), '需求规格无「陪到底 +6」旧口径');
  check(!/陪到底 \+6/.test(strip(T.design)), '设计说明无「陪到底 +6」旧口径');
}

// ─────────────────────────────────────────────
// 3. 节点计划在文档与代码中必须完全一致
// ─────────────────────────────────────────────
group('3. 节点计划（7/14/30/90 → 2/3/4/4）文档与代码一致');
{
  const PLAN = { 7: [1,7], 14: [1,7,14], 30: [1,10,20,30], 90: [1,30,60,90] };
  for (const [d, pos] of Object.entries(PLAN)) {
    const label = pos.join(' / ');
    check(T.spec.includes(label), `需求规格含节点位置「${label}」（${d} 天档）`);
  }
  // data.js 的 NODE_PLAN 字面量
  check(/7:\s*\[1,\s*7\]/.test(T.data), 'data.js NODE_PLAN 7 天 = [1,7]');
  check(/14:\s*\[1,\s*7,\s*14\]/.test(T.data), 'data.js NODE_PLAN 14 天 = [1,7,14]');
  check(/30:\s*\[1,\s*10,\s*20,\s*30\]/.test(T.data), 'data.js NODE_PLAN 30 天 = [1,10,20,30]');
  check(/90:\s*\[1,\s*30,\s*60,\s*90\]/.test(T.data), 'data.js NODE_PLAN 90 天 = [1,30,60,90]');
  // 需求规格的判定次数表
  check(/\*\*2 次\*\*/.test(T.spec) && /\*\*3 次\*\*/.test(T.spec) && /\*\*4 次\*\*/.test(T.spec),
    '需求规格 R5.4 表含 2 次 / 3 次 / 4 次');
}

// ─────────────────────────────────────────────
// 4. 「3 个称重节点」这类写死的旧措辞不得残留
// ─────────────────────────────────────────────
group('4. 写死的节点措辞已全部改成「按周期定」');
{
  check(!/3 个称重节点/.test(T.layout), '页面布局规格无「3 个称重节点」');
  check(!/只在 3 个称重节点/.test(strip(T.spec)), '需求规格无「只在 3 个称重节点」');
  // 需求规格里的角色表与义务表必须写「按周期」
  check(/节点数按周期定：2–4 个/.test(T.spec), '需求规格 R0.1 角色表写「2–4 个」');
  check(/按周期 2–4 个节点各判定一次/.test(T.spec), '需求规格 R5.1 义务行写「2–4 个节点」');
}

// ─────────────────────────────────────────────
// 5. 异议 / 举报 两条通道必须分开
// ─────────────────────────────────────────────
group('5. 举报（见证席）与异议（监督席）两条通道独立');
{
  check(/监督席异议 ≥3 票/.test(T.spec), '需求规格写明监督席异议 ≥3 票');
  check(/仅监督席/.test(T.spec) && /仅见证席/.test(T.spec), '需求规格写明两条通道的权限归属');
  check(/不经 AI|不经AI/.test(T.spec), '需求规格写明质疑路径不经 AI');
  // demo：不存在 report 页，objection 页存在
  check(!/PAGES\.report\s*=/.test(T.pages), 'demo 无 report 页（已拆为 objection）');
  check(/PAGES\.objection\s*=/.test(T.pages), 'demo 有 objection 页');
  check(/需满 3 票|满 3 票/.test(T.pages), 'demo 异议页提示 3 票阈值');
  // 监督席按钮不能叫「举报作弊」
  check(!/举报作弊/.test(T.pages), 'demo 无「举报作弊」按钮文案（监督席用「提出异议」）');
}

// ─────────────────────────────────────────────
// 6. 数据模型：report 并入 verdict，新增 objection / appeal
// ─────────────────────────────────────────────
group('6. 技术选型数据模型与拆分后的通道一致');
{
  check(/objection/.test(T.tech), '技术选型含 objection 集合');
  check(/appeal/.test(T.tech), '技术选型含 appeal 集合');
  check(/不再单设 report 集合/.test(T.tech), '技术选型写明 report 并入 verdict');
  check(/节点数按周期缩放/.test(T.tech), '技术选型 node 集合写明节点数按周期缩放');
  check(/节点计划在发起时算好并写进规则快照/.test(T.tech), '技术选型写明节点计划写入规则快照');
}

// ─────────────────────────────────────────────
// 8. 见证席机制简化：筹备期 24h / 邀约 12h / 召集 20h / 坑位 10
// ─────────────────────────────────────────────
group('7. 筹备期与邀约时限全网一致（24h / 12h / 20h / 坑位 10）');
{
  // 需求规格：三个时限必须同时出现且写明数值
  check(/24 小时/.test(strip(T.spec)), '需求规格写明 24 小时筹备期');
  check(/12 小时/.test(strip(T.spec)), '需求规格写明 12 小时邀约有效期');
  check(/20 小时/.test(strip(T.spec)), '需求规格写明 20 小时召集报名窗口');
  check(/坑位上限 \*\*(10|10 个)\*\*/.test(strip(T.spec)) || /坑位上限.*10/.test(strip(T.spec)),
    '需求规格写明坑位上限 10');

  // data.js 常量
  check(/PREP_HOURS\s*=\s*24/.test(T.data), 'data.js PREP_HOURS = 24');
  check(/INVITE_TTL_HOURS\s*=\s*12/.test(T.data), 'data.js INVITE_TTL_HOURS = 12');
  check(/RECRUIT_WINDOW_HOURS\s*=\s*20/.test(T.data), 'data.js RECRUIT_WINDOW_HOURS = 20');
  check(/WITNESS_MAX\s*=\s*10/.test(T.data), 'data.js WITNESS_MAX = 10');

  // demo 文本不得残留旧时限
  check(!/10 分钟反悔期/.test(T.info), 'info.js 无「10 分钟反悔期」残影');
  check(!/10 分钟反悔期/.test(T.pages), 'pages.js 无「10 分钟反悔期」残影');
  check(!/48 小时<\/b>或招满即止/.test(T.info), 'info.js 召集窗口已从 48 小时改为 20 小时');
  check(!/为什么窗口是 48 小时/.test(T.pages), 'pages.js 召集页已改口径');
  check(!/3 天宽限期/.test(T.info), 'info.js 无「3 天宽限期」残影');
}

// ─────────────────────────────────────────────
// 9. 见证门槛：术语中文化 + 公式带 min
// ─────────────────────────────────────────────
group('8. 见证门槛术语中文化 + 门槛公式带 min');
{
  check(/见证门槛/.test(T.spec), '需求规格写「见证门槛」');
  check(!/\bquorum\b(?!Need)/.test(strip(T.spec)), '需求规格无裸 quorum（中文术语已替换）');
  check(/min\(应到人数/.test(strip(T.spec)), '需求规格见证门槛公式带 min（修掉 1 人名单永远降级的 bug）');

  // data.js 的公式实现
  check(/function witnessQuorum/.test(T.data), 'data.js 存在 witnessQuorum');
  check(/Math\.min\(n,\s*Math\.max\(2,\s*Math\.ceil\(n \* 0\.5\)\)\)/.test(T.data),
    'data.js 门槛公式 = min(应到, max(2, ceil(应到×50%)))');

  // 裸 quorum 只允许作为代码标识符存在，不得出现在面向用户的文案里
  const infoText = T.info;
  check(!/见证门槛进度[^<]*quorum/i.test(infoText), 'info.js 文案里无 quorum');
}

// ─────────────────────────────────────────────
// 10. 有效档位只降不升
// ─────────────────────────────────────────────
group('9. 有效档位只降不升（初始档位 + 降档不回弹）');
{
  check(/有效档位/.test(strip(T.spec)), '需求规格写明「有效档位」');
  check(/只降不升/.test(strip(T.spec)), '需求规格写明「只降不升」');
  check(/押金\s*\|\s*\*\*完全不变\*\*/.test(strip(T.spec)) || /降档不影响押金/.test(strip(T.spec)),
    '需求规格写明降档不影响押金');

  // data.js：tierMin 实现 + 按有效档位取系数的结算函数
  check(/function tierMin/.test(T.data), 'data.js 存在 tierMin（取更低档位）');
  check(/function creditEarnScheduleFor/.test(T.data), 'data.js 存在 creditEarnScheduleFor（按有效档位算分）');
  check(/function creditFailPenaltyFor/.test(T.data), 'data.js 存在 creditFailPenaltyFor（按有效档位扣分）');

  // state.js：降档运行时逻辑
  check(/function applyTierDowngrade/.test(T.data + T.state), 'state.js 存在 applyTierDowngrade（节点关闭时降档）');
  check(/effectiveTier/.test(T.data + T.state), 'state.js 记录 effectiveTier');
}

// ─────────────────────────────────────────────
// 11. 「见证门槛」在 demo 里必须是用户可读的词
// ─────────────────────────────────────────────
group('11. demo 文案用「见证门槛」而不是 quorum');
{
  check(/见证门槛/.test(T.pages), 'pages.js 用「见证门槛」');
  check(/见证门槛进度/.test(T.pages), 'pages.js 见证席面板显示「见证门槛进度」');
  check(/见证门槛/.test(T.info), 'info.js 含「见证门槛」说明条目');
}

// ─────────────────────────────────────────────
// 12. demo 精简：内部页面已删除，且不再有残留入口
// ─────────────────────────────────────────────
group('12. demo 精简（内部页面已删除，无残留入口）');
{
  const app = readCode('demo/js/app.js');
  const DEAD_ROUTES = ['ladder', 'records', 'shadow', 'platform', 'points', 'credit', 'witnessProfile'];
  const routeBlock = (app.match(/const ROUTES = \{[\s\S]*?\n\};/) || [''])[0];

  for (const r of DEAD_ROUTES) {
    check(!new RegExp('^\\s{2}' + r + ':\\{', 'm').test(routeBlock),
      `app.js ROUTES 已无 ${r} 条目`);
    check(!new RegExp('data-go="' + r + '"').test(T.pages),
      `pages.js 无 data-go="${r}" 残留入口`);
  }

  // 页面正文不应再出现内部推演 / 内部运营口径
  const INTERNAL_WORDS = [
    '围观飞轮', '转化阶梯', 'Flutter', 'Riverpod', '咨询率红线',
    '社交压力的引擎', '完整证明链', '站外传播素材',
  ];
  for (const w of INTERNAL_WORDS) {
    check(!T.pages.includes(w), `pages.js 无内部文案「${w}」`);
  }

  // info.js 里被删页面对应的弹层不应残留
  const DEAD_INFO = ['quorum', 'anonymous', 'breakCard', 'points', 'flywheel', 'ladder', 'shadowGoal', 'platform'];
  const infoBlock = T.info;
  for (const k of DEAD_INFO) {
    check(!new RegExp('^' + k + ':\\s*`', 'm').test(infoBlock),
      `info.js 已无废弃弹层 ${k}`);
  }

  // INFO 与 INFO_TITLE 必须一一对应
  const def = new Set([...infoBlock.matchAll(/^([a-zA-Z][a-zA-Z0-9_]*):\s*`/gm)].map(m => m[1]));
  const titleBlock = (app.match(/const INFO_TITLE = \{[\s\S]*?\n\};/) || [''])[0];
  const titles = [...titleBlock.matchAll(/([a-zA-Z][a-zA-Z0-9_]*):\s*'/g)].map(m => m[1]);
  check(titles.every(k => def.has(k)), 'INFO_TITLE 无指向已删弹层的条目');
  check([...def].every(k => titles.includes(k)), 'info.js 每个弹层都有对应的 INFO_TITLE');
}

// ─────────────────────────────────────────────
// 13. 终稿口径：用户只看得懂「规则」，看不到「为什么这么设计」
// ─────────────────────────────────────────────
group('13. 终稿口径（无内部推演用语）');
{
  // 13.1 弹层与页面正文里禁止出现的「内部视角」用语
  const FORBIDDEN = [
    '为什么这么', '为什么我们', '我们只做', '我们认为', '本产品的逻辑',
    '设计意图', '设计取舍', '设计纯度', '产品论证', '核心判断',
    '刻意的', '之所以', '成本最低', '性价比最高', '最强钩子', '最便宜',
    '绕开监管', '规避监管', '合规红线', '二清', '博彩', 'DietBet',
    '围观飞轮', '社交压力的引擎', '完整证明链', '站外传播素材',
    '给运营看', '内部参考', '本节给', '供内部',
  ];
  for (const w of FORBIDDEN) {
    check(!T.info.includes(w), `info.js 无内部推演用语「${w}」`);
    check(!T.pages.includes(w), `pages.js 无内部推演用语「${w}」`);
  }

  // 13.2 弹层里不该出现「为什么」开头的解释句
  // 例外：「为什么要设押金的下限和上限」是用户直接要看的规则解释，属终稿口径，允许
  const ALLOWED_WHY = '为什么要设押金的下限和上限';
  const whyHits = [...T.info.matchAll(/为什么[^<]{0,40}/g)]
    .map(m => m[0])
    .filter(w => !w.startsWith(ALLOWED_WHY));
  check(whyHits.length === 0,
    `info.js 无「为什么」解释句${whyHits.length ? '：' + whyHits.join(' / ') : ''}`);

  // 13.3 每个弹层都必须有正文内容（表格 / 列表 / 段落）
  const defs = [...T.info.matchAll(/^([a-zA-Z][a-zA-Z0-9_]*):\s*`([\s\S]*?)^\s*`,/gm)];
  check(defs.length > 0, `info.js 解析出 ${defs.length} 个弹层`);
  for (const [, key, body] of defs) {
    const hasTable = /<table>/.test(body);
    const hasList = /<ul/.test(body) || /<ol/.test(body);
    const hasText = /<p[ >]/.test(body);
    check(hasTable || hasList || hasText, `弹层 ${key} 有正文内容`);
  }

  // 13.4 提示块用的 class 必须都有 CSS 定义（否则弹层里是裸文本）
  const css = readCode('demo/css/app.css');
  const usedClasses = new Set();
  for (const [, , body] of defs) {
    for (const m of body.matchAll(/class="([a-z0-9 ]+)"/g)) {
      m[1].split(/\s+/).filter(Boolean).forEach(c => usedClasses.add(c));
    }
  }
  for (const c of usedClasses) {
    check(new RegExp('\\.' + c + '\\s*[{,]').test(css),
      `弹层用到的 class="${c}" 在 app.css 有定义`);
  }

  // 13.5 步骤图 / 要点列表的新样式必须就位
  for (const c of ['good', 'warn', 'danger', 'note']) {
    check(css.includes('.sheet-body .' + c),
      `app.css 定义了 .sheet-body .${c}（弹层提示块）`);
  }
  check(css.includes('.sheet-body ul.key'), 'app.css 定义了 .sheet-body ul.key（要点列表）');
  check(css.includes('.sheet-body ol.flow'), 'app.css 定义了 .sheet-body ol.flow（步骤流程图）');
}

console.log(fails === 0 ? '\nALL PASSED' : `\n${fails} CHECKS FAILED`);
process.exit(fails === 0 ? 0 : 1);
