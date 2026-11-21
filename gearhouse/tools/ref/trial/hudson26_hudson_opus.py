"""The 1926 large sedan (sheet: the right-hand car) as one 3D part model, made by hand in the manner of
tools/ref/sedan29_model.py (review 62, the direct method). Every part is one box in the car's space (x from the front
bumper back, y from the centre line outwards, z up; mm) and its outline from the side, front, rear and above, read off
this car's own cut views (pixel positions on the 4x enlargement of each view) and pulled onto the drawing's lines where
`fit=` is given. Scale: the wheelbase (3235 mm) over the side view's hub centres gives 9.80 mm a pixel.

What this car has that the 1929 template has not: a black leather-covered upper body (the whole greenhouse above the
belt is one black part, `roof`), three side windows, a sun visor over the screen, a tall arched nickel shell with a
badge, cowl lamps, black lamp bowls with nickel rims on stands, split rear bumperettes, one tail lamp (left), artillery
wheels. What it lacks: the lamp tie-bar, the rear plate lamp, rear handle and rear-window bar, the screen side strip.

  python3 hudson26.py <views dir> <out json>
then (as for the template) npx tsx tools/ref/modelviews.ts <json> <dir> and python3 tools/ref/modelshade.py <json> <views dir> <dir>,
which adds the read-off light (part.shade) to the json; work/run.sh in this folder does the whole chain."""
import sys, os, json, math
sys.path.insert(0, '/home/user/1/gearhouse/tools/ref')
import cv2, numpy as np
from zkit import View, fit_closed
from shapely.geometry import Polygon, box as sbox
from shapely.affinity import scale as sscale
from shapely.ops import unary_union
VIEWS, OUT = sys.argv[1], sys.argv[2]
WORK = os.path.join(os.path.dirname(os.path.abspath(OUT)), 'work'); os.makedirs(WORK, exist_ok=True)
L, W, H, C = 4725, 1870, 1961, 935
FX, RX, R, TRACK = 599, 3835, 441, 765
# the four views, each spanning the model's box (side L x H, front and rear W x H, plan L x W), on their 4x enlargement
S = lambda px, py: [round(px * 2.4507), round(H - py * 2.4513)]               # side: pixel column, row
F = lambda dx, py: [round(dx * 2.0064), round(H - py * 2.0599)]               # front: distance from the centre line (x 466), row
B = lambda dx, py: [round(dx * 2.1250), round(H - py * 2.1047)]               # rear: distance from the centre line (x 440), row
T = lambda px, dy: [round(px * 2.4156), round(dy * 2.6264)]                   # plan: column, distance from the centre line (y 356)
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
    """a rounded window read in side pixels (left, top, right, bottom) with its corner radius in pixels"""
    (x0, z1), (x1, z0) = S(a, b), S(c, d); return rrect(x0, z0, x1, z1, round(r * 2.45))

def _view(name, w, h):
    t = f'{WORK}/_fit_{name}.png'; cv2.imwrite(t, cv2.resize(cv2.imread(f'{VIEWS}/v_{name}.png', cv2.IMREAD_UNCHANGED), (round(w / 10), round(h / 10)), interpolation=cv2.INTER_AREA)); V = View(t, w); V.edge = np.maximum(V.sil * 3, V.grad); return V
FIT = {'side': _view('left', L, H), 'front': _view('front', W, H), 'rear': _view('rear', W, H), 'top': _view('top', L, W)}
SNAP = {}
def snap(view, pts, reach):
    across = view != 'side'; k = 1 if view == 'top' else 0
    lo, hi = min(p[k] for p in pts), max(p[k] for p in pts); centred = across and abs(lo + hi) < 30 and lo < -20
    q = [[p[0] + (C if across and k == 0 else 0), p[1] + (C if across and k == 1 else 0)] for p in pts]
    if view == 'rear': q = [[2 * C - x, z] for x, z in q]                          # the rear view is seen mirrored: +y lies left of the picture's centre
    f, moved = fit_closed(FIT[view], [[x, z, 1] for x, z in q], FIT[view].edge, reach=reach, floor=25)
    if view == 'rear': f = [[2 * C - x, z, s] for x, z, s in f]
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
for i, wx in enumerate((FX, RX)):
    part(f'house{i}', 'house', 'black', 'flat', y=[0, 640], side=[[wx - 480, 470]] + [[round(wx + math.cos(a) * 480), round(441 + math.sin(a) * 480)] for a in [math.pi * k / 14 for k in range(14, -1, -1)]] + [[wx + 480, 470]])
