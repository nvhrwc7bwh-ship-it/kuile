# -*- coding: utf-8 -*-
"""补回 页面布局与交互规格.md 里丢掉的 `##` 标题标记（L10）。

这是**既有排版失误**（不是本轮引入的）：L10 段落的标题行少了 `##`，
导致它既不是 Heading 样式、也不是 L11 之前的同级章节。
"""
import io, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(ROOT, '文档', '页面布局与交互规格.md')
s = io.open(p, encoding='utf-8').read()

old = "\nL10组件命名对照\n"
new = "\n## L10组件命名对照\n"
if s.count(old) != 1:
    print('!! 匹配 %d 次（应为 1）' % s.count(old))
    sys.exit(1)
s = s.replace(old, new)
with io.open(p, 'w', encoding='utf-8', newline='') as f:
    f.write(s)
print('OK 页面布局与交互规格.md（补回 ## L10 标题）')
