# -*- coding: utf-8 -*-
"""复核 2（第二轮）—— 语义完整性检查。

第一轮查的是「该删的删干净了吗」，这一轮查「**该留的有没有被误伤**」。

四件事：
  1. **硬性规则标记完整性** —— （必读）/（边界）/（说白了）/ NORM / STRONG / CONCRETE
     这些是文档里「不能改」的规则标记，删章节时不能连带删掉标记本身。
  2. **关键业务字段完整性** —— 押金 / 信用分 / 见证席 / 判定 / 结算 的核心口径还在。
  3. **Demo 数据与文档口径一致** —— demo 里的常量值要对得上文档。
  4. **删除的机制在 demo 里真的没有残留入口** —— 逐个关键词扫 demo 的 HTML/JS。
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, '文档')
DEMO = os.path.join(ROOT, 'demo')

fails = []
warns = []

# ---------- 1. 硬性规则标记完整性 ----------
print('=== 1. 硬性规则标记 ===')
RULE_MARKERS = ['（必读）', '（边界）', '（说白了）', '（说明）', 'NORM', 'STRONG', 'CONCRETE']
for f in ['需求规格.md', '设计说明.md', '参数速查表.md', '合规红线.md']:
    p = os.path.join(DOCS, f)
    if not os.path.exists(p):
        continue
    t = io.open(p, encoding='utf-8').read()
    counts = {m: t.count(m) for m in RULE_MARKERS}
    total = sum(counts.values())
    print('  -- %-16s 标记总数 %4d  %s' % (f, total,
          ' '.join('%s=%d' % (k.replace('（', '').replace('）', ''), v)
                   for k, v in counts.items() if v)))
    if total == 0:
        fails.append('%s 硬性规则标记全丢' % f)

# ---------- 2. 关键业务口径仍在 ----------
print('\n=== 2. 关键业务口径 ===')
KEY_FACTS = {
    '押金上限 5000': ('需求规格.md', r'5000'),
    '信用分上限 100': ('需求规格.md', r'\|\s*上限\s*\|\s*100'),
    '失败扣收 20%–40%': ('需求规格.md', r'20%\s*/\s*25%\s*/\s*30%\s*/\s*35%\s*/\s*40%|20%–40%'),
    '达标全额退还': ('需求规格.md', r'100%\s*全额退还|全额退还'),
    '见证席坑位 10': ('需求规格.md', r'坑位.*10|≤\s*10'),
    '异议阈值 3 票': ('需求规格.md', r'3\s*人|3\s*票|≥3'),
    '筹备期 24 小时': ('需求规格.md', r'24\s*小时'),
    '补卡窗口 12 小时': ('需求规格.md', r'12\s*小时'),
    '判定窗口 48 小时': ('需求规格.md', r'48\s*小时'),
    '打卡照秤读数': ('需求规格.md', r'体重秤读数|秤读数'),
    '手写随机词': ('需求规格.md', r'手写随机词'),
    '两结局达标失败': ('需求规格.md', r'只有两个结局|只有达标\s*/\s*失败'),
}
for label, (fn, pat) in KEY_FACTS.items():
    t = io.open(os.path.join(DOCS, fn), encoding='utf-8').read()
    ok = re.search(pat, t) is not None
    print('  -- %-16s %s' % (label, 'OK' if ok else '*** 缺失 ***'))
    if not ok:
        fails.append('关键口径缺失: %s' % label)

# ---------- 3. demo 常量与文档口径一致 ----------
print('\n=== 3. demo 常量 vs 文档口径 ===')
data = io.open(os.path.join(DEMO, 'js', 'data.js'), encoding='utf-8').read()
CHECKS = [
    ('打卡照物证只有两项', r"evidence:\[?'体重秤读数','手写随机词", data),
    ('已无 WITNESS_LEVELS', r'WITNESS_LEVELS', data),
    ('已无 challenge 集合', r'const\s+CHALLENGE', data),
    ('信用分区间存在', r'CREDIT_TIERS', data),
]
for label, pat, src in CHECKS:
    hit = re.search(pat, src) is not None
    if label.startswith('已无'):
        ok = not hit
    else:
        ok = hit
    print('  -- %-20s %s' % (label, 'OK' if ok else '*** 不符 ***'))
    if not ok:
        fails.append('demo 常量不符: %s' % label)

# ---------- 4. demo 里已删除机制的残留入口 ----------
print('\n=== 4. demo 已删除机制的残留入口 ===')
demo_src = ''
for dp, dn, fs in os.walk(DEMO):
    if '__pycache__' in dp:
        continue
    for fn in fs:
        # ⚠️ tests/ 里的是**否定式断言**（「不再有人脸 / 视频 / 参照物 / 哈希」），
        #    那正是我们要的 —— 不能算残留。
        if fn.endswith(('.js', '.html', '.css')) and not dp.endswith('tests'):
            demo_src += io.open(os.path.join(dp, fn), encoding='utf-8').read()
DEMO_DEAD = [
    ('视频验证', r'视频验证|已完成视频|随机挑战'),
    ('人脸比对', r'人脸|活体|基准脸'),
    ('哈希校验', r'pHash|SHA-256|感知哈希'),
    ('参照物', r'参照物'),
    ('L1/L2/L3 取证层', r'L1 自动数据|L2 标尺|L3 随机|三层物证|照片三要素'),
    ('见证席等级', r'V1 见习|V2 进阶|V3 资深|V4 首席|见证席等级'),
    ('健康底线三项', r'准入门槛|过量减重|触底判负|体重安全下限'),
]
for label, pat in DEMO_DEAD:
    ms = re.findall(pat, demo_src)
    ok = len(ms) == 0
    print('  -- %-16s %s%s' % (label, 'OK' if ok else '*** 残留 %d 处 ***' % len(ms),
                               '' if ok else '  ' + str(sorted(set(ms))[:6])))
    if not ok:
        fails.append('demo 残留: %s（%d 处）' % (label, len(ms)))

print('\n%s' % ('✅ 全部通过' if not fails else '❌ 发现 %d 处问题' % len(fails)))
sys.exit(1 if fails else 0)
