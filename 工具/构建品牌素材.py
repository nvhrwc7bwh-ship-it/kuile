# -*- coding: utf-8 -*-
"""品牌素材构建 / 校验（合并了原先 build_assets.py / build_assets_dog.py / verify_assets.py）

三个子命令：
  dog     从 assets/dog2.png 抠出柴犬头像 → assets/dog_new.png（登录页在用）
  mark    从 assets/dog2.png 提取两个品牌色块 → assets/mark.svg（IoU 0.977）
  verify  渲染 mark.svg 并与原图橙色区域算 IoU

用法（在 demo 目录下跑，因为素材路径是相对 demo 的）：
  python ../工具/构建品牌素材.py dog
  python ../工具/构建品牌素材.py mark
  python ../工具/构建品牌素材.py verify
"""
import os
import re
import sys

from PIL import Image
import numpy as np
import cv2

# 脚本在 工具/，素材在 demo/assets/ —— 一律按脚本位置算绝对路径
BASE = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.abspath(os.path.join(BASE, '..', 'demo'))
SRC = os.path.join(DEMO, 'assets', 'dog2.png')

DARK = None
LIGHT = None


def load():
    """载入原图并算出深橙 / 浅橙掩膜。"""
    global DARK, LIGHT
    im = Image.open(SRC).convert('RGB')
    A = np.array(im)
    r, g, b = A[:, :, 0].astype(int), A[:, :, 1].astype(int), A[:, :, 2].astype(int)
    DARK = (r > 185) & (g > 40) & (g < 145) & (b < 90)
    LIGHT = (r > 185) & (g > 125) & (g < 215) & (b > 65) & (b < 185)
    return im, A


