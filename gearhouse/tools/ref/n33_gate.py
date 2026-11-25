# The N33's gate pictures (docs/systems/117 §15), from the renders of tools/ref/n33_gate.ts:
#   npx tsx tools/ref/n33_gate.ts <d> ; npx tsx tools/ref/n33_gate.ts <d> form
#   python3 tools/ref/n33_gate.py <d> <out.png>
# For each photograph: the photograph, the model through the same camera, the two laid over each other half and half;
# then the model square on over the blueprint's front and side views (the model's edges in red on the drawing).
import sys, os, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
D, OUT = sys.argv[1], sys.argv[2]; BG = (206, 202, 192)
F = ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 24)
def lab(im, t):
    o = Image.new('RGB', (im.width, im.height + 36), BG); o.paste(im, (0, 36)); ImageDraw.Draw(o).text((8, 4), t, fill=(25, 25, 25), font=F); return o
def fit(im, w): return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
def shot(name, photo, crop, w=860):
    p = Image.open(photo).convert('RGB'); r = Image.open(f'{D}/v3_{name}.png').convert('RGB').resize(p.size, Image.LANCZOS)
    mix = Image.blend(p, r, 0.5); row = [lab(fit(p.crop(crop), w), '사진'), lab(fit(r.crop(crop), w), '모델 (같은 카메라)'), lab(fit(mix.crop(crop), w), '겹침 50 %')]
    if os.path.exists(f'{D}/form_{name}.png'): row.append(lab(fit(Image.open(f'{D}/form_{name}.png').convert('RGB').resize(p.size, Image.LANCZOS).crop(crop), w), '모델 (연속 음영: 면 보기)'))
    return row
def bp(name, at, origin, kx=1.0):
    """the model's square-on picture (twice the blueprint's size) with the blueprint laid over it half and half, and its outline in red"""
    b0 = Image.open('docs/reference/bnr33/bp_line_4view_hires.png').convert('RGB'); b = Image.new('RGB', (b0.width + 200, b0.height), (255, 255, 255)); b.paste(b0, (100, 0)); at = (at[0] + 100, at[1]); r = Image.open(f'{D}/v3_{name}.png').convert('RGB'); w, h = r.size
    x0, y0 = at[0] - origin[0] / 2 / kx, at[1] - origin[1] / 2; c = b.crop((int(round(x0)), int(round(y0)), int(round(x0 + w / 2 / kx)), int(round(y0 + h / 2)))).resize((w, h), Image.LANCZOS)
    dark = np.array(c.convert('L')) < 140; a = np.array(r).astype(float); a[dark] = a[dark] * 0.25 + np.array([200, 0, 30]) * 0.75
    return [lab(r, '모델 (정면·측면 직각 투영)'), lab(Image.fromarray(a.astype('uint8')), '도면 선(빨강)을 모델 위에'), lab(c, '도면')]
rows = [shot('museum', 'docs/reference/bnr33/photo_front34_silver_museum.jpg', (60, 90, 1240, 680)), shot('silver_r', 'docs/reference/bnr33/photo_front34_silver_r.jpg', (40, 280, 2060, 1130)),
        bp('front', (190.5, 582), (380, 500), 1 / 0.957) + bp('side', (183.5 - 950 / 5.5, 269), (40, 500))[:2]]
W = max(sum(i.width for i in r) + 16 * (len(r) - 1) for r in rows) + 40; H = sum(max(i.height for i in r) for r in rows) + 20 * (len(rows) + 1) + 56
o = Image.new('RGB', (W, H), BG); ImageDraw.Draw(o).text((20, 12), 'N33 차체 3차 — 관문 1: 앞 1/3 (뒤쪽은 임시 그루터기)', fill=(10, 10, 10), font=ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 32)); y = 76
for r in rows:
    h = max(i.height for i in r); x = 20
    for i in r: o.paste(i, (x, y)); x += i.width + 16
    y += h + 20
o.save(OUT); print(OUT, o.size)
