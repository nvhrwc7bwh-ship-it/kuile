# -*- coding: utf-8 -*-
"""生成 参数速查表.docx —— 双栏紧凑排版（内容不变）。

排版结构：
  - ## 大节标题：跨整页宽（单栏区段）
  - ### 小节标题 + 表格：在双栏区内连续流动，填满左右两栏
  - 自然宽度超过栏宽的宽表：自动切到单栏区段，整页宽显示
  - 表格在栏内按内容比例分配宽度，整体居中

用法：
  python build_param_tables.py            # 默认（## 跨栏，### 栏内）
  python build_param_tables.py allspan    # 所有标题跨栏（对比用）
"""
import io
import os
import re
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, '..'))
sys.path.insert(0, BASE)

from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_ORIENT, WD_SECTION
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

CN = '微软雅黑'

# ---------- 版面参数 ----------
P = {
    'margin_l': Cm(1.6), 'margin_r': Cm(1.6),
    'margin_t': Cm(1.4), 'margin_b': Cm(1.2),
    'page_w': Cm(21.0), 'page_h': Cm(29.7),
    'col_space': Cm(0.55),          # 栏间距（单栏模式不用）

    'h1_size': 14, 'h2_size': 11.5, 'h3_size': 9.5,
    'h1_before': 0, 'h1_after': 5,
    'h2_before': 10, 'h2_after': 4,
    'h3_before': 7, 'h3_after': 1.5,   # 小节标题（标题行内）

    'cell_size': 8.5,
    'cell_line': 11.5,
    'cell_pad_tb': 1.4,
    'cell_pad_lr': 2.2,
    'table_gap': 8.0,              # 表与表之间的间距
    'header_fill': 'E8E4DC',
    'heading_fill': 'DED7C8',      # ### 标题行底纹（比表头更深，形成层次）
    'min_col_cm': 1.35,             # 单列最小宽度
}
FULL_W = 21.0 - 1.6 * 2            # 整页可用宽 = 17.8 cm
COL_W = FULL_W                     # 单栏模式：栏宽 = 整页宽
# ------------------------------


# ================= 字体 / 基础 =================
def set_run_font(run, name=CN, size=None, bold=None, color=None):
    run.font.name = name
    run._element.rPr.rFonts.set(qn('w:eastAsia'), name)
    if size:
        run.font.size = Pt(size)
    if bold is not None:
        run.font.bold = bold
    if color:
        run.font.color.rgb = RGBColor(*color)


def add_inline(par, text, base_size, base_bold=False, color=None):
    token = re.compile(r'(\*\*.+?\*\*|`[^`]+?`)')
    for part in token.split(text):
        if not part:
            continue
        if part.startswith('**') and part.endswith('**') and len(part) > 4:
            r = par.add_run(part[2:-2]); set_run_font(r, CN, base_size, True, color)
        elif part.startswith('`') and part.endswith('`') and len(part) > 2:
            r = par.add_run(part[1:-1]); set_run_font(r, CN, base_size, base_bold, color)
        else:
            r = par.add_run(part); set_run_font(r, CN, base_size, base_bold, color)


def set_shading(cell, hexcolor):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear'); shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), hexcolor)
    tcPr.append(shd)


def set_repeat_header(row):
    trPr = row._tr.get_or_add_trPr()
    el = OxmlElement('w:tblHeader'); el.set(qn('w:val'), 'true')
    trPr.append(el)


def set_row_cant_split(row):
    trPr = row._tr.get_or_add_trPr()
    el = OxmlElement('w:cantSplit'); el.set(qn('w:val'), 'true')
    trPr.append(el)


def set_cell_margins(table):
    tblPr = table._tbl.tblPr
    mar = OxmlElement('w:tblCellMar')
    for tag, val in (('top', P['cell_pad_tb']), ('bottom', P['cell_pad_tb']),
                     ('left', P['cell_pad_lr']), ('right', P['cell_pad_lr'])):
        el = OxmlElement('w:' + tag)
        el.set(qn('w:w'), str(int(val * 20)))
        el.set(qn('w:type'), 'dxa')
        mar.append(el)
    tblPr.append(mar)


