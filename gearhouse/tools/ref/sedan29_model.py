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
sideS = Sheet(f'{VIEWS}/v_left.png', L, H); frontS = Sheet(f'{VIEWS}/v_front.png', W, H)
P = []; notes = []
def part(id, element, material, surface='side', *, x=None, y=None, z=None, pair=False, slot=None, smooth=(), detail=None, feats=None, cutWheel=None, wheel=None, lift=0, **views):
    """views: side=[[x,z]..], front=[[y,z]..], rear=[[y,z]..] or 'front', top=[[x,y]..]; the box comes from the side view
    (x, z) and the front or top view (y) unless given"""
    bb = lambda pts, k: [min(p[k] for p in pts), max(p[k] for p in pts)]
    if views.get('rear') == 'front': views['rear'] = views['front']
    X = x or (bb(views['side'], 0) if 'side' in views else bb(views['top'], 0)); Z = z or (bb(views['side'], 1) if 'side' in views else bb(views.get('front') or views['rear'], 1))
    fr = views.get('front') or views.get('rear'); Y = y or (bb(fr, 0) if fr else bb(views['top'], 1))
    axes = {'side': (X, Z), 'front': (Y, Z), 'rear': (Y, Z), 'top': (X, Y)}; o = {}; f2 = {}
    for v, pts in views.items():
        a, b = axes[v]; ba, bbz = bb(pts, 0), bb(pts, 1)
        for name, own, box in ((f'{v} across', ba, a), (f'{v} up', bbz, b)):
            if abs((own[1] - own[0]) - (box[1] - box[0])) > 60 or abs((own[0] + own[1]) / 2 - (box[0] + box[1]) / 2) > 60: notes.append(f'{id:10s} {name:12s} sheet {own} -> model {box}')
        nu = lambda p: [round((p[0] - ba[0]) / max(1, ba[1] - ba[0]), 4), round((p[1] - bbz[0]) / max(1, bbz[1] - bbz[0]), 4)]
        o[v] = [nu(p) + ([0] if v in smooth else [1]) for p in pts]
        for f in (feats or {}).get(v, []):
            g = dict(f)
            if 'pts' in g: g['pts'] = [nu(p) for p in g['pts']]
            if 'at' in g: g['at'] = nu(g['at'])
            if g['kind'] == 'louvres': (g['x0'], g['z0']), (g['x1'], g['z1']) = nu([g['x0'], g['z0']]), nu([g['x1'], g['z1']])
            if g['kind'] == 'handle': g['len'] = g.get('len', 110) / max(1, ba[1] - ba[0])
            f2.setdefault(v, []).append(g)
    P.append({'id': id, 'element': element, 'material': material, 'surface': surface, 'box': {'x': X, 'y': Y, 'z': Z}, 'pair': pair, 'outlines': o,
              **({'slot': slot} if slot else {}), **({'detail': detail} if detail else {}), **({'features': f2} if f2 else {}), **({'cutWheel': cutWheel} if cutWheel else {}), **({'wheel': wheel} if wheel else {}), **({'lift': lift} if lift else {})})

# ---------------- chassis parts seen from outside ----------------
for i, wx in enumerate((FX, RX)):
    part(f'house{i}', 'frame', 'black', 'flat', y=[0, 560], side=[[wx - 440, 440]] + [[round(wx + math.cos(a) * 440), round(400 + math.sin(a) * 440)] for a in [math.pi * k / 14 for k in range(14, -1, -1)]] + [[wx + 440, 440]])
part('frame', 'frame', 'black', 'flat', y=[-420, 420], side=[[150, 440], [3740, 440], [3740, 560], [150, 560]], front=half([0, 440], [420, 440], [420, 560], [0, 560]), rear='front')
part('axleF', 'axle', 'black', 'flat', x=[470, 546], front=half([0, 330], [640, 330], [640, 400], [560, 400], [520, 365], [0, 365]))
part('springF', 'spring', 'iron', 'flat', x=[480, 536], front=half([0, 520], [120, 510], [400, 450], [560, 400], [560, 430], [400, 480], [120, 545], [0, 555]))
part('axleR', 'axle', 'black', 'flat', x=[3090, 3184], rear=half([0, 250], [120, 260], [170, 330], [640, 345], [640, 415], [170, 430], [120, 500], [0, 510]), smooth=('rear',))
part('springR', 'spring', 'iron', 'flat', x=[3200, 3260], rear=half([0, 560], [120, 550], [420, 480], [580, 420], [580, 450], [420, 512], [120, 585], [0, 595]))
tyre = [[633, 0], [747, 0], [752, 40], [752, 722], [747, 762], [633, 762], [628, 722], [628, 40]]
part('tyreF', 'wheel', 'rubber', 'fender', x=[FX - R, FX + R], pair=True, front=tyre, detail={'kind': 'planks', 'pitch': 45})
part('tyreR', 'wheel', 'rubber', 'fender', x=[RX - R, RX + R], pair=True, rear=tyre, detail={'kind': 'planks', 'pitch': 45})

