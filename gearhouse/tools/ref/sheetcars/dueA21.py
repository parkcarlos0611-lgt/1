"""The 1921 grand coupe (sheet 94e0a997, the right-hand column) as one 3D part model, made by hand in the way of
tools/ref/sedan29_model.py: every part is a box in the car's space (x from the front back, y from the centre line
outwards, z up; mm) and its outline as the sheet shows it from the side, the front or rear, and above. Outlines are read
point by point off gridded enlargements of the sheet's views (work/grid.py), in positions on a 4x enlargement of each
view (S side, F front, B rear, T plan). Nothing is snapped: black on black gives the line fitter nothing to hold.
The sheet draws the plan with the front to the right; T() takes x measured from the car's front (1896 - the sheet's x).
Body-layer parts are written from scratch; the chassis-layer parts are the draft's, moved onto this car's wheels.

  python3 dueA21.py <views dir> <out json> [draft json] [repository root]"""
import sys, os, json, math
HERE = os.path.dirname(os.path.abspath(__file__))
VIEWS, OUT = sys.argv[1], sys.argv[2]
DRAFT = sys.argv[3] if len(sys.argv) > 3 else f'{HERE}/draft/dueA21.json'
REPO = sys.argv[4] if len(sys.argv) > 4 else '/home/user/1/gearhouse'

# ---- scale: the hub caps on the 4x side view are at x 234 and 1598: 1364 units are the 3404 mm wheelbase. The tyres
# run 400..799 in height (40..430 across): radius 198 units ----
K = 3404 / (1598 - 234)                                   # 2.496 mm per unit (9.98 mm a pixel)
SW, SH, FW, FH, BW, BH, TW, TH = 1900, 800, 964, 992, 940, 912, 1896, 728   # the views in 4x units (475x200, 241x248, 235x228, 474x182 px)
L, H = round(SW * K), round(SH * K); W = round(FW * H / FH)   # review 70: the front view keeps the sheet's proportions            # width: the views disagree (front 1930 over the wings at the side's height scale, rear 2050, plan 1780); the draft's 1890 is kept
C = W / 2
FX, RX, R = round(234 * K), round(1598 * K), round(198 * K)
# the plan's body lies 7 units off the middle of its cut (the wings do not): the model stays symmetric about the middle
TC = 364                                                  # the plan's centre line (the car sits 7 units above the middle of its cut)
S = lambda px, py: [round(px * L / SW), round(H - py * H / SH)]
F = lambda dx, py: [round(dx * H / FH), round(H - py * H / FH)]
B = lambda dx, py: [round(dx * H / BH), round(H - py * H / BH)]
T = lambda px, dy: [round(px * L / TW), round(dy * W / TH)]
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
def rrect(x0, z0, x1, z1, r, n=5):
    out = []
    for cx, cz, a0 in ((x1 - r, z1 - r, 0), (x0 + r, z1 - r, 90), (x0 + r, z0 + r, 180), (x1 - r, z0 + r, 270)):
        for k in range(n + 1): a = math.radians(a0 + 90 * k / n); out.append([round(cx + math.cos(a) * r), round(cz + math.sin(a) * r)])
    return out
def frrect(a, b, c, d, r):
    (x0, z1), (x1, z0) = F(a, b), F(c, d); return rrect(x0, z0, x1, z1, r)
P = []; notes = []
def part(id, element, material, surface='side', *, layer=None, color=None, on=None, join=None, fit=0, nofit=(), x=None, y=None, z=None, pair=False, slot=None, smooth=(), detail=None, feats=None, wheel=None, lift=0, **views):
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
            if g['kind'] == 'handle': g['len'] = g.get('len', 110) / max(1, ba[1] - ba[0])
            if g['kind'] == 'louvres': (g['x0'], g['z0']), (g['x1'], g['z1']) = nu([g['x0'], g['z0']]), nu([g['x1'], g['z1']])
            f2.setdefault(v, []).append(g)
    P.append({'id': id, 'element': element, 'material': material, 'surface': surface, 'box': box, 'sheet': sheet, 'pair': pair, 'outlines': o,
              **({'slot': slot} if slot else {}), **({'detail': detail} if detail else {}), **({'features': f2} if f2 else {}), **({'wheel': wheel} if wheel else {}), **({'lift': lift} if lift else {}), **({'on': on} if on else {}), **({'color': color} if color else {}), **({'join': join} if join else {}), **({'layer': layer} if layer else {})})
