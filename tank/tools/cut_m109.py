#!/usr/bin/env python3
"""Cut the M109A3 art: the right-facing side drawing of assets/ref/m109a3_sheet.jpg (crop (1760,0)-(2576,420)),
98 px/m (hull 6.19 m). The drawing's gun is raised about 4.3 degrees; the barrel is cut and levelled.
Running gear: face-on road wheel, idler and sprocket from the bottom row of the sheet.
Outputs assets/sprites/m109a3/{hull,turret,barrel,roadwheel,idler,sprocket}.png + cut.json.
usage: python3 tools/cut_m109.py
"""
import os, json, math
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/sprites/m109a3'); os.makedirs(OUT, exist_ok=True)
X0 = 1760

def flood(im, thr=225):
    white = (im.min(axis=2) > thr) & ((im.max(axis=2) - im.min(axis=2)) < 26)
    reg = np.zeros_like(white); reg[0], reg[-1], reg[:, 0], reg[:, -1] = white[0], white[-1], white[:, 0], white[:, -1]
    while True:
        d = reg.copy(); d[1:] |= reg[:-1]; d[:-1] |= reg[1:]; d[:, 1:] |= reg[:, :-1]; d[:, :-1] |= reg[:, 1:]; d &= white
        if (d == reg).all(): break
        reg = d
    return np.where(reg, 0, 255).astype(np.uint8)

sheet = Image.open(os.path.join(ROOT, 'assets/ref/m109a3_sheet.jpg')).convert('RGB')
im = np.asarray(sheet.crop((X0, 0, 2576, 420))).astype(np.int16)
rgba = np.dstack([im.astype(np.uint8), flood(im)])
H, W = rgba.shape[:2]
yy, xx = np.mgrid[0:H, 0:W]; xx = xx + X0
info = {}
def crop(mask):
    a = rgba.copy(); a[~mask] = 0
    ys, xs = np.nonzero(a[..., 3]); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    return a[y0:y1, x0:x1], int(x0 + X0), int(y0)
def save(name, mask):
    a, x, y = crop(mask); Image.fromarray(a).save(os.path.join(OUT, name + '.png')); info[name] = {'x': x, 'y': y, 'w': a.shape[1], 'h': a.shape[0]}

# antennas become spring masts in game
rgba[(xx >= 1804) & (xx <= 1822) & (yy < 132), 3] = 0
rgba[(xx >= 1904) & (xx <= 1920) & (yy < 114), 3] = 0
# white page seen through the stowage basket
wh = (im.min(axis=2) > 236) & ((im.max(axis=2) - im.min(axis=2)) < 14) & (yy < 228) & (rgba[..., 3] > 0)
rgba[wh, 3] = 0

SEAM, SKIRT, GUN_X = 228, 302, 2172
TR = (2150, 180)                                   # trunnion in the drawing
a, bx, by = crop((xx >= GUN_X) & (yy > 125) & (yy < 208))
# level the barrel: rotate about the trunnion by the drawing's elevation
ang = math.degrees(math.atan2(180 - 150, 2555 - 2160))
pad = 60; big = Image.new('RGBA', (a.shape[1] + pad * 2, a.shape[0] + pad * 2), (0, 0, 0, 0)); big.paste(Image.fromarray(a), (pad, pad))
rot = big.rotate(-ang, resample=Image.BICUBIC, center=(TR[0] - bx + pad, TR[1] - by + pad))
ra = np.asarray(rot); ys, xs = np.nonzero(ra[..., 3] > 8)
Image.fromarray(ra[ys.min():ys.max() + 1, xs.min():xs.max() + 1]).save(os.path.join(OUT, 'barrel.png'))
info['barrel'] = {'x': int(bx - pad + xs.min()), 'y': int(by - pad + ys.min()), 'w': int(xs.max() - xs.min() + 1), 'h': int(ys.max() - ys.min() + 1), 'drawn_elev_deg': round(ang, 2)}
save('turret', (yy < SEAM) & (xx < GUN_X + 2))
save('hull', (yy >= SEAM) & (yy < SKIRT))

ws = np.asarray(sheet).astype(np.int16)
wa = np.dstack([ws.astype(np.uint8), flood(ws, 215)])
SIZE = 512
for name, (a0, b0) in (('roadwheel', (1385, 1646)), ('idler', (1689, 1953)), ('sprocket', (2003, 2270))):
    band = wa[590:870, a0 - 6:b0 + 7]; fg = band[..., 3] > 0
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
