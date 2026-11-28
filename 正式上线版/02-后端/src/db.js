/**
 * 亏了 · 正式上线版 · 数据库连接池
 * ---------------------------------------------------------------------------
 * 【小白须知】这个文件负责「跟数据库建立连接」。
 *   业务代码不直接碰它，统一走 db.js 导出的 query()。
 */
const mysql = require('mysql2/promise');
const config = require('./config');
const logger = require('./logger');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: config.db.connectionLimit,
      queueLimit: 0,
      charset: 'utf8mb4',
      timezone: 'Z',
      /* 金额和权重用 DECIMAL，mysql2 默认返回字符串，这里转成数字 */
      decimalNumbers: true,
      dateStrings: ['DATE'],
    });
    logger.info('数据库连接池已创建', {
      host: config.db.host,
      database: config.db.database,
    });
  }
  return pool;
}

/**
 * 执行一条 SQL。
 * @param {string} sql  SQL 语句（务必用 ? 占位符，不要字符串拼接）
 * @param {Array}  params 参数数组
 * @returns {Promise<Array>} 查询结果行
 */
async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

/**
 * 执行一条 SQL，返回单行（没有则返回 null）
 */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length ? rows[0] : null;
}

/**
 * 执行写操作，返回 insertId 与 affectedRows
 */
async function execute(sql, params = []) {
  const [result] = await getPool().execute(sql, params);
  return result;
}

/**
 * 事务：传入一个 async 函数，内部用 tx 对象执行 SQL。
 * 任何异常都会回滚。
 *
 * 用法：
 *   await transaction(async (tx) => {
 *     await tx.query('UPDATE ...');
 *   });
 */
async function transaction(fn) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const tx = {
      query: async (sql, params = []) => {
        const [rows] = await conn.execute(sql, params);
        return rows;
      },
      queryOne: async (sql, params = []) => {
        const [rows] = await conn.execute(sql, params);
        return rows.length ? rows[0] : null;
      },
      execute: async (sql, params = []) => {
        const [result] = await conn.execute(sql, params);
        return result;
      },
    };
    const result = await fn(tx);
    await conn.commit();
    return result;
  } catch (err) {
    try { await conn.rollback(); } catch (_) { /* 回滚失败也要继续抛原错 */ }
    throw err;
  } finally {
    conn.release();
  }
}

/** 健康检查 */
async function ping() {
  const row = await queryOne('SELECT 1 AS ok');
  return !!(row && row.ok === 1);
}

/** 关闭连接池（进程退出时调用） */
async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, query, queryOne, execute, transaction, ping, close };
