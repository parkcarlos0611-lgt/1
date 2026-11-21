"""Take the kitchen picture apart into the pieces the game lights and moves (reviews 42, 44).

    python3 tools/places/kitchen.py <kitchen.png>   ->  assets/places/kitchen/{base,lamp,far,setting,regions}.png

The picture is the planner's second kitchen (2026-11-21): even daylight, the lamp off, nothing glowing, so the
painting is kept as it is (no light to divide out). Taken out of it:
- the table's china (butter dish, two cups, the jug) and the steam over the cups: kept as sprites (setting.png) for
  when a customer sits down, and filled in behind (the boards behind run upright, so a column's own pixels above fill
  it; the cloth's checks repeat across, so the check one over fills it)
- the lamp (lamp.png, off as painted; the game lights its bulb): its mask is the pixels unlike the wallpaper filled in
  behind it, cleaned of single stray pixels and pinholes so no fringe of wallpaper comes away with it
- the fields and farmhouse beyond the window (far.png): the game draws its own sky
- a map of what every pixel is (regions.png, red channel = region number, data/places/kitchen.json)
All at 480x270.
"""
import sys, json, os
import numpy as np
from PIL import Image

W, H = 480, 270
root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
out = os.path.join(root, 'assets', 'places', 'kitchen'); os.makedirs(out, exist_ok=True)
D = json.load(open(os.path.join(root, 'data', 'places', 'kitchen.json')))
a = np.asarray(Image.open(sys.argv[1]).convert('RGB').resize((W, H), Image.BOX)).astype(np.float32)
base = a.copy()
C = D['cut']
def rect(r): return r['x0'], r['y0'], r['x1'], r['y1']

def clean(mask, passes=1):
    """drop pixels with fewer than 2 of 4 neighbours set, fill pixels with 3+ set (no fringe, no pinholes)"""
    m = mask.copy()
    for _ in range(passes):
        n = np.zeros(m.shape, np.int32)
        n[1:] += m[:-1]; n[:-1] += m[1:]; n[:, 1:] += m[:, :-1]; n[:, :-1] += m[:, 1:]
        m = (m & (n >= 2)) | (~m & (n >= 3))
    return m

# --- 1. the table: china and steam off, kept as sprites ------------------------------------------------------------
# steam: the boards behind run upright, so the rows just above the steam, repeated downwards, are the boards behind it
for name in ('steam1', 'steam2'):
    x0, y0, x1, y1 = rect(C[name]); src = base[y0 - 9:y0, x0:x1].copy()
    for y in range(y0, y1): base[y, x0:x1] = src[(y - y0) % 9]
edge = C['clothEdge']; cx = C['chairMirror']
for name in ('dish', 'cup1', 'jug', 'cup2'):                    # above the cloth's edge
    x0, y0, x1, y1 = rect(C[name])
    for x in range(x0, x1):
        if name == 'jug' and C['chairX'][0] <= x < C['chairX'][1]:   # the chair is the same both sides: its left half
            for y in range(y0, min(y1, edge)): base[y, x] = base[y, 2 * cx - x]
            continue
        above = base[y0 - 8:y0, x].copy()
        for y in range(y0, min(y1, edge)): base[y, x] = above[(y - y0) % len(above)]
masked = np.zeros((H, W), bool)
for name in ('dish', 'cup1', 'jug', 'cup2'): x0, y0, x1, y1 = rect(C[name]); masked[y0:y1, x0:x1] = True
# on the cloth: the checks repeat across, their spacing growing smoothly towards the front (perspective). The spacing is
# measured to a tenth of a pixel on each row, a straight line fitted through the rows, and the check one spacing over
# copied in (between two pixels, the in-between colour).
ys = list(range(edge, max(r['y1'] for r in (C['dish'], C['cup1'], C['jug'], C['cup2']))))
def shifted(row, p_):
    xs = np.arange(W) - p_; i0 = np.clip(np.floor(xs).astype(int), 0, W - 2); f = (xs - i0)[:, None]
    return row[i0] * (1 - f) + row[i0 + 1] * f
per = []
for y in ys:
    ok = ~masked[y]; ok[:C['clothX'][0] + 14] = False; ok[C['clothX'][1]:] = False
    best = min(((np.abs(base[y] - shifted(base[y], p_))[ok].mean(), p_) for p_ in np.arange(9.0, 13.01, 0.1)))
    per.append(best[1])
fit = np.polyfit(ys, per, 1)
for y in ys:
    p_ = np.polyval(fit, y)
    for x in range(W):
        if not masked[y, x]: continue
        for k in range(1, 8):
            sx = x - k * p_; x0_ = int(np.floor(sx))
            if x0_ >= 0 and not masked[y, x0_] and not masked[y, x0_ + 1]:
                f = sx - x0_; base[y, x] = base[y, x0_] * (1 - f) + base[y, x0_ + 1] * f; break
            sx = x + k * p_; x0_ = int(np.floor(sx))
            if x0_ + 1 < W and not masked[y, x0_] and not masked[y, x0_ + 1]:
                f = sx - x0_; base[y, x] = base[y, x0_] * (1 - f) + base[y, x0_ + 1] * f; break
