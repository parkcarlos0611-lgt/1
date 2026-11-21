"""The 1936 two-door sedan by method Z: the hand-written body (data/bodies/sedan36.json) fitted to its reference
view and cut into elements. python3 tools/ref/sedan36_z.py <side view png> data/bodies/sedan36z.json"""
import sys, json, copy, numpy as np
sys.path.insert(0, 'tools/ref'); from zkit import View, fit_closed, fit_open, split
d = json.load(open('data/bodies/sedan36.json')); V = View(sys.argv[1], d['length']); P = {p['id']: p for p in d['panels']}; log = {}
edge = np.maximum(V.sil * 3, V.grad)
for pid, field, reach in (('body', V.sil * 3, 4), ('fenderF', edge, 3.5), ('fenderR', edge, 3.5), ('glass2', V.grad, 3), ('glass3', V.grad, 3), ('glass', V.grad, 2)):
    P[pid]['pts'], log[pid] = fit_closed(V, P[pid]['pts'], field, reach=reach, floor=25)
def ext(line, by=160):
    a, b = np.array(line[0][:2], float), np.array(line[1][:2], float); c, e = np.array(line[-2][:2], float), np.array(line[-1][:2], float)
    u = (a - b) / np.linalg.norm(a - b); v = (e - c) / np.linalg.norm(e - c); return [list(a + u * by)] + [q[:2] for q in line] + [list(e + v * by)]
def cut(name, core):
    f, log[name] = fit_open(V, [[x, z, 1] for x, z in core], V.dark, reach=3, floor=4); return ext(f)
CUTS = [('_', 'body.roof', '_', cut('roof line', [[1800, 1770], [1880, 1810], [2200, 1845], [3000, 1855], [3440, 1805], [3700, 1650], [3860, 1480], [3950, 1400]])),
        ('_', 'body.tail', '_', cut('boot line', [[3975, 1385], [4060, 1180], [4140, 1000], [4300, 820], [4400, 715], [4480, 630]])),
        ('_', 'body.hood', '_', cut('hood back', [[1610, 330], [1615, 560], [1640, 1000], [1668, 1398]])),
        ('_', 'body.cowl', '_', cut('door front', [[1725, 330], [1725, 1330], [1770, 1420], [1900, 1760], [1925, 1830]])),
        ('_', 'body.door', '_', cut('door back', [[2775, 320], [2775, 1000], [2775, 1850]])),
        ('body.door', 'body.door', 'body.sill', cut('door foot', [[1700, 555], [2240, 548], [2800, 540]]))]
pieces = split(P['body']['pts'], CUTS); pieces['body.quarter'] = pieces.pop('_')
base = P['body']; out = []
for p in d['panels']:
    if p['id'] != 'body': out.append(p); continue
    for name in ('body.hood', 'body.cowl', 'body.sill', 'body.door', 'body.quarter', 'body.tail', 'body.roof'):
        q = copy.deepcopy(base); q.update(id=name, pts=pieces[name], surface={'body.hood': 'hood', 'body.roof': 'roof'}.get(name, 'side'), element=name.split('.')[1]); q.pop('bevel', None); out.append(q)
d['panels'] = out; d['id'] = 'sedan36z'
if len(sys.argv) > 3: d['paint'] = d['paint2'] = sys.argv[3]                      # the paint as the view shows it
# shut lines are now the borders between elements; keep only the lines that lie inside one element
d['features'] = [f for i, f in enumerate(d['features']) if not (f['kind'] == 'seam' and i in (0, 2, 3, 4, 5))]
# details the answer sheet shows differently from the first hand version: a lamp pod in the body colour, slim bumpers
# with one over-rider, one light line along the belt instead of two chrome strips, pale glass
for q in d['parts']:
    if q['kind'] == 'lamp': q.update(form='pod', d=175, len=210)
    if q['kind'] == 'bumper': q.update(h=95, guard={'w': 62, 'h': 215})
d['features'] = [f for f in d['features'] if not (f['kind'] == 'trim' and f['pts'][0][1] == 1186)]
for f in d['features']:
    if f['kind'] == 'trim' and f['pts'][0][1] == 1262: f.update(kind='highlight', width=1, pts=[[600, 1268, 1]] + f['pts'])
d['glassLift'] = 1
json.dump(d, open(sys.argv[2], 'w'), indent=0); print(sys.argv[2], len(out), 'panels; moved (mean mm):', {k: round(v) for k, v in log.items()})
