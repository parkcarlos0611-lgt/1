#!/usr/bin/env python3
"""Cut the US base props used by the firing-range map from assets/ref/us_base_props.png:
barracks, GP Medium tent, sandbag position, HESCO wall, concrete T-wall, supplies under a camouflage net.
The white page and the pale ground smear under each drawing are removed (flood fill from the crop border).
Outputs assets/sprites/props/<name>.png + props.json (pixel sizes).
usage: python3 tools/cut_props.py
"""
import os, json
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/sprites/props'); os.makedirs(OUT, exist_ok=True)
SRC = Image.open(os.path.join(ROOT, 'assets/ref/us_base_props.png')).convert('RGB')

# name: (x0, y0, x1, y1) in the sheet. The bottom edge is the line the object stands on.
BOXES = {
    'barracks': (8, 200, 428, 343),
    'tent':     (752, 440, 1100, 598),
    'sandbag':  (20, 832, 296, 934),
    'hesco':    (306, 838, 560, 930),
    'twall':    (566, 850, 792, 930),
    'supply':   (72, 978, 548, 1076),
}

NET = {'sandbag': 0.5, 'supply': 0.45}

def flood(im, thr):
    pale = im.min(axis=2) > thr
    reg = np.zeros_like(pale); reg[0], reg[-1], reg[:, 0], reg[:, -1] = pale[0], pale[-1], pale[:, 0], pale[:, -1]
    while True:
        d = reg.copy(); d[1:] |= reg[:-1]; d[:-1] |= reg[1:]; d[:, 1:] |= reg[:, :-1]; d[:, :-1] |= reg[:, 1:]; d &= pale
        if (d == reg).all(): break
        reg = d
    return reg

SIGNS = Image.open(os.path.join(ROOT, 'assets/ref/range_signs.png')).convert('RGB')
SBOX = {'s_range': (14, 12, 500, 448), 's_danger': (520, 86, 846, 448), 's_warning': (868, 100, 1150, 448), 's_lane': (1172, 100, 1434, 448)}
for i, x in enumerate(((20, 266), (318, 568), (604, 856), (894, 1144), (1188, 1438))): SBOX['s_%d' % (500 * (i + 1))] = (x[0], 498, x[1], 764)
for i, x in enumerate(((92, 350), (420, 684), (750, 1016), (1086, 1354))): SBOX['s_%d' % (3000 + 500 * i)] = (x[0], 796, x[1], 1072)
info = {}
for name, box in list(BOXES.items()) + list(SBOX.items()):
    sign = name in SBOX
    im = np.asarray((SIGNS if sign else SRC).crop(box)).astype(np.int16)
    bg = flood(im, 236 if sign else 168)
    # white page enclosed by the drawing (under a net, between guy lines): every white patch bigger than a
    # few dozen pixels goes too; small white details (air-conditioner grilles, highlights) stay
    white = (im.min(axis=2) > (250 if sign else 232)) & ~bg
    seen = np.zeros_like(white)
    for y, x in zip(*np.nonzero(white)):
        if seen[y, x]: continue
        st, comp = [(y, x)], []; seen[y, x] = True
        while st:
            cy, cx = st.pop(); comp.append((cy, cx))
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < white.shape[0] and 0 <= nx < white.shape[1] and white[ny, nx] and not seen[ny, nx]: seen[ny, nx] = True; st.append((ny, nx))
        if len(comp) > 60:
            for cy, cx in comp: bg[cy, cx] = True
    if name in NET:                      # holes in a camouflage net: every near-white speck in the net band goes
        band = np.zeros_like(bg); band[:int(im.shape[0] * NET[name])] = True
        bg |= band & (im.min(axis=2) > 200) & ((im.max(axis=2) - im.min(axis=2)) < 40)
    d = bg.copy(); d[1:] |= bg[:-1]; d[:-1] |= bg[1:]; d[:, 1:] |= bg[:, :-1]; d[:, :-1] |= bg[:, 1:]
    bg = bg | (d & (im.min(axis=2) > (225 if sign else 150)))                                       # eat the pale fringe
    a = np.where(bg, 0, 255).astype(np.uint8)
    rgba = np.dstack([im.astype(np.uint8), a])
    ys, xs = np.nonzero(a); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    Image.fromarray(rgba[y0:y1, x0:x1]).save(os.path.join(OUT, name + '.png'))
    info[name] = {'w': int(x1 - x0), 'h': int(y1 - y0)}
json.dump(info, open(os.path.join(OUT, 'props.json'), 'w'), indent=1)
print(info)

# road texture: the four asphalt tiles of assets/ref/asphalt_tiles.jpg joined into one strip that repeats
# (neighbouring tiles cross-faded over 24 px, the last into the first)
T = np.asarray(Image.open(os.path.join(ROOT, 'assets/ref/asphalt_tiles.jpg')).convert('RGB')).astype(np.float32)
tiles = [T[16:114, x:x + 200] for x in (44, 278, 520, 760)]
m0 = tiles[0].mean(axis=(0, 1))
tiles = [t * (m0 / t.mean(axis=(0, 1))) for t in tiles]          # same overall tone, so the joins do not show as steps
order = [0, 1, 0, 2, 0, 3]; B = 40
tiles = [tiles[i] if k % 2 == 0 else tiles[i] for k, i in enumerate(order)]
tiles[2] = tiles[2][:, ::-1]; tiles[4] = tiles[4][::-1]
out = []
for k, t in enumerate(tiles):
    nx = tiles[(k + 1) % len(tiles)]
    w = np.linspace(0, 1, B)[None, :, None]
    body = t[:, :200 - B].copy(); body_tail = t[:, 200 - B:] * (1 - w) + nx[:, :B] * w
    out.append(np.concatenate([body[:, B:] if k else body[:, B:], body_tail], axis=1))
road = np.concatenate(out, axis=1)
Image.fromarray(road.clip(0, 255).astype(np.uint8)).save(os.path.join(OUT, 'road.png'))
print('road', road.shape)
