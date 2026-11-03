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
const FS=window.FLAT_STYLE=(typeof tuneSection==='function'?tuneSection('flat',{on:true,shadowK:-.12,farK:-.13,lightK:.06}):{on:true,shadowK:-.12,farK:-.13,lightK:.06});
/* the flat look has its own light: switch off the gradient / rim light layers painted on top of fighters */
if(typeof GFX!=='undefined'){GFX.shade=0;GFX.rim=0;GFX.sweat=Math.min(GFX.sweat,.35)}
if(typeof GPU!=='undefined')GPU.rim=.12;
if(typeof MR!=='undefined')MR.limbShade=0;

/* ---------- helpers (world units, y up) ---------- */
const poly=(ctx,P,col)=>{if(!P.length)return;ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(P[0].x,P[0].y);for(let i=1;i<P.length;i++)ctx.lineTo(P[i].x,P[i].y);ctx.closePath();ctx.fill()};
const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const ngon=(ctx,c,r,col,n)=>{n=n||8;ctx.fillStyle=col;ctx.beginPath();for(let i=0;i<n;i++){const a=(i+.5)/n*Math.PI*2;const x=c.x+Math.cos(a)*r,y=c.y+Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.fill()};
/* frame of a segment a→b: u along, n = the "front" side (toward the facing direction, or up when the
   segment is level with the facing direction) */
function frame(a,b,d){const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1e-5;const ux=dx/L,uy=dy/L;let nx=-uy,ny=ux;const f=nx*d+ny*.35;if(f<0){nx=-nx;ny=-ny}return{ux,uy,nx,ny,L}}
/* angular limb: profile rows [t, frontHalfWidth, backHalfWidth] → one flat polygon + a back/underside shadow plane */
function limb(ctx,a,b,d,rows,col,shCol,extra){const F=frame(a,b,d);const P=(t,w)=>({x:a.x+F.ux*F.L*t+F.nx*w,y:a.y+F.uy*F.L*t+F.ny*w});
  const front=rows.map(r=>P(r[0],r[1])),back=rows.map(r=>P(r[0],-r[2]));poly(ctx,front.concat(back.slice().reverse()),col);
  if(shCol){const mid=rows.map(r=>P(r[0],-r[2]*(extra&&extra.shadowFrom!=null?extra.shadowFrom:.12)));poly(ctx,mid.concat(back.slice().reverse()),shCol)}
  return{F,P}}

/* ---------- body ---------- */
const BD=Body.prototype.draw;
Body.prototype.draw=function(ctx,o){o=o||{};const lk=this.look;if(!FS.on||lk.ref)return BD.call(this,ctx,o);
  const J=this.J,H=this.H,W=this.W,d=this.d;if(!J.hd)return;
  const M=H*W*.94;/* muscle scale */
  const skin=lk.skin||'#d39b74';const sk={base:skin,sh:shade(skin,FS.shadowK),far:shade(skin,FS.farK),farSh:shade(skin,FS.farK+FS.shadowK),lt:shade(skin,FS.lightK)};
  const shorts=lk.shorts||'#111';const glove=lk.glove||'#141414';const strap=o.corner||'#c21818';
  const nearLead=(d>0)===(this.stance>0);const lead={S:'lS',E:'lE',W:'lW',G:'lG',H:'lH',K:'lK',A:'lA',He:'lHe',T:'lT',o:'lo'},rear={S:'rS',E:'rE',W:'rW',G:'rG',H:'rH',K:'rK',A:'rA',He:'rHe',T:'rT',o:'ro'};
  const nearS=nearLead?lead:rear,farS=nearLead?rear:lead;
  const self=this;
  /* ---- arm: deltoid, biceps/triceps, elbow, forearm, wrist, glove ---- */
  const arm=(S,isFar)=>{const a=J[S.S],e=J[S.E],w=J[S.W];const C=isFar?{b:sk.far,s:sk.farSh}:{b:sk.base,s:sk.sh};
    /* upper arm: deltoid cap → biceps (front) / triceps (back) → elbow */
    limb(ctx,a,e,d,[[-.1,.05*M,.055*M],[.12,.062*M,.064*M],[.3,.052*M,.058*M],[.5,.05*M,.05*M],[.78,.04*M,.04*M],[1,.031*M,.033*M]],C.b,C.s);
    /* deltoid plate: a lighter facet over the shoulder */
    {const{P}=limb(ctx,a,e,d,[[-.12,.046*M,.04*M],[.08,.058*M,.05*M],[.3,.034*M,.02*M]],isFar?C.b:sk.lt,null);}
    /* forearm: flexor bulge near the elbow, narrow wrist */
    limb(ctx,e,w,d,[[-.06,.032*M,.032*M],[.2,.038*M,.036*M],[.45,.033*M,.031*M],[.8,.025*M,.024*M],[1,.022*M,.022*M]],C.b,C.s);
    ngon(ctx,e,.031*M,C.b,7);/* elbow joint */
    /* elbow point (olecranon) facet */{const F=frame(e,w,d);ngon(ctx,{x:e.x-F.nx*.018*M,y:e.y-F.ny*.018*M},.016*M,C.s,5)}
    drawGloveFlat(ctx,e,w,J[S.G],H,isFar?shade(glove,-.2):glove,strap,self.ang[S.o],self.gloveBlood,d,C.b)};
  /* ---- leg: quad/hamstring, knee cap, calf, ankle, foot with toes ---- */
  const leg=(S,isFar,sleeveCol)=>{const h=J[S.H],k=J[S.K],a=J[S.A],he=J[S.He],to=J[S.T];const C=isFar?{b:sk.far,s:sk.farSh}:{b:sk.base,s:sk.sh};
    limb(ctx,h,k,d,[[-.06,.07*M,.07*M],[.18,.074*M,.07*M],[.45,.066*M,.062*M],[.75,.052*M,.05*M],[1,.042*M,.043*M]],C.b,C.s);
    /* shin / calf: calf bulge on the back, straight shin bone on the front */
    limb(ctx,k,a,d,[[-.04,.04*M,.042*M],[.22,.036*M,.054*M],[.42,.033*M,.05*M],[.7,.026*M,.032*M],[.92,.022*M,.023*M],[1.02,.022*M,.024*M]],C.b,C.s,{shadowFrom:.0});
    /* knee: joint block + a single knee-cap facet */{const F=frame(h,k,d);ngon(ctx,k,.04*M,C.b,7);poly(ctx,[{x:k.x+F.nx*.042*M-F.ux*.03*M,y:k.y+F.ny*.042*M-F.uy*.03*M},{x:k.x+F.nx*.046*M+F.ux*.02*M,y:k.y+F.ny*.046*M+F.uy*.02*M},{x:k.x+F.nx*.02*M+F.ux*.04*M,y:k.y+F.ny*.02*M+F.uy*.04*M},{x:k.x+F.nx*.012*M,y:k.y+F.ny*.012*M}],C.s)}
    footFlat(ctx,a,he,to,M,C,d);
    if(sleeveCol)shortsLeg(ctx,h,k,d,M,sleeveCol,lk,isFar)};
  /* far side first */
  arm(farS,true);leg(farS,true,shade(shorts,-.22));
  torsoFlat(ctx,J,H,M,sk,d,lk,this);
  leg(nearS,false,shorts);shortsWaist(ctx,J,H,M,shorts,d,lk,this.ang.ta);
  headFlat(ctx,J.hd,J.nk,H,this,skin,d,this.ang.hd);
  arm(nearS,false);
  if(o.highlight){ctx.save();ctx.globalAlpha=o.highlight;ctx.globalCompositeOperation='lighter';ngon(ctx,J.hd,.1*H,'#fff',12);ctx.restore()}};

/* ---------- foot: ankle bones, heel, arch, ball, toes ---------- */
function footFlat(ctx,A,He,T,M,C,d){const ux0=T.x-He.x,uy0=T.y-He.y,Lf=Math.hypot(ux0,uy0)||1e-5;const ux=ux0/Lf,uy=uy0/Lf;let nx=-uy,ny=ux;if((A.x-He.x)*nx+(A.y-He.y)*ny<0){nx=-nx;ny=-ny}
  const Q=(u,v)=>({x:He.x+ux*u*Lf+nx*v*Lf,y:He.y+uy*u*Lf+ny*v*Lf});
  /* toes: break at the ball; when the ball is on the canvas the toes lie flat on it */
  const ball=Q(.72,.02);let tx=ux,ty=uy;if(ball.y<.05&&ty<-.05){tx=Math.sign(ux)||d;ty=0}
  const tl=.3*Lf;const toeTip={x:ball.x+tx*tl,y:ball.y+ty*tl};let tnx=-ty,tny=tx;if(tnx*nx+tny*ny<0){tnx=-tnx;tny=-tny}
  const sole=[Q(-.06,.16),Q(-.05,.03),Q(.04,-.01),Q(.4,.0),Q(.72,-.005)];
  poly(ctx,[Q(.1,.42),Q(-.02,.3)].concat(sole,[{x:ball.x+tnx*.0,y:ball.y},{x:ball.x+tnx*.11*Lf,y:ball.y+tny*.11*Lf},Q(.52,.22),Q(.3,.32)]),C.b);
  poly(ctx,[{x:ball.x-tnx*.005*Lf,y:ball.y-tny*.005*Lf},{x:toeTip.x,y:toeTip.y},{x:toeTip.x+tnx*.06*Lf-tx*.02*Lf,y:toeTip.y+tny*.06*Lf-ty*.02*Lf},{x:ball.x+tnx*.1*Lf,y:ball.y+tny*.1*Lf}],C.b);
  /* planes: sole edge + inner arch shadow, Achilles / heel facet, ankle bone */
  poly(ctx,[Q(-.05,.03),Q(.04,-.01),Q(.72,-.005),Q(.62,.07),Q(.2,.08)],C.s);
  poly(ctx,[Q(-.06,.16),Q(-.02,.3),Q(.1,.42),Q(.08,.22)],C.s);
  ngon(ctx,Q(.16,.34),.016*M,C.s,5)}

/* ---------- torso: lats, pecs, abs, obliques ---------- */
function torsoFlat(ctx,J,H,M,sk,d,lk,B){const sp=[J.hip,J.mid,J.sh,J.nk];const segL=[0];for(let i=1;i<4;i++)segL.push(segL[i-1]+Math.hypot(sp[i].x-sp[i-1].x,sp[i].y-sp[i-1].y));const TL=segL[3]||1;
  const at=s=>{const L=s*TL;let i=1;while(i<3&&segL[i]<L)i++;const a=sp[i-1],b=sp[i],k=(L-segL[i-1])/((segL[i]-segL[i-1])||1);const tx=b.x-a.x,ty=b.y-a.y,l=Math.hypot(tx,ty)||1;return{x:a.x+tx*k,y:a.y+ty*k,nx:ty/l*d,ny:-tx/l*d}};
  const pt=(s,w)=>{const c=at(s);return{x:c.x+c.nx*w*M/.94/1,y:c.y+c.ny*w*M/.94}};
  const bel=lk.belly?.024:0;
  const FR=[[0,.074],[.16,.073+bel*.6],[.32,.071+bel],[.48,.07+bel*.7],[.6,.08],[.7,.096],[.79,.099],[.87,.088],[.94,.062],[1,.036]];
  const BK=[[0,.09],[.1,.086],[.24,.066],[.38,.061],[.52,.071],[.66,.085],[.78,.093],[.88,.087],[.95,.066],[1,.045]];
  const F=FR.map(([s,w])=>pt(s,w)),Bk=BK.map(([s,w])=>pt(s,-w));
  poly(ctx,F.concat(Bk.slice().reverse()),sk.base);
  /* lats / spine side: shadow plane on the back */
  poly(ctx,BK.map(([s,w])=>pt(s,-w*.32)).concat(Bk.slice().reverse()),sk.sh);
  /* trapezius slope + clavicle line */poly(ctx,[pt(.9,-.08),pt(1,-.045),pt(1,.0),pt(.93,-.02)],sk.sh);
  /* pec plate: lighter facet, then the hard under-pec shadow */
  poly(ctx,[pt(.93,.06),pt(.87,.088),pt(.79,.099),pt(.7,.096),pt(.69,.03),pt(.8,.0),pt(.9,.02)],sk.lt);
  poly(ctx,[pt(.7,.098),pt(.67,.08),pt(.66,.015),pt(.69,.0),pt(.71,.03)],sk.sh);

  /* abs: flat blocks along the front edge */
  if(!lk.belly){poly(ctx,[pt(.6,.08),pt(.22,.072),pt(.22,.05),pt(.6,.055)],sk.lt)}
  /* tattoos (flat ink shapes) */
  if(lk.tat&&/c/.test(lk.tat)){ctx.globalAlpha=.55;poly(ctx,[pt(.86,.06),pt(.8,.09),pt(.72,.07),pt(.74,.03),pt(.82,.02)],'#1c2230');ctx.globalAlpha=1}
  if(lk.tat&&/b/.test(lk.tat)){ctx.globalAlpha=.5;poly(ctx,[pt(.85,-.08),pt(.7,-.09),pt(.6,-.06),pt(.72,-.03),pt(.84,-.04)],'#1c2230');ctx.globalAlpha=1}
  /* blood streaming down the chest */
  if(B.blood>.9&&J.mid){const al=Math.min(.7,(B.blood-.9)*.6);for(let i=0;i<3;i++){const L=Math.min(1,(B.blood-.9)*.7*(1-i*.3));if(L<=0)continue;const a={x:J.nk.x+d*(.035+i*.018)*H,y:J.nk.y-.02*H},b={x:J.mid.x+d*(.05+i*.02)*H,y:J.mid.y};const e=lerp(a,b,L);const w=(.006-i*.0014)*H;
    ctx.globalAlpha=al*(1-i*.2);poly(ctx,[{x:a.x-w,y:a.y},{x:a.x+w,y:a.y},{x:e.x+w*.6,y:e.y},{x:e.x,y:e.y-w*1.4},{x:e.x-w*.6,y:e.y}],`rgb(${128-i*15},6,8)`);ctx.globalAlpha=1}}}

/* ---------- shorts: waistband + one leg sleeve per thigh, side slit, panels, accent stripes ---------- */
function accentOf(col){const[r,g,b]=rgbOf(col);const l=(r*299+g*587+b*114)/1000;return l<70?'#c9a24a':l>190?'#2a2a2a':shade(col,.45)}
function shortsLeg(ctx,h,k,d,M,col,lk,isFar){const F=frame(h,k,d);const P=(t,w)=>({x:h.x+F.ux*F.L*t+F.nx*w,y:h.y+F.uy*F.L*t+F.ny*w});
  /* hem angled: longer at the back, short side slit at the front */
  const P0=[P(-.15,.084*M),P(.46,.08*M),P(.52,.077*M),P(.48,.045*M),P(.57,-.02*M),P(.6,-.08*M),P(-.15,-.084*M)];poly(ctx,P0,col);
  poly(ctx,[P(-.15,-.084*M),P(.6,-.08*M),P(.57,-.03*M),P(-.08,-.03*M)],shade(col,-.18));
  poly(ctx,[P(.12,.082*M),P(.38,.08*M),P(.34,.025*M),P(.2,.05*M)],shade(col,-.1));
  if(!isFar){const ac=accentOf(lk.shorts||'#111');poly(ctx,[P(.06,.078*M),P(.1,.078*M),P(.3,.0),P(.26,0)],ac);poly(ctx,[P(.38,.06*M),P(.44,.057*M),P(.44,.046*M),P(.38,.049*M)],ac)}}
function shortsWaist(ctx,J,H,M,col,d,lk,ta){const hip=J.hip,mid=J.mid;const n={x:d*Math.cos(ta),y:-Math.sin(ta)};const Pp=(c,f)=>({x:c.x+n.x*f,y:c.y+n.y*f});const hw=.082*M/.94;
  const top=lerp(hip,mid,.38),bot=lerp(hip,mid,-.3);
  poly(ctx,[Pp(top,hw*1.02),Pp(top,-hw*1.05),Pp(hip,-hw*1.12),Pp(bot,-hw*.92),Pp(bot,hw*.86),Pp(hip,hw*1.06)],col);
  poly(ctx,[Pp(top,-hw*1.05),Pp(top,-hw*.55),Pp(bot,-hw*.5),Pp(bot,-hw*.92),Pp(hip,-hw*1.12)],shade(col,-.18));
  /* waistband */const t2=lerp(hip,mid,.31);poly(ctx,[Pp(top,hw*1.02),Pp(top,-hw*1.05),Pp(t2,-hw*1.07),Pp(t2,hw*1.04)],shade(col,-.3));
  /* small brand-free patch */const ac=accentOf(lk.shorts||'#111');const c=lerp(hip,mid,.2);poly(ctx,[Pp(c,hw*.62),Pp(c,hw*.3),{x:Pp(c,hw*.3).x,y:Pp(c,hw*.3).y-.012*H},{x:Pp(c,hw*.62).x,y:Pp(c,hw*.62).y-.012*H}],ac)}

/* ---------- glove: wrist cuff, padded knuckle block, folded fingers, thumb, white back-of-hand patch ---------- */
function drawGloveFlat(ctx,E,Wr,G,H,col,strap,open,blood,d,skinC){const a=Math.atan2(G.y-Wr.y,G.x-Wr.x);ctx.save();ctx.translate(Wr.x,Wr.y);ctx.rotate(a);
  /* local frame: +x toward the knuckles; flip so the thumb sits on the top / facing side */
  const flip=(Math.cos(a)*d>=0)?1:-1;ctx.scale(1,flip);const r=.036*H;const P=(pts,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(pts[0][0]*r,pts[0][1]*r);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0]*r,pts[i][1]*r);ctx.closePath();ctx.fill()};
  P([[-.95,-.62],[-.95,.62],[.15,.7],[.15,-.7]],col);/* cuff */
  P([[-.92,.62],[-.92,.36],[.12,.42],[.12,.68]],strap);/* cuff strap in corner colour */
  P([[.05,-.92],[.05,.9],[1.05,1.0],[1.55,.78],[1.72,.25],[1.68,-.55],[1.35,-.95]],col);/* knuckle block */
  /* open-finger MMA glove: the curled fingers show skin below the padding */
  const sc=skinC||'#d39b74';P([[1.3,-.98],[1.66,-.62],[1.74,.2],[1.58,.74],[1.42,.66],[1.44,-.55]],sc);
  for(const y of[-.42,-.02,.38])P([[1.44,y-.025],[1.74,y-.025],[1.74,y+.02],[1.44,y+.02]],shade(sc,-.28));/* finger splits */
  P([[1.3,-.98],[1.44,-.55],[1.42,.66],[1.3,.8],[1.25,-.9]],col);/* padding edge over the knuckles */
  P([[.35,.85],[.95,1.15],[1.25,1.0],[1.0,.82]],col);P([[1.0,1.0],[1.3,1.08],[1.32,.9],[1.1,.84]],sc);/* thumb: padded base, bare tip */
  P([[.45,-.35],[1.05,-.4],[1.05,.3],[.45,.35]],'#f2f2f2');P([[.58,-.05],[.92,-.22],[.92,-.1],[.58,.07]],col);/* white patch with a simple mark */
  if(open>.5){for(let i=0;i<3;i++)P([[1.6,(i-1)*.5-.15],[2.2,(i-1)*.5-.1],[2.2,(i-1)*.5+.12],[1.6,(i-1)*.5+.15]],col)}
  if(blood>0){ctx.globalAlpha=Math.min(.85,blood);P([[.9,-.3],[1.6,-.1],[1.5,.5],[.9,.4]],'#7a0606');ctx.globalAlpha=1}
  ctx.restore()}

