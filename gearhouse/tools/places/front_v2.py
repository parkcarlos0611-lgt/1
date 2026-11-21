"""The front of the house, second edition: the planner's sprites and season backgrounds put in order (reviews 46, 49).

    python3 tools/places/front_v2.py <uploads dir>  ->  assets/places/front2/*.png, data/places/front2_cut.json

From the planner's pictures (2026-11-21):
- sprite sheet: house, garage, a blossoming tree, mailbox, street lamp (transparent, but its solid pixels are 253 not
  255 and its edges half-seen: made solid or gone, the edges' colour freed of the black they were laid on)
- four season backgrounds (the same composition): their skies taken off and kept as sky pictures (the game moves
  them); the ground, the woods and the road kept as the season's ground layer
- a winter without snow: there is none; until there is, it is made from the winter woods with their snow taken off
  the branches and the autumn ground greyed and dulled
- the tree sheet (bare, budding, blossoming, summer, yellow, red, late autumn) and the sheet's own blossoming tree
- the night example: the windows' lamplit insides (curtains, lamps) to light our windows at night
- the winter example: the snow on the roofs, the chimney, the mailbox and the lamp, as a layer laid over when snow lies
- the prop sheet: leaf heaps, snow heaps, puddles (their painted reflections dropped: the game reflects what is there)
The house's left windows are moved to mirror the right pair about the door (the planner's drawing has them pushed
towards the door), the wall and the porch post put back behind them. Everything at 480x270.
"""
import sys, os, json
import numpy as np
from PIL import Image

U = sys.argv[1]
root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
out = os.path.join(root, 'assets', 'places', 'front2'); os.makedirs(out, exist_ok=True)
W, H, FW = 480, 270, 1671.5; k = W / FW
def load(name, mode='RGBA'): return np.asarray(Image.open(os.path.join(U, name + '-image.png')).convert(mode)).astype(np.float32)
def save(arr, name): Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(os.path.join(out, name), optimize=True)
cut = {}

def clean_alpha(a):
    a = a.copy(); a[..., 3] = np.where(a[..., 3] >= 128, 255, 0); return a
def shrink(rgba, scale):
    """down to the screen's size without the black under the edges creeping in; solid or gone"""
    al = rgba[..., 3:4] / 255; pre = np.concatenate([rgba[..., :3] * al, rgba[..., 3:4]], 2)
    h, w = rgba.shape[:2]; im = Image.fromarray(np.clip(pre, 0, 255).astype(np.uint8), 'RGBA').resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.BOX)
    q = np.asarray(im).astype(np.float32); a2 = q[..., 3:4]
    rgb = np.where(a2 > 0, q[..., :3] / np.maximum(a2, 1) * 255, 0); return np.concatenate([np.clip(rgb, 0, 255), np.where(a2 >= 120, 255, 0)], 2)
def bbox(a):
    ys, xs = np.nonzero(a[..., 3] > 0); return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
def place(name, sheet, box, scale, anchor_src, anchor_dst):
    """cut box from the sheet, scale it, and say where its top-left goes so that anchor_src lands on anchor_dst"""
    x0, y0, x1, y1 = box; sub = clean_alpha(sheet[y0:y1, x0:x1]); s = shrink(sub, scale); save(s, name + '.png')
    ax, ay = anchor_src; dx, dy = anchor_dst
    cut[name] = {'at': [round(dx - (ax - x0) * scale, 2), round(dy - (ay - y0) * scale, 2)], 'size': [s.shape[1], s.shape[0]]}
    return s

# --- the house and the garage ----------------------------------------------------------------------------------------
sp = clean_alpha(load('5e5fbd2f'))
HOUSE = (280, 0, 1036, 456); DOOR = 652; WIN = [(360, 216, 470, 360), (481, 216, 591, 360)]; RIGHT = [(756, 216, 866, 360), (877, 216, 987, 360)]
POST = (563, 580); SIDING = (312, 356)
house = sp.copy(); patches = [house[y0:y1, x0:x1].copy() for x0, y0, x1, y1 in WIN]
post = np.median(house[362:430, POST[0]:POST[1]], axis=0)
for x0, y0, x1, y1 in WIN:
    for y in range(y0, y1):
        for x in range(x0, x1):
            house[y, x] = post[x - POST[0]] if POST[0] <= x < POST[1] else house[y, SIDING[0] + (x - SIDING[0]) % (SIDING[1] - SIDING[0])]
