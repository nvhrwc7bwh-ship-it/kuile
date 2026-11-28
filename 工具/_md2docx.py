# -*- coding: utf-8 -*-
"""Markdown -> docx 转换器（针对本项目格式）
支持：标题、段落、无序/有序列表、引用块、代码块、表格、分隔线、**粗体** *斜体* `代码`

⚠️ 2026-11-25（本轮）：排版整体压缩 —— 目标是把《需求规格与设计说明》合订本
   控制在 100 页以内（原来 388 页）。手段（**只动排版，不删内容**）：
     ① 页边距 2.2cm → 1.5cm
     ② 正文 10.5pt → 9pt，行距 1.3 → 1.12
     ③ 表格 9.5pt → 8pt，单元格内边距压到最小（560 张表，省掉的是大头）
     ④ 表格后面那个空段落删掉（560 张表 × 1 行 = 560 行白空间）
     ⑤ 标题字号 / 段前段后间距同步收紧
"""
import re, sys, io, os, math
import docx
from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

CN = '微软雅黑'
MONO = 'Consolas'

# ---------- 排版参数（集中在这里，方便整体微调） ----------
# ⚠️ 2026-11-25（本轮第二轮）：在 212 页基础上继续压到 ≤100 页。
#    手段是「排版 + 正文精简」双管齐下：
#      ① 页边距 1.2cm，正文 8.5pt，行距 1.06
#      ② 表格 7.5pt + 单元格内边距压到最小
#      ③ **表格列宽按内容比例分配**（Word 固定布局读 tblGrid，不是 cell.width）——
#         原来等宽分列，短标签列占着宽度、长内容列被挤成竖条，这是表格吃页的大头
#      ④ 表格后面那个空段落删掉
BODY_SIZE   = 7.0     # 正文字号
TABLE_SIZE  = 6.0      # 表格字号
QUOTE_SIZE  = 6.5      # 引用块字号
CODE_SIZE   = 7.0      # 代码块字号
LINE        = 1.0     # 正文行距
LINE_TBL    = 1.0      # 表格行距
LINE_QUOTE  = 1.0      # 引用块行距
LINE_LIST   = 1.0      # 列表行距
MARGIN_CM   = 1.0      # 页边距
CONTENT_CM = 21.0 - 2 * MARGIN_CM   # 正文可用宽度（A4 21cm）
FLOW_2COL  = True      # 两列表渲染成流水句（省页）
FLOW_3COL  = True      # 三列表（短标签列）也渲染成流水句
FLOW_NCOL  = True      # 四/五列表（短标签列）也渲染成流水句

def set_run_font(run, name=CN, size=None, bold=None, color=None):
    run.font.name = name
    run._element.rPr.rFonts.set(qn('w:eastAsia'), name)
    if size: run.font.size = Pt(size)
    if bold is not None: run.font.bold = bold
    if color: run.font.color.rgb = RGBColor(*color)

def add_inline(par, text, base_size=BODY_SIZE, base_bold=False, color=None):
    """解析 **bold** *italic* `code` 并写入 par"""
    token = re.compile(r'(\*\*.+?\*\*|\*[^*]+?\*|`[^`]+?`)')
    for part in token.split(text):
        if not part:
            continue
        if part.startswith('**') and part.endswith('**') and len(part) > 4:
            r = par.add_run(part[2:-2]); set_run_font(r, CN, base_size, True, color)
        elif part.startswith('`') and part.endswith('`') and len(part) > 2:
            r = par.add_run(part[1:-1]); set_run_font(r, MONO, base_size - 0.5, base_bold, (0xB0, 0x30, 0x60))
        elif part.startswith('*') and part.endswith('*') and len(part) > 2:
            r = par.add_run(part[1:-1]); set_run_font(r, CN, base_size, base_bold, color); r.font.italic = True
        else:
            r = par.add_run(part); set_run_font(r, CN, base_size, base_bold, color)

def set_shading(cell, hexcolor):
    tcPr = cell._tc.get_or_add_tcPr()
    for e in tcPr.findall(qn('w:shd')):
        tcPr.remove(e)
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear'); shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), hexcolor)
    # shd 排在 tcW 之后（tcPr schema：tcW → gridSpan → shd）
    tcw = tcPr.find(qn('w:tcW'))
    if tcw is not None:
        tcw.addnext(shd)
    else:
        tcPr.append(shd)

