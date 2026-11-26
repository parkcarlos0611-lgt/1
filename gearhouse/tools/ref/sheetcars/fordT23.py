"""The 1923 small sedan (sheet 358adfbc, the left-hand car: a tall four-door body on a light chassis, wood artillery
wheels, no bumpers, no spare) as one 3D part model, made by hand in the way of tools/ref/sedan29_model.py: every part
is a box in the car's space (x from the front wing tips back, y from the centre line outwards, z up; mm) and its
outline as the sheet shows it from the side, the front or rear, and above. Outlines are read off the sheet's views in
pixel positions on a 4x enlargement of each view (S side, F front, B rear, T plan). The body-layer parts are written
from scratch; the chassis-layer parts (engine, gearbox, exhaust ... under the body) are taken from the converter's
draft and moved onto this car's wheels.

  python3 fordT23.py <views dir> <out json> [draft json] [repository root]"""
import sys, os, json, math
HERE = os.path.dirname(os.path.abspath(__file__))
VIEWS, OUT = sys.argv[1], sys.argv[2]
DRAFT = sys.argv[3] if len(sys.argv) > 3 else f'{HERE}/draft/fordT23_auto.json'
REPO = sys.argv[4] if len(sys.argv) > 4 else '/home/user/1/gearhouse'
sys.path.insert(0, f'{REPO}/tools/ref')
import cv2, numpy as np
from zkit import View, fit_closed
from shapely.geometry import Polygon, box as sbox
from shapely.affinity import scale as sscale
from shapely.ops import unary_union

# ---- scale: the wheel centres are at 180 and 1250 on the 4x side view (1070 apart), the wheelbase is 2540 mm ----
K = 2540 / 1070                                           # mm per unit of the 4x side view (9.50 mm a pixel)
L, H = round(1464 * K), round(904 * K); W = round(776 * H / 888)   # review 72: the front view keeps the sheet's proportions (was 1740)           # side view 366x226 px; width from the plan view (180/360 of the length)
C = W / 2
FX, RX, R = round(180 * K), round(1250 * K), round(178 * K)
S = lambda px, py: [round(px * L / 1464), round(H - py * H / 904)]            # side view (366x226 px)
F = lambda dx, py: [round(dx * H / 888), round(H - py * H / 888)]             # front view (194x222 px): distance from the centre line (388), row
B = lambda dx, py: [round(dx * H / 868), round(H - py * H / 868)]             # rear view (194x217 px)
T = lambda px, dy: [round(px * L / 1440), round(dy * W / 720)]                # plan view (360x180 px): along, distance from the centre line (360)
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
    """a rounded rectangle given by two corners on the side view"""
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

BLK = '#1b1b1c'                                           # the sheet's black: neutral, not the blue-black of the stock 'black'
PNT = '#1d1d1e'                                           # the car is black all over; the wings carry it as their own colour
WOOD = '#6a5637'                                          # the window surrounds' wood
YB = 655                                                  # the body's half width at the belt (front view)

# ---------------- running gear seen from outside ----------------
# the dark under each wing, drawn inside the wing's sweep and inside the tyre, so daylight shows where the sheet shows it
part('house0', 'house', 'black', 'flat', color=BLK, y=[0, 560],
     side=side((105, 512), (150, 487), (210, 480), (270, 487), (320, 507), (360, 537), (395, 577), (425, 617), (460, 657), (500, 692), (545, 714), (560, 716), (560, 728), (430, 732), (330, 715), (60, 715), (60, 620), (105, 560)))
part('house1', 'house', 'black', 'flat', color=BLK, y=[0, 560],
     side=side((1050, 722), (1054, 640), (1070, 587), (1097, 542), (1137, 507), (1184, 486), (1240, 476), (1300, 482), (1350, 501), (1385, 527), (1385, 560), (1372, 600), (1380, 722)))
