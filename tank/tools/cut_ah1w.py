#!/usr/bin/env python3
"""Cut the AH-1W SuperCobra art. Source: assets/ref/ah1w_sheet.png, the "PYLONS INSTALLED" drawing (second
row), 81.7 px/m (rotor radius 7.32 m over ~598 px), origin px (652, 690) under the mast. The drawing faces
left. The "PYLONS REMOVED" drawing above it sits exactly 392 px higher and supplies what is hidden behind the
Hellfires. Markings come from assets/ref/ah1w_markings.png. Outputs in assets/sprites/ah1w/:
  body_l.png   airframe as drawn, mirrored (shown mirrored back when facing left), markings reading correctly
  body.png     the same for facing right: the plain airframe mirrored, markings laid on unmirrored
  rotor.png    two-blade main rotor and head (turned about the mast, px x = 652)
  tailrotor.png  two-blade tail rotor (spun about px (1350, 545)); the fin under it is painted back in
  gun.png      M197 barrels (laid in elevation about the turret, px (296, 768))
  hf_up.png, hf_lo.png  the near launcher's upper and lower Hellfire (fired in turn)
usage: python3 tools/cut_ah1w.py
"""
import os, json
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/sprites/ah1w'); os.makedirs(OUT, exist_ok=True)
SHEET = Image.open(os.path.join(ROOT, 'assets/ref/ah1w_sheet.png')).convert('RGB')
X0, Y0, X1, Y1 = 30, 428, 1448, 845
DY = 392                                                            # clean drawing: same airframe, 392 px higher
im = np.asarray(SHEET.crop((X0, Y0, X1, Y1))).astype(np.int16)
clean = np.asarray(SHEET.crop((X0, Y0 - DY, X1, Y1 - DY))).astype(np.int16)
H, W = im.shape[:2]
yy, xx = np.mgrid[0:H, 0:W]; xx = xx + X0; yy = yy + Y0
mn = im.min(axis=2); chroma = im.max(axis=2) - im.min(axis=2); lum = im.sum(axis=2) // 3

def matte(img):
    """alpha: 0 on the white page (reached from the border) and on any enclosed page white"""
    m = img.min(axis=2); c = img.max(axis=2) - img.min(axis=2)
    white = (m > 228) & (c < 24)
    lab, _ = ndimage.label(white)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    a = np.where(np.isin(lab, list(edge)), 0, 255).astype(np.uint8)
    enc, n = ndimage.label((m > 222) & (c < 22) & (a > 0))           # enclosed page white: only real gaps (big
    if n:                                                           # areas), not the drawing's white highlights
        sz = np.bincount(enc.ravel()); big = np.nonzero(sz > 60)[0]; big = big[big > 0]
        a[np.isin(enc, big)] = 0
    return a

base = matte(im)
base[(yy < 449) & (xx < 1000)] = 0                                  # the upper drawing's skids
base[(xx < 245) & (yy > 800)] = 0                                   # caption box
info = {'ppm': 81.7, 'origin': [652, 690]}
rgb = im.astype(np.uint8).copy()

