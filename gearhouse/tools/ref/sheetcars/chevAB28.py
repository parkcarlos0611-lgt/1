"""The 1928 light sedan (sheet 624bbd1c, the left-hand car) as one 3D part model, made by hand in the way of
tools/ref/sedan29_model.py: every part is a box in the car's space (x from the front bumper back, y from the centre
line outwards, z up; mm) and its outline as the sheet shows it from the side, the front or rear, and above. Outlines
are read off the sheet's views in pixel positions on a 4x enlargement of each view (S side, F front, B rear, T plan).
The body-layer parts are written from scratch; the chassis-layer parts (engine, gearbox, exhaust ... under the body,
which no body view of the sheet shows) are taken from the converter's draft and moved onto this car's wheels.

  python3 chevAB28.py <views dir> <out json> [draft json] [repository root]"""
import sys, os, json, math
HERE = os.path.dirname(os.path.abspath(__file__))
VIEWS = sys.argv[1] if len(sys.argv) > 1 else HERE
OUT = sys.argv[2] if len(sys.argv) > 2 else f'{HERE}/chevAB28.json'
DRAFT = sys.argv[3] if len(sys.argv) > 3 else f'{HERE}/draft/chevAB28_auto.json'
REPO = sys.argv[4] if len(sys.argv) > 4 else '/home/user/1/gearhouse'
sys.path.insert(0, f'{REPO}/tools/ref')
import cv2, numpy as np
from zkit import View, fit_closed
from shapely.geometry import Polygon, box as sbox
from shapely.affinity import scale as sscale
from shapely.ops import unary_union

# ---- scale: the wheel centres are 1238 units apart on the 4x side view (264 and 1502), the wheelbase is 2718 mm ----
K = 2718 / 1238                                           # mm per unit of the 4x side view (8.78 mm a pixel)
L, H, W = round(1868 * K), round(840 * K), 1700           # side view 467x210 px; width: the mean of the front view's (1731) and the rear view's (1674)
C = W / 2
FX, RX, R = round(264 * K), round(1502 * K), round(177 * K)
S = lambda px, py: [round(px * L / 1868), round(H - py * H / 840)]            # side view (467x210 px)
F = lambda dx, py: [round(dx * W / 916), round(H - py * H / 976)]             # front view (229x244 px): distance from the centre line (unit 456), row
B = lambda dx, py: [round(dx * W / 868), round(H - py * H / 956)]             # rear view (217x239 px), centre line at unit 432
T = lambda px, dy: [round(px * L / 1776), round(dy * W / 664)]                # plan view (444x166 px): along, distance from the centre line (unit 332)
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
def srect(a, b, c, d, r):                                  # a rounded rectangle given in side-view units (left, top, right, bottom)
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

BLK = '#1c1c1d'                                           # the sheet's black of the valances and wheel houses: neutral, not blue-black
YB = 690                                                  # the body side's distance from the centre line (the order of the side view hangs on it)
# ---------------- running gear seen from outside ----------------
def arch(wx, r, lo, hi):
    """the dark of a wheel house: a half circle over the wheel, kept inside lo..hi (where the wing ends, the sheet shows daylight)"""
    a = [[min(hi, max(lo, round(wx + math.cos(t) * r))), round(R + math.sin(t) * r)] for t in [math.pi * k / 16 for k in range(16, -1, -1)]]
    return [[a[0][0], R - 80]] + a + [[a[-1][0], R - 80]]
part('house0', 'house', 'black', 'flat', color=BLK, y=[0, 560], side=arch(FX, 478, S(112, 0)[0], FX + 478))
part('house1', 'house', 'black', 'flat', color=BLK, y=[0, 560], side=arch(RX, 478, S(1300, 0)[0], S(1716, 0)[0]))
part('frame', 'frame', 'black', 'flat', pair=True, side=[[S(108, 0)[0], 430], [S(1764, 0)[0], 430], [S(1764, 0)[0], 530], [S(108, 0)[0], 530]], front=[[370, 430], [440, 430], [440, 530], [370, 530]], rear='front',
     top=[[S(108, 0)[0], 370], [S(1764, 0)[0], 370], [S(1764, 0)[0], 440], [S(108, 0)[0], 440]])
