/* ===== engine2/render2d.js : flat 2D vector renderer (cartoon-vector style, thick outlines, flat fills) =====
   The physics/skin layers stay exactly as they are (joints, flesh inertia nodes, skin dent nodes). This file only
   decides how they are DRAWN: there is no perspective, no smooth lighting and no camera orbit. The stage is a
   fixed side-on 2D view with a little floor depth (like a 2D brawler lane), so fighters can use the whole cage:
   step in, back out, circle to either side — and depending on where they stand and face, the drawing shows
   their front, back, left or right side.

   How a part is drawn: the skin vertices of each body part (torso, neck, head, upper arm, forearm, glove, thigh,
   shin, foot) are flattened onto the screen; every pair of neighbouring cross-sections becomes one convex 2D
   shape; all shapes of a part are stroked thick in the outline colour and then filled flat, so each part reads
   as one clean vector shape with a hard outline. A second, darker flat tone (cel shadow) marks the side of
   the part turned away from the light. Parts are layered back-to-front; parts on the far side of the body get
   a darker tone, as in classic 2D character art. Face (eyes, brows, nose, mouth, ears) and hair are vector
   decals placed by the head's facing: full face from the front, profile from the side, hair only from behind.
   Skin dents and flesh wobble move the outline vertices, so impacts visibly deform the flat shapes. */
(function(){const V=E2.V,IDX=E2.IDX;
const ST=E2.ST={tilt:.36,outline:'#141418',ow:.012,edgeK:.62,farDark:.84,shadowK:.8,lightDir:V.norm(V.n(-.55,.75,.45))};
/* ---- stage camera: orthographic, fixed angle, follows and zooms on the fighters ---- */
E2.Stage=class{constructor(){this.tx=0;this.tz=0;this.ty=.8;this.s=200;this.W=800;this.H=600}
  setup(W,H,bodies){this.W=W;this.H=H;const c=Math.cos(ST.tilt),sn=Math.sin(ST.tilt);this.c=c;this.sn=sn;
    if(bodies&&bodies.length){let mx=0,mz=0;for(const b of bodies){mx+=b.cx;mz+=b.cz}mx/=bodies.length;mz/=bodies.length;const sep=bodies.length>1?Math.hypot(bodies[0].cx-bodies[1].cx,(bodies[0].cz-bodies[1].cz)*sn):0;
      this.tx+=(mx-this.tx)*.08;this.tz+=(mz-this.tz)*.08;const want=Math.min(H/2.55,W/(sep+2.6));this.s+=(want-this.s)*.06}
    else this.s=Math.min(H/2.7,W/3)}
  view(){return V.n(0,this.sn,this.c)}/* direction from the scene toward the viewer */
  depth(x,y,z){return z*this.c+y*this.sn}
  proj(p){return{x:this.W/2+(p.x-this.tx)*this.s,y:this.H*.5-((p.y-this.ty)*this.c-(p.z-this.tz)*this.sn)*this.s,z:this.depth(p.x,p.y,p.z)}}};
/* ---- tiny 2D helpers ---- */
function hull(P){if(P.length<3)return P;P=P.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);const lo=[],up=[];
  for(const p of P){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p)}for(let i=P.length-1;i>=0;i--){const p=P[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p)}
  lo.pop();up.pop();return lo.concat(up)}
