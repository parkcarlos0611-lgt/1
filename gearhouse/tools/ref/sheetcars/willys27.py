"""The 1927 sleeve-valve sedan (sheet 38bcc8df, the left-hand car) as one 3D part model, made by hand in the way of
tools/ref/sedan29_model.py: every part is a box in the car's space (x from the front bumper back, y from the centre
line outwards, z up; mm) and its outline as the sheet shows it from the side, the front or rear, and above. Outlines
are read point by point off gridded 8x enlargements of the sheet's views, in pixel positions on a 4x enlargement of
each view (S side, F front, B rear, T plan). The body-layer parts are written from scratch; the chassis-layer parts
(engine, gearbox, exhaust ... under the body) are the converter's draft's, moved onto this car's wheels.

  python3 willys27.py <views dir> <out json> [draft json] [repository root]"""
import sys, os, json, math
HERE = os.path.dirname(os.path.abspath(__file__))
VIEWS, OUT = sys.argv[1], sys.argv[2]
DRAFT = sys.argv[3] if len(sys.argv) > 3 else f'{HERE}/draft/willys27_auto.json'
REPO = sys.argv[4] if len(sys.argv) > 4 else '/home/user/1/gearhouse'
sys.path.insert(0, f'{REPO}/tools/ref')
import cv2, numpy as np
from zkit import View, fit_closed
from shapely.geometry import Polygon, box as sbox
from shapely.affinity import scale as sscale
from shapely.ops import unary_union

# ---- scale: the tyres stand on the ground centred at 264 and 1430 on the 4x side view (the true road wheels; the spare
# hangs behind the body at 1632-1737 and was not taken for one); 1166 units are the 2883 mm wheelbase ----
K = 2883 / (1430 - 264)                                   # 2.473 mm per unit of the 4x side view (9.89 mm a pixel)
SW, SH, FW, FH, BW, BH, TW, TH = 1748, 836, 884, 952, 868, 924, 1720, 696   # the views' sizes in 4x units (437x209, 221x238, 217x231, 430x174 px)
L, H = round(SW * K), round(SH * K); W = round(FW * H / FH)   # review 72: the front view keeps the sheet's proportions (was 1870)              # the width: the front view at its own height scale gives 1920, the plan 1750
C = W / 2
FX, RX, R = round(264 * K), round(1430 * K), 445
S = lambda px, py: [round(px * L / SW), round(H - py * H / SH)]               # side view
F = lambda dx, py: [round(dx * H / FH), round(H - py * H / FH)]               # front view: distance from the centre line, row
B = lambda dx, py: [round(dx * H / BH), round(H - py * H / BH)]               # rear view
T = lambda px, dy: [round(px * L / TW), round(dy * W / TH)]                   # plan view: along, distance from the centre line
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
def rrect(x0, z0, x1, z1, r, n=4):
    out = []
    for cx, cz, a0 in ((x1 - r, z1 - r, 0), (x0 + r, z1 - r, 90), (x0 + r, z0 + r, 180), (x1 - r, z0 + r, 270)):
        for k in range(n + 1): a = math.radians(a0 + 90 * k / n); out.append([round(cx + math.cos(a) * r), round(cz + math.sin(a) * r)])
    return out
def srrect(a, b, c, d, r):
    """a rounded rectangle given by two corners on the side view"""
    (x0, z1), (x1, z0) = S(a, b), S(c, d); return rrect(x0, z0, x1, z1, r)
def brrect(a, b, c, d, r):
    """the same on the rear view (a, c: distances from the centre line, signed)"""
    (x0, z1), (x1, z0) = B(a, b), B(c, d); return rrect(x0, z0, x1, z1, r)
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

BLK = '#1e1e20'                                           # the sheet's black of the valances and the wheel houses
TOPBLK = '#20211a'                                        # the body above the belt: a black with the paint's green in it (measured on the rear quarter)
WOOD = '#c8742e'                                          # the varnished wood of the window surrounds and the screen frame
# ---------------- running gear seen from outside ----------------
def arch(wx, r, lo, hi, low=-60):
    """the dark of a wheel house: a half circle over the wheel, kept inside lo..hi"""
    a = [[min(hi, max(lo, round(wx + math.cos(t) * r))), round(R + math.sin(t) * r)] for t in [math.pi * k / 16 for k in range(16, -1, -1)]]
    return [[a[0][0], R + low]] + a + [[a[-1][0], R - 60]]
