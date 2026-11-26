"""The 1933 light sports car (sheet 51747984, the left-hand car) as one 3D part model, made by hand in the way of
tools/ref/sedan29_model.py: every part is a box in the car's space (x from the front back, y from the centre line
outwards, z up; mm) and its outline as the sheet shows it from the side, the front or rear, and above. An open
two-seater with cycle wings: no roof, no glass house, no boards, no bumpers. Outlines are read point by point off
gridded enlargements of the views, in SOURCE pixels of each view (S side, F front, B rear, T plan). The body-layer
parts are written from scratch; the chassis-layer parts are the converter's draft's, moved onto this car's wheels.

  python3 fnTT33.py <views dir> <out json> [draft json] [repository root]"""
import sys, os, json, math
HERE = os.path.dirname(os.path.abspath(__file__))
VIEWS, OUT = sys.argv[1], sys.argv[2]
DRAFT = sys.argv[3] if len(sys.argv) > 3 else f'{HERE}/draft/fnTT33.json'
REPO = sys.argv[4] if len(sys.argv) > 4 else '/home/user/1/gearhouse'
sys.path.insert(0, f'{REPO}/tools/ref')
import cv2, numpy as np
from zkit import View, fit_closed
from shapely.geometry import Polygon, box as sbox
from shapely.affinity import scale as sscale
from shapely.ops import unary_union

# ---- scale: the hub caps are at 57 and 456 on the side view (521x198 px), the wheelbase is 2590 mm ----
K = 2590 / (456 - 57)                                     # 6.49 mm a pixel
G = 191.5                                                 # the ground's row on the side view (hub row 134 + tyre radius 57.5)
L, H, W = round(521 * K), round(G * K), 1600              # the width over the tyres: the plan gives 1325, the rear view 1720, the front view 1645; the model takes near the front's
C = W / 2
FX, RX, R = round(57 * K), round(456 * K), round(57.5 * K)
FG, FC, FW = 213, 144, 282                                # front view (288x216): ground row, centre column, width over the tyres
BG, BC, BW = 202, 143, 280                                # rear view (285x205)
TC, TW, TO = 104, 204, 3                                  # plan (516x210): centre row, width over the wings, its x lies 3 px ahead of the side view's
S = lambda px, py: [round(px * K), round((G - py) * K)]
F = lambda dx, py: [round(dx * W / FW), round((FG - py) * H / FG)]
B = lambda dx, py: [round(dx * W / BW), round((BG - py) * H / BG)]
T = lambda px, dy: [round((px + TO) * K), round(dy * K)]            # the plan keeps its own (narrower) width: one scale both ways
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
def tell(px, dy, rx, ry, n=24): return ell(*T(px, dy), rx * K, ry * K, n)

os.makedirs(f'{HERE}/work', exist_ok=True)
def _view(name, w, h):
    t = f'{HERE}/work/_fit_{name}.png'; cv2.imwrite(t, cv2.resize(cv2.imread(f'{VIEWS}/v_{name}.png', cv2.IMREAD_UNCHANGED), (round(w / 10), round(h / 10)), interpolation=cv2.INTER_AREA)); V = View(t, w); V.edge = np.maximum(V.sil * 3, V.grad); return V
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
              **({'slot': slot} if slot else {}), **({'detail': detail} if detail else {}), **({'features': f2} if f2 else {}), **({'cutWheel': cutWheel} if cutWheel else {}), **({'wheel': wheel} if wheel else {}), **({'lift': lift} if lift else {}), **({'on': on} if on else {}), **({'color': color} if color else {}), **({'layer': layer} if layer else {})})

