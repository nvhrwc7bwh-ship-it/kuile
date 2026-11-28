/**
 * 静态检查：每个 CREATE TABLE 内部有没有重复定义的列。
 * 起因：flag 表把 created_at 定义了两次，导致建表失败、线上 500。
 */
const fs = require('fs');
const path = require('path');

const SQL_FILE = path.resolve(__dirname, '../migrations/001_init.sql');
const sql = fs.readFileSync(SQL_FILE, 'utf8');

const createRe = /CREATE TABLE(?: IF NOT EXISTS)?\s+`(\w+)`\s*\(([\s\S]*?)\n\)\s*ENGINE/g;
let m;
let bad = 0;
let tables = 0;

while ((m = createRe.exec(sql)) !== null) {
  const table = m[1];
  const body = m[2];
  tables++;
  const seen = new Map();
  const dups = [];

  body.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.trim();
    if (!line || line.startsWith('--')) return;
    if (/^(PRIMARY|UNIQUE|KEY|CONSTRAINT|FOREIGN|INDEX)\b/i.test(line)) return;
    const cm = /^\s*`(\w+)`\s+/.exec(raw);
    if (!cm) return;
    const col = cm[1];
    if (seen.has(col)) {
      dups.push({ col, first: seen.get(col), again: idx + 1 });
    } else {
      seen.set(col, idx + 1);
    }
  });

  if (dups.length) {
    bad += dups.length;
    console.log(`❌ 表 ${table} 有 ${dups.length} 处重复列：`);
    for (const d of dups) {
      console.log(`   \`${d.col}\` 第 ${d.first} 行定义过，第 ${d.again} 行又定义了一次`);
    }
  }
}

console.log('');
if (bad === 0) {
  console.log(`✅ 已检查 ${tables} 张表，未发现重复定义的列`);
} else {
  console.log(`❌ 共发现 ${bad} 处重复列，建表必然失败`);
  process.exitCode = 1;
}
