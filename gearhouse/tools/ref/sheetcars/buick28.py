"""The 1928 four-door sedan (sheet d5f881aa, the left-hand car: a green body under a black upper and fabric roof, black
wings, painted wood-spoke wheels, a spare on the back between two bumperettes) as one 3D part model, made by hand in
the way of tools/ref/sedan29_model.py: every part is a box in the car's space (x from the front bumper back, y from
the centre line outwards, z up; mm) and its outline as the sheet shows it from the side, the front or rear, and above.
Outlines are read off the sheet's views in pixel positions on a 4x enlargement of each view (S side, F front, B rear,
T plan). The body-layer parts are written from scratch; the chassis-layer parts (engine, gearbox, exhaust ... under
the body) are taken from the converter's draft and moved onto this car's wheels.

  python3 buick28.py <views dir> <out json> [draft json] [repository root]"""
import sys, os, json, math
HERE = os.path.dirname(os.path.abspath(__file__))
VIEWS, OUT = sys.argv[1], sys.argv[2]
DRAFT = sys.argv[3] if len(sys.argv) > 3 else f'{HERE}/draft/buick28_auto.json'
REPO = sys.argv[4] if len(sys.argv) > 4 else '/home/user/1/gearhouse'
sys.path.insert(0, f'{REPO}/tools/ref')
import cv2, numpy as np
from zkit import View, fit_closed
from shapely.geometry import Polygon, box as sbox
from shapely.affinity import scale as sscale
from shapely.ops import unary_union


# ---- scale: the wheel centres are at 270 and 1588 on the 4x side view (1318.4 apart), the wheelbase is 2908 mm ----
K = 2908 / 1318.4                                         # mm per unit of the 4x side view (8.82 mm a pixel)
L, H, W = round(1944 * K), round(840 * K), 1950           # side view 486x210 px; width as the draft measured it (front and rear views)
C = W / 2
FX, RX, R = round(270 * K), round(1588.4 * K), round(190 * K)
S = lambda px, py: [round(px * L / 1944), round(H - py * H / 840)]            # side view (486x210 px)
F = lambda dx, py: [round(dx * W / 1020), round(H - py * H / 944)]            # front view (255x236 px): distance from the centre line (510), row
B = lambda dx, py: [round(dx * W / 1036), round(H - py * H / 984)]            # rear view (259x246 px): centre line 518
T = lambda px, dy: [round(px * L / 1828), round(dy * W / 700)]                # plan view (457x175 px): along, distance from the centre line
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

BLK = '#1b1c1d'                                           # the sheet's black (upper body, valance)
WING = '#222225'                                          # the wings' black
TOPC = '#1c1d1e'                                          # the black upper body
GOLD = '#a8a26c'                                          # the belt's two pin stripes
WOOD = '#4a3a30'                                          # the window surrounds
YB = 722                                                  # the body's half width where side-only parts lie

# ---------------- running gear seen from outside ----------------
# the front wing as a band: its top edge and its under edge (side view), read point by point
TWF = ((62, 484), (75, 462), (100, 432), (150, 410), (200, 398), (260, 394), (320, 400), (370, 414), (410, 435), (450, 468), (500, 520), (550, 570), (600, 620), (650, 655), (700, 675), (750, 686), (765, 688))
LWF = ((765, 706), (715, 700), (665, 684), (615, 660), (565, 628), (520, 592), (480, 553), (440, 512), (400, 474), (360, 449), (320, 436), (260, 430), (200, 434), (150, 449), (110, 474), (72, 498))
# the rear wing: outer and inner edge
OWR = ((1362, 692), (1363, 640), (1367, 590), (1380, 540), (1405, 480), (1445, 430), (1495, 395), (1550, 377), (1600, 374), (1650, 382), (1700, 405), (1745, 440), (1780, 480), (1805, 525), (1830, 580), (1855, 630), (1875, 660), (1882, 676))
IWR = ((1868, 680), (1850, 650), (1825, 610), (1800, 565), (1775, 520), (1745, 480), (1705, 445), (1660, 420), (1600, 410), (1530, 420), (1480, 445), (1435, 490), (1405, 540), (1387, 600), (1384, 692))
# the dark under each wing: inside the wing's sweep and behind the tyre
part('house0', 'house', 'black', 'flat', color=BLK, y=[0, 640],
     side=side((86, 500), *[(a, b - 4) for a, b in reversed(LWF[:-1])], (765, 712), (470, 712), (300, 700), (100, 660), (86, 560)))
part('house1', 'house', 'black', 'flat', color=BLK, y=[0, 640],
     side=side(*[(a, b - 4) for a, b in IWR[:-1]], (1384, 700), (1700, 705), (1872, 690)))
