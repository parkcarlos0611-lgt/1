"""The 1935 grand roadster (sheet 94e0a997, the left column) as one 3D part model, made by hand in the way of
tools/ref/sedan29_model.py and the open cars (brief 64, 65): every part a box in the car's space (x from the front
back, y from the centre line outwards, z up; mm) with its outline as the sheet shows it from the side, front, rear and
above. Outlines are read point by point off gridded 5x crops, in SOURCE pixels of each view (S side, F front, B rear,
T plan). The sheet's plan has the car's front at the right: T takes the plan's own column and the offset from its centre
row (positive = the lower half of the sheet = the car's right, where the exhaust pipes are) and turns it round. The
tools get a views folder (work/views) whose v_top is the sheet's plan turned by 180 degrees. Body-layer parts are
written from scratch; the chassis-layer parts are the draft's, moved onto this car's wheels.

  python3 dueSSJ35.py <views dir> <out json> [draft json] [repository root]"""
import sys, os, json, math
HERE = os.path.dirname(os.path.abspath(__file__))
VIEWS, OUT = sys.argv[1], sys.argv[2]
DRAFT = sys.argv[3] if len(sys.argv) > 3 else f'{HERE}/draft/dueSSJ35.json'
REPO = sys.argv[4] if len(sys.argv) > 4 else '/home/user/1/gearhouse'
sys.path.insert(0, f'{REPO}/tools/ref')
import cv2, numpy as np
from zkit import View, fit_closed
from shapely.geometry import Polygon, LineString, box as sbox
from shapely.affinity import scale as sscale
from shapely.ops import unary_union

# ---- scale: hub caps at 60 and 422 on the side view (515x176), wheelbase 3175 mm ----
K = 3175 / (422 - 60)                                     # 8.77 mm a pixel
G = 172                                                   # ground row (hub row 124 + tyre radius 48)
L, H = round(515 * K), round(G * K); W = round(289 * H / 212)   # review 70: the front view keeps the sheet's proportions (one scale both ways, from its height)              # width: the plan gives about 1700, the front view (at its height's scale) 2050; 1800 puts the front track at 1430 (real 1422)
C = W / 2
FX, RX, R = round(60 * K), round(422 * K), round(48 * K)
FG, FC, FW = 212, 144.5, 289                              # front view: ground row, centre column, width over the wings
BG, BC, BW = 211, 147, 294                                # rear view
TCEN, TL, TS = 94, 497, 513 / 497                         # plan: centre row, last column (the front bumper), stretch to the side view's length
S = lambda px, py: [round(px * K), round((G - py) * K)]
F = lambda dx, py: [round(dx * H / FG), round((FG - py) * H / FG)]
B = lambda dx, py: [round(dx * H / BG), round((BG - py) * H / BG)]
T = lambda px, d: [round((TL - px) * TS * K), round(d * TS * K)]
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
def sell(px, py, rx, ry, n=24): return ell(*S(px, py), rx * K, ry * K, n)
def fell(dx, py, r, n=24): return ell(*F(dx, py), r * W / FW, r * H / FG, n)
def bell(dx, py, r, n=24): return ell(*B(dx, py), r * W / BW, r * H / BG, n)
def tell(px, d, rx, ry, n=24): return ell(*T(px, d), rx * K, ry * K, n)
def tube(pts, w):
    """a pipe of width w (mm) along a centre line of points (mm): its outline, flat at both ends"""
    g = LineString(pts).buffer(w / 2, cap_style=2, join_style=1, resolution=3).simplify(3)
    return [[round(x), round(z)] for x, z in list(g.exterior.coords)[:-1]]
def rect(x0, x1, y0, y1): return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

os.makedirs(f'{HERE}/work', exist_ok=True)
def _view(name, w, h):
    t = f'{HERE}/work/_fit_{name}.png'; cv2.imwrite(t, cv2.resize(cv2.imread(f'{VIEWS}/v_{name}.png', cv2.IMREAD_UNCHANGED), (round(w / 10), round(h / 10)), interpolation=cv2.INTER_AREA)); V = View(t, w); V.edge = np.maximum(V.sil * 3, V.grad); return V
FIT = {'side': _view('left', L, H)}
SNAP = {}
def snap(view, pts, reach):
    f, moved = fit_closed(FIT[view], [[x, z, 1] for x, z in pts], FIT[view].edge, reach=reach, floor=25)
    return [[x, z] for x, z, _ in f], moved
