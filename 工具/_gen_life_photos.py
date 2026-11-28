# -*- coding: utf-8 -*-
"""生成生活照素材（竖版 600×800）。

用途：demo 的生活照（打卡时补的随手拍）用占位图，
     尺寸必须与封面一致 —— 封面是竖版 3:4（600×800），
     否则同一张图在不同位置会被拉伸。

产出：demo/assets/life_<n>.jpg（程序生成的纯色 + 简单纹理）
"""
import io
import os
import random

W, H = 600, 800
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       'demo', 'assets')

# 低饱和度的生活色调（灰蓝 / 米色 / 灰绿 …）
PALETTE = [
    (214, 209, 199), (198, 206, 210), (206, 199, 190), (190, 200, 194),
    (222, 214, 205), (185, 195, 205), (210, 205, 195), (195, 205, 195),
    (230, 224, 216), (176, 188, 198),
]


def make_image(idx, w, h):
    """生成一张纯色 + 横向色带的图片（无需 PIL 时写最小 JPEG 替代）。"""
    r, g, b = PALETTE[idx % len(PALETTE)]
    # PPM（Netpbm）是最容易手写且多数工具能读的格式
    buf = io.BytesIO()
    buf.write(b'P6\n%d %d\n255\n' % (w, h))
    row = bytearray()
    for x in range(w):
        # 轻微渐变，避免死板
        d = int(14 * (x / max(1, w - 1)))
        row += bytes((max(0, r - d), max(0, g - d), max(0, b - d)))
    for y in range(h):
        # 每 ~90 行换一次色调，模拟场景分块
        band = (y // 90) % 3
        if band == 1:
            row2 = bytearray()
            for x in range(w):
                d = int(14 * (x / max(1, w - 1)))
                row2 += bytes((max(0, r - d - 10), max(0, g - d - 8), max(0, b - d - 6)))
            buf.write(row2)
        elif band == 2:
            row3 = bytearray()
            for x in range(w):
                d = int(14 * (x / max(1, w - 1)))
                row3 += bytes((max(0, r - d - 18), max(0, g - d - 16), max(0, b - d - 12)))
            buf.write(row3)
        else:
            buf.write(row)
    return buf.getvalue()


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    n = 12
    for i in range(n):
        p = os.path.join(OUT_DIR, 'life_%d.ppm' % i)
        with open(p, 'wb') as f:
            f.write(make_image(i, W, H))
        print('wrote', p)
    print('生活照素材 %d 张，%dx%d' % (n, W, H))


if __name__ == '__main__':
    main()