/* ---------- head: angular cranium, face planes, block hair and beard ---------- */
function headFlat(ctx,hd,nk,H,B,skin,d,ang){const lk=B.look,r=.066*H;ctx.save();ctx.translate(hd.x,hd.y);ctx.scale(d,1);ctx.rotate(-ang*.9);
  const F=(typeof faceOf==='function')?faceOf(B):{n:.5,br:.5,jw:.5,ch:.5,lp:.5,nf:0,nh:0};
  const red=B.redness||0;const sk=red>0&&typeof mixHex==='function'?mixHex(skin,'#b8433a',Math.min(.4,red*.45)):skin;const sh=shade(sk,FS.shadowK),lt=shade(sk,FS.lightK),dk=shade(sk,-.3);
  const P=(pts,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(pts[0][0]*r,pts[0][1]*r);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0]*r,pts[i][1]*r);ctx.closePath();ctx.fill()};
  /* neck: nape, throat, sternocleidomastoid */
  P([[-.66,-.3],[-.88,-1.0],[-1.0,-1.6],[.5,-1.62],[.42,-1.05],[.3,-.8],[.05,-.6]],shade(skin,-.06));
  P([[.05,-.6],[.3,-.8],[.42,-1.05],[.5,-1.62],[.28,-1.62],[.18,-.9]],shade(skin,-.16));
  P([[-.3,-.62],[-.05,-.68],[.32,-1.5],[.18,-1.52]],shade(skin,-.12));
  /* cranium + face profile (straight facets) */
  const nl=F.n||.5,jw=F.jw||.5,ch=F.ch||.5,br=F.br||.5,nf=F.nf||0,lp=F.lp||.5;const tip=[1.12+nl*.1-nf*.06,-.13-nl*.03];
  const prof=[[-.62,-.5],[-1.0,-.18],[-1.02,.42],[-.78,.9],[-.3,1.12],[.32,1.12],[.72,.9],[.88,.55],[.93+br*.05,.33],[.86,.2],[.9,.08],tip,[tip[0]-.12,-.25],[.96,-.28],[1.0+lp*.05,-.35],[.94,-.43],[.99+lp*.05,-.5],[.92,-.58],[.97+ch*.07,-.72],[.9+ch*.05,-.88],[.6,-.98-jw*.04],[.25,-.92-jw*.05],[-.12-jw*.12,-.8],[-.34-jw*.08,-.6]];
  P(prof,sk);
  /* face planes: cheek / temple shadow, jaw underside, lit cheekbone + brow */
  P([[.25,-.05],[.62,-.2],[.68,-.55],[.45,-.82],[.08,-.62]],sh);
  P([[-.34,-.6],[-.12,-.8],[.25,-.92],[.6,-.98],[.9,-.88],[.7,-.82],[.2,-.78],[-.15,-.6]],shade(sk,-.2));
  P([[.32,.05],[.72,.02],[.66,-.12],[.38,-.08]],lt);
  P([[.55,.42],[.9,.4],[.88,.3],[.55,.3]],lt);
  /* ear: outer rim, inner shadow, lobe */
  P([[-.42,.22],[-.12,.26],[-.04,.0],[-.12,-.3],[-.34,-.3],[-.46,-.05]],shade(sk,-.08));P([[-.33,.12],[-.14,.14],[-.12,-.12],[-.3,-.16]],dk);if(lk.cauli)P([[-.44,.1],[-.1,.2],[-.06,-.1],[-.4,-.12]],shade(sk,-.15));
  /* eye: sclera, iris, upper lid line; swelling; KO / daze */
  {const sw=B.swell||0;const ex=.74,ey=.14;if(sw>.15){ctx.globalAlpha=Math.min(.75,sw*.6);P([[ex-.22,ey+.14],[ex+.2,ey+.14],[ex+.24,ey-.12],[ex-.2,ey-.14]],typeof mixHex==='function'?mixHex(skin,'#6a2a4a',.55):'#7a3a50');ctx.globalAlpha=1}
    const lid=B.ko?1:Math.max(B.daze||0,sw>.7?.55:0);
    if(lid<1){const h=.075*(1-lid*.8)*(sw>.5?.6:1);P([[ex-.13,ey],[ex-.02,ey+h],[ex+.14,ey+h*.4],[ex+.15,ey-.01],[ex+.02,ey-h*.8]],'#efe9df');P([[ex+.02,ey+h*.8],[ex+.12,ey+h*.6],[ex+.12,ey-h*.7],[ex+.02,ey-h*.7]],'#2a1a10');P([[ex-.14,ey+.005],[ex-.02,ey+h+.025],[ex+.16,ey+h*.45],[ex+.15,ey+h*.3],[ex-.02,ey+h],[ex-.12,ey-.01]],dk)}
    else P([[ex-.13,ey+.01],[ex+.15,ey+.005],[ex+.15,ey-.03],[ex-.13,ey-.02]],dk);
    /* eyebrow */const bc=lk.hs==='bald'||!lk.hair?'#2a1f17':lk.hair;const bt=.04+(F.eb||.5)*.05;P([[ex-.18,ey+.16],[ex+.2,ey+.2+bt*.4],[ex+.2,ey+.2-bt*.5],[ex-.18,ey+.16-bt*.6]],bc)}
  /* nose wing + nostril, mouth line, lips */
  P([[tip[0]-.22,-.1],[tip[0]-.06,-.16],[tip[0]-.1,-.26],[tip[0]-.26,-.24]],shade(sk,-.1));P([[tip[0]-.14,-.22],[tip[0]-.04,-.23],[tip[0]-.06,-.26],[tip[0]-.14,-.26]],shade(sk,-.5));
  {const lc=typeof mixHex==='function'?mixHex(sk,'#8a3b34',.3):sk;P([[.96,-.29],[1.0+lp*.05,-.35],[.95,-.43],[.84,-.42]],lc);P([[.95,-.44],[.99+lp*.05,-.5],[.92,-.56],[.84,-.46]],shade(lc,.06));
    if(B.ko)P([[.84,-.41],[.97,-.41],[.95,-.5],[.86,-.5]],'#2a0d0d');else P([[.97,-.425],[.8,-.415],[.8,-.44],[.95,-.445]],shade(sk,-.5))}
  /* hair + beard */
  const hc=lk.hair||'#16100b';hairFlat(ctx,r,lk,B,hc,P);beardFlat(lk,hc,P);
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
const BG={wall:'#ece9e3',wallLow:'#e2ded6',fence:'#cfcac1',post:'#b9b3a8',rail:'#b1ab9f',mat:'#dedad3',matEdge:'#d2cdc4',ring:'#c9473f'};
if(typeof Stage!=='undefined'){
  Stage.prototype.drawBack0=function(){const G=this.gpu;const near=this.ctx,dpr=this.dpr,W=this.W,H=this.Hh,s=this.sc();
    if(G){G.farX.setTransform(1,0,0,1,0,0);G.farX.fillStyle=BG.wall;G.farX.fillRect(0,0,G.far.width,G.far.height)}
    near.setTransform(dpr,0,0,dpr,0,0);const ctx=near;const gy=H*this.cam.gy;const dp=.62;const fy=gy-.95*s;this.fy=fy;
    ctx.fillStyle=BG.wall;ctx.fillRect(0,0,W,fy);ctx.fillStyle=BG.wallLow;ctx.fillRect(0,fy-.9*s*dp,W,.9*s*dp);
    const ring=this.venue.startsWith('ring');const top=fy-1.75*s*dp;
    if(ring){const R=this.R,x0=this.px(-R,dp),x1=this.px(R,dp);for(const x of[x0,x1]){ctx.fillStyle=BG.post;ctx.fillRect(x-.06*s*dp,fy-1.45*s*dp,.12*s*dp,1.45*s*dp)}
      for(let i=0;i<4;i++){const y=fy-(.42+i*.32)*s*dp;ctx.fillStyle=i%2?this.col:BG.rail;ctx.fillRect(x0,y-.02*s*dp,x1-x0,.04*s*dp)}}
    else{/* fence: flat panel, thin mesh lines, flat posts, top rail, bottom pad */
      ctx.fillStyle=BG.fence;ctx.globalAlpha=.35;ctx.fillRect(0,top,W,fy-top);ctx.globalAlpha=1;
      ctx.strokeStyle=BG.post;ctx.globalAlpha=.25;ctx.lineWidth=1;const step=.18*s*dp,off=-(this.cam.x*s*dp)%step;ctx.beginPath();for(let x=off-step;x<W+step;x+=step){ctx.moveTo(x,top);ctx.lineTo(x+(fy-top)*.5,fy);ctx.moveTo(x+(fy-top)*.5,top);ctx.lineTo(x,fy)}ctx.stroke();ctx.globalAlpha=1;
      ctx.fillStyle=BG.rail;ctx.fillRect(0,top-.05*s*dp,W,.07*s*dp);ctx.fillStyle=BG.post;ctx.fillRect(0,fy-.28*s*dp,W,.28*s*dp);
      const po=Math.floor(this.rot/2.3);for(let i=-5+po;i<=5+po;i++){const x=this.px(i*2.3,dp);ctx.fillStyle=BG.post;ctx.fillRect(x-.07*s*dp,top-.06*s*dp,.14*s*dp,fy-top+.06*s*dp);ctx.fillStyle=BG.rail;ctx.fillRect(x+.02*s*dp,top-.06*s*dp,.05*s*dp,fy-top+.06*s*dp)}}
    {const C=this.cam,cx=C.x;C.x-=this.rot;this.drawMat(fy,gy,s);C.x=cx}};
  Stage.prototype.drawMat=function(fy,gy,s){const ctx=this.ctx,W=this.W,H=this.Hh;ctx.fillStyle=BG.mat;ctx.fillRect(0,fy,W,H-fy);ctx.fillStyle=BG.matEdge;ctx.fillRect(0,fy,W,.06*s);
    if(!this.venue.startsWith('ring')){const k=.86;const cx=(0-this.cam.x*k)*s*k+W/2,cy=fy+(H-fy)*.45;ctx.strokeStyle=this.col||BG.ring;ctx.globalAlpha=.55;ctx.lineWidth=.035*s;ctx.beginPath();ctx.ellipse(cx,cy,2.2*s*k*this.R/4.3,.55*s,0,0,7);ctx.stroke();ctx.globalAlpha=1}
    for(const d of this.decals){d.age=(d.age||0)+1/60;const k=.72+.28*d.z;const sy=fy+(H-fy)*d.z*.95;const x=(d.x-this.cam.x*k)*s*k+W/2;const dk=Math.min(1,d.age/25);const rr=Math.round((130+d.c*30)*(1-dk*.4));
      ctx.fillStyle=`rgba(${rr},10,10,${d.a})`;ctx.beginPath();ctx.ellipse(x,sy,d.r*s*k*(d.str||1),d.r*s*.3,0,0,7);if(d.sat)for(const q of d.sat){ctx.moveTo(x+q[0]*s*k+q[2]*s*k,sy+q[1]*s*.3);ctx.ellipse(x+q[0]*s*k,sy+q[1]*s*.3,q[2]*s*k,q[2]*s*.3,0,0,7)}ctx.fill()}}}
})();
