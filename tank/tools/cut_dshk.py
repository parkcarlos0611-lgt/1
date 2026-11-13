#!/usr/bin/env python3
"""Lift the anti-aircraft machine gun (DShKM 12.7 mm) off the Iraqi tanks' turret sprites so it can pivot:
the gun goes to assets/sprites/<id>/dshk.png and is erased from turret.png (its post stays on the turret).
Run once after tools/cut_iraqi.py (it refuses to run twice on the same turret). Coordinates: source px.
usage: python3 tools/cut_dshk.py
"""
import os, json
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# id: (x0, y0, x1, y1) box holding the gun and its cradle
BOX = {'t55': (1236, 30, 1358, 61), 't62': (1226, 338, 1328, 363), 't72': (1200, 623, 1326, 661)}
for vid, (x0, y0, x1, y1) in BOX.items():
    d = os.path.join(ROOT, 'assets/sprites', vid); cj = os.path.join(d, 'cut.json'); info = json.load(open(cj))
    if 'dshk' in info: print(vid, 'already cut'); continue
    t = info['turret']; tur = np.asarray(Image.open(os.path.join(d, 'turret.png')).convert('RGBA')).copy()
    a, b, c, e = x0 - t['x'], y0 - t['y'], x1 - t['x'], y1 - t['y']
    gun = tur[b:e, a:c].copy(); tur[b:e, a:c] = 0
    ys, xs = np.nonzero(gun[..., 3]); gx0, gy0 = xs.min(), ys.min()
    Image.fromarray(gun[gy0:ys.max() + 1, gx0:xs.max() + 1]).save(os.path.join(d, 'dshk.png'))
    Image.fromarray(tur).save(os.path.join(d, 'turret.png'))
    info['dshk'] = {'x': int(x0 + gx0), 'y': int(y0 + gy0), 'w': int(xs.max() - gx0 + 1), 'h': int(ys.max() - gy0 + 1)}
    json.dump(info, open(cj, 'w'), indent=1); print(vid, info['dshk'])
