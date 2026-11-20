"""The 1929 four-door sedan as one 3D part model (decision of 2026-11-20). Every part is defined once: a box in the
car's own space (x from the front bumper back, y from the centre line outwards, z up; millimetres) and its outline as
this car's reference sheet shows it from the side, the front or rear, and above. Outlines are stored in the unit box,
so a part sits at one place in every view; which part hides which follows from where the parts are (model.ts), not
from a hand-written order. Shapes are read off this car's sheet (pixel positions on the 4x views, tools/ref/ptrace.py
for glass, grille core, lamps); none comes from a stock of shapes.

  python3 tools/ref/sedan29_model.py <views dir> data/cars/sedan29.json"""
import sys, os, json, math; sys.path.insert(0, os.path.dirname(__file__))
from ptrace import Sheet
VIEWS, OUT = sys.argv[1], sys.argv[2]
L, W, H, C = 3885, 1700, 1820, 850
FX, RX, R = 508, 3137, 381
S = lambda px, py: [round(px * 2.116), round(H - py * 2.116)]                # side view, pixels of the 4x view
F = lambda dx, py: [round(dx * 2.014), round(H - py * 2.068)]                # front view: distance from the centre line, pixel row
def side(*p): return [S(*q) for q in p]
def half(*p):
    """a full outline from its half (front, rear, top views): points from the centre line outwards and back"""
    r = [list(q) for q in p]; return r + [[-x, z] for x, z in reversed(r) if x != 0]
def fhalf(*p): return half(*[F(*q) for q in p])
def halfT(*p):
    """the same for the plan view, where the second figure is the distance from the centre line"""
    r = [list(q) for q in p]; return r + [[x, -y] for x, y in reversed(r) if y != 0]
def ell(cx, cz, rx, rz, n=20): return [[round(cx + math.cos(k / n * 6.2832) * rx), round(cz + math.sin(k / n * 6.2832) * rz)] for k in range(n)]
def rrect(x0, z0, x1, z1, r, n=4):
    out = []
    for cx, cz, a0 in ((x1 - r, z1 - r, 0), (x0 + r, z1 - r, 90), (x0 + r, z0 + r, 180), (x1 - r, z0 + r, 270)):
        for k in range(n + 1): a = math.radians(a0 + 90 * k / n); out.append([round(cx + math.cos(a) * r), round(cz + math.sin(a) * r)])
    return out
import cv2, numpy as np
from zkit import View, fit_closed
from shapely.geometry import Polygon, box as sbox
from shapely.affinity import scale as sscale
from shapely.ops import unary_union
def _view(name, w, h):
    t = f'{VIEWS}/_fit_{name}.png'; cv2.imwrite(t, cv2.resize(cv2.imread(f'{VIEWS}/v_{name}.png', cv2.IMREAD_UNCHANGED), (round(w / 10), round(h / 10)), interpolation=cv2.INTER_AREA)); V = View(t, w); V.edge = np.maximum(V.sil * 3, V.grad); return V
FIT = {'side': _view('left', L, H), 'front': _view('front', W, H), 'rear': _view('rear', W, H), 'top': _view('top', L, W)}
SNAP = {}
def snap(view, pts, reach):
    """improvement A (review 28): a placed outline is pulled onto the nearest strong line of the drawing; an outline that is
    the same on both sides of the centre line stays so (its left half is fitted and mirrored)"""
    across = view != 'side'; k = 1 if view == 'top' else 0                               # which figure is the distance from the centre line
    lo, hi = min(p[k] for p in pts), max(p[k] for p in pts); centred = across and abs(lo + hi) < 30 and lo < -20
    q = [[p[0] + (C if across and k == 0 else 0), p[1] + (C if across and k == 1 else 0)] for p in pts]
    f, moved = fit_closed(FIT[view], [[x, z, 1] for x, z in q], FIT[view].edge, reach=reach, floor=25)
    f = [[x - (C if across and k == 0 else 0), z - (C if across and k == 1 else 0)] for x, z, _ in f]
    if centred:
        g = Polygon(f).buffer(0); big = 1e5; h = g.intersection(sbox(0, -big, big, big) if k == 0 else sbox(-big, 0, big, big)); m = sscale(h, xfact=-1 if k == 0 else 1, yfact=-1 if k == 1 else 1, origin=(0, 0)); u = unary_union([h, m]).buffer(0)
        if u.geom_type == 'Polygon': f = [[round(x), round(z)] for x, z in list(u.exterior.coords)[:-1]]
    return f, moved
