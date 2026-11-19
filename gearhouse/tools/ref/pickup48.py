# Authoring source of data/bodies/pickup48.json, measured off a reference sheet (drawn at 10 mm/px) (review 15, first-build manner).
# python3 tools/ref/pickup48.py data/bodies/pickup48.json
import sys, os; sys.path.insert(0, os.path.dirname(__file__))
from kit import Body, ell, sh
FX, RX, R, ARCH = 912, 3773, 420, 470
b = Body()
b.well('well', FX, R, 480).well('well2', RX, R, 480)
b.add('under', sh([[1650, 320], [3300, 320], [3300, 360], [1650, 360]]), 'black', 'flat', 1)
b.add('under2', sh([[4300, 420], [4700, 420], [4700, 560], [4300, 560]]), 'black', 'flat', 1)
b.add('grille', sh([[200, 540], [190, 800], [210, 1030], [320, 1030], [320, 540]]), 'black', 'flat', 15, slot='grille', detail={'kind': 'grille', 'pitch': 30, 'shell': 20})
cab = [[300, 1100], [275, 1250], [300, 1350], [400, 1430], [700, 1480], [1100, 1505], [1525, 1515], [1600, 1540], [1760, 1900], [1830, 1985], [1950, 2030], [2500, 2035], [2620, 2010], [2700, 1930],
       [2737, 1800], [2737, 550], [1720, 550], [1690, 800], [1100, 1110], [400, 1100]]
b.add('body', sh(cab), 'paint', 'side', 10, bevel=5)
b.add('bed', sh([[2760, 1250], [4690, 1250], [4700, 1215], [4690, 580], [4600, 450], [2760, 440]]), 'paint', 'side', 10.5, bevel=4, cut=[{'x': RX, 'z': R, 'r': ARCH}])
b.add('stakes', sh([[2812, 1260], [4575, 1260], [4575, 1473], [2812, 1473]]), 'wood', 'flat', 9, detail={'kind': 'planks', 'pitch': 70})
b.add('stakePost', sh([[2812, 1260], [2970, 1260], [2970, 1490], [2812, 1490]]), 'wood', 'side', 9.5, bevel=1.5)
b.add('stakePost2', sh([[4420, 1260], [4575, 1260], [4575, 1490], [4420, 1490]]), 'wood', 'side', 9.5, bevel=1.5)
b.add('bedRail', sh([[2760, 1225], [4800, 1225], [4800, 1260], [2760, 1260]]), 'paint', 'flat', 11)
b.add('screen', [[1620, 1540], [1660, 1550], [1800, 1890], [1765, 1905]], 'glass', 'side', 12, clip='body')
b.add('glass', [[1775, 1490], [1820, 1690], [1880, 1810], [1950, 1840], [2420, 1840], [2450, 1810], [2450, 1500], [2420, 1486]], 'glass', 'side', 12, clip='body')
b.add('vent', sh([[1975, 1486], [2010, 1486], [2010, 1840], [1975, 1840]]), 'paint', 'side', 13, clip='glass')
ff = [[275, 471], [260, 700], [275, 1050], [400, 1110], [800, 1130], [1100, 1135], [1350, 1098], [1550, 997], [1675, 822], [1712, 571], [1690, 330], [1400, 320], [600, 330], [300, 380]]
b.add('fenderF', ff, 'paint', 'fender', 20, slot='fenderF', cut=[{'x': FX, 'z': R, 'r': ARCH}])
fr = [[3150, 346], [3150, 560], [3200, 822], [3400, 1047], [3775, 1148], [4150, 1110], [4400, 997], [4525, 772], [4550, 471], [4450, 400], [3800, 380]]
b.add('fenderR', fr, 'paint', 'fender', 20, slot='fenderR', cut=[{'x': RX, 'z': R, 'r': ARCH}])
b.add('board', sh([[1690, 470], [3180, 470], [3180, 560], [1690, 560]]), 'rubber', 'flat', 19, slot='board', detail={'kind': 'ribs', 'pitch': 25})
b.add('step', sh([[1700, 350], [3240, 350], [3240, 470], [1700, 470]]), 'black', 'flat', 18.5, slot='board')
b.add('bumperIron', sh([[200, 470], [400, 470], [400, 540], [200, 540]]), 'black', 'flat', 24, slot='bumperF')
b.add('bumper', [[0, 400], [60, 371], [250, 380], [250, 640], [60, 651], [0, 620]], 'chrome', 'side', 25, slot='bumperF', bevel=3, detail={'kind': 'bar'})
b.add('bumperIron2', sh([[4550, 470], [4720, 470], [4720, 540], [4550, 540]]), 'black', 'flat', 24, slot='bumperR')
b.add('bumper2', [[4790, 460], [4750, 446], [4700, 455], [4700, 640], [4750, 646], [4790, 630]], 'chrome', 'side', 25, slot='bumperR', bevel=3)
b.add('lampRim', ell(285, 885, 34, 115), 'chrome', 'fender', 27, slot='lamp', rigid=True, bevel=2)
b.add('lens', ell(275, 885, 16, 92), 'lens', 'flat', 28, slot='lamp', rigid=True, detail={'kind': 'flutes', 'pitch': 20})
b.add('bezel', ell(4580, 780, 50, 55), 'chrome', 'fender', 28, slot='tail', rigid=True, bevel=2)
b.add('tailLens', ell(4590, 780, 32, 40), 'lensR', 'flat', 28.5, slot='tail', rigid=True)
b.feat(kind='seam', pts=[[1662, 1500, 1], [1662, 646, 1]]).feat(kind='seam', pts=[[1662, 646, 1], [2537, 600, 1]]).feat(kind='seam', pts=[[2537, 600, 1], [2537, 1900, 1]])
b.feat(kind='seam', pts=[[1880, 1900, 1], [2000, 1935, 1], [2480, 1935, 1], [2560, 1900, 1]], lit=True)
b.feat(kind='seam', pts=[[1520, 1515, 1], [1545, 1300, 1], [1540, 1140, 1]])
b.feat(kind='trim', pts=[[512, 1310, 1], [1312, 1310, 1]], width=2).feat(kind='trim', pts=[[512, 1235, 1], [1312, 1235, 1]], width=2)
b.feat(kind='highlight', pts=[[300, 1000, 1], [600, 1110, 1], [1100, 1120, 1], [1450, 1040, 1], [1640, 880, 1]], width=3)
b.feat(kind='highlight', pts=[[3200, 780, 1], [3400, 1010, 1], [3775, 1125, 1], [4150, 1090, 1], [4420, 950, 1], [4520, 760, 1]], width=3)
b.feat(kind='highlight', pts=[[400, 1405, 1], [800, 1455, 1], [1300, 1480, 1]], width=2)
b.feat(kind='highlight', pts=[[1900, 2005, 1], [2300, 2012, 1], [2580, 1990, 1]], width=2)
b.feat(kind='interior', belt=1490, seats=[2300], wheel=1900)
b.feat(kind='handle', at=[2330, 1300], len=170).feat(kind='hinge', at=[1650, 1373]).feat(kind='hinge', at=[1650, 720])
b.wheel(FX, R, rim=0.6, cap=0.55, capRings=2).wheel(RX, R, rim=0.6, cap=0.55, capRings=2)
b.save(sys.argv[1], id='pickup48', name='half-ton pickup, 1948', year=1948, length=4800, height=2040, paint='#a81c1c', paint2='#a81c1c', frame='reveal',
       marks={'fx': FX, 'rx': RX, 'r': R, 'gap': ARCH, 'cowl': 1525, 'cab': 2737, 'belt': 1486, 'roof': 2035})
