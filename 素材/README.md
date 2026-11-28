# 素材

> 只读的图片素材。**不在这里改图，改完重新跑生成脚本。**

| 目录 | 内容 | 来源 |
|---|---|---|
| `IP形象/` | 品牌 IP 形象素材 —— 角色 11 张、表情 13 张、海报 1 张 | 外部产出 |
| `IP形象/resources/` | 原始素材包（22 个文件，含 `resources/background_clothing_conf/icon/`） | 外部产出，**未整理**，保持原样 |
| `配图/DietBet/` | 对标产品 DietBet 的 20 张截图（官网 9 张 + App Store iPhone 6 张 + iPad 4 张） | `文档/对标-DietBet产品图鉴.md` 的配图 |

## 引用方式

| 文件 | 怎么引 |
|---|---|
| `文档/对标-DietBet产品图鉴.md` | `![首页](../素材/配图/DietBet/web-01-home.png)` —— **相对 `文档/` 的路径** |
| `demo/assets/` | demo 用的是**自己的**素材（`dog_new.png` / `checkin/` / `life/` / `qr_voucher.png`），与本目录无关 |

> **注意 `IP形象/` 与 `demo/assets/` 是两套东西** ——
> `demo/assets/` 里的柴犬（`dog_new.png`）是**从 `dog2.png` 抠出来的程序化头像**，
> 跟 `IP形象/` 的品牌角色素材不是一回事。

## 体积

| 目录 | 大小 |
|---|---|
| `IP形象/` | ≈ 50 MB（22 个原始素材 + 25 张成品 PNG，单张 1.2–3 MB） |
| `配图/` | ≈ 3 MB |

> `IP形象/` 的大头是 `resources/` 里那 22 个原始素材（`background_clothing_conf` 包）——
> **它们是成品 PNG 的来源**，不是重复文件。删了就再也无法重新导出了。
