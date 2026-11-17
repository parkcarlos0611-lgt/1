#!/usr/bin/env python3
"""Cut the town art from the background-free sheets into one sprite per item:
  assets/ref/city_market_sheet_alpha.png        market buildings, shops, stalls, temporary buildings, props
  assets/ref/city_street_props_sheet_alpha.png  billboards, lamps, bins, civilian vehicles (intact / damaged)
The sheets' alpha is near-opaque (251-253) on the art with a faint red halo (alpha ~35) left by the
background removal: alpha under 120 is dropped, over 200 made solid, and every edge pixel takes the colour
of the nearest solid pixel, so no red or white fringe survives. Caption text inside a box is dropped.
Each item's real size (data/town_scale.js agreed values; the rest below) sets its metres; writes
assets/sprites/town/<id>.png and data/town_sprites.js.   usage: python3 tools/cut_town.py
"""
import os, json
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/sprites/town'); os.makedirs(OUT, exist_ok=True)
M = 'assets/ref/city_market_sheet_alpha.png'; S = 'assets/ref/city_street_props_sheet_alpha.png'
# id: (sheet, (x0, y0, x1, y1), 'h' height m | 'L' length m, value, name)
ITEMS = {
 # market buildings (panoramas for the far rows; single buildings for the drive line)
 'market_a':      (M, (0, 40, 1535, 250), 'ref', 'market_gate', '시장 단지 A (파노라마)'),
 'market_gate':   (M, (326, 8, 604, 250), 'h', 11, '시장 아치문'),
 'market_2storey':(M, (1196, 6, 1535, 250), 'h', 8, '시장 2층 상가'),
 'market_b':      (M, (0, 276, 996, 440), 'ref', 'market_arcade', '시장 단지 B (파노라마)'),
 'market_arcade': (M, (0, 278, 440, 440), 'h', 6.5, '시장 아케이드'),
 'market_alley':  (M, (1001, 292, 1535, 442), 'h', 8, '시장 골목'),
 'shop_garage':   (M, (4, 478, 180, 608), 'ref', 'shop_grocery', '상점 (셔터)'),
 'shop_awning':   (M, (176, 486, 326, 608), 'ref', 'shop_grocery', '상점 (차양)'),
 'shop_grocery':  (M, (321, 456, 492, 608), 'h', 5.2, '상점 (식료품)'),
 'shop_clothes':  (M, (489, 456, 660, 608), 'ref', 'shop_grocery', '상점 (의류)'),
 'shop_elec':     (M, (655, 460, 806, 608), 'ref', 'shop_grocery', '상점 (전자)'),
 'stall_fruit':   (M, (809, 486, 1041, 609), 'h', 2, '과일 노점'),
 'stall_red':     (M, (1042, 488, 1206, 609), 'h', 2, '노점 (빨간 차양)'),
 'stall_blue':    (M, (1206, 482, 1386, 609), 'h', 2, '노점 (파란 차양)'),
 'stall_meat':    (M, (1381, 478, 1533, 609), 'h', 2, '고기 노점'),
 'tin_shed':      (M, (0, 648, 256, 752), 'h', 3.4, '함석 창고'),
 'shed_pair':     (M, (258, 638, 611, 752), 'h', 3.6, '판잣집 상점'),
 'container':     (M, (610, 640, 850, 753), 'L', 6.1, '컨테이너 사무실'),
 'tent':          (M, (849, 624, 1096, 753), 'h', 4, '텐트'),
 'quonset':       (M, (1095, 634, 1316, 753), 'h', 4.6, '반원형 창고'),
 'canopy':        (M, (1317, 636, 1535, 753), 'h', 2.6, '차양 창고'),
 'shelter_tin':   (M, (0, 796, 256, 896), 'h', 3.2, '함석 차양'),
 'shelter_wood':  (M, (254, 800, 412, 896), 'h', 2.8, '나무 차양'),
 'shelter_cloth': (M, (411, 786, 601, 896), 'h', 3, '천 차양'),
 'ruin_small':    (M, (600, 788, 721, 896), 'h', 4, '무너진 벽 (작음)'),
 'ruin_wall':     (M, (719, 788, 1041, 896), 'h', 4.5, '무너진 담장'),
 'camo_net':      (M, (1043, 774, 1404, 896), 'h', 3, '위장망 진지'),
 'watchtower':    (M, (1403, 758, 1533, 896), 'h', 6, '감시탑'),
 'fruit_crate1':  (M, (8, 934, 85, 976), 'h', 0.45, '과일 상자'),
 'fruit_crate2':  (M, (84, 934, 155, 976), 'h', 0.45, '과일 상자'),
 'fruit_crate3':  (M, (155, 934, 229, 976), 'h', 0.45, '과일 상자'),
 'plastic_crate': (M, (229, 932, 300, 976), 'h', 0.35, '플라스틱 상자'),
 'crates':        (M, (304, 914, 394, 974), 'h', 0.9, '나무 상자 더미'),
 'sacks':         (M, (399, 919, 488, 974), 'h', 0.6, '자루'),
 'basket':        (M, (492, 913, 552, 974), 'h', 0.5, '바구니'),
 'pots':          (M, (558, 910, 665, 974), 'h', 0.7, '항아리'),
 'jerrycans':     (M, (670, 918, 727, 974), 'h', 0.47, '연료통'),
 'crate_stack':   (M, (731, 912, 803, 974), 'h', 1.0, '상자 더미'),
 'drum_red':      (M, (806, 905, 858, 974), 'h', 0.9, '드럼통 (빨강)'),
 'drum_blue':     (M, (859, 906, 910, 974), 'h', 0.9, '드럼통 (파랑)'),
 'ibc':           (M, (919, 905, 1003, 974), 'h', 1.15, 'IBC 탱크'),
 'water_tank':    (M, (1013, 902, 1106, 974), 'L', 2.4, '물탱크'),
 'sandbags':      (M, (1112, 913, 1243, 970), 'h', 0.75, '모래주머니'),
 'barrier1':      (M, (1245, 916, 1381, 972), 'L', 3.0, '콘크리트 방벽'),
 'barrier2':      (M, (1379, 911, 1531, 972), 'L', 3.0, '콘크리트 방벽'),
 'table':         (M, (3, 971, 102, 1022), 'h', 0.75, '탁자'),
 'covered_goods': (M, (105, 976, 215, 1022), 'h', 0.6, '덮인 짐'),
 'red_table':     (M, (215, 970, 355, 1022), 'h', 0.8, '진열대'),
 'carpet_stand':  (M, (358, 969, 494, 1022), 'h', 0.8, '카펫 진열'),
 'flat_sacks':    (M, (500, 975, 626, 1022), 'h', 0.5, '쌓인 자루'),
 'pallet_goods':  (M, (634, 975, 718, 1022), 'h', 0.5, '팔레트 짐'),
 'small_table':   (M, (727, 976, 796, 1022), 'h', 0.6, '작은 탁자'),
 'roadblock1':    (M, (808, 970, 890, 1022), 'h', 1.0, '도로 차단기'),
 'roadblock2':    (M, (892, 970, 978, 1022), 'h', 1.0, '도로 차단기'),
 'hedgehog':      (M, (992, 969, 1056, 1022), 'h', 1.0, '대전차 장애물'),
 'tires1':        (M, (1066, 968, 1139, 1022), 'h', 0.6, '타이어'),
 'tires2':        (M, (1149, 970, 1216, 1022), 'h', 0.45, '타이어'),
 'pallets':       (M, (1226, 972, 1313, 1022), 'h', 0.5, '팔레트'),
 'table2':        (M, (1325, 969, 1395, 1022), 'h', 0.75, '탁자'),
 'stool':         (M, (1402, 978, 1444, 1022), 'h', 0.45, '의자'),
 'crates_small':  (M, (1445, 966, 1527, 1022), 'h', 0.6, '작은 상자'),
 # street furniture
 'billboard':     (S, (9, 38, 312, 302), 'h', 5, '대형 도로 광고판'),
 'roof_billboard':(S, (312, 27, 528, 290), 'h', 7, '옥상 광고판 (건물 모서리)'),
 'shop_sign':     (S, (529, 61, 670, 292), 'h', 4, '상점 간판 (벽)'),
 'direction_sign':(S, (683, 65, 867, 300), 'h', 4.6, '방향 표지판'),
 'poster_board':  (S, (867, 48, 1064, 297), 'h', 3.6, '선전 포스터판'),
 'billboard_dmg': (S, (1060, 55, 1279, 290), 'h', 5, '파손된 광고판'),
 'sign_frame':    (S, (1268, 88, 1446, 292), 'h', 4.2, '파괴된 간판 프레임'),
 'lamp':          (S, (108, 388, 246, 586), 'h', 5.5, '가로등'),
 'lane_lamp':     (S, (536, 430, 616, 588), 'h', 3.8, '동네 가로등'),
 'traffic_light': (S, (686, 376, 858, 588), 'h', 5.5, '신호등'),
 'lamp_bent':     (S, (897, 392, 1078, 588), 'h', 4.8, '휜 가로등'),
 'lamp_down':     (S, (1096, 490, 1422, 588), 'L', 6, '쓰러진 가로등'),
 'trash_can':     (S, (104, 672, 199, 785), 'h', 0.9, '금속 쓰레기통'),
 'wheelie_bin':   (S, (290, 667, 398, 786), 'h', 1.1, '바퀴 쓰레기통'),
 'dumpster':      (S, (466, 645, 720, 787), 'h', 1.5, '대형 덤스터'),
 'burn_drum':     (S, (769, 657, 893, 802), 'h', 0.95, '오픈 드럼통'),
 'bin_tipped':    (S, (931, 677, 1156, 784), 'L', 1.4, '쓰러진 쓰레기통'),
 'bin_burnt':     (S, (1202, 662, 1407, 785), 'h', 1.0, '불탄 쓰레기통'),
 'sedan':         (S, (40, 868, 282, 952), 'L', 4.4, '소형 승용차'),
 'old_sedan':     (S, (302, 863, 562, 952), 'L', 4.7, '구형 세단'),
 'pickup':        (S, (573, 855, 841, 952), 'L', 5.0, '픽업트럭'),
 'van':           (S, (866, 842, 1113, 952), 'h', 1.85, '화물밴'),
 'taxi':          (S, (1132, 853, 1402, 952), 'L', 4.4, '택시'),
 'sedan_dmg':     (S, (45, 983, 282, 1062), 'L', 4.4, '승용차 (파손)'),
 'old_sedan_dmg': (S, (310, 982, 564, 1062), 'L', 4.7, '세단 (방치)'),
 'pickup_dmg':    (S, (587, 983, 831, 1062), 'L', 5.0, '픽업트럭 (손상)'),
 'van_dmg':       (S, (870, 984, 1087, 1062), 'ref', 'van', '화물밴 (손상)'),
 'taxi_burnt':    (S, (1125, 983, 1408, 1062), 'L', 4.4, '전소 차량'),
}
# damaged / wrecked state of an intact item (the game swaps the sprite)
DAMAGED = {'sedan': 'sedan_dmg', 'old_sedan': 'old_sedan_dmg', 'pickup': 'pickup_dmg', 'van': 'van_dmg', 'taxi': 'taxi_burnt',
           'lamp': 'lamp_bent', 'lamp_bent': 'lamp_down', 'billboard': 'billboard_dmg', 'billboard_dmg': 'sign_frame',
           'wheelie_bin': 'bin_tipped', 'trash_can': 'bin_burnt'}