part('house0', 'house', 'black', 'flat', color=BLK, y=[0, 700], side=arch(FX, 560, S(80, 0)[0], FX + 560, 150))
part('house1', 'house', 'black', 'flat', color=BLK, y=[0, 700], side=arch(RX, 520, S(1242, 0)[0], S(1650, 0)[0]))
part('frame', 'frame', 'black', 'flat', pair=True, side=[[170, 480], [L - 330, 480], [L - 330, 590], [170, 590]], front=[[380, 480], [450, 480], [450, 590], [380, 590]], rear='front', top=[[170, 380], [L - 330, 380], [L - 330, 450], [170, 450]])
# from in front the axle and the steering gear are one dark band under the bumper; from behind the axle with the round of the differential
part('axleF', 'axle', 'black', 'flat', x=[FX - 40, FX + 40], front=fhalf((0, 820), (70, 816), (130, 806), (316, 802), (316, 776), (0, 776)))
part('springF', 'spring', 'iron', 'flat', x=[FX - 30, FX + 30], front=fhalf((0, 764), (120, 766), (290, 778), (314, 786), (314, 796), (290, 790), (120, 778), (0, 776)))
part('axleR', 'axle', 'black', 'flat', x=[RX - 47, RX + 47], rear=bhalf((0, 806), (40, 800), (75, 776), (110, 764), (314, 760), (314, 736), (0, 736)), smooth=('rear',))
part('springR', 'spring', 'iron', 'flat', x=[RX + 60, RX + 120], rear=bhalf((0, 728), (60, 730), (220, 742), (312, 754), (312, 764), (220, 754), (60, 742), (0, 740)))
tyre0 = [[606, 6], [640, 0], [748, 0], [782, 6], [798, 40], [805, 200], [807, 381], [804, 560], [796, 690], [782, 734], [760, 754], [725, 762], [663, 762], [628, 754], [606, 734], [592, 690], [584, 560], [581, 381], [583, 200], [590, 40]]   # a balloon section face on: flat where it stands, round at the top
def tyre(y0, y1): return [[round(y0 + (q[0] - 581) / 226 * (y1 - y0)), round(q[1] / 762 * 2 * R)] for q in tyre0]
TF = (F(309, 0)[0], F(414, 0)[0]); TR = (B(314, 0)[0], B(412, 0)[0])            # the tyres' inner and outer faces on the front and rear views
part('tyreF', 'wheel', 'rubber', 'fender', x=[FX - 420, FX + 420], pair=True, front=tyre(*TF), top=[[FX - 330, TF[0]], [FX + 420, TF[0]], [FX + 420, TF[1]], [FX - 330, TF[1]]], smooth=('front',), detail={'kind': 'treadFace', 'pitch': 40})
part('tyreR', 'wheel', 'rubber', 'fender', x=[RX - 420, RX + 420], pair=True, rear=tyre(*TR), top=[[RX - 420, TR[0]], [T(1560, 0)[0], TR[0]], [T(1560, 0)[0], TR[1]], [RX - 420, TR[1]]], smooth=('rear',), detail={'kind': 'treadFace', 'pitch': 40})

# ---------------- body ----------------
# the dark between the wings ahead of the shell (plan) and under the shell and lamps (front)
part('splash', 'apron', 'black', 'flat', color=BLK, z=[330, 900], x=[S(250, 0)[0], S(440, 0)[0]], top=halfT((60, 0), (60, 170), (215, 170), (215, 0)), front=fhalf((0, 802), (316, 802), (316, 545), (0, 545)))
part('crossF', 'frame', 'black', 'flat', x=[170, 260], z=[420, 480], top=[[150, -250], [150, 250], [240, 250], [240, -250]], front=half([0, 420], [450, 420], [450, 480], [0, 480]))
# the black valance between the body's bottom edge and the running board, running forward under the hood behind the front wing
part('apron', 'apron', 'black', 'flat', color=BLK, y=[-640, 640], side=side((462, 560), (540, 580), (1242, 580), (1240, 700), (455, 700)),
     feats={'side': [{'kind': 'crease', 'pts': side((548, 586), (1240, 586))}]})
# radiator: a narrow nickel shell with a low arched top and a diamond badge in the arch; from the side the core's dark edge stands ahead of it
part('shell', 'radiator', 'chrome', 'flat', slot='grille',
     side=side((198, 300), (202, 288), (212, 283), (246, 283), (246, 585), (198, 585)),
     front=fhalf((0, 318), (50, 320), (92, 329), (118, 344), (133, 368), (137, 400), (137, 664), (126, 686), (102, 693), (0, 695)), smooth=('front',),
     top=halfT((168, 0), (168, 92), (178, 110), (211, 112), (211, 0)))
part('core', 'radiator', 'black', 'flat', on='shell', slot='grille', y=[F(-114, 0)[0], F(114, 0)[0]],
     side=side((180, 312), (190, 298), (199, 296), (199, 585), (180, 585)),
     front=fhalf((0, 366), (86, 366), (104, 372), (114, 392), (114, 640), (104, 657), (0, 659)), smooth=('front',), detail={'kind': 'cells', 'pitch': 24})
