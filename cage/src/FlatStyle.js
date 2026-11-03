/* ===== FlatStyle.js : low-poly flat-colour fighter art for the existing engine =====
   Replaces only how a fighter is PAINTED (Body.prototype.draw). Skeleton, poses, attack motions, ragdoll,
   footwork and every game system are untouched — the drawing reads the same joints as before.

   Style: flat colour planes with straight edges (no outlines, no gradients), two tones per part — a lit
   plane and a shadow plane on the back/underside — far-side limbs a step darker, angular head with block
   hair and beard, fight gloves with a padded knuckle block, wrist cuff and a white back-of-hand patch,
   fight shorts with a side slit, darker geometric panels and accent stripes.

   More articulation and anatomy than the old art, derived from the same joints:
     arm  : clavicle → deltoid cap → biceps / triceps → elbow point → forearm (flexor bulge) → wrist → fist
     leg  : hip → quadriceps / hamstring → knee cap → calf / shin → Achilles → ankle bones → heel → arch →
            ball → toes (the toes break at the ball and stay flat on the canvas when the heel lifts)
     torso: trapezius → clavicle line → pec plate → under-pec shadow → serratus → abs blocks → oblique →
            lats strip on the back → glute
     neck : sternocleidomastoid line, throat shadow, nape
     head : cranium, brow ridge, eye, nose wedge, lips, chin, jaw angle, ear, hairline, sideburn, beard. */
(function(){
if(typeof Body==='undefined')return;
const FS=window.FLAT_STYLE=(typeof tuneSection==='function'?tuneSection('flat',{on:true,shadowK:-.09,farK:-.1,lightK:.035}):{on:true,shadowK:-.09,farK:-.1,lightK:.035});
/* the flat look has its own light: switch off the gradient / rim light layers painted on top of fighters */
if(typeof GFX!=='undefined'){GFX.shade=0;GFX.rim=0;GFX.sweat=Math.min(GFX.sweat,.35)}
if(typeof GPU!=='undefined')GPU.rim=.12;
if(typeof MR!=='undefined')MR.limbShade=0;

/* ---------- helpers (world units, y up) ---------- */
/* calm a saturated colour a little toward neutral so kit colours sit with the soft palette */
const calm=c=>{try{const[r,g,b]=rgbOf(c);const m=(r+g+b)/3;const k=.18;return`rgb(${Math.round(r+(m-r)*k)},${Math.round(g+(m-g)*k)},${Math.round(b+(m-b)*k)})`}catch(e){return c}};
/* every flat shape gets softly rounded corners (radius in world metres, limited by the adjacent edges) */
let ROUND=.12;/* as round as the shape allows: corners are no longer visible */
function rpath(ctx,P,R){const n=P.length;if(n<3||R<=0){ctx.moveTo(P[0].x,P[0].y);for(let i=1;i<n;i++)ctx.lineTo(P[i].x,P[i].y);ctx.closePath();return}
  const m=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});const s0=m(P[n-1],P[0]);ctx.moveTo(s0.x,s0.y);
  for(let i=0;i<n;i++){const a=P[(i+n-1)%n],b=P[i],c=P[(i+1)%n];const r=Math.min(R,.5*Math.hypot(b.x-a.x,b.y-a.y),.5*Math.hypot(c.x-b.x,c.y-b.y));const e=m(b,c);if(r>1e-5)ctx.arcTo(b.x,b.y,e.x,e.y,r);else ctx.lineTo(b.x,b.y)}ctx.closePath()}
