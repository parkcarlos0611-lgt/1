"""The 1928 six sedan (sheet d5f881aa, the right-hand car) as one 3D part model, made by hand in the way of
tools/ref/sedan29_model.py: every part is a box in the car's space (x from the front bumper back, y from the centre
line outwards, z up; mm) and its outline as the sheet shows it from the side, the front or rear, and above. Outlines
are read off gridded enlargements of the sheet's views, in pixel positions on a 4x enlargement of each view
(S side, F front, B rear, T plan). The body-layer parts are written from scratch; the chassis-layer parts (engine,
gearbox, exhaust ... under the body) are the converter's draft's, moved onto this car's wheels.

  python3 dodgeV28.py <views dir> <out json> [draft json] [repository root]"""
import sys, os, json, math
HERE = os.path.dirname(os.path.abspath(__file__))
VIEWS, OUT = sys.argv[1], sys.argv[2]
DRAFT = sys.argv[3] if len(sys.argv) > 3 else f'{HERE}/draft/dodgeV28_auto.json'
REPO = sys.argv[4] if len(sys.argv) > 4 else '/home/user/1/gearhouse'
sys.path.insert(0, f'{REPO}/tools/ref')
import cv2, numpy as np
from zkit import View, fit_closed
from shapely.geometry import Polygon, box as sbox
from shapely.affinity import scale as sscale
from shapely.ops import unary_union

# ---- scale: the hub caps are at 258 and 1565 on the 4x side view, the wheelbase is 2864 mm ----
K = 2864 / (1565 - 258)                                   # 2.191 mm per unit of the 4x side view (8.77 mm a pixel)
L, H = round(1928 * K), round(840 * K); W = round(1016 * H / 944)   # review 72: the front view keeps the sheet's proportions (was 1780)           # side view 482x210 px; the width is between the plan's and the front and rear views'
C = W / 2
FX, RX, R = round(258 * K), round(1565 * K), 392
S = lambda px, py: [round(px * L / 1928), round(H - py * H / 840)]            # side view (482x210 px)
F = lambda dx, py: [round(dx * H / 944), round(H - py * H / 944)]            # front view (254x236 px): distance from the centre line, row
B = lambda dx, py: [round(dx * H / 976), round(H - py * H / 976)]            # rear view (259x244 px)
T = lambda px, dy: [round(px * L / 1816), round(dy * W / 700)]                # plan view (454x175 px): along, distance from the centre line (row 358 of the 4x view)
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
def fell(dx, py, r, n=24): return ell(F(dx, 0)[0], F(0, py)[1], r * W / 1016, r * H / 944, n)
def bell(dx, py, r, n=24): return ell(B(dx, 0)[0], B(0, py)[1], r * W / 1036, r * H / 976, n)
def rrect(x0, z0, x1, z1, r, n=4):
    out = []
    for cx, cz, a0 in ((x1 - r, z1 - r, 0), (x0 + r, z1 - r, 90), (x0 + r, z0 + r, 180), (x1 - r, z0 + r, 270)):
        for k in range(n + 1): a = math.radians(a0 + 90 * k / n); out.append([round(cx + math.cos(a) * r), round(cz + math.sin(a) * r)])
    return out
def srrect(a, b, c, d, r):
    """a rounded rectangle given by two corners on the side view"""
    (x0, z1), (x1, z0) = S(a, b), S(c, d); return rrect(x0, z0, x1, z1, r)

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
def part(id, element, material, surface='side', *, layer=None, color=None, on=None, fit=0, nofit=(), x=None, y=None, z=None, pair=False, slot=None, smooth=(), detail=None, feats=None, cutWheel=None, wheel=None, lift=0, **views):
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
            if g['kind'] == 'handle': g['len'] = g.get('len', 110) / max(1, ba[1] - ba[0])
            f2.setdefault(v, []).append(g)
    P.append({'id': id, 'element': element, 'material': material, 'surface': surface, 'box': box, 'sheet': sheet, 'pair': pair, 'outlines': o,
              **({'slot': slot} if slot else {}), **({'detail': detail} if detail else {}), **({'features': f2} if f2 else {}), **({'cutWheel': cutWheel} if cutWheel else {}), **({'wheel': wheel} if wheel else {}), **({'lift': lift} if lift else {}), **({'on': on} if on else {}), **({'color': color} if color else {}), **({'layer': layer} if layer else {})})

BLK = '#1c1b1e'                                           # the sheet's black of the valance and the wheel houses
TOPBLK = '#202022'                                        # the black of the body above the belt (measured on the rear quarter)
WING = '#3d3d44'                                          # the wings' black enamel as the sheet lights it (the wheel houses behind are deeper)
WOOD = '#4a3d38'                                          # the dark wood garnish inside the window surrounds
def srect(a, b, c, d, r): return srrect(a, b, c, d, r)
def circ(cx, cy, rx, ry, n=12): return [[round(cx + math.cos(k / n * 6.2832) * rx), round(cy + math.sin(k / n * 6.2832) * ry)] for k in range(n)]
# ---------------- running gear seen from outside ----------------
def arch(wx, r, lo, hi, low=-60):
    """the dark of a wheel house: a half circle over the wheel, kept inside lo..hi (where the wing ends the sheet shows daylight)"""
    a = [[min(hi, max(lo, round(wx + math.cos(t) * r))), round(R + math.sin(t) * r)] for t in [math.pi * k / 16 for k in range(16, -1, -1)]]
    return [[a[0][0], R + low]] + a + [[a[-1][0], R - 60]]
