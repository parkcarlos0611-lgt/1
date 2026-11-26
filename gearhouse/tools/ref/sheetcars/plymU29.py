"""The 1929 light four sedan (sheet 624bbd1c, the right-hand car) as one 3D part model, made by hand in the way of
tools/ref/sedan29_model.py: every part is a box in the car's space (x from the front bumper back, y from the centre
line outwards, z up; mm) and its outline as the sheet shows it from the side, the front or rear, and above. Outlines
are read off the sheet's views in pixel positions on a 4x enlargement of each view (S side, F front, B rear, T plan).
The body-layer parts are written from scratch; the chassis-layer parts (engine, gearbox, exhaust ... under the body,
which no body view of the sheet shows) are taken from the converter's draft and moved onto this car's wheels.

  python3 plymU29.py <views dir> <out json> [draft json] [repository root]"""
import sys, os, json, math
HERE = os.path.dirname(os.path.abspath(__file__))
VIEWS, OUT = sys.argv[1], sys.argv[2]
DRAFT = sys.argv[3] if len(sys.argv) > 3 else f'{HERE}/draft/plymU29_auto.json'
REPO = sys.argv[4] if len(sys.argv) > 4 else '/home/user/1/gearhouse'
sys.path.insert(0, f'{REPO}/tools/ref')
import cv2, numpy as np
from zkit import View, fit_closed
from shapely.geometry import Polygon, box as sbox
from shapely.affinity import scale as sscale
from shapely.ops import unary_union

# ---- scale: the hub caps are 1294 units apart on the 4x side view (260 and 1554), the wheelbase is 2788 mm ----
K = 2788 / 1294                                           # mm per unit of the 4x side view (8.62 mm a pixel)
L, H = round(1880 * K), round(840 * K); W = round(936 * H / 976)   # review 72: the front view keeps the sheet's proportions (was 1700)           # side view 470x210 px; width: mean of the front (234x244) and rear (221x240) views' proportions
C = W / 2
FX, RX, R = round(260 * K), round(1554 * K), 384          # the tyres are 176-180 units in radius
S = lambda px, py: [round(px * L / 1880), round(H - py * H / 840)]            # side view (470x210 px)
F = lambda dx, py: [round(dx * H / 976), round(H - py * H / 976)]             # front view (234x244 px): distance from the centre line (x 466), row
B = lambda dx, py: [round(dx * H / 960), round(H - py * H / 960)]             # rear view (221x240 px): centre line x 442
T = lambda px, dy: [round(px * L / 1772), round(dy * W / 668)]                # plan view (443x167 px): along, distance from the centre line (y 334)
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
def srect(a, b, c, d, r=0):
    """a rounded box given in side-view units (left, top, right, bottom)"""
    (x0, z1), (x1, z0) = S(a, b), S(c, d); return rrect(x0, z0, x1, z1, r) if r else [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]

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

BLK = '#1b1b1c'                                           # the sheet's black of the valances and wheel houses: neutral, not the blue-black of the stock 'black'
YB = 690                                                  # the body side's distance from the centre line (rear view: 362 of 442 units)

# ---------------- the wings' outlines in the side view (needed by the wheel houses too) ----------------
# front wing: a lit blade from its tip ahead of the wheel, over the crown and down in an S to the running board
FF_UP = ((72, 520), (76, 500), (84, 482), (96, 468), (108, 456), (120, 447), (132, 438), (146, 432), (160, 428), (200, 421), (240, 416), (280, 415), (320, 419), (360, 428), (400, 443), (440, 463), (480, 489), (500, 509),
         (520, 534), (560, 582), (600, 621), (640, 648), (680, 669), (720, 681), (776, 687))
FF_LO = ((776, 702), (720, 700), (680, 695), (640, 679), (600, 656), (560, 624), (520, 582), (480, 538), (440, 506), (400, 486), (360, 473), (320, 467), (280, 465), (240, 467), (200, 473), (165, 484), (140, 500), (120, 518),
         (104, 532), (86, 534), (74, 528))
# rear wing: over the wheel and down to a tail behind it
FR_UP = ((1324, 696), (1325, 600), (1330, 546), (1348, 499), (1378, 462), (1410, 442), (1461, 419), (1512, 407), (1563, 405), (1613, 418), (1663, 446), (1713, 488), (1743, 533), (1773, 598), (1803, 648), (1838, 670), (1848, 678))
FR_LO = ((1813, 680), (1786, 678), (1756, 656), (1734, 612), (1714, 564), (1686, 516), (1640, 478), (1600, 463), (1558, 459), (1502, 463), (1456, 480), (1418, 506), (1390, 541), (1368, 584), (1356, 635), (1353, 696))

