#!/usr/bin/env python3
"""Cut Iraqi tank drawings (assets/ref/iraqi_t55_t62_t72_side.png, right-hand column, facing right)
into rig layers. Coordinates are source-image pixels; each entry lists the split lines measured on
a 10 px grid. Output: assets/sprites/<id>/{hull,turret,barrel,flag}.png + cut.json.
usage: python3 tools/cut_iraqi.py [t72 ...]
"""
import os, sys, json, math
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/ref/iraqi_t55_t62_t72_side.png')

CFG = {
    't55': dict(
        box=(960, 0, 1752, 300), seam=164, skirt=200, gun_x=1432, bore=(124, 147),
        sprocket=(1067, 222, 1), rear_cut=(0, 999), nose=[(1750, 298), (1751, 298), (1751, 299)],
        antennas=[(1185, 96)], flag=(1274, 119, 1331, 153), shadow=281,
    ),
    't62': dict(
        box=(960, 290, 1752, 600), seam=463, skirt=501, gun_x=1412, bore=(427, 451),
        sprocket=(1055, 525, 1), rear_cut=(0, 999), nose=[(1750, 598), (1751, 598), (1751, 599)],
        antennas=[(1184, 398)], flag=(1246, 418, 1303, 453), shadow=584,
    ),
    't72': dict(
        box=(960, 590, 1752, 897),
        seam=741,              # turret / hull split
        skirt=805,             # lowest hull line kept (rubber skirt bottom)
        gun_x=1386,            # barrel starts in front of the mantlet
        bore=(700, 724),       # barrel rows
        sprocket=(1052, 812, 29),   # cut-out sized to the sprocket art (r 0.34 m)
        rear_cut=(1085, 796),  # x < this and y > that: running gear at the rear
        nose=[(1500, 800), (1580, 778), (1600, 900), (1490, 900)],
        antennas=[(1152, 683)],
        flag=(1199, 696, 1259, 733),   # national flag decal: redrawn unmirrored on left-facing tanks
        shadow=858,            # rows below this: drop the light-grey ground shadow
    ),
}


def flood_alpha(sub, shadow_row):
    white = (sub.min(axis=2) > 232) & ((sub.max(axis=2) - sub.min(axis=2)) < 22)
    reg = np.zeros_like(white)
    reg[0], reg[-1], reg[:, 0], reg[:, -1] = white[0], white[-1], white[:, 0], white[:, -1]
    while True:
        d = reg.copy()
        d[1:] |= reg[:-1]; d[:-1] |= reg[1:]; d[:, 1:] |= reg[:, :-1]; d[:, :-1] |= reg[:, 1:]
        d &= white
        if (d == reg).all():
            break
        reg = d
    a = np.where(reg, 0, 255).astype(np.uint8)
    edge = np.zeros_like(reg)
    edge[1:] |= reg[:-1]; edge[:-1] |= reg[1:]; edge[:, 1:] |= reg[:, :-1]; edge[:, :-1] |= reg[:, 1:]
    edge &= ~reg
    a[edge] = np.clip((255 - sub.mean(axis=2)[edge]) * 4, 60, 255).astype(np.uint8)
    # the drawing's ground shadow (light grey ellipse) is not part of the tank
    grey = (sub.min(axis=2) > 175) & ((sub.max(axis=2) - sub.min(axis=2)) < 14)
    grey[:shadow_row] = False
    a[grey] = 0
    return a


def cut(vid):
    c = CFG[vid]
    out = os.path.join(ROOT, 'assets/sprites', vid)
    os.makedirs(out, exist_ok=True)
    x0, y0, x1, y1 = c['box']
    im = np.asarray(Image.open(SRC).convert('RGB')).astype(np.int16)[y0:y1, x0:x1]
    rgba = np.dstack([im.astype(np.uint8), flood_alpha(im, c['shadow'] - y0)])
    yy, xx = np.mgrid[y0:y1, x0:x1]
    info = {}

    def save(name, arr):
        a = arr[..., 3]
        ys, xs = np.nonzero(a)
        bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        Image.fromarray(arr[by0:by1, bx0:bx1]).save(os.path.join(out, name + '.png'))
        info[name] = {'x': int(x0 + bx0), 'y': int(y0 + by0), 'w': int(bx1 - bx0), 'h': int(by1 - by0)}

    for ax, ay in c['antennas']:
        rgba[(xx >= ax - 4) & (xx <= ax + 4) & (yy < ay), 3] = 0

    t = rgba.copy(); t[~((yy < c['seam']) & (xx < c['gun_x'] + 3))] = 0; save('turret', t)
    b = rgba.copy(); b[~((xx >= c['gun_x']) & (yy > c['bore'][0]) & (yy < c['bore'][1]))] = 0; save('barrel', b)

    h = rgba.copy()
    sx, sy, sr = c['sprocket']
    keep = (yy >= c['seam']) & (yy < c['skirt'])
    keep &= ~(((xx - sx) ** 2 + (yy - sy) ** 2) < sr ** 2)
    keep &= ~((xx < c['rear_cut'][0]) & (yy > c['rear_cut'][1]))
    nm = Image.new('L', (x1 - x0, y1 - y0), 0)
    ImageDraw.Draw(nm).polygon([(px - x0, py - y0) for px, py in c['nose']], fill=1)
    keep &= ~np.asarray(nm).astype(bool)
    h[~keep] = 0
    save('hull', h)

    def disc(name, cx, cy, r, keepfn=None):
        s = rgba[cy - r - y0:cy + r + 1 - y0, cx - r - x0:cx + r + 1 - x0].copy()
        gy, gx = np.mgrid[-r:r + 1, -r:r + 1]
        rr = np.hypot(gx, gy)
        a = np.clip((r + 0.5 - rr) * 255, 0, 255)
        if keepfn is not None:
            a = np.where(keepfn(s, rr), a, 0)
        s[..., 3] = np.minimum(s[..., 3], a).astype(np.uint8)
        big = Image.fromarray(s).resize((256, 256), Image.LANCZOS)
        big.save(os.path.join(out, name + '.png'))
        return np.asarray(big)

    # road wheels + sprocket come from the dedicated sheet: tools/cut_wheels_iraqi.py
    if 'flag' in c:
        fx0, fy0, fx1, fy1 = c['flag']
        Image.fromarray(rgba[fy0 - y0:fy1 - y0, fx0 - x0:fx1 - x0]).save(os.path.join(out, 'flag.png'))
        info['flag'] = {'x': fx0, 'y': fy0, 'w': fx1 - fx0, 'h': fy1 - fy0}

    # sprocket: the drawing's sprocket is covered by track links, so the game draws it procedurally
    with open(os.path.join(out, 'cut.json'), 'w') as f:
        json.dump(info, f, indent=1)
    print(vid, json.dumps(info))


for v in (sys.argv[1:] or list(CFG)):
    cut(v)