def set_table_borders(table, color='BFBFBF', sz=4):
    tblPr = table._tbl.tblPr
    borders = OxmlElement('w:tblBorders')
    for tag in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        el = OxmlElement('w:' + tag)
        el.set(qn('w:val'), 'single'); el.set(qn('w:sz'), str(sz))
        el.set(qn('w:space'), '0'); el.set(qn('w:color'), color)
        borders.append(el)
    tblPr.append(borders)


# ================= 分栏 =================
_SECTPR_ORDER_AFTER_COLS = (
    'w:formProt', 'w:vAlign', 'w:noEndnote', 'w:titlePg', 'w:textDirection',
    'w:bidi', 'w:rtlGutter', 'w:docGrid', 'w:printerSettings', 'w:sectPrChange',
)


def set_cols(section, num):
    """设置节的分栏数"""
    sectPr = section._sectPr
    cols = sectPr.find(qn('w:cols'))
    if cols is None:
        cols = OxmlElement('w:cols')
        anchor = None
        for tag in _SECTPR_ORDER_AFTER_COLS:
            found = sectPr.find(qn(tag))
            if found is not None:
                anchor = found
                break
        if anchor is None:
            sectPr.append(cols)
        else:
            anchor.addprevious(cols)
    cols.set(qn('w:num'), str(num))
    cols.set(qn('w:space'), str(int(P['col_space'].twips)))
    cols.set(qn('w:equalWidth'), '1')


def shrink_break_paragraph(doc):
    """把分节符所在的空段落压到最小（1pt），避免大量空行"""
    ps = doc.paragraphs
    if not ps:
        return
    p = ps[-1]
    pf = p.paragraph_format
    pf.space_before = Pt(0); pf.space_after = Pt(0)
    pf.line_spacing = Pt(1)
    pPr = p._p.get_or_add_pPr()
    rPr = pPr.find(qn('w:rPr'))
    if rPr is None:
        rPr = OxmlElement('w:rPr')
        pPr.append(rPr)
    sz = OxmlElement('w:sz'); sz.set(qn('w:val'), '2')   # 1pt
    rPr.append(sz)


def switch_columns(doc, num):
    """切换到 num 栏（连续分节符）"""
    sec = doc.add_section(WD_SECTION.CONTINUOUS)
    sec.start_type = WD_SECTION.CONTINUOUS
    set_cols(sec, num)
    shrink_break_paragraph(doc)
    return sec


# ================= 宽度计算 =================
def text_width(s):
    w = 0.0
    for ch in s:
        w += 0.215 if ord(ch) > 0x2E80 else 0.115
    return w


def longest_unbreakable(s):
    segs = re.split(r'[，、；。/（）()：:｜|,!?！？]+', s)
    return max((text_width(x) for x in segs), default=0.0)


def natural_widths(rows):
    ncol = max(len(r) for r in rows)
    widths = []
    for ci in range(ncol):
        mx = 0.0
        for r in rows:
            txt = r[ci] if ci < len(r) else ''
            plain = re.sub(r'[*`]', '', txt)
            mx = max(mx, text_width(plain), longest_unbreakable(plain) + 0.2)
        widths.append(max(mx + 0.25, P['min_col_cm']))
    return widths


def fit_widths(natural, avail):
    """所有表格总宽统一 = avail；列宽按内容自然宽度的比例分配。

    这样每张表的总宽完全一致（视觉整齐），同时各列仍按内容长短合理分配，
    不会出现「某列被撑得很宽、另一列挤成一团」。
    """
    tot = sum(natural)
    if tot <= 0:
        return [avail / len(natural)] * len(natural)
    # 按比例缩放到 avail
    k = avail / tot
    widths = [w * k for w in natural]
    # 修正舍入误差，保证总和 == avail
    diff = avail - sum(widths)
    widths[-1] += diff
    return widths


def set_grid_span(cell, span):
    """把单元格设为横向合并 span 列（gridSpan）；实际宽度由 apply_widths 统一写入"""
    tcPr = cell._tc.get_or_add_tcPr()
    for old in tcPr.findall(qn('w:gridSpan')):
        tcPr.remove(old)
    gs = OxmlElement('w:gridSpan')
    gs.set(qn('w:val'), str(span))
    tcPr.append(gs)


