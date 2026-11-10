#!/usr/bin/env python3
"""Cut the USMC M60A1 RISE art: the right-facing side drawing of assets/ref/m60a1_views.png (crop
(920,0)-(1754,420)), 92 px/m (hull 6.95 m = 641 px). Running gear from assets/ref/m60a1_wheels.jpg
(first, face-on view of each group).
Outputs assets/sprites/m60a1/{hull,turret,barrel,roadwheel,idler,sprocket}.png + cut.json.
usage: python3 tools/cut_m60.py
"""
import os, json, math
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/sprites/m60a1'); os.makedirs(OUT, exist_ok=True)
X0 = 920

def flood(im, thr=228):
    white = (im.min(axis=2) > thr) & ((im.max(axis=2) - im.min(axis=2)) < 24)
    reg = np.zeros_like(white); reg[0], reg[-1], reg[:, 0], reg[:, -1] = white[0], white[-1], white[:, 0], white[:, -1]
    while True:
        d = reg.copy(); d[1:] |= reg[:-1]; d[:-1] |= reg[1:]; d[:, 1:] |= reg[:, :-1]; d[:, :-1] |= reg[:, 1:]; d &= white
        if (d == reg).all(): break
        reg = d
    return np.where(reg, 0, 255).astype(np.uint8)

src = Image.open(os.path.join(ROOT, 'assets/ref/m60a1_views.png')).convert('RGB').crop((X0, 0, 1754, 420))
im = np.asarray(src).astype(np.int16)
rgba = np.dstack([im.astype(np.uint8), flood(im)])
H, W = rgba.shape[:2]
yy, xx = np.mgrid[0:H, 0:W]; xx = xx + X0             # xx in sheet coordinates
info = {}
def poly(pts):
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon([(x - X0, y) for x, y in pts], fill=1); return np.asarray(m).astype(bool)
def save(name, mask):
    a = rgba.copy(); a[~mask] = 0
    ys, xs = np.nonzero(a[..., 3]); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    Image.fromarray(a[y0:y1, x0:x1]).save(os.path.join(OUT, name + '.png'))
    info[name] = {'x': int(x0 + X0), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0)}

# antennas become spring masts in game: the straight whip and the curved one tied down over the turret
dark = im.sum(axis=2) < 330
rgba[(xx >= 1078) & (xx <= 1092) & (yy < 143), 3] = 0
whip = poly([(1106, 152), (1120, 116), (1146, 86), (1178, 58), (1218, 32), (1276, 4), (1284, 24), (1230, 54), (1192, 80), (1162, 106), (1140, 132), (1130, 152)])
rgba[whip & (dark | (yy < 82)), 3] = 0
rgba[(yy < 112) & (xx < 1188), 3] = 0
# white page seen through the stowage rack, between the whip and the roof, under the machine-gun mount
wh = (im.min(axis=2) > 236) & ((im.max(axis=2) - im.min(axis=2)) < 14) & (yy < 238) & (rgba[..., 3] > 0)
seen = np.zeros_like(wh)
for y, x in zip(*np.nonzero(wh)):
    if seen[y, x]: continue
    st, comp = [(y, x)], []; seen[y, x] = True
    while st:
        cy, cx = st.pop(); comp.append((cy, cx))
        for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
            if 0 <= ny < H and 0 <= nx < W and wh[ny, nx] and not seen[ny, nx]: seen[ny, nx] = True; st.append((ny, nx))
    if len(comp) > 14:
        for cy, cx in comp: rgba[cy, cx, 3] = 0

SEAM, SKIRT, GUN_X = 238, 270, 1424
save('barrel', (xx >= GUN_X) & (yy > 170) & (yy < 215))
save('turret', (yy < SEAM) & (xx < GUN_X + 3) & ~((xx > 1395) & (yy > 225)))
hull = (yy >= SEAM) & (yy < SKIRT)
hull |= poly([(1500, 274), (1578, 262), (1580, 286), (1560, 296), (1520, 282)])      # nose plate ahead of the idler
hull |= poly([(930, 274), (960, 274), (952, 292), (934, 290)])                        # tail plate
save('hull', hull)

