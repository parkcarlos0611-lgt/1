/* ===== engine2/rig.js : 3D skeleton, forward kinematics, poses and strike clips =====
   New fighter engine (stage 1: model + physics). Everything is simulated in 3D (metres, y up) and drawn
   with Canvas 2D by render.js, so the body can be seen in three-quarter view instead of a flat profile.
   Body frame: F = +x forward, U = +y up, L = +z the fighter's left. Joint rotations are [rx, ry, rz] in the
   parent frame: rz = flexion (positive brings a hanging limb forward), ry = twist / yaw, rx = sideways
   (for a left limb negative rx moves it outward). R = Ry · Rz · Rx. */
const E2=window.E2={};
(function(){
const V=E2.V={
  n:(x=0,y=0,z=0)=>({x,y,z}),add:(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z}),sub:(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),
  sc:(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s}),dot:(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,cross:(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x}),
  len:a=>Math.hypot(a.x,a.y,a.z),norm:a=>{const l=Math.hypot(a.x,a.y,a.z)||1e-9;return{x:a.x/l,y:a.y/l,z:a.z/l}},
  lerp:(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t}),madd:(a,b,s)=>({x:a.x+b.x*s,y:a.y+b.y*s,z:a.z+b.z*s})};
const M3=E2.M3={
  I:()=>[1,0,0,0,1,0,0,0,1],
  mul:(a,b)=>[a[0]*b[0]+a[1]*b[3]+a[2]*b[6],a[0]*b[1]+a[1]*b[4]+a[2]*b[7],a[0]*b[2]+a[1]*b[5]+a[2]*b[8],
              a[3]*b[0]+a[4]*b[3]+a[5]*b[6],a[3]*b[1]+a[4]*b[4]+a[5]*b[7],a[3]*b[2]+a[4]*b[5]+a[5]*b[8],
              a[6]*b[0]+a[7]*b[3]+a[8]*b[6],a[6]*b[1]+a[7]*b[4]+a[8]*b[7],a[6]*b[2]+a[7]*b[5]+a[8]*b[8]],
  ap:(m,v)=>({x:m[0]*v.x+m[1]*v.y+m[2]*v.z,y:m[3]*v.x+m[4]*v.y+m[5]*v.z,z:m[6]*v.x+m[7]*v.y+m[8]*v.z}),
  rx:t=>{const c=Math.cos(t),s=Math.sin(t);return[1,0,0,0,c,-s,0,s,c]},
  ry:t=>{const c=Math.cos(t),s=Math.sin(t);return[c,0,s,0,1,0,-s,0,c]},
  rz:t=>{const c=Math.cos(t),s=Math.sin(t);return[c,-s,0,s,c,0,0,0,1]},
  euler:e=>M3.mul(M3.ry(e[1]),M3.mul(M3.rz(e[2]),M3.rx(e[0])))};