# ---------------- body ----------------
part('apron', 'apron', 'black', 'flat', y=[-640, 640], side=side((560, 585), (1262, 585), (1262, 702), (560, 702)), top=halfT([1300, 0], [1300, 640], [2700, 640], [2700, 0]))
part('shell', 'radiator', 'chrome', 'fender', slot='grille',
     side=side((243, 292), (250, 274), (275, 271), (284, 285), (284, 640), (243, 640)),
     front=fhalf((0, 300), (55, 306), (98, 328), (120, 368), (127, 420), (125, 600), (118, 632), (0, 636)), smooth=('front',),
     top=halfT([512, 0], [512, 250], [600, 265], [600, 0]))
part('core', 'radiator', 'black', 'flat', slot='grille', x=[505, 520], front=fhalf((0, 356), (70, 360), (104, 384), (112, 430), (112, 598), (100, 622), (0, 626)), smooth=('front',), detail={'kind': 'ribs', 'pitch': 30})
part('cap', 'radiator', 'chrome', 'flat', slot='grille', side=side((252, 272), (250, 252), (262, 240), (274, 252), (272, 272)), front=fhalf((0, 262), (12, 268), (16, 300), (0, 302)))
part('hood', 'hood', 'paint', 'side',
     side=side((284, 284), (628, 268), (630, 585), (284, 585)),
     front=fhalf((0, 262), (120, 270), (200, 290), (240, 325), (250, 400), (250, 600), (0, 600)), smooth=('front',),
     top=halfT([600, 0], [600, 260], [1330, 440], [1330, 0]),
     feats={'side': [{'kind': 'louvres', 'x0': S(335, 0)[0], 'x1': S(580, 0)[0], 'z0': S(0, 560)[1], 'z1': S(0, 385)[1], 'n': 26, 'slant': 0},
                     {'kind': 'seam', 'pts': side((325, 380), (590, 380), (590, 565), (325, 565), (325, 380))}, {'kind': 'highlight', 'pts': side((290, 300), (450, 293), (622, 287)), 'width': 1}],
            'top': [{'kind': 'trim', 'pts': [[610, 0], [1320, 0]], 'width': 1}]})
part('cowl', 'cowl', 'paint', 'side',
     side=side((630, 268), (682, 267), (716, 257), (738, 232), (740, 585), (630, 585)),
     front=fhalf((0, 250), (140, 256), (240, 276), (290, 320), (300, 400), (300, 600), (0, 600)), smooth=('front',),
     top=halfT([1330, 0], [1330, 440], [1560, 610], [1560, 0]))
part('body', 'body', 'paint', 'side',
     side=side((738, 232), (745, 64), (1560, 64), (1640, 74), (1682, 96), (1695, 150), (1697, 420), (1702, 585), (740, 585)),
     front=fhalf((0, 60), (308, 62), (328, 90), (330, 440), (318, 600), (0, 600)), rear='front',
     top=halfT([1560, 0], [1560, 640], [1600, 660], [3520, 660], [3575, 630], [3592, 560], [3592, 0]),
     feats={'side': [{'kind': 'seam', 'pts': side((770, 240), (770, 580))}, {'kind': 'seam', 'pts': side((1068, 70), (1068, 582))}, {'kind': 'seam', 'pts': side((1362, 70), (1362, 582))},
                     {'kind': 'bead', 'pts': side((742, 312), (1200, 314), (1694, 312))}, {'kind': 'highlight', 'pts': side((746, 322), (1690, 322)), 'width': 1},
                     {'kind': 'handle', 'at': S(990, 345), 'len': 120}, {'kind': 'handle', 'at': S(1085, 345), 'len': 120}],
            'rear': [{'kind': 'bead', 'pts': [[-655, 1200], [0, 1225], [655, 1200]]}]})
