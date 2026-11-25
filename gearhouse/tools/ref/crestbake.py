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
from PIL import Image, ImageDraw, ImageFilter

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
# shield coordinates: x 0..1 across its width, y 0..1 down its height
def arc_band(x): return 0.14 + 0.045 * ((x - 0.5) / 0.45) ** 2          # the lettering band's lower edge
LETTERS = {   # the same strokes as render/car/p959/badge.ts LETTERS (unit box, x right, y up)
    'P': [[[0, 0], [0, 1], [.82, 1], [1, .84], [1, .64], [.82, .48], [0, .48]]],
    'H': [[[0, 0], [0, 1]], [[1, 0], [1, 1]], [[0, .5], [1, .5]]],
    'O': [[[.2, 0], [.8, 0], [1, .2], [1, .8], [.8, 1], [.2, 1], [0, .8], [0, .2], [.2, 0]]],
    'R': [[[0, 0], [0, 1], [.82, 1], [1, .84], [1, .66], [.82, .5], [0, .5]], [[.5, .5], [1, 0]]],
    'S': [[[1, .84], [.84, 1], [.16, 1], [0, .84], [0, .66], [.16, .52], [.84, .48], [1, .34], [1, .16], [.84, 0], [.16, 0], [0, .16]]],
    'T': [[[0, 1], [1, 1]], [[.5, 1], [.5, 0]]],
    'E': [[[1, 1], [0, 1], [0, 0], [1, 0]], [[0, .5], [.8, .5]]],
}
CENTRE = [(0.318, 0.334), (0.688, 0.334), (0.688, 0.52), (0.672, 0.575), (0.635, 0.615), (0.565, 0.645), (0.503, 0.66),
          (0.441, 0.645), (0.371, 0.615), (0.334, 0.575), (0.318, 0.52)]
BULL = [(0.405, 0.555), (0.425, 0.568), (0.452, 0.542), (0.458, 0.575), (0.444, 0.600), (0.470, 0.602), (0.484, 0.560),
        (0.520, 0.552), (0.545, 0.578), (0.535, 0.600), (0.560, 0.600), (0.572, 0.565), (0.586, 0.596), (0.612, 0.596),
        (0.606, 0.540), (0.616, 0.490), (0.612, 0.458), (0.572, 0.433), (0.512, 0.425), (0.476, 0.442), (0.450, 0.456),
        (0.425, 0.466), (0.410, 0.488), (0.400, 0.525)]
HORNS = [[(0.420, 0.472), (0.385, 0.462), (0.362, 0.452), (0.356, 0.432)], [(0.452, 0.458), (0.468, 0.440), (0.466, 0.418)]]
TAIL = [(0.612, 0.462), (0.628, 0.440), (0.626, 0.420), (0.640, 0.410), (0.648, 0.418)]
# the two wreaths: each two branches from where their stems cross up to their tips (a quadratic curve through a middle point)
WREATHS = [((0.245, 0.435), [((0.215, 0.445), (0.10, 0.33), (0.135, 0.19)), ((0.275, 0.445), (0.39, 0.33), (0.355, 0.19))]),
           ((0.715, 0.848), [((0.685, 0.858), (0.565, 0.74), (0.595, 0.615)), ((0.745, 0.858), (0.865, 0.74), (0.84, 0.615))])]

def bez(p, m, q, n):   # a quadratic through p, near m, to q
    c = (2 * m[0] - (p[0] + q[0]) / 2, 2 * m[1] - (p[1] + q[1]) / 2)
    return [((1 - t) ** 2 * p[0] + 2 * t * (1 - t) * c[0] + t * t * q[0], (1 - t) ** 2 * p[1] + 2 * t * (1 - t) * c[1] + t * t * q[1]) for t in (i / n for i in range(n + 1))]

