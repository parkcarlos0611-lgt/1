# The F1 pictures (docs/systems/115 F1): the lump "차체 A" with the blueprint overlay and its glass sets, and the frame's
# dimensions at both ends of their ranges, from the renders of tools/ref/p959.ts:
#   npx tsx tools/ref/p959.ts <d>/lump mm=4 lump masks only=side,front,rear,top,front34,rear34
#   npx tsx tools/ref/p959.ts <d>/g_<set> mm=6 lump glass=<set> only=front34,rear34        (set: stock, noQuarter, louvre)
#   npx tsx tools/ref/p959.ts <d>/d_<stock|max|min> mm=5 at=2280,0,600 lump glass=stock only=side,front,front34 dims=<k:v,...>
#   python3 tools/ref/f1_sheets.py <d> <out.png> lump|dims
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
S, OUT = sys.argv[1], sys.argv[2]; BG = (206, 202, 192)
F = ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 22)
bp = Image.open('docs/reference/959/bp_canepa_4view.jpg').convert('RGB')
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
def lay(d, mask, at, origin):
    rgb = np.array(Image.open(f'{d}/{mask}').convert('RGB')); ln = (rgb[..., 0] == 128) & (rgb[..., 1] == 0); a = Image.fromarray(np.where(ln | (rgb[..., 0] < 100), 255, 0).astype('uint8')); w, h = a.size
    x0, y0 = at[0] - origin[0] / 2, at[1] - origin[1] / 2; c = bp.crop((int(x0), int(y0), int(x0 + w / 2), int(y0 + h / 2))).resize((w, h), Image.LANCZOS)
    edge = (np.array(a.filter(ImageFilter.MaxFilter(3))) > 128) & ~(np.array(a.filter(ImageFilter.MinFilter(3))) > 128); arr = np.array(c).astype(float) * 0.75 + 60; arr[edge] = [230, 0, 40]; arr[ln] = [20, 20, 255]; return Image.fromarray(arr.astype('uint8'))
mode = sys.argv[3]
if mode == 'lump':
    d = f'{S}/lump'; r = lambda n: Image.open(f'{d}/p959_{n}.png').convert('RGB')
    side, plan, front, rear = lay(d, 'mask_side.png', (57, 331), (40, 500)), lay(d, 'mask_plan.png', (56, 628.5), (40, 380)), lay(d, 'mask_front.png', (1053.5, 331), (380, 500)), lay(d, 'mask_rear.png', (1050.5, 748), (380, 500))
    ov = Image.new('RGB', (side.width + front.width, side.height + plan.height), (255, 255, 255)); ov.paste(side, (0, 0)); ov.paste(front, (side.width, 0)); ov.paste(plan, (0, side.height)); ov.paste(rear, (side.width, side.height)); ov = scale(ov, 0.62)
    g = lambda n, v: trim(Image.open(f'{S}/g_{n}/p959_{v}.png').convert('RGB'))
    none34 = scale(trim(r('front34')), 4 / 6)
    stack([[lab(trim(r('side')), '측면'), lab(trim(r('front')), '정면'), lab(trim(r('rear')), '뒤')],
           [lab(trim(r('front34')), '앞 3/4'), lab(trim(r('rear34')), '뒤 3/4')],
           [lab(ov, '블루프린트 겹침: 빨강 = 덩어리 실루엣, 파랑 = 그린 선(흐린 패널선만)')],
           [lab(none34, '창문 고르기 전: 캐빈도 차체 색'), lab(g('stock', 'front34'), '창문 세트: 순정'), lab(g('noQuarter', 'front34'), '쿼터 유리 없음'), lab(g('louvre', 'rear34'), '뒤 유리 루버 (뒤에서)')]],
          OUT, 'F1 · 차체 A (599형 덩어리): 구멍 없음, 민짜 범퍼, 강철 휠, 흐린 패널선, 부품 없음')
else:
    names = [('stock', '치수 0 (순정 창문 세트를 얹음)'), ('max', '최대: 앞 오버행 +80, 휠베이스 +150, 뒤 오버행 +80, 폭 +60, 지붕 +40, 지상고 +40'), ('min', '최소: 앞 오버행 -80, 휠베이스 -150, 뒤 오버행 -60, 폭 -60, 지붕 -40, 지상고 -30')]
    im = lambda n, v: Image.open(f'{S}/d_{n}/p959_{v}.png').convert('RGB')
    def box(ims):
        bs = []
        for i in ims:
            a = np.abs(np.array(i).astype(int) - np.array(BG)).sum(2) > 24; ys, xs = np.nonzero(a); bs.append((xs.min(), ys.min(), xs.max(), ys.max()))
        return (min(b[0] for b in bs) - 12, min(b[1] for b in bs) - 12, max(b[2] for b in bs) + 12, max(b[3] for b in bs) + 12)
    sides = [im(n, 'side') for n, _ in names]; B = box(sides); rows = []
    for (n, t), i in zip(names, sides):
        c = i.crop(B); dr = ImageDraw.Draw(c)
        for xmm in (0, 940, 3212, 4260):   # the stock car's nose, axles and tail (5 mm a pixel, the picture's centre at x 2280)
            px = i.width / 2 + (xmm - 2280) / 5 - B[0]; dr.line([(px, 0), (px, c.height)], fill=(60, 110, 200), width=1)
        rows.append([lab(c, t)])
    fr = [im(n, 'front') for n, _ in names]; Bf = box(fr); rows.append([lab(i.crop(Bf), t) for i, t in zip(fr, ['정면: 0', '최대', '최소'])])
    rows.append([lab(trim(im(n, 'front34')), t) for n, t in [('max', '최대 3/4'), ('min', '최소 3/4')]])
    stack(rows, OUT, 'F1 · 차체 A 치수 양 끝 (파란 세로선: 순정 앞끝·앞뒤 차축·뒤끝)')