part('badge', 'radiator', 'chrome', 'flat', on='shell', slot='grille', x=[S(194, 0)[0], S(198, 0)[0]], front=fr((0, 326), (19, 345), (0, 364), (-19, 345)), lift=1)
part('badgeGem', 'radiator', 'black', 'flat', on='badge', slot='grille', color='#3c3d33', x=[S(193, 0)[0], S(197, 0)[0]], front=fr((0, 334), (11, 345), (0, 356), (-11, 345)), lift=2)
part('crankCover', 'radiator', 'black', 'flat', on='shell', slot='grille', x=[S(192, 0)[0], S(198, 0)[0]], front=fell(0, 684, 9), smooth=('front',), lift=2)
# the cap with its winged ornament
part('cap', 'radiator', 'chrome', 'flat', slot='grille', smooth=('side', 'front'),
     side=side((206, 283), (207, 275), (214, 264), (206, 255), (193, 252), (190, 244), (196, 238), (210, 239), (217, 232), (224, 239), (240, 239), (246, 245), (242, 252), (231, 255), (226, 264), (232, 275), (234, 283)),
     front=fhalf((0, 247), (9, 251), (23, 268), (10, 285), (6, 296), (13, 306), (16, 318), (0, 321)),
     top=tell(188, 0, 20))
part('hood', 'hood', 'paint', 'side', fit=2, nofit=('front', 'top'),
     side=side((247, 283), (610, 270), (610, 580), (247, 580)),
     front=fhalf((0, 298), (70, 302), (150, 317), (215, 345), (255, 385), (273, 430), (273, 600), (190, 650), (0, 650)), smooth=('front',),
     top=halfT((211, 0), (211, 112), (535, 215), (535, 0)),
     feats={'side': [{'kind': 'louvres', 'x0': S(308, 0)[0], 'x1': S(562, 0)[0], 'z0': S(0, 520)[1], 'z1': S(0, 386)[1], 'n': 20, 'slant': 0},
                     {'kind': 'crease', 'pts': side((250, 344), (608, 342))},                              # the hood's fold over its side panel
                     {'kind': 'highlight', 'pts': side((254, 296), (430, 290), (604, 284)), 'width': 2},
                     {'kind': 'bolt', 'at': S(577, 540)}, {'kind': 'bolt', 'at': S(577, 553)}],             # the two latch knobs low on the hood's side
            'top': [{'kind': 'trim', 'pts': top((216, 0), (533, 0)), 'width': 1}, {'kind': 'highlight', 'pts': top((225, 80), (530, 170)), 'width': 2}, {'kind': 'highlight', 'pts': top((225, -80), (530, -170)), 'width': 2}]})
# the raised band between hood and cowl (a grey-green strip on the sheet)
part('hoodBand', 'cowl', 'paint', 'flat', on='cowl', color='#84866e', side=side((609, 270), (619, 270), (619, 580), (609, 580)), top=halfT((535, 0), (535, 215), (548, 219), (548, 0)))
part('cowl', 'cowl', 'paint', 'side', fit=2, nofit=('front', 'top'),
     side=side((618, 270), (676, 268), (700, 262), (720, 250), (722, 300), (753, 302), (753, 580), (618, 580)),
     front=fhalf((0, 290), (120, 296), (220, 318), (285, 350), (322, 395), (322, 560), (0, 560)), smooth=('front',),
     top=halfT((548, 0), (548, 219), (605, 238), (605, 0)),
     feats={'side': [{'kind': 'highlight', 'pts': side((624, 284), (676, 281), (700, 275)), 'width': 2}, {'kind': 'crease', 'pts': side((622, 312), (752, 314))}]})