LEATHER = '#8a4a26'; FRAMEG = '#18281b'
# ---------------- tyres as the front, rear and plan views show them (the side view's wheels come from the wheel spec) ----------------
def tyre_face(fn, d0, d1, top_row, ground):
    """a tyre seen face on: flat where it stands, round at the top; d0, d1 its inner and outer edge from the centre line"""
    m = (d0 + d1) / 2; h = ground - top_row; s = [(d0 + 2, 0), (d1 - 2, 0), (d1, 0.06), (d1 + 0.5, 0.5), (d1, 0.9), (d1 - 3, 0.97), (m, 1), (d0 + 3, 0.97), (d0, 0.9), (d0 - 0.5, 0.5), (d0, 0.06)]
    return [fn(d, ground - t * h) for d, t in s]
part('tyreF', 'wheel', 'rubber', 'fender', x=[FX - R, FX + R], pair=True, front=tyre_face(F, 108, 139, 88, FG), top=top((30, 80), (84, 80), (84, 98), (30, 98)), smooth=('front',), detail={'kind': 'treadFace', 'pitch': 34})
part('tyreR', 'wheel', 'rubber', 'fender', x=[RX - R, RX + R], pair=True, rear=tyre_face(B, 110, 138, 80, BG), top=top((400, 80), (480, 80), (480, 98), (400, 98)), smooth=('rear',), detail={'kind': 'treadFace', 'pitch': 34})

# ---------------- running gear seen from outside (vis_: the car's own parts, not the chassis layer) ----------------
part('vis_frame', 'frame', 'paint2', 'flat', color=FRAMEG, y=[-430, 430],                 # the deep side rail, painted, under the body from the front wing's tail to the rear wheel
     side=side((122, 121), (258, 121), (258, 128), (386, 128), (400, 126), (400, 152), (330, 155), (122, 152)))
part('vis_axleF', 'axle', 'iron', 'flat', x=[FX - 40, FX + 40], front=fhalf((0, 171), (44, 169), (58, 161), (100, 157), (106, 152), (108, 166), (62, 171), (48, 178), (0, 180)))   # dropped beam, front view
part('vis_axleFtop', 'axle', 'iron', 'flat', z=[S(0, 150)[1], S(0, 140)[1]], top=halfT((61, 0), (61, 78), (71, 78), (71, 0)))                       # the same beam from above, between the wings
part('vis_crossF', 'frame', 'black', 'flat', x=[FX - 60, FX + 200], front=fhalf((0, 160), (58, 160), (60, 176), (22, 180), (12, 188), (0, 190)))   # the dark mass under the radiator: cross tube and sump
part('vis_leafF', 'spring', 'iron', 'flat', pair=True, x=[FX - 200, FX + 200], front=fr((45, 138), (57, 138), (57, 150), (45, 150)), top=top((40, 30), (75, 38), (100, 46), (100, 50), (75, 43), (40, 35)))   # the dumb irons and springs, converging forward in the plan
part('vis_under', 'apron', 'black', 'flat', y=[-400, 400], side=side((132, 150), (400, 152), (400, 156), (132, 155)))                  # the shadowed underside below the rails
part('vis_axleRtop', 'axle', 'iron', 'flat', pair=True, z=[S(0, 140)[1], S(0, 128)[1]], top=top((455, 50), (470, 50), (470, 78), (455, 78)))
part('vis_brakeR', 'axle', 'black', 'flat', pair=True, x=[RX - 60, RX + 60], rear=re((84, 140), (100, 140), (100, 172), (86, 172)))               # brake gear and spring hangers below the axle (rear view)
part('vis_underR', 'frame', 'black', 'flat', x=[RX - 100, RX + 100], rear=bhalf((0, 156), (76, 156), (76, 166), (20, 168), (12, 176), (0, 177)))   # the frame's rear cross member and final drive under the tail
part('vis_damperR', 'damper', 'iron', 'flat', pair=True, x=[RX - 120, RX - 40], rear=re((89, 88), (98, 88), (99, 150), (89, 150)))               # the upright dampers and their links beside the tail (rear view)
part('vis_brakeF', 'axle', 'black', 'flat', pair=True, x=[FX - 100, FX + 100], front=fr((96, 140), (108, 140), (108, 185), (98, 185)))            # the brake back plate and king pin inside the wheel (front view)
part('vis_damperF', 'damper', 'iron', 'flat', pair=True, x=[FX - 90, FX - 10], front=fr((44, 150), (56, 150), (57, 176), (43, 176)))        # friction dampers either side of the dumb irons, front view
part('vis_axleR', 'axle', 'iron', 'flat', pair=True, x=[RX - 35, RX + 35], rear=re((80, 128), (108, 128), (108, 140), (80, 140)))        # the solid rear axle's ends beside the body, rear view
# the outside exhaust on the left (review 69: read again off a 6x crop of the side view and a 5x crop of the plan): the
# down pipe out of the bonnet side, tapering back to the silencer with its end caps, a short bent pipe down, a ribbed
# flexible length with a clamp, the tail pipe running on to the sprocket. In the plan it lies along the body's foot, the
# dark body side and frame filling between them, so it reads as fixed to the car, not hanging beside it.
EX = '#a49c8c'
part('vis_exhaust', 'exhaust', 'iron', 'fender', color=EX, y=[430, 510],
     side=side((128, 119), (131, 118.5), (150, 119.5), (175, 121), (200, 122.5), (214, 123.5), (214, 131.5), (200, 131), (175, 129.5), (150, 128.5), (131, 128), (128, 127)),
     top=top((95, -52), (130, -58), (170, -66), (214, -73), (214, -80), (170, -73), (130, -65), (95, -59)),
     feats={'side': [{'kind': 'highlight', 'pts': side((133, 120), (175, 122), (211, 124.5)), 'width': 1}],
            'top': [{'kind': 'highlight', 'pts': top((98, -54), (170, -68), (211, -75)), 'width': 1}]})
