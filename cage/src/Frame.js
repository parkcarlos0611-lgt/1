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
function line(ctx,pts,w,col,al){ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=col||DET;ctx.lineWidth=w;if(al!=null)ctx.globalAlpha=al;ctx.beginPath();splOpen(ctx,pts);ctx.stroke();ctx.restore()}
function plane(ctx,pts,col){ctx.fillStyle=col;ctx.beginPath();spl(ctx,pts);ctx.fill()}
/* frame of a segment: n points to the front (facing side, or up when level) */
function frame(a,b,d){const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1e-5,ux=dx/L,uy=dy/L;let nx=-uy,ny=ux;if(nx*d+ny*.35<0){nx=-nx;ny=-ny}return{ux,uy,nx,ny,L}}

/* per-fighter physical profile (stable, from the name + build) */
function traits(B){if(B._tr)return B._tr;const lk=B.look,R=rng((lk.name||'x')+'~fr'),r=(a,b)=>a+(b-a)*R();const heavy=clamp(((B.W||1)-.9)/.35,0,1);
  const belly=lk.belly||lk.body==='belly'?1:lk.body==='soft'?.45:0,broad=lk.body==='broad'?1:0;
  return B._tr={arm:r(.94,1.08)+heavy*.06,fore:r(.94,1.1),leg:r(.95,1.07)+heavy*.04,calf:r(.92,1.14),neck:r(.9,1.1)+heavy*.2+broad*.08,chest:r(.97,1.06)+broad*.1,hand:r(.94,1.1),foot:r(.95,1.08),belly,broad,
    def:clamp(1-heavy*.5-belly*.6+r(-.2,.2),0,1),/* muscle definition */
    nose:r(.35,.8),bridge:r(.2,.8),brow:r(.3,.85),jaw:r(.3,.85),chin:r(.3,.75),cp:r(.25,.75),lu:r(.25,.75),ll:r(.3,.8),ear:r(.7,1.1),cw:r(-.03,.05),cauli:lk.cauli?1:0,fs:r(-.02,.07),hump:r(0,1)<.2?r(.3,.8):0,flat:r(0,1)<.25?r(.3,.7):0}}

/* ---- parts ---- */
function limb(ctx,a,b,d,rows,M,fill,lw,cap){const F=frame(a,b,d);const Q=(t,w)=>({x:a.x+F.ux*F.L*t+F.nx*w*M,y:a.y+F.uy*F.L*t+F.ny*w*M});
  const r0=rows[0],r1=rows[rows.length-1];const c0=cap===1?0:.045,c1=cap===2?0:.045;
  const front=[],back=[];if(c0)front.push(Q(r0[0]-c0,(r0[1]-r0[2])/2));for(const r of rows){front.push(Q(r[0],r[1]))}if(c1)front.push(Q(r1[0]+c1,(r1[1]-r1[2])/2));for(const r of rows.slice().reverse())back.push(Q(r[0],-r[2]));
  body(ctx,front.concat(back),fill,lw);
  /* shadow plane along the back / underside */
  plane(ctx,rows.map(r=>Q(r[0],-r[2]*.3)).concat(rows.slice().reverse().map(r=>Q(r[0],-r[2]*.97))),PLANE);
  return{F,Q}}
function ring(ctx,c,r,fill,lw){ctx.beginPath();ctx.arc(c.x,c.y,r,0,7);ctx.lineWidth=lw*2;ctx.strokeStyle=LINE;ctx.stroke();ctx.fillStyle=fill;ctx.fill()}