# cowl lamps: a small nickel lamp each side at the belt, just ahead of the screen (side, front and plan views)
part('cowlLamp', 'lamp', 'chrome', 'fender', pair=True, smooth=('side', 'front', 'top'), side=sell(665, 292, 13), front=fell(337, 356, 12), top=tell(627, 240, 11))
part('cowlLens', 'lamp', 'black', 'flat', on='cowlLamp', pair=True, smooth=('side',), color='#3a3b3e', y=[F(337, 0)[0] - 10, F(337, 0)[0] + 10], side=sell(663, 292, 6), lift=1)
# the body: olive up to the belt; above the belt it is black (bodyTop). Its side follows the rear wheel arch behind the wing.
BODY_TOP = ((670, 0), (670, 255), (690, 265), (1520, 265), (1565, 252), (1585, 225), (1592, 180), (1592, 0))
part('body', 'body', 'paint', 'side', fit=2, nofit=('top', 'front', 'rear'),
     side=side((753, 580), (753, 302), (720, 300), (720, 95), (735, 75), (760, 60), (1570, 60), (1608, 68), (1628, 84), (1637, 108), (1638, 300), (1633, 340), (1618, 400), (1600, 445), (1586, 485), (1576, 525),
               (1545, 468), (1500, 440), (1450, 428), (1400, 428), (1345, 440), (1300, 466), (1268, 505), (1250, 560), (1245, 580)),
     front=fhalf((0, 45), (318, 45), (333, 70), (335, 100), (335, 330), (322, 400), (322, 560), (0, 560)),
     rear=bhalf((0, 5), (250, 5), (310, 15), (336, 40), (346, 85), (346, 305), (341, 345), (326, 400), (308, 470), (294, 540), (288, 575), (0, 578)),
     top=halfT(*BODY_TOP),
     feats={'side': [{'kind': 'seam', 'pts': side((753, 303), (753, 579))}, {'kind': 'seam', 'pts': side((1048, 318), (1048, 579))}, {'kind': 'seam', 'pts': side((1060, 318), (1060, 579))},
                     {'kind': 'seam', 'pts': side((1335, 318), (1335, 410), (1322, 452), (1296, 470), (1268, 506), (1251, 560), (1247, 578))},
                     {'kind': 'highlight', 'pts': side((756, 320), (1200, 320), (1630, 319)), 'width': 1},   # the pale edge under the belt moulding
                     {'kind': 'crease', 'pts': side((758, 572), (1242, 572))},
                     ],
            'rear': [{'kind': 'seam', 'pts': [B(-237, 312), B(-237, 574)]}, {'kind': 'seam', 'pts': [B(237, 312), B(237, 574)]},
                     {'kind': 'highlight', 'pts': [B(-338, 322), B(-240, 312), B(0, 308), B(240, 312), B(338, 322)], 'width': 1}]})
part('bodyTop', 'body', 'paint2', 'side', on='body', color=TOPBLK, y=[0, 660],
     side=side((720, 300), (720, 95), (735, 75), (760, 60), (1570, 60), (1608, 68), (1628, 84), (1637, 108), (1638, 300), (1600, 306), (753, 306)),
     front=fhalf((0, 45), (318, 45), (333, 70), (335, 100), (335, 330), (0, 330)),
     rear=bhalf((0, 40), (322, 40), (340, 60), (346, 90), (346, 306), (250, 292), (0, 287)),
     feats={'side': [{'kind': 'seam', 'pts': side((1048, 64), (1048, 304))}, {'kind': 'seam', 'pts': side((1060, 64), (1060, 304))}, {'kind': 'seam', 'pts': side((1335, 64), (1335, 304))},
                     {'kind': 'highlight', 'pts': side((840, 58), (1540, 58)), 'width': 1},                  # the drip moulding under the roof's edge
                     {'kind': 'highlight', 'pts': side((756, 299), (1200, 300), (1634, 298)), 'width': 1},    # the belt moulding
                     {'kind': 'hinge', 'at': S(753, 110)}, {'kind': 'hinge', 'at': S(1335, 110)}],
            'rear': [{'kind': 'highlight', 'pts': [B(-344, 304), B(-250, 290), B(0, 285), B(250, 290), B(344, 304)], 'width': 1},
                     {'kind': 'highlight', 'pts': [B(-250, 56), B(250, 56)], 'width': 1}]})
# the roof: black cloth over a low cap with rounded back corners; from above its outline is the body's, with the welt of its inner panel
part('roof', 'roof', 'canvas', 'roof', color='#2b2b2d', fit=2, nofit=('front', 'rear', 'top'),
     side=side((760, 62), (760, 30), (800, 19), (900, 11), (1100, 6), (1450, 8), (1540, 13), (1590, 22), (1620, 40), (1635, 68), (1640, 110), (1628, 84), (1608, 69), (1570, 62)),
     front=fhalf((0, 3), (230, 3), (296, 11), (322, 30), (333, 55), (335, 80), (0, 80)),
     rear=bhalf((0, 3), (250, 3), (310, 13), (336, 38), (346, 85), (0, 85)),
     top=halfT(*BODY_TOP),
     feats={'top': [{'kind': 'seam', 'pts': top((690, 0), (690, s * 232), (706, s * 246), (1515, s * 246), (1553, s * 236), (1568, s * 212), (1574, s * 170), (1574, 0))} for s in (-1, 1)]})