P = []; notes = []
def part(id, element, material, surface='side', *, layer=None, color=None, on=None, join=None, fit=0, nofit=(), x=None, y=None, z=None, pair=False, slot=None, smooth=(), detail=None, feats=None, wheel=None, lift=0, **views):
    bb = lambda pts, k: [min(p[k] for p in pts), max(p[k] for p in pts)]
    if fit:
        for v in list(views):
            if v != 'side' or v in nofit: continue
            views[v], mv = snap(v, views[v], fit); SNAP[f'{id}.{v}'] = round(mv)
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
    X, Y, Z = box['x'], box['y'], box['z']
    P.append({'id': id, 'element': element, 'material': material, 'surface': surface, 'box': {'x': X, 'y': Y, 'z': Z}, 'sheet': sheet, 'pair': pair, 'outlines': o,
              **({'slot': slot} if slot else {}), **({'detail': detail} if detail else {}), **({'features': f2} if f2 else {}), **({'wheel': wheel} if wheel else {}), **({'lift': lift} if lift else {}), **({'on': on} if on else {}), **({'color': color} if color else {}), **({'join': join} if join else {}), **({'layer': layer} if layer else {})})

TAN = '#b98a52'; PIPE = '#cdc3ac'
# ---------------- tyres in the front and rear views (the side view's wheels come from the wheel spec; the plan hides them under the wings) ----------------
def tyre_face(fn, d0, d1, top_row, ground):
    m = (d0 + d1) / 2; h = ground - top_row; s = [(d0 + 2, 0), (d1 - 2, 0), (d1, 0.06), (d1 + 0.5, 0.5), (d1, 0.9), (d1 - 3, 0.97), (m, 1), (d0 + 3, 0.97), (d0, 0.9), (d0 - 0.5, 0.5), (d0, 0.06)]
    return [fn(d, ground - t * h) for d, t in s]
part('tyreF', 'wheel', 'rubber', 'fender', x=[FX - R, FX + R], pair=True, front=tyre_face(F, 100, 130, 94, FG), smooth=('front',), detail={'kind': 'treadFace', 'pitch': 34})
part('tyreR', 'wheel', 'rubber', 'fender', x=[RX - R, RX + R], pair=True, rear=tyre_face(B, 102, 134, 93, BG), smooth=('rear',), detail={'kind': 'treadFace', 'pitch': 34})
# the dark underside seen from the front and the rear between the wheels (axle, springs, frame ends in shadow)
# under the radiator and under the tail (review round 2): the shadow under the wings as a dark part, and in front of it
# the axle, springs, dumb irons and brake plates as the front and rear views show them, each its own vis_ part
IRON = '#2e2f33'
part('vis_underF', 'house', 'black', 'flat', x=[FX + 100, FX + 200], front=fhalf((0, 100), (100, 100), (100, 168), (0, 168)))
part('vis_axleF', 'axle', 'iron', 'flat', color=IRON, x=[FX - 40, FX + 40], front=fhalf((0, 175), (30, 174), (46, 171), (60, 168), (100, 167), (100, 174), (62, 175), (50, 178), (34, 181), (0, 182)))   # the beam, dropped in the middle
part('vis_leafF', 'spring', 'iron', 'flat', color='#1c1c20', pair=True, x=[FX - 300, FX + 300], front=fr((43, 160), (54, 160), (54, 172), (43, 172)))                 # the springs end on, under the dumb irons
part('vis_ironF', 'frame', 'iron', 'flat', color=IRON, pair=True, x=[S(8, 0)[0], FX], front=fr((45, 117), (52, 117), (53, 160), (44, 160)))                              # the dumb irons up to the lamp bar
part('vis_brakeF', 'axle', 'iron', 'flat', color='#1c1c20', pair=True, x=[FX - 150, FX + 150], front=fr((88, 128), (99, 126), (100, 184), (90, 182), (86, 170), (86, 140)))   # the brake plate inside each wheel
part('vis_damperF', 'damper', 'iron', 'flat', color=IRON, pair=True, x=[FX - 120, FX - 40], front=fr((57, 148), (70, 146), (72, 160), (58, 162)))
part('vis_underR', 'house', 'black', 'flat', x=[RX - 200, RX - 100], rear=bhalf((0, 150), (102, 150), (102, 170), (0, 170)))
part('vis_axleR', 'axle', 'iron', 'flat', color=IRON, x=[RX - 40, RX + 40], rear=bhalf((0, 164), (12, 165), (18, 168), (100, 168), (100, 177), (18, 177), (13, 181), (0, 182)))   # the axle tube with the final drive's bulge
part('vis_leafR', 'spring', 'iron', 'flat', color='#1c1c20', pair=True, x=[RX - 400, RX + 420], rear=re((82, 166), (96, 166), (96, 186), (84, 186)))                      # the springs and their shackles end on
part('vis_shackleR', 'spring', 'iron', 'flat', color='#1c1c20', pair=True, x=[RX + 300, RX + 430], rear=re((33, 170), (47, 170), (47, 183), (35, 183)))
part('vis_brakeR', 'axle', 'iron', 'flat', color='#1c1c20', pair=True, x=[RX - 150, RX + 150], rear=re((90, 150), (101, 150), (101, 186), (92, 186)))
part('vis_archF', 'house', 'black', 'flat', y=[-600, 600], side=side((14, 100), (30, 82), (50, 76), (75, 78), (95, 92), (108, 120), (112, 142), (14, 142)))   # the dark arch behind each wheel (side view)
part('vis_archR', 'house', 'black', 'flat', y=[-600, 600], side=side((370, 136), (374, 108), (385, 88), (403, 76), (420, 73), (440, 75), (462, 84), (478, 105), (484, 124), (486, 140), (370, 142)))

