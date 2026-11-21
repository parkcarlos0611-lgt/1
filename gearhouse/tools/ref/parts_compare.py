"""Part by part: each slot of a drawn body beside the same box of its reference sheet, enlarged.
  python3 tools/ref/parts_compare.py <sheet side png> <length mm> <drawn png> <slots json> <out.png>"""
import sys, json, cv2, numpy as np
MM, PAD, K = 10, 6, 6; BG = (184, 205, 214)
src = cv2.imread(sys.argv[1], cv2.IMREAD_UNCHANGED); L = int(sys.argv[2]); drawn = cv2.imread(sys.argv[3], cv2.IMREAD_UNCHANGED); boxes = json.loads(open(sys.argv[4]).read()); out = sys.argv[5]
w = round(L / MM); src = cv2.resize(src, (w, round(src.shape[0] * w / src.shape[1])), interpolation=cv2.INTER_AREA); Hs = src.shape[0]; Hd = drawn.shape[0]
def onbg(img): a = (img[..., 3:4] > 110).astype(np.float32); return (img[..., :3] * a + np.array(BG) * (1 - a)).astype(np.uint8)
S, D = onbg(src), onbg(drawn); rows = []
for name, (x0, z0, x1, z1) in sorted(boxes.items(), key=lambda kv: kv[1][0]):
    m = 60; a = [max(0, int((x0 - m) / MM)), max(0, int(Hs - (z1 + m) / MM)), int((x1 + m) / MM) + 1, int(Hs - (z0 - m) / MM) + 1]
    b = [max(0, int(PAD + (x0 - m) / MM)), max(0, int(Hd - PAD - (z1 + m) / MM)), int(PAD + (x1 + m) / MM) + 1, int(Hd - PAD - (z0 - m) / MM) + 1]
    ca, cb = S[a[1]:a[3], a[0]:a[2]], D[b[1]:b[3], b[0]:b[2]]; hh = max(ca.shape[0], cb.shape[0]); big = lambda c: cv2.resize(cv2.copyMakeBorder(c, 0, hh - c.shape[0], 0, 0, cv2.BORDER_CONSTANT, value=BG), None, fx=K, fy=K, interpolation=cv2.INTER_NEAREST)
    row = np.hstack([big(ca), np.full((hh * K, 12, 3), 255, np.uint8), big(cb)]); row = cv2.copyMakeBorder(row, 26, 8, 8, 8, cv2.BORDER_CONSTANT, value=BG); cv2.putText(row, name, (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (30, 30, 30), 1); rows.append(row)
W = max(r.shape[1] for r in rows); cv2.imwrite(out, np.vstack([cv2.copyMakeBorder(r, 0, 0, 0, W - r.shape[1], cv2.BORDER_CONSTANT, value=BG) for r in rows])); print(out, len(rows), 'parts')
