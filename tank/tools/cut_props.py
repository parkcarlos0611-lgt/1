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

def flood(im, thr):
    pale = im.min(axis=2) > thr
    reg = np.zeros_like(pale); reg[0], reg[-1], reg[:, 0], reg[:, -1] = pale[0], pale[-1], pale[:, 0], pale[:, -1]
    while True:
        d = reg.copy(); d[1:] |= reg[:-1]; d[:-1] |= reg[1:]; d[:, 1:] |= reg[:, :-1]; d[:, :-1] |= reg[:, 1:]; d &= pale
        if (d == reg).all(): break
        reg = d
    return reg

info = {}
for name, box in BOXES.items():
    im = np.asarray(SRC.crop(box)).astype(np.int16)
    bg = flood(im, 168)
    # white page enclosed by the drawing (under a net, between guy lines): every white patch bigger than a
    # few dozen pixels goes too; small white details (air-conditioner grilles, highlights) stay
    white = (im.min(axis=2) > 232) & ~bg
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
    d = bg.copy(); d[1:] |= bg[:-1]; d[:-1] |= bg[1:]; d[:, 1:] |= bg[:, :-1]; d[:, :-1] |= bg[:, 1:]
    bg = bg | (d & (im.min(axis=2) > 150))                                       # eat the pale fringe
    a = np.where(bg, 0, 255).astype(np.uint8)
    rgba = np.dstack([im.astype(np.uint8), a])
    ys, xs = np.nonzero(a); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    Image.fromarray(rgba[y0:y1, x0:x1]).save(os.path.join(OUT, name + '.png'))
    info[name] = {'w': int(x1 - x0), 'h': int(y1 - y0)}
json.dump(info, open(os.path.join(OUT, 'props.json'), 'w'), indent=1)
print(info)
