"""Reference sheet -> a car design the game can draw (review 15, 2-3). A helper, not the last word:
it splits a sheet into views, scales the side view by the car's real length, finds the wheels, and traces
the coloured areas between the drawn outlines into panels. A person then names parts and tidies the result.

  python3 tools/ref/trace.py <sheet.png> <left|right> <length mm> <id> <year> <out dir> [--band N]

Sheets and real names stay outside the repository; only the traced design goes in.
"""
import sys, json, math
import numpy as np, cv2

MM_PER_PX = 12.5

def views(sheet, side):
    """the six views of one car: boxes of opaque pixels in the left or right half, top to bottom"""
    a = sheet[..., 3]; H, W = a.shape; x0, x1 = (0, W // 2) if side == 'left' else (W // 2, W)
    solid = (a[:, x0:x1] > 200).astype(np.uint8)                       # the glow around some sheets is half transparent
    solid = cv2.morphologyEx(solid, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(solid, 8)
    boxes = [(st[i, 0] + x0, st[i, 1], st[i, 2], st[i, 3]) for i in range(1, n) if st[i, 4] > 4000 and st[i, 2] > 80]
    boxes = [b for b in boxes if b[1] + b[3] < H - 20 or b[3] > 90]    # not the caption
    return sorted(boxes, key=lambda b: (b[1] // 40, b[0]))

def wheels(mask, rgb):
    """tyres: the round things the car stands on -> [(cx, r)] in px, front first"""
    h, w = mask.shape; dark = ((rgb.max(axis=2) < 70) & mask).astype(np.uint8)
    foot = dark[h - 10:h - 2].sum(axis=0) > 3; xs = np.where(foot)[0]; out = []
    if not len(xs): return out
    grey = cv2.GaussianBlur(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY), (5, 5), 1.2); grey[~mask] = 128
    for r in np.split(xs, np.where(np.diff(xs) > 12)[0] + 1):
        if len(r) < 8: continue
        cx = (r[0] + r[-1]) / 2; best = None
        # a tyre standing on the ground has its centre one radius up: take the radius whose circle follows the most edge
        edges = cv2.Canny(grey, 40, 110)
        for rad in np.arange(w * 0.045, w * 0.105, 0.5):
            cy = h - 1 - rad; ang = np.linspace(math.pi * 0.15, math.pi * 0.85, 40)          # the lower arc, clear of the fender
            px = np.clip((cx + rad * np.cos(ang)).astype(int), 0, w - 1); py = np.clip((cy + rad * np.sin(ang)).astype(int), 0, h - 1)
            ang2 = np.linspace(0, 2 * math.pi, 60); qx = np.clip((cx + rad * 0.97 * np.cos(ang2)).astype(int), 0, w - 1); qy = np.clip((cy + rad * 0.97 * np.sin(ang2)).astype(int), 0, h - 1)
            score = mask[py, px].mean() + dark[qy, qx].mean() * 1.5 - mask[np.clip(py + 2, 0, h - 1), px].mean()
            if best is None or score > best[0]: best = (score, rad)
        out.append((cx, best[1]))
    return out

def classify(rgb, mask):
    """each pixel -> a material of the game, by colour"""
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(int); Hh, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    px = rgb[mask].reshape(-1, 3).astype(np.float32)
    k = 7; _, lab, cen = cv2.kmeans(px, k, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5), 3, cv2.KMEANS_PP_CENTERS)
    counts = np.bincount(lab.ravel(), minlength=k); chsv = cv2.cvtColor(cen.reshape(1, -1, 3).astype(np.uint8), cv2.COLOR_RGB2HSV)[0].astype(int)
    # the body colour: the most common cluster that is neither near-black nor grey-white metal
    cand = [i for i in range(k) if chsv[i, 2] > 45 and not (chsv[i, 1] < 28 and chsv[i, 2] > 150)]
    body = max(cand or range(k), key=lambda i: counts[i]); bc = cen[body]
    d = np.linalg.norm(rgb.astype(np.float32) - bc, axis=2)
    out = np.zeros(mask.shape, np.uint8)                                # 0 nothing
    M = {'paint': 1, 'black': 2, 'chrome': 3, 'glass': 4, 'lensR': 5, 'lens': 6, 'wood': 7, 'white': 8, 'line': 9}
    bh = int(chsv[body, 0]); hue = np.minimum(abs(Hh - bh), 180 - abs(Hh - bh))
    paint = mask & (hue < 16) & (S > 35) & (V > 18) if chsv[body, 1] > 40 else mask & (d < 55)
    out[mask] = M['black']
    out[mask & (S < 45) & (V > 120)] = M['chrome']
    out[mask & (S < 70) & (V > 205)] = M['white']
    out[mask & (Hh > 85) & (Hh < 125) & (S > 15) & (S < 110) & (V > 90) & ~paint] = M['glass']
    out[mask & ((Hh < 6) | (Hh > 172)) & (S > 150) & (V > 110) & ~paint] = M['lensR']
    out[mask & (Hh > 18) & (Hh < 32) & (S > 90) & (V > 170) & ~paint] = M['lens']
    out[mask & (Hh > 8) & (Hh < 24) & (S > 70) & (V > 70) & (V < 200) & ~paint] = M['wood']
    # drawn outlines: thin strokes darker than what lies on both sides of them (a dark car has dark paint, so darkness alone will not do)
    grey = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY); hat = cv2.morphologyEx(grey, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    line = mask & ((hat > max(14, int(chsv[body, 2]) * 0.16)) | (V < 16)); out[paint & ~line] = M['paint']; out[paint & line] = M['line']; out[mask & (V < 16) & ~paint] = M['line']
    return out, M, tuple(int(c) for c in bc)

def trace(sheet_path, side, length, cid, year, out_dir, band=None):
    sheet = cv2.cvtColor(cv2.imread(sheet_path, cv2.IMREAD_UNCHANGED), cv2.COLOR_BGRA2RGBA); vs = views(sheet, side)
    wide = [b for b in vs if b[2] > 1.7 * b[3]]                          # side, side, top, underside
    if len(wide) < 2: raise SystemExit(f'found {len(vs)} views, {len(wide)} wide ones')
    x, y, w, h = wide[band if band is not None else 0]; crop = sheet[y:y + h, x:x + w]; mask = crop[..., 3] > 200; rgb = np.ascontiguousarray(crop[..., :3])
    ws = wheels(mask, rgb)
    if len(ws) >= 2 and ws[0][0] > w - ws[-1][0] + 1e9: pass
    scale = length / w                                                   # mm per source pixel
    X = lambda px: round(px * scale); Z = lambda py: round((h - py) * scale)
    cls, M, body = classify(rgb, mask); inv = {v: k for k, v in M.items()}
    panels = []; order = {'black': 4, 'wood': 9, 'paint': 10, 'glass': 12, 'chrome': 25, 'white': 26, 'lens': 28, 'lensR': 28}
    # what lies under everything: the whole outline, so the gaps between panels read as shut lines
    sil = mask.astype(np.uint8)
    for (cx, r) in ws: cv2.circle(sil, (int(round(cx)), int(h - r)), int(r + 1), 0, -1)
    def polys(binimg, min_area, eps):
        cs, hier = cv2.findContours(binimg, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE); res = []
        for i, c in enumerate(cs):
            if hier[0][i][3] != -1 or cv2.contourArea(c) < min_area: continue
            p = cv2.approxPolyDP(c, eps, True).reshape(-1, 2)
            if len(p) >= 3: res.append((cv2.contourArea(c), p, c))
        return res
    for _, p, _c in polys(sil, 200, 0.7): panels.append({'id': f'under{len(panels)}', 'pts': [[X(a), Z(b), 1] for a, b in p], 'material': 'shadow', 'surface': 'flat', 'z': 3})
    n_by = {}
    for name in ['black', 'wood', 'paint', 'glass', 'chrome', 'white', 'lens', 'lensR']:
        binimg = (cls == M[name]).astype(np.uint8)
        if name == 'paint': binimg = cv2.erode(binimg, np.ones((2, 2), np.uint8))                      # so a one-pixel stroke parts two panels
        if name == 'glass': binimg = cv2.morphologyEx(binimg, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
        for area, p, c in sorted(polys(binimg, 14 if name in ('chrome', 'white', 'lens', 'lensR') else 40, 0.6), key=lambda t: -t[0]):
            xs, ys = p[:, 0], p[:, 1]; cxm, top, bot = xs.mean(), ys.min(), ys.max(); surf = 'side'; bevel = None
            if name == 'paint':
                near = [1 for (wx, r) in ws if abs(cxm - wx) < r * 1.6 and bot > h - r * 2.4 and (xs.max() - xs.min()) < r * 5]
                if near: surf = 'fender'
                elif bot < h * 0.42 and (xs.max() - xs.min()) > 3 * (bot - top): surf = 'roof'
                bevel = max(1.5, min(7, math.sqrt(area) * scale / MM_PER_PX / 9))
            elif name in ('black', 'wood', 'white'): surf = 'flat'
            elif name in ('lens', 'lensR'): surf = 'flat'
            elif name == 'chrome': bevel = 1.5
            n_by[name] = n_by.get(name, 0) + 1
            q = {'id': f'{name}{n_by[name]}', 'pts': [[X(a), Z(b), 1] for a, b in p], 'material': 'paint' if name == 'paint' else name, 'surface': surf, 'z': order[name] + (0.5 if surf == 'fender' else 0)}
            if bevel: q['bevel'] = round(bevel, 1)
            panels.append(q)
    front = min(ws, key=lambda t: t[0]) if ws else None
    design = {'id': cid, 'name': cid, 'year': year, 'length': length, 'height': Z(0), 'paint': '#%02x%02x%02x' % body, 'paint2': '#1c1b1f', 'panels': panels, 'features': [],
              'wheels': [{'x': X(cx), 'r': round(r * scale), 'rim': 0.62, 'style': 'disc', 'spokes': 0, 'rimMaterial': 'paint', 'zOrder': 5} for cx, r in ws], 'frame': 'chrome'}
    json.dump(design, open(f'{out_dir}/{cid}.json', 'w'))
    cv2.imwrite(f'{out_dir}/{cid}_source.png', cv2.cvtColor(crop, cv2.COLOR_RGBA2BGRA))
    pal = {1: body, 2: (25, 25, 28), 3: (200, 205, 210), 4: (120, 150, 170), 5: (200, 30, 30), 6: (240, 220, 120), 7: (160, 100, 50), 8: (245, 245, 240), 9: (0, 0, 0)}
    seg = np.zeros((h, w, 3), np.uint8) + 90
    for kk, col in pal.items(): seg[cls == kk] = col
    cv2.imwrite(f'{out_dir}/{cid}_materials.png', cv2.cvtColor(seg, cv2.COLOR_RGB2BGR))
    wb = round((ws[-1][0] - ws[0][0]) * scale) if len(ws) >= 2 else None
    print(json.dumps({'id': cid, 'view_px': [int(w), int(h)], 'mm_per_source_px': round(scale, 2), 'wheels': [(X(cx), round(r * scale)) for cx, r in ws], 'wheelbase_mm': wb, 'height_mm': Z(0), 'panels': len(panels), 'by_material': n_by, 'points': sum(len(p['pts']) for p in panels)}))

if __name__ == '__main__':
    a = sys.argv[1:]; band = int(a[a.index('--band') + 1]) if '--band' in a else None
    trace(a[0], a[1], int(a[2]), a[3], int(a[4]), a[5], band)
