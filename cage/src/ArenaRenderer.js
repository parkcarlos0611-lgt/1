/* ===== ArenaRenderer.js : arena backdrop and cage, redrawn for a broadcast-style look =====
   Far layer (GPU: half-res + shader depth of field; 2D: pre-blurred crowd):
     dark arena with red ambient wash on the walls, a lighting truss with fixtures and light beams,
     a row of blue LED screens, an upper crowd tier and the lower crowd behind the cage.
   Near layer: padded cage posts, padded top rail, fine chain-link you can see the crowd through,
     black fence skirt with sponsor boards. The mat keeps the engine's drawMat (logos, blood decals).
   Branding is generic: the promotion's short name from the match config, parody sponsors. */
const ARBG=tuneSection('arenaBG',{redWash:.32,screens:true,beams:.08,crowdDim:.3,linkAlpha:.7,postW:.2});
/* draw cached text sprite centred at (x,y) with pixel height h */
function spriteText(ctx,txt,col,x,y,h,rot){const sp=MatSprites.get(txt,col);const sc=h/sp.fs;ctx.save();ctx.translate(x,y);if(rot)ctx.rotate(rot);ctx.scale(sc,sc);ctx.drawImage(sp.c,-sp.w/2,-sp.h/2);ctx.restore()}
const ArenaBG={
  link:null,crowdBlur:null,
  fineLink(){if(this.link)return this.link;const c=document.createElement('canvas');c.width=c.height=14;const g=c.getContext('2d');g.strokeStyle='rgba(12,12,14,.9)';g.lineWidth=1.3;g.beginPath();g.moveTo(0,7);g.lineTo(7,0);g.lineTo(14,7);g.lineTo(7,14);g.closePath();g.stroke();
    g.strokeStyle='rgba(120,124,132,.35)';g.lineWidth=.6;g.beginPath();g.moveTo(0,7.6);g.lineTo(7,.6);g.stroke();return this.link=c},
  blurredCrowd(S){if(this.crowdBlur&&this.crowdBlur.src===S.crowd)return this.crowdBlur.c;const c=document.createElement('canvas');c.width=S.crowd.width;c.height=S.crowd.height;const g=c.getContext('2d');g.filter='blur(2px)';g.drawImage(S.crowd,0,0);this.crowdBlur={src:S.crowd,c};return c},
  far(S,ctx,W,H,fy,s){const cx=S.cam.x*s;const gpu=!!S.gpu;
    let g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#030407');g.addColorStop(Math.min(.95,fy/H*.6),'#0a0b11');g.addColorStop(Math.min(.98,fy/H),'#15161d');g.addColorStop(1,'#15161d');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    /* red ambient wash on the walls */
    for(const[x,y,r]of[[W*.06-cx*.03,fy*.5,W*.5],[W*.94-cx*.03,fy*.45,W*.5]]){const rg=ctx.createRadialGradient(x,y,0,x,y,r);rg.addColorStop(0,`rgba(205,24,36,${ARBG.redWash})`);rg.addColorStop(1,'rgba(205,24,36,0)');ctx.fillStyle=rg;ctx.fillRect(0,0,W,fy)}
    /* upper crowd tier */
    const crowd=gpu?S.crowd:this.blurredCrowd(S);const cw=crowd.width,ch=crowd.height;const k1=(fy*.3)/ch;const uy=Math.max(fy*.36,H*.27);const ox1=-((cx*.12)%(cw*k1))-cw*k1*.5;ctx.globalAlpha=.45;for(let i=0;i<3;i++)ctx.drawImage(crowd,ox1+i*cw*k1,uy,cw*k1,ch*k1);ctx.globalAlpha=1;
    ctx.fillStyle='rgba(4,4,8,.35)';ctx.fillRect(0,uy,W,ch*k1);
    /* LED screens */
    if(ARBG.screens){const sw=Math.max(140,W*.24),sh=Math.max(36,fy*.12),gap=sw*1.7;const oy=Math.max(fy*.19,H*.13),o=-((cx*.08)%gap);ctx.font=`700 ${Math.round(sh*.34)}px Oswald,Impact,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
      for(let x=o-gap;x<W+gap;x+=gap){const gl=ctx.createRadialGradient(x+sw/2,oy+sh/2,4,x+sw/2,oy+sh/2,sw*.8);gl.addColorStop(0,'rgba(40,110,255,.22)');gl.addColorStop(1,'rgba(40,110,255,0)');ctx.fillStyle=gl;ctx.fillRect(x-sw*.3,oy-sh*.6,sw*1.6,sh*2.2);
        const sg=ctx.createLinearGradient(0,oy,0,oy+sh);sg.addColorStop(0,'#0c2a6e');sg.addColorStop(1,'#1d5ad6');ctx.fillStyle='#05070c';ctx.fillRect(x-3,oy-3,sw+6,sh+6);ctx.fillStyle=sg;ctx.fillRect(x,oy,sw,sh);
        spriteText(ctx,`${(S.org&&S.org.short)||'MMA'} FIGHT NIGHT`,'#f2f5ff',x+sw/2,oy+sh*.42,sh*.34);spriteText(ctx,'LIVE · CAGE LEGENDS','#c8dcff',x+sw/2,oy+sh*.78,sh*.2)}
      ctx.textAlign='left';ctx.textBaseline='alphabetic'}
    /* truss, fixtures, beams */
    const ty=Math.max(6,fy*.02);ctx.fillStyle='#0b0c10';ctx.fillRect(0,ty,W,6);const nl=7,lg=W/nl,lo=-((cx*.15)%lg);
    for(let x=lo-lg;x<W+lg;x+=lg){const lx=x+lg/2;if(ARBG.beams>0){ctx.globalCompositeOperation='lighter';const bg=ctx.createLinearGradient(0,ty,0,fy);bg.addColorStop(0,`rgba(255,240,215,${ARBG.beams})`);bg.addColorStop(1,'rgba(255,240,215,0)');ctx.fillStyle=bg;ctx.beginPath();ctx.moveTo(lx-6,ty+6);ctx.lineTo(lx+6,ty+6);ctx.lineTo(lx+lg*.32,fy);ctx.lineTo(lx-lg*.32,fy);ctx.closePath();ctx.fill();ctx.globalCompositeOperation='source-over'}
      const fg=ctx.createRadialGradient(lx,ty+8,1,lx,ty+8,22);fg.addColorStop(0,'rgba(255,252,240,1)');fg.addColorStop(.3,'rgba(255,240,210,.8)');fg.addColorStop(1,'rgba(255,240,210,0)');ctx.fillStyle=fg;ctx.fillRect(lx-24,ty-14,48,48)}
    /* lower crowd, right behind the cage */
    const cs=(fy*.62+30)/ch;   /* lower crowd fills only the band right above the cage */const ox=-((cx*.25)%(cw*cs))-cw*cs*.5;for(let i=0;i<3;i++)ctx.drawImage(crowd,ox+i*cw*cs,fy-ch*cs+30,cw*cs,ch*cs);
    ctx.fillStyle=`rgba(6,4,10,${ARBG.crowdDim})`;ctx.fillRect(0,fy-ch*cs+30,W,ch*cs);
    for(const[x0,x1]of[[0,W*.35],[W*.65,W]]){const rg=ctx.createLinearGradient(x0,0,x1,0);const left=x0===0;rg.addColorStop(left?0:1,'rgba(220,30,40,.16)');rg.addColorStop(left?1:0,'rgba(220,30,40,0)');ctx.fillStyle=rg;ctx.fillRect(x0,fy*.3,x1-x0,fy*.75)}
    /* camera flashes */
    if(Math.random()<.04+(S.lv||1)*.2)S.flashes.push({x:Math.random()*W,y:Math.random()*(fy-60)+20,l:.12});S.flashes=S.flashes.filter(f=>(f.l-=1/60)>0);for(const f of S.flashes){ctx.fillStyle=`rgba(255,255,255,${f.l*7})`;ctx.beginPath();ctx.arc(f.x,f.y,2+f.l*20,0,7);ctx.fill()}},
  cage(S,ctx,W,fy,s,dp){const top=fy-1.75*s*dp;const pat=ctx.createPattern(this.fineLink(),'repeat');
    ctx.save();ctx.fillStyle='rgba(8,8,12,.16)';ctx.fillRect(0,top,W,fy-top);ctx.globalAlpha=ARBG.linkAlpha;ctx.translate(-(S.cam.x*s*dp)%14,0);ctx.fillStyle=pat;ctx.fillRect(-20,top,W+40,fy-top);ctx.restore();
    /* padded top rail */
    const rh=Math.max(6,.075*s*dp);let g=ctx.createLinearGradient(0,top-rh,0,top+rh*.4);g.addColorStop(0,'#3a3b42');g.addColorStop(.35,'#16171b');g.addColorStop(1,'#050506');ctx.fillStyle=g;ctx.fillRect(0,top-rh,W,rh*1.4);ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(0,top-rh+1,W,1.2);
    /* fence skirt with sponsor boards */
    const sk=.3*s*dp;g=ctx.createLinearGradient(0,fy-sk,0,fy);g.addColorStop(0,'#17181d');g.addColorStop(1,'#0b0b0e');ctx.fillStyle=g;ctx.fillRect(0,fy-sk,W,sk);ctx.fillStyle='rgba(255,255,255,.06)';ctx.fillRect(0,fy-sk,W,1);
    ctx.font=`900 ${Math.round(.15*s*dp)}px Oswald,Impact,sans-serif`;ctx.textBaseline='middle';const sp=['MONSTA ENERGY','CROWN ROYALE','VENOMM','TOYO TIRE','FIGHT PASS','CRYPTO.KOM'];const bo=Math.floor(S.rot/1.6);
    for(let i=-7+bo;i<=7+bo;i++){const x=S.px(i*1.6,dp);if(x<-220||x>W+220)continue;const t=sp[((i%sp.length)+sp.length)%sp.length];const m=MatSprites.get(t,'#fff');const h=.15*s*dp;spriteText(ctx,t,i%2?'#e2e2e2':S.col,x-.6*s*dp+m.w*h/m.fs/2,fy-sk*.5,h)}
    /* padded posts */
    const pw=ARBG.postW*s*dp;const po=Math.floor(S.rot/2.3);for(let i=-5+po;i<=5+po;i++){const x=S.px(i*2.3,dp);if(x<-pw*2||x>W+pw*2)continue;
      const pg=ctx.createLinearGradient(x-pw/2,0,x+pw/2,0);pg.addColorStop(0,'#060607');pg.addColorStop(.45,'#2a2b31');pg.addColorStop(.6,'#1a1b20');pg.addColorStop(1,'#050506');ctx.fillStyle=pg;
      const y0=top-rh*1.4,y1=fy;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x-pw/2,y0,pw,y1-y0,pw*.35);else ctx.rect(x-pw/2,y0,pw,y1-y0);ctx.fill();
      spriteText(ctx,i%2?((S.org&&S.org.short)||'MMA'):'LEGENDS',i%2?S.col:'#f0f0f0',x,y0+(y1-y0)*.42,pw*.42,-Math.PI/2)}
    ctx.textAlign='left';ctx.textBaseline='alphabetic'}
};
Stage.prototype.drawBack0=function(){const G=this.gpu;const near=this.ctx,far=G?G.farX:near;const W=this.W,H=this.Hh,s=this.sc(),dpr=this.dpr;
  far.setTransform(dpr*(G?GPU.farScale:1),0,0,dpr*(G?GPU.farScale:1),0,0);near.setTransform(dpr,0,0,dpr,0,0);
  const gy=H*this.cam.gy;const dp=.62;const fy=gy-.95*s;this.fy=fy;
  ArenaBG.far(this,far,W,H,fy,s);
  if(this.venue.startsWith('ring'))this.drawRingBack(fy,s,dp);else ArenaBG.cage(this,near,W,fy,s,dp);
  {const C=this.cam,cx=C.x;C.x-=this.rot;this.drawMat(fy,gy,s);C.x=cx}};
/* mat: same look as the engine's drawMat, but floor logos are pre-rendered sprites (fillText every
   frame at changing sizes was ~40 % of the frame) */
const MatSprites={c:{},get(txt,col){const k=txt+col;if(this.c[k])return this.c[k];const fs=96;const m=document.createElement('canvas').getContext('2d');m.font=`900 ${fs}px Oswald,Impact,sans-serif`;const w=Math.ceil(m.measureText(txt).width)+8;
  const c=document.createElement('canvas');c.width=w;c.height=Math.ceil(fs*1.3);const g=c.getContext('2d');g.font=`900 ${fs}px Oswald,Impact,sans-serif`;g.fillStyle=col;g.textAlign='center';g.textBaseline='middle';g.fillText(txt,w/2,c.height/2);
  return this.c[k]={c,w,h:c.height,fs}}};
Stage.prototype.drawMat=function(fy,gy,s){const ctx=this.ctx,W=this.W,H=this.Hh;const ring=this.venue.startsWith('ring');
  const g=ctx.createLinearGradient(0,fy,0,H);g.addColorStop(0,ring?'#8f9aa6':'#bfc3c8');g.addColorStop(.35,ring?'#c7ced6':'#e3e5e8');g.addColorStop(1,ring?'#aab3bd':'#cfd2d6');ctx.fillStyle=g;ctx.fillRect(0,fy,W,H-fy);
  const lg=(wx,z,txt,size,col,rot)=>{const k=.72+.28*z;const sy=fy+(H-fy)*z*.95;const x=(wx-this.cam.x*k)*s*k+W/2;const sp=MatSprites.get(txt,col);const sc=size*s*k/sp.fs;if(x+sp.w*sc<0||x-sp.w*sc>W)return;
    ctx.save();ctx.translate(x,sy);ctx.scale(sc,sc*(.28+.12*z));if(rot)ctx.rotate(rot);ctx.drawImage(sp.c,-sp.w/2,-sp.h/2);ctx.restore()};
  if(!ring){ctx.save();const k=.86;const cx=(0-this.cam.x*k)*s*k+W/2,cy=fy+(H-fy)*.45;ctx.strokeStyle=this.col;ctx.globalAlpha=.85;ctx.lineWidth=.05*s;ctx.beginPath();ctx.ellipse(cx,cy,2.2*s*k*this.R/4.3,.55*s,0,0,7);ctx.stroke();ctx.globalAlpha=.25;ctx.lineWidth=.02*s;ctx.beginPath();ctx.ellipse(cx,cy,3.9*s*k*this.R/4.3,1.0*s,0,0,7);ctx.stroke();ctx.restore()}
  lg(0,.48,(this.org.short||'MMA'),.6,this.col);{const q=this.R/4.3;lg(-3.3*q,.2,'TOYO TIRE',.26,'#2b62c9');lg(3.4*q,.25,'VENOMM',.26,'#333');lg(-2.6*q,.85,'CROWN ROYALE',.25,'#8a6a2a');lg(2.8*q,.8,'FIGHT PASS',.26,'#c01818')}
  for(const d of this.decals){d.age=(d.age||0)+1/60;const k=.72+.28*d.z;const sy=fy+(H-fy)*d.z*.95;const x=(d.x-this.cam.x*k)*s*k+W/2;const dk=Math.min(1,d.age/25);const rr=Math.round((110+d.c*40)*(1-dk*.45)),gg=Math.round(6+dk*4);
    ctx.fillStyle=`rgba(${rr},${gg},6,${d.a})`;ctx.beginPath();ctx.ellipse(x,sy,d.r*s*k*(d.str||1),d.r*s*.3,0,0,7);if(d.sat)for(const q of d.sat){ctx.moveTo(x+q[0]*s*k+q[2]*s*k,sy+q[1]*s*.3);ctx.ellipse(x+q[0]*s*k,sy+q[1]*s*.3,q[2]*s*k,q[2]*s*.3,0,0,7)}ctx.fill();
    if(dk<1){ctx.fillStyle=`rgba(255,140,140,${.18*(1-dk)})`;ctx.beginPath();ctx.ellipse(x-d.r*s*k*.25,sy-d.r*s*.08,d.r*s*k*.35,d.r*s*.08,0,0,7);ctx.fill()}}
  const sg=ctx.createRadialGradient(W/2,gy,10,W/2,gy,W*.6);sg.addColorStop(0,'rgba(255,248,230,.18)');sg.addColorStop(1,'rgba(0,0,0,.28)');ctx.fillStyle=sg;ctx.fillRect(0,fy,W,H-fy)};
