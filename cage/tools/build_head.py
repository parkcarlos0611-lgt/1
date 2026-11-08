"""Builds the head / neck sprites of a curated fighter from a flat-colour close-up of the head.
usage: build_head.py closeup.jpg out_dir  (geometry for Anderson Silva is set below; copy and edit for another fighter)"""
import sys,json
from PIL import Image,ImageFilter
import numpy as np
src,out=sys.argv[1],sys.argv[2]
S=2.36                                  # close-up px -> sprite px (head height ~484)
im=Image.open(src).convert('RGB');W,H=im.size
big=im.resize((round(W*S),round(H*S)),Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.2,70,2))
a=np.asarray(big).astype(float);bg=np.array([100,100,102.])
dist=np.sqrt(((a-bg)**2).sum(2))
al=np.clip((dist-16)/16,0,1)
# the backdrop is one flat colour: alpha straight from the colour distance, edge softened a little
al=np.asarray(Image.fromarray((al*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.7))).astype(float)/255
al=np.clip(al*1.25,0,1)
CH=round(259*S)+24                      # canvas height (24 rows of neck extension)
CW=big.size[0]
rgba=np.zeros((CH,CW,4),np.uint8);rgba[:big.size[1],:,:3]=np.asarray(big);rgba[:big.size[1],:,3]=(al*255).astype(np.uint8)
rgba[big.size[1]:,:,:]=rgba[big.size[1]-3:big.size[1]-2,:,:]          # extend the bottom rows downward
Y=lambda y:round(y*S);X=lambda x:round(x*S)
yy,xx=np.mgrid[0:CH,0:CW]
neckTop=Y(178)
# line behind the jaw (close-up coords): ear bottom -> jaw angle -> under the chin
jaw=[(100,178),(122,197),(145,222),(167,247),(172,259),(172,270)]
def jx(y):
    ys=[Y(p[1]) for p in jaw];xs=[X(p[0]) for p in jaw];return np.interp(y,ys,xs)
# head keeps: everything above neckTop, and below it only what is right of the jaw line
headm=(yy<neckTop)|(xx>jx(yy)-4)
# neck piece: from neckTop down, between the back-of-neck line and a few px past the jaw line
bx=lambda y:np.interp(y,[Y(178),Y(215),CH],[X(62),X(62),X(74)])
fx=lambda y:np.interp(y,[Y(178),Y(247),CH],[X(104),X(170),X(160)])
neckm=(yy>=neckTop)&(xx>=bx(yy))&(xx<=np.maximum(fx(yy),jx(yy)+8))
head=rgba.copy();head[...,3]=(rgba[...,3]*headm).astype(np.uint8)
neck=rgba.copy();neck[...,3]=(rgba[...,3]*neckm).astype(np.uint8)
# the neck piece must be opaque inside its outline (the extension rows were copied from fully opaque bottom row)
Image.fromarray(head).save(out+'/head.png');Image.fromarray(neck).save(out+'/neck.png')
rows=[None]*CH
na=neck[...,3]
for y in range(neckTop,CH):
    xs=np.where(na[y]>128)[0]
    if len(xs):rows[y]=[int(xs[0]),int(xs[-1])]
top=Y(42);bot=Y(247)
meta=dict(image='head.png',w=CW,h=CH,off=[0,0],p0=[X(144),(top+bot)//2],p1=[X(144),CH],headH=bot-top,neck='neck.png',neckTop=neckTop,neckBot=CH,neckPivot=[X(115),CH],neckRows=rows,
 fx=dict(G=dict(eye=[X(197),Y(133)],brow=[X(205),Y(113)],brow2=[X(178),Y(118)],nose=[X(224),Y(160)],cheek=[X(175),Y(162)],fore=[X(165),Y(75)],lip=[X(222),Y(190)],u=44,down=1),mouth=[X(222),Y(192),38,16],lid='#8d5c34'))
json.dump(meta,open(out+'/head2.json','w'))
print(meta['headH'],meta['p0'],meta['neckTop'],CW,CH)
