#!/usr/bin/env python3
"""Cut the AH-64A art: the armed side drawing (top row) of assets/ref/ah64a_sheet.png, 70.6 px/m, origin px
(680, 190). The drawing faces left. Outputs in assets/sprites/ah64a/:
  body_l.png   the airframe as drawn, mirrored (the game mirrors it back when the helicopter faces left, so
               the lettering and tail number read correctly)
  body.png     the same for facing right, with the lettering patches un-mirrored
  rotor.png    main rotor head and blades (turned in game about the mast, px x = 673)
  tailrotor.png  tail rotor blades (turned in game about px (1336, 100))
  wheel.png    landing-gear wheel, face-on, from assets/ref/ah64a_wheel.png (the drawn wheels are removed)
The ground shadow under the drawing is removed.   usage: python3 tools/cut_ah64.py
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
lum = im.sum(axis=2) // 3; chroma = im.max(axis=2) - im.min(axis=2)
white = (im.min(axis=2) > 228) & (chroma < 24)
reg = np.zeros_like(white); reg[0], reg[-1], reg[:, 0], reg[:, -1] = white[0], white[-1], white[:, 0], white[:, -1]
while True:
    d = reg.copy(); d[1:] |= reg[:-1]; d[:-1] |= reg[1:]; d[:, 1:] |= reg[:, :-1]; d[:, :-1] |= reg[:, 1:]; d &= white
    if (d == reg).all(): break
    reg = d
base = np.where(reg, 0, 255).astype(np.uint8)
base[(im.min(axis=2) > 222) & (chroma < 22)] = 0                    # white page enclosed by the drawing
m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon([(x - X0, y) for x, y in [(1286, 96), (1340, 58), (1368, 72), (1352, 205), (1226, 208)]], fill=1)
fin = np.asarray(m).astype(bool)
disc = np.hypot(xx - 1336, yy - 100) < 112
grey = disc & fin & (chroma < 26) & (lum > 46) & (lum < 150)
info = {'ppm': 70.6, 'origin': [680, 190]}

def save(name, alpha, rgb=None, mirror=False, patches=()):
    rgb = im.astype(np.uint8) if rgb is None else rgb
    ys, xs = np.nonzero(alpha); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    full = np.dstack([rgb, alpha])[y0:y1, x0:x1]
    out = full[:, ::-1].copy() if mirror else full
    Wc = full.shape[1]
    for bx0, by0, bx1, by1 in patches:                              # lettering un-mirrored
        u0, u1, v0, v1 = bx0 - X0 - x0, bx1 - X0 - x0, by0 - y0, by1 - y0
        out[v0:v1, Wc - u1:Wc - u0] = full[v0:v1, u0:u1]
    Image.fromarray(out).save(os.path.join(OUT, name + '.png'))
    info[name] = [int(x0 + X0), int(y0), int(x1 - x0), int(y1 - y0)]

# ---- airframe: no rotor, no tail-rotor blades, no wheels, no ground shadow ----
a = base.copy()
a[(yy < 97) & (xx < 1240)] = 0
a[disc & ~fin] = 0
a[np.hypot(xx - 590, yy - 283) < 27] = 0; a[np.hypot(xx - 1336, yy - 284) < 16.5] = 0
a[yy >= 296] = 0
rgb = im.astype(np.uint8).copy(); rgb[grey] = (196, 158, 98)       # blades crossing the fin painted over
save('body_l', a, rgb, mirror=True)
save('body', a, rgb, mirror=True, patches=((1038, 213, 1142, 247), (1244, 178, 1314, 202)))
# ---- main rotor: head and blades above the cabin roof ----
r = base.copy(); r[yy >= 97] = 0; r[xx >= 1175] = 0; r[xx < 413] = 0
r[(yy < 44) & ((xx < 600) | (xx > 750))] = 0; r[yy < 16] = 0       # title lettering
save('rotor', r)
# ---- tail rotor blades ----
t = np.zeros_like(base); sel = disc & (base > 0) & ((~fin & (chroma < 40)) | grey)
t[sel] = 255
save('tailrotor', t)
# ---- wheel (face-on view, first object of the gear sheet) ----
wim = np.asarray(Image.open(os.path.join(ROOT, 'assets/ref/ah64a_wheel.png')).convert('RGBA'))[:, :700]
ys, xs = np.nonzero(wim[..., 3] > 30)
Image.fromarray(wim[ys.min():ys.max() + 1, xs.min():xs.max() + 1]).resize((256, 256), Image.LANCZOS).save(os.path.join(OUT, 'wheel.png'))
json.dump(info, open(os.path.join(OUT, 'cut.json'), 'w'), indent=1); print(info)