# ---------------- radiator ----------------
part('shell', 'radiator', 'paint', 'flat', slot='grille',
     side=side((62, 44), (63, 38), (67, 33), (80, 31), (80, 76), (62, 76)),
     front=fhalf((0, 38), (15, 40), (30, 46), (38, 54), (40.5, 70), (40.5, 140), (36, 147), (0, 148)), smooth=('front',),
     top=halfT((440, 0), (440, 37), (450, 31), (455, 12), (457, 0)),
     feats={'front': [{'kind': 'trim', 'pts': fr((-35, 140), (-35, 58), (-29, 52), (0, 51), (29, 52), (35, 58), (35, 140)), 'width': 2}]})
part('core', 'radiator', 'black', 'flat', on='shell', slot='grille', x=[S(62, 0)[0], S(62, 0)[0] + 15], front=fhalf((0, 52), (28, 52), (33, 57), (34, 139), (0, 140)), detail={'kind': 'core', 'pattern': 'slats', 'pitch': 40, 'metal': True})
part('coreBar', 'radiator', 'chrome', 'flat', on='core', slot='grille', lift=1, x=[S(62, 0)[0] - 4, S(62, 0)[0] + 10], front=fhalf((0, 50), (1.5, 50), (1.5, 140), (0, 140)))   # the bright centre bar
part('radCap', 'filler', 'chrome', 'fender', on='shell', slot='grille', smooth=('side',),
     side=side((66, 33), (66, 30), (70, 28), (76, 29), (78, 32)), front=fhalf((0, 44), (6, 40), (3, 34), (0, 30)), top=tell(452, 0, 5, 5, 12))

# ---------------- body: bonnet, scuttle, door panel, tail ----------------
part('hood', 'hood', 'paint', 'side', fit=2,
     side=side((80, 31), (120, 30.5), (170, 30), (220, 29), (220, 130), (112, 130), (108, 118), (100, 100), (90, 82), (80, 74)),
     front=fhalf((0, 36), (40, 37), (60, 42), (72, 52), (76, 70), (76, 140), (0, 140)), smooth=('front',),
     top=halfT((440, 0), (440, 37), (380, 44), (300, 54), (297, 30), (298, 0)),
     feats={'side': [{'kind': 'louvres', 'x0': S(112, 0)[0], 'x1': S(208, 0)[0], 'z0': S(0, 97)[1], 'z1': S(0, 66)[1], 'n': 25, 'slant': 0},
                     {'kind': 'seam', 'pts': side((82, 54), (150, 54), (219, 54))}, {'kind': 'highlight', 'pts': side((84, 41), (150, 40), (216, 39)), 'width': 2},
                     {'kind': 'seam', 'pts': side((83, 33), (83, 64))}],
            'top': [{'kind': 'trim', 'pts': [T(438, 0), T(300, 0)], 'width': 1},
                    {'kind': 'louvres', 'x0': T(410, 0)[0], 'x1': T(322, 0)[0], 'z0': T(0, 14)[1], 'z1': T(0, 36)[1], 'n': 26, 'slant': 0},
                    {'kind': 'louvres', 'x0': T(410, 0)[0], 'x1': T(322, 0)[0], 'z0': T(0, -40)[1], 'z1': T(0, -24)[1], 'n': 26, 'slant': 0}]})
part('cowl', 'cowl', 'paint', 'side', join=['hood'],
     side=side((220, 29), (232, 27.5), (244, 28), (252, 31), (257, 40), (262, 49), (262, 131), (220, 131)),
     front=fhalf((0, 32), (64, 32), (73, 36), (79, 46), (83, 62), (84, 80), (84, 140), (0, 140)), smooth=('front',),
     top=halfT((298, 0), (297, 30), (300, 54), (255, 60), (240, 62), (240, 0)),
     feats={'side': [{'kind': 'seam', 'pts': side((221, 30), (221, 124))}, {'kind': 'highlight', 'pts': side((224, 39), (250, 38)), 'width': 2}]})
