/* ===== Detail.js : per-fighter detailed vector body =====
   Every fighter owns a PROFILE (face geometry, eyes/brows/nose/lips/jaw/ears, scars, wrinkles, hair detail,
   tattoo layers and body-part proportions). The same parametric part library (head, torso, arm, hand, leg,
   foot) is drawn for everybody, but each part is scaled / shifted / re-shaped by that fighter's profile, so no
   two fighters share a face or a body.  Profiles are generated from the fighter's name (unique, stable) and
   overridden by hand-tuned entries (CURATED) where the real fighter's features are known.
   Hooks are called from FlatStyle.js (headFlat, torsoFlat, arm, leg, foot). */
(function(){
if(typeof Body==='undefined'||!window.FSX)return;
const X=window.FSX,poly=X.poly,rpath=X.rpath;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const DT=window.DETAIL={on:true};

/* ---------- seeded random ---------- */
function rng(seed){let h=2166136261;const s=String(seed);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}let a=h>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

/* ---------- hand-tuned fighters (approximate, from public photos; everything else is generated) ---------- */
const CURATED={
 'Cain Velasquez':{f:{nl:.55,nb:.35,nw:.78,nf:.55,np:.42,br:.78,bt:.85,jw:.9,ck:.72,es:.92,ed:.75,lu:.5,ll:.55,ch:.62,cp:.5,fs:.03,ear:.9,nt:.9,ic:'#2a1a10',ag:.3},sc:[],tat:[{on:'shoulder',kind:'tribal',seed:'cain-shoulder',s:1.15},{on:'chest',kind:'text',text:'Brown Pride',size:1,curve:-.14}],bp:{pec:1.1,delt:1.15,abs:.8,vasc:.4,lat:1.1}},
 'Brock Lesnar':{f:{nl:.5,nb:.5,nw:.62,br:.82,bt:.8,jw:1,ck:.6,es:.78,ed:.9,lu:.3,ll:.4,ch:.75,cp:.55,nt:1,ic:'#4a6a8a',ag:.45},sc:[],bp:{arm:1.12,leg:1.06,torso:1.08,delt:1.25,pec:1.2,trap:1.3,abs:.5,vasc:.5}},
 'Mark Hunt':{f:{nl:.45,nb:.2,nw:.95,nf:.6,np:.3,br:.8,bt:.9,jw:.85,ck:.6,es:.82,ed:.8,lu:.7,ll:.75,ch:.6,cp:.4,nt:.95,ag:.7,ic:'#2a1a10'},tat:[{on:'sleeve',kind:'polynesian',seed:'hunt-near',side:'near'},{on:'sleeve',kind:'polynesian',seed:'hunt-far',side:'far'},{on:'shoulder',kind:'tribal',seed:'hunt-sh',s:1}],bp:{abs:.1,arm:1.1}},
 'Fedor Emelianenko':{f:{nl:.52,nb:.5,nw:.62,np:.45,br:.5,bt:.5,jw:.62,ck:.58,es:1.02,ed:.4,lu:.35,ll:.4,ch:.4,cp:.35,ic:'#7aa0c4',ag:.55},bp:{abs:.2,vasc:.3,pec:.9}},
 'Francis Ngannou':{f:{nl:.55,nb:.4,nw:.7,br:.85,bt:.8,jw:.95,ck:.78,es:.9,ed:.85,lu:.6,ll:.7,ch:.7,cp:.6,nt:1,ic:'#1d120b'},bp:{arm:1.15,leg:1.08,torso:1.1,delt:1.3,pec:1.3,abs:.9,vasc:.6,lat:1.2,trap:1.3}},
 'Conor McGregor':{f:{nl:.7,nb:.62,nw:.35,np:.7,nu:.25,br:.68,bt:.9,jw:.5,ck:.55,es:.92,ed:.65,lu:.35,ll:.45,ch:.5,cp:.48,nt:.6,ic:'#3a6a9a',ag:.35},bp:{abs:.9,vasc:.7}},
 'Khabib Nurmagomedov':{f:{nl:.55,nb:.5,nw:.7,np:.42,br:.78,bt:1,jw:.8,ck:.6,es:.88,ed:.8,lu:.4,ll:.45,ch:.55,cp:.5,ear:.7,nt:.95,ic:'#2a1a10'},bp:{torso:1.04,abs:.7}},
 'Derrick Lewis':{f:{nl:.5,nb:.35,nw:.85,nf:.4,br:.7,bt:.8,jw:.95,ck:.55,es:.85,ed:.75,lu:.6,ll:.7,ch:.8,cp:.4,nt:1.1,ag:.5},bp:{arm:1.1,torso:1.1,abs:0,delt:1.1}},
 'Jon Jones':{look:{skin:'#9c6446',hair:'#241a16',hs:'buzz',bd:'jj',beard:true,shorts:'#262626',trunk:{gold:'#c9a24a'},glove:'#151515'},
   f:{nl:.6,nb:.55,nw:.55,np:.55,nu:.1,br:.85,bt:.95,ba:.2,fr:.95,jw:.7,ck:.7,es:.9,ed:.85,et:.2,lh:.55,eb:.5,lu:.5,ll:.55,ch:.55,cp:.6,nt:.85,ear:.95,eo:.1,ic:'#2a1a10',ag:.25,fs:.02,fh:.55,cw:.02},
   sc:[],tat:[{on:'chest',kind:'jj-script'}],bp:{head:1.12,arm:1.0,leg:1.0,torso:.98,hand:1.0,delt:1.1,bic:1.1,tri:1.1,fore:1.1,quad:1.15,calf:1.1,pec:1.1,abs:.85,vasc:.7,lat:1.15,rib:.6}}
};

/* ---------- face / body profile generation ---------- */
const IRIS=['#2a1a10','#3a2412','#4a2e18','#5a3a1e','#6b4a2a','#7a8a5a','#5a7a9a','#7aa0c4','#8a9a9a'];
function prof(B){if(B._dp)return B._dp;const lk=B.look,name=lk.name||'x';const R=rng(name+'~face');const r=(a,b)=>a+(b-a)*R();
  const F=(typeof faceOf==='function')?faceOf(B):{};const C=CURATED[name]||{};const cf=C.f||{};
  const f={ /* geometry, all roughly 0..1 unless noted */
   fs:r(-.03,.08),            /* forehead lean (+ backward) */
   fh:.3+(F.fh||R()*.5),      /* forehead height */
   br:F.br!=null?F.br:r(.3,.8),   /* brow ridge */
   bt:r(.35,.9),              /* eyebrow thickness */
   ba:r(.1,.9),               /* eyebrow arch */
   es:r(.82,1.12),            /* eye size */
   ed:r(.3,.9),               /* eye depth (socket) */
   et:r(-.4,.5),              /* eye tilt */
   lh:r(0,1),                 /* upper-lid heaviness (hooded) */
   eb:r(0,1),                 /* eye bags */
   ic:IRIS[Math.floor(Math.pow(R(),1.7)*IRIS.length)],
   nl:F.n!=null?F.n:r(.35,.8),   /* nose length */
   nb:r(.2,.8),               /* bridge height */
   nw:r(.25,.9),              /* nostril / ala width */
   nh:F.nh||0,                /* dorsal hump */
   nf:F.nf||0,                /* flattened / broken */
   np:r(.3,.7),               /* tip projection */
   nu:r(-.2,.45),             /* tip upturn */
   lu:r(.25,.75),ll:r(.3,.8), /* lip fullness */
   ml:r(.7,1.15),             /* mouth width */
   pd:r(.3,.8),               /* philtrum depth */
   cp:r(.25,.75),ch:F.ch!=null?F.ch:r(.3,.7),/* chin projection / height */
   cl:R()<.12?r(.3,1):0,      /* chin cleft */
   jw:F.jw!=null?F.jw:r(.3,.8),ja:r(.2,.8),/* jaw width / angle */
   ck:F.ck!=null?F.ck:r(.3,.75),/* cheekbone */
   ear:r(.65,1.1),eo:r(.0,.5),/* ear size / protrusion */
   nt:r(.7,1.05),             /* neck thickness */
   cw:r(-.03,.05),            /* cranium width */
   fr:r(0,.45),               /* frown */
   ag:r(.1,.9)                /* age lines */
  };
  Object.assign(f,cf);
  /* scars: veterans carry them; one or two per fighter at most */
  const sc=C.sc||[];if(!C.sc){const n=R()<.38?(R()<.3?2:1):0;const spots=['brow','brow','nose','cheek','lip','chin','fore'];for(let i=0;i<n;i++)sc.push({at:spots[Math.floor(R()*spots.length)],len:r(.6,1.2),ang:r(-.5,.5)})}
  const fr=R()<.3?r(.1,.4):0;/* freckles */
  B._dp={f,sc,fr,rs:name};return B._dp}

/* body-part proportions */
if(typeof lookFor==='function'){const lf0=lookFor;window.lookFor=function(f){const L=lf0.apply(this,arguments);const C=CURATED[f&&f.n];if(C&&C.look)Object.assign(L,C.look);if(L)L.name=L.name||f.n;return L}}
DT.bp=function(B){if(B._bpp)return B._bpp;const lk=B.look,name=lk.name||'x',R=rng(name+'~body'),r=(a,b)=>a+(b-a)*R();const C=(CURATED[name]||{}).bp||{};
  const belly=lk.belly||lk.body==='belly'?1:lk.body==='soft'?.5:0;
  const bp={arm:r(.93,1.08),leg:r(.94,1.06),torso:r(.96,1.05),hand:r(.94,1.1),foot:r(.94,1.08),
   delt:r(.85,1.15),bic:r(.8,1.2),tri:r(.8,1.2),fore:r(.85,1.2),quad:r(.85,1.2),calf:r(.8,1.25),pec:r(.85,1.2),lat:r(.85,1.2),trap:r(.8,1.25),
   abs:belly>0?0:r(.35,1),vasc:r(.1,.8),rib:r(.2,.8),belly};
  Object.assign(bp,C);B._bpp=bp;return bp};

/* ---------- ink ---------- */
const inkOf=(skin)=>{try{const[rr,gg,bb]=rgbOf(skin);const l=(rr+gg+bb)/3;return l<110?'rgba(18,22,32,.42)':'rgba(24,30,46,.66)'}catch(e){return'rgba(24,30,46,.6)'}};
/* generic tattoo geometry in a unit square: u along the part, v across (-1 back .. +1 front) */
function tribalShapes(seed,n){const R=rng(seed),out=[];for(let i=0;i<n;i++){const u0=R(),v0=R()*2-1,L=.18+R()*.34,w=.05+R()*.07,a=R()*Math.PI*2,curl=(R()-.5)*1.4;
  const pts=[];for(let k=0;k<=8;k++){const t=k/8,aa=a+curl*t,x=u0+Math.cos(aa)*L*t,y=v0+Math.sin(aa)*L*t,ww=w*(1-t)*(1+.5*Math.sin(t*3));pts.push([x,y,ww,aa])}out.push(pts)}return out}
function drawThorns(ctx,P,sh,col){/* P(u,v) -> world */ctx.fillStyle=col;for(const pts of sh){const A=[],Bk=[];for(const[x,y,w,a]of pts){const nx=-Math.sin(a)*w,ny=Math.cos(a)*w;A.push(P(x+nx,y+ny));Bk.push(P(x-nx,y-ny))}ctx.beginPath();A.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));Bk.reverse().forEach(q=>ctx.lineTo(q.x,q.y));ctx.closePath();ctx.fill()}}
function drawPoly(ctx,P,col,seed){/* polynesian-style band pattern over the part: rows of teeth, spirals, bars */const R=rng(seed);ctx.fillStyle=col;ctx.strokeStyle=col;
  const rows=6+Math.floor(R()*3);for(let i=0;i<rows;i++){const u=.04+i*(.9/rows),h=.9/rows*.8;const kind=Math.floor(R()*4);
    if(kind===0){const n=5;for(let k=0;k<n;k++){const v0=-1+k*(2/n);const a=P(u,v0),b=P(u+h,v0+1/n),c=P(u,v0+2/n);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.closePath();ctx.fill()}}
    else if(kind===1){const a=P(u,-1),b=P(u+h*.4,-1),c=P(u+h*.4,1),d=P(u,1);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.closePath();ctx.fill()}
    else if(kind===2){for(let k=0;k<3;k++){const c=P(u+h*.5,-.6+k*.6);const rr=.5*Math.hypot(P(u,0).x-P(u+h,0).x,P(u,0).y-P(u+h,0).y);ctx.lineWidth=rr*.28;ctx.beginPath();ctx.arc(c.x,c.y,rr*.7,0,Math.PI*1.7);ctx.stroke()}}
    else{for(let k=0;k<4;k++){const v=-.9+k*.5;const a=P(u,v),b=P(u+h,v+.22),c=P(u,v+.22);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.closePath();ctx.fill()}}}}