part('frame', 'frame', 'black', 'flat', pair=True, color=BLK, side=side((110, 606), (1860, 606), (1860, 640), (110, 640)), front=[F(*q) for q in ((192, 688), (234, 688), (234, 712), (192, 712))], rear='front', top=[T(*q) for q in ((85, 66), (85, 86), (1650, 86), (1650, 66))])
# from in front: the axle beam across under the bumper, the spring and king-pin lumps, the sump's bulge at the centre
part('axleF', 'axle', 'black', 'flat', color=BLK, x=[FX - 40, FX + 40], front=half(*[F(*q) for q in ((0, 806), (364, 800), (364, 848), (250, 850), (60, 850), (48, 858), (0, 860))]))
part('springF', 'spring', 'iron', 'flat', color='#242526', pair=True, x=[FX - 30, FX + 30], front=[F(*q) for q in ((188, 792), (242, 792), (242, 852), (234, 864), (196, 864), (188, 852))])
part('axleR', 'axle', 'black', 'flat', color=BLK, x=[RX - 45, RX + 45], rear=half(*[B(*q) for q in ((0, 812), (366, 812), (366, 850), (252, 850), (240, 870), (72, 870), (50, 890), (0, 893))]))
part('springR', 'spring', 'iron', 'flat', color='#242526', pair=True, x=[RX + 50, RX + 100], rear=[B(*q) for q in ((222, 836), (262, 836), (262, 872), (222, 872))])
tyre0 = [[606, 6], [640, 0], [748, 0], [782, 6], [798, 40], [805, 200], [807, 381], [804, 560], [796, 690], [782, 734], [760, 754], [725, 762], [663, 762], [628, 754], [606, 734], [592, 690], [584, 560], [581, 381], [583, 200], [590, 40]]   # a tyre section face on: flat where it stands, round at the top
def tyre(y0, y1): return [[round(y0 + (q[0] - 581) / 226 * (y1 - y0)), round(q[1] / 762 * 2 * R)] for q in tyre0]
TF = (F(362, 0)[0], F(484, 0)[0]); TR = (B(368, 0)[0], B(484, 0)[0])            # the tyres' inner and outer faces on the front and rear views
part('tyreF', 'wheel', 'rubber', 'fender', x=[FX - R, FX + R], pair=True, front=tyre(*TF), top=[[T(112, 0)[0], TF[0]], [FX + R, TF[0]], [FX + R, T(0, 338)[1]], [T(112, 0)[0], T(0, 338)[1]]], smooth=('front',), detail={'kind': 'treadFace', 'pitch': 36})
part('tyreR', 'wheel', 'rubber', 'fender', x=[RX - R, RX + R], pair=True, rear=tyre(*TR), top=[[RX - R, TR[0]], [T(1640, 0)[0], TR[0]], [T(1640, 0)[0], T(0, 300)[1]], [RX - R, T(0, 300)[1]]], smooth=('rear',), detail={'kind': 'treadFace', 'pitch': 36})
# the hub caps stand out past the front tyres, bright (front view)
part('hubF', 'wheel', 'chrome', 'flat', pair=True, x=[FX - 30, FX + 30], front=ell(F(494, 0)[0], F(0, 740)[1], 22, 42, 12), smooth=('front',))

# ---------------- body ----------------
# the dark between the wings ahead of the hood and beside it (plan); the dark under each wing's nose (front)
part('splash', 'apron', 'black', 'flat', color=BLK, z=[S(0, 700)[1], S(0, 600)[1]], top=halfT((85, 0), (85, 235), (250, 235), (700, 252), (700, 0)),
     front=fhalf((0, 690), (362, 690), (362, 800), (0, 800)))
part('houseF', 'house', 'black', 'flat', color=BLK, pair=True, x=[FX - 60, FX + 60], front=[F(*q) for q in ((300, 572), (366, 572), (366, 712), (228, 712), (236, 690), (262, 640))])
# the valance between the body's sill and the running board, black, its rolled top edge lit
part('apron', 'apron', 'black', 'flat', color=BLK, y=[-700, 700],
     side=side((530, 572), (1384, 572), (1384, 672), (700, 672), (600, 645), (530, 592)),
     top=halfT((700, 0), (700, 290), (1200, 290), (1200, 0)))
part('sill', 'apron', 'paint2', 'flat', color='#4b4c50', on='apron', y=[698, 700], side=side((590, 586), (1356, 586), (1356, 595), (598, 595)), lift=1)
# radiator: a tall nickel shell with a peaked crown and square shoulders; the core runs down behind the lamp bar to the frame
part('shell', 'radiator', 'chrome', 'flat', slot='grille',
     side=side((236, 256), (246, 249), (292, 249), (292, 400), (240, 400), (240, 330), (226, 318), (224, 296), (228, 270)),
     front=fhalf((0, 258), (40, 262), (75, 273), (110, 293), (140, 322), (160, 356), (166, 400), (166, 700), (0, 700)), smooth=('front',),
     top=halfT((183, 0), (183, 75), (193, 112), (208, 130), (247, 135), (247, 0)))
part('core', 'radiator', 'black', 'flat', on='shell', slot='grille', x=[S(238, 0)[0], S(244, 0)[0]], color='#1f1f1f',
     front=fhalf((0, 347), (20, 332), (45, 322), (92, 322), (120, 340), (135, 372), (137, 700), (0, 700)), detail={'kind': 'cells', 'pitch': 26})
part('badgeRim', 'radiator', 'chrome', 'flat', on='shell', slot='grille', x=[S(222, 0)[0], S(226, 0)[0]], front=fhalf((0, 280), (14, 286), (20, 300), (14, 326), (0, 346)), smooth=('front',), lift=1)
part('badge', 'radiator', 'lensR', 'flat', on='shell', slot='grille', color='#8c3048', x=[S(220, 0)[0], S(224, 0)[0]], front=ell(0, F(0, 302)[1], 22, 22, 12), smooth=('front',), lift=2)
# the cap with its winged figure
part('cap', 'radiator', 'chrome', 'flat', slot='grille', smooth=('front',),
     side=side((250, 250), (252, 236), (246, 226), (228, 222), (212, 208), (218, 200), (236, 204), (248, 196), (262, 192), (278, 200), (284, 214), (276, 226), (272, 238), (276, 250)),
     front=fhalf((0, 194), (18, 198), (28, 210), (22, 224), (10, 238), (22, 246), (24, 256), (0, 258)),
     top=[[T(207, 0)[0] + round(math.cos(k / 12 * 6.2832) * 40), round(math.sin(k / 12 * 6.2832) * 40)] for k in range(12)])
