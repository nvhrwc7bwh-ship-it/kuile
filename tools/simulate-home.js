/**
 * 亏了 · 首页逻辑模拟测试
 * ===========================================================================
 * 【这个脚本干什么】
 *   在 Node 里模拟小程序运行环境（wx / Page / getApp / setTimeout），
 *   把首页的 JS 加载起来，喂假数据，看它会不会正常渲染三种状态。
 *
 * 【为什么要有这个】
 *   小程序的报错在开发者工具里才看得到，而「数据没渲染出来」这类问题
 *   更是不报错、只是空白。这里用假数据把每条路径都跑一遍，
 *   能提前抓到 JS 里的低级错误（拼写、字段名、空指针）。
 *
 * 【怎么跑】
 *   node tools/simulate-home.js
 * ===========================================================================
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP = path.resolve(ROOT, '正式上线版/03-小程序前端');

/* ---------------------------------------------------------------------------
 * 模拟小程序运行环境
 * ------------------------------------------------------------------------- */
let pageInstance = null;
const timers = [];

global.wx = {
  /* 登录 */
  login(opts) {
    opts.success({ code: 'mock_code' });
  },
  /* 请求 —— 按 URL 返回假数据 */
  request(opts) {
    const url = opts.url || '';
    let body;

    if (url.indexOf('/api/flags/my') >= 0) {
      /* ⚠️ 必须在【请求发起的那一刻】把数据快照下来。
       *    如果在 success 回调里再读全局变量，
       *    多个用例并发跑的时候，后一个用例的数据会串到前一个用例上。
       *    （之前就是这么错的 —— 所有用例都拿到了最后一个用例的数据。） */
      const list = global.__MOCK_FLAGS__ || [];
      global.__REQUESTS__ = (global.__REQUESTS__ || []).concat(url + ' → ' + list.length + ' 条');
      body = {
        code: 0,
        msg: 'ok',
        data: {
          list: list,
        },
      };
    } else if (url.indexOf('/api/notifications/unread-count') >= 0) {
      body = { code: 0, msg: 'ok', data: { count: 3 } };
    } else if (url.indexOf('/api/auth/login') >= 0) {
      body = {
        code: 0,
        msg: 'ok',
        data: { token: 'mock_token', user: { id: 1, nickname: '新朋友' } },
      };
    } else {
      body = { code: 0, msg: 'ok', data: {} };
    }

    setTimeout(() => opts.success({ statusCode: 200, data: body }), 0);
  },
  /* 存储 */
  getStorageSync(k) { return global.__STORE__[k] || ''; },
  setStorageSync(k, v) { global.__STORE__[k] = v; },
  removeStorageSync(k) { delete global.__STORE__[k]; },
  /* 导航 */
  navigateTo(o) { global.__NAV__ = o.url; },
  switchTab(o) { global.__NAV__ = o.url; },
  reLaunch(o) { global.__NAV__ = o.url; },
  showToast(o) { global.__TOAST__ = o.title; },
  stopPullDownRefresh() {},
};

global.getApp = () => ({ globalData: {} });

/* 捕获未处理的 promise 异常 —— 小程序里这些异常是静默的，很难查 */
process.on('unhandledRejection', (reason) => {
  global.__LAST_ERROR__ = reason && reason.stack ? reason.stack : String(reason);
});
process.on('uncaughtException', (err) => {
  global.__LAST_ERROR__ = err.stack || String(err);
});

/* 记录 Page 的定义 */
global.Page = function (def) {
  pageInstance = def;
  /* 挂载 setData —— 模拟小程序的 setData 会把数据合并到 this.data */
  const original = def.data || {};
  def.data = JSON.parse(JSON.stringify(original));
  def.setData = function (obj) {
    for (const k of Object.keys(obj)) {
      this.data[k] = obj[k];
    }
    global.__LAST_SETDATA__ = obj;
  };
};
/* ---------------------------------------------------------------------------
 * 加载首页
 * ------------------------------------------------------------------------- */
global.__STORE__ = {};

/**
 * 小程序里的 require 是相对于【当前文件】解析的。
 * 这里的 new Function 拿不到那个上下文，所以自己写一个：
 * 以被加载文件所在目录为基准解析相对路径。
 */
