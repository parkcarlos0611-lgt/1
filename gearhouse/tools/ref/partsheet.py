"""The parts check sheet: every part of a car's 3D model alone, in each view it is seen in (left, front, rear, plan),
one row a part, with its name, element, material and box. python3 tools/ref/partsheet.py <modelviews out dir> <out png> [rows per sheet]"""
import sys, json, cv2, numpy as np
d, out = sys.argv[1], sys.argv[2]; per = int(sys.argv[3]) if len(sys.argv) > 3 else 15
L = json.load(open(f'{d}/parts/list.json')); BG = np.array([184, 205, 214]); VIEWS = ['left', 'front', 'rear', 'top']
def load(p):
    im = cv2.imread(p, cv2.IMREAD_UNCHANGED); a = im[..., 3:4] / 255; return cv2.resize((im[..., :3] * a + BG * (1 - a)).astype(np.uint8), None, fx=2, fy=2, interpolation=cv2.INTER_NEAREST)
cellw = {}
for v in VIEWS:
    for p in L:
        if v in p['views']: cellw[v] = load(f"{d}/parts/{p['id']}_{v}.png").shape[:2][::-1]; break
rows = []
for p in L:
    h = max(s[1] for s in cellw.values()); row = np.full((h + 8, 330 + sum(s[0] + 8 for s in cellw.values()), 3), BG, np.uint8)
    b = p['box']; cv2.putText(row, p['id'], (8, 26), 0, 0.7, (30, 30, 30), 2, cv2.LINE_AA); cv2.putText(row, f"{p['element']} / {p['material']}", (8, 52), 0, 0.5, (60, 60, 60), 1, cv2.LINE_AA)
    for k, ax in enumerate('xyz'): cv2.putText(row, f"{ax} {b[ax][0]}..{b[ax][1]} mm", (8, 76 + k * 20), 0, 0.45, (60, 60, 60), 1, cv2.LINE_AA)
    x = 330
    for v in VIEWS:
        w, hh = cellw[v]
        if v in p['views']: im = load(f"{d}/parts/{p['id']}_{v}.png"); row[4:4 + im.shape[0], x:x + im.shape[1]] = im
        else: cv2.putText(row, 'not seen', (x + w // 2 - 30, h // 2), 0, 0.45, (120, 130, 135), 1, cv2.LINE_AA)
        cv2.putText(row, v, (x + 4, h), 0, 0.4, (90, 100, 105), 1, cv2.LINE_AA); x += w + 8
    cv2.line(row, (0, h + 7), (row.shape[1], h + 7), (150, 165, 172), 1); rows.append(row)
for i in range(0, len(rows), per):
    name = out.replace('.png', f'_{i // per + 1}.png'); cv2.imwrite(name, np.vstack(rows[i:i + per])); print(name)