# ---------------- running gear seen from outside ----------------
# the dark of the wheel houses: everything under the wings' blades down to the frame (the sheet shows it black)
part('house0', 'house', 'black', 'flat', color=BLK, y=[0, 560], side=side(*FF_LO[::-1][3:], (776, 716), (120, 716)))
part('house1', 'house', 'black', 'flat', color=BLK, y=[0, 560], side=side(*FR_LO[::-1][:-1], (1740, 690), (1700, 716), (1345, 716)))
part('frame', 'frame', 'black', 'flat', pair=True, side=[[220, 470], [3900, 470], [3900, 570], [220, 570]], front=[[350, 470], [420, 470], [420, 570], [350, 570]], rear='front', top=[[220, 350], [3900, 350], [3900, 420], [220, 420]])
# from in front the sheet shows the axle, the springs and the steering gear as one dark band under the bumper, deeper by the wheels
part('axleF', 'axle', 'black', 'flat', color=BLK, x=[FX - 40, FX + 40], front=fhalf((0, 842), (100, 840), (230, 830), (262, 838), (280, 862), (318, 864), (322, 800), (322, 760), (0, 760)))
part('springF', 'spring', 'iron', 'flat', color='#2a2a2b', x=[FX - 30, FX + 30], front=fhalf((0, 792), (120, 794), (300, 800), (300, 812), (120, 808), (0, 806)))
part('axleR', 'axle', 'black', 'flat', color=BLK, x=[RX - 47, RX + 47], rear=bhalf((0, 844), (30, 842), (56, 828), (90, 812), (260, 808), (284, 826), (318, 830), (318, 770), (0, 770)), smooth=('rear',))
part('springR', 'spring', 'iron', 'flat', color='#2a2a2b', x=[RX + 60, RX + 120], rear=bhalf((0, 776), (120, 778), (300, 786), (300, 800), (120, 794), (0, 792)))
tyre0 = [[606, 6], [640, 0], [748, 0], [782, 6], [798, 40], [805, 200], [807, 381], [804, 560], [796, 690], [782, 734], [760, 754], [725, 762], [663, 762], [628, 754], [606, 734], [592, 690], [584, 560], [581, 381], [583, 200], [590, 40]]   # a balloon section face on: flat where it stands, round at the top
def tyre(y0, y1): return [[round(y0 + (q[0] - 581) / 226 * (y1 - y0)), round(q[1] / 762 * 2 * R)] for q in tyre0]
TF = (F(322, 0)[0], F(446, 0)[0]); TR = (B(318, 0)[0], B(420, 0)[0])            # the tyres' inner and outer faces on the front and rear views
part('tyreF', 'wheel', 'rubber', 'fender', x=[FX - R, FX + R], pair=True, front=tyre(*TF), top=[[FX - R, TF[0]], [FX + R, TF[0]], [FX + R, TF[1]], [FX - R, TF[1]]], smooth=('front',), detail={'kind': 'treadFace', 'pitch': 40})
part('tyreR', 'wheel', 'rubber', 'fender', x=[RX - R, RX + R], pair=True, rear=tyre(*TR), top=[[RX - R, TR[0]], [RX + R, TR[0]], [RX + R, TR[1]], [RX - R, TR[1]]], smooth=('rear',), detail={'kind': 'treadFace', 'pitch': 40})

# ---------------- body ----------------
# the dark between the wings ahead of the cowl (plan) and under the shell and lamps (front)
part('splash', 'apron', 'black', 'flat', color=BLK, z=[330, 880], top=halfT((66, 0), (66, 250), (560, 250), (560, 0)), front=fhalf((0, 712), (140, 712), (176, 660), (236, 600), (322, 590), (322, 800), (0, 800)))
part('crossF', 'frame', 'black', 'flat', x=[220, 320], z=[420, 480], top=[[220, -420], [220, 420], [320, 420], [320, -420]], front=half([0, 420], [420, 420], [420, 480], [0, 480]))
# the black valance between the body's bottom edge and the running board, running forward under the hood to the front wing
part('apron', 'apron', 'black', 'flat', color=BLK, y=[-600, 600], side=side((470, 520), (560, 586), (1326, 586), (1326, 716), (470, 716)), top=halfT((560, 0), (560, 250), (1215, 250), (1215, 0)))
# the bright moulding along the bottom of the body, over the valance
part('sill', 'body', 'iron', 'flat', color='#8a8b8d', pair=True, y=[YB - 4, YB + 2], side=side((564, 586), (1322, 586), (1326, 596), (1322, 606), (588, 606)))
# radiator: a nickel shell with a low arch on top and flat sides; the core fills it, a dark name plate across its head (the lettering is left out)
part('shell', 'radiator', 'chrome', 'flat', slot='grille',
     side=side((222, 584), (222, 292), (226, 274), (236, 264), (276, 262), (276, 584)),
     front=fhalf((0, 320), (40, 322), (78, 330), (106, 344), (124, 364), (133, 392), (136, 440), (136, 700), (130, 712), (0, 713)), smooth=('front',),
     top=halfT((190, 0), (190, 100), (196, 112), (226, 112), (226, 0)))
