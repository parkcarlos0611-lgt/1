"""The 1929 six-cylinder sedan (sheet 998b3ae3, the left-hand car) as one 3D part model, made by hand in the way of
tools/ref/sedan29_model.py: every part is a box in the car's space (x from the front bumper back, y from the centre
line outwards, z up; mm) and its outline as the sheet shows it from the side, the front or rear, and above. Outlines
are read off gridded enlargements of the sheet's views, in pixel positions on a 4x enlargement of each view
(S side, F front, B rear, T plan). The body-layer parts are written from scratch; the chassis-layer parts (engine,
gearbox, exhaust ... under the body) are the converter's draft's, moved onto this car's wheels.

  python3 pontiac29.py <views dir> <out json> [draft json] [repository root]"""
import sys, os, json, math
HERE = os.path.dirname(os.path.abspath(__file__))
VIEWS, OUT = sys.argv[1], sys.argv[2]
DRAFT = sys.argv[3] if len(sys.argv) > 3 else f'{HERE}/draft/pontiac29_auto.json'
REPO = sys.argv[4] if len(sys.argv) > 4 else '/home/user/1/gearhouse'
sys.path.insert(0, f'{REPO}/tools/ref')
import cv2, numpy as np
from zkit import View, fit_closed
from shapely.geometry import Polygon, box as sbox
from shapely.affinity import scale as sscale
from shapely.ops import unary_union

# ---- scale: the wire wheels' rims are centred at 227 and 1536 on the 4x side view (measured on the cream rims), the wheelbase is 2794 mm ----
K = 2794 / (1536 - 227)                                   # 2.134 mm per unit of the 4x side view (8.54 mm a pixel)
L, H, W = round(1888 * K), round(828 * K), 1660           # side view 472x207 px; the width is between the plan's (1530) and the front and rear views' (1700-1750)
C = W / 2
FX, RX, R = round(227 * K), round(1536 * K), 375
S = lambda px, py: [round(px * L / 1888), round(H - py * H / 828)]            # side view (472x207 px)
F = lambda dx, py: [round(dx * W / 852), round(H - py * H / 884)]             # front view (213x221 px): distance from the centre line, row
B = lambda dx, py: [round(dx * W / 876), round(H - py * H / 896)]             # rear view (219x224 px)
T = lambda px, dy: [round(px * L / 1860), round(dy * W / 708)]                # plan view (465x177 px): along, distance from the centre line
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
def fell(dx, py, r, n=24): return ell(F(dx, 0)[0], F(0, py)[1], r * W / 852, r * H / 884, n)
def bell(dx, py, r, n=24): return ell(B(dx, 0)[0], B(0, py)[1], r * W / 876, r * H / 896, n)
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

BLK = '#1e1e20'                                           # the sheet's black of the valances and the wheel houses: neutral
TOPBLK = '#222224'                                        # the black of the body above the belt (measured on the rear quarter)
# ---------------- running gear seen from outside ----------------
def arch(wx, r, lo, hi, low=-60):
    """the dark of a wheel house: a half circle over the wheel, kept inside lo..hi (where the wing ends the sheet shows daylight)"""
    a = [[min(hi, max(lo, round(wx + math.cos(t) * r))), round(R + math.sin(t) * r)] for t in [math.pi * k / 16 for k in range(16, -1, -1)]]
    return [[a[0][0], R + low]] + a + [[a[-1][0], R - 60]]
