"""The 1926 large sedan (sheet: the right-hand car) as one 3D part model, made by hand in the way of
tools/ref/sedan29_model.py: every part is a box in the car's space (x from the front bumper back, y from the centre
line outwards, z up; mm) and its outline as the sheet shows it from the side, the front or rear, and above. Outlines
are read off the sheet's views in pixel positions on a 4x enlargement of each view (S side, F front, B rear, T plan).
The body-layer parts are written from scratch; the chassis-layer parts (engine, gearbox, exhaust ... under the body,
which no body view of the sheet shows) are taken from the converter's draft and moved onto this car's wheels.

  python3 hudson26.py <views dir> <out json> [draft json] [repository root]"""
import sys, os, json, math
HERE = os.path.dirname(os.path.abspath(__file__))
VIEWS, OUT = sys.argv[1], sys.argv[2]
DRAFT = sys.argv[3] if len(sys.argv) > 3 else f'{HERE}/draft/hudson26_auto.json'
REPO = sys.argv[4] if len(sys.argv) > 4 else '/home/user/1/gearhouse'
sys.path.insert(0, f'{REPO}/tools/ref')
import cv2, numpy as np
from zkit import View, fit_closed
from shapely.geometry import Polygon, box as sbox
from shapely.affinity import scale as sscale
from shapely.ops import unary_union

# ---- scale: the wheel centres are 1322 units apart on the 4x side view, the wheelbase is 3235 mm ----
K = 3235 / 1322                                           # mm per unit of the 4x side view (9.79 mm a pixel)
L, H, W = round(1928 * K), round(800 * K), 1720           # side view 482x200 px; width from the plan view (178/489 of the length)
C = W / 2
FX, RX, R = round(242 * K), round(1564 * K), 438
S = lambda px, py: [round(px * L / 1928), round(H - py * H / 800)]            # side view (482x200 px)
F = lambda dx, py: [round(dx * W / 932), round(H - py * H / 952)]             # front view (233x238 px): distance from the centre line, row
B = lambda dx, py: [round(dx * W / 880), round(H - py * H / 932)]             # rear view (220x233 px)
T = lambda px, dy: [round(px * L / 1956), round(dy * W / 712)]                # plan view (489x178 px): along, distance from the centre line
def side(*p): return [S(*q) for q in p]
def half(*p):
    r = [list(q) for q in p]; return r + [[-x, z] for x, z in reversed(r) if x != 0]
def fhalf(*p): return half(*[F(*q) for q in p])
def bhalf(*p): return half(*[B(*q) for q in p])
def halfT(*p):
    r = [T(*q) for q in p]; return r + [[x, -y] for x, y in reversed(r) if y != 0]
def top(*p): return [T(*q) for q in p]
def ell(cx, cz, rx, rz, n=24): return [[round(cx + math.cos(k / n * 6.2832) * rx), round(cz + math.sin(k / n * 6.2832) * rz)] for k in range(n)]
def rrect(x0, z0, x1, z1, r, n=4):
    out = []
    for cx, cz, a0 in ((x1 - r, z1 - r, 0), (x0 + r, z1 - r, 90), (x0 + r, z0 + r, 180), (x1 - r, z0 + r, 270)):
        for k in range(n + 1): a = math.radians(a0 + 90 * k / n); out.append([round(cx + math.cos(a) * r), round(cz + math.sin(a) * r)])
    return out

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
        if max(abs(t) for t in d) > 50: notes.append(f'{id:10s} {v:5s} differs from the common box by {d} mm (centre {a}, centre {b}, size {a}, size {b})')
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

# ---------------- running gear seen from outside ----------------
def arch(wx, r, lo, hi):
    """the dark of a wheel house: a half circle over the wheel, kept inside lo..hi (where the wing ends, the sheet shows daylight)"""
    a = [[min(hi, max(lo, round(wx + math.cos(t) * r))), round(R + math.sin(t) * r)] for t in [math.pi * k / 16 for k in range(16, -1, -1)]]
    return [[a[0][0], R - 60]] + a + [[a[-1][0], R - 60]]