part('core', 'radiator', 'black', 'flat', on='shell', slot='grille', x=[S(222, 0)[0], S(228, 0)[0]], front=fhalf((0, 350), (56, 352), (88, 362), (104, 382), (110, 414), (110, 696), (0, 696)), detail={'kind': 'cells', 'pitch': 24})
part('plate', 'radiator', 'black', 'flat', on='core', slot='grille', color='#17181a', x=[S(220, 0)[0], S(224, 0)[0]], front=fhalf((0, 354), (54, 356), (84, 366), (100, 384), (105, 414), (0, 416)), smooth=('front',), lift=1)
part('badge', 'radiator', 'chrome', 'flat', on='plate', slot='grille', x=[S(219, 0)[0], S(222, 0)[0]], front=fhalf((0, 384), (52, 384), (56, 392), (52, 400), (0, 400)), lift=2)   # the bright bar the name stands on
part('shellFoot', 'radiator', 'chrome', 'flat', on='shell', slot='grille', x=[S(218, 0)[0], S(222, 0)[0]], front=fhalf((0, 706), (14, 708), (16, 722), (0, 724)), lift=1)   # the crank hole cover
# the cap with its winged figure
part('cap', 'radiator', 'chrome', 'flat', slot='grille', smooth=('side', 'front'),
     side=side((236, 264), (238, 252), (249, 246), (253, 234), (246, 227), (234, 226), (225, 216), (228, 202), (242, 196), (256, 199), (260, 212), (265, 228), (266, 244), (272, 253), (272, 264)),
     front=fhalf((0, 236), (12, 240), (19, 252), (15, 264), (8, 276), (15, 290), (20, 308), (14, 324), (0, 328)),
     top=[[T(204, 0)[0] + round(math.cos(k / 12 * 6.2832) * 42), round(math.sin(k / 12 * 6.2832) * 42)] for k in range(12)])
part('hood', 'hood', 'paint', 'side',
     side=side((276, 258), (420, 255), (645, 252), (645, 586), (276, 586)),
     front=fhalf((0, 324), (100, 328), (166, 340), (206, 358), (226, 386), (232, 440), (232, 700), (0, 700)), smooth=('front',),
     top=halfT((226, 0), (226, 114), (572, 211), (572, 0)),
     feats={'side': [{'kind': 'louvres', 'x0': S(327, 0)[0], 'x1': S(594, 0)[0], 'z0': S(0, 524)[1], 'z1': S(0, 372)[1], 'n': 20, 'slant': 0},
                     {'kind': 'seam', 'pts': side((278, 331), (643, 329))}, {'kind': 'highlight', 'pts': side((280, 293), (460, 292), (642, 290)), 'width': 3},
                     {'kind': 'seam', 'pts': side((322, 362), (606, 360), (616, 368), (616, 548), (606, 556), (480, 556))}],
            'top': [{'kind': 'trim', 'pts': top((230, 0), (570, 0)), 'width': 1}, {'kind': 'highlight', 'pts': top((236, 96), (566, 188)), 'width': 3}, {'kind': 'highlight', 'pts': top((236, -96), (566, -188)), 'width': 2}],
            'front': [{'kind': 'highlight', 'pts': [F(-200, 366), F(-150, 344), F(0, 332), F(150, 344), F(200, 366)], 'width': 1}]})
part('cowl', 'cowl', 'paint', 'side',
     side=side((645, 252), (700, 250), (735, 246), (757, 240), (760, 290), (790, 292), (790, 586), (645, 586)),
     front=fhalf((0, 292), (180, 296), (250, 305), (300, 318), (332, 336), (345, 360), (346, 700), (0, 700)), smooth=('front',),
     top=halfT((572, 0), (572, 211), (663, 237), (672, 237), (672, 0)),
     feats={'side': [{'kind': 'trim', 'pts': side((650, 256), (650, 584)), 'width': 2}, {'kind': 'highlight', 'pts': side((658, 292), (720, 290), (756, 286)), 'width': 2},
                     {'kind': 'seam', 'pts': side((656, 331), (788, 331))},
                     {'kind': 'seam', 'pts': side((704, 392), (712, 380), (738, 380), (746, 392), (746, 548), (738, 560), (712, 560), (704, 548), (704, 392))}],
            'top': [{'kind': 'trim', 'pts': top((574, -206), (574, 206)), 'width': 1}],
            'front': [{'kind': 'seam', 'pts': [F(232, 372), F(262, 356), F(300, 348), F(344, 352)]}, {'kind': 'seam', 'pts': [F(-232, 372), F(-262, 356), F(-300, 348), F(-344, 352)]}]})