part('house0', 'house', 'black', 'flat', color=BLK, y=[0, 560], side=arch(FX, 445, S(74, 0)[0], FX + 445, 150))
part('house1', 'house', 'black', 'flat', color=BLK, y=[0, 560], side=arch(RX, 470, S(1350, 0)[0], S(1772, 0)[0]))
part('frame', 'frame', 'black', 'flat', pair=True, side=[[170, 430], [L - 330, 430], [L - 330, 530], [170, 530]], front=[[340, 430], [405, 430], [405, 530], [340, 530]], rear='front', top=[[170, 340], [L - 330, 340], [L - 330, 405], [170, 405]])
# from in front the sheet shows the axle, spring and steering gear as one dark band under the bumper; from behind the axle with the round of the differential
part('axleF', 'axle', 'black', 'flat', x=[FX - 40, FX + 40], front=fhalf((0, 792), (150, 792), (200, 782), (301, 778), (301, 745), (0, 745)))
part('springF', 'spring', 'iron', 'flat', x=[FX - 30, FX + 30], front=fhalf((0, 742), (120, 744), (280, 760), (300, 768), (300, 778), (280, 772), (120, 756), (0, 754)))
part('axleR', 'axle', 'black', 'flat', x=[RX - 47, RX + 47], rear=bhalf((0, 814), (40, 810), (70, 795), (100, 782), (298, 780), (298, 748), (100, 742), (60, 730), (0, 726)), smooth=('rear',))
part('springR', 'spring', 'iron', 'flat', x=[RX + 60, RX + 120], rear=bhalf((0, 716), (60, 720), (220, 742), (296, 760), (296, 772), (220, 756), (60, 734), (0, 730)))
tyre0 = [[606, 6], [640, 0], [748, 0], [782, 6], [798, 40], [805, 200], [807, 381], [804, 560], [796, 690], [782, 734], [760, 754], [725, 762], [663, 762], [628, 754], [606, 734], [592, 690], [584, 560], [581, 381], [583, 200], [590, 40]]   # a balloon section face on: flat where it stands, round at the top
def tyre(y0, y1): return [[round(y0 + (q[0] - 581) / 226 * (y1 - y0)), round(q[1] / 762 * 2 * R)] for q in tyre0]
TF = (F(299, 0)[0], F(404, 0)[0]); TR = (B(298, 0)[0], B(405, 0)[0])            # the tyres' inner and outer faces on the front and rear views
part('tyreF', 'wheel', 'rubber', 'fender', x=[FX - 355, FX + 355], pair=True, front=tyre(*TF), top=[[FX - 280, TF[0]], [FX + 355, TF[0]], [FX + 355, TF[1]], [FX - 280, TF[1]]], smooth=('front',), detail={'kind': 'treadFace', 'pitch': 36})
part('tyreR', 'wheel', 'rubber', 'fender', x=[RX - 355, RX + 355], pair=True, rear=tyre(*TR), top=[[RX - 355, TR[0]], [RX + 355, TR[0]], [RX + 355, TR[1]], [RX - 355, TR[1]]], smooth=('rear',), detail={'kind': 'treadFace', 'pitch': 36})

# ---------------- body ----------------
# the dark between the wings ahead of the shell (plan) and under the shell and lamps (front)
part('splash', 'apron', 'black', 'flat', color=BLK, z=[300, 800], x=[S(280, 0)[0], S(400, 0)[0]], top=halfT((92, 0), (92, 150), (199, 150), (199, 0)), front=fhalf((0, 792), (200, 792), (300, 770), (300, 540), (0, 540)))
part('crossF', 'frame', 'black', 'flat', x=[170, 260], z=[380, 430], top=[[200, -240], [200, 240], [290, 240], [290, -240]], front=half([0, 380], [405, 380], [405, 430], [0, 430]))
# the black valance between the body's bottom edge and the running board, running forward under the hood behind the front wing
part('apron', 'apron', 'black', 'flat', color=BLK, y=[-600, 600], side=side((430, 548), (520, 574), (1322, 578), (1322, 668), (745, 672), (600, 655), (480, 600)),
     feats={'side': [{'kind': 'crease', 'pts': side((830, 592), (1318, 592))}]})
# radiator: a narrow bright shell with a low arched top and a round badge in the arch; the core fills it (the maker's lettering on the core is left out)
part('shell', 'radiator', 'chrome', 'flat', slot='grille', color='#a3a1a2', fit=2, nofit=('top', 'side'),
     side=side((220, 470), (220, 286), (226, 271), (238, 264), (272, 262), (272, 470)),
     front=fhalf((0, 276), (50, 280), (90, 292), (118, 312), (133, 340), (137, 380), (137, 640), (128, 653), (0, 655)), smooth=('front',),
     top=halfT((152, 0), (152, 95), (160, 100), (199, 100), (199, 0)))
