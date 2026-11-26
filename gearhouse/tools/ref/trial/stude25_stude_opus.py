"""The 1925 six-cylinder sedan (sheet: the right-hand car) as one 3D part model, made by hand after
tools/ref/sedan29_model.py (the common guide, docs/systems/62). Every part is defined once: a box in the car's own space
(x from the front bumper back, y from the centre line outwards, z up; millimetres) and its outline as this car's sheet
shows it from the side, the front, the rear and above. Shapes are read off the sheet's views enlarged 4 times:
S(px, py) side, F(dx, py) front, B(dx, py) rear (dx: pixels from the centre line), T(px, dy) plan.

What this car has that the template has not: a long seven-window sedan body (three side windows, a black upper body above
the belt over a green lower one), a visor over the windscreen, a single windscreen without a centre bar, cowl lamps, a
tall nickel shell with a fine mesh core and a mascot, free-standing headlamps on their own posts (no tie bar), a spare
standing on end at the back, full-width rear bumper bars, one tail lamp and the number plate on the left, a running
board with a metal edge (no step plates), artillery wheels with twelve green spokes.

  python3 stude25.py <views dir> <out json>"""
import sys, os, json, math
sys.path.insert(0, '/home/user/1/gearhouse/tools/ref')
VIEWS, OUT = sys.argv[1], sys.argv[2]
L, W, H, C = 4215, 1879, 1776, 1879 / 2
R = 404
S = lambda px, py: [round(px * L / 2088), round(H - py * H / 880)]          # side view (left), pixels of the 4x view
F = lambda dx, py: [round(dx * W / 1108), round(H - py * H / 1020)]          # front view: distance from the centre line, row
B = lambda dx, py: [round(dx * W / 1048), round(H - py * H / 980)]           # rear view: the same
T = lambda px, dy: [round(px * L / 2012), round(dy * W / 660)]               # plan: along, distance from the centre line
FX, RX = S(197, 0)[0], S(1710, 0)[0]
def side(*p): return [S(*q) for q in p]
def half(*p):
    r = [list(q) for q in p]; return r + [[-x, z] for x, z in reversed(r) if x != 0]
def fhalf(*p): return half(*[F(*q) for q in p])
def bhalf(*p): return half(*[B(*q) for q in p])
def halfT(*p):
    r = [list(q) for q in p]; return r + [[x, -y] for x, y in reversed(r) if y != 0]
def thalf(*p): return halfT(*[T(*q) for q in p])
def ell(cx, cz, rx, rz, n=20): return [[round(cx + math.cos(k / n * 6.2832) * rx), round(cz + math.sin(k / n * 6.2832) * rz)] for k in range(n)]
def rrect(x0, z0, x1, z1, r, n=4):
    out = []
    for cx, cz, a0 in ((x1 - r, z1 - r, 0), (x0 + r, z1 - r, 90), (x0 + r, z0 + r, 180), (x1 - r, z0 + r, 270)):
        for k in range(n + 1): a = math.radians(a0 + 90 * k / n); out.append([round(cx + math.cos(a) * r), round(cz + math.sin(a) * r)])
    return out
def srect(a, b, c, d, r):
    """a rounded window outline from its 4x side-view pixel box"""
    (x0, z1), (x1, z0) = S(a, b), S(c, d); return rrect(x0, z0, x1, z1, r)
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
        if max(abs(t) for t in d) > 50: notes.append(f'{id:12s} {v:5s} differs from the common box by {d} mm (centre {a}, centre {b}, size {a}, size {b})')
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
              **({'slot': slot} if slot else {}), **({'detail': detail} if detail else {}), **({'features': f2} if f2 else {}), **({'cutWheel': cutWheel} if cutWheel else {}), **({'wheel': wheel} if wheel else {}), **({'lift': lift} if lift else {}), **({'on': on} if on else {}), **({'color': color} if color else {}), **({'layer': layer} if layer else {})})

# ---------------- chassis parts seen from outside ----------------
for i, wx in enumerate((FX, RX)):   # the wheel houses: black behind the arches, in front of the body so no paint shows round the tyre
    part(f'house{i}', 'house', 'black', 'flat', y=[0, 800], side=[[wx - 470, R]] + [[round(wx + math.cos(a) * 470), round(R + math.sin(a) * 470)] for a in [math.pi * k / 14 for k in range(14, -1, -1)]] + [[wx + 470, R]])
