"""The 1928 Chevrolet National AB sedan, made by hand (conversion trial, docs/systems/62_direct_model_guide.md).
Starts from the automatic draft (draft/chevAB_auto.json) and redraws the parts the draft has wrong. Each part is
traced off the sheet: a seed point inside the part on the 4x enlarged view (the same pixel coordinates as the overlay
ov_side.png), the region of like colour round it, clipped to the part's own reach, its outline simplified; a symmetric
part in the front, rear or top view is traced on one side and mirrored.

  python3 chevAB.py  ->  chevAB.json
"""
import json, math, copy, cv2, numpy as np
K = 4
m = json.load(open('draft/chevAB_auto.json')); m['id'] = 'chevAB'; m['name'] = '1928 light sedan'; m['year'] = 1928
L, W, H = m['length'], m['width'], m['height']; C = W / 2
VIEW = {}
for name, key, across in (('left', 'side', L), ('front', 'front', W), ('rear', 'rear', W), ('top', 'top', L)):
    im = cv2.imread(f'v_{name}.png', cv2.IMREAD_UNCHANGED); h, w = im.shape[:2]
    big = cv2.resize(im, (w * K, h * K), interpolation=cv2.INTER_NEAREST)
    up = H if key != 'top' else W
    VIEW[key] = {'img': big, 'w': w, 'h': h, 'sx': across / w, 'sy': up / h}
P = {p['id']: p for p in m['parts']}
AX = {'side': ('x', 'z'), 'front': ('y', 'z'), 'rear': ('y', 'z'), 'top': ('x', 'y')}


def to_mm(key, x, y):
    """a point on the 4x view -> the view's axes in mm (side x,z; front/rear y from the centre line, z; top x, y)"""
    V = VIEW[key]; px, py = x / K, y / K
    if key == 'side': return [px * V['sx'], (V['h'] - py) * V['sy']]
    if key == 'top': return [px * V['sx'], (V['h'] - py) * V['sy'] - C]
    return [px * V['sx'] - C, (V['h'] - py) * V['sy']]


import sys; sys.path.insert(0, '/home/user/1/gearhouse/tools/ref'); from trace import classify
CLS = {}
def classes(key):
    if key not in CLS:
        img = VIEW[key]['img']; rgb = cv2.cvtColor(img[..., :3], cv2.COLOR_BGR2RGB); a = img[..., 3] > 127
        small = cv2.resize(rgb, (VIEW[key]['w'], VIEW[key]['h']), interpolation=cv2.INTER_AREA); sa = cv2.resize(a.astype(np.uint8), (VIEW[key]['w'], VIEW[key]['h']), interpolation=cv2.INTER_NEAREST) > 0
        out, M, _ = classify(small, sa); CLS[key] = (cv2.resize(out, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_NEAREST), M)
    return CLS[key]
