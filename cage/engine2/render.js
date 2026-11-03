/* ===== engine2/render.js : skinned body surface, skin physics and Canvas 2D drawing =====
   The fighter is a surface of rings swept along the skeleton (torso, neck, skull, arms, gloves, thighs, shins,
   feet). Each ring is an ellipse with front / back / side bulges (pecs, lats, glutes, quads, calves, biceps…)
   oriented by the body's own frame, so the body turns in 3D. Two physical layers live on the surface:
     • flesh: every ring carries an inertial offset (spring-damper, mass lag) — flesh trails fast motion and
       wobbles after impacts (belly, chest, thighs, calves, upper arms);
     • skin: every surface vertex carries a dent (spring-damper coupled to its neighbours) — an impact pushes
       the skin in at the contact point and the dent spreads and springs back.
   Drawing: project to the camera, build quads, back-face cull, depth-sort all quads of both fighters
   (painter's algorithm — nearer parts always cover farther ones), flat-fill each quad with Lambert key light +
   fill + rim light + a little specular. */
(function(){const V=E2.V,IDX=E2.IDX;
const R=E2.R={rimK:.55,spec:.18,key:.7,amb:.3,flesh:{k:(2*Math.PI*4.5)**2,c:7},skin:{k:900,c:22,couple:140}};
/* ---- surface definition ---- */
const torsoProf=t=>{/* [front-back radius, side radius, front bulge, back bulge] along pelvis → neck */
  const P=[[0,.112,.168,0,.038],[.12,.106,.162,0,.042],[.25,.1,.152,.016,.016],[.4,.106,.162,.014,.02],[.55,.116,.178,.022,.026],[.7,.122,.198,.036,.032],[.82,.112,.208,.026,.036],[.9,.092,.194,0,.032],[.95,.072,.125,0,.022],[1,.062,.072,0,0]];   /* glutes, abs, lats, pecs, traps */
  let i=0;while(i<P.length-2&&t>P[i+1][0])i++;const a=P[i],b=P[i+1];const u=(t-a[0])/(b[0]-a[0]);const m=k=>a[k]+(b[k]-a[k])*u;return[m(1),m(2),m(3),m(4)]};
const lerpProf=P=>t=>{let i=0;while(i<P.length-2&&t>P[i+1][0])i++;const a=P[i],b=P[i+1];const u=Math.min(1,Math.max(0,(t-a[0])/(b[0]-a[0])));return a.slice(1).map((v,k)=>v+(b[k+1]-v)*u)};
const SEGS=[];const seg=(o)=>SEGS.push(o);
seg({n:'torso',path:['pelvis','spine1','spine2','spine3','spine4','spine5','neck1'],ext:[-.06,0],rings:18,m:22,ref:'chest',prof:torsoProf,mat:t=>t<.2?'shorts':t<.23?'band':'skin',flesh:t=>t<.55&&t>.22?.9:t>.6&&t<.85?.55:.2});
seg({n:'neck',path:['neck1','neck2','head'],ext:[0,.02],rings:4,m:16,ref:'head',prof:()=>[.066,.072,0,.01],mat:()=>'skin',flesh:()=>0});
seg({n:'head',head:true,rings:13,m:22});
for(const S of['L','R']){const s=S==='L'?1:-1;
  seg({n:'uarm'+S,path:['shoulder'+S,'elbow'+S],ext:[-.03,0],rings:9,m:16,ref:'chest',prof:lerpProf([[0,.07,.076,0,0],[.2,.066,.068,.012,.012],[.45,.059,.058,.018,.015],[.75,.05,.052,.008,.006],[1,.045,.046,0,0]]),mat:()=>'skin',flesh:t=>.7});
  seg({n:'farm'+S,path:['elbow'+S,'wrist'+S],ext:[0,0],rings:8,m:14,ref:'chest',prof:lerpProf([[0,.048,.052,0,0],[.25,.05,.057,.006,0],[.7,.038,.043,0,0],[1,.03,.035,0,0]]),mat:()=>'skin',flesh:t=>.35});
  seg({n:'glove'+S,path:['wrist'+S,'hand'+S],ext:[0,.075],rings:8,m:14,ref:'chest',prof:lerpProf([[0,.032,.036,0,0],[.18,.04,.046,0,0],[.35,.04,.044,0,0],[.6,.05,.05,.004,0],[.85,.048,.046,0,0],[1,.02,.022,0,0]]),mat:t=>t<.3?'strap':'glove',flesh:()=>0});
  seg({n:'thigh'+S,path:['hip'+S,'knee'+S],ext:[-.03,0],rings:10,m:18,ref:'pelvis',prof:lerpProf([[0,.1,.106,.012,.02],[.2,.097,.097,.022,.016],[.5,.084,.08,.024,.01],[.8,.066,.064,.012,0],[1,.056,.056,0,0]]),mat:t=>t<.42?'shorts':'skin',flesh:t=>.8});
  seg({n:'shin'+S,path:['knee'+S,'ankle'+S],ext:[0,0],rings:9,m:16,ref:'pelvis',prof:lerpProf([[0,.056,.056,.004,0],[.25,.052,.053,0,.026],[.5,.046,.046,0,.016],[.8,.036,.036,0,0],[1,.032,.034,0,0]]),mat:()=>'skin',flesh:t=>t<.55?.6:.1});
  seg({n:'foot'+S,path:['heel'+S,'ball'+S,'t3c'+S],ext:[-.01,.01],rings:8,m:12,ref:'up',prof:lerpProf([[0,.032,.034,0,0],[.2,.046,.044,0,0],[.55,.033,.05,0,0],[.85,.021,.048,0,0],[1,.014,.04,0,0]]),mat:()=>'skin',flesh:()=>0,yOff:t=>t<.45?.035*(1-Math.abs(t-.25)/.25):0});}
E2.SEGS=SEGS;
const headProf=lerpProf([[0,.035,.035],[.08,.064,.054],[.2,.09,.068],[.35,.101,.078],[.5,.106,.084],[.68,.105,.086],[.82,.094,.08],[.92,.074,.064],[.97,.05,.045],[1,.025,.024]]);
/* ---- per-body surface state ---- */
E2.skinInit=function(body){let nv=0,nr=0;body.segInfo=SEGS.map(S=>{const o={off:nv,roff:nr,rings:S.rings,m:S.m};nv+=S.rings*S.m;nr+=S.rings;return o});
  body.nv=nv;body.nr=nr;body.dent=new Float32Array(nv);body.dentV=new Float32Array(nv);body.vx3=new Float32Array(nv*3);body.vn3=new Float32Array(nv*3);
  body.rj=new Float32Array(nr*3);body.rjv=new Float32Array(nr*3);body.rc=new Float32Array(nr*3);body.rcp=new Float32Array(nr*3);body.rcpp=new Float32Array(nr*3);body.mat=new Array(nv);body._skinReady=false};
E2.physCount=function(body){return{joints:body.n,flesh:body.nr,skin:body.nv,total:body.n+body.nr+body.nv,constraints:body.C.length}};
/* frames */
const jp=(b,n)=>{const i=IDX[n];return V.n(b.x[i],b.y[i],b.z[i])};
function frames(b){const pel=jp(b,'pelvis'),sp=jp(b,'spine5');const up=V.norm(V.sub(sp,pel));const left=V.norm(V.sub(jp(b,'shoulderL'),jp(b,'shoulderR')));const chest=V.norm(V.cross(up,left));
  const lh=V.norm(V.sub(jp(b,'hipL'),jp(b,'hipR')));const pf=V.norm(V.cross(V.n(0,1,0),lh));const pelvisF=V.n(pf.x,0,pf.z);
  const hd=jp(b,'head'),ht=jp(b,'headTop'),no=jp(b,'nose');const hu=V.norm(V.sub(ht,hd));const hf=V.norm(V.sub(no,V.add(hd,V.sc(hu,V.dot(V.sub(no,hd),hu)))));
  return{chest,pelvis:V.norm(pelvisF),head:hf,headUp:hu,up:V.n(0,1,0)}}
/* sample a point / axis along a joint path at parameter t (by length) */
function pathPts(b,S){const P=S.path.map(n=>jp(b,n));const L=[0];for(let i=1;i<P.length;i++)L.push(L[i-1]+V.len(V.sub(P[i],P[i-1])));
  const tot=L[L.length-1]||1e-6;const a0=V.norm(V.sub(P[1],P[0])),a1=V.norm(V.sub(P[P.length-1],P[P.length-2]));const e0=S.ext[0],e1=S.ext[1];const len=tot-e0+e1;
  return t=>{let d=e0+(len)*t-0;/* distance from P0 (may be outside [0,tot]) */if(d<=0)return{p:V.madd(P[0],a0,d),a:a0};if(d>=tot)return{p:V.madd(P[P.length-1],a1,d-tot),a:a1};
    let i=0;while(i<L.length-2&&d>L[i+1])i++;const u=(d-L[i])/(L[i+1]-L[i]||1e-6);const a=V.norm(V.sub(P[i+1],P[i]));const an=i+2<P.length?V.norm(V.sub(P[i+2],P[i+1])):a;const ap=i>0?V.norm(V.sub(P[i],P[i-1])):a;
    const ax=V.norm(V.add(V.sc(V.lerp(ap,a,.5),1-u),V.sc(V.lerp(a,an,.5),u)));return{p:V.lerp(P[i],P[i+1],u),a:ax}}}
/* build the surface: vertex positions, normals and materials; rings carry flesh offsets, vertices carry dents */
function buildSurface(b){const F=frames(b);const X=b.vx3,N=b.vn3;let ri=0;
  SEGS.forEach((S,si)=>{const info=b.segInfo[si];let samp,ref,prof;
    if(S.head){const hd=jp(b,'head'),hu=F.headUp;const base=V.madd(hd,hu,-.06);samp=t=>({p:V.madd(base,hu,.25*t),a:hu});ref=F.head;prof=t=>{const r=headProf(t);/* face: flatter sides, jaw forward */return[r[0],r[1],t<.3?.012:t>.45&&t<.75?.006:0,t>.5?.012:0]}}
    else{samp=pathPts(b,S);ref=F[S.ref];prof=S.prof}
    for(let r=0;r<S.rings;r++){const t=r/(S.rings-1);const{p,a}=samp(t);let nrm=V.sub(ref,V.sc(a,V.dot(ref,a)));if(V.len(nrm)<1e-4)nrm=V.cross(a,V.n(0,0,1));nrm=V.norm(nrm);const bin=V.cross(a,nrm);
      const pr=prof(t);const bw=S.head?1:((b.look&&b.look.build)||1.1);/* build: muscle mass multiplier */const rx=pr[0]*bw,rz=pr[1]*bw,fb=(pr[2]||0)*bw,bb=(pr[3]||0)*bw;const yo=S.yOff?S.yOff(t):0;
      /* flesh: ring centre history (for inertia) */const k3=ri*3;let c=V.add(p,V.n(0,yo,0));b.rcpp[k3]=b.rcp[k3];b.rcpp[k3+1]=b.rcp[k3+1];b.rcpp[k3+2]=b.rcp[k3+2];b.rcp[k3]=b.rc[k3];b.rcp[k3+1]=b.rc[k3+1];b.rcp[k3+2]=b.rc[k3+2];b.rc[k3]=c.x;b.rc[k3+1]=c.y;b.rc[k3+2]=c.z;
      const fl=S.flesh?S.flesh(t):0;c=V.add(c,V.n(b.rj[k3]*fl,b.rj[k3+1]*fl,b.rj[k3+2]*fl));
      for(let j=0;j<S.m;j++){const th=j/S.m*Math.PI*2,ct=Math.cos(th),st=Math.sin(th);const rr=rx+fb*Math.max(0,ct)**2+bb*Math.max(0,-ct)**2;
        const vi=info.off+r*S.m+j;const dn=b.dent[vi];const nx=V.norm(V.add(V.sc(nrm,ct/Math.max(.01,rr)),V.sc(bin,st/Math.max(.01,rz))));
        const q=V.add(c,V.add(V.sc(nrm,rr*ct),V.sc(bin,rz*st)));const qd=V.madd(q,nx,-dn);X[vi*3]=qd.x;X[vi*3+1]=qd.y;X[vi*3+2]=qd.z;N[vi*3]=nx.x;N[vi*3+1]=nx.y;N[vi*3+2]=nx.z;b.mat[vi]=S.mat?S.mat(t,j):'skin'}
      ri++}});
  b._skinReady=true;b._F=F}
/* physics of the surface layers */
E2.skinStep=function(b,dt){if(!b.nv)return;buildSurface(b);const K=R.flesh;
  /* flesh: rings lag behind the acceleration of their centre */
  if(dt>0)for(let r=0;r<b.nr;r++){const k=r*3;for(let a=0;a<3;a++){const acc=(b.rc[k+a]-2*b.rcp[k+a]+b.rcpp[k+a])/(dt*dt);const ac=Math.max(-60,Math.min(60,acc));b.rjv[k+a]+=(-K.k*b.rj[k+a]-K.c*b.rjv[k+a]-ac)*dt;b.rj[k+a]+=b.rjv[k+a]*dt;b.rj[k+a]=Math.max(-.025,Math.min(.025,b.rj[k+a]))}}
  /* skin dents: spring back, spread to ring neighbours */
  const S=R.skin,D=b.dent,DV=b.dentV;let off=0;for(const s of SEGS){const m=s.m;for(let r=0;r<s.rings;r++)for(let j=0;j<m;j++){const i=off+r*m+j;const nb=(D[off+r*m+(j+1)%m]+D[off+r*m+(j+m-1)%m]+(r>0?D[i-m]:D[i])+(r<s.rings-1?D[i+m]:D[i]))*.25;
      DV[i]+=(-S.k*D[i]-S.c*DV[i]+S.couple*(nb-D[i]))*dt}off+=s.rings*m}
  for(let i=0;i<b.nv;i++){D[i]+=DV[i]*dt;if(D[i]>.04)D[i]=.04;else if(D[i]<-.015)D[i]=-.015}};
E2.skinImpact=function(b,p,nrm,J){if(!b._skinReady)return;const X=b.vx3;const rad=.13;const s=Math.min(1.2,J/10);
  for(let i=0;i<b.nv;i++){const dx=X[i*3]-p.x,dy=X[i*3+1]-p.y,dz=X[i*3+2]-p.z;const d=Math.hypot(dx,dy,dz);if(d<rad){const f=1-d/rad;b.dentV[i]+=1.6*s*f*f}}
  /* the flesh around the impact gets a shove too */let off=0;for(let r=0;r<b.nr;r++){const k=r*3;const d=Math.hypot(b.rc[k]-p.x,b.rc[k+1]-p.y,b.rc[k+2]-p.z);if(d<.35){const f=(1-d/.35)*s*.6;b.rjv[k]+=nrm.x*f;b.rjv[k+1]+=nrm.y*f;b.rjv[k+2]+=nrm.z*f}}};
/* ---- camera ---- */
E2.Camera=class{constructor(){this.yaw=-.62;this.pitch=.1;this.dist=3.1;this.target=V.n(0,1.05,0);this.fov=1.05}
  setup(W,H){const cy=Math.cos(this.pitch);this.pos=V.add(this.target,V.n(Math.sin(this.yaw)*this.dist*cy,Math.sin(this.pitch)*this.dist+.15,Math.cos(this.yaw)*this.dist*cy));
    this.f=V.norm(V.sub(this.target,this.pos));this.r=V.norm(V.cross(this.f,V.n(0,1,0)));this.u=V.cross(this.r,this.f);this.W=W;this.H=H;this.foc=H/(2*Math.tan(this.fov/2))}
  proj(p){const d=V.sub(p,this.pos);const z=V.dot(d,this.f);if(z<.05)return null;return{x:this.W/2+this.foc*V.dot(d,this.r)/z,y:this.H*.5-this.foc*V.dot(d,this.u)/z,z}}};
/* ---- materials & lighting ---- */
const hex=h=>{const c=parseInt(h.slice(1),16);return[(c>>16)&255,(c>>8)&255,c&255]};
function matColor(b,m){const L=b.look||{};return m==='skin'?L.skin||[196,140,104]:m==='shorts'?L.shorts||[40,40,46]:m==='band'?L.band||[230,230,230]:m==='glove'?[24,24,28]:m==='strap'?hex(b.corner||'#c41010'):[200,200,200]}
E2.draw=function(ctx,cam,bodies,o){o=o||{};const quads=[];const camPos=cam.pos;const keyL=V.norm(V.add(V.add(V.sc(cam.r,-.45),V.n(0,.85,0)),V.sc(cam.f,-.4)));const rimL=V.norm(V.add(V.sc(cam.f,.85),V.n(0,.35,0)));
  for(const b of bodies){if(!b._skinReady)buildSurface(b);const X=b.vx3,N=b.vn3;const P=new Array(b.nv);for(let i=0;i<b.nv;i++)P[i]=cam.proj(V.n(X[i*3],X[i*3+1],X[i*3+2]));
    const shade=new Float32Array(b.nv);const spec=new Float32Array(b.nv);
    for(let i=0;i<b.nv;i++){const n=V.n(N[i*3],N[i*3+1],N[i*3+2]);const vd=V.norm(V.sub(camPos,V.n(X[i*3],X[i*3+1],X[i*3+2])));const nl=Math.max(0,V.dot(n,keyL));const nv=Math.max(0,V.dot(n,vd));
      const rim=Math.pow(1-nv,3)*Math.max(0,V.dot(n,rimL)+.3)*R.rimK;const h=V.norm(V.add(keyL,vd));spec[i]=Math.pow(Math.max(0,V.dot(n,h)),24)*R.spec;shade[i]=R.amb+R.key*nl+rim}
    let off=0;SEGS.forEach((S,si)=>{const m=S.m;for(let r=0;r<S.rings-1;r++)for(let j=0;j<m;j++){const a=off+r*m+j,bq=off+r*m+(j+1)%m,c=off+(r+1)*m+(j+1)%m,d=off+(r+1)*m+j;
      const pa=P[a],pb=P[bq],pc=P[c],pd=P[d];if(!pa||!pb||!pc||!pd)continue;
      /* back-face cull in screen space (winding) */const cr=(pb.x-pa.x)*(pd.y-pa.y)-(pb.y-pa.y)*(pd.x-pa.x)+(pc.x-pb.x)*(pd.y-pb.y)-(pc.y-pb.y)*(pd.x-pb.x);if(cr>0)continue;
      const sh=(shade[a]+shade[bq]+shade[c]+shade[d])/4,sp=(spec[a]+spec[bq]+spec[c]+spec[d])/4;const col=matColor(b,b.mat[a]);
      const k=Math.min(1.35,sh),w=b.sweat||.35;const rr=Math.min(255,col[0]*k+255*sp*w),gg=Math.min(255,col[1]*k+250*sp*w),bb=Math.min(255,col[2]*k+240*sp*w);
      quads.push({z:(pa.z+pb.z+pc.z+pd.z)/4,pts:[pa,pb,pc,pd],c:`rgb(${rr|0},${gg|0},${bb|0})`})}off+=S.rings*m});
    /* face details on the side facing the camera */
    const F=b._F;if(F){const hd=jp(b,'head');const toCam=V.norm(V.sub(camPos,hd));const fv=V.dot(F.head,toCam);const decals=[];
      if(fv>-.2){const eye=n=>cam.proj(jp(b,n));const al=Math.min(1,(fv+.2)*1.6);const dz=cam.proj(hd).z-.12;
        decals.push({z:dz,draw:c=>{c.globalAlpha=al;for(const S of['L','R']){const e=eye('eye'+S),br=eye('brow'+S);if(!e||!br)continue;const sc=cam.foc/e.z;c.fillStyle='#f3ede6';c.beginPath();c.ellipse(e.x,e.y,.012*sc,.006*sc,0,0,7);c.fill();c.fillStyle='#2a1a10';c.beginPath();c.arc(e.x,e.y,.0055*sc,0,7);c.fill();
          c.strokeStyle='#3a2416';c.lineWidth=.007*sc;c.beginPath();c.moveTo(br.x-.016*sc,br.y+.002*sc);c.quadraticCurveTo(br.x,br.y-.004*sc,br.x+.016*sc,br.y+.002*sc);c.stroke()}
          const no=eye('nose'),ch=eye('chin'),jw=eye('jaw');if(no&&ch){const sc=cam.foc/no.z;c.strokeStyle='rgba(90,50,30,.6)';c.lineWidth=.006*sc;const mx=(no.x*.4+ch.x*.6),my=(no.y*.4+ch.y*.6);c.beginPath();c.moveTo(mx-.018*sc,my);c.quadraticCurveTo(mx,my+.003*sc,mx+.018*sc,my);c.stroke();
            c.fillStyle=`rgba(${b.look&&b.look.skin?b.look.skin.map(v=>v*.8|0).join(','):'150,100,70'},.9)`;c.beginPath();c.ellipse(no.x,no.y,.014*sc,.011*sc,0,0,7);c.fill()}c.globalAlpha=1}})}
      for(const d of decals)quads.push({z:d.z,dec:d.draw})}}
  quads.sort((a,b)=>b.z-a.z);ctx.lineJoin='round';
  for(const q of quads){if(q.dec){q.dec(ctx);continue}const p=q.pts;ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);ctx.lineTo(p[1].x,p[1].y);ctx.lineTo(p[2].x,p[2].y);ctx.lineTo(p[3].x,p[3].y);ctx.closePath();ctx.fillStyle=q.c;ctx.fill();ctx.strokeStyle=q.c;ctx.lineWidth=.8;ctx.stroke()}
  if(o.debug)for(const b of bodies){ctx.fillStyle='#4ef';ctx.strokeStyle='rgba(80,230,255,.7)';ctx.lineWidth=1;for(const bn of E2.BONES){if(bn.pi<0)continue;const a=cam.proj(V.n(b.x[bn.i],b.y[bn.i],b.z[bn.i])),c=cam.proj(V.n(b.x[bn.pi],b.y[bn.pi],b.z[bn.pi]));if(a&&c){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(c.x,c.y);ctx.stroke()}}
    for(let i=0;i<b.n;i++){const a=cam.proj(V.n(b.x[i],b.y[i],b.z[i]));if(a){ctx.fillStyle=`rgb(${255*(1-b.tone[i])|0},${200*b.tone[i]+55|0},255)`;ctx.beginPath();ctx.arc(a.x,a.y,2.2,0,7);ctx.fill()}}}
  return quads.length};
/* ---- arena ---- */
E2.drawArena=function(ctx,cam,W,H){let g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#05060a');g.addColorStop(.5,'#11131a');g.addColorStop(1,'#0b0c10');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  /* crowd blobs (far, dim) */ctx.fillStyle='rgba(60,64,80,.35)';for(let i=0;i<180;i++){const a=i*2.399,rr=6+(i%5)*.6;const p=cam.proj(V.n(Math.cos(a)*rr,1.2+(i%7)*.35,Math.sin(a)*rr));if(p){const s=cam.foc/p.z*.12;ctx.beginPath();ctx.arc(p.x,p.y,s,0,7);ctx.fill()}}
  /* octagon floor: polygon clipped against the camera (the camera stands inside the cage) */const Rr=4.1,oct=[];for(let i=0;i<8;i++){const a=(i+.5)/8*Math.PI*2;oct.push(V.n(Math.cos(a)*Rr,0,Math.sin(a)*Rr))}
  const clipP=[];for(let i=0;i<8;i++){const a=oct[i],b=oct[(i+1)%8];const za=V.dot(V.sub(a,cam.pos),cam.f),zb=V.dot(V.sub(b,cam.pos),cam.f);const nz=.08;if(za>=nz)clipP.push(a);if((za>=nz)!==(zb>=nz)){const u=(nz-za)/(zb-za);clipP.push(V.lerp(a,b,u))}}
  const op=clipP.map(p=>cam.proj(p)).filter(Boolean);if(op.length>2){ctx.beginPath();op.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();const cp=cam.proj(V.n(0,0,0))||{x:W/2,y:H*.8};g=ctx.createRadialGradient(cp.x,cp.y,10,cp.x,cp.y,W*.75);g.addColorStop(0,'#eef0f3');g.addColorStop(.6,'#c9ccd2');g.addColorStop(1,'#8f939b');ctx.fillStyle=g;ctx.fill()}
  /* centre logo ring */ctx.strokeStyle='rgba(200,20,30,.65)';ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;const p=cam.proj(V.n(Math.cos(a)*1.6,0,Math.sin(a)*1.6));if(p)i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)}ctx.stroke();
  /* fence: posts + top rail + mesh */for(let i=0;i<8;i++){const a=oct[i],b=oct[(i+1)%8];const a0=cam.proj(a),a1=cam.proj(V.add(a,V.n(0,1.75,0))),b0=cam.proj(b),b1=cam.proj(V.add(b,V.n(0,1.75,0)));if(!a0||!a1||!b0||!b1)continue;
    ctx.fillStyle='rgba(10,10,14,.35)';ctx.beginPath();ctx.moveTo(a0.x,a0.y);ctx.lineTo(b0.x,b0.y);ctx.lineTo(b1.x,b1.y);ctx.lineTo(a1.x,a1.y);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(30,30,36,.5)';ctx.lineWidth=1;for(let k=1;k<12;k++){const u=k/12;const p0=cam.proj(V.lerp(a,b,u)),p1=cam.proj(V.add(V.lerp(a,b,u),V.n(0,1.75,0)));if(p0&&p1){ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);ctx.stroke()}}
    ctx.strokeStyle='#0a0a0d';ctx.lineWidth=Math.max(2,cam.foc/a0.z*.07);ctx.beginPath();ctx.moveTo(a0.x,a0.y);ctx.lineTo(a1.x,a1.y);ctx.stroke();ctx.lineWidth=Math.max(2,cam.foc/a1.z*.05);ctx.beginPath();ctx.moveTo(a1.x,a1.y);ctx.lineTo(b1.x,b1.y);ctx.stroke()}};
})();