function armDraw(ctx,B,S,J,d,M,T,far,zs,lw){const f=far?FARF:FILL,a=J[S.S],e=J[S.E],w=J[S.W],g=J[S.G],k=T.arm;const Mu=M*k,Mf=M*T.fore;
  const up=limb(ctx,a,e,d,[[-.1,.05*zs(S.S),.056*zs(S.S)],[.12,.064*zs(S.S),.066*zs(S.S)],[.3,.054,.058],[.5,.05,.05],[.78,.04*zs(S.E),.04*zs(S.E)],[1,.032*zs(S.E),.034*zs(S.E)]].map(r=>[r[0],r[1],r[2]]),Mu,f,lw);
  /* deltoid, biceps / triceps */
  const Q=up.Q;line(ctx,[Q(.02,.04),Q(.18,.03),Q(.34,.012)],lw*.9);line(ctx,[Q(.3,-.012),Q(.55,-.014),Q(.8,-.012)],lw*.8,DET,.7*T.def+.2);
  plane(ctx,[Q(.3,.05),Q(.5,.052),Q(.64,.04),Q(.4,.0)],HILITE);
  const fo=limb(ctx,e,w,d,[[-.06,.034*zs(S.E),.034*zs(S.E)],[.2,.04,.038],[.45,.034,.032],[.8,.026,.025],[1,.023*zs(S.W),.023*zs(S.W)]],Mf,f,lw);
  ring(ctx,e,.031*Mu*zs(S.E),f,lw);/* elbow */
  const F=fo.F;line(ctx,[fo.Q(.12,.006),fo.Q(.5,.0),fo.Q(.85,.0)],lw*.8,DET,.5);
  fist(ctx,B,w,g,d,B.H*.4*T.hand,f,lw,zs(S.G),(S.S==='lS')===((B.stance||1)>0));ctx.globalAlpha=1}
function fist(ctx,B,w,g,d,M,f,lw,zs,isLeft){const sg=isLeft?1:-1;const F=frame(w,g,d);const L=Math.max(F.L,.03*M);const Q=(u,v)=>({x:w.x+F.ux*u*M*zs+F.nx*v*sg*M*zs,y:w.y+F.uy*u*M*zs+F.ny*v*sg*M*zs});
  /* back of the hand + curled fingers (4 knuckle lobes) + thumb */
  body(ctx,[Q(-.01,.026),Q(.05,.034),Q(.1,.04),Q(.14,.032),Q(.15,.0),Q(.14,-.03),Q(.1,-.04),Q(.04,-.034),Q(-.01,-.024)],f,lw);
  for(let i=0;i<4;i++){const v=.028-i*.02;line(ctx,[Q(.1,v),Q(.145,v-.002)],lw*.9,DET,.8)}
  body(ctx,[Q(.02,.03),Q(.07,.052),Q(.11,.05),Q(.1,.036),Q(.05,.03)],f,lw*.8)}
function legDraw(ctx,B,S,J,d,M,T,far,zs,lw){const f=far?FARF:FILL,h=J[S.H],k=J[S.K],a=J[S.A],he=J[S.He],t=J[S.T];const Mq=M*T.leg,Mc=M*T.calf;
  const th=limb(ctx,h,k,d,[[-.06,.074*zs(S.H),.072*zs(S.H)],[.18,.078,.074],[.45,.068,.064],[.75,.054,.052],[1,.044*zs(S.K),.045*zs(S.K)]],Mq,f,lw);
  const Q=th.Q;/* quad sweep + vastus teardrop + hamstring line */
  line(ctx,[Q(.1,.02),Q(.4,.034),Q(.7,.03)],lw*.9,DET,.35+.5*T.def);plane(ctx,[Q(.56,.05),Q(.82,.046),Q(.92,.026),Q(.7,.0)],HILITE);line(ctx,[Q(.2,-.04),Q(.55,-.032),Q(.85,-.022)],lw*.8,DET,.25+.4*T.def);
  const sh=limb(ctx,k,a,d,[[-.04,.042*zs(S.K),.044*zs(S.K)],[.22,.038,.056],[.42,.035,.052],[.7,.028,.034],[.92,.023,.024],[1.02,.023*zs(S.A),.025*zs(S.A)]],Mc,f,lw);
  const Q2=sh.Q;line(ctx,[Q2(.1,.022),Q2(.5,.016),Q2(.88,.012)],lw*.9,DET,.4);line(ctx,[Q2(.12,-.03),Q2(.38,-.036)],lw*.8,DET,.3+.5*T.def);
  ring(ctx,k,.046*Mq*zs(S.K),f,lw);/* knee */{const F=frame(h,k,d);plane(ctx,[{x:k.x+F.nx*.042*Mq-F.ux*.02*Mq,y:k.y+F.ny*.042*Mq-F.uy*.02*Mq},{x:k.x+F.nx*.03*Mq+F.ux*.03*Mq,y:k.y+F.ny*.03*Mq+F.uy*.03*Mq},{x:k.x+F.nx*.005*Mq,y:k.y+F.ny*.005*Mq}],HILITE)}
  foot(ctx,a,he,t,d,M*T.foot,f,lw,zs(S.T));ring(ctx,a,.028*M,f,lw*.8)}
