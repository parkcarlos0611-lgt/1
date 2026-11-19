"""Score a drawn car against its reference view, as a whole and element by element (method Z): mean colour
difference (0-255) where both are drawn, and for each element how much of its border lies on a line the view has.

  python3 tools/ref/zscore.py <view png> <length mm> <drawn png> <pad px> [roles json]"""
import sys, json, cv2, numpy as np
MM = 10; src = cv2.imread(sys.argv[1], cv2.IMREAD_UNCHANGED); L = int(sys.argv[2]); g = cv2.imread(sys.argv[3], cv2.IMREAD_UNCHANGED); pad = int(sys.argv[4])
w = round(L / MM); h = round(src.shape[0] * w / src.shape[1]); s = cv2.resize(src, (w, h), interpolation=cv2.INTER_AREA); gy = g.shape[0] - pad; d = g[gy - h:gy, pad:pad + w]
both = (s[..., 3] > 127) & (d[..., 3] > 200); diff = np.abs(s[..., :3].astype(int) - d[..., :3].astype(int)).mean(2)
print(f'whole car: colour difference {diff[both].mean():.1f}, shared area {both.sum() / max(1, ((s[..., 3] > 127) | (d[..., 3] > 200)).sum()):.3f}')
if len(sys.argv) > 5:
    R = json.load(open(sys.argv[5])); own = np.full((h, w), -1, np.int32); names = []
    lum = cv2.cvtColor(s[..., :3], cv2.COLOR_BGR2GRAY); a8 = (s[..., 3] > 127).astype(np.uint8) * 255
    lines = (cv2.Canny(cv2.GaussianBlur(lum, (0, 0), 0.6), 30, 80) > 0) | (cv2.Canny(a8, 50, 150) > 0); near = cv2.distanceTransform((~lines).astype(np.uint8), cv2.DIST_L2, 3)
    for z, i, p in sorted([(p['z'], i, p) for i, p in enumerate(R['panels'])], key=lambda t: t[0]):
        names.append(p['id'])
        if p.get('clip') and p['material'] != 'glass' or p['material'] == 'shadow': continue
        m = np.zeros((h, w), np.uint8); cv2.fillPoly(m, [np.array([[x / MM, h - zz / MM] for x, zz, *_ in p['pts']], np.float32).round().astype(np.int32)], 1)
        for c in p.get('cut') or []: cv2.circle(m, (round(c['x'] / MM), round(h - c['z'] / MM)), round(c['r'] / MM), 0, -1)
        own[m > 0] = len(names) - 1
    for k, n in enumerate(names):
        m = own == k
        if m.sum() < 40: continue
        e = m & ~cv2.erode(m.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool); sel = m & both
        print(f'  {n:14s} colour {diff[sel].mean() if sel.any() else float("nan"):5.1f}   border on a line {(near[e] <= 1.5).mean() * 100:3.0f}%   ({m.sum()} px)')