# from in front the sheet shows the axle and its spring as one dark band under the bumper, sagging in the middle
part('axleF', 'axle', 'black', 'flat', color=BLK, x=[FX - 40, FX + 40], front=fhalf((0, 842), (110, 840), (170, 830), (256, 822), (330, 822), (330, 800), (0, 800)))
part('springF', 'spring', 'iron', 'flat', x=[FX - 30, FX + 30], front=fhalf((0, 792), (250, 788), (320, 798), (320, 806), (250, 800), (0, 802)))
part('axleR', 'axle', 'black', 'flat', color=BLK, x=[RX - 47, RX + 47], rear=bhalf((0, 838), (45, 834), (75, 812), (120, 806), (310, 802), (310, 772), (0, 770)), smooth=('rear',))
part('springR', 'spring', 'iron', 'flat', x=[RX + 60, RX + 120], rear=bhalf((0, 752), (220, 756), (305, 772), (305, 786), (220, 770), (0, 766)))
tyre0 = [[606, 6], [640, 0], [748, 0], [782, 6], [798, 40], [805, 200], [807, 381], [804, 560], [796, 690], [782, 734], [760, 754], [725, 762], [663, 762], [628, 754], [606, 734], [592, 690], [584, 560], [581, 381], [583, 200], [590, 40]]   # a balloon section face on: flat where it stands, round at the top
def tyre(y0, y1): return [[round(y0 + (q[0] - 581) / 226 * (y1 - y0)), round(q[1] / 762 * 2 * R)] for q in tyre0]
TF = (F(323, 0)[0], F(435, 0)[0]); TR = (B(315, 0)[0], B(414, 0)[0])            # the tyres' inner and outer faces on the front and rear views
part('tyreF', 'wheel', 'rubber', 'fender', x=[FX - R, FX + R], pair=True, front=tyre(*TF), top=[[FX - R, TF[0]], [FX + R, TF[0]], [FX + R, TF[1]], [FX - R, TF[1]]], smooth=('front',), detail={'kind': 'treadFace', 'pitch': 38})
part('tyreR', 'wheel', 'rubber', 'fender', x=[RX - R, RX + R], pair=True, rear=tyre(*TR), top=[[RX - R, TR[0]], [RX + R, TR[0]], [RX + R, TR[1]], [RX - R, TR[1]]], smooth=('rear',), detail={'kind': 'treadFace', 'pitch': 38})

# ---------------- body ----------------
# the dark between the wings ahead of the cowl (plan) and under the shell and behind the wings' inner sweep (front)
part('splash', 'apron', 'black', 'flat', color=BLK, x=[700, 1300], z=[300, 880], top=halfT((62, 0), (62, 250), (575, 250), (575, 0)),
     front=fhalf((0, 700), (200, 700), (256, 600), (336, 600), (336, 826), (0, 826)))
part('crossF', 'frame', 'black', 'flat', x=[S(108, 0)[0], S(150, 0)[0]], z=[440, 500], top=[[S(108, 0)[0], -440], [S(108, 0)[0], 440], [S(150, 0)[0], 440], [S(150, 0)[0], -440]], front=half([0, 440], [440, 440], [440, 500], [0, 500]))
# the black valance between the body's bottom edge and the running board, running forward behind the front wing
part('apron', 'apron', 'black', 'flat', color=BLK, y=[-600, 600], side=side((425, 500), (480, 540), (540, 588), (645, 582), (1296, 582), (1296, 716), (425, 716)), top=halfT((575, 0), (575, 236), (1203, 236), (1203, 0)))
part('sill', 'apron', 'black', 'flat', color='#5b5c5f', on='apron', y=[600, 604], side=side((590, 581), (1284, 581), (1284, 592), (602, 592)), lift=1)   # the valance's top edge catches the light: a grey strip under the doors
# radiator: a tall narrow nickel shell with square shoulders and a flat arch; the core fills it; a blue enamel plate on the header
part('shell', 'radiator', 'chrome', 'flat', slot='grille',
     side=side((240, 418), (236, 300), (240, 272), (248, 261), (278, 259), (278, 418)),
     front=fhalf((0, 329), (40, 330), (72, 336), (98, 348), (117, 366), (127, 388), (131, 412), (132, 700), (126, 710), (0, 711)), smooth=('front',),
     top=halfT((187, 0), (187, 117), (227, 117), (227, 0)))
part('core', 'radiator', 'black', 'flat', on='shell', slot='grille', x=[S(238, 0)[0], S(244, 0)[0]], front=fhalf((0, 387), (88, 387), (101, 392), (108, 405), (108, 697), (0, 697)), detail={'kind': 'cells', 'pitch': 22})
part('badge', 'radiator', 'paint', 'flat', color='#2c5a9a', on='shell', slot='grille', x=[S(234, 0)[0], S(238, 0)[0]], front=fhalf((0, 357), (24, 357), (30, 366), (24, 376), (0, 378)), lift=1)
# the cap with its mascot (a small figure on the filler cap)
part('cap', 'radiator', 'chrome', 'flat', slot='grille', smooth=('side', 'front'),
     side=side((244, 262), (248, 246), (243, 234), (246, 218), (254, 204), (265, 202), (272, 211), (270, 226), (263, 238), (270, 250), (274, 261)),
     front=fhalf((0, 272), (8, 276), (12, 290), (7, 300), (14, 312), (15, 330), (0, 332)),
     top=[[T(189, 0)[0] + round(math.cos(k / 12 * 6.2832) * 32), round(math.sin(k / 12 * 6.2832) * 32)] for k in range(12)])
