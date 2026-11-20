"""Step 1 of review 29: does the drawing keep the sheet's proportions? For every view and every part, the place and
size the sheet gives it (part.sheet) against where the drawn part really ends up (its picture from
tools/ref/modelviews.ts, outline included), and the part's size and place relative to the view's anchor part (the
body), which is how a person judges proportion ("the lamp is a third of the grille's height").
  python3 tools/ref/proportions.py <model json> <modelviews out dir> <views dir> <out prefix> [tolerance % = 5] [tolerance mm = 30]
Writes <out prefix>_<view>.png (sheet place green, drawn place red, over the reference view) and prints a table."""
import sys, json, cv2, numpy as np
M = json.load(open(sys.argv[1])); D, VD, OUT = sys.argv[2:5]; TP = float(sys.argv[5]) if len(sys.argv) > 5 else 5; TM = float(sys.argv[6]) if len(sys.argv) > 6 else 30
C = M['width'] / 2; PAD = 6
VIEWS = {'left': ('side', 'left'), 'front': ('front', 'front'), 'rear': ('rear', 'rear'), 'top': ('top', 'top')}
def canvas_box(key, sb):
    """the sheet box in the view's drawing coordinates (mm across the picture, mm up)"""
    a0, a1, b0, b1 = sb
    if key == 'side': return [a0, a1, b0, b1]
    if key == 'front': return [C + a0, C + a1, b0, b1]
    if key == 'rear': return [C - a1, C - a0, b0, b1]
    return [a0, a1, C + b0, C + b1]
def drawn_box(png, key, sb, pair):
    im = cv2.imread(png, cv2.IMREAD_UNCHANGED); h, w = im.shape[:2]; a = im[..., 3] > 127
    if pair and key != 'side':                                                   # the near one only (the left one of a pair)
        cb = canvas_box(key, sb)
        if key == 'top': lim = round(h - PAD - C / 10); a[lim:, :] = False
        else: lim = round(PAD + C / 10); a[:, :lim] = False if cb[0] >= C else a[:, :lim]; a[:, lim:] = a[:, lim:] if cb[0] >= C else False
    ys, xs = np.where(a)
    if not len(xs): return None
    return [(xs.min() - PAD) * 10, (xs.max() + 1 - PAD) * 10, (h - PAD - ys.max() - 1) * 10, (h - PAD - ys.min()) * 10]
rows = {}; bad = 0; total = 0
for view, (key, src) in VIEWS.items():
    d = json.load(open(f"{D}/{M['id']}_{view}.json")); L, H = d['length'], d['height']
    meas = {}
    for p in M['parts']:
        sb = (p.get('sheet') or {}).get(key)
        if not sb: continue
        db = drawn_box(f"{D}/parts/{p['id']}_{view}.png", key, sb, p['pair'])
        if db: meas[p['id']] = (canvas_box(key, sb), db)
    anc = meas.get('body')
    img = cv2.imread(f'{VD}/v_{src}.png', cv2.IMREAD_UNCHANGED); K = 4; img = cv2.resize(img, (round(L / 10) * K, round(H / 10) * K), interpolation=cv2.INTER_CUBIC)
    v = img[..., :3].copy(); v[img[..., 3] < 128] = (205, 205, 205); hh = v.shape[0]
    P = lambda x, z: (int(x / 10 * K), int(hh - z / 10 * K)); out = []
    for pid, (s, r) in meas.items():
        sw, sh, rw, rh = s[1] - s[0], s[3] - s[2], r[1] - r[0], r[3] - r[2]
        dc = ((r[0] + r[1] - s[0] - s[1]) / 2, (r[2] + r[3] - s[2] - s[3]) / 2); ratio = (rw / max(1, sw) - 1, rh / max(1, sh) - 1)
        rel = (0, 0)
        if anc and pid != 'body':
            (sa, ra) = anc; saw, sah, raw_, rah = sa[1] - sa[0], sa[3] - sa[2], ra[1] - ra[0], ra[3] - ra[2]
            rel = ((((r[0] + r[1]) / 2 - (ra[0] + ra[1]) / 2) / raw_ - ((s[0] + s[1]) / 2 - (sa[0] + sa[1]) / 2) / saw) * 100, (((r[2] + r[3]) / 2 - (ra[2] + ra[3]) / 2) / rah - ((s[2] + s[3]) / 2 - (sa[2] + sa[3]) / 2) / sah) * 100)
        small = min(sw, sh) < 120                                                   # a few pixels: size is judged in mm only
        off = max(abs(dc[0]), abs(dc[1])) > TM or (not small and max(abs(ratio[0]), abs(ratio[1])) * 100 > TP) or (small and max(abs(rw - sw), abs(rh - sh)) > TM)
        total += 1; bad += off; out.append((off, pid, dc, ratio, rel, (sw, sh), (rw, rh)))
        cv2.rectangle(v, P(s[0], s[3]), P(s[1], s[2]), (0, 190, 0), 1); cv2.rectangle(v, P(r[0], r[3]), P(r[1], r[2]), (0, 0, 255) if off else (255, 150, 0), 1)
        if off: cv2.putText(v, pid, (P(r[0], r[3])[0], P(r[0], r[3])[1] - 3), 0, 0.4, (0, 0, 255), 1, cv2.LINE_AA)
    cv2.imwrite(f'{OUT}_{view}.png', v); rows[view] = out
    print(f'== {view}: {sum(1 for o in out if not o[0])}/{len(out)} parts keep the sheet place and size (within {TM:.0f} mm and {TP:.0f} %)')
    for off, pid, dc, ratio, rel, ss, rs in sorted(out, key=lambda o: (not o[0], o[1])):
        if off: print(f'   {pid:12s} centre off {dc[0]:+5.0f} {dc[1]:+5.0f} mm   size {ratio[0] * 100:+5.1f}% {ratio[1] * 100:+5.1f}%   sheet {ss[0]:.0f}x{ss[1]:.0f} drawn {rs[0]:.0f}x{rs[1]:.0f}   place against body {rel[0]:+.1f}% {rel[1]:+.1f}%')
print(f'all views: {total - bad}/{total} parts within tolerance')
