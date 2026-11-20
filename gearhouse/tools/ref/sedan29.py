"""The first full car (review 26): a 1929 four-door sedan from the 1920s sheet, by method Z, in five views, with its
chassis (frame, four-cylinder engine, gearbox, torque tube, fuel tank in the cowl, exhaust) from the chassis sheet.
Sizes from the wheelbase (2629 mm, H): the sheet drawn to it gives length 3885 over bumpers and spare, height 1820,
tyres 4.50-21 (r 381) - all agree. Width 1700, track 1422.

  python3 tools/ref/sedan29.py <out dir>   -> sedan29.json (left side), sedan29_front/_rear/_top.json, sedan29_chassis.json"""
import sys, os, math; sys.path.insert(0, os.path.dirname(__file__))
from kit import Body, ell, sh, sym, tube
OUT = sys.argv[1]; L, W, H = 3885, 1700, 1820; C = W // 2
META = dict(year=1929, paint='#3b3e25', paint2='#232327', frame='reveal')
FX, RX, R = 508, 3137, 381
WHEEL = dict(rim=0.6, style='wire', spokes=32, rimMaterial='paint', cap=0.3, capRings=1, capMaterial='chrome')

def rounded(x0, z0, x1, z1, r, n=4):
    """a rectangle with rounded corners (windows)"""
    pts = []
    for cx, cz, a0 in ((x1 - r, z1 - r, 0), (x0 + r, z1 - r, 90), (x0 + r, z0 + r, 180), (x1 - r, z0 + r, 270)):
        for k in range(n + 1): a = math.radians(a0 + 90 * k / n); pts.append([round(cx + math.cos(a) * r), round(cz + math.sin(a) * r), 1])
    return pts