def set_table_borders(table, color='D8D8D8'):
    """给表格加浅灰细边框 —— 默认的黑色全框在长表格里太刺眼"""
    tblPr = table._tbl.tblPr
    borders = OxmlElement('w:tblBorders')
    for side in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        el = OxmlElement('w:' + side)
        el.set(qn('w:val'), 'single')
        el.set(qn('w:sz'), '4')       # 4 = 0.5pt
        el.set(qn('w:space'), '0')
        el.set(qn('w:color'), color)
        borders.append(el)
    tblPr.append(borders)


def set_row_shading(row, hexcolor):
    for c in row.cells:
        set_shading(c, hexcolor)


def set_cant_split(row):
    """禁止这一行被分页劈开 —— 长表格里半行文字跨页很难读"""
    trPr = row._tr.get_or_add_trPr()
    el = OxmlElement('w:cantSplit'); el.set(qn('w:val'), 'true')
    trPr.append(el)


def set_repeat_header(row):
    trPr = row._tr.get_or_add_trPr()
    el = OxmlElement('w:tblHeader'); el.set(qn('w:val'), 'true')
    trPr.append(el)

def set_cell_margins(table):
    """把表格单元格内边距压到最小（0.04cm）—— 560 张表，这是省页的大头"""
    tblPr = table._tbl.tblPr
    mar = OxmlElement('w:tblCellMar')
    for side, w in (('top', 0), ('left', 22), ('bottom', 0), ('right', 22)):
        el = OxmlElement('w:' + side)
        el.set(qn('w:w'), str(w))   # 单位 dxa：1 dxa = 1/20 pt
        el.set(qn('w:type'), 'dxa')
        mar.append(el)
    tblPr.append(mar)

def set_col_widths(table, rows, ncol, total_cm):
    """按每列内容的典型长度按比例分配列宽。

    ⚠️ 关键：Word 的「固定」布局读的是 `w:tblGrid`，**不是** `cell.width` ——
    只设 cell.width 不改 gridCol 的话，Word 仍按等宽重算，等于没改。
    所以这里三处都要写：`tblGrid/gridCol` + `tblPr/tblLayout=fixed` + 每格 `tcW`。
    """
    lens = []
    for ci in range(ncol):
        vals = sorted(len(r[ci]) for r in rows if ci < len(r))
        if not vals:
            vals = [4]
        idx = min(len(vals) - 1, int(len(vals) * 0.75))   # 75 分位：不被极端长格带偏
        lens.append(max(4, vals[idx]))
    # 开方压缩差距：内容长的列给更宽，但不让它吃掉整行
    w = [math.sqrt(x) for x in lens]
    s = sum(w)
    widths = [total_cm * x / s for x in w]

    # ⚠️ 短标题列保底：2 字标题（节点 / 次数 / 档位）挤成竖条，一个字一行。
    #    按「该列标题的最长不可拆词」算最小可用宽度 —— 中文 2 字一格，
    #    英文按单词。这样短列至少能横着放下标题。
    min_cm = []
    for ci in range(ncol):
        hdr = rows[0][ci].strip() if ci < len(rows[0]) else ''
        # 找最长的不可拆片段：中文连续 2 字 / 英文单词
        toks = re.findall(r'[\u4e00-\u9fff]{1,2}|[A-Za-z0-9_]+', hdr)
        need = max([len(t.encode('gbk', 'ignore')) / 2 for t in toks] or [2])
        # 中文按 2 字算需要 ~1.6cm，英文按 0.22cm/字符
        min_cm.append(min(3.2, 0.9 + need * 0.42))

    widths = [max(min_cm[i], x) for i, x in enumerate(widths)]
    sc = total_cm / sum(widths)
    widths = [x * sc for x in widths]
    # 缩放后仍要保证不低于最小宽度的 85%（缩放可能又压扁）
    widths = [max(min_cm[i] * 0.85, x) for i, x in enumerate(widths)]
    sc = total_cm / sum(widths)
    widths = [x * sc for x in widths]

    tbl = table._tbl
    # 1) 重建 tblGrid
    for g in tbl.findall(qn('w:tblGrid')):
        tbl.remove(g)
    grid = OxmlElement('w:tblGrid')
    for x in widths:
        gc = OxmlElement('w:gridCol')
        gc.set(qn('w:w'), str(int(round(x * 567))))      # 1cm = 567 dxa
        grid.append(gc)
    tbl.tblPr.addnext(grid)                             # tblGrid 必须紧跟 tblPr

    # 2) 固定布局 + 表宽
    for tag in ('w:tblLayout', 'w:tblW'):
        for e in tbl.tblPr.findall(qn(tag)):
            tbl.tblPr.remove(e)
    lay = OxmlElement('w:tblLayout'); lay.set(qn('w:type'), 'fixed')
    tbl.tblPr.append(lay)
    tw = OxmlElement('w:tblW')
    tw.set(qn('w:w'), str(int(round(total_cm * 567))))
    tw.set(qn('w:type'), 'dxa')
    tbl.tblPr.append(tw)

    # 3) 每格 tcW
    for row in table.rows:
        for ci, cell in enumerate(row.cells):
            if ci >= len(widths):
                continue
            tcPr = cell._tc.get_or_add_tcPr()
            for e in tcPr.findall(qn('w:tcW')):
                tcPr.remove(e)
            tcw = OxmlElement('w:tcW')
            tcw.set(qn('w:w'), str(int(round(widths[ci] * 567))))
            tcw.set(qn('w:type'), 'dxa')
            # ⚠️ 必须插在 tcPr 的**第一个位置** —— Word 的 tcPr 有 schema 顺序要求，
            #    tcW 要排在 shd 前面；append 到末尾会让 Word 忽略后面的底色。
            tcPr.insert(0, tcw)


