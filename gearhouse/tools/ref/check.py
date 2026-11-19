"""How far a drawn body is from its reference sheet: silhouette overlap and mean outline error in mm, with
side-by-side sheets at 3x and at game size. python3 tools/ref/check.py <sheet dir> <drawn dir> <out dir> id:source_id:length ..."""
import sys, cv2, numpy as np
src_dir, drawn_dir, out_dir, items = sys.argv[1], sys.argv[2], sys.argv[3], [a.split(':') for a in sys.argv[4:]]
MM = 10; BG = (184, 205, 214); rows = {3: [], 1: []}
def onbg(img, K):
    a = img[..., 3:4].astype(np.float32) / 255; rgb = (img[..., :3] * a + np.array(BG) * (1 - a)).astype(np.uint8); return cv2.resize(rgb, (rgb.shape[1] * K, rgb.shape[0] * K), interpolation=cv2.INTER_NEAREST)
for cid, sid, L in items:
    s = cv2.imread(f'{src_dir}/{sid}_source.png', cv2.IMREAD_UNCHANGED); w = round(int(L) / MM); sm = cv2.resize(s, (w, round(s.shape[0] * w / s.shape[1])), interpolation=cv2.INTER_AREA); sm[..., 3] = np.where(sm[..., 3] > 110, 255, 0)
    f = cv2.imread(f'{drawn_dir}/{cid}_flat.png', cv2.IMREAD_UNCHANGED); ms = sm[..., 3] > 110; mg = f[..., 3] > 200
    ys, xs = np.where(mg); ys2, xs2 = np.where(ms); H = max(ms.shape[0], mg.shape[0]) + 4; Wd = max(ms.shape[1], mg.shape[1]) + 8; A = np.zeros((H, Wd), bool); B = np.zeros((H, Wd), bool)
    A[H - 1 - ys2.max() + ys2, xs2 - xs2.min() + 2] = True; B[H - 1 - ys.max() + ys, xs - xs.min() + 2] = True
    da = cv2.distanceTransform((~(cv2.Canny(A.astype(np.uint8) * 255, 50, 150) > 0)).astype(np.uint8), cv2.DIST_L2, 3); eb = cv2.Canny(B.astype(np.uint8) * 255, 50, 150) > 0
    print(f'{cid}: overlap {(A & B).sum() / (A | B).sum():.3f}, mean outline error {da[eb].mean() * MM:.0f} mm, drawn {np.ptp(xs) + 1}x{np.ptp(ys) + 1} px, sheet {np.ptp(xs2) + 1}x{np.ptp(ys2) + 1} px')
    for K in rows:
        a, b = onbg(sm, K), onbg(f, K); Hh = max(a.shape[0], b.shape[0]); rows[K].append(np.hstack([cv2.copyMakeBorder(a, Hh - a.shape[0] + 12, 12, 12, 12, cv2.BORDER_CONSTANT, value=BG), cv2.copyMakeBorder(b, Hh - b.shape[0] + 12, 12, 12, 12, cv2.BORDER_CONSTANT, value=BG)]))
for K, acc in rows.items():
    W = max(r.shape[1] for r in acc); cv2.imwrite(f'{out_dir}/samples_{K}x.png', np.vstack([cv2.copyMakeBorder(r, 0, 0, 0, W - r.shape[1], cv2.BORDER_CONSTANT, value=BG) for r in acc]))
