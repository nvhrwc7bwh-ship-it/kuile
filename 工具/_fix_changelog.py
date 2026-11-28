# -*- coding: utf-8 -*-
"""修掉 想法演进.md 尾部那次追加 —— PowerShell heredoc 把 markdown 反引号吃掉了。"""
import io
import os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                 '文档', '想法演进.md')

text = io.open(P, encoding='utf-8').read()

MARK = '## 2026-11-26'
i = text.find(MARK)
if i < 0:
    raise SystemExit('找不到入口标记')

# 截断到「---」分隔线之前，保留原来的结尾
head = text[:i].rstrip()
# head 现在以 "...\n\n---" 结尾，保留它
if head.endswith('---'):
    head = head[: -3].rstrip()

ENTRY = """
---

## 2026-11-26 · 🗂 demo 目录整理 —— 一级目录只留一个入口

> 触发：用户要求「js 文件散落在主页面，整理到一个文件夹；index 改名 DEMO；一级目录只有一个 HTML」。

### 一、为什么动它

`demo/` 一级目录原本躺着 **35 个文件** —— 1 个 `index.html` + 31 个 `_verify_*.js` + `跑全部校验.js` + `巡检全站.js` + `README.md`。
**校验脚本和原型本身混在一起**，想找「页面跑在哪」和「断言在哪」得在同一个列表里翻两遍。

### 二、动了什么

| 位置 | 改动 |
|---|---|
| `demo/index.html` | → **`demo/DEMO.html`**（原型入口，名字自解释，不再跟「首页路由」混淆） |
| `demo/_verify_*.js`（31 个）<br>`demo/跑全部校验.js`<br>`demo/巡检全站.js` | → **`demo/tests/`**（一级目录只剩 `DEMO.html` + `README.md` + 4 个子目录） |
| `demo/css/app.css.bak` | **删除** —— 旧 CSS 备份，全仓零引用（只有它自己在 git 历史里有意义） |
| `demo/DEMO.html` 内部 | **不动** —— `css/app.css`、`js/*.js` 仍在 `demo/` 根，相对引用天然成立 |
| `demo/tests/*.js` | 路径基准全部改成 `__dirname` + `'..'` |
| `工具/check_refs.py` | `ANCHOR_BASE` 加 `demo/tests` —— 否则子目录里的 js 脱离引用扫描 |
| 根 `README.md` / `交付物/README.md` / `工具/README.md` / `demo/README.md` / `工具/_serve.py` | 同步新路径与新命令 |

### 三、路径基准怎么改才不出错

`demo/tests/` 里的脚本分三类，对应三种改法：

1. **绝大多数**（原本写 `__dirname` + `'js'` + 文件名）→ 加一级 `'..'`
2. **原本指向仓库根的**（`_verify_consistency.js` 的 `ROOT`、`_verify_photos.js` 的 `repoRoot`）→ 从 `'..'` 变 `'..','..'`
3. **用变量做 path.join 首参的**（`_verify_brand.js` / `_verify_login.js` 的 `D`、`_verify_home_witness.js` 的 `ROOT`）→ 改成显式 `__dirname` + `'..'` 的字面量形式

> **（必读·坑）第 3 类不能只改变量声明。**
> `工具/check_refs.py` 的扫描正则只认「首参是 `__dirname` 或 `D`」与「首参是 `D`」两种写法。
> 如果把 `D` 改成「`__dirname` + `'..'`」再留「首参 `D` + `'js'`」，
> **扫描器就解析不出真实路径 → 引用完整性检查形同虚设**。
> 所以统一改成「首参 `__dirname` + `'..'` + `'js'`」的字面量形式 —— 扫描器能解析，脚本也能跑。

### 四、验证

- `cd demo/tests && node 跑全部校验.js` → **31 个脚本全绿**（与整理前逐条一致）
- `node 巡检全站.js` → **37 页 0 结构问题**，素材 15 个引用 0 缺失
- `python 工具/check_refs.py` → 423 处引用**全部通过**
- `python 工具/check_docs.py` → md ↔ docx 标题/表格数全部一致
- 浏览器实测 `http://127.0.0.1:9521/demo/DEMO.html` → 正常渲染，**0 个 404、0 个 JS 错误**
"""

io.open(P, 'w', encoding='utf-8', newline='\n').write(head + ENTRY)
print('已修复，len=%d' % os.path.getsize(P))