/* ---------- skeleton (rest offsets in the parent frame, metres; 1.80 m fighter) ---------- */
const B=[];const add=(n,p,o,m,r,g)=>B.push({n,p,o:V.n(o[0],o[1],o[2]),m,r,g:g||'core'});
add('pelvis',null,[0,1.0,0],10,.12);
add('spine1','pelvis',[0,.08,0],6,.12);add('spine2','spine1',[0,.08,0],6,.12);add('spine3','spine2',[.005,.085,0],5,.12);add('spine4','spine3',[.005,.09,0],5,.13);add('spine5','spine4',[0,.09,0],5,.13);
add('neck1','spine5',[.012,.075,0],1.5,.06);add('neck2','neck1',[.012,.055,0],1.2,.06);add('head','neck2',[.02,.06,0],4,.1);
add('headTop','head',[-.005,.165,0],.6,.08);add('nose','head',[.105,.045,0],.1,.02);add('jaw','head',[.075,-.035,0],.3,.03);add('chin','head',[.09,-.045,0],.2,.02);
add('eyeL','head',[.085,.07,.032],.05,.01);add('eyeR','head',[.085,.07,-.032],.05,.01);add('browL','head',[.095,.09,.034],.05,.01);add('browR','head',[.095,.09,-.034],.05,.01);
add('earL','head',[0,.06,.075],.05,.015);add('earR','head',[0,.06,-.075],.05,.015);
for(const S of['L','R']){const s=S==='L'?1:-1;
  add('clav'+S,'spine5',[.01,.03,.035*s],1,.05,'arm');add('shoulder'+S,'clav'+S,[-.015,-.005,.155*s],2.2,.06,'arm');
  add('elbow'+S,'shoulder'+S,[0,-.29,0],1.6,.05,'arm');add('wrist'+S,'elbow'+S,[0,-.26,0],.8,.035,'arm');add('hand'+S,'wrist'+S,[0,-.085,0],.4,.045,'arm');
  /* fingers: 3 phalanges each; thumb from the wrist */
  const F=[['thumb',[.028,-.025,-.004*s],[.04,.032,.027]],['index',[.012,-.005,.022*s],[.045,.027,.022]],['middle',[.005,-.008,.006*s],[.05,.03,.024]],['ring',[-.002,-.006,-.01*s],[.047,.028,.023]],['pinky',[-.008,-.002,-.025*s],[.037,.022,.02]]];
  for(const[f,o,L]of F){const par=f==='thumb'?'wrist'+S:'hand'+S;add(f+'1'+S,par,o,.03,.01,'finger');add(f+'2'+S,f+'1'+S,[0,-L[0],0],.02,.009,'finger');add(f+'3'+S,f+'2'+S,[0,-L[1],0],.015,.008,'finger');add(f+'T'+S,f+'3'+S,[0,-L[2],0],.01,.008,'finger')}
  add('hip'+S,'pelvis',[0,-.08,.095*s],3,.09,'leg');add('knee'+S,'hip'+S,[0,-.44,0],4,.06,'leg');add('ankle'+S,'knee'+S,[0,-.42,0],1.2,.04,'leg');
  add('heel'+S,'ankle'+S,[-.05,-.05,0],.3,.03,'leg');add('ball'+S,'ankle'+S,[.145,-.055,0],.3,.03,'leg');
  for(const[t,z,L]of[['t1',.022,[.03,.025]],['t2',.004,[.027,.02]],['t3',-.012,[.024,.018]],['t4',-.026,[.02,.016]],['t5',-.038,[.017,.014]]]){add(t+'a'+S,'ball'+S,[.012,.0,z*s],.03,.012,'toe');add(t+'b'+S,t+'a'+S,[L[0],0,0],.02,.01,'toe');add(t+'c'+S,t+'b'+S,[L[1],0,0],.01,.009,'toe')}}
B.forEach((b,i)=>b.i=i);const IDX={};B.forEach(b=>IDX[b.n]=b.i);B.forEach(b=>b.pi=b.p==null?-1:IDX[b.p]);
E2.BONES=B;E2.IDX=IDX;
/* descendants of every bone (for moving a hand / foot rigidly after IK) */
E2.DESC=B.map(b=>{const out=[];const st=[b.i];while(st.length){const k=st.pop();for(const c of B)if(c.pi===k){out.push(c.i);st.push(c.i)}}return out});
/* two-bone IK: root R, target T, lengths L1 L2, pole direction P → {mid, end} */
E2.ik2=function(R,T,L1,L2,P){let d=V.sub(T,R);let D=V.len(d);const mx=(L1+L2)*.999;if(D>mx){d=V.sc(d,mx/D);D=mx}if(D<1e-4)D=1e-4;const u=V.sc(d,1/D);
  const a=(L1*L1+D*D-L2*L2)/(2*D),h=Math.sqrt(Math.max(0,L1*L1-a*a));let p=V.sub(P,V.sc(u,V.dot(P,u)));const pl=V.len(p);p=pl<1e-6?V.norm(V.cross(u,V.n(0,1,0))):V.sc(p,1/pl);
  return{mid:V.add(V.add(R,V.sc(u,a)),V.sc(p,h)),end:V.add(R,d)}};