part('core', 'radiator', 'black', 'flat', on='shell', slot='grille', x=[S(221, 0)[0], S(226, 0)[0]], front=fhalf((0, 326), (70, 328), (96, 340), (108, 362), (108, 645), (0, 645)), smooth=('front',), detail={'kind': 'cells', 'pitch': 22})
part('badge', 'radiator', 'chrome', 'flat', on='shell', slot='grille', x=[S(217, 0)[0], S(221, 0)[0]], front=fell(0, 305, 17, 16), smooth=('front',), lift=1)
part('badgeGem', 'radiator', 'lensR', 'flat', on='badge', slot='grille', x=[S(216, 0)[0], S(219, 0)[0]], front=fell(0, 305, 10, 12), smooth=('front',), lift=2)
part('crankCover', 'radiator', 'chrome', 'flat', on='core', slot='grille', x=[S(214, 0)[0], S(220, 0)[0]], front=fell(0, 640, 15, 14), smooth=('front',), lift=2)
# the cap with its mascot (a small gilt figure, head forward)
part('cap', 'radiator', 'chrome', 'flat', slot='grille', color='#b39a62', smooth=('side', 'front'),
     side=side((234, 266), (240, 254), (233, 246), (228, 236), (236, 227), (250, 226), (264, 233), (268, 242), (258, 250), (256, 256), (260, 266)),
     front=fhalf((0, 205), (11, 209), (17, 222), (13, 238), (6, 250), (9, 262), (15, 274), (0, 278)),
     top=[[T(170, 0)[0] + round(math.cos(k / 12 * 6.2832) * 38), round(math.sin(k / 12 * 6.2832) * 34)] for k in range(12)])
part('hood', 'hood', 'paint', 'side', fit=2, nofit=('front', 'top'),
     side=side((274, 260), (642, 252), (642, 578), (274, 578)),
     front=fhalf((0, 264), (100, 268), (170, 282), (205, 305), (218, 340), (220, 600), (0, 600)), smooth=('front',),
     top=halfT((199, 0), (199, 98), (568, 221), (568, 0)),
     feats={'side': [{'kind': 'louvres', 'x0': S(328, 0)[0], 'x1': S(590, 0)[0], 'z0': S(0, 520)[1], 'z1': S(0, 372)[1], 'n': 13, 'slant': 0},
                     {'kind': 'trim', 'pts': side((278, 315), (640, 313)), 'width': 1},                   # the bright hinge strip along the hood's side
                     {'kind': 'highlight', 'pts': side((280, 286), (460, 283), (636, 280)), 'width': 2},
                     {'kind': 'handle', 'at': S(574, 548), 'len': 50}],
            'top': [{'kind': 'trim', 'pts': top((203, 0), (565, 0)), 'width': 1}, {'kind': 'highlight', 'pts': top((215, 70), (560, 150)), 'width': 2}, {'kind': 'highlight', 'pts': top((215, -70), (560, -150)), 'width': 2}]})
# the bright band between hood and cowl
part('hoodBand', 'cowl', 'chrome', 'flat', on='cowl', side=side((642, 253), (652, 253), (652, 578), (642, 578)), top=halfT((568, 0), (568, 221), (583, 226), (583, 0)),
     front=fhalf((0, 258), (100, 262), (172, 276), (212, 300), (226, 336), (226, 344), (208, 306), (170, 284), (100, 270), (0, 266)))
part('cowl', 'cowl', 'paint', 'side', fit=2, nofit=('front', 'top'),
     side=side((650, 252), (700, 250), (760, 250), (760, 283), (790, 285), (790, 578), (650, 578)),
     front=fhalf((0, 256), (120, 260), (220, 272), (290, 290), (322, 310), (326, 330), (326, 560), (0, 560)), smooth=('front',),
     top=halfT((583, 0), (583, 226), (680, 250), (680, 0)),
     feats={'side': [{'kind': 'highlight', 'pts': side((658, 296), (705, 292), (750, 286)), 'width': 2}, {'kind': 'trim', 'pts': side((654, 315), (790, 314)), 'width': 1}],
            'top': [{'kind': 'seam', 'pts': top((600, 77), (673, 77), (673, -77), (600, -77), (600, 77))}]})    # the cowl ventilator's lid