part('house0', 'house', 'black', 'flat', color=BLK, y=[0, 560], side=arch(FX, 440, S(72, 0)[0], FX + 455, 150))
part('house1', 'house', 'black', 'flat', color=BLK, y=[0, 560], side=arch(RX, 505, S(1372, 0)[0], S(1800, 0)[0]))
part('frame', 'frame', 'black', 'flat', pair=True, side=[[230, 440], [L - 330, 440], [L - 330, 540], [230, 540]], front=[[350, 440], [415, 440], [415, 540], [350, 540]], rear='front', top=[[230, 350], [L - 330, 350], [L - 330, 415], [230, 415]])
# the dumb irons' ends standing out ahead of the front wing (side), carrying the bumper
part('hornF', 'frame', 'black', 'flat', color=BLK, pair=True, y=[150, 215], side=side((56, 606), (64, 584), (84, 572), (104, 576), (108, 664), (74, 668), (58, 650)), smooth=('side',))
# from in front the sheet shows the axle, springs and steering gear as one dark band under the bumper; from behind the axle with the round of the differential
part('axleF', 'axle', 'black', 'flat', x=[FX - 40, FX + 40], front=fhalf((0, 842), (150, 842), (220, 832), (330, 826), (330, 796), (0, 796)))
part('springF', 'spring', 'iron', 'flat', x=[FX - 30, FX + 30], front=fhalf((0, 800), (120, 802), (300, 814), (328, 820), (328, 830), (300, 826), (120, 814), (0, 812)))
part('axleR', 'axle', 'black', 'flat', x=[RX - 47, RX + 47], rear=bhalf((0, 892), (50, 888), (86, 868), (120, 850), (366, 846), (366, 812), (120, 806), (0, 800)), smooth=('rear',))
part('springR', 'spring', 'iron', 'flat', x=[RX + 60, RX + 120], rear=bhalf((0, 806), (60, 810), (260, 826), (364, 838), (364, 850), (260, 840), (60, 824), (0, 820)))
tyre0 = [[606, 6], [640, 0], [748, 0], [782, 6], [798, 40], [805, 200], [807, 381], [804, 560], [796, 690], [782, 734], [760, 754], [725, 762], [663, 762], [628, 754], [606, 734], [592, 690], [584, 560], [581, 381], [583, 200], [590, 40]]   # a balloon section face on: flat where it stands, round at the top
def tyre(y0, y1): return [[round(y0 + (q[0] - 581) / 226 * (y1 - y0)), round(q[1] / 762 * 2 * R)] for q in tyre0]
TF = (F(332, 0)[0], F(486, 0)[0]); TR = (B(368, 0)[0], B(478, 0)[0])            # the tyres' inner and outer faces on the front and rear views
part('tyreF', 'wheel', 'rubber', 'fender', x=[FX - R + 30, FX + R - 30], pair=True, front=tyre(*TF), top=[[FX - 300, TF[0]], [FX + R - 30, TF[0]], [FX + R - 30, TF[1]], [FX - 300, TF[1]]], smooth=('front',), detail={'kind': 'treadFace', 'pitch': 36})
part('tyreR', 'wheel', 'rubber', 'fender', x=[RX - R + 30, RX + R - 30], pair=True, rear=tyre(*TR), top=[[RX - R + 30, TR[0]], [RX + R - 30, TR[0]], [RX + R - 30, TR[1]], [RX - R + 30, TR[1]]], smooth=('rear',), detail={'kind': 'treadFace', 'pitch': 36})

# ---------------- body ----------------
# the dark between the wings ahead of the shell (plan) and under the shell and lamps (front)
part('splash', 'apron', 'black', 'flat', color=BLK, z=[300, 820], x=[S(250, 0)[0], S(420, 0)[0]], top=halfT((92, 0), (92, 196), (178, 196), (178, 0)), front=fhalf((0, 842), (220, 842), (332, 820), (332, 560), (0, 560)))
part('crossF', 'frame', 'black', 'flat', x=[190, 280], z=[390, 440], top=[[200, -250], [200, 250], [290, 250], [290, -250]], front=half([0, 390], [415, 390], [415, 440], [0, 440]))
# the black valance between the body's bottom edge and the running board, running forward under the hood behind the front wing
part('apron', 'apron', 'black', 'flat', color=BLK, y=[-610, 610], side=side((470, 548), (540, 578), (1376, 578), (1350, 658), (700, 658), (600, 652), (500, 610)),
     feats={'side': [{'kind': 'crease', 'pts': side((760, 596), (1350, 596))}]})
# radiator: a bright shell, flat in front with a broad arched top that dips to a point over the winged badge; the mesh core fills it (the maker's lettering on the core is left out)
part('shell', 'radiator', 'chrome', 'flat', slot='grille', color='#a5a5a3', fit=2, nofit=('top', 'side'),
     side=side((240, 430), (236, 320), (240, 280), (246, 272), (276, 272), (276, 430)),
     front=fhalf((0, 276), (40, 282), (80, 296), (112, 316), (135, 340), (148, 368), (151, 400), (151, 706), (0, 706)), smooth=('front',),
     top=halfT((175, 0), (175, 100), (182, 113), (222, 115), (222, 0)))