part('frame', 'frame', 'black', 'flat', pair=True, side=side((50, 600), (1985, 600), (1985, 660), (50, 660)), front=[F(235, 690), F(280, 690), F(280, 760), F(235, 760)], rear='front', top=[T(40, 125), T(1940, 125), T(1940, 160), T(40, 160)])
part('axleF', 'axle', 'black', 'flat', x=[FX - 38, FX + 38], front=half([0, 366], [700, 366], [700, 431], [600, 431], [560, 400], [0, 400]))
part('springF', 'spring', 'iron', 'flat', x=[FX - 28, FX + 28], front=half([0, 590], [150, 580], [450, 500], [620, 440], [620, 470], [450, 530], [150, 610], [0, 620]))
part('axleR', 'axle', 'black', 'flat', x=[RX - 50, RX + 50], rear=half([0, 290], [130, 300], [180, 370], [700, 385], [700, 450], [180, 465], [130, 535], [0, 542]), smooth=('rear',))
part('springR', 'spring', 'iron', 'flat', x=[RX + 60, RX + 120], rear=half([0, 640], [130, 630], [450, 550], [640, 470], [640, 500], [450, 582], [130, 665], [0, 675]))
tyre = [[20, 6], [50, 0], [176, 0], [206, 6], [222, 40], [229, 200], [231, R], [228, 600], [220, 740], [206, 784], [184, 802], [150, 808], [76, 808], [42, 802], [20, 784], [6, 740], [-2, 600], [-5, R], [-3, 200], [4, 40]]   # a balloon section, flat where it stands
def tyre_at(y0, y1): lo = min(q[0] for q in tyre); hi = max(q[0] for q in tyre); return [[round(y0 + (q[0] - lo) / (hi - lo) * (y1 - y0)), q[1]] for q in tyre]
part('tyreF', 'wheel', 'rubber', 'fender', x=[FX - R, FX + R], pair=True, front=tyre_at(F(389, 0)[0], F(523, 0)[0]), top=[T(5, 230), T(190, 230), T(190, 318), T(5, 318)], smooth=('front',), detail={'kind': 'treadFace', 'pitch': 38})
part('tyreR', 'wheel', 'rubber', 'fender', x=[RX - R, RX + R], pair=True, rear=tyre_at(B(347, 0)[0], B(482, 0)[0]), top=[T(1550, 230), T(1745, 230), T(1745, 318), T(1550, 318)], smooth=('rear',), detail={'kind': 'treadFace', 'pitch': 38})

# ---------------- radiator, hood, cowl ----------------
part('splash', 'apron', 'black', 'flat', x=[350, 1500], top=thalf((20, 0), (20, 200), (578, 220), (578, 0)), front=fhalf((0, 690), (400, 690), (400, 880), (0, 880)))   # black below the shell, between the wings
part('crossF', 'frame', 'black', 'flat', x=[110, 180], top=thalf((50, 0), (50, 150), (85, 150), (85, 0)), front=fhalf((0, 860), (330, 860), (330, 885), (0, 885)))
part('apron', 'apron', 'black', 'flat', side=side((380, 598), (1470, 598), (1470, 700), (380, 700)), top=thalf((578, 0), (578, 300), (1400, 300), (1400, 0)))   # the black valance between body sill and board
part('shell', 'radiator', 'chrome', 'flat', slot='grille', fit=2,
     side=side((140, 268), (146, 259), (198, 257), (203, 262), (203, 425), (140, 425)),
     front=fhalf((0, 302), (50, 305), (95, 315), (130, 333), (150, 352), (160, 380), (163, 680), (157, 698), (142, 706), (0, 707)), smooth=('front',),   # a tall nickel shell, its top arched
     top=thalf((139, 0), (139, 112), (150, 120), (192, 124), (192, 0)))