function poly(ctx,H){ctx.moveTo(H[0][0],H[0][1]);for(let i=1;i<H.length;i++)ctx.lineTo(H[i][0],H[i][1]);ctx.closePath()}
const hex=h=>{const c=parseInt(h.slice(1),16);return[(c>>16)&255,(c>>8)&255,c&255]};
const rgb=(c,k)=>`rgb(${Math.min(255,c[0]*k)|0},${Math.min(255,c[1]*k)|0},${Math.min(255,c[2]*k)|0})`;
function matColor(b,m){const L=b.look||{};return m==='skin'?L.skin||[196,140,104]:m==='shorts'?L.shorts||[40,40,46]:m==='band'?L.band||[230,230,230]:m==='glove'?[30,30,34]:m==='strap'?hex(b.corner||'#c41010'):[200,200,200]}
const jp=(b,n)=>{const i=IDX[n];return V.n(b.x[i],b.y[i],b.z[i])};
/* ---- one body → list of drawable parts ---- */
function bodyParts(b,st){if(!b._skinReady)E2.buildSurface(b);const X=b.vx3,N=b.vn3,view=st.view(),Ld=ST.lightDir;
  const P2=new Array(b.nv);for(let i=0;i<b.nv;i++){const p=st.proj(V.n(X[i*3],X[i*3+1],X[i*3+2]));P2[i]=[p.x,p.y,p.z]}
  const cDepth=st.depth(b.x[IDX.spine3],b.y[IDX.spine3],b.z[IDX.spine3]),pDepth=st.depth(b.x[IDX.pelvis],b.y[IDX.pelvis],b.z[IDX.pelvis]);const parts=[];
  E2.SEGS.forEach((S,si)=>{const inf=b.segInfo[si],m=S.m;const bands=[];let dsum=0,dn=0;
    for(let r=0;r<S.rings-1;r++){const pts=[],sh=[];const a0=inf.off+r*m;for(let k=0;k<2*m;k++){const vi=a0+k;const p=P2[vi];pts.push(p);dsum+=p[2];dn++;
        const nl=N[vi*3]*Ld.x+N[vi*3+1]*Ld.y+N[vi*3+2]*Ld.z;const nv=N[vi*3]*view.x+N[vi*3+1]*view.y+N[vi*3+2]*view.z;if(nl<-.12&&nv>-.35)sh.push(p)}
      bands.push({H:hull(pts),S:sh.length>=3?hull(sh):null,mat:b.mat[a0]})}
    const d=dsum/dn;const lat=S.n.endsWith('L')||S.n.endsWith('R');
    /* 2D layer order inside one fighter (like a cut-out puppet): limbs behind the torso → torso → limbs in
       front. A limb part counts as "in front" when it is nearer to the viewer than the torso's centre line —
       this works from every side: the near arm in profile, both guard hands from the front, neither from behind. */
    let layer;const isArm=/^(uarm|farm|glove)/.test(S.n),isLeg=/^(thigh|shin|foot)/.test(S.n);
    if(S.n==='torso')layer=3;else if(S.n==='neck')layer=4;else if(S.head)layer=5;
    else if(isLeg)layer=d>pDepth+.01?3.5:1;else if(isArm){const front=d>cDepth+.015;layer=front?6:0}
    parts.push({b,S,bands,z:d,layer,far:lat&&d<cDepth-.035})});
  return parts}
