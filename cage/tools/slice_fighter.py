#!/usr/bin/env python3
"""Cut a full-body side-view fighter picture into body-part textures (+ atlas json) for src/TexMesh.js.
usage: slice_fighter.py <full_body.png> <out_dir> [--sheet]
Landmarks/polygons below are in the pixel space of the reference picture (1312x1199, Kane Velasquez pose).
A new fighter picture in the SAME pose/framing is first scaled+shifted so its figure bbox equals the reference bbox."""
import sys, json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

REF_BBOX = (268, 14, 1004, 1166)          # figure bbox of the reference picture (x0,y0,x1,y1)
# name: (polygon, bone p0, bone p1, draw layer) -- bones are joint centres in picture pixels
PARTS = {
 'head':   ([(634,120),(640,85),(668,45),(705,20),(745,15),(780,40),(792,75),(792,100),(800,125),(789,137),(792,150),(780,160),(775,178),(752,196),(735,205),(712,215),(680,225),(640,200),(628,160)], (703,203),(737,108)),
 'torso':  ([(499,178),(540,160),(590,150),(640,175),(700,205),(740,240),(745,330),(725,430),(705,505),(700,560),(470,560),(485,500),(496,450),(480,400),(461,330),(456,270),(468,225)], (585,545),(660,215)),
 'pelvis': ([(458,500),(690,500),(702,560),(702,645),(430,645),(446,560)], (585,545),(585,640)),
 'thigh_f':([(430,600),(612,600),(612,745),(600,760),(560,800),(525,848),(505,870),(450,885),(395,870),(375,848),(404,812),(429,789),(443,722),(421,712),(446,640)], (520,590),(450,845)),
 'shin_f': ([(375,848),(395,870),(450,885),(505,870),(525,848),(454,948),(400,1006),(358,1089),(358,1100),(300,1100),(300,1089),(325,1006),(350,906)], (450,845),(330,1085)),
 'thigh_n':([(612,600),(830,600),(828,693),(850,730),(875,764),(879,793),(871,822),(830,835),(780,840),(762,830),(717,790),(654,790),(612,775)], (690,590),(845,805)),
 'shin_n': ([(762,830),(780,840),(830,835),(871,822),(871,922),(871,1014),(875,1081),(850,1100),(792,1100),(792,1081),(787,1014),(771,931),(758,889)], (845,805),(835,1088)),
 'foot':   ([(792,1081),(875,1081),(880,1100),(930,1125),(990,1135),(1003,1148),(980,1158),(900,1162),(810,1162),(790,1150),(790,1120)], (835,1088),(1000,1148)),
 'uarm_f': ([(700,300),(740,300),(775,340),(790,390),(795,440),(790,470),(750,465),(722,440),(714,400),(708,350)], (722,300),(785,440)),
 'farm_f': ([(745,440),(775,372),(800,355),(822,340),(822,305),(800,285),(782,265),(790,255),(830,252),(880,255),(920,262),(940,285),(935,330),(915,350),(900,385),(870,425),(830,460),(800,478),(765,470)], (785,445),(880,300)),
 'uarm_n': ([(470,215),(500,180),(540,175),(590,215),(605,270),(600,335),(640,400),(650,440),(625,462),(585,463),(540,455),(490,432),(470,380),(455,300),(458,260)], (510,265),(590,430)),
 'farm_n': ([(560,365),(600,345),(660,330),(682,300),(703,285),(712,255),(722,215),(745,198),(790,203),(822,230),(822,262),(805,285),(775,300),(758,330),(745,345),(725,360),(690,385),(650,430),(625,462),(590,462),(570,430),(553,395)], (590,430),(765,262)),
}
HOLES_FOR_TORSO = ['uarm_n','farm_n','uarm_f','farm_f']
LABEL = {'head':'HEAD (+neck)','torso':'TORSO (arms removed, filled)','pelvis':'PELVIS / SHORTS WAIST','thigh_f':'THIGH far (back leg)','shin_f':'SHIN far','thigh_n':'THIGH near (front leg)','shin_n':'SHIN near','foot':'FOOT','uarm_f':'UPPER ARM far','farm_f':'FOREARM + GLOVE far','uarm_n':'UPPER ARM near','farm_n':'FOREARM + GLOVE near'}