# ---- main rotor: everything above the airframe's top line (blades, head); the mast stays on the body ----
top = np.where(xx < 528, 600, np.where(xx < 562, 545, np.where((xx >= 604) & (xx < 702), 553, np.where(xx < 760, 529, 560))))   # whole head with its links
rot = (yy < top) & (xx < 1268) & (base > 0)
# ---- tail rotor: the blades lie along one line through the hub; a strip round it plus the hub ----
HX, HY = 1350, 545
ux, uy = np.array([62, -105]) / np.hypot(62, -105)
along = (xx - HX) * ux + (yy - HY) * uy; perp = np.abs((xx - HX) * -uy + (yy - HY) * ux)
yellow = (im[..., 0] > 170) & (im[..., 1] > 140) & (im[..., 2] < 110)
blade = (np.abs(along) < 130) & (perp < 21) & (base > 0) & (((chroma < 45) & (lum < 175)) | (mn > 200) | yellow)
hub = np.hypot(xx - HX, yy - HY) < 15
tr = (blade | hub) & (base > 0)
# the fin under the lower blade: painted back from the fin on either side of the strip
body_a = base.copy(); body_a[rot] = 0
finfill = ndimage.binary_fill_holes(base > 0)
under = (np.abs(along) < 130) & (perp < 24) & (along < -8) & finfill & ~(np.hypot(xx - 1350, yy - 545) < 15)      # the lower blade's strip over the fin
nx, ny = -uy, ux
known = (base > 0) & ~((np.abs(along) < 130) & (perp < 24))           # airframe outside the blade strip
_, (iy, ix) = ndimage.distance_transform_edt(~known, return_indices=True)
# the lower blade lies wholly over the fin: its strip is fin, coloured from the nearest fin pixel
rgb[under] = im[iy[under], ix[under]]; body_a[under] = 255
# fill the strip by blending the fin paint round it (normalised convolution), plus a little grain
kn = (known & (mn < 200) & (chroma > 25)).astype(np.float32)
num = ndimage.gaussian_filter(im.astype(np.float32) * kn[..., None], sigma=(9, 9, 0)); den = ndimage.gaussian_filter(kn, 9)[..., None]
fill = num / np.maximum(den, 1e-3)
grain = ndimage.gaussian_filter(np.random.default_rng(3).normal(0, 3, (H, W)), 0.7)[..., None]
rgb[under] = np.clip(fill[under] + grain[under], 0, 255).astype(np.uint8)
# feather the strip's border into the fin round it
band = ndimage.binary_dilation(under, iterations=3) & ~ndimage.binary_erosion(under, iterations=3) & finfill
soft = ndimage.gaussian_filter(rgb.astype(np.float32), sigma=(1.6, 1.6, 0))
rgb[band] = soft[band].astype(np.uint8)
body_a[(np.abs(along) < 135) & (perp < 21) & (along > 18)] = 0             # upper blade, in the air: all of it
tr = tr | ((np.abs(along) < 135) & (perp < 21) & (along > 18) & (base > 0) & (((chroma < 45) & (lum < 200)) | (mn > 200) | yellow))
body_a[tr & ~under] = 0
body_a[hub] = base[hub]                                              # the gearbox stays on the fin

# ---- M197 barrels: off the airframe, laid in elevation in game ----
gbox = (xx >= 166) & (xx < 286) & (yy >= 757) & (yy < 788)        # the barrels, ahead of the turret housing
tan = (chroma >= 40) & (lum > 110)                                  # the fuselage's paint, which stays
gun = gbox & (base > 0) & ~tan
body_a[gbox & ~tan] = 0

def save(name, alpha, col, mirror=False):
    ys, xs = np.nonzero(alpha); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    out = np.dstack([col, alpha])[y0:y1, x0:x1]
    if mirror: out = out[:, ::-1]
    Image.fromarray(np.ascontiguousarray(out)).save(os.path.join(OUT, name + '.png'))
    info[name] = [int(x0 + X0), int(y0 + Y0), int(x1 - x0), int(y1 - y0)]

save('rotor', np.where(rot, base, 0).astype(np.uint8), im.astype(np.uint8))      # as drawn: the game mirrors it about the mast
_l, _n = ndimage.label(ndimage.binary_dilation(tr, iterations=1)); tr &= _l == (np.bincount(_l.ravel())[1:].argmax() + 1)   # stray specks off
save('tailrotor', np.where(tr, 255, 0).astype(np.uint8), im.astype(np.uint8))
save('gun', np.where(gun, base, 0).astype(np.uint8), im.astype(np.uint8), mirror=True)

# ---- Hellfires: cut out; behind them the clean drawing (fuselage underside, skid strut) shows ----
HF = {'hf_up': (659, 748, 782, 771), 'hf_lo': (657, 776, 783, 796)}
ca = matte(clean)
for name, (hx0, hy0, hx1, hy1) in HF.items():
    sel = (xx >= hx0) & (xx < hx1) & (yy >= hy0) & (yy < hy1)
    save(name, np.where(sel, body_a, 0).astype(np.uint8), rgb, mirror=True)
    body_a[sel] = ca[sel]; rgb[sel] = clean.astype(np.uint8)[sel]