part('house0', 'house', 'black', 'flat', y=[0, 560], side=arch(FX, 512, S(64, 0)[0], FX + 512))
part('house1', 'house', 'black', 'flat', y=[0, 560], side=arch(RX, 562, S(1362, 0)[0], S(1772, 0)[0]))
part('frame', 'frame', 'black', 'flat', pair=True, side=[[200, 500], [4420, 500], [4420, 610], [200, 610]], front=[[370, 500], [440, 500], [440, 610], [370, 610]], rear='front', top=[[200, 370], [4420, 370], [4420, 440], [200, 440]])
# from in front the sheet shows the axle, its spring and the steering gear as one dark band under the bumper, deeper below the frame rails
part('axleF', 'axle', 'black', 'flat', x=[FX - 40, FX + 40], front=fhalf((0, 812), (130, 814), (150, 836), (300, 838), (322, 815), (335, 800), (335, 770), (0, 770)))
part('springF', 'spring', 'iron', 'flat', x=[FX - 30, FX + 30], front=fhalf((0, 760), (120, 764), (300, 790), (330, 800), (330, 812), (300, 804), (120, 780), (0, 776)))
part('axleR', 'axle', 'black', 'flat', x=[RX - 47, RX + 47], rear=bhalf((0, 818), (60, 816), (90, 810), (300, 808), (300, 775), (90, 765), (60, 730), (0, 725)), smooth=('rear',))
part('springR', 'spring', 'iron', 'flat', x=[RX + 60, RX + 120], rear=bhalf((0, 700), (60, 704), (220, 740), (300, 770), (300, 786), (220, 756), (60, 720), (0, 716)))
tyre0 = [[606, 6], [640, 0], [748, 0], [782, 6], [798, 40], [805, 200], [807, 381], [804, 560], [796, 690], [782, 734], [760, 754], [725, 762], [663, 762], [628, 754], [606, 734], [592, 690], [584, 560], [581, 381], [583, 200], [590, 40]]   # a balloon section face on: flat where it stands, round at the top
def tyre(y0, y1): return [[round(y0 + (q[0] - 581) / 226 * (y1 - y0)), round(q[1] / 762 * 2 * R)] for q in tyre0]
TF = (F(331, 0)[0], F(438, 0)[0]); TR = (B(300, 0)[0], B(405, 0)[0])            # the tyres' inner and outer faces on the front and rear views
part('tyreF', 'wheel', 'rubber', 'fender', x=[FX - R, FX + R], pair=True, front=tyre(*TF), top=[[FX - R, TF[0]], [FX + R, TF[0]], [FX + R, TF[1]], [FX - R, TF[1]]], smooth=('front',), detail={'kind': 'treadFace', 'pitch': 40})
part('tyreR', 'wheel', 'rubber', 'fender', x=[RX - R, RX + R], pair=True, rear=tyre(*TR), top=[[RX - R, TR[0]], [RX + R, TR[0]], [RX + R, TR[1]], [RX - R, TR[1]]], smooth=('rear',), detail={'kind': 'treadFace', 'pitch': 40})

# ---------------- body ----------------
BLK = '#1d1d1e'                                           # the sheet's black of the valances: neutral, not the blue-black of the stock 'black'
# the dark between the wings ahead of the cowl (plan) and under the shell and lamps (front)
part('splash', 'apron', 'black', 'flat', color=BLK, z=[330, 900], top=halfT((64, 0), (64, 240), (575, 245), (575, 0)), front=fhalf((0, 792), (335, 792), (335, 600), (252, 600), (205, 700), (0, 700)))
part('crossF', 'frame', 'black', 'flat', x=[200, 300], z=[440, 500], top=[[200, -440], [200, 440], [300, 440], [300, -440]], front=half([0, 440], [440, 440], [440, 500], [0, 500]))
# the black valance between the body's bottom edge and the running board, running forward under the hood to the front wing
part('apron', 'apron', 'black', 'flat', color=BLK, y=[-600, 600], side=side((430, 546), (602, 548), (1352, 554), (1352, 652), (560, 652), (500, 610), (430, 546)), top=halfT((575, 0), (575, 250), (1346, 250), (1346, 0)))
# radiator: a tall flat nickel shell, square shouldered with a low arch on top; the core fills it (the sheet's lettering is left out)
part('shell', 'radiator', 'chrome', 'flat', slot='grille', fit=2.5, nofit=('top',),
     side=side((212, 560), (212, 300), (216, 272), (226, 256), (240, 252), (264, 252), (264, 560)),
     front=fhalf((0, 316), (50, 318), (92, 326), (124, 340), (144, 360), (154, 388), (157, 430), (157, 690), (150, 703), (134, 708), (0, 708)), smooth=('front',),
     top=halfT((160, 0), (160, 104), (205, 104), (205, 0)))
