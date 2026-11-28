# -*- coding: utf-8 -*-
"""把 PDF 渲染成 PNG，用于目视检查排版。

用法：python 工具/_pdf2png.py 工具/_preview/xxx.pdf 页码 [页码...]
"""
import os
import sys

import pymupdf

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, '_preview')

pdf = sys.argv[1]
pages = [int(x) for x in sys.argv[2:]] or [1]

doc = pymupdf.open(pdf)
stem = os.path.splitext(os.path.basename(pdf))[0]
for pg in pages:
    if pg < 1 or pg > doc.page_count:
        continue
    page = doc[pg - 1]
    pix = page.get_pixmap(dpi=110)
    p = os.path.join(OUT, '%s_p%d.png' % (stem, pg))
    pix.save(p)
    print(p)