part('core', 'radiator', 'black', 'flat', on='shell', slot='grille', x=[S(238, 0)[0], S(243, 0)[0]], front=fhalf((0, 350), (22, 334), (60, 326), (96, 338), (118, 362), (131, 400), (131, 700), (0, 700)), smooth=('front',), detail={'kind': 'cells', 'pitch': 20})
part('badge', 'radiator', 'chrome', 'flat', on='shell', slot='grille', color='#c7c2b4', x=[S(234, 0)[0], S(238, 0)[0]], front=fhalf((0, 292), (10, 296), (30, 300), (14, 312), (8, 330), (0, 340)), lift=1)
part('badgeGem', 'radiator', 'paint', 'flat', on='badge', slot='grille', x=[S(233, 0)[0], S(236, 0)[0]], front=fell(0, 308, 7, 10), smooth=('front',), lift=2)
# the headlamp tie bar: a bright rod across the shell between the lamps (front view)
part('lampBar', 'lamp', 'chrome', 'fender', slot='lamp', color='#b8b5b2', x=[S(196, 0)[0], S(206, 0)[0]], front=fhalf((0, 508), (204, 508), (204, 526), (0, 526)), lift=3)
# the cap: a winged motometer on a stepped neck
part('cap', 'radiator', 'chrome', 'flat', slot='grille', color='#b9b6b0', smooth=('side', 'front'),
     side=side((246, 272), (244, 262), (250, 256), (244, 248), (246, 240), (256, 236), (268, 238), (272, 246), (266, 256), (272, 262), (272, 272)),
     front=fhalf((0, 226), (12, 228), (16, 236), (30, 238), (30, 247), (12, 250), (10, 262), (20, 268), (22, 276), (0, 277)),
     top=circ(T(196, 0)[0], 0, 34, 30))
part('hood', 'hood', 'paint', 'side', fit=2, nofit=('front', 'top'),
     side=side((278, 264), (460, 258), (650, 252), (650, 578), (278, 578)),
     front=fhalf((0, 276), (120, 282), (200, 298), (250, 320), (272, 350), (276, 400), (276, 600), (0, 600)), smooth=('front',),
     top=halfT((222, 0), (222, 113), (578, 190), (578, 0)),
     feats={'side': [{'kind': 'louvres', 'x0': S(322, 0)[0], 'x1': S(602, 0)[0], 'z0': S(0, 522)[1], 'z1': S(0, 366)[1], 'n': 24, 'slant': 0},
                     {'kind': 'seam', 'pts': side((280, 326), (648, 322))},                                  # the hood's side hinge under the lit shoulder
                     {'kind': 'highlight', 'pts': side((282, 300), (460, 296), (646, 292)), 'width': 3},
                     {'kind': 'highlight', 'pts': side((282, 285), (460, 280), (646, 276)), 'width': 1},
                     {'kind': 'handle', 'at': S(590, 550), 'len': 36}],
            'top': [{'kind': 'trim', 'pts': top((226, 0), (575, 0)), 'width': 1}, {'kind': 'highlight', 'pts': top((235, 80), (570, 150)), 'width': 2}, {'kind': 'highlight', 'pts': top((235, -80), (570, -150)), 'width': 2}]})
part('cowl', 'cowl', 'paint', 'side', fit=2, nofit=('front', 'top'),
     side=side((655, 252), (700, 250), (760, 246), (760, 578), (655, 578)),
     front=fhalf((0, 270), (120, 276), (220, 290), (300, 308), (350, 325), (372, 345), (374, 440), (356, 560), (0, 560)), smooth=('front',),
     top=halfT((588, 0), (588, 193), (640, 205), (682, 212), (682, 0)),
     feats={'side': [{'kind': 'highlight', 'pts': side((664, 290), (758, 288)), 'width': 3}, {'kind': 'crease', 'pts': side((664, 318), (758, 318))},
                     {'kind': 'trim', 'pts': side((658, 256), (658, 576)), 'width': 2}],                       # the bright band between hood and cowl
            'top': [{'kind': 'trim', 'pts': top((592, -190), (592, 190)), 'width': 2}],
            'front': [{'kind': 'highlight', 'pts': [F(-300, 318), F(-200, 300), F(0, 284), F(200, 300), F(300, 318)], 'width': 1}]})
