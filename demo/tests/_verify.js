/* 反向校验脚本（临时）—— 断言押金区间制的不变式
   用 vm 沙箱直接跑 data.js，取出真实常量而不是正则解析 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const EXPORT = `
globalThis.__out = { CREDIT_TIERS, FLAG_DEP_RANGE, DEP_TIERS, CREDIT_FLAG, depositRange, allowedPeriods, creditFailPenalty, creditEarnSchedule };
`;
const sandbox = { console, window: {}, document: { getElementById: () => null } };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src + EXPORT, sandbox);

const { CREDIT_TIERS, FLAG_DEP_RANGE, DEP_TIERS, CREDIT_FLAG, depositRange, allowedPeriods, creditFailPenalty, creditEarnSchedule } = sandbox.__out;

let fails = 0;
function assert(cond, msg){
  if(!cond){ console.log('  ✗ ' + msg); fails++; }
  else console.log('  ✓ ' + msg);
}
const PERIODS = [7,14,30,90];

console.log('=== 抽到的真实常量 ===');
console.log('CREDIT_TIERS:', CREDIT_TIERS.map(t=>`${t.name}(cap ${t.depCap}, rate ${t.rate}%, ${t.maxFlag})`).join(' / '));
console.log('FLAG_DEP_RANGE:', JSON.stringify(FLAG_DEP_RANGE));
console.log('DEP_TIERS:', DEP_TIERS.join(','));

console.log('\n=== 1. 可立周期：公式推导 == 表中 maxFlag ===');
for(const t of CREDIT_TIERS){
  const allowed = allowedPeriods(t.min);
  const listed = t.maxFlag.match(/\d+/g).map(Number);
  assert(JSON.stringify(allowed)===JSON.stringify(listed),
    `${t.name}(cap ${t.depCap}) 推导 [${allowed}] == maxFlag [${listed}]`);
}

console.log('\n=== 2. 每个可立周期至少 2 个可选档位（无单档格）===');
for(const t of CREDIT_TIERS){
  for(const d of PERIODS){
    const r = depositRange(t.min, d);
    if(!r.allowed) continue;
    assert(r.options.length>=2, `${t.name} / ${d}天 区间 ${r.min}-${r.max} → ${r.options.length} 档 [${r.options}]`);
  }
}

console.log('\n=== 3. 同信用下周期越长 → 最低失败损失严格递增 ===');
for(const t of CREDIT_TIERS){
  const losses = PERIODS.filter(d=>depositRange(t.min,d).allowed)
    .map(d=>({d, loss: Math.round(depositRange(t.min,d).min * t.rate/100)}));
  let ok = true;
  for(let i=1;i<losses.length;i++) if(losses[i].loss <= losses[i-1].loss) ok=false;
  assert(ok, `${t.name} ${t.rate}% → ${losses.map(x=>`${x.d}天:${x.loss}元`).join(' → ')}`);
}

console.log('\n=== 4. 同周期下信用越高 → 损失不更大 ===');
for(const d of PERIODS){
  const row = CREDIT_TIERS.map(t=>{
    const r = depositRange(t.min,d);
    return r.allowed ? {name:t.name, minLoss:Math.round(r.min*t.rate/100), maxLoss:Math.round(r.max*t.rate/100)} : null;
  }).filter(Boolean);
  let ok = true;
  for(let i=1;i<row.length;i++) if(row[i].minLoss > row[i-1].minLoss) ok=false;
  assert(ok, `${d}天 → ${row.map(x=>`${x.name}:${x.minLoss}~${x.maxLoss}`).join(' | ')}`);
}

console.log('\n=== 5. 跨信用+跨周期极端：卓越90天最低 > 普通14天最高 ===');
{
  const ex = CREDIT_TIERS.find(t=>t.name==='卓越'), ord = CREDIT_TIERS.find(t=>t.name==='普通');
  const a = Math.round(depositRange(ex.min,90).min * ex.rate/100);
  const b = Math.round(depositRange(ord.min,14).max * ord.rate/100);
  assert(a > b, `卓越90天最低 ${a} > 普通14天最高 ${b}`);
}

console.log('\n=== 6. 信用分取整：所有 (周期 × 强度) 加减分 × 0.6/0.8/1.0 均为整数 ===');
for(const d of PERIODS){
  for(const tierKey of ['T0','T1','T2','T3']){
    const earn = creditEarnSchedule(d, tierKey);
    const fail = creditFailPenalty(d, tierKey);
    const allInt = earn.every(e=>Number.isInteger(e.value)) && Number.isInteger(fail);
    assert(allInt, `${d}天 ${tierKey} → 成功 ${earn.map(e=>e.value).join('+')} / 失败 ${fail}（全整数）`);
  }
}

console.log('\n=== 7. 周期下限严格递增 ===');
{
  const mins = PERIODS.map(d=>FLAG_DEP_RANGE[d].min);
  let ok = true;
  for(let i=1;i<mins.length;i++) if(mins[i] <= mins[i-1]) ok=false;
  assert(ok, `下限 ${mins.join(' < ')}`);
}

console.log('\n=== 8. 信用<80 立不了 90 天（公式自然推论）===');
{
  const good = CREDIT_TIERS.find(t=>t.name==='良好'), exc = CREDIT_TIERS.find(t=>t.name==='优秀');
  assert(!depositRange(good.min,90).allowed, `良好(${good.depCap}) 立不了 90 天`);
  assert(depositRange(exc.min,90).allowed, `优秀(${exc.depCap}) 能立 90 天`);
}

console.log('\n=== 9. 第一个 Flag 免费：7/14 天 ===');
{
  assert(PERIODS.slice(0,2).every(d=>FLAG_DEP_RANGE[d].min>0), '7/14 天有区间下限（免费是特例豁免）');
  assert(PERIODS.slice(2).every(d=>FLAG_DEP_RANGE[d].min>0), '30/90 天同样有下限（不免费）');
}

console.log('\n=== 10. 扣收比例：仅随信用，不随周期 ===');
{
  const rates = new Set();
  for(const t of CREDIT_TIERS) for(const d of PERIODS) rates.add(depositRange(t.min,d).rate);
  assert(rates.size===5, `费率取值种类 = ${rates.size}（应为 5 种信用档费率）`);
  for(const t of CREDIT_TIERS){
    const rs = PERIODS.map(d=>depositRange(t.min,d).rate);
    assert(new Set(rs).size===1, `${t.name} 在所有周期费率恒为 ${t.rate}%`);
  }
}

console.log('\n=== 11. 每周期固定 4 个档位（2×2 展示）+ 首次免费 0 元档 ===');
{
  /* ⚠️ 2026-11-22 用户口径（改）：「取消掉固定 0 元这个设定了……还是改成只有首次可以 0 元。
     首次免费只有 7、14 因为用户信用分选不了其他的。」
     —— 0 元档只在【第一个 Flag】时出现，且只覆盖 7 / 14 天。 */
  const EXPECT = { 7:[0,100,200,300,500], 14:[0,200,300,500,1000], 30:[0,500,1000,1500,2000], 90:[0,1000,1500,2000,5000] };
  const EXPECT_NOFREE = { 7:[100,200,300,500], 14:[200,300,500,1000], 30:[500,1000,1500,2000], 90:[1000,1500,2000,5000] };
  /* 首次免费（firstFree=true）时：只有 7 / 14 天有 0 元档 */
  for(const d of PERIODS){
    const r = depositRange(100, d, true);
    const want = (d === 7 || d === 14) ? EXPECT[d] : EXPECT_NOFREE[d];
    assert(r.tiers.length===want.length, `首次 ${d}天 展示 ${r.tiers.length} 个档位（应为 ${want.length}）`);
    assert(JSON.stringify(r.tiers.map(t=>t.value))===JSON.stringify(want),
      `首次 ${d}天 档位 = ${want.join(' / ')}`);
    const hasZero = r.options.includes(0);
    assert(hasZero === (d === 7 || d === 14),
      `首次 ${d}天 ${hasZero ? '有' : '没有'} 0 元档（只有 7 / 14 天有）`);
    if(hasZero){
      assert(r.tiers[0].value===0 && r.tiers[0].zero===true && !r.tiers[0].locked,
        `首次 ${d}天 0 元档在最前、永远可选`);
      assert(r.options[0]===0, `首次 ${d}天 可选档位含 0 元档`);
    }
  }
  /* 非首次（firstFree=false）时：任何周期都没有 0 元档 */
  for(const t of CREDIT_TIERS){
    for(const d of PERIODS){
      const r = depositRange(t.min, d, false);
      assert(!r.options.includes(0), `${t.name}/${d}天 非首次不再有 0 元档`);
      assert(r.tiers.length===4, `${t.name}/${d}天 非首次只展示 4 个付费档位`);
      assert(r.hasZero===false, `${t.name}/${d}天 hasZero = false`);
    }
  }
}

