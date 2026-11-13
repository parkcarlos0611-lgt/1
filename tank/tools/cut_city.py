#!/usr/bin/env python3
"""Cut the town buildings, vegetation, rocks and debris for the firing range:
  assets/ref/buildings_vegetation_sheet.png → assets/sprites/city/<id>.webp   (buildings, plants, rocks)
  assets/ref/debris_sheet.png               → assets/sprites/debris/<id>.webp
plus a JSON index (sizes; for buildings the roof line, where the solid block starts under the rooftop clutter).
White page, white islands and white edge halos are removed (tools/sheet_cut.py).
usage: python3 tools/cut_city.py
"""
import os, sys, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sheet_cut import cut

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def out_dir(n): d = os.path.join(ROOT, 'assets/sprites', n); os.makedirs(d, exist_ok=True); return d
def save(im, d, name, scale):
    if scale != 1: im = im.convert('RGBa').resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS).convert('RGBA')
    im.save(os.path.join(d, name + '.webp'), quality=90, method=5)
    return im

# ---- buildings: (id, x0, x1, row) on the 6144 x 4096 sheet ----
# band per row; the row captions sit at the far left, so the first building of each row starts lower
ROWS = {'h': (60, 1475), 'm': (1560, 2495), 'l': (2600, 3140)}
FIRST = {'h1': 165, 'm1': 1680, 'l1': 2700}
B = [('h1', 35, 827, 'h'), ('h2', 877, 1596, 'h'), ('h3', 1681, 2392, 'h'), ('h4', 2472, 3311, 'h'), ('h5', 3372, 4058, 'h'), ('h6', 4141, 4866, 'h'),
     ('hd1', 4945, 5511, 'h'), ('hd2', 5571, 6102, 'h'),
     ('m1', 60, 855, 'm'), ('m2', 960, 1679, 'm'), ('m3', 1800, 2529, 'm'), ('m4', 2642, 3424, 'm'), ('m5', 3532, 4393, 'm'), ('m6', 4534, 5211, 'm'), ('m7', 5321, 6108, 'm'),
     ('l1', 31, 1070, 'l'), ('l2', 1099, 1700, 'l'), ('l3', 1750, 2666, 'l'), ('l4', 2712, 3362, 'l'), ('l5', 3399, 4248, 'l'), ('l6', 4284, 5176, 'l'), ('l7', 5218, 6120, 'l')]
VEG = [('bush1', 40, 3530, 530, 3770), ('bush2', 548, 3420, 1006, 3770), ('bush3', 1028, 3420, 1394, 3770), ('bush4', 1408, 3360, 1866, 3770), ('bush5', 1872, 3400, 2272, 3770),
       ('tree', 2288, 3230, 3036, 3780), ('bush6', 3072, 3390, 3560, 3770), ('grass1', 3604, 3400, 4058, 3770), ('grass2', 4060, 3420, 4540, 3770),
       ('grass3', 4540, 3480, 4826, 3762), ('grass4', 4836, 3460, 5178, 3762), ('bush7', 5180, 3450, 5600, 3770), ('grass5', 5592, 3540, 6094, 3762),
       ('rock1', 40, 3820, 472, 4036), ('rock2', 520, 3876, 874, 4012), ('rock3', 912, 3832, 1662, 4032), ('rock4', 1726, 3900, 2126, 4028),
       ('rock5', 2186, 3866, 2806, 4024), ('rock6', 2858, 3868, 3482, 4036), ('rock7', 3536, 3830, 4110, 4032), ('dune1', 4160, 3790, 5066, 4056), ('dune2', 5120, 3780, 6110, 4048)]