# the corner posts either side of the screen, in the body's green gone dark, each with a narrow pane (front view)
part('postF', 'body', 'paint', 'flat', on='bodyTop', color='#4a4d38', pair=True, x=[S(720, 0)[0], S(753, 0)[0]], front=fr((252, 92), (333, 92), (335, 330), (252, 330)), lift=1)
part('postGlass', 'body', 'black', 'flat', on='postF', color='#23251d', pair=True, x=[S(720, 0)[0], S(753, 0)[0]], front=frrect(264, 106, 316, 292, 10), lift=2)
# the visor over the windscreen: a cloth-covered peak sloping forward and down from the roof's front edge
part('visor', 'roof', 'canvas', 'roof', color='#2a2b26',
     side=side((630, 100), (650, 78), (700, 48), (760, 30), (760, 62), (735, 76), (720, 94), (650, 113), (636, 113)),
     front=fhalf((0, 46), (276, 46), (286, 60), (284, 93), (0, 93)),
     top=halfT((605, 0), (605, 226), (645, 232), (670, 256), (670, 0)),
     feats={'front': [{'kind': 'highlight', 'pts': [F(-270, 57), F(270, 57)], 'width': 1}], 'side': [{'kind': 'highlight', 'pts': side((640, 96), (700, 56), (756, 36)), 'width': 1}]})
# the windscreen: a wood-framed screen standing ahead of the corner posts, in two panes; from the side its frame is seen edge on
part('screenFrame', 'screen', 'wood', 'flat', on='bodyTop', color=WOOD, x=[S(692, 0)[0], S(720, 0)[0]], front=frrect(-250, 95, 250, 282, 14),
     side=side((692, 96), (720, 96), (720, 256), (692, 256)))
part('screenIn', 'screen', 'black', 'flat', on='screenFrame', color='#1c1d1b', x=[S(693, 0)[0], S(719, 0)[0]], front=frrect(-241, 104, 241, 273, 8), side=side((699, 104), (720, 104), (720, 248), (699, 248)), lift=1)
part('screen', 'screen', 'glass', 'side', on='screenIn', x=[S(694, 0)[0], S(718, 0)[0]], front=fr((-190, 136), (-180, 130), (148, 130), (158, 138), (158, 225), (-190, 225)), side=side((704, 110), (716, 110), (716, 240), (704, 240)), lift=2)
part('screenTop', 'screen', 'wood', 'flat', color=WOOD, x=[S(692, 0)[0], S(720, 0)[0]], z=[S(0, 104)[1], S(0, 96)[1] + 400], top=top((617, -212), (650, -212), (650, -204), (626, -204), (626, 204), (650, 204), (650, 212), (617, 212)))
part('screenBar', 'screen', 'paint2', 'flat', on='screenIn', color='#34362a', x=[S(690, 0)[0], S(694, 0)[0]], front=fr((-12, 102), (12, 102), (12, 262), (-12, 262)), lift=3)
part('steerRim', 'steering', 'wood', 'flat', on='screenIn', color=WOOD, x=[S(800, 0)[0], S(810, 0)[0]], lift=4,
     front=[[F(120, 0)[0] + round(math.cos(math.radians(a)) * r * W / FW), F(0, 290)[1] + round(math.sin(math.radians(a)) * r * H / FH)] for r, aa in ((90, range(15, 166, 15)), (82, range(165, 14, -15))) for a in aa],
     side=side((788, 206), (796, 203), (833, 262), (823, 264)))
part('wiper', 'screen', 'chrome', 'flat', on='screenIn', x=[S(688, 0)[0], S(692, 0)[0]], front=fr((130, 92), (138, 96), (40, 160), (34, 156)), lift=5)
# door handles: nickel handles either side of the centre post; from behind they stand out of the body's side
for k, pts in enumerate((((984, 331), (1028, 331), (1033, 324), (1046, 326), (1049, 345), (1038, 353), (1028, 344), (984, 343)),
                         ((1126, 331), (1082, 331), (1077, 324), (1064, 326), (1061, 345), (1072, 353), (1082, 344), (1126, 343)))):
    part(f'doorHandle{k}', 'body', 'chrome', 'flat', on='body', pair=True, y=[660, 700], side=side(*pts), lift=2,
         **({'rear': re((336, 340), (348, 338), (352, 346), (348, 354), (336, 352))} if k else {}))
# the doors' exposed hinges: long nickel knuckles on the front door's leading edge and the rear door's trailing edge
for k, (a, b, c, d) in enumerate(((747, 334, 760, 366), (747, 478, 760, 512), (1329, 360, 1341, 392))):
    part(f'hinge{k}', 'body', 'chrome', 'flat', on='body', pair=True, y=[660, 680], side=srrect(a, b, c, d, 8), lift=2)
# side windows: three a side, each in a varnished wood surround; the glass shows pale where the sheet does (a dark blind edge behind it in the rear two)
WIN = (((775, 88, 1027, 277), (793, 108, 1010, 263)), ((1090, 88, 1313, 277), (1100, 108, 1272, 263)), ((1360, 88, 1523, 277), (1368, 108, 1468, 263)))
for k, (fo, gl) in enumerate(WIN):
    part(f'wframe{k}', 'body', 'wood', 'side', on='bodyTop', color=WOOD, y=[660, 662], pair=True, side=srrect(*fo, 30))
    part(f'wreveal{k}', 'body', 'black', 'flat', on=f'wframe{k}', color='#1b1c1a', y=[661, 663], pair=True, side=srrect(fo[0] + 9, fo[1] + 9, fo[2] - 9, fo[3] - 9, 21), lift=1)
    part(f'glass{k}', 'body', 'glass', 'side', on=f'wreveal{k}', y=[662, 664], pair=True, side=srrect(*gl, 10), lift=2)
