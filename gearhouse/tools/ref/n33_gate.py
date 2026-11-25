# The N33's gate pictures (docs/systems/117 §15), from the renders of tools/ref/n33_gate.ts:
#   npx tsx tools/ref/n33_gate.ts <d> ; npx tsx tools/ref/n33_gate.ts <d> form
#   python3 tools/ref/n33_gate.py <d> <out.png>
#   npx tsx tools/ref/n33_gate.ts <d> stock ; ... stock form ; python3 tools/ref/n33_gate.py <d> <out.png> final   (the stock car)
# For each photograph: the photograph, the model through the same camera, the two laid over each other half and half;
# then the model square on over the blueprint's front and side views (the model's edges in red on the drawing).
import sys, os, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
D, OUT = sys.argv[1], sys.argv[2]; BG = (206, 202, 192); MODE = sys.argv[3] if len(sys.argv) > 3 else 'front'; TAG = 'stock' if MODE == 'final' else 'v3'
F = ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 24)
def lab(im, t):
    o = Image.new('RGB', (im.width, im.height + 36), BG); o.paste(im, (0, 36)); ImageDraw.Draw(o).text((8, 4), t, fill=(25, 25, 25), font=F); return o
def fit(im, w): return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
def shot(name, photo, crop, w=860):
    p = Image.open(photo).convert('RGB'); r = Image.open(f'{D}/{TAG}_{name}.png').convert('RGB').resize(p.size, Image.LANCZOS)
    mix = Image.blend(p, r, 0.5); row = [lab(fit(p.crop(crop), w), '사진'), lab(fit(r.crop(crop), w), '모델 (같은 카메라)'), lab(fit(mix.crop(crop), w), '겹침 50 %')]
    FORM = 'stockform' if TAG == 'stock' else 'form'
    if os.path.exists(f'{D}/{FORM}_{name}.png'): row.append(lab(fit(Image.open(f'{D}/{FORM}_{name}.png').convert('RGB').resize(p.size, Image.LANCZOS).crop(crop), w), '모델 (연속 음영: 면 보기)'))
    return row
def bp(name, at, origin, kx=1.0):
    """the model's square-on picture (twice the blueprint's size) with the blueprint laid over it half and half, and its outline in red"""
    b0 = Image.open('docs/reference/bnr33/bp_line_4view_hires.png').convert('RGB'); b = Image.new('RGB', (b0.width + 200, b0.height), (255, 255, 255)); b.paste(b0, (100, 0)); at = (at[0] + 100, at[1]); r = Image.open(f'{D}/{TAG}_{name}.png').convert('RGB'); w, h = r.size
    x0, y0 = at[0] - origin[0] / 2 / kx, at[1] - origin[1] / 2; c = b.crop((int(round(x0)), int(round(y0)), int(round(x0 + w / 2 / kx)), int(round(y0 + h / 2)))).resize((w, h), Image.LANCZOS)
    dark = np.array(c.convert('L')) < 140; a = np.array(r).astype(float); a[dark] = a[dark] * 0.25 + np.array([200, 0, 30]) * 0.75
    return [lab(r, '모델 (정면·측면 직각 투영)'), lab(Image.fromarray(a.astype('uint8')), '도면 선(빨강)을 모델 위에'), lab(c, '도면')]
def edges(name, photo, crop, w=860):
    """the model's edges (every line and tone step of its picture) drawn on the photograph"""
    p = Image.open(photo).convert('RGB'); r = Image.open(f'{D}/{TAG}_{name}.png').convert('RGB').resize(p.size, Image.LANCZOS); p = fit(p.crop(crop), w); r = r.crop(crop).resize(p.size, Image.LANCZOS)
    g = np.array(r.convert('L')).astype(float); e = (np.abs(np.diff(g, axis=1, prepend=g[:, :1])) + np.abs(np.diff(g, axis=0, prepend=g[:1]))) > 40
    a = np.array(p).astype(float); a[e] = [255, 225, 0]; return lab(Image.fromarray(a.astype('uint8')), '모델의 선(노랑)을 사진 위에')
REF = 'docs/reference/bnr33/'
if len(sys.argv) > 3 and sys.argv[3] == 'rear':   # gate 2: the whole car, from behind and from the side
    c = (0, 20, 900, 580); r = shot('rear_blue', REF + 'photo_rear34_blue.jpg', c); r.insert(2, edges('rear_blue', REF + 'photo_rear34_blue.jpg', c))
    c2 = (60, 90, 1240, 680); f = shot('museum', REF + 'photo_front34_silver_museum.jpg', c2); f.insert(2, edges('museum', REF + 'photo_front34_silver_museum.jpg', c2))
    side = bp('side', (183.5 - 950 / 5.5, 269), (40, 500)); rear = bp('rear', (684, 582), (380, 500), 1 / 0.957)
    rows = [r, [side[0], side[1]], [rear[0], rear[1], rear[2]], f]; title = 'N33 차체 3차 — 관문 2: 차 전체 (뒤 3/4 사진, 측면·후면 도면, 앞 3/4 사진)'
elif MODE == 'final':   # the car as the game builds it (the stock parts on), through the gates' cameras
    c2 = (60, 90, 1240, 680); f = shot('museum', REF + 'photo_front34_silver_museum.jpg', c2); f.insert(2, edges('museum', REF + 'photo_front34_silver_museum.jpg', c2))
    c = (0, 20, 900, 580); r = shot('rear_blue', REF + 'photo_rear34_blue.jpg', c); r.insert(2, edges('rear_blue', REF + 'photo_rear34_blue.jpg', c))
    c3 = (40, 280, 2060, 1130); g = shot('silver_r', REF + 'photo_front34_silver_r.jpg', c3)
    side = bp('side', (183.5 - 950 / 5.5, 269), (40, 500))
    rows = [f, r, g, [side[0], side[1]]]; title = 'N33 차체 3차 — 게임에 연결한 순정 차 (관문과 같은 카메라)'
else:
    rows = None; title = 'N33 차체 3차 — 관문 1: 앞 1/3 (뒤쪽은 임시 그루터기)'
if rows is None:
  rows = [shot('museum', 'docs/reference/bnr33/photo_front34_silver_museum.jpg', (60, 90, 1240, 680)), shot('silver_r', 'docs/reference/bnr33/photo_front34_silver_r.jpg', (40, 280, 2060, 1130)),
        bp('front', (190.5, 582), (380, 500), 1 / 0.957) + bp('side', (183.5 - 950 / 5.5, 269), (40, 500))[:2]]
W = max(sum(i.width for i in r) + 16 * (len(r) - 1) for r in rows) + 40; H = sum(max(i.height for i in r) for r in rows) + 20 * (len(rows) + 1) + 56
o = Image.new('RGB', (W, H), BG); ImageDraw.Draw(o).text((20, 12), title, fill=(10, 10, 10), font=ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 32)); y = 76
for r in rows:
    h = max(i.height for i in r); x = 20
    for i in r: o.paste(i, (x, y)); x += i.width + 16
    y += h + 20
o.save(OUT); print(OUT, o.size)