# the body: blue up to the belt; above the belt it is black (bodyTop). Its side follows the rear wheel arch behind the wing.
RA = [[round(1565 + 207 * math.cos(math.radians(a))), round(648 - 207 * math.sin(math.radians(a)))] for a in range(25, 161, 9)]      # the rear wheel arch, 4x side units
BODY_TOP = ((690, 0), (690, 215), (700, 236), (730, 243), (1000, 245), (1600, 245), (1655, 235), (1688, 205), (1700, 150), (1700, 0))
part('body', 'body', 'paint', 'side', fit=2, nofit=('top', 'front', 'rear'),
     side=side((760, 578), (760, 62), (772, 48), (1700, 48), (1738, 54), (1752, 72), (1753, 262), (1751, 330), (1746, 420), (1738, 500), (1752, 560), *RA, (1372, 578)),
     front=fhalf((0, 60), (372, 60), (368, 110), (362, 280), (372, 300), (374, 350), (372, 440), (356, 560), (0, 560)),
     rear=bhalf((0, 60), (392, 60), (400, 90), (404, 200), (404, 345), (411, 380), (408, 460), (384, 600), (348, 700), (0, 706)),
     top=halfT(*BODY_TOP),
     feats={'side': [{'kind': 'seam', 'pts': side((782, 284), (782, 577))}, {'kind': 'seam', 'pts': side((1113, 284), (1113, 577))}, {'kind': 'seam', 'pts': side((1123, 284), (1123, 577))},
                     {'kind': 'seam', 'pts': side((1458, 284), (1458, 424))},
                     {'kind': 'crease', 'pts': side((790, 568), (1370, 568))},
                     {'kind': 'hinge', 'at': S(780, 300)}, {'kind': 'hinge', 'at': S(780, 500)}, {'kind': 'hinge', 'at': S(1458, 300)}, {'kind': 'hinge', 'at': S(1458, 352)}],
            'rear': [{'kind': 'seam', 'pts': [B(s * 352, 350), B(s * 344, 520), B(s * 322, 700)]} for s in (-1, 1)]})
# the belt moulding: a broad band of lighter blue from the cowl to the back, sweeping up over the rear quarter and round the back
part('belt', 'body', 'paint', 'side', on='body', color='#33455e', y=[0, 645],
     side=side((760, 282), (1650, 282), (1700, 276), (1753, 258), (1753, 286), (1702, 306), (1650, 316), (760, 318)),
     rear=bhalf((0, 318), (200, 320), (330, 328), (404, 342), (410, 368), (330, 352), (200, 344), (0, 342)),
     front=fhalf((362, 300), (374, 302), (374, 342), (362, 340)),
     feats={'side': [{'kind': 'highlight', 'pts': side((764, 288), (1648, 288), (1700, 282), (1750, 265)), 'width': 1}, {'kind': 'crease', 'pts': side((764, 316), (1648, 314), (1700, 304), (1750, 284))},
                     {'kind': 'seam', 'pts': side((782, 284), (782, 317))}, {'kind': 'seam', 'pts': side((1118, 284), (1118, 317))}, {'kind': 'seam', 'pts': side((1458, 284), (1458, 317))}],
            'rear': [{'kind': 'highlight', 'pts': [B(-400, 346), B(-330, 332), B(-200, 324), B(0, 322), B(200, 324), B(330, 332), B(400, 346)], 'width': 1}]})
part('bodyTop', 'body', 'paint2', 'side', on='body', color=TOPBLK, fit=2, nofit=('front', 'rear'), y=[0, 645],
     side=side((760, 282), (760, 62), (772, 48), (1700, 48), (1738, 54), (1752, 72), (1753, 260), (1700, 277), (1650, 283)),
     front=fhalf((0, 60), (372, 60), (368, 110), (362, 280), (0, 280)),
     rear=bhalf((0, 28), (362, 28), (388, 52), (400, 90), (404, 200), (404, 344), (330, 330), (200, 322), (0, 320)),
     feats={'side': [{'kind': 'seam', 'pts': side((1118, 64), (1118, 282))}, {'kind': 'seam', 'pts': side((1458, 64), (1458, 282))},
                     {'kind': 'highlight', 'pts': side((800, 70), (1640, 70)), 'width': 1},                    # the drip moulding
                     {'kind': 'seam', 'pts': side((1668, 64), (1668, 280))},                                   # the rear quarter's front edge
                     {'kind': 'highlight', 'pts': side((1712, 80), (1736, 86), (1742, 110), (1742, 250)), 'width': 2},
                     {'kind': 'hinge', 'at': S(772, 140)}, {'kind': 'hinge', 'at': S(772, 212)}, {'kind': 'hinge', 'at': S(1458, 110)}],
            'front': [{'kind': 'seam', 'pts': [F(s * 262, 92), F(s * 262, 270)]} for s in (-1, 1)] + [{'kind': 'seam', 'pts': [F(s * 298, 112), F(s * 322, 112), F(s * 322, 262), F(s * 298, 270), F(s * 298, 112)]} for s in (-1, 1)],
            'rear': [{'kind': 'highlight', 'pts': [B(s * 392, 90), B(s * 394, 330)], 'width': 2} for s in (-1, 1)]})
# the roof: black cloth over a low rounded cap; from above its outline is the body's, with the inner panel's welt
part('roof', 'roof', 'canvas', 'roof', fit=2, nofit=('front', 'rear', 'top'),
     side=side((760, 62), (762, 42), (800, 24), (900, 12), (1100, 6), (1500, 4), (1700, 8), (1736, 24), (1752, 50), (1754, 72), (1700, 62), (800, 62)),
     front=fhalf((0, 4), (200, 5), (300, 8), (345, 16), (366, 32), (373, 56), (373, 76), (0, 76)),
     rear=bhalf((0, 5), (280, 6), (330, 12), (365, 28), (388, 52), (400, 90), (0, 90)),
     top=halfT(*BODY_TOP),
     feats={'top': [{'kind': 'seam', 'pts': top((745, 0), (745, 200), (765, 220), (1000, 224), (1580, 224), (1600, 210), (1604, 0))},
                    {'kind': 'seam', 'pts': top((745, 0), (745, -200), (765, -220), (1000, -224), (1580, -224), (1600, -210), (1604, 0))}],
            'side': [{'kind': 'highlight', 'pts': side((820, 30), (1100, 18), (1500, 16), (1690, 20)), 'width': 2}]})