part('lip', 'radiator', 'iron', 'flat', on='shell', slot='grille', x=[282, 300], front=fhalf((0, 358), (110, 360), (140, 368), (147, 385), (147, 690), (141, 698), (0, 700)), smooth=('front',))
part('core', 'radiator', 'black', 'flat', on='lip', slot='grille', x=[285, 300], front=fhalf((0, 369), (120, 370), (135, 377), (138, 390), (138, 684), (132, 692), (0, 692)), detail={'kind': 'cells', 'pitch': 22})
part('cap', 'radiator', 'chrome', 'flat', on='shell', slot='grille', side=side((160, 260), (157, 242), (151, 229), (160, 215), (178, 207), (196, 215), (204, 229), (197, 242), (195, 260)),
     front=fhalf((0, 302), (14, 302), (12, 278), (24, 258), (18, 232), (0, 223)))   # a mascot on the filler cap
part('hood', 'hood', 'paint', 'side', fit=2.5,
     side=side((203, 258), (705, 255), (712, 600), (203, 600)),
     front=fhalf((0, 298), (120, 300), (220, 310), (280, 330), (300, 360), (302, 690), (0, 690)), smooth=('front',),
     top=thalf((192, 0), (192, 128), (617, 220), (617, 0)),
     feats={'side': [{'kind': 'louvres', 'x0': S(282, 0)[0], 'x1': S(650, 0)[0], 'z0': S(0, 537)[1], 'z1': S(0, 368)[1], 'n': 24, 'slant': 0},
                     {'kind': 'bead', 'pts': side((205, 307), (708, 307))}, {'kind': 'highlight', 'pts': side((210, 265), (460, 263), (700, 262)), 'width': 1}],
            'top': [{'kind': 'trim', 'pts': [T(192, 0), T(617, 0)], 'width': 1}]})
part('cowl', 'cowl', 'paint', 'side', fit=2.5,
     side=side((705, 256), (750, 252), (785, 246), (800, 241), (875, 240), (875, 600), (712, 600)),
     front=fhalf((0, 280), (150, 283), (260, 295), (330, 318), (362, 345), (368, 400), (368, 690), (0, 690)), smooth=('front',),
     top=thalf((617, 0), (617, 220), (670, 224), (725, 228), (725, 0)),
     feats={'side': [{'kind': 'bead', 'pts': side((708, 307), (875, 307))}],
            'front': [{'kind': 'bead', 'pts': [F(-362, 331), F(-169, 360)]}, {'kind': 'bead', 'pts': [F(169, 360), F(362, 331)]}]})
part('cowlLamp', 'lamp', 'chrome', 'fender', slot='lamp', pair=True, smooth=('side', 'front'), side=ell(*S(876, 350), 20, 40, 12), front=ell(*F(358, 366), 38, 26, 12))

# ---------------- body ----------------
part('body', 'body', 'paint', 'side', fit=2.5, nofit=('front',),
     side=side((800, 241), (803, 100), (808, 64), (1962, 64), (1977, 80), (1983, 110), (1983, 300), (1980, 560), (1976, 600), (875, 600), (875, 241)),
     front=fhalf((0, 50), (376, 50), (380, 70), (380, 690), (0, 690)),
     rear=bhalf((0, 8), (340, 8), (372, 20), (388, 45), (392, 80), (392, 662), (0, 662)),
     top=thalf((725, 0), (725, 286), (740, 292), (800, 296), (1800, 306), (1850, 300), (1872, 282), (1880, 240), (1880, 0)),
     feats={'side': [{'kind': 'seam', 'pts': side((875, 300), (875, 598))}, {'kind': 'seam', 'pts': side((1222, 66), (1222, 598))}, {'kind': 'seam', 'pts': side((1577, 66), (1577, 598))},
                     {'kind': 'bead', 'pts': side((875, 307), (1500, 307), (1978, 307))}, {'kind': 'highlight', 'pts': side((878, 318), (1976, 318)), 'width': 1},
                     {'kind': 'trim', 'pts': side((878, 592), (1975, 592)), 'width': 1},
                     {'kind': 'handle', 'at': S(1165, 345), 'len': 110}, {'kind': 'handle', 'at': S(1262, 345), 'len': 110}],
            'rear': [{'kind': 'bead', 'pts': [B(-390, 352), B(-330, 326), B(0, 318), B(330, 326), B(390, 352)]}, {'kind': 'highlight', 'pts': [B(-370, 120), B(-365, 300)], 'width': 1}]})
