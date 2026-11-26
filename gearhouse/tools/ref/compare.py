"""Set each traced car beside its source: the source reduced to the game's scale, the materials found, the game's drawing.
  python3 tools/ref/compare.py <dir> <out.png> id:length ..."""
import sys, cv2, numpy as np
d, out, items = sys.argv[1], sys.argv[2], [a.split(':') for a in sys.argv[3:]]; K = 3; BG = (184, 205, 214); rows = []
def onbg(img, k=K):
    if img.shape[2] == 3: img = np.dstack([img, np.full(img.shape[:2], 255, np.uint8)])
    a = (img[..., 3:4] > 110).astype(np.float32); rgb = (img[..., :3] * a + np.array(BG) * (1 - a)).astype(np.uint8)
    return cv2.resize(rgb, (rgb.shape[1] * k, rgb.shape[0] * k), interpolation=cv2.INTER_NEAREST)
for cid, length in items:
    src = cv2.imread(f'{d}/{cid}_source.png', cv2.IMREAD_UNCHANGED); w = round(int(length) / 12.5); small = cv2.resize(src, (w, round(src.shape[0] * w / src.shape[1])), interpolation=cv2.INTER_AREA)
    mat = cv2.resize(cv2.imread(f'{d}/{cid}_materials.png'), (small.shape[1], small.shape[0]), interpolation=cv2.INTER_NEAREST); game = cv2.imread(f'{d}/{cid}_game.png', cv2.IMREAD_UNCHANGED)
    parts = [onbg(small), cv2.resize(mat, (mat.shape[1] * K, mat.shape[0] * K), interpolation=cv2.INTER_NEAREST), onbg(game)]; H = max(p.shape[0] for p in parts)
    parts = [cv2.copyMakeBorder(p, H - p.shape[0], 0, 0, 16, cv2.BORDER_CONSTANT, value=BG) for p in parts]; rows.append(np.hstack(parts))
W = max(r.shape[1] for r in rows); rows = [cv2.copyMakeBorder(r, 14, 14, 0, W - r.shape[1], cv2.BORDER_CONSTANT, value=BG) for r in rows]; cv2.imwrite(out, np.vstack(rows))
