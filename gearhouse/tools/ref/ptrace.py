"""Take a part's outline off a reference view (the 3D part model, decision of 2026-11-20): inside a box given in
millimetres, the pixels of one kind (bright metal or glass, the body colour, dark, red, or simply the car's
silhouette) are gathered and the outline of the largest piece is returned in millimetres. Every car's parts get
their own shapes this way; nothing comes from a stock of shapes.

  from ptrace import Sheet;  s = Sheet(png, width_mm, height_mm);  pts = s.trace('bright', x0, z0, x1, z1)
  s.overlay(out_png) draws every outline traced so far over the view, to check by eye."""
import cv2, numpy as np
class Sheet:
    def __init__(s, png, w_mm, h_mm, paint_hue=None):
        im = cv2.imread(png, cv2.IMREAD_UNCHANGED); s.K = 4
        im = cv2.resize(im, None, fx=s.K, fy=s.K, interpolation=cv2.INTER_CUBIC); s.im = im; s.h, s.w = im.shape[:2]; s.sx = w_mm / s.w; s.sz = h_mm / s.h; s.done = []
        hsv = cv2.cvtColor(im[..., :3], cv2.COLOR_BGR2HSV).astype(int); H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]; a = im[..., 3] > 127
        s.cls = {'mask': a, 'bright': a & (S < 60) & (V > 135), 'dark': a & (V < 105) & (S < 70), 'red': a & ((H < 8) | (H > 170)) & (S > 120) & (V > 90),
                 'paint': a & (S >= 60) & (H > 18) & (H < 50) if paint_hue is None else a & (S >= 50) & (abs(H - paint_hue) < 14), 'notbright': a & ~((S < 60) & (V > 135))}
    def px(s, x, z): return int(round(x / s.sx)), int(round(s.h - z / s.sz))
    def trace(s, kind, x0, z0, x1, z1, eps=1.2, close=3, name='', pick='largest'):
        (a, d), (b, c) = s.px(x0, z0), s.px(x1, z1); m = np.zeros((s.h, s.w), np.uint8); m[max(0, c):d, max(0, a):b] = s.cls[kind][max(0, c):d, max(0, a):b]
        if close: m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close * 2 + 1, close * 2 + 1)))
        cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        if not cs: raise SystemExit(f'nothing of kind {kind} in the box of {name}')
        c = max(cs, key=cv2.contourArea); c = cv2.approxPolyDP(c, eps * s.K / 2, True).reshape(-1, 2)
        pts = [[round(float(x) * s.sx), round(float(s.h - y) * s.sz)] for x, y in c]; s.done.append((name, pts)); return pts
    def note(s, name, pts): s.done.append((name, [p[:2] for p in pts])); return pts
    def overlay(s, out):
        v = s.im[..., :3].copy(); v[s.im[..., 3] < 128] = (200, 200, 200)
        for i, (name, pts) in enumerate(s.done):
            col = [(0, 0, 255), (0, 200, 255), (255, 0, 255), (255, 160, 0), (0, 255, 0)][i % 5]; q = np.array([s.px(x, z) for x, z in pts], np.int32); cv2.polylines(v, [q], True, col, 2)
            cv2.putText(v, name, tuple(int(t) for t in q.mean(0) - [20, 0]), 0, 0.5, (255, 255, 255), 3); cv2.putText(v, name, tuple(int(t) for t in q.mean(0) - [20, 0]), 0, 0.5, col, 1)
        cv2.imwrite(out, v)
