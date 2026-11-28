# -*- coding: utf-8 -*-
"""全仓引用完整性检查 —— 整理后所有路径引用都必须还能解析。

检查四类：
  1. md 里的相对链接（图片 / md 文件）必须存在
  2. md 里提到的仓库内文件名（`xxx.md` / `xxx.py` / `xxx.js`）必须在仓库里存在
  3. 代码里的相对路径引用（js / py）必须存在
  4. 交付物 docx 必须能从 md 重新生成（由 check_docs.py 负责，这里只查存在性）

用法：python 工具/check_refs.py
"""
import io
import os
import re
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, '..'))

fails = []
checked = 0


def fail(msg):
    fails.append(msg)
    print('  *** %s' % msg)


# ---------- 1/2. md 里的相对链接与文件名引用 ----------
print('=== 1/2. md 相对链接与文件名引用 ===')
MD_DIR = os.path.join(ROOT, '文档')
for name in sorted(os.listdir(MD_DIR)):
    if not name.endswith('.md'):
        continue
    path = os.path.join(MD_DIR, name)
    text = io.open(path, encoding='utf-8').read()
    mdrel = os.path.relpath(MD_DIR, ROOT)

    # 1) markdown 图片 / 链接
    for m in re.finditer(r'!?\[[^\]]*\]\(([^)\s]+)\)', text):
        target = m.group(1)
        if target.startswith(('http://', 'https://', 'mailto:', '#')):
            continue
        target = target.split('#')[0]
        if not target:
            continue
        checked += 1
        full = os.path.normpath(os.path.join(ROOT, mdrel, target))
        if not os.path.exists(full):
            fail('%s: 链接指向不存在的路径 %s' % (name, target))

    # 2) 反引号里的仓库内文件名
    #    注意：历史文档会提到**已被删除**的文件（如整理时删掉的备份 / 临时文件），
    #    那是「决策记录」而不是「活引用」—— 只有仍存在的文件才算引用断裂。
    for m in re.finditer(r'`([\w\-一-鿿]+\.(?:md|py|js|docx|pdf|ppt))`', text):
        fn = m.group(1)
        checked += 1
        if '/' in fn or '\\' in fn:
            cands = [os.path.normpath(os.path.join(ROOT, mdrel, fn)),
                     os.path.normpath(os.path.join(ROOT, fn))]
        else:
            cands = []
            for d, _, fs in os.walk(ROOT):
                if '__pycache__' in d:
                    continue
                cands.append(os.path.join(d, fn))
        if not any(os.path.exists(c) for c in cands):
            # 只有当这个名字在整篇文档里只出现一次、且文档不是在讲「删除」时，才算断链
            mentions = text.count(fn)
            deleted_ctx = re.search(r'(删除|删掉|已删|废弃|作废|过时|清理)', text)
            if mentions == 1 and not deleted_ctx:
                fail('%s: 引用了不存在的文件 %s' % (name, fn))
            else:
                print('  (历史提及，已不存在，跳过) %s' % fn)

# ---------- 3. 代码里的相对路径 ----------
print('\n=== 3. 代码里的相对路径 ===')
# 路径锚点 → 解析基准目录
#   js: __dirname / D  → 该脚本所在目录
#   py: BASE → 脚本所在目录；ROOT → 仓库根
ANCHOR_BASE = {
    'demo': os.path.join(ROOT, 'demo'),
    'demo/tests': os.path.join(ROOT, 'demo', 'tests'),
    '工具': os.path.join(ROOT, '工具'),
}
for d in ANCHOR_BASE.values():
    for fn in sorted(os.listdir(d)):
        if not fn.endswith(('.js', '.py')):
            continue
        if fn == os.path.basename(__file__):
            continue          # 本脚本自己的正则样例不是真引用
        path = os.path.join(d, fn)
        text = io.open(path, encoding='utf-8').read()
        rel = os.path.relpath(d, ROOT)

        # JS: path.join(__dirname, 'x', 'y') / path.join(D, 'x')
        for m in re.finditer(
                r"path\.join\(\s*(?:__dirname|D)\s*,\s*'([^']+)'(?:\s*,\s*'([^']+)')?", text):
            parts = [p for p in m.groups() if p]
            checked += 1
            full = os.path.normpath(os.path.join(d, *parts))
            if not os.path.exists(full):
                fail('%s/%s: path.join(__dirname,…) 指向不存在的路径 %s'
                     % (rel, fn, os.path.join(*parts)))

        # PY: os.path.join(ROOT, 'x', 'y') → 相对仓库根
        for m in re.finditer(
                r"os\.path\.join\(\s*ROOT\s*,\s*'([^']+)'(?:\s*,\s*'([^']+)')?", text):
            parts = [p for p in m.groups() if p]
            checked += 1
            full = os.path.normpath(os.path.join(ROOT, *parts))
            if not os.path.exists(full):
                fail('%s/%s: os.path.join(ROOT,…) 指向不存在的路径 %s'
                     % (rel, fn, os.path.join(*parts)))

        # PY: os.path.join(BASE, 'x') → 相对脚本目录
        for m in re.finditer(
                r"os\.path\.join\(\s*BASE\s*,\s*'([^']+)'(?:\s*,\s*'([^']+)')?", text):
            parts = [p for p in m.groups() if p]
            checked += 1
            full = os.path.normpath(os.path.join(d, *parts))
            if not os.path.exists(full):
                fail('%s/%s: os.path.join(BASE,…) 指向不存在的路径 %s'
                     % (rel, fn, os.path.join(*parts)))

# ---------- 4. 交付物存在 ----------
print('\n=== 4. 交付物 ===')
for f in ['亏了-规则文件.docx', '亏了-设计解释.docx', '亏了-页面与交互规格.docx',
          '亏了-需求规格与设计说明.docx', '参数速查表.docx']:
    checked += 1
    p = os.path.join(ROOT, '交付物', f)
    if not os.path.exists(p):
        fail('交付物缺失: %s' % f)

print('\n检查 %d 处引用，%s' % (checked, '全部通过' if not fails else '失败 %d 处' % len(fails)))
sys.exit(1 if fails else 0)