def srrect(a, b, c, d, r):
    (x0, z1), (x1, z0) = S(a, b), S(c, d); return rrect(x0, z0, x1, z1, r)
def brrect(a, b, c, d, r):
    (x0, z1), (x1, z0) = B(a, b), B(c, d); return rrect(x0, z0, x1, z1, r)
def trrect(a, b, c, d, r):
    (x0, y0), (x1, y1) = T(a, b), T(c, d); return rrect(x0, y0, x1, y1, r)
def closed(p): return p + [p[0]]

BLK = '#151517'                                           # the sheet's black of the wheel houses and the under side
BODY = '#1b1b1e'; ROOF = '#242427'; NICKEL = '#d6cab8'
SM = ('side', 'front', 'rear', 'top')
# ---------------- running gear seen from outside ----------------
def arch(wx, r, lo, hi):
    """the dark of a wheel house: a half circle over the wheel, kept inside lo..hi"""
    a = [[min(hi, max(lo, round(wx + math.cos(t) * r))), round(R + math.sin(t) * r)] for t in [math.pi * k / 16 for k in range(16, -1, -1)]]
    return [[a[0][0], R - 120]] + a + [[a[-1][0], R - 120]]
part('house0', 'house', 'black', 'flat', color=BLK, y=[0, 560], side=arch(FX, 545, S(30, 0)[0], S(560, 0)[0]))
part('house1', 'house', 'black', 'flat', color=BLK, y=[0, 560], side=arch(RX, 600, S(1362, 0)[0], S(1856, 0)[0]))
# the dark under the body between the wheels (side), and in the plan the dark between the bonnet and the wings
part('under', 'apron', 'black', 'flat', color=BLK, y=[0, 560],
     side=side((420, 480), (470, 530), (520, 575), (560, 600), (1370, 600), (1370, 648), (640, 652), (440, 640)))
part('underTop', 'apron', 'black', 'flat', color=BLK, z=[S(0, 640)[1], S(0, 600)[1]], top=halfT((176, 0), (176, 230), (906, 240), (906, 0)))
# the frame's front: horns and the cross tube ahead of the radiator (side: the horn ends; front: the tube under the shell; plan: the bar and the dark round the open arc)
part('vis_backF', 'frame', 'black', 'flat', color=BLK, x=[FX + 80, FX + 120], front=fhalf((0, 560), (322, 560), (322, 800), (0, 800)))
part('vis_axleF', 'axle', 'black', 'fender', color='#33333a', x=[FX - 40, FX + 40], front=fhalf((0, 802), (200, 798), (322, 795), (322, 838), (250, 868), (200, 846), (0, 846)))
part('vis_drumF', 'axle', 'black', 'fender', color='#2c2c31', pair=True, x=[FX - 60, FX + 60], front=fr((305, 690), (322, 685), (322, 836), (305, 830)))
part('vis_dragF', 'axle', 'black', 'fender', color='#3a3a41', pair=True, x=[FX - 80, FX - 60], front=fr((212, 792), (308, 728), (312, 738), (218, 804)))
part('vis_leafF', 'spring', 'black', 'flat', color='#3c3c44', pair=True, x=[S(30, 0)[0], FX - 100], detail={'kind': 'ribs', 'pitch': 14}, front=fr((162, 770), (202, 770), (202, 842), (162, 842)))
part('vis_hornF', 'frame', 'black', 'fender', color='#5a5c66', pair=True,
     side=side((2, 578), (28, 562), (62, 560), (62, 640), (4, 640)), front=fr((168, 670), (200, 670), (203, 762), (166, 762)), top=top((60, 150), (176, 150), (176, 176), (60, 176)),
     feats={'front': [{'kind': 'bolt', 'at': F(170, 760)}, {'kind': 'bolt', 'at': F(200, 760)}], 'side': [{'kind': 'bolt', 'at': S(14, 580)}, {'kind': 'bolt', 'at': S(12, 630)}]})
part('vis_crossF', 'frame', 'black', 'fender', color='#383840', x=[S(4, 0)[0], S(40, 0)[0]], front=fhalf((0, 700), (170, 700), (170, 755), (0, 755)), top=halfT((55, 0), (55, 150), (74, 150), (74, 0)),
     feats={'front': [{'kind': 'highlight', 'pts': [F(-165, 722), F(165, 722)], 'width': 2}]})
