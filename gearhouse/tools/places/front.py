"""The house front, windows made symmetrical (review 44).

    python3 tools/places/front.py <front.png> <preview.png>  ->  assets/places/front/{front,regions}.png (480x270)

In the planner's picture the two right windows stand clear of the porch's right post, but the two left windows are
pushed towards the door: the second one covers the left post. They are moved left to mirror the right pair about the
door's centre line; where they stood, the wall is put back: the clapboards from the same row of clear wall to the left
(the boards run across, so a row's own boards fill it), and the post from the post's own pixels above the window (it
runs up and down: its clear stretch below the window, one colour a column).
"""
import sys, os
import numpy as np
from PIL import Image

root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
a = np.asarray(Image.open(sys.argv[1]).convert('RGB')).copy()
AXIS = 595.5                        # the door's centre line (door 556..635, porch posts 495..508 and 680..695)
Y0, Y1 = 350, 515                   # the windows with their sills
LEFT = [(264, 378), (401, 518)]     # the left windows as painted (trim to trim)
RIGHT = [(723, 836), (862, 976)]    # the right windows
POST = (495, 509)
SIDING = (199, 259)                 # clear clapboard left of the first window, rows Y0..Y1
patches = [a[Y0:Y1, x0:x1].copy() for x0, x1 in LEFT]
post = np.median(a[Y1 + 2:Y1 + 50, POST[0]:POST[1]], axis=0).astype(np.uint8)   # the post, clear below the window
for x0, x1 in LEFT:                 # the wall put back
    for y in range(Y0, Y1):
        for x in range(x0 - 2, x1 + 2):
            if POST[0] <= x < POST[1]: a[y, x] = post[x - POST[0]]
            else: a[y, x] = a[y, SIDING[0] + (x - SIDING[0]) % (SIDING[1] - SIDING[0])]
for (x0, x1), (r0, r1), p in zip(LEFT, reversed(RIGHT), patches):
    nx0 = int(round(2 * AXIS - r1)); a[Y0:Y1, nx0:nx0 + (x1 - x0)] = p
    print('window', (x0, x1), '->', (nx0, nx0 + x1 - x0), 'mirror of', (r0, r1))
out = os.path.join(root, 'assets', 'places', 'front'); os.makedirs(out, exist_ok=True)
im = Image.fromarray(a); small = im.resize((480, 270), Image.BOX); small.save(os.path.join(out, 'front.png'), optimize=True)

# --- what every pixel is (review 45): the sky (the game draws its own), the far woods, the tree (it sways), the roofs
# (snow lies on them), the window glass (lit at night), the street lamp's lantern, the lawn, the paths, the road
import json
D = json.load(open(os.path.join(root, 'data', 'places', 'front.json'))); ID = D['regionId']
b = np.asarray(small).astype(np.int32); Hh, Ww = 270, 480; R_, G_, B_ = b[..., 0], b[..., 1], b[..., 2]; L_ = b.sum(2) / 3
reg = np.full((Hh, Ww), ID['house'], np.uint8)
skyish = (B_ >= R_ + 10) & (L_ > 128)
sky = np.zeros((Hh, Ww), bool); sky[0] = skyish[0]
for y in range(1, D['skyBottom']):                       # the sky: sky-coloured and joined to the top of the picture
    row = skyish[y] & (sky[y - 1] | np.roll(sky[y - 1], 1) | np.roll(sky[y - 1], -1))
    for _ in range(Ww):                                   # spread sideways along the row
        grow = skyish[y] & (np.roll(row, 1) | np.roll(row, -1)) & ~row
        if not grow.any(): break
        row |= grow
    sky[y] = row
x0, y0, x1, y1 = D['treeBox']; tree = np.zeros((Hh, Ww), bool); tree[y0:y1, x0:x1] = ~sky[y0:y1, x0:x1] & ((G_[y0:y1, x0:x1] >= B_[y0:y1, x0:x1] + 8) | (L_[y0:y1, x0:x1] > 170))
for bx0, by0, bx1, by1 in D['notTree']: tree[by0:by1, bx0:bx1] = False
tx0, ty0, tx1, ty1 = D['trunk']; tree[ty0:ty1, tx0:tx1] |= ~sky[ty0:ty1, tx0:tx1]
far = np.zeros((Hh, Ww), bool); fy0, fy1 = D['farRows']; far[fy0:fy1] = ~sky[fy0:fy1] & (B_[fy0:fy1] >= R_[fy0:fy1] - 4) & (L_[fy0:fy1] < 140)
for bx0, by0, bx1, by1 in D['notFar']: far[by0:by1, bx0:bx1] = False
for name, boxes in D['paint'].items():
    for bx0, by0, bx1, by1 in boxes: reg[by0:by1, bx0:bx1] = ID[name]
for bx0, by0, bx1, by1 in D['glass']:                     # the panes inside each window
    rr, gg, bb, ll = R_[by0:by1, bx0:bx1], G_[by0:by1, bx0:bx1], B_[by0:by1, bx0:bx1], L_[by0:by1, bx0:bx1]
    m = ~((rr - bb > 25) & (ll > 70)) & (ll < D['glassBright'])                       # all of each pane: not the shutters, not the bars
    for _ in range(2):                                                                  # stray specks of reflection: filled
        n = np.zeros(m.shape, np.int32); n[1:] += m[:-1]; n[:-1] += m[1:]; n[:, 1:] += m[:, :-1]; n[:, :-1] += m[:, 1:]; m = m | (n >= 3)
    reg[by0:by1, bx0:bx1][m] = ID['glass']
reg[far] = ID['far']; reg[tree] = ID['tree']; reg[sky] = ID['sky']
Image.fromarray(np.stack([reg] * 3, 2).astype(np.uint8)).save(os.path.join(out, 'regions.png'), optimize=True)
im.crop((150, 100, 1100, 620)).save(sys.argv[2])
print('ok')
