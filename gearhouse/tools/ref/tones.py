"""Tone maps for a hand-written body (decision of 2026-11-19, item 4): for each of its panels, where the reference
view is lighter and darker, as steps on a grid over the panel's box. The game shades the panel from this map with
its own palette. python3 tools/ref/tones.py <view png> <roles json> <out tones json>"""
import sys, json, cv2, numpy as np
MM = 10; src = cv2.imread(sys.argv[1], cv2.IMREAD_UNCHANGED); R = json.load(open(sys.argv[2])); L = R['length']
w = round(L / MM); h = round(src.shape[0] * w / src.shape[1]); img = cv2.resize(src, (w, h), interpolation=cv2.INTER_AREA); mask = img[..., 3] > 127
lum = cv2.cvtColor(img[..., :3], cv2.COLOR_BGR2GRAY).astype(np.float32); out = {}
STEPS = {'paint': 8, 'paint2': 6, 'chrome': 5, 'wood': 5, 'rubber': 5, 'black': 4, 'iron': 4}
for p in R['panels']:
    if p['material'] not in STEPS: continue
    pts = np.array([[x / MM, h - z / MM] for x, z in p['pts']], np.float32); x0, y0 = np.floor(pts.min(0)).astype(int); x1, y1 = np.ceil(pts.max(0)).astype(int)
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(w, x1 + 1), min(h, y1 + 1)
    if x1 - x0 < 2 or y1 - y0 < 2: continue
    m = np.zeros((h, w), np.uint8); cv2.fillPoly(m, [pts.round().astype(np.int32)], 1); sel = (m[y0:y1, x0:x1] > 0) & mask[y0:y1, x0:x1]
    if sel.sum() < 12: continue
    box = lum[y0:y1, x0:x1]; k = min(STEPS[p['material']], int(sel.sum()) // 6)
    _, lab, cen = cv2.kmeans(box[sel].reshape(-1, 1), k, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 0.3), 3, cv2.KMEANS_PP_CENTERS)
    cen = np.sort(cen.ravel()); lv = np.abs(box[..., None] - cen[None, None, :]).argmin(2).astype(np.int32)
    a = lv.ravel(); cut = np.flatnonzero(np.diff(a)) + 1; st = np.concatenate([[0], cut]); ln = np.diff(np.concatenate([st, [a.size]]))
    out[p['id']] = {'x0': int(x0) * MM, 'z1': int(h - y0) * MM, 'w': int(x1 - x0), 'h': int(y1 - y0), 'mm': MM, 'steps': int(k), 'd': np.stack([a[st], ln], 1).ravel().tolist()}
json.dump(out, open(sys.argv[3], 'w')); print(sys.argv[3], len(out), 'panels with tone maps')