# the body: a closed four-door body, green up to the belt moulding on the sides; in the side view the window band
# above the belt is black (bodyTop). Its lower edge follows the rear wing.
cR = (1554, 660)
def inward(p, d):
    a = math.hypot(p[0] - cR[0], p[1] - cR[1]); return (round(p[0] + (cR[0] - p[0]) * d / a), round(p[1] + (cR[1] - p[1]) * d / a))
ARCH = [inward(p, 14) for p in FR_UP[1:13]]
BODY_PLAN = ((672, 0), (672, 240), (690, 262), (720, 268), (900, 272), (1300, 276), (1560, 276), (1620, 268), (1658, 248), (1682, 216), (1694, 180), (1697, 0))
part('body', 'body', 'paint', 'side',
     side=side((790, 586), (790, 292), (760, 290), (757, 240), (757, 108), (748, 62), (1786, 62), (1788, 268), (1792, 276), (1790, 286), (1783, 300), (1779, 340), (1773, 420), (1766, 480), (1756, 520), *ARCH[::-1], (1326, 586)),
     front=fhalf((0, 60), (356, 60), (362, 96), (364, 124), (360, 136), (352, 148), (348, 160), (346, 300), (346, 700), (0, 700)),
     rear=bhalf((0, 96), (362, 96), (362, 228), (358, 250), (358, 296), (366, 306), (368, 318), (358, 334), (358, 400), (354, 456), (348, 560), (338, 640), (318, 700), (0, 700)),
     top=halfT(*BODY_PLAN),
     feats={'side': [{'kind': 'seam', 'pts': side((790, 294), (790, 584))}, {'kind': 'seam', 'pts': side((1119, 294), (1119, 584))}, {'kind': 'seam', 'pts': side((1130, 294), (1130, 584))},
                     {'kind': 'seam', 'pts': side((1462, 294), (1462, 400), (1420, 428), (1384, 456), (1356, 494), (1340, 540), (1334, 584))},
                     {'kind': 'crease', 'pts': side((792, 331), (1116, 331))}, {'kind': 'crease', 'pts': side((1133, 331), (1780, 331))},
                     {'kind': 'crease', 'pts': side((794, 574), (1322, 574))},
                     {'kind': 'hinge', 'at': S(791, 334)}, {'kind': 'hinge', 'at': S(791, 505)}, {'kind': 'hinge', 'at': S(1126, 505)}, {'kind': 'hinge', 'at': S(1464, 316)}, {'kind': 'hinge', 'at': S(1464, 372)}],
            'front': [{'kind': 'seam', 'pts': [F(338, 118), F(322, 104), F(304, 112), F(298, 140), F(298, 290), F(306, 304), F(326, 300), F(338, 286), F(338, 118)]},
                      {'kind': 'seam', 'pts': [F(-338, 118), F(-322, 104), F(-304, 112), F(-298, 140), F(-298, 290), F(-306, 304), F(-326, 300), F(-338, 286), F(-338, 118)]},
                      {'kind': 'bead', 'pts': [F(254, 322), F(300, 330), F(346, 334)]}, {'kind': 'bead', 'pts': [F(-254, 322), F(-300, 330), F(-346, 334)]}],
            'rear': [{'kind': 'bead', 'pts': [B(-362, 340), B(-300, 328), B(-200, 316), B(-100, 309), B(0, 306), B(100, 309), B(200, 316), B(300, 328), B(362, 340)]},
                     {'kind': 'bead', 'pts': [B(-358, 404), B(-300, 390), B(-200, 377), B(-100, 371), B(0, 368), B(100, 371), B(200, 377), B(300, 390), B(358, 404)]},
                     {'kind': 'seam', 'pts': [B(292, 100), B(288, 340), B(282, 480)]}, {'kind': 'seam', 'pts': [B(-292, 100), B(-288, 340), B(-282, 480)]},
                     {'kind': 'highlight', 'pts': [B(-350, 330), B(-200, 308), B(0, 298), B(200, 308), B(350, 330)], 'width': 1}]})
part('bodyTop', 'body', 'paint2', 'side', on='body', color='#28292a', y=[0, YB + 2],
     side=side((757, 291), (757, 108), (748, 62), (1786, 62), (1788, 268), (1792, 276), (1790, 286), (1786, 291)),
     feats={'side': [{'kind': 'seam', 'pts': side((1119, 64), (1119, 290))}, {'kind': 'seam', 'pts': side((1130, 64), (1130, 290))}, {'kind': 'seam', 'pts': side((1462, 64), (1462, 290))},
                     {'kind': 'seam', 'pts': side((790, 120), (790, 290))},
                     {'kind': 'bead', 'pts': side((759, 289), (1116, 289))}, {'kind': 'bead', 'pts': side((1133, 289), (1460, 289))}, {'kind': 'bead', 'pts': side((1466, 289), (1700, 289), (1788, 280))},
                     {'kind': 'hinge', 'at': S(791, 150)}, {'kind': 'hinge', 'at': S(1464, 96)}, {'kind': 'hinge', 'at': S(1464, 250)}]})
