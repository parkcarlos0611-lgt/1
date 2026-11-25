# The N33's pictures (docs/systems/117 R0/R1), from the renders of tools/ref/p959.ts with `n33`:
#   npx tsx tools/ref/p959.ts <d>/lump mm=4 n33 masks only=side,front,rear,top,front34,rear34
#   python3 tools/ref/n33_sheets.py <d> <out.png> overlay      (the blueprint overlay alone, at twice the blueprint's size)
#   python3 tools/ref/n33_sheets.py <d> <out.png> lump         (four views, two 3/4 views and the overlay)
#   npx tsx tools/ref/p959.ts <d>/d_<stock|max|min> mm=5 at=2340,0,650 n33 glass=stock only=side,front,front34 dims=<k:v,...>
#   python3 tools/ref/n33_sheets.py <d> <out.png> dims
#   python3 tools/ref/n33_sheets.py <d> <out.png> photos <render front34 left> <render front34 right>
# The blueprint (docs/reference/bnr33/bp_line_4view_hires.png): 5.5 mm a pixel along and up (its wheelbase 494.5 px is
# the car's 2,720; its height 248 px the car's 1,364), the front axle at x 183.5 px, the ground at y 269 px. Its plan is
# 3.7 % narrow and its front and rear views 4.3 % wide against the car's 1,780 mm: they are scaled across to it.
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
S, OUT, mode = sys.argv[1], sys.argv[2], sys.argv[3]; BG = (206, 202, 192)
F = ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 22)
bp = Image.open('docs/reference/bnr33/bp_line_4view_hires.png').convert('RGB')
def trim(im, pad=16):
    a = np.abs(np.array(im).astype(int) - np.array(BG)).sum(2) > 24; ys, xs = np.nonzero(a); return im.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(im.width, xs.max() + pad), min(im.height, ys.max() + pad)))
def lab(im, t):
    o = Image.new('RGB', (im.width, im.height + 34), BG); o.paste(im, (0, 34)); ImageDraw.Draw(o).text((10, 4), t, fill=(25, 25, 25), font=F); return o