# the body: olive up to the belt; above the belt it is black (bodyTop). Its side follows the rear wheel arch behind the wing.
BODY_TOP = ((722, 0), (722, 270), (840, 286), (1000, 292), (1640, 292), (1680, 280), (1705, 255), (1718, 215), (1724, 150), (1724, 0))
part('body', 'body', 'paint', 'side', fit=2, nofit=('top', 'front', 'rear'),
     side=side((790, 578), (790, 285), (760, 283), (760, 62), (772, 46), (1700, 46), (1740, 52), (1760, 72), (1760, 300), (1757, 400), (1750, 480), (1740, 540), (1728, 585),
               (1700, 505), (1665, 462), (1610, 428), (1540, 416), (1475, 424), (1425, 448), (1385, 490), (1358, 540), (1340, 600), (1330, 578)),
     front=fhalf((0, 60), (326, 60), (330, 90), (330, 283), (326, 300), (324, 440), (318, 560), (0, 560)),
     rear=bhalf((0, 60), (364, 60), (366, 285), (358, 330), (352, 400), (345, 480), (330, 560), (300, 598), (0, 602)),
     top=halfT(*BODY_TOP),
     feats={'side': [{'kind': 'seam', 'pts': side((790, 286), (790, 577))}, {'kind': 'seam', 'pts': side((1100, 286), (1100, 577))},
                     {'kind': 'seam', 'pts': side((1420, 286), (1420, 400), (1406, 440), (1378, 482), (1352, 524), (1336, 572))},
                     {'kind': 'trim', 'pts': side((792, 314), (1200, 314), (1660, 313), (1720, 302), (1758, 287)), 'width': 1}, {'kind': 'highlight', 'pts': side((794, 300), (1640, 300)), 'width': 1},
                     {'kind': 'crease', 'pts': side((796, 568), (1332, 568))},
                     {'kind': 'hinge', 'at': S(790, 345)}, {'kind': 'hinge', 'at': S(790, 520)}, {'kind': 'hinge', 'at': S(1420, 345)}],
            'rear': [{'kind': 'bead', 'pts': [B(-360, 332), B(-250, 320), B(0, 318), B(250, 320), B(360, 332)]},
                     {'kind': 'highlight', 'pts': [B(-356, 302), B(0, 298), B(356, 302)], 'width': 1}]})
part('bodyTop', 'body', 'paint2', 'side', on='body', color=TOPBLK, fit=2, nofit=('front', 'rear'), y=[0, 640],
     side=side((760, 283), (760, 62), (772, 46), (1700, 46), (1740, 52), (1760, 72), (1760, 277), (1640, 283)),
     front=fhalf((0, 60), (326, 60), (330, 90), (330, 283), (0, 283)),
     rear=bhalf((0, 40), (350, 40), (364, 70), (366, 285), (0, 285)),
     feats={'side': [{'kind': 'seam', 'pts': side((1100, 64), (1100, 282))}, {'kind': 'seam', 'pts': side((1420, 64), (1420, 282))},
                     {'kind': 'seam', 'pts': side((800, 64), (1640, 64))},
                     {'kind': 'seam', 'pts': [list(q) for q in srrect(1668, 90, 1752, 272, 40)] + [srrect(1668, 90, 1752, 272, 40)[0]]},   # the padded rear quarter's welt
                     {'kind': 'hinge', 'at': S(790, 268)}, {'kind': 'hinge', 'at': S(790, 110)}],
            'front': [{'kind': 'seam', 'pts': [F(s * 252, 92), F(s * 252, 270)]} for s in (-1, 1)] + [{'kind': 'seam', 'pts': [F(s * 300, 100), F(s * 318, 110), F(s * 318, 250), F(s * 300, 262), F(s * 300, 100)]} for s in (-1, 1)],
            'rear': [{'kind': 'seam', 'pts': [B(-366, 284), B(366, 284)]}]})
# the roof: black cloth over a low rounded cap; from above its outline is the body's, with the inner panel's welt
part('roof', 'roof', 'canvas', 'roof', fit=2, nofit=('front', 'rear', 'top'),
     side=side((760, 62), (760, 42), (800, 28), (900, 14), (1000, 8), (1100, 4), (1600, 4), (1700, 8), (1740, 24), (1758, 50), (1762, 72), (1700, 64), (800, 64)),
     front=fhalf((0, 3), (110, 4), (190, 7), (253, 13), (280, 20), (299, 30), (318, 45), (326, 60), (330, 87), (0, 87)),
     rear=bhalf((0, 8), (250, 8), (318, 20), (345, 36), (358, 53), (364, 78), (0, 78)),
     top=halfT(*BODY_TOP),
     feats={'top': [{'kind': 'seam', 'pts': top((735, 0), (735, 240), (760, 262), (1000, 269), (1640, 269), (1672, 255), (1688, 225), (1692, 150), (1692, 0))},
                    {'kind': 'seam', 'pts': top((735, 0), (735, -240), (760, -262), (1000, -269), (1640, -269), (1672, -255), (1688, -225), (1692, -150), (1692, 0))}]})