function drawText(ctx,P,txt,size,col,curve){ctx.save();ctx.fillStyle=col;const p0=P(.5,0),p1=P(.5+.1,0),a=Math.atan2(p1.y-p0.y,p1.x-p0.x);ctx.translate(p0.x,p0.y);ctx.rotate(a);
  ctx.font=`bold ${size}px "Old English Text MT","UnifrakturCook",Georgia,serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.scale(1,-1);ctx.rotate(curve||0);ctx.fillText(txt,0,0);ctx.restore()}

/* auto designs for fighters with the old tattoo flags (c chest, s sleeve, b back), unique per fighter */
function tattooPlan(B){if(B._tp)return B._tp;const lk=B.look,name=lk.name||'x',C=CURATED[name];if(C&&C.tat)return B._tp=C.tat;const t=lk.tat||'';const R=rng(name+'~tat'),out=[];
  if(/c/.test(t))out.push({on:'chest',kind:R()<.55?'tribal':'text',text:['FAITH','WARRIOR','FAMILY','HONOR','BROTHER','PRIDE'][Math.floor(R()*6)],seed:name+'c',size:.8,curve:-.1});
  if(/s/.test(t))out.push({on:'sleeve',kind:R()<.5?'polynesian':'tribal',seed:name+'s',side:'near'},{on:'shoulder',kind:'tribal',seed:name+'sh',s:.9});
  if(/b/.test(t))out.push({on:'back',kind:'tribal',seed:name+'b',s:1});
  return B._tp=out}
DT.tattoos=true;

function drawTattoo(ctx,spec,P,scale,B,far){const skin=B.look.skin||'#d39b74';let col=inkOf(skin);if(far)col=col.replace(/[\d.]+\)$/,m=>(parseFloat(m)*.6)+')');ctx.save();ctx.globalAlpha=1;
  if(spec.kind==='tribal'){drawThorns(ctx,P,tribalShapes(spec.seed,9),col)}
  else if(spec.kind==='polynesian'){drawPoly(ctx,P,col,spec.seed)}
  else if(spec.kind==='text'){drawText(ctx,P,spec.text,scale*(spec.size||1),col,spec.curve)}
  ctx.restore()}

/* ===================== HEAD ===================== */
function spline(ctx,pts,close){const n=pts.length;ctx.moveTo(pts[0][0],pts[0][1]);const g=i=>pts[close?(i+n)%n:clamp(i,0,n-1)];const m=close?n:n-1;
  for(let i=0;i<m;i++){const p0=g(i-1),p1=g(i),p2=g(i+1),p3=g(i+2);ctx.bezierCurveTo(p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6,p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6,p2[0],p2[1])}if(close)ctx.closePath()}
const fillSp=(ctx,pts,col,close,al)=>{ctx.fillStyle=col;if(al!=null)ctx.globalAlpha=al;ctx.beginPath();spline(ctx,pts,close!==false);ctx.fill();if(al!=null)ctx.globalAlpha=1};
const strokeSp=(ctx,pts,col,w,al)=>{ctx.strokeStyle=col;ctx.lineWidth=w;ctx.lineCap='round';ctx.lineJoin='round';if(al!=null)ctx.globalAlpha=al;ctx.beginPath();spline(ctx,pts,false);ctx.stroke();if(al!=null)ctx.globalAlpha=1};
const mix=(a,b,t)=>typeof mixHex==='function'?mixHex(a,b,t):a;

DT.head=function(ctx,hd,nk,H,B,skin,d,ang){const lk=B.look;if(!lk||lk.ref||!DT.on)return false;const p=prof(B),f=p.f;const r=.066*H*((B._bp||DT.bp(B)).head||1);
  const red=B.redness||0;const sk0=red>0?mix(skin,'#b8433a',Math.min(.4,red*.45)):skin;const SK=t=>shade(sk0,t);
  ctx.save();ctx.translate(hd.x,hd.y);ctx.scale(d,1);ctx.rotate(-ang*.9);ctx.scale(r,r);
  const P=(pts,c,rr)=>{ctx.fillStyle=c;ctx.beginPath();rpath(ctx,pts.map(q=>({x:q[0],y:q[1]})),rr==null?.3:rr);ctx.fill()};
  /* ---- neck (thickness per fighter) ---- */
  const nt=f.nt;
  P([[-.66,-.3],[-.88-nt*.1,-1.0],[-1.0-nt*.12,-1.6],[.5,-1.62],[.42,-1.05],[.3,-.8],[.05,-.6]],SK(-.06));
  P([[.05,-.6],[.3,-.8],[.42,-1.05],[.5,-1.62],[.28,-1.62],[.18,-.9]],SK(-.16));
  P([[-.3,-.62],[-.05,-.68],[.32,-1.5],[.18,-1.52]],SK(-.12));
  /* ---- skull + face profile as one smooth outline ---- */
  const nl=f.nl,np=f.np,nbv=f.nb,hump=f.nh,fl=f.nf;
  const tipX=1.07+nl*.2+np*.06-fl*.1,tipY=-.1-nl*.07+f.nu*.05;
  const brX=.93+f.br*.07+f.fs,jy=-.78-f.ch*.12;
  const outline=[[-.58,-.5],[-.93,-.18],[-1.02-f.cw,.34],[-.9,.8],[-.48,1.1],[.14,1.18+(f.fh-.5)*.06],[.6,1.05],[.82+f.fs*.3,.78],[.9+f.fs,.54],
    [brX,.33],[.89+f.fs*.4,.19-f.ed*.02],[.93+nbv*.05-fl*.04,.07],[1.0+nbv*.05+hump*.07-fl*.06,-.02],[tipX-.03,tipY+.02],[tipX,tipY],[tipX-.03,tipY-.08-f.nu*.05],[.98,-.24-f.pd*.03],[.95,-.3-f.pd*.04],
    [.99+f.lu*.07,-.37],[.93,-.43],[.99+f.ll*.07,-.5],[.92,-.6],[.95+f.cp*.12,-.72-f.ch*.05],[.9+f.cp*.1,jy],[.62,jy-.05],[.22,jy+.04],[-.12,-.72+f.ja*.1-(f.jw-.5)*.1],[-.4,-.52]];
  p.outline=outline;ctx.fillStyle=SK(0);ctx.beginPath();spline(ctx,outline,true);ctx.fill();
  ctx.save();ctx.beginPath();spline(ctx,outline,true);ctx.clip();
  /* shading planes (clipped inside the head outline) */
  fillSp(ctx,[[.25,-.02],[.66,-.18],[.7,-.58],[.46,-.86],[.08,-.62]],SK(FS_SH),true,.55);/* cheek hollow */
  fillSp(ctx,[[-.34,-.6],[-.12,-.82],[.25,-.96],[.6,-1.02],[.95,-.9],[.7,-.8],[.2,-.78],[-.15,-.58]],SK(-.2),true,.7);/* jaw underside */
  fillSp(ctx,[[-.3,.1],[.05,.3],[.2,.0],[.0,-.45],[-.3,-.35]],SK(-.1),true,.35);/* temple / masseter */
  fillSp(ctx,[[.22+f.jw*.1,-.3],[.5,-.38],[.4,-.74],[.1,-.62]],SK(-.08),true,.28+f.jw*.28);/* masseter */
  /* cheekbone light + brow light + nose light */
  fillSp(ctx,[[.32,.06],[.72,.04],[.68,-.12],[.38,-.08]],SK(.1),true,.35+f.ck*.65);
  fillSp(ctx,[[.55,.46],[.93,.44],[.9,.32],[.55,.3]],SK(.09),true,.9);
  fillSp(ctx,[[.9,.04],[1.02,-.02],[1.05,-.08],[.95,.02]],SK(.14),true,.8);/* nose bridge light */
  fillSp(ctx,[[.2,.66],[.7,.7],[.84,.55],[.26,.5]],SK(.07),true,.7);/* forehead light */
  /* socket shadow (deep-set eyes) */
  fillSp(ctx,[[.52,.34],[.96,.3],[.92,.06],[.55,.04]],SK(-.22),true,.2+f.ed*.5);
  ctx.restore();
  /* ---- nostril wing, nostril, nasolabial fold ---- */
  {const w=f.nw;const ax=tipX-.2,ay=tipY-.06;P([[ax-.02,ay+.06],[ax+.14+w*.06,ay+.08],[ax+.17+w*.06,ay-.02],[ax+.08,ay-.1],[ax-.04,ay-.06]],SK(-.1),.14);
    P([[ax+.04,ay-.01],[ax+.15+w*.04,ay+.0],[ax+.14+w*.04,ay-.06],[ax+.05,ay-.07]],SK(-.55),.06);
    strokeSp(ctx,[[ax-.02,ay+.09],[ax-.14,ay-.06],[ax-.12,ay-.3],[ax-.02,ay-.44]],SK(-.3),.028,.45)}
  /* ---- lips ---- */
  {const lc=mix(sk0,'#8a3b34',.3),lc2=mix(sk0,'#9a423a',.34);const um=.99+f.lu*.07,lm=.99+f.ll*.07,ml=f.ml;
    fillSp(ctx,[[.98,-.3],[um+.03,-.34],[um,-.4],[.9,-.43],[.8-.1*ml,-.42],[.84,-.34]],lc,true);
    fillSp(ctx,[[.92,-.44],[lm+.02,-.5],[lm-.02,-.56-f.ll*.03],[.9,-.58],[.8-.1*ml,-.48]],mix(lc2,'#fff',.05),true);
    strokeSp(ctx,[[1.0,-.43],[.9,-.43],[.8-.1*ml,-.42]],SK(-.55),.026,.95);
    if(B.ko)fillSp(ctx,[[.84,-.41],[.97,-.41],[.95,-.5],[.86,-.5]],'#2a0d0d',true);
    strokeSp(ctx,[[.94,-.66],[.88,-.64],[.82,-.6]],SK(-.2),.02,.5);/* mentolabial fold */
    if(f.cl>.3)strokeSp(ctx,[[.94+f.cp*.1,-.82],[.92+f.cp*.1,-.95]],SK(-.25),.02,f.cl*.7)}
  /* ---- ear ---- */
  {const e=f.ear,ex=-.24,ey=.0;const cau=lk.cauli?1:0;fillSp(ctx,[[ex-.18*e,ey+.22*e],[ex+.12*e,ey+.28*e],[ex+.2*e,ey+.02],[ex+.14*e,ey-.28*e],[ex-.04*e,ey-.42*e-.05*cau],[ex-.2*e,ey-.2*e],[ex-.24*e,ey+.02]],SK(-.07),true);
    fillSp(ctx,[[ex-.1*e,ey+.14*e],[ex+.08*e,ey+.16*e],[ex+.1*e,ey-.04],[ex-.0,ey-.2*e],[ex-.12*e,ey-.1]],SK(-.2),true,.95);
    strokeSp(ctx,[[ex-.06*e,ey+.2*e],[ex+.12*e,ey+.12*e],[ex+.14*e,ey-.1*e],[ex+.06*e,ey-.3*e]],SK(.07),.024,.8);
    if(cau)fillSp(ctx,[[ex-.2,ey+.12],[ex+.14,ey+.22],[ex+.2,ey-.04],[ex-.0,ey-.3],[ex-.2,ey-.15]],SK(-.18),true,.85)}
  /* ---- eye ---- */
  {const sw=B.swell||0,ex=.74,ey=.14+((f.ed-.5)*.02),es=f.es;
    if(sw>.15){ctx.globalAlpha=Math.min(.75,sw*.6);P([[ex-.24,ey+.15],[ex+.22,ey+.16],[ex+.26,ey-.14],[ex-.22,ey-.16]],mix(skin,'#6a2a4a',.55),.2);ctx.globalAlpha=1}
    const lid=B.ko?1:Math.max(B.daze||0,sw>.7?.55:0);
    /* eye bags */
    if(f.eb>.35)strokeSp(ctx,[[ex-.14,ey-.1],[ex+.04,ey-.15],[ex+.2,ey-.1]],SK(-.2),.02,f.eb*.6);
    if(lid<1){const hh=.1*es*(1-lid*.8)*(sw>.5?.6:1)*(1-f.lh*.22);const wx=.15*es,tilt=f.et*.03;
      /* white of the eye */
      fillSp(ctx,[[ex-wx,ey-tilt],[ex-wx*.2,ey+hh],[ex+wx*.9,ey+hh*.3+tilt],[ex+wx,ey-.01+tilt],[ex+wx*.2,ey-hh*.7],[ex-wx*.5,ey-hh*.5]],'#f0ebe2',true);
      /* iris + pupil + light */
      ctx.save();ctx.beginPath();spline(ctx,[[ex-wx,ey-tilt],[ex-wx*.2,ey+hh],[ex+wx*.9,ey+hh*.3+tilt],[ex+wx,ey-.01+tilt],[ex+wx*.2,ey-hh*.7],[ex-wx*.5,ey-hh*.5]],true);ctx.clip();
      const ix=ex+wx*.45,iy=ey+hh*.04;ctx.fillStyle=f.ic;ctx.beginPath();ctx.arc(ix,iy,.075*es,0,7);ctx.fill();ctx.fillStyle=shade(f.ic,-.4);ctx.beginPath();ctx.arc(ix,iy,.045*es,0,7);ctx.fill();ctx.fillStyle='#0b0706';ctx.beginPath();ctx.arc(ix+.01,iy,.026*es,0,7);ctx.fill();ctx.fillStyle='#fff';ctx.globalAlpha=.85;ctx.beginPath();ctx.arc(ix-.022,iy+.026,.012,0,7);ctx.fill();ctx.globalAlpha=1;
      fillSp(ctx,[[ex-wx*1.1,ey+hh*1.4],[ex+wx*1.1,ey+hh*1.3],[ex+wx*1.1,ey+hh*.5],[ex-wx*1.1,ey+hh*.2]],'#1a0f0a',true,.28+f.lh*.18);/* upper-lid shadow */
      ctx.restore();
      /* lids + lashes + crease */
      strokeSp(ctx,[[ex-wx,ey-tilt],[ex-wx*.2,ey+hh],[ex+wx*.9,ey+hh*.3+tilt],[ex+wx*1.05,ey-.015+tilt]],'#120a06',.034,1);
      strokeSp(ctx,[[ex-wx*.9,ey-tilt*.5],[ex-wx*.5,ey-hh*.5],[ex+wx*.2,ey-hh*.7],[ex+wx*.9,ey-.005+tilt]],SK(-.45),.016,.7);
      strokeSp(ctx,[[ex-wx*.8,ey+hh*1.35],[ex,ey+hh*1.9-f.lh*.5*hh],[ex+wx,ey+hh*1.1]],SK(-.3),.018,.55);
      ctx.strokeStyle='#120a06';ctx.lineWidth=.014;ctx.lineCap='round';for(let i=0;i<4;i++){const x=ex+wx*(.1+i*.28),y=ey+hh*(.9-i*.18);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+.03,y+.05);ctx.stroke()}
      fillSp(ctx,[[ex-wx*1.05,ey-.01],[ex-wx*.8,ey+.02],[ex-wx*.7,ey-.03]],'#c47a70',true,.8)/* tear duct */}
    else strokeSp(ctx,[[ex-.14,ey+.01],[ex,ey-.025],[ex+.16,ey+.0]],'#150b07',.04,1);
    /* eyebrow: hair strokes inside a tapered body */
    const bc=lk.hs==='bald'||!lk.hair?'#2a1f17':shade(lk.hair,-.15);const bt=.05+f.bt*.08,ba=f.ba*.05,fr=(f.fr!=null?f.fr:F_fr(B))*.07;
    const bx0=ex-.24,bx1=ex+.26,by=ey+.19+fr*.3;
    fillSp(ctx,[[bx0,by-fr],[bx0+.2,by+.03+ba-fr*.5],[bx1-.08,by+.05+ba],[bx1,by+.0],[bx1-.08,by-bt*.7],[bx0+.24,by+.0-bt*.5],[bx0,by-bt-fr]],bc,true);
    ctx.strokeStyle=shade(bc,.2);ctx.lineWidth=.012;ctx.lineCap='round';for(let i=0;i<9;i++){const t=i/8,x=bx0+(bx1-bx0)*t,y=by+.012+Math.sin(t*3)*ba*.5;ctx.beginPath();ctx.moveTo(x,y-.03);ctx.lineTo(x+.04,y+.02);ctx.stroke()}}
  /* ---- skin detail: wrinkles, freckles, scars ---- */
  {const ag=f.ag;if(ag>.45){strokeSp(ctx,[[.28,.72],[.55,.76],[.8,.7]],SK(-.2),.016,(ag-.4)*.9);strokeSp(ctx,[[.3,.62],[.58,.65],[.8,.6]],SK(-.2),.014,(ag-.5)*.9)}
    if(ag>.6)strokeSp(ctx,[[.52,.1],[.6,.04],[.62,-.04]],SK(-.2),.014,(ag-.5)*.9);/* crow's feet */
    if(p.fr>0){ctx.fillStyle=SK(-.28);ctx.globalAlpha=.5;const R2=rng(p.rs+'fr');for(let i=0;i<26;i++){ctx.beginPath();ctx.arc(.25+R2()*.55,-.18+R2()*.35,.012+R2()*.01,0,7);ctx.fill()}ctx.globalAlpha=1}
    for(const s of p.sc){const C={brow:[.78,.35],nose:[.97,.0],cheek:[.55,-.1],lip:[.97,-.42],chin:[.9,-.78],fore:[.55,.72]}[s.at]||[.7,.3];
      ctx.save();ctx.translate(C[0],C[1]);ctx.rotate(s.ang);strokeSp(ctx,[[-.1*s.len,0],[.1*s.len,.01]],SK(-.18),.024,.8);strokeSp(ctx,[[-.1*s.len,.012],[.1*s.len,.022]],SK(.14),.012,.7);
      if(s.at==='brow'){ctx.fillStyle=SK(.06);ctx.globalAlpha=.9;ctx.fillRect(-.02,-.03,.04,.06);ctx.globalAlpha=1}ctx.restore()}}
  /* ---- hair + beard (shared styles, per-fighter hairline / strands) ---- */
  {const hc=lk.hair||'#16100b';X.hairFlat(ctx,r,lk,B,hc,P);hairStrands(ctx,B,hc,p);if(lk.bd==='jj'||lk.bd==='full')beardDetail(ctx,lk,hc,p,P,SK);else{X.beardFlat(lk,hc,P);if(lk.bd==='stub')stubble(ctx,lk,p)}}
  /* ---- headgear ---- */
  if(lk.headgear){const g=lk.headgear,gd=shade(g,-.22),gl=shade(g,.12);P([[-1.08,.22],[-.98,.86],[-.5,1.24],[.3,1.26],[.74,.98],[.9,.62],[.62,.5],[.1,.58],[-.45,.5],[-.7,.2]],g,.35);P([[.92,.66],[.6,.5],[.62,.4],[.94,.52]],gd,.3);P([[-.5,1.16],[.25,1.2],[.2,1.08],[-.45,1.05]],gl,.3);P([[-.55,.42],[.08,.46],[.2,-.4],[-.05,-.62],[-.5,-.5],[-.66,.0]],g,.4);P([[-.4,.25],[-.05,.27],[0,-.22],[-.32,-.3]],gd,.3);P([[.12,-.38],[.24,-.44],[.82,-.86],[.74,-.96]],gd,.2)}
  /* ---- cuts & blood (shared damage system) ---- */
  if(typeof CUTPOS!=='undefined')for(const c of B.cuts||[]){const q=CUTPOS[c.at];if(!q)continue;P([[q[0]-.1,q[1]+.06],[q[0]+.12,q[1]-.03],[q[0]+.12,q[1]-.06],[q[0]-.1,q[1]+.03]],'#5a0303');
    if(c.sev>.25){const L=.3+Math.min(2.2,c.sev*1.1);ctx.globalAlpha=.85;P([[q[0]-.07,q[1]],[q[0]+.08,q[1]],[q[0]+.03,q[1]-L],[q[0]-.02,q[1]-L*.9]],'#960808');ctx.globalAlpha=1}}
  if((B.cuts||[]).some(c=>c.at==='nose')||(B.redness||0)>.72){ctx.globalAlpha=.85;P([[.95,-.24],[1.01,-.26],[.94,-.7],[.88,-.7]],'#8c0608');ctx.globalAlpha=1}
  ctx.restore();return true};
const FS_SH=-.12;
function F_fr(B){const F=(typeof faceOf==='function')?faceOf(B):{};return F.fr||0}

/* full beard: cheek / jaw / chin / moustache masses that hug the jaw outline, crisp cheek line, hair-flow strokes */
function beardDetail(ctx,lk,hc,p,P,SK){const bc=lk.bd==='jj'?'#181514':shade(hc,-.35),R=rng(p.rs+'bd');
  const jaw=[[-.06,.32],[.16,.17],[.4,.0],[.6,-.1],[.78,-.22],[.86,-.34],[.8,-.46],[.84,-.58],[.92,-.62],[1.04,-.78],[1.08,-1.0],[.9,-1.2],[.5,-1.2],[.1,-1.0],[-.1,-.8],[-.12,-.3]];
  ctx.save();ctx.beginPath();spline(ctx,jaw,true);ctx.clip();
  ctx.fillStyle=bc;ctx.beginPath();spline(ctx,p.outline,true);ctx.fill();/* inside the face outline */
  ctx.strokeStyle=bc;ctx.lineWidth=.16;ctx.lineJoin='round';ctx.beginPath();spline(ctx,p.outline,true);ctx.stroke();/* + a fringe outside the jaw */
  ctx.restore();
  fillSp(ctx,[[.97,-.26],[1.06,-.32],[1.0,-.4],[.88,-.37],[.8,-.33]],bc,true);/* moustache */
  strokeSp(ctx,[[-.06,.34],[.16,.19],[.4,.01],[.62,-.09],[.78,-.21]],shade(bc,.25),.014,.55);/* cheek line */
  ctx.save();ctx.beginPath();spline(ctx,jaw,true);ctx.clip();ctx.strokeStyle=shade(bc,.3);ctx.lineWidth=.011;ctx.lineCap='round';ctx.globalAlpha=.45;
  for(let i=0;i<26;i++){const t=i/25,x=-.2+t*1.2,y=-.15-t*.15-R()*.7;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+.1,y-.16);ctx.stroke()}ctx.restore()}
function stubble(ctx,lk,p){const R=rng(p.rs+'stub');ctx.fillStyle='rgba(20,14,10,.5)';for(let i=0;i<70;i++){const x=-.35+R()*1.3,y=-1.0+R()*.85;ctx.beginPath();ctx.arc(x,y,.01,0,7);ctx.fill()}}
function hairStrands(ctx,B,hc,p){const hs=B.hs||'short';if(hs==='bald')return;const R=rng(p.rs+'hair');ctx.save();ctx.strokeStyle=shade(hc,.18);ctx.lineWidth=.012;ctx.lineCap='round';ctx.globalAlpha=.55;
  const n=hs==='buzz'?0:hs==='long'||hs==='curly'?26:16;for(let i=0;i<n;i++){const a=.1+R()*2.6,rr=.93+R()*.12;const x=Math.cos(a)*rr-.1,y=Math.sin(a)*rr+.2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-.08-R()*.1,y-.04-R()*.1);ctx.stroke()}
  if(hs==='buzz'){ctx.fillStyle=shade(hc,.3);ctx.globalAlpha=.3;for(let i=0;i<40;i++){const a=.2+R()*2.4,rr=.8+R()*.25;ctx.beginPath();ctx.arc(Math.cos(a)*rr-.1,Math.sin(a)*rr+.2,.01,0,7);ctx.fill()}}ctx.restore()}

/* ===================== FACETS (angular planes of light on every limb, like hand-painted low-poly) ===================== */
DT.facet=function(ctx,front,back,col,k){const n=front.length;if(n<3)return;k=k||1;const R=rng((DT.cur||'x')+'~f'+(DT.fc=(DT.fc||0)+1));
  const row=(A,t)=>{const x=t*(n-1),i=Math.min(n-2,Math.floor(x)),f=x-i;return{x:A[i].x+(A[i+1].x-A[i].x)*f,y:A[i].y+(A[i+1].y-A[i].y)*f}};
  ctx.save();ctx.beginPath();front.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));for(let i=n-1;i>=0;i--)ctx.lineTo(back[i].x,back[i].y);ctx.closePath();ctx.clip();
  const len=Math.hypot(front[n-1].x-front[0].x,front[n-1].y-front[0].y)||.1;const cnt=Math.round(10+len*40*k);
  for(let i=0;i<cnt;i++){const t=R(),v=R(),A=row(front,t),B=row(back,t);const cx=A.x+(B.x-A.x)*v,cy=A.y+(B.y-A.y)*v;const sz=len*(.07+R()*.1),a=R()*6.28;
    const lit=R()<.5;ctx.fillStyle=shade(col,(lit?1:-1)*(.04+R()*.06));ctx.globalAlpha=.7;ctx.beginPath();for(let j=0;j<3;j++){const aa=a+j*2.1+R()*.5;ctx.lineTo(cx+Math.cos(aa)*sz*(.6+R()*.6),cy+Math.sin(aa)*sz*(.6+R()*.6))}ctx.closePath();ctx.fill()}
  ctx.globalAlpha=1;ctx.restore()};

/* ===================== TORSO ===================== */
DT.torso=function(ctx,pt,M,sk,lk,B,d,H){if(!DT.on)return;const bp=DT.bp(B);const bel=bp.belly;const lean=bp.abs*(1-bel*.85);
  const L=(a,b,col,al)=>{ctx.strokeStyle=col;ctx.lineWidth=.0035*H;ctx.lineCap='round';ctx.globalAlpha=al;ctx.beginPath();const A=pt(a[0],a[1]),Bq=pt(b[0],b[1]);ctx.moveTo(A.x,A.y);ctx.lineTo(Bq.x,Bq.y);ctx.stroke();ctx.globalAlpha=1};
  const pe=bp.pec;
  /* trapezius + neck line + clavicle */
  poly(ctx,[pt(.94,-.01),pt(1,.0),pt(1,.034),pt(.95,.045)],sk.lt,.01);
  L([.9,.02],[.93,.075],sk.sh,.5);
  /* pec: near-side pec contour (hard lower edge) + sternal groove + nipple */
  poly(ctx,[pt(.81,.099*pe),pt(.75,.1*pe),pt(.7,.09*pe),pt(.69,.075*pe),pt(.76,.082*pe)],sk.sh,.02);
  {const n=pt(.77,.094*pe);ctx.fillStyle=shade(sk.base,-.34);ctx.globalAlpha=.8;ctx.beginPath();ctx.ellipse(n.x,n.y,.0045*H,.0036*H,0,0,7);ctx.fill();ctx.globalAlpha=1}
  /* serratus + ribs */
  for(let i=0;i<3;i++){const s=.66-i*.05;L([s,.062],[s-.025,.044],sk.sh,.35*bp.rib*(1-bel))}
  if(bp.rib>.5&&bel<.4)for(let i=0;i<3;i++){const s=.52+i*.05;L([s,-.02],[s-.02,-.05],sk.sh,.22)}
  /* abs: scalloped front edge + tendinous lines (count follows definition) */
  if(lean>.25){const rows=lean>.75?4:3;for(let i=0;i<rows;i++){const s=.56-i*.085;L([s,.076],[s,.045],sk.sh,.55*lean);poly(ctx,[pt(s-.01,.074),pt(s-.07,.073),pt(s-.07,.062),pt(s-.01,.063)],sk.lt,.01)}
    L([.6,.058],[.2,.054],sk.sh,.35*lean)}
  /* obliques + hip line */
  if(bel<.6)L([.34,.055],[.15,.068],sk.sh,.4);
  /* lats on the back edge */
  poly(ctx,[pt(.74,-.095*bp.lat),pt(.6,-.085*bp.lat),pt(.46,-.07),pt(.58,-.06)],sk.sh,.02);
  /* belly: soft fold under the pec / navel */
  if(bel>0){L([.4,.07],[.38,.05],sk.sh,.5);const n=pt(.34,.066+bel*.03);ctx.fillStyle=sk.sh;ctx.beginPath();ctx.arc(n.x,n.y,.0034*H,0,7);ctx.fill()}
  /* hair on the chest (older / hairy fighters) */
  /* tattoos */
  if(DT.tattoos){const plan=tattooPlan(B),I=Math.hypot(pt(.5,0).x-pt(.6,0).x,pt(.5,0).y-pt(.6,0).y);
    for(const t of plan){if(t.kind==='jj-script'){const c=pt(.85,.02),q=pt(.85,.095),o=pt(.85,-.045);let dx=q.x-o.x,dy=q.y-o.y;if(dx<0){dx=-dx;dy=-dy}const a=Math.atan2(dy,dx),inkc=inkOf(lk.skin||'#9c6446');
        ctx.save();ctx.translate(c.x,c.y);ctx.rotate(a);ctx.scale(1,-1);ctx.fillStyle=inkc;ctx.font=`italic ${H*.0125}px "Segoe Script","Snell Roundhand","Brush Script MT",cursive`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('Philippians',0,0);ctx.font=`italic ${H*.0085}px "Segoe Script","Brush Script MT",cursive`;ctx.fillText('4:13',H*.012,H*.0105);ctx.restore();continue}
      if(t.on==='chest'){const P=(u,v)=>pt(.93-u*.28,v*.095);drawTattoo(ctx,t,P,H*.011,B,false)}
      else if(t.on==='back'){const P=(u,v)=>pt(.85-u*.3,-.025-(v+1)*.04);drawTattoo(ctx,t,P,H*.011,B,false)}}}};

/* ===================== ARM ===================== */
DT.arm=function(ctx,a,e,w,d,M,C,B,isFar,frame){if(!DT.on)return;const bp=B._bp||DT.bp(B);const F1=frame(a,e,d),F2=frame(e,w,d);
  const P1=(t,v)=>({x:a.x+F1.ux*F1.L*t+F1.nx*v*M,y:a.y+F1.uy*F1.L*t+F1.ny*v*M}),P2=(t,v)=>({x:e.x+F2.ux*F2.L*t+F2.nx*v*M,y:e.y+F2.uy*F2.L*t+F2.ny*v*M});
  const S=(P,t0,v0,t1,v1,col,al)=>{ctx.strokeStyle=col;ctx.lineWidth=.0035*M;ctx.lineCap='round';ctx.globalAlpha=al;ctx.beginPath();const A=P(t0,v0),Bq=P(t1,v1);ctx.moveTo(A.x,A.y);ctx.quadraticCurveTo((A.x+Bq.x)/2+F1.nx*.004*M,(A.y+Bq.y)/2+F1.ny*.004*M,Bq.x,Bq.y);ctx.stroke();ctx.globalAlpha=1};
  const al=isFar?.7:1;
  /* deltoid heads (front / side / rear) + biceps / triceps separation */
  S(P1,.04,.04,.28,.012,C.s,.55*al*bp.delt/1.1);S(P1,.12,-.03,.34,-.005,C.s,.4*al);
  poly(ctx,[P1(.3,.05),P1(.5,.052),P1(.62,.04),P1(.38,.0)],isFar?C.b:shade(C.b,.045),.01);/* biceps peak (lit) */
  S(P1,.3,-.012,.78,-.012,C.s,.45*al*bp.tri/1.1);/* triceps long head groove */
  S(P1,.58,.032,.8,.02,C.s,.4*al);
  /* forearm: extensor line + flexor bulge */
  S(P2,.12,.005,.7,.0,C.s,.4*al);poly(ctx,[P2(.08,.035),P2(.28,.04),P2(.42,.03),P2(.2,.0)],isFar?C.b:shade(C.b,.04),.01);
  /* veins (lean, vascular fighters) */
  if(bp.vasc>.45&&!isFar){ctx.strokeStyle=shade(C.b,-.16);ctx.lineWidth=.003*M;ctx.globalAlpha=.4*bp.vasc;ctx.beginPath();const p0=P2(.1,.02),p1=P2(.4,.012),p2=P2(.75,.008);ctx.moveTo(p0.x,p0.y);ctx.quadraticCurveTo(p1.x,p1.y+.003*M,p2.x,p2.y);ctx.stroke();ctx.globalAlpha=1}
  /* tattoos on this arm */
  if(DT.tattoos){for(const t of tattooPlan(B)){if(t.on==='shoulder'&&!isFar){const P=(u,v)=>P1(.02+u*.5*(t.s||1),v*.05);drawTattoo(ctx,t,P,M*.05,B,isFar)}
    if(t.on==='sleeve'&&((t.side==='far')===isFar)){const P=(u,v)=>u<.5?P1(.05+u*1.9,v*.048):P2((u-.5)*1.9,v*.04);drawTattoo(ctx,t,P,M*.05,B,isFar)}}}};

/* ===================== LEG ===================== */
DT.leg=function(ctx,h,k,a,d,M,C,B,isFar,frame){if(!DT.on)return;const bp=B._bp||DT.bp(B);const F1=frame(h,k,d),F2=frame(k,a,d);
  const P1=(t,v)=>({x:h.x+F1.ux*F1.L*t+F1.nx*v*M,y:h.y+F1.uy*F1.L*t+F1.ny*v*M}),P2=(t,v)=>({x:k.x+F2.ux*F2.L*t+F2.nx*v*M,y:k.y+F2.uy*F2.L*t+F2.ny*v*M});
  const al=isFar?.65:1;const S=(P,t0,v0,t1,v1,col,o)=>{ctx.strokeStyle=col;ctx.lineWidth=.0035*M;ctx.lineCap='round';ctx.globalAlpha=o;ctx.beginPath();const A=P(t0,v0),Bq=P(t1,v1);ctx.moveTo(A.x,A.y);ctx.lineTo(Bq.x,Bq.y);ctx.stroke();ctx.globalAlpha=1};
  /* quad: sweep of the rectus femoris + teardrop (vastus medialis) above the knee, hamstring line behind */
  S(P1,.14,.02,.62,.034,C.s,.5*al*bp.quad/1.1);poly(ctx,[P1(.55,.045),P1(.82,.04),P1(.9,.02),P1(.68,.0)],isFar?C.b:shade(C.b,.045),.01);
  S(P1,.2,-.036,.8,-.026,C.s,.45*al);
  /* knee: patella, tendon */
  S(P2,-.02,.036,.12,.03,C.s,.5*al);
  /* shin: tibial ridge + calf split */
  S(P2,.1,.02,.82,.01,C.s,.35*al);S(P2,.1,-.03,.5,-.04,C.s,.45*al*bp.calf/1.1);
  if(!isFar)poly(ctx,[P2(.14,-.05),P2(.3,-.056),P2(.44,-.045),P2(.28,-.02)],shade(C.b,.04),.01);
  if(DT.tattoos){for(const t of tattooPlan(B)){if(t.on==='thigh'&&!isFar){const P=(u,v)=>P1(.2+u*.5,v*.06);drawTattoo(ctx,t,P,M*.05,B,isFar)}}}};

/* ===================== EQUIPMENT ===================== */
DT.glove=function(ctx,r,flip){ctx.save();ctx.translate(.74*r,0);ctx.scale(1,-flip);ctx.fillStyle='#f2f1ee';ctx.font=`bold ${r*.78}px "Arial Black",Impact,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.rotate(-.1);ctx.fillText('UFC',0,0);ctx.restore();return true};
DT.waist=function(ctx,c,front,back,len,lk){const gold=(lk.trunk&&lk.trunk.gold)||'#d8d4cc';let dx=front.x-back.x,dy=front.y-back.y;const a=Math.atan2(dy,dx);ctx.save();ctx.translate(c.x+dx*.0,c.y+dy*.0);ctx.translate(front.x-c.x,front.y-c.y);ctx.rotate(a-Math.PI/2);if(Math.cos(a-Math.PI/2)<0)ctx.rotate(Math.PI);ctx.scale(1,-1);ctx.fillStyle=gold;ctx.font=`bold ${len*.95}px "Arial Black",Impact,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('UFC',0,0);ctx.restore()};
DT.trunk=function(ctx,P,M,lk,F,ac){const col=ac;const o=P(.3,.0),ux=F.ux,uy=F.uy,nx=F.nx,ny=F.ny,s=.03*M;
  ctx.save();ctx.fillStyle=col;const Q=(u,v)=>({x:o.x+ux*u*s+nx*v*s,y:o.y+uy*u*s+ny*v*s});
  const fang=(sx)=>{ctx.beginPath();for(const q of[Q(sx*.15,.9),Q(sx*1.0,.9),Q(sx*1.5,.3),Q(sx*1.1,-.9),Q(sx*.9,-.2),Q(sx*.5,.3)])ctx.lineTo(q.x,q.y);ctx.closePath();ctx.fill()};
  fang(1);fang(-1);ctx.beginPath();for(const q of[Q(-.5,.95),Q(.5,.95),Q(.0,.4)])ctx.lineTo(q.x,q.y);ctx.fill();
  const t=P(.55,-.04*M);ctx.translate(t.x,t.y);ctx.rotate(Math.atan2(uy,ux));ctx.scale(1,-1);ctx.font=`bold ${.026*M}px "Arial Black",Impact,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('UFC',0,0);ctx.restore()};