# Storeys: the facade is lighter along the floor slabs and darker across the window bands, so the cell rows are
# put on the slab lines: the storey count and phase that put the boundaries on the brightest rows win.
FLOORS = {'h': (9, 17), 'm': (4, 7), 'l': (1, 3)}
def grid(im, roof, kind):
    a = np.asarray(im).astype(np.float32); H, W = a.shape[:2]
    al = a[..., 3] > 128; lum = a[..., :3].mean(axis=2)
    x0, x1 = int(W * 0.2), int(W * 0.8)
    prof = np.array([lum[y, x0:x1][al[y, x0:x1]].mean() if al[y, x0:x1].sum() > 5 else 0 for y in range(H)])
    k = np.ones(5) / 5; prof = np.convolve(prof, k, mode='same')
    body = H - roof; best = None
    lo, hi = FLOORS[kind]
    for n in range(lo, hi + 1):
        P = body / n
        for ph in np.linspace(-P * 0.45, P * 0.45, 19):
            bnd = [roof + ph + P * i for i in range(1, n)]
            mid = [roof + ph + P * (i + 0.5) for i in range(n)]
            ok = [int(y) for y in bnd if 0 <= y < H]; mk = [int(y) for y in mid if 0 <= y < H]
            if not ok: continue
            sc = prof[ok].mean() - prof[mk].mean() - 0.6 * abs(ph) / P
            if best is None or sc > best[0]: best = (sc, n, ph)
    _, n, ph = best
    P = body / n
    rows = [0] + [int(round(roof + ph + P * i)) for i in range(1, n)] + [H]
    rows = sorted(set(max(1, min(H - 1, y)) if 0 < i < n else y for i, y in enumerate(rows)))
    cols = max(2, round(W / (P * 1.45)))                        # bays about one and a half storeys wide
    # snap every boundary to the brightest line near its even position (slabs, piers), within a quarter bay
    def snap(pos, prof, span):
        out = []
        for p in pos:
            lo2, hi2 = int(max(1, p - span)), int(min(len(prof) - 2, p + span))
            out.append(lo2 + int(np.argmax(prof[lo2:hi2 + 1])) if hi2 > lo2 else int(p))
        return out
    rows = [0] + snap(rows[1:-1], prof, P * 0.2) + [H]
    yb0 = roof + int(body * 0.15); cprof = np.array([lum[yb0:, x][al[yb0:, x]].mean() if al[yb0:, x].sum() > 5 else 0 for x in range(W)])
    cprof = np.convolve(cprof, k, mode='same'); bw = W / cols
    xb = [0] + snap([bw * c for c in range(1, cols)], cprof, bw * 0.25) + [W]
    occ = []
    for r in range(len(rows) - 1):
        row = []
        for c in range(cols):
            xa, xb2 = xb[c], xb[c + 1]
            ya, yb = rows[r], rows[r + 1]
            if r == 0: ya = max(ya, roof - 4)                    # rooftop clutter does not count
            cell = al[ya:yb, xa:xb2]
            row.append(1 if cell.size and cell.mean() > 0.35 else 0)
        occ.append(row)
    return rows, xb, occ

