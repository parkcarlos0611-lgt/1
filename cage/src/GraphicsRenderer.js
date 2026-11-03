/* ===== GraphicsRenderer.js : fighter lighting & damage layers, octagon atmosphere =====
   Each fighter is first drawn by the original renderer into an offscreen layer (only the fighter's
   bounding box is cleared and copied). Everything below is painted with 'source-atop', so it lands
   exactly on the fighter's pixels and never outside the silhouette:
     • procedural normal shading — every limb/torso segment gets a cylinder gradient (lit edge toward
       the overhead key light, core shadow on the far edge), giving the flat shapes volume;
     • key light — warm from above, cooler toward the feet;
     • damage — bruising on the face (head damage), ribs (body damage) and lead leg (leg kicks),
       darkening around a swollen eye, blood streaking down from cuts;
     • sweat — specular glints on forehead, shoulders and torso, growing with fight time and fatigue.
   Then a rim light: silhouette minus the silhouette shifted toward the front light leaves a thin edge on
   the back/top, added with 'lighter' (back-lights over the cage).
   Octagon: spotlight pool on the mat, canvas texture, drifting haze in the light, edge vignette.
   Quality: TUNING.gfx.quality 'high' | 'low' | 'auto' ('auto' drops the layer passes if frames get slow). */