part('frame', 'frame', 'black', 'flat', pair=True, color=BLK, side=side((150, 606), (1380, 606), (1380, 646), (150, 646)), front=[F(*q) for q in ((118, 606), (140, 606), (140, 640), (118, 640))], rear='front', top=top((150, 118), (150, 140), (1380, 140), (1380, 118)))
# from in front: a light forged axle with its king pins, a transverse leaf spring over it, the pan under the radiator, the starting handle
part('axleF', 'axle', 'black', 'flat', color=BLK, x=[FX - 40, FX + 40], front=fhalf((0, 688), (212, 686), (220, 644), (258, 638), (264, 700), (252, 750), (226, 747), (216, 720), (0, 720)))
part('springF', 'spring', 'iron', 'flat', x=[FX - 30, FX + 30], front=fhalf((0, 642), (60, 648), (130, 664), (212, 690), (212, 678), (130, 650), (60, 634), (0, 628)))
part('crank', 'engine', 'iron', 'flat', x=[S(120, 0)[0], S(140, 0)[0]], front=fhalf((0, 618), (6, 620), (6, 700), (10, 704), (10, 722), (0, 724)))
part('axleR', 'axle', 'black', 'flat', color=BLK, x=[RX - 45, RX + 45], rear=bhalf((0, 640), (30, 645), (48, 664), (214, 664), (222, 640), (264, 640), (264, 745), (240, 750), (222, 735), (214, 706), (48, 706), (40, 728), (18, 745), (0, 748)))
part('springR', 'spring', 'iron', 'flat', x=[RX + 50, RX + 100], rear=bhalf((0, 634), (30, 634), (180, 640), (258, 664), (258, 674), (180, 652), (30, 646), (0, 646)))
tyre0 = [[606, 6], [640, 0], [748, 0], [782, 6], [798, 40], [805, 200], [807, 381], [804, 560], [796, 690], [782, 734], [760, 754], [725, 762], [663, 762], [628, 754], [606, 734], [592, 690], [584, 560], [581, 381], [583, 200], [590, 40]]   # a tyre section face on: flat where it stands, round at the top
def tyre(y0, y1): return [[round(y0 + (q[0] - 581) / 226 * (y1 - y0)), round(q[1] / 762 * 2 * R)] for q in tyre0]
TF = (F(264, 0)[0], F(361, 0)[0]); TR = (B(264, 0)[0], B(356, 0)[0])            # the tyres' inner and outer faces on the front and rear views
part('tyreF', 'wheel', 'rubber', 'fender', x=[FX - R, FX + R], pair=True, front=tyre(*TF), top=[[FX - R, TF[0]], [FX + R, TF[0]], [FX + R, TF[1]], [FX - R, TF[1]]], smooth=('front',), detail={'kind': 'treadFace', 'pitch': 34})
part('tyreR', 'wheel', 'rubber', 'fender', x=[RX - R, RX + R], pair=True, rear=tyre(*TR), top=[[RX - R, TR[0]], [RX + R, TR[0]], [RX + R, TR[1]], [RX - R, TR[1]]], smooth=('rear',), detail={'kind': 'treadFace', 'pitch': 34})
# the hub caps stand out past the tyres, bright, in the front and rear views
part('hubF', 'wheel', 'chrome', 'flat', pair=True, x=[FX - 30, FX + 30], front=ell(F(364, 0)[0], F(0, 690)[1], 22, 36, 12), smooth=('front',))
part('hubR', 'wheel', 'chrome', 'flat', pair=True, x=[RX - 30, RX + 30], rear=ell(B(362, 0)[0], B(0, 690)[1], 22, 36, 12), smooth=('rear',))

# ---------------- body ----------------
# the dark between the wings ahead of the cowl (plan) and the pan under the radiator (front)
part('splash', 'apron', 'black', 'flat', color=BLK, z=[S(0, 660)[1], S(0, 560)[1]], top=halfT((108, 0), (108, 215), (150, 232), (458, 240), (458, 0)), front=fhalf((0, 608), (120, 608), (120, 626), (102, 648), (60, 660), (0, 664)))
# the valance between the body's bottom edge and the running board, running forward under the hood behind the front wheel
part('apron', 'apron', 'black', 'flat', color=BLK, y=[-600, 600],
     side=side((212, 578), (483, 578), (548, 600), (1068, 600), (1062, 690), (560, 690), (560, 716), (500, 700), (430, 640), (390, 586), (212, 586)),
     top=halfT((412, 0), (412, 262), (1040, 262), (1040, 0)),
     feats={'side': [{'kind': 'highlight', 'pts': side((470, 626), (700, 624), (1040, 626)), 'width': 2}]})
