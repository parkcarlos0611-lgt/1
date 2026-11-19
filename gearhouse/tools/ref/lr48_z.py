"""Method Z for the 1948 utility (tools/ref/lr48.py): each view's main parts fitted to the lines its reference view
really has, then how light falls on each painted part read off the view (tools/ref/shade.py, run after this).
  python3 tools/ref/lr48_z.py <hand dir> <dir with v_left.png v_front.png v_rear.png v_top.png> <out dir>"""
import sys, os, json, cv2, numpy as np; sys.path.insert(0, os.path.dirname(__file__))
from zkit import View, fit_closed
hand, views, out = sys.argv[1:4]
FITS = {'lr48': ('left', ['wingF', 'bonnet', 'door', 'doorTop', 'tub', 'tilt', 'screen']), 'lr48_front': ('front', ['bulkhead', 'tilt', 'grille', 'wing-1', 'wing1', 'bonnet', 'bumper']),
        'lr48_rear': ('rear', ['tub', 'tilt', 'windowFrame']), 'lr48_top': ('top', ['wings', 'bonnet', 'tilt', 'screenFrame'])}
for cid, (view, ids) in FITS.items():
    d = json.load(open(f'{hand}/{cid}.json')); src = cv2.imread(f'{views}/v_{view}.png', cv2.IMREAD_UNCHANGED)
    sized = cv2.resize(src, (round(d['length'] / 10), round(d['height'] / 10)), interpolation=cv2.INTER_AREA); tmp = f'{out}/{cid}.view.png'; cv2.imwrite(tmp, sized)
    V = View(tmp, d['length']); edge = np.maximum(V.sil * 3, V.grad); moved = {}
    for p in d['panels']:
        if p['id'] in ids: p['pts'], moved[p['id']] = fit_closed(V, p['pts'], edge, reach=3, floor=25)
    json.dump(d, open(f'{out}/{cid}.json', 'w'), indent=0); print(cid, 'moved (mean mm):', {k: round(v) for k, v in moved.items()})
