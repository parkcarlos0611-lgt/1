"""A 1948 four-wheel-drive utility (catalogue 1940s #2, picked at random for the method Z check of 2026-11-19), in
five views from one reference sheet: left side, right side (the left side mirrored, tools/ref/mirror.ts), front, rear
and plan. Every part is its own closed shape with its own layer: wings, bonnet, bulkhead, door, door top, side-screen
upright, windscreen, tub, tilt, bumper, chassis, lamps, hinges, straps, wheels.

Sizes: length 3350, wheelbase 2032 (80 in), width 1550; heights from the side view (1803 over the tilt).

  python3 tools/ref/lr48.py data/bodies"""
import sys, os; sys.path.insert(0, os.path.dirname(__file__))
from kit import Body, ell, sh, sym
OUT = sys.argv[1]; L, W, H = 3350, 1550, 1803; C = W // 2
META = dict(year=1948, paint='#616a53', paint2='#616a53', canvas='#a18d69', frame='reveal')
FX, RX, R = 590, 2640, 360
WHEEL = dict(rim=0.6, style='disc', spokes=0, rimMaterial='paint', cap=0.3, capRings=1, tread=True, capMaterial='black')

def side():
    b = Body()
    b.well('wellF', FX, 450, 400).well('wellR', RX, 450, 410)
    b.add('chassis', sh([[40, 395], [3310, 395], [3310, 525], [40, 525]]), 'black', 'flat', 1)
    b.add('step', sh([[1240, 395], [2160, 395], [2160, 475], [1240, 475]]), 'black', 'flat', 3)
    b.add('crossR', sh([[3280, 380], [3345, 380], [3345, 525], [3280, 525]]), 'black', 'flat', 3)
    b.add('bulkhead', sh([[1235, 470], [1305, 470], [1305, 1275], [1235, 1275]]), 'paint', 'side', 15, element='bulkhead')
    b.add('wingF', sh([[100, 590], [98, 950], [135, 1003], [1255, 1012], [1255, 470], [965, 470], [965, 560], [225, 590]]), 'paint', 'side', 20, slot='fenderF', element='wing',
          cut=[{'x': FX, 'z': 450, 'r': 400}])
    b.add('bonnet', sh([[150, 1008], [160, 1075], [215, 1118], [600, 1132], [1225, 1158], [1255, 1146], [1255, 1008]]), 'paint', 'hood', 21, element='bonnet')
    b.add('door', sh([[1305, 470], [2130, 470], [2130, 1045], [1305, 1045]]), 'paint', 'side', 20, element='door')
    b.add('doorCap', sh([[1305, 1045], [2130, 1045], [2130, 1072], [1305, 1072]]), 'chrome', 'flat', 21, element='door')
    b.add('doorTop', sh([[1310, 1072], [2120, 1072], [2120, 1245], [1310, 1245]]), 'paint', 'side', 20, element='doorTop')
    b.add('doorTopRail', sh([[1310, 1245], [2120, 1245], [2120, 1272], [1310, 1272]]), 'chrome', 'flat', 21, element='doorTop')
    b.add('upright', sh([[2040, 1272], [2112, 1272], [2112, 1650], [2040, 1650]]), 'chrome', 'flat', 22, element='doorTop')
    b.add('screen', sh([[1232, 1240], [1318, 1172], [1548, 1618], [1515, 1666], [1418, 1672]]), 'chrome', 'flat', 24, element='screen', detail={'kind': 'ribs', 'pitch': 40})
    b.add('tub', sh([[2130, 470], [2130, 1002], [3338, 1002], [3338, 560], [3300, 525], [2130, 525]]), 'paint', 'side', 20, element='tub', cut=[{'x': RX, 'z': 450, 'r': 410}])
    b.add('tilt', sh([[1425, 1650], [1435, 1705], [1520, 1722], [2060, 1792], [2160, 1802], [3240, 1802], [3312, 1765], [3342, 1690], [3346, 1000], [2132, 1000], [2132, 1650]]),
          'canvas', 'roof', 26, element='tilt')
    b.add('bumper', sh([[0, 405], [62, 405], [62, 572], [0, 572]]), 'chrome', 'flat', 30, slot='bumperF')
    b.add('mirror', sh([[575, 1128], [655, 1128], [655, 1185], [682, 1230], [640, 1255], [592, 1250], [568, 1205]]), 'black', 'flat', 22, element='mirror')
    for z in (565, 915): b.add(f'hinge{z}', sh([[1300, z], [1455, z + 10], [1455, z + 42], [1300, z + 55]]), 'chrome', 'flat', 23, element='door')
    b.add('handleCup', ell(1992, 920, 52, 48), 'black', 'flat', 22, element='door')
    b.add('handle', sh([[1965, 905], [2020, 905], [2020, 935], [1965, 935]]), 'chrome', 'flat', 23, element='door')
    for x in (2205, 2450, 2700, 2960, 3240): b.add(f'strap{x}', sh([[x - 22, 865], [x + 22, 865], [x + 22, 1012], [x - 22, 1012]]), 'wood', 'flat', 27, element='tilt')
    b.add('tailLamp', ell(3335, 610, 18, 35), 'lensR', 'flat', 28, slot='tail')
    b.feat(kind='lamp', at=[300, 965, 1], r=28, facing='front')
    b.feat(kind='seam', pts=[[2185, 1010, 1], [2185, 1795, 1]]).feat(kind='seam', pts=[[3238, 1010, 1], [3270, 1700, 1], [3240, 1795, 1]])
    b.feat(kind='seam', pts=[[1500, 1712, 1], [3300, 1712, 1]])
    b.feat(kind='highlight', pts=[[160, 995, 1], [700, 1000, 1], [1240, 1004, 1]], width=1).feat(kind='highlight', pts=[[2140, 990, 1], [3330, 990, 1]], width=1)
    for x in (FX, RX): b.wheel(x, R, **WHEEL)
    b.save(f'{OUT}/lr48.json', id='lr48', name='four-wheel-drive utility, 1948 (left side)', length=L, height=H,
           marks={'fx': FX, 'rx': RX, 'r': R, 'gap': 405, 'cowl': 1255, 'cab': 2130, 'belt': 1012, 'roof': 1802}, **META)