function makeRequire(fromFile) {
  const fromDir = path.dirname(fromFile);
  return function (target) {
    let resolved;
    if (target.startsWith('.')) {
      resolved = path.resolve(fromDir, target);
    } else {
      resolved = require.resolve(target);
    }
    /* 补上扩展名 */
    const cands = [resolved, resolved + '.js', resolved + '.json', path.join(resolved, 'index.js')];
    for (const c of cands) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) {
        return require(c);
      }
    }
    throw new Error('模块找不到：' + target + '（来自 ' + fromFile + '）');
  };
}

function loadHome() {
  const file = path.join(APP, 'pages/index/index.js');
  delete require.cache[require.resolve(file)];
  const src = fs.readFileSync(file, 'utf8');
  const fn = new Function('require', 'module', 'exports', src);
  const mod = { exports: {} };
  fn(makeRequire(file), mod, mod.exports);

  /* ⚠️ 不能浅拷贝 —— setData 里的 this 会指回原对象，
   *   拷贝出来的 p.data 就永远收不到更新。
   *   所以要让 setData 挂在【这个实例】上。 */
  const p = pageInstance;

  /* ⚠️ 顺序很重要：先取出所有方法并绑定到实例，
   *   再覆盖 setData —— 否则遍历时会把【旧的】setData 也绑上去，
   *   覆盖掉我们新写的那个。 */
  const bound = {};
  for (const k of Object.keys(p)) {
    bound[k] = typeof p[k] === 'function' ? p[k].bind(p) : p[k];
  }
  /* ⚠️ 关键：bound.data 必须【指向同一个对象】，
   *   不然 setData 写进去的是另一个对象，测试就永远读不到。 */
  bound.data = p.data;
  bound.setData = function (obj) {
    for (const k of Object.keys(obj)) {
      this.data[k] = obj[k];
    }
    global.__LAST_SETDATA__ = obj;
    global.__SETDATA_LOG__ = (global.__SETDATA_LOG__ || []).concat(
      Object.keys(obj).join(',')
    );
  };
  /* 页面方法里的 this 必须是实例本身 */
  for (const k of Object.keys(bound)) {
    if (typeof bound[k] === 'function' && k !== 'setData') {
      bound[k] = bound[k].bind(bound);
    }
  }
  return bound;
}

const page = loadHome();

/* ---------------------------------------------------------------------------
 * 测试用例
 * ------------------------------------------------------------------------- */
const CASES = [
  {
    name: '状态一：全新用户（没有任何 Flag）',
    flags: [],
    expect: {
      mainFlag: null,
      prepCountdown: '',
      progress: 0,
      breakWarn: '',
    },
  },
  {
    name: '状态二：筹备期（24 小时倒计时）',
    flags: [
      {
        id: 1,
        title: '一个月瘦 8 斤',
        status: 'prep',
        days: 30,
        startWeight: 70,
        curWeight: null,
        targetWeight: 66,
        deposit: 200,
        checkedDays: 0,
        totalDays: 30,
        breaks: 0,
        breakLimit: 3,
        prepEndAt: Date.now() + 3 * 3600 * 1000 + 25 * 60 * 1000 + 12 * 1000,
        prepRemainSec: 12312,
      },
    ],
    expect: {
      mainFlag: 'prep',
      prepCountdown: '03:25:12',
      progress: 0,
      breakWarn: '',
    },
  },
  {
    name: '状态三：进行中（有打卡进度）',
    flags: [
      {
        id: 2,
        title: '三个月瘦 20 斤',
        status: 'running',
        days: 90,
        startWeight: 80,
        curWeight: 76.5,
        targetWeight: 70,
        deposit: 500,
        checkedDays: 30,
        totalDays: 90,
        breaks: 0,
        breakLimit: 3,
        prepEndAt: Date.now() - 1000,
      },
    ],
    expect: {
      mainFlag: 'running',
      progress: 33,
      breakWarn: '',
    },
  },
  {
    name: '边界：断卡剩 1 次时应预警',
    flags: [
      {
        id: 3,
        title: '七天速成',
        status: 'running',
        days: 7,
        startWeight: 70,
        curWeight: 69,
        targetWeight: 68,
        deposit: 50,
        checkedDays: 3,
        totalDays: 7,
        breaks: 2,
        breakLimit: 3,
        prepEndAt: Date.now() - 1000,
      },
    ],
    expect: {
      mainFlag: 'running',
      breakWarn: '再断 1 次，这个 Flag 就结束了',
    },
  },
  {
    name: '边界：7 天档（breakLimit=0）不该误报预警',
    flags: [
      {
        id: 4,
        title: '七天冲刺',
        status: 'running',
        days: 7,
        startWeight: 70,
        curWeight: 69,
        targetWeight: 68,
        deposit: 50,
        checkedDays: 1,
        totalDays: 7,
        breaks: 0,
        breakLimit: 0,
        prepEndAt: Date.now() - 1000,
      },
    ],
    expect: {
      mainFlag: 'running',
      breakWarn: '',
    },
  },
  {
    name: '边界：已结算的局不算进行中（走空态）',
    flags: [
      {
        id: 5,
        title: '已经结束的局',
        status: 'success',
        days: 30,
        startWeight: 70,
        curWeight: 66,
        targetWeight: 66,
        deposit: 200,
        checkedDays: 30,
        totalDays: 30,
        breaks: 0,
        breakLimit: 3,
        prepEndAt: Date.now() - 1000,
      },
    ],
    expect: {
      mainFlag: null,
    },
  },
];