part('vis_silencer', 'exhaust', 'iron', 'fender', color='#b0a898', y=[430, 530], smooth=('side',),
     side=side((214, 125), (216, 124.5), (259, 124.5), (261.5, 126), (261.5, 142), (259, 143), (216, 143), (214, 142)),
     top=top((214, -72), (260, -72), (260, -88), (214, -88)),
     feats={'side': [{'kind': 'seam', 'pts': side((217, 125), (217, 142.5))}, {'kind': 'seam', 'pts': side((258, 125), (258, 142.5))},
                     {'kind': 'highlight', 'pts': side((219, 127), (256, 127)), 'width': 2}, {'kind': 'crease', 'pts': side((219, 140), (256, 140))}],
            'top': [{'kind': 'highlight', 'pts': top((217, -76), (257, -76)), 'width': 1}]})
part('vis_bend', 'exhaust', 'iron', 'fender', color='#968e80', y=[440, 500],
     side=side((261.5, 131), (268, 132), (278, 136), (288, 139), (288, 145), (277, 142.5), (267, 139), (261.5, 138)),
     top=top((260, -77), (288, -78), (288, -83), (260, -83)))
part('vis_flexPipe', 'exhaust', 'iron', 'fender', color='#8a8274', y=[440, 500],
     side=side((288, 138.5), (321, 139), (321, 146), (288, 145.5)), top=top((288, -77), (321, -78), (321, -83), (288, -83)),
     feats={'side': [{'kind': 'louvres', 'x0': S(290, 0)[0], 'x1': S(319, 0)[0], 'z0': S(0, 145)[1], 'z1': S(0, 139.5)[1], 'n': 9, 'slant': 0}]})
part('vis_clamp', 'exhaust', 'chrome', 'flat', on='vis_flexPipe', lift=1, y=[440, 505], side=side((298, 137.5), (301, 137.5), (301, 147), (298, 147)))
part('vis_sideFoot', 'apron', 'black', 'flat', y=[380, 470], z=[S(0, 160)[1], S(0, 150)[1]],      # the plan: the dark body side and frame between the body's edge and the pipe
     top=top((95, -40), (130, -51), (170, -58), (214, -63), (260, -69), (321, -70), (321, -79), (260, -78), (214, -74), (170, -67), (130, -59), (95, -54)))