# the roof: black cloth over a rounded cap, a drip moulding along its edge; rounded down at the back
part('roof', 'roof', 'canvas', 'roof', color='#323234',
     side=side((744, 64), (744, 48), (756, 36), (804, 24), (892, 12), (1000, 5), (1116, 0), (1620, 0), (1708, 12), (1744, 24), (1764, 36), (1780, 48), (1786, 60), (1789, 78), (1750, 68), (1690, 64)),
     front=fhalf((0, 0), (138, 0), (296, 12), (326, 24), (340, 36), (350, 48), (357, 60), (361, 72), (362, 90), (356, 100), (300, 98), (280, 64), (0, 60)),
     rear=bhalf((0, 0), (162, 0), (300, 12), (334, 24), (350, 36), (358, 48), (366, 60), (370, 72), (370, 90), (364, 100), (0, 100)),
     top=halfT(*BODY_PLAN[:-1], (1690, 180), (1692, 0)),
     feats={'side': [{'kind': 'highlight', 'pts': side((800, 34), (900, 20), (1116, 8), (1620, 8), (1720, 24)), 'width': 2}, {'kind': 'bead', 'pts': side((750, 61), (1690, 61), (1750, 65), (1786, 75))}],
            'rear': [{'kind': 'bead', 'pts': [B(-366, 92), B(0, 92), B(366, 92)]}],
            'top': [{'kind': 'seam', 'pts': top((700, 0), (700, 230), (724, 250), (1560, 256), (1620, 246), (1650, 226), (1668, 190), (1672, 0))},
                    {'kind': 'seam', 'pts': top((700, 0), (700, -230), (724, -250), (1560, -256), (1620, -246), (1650, -226), (1668, -190), (1672, 0))}]})
# the visor over the windscreen: a cloth-covered peak sloping forward and down from the roof's front edge
part('visor', 'roof', 'canvas', 'roof', color='#2a2a2b',
     side=side((744, 50), (757, 62), (757, 108), (744, 106), (704, 101), (692, 96), (704, 84), (720, 70), (736, 58)),
     front=fhalf((0, 62), (262, 62), (277, 70), (276, 94), (268, 104), (0, 104)))
part('screenFrame', 'screen', 'black', 'flat', on='body', color='#3a3531', x=[S(757, 0)[0], S(770, 0)[0]], front=fhalf((0, 106), (250, 106), (254, 112), (254, 296), (246, 302), (0, 302)))
part('screen', 'screen', 'glass', 'side', on='screenFrame', x=[S(759, 0)[0], S(768, 0)[0]], front=[[a, b] for a, b in rrect(F(-216, 0)[0], F(0, 246)[1], F(216, 0)[0], F(0, 128)[1], 14)])
part('wiper', 'screen', 'black', 'flat', on='screen', x=[S(755, 0)[0], S(758, 0)[0]], front=[F(*q) for q in ((158, 106), (148, 106), (72, 180), (68, 190), (78, 190), (156, 116))], lift=1)
# the steering wheel's rim, seen through the screen on the driver's side
def arc(cx, cz, rx, rz, a0, a1, n=10): return [[round(cx + math.cos(math.radians(a0 + (a1 - a0) * k / n)) * rx), round(cz + math.sin(math.radians(a0 + (a1 - a0) * k / n)) * rz)] for k in range(n + 1)]
_c = F(106, 268); part('steerRim', 'screen', 'black', 'flat', on='screen', color='#4a4038', x=[S(900, 0)[0], S(910, 0)[0]],
     front=arc(_c[0], _c[1], F(66, 0)[0], round(56 * H / 976), 24, 156) + arc(_c[0], _c[1], F(54, 0)[0], round(44 * H / 976), 152, 28), lift=1)
# door handles: nickel, either side of the centre post
for k, (a, b, piv) in enumerate(((1036, 1102, 1092), (1140, 1208, 1150))):
    pts = ((a, 339), (a + 6, 331), (b - 6, 331), (b, 339), (b - 6, 347), (a + 6, 347))
    part(f'handle{k}', 'body', 'chrome', 'flat', pair=True, y=[YB + 2, YB + 40], side=side(*pts), smooth=('side',))
    part(f'handleBoss{k}', 'body', 'chrome', 'flat', pair=True, y=[YB + 2, YB + 30], side=ell(S(piv, 0)[0], S(0, 336)[1], 22, 34, 12), smooth=('side',), lift=1)