moves = []
for (x0, y0, x1, y1), (r0, _, r1, _), p in zip(WIN, reversed(RIGHT), patches):
    nx = int(round(2 * DOOR - r1)); house[y0:y1, nx:nx + (x1 - x0)] = p; moves.append([x0, nx])
cut['windowMoves'] = moves
sH = 810 / 699 * k
place('house', house, HOUSE, sH, (307, 435), (195 * k, 600 * k))
place('garage', sp, (1068, 100, 1626, 440), sH, (1092, 433), (1032 * k, 598 * k))
place('mailbox', sp, (960, 695, 1030, 860), 95 / 149 * k, (995, 852), (510 * k, 715 * k))
place('lamp', sp, (1170, 490, 1236, 862), 390 / 358 * k, (1202, 857), (1578 * k, 752 * k))
place('tree_blossom', sp, (450, 470, 810, 880), 620 / 393 * k, (630, 875), (75 * k, 620 * k))
# the house's windows on the screen: for lighting at night (pane boxes, after the move)
hs = sH; hx = cut['house']['at'][0] - HOUSE[0] * hs; hy = cut['house']['at'][1] - HOUSE[1] * hs
wins = [(nx, 216, nx + 110, 360) for _, nx in moves] + RIGHT
cut['windows'] = [[round(hx + x0 * hs, 1), round(hy + y0 * hs, 1), round(hx + x1 * hs, 1), round(hy + y1 * hs, 1)] for x0, y0, x1, y1 in wins]
cut['doorGlass'] = [round(hx + 628 * hs, 1), round(hy + 230 * hs, 1), round(hx + 676 * hs, 1), round(hy + 290 * hs, 1)]

# --- the tree through the year -------------------------------------------------------------------------------------------
ts = clean_alpha(load('c1f93247'))
cells = {'tree_bare': (0, 440, 0, 440), 'tree_bud': (440, 880, 0, 440), 'tree_summer': (1320, 1774, 0, 440), 'tree_yellow': (0, 440, 440, 887), 'tree_red': (440, 880, 440, 887), 'tree_late': (880, 1320, 440, 887)}
for name, (x0, x1, y0, y1) in cells.items():
    c = ts[y0:y1, x0:x1].copy(); al = c[..., 3] > 0
    # the haze of half-seen colour round the crowns: keep only what is joined to the tree's body (big pieces)
    from collections import deque
    lab = np.zeros(al.shape, np.int32); n = 0; sizes = {}
    for yy, xx in zip(*np.nonzero(al)):
        if lab[yy, xx]: continue
        n += 1; q = deque([(yy, xx)]); lab[yy, xx] = n; cnt = 0
        while q:
            a_, b_ = q.popleft(); cnt += 1
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                y2, x2 = a_ + dy, b_ + dx
                if 0 <= y2 < al.shape[0] and 0 <= x2 < al.shape[1] and al[y2, x2] and not lab[y2, x2]: lab[y2, x2] = n; q.append((y2, x2))
        sizes[n] = cnt
    keep = np.isin(lab, [i for i, s in sizes.items() if s > 400]); c[..., 3] = np.where(keep, 255, 0)
    # colour fringe: red, yellow or green half-pixels at the edge of the crown (the sheet's matting) -> drop the outermost ring
    edge = keep & ~(np.roll(keep, 1, 0) & np.roll(keep, -1, 0) & np.roll(keep, 1, 1) & np.roll(keep, -1, 1))
    loud = (c[..., 0] > 200) & (c[..., 1] < 90) | (c[..., 1] > 200) & (c[..., 2] < 60) & (c[..., 0] > 200)
    c[..., 3] = np.where(edge & loud, 0, c[..., 3])
    bx0, by0, bx1, by1 = bbox(c); base = (int(np.nonzero(c[by1 - 6, :, 3])[0].mean()), by1 - 1)
    place(name, c, (bx0, by0, bx1, by1), 620 / (by1 - by0) * k, base, (75 * k, 620 * k))

