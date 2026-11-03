/* ===== MotionRealism.js : pacing of the whole game, limb shading in depth order, strike variety,
   blend-in between moves, idle life =====
   • Speed: overall simulation runs at GAME_SPEED (index.html, now .72); movement multiplier .7 (walking was
     3+ body heights per second);
     the extra bounce from MotionPhysics is off (the engine's own footwork bounce is enough).
   • See-through fix: the lighting layer used to stroke a cylinder gradient over every limb AFTER the whole
     fighter was drawn, so the far arm / far leg outlines landed on top of the near limbs. Shading is now
     applied inside limbM, right after each limb segment is filled and clipped to that segment's own outline,
     so whatever is drawn later (nearer) covers it correctly.
   • Strike variety: every strike gets its own small variation — torso lean, chest, chin (tucked or not),
     shoulder twist, level change, extension of the striking arm, height of the kicking leg, where the other
     hand guards, ±7 % speed — shaped by an envelope over the move, so the same jab or kick never repeats
     exactly.
   • Blend-in: a move starts from the pose the fighter is actually in (previous strike recovery, step,
     reaction) and blends into the clip over 70 ms instead of snapping to the clip's first key.
   • Idle life: in stance the hands paw a little, the head bobs and the shoulders roll. */
const MR=tuneSection('realism',{blendT:.07,variety:1,idle:1,limbShade:.18});
if(typeof MP!=='undefined'){MP.speedMul=.55;MP.bounce.amp=0}   /* walking pace ≈ 2 body heights / s instead of 3+ */
if(typeof GFX!=='undefined')GFX.segShade=false;
/* ---- limb shading in draw order ---- */
{const lm=limbM;limbM=function(ctx,a,b,w0,w1,fl,ex,flex,fill,shadeCol){const r=lm.apply(this,arguments);
    if(!(typeof GFX!=='undefined'&&GFX.on&&MR.limbShade>0)||!ctx.canvas||ctx.__noLimbShade)return r;
    const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1e-4;const ux=dx/L,uy=dy/L;const nx=-uy*flex,ny=ux*flex;const N=10;
    const side=(sg,bul)=>{const pts=[];for(let i=0;i<=N;i++){const t=i/N;let w=(w0+(w1-w0)*t)/2;if(bul)w+=bul[1]*Math.exp(-Math.pow((t-bul[0])/(bul[2]||.28),2));pts.push([a.x+dx*t+nx*w*sg,a.y+dy*t+ny*w*sg])}return pts};
    const A=side(1,fl),B=side(-1,ex).reverse();ctx.save();ctx.beginPath();ctx.moveTo(A[0][0],A[0][1]);for(const q of A)ctx.lineTo(q[0],q[1]);for(const q of B)ctx.lineTo(q[0],q[1]);ctx.closePath();ctx.clip();
    /* lit edge toward the overhead light (+y) */
    let px=-uy,py=ux;if(py<0){px=-px;py=-py}const w=Math.max(w0,w1)*.6,mx=(a.x+b.x)/2,my=(a.y+b.y)/2;const g=ctx.createLinearGradient(mx+px*w,my+py*w,mx-px*w,my-py*w);
    g.addColorStop(0,`rgba(255,240,220,${MR.limbShade})`);g.addColorStop(.45,'rgba(255,240,220,0)');ctx.fillStyle=g;ctx.fillRect(Math.min(a.x,b.x)-w,Math.min(a.y,b.y)-w,Math.abs(dx)+2*w,Math.abs(dy)+2*w);ctx.restore();return r}}
/* ---- strike variety + blend-in ---- */
const rr=(a,b)=>a+Math.random()*(b-a);
{const sk=F2.prototype.strike;F2.prototype.strike=function(key,M){const ok=sk.call(this,key,M);if(ok&&this.act&&this.name!=='ref'){const a=this.act,V=MR.variety;
    a.var={lean:rr(-.06,.03)*V,chest:rr(-.05,.04)*V,head:rr(-.09,.07)*V,tw:rr(-.1,.1)*V,dip:rr(0,.035)*V,ext:rr(-.14,.06)*V,kick:rr(-.16,.12)*V,guard:rr(-.2,.12)*V,gel:rr(-.16,.14)*V};
    a.speed*=1+rr(-.07,.07)*V;if(this._lastP)a.from=poseCopy(this._lastP)}return ok}}
{const fw=F2.prototype.footwork;F2.prototype.footwork=function(p,dt){
    fw.call(this,p,dt);if(this.name==='ref')return;
    const a=this.act;
    if(a&&a.c&&a.var&&this.state==='stand'){const v=a.var,dur=a.c.dur||.4;const e=Math.sin(Math.PI*clamp(a.t/dur,0,1));const h=a.c.hit;const act=h?clamp((a.t-h.t0*.6)/Math.max(.04,(h.t1-h.t0*.6)),0,1)*(a.t<=h.t1+.06?1:0):0;
      p.lean+=v.lean*e;p.chest+=v.chest*e;p.head+=v.head*e;p.tw+=v.tw*e;p.y=(p.y||0)-v.dip*e*this.H*.4;p.ll_k+=v.dip*e*2;p.rl_k+=v.dip*e*2;
      const hand=a.c.hand;if(hand){const s=hand==='l'?'la':'ra',o=hand==='l'?'ra':'la';p[s+'_e']-=v.ext*act;p[o+'_s']+=v.guard*e;p[o+'_e']+=v.gel*e}
      if(a.c.leg){const s=(h&&h.pt&&h.pt[0]==='l')?'ll':'rl';p[s+'_h']+=v.kick*act;p.la_s+=v.guard*e;p.ra_s+=v.guard*e}}
    /* blend from the pose the fighter was actually in */
    if(a&&a.from&&a.t<MR.blendT){const k=ease(clamp(a.t/MR.blendT,0,1));for(const ch of PK)p[ch]=a.from[ch]+(p[ch]-a.from[ch])*k}
    /* idle life */
    if(!a&&this.state==='stand'&&MR.idle>0&&!this.body.rag){const t=this.t,k=MR.idle*(this.guard?.4:1);p.la_s+=Math.sin(t*2.3)*.035*k;p.ra_s+=Math.sin(t*1.8+1.3)*.03*k;p.la_e+=Math.sin(t*2.3+.6)*.04*k;p.ra_e+=Math.sin(t*1.8+2)*.035*k;p.head+=Math.sin(t*1.4+.4)*.02*k;p.tw+=Math.sin(t*.9)*.03*k;p.chest+=Math.sin(t*1.1+1)*.015*k}
    this._lastP=poseCopy(p)}}
