/**
 * 亏了 · 正式上线版 · 演示数据生成脚本
 * ===========================================================================
 * 【小白须知】这个脚本往数据库里塞一批「演示用」的用户和 Flag。
 *
 * 【什么时候用】
 *   · 上线前本地联调，没有真实数据时看效果
 *   · 演示给投资人 / 朋友看
 *
 * 【⚠️ 正式上线前请不要在生产库跑这个】
 *   命令行加 --prod 参数时会拒绝执行并提示。
 *
 * 【怎么用】
 *   cd 02-后端
 *   npm run seed
 * ===========================================================================
 */
const db = require('../src/db');
const logger = require('../src/logger');
const { newId } = require('../src/utils');
const R = require('../src/domain/rules');

/** 演示用的假用户（openid 都是假的，登录时不会匹配上） */
const USERS = [
  { nickname: '老王', credit: 72 },
  { nickname: '阿May', credit: 65 },
  { nickname: '大壮', credit: 58 },
  { nickname: '小美', credit: 81 },
  { nickname: '老周', credit: 66 },
  { nickname: '果果', credit: 70 },
];

const FLAGS = [
  {
    u: 0, title: '婚礼前 90 天，瘦到能穿回那件西装', reason: '同事都说我胖了两年了',
    sw: 68.4, tw: 60.0, days: 90, deposit: 1000, status: 'running', checked: 68, tier: 'T2',
  },
  {
    u: 1, title: '30 天从 58.2 降到 55，赌一顿火锅', reason: '体检报告出来了，血脂偏高',
    sw: 58.2, tw: 55.0, days: 30, deposit: 500, status: 'running', checked: 19, tier: 'T2',
  },
  {
    u: 2, title: '14 天不喝奶茶，体重必须掉 2 公斤', reason: '被女朋友说胖了，这次要争口气',
    sw: 76.5, tw: 74.5, days: 14, deposit: 200, status: 'running', checked: 12, tier: 'T0',
  },
  {
    u: 3, title: '90 天备孕前减 8 公斤，把体检指标拉回正常', reason: '医生说多囊需要先减重',
    sw: 71.2, tw: 63.2, days: 90, deposit: 1000, status: 'running', checked: 52, tier: 'T3',
  },
  {
    u: 4, title: '30 天把体脂从 25% 降到 21%', reason: '去年买的西装又穿不上了',
    sw: 80.0, tw: 77.0, days: 30, deposit: 500, status: 'success', checked: 30, tier: 'T1',
  },
  {
    u: 5, title: '30 天没吃夜宵，从 62 到 58', reason: '连续熬夜一年了',
    sw: 62.0, tw: 58.0, days: 30, deposit: 500, status: 'failed', checked: 27, tier: 'T1',
  },
];

async function main() {
  if (process.argv.includes('--prod')) {
    console.error('\n❌ 拒绝在生产环境生成演示数据。\n   正式上线不需要这一步。\n');
    process.exit(1);
  }

  logger.info('开始生成演示数据');
  const created = [];

  for (const u of USERS) {
    const id = newId('usr');
    await db.execute(
      `INSERT INTO user (id, openid, nickname, avatar_url, bio, credit_score, flags_created)
       VALUES (?, ?, ?, '', ?, ?, ?)`,
      [id, `demo_openid_${id}`, u.nickname, '演示用户', u.credit, 1]
    );
    await db.execute('INSERT INTO user_stat (user_id) VALUES (?)', [id]);
    created.push({ id, nickname: u.nickname });
  }

  for (const f of FLAGS) {
    const owner = created[f.u];
    const period = R.PERIODS[f.days];
    const prepEnd = new Date();
    const { startDate, endDate } = R.calcDates(f.days, prepEnd);

    const flagId = newId('flg');
    const tierName = R.creditTierOf(owner ? USERS[f.u].credit : 60);
    const failRate = R.CREDIT_TIER_RULES[tierName].failRate;

    await db.execute(
      `INSERT INTO flag
         (id, user_id, title, reason, start_weight, target_weight, cur_weight,
          period_days, created_at, prep_end_at, start_date, end_date, status,
          tier, tier_history, deposit_amount, deposit_paid, deposit_rate, deposit_status,
          checked_days, streak, breaks, break_limit, watch_count, like_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'paid', ?, ?, 0, ?, ?)`,
      [
        flagId, owner.id, f.title, f.reason,
        f.sw, f.tw, f.sw - (f.sw - f.tw) * 0.6,
        f.days, new Date(), prepEnd, startDate, endDate,
        f.status, f.tier, JSON.stringify([]),
        f.deposit, failRate,
        f.checked, Math.min(f.checked, 5), 0, period.breakLimit,
        Math.floor(Math.random() * 60) + 8, Math.floor(Math.random() * 40) + 3,
      ]
    );

    /* 补打卡记录 */
    for (let d = 1; d <= f.checked; d++) {
      const w = Number((f.sw - (f.sw - f.tw) * (d / f.days)).toFixed(1));
      const isNode = period.nodeDays.includes(d);
      await db.execute(
        `INSERT INTO checkin (id, flag_id, user_id, day_index, check_date, weight, handwrite, status, is_node_day)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ok', ?)`,
        [
          newId('cki'), flagId, owner.id, d,
          new Date(Date.now() - (f.checked - d) * 86400000).toISOString().slice(0, 10),
          w, ['坚持', '加油', '今天也是', '稳'][d % 4], isNode ? 1 : 0,
        ]
      );
    }
  }

  logger.info('演示数据生成完成', { users: created.length, flags: FLAGS.length });
  console.log('\n✅ 演示数据已生成：%d 个用户、%d 个 Flag\n', created.length, FLAGS.length);
}

main()
  .then(() => db.close())
  .catch(async (e) => {
    logger.error('生成演示数据失败', { err: e.message });
    console.error('\n❌ 失败：', e.message, '\n');
    await db.close();
    process.exit(1);
  });