P = []; notes = []
def part(id, element, material, surface='side', *, color=None, on=None, fit=0, nofit=(), x=None, y=None, z=None, pair=False, slot=None, smooth=(), detail=None, feats=None, cutWheel=None, wheel=None, lift=0, **views):
    """views: side=[[x,z]..], front=[[y,z]..], rear=[[y,z]..] or 'front', top=[[x,y]..]; the box comes from the side view
    (x, z) and the front or top view (y) unless given"""
    bb = lambda pts, k: [min(p[k] for p in pts), max(p[k] for p in pts)]
    if fit:
        for v in list(views):
            if views[v] == 'front' or v in nofit: continue
            views[v], mv = snap(v, views[v], fit); SNAP[f'{id}.{v}'] = round(mv)
    if views.get('rear') == 'front': views['rear'] = views['front']
    # each view keeps the sheet's own place and size for the part (review 29); the common box, used for the drawing order,
    # for exchanging parts and for the physics, is the mean of the views that show each axis, and each view's
    # difference from it is kept and reported
    AX = {'side': ('x', 'z'), 'front': ('y', 'z'), 'rear': ('y', 'z'), 'top': ('x', 'y')}; sheet = {}
    for v, pts in views.items(): sheet[v] = bb(pts, 0) + bb(pts, 1)
    given = {'x': x, 'y': y, 'z': z}; box = {}
    for ax in 'xyz':
        if given[ax]: box[ax] = list(given[ax]); continue
        got = [sheet[v][0:2] if AX[v][0] == ax else sheet[v][2:4] for v in sheet if ax in AX[v]]
        if not got: raise SystemExit(f'{id}: no view gives its {ax}')
        box[ax] = [round(sum(g[0] for g in got) / len(got)), round(sum(g[1] for g in got) / len(got))]
    corr = {}
    for v, sb in sheet.items():
        a, b = AX[v]; d = [round((sb[0] + sb[1]) / 2 - (box[a][0] + box[a][1]) / 2), round((sb[2] + sb[3]) / 2 - (box[b][0] + box[b][1]) / 2),
                           round((sb[1] - sb[0]) - (box[a][1] - box[a][0])), round((sb[3] - sb[2]) - (box[b][1] - box[b][0]))]
        if any(d): corr[v] = d
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
    X, Y, Z = box['x'], box['y'], box['z']
    P.append({'id': id, 'element': element, 'material': material, 'surface': surface, 'box': {'x': X, 'y': Y, 'z': Z}, 'sheet': sheet, 'pair': pair, 'outlines': o,
              **({'slot': slot} if slot else {}), **({'detail': detail} if detail else {}), **({'features': f2} if f2 else {}), **({'cutWheel': cutWheel} if cutWheel else {}), **({'wheel': wheel} if wheel else {}), **({'lift': lift} if lift else {}), **({'on': on} if on else {}), **({'color': color} if color else {})})

# ---------------- chassis parts seen from outside ----------------
for i, wx in enumerate((FX, RX)):
    part(f'house{i}', 'frame', 'black', 'flat', y=[0, 560], side=[[wx - 440, 440]] + [[round(wx + math.cos(a) * 440), round(400 + math.sin(a) * 440)] for a in [math.pi * k / 14 for k in range(14, -1, -1)]] + [[wx + 440, 440]])
