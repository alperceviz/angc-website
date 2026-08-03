#!/usr/bin/env python3
"""Uygulama simgelerini üretir (siyah zemin + sarı kalkan), bağımlılık yok.

Kullanım:
    python3 tools/make_icons.py assets

Renkleri değiştirmek için aşağıdaki BG_/GOLD_/INK sabitlerini düzenleyin.
"""
import math, struct, zlib, os, sys

OUT = sys.argv[1]

def lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))

BG_TOP = (10, 10, 10)
BG_BOT = (32, 32, 30)
GOLD_TOP = (255, 231, 92)
GOLD_BOT = (250, 197, 0)
INK = (10, 10, 10)

def shield_halfwidth(t):
    """t in [0,1] top->bottom, returns half width factor in [0,1]."""
    if t < 0 or t > 1:
        return 0.0
    rt = 0.14
    f = 1.0
    if t <= 0.5:
        pass
    else:
        u = (t - 0.5) / 0.5
        f = math.sqrt(max(0.0, 1 - u * u)) * ((1 - u) ** 0.22)
    if t < rt:
        k = (rt - t) / rt
        f *= math.sqrt(max(0.0, 1 - k * k))
    return f

def seg_dist(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    L = vx * vx + vy * vy
    tt = 0.0 if L == 0 else max(0.0, min(1.0, (wx * vx + wy * vy) / L))
    dx, dy = px - (ax + vx * tt), py - (ay + vy * tt)
    return math.hypot(dx, dy)

def sample(x, y, S, maskable):
    """Return (r,g,b,a) at normalized coords x,y in [0,1]."""
    # background
    bg = lerp(BG_TOP, BG_BOT, y)
    a = 255.0
    if not maskable:
        # rounded square mask
        r = 0.22
        cx = min(max(x, r), 1 - r)
        cy = min(max(y, r), 1 - r)
        d = math.hypot(x - cx, y - cy)
        if d > r:
            a = 0.0

    # shield geometry (inset)
    pad = 0.30 if maskable else 0.17
    top, bot = pad, 1 - pad
    halfw = (0.5 - pad) * (1.02 if maskable else 1.12)
    col = bg
    if top <= y <= bot:
        t = (y - top) / (bot - top)
        w = shield_halfwidth(t) * halfw
        dx = abs(x - 0.5)
        if dx <= w:
            g = lerp(GOLD_TOP, GOLD_BOT, t)
            col = g
            # checkmark inside shield
            sc = halfw
            ax, ay = 0.5 - 0.42 * sc, top + (bot - top) * 0.47
            bx, by = 0.5 - 0.10 * sc, top + (bot - top) * 0.63
            cx2, cy2 = 0.5 + 0.44 * sc, top + (bot - top) * 0.30
            d = min(seg_dist(x, y, ax, ay, bx, by), seg_dist(x, y, bx, by, cx2, cy2))
            if d < 0.075 * sc:
                col = INK
    return (col[0], col[1], col[2], a)

def render(size, maskable=False, ss=4):
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            acc = [0.0, 0.0, 0.0, 0.0]
            for sy in range(ss):
                for sx in range(ss):
                    x = (px + (sx + 0.5) / ss) / size
                    y = (py + (sy + 0.5) / ss) / size
                    r, g, b, a = sample(x, y, size, maskable)
                    acc[0] += r * a / 255.0
                    acc[1] += g * a / 255.0
                    acc[2] += b * a / 255.0
                    acc[3] += a
            n = ss * ss
            al = acc[3] / n
            if al <= 0.5:
                row += bytes((0, 0, 0, 0))
            else:
                k = acc[3] / 255.0
                row += bytes((
                    int(max(0, min(255, acc[0] / k * 1.0))),
                    int(max(0, min(255, acc[1] / k * 1.0))),
                    int(max(0, min(255, acc[2] / k * 1.0))),
                    int(max(0, min(255, al))),
                ))
        rows.append(bytes(row))
    return rows

def write_png(path, size, rows):
    raw = b"".join(b"\x00" + r for r in rows)
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)
    print("wrote", path, os.path.getsize(path), "bytes")

os.makedirs(OUT, exist_ok=True)
for size, name, mask in [
    (512, "icon-512.png", False),
    (192, "icon-192.png", False),
    (180, "apple-touch-icon.png", False),
    (512, "icon-maskable-512.png", True),
    (64, "favicon.png", False),
]:
    write_png(os.path.join(OUT, name), size, render(size, mask))
