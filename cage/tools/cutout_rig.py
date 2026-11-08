#!/usr/bin/env python3
"""Flat-colour reference picture -> rigged cut-out parts (atlas + json) for src/Cutout.js.
usage: cutout_rig.py <picture> <out_dir> [--debug]
1. remove the sponsor (green logo), flatten to ~16 solid colours, find the figure (not background)
2. assign every pixel to a body part (front-to-back layers by landmark capsules / colour)
3. fill the areas each part hides behind the parts in front of it (so it can move without holes)
4. write one sprite per part + bone endpoints"""
import sys, json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# ---- landmarks of the reference picture (pixels) ----
LM = dict(
 nk=(445,178), hd=(470,96), hip=(410,415),
 nS=(330,218), nE=(398,335), nW=(478,265),          # near (lead) arm
 fS=(420,222), fE=(522,338), fW=(570,240),          # far (rear) arm
 fH=(362,430), fK=(332,640), fA=(274,826), fHe=(250,852), fT=(346,856),   # far (rear) leg
 nH=(470,440), nK=(496,655), nA=(500,822), nHe=(478,858), nT=(604,856),   # near (lead) leg
)
HEAD_POLY=[(392,70),(412,38),(450,22),(500,26),(535,48),(552,82),(548,115),(530,140),(505,160),(470,168),(444,160),(430,140),(404,118),(392,96)]
GLOVE_N=((515,200),56); GLOVE_F=((585,190),70)

def kmeans(px, k=16, it=12, seed=1):
    rs=np.random.RandomState(seed); C=px[rs.choice(len(px), k, replace=False)].astype(np.float32)
    for _ in range(it):
        d=((px[:,None,:]-C[None])**2).sum(2); L=d.argmin(1)
        for i in range(k):
            m=L==i
            if m.any(): C[i]=px[m].mean(0)
    return C
def assign(img, C):
    h,w,_=img.shape; out=np.zeros((h,w),np.int32); flat=img.reshape(-1,3).astype(np.float32)
    for s in range(0,len(flat),200000):
        d=((flat[s:s+200000,None,:]-C[None])**2).sum(2); out.reshape(-1)[s:s+200000]=d.argmin(1)
    return out
def mode_filter(lab,k,r=1):
    h,w=lab.shape; best=None; bc=None
    for i in range(k):
        m=(lab==i).astype(np.int32); p=np.pad(m,r,mode='edge'); c=np.zeros_like(m)
        for dy in range(2*r+1):
            for dx in range(2*r+1): c+=p[dy:dy+h,dx:dx+w]
        if best is None: best=np.full((h,w),i,np.int32); bc=c
        else:
            u=c>bc; best[u]=i; bc=np.where(u,c,bc)
    return best
def capsule(shape,a,b,r0,r1):
    h,w=shape; ys,xs=np.mgrid[0:h,0:w].astype(np.float32); ax,ay=a; bx,by=b
    dx,dy=bx-ax,by-ay; L2=dx*dx+dy*dy+1e-6; t=np.clip(((xs-ax)*dx+(ys-ay)*dy)/L2,0,1)
    px,py=ax+t*dx,ay+t*dy; d=np.hypot(xs-px,ys-py); r=r0+(r1-r0)*t
    return d<=r
def poly_mask(shape,poly):
    m=Image.new('L',(shape[1],shape[0]),0); ImageDraw.Draw(m).polygon(poly,fill=255); return np.asarray(m)>0
def circle(shape,c,r):
    h,w=shape; ys,xs=np.mgrid[0:h,0:w]; return (xs-c[0])**2+(ys-c[1])**2<=r*r