part('frame', 'frame', 'black', 'flat', y=[-420, 420], side=[[150, 440], [3740, 440], [3740, 560], [150, 560]], front=half([0, 440], [420, 440], [420, 560], [0, 560]), rear='front')
part('axleF', 'axle', 'black', 'flat', x=[470, 546], front=half([0, 330], [640, 330], [640, 400], [560, 400], [520, 365], [0, 365]))
part('springF', 'spring', 'iron', 'flat', x=[480, 536], front=half([0, 520], [120, 510], [400, 450], [560, 400], [560, 430], [400, 480], [120, 545], [0, 555]))
part('axleR', 'axle', 'black', 'flat', x=[3090, 3184], rear=half([0, 250], [120, 260], [170, 330], [640, 345], [640, 415], [170, 430], [120, 500], [0, 510]), smooth=('rear',))
part('springR', 'spring', 'iron', 'flat', x=[3200, 3260], rear=half([0, 560], [120, 550], [420, 480], [580, 420], [580, 450], [420, 512], [120, 585], [0, 595]))
tyre = [[600, 8], [640, 0], [748, 0], [788, 8], [800, 60], [806, 381], [800, 700], [788, 748], [748, 762], [640, 762], [600, 748], [588, 700], [582, 381], [588, 60]]   # read off the front view: 588..806 from the centre line
part('tyreF', 'wheel', 'rubber', 'fender', x=[FX - R, FX + R], pair=True, front=tyre, smooth=('front',), detail={'kind': 'treadFace', 'pitch': 55})
part('tyreR', 'wheel', 'rubber', 'fender', x=[RX - R, RX + R], pair=True, rear=tyre, smooth=('rear',), detail={'kind': 'treadFace', 'pitch': 55})

# ---------------- body ----------------
part('splash', 'apron', 'black', 'flat', x=[560, 1450], z=[300, 880], top=halfT([500, 0], [500, 600], [1450, 620], [1450, 0]),
     front=half([0, 380], [600, 380], [600, 880], [0, 880]))
part('crossF', 'frame', 'black', 'flat', x=[150, 500], z=[380, 470], top=halfT([150, 0], [150, 540], [270, 560], [500, 560], [500, 0]), front=half([0, 380], [560, 380], [560, 470], [0, 470]))
part('spareCarrier', 'spare', 'iron', 'flat', y=[-40, 40], side=side((1694, 425), (1760, 425), (1760, 440), (1694, 440)), top=halfT([3600, 0], [3600, 40], [3760, 40], [3760, 0]))
part('apron', 'apron', 'black', 'flat', y=[-640, 640], side=side((560, 585), (1262, 585), (1262, 702), (560, 702)), top=halfT([1300, 0], [1300, 640], [2700, 640], [2700, 0]))
part('shell', 'radiator', 'chrome', 'flat', slot='grille', fit=3,
     side=side((243, 292), (250, 274), (275, 271), (284, 285), (284, 640), (243, 640)),
     front=fhalf((0, 262), (60, 268), (110, 290), (140, 328), (152, 388), (155, 600), (148, 640), (128, 652), (0, 655)), smooth=('front',),
     top=halfT([390, 0], [390, 330], [500, 330], [500, 0]))
part('lip', 'radiator', 'iron', 'flat', on='shell', slot='grille', x=[505, 522], front=fhalf((0, 290), (78, 292), (116, 312), (128, 356), (128, 618), (116, 640), (0, 645)), smooth=('front',))
part('core', 'radiator', 'black', 'flat', on='lip', slot='grille', x=[505, 520], front=fhalf((0, 300), (70, 302), (106, 320), (118, 360), (118, 612), (108, 630), (0, 634)), smooth=('front',), detail={'kind': 'cells', 'pitch': 30})
part('cap', 'radiator', 'chrome', 'flat', on='shell', slot='grille', side=side((252, 272), (250, 252), (262, 240), (274, 252), (272, 272)), front=fhalf((0, 262), (12, 268), (16, 300), (0, 302)))
part('hood', 'hood', 'paint', 'side', fit=3,
     side=side((284, 284), (628, 268), (630, 585), (284, 585)),
     front=fhalf((0, 262), (120, 270), (200, 290), (240, 325), (250, 400), (250, 600), (0, 600)), smooth=('front',),
     top=halfT([500, 0], [500, 330], [1240, 525], [1240, 0]),
     feats={'side': [{'kind': 'louvres', 'x0': S(335, 0)[0], 'x1': S(580, 0)[0], 'z0': S(0, 560)[1], 'z1': S(0, 385)[1], 'n': 26, 'slant': 0},
                     {'kind': 'seam', 'pts': side((325, 380), (590, 380), (590, 565), (325, 565), (325, 380))}, {'kind': 'highlight', 'pts': side((290, 300), (450, 293), (622, 287)), 'width': 1}],
            'top': [{'kind': 'trim', 'pts': [[610, 0], [1320, 0]], 'width': 1}]})
part('cowl', 'cowl', 'paint', 'side', fit=3,
     side=side((630, 268), (682, 267), (716, 257), (738, 232), (740, 302), (770, 306), (770, 585), (630, 585)),
     front=fhalf((0, 250), (140, 256), (240, 276), (290, 320), (300, 400), (300, 600), (0, 600)), smooth=('front',),
     top=halfT([1240, 0], [1240, 525], [1450, 600], [1560, 640], [1560, 0]))