const poly=(ctx,P,col,R)=>{if(!P.length)return;ctx.fillStyle=col;ctx.beginPath();rpath(ctx,P,R==null?ROUND:R);ctx.fill()};
const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const circ=(ctx,c,r,col)=>{ctx.fillStyle=col;ctx.beginPath();ctx.arc(c.x,c.y,r,0,Math.PI*2);ctx.fill()};
const ngon=(ctx,c,r,col,n)=>{n=n||8;ctx.fillStyle=col;ctx.beginPath();for(let i=0;i<n;i++){const a=(i+.5)/n*Math.PI*2;const x=c.x+Math.cos(a)*r,y=c.y+Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.fill()};
/* frame of a segment a→b: u along, n = the "front" side (toward the facing direction, or up when the
   segment is level with the facing direction) */
function frame(a,b,d){const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1e-5;const ux=dx/L,uy=dy/L;let nx=-uy,ny=ux;const f=nx*d+ny*.35;if(f<0){nx=-nx;ny=-ny}return{ux,uy,nx,ny,L}}
/* angular limb: profile rows [t, frontHalfWidth, backHalfWidth] → one flat polygon + a back/underside shadow plane */
function limb(ctx,a,b,d,rows,col,shCol,extra){const F=frame(a,b,d);const P=(t,w)=>({x:a.x+F.ux*F.L*t+F.nx*w,y:a.y+F.uy*F.L*t+F.ny*w});
  const front=rows.map(r=>P(r[0],r[1])),back=rows.map(r=>P(r[0],-r[2]));poly(ctx,front.concat(back.slice().reverse()),col,ROUND*2.2);/* outline of the limb: extra round */
  /* rounded joint ends: the limb meets its neighbour with a smooth round cap instead of a hard corner */
  if(!(extra&&extra.noCaps)){const r0=rows[0],r1=rows[rows.length-1];circ(ctx,P(r0[0],(r0[1]-r0[2])/2),(r0[1]+r0[2])/2,col);circ(ctx,P(r1[0],(r1[1]-r1[2])/2),(r1[1]+r1[2])/2,col)}
  if(shCol){const mid=rows.map(r=>P(r[0],-r[2]*(extra&&extra.shadowFrom!=null?extra.shadowFrom:.12)));poly(ctx,mid.concat(back.slice().reverse()),shCol)}
  return{F,P}}

/* ---------- body ---------- */
const BD=Body.prototype.draw;
Body.prototype.draw=function(ctx,o){o=o||{};const lk=this.look;if(!FS.on)return BD.call(this,ctx,o);
  const J=this.J,H=this.H,W=this.W,d=this.d;if(!J.hd)return;
  /* the referee is the same figure in a different outfit (black polo, trousers, boots, gloves) */
  const R=!!lk.ref;if(R&&!lk._flat){Object.assign(lk,REF_LOOK[Math.floor(Math.random()*REF_LOOK.length)]);lk._flat=1;this.hs=null}
  const CL=R?{shirt:'#222327',shirtS:'#18191c',pants:'#1e1f23',pantsS:'#151619',boot:'#0f0f11',glove:'#151517'}:null;
  if(!o.onlyArm){floorShadow(ctx,this);motionBlur(ctx,this,lk)}
  const M=H*W*.86;/* muscle scale: leaner frames, heavier classes still carry more mass through bw */const SHB=lk.body==='broad'?1.12:1;
  const skin=lk.skin||'#d39b74';const sk={base:skin,sh:shade(skin,FS.shadowK),far:shade(skin,FS.farK),farSh:shade(skin,FS.farK+FS.shadowK),lt:shade(skin,FS.lightK)};
  const shorts=calm(lk.shorts||'#111');const glove=R?CL.glove:lk.glove||'#141414';const strap=o.corner||'#c21818';
  const nearLead=(d>0)===(this.stance>0);const lead={S:'lS',E:'lE',W:'lW',G:'lG',H:'lH',K:'lK',A:'lA',He:'lHe',T:'lT',o:'lo'},rear={S:'rS',E:'rE',W:'rW',G:'rG',H:'rH',K:'rK',A:'rA',He:'rHe',T:'rT',o:'ro'};
  const nearS=nearLead?lead:rear,farS=nearLead?rear:lead;
  const self=this;
  /* ---- arm: deltoid, biceps/triceps, elbow, forearm, wrist, glove ---- */
  const arm=(S,isFar)=>{const a=J[S.S],e=J[S.E],w=J[S.W];const C=isFar?{b:sk.far,s:sk.farSh}:{b:sk.base,s:sk.sh};
    /* upper arm: deltoid cap → biceps (front) / triceps (back) → elbow */
    limb(ctx,a,e,d,[[-.1,.05*M*SHB,.055*M*SHB],[.12,.062*M*SHB,.064*M*SHB],[.3,.052*M,.058*M],[.5,.05*M,.05*M],[.78,.04*M,.04*M],[1,.031*M,.033*M]],C.b,C.s);
    /* deltoid plate: a lighter facet over the shoulder */
    if(R)limb(ctx,a,e,d,[[-.14,.07*M,.072*M],[.25,.07*M,.072*M],[.56,.064*M,.066*M]],isFar?CL.shirtS:CL.shirt,null);
    else{limb(ctx,a,e,d,[[-.12,.046*M,.04*M],[.08,.058*M,.05*M],[.3,.034*M,.02*M]],isFar?C.b:sk.lt,null,{noCaps:true})}
    /* forearm: flexor bulge near the elbow, narrow wrist */
    limb(ctx,e,w,d,[[-.06,.032*M,.032*M],[.2,.038*M,.036*M],[.45,.033*M,.031*M],[.8,.025*M,.024*M],[1,.022*M,.022*M]],C.b,C.s);
    circ(ctx,e,.031*M,C.b);/* elbow joint */
    /* elbow point (olecranon) facet */{const F=frame(e,w,d);circ(ctx,{x:e.x-F.nx*.016*M,y:e.y-F.ny*.016*M},.014*M,C.s)}
    drawGloveFlat(ctx,e,w,J[S.G],H,isFar?shade(glove,-.2):glove,R?glove:strap,self.ang[S.o],R?0:self.gloveBlood,d,R?glove:C.b,R)};
  /* ---- leg: quad/hamstring, knee cap, calf, ankle, foot with toes ---- */
  const leg=(S,isFar,sleeveCol)=>{const h=J[S.H],k=J[S.K],a=J[S.A],he=J[S.He],to=J[S.T];const C=R?(isFar?{b:CL.pantsS,s:shade(CL.pantsS,-.2)}:{b:CL.pants,s:CL.pantsS}):isFar?{b:sk.far,s:sk.farSh}:{b:sk.base,s:sk.sh};
    limb(ctx,h,k,d,[[-.06,.07*M,.07*M],[.18,.074*M,.07*M],[.45,.066*M,.062*M],[.75,.052*M,.05*M],[1,.042*M,.043*M]],C.b,C.s);
    /* shin / calf: calf bulge on the back, straight shin bone on the front */
    limb(ctx,k,a,d,[[-.04,.04*M,.042*M],[.22,.036*M,.054*M],[.42,.033*M,.05*M],[.7,.026*M,.032*M],[.92,.022*M,.023*M],[1.02,.022*M,.024*M]],C.b,C.s,{shadowFrom:.0});
    /* knee: joint block + a single knee-cap facet */{const F=frame(h,k,d);circ(ctx,k,.041*M,C.b);poly(ctx,[{x:k.x+F.nx*.042*M-F.ux*.03*M,y:k.y+F.ny*.042*M-F.uy*.03*M},{x:k.x+F.nx*.046*M+F.ux*.02*M,y:k.y+F.ny*.046*M+F.uy*.02*M},{x:k.x+F.nx*.02*M+F.ux*.04*M,y:k.y+F.ny*.02*M+F.uy*.04*M},{x:k.x+F.nx*.012*M,y:k.y+F.ny*.012*M}],C.s)}
    circ(ctx,a,.024*M,C.b);footFlat(ctx,a,he,to,M,R?{b:CL.boot,s:'#070708'}:C,d);
    if(sleeveCol)shortsLeg(ctx,h,k,d,M,sleeveCol,lk,isFar)};
  if(o.onlyArm){arm(nearS,false);return}
  /* far side first */
  arm(farS,true);leg(farS,true,R?null:shade(shorts,-.22));
  torsoFlat(ctx,J,H,M*(SHB>1?1.02:1),R?{base:CL.shirt,sh:CL.shirtS,lt:shade(CL.shirt,.07)}:sk,d,lk,this);
  /* shorts go on top in 4 pieces so the hip, where many joints meet, reads as one garment:
     far leg (drawn with the far leg) → seat panel over the hips and both thigh tops → near leg → waistband + hip fold */
  leg(nearS,false,null);if(R){shortsWaist(ctx,J,H,M,'#101012',d,lk,this.ang.ta)}else{shortsSeat(ctx,J,H,M,shorts,d,this.ang.ta,nearS,farS);shortsLeg(ctx,J[nearS.H],J[nearS.K],d,M,shorts,lk,false);shortsWaist(ctx,J,H,M,shorts,d,lk,this.ang.ta)}
  headFlat(ctx,J.hd,J.nk,H,this,skin,d,this.ang.hd);
  arm(nearS,false);
  if(o.highlight){ctx.save();ctx.globalAlpha=o.highlight;ctx.globalCompositeOperation='lighter';ngon(ctx,J.hd,.1*H,'#fff',12);ctx.restore()}};

const REF_LOOK=[{skin:'#6e4630',hair:'#141110',hs:'long',bd:'full',beard:true},{skin:'#e7bc9c',hair:'#8a7462',hs:'bald',bd:null,beard:false},{skin:'#e4b593',hair:'#2b211b',hs:'short',bd:null,beard:false},{skin:'#8a5a3e',hair:'#2a1d15',hs:'bald',bd:'stub',beard:false}];
/* soft airbrushed contact shadow on the canvas under the body */
function floorShadow(ctx,B){const J=B.J,H=B.H;const low=J.hip.y<.45*H;const xs=[J.lA.x,J.rA.x,J.hip.x];if(low)xs.push(J.hd.x,J.sh.x);const x0=Math.min(...xs),x1=Math.max(...xs);const cx=(x0+x1)/2,rx=(x1-x0)/2+.22*H;const ry=.05*H;
  const lift=Math.max(0,Math.min(J.lA.y,J.rA.y,J.hip.y)-.05);const a=.5*Math.max(.25,1-lift/(.5*H));
  ctx.save();ctx.translate(cx,0);ctx.scale(1,ry/rx);const g=ctx.createRadialGradient(0,0,0,0,0,rx);g.addColorStop(0,`rgba(40,30,22,${a.toFixed(3)})`);g.addColorStop(.55,`rgba(40,30,22,${(a*.45).toFixed(3)})`);g.addColorStop(1,'rgba(40,30,22,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,rx,0,Math.PI*2);ctx.fill();ctx.restore()}
/* motion blur: fast hands / feet leave a short translucent smear along their path (last 3 frames) */
const MB_K=[['lG',.04,'g'],['rG',.04,'g'],['lW',.026,'s'],['rW',.026,'s'],['lT',.03,'s'],['rT',.03,'s'],['lA',.03,'s'],['rA',.03,'s'],['lK',.035,'s'],['rK',.035,'s']];
function motionBlur(ctx,B,lk){if(lk.ref)return;const J=B.J,H=B.H;const h=B._mbH||(B._mbH=[]);const snap={};for(const[k]of MB_K)if(J[k])snap[k]={x:J[k].x,y:J[k].y};
  const last=h[h.length-1];const same=last&&MB_K.every(([k])=>!snap[k]||last[k]&&last[k].x===snap[k].x&&last[k].y===snap[k].y);if(!same){h.push(snap);if(h.length>6)h.shift()}
  if(h.length<3)return;const glove=lk.ref?'#151517':lk.glove||'#141414',skin=lk.ref?'#151517':lk.skin||'#d39b74';
  for(const[k,w0,c]of MB_K){const cur=snap[k];if(!cur)continue;const pts=h.map(f=>f[k]).filter(Boolean);if(pts.length<3)continue;const p0=pts[0];const dist=Math.hypot(cur.x-p0.x,cur.y-p0.y);if(dist<(c==='g'?.055:.13)*H||dist>.8*H)continue;/* feet / knees only smear on kicks, not on ordinary steps */let jump=false;for(let i=1;i<pts.length;i++)if(Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y)>.3*H)jump=true;if(jump)continue;/* a teleport / reset is not motion */
    const w=w0*H;const col=c==='g'?glove:skin;const al=Math.min(c==='g'?.45:.22,.12+(dist/H-.055)*1.6);ctx.save();ctx.globalAlpha=al;ctx.fillStyle=col;
    for(let i=0;i<pts.length-1;i++){const a=pts[i],b=i+1<pts.length?pts[i+1]:cur;const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1e-5;const nx=-dy/L,ny=dx/L;const wa=w*(.25+.85*i/(pts.length-1)),wb=w*(.25+.85*(i+1)/(pts.length-1));ctx.globalAlpha=al*(.35+.65*(i+1)/(pts.length-1));
      ctx.beginPath();ctx.moveTo(a.x+nx*wa,a.y+ny*wa);ctx.lineTo(b.x+nx*wb,b.y+ny*wb);ctx.lineTo(b.x-nx*wb,b.y-ny*wb);ctx.lineTo(a.x-nx*wa,a.y-ny*wa);ctx.closePath();ctx.fill()}
    ctx.restore()}}
/* ---------- foot: ankle bones, heel, arch, ball, toes ---------- */
function footFlat(ctx,A,He,T,M,C,d){const ux0=T.x-He.x,uy0=T.y-He.y,Lf=Math.hypot(ux0,uy0)||1e-5;const ux=ux0/Lf,uy=uy0/Lf;let nx=-uy,ny=ux;if((A.x-He.x)*nx+(A.y-He.y)*ny<0){nx=-nx;ny=-ny}
  const Q=(u,v)=>({x:He.x+ux*u*Lf+nx*v*Lf,y:He.y+uy*u*Lf+ny*v*Lf});
  /* toes: break at the ball; when the ball is on the canvas the toes lie flat on it */
  const ball=Q(.7,.02);let tx=ux,ty=uy;if(ball.y<.05&&ty<-.05){tx=Math.sign(ux)||d;ty=0}
  const tl=.27*Lf;let tnx=-ty,tny=tx;if(tnx*nx+tny*ny<0){tnx=-tnx;tny=-tny}const TP=(u,v)=>({x:ball.x+tx*u*Lf+tnx*v*Lf,y:ball.y+ty*u*Lf+tny*v*Lf});
  /* a fuller foot: high instep, thick heel pad, rounded heel and rounded toe block */
  poly(ctx,[Q(.14,.5),Q(-.02,.36),Q(-.08,.2),Q(-.06,.05),Q(.04,-.01),Q(.4,0),Q(.7,-.005),TP(0,.17),Q(.5,.3),Q(.3,.4)],C.b);
  circ(ctx,Q(.05,.12),.13*Lf,C.b);/* heel */
  const tr=.085*Lf;poly(ctx,[TP(-.02,-.005),TP(tl/Lf-tr/Lf,-.005),TP(tl/Lf-tr/Lf,.17),TP(-.02,.18)],C.b);circ(ctx,TP(tl/Lf-tr/Lf,tr/Lf),tr,C.b);/* toes, round tip */
  /* planes: sole edge, inner arch shadow, heel facet, ankle bone */
  poly(ctx,[Q(-.04,.03),Q(.06,-.01),Q(.7,-.005),Q(.6,.07),Q(.2,.085)],C.s);
  poly(ctx,[Q(-.08,.2),Q(-.02,.36),Q(.14,.5),Q(.1,.24)],C.s);
  circ(ctx,Q(.18,.38),.016*M,C.s)}

/* ---------- torso: lats, pecs, abs, obliques ---------- */
function torsoFlat(ctx,J,H,M,sk,d,lk,B){const sp=[J.hip,J.mid,J.sh,J.nk];const segL=[0];for(let i=1;i<4;i++)segL.push(segL[i-1]+Math.hypot(sp[i].x-sp[i-1].x,sp[i].y-sp[i-1].y));const TL=segL[3]||1;
  const at=s=>{const L=s*TL;let i=1;while(i<3&&segL[i]<L)i++;const a=sp[i-1],b=sp[i],k=(L-segL[i-1])/((segL[i]-segL[i-1])||1);const tx=b.x-a.x,ty=b.y-a.y,l=Math.hypot(tx,ty)||1;return{x:a.x+tx*k,y:a.y+ty*k,nx:ty/l*d,ny:-tx/l*d}};
  const pt=(s,w)=>{const c=at(s);return{x:c.x+c.nx*w*M/.94/1,y:c.y+c.ny*w*M/.94}};
  const bel=lk.belly||lk.body==='belly'?.042:0;const shb=lk.body==='broad'?1.14:1;/* broad: wider chest and upper back */
  const FR=[[0,.074+bel*.3],[.16,.073+bel*.8],[.32,.071+bel],[.48,.07+bel*.7],[.6,.08],[.7,.096*shb],[.79,.099*shb],[.87,.088*shb],[.94,.062],[1,.036]];
  const BK=[[0,.09],[.1,.086],[.24,.066+bel*.3],[.38,.061+bel*.2],[.52,.071],[.66,.085*shb],[.78,.093*shb],[.88,.087*shb],[.95,.066],[1,.045]];
  const F=FR.map(([s,w])=>pt(s,w)),Bk=BK.map(([s,w])=>pt(s,-w));
  poly(ctx,F.concat(Bk.slice().reverse()),sk.base,ROUND*2.2);
  /* lats / spine side: shadow plane on the back */
  poly(ctx,BK.map(([s,w])=>pt(s,-w*.32)).concat(Bk.slice().reverse()),sk.sh);
  /* trapezius slope + clavicle line */poly(ctx,[pt(.9,-.08),pt(1,-.045),pt(1,.0),pt(.93,-.02)],sk.sh);
  /* pec plate: lighter facet, then the hard under-pec shadow */
  poly(ctx,[pt(.93,.06),pt(.87,.088),pt(.79,.099),pt(.7,.096),pt(.69,.03),pt(.8,.0),pt(.9,.02)],sk.lt);
  poly(ctx,[pt(.7,.098),pt(.67,.08),pt(.66,.015),pt(.69,.0),pt(.71,.03)],sk.sh);

  /* abs: flat blocks along the front edge */
  if(!lk.belly&&lk.body!=='belly'){poly(ctx,[pt(.6,.08),pt(.22,.072),pt(.22,.05),pt(.6,.055)],sk.lt)}
  /* tattoos (flat ink shapes) */
  if(lk.tat&&/c/.test(lk.tat)){ctx.globalAlpha=.55;poly(ctx,[pt(.86,.06),pt(.8,.09),pt(.72,.07),pt(.74,.03),pt(.82,.02)],'#1c2230');ctx.globalAlpha=1}
  if(lk.tat&&/b/.test(lk.tat)){ctx.globalAlpha=.5;poly(ctx,[pt(.85,-.08),pt(.7,-.09),pt(.6,-.06),pt(.72,-.03),pt(.84,-.04)],'#1c2230');ctx.globalAlpha=1}
  /* blood streaming down the chest */
  if(B.blood>.9&&J.mid){const al=Math.min(.7,(B.blood-.9)*.6);for(let i=0;i<3;i++){const L=Math.min(1,(B.blood-.9)*.7*(1-i*.3));if(L<=0)continue;const a={x:J.nk.x+d*(.035+i*.018)*H,y:J.nk.y-.02*H},b={x:J.mid.x+d*(.05+i*.02)*H,y:J.mid.y};const e=lerp(a,b,L);const w=(.006-i*.0014)*H;
    ctx.globalAlpha=al*(1-i*.2);poly(ctx,[{x:a.x-w,y:a.y},{x:a.x+w,y:a.y},{x:e.x+w*.6,y:e.y},{x:e.x,y:e.y-w*1.4},{x:e.x-w*.6,y:e.y}],`rgb(${128-i*15},6,8)`);ctx.globalAlpha=1}}}

/* ---------- shorts: waistband + one leg sleeve per thigh, side slit, panels, accent stripes ---------- */
function accentOf(col){const[r,g,b]=rgbOf(col);const l=(r*299+g*587+b*114)/1000;return l<70?'#b8975a':l>190?'#3a3a3a':shade(col,.3)}
const polyRshortsLeg=(ctx,P,c)=>poly(ctx,P,c,.09);
function shortsLeg(ctx,h,k,d,M,col,lk,isFar){const F=frame(h,k,d);const P=(t,w)=>({x:h.x+F.ux*F.L*t+F.nx*w,y:h.y+F.uy*F.L*t+F.ny*w});
  /* one leg piece: angled hem, short side slit at the front */
  polyRshortsLeg(ctx,[P(-.15,.084*M),P(.5,.08*M),P(.55,.077*M),P(.5,.045*M),P(.6,-.01*M),P(.62,-.082*M),P(-.15,-.084*M)],col);
  if(isFar)return;
  /* one broad panel on the back half + two long accent stripes */
  polyRshortsLeg(ctx,[P(-.05,-.084*M),P(.62,-.082*M),P(.6,-.01*M),P(.3,-.02*M)],shade(col,-.12));
  const ac=accentOf(lk.shorts||'#111');polyRshortsLeg(ctx,[P(.08,.08*M),P(.13,.08*M),P(.42,-.03*M),P(.37,-.03*M)],ac);polyRshortsLeg(ctx,[P(.22,.08*M),P(.26,.08*M),P(.48,-.0*M),P(.44,-.0*M)],ac)}
const polyRshortsWaist=(ctx,P,c)=>poly(ctx,P,c,.04);
function shortsWaist(ctx,J,H,M,col,d,lk,ta){const hip=J.hip,mid=J.mid;const n={x:d*Math.cos(ta),y:-Math.sin(ta)};const Pp=(c,f)=>({x:c.x+n.x*f,y:c.y+n.y*f});const hw=.082*M/.94;
  const top=lerp(hip,mid,.38),t2=lerp(hip,mid,.3);polyRshortsWaist(ctx,[Pp(top,hw*1.0),Pp(top,-hw*1.04),Pp(t2,-hw*1.07),Pp(t2,hw*1.03)],shade(col,-.25))}
function hull2(P){P=P.slice().sort((a,b)=>a.x-b.x||a.y-b.y);const cr=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);const lo=[],up=[];for(const p of P){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p)}for(let i=P.length-1;i>=0;i--){const p=P[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p)}lo.pop();up.pop();return lo.concat(up)}
const polyRshortsSeat=(ctx,P,c)=>poly(ctx,P,c,.13);
function shortsSeat(ctx,J,H,M,col,d,ta,nS,fS){const hip=J.hip,mid=J.mid;const n={x:d*Math.cos(ta),y:-Math.sin(ta)};const Pp=(c,f)=>({x:c.x+n.x*f,y:c.y+n.y*f});const hw=.08*M/.94;const top=lerp(hip,mid,.36);
  const pts=[Pp(top,hw),Pp(top,-hw*1.04),Pp(hip,-hw*1.1),Pp(hip,hw*1.04)];
  for(const S of[nS,fS]){const h=J[S.H],k=J[S.K];const F=frame(h,k,d);for(const[t,w]of[[.34,.082],[.34,-.084],[.18,.09],[.18,-.09]])pts.push({x:h.x+F.ux*F.L*t+F.nx*w*M,y:h.y+F.uy*F.L*t+F.ny*w*M})}
  polyRshortsSeat(ctx,hull2(pts),col)}
