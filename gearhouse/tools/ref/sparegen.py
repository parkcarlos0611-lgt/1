"""The spare wheel as a copy of the car's own wheel (review 69). Every view that sees it flat on (from behind, for a
spare on the tail) already draws it with the car's wheel spec (spokes, rim, whitewall), so a change of wheels changes
the spare too; this makes its size the car's tyre and its edge-on views (the side and the plan, for a tail spare) the
tyre's own section: the car's tyre radius and the tyre width measured on the sheet (data/cars/layout.json), each view
keeping the centre the sheet gives it. The builder gives only where the spare sits; nothing of it is drawn by hand.

  python3 tools/ref/sparegen.py <model json> [...]"""
import sys, os, json, math
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LAYOUT = json.load(open(os.path.join(ROOT, 'data/cars/layout.json')))['cars']
def tyre_section(n=5):
    """a tyre seen edge on, in the unit box: straight tread across the middle, the shoulders rounded at both ends"""
    out = []
    for cy, a0 in ((1.0, 0), (0.0, 180)):
        for k in range(n + 1):
            t = math.radians(a0 + 180 * k / n); out.append([round(0.5 + 0.5 * math.cos(t), 4), round(cy - (0.09 if cy else -0.09) + 0.09 * math.sin(t) * (1 if cy else 1), 4), 0])
    return out
for f in sys.argv[1:]:
    m = json.load(open(f)); cid = m['id']; r = max(w['r'] for w in m['wheels']); tw = LAYOUT.get(cid, {}).get('tyreW') or round(r * 0.46)
    n = 0
    for p in m['parts']:
        if p['id'] != 'spare' or 'wheel' not in p: continue
        sh = p['sheet']; c = lambda a, b: (a + b) / 2
        if 'side' in sh: x = c(*sh['side'][:2]); z = c(*sh['side'][2:]); sh['side'] = [round(x - tw / 2), round(x + tw / 2), round(z - r), round(z + r)]; p['outlines']['side'] = tyre_section()
        if 'top' in sh: x = c(*sh['top'][:2]); y = c(*sh['top'][2:]); sh['top'] = [round(x - tw / 2), round(x + tw / 2), round(y - r), round(y + r)]; p['outlines']['top'] = [[q[1], q[0], 0] for q in tyre_section()]
        if 'rear' in sh: y = c(*sh['rear'][:2]); z = c(*sh['rear'][2:]); sh['rear'] = [round(y - r), round(y + r), round(z - r), round(z + r)]
        xc, zc = c(*p['box']['x']), c(*p['box']['z']); p['box'] = {'x': [round(xc - tw / 2), round(xc + tw / 2)], 'y': [-r, r], 'z': [round(zc - r), round(zc + r)]}
        p['wheel'] = {'r': r}; p['material'] = 'rubber'; n += 1
    json.dump(m, open(f, 'w'), indent=1); print(cid, n, 'spare(s): r', r, 'tyre width', tw)