part('vis_chain', 'chain', 'iron', 'flat', color='#b8b8b4', y=[330, 360],                   # the chain's two runs from the sprocket to the rear axle (side view)
     side=side((321, 136), (326, 128), (336, 124), (360, 120), (400, 110), (400, 115), (362, 125), (352, 129), (355, 140), (352, 152), (346, 157), (400, 157), (400, 161), (336, 161), (326, 156), (321, 146)))
part('vis_chainCase', 'chain', 'paint2', 'flat', color='#2c3a26', on='vis_chain', y=[360, 372], lift=1, side=sell(338, 141, 14, 15, 10))   # the faceted sprocket guard

# ---------------- radiator ----------------
part('shell', 'radiator', 'chrome', 'flat', slot='grille',
     side=side((50, 66), (50, 59), (53, 53), (58, 50), (66, 48), (72, 49), (76, 52), (77, 66), (77, 150), (52, 150)),
     front=fhalf((0, 49), (18, 50), (27, 53), (32, 60), (33, 100), (32, 152), (28, 158), (0, 159)), smooth=('front',),
     top=halfT((55, 0), (55, 20), (58, 30), (70, 33), (70, 0)))
part('core', 'radiator', 'black', 'flat', on='shell', slot='grille', x=[S(50, 0)[0], S(50, 0)[0] + 15], front=fhalf((0, 60), (24, 60), (27, 63), (27, 150), (0, 150)))
part('guard', 'guard', 'iron', 'flat', on='core', slot='grille', lift=1, x=[S(50, 0)[0] - 5, S(50, 0)[0] + 10], color='#3a3a38', front=fhalf((0, 60), (24, 60), (27, 63), (27, 150), (0, 150)), detail={'kind': 'cells', 'pitch': 22})   # the stone guard: a mesh over the whole core
part('badge', 'radiator', 'chrome', 'flat', on='shell', slot='grille', lift=2, x=[S(50, 0)[0] - 6, S(50, 0)[0] + 4], color='#8a3030', front=fhalf((0, 50), (7, 51), (6, 56), (0, 60)))
part('radCap', 'filler', 'chrome', 'fender', on='shell', slot='grille', smooth=('side',),
     side=side((69, 48), (69, 44), (72, 42), (70, 38), (72, 34), (78, 32), (84, 34), (85, 38), (82, 42), (84, 45), (84, 49)), top=tell(74, 0, 5, 5, 12))

# ---------------- body: bonnet, scuttle, the cockpit sides, the tail over the slab tank ----------------
part('hood', 'hood', 'paint', 'side', fit=2,
     side=side((77, 51), (100, 46), (118, 42), (150, 40), (190, 38), (220, 36), (253, 34), (254, 122), (128, 122), (126, 112), (118, 98), (108, 86), (95, 76), (77, 68)),
     front=fhalf((0, 29), (48, 29), (58, 31), (65, 36), (69, 46), (71, 60), (72, 150), (0, 150)), smooth=('front',), nofit=('front',),
     top=halfT((70, 0), (70, 33), (95, 42), (120, 53), (160, 59), (200, 64), (255, 71), (255, 0)),
     feats={'side': [{'kind': 'louvres', 'x0': S(130, 0)[0], 'x1': S(188, 0)[0], 'z0': S(0, 108)[1], 'z1': S(0, 72)[1], 'n': 12, 'slant': 0},
                     {'kind': 'seam', 'pts': side((201, 53), (249, 52), (249, 118), (201, 118), (201, 53))}, {'kind': 'seam', 'pts': side((78, 62), (120, 60), (190, 58), (252, 56))},
                     {'kind': 'highlight', 'pts': side((80, 55), (118, 52), (150, 50), (190, 48)), 'width': 1}],
            'top': [{'kind': 'trim', 'pts': [T(80, 0), T(255, 0)], 'width': 1},
                    {'kind': 'louvres', 'x0': T(132, 0)[0], 'x1': T(245, 0)[0], 'z0': T(0, 14)[1], 'z1': T(0, 32)[1], 'n': 22, 'slant': 0},
                    {'kind': 'louvres', 'x0': T(132, 0)[0], 'x1': T(245, 0)[0], 'z0': T(0, -32)[1], 'z1': T(0, -14)[1], 'n': 22, 'slant': 0}]})