# the hood: its lower edge is hidden by the front wing, so it runs along the middle of the wing's blade
part('hood', 'hood', 'paint', 'side',
     side=side((278, 258), (460, 256), (645, 254), (645, 580), (525, 580), (480, 534), (440, 494), (400, 462), (360, 442), (320, 428), (278, 425)),
     front=fhalf((0, 320), (130, 324), (192, 334), (218, 350), (228, 420), (238, 700), (0, 700)), smooth=('front',),
     top=halfT((227, 0), (227, 105), (570, 205), (570, 0)),
     feats={'side': [{'kind': 'louvres', 'x0': S(340, 0)[0], 'x1': S(593, 0)[0], 'z0': S(0, 520)[1], 'z1': S(0, 366)[1], 'n': 18, 'slant': 0},
                     {'kind': 'seam', 'pts': side((334, 362), (596, 362))}, {'kind': 'seam', 'pts': side((597, 364), (597, 522))}, {'kind': 'seam', 'pts': side((480, 524), (596, 524))}, {'kind': 'seam', 'pts': side((333, 364), (333, 440))},
                     {'kind': 'seam', 'pts': side((280, 322), (643, 322))}, {'kind': 'highlight', 'pts': side((284, 292), (460, 291), (640, 290)), 'width': 2},
                     {'kind': 'seam', 'pts': side((540, 560), (643, 560))}, {'kind': 'bolt', 'at': S(598, 535)}],
            'front': [{'kind': 'seam', 'pts': [F(-215, 352), F(-140, 338), F(0, 334), F(140, 338), F(215, 352)]}],
            'top': [{'kind': 'seam', 'pts': top((230, 0), (566, 0))}, {'kind': 'highlight', 'pts': top((240, -92), (560, -178)), 'width': 2}]})
part('cowl', 'cowl', 'paint', 'side',
     side=side((645, 254), (700, 251), (740, 246), (758, 240), (766, 232), (768, 290), (795, 290), (795, 580), (645, 580)),
     front=fhalf((0, 270), (150, 274), (240, 284), (278, 300), (290, 325), (296, 420), (300, 700), (0, 700)), smooth=('front',),
     top=halfT((570, 0), (570, 205), (672, 232), (672, 0)),
     feats={'side': [{'kind': 'highlight', 'pts': side((650, 290), (740, 286), (764, 280)), 'width': 2}, {'kind': 'seam', 'pts': side((647, 324), (793, 326))}, {'kind': 'bolt', 'at': S(706, 286)}],
            'top': [{'kind': 'trim', 'pts': top((576, -200), (576, 200)), 'width': 2}, {'kind': 'seam', 'pts': top((580, 0), (670, 0))}]})
# the body: blue up to the belt moulding; above the belt the black top comes down over the window band and the rear quarter (bodyTop).
# Its lower edge follows the rear wing, so the dark of the wheel house shows under the wing as on the sheet
BODY_TOP = ((672, 0), (672, 232), (700, 262), (1000, 285), (1590, 285), (1640, 277), (1670, 255), (1684, 222), (1686, 180), (1686, 0))
part('body', 'body', 'paint', 'side', y=[-YB, YB],
     side=side((795, 580), (795, 290), (768, 290), (766, 64), (774, 50), (1640, 48), (1700, 52), (1740, 66), (1753, 84), (1753, 270), (1757, 300), (1756, 400), (1750, 470), (1742, 540), (1735, 600), (1722, 604),
               (1704, 575), (1680, 522), (1650, 480), (1614, 446), (1576, 424), (1528, 412), (1480, 410), (1433, 417), (1396, 431), (1363, 455), (1335, 488), (1316, 526), (1302, 564), (1296, 580)),
     front=fhalf((0, 62), (346, 62), (347, 320), (342, 420), (336, 640), (0, 640)),
     rear=bhalf((0, 86), (360, 86), (359, 150), (353, 327), (350, 400), (346, 440), (336, 500), (322, 540), (306, 590), (290, 633), (278, 655), (250, 662), (0, 664)),
     top=halfT(*BODY_TOP),
     feats={'side': [{'kind': 'seam', 'pts': side((795, 291), (795, 578))}, {'kind': 'seam', 'pts': side((1118, 291), (1118, 573))},
                     {'kind': 'seam', 'pts': side((1430, 291), (1430, 398), (1404, 414))},
                     {'kind': 'seam', 'pts': side((797, 572), (1298, 572))},
                     {'kind': 'crease', 'pts': side((797, 327), (1200, 328), (1660, 326), (1710, 320), (1755, 305))},
                     {'kind': 'hinge', 'at': S(795, 336)}, {'kind': 'hinge', 'at': S(795, 500)}, {'kind': 'hinge', 'at': S(1430, 318)}],
            'rear': [{'kind': 'crease', 'pts': [B(-350, 388), B(-250, 368), B(0, 357), B(250, 368), B(350, 388)]},
                     {'kind': 'seam', 'pts': [B(300, 335), B(296, 600)]}, {'kind': 'seam', 'pts': [B(-300, 335), B(-296, 600)]}]})