part('core', 'radiator', 'black', 'flat', on='shell', slot='grille', x=[S(214, 0)[0], S(220, 0)[0]], front=fhalf((0, 386), (30, 380), (96, 384), (120, 390), (131, 404), (132, 682), (0, 682)), detail={'kind': 'cells', 'pitch': 26})
part('badge', 'radiator', 'chrome', 'flat', on='shell', slot='grille', x=[S(210, 0)[0], S(214, 0)[0]], front=ell(0, F(0, 356)[1], 46, 62, 16), smooth=('front',), lift=1)
part('badgeGem', 'radiator', 'lensR', 'flat', on='badge', slot='grille', x=[S(209, 0)[0], S(212, 0)[0]], front=ell(0, F(0, 356)[1], 22, 30, 12), smooth=('front',), lift=2)
# the cap with its meter: a stem and a round head
part('cap', 'radiator', 'chrome', 'flat', slot='grille', smooth=('side', 'front'),
     side=side((226, 255), (230, 240), (224, 232), (232, 222), (224, 212), (226, 200), (238, 194), (250, 196), (258, 206), (256, 218), (250, 224), (256, 234), (254, 242), (258, 254)),
     front=fhalf((0, 234), (12, 238), (22, 252), (22, 266), (12, 280), (8, 288), (20, 296), (22, 312), (0, 318)),
     top=[[T(180, 0)[0] + round(math.cos(k / 12 * 6.2832) * 40), round(math.sin(k / 12 * 6.2832) * 40)] for k in range(12)])
part('hood', 'hood', 'paint', 'side', fit=2.5,
     side=side((264, 252), (602, 249), (602, 547), (264, 547)),
     front=fhalf((0, 306), (120, 309), (188, 322), (220, 345), (228, 420), (228, 706), (0, 706)), smooth=('front',), nofit=('front',),
     top=halfT((205, 0), (205, 104), (565, 176), (565, 0)),
     feats={'side': [{'kind': 'louvres', 'x0': S(326, 0)[0], 'x1': S(560, 0)[0], 'z0': S(0, 486)[1], 'z1': S(0, 352)[1], 'n': 12, 'slant': 0},
                     {'kind': 'seam', 'pts': side((266, 322), (600, 320))}, {'kind': 'highlight', 'pts': side((270, 296), (440, 295), (598, 293)), 'width': 2}],
            'top': [{'kind': 'trim', 'pts': top((208, 0), (563, 0)), 'width': 1}, {'kind': 'highlight', 'pts': top((215, 92), (560, 150)), 'width': 2}, {'kind': 'highlight', 'pts': top((215, -92), (560, -150)), 'width': 2}]})
part('cowl', 'cowl', 'paint', 'side', fit=2.5, nofit=('front',),
     side=side((602, 249), (660, 246), (700, 242), (722, 238), (724, 287), (757, 289), (757, 553), (602, 548)),
     front=fhalf((0, 298), (200, 302), (258, 312), (282, 330), (286, 440), (286, 706), (0, 706)), smooth=('front',),
     top=halfT((565, 0), (565, 176), (656, 192), (656, 0)),
     feats={'side': [{'kind': 'highlight', 'pts': side((606, 293), (700, 290), (722, 286)), 'width': 2}],
            'top': [{'kind': 'trim', 'pts': top((567, 0), (655, 0)), 'width': 1}]})