part('frame', 'frame', 'black', 'flat', pair=True, side=[[180, 480], [4480, 480], [4480, 610], [180, 610]], front=[[400, 480], [475, 480], [475, 610], [400, 610]], rear='front', top=[[180, 400], [4480, 400], [4480, 475], [180, 475]])
part('axleF', 'axle', 'black', 'flat', x=[560, 640], front=half([0, 400], [700, 400], [700, 470], [610, 470], [570, 440], [0, 440]))
part('springF', 'spring', 'iron', 'flat', x=[570, 630], front=half([0, 600], [130, 590], [440, 520], [610, 470], [610, 500], [440, 550], [130, 625], [0, 635]))
part('axleR', 'axle', 'black', 'flat', x=[3790, 3880], rear=half([0, 300], [130, 310], [185, 390], [700, 405], [700, 480], [185, 495], [130, 575], [0, 585]), smooth=('rear',))
part('springR', 'spring', 'iron', 'flat', x=[3900, 3970], rear=half([0, 650], [130, 640], [460, 560], [640, 495], [640, 525], [460, 595], [130, 675], [0, 685]))
tyre = [[606, 6], [640, 0], [748, 0], [782, 6], [798, 40], [805, 200], [807, 381], [804, 560], [796, 690], [782, 734], [760, 754], [725, 762], [663, 762], [628, 754], [606, 734], [592, 690], [584, 560], [581, 381], [583, 200], [590, 40]]   # the template's balloon section, face on
def tyre_section(u0, u1, v0, v1, across_first=True):
    lo_u, hi_u = min(q[0] for q in tyre), max(q[0] for q in tyre); hi_v = max(q[1] for q in tyre)
    return [[round(u0 + (q[0] - lo_u) / (hi_u - lo_u) * (u1 - u0)), round(v0 + q[1] / hi_v * (v1 - v0))] if across_first else
            [round(v0 + q[1] / hi_v * (v1 - v0)), round(u0 + (q[0] - lo_u) / (hi_u - lo_u) * (u1 - u0))] for q in tyre]
# face on the tyres are narrow and tall (front sheet: 326..446 px from the centre, rear sheet: 305..405)
yf0, yf1 = F(328, 0)[0], F(446, 0)[0]; yr0, yr1 = B(305, 0)[0], B(406, 0)[0]
part('tyreF', 'wheel', 'rubber', 'fender', x=[FX - R, FX + R], pair=True, front=tyre_section(yf0, yf1, 0, 2 * R), top=[[FX - R, yf0], [FX + R, yf0], [FX + R, yf1], [FX - R, yf1]], smooth=('front',), detail={'kind': 'treadFace', 'pitch': 40})
part('tyreR', 'wheel', 'rubber', 'fender', x=[RX - R, RX + R], pair=True, rear=tyre_section(yr0, yr1, 0, 2 * R), top=[[RX - R, yr0], [RX + R, yr0], [RX + R, yr1], [RX - R, yr1]], smooth=('rear',), detail={'kind': 'treadFace', 'pitch': 40})

# ---------------- body ----------------
# the black splash aprons between the frame and the front wings: from in front the inner valance runs down diagonally
# from beside the lamp to the bottom of the shell (front sheet), and below the bumper the frame horns show
part('splash', 'apron', 'black', 'flat', x=[620, 1700], top=halfT([150, 0], [150, 640], [1400, 640], [1700, 720], [1700, 0]),
     front=fhalf((0, 700), (181, 712), (300, 535), (330, 525), (330, 640), (326, 790), (300, 838), (250, 842), (200, 812), (0, 812)))