part('hood', 'hood', 'paint', 'side', fit=2, nofit=('front', 'top'),
     side=side((292, 251), (500, 249), (692, 248), (692, 572), (292, 572)),
     front=fhalf((0, 258), (75, 272), (140, 302), (200, 296), (262, 296), (300, 312), (312, 350), (312, 700), (0, 700)), smooth=('front',),
     top=halfT((250, 0), (250, 134), (614, 216), (614, 0)),
     feats={'side': [{'kind': 'louvres', 'x0': S(366, 0)[0], 'x1': S(640, 0)[0], 'z0': S(0, 510)[1], 'z1': S(0, 358)[1], 'n': 26, 'slant': 0},
                     {'kind': 'trim', 'pts': side((296, 306), (682, 306)), 'width': 2},
                     {'kind': 'highlight', 'pts': side((298, 286), (500, 284), (680, 282)), 'width': 2}, {'kind': 'highlight', 'pts': side((298, 262), (680, 259)), 'width': 1},
                     {'kind': 'seam', 'pts': side((296, 318), (680, 318))}, {'kind': 'seam', 'pts': side((640, 520), (640, 566), (300, 566))},
                     {'kind': 'bolt', 'at': S(622, 540)},
                     {'kind': 'trim', 'pts': side((686, 252), (686, 570)), 'width': 1}, {'kind': 'trim', 'pts': side((690, 252), (690, 570)), 'width': 1}],   # the bright band where the hood meets the cowl
            'top': [{'kind': 'trim', 'pts': [T(253, 0), T(602, 0)], 'width': 2}, {'kind': 'trim', 'pts': [T(606, -212), T(606, 212)], 'width': 1}, {'kind': 'trim', 'pts': [T(610, -212), T(610, 212)], 'width': 1},
                    {'kind': 'highlight', 'pts': [T(262, -118), T(600, -192)], 'width': 2}, {'kind': 'highlight', 'pts': [T(262, 118), T(600, 192)], 'width': 1}]})
part('cowl', 'cowl', 'paint', 'side', fit=2, nofit=('front', 'top'),
     side=side((692, 250), (760, 246), (792, 239), (824, 239), (824, 572), (692, 572)),
     front=fhalf((0, 213), (100, 220), (200, 235), (272, 250), (325, 262), (346, 285), (353, 320), (353, 440), (0, 440)),
     top=halfT((614, 0), (614, 216), (660, 232), (700, 247), (700, 0)),
     feats={'side': [{'kind': 'highlight', 'pts': side((698, 262), (760, 258), (790, 252)), 'width': 1}, {'kind': 'trim', 'pts': side((752, 279), (822, 277)), 'width': 1}, {'kind': 'trim', 'pts': side((698, 306), (822, 306)), 'width': 1},
                     {'kind': 'highlight', 'pts': side((700, 291), (820, 291)), 'width': 2}, {'kind': 'seam', 'pts': side((700, 318), (700, 566), (818, 566))}],
            'front': [{'kind': 'highlight', 'pts': [F(-262, 262), F(-150, 240), F(0, 228), F(150, 240), F(262, 262)], 'width': 1},
                      {'kind': 'trim', 'pts': [F(351, 333), F(300, 338), F(174, 348)], 'width': 1}, {'kind': 'trim', 'pts': [F(-351, 333), F(-300, 338), F(-174, 348)], 'width': 1},
                      {'kind': 'seam', 'pts': [F(-300, 268), F(-240, 300), F(-176, 346)]}, {'kind': 'seam', 'pts': [F(300, 268), F(240, 300), F(176, 346)]}],
            'top': [{'kind': 'highlight', 'pts': [T(622, -200), T(696, -232)], 'width': 2}]})