for k, (sx, y0, y1, tx, td) in enumerate(((119, 40, 114, 122, 55), (191, 35, 148, 196, 66))):                   # two leather straps over the bonnet
    part(f'strap{k}', 'strap', 'wood', 'flat', color=LEATHER, on='hood', lift=1, side=side((sx, y0), (sx + 7, y0), (sx + 7, y1), (sx, y1)), top=halfT((tx, 0), (tx, td), (tx + 7, td), (tx + 7, 0)))
    part(f'buckle{k}', 'strap', 'chrome', 'flat', on=f'strap{k}', lift=2, side=side((sx - 1, y0 + 14), (sx + 9, y0 + 14), (sx + 9, y0 + 22), (sx - 1, y0 + 22)), y=[T(0, td)[1] - 60, T(0, td)[1]])
part('cowl', 'cowl', 'paint', 'side', fit=2, nofit=('front', 'rear'),
     side=side((254, 34), (262, 33), (270, 33), (279, 36), (284, 40), (289, 47), (295, 58), (300, 66), (304, 73), (304, 128), (254, 128)),
     front=fhalf((0, 27), (60, 26), (66, 28), (70, 32), (72, 40), (74, 60), (80, 80), (84, 150), (0, 150)), smooth=('front', 'rear'),
     rear=bhalf((0, 27), (60, 26), (66, 28), (71, 33), (74, 42), (78, 60), (86, 80), (86, 150), (0, 150)),
     top=halfT((255, 0), (255, 71), (300, 71), (300, 0)),
     feats={'side': [{'kind': 'seam', 'pts': side((262, 56), (298, 56))}, {'kind': 'seam', 'pts': side((260, 36), (260, 126))}]})
part('body', 'body', 'paint', 'side', fit=2, nofit=('front', 'rear'),
     side=side((304, 73), (310, 76), (320, 77.5), (335, 79), (350, 81), (365, 83), (374, 84), (378, 82), (386, 128), (304, 128)),
     front=fhalf((0, 62), (80, 62), (86, 75), (88, 150), (0, 150)), rear=bhalf((0, 62), (82, 62), (88, 80), (89, 150), (0, 150)),
     top=halfT((300, 0), (300, 71), (350, 70), (395, 67), (395, 0)),
     feats={'side': [{'kind': 'bead', 'pts': side((304, 74), (320, 78.5), (350, 82), (374, 85))}, {'kind': 'seam', 'pts': side((304, 76), (303, 122))}]})   # the cutaway's bright edge; the door's front shut line
part('deck', 'deck', 'paint', 'fender', fit=2, nofit=('rear',), smooth=('top',),
     side=side((374, 84), (380, 72), (386, 56), (391, 44), (396, 39), (405, 40), (420, 43), (445, 49), (458, 53), (470, 58), (485, 66), (497, 74), (506, 84), (511, 95), (512, 104), (506, 127), (386, 128)),
     rear=bhalf((0, 50), (30, 51), (50, 54), (62, 60), (72, 70), (78, 85), (80, 100), (80, 150), (75, 156), (0, 156)),
     top=halfT((392, 0), (392, 67), (420, 65), (450, 60), (475, 53), (495, 43), (506, 31), (512, 15), (514, 0)),
     feats={'rear': [{'kind': 'seam', 'pts': re((-46, 62), (-46, 152))}, {'kind': 'seam', 'pts': re((46, 62), (46, 152))}, {'kind': 'seam', 'pts': re((-46, 119), (46, 119))},
                     {'kind': 'highlight', 'pts': re((-60, 62), (0, 56), (60, 62)), 'width': 1}],
            'side': [{'kind': 'seam', 'pts': side((400, 42), (397, 60), (392, 80))}, {'kind': 'seam', 'pts': side((442, 49), (441, 58))}, {'kind': 'highlight', 'pts': side((403, 45), (420, 47), (440, 51)), 'width': 1}],
            'top': [{'kind': 'seam', 'pts': [T(408, -64), T(408, 64)]}, {'kind': 'seam', 'pts': [T(472, -52), T(472, 52)]}]})