part('vis_knobF', 'frame', 'black', 'fender', color='#5a5c66', pair=True, z=[S(0, 620)[1], S(0, 580)[1]], top=top((42, 150), (48, 146), (76, 146), (82, 154), (82, 172), (76, 178), (48, 178), (42, 172)))
part('vis_apronF', 'apron', 'black', 'flat', color='#17171a', x=[S(50, 0)[0], S(70, 0)[0]], front=fhalf((0, 755), (160, 755), (160, 822), (120, 843), (0, 847)))
part('vis_crank', 'crank', 'chrome', 'flat', x=[S(2, 0)[0], S(6, 0)[0]], front=fell(0, 760, 7), smooth=('front',))
part('vis_frameF', 'frame', 'black', 'flat', color=BLK, z=[S(0, 640)[1], S(0, 580)[1]], top=halfT((176, 0), (176, 200), (56, 200), (56, 150), (100, 125), (122, 85), (130, 0)))
# from in front: the axle, springs and steering as one dark mass between the tyres under the cross tube
# from behind: the fuel tank between the frame horns with its two straps, the axle's dark mass under it; in the plan the tank and the frame's end behind the body
part('vis_frameR', 'frame', 'black', 'flat', color=BLK, z=[S(0, 640)[1], S(0, 580)[1]], top=halfT((1551, 0), (1551, 214), (1786, 200), (1806, 185), (1806, 0)))
part('vis_backR', 'frame', 'black', 'flat', color=BLK, x=[RX - 120, RX - 80], rear=bhalf((0, 587), (313, 587), (313, 770), (0, 770)))
part('vis_axleR', 'axle', 'black', 'fender', color='#33333a', x=[RX - 40, RX + 40], rear=bhalf((0, 762), (313, 758), (313, 800), (250, 810), (60, 800), (0, 800)))
part('vis_diffR', 'axle', 'black', 'fender', color='#3a3a42', x=[RX + 40, RX + 70], smooth=('rear',), rear=bhalf((0, 735), (30, 740), (52, 760), (52, 785), (30, 804), (0, 808)))
part('vis_leafR', 'spring', 'black', 'flat', color='#3c3c44', pair=True, x=[RX + 100, RX + 200], detail={'kind': 'ribs', 'pitch': 14}, rear=re((173, 720), (203, 720), (203, 792), (173, 792)))
part('vis_tankBody', 'tank', 'paint2', 'fender', color='#1c1c20', x=[RX + 200, RX + 300], rear=bhalf((0, 642), (215, 642), (215, 700), (0, 700)))
part('vis_tank', 'tank', 'paint2', 'fender', color='#3a3c44', x=[RX + 220, RX + 320], rear=bhalf((0, 608), (209, 608), (209, 642), (0, 642)), top=halfT((1616, 0), (1616, 152), (1741, 152), (1741, 0)),
     feats={'rear': [{'kind': 'highlight', 'pts': [B(-200, 636), B(200, 636)], 'width': 2}], 'top': [{'kind': 'seam', 'pts': closed(trrect(1626, -140, 1731, 140, 20))}]})
part('vis_barR', 'frame', 'black', 'fender', color='#34363d', x=[RX + 230, RX + 330], rear=bhalf((0, 700), (222, 700), (222, 716), (0, 716)))
part('vis_rodR', 'axle', 'black', 'fender', color='#2e2e34', x=[RX + 60, RX + 80], rear=bhalf((0, 746), (180, 746), (180, 753), (0, 753)))
part('vis_hornR', 'frame', 'black', 'fender', color='#5a5c66', pair=True, x=[RX + 260, RX + 360], rear=re((165, 606), (205, 606), (205, 718), (165, 718)),
     feats={'rear': [{'kind': 'bolt', 'at': B(168, 652)}, {'kind': 'bolt', 'at': B(202, 652)}, {'kind': 'bolt', 'at': B(168, 712)}, {'kind': 'bolt', 'at': B(202, 712)}]})
