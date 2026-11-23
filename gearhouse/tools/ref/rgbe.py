# Radiance .hdr (RGBE, run-length encoded) to a float array, numpy only (review 124).
import numpy as np
def read_hdr(path):
    data = open(path, 'rb').read(); i = 0
    while True:
        j = data.index(b'\n', i); line = data[i:j]; i = j + 1
        if line.startswith(b'-Y') or line.startswith(b'+Y'): parts = line.split(); H, W = int(parts[1]), int(parts[3]); break
    img = np.zeros((H, W, 4), np.uint8); p = i
    for y in range(H):
        if data[p] == 2 and data[p + 1] == 2:
            p += 4
            for c in range(4):
                x = 0
                while x < W:
                    n = data[p]; p += 1
                    if n > 128: n -= 128; img[y, x:x + n, c] = data[p]; p += 1
                    else: img[y, x:x + n, c] = np.frombuffer(data[p:p + n], np.uint8); p += n
                    x += n
        else: img[y] = np.frombuffer(data[p:p + W * 4], np.uint8).reshape(W, 4); p += W * 4
    e = img[..., 3].astype(np.float32); f = np.where(e > 0, np.ldexp(1.0, (e - 136).astype(np.int32)), 0).astype(np.float32)
    return img[..., :3].astype(np.float32) * f[..., None]