# the body: a tall closed sedan body, maroon up to the belt moulding; above the belt it is black (bodyTop)
BODY_TOP = ((700, 0), (700, 250), (1100, 284), (1300, 291), (1400, 296), (1700, 296), (1752, 288), (1792, 264), (1817, 224), (1824, 178), (1824, 0))
part('body', 'body', 'paint', 'side', fit=2.5, nofit=('top', 'front'),
     side=side((757, 553), (757, 289), (724, 287), (722, 62), (732, 46), (1716, 46), (1822, 48), (1822, 268), (1816, 292), (1806, 380), (1790, 452), (1776, 484), (1754, 508), (1730, 484), (1702, 452), (1668, 425), (1628, 406), (1584, 396), (1540, 397), (1496, 409), (1456, 430), (1422, 462), (1398, 498), (1380, 538), (1374, 553)),
     front=fhalf((0, 78), (346, 78), (346, 312), (344, 322), (334, 450), (326, 640), (0, 640)),
     rear=bhalf((0, 62), (366, 62), (367, 330), (360, 352), (358, 440), (352, 484), (340, 560), (322, 604), (290, 616), (0, 616)),
     top=halfT(*BODY_TOP),
     feats={'side': [{'kind': 'seam', 'pts': side((757, 290), (757, 552))}, {'kind': 'seam', 'pts': side((1082, 290), (1082, 552))},
                     {'kind': 'seam', 'pts': side((1380, 290), (1380, 420), (1364, 468), (1348, 530))},
                     {'kind': 'bead', 'pts': side((759, 300), (1200, 300), (1712, 300))}, {'kind': 'highlight', 'pts': side((762, 304), (1708, 304)), 'width': 1},
                     {'kind': 'crease', 'pts': side((760, 541), (1340, 541))},
                     {'kind': 'handle', 'at': S(1050, 320), 'len': 110}, {'kind': 'handle', 'at': S(1118, 320), 'len': 110},
                     {'kind': 'hinge', 'at': S(757, 325)}, {'kind': 'hinge', 'at': S(757, 470)}, {'kind': 'hinge', 'at': S(1380, 325)}],
            'rear': [{'kind': 'seam', 'pts': [B(252, 330), B(252, 612)]}, {'kind': 'seam', 'pts': [B(-252, 330), B(-252, 612)]},
                     {'kind': 'highlight', 'pts': [B(-356, 372), B(-250, 362), B(0, 360), B(250, 362), B(356, 372)], 'width': 1}]})
part('bodyTop', 'body', 'paint2', 'side', on='body', color='#1e1e1f', fit=2.5, nofit=('front', 'rear'), y=[0, 692],
     side=side((722, 289), (722, 62), (732, 46), (1716, 46), (1822, 48), (1823, 268), (1816, 284), (1712, 291), (757, 291)),
     front=fhalf((0, 78), (346, 78), (347, 316), (300, 312), (270, 304), (0, 300)),
     rear=bhalf((0, 62), (366, 62), (368, 330), (364, 348), (320, 336), (252, 320), (0, 316)),
     feats={'side': [{'kind': 'seam', 'pts': side((1082, 48), (1082, 290))}, {'kind': 'seam', 'pts': side((1380, 48), (1380, 290))}, {'kind': 'seam', 'pts': side((1712, 48), (1712, 290))},
                     {'kind': 'bead', 'pts': side((724, 286), (1712, 288), (1818, 280))}],
            'rear': [{'kind': 'seam', 'pts': [B(252, 64), B(252, 320)]}, {'kind': 'seam', 'pts': [B(-252, 64), B(-252, 320)]},
                     {'kind': 'bead', 'pts': [B(-366, 338), B(-252, 316), B(0, 311), B(252, 316), B(366, 338)]}]})
# the roof: black cloth over a rounded cap, a drip rail along its edge; no wider than the body
part('roof', 'roof', 'canvas', 'roof', fit=2.5, nofit=('front', 'rear', 'top'),
     side=side((696, 52), (700, 44), (740, 32), (820, 22), (920, 13), (1100, 4), (1300, 1), (1500, 1), (1715, 4), (1768, 8), (1800, 20), (1818, 38), (1824, 50), (1716, 50), (760, 50)),
     front=fhalf((0, 0), (120, 0), (190, 2), (244, 5), (290, 10), (314, 18), (330, 30), (341, 41), (348, 54), (353, 64), (354, 72), (350, 78), (0, 78)),
     rear=bhalf((0, 0), (160, 0), (250, 2), (296, 5), (330, 12), (348, 22), (360, 35), (366, 46), (370, 56), (372, 64), (368, 71), (0, 70)),
     top=halfT(*BODY_TOP),
     feats={'top': [{'kind': 'seam', 'pts': top((735, 0), (735, 200), (760, 225), (1100, 250), (1700, 262), (1745, 250), (1775, 222), (1790, 170), (1790, 0))},
                    {'kind': 'seam', 'pts': top((735, 0), (735, -200), (760, -225), (1100, -250), (1700, -262), (1745, -250), (1775, -222), (1790, -170), (1790, 0))}]})
