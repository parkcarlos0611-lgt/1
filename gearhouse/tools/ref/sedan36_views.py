# Front, rear and plan views of the sedan, measured off the same reference sheet: heights from the side view,
# widths from the plan (1772 mm overall). Each view is drawn by the same renderer as a design of its own:
# x across the car (front, rear) or along it (plan), z up (front, rear) or across (plan).
# python3 tools/ref/sedan36_views.py data/bodies
import sys, os; sys.path.insert(0, os.path.dirname(__file__))
from kit import Body, ell, sh, sym, pair
OUT = sys.argv[1]; W, H, C = 1772, 1908, 886
META = dict(year=1936, paint='#0f3322', paint2='#0f3322', frame='chrome')

def front():
    b = Body()
    for u in (702, -702): b.add(f'tyre{u}', [[C + u - 110, 0, 1], [C + u + 110, 0, 1], [C + u + 115, 330, 1], [C + u - 115, 330, 1]], 'rubber', 'fender', 1)
    b.add('under', sh([[C - 560, 300], [C + 560, 300], [C + 560, 420], [C - 560, 420]]), 'black', 'flat', 2)
    b.add('cabin', sym([[0, 1908], [300, 1905], [436, 1890], [509, 1837], [600, 1683], [640, 1300], [664, 1199], [650, 1100], [560, 700], [0, 700]], C), 'paint', 'roof', 10, bevel=4)
    b.add('screen', sym([[0, 1749], [470, 1740], [488, 1700], [488, 1430], [470, 1408], [0, 1415]], C), 'glass', 'side', 12, clip='cabin')
    b.add('screenBar', sh([[C - 12, 1408], [C + 12, 1408], [C + 12, 1749], [C - 12, 1749]]), 'chrome', 'flat', 13, clip='screen')
    b.add('hood', sym([[0, 1290], [235, 1260], [250, 1100], [250, 700], [0, 700]], C), 'paint', 'hood', 11, bevel=3)
    b.add('apron', sym([[0, 760], [520, 760], [520, 360], [0, 360]], C), 'paint', 'side', 9)
    for side in (1, -1):
        b.add(f'fender{side}', [[C + side * u, z, 1] for u, z in [[480, 700], [500, 960], [560, 1040], [680, 1056], [800, 1020], [860, 940], [886, 800], [886, 540], [860, 440], [780, 360], [560, 360]]], 'paint', 'fender', 20, bevel=8)
    b.part('grille', 'face', at=[C, 451], top=1243, half=250, foot=150, shoulder=700, pitch=22)
    for side in (1, -1):
        b.part('lamp', 'round', at=[C + side * 440, 1034], d=220)
        b.part('lamp', 'round', at=[C + side * 300, 638], d=60)
    b.part('bumper', 'across', at=[C, 430], half=794, h=120, dip=60, guards=[338])
    b.feat(kind='highlight', pts=[[C - 760, 990, 1], [C - 690, 1040, 1], [C - 600, 1030, 1]], width=2).feat(kind='highlight', pts=[[C + 600, 1030, 1], [C + 690, 1040, 1], [C + 760, 990, 1]], width=2)
    b.feat(kind='highlight', pts=[[C - 300, 1895, 1], [C, 1902, 1], [C + 300, 1895, 1]], width=2)
    b.save(f'{OUT}/sedan36_front.json', id='sedan36_front', name='two-door sedan, 1936 (front)', length=W, height=H, **META)

def rear():
    b = Body()
    for u in (702, -702): b.add(f'tyre{u}', [[C + u - 110, 0, 1], [C + u + 110, 0, 1], [C + u + 115, 330, 1], [C + u - 115, 330, 1]], 'rubber', 'fender', 1)
    b.add('under', sh([[C - 560, 280], [C + 560, 280], [C + 560, 420], [C - 560, 420]]), 'black', 'flat', 2)
    b.add('cabin', sym([[0, 1908], [300, 1905], [436, 1890], [509, 1837], [600, 1683], [640, 1330], [670, 1290], [650, 1150], [600, 500], [0, 500]], C), 'paint', 'roof', 10, bevel=4)
    b.add('backlight', sym([[0, 1683], [330, 1680], [360, 1650], [360, 1460], [330, 1430], [0, 1430]], C), 'glass', 'side', 12, clip='cabin')
    b.add('ledge', sym([[0, 1309], [670, 1309], [670, 1250], [0, 1250]], C), 'paint', 'hood', 13, bevel=2)
    b.add('trunk', sym([[0, 1290], [560, 1280], [590, 1200], [590, 640], [540, 530], [0, 517]], C), 'paint', 'side', 14, bevel=4)
    for side in (1, -1):
        b.add(f'fender{side}', [[C + side * u, z, 1] for u, z in [[580, 700], [600, 980], [660, 1060], [760, 1078], [850, 1030], [886, 900], [886, 560], [860, 440], [780, 360], [600, 360]]], 'paint', 'fender', 20, bevel=8)
        b.part('tail', 'round', at=[C + side * 680, 605], d=110)
    b.part('bumper', 'across', at=[C, 390], half=810, h=100, guards=[385])
    b.feat(kind='handle', at=[C - 20, 560], len=40)
    b.feat(kind='highlight', pts=[[C - 300, 1895, 1], [C, 1902, 1], [C + 300, 1895, 1]], width=2).feat(kind='highlight', pts=[[C - 400, 1240, 1], [C, 1250, 1], [C + 400, 1240, 1]], width=2)
    b.save(f'{OUT}/sedan36_rear.json', id='sedan36_rear', name='two-door sedan, 1936 (rear)', length=W, height=H, **META)

