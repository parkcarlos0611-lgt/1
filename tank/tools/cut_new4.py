#!/usr/bin/env python3
"""Cut the Challenger 1 Mk.3, AMX-30B2, BMP-1 and 2S1 art (background-free sheets assets/ref/<id>_sheet.png,
right-side profile, facing right) into hull / turret / barrel, and their running gear from
assets/ref/wheels_new4.png (rows: Challenger, AMX-30B2, BMP-1, 2S1; columns: road wheel, idler, sprocket).
The sheets' alpha is near-opaque on the art with a faint halo: alpha < 120 dropped, edges coloured from inside.
Coordinates are sheet pixels (measured on a 10 px grid).   usage: python3 tools/cut_new4.py
The hull is cut down to the road-wheel tops (the shadowed side, suspension and the track's top run come with it);
round the sprocket and idler it follows the traced fender edge, so it covers their tops as drawn; no holes.
"""
import os, json, math
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEAR = {
  'challenger1': ([211.7, 291.7, 371.7, 451.3, 531.3, 606], 576, 30, (125, 552, 24), (690, 551, 22)),
  'amx30b2': ([189.6, 280.4, 369, 458.9, 550], 593, 36, (110, 571, 31), (650, 568, 30)),
  'bmp1': ([245, 327.5, 412.5, 495, 580, 662.5], 565, 32, (752, 541, 27), (155, 541, 24)),
  '2s1': ([220, 292.5, 365, 437.5, 509, 579, 650], 595, 33, (714, 574, 24), (135, 575, 24)),
}
CFG = {
  'challenger1': dict(tspan=(45, 605), tcut=[(30, 470, 160, 492)], box=(30, 380, 925, 615), seam=487, gun_x=572, bore=(448, 486), clear=[],
      bottom=[(30, 530), (95, 531), (135, 544), (162, 554), (182, 562), (200, 566), (660, 566), (699, 554), (735, 544), (760, 544)]),
  'amx30b2': dict(tspan=(55, 578), tcut=[(30, 486, 120, 496)], box=(30, 392, 930, 630), seam=494, gun_x=548, bore=(452, 488), clear=[(440, 360, 590, 396)],
      bottom=[(30, 567), (62, 567), (70, 552), (145, 552), (160, 559), (590, 559), (605, 550), (615, 545), (690, 545), (705, 550), (930, 550)]),
  'bmp1': dict(tspan=(312, 562), box=(60, 380, 880, 610), seam=448, gun_x=470, bore=(422, 438), clear=[],
      bottom=[(60, 560), (92, 560), (100, 521), (190, 521), (207, 535), (698, 535), (715, 522), (740, 521), (770, 527), (795, 545), (880, 545)]),
  '2s1': dict(tspan=(150, 522), box=(75, 390, 885, 640), seam=494, gun_x=518, bore=(452, 488), clear=[],
      bottom=[(75, 563), (98, 563), (102, 550), (163, 550), (180, 563), (681, 563), (690, 553), (720, 553), (745, 555), (790, 580), (885, 580)]),
}

def load(path):
    a = np.asarray(Image.open(os.path.join(ROOT, path)).convert('RGBA')).astype(np.float32)
    al = np.clip((a[..., 3] - 120) / 80, 0, 1); core = al >= 0.99
    _, (iy, ix) = ndimage.distance_transform_edt(~core, return_indices=True)
    rgb = np.where(core[..., None], a[..., :3], a[iy, ix, :3])
    return np.dstack([rgb, al * 255]).astype(np.uint8)

def bottom_at(pts, xs):
    px = [p[0] for p in pts]; py = [p[1] for p in pts]
    return np.interp(xs, px, py)