def figure_alpha(im):
    a = np.asarray(im.convert('RGB')).astype(np.int16)
    white = (a.min(axis=2) > 236)
    H, W = white.shape
    bg = np.zeros_like(white); st = [(0,0),(W-1,0),(0,H-1),(W-1,H-1)]
    for s in st:
        if white[s[1], s[0]]: bg[s[1], s[0]] = True
    stack = [p for p in st if bg[p[1], p[0]]]
    while stack:
        x, y = stack.pop()
        for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0 <= nx < W and 0 <= ny < H and white[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True; stack.append((nx, ny))
    m = Image.fromarray(((~bg)*255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.8))
    return np.asarray(m).astype(np.float32)/255

def poly_mask(size, poly, blur=.8):
    m = Image.new('L', size, 0); ImageDraw.Draw(m).polygon(poly, fill=255)
    return np.asarray(m.filter(ImageFilter.GaussianBlur(blur))).astype(np.float32)/255

def inpaint(rgb, known, region, iters=400):
    """diffusion fill of `region` (bool) from `known` (bool) pixels"""
    out = rgb.copy().astype(np.float32); cur = known.copy()
    # seed unknown with the mean of known
    out[~cur] = out[cur].mean(axis=0) if cur.any() else 128
    for it in range(iters):
        p = np.pad(out, ((1,1),(1,1),(0,0)), mode='edge')
        avg = (p[:-2,1:-1]+p[2:,1:-1]+p[1:-1,:-2]+p[1:-1,2:])/4
        upd = region & ~known
        out[upd] = avg[upd]
    return out

def main():
    src, outd = sys.argv[1], sys.argv[2]; sheet = '--sheet' in sys.argv
    os.makedirs(outd, exist_ok=True)
    im = Image.open(src).convert('RGB')
    fa = figure_alpha(im)
    ys, xs = np.where(fa > .5); bb = (xs.min(), ys.min(), xs.max(), ys.max())
    if tuple(bb) != REF_BBOX and '--noalign' not in sys.argv and im.size != (1312,1199) or (bb[2]-bb[0]) and abs((bb[3]-bb[1])-(REF_BBOX[3]-REF_BBOX[1])) > 12:
        sx = (REF_BBOX[2]-REF_BBOX[0])/(bb[2]-bb[0]+1); sy = (REF_BBOX[3]-REF_BBOX[1])/(bb[3]-bb[1]+1)
        crop = im.crop((bb[0], bb[1], bb[2]+1, bb[3]+1)).resize((REF_BBOX[2]-REF_BBOX[0]+1, REF_BBOX[3]-REF_BBOX[1]+1), Image.LANCZOS)
        canvas = Image.new('RGB', (1312,1199), (255,255,255)); canvas.paste(crop, (REF_BBOX[0], REF_BBOX[1])); im = canvas; fa = figure_alpha(im)
    rgb = np.asarray(im).astype(np.float32); S = im.size
    pm = {k: poly_mask(S, v[0]) for k, v in PARTS.items()}
    # occlusion: the far arm is hidden behind the near arm/glove, the far leg behind the near leg
    near_arm = np.maximum(pm['uarm_n'], pm['farm_n'])
    for k in ('uarm_f','farm_f'): pm[k] = pm[k]*(1-np.clip(near_arm*1.6,0,1))
    # torso: remove arms, then fill the holes from the surrounding skin
    armm = np.maximum.reduce([pm[k] for k in HOLES_FOR_TORSO])
    tor = pm['torso']; hole = (tor > .5) & (armm > .15)
    lum = rgb.mean(axis=2); skin = (rgb[...,0] > rgb[...,1]+12) & (rgb[...,1] > rgb[...,2]) & (lum > 125) & (lum < 225)
    known = (tor > .5) & ~hole & (fa > .5) & skin
    fill = inpaint(rgb, known, (tor > .5), 500)
    # light vertical shading so the filled chest does not look flat
    torso_rgb = np.where(hole[..., None], fill, rgb)
    tex = {}
    for k, (poly, p0, p1) in PARTS.items():
        src_rgb = torso_rgb if k == 'torso' else rgb
        a = pm[k]*fa if k != 'torso' else pm[k]*np.maximum(fa, hole.astype(np.float32))
        # far-arm hidden parts: also keep what the near arm covered (filled)
        xs_ = [p[0] for p in poly]; ys_ = [p[1] for p in poly]
        box = (max(0,min(xs_)-3), max(0,min(ys_)-3), min(S[0],max(xs_)+4), min(S[1],max(ys_)+4))
        rgba = np.dstack([src_rgb, a*255]).astype(np.uint8)
        part = Image.fromarray(rgba, 'RGBA').crop(box)
        tex[k] = (part, box, p0, p1)
    # pack: shelf packer
    items = sorted(tex.items(), key=lambda kv: -kv[1][0].height)
    AW = 1900; x = y = rowh = 0; place = {}
    for k, (img, box, p0, p1) in items:
        if x + img.width > AW: x = 0; y += rowh + 4; rowh = 0
        place[k] = (x, y); x += img.width + 4; rowh = max(rowh, img.height)
    AH = y + rowh + 4
    atlas = Image.new('RGBA', (AW, AH), (0,0,0,0))
    meta = {'image': 'parts.png', 'refH': REF_BBOX[3]-REF_BBOX[1], 'parts': {}}
    for k, (img, box, p0, p1) in tex.items():
        ax, ay = place[k]; atlas.paste(img, (ax, ay))
        meta['parts'][k] = {'x': ax, 'y': ay, 'w': img.width, 'h': img.height,
                            'p0': [p0[0]-box[0], p0[1]-box[1]], 'p1': [p1[0]-box[0], p1[1]-box[1]]}
    # landmarks on the head for wounds (picture px -> head part local)
    hb = tex['head'][1]
    meta['marks'] = {'brow':[772-hb[0],92-hb[1]], 'eye':[765-hb[0],100-hb[1]], 'nose':[790-hb[0],126-hb[1]], 'cheek':[755-hb[0],140-hb[1]], 'lip':[778-hb[0],163-hb[1]], 'chin':[760-hb[0],188-hb[1]], 'ear':[678-hb[0],108-hb[1]], 'fore':[750-hb[0],55-hb[1]]}
    atlas.save(os.path.join(outd, 'parts.png'), optimize=True)
    json.dump(meta, open(os.path.join(outd, 'parts.json'), 'w'), indent=1)
    if sheet:
        # exploded sheet with labels, white background (for the ChatGPT reference)
        cols = 4; cw, ch = 470, 560; rows = (len(tex)+cols-1)//cols
        sh = Image.new('RGB', (cols*cw, rows*ch + 60), (255,255,255)); d = ImageDraw.Draw(sh)
        try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20)
        except Exception: f = ImageFont.load_default()
        d.text((12, 12), 'FIGHTER PART SHEET - each part is a separate texture; red dots = joint pivots (p0 -> p1)', fill=(0,0,0), font=f)
        order = ['head','torso','pelvis','uarm_n','farm_n','uarm_f','farm_f','thigh_n','shin_n','thigh_f','shin_f','foot']
        for i, k in enumerate(order):
            img, box, p0, p1 = tex[k]; cx = (i % cols)*cw; cy = 60 + (i//cols)*ch
            s = min((cw-30)/img.width, (ch-70)/img.height, 1.6); im2 = img.resize((max(1,int(img.width*s)), max(1,int(img.height*s))), Image.LANCZOS)
            ox = cx + (cw-im2.width)//2; oy = cy + 34 + (ch-70-im2.height)//2
            d.rectangle([cx+6, cy+4, cx+cw-6, cy+ch-6], outline=(200,200,200))
            d.text((cx+14, cy+10), LABEL[k], fill=(0,0,0), font=f)
            sh.paste(im2, (ox, oy), im2)
            for q, c in ((p0,(220,0,0)),(p1,(0,90,255))):
                qx = ox + (q[0]-box[0])*s; qy = oy + (q[1]-box[1])*s; d.ellipse([qx-6,qy-6,qx+6,qy+6], outline=c, width=3)
        sh.save(os.path.join(outd, 'part_sheet.png'))
if __name__ == '__main__': main()