const GFX=tuneSection('gfx',{on:true,quality:'auto',rim:.4,shade:1,bruise:1,sweat:.7,octagon:true,autoSlowMs:26});
const GR={layer:null,rim:null,slow:0,off:false,
  ensure(cv){for(const k of['layer','rim']){let c=this[k];if(!c){c=this[k]=document.createElement('canvas');this[k+'X']=c.getContext('2d')}const sc=k==='rim'?.5:1;const w=Math.ceil(cv.width*sc),h=Math.ceil(cv.height*sc);if(c.width!==w||c.height!==h){c.width=w;c.height=h}}},   /* rim runs at half resolution: it is a soft glow */
  active(){return GFX.on&&GFX.quality!=='low'&&!this.off},
  /* world-space bounding box of a body → device-pixel rect under transform m */
  bbox(body,m){const J=body.J;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const k in J){const q=J[k];if(!q)continue;x0=Math.min(x0,q.x);x1=Math.max(x1,q.x);y0=Math.min(y0,q.y);y1=Math.max(y1,q.y)}
    const pad=body.H*.2;const a=m.transformPoint(new DOMPoint(x0-pad,y1+pad)),b=m.transformPoint(new DOMPoint(x1+pad,y0-pad*.6));
    const X=Math.floor(Math.min(a.x,b.x)),Y=Math.floor(Math.min(a.y,b.y));return{x:X,y:Y,w:Math.ceil(Math.abs(b.x-a.x))+2,h:Math.ceil(Math.abs(b.y-a.y))+2}}
};
function seg2(ctx,a,b,w,lit,dark){/* cylinder gradient across a segment, lit side toward +y (up) */
  const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1e-6;let nx=-dy/L,ny=dx/L;if(ny<0){nx=-nx;ny=-ny}const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
  const g=ctx.createLinearGradient(mx+nx*w,my+ny*w,mx-nx*w,my-ny*w);g.addColorStop(0,lit);g.addColorStop(.42,'rgba(0,0,0,0)');g.addColorStop(.62,'rgba(0,0,0,0)');g.addColorStop(1,dark);
  ctx.strokeStyle=g;ctx.lineWidth=w*2.3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
function blot(ctx,x,y,r,col,a){if(a<=.01)return;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,col.replace('A',a.toFixed(3)));g.addColorStop(1,col.replace('A','0'));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill()}
function paintFighterFX(ctx,f){const B=f.body,J=B.J,H=B.H,d=B.d||1;if(!J.hd)return;const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  ctx.save();ctx.globalCompositeOperation='source-atop';
  /* key light: warm top, cool bottom */
  if(GFX.shade){const g=ctx.createLinearGradient(0,J.hd.y+.1*H,0,0);g.addColorStop(0,'rgba(255,236,205,.13)');g.addColorStop(.55,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(8,10,30,.26)');ctx.fillStyle=g;ctx.fillRect(J.hip.x-H,-.1,H*2,H*1.5);
    const lit='rgba(255,240,220,.20)',dark='rgba(10,8,25,.34)';
    seg2(ctx,J.hip,J.sh,.1*H*(B.W||1),lit,dark);seg2(ctx,J.sh,J.hd,.055*H,lit,dark);
    for(const s of['l','r']){seg2(ctx,J[s+'S'],J[s+'E'],.042*H,lit,dark);seg2(ctx,J[s+'E'],J[s+'W'],.036*H,lit,dark);seg2(ctx,J[s+'H'],J[s+'K'],.06*H,lit,dark);seg2(ctx,J[s+'K'],J[s+'A'],.042*H,lit,dark)}}
  /* damage */
  if(GFX.bruise){const hd=1-f.hp.head/100,bd=1-f.hp.body/100,lg=1-f.hp.legs/100;const face={x:J.hd.x+d*.035*H,y:J.hd.y};
    blot(ctx,face.x,face.y-.005*H,.055*H,'rgba(110,25,60,A)',hd*.5);blot(ctx,face.x+d*.01*H,face.y+.018*H,.03*H,'rgba(70,10,40,A)',Math.min(1,B.swell||0)*.55);
    blot(ctx,J.hd.x+d*.02*H,J.hd.y-.035*H,.035*H,'rgba(150,40,40,A)',hd*.35);
    const rib=mix(J.mid,J.sh,.35);blot(ctx,rib.x+d*.03*H,rib.y,.075*H,'rgba(120,35,60,A)',bd*.45);
    const th=mix(J.lH,J.lK,.8),cf=mix(J.lK,J.lA,.35);blot(ctx,th.x,th.y,.06*H,'rgba(120,30,70,A)',lg*.55);blot(ctx,cf.x,cf.y,.045*H,'rgba(110,30,60,A)',lg*.45);
    const sev=B.cuts.reduce((s,c)=>s+c.sev,0);if(sev>.05){ctx.strokeStyle=`rgba(140,0,6,${Math.min(.7,sev*.35)})`;ctx.lineWidth=.012*H;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(face.x,J.hd.y+.03*H);ctx.quadraticCurveTo(face.x+d*.01*H,J.nk.y,J.sh.x+d*.05*H,J.sh.y-.06*H*Math.min(2,sev));ctx.stroke()}}
  /* sweat glints */
  const sw=(B.sweat||0)*GFX.sweat;if(sw>.08){ctx.fillStyle=`rgba(255,255,255,${(.06+sw*.2).toFixed(3)})`;const pts=[[J.hd,0,.05,.012],[mix(J.sh,J.mid,.25),.05,.02,.016],[mix(J.sh,J.mid,.6),.06,0,.012],[mix(J.lS,J.lE,.35),0,.02,.011],[mix(J.rS,J.rE,.35),0,.02,.011],[mix(J.lH,J.lK,.4),0,.03,.01]];
    for(const[p,ox,oy,r]of pts){ctx.beginPath();ctx.ellipse(p.x+d*ox*H,p.y+oy*H,r*H*(1+sw),r*H*.45,0,0,7);ctx.fill()}}
  ctx.restore()}
/* fighter draw → layer → shading → rim → composite */
{const fd=F2.prototype.draw;F2.prototype.draw=function(ctx,o){if(!GR.active()||this.name==='ref'||!ctx.canvas.classList||!ctx.canvas.classList.contains('stg'))return fd.call(this,ctx,o);
    const cv=ctx.canvas;GR.ensure(cv);const L=GR.layerX,Rr=GR.rimX,m=ctx.getTransform();const bb=GR.bbox(this.body,m);if(bb.w<4||bb.h<4)return fd.call(this,ctx,o);
    L.setTransform(1,0,0,1,0,0);L.clearRect(bb.x,bb.y,bb.w,bb.h);L.globalCompositeOperation='source-over';L.filter='none';L.setTransform(m);fd.call(this,L,o);paintFighterFX(L,this);
    const filt=ctx.filter;ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.filter=filt;ctx.drawImage(GR.layer,bb.x,bb.y,bb.w,bb.h,bb.x,bb.y,bb.w,bb.h);ctx.filter='none';
    if(GFX.rim>0){const k=Math.max(1,1.1*(window.devicePixelRatio||1)),d=this.body.d||1;const h={x:Math.floor(bb.x/2),y:Math.floor(bb.y/2),w:Math.ceil(bb.w/2)+1,h:Math.ceil(bb.h/2)+1};
      Rr.setTransform(1,0,0,1,0,0);Rr.globalCompositeOperation='source-over';Rr.clearRect(h.x,h.y,h.w,h.h);Rr.drawImage(GR.layer,bb.x,bb.y,bb.w,bb.h,h.x,h.y,bb.w/2,bb.h/2);
      Rr.globalCompositeOperation='destination-out';Rr.drawImage(GR.layer,bb.x,bb.y,bb.w,bb.h,h.x+d*k,h.y+k*.7,bb.w/2,bb.h/2);
      Rr.globalCompositeOperation='source-in';Rr.fillStyle='rgb(255,226,190)';Rr.fillRect(h.x,h.y,h.w,h.h);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=GFX.rim;ctx.drawImage(GR.rim,h.x,h.y,h.w,h.h,h.x*2,h.y*2,h.w*2,h.h*2)}
    ctx.restore()}}
/* sweat builds with fight time and fatigue; auto quality watches frame time */
{const st=Match.prototype.step;Match.prototype.step=function(dt){st.call(this,dt);if(this.phase==='fight'){this._ft=(this._ft||0)+dt;for(const f of this.f){f.body.sweat=clamp(this._ft/110+(1-f.sta/100)*.35,0,1)}}}}
{const lp=Match.prototype.loop;Match.prototype.loop=function(now){if(GFX.quality==='auto'&&this.last){const ms=now-this.last;GR.slow=GR.slow*.97+(ms>GFX.autoSlowMs?1:0)*.03;if(GR.slow>.6&&!GR.off){GR.off=true;console.info('gfx: layer passes off (slow frames)')}}return lp.call(this,now)}}
/* ---- octagon atmosphere ---- */
const ArenaFX={tex:null,motes:null,
  texture(){if(this.tex)return this.tex;const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');const id=g.createImageData(256,256);for(let i=0;i<id.data.length;i+=4){const v=118+Math.random()*20;id.data[i]=id.data[i+1]=id.data[i+2]=v;id.data[i+3]=255}g.putImageData(id,0,0);
    g.globalAlpha=.06;for(let i=0;i<40;i++){g.strokeStyle=Math.random()<.5?'#000':'#fff';g.lineWidth=Math.random()*2;g.beginPath();const x=Math.random()*256,y=Math.random()*256;g.moveTo(x,y);g.lineTo(x+Math.random()*60-30,y+Math.random()*10-5);g.stroke()}this.tex=c;return c},
  draw(S){if(!GFX.octagon)return;const ctx=S.ctx,dpr=S.dpr,W=S.cv.width,Hh=S.cv.height;const s=S.sc();const fy=(S.Hh*S.cam.gy+S.cam.shy*s)*dpr;const cx=((-S.cam.x+S.cam.shx)*s+S.W/2)*dpr;
    ctx.save();ctx.setTransform(1,0,0,1,0,0);
    /* mat texture */
    const pat=ctx.createPattern(this.texture(),'repeat');ctx.globalCompositeOperation='soft-light';ctx.globalAlpha=.35;ctx.fillStyle=pat;ctx.fillRect(0,fy-.09*Hh,W,Hh);
    /* spotlight pool */
    ctx.globalCompositeOperation='lighter';ctx.globalAlpha=1;const rx=S.R*s*dpr*.75,ry=rx*.22;const g=ctx.createRadialGradient(cx,fy,0,cx,fy,rx);g.addColorStop(0,'rgba(255,244,225,.16)');g.addColorStop(.6,'rgba(255,240,215,.06)');g.addColorStop(1,'rgba(255,240,215,0)');
    ctx.fillStyle=g;ctx.save();ctx.translate(cx,fy);ctx.scale(1,ry/rx);ctx.translate(-cx,-fy);ctx.beginPath();ctx.arc(cx,fy,rx,0,7);ctx.fill();ctx.restore();
    /* haze motes drifting in the light */
    if(!this.motes)this.motes=Array.from({length:36},()=>({x:Math.random(),y:Math.random(),v:.004+Math.random()*.01,r:.6+Math.random()*1.6}));const t=S.t||0;
    for(const m of this.motes){const x=((m.x+Math.sin(t*.2+m.y*9)*.02)%1)*W,y=((m.y-t*m.v)%1+1)%1*fy;ctx.fillStyle=`rgba(255,240,220,${.05+.05*Math.sin(t+m.x*20)})`;ctx.beginPath();ctx.arc(x,y,m.r*dpr,0,7);ctx.fill()}
    /* vignette */
    ctx.globalCompositeOperation='source-over';const v=ctx.createRadialGradient(W/2,Hh*.55,Math.min(W,Hh)*.35,W/2,Hh*.55,Math.max(W,Hh)*.75);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.42)');ctx.fillStyle=v;ctx.fillRect(0,0,W,Hh);
    ctx.restore()}
};
{const db=Stage.prototype.drawBack;Stage.prototype.drawBack=function(){const r=db.apply(this,arguments);try{ArenaFX.draw(this)}catch(e){}return r}}
