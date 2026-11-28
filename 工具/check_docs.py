# -*- coding: utf-8 -*-
"""文档构建自检 —— 校验「md 源」与「docx 交付物」是否一致。

检查三件事：
  1. 代码围栏成对（不出现空围栏 / 未闭合）—— 否则 md2docx 会把后面整段吞进代码块
  2. 表格数量 md == docx
  3. 标题数量与内容 md == docx（逐条比对）

用法：python 工具/check_docs.py
"""
import io
import os
import re
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, '..'))
DOCS = os.path.join(ROOT, '文档')
OUT = os.path.join(ROOT, '交付物')
FENCE = chr(96) * 3

from docx import Document
from docx.oxml.ns import qn

# md 源 -> docx 交付物
PAIRS = [
    ('需求规格.md', '亏了-规则文件.docx'),
    ('设计说明.md', '亏了-设计解释.docx'),
    ('页面布局与交互规格.md', '亏了-页面与交互规格.docx'),
    ('参数速查表.md', '参数速查表.docx'),
]

fails = 0


def fail(msg):
    global fails
    fails += 1
    print('  *** FAIL: %s' % msg)


# ---------- 1. 代码围栏 ----------
print('=== 1. 代码围栏配对 ===')
for f in sorted(os.listdir(DOCS)):
    if not f.endswith('.md'):
        continue
    lines = io.open(os.path.join(DOCS, f), encoding='utf-8').read().split('\n')
    infence = False
    start = 0
    content = []
    empties = []
    unclosed = []
    for i, l in enumerate(lines, 1):
        if l.strip().startswith(FENCE):
            if not infence:
                infence = True
                start = i
                content = []
            else:
                if not any(x.strip() for x in content):
                    empties.append((start, i))
                infence = False
        elif infence:
            content.append(l)
    if infence:
        unclosed.append(start)
    status = 'OK' if not empties and not unclosed else '*** MISMATCH ***'
    print('  %-24s %s' % (f, status))
    if empties:
        fail('%s 空代码围栏 %s' % (f, empties))
    if unclosed:
        fail('%s 代码围栏未闭合，起始于行 %s' % (f, unclosed))


# ---------- 2/3. md vs docx ----------
def norm(s):
    """归一化：去 markdown 加粗/斜体/代码标记与空白，让 md 与 docx 文本可比。"""
    s = re.sub(r'[*`]', '', s)
    return re.sub(r'\s+', '', s)


def md_stats(path):
    lines = io.open(path, encoding='utf-8').read().split('\n')
    tables = 0
    wide = 0          # 成稿里仍是真表格的表（3 列及以上）
    heads = []
    i = 0
    while i < len(lines):
        s = lines[i].strip()
        # ⚠️ 流程图块（:::flow ... :::）在 docx 里也是一张表，但它是图形不是表格，
        #    md 侧不计入表格数，docx 侧也要排除，两边才能对上。
        if s.startswith(':::flow'):
            i += 1
            while i < len(lines) and not lines[i].strip().startswith(':::'):
                i += 1
            i += 1
            continue
        if s.startswith('|') and i + 1 < len(lines) and lines[i + 1].strip().startswith('|'):
            tables += 1
            # ⚠️ 列数算法必须与 `_md2docx.py` 完全一致。
            #    那里把「短标签列」的 2/3/4/5 列表都渲染成流水句，
            #    只保留真正的对照矩阵为网格表。判据必须同步。
            ncol = 0
            first_col = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                cells = lines[i].strip().strip('|').split('|')
                ncol = max(ncol, len(cells))
                if not re.fullmatch(r'[:\- ]+', cells[0].strip()):
                    first_col.append(cells[0].strip().strip('*'))
                i += 1
            short_labels = bool(first_col) and \
                all(len(x) <= 14 for x in first_col)
            flow = (ncol == 2) or \
                   (ncol in (3, 4, 5) and short_labels)
            if not flow:
                wide += 1
            continue
        m = re.match(r'^(#{1,6})\s+(.*)$', s)
        if m:
            heads.append(m.group(2).strip())
        i += 1
    return tables, wide, heads


def is_flow_table(tb):
    """判断是不是流程图表格。

    首选 `_md2docx.py` 打的 tblCaption='FLOWCHART' 标记（最准）；
    没标记时退回「奇数位全是 ▶ 箭头格」的特征判断（兼容旧文档）。
    """
    try:
        cap = tb._tbl.tblPr.find(qn('w:tblCaption'))
        if cap is not None and cap.get(qn('w:val')) == 'FLOWCHART':
            return True
    except Exception:
        pass
    ncol = len(tb.columns)
    if ncol < 3 or ncol % 2 == 0:
        return False
    try:
        for ri in range(len(tb.rows)):
            for ci in range(1, ncol, 2):
                if tb.rows[ri].cells[ci].text.strip() != '▶':
                    return False
    except Exception:
        return False
    return True


