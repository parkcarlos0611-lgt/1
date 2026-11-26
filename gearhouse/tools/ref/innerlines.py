"""Improvement F (review 28/29): the lines the sheet draws inside a part (shut lines, mouldings, the edges of pressed
panels), found on the enlarged sheet and kept with the part as features of that view: a dark line becomes a seam, a
bright one a highlight. Only long, straight-ish lines are kept (shorter ones are texture, not structure).
  python3 tools/ref/innerlines.py <model json> <modelviews out dir> <views dir> [min length mm = 160]"""
import sys, json, math, cv2, numpy as np
M = json.load(open(sys.argv[1])); D, VD = sys.argv[2:4]; MIN = float(sys.argv[4]) if len(sys.argv) > 4 else 160
C = M['width'] / 2; K = 4; KINDS = {'paint', 'paint2'}
VIEWS = {'side': 'left', 'front': 'front', 'rear': 'rear', 'top': 'top'}; total = 0
def canvas_box(key, sb):
    a0, a1, b0, b1 = sb
    return [a0, a1, b0, b1] if key == 'side' else [C + a0, C + a1, b0, b1] if key == 'front' else [C - a1, C - a0, b0, b1] if key == 'rear' else [a0, a1, C + b0, C + b1]
for key, view in VIEWS.items():
    d = json.load(open(f"{D}/{M['id']}_{view}.json")); L, H = d['length'], d['height']
    src = cv2.imread(f'{VD}/v_{view}.png', cv2.IMREAD_UNCHANGED); big = cv2.resize(src, (round(L / 10) * K, round(H / 10) * K), interpolation=cv2.INTER_CUBIC)
    g = cv2.cvtColor(big[..., :3], cv2.COLOR_BGR2GRAY); hh, ww = g.shape; px = lambda x, z: (x / 10 * K, hh - z / 10 * K)
    se = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)); dark = cv2.morphologyEx(g, cv2.MORPH_BLACKHAT, se); bright = cv2.morphologyEx(g, cv2.MORPH_TOPHAT, se)
    for p in M['parts']:
        if p['material'] not in KINDS or key not in (p.get('sheet') or {}): continue
        pan = next((q for q in d['panels'] if q['id'] == p['id']), None)
        if not pan: continue
        m = np.zeros((hh, ww), np.uint8); cv2.fillPoly(m, [np.array([px(x, z) for x, z, *_ in pan['pts']], np.int32)], 1); m = cv2.erode(m, np.ones((9, 9), np.uint8))
        cb = canvas_box(key, p['sheet'][key]); feats = []
        for kind, img, thr in (('seam', dark, 22), ('highlight', bright, 30)) if key == 'side' else (('seam', dark, 26),):   # bright lines only where the light falls along the side
            b = ((img > thr) & (m > 0)).astype(np.uint8) * 255
            segs = cv2.HoughLinesP(b, 1, np.pi / 180, 30, minLineLength=MIN / 10 * K, maxLineGap=6) if b.any() else None
            if segs is None: continue
            kept = []
            for x0, y0, x1, y1 in segs.reshape(-1, 4):
                ang = math.degrees(math.atan2(y1 - y0, x1 - x0)) % 180
                if min(ang, abs(ang - 90), 180 - ang) > 12: continue                   # mouldings and shut lines run along or across
                mid = ((x0 + x1) / 2, (y0 + y1) / 2)
                if any(math.hypot(mid[0] - (a[0] + a[2]) / 2, mid[1] - (a[1] + a[3]) / 2) < 3 * K and abs(math.atan2(y1 - y0, x1 - x0) - math.atan2(a[3] - a[1], a[2] - a[0])) < 0.2 for a in kept): continue
                kept.append((x0, y0, x1, y1))
            for x0, y0, x1, y1 in kept[:8]:
                pts = []
                for x, y in ((x0, y0), (x1, y1)):
                    X, Z = x * 10 / K, (hh - y) * 10 / K; pts.append([round((X - cb[0]) / max(1, cb[1] - cb[0]), 4), round((Z - cb[2]) / max(1, cb[3] - cb[2]), 4)])
                feats.append({'kind': kind, 'pts': pts, **({'width': 1} if kind == 'highlight' else {}), 'auto': True})
        if key == 'rear':
            for f in feats:                                                        # the rear view is drawn mirrored (across the car from the right)
                f['pts'] = [[1 - u, v] for u, v in f['pts']]
        if key == 'top':
            for f in feats: f['pts'] = [[u, v] for u, v in f['pts']]
        old = [f for f in (p.get('features') or {}).get(key, []) if not f.get('auto')]
        p.setdefault('features', {})[key] = old + feats; total += len(feats)
json.dump(M, open(sys.argv[1], 'w'), indent=0); print(total, 'lines taken from the sheet')
