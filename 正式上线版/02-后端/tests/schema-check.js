/**
 * 亏了 · 正式上线版 · 数据层一致性检查
 * ===========================================================================
 * 【这个脚本做什么】
 *   静态检查「代码里用到的表和字段」是否都在建表 SQL 里定义了。
 *   目的：上线前把「字段拼错」这类问题挡在部署之前。
 *
 * 【怎么跑】
 *   node tests/schema-check.js
 *
 * 【它怎么做到】
 *   1. 解析 migrations/001_init.sql，提取每张表的字段列表
 *   2. 扫描 src 目录下所有 .js 文件里所有 SQL 语句，提取用到的表名和字段名
 *   3. 对比，报出「表不存在」和「字段不存在」
 * ===========================================================================
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SQL_FILE = path.join(ROOT, 'migrations', '001_init.sql');
const SRC_DIR = path.join(ROOT, 'src');

/* ---------------------------------------------------------------------------
 * 1. 解析建表 SQL
 * ------------------------------------------------------------------------ */

/**
 * 从 CREATE TABLE 语句里抽出字段名
 */
function parseColumns(body) {
  const cols = new Set();
  const lines = body.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith(')')) continue;
    /* 主键 / 唯一键 / 外键 / 索引定义 */
    if (/^(PRIMARY|UNIQUE|KEY|CONSTRAINT|FOREIGN|INDEX)/i.test(line)) continue;
    const m = line.match(/^`(\w+)`\s+/);
    if (m) cols.add(m[1].toLowerCase());
  }
  return cols;
}

function parseTables(sql) {
  const tables = new Map();
  const re = /CREATE TABLE(?: IF NOT EXISTS)?\s+`(\w+)`\s*\(([\s\S]*?)\n\)\s*[^)]*;/g;
  let m;
  while ((m = re.exec(sql)) !== null) {
    tables.set(m[1].toLowerCase(), parseColumns(m[2]));
  }
  return tables;
}

/* ---------------------------------------------------------------------------
 * 2. 收集所有 JS 文件
 * ------------------------------------------------------------------------ */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * 3. 提取代码里的 SQL
 * ------------------------------------------------------------------------ */

/** 提取 SQL 字符串字面量（反引号、模板串、单引号） */
function extractSqlLiterals(code) {
  const out = [];
  /* 反引号模板串（最常用） */
  const tpl = /`([\s\S]*?)`/g;
  let m;
  while ((m = tpl.exec(code)) !== null) {
    const s = m[1];
    /* 只有像 SQL 的才收 */
    if (/\b(SELECT|INSERT|UPDATE|DELETE|FROM)\b/i.test(s)) out.push(s);
  }
  /* 单引号字符串里的 SQL（少数情况） */
  const sq = /'([^'\n]*\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^'\n]*)'/gi;
  while ((m = sq.exec(code)) !== null) out.push(m[1]);
  return out;
}

/** 从 SQL 里取出表名 */
function tablesIn(sql) {
  const out = new Set();
  /* 先把 ON DUPLICATE KEY UPDATE 这类片段剥掉，避免把字段名当表名 */
  const cleaned = sql.replace(/ON\s+DUPLICATE\s+KEY\s+UPDATE[\s\S]*/gi, ' ');
  const re = /\b(?:FROM|INTO|UPDATE|JOIN)\s+`?(\w+)`?/gi;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const t = m[1].toLowerCase();
    /* 排除 SQL 关键字误判 */
    if (['select', 'where', 'values', 'set', 'dual'].includes(t)) continue;
    out.add(t);
  }
  return out;
}

/** 从 SQL 里取出字段名（比较粗，只取标识符，过滤关键字） */
const SQL_KEYWORDS = new Set([
  'select', 'from', 'where', 'and', 'or', 'not', 'null', 'as', 'on', 'in', 'is',
  'order', 'by', 'group', 'limit', 'offset', 'insert', 'into', 'values', 'update',
  'set', 'delete', 'create', 'table', 'drop', 'if', 'exists', 'primary', 'key',
  'unique', 'default', 'int', 'bigint', 'varchar', 'text', 'tinyint', 'datetime',
  'timestamp', 'decimal', 'json', 'count', 'sum', 'max', 'min', 'avg', 'desc',
  'asc', 'case', 'when', 'then', 'else', 'end', 'for', 'update', 'current_timestamp',
  'now', 'concat', 'json_array', 'json_object', 'greatest', 'least', 'round',
  'distinct', 'having', 'union', 'all', 'any', 'between', 'like', 'instr',
  'interval', 'day', 'date', 'month', 'year', 'coalesce', 'ifnull', 'nullif',
  'duplicate', 'for', 'share', 'mode', 'only', 'rows', 'row', 'range', 'fields',
  'field', 'json_array', 'values', 'json_extract', 'storage', 'engine', 'charset',
  'collate', 'unsigned', 'auto_increment', 'comment', 'current_timestamp',
]);