part('body', 'body', 'paint', 'side', join=['cowl'],
     side=side((262, 49), (290, 50), (320, 52), (347, 56), (400, 57), (440, 54), (440, 131), (262, 131)),
     front=fhalf((0, 45), (84, 45), (90, 60), (92, 140), (0, 140)), rear=bhalf((0, 60), (92, 62), (97, 70), (98, 150), (0, 150)),
     top=halfT((240, 0), (240, 62), (175, 63), (140, 63), (108, 60), (108, 0)),
     feats={'side': [{'kind': 'seam', 'pts': side((261, 53), (261, 112), (264, 118), (338, 118), (347, 110), (347, 58))},            # the door: hinged at the rear, cut down at the top
                     {'kind': 'hinge', 'at': S(347, 67)}, {'kind': 'hinge', 'at': S(347, 98)}, {'kind': 'handle', 'at': S(266, 72), 'len': 60},
                     {'kind': 'highlight', 'pts': side((264, 53), (300, 54), (345, 59)), 'width': 1},
                     {'kind': 'seam', 'pts': side((262, 122), (360, 122))}]})
part('deck', 'deck', 'paint', 'fender', join=['body'], smooth=('top', 'rear'),
     side=side((440, 54), (447, 56), (454, 62), (462, 74), (468, 90), (472, 108), (472, 128), (440, 131)),
     rear=bhalf((0, 60), (60, 60), (92, 62), (97, 70), (99, 110), (98, 150), (92, 162), (0, 165)),
     top=halfT((108, 0), (108, 60), (80, 55), (55, 49), (40, 43), (30, 34), (25, 20), (23, 0)),
     feats={'top': [{'kind': 'seam', 'pts': top((107, 30), (78, 30), (70, 26), (66, 18), (65, 0), (66, -18), (70, -26), (78, -30), (107, -30))},   # the luggage lid
                    {'kind': 'hinge', 'at': T(104, 30)}, {'kind': 'hinge', 'at': T(104, -30)}]})
# the cockpit: the opening and its dark well. Nothing inside is drawn; seatgen.py adds the seat tops
part('cockpit', 'cockpit', 'black', 'flat', on='body', lift=1,
     side=side((264, 49), (272, 34), (280, 30), (288, 44), (300, 48), (320, 50), (345, 54), (347, 57), (320, 53), (290, 51)),
     rear=bhalf((0, 28), (80, 30), (88, 44), (88, 60), (0, 60)),
     top=halfT((240, 0), (240, 55), (175, 56), (145, 56), (140, 50), (138, 0)))
part('tonneau', 'tonneau', 'canvas', 'fender', color=TAN, on='body', lift=2, smooth=('side', 'top', 'rear'),
     side=side((341, 51), (345, 42), (350, 36), (360, 33), (375, 31), (390, 30), (400, 32), (410, 36), (425, 36), (432, 40), (437, 47), (441, 53), (430, 56), (400, 58), (360, 58), (345, 57)),
     rear=bhalf((0, 40), (90, 40), (97, 46), (99, 60), (93, 68), (80, 62), (50, 58), (0, 57)),
     top=halfT((108, 0), (108, 52), (112, 62), (125, 67), (150, 66), (170, 63), (176, 59), (170, 56), (145, 56), (140, 50), (138, 0)),
     feats={'side': [{'kind': 'crease', 'pts': side((343, 45), (360, 42), (385, 40), (410, 38))}, {'kind': 'bolt', 'at': S(354, 52)}, {'kind': 'bolt', 'at': S(408, 51)},
                     {'kind': 'highlight', 'pts': side((352, 36), (375, 33), (398, 33)), 'width': 1}],
            'rear': [{'kind': 'crease', 'pts': re((-90, 44), (-40, 50), (0, 48), (40, 50), (90, 44))}],
            'top': [{'kind': 'crease', 'pts': top((137, 50), (136, 0), (137, -50))}]})