/* ---------------------------------------------------------------------------
 * 跑测试
 * ------------------------------------------------------------------------- */
console.log('');
console.log('════ 首页逻辑模拟测试 ════');
console.log('');

let pass = 0;
let fail = 0;
let caseIndex = 0;

/**
 * 逐个跑用例（串行！）
 * ⚠️ 必须串行 —— 多个用例同时跑的话，mock 的假数据会互相串，
 *    而且倒计时定时器也会互相干扰。
 */
function runNext() {
  if (caseIndex >= CASES.length) {
    console.log('');
    console.log('════════════════════════════════════');
    console.log(`通过 ${pass} 项，失败 ${fail} 项`);
    console.log('');
    process.exit(fail > 0 ? 1 : 0);
    return;
  }

  const c = CASES[caseIndex];
  caseIndex++;

  /* 本次用例的假数据 */
  global.__MOCK_FLAGS__ = c.flags;
  global.__REQUESTS__ = [];
  global.__SETDATA_LOG__ = [];
  global.__LAST_ERROR__ = null;

  /* 每次都重新加载页面实例，保证 data 是干净的 */
  const p = loadHome();
  const problems = [];

  try {
    p.onLoad();
  } catch (e) {
    problems.push('onLoad 抛异常：' + e.message);
  }

  setTimeout(() => {
    const d = p.data;

    if (global.__LAST_ERROR__) {
      problems.push('未捕获异常：' + global.__LAST_ERROR__);
    }

    for (const [key, expected] of Object.entries(c.expect)) {
      let actual;
      if (key === 'mainFlag') {
        actual = d.mainFlag ? d.mainFlag.status : null;
      } else {
        actual = d[key];
      }
      if (actual !== expected) {
        /* 倒计时是活的 —— 测试跑起来会差 1 秒，属正常。
         * 所以倒计时只校验「格式对不对」，不校验具体数值。 */
        if (key === 'prepCountdown' && expected) {
          const fmtOk = /^(\d{2}:)?\d{2}:\d{2}$/.test(String(actual));
          if (fmtOk) continue;
        }
        problems.push(`${key}：期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
      }
    }

    if (problems.length === 0) {
      console.log(`  ✅ ${c.name}`);
      pass++;
    } else {
      console.log(`  ❌ ${c.name}`);
      problems.forEach(p => console.log(`     · ${p}`));
      console.log(`     请求记录：${(global.__REQUESTS__ || []).join(' | ')}`);
      console.log(`     setData 记录：${(global.__SETDATA_LOG__ || []).join(' | ')}`);
      fail++;
    }

    /* 清理这个用例的定时器，避免影响下一个用例 */
    p.onUnload();

    setTimeout(runNext, 10);
  }, 60);
}

runNext();