TOPC = '#27282a'
part('bodyTop', 'body', 'paint2', 'side', on='body', color=TOPC, y=[0, YB],
     side=side((766, 289), (766, 64), (774, 50), (1640, 48), (1700, 52), (1740, 66), (1753, 84), (1753, 271), (1700, 281), (1640, 289)),
     front=fhalf((0, 62), (346, 62), (347, 318), (300, 316), (288, 306), (270, 294), (240, 284), (150, 274), (0, 270)),
     rear=bhalf((0, 86), (360, 86), (359, 150), (353, 330), (310, 320), (250, 312), (120, 305), (0, 303)),
     feats={'side': [{'kind': 'seam', 'pts': side((1118, 66), (1118, 288))}, {'kind': 'seam', 'pts': side((1430, 66), (1430, 288))}, {'kind': 'seam', 'pts': side((1632, 34), (1632, 288))},
                     {'kind': 'seam', 'pts': side((800, 70), (800, 288))},
                     {'kind': 'trim', 'pts': side((770, 288), (1640, 288), (1700, 280), (1753, 270)), 'width': 1},
                     {'kind': 'hinge', 'at': S(790, 98)}, {'kind': 'hinge', 'at': S(790, 228)}],
            'rear': [{'kind': 'trim', 'pts': [B(-353, 330), B(-310, 320), B(-250, 312), B(-120, 305), B(0, 303), B(120, 305), B(250, 312), B(310, 320), B(353, 330)], 'width': 1},
                     {'kind': 'seam', 'pts': [B(300, 96), B(300, 318)]}, {'kind': 'seam', 'pts': [B(-300, 96), B(-300, 318)]}],
            'front': [{'kind': 'seam', 'pts': [F(290, 90), F(290, 306)]}, {'kind': 'seam', 'pts': [F(-290, 90), F(-290, 306)]}]})
# the roof: a black cloth cap, low at the front, rounded over the back; a drip moulding under its edge
ROOFC = '#3a3b3d'
part('roof', 'roof', 'canvas', 'roof', color=ROOFC, y=[-YB - 4, YB + 4],
     side=side((760, 58), (762, 44), (772, 38), (800, 30), (860, 20), (940, 12), (1020, 6), (1100, 3), (1300, 1), (1500, 1), (1620, 3), (1670, 10), (1710, 24), (1738, 45), (1751, 70), (1754, 86), (1742, 86), (1700, 72), (1640, 64), (770, 64)),
     front=fhalf((0, 0), (250, 0), (300, 5), (330, 18), (348, 38), (356, 58), (358, 80), (350, 88), (0, 88)),
     rear=bhalf((0, 0), (280, 0), (322, 8), (350, 30), (366, 60), (371, 82), (362, 93), (0, 93)),
     top=halfT((677, 0), (677, 180), (682, 215), (697, 239), (724, 252), (765, 258), (1000, 277), (1540, 277), (1592, 271), (1628, 253), (1647, 224), (1653, 180), (1653, 0)), smooth=('top',),
     feats={'side': [{'kind': 'highlight', 'pts': side((800, 36), (940, 18), (1100, 9), (1500, 7), (1640, 12)), 'width': 2}],
            'rear': [{'kind': 'seam', 'pts': [B(-330, 40), B(-250, 34), B(250, 34), B(330, 40)]}],
            'front': [{'kind': 'seam', 'pts': [F(-320, 40), F(-250, 30), F(250, 30), F(320, 40)]}]})
# the visor over the windscreen: a cloth-covered board running forward and down from the roof's front edge
part('visor', 'roof', 'canvas', 'roof', color='#2f3032', y=[-YB - 4, YB + 4],
     side=side((762, 46), (768, 60), (768, 100), (724, 100), (703, 93), (705, 86), (738, 62)),
     front=fhalf((0, 63), (283, 63), (291, 76), (285, 110), (0, 110)),
     top=halfT((668, 0), (668, 215), (677, 232), (680, 0)),
     feats={'front': [{'kind': 'highlight', 'pts': [F(-280, 70), F(280, 70)], 'width': 1}]})