/* ===================== FOOT ===================== */
DT.foot=function(ctx,A,He,T,d,C,B){if(!DT.on)return;const ux0=T.x-He.x,uy0=T.y-He.y,Lf=Math.hypot(ux0,uy0)||1e-5,ux=ux0/Lf,uy=uy0/Lf;let nx=-uy,ny=ux;if((A.x-He.x)*nx+(A.y-He.y)*ny<0){nx=-nx;ny=-ny}
  const Q=(u,v)=>({x:He.x+ux*u*Lf+nx*v*Lf,y:He.y+uy*u*Lf+ny*v*Lf});
  /* toe separations + nails + extensor tendons on the instep */
  ctx.strokeStyle=C.s;ctx.lineCap='round';ctx.lineWidth=Lf*.012;ctx.globalAlpha=.8;for(let i=0;i<4;i++){const u=.78+i*.052;const p0=Q(u,.14),p1=Q(u+.01,.04);ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);ctx.stroke()}
  ctx.globalAlpha=.55;ctx.strokeStyle=shade(C.b,-.1);ctx.lineWidth=Lf*.009;for(let i=0;i<3;i++){const p0=Q(.3+i*.1,.3-i*.03),p1=Q(.62+i*.05,.2);ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);ctx.stroke()}
  ctx.globalAlpha=.7;ctx.fillStyle=shade(C.b,.35);for(let i=0;i<3;i++){const q=Q(.92+(i<1?.0:0)-i*.0,.15-i*.002);ctx.beginPath();ctx.ellipse(q.x,q.y,Lf*.012,Lf*.008,Math.atan2(uy,ux),0,7);ctx.fill()}ctx.globalAlpha=1};
})();