# the body above the belt is black, as is the cap: a part of its own, lying on the body
part('upper', 'body', 'paint2', 'side', on='body',
     side=side((800, 242), (803, 100), (808, 64), (1962, 64), (1977, 80), (1983, 110), (1983, 302), (875, 302), (875, 242)),
     rear=bhalf((0, 8), (340, 8), (372, 20), (388, 45), (392, 80), (392, 352), (380, 354), (330, 326), (300, 320), (0, 318)),
     top=thalf((728, 0), (728, 286), (742, 292), (800, 296), (1800, 306), (1850, 300), (1872, 282), (1880, 240), (1880, 0)))   # from above the black upper body shows round the cap
part('roof', 'roof', 'canvas', 'roof', color='#2a292c', fit=2.5, nofit=('front', 'rear'), slot='roof',
     side=side((800, 62), (835, 42), (887, 21), (992, 10), (1100, 6), (1800, 6), (1900, 12), (1940, 25), (1965, 45), (1978, 70), (1983, 100), (1960, 75), (1930, 54), (810, 54)),
     front=fhalf((0, 4), (330, 4), (362, 12), (378, 28), (384, 48), (0, 48)),
     rear=bhalf((0, 6), (340, 6), (372, 18), (390, 45), (408, 60), (408, 76), (392, 76), (0, 76)),
     smooth=('top', 'front', 'rear'), top=thalf((740, 0), (740, 262), (760, 282), (800, 290), (1820, 298), (1852, 285), (1866, 258), (1870, 0)))
part('visor', 'roof', 'paint2', 'flat', slot='roof', smooth=('side',),   # the sun visor over the windscreen
     side=side((752, 90), (775, 70), (811, 48), (830, 50), (832, 92), (802, 100), (765, 99)),
     front=fhalf((0, 42), (378, 42), (390, 50), (390, 72), (380, 78), (0, 78)),
     top=thalf((728, 0), (728, 280), (740, 290), (762, 292), (762, 0)))
part('pillar', 'roof', 'paint2', 'flat', on='body', pair=True, x=[1620, 1765], front=[F(300, 48), F(388, 48), F(388, 352), F(300, 352)])
part('screenFrame', 'screen', 'paint2', 'flat', on='body', x=[1680, 1720], front=fhalf((0, 48), (310, 48), (310, 285), (0, 285)))
part('screen', 'screen', 'glass', 'side', on='screenFrame', x=[1676, 1720], front=fhalf((0, 80), (290, 80), (297, 90), (297, 262), (289, 270), (0, 270)), side=side((832, 92), (848, 92), (848, 245), (832, 245)))
WIN = (((900, 81, 1188, 268), (909, 91, 1157, 260)), ((1257, 83, 1544, 267), (1266, 92, 1500, 259)), ((1608, 81, 1854, 269), (1617, 92, 1777, 258)))
for k, (fr, gl) in enumerate(WIN):   # each side window: a varnished wooden frame (the sheet's brown), the glass inside it
    part(f'wframe{k}', 'body', 'wood', 'side', on='upper', color='#4a3726', y=[735, 737], pair=True, side=srect(*fr, 22))
    part(f'glass{k}', 'body', 'glass', 'side', on=f'wframe{k}', fit=1.5, y=[737, 739], pair=True, side=srect(*gl, 14))
part('rearFrame', 'body', 'wood', 'side', on='upper', color='#4a3726', x=[3990, 3996], rear=bhalf((0, 100), (212, 100), (221, 108), (221, 262), (212, 266), (0, 266)))
part('rearGlass', 'body', 'glass', 'side', on='rearFrame', x=[3992, 3996], rear=bhalf((0, 106), (204, 106), (213, 114), (213, 252), (205, 258), (0, 258)))
part('rearApron', 'body', 'black', 'flat', x=[3960, 3990], rear=bhalf((0, 662), (390, 662), (390, 860), (0, 860)))