def side():
    b = Body()
    for name, x in (('houseF', FX), ('houseR', RX)):
        b.add(name, sh([[x - 455, 470]] + [[round(x + math.cos(a) * 455), round(395 + math.sin(a) * 455)] for a in [math.pi * k / 16 for k in range(16, -1, -1)]] + [[x + 455, 470]]), 'black', 'flat', 2)
    b.add('apron', sh([[1340, 465], [2930, 465], [2930, 605], [1340, 605]]), 'black', 'flat', 4, element='apron')
    b.add('hood', sh([[600, 600], [1340, 600], [1340, 1232], [620, 1228], [600, 1212]]), 'paint', 'side', 10, element='hood')
    b.add('cowl', sh([[1340, 600], [1560, 600], [1575, 1268], [1500, 1262], [1340, 1238]]), 'paint', 'side', 10, element='cowl')
    b.add('body', sh([[1560, 600], [3640, 600], [3640, 1650], [3622, 1712], [3590, 1740], [1600, 1740], [1575, 1690], [1562, 1262]]), 'paint', 'side', 10, element='body')
    b.add('roof', sh([[1592, 1735], [3596, 1735], [3575, 1772], [3500, 1800], [1700, 1806], [1630, 1790]]), 'paint2', 'roof', 11, element='roof')
    b.add('visor', sh([[1450, 1652], [1600, 1700], [1610, 1762], [1470, 1705]]), 'paint2', 'flat', 12, element='roof')
    b.add('screen', sh([[1556, 1270], [1598, 1270], [1606, 1686], [1568, 1686]]), 'glass', 'side', 12, element='screen')
    for k, (x0, x1) in enumerate(((1720, 2180), (2340, 2770), (2960, 3320))): b.add(f'glass{k}', rounded(x0, 1270, x1, 1600, 45), 'glass', 'side', 12, clip='body')
    b.add('shell', sh([[505, 958], [600, 958], [600, 1386], [505, 1386]]), 'chrome', 'flat', 20, element='radiator', slot='grille')
    b.add('cap', sh([[527, 1386], [578, 1386], [568, 1442], [537, 1442]]), 'chrome', 'flat', 21, element='radiator', slot='grille')
    b.add('fenderF', sh([[120, 745], [180, 812], [300, 872], [480, 905], [660, 890], [800, 836], [920, 752], [1030, 662], [1150, 575], [1290, 503], [1430, 470], [1560, 462],
                         [1560, 425], [1420, 428], [1270, 455], [1120, 520], [990, 600], [905, 650], [860, 600], [780, 520], [140, 520], [110, 690]]), 'paint2', 'fender', 20, slot='fenderF', element='fenderF', cut=[{'x': FX, 'z': R, 'r': 418}])
    b.add('fenderR', sh([[2860, 455], [2880, 560], [2930, 690], [3010, 800], [3120, 880], [3260, 905], [3400, 872], [3510, 790], [3590, 660], [3650, 520], [3700, 440], [3740, 400],
                         [3700, 380], [3640, 400], [3560, 470], [2900, 430]]), 'paint2', 'fender', 20, slot='fenderR', element='fenderR', cut=[{'x': RX, 'z': R, 'r': 418}])
    b.add('board', sh([[1450, 430], [2930, 430], [2930, 482], [1450, 482]]), 'rubber', 'flat', 21, slot='board', element='board', detail={'kind': 'ribs', 'pitch': 25})
    for x in (1680, 2320): b.add(f'step{x}', sh([[x, 468], [x + 200, 468], [x + 180, 505], [x + 20, 505]]), 'chrome', 'flat', 22, slot='board', element='board')
    b.add('spare', ell(3792, 925, 88, 282), 'rubber', 'fender', 18, element='spare', detail={'kind': 'ribs', 'pitch': 40})
    b.add('spareHub', ell(3800, 925, 40, 60), 'chrome', 'flat', 19, element='spare')
    for z0, z1 in ((420, 470), (522, 572)):
        b.add(f'bumperF{z0}', sh([[0, z0], [95, z0], [95, z1], [0, z1]]), 'chrome', 'flat', 30, slot='bumperF', element='bumperF')
        b.add(f'bumperR{z0}', sh([[3800, z0], [3885, z0], [3885, z1], [3800, z1]]), 'chrome', 'flat', 30, slot='bumperR', element='bumperR')
    b.add('ironF', sh([[95, 450], [180, 450], [180, 545], [95, 545]]), 'black', 'flat', 29, slot='bumperF', element='bumperF')
    b.add('ironR', sh([[3720, 450], [3800, 450], [3800, 545], [3720, 545]]), 'black', 'flat', 29, slot='bumperR', element='bumperR')
    b.part('lamp', 'bullet', at=[400, 1060], d=225, len=210, stand=True)
    b.part('tail', 'stalk', at=[3600, 830], d=90, stalk=60)
    b.feat(kind='louvres', x0=740, x1=1240, z0=660, z1=990, n=24, slant=0)
    b.feat(kind='seam', pts=[[730, 650, 1], [1250, 650, 1], [1250, 1000, 1], [730, 1000, 1], [730, 650, 1]])
    for x in (1655, 2252, 2872): b.feat(kind='seam', pts=[[x, 620, 1], [x, 1760, 1]])
    b.feat(kind='seam', pts=[[1655, 622, 1], [2872, 622, 1]])
    b.feat(kind='bead', pts=[[1580, 1192, 1], [2600, 1194, 1], [3638, 1192, 1]]).feat(kind='highlight', pts=[[1600, 1210, 1], [3620, 1210, 1]], width=1)
    b.feat(kind='highlight', pts=[[640, 1215, 1], [1000, 1218, 1], [1330, 1222, 1]], width=1)
    b.feat(kind='highlight', pts=[[230, 838, 1], [420, 892, 1], [640, 880, 1], [820, 812, 1]], width=2).feat(kind='highlight', pts=[[3030, 850, 1], [3180, 893, 1], [3380, 860, 1], [3520, 740, 1]], width=2)
    b.feat(kind='handle', at=[2150, 1088, 1], len=110).feat(kind='handle', at=[2340, 1088, 1], len=110)
    b.feat(kind='interior', belt=1265, seats=[2000, 2600, 3150], wheel=1850)
    for x in (FX, RX): b.wheel(x, R, **WHEEL)
    b.save(f'{OUT}/sedan29.json', id='sedan29', name='four-door sedan, 1929 (left side)', length=L, height=H,
           marks={'fx': FX, 'rx': RX, 'r': R, 'gap': 440, 'cowl': 1340, 'cab': 3640, 'belt': 1192, 'roof': 1790}, **META)