part('crossF', 'frame', 'black', 'flat', x=[180, 560], z=[300, 420], top=halfT([180, 0], [180, 470], [260, 470], [260, 0]), front=half([0, 300], [610, 300], [610, 420], [0, 420]))
part('apron', 'apron', 'black', 'flat', y=[-700, 700], side=side((440, 548), (1420, 548), (1420, 648), (440, 648)), top=thalf((570, 0), (570, 270), (1395, 270), (1395, 0)))
part('shell', 'radiator', 'chrome', 'flat', slot='grille', fit=3, nofit=('top',),
     side=side((214, 266), (220, 256), (232, 252), (252, 252), (262, 258), (264, 266), (264, 470), (214, 470)),
     front=fhalf((0, 312), (40, 315), (80, 326), (112, 345), (136, 370), (150, 400), (154, 430), (154, 694), (148, 708), (130, 713), (0, 714)), smooth=('front',),
     top=thalf((158, 0), (158, 104), (166, 110), (205, 110), (205, 0)))
part('lip', 'radiator', 'iron', 'flat', on='shell', slot='grille', x=[525, 545], front=fhalf((0, 362), (60, 368), (100, 382), (124, 402), (134, 428), (135, 690), (128, 697), (0, 698)), smooth=('front',))
part('core', 'radiator', 'black', 'flat', on='lip', slot='grille', x=[525, 543], front=fhalf((0, 372), (60, 378), (98, 391), (120, 410), (129, 432), (129, 686), (0, 687)), smooth=('front',), detail={'kind': 'flutes', 'pitch': 24})
part('badge', 'radiator', 'chrome', 'flat', on='shell', slot='grille', x=[515, 525], front=fhalf((0, 330), (14, 334), (24, 346), (26, 362), (20, 378), (0, 392)), smooth=('front',))
part('badgeR', 'radiator', 'lensR', 'flat', on='badge', slot='grille', x=[512, 522], front=ell(0, F(0, 360)[1], 26, 34), smooth=('front',))
part('cap', 'radiator', 'chrome', 'flat', on='shell', slot='grille', side=side((228, 252), (222, 238), (220, 214), (226, 200), (240, 196), (256, 200), (262, 214), (258, 238), (254, 252)),
     front=fhalf((0, 302), (14, 300), (16, 270), (22, 250), (18, 236), (0, 234)), top=thalf((172, 0), (172, 12), (196, 12), (196, 0)))
part('hood', 'hood', 'paint', 'side', fit=3, nofit=('front',),
     side=side((264, 254), (604, 249), (606, 549), (264, 549)),
     front=fhalf((0, 298), (150, 300), (215, 312), (238, 335), (244, 360), (244, 600), (0, 600)), smooth=('front',),
     top=thalf((205, 0), (205, 106), (566, 172), (566, 0)),
     feats={'side': [{'kind': 'louvres', 'x0': S(318, 0)[0], 'x1': S(562, 0)[0], 'z0': S(0, 350)[1], 'z1': S(0, 492)[1], 'n': 12, 'slant': 0},
                     {'kind': 'highlight', 'pts': side((268, 292), (440, 290), (600, 288)), 'width': 1}],
            'top': [{'kind': 'trim', 'pts': [T(206, 0), T(566, 0)], 'width': 1}]})
part('cowl', 'cowl', 'paint', 'side', fit=3, nofit=('front',),
     side=side((604, 249), (680, 246), (716, 244), (742, 252), (744, 286), (746, 549), (606, 549)),
     front=fhalf((0, 294), (200, 296), (300, 300), (330, 320), (336, 360), (336, 600), (0, 600)), smooth=('front',),
     top=thalf((566, 0), (566, 172), (660, 194), (660, 0)))
part('body', 'body', 'paint', 'side', fit=3,
     side=side((742, 270), (1818, 270), (1818, 470), (1814, 560), (746, 549), (744, 286)),
     front=fhalf((0, 292), (330, 292), (344, 304), (348, 330), (348, 480), (348, 712), (0, 712)),
     rear=bhalf((0, 318), (356, 318), (362, 340), (362, 560), (356, 594), (338, 610), (300, 616), (0, 617)), nofit=('front',),
     top=thalf((648, 0), (648, 250), (690, 292), (1836, 292), (1846, 270), (1848, 0)),
     feats={'side': [{'kind': 'seam', 'pts': side((755, 286), (755, 544))}, {'kind': 'seam', 'pts': side((1082, 286), (1082, 546))}, {'kind': 'seam', 'pts': side((1380, 286), (1380, 400), (1372, 440), (1354, 480), (1342, 546))},
                     {'kind': 'bead', 'pts': side((746, 290), (1300, 290), (1816, 290))}, {'kind': 'highlight', 'pts': side((750, 300), (1812, 300)), 'width': 1},
                     {'kind': 'handle', 'at': S(1042, 320), 'len': 150}, {'kind': 'handle', 'at': S(1122, 320), 'len': 150}],
            'rear': [{'kind': 'seam', 'pts': [B(-255, 335), B(-255, 600)]}, {'kind': 'seam', 'pts': [B(255, 335), B(255, 600)]},
                     {'kind': 'highlight', 'pts': [B(-340, 360), B(-330, 560)], 'width': 1}]})