sheets = {k: np.asarray(Image.open(os.path.join(ROOT, k)).convert('RGBA')).astype(np.float32) for k in (M, S)}
def cut(sheet, box):
    a = sheets[sheet][box[1]:box[3], box[0]:box[2]].copy()
    al = np.clip((a[..., 3] - 120) / 80, 0, 1)
    solid = al > 0.5
    # caption text: thin dark islands (height under 22 px, dark) are dropped
    lab, n = ndimage.label(ndimage.binary_dilation(solid, iterations=1))
    if n > 1:
        sizes = np.bincount(lab.ravel()); big = sizes[1:].max()
        for j, sl in enumerate(ndimage.find_objects(lab), 1):
            h = sl[0].stop - sl[0].start; part = lab[sl] == j
            lum = a[sl][..., :3][part].mean() if part.any() else 255
            w = sl[1].stop - sl[1].start
            if (h < 22 and lum < 140) or sizes[j] < big * 0.004 or (h <= 5 and w > 12 * h): al[lab == j] = 0      # captions, specks, divider lines
    core = al >= 0.99
    _, (iy, ix) = ndimage.distance_transform_edt(~core, return_indices=True)
    rgb = np.where(core[..., None], a[..., :3], a[iy, ix, :3])
    ys, xs = np.nonzero(al > 0.02)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return Image.fromarray(np.dstack([rgb, al * 255]).astype(np.uint8)[y0:y1, x0:x1])

