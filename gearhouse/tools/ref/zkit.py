"""Structure first, picture as the answer sheet (decision of 2026-11-19, method Z). A hand-written body is made
exact against its reference view and split into elements, each a whole closed shape that can be moved, swapped,
stretched and repainted; nothing of the picture is stored.

  fit_closed / fit_open   move outline points onto the lines the picture really has (silhouette, tone edges, shut lines)
  split                   cut the body shell along the fitted shut lines into hood, cowl, door, quarter, roof, tail ...
"""
import cv2, numpy as np
from shapely.geometry import Polygon, LineString
from shapely.ops import split as _split
MM = 10

class View:
    """the reference view at game scale, with the three kinds of line a body can be fitted to"""
    def __init__(s, png, length):
        src = cv2.imread(png, cv2.IMREAD_UNCHANGED); s.w = round(length / MM); s.h = round(src.shape[0] * s.w / src.shape[1])
        img = cv2.resize(src, (s.w, s.h), interpolation=cv2.INTER_AREA); s.bgr = img[..., :3]; s.mask = img[..., 3] > 127
        lum = cv2.cvtColor(img[..., :3], cv2.COLOR_BGR2GRAY).astype(np.float32); lum[~s.mask] = lum[s.mask].mean(); s.lum = lum
        a = cv2.GaussianBlur(s.mask.astype(np.float32), (0, 0), 0.8); s.sil = np.hypot(cv2.Sobel(a, cv2.CV_32F, 1, 0), cv2.Sobel(a, cv2.CV_32F, 0, 1)) * 255
        b = cv2.GaussianBlur(lum, (0, 0), 0.7); s.grad = np.hypot(cv2.Sobel(b, cv2.CV_32F, 1, 0), cv2.Sobel(b, cv2.CV_32F, 0, 1)) * s.mask
        s.dark = np.maximum(0, cv2.GaussianBlur(lum, (0, 0), 2.2) - lum) * cv2.erode(s.mask.astype(np.uint8), np.ones((5, 5), np.uint8))
    def px(s, p): return np.array([[x / MM, s.h - z / MM] for x, z, *_ in p], np.float32)
    def mm(s, q): return [[int(round(x * MM)), int(round((s.h - y) * MM))] for x, y in q]

def _dense(q, step, closed):
    out = []; n = len(q)
    for i in range(n if closed else n - 1):
        a, b = q[i], q[(i + 1) % n]; k = max(1, int(np.ceil(np.hypot(*(b - a)) / step)))
        out += [a + (b - a) * j / k for j in range(k)]
    if not closed: out.append(q[-1])
    return np.array(out, np.float32)
def _sample(m, x, y):
    h, w = m.shape; x = min(max(x, 0), w - 1.001); y = min(max(y, 0), h - 1.001); x0, y0 = int(x), int(y); fx, fy = x - x0, y - y0
    return m[y0, x0] * (1 - fx) * (1 - fy) + m[y0, x0 + 1] * fx * (1 - fy) + m[y0 + 1, x0] * (1 - fx) * fy + m[y0 + 1, x0 + 1] * fx * fy
def _fit(q, field, closed, reach, floor, ends_fixed=False):
    n = len(q); off = np.zeros(n, np.float32); nrm = np.zeros((n, 2), np.float32)
    for i in range(n):
        a = q[(i - 1) % n] if (closed or i > 0) else q[i]; b = q[(i + 1) % n] if (closed or i < n - 1) else q[i]; t = b - a; l = np.hypot(*t) or 1; nrm[i] = [-t[1] / l, t[0] / l]
        best, bo = floor, 0.0
        for o in np.arange(-reach, reach + 0.01, 0.5):
            v = _sample(field, q[i][0] + nrm[i][0] * o, q[i][1] + nrm[i][1] * o) * np.exp(-0.5 * (o / (reach * 0.7)) ** 2)
            if v > best: best, bo = v, o
        off[i] = bo
    for _ in range(3):
        o2 = off.copy()
        for i in range(n):
            if not closed and (i == 0 or i == n - 1): continue
            o2[i] = (off[(i - 1) % n] + 2 * off[i] + off[(i + 1) % n]) / 4
        off = o2
    if ends_fixed and not closed: off[0] = off[-1] = 0
    return q + nrm * off[:, None], float(np.abs(off).mean() * MM)
def _thin(q, closed, tol=0.35):
    c = cv2.approxPolyDP(q.reshape(-1, 1, 2).astype(np.float32), tol, closed).reshape(-1, 2); return c
def fit_closed(V, pts, field, reach=3.5, floor=12, step=5):
    q, moved = _fit(_dense(V.px(pts), step, True), field, True, reach, floor); return [[x, z, 1] for x, z in V.mm(_thin(q, True))], moved
def fit_open(V, pts, field, reach=3.5, floor=6, step=5):
    q, moved = _fit(_dense(V.px(pts), step, False), field, False, reach, floor); return [[x, z, 1] for x, z in V.mm(_thin(q, False))], moved

