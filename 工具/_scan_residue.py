# -*- coding: utf-8 -*-
"""九项删除任务的残留扫描器。

用法：python 工具/_scan_residue.py
输出：每个命中文件的行号 + 内容，方便逐条清理。
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (任务号, 标签, 正则, 需要跳过的文件)
SCAN = [
    ('①', '首次认证', r'首次拍照|首次验证|人脸验证|人脸核验|身份核验|活体|基准脸|首次物证', []),
    ('②', '视频认证', r'视频|补交视频|自证视频|challenge', []),
    ('③', 'L1自动采集', r'自动采集|自动同步|步数|屏幕使用时长|微信运动', []),
    ('④', 'L2参照物', r'参照物|标尺|三要素|双照片|露脸', []),
    ('⑤', '哈希校验', r'哈希|hash|Hash|pHash|sha256|SHA-256|SHA256|感知哈希|查重|唯一索引', []),
    ('⑥', 'L3挑战', r'随机挑战|挑战视频|随机指令', []),
    ('⑦', '体重回升', r'回升|反弹|回弹|增重|掉秤', []),
    ('⑧', 'V1-V4等级', r'V1|V2|V3|V4|见习|进阶|资深|首席', []),
    ('⑨', '健康底线三项', r'准入门槛|过量减重|触底|安全下限|减重上限|取消资格|目标体重下限', []),
]

SKIP_DIRS = {'node_modules', '.git', '交付物', '__pycache__'}
SKIP_FILE = {
    '想法演进.md',          # 决策历史，允许保留
    '对标-DietBet产品图鉴.md',  # 竞品拆解，讲的是别人家的产品
    'README.md',            # 变更日志，已单独人工核对
}
SCAN_EXT = ('.md', '.js', '.html', '.json')

def iter_files():
    for dp, dns, fns in os.walk(ROOT):
        dns[:] = [d for d in dns if d not in SKIP_DIRS]
        for fn in fns:
            if not fn.endswith(SCAN_EXT):
                continue
            if fn in SKIP_FILE:
                continue
            yield os.path.join(dp, fn)

def main():
    files = sorted(iter_files())
    total = 0
    for task, label, pat, extra in SCAN:
        rx = re.compile(pat)
        hits = []
        for f in files:
            rel = os.path.relpath(f, ROOT)
            try:
                s = io.open(f, encoding='utf-8').read()
            except Exception:
                continue
            for i, line in enumerate(s.split('\n'), 1):
                if rx.search(line):
                    hits.append((rel, i, line.strip()))
        total += len(hits)
        print('=' * 70)
        print('【%s %s】 命中 %d 处' % (task, label, len(hits)))
        for rel, i, line in hits:
            short = line if len(line) <= 150 else line[:150] + '…'
            print('  %s:%d: %s' % (rel, i, short))
    print('=' * 70)
    print('合计命中 %d 处' % total)

if __name__ == '__main__':
    main()
