"""Method ZY: give every element of a fitted body what the reference view shows of it. The captured map
(tools/ref/capture.py, made with the same body's roles) says for each pixel of the view which element it belongs to,
its material and its tone step; here those pixels are handed to their elements, each in its own box, so they travel
with the element when it is moved, stretched, repainted or exchanged. Where the view does not show an element
(behind a fender, behind a lamp) the element has no cells and the game draws it by its own rules.

  python3 tools/ref/skin.py <captured map json> <roles json> <out skin json>"""
import sys, json, cv2, numpy as np
M = json.load(open(sys.argv[1])); R = json.load(open(sys.argv[2])); MM = M['mm']; w, h = M['w'], M['h']
def unrle(a): a = np.array(a).reshape(-1, 2); return np.repeat(a[:, 0], a[:, 1]).reshape(h, w)
el, mt, lv = unrle(M['e']), unrle(M['m']), unrle(M['l']); val = np.where(el >= 0, mt * 16 + lv, -1)
panels = sorted(R['panels'], key=lambda p: p['z']); zof = {0: -1e9}
for k, p in enumerate(panels, 1): zof[k] = p['z']
for k in range(len(R['wheels'])): zof[len(panels) + 1 + k] = 5
zmap = np.vectorize(lambda e: zof.get(int(e), 1e9))(el).astype(np.float32); zmap[el < 0] = 1e9
def rle(a):
    a = a.ravel(); cut = np.flatnonzero(np.diff(a)) + 1; st = np.concatenate([[0], cut]); ln = np.diff(np.concatenate([st, [a.size]])); return np.stack([a[st], ln], 1).ravel().tolist()
out = {}
def give(name, k, z, x0, x1, z0, z1, mask, sig=None):
    """cells of element k: the view's pixels that are its own, or lie inside its shape with nothing in front of it"""
    take = (el == k) | (mask & (zmap <= z)); ys, xs = np.where(take)
    if len(xs) < 4: return
    px0, px1 = int(np.floor(x0 / MM)) - 1, int(np.ceil(x1 / MM)) + 1; py0, py1 = int(np.floor(h - z1 / MM)) - 1, int(np.ceil(h - z0 / MM)) + 1
    px0, py0, px1, py1 = max(0, px0), max(0, py0), min(w, px1), min(h, py1); g = np.where(take, val, -1)[py0:py1, px0:px1]
    if (g >= 0).sum() < 4: return
    out[name] = {'b': [x0, x1, z0, z1], 'x0': px0 * MM, 'z1': (h - py0) * MM, 'w': int(px1 - px0), 'h': int(py1 - py0), 'd': rle(g.astype(np.int32)), **({'sig': sig} if sig else {})}
for k, p in enumerate(panels, 1):
    if p['material'] == 'shadow': continue
    m = np.zeros((h, w), np.uint8); cv2.fillPoly(m, [np.array([[x / MM, h - z / MM] for x, z in p['pts']], np.float32).round().astype(np.int32)], 1)
    for c in p.get('cut') or []: cv2.circle(m, (round(c['x'] / MM), round(h - c['z'] / MM)), round(c['r'] / MM), 0, -1)
    xs = [q[0] for q in p['pts']]; zs = [q[1] for q in p['pts']]; give(p['id'], k, p['z'], min(xs), max(xs), min(zs), max(zs), (m > 0) & (not p.get('clip')))
for i, wh in enumerate(R['wheels']):
    m = np.zeros((h, w), np.uint8); cv2.circle(m, (round(wh['x'] / MM), round(h - wh['r'] / MM)), round(wh['r'] / MM), 1, -1)
    give(f'wheel{i}', len(panels) + 1 + i, 5, wh['x'] - wh['r'], wh['x'] + wh['r'], 0, 2 * wh['r'], m > 0, wh.get('sig'))
json.dump({'mm': MM, 'paint': R['paint'], 'materials': M['materials'], 'tones': M['tones'], 'elements': out}, open(sys.argv[3], 'w'))
n = int((el >= 0).sum()); got = sum(int((np.array(e['d']).reshape(-1, 2)[np.array(e['d']).reshape(-1, 2)[:, 0] >= 0, 1]).sum()) for e in out.values()); print(sys.argv[3], len(out), 'elements with detail;', f'{got}/{n} px of the view handed out')