def tyre(y0, y1, n=6): return rrect(y0, 0, y1, 2 * R, round((y1 - y0) * 0.42), n)
TF = (F(322, 0)[0], F(442, 0)[0]); TR = (B(313, 0)[0], B(440, 0)[0])
part('tyreF', 'wheel', 'rubber', 'fender', x=[FX - R, FX + R], pair=True, front=tyre(*TF), smooth=('front',), detail={'kind': 'treadFace', 'pitch': 30})
part('tyreR', 'wheel', 'rubber', 'fender', x=[RX - R, RX + R], pair=True, rear=tyre(*TR), smooth=('rear',), detail={'kind': 'treadFace', 'pitch': 30})

# ---------------- radiator ----------------
part('shell', 'radiator', 'chrome', 'fender', slot='grille', color=NICKEL,
     side=side((182, 300), (178, 258), (200, 248), (216, 243), (268, 243), (268, 374), (192, 374)),
     front=fhalf((0, 313), (60, 318), (110, 335), (135, 360), (145, 392), (145, 700), (0, 700)),
     top=halfT((176, 0), (176, 120), (184, 131), (246, 136), (246, 0)))
part('core', 'radiator', 'black', 'flat', slot='grille', on='shell', lift=1, color='#39332b', x=[S(184, 0)[0], S(190, 0)[0]], detail={'kind': 'core', 'pattern': 'slats', 'pitch': 14},
     front=fhalf((0, 368), (100, 368), (122, 380), (122, 693), (0, 693)))
part('badge', 'radiator', 'chrome', 'flat', slot='grille', on='shell', lift=2, x=[S(180, 0)[0], S(184, 0)[0]], front=fell(0, 345, 13), smooth=('front',))
# the filler cap with its winged mascot
part('cap', 'filler', 'chrome', 'fender', color=NICKEL, smooth=('top',),
     side=side((214, 243), (216, 212), (224, 194), (256, 194), (262, 210), (268, 243)),
     front=fhalf((0, 240), (18, 246), (38, 258), (22, 272), (10, 290), (14, 313), (0, 313)), top=tell(206, 0, 24))
# ---------------- bonnet, cowl, body, roof ----------------
part('hood', 'hood', 'paint', 'hood', smooth=('front',),
     side=side((268, 236), (282, 226), (690, 226), (690, 556), (500, 556), (425, 470), (390, 432), (350, 410), (300, 398), (268, 394)),
     front=fhalf((0, 306), (80, 310), (140, 332), (165, 370), (170, 440), (170, 700), (0, 700)),
     top=halfT((246, 0), (246, 130), (741, 202), (741, 0)),
     feats={'side': [{'kind': 'trim', 'pts': side((270, 310), (690, 310)), 'width': 1}, {'kind': 'highlight', 'pts': side((290, 262), (680, 262)), 'width': 2},
                     {'kind': 'louvres', 'x0': S(362, 0)[0], 'x1': S(638, 0)[0], 'z0': S(0, 482)[1], 'z1': S(0, 368)[1], 'n': 24, 'slant': 0}],
            'top': [{'kind': 'trim', 'pts': top((256, 0), (736, 0)), 'width': 1},
                    {'kind': 'highlight', 'pts': top((256, 88), (736, 150)), 'width': 2}, {'kind': 'highlight', 'pts': top((256, -88), (736, -150)), 'width': 2}]})
part('cowl', 'cowl', 'paint', 'hood', smooth=('front',), join=['hood'],
     side=side((690, 226), (800, 226), (818, 222), (880, 222), (880, 556), (690, 556)),
     front=fhalf((0, 290), (150, 295), (215, 320), (240, 365), (242, 560), (0, 560)),
     top=halfT((741, 0), (741, 202), (906, 232), (906, 0)),
     feats={'side': [{'kind': 'seam', 'pts': side((692, 228), (692, 554))}, {'kind': 'trim', 'pts': side((690, 310), (740, 306), (790, 297), (835, 284), (880, 292)), 'width': 1},
                     {'kind': 'highlight', 'pts': side((700, 262), (780, 258), (815, 240)), 'width': 2}],
            'top': [{'kind': 'seam', 'pts': top((748, -200), (748, 200))}]})
