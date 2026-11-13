#!/usr/bin/env python3
"""Cut the running-gear art (assets/ref/m1a1_wheels.png) into square, background-free sprites.

Order in the sheet (left → right): front road wheel, standard road wheel, drive sprocket.
Each is cropped to its bounding box, resampled to a 512 px square (so it rotates without wobble)
and the sprocket's tooth count + first tooth angle are measured for track meshing.
usage: python3 tools/cut_wheels.py
"""
import os, json, math
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/ref/m1a1_wheels.png')
OUT = os.path.join(ROOT, 'assets/sprites/m1a1')
SIZE = 512

im = np.asarray(Image.open(SRC).convert('RGB')).astype(np.int16)
white = (im.min(axis=2) > 228) & ((im.max(axis=2) - im.min(axis=2)) < 24)
# flood the background from the border
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
edge = np.zeros_like(reg)
edge[1:] |= reg[:-1]; edge[:-1] |= reg[1:]; edge[:, 1:] |= reg[:, :-1]; edge[:, :-1] |= reg[:, 1:]
edge &= ~reg
alpha[edge] = 150
rgba = np.dstack([im.astype(np.uint8), alpha])

fg = alpha > 0
cols = np.nonzero(fg.any(axis=0))[0]
runs, s, p = [], cols[0], cols[0]
for c in cols[1:]:
    if c > p + 5:
        runs.append((s, p)); s = c
    p = c
runs.append((s, p))
names = ['roadwheel_front', 'roadwheel', 'sprocket']
info = {}
for name, (a, b) in zip(names, runs):
    rows = np.nonzero(fg[:, a:b + 1].any(axis=1))[0]
    crop = Image.fromarray(rgba[rows[0]:rows[-1] + 1, a:b + 1]).resize((SIZE, SIZE), Image.LANCZOS)
    arr = np.asarray(crop).copy()
    r = SIZE / 2
    gy, gx = np.mgrid[0:SIZE, 0:SIZE] + 0.5 - r
    rr = np.hypot(gx, gy)
    arr[..., 3] = np.minimum(arr[..., 3], np.clip((r - rr) * 255, 0, 255)).astype(np.uint8)
    Image.fromarray(arr).save(os.path.join(OUT, name + '.png'))
    meta = {'size': SIZE}
    if name == 'sprocket':
        # angular alpha profile at ~93 % radius → teeth
        prof = []
        for k in range(720):
            t = k / 720 * 2 * math.pi
            x, y = int(r + 0.93 * r * math.cos(t)), int(r - 0.93 * r * math.sin(t))   # y up angle
            prof.append(arr[y, x, 3] > 128)
        starts = [k for k in range(720) if prof[k] and not prof[k - 1]]
        ends = [k for k in range(720) if not prof[k] and prof[k - 1]]
        mids = []
        for s0 in starts:
            e = next((e for e in ends + [x + 720 for x in ends] if e > s0), s0)
            mids.append(((s0 + e) / 2 % 720) / 2)
        meta['teeth'] = len(starts)
        meta['tooth0'] = round(min(mids), 2) if mids else 0      # degrees, y-up, from +x
        # root radius: smallest radius where alpha is solid all the way round
        for f in np.arange(0.95, 0.5, -0.01):
            if all(arr[int(r - f * r * math.sin(t)), int(r + f * r * math.cos(t)), 3] > 128 for t in np.linspace(0, 2 * math.pi, 360, endpoint=False)):
                meta['root'] = round(float(f), 3); break
    info[name] = meta
    print(name, meta)
with open(os.path.join(OUT, 'wheels.json'), 'w') as f:
    json.dump(info, f, indent=1)