/* ---- face, ears, hair (vector decals by facing) ---- */
function drawHead(ctx,b,st,far){const view=st.view(),F=b._F;if(!F)return;const s=st.s,ow=ST.ow*s;const hd=jp(b,'head'),ht=jp(b,'headTop');const hc=V.lerp(hd,ht,.45);
  const vis=n=>V.dot(V.norm(V.sub(jp(b,n),hc)),view);const P=n=>st.proj(jp(b,n));const skin=(b.look&&b.look.skin)||[196,140,104];const k=far?ST.farDark:1;
  const hair=(b.look&&b.look.hair)||[28,22,18];
  /* hair: short crop cap over the top and back of the skull */
  {const inf=b.segInfo[E2.SEGS.findIndex(S=>S.head)],m=E2.SEGS.find(S=>S.head).m;const pts=[];for(let r=6;r<13;r++)for(let j=0;j<m;j++){const th=j/m*Math.PI*2;if(r<10&&Math.cos(th)>-.15)continue;const vi=inf.off+r*m+j;/* only hair the viewer can actually see — never the back of the skull through the face */if(r<12&&b.vn3[vi*3]*view.x+b.vn3[vi*3+1]*view.y+b.vn3[vi*3+2]*view.z<-.05)continue;const p=st.proj(V.n(b.vx3[vi*3],b.vx3[vi*3+1],b.vx3[vi*3+2]));pts.push([p.x,p.y])}
    const H=hull(pts);if(H.length>2){ctx.fillStyle=rgb(hair,k);ctx.beginPath();poly(ctx,H);ctx.fill()}}
  /* ears */for(const S of['L','R']){const v=vis('ear'+S);if(v<-.25)continue;const e=P('ear'+S);ctx.fillStyle=rgb(skin,k*.8);ctx.beginPath();ctx.ellipse(e.x,e.y,.013*s,.024*s,0,0,7);ctx.fill()}
  const fv=V.dot(F.head,view);if(fv<-.3)return;
  /* nose: a small outlined wedge pointing along the head's facing (a profile nose from the side) */
  {const no=jp(b,'nose');const tip=st.proj(V.madd(no,F.head,.022)),base=st.proj(V.madd(V.madd(no,F.headUp,.03),F.head,-.01)),bot=st.proj(V.madd(no,F.headUp,-.012));
    ctx.fillStyle=rgb(skin,k*.86);ctx.beginPath();ctx.moveTo(base.x,base.y);ctx.quadraticCurveTo(tip.x,tip.y-.004*s,tip.x,tip.y);ctx.lineTo(bot.x,bot.y);ctx.closePath();ctx.fill()}
  /* eyes + brows (each only when it faces the viewer) */
  for(const S of['L','R']){const v=vis('eye'+S);if(v<.05)continue;const e=P('eye'+S),br=P('brow'+S);const look=st.proj(V.madd(jp(b,'eye'+S),F.head,.02));const dx=(look.x-e.x)*.35,dy=(look.y-e.y)*.35;
    const w=.0095*s*Math.min(1,v*1.6+.25);ctx.fillStyle='#e9e2d8';ctx.beginPath();ctx.ellipse(e.x,e.y,w,.0045*s,0,0,7);ctx.fill();
    ctx.fillStyle='#2a1c12';ctx.beginPath();ctx.ellipse(e.x+dx,e.y+dy,.0042*s,.0045*s,0,0,7);ctx.fill();
    /* brow ridge: a flat darker band, eyebrow hair on top */ctx.fillStyle=rgb(hair,k);ctx.beginPath();ctx.moveTo(br.x-w*1.35,br.y+.003*s);ctx.lineTo(br.x+w*1.35,br.y-.001*s);ctx.lineTo(br.x+w*1.3,br.y+.004*s);ctx.lineTo(br.x-w*1.3,br.y+.0075*s);ctx.closePath();ctx.fill()}
  /* mouth */if(fv>.05){const no=jp(b,'nose'),ch=jp(b,'chin');const mo=st.proj(V.madd(V.lerp(no,ch,.55),F.head,.004));const sideW=V.norm(V.cross(F.headUp,F.head));const a=st.proj(V.madd(V.madd(V.lerp(no,ch,.55),F.head,.0),sideW,.02)),c=st.proj(V.madd(V.lerp(no,ch,.55),sideW,-.02));
    ctx.strokeStyle=rgb(skin,k*.55);ctx.lineWidth=.004*s;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(mo.x,mo.y+.002*s,c.x,c.y);ctx.stroke()}}