# the body: green to the belt; the black upper (bodyTop) lies on it
ARCH = ((1806, 545), (1802, 540), (1778, 500), (1745, 460), (1702, 425), (1655, 400), (1600, 392), (1550, 395), (1512, 408), (1462, 438), (1420, 510), (1395, 572))
BODY_T = ((700, 0), (700, 245), (712, 272), (745, 286), (1590, 286), (1650, 264), (1688, 216), (1700, 150), (1705, 0))
part('body', 'body', 'paint', 'side', fit=2, nofit=('top', 'front', 'rear'),
     side=side((824, 572), (824, 239), (792, 239), (792, 60), (1760, 58), (1790, 64), (1803, 80), (1806, 110), (1806, 255), *ARCH),
     front=fhalf((0, 10), (250, 10), (330, 20), (355, 46), (364, 80), (367, 110), (366, 134), (353, 142), (353, 440), (0, 440)),
     rear=bhalf((0, 8), (250, 8), (330, 20), (378, 48), (400, 86), (408, 150), (406, 190), (398, 200), (398, 400), (390, 470), (380, 560), (358, 650), (336, 706), (0, 706)),
     top=halfT(*BODY_T),
     feats={'side': [{'kind': 'seam', 'pts': side((1160, 276), (1160, 570))}, {'kind': 'seam', 'pts': side((1490, 276), (1490, 420))},
                     {'kind': 'trim', 'pts': side((826, 277), (1740, 275), (1790, 266), (1805, 257)), 'width': 1}, {'kind': 'trim', 'pts': side((826, 306), (1740, 305), (1790, 297), (1805, 290)), 'width': 1},
                     {'kind': 'highlight', 'pts': side((830, 291), (1740, 290), (1796, 280)), 'width': 2},
                     {'kind': 'crease', 'pts': side((834, 562), (1152, 562))}, {'kind': 'crease', 'pts': side((1168, 562), (1392, 562))},
                     {'kind': 'seam', 'pts': side((834, 318), (834, 560))}, {'kind': 'seam', 'pts': side((1150, 318), (1150, 560))}, {'kind': 'seam', 'pts': side((1170, 318), (1170, 560))},
                     {'kind': 'hinge', 'at': S(825, 480)}, {'kind': 'hinge', 'at': S(825, 500)}, {'kind': 'hinge', 'at': S(1490, 328)}, {'kind': 'hinge', 'at': S(1490, 346)}],
            'front': [{'kind': 'seam', 'pts': [F(300, 100), F(300, 250)]}, {'kind': 'seam', 'pts': [F(-300, 100), F(-300, 250)]},
                      {'kind': 'seam', 'pts': [F(332, 146), F(332, 250)]}, {'kind': 'seam', 'pts': [F(-332, 146), F(-332, 250)]}],
            'rear': [{'kind': 'seam', 'pts': [B(323, 350), B(318, 500), B(308, 704)]}, {'kind': 'seam', 'pts': [B(-323, 350), B(-318, 500), B(-308, 704)]},
                     {'kind': 'trim', 'pts': [B(-394, 349), B(-170, 320), B(0, 310), B(170, 320), B(394, 349)], 'width': 1},
                     {'kind': 'highlight', 'pts': [B(-390, 363), B(-170, 334), B(0, 324), B(170, 334), B(390, 363)], 'width': 2}]})
part('bodyTop', 'body', 'paint2', 'side', on='body', color=TOPC, fit=2, nofit=('front', 'rear', 'top'),
     side=side((792, 240), (792, 60), (1760, 58), (1790, 64), (1803, 80), (1806, 110), (1806, 253), (1790, 262), (1740, 271), (790, 273)),
     rear=bhalf((0, 8), (250, 8), (330, 20), (378, 48), (400, 86), (408, 150), (406, 190), (398, 200), (398, 340), (300, 322), (170, 308), (0, 300)),
     top=halfT(*BODY_T),
     feats={'side': [{'kind': 'seam', 'pts': side((1160, 60), (1160, 272))}, {'kind': 'seam', 'pts': side((1490, 60), (1490, 272))}, {'kind': 'seam', 'pts': side((1730, 62), (1730, 270))},
                     {'kind': 'highlight', 'pts': side((1796, 90), (1799, 250)), 'width': 1},
                     {'kind': 'hinge', 'at': S(1490, 92)}, {'kind': 'hinge', 'at': S(1490, 108)}, {'kind': 'hinge', 'at': S(816, 100)}, {'kind': 'hinge', 'at': S(816, 196)}],
            'rear': [{'kind': 'seam', 'pts': [B(323, 70), B(323, 330)]}, {'kind': 'seam', 'pts': [B(-323, 70), B(-323, 330)]},
                     {'kind': 'highlight', 'pts': [B(-300, 100), B(300, 100)], 'width': 1}],
            'top': [{'kind': 'seam', 'pts': [T(1590, -262), T(1590, 262)]}, {'kind': 'highlight', 'pts': [T(1600, -250), T(1660, -215), T(1688, -150)], 'width': 1}]})
# the roof: a black fabric top with a rolled edge, its front peak standing over the screen
ROOFC = '#2c2c2f'
part('roof', 'roof', 'canvas', 'roof', color=ROOFC, fit=2, nofit=('front', 'rear', 'top'),
     side=side((766, 52), (772, 42), (800, 34), (850, 25), (950, 14), (1100, 6), (1300, 3), (1500, 2), (1700, 3), (1750, 8), (1785, 25), (1800, 48), (1806, 80), (1790, 64), (1760, 60), (772, 62)),
     front=fhalf((0, 5), (220, 5), (310, 12), (345, 28), (360, 55), (363, 90), (0, 90)),
     rear=bhalf((0, 5), (250, 6), (330, 18), (380, 48), (405, 88), (386, 96), (330, 76), (0, 70)),
     top=halfT((750, 0), (750, 250), (765, 264), (1560, 264), (1590, 262), (1590, 0)),
     feats={'side': [{'kind': 'highlight', 'pts': side((780, 46), (950, 34), (1300, 26), (1740, 30)), 'width': 2}, {'kind': 'seam', 'pts': side((776, 54), (1760, 52))}],
            'rear': [{'kind': 'highlight', 'pts': [B(-320, 40), B(0, 30), B(320, 40)], 'width': 1}],
            'top': [{'kind': 'highlight', 'pts': [T(770, -256), T(1580, -256)], 'width': 2}, {'kind': 'highlight', 'pts': [T(770, 256), T(1580, 256)], 'width': 1}]})