# ---------------- the raked screen: frame, glass, the frame's top edge only in the plan ----------------
# review 71: the screen as the sheet draws it from the front: two panes meeting at a slight V on a centre post, a thin
# bright frame (posts leaning out from the scuttle, a top rail rising to the middle, a foot rail), the panes clear between
part('screenFrame', 'screen', 'chrome', 'flat',
     side=side((252, 42), (258, 26), (268, 2), (273, 0), (284, 3), (290, 8), (288, 12), (276, 26), (262, 46), (256, 46)),
     front=fhalf((0, 2), (40, 4), (78, 7), (85, 8), (85, 11), (78, 10.5), (40, 7.5), (0, 5.5)), rear=bhalf((0, 2), (40, 4), (78, 7), (85, 8), (85, 11), (78, 10.5), (40, 7.5), (0, 5.5)),
     top=[[S(268, 0)[0], -F(82, 0)[0]], [S(275, 0)[0], -F(82, 0)[0]], [S(271, 0)[0], 0], [S(275, 0)[0], F(82, 0)[0]], [S(268, 0)[0], F(82, 0)[0]], [S(264, 0)[0], 0]])
part('screen', 'screen', 'glass', 'side', on='screenFrame', lift=1, y=[-F(70, 0)[0], F(70, 0)[0]], side=side((259, 40), (270, 8), (280, 11), (263, 42)))
part('screenPane', 'screen', 'glass', 'side', on='screenFrame', lift=1, pair=True, x=[S(259, 0)[0], S(280, 0)[0]],
     front=fr((3, 8.5), (40, 9.5), (77, 12.5), (67, 30.5), (35, 28.5), (3, 27.5)), rear=re((3, 8.5), (40, 9.5), (77, 12.5), (67, 30.5), (35, 28.5), (3, 27.5)))
part('screenPost', 'screen', 'chrome', 'flat', on='screenFrame', lift=2, pair=True, x=[S(262, 0)[0], S(276, 0)[0]],
     front=fr((78, 8), (85, 9), (73, 37), (67, 37)), rear=re((78, 8), (85, 9), (73, 37), (67, 37)))
part('screenCentre', 'screen', 'chrome', 'flat', on='screenFrame', lift=2, x=[S(262, 0)[0], S(276, 0)[0]],
     front=fhalf((0, 4), (2.5, 4), (2.5, 30), (0, 30)), rear=bhalf((0, 4), (2.5, 4), (2.5, 30), (0, 30)))
part('screenFoot', 'screen', 'chrome', 'flat', on='screenFrame', lift=2, x=[S(256, 0)[0], S(266, 0)[0]],
     front=fhalf((0, 27), (35, 28), (68, 30.5), (69, 33), (35, 31), (0, 30)), rear=bhalf((0, 27), (35, 28), (68, 30.5), (69, 33), (35, 31), (0, 30)))
# the folded hood bunched beside the screen's posts, as the sheet shows it from the front
part('tonneauFront', 'tonneau', 'canvas', 'fender', color=TAN, pair=True, smooth=('front',), x=[S(300, 0)[0], S(330, 0)[0]], z=[F(0, 57)[1], F(0, 16)[1]],
     front=fr((70, 20), (78, 16), (86, 22), (94, 33), (100, 45), (99, 54), (92, 57), (84, 52), (78, 42), (72, 30)))
part('mirror', 'mirror', 'chrome', 'fender', on='screen', lift=2, x=[S(272, 0)[0], S(278, 0)[0]], front=fhalf((0, 16), (10, 16), (11, 19), (10, 25), (0, 25)), rear=bhalf((0, 16), (11, 16), (12, 19), (11, 24), (0, 24)), smooth=('front', 'rear'))

# ---------------- wings: dark (paint2), each one sweep; no outline where they run into each other ----------------
part('fenderF', 'fenderF', 'paint2', 'fender', slot='fenderF', pair=True, fit=2, smooth=('side', 'front', 'top'),
     side=side((5, 99), (8, 92), (13, 85), (20, 78), (30, 71), (45, 66), (60, 64), (75, 65), (90, 68), (105, 74), (120, 81), (135, 89), (150, 97), (170, 105), (190, 113), (205, 119), (220, 124), (240, 128), (262, 130), (356, 131),
               (356, 140), (250, 140), (150, 143), (112, 143), (109, 128), (104, 108), (97, 95), (85, 84), (70, 78), (50, 77), (35, 80), (22, 88), (13, 100), (8, 103)),
     front=fr((142, 92), (139, 75), (129, 66), (114, 62), (99, 64), (89, 70), (79, 82), (69, 100), (59, 120), (55, 138), (57, 141), (70, 125), (85, 108), (100, 100), (125, 98), (140, 102)),
     top=top((490, 47), (497, 55), (497, 70), (492, 82), (480, 90), (455, 93), (400, 92), (350, 86), (300, 81), (250, 80), (155, 80), (155, 62), (240, 62), (300, 54), (380, 44), (440, 37), (445, 48), (478, 49)),
     feats={'side': [{'kind': 'highlight', 'pts': side((22, 79), (40, 69), (60, 66), (85, 69), (120, 83), (160, 103), (200, 119), (240, 129)), 'width': 1},
                     {'kind': 'crease', 'pts': side((150, 100), (190, 117), (230, 129), (262, 133))}]})
