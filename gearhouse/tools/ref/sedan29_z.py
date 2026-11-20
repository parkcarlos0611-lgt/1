"""Method Z for the 1929 sedan (tools/ref/sedan29.py): the main parts of each view fitted to the lines its reference
view really has; then tools/ref/shade.py reads how light falls on each painted part.
  python3 tools/ref/sedan29_z.py <hand dir> <views dir (v_left.png, v_front.png, v_rear.png, v_top.png)> <out dir>"""
import sys, os, json, cv2, numpy as np; sys.path.insert(0, os.path.dirname(__file__))
from zkit import View, fit_closed
hand, views, out = sys.argv[1:4]
FITS = {'sedan29': ('left', ['body', 'hood', 'cowl', 'roof', 'fenderF', 'fenderR', 'shell', 'spare', 'glass0', 'glass1', 'glass2']),
        'sedan29_front': ('front', ['cabin', 'hood', 'fender-1', 'fender1', 'shell', 'roof']), 'sedan29_rear': ('rear', ['body', 'fender-1', 'fender1', 'window']),
        'sedan29_top': ('top', ['roof', 'hood', 'fenderFL', 'fenderFR'])}
for cid, (view, ids) in FITS.items():
    d = json.load(open(f'{hand}/{cid}.json')); src = cv2.imread(f'{views}/v_{view}.png', cv2.IMREAD_UNCHANGED)
    tmp = f'{out}/{cid}.view.png'; cv2.imwrite(tmp, cv2.resize(src, (round(d['length'] / 10), round(d['height'] / 10)), interpolation=cv2.INTER_AREA))
    V = View(tmp, d['length']); edge = np.maximum(V.sil * 3, V.grad); moved = {}
    for p in d['panels']:
        if p['id'] in ids: p['pts'], moved[p['id']] = fit_closed(V, p['pts'], edge, reach=3, floor=25)
    json.dump(d, open(f'{out}/{cid}.json', 'w'), indent=0); print(cid, 'moved (mean mm):', {k: round(v) for k, v in moved.items()})