part('body', 'body', 'paint', 'side', fit=3.5,
     side=side((738, 232), (745, 64), (1560, 64), (1622, 69), (1656, 78), (1678, 93), (1691, 116), (1696, 150), (1697, 420), (1702, 585), (770, 585), (770, 306), (740, 302)),
     front=fhalf((0, 60), (308, 62), (328, 90), (330, 440), (318, 600), (0, 600)), nofit=('rear',),
     rear=half([0, 580], [640, 580], [664, 880], [668, 1600], [656, 1700], [624, 1752], [566, 1774], [0, 1778]),   # the back of the body reaches up to the cap, its top corners round (rear sheet)
     top=halfT([1450, 0], [1450, 600], [1560, 690], [1640, 712], [3520, 712], [3620, 690], [3672, 620], [3690, 520], [3690, 0]),
     feats={'side': [{'kind': 'seam', 'pts': side((1068, 70), (1068, 582))}, {'kind': 'seam', 'pts': side((1362, 70), (1362, 582))},
                     {'kind': 'bead', 'pts': side((742, 312), (1200, 314), (1694, 312))}, {'kind': 'highlight', 'pts': side((746, 322), (1690, 322)), 'width': 1},
                     {'kind': 'handle', 'at': S(990, 345), 'len': 120}, {'kind': 'handle', 'at': S(1085, 345), 'len': 120}],
            'rear': [{'kind': 'bead', 'pts': [[-655, 1200], [0, 1225], [655, 1200]]}]})
part('roof', 'roof', 'canvas', 'roof', color='#222220', fit=3.5, nofit=('front', 'rear'),   # the cap's cloth as the sheet shows it lit from above; its shadows are near black
     side=side((675, 84), (722, 38), (800, 20), (1100, 4), (1480, 6), (1610, 18), (1668, 45), (1692, 90), (1640, 74), (1560, 64), (750, 64), (700, 90)),
     front=half([0, 1688], [560, 1688], [630, 1686], [662, 1690], [672, 1706], [674, 1736], [668, 1768], [652, 1792], [624, 1808], [560, 1817], [300, 1821], [0, 1822]),
     rear=half([0, 1764], [560, 1764], [632, 1762], [664, 1766], [674, 1778], [672, 1792], [658, 1806], [628, 1815], [560, 1819], [300, 1821], [0, 1822]),   # no wider than the body (665 mm from the centre); a cloth cap, its corners rounded
     smooth=('top', 'front', 'rear'), top=halfT([1585, 0], [1585, 560], [1600, 640], [1660, 680], [3500, 680], [3590, 650], [3635, 580], [3645, 480], [3645, 0]))
part('pillar', 'roof', 'black', 'flat', on='body', pair=True, x=[1500, 1600], front=[[598, 1290], [648, 1290], [662, 1700], [610, 1700]])
part('screenFrame', 'screen', 'black', 'flat', on='body', x=[1564, 1599], front=fhalf((0, 100), (300, 100), (300, 240), (0, 240)))
part('screen', 'screen', 'glass', 'side', on='screenFrame', x=[1562, 1600], front=fhalf((0, 115), (182, 115), (182, 222), (0, 222)), side=side((742, 112), (760, 112), (760, 226), (742, 226)))
part('screenBar', 'screen', 'black', 'flat', on='screen', x=[1558, 1600], front=[[-12, F(0, 222)[1]], [12, F(0, 222)[1]], [12, F(0, 115)[1]], [-12, F(0, 115)[1]]])
for k, (a, b, c, d) in enumerate(((810, 110, 1022, 265), (1108, 105, 1315, 265), (1392, 105, 1528, 255))):
    (x0, z1), (x1, z0) = S(a, b), S(c, d); part(f'wframe{k}', 'body', 'paint', 'side', on='body', y=[664, 666], pair=True, side=rrect(x0 - 55, z0 - 55, x1 + 55, z1 + 55, 85)); part(f'glass{k}', 'body', 'glass', 'side', on=f'wframe{k}', fit=3, y=[666, 668], pair=True, side=rrect(x0, z0, x1, z1, 45))
