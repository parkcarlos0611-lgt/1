"""The pixel-snapping method (grid found by autocorrelation of edge profiles, one colour per cell by majority, a
small palette), written out here to test what it adds to a capture. No outside tool is run.

  python3 tools/ref/snap.py <view png> <out png> [colours=48]

Prints the grid it finds. A reference view drawn near one source pixel per game pixel has no coarser grid to
recover; then only the palette and the majority clean-up act."""
import sys, cv2, numpy as np
src = cv2.imread(sys.argv[1], cv2.IMREAD_UNCHANGED); K = int(sys.argv[3]) if len(sys.argv) > 3 else 48
a = src[..., 3] > 127; g = cv2.cvtColor(src[..., :3], cv2.COLOR_BGR2GRAY).astype(np.float32)
def pitch(profile):
    p = profile - profile.mean(); ac = np.correlate(p, p, 'full')[len(p) - 1:]; ac /= ac[0] + 1e-9
    best = max(range(2, 24), key=lambda k: ac[k]); return (best, float(ac[best])) if ac[best] > 0.25 and ac[best] > ac[1] else (1, float(ac[1]))
gx, gy = pitch(np.abs(np.diff(g, axis=1)).sum(0)), pitch(np.abs(np.diff(g, axis=0)).sum(1))
print('grid x', gx, 'y', gy)
img = src.copy(); cx, cy = gx[0], gy[0]
lab = cv2.cvtColor(src[..., :3], cv2.COLOR_BGR2LAB).astype(np.float32); px = lab[a]
_, lb, cen = cv2.kmeans(px, K, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5), 3, cv2.KMEANS_PP_CENTERS)
idx = np.full(a.shape, -1, np.int32); idx[a] = lb.ravel()
if cx > 1 or cy > 1:                                              # one colour per cell: the majority
    for y in range(0, a.shape[0], cy):
        for x in range(0, a.shape[1], cx):
            c = idx[y:y + cy, x:x + cx]; v = c[c >= 0]
            if v.size * 2 >= c.size: idx[y:y + cy, x:x + cx] = np.bincount(v).argmax()
            else: idx[y:y + cy, x:x + cx] = -1
else:                                                             # no grid: remove single stray pixels by the majority of their 3x3
    out = idx.copy(); H, W = idx.shape
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            c = idx[y, x]
            if c < 0: continue
            n = idx[y - 1:y + 2, x - 1:x + 2].ravel(); n = n[n >= 0]
            if (n == c).sum() <= 1: out[y, x] = np.bincount(n).argmax()
    idx = out
pal = cv2.cvtColor(cen.reshape(1, -1, 3).astype(np.uint8), cv2.COLOR_LAB2BGR)[0]
img[..., :3] = pal[np.clip(idx, 0, K - 1)]; img[..., 3] = np.where(idx >= 0, 255, 0)
cv2.imwrite(sys.argv[2], img); print(sys.argv[2], 'colours', K)
