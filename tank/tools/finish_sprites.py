#!/usr/bin/env python3
"""Finishing pass over the vehicle sprites (run after the cut_*.py scripts):

1. Barrel root: the tube is continued backward from its first clean column (outlines and all) to 0.35 m behind
   the trunnions. The barrel is drawn under the turret, so at rest the extension is hidden; when the gun
   elevates, a whole tube runs into the mantlet instead of a cut end lifting out of it.
2. Turret plug: where the barrel was lifted out of the turret drawing, the hole is filled from the turret's own
   pixels above and below it (only where the turret encloses it), so raising the gun shows the turret face,
   not the background.
3. White matte: near-white, unsaturated pixels joined to the transparent outside (the white page the art was
   cut from) are made transparent, up to 3 px in; white inside the art is left alone.

NOT APPLIED YET (held back on request): run it, then python3 tools/cut_iraqi.py t72 first for the wider T-72 barrel.
usage: python3 tools/finish_sprites.py [vehicle ...]      (defaults: every tracked vehicle; helicopters get 3 only)
It rewrites the PNGs and the barrel position in data/vehicles/<id>.js (sprites.barrel x, ext: true).
"""
import os, sys, json, re, subprocess
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, 'assets/sprites')
TRACKED = ['m1a1', 'm2a2', 'm60a1', 'm109a3', 't55', 't62', 't72', 'challenger1', 'amx30b2', 'bmp1', '2s1']
HELIS = ['ah1w', 'ah64a']
# guns whose leading piece is the gun's own sleeve (it elevates with the tube), not a fixed mantlet
SLEEVE = {'m2a2', 'bmp1'}

def defs():
    js = """global.window = {}; global.DS = {}; const fs = require('fs');
      for (const f of fs.readdirSync('data/vehicles')) eval(fs.readFileSync('data/vehicles/' + f, 'utf8'));
      const o = {}; for (const [k, d] of Object.entries(DS.VEHICLES)) if (d.sprites && d.sprites.barrel && d.src) o[k] = { src: d.src, sprites: d.sprites, gun: d.gun };
      console.log(JSON.stringify(o));"""
    return json.loads(subprocess.check_output(['node', '-e', js], cwd=ROOT))

def load(p): return np.asarray(Image.open(p).convert('RGBA')).copy()

def defringe(a, depth=3):
    rgb = a[..., :3].astype(int); al = a[..., 3].astype(int)
    mx, mn = rgb.max(-1), rgb.min(-1)
    white = ((mn > 200) & (mx - mn < 40) & (al > 0)) | ((al > 0) & (al < 200) & (mn > 170) & (mx - mn < 50))
    tr = al < 10; lab, n = ndimage.label(tr)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    out = np.isin(lab, list(border)) if border else np.zeros_like(tr)
    rem = np.zeros(al.shape, bool)
    for _ in range(depth):
        edge = ndimage.binary_dilation(out, structure=np.ones((3, 3))) & ~out
        k = edge & white & ~rem
        if not k.any(): break
        rem |= k; out |= k
    a[rem, 3] = 0
    return int(rem.sum())

def extents(B):
    op = B[..., 3] > 60
    top = np.full(B.shape[1], -1); bot = np.full(B.shape[1], -1)
    for c in range(B.shape[1]):
        ys = np.nonzero(op[:, c])[0]
        if len(ys): top[c], bot[c] = ys[0], ys[-1]
    return top, bot