part('rearFrame', 'body', 'wood', 'flat', on='bodyTop', color=WOOD, x=[S(1634, 0)[0], S(1638, 0)[0]], rear=brrect(-158, 110, 158, 240, 22))
part('rearReveal', 'body', 'black', 'flat', on='rearFrame', color='#1b1c1a', x=[S(1634, 0)[0], S(1638, 0)[0]], rear=brrect(-149, 119, 149, 231, 14), lift=1)
part('rearGlass', 'body', 'glass', 'side', on='rearReveal', x=[S(1634, 0)[0], S(1638, 0)[0]], rear=brrect(-146, 124, 146, 226, 8), lift=2)
part('rearBar', 'body', 'black', 'flat', on='rearReveal', color='#1b1c1a', x=[S(1634, 0)[0], S(1638, 0)[0]], rear=re((-9, 120), (5, 120), (5, 230), (-9, 230)), lift=3)
part('rearApron', 'body', 'black', 'flat', color=BLK, x=[S(1570, 0)[0], S(1630, 0)[0]], rear=bhalf((0, 574), (296, 574), (300, 740), (0, 740)))

# ---------------- wings, boards ----------------
part('fenderF', 'fenderF', 'paint2', 'fender', slot='fenderF', pair=True, smooth=('front', 'side', 'top'),
     side=side((55, 528), (60, 510), (80, 482), (120, 451), (170, 429), (230, 419), (290, 421), (350, 436), (400, 461), (440, 496), (480, 541), (520, 590), (560, 630), (600, 659), (650, 681), (703, 690),
               (703, 706), (640, 701), (590, 682), (545, 652), (505, 612), (470, 567), (435, 523), (395, 488), (345, 464), (290, 450), (230, 448), (170, 457), (125, 477), (95, 502), (75, 527), (60, 537)),
     front=fr((440, 480), (436, 452), (420, 434), (390, 426), (350, 426), (318, 433), (298, 449), (288, 470), (280, 500), (262, 520), (225, 560), (190, 620), (160, 690), (215, 694), (235, 640), (262, 598), (290, 570), (320, 560), (400, 559), (425, 549), (438, 522)),
     top=top((42, 250), (50, 308), (75, 337), (120, 346), (450, 345), (560, 331), (610, 319), (672, 318), (672, 262), (605, 238), (535, 216), (211, 112), (160, 110), (110, 124), (70, 158), (48, 200)),
     feats={'side': [{'kind': 'highlight', 'pts': side((84, 490), (124, 460), (172, 438), (230, 428), (290, 430), (348, 445), (396, 470), (436, 505), (476, 550), (516, 598)), 'width': 2}],
            'front': [{'kind': 'highlight', 'pts': fr((425, 462), (400, 440), (350, 436), (316, 446)), 'width': 2}],
            'top': [{'kind': 'highlight', 'pts': top((90, 305), (250, 318), (450, 316)), 'width': 2}]})
part('fenderR', 'fenderR', 'paint2', 'fender', slot='fenderR', pair=True, smooth=('rear', 'side', 'top'),
     side=side((1238, 702), (1238, 610), (1245, 555), (1262, 502), (1295, 460), (1340, 433), (1400, 420), (1450, 420), (1500, 431), (1545, 458), (1580, 503), (1604, 556), (1624, 613), (1650, 662), (1690, 688), (1692, 702),
               (1660, 702), (1625, 674), (1598, 622), (1575, 565), (1550, 517), (1512, 481), (1460, 458), (1400, 455), (1345, 468), (1305, 494), (1280, 535), (1270, 588), (1268, 702)),
     rear=re((300, 742), (316, 600), (322, 440), (332, 412), (350, 400), (400, 400), (424, 414), (434, 450), (434, 700), (424, 742)),
     top=top((1205, 262), (1205, 330), (1240, 345), (1300, 348), (1440, 348), (1495, 338), (1545, 318), (1574, 288), (1582, 258), (1565, 252), (1520, 265)),
     feats={'side': [{'kind': 'highlight', 'pts': side((1254, 552), (1270, 507), (1300, 470), (1343, 443), (1400, 430), (1450, 430), (1497, 441), (1538, 467), (1570, 508)), 'width': 2}],
            'rear': [{'kind': 'highlight', 'pts': re((340, 420), (360, 410), (400, 410), (420, 424)), 'width': 2}],
            'top': [{'kind': 'highlight', 'pts': top((1250, 330), (1370, 336), (1480, 328)), 'width': 2}]})
