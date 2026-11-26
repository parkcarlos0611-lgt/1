"""The 1935 roadster (sheet 51747984, the right-hand car) as one 3D part model, made by hand in the way of
tools/ref/sedan29_model.py: every part is a box in the car's space (x from the front back, y from the centre line
outwards, z up; mm) and its outline as the sheet shows it from the side, the front or rear, and above. Outlines are read
point by point off gridded enlargements of the sheet's views (work/grid.py), in pixel positions on a 4x enlargement of
each view (S side, F front, B rear, T plan). Body-layer parts are written from scratch; the chassis-layer parts are the
converter's draft's, moved onto this car's wheels.

  python3 bmw315.py <views dir> <out json> [draft json] [repository root]"""
import sys, os, json, math
HERE = os.path.dirname(os.path.abspath(__file__))
VIEWS, OUT = sys.argv[1], sys.argv[2]
DRAFT = sys.argv[3] if len(sys.argv) > 3 else f'{HERE}/draft/bmw315.json'
REPO = sys.argv[4] if len(sys.argv) > 4 else '/home/user/1/gearhouse'
sys.path.insert(0, f'{REPO}/tools/ref')
import cv2, numpy as np
from zkit import View, fit_closed
from shapely.geometry import Polygon, box as sbox
from shapely.affinity import scale as sscale
from shapely.ops import unary_union

# ---- scale: the tyres' middle row on the 4x side view runs 80..548 and 1556..2020: centres 314 and 1788, radius 233;
# 1474 units are the 2400 mm wheelbase ----
K = 2400 / (1788 - 314)                                   # 1.628 mm per unit (6.51 mm a pixel)
SW, SH, FW, FH, BW, BH, TW, TH = 2232, 816, 1104, 880, 1192, 844, 2176, 856   # the views in 4x units (558x204, 276x220, 298x211, 544x214 px)
L, H, W = round(SW * K), round(SH * K), 1440             # width: the plan at its own length scale gives 1430; the real car is 1440
C = W / 2
FX, RX, R = round(314 * K), round(1788 * K), round(233 * K)
S = lambda px, py: [round(px * L / SW), round(H - py * H / SH)]
F = lambda dx, py: [round(dx * W / FW), round(H - py * H / FH)]
B = lambda dx, py: [round(dx * W / BW), round(H - py * H / BH)]
T = lambda px, dy: [round(px * L / TW), round(dy * W / TH)]
def side(*p): return [S(*q) for q in p]
def half(*p):
    r = [list(q) for q in p]; return r + [[-x, z] for x, z in reversed(r) if x != 0]
def fhalf(*p): return half(*[F(*q) for q in p])
def bhalf(*p): return half(*[B(*q) for q in p])
def halfT(*p):
    r = [T(*q) for q in p]; return r + [[x, -y] for x, y in reversed(r) if y != 0]
def top(*p): return [T(*q) for q in p]
def fr(*p): return [F(*q) for q in p]
def re(*p): return [B(*q) for q in p]
def ell(cx, cz, rx, rz, n=24): return [[round(cx + math.cos(k / n * 6.2832) * rx), round(cz + math.sin(k / n * 6.2832) * rz)] for k in range(n)]
def sell(px, py, rx, ry=None, n=20): return ell(*S(px, py), rx * L / SW, (ry or rx) * H / SH, n)
def fell(dx, py, r, n=24): return ell(F(dx, 0)[0], F(0, py)[1], r * W / FW, r * H / FH, n)
def bell(dx, py, r, n=24): return ell(B(dx, 0)[0], B(0, py)[1], r * W / BW, r * H / BH, n)
def tell(px, dy, r, n=14): return ell(*T(px, dy), r * L / TW, r * W / TH, n)
def rrect(x0, z0, x1, z1, r, n=5):
    out = []
    for cx, cz, a0 in ((x1 - r, z1 - r, 0), (x0 + r, z1 - r, 90), (x0 + r, z0 + r, 180), (x1 - r, z0 + r, 270)):
        for k in range(n + 1): a = math.radians(a0 + 90 * k / n); out.append([round(cx + math.cos(a) * r), round(cz + math.sin(a) * r)])
    return out
