"""Guess the head geometry of a full-body flat illustration (facing right, flat backdrop) from the silhouette,
using the proportions measured on the hand-tuned fighters. The result is a build_head2 config; nudge it by hand if needed."""
from PIL import Image
import numpy as np
def auto_cfg(src):
    im=Image.open(src).convert('RGB');a=np.asarray(im).astype(float);bg=np.array(im.getpixel((8,8)),float)
    m=np.sqrt(((a-bg)**2).sum(2))>28;ys=np.nonzero(m.any(1))[0];top,bot=int(ys[0]),int(ys[-1])
    H=(bot-top)/6.0;chin=int(top+H)                       # head height from body height
    band=m[top:top+int(H*.55)];xs=np.nonzero(band.any(0))[0]
    back=int(xs[0]);nose=int(np.nonzero(m[top+int(H*.4):top+int(H*.7)].any(0))[0][-1])
    nt=int(top+H*.75);w=nose-back
    fx=lambda f:int(back+w*f);fy=lambda f:int(top+H*f)
    return dict(top=top,chin=chin,back=back,nose=nose,neckTop=nt,cut=3,clipX=nose+4,neckEnd=int(top+H*1.45),taper=(40,12),ntaper=(40,12),
      jaw=[(fx(.4),nt),(fx(.43),fy(.82)),(fx(.55),fy(.92)),(fx(.7),fy(.97)),(fx(.92),chin-2),(nose-18,chin-4)],
      backN=[(nt,back+5),(nt+27,back-3),(nt+90,back+2)],frontN=[(nt,fx(.58)),(nt+30,fx(.63)),(nt+90,fx(.66))],
      eye=(fx(.80),fy(.46)),brow=(fx(.84),fy(.38)),brow2=(fx(.73),fy(.40)),nosef=(nose-8,fy(.63)),cheek=(fx(.71),fy(.59)),fore=(fx(.69),fy(.14)),lip=(nose-18,fy(.77)))