/* rotation taking unit vector u onto unit vector v (Rodrigues), applied to w */
E2.rotTo=function(u,v,w){const c=V.dot(u,v);const ax=V.cross(u,v);const s=V.len(ax);if(s<1e-6)return c>0?w:V.sc(w,-1);const k=V.sc(ax,1/s);const th=Math.atan2(s,c);const ct=Math.cos(th),st=Math.sin(th);
  return V.add(V.add(V.sc(w,ct),V.sc(V.cross(k,w),st)),V.sc(k,V.dot(k,w)*(1-ct)))};
/* aim a limb chain (root, mid, end) at T in-place on an FK result; descendants of `end` follow rigidly */
E2.aimLimb=function(P,ri,mi,ei,T,pole,w){if(w<=0)return;const R=P[ri],M0=P[mi],E0=P[ei];const L1=V.len(V.sub(M0,R)),L2=V.len(V.sub(E0,M0));
  const goal=V.lerp(E0,T,w);const r=E2.ik2(R,goal,L1,L2,pole);const u=V.norm(V.sub(E0,M0)),v=V.norm(V.sub(r.end,r.mid));
  for(const k of E2.DESC[ei])P[k]=V.add(r.end,E2.rotTo(u,v,V.sub(P[k],E0)));P[mi]=r.mid;P[ei]=r.end};
/* ---------- forward kinematics ---------- */
E2.fk=function(pose,root){/* root: {pos:{x,y,z}, yaw} ; pose: name → [rx,ry,rz] */
  const n=B.length,P=new Array(n),R=new Array(n);const Ry=M3.ry(root.yaw||0);
  for(let i=0;i<n;i++){const b=B[i];const e=pose[b.n];const L=e?M3.euler(e):null;
    if(b.pi<0){R[i]=L?M3.mul(Ry,L):Ry;P[i]=V.add(root.pos,M3.ap(Ry,b.o))}
    else{const pr=R[b.pi];P[i]=V.add(P[b.pi],M3.ap(pr,b.o));R[i]=L?M3.mul(pr,L):pr}}
  return{P,R}};
/* ---------- pose helpers ---------- */
const side=(S,abd,tw,flex)=>{const s=S==='L'?1:-1;return[-abd*s,tw*s,flex]};
E2.side=side;E2.ease=u=>{u=Math.min(1,Math.max(0,u));return u*u*(3-2*u)};
function fist(p,S,k){const s=S==='L'?1:-1;for(const f of['index','middle','ring','pinky']){p[f+'1'+S]=[1.45*k*s,0,0];p[f+'2'+S]=[1.6*k*s,0,0];p[f+'3'+S]=[1.1*k*s,0,0]}p['thumb1'+S]=[.7*k*s,.3*s,.35*k];p['thumb2'+S]=[.6*k*s,0,0];p['thumb3'+S]=[.5*k*s,0,0]}
E2.fist=fist;
/* orthodox guard: bladed hips, chest partly squared, chin down, hands up, knees bent, rear heel up */
E2.guard=function(){const p={};
  p.pelvis=[0,.5,.04];for(let i=1;i<=5;i++)p['spine'+i]=[0,-.055,.035];p.neck1=[0,-.04,-.06];p.neck2=[0,-.04,-.04];p.head=[0,-.1,.16];
  p.hipL=side('L',.06,-.25,.42);p.kneeL=[0,0,-.62];p.ankleL=[0,0,.2];
  p.hipR=side('R',.1,.15,-.12);p.kneeR=[0,0,-.55];p.ankleR=[0,0,.42];
  p.clavL=side('L',-.05,0,.12);p.shoulderL=side('L',.4,.2,1.05);p.elbowL=[0,0,2.05];p.wristL=[0,0,-.15];
  p.clavR=side('R',-.05,0,.08);p.shoulderR=side('R',.5,.25,.8);p.elbowR=[0,0,2.3];p.wristR=[0,0,-.1];
  fist(p,'L',1);fist(p,'R',1);for(const S of['L','R'])for(const t of['t1','t2','t3','t4','t5'])p[t+'a'+S]=[0,0,.25];return p};