# running gear sheet
ws = np.asarray(Image.open(os.path.join(ROOT, 'assets/ref/m60a1_wheels.jpg')).convert('RGB')).astype(np.int16)
wa = np.dstack([ws.astype(np.uint8), flood(ws, 215)])
SIZE = 512
band = wa[int(ws.shape[0] * 0.22):int(ws.shape[0] * 0.9)]; fgb = band[..., 3] > 0
cols = np.nonzero(fgb.sum(axis=0) > 6)[0]
runs, s0, p0 = [], cols[0], cols[0]
for c in cols[1:]:
    if c > p0 + 3: runs.append((s0, p0)); s0 = c
    p0 = c
runs.append((s0, p0)); runs = [r for r in runs if r[1] - r[0] > 80]
print('runs', runs)
# face-on views: the road wheel is the first 0.44 of its (merged) run, the idler and sprocket their own runs
rw = runs[0]; rw = (rw[0], rw[0] + int((rw[1] - rw[0]) * 0.445))
for name, (a, b) in zip(('roadwheel', 'idler', 'sprocket'), (rw, runs[1], runs[4])):
    fg = fgb[:, a:b + 1]; rows = np.nonzero(fg.sum(axis=1) > 4)[0]
    cs = np.nonzero(fg.sum(axis=0) > 4)[0]; a, b = a + cs[0], a + cs[-1]
    cut = band[rows[0]:rows[-1] + 1, a:b + 1]
    arr = np.asarray(Image.fromarray(cut).resize((SIZE, SIZE), Image.LANCZOS)).copy()
    r = SIZE / 2; gy, gx = np.mgrid[0:SIZE, 0:SIZE] + 0.5 - r
    if name != 'sprocket': arr[..., 3] = np.minimum(arr[..., 3], np.clip((r - np.hypot(gx, gy)) * 255, 0, 255)).astype(np.uint8)
    if name == 'idler': arr[(arr[..., :3].min(axis=2) > 225), 3] = 0             # see-through between the spokes
    Image.fromarray(arr).save(os.path.join(OUT, name + '.png'))
    info[name + '_src'] = [int(cut.shape[1]), int(cut.shape[0])]
    if name == 'sprocket':
        prof = [arr[int(r - 0.9 * r * math.sin(k / 720 * 2 * math.pi)), int(r + 0.9 * r * math.cos(k / 720 * 2 * math.pi)), 3] > 128 for k in range(720)]
        st = [k for k in range(720) if prof[k] and not prof[k - 1]]; en = [k for k in range(720) if not prof[k] and prof[k - 1]]
        mids = [(((s0 + next(e for e in en + [x + 720 for x in en] if e > s0)) / 2) % 720) / 2 for s0 in st]
        info['teeth'] = len(st); info['tooth0'] = round(min(mids), 2)
# return roller: face-on view (left third) of assets/ref/m60a1_roller.png
rs = np.asarray(Image.open(os.path.join(ROOT, 'assets/ref/m60a1_roller.png')).convert('RGB')).astype(np.int16)
ra = np.dstack([rs.astype(np.uint8), flood(rs, 215)])[100:, 20:320]
fg = ra[..., 3] > 0; rows = np.nonzero(fg.sum(axis=1) > 4)[0]; cs = np.nonzero(fg.sum(axis=0) > 4)[0]
arr = np.asarray(Image.fromarray(ra[rows[0]:rows[-1] + 1, cs[0]:cs[-1] + 1]).resize((256, 256), Image.LANCZOS)).copy()
gy, gx = np.mgrid[0:256, 0:256] + 0.5 - 128
arr[..., 3] = np.minimum(arr[..., 3], np.clip((128 - np.hypot(gx, gy)) * 255, 0, 255)).astype(np.uint8)
Image.fromarray(arr).save(os.path.join(OUT, 'roller.png'))
json.dump(info, open(os.path.join(OUT, 'cut.json'), 'w'), indent=1); print(info)
