"""The 1948 pickup by method Z (see sedan36_z.py). python3 tools/ref/pickup48_z.py <side view png> data/bodies/pickup48z.json"""
import sys, json
sys.path.insert(0, 'tools/ref'); from zkit import build, paint_of
d, log = build('data/bodies/pickup48.json', sys.argv[1], 'pickup48z',
    fits=[('body', 'sil', 4), ('fenderF', 'edge', 3.5), ('fenderR', 'edge', 3.5), ('bed', 'edge', 3), ('bedRail', 'edge', 3), ('stakes', 'edge', 3), ('glass', 'grad', 3)],
    cuts=[('_', 'body.roof', '_', [[1700, 1870], [1880, 1900], [2000, 1935], [2480, 1935], [2560, 1900], [2620, 1840]]),
          ('_', 'body.hood', '_', [[1540, 560], [1540, 1140], [1545, 1300], [1520, 1515], [1510, 1560]]),
          ('_', 'body.cowl', '_', [[1662, 600], [1662, 1500], [1700, 1600], [1760, 1700], [1850, 1870]]),
          ('_', 'body.door', '_', [[2537, 560], [2537, 1850]]),
          ('body.door', 'body.door', 'body.sill', [[1600, 646], [2537, 600], [2600, 598]])],
    rest='body.back', surfaces={'body.hood': 'hood', 'body.roof': 'roof'}, paint=paint_of(sys.argv[1], 4800, 'data/maps/pickup48.side.json'))
json.dump(d, open(sys.argv[2], 'w'), indent=0); print(sys.argv[2], len(d['panels']), 'panels; moved (mean mm):', {k: round(v) for k, v in log.items()})
