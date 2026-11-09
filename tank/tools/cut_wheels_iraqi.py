#!/usr/bin/env python3
"""Cut the Iraqi running-gear sheet (assets/ref/iraqi_wheels.png): one row per tank (T-55, T-62, T-72),
four road-wheel variants then the drive sprocket. Per the user, only the FIRST road wheel of each row
is used. Output: assets/sprites/<t55|t62|t72>/{roadwheel,sprocket}.png (512 px squares) + wheels.json
with the sprocket tooth count, first tooth angle and root-radius ratio.
usage: python3 tools/cut_wheels_iraqi.py
"""
import os, json, math
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/ref/iraqi_wheels.png')
SIZE = 512
ROWS = [('t55', 9, 280), ('t62', 306, 579), ('t72', 604, 872)]

im = np.asarray(Image.open(SRC).convert('RGB')).astype(np.int16)
H, W, _ = im.shape
white = (im.min(axis=2) > 228) & ((im.max(axis=2) - im.min(axis=2)) < 24)
reg = np.zeros_like(white)
reg[0], reg[-1], reg[:, 0], reg[:, -1] = white[0], white[-1], white[:, 0], white[:, -1]
while True:
    d = reg.copy()
    d[1:] |= reg[:-1]; d[:-1] |= reg[1:]; d[:, 1:] |= reg[:, :-1]; d[:, :-1] |= reg[:, 1:]
    d &= white
    if (d == reg).all():
        break
    reg = d
alpha = np.where(reg, 0, 255).astype(np.uint8)
rgba = np.dstack([im.astype(np.uint8), alpha])
fg = alpha > 0


def runs(mask, minw):
    idx = np.nonzero(mask)[0]
    out, s, p = [], None, None
    for i in idx:
        if s is None: s = p = i; continue
        if i > p + 3: out.append((s, p)); s = i
        p = i
    if s is not None: out.append((s, p))
    return [r for r in out if r[1] - r[0] >= minw]


def square(crop):
    arr = np.asarray(Image.fromarray(crop).resize((SIZE, SIZE), Image.LANCZOS)).copy()
    r = SIZE / 2
    gy, gx = np.mgrid[0:SIZE, 0:SIZE] + 0.5 - r
    arr[..., 3] = np.minimum(arr[..., 3], np.clip((r - np.hypot(gx, gy)) * 255, 0, 255)).astype(np.uint8)
    return arr


meta = {}
for vid, y0, y1 in ROWS:
    out = os.path.join(ROOT, 'assets/sprites', vid)
    os.makedirs(out, exist_ok=True)
    cols = runs(fg[y0:y1, 290:].sum(axis=0) > 8, 100)
    cols = [(a + 290, b + 290) for a, b in cols]
    picks = {'roadwheel': cols[0], 'sprocket': cols[-1]}
    info = {}
    for name, (a, b) in picks.items():
        # vertical extent: the tallest contiguous block (drops the bracket / caption below)
        rr = runs(fg[y0:y1, a:b + 1].sum(axis=1) > 3, 50)
        ra = max(rr, key=lambda r: r[1] - r[0])
        top, side = y0 + ra[0], b - a + 1      # round parts: height = width (drops the bracket line under the tyre)
        arr = square(rgba[top:top + side, a:b + 1])
        Image.fromarray(arr).save(os.path.join(out, name + '.png'))
        info[name] = {'w': int(b - a + 1), 'h': int(ra[1] - ra[0] + 1)}
        if name == 'sprocket':
            r = SIZE / 2
            prof = [arr[int(r - 0.93 * r * math.sin(k / 720 * 2 * math.pi)), int(r + 0.93 * r * math.cos(k / 720 * 2 * math.pi)), 3] > 128 for k in range(720)]
            starts = [k for k in range(720) if prof[k] and not prof[k - 1]]
            ends = [k for k in range(720) if not prof[k] and prof[k - 1]]
            mids = []
            for s0 in starts:
                e = next((e for e in ends + [x + 720 for x in ends] if e > s0), s0)
                mids.append(((s0 + e) / 2 % 720) / 2)
            info['teeth'] = len(starts)
            info['tooth0'] = round(min(mids), 2)
            for f in np.arange(0.95, 0.4, -0.01):
                if all(arr[int(r - f * r * math.sin(t)), int(r + f * r * math.cos(t)), 3] > 128 for t in np.linspace(0, 2 * math.pi, 360, endpoint=False)):
                    info['root'] = round(float(f), 3); break
    meta[vid] = info
    with open(os.path.join(out, 'wheels.json'), 'w') as f:
        json.dump(info, f, indent=1)
    print(vid, info)