# the visor over the windscreen: a cloth-covered board sloping forward and down from the roof's front edge
part('visor', 'roof', 'canvas', 'roof', fit=2, nofit=('front', 'top'),
     side=side((696, 50), (722, 52), (722, 68), (700, 78), (664, 92), (650, 86), (650, 74), (670, 60)),
     front=fhalf((0, 64), (252, 64), (271, 72), (264, 118), (0, 118)),
     top=halfT((655, 0), (655, 192), (662, 216), (680, 238), (700, 250), (700, 0)))
part('screenFrame', 'screen', 'black', 'flat', on='bodyTop', x=[S(722, 0)[0], S(736, 0)[0]], front=fhalf((0, 118), (264, 118), (264, 298), (0, 298)))
part('screen', 'screen', 'glass', 'side', on='screenFrame', x=[S(724, 0)[0], S(734, 0)[0]], front=fhalf((0, 128), (240, 128), (240, 284), (0, 284)))
part('screenBar', 'screen', 'black', 'flat', on='screen', x=[S(722, 0)[0], S(734, 0)[0]], front=fhalf((0, 196), (240, 196), (240, 201), (0, 201)), lift=1)   # the screen is in two, one above the other
# the front corner lights, between the screen pillar and the door pillar, as the front view shows them
part('wframeQ', 'body', 'paint', 'side', on='bodyTop', pair=True, x=[S(740, 0)[0], S(770, 0)[0]], front=[F(*q) for q in ((294, 96), (332, 92), (338, 100), (338, 300), (294, 300))])
part('glassQ', 'body', 'glass', 'side', on='wframeQ', pair=True, x=[S(742, 0)[0], S(768, 0)[0]], front=[F(*q) for q in ((302, 106), (328, 104), (330, 110), (330, 292), (302, 292))])
part('doorHandle', 'body', 'chrome', 'flat', pair=True, x=[S(1040, 0)[0], S(1062, 0)[0]], front=[F(*q) for q in ((306, 346), (340, 344), (358, 348), (358, 358), (340, 362), (306, 358))], smooth=('front',))
# side windows: three a side, each a square-cornered opening with a thin maroon reveal
WIN = ((780, 65, 1056, 262), (1114, 65, 1360, 262), (1402, 65, 1690, 262))
for k, (a, b, c, d) in enumerate(WIN):
    (x0, z1), (x1, z0) = S(a, b), S(c, d)
    part(f'wframe{k}', 'body', 'paint', 'side', on='bodyTop', y=[692, 694], pair=True, side=rrect(x0, z0, x1, z1, 40))
    part(f'glass{k}', 'body', 'glass', 'side', on=f'wframe{k}', y=[694, 696], pair=True, side=rrect(x0 + 16, z0 + 16, x1 - 16, z1 - 16, 30))
part('rearFrame', 'body', 'black', 'flat', on='bodyTop', x=[S(1818, 0)[0], S(1822, 0)[0]], rear=[[a, b] for a, b in rrect(B(-202, 0)[0], B(0, 278)[1], B(202, 0)[0], B(0, 86)[1], 30)])
part('rearGlass', 'body', 'glass', 'side', on='rearFrame', x=[S(1816, 0)[0], S(1820, 0)[0]], rear=[[a, b] for a, b in rrect(B(-192, 0)[0], B(0, 268)[1], B(192, 0)[0], B(0, 96)[1], 18)])
part('rearApron', 'body', 'black', 'flat', x=[S(1700, 0)[0], S(1790, 0)[0]], rear=bhalf((0, 610), (345, 610), (345, 800), (120, 806), (0, 800)))

