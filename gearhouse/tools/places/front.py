"""The house front, windows made symmetrical (review 44).

    python3 tools/places/front.py <front.png> <preview.png>  ->  assets/places/front/front.png (480x270)

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
im = Image.fromarray(a); im.resize((480, 270), Image.BOX).save(os.path.join(out, 'front.png'), optimize=True)
im.crop((150, 100, 1100, 620)).save(sys.argv[2])
print('ok')