info, ppm = {}, {}
order = sorted(ITEMS, key=lambda k: ITEMS[k][2] == 'ref')        # sized items first, then those sized by another
for k in order:
    sh, box, met, val, name = ITEMS[k]
    im = cut(sh, box); w, h = im.size
    if met == 'ref':                                           # drawn at the same scale as another item
        r = info[val]; scale = ppm[val] if ITEMS[val][0] == sh else None
        if k == 'van_dmg': L = info['van']['w']; p = w / L
        else: p = scale
    else: p = h / val if met == 'h' else w / val
    ppm[k] = p
    im.save(os.path.join(OUT, k + '.png'))
    info[k] = {'name': name, 'w': round(w / p, 2), 'h': round(h / p, 2), 'px': [w, h]}
    if k in DAMAGED: info[k]['dmg'] = DAMAGED[k]
js = ('// Town sprites cut by tools/cut_town.py (do not edit by hand): name, real width and height (m), sprite px,\n'
      '// dmg = the item it turns into when damaged. Files: assets/sprites/town/<id>.png\n'
      'window.DS = window.DS || {};\nDS.TOWN_SPRITES = ' + json.dumps(info, ensure_ascii=False) + ';\n')
open(os.path.join(ROOT, 'data/town_sprites.js'), 'w').write(js)
for k in ITEMS: print(k, info[k]['w'], info[k]['h'])