def plan():
    # x along the car from the nose, z across it from the left side (centre line at 886)
    b = Body(); half = lambda pts: sym([[w, x] for x, w in pts], C)   # (x, w) along the car -> mirrored outline in (x, z) after swapping
    def outline(pts):  # pts: (x, w) from the nose to the tail along one side; mirrored to a closed outline
        return [[x, C + w, 1] for x, w in pts] + [[x, C - w, 1] for x, w in reversed(pts)]
    b.add('fenderF', outline([[200, 650], [260, 760], [400, 860], [700, 886], [1300, 875], [1650, 800], [1700, 700], [1700, 0]])[:0] or [[200, C - 650, 1], [260, C - 760, 1], [400, C - 860, 1], [700, C - 886, 1], [1300, C - 875, 1], [1650, C - 800, 1], [1700, C - 700, 1], [1700, C + 700, 1], [1650, C + 800, 1], [1300, C + 875, 1], [700, C + 886, 1], [400, C + 860, 1], [260, C + 760, 1], [200, C + 650, 1]], 'paint', 'fender', 8, bevel=8)
    b.add('fenderR', [[3150, C - 760, 1], [3500, C - 862, 1], [3900, C - 862, 1], [4250, C - 760, 1], [4430, C - 650, 1], [4430, C + 650, 1], [4250, C + 760, 1], [3900, C + 862, 1], [3500, C + 862, 1], [3150, C + 760, 1]], 'paint', 'fender', 8, bevel=8)
    b.add('board', [[1650, C - 810, 1], [3200, C - 810, 1], [3200, C + 810, 1], [1650, C + 810, 1]], 'rubber', 'flat', 7)
    b.add('body', outline([[90, 20], [227, 105], [700, 300], [1474, 470], [1600, 600], [1860, 700], [3000, 739], [3880, 720], [4100, 680], [4400, 600], [4470, 400], [4477, 0]])[:-1], 'paint', 'side', 10, bevel=5)
    b.add('hoodTop', outline([[110, 10], [227, 90], [700, 280], [1474, 450], [1500, 0]])[:-1], 'paint', 'hood', 11, bevel=3)
    b.add('screen', outline([[1597, 560], [1700, 600], [1866, 592], [1866, 0]])[:-1], 'glass', 'side', 12, clip='body')
    b.add('roof', outline([[1866, 586], [2000, 640], [3700, 640], [3870, 586], [3870, 0]])[:-1], 'paint', 'roof', 13, bevel=6)
    b.add('backlight', outline([[3882, 348], [4017, 340], [4017, 0]])[:-1], 'glass', 'side', 14, clip='body')
    b.add('trunk', outline([[4066, 560], [4400, 520], [4457, 300], [4460, 0]])[:-1], 'paint', 'hood', 14, bevel=4)
    for side in (1, -1):
        b.add(f'lampPod{side}', ell(360, C + side * 437, 160, 95), 'paint', 'fender', 15, bevel=6)
        b.add(f'lampRim{side}', ell(230, C + side * 437, 40, 95), 'chrome', 'fender', 16, bevel=2)
        b.add(f'tail{side}', ell(4350, C + side * 567, 55, 50), 'lensR', 'flat', 16)
    b.add('bumperF', [[0, C - 776, 1], [60, C - 760, 1], [60, C + 760, 1], [0, C + 776, 1], [30, C, 1]][:4], 'chrome', 'side', 20, bevel=2)
    b.add('bumperR', [[4600, C - 776, 1], [4650, C - 760, 1], [4650, C + 760, 1], [4600, C + 776, 1]], 'chrome', 'side', 20, bevel=2)
    b.feat(kind='trim', pts=[[227, C, 1], [1450, C, 1]], width=2)
    b.feat(kind='highlight', pts=[[2050, C + 450, 1], [3600, C + 450, 1]], width=3).feat(kind='highlight', pts=[[500, C + 600, 1], [1300, C + 700, 1]], width=2)
    b.save(f'{OUT}/sedan36_top.json', id='sedan36_top', name='two-door sedan, 1936 (plan)', length=4650, height=W, **META)

front(); rear(); plan()