# side windows: three a side; a dark moulding, a thin wood garnish inside it, the glass
WIN = (((812, 88, 1094, 272), (822, 100, 1082, 262), (828, 108, 1072, 252)), ((1152, 88, 1428, 270), (1164, 100, 1418, 260), (1172, 108, 1408, 250)), ((1478, 88, 1664, 270), (1488, 100, 1654, 260), (1496, 108, 1637, 250)))
for k, (fr, wd, gl) in enumerate(WIN):
    part(f'wframe{k}', 'body', 'paint2', 'side', on='bodyTop', color='#3c3d40', y=[YB + 2, YB + 4], pair=True, side=srect(*fr, 34))
    part(f'wgarnish{k}', 'body', 'wood', 'flat', on=f'wframe{k}', color='#4f3a28', y=[YB + 3, YB + 5], pair=True, side=srect(*wd, 26))
    part(f'glass{k}', 'body', 'glass', 'side', on=f'wgarnish{k}', y=[YB + 4, YB + 6], pair=True, side=srect(*gl, 20))
part('rearFrame', 'body', 'black', 'flat', on='body', color='#1e221f', x=[S(1784, 0)[0], S(1788, 0)[0]], rear=[[a, b] for a, b in rrect(B(-172, 0)[0], B(0, 270)[1], B(172, 0)[0], B(0, 128)[1], 26)])
part('rearGlass', 'body', 'glass', 'side', on='rearFrame', x=[S(1782, 0)[0], S(1786, 0)[0]], rear=[[a, b] for a, b in rrect(B(-158, 0)[0], B(0, 258)[1], B(158, 0)[0], B(0, 142)[1], 16)])
part('rearApron', 'body', 'black', 'flat', color=BLK, x=[S(1700, 0)[0], S(1780, 0)[0]], rear=bhalf((0, 696), (322, 696), (322, 812), (0, 812)))

# ---------------- wings, boards ----------------
part('fenderF', 'fenderF', 'paint2', 'fender', slot='fenderF', pair=True, smooth=('front', 'side'),
     side=side(*FF_UP, *FF_LO),
     front=[F(466 - a, b) for a, b in ((2, 590), (0, 566), (6, 540), (16, 518), (32, 504), (48, 498), (64, 488), (80, 474), (100, 468), (120, 468), (124, 506), (150, 515), (176, 530), (200, 548), (222, 576), (250, 620), (275, 665), (296, 700),
                                       (300, 716), (272, 716), (250, 690), (224, 650), (196, 606), (172, 586), (150, 580), (120, 598), (80, 608), (40, 606), (12, 598))],
     top=top((62, 270), (66, 295), (72, 310), (84, 318), (96, 326), (108, 330), (120, 334), (340, 334), (400, 330), (440, 324), (470, 320), (500, 316), (560, 311), (560, 214), (226, 122), (200, 160), (150, 196), (104, 196), (86, 212), (70, 240)),
     feats={'side': [{'kind': 'highlight', 'pts': side((100, 478), (132, 450), (160, 438), (200, 431), (240, 426), (280, 425), (320, 429), (360, 438), (400, 453), (440, 474), (480, 500), (520, 546), (560, 592), (600, 630), (640, 656), (680, 676), (760, 692)), 'width': 3}],
            'front': [{'kind': 'highlight', 'pts': [F(466 - a, b) for a, b in ((30, 530), (70, 520), (120, 518), (160, 528))], 'width': 2}]})
part('fenderR', 'fenderR', 'paint2', 'fender', slot='fenderR', pair=True, smooth=('rear', 'side'),
     side=side(*FR_UP, *FR_LO),
     rear=[B(*q) for q in ((340, 776), (340, 470), (360, 463), (378, 464), (394, 468), (410, 476), (426, 492), (434, 516), (438, 540), (442, 564), (442, 756), (434, 768), (422, 780))],
     top=top((1215, 250), (1215, 316), (1236, 322), (1260, 330), (1284, 334), (1600, 334), (1620, 330), (1644, 322), (1663, 314), (1683, 291), (1693, 251), (1697, 221), (1690, 200), (1660, 250)),
     feats={'side': [{'kind': 'highlight', 'pts': side((1340, 548), (1360, 506), (1388, 474), (1418, 455), (1465, 433), (1513, 420), (1563, 418), (1611, 428), (1658, 455), (1705, 496), (1735, 540), (1765, 602)), 'width': 3}]})
part('board', 'board', 'rubber', 'flat', color='#232325', slot='board', pair=True, side=side((776, 676), (1324, 676), (1324, 716), (776, 716)), top=top((470, 240), (470, 320), (560, 311), (708, 312), (1215, 314), (1215, 240)))
part('boardTrim', 'board', 'chrome', 'flat', on='board', slot='board', pair=True, y=[T(0, 306)[1], T(0, 314)[1]], side=side((776, 679), (1322, 679), (1325, 688), (1322, 698), (776, 698)), lift=1)   # the bright edge strip along the board

