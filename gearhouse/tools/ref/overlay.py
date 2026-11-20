"""Check a model against its reference view by eye: the outlines of a view's parts (a design json from
tools/ref/modelviews.ts) drawn over the reference view, four times enlarged. Every outline should lie on the line
the drawing has; where it does not, the part's outline or box is wrong.
  python3 tools/ref/overlay.py <view png> <design json> <out png> [flip]   (flip: the view shows the car from behind / right)"""
import sys, json, cv2, numpy as np
src = cv2.imread(sys.argv[1], cv2.IMREAD_UNCHANGED); d = json.load(open(sys.argv[2])); K = 4
im = cv2.resize(src, None, fx=K, fy=K, interpolation=cv2.INTER_CUBIC); v = im[..., :3].copy(); v[im[..., 3] < 128] = (200, 200, 200); h, w = v.shape[:2]
sx, sz = w / d['length'], h / d['height']; cols = [(0, 0, 255), (0, 220, 255), (255, 0, 255), (255, 160, 0), (0, 255, 0), (255, 255, 0)]
for i, p in enumerate(sorted(d['panels'], key=lambda p: p['z'])):
    q = np.array([[x * sx, h - z * sz] for x, z, *_ in p['pts']], np.int32); cv2.polylines(v, [q], True, cols[i % 6], 1, cv2.LINE_AA)
    c = q.mean(0).astype(int); cv2.putText(v, p['id'], (int(c[0]) - 15, int(c[1])), 0, 0.4, (0, 0, 0), 3); cv2.putText(v, p['id'], (int(c[0]) - 15, int(c[1])), 0, 0.4, cols[i % 6], 1)
for wsp in d.get('wheels', []):
    cv2.circle(v, (int(wsp['x'] * sx), int(h - wsp.get('z', wsp['r']) * sz)), int(wsp['r'] * sx), (255, 255, 255), 1, cv2.LINE_AA)
cv2.imwrite(sys.argv[3], v)
