"""Method Z2: an element's surface detail as shapes. Takes a skin on the game's ramps (tools/ref/skin.py --common
--fill --clean) and turns each element's cells into regions, one per material and tone step, traced along the cell
edges and simplified; regions smaller than `min` cells are left to the colour around them. Nothing of the picture is
kept as cells: what is stored is outlines in millimetres, drawn afresh at any scale and stretched with the element.

  python3 tools/ref/decals.py <skin json> <out decals json> [tolerance px = 0.55] [min cells = 2]"""
import sys, json, cv2, numpy as np
S = json.load(open(sys.argv[1])); TOL = float(sys.argv[3]) if len(sys.argv) > 3 else 0.55; MIN = float(sys.argv[4]) if len(sys.argv) > 4 else 2
assert S.get('common'), 'decals are traced from a skin on the game ramps (skin.py --common)'
MM = S['mm']; mats = S['materials']; out = {}; nreg = npts = 0; UP = 4
for name, E in S['elements'].items():
    a = np.array(E['d']).reshape(-1, 2); g = np.repeat(a[:, 0], a[:, 1]).reshape(E['h'], E['w'])
    if (g >= 0).sum() < 4: continue
    vals, cnt = np.unique(g[g >= 0], return_counts=True); base = int(vals[cnt.argmax()]); regions = []
    def trace(mask):
        up = cv2.resize(mask.astype(np.uint8), None, fx=UP, fy=UP, interpolation=cv2.INTER_NEAREST); up = np.pad(up, 1)
        cs, hier = cv2.findContours(up, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE); rings = []
        for c in cs:
            c = cv2.approxPolyDP(c, TOL * UP, True).reshape(-1, 2).astype(np.float32)
            if len(c) < 3: continue
            pts = (c - 1 + 0.5) / UP                                             # cell edges, in cells of the element's grid
            rings.append([int(round(v)) for x, y in pts for v in (E['x0'] + x * MM, E['z1'] - y * MM)])
        return rings
    # the commonest value covers the whole element first, so small gaps left by simplifying show that, not the rules
    regions.append({'m': mats[base >> 4], 'l': base & 15, 'rings': trace(cv2.dilate((g >= 0).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)})   # one cell wider: the element's own edge is never left bare
    order = sorted([int(v) for v in vals if v != base], key=lambda v: -(g == v).sum())
    for v in order:
        n, lab, st, _ = cv2.connectedComponentsWithStats((g == v).astype(np.uint8), connectivity=4); keep = np.zeros_like(g, bool)
        for k in range(1, n):
            if st[k, cv2.CC_STAT_AREA] >= MIN: keep |= lab == k
        if not keep.any(): continue
        rings = trace(keep)
        if rings: regions.append({'m': mats[v >> 4], 'l': v & 15, 'rings': rings})
    out[name] = {'b': E['b'], 'r': regions, **({'sig': E['sig']} if 'sig' in E else {})}; nreg += len(regions); npts += sum(len(r) // 2 for R in regions for r in R['rings'])
json.dump(out, open(sys.argv[2], 'w'), separators=(',', ':'))
print(sys.argv[2], len(out), 'elements,', nreg, 'regions,', npts, 'points')
