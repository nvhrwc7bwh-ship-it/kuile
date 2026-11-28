# 亏了 · 开发工具

> 这一层是「把 demo 原型搬进小程序」的转换工具 + 自动检查工具。
>
> **改样式请改源文件，不要改生成物。** 生成物头部都写了「自动生成，请勿手改」。

---

## 一、一键验证

改完任何代码后，跑这一条就够了：

```bash
node tools/verify.js
```

它会依次跑完下面 6 步，任何一步失败都会打印出具体原因。

---

## 二、样式转换（生成物，不要手改）

| 脚本 | 干什么 | 产物 |
|---|---|---|
| `build-wxss.js` | demo 的 CSS → 小程序 WXSS<br/>（CSS 变量展开、px→rpx、color-mix 预计算、backdrop-filter 降级、剔除桌面外壳） | `03-小程序前端/styles/tokens.wxss` |
| `build-icons.js` | demo 的 72 枚 SVG 图标 → JS 模块 | `03-小程序前端/utils/icons.js` |
| `build-app-wxss.js` | 把 tokens + 适配层拼成最终文件 | `03-小程序前端/app.wxss` |

### 为什么要做转换

demo 是浏览器里的 HTML 原型，用了小程序 WXSS 不支持的东西：

| demo 用的 | 小程序 | 转换办法 |
|---|---|---|
| `var(--brand)` | 不支持 CSS 变量 | 展开成字面值 |
| `px` | 用 `rpx` | 自动换算（1px = 2rpx） |
| `color-mix()` | 不支持 | 预计算成实色 |
| `backdrop-filter` | 不支持 | 删掉（有底色兜底） |
| `.rail` `.device` 等桌面外壳 | 小程序没有 | 整块剔除 |

### 改样式时改哪里

- **想调颜色/圆角/间距** → 改 `demo/css/app.css`，然后跑 `node tools/verify.js`
- **想加小程序专属样式** → 改 `03-小程序前端/styles/adapter.wxss`
- **想改某个页面的样式** → 改该页面的 `index.wxss`

---

## 三、自动检查

| 脚本 | 查什么 |
|---|---|
| `check-frontend.js` | JSON 语法、页面四件套、组件路径、WXML 标签、WXML 数据字段、WXSS 语法、图标名、**require 路径** |
| `check-loops.js` | `wx:for` 的循环变量用错（这类 bug 不报错、只是静默空白） |
| `check-styles.js` | 样式里哪些写法在小程序里会失效（`inherit` 依赖、grid、伪元素等），给出第 2 轮的改造清单 |
| `simulate-home.js` | 在 Node 里模拟小程序环境，跑首页的三种状态 + 三个边界情况 |

### 为什么要有 `check-loops.js`

小程序的 `wx:for` 默认变量名是 `item`。
写 `wx:for="{{list}}"` 却用 `{{p.xxx}}`，或者忘了写 `wx:for-item="p"`，
这一块就**渲染不出来** —— 而且**不报错**，只是空白。

这个脚本已经抓到过 1 个真实 bug（`pages/create/index.wxml` 的周期选择区）。

---

## 四、依赖

**不需要装任何依赖。**

所有脚本只用 Node 内置模块（`fs` / `path` / `child_process`），
用 Node 18+ 就能跑（你的电脑是 Node 24）。

```bash
node tools/verify.js
```