def split(body_pts, cuts):
    """cuts: [(name of the piece on the line's left, name on its right or None to keep cutting, line in mm)], applied in order
    to whatever piece the line crosses most; returns {name: pts}"""
    pieces = {'_': Polygon([(x, z) for x, z, *_ in body_pts]).buffer(0)}
    for target, left, right, line in cuts:
        ls = LineString(line); src = pieces.pop(target); parts = list(_split(src, ls).geoms)
        if len(parts) < 2: raise SystemExit(f'cut for {left}/{right} does not cross {target}')
        L, R = [], []
        for g in parts:
            c = g.representative_point(); d = ls.project(c); a = ls.interpolate(max(0, d - 1)); b = ls.interpolate(min(ls.length, d + 1))
            (L if (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 0 else R).append(g)
        for name, gs in ((left, L), (right, R)):
            if not gs: raise SystemExit(f'nothing on one side of the cut {left}/{right}')
            pieces[name] = max(gs, key=lambda g: g.area) if len(gs) == 1 else Polygon(max(gs, key=lambda g: g.area).exterior)
            if len(gs) > 1:
                from shapely.ops import unary_union
                u = unary_union(gs); pieces[name] = u if u.geom_type == 'Polygon' else max(u.geoms, key=lambda g: g.area)
    return {k: [[int(round(x)), int(round(z)), 1] for x, z in list(g.exterior.coords)[:-1]] for k, g in pieces.items()}

def ext(line, by=160):
    """a cut line made longer at both ends along its end segments, so it surely crosses the shell"""
    a, b = np.array(line[0][:2], float), np.array(line[1][:2], float); c, e = np.array(line[-2][:2], float), np.array(line[-1][:2], float)
    u = (a - b) / np.linalg.norm(a - b); v = (e - c) / np.linalg.norm(e - c); return [list(a + u * by)] + [q[:2] for q in line] + [list(e + v * by)]

def paint_of(png, length, map_json):
    """the body colour as the view shows it: the middle tone of the pixels a capture calls paint"""
    import json
    M = json.load(open(map_json)); w, h = M['w'], M['h']; src = cv2.imread(png, cv2.IMREAD_UNCHANGED); img = cv2.resize(src, (w, h), interpolation=cv2.INTER_AREA)[..., :3][..., ::-1]
    u = lambda a: np.repeat(np.array(a).reshape(-1, 2)[:, 0], np.array(a).reshape(-1, 2)[:, 1]).reshape(h, w)
    px = img[(u(M['e']) >= 0) & (u(M['m']) == 0)].astype(float); lum = px @ [0.299, 0.587, 0.114]; sel = px[np.abs(lum - np.percentile(lum, 50)) < 3]
    return '#%02x%02x%02x' % tuple(np.median(sel, 0).astype(int))

def build(src_body, png, out_id, fits, cuts, rest, surfaces=None, paint=None):
    """the steps every car takes in method Z: fit the named panels to the view, fit each cut line to the view's dark
    lines, cut the shell (panel 'body') into elements, drop the shut lines that became element borders.
    fits: [(panel id, 'sil' | 'edge' | 'grad', reach px)]; cuts: [(piece cut, name on the left, name on the right, line in mm)];
    rest: the name of what is left of the shell. Returns the design and a log of how far things moved (mm)."""
    import json, copy
    d = json.load(open(src_body)); V = View(png, d['length']); P = {p['id']: p for p in d['panels']}; log = {}
    F = {'sil': V.sil * 3, 'edge': np.maximum(V.sil * 3, V.grad), 'grad': V.grad}
    for pid, field, reach in fits: P[pid]['pts'], log[pid] = fit_closed(V, P[pid]['pts'], F[field], reach=reach, floor=25)
    fitted = []
    for k, (target, left, right, core) in enumerate(cuts):
        f, log[f'cut {left}'] = fit_open(V, [[x, z, 1] for x, z in core], V.dark, reach=3, floor=4); fitted.append((target, left, right, ext(f)))
    pieces = split(P['body']['pts'], fitted); pieces[rest] = pieces.pop('_')
    base = P['body']; out = []; names = [n for _, l, r, _ in fitted for n in (l, r) if n != '_'] + [rest]; names = list(dict.fromkeys(names))
    for p in d['panels']:
        if p['id'] != 'body': out.append(p); continue
        for name in names:
            q = copy.deepcopy(base); q.update(id=name, pts=pieces[name], surface=(surfaces or {}).get(name, 'side'), element=name.split('.')[1]); q.pop('bevel', None); out.append(q)
    d['panels'] = out; d['id'] = out_id
    if paint: d['paint'] = paint                                                  # a second tone (leather, two-tone) keeps its own colour
    lines = [np.array(c[3], float) for c in fitted]
    def near_cut(f):
        pts = np.array([q[:2] for q in f['pts']], float)
        return all(min(np.min(np.hypot(*(L - p).T)) for L in [np.array([a + (b - a) * t for a, b in zip(l[:-1], l[1:]) for t in np.linspace(0, 1, 12)]) for l in lines]) < 60 for p in pts)
    d['features'] = [f for f in d['features'] if not (f['kind'] == 'seam' and near_cut(f))]
    return d, log