E2.lowGuard=function(){const p=E2.guard();p.shoulderL=side('L',.25,.1,.2);p.elbowL=[0,0,.7];p.shoulderR=side('R',.3,.15,.15);p.elbowR=[0,0,.8];return p};
E2.rest=function(){const p={};fist(p,'L',.25);fist(p,'R',.25);return p};
/* blend: base + weighted channel deltas */
E2.blend=function(base,delta,w){const o=Object.assign({},base);for(const k in delta){const a=base[k]||[0,0,0],d=delta[k];o[k]=[a[0]+d[0]*w,a[1]+d[1]*w,a[2]+d[2]*w]}return o};
E2.setAbs=function(base,abs,w){const o=Object.assign({},base);for(const k in abs){const a=base[k]||[0,0,0],d=abs[k];o[k]=[a[0]+(d[0]-a[0])*w,a[1]+(d[1]-a[1])*w,a[2]+(d[2]-a[2])*w]}return o};
/* ---------- strike clips: absolute target channels at each key; times in seconds ---------- */
const sL=(a,t,f)=>side('L',a,t,f),sR=(a,t,f)=>side('R',a,t,f);
E2.CLIPS={
  jab:{dur:.34,hand:'L',aim:{on:.02,hit:[.09,.17],off:.3,tgt:'head',through:.12},keys:[[0,{}],[.05,{root:[0.045,0,0],pelvis:[0,.46,.05],shoulderL:sL(.35,.3,1.15),elbowL:[0,0,1.7]}],[.11,{root:[0.18,0,0],pelvis:[0,.38,.07],spine5:[0,-.12,.05],shoulderL:sL(.08,-.05,1.62),elbowL:[0,0,.08],wristL:[0,0,0],hipL:side('L',.06,-.25,.5),kneeL:[0,0,-.55],head:[0,-.05,.2]}],[.17,{root:[0.18,0,0],pelvis:[0,.38,.07],spine5:[0,-.12,.05],shoulderL:sL(.08,-.05,1.6),elbowL:[0,0,.12]}],[.34,{}]]},
  cross:{dur:.42,hand:'R',aim:{on:.04,hit:[.12,.22],off:.38,tgt:'head',through:.14},keys:[[0,{}],[.06,{root:[0.03,0,0],pelvis:[0,.62,.03],shoulderR:sR(.5,.2,.75),elbowR:[0,0,2.2]}],[.14,{root:[0.12,0,0],pelvis:[0,-.05,.1],spine1:[0,-.1,.06],spine3:[0,-.12,.06],spine5:[0,-.15,.06],shoulderR:sR(.05,0,1.58),elbowR:[0,0,.06],wristR:[0,0,0],hipR:side('R',.12,.5,-.2),ankleR:[0,0,.7],kneeL:[0,0,-.72],head:[0,.05,.22]}],[.22,{root:[0.12,0,0],pelvis:[0,-.05,.1],spine5:[0,-.15,.06],shoulderR:sR(.05,0,1.55),elbowR:[0,0,.1]}],[.42,{}]]},
  hookL:{dur:.44,hand:'L',aim:{on:.06,hit:[.15,.25],off:.4,tgt:'head',through:.1,arc:.3},keys:[[0,{}],[.08,{root:[0.018,0,0],pelvis:[0,.7,.04],shoulderL:sL(.6,.2,1.0),elbowL:[0,0,1.8],kneeL:[0,0,-.75]}],[.17,{root:[0.07,0,0],pelvis:[0,-.1,.06],spine3:[0,-.15,.04],spine5:[0,-.2,.04],shoulderL:sL(1.35,-.4,.6),elbowL:[0,0,1.45],ankleL:[0,.4,.2],head:[0,.1,.2]}],[.25,{root:[0.07,0,0],pelvis:[0,-.12,.06],spine5:[0,-.2,.04],shoulderL:sL(1.3,-.45,.55),elbowL:[0,0,1.45]}],[.44,{}]]},
  hookR:{dur:.5,hand:'R',aim:{on:.07,hit:[.17,.28],off:.46,tgt:'head',through:.1,arc:.32},keys:[[0,{}],[.09,{root:[0.018,0,0],pelvis:[0,.75,.04],shoulderR:sR(.55,.2,.8),elbowR:[0,0,2.0],kneeR:[0,0,-.7]}],[.19,{root:[0.07,0,0],pelvis:[0,-.2,.08],spine3:[0,-.18,.05],spine5:[0,-.25,.05],shoulderR:sR(1.35,-.4,.55),elbowR:[0,0,1.45],ankleR:[0,0,.75],hipR:side('R',.1,.5,-.15),head:[0,.1,.2]}],[.28,{root:[0.07,0,0],pelvis:[0,-.22,.08],spine5:[0,-.25,.05],shoulderR:sR(1.3,-.45,.5),elbowR:[0,0,1.45]}],[.5,{}]]},
  upper:{dur:.46,hand:'R',aim:{on:.08,hit:[.18,.28],off:.42,tgt:'chin',through:.1,lift:.3},keys:[[0,{}],[.1,{root:[0.013,0,0],pelvis:[0,.6,.12],spine3:[0,0,.12],kneeL:[0,0,-.9],kneeR:[0,0,-.85],shoulderR:sR(.4,.4,.35),elbowR:[0,0,1.9]}],[.2,{root:[0.05,0,0],pelvis:[0,.05,-.02],spine3:[0,-.15,-.02],spine5:[0,-.15,-.02],kneeL:[0,0,-.45],kneeR:[0,0,-.4],shoulderR:sR(.2,.3,1.15),elbowR:[0,0,1.75],ankleR:[0,0,.7],head:[0,.05,.1]}],[.28,{root:[0.05,0,0],pelvis:[0,.05,-.02],spine5:[0,-.15,-.02],shoulderR:sR(.2,.3,1.12),elbowR:[0,0,1.7]}],[.46,{}]]},
  bodyHook:{dur:.5,hand:'L',aim:{on:.07,hit:[.18,.28],off:.46,tgt:'liver',through:.08,arc:.25},keys:[[0,{}],[.09,{root:[0.025,0,0],pelvis:[0,.7,.2],spine3:[0,0,.15],kneeL:[0,0,-1.0],kneeR:[0,0,-.9],shoulderL:sL(.6,.2,.6)}],[.2,{root:[0.1,0,0],pelvis:[0,-.05,.25],spine3:[0,-.15,.15],spine5:[0,-.2,.1],kneeL:[0,0,-1.0],kneeR:[0,0,-.95],shoulderL:sL(.9,-.4,.55),elbowL:[0,0,1.25],head:[0,.1,.05]}],[.28,{root:[0.1,0,0],pelvis:[0,-.05,.25],spine5:[0,-.2,.1],kneeL:[0,0,-1.0],shoulderL:sL(.9,-.4,.52),elbowL:[0,0,1.25]}],[.5,{}]]},
  lowKick:{dur:.6,foot:'R',plant:'L',aim:{on:.06,hit:[.2,.3],off:.52,tgt:'thigh',through:.15,chamber:.35},keys:[[0,{}],[.1,{pelvis:[0,.75,.0],hipR:side('R',.3,.4,.1),kneeR:[0,0,-1.3],ankleL:[0,.6,.2]}],[.22,{pelvis:[0,1.25,-.1],spine3:[0,-.3,-.08],spine5:[0,-.3,-.08],hipR:side('R',.9,.5,.35),kneeR:[0,0,-.2],ankleR:[0,0,-.3],ankleL:[0,.9,.25],shoulderR:sR(.3,0,-.3),elbowR:[0,0,1.4]}],[.3,{pelvis:[0,1.25,-.1],spine5:[0,-.3,-.08],hipR:side('R',.9,.5,.35),kneeR:[0,0,-.22],ankleL:[0,.9,.25]}],[.45,{pelvis:[0,.8,0],hipR:side('R',.4,.4,.15),kneeR:[0,0,-1.2]}],[.6,{}]]},
  midKick:{dur:.66,foot:'R',plant:'L',aim:{on:.07,hit:[.23,.33],off:.58,tgt:'ribs',through:.15,chamber:.5},keys:[[0,{}],[.11,{pelvis:[0,.8,-.05],hipR:side('R',.6,.4,.3),kneeR:[0,0,-1.5],ankleL:[0,.6,.2]}],[.25,{pelvis:[0,1.4,-.25],spine3:[0,-.3,-.15],spine5:[0,-.3,-.12],hipR:side('R',1.35,.6,.4),kneeR:[0,0,-.15],ankleR:[0,0,-.4],ankleL:[0,1.0,.3],shoulderR:sR(.2,0,-.5),elbowR:[0,0,1.2]}],[.33,{pelvis:[0,1.4,-.25],spine5:[0,-.3,-.12],hipR:side('R',1.35,.6,.4),kneeR:[0,0,-.15],ankleL:[0,1.0,.3]}],[.5,{pelvis:[0,.85,-.05],hipR:side('R',.6,.4,.3),kneeR:[0,0,-1.5]}],[.66,{}]]},
  highKick:{dur:.76,foot:'R',plant:'L',aim:{on:.08,hit:[.26,.37],off:.66,tgt:'head',through:.15,chamber:.75},keys:[[0,{}],[.12,{pelvis:[0,.85,-.1],hipR:side('R',.8,.4,.5),kneeR:[0,0,-1.7],ankleL:[0,.6,.2],head:[0,-.2,.2]}],[.28,{pelvis:[0,1.5,-.45],spine3:[0,-.35,-.25],spine5:[0,-.3,-.2],hipR:side('R',1.95,.75,.55),kneeR:[0,0,-.15],ankleR:[0,0,-.45],ankleL:[0,1.1,.35],shoulderR:sR(.3,0,-.7),elbowR:[0,0,1.0],head:[0,-.4,.3]}],[.37,{pelvis:[0,1.5,-.45],spine5:[0,-.3,-.2],hipR:side('R',1.95,.75,.55),kneeR:[0,0,-.15],ankleL:[0,1.1,.35],head:[0,-.4,.3]}],[.55,{pelvis:[0,.9,-.1],hipR:side('R',.8,.4,.5),kneeR:[0,0,-1.7]}],[.76,{}]]}
};
/* sample a clip: Hermite-smoothed interpolation of absolute channels, falling back to the base pose */
E2.sampleClip=function(clip,t,base){const K=clip.keys;let i=0;while(i<K.length-2&&t>K[i+1][0])i++;const k0=K[i],k1=K[Math.min(i+1,K.length-1)];const span=Math.max(1e-4,k1[0]-k0[0]);let u=Math.min(1,Math.max(0,(t-k0[0])/span));u=u*u*(3-2*u);
  const o=Object.assign({},base);const keys=new Set([...Object.keys(k0[1]),...Object.keys(k1[1])]);for(const k of keys){const a=k0[1][k]||base[k]||[0,0,0],b=k1[1][k]||base[k]||[0,0,0];o[k]=[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u]}return o};
})();
