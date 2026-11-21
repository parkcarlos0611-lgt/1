"""The telephone desk taken apart (review 47).

    python3 tools/places/phone.py <desk-scene.png> <phone-parts.png>  ->  assets/places/phone/*.png, data/places/phone_cut.json

The planner's scene (a desk, a telephone, an open directory with blank pages) gives the desk and the book; the parts
sheet (body, handset with its cord, finger wheel, all on transparent ground) gives a telephone that moves. The scene's
own telephone is taken off the desk: the desk's grain runs across, so the clear bands of desk above and below it are
laid over that part of the desk again (bands shifted so no two look alike, their seams blended). The parts are scaled
to the scene's telephone: the body to its width; the wheel so its rim sits on the body's silver ring (the parts sheet
draws the wheel larger than the body's ring). The wheel is kept at three times the screen's scale, so the game can
turn it smoothly. All screen pieces at 480x270.
"""
import sys, os, json
import numpy as np
from PIL import Image

root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
out = os.path.join(root, 'assets', 'places', 'phone'); os.makedirs(out, exist_ok=True)
scene = Image.open(sys.argv[1]).convert('RGB'); parts = Image.open(sys.argv[2]).convert('RGBA')
W, H = 480, 270; k = W / scene.width

# --- the desk, the scene's telephone taken off ---------------------------------------------------------------------
desk = np.asarray(scene.resize((W, H), Image.BOX)).astype(np.float32)
X1, TOP, BOT = 480, 17, 248                 # the whole desk between the clear bands: the telephone and the open book both go (the book lies closed now, and opens in a close view)
bands = [desk[0:TOP, :X1].copy(), desk[BOT:H, :X1].copy()]   # only desk: never the book's cover
rng = np.random.RandomState(4)
y = TOP
while y < BOT:
    b = bands[rng.randint(2)]; h = min(b.shape[0], BOT - y); sx = rng.randint(0, X1)
    piece = np.roll(b, -sx, axis=1)[:h, :X1]
    for r in range(h):
        f = min(1, r / 4) if y > TOP else 1                   # blend into the row above for four rows
        desk[y + r, :X1] = piece[r] * f + desk[y + r - 1, :X1] * (1 - f) if r < 4 and y > TOP else piece[r]
    y += h
# the light: the scene is lit from the upper left; keep the band rows' average brightness per row as painted
Image.fromarray(np.clip(desk, 0, 255).astype(np.uint8)).save(os.path.join(out, 'desk.png'), optimize=True)

# --- the parts --------------------------------------------------------------------------------------------------------
P = np.asarray(parts).astype(np.float32)
P[..., 3] = np.where(P[..., 3] >= 128, 255, 0)              # solid or gone: no half-seen fringe
def largest(mask):
    """the biggest joined piece of a mask (a neighbouring part that strays into the box is left out)"""
    lab = np.zeros(mask.shape, np.int32); best, bestn, n = 0, 0, 0
    for y0_, x0_ in zip(*np.nonzero(mask)):
        if lab[y0_, x0_]: continue
        n += 1; st = [(y0_, x0_)]; lab[y0_, x0_] = n; cnt = 0
        while st:
            y_, x_ = st.pop(); cnt += 1
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = y_ + dy, x_ + dx
                if 0 <= yy < mask.shape[0] and 0 <= xx < mask.shape[1] and mask[yy, xx] and not lab[yy, xx]: lab[yy, xx] = n; st.append((yy, xx))
        if cnt > bestn: best, bestn = n, cnt
    return lab == best
def piece(box, scale, name, keep=None, whole=False):
    x0, y0, x1, y1 = box; sub = P[y0:y1, x0:x1].copy()
    if keep is not None: sub[..., 3] = np.where(keep(sub), sub[..., 3], 0)
    if whole: sub[..., 3] = np.where(largest(sub[..., 3] > 0), sub[..., 3], 0)
    a = sub[..., 3:4] / 255
    pre = np.concatenate([sub[..., :3] * a, sub[..., 3:4]], 2)  # premultiplied, so the edge does not pick up the black
    w, h = max(1, round((x1 - x0) * scale)), max(1, round((y1 - y0) * scale))
    im = Image.fromarray(np.clip(pre, 0, 255).astype(np.uint8), 'RGBA').resize((w, h), Image.BOX)
    q = np.asarray(im).astype(np.float32); al = q[..., 3:4]
    rgb = np.where(al > 0, q[..., :3] / np.maximum(al, 1) * 255, 0); alpha = np.where(al[..., 0] >= 110, 255, 0)
    Image.fromarray(np.concatenate([np.clip(rgb, 0, 255), alpha[..., None]], 2).astype(np.uint8), 'RGBA').save(os.path.join(out, name + '.png'), optimize=True)
    return w, h