def shade_by_bold(txt):
    """粗体开头 = 强调行"""
    t = txt.strip()
    return t.startswith('**')

def parse_table(md_lines):
    """返回 (rows, aligns) ; rows 为 cell 文本列表"""
    rows = []
    for ln in md_lines:
        ln = ln.strip()
        if not ln.startswith('|'):
            continue
        cells = ln.strip('|').split('|')
        cells = [c.strip() for c in cells]
        if all(re.fullmatch(r':?-{2,}:?', c or '') for c in cells):
            continue
        rows.append(cells)
    return rows

FLOW_HEAD = (0xFF, 0x8A, 0x2B)      # 流程条底色（品牌橙）
FLOW_TEXT = (0xFF, 0xFF, 0xFF)
FLOW_HEAD_HEX = 'FF8A2B'            # set_shading 要的是十六进制字符串
FLOW_BLANK_HEX = 'FFFFFF'


def add_flow(doc, title, chains):
    """画一条横向流程图。

    chains: [[步骤, 步骤, ...], ...] —— 每条链一行（如分叉）。
    """
    maxn = max(len(c) for c in chains)
    if maxn == 0:
        return
    if title:
        p = doc.add_paragraph()
        pf = p.paragraph_format
        pf.space_before = Pt(4); pf.space_after = Pt(1)
        pf.line_spacing = 1.0
        r = p.add_run(title)
        set_run_font(r, CN, BODY_SIZE - 0.5, True, (0x8A, 0x4B, 0x10))

    # 列数 = 步骤数 + 步骤间的箭头列
    ncol = maxn * 2 - 1
    t = doc.add_table(rows=0, cols=ncol)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_cell_margins(t)
    set_table_borders(t, 'FFFFFF')
    # ⚠️ 必须显式写 tblGrid + 固定布局 —— `add_table(rows=0, cols=n)` 建出来的
    #    表 gridCol 是空的，行加进去后列数对不上，Word 渲染时整块表格被丢弃
    #    （表现为 PDF 里流程图凭空消失）。
    tbl = t._tbl
    # ⚠️ 给流程图表格打标记（tblCaption）—— check_docs 靠它区分
    #    「流程图（也是表格）」和「真正的数据表」，否则两边表格数对不上。
    cap = OxmlElement('w:tblCaption')
    cap.set(qn('w:val'), 'FLOWCHART')
    tbl.tblPr.append(cap)

    for g in tbl.findall(qn('w:tblGrid')):
        tbl.remove(g)
    grid = OxmlElement('w:tblGrid')
    # 步骤列略宽于箭头列
    step_w = CONTENT_CM / maxn
    arrow_w = step_w * 0.42
    total = step_w * maxn + arrow_w * (maxn - 1)
    scale = CONTENT_CM / total if total else 1
    for ci in range(ncol):
        gc = OxmlElement('w:gridCol')
        w = (arrow_w if ci % 2 else step_w) * scale
        gc.set(qn('w:w'), str(int(round(w * 567))))
        grid.append(gc)
    tbl.tblPr.addnext(grid)
    for tag in ('w:tblLayout', 'w:tblW'):
        for e in tbl.tblPr.findall(qn(tag)):
            tbl.tblPr.remove(e)
    lay = OxmlElement('w:tblLayout'); lay.set(qn('w:type'), 'fixed')
    tbl.tblPr.append(lay)
    tw = OxmlElement('w:tblW')
    tw.set(qn('w:w'), str(int(round(CONTENT_CM * 567))))
    tw.set(qn('w:type'), 'dxa')
    tbl.tblPr.append(tw)
    # 去掉单元格内边距，让流程条紧贴
    for ri, chain in enumerate(chains):
        row = t.add_row()
        for ci in range(ncol):
            cell = row.cells[ci]
            cell.text = ''
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(1)
            p.paragraph_format.line_spacing = 1.0
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            if ci % 2 == 0:
                # 步骤格
                k = ci // 2
                if k < len(chain):
                    r = p.add_run(chain[k])
                    set_run_font(r, CN, BODY_SIZE - 0.5, True, FLOW_TEXT)
                    set_shading(cell, FLOW_HEAD_HEX)
                else:
                    set_shading(cell, 'FFFFFF')
            else:
                # 箭头格
                if ci // 2 < len(chain) - 1:
                    r = p.add_run('▶')
                    set_run_font(r, CN, BODY_SIZE - 0.5, False, (0xC0, 0xC0, 0xC0))
                set_shading(cell, 'FFFFFF')
    # 每格补 tcW（必须在 shd 之前，否则 Word 丢底色）
    grid_w = [int(round((arrow_w if ci % 2 else step_w) * scale * 567))
              for ci in range(ncol)]
    for rw in t.rows:
        for ci, cell in enumerate(rw.cells):
            if ci >= len(grid_w):
                continue
            tcPr = cell._tc.get_or_add_tcPr()
            for e in tcPr.findall(qn('w:tcW')):
                tcPr.remove(e)
            tcw = OxmlElement('w:tcW')
            tcw.set(qn('w:w'), str(grid_w[ci]))
            tcw.set(qn('w:type'), 'dxa')
            tcPr.insert(0, tcw)
    # 流程图整块不跨页断开
    for rw in t.rows:
        set_cant_split(rw)
    # 流程图上下留白
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.0
    for r in p.runs:
        set_run_font(r, CN, 4)
    p.add_run('').font.size = Pt(4)