# ---------------- wings, boards ----------------
part('fenderF', 'fenderF', 'paint2', 'fender', fit=2, nofit=('top',), slot='fenderF', pair=True, cutWheel={'i': 0, 'r': R + 12}, smooth=('front', 'side'),
     side=side((48, 492), (56, 470), (80, 441), (110, 419), (160, 398), (215, 386), (270, 386), (320, 398), (370, 424), (410, 458), (450, 504), (490, 554), (530, 600), (570, 631), (610, 646), (654, 650),
               (654, 672), (606, 670), (562, 656), (524, 628), (484, 584), (444, 534), (402, 488), (362, 454), (318, 430), (272, 418), (224, 417), (174, 428), (130, 450), (98, 477), (74, 496), (54, 502)),
     front=[F(*q) for q in ((466, 541), (462, 512), (446, 488), (418, 474), (380, 469), (340, 474), (312, 490), (298, 512), (270, 546), (236, 602), (204, 656), (178, 688), (160, 700), (160, 716), (196, 712), (226, 688), (256, 648),
                            (288, 606), (330, 612), (380, 614), (420, 610), (448, 596), (462, 572))],
     top=top((62, 290), (64, 314), (72, 332), (86, 343), (106, 347), (380, 347), (400, 345), (420, 340), (575, 337), (575, 180), (430, 206), (300, 242), (112, 246), (80, 244), (66, 236)),
     feats={'side': [{'kind': 'highlight', 'pts': side((70, 462), (112, 428), (160, 408), (215, 396), (270, 396), (318, 408), (365, 433), (404, 466), (444, 512)), 'width': 2}],
            'top': [{'kind': 'highlight', 'pts': top((110, 330), (300, 334), (400, 330)), 'width': 2}]})
part('fenderR', 'fenderR', 'paint2', 'fender', fit=2, nofit=('top', 'rear'), slot='fenderR', pair=True, cutWheel={'i': 1, 'r': R + 12}, smooth=('rear', 'side'),
     side=side((1344, 668), (1344, 604), (1352, 560), (1365, 520), (1386, 480), (1415, 441), (1452, 410), (1500, 386), (1560, 373), (1610, 375), (1660, 392), (1700, 420), (1736, 460), (1762, 505), (1782, 550), (1802, 590), (1826, 618), (1846, 628),
               (1842, 636), (1814, 630), (1788, 600), (1766, 558), (1744, 512), (1718, 472), (1688, 440), (1650, 414), (1606, 399), (1560, 396), (1506, 407), (1458, 430), (1422, 462), (1398, 498), (1380, 538), (1368, 584), (1364, 668)),
     rear=[B(*q) for q in ((338, 786), (338, 520), (346, 498), (368, 485), (414, 484), (432, 494), (440, 520), (440, 760), (432, 782), (410, 790))],
     top=top((1346, 286), (1346, 322), (1352, 338), (1366, 348), (1400, 351), (1795, 351), (1814, 346), (1830, 334), (1842, 314), (1847, 290), (1848, 200), (1824, 190), (1790, 262), (1700, 296)),
     feats={'side': [{'kind': 'highlight', 'pts': side((1372, 522), (1392, 486), (1420, 450), (1456, 420), (1502, 396), (1560, 383), (1608, 385), (1656, 402), (1694, 428)), 'width': 2}],
            'top': [{'kind': 'highlight', 'pts': top((1400, 338), (1600, 342), (1780, 338)), 'width': 2}]})
part('board', 'board', 'rubber', 'flat', color='#232325', slot='board', pair=True, side=side((652, 646), (1350, 646), (1350, 668), (652, 668)), top=top((575, 240), (575, 337), (1346, 337), (1346, 240)))
part('boardTrim', 'board', 'chrome', 'flat', on='board', slot='board', pair=True, y=[T(0, 332)[1], T(0, 337)[1]], side=side((656, 644), (1348, 644), (1348, 664), (656, 664)), lift=1)   # a nickel edge strip along the board
for k, ((a, b), (ta, tb, t0)) in enumerate((((782, 918), (745, 882, 262)), ((1132, 1268), (1125, 1260, 291)))):
    part(f'step{k}', 'board', 'chrome', 'flat', slot='board', pair=True, side=side((a + 8, 602), (b - 8, 602), (b, 610), (b, 642), (a, 642), (a, 610)), top=top((ta, t0), (ta, 321), (tb, 321), (tb, t0)), lift=2, detail={'kind': 'ribs', 'pitch': 22})