# ---------------- lamps, bumpers, spare ----------------
# bullet headlamps: a nickel rim and a dark painted bowl behind it (side, plan); face on a nickel rim round a pale lens; a tie bar between them
part('lamp', 'lamp', 'black', 'fender', slot='lamp', pair=True, smooth=('side',), color='#2c2d33', y=[T(0, 84)[1], T(0, 196)[1]],
     side=side((176, 322), (198, 326), (216, 340), (228, 360), (233, 382), (228, 404), (214, 418), (198, 424), (176, 422)))
part('lampTop', 'lamp', 'chrome', 'fender', slot='lamp', pair=True, smooth=('top',), z=[S(0, 420)[1], S(0, 322)[1]],   # from above the sheet shows the bowl bright
     top=top((158, 196), (180, 190), (198, 174), (210, 154), (216, 139), (210, 124), (198, 104), (180, 88), (158, 84)))
part('lampRim', 'lamp', 'chrome', 'fender', slot='lamp', pair=True, smooth=('front',),
     side=side((158, 330), (162, 320), (176, 318), (179, 324), (179, 420), (176, 424), (162, 422), (158, 414)),
     front=ell(F(209, 0)[0], F(0, 480)[1], F(62, 0)[0], round(62 * H / 976)), top=top((140, 192), (144, 198), (160, 198), (160, 82), (144, 82), (140, 88)))
part('lens', 'lamp', 'chrome', 'flat', on='lampRim', slot='lamp', pair=True, x=[S(156, 0)[0], S(160, 0)[0]], smooth=('front',), front=ell(F(209, 0)[0], F(0, 480)[1], F(52, 0)[0], round(52 * H / 976)), detail={'kind': 'bowl'})
part('lampBar', 'lamp', 'chrome', 'flat', slot='lamp', color='#6f6a62', x=[S(196, 0)[0], S(206, 0)[0]], front=fhalf((0, 548), (300, 548), (300, 560), (0, 560)))
part('lampStand', 'lamp', 'chrome', 'flat', slot='lamp', pair=True, side=side((194, 422), (212, 420), (214, 440), (192, 440)), front=[F(*q) for q in ((200, 538), (218, 538), (220, 572), (198, 572))])
for k, (py, zf, zr) in enumerate(((610, 730, 695), (654, 774, 737))):
    part(f'bumperF{k}', 'bumperF', 'chrome', 'fender', slot='bumperF', side=side((2, py - 10), (34, py - 10), (38, py), (34, py + 10), (2, py + 10)), front=fhalf((0, zf - 10), (416, zf - 10), (422, zf), (416, zf + 10), (0, zf + 10)),
         top=halfT((0, 0), (0, 256), (10, 278), (26, 292), (46, 296), (54, 282), (40, 272), (28, 254), (24, 0)))
    part(f'bumperR{k}', 'bumperR', 'chrome', 'fender', slot='bumperR', pair=True, side=side((1848, py - 16 - 11), (1876, py - 16 - 11), (1880, py - 16), (1876, py - 16 + 11), (1848, py - 16 + 11)),
         rear=[B(*q) for q in ((214, zr - 11), (424, zr - 11), (430, zr), (424, zr + 11), (214, zr + 11))],
         top=top((1700, 302), (1716, 302), (1738, 292), (1752, 268), (1758, 226), (1758, 186), (1738, 186), (1738, 246), (1728, 268), (1712, 278), (1700, 280)))
