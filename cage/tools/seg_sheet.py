from PIL import Image,ImageFilter
import numpy as np
from collections import deque
im=Image.open('/root/.claude/uploads/c35ca113-a7b2-5757-a4d1-3b6dd4ab5092/d3cdf6f2-image.png').convert('RGB');A=np.array(im).astype(int)
def mask_of(box,thr=226,close=15):
    x0,y0,x1,y1=box;sub=A[y0:y1,x0:x1];m=(sub[...,0]>=thr).astype(np.uint8)*255
    mi=Image.fromarray(m).filter(ImageFilter.MaxFilter(close)).filter(ImageFilter.MinFilter(close))
    m=np.array(mi)>128
    # largest CC
    H,W=m.shape;lab=np.zeros((H,W),np.int32);best=(0,0);k=0
    for y in range(H):
        for x in np.nonzero(m[y]&(lab[y]==0))[0]:
            if lab[y,x]:continue
            k+=1;q=deque([(y,x)]);lab[y,x]=k;n=0
            while q:
                cy,cx=q.popleft();n+=1
                for ny,nx in((cy+1,cx),(cy-1,cx),(cy,cx+1),(cy,cx-1)):
                    if 0<=ny<H and 0<=nx<W and m[ny,nx] and not lab[ny,nx]:lab[ny,nx]=k;q.append((ny,nx))
            if n>best[0]:best=(n,k)
    m=lab==best[1]
    # fill holes: flood from border on background
    bg=~m;seen=np.zeros_like(m);q=deque()
    for y in range(H):
        for x in(0,W-1):
            if bg[y,x]:seen[y,x]=1;q.append((y,x))
    for x in range(W):
        for y in(0,H-1):
            if bg[y,x] and not seen[y,x]:seen[y,x]=1;q.append((y,x))
    while q:
        cy,cx=q.popleft()
        for ny,nx in((cy+1,cx),(cy-1,cx),(cy,cx+1),(cy,cx-1)):
            if 0<=ny<H and 0<=nx<W and bg[ny,nx] and not seen[ny,nx]:seen[ny,nx]=1;q.append((ny,nx))
    return ~seen
def cut(box,name,**kw):
    m=mask_of(box,**kw);x0,y0,x1,y1=box;sub=np.array(im.crop(box)).copy()
    ys,xs=np.nonzero(m);bb=(xs.min(),ys.min(),xs.max()+1,ys.max()+1)
    rgba=np.dstack([sub,(m*255).astype(np.uint8)]);out=Image.fromarray(rgba).crop(bb);out.save('bt/'+name+'.png');return out
if __name__=='__main__':
    parts={'arm1':(895,300,1030,650),'arm2':(1090,300,1240,650),'arm3':(1235,300,1345,650),'arm4':(1400,300,1520,650),
           'fa5':(1305,455,1380,650),'fa6':(1385,455,1445,650)}
    outs=[cut(b,n) for n,b in parts.items()]
    W=sum(o.width+20 for o in outs);H=max(o.height for o in outs);sheet=Image.new('RGBA',(W,H),(60,60,70,255));x=0
    for o in outs:sheet.alpha_composite(o,(x,0));x+=o.width+20
    sheet.convert('RGB').save('bt/arms_cut.png');print(sheet.size,[o.size for o in outs])
