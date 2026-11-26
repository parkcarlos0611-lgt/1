"""The directory's cover (review 51): the planner's picture with its own wording and the Bell System's emblem taken off
(the game prints a cover of its own, in the period's wording, over the paper), the border, the corner ornaments, the
engraving of a telephone and a book, and the old slogan "Where to buy it" kept.

    python3 tools/places/cover.py <cover.png>  ->  assets/places/phone/cover.png (the book only, half size)
"""
import sys, os
import numpy as np
from PIL import Image

root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
a = np.asarray(Image.open(sys.argv[1]).convert('RGBA')).astype(np.float32)
a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
L = a[..., :3].mean(2); ink = L < 150
ERASE = [(250, 228, 840, 292), (236, 324, 866, 594), (296, 630, 796, 694), (424, 692, 700, 962)]
mask = np.zeros(L.shape, bool)
for x0, y0, x1, y1 in ERASE: mask[y0:y1, x0:x1] = True
clean = ~mask & ~ink & (a[..., 3] > 0)
def blur(x, r):
    k = np.exp(-0.5 * (np.arange(-3 * r, 3 * r + 1) / r) ** 2); k /= k.sum()
    x = np.apply_along_axis(lambda v: np.convolve(v, k, 'same'), 0, x); return np.apply_along_axis(lambda v: np.convolve(v, k, 'same'), 1, x)
# the paper's fine grain, measured on clean paper: its spread from the local mean
cl = clean.astype(np.float32); loc = np.stack([blur(a[..., c] * cl, 3) / (blur(cl, 3) + 1e-4) for c in range(3)], 2)
hp = (a[..., :3] - loc)[clean & (blur(cl, 3) > 0.95)]; sd = hp.std(0); print('grain', sd.round(1))
paper = a[..., :3][clean].mean(0)
rng = np.random.RandomState(3)
for x0, y0, x1, y1 in ERASE:
    def side(x_from, x_to, y):   # the clean paper just beside the box on this row
        xs_ = [x for x in range(min(x_from, x_to), max(x_from, x_to)) if clean[y, x]]
        return a[y, xs_, :3].mean(0) if xs_ else None
    rows = []
    for y in range(y0, y1):
        lc = side(x0 - 26, x0, y); rc = side(x1, x1 + 26, y); lc = lc if lc is not None else rc; rc = rc if rc is not None else lc
        if lc is None: lc = rc = paper
        rows.append((lc, rc))
    rows = np.array(rows, np.float32); k = np.ones(15) / 15
    rows = np.stack([np.stack([np.convolve(np.pad(rows[:, s_, c], 7, mode='edge'), k, 'valid') for c in range(3)], 1) for s_ in range(2)], 1)
    for y in range(y0, y1):
        lc, rc = rows[y - y0]; f = ((np.arange(x0, x1) - x0) / max(1, x1 - x0 - 1))[:, None]
        a[y, x0:x1, :3] = lc * (1 - f) + rc * f + rng.randn(x1 - x0, 3) * sd * 0.9
ys, xs = np.nonzero(a[..., 3] > 0); a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA'); im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
im.save(os.path.join(root, 'assets', 'places', 'phone', 'cover.png'), optimize=True); print('ok', im.size)