# ────────────────────────────── 子命令：dog ──────────────────────────────
def cmd_dog():
    """精确抠出柴犬头像（白底黑线），边缘用灰阶羽化。"""
    im, _ = load()

    # 柴犬脸区域
    X0, X1, Y0, Y1 = 340, 560, 400, 600
    crop = im.crop((X0, Y0, X1, Y1)).convert('RGBA')
    ca = np.array(crop).astype(np.int16)
    hh, ww = ca.shape[:2]
    r, g, b = ca[:, :, 0], ca[:, :, 1], ca[:, :, 2]

    # alpha = 255 - 亮度（白→0, 黑→255）。加个 gamma 让边缘更自然
    lum = (r + g + b) / 3.0
    alpha = np.clip((250.0 - lum) * 4.2, 0, 255).astype(np.uint8)

    # 但纯白背景里也可能有极淡的线；用连通域保留柴犬主体
    solid = (alpha > 90).astype(np.uint8)
    solid = cv2.morphologyEx(solid, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(solid, 8)
    if n > 1:
        j = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        keep = lab == j
        # 保留与主体相连的细线条（耳朵尖等）
        solid2 = cv2.dilate(keep.astype(np.uint8), np.ones((5, 5), np.uint8))
        alpha = np.where(solid2 > 0, alpha, 0).astype(np.uint8)

    # 清除孤立的小碎片
    n3, lab3, st3, _ = cv2.connectedComponentsWithStats((alpha > 40).astype(np.uint8), 8)
    keep3 = np.zeros_like(alpha, bool)
    for i in range(1, n3):
        if st3[i, cv2.CC_STAT_AREA] >= 40:
            keep3 |= (lab3 == i)
    alpha = np.where(keep3, alpha, 0).astype(np.uint8)

    ca[:, :, 3] = alpha
    out = os.path.join(DEMO, 'assets', 'dog_new.png')
    Image.fromarray(ca.astype(np.uint8)).save(out)
    print('写出 %s 尺寸 %dx%d' % (out, ca.shape[1], ca.shape[0]))
    print('不透明(>200):', int((alpha > 200).sum()),
          ' 半透明(40-200):', int(((alpha > 40) & (alpha <= 200)).sum()))

    ys, xs = np.nonzero(alpha > 40)
    print('bbox x', xs.min(), xs.max(), 'y', ys.min(), ys.max())

    print('\n预览:')
    for ry in range(0, hh, max(1, hh // 34)):
        line = ''
        for rx in range(0, ww, max(1, ww // 52)):
            blk = alpha[ry:max(ry + 1, ry + hh // 34), rx:max(rx + 1, rx + ww // 52)]
            line += '#' if blk.mean() > 140 else ('+' if blk.mean() > 40 else '.')
        print(line)


# ────────────────────────────── 子命令：mark ──────────────────────────────
def _shapes():
    """分离深橙 / 浅橙两块形状。深橙块可能与浅橙相邻，先做形态学处理分离。"""
    im, A = load()
    H, W = A.shape[:2]

    both = (DARK | LIGHT).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(both, 8)
    i = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    shape = (lab == i).astype(np.uint8)
    shape = cv2.morphologyEx(shape, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))

    # 浅橙在深橙的右侧/上方。逐行找分界，构造一个「浅橙侧」掩膜
    ys = np.nonzero(shape)[0]
    miny, maxy = ys.min(), ys.max()
    xs = np.nonzero(shape)[1]
    minx, maxx = xs.min(), xs.max()
    print('shape bbox x', minx, maxx, 'y', miny, maxy)

    # 找到浅橙掩膜内最大连通域（排除柴犬身上的零散浅橙）
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(LIGHT.astype(np.uint8), 8)
    order = np.argsort(-st2[1:, cv2.CC_STAT_AREA]) + 1
    light_main = (lab2 == order[0]).astype(np.uint8)
    print('浅橙主块 area', st2[order[0], cv2.CC_STAT_AREA])
    ysl, xsl = np.nonzero(light_main)
    print('浅橙主块 bbox x', xsl.min(), xsl.max(), 'y', ysl.min(), ysl.max())

    # 深橙主块
    n3, lab3, st3, _ = cv2.connectedComponentsWithStats(DARK.astype(np.uint8), 8)
    order3 = np.argsort(-st3[1:, cv2.CC_STAT_AREA]) + 1
    dark_main = (lab3 == order3[0]).astype(np.uint8)
    ysd, xsd = np.nonzero(dark_main)
    print('深橙主块 area', st3[order3[0], cv2.CC_STAT_AREA],
          'bbox x', xsd.min(), xsd.max(), 'y', ysd.min(), ysd.max())

    # 关键：浅橙的左侧边界 = 深橙的右侧边界
    bound = {}
    for y in range(ysl.min(), ysl.max() + 1):
        row = np.nonzero(light_main[y])[0]
        if len(row):
            bound[y] = row.min()

    # 用分界点拟合（浅橙有凹陷，取的是每行最左，可能被柴犬打断 → 用中位数趋势）
    from statistics import median
    by = np.array(sorted(bound))
    bx = np.array([bound[y] for y in by])
    xsmooth = []
    for i in range(len(bx)):
        lo = max(0, i - 8)
        hi = min(len(bx), i + 9)
        xsmooth.append(median(bx[lo:hi]))
    xsmooth = np.array(xsmooth)
    coef = np.polyfit(by, xsmooth, 2)
    print('分界拟合系数', np.round(coef, 5))

    # 生成「深橙侧」掩膜：分界线左侧 = 深橙
    yy = np.arange(H)[:, None]
    line_x = (coef[0] * yy ** 2 + coef[1] * yy + coef[2])
    dark_side = (np.arange(W)[None, :] <= line_x)
    dark_shape = shape.astype(bool) & dark_side
    dark_shape = dark_shape | dark_main.astype(bool)
    dark_shape = cv2.morphologyEx(dark_shape.astype(np.uint8), cv2.MORPH_CLOSE,
                                   np.ones((7, 7), np.uint8)).astype(bool)

    light_shape = shape.astype(bool) & ~dark_side
    light_shape = light_shape | light_main.astype(bool)
    light_shape = cv2.morphologyEx(light_shape.astype(np.uint8), cv2.MORPH_CLOSE,
                                    np.ones((7, 7), np.uint8)).astype(bool)

    print('深橙 area', dark_shape.sum(), '浅橙 area', light_shape.sum())
    return dark_shape, light_shape


def _contour(mask, maxpts=140):
    cs, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)
    for eps in (3.0, 2.2, 1.6, 1.1, 0.7, 0.4):
        ap = cv2.approxPolyDP(c, eps, True).reshape(-1, 2).astype(float)
        if len(ap) <= maxpts:
            break
    return ap, len(c)


def _to_bezier(pts, tension=0.11):
    P = np.array(pts, float)
    n = len(P)
    d = 'M %.2f %.2f ' % (P[0][0], P[0][1])
    for k in range(n):
        p0 = P[(k - 1) % n]
        p1 = P[k]
        p2 = P[(k + 1) % n]
        p3 = P[(k + 2) % n]
        t1 = (p2 - p0) * tension
        t2 = (p3 - p1) * tension
        c1 = (p1[0] + t1[0], p1[1] + t1[1])
        c2 = (p2[0] - t2[0], p2[1] - t2[1])
        d += ('C %.2f %.2f %.2f %.2f %.2f %.2f ' %
              (c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]))
    return d + 'Z'


def cmd_mark():
    """提取两个品牌色块 → assets/mark.svg"""
    dark_shape, light_shape = _shapes()

    apd, cd = _contour(dark_shape)
    apl, cl = _contour(light_shape)
    print('深橙轮廓', len(apd), '点 (原始', cd, ')')
    print('浅橙轮廓', len(apl), '点 (原始', cl, ')')

    allp = np.vstack([apd, apl])
    minx, miny = allp.min(0)
    maxx, maxy = allp.max(0)
    SC = 100.0 / max(maxx - minx, maxy - miny)

    def norm(p):
        return [(float(x - minx) * SC, float(y - miny) * SC) for x, y in p]

    nd, nl = norm(apd), norm(apl)
    vw = (maxx - minx) * SC
    vh = (maxy - miny) * SC

    dd = _to_bezier(nd)
    dl = _to_bezier(nl)
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %.2f %.2f">\n'
           '  <path d="%s" fill="#FF6B00"/>\n  <path d="%s" fill="#FCA878"/>\n</svg>\n') % (
        vw, vh, dd, dl)
    out = os.path.join(DEMO, 'assets', 'mark.svg')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(svg)
    print('写出 %s  viewBox %.2f x %.2f' % (out, vw, vh))


# ───────────────────────────── 子命令：verify ─────────────────────────────
def _flatten(d, steps=28):
    toks = re.findall(r'([MLCZ])([^MLCZ]*)', d)
    subs = []
    cur = []
    pos = (0., 0.)
    start = (0., 0.)
    for cmd, args in toks:
        nums = [float(v) for v in re.findall(r'-?\d+\.?\d*', args)]
        if cmd == 'M':
            if len(cur) > 2:
                subs.append(cur)
            pos = (nums[0], nums[1])
            start = pos
            cur = [pos]
        elif cmd == 'L':
            for k in range(0, len(nums), 2):
                pos = (nums[k], nums[k + 1])
                cur.append(pos)
        elif cmd == 'C':
            for k in range(0, len(nums), 6):
                p1 = (nums[k], nums[k + 1])
                p2 = (nums[k + 2], nums[k + 3])
                p3 = (nums[k + 4], nums[k + 5])
                p0 = pos
                for s in range(1, steps + 1):
                    t = s / steps
                    u = 1 - t
                    cur.append((u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
                                u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]))
                pos = p3
        elif cmd == 'Z':
            if len(cur) > 2:
                subs.append(cur)
            cur = [start]
            pos = start
    if len(cur) > 2:
        subs.append(cur)
    return subs


def cmd_verify():
    """整体比对：把 SVG 两个 path 一起渲染，与原图橙色整体区域比对。"""
    im, A = load()
    H, W = A.shape[:2]

    both = (DARK | LIGHT).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(both, 8)
    i = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    ref = (lab == i)

    ys, xs = np.nonzero(ref)
    RX0, RX1, RY0, RY1 = xs.min(), xs.max(), ys.min(), ys.max()
    print('ref bbox', RX0, RX1, RY0, RY1)

    with open(os.path.join(DEMO, 'assets', 'mark.svg'), encoding='utf-8') as f:
        svg = f.read()
    vb = [float(x) for x in re.search(r'viewBox="([\d.\- ]+)"', svg).group(1).split()]
    paths = re.findall(r'<path d="([^"]+)"', svg)

    N = 420

    def render(subs):
        m = np.zeros((N, N), np.uint8)
        sc = min(N / vb[2], N / vb[3]) * 0.94
        ox = (N - vb[2] * sc) / 2
        oy = (N - vb[3] * sc) / 2
        for poly in subs:
            pts = np.array([[ox + x * sc, oy + y * sc] for x, y in poly], np.int32)
            cv2.fillPoly(m, [pts], 1)
        return m.astype(bool)

    svg_mask = render(_flatten(paths[0]) + _flatten(paths[1]))

    # ref 同样方式归一
    crop = ref[RY0:RY1 + 1, RX0:RX1 + 1].astype(np.uint8)
    h, w = crop.shape
    sc = min(N / w, N / h) * 0.94
    nw, nh = int(w * sc), int(h * sc)
    rs = cv2.resize(crop, (nw, nh), interpolation=cv2.INTER_AREA)
    refm = np.zeros((N, N), np.uint8)
    ox, oy = (N - nw) // 2, (N - nh) // 2
    refm[oy:oy + nh, ox:ox + nw] = rs
    refm = refm.astype(bool)

    inter = (refm & svg_mask).sum()
    union = (refm | svg_mask).sum()
    print('整体 IoU = %.4f   ref=%.3f svg=%.3f' % (inter / union, refm.mean(), svg_mask.mean()))

    only_ref = refm & ~svg_mask
    only_svg = svg_mask & ~refm
    print('原图多出 %d px (%.1f%%)' % (only_ref.sum(), only_ref.sum() / max(1, refm.sum()) * 100))
    print('SVG 多出 %d px (%.1f%%)' % (only_svg.sum(), only_svg.sum() / max(1, svg_mask.sum()) * 100))

    print('\n差异 (G=原图多 R=SVG多 .=匹配):')
    for ry in range(0, N, 7):
        line = ''
        for rx in range(0, N, 3):
            u = refm[ry:ry + 7, rx:rx + 3].any()
            s = svg_mask[ry:ry + 7, rx:rx + 3].any()
            line += ('.' if (u and s) else 'G' if u else 'R' if s else ' ')
        print(line)

    vis = np.full((N, N, 3), 255, np.uint8)
    vis[refm] = [230, 230, 230]
    vis[only_svg] = [255, 0, 0]
    vis[only_ref] = [0, 180, 0]
    out = os.path.join(DEMO, '_diff_shapes.png')
    Image.fromarray(vis).save(out)
    print('写出 %s (灰=匹配 绿=原图多 红=SVG多)' % out)


CMDS = {'dog': cmd_dog, 'mark': cmd_mark, 'verify': cmd_verify}

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd not in CMDS:
        print('用法: python %s {%s}' % (os.path.basename(__file__), '|'.join(CMDS)))
        sys.exit(1)
    CMDS[cmd]()
