"""Automatic sheet -> 3D part model (reviews 61, 62). A car from the planner's sheets is made from a template car of
the same kind (a sedan from the 1929 sedan, data/cars/sedan29.json, itself made by hand from the same artist's sheet):

  1. the sheet is cut into the car's six views (trace.views) and written as v_front, v_rear, v_left, v_right, v_top,
     v_under (the names the other tools read);
  2. the template's views and the new car's views are measured by the same code: length, height, width, the wheels
     (centres and radius), and where the windscreen stands (the frontmost glass in the side view);
  3. every part of the template is moved to the new car by piecewise-linear maps between those landmarks (x: nose,
     front axle, windscreen, rear axle, tail; z: ground, wheel top, roof; y: by the width) - its outlines stay as they are
     in their box, so a hood is still a hood, only longer or shorter;
  4. each painted, black or cloth panel big enough to see is pulled onto the strong lines of the new sheet (zkit.fit_closed,
     as the hand-made car was), so the moved parts take the new car's shape;
  5. the colours are read off the sheet where the moved parts lie (paint, wing enamel, roof cloth, nickel, glass).

The scale comes from the car's wheelbase (the table below, mm). Writes the model and a short report (what moved how
far, which landmarks were found) for checking.

  python3 tools/ref/autocar.py <sheet png> <left|right> <id> <out dir> [--name ...] [--year ...] [--wheelbase mm]
"""
import sys, os, json, math, copy, argparse
import cv2, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from trace import views as cut_views, wheels as find_wheels
from zkit import View, fit_closed, MM
from shapely.geometry import Polygon, box as sbox
from shapely.affinity import scale as sscale
from shapely.ops import unary_union

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
UP = '/root/.claude/uploads/0b845933-8226-57c8-b442-07d308e42630/'
TEMPLATES = {'sedan': {'model': 'data/cars/sedan29.json', 'sheet': '358adfbc', 'side': 'right'}}
ROWS = ['front', 'rear', 'left', 'right', 'top', 'under']
SNAP_MATERIALS = {'paint', 'paint2', 'black', 'canvas', 'rubber'}


def cut(sheet_path, side, out_dir=None):
    """the six views of one car as RGBA crops (the caption and glow left out)"""
    sh = cv2.cvtColor(cv2.imread(sheet_path, cv2.IMREAD_UNCHANGED), cv2.COLOR_BGRA2RGBA); vs = cut_views(sh, side)
    if len(vs) < 6: raise SystemExit(f'{sheet_path} {side}: found {len(vs)} views')
    out = {}
    for name, (x, y, w, h) in zip(ROWS, vs[:6]): out[name] = sh[y:y + h, x:x + w].copy()
    if plan_reversed(out): out['top'] = np.ascontiguousarray(out['top'][::-1, ::-1]); out['under'] = np.ascontiguousarray(out['under'][::-1, ::-1])
    if out_dir:
        for name, crop in out.items(): cv2.imwrite(f'{out_dir}/v_{name}.png', cv2.cvtColor(crop, cv2.COLOR_RGBA2BGRA))
    return out

def plan_reversed(v):
    """some sheets draw the plan and the under view with the car's front to the right (review 70): compare where the
    wheels stand in the under view (dark tyres at its top and bottom edges) with the side view's overhangs; True when the
    under view's ends match the side view's the other way round (the plan and under view are then turned half round)"""
    side = v['left']; m = side[..., 3] > 127; ws = sorted(find_wheels(m, side[..., :3]), key=lambda t: t[0]); sw = m.shape[1]
    if len(ws) < 2: return False
    fo, ro = ws[0][0] / sw, (sw - ws[-1][0]) / sw
    u = v['under']; um = u[..., 3] > 127; h, w = um.shape
    rows = np.where(um.any(axis=1))[0]; t0, t1 = rows[0], rows[-1]; k = max(2, int((t1 - t0) * 0.05))
    band = np.r_[t0:t0 + k, t1 - k + 1:t1 + 1]; col = um[band].sum(axis=0) > len(band) * 0.6   # only the tyres reach the outer rows
    xs = np.where(col)[0]
    if len(xs) < 4: return False
    groups = np.split(xs, np.where(np.diff(xs) > w * 0.08)[0] + 1); groups = [g for g in groups if len(g) > w * 0.03]
    if len(groups) < 2: return False
    cols = np.where(um.any(axis=0))[0]; x0, x1 = cols[0], cols[-1]; L = max(1, x1 - x0)
    ol, orr = ((groups[0][0] + groups[0][-1]) / 2 - x0) / L, (x1 - (groups[-1][0] + groups[-1][-1]) / 2) / L
    return abs(ol - ro) + abs(orr - fo) < abs(ol - fo) + abs(orr - ro) - 0.02