# the whole upper body above the belt is black (leather-covered, like the cap): one part from the side, the front, the
# rear and above, with the windows and the screen lying on it
part('roof', 'roof', 'canvas', 'roof', color='#1d1d1e', fit=3, nofit=('front', 'rear'),
     side=side((700, 40), (760, 26), (900, 15), (1100, 8), (1400, 4), (1700, 4), (1790, 10), (1815, 24), (1826, 46), (1822, 72), (1818, 100), (1818, 262), (1826, 278), (1826, 288), (744, 288), (742, 252), (730, 110), (716, 92)),
     front=fhalf((0, 4), (200, 6), (300, 14), (338, 30), (352, 48), (356, 62), (350, 76), (346, 100), (346, 296), (0, 296)),
     rear=bhalf((0, 4), (220, 6), (300, 12), (340, 24), (362, 44), (370, 62), (365, 76), (362, 300), (370, 318), (372, 336), (364, 346), (0, 346)),
     smooth=('top', 'front', 'rear'), top=thalf((652, 0), (652, 190), (662, 235), (688, 265), (730, 280), (790, 285), (1770, 285), (1802, 278), (1818, 258), (1824, 220), (1824, 0)),
     feats={'side': [{'kind': 'highlight', 'pts': side((760, 30), (1100, 12), (1700, 8)), 'width': 1}],
            'front': [{'kind': 'highlight', 'pts': [F(-330, 40), F(0, 34), F(330, 40)], 'width': 1}]})
part('visor', 'roof', 'canvas', 'roof', color='#2b2c2c', on='roof', smooth=('front',),
     side=side((650, 78), (660, 66), (690, 44), (712, 40), (716, 90), (700, 90), (670, 88), (652, 85)),
     front=fhalf((0, 53), (284, 53), (288, 58), (264, 104), (0, 107)))
part('screenFrame', 'screen', 'black', 'flat', on='roof', x=[1720, 1760], front=fhalf((0, 108), (266, 108), (266, 290), (0, 290)))
part('screen', 'screen', 'glass', 'side', on='screenFrame', x=[1722, 1762], front=fhalf((0, 143), (222, 143), (222, 262), (0, 262)))
part('screenBar', 'screen', 'black', 'flat', on='screen', x=[1716, 1762], front=[F(67, 143), F(111, 143), F(111, 262), F(67, 262)])   # the screen's divider sits right of the centre on the sheet
# three side windows, each a wood garnish round its glass (side sheet: openings 780..1060, 1110..1360, 1395..1685 px)
for k, (a, c) in enumerate(((780, 1060), (1110, 1360), (1395, 1685))):
    part(f'wframe{k}', 'body', 'wood', 'side', on='roof', color='#4a2c22', y=[750, 752], pair=True, side=srect(a, 64, c, 270, 14))
    part(f'glass{k}', 'body', 'glass', 'side', on=f'wframe{k}', fit=2, y=[752, 754], pair=True, side=srect(a + 8, 72, c - 8, 246, 10))
part('rearGlass', 'body', 'glass', 'side', on='roof', x=[4560, 4566], rear=bhalf((0, 96), (186, 96), (196, 104), (198, 120), (198, 252), (190, 266), (176, 270), (0, 270)))
part('rearApron', 'body', 'black', 'flat', x=[4440, 4460], rear=bhalf((0, 600), (356, 600), (356, 700), (300, 800), (210, 806), (0, 806)))
part('cowlLamp', 'lamp', 'chrome', 'fender', slot='lamp', pair=True, x=[1600, 1660], y=[720, 780], smooth=('side', 'front'), side=ell(S(754, 0)[0], S(0, 316)[1], 22, 42),
     front=[F(*q) for q in ((290, 340), (300, 336), (350, 337), (356, 344), (356, 354), (350, 360), (300, 361), (290, 356))])

