# -*- coding: utf-8 -*-
"""收集所有要转换的英文标识 / CSS 类 / 像素行，供建立映射表。"""
import io, os, re, sys
from collections import Counter, defaultdict

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, '..'))
DOCS = os.path.join(ROOT, '文档')

FILES = ['需求规格.md', '设计说明.md', '合规红线.md', '上线清单.md', '参数速查表.md']

# 英文常量出现位置
CONST = defaultdict(list)
for f in FILES:
    L = io.open(os.path.join(DOCS, f), encoding='utf-8').read().split('\n')
    for i, l in enumerate(L):
        for m in re.finditer(r'\b((?:INFO|PAGES|STATE|DATA|INJECTORS|CREDIT_TIERS|FLAG_DEP_RANGE|BREAK_RULES)\.\w+)', l):
            CONST[m.group(1)].append((f, i + 1, l.strip()[:100]))

print('=== 英文常量 ===')
for k, v in sorted(CONST.items(), key=lambda x: -len(x[1])):
    print('\n  %-32s %d 次' % (k, len(v)))
    for f, ln, s in v[:3]:
        print('      %-14s 行%-6d %s' % (f, ln, s[:92]))

# 反引号标识
print('\n\n=== 反引号标识（按出现次数）===')
ticks = Counter()
for f in FILES:
    t = io.open(os.path.join(DOCS, f), encoding='utf-8').read()
    for m in re.finditer(r'`([^`\n]{2,60})`', t):
        ticks[m.group(1)] += 1
for k, v in ticks.most_common(70):
    print('  %-46s %d' % (k[:46], v))