function shortsFold(ctx,J,M,col,d,nS){/* the fold where the thigh bends against the hip */const h=J[nS.H],k=J[nS.K];const F=frame(h,k,d);const P=(t,w)=>({x:h.x+F.ux*F.L*t+F.nx*w*M,y:h.y+F.uy*F.L*t+F.ny*w*M});
  poly(ctx,[P(-.04,.078),P(.14,.08),P(.05,.05)],shade(col,-.2))}
function drawGloveFlat(ctx,E,Wr,G,H,col,strap,open,blood,d,skinC,plain){const a=Math.atan2(G.y-Wr.y,G.x-Wr.x);ctx.save();ctx.translate(Wr.x,Wr.y);ctx.rotate(a);
  /* local frame: +x toward the knuckles; flip so the thumb sits on the top / facing side */
  const flip=(Math.cos(a)*d>=0)?1:-1;ctx.scale(1,flip);const r=.036*H;const P=(pts,c)=>{ctx.fillStyle=c;ctx.beginPath();rpath(ctx,pts.map(q=>({x:q[0]*r,y:q[1]*r})),r*.95);ctx.fill()};
  P([[-.95,-.62],[-.95,.62],[.15,.7],[.15,-.7]],col);/* cuff */
  P([[-.92,.62],[-.92,.36],[.12,.42],[.12,.68]],strap);/* cuff strap in corner colour */
  P([[.05,-.92],[.05,.9],[1.05,1.0],[1.55,.78],[1.72,.25],[1.68,-.55],[1.35,-.95]],col);/* knuckle block */
  /* open-finger MMA glove: the curled fingers show skin below the padding */
  const sc=skinC||'#d39b74';P([[1.3,-.98],[1.66,-.62],[1.74,.2],[1.58,.74],[1.42,.66],[1.44,-.55]],sc);
  for(const y of[-.42,-.02,.38])P([[1.44,y-.025],[1.74,y-.025],[1.74,y+.02],[1.44,y+.02]],shade(sc,-.28));/* finger splits */
  P([[1.3,-.98],[1.44,-.55],[1.42,.66],[1.3,.8],[1.25,-.9]],col);/* padding edge over the knuckles */
  P([[.35,.85],[.95,1.15],[1.25,1.0],[1.0,.82]],col);P([[1.0,1.0],[1.3,1.08],[1.32,.9],[1.1,.84]],sc);/* thumb: padded base, bare tip */
  if(!plain)P([[.52,-.28],[1.0,-.32],[1.0,.24],[.52,.28]],'#e4e2de');P([[.62,-.04],[.9,-.18],[.9,-.08],[.62,.06]],col);/* white patch with a simple mark */
  if(open>.5){for(let i=0;i<3;i++)P([[1.6,(i-1)*.5-.15],[2.2,(i-1)*.5-.1],[2.2,(i-1)*.5+.12],[1.6,(i-1)*.5+.15]],col)}
  if(blood>0){ctx.globalAlpha=Math.min(.85,blood);P([[.9,-.3],[1.6,-.1],[1.5,.5],[.9,.4]],'#7a0606');ctx.globalAlpha=1}
  ctx.restore()}