/* ---- draw a list of bodies ---- */
E2.draw2d=function(ctx,st,bodies,o){o=o||{};const order=bodies.slice().sort((a,b)=>st.depth(a.x[IDX.spine3],0,a.z[IDX.spine3])-st.depth(b.x[IDX.spine3],0,b.z[IDX.spine3]));
  let parts=[];for(const b of order){const P=bodyParts(b,st);P.sort((a,b)=>a.layer-b.layer||a.z-b.z);parts=parts.concat(P)}
  const ow=ST.ow*st.s;ctx.lineJoin='round';ctx.lineCap='round';let shapes=0;
  for(const p of parts){const{b,bands}=p;const k=p.far?ST.farDark:1;
    /* thin edge in a darker tone of the part's own colour (no black cartoon line) — separates overlapping skin */
    {const ec=rgb(matColor(b,bands[bands.length>>1].mat),k*ST.edgeK);ctx.strokeStyle=ec;ctx.fillStyle=ec;ctx.lineWidth=ow*.75;ctx.beginPath();for(const B of bands)if(B.H.length>2)poly(ctx,B.H);ctx.stroke();ctx.fill()}
    /* flat fill per material */let cur=null;for(const B of bands){if(B.H.length<3)continue;const c=rgb(matColor(b,B.mat),k);if(c!==cur){if(cur)ctx.fill();ctx.fillStyle=c;ctx.beginPath();cur=c}poly(ctx,B.H);shapes++}if(cur)ctx.fill();
    /* cel shadow */cur=null;for(const B of bands){if(!B.S)continue;const c=rgb(matColor(b,B.mat),k*ST.shadowK);if(c!==cur){if(cur)ctx.fill();ctx.fillStyle=c;ctx.beginPath();cur=c}poly(ctx,B.S)}if(cur)ctx.fill();
    if(p.S.n==='torso')drawTorsoLines(ctx,b,st,k);
    if(p.S.head)drawHead(ctx,b,st,false)}
  if(o.debug)for(const b of bodies){ctx.strokeStyle='rgba(80,230,255,.75)';ctx.lineWidth=1;for(const bn of E2.BONES){if(bn.pi<0)continue;const a=st.proj(V.n(b.x[bn.i],b.y[bn.i],b.z[bn.i])),c=st.proj(V.n(b.x[bn.pi],b.y[bn.pi],b.z[bn.pi]));ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(c.x,c.y);ctx.stroke()}
    for(let i=0;i<b.n;i++){const a=st.proj(V.n(b.x[i],b.y[i],b.z[i]));ctx.fillStyle=`rgb(${255*(1-b.tone[i])|0},${200*b.tone[i]+55|0},255)`;ctx.beginPath();ctx.arc(a.x,a.y,2.2,0,7);ctx.fill()}}
  return shapes};
/* simple vector anatomy lines on the front of the torso (pec line, ab line) when the chest faces the viewer */
function drawTorsoLines(ctx,b,st,k){const F=b._F;if(!F)return;const view=st.view();const fv=V.dot(F.chest,view);if(fv<.15)return;const s=st.s;
  const s4=jp(b,'spine4'),s2=jp(b,'spine2'),s3=jp(b,'spine3');const left=V.norm(V.sub(jp(b,'shoulderL'),jp(b,'shoulderR')));const fr=F.chest;
  ctx.strokeStyle=`rgba(40,20,10,${.22*Math.min(1,fv*1.5)})`;ctx.lineWidth=ST.ow*s*.55;
  const P=q=>st.proj(q);const pc=V.madd(s4,fr,.14);/* pecs */for(const sg of[1,-1]){const a=P(V.madd(pc,left,.005*sg)),c=P(V.madd(V.madd(pc,left,.12*sg),V.n(0,1,0),-.05)),m=P(V.madd(V.madd(pc,left,.07*sg),V.n(0,1,0),-.065));ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(m.x,m.y,c.x,c.y);ctx.stroke()}
  const top=P(V.madd(s3,fr,.15)),bot=P(V.madd(s2,fr,.13));ctx.beginPath();ctx.moveTo(top.x,top.y);ctx.lineTo(bot.x,bot.y);ctx.stroke()}
