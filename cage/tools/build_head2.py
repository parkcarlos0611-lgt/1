"""Head / neck sprites from a FULL-BODY flat illustration (side view, facing right, flat grey backdrop).
usage: build_head2.py <fighter key> <full_body_image> <out_dir>
Geometry is in source-image pixels. Produces head.png / neck.png / head2.json like tools/build_head.py."""
import sys,json
from PIL import Image,ImageFilter
import numpy as np
CFG={
 'pereira':dict(top=25,chin=203,back=530,nose=693,neckTop=143,
   jaw=[(577,143),(598,152),(610,170),(625,190),(640,205),(660,215),(660,260)],
   backN=[(143,537),(180,527),(200,527),(260,530)],frontN=[(143,600),(200,620),(260,610)],
   eye=(658,108),brow=(663,97),brow2=(643,100),nosef=(678,135),cheek=(637,128),fore=(637,67),lip=(675,160),mouth=(673,165,38,16),lid='#b97d4a'),
 'fedor':dict(taper=(40,13),ntaper=(40,12),top=36,chin=213,back=535,nose=703,neckTop=162,cut=3,clipX=690,
   jaw=[(597,162),(605,187),(633,203),(657,218),(690,222)],
   backN=[(162,537),(200,528),(285,530)],frontN=[(162,605),(220,628),(285,610)],
   eye=(670,123),brow=(680,115),brow2=(660,119),nosef=(693,155),cheek=(663,143),fore=(653,77),lip=(685,175),mouth=(687,180,38,16),lid='#d99a6d'),
 'pereira2':dict(top=25,chin=208,back=533,nose=697,neckTop=150,cut=3,clipX=688,
   jaw=[(597,150),(607,173),(633,193),(653,203),(677,208),(690,212)],
   backN=[(150,537),(180,528),(285,530)],frontN=[(150,600),(210,625),(285,610)],
   eye=(663,110),brow=(667,98),brow2=(650,100),nosef=(683,143),cheek=(653,130),fore=(657,63),lip=(673,163),mouth=(675,167,38,16),lid='#b97d4a'),
 'cropcop':dict(taper=(40,13),ntaper=(40,12),top=15,chin=203,back=508,nose=673,neckTop=150,cut=2,clipX=655,
   jaw=[(573,150),(587,173),(613,192),(633,200),(655,203)],
   backN=[(150,510),(180,500),(285,505)],frontN=[(150,580),(205,615),(285,600)],
   eye=(640,112),brow=(643,103),brow2=(630,107),nosef=(663,143),cheek=(633,140),fore=(633,57),lip=(653,165),mouth=(655,168,38,16),lid='#e09a70'),
 'adesanya':dict(top=23,chin=213,back=513,nose=680,neckTop=153,
   jaw=[(570,152),(593,173),(613,197),(633,208),(650,216),(660,222),(660,270)],
   backN=[(153,537),(180,527),(200,520),(270,524)],frontN=[(153,590),(203,618),(270,610)],
   eye=(650,118),brow=(657,107),brow2=(637,112),nosef=(669,147),cheek=(640,138),fore=(633,67),lip=(667,173),mouth=(667,177,38,16),lid='#7d4a26'),
}
key,src,out=sys.argv[1],sys.argv[2],sys.argv[3];C=CFG[key]
im=Image.open(src).convert('RGB')
y1=C['neckTop']+120                                   # source rows kept below the ear
S=484/(C['chin']-C['top'])
x0=C['back']-40;x1=C['nose']+40
crop=im.crop((x0,0,x1,y1))
W0,H0=crop.size
big=crop.resize((round(W0*S),round(H0*S)),Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.2,60,2))
a=np.asarray(big).astype(float);bg=np.array(im.getpixel((8,8)),float)
dist=np.sqrt(((a-bg)**2).sum(2));al=np.clip((dist-16)/16,0,1)
al=np.asarray(Image.fromarray((al*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.7))).astype(float)/255;al=np.clip(al*1.25,0,1)
X=lambda x:round((x-x0)*S);Y=lambda y:round(y*S)
neckTop=Y(C['neckTop']);CH=neckTop+230;CW=big.size[0]
rgba=np.zeros((CH,CW,4),np.uint8);hh=min(CH,big.size[1])
rgba[:hh,:,:3]=np.asarray(big)[:hh];rgba[:hh,:,3]=(al*255).astype(np.uint8)[:hh]
if big.size[1]<CH:rgba[big.size[1]:,:,:]=rgba[big.size[1]-3:big.size[1]-2,:,:]
yy,xx=np.mgrid[0:CH,0:CW]
jy=[Y(p[1]) for p in C['jaw']];jx=[X(p[0]) for p in C['jaw']]
jline=lambda y:np.interp(y,jy,jx)
headm=((yy<neckTop+10)|(xx>jline(yy)-4))&(yy<Y(C['chin'])+C.get('cut',12))&((xx<X(C.get('clipX',9999)))|(yy<Y(C['chin'])-10))   # nothing below the chin: the glove / shoulder of the full-body art stays out
by=[Y(p[0]) for p in C['backN']];bx=[X(p[1]) for p in C['backN']];fy=[Y(p[0]) for p in C['frontN']];fx=[X(p[1]) for p in C['frontN']]
neckm=(yy>=neckTop)&(xx>=np.interp(yy,by,bx))&(xx<=np.interp(yy,fy,fx))
if 'taper' in C:   # round off the skull's lower-back corner so no spur sticks out behind the neck when it bends
    ta,dx=C['taper'];xs=np.interp(yy,[neckTop-Y(ta),neckTop+10],[X(C['back'])-6,X(C['back'])+Y(dx)])
    headm=headm&(xx>=xs)
head=rgba.copy();head[...,3]=(rgba[...,3]*headm).astype(np.uint8)
if 'ntaper' in C:   # the neck piece's top-back corner is rounded off too
    nl,nd=C['ntaper'];b0=np.interp(neckTop,by,bx);neckm=neckm&(xx>=np.interp(yy,[neckTop,neckTop+Y(nl)],[b0+Y(nd),b0]))
neck=rgba.copy();neck[...,3]=(rgba[...,3]*neckm).astype(np.uint8)
Image.fromarray(head).save(out+'/head.png');Image.fromarray(neck).save(out+'/neck.png')
rows=[None]*CH;na=neck[...,3]
for y in range(neckTop,CH):
    xs=np.where(na[y]>128)[0]
    if len(xs):rows[y]=[int(xs[0]),int(xs[-1])]
top=Y(C['top']);bot=Y(C['chin']);last=rows[CH-1] or rows[CH-5]
P=lambda p:[X(p[0]),Y(p[1])]
meta=dict(image='head.png',w=CW,h=CH,off=[0,0],p0=[X((C['back']+C['nose'])/2),(top+bot)//2],p1=[X((C['back']+C['nose'])/2),CH],headH=bot-top,neck='neck.png',neckTop=neckTop,neckBot=CH,neckPivot=[(last[0]+last[1])//2,CH],neckRows=rows,
 fx=dict(G=dict(eye=P(C['eye']),brow=P(C['brow']),brow2=P(C['brow2']),nose=P(C['nosef']),cheek=P(C['cheek']),fore=P(C['fore']),lip=P(C['lip']),u=44,down=1),mouth=[X(C['mouth'][0]),Y(C['mouth'][1]),C['mouth'][2],C['mouth'][3]],lid=C['lid']))
json.dump(meta,open(out+'/head2.json','w'));print(key,meta['headH'],meta['p0'],neckTop,CW,CH)