def scale(im, k): return im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
def stack(rows, path, title=None):
    W = max(sum(i.width for i in r) + 20 * (len(r) - 1) for r in rows) + 40; H = sum(max(i.height for i in r) for r in rows) + 20 * (len(rows) + 1) + (50 if title else 0)
    o = Image.new('RGB', (W, H), BG); y = 20
    if title: ImageDraw.Draw(o).text((20, 12), title, fill=(10, 10, 10), font=ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 30)); y = 70
    for r in rows:
        h = max(i.height for i in r); x = (W - sum(i.width for i in r) - 20 * (len(r) - 1)) // 2
        for i in r: o.paste(i, (x, y + (h - i.height) // 2)); x += i.width + 20
        y += h + 20
    o.save(path); print(path, o.size)
def lay(d, mask, at, origin, kx=1.0):
    """the mask (silhouette black, lines dark red) over the blueprint at twice its size; at: the blueprint's pixel of the
    mask's origin; kx: the blueprint's view stretched across by this before it is laid under"""
    rgb = np.array(Image.open(f'{d}/{mask}').convert('RGB')); ln = (rgb[..., 0] == 128) & (rgb[..., 1] == 0); a = Image.fromarray(np.where(ln | (rgb[..., 0] < 100), 255, 0).astype('uint8')); w, h = a.size
    sw = w / 2 / kx; x0, y0 = at[0] - origin[0] / 2 / kx, at[1] - origin[1] / 2
    c = bp.crop((int(round(x0)), int(round(y0)), int(round(x0 + sw)), int(round(y0 + h / 2)))).resize((w, h), Image.LANCZOS)
    edge = (np.array(a.filter(ImageFilter.MaxFilter(3))) > 128) & ~(np.array(a.filter(ImageFilter.MinFilter(3))) > 128); arr = np.array(c).astype(float) * 0.75 + 60; arr[edge] = [230, 0, 40]; arr[ln] = [20, 20, 255]; return Image.fromarray(arr.astype('uint8'))
def overlay(d):
    ox = 183.5 - 950 / 5.5
    side, plan = lay(d, 'mask_side.png', (ox, 269), (40, 500)), lay(d, 'mask_plan.png', (ox, 792.5), (40, 380), 1 / 1.037)
    front, rear = lay(d, 'mask_front.png', (190.5, 582), (380, 500), 1 / 0.957), lay(d, 'mask_rear.png', (684, 582), (380, 500), 1 / 0.957)
    ov = Image.new('RGB', (side.width + front.width, side.height + plan.height), (255, 255, 255)); ov.paste(side, (0, 0)); ov.paste(front, (side.width, 0)); ov.paste(plan, (0, side.height)); ov.paste(rear, (side.width, side.height)); return ov
def match(d):
    """the silhouettes' overlap with the blueprint's own outline (filled): intersection over union, per view"""
    out = {}
    for n, at, org, kx, box in [('side', (183.5 - 950 / 5.5, 269), (40, 500), 1, None), ('front', (190.5, 582), (380, 500), 1 / 0.957, None), ('rear', (684, 582), (380, 500), 1 / 0.957, None)]:
        m = np.array(Image.open(f'{d}/mask_{n}.png').convert('L')) < 100; h, w = m.shape
        x0, y0 = at[0] - org[0] / 2 / kx, at[1] - org[1] / 2; c = bp.convert('L').crop((int(round(x0)), int(round(y0)), int(round(x0 + w / 2 / kx)), int(round(y0 + h / 2)))).resize((w, h), Image.NEAREST)
        g = np.array(c) < 150
        # the drawing's silhouette: everything between its outermost lines on each row (the wheels and mirrors included in it as in the render)
        fill = np.zeros_like(g)
        for y in range(h):
            xs = np.nonzero(g[y])[0]
            if len(xs): fill[y, xs.min():xs.max() + 1] = True
        if n == 'side':   # columns: between the top and the bottom lines; the rear wing (a part, not the lump's) cut off at the deck
            fill = np.zeros_like(g)
            for x in range(w):
                ys = np.nonzero(g[:, x])[0]
                if len(ys): fill[ys.min():ys.max() + 1, x] = True
                if 4080 <= (x - org[0]) * 2.75 <= 4560: fill[:int(org[1] - 1012 / 2.75), x] = False
        else:   # the mirrors (parts) out of the drawing's rows: the band they stand in takes the row under it
            r0, r1 = int(org[1] - 1040 / 2.75), int(org[1] - 850 / 2.75)
            for y in range(r0, r1): fill[y] = fill[r1]
        out[n] = (m & fill).sum() / max(1, (m | fill).sum())
    return out
if mode == 'overlay':
    overlay(S).save(OUT); print(match(S))
elif mode == 'lump':
    r = lambda n: Image.open(f'{S}/n33_{n}.png').convert('RGB'); ov = scale(overlay(S), 0.6)
    stack([[lab(trim(r('side')), '측면'), lab(trim(r('front')), '정면'), lab(trim(r('rear')), '뒤')],
           [lab(trim(r('top')), '위'), lab(trim(r('front34')), '앞 3/4'), lab(trim(r('rear34')), '뒤 3/4')],
           [lab(ov, '블루프린트 겹침: 빨강 = 덩어리 실루엣, 파랑 = 그린 선 (평면도는 폭 3.7 % 넓혀, 정면·뒤는 4.3 % 좁혀 1,780 mm에 맞춤)')]],
          OUT, 'R1 · 차체 B (N33 덩어리): 구멍 없음, 민짜 범퍼, 강철 휠, 흐린 패널선, 창문 고르기 전')
    print(match(S))
elif mode == 'dims':
    names = [('stock', '치수 0 (순정 창문 세트를 얹음)'), ('max', sys.argv[4]), ('min', sys.argv[5])]
    im = lambda n, v: Image.open(f'{S}/d_{n}/n33_{v}.png').convert('RGB')
    def box(ims):
        bs = []
        for i in ims:
            a = np.abs(np.array(i).astype(int) - np.array(BG)).sum(2) > 24; ys, xs = np.nonzero(a); bs.append((xs.min(), ys.min(), xs.max(), ys.max()))
        return (min(b[0] for b in bs) - 12, min(b[1] for b in bs) - 12, max(b[2] for b in bs) + 12, max(b[3] for b in bs) + 12)
    sides = [im(n, 'side') for n, _ in names]; B = box(sides); rows = []
    for (n, t), i in zip(names, sides):
        c = i.crop(B); dr = ImageDraw.Draw(c)
        for xmm in (0, 950, 3670, 4675):   # the stock car's nose, axles and tail (5 mm a pixel, the picture's centre at x 2340)
            px = i.width / 2 + (xmm - 2340) / 5 - B[0]; dr.line([(px, 0), (px, c.height)], fill=(60, 110, 200), width=1)
        rows.append([lab(c, t)])
    fr = [im(n, 'front') for n, _ in names]; Bf = box(fr); rows.append([lab(i.crop(Bf), t) for i, t in zip(fr, ['정면: 0', '최대', '최소'])])
    rows.append([lab(trim(im(n, 'front34')), t) for n, t in [('max', '최대 3/4'), ('min', '최소 3/4')]])
    stack(rows, OUT, 'R1 · 차체 B 치수 양 끝 (파란 세로선: 순정 앞끝·앞뒤 차축·뒤끝)')
elif mode == 'photos':
    p1 = Image.open('docs/reference/bnr33/photo_front34_silver_studio.jpg').convert('RGB'); p2 = Image.open('docs/reference/bnr33/photo_rear34_blue.jpg').convert('RGB')
    a, b = trim(Image.open(sys.argv[4]).convert('RGB')), trim(Image.open(sys.argv[5]).convert('RGB'))
    hh = 420; f = lambda i: scale(i, hh / i.height)
    stack([[lab(f(p1), '사진: 앞 3/4'), lab(f(a), '렌더: 덩어리 B (순정 창문 세트)')], [lab(f(p2), '사진: 뒤 3/4'), lab(f(b), '렌더')]], OUT, 'R1 · 사진과 비교 (덩어리라 램프·그릴·윙·미러는 아직 부품이 아님)')
