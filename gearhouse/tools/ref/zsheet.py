"""Lay the pictures of tools/ref/ztest.ts side by side, Y left and Z right, three times game size.
python3 tools/ref/zsheet.py <dir> <out png> name:label ..."""
import sys, cv2, numpy as np
d, out, rows = sys.argv[1], sys.argv[2], [a.split(':', 1) for a in sys.argv[3:]]; BG = (184, 205, 214); K = 3; acc = []
def load(p):
    im = cv2.imread(p, cv2.IMREAD_UNCHANGED); a = im[..., 3:4].astype(np.float32) / 255; rgb = (im[..., :3] * a + np.array(BG) * (1 - a)).astype(np.uint8); return cv2.resize(rgb, None, fx=K, fy=K, interpolation=cv2.INTER_NEAREST)
for name, label in rows:
    a, b = load(f'{d}/y_{name}.png'), load(f'{d}/z_{name}.png'); H = max(a.shape[0], b.shape[0]); W = max(a.shape[1], b.shape[1])
    fit = lambda m: cv2.copyMakeBorder(m, 44 + H - m.shape[0], 16, 16, 16 + W - m.shape[1], cv2.BORDER_CONSTANT, value=BG); row = np.hstack([fit(a), fit(b)])
    cv2.putText(row, f'Y  {label}', (16, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (40, 40, 40), 2, cv2.LINE_AA); cv2.putText(row, f'Z  {label}', (W + 48, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (40, 40, 40), 2, cv2.LINE_AA); acc.append(row)
W = max(r.shape[1] for r in acc); cv2.imwrite(out, np.vstack([cv2.copyMakeBorder(r, 0, 0, 0, W - r.shape[1], cv2.BORDER_CONSTANT, value=BG) for r in acc])); print(out)
