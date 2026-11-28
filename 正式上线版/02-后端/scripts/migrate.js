/**
 * 亏了 · 正式上线版 · 数据库迁移脚本
 * ===========================================================================
 * 【小白须知】这个脚本负责「把建表语句执行一遍，把数据库结构建出来」。
 *
 * 【怎么用】
 *   cd 02-后端
 *   npm run migrate
 *
 * 【它做了什么】
 *   1. 连上 .env 里配置的数据库
 *   2. 读 migrations/ 目录下所有 .sql 文件
 *   3. 按文件名顺序执行
 *   4. 记录执行过哪些文件（下次不会重复执行）
 *
 * 【幂等】重复跑不会出错 —— 建表语句都写了 DROP TABLE IF EXISTS。
 * ===========================================================================
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config');
const logger = require('../src/logger');

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');
const TRACK_TABLE = 'schema_migrations';

/* ---------------------------------------------------------------------------
 * 解析建表语句，得到「应该有哪几张表」
 *   用途：迁移结束后核对表数量，防止某张表建失败被静默吞掉。
 * ------------------------------------------------------------------------- */
function parseTableNames(sqlText) {
  const names = new Set();
  const re = /CREATE TABLE(?: IF NOT EXISTS)?\s+`(\w+)`/gi;
  let m;
  while ((m = re.exec(sqlText)) !== null) names.add(m[1]);
  return names;
}

async function main() {
  logger.info('开始数据库迁移', { host: config.db.host, database: config.db.database });

  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
    charset: 'utf8mb4',
  });

  try {
    /* 1. 确保追踪表存在 */
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`${TRACK_TABLE}\` (
        \`filename\` VARCHAR(255) NOT NULL,
        \`applied_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`filename\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    /* 2. 读出所有迁移文件 */
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (!files.length) {
      logger.warn('migrations 目录下没有 .sql 文件');
      return;
    }

    /* 3. 查已执行过的 */
    const [rows] = await conn.query(`SELECT filename FROM \`${TRACK_TABLE}\``);
    const applied = new Set(rows.map(r => r.filename));

    /* 3.5 收集所有迁移文件里「应该存在」的表名（供迁移后校验用） */
    const tablesInSql = new Set();
    for (const file of files) {
      const sqlText = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      parseTableNames(sqlText).forEach(t => tablesInSql.add(t));
    }

    /* 4. 逐个执行 */
    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        logger.info(`跳过（已执行）：${file}`);
        continue;
      }
      logger.info(`执行迁移：${file}`);
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await conn.query(sql);
      await conn.query(`INSERT INTO \`${TRACK_TABLE}\` (filename) VALUES (?)`, [file]);
      count++;
      logger.info(`完成：${file}`);
    }

    logger.info('数据库迁移完成', { total: files.length, executed: count });
    console.log('\n✅ 数据库迁移完成，共执行 %d 个文件\n', count);

    /* ---- 建表后校验：确认每张表都真的建出来了 ----
     * 【为什么需要这一步】
     *   历史上出过事故：flag 表因为列重复定义导致 CREATE 失败，
     *   但 SQL 脚本用了 multipleStatements，后续语句照样执行，
     *   结果「只有 flag 表缺失」这件事被静默吞掉，直到线上接口 500 才被发现。
     *   所以迁移完必须核对表数量。 */
    const [tableRows] = await conn.query('SHOW TABLES');
    const actualTables = tableRows.map(r => Object.values(r)[0]);
    const expectedTables = [...tablesInSql].filter(t => !actualTables.includes(t));
    if (expectedTables.length) {
      logger.error('迁移后校验不通过：有表没建出来', { missing: expectedTables });
      console.error('\n❌ 以下表未创建成功（可能是建表语句有语法错误）：');
      expectedTables.forEach(t => console.error(`     ${t}`));
      console.error('   修好建表语句后重跑本脚本。\n');
      process.exitCode = 1;
    } else {
      console.log(`✅ 建表校验通过，共 ${actualTables.length} 张表\n`);
    }
  } catch (e) {
    logger.error('数据库迁移失败', { err: e.message });
    console.error('\n❌ 迁移失败：', e.message, '\n');
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();
