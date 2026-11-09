#!/usr/bin/env python3
"""Cut the M1A1 reference art (bottom, facing-right drawing) into rig layers.

Source: assets/ref/m1a1_side.png (1430x1100). Scale of that drawing: ~149 px per metre
(hull length 7.92 m = 1180 px). All rig numbers in data/vehicles/m1a1.js use this frame:
origin px (604, 900), x forward, y up, metres = px / 149.

Outputs (assets/sprites/m1a1/): hull.png turret.png barrel.png roadwheel.png sprocket.png
plus offsets printed for the rig file.
usage: python3 tools/cut_sprites.py
"""
import os, json
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/ref/m1a1_side.png')
OUT = os.path.join(ROOT, 'assets/sprites/m1a1')
os.makedirs(OUT, exist_ok=True)

im = np.asarray(Image.open(SRC).convert('RGB')).astype(np.int16)
H, W, _ = im.shape
Y0 = 540  # bottom drawing starts here
sub = im[Y0:]

# --- background removal: flood the near-white region connected to the border ---
white = (sub.min(axis=2) > 232) & ((sub.max(axis=2) - sub.min(axis=2)) < 22)
reg = np.zeros_like(white)
reg[0, :] = white[0, :]; reg[-1, :] = white[-1, :]; reg[:, 0] = white[:, 0]; reg[:, -1] = white[:, -1]
while True:
    d = reg.copy()
    d[1:] |= reg[:-1]; d[:-1] |= reg[1:]; d[:, 1:] |= reg[:, :-1]; d[:, :-1] |= reg[:, 1:]
    d &= white
    if (d == reg).all():
        break
    reg = d
alpha = np.where(reg, 0, 255).astype(np.uint8)
# soften the fringe: light pixels touching the background get partial alpha
edge = np.zeros_like(reg)
edge[1:] |= reg[:-1]; edge[:-1] |= reg[1:]; edge[:, 1:] |= reg[:, :-1]; edge[:, :-1] |= reg[:, 1:]
edge &= ~reg
lum = sub.mean(axis=2)
alpha[edge] = np.clip((255 - lum[edge]) * 4, 60, 255).astype(np.uint8)
rgba = np.dstack([sub.astype(np.uint8), alpha])

def Y(y):  # original y -> sub row
    return y - Y0

def save(name, arr, x0, y0):
    a = arr[..., 3]
    ys, xs = np.nonzero(a)
    bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    Image.fromarray(arr[by0:by1, bx0:bx1]).save(os.path.join(OUT, name + '.png'))
    return {'name': name, 'x': int(x0 + bx0), 'y': int(y0 + by0), 'w': int(bx1 - bx0), 'h': int(by1 - by0)}

info = {}
yy, xx = np.mgrid[Y0:H, 0:W]

# --- antennas: erase thin masts, they are drawn as spring chains in game ---
for ax in (217, 397):
    m = (xx >= ax - 5) & (xx <= ax + 5) & (yy < 722)
    rgba[m, 3] = 0

# --- split lines ---
SEAM = 838              # hull roof / turret ring line
SKIRT = 982             # side-skirt bottom edge
SPR = (135, 970, 56)    # sprocket centre + cut radius
GUN_X = 952             # barrel starts in front of the mantlet

# turret: above seam, behind gun start
t = rgba.copy()
t[~((yy < SEAM) & (xx < GUN_X + 4))] = 0
info['turret'] = save('turret', t, 0, Y0)

# barrel: in front of mantlet, around the bore line
b = rgba.copy()
b[~((xx >= GUN_X) & (yy > 760) & (yy < 822))] = 0
info['barrel'] = save('barrel', b, 0, Y0)

# hull: below seam, above skirt line, sprocket cut out, front lower ramp cut
h = rgba.copy()
front = 982 - np.clip((xx - 1100) * 0.45, 0, 999)          # skirt lip rises toward the nose
keep = (yy >= SEAM) & (yy < np.minimum(SKIRT, front))
keep &= ~(((xx - SPR[0]) ** 2 + (yy - SPR[1]) ** 2) < SPR[2] ** 2)
keep &= ~((xx < 205) & (yy > 935))
keep &= xx < 1215
h[~keep] = 0
info['hull'] = save('hull', h, 0, Y0)

# road wheel 1 (centre 259,1020, r 47) -> circular sprite
def disc(name, cx, cy, r, keepfn=None):
    s = rgba[Y(cy - r):Y(cy + r) + 1, cx - r:cx + r + 1].copy()
    gy, gx = np.mgrid[-r:r + 1, -r:r + 1]
    rr = np.sqrt(gx ** 2 + gy ** 2)
    a = np.clip((r + 0.5 - rr) * 255, 0, 255)
    if keepfn is not None:
        a = np.where(keepfn(s, rr), a, 0)
    s[..., 3] = np.minimum(s[..., 3], a).astype(np.uint8)
    Image.fromarray(s).save(os.path.join(OUT, name + '.png'))
    return {'name': name, 'r': r}

info['roadwheel'] = disc('roadwheel', 259, 1020, 47)
# sprocket: keep the tan teeth/hub, drop dark track links wrapped around it
def spk(s, rr):
    rgb = s[..., :3].astype(np.int16)
    tan = (rgb[..., 0] - rgb[..., 2] > 35) & (rgb[..., 0] > 90)
    return (rr < 38) | tan
info['sprocket'] = disc('sprocket', 135, 970, 52, spk)

print(json.dumps(info, indent=1))
with open(os.path.join(OUT, 'cut.json'), 'w') as f:
    json.dump(info, f, indent=1)