part('rearGlass', 'body', 'glass', 'side', on='body', x=[3602, 3606], rear=half([0, 1290], [320, 1290], [330, 1310], [330, 1552], [310, 1572], [0, 1572]))
part('rearBar', 'body', 'black', 'flat', on='rearGlass', x=[3602, 3608], rear=[[-11, 1290], [11, 1290], [11, 1572], [-11, 1572]], lift=1)

# ---------------- wings, boards ----------------
part('fenderF', 'fenderF', 'paint2', 'fender', fit=3, slot='fenderF', pair=True, cutWheel={'i': 0, 'r': 412}, smooth=('front', 'top'),
     side=side((70, 518), (100, 480), (150, 442), (230, 420), (330, 436), (420, 480), (500, 540), (580, 610), (660, 660), (740, 690), (800, 700), (800, 716), (730, 714), (650, 694), (560, 645), (480, 580), (440, 560), (432, 672), (50, 672), (48, 560)),
     front=[F(*q) for q in ((150, 687), (180, 560), (230, 500), (290, 465), (350, 452), (400, 465), (418, 500), (420, 580), (395, 602), (330, 562), (280, 562), (240, 602), (200, 687))],
     top=[[150, 640], [165, 760], [230, 830], [400, 850], [1320, 850], [1440, 822], [1490, 760], [1485, 630], [1420, 592], [600, 590], [420, 575], [260, 545], [175, 575]],
     feats={'side': [{'kind': 'highlight', 'pts': side((110, 490), (160, 452), (230, 432), (325, 447), (410, 490), (490, 548)), 'width': 2}],
            'front': [{'kind': 'highlight', 'pts': [F(*q) for q in ((185, 545), (230, 500), (290, 470), (350, 460), (395, 472))], 'width': 2}]})
part('fenderR', 'fenderR', 'paint2', 'fender', fit=3, slot='fenderR', pair=True, cutWheel={'i': 1, 'r': 412}, smooth=('rear', 'top'),
     side=side((1250, 585), (1265, 520), (1300, 460), (1350, 420), (1420, 400), (1500, 398), (1570, 420), (1630, 470), (1670, 540), (1700, 610), (1740, 660), (1785, 690), (1790, 706), (1700, 702), (1690, 682), (1250, 682)),
     rear=[[560, 380], [560, 760], [600, 860], [700, 905], [790, 880], [840, 800], [850, 380]],
     top=[[2805, 640], [2830, 780], [2930, 840], [3060, 850], [3700, 850], [3810, 815], [3858, 720], [3845, 625], [3760, 590], [2900, 590]],
     feats={'side': [{'kind': 'highlight', 'pts': side((1290, 480), (1350, 432), (1420, 412), (1500, 410), (1565, 432), (1622, 480)), 'width': 2}]})
part('board', 'board', 'rubber', 'flat', slot='board', pair=True, side=side((690, 700), (1350, 700), (1350, 720), (690, 720)), top=[[1460, 700], [1460, 845], [2860, 845], [2860, 700]], detail={'kind': 'ribs', 'pitch': 25})
for k, (a, b) in enumerate(((785, 890), (1105, 1215))):
    part(f'step{k}', 'board', 'chrome', 'flat', slot='board', pair=True, side=side((a + 12, 672), (b - 12, 672), (b, 700), (a, 700)), top=[[S(a, 0)[0], 735], [S(a, 0)[0], 848], [S(b, 0)[0], 848], [S(b, 0)[0], 735]], lift=1)

# ---------------- lamps, bumpers, spare ----------------
part('lamp', 'lamp', 'chrome', 'fender', slot='lamp', pair=True, fit=2.5, smooth=('side', 'front', 'top'),
     side=side((150, 345), (160, 330), (180, 326), (205, 335), (228, 352), (234, 372), (232, 400), (215, 415), (190, 420), (160, 418), (148, 400), (145, 372)),
     front=ell(377, 910, 121, 121), top=[[410, 330], [330, 300], [250, 318], [205, 395], [250, 472], [330, 492], [410, 462]])