# ---------------- wings, boards ----------------
part('fenderF', 'fenderF', 'paint2', 'fender', fit=3, nofit=('top',), slot='fenderF', pair=True, cutWheel={'i': 0, 'r': 462}, smooth=('front', 'top'),
     side=side((50, 500), (54, 480), (70, 455), (100, 426), (150, 397), (200, 385), (245, 381), (300, 387), (350, 403), (400, 428), (450, 466), (490, 506), (522, 548), (560, 588), (600, 618), (645, 638), (692, 646), (694, 668), (600, 664), (520, 640), (430, 668), (244, 700), (75, 520), (60, 512)),
     front=[F(*q) for q in ((280, 540), (286, 508), (304, 485), (334, 470), (372, 465), (410, 468), (440, 480), (460, 502), (466, 540), (462, 580), (448, 602), (414, 614), (370, 616), (326, 610), (296, 596), (282, 572))],
     top=[T(q[0], 356 - q[1]) for q in ((62, 60), (75, 25), (110, 8), (200, 4), (560, 7), (566, 20), (566, 110), (300, 112), (150, 125), (100, 140), (68, 140))],
     feats={'side': [{'kind': 'highlight', 'pts': side((70, 462), (120, 420), (200, 394), (300, 396), (400, 438), (470, 494)), 'width': 2}],
            'front': [{'kind': 'highlight', 'pts': [F(*q) for q in ((300, 490), (330, 478), (380, 474), (430, 480))], 'width': 2}],
            'top': [{'kind': 'highlight', 'pts': [T(120, 320), T(300, 336), T(460, 324)], 'width': 2}]})
part('fenderR', 'fenderR', 'paint2', 'fender', fit=3, slot='fenderR', pair=True, cutWheel={'i': 1, 'r': 462}, smooth=('rear', 'top'),
     side=side((1338, 668), (1342, 610), (1356, 550), (1385, 490), (1430, 437), (1490, 397), (1565, 372), (1640, 380), (1700, 410), (1750, 454), (1788, 512), (1812, 575), (1828, 625), (1836, 650), (1826, 662), (1800, 655), (1760, 640), (1565, 700), (1400, 668)),
     rear=[B(*q) for q in ((355, 510), (372, 488), (400, 479), (426, 484), (438, 502), (440, 530), (440, 750), (432, 780), (406, 792), (372, 790), (355, 776))],
     top=[T(*q) for q in ((1348, 296), (1356, 330), (1386, 350), (1450, 354), (1800, 354), (1840, 342), (1860, 316), (1858, 292), (1700, 290), (1500, 290))],
     feats={'side': [{'kind': 'highlight', 'pts': side((1370, 520), (1420, 450), (1490, 408), (1565, 384), (1650, 392), (1720, 432)), 'width': 2}]})
part('board', 'board', 'rubber', 'flat', slot='board', pair=True, side=side((660, 642), (1360, 642), (1360, 668), (660, 668)), top=[T(*q) for q in ((560, 256), (1360, 256), (1360, 334), (560, 334))], detail={'kind': 'ribs', 'pitch': 25})
part('boardEdge', 'board', 'chrome', 'flat', slot='board', pair=True, on='board', y=[760, 905], side=side((660, 652), (1360, 652), (1360, 664), (660, 664)))
for k, (a, b, ta) in enumerate(((785, 915, 745), (1135, 1265, 1127))):
    part(f'step{k}', 'board', 'chrome', 'flat', slot='board', pair=True, side=side((a + 6, 600), (b - 6, 600), (b, 606), (b, 642), (a, 642), (a, 606)), top=[T(*q) for q in ((ta, 261), (ta + 133, 261), (ta + 133, 321), (ta, 321))], lift=1)

