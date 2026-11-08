/* ===== Frame.js : plain white anatomical mannequin =====
   Every fighter is a bare white figure built on the same physics skeleton: no skin, hair, tattoos or clothes.
   The part library (head with a face profile, neck, ribcage, pelvis, shoulder / arm / hand, thigh / knee / calf / foot)
   is shared; each fighter's PHYSICAL traits change it: height and reach (skeleton), mass (bw), build (broad / soft / belly),
   limb girth, neck, chest and hand / foot size, and a unique face (nose, brow, jaw, chin, lips, ears) generated from the
   name. Smooth outlines (splines), light-grey planes for shadow, thin grey lines for muscle and bone detail.
   The referee keeps his own outfit.  Toggle: FRAME.on */
(function(){
if(typeof Body==='undefined')return;
const FR=window.FRAME={on:true};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
let FILL='#f6f6f7',FARF='#d9d9dd',PLANE='rgba(120,122,132,.16)',PLANE2='rgba(120,122,132,.28)',LINE='#7a7a80',DET='rgba(90,92,100,.55)',HILITE='rgba(255,255,255,.7)',GHOST='rgba(120,124,140,';
const PAL_FIGHTER=['#f6f6f7','#d9d9dd','rgba(120,122,132,.16)','rgba(120,122,132,.28)','#7a7a80','rgba(90,92,100,.55)','rgba(255,255,255,.7)','rgba(120,124,140,'];
/* the referee: same figure, dark kit */
const PAL_REF=['#3b3c44','#2a2b31','rgba(0,0,0,.26)','rgba(0,0,0,.38)','#15161a','rgba(210,212,226,.3)','rgba(255,255,255,.1)','rgba(20,20,26,'];
function setPal(a){[FILL,FARF,PLANE,PLANE2,LINE,DET,HILITE,GHOST]=a}
function rng(seed){let h=2166136261;const s=String(seed);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}let a=h>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
/* smooth closed outline through points */
function spl(c,pts){const n=pts.length;c.moveTo(pts[0].x,pts[0].y);for(let i=0;i<n;i++){const p0=pts[(i-1+n)%n],p1=pts[i],p2=pts[(i+1)%n],p3=pts[(i+2)%n];c.bezierCurveTo(p1.x+(p2.x-p0.x)/6,p1.y+(p2.y-p0.y)/6,p2.x-(p3.x-p1.x)/6,p2.y-(p3.y-p1.y)/6,p2.x,p2.y)}c.closePath()}
function splOpen(c,pts){const n=pts.length;c.moveTo(pts[0].x,pts[0].y);for(let i=0;i<n-1;i++){const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(n-1,i+2)];c.bezierCurveTo(p1.x+(p2.x-p0.x)/6,p1.y+(p2.y-p0.y)/6,p2.x-(p3.x-p1.x)/6,p2.y-(p3.y-p1.y)/6,p2.x,p2.y)}}
function body(ctx,pts,fill,lw){ctx.beginPath();spl(ctx,pts);ctx.lineJoin='round';ctx.lineWidth=lw*2;ctx.strokeStyle=LINE;ctx.stroke();ctx.fillStyle=fill;ctx.fill()}
const P2=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const DETAIL=false;/* muscle / bone lines and planes are off: the skin layer goes on top of the plain silhouette */
function line(ctx,pts,w,col,al){if(!DETAIL)return;ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=col||DET;ctx.lineWidth=w;if(al!=null)ctx.globalAlpha=al;ctx.beginPath();splOpen(ctx,pts);ctx.stroke();ctx.restore()}
function plane(ctx,pts,col){if(!DETAIL)return;ctx.fillStyle=col;ctx.beginPath();spl(ctx,pts);ctx.fill()}
/* frame of a segment: n points to the front (facing side, or up when level) */
function frame(a,b,d){const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1e-5,ux=dx/L,uy=dy/L;let nx=-uy,ny=ux;if(nx*d+ny*.35<0){nx=-nx;ny=-ny}return{ux,uy,nx,ny,L}}

/* per-fighter physical profile (stable, from the name + build) */
function traits(B){if(B._tr)return B._tr;const lk=B.look,R=rng((lk.name||'x')+'~fr'),r=(a,b)=>a+(b-a)*R();const heavy=clamp(((B.W||1)-.9)/.35,0,1);
  const belly=lk.belly||lk.body==='belly'?1:lk.body==='soft'?.45:0,broad=lk.body==='broad'?1:0;
  return B._tr={arm:r(.95,1.07)+heavy*.06,fore:r(.95,1.08),leg:r(.96,1.06)+heavy*.04,calf:r(.93,1.12),neck:r(.92,1.08)+heavy*.2+broad*.08,chest:r(.98,1.05)+broad*.1,hand:r(.95,1.08),foot:r(.96,1.07),belly,broad,
    def:clamp(1-heavy*.5-belly*.6+r(-.2,.2),0,1),skull:r(.97,1.04),jaw:r(.3,.8)}}

/* ---- parts: every limb is ONE smooth outline; the outlines of a group are stroked first, then filled, so the seams between
   segments vanish and only the silhouette keeps its line (like the anatomy plates) ---- */
function outline(a,b,d,rows,M,cap){const F=frame(a,b,d);const Q=(t,w)=>({x:a.x+F.ux*F.L*t+F.nx*w*M,y:a.y+F.uy*F.L*t+F.ny*w*M});
  const r0=rows[0],r1=rows[rows.length-1],c0=cap===1?0:.05,c1=cap===2?0:.05;const pts=[];if(c0)pts.push(Q(r0[0]-c0,(r0[1]-r0[2])/2));for(const r of rows)pts.push(Q(r[0],r[1]));if(c1)pts.push(Q(r1[0]+c1,(r1[1]-r1[2])/2));for(let i=rows.length-1;i>=0;i--)pts.push(Q(rows[i][0],-rows[i][2]));
  return{pts,F,Q}}
function group(ctx,parts,fill,lw){ctx.lineJoin='round';ctx.lineWidth=lw*2.2;ctx.strokeStyle=LINE;for(const p of parts){ctx.beginPath();spl(ctx,p);ctx.stroke()}ctx.fillStyle=fill;for(const p of parts){ctx.beginPath();spl(ctx,p);ctx.fill()}}
function shade(ctx,o,rows,M){/* soft shadow along the back / underside of a limb */const Q=o.Q;plane(ctx,rows.map(r=>Q(r[0],-r[2]*.25)).concat(rows.slice().reverse().map(r=>Q(r[0],-r[2]*.96))),PLANE)}
const L=(ctx,pts,w,al)=>line(ctx,pts,w,DET,al);

function armDraw(ctx,B,S,J,d,M,T,far,zs,lw){const f=far?FARF:FILL,a=J[S.S],e=J[S.E],w=J[S.W],g=J[S.G],Mu=M*T.arm,Mf=M*T.fore,zS=zs(S.S),zE=zs(S.E),zW=zs(S.W);
  const ru=[[-.14,.058*zS,.064*zS],[.06,.068*zS,.07*zS],[.26,.06,.062],[.46,.05,.05],[.7,.042*zE,.04*zE],[.9,.036*zE,.036*zE],[1,.034*zE,.036*zE]];
  const rf=[[-.04,.04*zE,.04*zE],[.14,.045*zE,.042*zE],[.36,.038,.035],[.66,.029*zW,.027*zW],[.9,.024*zW,.024*zW],[1,.023*zW,.023*zW]];
  const U=outline(a,e,d,ru,Mu,0),Fo=outline(e,w,d,rf,Mf,2);
  group(ctx,[U.pts,Fo.pts],f,lw);shade(ctx,U,ru,Mu);shade(ctx,Fo,rf,Mf);
  /* deltoid cap, biceps / triceps, forearm flexors */
  const Q=U.Q;L(ctx,[Q(-.05,.06),Q(.14,.05),Q(.3,.022)],lw*.9,.7);L(ctx,[Q(.1,-.05),Q(.3,-.02),Q(.5,-.016)],lw*.8,.5);plane(ctx,[Q(.22,.052),Q(.4,.054),Q(.56,.04),Q(.3,.0)],HILITE);L(ctx,[Q(.48,.03),Q(.72,.026),Q(.9,.02)],lw*.7,.4);
  L(ctx,[Fo.Q(.1,.03),Fo.Q(.4,.026),Fo.Q(.8,.016)],lw*.8,.45*T.def+.25);L(ctx,[Fo.Q(.06,-.02),Fo.Q(.4,-.02),Fo.Q(.9,-.01)],lw*.7,.3);
  ball(ctx,w,g,B.H*T.hand,f,lw,zs(S.G))}
/* clenched fist = a plain ball just past the wrist */
function ball(ctx,w,g,H,f,lw,zs){const c={x:w.x+(g.x-w.x)*.55,y:w.y+(g.y-w.y)*.55},r=.034*H*zs;ctx.lineWidth=lw*2.2;ctx.strokeStyle=LINE;ctx.beginPath();ctx.arc(c.x,c.y,r,0,7);ctx.stroke();ctx.fillStyle=f;ctx.fill()}
function legDraw(ctx,B,S,J,d,M,T,far,zs,lw){const f=far?FARF:FILL,h=J[S.H],k=J[S.K],a=J[S.A],he=J[S.He],t=J[S.T];const Mq=M*T.leg,Mc=M*T.calf,zH=zs(S.H),zK=zs(S.K),zA=zs(S.A);
  const rt=[[-.12,.074*zH,.082*zH],[.12,.082*zH,.088*zH],[.4,.072,.074],[.7,.056*zK,.056*zK],[.92,.046*zK,.046*zK],[1,.044*zK,.046*zK]];
  const rs=[[-.06,.044*zK,.046*zK],[.14,.04,.056],[.32,.036,.06],[.55,.03,.042],[.78,.025*zA,.03*zA],[.94,.022*zA,.024*zA],[1.02,.022*zA,.026*zA]];
  const Th=outline(h,k,d,rt,Mq,1),Sh=outline(k,a,d,rs,Mc,2);
  const ft=footPts(a,he,t,M*T.foot);
  group(ctx,[Th.pts,Sh.pts,ft.pts],f,lw);shade(ctx,Th,rt,Mq);shade(ctx,Sh,rs,Mc);
  const Q=Th.Q;/* quad sweep + vastus teardrop above the knee, sartorius, hamstring */
  L(ctx,[Q(.1,.03),Q(.4,.04),Q(.72,.03)],lw*.9,.3+.5*T.def);plane(ctx,[Q(.6,.056),Q(.86,.05),Q(.96,.03),Q(.74,.0)],HILITE);L(ctx,[Q(.05,.06),Q(.35,.02),Q(.7,-.01)],lw*.7,.28);L(ctx,[Q(.2,-.05),Q(.55,-.04),Q(.88,-.03)],lw*.8,.25+.4*T.def);
  /* knee cap */{const F=Th.F;line(ctx,[{x:k.x+F.nx*.046*Mq-F.ux*.016*Mq,y:k.y+F.ny*.046*Mq-F.uy*.016*Mq},{x:k.x+F.nx*.052*Mq+F.ux*.018*Mq,y:k.y+F.ny*.052*Mq+F.uy*.018*Mq},{x:k.x+F.nx*.034*Mq+F.ux*.04*Mq,y:k.y+F.ny*.034*Mq+F.uy*.04*Mq}],lw*.8,DET,.55)}
  const Q2=Sh.Q;L(ctx,[Q2(.08,.025),Q2(.5,.018),Q2(.9,.012)],lw*.9,.45);L(ctx,[Q2(.1,-.03),Q2(.34,-.045),Q2(.55,-.03)],lw*.8,.3+.45*T.def);L(ctx,[Q2(.62,-.03),Q2(.9,-.02)],lw*.7,.3);
  footLines(ctx,a,he,t,M*T.foot,lw)}
function footPts(A,He,T,M){const ux0=T.x-He.x,uy0=T.y-He.y,Lf=Math.hypot(ux0,uy0)||1e-5,ux=ux0/Lf,uy=uy0/Lf;let nx=-uy,ny=ux;if((A.x-He.x)*nx+(A.y-He.y)*ny<0){nx=-nx;ny=-ny}
  const Q=(u,v)=>({x:He.x+ux*u*Lf+nx*v*Lf,y:He.y+uy*u*Lf+ny*v*Lf});
  return{pts:[Q(-.08,.12),Q(-.07,.0),Q(.06,-.02),Q(.3,.015),Q(.55,.0),Q(.8,-.01),Q(1.0,.0),Q(1.05,.05),Q(.97,.1),Q(.8,.15),Q(.58,.24),Q(.4,.4),Q(.22,.5),Q(.0,.46)],Q}}
function footLines(ctx,A,He,T,M,lw){const ux0=T.x-He.x,uy0=T.y-He.y,Lf=Math.hypot(ux0,uy0)||1e-5,ux=ux0/Lf,uy=uy0/Lf;let nx=-uy,ny=ux;if((A.x-He.x)*nx+(A.y-He.y)*ny<0){nx=-nx;ny=-ny}
  const Q=(u,v)=>({x:He.x+ux*u*Lf+nx*v*Lf,y:He.y+uy*u*Lf+ny*v*Lf});
  for(let i=0;i<4;i++){const u=.8+i*.05;line(ctx,[Q(u,.0),Q(u+.004,.09)],lw*.8,DET,.7)}line(ctx,[Q(.28,.012),Q(.5,.03),Q(.7,.012)],lw*.7,DET,.35)}
/* trunk: neck, ribcage, waist, pelvis and glutes as one body with the head on top */
function trunkDraw(ctx,B,J,H,d,M,T,lw){const sp=[J.hip,J.mid,J.sh,J.nk];const segL=[0];for(let i=1;i<4;i++)segL.push(segL[i-1]+Math.hypot(sp[i].x-sp[i-1].x,sp[i].y-sp[i-1].y));const TL=segL[3]||1;
  const at=s=>{const Lg=s*TL;let i=1;while(i<3&&segL[i]<Lg)i++;const a=sp[i-1],b=sp[i],k=(Lg-segL[i-1])/((segL[i]-segL[i-1])||1);const tx=b.x-a.x,ty=b.y-a.y,l=Math.hypot(tx,ty)||1;return{x:a.x+tx*k,y:a.y+ty*k,nx:ty/l*d,ny:-tx/l*d}};
  const pt=(s,w)=>{const c=at(s);return{x:c.x+c.nx*w*M/.94,y:c.y+c.ny*w*M/.94}};
  const bel=T.belly*.045,ch=T.chest,nk=T.neck;
  /* s: 0 = hip joint, .5 = waist, 1 = base of the neck.  front / back half-depths */
  const front=[[-.16,.062],[-.08,.074],[.04,.078+bel*.3],[.18,.072+bel*.8],[.32,.07+bel],[.46,.072+bel*.6],[.58,.082],[.68,.094*ch],[.78,.1*ch],[.87,.092*ch],[.94,.07],[1.0,.04*nk],[1.1,.036*nk]];
  const back=[[-.16,.082],[-.08,.1],[.04,.108],[.16,.082],[.28,.064+bel*.2],[.42,.066],[.56,.078],[.68,.09],[.78,.1*ch],[.88,.092],[.95,.07],[1.0,.05*nk],[1.1,.046*nk]];
  const fr=front.map(([s,w])=>pt(s,w)),bk=back.map(([s,w])=>pt(s,-w));
  const pts=fr.concat([pt(1.16,0)],bk.slice().reverse(),[pt(-.2,-.03),pt(-.2,.03)]);
  return{pts,pt,front,back,at}}
function trunkLines(ctx,B,T,tr,lw,M){const pt=tr.pt,De=T.def,H=B.H;const l=(pts,w,al)=>line(ctx,pts,w*lw,DET,al);
  plane(ctx,tr.back.map(([s,w])=>pt(s,-w*.3)).concat(tr.back.slice().reverse().map(([s,w])=>pt(s,-w*.97))),PLANE);/* back shadow */
  plane(ctx,[pt(.97,-.07),pt(1.1,-.05),pt(1.1,.0),pt(.96,-.01)],PLANE2);/* trapezius slope */
  /* pec: clavicle, lower edge, nipple; deltoid-pec groove */
  l([pt(.9,.03),pt(.94,.08)],.9,.6);plane(ctx,[pt(.94,.07),pt(.88,.09),pt(.8,.1*T.chest),pt(.7,.096),pt(.69,.03),pt(.8,.0),pt(.9,.02)],HILITE);l([pt(.82,.1*T.chest),pt(.74,.1),pt(.69,.086),pt(.68,.06)],1.1,.75);
  ctx.fillStyle=DET;ctx.beginPath();const n=pt(.77,.094);ctx.arc(n.x,n.y,.0033*H,0,7);ctx.fill();
  /* ribs / serratus */for(let i=0;i<4;i++){const s=.66-i*.05;l([pt(s,.07),pt(s-.03,.045)],.8,.15+.5*De)}
  /* rectus abdominis + linea alba + obliques */if(T.belly<.4){const rows=De>.7?4:De>.35?3:2;for(let i=0;i<rows;i++){const s=.56-i*.085;l([pt(s,.078),pt(s,.04)],.9,.2+.55*De)}l([pt(.62,.058),pt(.1,.054)],.8,.3+.4*De);l([pt(.36,.062),pt(.12,.075)],.8,.2+.4*De)}
  else{l([pt(.4,.07),pt(.38,.05)],.9,.5);ctx.fillStyle=DET;const q=pt(.34,.066+T.belly*.045);ctx.beginPath();ctx.arc(q.x,q.y,.003*H,0,7);ctx.fill()}
  /* scapula, spine, lumbar dimples, glute crease */l([pt(.8,-.095),pt(.7,-.075),pt(.62,-.082)],.9,.4);l([pt(.98,-.05),pt(.04,-.07)],.6,.18);l([pt(.02,-.1),pt(-.08,-.075),pt(-.15,-.05)],.9,.5)}
/* head: blank egg (no facial features) with a faint jaw / skull plane so the facing side reads */
function headPts(r,sk){const P=(x,y)=>({x:x*sk,y:y*sk});return[P(-.7,-.4),P(-1.0,-.05),P(-1.06,.4),P(-.92,.84),P(-.5,1.14),P(.1,1.2),P(.62,1.04),P(.92,.68),P(.98,.26),P(.94,-.16),P(.9,-.52),P(.78,-.84),P(.52,-.98),P(.2,-.98),P(-.12,-.8),P(-.42,-.56)]}
function headDraw(ctx,B,J,H,d,T,lw,zs){const r=.062*H;ctx.save();ctx.translate(J.hd.x,J.hd.y+.012*H);ctx.rotate(-(B.ang&&B.ang.hd||0)*.9);ctx.scale(d*r,r);const w=lw/r;const hp=headPts(r,T.skull);
  group(ctx,[hp],FILL,w);plane(ctx,[{x:-.3,y:-.6},{x:.0,y:-.76},{x:.34,y:-.96},{x:.68,y:-.98},{x:.5,y:-.7},{x:.1,y:-.55}],PLANE2);/* jaw plane */plane(ctx,[{x:-1.02,y:.32},{x:-.9,y:.8},{x:-.48,y:1.12},{x:-.6,y:.5}],PLANE);ctx.restore()}

/* motion blur: the whole limb that is striking is smeared along its own motion of this frame (no history, so nothing lingers) */
function blur(ctx,B,J,S,keys,tip,H,d,M){const P=B._pJ;if(!P||!P[tip]||!J[tip])return;const vx=J[tip].x-P[tip].x,vy=J[tip].y-P[tip].y,sp=Math.hypot(vx,vy)/H;if(sp<.02||sp>.5)return;const k=clamp((sp-.02)/.05,.25,1);
  const pts=keys.map(q=>{const a=J[q],b=P[q]||a;return{a,v:{x:a.x-b.x,y:a.y-b.y}}});
  for(let j=4;j>=1;j--){const al=.2*k*(1-j/5.2);ctx.fillStyle=GHOST+al.toFixed(3)+')';const sh=pts.map(q=>({x:q.a.x-q.v.x*j*.9,y:q.a.y-q.v.y*j*.9}));
    for(let i=0;i<sh.length-1;i++){const a=sh[i],b=sh[i+1],r0=(.05-i*.008)*M,r1=(.05-(i+1)*.008)*M;const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1e-5,nx=-dy/L,ny=dx/L;ctx.beginPath();ctx.moveTo(a.x+nx*r0,a.y+ny*r0);ctx.lineTo(b.x+nx*r1,b.y+ny*r1);ctx.lineTo(b.x-nx*r1,b.y-ny*r1);ctx.lineTo(a.x-nx*r0,a.y-ny*r0);ctx.closePath();ctx.fill();ctx.beginPath();ctx.arc(b.x,b.y,Math.max(r1,.02*M),0,7);ctx.fill()}}}
FR.draw=function(B,ctx,o){o=o||{};const J=B.J,H=B.H,lk=B.look,d=B.d||1;if(!J.hd)return;setPal(lk.ref?PAL_REF:PAL_FIGHTER);
  const M=H*(B.W||1)*.86,T=traits(B),lw=.0033*H;
  const nearLead=(d>0)===(B.stance>0);const lead={S:'lS',E:'lE',W:'lW',G:'lG',H:'lH',K:'lK',A:'lA',He:'lHe',T:'lT'},rear={S:'rS',E:'rE',W:'rW',G:'rG',H:'rH',K:'rK',A:'rA',He:'rHe',T:'rT'};
  const N=nearLead?lead:rear,F=nearLead?rear:lead;const ON=o.only?(k=>o.only.indexOf(k)>=0):null;
  const Z=B._zJ||{},zs=k=>clamp(1+(Z[k]||0)*2,.65,1.7);
  const own=B._owner,ac=own&&own.act&&own.act.c&&own.act.c.hit?own.act.c:null;/* only the limb that is delivering the strike is smeared */
  const arm=(S,far)=>{if(!lk.ref&&ac&&ac.hand&&S.S[0]===ac.hand)blur(ctx,B,J,S,[S.S,S.E,S.W,S.G],S.G,H,d,M);armDraw(ctx,B,S,J,d,M,T,far,zs,lw)},leg=(S,far)=>{if(!lk.ref&&ac&&ac.leg&&S.H[0]===ac.leg)blur(ctx,B,J,S,[S.H,S.K,S.A,S.T],S.T,H,d,M);legDraw(ctx,B,S,J,d,M,T,far,zs,lw)};
  const torso=()=>{const tr=trunkDraw(ctx,B,J,H,d,M,T,lw);group(ctx,[tr.pts],FILL,lw);if(DETAIL)trunkLines(ctx,B,T,tr,lw,M)},head=()=>headDraw(ctx,B,J,H,d,T,lw,zs);
  if(!o.noShadow&&!o.onlyArm&&o.part!=='far'&&(!ON||ON('torso'))){ctx.save();ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();{let x0=1e9,x1=-1e9;for(const k in J){x0=Math.min(x0,J[k].x);x1=Math.max(x1,J[k].x)}const sh=Math.min(Math.max(.16*H,(x1-x0)/2+.05*H),.42*H);ctx.ellipse((x0+x1)/2,0,sh,.032*H,0,0,Math.PI*2)}ctx.fill();ctx.restore()}
  ctx.save();
  if(o.onlyArm)arm(N,false);else if(o.part==='far')arm(F,true);
  else if(ON){if(ON('farArm'))arm(F,true);if(ON('farLeg'))leg(F,true);if(ON('torso'))torso();if(ON('nearLeg'))leg(N,false);if(ON('head'))head();if(ON('nearArm'))arm(N,false)}
  else{if(o.part!=='body')arm(F,true);leg(F,true);torso();leg(N,false);head();if(o.part!=='body')arm(N,false)}
  ctx.restore()};
})();