part('roof', 'roof', 'canvas', 'roof',
     side=side((675, 84), (722, 38), (800, 20), (1100, 4), (1480, 6), (1610, 18), (1668, 45), (1692, 90), (1640, 74), (1560, 64), (750, 64), (700, 90)),
     front=fhalf((0, 22), (250, 20), (318, 34), (346, 70), (332, 96), (0, 92)), rear='front',
     top=halfT([1500, 0], [1500, 640], [1640, 690], [3480, 690], [3560, 650], [3592, 560], [3592, 0]), smooth=('top',))
part('screenFrame', 'screen', 'black', 'flat', x=[1564, 1599], front=fhalf((0, 100), (300, 100), (300, 240), (0, 240)))
part('screen', 'screen', 'glass', 'side', x=[1562, 1600], front=fhalf((0, 115), (182, 115), (182, 222), (0, 222)), side=side((742, 112), (760, 112), (760, 226), (742, 226)))
part('screenBar', 'screen', 'black', 'flat', x=[1558, 1600], front=[[-12, F(0, 222)[1]], [12, F(0, 222)[1]], [12, F(0, 115)[1]], [-12, F(0, 115)[1]]], lift=1)
for k, (a, b, c, d) in enumerate(((810, 110, 1022, 265), (1108, 105, 1315, 265), (1392, 105, 1528, 255))):
    (x0, z1), (x1, z0) = S(a, b), S(c, d); part(f'glass{k}', 'body', 'glass', 'side', y=[666, 668], pair=True, side=rrect(x0, z0, x1, z1, 45))
part('rearGlass', 'body', 'glass', 'side', x=[3602, 3606], rear=half([0, 1290], [320, 1290], [330, 1310], [330, 1552], [310, 1572], [0, 1572]))
part('rearBar', 'body', 'black', 'flat', x=[3602, 3608], rear=[[-11, 1290], [11, 1290], [11, 1572], [-11, 1572]], lift=1)

# ---------------- wings, boards ----------------
part('fenderF', 'fenderF', 'paint2', 'fender', slot='fenderF', pair=True, cutWheel={'i': 0, 'r': 412}, smooth=('front', 'top'),
     side=side((70, 518), (100, 480), (150, 442), (230, 420), (330, 436), (420, 480), (500, 540), (580, 610), (660, 660), (740, 690), (800, 700), (800, 716), (730, 714), (650, 694), (560, 645), (480, 580), (440, 560), (432, 672), (50, 672), (48, 560)),
     front=[F(*q) for q in ((150, 687), (180, 560), (230, 500), (290, 465), (350, 452), (400, 465), (418, 500), (420, 580), (395, 602), (330, 562), (280, 562), (240, 602), (200, 687))],
     top=[[150, 600], [130, 700], [190, 800], [330, 838], [800, 838], [1250, 800], [1500, 700], [1700, 690], [1700, 640], [1450, 610], [1100, 520], [700, 470], [300, 480]],
     feats={'side': [{'kind': 'highlight', 'pts': side((110, 490), (160, 452), (230, 432), (325, 447), (410, 490), (490, 548)), 'width': 2}]})
part('fenderR', 'fenderR', 'paint2', 'fender', slot='fenderR', pair=True, cutWheel={'i': 1, 'r': 412}, smooth=('rear', 'top'),
     side=side((1250, 585), (1265, 520), (1300, 460), (1350, 420), (1420, 400), (1500, 398), (1570, 420), (1630, 470), (1670, 540), (1700, 610), (1740, 660), (1785, 690), (1790, 706), (1700, 702), (1690, 682), (1250, 682)),
     rear=[[560, 380], [560, 760], [600, 860], [700, 905], [790, 880], [840, 800], [850, 380]],
     top=[[2850, 640], [2850, 700], [2950, 790], [3150, 838], [3550, 838], [3740, 780], [3790, 660], [3740, 560], [3550, 500], [3150, 500], [2950, 560]],
     feats={'side': [{'kind': 'highlight', 'pts': side((1290, 480), (1350, 432), (1420, 412), (1500, 410), (1565, 432), (1622, 480)), 'width': 2}]})
part('board', 'board', 'rubber', 'flat', slot='board', pair=True, side=side((770, 700), (1250, 700), (1250, 720), (770, 720)), top=[[1630, 690], [1630, 838], [2650, 838], [2650, 690]], detail={'kind': 'ribs', 'pitch': 25})
for k, (a, b) in enumerate(((785, 890), (1105, 1215))):
    part(f'step{k}', 'board', 'chrome', 'flat', slot='board', pair=True, side=side((a + 12, 672), (b - 12, 672), (b, 700), (a, 700)), top=[[S(a, 0)[0], 720], [S(a, 0)[0], 832], [S(b, 0)[0], 832], [S(b, 0)[0], 720]], lift=1)

