# -*- coding: utf-8 -*-
"""快速量页数 —— 用 Word COM 打开 docx 数页数。

用法：python 工具/_pagecount.py 交付物/亏了-规则文件.docx [更多文件...]
"""
import os, sys
import time
import win32com.client as win32

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, '..'))

app = None
try:
    app = win32.DispatchEx('Word.Application')
    app.Visible = False
    app.DisplayAlerts = False
except Exception as e:
    print('无法启动 Word COM：%s' % e)
    print('提示：先关掉已打开的 Word/WPS 文档，再重试。')
    sys.exit(2)

try:
    for f in sys.argv[1:]:
        p = f if os.path.isabs(f) else os.path.join(ROOT, f)
        doc = None
        for attempt in range(3):
            try:
                doc = app.Documents.Open(p, ReadOnly=True, AddToRecentFiles=False)
                doc.Repaginate()
                pages = doc.ComputeStatistics(2)
                words = doc.ComputeStatistics(0)
                print('%-46s %4d 页   %7d 字' % (os.path.basename(f), pages, words))
                doc.Close(False)
                doc = None
                break
            except Exception as e:
                if attempt == 2:
                    print('%-46s 读取失败：%s' % (os.path.basename(f), e))
                else:
                    time.sleep(2)
            finally:
                if doc is not None:
                    try:
                        doc.Close(False)
                    except Exception:
                        pass
                    doc = None
        time.sleep(1)
finally:
    try:
        app.Quit()
    except Exception:
        pass