part('fuelCap', 'filler', 'chrome', 'fender', on='deck', lift=1, smooth=('side', 'rear', 'top'),
     side=side((444, 48), (447, 43), (455, 41), (461, 44), (463, 48), (455, 50)), rear=bell(0, 72, 11), top=tell(447, 1, 12, 12))
# the cockpit: the opening and its dark well (nothing inside is drawn). From the side only the part of the well that
# stands above the cutaway shows: where the sheet has the seat back against the tail
part('cockpit', 'cockpit', 'black', 'flat', lift=1,
     side=side((353, 82), (360, 66), (371, 48), (378, 44), (391, 44), (386, 56), (380, 72), (374, 84)),
     rear=bhalf((0, 36), (40, 37), (60, 40), (70, 48), (74, 62), (0, 62)),
     top=halfT((298, 0), (298, 64), (380, 64), (390, 58), (396, 45), (398, 0)))

# ---------------- twin aero screens ----------------
part('screenFrame', 'screen', 'chrome', 'flat', pair=True,
     side=side((270, 47), (275, 30), (282, 10), (287, 0), (292, 2), (288, 14), (281, 34), (277, 50)),
     front=fr((12, 24), (16, 22), (16, 9), (19, 3), (25, 0), (58, 0), (63, 3), (65, 10), (65, 23), (68, 25), (68, 29), (12, 29)),
     top=top((285, 10), (292, 10), (292, 64), (285, 64)),
     rear=re((9, 24), (14, 22), (14, 9), (17, 3), (23, 0), (58, 0), (64, 3), (67, 10), (67, 23), (74, 25), (74, 29), (9, 29)))
part('screen', 'screen', 'glass', 'side', on='screenFrame', pair=True, lift=1,
     side=side((277, 34), (283, 12), (287, 3), (289, 4), (285, 14), (279, 35)), front=fr((19, 5), (22, 3), (58, 3), (61, 6), (61, 22), (19, 22)), rear=re((18, 5), (21, 3), (60, 3), (63, 6), (63, 22), (18, 22)))
part('screenPivot', 'screen', 'chrome', 'fender', on='cowl', lift=2, pair=True, y=[T(0, 60)[1], T(0, 68)[1]], side=sell(272, 47, 3.5, 3.5, 12))

# ---------------- cycle wings ----------------
part('fenderF', 'fenderF', 'paint', 'fender', slot='fenderF', pair=True, fit=2, nofit=('front', 'top'), smooth=('side', 'front', 'top'),
     side=side((10, 88), (14, 82), (22, 76), (32, 70), (45, 66), (58, 65), (72, 67), (84, 72), (95, 80), (105, 90), (113, 100), (120, 112), (124, 122), (128, 135), (130, 160), (129, 165), (122, 165),
               (121, 150), (119, 135), (115, 120), (108, 105), (100, 93), (90, 84), (78, 78), (65, 75), (50, 75), (35, 78), (22, 84), (12, 90)),
     front=fr((102, 87), (103, 78), (108, 70), (115, 66), (123, 65), (131, 66), (138, 70), (143, 78), (144, 87), (140, 89), (107, 89), (107, 150), (96, 150), (95, 100), (98, 91)),   # the dome over the tyre, and inboard of the tyre the wing's tail coming down behind it
     top=top((0, 90), (5, 98), (20, 101), (100, 101), (120, 96), (135, 85), (120, 78), (100, 75), (15, 75), (3, 80)),
     feats={'side': [{'kind': 'highlight', 'pts': side((30, 72), (50, 68), (72, 69), (90, 78), (104, 91), (116, 108)), 'width': 1}]})