DOORF, DOORR = 880, 1168
part('body', 'body', 'paint', 'side', color=BODY,
     side=side((818, 222), (822, 44), (1476, 44), (1481, 100), (1481, 280), (1445, 300), (1440, 380), (1415, 405), (1392, 440), (1375, 485), (1362, 540), (1356, 556), (880, 556), (880, 222)),
     front=fhalf((0, 40), (337, 40), (337, 400), (330, 430), (300, 470), (270, 560), (0, 560)),
     rear=bhalf((0, 56), (337, 56), (337, 400), (300, 420), (275, 470), (270, 587), (0, 587)),
     top=halfT((906, 0), (906, 296), (1551, 296), (1551, 0)),
     feats={'side': [{'kind': 'seam', 'pts': side((DOORF, 50), (DOORF, 222))}, {'kind': 'seam', 'pts': side((DOORR, 50), (DOORR, 554))},
                     {'kind': 'trim', 'pts': side((880, 292), (1160, 291), (1400, 287), (1481, 276)), 'width': 1},
                     {'kind': 'highlight', 'pts': side((886, 552), (1350, 552)), 'width': 1},
                     {'kind': 'handle', 'at': S(1150, 316), 'len': 150},
                     {'kind': 'hinge', 'at': S(879, 88)}, {'kind': 'hinge', 'at': S(879, 240)}, {'kind': 'hinge', 'at': S(879, 482)}],
            'front': [{'kind': 'seam', 'pts': fr((283, 60), (283, 290))}, {'kind': 'seam', 'pts': fr((-283, 60), (-283, 290))}],
            'rear': [{'kind': 'trim', 'pts': re((-337, 330), (-200, 309), (0, 303), (200, 309), (337, 330)), 'width': 1},
                     {'kind': 'seam', 'pts': closed(brrect(-185, 400, 185, 557, 40))},
                     {'kind': 'seam', 'pts': re((283, 70), (290, 300))}, {'kind': 'seam', 'pts': re((-283, 70), (-290, 300))}]})
YB = F(337, 0)[0]                                         # the body's half width, where the side windows lie
part('roof', 'roof', 'canvas', 'roof', color=ROOF, smooth=('top',),
     side=side((806, 44), (810, 24), (828, 10), (900, 4), (1380, 6), (1440, 20), (1472, 42), (1483, 70), (1483, 92), (1464, 60), (1440, 46), (840, 46)),
     front=fhalf((0, 3), (300, 3), (328, 12), (339, 34), (339, 42), (0, 42)),
     rear=bhalf((0, 3), (290, 5), (322, 22), (338, 50), (338, 60), (0, 58)),
     top=rrect(T(906, 0)[0], -T(0, 305)[1], T(1551, 0)[0], T(0, 305)[1], 120),
     feats={'top': [{'kind': 'seam', 'pts': closed(trrect(946, -270, 1511, 270, 90))}, {'kind': 'highlight', 'pts': top((960, 292), (1500, 292)), 'width': 2}, {'kind': 'highlight', 'pts': top((960, -292), (1500, -292)), 'width': 2}],
            'side': [{'kind': 'highlight', 'pts': side((840, 14), (1400, 14)), 'width': 2}]})
# side windows: a frame standing proud of the body, a dark reveal, the glass
WIN = (((890, 55, 1150, 262), (905, 75, 1118, 247), 30), ((1192, 60, 1380, 262), (1204, 80, 1340, 233), 45))
for k, (fo, gl, r) in enumerate(WIN):
    part(f'wframe{k}', 'body', 'paint2', 'side', on='body', pair=True, y=[YB - 6, YB - 4], side=srrect(*fo, 40))
    part(f'wreveal{k}', 'body', 'black', 'flat', on=f'wframe{k}', lift=1, color=BLK, pair=True, y=[YB - 4, YB - 2], side=srrect(fo[0] + 7, fo[1] + 8, fo[2] - 8, fo[3] - 8, 30))
    part(f'glass{k}', 'body', 'glass', 'side', on=f'wreveal{k}', lift=2, pair=True, y=[YB - 2, YB], side=srrect(*gl, r))