def convert(md_text, doc, h_offset=0):
    lines = md_text.split('\n')
    i = 0
    n = len(lines)
    while i < n:
        ln = lines[i]
        s = ln.strip()

        # 流程图块 :::flow 标题 / 步骤 → 步骤 / :::
        if s.startswith(':::flow'):
            title = s[len(':::flow'):].strip()
            i += 1
            chains = []
            while i < n and not lines[i].strip().startswith(':::'):
                cl = lines[i].strip()
                if cl:
                    parts = [x.strip() for x in re.split(r'→|->|⇒', cl) if x.strip()]
                    if parts:
                        chains.append(parts)
                i += 1
            i += 1
            if chains:
                add_flow(doc, title, chains)
            continue

        # 代码块
        if s.startswith('```'):
            i += 1
            buf = []
            while i < n and not lines[i].strip().startswith('```'):
                buf.append(lines[i]); i += 1
            i += 1
            p = doc.add_paragraph()
            pf = p.paragraph_format
            pf.left_indent = Cm(0.4); pf.space_before = Pt(1); pf.space_after = Pt(2)
            pf.line_spacing = 1.0
            r = p.add_run('\n'.join(buf))
            set_run_font(r, MONO, CODE_SIZE)
            pPr = p._p.get_or_add_pPr()
            shd = OxmlElement('w:shd')
            shd.set(qn('w:val'), 'clear'); shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), 'F5F5F5')
            pPr.append(shd)
            continue

        # 表格
        if s.startswith('|') and i + 1 < n and lines[i + 1].strip().startswith('|'):
            buf = []
            while i < n and lines[i].strip().startswith('|'):
                buf.append(lines[i]); i += 1
            rows = parse_table(buf)
            if not rows:
                continue
            ncol = max(len(r) for r in rows)
            # ⚠️ 2026-11-25：**两列表改成流水句**（`键：值`）—— 两列表承载的都是
            #    「某个属性 = 某个取值」，不是需要横向对照的矩阵。Word 里给每个
            #    键值对套一层表格边框 + 单元格内边距，白白吃掉几十页。
            #    三列及以上（真正的对照矩阵）保留表格。
            # ⚠️ 4/5 列表：第一列是短标签时也转流水句（表头写成一行说明）
            if ncol in (4, 5) and FLOW_NCOL:
                labels_short = all(
                    len((r[0] if r else '').strip().strip('*')) <= 14
                    for r in rows[1:] if r and r[0].strip())
                if labels_short:
                    hdr = [c.strip() for c in rows[0]]
                    hp = doc.add_paragraph()
                    hpf = hp.paragraph_format
                    hpf.space_before = Pt(0.3); hpf.space_after = Pt(0.3)
                    hpf.line_spacing = LINE_TBL
                    add_inline(hp, ' · '.join(x for x in hdr if x),
                               base_size=TABLE_SIZE, color=(0x88, 0x88, 0x88))
                    for cells in rows[1:]:
                        k = cells[0].strip() if len(cells) > 0 else ''
                        rest = [c.strip() for c in cells[1:] if c.strip()]
                        if not k and not rest:
                            continue
                        p = doc.add_paragraph()
                        pf = p.paragraph_format
                        pf.space_before = Pt(0); pf.space_after = Pt(0.3)
                        pf.line_spacing = LINE_TBL
                        pf.left_indent = Cm(0.5)
                        pf.first_line_indent = Cm(-0.5)
                        if k:
                            add_inline(p, '**%s**' % k.strip('*'),
                                       base_size=BODY_SIZE, color=(0xA8, 0x5A, 0x18))
                            add_inline(p, '：', base_size=BODY_SIZE)
                        add_inline(p, ' ｜ '.join(rest), base_size=BODY_SIZE)
                    continue
            # ⚠️ 三列表：若第一列是短标签（≤14 字），也写成流水句
            #    「标签：值1 ｜ 值2」—— 省掉表格框 / 单元格边距 / 行高开销。
            #    真正的对照矩阵（第一列不短、或 ≥4 列）保留网格表。
            if ncol == 3 and FLOW_3COL:
                labels_short = all(
                    len((r[0] if r else '').strip().strip('*')) <= 14
                    for r in rows[1:] if r and r[0].strip())
                if labels_short:
                    for cells in rows[1:]:
                        k = cells[0].strip() if len(cells) > 0 else ''
                        rest = [c.strip() for c in cells[1:] if c.strip()]
                        if not k and not rest:
                            continue
                        p = doc.add_paragraph()
                        pf = p.paragraph_format
                        pf.space_before = Pt(0); pf.space_after = Pt(0.3)
                        pf.line_spacing = LINE_TBL
                        pf.left_indent = Cm(0.5)
                        pf.first_line_indent = Cm(-0.5)
                        if k:
                            add_inline(p, '**%s**' % k.strip('*'),
                                       base_size=BODY_SIZE, color=(0xA8, 0x5A, 0x18))
                            add_inline(p, '：', base_size=BODY_SIZE)
                        add_inline(p, ' ｜ '.join(rest), base_size=BODY_SIZE)
                    continue
            if ncol == 2 and FLOW_2COL:
                for cells in rows[1:]:
                    k = cells[0].strip() if len(cells) > 0 else ''
                    v = cells[1].strip() if len(cells) > 1 else ''
                    if not k and not v:
                        continue
                    # 键太长时不走「键 / 值」两列布局 —— 悬挂缩进装不下，
                    # 值会被推到很远。改成行内「**键**：值」。
                    klen = len(k.strip('*'))
                    p = doc.add_paragraph()
                    pf = p.paragraph_format
                    pf.space_before = Pt(0.2); pf.space_after = Pt(0.5)
                    pf.line_spacing = LINE_TBL
                    if klen <= 14:
                        pf.left_indent = Cm(1.9)
                        pf.first_line_indent = Cm(-1.9)   # 悬挂缩进：键与值分两列
                        if k:
                            add_inline(p, '**%s**' % k.strip('*'), base_size=BODY_SIZE,
                                       color=(0xA8, 0x5A, 0x18))
                        if v:
                            add_inline(p, v, base_size=BODY_SIZE)
                    else:
                        pf.left_indent = Cm(0)
                        if k:
                            add_inline(p, '**%s**：' % k.strip('*'), base_size=BODY_SIZE,
                                       color=(0xA8, 0x5A, 0x18))
                        if v:
                            add_inline(p, v, base_size=BODY_SIZE)
                continue
            # 表格前留一小段空白 —— 否则表格会紧贴上方正文，视觉上粘在一起
            sp = doc.add_paragraph()
            sp.paragraph_format.space_before = Pt(0)
            sp.paragraph_format.space_after = Pt(0)
            sp.paragraph_format.line_spacing = 1.0
            sp.add_run('').font.size = Pt(2)

            t = doc.add_table(rows=0, cols=ncol)
            t.style = 'Table Grid'
            t.alignment = WD_TABLE_ALIGNMENT.LEFT
            set_cell_margins(t)
            set_table_borders(t, 'D6D6D6')
            for ri, cells in enumerate(rows):
                row = t.add_row()
                # 斑马纹：偶数数据行浅底，交替行是长表格可读性的关键
                zebra = (ri % 2 == 0) and ri > 0
                for ci in range(ncol):
                    cell = row.cells[ci]
                    cell.text = ''
                    txt = cells[ci] if ci < len(cells) else ''
                    p = cell.paragraphs[0]
                    p.paragraph_format.space_before = Pt(0)
                    p.paragraph_format.space_after = Pt(0)
                    p.paragraph_format.line_spacing = LINE_TBL
                    bold = (ri == 0) or shade_by_bold(txt)
                    add_inline(p, txt, base_size=TABLE_SIZE, base_bold=bold)
                    if ri == 0:
                        set_shading(cell, 'E4DCCB')     # 表头：深一档的暖灰
                    elif zebra:
                        set_shading(cell, 'F7F5F1')     # 斑马纹：极浅暖灰
            set_col_widths(t, rows, ncol, CONTENT_CM)
            set_repeat_header(t.rows[0])
            for rw in t.rows:
                set_cant_split(rw)
            # 表格后留一小段空白 —— 表格与下方正文之间要有呼吸
            sp2 = doc.add_paragraph()
            sp2.paragraph_format.space_before = Pt(0)
            sp2.paragraph_format.space_after = Pt(0)
            sp2.paragraph_format.line_spacing = 1.0
            sp2.add_run('').font.size = Pt(2)
            continue

        # 分隔线
        if re.fullmatch(r'-{3,}', s):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(1); p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.0
            pPr = p._p.get_or_add_pPr()
            pbdr = OxmlElement('w:pBdr')
            bot = OxmlElement('w:bottom')
            bot.set(qn('w:val'), 'single'); bot.set(qn('w:sz'), '6')
            bot.set(qn('w:space'), '1'); bot.set(qn('w:color'), 'C8C8C8')
            pbdr.append(bot); pPr.append(pbdr)
            i += 1
            continue

        # 标题
        m = re.match(r'^(#{1,6})\s+(.*)$', s)
        if m:
            lvl = len(m.group(1)) + h_offset
            txt = m.group(2).strip()
            if txt == '---':
                i += 1; continue
            p = doc.add_heading(level=min(lvl, 9))
            # 层级字号差距拉大 —— 长文档靠字号就能扫出结构
            add_inline(p, txt, base_size={1: 17, 2: 14, 3: 11.5, 4: 10.5}.get(lvl, BODY_SIZE),
                       base_bold=True,
                       color={1: (0xC0, 0x50, 0x00), 2: (0x1A, 0x1A, 0x1A),
                              3: (0x33, 0x33, 0x33), 4: (0x55, 0x55, 0x55)}.get(lvl, (0x1A, 0x1A, 0x1A)))
            p.paragraph_format.space_before = Pt(3.5 if lvl <= 2 else 1)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.0
            p.paragraph_format.keep_with_next = True     # 标题不与正文分页
            # h1 / h2 加底部横线 —— 扫读时靠这条线分段
            if lvl <= 2:
                pPr = p._p.get_or_add_pPr()
                pbdr = OxmlElement('w:pBdr')
                bot = OxmlElement('w:bottom')
                bot.set(qn('w:val'), 'single')
                bot.set(qn('w:sz'), '12' if lvl == 1 else '6')
                bot.set(qn('w:space'), '2')
                bot.set(qn('w:color'), 'E8A050' if lvl == 1 else 'E0D8CC')
                pbdr.append(bot); pPr.append(pbdr)
            i += 1
            continue

        # 引用块
        if s.startswith('>'):
            buf = []
            while i < n and lines[i].strip().startswith('>'):
                buf.append(re.sub(r'^\s*>\s?', '', lines[i]))
                i += 1
            # ⚠️ 2026-11-25：把引用块的多行合并成**一个**段落。
            #    原来每行都是独立带左边框的段落 —— 一段 4 行的引用在 Word 里
            #    变成 4 段（4 根左边框、4 份段间距），非常吃页。
            #    同一引用块内如果有「说白了」段落，只保留一个左边框 + 橙色。
            text = ' '.join(x.strip() for x in buf if x.strip())
            if not text:
                continue
            is_note = text.lstrip('*').startswith('说白了')
            p = doc.add_paragraph()
            pf = p.paragraph_format
            pf.left_indent = Cm(0.3); pf.space_before = Pt(0.2); pf.space_after = Pt(0.3)
            pf.line_spacing = LINE_QUOTE
            add_inline(p, text, base_size=QUOTE_SIZE,
                       color=(0x44, 0x44, 0x44) if not is_note else (0x8A, 0x4B, 0x10))
            pPr = p._p.get_or_add_pPr()
            pbdr = OxmlElement('w:pBdr')
            left = OxmlElement('w:left')
            left.set(qn('w:val'), 'single'); left.set(qn('w:sz'), '12')
            left.set(qn('w:space'), '4'); left.set(qn('w:color'), 'E0A050')
            pbdr.append(left); pPr.append(pbdr)
            continue

        # 列表
        m = re.match(r'^(\s*)([-*+]|\d+\.)\s+(.*)$', ln)
        if m:
            indent = len(m.group(1)) // 2
            ordered = m.group(2)[0].isdigit()
            text = m.group(3)
            p = doc.add_paragraph(style='List Number' if ordered else 'List Bullet')
            pf = p.paragraph_format
            pf.left_indent = Cm(0.6 + indent * 0.5)
            pf.space_before = Pt(0); pf.space_after = Pt(0)
            pf.line_spacing = LINE_LIST
            add_inline(p, text, base_size=BODY_SIZE)
            i += 1
            continue

        # 空行
        if not s:
            i += 1
            continue

        # 普通段落
        # ⚠️ 2026-11-25：把 md 里被换行拆开的「续行」合并成**一个** Word 段落。
        #    原来每个非空行都各成一个段落 → 一段 3 行的正文在 Word 里变成 3 个段落，
        #    段前段后间距 ×3，白白吃掉不少页。合并后语义完全一样（中文段内不断句）。
        # ⚠️ 死循环防护：下面这个 while 会因为 `t.startswith('|')` 而 break，
        #    若当前行本身以 `|` 开头（孤立管道行 / 无分隔行的表头），
        #    break 后 `i` 不推进 → 主循环原地打转。
        #    所以先处理「以 `|` 开头的行」：要么并进表格，要么当普通文本输出。
        if s.startswith('|'):
            # 孤立管道行（后面不是 `|`）：按普通段落处理并推进
            p = doc.add_paragraph()
            pf = p.paragraph_format
            pf.space_before = Pt(0.2); pf.space_after = Pt(0.3)
            pf.line_spacing = LINE
            add_inline(p, s, base_size=BODY_SIZE)
            i += 1
            continue
        buf = []
        while i < n:
            t = lines[i].strip()
            if not t or t.startswith('#') or t.startswith('|') or t.startswith('>') \
                    or t.startswith('```') or t.startswith(':::') \
                    or re.match(r'^([-*+]|\d+\.)\s', t):
                break
            buf.append(t)
            i += 1
        p = doc.add_paragraph()
        pf = p.paragraph_format
        pf.space_before = Pt(0.2); pf.space_after = Pt(0.3)
        pf.line_spacing = LINE
        add_inline(p, ' '.join(buf), base_size=BODY_SIZE)

