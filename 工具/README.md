# 工具

> 构建与校验脚本。**全部脚本都按自身位置解析路径** —— 在任何目录下执行结果都一样。

## 文档构建（md → docx）

| 脚本 | 作用 |
|---|---|
| `python _md2docx.py <输出路径> [all\|spec]` | md → docx。`spec` = 只转 `需求规格.md`（R + A）；`all` = R + D + W 合订本 |
| `python build_param_tables.py` | 生成 `交付物/参数速查表.docx`（双栏紧凑排版，102 张表） |
| `python fix_numbering.py` | 修 `参数速查表.docx` 的小节断号（删表导致时用），并同步表内交叉引用 |
| `python _verify_param_tables.py` | 校验 `参数速查表.docx` 与 md 源**逐格一致** |

> **改内容只改 `文档/` 下的 md，然后重新生成 docx** —— 不要直接编辑 docx，下次生成会被覆盖。

## 文档校验

| 脚本 | 检查什么 |
|---|---|
| `python check_docs.py` | **md → docx 转换有没有丢内容**：代码围栏是否配对 + md 与 docx 的标题数 / 表格数是否一致 + 合订本是否包含三份 md 的全部标题 |
| `python check_refs.py` | **全仓引用完整性**：md 里的相对链接与文件名引用、代码里的 `path.join` / `os.path.join` 是否都指向真实存在的路径 |

> `check_docs.py` 存在的理由 —— **md 看着正常，docx 未必**。
> 2026-11-21 就抓到 `需求规格.md` 里多一行代码围栏，导致 docx **少 5 个标题、4 张表**（md 里完全看不出来）。

## 素材生成

| 脚本 | 作用 |
|---|---|
| `python _gen_photos_real.py` | **下载真实人物/场景照片** → 转渐进式 JPEG → `demo/assets/checkin/ck01–ck12.jpg`（800×800）+ `demo/assets/life/lf01–lf12.jpg`（600×800）**（现行素材来源，24 张合计 ~1.85MB）** |
| `python _gen_photos.py` | 生成 12 张**卡通占位**打卡照片 → `demo/assets/checkin/ck01–ck12.png`（**已被真人素材取代，脚本备查**） |
| `python _gen_life_photos.py` | 生成 12 张**卡通占位**生活照 → `demo/assets/life/lf01–lf12.png`（**已被真人素材取代，脚本备查**） |
| `python 构建品牌素材.py dog` | 从 `demo/assets/dog2.png` 抠柴犬头像 → `demo/assets/dog_new.png`（登录页在用） |
| `python 构建品牌素材.py mark` | 提取品牌色块 → `demo/assets/mark.svg`（**页面已不再引用，备查**） |
| `python 构建品牌素材.py verify` | 渲染 mark.svg 与原图算 IoU（当前 **0.977**） |

> 素材脚本的路径相对 `demo/`，但**脚本本身在 `工具/`** —— 在 `demo/` 目录下执行：
> ```
> cd demo
> python ../工具/_gen_photos_real.py
> python ../工具/构建品牌素材.py dog
> ```

## 本地服务器

| 脚本 | 作用 |
|---|---|
| `python _serve.py [端口]` | 静态服务器，默认 9521 → `http://127.0.0.1:9521/demo/DEMO.html` |

## 杂项

| 脚本 | 作用 |
|---|---|
| `_ocr.ps1` | Windows 内置 OCR 命令行封装 —— 对图片跑中文 OCR 并输出「坐标 + 文本」。用于验证「手写随机词 / 秤读数」素材里的文字是否真的可识别 |

## 一键校验

```powershell
# demo 侧
cd demo/tests
node 跑全部校验.js      # 8 个专项校验脚本
node 巡检全站.js        # 44 页渲染 + 结构校验 + 素材路径 + 密度排行

# 文档侧
cd ../工具
python check_docs.py
python check_refs.py
python _verify_param_tables.py
```
