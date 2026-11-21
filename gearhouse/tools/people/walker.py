"""The customer walking (review 57): the planner's walking sheet, four ways (towards us, away, left, right) four steps
each, made solid (no half-seen or red fringe), each frame cut to its box and set on a common baseline, 64 px tall
(the game scales it by the depth of the ground it stands on: 62 px on the pavement, less up the path).

    python3 tools/people/walker.py <walk sheet>  ->  assets/people/walk.png (a strip), data/people/walk.json
"""
import sys, os, json
import numpy as np
from PIL import Image
root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
a = np.asarray(Image.open(sys.argv[1]).convert('RGBA')).astype(np.float32)
ROWS = {'down': (20, 360), 'up': (375, 720), 'left': (735, 1075), 'right': (1090, 1430)}
H = 64; frames = []; meta = {}
for name, (y0, y1) in ROWS.items():
    band = a[y0:y1]; al = band[..., 3] >= 128; cols = al.any(0); runs, s = [], None
    for x, c in enumerate(list(cols) + [False]):
        if c and s is None: s = x
        if not c and s is not None:
            if x - s > 40: runs.append((s, x))
            s = None
    for k, (x0, x1) in enumerate(runs[:4]):
        f = band[:, x0:x1].copy(); m = f[..., 3] >= 128
        red = (f[..., 0] > 120) & (f[..., 1] < 75) & (f[..., 2] < 75) & (f[..., 0] - f[..., 1] > 65); m &= ~red
        ys, xs = np.nonzero(m); f = f[ys.min():ys.max() + 1, xs.min():xs.max() + 1]; m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        f[..., 3] = np.where(m, 255, 0); frames.append((name, k, f))
top = max(f.shape[0] for _, _, f in frames); sc = H / top   # the tallest frame (hat to sole) is H px
out = []
for name, k, f in frames:
    pre = np.concatenate([f[..., :3] * (f[..., 3:4] / 255), f[..., 3:4]], 2); w, h = max(1, round(f.shape[1] * sc)), max(1, round(f.shape[0] * sc))
    q = np.asarray(Image.fromarray(np.clip(pre, 0, 255).astype(np.uint8), 'RGBA').resize((w, h), Image.BOX)).astype(np.float32); A = q[..., 3:4]
    rgb = np.where(A > 0, q[..., :3] / np.maximum(A, 1) * 255, 0); out.append((name, k, np.concatenate([np.clip(rgb, 0, 255), np.where(A >= 110, 255, 0)], 2).astype(np.uint8)))
W = sum(g.shape[1] + 2 for *_, g in out); strip = np.zeros((H + 2, W, 4), np.uint8); x = 0
for name, k, g in out:
    strip[H + 2 - g.shape[0] - 1:H + 1, x:x + g.shape[1]] = g; meta[f'{name}{k}'] = [x, H + 1 - g.shape[0], g.shape[1], g.shape[0]]; x += g.shape[1] + 2
Image.fromarray(strip, 'RGBA').save(os.path.join(root, 'assets', 'people', 'walk.png'), optimize=True)
json.dump({'h': H, 'strip': [W, H + 2], 'frames': meta}, open(os.path.join(root, 'data', 'people', 'walk.json'), 'w'), indent=1); print(W, len(meta))