def flat(C):
    """the crest drawn flat for a cell of C texels: each feature at least about a texel wide, so it survives"""
    k = C * SS / CELL; tx = SS                     # hi-res pixels a cell texel
    bx, by, bw, bh = (v * k for v in BOX)
    P = lambda x, y: (bx + x * bw, by + y * bh)
    big = C >= 64
    img = Image.new('RGB', (C * SS, C * SS), COL['D']); dr = ImageDraw.Draw(img)
    # the shield, the rim inside it, the field
    sh = Image.fromarray((inside * 255).astype(np.uint8)).resize((int(round(bw)), int(round(bh))), Image.BILINEAR).point(lambda v: 255 if v >= 128 else 0)
    mask = Image.new('L', img.size, 0); mask.paste(sh, (int(round(bx)), int(round(by))))
    rim = max(0.022 * bw, (0.9 if big else 0.6) * tx)
    inner = mask.filter(ImageFilter.MinFilter(2 * int(round(rim)) + 1))
    field = Image.new('RGB', img.size, COL['G']); img.paste(field, (0, 0), inner)
    lay = Image.new('RGB', img.size, COL['G']); ld = ImageDraw.Draw(lay)   # everything inside the rim, pasted through it at the end
    line = lambda pts, w, c: ld.line([P(*p) for p in pts], fill=c, width=max(1, int(round(w))), joint='curve')
    # the bars: top right and bottom left, each colour across its quadrant
    gap = max(0.006 * bh, 0.35 * tx)
    for x0, x1, bars in [(0.506, 1.0, [('K', None, 0.226), ('W', 0.236, 0.271), ('R', 0.271, 0.324), ('K', 0.334, 0.411), ('W', 0.421, 0.452), ('R', 0.452, 0.513)]),
                         (0.0, 0.494, [('K', 0.523, 0.607), ('W', 0.620, 0.651), ('R', 0.651, 0.708), ('K', 0.716, 0.793), ('W', 0.802, 0.829), ('R', 0.829, 1.0)])]:
        for c, y0, y1 in bars:
            if y0 is None:   # the first bar starts at the lettering band's edge
                pts = [P(x, arc_band(x) + 0.004) for x in np.linspace(x0, x1, 12)] + [P(x1, y1), P(x0, y1)]
                ld.polygon(pts, fill=COL[c])
            else: ld.rectangle([P(x0, y0), P(x1, y1)], fill=COL[c])
    if not big:   # small: the thin gold gaps between bars would vanish; draw them at a fixed width so the bars stay apart
        for x0, x1, ys in [(0.506, 1.0, (0.231, 0.329, 0.416)), (0.0, 0.494, (0.613, 0.712, 0.797))]:
            for y in ys: ld.line([P(x0, y), P(x1, y)], fill=COL['G'], width=max(1, int(round(gap))))
    # the lettering band: gold, ink along both edges, the letters in ink following its curve
    band_hi = [P(x, 0.0) for x in np.linspace(0, 1, 2)]
    ld.polygon([P(0, 0), P(1, 0)] + [P(x, arc_band(x)) for x in np.linspace(1, 0, 24)], fill=COL['G'])
    edge_w = max(0.006 * bh, (0.45 if big else 0.4) * tx)
    ld.line([P(x, arc_band(x)) for x in np.linspace(0, 1, 32)], fill=COL['K'], width=max(1, int(round(edge_w))))
    top_edge = Image.new('L', img.size, 0)   # the band's upper ink line: just inside the rim
    inner2 = inner.filter(ImageFilter.MinFilter(2 * int(round(edge_w)) + 1))
    ring = Image.fromarray((np.asarray(inner) > 0) & ~(np.asarray(inner2) > 0)).convert('L')
    band_zone = Image.new('L', img.size, 0); ImageDraw.Draw(band_zone).polygon([P(0, 0), P(1, 0)] + [P(x, arc_band(x)) for x in np.linspace(1, 0, 24)], fill=255)
    lay.paste(Image.new('RGB', img.size, COL['K']), (0, 0), Image.fromarray(np.asarray(ring) & np.asarray(band_zone)))
    word, x0, x1 = 'PHORSTER', 0.075, 0.925
    pitch = (x1 - x0) / len(word); lw = pitch * 0.80; capH = 0.072
    stroke = max(0.022 * bh, (0.75 if C >= 64 else 0.85 if C >= 32 else 0.8) * tx)
    for i, ch in enumerate(word):
        xc = x0 + (i + 0.5) * pitch; base = arc_band(xc) - 0.024
        slope = (arc_band(xc + 0.01) - arc_band(xc - 0.01)) / 0.02 * bh / bw
        ca, sa = math.cos(math.atan(slope)), math.sin(math.atan(slope))
        for st in LETTERS[ch]:
            pts = []
            for u, v in st:
                dx, dy = (u - 0.5) * lw * bw, -v * capH * bh   # pixels from the letter's foot, y down
                pts.append((bx + xc * bw + dx * ca - dy * sa, by + base * bh + dx * sa + dy * ca))
            ld.line(pts, fill=COL['K'], width=max(1, int(round(stroke))), joint='curve')
    # the dividers: a gold cross between the quadrants
    div = max(0.012 * bw, 0.5 * tx)
    ld.line([P(0.5, arc_band(0.5)), P(0.5, 1.0)], fill=COL['G'], width=max(1, int(round(div))))
    ld.line([P(0, 0.517), P(1, 0.517)], fill=COL['G'], width=max(1, int(round(div))))
    # the wreaths: a stem and leaves; small, a thick stroke
    for (cross, branches) in WREATHS:
        for (p, m, q) in branches:
            pts = bez(p, m, q, 16)
            if C >= 64:
                line(pts, max(0.008 * bw, 0.5 * tx), COL['K'])
                for j in range(1, 8):   # leaves both sides, pointing up the branch
                    a, b = pts[2 * j - 1], pts[2 * j]; t = (b[0] - a[0], b[1] - a[1]); L = math.hypot(*t) or 1; t = (t[0] / L, t[1] / L); nrm = (-t[1], t[0])
                    for s in (1, -1):
                        ox, oy = a[0] + nrm[0] * s * 0.022 + t[0] * 0.01, a[1] + nrm[1] * s * 0.022 * bw / bh + t[1] * 0.01
                        lx, ly = (t[0] + nrm[0] * s * 0.9), (t[1] + nrm[1] * s * 0.9); ll = math.hypot(lx, ly); lx, ly = lx / ll, ly / ll
                        leaf = [P(ox - lx * 0.028, oy - ly * 0.028 * bw / bh), P(ox + lx * 0.028, oy + ly * 0.028 * bw / bh)]
                        ld.line(leaf, fill=COL['K'], width=max(1, int(round(0.026 * bw))))
            else: line(pts, (1.05 if C >= 32 else 0.95) * tx, COL['K'])
        # the crossed stems under the wreath
        line([(cross[0] - 0.045, cross[1] - 0.015), (cross[0] + 0.045, cross[1] + 0.022)], max(0.008 * bw, 0.5 * tx), COL['K'])
        line([(cross[0] + 0.045, cross[1] - 0.015), (cross[0] - 0.045, cross[1] + 0.022)], max(0.008 * bw, 0.5 * tx), COL['K'])
    # the centre shield: a gold ring round it over the bars, its ink edge, its gold field; the town's name as a dark line; the bull
    ringw = max(0.012 * bw, 0.45 * tx)
    cen = [P(*p) for p in CENTRE]
    ld.polygon(cen, fill=COL['G'], outline=COL['G'], width=max(1, int(round(ringw * 2))))
    ld.line(cen + [cen[0]], fill=COL['G'], width=max(1, int(round(ringw * 2 + max(0.008 * bw, 0.45 * tx) * 2))), joint='curve')
    ld.line(cen + [cen[0]], fill=COL['K'], width=max(1, int(round(max(0.009 * bw, 0.45 * tx)))), joint='curve')
    if C >= 32: line([(0.36, 0.372), (0.646, 0.372)], max(0.03 * bh, 0.55 * tx) if C >= 64 else 0.5 * tx, COL['K'])
    bull = [P(*p) for p in BULL]
    if C >= 64:
        ld.polygon(bull, fill=COL['K'])
        for h in HORNS: line(h, max(0.012 * bw, 0.6 * tx), COL['K'])
        line(TAIL, max(0.01 * bw, 0.5 * tx), COL['K'])
    else:   # a block of a body, the head down to the left, a horn up
        grow = (0.5 if C >= 32 else 0.35) * tx
        ld.polygon(bull, fill=COL['K'], outline=COL['K'], width=max(1, int(round(grow))))
        for h in HORNS[:1 if C < 32 else 2]: line(h, 0.6 * tx, COL['K'])
    img.paste(lay, (0, 0), inner)
    return np.asarray(img.reduce(SS))

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