function foot(ctx,A,He,T,d,M,f,lw,zs){const ux0=T.x-He.x,uy0=T.y-He.y,Lf=Math.hypot(ux0,uy0)||1e-5,ux=ux0/Lf,uy=uy0/Lf;let nx=-uy,ny=ux;if((A.x-He.x)*nx+(A.y-He.y)*ny<0){nx=-nx;ny=-ny}
  const Q=(u,v)=>({x:He.x+ux*u*Lf+nx*v*Lf,y:He.y+uy*u*Lf+ny*v*Lf});
  body(ctx,[Q(-.07,.1),Q(-.06,.0),Q(.08,-.01),Q(.3,.02),Q(.52,.0),Q(.78,-.01),Q(1.0,.0),Q(1.04,.05),Q(.96,.1),Q(.78,.15),Q(.56,.24),Q(.36,.4),Q(.2,.46),Q(.02,.42)],f,lw);
  plane(ctx,[Q(.1,.0),Q(.3,.03),Q(.52,.01),Q(.4,.07),Q(.2,.06)],PLANE2);/* arch */
  for(let i=0;i<4;i++){const u=.8+i*.05;line(ctx,[Q(u,.0),Q(u+.005,.08)],lw*.8,DET,.8)}/* toes */
  line(ctx,[Q(.3,.34),Q(.55,.2),Q(.78,.12)],lw*.8,DET,.4)}/* extensor tendons */
function torsoDraw(ctx,B,J,d,M,T,lw){const sp=[J.hip,J.mid,J.sh,J.nk];const segL=[0];for(let i=1;i<4;i++)segL.push(segL[i-1]+Math.hypot(sp[i].x-sp[i-1].x,sp[i].y-sp[i-1].y));const TL=segL[3]||1;
  const at=s=>{const L=s*TL;let i=1;while(i<3&&segL[i]<L)i++;const a=sp[i-1],b=sp[i],k=(L-segL[i-1])/((segL[i]-segL[i-1])||1);const tx=b.x-a.x,ty=b.y-a.y,l=Math.hypot(tx,ty)||1;return{x:a.x+tx*k,y:a.y+ty*k,nx:ty/l*d,ny:-tx/l*d}};
  const pt=(s,w)=>{const c=at(s);return{x:c.x+c.nx*w*M/.94,y:c.y+c.ny*w*M/.94}};
  const bel=T.belly*.042,shb=T.chest;
  const FRt=[[0,.074+bel*.3],[.16,.073+bel*.8],[.32,.071+bel],[.48,.07+bel*.7],[.6,.08],[.7,.096*shb],[.79,.099*shb],[.87,.088*shb],[.94,.062],[1,.036]];
  const BKt=[[0,.09],[.1,.086],[.24,.066+bel*.3],[.38,.061+bel*.2],[.52,.071],[.66,.085*shb],[.78,.093*shb],[.88,.087*shb],[.95,.066],[1,.045]];
  const front=FRt.map(([s,w])=>pt(s,w)),back=BKt.map(([s,w])=>pt(s,-w));
  body(ctx,front.concat([pt(1.04,0)],back.slice().reverse(),[pt(-.04,0)]),FILL,lw);
  plane(ctx,BKt.map(([s,w])=>pt(s,-w*.32)).concat(back.slice().reverse()),PLANE);/* back / lat shadow */
  const L=(pts,w,al)=>line(ctx,pts,w*lw,DET,al),De=T.def;
  /* trapezius + clavicle */plane(ctx,[pt(.9,-.08),pt(1,-.045),pt(1,.0),pt(.93,-.02)],PLANE2);L([pt(.9,.02),pt(.93,.075)],.9,.6);
  /* pec: lower edge, sternal groove, nipple */plane(ctx,[pt(.93,.06),pt(.87,.088),pt(.79,.099),pt(.7,.096),pt(.69,.03),pt(.8,.0),pt(.9,.02)],HILITE);
  L([pt(.81,.099),pt(.74,.1),pt(.69,.085),pt(.68,.06)],1.1,.8);ctx.fillStyle=DET;ctx.beginPath();const n=pt(.77,.093);ctx.arc(n.x,n.y,.0035*B.H,0,7);ctx.fill();
  /* serratus + ribs */for(let i=0;i<3;i++){const s=.66-i*.05;L([pt(s,.062),pt(s-.025,.044)],.8,.2+.5*De)}
  /* abs + linea alba + obliques */if(T.belly<.4){const rows=De>.7?4:De>.35?3:2;for(let i=0;i<rows;i++){const s=.56-i*.085;L([pt(s,.076),pt(s,.045)],.9,.25+.55*De)}L([pt(.6,.058),pt(.2,.054)],.8,.3+.4*De);L([pt(.34,.055),pt(.15,.068)],.8,.2+.4*De)}
  else{L([pt(.4,.07),pt(.38,.05)],.9,.5);ctx.fillStyle=DET;const q=pt(.34,.066+bel);ctx.beginPath();ctx.arc(q.x,q.y,.003*B.H,0,7);ctx.fill()}
  /* scapula + spine on the back */L([pt(.78,-.09),pt(.7,-.07),pt(.62,-.075)],.9,.35+.35*De);L([pt(.95,-.05),pt(.1,-.06)],.6,.18)}