# the visor: a metal hood hinged under the roof's peak, grey from the side, a dark band from in front
part('visor', 'roof', 'canvas', 'roof', color='#5a5b5c',
     side=side((722, 97), (729, 88), (786, 61), (796, 61), (796, 104), (730, 103)),
     front=fhalf((0, 32), (286, 32), (292, 42), (270, 86), (0, 86)),
     top=halfT((700, 0), (700, 255), (712, 263), (750, 263), (750, 0)),
     feats={'side': [{'kind': 'highlight', 'pts': side((735, 92), (786, 68)), 'width': 1}], 'front': [{'kind': 'highlight', 'pts': [F(-270, 40), F(270, 40)], 'width': 1}]})
# the windscreen: a black frame, one pane; through it the cabin's dark trim with the back window's light in the middle
part('screenFrame', 'screen', 'black', 'flat', on='body', color=BLK, x=[S(792, 0)[0], S(804, 0)[0]], front=fhalf((0, 86), (272, 86), (272, 250), (150, 244), (0, 234)))
SCR = ((0, 100), (256, 100), (256, 240), (150, 233), (0, 223))
part('screen', 'screen', 'glass', 'side', on='screenFrame', x=[S(794, 0)[0], S(802, 0)[0]], front=fhalf(*SCR), lift=1)
ring = [F(*q) for q in ((0, 100), (256, 100), (256, 240), (150, 233), (0, 223), (-150, 233), (-256, 240), (-256, 100), (0, 100), (0, 135), (-168, 135), (-168, 211), (176, 211), (176, 135), (0, 135))]
part('cabinSeen', 'screen', 'canvas', 'flat', on='screenFrame', color='#4b403c', x=[S(900, 0)[0], S(1700, 0)[0]], front=ring, lift=2)
wc, wz = F(155, 0)[0], F(0, 242)[1]
arc = lambda r, rz, a0, a1, n=14: [[round(wc + math.cos(math.radians(a0 + (a1 - a0) * k / n)) * r), round(wz + math.sin(math.radians(a0 + (a1 - a0) * k / n)) * rz)] for k in range(n + 1)]
part('wheelSeen', 'steering', 'wood', 'flat', on='screenFrame', color='#6f5132', x=[S(880, 0)[0], S(950, 0)[0]], lift=3, front=arc(172, 140, 8, 172) + list(reversed(arc(150, 118, 8, 172))))
part('wiper', 'screen', 'chrome', 'flat', on='screenFrame', x=[S(788, 0)[0], S(792, 0)[0]], lift=4, front=[F(*q) for q in ((140, 66), (152, 68), (154, 78), (60, 158), (48, 152))])
# the dashboard's wood, seen through the screen from above
part('dashSeen', 'cowl', 'wood', 'flat', color='#84654c', on='cowl', lift=2, z=[S(0, 262)[1], S(0, 246)[1]], top=halfT((684, 0), (680, 60), (680, 120), (690, 150), (700, 152), (700, 0)))
# side windows: three a side; a moulded black reveal, a wood surround, the glass
WIN = ((838, 64, 1148, 268), (1172, 64, 1484, 268), (1500, 64, 1722, 268))
WOD = ((855, 86, 1118, 250), (1195, 86, 1465, 250), (1518, 86, 1700, 250))
GLS = ((860, 101, 1097, 247), (1203, 102, 1426, 247), (1521, 102, 1627, 238))
for k in range(3):
    a, b, c, d = WOD[k]
    part(f'wframe{k}', 'body', 'paint2', 'side', on='bodyTop', color='#34353a', y=[YB, YB + 2], pair=True, side=srect(*WIN[k], 14))
    part(f'wreveal{k}', 'body', 'black', 'flat', on=f'wframe{k}', color='#141415', y=[YB + 2, YB + 3], pair=True, side=srect(WIN[k][0] + 7, WIN[k][1] + 8, WIN[k][2] - 7, WIN[k][3] - 7, 12), lift=1)
    part(f'wwood{k}', 'body', 'wood', 'flat', on=f'wframe{k}', color=WOOD, y=[YB + 3, YB + 4], pair=True, side=srect(a, b, c, d, 12), lift=2)
    part(f'glass{k}', 'body', 'glass', 'side', on=f'wframe{k}', y=[YB + 4, YB + 5], pair=True, side=srect(*GLS[k], 8), lift=3)
# what shows through the glass: the steering column, the seat backs
SEEN = '#7a5a3a'
part('columnSeen', 'steering', 'wood', 'flat', on='wframe0', color='#6a4530', y=[300, 340], lift=4, side=side((872, 186), (884, 179), (946, 247), (914, 247), (880, 204)))
part('seatSeen0', 'body', 'canvas', 'flat', on='wframe1', color=SEEN, y=[200, 600], lift=4, side=side((1344, 247), (1358, 233), (1384, 222), (1412, 225), (1426, 240), (1426, 247)))
part('seatSeen1', 'body', 'canvas', 'flat', on='wframe2', color=SEEN, y=[200, 600], lift=4, side=side((1596, 250), (1608, 238), (1640, 231), (1680, 236), (1696, 250)))
# door handles: bright bars either side of the centre pillar, their roses towards the pillar; a knob from in front and behind
part('handle0', 'body', 'chrome', 'flat', on='body', pair=True, lift=3, smooth=('front',),
     side=side((1073, 327), (1114, 326), (1117, 319), (1135, 319), (1138, 348), (1118, 350), (1115, 342), (1073, 340)),
     front=[F(*q) for q in ((350, 322), (361, 320), (365, 330), (361, 340), (350, 338))])