/* ---------- head: angular cranium, face planes, block hair and beard ---------- */
function headFlat(ctx,hd,nk,H,B,skin,d,ang){const lk=B.look,r=.066*H;ctx.save();ctx.translate(hd.x,hd.y);ctx.scale(d,1);ctx.rotate(-ang*.9);
  const F=(typeof faceOf==='function')?faceOf(B):{n:.5,br:.5,jw:.5,ch:.5,lp:.5,nf:0,nh:0};
  const red=B.redness||0;const sk=red>0&&typeof mixHex==='function'?mixHex(skin,'#b8433a',Math.min(.4,red*.45)):skin;const sh=shade(sk,FS.shadowK),lt=shade(sk,FS.lightK),dk=shade(sk,-.3);
  const P=(pts,c,rr)=>{ctx.fillStyle=c;ctx.beginPath();rpath(ctx,pts.map(q=>({x:q[0]*r,y:q[1]*r})),(rr==null?.3:rr)*r);ctx.fill()};
  /* neck: nape, throat, sternocleidomastoid */
  P([[-.66,-.3],[-.88,-1.0],[-1.0,-1.6],[.5,-1.62],[.42,-1.05],[.3,-.8],[.05,-.6]],shade(skin,-.06));
  P([[.05,-.6],[.3,-.8],[.42,-1.05],[.5,-1.62],[.28,-1.62],[.18,-.9]],shade(skin,-.16));
  P([[-.3,-.62],[-.05,-.68],[.32,-1.5],[.18,-1.52]],shade(skin,-.12));
  /* cranium + face profile (straight facets) */
  const nl=F.n||.5,jw=F.jw||.5,ch=F.ch||.5,br=F.br||.5,nf=F.nf||0,lp=F.lp||.5;const tip=[1.12+nl*.1-nf*.06,-.13-nl*.03];
  const prof=[[-.6,-.48],[-.92,-.2],[-1.0,.3],[-.88,.78],[-.5,1.08],[.1,1.16],[.56,1.04],[.82,.74],[.9,.5],[.94+br*.05,.32],[.86,.19],[.9+(F.nh||0)*.06,.08],[.95+(F.nh||0)*.1,-.02],tip,[tip[0]-.12,-.25],[.96,-.28],[1.0+lp*.05,-.35],[.94,-.43],[.99+lp*.05,-.5],[.92,-.58],[.96+ch*.07,-.7],[.93+ch*.05,-.86],[.7,-.94-jw*.03],[.3,-.9-jw*.05],[-.08-jw*.1,-.86],[-.3-jw*.08,-.62]];
  P(prof,sk,.22);
  /* face planes: cheek / temple shadow, jaw underside, lit cheekbone + brow */
  P([[.25,-.05],[.62,-.2],[.68,-.55],[.45,-.82],[.08,-.62]],sh);
  P([[-.34,-.6],[-.12,-.8],[.25,-.92],[.6,-.98],[.9,-.88],[.7,-.82],[.2,-.78],[-.15,-.6]],shade(sk,-.2));
  ctx.globalAlpha=.4+(F.ck!=null?F.ck:.5)*.8;P([[.32,.05],[.72,.02],[.66,-.12],[.38,-.08]],lt);ctx.globalAlpha=1;
  P([[.55,.42],[.9,.4],[.88,.3],[.55,.3]],lt);
  /* ear: outer rim, inner shadow, lobe */
  P([[-.42,.22],[-.12,.26],[-.04,.0],[-.12,-.3],[-.34,-.3],[-.46,-.05]],shade(sk,-.08));P([[-.33,.12],[-.14,.14],[-.12,-.12],[-.3,-.16]],dk);if(lk.cauli)P([[-.44,.1],[-.1,.2],[-.06,-.1],[-.4,-.12]],shade(sk,-.15));
  /* eye: sclera, iris, upper lid line; swelling; KO / daze */
  {const sw=B.swell||0;const ex=.74,ey=.14;if(sw>.15){ctx.globalAlpha=Math.min(.75,sw*.6);P([[ex-.22,ey+.14],[ex+.2,ey+.14],[ex+.24,ey-.12],[ex-.2,ey-.14]],typeof mixHex==='function'?mixHex(skin,'#6a2a4a',.55):'#7a3a50');ctx.globalAlpha=1}
    const lid=B.ko?1:Math.max(B.daze||0,sw>.7?.55:0);
    const eyT=F.ey||0;if(eyT===2)P([[ex-.2,ey+.17],[ex+.2,ey+.17],[ex+.18,ey+.06],[ex-.16,ey+.08]],sh);/* deep-set: shadowed socket */
    if(lid<1){const h=.075*(1-lid*.8)*(sw>.5?.6:1)*(eyT===1?.62:1);P([[ex-.13,ey],[ex-.02,ey+h],[ex+.14,ey+h*.4],[ex+.15,ey-.01],[ex+.02,ey-h*.8]],'#efe9df');P([[ex+.02,ey+h*.8],[ex+.12,ey+h*.6],[ex+.12,ey-h*.7],[ex+.02,ey-h*.7]],'#2a1a10');P([[ex-.14,ey+.005],[ex-.02,ey+h+.025],[ex+.16,ey+h*.45],[ex+.15,ey+h*.3],[ex-.02,ey+h],[ex-.12,ey-.01]],dk)}
    else P([[ex-.13,ey+.01],[ex+.15,ey+.005],[ex+.15,ey-.03],[ex-.13,ey-.02]],dk);
    /* eyebrow */const bc=lk.hs==='bald'||!lk.hair?'#2a1f17':lk.hair;const bt=.04+(F.eb||.5)*.05;P([[ex-.18,ey+.16],[ex+.2,ey+.2+bt*.4],[ex+.2,ey+.2-bt*.5],[ex-.18,ey+.16-bt*.6]],bc)}
  /* nose wing + nostril, mouth line, lips */
  P([[tip[0]-.22,-.1],[tip[0]-.06,-.16],[tip[0]-.1,-.26],[tip[0]-.26,-.24]],shade(sk,-.1));P([[tip[0]-.14,-.22],[tip[0]-.04,-.23],[tip[0]-.06,-.26],[tip[0]-.14,-.26]],shade(sk,-.5));
  {const lc=typeof mixHex==='function'?mixHex(sk,'#8a3b34',.3):sk;P([[.96,-.29],[1.0+lp*.05,-.35],[.95,-.43],[.84,-.42]],lc);P([[.95,-.44],[.99+lp*.05,-.5],[.92,-.56],[.84,-.46]],shade(lc,.06));
    if(B.ko)P([[.84,-.41],[.97,-.41],[.95,-.5],[.86,-.5]],'#2a0d0d');else P([[.97,-.425],[.8,-.415],[.8,-.44],[.95,-.445]],shade(sk,-.5))}
  /* hair + beard */
  const hc=lk.hair||'#16100b';hairFlat(ctx,r,lk,B,hc,P);beardFlat(lk,hc,P);
  /* training headgear: padded crown, forehead band, ear / cheek pad, chin strap */
  if(lk.headgear){const g=lk.headgear,gd=shade(g,-.22),gl=shade(g,.12);P([[-1.08,.22],[-.98,.86],[-.5,1.24],[.3,1.26],[.74,.98],[.9,.62],[.62,.5],[.1,.58],[-.45,.5],[-.7,.2]],g,.35);
    P([[.92,.66],[.6,.5],[.62,.4],[.94,.52]],gd,.3);P([[-.5,1.16],[.25,1.2],[.2,1.08],[-.45,1.05]],gl,.3);
    P([[-.55,.42],[.08,.46],[.2,-.4],[-.05,-.62],[-.5,-.5],[-.66,.0]],g,.4);P([[-.4,.25],[-.05,.27],[0,-.22],[-.32,-.3]],gd,.3);
    P([[.12,-.38],[.24,-.44],[.82,-.86],[.74,-.96]],gd,.2)}
  /* cuts & blood (positions shared with the game's damage system) */
  if(typeof CUTPOS!=='undefined')for(const c of B.cuts||[]){const p=CUTPOS[c.at];if(!p)continue;P([[p[0]-.1,p[1]+.06],[p[0]+.12,p[1]-.03],[p[0]+.12,p[1]-.06],[p[0]-.1,p[1]+.03]],'#5a0303');
    if(c.sev>.25){const L=.3+Math.min(2.2,c.sev*1.1);ctx.globalAlpha=.85;P([[p[0]-.07,p[1]],[p[0]+.08,p[1]],[p[0]+.03,p[1]-L],[p[0]-.02,p[1]-L*.9]],'#960808');ctx.globalAlpha=1}}
  if((B.cuts||[]).some(c=>c.at==='nose')||(B.redness||0)>.72){ctx.globalAlpha=.85;P([[.95,-.24],[1.01,-.26],[.94,-.7],[.88,-.7]],'#8c0608');ctx.globalAlpha=1}
  ctx.restore()}
function hairFlat(ctx,r,lk,B,hc,P){const hs=B.hs||(B.hs=(typeof hairStyleOf==='function'?hairStyleOf(B):'short'));if(hs==='bald'){ctx.globalAlpha=.12;P([[-.3,.98],[.3,1.06],[.4,.95],[-.2,.9]],'#fff');ctx.globalAlpha=1;return}
  /* block cap: hairline at the forehead, over the crown, down the back to the nape; sideburn in front of the ear */
  const cap=(th,front,low)=>[[front,.62],[.78,.95+th*.5],[.36,1.16+th],[-.32,1.16+th],[-.84,.95+th*.6],[-1.06,.45+th*.3],[-1.04,low],[-.66,-.32],[-.5,.05],[-.46,.3],[-.08,.36],[.02,.08],[.12,.08],[.14,.44],[.55,.55]];
  const dk=shade(hc,-.25);
  if(hs==='buzz'){ctx.globalAlpha=.6;P(cap(.0,.72,-.05),hc);ctx.globalAlpha=1;return}
  if(hs==='fade'){ctx.globalAlpha=.45;P(cap(.0,.72,-.05),hc);ctx.globalAlpha=1;P([[.72,.66],[.4,1.24],[-.3,1.22],[-.84,1.0],[-.74,.66],[-.2,.8]],hc);return}
  if(hs==='flat'){ctx.globalAlpha=.5;P(cap(.0,.72,-.05),hc);ctx.globalAlpha=1;P([[.66,.68],[.66,1.32],[-.8,1.32],[-.86,.78],[-.2,.84]],hc);return}
  if(hs==='mohawk'){ctx.globalAlpha=.4;P(cap(.0,.72,-.05),hc);ctx.globalAlpha=1;P([[.5,.95],[.25,1.46],[-.45,1.38],[-.95,.62],[-.3,1.02]],hc);return}
  P(cap(hs==='curly'?.14:.08,.7,hs==='long'?-.2:-.12),hc);
  P([[-.84,1.0],[-1.06,.5],[-1.04,-.1],[-.8,.1],[-.7,.7]],dk);/* back-of-head shadow plane */
  if(hs==='curly')for(let i=0;i<7;i++){const a=.35+i/6*2.3;const cx=Math.cos(a)*.98-.12,cy=Math.sin(a)*.98+.25;P([[cx-.16,cy],[cx,cy+.16],[cx+.16,cy],[cx,cy-.16]],hc)}
  if(hs==='long')P([[-.78,.9],[-1.42,.5],[-1.36,-.7],[-1.0,-.95],[-.98,-.2]],hc);
  if(hs==='bun')P([[-1.15,.95],[-.95,1.15],[-.72,.95],[-.95,.72]],hc);
  if(hs==='slick')P([[.7,.68],[.85,1.12],[.1,1.3],[-.75,1.24],[-1.02,.7],[-.4,.98]],hc);
  if(hs==='braids'||hs==='dreads')for(let i=0;i<4;i++){const x=-.3-i*.18;P([[x,1.0-i*.08],[x-.12,1.0-i*.08],[-1.08-i*.04,-.45-i*.08],[-.96-i*.04,-.45-i*.08]],dk)}}
function beardFlat(lk,hc,P){let bd=lk.bd;if(!bd&&lk.beard)bd='full';if(!bd)return;
  if(bd==='stub'){P([[-.42,-.05],[-.15,-.7],[.3,-.95],[.92,-.92],[1.0,-.62],[.94,-.46],[.78,-.44],[.6,-.5],[.25,-.3],[-.3,-.05]].map(p=>p),'rgba(30,22,16,.32)');return}
  if(bd==='full'){P([[-.44,0],[-.34,-.62],[-.05,-.98],[.35,-1.18],[.8,-1.16],[1.06,-.9],[1.06,-.6],[.98,-.44],[.84,-.4],[.76,-.52],[.55,-.48],[.3,-.25],[-.1,.0]],hc);P([[.78,-.37],[1.04,-.33],[1.03,-.44],[.8,-.44]],hc);P([[-.44,0],[-.34,-.62],[-.05,-.98],[.1,-.8],[-.1,-.4]],shade(hc,-.25));return}
  if(bd==='goatee'){P([[.56,-.6],[.62,-1.06],[.96,-1.04],[1.06,-.62],[1.04,-.42],[.84,-.4],[.84,-.47],[.98,-.48],[.96,-.58]],hc);return}
  if(bd==='must'){P([[.8,-.37],[1.05,-.35],[1.03,-.46],[.82,-.45]],hc);return}
  if(bd==='chin'){P([[-.2,-.5],[.1,-.92],[.55,-1.02],[.98,-1.0],[1.04,-.6],[.8,-.62],[.3,-.6]],hc)}}

