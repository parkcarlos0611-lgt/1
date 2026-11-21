"""The comparison sheet for the conversion trial (review 62): for each view (side, front, rear, plan) the planner's
sheet, then each model as the game draws it, scaled to the sheet's view, then where each model's outline differs from
the sheet's (red: the model has paint where the sheet has none; blue: the sheet has car where the model has none), and
the score (share of the silhouette that agrees, and how much of the model's panel edges lie on a line of the drawing).

  python3 tools/ref/autocmp.py <views dir> <out png> <label=modelviews dir> [...]
"""
import sys, os, json, cv2, numpy as np
VD, OUT = sys.argv[1], sys.argv[2]; models = [a.split('=', 1) for a in sys.argv[3:]]
VIEWS = [('left', 'side'), ('front', 'front'), ('rear', 'rear'), ('top', 'top')]
K = 3; BG = np.array([226, 226, 222], np.float32)


def crop_alpha(im):
    a = im[..., 3] > 127; ys, xs = np.where(a)
    return im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def on_bg(im):
    a = im[..., 3:4] / 255.0; return (im[..., :3] * a + BG * (1 - a)).astype(np.uint8)


def label(img, text):
    cv2.putText(img, text, (4, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (20, 20, 20), 1, cv2.LINE_AA); return img


rows = []; scores = {}
for vname, key in VIEWS:
    src = cv2.imread(f'{VD}/v_{vname}.png', cv2.IMREAD_UNCHANGED); src = crop_alpha(src); h, w = src.shape[:2]
    sa = src[..., 3] > 127; edges = cv2.Canny(cv2.cvtColor(src[..., :3], cv2.COLOR_BGR2GRAY), 50, 120) > 0
    near = cv2.dilate(edges.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    cells = [label(cv2.resize(on_bg(src), (w * K, h * K), interpolation=cv2.INTER_NEAREST), 'sheet')]
    for lab, d in models:
        mid = [f for f in os.listdir(d) if f.endswith(f'_{vname}_flat.png') and 'chassis' not in f][0]
        im = crop_alpha(cv2.imread(f'{d}/{mid}', cv2.IMREAD_UNCHANGED)); im = cv2.resize(im, (w, h), interpolation=cv2.INTER_AREA); ma = im[..., 3] > 127
        iou = (sa & ma).sum() / max(1, (sa | ma).sum())
        me = cv2.Canny(cv2.cvtColor(im[..., :3], cv2.COLOR_BGR2GRAY), 50, 120) > 0; on = (me & near).sum() / max(1, me.sum())
        scores.setdefault(lab, {})[key] = {'silhouette': round(float(iou), 3), 'edges_on_lines': round(float(on), 3)}
        cells.append(label(cv2.resize(on_bg(im), (w * K, h * K), interpolation=cv2.INTER_NEAREST), f'{lab}  sil {iou:.2f}  lines {on:.2f}'))
        diff = np.full((h, w, 3), 245, np.uint8); diff[sa & ma] = (190, 190, 190); diff[ma & ~sa] = (40, 40, 220); diff[sa & ~ma] = (220, 120, 30)
        cells.append(label(cv2.resize(diff, (w * K, h * K), interpolation=cv2.INTER_NEAREST), f'{lab} vs sheet'))
    H = max(c.shape[0] for c in cells); row = np.full((H + 6, sum(c.shape[1] + 6 for c in cells), 3), 255, np.uint8); x = 0
    for c in cells: row[:c.shape[0], x:x + c.shape[1]] = c; x += c.shape[1] + 6
    rows.append(row)
Wd = max(r.shape[1] for r in rows); sheet = np.full((sum(r.shape[0] for r in rows), Wd, 3), 255, np.uint8); y = 0
for r in rows: sheet[y:y + r.shape[0], :r.shape[1]] = r; y += r.shape[0]
cv2.imwrite(OUT, sheet); json.dump(scores, open(OUT.rsplit('.', 1)[0] + '.json', 'w'), indent=1); print(json.dumps(scores))
