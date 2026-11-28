# -*- coding: utf-8 -*-
"""把 docx 导出成 PDF（Word COM），用于目视检查排版。"""
import os
import sys

import win32com.client as win32

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, '..'))
OUT = os.path.join(ROOT, '交付物')
TMP = os.path.join(ROOT, '工具', '_preview')

if not os.path.exists(TMP):
    os.makedirs(TMP)

for name in sys.argv[1:]:
    src = os.path.join(OUT, name)
    if not src.endswith('.docx'):
        src = os.path.join(ROOT, src)
    dst = os.path.join(TMP, os.path.splitext(os.path.basename(src))[0] + '.pdf')
    d = win32.Dispatch('Word.Application')
    d.Visible = False
    doc = d.Documents.Open(src, ReadOnly=True)
    doc.ExportAsFixedFormat(dst, 17)   # 17 = wdExportFormatPDF
    pages = doc.ComputeStatistics(2)
    doc.Close(False)
    d.Quit()
    print('%s -> %s（%d 页）' % (os.path.basename(src), dst, pages))
