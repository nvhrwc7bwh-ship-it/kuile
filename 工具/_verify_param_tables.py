# -*- coding: utf-8 -*-
"""校验 参数速查表.docx：表数量/列数/单元格内容与 md 源一致，且无正文段落。"""
import io
import os
import re
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, '..'))
from docx import Document
from docx.oxml.ns import qn

md = io.open(os.path.join(ROOT, '文档', '参数速查表.md'), encoding='utf-8').read()
doc = Document(os.path.join(ROOT, '交付物', '参数速查表.docx'))

# --- 从 md 解析表 ---
def parse_md_tables(text):
    tables = []
    lines = text.split('\n')
    i = 0
    while i < len(lines):
        s = lines[i].strip()
        if s.startswith('|') and i + 1 < len(lines) and lines[i + 1].strip().startswith('|'):
            buf = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                buf.append(lines[i]); i += 1
            rows = []
            for ln in buf:
                cells = [c.strip() for c in ln.strip().strip('|').split('|')]
                if all(re.fullmatch(r':?-{2,}:?', c or '') for c in cells):
                    continue
                rows.append(cells)
            tables.append(rows)
            continue
        i += 1
    return tables

md_tables = parse_md_tables(md)
dx_tables = doc.tables
print('md tables  :', len(md_tables))
print('docx tables:', len(dx_tables))

errs = []
for ti, (mt, dt) in enumerate(zip(md_tables, dx_tables)):
    # docx 表首行是合并的 ### 标题行，md 里标题在表外 —— 跳过首行
    off = 1 if len(dt.rows) == len(mt) + 1 else 0
    if len(dt.rows) - off != len(mt):
        errs.append('表%d 行数 md=%d docx=%d' % (ti + 1, len(mt), len(dt.rows)))
        continue
    for ri, mrow in enumerate(mt):
        drow = dt.rows[ri + off].cells
        if len(drow) != len(mrow):
            errs.append('表%d 行%d 列数 md=%d docx=%d' % (ti + 1, ri + 1, len(mrow), len(drow)))
            continue
        for ci, mcell in enumerate(mrow):
            dtext = re.sub(r'\s+', '', drow[ci].text)
            exp = re.sub(r'\s+', '', re.sub(r'[*`]', '', mcell))
            # docx 里 **加粗** 被拆成 run，text 已含内容
            if dtext != exp:
                errs.append('表%d 行%d 列%d: md=%r docx=%r' % (ti + 1, ri + 1, ci + 1, mcell, drow[ci].text))

print('cell mismatches:', len(errs))
for e in errs[:30]:
    print('  !', e)

body = [p.text for p in doc.paragraphs
        if not p.style.name.startswith('Heading') and p.text.strip()]
print('non-heading paragraphs:', len(body))
for b in body[:10]:
    print('  !', b[:100])
hs = [p for p in doc.paragraphs if p.style.name.startswith('Heading')]
from collections import Counter
print('heading styles:', dict(Counter(p.style.name for p in hs)))

# --- 校验 ### 标题（现在位于表格首行）内容与顺序 ---
md_h3 = [m.group(1).strip() for m in
         re.finditer(r'^###\s+(.*)$', io.open(os.path.join(ROOT, '文档', '参数速查表.md'),
                                          encoding='utf-8').read(), re.M)]
dx_h3 = []
for t in doc.tables:
    first = t.rows[0].cells[0]
    gs = first._tc.tcPr.find(qn('w:gridSpan')) if first._tc.tcPr is not None else None
    if gs is not None and int(gs.get(qn('w:val'))) == len(t.columns):
        dx_h3.append(re.sub(r'\s+', '', first.text))
exp_h3 = [re.sub(r'\s+', '', h) for h in md_h3]
print('h3 标题: md=%d docx=%d  内容一致=%s' %
      (len(exp_h3), len(dx_h3), exp_h3 == dx_h3))
if exp_h3 != dx_h3:
    for a, b in zip(exp_h3, dx_h3):
        if a != b:
            print('  ! md=%r docx=%r' % (a, b))
            break
# --- 关键数值抽查：与 需求规格.md 做交叉验证 ---
spec = io.open(os.path.join(ROOT, '文档', '需求规格.md'), encoding='utf-8').read()
CHECKS = [
    ('× 0.6', 4), ('× 0.8', 4), ('× 1.0', 4),
    ('-30', 3), ('-8', 4), ('-5', 4), ('+35', 2), ('+20', 2),
    ('48 小时', 2), ('12 小时', 5), ('20 小时', 2), ('24 小时', 6),
    ('5–10%', 3), ('0.05%', 2), ('3 个工作日', 3),
    ('60%', 1), ('5000', 4), ('1000', 4),
]
print('\n--- 关键数值在 需求规格.md 中的出现次数 ---')
for k, _ in CHECKS:
    print('  %-12s 需求规格=%d' % (k, spec.count(k)))
