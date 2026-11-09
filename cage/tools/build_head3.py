"""Rigid head sprites (head + the neck down to the collar) for referees and coaches, from the character sheet.
usage: build_head3.py <sheet.png> <out_root>   -> <out_root>/<key>/head.png + head2.json (nofx: no blink / wounds for these)"""
import sys,json,os
from PIL import Image,ImageFilter
import numpy as np
SPEC={ # key: back-of-skull x, nose x, top y, chin y, collar polyline (cut everything below), skin
 'ref1':dict(back=347,nose=407,top=18,chin=86,collar=[(325,66),(335,70),(395,98),(420,110)],skin='#e9b28b'),
 'ref2':dict(back=618,nose=680,top=13,chin=88,collar=[(560,52),(570,58),(617,75),(657,96),(700,112)],skin='#7a5236',left=568),
 'ref3':dict(back=892,nose=953,top=17,chin=90,collar=[(880,70),(897,76),(937,101),(975,115)],skin='#d9a07a'),
 'ref4':dict(back=1163,nose=1225,top=18,chin=88,collar=[(1145,74),(1163,78),(1210,103),(1250,118)],skin='#dca883'),
 'coach1':dict(back=200,nose=262,top=533,chin=603,collar=[(180,575),(205,586),(250,614),(285,625)],skin='#e6b08c'),
 'coach2':dict(back=392,nose=447,top=542,chin=620,collar=[(365,585),(395,598),(440,628),(475,640)],skin='#d99f78',left=383),
 'coach3':dict(back=547,nose=605,top=533,chin=602,collar=[(528,568),(552,584),(588,612),(640,626)],skin='#8a5a3c'),
 'coach5':dict(back=877,nose=935,top=533,chin=603,collar=[(860,586),(880,596),(925,616),(965,628)],skin='#e0b090'),
 'coach6':dict(back=1068,nose=1125,top=543,chin=622,collar=[(1048,586),(1075,600),(1125,628),(1165,640)],skin='#d9a07a',left=1062,right=1143),
 'coach7':dict(back=1212,nose=1271,top=532,chin=601,collar=[(1195,584),(1213,590),(1252,611),(1290,622)],skin='#e3a982'),
 'coach8':dict(back=1402,nose=1464,top=536,chin=610,collar=[(1385,588),(1410,600),(1455,622),(1490,632)],skin='#dba27c',clipX=1459,clipFrom=596),
}
src,root=sys.argv[1],sys.argv[2]
im=Image.open(src).convert('RGB');bg=np.array(im.getpixel((8,8)),float)
for key,C in SPEC.items():
    S=420/(C['chin']-C['top']);x0=C.get('left',C['back']-6)-8;x1=C.get('right',C['nose']+10);y0=C['top']-8;y1=max(p[1] for p in C['collar'] if p[0]<x1+30)+4
    crop=im.crop((x0,y0,x1,y1));big=crop.resize((round(crop.width*S),round(crop.height*S)),Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.4,60,2))
    a=np.asarray(big).astype(float);dist=np.sqrt(((a-bg)**2).sum(2));al=np.clip((dist-16)/16,0,1)
    al=np.asarray(Image.fromarray((al*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.8))).astype(float)/255;al=np.clip(al*1.25,0,1)
    h,w=al.shape;yy,xx=np.mgrid[0:h,0:w]
    cx=[(p[0]-x0)*S for p in C['collar']];cy=[(p[1]-y0)*S for p in C['collar']]
    line=np.interp(xx,cx,cy);keep=yy<line
    if 'clipX' in C:keep&=(xx<(C['clipX']-x0)*S)|(yy<(C['clipFrom']-y0)*S)
    rgba=np.zeros((h,w,4),np.uint8);rgba[...,:3]=a.astype(np.uint8);rgba[...,3]=(al*keep*255).astype(np.uint8)
    out=os.path.join(root,key);os.makedirs(out,exist_ok=True);Image.fromarray(rgba).save(out+'/head.png')
    meta=dict(image='head.png',w=w,h=h,off=[0,0],p0=[round(((C['back']+C['nose'])/2-x0)*S),round(((C['top']+C['chin'])/2-y0)*S)],p1=[0,h],headH=420,nofx=True,skin=C['skin'])
    json.dump(meta,open(out+'/head2.json','w'));print(key,w,h,meta['p0'])