def front():
    b = Body()
    for u in (-1, 1): b.add(f'tyre{u}', [[C + u * 575, 0, 1], [C + u * 755, 0, 1], [C + u * 765, 560, 1], [C + u * 565, 560, 1]], 'rubber', 'fender', 1, detail={'kind': 'planks', 'pitch': 45})
    b.add('axle', sh([[200, 320], [1500, 320], [1500, 395], [200, 395]]), 'black', 'flat', 2)
    b.add('spring', sh([[300, 410], [1400, 410], [1300, 455], [850, 490], [400, 455]]), 'iron', 'flat', 3)
    b.add('cabin', sh([[200, 560], [1500, 560], [1500, 1700], [200, 1700]]), 'paint', 'side', 5, element='body')
    b.add('frame', sh([[290, 1250], [1410, 1250], [1410, 1680], [290, 1680]]), 'paint2', 'flat', 6, element='screen')
    for x0, x1 in ((420, 830), (870, 1280)): b.add(f'glass{x0}', sh([[x0, 1300], [x1, 1300], [x1, 1640], [x0, 1640]]), 'glass', 'side', 7, element='screen')
    b.add('visor', sh([[230, 1680], [1470, 1680], [1470, 1742], [230, 1742]]), 'paint2', 'flat', 8, element='roof')
    b.add('roof', sh([[180, 1740], [1520, 1740], [1520, 1790], [1460, 1820], [240, 1820], [180, 1790]]), 'paint2', 'roof', 8, element='roof')
    b.add('hood', sh([[330, 1040], [1370, 1040], [1370, 1160], [1200, 1258], [850, 1280], [500, 1258], [330, 1160]]), 'paint', 'hood', 9, element='hood')
    b.add('splash', sh([[340, 450], [1360, 450], [1360, 610], [340, 610]]), 'black', 'flat', 9)
    for u in (-1, 1):
        b.add(f'fender{u}', [[C + u * x, z, 1] for x, z in [[500, 545], [505, 760], [550, 850], [650, 900], [760, 890], [835, 830], [858, 720], [858, 545]]],
              'paint2', 'fender', 20, element='fenderF', slot='fenderF')
        b.part('lamp', 'round', at=[C + u * 560, 950], d=225)
    b.add('shell', sh([[580, 450], [1120, 450], [1112, 1150], [1000, 1212], [850, 1222], [700, 1212], [588, 1150]]), 'chrome', 'fender', 18, element='radiator', slot='grille')
    b.add('grille', sh([[632, 520], [1068, 520], [1060, 1090], [640, 1090]]), 'black', 'flat', 19, element='radiator', slot='grille', detail={'kind': 'vbars', 'pitch': 30, 'ring': 15})
    b.add('cap', sh([[830, 1222], [870, 1222], [880, 1300], [820, 1300]]), 'chrome', 'flat', 20, element='radiator', slot='grille')
    for z0 in (380, 460): b.add(f'bumper{z0}', sh([[180, z0], [1520, z0], [1520, z0 + 42], [180, z0 + 42]]), 'chrome', 'fender', 30, slot='bumperF')
    for x in (420, 1250): b.add(f'clamp{x}', sh([[x, 370], [x + 30, 370], [x + 30, 512], [x, 512]]), 'chrome', 'flat', 31, slot='bumperF')
    b.feat(kind='highlight', pts=[[400, 1150, 1], [850, 1265, 1], [1300, 1150, 1]], width=1)
    b.save(f'{OUT}/sedan29_front.json', id='sedan29_front', name='four-door sedan, 1929 (front)', length=W, height=H, glassLift=-1, **META)