function columnsIn(sql) {
  const out = new Set();
  /* 只取被引号包住的标识符（我们代码里字段名都是反引号保护的） */
  const q = /`(\w+)`/g;
  let m;
  while ((m = q.exec(sql)) !== null) {
    const c = m[1].toLowerCase();
    if (!SQL_KEYWORDS.has(c)) out.add(c);
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * 主流程
 * ------------------------------------------------------------------------ */
function main() {
  const sql = fs.readFileSync(SQL_FILE, 'utf8');
  const tables = parseTables(sql);

  console.log('══════ 亏了 · 数据层一致性检查 ══════\n');
  console.log(`建表 SQL 解析到 ${tables.size} 张表\n`);

  const missingTables = new Map();   /* 表名 → 出处 */
  const missingCols = new Map();     /* "表.字段" → 出处 */
  const knownCols = new Map();       /* 表名 → 字段集合（跨文件合并） */

  for (const file of walk(SRC_DIR)) {
    const rel = path.relative(ROOT, file);
    const code = fs.readFileSync(file, 'utf8');
    const sqls = extractSqlLiterals(code);

    for (const s of sqls) {
      const ts = tablesIn(s);
      const cs = columnsIn(s);

      for (const t of ts) {
        if (!tables.has(t)) {
          if (!missingTables.has(t)) missingTables.set(t, []);
          missingTables.get(t).push(rel);
          continue;
        }
        /* 合并该表在各处用到的字段 */
        if (!knownCols.has(t)) knownCols.set(t, new Set());
        for (const c of cs) knownCols.get(t).add(c);
      }
    }
  }

  /* 字段检查：只对确定的表-字段组合检查 */
  /* 保守做法：对每个 SQL 语句，如果它只涉及一个已知表，检查该语句里的字段 */
  for (const file of walk(SRC_DIR)) {
    const rel = path.relative(ROOT, file);
    const code = fs.readFileSync(file, 'utf8');
    for (const s of extractSqlLiterals(code)) {
      const ts = [...tablesIn(s)].filter((t) => tables.has(t));
      /* 单表语句才做字段级检查（多表 JOIN 字段归属不确定） */
      if (ts.length !== 1) continue;
      const t = ts[0];
      const cols = tables.get(t);
      for (const c of columnsIn(s)) {
        if (!cols.has(c)) {
          const key = `${t}.${c}`;
          if (!missingCols.has(key)) missingCols.set(key, []);
          missingCols.get(key).push(rel);
        }
      }
    }
  }

  let failed = 0;

  /* ---- 表检查 ---- */
  console.log('【表存在性】');
  if (missingTables.size === 0) {
    console.log('  ✓ 代码中引用的表全部已建\n');
  } else {
    failed++;
    console.log(`  ✗ 有 ${missingTables.size} 个表未定义：\n`);
    for (const [t, files] of missingTables) {
      console.log(`     表 ${t}`);
      files.forEach((f) => console.log(`       用到：${f}`));
    }
    console.log('');
  }

  /* ---- 字段检查 ---- */
  console.log('【字段存在性】（单表语句逐字段核对）');
  if (missingCols.size === 0) {
    console.log('  ✓ 字段全部已定义\n');
  } else {
    failed++;
    console.log(`  ✗ 有 ${missingCols.size} 个字段未定义：\n`);
    for (const [key, files] of missingCols) {
      console.log(`     ${key}`);
      files.forEach((f) => console.log(`       用到：${f}`));
    }
    console.log('');
  }

  /* ---- 汇总 ---- */
  console.log('════════════════════════════════════');
  if (failed) {
    console.log('❌ 数据层有不一致，请修正后再部署');
    process.exit(1);
  }
  console.log(`✅ 数据层一致性检查通过（${tables.size} 张表全部对齐）`);
}

main();