# --- the season backgrounds: sky off, ground kept ------------------------------------------------------------------------
BG = {'spring': '5d951db7', 'summer': 'ed9b03a0', 'autumn': '06e31471', 'winter_snow': '17779299'}
def sky_mask(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]; mx, mn = a[..., :3].max(2), a[..., :3].min(2); lum = a[..., :3].mean(2)
    skyish = ((mx - mn) < 34) & (lum > 95) & (b >= r - 6) | ((b > r + 15) & (lum > 110))
    m = np.zeros(lum.shape, bool); top = int(0.40 * a.shape[0])
    m[:top] = True
    first = []
    for x in range(a.shape[1]):                      # down each column from the top: sky until the first thing that is not
        y = top
        while y < int(0.66 * a.shape[0]) and skyish[y, x]: m[y, x] = True; y += 1
        first.append(y)
    cap = int(np.median(first)) + 6                  # but no deeper than just under the line of the woods (bare winter woods
    m[cap:] = False                                  # are grey enough to pass for sky)
    # the line of the woods smoothed: the highest crown near each column (bare branches reach up thinly; the sky between
    # them stays in the picture with them, so the woods' top is a line of crowns, not a comb)
    f = np.minimum(np.array(first), cap); line = np.array([f[max(0, x - 6):x + 7].min() for x in range(len(f))])
    line = np.array([int(np.median(line[max(0, x - 3):x + 4])) for x in range(len(line))])
    for x in range(a.shape[1]): m[line[x]:, x] = False
    return m
def matte(a, m, lo=16, span=46):
    """soft coverage for the woods against the painted sky (review 50): the sky's colour just above the woods, column by
    column, is the background; how far a pixel is from it is how much of it is tree. Its colour is freed of the sky in it,
    so the game's own sky shows through the gaps between the branches, softly, with no hard steps"""
    Hh, Ww = m.shape; first = np.array([np.argmax(~m[:, x]) if (~m[:, x]).any() else Hh for x in range(Ww)])
    B = np.zeros((Ww, 3), np.float32)
    for x in range(Ww): y = max(4, int(first[x])); B[x] = a[y - 4:y, x].mean(0)
    B = np.stack([np.convolve(np.pad(B[:, c], 12, mode='edge'), np.ones(25) / 25, 'valid') for c in range(3)], 1)
    top = int(np.percentile(first, 2)) - 6; bottom = int(np.percentile(first, 90)) + 14
    alpha = np.where(m, 0.0, 1.0).astype(np.float32); rgb = a.copy()
    for y in range(max(0, top), min(Hh, bottom)):
        d = np.abs(a[y] - B).sum(1); al = np.clip((d - lo) / span, 0, 1)
        if y > bottom - 8: al = np.maximum(al, (y - (bottom - 8)) / 8)
        alpha[y] = al; ok = al > 0.04; rgb[y, ok] = np.clip(B[ok] + (a[y, ok] - B[ok]) / al[ok, None], 0, 255)
    alpha[:max(0, top)] = 0
    return rgb, alpha

skies = {}
for name, f in BG.items():
    a = np.asarray(Image.open(os.path.join(U, f + '-image.png')).convert('RGB').resize((W, H), Image.BOX)).astype(np.float32)
    m = sky_mask(a); rgb, al = matte(a, m)
    g = np.concatenate([rgb, al[..., None] * 255], 2); save(g, 'ground_' + name + '.png')
    # the sky picture: its rows down to the woods; behind the trees, the sky above carried down
    SH = 180; sky = a[:SH].copy()
    for x in range(W):
        lowest = max([y for y in range(SH) if m[y, x]] or [0])
        for y in range(lowest + 1, SH): sky[y, x] = sky[max(0, lowest - (y - lowest) % max(1, lowest)), x]
    # its two ends blended into each other so it can scroll for ever
    # made seamless: the first band blended into what follows the last column, so the picture repeats every W - band
    # columns without a join; then stretched back to the screen's width
    band = 64; L_ = W - band; tile = sky[:, :L_].copy()
    for i in range(band):
        f_ = i / band; tile[:, i] = sky[:, i] * f_ + sky[:, L_ + i] * (1 - f_)
    pad = 16; wrapped = np.concatenate([tile[:, -pad:], tile, tile[:, :pad]], 1); sc_ = W / L_   # stretched with its own ends round it
    big = np.asarray(Image.fromarray(np.clip(wrapped, 0, 255).astype(np.uint8)).resize((round(wrapped.shape[1] * sc_), sky.shape[0]), Image.BICUBIC)).astype(np.float32)
    o_ = round(pad * sc_); sky = big[:, o_:o_ + W]
    if name != 'winter_snow' or True: skies[name] = sky
    save(sky, 'sky_' + name.replace('_snow', '') + '.png')

