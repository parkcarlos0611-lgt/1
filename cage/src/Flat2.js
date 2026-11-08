/* ===== Flat2.js : flat-colour fighters in the style of the reference picture =====
   No outlines. Every part is a solid skin tone with a few angular planes (light / shadow / deep shadow) placed by anatomy in
   limb-local coordinates, so they move with the skeleton. Face: eye, brow, nose wedge, beard, hair cap, ear. Kit: black gloves
   with a red strap and a UFC mark, trunks with a waistband, stripes and a logo. Tattoos are small ink marks. Per fighter:
   skin tone, hair / beard style and colour, kit colours, tattoos and body build come from the look data (CURATED overrides below).
   Toggle: FLAT2.on (falls back to the white frame / old flat art). */
(function(){
if(typeof Body==='undefined')return;
const FL=window.FLAT2={on:true};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
function rng(seed){let h=2166136261;const s=String(seed);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}let a=h>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function spl(c,pts){const n=pts.length;c.moveTo(pts[0].x,pts[0].y);for(let i=0;i<n;i++){const p0=pts[(i-1+n)%n],p1=pts[i],p2=pts[(i+1)%n],p3=pts[(i+2)%n];c.bezierCurveTo(p1.x+(p2.x-p0.x)/6,p1.y+(p2.y-p0.y)/6,p2.x-(p3.x-p1.x)/6,p2.y-(p3.y-p1.y)/6,p2.x,p2.y)}c.closePath()}
const fillSp=(ctx,pts,col)=>{ctx.fillStyle=col;ctx.beginPath();spl(ctx,pts);ctx.fill()};
const fillPoly=(ctx,pts,col)=>{ctx.fillStyle=col;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill()};
function frame(a,b,d){const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1e-5,ux=dx/L,uy=dy/L;let nx=-uy,ny=ux;if(nx*d+ny*.35<0){nx=-nx;ny=-ny}return{ux,uy,nx,ny,L}}
function outline(a,b,d,rows,M,cap){const F=frame(a,b,d);const Q=(t,w)=>({x:a.x+F.ux*F.L*t+F.nx*w*M,y:a.y+F.uy*F.L*t+F.ny*w*M});
  const r0=rows[0],r1=rows[rows.length-1],c0=cap===1?0:.05,c1=cap===2?0:.05;const pts=[];if(c0)pts.push(Q(r0[0]-c0,(r0[1]-r0[2])/2));for(const r of rows)pts.push(Q(r[0],r[1]));if(c1)pts.push(Q(r1[0]+c1,(r1[1]-r1[2])/2));for(let i=rows.length-1;i>=0;i--)pts.push(Q(rows[i][0],-rows[i][2]));
  return{pts,F,Q}}
/* a part: base colour, then the angular planes (polygons in (t,w) of the part) clipped to its outline */
function part(ctx,o,base,planes){ctx.fillStyle=base;ctx.beginPath();spl(ctx,o.pts);ctx.fill();if(!planes)return;ctx.save();ctx.beginPath();spl(ctx,o.pts);ctx.clip();for(const[poly,col]of planes)fillPoly(ctx,poly.map(([t,w])=>o.Q(t,w)),col);ctx.restore()}

/* ---- looks of specific fighters (matched to reference pictures) ---- */
const CURATED={'Jon Jones':{skin:'#8c5733',hair:'#241812',hs:'fade',bd:'full',beard:true,shorts:'#232326',glove:'#17171a',accent:'#f2f2f2',tatText:['Philippians','4:13']}};
if(typeof lookFor==='function'){const lf=lookFor;window.lookFor=function(f){const L=lf.apply(this,arguments);const C=CURATED[f&&f.n];if(C)Object.assign(L,C);if(L&&!L.name&&f)L.name=f.n;return L}}

function traits(B){if(B._t2)return B._t2;const lk=B.look,R=rng((lk.name||'x')+'~f2'),r=(a,b)=>a+(b-a)*R();const heavy=clamp(((B.W||1)-.9)/.35,0,1);
  return B._t2={arm:r(.95,1.07)+heavy*.06,leg:r(.96,1.06)+heavy*.04,calf:r(.94,1.1),neck:r(.94,1.08)+heavy*.2+(lk.body==='broad'?.08:0),chest:r(.98,1.05)+(lk.body==='broad'?.1:0),hand:r(.96,1.06),
    belly:lk.belly||lk.body==='belly'?1:lk.body==='soft'?.45:0,nose:r(.4,.8),brow:r(.4,.9),jaw:r(.4,.8),chin:r(.3,.7),lip:r(.3,.7),ear:r(.8,1.05)}}

/* ---- tones ---- */
function tones(lk,far,arm){const base=lk.skin||'#c08360';const t={base:shade(base,far?-.1:arm?.035:0),lt:shade(base,far?-.02:.08),d1:shade(base,far?-.22:-.13),d2:shade(base,far?-.32:-.25)};return t}

function armDraw(ctx,B,S,J,d,M,T,far,zs,o){const lk=B.look,t=tones(lk,far,true),a=J[S.S],e=J[S.E],w=J[S.W],g=J[S.G],Mu=M*T.arm*1.32,Mf=M*1.22;const zS=zs(S.S),zE=zs(S.E),zW=zs(S.W);
  const ru=[[-.14,.058*zS,.064*zS],[.06,.068*zS,.07*zS],[.26,.06,.062],[.46,.05,.05],[.7,.042*zE,.04*zE],[.9,.036*zE,.036*zE],[1,.034*zE,.036*zE]];
  const rf=[[-.04,.04*zE,.04*zE],[.14,.045*zE,.042*zE],[.36,.038,.035],[.66,.029*zW,.027*zW],[.9,.024*zW,.024*zW],[1,.023*zW,.023*zW]];
  const U=outline(a,e,d,ru,Mu,0),F=outline(e,w,d,rf,Mf,2);
  part(ctx,U,t.base,[[[[-.3,-.015],[1.2,-.015],[1.2,-.3],[-.3,-.3]],t.d1],[[[-.1,.07],[.22,.075],[.34,.02],[.04,.0]],t.lt],[[[.52,.03],[.95,.02],[.95,-.02],[.55,-.02]],t.d1],[[[.1,-.02],[.4,-.03],[.34,-.08],[.0,-.08]],t.d2]]);
  part(ctx,F,t.base,[[[[-.2,-.012],[1.2,-.012],[1.2,-.3],[-.2,-.3]],t.d1],[[[0,.055],[.4,.05],[.46,.01],[.06,.0]],t.lt],[[[.0,-.01],[.3,-.02],[.2,-.06],[.0,-.06]],t.d2]]);
  /* tattoo sleeve (tat 's') */if(lk.tat&&/s/.test(lk.tat)&&!far){ctx.save();ctx.globalAlpha=.4;ctx.fillStyle='#10121a';ctx.beginPath();spl(ctx,U.pts);ctx.clip();fillPoly(ctx,[[.05,.07],[.7,.06],[.7,-.07],[.05,-.07]].map(([tt,ww])=>U.Q(tt,ww)),'#10121a');ctx.restore()}
  glove(ctx,B,w,g,d,far,zs(S.G),o.corner,S)}
function glove(ctx,B,w,g,d,far,zs,corner,S){const lk=B.look,H=B.H,F=frame(w,g,d),gc=lk.glove||'#17171a',skin=tones(lk,far).base,sk2=tones(lk,far).d1;const dir=S&&S.S==='lS'===((B.stance||1)>0);
  const L0=.1*H*zs,W0=.062*H*zs;const Q=(u,v)=>({x:w.x+F.ux*u*L0+F.nx*v*W0,y:w.y+F.uy*u*L0+F.ny*v*W0});
  /* cuff + strap (corner colour), padded back of the glove, the bare finger tips curling under it */
  fillSp(ctx,[Q(-.05,.34),Q(.28,.4),Q(.3,-.4),Q(-.05,-.34)],far?shade(gc,-.1):gc);
  fillSp(ctx,[Q(.0,.4),Q(.26,.46),Q(.26,.22),Q(.0,.2)],far?shade(corner||'#c0392b',-.2):(corner||'#c0392b'));
  fillSp(ctx,[Q(.24,.46),Q(.6,.5),Q(.95,.36),Q(1.02,0),Q(.9,-.4),Q(.5,-.5),Q(.24,-.42)],far?shade(gc,-.1):gc);
  fillPoly(ctx,[Q(.7,-.45),Q(.98,-.34),Q(1.04,-.04),Q(.9,.0),Q(.72,-.2)],sk2);/* finger tips */
  fillPoly(ctx,[Q(.9,-.36),Q(1.0,-.28),Q(.94,-.08),Q(.84,-.1)],skin);
  if(!far){ctx.save();ctx.translate(Q(.55,.04).x,Q(.55,.04).y);ctx.rotate(Math.atan2(F.uy,F.ux));ctx.scale(1,-1);ctx.fillStyle='#f4f4f4';ctx.font=`900 ${.034*H*zs}px "Arial Black",Impact,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('UFC',0,0);ctx.restore()}}
function footPts(A,He,T,M){const ux0=T.x-He.x,uy0=T.y-He.y,Lf=Math.hypot(ux0,uy0)||1e-5,ux=ux0/Lf,uy=uy0/Lf;let nx=-uy,ny=ux;if((A.x-He.x)*nx+(A.y-He.y)*ny<0){nx=-nx;ny=-ny}
  const Q=(u,v)=>({x:He.x+ux*u*Lf+nx*v*Lf,y:He.y+uy*u*Lf+ny*v*Lf});
  return{pts:[Q(-.08,.12),Q(-.07,.0),Q(.06,-.02),Q(.3,.015),Q(.55,.0),Q(.8,-.01),Q(1.0,.0),Q(1.05,.05),Q(.97,.1),Q(.8,.15),Q(.58,.2),Q(.4,.3),Q(.22,.36),Q(.0,.34)],Q}}
function legDraw(ctx,B,S,J,d,M,T,far,zs,o,sleeve){const lk=B.look,t=tones(lk,far),h=J[S.H],k=J[S.K],a=J[S.A],he=J[S.He],to=J[S.T];const Mq=M*T.leg*1.12,Mc=M*T.calf*1.1,zH=zs(S.H),zK=zs(S.K),zA=zs(S.A);
  const rt=[[-.12,.074*zH,.082*zH],[.12,.082*zH,.088*zH],[.4,.072,.074],[.7,.056*zK,.056*zK],[.92,.046*zK,.046*zK],[1,.044*zK,.046*zK]];
  const rs=[[-.06,.044*zK,.046*zK],[.14,.04,.056],[.32,.036,.06],[.55,.03,.042],[.78,.025*zA,.03*zA],[.94,.022*zA,.024*zA],[1.02,.022*zA,.026*zA]];
  const Th=outline(h,k,d,rt,Mq,1),Sh=outline(k,a,d,rs,Mc,2),ft=footPts(a,he,to,M);
  part(ctx,Th,t.base,[[[[-.3,-.012],[1.2,-.012],[1.2,-.3],[-.3,-.3]],t.d1],[[[.1,.09],[.52,.085],[.58,.03],[.14,.02]],t.lt],[[[.6,.0],[1.1,.01],[1.1,-.1],[.7,-.1]],t.d2],[[[.8,.08],[1.1,.07],[1.1,.02],[.9,.02]],t.d1]]);
  part(ctx,Sh,t.base,[[[[-.2,-.0],[1.2,-.0],[1.2,-.3],[-.2,-.3]],t.d1],[[[.08,-.0],[.46,-.01],[.52,-.07],[.14,-.07]],t.d2],[[[.12,.045],[.8,.028],[.8,.012],[.12,.014]],t.lt]]);
  /* foot: sole shadow + toes */{const fo=footPts(a,he,to,M);fillSp(ctx,fo.pts,t.base);ctx.save();ctx.beginPath();spl(ctx,fo.pts);ctx.clip();fillPoly(ctx,[fo.Q(-.1,-.05),fo.Q(1.1,-.05),fo.Q(1.1,.045),fo.Q(-.1,.06)],t.d1);fillPoly(ctx,[fo.Q(.8,.0),fo.Q(1.1,.0),fo.Q(1.1,.16),fo.Q(.84,.16)],t.lt);for(let i=0;i<4;i++){const u=.82+i*.05;ctx.strokeStyle=t.d1;ctx.lineWidth=B.H*.0016;ctx.beginPath();ctx.moveTo(fo.Q(u,.0).x,fo.Q(u,.0).y);ctx.lineTo(fo.Q(u,.1).x,fo.Q(u,.1).y);ctx.stroke()}ctx.restore()}
  if(sleeve)shortsLeg(ctx,B,h,k,d,M,far,o)}
/* trunks: one sleeve per thigh, black with a darker panel, white diagonal stripes and a claw logo in the accent colour */
function shortsLeg(ctx,B,h,k,d,M,far,o){const lk=B.look,col=far?shade(lk.shorts||'#222226',-.12):(lk.shorts||'#222226'),acc=lk.accent||'#f2f2f2';const rows=[[-.14,.09,.092],[.2,.088,.09],[.5,.082,.084],[.56,.08,.082]];const S=outline(h,k,d,rows,M,0);
  part(ctx,S,col,[[[[-.3,-.0],[.7,-.0],[.7,-.3],[-.3,-.3]],shade(col,-.14)],[[[.1,.1],[.4,.1],[.5,.0],[.2,.0]],shade(col,.05)]]);
  if(far)return;const Q=S.Q;ctx.save();ctx.beginPath();spl(ctx,S.pts);ctx.clip();
  fillPoly(ctx,[Q(.08,.095),Q(.15,.095),Q(.42,.01),Q(.35,.01)].map(p=>p),acc);fillPoly(ctx,[Q(.2,.095),Q(.25,.095),Q(.46,.03),Q(.41,.03)],acc);
  /* claw logo */{ctx.fillStyle=lk.logo||'#7ed321';for(let i=0;i<3;i++){const u=.28+i*.05;fillPoly(ctx,[Q(u,.0),Q(u+.025,.0),Q(u+.045,-.06),Q(u+.02,-.07)],lk.logo||'#7ed321')}}
  ctx.restore()}
/* trunk: neck, chest, waist, pelvis */
function trunk(B,J,H,d,M,T){const sp=[J.hip,J.mid,J.sh,J.nk];const segL=[0];for(let i=1;i<4;i++)segL.push(segL[i-1]+Math.hypot(sp[i].x-sp[i-1].x,sp[i].y-sp[i-1].y));const TL=segL[3]||1;
  const at=s=>{const Lg=s*TL;let i=1;while(i<3&&segL[i]<Lg)i++;const a=sp[i-1],b=sp[i],k=(Lg-segL[i-1])/((segL[i]-segL[i-1])||1);const tx=b.x-a.x,ty=b.y-a.y,l=Math.hypot(tx,ty)||1;return{x:a.x+tx*k,y:a.y+ty*k,nx:ty/l*d,ny:-tx/l*d}};
  const pt=(s,w)=>{const c=at(s);return{x:c.x+c.nx*w*M/.94,y:c.y+c.ny*w*M/.94}};const bel=T.belly*.045,ch=T.chest,nk=T.neck*.74;
  const front=[[-.16,.062],[-.08,.074],[.04,.078+bel*.3],[.18,.072+bel*.8],[.32,.07+bel],[.46,.072+bel*.6],[.58,.082],[.68,.094*ch],[.78,.1*ch],[.87,.09*ch],[.94,.06],[1.0,.044*nk],[1.12,.042*nk],[1.24,.042*nk]];
  const back=[[-.16,.082],[-.08,.1],[.04,.108],[.16,.082],[.28,.064+bel*.2],[.42,.066],[.56,.078],[.68,.09],[.78,.1*ch],[.88,.09],[.95,.066],[1.0,.054*nk],[1.12,.05*nk],[1.24,.05*nk]];
  const pts=front.map(([s,w])=>pt(s,w)).concat([pt(1.3,0)],back.map(([s,w])=>pt(s,-w)).reverse(),[pt(-.2,-.03),pt(-.2,.03)]);return{pts,pt}}
function trunkDraw(ctx,B,J,H,d,M,T,o){const lk=B.look,t=tones(lk,false),tr=trunk(B,J,H,d,M,T),pt=tr.pt;
  ctx.fillStyle=t.base;ctx.beginPath();spl(ctx,tr.pts);ctx.fill();ctx.save();ctx.beginPath();spl(ctx,tr.pts);ctx.clip();
  const P=(arr,col)=>fillPoly(ctx,arr.map(([s,w])=>pt(s,w)),col);
  P([[-.3,-.0],[1.4,-.0],[1.4,-.3],[-.3,-.3]],t.d1);/* back half in shade */
  P([[.9,-.02],[1.3,-.01],[1.3,-.2],[.95,-.1]],t.d2);/* trapezius / neck shadow */
  P([[.62,.14],[.82,.14],[.92,.1],[.92,.02],[.78,.0],[.64,.04]],t.lt);/* pec */
  P([[.58,.1],[.1,.1],[.1,-.3],[.5,-.3],[.6,0]],t.d1);/* lower ribs / oblique plane */
  P([[.4,.1],[.2,.1],[.2,.04],[.4,.06]],t.lt);/* abs */
  ctx.restore();
  /* tattoo text */if(lk.tatText&&T){const c=pt(.86,.0),q=pt(.86,.09),o2=pt(.86,-.05);let dx=q.x-o2.x,dy=q.y-o2.y;if(dx<0){dx=-dx;dy=-dy}const a=Math.atan2(dy,dx);ctx.save();ctx.translate(c.x,c.y);ctx.rotate(a);ctx.scale(1,-1);ctx.fillStyle='rgba(30,22,26,.78)';ctx.font=`italic ${H*.0125}px "Segoe Script","Snell Roundhand","Brush Script MT",cursive`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(lk.tatText[0],0,0);ctx.font=`italic ${H*.0085}px "Segoe Script","Brush Script MT",cursive`;ctx.fillText(lk.tatText[1],H*.012,H*.0105);ctx.restore()}
  else if(lk.tat&&/c/.test(lk.tat)){ctx.save();ctx.globalAlpha=.45;fillPoly(ctx,[pt(.86,.06),pt(.8,.09),pt(.72,.07),pt(.74,.03),pt(.82,.02)],'#10121a');ctx.restore()}
  return tr}
function pelvisDraw(ctx,B,J,H,d,M,T,o){const lk=B.look,col=lk.shorts||'#222226',acc=lk.accent||'#f2f2f2',hip=J.hip,mid=J.mid,ta=B.ang&&B.ang.ta||0;const n={x:d*Math.cos(ta),y:-Math.sin(ta)};const mixp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});const Pp=(c,f)=>({x:c.x+n.x*f*M/.94,y:c.y+n.y*f*M/.94});
  const top=mixp(hip,mid,.38),low=mixp(hip,mid,-.45);const bel=T.belly*.045;const wf=.086+bel,wb=.125;
  fillSp(ctx,[Pp(top,wf),Pp(top,-wb),Pp(hip,-wb*1.08),Pp(low,-.1),Pp(low,.09),Pp(hip,wf*1.04)],col);
  /* waistband with the mark */const t2=mixp(hip,mid,.3);fillPoly(ctx,[Pp(top,wf),Pp(top,-wb),Pp(t2,-wb*1.02),Pp(t2,wf*1.01)],shade(col,-.16));
  {const c=mixp(top,t2,.5),fp=Pp(c,wf*.5);let dx=Pp(c,wf).x-Pp(c,-wb).x,dy=Pp(c,wf).y-Pp(c,-wb).y;const a=Math.atan2(dy,dx);ctx.save();ctx.translate(fp.x,fp.y);ctx.rotate(a-Math.PI/2);if(Math.cos(a-Math.PI/2)<0)ctx.rotate(Math.PI);ctx.scale(1,-1);ctx.fillStyle=acc;ctx.font=`900 ${Math.hypot(top.x-t2.x,top.y-t2.y)*.9}px "Arial Black",Impact,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('UFC',0,0);ctx.restore()}}

/* head: flat skin, hair cap, brow, eye, nose wedge, beard, ear */
function headDraw(ctx,B,J,H,d,T,o){const lk=B.look,t=tones(lk,false),r=.074*H;ctx.save();ctx.translate(J.hd.x,J.hd.y+.012*H);ctx.rotate(-(B.ang&&B.ang.hd||0)*.9);ctx.scale(d*r,r);ctx.translate(.14,0);
  const P=(x,y)=>({x,y});const nl=T.nose,jw=T.jaw;
  const out=[P(-.62,-.5),P(-.93,-.18),P(-1.02,.34),P(-.9,.8),P(-.48,1.12),P(.14,1.2),P(.62,1.06),P(.86,.76),P(.92,.54),P(.97,.34),P(.9,.2),P(.94,.08),P(1.0,-.02),P(1.08+nl*.1,-.14),P(1.04+nl*.1,-.22),P(.96,-.26),P(.95,-.32),P(.99,-.38),P(.93,-.44),P(.98,-.5),P(.92,-.62),P(.94+T.chin*.1,-.76),P(.86+T.chin*.08,-.92),P(.56,-.98),P(.2,-.88),P(-.14,-.7-jw*.06),P(-.42,-.54)];
  fillSp(ctx,out,t.base);ctx.save();ctx.beginPath();spl(ctx,out);ctx.clip();
  fillPoly(ctx,[P(-.9,-.1),P(-.3,-.6),P(.1,-.78),P(.3,-.96),P(-1.2,-1),P(-1.2,-.1)],t.d1);/* under-jaw / neck shadow */
  fillPoly(ctx,[P(.3,.0),P(.7,-.1),P(.62,-.5),P(.3,-.4)],t.d1);/* cheek plane */
  fillPoly(ctx,[P(.55,.5),P(.95,.46),P(.93,.3),P(.55,.28)],t.lt);/* brow / temple light */
  ctx.restore();
  /* ear */fillSp(ctx,[P(-.42,.2),P(-.1,.26),P(-.02,0),P(-.1,-.3),P(-.34,-.34),P(-.46,-.04)],t.d1);fillSp(ctx,[P(-.32,.12),P(-.14,.14),P(-.12,-.12),P(-.28,-.16)],t.d2);
  /* eye + brow */{const ex=.74,ey=.14;fillPoly(ctx,[P(ex-.16,ey),P(ex-.02,ey+.09),P(ex+.16,ey+.02),P(ex+.1,ey-.06),P(ex-.06,ey-.06)],'#f1ece2');fillSp(ctx,[P(ex+.02,ey+.07),P(ex+.14,ey+.04),P(ex+.12,ey-.05),P(ex+.02,ey-.05)],'#1a1210');
    const hc=lk.hair||'#1b1310';fillPoly(ctx,[P(ex-.22,ey+.17),P(ex+.2,ey+.24),P(ex+.26,ey+.17),P(ex+.2,ey+.12),P(ex-.16,ey+.1)],shade(hc,-.1))}
  fillPoly(ctx,[P(.96,-.43),P(.78,-.4),P(.8,-.43),P(.95,-.46)],shade(t.base,-.45));/* mouth */
  fillPoly(ctx,[P(1.0,-.04),P(1.1,-.15),P(1.0,-.22)].map(p=>({x:p.x-.14,y:p.y+.03})),t.d1);/* nostril wing */
  /* hair */{const hc=lk.hair||'#1b1310',hs=lk.hs||'short';if(hs!=='bald'){const th=hs==='buzz'?0:.06;const cap=[P(.86,.58),P(.8,.94+th*.3),P(.36,1.15+th*.3),P(-.3,1.15+th*.3),P(-.9,.94),P(-1.06,.46),P(-1.04,-.1),P(-.7,-.32),P(-.52,.0),P(-.4,.34),P(.1,.46),P(.56,.52)];
      if(hs==='buzz'){ctx.globalAlpha=.6;fillSp(ctx,cap,hc);ctx.globalAlpha=1}else if(hs==='fade'){ctx.globalAlpha=.45;fillSp(ctx,cap,hc);ctx.globalAlpha=1;fillSp(ctx,[P(.76,.7),P(.4,1.22),P(-.3,1.2),P(-.84,.98),P(-.74,.66),P(-.2,.8)],hc)}else fillSp(ctx,cap,hc)}}
  /* beard */{const bd=lk.bd||(lk.beard?'full':null),hc=lk.hair||'#1b1310',bc=shade(hc,-.2);if(bd==='full'){fillSp(ctx,[P(-.06,.34),P(.18,.2),P(.42,.02),P(.62,-.1),P(.8,-.22),P(.86,-.34),P(.8,-.46),P(.84,-.58),P(.92,-.64),P(1.04,-.78),P(1.06,-1.0),P(.88,-1.2),P(.5,-1.2),P(.1,-1.0),P(-.1,-.8),P(-.12,-.3)],bc);fillPoly(ctx,[P(.97,-.28),P(1.05,-.34),P(1.0,-.4),P(.88,-.38),P(.8,-.34)],bc)}
    else if(bd==='stub'){ctx.globalAlpha=.32;fillSp(ctx,[P(-.1,-.05),P(.3,-.3),P(.85,-.45),P(.95,-.9),P(.5,-1.0),P(-.1,-.75)],bc);ctx.globalAlpha=1}
    else if(bd==='goatee'||bd==='chin'){fillSp(ctx,[P(.56,-.6),P(.62,-1.06),P(.96,-1.04),P(1.06,-.62),P(1.04,-.42),P(.84,-.4),P(.84,-.47),P(.98,-.48),P(.96,-.58)],bc)}
    else if(bd==='must'){fillPoly(ctx,[P(.8,-.37),P(1.05,-.35),P(1.03,-.46),P(.82,-.45)],bc)}}
  ctx.restore()}

FL.draw=function(B,ctx,o){o=o||{};const J=B.J,H=B.H,lk=B.look,d=B.d||1;if(!J.hd)return;const M=H*(B.W||1)*.86*.86,T=traits(B);
  const nearLead=(d>0)===(B.stance>0);const lead={S:'lS',E:'lE',W:'lW',G:'lG',H:'lH',K:'lK',A:'lA',He:'lHe',T:'lT'},rear={S:'rS',E:'rE',W:'rW',G:'rG',H:'rH',K:'rK',A:'rA',He:'rHe',T:'rT'};
  const N=nearLead?lead:rear,F=nearLead?rear:lead;const ON=o.only?(k=>o.only.indexOf(k)>=0):null;const Z=B._zJ||{},zs=k=>clamp(1+(Z[k]||0)*2,.65,1.7);
  const arm=(S,far)=>armDraw(ctx,B,S,J,d,M,T,far,zs,o),leg=(S,far)=>legDraw(ctx,B,S,J,d,M,T,far,zs,o,true);
  if(!o.noShadow&&!o.onlyArm&&o.part!=='far'&&(!ON||ON('torso'))){ctx.save();ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();{let x0=1e9,x1=-1e9;for(const k in J){x0=Math.min(x0,J[k].x);x1=Math.max(x1,J[k].x)}const sh=Math.min(Math.max(.16*H,(x1-x0)/2+.05*H),.42*H);ctx.ellipse((x0+x1)/2,0,sh,.032*H,0,0,Math.PI*2)}ctx.fill();ctx.restore()}
  ctx.save();
  const torso=()=>trunkDraw(ctx,B,J,H,d,M*1.42,T,o),pelvis=()=>pelvisDraw(ctx,B,J,H,d,M,T,o),head=()=>headDraw(ctx,B,J,H,d,T,o);
  if(o.onlyArm)arm(N,false);else if(o.part==='far')arm(F,true);
  else if(ON){if(ON('farArm'))arm(F,true);if(ON('farLeg'))leg(F,true);if(ON('torso'))torso();if(ON('nearLeg'))leg(N,false);if(ON('shorts'))pelvis();if(ON('head'))head();if(ON('nearArm'))arm(N,false)}
  else{if(o.part!=='body')arm(F,true);leg(F,true);torso();leg(N,false);pelvis();head();if(o.part!=='body')arm(N,false)}
  ctx.restore()};
})();