BODY = (41, 89, 800, 910); RING = (426, 536, 184)            # the body and its silver ring (centre, radius), parts px
WHEEL = (1247, 609, 232); HOLE_R = 177; HOLES = [0, -30, -60, -88, -117, -147, -177, 153, 122, 91]   # digits 1..9, 0
STOP = (495, 655, 565, 752)                                  # the finger stop, on the body
HANDSET = (842, 30, 1630, 334); SOCKET = (868, 150)          # the handset (its cord leaves the left cup here)
sB = 640 / 759 * k                                           # the body as wide as the scene's telephone
bx, by = 21.5 - BODY[0] * sB, 247 - BODY[3] * sB             # its feet where the scene's stood
body_wh = piece(BODY, sB, 'body', whole=True)   # without the bit of cord that lies beside it on the sheet
stop_wh = piece(STOP, sB, 'stop', lambda q: ~((q[..., 0] > 232) & (q[..., 1] > 190) & (q[..., 2] > 140)) & (q[..., :3].mean(2) > 48))   # the brass hook (and the ring under it), not the cream card nor the black body
ring = (bx + RING[0] * sB, by + RING[1] * sB, RING[2] * sB)
sW = ring[2] / WHEEL[2]; Z = 3                               # the wheel's rim on the ring; kept at three times
r = 274; wheel_wh = piece((WHEEL[0] - r, WHEEL[1] - r, WHEEL[0] + r, WHEEL[1] + r), sW * Z, 'wheel', whole=True)
sH = 187 / (HANDSET[2] - HANDSET[0]); handset_wh = piece(HANDSET, sH, 'handset')
# the cord's colours, from the parts sheet's braid
cord = P[200:700, 760:960]; cm = cord[..., 3] > 0; cols = cord[cm][:, :3]; lum = cols.mean(1)
dark, mid, light = [cols[(lum >= lo) & (lum < hi)].mean(0).round().tolist() for lo, hi in ((0, np.percentile(lum, 33)), (np.percentile(lum, 33), np.percentile(lum, 70)), (np.percentile(lum, 70), 256))]

# --- the book's pages (cream) and its spine, from the scene --------------------------------------------------------------
d = np.asarray(scene.resize((W, H), Image.BOX)).astype(int); R_, G_, B_ = d[..., 0], d[..., 1], d[..., 2]
cream = (R_ > 190) & (G_ > 160) & (B_ > 110); cream[:, :216] = False
rows = np.nonzero(cream.sum(1) > 60)[0]; colsx = np.nonzero(cream.sum(0) > 60)[0]
spine = int(colsx.min() + np.argmin(cream[rows.min():rows.max(), colsx.min():colsx.max()].sum(0)[40:-40]) + 40)
book = {'left': [int(colsx.min()), int(rows.min()), spine - 1, int(rows.max())], 'right': [spine + 2, int(rows.min()), int(colsx.max()), int(rows.max())], 'spine': spine}

# --- the open book, kept at the scene's full size for the close view (paper, gutter, page edges) ----------------------
BX0, BY0, BX1, BY1 = 745, 105, 1656, 846
full = np.asarray(scene).astype(int)[BY0:BY1, BX0:BX1]; Image.fromarray(full.astype(np.uint8)).save(os.path.join(out, 'book_open.jpg'), quality=90)
fc = (full[..., 0] > 190) & (full[..., 1] > 160) & (full[..., 2] > 110); frows = np.nonzero(fc.sum(1) > 200)[0]; fcols = np.nonzero(fc.sum(0) > 200)[0]
fspine = int(fcols.min() + 150 + np.argmin(fc[frows.min():frows.max(), fcols.min() + 150:fcols.max() - 150].sum(0)))
open_book = {'size': [BX1 - BX0, BY1 - BY0], 'left': [int(fcols.min()), int(frows.min()), fspine - 2, int(frows.max())], 'right': [fspine + 3, int(frows.min()), int(fcols.max()), int(frows.max())], 'spine': fspine}

cut = {'about': 'Made by tools/places/phone.py; screen pixels at 480x270.',
       'body': {'at': [round(bx + BODY[0] * sB, 2), round(by + BODY[1] * sB, 2)], 'size': body_wh},
       'stop': {'at': [round(bx + STOP[0] * sB, 2), round(by + STOP[1] * sB, 2)], 'size': stop_wh},
       'ring': [round(v, 2) for v in ring], 'wheel': {'size': wheel_wh, 'scale': Z, 'holeR': round(HOLE_R * sW, 2), 'hole': round(34 * sW, 2), 'holes': HOLES, 'stopAngle': 58},
       'handset': {'at': [24, 19], 'size': handset_wh, 'socket': [round(24 + (SOCKET[0] - HANDSET[0]) * sH, 1), round(19 + (SOCKET[1] - HANDSET[1]) * sH, 1)]},
       'cord': {'into': [round(bx + 60 * sB, 1), round(by + 620 * sB, 1)], 'dark': dark, 'mid': mid, 'light': light},
       'book': book, 'open': open_book}
json.dump(cut, open(os.path.join(root, 'data', 'places', 'phone_cut.json'), 'w'), indent=1)
print(json.dumps(cut))