def frrect(a, b, c, d, r):
    (x0, z1), (x1, z0) = F(a, b), F(c, d); return rrect(x0, z0, x1, z1, r)

os.makedirs(f'{HERE}/work', exist_ok=True)
def _view(name, w, h):
    t = f'{HERE}/work/_fit_{name}.png'; cv2.imwrite(t, cv2.resize(cv2.imread(f'{VIEWS}/v_{name}.png', cv2.IMREAD_UNCHANGED), (round(w / 10), round(h / 10)), interpolation=cv2.INTER_AREA)); V = View(t, w); V.edge = np.maximum(V.sil * 3, V.grad); return V
FIT = {'side': _view('left', L, H), 'front': _view('front', W, H), 'rear': _view('rear', W, H), 'top': _view('top', L, W)}
SNAP = {}
def snap(view, pts, reach):
    """an outline is pulled onto the nearest strong line of the drawing; one that is the same on both sides of the
    centre line stays so (its half is fitted and mirrored)"""
    across = view != 'side'; k = 1 if view == 'top' else 0
    lo, hi = min(p[k] for p in pts), max(p[k] for p in pts); centred = across and abs(lo + hi) < 30 and lo < -20
    q = [[p[0] + (C if across and k == 0 else 0), p[1] + (C if across and k == 1 else 0)] for p in pts]
    f, moved = fit_closed(FIT[view], [[x, z, 1] for x, z in q], FIT[view].edge, reach=reach, floor=25)
    f = [[x - (C if across and k == 0 else 0), z - (C if across and k == 1 else 0)] for x, z, _ in f]
    if centred:
        g = Polygon(f).buffer(0); big = 1e5; h = g.intersection(sbox(0, -big, big, big) if k == 0 else sbox(-big, 0, big, big)); m = sscale(h, xfact=-1 if k == 0 else 1, yfact=-1 if k == 1 else 1, origin=(0, 0)); u = unary_union([h, m]).buffer(0)
        if u.geom_type == 'Polygon': f = [[round(x), round(z)] for x, z in list(u.exterior.coords)[:-1]]
    return f, moved
P = []; notes = []
def part(id, element, material, surface='side', *, layer=None, color=None, on=None, join=None, fit=0, nofit=(), x=None, y=None, z=None, pair=False, slot=None, smooth=(), detail=None, feats=None, wheel=None, lift=0, **views):
    bb = lambda pts, k: [min(p[k] for p in pts), max(p[k] for p in pts)]
    if fit:
        for v in list(views):
            if views[v] == 'front' or v in nofit: continue
            views[v], mv = snap(v, views[v], fit); SNAP[f'{id}.{v}'] = round(mv)
    if views.get('rear') == 'front': views['rear'] = views['front']
    AX = {'side': ('x', 'z'), 'front': ('y', 'z'), 'rear': ('y', 'z'), 'top': ('x', 'y')}; sheet = {}
    for v, pts in views.items(): sheet[v] = bb(pts, 0) + bb(pts, 1)
    given = {'x': x, 'y': y, 'z': z}; box = {}
    for ax in 'xyz':
        if given[ax]: box[ax] = list(given[ax]); continue
        got = [sheet[v][0:2] if AX[v][0] == ax else sheet[v][2:4] for v in sheet if ax in AX[v]]
        if not got: raise SystemExit(f'{id}: no view gives its {ax}')
        box[ax] = [round(sum(g[0] for g in got) / len(got)), round(sum(g[1] for g in got) / len(got))]
    for v, sb in sheet.items():
        a, b = AX[v]; d = [round((sb[0] + sb[1]) / 2 - (box[a][0] + box[a][1]) / 2), round((sb[2] + sb[3]) / 2 - (box[b][0] + box[b][1]) / 2),
                           round((sb[1] - sb[0]) - (box[a][1] - box[a][0])), round((sb[3] - sb[2]) - (box[b][1] - box[b][0]))]
        if max(abs(t) for t in d) > 50 and not (given[a] and given[b]): notes.append(f'{id:12s} {v:5s} differs from the common box by {d} mm (centre {a}, centre {b}, size {a}, size {b})')
    o = {}; f2 = {}
    for v, pts in views.items():
        ba, bbz = bb(pts, 0), bb(pts, 1)
        nu = lambda p: [round((p[0] - ba[0]) / max(1, ba[1] - ba[0]), 4), round((p[1] - bbz[0]) / max(1, bbz[1] - bbz[0]), 4)]
        o[v] = [nu(p) + ([0] if v in smooth else [1]) for p in pts]
        for f in (feats or {}).get(v, []):
            g = dict(f)
            if 'pts' in g: g['pts'] = [nu(p) for p in g['pts']]
            if 'at' in g: g['at'] = nu(g['at'])
            if g['kind'] == 'louvres': (g['x0'], g['z0']), (g['x1'], g['z1']) = nu([g['x0'], g['z0']]), nu([g['x1'], g['z1']])
            f2.setdefault(v, []).append(g)
    P.append({'id': id, 'element': element, 'material': material, 'surface': surface, 'box': box, 'sheet': sheet, 'pair': pair, 'outlines': o,
              **({'slot': slot} if slot else {}), **({'detail': detail} if detail else {}), **({'features': f2} if f2 else {}), **({'wheel': wheel} if wheel else {}), **({'lift': lift} if lift else {}), **({'on': on} if on else {}), **({'color': color} if color else {}), **({'join': join} if join else {}), **({'layer': layer} if layer else {})})