# ---------------- wings, boards ----------------
part('fenderF', 'fenderF', 'paint2', 'fender', fit=2.5, slot='fenderF', pair=True, cutWheel={'i': 0, 'r': 460}, smooth=('front', 'top'),
     side=side((0, 530), (0, 482), (30, 450), (75, 432), (150, 415), (225, 411), (300, 422), (350, 440), (400, 475), (435, 510), (475, 570), (500, 610), (540, 655), (600, 685), (650, 695), (705, 698),
               (708, 722), (690, 736), (470, 736), (440, 680), (0, 680)),
     front=[F(*q) for q in ((231, 715), (233, 650), (250, 590), (285, 535), (330, 492), (380, 462), (430, 454), (480, 454), (520, 462), (548, 485), (557, 530), (556, 590), (545, 608), (500, 612), (400, 612), (392, 715))],
     top=[T(*q) for q in ((3, 140), (5, 250), (18, 298), (45, 318), (90, 323), (578, 323), (580, 225), (192, 135), (100, 140), (40, 118), (12, 125))],
     feats={'side': [{'kind': 'highlight', 'pts': side((40, 448), (150, 425), (225, 421), (300, 432), (350, 450), (400, 485), (440, 520)), 'width': 2}],
            'front': [{'kind': 'highlight', 'pts': [F(*q) for q in ((290, 540), (335, 500), (385, 472), (440, 464), (500, 466))], 'width': 2}],
            'top': [{'kind': 'highlight', 'pts': [T(30, 300), T(300, 305), T(570, 305)], 'width': 2}]})
part('fenderR', 'fenderR', 'paint2', 'fender', fit=2.5, slot='fenderR', pair=True, cutWheel={'i': 1, 'r': 460}, smooth=('rear', 'top'),
     side=side((1462, 724), (1465, 700), (1470, 640), (1480, 575), (1500, 520), (1525, 480), (1560, 450), (1600, 430), (1650, 415), (1700, 410), (1760, 413), (1800, 425), (1845, 445), (1875, 465),
               (1905, 495), (1925, 525), (1945, 565), (1958, 610), (1970, 650), (1985, 680), (2000, 710), (2005, 728), (1990, 734), (1960, 730), (1500, 730)),
     rear=[B(*q) for q in ((372, 812), (368, 480), (380, 450), (410, 438), (480, 436), (510, 446), (522, 470), (526, 790), (518, 812))],
     top=[T(*q) for q in ((1400, 315), (1420, 308), (1500, 306), (1850, 306), (1872, 312), (1880, 322), (1870, 330), (1420, 330), (1400, 325))],
     feats={'side': [{'kind': 'highlight', 'pts': side((1490, 540), (1520, 492), (1560, 460), (1650, 425), (1760, 423), (1845, 455), (1905, 505), (1940, 570)), 'width': 2}]})
part('board', 'board', 'rubber', 'flat', slot='board', pair=True, color='#6f6c68', side=side((700, 697), (1462, 697), (1462, 722), (700, 722)), top=[T(578, 220), T(1400, 220), T(1400, 330), T(578, 330)], detail={'kind': 'ribs', 'pitch': 25})
part('boardEdge', 'board', 'chrome', 'flat', slot='board', pair=True, lift=1, side=side((700, 698), (1462, 698), (1462, 712), (700, 712)), top=[T(578, 322), T(1400, 322), T(1400, 330), T(578, 330)])   # the metal edge strip along the board

# ---------------- lamps, bumpers, spare ----------------
part('lamp', 'lamp', 'chrome', 'fender', slot='lamp', pair=True, fit=2, smooth=('side', 'front', 'top'),
     side=side((38, 322), (60, 318), (90, 322), (115, 335), (132, 355), (138, 380), (134, 405), (118, 425), (95, 436), (65, 440), (40, 436), (32, 410), (30, 380), (32, 345)),
     front=ell(*F(238, 454), 127, 130), top=[T(*q) for q in ((97, 104), (97, 216), (120, 220), (150, 214), (172, 196), (181, 160), (172, 124), (150, 106), (120, 100))])