# the valance's rolled top edge, which catches the light along the car
part('sill', 'apron', 'paint', 'flat', color='#3c3c3f', on='apron', y=[598, 600], side=side((474, 616), (1046, 616), (1046, 636), (474, 636)), lift=1)
# radiator: a low nickel shell, arched on top, square below; a plain header tank over the core (the sheet's lettering is left out)
part('shell', 'radiator', 'chrome', 'flat', slot='grille',
     side=side((163, 480), (163, 352), (167, 340), (178, 334), (204, 333), (212, 338), (212, 480)),
     front=fhalf((0, 338), (40, 342), (75, 353), (100, 370), (116, 392), (124, 415), (126, 440), (126, 590), (120, 606), (108, 616), (0, 618)), smooth=('front',),
     top=halfT((148, 0), (148, 85), (182, 85), (182, 0)))
part('core', 'radiator', 'black', 'flat', on='shell', slot='grille', x=[S(163, 0)[0] + 2, S(170, 0)[0]], front=fhalf((0, 388), (104, 388), (112, 398), (112, 590), (104, 602), (0, 604)), detail={'kind': 'cells', 'pitch': 24})
part('badge', 'radiator', 'chrome', 'flat', on='shell', slot='grille', x=[S(161, 0)[0], S(163, 0)[0]], front=fhalf((0, 360), (20, 360), (26, 368), (20, 376), (0, 376)), smooth=('front',), lift=1)
# the cap: a stem and a cross-shaped handle
part('cap', 'radiator', 'chrome', 'flat', slot='grille', smooth=('front',),
     side=side((182, 336), (186, 318), (180, 310), (170, 306), (167, 297), (175, 290), (186, 292), (189, 281), (196, 277), (203, 282), (205, 292), (215, 292), (221, 298), (217, 307), (206, 310), (200, 318), (204, 336)),
     front=fhalf((0, 290), (10, 293), (13, 301), (11, 310), (6, 316), (8, 326), (16, 331), (18, 340), (0, 342)),
     top=[[T(165, 0)[0] + round(math.cos(k / 12 * 6.2832) * 38), round(math.sin(k / 12 * 6.2832) * 38)] for k in range(12)])
part('hood', 'hood', 'paint', 'side', fit=2, nofit=('front', 'top'),
     side=side((212, 337), (350, 333), (483, 331), (483, 580), (212, 580)),
     front=fhalf((0, 333), (45, 337), (82, 349), (108, 367), (124, 391), (132, 416), (134, 600), (0, 600)), smooth=('front',),
     top=halfT((185, 0), (185, 80), (392, 163), (392, 0)),
     feats={'side': [{'kind': 'louvres', 'x0': S(328, 0)[0], 'x1': S(458, 0)[0], 'z0': S(0, 554)[1], 'z1': S(0, 436)[1], 'n': 6, 'slant': 0},
                     {'kind': 'seam', 'pts': side((214, 410), (481, 410))}, {'kind': 'seam', 'pts': side((218, 420), (478, 420), (478, 574), (300, 574))},
                     {'kind': 'highlight', 'pts': side((218, 352), (350, 350), (476, 348)), 'width': 2}, {'kind': 'highlight', 'pts': side((220, 394), (476, 392)), 'width': 1}],
            'top': [{'kind': 'seam', 'pts': top((188, 0), (390, 0))}, {'kind': 'highlight', 'pts': top((192, -72), (386, -150)), 'width': 2}, {'kind': 'highlight', 'pts': top((192, 72), (386, 150)), 'width': 1},
                    {'kind': 'seam', 'pts': top((188, 62), (390, 128))}, {'kind': 'seam', 'pts': top((188, -62), (390, -128))}]})
part('cowl', 'cowl', 'paint', 'side', fit=2, nofit=('front', 'top'),
     side=side((483, 331), (515, 329), (535, 324), (548, 316), (548, 600), (483, 580)),
     front=fhalf((0, 292), (292, 292), (294, 440), (290, 600), (0, 600)),
     top=halfT((392, 0), (392, 163), (458, 192), (458, 0)),
     feats={'side': [{'kind': 'highlight', 'pts': side((487, 348), (520, 346), (544, 336)), 'width': 2}, {'kind': 'highlight', 'pts': side((487, 392), (515, 388), (540, 372)), 'width': 1}],
            'top': [{'kind': 'highlight', 'pts': top((396, -152), (454, -178)), 'width': 2}]})
