/**
 * 亏了 · 正式上线版 · 内存数据库替身（测试用）
 * ===========================================================================
 * 【小白须知】
 *   这是一个「假数据库」—— 不需要装 MySQL 就能跑测试。
 *   它只支持本项目代码里实际用到的几种 SQL（增删改查）。
 *
 * 【谁在用】tests/flow.test.js 与 tests/beta-deposit.test.js 共用。
 * ===========================================================================

 * 内存数据库替身
 * ------------------------------------------------------------------------ */
function makeMemDb() {
  const tables = {};
  let seq = 0;

  function rowsOf(name) {
    if (!tables[name]) tables[name] = [];
    return tables[name];
  }

  /**
   * 从 start 位置（某个左括号之后）取出括号配平的内容
   */
  function extractParenContent(str, start) {
    let depth = 1;
    let i = start;
    while (i < str.length && depth > 0) {
      if (str[i] === '(') depth++;
      else if (str[i] === ')') depth--;
      i++;
    }
    return str.slice(start, i - 1);
  }

  /**
   * 极简 SQL 执行器
   * 只支持代码里实际用到的语句形态。
   */
  function exec(sql, params = []) {
    const s = sql.replace(/\s+/g, ' ').trim();
    let m;

    /* ---- INSERT ---- */
    if ((m = s.match(/^INSERT INTO `?(\w+)`?\s*\(/i))) {
      const table = m[1];
      const rows = rowsOf(table);

      /* 列名列表（括号配平提取） */
      const colList = extractParenContent(s, s.indexOf('(') + 1);
      const cols = colList.split(',').map((c) => c.trim().replace(/`/g, ''));

      /* VALUES 元组（括号配平提取） */
      const vIdx = s.search(/VALUES\s*\(/i);
      if (vIdx < 0) return { affectedRows: 0 };
      const vContent = extractParenContent(s, s.indexOf('(', vIdx) + 1);
      const values = splitTop(vContent, ',').map((v) => v.trim());

      /* 把 values 与 params 按 ? 占位对齐 */
      const p = (params || []).slice();
      const resolved = values.map((v) => {
        if (v === '?') return p.shift();
        if (/^'(.*)'$/.test(v)) return v.replace(/^'(.*)'$/, '$1');
        if (/^JSON_ARRAY\(\)$/i.test(v)) return '[]';
        if (/^NOW\(\)$/i.test(v)) return new Date().toISOString();
        return v;
      });

      /* Date 参数保持 Date 对象（真实 MySQL 会存 DATETIME） */
      cols.forEach((c, i) => {
        if (resolved[i] instanceof Date) resolved[i] = resolved[i].toISOString();
      });

      const obj = {};
      cols.forEach((c, i) => { obj[c] = resolved[i] !== undefined ? resolved[i] : null; });
      obj.id = obj.id || ('id_' + (++seq));
      obj.created_at = obj.created_at || new Date().toISOString();

      /* ON DUPLICATE KEY UPDATE 分支 */
      if (/ON\s+DUPLICATE\s+KEY\s+UPDATE/i.test(s)) {
        const updPart = s.match(/ON\s+DUPLICATE\s+KEY\s+UPDATE\s+([\s\S]+)$/i)[1];
        const updCols = [];
        const updVals = [];
        const upRe = /`?(\w+)`?\s*=\s*VALUES\s*\(\s*`?(\w+)`?\s*\)/gi;
        let um;
        while ((um = upRe.exec(updPart)) !== null) {
          updCols.push(um[1]);
          updVals.push(um[2]);
        }
        if (updCols.length) {
          const exist = rows.find((r) => updCols.every((c) => r[c] === obj[updVals[updCols.indexOf(c)]]));
          if (exist) {
            updCols.forEach((c, i) => { exist[c] = obj[updVals[i]]; });
            return { insertId: 0, affectedRows: 1 };
          }
        }
      }

      rows.push(obj);
      return { insertId: obj.id, affectedRows: 1 };
    }

    /* ---- UPDATE ---- */
    if ((m = s.match(/^UPDATE `?(\w+)`?/i))) {
      const table = m[1];
      const rows = rowsOf(table);
      const whereIdx = s.indexOf('WHERE');
      const setPart = whereIdx > 0 ? s.slice(s.indexOf('SET') + 3, whereIdx) : '';
      const wherePart = whereIdx > 0 ? s.slice(whereIdx) : '';

      const setCols = splitTop(setPart, ',').map((c) => c.trim().split('=')[0].trim().replace(/`/g, ''));
      const setOps = splitTop(setPart, ',').map((c) => c.trim().split('=').slice(1).join('=').trim());

      /* ⚠️ 顺序很重要：SET 里的 ? 在前，WHERE 里的 ? 在后 */
      const p = (params || []).slice();
      const setValues = setOps.map((op) => evalExpr(op, p, {}));

      const where = parseWhere(wherePart, p, 0);
      let n = 0;
      for (const r of rows) {
        if (!matchWhere(r, where)) continue;
        setCols.forEach((c, i) => { r[c] = setValues[i]; });
        n++;
      }
      return { affectedRows: n };
    }

    /* ---- DELETE ---- */
    if ((m = s.match(/^DELETE FROM `?(\w+)`?/i))) {
      const table = m[1];
      const rows = rowsOf(table);
      const whereIdx = s.indexOf('WHERE');
      const wherePart = whereIdx > 0 ? s.slice(whereIdx) : '';
      const where = parseWhere(wherePart, params, 0);
      const keep = rows.filter((r) => !matchWhere(r, where));
      const n = rows.length - keep.length;
      tables[table] = keep;
      return { affectedRows: n };
    }

      /* ---- SELECT ---- */
      if ((m = s.match(/^SELECT /i))) {
        /* 提取主表 */
        const fromM = s.match(/\bFROM\s+`?(\w+)`?(?:\s+(?:AS\s+)?(\w+))?/i);
        const table = fromM ? fromM[1] : null;
        const tableAlias = fromM && fromM[2] ? fromM[2] : null;
        let rows = table ? rowsOf(table).slice() : [];

        /* JOIN 进来的表：合并字段（按别名归属） */
        const joinRe = /\bJOIN\s+`?(\w+)`?(?:\s+(?:AS\s+)?(\w+))?/gi;
        let jm;
        const joined = [];
        while ((jm = joinRe.exec(s)) !== null) {
          joined.push({ table: jm[1], alias: jm[2] || jm[1] });
        }

        /* WHERE */
        const whereIdx = s.indexOf(' WHERE ');
        if (whereIdx > 0) {
          const wherePart = s.slice(whereIdx + 7);
          const where = parseWhere(wherePart, params, 0);
          rows = rows.filter((r) => matchWhere(r, where));
        }

        /* ORDER BY */
        const orderIdx = s.toUpperCase().indexOf(' ORDER BY ');
        if (orderIdx > 0) {
          const orderPart = s.slice(orderIdx + 10);
          const limitM = orderPart.match(/\sLIMIT\s+(\d+)/i);
          const orderPartClean = limitM ? orderPart.slice(0, limitM.index) : orderPart;
          const orderSpecs = orderPartClean.split(',').map((spec) => {
            const sp = spec.trim().split(/\s+/);
            return { col: sp[0].replace(/`/g, ''), desc: /desc/i.test(sp[1] || '') };
          });
          rows.sort((a, b) => {
            for (const o of orderSpecs) {
              const av = toComparable(a[o.col]);
              const bv = toComparable(b[o.col]);
              if (av < bv) return o.desc ? 1 : -1;
              if (av > bv) return o.desc ? -1 : 1;
            }
            return 0;
          });
          if (limitM) rows = rows.slice(0, Number(limitM[1]));
        }

      /* SELECT 列表 */
      const fromPos = s.toUpperCase().indexOf('FROM ');
      const selPart = fromPos > 0 ? s.slice(7, fromPos) : s.slice(7);
      const isCount = /COUNT\(\*\)/i.test(selPart);
      if (isCount) return [{ c: rows.length }];

        /* 提取字段别名 */
        const fields = [];
        const hasStar = /\*/.test(selPart);
        const fRe = /(?:^|,)\s*([\w.]+)\s*(?:AS\s+(\w+))?(?=\s*,|$)/gi;
        let fm;
        while ((fm = fRe.exec(selPart)) !== null) {
          if (!fm[1] || fm[1].toUpperCase() === 'COUNT') continue;
          fields.push({ src: fm[1], alias: fm[2] || fm[1] });
        }

        /* 把 JOIN 表的字段并进来（用「表名_字段」形式，alias 用原名） */
        const extra = {};
        joined.forEach((j) => {
          const jrows = rowsOf(j.table);
          jrows.forEach((jr, idx) => {
            if (!extra[j.alias]) extra[j.alias] = {};
            Object.assign(extra[j.alias], jr);
          });
        });

        return rows.map((r) => {
          const o = {};
          /* 有通配符时先铺开主表整行 */
          if (hasStar) Object.assign(o, r);
          for (const f of fields) {
            if (f.src === '*') {
              Object.assign(o, r);
            } else if (f.src.includes('.')) {
              const [maybeAlias, maybeCol] = f.src.split('.');
              const col = maybeCol || maybeAlias;
              const owner = maybeCol ? maybeAlias : null;
              if (owner && extra[owner]) {
                o[f.alias] = extra[owner][col];
              } else {
                o[f.alias] = r[col];
              }
            } else {
              o[f.alias] = r[f.src];
            }
          }
          return o;
        });
      }

    return { affectedRows: 0 };
  }

  /** 把 "a = ?, b = ?" 拆成列数组和值数组 */
  function parseWhere(wherePart, params, skip) {
    const cols = [];
    const vals = [];
    const re = /`?(\w+)`?\s*(=|>=|<=|>|<|!=|<>)\s*\?/gi;
    let m;
    while ((m = re.exec(wherePart)) !== null) {
      cols.push({ col: m[1], op: m[2] });
      vals.push(params.shift());
    }
    return { cols, vals };
  }

  function matchWhere(row, where) {
    for (let i = 0; i < where.cols.length; i++) {
      const c = where.cols[i];
      const v = where.vals[i];
      const rv = row[c.col];
      if (c.op === '=' && String(rv) !== String(v)) return false;
      if (c.op === '!=' && String(rv) === String(v)) return false;
      /* 日期/数值比较：把两边都转成可比较的数值 */
      const nv = toComparable(rv);
      const mv = toComparable(v);
      if (c.op === '>' && !(nv > mv)) return false;
      if (c.op === '<' && !(nv < mv)) return false;
      if (c.op === '>=' && !(nv >= mv)) return false;
      if (c.op === '<=' && !(nv <= mv)) return false;
    }
    return true;
  }

  /**
   * 把值转成可比较的数值
   * Date 对象、ISO 日期字符串、日期型字符串都能转
   */
  function toComparable(v) {
    if (v === null || v === undefined) return NaN;
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v;
    const s = String(v);
    /* ISO8601 或 'YYYY-MM-DD HH:mm:ss' 形式 */
    if (/^\d{4}-\d{2}-\d{2}[T ]/.test(s)) {
      const t = Date.parse(s.replace(' ', 'T'));
      if (!Number.isNaN(t)) return t;
    }
    const n = Number(s);
    if (!Number.isNaN(n) && s.trim() !== '') return n;
    return NaN;
  }

  function evalExpr(expr, params, row) {
    const e = expr.trim();
    if (e === '?') return params.shift();
    if (/^NOW\(\)/i.test(e)) return new Date().toISOString();
    if (/^JSON_ARRAY\(/i.test(e)) {
      /* JSON_ARRAY(?) 之类：把 ? 取出来，其余忽略 */
      while (params.length && /\?/.test(e)) {
        e = e.replace(/\?/, "'" + String(params.shift()).replace(/'/g, '') + "'");
      }
      return e;
    }
    if (/^\w+\s*\+\s*\?/i.test(e)) {
      const col = e.match(/^(\w+)/)[1];
      return Number(row[col] || 0) + Number(params.shift());
    }
    /* 自增自减：col + 1 / col - 1（字面量形式） */
    if (/^(\w+)\s*\+\s*(\d+(?:\.\d+)?)$/i.test(e)) {
      const g = e.match(/^(\w+)\s*\+\s*(\d+(?:\.\d+)?)$/i);
      return Number(row[g[1]] || 0) + Number(g[2]);
    }
    if (/^(\w+)\s*-\s*(\d+(?:\.\d+)?)$/i.test(e)) {
      const g = e.match(/^(\w+)\s*-\s*(\d+(?:\.\d+)?)$/i);
      return Number(row[g[1]] || 0) - Number(g[2]);
    }
    if (/^\w+\s*-\s*\?/i.test(e)) {
      const col = e.match(/^(\w+)/)[1];
      return Number(row[col] || 0) - Number(params.shift());
    }
    if (/^GREATEST\(/.test(e)) {
      const g = e.match(/GREATEST\(([^,]+),\s*(\w+)\s*-\s*(\d+)\)/i);
      if (g) {
        const cur = Number(row[g[2]] || 0);
        return Math.max(cur - Number(g[3]), 0);
      }
    }
    if (/^VALUES\(/i.test(e)) return e;
    /* 字面量：去掉引号 */
    if (/^'.*'$/.test(e)) return e.replace(/^'(.*)'$/, '$1');
    /* 数字 */
    if (/^-?\d+(\.\d+)?$/.test(e)) return Number(e);
    return e;
  }

  function splitTop(str, sep) {
    const out = [];
    let depth = 0;
    let cur = '';
    for (const ch of str) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === sep && depth === 0) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out;
  }

  return {
    tables,
    rowsOf,
    exec,
    async query(sql, params) { return exec(sql, (params || []).slice()); },
    async queryOne(sql, params) {
      const r = await exec(sql, (params || []).slice());
      return r.length ? r[0] : null;
    },
    async execute(sql, params) { return exec(sql, (params || []).slice()); },
    async transaction(fn) {
      return fn({
        query: async (sql, p) => exec(sql, (p || []).slice()),
        queryOne: async (sql, p) => { const r = await exec(sql, (p || []).slice()); return r.length ? r[0] : null; },
        execute: async (sql, p) => exec(sql, (p || []).slice()),
      });
    },
    async ping() { return true; },
    async close() {},
  };
}

module.exports = { makeMemDb };