def front():
    b = Body()
    for u in (-1, 1): b.add(f'tyre{u}', [[C + u * 600, 0, 1], [C + u * 830, 0, 1], [C + u * 840, 470, 1], [C + u * 590, 470, 1]], 'rubber', 'fender', 1, detail={'kind': 'planks', 'pitch': 45})
    b.add('axle', sh([[200, 300], [1350, 300], [1350, 400], [200, 400]]), 'black', 'flat', 2)
    b.add('diff', ell(560, 290, 150, 140), 'iron', 'fender', 3)
    for x in (400, 1110): b.add(f'rail{x}', sh([[x, 380], [x + 70, 380], [x + 70, 470], [x, 470]]), 'black', 'flat', 2)
    b.add('panhard', sh([[300, 440], [1250, 440], [1250, 470], [300, 470]]), 'iron', 'flat', 2)
    b.add('bulkhead', sh([[130, 1000], [1420, 1000], [1420, 1288], [130, 1288]]), 'paint', 'side', 10, element='bulkhead')
    b.add('screenFrame', sh([[118, 1272], [1432, 1272], [1432, 1702], [118, 1702]]), 'chrome', 'flat', 12, element='screen')
    for x0, x1 in ((158, 752), (798, 1392)): b.add(f'screen{x0}', sh([[x0, 1312], [x1, 1312], [x1, 1680], [x0, 1680]]), 'glass', 'side', 13, element='screen')
    b.add('tilt', sh([[108, 1680], [1442, 1680], [1442, 1722], [1405, 1788], [1340, 1802], [210, 1802], [145, 1788], [108, 1722]]), 'canvas', 'roof', 14, element='tilt')
    for u in (-1, 1):
        b.add(f'wing{u}', [[C + u * x, z, 1] for x, z in [[395, 600], [765, 600], [765, 940], [745, 985], [705, 1000], [395, 1000]]], 'paint', 'side', 20, element='wing', slot='fenderF')
        b.part('lamp', 'round', at=[C + u * 690, 930], d=60)
    b.add('grille', sh([[388, 600], [1162, 600], [1162, 1002], [388, 1002]]), 'black', 'flat', 18, element='grille', slot='grille', detail={'kind': 'mesh', 'pitch': 40})
    for u in (-1, 1): b.part('lamp', 'round', at=[C + u * 245, 880], d=190)
    b.add('bonnet', sh([[180, 1000], [1370, 1000], [1370, 1100], [1300, 1140], [775, 1160], [250, 1140], [180, 1100]]), 'paint', 'hood', 22, element='bonnet')
    b.add('bumper', sh([[0, 470], [1550, 470], [1550, 562], [0, 562]]), 'chrome', 'fender', 30, slot='bumperF')
    b.feat(kind='highlight', pts=[[260, 1135, 1], [775, 1152, 1], [1290, 1135, 1]], width=1)
    b.save(f'{OUT}/lr48_front.json', id='lr48_front', name='four-wheel-drive utility, 1948 (front)', length=W, height=H, glassLift=-1, **META)