part('lampGap', 'lamp', 'iron', 'flat', on='lamp', slot='lamp', pair=True, x=[64, 74], smooth=('front',), front=ell(*F(238, 454), 112, 115))
part('lens', 'lamp', 'chrome', 'flat', on='lampGap', slot='lamp', pair=True, x=[62, 72], smooth=('front',), front=ell(*F(238, 454), 106, 109), detail={'kind': 'bowl'})
part('lampStand', 'lamp', 'chrome', 'flat', slot='lamp', pair=True, side=side((78, 436), (96, 436), (99, 470), (80, 470)), front=[F(228, 528), F(248, 528), F(246, 646), F(230, 646)])   # each lamp on its own post (no tie bar on this car)
for k, (fa, fb, ra, rb) in enumerate(((731, 762, 727, 758), (785, 815, 773, 804))):
    zf0, zf1 = F(0, fb)[1], F(0, fa)[1]; zr0, zr1 = B(0, rb)[1], B(0, ra)[1]; zfm, zrm = (zf0 + zf1) // 2, (zr0 + zr1) // 2
    sf0, sf1 = round((H - zf1) / (H / 880)), round((H - zf0) / (H / 880)); sr0, sr1 = round((H - zr1) / (H / 880)), round((H - zr0) / (H / 880))
    part(f'bumperF{k}', 'bumperF', 'chrome', 'fender', slot='bumperF', side=side((0, sf0), (30, sf0), (34, (sf0 + sf1) / 2), (30, sf1), (0, sf1)),
         front=half([0, zf0], [880, zf0], [899, zfm], [880, zf1], [0, zf1]), top=thalf((5, 0), (5, 290), (12, 308), (30, 312), (28, 290), (22, 270), (22, 0)))
    part(f'bumperR{k}', 'bumperR', 'chrome', 'fender', slot='bumperR', side=side((2035, sr0), (2080, sr0), (2084, (sr0 + sr1) / 2), (2080, sr1), (2035, sr1)),   # full width: the spare stands in front of them
         rear=half([0, zr0], [840, zr0], [856, zrm], [840, zr1], [0, zr1]), top=thalf((1925, 0), (1925, 265), (1905, 290), (1888, 300), (1896, 306), (1915, 296), (1944, 270), (1944, 0)))
part('clampF', 'bumperF', 'chrome', 'flat', on='bumperF0', slot='bumperF', pair=True, x=[0, 30], front=[F(202, 723), F(238, 723), F(238, 815), F(202, 815)])
part('clampR', 'bumperR', 'chrome', 'flat', on='bumperR0', slot='bumperR', pair=True, x=[4180, 4215], rear=[B(194, 723), B(232, 723), B(232, 808), B(194, 808)])
part('ironF', 'bumperF', 'black', 'flat', slot='bumperF', pair=True, side=side((25, 640), (120, 650), (120, 675), (25, 700)), front=[F(240, 740), F(262, 740), F(262, 830), F(240, 830)], top=[T(20, 120), T(120, 120), T(120, 135), T(20, 135)], lift=1)
part('ironR', 'bumperR', 'black', 'flat', slot='bumperR', pair=True, side=side((1960, 640), (2040, 650), (2040, 680), (1960, 690)), rear=[B(250, 730), B(272, 730), B(272, 810), B(250, 810)], top=[T(1860, 120), T(1930, 120), T(1930, 135), T(1860, 135)])
# one tail lamp, on the left, above the number plate (rear sheet)
part('tailRim', 'tail', 'chrome', 'fender', on='body', slot='tail', smooth=('rear',), x=[3985, 4000], rear=ell(*B(339, 519), 62, 62))
part('tail', 'tail', 'lensR', 'flat', on='tailRim', slot='tail', smooth=('rear',), x=[3990, 4005], rear=ell(*B(339, 519), 50, 50))
part('plateRim', 'plate', 'chrome', 'flat', slot='tail', x=[4000, 4010], rear=[B(224, 585), B(436, 585), B(436, 677), B(224, 677)])
part('plate', 'plate', 'black', 'flat', on='plateRim', slot='tail', x=[4000, 4010], rear=[B(232, 592), B(428, 592), B(428, 670), B(232, 670)])
part('tailStay', 'tail', 'iron', 'flat', slot='tail', x=[3980, 4000], rear=[B(330, 545), B(348, 545), B(348, 590), B(330, 590)])
# the spare stands on end at the back: from the side its tread edge on, from above the same, lying across the car
def tyre_section(u0, u1, v0, v1, across_first=True):
    lo_u, hi_u = min(q[0] for q in tyre), max(q[0] for q in tyre); hi_v = max(q[1] for q in tyre)
    return [[round(u0 + (q[0] - lo_u) / (hi_u - lo_u) * (u1 - u0)), round(v0 + q[1] / hi_v * (v1 - v0))] if across_first else
            [round(v0 + q[1] / hi_v * (v1 - v0)), round(u0 + (q[0] - lo_u) / (hi_u - lo_u) * (u1 - u0))] for q in tyre]