part('clampF0', 'bumperF', 'chrome', 'flat', on='bumperF0', slot='bumperF', pair=True, x=[0, 30], front=[F(*q) for q in ((172, 716), (180, 710), (192, 710), (200, 716), (200, 792), (192, 798), (180, 798), (172, 792))])
part('clampR0', 'bumperR', 'chrome', 'flat', on='bumperR0', slot='bumperR', pair=True, x=[S(1846, 0)[0], S(1876, 0)[0]], rear=[B(*q) for q in ((214, 676), (244, 676), (246, 756), (214, 756))])
part('ironF', 'bumperF', 'black', 'flat', color=BLK, slot='bumperF', pair=True, side=side((38, 604), (62, 612), (86, 602), (96, 640), (70, 668), (38, 678)), top=top((18, 160), (18, 140), (96, 92), (102, 108)), lift=1)
part('ironR', 'bumperR', 'black', 'flat', color=BLK, slot='bumperR', pair=True, side=side((1836, 590), (1850, 584), (1850, 656), (1836, 662)), top=top((1690, 216), (1690, 236), (1744, 236), (1744, 216)))
part('bracketR', 'bumperR', 'paint', 'side', slot='bumperR', pair=True, x=[S(1790, 0)[0], S(1840, 0)[0]], rear=[B(*q) for q in ((208, 630), (214, 624), (254, 624), (260, 632), (262, 690), (206, 690))])   # the body-coloured bracket the bumperette is bolted to
# one tail lamp, on a stalk at the left of the back panel (rear sheet): a nickel rim and a red glass
part('tailStem', 'tail', 'black', 'flat', color=BLK, slot='tail', x=[S(1790, 0)[0], S(1798, 0)[0]], rear=[B(*q) for q in ((295, 588), (303, 588), (303, 650), (295, 650))])
part('tailRim', 'tail', 'chrome', 'fender', slot='tail', smooth=('rear',), x=[S(1790, 0)[0], S(1800, 0)[0]], rear=ell(B(299, 0)[0], B(0, 566)[1], B(32, 0)[0], round(32 * H / 960)))
part('tail', 'tail', 'lensR', 'flat', on='tailRim', slot='tail', smooth=('rear',), x=[S(1792, 0)[0], S(1802, 0)[0]], rear=ell(B(299, 0)[0], B(0, 566)[1], B(22, 0)[0], round(22 * H / 960)))
# the spare on the back: edge on from the side and above (the road tyres' own section), a wheel from behind
def tyre_section(u0, u1, v0, v1, across_first=True):
    lo_u, hi_u = 581, 807; hi_v = 762
    return [[round(u0 + (q[0] - lo_u) / (hi_u - lo_u) * (u1 - u0)), round(v0 + q[1] / hi_v * (v1 - v0))] if across_first else
            [round(v0 + q[1] / hi_v * (v1 - v0)), round(u0 + (q[0] - lo_u) / (hi_u - lo_u) * (u1 - u0))] for q in tyre0]
part('spareCarrier', 'spare', 'black', 'flat', color=BLK, side=side((1780, 346), (1794, 342), (1794, 600), (1756, 560), (1764, 480), (1774, 400)), top=halfT((1694, 0), (1694, 150), (1706, 150), (1706, 0)))
part('spare', 'spare', 'rubber', 'fender', wheel={'r': 376},
     side=tyre_section(S(1788, 0)[0], S(1853, 0)[0], S(0, 680)[1], S(0, 340)[1]), rear=ell(0, B(0, 604)[1], B(198, 0)[0], round(198 * H / 960)),
     top=tyre_section(T(1702, 0)[0], T(1772, 0)[0], -T(0, 184)[1], T(0, 184)[1]), smooth=('side', 'top'), detail={'kind': 'treadFace', 'pitch': 40})

# ---------------- the chassis under the body: the draft's chassis-layer parts moved onto this car's wheels ----------------
D = json.load(open(DRAFT)); dw = D['wheels']; kx = (RX - FX) / (dw[1]['x'] - dw[0]['x']); ky = W / D['width']; kz = H / D['height']
mx = lambda v: round(FX + (v - dw[0]['x']) * kx); my = lambda v: round(v * ky); mz = lambda v: round(v * kz)
for p in D['parts']:
    if p.get('layer') != 'chassis': continue
    q = json.loads(json.dumps(p)); b = q['box']; q['box'] = {'x': [mx(b['x'][0]), mx(b['x'][1])], 'y': [my(b['y'][0]), my(b['y'][1])], 'z': [mz(b['z'][0]), mz(b['z'][1])]}
    for v, sb in q.get('sheet', {}).items():
        fa, fb = {'side': (mx, mz), 'front': (my, mz), 'rear': (my, mz), 'top': (mx, my)}[v]; q['sheet'][v] = [fa(sb[0]), fa(sb[1]), fb(sb[2]), fb(sb[3])]
    q.pop('shade', None); P.append(q)

M = {'id': 'plymU29', 'name': '1929 light four sedan', 'year': 1929, 'length': L, 'width': W, 'height': H,
     'paint': '#2a382d', 'paint2': '#2d2e2f', 'canvas': '#39393b', 'chrome': '#a59c8e', 'glassTint': '#a9abad',
     'wheels': [{'x': FX, 'r': R, 'y': 665}, {'x': RX, 'r': R, 'y': 665}],
     'wheel': {'rim': 0.65, 'style': 'artillery', 'spokes': 14, 'rimMaterial': 'paint', 'cap': 0.2, 'capRings': 1},   # wooden-spoke wheels painted the body's green, a nickel hub cap
     'parts': P}
json.dump(M, open(OUT, 'w'), indent=0)
print(OUT, len(P), 'parts;', sum(len(p['outlines']) for p in P), 'outlines')
print('outlines pulled onto the drawing, mean move in mm:', SNAP)
print('where a view of the sheet differs from the common box by more than 50 mm (each view keeps its own):'); print('\n'.join('  ' + n for n in notes))
