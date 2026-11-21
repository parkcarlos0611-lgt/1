"""Take the kitchen reference picture apart into the pieces the game lights and moves (review 42).

    python3 tools/places/kitchen.py <reference.png>   ->  assets/places/kitchen/{base,lamp,far,regions}.png

- base.png: the room with nothing that changes baked in: the cups, the teapot, the jug and their steam are taken off the
  table, the lamp's pool of light is taken off the wall, the lamp is taken off (the wallpaper filled in behind it).
  What is left is the room under even light: the game multiplies it by the light it works out.
- lamp.png: the hanging lamp on its own (alpha), drawn swinging; the game finds the bulb by its brightness.
- far.png: the fields and the farmhouse seen through the window (alpha), drawn under the game's own sky.
- regions.png: what every pixel is (red channel = region number, see data/places/kitchen.json).
All at 480x270, the game's size; the colours are kept (the game dithers to 15-bit colour when it draws).
"""
import sys, json, os
import numpy as np
from PIL import Image, ImageFilter

W, H = 480, 270
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, '..', '..'))
out = os.path.join(root, 'assets', 'places', 'kitchen')
os.makedirs(out, exist_ok=True)
D = json.load(open(os.path.join(root, 'data', 'places', 'kitchen.json')))
src = Image.open(sys.argv[1]).convert('RGB').resize((W, H), Image.BOX)
a = np.asarray(src).astype(np.float32)
base = a.copy()

def gblur(x, r):
    k = np.exp(-0.5 * (np.arange(-3 * r, 3 * r + 1) / r) ** 2); k /= k.sum()
    x = np.apply_along_axis(lambda v: np.convolve(v, k, 'same'), 0, x)
    return np.apply_along_axis(lambda v: np.convolve(v, k, 'same'), 1, x)

def rect(name): r = D['cut'][name]; return r['x0'], r['y0'], r['x1'], r['y1']

# --- 1. the things on the table -------------------------------------------------------------------------------------
# steam: the wainscot behind runs in vertical boards, so each column's middle value is the board without the steam
for name in ('steam1', 'steam2'):
    x0, y0, x1, y1 = rect(name)
    for x in range(x0, x1):
        col = base[y0 - 8:y1, x]; med = np.median(col, axis=0); lum = col.mean(1); ml = np.median(lum)
        for y in range(y0, y1):
            if base[y, x].mean() > ml + 6: base[y, x] = med
# the china: above the cloth's edge, repeat the boards from just above; on the cloth, repeat the checks one check over
cloth_y = D['cut']['clothEdge']
for name in ('teapot', 'cup1', 'jug', 'cup2'):
    x0, y0, x1, y1 = rect(name)
    for y in range(y0, min(y1, cloth_y)):
        for x in range(x0, x1): base[y, x] = base[y0 - 1 - ((y - y0) % 5), x]