# the visor over the windscreen: a cloth-covered peak sloping forward and down from the roof's front edge, on a bracket each side
part('visor', 'roof', 'canvas', 'roof', fit=2, nofit=('front', 'top'), color='#2c2c30',
     side=side((692, 86), (760, 42), (800, 24), (800, 62), (762, 100), (736, 106), (700, 97)),
     front=fhalf((0, 60), (296, 60), (304, 72), (304, 92), (286, 102), (0, 102)),
     top=halfT((676, 0), (676, 222), (686, 240), (732, 243), (732, 0)))
part('screenFrame', 'screen', 'black', 'flat', on='bodyTop', x=[S(760, 0)[0], S(772, 0)[0]], front=fhalf((0, 80), (270, 80), (270, 270), (0, 270)))
# the windscreen is dark from in front (the cabin behind it); through it the rear window shows pale, with the steering wheel on the driver's side
part('screen', 'screen', 'glass', 'side', on='screenFrame', x=[S(762, 0)[0], S(770, 0)[0]], front=fhalf((0, 96), (254, 96), (262, 104), (262, 256), (254, 264), (0, 264)))
part('cabin', 'screen', 'black', 'flat', on='screen', color='#3a3533', x=[S(763, 0)[0], S(769, 0)[0]], front=fhalf((0, 100), (252, 100), (258, 106), (258, 254), (252, 260), (0, 260)), lift=1)
part('screenThrough', 'screen', 'glass', 'side', on='screen', x=[S(763, 0)[0], S(769, 0)[0]], front=rrect(F(-176, 0)[0], F(0, 226)[1], F(188, 0)[0], F(0, 134)[1], 12), lift=2)
part('steering', 'screen', 'wood', 'flat', on='screen', color='#6e4a2c', x=[S(830, 0)[0], S(840, 0)[0]],
     front=[F(96, 232), F(112, 206), F(140, 190), F(176, 186), F(214, 196), F(240, 222), F(248, 240), F(236, 240), F(224, 220), F(204, 204), F(176, 198), F(144, 202), F(122, 216), F(108, 236)], lift=3)
part('wiper', 'screen', 'chrome', 'flat', on='screenFrame', color='#8f8a80', x=[S(756, 0)[0], S(762, 0)[0]], front=fr((122, 70), (132, 76), (20, 168), (12, 162)), lift=4)
# cowl lamps: small bright lamps on the cowl's shoulders, ahead of the screen pillars
# the dash and screen foot seen from above through the glass: a strip of wood behind the cowl
part('dashTop', 'cowl', 'wood', 'flat', on='cowl', color='#6e5236', z=[S(0, 300)[1], S(0, 250)[1]], top=halfT((652, 0), (650, 90), (656, 138), (668, 140), (668, 0)), lift=1)
part('cowlLamp', 'lamp', 'chrome', 'fender', on='cowl', pair=True, lift=2, smooth=('front', 'side', 'top'),
     side=side((684, 290), (690, 282), (706, 282), (714, 292), (712, 304), (700, 308), (688, 304)),
     front=fell(290, 316, 21, 14), top=circ(T(662, 0)[0], T(0, 215)[1], 24, 22))
# the door handles: bright bars either side of the centre post; from in front and behind they stand out of the body's side
for k, pts in enumerate((((1038, 337), (1080, 337), (1084, 328), (1100, 330), (1106, 348), (1098, 362), (1084, 355), (1038, 353)),
                         ((1207, 337), (1165, 337), (1161, 328), (1145, 330), (1139, 348), (1147, 362), (1161, 355), (1207, 353)))):
    part(f'doorHandle{k}', 'body', 'chrome', 'flat', on='body', pair=True, y=[645, 675], side=side(*pts), lift=2,
         **({'rear': re((402, 454), (414, 452), (420, 460), (414, 470), (402, 468))} if k else {'front': fr((370, 340), (382, 338), (388, 346), (382, 356), (370, 354))}))
# side windows: three a side, each in a black surround with a dark wood garnish inside it
WIN = (((796, 92, 1106, 280), (812, 98, 1086, 266), (820, 104, 1060, 258)), ((1130, 92, 1444, 280), (1160, 98, 1428, 266), (1168, 104, 1392, 258)), ((1472, 92, 1664, 280), (1484, 98, 1652, 266), (1490, 104, 1626, 258)))
for k, (fo, wd, gl) in enumerate(WIN):
    fp = srect(*fo, 30); ip = srect(fo[0] + 7, fo[1] + 5, fo[2] - 7, fo[3] - 6, 26)
    part(f'wframe{k}', 'body', 'paint2', 'side', on='bodyTop', color='#232427', y=[645, 647], pair=True, side=fp,
         feats={'side': [{'kind': 'highlight', 'pts': ip + [ip[0]], 'width': 1}]})
    part(f'wood{k}', 'body', 'wood', 'flat', on=f'wframe{k}', color=WOOD, y=[647, 648], pair=True, side=srect(*wd, 30))
    part(f'glass{k}', 'body', 'glass', 'side', on=f'wood{k}', y=[648, 650], pair=True, side=srect(*gl, 22))