BLK = '#1c1b1b'; LEATHER = '#8a4d2e'; COVER = '#3d332f'
SM = ('side', 'front', 'rear', 'top')
# ---------------- running gear seen from outside ----------------
def arch(wx, r, lo, hi):
    """the dark of a wheel house: a half circle over the wheel, kept inside lo..hi"""
    a = [[min(hi, max(lo, round(wx + math.cos(t) * r))), round(R + math.sin(t) * r)] for t in [math.pi * k / 16 for k in range(16, -1, -1)]]
    return [[a[0][0], R - 80]] + a + [[a[-1][0], R - 80]]
part('house0', 'house', 'black', 'flat', color=BLK, y=[0, 520], side=arch(FX, 425, S(75, 0)[0], S(566, 0)[0]))
part('house1', 'house', 'black', 'flat', color=BLK, y=[0, 520], side=arch(RX, 400, S(1552, 0)[0], S(2014, 0)[0]))
# the dark under the sills between the wheels (side), under the tail (rear)
part('under', 'apron', 'black', 'flat', color=BLK, y=[0, 480], side=side((560, 632), (1560, 632), (1560, 674), (575, 674)))
part('underR', 'apron', 'black', 'flat', color=BLK, x=[RX - 100, RX + 200], rear=bhalf((0, 636), (400, 636), (400, 690), (120, 696), (0, 690)))
# from in front: the axle, springs and steering as one dark mass between the tyres under the valance
part('vis_axleF', 'axle', 'black', 'flat', color=BLK, x=[FX - 60, FX + 60], front=fhalf((0, 640), (150, 610), (290, 560), (356, 560), (356, 700), (250, 716), (120, 722), (0, 728)))
def tyre(y0, y1, n=6): return rrect(y0, 0, y1, 2 * R, round((y1 - y0) * 0.42), n)
TF = (F(354, 0)[0], F(514, 0)[0]); TR = (B(398, 0)[0], B(546, 0)[0])
part('tyreF', 'wheel', 'rubber', 'fender', x=[FX - R, FX + R], pair=True, front=tyre(*TF), smooth=('front',), detail={'kind': 'treadFace', 'pitch': 36})
part('tyreR', 'wheel', 'rubber', 'fender', x=[RX - R, RX + R], pair=True, rear=tyre(*TR), smooth=('rear',), detail={'kind': 'treadFace', 'pitch': 36})
# the exhaust's end under the tail, on the car's right
part('vis_exhaust', 'exhaust', 'chrome', 'fender', x=[S(2040, 0)[0], S(2110, 0)[0]], rear=bell(-282, 696, 30), smooth=('rear',))
part('vis_exhaustBore', 'exhaust', 'black', 'flat', on='vis_exhaust', lift=1, color=BLK, x=[S(2100, 0)[0], S(2110, 0)[0]], rear=bell(-282, 696, 19), smooth=('rear',))