part('handle1', 'body', 'chrome', 'flat', on='body', pair=True, lift=3, smooth=('rear',),
     side=side((1172, 319), (1192, 319), (1195, 327), (1237, 328), (1237, 341), (1195, 342), (1192, 350), (1172, 350)),
     rear=[B(*q) for q in ((396, 372), (406, 370), (410, 381), (406, 392), (396, 390))])
# cowl lamps: small nickel torpedoes on the cowl's shoulders
part('cowlLamp', 'lamp', 'chrome', 'fender', on='cowl', lift=3, pair=True, smooth=('side', 'front', 'top'),
     side=side((720, 268), (728, 257), (738, 254), (748, 262), (751, 280), (746, 296), (736, 302), (726, 296), (721, 282)),
     front=ell(F(290, 0)[0], F(0, 300)[1], F(21, 0)[0], round(21 * H / 944), 14), top=[[T(670, 0)[0] + round(math.cos(k / 10 * 6.2832) * 36), T(0, 226)[1] + round(math.sin(k / 10 * 6.2832) * 30)] for k in range(10)])
# the back window: a moulded frame, a wood surround, the glass
part('rearFrame', 'body', 'paint2', 'side', on='bodyTop', color='#34353a', x=[S(1800, 0)[0], S(1806, 0)[0]], rear=rrect(B(-202, 0)[0], B(0, 282)[1], B(202, 0)[0], B(0, 124)[1], 40))
part('rearWood', 'body', 'wood', 'flat', on='rearFrame', color=WOOD, x=[S(1798, 0)[0], S(1806, 0)[0]], rear=rrect(B(-190, 0)[0], B(0, 270)[1], B(190, 0)[0], B(0, 136)[1], 26), lift=1)
part('rearGlass', 'body', 'glass', 'side', on='rearFrame', x=[S(1798, 0)[0], S(1804, 0)[0]], rear=rrect(B(-164, 0)[0], B(0, 251)[1], B(170, 0)[0], B(0, 157)[1], 10), lift=2)
part('rearApron', 'body', 'black', 'flat', color=BLK, x=[S(1700, 0)[0], S(1800, 0)[0]], rear=bhalf((0, 700), (338, 700), (366, 734), (366, 830), (0, 830)))

# ---------------- wings, boards ----------------
part('fenderF', 'fenderF', 'paint2', 'fender', color=WING, slot='fenderF', pair=True, x=[S(62, 0)[0], S(765, 0)[0]], cutWheel={'i': 0, 'r': R + 8}, smooth=('front', 'side', 'top'),
     side=side(*TWF, *LWF),
     front=[F(*q) for q in ((330, 442), (390, 427), (450, 426), (485, 438), (503, 465), (506, 540), (496, 565), (470, 576), (380, 576), (350, 560), (336, 520))],
     top=[T(*q) for q in ((97, 300), (108, 335), (150, 348), (420, 350), (600, 337), (700, 326), (700, 250), (615, 222), (450, 206), (330, 205), (240, 208), (150, 216), (108, 232), (97, 262))],
     feats={'side': [{'kind': 'highlight', 'pts': side(*[(a, b + 9) for a, b in TWF[1:-1]]), 'width': 2}],
            'front': [{'kind': 'highlight', 'pts': [F(*q) for q in ((345, 446), (392, 436), (450, 435), (482, 446), (496, 468))], 'width': 2}, {'kind': 'highlight', 'pts': [F(*q) for q in ((370, 556), (430, 562), (480, 556))], 'width': 1}],
            'top': [{'kind': 'highlight', 'pts': [T(*q) for q in ((130, 322), (300, 332), (500, 330), (690, 312))], 'width': 2}]})
# the front wing's inner skirt, sweeping from the crown in and down to the frame beside the radiator (front view)
part('sweepF', 'fenderF', 'paint2', 'fender', color=WING, slot='fenderF', pair=True, x=[S(225, 0)[0], S(540, 0)[0]],
     front=[F(*q) for q in ((322, 446), (346, 470), (346, 562), (300, 604), (240, 702), (204, 702), (204, 672), (262, 560), (300, 482))],
     feats={'front': [{'kind': 'highlight', 'pts': [F(*q) for q in ((338, 474), (296, 548), (222, 690))], 'width': 1}]})
part('fenderR', 'fenderR', 'paint2', 'fender', color=WING, slot='fenderR', pair=True, cutWheel={'i': 1, 'r': R + 8}, smooth=('rear', 'side', 'top'),
     side=side(*OWR, *IWR),
     rear=[B(*q) for q in ((392, 724), (392, 472), (415, 463), (480, 462), (504, 478), (516, 520), (516, 700), (502, 724))],
     top=[T(*q) for q in ((1200, 320), (1215, 336), (1300, 348), (1500, 348), (1560, 336), (1650, 304), (1690, 264), (1700, 216), (1688, 216), (1650, 264), (1590, 286), (1200, 290))],
     feats={'side': [{'kind': 'highlight', 'pts': side(*[(a + (8 if a < 1500 else -4 if a > 1700 else 0), b + 9) for a, b in OWR[3:-2]]), 'width': 2}],
            'rear': [{'kind': 'highlight', 'pts': [B(*q) for q in ((406, 476), (420, 470), (478, 470), (498, 484))], 'width': 2}],
            'top': [{'kind': 'highlight', 'pts': [T(*q) for q in ((1230, 330), (1400, 338), (1560, 326))], 'width': 2}]})
