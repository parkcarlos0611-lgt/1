#!/usr/bin/env python3
"""Cut the projectile photos (white background, lying diagonally) into level sprites, nose to the right:
  assets/ref/m26_rocket_photo.jpg  ->  assets/sprites/munitions/m26.png   (M26 MLRS rocket, 3.94 m)
  assets/ref/shell_155_photo.jpg   ->  assets/sprites/munitions/s155.png  (155 mm shell, M741 body, ~0.80 m)
The object is the largest non-white blob (the watermark in the corner is a separate blob and is dropped); its
long axis comes from the blob's principal axis. The edge alpha comes from how far a pixel is from the paper
white, and edge colours are pulled towards the object's own colour so no white fringe survives.
usage: python3 tools/cut_munitions.py
"""
import os, json
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/sprites/munitions')

def cut(src, name, width, gain=1.0):
    im = np.asarray(Image.open(os.path.join(ROOT, src)).convert('RGB')).astype(np.float32)
    mn = im.min(axis=2)
    solid = mn < 200
    lab, n = ndimage.label(ndimage.binary_closing(solid, iterations=3))
    big = lab == (np.bincount(lab.ravel())[1:].argmax() + 1)
    big = ndimage.binary_fill_holes(big)
    reach = ndimage.binary_dilation(big, iterations=1)
    a = np.clip((232 - mn) / 40, 0, 1) * reach
    a[big & ndimage.binary_erosion(big, iterations=2)] = 1
    # edge decontamination: un-mix the white paper from the edge pixels
    rgb = im.copy(); k = np.clip(a, 0.05, 1)[..., None]
    rgb = np.clip((im - 255 * (1 - k)) / k, 0, 255)
    inner = ndimage.binary_erosion(big, iterations=3)
    _, (iy, ix) = ndimage.distance_transform_edt(~inner, return_indices=True)
    edge = (a < 0.98)[..., None]
    rgb = np.where(edge, im[iy, ix], rgb)
    rgb = np.clip(rgb * gain, 0, 255)
    ys, xs = np.nonzero(big); c = np.array([xs.mean(), ys.mean()])
    u, s, vt = np.linalg.svd(np.stack([xs - c[0], ys - c[1]]), full_matrices=False)
    ax = u[:, 0]
    # nose = the end of the axis whose last 10 % of the blob is thinner
    t = (xs - c[0]) * ax[0] + (ys - c[1]) * ax[1]; lo, hi = t.min(), t.max()
    if (t > hi - 0.1 * (hi - lo)).sum() > (t < lo + 0.1 * (hi - lo)).sum(): ax = -ax
    ang = np.degrees(np.arctan2(ax[1], ax[0]))
    rgba = Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8))
    r = rgba.rotate(ang, resample=Image.BICUBIC, expand=True)
    bb = r.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox(); r = r.crop(bb)
    h = round(r.height * width / r.width); r = r.resize((width, h), Image.LANCZOS)
    # the photo's cut-out left a light rim: shave a pixel off the outline and give every partly transparent
    # pixel the colour of the nearest solid one
    f = np.asarray(r).astype(np.float32); al = ndimage.minimum_filter(f[..., 3], size=3)
    solid = al > 250; _, (iy, ix) = ndimage.distance_transform_edt(~solid, return_indices=True)
    f[..., :3] = np.where(solid[..., None], f[..., :3], f[iy, ix, :3]); f[..., 3] = al
    r = Image.fromarray(f.astype(np.uint8))
    r.save(os.path.join(OUT, name + '.png')); return [width, h]

os.makedirs(OUT, exist_ok=True)
info = {'m26': cut('assets/ref/m26_rocket_photo.jpg', 'm26', 768, 1.55), 's155': cut('assets/ref/shell_155_photo.jpg', 's155', 256)}
json.dump(info, open(os.path.join(OUT, 'cut.json'), 'w')); print(info)