part('screenFrame', 'screen', 'black', 'flat', color='#2a2a2c', on='bodyTop', x=[S(766, 0)[0], S(780, 0)[0]], front=fhalf((0, 108), (259, 108), (259, 287), (150, 280), (0, 273)))
part('screen', 'screen', 'glass', 'side', on='screenFrame', x=[S(768, 0)[0], S(778, 0)[0]], front=fhalf((0, 115), (250, 115), (250, 278), (150, 271), (0, 265)),
     )
# seen through the glass: the steering wheel's rim (left-hand drive); on the glass the wiper hanging from the header
arc = lambda r1, r2: [F(129 + r1 * math.cos(math.radians(a)), 272 - r1 * 0.74 * math.sin(math.radians(a))) for a in range(172, 7, -15)] + [F(129 + r2 * math.cos(math.radians(a)), 272 - r2 * 0.74 * math.sin(math.radians(a))) for a in range(8, 173, 15)]
part('steerRim', 'screen', 'black', 'flat', color='#5a5148', on='screen', x=[S(900, 0)[0], S(906, 0)[0]], front=arc(80, 69), lift=1)
part('wiper', 'screen', 'black', 'flat', color='#242426', on='screen', x=[S(762, 0)[0], S(766, 0)[0]], front=[F(*q) for q in ((73, 182), (150, 110), (160, 110), (160, 116), (82, 190), (74, 190))], lift=2)
# the narrow corner lights either side of the screen (front sheet)
part('wframeQ', 'body', 'black', 'flat', color='#2c2d2f', on='bodyTop', pair=True, x=[S(770, 0)[0], S(795, 0)[0]], front=rrect(F(296, 0)[0], F(0, 296)[1], F(336, 0)[0], F(0, 97)[1], 22))
part('glassQ', 'body', 'black', 'flat', color='#3d4148', on='wframeQ', pair=True, x=[S(772, 0)[0], S(793, 0)[0]], front=rrect(F(306, 0)[0], F(0, 284)[1], F(325, 0)[0], F(0, 110)[1], 14))
# side windows: three a side; a raised black surround, a varnished wood garnish, the glass
for k, (a, c) in enumerate(((812, 1082), (1152, 1408), (1447, 1625))):
    part(f'wframe{k}', 'body', 'black', 'side', color='#313234', on='bodyTop', y=[YB, YB + 2], pair=True, side=srect(a, 82, c, 275, 34))
    part(f'wood{k}', 'body', 'wood', 'flat', color='#8a6238', on=f'wframe{k}', y=[YB + 2, YB + 3], pair=True, side=srect(a + 13, 94, c - 5 if k < 2 else c - 22, 262, 24))
    part(f'glass{k}', 'body', 'glass', 'side', on=f'wood{k}', y=[YB + 3, YB + 4], pair=True, side=srect(a + 19, 101, c - 10 if k < 2 else c - 28, 249, 16))
# door handles: a nickel lever and its boss either side of the centre pillar (side); their ends seen from in front and behind
part('handle0', 'body', 'chrome', 'flat', on='body', pair=True, y=[YB, YB + 30], smooth=('side',), lift=2,
     side=side((1035, 324), (1080, 322), (1084, 308), (1090, 303), (1097, 307), (1101, 322), (1101, 336), (1092, 342), (1083, 339), (1079, 333), (1035, 331)),
     front=[F(*q) for q in ((346, 297), (360, 296), (364, 301), (360, 307), (346, 306))], top=top((1040, 284), (1070, 284), (1072, 300), (1040, 300)), rear=[B(*q) for q in ((352, 305), (366, 304), (370, 310), (366, 316), (352, 315))])
part('handle1', 'body', 'chrome', 'flat', on='body', pair=True, y=[YB, YB + 30], smooth=('side',), lift=2,
     side=side((1137, 322), (1141, 307), (1148, 303), (1154, 308), (1158, 322), (1202, 324), (1202, 331), (1159, 333), (1155, 339), (1146, 342), (1137, 336)))
part('rearFrame', 'body', 'black', 'flat', color='#2c2d2f', on='bodyTop', x=[S(1749, 0)[0], S(1753, 0)[0]], rear=rrect(B(-171, 0)[0], B(0, 261)[1], B(171, 0)[0], B(0, 122)[1], 30))
part('rearGlass', 'body', 'glass', 'side', on='rearFrame', x=[S(1747, 0)[0], S(1751, 0)[0]], rear=rrect(B(-159, 0)[0], B(0, 253)[1], B(159, 0)[0], B(0, 131)[1], 16))
part('rearApron', 'body', 'black', 'flat', color=BLK, x=[S(1640, 0)[0], S(1730, 0)[0]], rear=bhalf((0, 655), (312, 655), (312, 806), (0, 806)))