# ---------------- lamps, bumpers, spare ----------------
# drum headlamps: a nickel rim and a black bowl behind it (side, plan); face on a nickel rim round a pale lens
part('lamp', 'lamp', 'black', 'fender', slot='lamp', pair=True, fit=2, nofit=('front', 'top'), smooth=('side', 'top'), color='#26282a',
     side=side((160, 312), (176, 318), (194, 332), (208, 350), (215, 370), (213, 392), (160, 394)),
     top=top((132, 90), (165, 106), (184, 134), (190, 150), (184, 166), (165, 194), (132, 210)))
part('lampRim', 'lamp', 'chrome', 'fender', slot='lamp', pair=True, smooth=('front',),
     side=side((137, 326), (144, 314), (160, 312), (164, 320), (164, 394), (140, 394), (136, 380)),
     front=ell(F(210, 0)[0], F(0, 500)[1], F(65, 0)[0], round(65 * H / 952)), top=top((102, 94), (108, 88), (134, 88), (134, 212), (108, 212), (102, 206)))
part('lens', 'lamp', 'chrome', 'flat', on='lampRim', slot='lamp', pair=True, x=[S(136, 0)[0], S(140, 0)[0]], smooth=('front',), front=ell(F(210, 0)[0], F(0, 500)[1], F(54, 0)[0], round(54 * H / 952)), detail={'kind': 'bowl'})
part('lampStand', 'lamp', 'chrome', 'flat', slot='lamp', pair=True, x=[S(170, 0)[0], S(186, 0)[0]], front=[F(*q) for q in ((204, 564), (216, 564), (217, 650), (203, 650))])
for k, (py, zf, zr) in enumerate(((560, 730, 701), (604, 768, 743))):
    part(f'bumperF{k}', 'bumperF', 'chrome', 'fender', slot='bumperF', side=side((2, py - 13), (30, py - 13), (36, py), (30, py + 13), (2, py + 13)), front=fhalf((0, zf - 10), (350, zf - 10), (357, zf), (350, zf + 10), (0, zf + 10)),
         top=halfT((0, 0), (0, 266), (8, 278), (22, 278), (26, 262), (26, 0)))
    part(f'bumperR{k}', 'bumperR', 'chrome', 'fender', slot='bumperR', pair=True, side=side((1830, py + 10 - 11), (1926, py + 10 - 11), (1926, py + 10 + 11), (1830, py + 10 + 11)),
         rear=[B(*q) for q in ((176, zr - 11), (405, zr - 11), (410, zr), (405, zr + 11), (176, zr + 11))], top=top((1850, 212), (1850, 258), (1870, 262), (1898, 256), (1900, 222), (1880, 210)))