# what shows through the side glass: the steering wheel's rim and column, the seat backs
part('seenWheel', 'body', 'wood', 'flat', on='glass0', color='#7a5632', y=[500, 510], pair=True, side=side((836, 196), (846, 190), (912, 250), (916, 258), (896, 258), (870, 250), (834, 258), (822, 256), (826, 246), (866, 240)), lift=1)
part('seenSeat1', 'body', 'wood', 'flat', on='glass1', color='#9a7748', y=[500, 510], pair=True, side=side((1316, 258), (1322, 240), (1340, 232), (1372, 234), (1386, 246), (1392, 258)), lift=1)
part('seenSeat2', 'body', 'wood', 'flat', on='glass2', color='#9a7748', y=[500, 510], pair=True, side=side((1596, 258), (1604, 246), (1626, 244), (1626, 258)), lift=1)
# the rear window: a wood surround with rounded corners in the black back
part('rearFrame', 'body', 'wood', 'flat', on='bodyTop', color='#4c3b2e', x=[S(1750, 0)[0], S(1754, 0)[0]], rear=rrect(B(-197, 0)[0], B(0, 282)[1], B(197, 0)[0], B(0, 138)[1], 24))
part('rearGlass', 'body', 'glass', 'side', on='rearFrame', x=[S(1748, 0)[0], S(1752, 0)[0]], rear=rrect(B(-172, 0)[0], B(0, 258)[1], B(172, 0)[0], B(0, 162)[1], 12))
part('rearApron', 'body', 'black', 'flat', color=BLK, x=[S(1690, 0)[0], S(1750, 0)[0]], rear=bhalf((0, 700), (348, 700), (366, 760), (366, 846), (0, 846)))

# ---------------- wings, boards ----------------
part('fenderF', 'fenderF', 'paint2', 'fender', color=WING, fit=2, nofit=('top', 'front'), slot='fenderF', pair=True, cutWheel={'i': 0, 'r': R + 6}, smooth=('front', 'side', 'top'), x=[S(60, 0)[0], S(750, 0)[0]],
     side=side((60, 506), (70, 490), (100, 468), (140, 446), (180, 428), (220, 416), (260, 410), (300, 412), (340, 422), (380, 442), (420, 474), (460, 520), (500, 568), (540, 610), (580, 640), (620, 656), (680, 667), (750, 670),
               (750, 700), (680, 698), (620, 690), (575, 674), (535, 650), (495, 613), (455, 568), (420, 528), (385, 496), (345, 471), (300, 457), (250, 451), (200, 456), (160, 467), (120, 485), (90, 502), (68, 515)),
     front=fr((313, 445), (358, 430), (418, 430), (463, 440), (493, 465), (503, 500), (503, 535), (488, 560), (448, 572), (378, 572), (323, 562), (293, 545), (248, 600), (203, 705), (158, 705), (198, 610), (243, 525), (283, 475)),
     top=top((84, 210), (84, 290), (96, 322), (120, 338), (160, 344), (400, 344), (560, 330), (680, 300), (700, 296), (700, 243), (680, 200), (578, 190), (222, 113), (175, 110), (130, 125), (100, 160)),
     feats={'side': [{'kind': 'highlight', 'pts': side((84, 488), (120, 464), (160, 444), (200, 430), (240, 422), (280, 420), (320, 426), (358, 440), (396, 466), (436, 508), (476, 554), (520, 600), (566, 638), (620, 660), (700, 672)), 'width': 2},
                     {'kind': 'crease', 'pts': side((100, 484), (160, 456), (220, 440), (270, 436), (330, 446), (376, 470), (416, 510), (456, 556), (500, 602), (548, 640), (610, 668), (690, 680))}],
            'front': [{'kind': 'highlight', 'pts': fr((480, 470), (440, 446), (380, 442), (330, 452)), 'width': 2}],
            'top': [{'kind': 'highlight', 'pts': top((120, 320), (300, 326), (480, 320)), 'width': 2}]})
part('fenderR', 'fenderR', 'paint2', 'fender', color=WING, fit=2, nofit=('top', 'rear'), slot='fenderR', pair=True, cutWheel={'i': 1, 'r': R + 6}, smooth=('rear', 'side', 'top'),
     side=side((1336, 700), (1340, 640), (1350, 580), (1368, 520), (1395, 470), (1430, 435), (1475, 412), (1530, 400), (1580, 398), (1630, 408), (1680, 430), (1720, 465), (1750, 510), (1775, 560), (1800, 615), (1825, 660), (1848, 682),
               (1836, 690), (1810, 674), (1785, 632), (1760, 582), (1735, 532), (1705, 492), (1670, 462), (1625, 442), (1575, 432), (1525, 434), (1480, 447), (1440, 470), (1410, 502), (1388, 547), (1376, 602), (1374, 700)),
     rear=re((366, 846), (366, 500), (374, 474), (396, 462), (470, 462), (500, 476), (513, 510), (513, 800), (500, 840)),
     top=top((1160, 243), (1160, 316), (1180, 330), (1240, 342), (1300, 345), (1560, 345), (1620, 335), (1670, 308), (1690, 270), (1697, 215), (1688, 205), (1655, 235), (1600, 245)),
     feats={'side': [{'kind': 'highlight', 'pts': side((1356, 580), (1374, 524), (1402, 476), (1436, 444), (1478, 422), (1530, 410), (1580, 408), (1628, 418), (1676, 440), (1714, 473), (1742, 516), (1768, 566), (1794, 620)), 'width': 2},
                     {'kind': 'crease', 'pts': side((1362, 600), (1380, 536), (1408, 488), (1444, 456), (1484, 436), (1530, 424), (1578, 422), (1626, 432), (1670, 452), (1708, 484), (1736, 526), (1762, 578), (1788, 628), (1814, 668))}],
            'top': [{'kind': 'highlight', 'pts': top((1220, 326), (1400, 332), (1580, 326)), 'width': 2}]})