# ---------------- wings, boards ----------------
part('fenderF', 'fenderF', 'paint2', 'fender', slot='fenderF', pair=True, cutWheel={'i': 0, 'r': R + 10}, smooth=('front', 'side', 'top'),
     side=side((66, 524), (72, 505), (85, 485), (120, 460), (160, 440), (200, 424), (260, 412), (320, 416), (360, 428), (400, 446), (440, 470), (480, 505), (520, 545), (560, 582), (600, 612), (640, 630), (680, 648), (720, 664), (776, 674),
               (776, 700), (720, 694), (680, 684), (640, 670), (600, 656), (560, 632), (520, 600), (480, 562), (440, 522), (400, 491), (360, 469), (320, 456), (260, 451), (200, 460), (160, 477), (120, 502), (90, 522), (72, 530)),
     front=[F(*q) for q in ((453, 553), (447, 522), (424, 504), (376, 497), (329, 500), (298, 516), (277, 540), (256, 580), (229, 633), (196, 693), (180, 716), (202, 727), (218, 700), (250, 645), (274, 604), (290, 584), (309, 588), (356, 597), (416, 597), (443, 587), (453, 568))],
     top=top((60, 262), (62, 300), (75, 322), (100, 329), (470, 327), (600, 315), (705, 309), (705, 240), (560, 222), (420, 212), (330, 205), (200, 200), (130, 200), (80, 204), (64, 225)),
     feats={'side': [{'kind': 'highlight', 'pts': side((92, 492), (124, 468), (162, 450), (202, 434), (260, 422), (318, 426), (358, 438), (396, 456), (436, 480), (476, 516), (516, 556), (556, 592), (598, 622), (640, 640)), 'width': 3},
                     {'kind': 'seam', 'pts': side((100, 508), (130, 484), (165, 464), (205, 448), (260, 437), (318, 441), (358, 454), (396, 475), (436, 504), (476, 544), (516, 584), (556, 616), (598, 642), (640, 657), (700, 680))}],
            'front': [{'kind': 'highlight', 'pts': [F(*q) for q in ((440, 530), (420, 514), (376, 507), (330, 510), (305, 524))], 'width': 3}],
            'top': [{'kind': 'highlight', 'pts': top((100, 300), (250, 306), (400, 300)), 'width': 3}]})
part('fenderR', 'fenderR', 'paint2', 'fender', slot='fenderR', pair=True, cutWheel={'i': 1, 'r': R + 10}, smooth=('rear', 'side', 'top'),
     side=side((1282, 700), (1282, 600), (1290, 560), (1300, 524), (1325, 480), (1360, 445), (1400, 422), (1450, 410), (1500, 407), (1550, 412), (1600, 430), (1640, 455), (1675, 490), (1700, 530), (1720, 570), (1737, 610), (1755, 645), (1780, 670), (1801, 678),
               (1801, 688), (1768, 687), (1741, 671), (1716, 640), (1698, 604), (1678, 560), (1654, 519), (1625, 486), (1592, 464), (1549, 449), (1500, 445), (1451, 447), (1409, 459), (1376, 480), (1350, 511), (1331, 549), (1319, 592), (1315, 640), (1314, 700)),
     rear=[B(*q) for q in ((431, 753), (431, 540), (424, 492), (404, 466), (372, 460), (345, 467), (322, 500), (313, 560), (308, 640), (304, 700), (304, 762), (420, 767))],
     top=top((1203, 270), (1203, 312), (1215, 326), (1240, 329), (1640, 329), (1668, 318), (1683, 295), (1683, 205), (1660, 205), (1655, 268)),
     feats={'side': [{'kind': 'highlight', 'pts': side((1296, 560), (1308, 526), (1332, 486), (1365, 454), (1403, 432), (1450, 420), (1500, 417), (1548, 422), (1596, 440), (1634, 464), (1668, 498), (1692, 536), (1712, 576), (1730, 614)), 'width': 3},
                     {'kind': 'seam', 'pts': side((1300, 640), (1304, 590), (1316, 545), (1337, 502), (1366, 468), (1403, 445), (1450, 433), (1500, 431), (1550, 435), (1597, 450), (1633, 474), (1664, 508), (1689, 552), (1709, 598), (1726, 634), (1748, 664))}],
            'rear': [{'kind': 'highlight', 'pts': [B(*q) for q in ((424, 520), (412, 484), (380, 470), (350, 478))], 'width': 3}],
            'top': [{'kind': 'highlight', 'pts': top((1240, 304), (1450, 310), (1640, 304)), 'width': 3}]})
part('board', 'board', 'rubber', 'flat', color='#202021', slot='board', pair=True, side=side((700, 672), (1284, 672), (1284, 702), (700, 702)), top=top((705, 236), (705, 309), (1203, 309), (1203, 236)), detail={'kind': 'ribs', 'pitch': 28})
part('boardTrim', 'board', 'chrome', 'flat', on='board', slot='board', pair=True, y=[T(0, 303)[1], T(0, 309)[1]], side=side((776, 676), (1270, 676), (1273, 681), (1273, 694), (1270, 698), (776, 698)), lift=1)   # a bright edge strip along the board

