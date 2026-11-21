"""Improvement B (review 28): how much of each part's visible outline lies on a line of the reference drawing.
For one view: parts are filled in their drawing order, so only the stretch of outline a part really shows counts.
Prints a table and draws the outlines over the view: green on a line, red off it.
  python3 tools/ref/score.py <view png> <design json> <out png> [pass mark = 80]"""
import sys, json, cv2, numpy as np
src = cv2.imread(sys.argv[1], cv2.IMREAD_UNCHANGED); d = json.load(open(sys.argv[2])); K = 4; mark = float(sys.argv[4]) if len(sys.argv) > 4 else 80
im = cv2.resize(src, None, fx=K, fy=K, interpolation=cv2.INTER_CUBIC); h, w = im.shape[:2]; sx, sz = w / d['length'], h / d['height']
g = cv2.cvtColor(im[..., :3], cv2.COLOR_BGR2GRAY); a8 = (im[..., 3] > 127).astype(np.uint8) * 255
lines = (cv2.Canny(cv2.GaussianBlur(g, (0, 0), 1.6), 18, 50) > 0) | (cv2.Canny(a8, 50, 150) > 0); near = cv2.distanceTransform((~lines).astype(np.uint8), cv2.DIST_L2, 3)
own = np.full((h, w), -1, np.int32); P = sorted(d['panels'], key=lambda p: p['z'])
polys = [np.array([[x * sx, h - z * sz] for x, z, *_ in p['pts']], np.int32) for p in P]
for i, q in enumerate(polys): cv2.fillPoly(own, [q], i)
for ws in d.get('wheels', []): cv2.circle(own, (int(ws['x'] * sx), int(h - ws.get('z', ws['r']) * sz)), int(ws['r'] * sx), -2, -1)
v = im[..., :3].copy(); v[im[..., 3] < 128] = (200, 200, 200); rows = []
for i, (p, q) in enumerate(zip(P, polys)):
    m = np.zeros((h, w), np.uint8); cv2.polylines(m, [q], True, 1, 1); ys, xs = np.where((m > 0) & (cv2.dilate((own == i).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0))
    if len(xs) < 20: continue
    on = near[ys, xs] <= 2.0 * K / 2; sc = on.mean() * 100; rows.append((sc, p['id'], len(xs)))
    v[ys[on], xs[on]] = (0, 200, 0); v[ys[~on], xs[~on]] = (0, 0, 255)
rows.sort(); cv2.imwrite(sys.argv[3], v)
print(' '.join(f"{n}:{s:.0f}" for s, n, _ in rows)); bad = [n for s, n, _ in rows if s < mark]; print(f'{len(rows) - len(bad)}/{len(rows)} parts at or over {mark:.0f}%; under: {bad}')
