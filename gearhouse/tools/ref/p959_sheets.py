# The 959's comparison sheets (docs/systems/109): the pictures of tools/ref/p959.ts beside the blueprint at the same scale.
#   npx tsx tools/ref/p959.ts <dir> mm=4 masks && python3 tools/ref/p959_sheets.py <dir> docs/reference 4
# Writes 959_side.png, 959_front_rear.png, 959_top.png, 959_34.png, 959_cage.png, 959_overlay.png.
import sys
import numpy as np
from PIL import Image, ImageFilter
d, out, mm = sys.argv[1], sys.argv[2], float(sys.argv[3]); BG = (206, 202, 192)
bp = Image.open('docs/reference/959/bp_canepa_4view.jpg').convert('RGB'); K = 4260 / 730   # mm a blueprint pixel
r = lambda n: Image.open(f'{d}/p959_{n}.png').convert('RGB')
def crop(box):   # a piece of the blueprint, scaled to the pictures' millimetres a pixel
    c = bp.crop(box); return c.resize((round(c.width * K / mm), round(c.height * K / mm)), Image.LANCZOS)
def trim(im, pad=24):   # a picture cut to what is drawn on it
    a = np.abs(np.array(im).astype(int) - np.array(BG)).sum(2) > 24; ys, xs = np.nonzero(a); return im.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(im.width, xs.max() + pad), min(im.height, ys.max() + pad)))
def stack(rows, name):   # rows of pictures, each row centred
    rs = [[i for i in row] for row in rows]; W = max(sum(i.width for i in row) + 20 * (len(row) - 1) for row in rs) + 40; H = sum(max(i.height for i in row) for row in rs) + 20 * (len(rs) + 1)
    o = Image.new('RGB', (W, H), BG); y = 20
    for row in rs:
        h = max(i.height for i in row); x = (W - sum(i.width for i in row) - 20 * (len(row) - 1)) // 2
        for i in row: o.paste(i, (x, y + (h - i.height) // 2)); x += i.width + 20
        y += h + 20
    o.save(f'{out}/{name}.png')
stack([[crop((30, 95, 815, 350))], [trim(r('side'))]], '959_side')
stack([[crop((880, 100, 1230, 350)), trim(r('front'))], [crop((880, 515, 1230, 765)), trim(r('rear'))]], '959_front_rear')
stack([[crop((40, 455, 805, 800))], [trim(r('top'))]], '959_top')
stack([[trim(r('front34')), trim(r('rear34'))], [trim(r('high34')), trim(r('rearhigh'))]], '959_34')
stack([[trim(r('cage_front34')), trim(r('wire_front34'))], [trim(r('cage_rear34')), trim(r('rear34'))]], '959_cage')
# the silhouettes (red) and the drawn lines (blue) over the blueprint at twice its size
def lay(mask, at, origin):
    rgb = np.array(Image.open(f'{d}/{mask}').convert('RGB')); ln = (rgb[..., 0] == 128) & (rgb[..., 1] == 0); a = Image.fromarray(np.where(ln | (rgb[..., 0] < 100), 255, 0).astype('uint8')); w, h = a.size
    x0, y0 = at[0] - origin[0] / 2, at[1] - origin[1] / 2; c = bp.crop((int(x0), int(y0), int(x0 + w / 2), int(y0 + h / 2))).resize((w, h), Image.LANCZOS)
    edge = (np.array(a.filter(ImageFilter.MaxFilter(3))) > 128) & ~(np.array(a.filter(ImageFilter.MinFilter(3))) > 128); arr = np.array(c).astype(float) * 0.75 + 60; arr[edge] = [230, 0, 40]; arr[ln] = [20, 20, 255]; return Image.fromarray(arr.astype('uint8'))
side, plan, front, rear = lay('mask_side.png', (57, 331), (40, 500)), lay('mask_plan.png', (56, 628.5), (40, 380)), lay('mask_front.png', (1053.5, 331), (380, 500)), lay('mask_rear.png', (1050.5, 748), (380, 500))
o = Image.new('RGB', (side.width + front.width, side.height + plan.height), (255, 255, 255)); o.paste(side, (0, 0)); o.paste(front, (side.width, 0)); o.paste(plan, (0, side.height)); o.paste(rear, (side.width, side.height))
o.resize((o.width * 3 // 4, o.height * 3 // 4), Image.LANCZOS).save(f'{out}/959_overlay.png')