# ---------------- lamps, bumpers, spare ----------------
# bullet headlamps on a tie bar: a painted bowl (dark blue) behind a nickel rim; face on the rim round a pale reflector
part('lamp', 'lamp', 'paint', 'fender', color='#1b2230', slot='lamp', pair=True, smooth=('side', 'top'),
     side=side((170, 322), (195, 326), (215, 340), (230, 360), (237, 378), (230, 396), (215, 412), (195, 424), (170, 428)),
     top=top((158, 94), (185, 100), (205, 116), (220, 136), (224, 143), (220, 150), (205, 170), (185, 186), (158, 190)))
part('lampRim', 'lamp', 'chrome', 'fender', slot='lamp', pair=True, smooth=('front',),
     side=side((152, 326), (156, 320), (172, 319), (172, 429), (156, 428), (152, 422)),
     front=ell(F(196, 0)[0], F(0, 473)[1], F(62, 0)[0], round(62 * H / 976)), top=top((133, 96), (137, 91), (160, 91), (160, 193), (137, 193), (133, 188)))
part('lens', 'lamp', 'chrome', 'flat', on='lampRim', slot='lamp', pair=True, x=[S(150, 0)[0], S(154, 0)[0]], smooth=('front',), front=ell(F(196, 0)[0], F(0, 473)[1], F(53, 0)[0], round(53 * H / 976)), detail={'kind': 'bowl'})
part('lampBar', 'lamp', 'black', 'flat', color='#2b2b2d', slot='lamp', x=[S(196, 0)[0], S(240, 0)[0]], y=[-C * 0.56, C * 0.56], front=fhalf((0, 543), (258, 543), (262, 548), (258, 554), (0, 554)),
     side=side((226, 300), (240, 290), (240, 404), (232, 402), (224, 350)))   # from the side: the dark of the bar's bracket ahead of the shell
part('lampStand', 'lamp', 'black', 'flat', color='#2b2b2d', slot='lamp', pair=True, x=[S(190, 0)[0], S(206, 0)[0]], front=[F(*q) for q in ((184, 528), (208, 528), (204, 546), (204, 562), (188, 562), (188, 546))])
for k, (py, zf, zr) in enumerate(((611, 730, 685), (661, 775, 729))):
    part(f'bumperF{k}', 'bumperF', 'chrome', 'fender', slot='bumperF', side=side((0, py - 15), (34, py - 18), (44, py - 11), (44, py + 11), (34, py + 18), (0, py + 15)), front=fhalf((0, zf - 14), (408, zf - 14), (417, zf - 9), (420, zf), (417, zf + 9), (408, zf + 14), (0, zf + 14)),
         top=halfT((0, 0), (0, 266), (6, 286), (22, 296), (42, 293), (54, 282), (48, 270), (36, 278), (26, 277), (20, 262), (19, 0)))
    part(f'bumperR{k}', 'bumperR', 'chrome', 'fender', slot='bumperR', pair=True, side=side((1820, py - 26 - 13), (1828, py - 26 - 17), (1860, py - 26 - 17), (1868, py - 26 - 8), (1868, py - 26 + 8), (1860, py - 26 + 17), (1828, py - 26 + 17), (1820, py - 26 + 13)),
         rear=[B(*q) for q in ((212, zr - 13), (414, zr - 13), (421, zr - 8), (424, zr), (421, zr + 8), (414, zr + 13), (212, zr + 13))], top=top((1734, 180), (1752, 180), (1752, 268), (1744, 286), (1722, 294), (1702, 288), (1706, 276), (1722, 280), (1731, 270), (1734, 255)))