/* ---------- flat arena: plain backdrop, simple cage, clean mat — no crowd, lights, logos or effects ---------- */
if(typeof GFX!=='undefined'){GFX.octagon=false}
if(typeof GPU!=='undefined'){Object.assign(GPU,{dof:0,bloom:0,rim:0,contrast:1,saturation:1,vignette:0})}
/* rounded rectangle helper for props */
function rr(ctx,x,y,w,h,r){r=Math.min(r,Math.abs(w)/2,Math.abs(h)/2);ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);ctx.fill()}
const BG={wall:'#ece9e3',wallLow:'#e2ded6',fence:'#2a2b30',post:'#18191c',rail:'#101113',mesh:'#3a3b42',mat:'#dedad3',matEdge:'#d2cdc4',ring:'#c9473f'};
if(typeof Stage!=='undefined'){
  Stage.prototype.drawBack0=function(){const G=this.gpu;const near=this.ctx,dpr=this.dpr,W=this.W,H=this.Hh,s=this.sc();
    if(this._match&&this._match.cfg&&this._match.cfg.training==='bag')return drawGym(this);
    if(G){G.farX.setTransform(1,0,0,1,0,0);G.farX.fillStyle=BG.wall;G.farX.fillRect(0,0,G.far.width,G.far.height)}
    near.setTransform(dpr,0,0,dpr,0,0);const ctx=near;const gy=H*this.cam.gy;const dp=.62;const fy=gy-.95*s;this.fy=fy;
    ctx.fillStyle=BG.wall;ctx.fillRect(0,0,W,fy);ctx.fillStyle=BG.wallLow;ctx.fillRect(0,fy-.9*s*dp,W,.9*s*dp);
    const ring=this.venue.startsWith('ring');const top=fy-1.75*s*dp;
    if(ring){const R=this.R,x0=this.px(-R,dp),x1=this.px(R,dp);for(const x of[x0,x1]){ctx.fillStyle=BG.post;rr(ctx,x-.06*s*dp,fy-1.45*s*dp,.12*s*dp,1.45*s*dp,.06*s*dp)}
      for(let i=0;i<4;i++){const y=fy-(.42+i*.32)*s*dp;ctx.fillStyle=i%2?this.col:BG.rail;rr(ctx,x0,y-.02*s*dp,x1-x0,.04*s*dp,.02*s*dp)}}
    else{this._oct=1}
    {const C=this.cam,cx=C.x;C.x-=this.rot;this.drawMat(fy,gy,s);C.x=cx}
    if(!ring)drawOctagon(this,ctx,W,H,s,gy,fy);
    /* camera-pan motion blur on the backdrop (fighters stay sharp) */
    {const cx=this.cam.x+(this.rot||0);const v=this._pcx==null?0:(cx-this._pcx)*s;this._pcx=cx;this._bv=(this._bv||0)*.6+v*.4;const px=Math.min(14,Math.abs(this._bv)*1.7);
      if(px>1.2){const cv=ctx.canvas;const dir=Math.sign(this._bv);ctx.save();ctx.setTransform(1,0,0,1,0,0);const n=4;for(let i=1;i<=n;i++){ctx.globalAlpha=.2*(1-i/(n+1));ctx.drawImage(cv,dir*px*dpr*i/n,0)}ctx.restore()}}};
  Stage.prototype.drawMat=function(fy,gy,s){const ctx=this.ctx,W=this.W,H=this.Hh;if(this.venue.startsWith('ring')){ctx.fillStyle=BG.mat;ctx.fillRect(0,fy,W,H-fy);ctx.fillStyle=BG.matEdge;ctx.fillRect(0,fy,W,.06*s)}else drawOctFloor(this,ctx,W,H,s,gy,fy);
    if(!this.venue.startsWith('ring')){const k=.86;const cx=(0-this.cam.x*k)*s*k+W/2,cy=fy+(H-fy)*.45;ctx.strokeStyle=this.col||BG.ring;ctx.globalAlpha=.55;ctx.lineWidth=.035*s;ctx.beginPath();ctx.ellipse(cx,cy,2.2*s*k*this.R/4.3,.55*s,0,0,7);ctx.stroke();ctx.globalAlpha=1}
    for(const d of this.decals){d.age=(d.age||0)+1/60;const k=.72+.28*d.z;const sy=fy+(H-fy)*d.z*.95;const x=(d.x-this.cam.x*k)*s*k+W/2;const dk=Math.min(1,d.age/25);const rr=Math.round((130+d.c*30)*(1-dk*.4));
      ctx.fillStyle=`rgba(${rr},10,10,${d.a})`;ctx.beginPath();ctx.ellipse(x,sy,d.r*s*k*(d.str||1),d.r*s*.3,0,0,7);if(d.sat)for(const q of d.sat){ctx.moveTo(x+q[0]*s*k+q[2]*s*k,sy+q[1]*s*.3);ctx.ellipse(x+q[0]*s*k,sy+q[1]*s*.3,q[2]*s*k,q[2]*s*.3,0,0,7)}ctx.fill()}}}

/* ---------- quick step (dash): a real step instead of a slide ---------- */
{const fw=F2.prototype.footwork;F2.prototype.footwork=function(p,dt){fw.call(this,p,dt);const D=this.dash;if(!D||this.state!=='stand'||this.name==='ref')return;
    const u=1-Math.max(0,D.t/D.T);const a1=u<.6?Math.sin(Math.PI*u/.6):0,a2=u>.4?Math.sin(Math.PI*(u-.4)/.6):0;
    if(D.fwd){p.ll_h+=.36*a1;p.ll_k+=.26*a1;p.rl_a+=.32*a1;p.rl_h+=.24*a2;p.rl_k+=.36*a2;p.rl_a+=.3*a2}
    else{p.rl_h-=.32*a1;p.rl_k+=.3*a1;p.ll_a+=.2*a1;p.ll_h-=.24*a2;p.ll_k+=.3*a2;p.ll_a+=.16*a2}
    p.y=(p.y||0)-.01*this.H*(a1+a2)*.5}}