# the running board: a ribbed mat with a bright edge strip its whole length (side and plan)
part('board', 'board', 'rubber', 'flat', color='#232325', slot='board', pair=True, side=side((703, 664), (1238, 664), (1238, 706), (703, 706)), top=top((672, 262), (672, 318), (1205, 318), (1205, 262)), detail={'kind': 'ribs', 'pitch': 28})
part('boardTrim', 'board', 'chrome', 'flat', on='board', slot='board', pair=True, side=side((705, 666), (1224, 666), (1220, 699), (705, 699)), top=top((676, 300), (676, 314), (1200, 314), (1200, 300)), lift=1)

# ---------------- lamps, bumpers, spare ----------------
# drum-fronted nickel headlamps with a bowl behind; face on a rim round a pale lens; each on a beaded nickel post, a tie bar between them (plan)
part('lamp', 'lamp', 'chrome', 'fender', slot='lamp', pair=True, smooth=('side', 'front', 'top'),
     side=side((100, 350), (112, 345), (122, 348), (150, 356), (175, 376), (186, 398), (181, 420), (160, 440), (122, 450), (112, 452), (100, 446), (96, 400)),
     front=fell(205, 430, 66), top=top((105, 125), (116, 118), (150, 128), (178, 158), (187, 180), (178, 202), (150, 230), (116, 240), (105, 233)))
part('lampRim', 'lamp', 'chrome', 'flat', on='lamp', slot='lamp', pair=True, y=[F(139, 0)[0], F(271, 0)[0]], side=side((99, 351), (110, 345), (121, 348), (122, 450), (111, 452), (99, 446), (95, 400)), smooth=('side',), lift=1)
part('lampGap', 'lamp', 'iron', 'flat', on='lamp', slot='lamp', pair=True, x=[S(96, 0)[0], S(100, 0)[0]], smooth=('front',), front=fell(205, 430, 58))
part('lens', 'lamp', 'chrome', 'flat', on='lampGap', slot='lamp', pair=True, x=[S(95, 0)[0], S(99, 0)[0]], smooth=('front',), front=fell(205, 430, 55), detail={'kind': 'bowl'})
part('lampStand', 'lamp', 'chrome', 'flat', slot='lamp', pair=True, side=side((106, 450), (126, 449), (130, 470), (104, 470)), front=fr((197, 494), (213, 494), (215, 560), (210, 592), (200, 592), (195, 560)))
part('lampBar', 'lamp', 'chrome', 'flat', slot='lamp', color='#8f8d88', z=[S(0, 440)[1], S(0, 425)[1]], top=halfT((127, 0), (127, 126), (150, 126), (150, 0)))
for k, (py, zf, zr) in enumerate(((613, 714, 668), (658, 758, 711))):
    part(f'bumperF{k}', 'bumperF', 'chrome', 'fender', slot='bumperF', side=side((2, py - 14), (52, py - 14), (58, py), (52, py + 14), (2, py + 14)), front=fhalf((0, zf - 14), (378, zf - 14), (386, zf), (378, zf + 14), (0, zf + 14)),
         top=halfT((0, 0), (0, 185), (7, 216), (28, 237), (42, 227), (27, 205), (24, 185), (24, 0)))
    part(f'bumperR{k}', 'bumperR', 'chrome', 'fender', slot='bumperR', side=side((1688, py - 14 + 8), (1746, py - 14 + 8), (1746, py + 14 + 8), (1688, py + 14 + 8)), rear=bhalf((0, zr - 13), (378, zr - 13), (386, zr), (378, zr + 13), (0, zr + 13)),
         top=halfT((1648, 0), (1648, 150), (1640, 192), (1612, 240), (1627, 249), (1660, 197), (1672, 150), (1672, 0)))