part('fenderR', 'fenderR', 'paint', 'fender', slot='fenderR', pair=True, fit=2, nofit=('rear', 'top'), smooth=('side', 'rear', 'top'),
     side=side((378, 114), (381, 100), (388, 88), (397, 77), (410, 68), (425, 63), (445, 61), (462, 62), (478, 66), (492, 73), (503, 82), (512, 92), (520, 104), (517, 108), (508, 107),
               (500, 96), (490, 86), (478, 78), (462, 73), (445, 71), (428, 73), (414, 78), (403, 86), (395, 96), (390, 108), (387, 120), (379, 120)),
     rear=re((101, 79), (103, 68), (109, 60), (117, 56), (125, 55), (133, 57), (139, 62), (142, 70), (143, 79), (139, 81), (108, 81), (108, 150), (96, 150), (95, 95), (98, 84)),
     top=top((360, 85), (372, 95), (390, 100), (480, 101), (492, 96), (497, 88), (492, 79), (480, 75), (385, 75), (368, 79)),
     feats={'side': [{'kind': 'highlight', 'pts': side((392, 86), (410, 71), (428, 66), (450, 64), (478, 69)), 'width': 1}]})
part('fenderStayF', 'fenderF', 'chrome', 'fender', slot='fenderF', pair=True, x=[FX - 20, FX + 10], color='#77787a', front=fr((60, 111), (104, 111), (104, 116), (60, 116)))     # the tube from the frame out to the wing (front view)
part('fenderStayR', 'fenderR', 'paint2', 'flat', slot='fenderR', pair=True, color=FRAMEG, y=[480, 510], side=side((373, 120), (381, 120), (381, 150), (374, 150)))               # the upright behind the cockpit (side view)
part('markerF', 'marker', 'chrome', 'fender', on='fenderF', slot='fenderF', pair=True, lift=1, x=[FX - 15, FX + 15], front=fr((121, 66), (121, 62), (123, 61), (125, 62), (125, 66)))
part('markerR', 'marker', 'chrome', 'fender', on='fenderR', slot='fenderR', pair=True, lift=1, side=side((497, 71), (501, 68), (506, 71), (512, 77), (509, 81), (503, 79)), rear=re((120, 57), (120, 53), (122, 52), (124, 53), (124, 57)))

# ---------------- lamps, mirror ----------------
part('lamp', 'lamp', 'chrome', 'fender', slot='lamp', pair=True, smooth=('side', 'front', 'top'),
     side=sell(48, 76, 13, 19), front=fell(52.5, 84, 22), top=top((32, 59), (32, 30), (34, 26), (45, 27), (55, 32), (60, 43), (55, 54), (45, 60), (34, 62)))
part('lampGap', 'lamp', 'iron', 'flat', on='lamp', slot='lamp', pair=True, x=[T(32, 0)[0], T(32, 0)[0] + 10], smooth=('front',), front=fell(52.5, 84, 19.5))
part('lens', 'lamp', 'lens', 'flat', on='lampGap', slot='lamp', pair=True, x=[T(32, 0)[0] - 1, T(32, 0)[0] + 8], smooth=('front',), front=fell(52.5, 84, 18.5))
# left out: the 'cells' detail draws near black and hides the pale lens the sheet shows through the mesh
# part('lampGuard', 'guard', 'chrome', 'flat', on='lens', slot='lamp', pair=True, lift=1, x=[T(32, 0)[0] - 6, T(32, 0)[0] + 2], smooth=('front',), front=fell(52.5, 84, 18.5), detail={'kind': 'cells', 'pitch': 40})   # mesh stone guards over both head lamps
part('lampBar', 'lamp', 'chrome', 'fender', slot='lamp', x=[T(45, 0)[0], T(45, 0)[0] + 25], front=fhalf((0, 136), (54, 136), (56, 134), (58, 138), (56, 142), (54, 140), (0, 140)))
part('lampStand', 'lamp', 'iron', 'flat', slot='lamp', pair=True, x=[T(45, 0)[0], T(45, 0)[0] + 25], front=fr((49, 105), (55, 105), (55, 136), (49, 136)))
# the mirror on the car's right (the driver's side), a spot lamp on its left: front and rear views. y > 0 is the car's left
part('mirror', 'mirror', 'chrome', 'fender', smooth=('front', 'rear'), x=[S(268, 0)[0], S(274, 0)[0]], front=[[-p[0], p[1]] for p in fell(93, 40, 11)], rear=[[-p[0], p[1]] for p in bell(90, 38, 11)])
part('mirrorArm', 'mirror', 'chrome', 'flat', x=[S(268, 0)[0], S(272, 0)[0]], front=[[-p[0], p[1]] for p in fr((68, 37), (84, 37), (84, 40), (68, 40))])
part('spotLamp', 'lamp', 'chrome', 'fender', smooth=('front', 'rear', 'side'), side=sell(268, 44, 5, 6, 12), front=fell(80, 45, 9), rear=bell(81, 41, 7))

