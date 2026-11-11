#!/usr/bin/env python3
"""Cut the AH-64A art: the armed side drawing (top row) of assets/ref/ah64a_sheet.png, 70.6 px/m (fuselage
14.97 m). The drawn rotor blades are removed (main rotor and tail rotor are drawn turning in game); the
sprite is mirrored so the nose points right like every other vehicle. Origin px (680, 190).
Output: assets/sprites/ah64a/body.png + cut.json.   usage: python3 tools/cut_ah64.py
"""
import os, json
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/sprites/ah64a'); os.makedirs(OUT, exist_ok=True)
X0, Y0, X1, Y1 = 300, 0, 1447, 312
im = np.asarray(Image.open(os.path.join(ROOT, 'assets/ref/ah64a_sheet.png')).convert('RGB').crop((X0, Y0, X1, Y1))).astype(np.int16)
H, W = im.shape[:2]
yy, xx = np.mgrid[0:H, 0:W]; xx = xx + X0
white = (im.min(axis=2) > 228) & ((im.max(axis=2) - im.min(axis=2)) < 24)
reg = np.zeros_like(white); reg[0], reg[-1], reg[:, 0], reg[:, -1] = white[0], white[-1], white[:, 0], white[:, -1]
while True:
    d = reg.copy(); d[1:] |= reg[:-1]; d[:-1] |= reg[1:]; d[:, 1:] |= reg[:, :-1]; d[:, :-1] |= reg[:, 1:]; d &= white
    if (d == reg).all(): break
    reg = d
a = np.where(reg, 0, 255).astype(np.uint8)
rgb = im.astype(np.uint8).copy()
lum = im.sum(axis=2) // 3; chroma = im.max(axis=2) - im.min(axis=2)
# title lettering and main rotor blades: everything above the cabin roof except the mast and hub
a[(yy < 93) & ((xx < 642) | (xx > 716)) & (xx < 1240)] = 0
a[(yy < 30)] = 0
# tail rotor: blades outside the fin are removed; where they cross the fin the grey is painted over in fin tan
m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon([(x - X0, y) for x, y in [(1286, 96), (1340, 58), (1368, 72), (1352, 205), (1226, 208)]], fill=1)
fin = np.asarray(m).astype(bool)
disc = np.hypot(xx - 1336, yy - 100) < 112
a[disc & ~fin] = 0
grey = disc & fin & (chroma < 26) & (lum > 46) & (lum < 150)
rgb[grey] = (196, 158, 98)
# white page seen between the landing gear, pylons and stores
a[(yy > 205) & (im.min(axis=2) > 226) & (chroma < 22)] = 0
# ground line / shadow under the wheels
a[(yy > 300)] = 0
a[(yy > 296) & (chroma < 20) & (lum > 120)] = 0
rgba = np.dstack([rgb, a])
ys, xs = np.nonzero(a); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
out = rgba[y0:y1, x0:x1][:, ::-1]                       # mirrored: nose to the right
out = out.copy(); full = rgba[y0:y1, x0:x1]; Wc = full.shape[1]
for bx0, by0, bx1, by1 in ((1038, 213, 1142, 247), (1244, 178, 1314, 202)):     # lettering reads the right way round
    u0, u1, v0, v1 = bx0 - X0 - x0, bx1 - X0 - x0, by0 - y0, by1 - y0
    out[v0:v1, Wc - u1:Wc - u0] = full[v0:v1, u0:u1]
Image.fromarray(out).save(os.path.join(OUT, 'body.png'))
info = {'ppm': 70.6, 'origin': [680, 190], 'box': [int(x0 + X0), int(y0), int(x1 + X0), int(y1)]}
json.dump(info, open(os.path.join(OUT, 'cut.json'), 'w'), indent=1); print(info)