# the running board: a black board, a speckled tread edge, a bright nickel edge strip its whole length
part('board', 'board', 'black', 'flat', color='#77757a', slot='board', pair=True, side=side((700, 668), (1368, 668), (1368, 684), (700, 684)), top=[T(*q) for q in ((712, 292), (712, 324), (1196, 324), (1196, 292))])
part('boardTrim', 'board', 'chrome', 'flat', on='board', slot='board', pair=True, y=[T(0, 318)[1], T(0, 324)[1]], side=side((766, 684), (1360, 684), (1360, 703), (766, 703)), lift=1)
part('step0', 'board', 'iron', 'flat', on='board', slot='board', pair=True, x=[T(720, 0)[0], T(1190, 0)[0]], z=[S(0, 672)[1], S(0, 668)[1]], top=[T(*q) for q in ((720, 298), (720, 318), (1190, 318), (1190, 298))], color='#858388', lift=1)

# ---------------- lamps ----------------
# big nickel drum headlamps on a bar across the radiator; from the side their lower half is behind the wing
LZ = F(0, 447)[1]; LY = F(225, 0)[0]
part('lamp', 'lamp', 'chrome', 'fender', slot='lamp', pair=True, smooth=('side', 'top'),
     side=side((140, 334), (150, 324), (170, 322), (184, 335), (192, 362), (194, 397), (192, 432), (184, 460), (170, 472), (150, 472), (140, 464)),
     front=ell(LY, LZ, F(81, 0)[0], round(81 * H / 944)),
     top=[T(*q) for q in ((118, 95), (122, 91), (140, 91), (152, 100), (163, 125), (166, 153), (163, 181), (152, 206), (140, 215), (122, 215), (118, 211))])
part('lampGap', 'lamp', 'iron', 'flat', on='lamp', slot='lamp', pair=True, x=[S(138, 0)[0], S(142, 0)[0]], smooth=('front',), front=ell(LY, LZ, F(72, 0)[0], round(72 * H / 944)))
part('lens', 'lamp', 'chrome', 'flat', on='lampGap', slot='lamp', pair=True, x=[S(137, 0)[0], S(141, 0)[0]], smooth=('front',), front=ell(LY, LZ, F(68, 0)[0], round(68 * H / 944)), detail={'kind': 'bowl'})
part('lampBar', 'lamp', 'chrome', 'flat', slot='lamp', x=[S(200, 0)[0], S(214, 0)[0]], front=fhalf((0, 543), (206, 543), (206, 557), (0, 557)), top=halfT((228, 0), (228, 150), (236, 150), (236, 0)))
part('lampStand', 'lamp', 'chrome', 'flat', slot='lamp', pair=True, side=side((192, 346), (224, 350), (224, 378), (192, 384)), front=[F(*q) for q in ((214, 524), (236, 524), (240, 562), (210, 562))])

# ---------------- bumpers ----------------
# front: two flat nickel bars right across, three clamps; back: a pair of two-bar bumperettes either side of the spare
for k, (ps, pf, pr) in enumerate(((607, 723, 750), (666, 777, 798))):
    part(f'bumperF{k}', 'bumperF', 'chrome', 'fender', slot='bumperF', side=side((2, ps - 17), (46, ps - 17), (52, ps), (46, ps + 17), (2, ps + 17)),
         front=fhalf((0, pf - 15), (424, pf - 15), (436, pf - 8), (436, pf + 8), (424, pf + 15), (0, pf + 15)),
         top=halfT((4, 0), (4, 258), (10, 278), (30, 290), (56, 293), (56, 279), (42, 272), (36, 255), (35, 0)))
    inner = (218, 235) if k == 0 else (193, 212)
    part(f'bumperR{k}', 'bumperR', 'chrome', 'fender', slot='bumperR', pair=True, side=side((1890, ps - 17), (1942, ps - 17), (1942, ps + 17), (1890, ps + 17)),
         rear=[B(*q) for q in ((inner[0], pr + 14), (inner[1], pr - 13), (506, pr - 13), (516, pr), (506, pr + 14))],
         top=[T(*q) for q in ((1728, 163), (1752, 163), (1756, 230), (1746, 262), (1720, 285), (1668, 300), (1652, 296), (1660, 283), (1705, 270), (1725, 250), (1730, 225))])
