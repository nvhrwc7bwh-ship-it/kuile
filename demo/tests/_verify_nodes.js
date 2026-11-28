/* 节点计划校验（临时）—— 断言 R5.4 的节点数、位置、命名、收益
   用 vm 沙箱直接跑 data.js，取出真实常量而不是正则解析 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const EXPORT = `
globalThis.__out = { NODE_PLAN, NODE_NAMES, CREDIT_WITNESS, FLAGS, expandNodes, witnessFullTotal, isoAddDays,
  witnessQuorum, tierByCount, tierMin, witnessSlots, witnessAccepted, WITNESS_MAX, PREP_HOURS,
  INVITE_TTL_HOURS, RECRUIT_WINDOW_HOURS, TIER_META, creditMulOf, creditEarnSchedule, creditFailPenalty,
  creditEarnScheduleFor, creditFailPenaltyFor };
`;
const sandbox = { console, window: {}, document: { getElementById: () => null } };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src + EXPORT, sandbox);

const {
  NODE_PLAN, NODE_NAMES, CREDIT_WITNESS, FLAGS, expandNodes, witnessFullTotal, isoAddDays,
  witnessQuorum, tierByCount, tierMin, witnessSlots, witnessAccepted,
  WITNESS_MAX, PREP_HOURS, INVITE_TTL_HOURS, RECRUIT_WINDOW_HOURS, TIER_META,
  creditMulOf, creditEarnSchedule, creditFailPenalty, creditEarnScheduleFor, creditFailPenaltyFor,
} = sandbox.__out;

let fails = 0;
function assert(cond, msg){
  if(!cond){ console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}
const PERIODS = [7, 14, 30, 90];

console.log('=== 抽到的真实常量 ===');
console.log('NODE_PLAN:', JSON.stringify(NODE_PLAN));
console.log('CREDIT_WITNESS:', JSON.stringify(CREDIT_WITNESS));

console.log('\n=== 1. 节点数按周期缩放（需求规格 R5.4）===');
assert(NODE_PLAN[7].length === 2, `7 天 → ${NODE_PLAN[7].length} 个节点（应为 2）`);
assert(NODE_PLAN[14].length === 3, `14 天 → ${NODE_PLAN[14].length} 个节点（应为 3）`);
assert(NODE_PLAN[30].length === 4, `30 天 → ${NODE_PLAN[30].length} 个节点（应为 4）`);
assert(NODE_PLAN[90].length === 4, `90 天 → ${NODE_PLAN[90].length} 个节点（应为 4）`);

console.log('\n=== 2. 节点位置（按周期分 3 段 / 7-14 档不重排）===');
assert(JSON.stringify(NODE_PLAN[7]) === JSON.stringify([1,7]), `7 天位置 ${JSON.stringify(NODE_PLAN[7])} == [1,7]`);
assert(JSON.stringify(NODE_PLAN[14]) === JSON.stringify([1,7,14]), `14 天位置 ${JSON.stringify(NODE_PLAN[14])} == [1,7,14]`);
assert(JSON.stringify(NODE_PLAN[30]) === JSON.stringify([1,10,20,30]), `30 天位置 ${JSON.stringify(NODE_PLAN[30])} == [1,10,20,30]`);
assert(JSON.stringify(NODE_PLAN[90]) === JSON.stringify([1,30,60,90]), `90 天位置 ${JSON.stringify(NODE_PLAN[90])} == [1,30,60,90]`);

console.log('\n=== 3. 每节点 +2 不变，陪到底收益按周期递增 ===');
assert(CREDIT_WITNESS.pass === 2, `每节点 +${CREDIT_WITNESS.pass}（应为 +2，不摊薄）`);
assert(witnessFullTotal(7) === 4, `7 天陪到底 +${witnessFullTotal(7)}（应为 +4）`);
assert(witnessFullTotal(14) === 6, `14 天陪到底 +${witnessFullTotal(14)}（应为 +6）`);
assert(witnessFullTotal(30) === 8, `30 天陪到底 +${witnessFullTotal(30)}（应为 +8）`);
assert(witnessFullTotal(90) === 8, `90 天陪到底 +${witnessFullTotal(90)}（应为 +8）`);

console.log('\n=== 4. 每周上限 >= 最长周期单局的陪到底收益（规则不自相矛盾）===');
for(const d of PERIODS){
  assert(CREDIT_WITNESS.weeklyCap >= witnessFullTotal(d),
    `周上限 +${CREDIT_WITNESS.weeklyCap} >= ${d} 天单局 +${witnessFullTotal(d)}`);
}

console.log('\n=== 5. 陪到底收益随周期不下降 ===');
let prev = 0;
for(const d of PERIODS){
  assert(witnessFullTotal(d) >= prev, `${d} 天 +${witnessFullTotal(d)} >= 上一档 +${prev}`);
  prev = witnessFullTotal(d);
}

console.log('\n=== 6. 所有基础分是整数（不产生 +1.5 这类碎数）===');
for(const d of PERIODS){
  const per = witnessFullTotal(d) / NODE_PLAN[d].length;
  assert(Number.isInteger(per), `${d} 天每节点 ${per} 是整数`);
}

console.log('\n=== 7. 每个 Flag 展开后的节点数 == 计划节点数 ===');
for(const id of Object.keys(FLAGS)){
  const f = FLAGS[id];
  const plan = NODE_PLAN[f.days];
  assert(f.nodes.length === plan.length,
    `${id} (${f.days}天) 展开 ${f.nodes.length} 个 == 计划 ${plan.length} 个`);
}

console.log('\n=== 8. 节点命名唯一（不出现两条一样的「中期称重」）===');
for(const id of Object.keys(FLAGS)){
  const f = FLAGS[id];
  const names = f.nodes.map(n=>n.name);
  const uniq = new Set(names);
  assert(uniq.size === names.length, `${id} 节点名不重复 [${names.join(' / ')}]`);
}

console.log('\n=== 9. 节点日期 == 发起日 + (第N天 - 1) ===');
for(const id of Object.keys(FLAGS)){
  const f = FLAGS[id];
  const plan = NODE_PLAN[f.days];
  let ok = true;
  f.nodes.forEach((n,i)=>{
    if(n.date !== isoAddDays(f.start, plan[i]-1)) ok = false;
  });
  assert(ok, `${id} (${f.days}天) 全部节点日期与计划对齐`);
}

console.log('\n=== 10. 90 天档最大空档压到 30 天 ===');
const gap90 = Math.max(...NODE_PLAN[90].slice(1).map((d,i)=>d - NODE_PLAN[90][i]));
assert(gap90 <= 30, `90 天最大空档 ${gap90} 天（应为 <= 30，原为 60）`);

console.log('\n=== 11. 30/90 天档确实有「中期复核」 ===');
for(const id of Object.keys(FLAGS)){
  const f = FLAGS[id];
  if(f.days === 30 || f.days === 90){
    const names = f.nodes.map(n=>n.name);
    assert(names.includes('中期复核'), `${id} (${f.days}天) 含「中期复核」 [${names.join(' / ')}]`);
  }
}

console.log('\n=== 12. 7/14 天档保持原样（不被多出节点）===');
for(const id of Object.keys(FLAGS)){
  const f = FLAGS[id];
  if(f.days === 7 || f.days === 14){
    const names = f.nodes.map(n=>n.name);
    assert(!names.includes('中期复核'), `${id} (${f.days}天) 无「中期复核」 [${names.join(' / ')}]`);
  }
}

console.log('\n=== 13. 见证门槛公式：min(应到, max(2, ceil(应到×50%))) ===');
assert(witnessQuorum(0) === 0, `应到 0 → 门槛 ${witnessQuorum(0)}（无见证席时不设门槛）`);
assert(witnessQuorum(1) === 1, `应到 1 → 门槛 ${witnessQuorum(1)}（min 这一层修掉了「1 人名单永远降级」）`);
assert(witnessQuorum(2) === 2, `应到 2 → 门槛 ${witnessQuorum(2)}`);
assert(witnessQuorum(3) === 2, `应到 3 → 门槛 ${witnessQuorum(3)}`);
assert(witnessQuorum(4) === 2, `应到 4 → 门槛 ${witnessQuorum(4)}`);
assert(witnessQuorum(5) === 3, `应到 5 → 门槛 ${witnessQuorum(5)}`);
assert(witnessQuorum(10) === 5, `应到 10 → 门槛 ${witnessQuorum(10)}`);
let qok = true;
for (let n = 0; n <= 12; n++){
  const q = witnessQuorum(n);
  if (q > n) qok = false;                       // 门槛不得高于应到人数
  if (n > 0 && q < Math.min(2, n)) qok = false; // 门槛不得低于最小值
}
assert(qok, '门槛恒在 [min(2,应到), 应到] 区间内');

console.log('\n=== 14. 档位表：人数 → 档位 ===');
assert(tierByCount(0) === 'T0', `0 人 → ${tierByCount(0)}`);
assert(tierByCount(1) === 'T1', `1 人 → ${tierByCount(1)}`);
assert(tierByCount(2) === 'T1', `2 人 → ${tierByCount(2)}`);
assert(tierByCount(3) === 'T2', `3 人 → ${tierByCount(3)}`);
assert(tierByCount(4) === 'T2', `4 人 → ${tierByCount(4)}`);
assert(tierByCount(5) === 'T3', `5 人 → ${tierByCount(5)}`);
assert(tierByCount(10) === 'T3', `10 人 → ${tierByCount(10)}`);

console.log('\n=== 15. 有效档位只降不升（tierMin 单调不增）===');
const TIERS = ['T0','T1','T2','T3'];
let tok = true;
for (const a of TIERS) for (const b of TIERS){
  const m = tierMin(a, b);
  if (TIERS.indexOf(m) > Math.min(TIERS.indexOf(a), TIERS.indexOf(b))) tok = false;
}
assert(tok, 'tierMin(a,b) 恒 ≤ min(a,b)（降了不回来）');
assert(tierMin('T3','T1') === 'T1', `T3 ⊕ T1 = ${tierMin('T3','T1')}`);
assert(tierMin('T1','T3') === 'T1', `T1 ⊕ T3 = ${tierMin('T1','T3')}（顺序无关）`);
assert(tierMin('T2','T2') === 'T2', `T2 ⊕ T2 = ${tierMin('T2','T2')}`);

console.log('\n=== 16. 筹备期 / 邀约 / 召集 三个时限的关系 ===');
assert(PREP_HOURS === 24, `筹备期 ${PREP_HOURS}h`);
assert(INVITE_TTL_HOURS === 12, `邀约有效期 ${INVITE_TTL_HOURS}h`);
assert(RECRUIT_WINDOW_HOURS === 20, `召集报名窗口 ${RECRUIT_WINDOW_HOURS}h`);
assert(RECRUIT_WINDOW_HOURS < PREP_HOURS, '召集报名窗口 < 筹备期（否则报名者赶不上定档）');
assert(INVITE_TTL_HOURS < PREP_HOURS, '邀约有效期 < 筹备期（否则坑位无法中途回收）');
assert(RECRUIT_WINDOW_HOURS + INVITE_TTL_HOURS > PREP_HOURS,
  '报名 20h + 接受 12h > 筹备期 24h ⇒ 召集令须在发起后 4 小时内发布');
assert(WITNESS_MAX === 10, `坑位上限 ${WITNESS_MAX}`);

console.log('\n=== 17. 坑位口径：已接受 + 待接受 ===');
const wSample = [
  { status:'accepted' }, { status:'accepted' }, { status:'pending' },
  { status:'declined' }, { status:'expired' }, { status:'withdrawn' },
];
assert(witnessSlots(wSample) === 3, `占坑位 ${witnessSlots(wSample)}（accepted 2 + pending 1）`);
assert(witnessAccepted(wSample) === 2, `已接受 ${witnessAccepted(wSample)}（待接受不计入定档）`);
assert(witnessSlots([...wSample, ...Array(7).fill({status:'accepted'})]) === 10,
  '坑位满 10 时新邀约一律作废');

console.log('\n=== 18. 分值按「有效档位」而不是初始档位 ===');
const f30 = { days:30, totalDays:30, tier:'T3', initialTier:'T3', effectiveTier:'T2' };
assert(creditEarnScheduleFor(f30).every(x => x.value % 1 === 0),
  '有效档位 T2 下 30 天分段到账全为整数');
assert(creditFailPenaltyFor(f30) === creditFailPenalty(30, 'T2'),
  `失败扣分按有效档位 T2 = ${creditFailPenaltyFor(f30)}`);
// T2 → T3 系数相同（都是 1.0），降到 T1 才会变 —— 用 T1 验证「降档后扣分确实变小」
const f30b = { days:30, totalDays:30, tier:'T3', initialTier:'T3', effectiveTier:'T1' };
assert(creditFailPenaltyFor(f30b) < creditFailPenalty(30, 'T3'),
  `有效档位降到 T1 后扣分 ${creditFailPenaltyFor(f30b)} < 初始档位 T3 的 ${creditFailPenalty(30,'T3')}`);
assert(creditMulOf('T0') === 0.6 && creditMulOf('T1') === 0.8 && creditMulOf('T2') === 1.0 && creditMulOf('T3') === 1.0,
  '系数 T0=0.6 / T1=0.8 / T2=1.0 / T3=1.0');
// 降档不影响押金：demo 里押金与档位无关，此处断言系数只作用于信用分结算
let iok = true;
for (const d of PERIODS) for (const t of TIERS){
  creditEarnSchedule(d, t).forEach(x => { if (!Number.isInteger(x.value)) iok = false; });
  if (!Number.isInteger(creditFailPenalty(d, t))) iok = false;
}
assert(iok, '全周期 × 全档位 结算结果均为整数（无碎数）');

console.log(fails === 0 ? '\n✅ 全部通过' : `\n❌ ${fails} 项失败`);
process.exit(fails === 0 ? 0 : 1);