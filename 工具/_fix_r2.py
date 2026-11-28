# -*- coding: utf-8 -*-
"""复核 1 修正 2 —— 修 D2.2 / D5.15 两处悬空引用。

D2.2「为什么露脸不能做成用户自选开关」本轮已删 —— 引用它的地方改指到还存在的章节。
D5.15 是**既有悬空引用**（本轮之前就删了 D5.15），顺手一起修。
"""
import io, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def edit(relpath, pairs):
    p = os.path.join(ROOT, relpath)
    with io.open(p, encoding='utf-8') as f:
        s = f.read()
    for old, new in pairs:
        n = s.count(old)
        if n != 1:
            print('!! %s: 匹配 %d 次（应为 1）-> %r' % (relpath, n, old[:90]))
            sys.exit(1)
        s = s.replace(old, new)
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)
    print('OK %s（%d 处）' % (relpath, len(pairs)))


edit('文档/设计说明.md', [
# ---------- D2.2 悬空引用 → 改指 D2.1（物证体系为什么这么设计） ----------
(
"""| 「减负而非加压」的措辞要改 | 但取向本身保留 —— 见证席仍然不需要每天做任何事，最多点 4 下（D0.4 / D2.2） |""",
"""| 「减负而非加压」的措辞要改 | 但取向本身保留 —— 见证席仍然不需要每天做任何事，最多点 4 下（D0.4 / D2.3） |"""
),
# ---------- D5.15 悬空引用 → 改指 D5.18（为什么必须有三条加入动机） ----------
(
"""取舍：见证席的参与动机全靠"防御性 + 关系性 + 便利性"三条软动力撑，没有现金激励。这是有意的 —— 见 D5.15。""",
"""取舍：见证席的参与动机全靠"防御性 + 关系性 + 便利性"三条软动力撑，没有现金激励。这是有意的 —— 见 D5.18。"""
),
])
print('done')
