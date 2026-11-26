"""The customer's tea cup and saucer (review 60), drawn clean in the kitchen picture's style: the cup cut from the
reference carried wisps of painted steam and threads of the table cloth, which went up with it to his mouth. China
lit from the window side (left), a thin brown band under the rim, tea inside, the handle on the right; the saucer under
it. The bottom SAUCER rows are the saucer: the cup alone (rows above) goes up in his hand.

    python3 tools/people/teacup.py  ->  assets/people/teacup.png (24 x 14)
"""
import os
import numpy as np
from PIL import Image
root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
W, H, SAUCER = 24, 14, 5
a = np.zeros((H, W, 4), np.uint8)
def px(x, y, c): a[y, x] = (*c, 255)
lerp = lambda p, q, t: tuple(int(round(p[k] + (q[k] - p[k]) * t)) for k in range(3))
# the saucer: a flat ellipse, its top face lit, its rim and underside darker
cx, cy = 11.5, 10.6
for y in range(H - SAUCER, H):
    for x in range(W):
        q = ((x - cx) / 11.2) ** 2 + ((y - cy) / 2.7) ** 2
        if q > 1: continue
        t = (x - 1) / (W - 2)
        top = lerp((226, 220, 206), (168, 160, 148), t)
        if y >= 12: top = lerp((150, 142, 130), (112, 104, 96), t)
        if y == H - 1: top = lerp((118, 110, 100), (92, 86, 80), t)
        px(x, y, top)
# the cup: a slightly tapered bowl
for y in range(1, 10):
    taper = 0 if y < 7 else (1 if y < 9 else 2)
    x0, x1 = 5 + taper, 17 - taper
    for x in range(x0, x1 + 1):
        t = (x - x0) / max(1, x1 - x0)
        c = lerp((244, 238, 224), (166, 158, 146), t ** 0.9)
        if y == 3: c = lerp((176, 128, 98), (120, 86, 66), t)          # the brown band under the rim
        if x == x0 or x == x1: c = lerp(c, (120, 112, 104), 0.35)      # the bowl's edge
        px(x, y, c)
# the rim and the tea inside it
for x in range(5, 18):
    t = (x - 5) / 12
    px(x, 1, lerp((250, 248, 240), (196, 188, 176), t))
    if 6 <= x <= 16: px(x, 2, lerp((104, 64, 40), (74, 44, 28), t))
px(5, 2, (226, 220, 208)); px(17, 2, (180, 172, 160))
# the handle: a small ring on the right, the hole open
for (x, y) in [(18, 3), (19, 3), (20, 4), (20, 5), (20, 6), (19, 7), (18, 7)]: px(x, y, (178, 170, 158))
px(19, 4, (0, 0, 0)); a[4, 19, 3] = 0
Image.fromarray(a, 'RGBA').save(os.path.join(root, 'assets', 'people', 'teacup.png'))
print('teacup', W, H)
