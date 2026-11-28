# -*- coding: utf-8 -*-
"""检查 L10 段落在 md 与 docx 里的结构是否一致。"""
import os
from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = Document(os.path.join(ROOT, '交付物', '亏了-页面与交互规格.docx'))
items = []
for child in list(d.element.body):
    if child.tag == qn('w:p'):
        items.append(('P', Paragraph(child, d)))
    elif child.tag == qn('w:tbl'):
        items.append(('T', Table(child, d)))

idx = None
for i, (k, o) in enumerate(items):
    if k == 'P' and 'L10' in o.text:
        idx = i
        break
print('L10 锚点 item', idx)
for k, o in items[idx:idx + 8]:
    if k == 'P':
        st = o.style.name
        print('  [段落 style=%-10s] %r' % (st, o.text[:90]))
    else:
        print('  [表格 %d行x%d列]' % (len(o.rows), len(o.columns)))
