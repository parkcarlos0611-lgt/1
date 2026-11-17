#!/usr/bin/env python3
"""Cut the four high-rise buildings of assets/ref/buildings_highrise.jpg for the demolition tests.
For each: <name>.png (as drawn) and <name>_broken.png (every window pane knocked out: dark openings with a
few shards left in the frames), used once a blast has shattered the glass.
Outputs assets/sprites/buildings/ + buildings.json.
usage: python3 tools/cut_buildings.py
"""
import os, json
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/sprites/buildings'); os.makedirs(OUT, exist_ok=True)
SRC = Image.open(os.path.join(ROOT, 'assets/ref/buildings_highrise.jpg')).convert('RGB')
BOX = {'b1': (4, 4, 302, 456), 'b2': (315, 6, 616, 456), 'b3': (625, 4, 912, 456), 'b4': (931, 10, 1221, 456)}

def flood(im, thr=232):
    white = (im.min(axis=2) > thr) & ((im.max(axis=2) - im.min(axis=2)) < 22)
    reg = np.zeros_like(white); reg[0], reg[:, 0], reg[:, -1] = white[0], white[:, 0], white[:, -1]
    while True:
        d = reg.copy(); d[1:] |= reg[:-1]; d[:-1] |= reg[1:]; d[:, 1:] |= reg[:, :-1]; d[:, :-1] |= reg[:, 1:]; d &= white
        if (d == reg).all(): break
        reg = d
    return reg

info = {}; rng = np.random.default_rng(7)
for name, box in BOX.items():
    im = np.asarray(SRC.crop(box)).astype(np.int16)
    bg = flood(im)
    a = np.where(bg, 0, 255).astype(np.uint8)
    ys, xs = np.nonzero(a); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    rgb = im[y0:y1, x0:x1].astype(np.uint8); al = a[y0:y1, x0:x1]
    big = lambda arr: Image.fromarray(arr).resize((arr.shape[1] * 2, arr.shape[0] * 2), Image.LANCZOS)      # 2x: softer edges in game
    big(np.dstack([rgb, al])).save(os.path.join(OUT, name + '.png'))
    r, g, b = rgb[..., 0].astype(int), rgb[..., 1].astype(int), rgb[..., 2].astype(int)
    lum = (r * 3 + g * 6 + b) // 10
    glass = (lum < 118) & (b >= r - 14) & (al > 0)              # dark, grey-blue panes (the walls are warm tan)
    br = rgb.copy()
    shard = rng.random(glass.shape) < 0.07
    br[glass] = (18, 20, 24); br[glass & shard] = (150, 170, 185)
    big(np.dstack([br, al])).save(os.path.join(OUT, name + '_broken.png'))
    info[name] = {'w': int(x1 - x0) * 2, 'h': int(y1 - y0) * 2, 'glass': round(float(glass.sum()) / max(1, (al > 0).sum()), 3)}
json.dump(info, open(os.path.join(OUT, 'buildings.json'), 'w'), indent=1); print(info)