# ---------------- body ----------------
# the nose: a body-colour panel round the two kidney grilles, between the lamps, running back into the hood
part('shell', 'radiator', 'paint', 'hood', slot='grille', smooth=('front', 'top'),
     side=side((45, 420), (90, 350), (160, 300), (260, 255), (350, 224), (380, 300), (380, 520), (60, 520)),
     front=fhalf((0, 198), (150, 200), (250, 208), (300, 232), (318, 290), (300, 400), (240, 470), (190, 560), (160, 650), (138, 690), (90, 720), (0, 732)),
     top=halfT((36, 0), (40, 30), (52, 70), (76, 100), (84, 125), (84, 250), (120, 262), (280, 172), (280, 0)))
for s, sg in (('L', 1), ('R', -1)):
    part(f'grille{s}', 'radiator', 'chrome', 'fender', slot='grille', on='shell', lift=1, x=[S(40, 0)[0], S(60, 0)[0]], smooth=('front', 'top'),
         front=[[sg * q[0], q[1]] for q in frrect(14, 276, 118, 664, 66)], top=[[q[0], sg * q[1]] for q in top((40, 6), (60, 4), (130, 30), (160, 60), (158, 86), (130, 98), (80, 86), (48, 50))])
    part(f'core{s}', 'guard', 'black', 'flat', slot='grille', on=f'grille{s}', lift=2, color='#2a2824', x=[S(44, 0)[0], S(60, 0)[0]], smooth=('front', 'top'), detail={'kind': 'cells', 'pitch': 22},
         front=[[sg * q[0], q[1]] for q in frrect(26, 290, 106, 650, 50)], top=[[q[0], sg * q[1]] for q in top((52, 14), (70, 14), (126, 40), (148, 62), (146, 80), (128, 88), (86, 76), (58, 46))])
part('badgeF', 'radiator', 'chrome', 'flat', slot='grille', on='shell', lift=3, x=[S(170, 0)[0], S(230, 0)[0]], front=fell(0, 244, 30), top=tell(200, 0, 28), smooth=('front', 'top'))
part('badgeFIn', 'radiator', 'paint2', 'flat', slot='grille', on='badgeF', lift=4, color='#2a5fb0', x=[S(175, 0)[0], S(225, 0)[0]], front=fell(0, 244, 21), top=tell(200, 0, 19), smooth=('front', 'top'))
# the bonnet: top line and the S-curved rear edge off the side view, the plan widening back to the scuttle
HOODEDGE = [(1000, 148), (996, 230), (985, 300), (950, 350), (900, 400), (860, 430), (845, 460), (840, 490)]
part('hood', 'hood', 'paint', 'hood', smooth=('top',),
     side=side((350, 224), (400, 187), (460, 166), (520, 156), (600, 151), (800, 148), *HOODEDGE, (840, 540), (380, 520)),
     top=halfT((280, 0), (280, 172), (480, 218), (640, 255), (800, 292), (1000, 308), (1012, 150), (1000, 0)),
     feats={'side': [{'kind': 'seam', 'pts': side((400, 232), (600, 222), (800, 220), (995, 226))}] +
                    [{'kind': 'seam', 'pts': side((590, y), (795 - 6 * abs(k - 1.5), y))} for k, y in enumerate((256, 274, 292, 310, 328))],
            'top': [{'kind': 'trim', 'pts': top((290, 0), (990, 0)), 'width': 2},
                    {'kind': 'louvres', 'x0': T(440, 0)[0], 'x1': T(900, 0)[0], 'z0': T(0, 52)[1], 'z1': T(0, 108)[1], 'n': 24, 'slant': 0},
                    {'kind': 'louvres', 'x0': T(440, 0)[0], 'x1': T(900, 0)[0], 'z0': T(0, -108)[1], 'z1': T(0, -52)[1], 'n': 24, 'slant': 0}]})
