/**
 * 静态检查：代码里 SQL 用到的列，是否都存在于建表语句中。
 * 目的：抓出「查了不存在的列」这类必炸的 500 错误。
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sqlFile = path.join(root, 'migrations', '001_init.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

/* ---- 解析建表语句，得到 表名 -> 列名集合 ---- */
const tables = new Map();
const createRe = /CREATE TABLE\s+`?(\w+)`?\s*\(([\s\S]*?)\n\)\s*ENGINE/g;
let m;
while ((m = createRe.exec(sql))) {
  const table = m[1];
  const body = m[2];
  const cols = new Set();
  for (const line of body.split(/\r?\n/)) {
    const cm = /^\s*`(\w+)`\s+/.exec(line);
    if (cm) cols.add(cm[1]);
  }
  tables.set(table, cols);
}

console.log(`已解析 ${tables.size} 张表：${[...tables.keys()].join(', ')}\n`);

/* ---- 扫描所有 JS 里的 SQL ---- */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'logs'].includes(e.name)) continue;
      walk(p, out);
    } else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = walk(path.join(root, 'src'));
const problems = [];

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const rel = path.relative(root, f);
  const lines = src.split(/\r?\n/);

  lines.forEach((ln, idx) => {
    // 找出 FROM/JOIN 的表别名
    const aliasMap = new Map();
    const joinRe = /\b(?:FROM|JOIN)\s+`?(\w+)`?\s*(?:AS\s+)?(\w+)?/gi;
    let j;
    while ((j = joinRe.exec(ln))) {
      const tbl = j[1];
      const alias = j[2] || tbl;
      if (tables.has(tbl)) aliasMap.set(alias.toLowerCase(), tbl);
    }
    if (!aliasMap.size) return;

    // 找出 <alias>.<column>
    const colRe = /\b(\w+)\.(\w+)\b/g;
    let c;
    while ((c = colRe.exec(ln))) {
      const alias = c[1].toLowerCase();
      const col = c[2];
      if (!aliasMap.has(alias)) continue;
      const tbl = aliasMap.get(alias);
      const known = tables.get(tbl);
      if (!known.has(col)) {
        problems.push({ file: rel, line: idx + 1, tbl, col, text: ln.trim() });
      }
    }
  });
}

if (!problems.length) {
  console.log('✅ 未发现「引用了不存在的列」的问题');
} else {
  const uniq = new Map();
  for (const p of problems) {
    const key = `${p.file}|${p.tbl}.${p.col}`;
    if (!uniq.has(key)) uniq.set(key, p);
  }
  console.log(`❌ 发现 ${uniq.size} 处「引用了不存在的列」：\n`);
  for (const p of uniq.values()) {
    console.log(`  ${p.file}:${p.line}`);
    console.log(`      表 ${p.tbl} 没有列 ${p.col}`);
    console.log(`      ${p.text}`);
  }
  process.exitCode = 1;
}