def add_toc(doc, title='目录', levels='1-3'):
    """插入 Word 自动目录（TOC 域）。

    Word 打开时会提示更新域；更新后目录带页码、可 Ctrl+点击跳转。
    """
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_before = Pt(0); pf.space_after = Pt(4)
    pf.line_spacing = 1.0
    r = p.add_run(title)
    set_run_font(r, CN, 15, True, (0x1A, 0x1A, 0x1A))
    p.paragraph_format.page_break_after = True

    # TOC 域
    par = doc.add_paragraph()
    par.paragraph_format.space_before = Pt(0)
    par.paragraph_format.space_after = Pt(0)

    def mkrun():
        r = OxmlElement('w:r')
        rpr = OxmlElement('w:rPr')
        rf = OxmlElement('w:rFonts')
        rf.set(qn('w:ascii'), CN); rf.set(qn('w:hAnsi'), CN); rf.set(qn('w:eastAsia'), CN)
        rpr.append(rf)
        r.append(rpr)
        return r

    r1 = mkrun(); fc = OxmlElement('w:fldChar')
    fc.set(qn('w:fldCharType'), 'begin'); fc.set(qn('w:dirty'), 'true'); r1.append(fc)
    r2 = mkrun(); it = OxmlElement('w:instrText')
    it.set(qn('xml:space'), 'preserve')
    it.text = ' TOC \\o "%s" \\h \\z \\u ' % levels
    r2.append(it)
    r3 = mkrun(); fc2 = OxmlElement('w:fldChar'); fc2.set(qn('w:fldCharType'), 'separate'); r3.append(fc2)
    r4 = mkrun(); t4 = OxmlElement('w:t')
    t4.text = '（在 Word 中按 Ctrl+A 然后 F9，或右键「更新域」生成目录）'
    r4.append(t4)
    r5 = mkrun(); fc3 = OxmlElement('w:fldChar'); fc3.set(qn('w:fldCharType'), 'end'); r5.append(fc3)
    for r in (r1, r2, r3, r4, r5):
        par._p.append(r)

    # 目录之后强制分页 —— 否则目录和正文第一页挤在一起
    brk = doc.add_paragraph()
    brk.paragraph_format.space_before = Pt(0)
    brk.paragraph_format.space_after = Pt(0)
    brk.paragraph_format.line_spacing = 1.0
    brk.paragraph_format.page_break_before = True
    brk.add_run('').font.size = Pt(2)
    return par