# the tub: scuttle, door cut dipping to the seat, rising to the back of the cockpit
CUT = [(1040, 148), (1075, 152), (1095, 170), (1115, 205), (1150, 250), (1200, 288), (1260, 312), (1340, 325), (1400, 326), (1440, 322), (1470, 300), (1500, 265)]
DOOR = side((1085, 252), (1060, 300), (1020, 380), (985, 440), (975, 480), (985, 520), (1020, 545), (1100, 560), (1200, 565), (1300, 563), (1340, 555), (1365, 520), (1380, 460), (1395, 400), (1405, 345), (1402, 328))
part('body', 'body', 'paint', 'side', join=['hood'], smooth=('top',),
     side=side(*HOODEDGE[::-1][0:0], (840, 490), *HOODEDGE[::-1][1:], *CUT, (1500, 640), (840, 640)),
     front=fhalf((0, 168), (240, 172), (300, 186), (334, 224), (354, 256), (354, 560), (0, 560)), rear='front',
     top=halfT((1000, 0), (1012, 150), (1000, 308), (1080, 310), (1378, 310), (1500, 320), (1500, 0)),
     feats={'side': [{'kind': 'seam', 'pts': DOOR}, {'kind': 'seam', 'pts': side((995, 228), (1060, 236), (1120, 262), (1200, 318), (1280, 345), (1380, 352))}]})
for k, (a, b) in enumerate((((1038, 300), (1066, 330)), ((1003, 356), (1032, 392)))):
    part(f'hinge{k}', 'body', 'chrome', 'flat', on='body', lift=2, y=[T(0, 300)[1], T(0, 312)[1]], side=side((b[0] - 10, a[1]), (b[0], a[1] + 8), (a[0] + 10, b[1]), (a[0], b[1] - 8)))
# the rounded tail behind the cockpit; the boot lid's seam in the rear view and the plan
part('deck', 'deck', 'paint', 'fender', join=['body'], smooth=('top', 'rear'),
     side=side((1500, 265), (1520, 235), (1560, 215), (1880, 200), (1920, 215), (1960, 240), (2000, 282), (2040, 335), (2080, 388), (2120, 438), (2160, 492), (2195, 555), (2208, 598), (2195, 612), (2030, 650), (1500, 640)),
     rear=bhalf((0, 222), (280, 226), (345, 256), (358, 300), (345, 448), (325, 640), (0, 640)),
     top=halfT((1500, 0), (1500, 320), (1600, 318), (1800, 305), (1900, 290), (2000, 258), (2050, 215), (2080, 160), (2095, 80), (2100, 0)),
     feats={'rear': [{'kind': 'seam', 'pts': [B(*q) for q in ((0, 240), (200, 244), (280, 270), (302, 330), (296, 420), (250, 500), (160, 548), (0, 560), (-160, 548), (-250, 500), (-296, 420), (-302, 330), (-280, 270), (-200, 244), (0, 240))]}],
            'top': [{'kind': 'seam', 'pts': top((1830, 268), (1930, 240), (2010, 190), (2050, 110), (2062, 0), (2050, -110), (2010, -190), (1930, -240), (1830, -268))}]})