def glass_mask(rgb, mask):
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(int); H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    return mask & (H > 70) & (H < 135) & (S < 70) & (V > 140)          # pale grey-blue panes; a blue car's paint is darker and stronger


def measure(v, wheelbase=None, length=None):
    """landmarks of a car from its views, in mm (the side view's scale: by the wheelbase, or by a known length)"""
    side = v['left']; rgb, mask = side[..., :3], side[..., 3] > 127; h, w = mask.shape
    ws = sorted(find_wheels(mask, rgb), key=lambda t: t[0])
    if len(ws) < 2: raise SystemExit('wheels not found')
    (fx, fr), (rx, rr) = ws[0], ws[-1]
    s = wheelbase / (rx - fx) if wheelbase else length / w
    # the windscreen: where the silhouette's top climbs from the bonnet to the roof (whatever the paint's colour)
    top = np.array([np.argmax(mask[:, x]) if mask[:, x].any() else h for x in range(w)], float)
    roof = np.percentile(top[int(fx):int(rx)], 5); bonnet = np.median(top[int(fx - fr * 0.5):int(fx + fr * 1.2)]); mid = (roof + bonnet) / 2
    up = np.where(top[int(fx):] < mid)[0]; xs = float(fx + up[0]) if len(up) else (fx + rx) / 2
    g = glass_mask(rgb, mask); g[int(h * 0.62):] = False; g[:, :int(xs)] = False
    g = cv2.morphologyEx(g.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)) > 0
    # the roof line and the belt (where the glass stops)
    rows = np.where(g.sum(1) >= 3)[0]; belt = float(rows[-1]) if len(rows) else h * 0.5
    fr_ = v['front']; fm = fr_[..., 3] > 127; fh, fw = fm.shape; sF = h * s / fh      # the front view drawn to the same height
    return {'s': s, 'L': w * s, 'H': h * s, 'W': fw * sF, 'FX': fx * s, 'RX': rx * s, 'R': (fr + rr) / 2 * s, 'XS': xs * s, 'BELT': (h - belt) * s,
            'px': {'side': [w, h], 'front': [fw, fh], 'wheels': [[float(fx), float(fr)], [float(rx), float(rr)]], 'xs': xs, 'belt': belt}}


def pw(pairs):
    """a piecewise-linear map through (from, to) pairs, straight on past the ends"""
    pairs = sorted(pairs); xa = [a for a, _ in pairs]; xb = [b for _, b in pairs]
    def f(x):
        if x <= xa[0]: return xb[0] + (x - xa[0]) * (xb[1] - xb[0]) / (xa[1] - xa[0])
        if x >= xa[-1]: return xb[-1] + (x - xa[-1]) * (xb[-1] - xb[-2]) / (xa[-1] - xa[-2])
        return float(np.interp(x, xa, xb))
    return f


def fit_views(vdir, L, W, H):
    def one(name, w, h):
        t = f'{vdir}/_fit_{name}.png'; src = cv2.imread(f'{vdir}/v_{name}.png', cv2.IMREAD_UNCHANGED)
        cv2.imwrite(t, cv2.resize(src, (round(w / 10), round(h / 10)), interpolation=cv2.INTER_AREA)); V = View(t, w); V.edge = np.maximum(V.sil * 3, V.grad); return V
    return {'side': one('left', L, H), 'front': one('front', W, H), 'rear': one('rear', W, H), 'top': one('top', L, W)}