# the running board: an aluminium tread plate with a bright edge strip its whole length
part('board', 'board', 'chrome', 'flat', color='#8c8a8a', slot='board', pair=True, side=side((700, 656), (1338, 656), (1338, 700), (750, 700), (700, 680)), top=top((700, 243), (700, 316), (1160, 316), (1160, 243)), detail={'kind': 'ribs', 'pitch': 26})
part('boardTrim', 'board', 'chrome', 'flat', on='board', slot='board', pair=True, color='#b4b2b0', side=side((752, 679), (1336, 679), (1336, 701), (752, 701)), top=top((704, 298), (704, 316), (1160, 316), (1160, 298)), lift=1)

# ---------------- lamps, bumpers, spare ----------------
# drum headlamps: a deep bright rim and a black bowl behind it on a short stand; face on a rim round a pale lens
part('lamp', 'lamp', 'black', 'fender', slot='lamp', pair=True, smooth=('side', 'front', 'top'), color='#2f2d30',
     side=side((150, 344), (158, 336), (190, 336), (214, 344), (232, 362), (236, 384), (226, 400), (192, 422), (158, 424), (150, 416)),
     front=fell(223, 440, 77), top=top((112, 85), (112, 195), (160, 195), (184, 180), (200, 140), (184, 100), (160, 85)))
part('lampRim', 'lamp', 'chrome', 'flat', on='lamp', slot='lamp', pair=True, color='#b5b1b0', y=[F(150, 0)[0], F(296, 0)[0]], side=side((150, 344), (158, 336), (190, 336), (192, 422), (158, 424), (150, 416)), smooth=('side',),
     top=top((112, 85), (112, 195), (160, 195), (160, 85)), lift=1)
part('lampGap', 'lamp', 'chrome', 'flat', on='lamp', slot='lamp', pair=True, x=[S(150, 0)[0], S(154, 0)[0]], smooth=('front',), front=fell(223, 440, 75))
part('lens', 'lamp', 'lens', 'flat', on='lampGap', slot='lamp', pair=True, color='#cfc8b4', x=[S(149, 0)[0], S(153, 0)[0]], smooth=('front',), front=fell(223, 440, 63), detail={'kind': 'bowl'})
part('lampStand', 'lamp', 'black', 'flat', slot='lamp', pair=True, color='#2a2a2c', side=side((172, 420), (204, 418), (210, 434), (166, 434)), front=fr((208, 508), (238, 508), (246, 548), (200, 548)))
for k, (py, zf, zr) in enumerate(((605, 722, 742), (651, 778, 786))):
    part(f'bumperF{k}', 'bumperF', 'chrome', 'fender', slot='bumperF', side=side((2, py - 16), (36, py - 16), (41, py), (36, py + 16), (2, py + 16)), front=fhalf((0, zf - 14), (420, zf - 14), (430, zf), (420, zf + 14), (0, zf + 14)),
         top=halfT((2, 0), (2, 235), (10, 262), (40, 282), (58, 272), (38, 248), (28, 228), (28, 0)))
    xin = (208, 195)[k]
    part(f'bumperR{k}', 'bumperR', 'chrome', 'fender', slot='bumperR', pair=True, side=side((1884, py - 8 - 15), (1926, py - 8 - 15), (1926, py - 8 + 15), (1884, py - 8 + 15)),
         rear=re((xin, zr), (xin + 18, zr - 14), (505, zr - 14), (513, zr), (505, zr + 14), (xin + 18, zr + 14)), top=top((1712, 272), (1724, 286), (1750, 268), (1762, 205), (1762, 158), (1730, 158), (1730, 205), (1726, 246)))