def main():
    src,outd=sys.argv[1],sys.argv[2]; dbg='--debug' in sys.argv
    os.makedirs(outd,exist_ok=True)
    im=Image.open(src).convert('RGB'); img=np.asarray(im).copy(); H,W,_=img.shape
    # 1) sponsor: green logo pixels -> trunk colour
    r,g,b=[img[...,i].astype(int) for i in range(3)]
    green=(g>r+10)&(g>b+22)&(g>70)
    gm=Image.fromarray((green*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(11))
    green=np.asarray(gm)>0
    gmask=green.copy()
    img=np.asarray(Image.fromarray(img).filter(ImageFilter.MedianFilter(3)))
    # 2) background = the two flat greys of the wall / floor (sampled), the rest is the figure; flatten the figure to solid colours
    wall=np.median(img[5:60,10:120].reshape(-1,3),0); floor=np.median(img[820:890,10:140].reshape(-1,3),0)
    dw=np.abs(img.astype(int)-wall).max(2); df=np.abs(img.astype(int)-floor).max(2)
    bg=(dw<16)|(df<16)
    bg=np.asarray(Image.fromarray((bg*255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5)))>127   # fringe pixels fall to the figure side only when clearly different
    fg=~bg
    K=22; sub=img[fg].reshape(-1,3)[::5].astype(np.float32); C=kmeans(sub,K)
    lab=assign(img,C)
    tr=(lab>=0)&fg&(np.mgrid[0:H,0:W][0]>400)&(np.mgrid[0:H,0:W][0]<540)&(np.mgrid[0:H,0:W][1]>310)&(np.mgrid[0:H,0:W][1]<500)&~gmask
    cnt=np.bincount(lab[tr&(C[lab].mean(2)<70)],minlength=K); lab[gmask]=int(cnt.argmax())
    lab=mode_filter(lab,K,1); lab=mode_filter(lab,K,1)
    flat=C[lab].astype(np.uint8); flat[bg]=(105,105,108)
    Image.fromarray(flat).save(os.path.join(outd,'flat.png'))
    # colour classes
    f=flat.astype(int); R,G,B=f[...,0],f[...,1],f[...,2]; mx=f.max(2); mn=f.min(2); sat=(mx-mn)/np.maximum(mx,1); lum=f.mean(2)
    skin=fg&(R>G)&(G>=B-4)&(R-B>14)&(sat>.12)&(lum>40)&~((lum<62)&(sat<.2))
    neutral=fg&~skin&~((R>G+40)&(R>B+40)&(G<110)&(lum>70))                      # trunks, glove, stripes, text, (hair / beard are dark neutral)
    red=fg&(R>G+40)&(R>B+40)&(G<110)&(lum>70)  # straps
    yy,xx=np.mgrid[0:H,0:W]
    claimed=np.full((H,W),-1,np.int32)
    parts=[]   # (name, region mask, bone p0,p1)
    def claim(name,mask,p0,p1):
        m=mask&fg&(claimed<0); claimed[m]=len(parts); parts.append(dict(name=name,mask=m,p0=p0,p1=p1,rank=len(parts)))
    shape=(H,W)
    # --- front to back ---
    gn=circle(shape,*GLOVE_N)&(neutral|red)&(yy<275)&(xx<560)
    gf=circle(shape,*GLOVE_F)&(neutral|red)&(yy<255)
    nFo=capsule(shape,LM['nE'],LM['nW'],40,30)|gn
    claim('nFo',nFo,LM['nE'],LM['nW'])
    claim('nUp',capsule(shape,LM['nS'],LM['nE'],62,40),LM['nS'],LM['nE'])
    hp=poly_mask(shape,HEAD_POLY)
    claim('head',hp|( (neutral)&circle(shape,(470,110),90)&(yy<175)),LM['nk'],LM['hd'])
    trunks=neutral&(yy>352)&(yy<575)&(xx>285)&(xx<560)
    claim('trunks',trunks,LM['hip'],(LM['hip'][0]+8,LM['hip'][1]+120))
    # legs: split by x under the trunks
    legN=(xx>=425)&(yy>=420); legF=(xx<425)&(yy>=420)
    # near leg
    def legparts(side,Hh,K,A,He,T,region):
        sk=skin&region
        foot=sk&(yy>=A[1]-8)
        shin_mask=sk&~foot
        # thigh vs shin: nearer bone
        def dist(a,b):
            ax,ay=a;bx,by=b;dx,dy=bx-ax,by-ay;L2=dx*dx+dy*dy+1e-6;t=np.clip(((xx-ax)*dx+(yy-ay)*dy)/L2,0,1);return np.hypot(xx-(ax+t*dx),yy-(ay+t*dy))
        dT=dist(Hh,K); dS=dist(K,A)
        thigh=shin_mask&(dT<=dS+6); shin=shin_mask&~thigh
        return thigh,shin,foot
    tN,sN,fN=legparts('n',LM['nH'],LM['nK'],LM['nA'],LM['nHe'],LM['nT'],legN)
    claim('nFoot',fN,LM['nA'],LM['nT']); claim('nShin',sN,LM['nK'],LM['nA']); claim('nThigh',tN,LM['nH'],LM['nK'])
    # torso: every remaining skin pixel above the trunks (neck, chest, back, belly, far arm hidden bits)
    farF=circle(shape,*GLOVE_F)&(neutral|red)
    claim('fFo',capsule(shape,LM['fE'],LM['fW'],32,26)|gf|( (skin)&circle(shape,(585,215),42)&(yy<270)),LM['fE'],LM['fW'])
    claim('fUp',capsule(shape,LM['fS'],LM['fE'],36,32)&(xx>=470),LM['fS'],LM['fE'])
    claim('torso',skin&(yy<425)|(neutral&(yy<=352)&(yy>120)&~hp),LM['hip'],(LM['nk'][0],LM['nk'][1]+28))
    tF,sF,fF=legparts('f',LM['fH'],LM['fK'],LM['fA'],LM['fHe'],LM['fT'],legF)
    claim('fFoot',fF,LM['fA'],LM['fT']); claim('fShin',sF,LM['fK'],LM['fA']); claim('fThigh',tF,LM['fH'],LM['fK'])
    # leftover figure pixels -> nearest part (dilate)
    left=fg&(claimed<0)
    if left.any():
        ids=claimed.copy()
        for _ in range(12):
            nb=np.full((H,W),-1,np.int32)
            for dy,dx in((1,0),(-1,0),(0,1),(0,-1)):
                s=np.roll(np.roll(ids,dy,0),dx,1); nb=np.where((nb<0)&(s>=0),s,nb)
            u=(ids<0)&fg&(nb>=0); ids[u]=nb[u]
        claimed=ids
        for i,p in enumerate(parts): p['mask']=(claimed==i)
    # 3) hidden-area fill: every part gets the pixels of the figure inside its own capsule that parts in front cover
    def fill_region(p):
        n=p['name']
        caps={'nUp':capsule(shape,LM['nS'],LM['nE'],62,44),'nFo':capsule(shape,LM['nE'],LM['nW'],42,32),'fUp':capsule(shape,LM['fS'],LM['fE'],40,34),'fFo':capsule(shape,LM['fE'],LM['fW'],34,28),
              'nThigh':capsule(shape,LM['nH'],LM['nK'],70,50),'nShin':capsule(shape,LM['nK'],LM['nA'],50,36),'fThigh':capsule(shape,LM['fH'],LM['fK'],72,52),'fShin':capsule(shape,LM['fK'],LM['fA'],52,36),
              'torso':capsule(shape,LM['hip'],LM['nk'],104,72),'head':circle(shape,(470,100),82),'trunks':poly_mask(shape,[(295,360),(470,356),(560,430),(560,540),(300,560)]),'nFoot':capsule(shape,LM['nA'],LM['nT'],34,16),'fFoot':capsule(shape,LM['fA'],LM['fT'],34,16)}
        return caps.get(n)
    sprites={}
    for p in parts:
        m=p['mask'].copy(); fr=fill_region(p)
        if fr is not None:
            front=(claimed>=0)&(claimed<p['rank']) if True else None
            hid=fr&fg&(claimed>=0)&(claimed<p['rank'])&~m
            # colour: nearest own pixel (dilate)
            col=np.zeros((H,W,3),np.uint8); have=m.copy(); col[m]=flat[m]
            for _ in range(60):
                if not (hid&~have).any(): break
                for dy,dx in((1,0),(-1,0),(0,1),(0,-1)):
                    s=np.roll(np.roll(have,dy,0),dx,1); sc=np.roll(np.roll(col,dy,0),dx,1)
                    u=(~have)&s&hid; col[u]=sc[u]; have|=u
            m=m|(hid&have)
        else: col=flat
        ys,xs=np.where(m)
        if len(xs)==0: continue
        pad=3; x0,x1,y0,y1=max(0,xs.min()-pad),min(W,xs.max()+pad+1),max(0,ys.min()-pad),min(H,ys.max()+pad+1)
        x0,x1,y0,y1=int(x0),int(x1),int(y0),int(y1);rgba=np.zeros((y1-y0,x1-x0,4),np.uint8); sub=m[y0:y1,x0:x1]
        src_col=(col if fr is not None else flat)[y0:y1,x0:x1]
        # own pixels keep their flat colour; filled ones use the dilated colour
        base=flat[y0:y1,x0:x1].copy(); own=p['mask'][y0:y1,x0:x1]; base[~own]=src_col[~own]
        rgba[...,:3]=base; rgba[...,3]=sub*255
        sprites[p['name']]=(Image.fromarray(rgba,'RGBA'),(x0,y0),p['p0'],p['p1'])
    # pack
    items=sorted(sprites.items(),key=lambda kv:-kv[1][0].height); AW=1100; x=y=rowh=0; place={}
    for k,(im2,off,p0,p1) in items:
        if x+im2.width>AW: x=0; y+=rowh+3; rowh=0
        place[k]=(x,y); x+=im2.width+3; rowh=max(rowh,im2.height)
    atlas=Image.new('RGBA',(AW,y+rowh+3),(0,0,0,0)); meta={'image':'parts.png','w':W,'h':H,'parts':{}}
    for k,(im2,off,p0,p1) in sprites.items():
        ax,ay=place[k]; atlas.paste(im2,(ax,ay)); meta['parts'][k]={'x':ax,'y':ay,'w':im2.width,'h':im2.height,'p0':[p0[0]-off[0],p0[1]-off[1]],'p1':[p1[0]-off[0],p1[1]-off[1]],'off':list(off)}
    meta['lm']={k:list(v) for k,v in LM.items()}
    atlas.save(os.path.join(outd,'parts.png')); json.dump(meta,open(os.path.join(outd,'parts.json'),'w'))
    if dbg:
        cols=[(230,60,60),(60,200,90),(70,110,230),(240,200,60),(200,80,220),(60,210,210),(250,140,40),(140,140,255),(120,255,120),(255,120,160),(160,100,60),(90,160,120),(200,200,200),(255,255,255),(120,60,200),(60,60,60)]
        vis=np.zeros((H,W,3),np.uint8)+110
        for i,p in enumerate(parts): vis[p['mask']]=cols[i%len(cols)]
        v=Image.fromarray(vis); d=ImageDraw.Draw(v)
        for i,p in enumerate(parts):
            ys,xs=np.where(p['mask']);
            if len(xs): d.text((int(xs.mean())-14,int(ys.mean())-5),p['name'],fill=(0,0,0))
        v.save(os.path.join(outd,'debug_parts.png'))
    print(len(parts),'parts',atlas.size)
main()