part('badgeR', 'deck', 'chrome', 'flat', on='deck', lift=1, x=[S(2000, 0)[0], S(2010, 0)[0]], rear=bell(0, 374, 40), smooth=('rear',))
part('badgeRIn', 'deck', 'paint2', 'flat', on='badgeR', lift=2, color='#2a5fb0', x=[S(2006, 0)[0], S(2012, 0)[0]], rear=bell(0, 374, 28), smooth=('rear',))
part('handleR', 'deck', 'chrome', 'fender', on='deck', lift=1, x=[S(2130, 0)[0], S(2150, 0)[0]], rear=bhalf((0, 500), (10, 508), (12, 540), (7, 556), (12, 572), (9, 594), (0, 600)), smooth=('rear',))
# the cockpit: the dark well from above; from the side the dark seen over the door's cut
part('cockpit', 'cockpit', 'black', 'flat', color=BLK, smooth=('top',), on='body', lift=1,
     side=side((1085, 165), (1110, 200), (1150, 250), (1200, 288), (1260, 312), (1340, 325), (1400, 326), (1440, 322), (1470, 300), (1500, 265), (1505, 222), (1470, 222), (1425, 262), (1390, 300), (1250, 298), (1185, 262), (1125, 200)),
     top=halfT((1118, 0), (1118, 272), (1136, 292), (1500, 292), (1536, 284), (1546, 200), (1552, 0)))
# the tonneau over the folded hood behind the seats (dark brown cloth, studded)
part('tonneau', 'tonneau', 'canvas', 'roof', color=COVER, smooth=('top', 'rear'),
     side=side((1500, 238), (1508, 190), (1525, 162), (1560, 150), (1700, 150), (1790, 152), (1840, 165), (1875, 188), (1885, 200), (1840, 215), (1700, 238), (1600, 255), (1560, 262), (1520, 256)),
     rear=bhalf((0, 160), (240, 168), (340, 190), (362, 224), (358, 262), (300, 232), (0, 222)),
     top=halfT((1545, 0), (1540, 188), (1522, 268), (1518, 288), (1560, 296), (1700, 284), (1760, 268), (1790, 236), (1805, 188), (1812, 108), (1815, 0)))
# two leather straps over the bonnet, each with a buckle
for k, (sx0, sx1, sy1, tx0, tx1, tw) in enumerate(((510, 535, 290, 484, 512, 244), (752, 778, 450, 760, 788, 300))):
    part(f'strap{k}', 'strap', 'wood', 'flat', color=LEATHER, on='hood', lift=1, side=side((sx0, 150), (sx1, 150), (sx1, sy1), (sx0, sy1 - 12)), top=halfT((tx0, 0), (tx0, tw), (tx1, tw), (tx1, 0)))
    part(f'buckle{k}', 'strap', 'chrome', 'flat', on=f'strap{k}', lift=2, y=[T(0, 150)[1], T(0, 175)[1]], side=side((sx0 - 8, 222), (sx1 + 8, 222), (sx1 + 8, 246), (sx0 - 8, 246)))

# ---------------- wings: each sweeps down into the body (no seam where it meets the body side) ----------------
part('fenderF', 'fenderF', 'paint', 'fender', slot='fenderF', pair=True, join=['body', 'fenderR', 'shell'], smooth=SM,
     side=side((6, 505), (14, 460), (30, 420), (52, 380), (80, 345), (115, 312), (155, 288), (200, 268), (250, 254), (310, 246), (370, 244), (430, 250), (490, 268), (550, 298), (610, 338), (670, 382), (730, 425), (790, 468), (850, 503), (920, 535), (1000, 560), (1080, 576), (1160, 585), (1260, 590), (1378, 592),
               (1378, 640), (600, 640), (572, 625), (560, 590), (553, 530), (540, 470), (515, 415), (480, 372), (430, 343), (370, 328), (310, 326), (250, 335), (195, 355), (150, 385), (115, 425), (90, 470), (70, 515), (40, 530), (15, 528)),
     front=fr((354, 268), (394, 256), (458, 254), (506, 268), (534, 304), (547, 360), (550, 448), (538, 520), (518, 552), (370, 544), (330, 552), (282, 584), (218, 640), (170, 676), (138, 688), (150, 600), (190, 540), (240, 470), (300, 400), (318, 330)),
     top=top((4, 308), (6, 356), (16, 388), (40, 410), (80, 422), (160, 424), (320, 408), (480, 388), (640, 368), (800, 352), (1000, 338), (1080, 344), (1200, 356), (1378, 378), (1378, 308), (1080, 308), (1000, 308), (800, 292), (640, 255), (480, 218), (280, 172), (200, 200), (120, 262), (84, 250), (40, 268)))
