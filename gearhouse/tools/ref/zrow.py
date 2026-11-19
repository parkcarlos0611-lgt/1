"""Reference view and drawn cars in one column per car, three times game size, labelled.
python3 tools/ref/zrow.py <out png> <view png>:<length>:<drawn png>[,<drawn png>...]:<labels comma separated> ..."""
import sys, cv2, numpy as np
BG = np.array([184, 205, 214]); K = 3; rows = []
def on(im): a = im[..., 3:4] / 255; return (im[..., :3] * a + BG * (1 - a)).astype(np.uint8)
for spec in sys.argv[2:]:
    src, L, drawn, labels = spec.split(':'); s = cv2.imread(src, cv2.IMREAD_UNCHANGED); w = int(L) // 10; h = round(s.shape[0] * w / s.shape[1]); s = cv2.resize(s, (w, h), interpolation=cv2.INTER_AREA)
    ims = [on(s)] + [on((lambda g: g[g.shape[0] - 6 - h:g.shape[0] - 6, 6:6 + w])(cv2.imread(p, cv2.IMREAD_UNCHANGED))) for p in drawn.split(',')]
    for im, lab in zip(ims, ['view'] + labels.split(',')):
        big = cv2.copyMakeBorder(cv2.resize(im, None, fx=K, fy=K, interpolation=cv2.INTER_NEAREST), 34, 8, 8, 8, cv2.BORDER_CONSTANT, value=BG.tolist()); cv2.putText(big, lab, (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (40, 40, 40), 2, cv2.LINE_AA); rows.append(big)
W = max(r.shape[1] for r in rows); cv2.imwrite(sys.argv[1], np.vstack([cv2.copyMakeBorder(r, 0, 0, 0, W - r.shape[1], cv2.BORDER_CONSTANT, value=BG.tolist()) for r in rows])); print(sys.argv[1])