# the visor over the windscreen: a cloth-covered peak sloping forward and down from the roof's front edge
part('visor', 'roof', 'canvas', 'roof', fit=2, nofit=('front', 'top'), color='#2c2c30',
     side=side((710, 78), (760, 40), (800, 28), (800, 62), (760, 86), (716, 85)),
     front=fhalf((0, 40), (300, 40), (318, 50), (328, 62), (331, 88), (0, 88)),
     top=halfT((680, 0), (680, 240), (688, 258), (722, 270), (722, 0)))
part('screenFrame', 'screen', 'black', 'flat', on='bodyTop', x=[S(760, 0)[0], S(772, 0)[0]], front=fhalf((0, 88), (240, 88), (240, 264), (0, 264)))
part('screen', 'screen', 'glass', 'side', on='screenFrame', x=[S(762, 0)[0], S(770, 0)[0]], front=fhalf((0, 99), (226, 99), (226, 256), (0, 256)))
part('wiper', 'screen', 'black', 'flat', on='screen', x=[S(758, 0)[0], S(762, 0)[0]], front=fr((128, 62), (136, 70), (52, 160), (44, 156)), lift=1)
# cowl lamps: small bright lamps standing out at the belt, either side of the screen (front view)
part('cowlLamp', 'lamp', 'chrome', 'fender', pair=True, x=[S(700, 0)[0], S(728, 0)[0]], smooth=('front',), front=fell(337, 284, 11, 12))
# the door handles: heavy bright handles either side of the centre post; from behind they stand out of the body's side
for k, pts in enumerate((((1018, 327), (1058, 327), (1064, 318), (1078, 320), (1082, 340), (1072, 349), (1062, 339), (1018, 337)),
                         ((1182, 327), (1142, 327), (1136, 318), (1122, 320), (1118, 340), (1128, 349), (1138, 339), (1182, 337)))):
    part(f'doorHandle{k}', 'body', 'chrome', 'flat', on='body', pair=True, y=[640, 670], side=side(*pts), lift=2,
         **({'rear': re((350, 309), (366, 307), (372, 314), (366, 322), (350, 321))} if k else {}))
# side windows: three a side, each in a dark surround with rounded corners
WIN = (((815, 84, 1070, 274), (832, 118, 1040, 250)), ((1123, 87, 1397, 273), (1147, 114, 1373, 256)), ((1437, 90, 1627, 273), (1453, 118, 1580, 250)))
for k, (fo, gl) in enumerate(WIN):
    fp = srrect(*fo, 55); ip = srrect(fo[0] + 9, fo[1] + 9, fo[2] - 9, fo[3] - 9, 48)
    part(f'wframe{k}', 'body', 'paint2', 'side', on='bodyTop', color='#252628', y=[640, 642], pair=True, side=fp,
         feats={'side': [{'kind': 'highlight', 'pts': ip + [ip[0]], 'width': 1}]})
    part(f'glass{k}', 'body', 'glass', 'side', on=f'wframe{k}', y=[642, 644], pair=True, side=srrect(*gl, 18))
part('rearFrame', 'body', 'black', 'flat', on='bodyTop', x=[S(1756, 0)[0], S(1760, 0)[0]], rear=rrect(B(-190, 0)[0], B(0, 242)[1], B(190, 0)[0], B(0, 98)[1], 40))
part('rearGlass', 'body', 'glass', 'side', on='rearFrame', x=[S(1754, 0)[0], S(1758, 0)[0]], rear=rrect(B(-178, 0)[0], B(0, 232)[1], B(178, 0)[0], B(0, 108)[1], 26))
part('rearApron', 'body', 'black', 'flat', color=BLK, x=[S(1690, 0)[0], S(1756, 0)[0]], rear=bhalf((0, 598), (300, 598), (300, 748), (0, 748)))