part('board', 'board', 'chrome', 'flat', on='fenderF', lift=1, pair=True, y=[C - 230, C - 130], side=side((263, 131), (360, 131), (360, 134.5), (263, 134.5)))   # the bright strip along the sill step
part('fenderR', 'fenderR', 'paint2', 'fender', slot='fenderR', pair=True, fit=2, join=['fenderF'], smooth=('side', 'rear', 'top'),
     side=side((354, 140), (357, 124), (360, 108), (366, 92), (374, 79), (385, 68), (400, 61), (420, 58), (440, 60), (455, 66), (470, 77), (485, 93), (495, 108), (503, 120), (512, 130), (510, 134), (500, 133),
               (490, 122), (483, 108), (476, 95), (466, 85), (452, 77), (437, 73), (420, 72), (403, 75), (390, 82), (380, 93), (374, 107), (371, 122), (370, 136), (362, 140)),
     rear=re((99, 62), (110, 58), (125, 60), (135, 68), (141, 85), (143, 120), (141, 150), (132, 165), (118, 169), (105, 165), (100, 155), (98, 100)),
     top=top((155, 80), (150, 88), (130, 93), (100, 94), (60, 92), (35, 86), (20, 75), (12, 62), (15, 52), (25, 47), (40, 46), (60, 50), (105, 60), (155, 62)),
     feats={'side': [{'kind': 'highlight', 'pts': side((372, 86), (386, 71), (402, 64), (420, 61), (440, 63), (456, 70), (470, 81)), 'width': 1}]})
part('apronF', 'apron', 'paint2', 'fender', x=[S(20, 0)[0], S(62, 0)[0]], smooth=('front',), front=fhalf((0, 155), (35, 155), (38, 165), (30, 177), (0, 180)))   # the valance under the radiator

# ---------------- lamps, horns ----------------
part('lamp', 'lamp', 'chrome', 'fender', slot='lamp', pair=True, smooth=('side', 'front', 'top'),
     side=side((41, 47), (46, 45), (52, 47), (58, 52), (62, 57), (58, 60), (50, 62), (42, 62)), front=fell(59.5, 78, 19.5), z=[S(0, 62)[1], S(0, 45)[1]],
     top=top((472, 34), (475, 44), (472, 55), (462, 56), (450, 50), (442, 44), (450, 38), (462, 33)))
part('lens', 'lamp', 'chrome', 'flat', detail={'kind': 'bowl'}, on='lamp', slot='lamp', pair=True, lift=1, x=[S(40, 0)[0], S(42, 0)[0]], smooth=('front',), front=fell(59.5, 78, 17))
part('lampStand', 'lamp', 'chrome', 'flat', slot='lamp', pair=True, x=[S(48, 0)[0], S(54, 0)[0]], front=fr((55, 96), (64, 96), (64, 100), (62, 100), (62, 116), (57, 116), (57, 100), (55, 100)), side=side((48, 62), (54, 62), (54, 68), (48, 68)))
part('lampBar', 'lamp', 'chrome', 'flat', slot='lamp', top=halfT((462, 0), (462, 44), (458, 44), (458, 0)), front=fhalf((0, 97), (72, 97), (72, 100), (0, 100)))
part('horn', 'horn', 'chrome', 'fender', pair=True, smooth=('front', 'top'), top=top((477, 27), (470, 27), (466, 31), (470, 35), (477, 35)), front=fr((44, 126), (53, 126), (54, 132), (52, 140), (45, 140), (43, 132)))   # the small bells above the bumper irons (front view)

# ---------------- bumpers ----------------
part('bumperF', 'bumperF', 'chrome', 'fender', slot='bumperF', x=[S(0, 0)[0], S(8, 0)[0]],
     front=fhalf((0, 141), (95, 141), (98, 144), (98, 156), (95, 159), (0, 159)), top=halfT((495, 0), (495, 44), (494, 48), (491, 49.5), (487, 50), (481, 49.5), (478, 48), (477, 44), (477, 0)),
     side=side((0, 119), (6, 117), (9, 121), (9, 132), (6, 136), (0, 134)),
     feats={'front': [{'kind': 'seam', 'pts': fr((-95, 147.5), (95, 147.5))}, {'kind': 'seam', 'pts': fr((-95, 152), (95, 152))},
                      {'kind': 'highlight', 'pts': fr((-94, 143), (94, 143)), 'width': 1}, {'kind': 'highlight', 'pts': fr((-94, 154), (94, 154)), 'width': 1}],
            'top': [{'kind': 'seam', 'pts': top((487, -48), (487, 48))}, {'kind': 'highlight', 'pts': top((482, -46), (482, 46)), 'width': 2}]})
