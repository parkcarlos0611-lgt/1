#!/usr/bin/env python3
"""Cut the M270 MLRS art: the right-facing side drawing of assets/ref/m270_sheet.png, 90 px/m (6.9 m long).
hull = chassis and cab; barrel = the launcher box with its elevating arm (pivots at its rear lower corner);
turret = the small cradle strip under the box. Running gear from the bottom row of the sheet.
usage: python3 tools/cut_m270.py
"""
import os, json, math
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/sprites/m270'); os.makedirs(OUT, exist_ok=True)
X0, Y0 = 750, 440

def flood(im, thr=228):
    white = (im.min(axis=2) > thr) & ((im.max(axis=2) - im.min(axis=2)) < 24)
    reg = np.zeros_like(white); reg[0], reg[-1], reg[:, 0], reg[:, -1] = white[0], white[-1], white[:, 0], white[:, -1]
    while True:
        d = reg.copy(); d[1:] |= reg[:-1]; d[:-1] |= reg[1:]; d[:, 1:] |= reg[:, :-1]; d[:, :-1] |= reg[:, 1:]; d &= white
        if (d == reg).all(): break
        reg = d
    return np.where(reg, 0, 255).astype(np.uint8)

sheet = Image.open(os.path.join(ROOT, 'assets/ref/m270_sheet.png')).convert('RGB')
im = np.asarray(sheet.crop((X0, Y0, 1446, 730))).astype(np.int16)
rgba = np.dstack([im.astype(np.uint8), flood(im)])
H, W = rgba.shape[:2]
yy, xx = np.mgrid[0:H, 0:W]; xx = xx + X0; yy = yy + Y0
info = {}
def poly(pts):
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon([(x - X0, y - Y0) for x, y in pts], fill=1); return np.asarray(m).astype(bool)
def save(name, mask):
    a = rgba.copy(); a[~mask] = 0
    ys, xs = np.nonzero(a[..., 3]); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    Image.fromarray(a[y0:y1, x0:x1]).save(os.path.join(OUT, name + '.png'))
    info[name] = {'x': int(x0 + X0), 'y': int(y0 + Y0), 'w': int(x1 - x0), 'h': int(y1 - y0)}

# antennas become spring masts in game
rgba[(xx >= 1127) & (xx <= 1143) & (yy < 537), 3] = 0
rgba[(xx >= 1190) & (xx <= 1206) & (yy < 520), 3] = 0
rgba[(im.min(axis=2) > 232) & ((im.max(axis=2) - im.min(axis=2)) < 16) & (xx < 1140), 3] = 0      # page seen between box, arm and cab
box = poly([(760, 470), (1072, 470), (1072, 488), (1126, 492), (1126, 540), (1096, 546), (1072, 580), (1066, 600), (786, 600), (760, 586)])
SKIRT = 642
save('barrel', box)
save('turret', (yy >= 600) & (yy < 607) & (xx >= 880) & (xx < 1010))
save('hull', ~box & (yy < SKIRT))

ws = np.asarray(sheet).astype(np.int16)
wa = np.dstack([ws.astype(np.uint8), flood(ws, 215)])
SIZE = 512
for name, (a0, b0) in (('idler', (714, 930)), ('roadwheel', (944, 1166)), ('sprocket', (1183, 1416))):
    band = wa[770:1012, a0 - 6:b0 + 7]; fg = band[..., 3] > 0
    rows = np.nonzero(fg.sum(axis=1) > 4)[0]; cs = np.nonzero(fg.sum(axis=0) > 4)[0]
    cut = band[rows[0]:rows[-1] + 1, cs[0]:cs[-1] + 1]
    arr = np.asarray(Image.fromarray(cut).resize((SIZE, SIZE), Image.LANCZOS)).copy()
    r = SIZE / 2; gy, gx = np.mgrid[0:SIZE, 0:SIZE] + 0.5 - r
    if name != 'sprocket': arr[..., 3] = np.minimum(arr[..., 3], np.clip((r - np.hypot(gx, gy)) * 255, 0, 255)).astype(np.uint8)
    if name == 'idler': arr[(arr[..., :3].min(axis=2) > 225), 3] = 0
    Image.fromarray(arr).save(os.path.join(OUT, name + '.png'))
    if name == 'sprocket':
        prof = [arr[int(r - 0.9 * r * math.sin(k / 720 * 2 * math.pi)), int(r + 0.9 * r * math.cos(k / 720 * 2 * math.pi)), 3] > 128 for k in range(720)]
        st = [k for k in range(720) if prof[k] and not prof[k - 1]]; en = [k for k in range(720) if not prof[k] and prof[k - 1]]
        mids = [(((s0 + next(e for e in en + [x + 720 for x in en] if e > s0)) / 2) % 720) / 2 for s0 in st]
        info['teeth'] = len(st); info['tooth0'] = round(min(mids), 2)
json.dump(info, open(os.path.join(OUT, 'cut.json'), 'w'), indent=1); print(info)