def setup(doc):
    st = doc.styles['Normal']
    st.font.name = CN
    st.font.size = Pt(BODY_SIZE)
    st.element.rPr.rFonts.set(qn('w:eastAsia'), CN)
    st.paragraph_format.space_after = Pt(1)
    st.paragraph_format.line_spacing = LINE
    for s in doc.sections:
        s.left_margin = Cm(MARGIN_CM); s.right_margin = Cm(MARGIN_CM)
        s.top_margin = Cm(MARGIN_CM); s.bottom_margin = Cm(MARGIN_CM)

def _field(par, instr, size_half_pt=16):
    """插入正规 Word 域（fldChar 方式），避免 fldSimple 缓存值重复渲染"""
    def mkrun():
        r = OxmlElement('w:r')
        rpr = OxmlElement('w:rPr')
        rf = OxmlElement('w:rFonts')
        rf.set(qn('w:ascii'), CN); rf.set(qn('w:hAnsi'), CN); rf.set(qn('w:eastAsia'), CN)
        rpr.append(rf)
        sz = OxmlElement('w:sz'); sz.set(qn('w:val'), str(size_half_pt)); rpr.append(sz)
        col = OxmlElement('w:color'); col.set(qn('w:val'), '888888'); rpr.append(col)
        r.append(rpr)
        return r
    r1 = mkrun(); fc = OxmlElement('w:fldChar'); fc.set(qn('w:fldCharType'), 'begin'); r1.append(fc)
    r2 = mkrun(); it = OxmlElement('w:instrText'); it.set(qn('xml:space'), 'preserve'); it.text = ' %s ' % instr; r2.append(it)
    r3 = mkrun(); fc2 = OxmlElement('w:fldChar'); fc2.set(qn('w:fldCharType'), 'separate'); r3.append(fc2)
    r4 = mkrun(); t = OxmlElement('w:t'); t.text = '1'; r4.append(t)
    r5 = mkrun(); fc3 = OxmlElement('w:fldChar'); fc3.set(qn('w:fldCharType'), 'end'); r5.append(fc3)
    for r in (r1, r2, r3, r4, r5):
        par._p.append(r)