function pelvisDraw(ctx,B,J,d,M,T,lw){const hip=J.hip,mid=J.mid,ta=B.ang&&B.ang.ta||0;const n={x:d*Math.cos(ta),y:-Math.sin(ta)};const Pp=(c,f)=>({x:c.x+n.x*f*M/.94,y:c.y+n.y*f*M/.94});const top=P2(hip,mid,.36),low=P2(hip,mid,-.5);
  const bw=.082+T.belly*.04;body(ctx,[Pp(top,bw),Pp(P2(hip,mid,.1),bw*1.05),Pp(hip,bw*.98),Pp(low,.07),Pp(low,-.09),Pp(hip,-.098),Pp(P2(hip,mid,.1),-.095),Pp(top,-.088)],FILL,lw);
  plane(ctx,[Pp(hip,-.098),Pp(low,-.09),Pp(low,-.04),Pp(hip,-.05)],PLANE);line(ctx,[Pp(P2(hip,mid,.2),bw),Pp(P2(hip,mid,.02),.05),Pp(P2(hip,mid,-.2),.0)],lw*.9,DET,.5);/* hip crease */
  line(ctx,[Pp(P2(hip,mid,.05),-.095),Pp(P2(hip,mid,-.3),-.06)],lw*.9,DET,.4)}/* glute */