part('clampF0', 'bumperF', 'chrome', 'flat', on='bumperF0', slot='bumperF', pair=True, x=[0, 30], front=[F(*q) for q in ((210, 704), (240, 704), (242, 796), (208, 796))], lift=1)
part('clampFC', 'bumperF', 'chrome', 'flat', on='bumperF0', slot='bumperF', x=[0, 30], front=fhalf((0, 698), (18, 700), (22, 712), (22, 792), (14, 806), (0, 808)), lift=1)
part('clampR0', 'bumperR', 'chrome', 'flat', on='bumperR0', slot='bumperR', pair=True, x=[S(1900, 0)[0], S(1944, 0)[0]], rear=[B(*q) for q in ((311, 728), (335, 728), (337, 820), (309, 820))], lift=1)
part('ironF', 'bumperF', 'black', 'flat', color=BLK, slot='bumperF', pair=True, y=[T(0, 66)[1], T(0, 86)[1]], side=side((50, 612), (104, 606), (108, 650), (50, 662)), lift=1)
# the bumper's two bright stays, waisted like spools (plan)
part('stayF', 'bumperF', 'chrome', 'flat', slot='bumperF', pair=True, z=[S(0, 640)[1], S(0, 610)[1]], top=[T(*q) for q in ((30, 66), (44, 68), (60, 72), (76, 66), (86, 66), (86, 88), (76, 88), (60, 82), (44, 86), (30, 88))])
part('ironR', 'bumperR', 'black', 'flat', color=BLK, slot='bumperR', pair=True, side=side((1852, 612), (1890, 608), (1890, 652), (1852, 656)), top=[T(*q) for q in ((1610, 205), (1610, 221), (1730, 221), (1730, 205))])
# one tail lamp, on the left wing's shoulder, over a framed number plate (rear view)
part('tailRim', 'tail', 'chrome', 'fender', slot='tail', smooth=('rear',), x=[S(1850, 0)[0], S(1860, 0)[0]], rear=ell(B(383, 0)[0], B(0, 545)[1], B(35, 0)[0], round(35 * H / 984)))
part('tail', 'tail', 'lensR', 'flat', on='tailRim', slot='tail', smooth=('rear',), x=[S(1852, 0)[0], S(1862, 0)[0]], rear=ell(B(383, 0)[0], B(0, 545)[1], B(25, 0)[0], round(25 * H / 984)), lift=1)
part('plateRim', 'tail', 'chrome', 'flat', slot='tail', x=[S(1856, 0)[0], S(1862, 0)[0]], rear=rrect(B(270, 0)[0], B(0, 703)[1], B(485, 0)[0], B(0, 594)[1], 12))
part('plate', 'tail', 'black', 'flat', color='#151516', on='plateRim', slot='tail', x=[S(1858, 0)[0], S(1864, 0)[0]], rear=rrect(B(290, 0)[0], B(0, 684)[1], B(465, 0)[0], B(0, 613)[1], 6), lift=1)
# the spare on the back: edge on from the side and above (the road tyres' own section), a wheel from behind
def tyre_section(u0, u1, v0, v1, across_first=True):
    lo_u, hi_u = 581, 807; hi_v = 762
    return [[round(u0 + (q[0] - lo_u) / (hi_u - lo_u) * (u1 - u0)), round(v0 + q[1] / hi_v * (v1 - v0))] if across_first else
            [round(v0 + q[1] / hi_v * (v1 - v0)), round(u0 + (q[0] - lo_u) / (hi_u - lo_u) * (u1 - u0))] for q in tyre0]
part('spareCarrier', 'spare', 'black', 'flat', color=BLK, side=side((1800, 440), (1814, 440), (1814, 560), (1800, 560)), top=halfT((1698, 0), (1698, 60), (1726, 60), (1726, 0)))
part('spare', 'spare', 'rubber', 'fender', wheel={'r': round(228 * H / 984)},
     side=tyre_section(S(1808, 0)[0], S(1920, 0)[0], S(0, 686)[1], S(0, 285)[1]), rear=ell(0, B(0, 605)[1], B(228, 0)[0], round(228 * H / 984)),
     top=tyre_section(T(1722, 0)[0], T(1840, 0)[0], -T(0, 165)[1], T(0, 165)[1]), smooth=('side', 'top'), detail={'kind': 'treadFace', 'pitch': 40})

# ---------------- the chassis under the body: the draft's chassis-layer parts moved onto this car's wheels ----------------
D = json.load(open(DRAFT)); dw = D['wheels']; kx = (RX - FX) / (dw[1]['x'] - dw[0]['x']); ky = W / D['width']; kz = H / D['height']
mx = lambda v: round(FX + (v - dw[0]['x']) * kx); my = lambda v: round(v * ky); mz = lambda v: round(v * kz)
for p in D['parts']:
    if p.get('layer') != 'chassis': continue
    q = json.loads(json.dumps(p)); b = q['box']; q['box'] = {'x': [mx(b['x'][0]), mx(b['x'][1])], 'y': [my(b['y'][0]), my(b['y'][1])], 'z': [mz(b['z'][0]), mz(b['z'][1])]}
    for v, sb in q.get('sheet', {}).items():
        fa, fb = {'side': (mx, mz), 'front': (my, mz), 'rear': (my, mz), 'top': (mx, my)}[v]; q['sheet'][v] = [fa(sb[0]), fa(sb[1]), fb(sb[2]), fb(sb[3])]
    P.append(q)

M = {'id': 'buick28', 'name': '1928 four-door sedan', 'year': 1928, 'length': L, 'width': W, 'height': H,
     'paint': '#22301f', 'paint2': '#222225', 'canvas': ROOFC, 'chrome': '#b4b1b1', 'glassTint': '#b8bdc5',
     'wheels': [{'x': FX, 'r': R, 'y': 790}, {'x': RX, 'r': R, 'y': 790}],
     'wheel': {'rim': 0.66, 'style': 'artillery', 'spokes': 16, 'rimMaterial': 'paint', 'cap': 0.22, 'capRings': 1, 'trim': True},   # wooden-spoke wheels painted the body's green, a bright rim edge, a nickel hub cap
     'parts': P}
json.dump(M, open(OUT, 'w'), indent=0)
print(OUT, len(P), 'parts;', sum(len(p['outlines']) for p in P), 'outlines')
print('size', L, W, H, 'wheels', FX, RX, R)
print('outlines pulled onto the drawing, mean move in mm:', SNAP)
print('where a view of the sheet differs from the common box by more than 50 mm (each view keeps its own):'); print('\n'.join('  ' + n for n in notes))
