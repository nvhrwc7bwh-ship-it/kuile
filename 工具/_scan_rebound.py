# -*- coding: utf-8 -*-
"""「目标体重回升」概念的广谱扫描。

第七项要求删除的是**概念**，不只是字面的「回升」二字。
所以要扫所有可能的**语义变体**：

  字面词    回升 / 反弹 / 复胖 / 掉秤 / 反弹幅度
  语义变体  体重上升 / 体重增加 / 比之前重 / 变重 / 涨了 / 增重 / 长肉
            体重曲线上的「反向」判断
  概念载体  回升预警 / 回升判定 / 回升记录 / 回弹

同时扫**代码标识符**（camelCase / snake_case / CONST），因为实现里
未必用中文命名。
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 字面 / 直接语义
LITERAL = [
    '回升', '反弹', '复胖', '掉秤', '增重', '长肉',
    '体重上升', '体重增加', '比之前重', '变重', '涨了',
    '回弹', '反弹幅度', '回升幅度', '回升预警', '回升判定', '回升记录',
]

# 代码标识符（英文）
IDENT = [
    r'\bweightRebound\b', r'\bweightRise\b', r'\bweightRegain\b',
    r'\bweightIncrease\b', r'\bweightUp\b', r'\brebound\b', r'\breboundWarn',
    r'\bweight_bounce\b', r'\bweight_rebound\b', r'\bweight_rise\b',
    r'\bhasRebounded\b', r'\bisRebound\b',
]

# 扫描范围：全部活文件
SCAN_EXT = ('.md', '.js', '.html', '.css', '.py', '.json')
SKIP_DIRS = {'__pycache__', '_preview', 'node_modules', '.git'}

hits = []

for dp, dn, fs in os.walk(ROOT):
    dn[:] = [d for d in dn if d not in SKIP_DIRS]
    for fn in fs:
        if not fn.endswith(SCAN_EXT):
            continue
        p = os.path.join(dp, fn)
        rel = os.path.relpath(p, ROOT)
        try:
            text = io.open(p, encoding='utf-8').read()
        except Exception:
            continue
        # ⚠️ 排除本扫描脚本自身 —— 它的关键词表本身就会命中
        if os.path.abspath(p) == os.path.abspath(__file__):
            continue
        lines = text.split('\n')
        for i, l in enumerate(lines, 1):
            for kw in LITERAL:
                if kw in l:
                    hits.append((rel, i, kw, '字面', l.strip()))
            for rx in IDENT:
                if re.search(rx, l):
                    hits.append((rel, i, rx, '标识符', l.strip()))

# 「想法演进.md」是决策记录 —— 它提到「目标体重回升」是**在描述这次删除任务**，
# 属于合法命中，单独标注出来。
REAL = [h for h in hits if '想法演进' not in h[0]]
LOG = [h for h in hits if '想法演进' in h[0]]

print('=== 「目标体重回升」概念扫描 ===')
print('  活文件命中：%d 处' % len(REAL))
for rel, i, kw, kind, l in REAL:
    print('   %s:%d  [%s|%s] %s' % (rel, i, kind, kw, l[:110]))
print('  决策记录命中（合法）：%d 处' % len(LOG))
for rel, i, kw, kind, l in LOG:
    print('   %s:%d  %s' % (rel, i, l[:100]))

sys.exit(1 if REAL else 0)
