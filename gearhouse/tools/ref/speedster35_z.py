"""The 1935 speedster by method Z (see sedan36_z.py). python3 tools/ref/speedster35_z.py <side view png> data/bodies/speedster35z.json"""
import sys, json
sys.path.insert(0, 'tools/ref'); from zkit import build, paint_of
d, log = build('data/bodies/speedster35.json', sys.argv[1], 'speedster35z',
    fits=[('body', 'sil', 4), ('fenderF', 'edge', 3.5), ('fenderR', 'edge', 3.5), ('cockpit', 'grad', 3)],
    cuts=[('_', 'body.hood', '_', [[2140, 450], [2100, 900], [2080, 1322]]),
          ('_', 'body.door', '_', [[2205, 1300], [2200, 1090], [2180, 620], [2240, 520], [2400, 505], [2960, 505], [3010, 560], [3020, 1090], [3050, 1300]])],
    rest='body.tail', surfaces={'body.hood': 'hood'}, paint=paint_of(sys.argv[1], 4940, 'data/maps/speedster35.side.json'))
json.dump(d, open(sys.argv[2], 'w'), indent=0); print(sys.argv[2], len(d['panels']), 'panels; moved (mean mm):', {k: round(v) for k, v in log.items()})