print('cloth spacing', np.round(per, 1), 'fit', np.round(fit, 3))
setting = np.zeros((H, W, 4), np.uint8)
for name in ('dish', 'cup1', 'jug', 'cup2'):
    x0, y0, x1, y1 = rect(C[name])
    m = np.zeros((H, W), bool); m[y0:y1, x0:x1] = np.abs(a[y0:y1, x0:x1] - base[y0:y1, x0:x1]).sum(2) > C['settingThreshold']
    m = clean(m, 2); setting[m, :3] = a[m]; setting[m, 3] = 255

# --- 2. the lamp: cut out, the wallpaper filled in behind from the same row a repeat or two over --------------------
lx0, ly0, lx1, ly1 = rect(C['lamp']); PW = C['wallPeriod']
filled = base.copy()
for y in range(ly0, ly1):
    for x in range(lx0, lx1):
        k = 1
        while lx0 <= x - k * PW: k += 1
        left = x - k * PW; k2 = 1
        while x + k2 * PW < lx1: k2 += 1
        right = x + k2 * PW
        filled[y, x] = base[y, left] if (x - left) <= (right - x) or right >= W else base[y, right]
m = np.zeros((H, W), bool)
m[ly0:ly1, lx0:lx1] = np.abs(a[ly0:ly1, lx0:lx1] - filled[ly0:ly1, lx0:lx1]).sum(2) > C['lampThreshold']
rx0, rx1 = C['rod']; m[ly0:C['shadeTop'], rx0:rx1] = True          # the rod is thin: take it whole
yy, xx = np.mgrid[0:H, 0:W]; bx, by, brx, bry = D['lamp']['bulb']
bulb = ((xx - bx) / brx) ** 2 + ((yy - by) / bry) ** 2 <= 1
m = (m & ((yy < C['shadeRim']) | bulb)) | bulb                                     # under the rim only the bulb (all of it): the rest is wall
m = clean(m, 2)
lamp = np.zeros((H, W, 4), np.uint8); lamp[m, :3] = a[m]; lamp[m, 3] = 255
base = filled

# --- 3. the window: glass, the far fields kept apart ------------------------------------------------------------------
win = D['window']; gx0, gy0, gx1, gy1 = win['glass']; mx0, mx1 = win['muntinX']; ry0, ry1 = win['railY']; house = win['house']
far = np.zeros((H, W, 4), np.uint8)
for y in range(gy0, gy1):
    for x in range(gx0, gx1):
        if mx0 <= x < mx1 or ry0 <= y < ry1: continue
        sky = a[y, house[0] - 3]
        inhouse = house[0] <= x < house[2] and house[1] <= y < house[3] and np.abs(a[y, x] - sky).sum() > win['houseSky']
        if y >= win['horizon'] or inhouse: far[y, x, :3] = a[y, x]; far[y, x, 3] = 255

# --- 4. regions ---------------------------------------------------------------------------------------------------------
reg = np.full((H, W), D['regionId']['wall'], np.uint8)
for p in D['paint']: x0, y0, x1, y1 = p[1:]; reg[y0:y1, x0:x1] = D['regionId'][p[0]]
for y in range(gy0, gy1):
    for x in range(gx0, gx1):
        if not (mx0 <= x < mx1 or ry0 <= y < ry1): reg[y, x] = D['regionId']['glass']
cx0, cy0, cx1, cy1 = D['chairBack']                              # the chair's back between the boards: brown, not green
for y in range(cy0, cy1):
    for x in range(cx0, cx1):
        r, g, b = base[y, x]
        if r > g + 4: reg[y, x] = D['regionId']['chair']
ground = np.array(D['wallGround'], np.float32)                   # plain wallpaper caught in an object's box: wall again
for name in ('curtain', 'kettle', 'stoveTop', 'fridge'):
    reg[(reg == D['regionId'][name]) & (np.abs(base - ground).sum(2) < D['wallReclaim'])] = D['regionId']['wall']

def save(arr, name, mode): Image.fromarray(arr, mode).save(os.path.join(out, name), optimize=True)
save(np.clip(base, 0, 255).astype(np.uint8), 'base.png', 'RGB')
save(lamp, 'lamp.png', 'RGBA'); save(far, 'far.png', 'RGBA'); save(setting, 'setting.png', 'RGBA')
save(np.stack([reg, reg, reg], 2), 'regions.png', 'RGB')
print('ok', out)
