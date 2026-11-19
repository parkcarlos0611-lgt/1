# Authoring source of data/bodies/speedster35.json, measured off a reference sheet (drawn at 10 mm/px) (review 15, first-build manner).
# python3 tools/ref/speedster35.py data/bodies/speedster35.json
import sys, os; sys.path.insert(0, os.path.dirname(__file__))
from kit import Body, ell, sh, tube
FX, RX, R, ARCH = 776, 3886, 370, 420
b = Body()
b.well('well', FX, R, 430).well('well2', RX, R, 430)
b.add('under', sh([[1150, 250], [3400, 250], [3400, 350], [1150, 350]]), 'black', 'flat', 1)
# cockpit: the padded rim and the seat back seen above the body, behind it
b.add('cockpit', [[2230, 1185], [2260, 1275], [2350, 1255], [2700, 1205], [2900, 1205], [2960, 1300], [3040, 1335], [3100, 1300], [3060, 1185]], 'paint2', 'side', 9, bevel=3)
b.add('grille', sh([[170, 560], [150, 760], [175, 1000], [300, 1000], [300, 560]]), 'black', 'flat', 15, slot='grille', detail={'kind': 'grille', 'pitch': 30, 'shell': 20})
body = [[230, 350], [185, 700], [200, 1050], [260, 1240], [380, 1305], [900, 1312], [2080, 1322], [2170, 1250], [2260, 1185], [3000, 1185], [3060, 1290], [3184, 1336], [3685, 1278], [4187, 1139],
        [4488, 987], [4638, 810], [4738, 607], [4776, 480], [4740, 380], [4600, 345], [1000, 345]]
b.add('body', sh(body), 'paint', 'side', 10, bevel=5, cut=[{'x': FX, 'z': R, 'r': ARCH}])
b.add('louvreBox', sh([[1052, 810], [1930, 810], [1930, 1000], [1052, 1000]]), 'iron', 'flat', 11)
b.add('louvreFrame', sh([[1040, 1000], [1940, 1000], [1940, 1020], [1040, 1020]]), 'chrome', 'flat', 11.5)
# windscreen: a raked chrome frame around a glass pane, standing above the cowl
b.add('screenFrame', [[2170, 1240], [2240, 1245], [2440, 1560], [2380, 1585]], 'chrome', 'side', 12, bevel=1.5)
b.add('screen', [[2215, 1265], [2245, 1270], [2405, 1530], [2380, 1545]], 'glass', 'side', 12.5)
ff = [[161, 380], [199, 557], [299, 734], [475, 886], [726, 941], [1002, 923], [1227, 848], [1478, 708], [1729, 557], [1980, 430], [2218, 359], [1600, 340], [800, 330], [200, 340]]
b.add('fenderF', ff, 'paint', 'fender', 20, slot='fenderF', cut=[{'x': FX, 'z': R, 'r': ARCH - 10}])
fr = [[3384, 330], [3390, 506], [3434, 734], [3635, 911], [3886, 1000], [4187, 949], [4438, 810], [4638, 607], [4738, 430], [4700, 330], [4400, 430], [3600, 430]]
b.add('fenderR', fr, 'paint', 'fender', 20, slot='fenderR')                   # a skirt over the rear wheel
b.add('stoneGuard', sh([[3360, 340], [3540, 340], [3540, 540], [3360, 540]]), 'chrome', 'side', 21, rigid=True, bevel=2)
for k, (x0, x1, z1) in enumerate([(1340, 1880, 410), (1590, 2060, 390), (1840, 2230, 370)]):   # three chrome exhaust pipes out of the hood side
    b.add(f'pipe{k}', tube([[x0, 1000], [x0 + 60, 820], [x0 + 230, 620], [x1, z1]], 80), 'chrome', 'side', 22 + k * 0.1, rigid=True, bevel=1.5)