# the empty launcher: what was the frame between and above the missiles stays (drawn in game when empty)

# ---- markings (USMC low-visibility black), placed as on the user's marked-up sheet
# (assets/ref/ah1w_sheet_decals.png): star and bars ahead of the stub wing, MARINES on the tail boom ----
_mk = Image.open(os.path.join(ROOT, 'assets/ref/ah1w_markings.png')).convert('RGBA'); _w = Image.new('RGBA', _mk.size, (255, 255, 255, 255)); _w.alpha_composite(_mk)
MK = np.asarray(_w.convert('RGB')).astype(np.int16)           # (transparent background → white)
MARKS = {   # piece in the marking sheet -> centre in the drawing (px) and width (px)
    'star': ((70, 205, 565, 495), (514, 712), 76),
    'marines': ((635, 255, 1465, 455), (975, 723), 152),
}
def mark_layer():
    lay = np.zeros((H, W, 4), np.float32)
    for k, (box, (cx, cy), w) in MARKS.items():
        f = MK.shape[1] / 2000                                     # boxes measured on a 2000 px wide view
        p = MK[round(box[1] * f):round(box[3] * f), round(box[0] * f):round(box[2] * f)]
        ink = p.min(axis=2) < 120
        shape = ndimage.binary_fill_holes(ndimage.binary_closing(ink, iterations=2)) if k == 'star' else ink
        a = shape.astype(np.float32)
        if k != 'star': a = np.clip((200 - p.min(axis=2)) / 120, 0, 1)
        h = round(p.shape[0] * w / p.shape[1])
        pi = Image.fromarray(np.dstack([p.astype(np.uint8), (a * 255).astype(np.uint8)])).resize((w, h), Image.LANCZOS)
        q = np.asarray(pi).astype(np.float32)
        x0, y0 = cx - w // 2 - X0, cy - h // 2 - Y0
        lay[y0:y0 + h, x0:x0 + w] = q
    return lay
def lay_on(col, alpha, lay):
    a = lay[..., 3:4] / 255 * 0.9 * (alpha[..., None] > 0)
    ink = lay[..., :3] * 0.85                                      # paint, not pure black / white
    shade = col.astype(np.float32).mean(axis=2, keepdims=True) / 200   # keeps the drawing's light and shadow
    return np.clip(col * (1 - a) + ink * np.clip(shade, 0.6, 1.1) * a, 0, 255).astype(np.uint8)

lay = mark_layer()
save('body_l', body_a, lay_on(rgb, body_a, lay), mirror=True)
# facing right: the drawing mirrored, then the markings laid on unmirrored at the mirrored places
rm = rgb[:, ::-1]; am = body_a[:, ::-1]
lay_m = np.zeros_like(lay)
for k, (box, (cx, cy), w) in MARKS.items():
    one = {k: MARKS[k]}
    saved = dict(MARKS); MARKS.clear(); MARKS.update(one); l1 = mark_layer(); MARKS.clear(); MARKS.update(saved)
    ys, xs = np.nonzero(l1[..., 3] > 0); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    patch = l1[y0:y1, x0:x1]; nx0 = W - x1
    lay_m[y0:y1, nx0:nx0 + (x1 - x0)] = np.maximum(lay_m[y0:y1, nx0:nx0 + (x1 - x0)], patch)
col_r = lay_on(rm, am, lay_m)
ys, xs = np.nonzero(am); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
Image.fromarray(np.ascontiguousarray(np.dstack([col_r, am])[y0:y1, x0:x1])).save(os.path.join(OUT, 'body.png'))
info['body'] = info['body_l']
json.dump(info, open(os.path.join(OUT, 'cut.json'), 'w'), indent=1); print(info)