part('fenderR', 'fenderR', 'paint', 'fender', slot='fenderR', pair=True, join=['body', 'deck'], smooth=SM,
     side=side((1378, 640), (1378, 595), (1405, 570), (1425, 530), (1442, 480), (1462, 435), (1500, 380), (1560, 330), (1640, 287), (1720, 266), (1800, 258), (1840, 262), (1880, 275), (1920, 293), (1960, 320), (2000, 358), (2040, 402), (2080, 447), (2120, 490), (2160, 535), (2190, 575), (2208, 600),
               (2195, 612), (2100, 635), (2030, 650), (2012, 640), (2008, 600), (2000, 540), (1985, 490), (1960, 440), (1920, 395), (1870, 362), (1810, 345), (1750, 345), (1690, 358), (1640, 385), (1600, 425), (1575, 470), (1562, 520), (1557, 580), (1555, 640)),
     rear=re((358, 264), (370, 228), (406, 204), (478, 200), (518, 216), (550, 264), (570, 336), (578, 448), (574, 560), (562, 632), (550, 640), (310, 640), (318, 560), (334, 448), (350, 320)),
     top=top((1378, 378), (1440, 396), (1500, 416), (1600, 425), (1700, 428), (1800, 426), (1900, 420), (2000, 404), (2080, 380), (2140, 366), (2168, 340), (2174, 310), (2165, 285), (2130, 262), (2080, 240), (2000, 262), (1900, 290), (1800, 305), (1600, 318), (1440, 320), (1378, 310)),
     feats={'side': [{'kind': 'seam', 'pts': side((1378, 596), (1378, 640))}]})

# ---------------- lamps, screen, small things ----------------
# headlamps: a body-colour shell faired back into the nose, a bright rim, a pale lens
part('lamp', 'lamp', 'paint', 'fender', slot='lamp', pair=True, smooth=SM, on='shell', lift=1, z=[S(0, 293)[1], S(0, 199)[1]],
     side=side((178, 290), (170, 250), (180, 216), (205, 199), (240, 201), (300, 215), (375, 238), (300, 272), (240, 285), (205, 293)),
     front=fell(220, 336, 90), top=top((116, 150), (124, 134), (150, 128), (200, 150), (240, 185), (256, 200), (240, 215), (200, 250), (150, 272), (124, 266), (116, 250)))
part('lampRim', 'lamp', 'chrome', 'fender', slot='lamp', pair=True, on='lamp', lift=2, smooth=SM, y=[T(0, 128)[1], T(0, 272)[1]], z=[S(0, 294)[1], S(0, 198)[1]],
     side=side((166, 288), (158, 250), (168, 212), (194, 196), (214, 199), (204, 222), (200, 250), (204, 280), (214, 292), (196, 295)), front=fell(220, 336, 90),
     top=top((114, 152), (122, 132), (140, 128), (140, 270), (122, 268), (114, 248)))
part('lens', 'lamp', 'chrome', 'flat', slot='lamp', pair=True, on='lampRim', lift=3, x=[S(160, 0)[0], S(166, 0)[0]], front=fell(220, 336, 76), smooth=('front',), detail={'kind': 'bowl'})
# two upright bright bars on the valance under the lamps (front view only)
part('noseBar', 'noseBar', 'chrome', 'fender', pair=True, on='shell', lift=1, x=[S(60, 0)[0], S(80, 0)[0]], front=fr((190, 492), (198, 486), (206, 492), (206, 644), (198, 650), (190, 644)))
# the fold-flat screen: bright frame, two panes, raked back; stanchions at the ends
part('screenFrame', 'screen', 'chrome', 'fender',
     side=side((1030, 198), (1100, 4), (1140, 8), (1142, 40), (1078, 204), (1050, 210)),
     front=fhalf((0, 4), (306, 6), (320, 20), (326, 150), (318, 182), (240, 172), (0, 166)), rear='front',
     top=halfT((1040, 0), (1040, 296), (1090, 302), (1090, 0)))
