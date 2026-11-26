"""Method ZY: give every element of a fitted body what the reference view shows of it. The captured map
(tools/ref/capture.py, made with the same body's roles) says for each pixel of the view which element it belongs to,
its material and its tone step; here those pixels are handed to their elements, each in its own box, so they travel
with the element when it is moved, stretched, repainted or exchanged.

  python3 tools/ref/skin.py <captured map json> <roles json> <out skin json> [--common] [--fill] [--clean]

  --common  steps of the game's own ramps instead of the view's colours: each tone of the view goes to the ramp step
            nearest in lightness. Every car then has the same chrome, glass and rubber, and takes any paint (method ZY2)
  --fill    cells inside an element that the view does not show (behind a fender, behind a lamp) take the nearest
            cell the view does show, so a part taken off leaves the surface going on (method ZY2)
  --clean   a cell unlike all four neighbours takes their commonest value; a maker's badge on a hub cap becomes plain
            chrome (method ZY2)"""
import sys, json, cv2, numpy as np
args = [a for a in sys.argv[1:] if not a.startswith('--')]; opt = {a[2:] for a in sys.argv[1:] if a.startswith('--')}
M = json.load(open(args[0])); R = json.load(open(args[1])); MM = M['mm']; w, h = M['w'], M['h']
def unrle(a): a = np.array(a).reshape(-1, 2); return np.repeat(a[:, 0], a[:, 1]).reshape(h, w)
el, mt, lv = unrle(M['e']), unrle(M['m']), unrle(M['l'])
if 'common' in opt:                                                             # each of the view's tones onto the game ramp step nearest in lightness
    L = lambda c: 0.299 * int(c[1:3], 16) + 0.587 * int(c[3:5], 16) + 0.114 * int(c[5:7], 16)
    for mi, name in enumerate(M['materials']):
        tones = M['tones'].get(name, []); ramp = [L(c) for c in R['ramps'].get(name, R['ramps']['paint'])]; sel = (mt == mi) & (el >= 0)
        if not tones or not sel.any(): continue
        to = np.array([int(np.argmin([abs(L(t) - r) for r in ramp])) for t in tones]); lv[sel] = to[np.clip(lv[sel], 0, len(to) - 1)]
val = np.where(el >= 0, mt * 16 + lv, -1)
panels = sorted(R['panels'], key=lambda p: p['z']); zof = {0: -1e9}
for k, p in enumerate(panels, 1): zof[k] = p['z']
for k in range(len(R['wheels'])): zof[len(panels) + 1 + k] = 5
zmap = np.vectorize(lambda e: zof.get(int(e), 1e9))(el).astype(np.float32); zmap[el < 0] = 1e9
def rle(a):
    a = a.ravel(); cut = np.flatnonzero(np.diff(a)) + 1; st = np.concatenate([[0], cut]); ln = np.diff(np.concatenate([st, [a.size]])); return np.stack([a[st], ln], 1).ravel().tolist()
def clean(g, inside):
    o = g.copy(); H, W = g.shape
    for y in range(H):
        for x in range(W):
            v = g[y, x]
            if v < 0: continue
            nb = [g[yy, xx] for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)) if 0 <= yy < H and 0 <= xx < W and g[yy, xx] >= 0]
            if nb and v not in nb: o[y, x] = max(set(nb), key=nb.count)
    return o
