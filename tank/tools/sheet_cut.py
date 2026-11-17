"""Shared cutter for drawings on a white page (buildings, debris, vegetation): removes the page, the white
islands it leaves inside the drawing, and the pale halo along the edges (the edge pixels are un-mixed from the
white they were blended with, so no white rim shows over a dark background)."""
import numpy as np
from PIL import Image


def _grow(m, n=1):
    for _ in range(n):
        d = m.copy(); d[1:] |= m[:-1]; d[:-1] |= m[1:]; d[:, 1:] |= m[:, :-1]; d[:, :-1] |= m[:, 1:]; m = d
    return m


def _flood(seed, allowed):
    reg = seed & allowed
    while True:
        d = _grow(reg) & allowed
        if (d == reg).all(): return reg
        reg = d


def _islands(mask, min_px):
    """connected regions of mask larger than min_px (4-neighbour), as one boolean array"""
    H, W = mask.shape; seen = np.zeros_like(mask); out = np.zeros_like(mask)
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if seen[y0, x0]: continue
        st = [(y0, x0)]; seen[y0, x0] = True; comp = []
        while st:
            y, x = st.pop(); comp.append((y, x))
            for v, u in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= v < H and 0 <= u < W and mask[v, u] and not seen[v, u]: seen[v, u] = True; st.append((v, u))
        if len(comp) >= min_px:
            for y, x in comp: out[y, x] = True
    return out


def cut(img, box, page_thr=226, island_px=400, keep=None):
    """img: PIL RGB; box: (x0, y0, x1, y1). Returns a trimmed RGBA PIL image and its box in the sheet."""
    x0, y0, x1, y1 = box
    a = np.asarray(img.crop(box).convert('RGB')).astype(np.float32)
    mn, mx = a.min(axis=2), a.max(axis=2)
    pale = (mn > page_thr) & (mx - mn < 26)
    border = np.zeros_like(pale); border[0] = border[-1] = True; border[:, 0] = border[:, -1] = True
    bg = _flood(border, pale)
    bg |= _islands(pale & ~bg, island_px)                       # white page seen through gaps in the drawing
    obj = ~bg
    if keep is not None: obj &= keep(a)
    # edge ring (2 px): un-mix from white. Reference colour = mean of the solid pixels nearby.
    inner = obj & ~_grow(~obj, 2)
    ring = obj & ~inner
    acc = np.zeros_like(a); cnt = np.zeros(a.shape[:2], np.float32)
    src = np.where(inner[..., None], a, 0); w = inner.astype(np.float32)
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            acc += np.roll(np.roll(src, dy, 0), dx, 1); cnt += np.roll(np.roll(w, dy, 0), dx, 1)
    ref = acc / np.maximum(cnt, 1)[..., None]
    has = cnt > 0
    alpha = obj.astype(np.float32)
    refmin = ref.min(axis=2)
    al = np.clip((255 - mn) / np.maximum(1, 255 - refmin), 0, 1)
    sel = ring & has
    alpha[sel] = al[sel]
    a[sel] = ref[sel]
    alpha[ring & ~has] = 0
    rgba = np.dstack([np.clip(a, 0, 255).astype(np.uint8), (alpha * 255).astype(np.uint8)])
    ys, xs = np.nonzero(alpha > 0.04)
    if not len(ys): return None, None
    t = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return Image.fromarray(t), (x0 + int(xs.min()), y0 + int(ys.min()), x0 + int(xs.max()) + 1, y0 + int(ys.max()) + 1)