part('screen', 'screen', 'glass', 'flat', on='screenFrame', lift=1, pair=True, x=[S(1060, 0)[0], S(1125, 0)[0]], front=fr((14, 30), (296, 32), (302, 148), (240, 156), (14, 148)), rear='front')
part('screenPost', 'screen', 'chrome', 'fender', pair=True, x=[S(1040, 0)[0], S(1080, 0)[0]], front=fr((318, 60), (336, 70), (340, 130), (352, 190), (340, 216), (322, 200), (322, 150)), rear='front')
# the tail lamps on the rear wings' ends
part('tailRim', 'tail', 'chrome', 'fender', slot='tail', pair=True, smooth=SM, on='fenderR', lift=1, x=[T(2070, 0)[0], T(2148, 0)[0]], rear=bell(370, 528, 36),
     side=side((2122, 498), (2138, 484), (2158, 498), (2168, 530), (2164, 560), (2150, 566)), top=top((2090, 200), (2150, 196), (2166, 212), (2168, 240), (2150, 258), (2092, 252)))
part('tail', 'tail', 'lensR', 'flat', slot='tail', pair=True, on='tailRim', lift=2, smooth=SM, x=[T(2130, 0)[0], T(2150, 0)[0]], rear=bell(370, 528, 26),
     side=side((2152, 506), (2164, 516), (2168, 540), (2160, 556)), top=top((2150, 200), (2166, 212), (2168, 240), (2150, 254)))

# ---------------- the chassis under the body: the draft's chassis-layer parts moved onto this car's wheels ----------------
D = json.load(open(DRAFT)); dw = D['wheels']; kx = (RX - FX) / (dw[1]['x'] - dw[0]['x']); ky = W / D['width']; kz = H / D['height']
mx = lambda v: round(FX + (v - dw[0]['x']) * kx); my = lambda v: round(v * ky); mz = lambda v: round(v * kz)
for p in D['parts']:
    if p.get('layer') != 'chassis': continue
    q = json.loads(json.dumps(p)); b = q['box']; q['box'] = {'x': [mx(b['x'][0]), mx(b['x'][1])], 'y': [my(b['y'][0]), my(b['y'][1])], 'z': [mz(b['z'][0]), mz(b['z'][1])]}
    for v, sb in q.get('sheet', {}).items():
        fa, fb = {'side': (mx, mz), 'front': (my, mz), 'rear': (my, mz), 'top': (mx, my)}[v]; q['sheet'][v] = [fa(sb[0]), fa(sb[1]), fb(sb[2]), fb(sb[3])]
    P.append(q)

M = {'id': 'bmw315', 'name': '1935 roadster', 'year': 1935, 'length': L, 'width': W, 'height': H,
     'paint': '#ddcfb4', 'paint2': '#e3d6be', 'canvas': COVER, 'chrome': '#a49d94', 'glassTint': '#9db4c8',
     'wheels': [{'x': FX, 'r': R, 'y': round((TF[0] + TF[1]) / 2)}, {'x': RX, 'r': R, 'y': round((TR[0] + TR[1]) / 2)}],
     'wheel': {'rim': 0.62, 'style': 'disc', 'spokes': 0, 'rimMaterial': 'paint', 'cap': 0.2, 'capRings': 1},   # pressed disc wheels in the body's cream (the sheet's ring of 16 holes cannot be drawn), bright cap
     'parts': P}
json.dump(M, open(OUT, 'w'), indent=0)
print(OUT, len(P), 'parts;', sum(len(p['outlines']) for p in P), 'outlines', '| L H W', L, H, W, 'FX RX R', FX, RX, R)
print('where a view of the sheet differs from the common box by more than 50 mm (each view keeps its own):'); print('\n'.join('  ' + n for n in notes))