def snap(FIT, C, view, pts, reach):
    """as sedan29_model.snap: a placed outline is pulled onto the nearest strong line; one symmetric about the centre
    line stays symmetric"""
    across = view != 'side'; k = 1 if view == 'top' else 0
    lo, hi = min(p[k] for p in pts), max(p[k] for p in pts); centred = across and abs(lo + hi) < 30 and lo < -20
    q = [[p[0] + (C if across and k == 0 else 0), p[1] + (C if across and k == 1 else 0)] for p in pts]
    f, moved = fit_closed(FIT[view], [[x, z, 1] for x, z in q], FIT[view].edge, reach=reach, floor=25)
    f = [[x - (C if across and k == 0 else 0), z - (C if across and k == 1 else 0)] for x, z, _ in f]
    if centred:
        g = Polygon(f).buffer(0); big = 1e5; hh = g.intersection(sbox(0, -big, big, big) if k == 0 else sbox(-big, 0, big, big))
        m = sscale(hh, xfact=-1 if k == 0 else 1, yfact=-1 if k == 1 else 1, origin=(0, 0)); u = unary_union([hh, m]).buffer(0)
        if u.geom_type == 'Polygon': f = [[round(x), round(z)] for x, z in list(u.exterior.coords)[:-1]]
    return f, moved


AX = {'side': ('x', 'z'), 'front': ('y', 'z'), 'rear': ('y', 'z'), 'top': ('x', 'y')}


def denorm(part, view, sb):
    return [[sb[0] + u * (sb[1] - sb[0]), sb[2] + v * (sb[3] - sb[2])] for u, v, *_ in part['outlines'][view]]