def apply_widths(table, widths_cm):
    """widths_cm -> 整数 dxa 一次换算，保证 gridCol / tcW / tblW 完全一致"""
    table.autofit = False
    tblPr = table._tbl.tblPr
    el = OxmlElement('w:tblLayout'); el.set(qn('w:type'), 'fixed')
    tblPr.append(el)

    # 统一换算为整数 dxa，避免各处分���入误差
    dxa = [int(round(w * 567)) for w in widths_cm]
    total = sum(dxa)

    # 更新 tblGrid（Word 依此渲染列宽与合并宽度）
    tbl = table._tbl
    grid = tbl.find(qn('w:tblGrid'))
    if grid is not None:
        tbl.remove(grid)
    grid = OxmlElement('w:tblGrid')
    for v in dxa:
        gc = OxmlElement('w:gridCol')
        gc.set(qn('w:w'), str(v))
        grid.append(gc)
    tblPr.addnext(grid)

    for ci, v in enumerate(dxa):
        # 注意：不要用 table.columns[ci].width —— 它会用自己的舍入值重写 gridCol，
        # 导致 gridCol 之和与 tblW / tcW 差 1 dxa。直接写 XML。
        col = table._tbl.find(qn('w:tblGrid')).findall(qn('w:gridCol'))[ci]
        col.set(qn('w:w'), str(v))
    for row in table.rows:
        for ci, cell in enumerate(row.cells):
            tcPr = cell._tc.tcPr
            gs = tcPr.find(qn('w:gridSpan')) if tcPr is not None else None
            if gs is not None:
                span = int(gs.get(qn('w:val')))
                wv = sum(dxa[:span])
                if span == len(dxa):
                    wv = total      # 全跨度合并 = 整表宽
            elif ci < len(dxa):
                wv = dxa[ci]
            else:
                continue
            tcPr = cell._tc.get_or_add_tcPr()
            tcW = tcPr.find(qn('w:tcW'))
            if tcW is None:
                tcW = OxmlElement('w:tcW')
                tcPr.append(tcW)
            tcW.set(qn('w:w'), str(wv))
            tcW.set(qn('w:type'), 'dxa')
    for old in tblPr.findall(qn('w:tblW')):
        tblPr.remove(old)
    tw = OxmlElement('w:tblW')
    tw.set(qn('w:w'), str(total))
    tw.set(qn('w:type'), 'dxa')
    tblPr.append(tw)

    for old in tblPr.findall(qn('w:jc')):
        tblPr.remove(old)
    jc = OxmlElement('w:jc')
    jc.set(qn('w:val'), 'center')
    tblPr.append(jc)


# ================= 渲染 =================
def render_table(doc, rows, avail, heading=None, heading_level=3):
    """heading 不为空时，作为表格首行（合并全列）—— 色块宽度与表格精确对齐"""
    if not rows and not heading:
        return
    ncol = max(len(r) for r in rows) if rows else 1
    t = doc.add_table(rows=0, cols=ncol)
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t)
    set_cell_margins(t)

    # ---- 标题行（横向合并全列，底纹与表格等宽）----
    if heading:
        hrow = t.add_row()
        set_row_cant_split(hrow)
        # 删除多余单元格，只留一个并用 gridSpan 跨全部列
        for c in list(hrow.cells)[1:]:
            c._tc.getparent().remove(c._tc)
        hc = hrow.cells[0]
        set_grid_span(hc, ncol)
        hc.text = ''
        hp = hc.paragraphs[0]
        hp.style = doc.styles['Heading 3']
        hpf = hp.paragraph_format
        hpf.space_before = Pt(0); hpf.space_after = Pt(0)
        hpf.line_spacing = Pt(P['cell_line'] + 2.0)   # 标题行更宽松
        hpf.alignment = WD_ALIGN_PARAGRAPH.CENTER   # 标题居中
        add_inline(hp, heading, base_size=P['h3_size'], base_bold=True,
                   color=(0x1A, 0x1A, 0x1A))
        set_shading(hc, P['heading_fill'])

    # ---- 数据行 ----
    for ri, cells in enumerate(rows):
        row = t.add_row()
        set_row_cant_split(row)
        for ci in range(ncol):
            cell = row.cells[ci]
            cell.text = ''
            txt = cells[ci] if ci < len(cells) else ''
            p = cell.paragraphs[0]
            pf = p.paragraph_format
            pf.space_before = Pt(0); pf.space_after = Pt(0)
            pf.line_spacing = Pt(P['cell_line'])
            pf.alignment = WD_ALIGN_PARAGRAPH.CENTER   # 全部内容居中
            bold = (ri == 0) or txt.strip().startswith('**')
            add_inline(p, txt, base_size=P['cell_size'], base_bold=bold)
            if ri == 0:
                set_shading(cell, P['header_fill'])
    if rows:
        # 表头行 = 数据第一行（若有标题行则在其后）
        set_repeat_header(t.rows[1 if heading else 0])
    apply_widths(t, fit_widths(natural_widths(rows), avail))

    sp = doc.add_paragraph()
    sp.paragraph_format.space_before = Pt(0)
    sp.paragraph_format.space_after = Pt(0)
    sp.paragraph_format.line_spacing = Pt(P['table_gap'])
    for r in sp.runs:
        r.font.size = Pt(1)