def docx_stats(path):
    d = Document(path)
    heads = [p.text.strip() for p in d.paragraphs if p.style.name.startswith('Heading')]
    real = [tb for tb in d.tables if not is_flow_table(tb)]
    return len(real), heads


def docx_table_titles(path):
    """参数速查表把 ### 小节标题放进表格首行（合并单元格），不在 Heading 样式里。"""
    from docx.oxml.ns import qn
    d = Document(path)
    out = []
    for t in d.tables:
        c = t.rows[0].cells[0]
        tcPr = c._tc.tcPr
        gs = tcPr.find(qn('w:gridSpan')) if tcPr is not None else None
        if gs is not None and int(gs.get(qn('w:val'))) == len(t.columns):
            out.append(c.text.strip())
    return out


print('\n=== 2/3. md 源 vs docx 交付物 ===')
for mdf, dxf in PAIRS:
    mdpath = os.path.join(DOCS, mdf)
    dxpath = os.path.join(OUT, dxf)
    print('  == %s -> %s' % (mdf, dxf))
    if not os.path.exists(dxpath):
        fail('%s 不存在' % dxf)
        continue
    mt, mw, mh = md_stats(mdpath)
    dt, dh = docx_stats(dxpath)
    # 参数速查表的小节标题在表格首行，不在 Heading 样式里
    inline_titles = docx_table_titles(dxpath) if mdf == '参数速查表.md' else []
    md_h3 = [h for h in mh if re.match(r'^\d+\.\d+', h)]
    if inline_titles:
        print('     heads  md=%d docx=%d（另有 %d 个小节标题在表格首行）' %
              (len(mh), len(dh), len(inline_titles)))
        if len(md_h3) != len(inline_titles):
            fail('%s 小节标题数不一致 md=%d docx=%d' % (dxf, len(md_h3), len(inline_titles)))
        else:
            mm = [norm(h) for h in md_h3]
            dd = [norm(h) for h in inline_titles]
            if mm != dd:
                diff = [(a, b) for a, b in zip(mm, dd) if a != b]
                fail('%s 小节标题内容不一致 %s' % (dxf, diff[:5]))
            else:
                print('     小节标题内容一致  OK')
    else:
        # ⚠️ 2026-11-25：成稿里**两列表渲染成流水句**（`_md2docx.py` 的 FLOW_2COL），
        #    所以 docx 的真表格数只等于 md 里「不是两列」的表数。
        print('     tables md=%d（其中非两列 %d） docx=%d  %s'
              % (mt, mw, dt, 'OK' if mw == dt else '*** MISMATCH ***'))
        print('     heads  md=%d docx=%d  %s' % (len(mh), len(dh), 'OK' if len(mh) == len(dh) else '*** MISMATCH ***'))
        if mw != dt:
            fail('%s 表格数不一致' % dxf)
        if len(mh) != len(dh):
            fail('%s 标题数不一致' % dxf)
        ms = [norm(h) for h in mh]
        ds = [norm(h) for h in dh]
        if ms != ds:
            only_md = [h for h in ms if h not in ds]
            fail('%s 标题内容不一致（md 有 docx 无：%d 条）%s' % (dxf, len(only_md), only_md[:8]))

# ---------- 4. 合订本包含三份 md ----------
print('\n=== 4. 合订本 亏了-需求规格与设计说明.docx ===')
BUNDLE = os.path.join(OUT, '亏了-需求规格与设计说明.docx')
if not os.path.exists(BUNDLE):
    fail('合订本不存在')
else:
    _, bh = docx_stats(BUNDLE)
    bset = set(norm(h) for h in bh)
    for mdf in ['需求规格.md', '设计说明.md', '页面布局与交互规格.md']:
        _, _, mh = md_stats(os.path.join(DOCS, mdf))
        miss = [h for h in mh if norm(h) not in bset]
        print('     %-16s 标题 %d，缺 %d  %s' %
              (mdf, len(mh), len(miss), 'OK' if not miss else '*** MISMATCH ***'))
        if miss:
            fail('合订本缺 %s 的标题 %s' % (mdf, miss[:8]))

print('\n%s' % ('全部通过' if fails == 0 else '失败 %d 项' % fails))
sys.exit(1 if fails else 0)