# ---------------- lamps, bumpers, spare ----------------
# the headlamps: black bowls with a nickel rim, on stands from the wings (side: rim 137..165, bowl back to 208 px)
part('lamp', 'lamp', 'black', 'fender', slot='lamp', pair=True, fit=2, nofit=('top',), smooth=('side', 'front', 'top'),
     side=side((140, 318), (160, 311), (180, 315), (196, 326), (206, 346), (208, 370), (203, 394), (190, 410), (165, 416), (142, 412), (137, 380), (137, 340)),
     front=ell(F(213, 0)[0], F(0, 500)[1], 128, 130), top=[T(*q) for q in ((205, 100), (182, 90), (140, 86), (106, 98), (100, 148), (106, 200), (140, 211), (182, 208), (205, 196))])
part('lampRim', 'lamp', 'chrome', 'fender', on='lamp', slot='lamp', pair=True, smooth=('side', 'front'), side=side((140, 318), (158, 312), (165, 314), (166, 414), (142, 412), (137, 380), (137, 340)),
     front=ell(F(213, 0)[0], F(0, 500)[1], 128, 130), top=[T(*q) for q in ((140, 88), (112, 94), (100, 148), (112, 204), (140, 210))])
part('lampGap', 'lamp', 'iron', 'flat', on='lampRim', slot='lamp', pair=True, x=[330, 340], smooth=('front',), front=ell(F(213, 0)[0], F(0, 500)[1], 114, 116))
part('lens', 'lamp', 'chrome', 'flat', on='lampGap', slot='lamp', pair=True, x=[328, 338], smooth=('front',), front=ell(F(213, 0)[0], F(0, 500)[1], 108, 110), detail={'kind': 'bowl'})
part('lampStand', 'lamp', 'iron', 'flat', slot='lamp', pair=True, side=side((166, 412), (186, 412), (190, 446), (170, 446)), front=[F(*q) for q in ((205, 560), (222, 560), (222, 640), (205, 640))])
for k, (sy, fy) in enumerate(((548, 720), (588, 757))):
    part(f'bumperF{k}', 'bumperF', 'chrome', 'fender', slot='bumperF', side=side((2, sy), (30, sy), (40, sy + 8), (40, sy + 24), (30, sy + 32), (2, sy + 32)),
         front=fhalf((0, fy), (348, fy), (356, fy + 4), (356, fy + 14), (348, fy + 17), (0, fy + 17)),
         top=thalf((4, 0), (4, 262), (12, 280), (34, 290), (44, 282), (32, 264), (30, 0)))
part('clampF', 'bumperF', 'chrome', 'flat', on='bumperF0', slot='bumperF', pair=True, x=[0, 36], front=[F(*q) for q in ((137, 710), (166, 710), (166, 787), (137, 787))])
part('ironF', 'bumperF', 'black', 'flat', slot='bumperF', pair=True, side=side((38, 560), (75, 565), (75, 590), (38, 600)), front=[F(*q) for q in ((290, 770), (326, 770), (326, 830), (290, 830))], top=[T(*q) for q in ((20, 150), (20, 170), (160, 170), (160, 150))], lift=1)
for k, (sy, ry) in enumerate(((555, 683), (590, 728))):
    part(f'bumperR{k}', 'bumperR', 'chrome', 'fender', slot='bumperR', pair=True, side=side((1830, sy), (1924, sy), (1928, sy + 12), (1924, sy + 24), (1830, sy + 24)),
         rear=[B(*q) for q in ((180, ry), (402, ry), (410, ry + 10), (402, ry + 21), (180, ry + 21))], top=[T(*q) for q in ((1890, 226), (1938, 226), (1938, 262), (1890, 262))])