# the body: a tall, square closed body, black to the roof rail; four doors (the front one each side opens at the front pillar)
part('body', 'body', 'paint', 'side', fit=2, nofit=('top', 'front', 'rear'),
     side=side((548, 600), (548, 50), (1420, 50), (1420, 110), (1413, 300), (1403, 400), (1392, 455), (1386, 500), (1380, 528), (1350, 505), (1300, 488), (1240, 482), (1185, 492), (1140, 512), (1100, 545), (1075, 590), (1068, 600)),
     front=fhalf((0, 50), (292, 50), (293, 300), (294, 440), (290, 600), (0, 600)),
     rear=bhalf((0, 58), (298, 58), (300, 330), (296, 352), (290, 430), (264, 520), (246, 572), (240, 606), (0, 608)),
     top=halfT((458, 0), (458, 192), (500, 268), (540, 283), (1330, 283), (1380, 266), (1408, 218), (1416, 0)),
     feats={'side': [{'kind': 'seam', 'pts': side((580, 54), (580, 598))}, {'kind': 'seam', 'pts': side((850, 54), (850, 598))}, {'kind': 'seam', 'pts': side((1105, 54), (1105, 540))},
                     {'kind': 'seam', 'pts': side((1340, 54), (1340, 332))},
                     {'kind': 'bead', 'pts': side((550, 332), (1000, 333), (1410, 332))}, {'kind': 'highlight', 'pts': side((584, 328), (1338, 328)), 'width': 1},
                     {'kind': 'crease', 'pts': side((586, 574), (846, 574))}, {'kind': 'crease', 'pts': side((856, 574), (1060, 574))},
                     {'kind': 'highlight', 'pts': side((1414, 120), (1406, 300), (1396, 400), (1388, 452)), 'width': 1},
                     {'kind': 'hinge', 'at': S(578, 106)}, {'kind': 'hinge', 'at': S(578, 370)}, {'kind': 'hinge', 'at': S(578, 506)}, {'kind': 'hinge', 'at': S(1102, 366)}, {'kind': 'hinge', 'at': S(1102, 492)}],
            'front': [{'kind': 'seam', 'pts': [F(232, 62), F(232, 290)]}, {'kind': 'seam', 'pts': [F(268, 62), F(268, 290)]}, {'kind': 'seam', 'pts': [F(-232, 62), F(-232, 290)]}, {'kind': 'seam', 'pts': [F(-268, 62), F(-268, 290)]},
                      {'kind': 'bead', 'pts': [F(-292, 300), F(-206, 296), F(206, 296), F(292, 300)]}],
            'rear': [{'kind': 'seam', 'pts': [B(185, 62), B(185, 600)]}, {'kind': 'seam', 'pts': [B(-185, 62), B(-185, 600)]},
                     {'kind': 'bead', 'pts': [B(-297, 332), B(-188, 304), B(0, 296), B(188, 304), B(297, 332)]}, {'kind': 'highlight', 'pts': [B(-290, 322), B(-188, 296), B(0, 288), B(188, 296), B(290, 322)], 'width': 1},
                     {'kind': 'crease', 'pts': [B(-232, 573), B(232, 573)]}]})
# the roof: a flat cloth-covered top with a rail round it, a little wider and longer than the body
ROOFC = '#2b2b2e'
part('roof', 'roof', 'canvas', 'roof', color=ROOFC, fit=2, nofit=('front', 'rear', 'top'),
     side=side((525, 50), (527, 36), (540, 27), (562, 21), (700, 13), (900, 8), (1100, 5), (1300, 4), (1390, 6), (1415, 14), (1429, 30), (1432, 50), (1420, 54), (548, 54)),
     front=fhalf((0, 0), (150, 0), (240, 4), (276, 12), (294, 28), (301, 44), (298, 53), (0, 53)),
     rear=bhalf((0, 0), (200, 0), (268, 5), (296, 18), (308, 42), (306, 58), (0, 60)),
     top=halfT((520, 0), (520, 236), (534, 258), (560, 267), (1320, 267), (1350, 256), (1368, 232), (1375, 190), (1375, 0)),
     feats={'side': [{'kind': 'highlight', 'pts': side((534, 36), (900, 28), (1300, 26), (1422, 34)), 'width': 2}, {'kind': 'seam', 'pts': side((540, 44), (1426, 44))}],
            'top': [{'kind': 'seam', 'pts': top((540, 0), (540, 226), (560, 247), (1310, 247), (1336, 230), (1346, 200), (1346, 0))},
                    {'kind': 'seam', 'pts': top((540, 0), (540, -226), (560, -247), (1310, -247), (1336, -230), (1346, -200), (1346, 0))}]})