# ---------------- wings, boards ----------------
part('fenderF', 'fenderF', 'paint2', 'fender', fit=2, nofit=('top', 'front'), slot='fenderF', pair=True, cutWheel={'i': 0, 'r': R + 6}, smooth=('front', 'side', 'top'), x=[S(56, 0)[0], S(745, 0)[0]],
     side=side((56, 507), (62, 494), (80, 476), (120, 453), (160, 440), (200, 434), (240, 432), (280, 436), (320, 448), (360, 468), (400, 500), (440, 540), (480, 580), (520, 612), (560, 636), (600, 652), (660, 666), (745, 672),
               (745, 692), (660, 689), (588, 676), (536, 655), (495, 628), (455, 592), (415, 550), (376, 515), (338, 491), (300, 479), (250, 475), (200, 477), (150, 487), (112, 502), (82, 518), (60, 524)),
     front=fr((426, 505), (422, 470), (404, 442), (404, 412), (386, 392), (346, 387), (320, 396), (314, 436), (276, 462), (261, 492), (246, 484), (211, 512), (176, 582), (151, 644), (194, 646), (226, 570), (266, 542),
              (306, 553), (366, 553), (406, 545), (422, 530)),
     top=top((80, 235), (84, 290), (94, 322), (110, 338), (140, 344), (480, 344), (680, 318), (720, 316), (724, 262), (682, 240), (583, 214), (199, 90), (150, 90), (118, 112), (96, 145), (84, 190)),
     feats={'side': [{'kind': 'highlight', 'pts': side((84, 484), (122, 462), (162, 449), (202, 443), (240, 441), (280, 445), (318, 457), (356, 477), (396, 509), (436, 549), (476, 588), (520, 622)), 'width': 2}],
            'front': [{'kind': 'highlight', 'pts': fr((400, 480), (360, 468), (310, 474), (280, 490)), 'width': 2}],
            'top': [{'kind': 'highlight', 'pts': top((120, 318), (300, 324), (480, 320)), 'width': 2}]})
# small lamps standing on the front wings' crowns (front and plan views)
part('fenderLamp', 'lamp', 'chrome', 'fender', pair=True, smooth=('front', 'top'), z=[F(0, 432)[1], F(0, 408)[1]],
     front=fell(351, 420, 10, 12), top=[[T(177, 0)[0] + round(math.cos(k / 12 * 6.2832) * 34), T(0, 291)[1] + round(math.sin(k / 12 * 6.2832) * 30)] for k in range(12)])
part('fenderR', 'fenderR', 'paint2', 'fender', fit=2, nofit=('top', 'rear'), slot='fenderR', pair=True, cutWheel={'i': 1, 'r': R + 6}, smooth=('rear', 'side', 'top'),
     side=side((1318, 690), (1320, 640), (1326, 590), (1340, 535), (1362, 490), (1395, 450), (1435, 425), (1480, 410), (1540, 406), (1590, 412), (1630, 428), (1670, 452), (1700, 480), (1730, 520), (1750, 560), (1765, 600), (1790, 645), (1820, 665), (1850, 662),
               (1848, 674), (1813, 681), (1775, 664), (1744, 615), (1722, 564), (1699, 520), (1670, 484), (1636, 459), (1598, 443), (1545, 437), (1492, 441), (1448, 455), (1414, 477), (1386, 510), (1369, 553), (1359, 602), (1356, 690)),
     rear=re((300, 750), (300, 612), (318, 570), (334, 520), (344, 474), (345, 448), (360, 432), (400, 428), (424, 438), (436, 470), (436, 720), (426, 750)),
     top=top((1240, 290), (1240, 318), (1260, 332), (1300, 344), (1340, 349), (1640, 349), (1680, 336), (1705, 314), (1720, 280), (1724, 215), (1705, 255), (1680, 280), (1640, 292)),
     feats={'side': [{'kind': 'highlight', 'pts': side((1350, 536), (1372, 494), (1402, 458), (1440, 434), (1484, 420), (1540, 416), (1588, 422), (1626, 437), (1664, 460), (1692, 487)), 'width': 2}],
            'top': [{'kind': 'highlight', 'pts': top((1300, 330), (1480, 336), (1640, 332)), 'width': 2}]})
part('board', 'board', 'rubber', 'flat', color='#232325', slot='board', pair=True, side=side((745, 668), (1318, 668), (1318, 690), (745, 690)), top=top((720, 289), (720, 324), (1240, 324), (1240, 289)))
part('boardTrim', 'board', 'chrome', 'flat', on='board', slot='board', pair=True, side=side((747, 667), (1316, 667), (1316, 689), (747, 689)), top=top((840, 314), (840, 324), (1236, 324), (1236, 314)), lift=1)   # the bright edge strip along the board
part('step0', 'board', 'chrome', 'flat', slot='board', pair=True, x=[T(725, 0)[0], T(838, 0)[0]], z=[S(0, 668)[1], S(0, 660)[1]], top=top((725, 279), (725, 312), (838, 312), (838, 292)), lift=2, detail={'kind': 'ribs', 'pitch': 22})