part('clampF0', 'bumperF', 'chrome', 'flat', on='bumperF0', slot='bumperF', pair=True, x=[0, 30], front=[F(*q) for q in ((138, 712), (166, 712), (166, 786), (138, 786))])
part('clampR0', 'bumperR', 'chrome', 'flat', on='bumperR0', slot='bumperR', pair=True, x=[S(1830, 0)[0], S(1860, 0)[0]], rear=[B(*q) for q in ((174, 682), (200, 682), (200, 762), (174, 762))])
part('ironF', 'bumperF', 'black', 'flat', slot='bumperF', pair=True, side=side((34, 566), (74, 582), (76, 602), (34, 602)), top=top((24, 148), (24, 166), (112, 166), (112, 148)), lift=1)
part('ironR', 'bumperR', 'black', 'flat', slot='bumperR', pair=True, side=side((1786, 582), (1830, 572), (1830, 608), (1800, 606)), top=top((1790, 196), (1790, 214), (1852, 214), (1852, 196)))
# one tail lamp, on the left of the back panel (rear sheet): a nickel rim and a red glass
part('tailRim', 'tail', 'chrome', 'fender', on='body', slot='tail', smooth=('rear',), x=[S(1790, 0)[0], S(1800, 0)[0]], rear=ell(B(274, 0)[0], B(0, 572)[1], B(34, 0)[0], round(34 * H / 932)))
part('tail', 'tail', 'lensR', 'flat', on='tailRim', slot='tail', smooth=('rear',), x=[S(1792, 0)[0], S(1802, 0)[0]], rear=ell(B(274, 0)[0], B(0, 572)[1], B(25, 0)[0], round(25 * H / 932)))
# the spare on the back: edge on from the side and above (the road tyres' own section), a wheel from behind
def tyre_section(u0, u1, v0, v1, across_first=True):
    lo_u, hi_u = 581, 807; hi_v = 762
    return [[round(u0 + (q[0] - lo_u) / (hi_u - lo_u) * (u1 - u0)), round(v0 + q[1] / hi_v * (v1 - v0))] if across_first else
            [round(v0 + q[1] / hi_v * (v1 - v0)), round(u0 + (q[0] - lo_u) / (hi_u - lo_u) * (u1 - u0))] for q in tyre0]
part('spareCarrier', 'spare', 'black', 'flat', color=BLK, side=side((1786, 470), (1820, 462), (1820, 520), (1790, 500)), top=halfT((1818, 0), (1818, 170), (1840, 190), (1872, 150), (1872, 0)))
part('spare', 'spare', 'rubber', 'fender', wheel={'r': 420},
     side=tyre_section(S(1816, 0)[0], S(1922, 0)[0], S(0, 660)[1], S(0, 322)[1]), rear=ell(0, B(0, 608)[1], B(210, 0)[0], round(214 * H / 932)),
     top=tyre_section(T(1866, 0)[0], T(1953, 0)[0], -T(0, 184)[1], T(0, 184)[1]), smooth=('side', 'top'), detail={'kind': 'treadFace', 'pitch': 40})

# ---------------- the chassis under the body: the draft's chassis-layer parts moved onto this car's wheels ----------------
D = json.load(open(DRAFT)); dw = D['wheels']; kx = (RX - FX) / (dw[1]['x'] - dw[0]['x']); ky = W / D['width']; kz = H / D['height']
mx = lambda v: round(FX + (v - dw[0]['x']) * kx); my = lambda v: round(v * ky); mz = lambda v: round(v * kz)
for p in D['parts']:
    if p.get('layer') != 'chassis': continue
    q = json.loads(json.dumps(p)); b = q['box']; q['box'] = {'x': [mx(b['x'][0]), mx(b['x'][1])], 'y': [my(b['y'][0]), my(b['y'][1])], 'z': [mz(b['z'][0]), mz(b['z'][1])]}
    for v, sb in q.get('sheet', {}).items():
        fa, fb = {'side': (mx, mz), 'front': (my, mz), 'rear': (my, mz), 'top': (mx, my)}[v]; q['sheet'][v] = [fa(sb[0]), fa(sb[1]), fb(sb[2]), fb(sb[3])]
    P.append(q)

M = {'id': 'hudson26', 'name': '1926 large sedan', 'year': 1926, 'length': L, 'width': W, 'height': H,
     'paint': '#431d23', 'paint2': '#2b2c2e', 'canvas': '#28282a', 'chrome': '#9a9185', 'glassTint': '#9ca6b0',
     'wheels': [{'x': FX, 'r': R, 'y': 700}, {'x': RX, 'r': R, 'y': 700}],
     'wheel': {'rim': 0.69, 'style': 'artillery', 'spokes': 12, 'rimMaterial': 'paint', 'cap': 0.2, 'capRings': 1, 'trim': True},   # wooden-spoke wheels, twelve spokes, painted the body's colour, a nickel hub cap
     'parts': P}
json.dump(M, open(OUT, 'w'), indent=0)
print(OUT, len(P), 'parts;', sum(len(p['outlines']) for p in P), 'outlines')
print('outlines pulled onto the drawing, mean move in mm:', SNAP)
print('where a view of the sheet differs from the common box by more than 50 mm (each view keeps its own):'); print('\n'.join('  ' + n for n in notes))
