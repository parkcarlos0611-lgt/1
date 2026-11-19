"""Small helpers for writing a body by hand from measurements (millimetres, x from the nose, z up)."""
import json, math
class Body:
    def __init__(s): s.P = []; s.F = []; s.W = []; s.parts = []
    def add(s, id, pts, material, surface, z, **k):
        s.P.append({'id': id, 'pts': pts, 'material': material, 'surface': surface, 'z': z, **k}); return s
    def feat(s, **f): s.F.append(f); return s
    def part(s, kind, form, **k):
        """a part from the library (render/car/parts.ts)"""
        s.parts.append({'kind': kind, 'form': form, **k}); return s
    def wheel(s, x, r, **k): s.W.append({'x': x, 'r': r, 'rim': 0.6, 'style': 'disc', 'spokes': 0, 'rimMaterial': 'paint', 'zOrder': 5, **k}); return s
    def well(s, id, x, r, R):
        """the dark hollow behind a wheel"""
        pts = [[x - R, r - 120, 1]] + [[round(x + math.cos(a) * R), round(r + math.sin(a) * R), 1] for a in [math.pi * k / 14 for k in range(14, -1, -1)]] + [[x + R, r - 120, 1]]
        return s.add(id, pts, 'shadow', 'flat', 2)
    def save(s, path, **meta):
        d = {**meta, 'panels': s.P, 'features': s.F, 'wheels': s.W, **({'parts': s.parts} if s.parts else {})}; json.dump(d, open(path, 'w'), indent=0)
        print(path, len(s.P), 'panels', sum(len(p['pts']) for p in s.P), 'points', len(s.F), 'features', 'slots', sorted({p['slot'] for p in s.P if 'slot' in p}), 'parts', [p['kind'] + ':' + p['form'] for p in s.parts])
def ell(cx, cz, rx, rz, n=20): return [[round(cx + math.cos(k / n * 6.2832) * rx), round(cz + math.sin(k / n * 6.2832) * rz)] for k in range(n)]
def sh(p): return [[x, z, 1] for x, z in p]
def tube(centre, width):
    """a strip of the given width along a centre line (pipes, rails)"""
    L, R = [], []
    for i, (x, z) in enumerate(centre):
        a, b = centre[max(0, i - 1)], centre[min(len(centre) - 1, i + 1)]; dx, dz = b[0] - a[0], b[1] - a[1]; l = math.hypot(dx, dz) or 1; nx, nz = -dz / l * width / 2, dx / l * width / 2
        L.append([round(x + nx), round(z + nz)]); R.append([round(x - nx), round(z - nz)])
    return L + R[::-1]

def sym(half, c):
    """a full outline from a half one: points (w, z) from the centre line outwards, first and last on the centre line; c is the centre's x"""
    right = [[round(c + w), round(z), 1] for w, z in half]
    left = [[round(c - w), round(z), 1] for w, z in reversed(half) if w != 0]
    return right + left
def pair(pts, c):
    """the same small outline on both sides of the centre line, as two outlines"""
    return [[[round(c + w), round(z)] for w, z in pts], [[round(c - w), round(z)] for w, z in pts]]