# the windscreen: an upright frame in two panes with a centre bar (the roof's peak hides its top edge in the plan)
XS = [S(820, 0)[0], S(836, 0)[0]]
part('screenFrame', 'screen', 'paint2', 'side', x=XS, front=frrect(-242, 70, 242, 293, 30))
part('screen', 'screen', 'glass', 'side', on='screenFrame', lift=1, pair=True, x=XS, front=frrect(8, 82, 230, 281, 22))
part('screenBar', 'screen', 'paint2', 'side', on='screenFrame', lift=2, x=XS, front=fhalf((0, 80), (8, 80), (8, 283), (0, 283)))
# the rear window: two panes in one bright-edged frame
XR = [S(1476, 0)[0], S(1482, 0)[0]]
part('rearFrame', 'body', 'paint2', 'side', on='body', x=XR, rear=brrect(-157, 93, 157, 247, 40))
part('rearGlass', 'body', 'glass', 'side', on='rearFrame', lift=1, pair=True, x=XR, rear=brrect(12, 110, 142, 232, 22))

# ---------------- valance, board, wings ----------------
part('apron', 'apron', 'paint', 'side', color=BODY, y=[0, YB - 20], side=side((500, 556), (1356, 556), (1350, 604), (560, 604)))
part('board', 'board', 'paint2', 'flat', slot='board', pair=True, color='#19191b', side=side((600, 602), (1346, 602), (1346, 630), (600, 630)), top=top((626, 200), (626, 265), (1376, 265), (1376, 200)))
part('boardTrim', 'board', 'chrome', 'flat', slot='board', on='board', lift=1, pair=True, side=side((602, 602), (1344, 602), (1344, 611), (602, 611)), top=top((626, 256), (626, 265), (1376, 265), (1376, 256)))
part('fenderF', 'fenderF', 'paint2', 'fender', slot='fenderF', pair=True, smooth=SM, join=['board'],
     side=side((22, 492), (30, 450), (50, 420), (80, 396), (120, 378), (180, 366), (260, 362), (310, 368), (350, 385), (390, 410), (430, 450), (470, 500), (510, 545), (550, 580), (600, 600), (690, 604),
               (690, 626), (600, 624), (545, 604), (500, 567), (460, 522), (425, 472), (390, 434), (350, 407), (300, 392), (250, 386), (180, 390), (120, 402), (82, 422), (58, 447), (44, 480), (34, 497)),
     front=fr((482, 500), (478, 460), (455, 435), (400, 427), (340, 435), (315, 455), (305, 500), (290, 560), (262, 640), (225, 715), (205, 730), (215, 742), (245, 702), (285, 627), (318, 572), (345, 553), (400, 556), (455, 550), (478, 530)),
     top=top((6, 236), (16, 278), (36, 334), (106, 360), (256, 355), (456, 324), (606, 298), (626, 282), (626, 232), (456, 217), (206, 207), (81, 197), (16, 192)))
part('fenderR', 'fenderR', 'paint2', 'fender', slot='fenderR', pair=True, smooth=SM, join=['board'],
     side=side((1345, 628), (1350, 600), (1362, 540), (1375, 485), (1392, 440), (1415, 405), (1440, 380), (1445, 300), (1481, 290), (1600, 298), (1700, 330), (1770, 380), (1810, 430), (1840, 500), (1860, 540), (1885, 562), (1898, 570), (1890, 590), (1860, 596),
               (1850, 580), (1840, 540), (1822, 490), (1795, 440), (1750, 398), (1690, 372), (1590, 360), (1520, 370), (1460, 395), (1420, 430), (1390, 480), (1375, 540), (1362, 618), (1360, 628)),
     rear=re((470, 520), (462, 440), (430, 408), (380, 400), (300, 405), (275, 440), (268, 520), (275, 620), (300, 690), (350, 712), (410, 700), (445, 660), (462, 600)),
     top=top((1376, 240), (1376, 328), (1396, 339), (1446, 355), (1546, 360), (1796, 358), (1866, 334), (1896, 278), (1890, 236), (1846, 192), (1571, 212), (1551, 215), (1551, 240)))

# ---------------- lamps ----------------
# drum headlamps in nickel on posts from the frame horns
part('lamp', 'lamp', 'chrome', 'fender', slot='lamp', pair=True, smooth=SM, color=NICKEL,
     side=side((98, 292), (120, 290), (140, 296), (158, 306), (172, 318), (180, 331), (184, 345), (181, 354), (170, 359), (140, 361), (98, 361)),
     front=fell(202, 483, 73), top=top((96, 99), (120, 100), (150, 112), (175, 128), (192, 146), (199, 157), (199, 167), (192, 178), (175, 196), (150, 208), (120, 214), (96, 215)))