# the lamp seen face on, as the front sheet draws it: a chrome rim, a silvered reflector behind clear glass (bright,
# shaded like a bowl), the bulb a dark point at its centre
part('lens', 'lamp', 'chrome', 'fender', on='lamp', slot='lamp', pair=True, x=[303, 312], smooth=('front',), front=ell(377, 910, 100, 100))
part('bulb', 'lamp', 'black', 'flat', on='lens', slot='lamp', pair=True, x=[300, 304], smooth=('front',), front=ell(377, 910, 16, 16))
part('lampBar', 'lamp', 'chrome', 'flat', slot='lamp', x=[380, 420], front=half([0, 872], [270, 880], [270, 905], [0, 900]))
part('lampStand', 'lamp', 'chrome', 'flat', slot='lamp', pair=True, y=[370, 396], side=side((180, 418), (198, 418), (203, 470), (182, 470)))
for k, py in enumerate((615, 661)):
    z = S(0, py)[1]
    zf, zr = (440, 358)[k], (470, 395)[k]                                       # the bars' heights as the front and rear sheets draw them
    part(f'bumperF{k}', 'bumperF', 'chrome', 'fender', slot='bumperF', side=side((2, py - 11), (42, py - 11), (46, py), (42, py + 11), (2, py + 11)), front=half([0, zf - 24], [655, zf - 24], [668, zf], [655, zf + 24], [0, zf + 24]),
         top=halfT([0, 0], [0, 560], [20, 640], [70, 690], [110, 690], [80, 620], [60, 540], [60, 0]))
    part(f'bumperR{k}', 'bumperR', 'chrome', 'fender', slot='bumperR', pair=True, side=side((1778, py - 11), (1834, py - 11), (1834, py + 11), (1778, py + 11)), rear=[[290, zr - 23], [790, zr - 23], [800, zr], [790, zr + 23], [290, zr + 23]],
         top=[[3770, 290], [3770, 790], [3800, 805], [3885, 805], [3885, 290]])
for k, u in enumerate((215, 575)):
    part(f'clampF{k}', 'bumperF', 'chrome', 'flat', on='bumperF0', slot='bumperF', pair=True, x=[0, 30], front=[[u - 14, 322], [u + 14, 322], [u + 14, 500], [u - 14, 500]])
part('ironF', 'bumperF', 'black', 'flat', slot='bumperF', pair=True, side=side((42, 600), (120, 610), (120, 640), (42, 676)), front=[[330, 320], [362, 320], [362, 480], [330, 480]], top=[[40, 210], [40, 245], [260, 245], [260, 210]], lift=1)
part('ironR', 'bumperR', 'black', 'flat', slot='bumperR', pair=True, side=side((1700, 610), (1780, 600), (1780, 676), (1700, 640)), rear=[[540, 400], [572, 400], [572, 545], [540, 545]], top=[[3600, 520], [3600, 552], [3800, 552], [3800, 520]])
part('tail', 'tail', 'lensR', 'flat', on='body', slot='tail', pair=True, smooth=('rear', 'side'), x=[3590, 3640], side=ell(3615, 720, 22, 50), rear=ell(590, 690, 50, 50))
part('spare', 'spare', 'rubber', 'fender', wheel={'r': 380},
     side=ell(S(1752, 0)[0], 868, 100, 296), rear=ell(0, 775, 385, 385), top=halfT([3680, 0], [3680, 380], [3700, 410], [3840, 410], [3860, 380], [3860, 0]), smooth=('side', 'top'), detail={'kind': 'ribs', 'pitch': 40})
part('spareHub', 'spare', 'chrome', 'flat', on='spare', smooth=('side',), y=[-60, 60], side=ell(S(1770, 0)[0], 868, 36, 70), lift=1)

M = {'id': 'sedan29', 'name': 'four-door sedan, 1929', 'year': 1929, 'length': L, 'width': W, 'height': H, 'paint': '#3b3e25', 'paint2': '#232327', 'canvas': '#34343a',
     'wheels': [{'x': FX, 'r': R, 'y': 690}, {'x': RX, 'r': R, 'y': 690}], 'wheel': {'rim': 0.66, 'style': 'wire', 'spokes': 36, 'rimMaterial': 'paint', 'cap': 0.22, 'capRings': 1},
     'parts': P}
json.dump(M, open(OUT, 'w'), indent=0)
print(OUT, len(P), 'parts;', sum(len(p['outlines']) for p in P), 'outlines')
print('outlines pulled onto the drawing, mean move in mm:', SNAP)
print('where a view of the sheet differs from the common box by more than 50 mm (each view keeps its own):'); print('\n'.join('  ' + n for n in notes))