# the visor over the windscreen: a board hinged at the roof's front edge, sloping forward and down
part('visor', 'roof', 'canvas', 'roof', color=ROOFC,
     side=side((526, 52), (548, 56), (548, 74), (486, 124), (470, 123), (460, 113), (466, 102), (518, 60)),
     front=fhalf((0, 53), (224, 53), (228, 62), (226, 100), (0, 100)),
     top=halfT((455, 0), (455, 205), (468, 228), (490, 237), (522, 237), (522, 0)),
     feats={'side': [{'kind': 'highlight', 'pts': side((474, 110), (532, 62)), 'width': 1}]})
# the windscreen: a black frame, a wood surround, glass in four panes (a transom bar and a centre post)
part('screenFrame', 'screen', 'black', 'flat', on='body', color=BLK, x=[S(548, 0)[0], S(560, 0)[0]], front=fhalf((0, 100), (206, 100), (206, 292), (0, 292)))
part('screenWood', 'screen', 'wood', 'flat', on='screenFrame', color='#4a4130', x=[S(549, 0)[0], S(560, 0)[0]], front=fhalf((0, 106), (194, 106), (194, 285), (0, 285)), lift=1)
part('screen', 'screen', 'glass', 'side', on='screenFrame', x=[S(550, 0)[0], S(558, 0)[0]], front=fhalf((0, 113), (163, 113), (163, 262), (0, 262)), lift=2)
part('screenBar', 'screen', 'wood', 'flat', on='screenFrame', color='#3a3327', x=[S(548, 0)[0], S(558, 0)[0]], front=fhalf((0, 197), (163, 197), (163, 211), (0, 211)), lift=3)
part('screenPost', 'screen', 'wood', 'flat', on='screenFrame', color='#3a3327', x=[S(548, 0)[0], S(558, 0)[0]], front=fhalf((0, 113), (7, 113), (7, 262), (0, 262)), lift=3)
# the steering wheel as the sheet shows it through the glass: its rim's upper arc and hub from in front, the rim edge on and the column from the side
wc, wz = F(92, 0)[0], F(0, 268)[1]
arc = lambda r, rz, a0, a1, n=14: [[round(wc + math.cos(math.radians(a0 + (a1 - a0) * k / n)) * r), round(wz + math.sin(math.radians(a0 + (a1 - a0) * k / n)) * rz)] for k in range(n + 1)]
part('wheelSeen', 'steering', 'black', 'flat', on='screenFrame', color='#201d18', x=[S(640, 0)[0], S(730, 0)[0]], y=[wc - 170, wc + 170], lift=4,
     front=arc(170, 132, -8, 188) + list(reversed(arc(150, 114, -8, 188))),
     side=side((640, 214), (650, 206), (730, 296), (712, 300), (690, 300), (660, 262), (640, 300), (615, 300), (652, 248)))
part('wheelHub', 'steering', 'black', 'flat', on='screenFrame', color='#201d18', x=[S(660, 0)[0], S(700, 0)[0]], lift=4,
     front=[[wc - 150, wz - 14], [wc - 20, wz + 4], [wc, wz + 100], [wc + 20, wz + 4], [wc + 150, wz - 14], [wc + 150, wz - 34], [wc + 30, wz - 40], [wc - 30, wz - 40], [wc - 150, wz - 34]])
# side windows: three a side; a raised reveal in the body colour, a wood surround, the glass
WIN = ((600, 68, 826, 318, 620, 88, 804, 297), (868, 68, 1084, 318), (1120, 68, 1328, 318))
GLS = ((620, 88, 804, 297), (885, 88, 1058, 295), (1132, 88, 1298, 293))
for k in range(3):
    a, b, c, d = WIN[k][:4]; ga, gb, gc, gd = GLS[k]
    part(f'wframe{k}', 'body', 'paint', 'side', on='body', y=[YB, YB + 2], pair=True, side=srect(a, b, c, d, 34))
    part(f'wwood{k}', 'body', 'wood', 'flat', on=f'wframe{k}', color=WOOD if k else '#4a4130', y=[YB + 2, YB + 3], pair=True, side=srect(ga - 12, gb - 10, gc + 14, gd + 10, 22), lift=1)
    part(f'glass{k}', 'body', 'glass', 'side', on=f'wframe{k}', y=[YB + 3, YB + 4], pair=True, side=srect(ga, gb, gc, gd, 12), lift=2)
