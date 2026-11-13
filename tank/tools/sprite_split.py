"""Shared helper for the sprite cutters: separate the turret from hull parts that sit on the deck above the
hull/turret cut line (fuel drums, stowage, deck edges). The turret keeps its largest connected piece plus any
piece that floats clear of the deck (machine gun, sights); pieces resting on the deck go back to the hull."""
import numpy as np
from collections import deque


def components(mask):
    H, W = mask.shape
    lab = np.zeros((H, W), np.int32)
    n = 0
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0]:
            continue
        n += 1
        q = deque([(y0, x0)]); lab[y0, x0] = n
        while q:
            y, x = q.popleft()
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                v, u = y + dy, x + dx
                if 0 <= v < H and 0 <= u < W and mask[v, u] and not lab[v, u]:
                    lab[v, u] = n; q.append((v, u))
    return lab, n


def split_turret(turret_mask, alpha, yy, seam, deck=6):
    """turret_mask: candidate turret pixels. Returns (turret, moved_to_hull)."""
    m = turret_mask & (alpha > 40)
    lab, n = components(m)
    if n == 0:
        return turret_mask, np.zeros_like(turret_mask)
    sizes = np.bincount(lab.ravel())[1:]
    main = int(np.argmax(sizes)) + 1
    keep = lab == main
    for k in range(1, n + 1):
        if k == main:
            continue
        ys = yy[lab == k]
        if ys.max() < seam - deck:          # floats clear of the deck: part of the turret
            keep |= lab == k
    # thin deck edge glued to the turret: rows just above the seam outside the turret's own footprint
    # the turret's own footprint: columns of its upper part (stowage on the deck is lower than this)
    body = keep & (yy < seam - 5 * deck)
    bx = np.nonzero(body.any(axis=0))[0]
    if len(bx):
        x0, x1 = bx.min(), bx.max()
        xx = np.arange(keep.shape[1])[None, :].repeat(keep.shape[0], 0)
        keep &= ~((yy >= seam - 5 * deck) & ((xx < x0) | (xx > x1)))
    turret = turret_mask & (keep | (alpha <= 40))
    # faint fringe pixels (alpha <= 40) next to removed pieces go with them
    moved = turret_mask & ~turret
    fringe = turret & (alpha <= 40)
    grown = moved.copy()
    for _ in range(2):
        g = grown.copy(); g[1:] |= grown[:-1]; g[:-1] |= grown[1:]; g[:, 1:] |= grown[:, :-1]; g[:, :-1] |= grown[:, 1:]; grown = g
    moved |= fringe & grown
    turret &= ~moved
    return turret, moved
