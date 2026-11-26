"""The Phorster crest baked for the drift style's atlas (docs/systems/116, step B1).

The user's artwork (assets/brand/phorster_crest_src.png) is cut to the shield alone (the wordmark under it is left out)
and laid into one 256 x 256 atlas cell: the shield 188 x 240 texels with an 8-texel margin above and below, the margin
filled with the rim's own dark gold so that nothing from the neighbouring cells bleeds into the badge's edge as the
picture shrinks. The cell's far mip levels (64, 32 and 16 texels) are not the artwork shrunk but a flat-colour drawing
of it, made here for each size: the gold field, the black, white and red bars, the small centre shield, and in simple
shapes the lettering band, the bull and the two laurel wreaths (the user asked for those to stay). The game makes the
128 level and the levels under 16 itself, by halving.

Writes render/live/crest.gen.ts (the cell as one 256-colour palette and indices, base64; the shield's outline for the
badge plate) and assets/brand/phorster_crest_cell.png (the cell and its levels, for a person to look at).
Deterministic: the same artwork gives the same files.

  python3 tools/ref/crestbake.py"""
import base64, math, os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'assets/brand/phorster_crest_src.png')
OUT_TS = os.path.join(ROOT, 'render/live/crest.gen.ts')
OUT_PNG = os.path.join(ROOT, 'assets/brand/phorster_crest_cell.png')
CROP = (599, 0, 1138, 692)          # the shield in the artwork (its alpha's bounds); the wordmark lies below y 730
CELL, BOX = 256, (34, 8, 188, 240)  # the cell, and the shield's box in it: x, y, width, height (texels)
FLAT = (64, 32, 16)                 # the levels drawn flat
SS = 8                              # supersampling of the flat drawings

src = Image.open(SRC).convert('RGBA').crop(CROP)
W0, H0 = src.size
A = np.asarray(src).astype(np.float64)
inside = A[..., 3] >= 128

# ---- the flat colours: the artwork's own, each the median of the pixels nearest a first guess ----
GUESS = {'G': (225, 195, 135), 'D': (170, 130, 70), 'K': (25, 25, 25), 'W': (235, 235, 230), 'R': (150, 25, 30)}
px = A[inside][:, :3]
names = list(GUESS)
d = np.stack([((px - np.array(GUESS[k])) ** 2).sum(1) for k in names], 1)
near = d.argmin(1)
COL = {k: tuple(int(v) for v in np.median(px[near == i], 0).round()) for i, k in enumerate(names)}
COL['K'] = tuple(min(v, 30) for v in COL['K'])   # the ink as dark as the artwork's darkest, not its shaded average

# ---- the shield's outline: 24 points, symmetric, a little outside the artwork's edge so the plate shows all its rim ----
def outline(n_half=12):
    ys, xs = np.nonzero(inside)
    cx = (xs.min() + xs.max() + 1) / 2
    pts = []
    for y in range(H0):                          # the right edge, row by row
        r = np.nonzero(inside[y])[0]
        if len(r): pts.append((r.max() + 1.0, y + 0.5))
    for x in range(int(math.ceil(cx)), W0):       # the top, column by column
        c = np.nonzero(inside[:, x])[0]
        if len(c): pts.append((x + 0.5, float(c.min())))
    pts = np.array(pts)
    ang = np.arctan2(pts[:, 0] - cx, -(pts[:, 1] - H0 / 2))   # from straight up, turning right and down
    pts = pts[np.argsort(ang)]
    top = np.array([cx, float(np.nonzero(inside[:, int(cx)])[0].min())]); tip = np.array([cx, float(H0)])
    chain = np.vstack([top, pts[(pts[:, 0] >= cx)], tip])
    keep = [0, len(chain) - 1]                     # the points that stray furthest from the outline so far, one at a time
    while len(keep) < n_half + 1:
        keep.sort(); best = (0, None)
        for a, b in zip(keep, keep[1:]):
            p, q = chain[a], chain[b]; t = q - p; L = np.hypot(*t) or 1
            dist = np.abs((chain[a:b, 0] - p[0]) * t[1] - (chain[a:b, 1] - p[1]) * t[0]) / L
            if len(dist) and dist.max() > best[0]: best = (dist.max(), a + int(dist.argmax()))
        if best[1] is None: break
        keep.append(best[1])
    keep.sort(); half = chain[keep]
    # push each corner out by half the largest gap left between a chord and the edge, so the rim is not cut
    sag = 0.0
    for a, b in zip(keep, keep[1:]):
        p, q = chain[a], chain[b]; t = q - p; L = np.hypot(*t) or 1
        if b > a + 1: sag = max(sag, (np.abs((chain[a:b, 0] - p[0]) * t[1] - (chain[a:b, 1] - p[1]) * t[0]) / L).max())
    c = np.array([cx, H0 * 0.45]); out = []
    for p in half:
        v = p - c; v = v / (np.hypot(*v) or 1); out.append(p + v * sag * 0.5)
    right = [((p[0] - cx) / W0 + 0.5, p[1] / H0) for p in out]
    left = [(1 - x, y) for x, y in reversed(right[1:-1])]
    return [(round(x, 4), round(min(1.0, max(0.0, y)), 4)) for x, y in right + left], sag