# door handles: bright bars either side of the centre pillar (side), a knob from in front, a dot in the plan
part('handle0', 'body', 'chrome', 'flat', on='body', pair=True, lift=3, smooth=('front',),
     side=side((778, 363), (822, 362), (824, 354), (840, 354), (842, 386), (824, 386), (822, 378), (778, 377)),
     front=[F(*q) for q in ((286, 318), (300, 316), (306, 324), (300, 333), (286, 332))], top=top((838, 300), (852, 300), (852, 324), (838, 324)))
part('handle1', 'body', 'chrome', 'flat', on='body', pair=True, lift=3, y=[YB, YB + 50],
     side=side((864, 354), (880, 354), (882, 362), (922, 363), (922, 377), (882, 378), (880, 386), (864, 386)))
# the back window: one opening, a centre bar, the seat back showing through its lower part
part('rearFrame', 'body', 'paint', 'side', on='body', x=[S(1414, 0)[0], S(1420, 0)[0]], rear=rrect(B(-152, 0)[0], B(0, 264)[1], B(152, 0)[0], B(0, 92)[1], 30))
part('rearGlass', 'body', 'glass', 'side', on='rearFrame', x=[S(1412, 0)[0], S(1418, 0)[0]], rear=rrect(B(-143, 0)[0], B(0, 251)[1], B(143, 0)[0], B(0, 104)[1], 14), lift=1)
part('seatBack', 'body', 'canvas', 'flat', on='rearFrame', color='#4d4639', x=[S(1300, 0)[0], S(1330, 0)[0]], rear=bhalf((0, 204), (50, 205), (100, 212), (134, 222), (141, 232), (141, 249), (0, 249)), lift=2)
part('rearBar', 'body', 'wood', 'flat', on='rearFrame', color='#3a3327', x=[S(1412, 0)[0], S(1420, 0)[0]], rear=bhalf((0, 104), (4, 104), (4, 204), (0, 204)), lift=3)
part('rearApron', 'body', 'black', 'flat', color=BLK, x=[S(1300, 0)[0], S(1380, 0)[0]], rear=bhalf((0, 602), (246, 602), (250, 656), (196, 656), (182, 634), (30, 634), (18, 650), (0, 650)))

# ---------------- wings, boards ----------------
part('fenderF', 'fenderF', 'paint2', 'fender', color=PNT, fit=2, nofit=('top', 'front'), slot='fenderF', pair=True, cutWheel={'i': 0, 'r': R + 10}, smooth=('front', 'side'),
     side=side((0, 524), (8, 508), (30, 494), (60, 479), (120, 463), (180, 456), (240, 459), (300, 473), (340, 496), (380, 531), (410, 571), (440, 611), (470, 646), (510, 680), (545, 700), (592, 708),
               (592, 728), (545, 726), (500, 708), (460, 675), (425, 635), (395, 592), (362, 552), (322, 522), (272, 502), (212, 494), (150, 497), (100, 512), (60, 537), (25, 551), (5, 547)),
     front=[F(*q) for q in ((388, 478), (386, 446), (374, 431), (350, 424), (312, 421), (290, 426), (280, 442), (280, 510), (290, 524), (310, 529), (350, 529), (378, 521), (387, 502))],
     top=top((8, 250), (0, 275), (0, 332), (12, 350), (40, 357), (380, 357), (400, 349), (412, 337), (412, 242), (300, 216), (200, 226), (120, 233), (40, 239)),
     feats={'side': [{'kind': 'highlight', 'pts': side((22, 506), (62, 487), (120, 471), (180, 464), (240, 467), (298, 481), (336, 503), (374, 538), (404, 578), (434, 618), (466, 654), (506, 688), (540, 704)), 'width': 2}],
            'front': [{'kind': 'highlight', 'pts': [F(*q) for q in ((378, 440), (350, 432), (312, 430), (292, 436))], 'width': 2}, {'kind': 'highlight', 'pts': [F(*q) for q in ((376, 505), (350, 512), (312, 512), (296, 505))], 'width': 1}],
            'top': [{'kind': 'highlight', 'pts': top((30, 344), (200, 347), (375, 345)), 'width': 2}, {'kind': 'highlight', 'pts': top((30, 252), (110, 246)), 'width': 1}]})