/* ---------- hit effects in the same flat style: solid angular shapes, no glow ---------- */
const FX={spark:'#fff4d6',sparkSh:'#e9a23b',sweat:'#d5e4ef',blood:'#8e1414',bloodSh:'#6e0e0e'};
function burstPoly(ctx,x,y,R0,R1,n,rot,col){ctx.fillStyle=col;ctx.beginPath();for(let i=0;i<n*2;i++){const a=i/(n*2)*Math.PI*2+rot;const r=i%2?R0:R1;const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath();ctx.fill()}
function shard(ctx,x,y,a,l,w,col){const c=Math.cos(a),s=Math.sin(a);ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(x+c*l,y+s*l);ctx.lineTo(x-s*w,y+c*w);ctx.lineTo(x-c*l*.25,y-s*l*.25);ctx.lineTo(x+s*w,y-c*w);ctx.closePath();ctx.fill()}
Stage.prototype.drawFx=function(dt){const ctx=this.ctx;this.worldT(ctx);ctx.save();ctx.globalCompositeOperation='source-over';
  for(const p of this.parts){
    if(p.kind==='mist'){p.vx*=Math.exp(-dt*4);p.vy=p.vy*Math.exp(-dt*4)-1.2*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;p.r+=dt*.05;ctx.globalAlpha=Math.max(0,p.life)*.45;burstPoly(ctx,p.x,p.y,p.r*.7,p.r,4,p.x*9,FX.blood);ctx.globalAlpha=1;continue}
    p.vy-=9.8*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;
    if(p.y<=0&&p.kind==='blood'){p.life=0;if(this.decals.length>220)this.decals.shift();const R=p.r*2.6+Math.random()*.03;const sat=[];const ns=2+Math.floor(Math.random()*3);for(let i=0;i<ns;i++)sat.push([(Math.random()-.5)*R*3+Math.sign(p.vx)*R*.8,Math.random()*.06-.03,R*(.15+Math.random()*.3)]);this.decals.push({x:p.x,z:.35+Math.random()*.25,r:R,a:.55+Math.random()*.3,c:Math.random(),sat,str:Math.min(2.5,1+Math.abs(p.vx)*.4),age:0});continue}
    const a=Math.atan2(p.vy,p.vx),sp=Math.hypot(p.vx,p.vy);
    if(p.kind==='blood')shard(ctx,p.x,p.y,a,p.r*(1.4+sp*.25),p.r*.8,FX.blood);
    else{ctx.globalAlpha=Math.min(1,p.life*2)*.85;shard(ctx,p.x,p.y,a,p.r*(1.2+sp*.15),p.r*.6,FX.sweat);ctx.globalAlpha=1}}
  this.parts=this.parts.filter(p=>p.life>0&&p.y>-0.2);
  /* strike flashes removed: the struck body part jiggles instead (see Body draw) */
  this.fx=[];this.ifx=[];this._cfx=[];this.scrFlash=0;this.gpuFlash=0;
  ctx.restore()};
if(typeof IFX!=='undefined'){IFX.ring.life=.28}

/* ---------- referee: front view, black polo / trousers / boots / gloves, flat planes ---------- */
/* four generic officials: long locs + full beard, bald fair, short dark hair, bald brown */
const REF_FLAT=[{skin:'#6e4630',hair:'locs',hc:'#141110',beard:'full',bc:'#141110',w:1.03,h:1.03},{skin:'#e7bc9c',hair:'bald',bc:'#8a7462',w:1.06,h:.99},
  {skin:'#e4b593',hair:'short',hc:'#2b211b',bc:'#2b211b',w:1,h:1.01},{skin:'#8a5a3e',hair:'bald',bc:'#2a1d15',w:1.05,h:1}];
window.drawRefFront2=function(ctx0,r,t){let ctx=ctx0;if(window.__gpuFig&&ctx0.canvas===window.__gpuFig&&window.__gpuNearX){ctx=window.__gpuNearX;ctx.setTransform(ctx0.getTransform())}
  ctx.save();ctx.filter='none';const lk=r._flk2||(r._flk2=REF_FLAT[Math.floor(Math.random()*REF_FLAT.length)]);const H=1.92,x=r.x;const mv=Math.min(1,Math.abs(r.vx||0)*2),ph=r.stepPh||0;
  const mode=r.raise===1||r.raise===-1?'raise':r.mode||'watch';const crouch=mode==='ground'?.15:mode==='watch'?.04:mode==='wave'?.03:0;
  const skin=lk.skin,skS=shade(skin,-.12),skD=shade(skin,-.22);const K='#1f2023',KS='#16171a',KL='#2a2b2f',KD='#0f1012';
  const Q=(pts,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.closePath();ctx.fill()};
  const C=(cx,cy,rr,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(cx,cy,rr,0,7);ctx.fill()};
  const hip=(.525-crouch)*H+Math.abs(Math.sin(ph))*.008*mv,sh=(.81-crouch)*H,head=sh+.185;const sw=Math.sin(ph)*.06*mv;const kneeOut=mode==='ground'?.07:.025;
  ctx.translate(x,0);ctx.scale(lk.w,lk.h);ctx.translate(-x,0);
  /* trousers + boots */
  for(const[sx,off]of[[-1,sw],[1,-sw]]){const kx=x+sx*(.1+kneeOut)+off*.5,ky=hip*.5;const fx=x+sx*.115+off;
    Q([[x+sx*.005,hip+.02],[x+sx*.17,hip+.02],[kx+sx*.075,ky],[fx+sx*.068,.1],[fx-sx*.062,.1],[kx-sx*.062,ky],[x+sx*.005,hip-.09]],K);
    Q([[x+sx*.115,hip+.02],[x+sx*.17,hip+.02],[kx+sx*.075,ky],[fx+sx*.068,.1],[fx+sx*.015,.1],[kx+sx*.02,ky]],KS);
    Q([[fx-sx*.068,.0],[fx+sx*.095,.0],[fx+sx*.09,.045],[fx+sx*.07,.11],[fx-sx*.062,.11],[fx-sx*.07,.05]],KD);Q([[fx-sx*.068,.0],[fx+sx*.095,.0],[fx+sx*.095,.016],[fx-sx*.068,.016]],'#08080a')}
  /* polo body: chest plane, side shadow, tucked waist */
  Q([[x-.24,sh],[x,sh+.045],[x+.24,sh],[x+.22,sh-.2],[x+.172,hip+.04],[x-.172,hip+.04],[x-.22,sh-.2]],K);
  Q([[x+.13,sh+.025],[x+.24,sh],[x+.22,sh-.2],[x+.172,hip+.04],[x+.11,hip+.04],[x+.12,sh-.15]],KS);Q([[x-.24,sh],[x-.13,sh+.025],[x-.15,sh-.12],[x-.22,sh-.2]],KL);
  /* belt, buckle, pouch on the hip */
  Q([[x-.176,hip-.005],[x+.176,hip-.005],[x+.176,hip+.042],[x-.176,hip+.042]],KD);Q([[x-.026,hip+.002],[x+.026,hip+.002],[x+.026,hip+.034],[x-.026,hip+.034]],'#8d9097');Q([[x-.017,hip+.009],[x+.017,hip+.009],[x+.017,hip+.027],[x-.017,hip+.027]],KD);
  Q([[x-.2,hip+.03],[x-.15,hip+.03],[x-.15,hip-.06],[x-.2,hip-.06]],'#141517');
  /* placket, buttons, collar, white chest mark (generic, no logo) */
  Q([[x-.016,sh-.16],[x+.016,sh-.16],[x+.016,sh-.01],[x-.016,sh-.01]],KS);C(x,sh-.05,.006,'#3a3b40');C(x,sh-.1,.006,'#3a3b40');
  Q([[x-.09,sh+.035],[x-.012,sh-.04],[x-.034,sh-.075],[x-.11,sh+.003]],KL);Q([[x+.09,sh+.035],[x+.012,sh-.04],[x+.034,sh-.075],[x+.11,sh+.003]],KL);
  Q([[x+.09,sh-.085],[x+.16,sh-.085],[x+.155,sh-.11],[x+.095,sh-.11]],'#e9e7e3');
  /* arms: short sleeve → bare forearm → black glove; same pose blending as before */
  const T={watch:[[.06,-.3],[.06,-.58]],ground:[[.13,-.22],[.12,-.44]],break:[[.25,-.05],[.55,-.02]],idle:[[.04,-.3],[.05,-.6]]};
  r._arm=r._arm||{l:[[.04,-.3],[.05,-.6]],r:[[.04,-.3],[.05,-.6]]};
  const seg=(a,b,w0,w1,c)=>{const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1e-5;const nx=-dy/L,ny=dx/L;Q([[a.x+nx*w0,a.y+ny*w0],[b.x+nx*w1,b.y+ny*w1],[b.x-nx*w1,b.y-ny*w1],[a.x-nx*w0,a.y-ny*w0]],c);C(a.x,a.y,w0,c);C(b.x,b.y,w1,c)};
  for(const[side,sx]of[['l',-1],['r',1]]){let tgt;if(mode==='wave'){const w=Math.sin(t*14+(sx>0?0:Math.PI));tgt=[[.17,-.06],[.18+.22*w,.02]]}else if(mode==='raise'){tgt=r.raise===sx?[[.08,.25],[.1,.52]]:T.idle}else tgt=T[mode]||T.watch;
    const A=r._arm[side];for(let i=0;i<2;i++)for(let j=0;j<2;j++)A[i][j]+=(tgt[i][j]-A[i][j])*.22;
    const S={x:x+sx*.205,y:sh-.035},E={x:S.x+sx*A[0][0],y:S.y+A[0][1]},W={x:S.x+sx*A[1][0],y:S.y+A[1][1]};const M2={x:S.x+(E.x-S.x)*.55,y:S.y+(E.y-S.y)*.55};
    const sc=sx>0?skS:skin;seg(M2,E,.04,.035,sc);seg(E,W,.035,.028,sc);
    seg(S,M2,.07,.066,sx>0?KS:K);
    /* glove: cuff + fist block + thumb */const hx=W.x+(W.x-E.x)*.28,hy=W.y+(W.y-E.y)*.28;seg(W,{x:hx,y:hy},.034,.046,'#121214');const ang=Math.atan2(hy-W.y,hx-W.x),c=Math.cos(ang),s=Math.sin(ang);
    Q([[hx+c*.035-s*.04,hy+s*.035+c*.04],[hx+c*.055,hy+s*.055],[hx+c*.035+s*.04,hy+s*.035-c*.04]],'#1d1d20');Q([[W.x-s*.03*sx,W.y+c*.03*sx],[hx-s*.05*sx,hy+c*.05*sx],[hx-s*.035*sx+c*.02,hy+c*.035*sx+s*.02]],'#1d1d20')}
  /* shoulders */Q([[x-.27,sh-.075],[x-.205,sh+.012],[x-.14,sh-.01],[x-.15,sh-.085]],K);Q([[x+.27,sh-.075],[x+.205,sh+.012],[x+.14,sh-.01],[x+.15,sh-.085]],KS);
  /* neck + head */
  Q([[x-.05,sh-.01],[x+.05,sh-.01],[x+.046,sh+.085],[x-.046,sh+.085]],skD);
  const hy=head,s=1.0;const P=(px,py)=>[x+px*s,hy-.05+(py+.05)*s];
  if(lk.hair==='locs'){/* locs fall behind the head to the shoulders */Q([P(-.1,.1),P(-.12,-.02),P(-.14,-.2),P(-.09,-.22),P(-.06,-.05),P(.06,-.05),P(.09,-.22),P(.14,-.2),P(.12,-.02),P(.1,.1),P(0,.13)],lk.hc)}
  const hd=[P(0,.118),P(.06,.11),P(.086,.06),P(.088,-.02),P(.074,-.07),P(.046,-.11),P(0,-.125),P(-.046,-.11),P(-.074,-.07),P(-.088,-.02),P(-.086,.06),P(-.06,.11)];
  Q(hd,skin);Q([P(.0,.118),P(.06,.11),P(.086,.06),P(.088,-.02),P(.074,-.07),P(.046,-.11),P(0,-.125),P(.03,-.05),P(.04,.04)],skS);
  Q([P(-.094,.02),P(-.084,.026),P(-.082,-.035),P(-.096,-.03)],skD);Q([P(.094,.02),P(.084,.026),P(.082,-.035),P(.096,-.03)],skD);
  if(lk.hair==='short')Q([P(-.088,.04),P(-.084,.08),P(-.06,.115),P(0,.128),P(.06,.115),P(.084,.08),P(.088,.04),P(.07,.07),P(.0,.09),P(-.07,.07)],lk.hc);
  if(lk.hair==='locs'){Q([P(-.088,.03),P(-.07,.1),P(0,.13),P(.07,.1),P(.088,.03),P(.06,.08),P(0,.095),P(-.06,.08)],lk.hc);for(const k of[-1,1])Q([P(k*.088,.04),P(k*.1,-.02),P(k*.11,-.16),P(k*.092,-.16),P(k*.084,-.02)],shade(lk.hc,.12))}
  if(lk.hair==='bald')Q([P(-.03,.1),P(.03,.105),P(.02,.092),P(-.03,.088)],shade(skin,.1));
  for(const k of[-1,1]){Q([P(k*.022,.012),P(k*.05,.014),P(k*.05,.002),P(k*.022,.0)],'#eee8de');Q([P(k*.031,.013),P(k*.042,.013),P(k*.042,.001),P(k*.031,.001)],'#1d140e');Q([P(k*.016,.03),P(k*.058,.034),P(k*.058,.024),P(k*.016,.021)],lk.bc)}
  Q([P(0,.004),P(.013,-.036),P(-.013,-.036)],skD);
  if(lk.beard==='full'){Q([P(-.084,-.005),P(-.074,-.07),P(-.046,-.115),P(0,-.135),P(.046,-.115),P(.074,-.07),P(.084,-.005),P(.05,-.04),P(.03,-.062),P(-.03,-.062),P(-.05,-.04)],lk.bc);Q([P(-.032,-.042),P(.032,-.042),P(.026,-.052),P(-.026,-.052)],lk.bc)}
  Q([P(-.02,-.062),P(.02,-.062),P(.018,-.068),P(-.018,-.068)],shade(skin,-.45));
  ctx.restore()};

/* ---------- referee, side view (during the fight): walks / jogs with real proportions, crouches to watch ---------- */
window.drawRefSide=function(ctx0,r,t){let ctx=ctx0;if(window.__gpuFig&&ctx0.canvas===window.__gpuFig&&window.__gpuNearX){ctx=window.__gpuNearX;ctx.setTransform(ctx0.getTransform())}
  ctx.save();ctx.filter='none';const lk=r._flk2||(r._flk2=REF_FLAT[Math.floor(Math.random()*REF_FLAT.length)]);const d=r.d||1,X=r.x;
  const skin=lk.skin,skS=shade(skin,-.12),skD=shade(skin,-.22),K='#1f2023',KS='#16171a',KL='#2a2b2f',KD='#0f1012',KF='#131416';
  const sp=Math.min(1.8,Math.abs(r.vx||0)),walk=Math.min(1,sp/.45),run=clamp((sp-.7)/.7,0,1);const ph=r.stepPh||0;
  const mode=r.wave>0?'wave':r.mode||'watch';const crT=(mode==='ground'||r.hurtWatch)&&sp<.35?1:0;r._cr=(r._cr||0)+(crT-(r._cr||0))*.08;const cr=r._cr;
  const W=(lx,ly)=>({x:X+d*lx,y:ly});const Q=(pts,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.closePath();ctx.fill()};
  const C=(p,rr,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(p.x,p.y,rr,0,7);ctx.fill()};
  const seg=(a,b,w0,w1,c)=>{const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1e-5;const nx=-dy/L,ny=dx/L;Q([{x:a.x+nx*w0,y:a.y+ny*w0},{x:b.x+nx*w1,y:b.y+ny*w1},{x:b.x-nx*w1,y:b.y-ny*w1},{x:a.x-nx*w0,y:a.y-ny*w0}],c);C(a,w0,c);C(b,w1,c)};
  /* legs (local: +x forward) */const L1=.45,L2=.44,AH=.085;const A=(.3+.16*run)*walk;
  const legA=(p)=>({h:A*Math.sin(p)+cr*.85,k:.06+(.45+.6*run)*walk*Math.max(0,Math.cos(p))+cr*1.35});
  const ln=legA(ph),lf=legA(ph+Math.PI);const ext=g=>L1*Math.cos(g.h)+L2*Math.cos(g.h-g.k);const hipY=AH+Math.max(ext(ln),ext(lf))+(1-walk)*0;
  const legPts=g=>{const K1={x:Math.sin(g.h)*L1,y:hipY-Math.cos(g.h)*L1};const A1={x:K1.x+Math.sin(g.h-g.k)*L2,y:K1.y-Math.cos(g.h-g.k)*L2};return{H:{x:0,y:hipY},K:K1,A:A1}};
  const lean=.04+.12*run+cr*.6+(mode==='wave'?.08:0);const up={x:Math.sin(lean),y:Math.cos(lean)},fw={x:Math.cos(lean),y:-Math.sin(lean)};
  const T=(u,v)=>({x:up.x*u+fw.x*v,y:hipY+up.y*u+fw.y*v});
  const drawLeg=(g,far)=>{const P=legPts(g);const c=far?KF:K;const h=W(P.H.x,P.H.y),k=W(P.K.x,P.K.y),a=W(P.A.x,P.A.y);seg(h,k,.088,.065,c);seg(k,a,.062,.052,c);
    /* boot: heel, sole, toe cap, shaft */const fd=d;Q([{x:a.x-fd*.07,y:a.y+.05},{x:a.x+fd*.06,y:a.y+.06},{x:a.x+fd*.2,y:a.y-.035},{x:a.x+fd*.205,y:a.y-.085},{x:a.x-fd*.08,y:a.y-.085}],far?'#0b0b0c':KD);Q([{x:a.x-fd*.08,y:a.y-.085},{x:a.x+fd*.205,y:a.y-.085},{x:a.x+fd*.205,y:a.y-.068},{x:a.x-fd*.08,y:a.y-.068}],'#070708')};
  /* arms */const SH=T(.55,0);const armPose=(far)=>{let s1,e1;const sw=(far?-1:1)*A*.9*Math.sin(ph);
      if(mode==='wave'){const w=Math.sin(t*14+(far?Math.PI:0));s1=2.4+w*.45;e1=.25}
      else if(mode==='break'){s1=1.45;e1=.15}
      else if(cr>.5){s1=lean*.55+.32;e1=.3}/* hands on the knees */
      else{s1=-sw+.12+lean*.5;e1=.3+run*1.1+(1-walk)*.15}return{s1,e1}};
  const drawArm=(far)=>{const{s1,e1}=armPose(far);const S=W(SH.x,SH.y);const E=W(SH.x+Math.sin(s1)*.31,SH.y-Math.cos(s1)*.31);const Wr=W(SH.x+Math.sin(s1)*.31+Math.sin(s1+e1)*.27,SH.y-Math.cos(s1)*.31-Math.cos(s1+e1)*.27);
    const Hd={x:Wr.x+(Wr.x-E.x)*.34,y:Wr.y+(Wr.y-E.y)*.34};const sk=far?skD:skin;seg(E,Wr,.036,.028,sk);seg(V2l(S,E,.5),E,.04,.036,sk);seg(Wr,Hd,.034,.042,far?'#0c0c0d':'#141416');seg(S,V2l(S,E,.58),.066,.062,far?KS:K)};
  const V2l=(a,b,k)=>({x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k});
  /* draw: far arm, far leg, torso, near leg, belt, head, near arm */
  drawArm(true);drawLeg(lf,true);
  {const P=[T(0,-.12),T(.2,-.125),T(.42,-.14),T(.53,-.12),T(.6,-.06),T(.62,.0),T(.6,.06),T(.52,.13),T(.42,.14),T(.28,.115),T(.12,.12),T(0,.13)].map(p=>W(p.x,p.y));Q(P,K);
   Q([T(0,-.12),T(.2,-.125),T(.42,-.14),T(.53,-.12),T(.5,-.05),T(.3,-.06),T(.1,-.06)].map(p=>W(p.x,p.y)),KS);Q([T(.52,.13),T(.42,.14),T(.36,.08),T(.5,.06)].map(p=>W(p.x,p.y)),KL);
   /* collar + placket */Q([T(.6,-.04),T(.64,.0),T(.62,.07),T(.56,.07)].map(p=>W(p.x,p.y)),KL);Q([T(.56,.12),T(.4,.135),T(.4,.12),T(.56,.105)].map(p=>W(p.x,p.y)),KS)}
  drawLeg(ln,false);
  {/* belt, buckle, pouch */const b=[T(.07,-.125),T(.07,.135),T(.115,.133),T(.115,-.125)].map(p=>W(p.x,p.y));Q(b,KD);Q([T(.075,.1),T(.075,.136),T(.11,.136),T(.11,.1)].map(p=>W(p.x,p.y)),'#8d9097');Q([T(.0,-.02),T(.0,.05),T(.1,.05),T(.1,-.02)].map(p=>W(p.x,p.y)),'#121315')}
  /* neck + head (profile) */
  {const N0=T(.6,.02);const ha=lean*.35;const hu={x:Math.sin(ha),y:Math.cos(ha)},hf={x:Math.cos(ha),y:-Math.sin(ha)};const hc={x:N0.x+hu.x*.17,y:N0.y+hu.y*.17};const h=.24;
   const Hp=(u,v)=>W(hc.x+hf.x*u*h+hu.x*v*h,hc.y+hf.y*u*h+hu.y*v*h);
   Q([W(N0.x-.045,N0.y-.02),W(N0.x+.05,N0.y-.02),Hp(.18,-.3),Hp(-.2,-.2)],skD);
   if(lk.hair==='locs')Q([Hp(-.3,.3),Hp(-.48,.2),Hp(-.62,-.35),Hp(-.72,-1.0),Hp(-.52,-1.05),Hp(-.42,-.4),Hp(-.32,-.1)],lk.hc);
   const prof=[Hp(-.42,.1),Hp(-.38,.32),Hp(-.2,.47),Hp(.08,.5),Hp(.3,.4),Hp(.38,.2),Hp(.4,.08),Hp(.37,.03),Hp(.47,-.1),Hp(.39,-.15),Hp(.41,-.22),Hp(.37,-.3),Hp(.3,-.4),Hp(.05,-.38),Hp(-.1,-.22),Hp(-.25,-.12),Hp(-.4,-.05)];Q(prof,skin);
   Q([Hp(.1,-.05),Hp(.3,-.08),Hp(.3,-.3),Hp(.05,-.36),Hp(-.08,-.22)],skS);
   Q([Hp(-.14,.08),Hp(-.02,.08),Hp(0,-.08),Hp(-.12,-.12)],skD);
   Q([Hp(.24,.07),Hp(.36,.075),Hp(.35,.035),Hp(.25,.035)],'#ece6dc');Q([Hp(.3,.07),Hp(.355,.07),Hp(.35,.04),Hp(.3,.04)],'#1d140e');Q([Hp(.2,.13),Hp(.39,.14),Hp(.39,.11),Hp(.2,.1)],lk.bc);
   if(lk.hair==='short')Q([Hp(-.42,.12),Hp(-.38,.36),Hp(-.2,.51),Hp(.1,.54),Hp(.32,.43),Hp(.36,.3),Hp(.2,.38),Hp(-.05,.3),Hp(-.1,.12),Hp(-.25,.0),Hp(-.4,-.05)],lk.hc);
   if(lk.hair==='locs')Q([Hp(-.43,.14),Hp(-.38,.38),Hp(-.2,.52),Hp(.1,.54),Hp(.33,.42),Hp(.36,.3),Hp(.2,.36),Hp(-.05,.28),Hp(-.12,.1),Hp(-.3,-.05),Hp(-.42,-.02)],lk.hc);
   if(lk.hair==='bald')Q([Hp(-.1,.47),Hp(.1,.49),Hp(.08,.44),Hp(-.08,.43)],shade(skin,.1));
   if(lk.beard==='full'){Q([Hp(-.2,-.12),Hp(-.05,-.05),Hp(.12,-.1),Hp(.3,-.16),Hp(.43,-.17),Hp(.43,-.24),Hp(.39,-.33),Hp(.3,-.44),Hp(.02,-.42),Hp(-.12,-.26)],lk.bc);Q([Hp(.36,-.15),Hp(.46,-.14),Hp(.45,-.19),Hp(.37,-.2)],lk.bc)}
   Q([Hp(.33,-.25),Hp(.41,-.245),Hp(.41,-.26),Hp(.33,-.265)],shade(skin,-.45))}
  drawArm(false);
  ctx.restore()};

/* ---------- hit jiggle: the struck part shakes briefly (damped, ~22 Hz) ---------- */
const JIG_K={head:['hd','nk'],body:['sh','mid','lS','rS','nk'],legL:['lK','lA','lHe','lT','lSn'],legR:['rK','rA','rHe','rT','rSn']};
{const D=Body.prototype.draw;Body.prototype.draw=function(ctx,o){const g=this._jig;if(!g||!this.J.hd)return D.call(this,ctx,o);const age=(performance.now()-g.t0)/1000;if(age>.4){this._jig=null;return D.call(this,ctx,o)}
    const k=g.a*Math.exp(-age*9)*Math.sin(age*2*Math.PI*22),J=this.J,save={};const keys=JIG_K[g.z]||JIG_K.body;
    keys.forEach((n,i)=>{const q=J[n];if(!q)return;save[n]=q;const w=n==='nk'||n==='mid'?.55:1;J[n]={x:q.x+k*g.dx*w,y:q.y+k*.35*w}});
    try{return D.call(this,ctx,o)}finally{for(const n in save)J[n]=save[n]}}}
window.hitJiggle=function(body,zone,amp,dir,leg){body._jig={z:zone==='head'?'head':zone==='leg'?(leg==='r'?'legR':'legL'):'body',t0:performance.now(),a:amp,dx:dir||1}};

/* ---------- training centre backdrop (heavy-bag session) ---------- */
function drawGym(S){const ctx=S.ctx,dpr=S.dpr,W=S.W,H=S.Hh,s=S.sc();ctx.setTransform(dpr,0,0,dpr,0,0);const gy=H*S.cam.gy;const fy=gy-.95*s;S.fy=fy;const dp=.7;const px=x=>S.px(x,dp);
  ctx.fillStyle='#e7e1d6';ctx.fillRect(0,0,W,H);ctx.fillStyle='#d9d1c3';ctx.fillRect(0,fy-.55*s*dp,W,.55*s*dp);/* wall + wainscot */
  /* windows / mirrors */for(let i=-6;i<=6;i++){const x=px(i*2.6);ctx.fillStyle='#cfd8dc';rr(ctx,x-.9*s*dp,fy-2.2*s*dp,1.8*s*dp,1.25*s*dp,.08*s*dp);ctx.fillStyle='rgba(255,255,255,.35)';rr(ctx,x-.75*s*dp,fy-2.1*s*dp,.35*s*dp,1.05*s*dp,.05*s*dp)}
  /* banners */for(let i=-4;i<=4;i++){const x=px(i*3.9+1.3);ctx.fillStyle=i%2?'#b33a2e':'#2c3e66';rr(ctx,x-.25*s*dp,fy-2.55*s*dp,.5*s*dp,.9*s*dp,.06*s*dp);ctx.fillStyle='rgba(255,255,255,.75)';rr(ctx,x-.15*s*dp,fy-2.3*s*dp,.3*s*dp,.06*s*dp,.03*s*dp)}
  /* equipment along the wall: dumbbell racks, kettlebells, a speed-bag platform, more heavy bags, a boxing-ring corner */
  for(let i=-5;i<=5;i++){const x=px(i*3.2-1.1);const k=((i%4)+4)%4;
    if(k===0){/* dumbbell rack */ctx.fillStyle='#5a5148';rr(ctx,x-.6*s*dp,fy-.6*s*dp,1.2*s*dp,.08*s*dp,.04*s*dp);rr(ctx,x-.55*s*dp,fy-.6*s*dp,.07*s*dp,.6*s*dp,.03*s*dp);rr(ctx,x+.48*s*dp,fy-.6*s*dp,.07*s*dp,.6*s*dp,.03*s*dp);
      for(let j=0;j<5;j++){const bx=x-.45*s*dp+j*.22*s*dp;ctx.fillStyle='#2b2b2e';rr(ctx,bx,fy-.72*s*dp,.09*s*dp,.14*s*dp,.04*s*dp);rr(ctx,bx+.11*s*dp,fy-.72*s*dp,.09*s*dp,.14*s*dp,.04*s*dp);ctx.fillStyle='#8a8f96';rr(ctx,bx+.05*s*dp,fy-.67*s*dp,.1*s*dp,.04*s*dp,.02*s*dp)}}
    else if(k===1){/* kettlebells */for(let j=0;j<4;j++){const bx=x-.4*s*dp+j*.27*s*dp,r=(.08+j*.012)*s*dp;ctx.fillStyle='#2b2b2e';ctx.beginPath();ctx.arc(bx,fy-r,r,0,7);ctx.fill();ctx.strokeStyle='#2b2b2e';ctx.lineWidth=.025*s*dp;ctx.beginPath();ctx.arc(bx,fy-r*2,r*.6,Math.PI,0);ctx.stroke()}}
    else if(k===2){/* speed-bag platform */ctx.fillStyle='#6d5a44';rr(ctx,x-.45*s*dp,fy-2.0*s*dp,.9*s*dp,.1*s*dp,.05*s*dp);ctx.fillStyle='#4b3e30';rr(ctx,x-.05*s*dp,fy-1.9*s*dp,.1*s*dp,1.9*s*dp,.04*s*dp);ctx.fillStyle='#8a2c26';ctx.beginPath();ctx.ellipse(x+.22*s*dp,fy-1.72*s*dp,.09*s*dp,.13*s*dp,0,0,7);ctx.fill()}
    else{/* hanging heavy bag (background) */ctx.strokeStyle='#5a5148';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,fy-2.7*s*dp);ctx.lineTo(x,fy-1.95*s*dp);ctx.stroke();ctx.fillStyle='#3a3d44';rr(ctx,x-.17*s*dp,fy-1.95*s*dp,.34*s*dp,1.3*s*dp,.15*s*dp);ctx.fillStyle='#2a2c31';rr(ctx,x-.17*s*dp,fy-1.9*s*dp,.12*s*dp,1.2*s*dp,.06*s*dp)}}
  /* wooden floor with planks + a rubber training mat under the bag */
  ctx.fillStyle='#c79f72';ctx.fillRect(0,fy,W,H-fy);ctx.strokeStyle='rgba(120,84,48,.35)';ctx.lineWidth=1;ctx.beginPath();for(let k=1;k<9;k++){const y=fy+(H-fy)*k/9*k/9*1.0;ctx.moveTo(0,y);ctx.lineTo(W,y)}ctx.stroke();
  {const k=.86;const cx=(0-S.cam.x*k)*s*k+W/2,cy=fy+(H-fy)*.45;ctx.fillStyle='#3b3f46';ctx.save();ctx.translate(cx,cy);ctx.scale(1,.28);ctx.beginPath();if(ctx.roundRect)ctx.roundRect(-2.6*s,-1.6*s,5.2*s,3.2*s,.6*s);ctx.fill();ctx.restore()}
  S.decals=S.decals||[]}

