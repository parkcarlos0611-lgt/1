"""How light falls on each painted element of a body, read off the reference view (method Z): for every panel a small
grid of tone steps over its width and over each column's height. The grid belongs to the shape (it is not a picture:
16 x 16 numbers), so it follows the panel when the car is stretched and is drawn afresh at any size.

  python3 tools/ref/shade.py <view png> <roles json> <captured map json> <body json>     (writes the body json in place)

The captured map (tools/ref/capture.py) is the answer sheet: it says which pixels of the view are paint."""
import sys, json, cv2, numpy as np
import os
MM = 10; NX, NT = int(os.environ.get("NX", 16)), int(os.environ.get("NT", 16))
src = cv2.imread(sys.argv[1], cv2.IMREAD_UNCHANGED); R = json.load(open(sys.argv[2])); M = json.load(open(sys.argv[3])); D = json.load(open(sys.argv[4]))
w, h = M['w'], M['h']; img = cv2.resize(src, (w, h), interpolation=cv2.INTER_AREA); lum = cv2.cvtColor(img[..., :3], cv2.COLOR_BGR2GRAY).astype(np.float32)
def unrle(a): a = np.array(a).reshape(-1, 2); return np.repeat(a[:, 0], a[:, 1]).reshape(h, w)
paint = (unrle(M['e']) >= 0) & np.isin(unrle(M['m']), [M['materials'].index('paint'), M['materials'].index('paint2')])
ramp = np.array([[int(c[i:i + 2], 16) for i in (1, 3, 5)] for c in R['ramp']], np.float32); rl = ramp @ np.array([0.299, 0.587, 0.114], np.float32)
level = np.interp(lum, rl, np.arange(len(rl)))                                   # the picture's tone as a step of the game's own paint ramp
def mask_of(p):
    m = np.zeros((h, w), np.uint8); cv2.fillPoly(m, [np.array([[x / MM, h - z / MM] for x, z, *_ in p['pts']], np.float32).round().astype(np.int32)], 1)
    for c in p.get('cut') or []: cv2.circle(m, (round(c['x'] / MM), round(h - c['z'] / MM)), round(c['r'] / MM), 0, -1)
    return m > 0
own = np.full((h, w), -1, np.int32); items = sorted([(p['z'], i, p) for i, p in enumerate(R['panels'])] + [(5, 999 + i, {'wheel': wh}) for i, wh in enumerate(R['wheels'])], key=lambda t: t[0]); masks = {}
for _, i, p in items:
    if 'wheel' in p: m = np.zeros((h, w), np.uint8); cv2.circle(m, (round(p['wheel']['x'] / MM), round(h - p['wheel']['r'] / MM)), round(p['wheel']['r'] / MM), 1, -1); own[m > 0] = i; continue
    m = mask_of(p); masks[p['id']] = m
    if p.get('clip'): continue
    own[m] = i
n = 0
for i, p in enumerate(R['panels']):
    tgt = next((q for q in D['panels'] if q['id'] == p['id']), None)
    if tgt is None or p['material'] not in ('paint', 'paint2') or p.get('clip'): continue
    m = masks[p['id']]; xs = np.where(m.any(0))[0]
    if len(xs) < 6: continue
    x0, x1 = min(q[0] for q in p['pts']) / MM, max(q[0] for q in p['pts']) / MM; acc = np.zeros((NT, NX)); cnt = np.zeros((NT, NX))
    for x in xs:
        col = m[:, x]; ys = np.where(col)[0]; runs = np.split(ys, np.where(np.diff(ys) > 1)[0] + 1)
        for r in runs:
            ya, nn = r[0], len(r) - 1
            for y in r:
                if own[y, x] != i or not paint[y, x]: continue
                t = (y - ya) / nn if nn > 0 else 0.5; u = min(NX - 1, max(0, int((x + 0.5 - x0) / max(1, x1 - x0) * NX))); b = min(NT - 1, int(round(t * (NT - 1)))); acc[b, u] += level[y, x]; cnt[b, u] += 1
    if cnt.sum() < 30: continue
    g = np.where(cnt > 2, acc / np.maximum(cnt, 1), np.nan)
    for _ in range(NX + NT):                                                      # cells the picture does not show take their neighbours' tone
        if not np.isnan(g).any(): break
        pad = np.pad(g, 1, constant_values=np.nan); nb = np.stack([pad[1:-1, :-2], pad[1:-1, 2:], pad[:-2, 1:-1], pad[2:, 1:-1]]); fill = np.nanmean(nb, 0) if not np.isnan(nb).all() else g
        g = np.where(np.isnan(g), fill, g)
    g = np.nan_to_num(g, nan=float(np.nanmean(g)) if not np.isnan(g).all() else 3.0)
    tgt['shade'] = {'nx': NX, 'nt': NT, 'v': [round(float(v), 2) for v in g.ravel()]}; n += 1
json.dump(D, open(sys.argv[4], 'w'), indent=0); print(sys.argv[4], n, 'panels shaded')