# ---------------- lamps, bumpers, spare ----------------
# bullet headlamps, all bright: a rim and a pointed bowl behind it; face on a rim round a pale lens
part('lamp', 'lamp', 'chrome', 'fender', slot='lamp', pair=True, smooth=('side', 'front', 'top'), color='#8d8e92',
     side=side((158, 336), (166, 330), (178, 332), (215, 355), (238, 385), (240, 397), (232, 408), (214, 420), (178, 428), (166, 428), (158, 420), (155, 380)),
     front=fell(193, 413, 64), top=top((100, 205), (108, 211), (120, 211), (160, 195), (185, 165), (187, 152), (180, 135), (160, 112), (120, 101), (108, 101), (100, 107)))
part('lampRim', 'lamp', 'chrome', 'flat', on='lamp', slot='lamp', pair=True, y=[F(129, 0)[0], F(257, 0)[0]], side=side((156, 338), (164, 331), (174, 332), (176, 428), (165, 429), (157, 421), (154, 380)), smooth=('side',), lift=1)
part('lampGap', 'lamp', 'iron', 'flat', on='lamp', slot='lamp', pair=True, x=[S(156, 0)[0], S(160, 0)[0]], smooth=('front',), front=fell(193, 413, 57))
part('lens', 'lamp', 'chrome', 'flat', on='lampGap', slot='lamp', pair=True, x=[S(155, 0)[0], S(159, 0)[0]], smooth=('front',), front=fell(193, 413, 54), detail={'kind': 'bowl'})
part('lampStand', 'lamp', 'black', 'flat', slot='lamp', pair=True, color='#2a2a2c', side=side((176, 426), (202, 424), (208, 442), (172, 442)), front=fr((180, 476), (206, 476), (212, 500), (176, 500)))
for k, (py, zf, zr) in enumerate(((604, 671, 671), (648, 716, 717))):
    part(f'bumperF{k}', 'bumperF', 'chrome', 'fender', slot='bumperF', side=side((2, py - 12), (34, py - 12), (38, py), (34, py + 12), (2, py + 12)), front=fhalf((0, zf - 13), (405, zf - 13), (413, zf), (405, zf + 13), (0, zf + 13)),
         top=halfT((3, 0), (3, 180), (12, 242), (38, 284), (54, 276), (36, 236), (28, 180), (28, 0)))
    part(f'bumperR{k}', 'bumperR', 'chrome', 'fender', slot='bumperR', pair=True, side=side((1822, py - 6 - 11), (1886, py - 6 - 11), (1886, py - 6 + 11), (1822, py - 6 + 11)),
         rear=re((171, zr - 13), (420, zr - 13), (427, zr), (420, zr + 13), (171, zr + 13)), top=top((1738, 290), (1752, 301), (1778, 266), (1799, 216), (1812, 162), (1794, 157), (1778, 202), (1758, 250), (1740, 274)))
part('clampF0', 'bumperF', 'chrome', 'flat', on='bumperF0', slot='bumperF', pair=True, x=[0, 30], front=fr((193, 654), (219, 654), (219, 732), (193, 732)))
part('clampF1', 'bumperF', 'chrome', 'flat', on='bumperF0', slot='bumperF', pair=True, x=[0, 30], y=[F(396, 0)[0], F(416, 0)[0]], front=fr((396, 652), (416, 652), (416, 734), (396, 734)), side=side((8, 584), (32, 584), (32, 665), (8, 665)))
part('clampR0', 'bumperR', 'chrome', 'flat', on='bumperR0', slot='bumperR', pair=True, x=[S(1815, 0)[0], S(1838, 0)[0]], rear=re((171, 655), (196, 655), (196, 738), (171, 738)))
part('clampR1', 'bumperR', 'chrome', 'flat', on='bumperR0', slot='bumperR', pair=True, y=[B(405, 0)[0], B(426, 0)[0]], rear=re((405, 655), (426, 655), (426, 738), (405, 738)), side=side((1815, 582), (1838, 582), (1838, 652), (1815, 652)))
part('ironF', 'bumperF', 'black', 'flat', slot='bumperF', pair=True, side=side((36, 602), (72, 612), (72, 640), (36, 650)), top=top((27, 103), (27, 117), (84, 117), (84, 103)), lift=1)
part('ironR', 'bumperR', 'black', 'flat', slot='bumperR', pair=True, side=side((1792, 612), (1822, 600), (1822, 638), (1797, 648)), top=top((1722, 236), (1722, 250), (1762, 264), (1767, 252)))
# tail lamps on both rear wings (rear view): a bright rim and a red glass
part('tailRim', 'tail', 'chrome', 'fender', on='fenderR', slot='tail', pair=True, smooth=('rear',), x=[S(1760, 0)[0], S(1772, 0)[0]], rear=bell(338, 506, 31))
part('tail', 'tail', 'lensR', 'flat', on='tailRim', slot='tail', pair=True, smooth=('rear',), x=[S(1762, 0)[0], S(1774, 0)[0]], rear=bell(338, 506, 22))
# the number plate under the left tail lamp: a blank black plate in a white border (the sheet's lettering is left out)
part('plateRim', 'tail', 'white', 'flat', on='fenderR', x=[S(1772, 0)[0], S(1778, 0)[0]], rear=rrect(B(247, 0)[0], B(0, 622)[1], B(425, 0)[0], B(0, 549)[1], 12), lift=1)
part('plate', 'tail', 'black', 'flat', on='plateRim', x=[S(1772, 0)[0], S(1779, 0)[0]], rear=rrect(B(256, 0)[0], B(0, 613)[1], B(416, 0)[0], B(0, 558)[1], 8), lift=2)
# the spare on the back: edge on from the side and above (the road tyres' own section), a wire wheel from behind
def tyre_section(u0, u1, v0, v1, across_first=True):
    lo_u, hi_u = 581, 807; hi_v = 762
    return [[round(u0 + (q[0] - lo_u) / (hi_u - lo_u) * (u1 - u0)), round(v0 + q[1] / hi_v * (v1 - v0))] if across_first else
            [round(v0 + q[1] / hi_v * (v1 - v0)), round(u0 + (q[0] - lo_u) / (hi_u - lo_u) * (u1 - u0))] for q in tyre0]