/* ---------- the octagon as a 2.5D object: floor polygon + fence panels on the far half, rotating as the
   fighters circle (stage.rot). The fighters stand on the plane through the centre (depth 0); the fence meets
   that plane at ±stage.R, which is updated every frame so collisions match the drawn fence exactly. ---------- */
function octGeom(S,W,H,s,gy,fy){if(S.R0==null)S.R0=S.R;const R0=S.R0,Rc=R0/Math.cos(Math.PI/8);const ang=(S.rot||0)/R0;const camx=S.cam.x-(S.rot||0);
  const V=[];for(let i=0;i<8;i++){const t=ang+(i+.5)*Math.PI/4;V.push({X:Rc*Math.cos(t),Z:Rc*Math.sin(t)})}
  const yz=z=>z>=0?gy-(z/Rc)*(gy-fy):gy+(-z/Rc)*(H*1.25-gy);const kz=z=>z>=0?1-.38*z/Rc:1+.55*(-z/Rc);
  const P=(X,Z)=>({x:W/2+(X-camx)*s*kz(Z),y:yz(Z),k:kz(Z)});
  /* where the fence crosses the fighters' plane (the octagon is centrally symmetric, so ±xc) */
  let xc=R0;for(let i=0;i<8;i++){const a=V[i],b=V[(i+1)%8];if((a.Z>=0)!==(b.Z>=0)){const u=a.Z/(a.Z-b.Z);const x=a.X+(b.X-a.X)*u;if(x>0)xc=x}}
  return{V,P,Rc,xc}}
