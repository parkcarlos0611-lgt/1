"""The customer at the kitchen table (review 53), from the planner's sheets: sitting (front, hands forward as on a table)
and drinking tea (front: hands on the knees, the cup lifted, drunk, put down).

    python3 tools/people/customer.py <sit sheet> <drink sheet>  ->  assets/people/customer_*.png, data/people/customer.json

Each frame is made solid or gone (the sheets' pixels are 253-254, their edges half-seen and fringed with red), cut to
its own box, and scaled so that, sat in the kitchen's chair, his hands rest on the table top and his feet stand on the
floor under it (the scale is fixed by those two: hands at y=TABLE, the soles at y=FLOOR in the kitchen picture).
"""
import sys, os, json
import numpy as np
from PIL import Image

root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
TABLE, FLOOR, CX = 194, 262, 231          # the kitchen: the table's top where hands rest, the floor under the chair, its middle
def frames(path, row_y, xs):
    a = np.asarray(Image.open(path).convert('RGBA')).astype(np.float32); out = []
    for x0, x1 in xs:
        f = a[row_y[0]:row_y[1], x0:x1].copy(); al = f[..., 3] >= 128
        red = (f[..., 0] > 120) & (f[..., 1] < 70) & (f[..., 2] < 70) & (f[..., 0] - f[..., 1] > 70)   # the red matting fringe
        edge = al & ~(np.roll(al, 1, 0) & np.roll(al, -1, 0) & np.roll(al, 1, 1) & np.roll(al, -1, 1))
        al &= ~(red & (edge | (np.roll(edge, 1, 1) | np.roll(edge, -1, 1))))
        f[..., 3] = np.where(al, 255, 0); out.append(f)
    return out
def box(f): ys, xs = np.nonzero(f[..., 3] > 0); return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
sit = frames(sys.argv[1], (0, 320), [(105, 290)])[0]
drink = frames(sys.argv[2], (0, 315), [(96, 250), (399, 552), (709, 855), (1006, 1161)])
# the sitting frame: where its hands rest (the lowest skin above the knees) and its soles
def skin(f): return (f[..., 0] > 150) & (f[..., 1] > 95) & (f[..., 1] < 180) & (f[..., 2] < 150) & (f[..., 0] - f[..., 2] > 40) & (f[..., 3] > 0)
x0, y0, x1, y1 = box(sit); sk = skin(sit); rows = [y for y in range(y0 + 120, y1 - 60) if sk[y].sum() > 3]
hand = max(rows) if rows else y0 + 165; sole = y1
scale = (FLOOR - TABLE) / (sole - hand)
def shrink(f, s):
    al = f[..., 3:4] / 255; pre = np.concatenate([f[..., :3] * al, f[..., 3:4]], 2); h, w = f.shape[:2]
    q = np.asarray(Image.fromarray(np.clip(pre, 0, 255).astype(np.uint8), 'RGBA').resize((max(1, round(w * s)), max(1, round(h * s))), Image.BOX)).astype(np.float32); A = q[..., 3:4]
    rgb = np.where(A > 0, q[..., :3] / np.maximum(A, 1) * 255, 0); return np.concatenate([np.clip(rgb, 0, 255), np.where(A >= 120, 255, 0)], 2).astype(np.uint8)
meta = {'scale': round(scale, 4), 'frames': {}}
def put(name, f):
    bx0, by0, bx1, by1 = box(f); cx = (bx0 + bx1) / 2; g = shrink(f[by0:by1, bx0:bx1], scale)
    Image.fromarray(g, 'RGBA').save(os.path.join(root, 'assets', 'people', f'customer_{name}.png'), optimize=True)
    meta['frames'][name] = {'at': [round(CX - g.shape[1] / 2), round(FLOOR - g.shape[0])], 'size': [g.shape[1], g.shape[0]]}
put('sit', sit)
for k, f in enumerate(drink): put(f'drink{k}', f)
# where the cup is held in the drinking frames (the raised hand: skin above the shoulders' line, away from the face)
for k in (1, 2):
    f = drink[k]; bx0, by0, bx1, by1 = box(f); sk = skin(f); mid = (bx0 + bx1) / 2
    ys, xs = np.nonzero(sk[by0:by0 + 150]); ys = ys + by0
    far = np.abs(xs - mid) > 10 if k == 1 else ys > by0 + 52
    hy, hx = ys[far].mean(), xs[far].mean(); fr = meta['frames'][f'drink{k}']
    meta['frames'][f'drink{k}']['hand'] = [round(fr['at'][0] + (hx - bx0) * scale, 1), round(fr['at'][1] + (hy - by0) * scale, 1)]
os.makedirs(os.path.join(root, 'data', 'people'), exist_ok=True)
json.dump(meta, open(os.path.join(root, 'data', 'people', 'customer.json'), 'w'), indent=1); print(json.dumps(meta))