for vid, c in CFG.items():
    out = os.path.join(ROOT, 'assets/sprites', vid); os.makedirs(out, exist_ok=True)
    sheet = load(f'assets/ref/{vid}_sheet.png')
    x0, y0, x1, y1 = c['box']; A = sheet[y0:y1, x0:x1].copy()
    yy, xx = np.mgrid[y0:y1, x0:x1]
    for cx0, cy0, cx1, cy1 in c['clear']: A[(xx >= cx0) & (xx < cx1) & (yy >= cy0) & (yy < cy1), 3] = 0
    # keep only the vehicle (largest blob) and what touches it
    lab, n = ndimage.label(A[..., 3] > 60); big = np.bincount(lab.ravel())[1:].argmax() + 1
    A[(lab != big) & (lab > 0), 3] = 0
    info = {}
    def save(name, mask):
        a = A.copy(); a[~mask] = 0
        ys, xs = np.nonzero(a[..., 3] > 0); bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        Image.fromarray(a[by0:by1, bx0:bx1]).save(os.path.join(out, name + '.png'))
        info[name] = {'x': int(x0 + bx0), 'y': int(y0 + by0), 'w': int(bx1 - bx0), 'h': int(by1 - by0)}
    bore = (xx >= c['gun_x']) & (yy >= c['bore'][0]) & (yy < c['bore'][1])
    save('barrel', bore)
    tsp = (xx >= c['tspan'][0]) & (xx < c['tspan'][1])
    for a0, b0, a1, b1 in c.get('tcut', []): tsp &= ~((xx >= a0) & (xx < a1) & (yy >= b0) & (yy < b1))      # hull deck under the turret's overhang
    save('turret', (yy < c['seam']) & tsp & ~bore)
    hull = ((yy >= c['seam']) | ~tsp) & (yy < bottom_at(c['bottom'], xx)) & ~bore
    for hx, hy, hr in c.get('holes', []): hull &= ((xx - hx) ** 2 + (yy - hy) ** 2) > hr * hr
    save('hull', hull)
    # the shadowed side under the hull: suspension arms, hubs, shock absorbers and the track's top run, with the
    # road wheels, sprocket and idler taken out (the game draws its own, turning); drawn behind the running gear
    xs_, wy, wr, spk, idl = GEAR[vid]
    und = (yy >= bottom_at(c['bottom'], xx)) & (yy < wy + wr * 0.3) & (xx > min(spk[0], idl[0])) & (xx < max(spk[0], idl[0]))
    for wx in xs_: und &= ((xx - wx) ** 2 + (yy - wy) ** 2) > (wr + 2) ** 2
    for gx, gy, gr in (spk, idl): und &= ((xx - gx) ** 2 + (yy - gy) ** 2) > (gr + 3) ** 2
    save('under', und)
    json.dump(info, open(os.path.join(out, 'cut.json'), 'w'), indent=1)
    print(vid, info)

# ---- running gear ----
W = load('assets/ref/wheels_new4.png')
lab, n = ndimage.label(W[..., 3] > 100)
objs = [(s, i + 1) for i, s in enumerate(ndimage.find_objects(lab))]
objs = [(s, k) for s, k in objs if (s[0].stop - s[0].start) > 150 and (s[1].stop - s[1].start) > 150]
objs.sort(key=lambda o: (o[0][0].start // 150, o[0][1].start))
objs.sort(key=lambda o: (o[0][0].start + o[0][0].stop) / 2)
rows, cur, last = [], [], None
for o in objs:
    cy = (o[0][0].start + o[0][0].stop) / 2
    if last is not None and cy - last > 120: rows.append(cur); cur = []
    cur.append(o); last = cy
rows.append(cur)
order = ['challenger1', 'amx30b2', 'bmp1', '2s1']
for items, vid in zip(rows, order):
    items.sort(key=lambda o: o[0][1].start)
    for (s, k), name in zip(items[-3:], ['roadwheel', 'idler', 'sprocket']):
        wdt = s[1].stop - s[1].start; s = (slice(s[0].start, s[0].start + wdt), s[1])      # the wheel is round: square from the top (drops a caption below)
        a = W[s].copy(); a[lab[s] != k, 3] = 0
        im = Image.fromarray(a).resize((512, 512), Image.LANCZOS)
        arr = np.asarray(im).copy()
        if name != 'sprocket':
            gy, gx = np.mgrid[0:512, 0:512] + 0.5 - 256
            arr[..., 3] = np.minimum(arr[..., 3], np.clip((256 - np.hypot(gx, gy)) * 255, 0, 255)).astype(np.uint8)
        Image.fromarray(arr).save(os.path.join(ROOT, 'assets/sprites', vid, name + '.png'))
        if name == 'sprocket':
            r = 256; prof = [arr[int(r - 0.93 * r * math.sin(t / 720 * 2 * math.pi)), int(r + 0.93 * r * math.cos(t / 720 * 2 * math.pi)), 3] > 128 for t in range(720)]
            st = [t for t in range(720) if prof[t] and not prof[t - 1]]
            print(vid, 'sprocket teeth', len(st))
    print(vid, 'gear', [ (s[1].start, s[0].start) for s, k in items[-3:]])