def root_col(B):
    top, bot = extents(B); W = B.shape[1]; h = bot - top
    mid = h[W // 3: 2 * W // 3]; mid = mid[mid > 0]; med = np.median(mid) if len(mid) else 0
    for c in range(0, W - 8):
        seg = slice(c, c + 6)
        if (top[seg] < 0).any(): continue
        if np.abs(np.diff(top[seg])).max() <= 1 and np.abs(np.diff(bot[seg])).max() <= 1 and 0.55 * med <= h[c] <= 1.25 * med:
            return c
    return 0

def finish(vid, D):
    d = os.path.join(SPR, vid); src = D['src']; Sp = D['sprites']; G = D['gun']
    ppm, ox, oy = src['ppm'], src['ox'], src['oy']
    tpx = G['trunnion'][0] * ppm + ox
    B = load(os.path.join(d, 'barrel.png')); T = load(os.path.join(d, 'turret.png'))
    bx, by = Sp['barrel']['x'], Sp['barrel']['y']; tx, ty = Sp['turret']['x'], Sp['turret']['y']
    if Sp['barrel'].get('ext'):
        print(vid, 'already finished'); return None
    # 2. turret plug over the barrel's rows, in front of where the barrel starts
    op = B[..., 3] > 30; filled = 0
    for c in range(B.shape[1]):
        X = bx + c - tx
        if X < 0 or X >= T.shape[1]: continue
        ys = np.nonzero(op[:, c])[0]
        if not len(ys): continue
        y0, y1 = by + ys[0] - ty - 1, by + ys[-1] - ty + 1
        col = T[:, X]; a = col[:, 3] > 200
        up = [y for y in range(max(0, y0 - 10), max(0, y0)) if a[y]]; dn = [y for y in range(min(T.shape[0], y1 + 1), min(T.shape[0], y1 + 11)) if a[y]]
        if not up or not dn: continue
        ya, yb = up[-1], dn[0]; ca, cb = col[ya, :3].astype(float), col[yb, :3].astype(float)
        for y in range(ya + 1, yb):
            if col[y, 3] < 250:
                f = (y - ya) / (yb - ya); T[y, X, :3] = (ca * (1 - f) + cb * f).astype(np.uint8); T[y, X, 3] = 255; filled += 1
    # 1. barrel root continued backward past the trunnions
    # the barrel image's first columns before the clean tube are the mantlet's face: they go into the turret
    # (fixed), and the tube profile fills their place, so only a whole tube elevates out of the mantlet
    rc = root_col(B); ntx, nty = tx, ty
    if vid in SLEEVE:                      # keep the sleeve on the gun: the tube is continued in front of it
        E = max(0, int(round(bx - (tpx - 0.35 * ppm)))); prof = B[:, rc:rc + 1]
        B = np.concatenate([np.repeat(prof, E, axis=1), B], axis=1); nbx = bx - E; rc_moved = 0
    elif rc > 0:
        ch = B[:, :rc]
        x0, y0 = min(tx, bx), min(ty, by); x1, y1 = max(tx + T.shape[1], bx + rc), max(ty + T.shape[0], by + B.shape[0])
        NT = np.zeros((y1 - y0, x1 - x0, 4), np.uint8); NT[ty - y0: ty - y0 + T.shape[0], tx - x0: tx - x0 + T.shape[1]] = T
        reg = NT[by - y0: by - y0 + B.shape[0], bx - x0: bx - x0 + rc]
        a = ch[..., 3:4].astype(float) / 255
        reg[..., :3] = (ch[..., :3] * a + reg[..., :3] * (1 - a)).astype(np.uint8); reg[..., 3] = np.maximum(reg[..., 3], ch[..., 3])
        T, ntx, nty = NT, x0, y0
    if vid not in SLEEVE:
        E = max(0, int(round(bx - (tpx - 0.35 * ppm))))
        prof = B[:, rc:rc + 1]
        B = np.concatenate([np.repeat(prof, E + rc, axis=1), B[:, rc:]], axis=1)
        nbx = bx - E
    nf = defringe(B) + defringe(T)
    Image.fromarray(B).save(os.path.join(d, 'barrel.png')); Image.fromarray(T).save(os.path.join(d, 'turret.png'))
    print(f'{vid}: ' + (f'sleeve {rc} px kept on the gun' if vid in SLEEVE else f'mantlet piece {rc} px into the turret') + f', tube +{E} px back (barrel x {bx} -> {nbx}), turret plug {filled} px, matte {nf} px')
    return nbx, ntx, nty

def write_def(vid, r):
    nbx, ntx, nty = r
    p = os.path.join(ROOT, 'data/vehicles', vid + '.js'); s = open(p).read()
    s2, n = re.subn(r"barrel: \{ x:\s*\d+(\.\d+)?,\s*y:\s*(\d+(\.\d+)?) \}", lambda m: f"barrel: {{ x: {nbx}, y: {m.group(2)}, ext: true }}", s, count=1)
    if n != 1: raise SystemExit('barrel entry not found in ' + p)
    s2, n = re.subn(r"turret: \{ x:\s*\d+(\.\d+)?,\s*y:\s*\d+(\.\d+)? \}", f"turret: {{ x: {ntx}, y: {nty} }}", s2, count=1)
    if n != 1: raise SystemExit('turret entry not found in ' + p)
    open(p, 'w').write(s2)

def matte_only(vid):
    d = os.path.join(SPR, vid); n = 0
    for f in sorted(os.listdir(d)):
        if not f.endswith('.png') or 'xray' in f: continue
        a = load(os.path.join(d, f)); k = defringe(a)
        if k: Image.fromarray(a).save(os.path.join(d, f)); n += k
    return n

if __name__ == '__main__':
    want = sys.argv[1:] or TRACKED + HELIS
    D = defs()
    for v in want:
        if v in TRACKED:
            r = finish(v, D[v])
            if r is not None: write_def(v, r)
            n = 0
            for f in sorted(os.listdir(os.path.join(SPR, v))):
                if f.endswith('.png') and f not in ('barrel.png', 'turret.png') and 'xray' not in f:
                    a = load(os.path.join(SPR, v, f)); k = defringe(a)
                    if k: Image.fromarray(a).save(os.path.join(SPR, v, f)); n += k
            print(f'  {v}: matte on the other sprites {n} px')
        else:
            print(f'{v}: matte {matte_only(v)} px')
