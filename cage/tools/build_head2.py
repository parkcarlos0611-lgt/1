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

 'conor1':dict(top=23,chin=228,back=518,nose=693,neckTop=152,cut=3,clipX=703,neckEnd=206,taper=(40,10),ntaper=(40,10),
   jaw=[(595,152),(593,175),(595,190),(603,200),(627,217),(653,228),(680,231)],
   backN=[(152,530),(185,520),(290,522)],frontN=[(152,600),(200,610),(232,625),(290,612)],
   eye=(663,118),brow=(672,108),brow2=(653,113),nosef=(683,150),cheek=(657,140),fore=(643,73),lip=(678,168)),
 'conor2':dict(top=33,chin=247,back=515,nose=693,neckTop=173,cut=3,clipX=672,clipFrom=28,neckEnd=212,padL=62,taper=(40,10),ntaper=(40,10),
   jaw=[(585,173),(580,190),(585,205),(610,222),(640,237),(665,246),(690,248)],
   backN=[(173,530),(200,520),(290,515)],frontN=[(173,590),(215,605),(250,615),(290,610)],
   eye=(658,135),brow=(667,123),brow2=(648,128),nosef=(683,167),cheek=(653,153),fore=(643,75),lip=(673,188)),
 'aldo':dict(top=43,chin=237,back=543,nose=718,neckTop=173,cut=2,clipX=703,neckEnd=232,
   jaw=[(613,173),(618,193),(633,213),(653,227),(683,235),(700,233)],
   backN=[(173,548),(200,540),(280,545)],frontN=[(173,640),(215,625),(250,622),(285,625)],
   eye=(683,132),brow=(688,117),brow2=(670,120),nosef=(710,165),cheek=(667,157),fore=(663,70),lip=(700,185)),
 'jds':dict(top=27,chin=205,back=538,nose=700,neckTop=155,cut=3,clipX=695,
   jaw=[(603,155),(610,173),(633,188),(657,200),(677,205),(690,208)],
   backN=[(155,543),(185,535),(285,535)],frontN=[(155,605),(215,625),(285,615)],
   eye=(670,115),brow=(677,105),brow2=(660,108),nosef=(690,147),cheek=(660,140),fore=(647,57),lip=(682,165)),
 'cain':dict(top=29,chin=217,back=522,nose=693,neckTop=157,cut=3,clipX=700,neckEnd=242,
   jaw=[(592,157),(592,177),(607,197),(630,210),(657,217),(673,215)],
   backN=[(157,527),(190,518),(285,520)],frontN=[(157,590),(215,608),(285,610)],
   eye=(658,118),brow=(662,112),brow2=(645,115),nosef=(678,152),cheek=(647,147),fore=(640,63),lip=(675,170)),
 'ref1':dict(top=18,chin=86,back=347,nose=407,neckTop=64,cut=3,clipX=411,darkcut=1,taper=(20,6),
   jaw=[(358,64),(366,76),(380,85),(396,86),(407,87)],
   backN=[(64,345),(84,341),(109,341)],frontN=[(64,383),(84,387),(109,391)],
   eye=(392,52),brow=(0,0),brow2=(0,0),nosef=(0,0),cheek=(0,0),fore=(0,0),lip=(403,70),lid='#c08060',blinkonly=1),
 'ref2':dict(darkFrom=16,top=13,chin=88,back=618,nose=680,neckTop=59,cut=3,clipX=684,darkcut=1,padL=50,
   jaw=[(629,59),(637,71),(651,80),(667,88),(680,89)],
   backN=[(59,616),(79,612),(104,612)],frontN=[(59,654),(79,658),(104,662)],
   eye=(665,49),brow=(0,0),brow2=(0,0),nosef=(0,0),cheek=(0,0),fore=(0,0),lip=(676,72),lid='#c08060',blinkonly=1),
 'ref3':dict(top=17,chin=90,back=892,nose=953,neckTop=63,cut=3,clipX=957,darkcut=1,taper=(20,6),
   jaw=[(903,63),(911,75),(925,84),(941,90),(953,91)],
   backN=[(63,890),(83,886),(108,886)],frontN=[(63,928),(83,932),(108,936)],
   eye=(942,53),brow=(0,0),brow2=(0,0),nosef=(0,0),cheek=(0,0),fore=(0,0),lip=(949,74),lid='#c08060',blinkonly=1),
 'ref4':dict(top=18,chin=88,back=1163,nose=1225,neckTop=64,cut=3,clipX=1229,darkcut=1,taper=(20,6),
   jaw=[(1174,64),(1182,76),(1196,85),(1212,88),(1225,89)],
   backN=[(64,1161),(84,1157),(109,1157)],frontN=[(64,1199),(84,1203),(109,1207)],
   eye=(1210,53),brow=(0,0),brow2=(0,0),nosef=(0,0),cheek=(0,0),fore=(0,0),lip=(1221,72),lid='#c08060',blinkonly=1),
 'adesanya':dict(top=23,chin=213,back=513,nose=680,neckTop=153,
   jaw=[(570,152),(593,173),(613,197),(633,208),(650,216),(660,222),(660,270)],
   backN=[(153,537),(180,527),(200,520),(270,524)],frontN=[(153,590),(203,618),(270,610)],
   eye=(650,118),brow=(657,107),brow2=(637,112),nosef=(669,147),cheek=(640,138),fore=(633,67),lip=(667,173),mouth=(667,177,38,16),lid='#7d4a26'),
}
key,src,out=sys.argv[1],sys.argv[2],sys.argv[3];C=CFG[key]
im=Image.open(src).convert('RGB')
y1=C['neckTop']+120                                   # source rows kept below the ear
S=484/(C['chin']-C['top'])
x0=C['back']-C.get('padL',40);x1=C['nose']+40
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
headm=((yy<neckTop+10)|(xx>jline(yy)-4))&(yy<Y(C['chin'])+C.get('cut',12))&((xx<X(C.get('clipX',9999)))|(yy<Y(C['chin'])-C.get('clipFrom',10)))   # nothing below the chin: the glove / shoulder of the full-body art stays out
by=[Y(p[0]) for p in C['backN']];bx=[X(p[1]) for p in C['backN']];fy=[Y(p[0]) for p in C['frontN']];fx=[X(p[1]) for p in C['frontN']]
neckm=(yy>=neckTop)&(xx>=np.interp(yy,by,bx))&(xx<=np.interp(yy,fy,fx))
if 'taper' in C:   # round off the skull's lower-back corner so no spur sticks out behind the neck when it bends
    ta,dx=C['taper'];xs=np.interp(yy,[neckTop-Y(ta),neckTop+10],[X(C['back'])-6,X(C['back'])+Y(dx)])
    headm=headm&(xx>=xs)