# the front wing's inner skirt, sweeping from the crown in and down to the frame beside the radiator (front view)
part('sweepF', 'fenderF', 'paint2', 'fender', color=PNT, slot='fenderF', pair=True, x=[S(225, 0)[0], S(540, 0)[0]],
     front=[F(*q) for q in ((284, 440), (270, 446), (200, 522), (140, 587), (120, 606), (120, 628), (225, 632), (266, 640), (266, 528), (284, 512))],
     feats={'front': [{'kind': 'highlight', 'pts': [F(*q) for q in ((278, 450), (205, 528), (128, 606))], 'width': 1}]})
part('fenderR', 'fenderR', 'paint2', 'fender', color=PNT, fit=2, nofit=('top', 'rear'), slot='fenderR', pair=True, cutWheel={'i': 1, 'r': R + 10}, smooth=('rear', 'side'),
     side=side((1034, 748), (1036, 700), (1045, 640), (1060, 582), (1090, 532), (1130, 497), (1180, 473), (1240, 463), (1300, 468), (1350, 488), (1400, 525), (1435, 570), (1455, 608), (1462, 628), (1452, 635),
               (1440, 626), (1425, 588), (1395, 550), (1350, 512), (1300, 493), (1240, 487), (1185, 496), (1140, 517), (1102, 550), (1078, 592), (1064, 640), (1060, 700), (1058, 750)),
     rear=[B(*q) for q in ((253, 602), (253, 452), (262, 438), (285, 431), (360, 431), (380, 439), (388, 456), (388, 580), (380, 598), (360, 604), (275, 605))],
     top=top((1040, 284), (1040, 340), (1052, 356), (1080, 358), (1410, 358), (1432, 350), (1440, 330), (1440, 282), (1428, 264), (1380, 262), (1330, 283)),
     feats={'side': [{'kind': 'highlight', 'pts': side((1050, 640), (1066, 584), (1094, 538), (1134, 504), (1182, 481), (1240, 471), (1298, 476), (1346, 495), (1394, 531), (1428, 575), (1448, 612)), 'width': 2}],
            'rear': [{'kind': 'highlight', 'pts': [B(*q) for q in ((262, 448), (290, 440), (360, 440), (378, 448))], 'width': 2}, {'kind': 'highlight', 'pts': [B(*q) for q in ((270, 592), (360, 594), (378, 586))], 'width': 1}],
            'top': [{'kind': 'highlight', 'pts': top((1060, 346), (1250, 349), (1420, 344)), 'width': 2}]})
# the running board: a pressed steel board, its edge bright along the bottom, a ribbed tread let into its top
part('board', 'board', 'black', 'flat', color='#4c4c50', slot='board', pair=True, side=side((590, 686), (1040, 686), (1040, 727), (590, 727)), top=top((412, 262), (412, 337), (1040, 337), (1040, 262)))
part('boardTrim', 'board', 'iron', 'flat', on='board', slot='board', pair=True, y=[T(0, 333)[1], T(0, 337)[1]], side=side((592, 706), (1038, 706), (1038, 727), (592, 727)), lift=1)   # the board's bright pressed edge
part('step0', 'board', 'iron', 'flat', on='board', slot='board', pair=True, x=[T(440, 0)[0], T(1030, 0)[0]], z=[S(0, 690)[1], S(0, 686)[1]], top=top((440, 280), (440, 328), (1030, 328), (1030, 280)), detail={'kind': 'ribs', 'pitch': 22}, lift=1)

# ---------------- lamps ----------------
# drum headlamps beside the radiator, low between the wings (from the side they are hidden by the wing): a black bowl, a nickel rim, a pale lens
LZ = F(0, 498)[1]; LY = F(172, 0)[0]
part('lamp', 'lamp', 'black', 'fender', slot='lamp', pair=True, smooth=('side', 'top'), color='#26272a',
     side=[[S(160, 0)[0], LZ - 112], [S(180, 0)[0], LZ - 100], [S(196, 0)[0], LZ - 70], [S(204, 0)[0], LZ], [S(196, 0)[0], LZ + 70], [S(180, 0)[0], LZ + 100], [S(160, 0)[0], LZ + 112]],
     top=top((135, 92), (160, 96), (180, 115), (188, 142), (180, 170), (160, 190), (135, 194)))
