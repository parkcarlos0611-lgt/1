"""Read a reference side view for the person writing a body: where the glass is, where the paint catches the
light, where the dark lines run. Prints outlines and polylines in millimetres and writes an overlay picture.
  python3 tools/ref/analyse.py <side view png> <length mm> <paint hex> <out.png>
Nothing it finds goes into the game by itself; it is a measuring aid."""
import sys, json, cv2, numpy as np
src = cv2.imread(sys.argv[1], cv2.IMREAD_UNCHANGED); L = int(sys.argv[2]); paint = tuple(int(sys.argv[3][i:i + 2], 16) for i in (1, 3, 5)); out = sys.argv[4]
h, w = src.shape[:2]; sc = L / w; mask = src[..., 3] > 200; rgb = cv2.cvtColor(src[..., :3], cv2.COLOR_BGR2RGB)
hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(int); H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
ph, ps, pv = cv2.cvtColor(np.uint8([[paint]]), cv2.COLOR_RGB2HSV)[0, 0].astype(int)
mm = lambda x, y: [round(float(x) * sc), round(float(h - y) * sc)]
res = {}
# glass: pale, unsaturated areas in the upper half that are not chrome strips (big enough, compact)
g = (mask & (S < 45) & (V > 120)).astype(np.uint8); g[int(h * 0.62):] = 0; g = cv2.morphologyEx(g, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
cs, _ = cv2.findContours(g, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); res['glass'] = []
for c in sorted(cs, key=cv2.contourArea, reverse=True):
    x, y, bw, bh = cv2.boundingRect(c)
    if cv2.contourArea(c) < 120 or bh < 8 or bw < 8: continue
    res['glass'].append({'box_mm': [round(x * sc), round((h - y - bh) * sc), round((x + bw) * sc), round((h - y) * sc)], 'pts': [mm(px, py) for px, py in cv2.approxPolyDP(c, 1.0, True).reshape(-1, 2)]})
# reflections on the paint: pixels of the paint's hue much brighter than its body, thinned to lines
hue = np.minimum(abs(H - ph), 180 - abs(H - ph)); onpaint = mask & ((hue < 18) | (S < 60)) & ~(g.astype(bool))
bright = (onpaint & (V > min(250, pv + 70))).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(bright, 8); res['highlights'] = []
for i in range(1, n):
    if st[i, 4] < 6 or max(st[i, 2], st[i, 3]) < 8: continue
    ys, xs = np.where(lab == i); order = np.argsort(xs) if st[i, 2] >= st[i, 3] else np.argsort(ys); xs, ys = xs[order], ys[order]
    k = max(1, len(xs) // 8); pts = [mm(xs[j:j + k].mean(), ys[j:j + k].mean()) for j in range(0, len(xs), k)]
    res['highlights'].append({'len_mm': round(max(st[i, 2], st[i, 3]) * sc), 'width_px': round(st[i, 4] / max(st[i, 2], st[i, 3]), 1), 'pts': pts})
res['highlights'].sort(key=lambda r: -r['len_mm'])
ov = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR).copy(); ov[~mask] = (200, 200, 200)
ov[g.astype(bool)] = (ov[g.astype(bool)] * 0.4 + np.array([255, 120, 0]) * 0.6).astype(np.uint8); ov[bright.astype(bool)] = (0, 0, 255)
cv2.imwrite(out, cv2.resize(ov, (w * 4, h * 4), interpolation=cv2.INTER_NEAREST))
print(json.dumps({'mm_per_px': round(sc, 2), 'glass': res['glass'][:6], 'highlights': res['highlights'][:14]}))