def rear():
    b = Body()
    for u in (-1, 1): b.add(f'tyre{u}', [[C + u * 475, 0, 1], [C + u * 705, 0, 1], [C + u * 710, 480, 1], [C + u * 470, 480, 1]], 'rubber', 'fender', 1, detail={'kind': 'planks', 'pitch': 45})
    b.add('axle', sh([[220, 330], [1330, 330], [1330, 430], [220, 430]]), 'black', 'flat', 2)
    b.add('diff', ell(775, 300, 170, 140), 'iron', 'fender', 3)
    b.add('crossmember', sh([[200, 430], [1350, 430], [1350, 500], [200, 500]]), 'black', 'flat', 2)
    b.add('tub', sh([[30, 500], [1520, 500], [1520, 1002], [30, 1002]]), 'paint', 'side', 10, element='tub')
    for u in (-1, 1): b.add(f'capping{u}', [[C + u * x, z, 1] for x, z in [[700, 560], [745, 560], [745, 1002], [700, 1002]]], 'chrome', 'flat', 11, element='tub')
    b.add('cappingLow', sh([[30, 500], [1520, 500], [1520, 538], [30, 538]]), 'chrome', 'flat', 11, element='tub')
    b.add('tilt', sh([[8, 1000], [1542, 1000], [1546, 1690], [1500, 1762], [1440, 1792], [110, 1792], [50, 1762], [4, 1690]]), 'canvas', 'roof', 20, element='tilt')
    b.add('windowFrame', sh([[560, 1320], [1070, 1320], [1070, 1582], [560, 1582]]), 'black', 'flat', 21, element='tilt')
    b.add('window', sh([[618, 1352], [1012, 1352], [1012, 1552], [618, 1552]]), 'glass', 'side', 22, element='tilt')
    for u in (-1, 1):
        b.add(f'strapV{u}', [[C + u * x, z, 1] for x, z in [[480, 1005], [510, 1005], [510, 1745], [480, 1745]]], 'wood', 'flat', 21, element='tilt')
        for z in (700, 900): b.part('tail', 'round', at=[C + u * 555, z], d=90)
        b.add(f'catch{u}', [[C + u * x, z, 1] for x, z in [[390, 560], [440, 560], [440, 700], [390, 700]]], 'chrome', 'flat', 12, element='tub')
    b.feat(kind='seam', pts=[[330, 540, 1], [330, 995, 1]]).feat(kind='seam', pts=[[1220, 540, 1], [1220, 995, 1]])
    b.wheel(C, 350, z=690, zOrder=30, spare=True, **WHEEL)
    b.save(f'{OUT}/lr48_rear.json', id='lr48_rear', name='four-wheel-drive utility, 1948 (rear)', length=W, height=H, **META)

def top():
    # x along the car from the nose, z across it (0 the right-hand edge as seen from above)
    b = Body(); WT = 1580
    b.add('spare', sh([[3255, 520], [3350, 520], [3350, 1170], [3255, 1170]]), 'rubber', 'fender', 2)
    b.add('grilleTop', sh([[95, 450], [300, 450], [300, 1120], [95, 1120]]), 'black', 'flat', 3, slot='grille')
    b.add('wings', sh([[100, 75], [1262, 75], [1262, 1500], [100, 1500]]), 'paint', 'flat', 10, element='wing')
    b.add('bonnet', sh([[285, 470], [1245, 255], [1245, 1345], [285, 1135]]), 'paint', 'hood', 12, element='bonnet')
    for z in (330, 1150): b.add(f'latch{z}', sh([[735, z - 60], [790, z - 60], [790, z + 70], [735, z + 70]]), 'black', 'flat', 13, element='bonnet')
    b.add('bulkhead', sh([[1255, 60], [1335, 60], [1335, 1520], [1255, 1520]]), 'paint', 'flat', 11, element='bulkhead')
    b.add('screenFrame', sh([[1325, 55], [1462, 55], [1462, 1525], [1325, 1525]]), 'chrome', 'flat', 14, element='screen')
    for z0, z1 in ((95, 770), (815, 1485)): b.add(f'screenTop{z0}', sh([[1362, z0], [1440, z0], [1440, z1], [1362, z1]]), 'glass', 'flat', 15, element='screen')
    b.add('tilt', sh([[1440, 42], [3200, 42], [3255, 70], [3272, 120], [3272, 1440], [3255, 1490], [3200, 1515], [1440, 1515]]), 'canvas', 'roof', 20, element='tilt')
    b.add('bumper', sh([[10, 90], [100, 90], [100, 1470], [10, 1470]]), 'chrome', 'fender', 30, slot='bumperF')
    for z0, z1 in ((0, 62), (1515, 1578)):
        b.add(f'hingeTop{z0}', sh([[1290, z0], [1352, z0], [1352, z1], [1290, z1]]), 'chrome', 'flat', 31, element='door')
        b.add(f'handleTop{z0}', sh([[1952, z0 + (20 if z0 else 0)], [2058, z0 + (20 if z0 else 0)], [2058, z1 - (0 if z0 else 20)], [1952, z1 - (0 if z0 else 20)]]), 'chrome', 'flat', 31, element='door')
    b.feat(kind='seam', pts=[[1562, 60, 1], [1562, 1500, 1]]).feat(kind='seam', pts=[[2232, 60, 1], [2232, 1500, 1]])
    b.feat(kind='seam', pts=[[300, 470, 1], [1240, 262, 1]]).feat(kind='seam', pts=[[300, 1130, 1], [1240, 1338, 1]])
    b.save(f'{OUT}/lr48_top.json', id='lr48_top', name='four-wheel-drive utility, 1948 (plan)', length=L, height=WT, **META)

side(); front(); rear(); top()