part('lampRim', 'lamp', 'chrome', 'fender', slot='lamp', pair=True, color='#e8e0d2',
     side=side((84, 294), (88, 289), (99, 289), (99, 364), (88, 364), (84, 358)), front=fell(202, 483, 73), top=top((83, 97), (96, 97), (96, 217), (83, 217)))
part('lens', 'lamp', 'chrome', 'flat', slot='lamp', pair=True, on='lampRim', lift=1, smooth=SM, detail={'kind': 'bowl'},
     side=side((84, 300), (79, 312), (78, 327), (79, 342), (84, 354)), front=fell(202, 483, 62), top=top((83, 104), (78, 120), (76, 157), (78, 194), (83, 210)))
part('lampStand', 'lamp', 'black', 'fender', slot='lamp', pair=True, color='#2a2a30', y=[F(186, 0)[0], F(198, 0)[0]],
     side=side((86, 362), (102, 362), (104, 394), (90, 398)), front=fr((186, 553), (198, 553), (198, 668), (186, 668)))
part('lampStay', 'lamp', 'black', 'fender', slot='lamp', pair=True, color='#1d1d21', y=[F(150, 0)[0], F(186, 0)[0]],
     side=side((150, 302), (164, 286), (180, 283), (186, 300), (192, 372), (150, 372), (176, 345), (172, 322)))
# one red tail lamp in a nickel rim on the back of each rear wing
part('tailRim', 'tail', 'chrome', 'fender', slot='tail', pair=True, on='fenderR', lift=1, smooth=('rear',), rear=bell(337, 547, 27),
     side=side((1812, 462), (1830, 466), (1837, 480), (1831, 494), (1815, 492)))
part('tail', 'tail', 'lensR', 'flat', slot='tail', pair=True, on='tailRim', lift=2, smooth=('rear',), x=[S(1830, 0)[0], S(1837, 0)[0]], rear=bell(337, 547, 18))

# ---------------- the chassis under the body: the draft's chassis-layer parts moved onto this car's wheels ----------------
D = json.load(open(DRAFT)); dw = D['wheels']; kx = (RX - FX) / (dw[1]['x'] - dw[0]['x']); ky = W / D['width']; kz = H / D['height']
mx = lambda v: round(FX + (v - dw[0]['x']) * kx); my = lambda v: round(v * ky); mz = lambda v: round(v * kz)
for p in D['parts']:
    if p.get('layer') != 'chassis': continue
    q = json.loads(json.dumps(p)); b = q['box']; q['box'] = {'x': [mx(b['x'][0]), mx(b['x'][1])], 'y': [my(b['y'][0]), my(b['y'][1])], 'z': [mz(b['z'][0]), mz(b['z'][1])]}
    for v, sb in q.get('sheet', {}).items():
        fa, fb = {'side': (mx, mz), 'front': (my, mz), 'rear': (my, mz), 'top': (mx, my)}[v]; q['sheet'][v] = [fa(sb[0]), fa(sb[1]), fb(sb[2]), fb(sb[3])]
    P.append(q)

M = {'id': 'dueA21', 'name': '1921 grand coupe', 'year': 1921, 'length': L, 'width': W, 'height': H, 'gloss': 0.75,
     'paint': BODY, 'paint2': '#1e1e21', 'canvas': ROOF, 'chrome': '#c7b8a7', 'glassTint': '#939b9f',
     'wheels': [{'x': FX, 'r': R, 'y': round((TF[0] + TF[1]) / 2)}, {'x': RX, 'r': R, 'y': round((TR[0] + TR[1]) / 2)}],
     # wire wheels in black (about 40 spokes), a small nickel cap; the white wall runs from just outside the rim over 0.58 of the tyre's height
     'wheel': {'rim': 0.63, 'style': 'wire', 'spokes': 40, 'rimMaterial': 'paint', 'cap': 0.14, 'capRings': 1, 'whitewall': 0.58},
     'parts': P}
json.dump(M, open(OUT, 'w'), indent=0)
print(OUT, len(P), 'parts;', sum(len(p['outlines']) for p in P), 'outlines', '| L H W', L, H, W, 'FX RX R', FX, RX, R)
print('where a view of the sheet differs from the common box by more than 50 mm (each view keeps its own):'); print('\n'.join('  ' + n for n in notes))