(sx0, sz1), (sx1, sz0) = S(1980, 340), S(2080, 720); (tx0, ty1), (tx1, _) = T(1911, 160), T(2011, 0)
part('spare', 'spare', 'rubber', 'fender', wheel={'r': 372}, slot='spare',
     side=tyre_section(sx0, sx1, sz0, sz1), rear=ell(0, B(0, 577)[1], 372, 372),
     top=tyre_section(tx0, tx1, -ty1, ty1), smooth=('side', 'top'), detail={'kind': 'treadFace', 'pitch': 38})
part('spareCarrier', 'spare', 'iron', 'flat', y=[-40, 40], side=side((1975, 560), (1990, 560), (1990, 600), (1975, 600)), top=thalf((1880, 0), (1880, 14), (1920, 14), (1920, 0)))

# ---------------- the chassis under the body (layer 'chassis', from the draft's chassis, moved onto this car) ----------------
R4 = lambda x0, x1, a0, a1: [[x0, a0], [x1, a0], [x1, a1], [x0, a1]]
CH = dict(layer='chassis'); ENG = '#3e5a3a'
part('radiatorCore', 'radiator', 'black', 'flat', **CH, side=R4(508, 606, 658, 1244), top=halfT([508, 0], [508, 287], [606, 287], [606, 0]), front=half([0, 658], [276, 658], [276, 1244], [0, 1244]), detail={'kind': 'ribs', 'pitch': 25})
part('fan', 'engine', 'black', 'flat', **CH, side=R4(619, 649, 834, 1165), top=halfT([619, 0], [619, 199], [649, 199], [649, 0]), front=ell(0, 1000, 199, 165))
part('sump', 'engine', 'black', 'side', **CH, side=[[753, 515], [1427, 515], [1407, 616], [773, 616]], top=halfT([753, 0], [753, 170], [1427, 170], [1427, 0]), front=half([0, 515], [170, 515], [188, 616], [0, 616]))
part('block', 'engine', 'paint2', 'side', **CH, color=ENG, side=R4(677, 1486, 616, 1071), top=halfT([677, 0], [677, 230], [1486, 230], [1486, 0]), front=half([0, 616], [220, 616], [254, 950], [220, 1071], [0, 1071]))
part('head', 'engine', 'paint2', 'side', **CH, color=ENG, side=[[690, 1071], [1474, 1071], [1464, 1115], [700, 1115]], top=halfT([690, 0], [690, 170], [1474, 170], [1474, 0]), front=half([0, 1071], [188, 1071], [168, 1115], [0, 1115]))
part('generator', 'engine', 'black', 'fender', **CH, side=R4(714, 959, 940, 1027), top=[[714, 232], [959, 232], [959, 343], [714, 343]], front=ell(288, 984, 56, 44))
part('starter', 'engine', 'black', 'fender', **CH, side=R4(751, 1045, 715, 836), top=[[751, -354], [1045, -354], [1045, -232], [751, -232]], front=ell(-293, 776, 61, 60))
part('bell', 'gearbox', 'paint2', 'side', **CH, color=ENG, side=[[1486, 562], [1726, 590], [1726, 975], [1486, 1001]], top=halfT([1486, 0], [1486, 254], [1726, 200], [1726, 0]), front=ell(0, 782, 254, 220))
part('gearbox', 'gearbox', 'paint2', 'side', **CH, color=ENG, side=R4(1726, 2119, 605, 859), top=halfT([1726, 0], [1726, 166], [2119, 145], [2119, 0]), front=half([0, 605], [166, 605], [166, 859], [0, 859]), detail={'kind': 'ribs', 'pitch': 60})
part('lever', 'gearbox', 'iron', 'flat', **CH, side=[[1908, 859], [1940, 859], [2031, 1148], [2003, 1148]], top=[[1908, -17], [2031, -17], [2031, 17], [1908, 17]])
part('torqueTube', 'driveline', 'iron', 'fender', **CH, side=[[2119, 680], [RX - 90, 450], [RX - 90, 505], [2119, 746]], top=halfT([2119, 0], [2119, 50], [RX - 90, 50], [RX - 90, 0]))
part('rearDiff', 'axle', 'iron', 'fender', **CH, side=ell(RX, R, 150, 140), top=halfT([RX - 150, 0], [RX - 150, 177], [RX + 150, 177], [RX + 150, 0]), rear=ell(0, R, 177, 150))
part('axleTubeR', 'axle', 'black', 'flat', **CH, side=R4(RX - 40, RX + 40, R - 40, R + 40), top=halfT([RX - 40, 0], [RX - 40, 774], [RX + 40, 774], [RX + 40, 0]))
part('axleTubeF', 'axle', 'black', 'flat', **CH, side=R4(FX - 38, FX + 38, 362, 439), top=halfT([FX - 38, 0], [FX - 38, 752], [FX + 38, 752], [FX + 38, 0]))
part('tank', 'tank', 'iron', 'side', **CH, side=R4(1421, 1672, 1061, 1261), top=halfT([1421, 0], [1421, 575], [1672, 575], [1672, 0]), front=half([0, 1061], [575, 1061], [575, 1270], [0, 1270]))
part('column', 'steering', 'black', 'flat', **CH, side=[[1354, 702], [1386, 702], [2020, 1345], [1990, 1357]], top=[[1354, 365], [2020, 365], [2020, 409], [1354, 409]])
part('steerWheel', 'steering', 'black', 'flat', **CH, side=ell(2015, 1368, 31, 166), top=[[1997, 177], [2037, 177], [2037, 597], [1997, 597]], front=ell(387, 1368, 210, 166))
part('exhaust', 'exhaust', 'iron', 'flat', **CH, side=[[1121, 768], [1160, 620], [1200, 490], [1320, 466], [2615, 470], [2615, 510], [1330, 506], [1230, 520], [1190, 630], [1161, 768]], top=[[1121, 254], [2615, 300], [2615, 354], [1121, 300]])
part('muffler', 'exhaust', 'iron', 'side', **CH, side=R4(2615, 3234, 433, 524), top=[[2615, 276], [3234, 276], [3234, 387], [2615, 387]])
part('tailpipe', 'exhaust', 'iron', 'flat', **CH, side=R4(3234, 4024, 466, 490), top=[[3234, 321], [4024, 321], [4024, 343], [3234, 343]])

M = {'id': 'stude25', 'name': '1925 six-cylinder sedan', 'year': 1925, 'length': L, 'width': W, 'height': H,
     'paint': '#2a3d2e', 'paint2': '#262728', 'canvas': '#3a393d', 'chrome': '#9c9693', 'glassTint': '#8b959d',   # dark green below the belt, black wings and upper body, nickel
     'wheels': [{'x': FX, 'r': R, 'y': 770}, {'x': RX, 'r': R, 'y': 770}],
     'wheel': {'rim': 0.66, 'style': 'artillery', 'spokes': 12, 'rimMaterial': 'paint', 'cap': 0.2, 'capRings': 1, 'trim': True},   # twelve wooden spokes painted the body green, a nickel ring on the felloe
     'parts': P}
json.dump(M, open(OUT, 'w'), indent=0)
print(OUT, len(P), 'parts;', sum(len(p['outlines']) for p in P), 'outlines; wheels at', FX, RX)
print('outlines pulled onto the drawing, mean move in mm:', SNAP)
print('where a view of the sheet differs from the common box by more than 50 mm (each view keeps its own):'); print('\n'.join('  ' + n for n in notes))