part('clampF', 'bumperF', 'chrome', 'flat', on='bumperF0', slot='bumperF', pair=True, x=[0, 30], front=fr((150, 690), (176, 690), (176, 780), (150, 780)), lift=1)
part('endF', 'bumperF', 'chrome', 'flat', on='bumperF0', slot='bumperF', pair=True, x=[0, 30], front=fr((374, 694), (388, 694), (388, 778), (374, 778)), side=side((6, 590), (30, 590), (30, 682), (6, 682)), lift=1)
part('clampR', 'bumperR', 'chrome', 'flat', on='bumperR0', slot='bumperR', pair=True, x=[S(1715, 0)[0], S(1746, 0)[0]], rear=re((147, 650), (173, 650), (173, 733), (147, 733)), lift=1)
part('endR', 'bumperR', 'chrome', 'flat', on='bumperR0', slot='bumperR', pair=True, x=[S(1715, 0)[0], S(1746, 0)[0]], rear=re((374, 650), (388, 650), (388, 728), (374, 728)), side=side((1716, 600), (1740, 600), (1740, 690), (1716, 690)), lift=1)
part('ironF', 'bumperF', 'black', 'flat', slot='bumperF', pair=True, side=side((52, 612), (95, 622), (95, 652), (52, 662)), top=top((20, 94), (20, 108), (130, 108), (130, 94)), lift=1)
part('ironR', 'bumperR', 'black', 'flat', slot='bumperR', pair=True, y=[380, 420], side=side((1650, 628), (1690, 618), (1690, 668), (1655, 668)))
# tail lamps on both rear wings (rear view): a nickel rim and a red glass; from the side a small lamp at the wing's back
part('tailRim', 'tail', 'chrome', 'fender', on='fenderR', slot='tail', pair=True, smooth=('rear', 'side'), rear=bell(328, 541, 31), side=sell(1589, 487, 6, 17))
part('tail', 'tail', 'lensR', 'flat', on='tailRim', slot='tail', pair=True, smooth=('rear',), x=[S(1634, 0)[0], S(1638, 0)[0]], rear=bell(328, 541, 21))
# the spare on the back: edge on from the side and above (the road tyres' own section), a wire wheel from behind
def tyre_section(u0, u1, v0, v1, across_first=True):
    lo_u, hi_u = 581, 807; hi_v = 762
    return [[round(u0 + (q[0] - lo_u) / (hi_u - lo_u) * (u1 - u0)), round(v0 + q[1] / hi_v * (v1 - v0))] if across_first else
            [round(v0 + q[1] / hi_v * (v1 - v0)), round(u0 + (q[0] - lo_u) / (hi_u - lo_u) * (u1 - u0))] for q in tyre0]
part('spareCarrier', 'spare', 'black', 'flat', color=BLK, side=side((1612, 430), (1636, 420), (1636, 600), (1600, 610), (1588, 500)), top=halfT((1588, 0), (1588, 40), (1610, 40), (1610, 0)))
part('spare', 'spare', 'rubber', 'fender', wheel={'r': 440},
     side=tyre_section(S(1632, 0)[0], S(1737, 0)[0], S(0, 692)[1], S(0, 325)[1]), rear=bell(0, 520, 200),
     top=tyre_section(T(1605, 0)[0], T(1692, 0)[0], -T(0, 160)[1], T(0, 160)[1]), smooth=('side', 'top'), detail={'kind': 'treadFace', 'pitch': 40})

# ---------------- the chassis under the body: the draft's chassis-layer parts moved onto this car's wheels ----------------
D = json.load(open(DRAFT)); dw = D['wheels']; kx = (RX - FX) / (dw[1]['x'] - dw[0]['x']); ky = W / D['width']; kz = H / D['height']
mx = lambda v: round(FX + (v - dw[0]['x']) * kx); my = lambda v: round(v * ky); mz = lambda v: round(v * kz)
for p in D['parts']:
    if p.get('layer') != 'chassis': continue
    q = json.loads(json.dumps(p)); b = q['box']; q['box'] = {'x': [mx(b['x'][0]), mx(b['x'][1])], 'y': [my(b['y'][0]), my(b['y'][1])], 'z': [mz(b['z'][0]), mz(b['z'][1])]}
    for v, sb in q.get('sheet', {}).items():
        fa, fb = {'side': (mx, mz), 'front': (my, mz), 'rear': (my, mz), 'top': (mx, my)}[v]; q['sheet'][v] = [fa(sb[0]), fa(sb[1]), fb(sb[2]), fb(sb[3])]
    P.append(q)

M = {'id': 'willys27', 'name': '1927 sleeve-valve sedan', 'year': 1927, 'length': L, 'width': W, 'height': H,
     'paint': '#55573c', 'paint2': '#2b2c30', 'canvas': '#333235', 'chrome': '#9f9683', 'glassTint': '#a6a3ad',
     'wheels': [{'x': FX, 'r': R, 'y': 760}, {'x': RX, 'r': R, 'y': 760}],
     'wheel': {'rim': 0.63, 'style': 'wire', 'spokes': 40, 'rimMaterial': 'paint', 'cap': 0.2, 'capRings': 2},   # wire wheels painted the body's olive, a nickel hub cap
     'parts': P}
json.dump(M, open(OUT, 'w'), indent=0)
print(OUT, len(P), 'parts;', sum(len(p['outlines']) for p in P), 'outlines')
print('outlines pulled onto the drawing, mean move in mm:', SNAP)
print('where a view of the sheet differs from the common box by more than 50 mm (each view keeps its own):'); print('\n'.join('  ' + n for n in notes))