def add_heading(doc, lvl, txt):
    """跨整页宽的大节标题（## 及以上）"""
    p = doc.add_heading(level=lvl)
    add_inline(p, txt, base_size=P.get('h%d_size' % lvl, 9),
               base_bold=True, color=(0x1A, 0x1A, 0x1A))
    pf = p.paragraph_format
    pf.space_before = Pt(P.get('h%d_before' % lvl, 3))
    pf.space_after = Pt(P.get('h%d_after' % lvl, 1.5))
    pf.line_spacing = 1.0
    pf.keep_with_next = True
    pf.alignment = WD_ALIGN_PARAGRAPH.CENTER   # 大节标题居中


# ================= 解析 =================
def parse_blocks(md_text):
    """返回 [('h', lvl, txt) | ('t', rows)]"""
    blocks = []
    lines = md_text.split('\n')
    i = 0
    n = len(lines)
    while i < n:
        s = lines[i].strip()
        if s.startswith('|') and i + 1 < n and lines[i + 1].strip().startswith('|'):
            buf = []
            while i < n and lines[i].strip().startswith('|'):
                buf.append(lines[i]); i += 1
            rows = []
            for ln in buf:
                cells = [c.strip() for c in ln.strip().strip('|').split('|')]
                if all(re.fullmatch(r':?-{2,}:?', c or '') for c in cells):
                    continue
                rows.append(cells)
            blocks.append(('t', rows))
            continue
        m = re.match(r'^(#{1,4})\s+(.*)$', s)
        if m:
            blocks.append(('h', len(m.group(1)), m.group(2).strip()))
        i += 1
    return blocks


def convert(md_text, doc, span_levels=(1, 2), wide_full=True, single_col=True):
    """single_col: 单栏模式（默认）—— 全部内容单栏，表格统一满页宽
    非 span 级别的标题（###）会作为其下方表格的标题行渲染，
    这样色块宽度 = 表格宽度，视觉精确对齐。
    """
    blocks = parse_blocks(md_text)
    cur_cols = 1
    pending_head = None   # 待并入下一张表的 ### 标题

    if single_col:
        # ---- 单栏模式 ----
        for blk in blocks:
            if blk[0] == 'h':
                lvl, txt = blk[1], blk[2]
                if lvl in span_levels:
                    add_heading(doc, lvl, txt)
                    pending_head = None
                else:
                    pending_head = txt
            else:
                render_table(doc, blk[1], FULL_W, heading=pending_head)
                pending_head = None
        return

    # ---- 双栏模式 ----
    i = 0
    while i < len(blocks):
        blk = blocks[i]
        if blk[0] == 'h':
            lvl, txt = blk[1], blk[2]
            if lvl in span_levels:
                # 跨整页宽的大节标题
                if cur_cols != 1:
                    switch_columns(doc, 1)
                    cur_cols = 1
                add_heading(doc, lvl, txt)
                pending_head = None
            else:
                # 栏内小节标题 —— 不单独输出，留给下一张表做标题行
                if cur_cols != 2:
                    switch_columns(doc, 2)
                    cur_cols = 2
                pending_head = txt
            i += 1
            continue

        # 表格
        rows = blk[1]
        nat = sum(natural_widths(rows))
        if wide_full and nat > COL_W:
            if cur_cols != 1:
                switch_columns(doc, 1)
                cur_cols = 1
            render_table(doc, rows, FULL_W, heading=pending_head)
        else:
            if cur_cols != 2:
                switch_columns(doc, 2)
                cur_cols = 2
            render_table(doc, rows, COL_W, heading=pending_head)
        pending_head = None
        i += 1


