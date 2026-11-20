"""Step 3 of review 29: every part looked at on its own. For each part and each view it is drawn in, the sheet is
cut round the part's sheet box (with a margin), enlarged 8 times, and the part's outline as the model draws it is
laid over it. Next to it, what is measured in that piece of the sheet: its colours (the three commonest, with their
share), the repeat of any regular pattern across and up (louvres, spokes, cells, ribs) and how much of the outline
lies on a line of the drawing. A part that is wrong is seen in its own tile, at a size where a few millimetres show.
  python3 tools/ref/tiles.py <model json> <modelviews out dir> <views dir> <out png> [part ids, comma separated]
Also writes <out>.json with the measurements, for the build to use."""
import sys, json, cv2, numpy as np
M = json.load(open(sys.argv[1])); D, VD, OUT = sys.argv[2:5]; only = set(sys.argv[5].split(',')) if len(sys.argv) > 5 else None
C = M['width'] / 2; K = 8; BG = (205, 205, 205); VIEWS = {'side': 'left', 'front': 'front', 'rear': 'rear', 'top': 'top'}
def canvas_box(key, sb):
    a0, a1, b0, b1 = sb
    return [a0, a1, b0, b1] if key == 'side' else [C + a0, C + a1, b0, b1] if key == 'front' else [C - a1, C - a0, b0, b1] if key == 'rear' else [a0, a1, C + b0, C + b1]
def repeat(profile):
    p = profile - profile.mean()
    if len(p) < 12 or not p.any(): return None
    ac = np.correlate(p, p, 'full')[len(p) - 1:]; ac = ac / (ac[0] + 1e-9); k = int(np.argmax(ac[3:len(p) // 2])) + 3 if len(p) // 2 > 3 else None
    return (k, float(ac[k])) if k and ac[k] > 0.35 else None
tiles, meas = [], {}
sheets = {k: cv2.imread(f'{VD}/v_{v}.png', cv2.IMREAD_UNCHANGED) for k, v in VIEWS.items()}
for p in M['parts']:
    if only and p['id'] not in only: continue
    for key, sb in (p.get('sheet') or {}).items():
        d = json.load(open(f"{D}/{M['id']}_{VIEWS[key]}.json")); L, H = d['length'], d['height']; src = sheets[key]
        sx, sz = src.shape[1] / L, src.shape[0] / H; cb = canvas_box(key, sb); m = 60
        x0, x1 = max(0, int((cb[0] - m) * sx)), min(src.shape[1], int((cb[1] + m) * sx) + 1); y0, y1 = max(0, int(src.shape[0] - (cb[3] + m) * sz)), min(src.shape[0], int(src.shape[0] - (cb[2] - m) * sz) + 1)
        if x1 - x0 < 2 or y1 - y0 < 2: continue
        crop = src[y0:y1, x0:x1]; big = cv2.resize(crop, None, fx=K, fy=K, interpolation=cv2.INTER_CUBIC); v = big[..., :3].copy(); v[big[..., 3] < 128] = BG
        # the part's own outline (first panel of the part in that view's design, the near one of a pair)
        pan = next((q for q in d['panels'] if q['id'] == p['id']), None)
        inner = np.zeros(big.shape[:2], np.uint8)
        if pan:
            pts = np.array([[(x * sx - x0) * K, (src.shape[0] - z * sz - y0) * K] for x, z, *_ in pan['pts']], np.int32); cv2.fillPoly(inner, [pts], 1)
        g = cv2.cvtColor(big[..., :3], cv2.COLOR_BGR2GRAY); lines = cv2.Canny(cv2.GaussianBlur(g, (0, 0), 2.0), 18, 50) > 0
        near = cv2.distanceTransform((~lines).astype(np.uint8), cv2.DIST_L2, 3); edge = cv2.morphologyEx(inner, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)) > 0
        on = float((near[edge] <= K * 0.75).mean()) if edge.any() else None
        if pan: cv2.polylines(v, [pts], True, (0, 0, 255), 1, cv2.LINE_AA)
        sel = (inner > 0) & (big[..., 3] > 127) if inner.any() else big[..., 3] > 127
        cols = []
        if sel.sum() > 30:
            px = big[..., :3][sel].reshape(-1, 3).astype(np.float32); k = min(3, len(px)); _, lab, cen = cv2.kmeans(px, k, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1), 2, cv2.KMEANS_PP_CENTERS)
            cnt = np.bincount(lab.ravel(), minlength=k); order = np.argsort(-cnt); cols = [('#%02x%02x%02x' % tuple(int(c) for c in cen[i][::-1]), round(float(cnt[i] / cnt.sum()), 2)) for i in order]
        gi = cv2.cvtColor(crop[..., :3], cv2.COLOR_BGR2GRAY).astype(np.float32); gx = np.abs(np.diff(gi, axis=1)).sum(0); gy = np.abs(np.diff(gi, axis=0)).sum(1)
        rx, ry = repeat(gx), repeat(gy); mm = lambda r, s_: (round(r[0] / s_), round(r[1], 2)) if r else None
        info = {'colours': cols, 'repeat across mm': mm(rx, sx), 'repeat up mm': mm(ry, sz), 'outline on a line': None if on is None else round(on, 2)}
        meas[f"{p['id']}.{key}"] = info
        lab = [f"{p['id']}  {key}", f"on line {'-' if on is None else f'{on * 100:.0f}%'}", f"repeat {info['repeat across mm']} / {info['repeat up mm']}"]
        h = max(v.shape[0], 110); w = v.shape[1] + 260; t = np.full((h + 6, w, 3), 245, np.uint8); t[:v.shape[0], :v.shape[1]] = v
        for i, s_ in enumerate(lab): cv2.putText(t, s_, (v.shape[1] + 8, 18 + i * 18), 0, 0.45, (30, 30, 30), 1, cv2.LINE_AA)
        for i, (c, f) in enumerate(cols):
            bgr = tuple(int(c[j:j + 2], 16) for j in (5, 3, 1)); cv2.rectangle(t, (v.shape[1] + 8, 66 + i * 14), (v.shape[1] + 28, 76 + i * 14), bgr, -1); cv2.putText(t, f'{c} {f:.0%}', (v.shape[1] + 34, 76 + i * 14), 0, 0.4, (30, 30, 30), 1, cv2.LINE_AA)
        tiles.append(t)
json.dump(meas, open(OUT.replace('.png', '.json'), 'w'), indent=1)
# lay the tiles out in rows of about 2000 px
rows, row, wsum = [], [], 0
for t in tiles:
    if wsum + t.shape[1] > 2000 and row: rows.append(row); row, wsum = [], 0
    row.append(t); wsum += t.shape[1] + 6
if row: rows.append(row)
outs = []
for r in rows:
    h = max(t.shape[0] for t in r); outs.append(np.hstack([np.vstack([np.hstack([t, np.full((t.shape[0], 6, 3), 255, np.uint8)]), np.full((h - t.shape[0], t.shape[1] + 6, 3), 255, np.uint8)]) for t in r]))
W = max(o.shape[1] for o in outs); sheet = np.vstack([cv2.copyMakeBorder(o, 0, 6, 0, W - o.shape[1], cv2.BORDER_CONSTANT, value=(255, 255, 255)) for o in outs])
for i in range(0, sheet.shape[0], 2400): cv2.imwrite(OUT.replace('.png', f'_{i // 2400 + 1}.png'), sheet[i:i + 2400])
print(len(tiles), 'tiles;', (sheet.shape[0] + 2399) // 2400, 'sheets')