part('clampR', 'bumperR', 'chrome', 'flat', on='bumperR0', slot='bumperR', pair=True, x=[4690, 4725], rear=[B(*q) for q in ((178, 676), (200, 676), (200, 760), (178, 760))])
part('ironR', 'bumperR', 'black', 'flat', slot='bumperR', pair=True, side=side((1790, 570), (1832, 566), (1832, 606), (1790, 600)), rear=[B(*q) for q in ((240, 700), (262, 700), (262, 740), (240, 740))], top=[T(*q) for q in ((1850, 230), (1890, 230), (1890, 245), (1850, 245))])
# one tail lamp, on the left wing's inner side (rear sheet): a nickel rim and a red glass
part('tailRim', 'tail', 'chrome', 'fender', slot='tail', smooth=('rear',), x=[4590, 4610], rear=ell(B(275, 0)[0], B(0, 572)[1], 76, 75))
part('tail', 'tail', 'lensR', 'flat', on='tailRim', slot='tail', smooth=('rear',), x=[4580, 4610], rear=ell(B(275, 0)[0], B(0, 572)[1], 56, 55))
part('tailStand', 'tail', 'iron', 'flat', slot='tail', x=[4570, 4590], rear=[B(*q) for q in ((270, 605), (280, 605), (280, 650), (270, 650))])
cs = S(1865, 490)
part('spare', 'spare', 'rubber', 'fender', slot='spare', wheel={'r': 436},
     side=srect(1820, 318, 1910, 662, 40), rear=ell(0, B(0, 610)[1], 436, 441),
     top=tyre_section(T(1905, 0)[0], T(1956, 0)[0], -T(0, 176)[1], T(0, 176)[1]), smooth=('side', 'top'), detail={'kind': 'treadFace', 'pitch': 40})
part('spareCarrier', 'spare', 'iron', 'flat', slot='spare', y=[-60, 60], side=side((1806, 470), (1822, 470), (1822, 520), (1806, 520)), top=thalf((1880, 0), (1880, 24), (1906, 24), (1906, 0)))

# ---------------- the chassis under the body (the template's chassis moved onto this car's wheelbase and size) ----------------
CH = dict(layer='chassis'); ENG = '#3e5a3a'
kx = (RX - FX) / (3137 - 508); X_ = lambda x: round(FX + (x - 508) * kx); Z_ = lambda z: round(z * R / 381 * 0.98); Y_ = lambda y: round(y * 1.1)
def M(pts, ax='xz'): return [[(X_ if ax[0] == 'x' else Y_)(a), (Z_ if ax[1] == 'z' else Y_)(b)] for a, b in pts]
R4 = lambda x0, x1, a0, a1: [[x0, a0], [x1, a0], [x1, a1], [x0, a1]]
def chs(id, el, mat, surf, side=None, top=None, front=None, rear=None, **kw):
    v = {}
    if side: v['side'] = M(side)
    if top: v['top'] = M(top, 'xy')
    if front: v['front'] = M(front, 'yz')
    if rear: v['rear'] = M(rear, 'yz')
    part(id, el, mat, surf, **CH, **kw, **v)