part('bumperFiron2', 'bumperF', 'chrome', 'flat', slot='bumperF', pair=True, z=[S(0, 134)[1], S(0, 121)[1]], top=top((462, 29), (497, 29), (497, 33.5), (462, 33.5)),          # the irons from the frame out past the bars (plan)
     feats={'top': [{'kind': 'bolt', 'at': T(481, 31)}, {'kind': 'bolt', 'at': T(492, 31)}]})
part('bumperFend', 'bumperF', 'chrome', 'fender', slot='bumperF', pair=True, on='bumperF', lift=1, x=[S(0, 0)[0], S(8, 0)[0]], smooth=('front', 'top'), front=fell(96, 141, 3), top=tell(486, 47, 3, 3, 10))   # the knobs at the bars' ends
part('vis_crossF', 'frame', 'black', 'flat', z=[S(0, 140)[1], S(0, 120)[1]], top=halfT((478, 0), (478, 47), (462, 47), (458, 30), (458, 0)),                     # the dark valance and cross member between lamps and bumper (plan), with its row of studs
     feats={'top': [{'kind': 'bolt', 'at': T(473, d)} for d in (-22, -11, 0, 11, 22)]})
part('bumperFgap', 'bumperF', 'black', 'flat', on='bumperF', lift=1, slot='bumperF', x=[S(0, 0)[0] - 2, S(4, 0)[0]], front=fhalf((0, 148), (95, 148), (95, 151.5), (0, 151.5)))   # the gap between the two bars
part('bumperFiron', 'bumperF', 'chrome', 'flat', on='bumperFgap', lift=2, slot='bumperF', pair=True, x=[S(0, 0)[0] - 4, S(4, 0)[0]], front=fr((45, 139), (53, 139), (53, 161), (45, 161)))
part('bumperR', 'bumperR', 'chrome', 'fender', slot='bumperR', x=[S(503, 0)[0], S(510, 0)[0]],
     rear=bhalf((0, 146), (100, 146), (102, 149), (100, 152), (0, 152)), side=side((503, 128), (511, 127), (513, 132), (511, 138), (503, 137)),
     feats={'rear': [{'kind': 'highlight', 'pts': re((-99, 147.5), (99, 147.5)), 'width': 1}]})
part('bumperRend', 'bumperR', 'chrome', 'fender', slot='bumperR', pair=True, z=[S(0, 138)[1], S(0, 127)[1]], smooth=('top',),                           # the plan shows only the bar's ends, running in under the spare
     top=top((10, 68), (15, 68), (17, 62), (23, 47), (19, 46), (13, 60)), feats={'top': [{'kind': 'bolt', 'at': T(13, 64)}]})
part('bumperRiron', 'bumperR', 'chrome', 'flat', on='bumperR', lift=1, slot='bumperR', pair=True, x=[S(506, 0)[0], S(511, 0)[0]], rear=re((97, 138), (103, 138), (103, 158), (97, 158)))

# ---------------- tail lamps on the rear wings; marker knobs on the wings' tails in the plan ----------------
part('tailRim', 'tail', 'chrome', 'fender', on='fenderR', lift=1, slot='tail', pair=True, smooth=('rear',), x=[S(500, 0)[0], S(504, 0)[0]], rear=bell(116, 111, 10.5))
part('tail', 'tail', 'lensR', 'flat', on='tailRim', lift=2, slot='tail', pair=True, smooth=('rear',), x=[S(504, 0)[0], S(506, 0)[0]], rear=bell(116, 111, 8), side=side((497, 96), (502, 96), (503, 101), (498, 102)))
part('markerR', 'marker', 'chrome', 'fender', on='fenderR', lift=1, pair=True, z=[S(0, 100)[1], S(0, 95)[1]], smooth=('top',), top=tell(36, 59, 5, 5, 10))

# ---------------- the spare on the tail (sparegen.py makes its size and its edge-on views) and its strap ----------------
part('spare', 'spare', 'rubber', 'fender', wheel={'r': R},
     side=side((470, 37), (495, 37), (495, 133), (470, 133)), rear=bell(0, 110, 60), top=halfT((0, 0), (0, 48), (54, 48), (54, 0)))