def rear():
    b = Body()
    for u in (-1, 1): b.add(f'tyre{u}', [[C + u * 575, 0, 1], [C + u * 760, 0, 1], [C + u * 770, 560, 1], [C + u * 565, 560, 1]], 'rubber', 'fender', 1, detail={'kind': 'planks', 'pitch': 45})
    b.add('axle', sh([[220, 320], [1480, 320], [1480, 395], [220, 395]]), 'black', 'flat', 2)
    b.add('diff', ell(850, 360, 130, 100), 'iron', 'fender', 3)
    b.add('spring', sh([[320, 420], [1380, 420], [1290, 462], [850, 500], [410, 462]]), 'iron', 'flat', 3)
    b.add('body', sh([[160, 560], [1540, 560], [1540, 1700], [1490, 1760], [210, 1760], [160, 1700]]), 'paint', 'side', 10, element='body')
    b.add('roof', sh([[200, 1740], [1500, 1740], [1460, 1802], [240, 1802]]), 'paint2', 'roof', 11, element='roof')
    b.add('frame', sh([[520, 1270], [1180, 1270], [1180, 1572], [520, 1572]]), 'black', 'flat', 11, element='body')
    b.add('window', sh([[540, 1290], [1160, 1290], [1160, 1552], [540, 1552]]), 'glass', 'side', 12, element='body')
    b.add('bar', sh([[840, 1290], [862, 1290], [862, 1552], [840, 1552]]), 'black', 'flat', 13, element='body')
    for u in (-1, 1):
        b.add(f'fender{u}', [[C + u * x, z, 1] for x, z in [[850, 380], [850, 800], [790, 880], [650, 905], [550, 870], [510, 780], [510, 380]]], 'paint2', 'fender', 20, element='fenderR', slot='fenderR')
        b.part('tail', 'round', at=[C + u * 550, 680], d=100)
        for z0 in (430, 520): b.add(f'bumper{u}{z0}', [[C + u * x, z, 1] for x, z in [[290, z0], [800, z0], [800, z0 + 42], [290, z0 + 42]]], 'chrome', 'fender', 30, slot='bumperR')
    b.feat(kind='bead', pts=[[170, 1200, 1], [850, 1225, 1], [1530, 1200, 1]])
    b.wheel(C, 350, z=690, zOrder=25, spare=True, **WHEEL)
    b.save(f'{OUT}/sedan29_rear.json', id='sedan29_rear', name='four-door sedan, 1929 (rear)', length=W, height=H, **META)

def top():
    b = Body(); WT = 1700
    mir = lambda pts: [[x, WT - z, 1] for x, z in pts]
    ff = [[120, 60], [300, 20], [700, 20], [1100, 40], [1500, 110], [1500, 250], [1100, 330], [700, 380], [300, 380], [140, 330]]
    fr = [[2900, 120], [3300, 20], [3650, 40], [3780, 120], [3780, 330], [3500, 380], [3100, 350], [2900, 250]]
    for name, pts in (('fenderF', ff), ('fenderR', fr)):
        b.add(name + 'L', sh(pts), 'paint2', 'fender', 10, element=name); b.add(name + 'R', mir(pts), 'paint2', 'fender', 10, element=name)
    b.add('boardL', sh([[1500, 30], [2930, 30], [2930, 170], [1500, 170]]), 'rubber', 'flat', 9, element='board'); b.add('boardR', mir([[1500, 30], [2930, 30], [2930, 170], [1500, 170]]), 'rubber', 'flat', 9, element='board')
    b.add('bodyTop', sh([[1600, 110], [3560, 110], [3605, 200], [3605, 1500], [3560, 1590], [1600, 1590]]), 'paint', 'flat', 12, element='body')
    b.add('roof', sh([[1640, 140], [3500, 125], [3560, 175], [3568, 1525], [3500, 1575], [1640, 1560]]), 'paint2', 'roof', 13, element='roof')
    b.add('cowl', sh([[1440, 400], [1560, 330], [1560, 1370], [1440, 1300]]), 'paint', 'hood', 11, element='cowl')
    b.add('hood', sh([[540, 600], [1440, 420], [1440, 1280], [540, 1100]]), 'paint', 'hood', 11, element='hood')
    b.add('shell', sh([[440, 600], [540, 600], [540, 1100], [440, 1100]]), 'chrome', 'flat', 12, element='radiator', slot='grille')
    for z in (440, 1260): b.add(f'lamp{z}', ell(190, z, 70, 110), 'chrome', 'fender', 14, slot='lamp')
    b.add('bumperF', sh([[30, 150], [90, 150], [90, 1550], [30, 1550]]), 'chrome', 'fender', 30, slot='bumperF')
    b.add('spare', sh([[3640, 520], [3760, 520], [3760, 1180], [3640, 1180]]), 'rubber', 'fender', 8, element='spare')
    for z0, z1 in ((60, 560), (1140, 1640)): b.add(f'bumperR{z0}', sh([[3790, z0], [3860, z0], [3860, z1], [3790, z1]]), 'chrome', 'fender', 30, slot='bumperR')
    b.feat(kind='trim', pts=[[560, 850, 1], [1430, 850, 1]], width=1)
    b.save(f'{OUT}/sedan29_top.json', id='sedan29_top', name='four-door sedan, 1929 (plan)', length=L, height=WT, **META)

