# -*- coding: utf-8 -*-
"""两轮自复核 —— 残留扫描 + 交叉引用完整性检查。

**白名单机制**：某些文件本身就描述「已删除的东西」，不该被判为残留：
  · 根 README.md 的本轮变更记录 —— 它必须提到被删的机制名
  · 对标-DietBet产品图鉴.md —— 里面描述的是 **DietBet 自己的做法**（人脸 / 活体 /
    过量减重是 DietBet 的设计），不是本产品的
  · 想法演进.md —— 历史决策记录，不扫
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

LIVE = [
    '文档/需求规格.md',
    '文档/设计说明.md',
    '文档/参数速查表.md',
    '文档/技术选型.md',
    '文档/上线清单.md',
    '文档/页面布局与交互规格.md',
    '文档/问题与坑.md',
    '文档/里程碑.md',
    'demo/README.md',
]

# 逐行白名单：这些行即使命中关键词也放过（附原因）
LINE_EXEMPT = [
    # 根 README 本轮变更记录 —— 描述「删除了什么」
    (re.compile(r'^\s*(\d+\.|-)\s.*(删除|全局删除|不再|移除)'), '变更记录（在描述已删除的机制）'),
    # 设计说明 D11.1 —— 标题本身就是「为什么不设准入门槛」
    (re.compile(r'不设准入门槛'), '否定式表述'),
    (re.compile(r'没有中途主动退出的通道（安全中止）'), '否定式表述'),
    (re.compile(r'为什么禁止行为要列得这么细'), '新写的章节导语'),
]

PATTERNS = [
    ('视频认证', r'视频验证|随机挑战视频|L3 随机|已完成视频验证|\bchallenge\b'),
    ('人脸/活体', r'人脸|活体|基准脸|Face compare'),
    ('哈希', r'pHash|SHA-256|感知哈希|账号哈希'),
    ('参照物', r'参照物|标尺照片|L2 标尺'),
    ('取证分层', r'L1 自动数据|L2 标尺|L3 随机挑战|三层物证|照片三要素|打卡照三要素'),
    ('见证席等级', r'V1 见习|V2 进阶|V3 资深|V4 首席|见证席等级|WITNESS_LEVELS'),
    ('健康底线三项', r'准入门槛|过量减重|触底判负|体重安全下限|安全中止'),
]

fails = []
total = 0

print('=== 复核 1：活文档残留扫描 ===')
for rel in LIVE:
    p = os.path.join(ROOT, rel)
    if not os.path.exists(p):
        continue
    lines = io.open(p, encoding='utf-8').read().split('\n')
    hits = []
    for label, pat in PATTERNS:
        rx = re.compile(pat)
        for i, l in enumerate(lines, 1):
            if not rx.search(l):
                continue
            if any(rx2.search(l) for rx2, _ in LINE_EXEMPT):
                continue
            hits.append((label, i, l.strip()))
    if hits:
        print('\n  -- %s' % rel)
        for label, i, l in hits:
            print('     [%s] %d: %s' % (label, i, l[:130]))
            fails.append('%s:%d [%s] %s' % (rel, i, label, l[:80]))
    total += len(hits)

print('\n  共 %d 处残留' % total)

# ---------- 复核 2：交叉引用完整性 ----------
print('\n=== 复核 2：R / D / L 章节交叉引用 ===')
REFS = [
    ('文档/需求规格.md', r'R(\d+(?:\.\d+)*)'),
    ('文档/设计说明.md', r'D(\d+(?:\.\d+)*)'),
    ('文档/页面布局与交互规格.md', r'L(\d+(?:\.\d+)*)'),
]


def headings(path, prefix):
    """抽出文档里真实存在的章节号（去掉 R/D/L 前缀）。

    章节号有两种形态：
      ① `### R2.9.2 见证席面板…`  —— 真标题
      ② `（必读）R2.9.2 见证席面板…` —— **行内标签**（本项目常见写法）
         ②类不算「被引用但不存在」，但也要算「存在」—— 否则它自己会误报。
    """
    text = io.open(os.path.join(ROOT, path), encoding='utf-8').read()
    hs = set()
    for m in re.finditer(r'^#{2,4}\s+([A-Z]?\d+(?:\.\d+)*)', text, re.M):
        h = m.group(1)
        if h.startswith(prefix):
            hs.add(h[len(prefix):])
    # 行内标签：「（必读）R2.9.2 …」/「（边界）D2.7 …」
    for m in re.finditer(r'[（(][^）)]{0,6}[）)]\s*([A-Z]\d+(?:\.\d+)*)', text):
        h = m.group(1)
        if h.startswith(prefix):
            hs.add(h[len(prefix):])
    # 「旧编号别名：D2.6 / D2.7 / …」—— 合并版的历史别名，也是有效指向
    for m in re.finditer(r'旧编号别名[：:]\s*([^\n]+)', text):
        for h in re.findall(r'\b([A-Z]\d+(?:\.\d+)*)\b', m.group(1)):
            if h.startswith(prefix):
                hs.add(h[len(prefix):])
    return hs


ref_fails = 0
for path, pat in REFS:
    prefix = pat[0]
    defined = headings(path, prefix)
    text = io.open(os.path.join(ROOT, path), encoding='utf-8').read()
    body, in_fence = [], False
    for l in text.split('\n'):
        if l.strip().startswith('```'):
            in_fence = not in_fence
            continue
        if not in_fence:
            body.append(l)
    used = set(re.findall(pat, '\n'.join(body)))
    missing = sorted(u for u in used if u not in defined and u.count('.') <= 2)
    if missing:
        print('\n  -- %s 引用了不存在的章节：%s' % (path, missing[:20]))
        ref_fails += len(missing)
        fails.append('%s 引用不存在章节 %s' % (path, missing[:20]))
    else:
        print('  -- %s  OK（%d 个被引用章节全部存在）' % (path, len(used)))

# ---------- 复核 3：demo 里不能有孤儿引用 ----------
print('\n=== 复核 3：demo JS 里的孤儿常量引用 ===')
js_dir = os.path.join(ROOT, 'demo', 'js')
js_files = [os.path.join(js_dir, f) for f in sorted(os.listdir(js_dir)) if f.endswith('.js')]
allsrc = '\n'.join(io.open(f, encoding='utf-8').read() for f in js_files)
for const in ['WITNESS_LEVELS', 'CHALLENGE', 'P_HASH', 'FACE', 'LIFECYCLE']:
    n = len(re.findall(r'\b%s\b' % const, allsrc))
    if n == 0:
        continue
    # 只要还有引用，就必须还有定义
    defined = len(re.findall(r'(?:const|let|var)\s+%s\b' % const, allsrc))
    status = 'OK' if defined else '*** 孤儿引用（无定义）***'
    if not defined:
        fails.append('demo: %s 有 %d 处引用但无定义' % (const, n))
    print('  -- %-16s 引用 %2d 次，定义 %d 次  %s' % (const, n, defined, status))

print('\n%s' % ('✅ 全部通过' if not fails else '❌ 发现 %d 处问题' % len(fails)))
sys.exit(1 if fails else 0)