def add_footer_pagenum(doc):
    """每个节加「第 X 页 / 共 Y 页」页脚"""
    for section in doc.sections:
        footer = section.footer
        p = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
        p.text = ''
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run('第 '); set_run_font(r, CN, 8, color=(0x88, 0x88, 0x88))
        _field(p, 'PAGE')
        r2 = p.add_run(' 页 / 共 '); set_run_font(r2, CN, 8, color=(0x88, 0x88, 0x88))
        _field(p, 'NUMPAGES')
        r3 = p.add_run(' 页'); set_run_font(r3, CN, 8, color=(0x88, 0x88, 0x88))

if __name__ == '__main__':
    out = sys.argv[1]
    # scope：
    #   spec   = 只有 R + A  （亏了-规则文件.docx）
    #   design = 只有 D     （亏了-设计解释.docx）
    #   layout = 只有 L     （亏了-页面与交互规格.docx）
    #   all    = R + D + L  （亏了-需求规格与设计说明.docx 合订本）
    scope = sys.argv[2] if len(sys.argv) > 2 else 'all'
    base = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
    doc = Document()
    setup(doc)

    def read(p):
        return io.open(p, encoding='utf-8').read()

    if scope in ('all', 'spec'):
        add_toc(doc)
        convert(read(os.path.join(base, '文档', '需求规格.md')), doc, h_offset=0)

    if scope in ('all', 'design'):
        if scope == 'all':
            doc.add_page_break()
        else:
            add_toc(doc)
        convert(read(os.path.join(base, '文档', '设计说明.md')), doc, h_offset=0)

    if scope in ('all', 'layout'):
        if scope == 'all':
            doc.add_page_break()
        else:
            add_toc(doc)
        convert(read(os.path.join(base, '文档', '页面布局与交互规格.md')), doc, h_offset=0)

    add_footer_pagenum(doc)
    doc.save(out)
    print('saved %s (scope: %s)' % (out, scope))