/* ---- arena: flat vector octagon, crowd silhouettes, lights ---- */
E2.drawArena2d=function(ctx,st,W,H,layer){const s=st.s;const P=(x,y,z)=>st.proj(V.n(x,y,z));const Rr=4.1,FH=1.75;const oct=[];for(let i=0;i<8;i++){const a=(i+.5)/8*Math.PI*2;oct.push([Math.cos(a)*Rr,Math.sin(a)*Rr])}
  if(layer==='back'){ctx.fillStyle='#0d0f15';ctx.fillRect(0,0,W,H);
    /* lighting rig + crowd tiers as flat shapes */const top=P(0,4.2,-6).y;ctx.fillStyle='#161922';ctx.fillRect(0,top,W,H);
    for(let row=0;row<3;row++){const y0=P(0,2.6-row*.55,-5.5+row*.4).y;ctx.fillStyle=['#1b1f2a','#222736','#2a3042'][row];for(let i=-30;i<30;i++){const x=P(i*.42+(row%2)*.21+st.tx*.6*0,0,-5).x;const r=(.14+((i*7+row*3)%5)*.012)*s;ctx.beginPath();ctx.arc(x,y0,r,Math.PI,0);ctx.lineTo(x+r,y0+r*2.6);ctx.lineTo(x-r,y0+r*2.6);ctx.closePath();ctx.fill();ctx.beginPath();ctx.arc(x,y0-r*1.25,r*.62,0,7);ctx.fill()}}
    for(let i=-3;i<=3;i++){const p=P(i*2.4,4.6,-4);ctx.fillStyle='rgba(255,246,220,.9)';ctx.beginPath();ctx.ellipse(p.x,p.y,.12*s,.05*s,0,0,7);ctx.fill()}
    /* apron + floor */const ap=oct.map(([x,z])=>P(x*1.12,0,z*1.12));ctx.fillStyle='#1c1e26';ctx.beginPath();ap.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();
    const fl=oct.map(([x,z])=>P(x,0,z));ctx.fillStyle='#dfe2e7';ctx.strokeStyle=ST.outline;ctx.lineWidth=ST.ow*s*1.6;ctx.beginPath();fl.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.stroke();
    /* canvas markings */ctx.strokeStyle='#c8141c';ctx.lineWidth=ST.ow*s*1.2;ctx.beginPath();for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;const p=P(Math.cos(a)*1.6,0,Math.sin(a)*1.6);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)}ctx.stroke();
    const c=P(0,0,0);ctx.save();ctx.translate(c.x,c.y);ctx.scale(1,st.sn);ctx.fillStyle='rgba(200,20,28,.85)';ctx.font=`900 ${.34*s|0}px Oswald,Impact,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('CAGE LEGENDS',0,0);ctx.restore();
    /* back half of the fence */fence(ctx,st,oct,FH,true)}
  /* the near fence is behind the camera in this view — nothing is drawn over the fighters */};
function fence(ctx,st,oct,FH,back){const s=st.s;for(let i=0;i<8;i++){const a=oct[i],b=oct[(i+1)%8];const mz=(a[1]+b[1])/2;if((mz<-.2)!==back)continue;
    const a0=st.proj(V.n(a[0],0,a[1])),a1=st.proj(V.n(a[0],FH,a[1])),b0=st.proj(V.n(b[0],0,b[1])),b1=st.proj(V.n(b[0],FH,b[1]));
    if(back){ctx.fillStyle='rgba(8,9,12,.55)';ctx.beginPath();ctx.moveTo(a0.x,a0.y);ctx.lineTo(b0.x,b0.y);ctx.lineTo(b1.x,b1.y);ctx.lineTo(a1.x,a1.y);ctx.closePath();ctx.fill()}
    ctx.strokeStyle=back?'rgba(70,74,86,.55)':'rgba(40,42,50,.1)';ctx.lineWidth=1;if(back)for(let k=1;k<14;k++){const u=k/14;ctx.beginPath();ctx.moveTo(a0.x+(b0.x-a0.x)*u,a0.y+(b0.y-a0.y)*u);ctx.lineTo(a1.x+(b1.x-a1.x)*u,a1.y+(b1.y-a1.y)*u);ctx.stroke()}
    ctx.strokeStyle=back?'#0a0a0d':'rgba(10,10,13,.6)';ctx.lineWidth=ST.ow*s*(back?2.2:1.6);ctx.beginPath();ctx.moveTo(a0.x,a0.y);ctx.lineTo(a1.x,a1.y);ctx.lineTo(b1.x,b1.y);ctx.stroke();
    ctx.strokeStyle=back?'#1f2230':'rgba(30,32,40,.5)';ctx.lineWidth=ST.ow*s*1.4;ctx.beginPath();ctx.moveTo(a0.x,a0.y-.02*s);ctx.lineTo(b0.x,b0.y-.02*s);ctx.stroke()}}
/* ground shadow ellipse (flat, very cheap) */
E2.drawShadows2d=function(ctx,st,bodies){for(const b of bodies){const p=st.proj(V.n(b.x[IDX.pelvis],0,b.z[IDX.pelvis]));ctx.fillStyle='rgba(0,0,0,.16)';ctx.beginPath();ctx.ellipse(p.x,p.y,.42*st.s,.42*st.s*st.sn,0,0,7);ctx.fill()}};
})();