def main():
    sheet = Image.open(os.path.join(ROOT, 'assets/ref/buildings_vegetation_sheet.png')).convert('RGB')
    d = out_dir('city'); info = {}
    for bid, x0, x1, r in B:
        y0, y1 = ROWS[r]; y0 = FIRST.get(bid, y0)
        im, box = cut(sheet, (x0 - 6, y0, x1 + 6, y1), island_px=900)
        im = save(im, d, bid, 0.6)
        a = np.asarray(im)[..., 3] > 128
        w = a.sum(axis=1); full = w.max()
        roof = int(np.argmax(w > 0.62 * full))                    # first row where the solid block starts
        rows, cols, occ = grid(im, roof, bid[0])
        info[bid] = {'w': im.width, 'h': im.height, 'roof': roof, 'rows': rows, 'cols': cols, 'occ': occ}
        print(bid, im.width, im.height, roof, len(rows) - 1, len(cols) - 1)
    for vid, x0, y0, x1, y1 in VEG:
        im, box = cut(sheet, (x0, y0, x1, y1), island_px=300)
        im = save(im, d, vid, 0.5); info[vid] = {'w': im.width, 'h': im.height}
    json.dump(info, open(os.path.join(d, 'city.json'), 'w'), indent=1)
    # data/city.js: what the game reads (hb: height from the ground to the roof line, m)
    NAMES = {'h1': ('고층 아파트 A', 30), 'h2': ('유리 업무 빌딩', 30), 'h3': ('고층 아파트 B', 32), 'h4': ('아치 기단 빌딩', 32), 'h5': ('업무 빌딩', 30), 'h6': ('원통형 빌딩', 30),
             'hd1': ('파손된 고층 A', 30), 'hd2': ('파손된 고층 B', 30), 'm1': ('중층 건물 1', 15), 'm2': ('중층 건물 2', 18), 'm3': ('중층 건물 3', 15), 'm4': ('중층 건물 4', 15),
             'm5': ('중층 건물 5', 14), 'm6': ('중층 건물 6', 15), 'm7': ('중층 건물 7', 15), 'l1': ('단층 연립', 6), 'l2': ('아치 건물', 7), 'l3': ('2층 상가주택', 7),
             'l4': ('돔 건물', 6.5), 'l5': ('상점 건물', 6), 'l6': ('창고', 7), 'l7': ('차양 시장', 4.5)}
    city = {k: dict(info[k], name=NAMES[k][0], hb=NAMES[k][1], kind=k[0]) for k in NAMES}
    plants = {k: info[k] for k, *_ in VEG}
    with open(os.path.join(ROOT, 'data/city.js'), 'w') as f:
        f.write('// Town buildings and desert plants cut by tools/cut_city.py (do not edit by hand). rows / cols: cell\n'
                '// boundaries in sprite pixels (rows top-down, on the floor slabs; cols on the piers); occ: which cells hold\n'
                '// wall. hb: height from the ground to the roof line (m). Sprites: assets/sprites/city/<id>.webp\n')
        f.write('window.DS = window.DS || {};\nDS.CITY = ' + json.dumps(city, separators=(',', ':'), ensure_ascii=False) + ';\n')
        f.write('DS.PLANTS = ' + json.dumps(plants, separators=(',', ':')) + ';\n')

    deb = Image.open(os.path.join(ROOT, 'assets/ref/debris_sheet.png')).convert('RGB')
    D = {   # id: box on the 1448 x 1086 sheet
        'pile1': (4, 92, 140, 156), 'pile2': (146, 80, 332, 156), 'pile3': (336, 54, 618, 164), 'pile4': (620, 14, 988, 170), 'pile5': (980, 0, 1448, 190),
        'conc1': (6, 174, 120, 264), 'conc2': (172, 176, 314, 260), 'conc3': (324, 172, 460, 264), 'conc4': (472, 174, 594, 266), 'conc5': (604, 186, 702, 262),
        'conc6': (744, 196, 800, 256), 'conc7': (802, 184, 872, 260), 'brick1': (884, 206, 970, 266), 'brick2': (980, 198, 1062, 260), 'brick3': (1062, 198, 1156, 260),
        'grit1': (1166, 216, 1230, 260), 'grit2': (1288, 216, 1442, 258),
        'wall1': (0, 270, 234, 412), 'wall2': (238, 270, 420, 416), 'wall3': (422, 270, 640, 412), 'wall4': (642, 276, 890, 412), 'wall5': (890, 282, 972, 410), 'slab1': (970, 290, 1086, 410),
        'block1': (1088, 310, 1202, 400), 'block2': (1202, 318, 1322, 398), 'col1': (0, 415, 96, 556), 'col2': (96, 450, 236, 556), 'arch': (680, 466, 852, 558), 'pillar': (858, 420, 944, 558),
        'rebar1': (936, 440, 1112, 556), 'rebar2': (1094, 446, 1242, 554), 'rebar3': (1238, 454, 1312, 552), 'rebar4': (1306, 442, 1418, 544),
        'beam1': (4, 558, 184, 652), 'beam2': (186, 558, 352, 652), 'sheet1': (486, 558, 642, 652), 'sheet2': (646, 558, 814, 652), 'sheet3': (808, 572, 1016, 648), 'sheet4': (1016, 580, 1182, 650), 'pipe': (1272, 576, 1446, 640),
        'sack1': (2, 654, 162, 740), 'sack2': (160, 654, 322, 740), 'sack3': (320, 654, 462, 740), 'wood1': (618, 646, 808, 742), 'wood2': (786, 648, 934, 730), 'wood3': (1156, 648, 1332, 730),
        'burnt1': (4, 740, 194, 844), 'burnt2': (192, 728, 422, 844), 'burnt3': (420, 728, 672, 844), 'burnt4': (670, 728, 946, 844),
        'barrel': (944, 748, 1036, 844), 'barrel2': (1036, 750, 1204, 844), 'barrel3': (1202, 744, 1340, 838),
        'crate': (6, 846, 132, 944), 'crate2': (148, 846, 302, 944), 'glass1': (500, 846, 752, 936), 'glass2': (754, 860, 914, 932), 'glass3': (918, 874, 1030, 928), 'gravel': (1042, 870, 1224, 932),
        'mixed1': (0, 934, 362, 1086), 'mixed2': (360, 934, 722, 1086), 'mixed3': (720, 934, 1074, 1086), 'mixed4': (1072, 912, 1448, 1086),
    }
    d2 = out_dir('debris'); info2 = {}
    for k, box in D.items():
        im, b2 = cut(deb, box, page_thr=230, island_px=120)
        im.save(os.path.join(d2, k + '.webp'), quality=90, method=5); info2[k] = {'w': im.width, 'h': im.height}
    json.dump(info2, open(os.path.join(d2, 'debris.json'), 'w'), indent=1)
    with open(os.path.join(ROOT, 'data/city.js'), 'a') as f: f.write('DS.DEBRIS = ' + json.dumps(info2, separators=(',', ':')) + ';\n')
    print('debris', len(info2))

if __name__ == '__main__': main()