# winter without snow: the winter woods with the snow off their branches, over the autumn ground greyed
ws = np.asarray(Image.open(os.path.join(U, BG['winter_snow'] + '-image.png')).convert('RGB').resize((W, H), Image.BOX)).astype(np.float32)
au = np.asarray(Image.open(os.path.join(U, BG['autumn'] + '-image.png')).convert('RGB').resize((W, H), Image.BOX)).astype(np.float32)
wb = au.copy(); lum = au.mean(2, keepdims=True); wb = lum + (au - lum) * 0.35; wb *= np.array([0.92, 0.9, 0.88])
woods = slice(100, 165); snowy = ws[woods].copy(); L = snowy.mean(2); white = (L > 150) & ((snowy.max(2) - snowy.min(2)) < 40)
for y, x in zip(*np.nonzero(white)):
    y0_, y1_ = max(0, y - 2), min(snowy.shape[0], y + 3); x0_, x1_ = max(0, x - 2), min(W, x + 3); win = snowy[y0_:y1_, x0_:x1_]; wl = win.mean(2)
    dark = win[wl < 120]; snowy[y, x] = dark.mean(0) if len(dark) else [96, 90, 86]
dk = snowy.mean(2) < 118; snowy[dk] = snowy[dk] * np.array([1.08, 0.97, 0.86])   # the branches warmer (brown, not the snow's blue); the sky between them as painted
wb[woods] = snowy
m = sky_mask(ws)
rgb, al = matte(wb, m, 5, 22); save(np.concatenate([rgb, al[..., None] * 255], 2), 'ground_winter_bare.png')

# --- the winter example's snow on the roofs, chimney, mailbox and lamp ----------------------------------------------------
we = np.asarray(Image.open(os.path.join(U, '7d8d0e8b-image.png')).convert('RGB')).astype(np.float32)
L = we.mean(2); sat = we.max(2) - we.min(2); snow = (L > 188) & (sat < 46)
zone = np.zeros(snow.shape, bool)
for x0, y0, x1, y1 in [(150, 100, 1050, 330), (1000, 210, 1680, 340), (760, 125, 860, 175), (480, 600, 545, 650), (1540, 350, 1620, 400)]: zone[y0:y1, x0:x1] = True
caps = np.concatenate([we, np.where(snow & zone, 255, 0)[..., None]], 2)
save(shrink(caps, k), 'snowcaps.png'); cut['snowcaps'] = {'at': [0, 0]}

# --- the night example's lamplit windows -------------------------------------------------------------------------------------
ne = np.asarray(Image.open(os.path.join(U, '4dca4034-image.png')).convert('RGB').resize((W, H), Image.BOX)).astype(np.float32)
OLD = [(266, 352, 378, 512), (401, 352, 518, 512), (723, 352, 836, 512), (862, 352, 976, 512)]
for i, (x0, y0, x1, y1) in enumerate(OLD):
    a = ne[round(y0 * k):round(y1 * k), round(x0 * k):round(x1 * k)]; save(a, f'nightwin_{i}.png')
cut['nightwin'] = [[round(x0 * k), round(y0 * k), round(x1 * k), round(y1 * k)] for x0, y0, x1, y1 in OLD]

# --- props: leaf heaps, snow heaps, puddles --------------------------------------------------------------------------------
pr = clean_alpha(load('4af3cc02'))
rows = {'leaves': (200, 340), 'snowpile': (390, 630), 'puddle': (750, 930)}
for name, (y0, y1) in rows.items():
    for i, (x0, x1) in enumerate([(40, 470), (470, 1000), (1000, 1520)]):
        c = pr[y0:y1, x0:x1].copy()
        if c[..., 3].max() == 0: continue
        bx0, by0, bx1, by1 = bbox(c); c = c[by0:by1, bx0:bx1]
        if name == 'puddle':   # its shape and rim only: the inside is where the game draws what the water mirrors
            L = c[..., :3].mean(2); inner = (c[..., 3] > 0) & (L < 175) & (c[..., 2] > c[..., 0] - 10)
            c[..., 3] = np.where(c[..., 3] > 0, np.where(inner, 128, 255), 0)
        s = shrink(c, 0.17 if name != 'snowpile' else 0.2); save(s, f'{name}_{i}.png'); cut[f'{name}_{i}'] = {'size': [s.shape[1], s.shape[0]]}

json.dump(cut, open(os.path.join(root, 'data', 'places', 'front2_cut.json'), 'w'), indent=1)
print(json.dumps({k_: v for k_, v in cut.items() if k_ in ('house', 'garage', 'mailbox', 'lamp', 'tree_blossom', 'windows')}))