b.add('bumperIron', sh([[120, 470], [300, 470], [300, 510], [120, 510]]), 'black', 'flat', 24, slot='bumperF')
b.add('bumper', [[20, 420], [80, 410], [250, 420], [250, 520], [80, 530], [20, 520]], 'chrome', 'side', 25, slot='bumperF', bevel=2, detail={'kind': 'bar'})
b.add('bumperGuard', sh([[20, 380], [80, 380], [80, 610], [20, 610]]), 'chrome', 'side', 25.5, slot='bumperF', bevel=2)
b.add('bumperIron2', sh([[4700, 470], [4880, 470], [4880, 510], [4700, 510]]), 'black', 'flat', 24, slot='bumperR')
b.add('bumper2', [[4940, 420], [4880, 410], [4780, 420], [4780, 520], [4880, 530], [4940, 520]], 'chrome', 'side', 25, slot='bumperR', bevel=2, detail={'kind': 'bar'})
b.add('bumperGuard2', sh([[4880, 380], [4940, 380], [4940, 610], [4880, 610]]), 'chrome', 'side', 25.5, slot='bumperR', bevel=2)
b.add('lampShell', ell(450, 1040, 150, 125), 'chrome', 'fender', 27, slot='lamp', rigid=True, bevel=6)
b.add('lens', ell(320, 1040, 30, 110), 'lens', 'flat', 28, slot='lamp', rigid=True, detail={'kind': 'flutes', 'pitch': 20})
b.add('bezel', ell(4700, 710, 45, 55), 'chrome', 'fender', 28, slot='tail', rigid=True, bevel=2)
b.add('tailLens', ell(4720, 710, 25, 40), 'lensR', 'flat', 28.5, slot='tail', rigid=True)
b.feat(kind='seam', pts=[[2200, 1090, 1], [2180, 620, 1], [2240, 520, 1], [2400, 505, 1], [2960, 505, 1], [3010, 560, 1], [3020, 1090, 1]])
b.feat(kind='seam', pts=[[2080, 1322, 1], [2100, 900, 1], [2140, 450, 1]])
b.feat(kind='trim', pts=[[2218, 440, 1], [3360, 440, 1]], width=2)
b.feat(kind='trim', pts=[[400, 1250, 1], [2050, 1262, 1]], width=1)
b.feat(kind='handle', at=[2330, 1000], len=150).feat(kind='hinge', at=[3045, 987]).feat(kind='hinge', at=[3045, 683])
b.feat(kind='louvres', x0=1080, x1=1900, z0=830, z1=985, n=16, slant=0)
b.feat(kind='highlight', pts=[[300, 760, 1], [600, 915, 1], [1000, 905, 1], [1400, 730, 1], [1800, 520, 1], [2150, 380, 1]], width=3)
b.feat(kind='highlight', pts=[[3450, 760, 1], [3700, 940, 1], [3950, 975, 1], [4250, 900, 1], [4500, 740, 1], [4680, 540, 1]], width=3)
b.feat(kind='highlight', pts=[[3300, 1310, 1], [3800, 1255, 1], [4300, 1110, 1], [4550, 930, 1]], width=2)
b.feat(kind='highlight', pts=[[500, 1290, 1], [1200, 1295, 1], [2000, 1302, 1]], width=1)
b.feat(kind='crease', pts=[[3400, 506, 1], [3460, 760, 1], [3650, 930, 1], [3886, 990, 1]])
b.wheel(FX, R, rim=0.62, style='wire', spokes=40, rimMaterial='chrome', whitewall=0.32, trim=True).wheel(RX, R, rim=0.62, style='wire', spokes=40, rimMaterial='chrome', whitewall=0.32)
b.save(sys.argv[1], id='speedster35', name='boattail speedster, 1935', year=1935, length=4940, height=1590, paint='#d6c09a', paint2='#8a3424', frame='chrome',
       marks={'fx': FX, 'rx': RX, 'r': R, 'gap': ARCH, 'cowl': 2080, 'cab': 3060, 'belt': 1185, 'roof': 1336})