part('clampF0', 'bumperF', 'chrome', 'flat', on='bumperF0', slot='bumperF', pair=True, x=[0, 30], front=fr((210, 700), (236, 700), (236, 800), (210, 800)))
part('clampF1', 'bumperF', 'chrome', 'flat', on='bumperF0', slot='bumperF', x=[0, 32], front=fhalf((0, 700), (10, 702), (14, 720), (14, 780), (8, 796), (0, 800)), side=side((4, 586), (38, 586), (38, 670), (4, 670)), lift=1)   # the medallion bar at the centre
part('clampR0', 'bumperR', 'chrome', 'flat', on='bumperR0', slot='bumperR', pair=True, x=[S(1880, 0)[0], S(1904, 0)[0]], rear=re((316, 722), (336, 722), (336, 806), (316, 806)))
part('ironF', 'bumperF', 'black', 'flat', slot='bumperF', pair=True, side=side((38, 606), (60, 610), (60, 650), (38, 652)), top=top((28, 58), (28, 74), (94, 74), (94, 58)), lift=1)
part('ironR', 'bumperR', 'black', 'flat', slot='bumperR', pair=True, side=side((1846, 640), (1884, 606), (1884, 650), (1852, 660)), top=top((1684, 210), (1684, 224), (1728, 224), (1728, 210)))
# one tail lamp, on a stem on the left rear wing (rear view): a bright rim and a red glass; the number plate under it
part('tailRim', 'tail', 'chrome', 'fender', slot='tail', smooth=('rear',), x=[S(1890, 0)[0], S(1864, 0)[0]], rear=bell(330, 546, 30))
part('tail', 'tail', 'lensR', 'flat', on='tailRim', slot='tail', smooth=('rear',), x=[S(1892, 0)[0], S(1866, 0)[0]], rear=bell(330, 546, 19))
part('plateRim', 'tail', 'chrome', 'flat', color='#c9c7c2', x=[S(1860, 0)[0], S(1866, 0)[0]], rear=rrect(B(238, 0)[0], B(0, 692)[1], B(438, 0)[0], B(0, 592)[1], 10), lift=1)
part('plate', 'tail', 'black', 'flat', on='plateRim', x=[S(1860, 0)[0], S(1867, 0)[0]], rear=rrect(B(245, 0)[0], B(0, 685)[1], B(431, 0)[0], B(0, 599)[1], 6), lift=2)
# the spare on the back: edge on from the side and above (the road tyres' own section), an artillery wheel from behind
def tyre_section(u0, u1, v0, v1, across_first=True):
    lo_u, hi_u = 581, 807; hi_v = 762
    return [[round(u0 + (q[0] - lo_u) / (hi_u - lo_u) * (u1 - u0)), round(v0 + q[1] / hi_v * (v1 - v0))] if across_first else
            [round(v0 + q[1] / hi_v * (v1 - v0)), round(u0 + (q[0] - lo_u) / (hi_u - lo_u) * (u1 - u0))] for q in tyre0]
part('spareCarrier', 'spare', 'black', 'flat', color=BLK, side=side((1740, 470), (1806, 462), (1806, 560), (1736, 548)), top=halfT((1694, 0), (1694, 60), (1714, 60), (1714, 0)))
part('spare', 'spare', 'rubber', 'fender', wheel={'r': 425},
     side=tyre_section(S(1800, 0)[0], S(1900, 0)[0], S(0, 706)[1], S(0, 316)[1]), rear=bell(0, 600, 232),
     top=tyre_section(T(1708, 0)[0], T(1812, 0)[0], -T(0, 165)[1], T(0, 165)[1]), smooth=('side', 'top'), detail={'kind': 'treadFace', 'pitch': 36})

# ---------------- the chassis under the body: the draft's chassis-layer parts moved onto this car's wheels ----------------
D = json.load(open(DRAFT)); dw = D['wheels']; kx = (RX - FX) / (dw[1]['x'] - dw[0]['x']); ky = W / D['width']; kz = H / D['height']
mx = lambda v: round(FX + (v - dw[0]['x']) * kx); my = lambda v: round(v * ky); mz = lambda v: round(v * kz)
for p in D['parts']:
    if p.get('layer') != 'chassis': continue
    q = json.loads(json.dumps(p)); b = q['box']; q['box'] = {'x': [mx(b['x'][0]), mx(b['x'][1])], 'y': [my(b['y'][0]), my(b['y'][1])], 'z': [mz(b['z'][0]), mz(b['z'][1])]}
    for v, sb in q.get('sheet', {}).items():
        fa, fb = {'side': (mx, mz), 'front': (my, mz), 'rear': (my, mz), 'top': (mx, my)}[v]; q['sheet'][v] = [fa(sb[0]), fa(sb[1]), fb(sb[2]), fb(sb[3])]
    P.append(q)

M = {'id': 'dodgeV28', 'name': '1928 six sedan', 'year': 1928, 'length': L, 'width': W, 'height': H,
     'paint': '#1c2a42', 'paint2': '#27272b', 'canvas': '#29292d', 'chrome': '#a9a6a5', 'glassTint': '#b7bdc5',
     'wheels': [{'x': FX, 'r': R, 'y': 718}, {'x': RX, 'r': R, 'y': 718}],
     'wheel': {'rim': 0.68, 'style': 'artillery', 'spokes': 16, 'rimMaterial': 'paint', 'cap': 0.2, 'capRings': 1, 'trim': True},   # wooden-spoke wheels painted the body's blue, sixteen spokes, a thin bright ring on the rim, a nickel hub cap
     'parts': P}
json.dump(M, open(OUT, 'w'), indent=0)
print(OUT, len(P), 'parts;', sum(len(p['outlines']) for p in P), 'outlines')
print('outlines pulled onto the drawing, mean move in mm:', SNAP)
print('where a view of the sheet differs from the common box by more than 50 mm (each view keeps its own):'); print('\n'.join('  ' + n for n in notes))