P = D['cut']['clothPeriod']
for name in ('teapot', 'cup1', 'jug', 'cup2'):
    x0, y0, x1, y1 = rect(name)
    for y in range(cloth_y, y1):
        for x in range(x0, x1): base[y, x] = base[y, x - P * (1 + (x - x0) // P)]

# --- 2. the lamp's light on the wall: taken off with the rest of the painter's light in step 6 --------------------------
lx0, ly0, lx1, ly1 = rect('lamp')

# --- 3. the lamp, cut out; the wallpaper filled in behind -------------------------------------------------------------
PW = D['cut']['wallPeriod']
lamp_rgba = np.zeros((H, W, 4), np.uint8)
filled = base.copy()
for y in range(ly0, ly1):
    for x in range(lx0, lx1):
        k = 1
        while lx0 <= x - k * PW < lx1: k += 1
        filled[y, x] = base[y, x - k * PW] if x - k * PW >= 0 else base[y, x + k * PW]
diff = np.abs(a[ly0:ly1, lx0:lx1] - filled[ly0:ly1, lx0:lx1]).sum(2)
for y in range(ly0, ly1):
    for x in range(lx0, lx1):
        if diff[y - ly0, x - lx0] > D['cut']['lampThreshold']:
            lamp_rgba[y, x, :3] = a[y, x]; lamp_rgba[y, x, 3] = 255
base = filled

# --- 4. the window: what is glass, the far fields kept apart -----------------------------------------------------------
win = D['window']; gx0, gy0, gx1, gy1 = win['glass']
far_rgba = np.zeros((H, W, 4), np.uint8)
for y in range(gy0, gy1):
    for x in range(gx0, gx1):
        if win['muntinX'][0] <= x < win['muntinX'][1] or win['railY'][0] <= y < win['railY'][1]: continue
        r, g, b = a[y, x]
        horizon = win['horizon']
        house = win['house']
        # the farmhouse stands above the horizon: its pixels are those unlike the sky at the same height beside it
        sky = a[y, house[0] - 3]
        inhouse = house[0] <= x < house[2] and house[1] <= y < house[3] and np.abs(a[y, x] - sky).sum() > win['houseSky']
        if y >= horizon or inhouse:
            far_rgba[y, x, :3] = a[y, x]; far_rgba[y, x, 3] = 255

# --- 5. regions --------------------------------------------------------------------------------------------------------
reg = np.full((H, W), D['regionId']['wall'], np.uint8)
def paint(name, r):
    x0, y0, x1, y1 = r; reg[y0:y1, x0:x1] = D['regionId'][name]
for p in D['paint']: paint(p[0], p[1:])
for y in range(gy0, gy1):
    for x in range(gx0, gx1):
        if not (win['muntinX'][0] <= x < win['muntinX'][1] or win['railY'][0] <= y < win['railY'][1]): reg[y, x] = D['regionId']['glass']
# the chair's back shows between the boards above the table: the boards are green, the chair is brown
cx0, cy0, cx1, cy1 = D['chairBack']
for y in range(cy0, cy1):
    for x in range(cx0, cx1):
        r, g, b = base[y, x]
        if r > g + 6: reg[y, x] = D['regionId']['chair']

# --- 6. the wall under even light ----------------------------------------------------------------------------------------
# the painter lit the whole wall from the lamp; the game lights it itself, so the broad light is divided out: the wall's
# brightness blurred over its own pixels only (normalised blur), brought to one level; the paper's small pattern stays.
for part in ('wall', 'wainscot'):
    m = (reg == D['regionId'][part]).astype(np.float32); R = D['flatten']['radius']; norm = np.maximum(gblur(m, R), 1e-3)
    for c in range(3):
        ch = base[..., c]; ill = gblur(ch * m, R) / norm; target = np.percentile(ch[m > 0], D['flatten']['level'])
        base[..., c] = np.where(m > 0, ch * (target / np.maximum(ill, 1)) ** D['flatten']['strength'], ch)

# --- 7. the wallpaper, printed again -----------------------------------------------------------------------------------
# the painter's lamp left a hot spot the blur cannot take out, and the paper's motifs wander (the picture was generated).
# So the paper is printed again: its ground colour and its little trefoil (the median of the motifs found on a clean
# stretch) on a regular staggered lattice, as a 90s artist would have drawn it. Pixels of plain paper caught inside an
# object's box (round the kettle, the curtains, the window) are given back to the wall first.
WP = D['wallpaper']; ground = np.array(WP['ground'], np.float32)
flat = base.copy()
for name in WP['reclaim']:
    for p in D['paint']:
        if p[0] != name: continue
        x0, y0, x1, y1 = p[1:]
        sub = flat[y0:y1, x0:x1]; near = np.abs(sub - ground).sum(2) < WP['reclaimDistance']
        r = reg[y0:y1, x0:x1]; r[near & (r == D['regionId'][name])] = D['regionId']['wall']
wall = reg == D['regionId']['wall']
base[wall] = ground
motif = [(dx, dy, np.array(c, np.float32)) for dx, dy, c in WP['motif']]
j = 0
while WP['y0'] + j * WP['dy'] < H + 4:
    yc = WP['y0'] + j * WP['dy']; xs = WP['x0'] + (WP['stagger'] if j % 2 else 0)
    i = -1
    while xs + i * WP['dx'] < W + 4:
        cx, cy = int(round(xs + i * WP['dx'])), int(round(yc))
        for dx, dy, c in motif:
            x, y = cx + dx, cy + dy
            if 0 <= x < W and 0 <= y < H and wall[y, x]: base[y, x] = c
        i += 1
    j += 1

def save(arr, name, mode): Image.fromarray(arr, mode).save(os.path.join(out, name), optimize=True)
save(np.clip(base, 0, 255).astype(np.uint8), 'base.png', 'RGB')
save(lamp_rgba, 'lamp.png', 'RGBA'); save(far_rgba, 'far.png', 'RGBA')
save(np.stack([reg, reg, reg], 2), 'regions.png', 'RGB')
print('ok', out)
