# -*- coding: utf-8 -*-
"""统计各 md 里的「展平行」—— 被压平丢格式的表格行 / 段落。

展平行 = 不以任何 markdown 标记开头、含中文、非空。
正常的正文段落也会命中，所以这个数只是量级参考 —— 关键是看**首个出现位置**
和**成片连续出现**的区域。
"""
import io, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MD = os.path.join(ROOT, '文档')

STARTS = ('#', '|', '>', '-', '*', '`', '1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.')

for f in ['需求规格.md', '设计说明.md', '页面布局与交互规格.md', '参数速查表.md']:
    ls = io.open(os.path.join(MD, f), encoding='utf-8').read().split('\n')
    flat = []
    for i, l in enumerate(ls):
        s = l.strip()
        if not s:
            continue
        if s.startswith(STARTS):
            continue
        if re.search(r'[\u4e00-\u9fff]', s):
            flat.append(i + 1)
    # 找连续成片（间隔 <=2 行算同一片）
    runs = []
    cur = []
    for n in flat:
        if cur and n - cur[-1] > 3:
            runs.append(cur)
            cur = []
        cur.append(n)
    if cur:
        runs.append(cur)
    big = [r for r in runs if len(r) >= 6]
    print('%-24s 总行 %5d  展平行 %4d  成片区域 %d 处' % (f, len(ls), len(flat), len(big)))
    for r in big[:8]:
        print('      行 %d–%d（%d 行）' % (r[0], r[-1], len(r)))