out = {}; filled = 0
def give(name, k, z, x0, x1, z0, z1, shape, sig=None, cap=None):
    """cells of element k: the view's pixels that are its own, or lie inside its shape with nothing in front of it"""
    global filled
    take = (el == k) | (shape & (zmap <= z))
    px0, px1 = max(0, int(np.floor(x0 / MM)) - 1), min(w, int(np.ceil(x1 / MM)) + 1); py0, py1 = max(0, int(np.floor(h - z1 / MM)) - 1), min(h, int(np.ceil(h - z0 / MM)) + 1)
    g = np.where(take, val, -1)[py0:py1, px0:px1].astype(np.int32); inside = shape[py0:py1, px0:px1] | (g >= 0)
    if (g >= 0).sum() < 4: return
    if 'fill' in opt and (inside & (g < 0)).any():                              # what the view hides: the nearest shown cell
        _, lab = cv2.distanceTransformWithLabels((g < 0).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
        ys, xs = np.where(g >= 0); src = np.zeros(lab.max() + 1, np.int32); src[lab[ys, xs]] = g[ys, xs]
        hole = inside & (g < 0); g[hole] = src[lab[hole]]; filled += int(hole.sum())
        pi = M['materials'].index('paint'); seen_paint = (g >= 0) & ~hole & ((g >> 4) == pi)
        if seen_paint.sum() > 20 and ((g[hole] >> 4) == pi).any():               # hidden paint: the shading carried on smoothly, not smeared from the edge
            lvl = np.where(seen_paint, (g & 15) * 28 + 14, 0).astype(np.uint8); fixm = (~seen_paint & inside).astype(np.uint8)
            sm = cv2.inpaint(lvl, fixm, 4, cv2.INPAINT_TELEA); hp = hole & ((g >> 4) == pi); g[hp] = pi * 16 + np.clip(sm[hp] // 28, 0, 15)
    if 'clean' in opt:
        g = clean(g, inside)
        if cap is not None:                                                     # a plain domed cap: badge and lettering go, the light stays
            cx, cy, r = cap[0] / MM - px0, (h - cap[1] / MM) - py0, cap[2] / MM; yy, xx = np.mgrid[0:g.shape[0], 0:g.shape[1]]
            ci = M['materials'].index('chrome'); disc = (np.hypot(xx + 0.5 - cx, yy + 0.5 - cy) < r * 0.92) & (g >= 0)
            if disc.any():
                lvl = np.where(disc & ((g >> 4) == ci), g & 15, 0).astype(np.uint8); ch = disc & ((g >> 4) == ci)
                for _ in range(int(r) + 2):                                     # lettering in another material: the chrome around it grows over it
                    grow = cv2.dilate(lvl, np.ones((3, 3), np.uint8)); new = disc & ~ch & (cv2.dilate(ch.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
                    if not new.any(): break
                    lvl[new] = grow[new]; ch |= new
                sm = cv2.medianBlur(cv2.medianBlur(lvl, 3), 3); g[ch] = ci * 16 + sm[ch]
    out[name] = {'b': [x0, x1, z0, z1], 'x0': px0 * MM, 'z1': (h - py0) * MM, 'w': int(px1 - px0), 'h': int(py1 - py0), 'd': rle(g), **({'sig': sig} if sig else {})}
for k, p in enumerate(panels, 1):
    if p['material'] == 'shadow': continue
    m = np.zeros((h, w), np.uint8); cv2.fillPoly(m, [np.array([[x / MM, h - z / MM] for x, z in p['pts']], np.float32).round().astype(np.int32)], 1)
    for c in p.get('cut') or []: cv2.circle(m, (round(c['x'] / MM), round(h - c['z'] / MM)), round(c['r'] / MM), 0, -1)
    xs = [q[0] for q in p['pts']]; zs = [q[1] for q in p['pts']]; give(p['id'], k, p['z'], min(xs), max(xs), min(zs), max(zs), (m > 0) & (not p.get('clip')))
for i, wh in enumerate(R['wheels']):
    m = np.zeros((h, w), np.uint8); cv2.circle(m, (round(wh['x'] / MM), round(h - wh['r'] / MM)), round(wh['r'] / MM), 1, -1)
    cap = (wh['x'], wh['r'], wh['r'] * wh.get('rim', 0.6) * wh.get('cap', 0.52)) if wh.get('sig', '').startswith('disc') else None
    give(f'wheel{i}', len(panels) + 1 + i, 5, wh['x'] - wh['r'], wh['x'] + wh['r'], 0, 2 * wh['r'], m > 0, wh.get('sig'), cap)
# a wheel mostly hidden (behind a skirt or a fender) takes the detail of the wheel the view shows best, as the two are alike
vis = {f'wheel{i}': int(((el == len(panels) + 1 + i)).sum()) for i in range(len(R['wheels']))}
if vis and 'fill' in opt:
    best = max(vis, key=vis.get)
    for k, v in vis.items():
        if k != best and k in out and best in out and v < 0.7 * vis[best] and out[k].get('sig') == out[best].get('sig'): out[k] = dict(out[best])
res = {'mm': MM, 'paint': R['paint'], 'materials': M['materials'], 'elements': out}
if 'common' in opt: res['common'] = True
else: res['tones'] = M['tones']
json.dump(res, open(args[2], 'w'))
n = int((el >= 0).sum()); print(args[2], len(out), 'elements with detail;', n, 'px of the view;', filled, 'hidden cells filled;', 'options', sorted(opt))
