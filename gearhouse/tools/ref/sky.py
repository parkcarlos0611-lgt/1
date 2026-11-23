# The sky for the live renderer (review 124): a Poly Haven CC0 HDRI (kloofendal_48d_partly_cloudy, 1K) made ready for
# the shader: the sun clipped out of it (the renderer's own sun lights and glints), turned so its sun stands where the
# renderer's does, scaled so its sky is as bright as the old analytic one, blurred to four roughnesses for the mirrors,
# and its light on a surface facing any way as nine spherical-harmonic numbers per colour. Written as one picture (the
# four levels stacked, 512 x 256 each, RGBM to 16) and sky.json.  python3 tools/ref/sky.py [path to .hdr]
import sys, json, numpy as np, os, urllib.request
sys.path.insert(0, os.path.dirname(__file__)); from rgbe import read_hdr
from PIL import Image
PID = 'kloofendal_48d_partly_cloudy'; OUT = 'assets/textures/sky'; os.makedirs(OUT, exist_ok=True)
src = sys.argv[1] if len(sys.argv) > 1 else None
if not src:
    files = json.loads(urllib.request.urlopen(urllib.request.Request(f'https://api.polyhaven.com/files/{PID}', headers={'User-Agent': 'gearhouse-texture-fetch/1.0'})).read()); src = '/tmp/sky.hdr'
    open(src, 'wb').write(urllib.request.urlopen(urllib.request.Request(files['hdri']['1k']['hdr']['url'], headers={'User-Agent': 'gearhouse-texture-fetch/1.0'})).read())
a = read_hdr(src); H, W = a.shape[:2]
# directions as the shader reads them: theta from straight up, phi = (u - 0.5) 2 pi
v = (np.arange(H) + 0.5) / H; u = (np.arange(W) + 0.5) / W; th = v * np.pi; ph = (u - 0.5) * 2 * np.pi
lum = a @ np.array([0.2126, 0.7152, 0.0722]); ys, xs = np.unravel_index(np.argmax(lum), lum.shape)
sun = np.array([-0.45, 0.35, 0.82]); sun /= np.linalg.norm(sun); want = np.arctan2(sun[1], sun[0]); have = ph[xs]
shift = int(round((want - have) / (2 * np.pi) * W)); a = np.roll(a, shift, axis=1); lum = np.roll(lum, shift, axis=1)
upper = a[: H // 2]; med = np.median(upper @ np.array([0.2126, 0.7152, 0.0722]))
clip = med * 12; L = a @ np.array([0.2126, 0.7152, 0.0722]); k = np.minimum(1, clip / np.maximum(L, 1e-9)); a = a * k[..., None]   # the sun out
# the ground below its horizon is the photograph's (rocks, brown earth); the circuit stands in grass and concrete: below a
# few degrees under the horizon it fades to a grey-green field lit by this sky, a little of the photograph's light and
# dark kept, so the mirrors and the light from below are the circuit's (the horizon's trees and houses stay)
below = np.clip((th - np.pi / 2 - np.radians(2)) / np.radians(10), 0, 1)[:, None, None]
sky_up = float(a[: H // 3].mean()); field = np.array([0.2, 0.23, 0.17]) * sky_up * 0.9
lumg = (a @ np.array([0.3, 0.59, 0.11]))[..., None]; detail = lumg / max(float(lumg[H // 2 + 20:].mean()), 1e-6)
a = a * (1 - below * 0.88) + field * np.clip(detail, 0.6, 1.4) * below * 0.88
sa = (np.sin(th) * (np.pi / H) * (2 * np.pi / W))[:, None]   # each pixel's solid angle
mean_up = float((a[: H // 2] @ np.array([0.2126, 0.7152, 0.0722]) * sa[: H // 2]).sum() / sa[: H // 2].sum() / W)
scale = 0.55 / mean_up; a = a * scale
# nine spherical-harmonic numbers (the light from every way), for the irradiance
T, P = np.meshgrid(th, ph, indexing='ij'); x, y, z = np.sin(T) * np.cos(P), np.sin(T) * np.sin(P), np.cos(T)
Y = [0.282095 * np.ones_like(x), 0.488603 * y, 0.488603 * z, 0.488603 * x, 1.092548 * x * y, 1.092548 * y * z, 0.315392 * (3 * z * z - 1), 1.092548 * x * z, 0.546274 * (x * x - y * y)]
w = np.broadcast_to(sa, (H, W)); sh = [[float((a[..., c] * Yi * w).sum()) for c in range(3)] for Yi in Y]
# the four levels: sharp, and blurred for roughness 0.25, 0.5, 0.8 (a lobe about rough squared radians wide)
def blur(img, sig):
    if sig <= 0: return img
    h, w_ = img.shape[:2]; out = img.copy(); lat = np.pi / 2 - (np.arange(h) + 0.5) / h * np.pi
    f = np.fft.rfftfreq(w_)   # each row round the circle, wider toward the poles
    F = np.fft.rfft(out, axis=1)
    for r in range(h): sx = sig * w_ / (2 * np.pi) / max(np.cos(lat[r]), 0.08); F[r] *= np.exp(-2 * (np.pi * f * sx) ** 2)[:, None]
    out = np.fft.irfft(F, n=w_, axis=1)
    sy = sig * h / np.pi; pad = int(sy * 3) + 1; p = np.concatenate([out[pad:0:-1], out, out[-2:-pad - 2:-1]], 0); ky = np.exp(-0.5 * (np.arange(-pad, pad + 1) / max(sy, 1e-3)) ** 2); ky /= ky.sum()
    q = np.zeros_like(p);
    for i, kk in enumerate(ky): q += np.roll(p, i - pad, axis=0) * kk
    return np.maximum(q[pad:pad + h], 0)
def size(img, w_, h_): return np.stack([np.asarray(Image.fromarray(img[..., c].astype(np.float32)).resize((w_, h_), Image.BILINEAR)) for c in range(3)], -1)
base = size(a, 512, 256); levels = [base] + [size(blur(size(a, 256, 128), s), 512, 256) for s in (0.0625, 0.25, 0.64)]
R = 16.
def rgbm(img):
    m = np.clip(img.max(-1) / R, 1 / 255, 1); m = np.ceil(m * 255) / 255; rgb = np.clip(img / (m[..., None] * R), 0, 1)
    return np.concatenate([np.sqrt(rgb), m[..., None]], -1)   # rgb kept in a square-root curve for the 8 bits
atlas = np.concatenate([rgbm(l) for l in levels], 0); Image.fromarray((atlas * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{OUT}/sky.png', optimize=True)
json.dump({'about': 'Poly Haven CC0 HDRI, sun clipped out, turned to the renderer\'s sun, four levels (rough 0, 0.25, 0.5, 0.8) stacked, RGBM (sqrt rgb, m) to 16 (review 124)', 'source': f'https://polyhaven.com/a/{PID}', 'license': 'CC0', 'range': R, 'rough': [0, 0.25, 0.5, 0.8], 'sh': sh, 'scale': scale}, open(f'{OUT}/sky.json', 'w'), indent=1)
print('sun at', ys, xs, 'shifted', shift, 'scale', round(scale, 4), 'sh0', [round(c, 3) for c in sh[0]]); print(os.path.getsize(f'{OUT}/sky.png') // 1024, 'KB')