def chassis():
    """what the body hides, after the chassis sheet: the engine is painted green as on the sheet (paint), iron and black parts"""
    b = Body()
    b.add('rail', sh([[650, 460], [3560, 460], [3560, 565], [650, 565]]), 'iron', 'side', 10, element='frame')
    b.add('horn', sh([[600, 470], [660, 470], [660, 600], [600, 600]]), 'black', 'flat', 11, element='frame')
    b.add('crossF', sh([[460, 565], [560, 565], [560, 640], [460, 640]]), 'black', 'flat', 11, element='frame')
    b.add('crossR', sh([[3090, 565], [3185, 565], [3185, 640], [3090, 640]]), 'black', 'flat', 11, element='frame')
    b.add('crossEnd', sh([[3500, 470], [3570, 470], [3570, 620], [3500, 620]]), 'black', 'flat', 11, element='frame')
    b.add('core', sh([[600, 600], [680, 600], [680, 1330], [600, 1330]]), 'black', 'flat', 5, element='radiator', detail={'kind': 'ribs', 'pitch': 25})
    b.add('fan', sh([[690, 760], [715, 760], [715, 1120], [690, 1120]]), 'black', 'flat', 6, element='engine')
    b.add('sump', sh([[800, 470], [1350, 470], [1330, 562], [820, 562]]), 'black', 'side', 6, element='engine')
    b.add('block', sh([[738, 562], [1398, 562], [1398, 1012], [738, 1012]]), 'paint', 'side', 7, element='engine')
    b.add('head', sh([[748, 1012], [1388, 1012], [1378, 1062], [758, 1062]]), 'paint', 'side', 8, element='engine')
    b.add('outlet', sh([[738, 1022], [818, 1022], [818, 1078], [738, 1078]]), 'paint', 'side', 9, element='engine')
    b.add('distributor', sh([[960, 1062], [1040, 1062], [1040, 1140], [960, 1140]]), 'black', 'flat', 9, element='engine')
    for x in (880, 1000, 1110, 1220): b.add(f'plug{x}', sh([[x, 1062], [x + 22, 1062], [x + 22, 1100], [x, 1100]]), 'chrome', 'flat', 9, element='engine')
    b.add('generator', sh([[768, 862], [968, 862], [968, 962], [768, 962]]), 'black', 'fender', 9, element='engine')
    b.add('starter', sh([[798, 652], [1038, 652], [1038, 762], [798, 762]]), 'black', 'fender', 9, element='engine')
    b.add('bell', sh([[1398, 512], [1608, 540], [1608, 900], [1398, 932]]), 'paint', 'side', 7, element='gearbox')
    b.add('gearbox', sh([[1608, 552], [1958, 552], [1958, 782], [1608, 782]]), 'paint', 'side', 7, element='gearbox', detail={'kind': 'ribs', 'pitch': 60})
    b.add('lever', tube([[1778, 782], [1830, 940], [1878, 1100]], 22), 'iron', 'flat', 8, element='gearbox')
    b.add('knob', ell(1880, 1112, 32, 32), 'black', 'fender', 9, element='gearbox')
    b.add('tank', sh([[1345, 1000], [1560, 1000], [1560, 1240], [1345, 1240]]), 'iron', 'side', 6, element='tank')
    b.add('filler', sh([[1430, 1240], [1472, 1240], [1472, 1272], [1430, 1272]]), 'chrome', 'flat', 7, element='tank')
    b.add('column', tube([[1300, 650], [1600, 1000], [1850, 1330]], 40), 'black', 'flat', 6, element='steering')
    b.add('wheel', ell(1866, 1352, 28, 190), 'black', 'flat', 7, element='steering')
    b.add('downpipe', tube([[1100, 700], [1140, 560], [1180, 440], [1300, 425], [2400, 430]], 45), 'iron', 'flat', 4, element='exhaust')
    b.add('muffler', sh([[2400, 395], [2950, 395], [2950, 478], [2400, 478]]), 'iron', 'side', 4, element='exhaust')
    b.add('tailpipe', sh([[2950, 425], [3700, 425], [3700, 447], [2950, 447]]), 'iron', 'flat', 4, element='exhaust')
    b.save(f'{OUT}/sedan29_chassis.json', id='sedan29_chassis', name='four-door sedan, 1929 (chassis, left side)', length=L, height=H, **{**META, 'paint': '#3e5a3a', 'paint2': '#3e5a3a'})

side(); front(); rear(); top(); chassis()