part('spareStrap', 'strap', 'wood', 'flat', color='#a8642e', on='spare', lift=3, x=[S(495, 0)[0], S(497, 0)[0]],
     rear=re((-3.5, 55), (3.5, 55), (3.5, 104), (8, 112), (43, 151), (37, 157), (0, 119), (-37, 157), (-43, 151), (-8, 112), (-3.5, 104)),
     top=top((55, -3), (33, -3), (33, 3), (55, 3)))
part('spareHub', 'spare', 'chrome', 'fender', on='spareStrap', lift=4, x=[S(497, 0)[0], S(499, 0)[0]], smooth=('rear',), rear=bell(0, 110, 9))

# ---------------- the outside exhaust: four flexible bright pipes out of the bonnet's right side (y < 0), read off v_right ----------------
RS = lambda px, py: S(514 - px, py)                                    # the right-hand side view's column, turned to the model's x
EXS = [((329, 73), (327, 84), (322, 97), (314, 110), (305, 121)), ((351, 73), (349, 86), (343, 98), (334, 108)), ((372, 73), (370, 84), (365, 92), (357, 98)), ((394, 73), (392, 81), (387, 86))]
EXT = [((338, 45), (334, 54), (327, 61), (318, 65)), ((360, 43), (356, 52), (349, 59), (341, 63)), ((384, 40), (380, 49), (373, 56), (365, 60)), ((407, 37), (403, 46), (396, 53), (388, 57))]
for k, (ps, pt) in enumerate(zip(EXS, EXT)):
    cl = [RS(*q) for q in ps]; ct = [T(*q) for q in pt]                                           # the plan's second coordinate is drawn upwards: positive = the car's right, as on the turned sheet
    hi = [[x + 22, z + 4] for x, z in cl]                                                    # the lit edge on the pipe's upper side
    part(f'vis_exhaust{k}', 'exhaust', 'chrome', 'fender', color=PIPE, on='hood', lift=1, y=[-640, -440], smooth=('side', 'top'), side=tube(cl, 62), top=tube(ct, 52),
         feats={'side': [{'kind': 'highlight', 'pts': hi, 'width': 1}], 'top': [{'kind': 'highlight', 'pts': [[x - 10, y - 8] for x, y in ct], 'width': 1}]})
    part(f'vis_exhaustPort{k}', 'exhaust', 'chrome', 'fender', on=f'vis_exhaust{k}', lift=2, y=[-470, -440], smooth=('side',), side=ell(*RS(ps[0][0], 71), 5.5 * K, 4 * K, 12))

# ---------------- the chassis under the body: the draft's chassis-layer parts moved onto this car's wheels ----------------
D = json.load(open(DRAFT)); dw = D['wheels']; kx = (RX - FX) / (dw[1]['x'] - dw[0]['x']); ky = W / D['width']; kz = H / D['height']
mx = lambda v: round(FX + (v - dw[0]['x']) * kx); my = lambda v: round(v * ky); mz = lambda v: round(v * kz)
for p in D['parts']:
    if p.get('layer') != 'chassis': continue
    q = json.loads(json.dumps(p)); b = q['box']; q['box'] = {'x': [mx(b['x'][0]), mx(b['x'][1])], 'y': [my(b['y'][0]), my(b['y'][1])], 'z': [mz(b['z'][0]), mz(b['z'][1])]}
    for v, sb in q.get('sheet', {}).items():
        fa, fb = {'side': (mx, mz), 'front': (my, mz), 'rear': (my, mz), 'top': (mx, my)}[v]; q['sheet'][v] = [fa(sb[0]), fa(sb[1]), fb(sb[2]), fb(sb[3])]
    P.append(q)

M = {'id': 'dueSSJ35', 'name': '1935 grand roadster', 'year': 1935, 'length': L, 'width': W, 'height': H, 'gloss': 0.85,
     'paint': '#a9a8ae', 'paint2': '#55585f', 'canvas': TAN, 'chrome': '#c2c2c0', 'glassTint': '#c9d6dc',
     'wheels': [{'x': FX, 'r': R, 'y': round(115 * W / FW)}, {'x': RX, 'r': R, 'y': round(118 * W / BW)}],
     'wheel': {'rim': 0.68, 'style': 'wire', 'spokes': 48, 'rimMaterial': 'chrome', 'cap': 0.14, 'capRings': 1},
     'parts': P}
json.dump(M, open(OUT, 'w'), indent=0)
print(OUT, len(P), 'parts;', sum(len(p['outlines']) for p in P), 'outlines')
print('outlines pulled onto the drawing, mean move in mm:', SNAP)
print('where a view of the sheet differs from the common box by more than 50 mm (each view keeps its own):'); print('\n'.join('  ' + n for n in notes))