head=rgba.copy();head[...,3]=(rgba[...,3]*headm).astype(np.uint8)
if 'ntaper' in C:   # the neck piece's top-back corner is rounded off too
    nl,nd=C['ntaper'];b0=np.interp(neckTop,by,bx);neckm=neckm&(xx>=np.interp(yy,[neckTop,neckTop+Y(nl)],[b0+Y(nd),b0]))
neck=rgba.copy()
if 'neckEnd' in C:   # below this source row the picture shows a tattoo / the body: repeat the last clean row for the neck piece
    ne=Y(C['neckEnd'])
    for yy_ in range(ne,CH):neck[yy_]=rgba[ne-3]
if C.get('darkcut'):
    lum=neck[...,:3].astype(float).mean(2);mx=neck[...,:3].max(2).astype(float);mn=neck[...,:3].min(2).astype(float)
    neckm=neckm&~((lum<95)&((mx-mn)<40)&(yy>=neckTop+Y(C.get('darkFrom',0))))
neck[...,3]=(neck[...,3]*neckm).astype(np.uint8)
Image.fromarray(head).save(out+'/head.png');Image.fromarray(neck).save(out+'/neck.png')
rows=[None]*CH;na=neck[...,3]
for y in range(neckTop,CH):
    xs=np.where(na[y]>128)[0]
    if len(xs):rows[y]=[int(xs[0]),int(xs[-1])]
top=Y(C['top']);bot=Y(C['chin']);last=rows[CH-1] or rows[CH-5]
P=lambda p:[X(p[0]),Y(p[1])]
# lid colour: the skin just under the eye (so the closed-eyelid patch always matches this face)
ex,ey=P(C['eye']);reg=a[max(0,ey+14):ey+30,max(0,ex-26):ex+6].reshape(-1,3);reg=reg[reg.sum(1)>200]
lid='#%02x%02x%02x'%tuple(int(v*.98) for v in (reg.mean(0) if len(reg) else (180,120,80)))
lp=P(C['lip']);C['mouth']=(0,0,36,16);mouth_xy=[lp[0]-8,lp[1]+6]
meta=dict(image='head.png',w=CW,h=CH,off=[0,0],p0=[X((C['back']+C['nose'])/2),(top+bot)//2],p1=[X((C['back']+C['nose'])/2),CH],headH=bot-top,neck='neck.png',neckTop=neckTop,neckBot=CH,neckPivot=[(last[0]+last[1])//2,CH],neckRows=rows,
 fx=dict(G=dict(eye=P(C['eye']),brow=P(C['brow']),brow2=P(C['brow2']),nose=P(C['nosef']),cheek=P(C['cheek']),fore=P(C['fore']),lip=P(C['lip']),u=44,down=1),mouth=[mouth_xy[0],mouth_xy[1],36,16],lid=lid))
if C.get('blinkonly'):meta['fx']['blinkOnly']=True
json.dump(meta,open(out+'/head2.json','w'));print(key,meta['headH'],meta['p0'],neckTop,CW,CH)
