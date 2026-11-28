# -*- coding: utf-8 -*-
"""修正 参数速查表.docx 的小节编号（因删表导致断号），并可调整字号。

编号规则：
  - 按章内出现顺序重排为 1..n
  - 同步更新表内交叉引用（仅指向本文档小节编号的，如「见 9.5」「走 4.9 对照表」）
  - 不动 R2.1 / R8.3 / R12.2 / L2 这类外部规格文档章节号，也不动小数
"""
import os
import re
import sys
from collections import defaultdict

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, '..'))
DOCX = os.path.join(ROOT, '交付物', '参数速查表.docx')

from docx import Document
from docx.oxml.ns import qn

# 外部文档章节号（R/L 开头或已知规格号），不参与重排
EXTERNAL = re.compile(r'(?:R|L)\s?\d+(?:\.\d+)?')


def is_external(s):
    return bool(EXTERNAL.fullmatch(s.strip())) or s.strip() in ('2.1', '12.2')


def get_titles(doc):
    """返回 [(table, merged_cell, title_text)] —— 表格首行为合并的小节标题"""
    out = []
    for t in doc.tables:
        c = t.rows[0].cells[0]
        tcPr = c._tc.tcPr
        gs = tcPr.find(qn('w:gridSpan')) if tcPr is not None else None
        if gs is not None and int(gs.get(qn('w:val'))) == len(t.columns):
            out.append((t, c, c.text.strip()))
    return out


def build_mapping(titles):
    """按章重排编号，返回 {旧号: 新号}"""
    sec = defaultdict(list)
    for t, c, txt in titles:
        m = re.match(r'^(\d+)\.(\d+)\s', txt)
        if m:
            sec[int(m.group(1))].append((int(m.group(2)), txt))

    mapping = {}
    for k in sorted(sec):
        items = sec[k]
        nums = [n for n, _ in items]
        if nums == list(range(1, len(nums) + 1)):
            continue                      # 已连续，无需改
        for i, (old, _) in enumerate(items):
            new = '%d.%d' % (k, i + 1)
            if '%d.%d' % (k, old) != new:
                mapping['%d.%d' % (k, old)] = new
    return mapping


def apply_mapping(mapping):
    """改标题文本 + 表内引用"""
    changed_titles = 0
    changed_refs = 0
    doc = Document(DOCX)

    # 1) 标题文本
    for t, c, txt in get_titles(doc):
        m = re.match(r'^(\d+)\.(\d+)(\s.*)$', txt, re.S)
        if not m:
            continue
        old = '%s.%s' % (m.group(1), m.group(2))
        if old not in mapping:
            continue
        new = mapping[old]
        # 替换标题首行的第一个 run 的文本
        par = c.paragraphs[0]
        if not par.runs:
            continue
        par.runs[0].text = re.sub(r'^\d+\.\d+', new, par.runs[0].text)
        # 若标题文本被拆到多个 run，把剩余部分并到第一个 run
        if len(par.runs) > 1:
            rest = ''.join(r.text for r in par.runs[1:])
            par.runs[0].text += rest
            for r in par.runs[1:]:
                r.text = ''
        changed_titles += 1

    # 2) 表内交叉引用（跳过标题首行本身，避免二次替换）
    #    注意：不能用 id(cell._tc) 判重 —— row.cells 每次返回新代理对象。
    #    改用 XML 元素的实际路径：标题行 = 表格的第 0 行。
    def iter_data_cells(t):
        for ri, row in enumerate(t.rows):
            if ri == 0:
                continue          # 首行是小节标题行
            for cell in row.cells:
                yield cell

    def repl(text):
        nonlocal changed_refs
        out = []
        last = 0
        for m in re.finditer(r'(?<![\d.])(\d{1,2}\.\d{1,2})(?![\d])', text):
            tok = m.group(1)
            # 跳过外部规格号
            pre = text[max(0, m.start() - 2):m.start()]
            if EXTERNAL.search(pre) or is_external(tok):
                continue
            # 跳过小数（0.6 / 1.0 / 0.05）
            if re.match(r'^\d\.\d$', tok) and float(tok) < 1:
                continue
            if tok in mapping:
                out.append(text[last:m.start()])
                out.append(mapping[tok])
                last = m.end()
                changed_refs += 1
        out.append(text[last:])
        return ''.join(out)

    for t in doc.tables:
        for cell in iter_data_cells(t):
            for par in cell.paragraphs:
                if not par.runs:
                    continue
                new_text = repl(par.text)
                if new_text != par.text:
                    # 保留首个 run 的格式，整体替换
                    par.runs[0].text = new_text
                    for r in par.runs[1:]:
                        r.text = ''

    doc.save(DOCX)
    return changed_titles, changed_refs


if __name__ == '__main__':
    doc = Document(DOCX)
    titles = get_titles(doc)
    mapping = build_mapping(titles)
    print('=== 重排映射 ===')
    for a, b in mapping.items():
        print('  %-7s -> %s' % (a, b))
    if not mapping:
        print('  无需重排')
    ct, cr = apply_mapping(mapping)
    print('改标题 %d 处，改表内引用 %d 处' % (ct, cr))

    # 复核
    doc2 = Document(DOCX)
    sec = defaultdict(list)
    for t, c, txt in get_titles(doc2):
        m = re.match(r'^(\d+)\.(\d+)', txt)
        if m:
            sec[int(m.group(1))].append(int(m.group(2)))
    bad = [k for k in sorted(sec) if sec[k] != list(range(1, len(sec[k]) + 1))]
    print('复核：仍断号的章 =', bad if bad else '无')
