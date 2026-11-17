#!/usr/bin/env python3
"""Ground textures from assets/ref/ground_textures.jpg (user art): open ground (lot), alley paving, road
asphalt. Each panel is cut inside its frame, scaled to 256 px and made seamless: blended with a copy of itself
shifted half a tile, so its edges come from the middle of the panel and wrap without a seam. The road panel
with the white line is not used (no lane markings).   usage: python3 tools/cut_ground.py
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/sprites/ground'); os.makedirs(OUT, exist_ok=True)
SRC = Image.open(os.path.join(ROOT, 'assets/ref/ground_textures.jpg')).convert('RGB')
PANELS = {'lot1': (11, 56, 191, 226), 'lot2': (202, 56, 381, 226), 'alley1': (11, 287, 191, 432),
          'alley2': (202, 287, 381, 432), 'road': (11, 494, 191, 644)}
N = 256
y, x = np.mgrid[0:N, 0:N] / (N - 1)
w = np.minimum(np.minimum(x, 1 - x), np.minimum(y, 1 - y)) * 2          # 0 at the edges, 1 in the middle
w = np.clip(w * 2.2, 0, 1)[..., None]
for k, (x0, y0, x1, y1) in PANELS.items():
    im = np.asarray(SRC.crop((x0 + 4, y0 + 4, x1 - 4, y1 - 4)).resize((N, N), Image.LANCZOS)).astype(np.float32)
    sh = np.roll(np.roll(im, N // 2, 0), N // 2, 1)
    t = im * w + sh * (1 - w)
    Image.fromarray(np.clip(t, 0, 255).astype(np.uint8)).save(os.path.join(OUT, k + '.jpg'), quality=90)
    print(k, t.mean(axis=(0, 1)).round())