# ---------------- lamps, bumpers, spare ----------------
part('lamp', 'lamp', 'chrome', 'fender', slot='lamp', pair=True, smooth=('side', 'front', 'top'),
     side=side((150, 345), (160, 330), (180, 326), (205, 335), (228, 352), (234, 372), (232, 400), (215, 415), (190, 420), (160, 418), (148, 400), (145, 372)),
     front=ell(383, 1031, 117, 117), top=[[307, 290], [340, 268], [420, 290], [490, 350], [490, 420], [420, 478], [340, 500], [307, 478]])
part('lens', 'lamp', 'lens', 'flat', slot='lamp', pair=True, x=[303, 312], smooth=('front',), front=ell(383, 1031, 96, 96), lift=1, detail={'kind': 'flutes', 'pitch': 22})
part('lampBar', 'lamp', 'chrome', 'flat', slot='lamp', x=[380, 420], front=half([0, 990], [270, 1000], [270, 1030], [0, 1022]))
part('lampStand', 'lamp', 'chrome', 'flat', slot='lamp', pair=True, y=[370, 396], side=side((180, 418), (198, 418), (203, 470), (182, 470)))
for k, py in enumerate((615, 661)):
    z = S(0, py)[1]
    part(f'bumperF{k}', 'bumperF', 'chrome', 'fender', slot='bumperF', side=side((2, py - 11), (42, py - 11), (46, py), (42, py + 11), (2, py + 11)), front=half([0, z - 23], [655, z - 23], [668, z], [655, z + 23], [0, z + 23]),
         top=halfT([0, 0], [0, 600], [40, 668], [90, 668], [86, 600], [86, 0]))
    part(f'bumperR{k}', 'bumperR', 'chrome', 'fender', slot='bumperR', pair=True, side=side((1778, py - 11), (1834, py - 11), (1834, py + 11), (1778, py + 11)), rear=[[330, z - 23], [790, z - 23], [800, z], [790, z + 23], [330, z + 23]],
         top=[[3765, 330], [3765, 790], [3885, 790], [3885, 330]])
part('ironF', 'bumperF', 'black', 'flat', slot='bumperF', pair=True, side=side((42, 600), (120, 610), (120, 640), (42, 676)), front=[[330, 400], [362, 400], [362, 545], [330, 545]], top=[[60, 330], [60, 362], [520, 362], [520, 330]], lift=1)
part('ironR', 'bumperR', 'black', 'flat', slot='bumperR', pair=True, side=side((1700, 610), (1780, 600), (1780, 676), (1700, 640)), rear=[[540, 400], [572, 400], [572, 545], [540, 545]], top=[[3560, 540], [3560, 572], [3800, 572], [3800, 540]])
part('tail', 'tail', 'lensR', 'flat', slot='tail', pair=True, smooth=('rear', 'side'), x=[3590, 3640], side=ell(3615, 720, 22, 50), rear=ell(570, 720, 50, 50))
part('spare', 'spare', 'rubber', 'fender', smooth=('side',), wheel={'r': 330},
     side=ell(S(1760, 0)[0], 868, 88, 300), rear=ell(0, 868, 330, 330), top=halfT([3640, 0], [3640, 330], [3810, 330], [3810, 0]), detail={'kind': 'ribs', 'pitch': 40})
part('spareHub', 'spare', 'chrome', 'flat', smooth=('side',), y=[-60, 60], side=ell(S(1770, 0)[0], 868, 36, 70), lift=1)

M = {'id': 'sedan29', 'name': 'four-door sedan, 1929', 'year': 1929, 'length': L, 'width': W, 'height': H, 'paint': '#3b3e25', 'paint2': '#232327', 'canvas': '#34343a',
     'wheels': [{'x': FX, 'r': R, 'y': 690}, {'x': RX, 'r': R, 'y': 690}], 'wheel': {'rim': 0.66, 'style': 'wire', 'spokes': 36, 'rimMaterial': 'paint', 'cap': 0.22, 'capRings': 1},
     'parts': P}
json.dump(M, open(OUT, 'w'), indent=0)
print(OUT, len(P), 'parts;', sum(len(p['outlines']) for p in P), 'outlines')
print('where the sheet views disagree with the one model (the model wins):'); print('\n'.join('  ' + n for n in notes))