part('spareCarrier', 'spare', 'black', 'flat', color=BLK, side=side((1752, 470), (1772, 466), (1772, 530), (1748, 524)), top=halfT((1722, 0), (1722, 60), (1770, 60), (1770, 0)))
part('spare', 'spare', 'rubber', 'fender', wheel={'r': 340},
     side=tyre_section(S(1765, 0)[0], S(1858, 0)[0], S(0, 668)[1], S(0, 324)[1]), rear=bell(0, 565, 177),
     top=tyre_section(T(1765, 0)[0], T(1855, 0)[0], -T(0, 162)[1], T(0, 162)[1]), smooth=('side', 'top'), detail={'kind': 'treadFace', 'pitch': 36})

# ---------------- the chassis under the body: the draft's chassis-layer parts moved onto this car's wheels ----------------
D = json.load(open(DRAFT)); dw = D['wheels']; kx = (RX - FX) / (dw[1]['x'] - dw[0]['x']); ky = W / D['width']; kz = H / D['height']
mx = lambda v: round(FX + (v - dw[0]['x']) * kx); my = lambda v: round(v * ky); mz = lambda v: round(v * kz)
for p in D['parts']:
    if p.get('layer') != 'chassis': continue
    q = json.loads(json.dumps(p)); b = q['box']; q['box'] = {'x': [mx(b['x'][0]), mx(b['x'][1])], 'y': [my(b['y'][0]), my(b['y'][1])], 'z': [mz(b['z'][0]), mz(b['z'][1])]}
    for v, sb in q.get('sheet', {}).items():
        fa, fb = {'side': (mx, mz), 'front': (my, mz), 'rear': (my, mz), 'top': (mx, my)}[v]; q['sheet'][v] = [fa(sb[0]), fa(sb[1]), fb(sb[2]), fb(sb[3])]
    P.append(q)

M = {'id': 'pontiac29', 'name': '1929 six-cylinder sedan', 'year': 1929, 'length': L, 'width': W, 'height': H,
     'paint': '#3c3c2e', 'paint2': '#27282b', 'canvas': '#333338', 'chrome': '#a6a4a2', 'glassTint': '#969a9e',
     'wheels': [{'x': FX, 'r': R, 'y': 686}, {'x': RX, 'r': R, 'y': 686}],
     'wheel': {'rim': 0.64, 'style': 'wire', 'spokes': 36, 'rimMaterial': 'chrome', 'cap': 0.32, 'capRings': 2},   # cream wire wheels with a large bright hub cap
     'parts': P}
json.dump(M, open(OUT, 'w'), indent=0)
print(OUT, len(P), 'parts;', sum(len(p['outlines']) for p in P), 'outlines')
print('outlines pulled onto the drawing, mean move in mm:', SNAP)
print('where a view of the sheet differs from the common box by more than 50 mm (each view keeps its own):'); print('\n'.join('  ' + n for n in notes))