chs('radiatorCore', 'radiator', 'black', 'flat', side=R4(600, 680, 600, 1210), top=halfT([600, 0], [600, 270], [680, 270], [680, 0]), front=half([0, 600], [250, 600], [250, 1210], [0, 1210]), detail={'kind': 'ribs', 'pitch': 25})
chs('fan', 'engine', 'black', 'flat', side=R4(690, 715, 760, 1120), top=halfT([690, 0], [690, 180], [715, 180], [715, 0]), front=ell(0, 940, 180, 180))
chs('sump', 'engine', 'black', 'side', side=[[800, 470], [1350, 470], [1330, 562], [820, 562]], top=halfT([800, 0], [800, 150], [1350, 150], [1350, 0]), front=half([0, 470], [150, 470], [170, 562], [0, 562]))
chs('block', 'engine', 'paint2', 'side', color=ENG, side=R4(738, 1398, 562, 1012), top=halfT([738, 0], [738, 200], [1398, 200], [1398, 0]), front=half([0, 562], [200, 562], [230, 900], [200, 1012], [0, 1012]))
chs('head', 'engine', 'paint2', 'side', color=ENG, side=[[748, 1012], [1388, 1012], [1378, 1062], [758, 1062]], top=halfT([748, 0], [748, 150], [1388, 150], [1388, 0]), front=half([0, 1012], [170, 1012], [150, 1062], [0, 1062]))
chs('generator', 'engine', 'black', 'fender', side=R4(768, 968, 862, 962), top=[[768, 210], [968, 210], [968, 310], [768, 310]], front=ell(260, 912, 50, 50))
chs('starter', 'engine', 'black', 'fender', side=R4(798, 1038, 652, 762), top=[[798, -320], [1038, -320], [1038, -210], [798, -210]], front=ell(-265, 707, 55, 55))
chs('bell', 'gearbox', 'paint2', 'side', color=ENG, side=[[1398, 512], [1608, 540], [1608, 900], [1398, 932]], top=halfT([1398, 0], [1398, 230], [1608, 180], [1608, 0]), front=ell(0, 722, 230, 210))
chs('gearbox', 'gearbox', 'paint2', 'side', color=ENG, side=R4(1608, 1958, 552, 782), top=halfT([1608, 0], [1608, 150], [1958, 130], [1958, 0]), front=half([0, 552], [150, 552], [150, 782], [0, 782]), detail={'kind': 'ribs', 'pitch': 60})
chs('lever', 'gearbox', 'iron', 'flat', side=[[1770, 782], [1800, 782], [1880, 1100], [1855, 1100]], top=[[1770, -15], [1880, -15], [1880, 15], [1770, 15]])
chs('torqueTube', 'driveline', 'iron', 'fender', side=[[1958, 610], [3060, 430], [3060, 480], [1958, 680]], top=halfT([1958, 0], [1958, 45], [3060, 45], [3060, 0]))
chs('rearDiff', 'axle', 'iron', 'fender', side=ell(3137, 400, 140, 130), top=halfT([3000, 0], [3000, 160], [3270, 160], [3270, 0]), rear=ell(0, 400, 160, 140))
chs('axleTubeR', 'axle', 'black', 'flat', side=R4(3100, 3174, 360, 440), top=halfT([3100, 0], [3100, 700], [3174, 700], [3174, 0]))
chs('axleTubeF', 'axle', 'black', 'flat', side=R4(470, 546, 330, 400), top=halfT([470, 0], [470, 680], [546, 680], [546, 0]))
chs('tank', 'tank', 'iron', 'side', side=R4(1345, 1560, 1000, 1230), top=halfT([1345, 0], [1345, 520], [1560, 520], [1560, 0]), front=half([0, 1000], [520, 1000], [520, 1240], [0, 1240]))
chs('column', 'steering', 'black', 'flat', side=[[1290, 640], [1320, 640], [1870, 1330], [1840, 1340]], top=[[1290, 330], [1870, 330], [1870, 370], [1290, 370]])
chs('steerWheel', 'steering', 'black', 'flat', side=ell(1866, 1352, 28, 190), top=[[1850, 160], [1885, 160], [1885, 540], [1850, 540]], front=ell(350, 1352, 190, 190))
chs('exhaust', 'exhaust', 'iron', 'flat', side=[[1100, 700], [1140, 560], [1180, 440], [1300, 425], [2400, 430], [2400, 470], [1310, 465], [1200, 480], [1170, 570], [1140, 700]], top=[[1100, 230], [2400, 280], [2400, 320], [1100, 270]])
chs('muffler', 'exhaust', 'iron', 'side', side=R4(2400, 2950, 395, 478), top=[[2400, 250], [2950, 250], [2950, 350], [2400, 350]])
chs('tailpipe', 'exhaust', 'iron', 'flat', side=R4(2950, 3700, 425, 447), top=[[2950, 290], [3700, 290], [3700, 310], [2950, 310]])

M_ = {'id': 'hudson26', 'name': '1926 large sedan', 'year': 1926, 'length': L, 'width': W, 'height': H,
      'paint': '#3e1c21', 'paint2': '#252424', 'canvas': '#2c2c2d', 'chrome': '#a2968a', 'glassTint': '#9da7b1',
      'wheels': [{'x': FX, 'r': R, 'y': TRACK}, {'x': RX, 'r': R, 'y': TRACK}],
      'wheel': {'rim': 0.71, 'style': 'artillery', 'spokes': 12, 'rimMaterial': 'paint', 'cap': 0.16, 'capRings': 1, 'trim': True},
      'parts': P}
json.dump(M_, open(OUT, 'w'), indent=0)
print(OUT, len(P), 'parts;', sum(len(p['outlines']) for p in P), 'outlines')
print('outlines pulled onto the drawing, mean move in mm:', SNAP)
print('where a view of the sheet differs from the common box by more than 50 mm (each view keeps its own):'); print('\n'.join('  ' + n for n in notes))