part('clampF0', 'bumperF', 'chrome', 'flat', on='bumperF0', slot='bumperF', pair=True, x=[0, 30], front=[F(*q) for q in ((174, 712), (192, 712), (194, 722), (194, 784), (192, 794), (174, 794), (172, 784), (172, 722))], lift=1)
part('clampR0', 'bumperR', 'chrome', 'flat', on='bumperR0', slot='bumperR', pair=True, x=[S(1822, 0)[0], S(1850, 0)[0]], rear=[B(*q) for q in ((210, 668), (230, 666), (234, 676), (234, 736), (230, 745), (210, 743))], lift=1)
part('ironF', 'bumperF', 'black', 'flat', color=BLK, slot='bumperF', pair=True, side=side((40, 606), (60, 600), (108, 572), (122, 580), (122, 600), (70, 628), (40, 660)), top=top((14, 96), (14, 112), (70, 132), (125, 152), (125, 136), (80, 118)), lift=1)
part('ironR', 'bumperR', 'black', 'flat', color=BLK, slot='bumperR', pair=True, side=side((1740, 600), (1822, 592), (1822, 644), (1760, 632)), top=top((1640, 196), (1640, 212), (1740, 212), (1740, 196)))
# one tail lamp on a stalk at the left of the back panel (rear sheet): a nickel rim and a red glass
part('tailStem', 'tail', 'black', 'flat', color=BLK, slot='tail', x=[S(1745, 0)[0], S(1752, 0)[0]], rear=[B(*q) for q in ((287, 584), (293, 584), (293, 628), (287, 628))])
part('tailRim', 'tail', 'chrome', 'fender', on='body', slot='tail', smooth=('rear', 'side'), x=[S(1750, 0)[0], S(1760, 0)[0]], rear=ell(B(290, 0)[0], B(0, 562)[1], B(30, 0)[0], round(30 * H / 956)), lift=2)
part('tail', 'tail', 'lensR', 'flat', on='tailRim', slot='tail', smooth=('rear',), x=[S(1752, 0)[0], S(1762, 0)[0]], rear=ell(B(290, 0)[0], B(0, 562)[1], B(21, 0)[0], round(21 * H / 956)), lift=3)
# the spare on the back: edge on from the side and above (the road tyres' own section), a wheel from behind
def tyre_section(u0, u1, v0, v1, across_first=True):
    lo_u, hi_u = 581, 807; hi_v = 762
    return [[round(u0 + (q[0] - lo_u) / (hi_u - lo_u) * (u1 - u0)), round(v0 + q[1] / hi_v * (v1 - v0))] if across_first else
            [round(v0 + q[1] / hi_v * (v1 - v0)), round(u0 + (q[0] - lo_u) / (hi_u - lo_u) * (u1 - u0))] for q in tyre0]
part('spareCarrier', 'spare', 'black', 'flat', color=BLK, side=side((1728, 440), (1750, 430), (1750, 610), (1730, 600)), top=halfT((1686, 0), (1686, 60), (1696, 60), (1696, 0)))
part('spare', 'spare', 'rubber', 'fender', wheel={'r': round(197 * H / 956)},
     side=tyre_section(S(1745, 0)[0], S(1826, 0)[0], S(0, 681)[1], S(0, 339)[1]), rear=ell(0, B(0, 596)[1], B(197, 0)[0], round(197 * H / 956)),
     top=tyre_section(T(1693, 0)[0], T(1767, 0)[0], -T(0, 172)[1], T(0, 172)[1]), smooth=('side', 'top'), detail={'kind': 'treadFace', 'pitch': 38})

# ---------------- the chassis under the body: the draft's chassis-layer parts moved onto this car's wheels ----------------
D = json.load(open(DRAFT)); dw = D['wheels']; kx = (RX - FX) / (dw[1]['x'] - dw[0]['x']); ky = W / D['width']; kz = H / D['height']
mx = lambda v: round(FX + (v - dw[0]['x']) * kx); my = lambda v: round(v * ky); mz = lambda v: round(v * kz)
for p in D['parts']:
    if p.get('layer') != 'chassis': continue
    q = json.loads(json.dumps(p)); b = q['box']; q['box'] = {'x': [mx(b['x'][0]), mx(b['x'][1])], 'y': [my(b['y'][0]), my(b['y'][1])], 'z': [mz(b['z'][0]), mz(b['z'][1])]}
    for v, sb in q.get('sheet', {}).items():
        fa, fb = {'side': (mx, mz), 'front': (my, mz), 'rear': (my, mz), 'top': (mx, my)}[v]; q['sheet'][v] = [fa(sb[0]), fa(sb[1]), fb(sb[2]), fb(sb[3])]
    q.pop('shade', None); P.append(q)

M = {'id': 'chevAB28', 'name': '1928 light sedan', 'year': 1928, 'length': L, 'width': W, 'height': H,
     'paint': '#223249', 'paint2': '#2b2c2e', 'canvas': '#3a3b3d', 'chrome': '#a9a396', 'glassTint': '#b3b3b4',
     'wheels': [{'x': FX, 'r': R, 'y': 700}, {'x': RX, 'r': R, 'y': 700}],
     'wheel': {'rim': 0.64, 'style': 'artillery', 'spokes': 12, 'rimMaterial': 'paint', 'cap': 0.13, 'capRings': 1},   # twelve spokes painted the body's blue, a blue rim, a small nickel hub cap
     'parts': P}
json.dump(M, open(OUT, 'w'), indent=0)
print(OUT, len(P), 'parts;', sum(len(p['outlines']) for p in P), 'outlines')
print('size', L, W, H, 'wheels', FX, RX, R)
print('outlines pulled onto the drawing, mean move in mm:', SNAP)
print('where a view of the sheet differs from the common box by more than 50 mm (each view keeps its own):'); print('\n'.join('  ' + n for n in notes))
