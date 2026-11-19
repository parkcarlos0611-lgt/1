"""Capture a reference view exactly, as game data (decision of 2026-11-19): every pixel of the view at 10 mm/px gets
an element (which part of the car it belongs to), a material, and a tone step. The game redraws it from its own
palette, so no source picture is shipped; elements stay separate layers that can be swapped, repainted and worn.

  python3 tools/ref/capture.py <view png> <roles json> <out map json>

Elements come from the hand-written body (tools/ref/roles.ts): its named panels say roughly where each part is;
the exact borders are taken from the picture."""
import sys, json, cv2, numpy as np
MM = 10
src = cv2.imread(sys.argv[1], cv2.IMREAD_UNCHANGED); R = json.load(open(sys.argv[2])); out = sys.argv[3]
L, paint = R['length'], tuple(int(R['paint'][i:i + 2], 16) for i in (1, 3, 5))
w = round(L / MM); h = round(src.shape[0] * w / src.shape[1]); img = cv2.resize(src, (w, h), interpolation=cv2.INTER_AREA)
mask = img[..., 3] > 127; rgb = cv2.cvtColor(img[..., :3], cv2.COLOR_BGR2RGB); hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(int); Hh, Sa, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
X = lambda x: x / MM; Y = lambda z: h - z / MM
def poly(pts): return np.array([[X(x), Y(z)] for x, z in pts], np.float32).round().astype(np.int32)

# ---- elements: the hand body's panels, lowest layer first; glass and clipped panels only inside what they clip to ----
panels = sorted(R['panels'], key=lambda p: p['z']); names = ['body'] + [p['id'] for p in panels] + ['wheelF', 'wheelR']
role = np.zeros((h, w), np.int32); rmat = {0: 'paint'}
for k, p in enumerate(panels, 1):
    if p['material'] == 'shadow': continue
    m = np.zeros((h, w), np.uint8); cv2.fillPoly(m, [poly(p['pts'])], 1); role[m > 0] = k; rmat[k] = p['material']
for k, wh in enumerate(R['wheels']):
    m = np.zeros((h, w), np.uint8); cv2.circle(m, (int(round(X(wh['x']))), int(round(Y(wh['r'])))), int(round(wh['r'] / MM)), 1, -1)
    behind = role.copy(); idx = len(panels) + 1 + k; fender = np.isin(role, [i for i, p in enumerate(panels, 1) if p['material'] == 'paint' and (p.get('slot') or '').startswith('fender')])
    role[(m > 0) & ~fender] = idx; rmat[idx] = 'rubber'
trim = np.zeros((h, w), np.uint8)
for t in R['trims']: cv2.polylines(trim, [poly(t)], False, 1, 3)

# ---- material of every pixel: the element's own, unless the colour plainly says otherwise ----
ph, ps, pv = cv2.cvtColor(np.uint8([[paint]]), cv2.COLOR_RGB2HSV)[0, 0].astype(int); hue = np.minimum(abs(Hh - ph), 180 - abs(Hh - ph))
MATS = ['paint', 'paint2', 'chrome', 'glass', 'rubber', 'black', 'lens', 'lensR', 'wood', 'white', 'iron']
mat = np.full((h, w), -1, np.int32)
for k, name in rmat.items():
    sel = mask & (role == k); mat[sel] = MATS.index(name if name in MATS else 'paint')
painty = (hue < 22) & (Sa > 28) if ps > 40 else (abs(V - pv) < 60) & (Sa < 60)
cold = (Sa < 42) & (V > 150) & ~painty                                        # bright and colourless: chrome, or glass
isglass = mat == MATS.index('glass'); ispaint = (mat == MATS.index('paint')) | (mat == MATS.index('paint2'))
mat[mask & ispaint & cold & (trim > 0)] = MATS.index('chrome')                # a chrome strip where the hand body has one
mat[mask & ~ispaint & ~isglass & painty & (V > 40) & (mat != MATS.index('lensR')) & (mat != MATS.index('wood')) & (mat != MATS.index('rubber')) & (mat != MATS.index('paint2'))] = MATS.index('paint')   # body colour showing in a part's box
wheel = role > len(panels)
for k, wh in enumerate(R['wheels']):                                          # inside a wheel: tyre, painted rim, bright cap, by radius and colour
    yy, xx = np.mgrid[0:h, 0:w]; rr = np.hypot(xx + 0.5 - X(wh['x']), yy + 0.5 - Y(wh['r'])) * MM; me = mask & (role == len(panels) + 1 + k)
    mat[me & (rr < wh['r'] * wh['rim']) & painty & (Sa > 90) & (V > 70)] = MATS.index('paint'); mat[me & (rr < wh['r'] * wh['rim']) & (Sa < 60) & (V > 110)] = MATS.index('chrome')
    mat[me & (rr < wh['r'] * 0.3) & ~painty] = MATS.index('chrome')          # a maker's badge on the cap becomes plain chrome
    mat[me & (rr >= wh['r'] * wh['rim']) & (Sa < 40) & (V > 170)] = MATS.index('white')
mat[mask & (mat < 0)] = MATS.index('paint')

# ---- tone steps: the picture's own tones for each material, darkest first ----
tones, lv = {}, np.zeros((h, w), np.uint8); STEPS = {'paint': 8, 'paint2': 6, 'chrome': 6, 'glass': 5, 'rubber': 5, 'black': 4, 'lens': 4, 'lensR': 4, 'wood': 5, 'white': 4, 'iron': 4}
lum = (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]).astype(np.float32)
for mi, name in enumerate(MATS):
    sel = mask & (mat == mi); n = int(sel.sum())
    if not n: continue
    k = min(STEPS[name], max(1, n // 12)); px = lum[sel].reshape(-1, 1)
    if k > 1: _, lab, cen = cv2.kmeans(px, k, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 0.3), 4, cv2.KMEANS_PP_CENTERS)
    else: lab, cen = np.zeros((n, 1), np.int32), np.array([[px.mean()]])
    order = np.argsort(cen.ravel()); rank = np.empty(k, np.int32); rank[order] = np.arange(k); lev = rank[lab.ravel()]; lv[sel] = lev
    cols = rgb[sel]; tones[name] = ['#%02x%02x%02x' % tuple(int(v) for v in np.median(cols[lev == i], axis=0)) if (lev == i).any() else '#000000' for i in range(k)]

def rle(a):
    a = a.ravel(); cut = np.flatnonzero(np.diff(a)) + 1; st = np.concatenate([[0], cut]); ln = np.diff(np.concatenate([st, [a.size]])); return np.stack([a[st], ln], 1).ravel().tolist()
el = np.where(mask, role, -1); used = sorted(set(el[mask].tolist()))
json.dump({'id': R['id'], 'view': 'side', 'mm': MM, 'w': w, 'h': h, 'length': L, 'height': h * MM, 'materials': MATS,
           'elements': [{'k': k, 'id': names[k], 'slot': (panels[k - 1]['slot'] if 0 < k <= len(panels) else ('wheel' if k > len(panels) else None)), 'z': (panels[k - 1]['z'] if 0 < k <= len(panels) else (5 if k > len(panels) else 10))} for k in used],
           'tones': tones, 'e': rle(el.astype(np.int32)), 'm': rle(np.where(mask, mat, 0).astype(np.int32)), 'l': rle(np.where(mask, lv, 0).astype(np.int32))}, open(out, 'w'))
print(out, f'{w}x{h}px', len(used), 'elements', {k: len(v) for k, v in tones.items()})