def region(key, seed, tol=26, clip=None, close=3, eps=1.2, light=None, out=(), alpha=False, hull=False, cls=None):
    """the like-coloured region round a seed (4x pixels), inside clip=(x0, y0, x1, y1), as a polygon in mm"""
    img = VIEW[key]['img']; rgb = img[..., :3].copy(); a = img[..., 3] > 127
    if cls: lab0, M = classes(key); msk = np.isin(lab0, [M[c] for c in cls]).astype(np.uint8)
    elif alpha: msk = a.astype(np.uint8)
    elif light is not None:                                                 # a region by brightness alone (glass, chrome)
        lum = cv2.cvtColor(rgb, cv2.COLOR_BGR2GRAY); msk = ((lum >= light[0]) & (lum <= light[1]) & a).astype(np.uint8)
    else:
        ff = np.zeros((rgb.shape[0] + 2, rgb.shape[1] + 2), np.uint8); flags = 8 | cv2.FLOODFILL_MASK_ONLY | cv2.FLOODFILL_FIXED_RANGE | (255 << 8)
        cv2.floodFill(rgb, ff, tuple(seed), (0, 0, 0), (tol,) * 3, (tol,) * 3, flags); msk = (ff[1:-1, 1:-1] > 0) & a; msk = msk.astype(np.uint8)
    if clip: c = np.zeros_like(msk); x0, y0, x1, y1 = clip; c[y0:y1, x0:x1] = 1; msk &= c
    for cx, cy, r in out: cv2.circle(msk, (int(cx), int(cy)), int(r), 0, -1)
    msk = cv2.morphologyEx(msk, cv2.MORPH_CLOSE, np.ones((close * 2 + 1,) * 2, np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(msk, 8); k = lab[seed[1], seed[0]] if lab[seed[1], seed[0]] else int(np.argmax(st[1:, 4])) + 1
    msk = (lab == k).astype(np.uint8); cs, _ = cv2.findContours(msk, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea); c = cv2.convexHull(c) if hull else c; c = cv2.approxPolyDP(c, eps * K / 2, True).reshape(-1, 2)
    return [to_mm(key, x, y) for x, y in c]


def mirror_half(key, pts):
    """keep the half on the car's left of the centre line (negative across) and mirror it"""
    from shapely.geometry import Polygon, box
    from shapely.affinity import scale
    from shapely.ops import unary_union
    k = 1 if key == 'top' else 0; g = Polygon(pts).buffer(0); big = 1e5
    half = g.intersection(box(-big, -big, 0, big) if k == 0 else box(-big, -big, big, 0))
    u = unary_union([half, scale(half, xfact=-1 if k == 0 else 1, yfact=-1 if k == 1 else 1, origin=(0, 0))]).buffer(0)
    if u.geom_type != 'Polygon': u = max(u.geoms, key=lambda q: q.area)
    return [[round(x), round(y)] for x, y in list(u.exterior.coords)[:-1]]


def put(pid, key, pts, smooth=False):
    """set a part's outline in one view from points in that view's mm axes; its sheet box follows, its common box is
    the mean of its views"""
    p = P[pid]; xs, ys = [q[0] for q in pts], [q[1] for q in pts]; nb = [round(min(xs)), round(max(xs)), round(min(ys)), round(max(ys))]
    p['outlines'][key] = [[round((x - nb[0]) / max(1, nb[1] - nb[0]), 4), round((y - nb[2]) / max(1, nb[3] - nb[2]), 4), 0 if smooth else 1] for x, y in pts]
    p.setdefault('sheet', {})[key] = nb; got = {}
    for v, sb in p['sheet'].items():
        a, b = AX[v]; got.setdefault(a, []).append(sb[0:2]); got.setdefault(b, []).append(sb[2:4])
    for ax, g in got.items():
        if ax == 'y': g = [[abs(t[0]) if t[0] >= 0 else 0, max(abs(t[0]), abs(t[1]))] if t[0] < 0 < t[1] else [min(abs(t[0]), abs(t[1])), max(abs(t[0]), abs(t[1]))] for t in g]
        p['box'][ax] = [round(sum(t[0] for t in g) / len(g)), round(sum(t[1] for t in g) / len(g))]


# ---------------- side view (4x pixels of v_left, as ov_side.png) ----------------
# the tyres (4x pixels): the wings and the tyres are the same black, so the tyres are left out of every wing
TF, TR, SP = (266, 656, 186), (1502, 656, 186), (1790, 520, 80)
S = lambda *q: [to_mm('side', x, y) for x, y in q]
SP = lambda *q: [to_mm('side', x * K, y * K) for x, y in q]                       # points read off the gridded zoom (source pixels)
put('fenderF', 'side', SP((17, 131), (20, 124), (27, 118), (37, 112), (50, 108), (65, 106), (80, 107), (95, 111), (108, 118), (118, 126), (126, 136), (134, 146), (142, 154),
                          (150, 160), (160, 165), (172, 169), (190, 172), (190, 182), (165, 180), (150, 175), (140, 168), (132, 160), (124, 150), (116, 138), (108, 128),
                          (95, 120), (80, 116), (65, 114), (50, 116), (35, 120), (25, 128)), smooth=True)   # the crest swept down to the running board, its band over the tyre
put('fenderR', 'side', SP((318, 178), (322, 165), (326, 152), (332, 140), (340, 130), (350, 122), (362, 115), (375, 110), (388, 108), (400, 110), (412, 116), (422, 126),
                          (430, 138), (436, 150), (440, 160), (444, 168), (448, 174), (452, 176), (446, 170), (440, 165), (432, 150), (424, 136), (415, 125), (402, 117),
                          (388, 114), (372, 116), (358, 121), (346, 130), (338, 142), (332, 156), (330, 170), (328, 178)), smooth=True)
put('board', 'side', region('side', (1000, 655), clip=(640, 600, 1290, 700), cls=('black', 'line', 'chrome', 'white'), close=4))
# the bonnet and the cowl: the blue between the shell, the windscreen and the wings
put('hood', 'side', region('side', (500, 300), clip=(300, 245, 662, 560), cls=('paint', 'line'), close=5))
put('cowl', 'side', region('side', (725, 360), clip=(658, 236, 796, 575), cls=('paint', 'line'), close=5))
# the body: the car's outline from the windscreen to the tail, from the roof's edge down to the sill (glass, frames and
# the black top lie on it)
put('roof', 'side', S((712, 76), (735, 52), (770, 40), (800, 14), (900, 8), (1400, 4), (1640, 6), (1700, 16), (1738, 40), (1752, 80), (1752, 290), (1700, 292),
                      (1700, 70), (1640, 66), (780, 66), (760, 80)), smooth=True)   # the black top: visor, crown, and the rear quarter down to the belt
# the nickel radiator shell and the head lamp
put('shell', 'side', region('side', (265, 350), clip=(228, 245, 306, 600), light=(120, 255), hull=True))
put('lamp', 'side', region('side', (200, 350), clip=(150, 288, 246, 412), alpha=True, hull=True), smooth=True)
# the side glass, the full size of the openings, and a slim black surround round each
for k, seed, clip in ((0, (950, 170), (820, 85, 1085, 262)), (1, (1250, 170), (1150, 85, 1345, 262)), (2, (1500, 170), (1440, 85, 1620, 262))):
    g = np.array(region('side', seed, clip=clip, light=(150, 255), close=2, hull=True), np.float32)
    put(f'glass{k}', 'side', [[float(x), float(y)] for x, y in g])
    cx, cy = g.mean(0); pad = 34
    put(f'wframe{k}', 'side', [[float(x + np.sign(x - cx) * pad), float(y + np.sign(y - cy) * pad)] for x, y in g]); P[f'wframe{k}']['material'] = 'black'
# the black top comes down the sides on this car: over the window band, the pillars and the rear quarter to the belt.
# A part of its own lying on the body (the frames and the glass lie on it)
body = P['body']; q = copy.deepcopy(P['roof']); q.update({'id': 'quarter', 'element': 'roof', 'material': 'canvas', 'surface': 'side', 'on': 'body', 'pair': True})
q['outlines'] = {}; q['sheet'] = {}; q['box'] = {'x': list(body['box']['x']), 'y': [body['box']['y'][1] - 2, body['box']['y'][1]], 'z': list(body['box']['z'])}
m['parts'].insert(m['parts'].index(body) + 1, q); P['quarter'] = q
put('quarter', 'side', S((792, 55), (1752, 55), (1752, 292), (1640, 292), (1640, 268), (792, 268)))
for k in range(3): P[f'wframe{k}']['on'] = 'quarter'
m['canvas'] = '#2a2a2d'                      # the black top as it reads in the lit sheet (the draft's sample took its grey highlight)
P['lamp']['material'] = 'black'             # the head lamp's shell is black enamel; its rim and glass stay nickel and glass
json.dump(m, open('chevAB.json', 'w'))
print('ok', len(m['parts']))