OUTLINE, SAG = outline()

# ---- level 0: the artwork in the box, over the rim's gold, shrunk with its alpha premultiplied ----
def level0():
    pm = A.copy(); pm[..., :3] *= pm[..., 3:4] / 255
    bw, bh = BOX[2], BOX[3]
    ch = [Image.fromarray(pm[..., k].astype(np.float32), 'F').resize((bw, bh), Image.LANCZOS) for k in range(4)]
    a = np.clip(np.asarray(ch[3]) / 255, 0, 1)
    rgb = np.stack([np.asarray(ch[k]) for k in range(3)], -1)
    under = np.array(COL['D'], np.float64)
    out = rgb + under * (1 - a[..., None])
    return np.clip(out.round(), 0, 255).astype(np.uint8)

# ---- the flat drawings ----
# The artwork posterised to the five flat colours (a median filter first takes off the gold's pebbling and the leather's
# grain; the rim's band is the dark gold, the field the light), then for each far level:
#   64: the posterised picture averaged over each texel, the ink a little heavier so the letters and leaves hold;
#   32: the same with the ink heavier still, the bars laid on whole texel rows (each bar at least one row);
#   16: drawn by hand, texel by texel (below): a picture that small cannot be found by any filter.
# Shield coordinates: x 0..1 across its width, y 0..1 down its height.
def posterised():
    guess = dict(COL); guess['B'] = (85, 50, 30)             # the dark brown lines along the lettering band: ink
    keys = list(guess); ix = {k: i for i, k in enumerate(keys)}
    med = np.asarray(src.convert('RGB').filter(ImageFilter.MedianFilter(5))).astype(np.float64)
    cls = np.stack([((med - np.array(guess[k])) ** 2).sum(-1) for k in keys], -1).argmin(-1)
    cls[cls == ix['B']] = ix['K']
    inner = np.asarray(Image.fromarray((inside * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(23))) > 0
    cls[inside & ~inner] = ix['D']; cls[inner & (cls == ix['D'])] = ix['G']; cls[~inside] = ix['D']
    cls = np.asarray(Image.fromarray(cls.astype(np.uint8)).filter(ImageFilter.ModeFilter(5)))   # specks off
    return cls, keys
POST, PKEYS = posterised()
PX = {k: i for i, k in enumerate(PKEYS)}
PCOL = np.array([COL.get(k, COL['K']) for k in PKEYS], np.float64)

def fractions(C):
    """each texel's share of each flat colour, the posterised picture laid in the cell at C texels"""
    bx, by, bw, bh = (v * C / CELL for v in BOX)
    big = np.full((C * SS, C * SS), PX['D'], np.uint8)
    sub = np.asarray(Image.fromarray(POST.astype(np.uint8)).resize((int(round(bw * SS)), int(round(bh * SS))), Image.NEAREST))
    x0, y0 = int(round(bx * SS)), int(round(by * SS)); big[y0:y0 + sub.shape[0], x0:x0 + sub.shape[1]] = sub
    return np.stack([(big == i).reshape(C, SS, C, SS).mean((1, 3)) for i in range(len(PKEYS))], -1)

def averaged(F, boost):
    F = F.copy()
    for k, b in boost.items():
        i = PX[k]; f = np.minimum(1, F[..., i] * b); rest = F.sum(-1) - F[..., i]
        F *= np.where(rest > 0, (1 - f) / np.maximum(rest, 1e-9), 0)[..., None]; F[..., i] = f
    return F @ PCOL

# the bars of the two striped quarters: x from, x to, and each bar's colour and rows (y from, y to)
BARS = [(0.506, 1.0, [('K', 0.145, 0.226), ('W', 0.236, 0.271), ('R', 0.271, 0.324), ('K', 0.334, 0.411), ('W', 0.421, 0.452), ('R', 0.452, 0.513)]),
        (0.0, 0.494, [('K', 0.523, 0.607), ('W', 0.620, 0.651), ('R', 0.651, 0.708), ('K', 0.716, 0.793), ('W', 0.802, 0.829), ('R', 0.829, 1.0)])]
CENTRE = [(0.318, 0.334), (0.688, 0.334), (0.688, 0.52), (0.672, 0.575), (0.635, 0.615), (0.565, 0.645), (0.503, 0.66),
          (0.441, 0.645), (0.371, 0.615), (0.334, 0.575), (0.318, 0.52)]   # the small centre shield (the bull's)
def under_band(x, y): return y >= 0.14 + 0.045 * ((x - 0.5) / 0.45) ** 2   # below the lettering band's curved lower edge
def inpoly(poly, x, y):
    n = len(poly); r = False; j = n - 1
    for i in range(n):
        (xi, yi), (xj, yj) = poly[i], poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: r = not r
        j = i
    return r
def bar_rows(C, bars):
    """the bars on whole texel rows, in order, each at least one row: the rows shared out by largest remainder"""
    by, bh = BOX[1] * C / CELL, BOX[3] * C / CELL
    edges = [bars[0][1]] + [(bars[i][2] + bars[i + 1][1]) / 2 for i in range(len(bars) - 1)] + [bars[-1][2]]
    t = [by + e * bh for e in edges]; r0, r1 = int(round(t[0])), int(round(t[-1]))
    want = [t[i + 1] - t[i] for i in range(len(bars))]; k = (r1 - r0) / sum(want); want = [w * k for w in want]
    n = [max(1, int(w)) for w in want]
    while sum(n) < r1 - r0: i = max(range(len(n)), key=lambda i: want[i] - n[i]); n[i] += 1
    while sum(n) > r1 - r0: i = max(range(len(n)), key=lambda i: (n[i] - want[i]) if n[i] > 1 else -9); n[i] -= 1
    rows, r = {}, r0
    for (c, _, _), m in zip(bars, n):
        for _ in range(m): rows[r] = c; r += 1
    return rows

GRID16 = """
DDDDDDDDDDDDDDDD
DDDDDGGGGGGDDDDD
DDGKKGKGKKGKKGDD
DDGGGGGGKKKKKKDD
DDGKGGKGWWWWWWDD
DDGKGGDDDDRRRRDD
DDGGKKGDDGKKKKDD
DDGGGDGKKKRRRRDD
DDKKKKGKKKDGGGDD
DDWWWWGKGKGGGGDD
DDDRRRRGGKGGKGDD
DDDKKKKKGKGGKDDD
DDDDWWWWGGKKGDDD
DDDDDRRRGGDDDDDD
DDDDDDRRGGDDDDDD
DDDDDDDDDDDDDDDD
"""   # the 16 level by hand: the lettering band (dark marks on gold), the bars, the centre shield with its dark-gold edge
      # and the bull (a dark block, its head low on the left, two legs), the two wreaths as small open cups

def flat(C):
    if C == 16:
        rows = [r for r in GRID16.split() if r]
        assert len(rows) == 16 and all(len(r) == 16 for r in rows)
        return np.array([[COL[c] for c in r] for r in rows], np.uint8)
    F = fractions(C)
    img = averaged(F, {'K': 1.3, 'W': 1.15} if C >= 64 else {'K': 1.7, 'W': 1.3})
    if C < 64:   # the bars on whole rows, where the texel is in that quarter, off the centre shield and inside the rim
        bx, by, bw, bh = (v * C / CELL for v in BOX)
        for x0, x1, bars in BARS:
            for r, c in bar_rows(C, bars).items():
                for q in range(C):
                    xn, yn = (q + 0.5 - bx) / bw, (r + 0.5 - by) / bh
                    if x0 <= xn <= x1 and under_band(xn, yn) and not inpoly(CENTRE, xn, yn) and F[r, q, PX['D']] < 0.5 and F[r, q, PX['G']] + F[r, q, PX['K']] + F[r, q, PX['W']] + F[r, q, PX['R']] > 0.5:
                        img[r, q] = COL[c]
    return np.clip(img.round(), 0, 255).astype(np.uint8)

L0 = level0()
FL = {C: flat(C) for C in FLAT}

# ---- one palette: the five flat colours first, then the artwork's (median cut); level 0 dithered, the flat ones nearest ----
flatcols = [COL[k] for k in ('G', 'D', 'K', 'W', 'R')]
mc = Image.fromarray(L0).quantize(colors=256 - len(flatcols), method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
mcp = mc.getpalette()[:3 * (256 - len(flatcols))]
pal = [c for col in flatcols for c in col] + mcp
pal += [0] * (768 - len(pal))
palimg = Image.new('P', (1, 1)); palimg.putpalette(pal)
idx0 = np.asarray(Image.fromarray(L0).quantize(palette=palimg, dither=Image.Dither.FLOYDSTEINBERG), np.uint8)
idxF = {C: np.asarray(Image.fromarray(FL[C]).quantize(palette=palimg, dither=Image.Dither.NONE), np.uint8) for C in FLAT}
P8 = np.array(pal, np.uint8).reshape(256, 3)

# ---- the TypeScript data ----
b64 = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode('ascii')
def chunks(s, n=160): return '\n'.join(f"  '{s[i:i + n]}' +" for i in range(0, len(s), n)).rstrip(' +')
ts = [
    '// Generated by tools/ref/crestbake.py from assets/brand/phorster_crest_src.png (docs/systems/116, B1). Do not edit by hand.',
    '// The Phorster crest for the drift style\'s atlas: one 256-colour palette, the artwork in the shield\'s box (level 0),',
    '// the flat drawings for the 64, 32 and 16 texel levels, and the shield\'s outline for the badge plate.',
    '/* eslint-disable */',
    f'export const CREST_BOX = [{", ".join(str(v) for v in BOX)}] as const;   // x, y, width, height in the 256 cell',
    f'export const CREST_FLAT = [{", ".join(str(c) for c in FLAT)}] as const;',
    '/** the shield\'s outline: 24 points, x across its width 0..1, y down its height 0..1, clockwise as seen from the front */',
    'export const CREST_OUTLINE: readonly (readonly [number, number])[] = [' + ', '.join(f'[{x}, {y}]' for x, y in OUTLINE) + '];',
    '/** the flat colours (rgb): the field\'s gold, the rim\'s darker gold, ink, white, red */',
    'export const CREST_COLOURS = { ' + ', '.join(f"{k}: [{', '.join(str(v) for v in COL[k])}]" for k in ('G', 'D', 'K', 'W', 'R')) + ' } as const;',
    '/** the palette, 256 rgb triples */',
    'export const CREST_PAL =\n' + chunks(b64(P8)) + ';',
    '/** level 0 inside the box, row by row from the shield\'s top: palette indices */',
    'export const CREST_L0 =\n' + chunks(b64(idx0)) + ';',
    '/** the flat levels, whole cells, in CREST_FLAT\'s order: palette indices */',
    'export const CREST_FLATS = [\n' + ',\n'.join(chunks(b64(idxF[C])) for C in FLAT) + '];',
    '',
]
open(OUT_TS, 'w').write('\n'.join(ts))

# ---- the sheet for a person: level 0 in its cell, then each flat level, each also shown 4x ----
cell0 = np.zeros((CELL, CELL, 3), np.uint8); cell0[:] = COL['D']
cell0[BOX[1]:BOX[1] + BOX[3], BOX[0]:BOX[0] + BOX[2]] = P8[idx0]
tiles = [Image.fromarray(cell0)] + [Image.fromarray(P8[idxF[C]]) for C in FLAT] + [Image.fromarray(P8[idxF[C]]).resize((C * 4, C * 4), Image.NEAREST) for C in FLAT]
sheet = Image.new('RGB', (sum(t.width for t in tiles) + 8 * (len(tiles) + 1), CELL + 16), (46, 50, 56)); x = 8
for t in tiles: sheet.paste(t, (x, 8)); x += t.width + 8
sheet.save(OUT_PNG, optimize=False)
print(f'colours {COL}; outline sag {SAG:.2f} px of {W0}x{H0}; {OUT_TS} ({os.path.getsize(OUT_TS)} bytes), {OUT_PNG}')