part('lampRim', 'lamp', 'chrome', 'fender', slot='lamp', pair=True, smooth=('front',),
     side=[[S(150, 0)[0], LZ - 118], [S(160, 0)[0], LZ - 118], [S(160, 0)[0], LZ + 118], [S(150, 0)[0], LZ + 118]],
     front=ell(LY, LZ, F(50, 0)[0], round(50 * H / 888)), top=top((118, 94), (122, 89), (136, 89), (136, 197), (122, 197), (118, 192)))
part('lens', 'lamp', 'chrome', 'flat', on='lampRim', slot='lamp', pair=True, x=[S(149, 0)[0], S(152, 0)[0]], smooth=('front',), front=ell(LY, LZ, F(42, 0)[0], round(42 * H / 888)), detail={'kind': 'bowl'})
# the bright post standing in front of the shell's foot (side view): the lamp's stand
part('lampStand', 'lamp', 'chrome', 'flat', slot='lamp', pair=True, y=[LY - 20, LY + 20], side=side((157, 470), (157, 404), (162, 396), (168, 400), (169, 470)))
# one tail lamp, on the left of the back panel: a nickel rim and a red glass
part('tailRim', 'tail', 'chrome', 'fender', on='body', slot='tail', smooth=('rear',), x=[S(1396, 0)[0], S(1406, 0)[0]], rear=ell(B(143, 0)[0], B(0, 572)[1], B(30, 0)[0], round(30 * H / 868)), lift=1)
part('tail', 'tail', 'lensR', 'flat', on='tailRim', slot='tail', smooth=('rear',), x=[S(1398, 0)[0], S(1408, 0)[0]], rear=ell(B(143, 0)[0], B(0, 572)[1], B(21, 0)[0], round(21 * H / 868)), lift=2)

# ---------------- the chassis under the body: the draft's chassis-layer parts moved onto this car's wheels ----------------
D = json.load(open(DRAFT)); dw = D['wheels']; kx = (RX - FX) / (dw[1]['x'] - dw[0]['x']); ky = W / D['width']; kz = H / D['height']
mx = lambda v: round(FX + (v - dw[0]['x']) * kx); my = lambda v: round(v * ky); mz = lambda v: round(v * kz)
for p in D['parts']:
    if p.get('layer') != 'chassis': continue
    q = json.loads(json.dumps(p)); b = q['box']; q['box'] = {'x': [mx(b['x'][0]), mx(b['x'][1])], 'y': [my(b['y'][0]), my(b['y'][1])], 'z': [mz(b['z'][0]), mz(b['z'][1])]}
    for v, sb in q.get('sheet', {}).items():
        fa, fb = {'side': (mx, mz), 'front': (my, mz), 'rear': (my, mz), 'top': (mx, my)}[v]; q['sheet'][v] = [fa(sb[0]), fa(sb[1]), fb(sb[2]), fb(sb[3])]
    P.append(q)

M = {'id': 'fordT23', 'name': '1923 small sedan', 'year': 1923, 'length': L, 'width': W, 'height': H,
     'paint': PNT, 'paint2': '#8a6944', 'canvas': ROOFC, 'chrome': '#8f8873', 'glassTint': '#acacac',   # paint2 is the wheels' wood (the game's artillery wheel takes its spokes from a paint); the wings carry black as their own colour
     'wheels': [{'x': FX, 'r': R, 'y': 700}, {'x': RX, 'r': R, 'y': 700}],
     'wheel': {'rim': 0.72, 'style': 'artillery', 'spokes': 12, 'rimMaterial': 'paint2', 'cap': 0.2, 'capRings': 1},   # wooden-spoke wheels, twelve spokes, natural wood, a small bright hub cap
     'parts': P}
json.dump(M, open(OUT, 'w'), indent=0)
print(OUT, len(P), 'parts;', sum(len(p['outlines']) for p in P), 'outlines')
print('size', L, W, H, 'wheels', FX, RX, R)
print('outlines pulled onto the drawing, mean move in mm:', SNAP)
print('where a view of the sheet differs from the common box by more than 50 mm (each view keeps its own):'); print('\n'.join('  ' + n for n in notes))