function headDraw(ctx,B,J,H,d,T,lw,zs){const r=.066*H;ctx.save();ctx.translate(J.hd.x,J.hd.y);ctx.rotate(-(B.ang&&B.ang.hd||0)*.9);ctx.scale(d*r,r);const w=lw/r;
  const P=(x,y)=>({x,y});
  /* neck: sternocleidomastoid, throat, nape (thickness per fighter) */
  const nt=T.neck;body(ctx,[P(-.66,-.3),P(-.88-nt*.1,-1.0),P(-1.0-nt*.12,-1.7),P(.5,-1.72),P(.42,-1.05),P(.3,-.8),P(.05,-.6)],FILL,w);
  line(ctx,[P(-.3,-.62),P(-.05,-.68),P(.3,-1.5)],w*1.0,DET,.6);plane(ctx,[P(.05,-.6),P(.3,-.8),P(.42,-1.05),P(.5,-1.68),P(.28,-1.68),P(.18,-.9)],PLANE);
  /* skull + face profile */
  const nl=T.nose,hump=T.hump,fl=T.flat,tipX=1.07+nl*.2-fl*.1,tipY=-.1-nl*.07;const brX=.93+T.brow*.07+T.fs,jy=-.78-T.chin*.12;
  const out=[P(-.58,-.5),P(-.93,-.18),P(-1.02-T.cw,.34),P(-.9,.8),P(-.48,1.1),P(.14,1.18),P(.6,1.05),P(.82+T.fs*.3,.78),P(.9+T.fs,.54),P(brX,.33),P(.89+T.fs*.4,.19),P(.93+T.bridge*.05-fl*.04,.07),P(1.0+T.bridge*.05+hump*.07-fl*.06,-.02),P(tipX-.03,tipY+.02),P(tipX,tipY),P(tipX-.03,tipY-.08),P(.98,-.24),P(.95,-.3),P(.99+T.lu*.07,-.37),P(.93,-.43),P(.99+T.ll*.07,-.5),P(.92,-.6),P(.95+T.cp*.12,-.72-T.chin*.05),P(.9+T.cp*.1,jy),P(.62,jy-.05),P(.22,jy+.04),P(-.12,-.72+T.jaw*.1),P(-.4,-.52)];
  body(ctx,out,FILL,w);
  ctx.save();ctx.beginPath();spl(ctx,out);ctx.clip();
  plane(ctx,[P(.25,-.02),P(.66,-.18),P(.7,-.58),P(.46,-.86),P(.08,-.62)],PLANE);/* cheek hollow */
  plane(ctx,[P(-.34,-.6),P(-.12,-.82),P(.25,-.96),P(.6,-1.02),P(.95,-.9),P(.7,-.8),P(.2,-.78),P(-.15,-.58)],PLANE2);/* jaw underside */
  plane(ctx,[P(.52,.34),P(.96,.3),P(.92,.06),P(.55,.04)],'rgba(120,122,132,'+(.1+T.brow*.18)+')');/* eye socket */
  plane(ctx,[P(.22+T.jaw*.1,-.3),P(.5,-.38),P(.4,-.74),P(.1,-.62)],'rgba(120,122,132,'+(.08+T.jaw*.14)+')');/* masseter */
  ctx.restore();
  /* brow ridge, eye, nostril, lips, ear (grey line work) */
  line(ctx,[P(.6,.36),P(.8,.4),P(brX+.01,.36)],w*2.2,DET,.8);
  const ey=.14;ctx.fillStyle='#55565c';ctx.beginPath();ctx.ellipse(.8,ey,.1,.05,0,0,7);ctx.fill();line(ctx,[P(.66,ey+.04),P(.78,ey+.09),P(.92,ey+.04)],w*1.4,DET,.9);
  line(ctx,[P(tipX-.2,tipY-.04),P(tipX-.08,tipY-.06)],w*2.6,DET,.8);line(ctx,[P(tipX-.22,tipY+.06),P(tipX-.34,tipY-.12),P(tipX-.3,tipY-.3)],w*1.2,DET,.45);
  line(ctx,[P(.99,-.43),P(.9,-.43),P(.78,-.41)],w*1.8,DET,.9);line(ctx,[P(.92,-.6),P(.84,-.58)],w*1.2,DET,.5);
  const e=T.ear,cau=T.cauli;body(ctx,[P(-.42,.2*e),P(-.1,.26*e),P(-.02,0),P(-.1,-.3*e-.05*cau),P(-.34,-.34*e),P(-.46,-.04)],FILL,w*.9);line(ctx,[P(-.33,.12),P(-.14,.14),P(-.12,-.12),P(-.3,-.16)],w*1.1,DET,.7);
  ctx.restore()}

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
  const torso=()=>torsoDraw(ctx,B,J,d,M,T,lw),pelvis=()=>pelvisDraw(ctx,B,J,d,M,T,lw),head=()=>headDraw(ctx,B,J,H,d,T,lw,zs);
  if(!o.noShadow&&!o.onlyArm&&o.part!=='far'&&(!ON||ON('torso'))){ctx.save();ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();{let x0=1e9,x1=-1e9;for(const k in J){x0=Math.min(x0,J[k].x);x1=Math.max(x1,J[k].x)}const sh=Math.min(Math.max(.16*H,(x1-x0)/2+.05*H),.42*H);ctx.ellipse((x0+x1)/2,0,sh,.032*H,0,0,Math.PI*2)}ctx.fill();ctx.restore()}
  ctx.save();
  if(o.onlyArm)arm(N,false);else if(o.part==='far')arm(F,true);
  else if(ON){if(ON('farArm'))arm(F,true);if(ON('farLeg'))leg(F,true);if(ON('torso'))torso();if(ON('nearLeg'))leg(N,false);if(ON('shorts'))pelvis();if(ON('head'))head();if(ON('nearArm'))arm(N,false)}
  else{if(o.part!=='body')arm(F,true);leg(F,true);torso();leg(N,false);pelvis();head();if(o.part!=='body')arm(N,false)}
  ctx.restore()};
})();
