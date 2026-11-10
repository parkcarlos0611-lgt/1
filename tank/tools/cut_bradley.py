#!/usr/bin/env python3
"""Cut the M2A2 Bradley art: the RIGHT-side drawing (facing right) of assets/ref/m2a2_views.png, crop
(900,0)-(1690,450), 114 px/m. The TOW launcher sits on the far (left) side of the turret, so it is not in
this view; the game draws it as an X-ray overlay.
Outputs assets/sprites/m2a2/{hull,turret,barrel,roadwheel,idler,sprocket}.png + cut.json.
usage: python3 tools/cut_bradley.py
"""
import os, json, math
import numpy as np
from PIL import Image, ImageOps, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/sprites/m2a2'); os.makedirs(OUT, exist_ok=True)

def flood(im):
    white = (im.min(axis=2) > 228) & ((im.max(axis=2) - im.min(axis=2)) < 24)
    reg = np.zeros_like(white); reg[0], reg[-1], reg[:, 0], reg[:, -1] = white[0], white[-1], white[:, 0], white[:, -1]
    while True:
        d = reg.copy(); d[1:] |= reg[:-1]; d[:-1] |= reg[1:]; d[:, 1:] |= reg[:, :-1]; d[:, :-1] |= reg[:, 1:]; d &= white
        if (d == reg).all(): break
        reg = d
    return np.where(reg, 0, 255).astype(np.uint8)

src = Image.open(os.path.join(ROOT, 'assets/ref/m2a2_views.png')).convert('RGB').crop((900, 0, 1690, 450))
im = np.asarray(src).astype(np.int16)
rgba = np.dstack([im.astype(np.uint8), flood(im)])
H, W = rgba.shape[:2]
yy, xx = np.mgrid[0:H, 0:W]
info = {}
def save(name, mask):
    a = rgba.copy(); a[~mask] = 0
    ys, xs = np.nonzero(a[..., 3]); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    Image.fromarray(a[y0:y1, x0:x1]).save(os.path.join(OUT, name + '.png'))
    info[name] = {'x': int(x0), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0)}
def poly(pts):
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(pts, fill=1); return np.asarray(m).astype(bool)

# antennas become spring masts in game
for ax, top in ((189, 140), (93, 188)):
    rgba[(xx >= ax - 5) & (xx <= ax + 5) & (yy < top), 3] = 0
SEAM, SKIRT, GUN_X = 200, 362, 447
save('barrel', (xx >= GUN_X) & (yy > 155) & (yy < 183) & (xx < 625))
save('turret', (yy >= 86) & (yy < SEAM) & (xx >= 170) & (xx < GUN_X + 3))
hull = ((yy >= SEAM) | ((xx < 170) & (yy >= 180))) & (yy < SKIRT)
hull &= ~poly([(702, 362), (752, 322), (790, 322), (790, 362)])      # front: track under the nose plate
hull &= ~poly([(0, 328), (52, 328), (68, 362), (0, 362)])            # rear: track under the ramp
save('hull', hull)

# running gear sheet: three groups (road wheel, idler, sprocket); the first (face-on) view of each
ws = np.asarray(Image.open(os.path.join(ROOT, 'assets/ref/m2a2_wheels.png')).convert('RGB')).astype(np.int16)
wa = np.dstack([ws.astype(np.uint8), flood(ws)])
band = wa[300:700]
fg = band[..., 3] > 0
cols = np.nonzero(fg.sum(axis=0) > 6)[0]
runs, s, p = [], cols[0], cols[0]
for c in cols[1:]:
    if c > p + 3: runs.append((s, p)); s = c
    p = c
runs.append((s, p)); runs = [r for r in runs if r[1] - r[0] > 60]
print('runs', runs)
SIZE = 512
for name, (a, b) in zip(['roadwheel', 'idler', 'sprocket'], [runs[0], runs[3], runs[6]]):
    rows = np.nonzero(fg[:, a:b + 1].sum(axis=1) > 3)[0]
    arr = np.asarray(Image.fromarray(band[rows[0]:rows[-1] + 1, a:b + 1]).resize((SIZE, SIZE), Image.LANCZOS)).copy()
    r = SIZE / 2; gy, gx = np.mgrid[0:SIZE, 0:SIZE] + 0.5 - r
    arr[..., 3] = np.minimum(arr[..., 3], np.clip((r - np.hypot(gx, gy)) * 255, 0, 255)).astype(np.uint8)
    if name == 'idler':                       # lightening holes are see-through
        arr[(arr[..., :3].min(axis=2) > 232), 3] = 0
    Image.fromarray(arr).save(os.path.join(OUT, name + '.png'))
    if name == 'sprocket':
        prof = [arr[int(r - 0.93 * r * math.sin(k / 720 * 2 * math.pi)), int(r + 0.93 * r * math.cos(k / 720 * 2 * math.pi)), 3] > 128 for k in range(720)]
        st = [k for k in range(720) if prof[k] and not prof[k - 1]]; en = [k for k in range(720) if not prof[k] and prof[k - 1]]
        mids = [(((s0 + next(e for e in en + [x + 720 for x in en] if e > s0)) / 2) % 720) / 2 for s0 in st]
        info['teeth'] = len(st); info['tooth0'] = round(min(mids), 2)
json.dump(info, open(os.path.join(OUT, 'cut.json'), 'w'), indent=1); print(info)