console.log('\n=== 12. 全局阶梯 9 档 + 锁定档位规则 ===');
{
  assert(DEP_TIERS.length===9, `全局阶梯 ${DEP_TIERS.length} 档（应为 9）`);
  let asc = true;
  for(let i=1;i<DEP_TIERS.length;i++) if(DEP_TIERS[i] <= DEP_TIERS[i-1]) asc=false;
  assert(asc, `阶梯严格递增：${DEP_TIERS.join(' / ')}`);
  for(const t of CREDIT_TIERS){
    for(const d of PERIODS){
      const r = depositRange(t.min, d, false);
      if(!r.allowed) continue;
      const locked = r.tiers.filter(x=>x.locked);
      assert(locked.every(x=>x.value > r.max), `${t.name}/${d}天 锁定档位均高于信用上限 ${r.max}`);
      assert(r.options.every(v=>!r.tiers.find(x=>x.value===v).locked), `${t.name}/${d}天 可选档位均未锁定`);
      /* 非首次：付费 4 档 = 可选 + 锁定 */
      assert(r.options.length + locked.length === 4, `${t.name}/${d}天 可选 ${r.options.length} + 锁定 ${locked.length} = 4`);
    }
  }
}

console.log('\n=== 12b. 首次免费只覆盖 7 / 14 天（30 / 90 天即使是第一个 Flag 也按下限缴） ===');
{
  for(const d of [30, 90]){
    const r = depositRange(100, d, true);
    assert(!r.options.includes(0), `首次 ${d}天 不提供 0 元档（见需求规格 R10.4 边界）`);
    assert(r.min > 0, `首次 ${d}天 押金下限仍是 ${r.min} 元`);
  }
  /* 首次免费 + 信用不足的周期：区间为空，但 0 元档仍在 7 / 14 天可见 */
  const lim = depositRange(45, 7, true);
  assert(lim.options.includes(0), '受限信用 7 天首次仍可选 0 元档');
}

console.log('\n' + (fails===0 ? '✅ 全部通过' : `❌ ${fails} 项失败`));
process.exit(fails===0?0:1);