# ================= 文档设置 =================
def setup(doc):
    st = doc.styles['Normal']
    st.font.name = CN
    st.font.size = Pt(8)
    st.element.rPr.rFonts.set(qn('w:eastAsia'), CN)
    st.paragraph_format.space_after = Pt(0)
    st.paragraph_format.space_before = Pt(0)
    st.paragraph_format.line_spacing = 1.0

    s = doc.sections[0]
    s.page_width = P['page_w']; s.page_height = P['page_h']
    s.orientation = WD_ORIENT.PORTRAIT
    s.left_margin = P['margin_l']; s.right_margin = P['margin_r']
    s.top_margin = P['margin_t']; s.bottom_margin = P['margin_b']
    s.header_distance = Cm(0.6); s.footer_distance = Cm(0.5)
    set_cols(s, 1)


def _field(par, instr, size_half_pt=14):
    def mkrun():
        r = OxmlElement('w:r')
        rpr = OxmlElement('w:rPr')
        rf = OxmlElement('w:rFonts')
        rf.set(qn('w:ascii'), CN); rf.set(qn('w:hAnsi'), CN); rf.set(qn('w:eastAsia'), CN)
        rpr.append(rf)
        sz = OxmlElement('w:sz'); sz.set(qn('w:val'), str(size_half_pt)); rpr.append(sz)
        col = OxmlElement('w:color'); col.set(qn('w:val'), '999999'); rpr.append(col)
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
    """只写第一个节的页脚；后续节 clone 了同一 footerReference，指向同一个 part"""
    section = doc.sections[0]
    footer = section.footer
    p = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
    p.text = ''
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(0); p.paragraph_format.space_after = Pt(0)
    r = p.add_run('第 '); set_run_font(r, CN, 7, color=(0x99, 0x99, 0x99))
    _field(p, 'PAGE')
    r2 = p.add_run(' 页 / 共 '); set_run_font(r2, CN, 7, color=(0x99, 0x99, 0x99))
    _field(p, 'NUMPAGES')
    r3 = p.add_run(' 页'); set_run_font(r3, CN, 7, color=(0x99, 0x99, 0x99))


def build(span_levels=(1, 2), out_name='参数速查表.docx', wide_full=False,
          single_col=True):
    doc = Document()
    setup(doc)
    add_footer_pagenum(doc)
    with io.open(os.path.join(ROOT, '文档', '参数速查表.md'), encoding='utf-8') as f:
        convert(f.read(), doc, span_levels, wide_full, single_col)
    out = os.path.join(ROOT, '交付物', out_name)
    doc.save(out)
    print('saved:', out)
    print('tables:', len(doc.tables), ' sections:', len(doc.sections))
    return out


def page_count(path):
    import win32com.client as w
    app = w.Dispatch('Word.Application')
    app.Visible = False
    try:
        d = app.Documents.Open(os.path.abspath(path), ReadOnly=True)
        d.Repaginate()
        pages = d.ComputeStatistics(2)
        d.Close(False)
        return pages
    finally:
        app.Quit()


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'default'
    if mode == 'allspan':
        out = build(span_levels=(1, 2, 3), out_name='参数速查表_全跨栏.docx')
        print('pages:', page_count(out))
    elif mode == 'nowide':
        # 宽表也压进栏宽，不做单栏切换
        out = build(span_levels=(1, 2), out_name='参数速查表_无宽表跨栏.docx',
                    wide_full=False)
        print('pages:', page_count(out))
    elif mode == 'both':
        a = build(span_levels=(1, 2), out_name='参数速查表.docx', wide_full=True)
        b = build(span_levels=(1, 2), out_name='参数速查表_无宽表跨栏.docx',
                  wide_full=False)
        print('宽表跨栏     pages:', page_count(a))
        print('宽表也压栏宽 pages:', page_count(b))
    else:
        out = build()
        print('saved (页数统计需 Word COM，已跳过)')