function drawOctFloor(S,ctx,W,H,s,gy,fy){S.cam.x+=(S.rot||0);/* drawMat runs with the rotation offset removed */const G=octGeom(S,W,H,s,gy,fy);S.cam.x-=(S.rot||0);S.R=G.xc;window.__cageWall=G.xc-.07;/* inner face of the fence at the fighters' plane *//* collision boundary = drawn fence */
  ctx.fillStyle='#c9c5bd';ctx.fillRect(0,fy-4,W,H-fy+4);/* apron outside the cage */
  const pts=G.V.map(v=>G.P(v.X,v.Z));ctx.fillStyle=BG.mat;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();
  /* canvas edge pad */ctx.strokeStyle=BG.matEdge;ctx.lineWidth=.05*s;ctx.stroke()}
function drawOctagon(S,ctx,W,H,s,gy,fy){const G=octGeom(S,W,H,s,gy,fy);const FH=1.75;
  /* far half only (z >= 0), clipped where an edge crosses the fighters' plane */
  const segs=[];for(let i=0;i<8;i++){let a=G.V[i],b=G.V[(i+1)%8];if(a.Z<0&&b.Z<0)continue;if(a.Z<0||b.Z<0){const u=a.Z/(a.Z-b.Z);const c={X:a.X+(b.X-a.X)*u,Z:0};if(a.Z<0)a=c;else b=c}segs.push([a,b])}
  /* draw back-to-front: farthest panels first */segs.sort((p,q)=>(q[0].Z+q[1].Z)-(p[0].Z+p[1].Z));
  for(const[a,b]of segs){const A=G.P(a.X,a.Z),B=G.P(b.X,b.Z);const At={x:A.x,y:A.y-FH*s*A.k},Bt={x:B.x,y:B.y-FH*s*B.k};
    ctx.fillStyle='rgba(28,29,33,.38)';ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.lineTo(Bt.x,Bt.y);ctx.lineTo(At.x,At.y);ctx.closePath();ctx.fill();
    /* chain-link mesh */ctx.strokeStyle='rgba(60,62,70,.5)';ctx.lineWidth=1;ctx.beginPath();const n=Math.max(4,Math.round(Math.hypot(B.x-A.x,B.y-A.y)/(.16*s*A.k)));
    for(let k=0;k<=n;k++){const u=k/n,u2=Math.min(1,(k+.5*n/ n*0+.5)/n);const x0=A.x+(B.x-A.x)*u,y0=A.y+(B.y-A.y)*u,x1=At.x+(Bt.x-At.x)*u,y1=At.y+(Bt.y-At.y)*u;ctx.moveTo(x0,y0);ctx.lineTo(x1,y1)}
    for(let k=1;k<10;k++){const v=k/10;ctx.moveTo(A.x+(At.x-A.x)*v,A.y+(At.y-A.y)*v);ctx.lineTo(B.x+(Bt.x-B.x)*v,B.y+(Bt.y-B.y)*v)}ctx.stroke();
    /* bottom pad and top rail along the panel */ctx.strokeStyle='#17181b';ctx.lineCap='round';ctx.lineWidth=.16*s*Math.min(A.k,B.k);ctx.beginPath();ctx.moveTo(A.x,A.y-.08*s*A.k);ctx.lineTo(B.x,B.y-.08*s*B.k);ctx.stroke();
    ctx.strokeStyle='#0e0f11';ctx.lineWidth=.07*s*Math.min(A.k,B.k);ctx.beginPath();ctx.moveTo(At.x,At.y);ctx.lineTo(Bt.x,Bt.y);ctx.stroke()}
  /* posts at the octagon corners (and the two end posts where the fence meets the fighters' plane) */
  const posts=G.V.filter(v=>v.Z>=0).concat([{X:G.xc,Z:0},{X:-G.xc,Z:0}]).sort((p,q)=>q.Z-p.Z);
  for(const v of posts){const P=G.P(v.X,v.Z);const w=.14*s*P.k,h=(FH+.08)*s*P.k;ctx.fillStyle='#0b0b0d';rr(ctx,P.x-w/2,P.y-h,w,h+.02*s,w/2);ctx.fillStyle='#1d1e22';rr(ctx,P.x-w*.15,P.y-h+.05*s*P.k,w*.3,h-.1*s*P.k,w*.15)}}
})();