# ---------------- tail lamps on stalks beside the tail (rear view) ----------------
part('tailStalk', 'tail', 'iron', 'flat', slot='tail', pair=True, x=[L - 30, L - 20], rear=re((68, 118), (73, 118), (73, 150), (76, 152), (76, 158), (66, 158), (66, 152), (68, 150)))
part('tailRim', 'tail', 'chrome', 'fender', slot='tail', pair=True, smooth=('rear',), x=[L - 20, L - 10], rear=bell(70, 111, 8.5))
part('tail', 'tail', 'lensR', 'flat', on='tailRim', slot='tail', pair=True, smooth=('rear',), lift=1, x=[L - 10, L], rear=bell(70, 111, 6))

# ---------------- the chassis under the body: the draft's chassis-layer parts moved onto this car's wheels ----------------
D = json.load(open(DRAFT)); dw = D['wheels']; kx = (RX - FX) / (dw[1]['x'] - dw[0]['x']); ky = W / D['width']; kz = H / D['height']
mx = lambda v: round(FX + (v - dw[0]['x']) * kx); my = lambda v: round(v * ky); mz = lambda v: round(v * kz)
for p in D['parts']:
    if p.get('layer') != 'chassis': continue
    q = json.loads(json.dumps(p)); b = q['box']; q['box'] = {'x': [mx(b['x'][0]), mx(b['x'][1])], 'y': [my(b['y'][0]), my(b['y'][1])], 'z': [mz(b['z'][0]), mz(b['z'][1])]}
    for v, sb in q.get('sheet', {}).items():
        fa, fb = {'side': (mx, mz), 'front': (my, mz), 'rear': (my, mz), 'top': (mx, my)}[v]; q['sheet'][v] = [fa(sb[0]), fa(sb[1]), fb(sb[2]), fb(sb[3])]
    P.append(q)

M = {'id': 'fnTT33', 'name': '1933 light sports', 'year': 1933, 'length': L, 'width': W, 'height': H,
     'paint': '#1f4a2c', 'paint2': '#18281b', 'canvas': '#606060', 'chrome': '#b4b4b2', 'glassTint': '#b9cfe0',
     'wheels': [{'x': FX, 'r': R, 'y': round(123.5 * W / FW)}, {'x': RX, 'r': R, 'y': round(124 * W / BW)}],
     'wheel': {'rim': 0.70, 'style': 'wire', 'spokes': 48, 'rimMaterial': 'chrome', 'cap': 0.16, 'capRings': 1},   # wire wheels, bright rims, a small knock-off hub
     'parts': P}
json.dump(M, open(OUT, 'w'), indent=0)
print(OUT, len(P), 'parts;', sum(len(p['outlines']) for p in P), 'outlines')
print('outlines pulled onto the drawing, mean move in mm:', SNAP)
print('where a view of the sheet differs from the common box by more than 50 mm (each view keeps its own):'); print('\n'.join('  ' + n for n in notes))