def convert(sheet, side, cid, out_dir, name, year, wheelbase, kind='sedan'):
    os.makedirs(out_dir, exist_ok=True); T = TEMPLATES[kind]
    tm = json.load(open(os.path.join(ROOT, T['model'])))
    tv = cut(UP + T['sheet'] + '-image.png', T['side']); A = measure(tv, length=tm['length'])
    nv = cut(sheet, side, out_dir); B = measure(nv, wheelbase=wheelbase)
    # the template's own landmarks are its model's where the model says (axles), the sheet's where it does not
    # what the measuring gets wrong on the template (whose true figures the model holds), it gets wrong the same way on
    # the new car: correct the new car's wheel radius and width by the template's error
    B['R'] *= tm['wheels'][0]['r'] / A['R']; B['W'] *= tm['width'] / A['W']
    A['FX'], A['RX'], A['R'] = tm['wheels'][0]['x'], tm['wheels'][1]['x'], tm['wheels'][0]['r']
    A['L'], A['H'], A['W'] = tm['length'], tm['height'], tm['width']
    fx = pw([(0, 0), (A['FX'], B['FX']), (A['XS'], B['XS']), (A['RX'], B['RX']), (A['L'], B['L'])])
    fz = pw([(0, 0), (2 * A['R'], 2 * B['R']), (A['BELT'], B['BELT']), (A['H'], B['H'])])
    ky = B['W'] / A['W']; fy = lambda y: y * ky
    m = copy.deepcopy(tm); m['id'] = cid; m['name'] = name; m['year'] = year
    m['length'], m['width'], m['height'] = round(B['L']), round(B['W']), round(B['H'])
    m['wheels'] = [{'x': round(B['FX']), 'r': round(B['R']), 'y': round(fy(tm['wheels'][0]['y']))}, {'x': round(B['RX']), 'r': round(B['R']), 'y': round(fy(tm['wheels'][1]['y']))}]
    MAP = {'x': fx, 'y': fy, 'z': fz}
    def mp(ax, r):
        a, b = MAP[ax](r[0]), MAP[ax](r[1])
        return [round(min(a, b)), round(max(a, b))] if ax != 'y' or r[0] >= 0 else [round(a), round(b)]
    for p in m['parts']:
        for ax in 'xyz': p['box'][ax] = mp(ax, p['box'][ax])
        for v, sb in (p.get('sheet') or {}).items():
            a, b = AX[v]; p['sheet'][v] = mp(a, sb[0:2]) + mp(b, sb[2:4])
        p.pop('shade', None); p.pop('color', None)                       # read again from the new sheet
        if 'cutWheel' in p: p['cutWheel']['r'] = round(p['cutWheel']['r'] * B['R'] / A['R'])
        if 'wheel' in p: p['wheel']['r'] = round(p['wheel']['r'] * B['R'] / A['R'])
    # pull the panels onto the new sheet's lines
    FIT = fit_views(out_dir, m['length'], m['width'], m['height']); C = m['width'] / 2; report = []
    for p in m['parts']:
        if p['material'] not in SNAP_MATERIALS or p.get('layer') == 'chassis': continue
        for v in list(p['outlines']):
            sb = (p.get('sheet') or {}).get(v)
            if not sb or (sb[1] - sb[0]) < 120 or (sb[3] - sb[2]) < 60: continue
            pts = denorm(p, v, sb)
            try: f, moved = snap(FIT, C, v, pts, 3.0)
            except Exception as e: report.append(f'{p["id"]}.{v}: not fitted ({e})'); continue
            if len(f) < 3: continue
            xs, ys = [q[0] for q in f], [q[1] for q in f]; nb = [min(xs), max(xs), min(ys), max(ys)]
            nu = lambda q: [round((q[0] - nb[0]) / max(1, nb[1] - nb[0]), 4), round((q[1] - nb[2]) / max(1, nb[3] - nb[2]), 4)]
            sharp = 1 if all(len(o) < 3 or o[2] for o in p['outlines'][v]) else 0
            p['outlines'][v] = [nu(q) + [sharp] for q in f]; p['sheet'][v] = [round(t) for t in nb]; report.append(f'{p["id"]}.{v}: moved {moved:.0f} mm')
        # the common box again from the views that show each axis
        got = {}
        for v, sb in p.get('sheet', {}).items():
            a, b = AX[v]; got.setdefault(a, []).append(sb[0:2]); got.setdefault(b, []).append(sb[2:4])
        for ax, g in got.items():
            if ax == 'y': continue
            p['box'][ax] = [round(sum(t[0] for t in g) / len(g)), round(sum(t[1] for t in g) / len(g))]
    # the colours, where the moved parts lie in the side view
    side = nv['left']; rgb = side[..., :3]; a = side[..., 3] > 127; sh, sw = a.shape; s = B['s']
    def colour_of(pid, dark_ok=True):
        p = next((q for q in m['parts'] if q['id'] == pid), None)
        if not p or 'side' not in p['outlines'] or 'side' not in p.get('sheet', {}): return None
        pts = np.array([[x / s, sh - z / s] for x, z in denorm(p, 'side', p['sheet']['side'])], np.int32)
        mk = np.zeros((sh, sw), np.uint8); cv2.fillPoly(mk, [pts], 1); mk = cv2.erode(mk, np.ones((3, 3), np.uint8)) > 0; mk &= a
        px = rgb[mk].reshape(-1, 3)
        if len(px) < 10: return None
        if not dark_ok: lum = px.mean(1); px = px[(lum > np.percentile(lum, 45)) & (lum < np.percentile(lum, 92))]   # the lit face, not the outlines or the highlights
        return '#%02x%02x%02x' % tuple(int(c) for c in np.median(px, 0))
    for key, pid, dk in (('paint2', 'fenderF', False), ('canvas', 'roof', True), ('chrome', 'lamp', False), ('glassTint', 'glass0', False)):
        c = colour_of(pid, dk)
        if c: m[key] = c
    # the body colour: the commonest colour that is neither near black nor metal (trace.classify)
    from trace import classify
    _, _, bc = classify(rgb, a); cands = ['#%02x%02x%02x' % bc] + [c for c in [colour_of('body', False), colour_of('hood', False)] if c]
    sat = lambda c: int(cv2.cvtColor(np.uint8([[[int(c[i:i + 2], 16) for i in (1, 3, 5)]]]), cv2.COLOR_RGB2HSV)[0, 0, 1])
    m['paint'] = max(cands, key=sat) if sat(cands[0]) < 45 else cands[0]       # a dark green or maroon the clusters took for grey
    # the wheels: spokes counted round a circle inside the rim (many thin = wire, ten or twelve wide = artillery, none = disc),
    # their colour against the paint's (painted spokes, or varnished wood)
    m['wheel'] = dict(m['wheel']); grey = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    (wx, wr) = B['px']['wheels'][0]; cy = sh - 1 - wr; prof = []; cols = []
    for t in np.linspace(0, 2 * math.pi, 360, endpoint=False):
        for k in (0.45, 0.55):
            x, y = int(round(wx + math.cos(t) * wr * k)), int(round(cy + math.sin(t) * wr * k))
            if 0 <= x < sw and 0 <= y < sh: prof.append(grey[y, x]); cols.append(rgb[y, x])
    prof = np.array(prof[::2], np.float32); spec = np.abs(np.fft.rfft(prof - prof.mean())); band = spec[4:61]; kk = int(np.argmax(band)) + 4
    strength = band.max() / (spec[1:].sum() + 1e-6)
    if prof.std() < 8: m['wheel'].update({'style': 'disc', 'spokes': 0})
    elif kk >= 24 or strength < 0.045: m['wheel'].update({'style': 'wire', 'spokes': 36})   # wire spokes are too fine to count at the sheet's size: a weak beat
    else:
        cl = np.array(cols, np.float32); lit = cl[cl.mean(1) > np.percentile(cl.mean(1), 50)]; sc = np.median(lit, 0)
        pc = np.array([int(m['paint'][i:i + 2], 16) for i in (1, 3, 5)], np.float32)
        hs = cv2.cvtColor(np.uint8([[sc, pc]]), cv2.COLOR_RGB2HSV)[0].astype(int); dh = min(abs(hs[0, 0] - hs[1, 0]), 180 - abs(hs[0, 0] - hs[1, 0]))
        mat = 'paint' if dh < 14 and hs[0, 1] > 40 else 'wood'
        m['wheel'].update({'style': 'artillery', 'spokes': int(min(14, max(8, kk))), 'rimMaterial': mat})
    m['wheel']['_detected'] = {'k': kk, 'strength': round(float(strength), 3), 'std': round(float(prof.std()), 1)}
    json.dump(m, open(f'{out_dir}/{cid}.json', 'w'))
    rep = {'id': cid, 'landmarks_mm': {k: round(v) for k, v in B.items() if k not in ('px', 's')}, 'template_mm': {k: round(v) for k, v in A.items() if k not in ('px', 's')},
           'mm_per_px': round(B['s'], 2), 'colours': {k: m[k] for k in ('paint', 'paint2', 'canvas', 'chrome', 'glassTint') if k in m}, 'fits': report}
    json.dump(rep, open(f'{out_dir}/{cid}.report.json', 'w'), indent=1)
    return m, rep


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('sheet'); ap.add_argument('side'); ap.add_argument('id'); ap.add_argument('out')
    ap.add_argument('--name', default=''); ap.add_argument('--year', type=int, default=1929); ap.add_argument('--wheelbase', type=float, required=True); ap.add_argument('--kind', default='sedan')
    a = ap.parse_args(); _, r = convert(a.sheet, a.side, a.id, a.out, a.name, a.year, a.wheelbase, a.kind)
    print(json.dumps({k: r[k] for k in ('landmarks_mm', 'template_mm', 'mm_per_px', 'colours')}, indent=1)); print(len(r['fits']), 'fits')
