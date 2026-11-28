# -*- coding: utf-8 -*-
"""给 demo/DEMO.html 的静态资源引用打新版本号（缓存穿透）。

改了 js/css 之后必须跑这个 —— 否则浏览器会用旧缓存，页面看起来「没生效」。
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(ROOT, 'demo', 'DEMO.html')
s = io.open(p, encoding='utf-8').read()

# 新版本号 = 现有最大号 + 1
vers = [int(v) for v in re.findall(r'\?v=(\d+)', s)]
newv = max(vers) + 1 if vers else 1

# 只给 js/css 资源打新号（?v= 只出现在这两类引用上）
s2, n = re.subn(r'(\?(?:js|css)/[^\'"]*?)\?v=\d+', r'\1?v=%d' % newv, s)
s2, n2 = re.subn(r'(\?v=)\d+', r'\g<1>%d' % newv, s2)

with io.open(p, 'w', encoding='utf-8', newline='') as f:
    f.write(s2)
print('OK DEMO.html  版本号 %d → %d （%d 处）' % (max(vers) if vers else 0, newv, n + n2))
