/* ===== engine2/physics.js : active ragdoll body =====
   Every joint of the skeleton is a physics particle (mass, radius). Each substep:
     1. muscles: a spring-damper pulls each particle toward its animation target (target position and
        velocity from FK), strength = group frequency × "tone" (0..1);
     2. gravity, integration;
     3. constraints (PBD): bone lengths, shape braces (pelvis, rib cage, skull, hand, foot keep their shape),
        joint limits (knees / elbows bend one way, neck and spine stay within range), floor with friction;
     4. collisions against the other fighter's body capsules with momentum exchange — a fist or shin that
        reaches the opponent pushes the struck particles (and is pushed back), which is what makes a head snap,
        a torso twist or knees buckle.
   Impacts also lower muscle tone around the contact (it recovers over ~0.5 s) and feed the skin layer
   (render.js) with a dent. KO sets tone to ~0 so the body falls as a pure ragdoll. */
(function(){const V=E2.V,B=E2.BONES,IDX=E2.IDX;
const PH=E2.PH={substeps:3,iters:6,gravity:9.81,damp:.25,
  freq:{core:7,arm:8,finger:6,leg:9,toe:7},zeta:.55,
  floorFric:.85,walkSpeed:1.5,turnRate:7,arenaR:3.55,minGap:.62,impactScale:1,strikeBoost:1.8,maxDv:3.5,strikerMass:{hand:3.2,foot:5.5,knee:7,elbow:3.5},minImpactSpeed:1.2,
  toneRecover:2.0,koTone:.025};
const CAPS=[['pelvis','spine3',.15,'body'],['spine3','spine5',.15,'body'],['spine5','neck1',.085,'body'],['neck1','head',.06,'head'],['head','headTop',.1,'head'],
  ['shoulderL','elbowL',.055,'arm'],['elbowL','wristL',.045,'arm'],['wristL','handL',.05,'arm'],['shoulderR','elbowR',.055,'arm'],['elbowR','wristR',.045,'arm'],['wristR','handR',.05,'arm'],
  ['hipL','kneeL',.08,'leg'],['kneeL','ankleL',.055,'leg'],['heelL','ballL',.04,'leg'],['hipR','kneeR',.08,'leg'],['kneeR','ankleR',.055,'leg'],['heelR','ballR',.04,'leg']].map(([a,b,r,z])=>({a:IDX[a],b:IDX[b],r,z}));
const STRIKERS=[['handL','hand'],['handR','hand'],['ballL','foot'],['ballR','foot'],['ankleL','foot'],['ankleR','foot'],['kneeL','knee'],['kneeR','knee'],['elbowL','elbow'],['elbowR','elbow']].map(([n,k])=>({i:IDX[n],k}));
E2.CAPS=CAPS;
class Body{
  constructor(o){Object.assign(this,{yaw:0,cx:0,cz:0,side:0,name:'fighter',corner:'#c41010'},o);const n=B.length;this.n=n;
    const F=k=>new Float32Array(n);this.x=F();this.y=F();this.z=F();this.vx=F();this.vy=F();this.vz=F();this.ox=F();this.oy=F();this.oz=F();
    this.tx=F();this.ty=F();this.tz=F();this.tvx=F();this.tvy=F();this.tvz=F();this.tone=F();this.fm=F();this.inv=F();this.r=F();this.grp=[];
    for(let i=0;i<n;i++){const b=B[i];this.inv[i]=1/b.m;this.r[i]=b.g==='finger'||b.g==='toe'?.008:Math.min(.045,b.r*.5);this.tone[i]=1;this.fm[i]=1;this.grp[i]=b.g}
    this.t=0;this.clip=null;this.mv={x:0,z:0};this.vxr=0;this.vzr=0;this.gph=0;this.ko=false;this.base=this.lowGuard?E2.lowGuard():E2.guard();this.hits=[];
    this.computeTarget(0,true);for(let i=0;i<n;i++){this.x[i]=this.tx[i];this.y[i]=this.ty[i];this.z[i]=this.tz[i]}
    this.buildConstraints();if(E2.skinInit)E2.skinInit(this)}
  /* ---- animation target ---- */
  play(name){const c=E2.CLIPS[name];if(!c||this.ko)return false;this.clip={c,t:0,name,hit:false};return true}
  pose(dt){let p=this.base;const t=this.t;
    /* idle life: breathing, light bounce, hands circling a little */
    const br=Math.sin(t*1.6),bo=Math.sin(t*4.2);p=E2.blend(p,{spine3:[0,0,.012],spine5:[0,0,.012],shoulderL:[0,0,.04],shoulderR:[0,0,-.03],kneeL:[0,0,-.06],kneeR:[0,0,-.05],head:[0,0,-.02]},br*.5+bo*.5);
    /* footwork: alternating steps from the root velocity, split into forward/back and lateral components so a
       fighter can advance, retreat and circle (the steps follow the body's own facing) */
    const sp=Math.hypot(this.vxr,this.vzr);if(sp>.05){this.gph+=sp*dt*7.5;const amp=Math.min(1,sp/1.1),Fx=Math.cos(this.yaw),Fz=-Math.sin(this.yaw);
      const fv=(this.vxr*Fx+this.vzr*Fz)/sp,lv=(this.vxr*-Fz+this.vzr*Fx)*-1/sp;const sn=Math.sin(this.gph),cs=Math.cos(this.gph);
      p=E2.blend(p,{hipL:E2.side('L',.16*lv*sn,0,.32*fv*sn),hipR:E2.side('R',-.16*lv*sn,0,-.32*fv*sn),kneeL:[0,0,-.55*Math.max(0,cs)],kneeR:[0,0,-.55*Math.max(0,-cs)],ankleL:[0,0,.25*Math.max(0,cs)],ankleR:[0,0,.25*Math.max(0,-cs)],spine3:[0,.05*fv*sn,0]},amp)}
    if(this.clip){const C=this.clip;C.t+=dt;if(C.t>=C.c.dur)this.clip=null;else p=E2.sampleClip(C.c,C.t,p)}return p}
  computeTarget(dt,init){const pose=this.pose(dt);const rt=pose.root||[0,0,0];/* root step along the facing direction */const fx=Math.cos(this.yaw),fz=-Math.sin(this.yaw);let fk=E2.fk(pose,{pos:V.n(this.cx+fx*rt[0],1.0+rt[1],this.cz+fz*rt[0]),yaw:this.yaw});
    /* stand on the mat: lowest foot point at floor level; keep the planted foot where it is during kicks */
    let lo=9;for(const n of['heelL','ballL','heelR','ballR','t1cL','t1cR'])lo=Math.min(lo,fk.P[IDX[n]].y-.012);
    let dx=0,dz=0;const plant=this.clip&&this.clip.c.plant;if(plant){const a=fk.P[IDX['ankle'+plant]];if(!this.plantAt)this.plantAt={x:a.x,z:a.z};dx=this.plantAt.x-a.x;dz=this.plantAt.z-a.z}else this.plantAt=null;
    /* to world: floor alignment + planted foot */
    const n=this.n,h=Math.max(dt,1e-4);const P=fk.P;for(let i=0;i<n;i++){const q=P[i];P[i]={x:q.x+dx,y:q.y-lo,z:q.z+dz}}
    /* strike aiming: the striking limb is solved with IK toward the opponent's real body (this is what makes a
       jab land on the head wherever it is), passing a little through the target so contact happens */
    /* the striking limb fires faster (stiffer drive) while a strike is on */
    this.fm.fill(1);const C=this.clip;if(C){const root=C.c.hand?IDX['shoulder'+C.c.hand]:C.c.foot?IDX['hip'+C.c.foot]:-1;if(root>=0){this.fm[root]=PH.strikeBoost;for(const k of E2.DESC[root])this.fm[k]=PH.strikeBoost}}
    if(C&&C.c.aim&&this.opp){const A=C.c.aim,t=C.t;/* extension accelerates into the target (ease-in), so the fist / shin is still fast at contact */const w=t<A.on?0:t<A.hit[0]?Math.pow((t-A.on)/(A.hit[0]-A.on),1.8):t<=A.hit[1]?1:t<A.off?1-E2.ease((t-A.hit[1])/(A.off-A.hit[1])):0;
      if(w>0){const O=this.opp,oi=n=>V.n(O.x[IDX[n]],O.y[IDX[n]],O.z[IDX[n]]);let T;const tg=A.tgt;
        if(tg==='head')T=V.lerp(oi('head'),oi('headTop'),.35);else if(tg==='chin')T=V.lerp(oi('chin'),oi('neck2'),.3);else if(tg==='liver')T=V.lerp(oi('spine1'),oi('spine2'),.5);else if(tg==='ribs')T=oi('spine3');else T=V.lerp(oi('hipL'),oi('kneeL'),.45);
        const F=V.n(Math.cos(this.yaw),0,-Math.sin(this.yaw));
        if(C.c.hand){const S=C.c.hand,sh=P[IDX['shoulder'+S]];const dir=V.norm(V.sub(T,sh));T=V.madd(T,dir,A.through);
          if(A.arc){const out=V.norm(V.cross(V.n(0,1,0),dir));const sgn=S==='L'?1:-1;T=V.madd(T,out,-A.arc*Math.sin(Math.PI*Math.min(1,w))*(1-w)*sgn)}
          if(A.lift)T=V.madd(T,V.n(0,-1,0),A.lift*(1-w));
          const pole=A.arc?V.n(0,-.3,0):V.add(V.n(0,-1,0),V.sc(F,-.4));E2.aimLimb(P,IDX['shoulder'+S],IDX['elbow'+S],IDX['wrist'+S],T,pole,w)}
        else if(C.c.foot){const S=C.c.foot,hp=P[IDX['hip'+S]];const dir=V.norm(V.sub(T,hp));T=V.madd(T,dir,A.through);
          /* chamber: the knee lifts first (goal pulled in toward the hip), then the shin snaps through */
          const ch=A.chamber||.4;const k=Math.min(1,w*1.6);const mid=V.add(hp,V.sc(V.sub(T,hp),.55));const goal=V.lerp(mid,T,Math.max(0,(w-.35)/.65));
          const out=V.norm(V.cross(dir,V.n(0,1,0)));const pole=V.add(V.n(0,ch,0),V.sc(out,S==='R'?.6:-.6));
          E2.aimLimb(P,IDX['hip'+S],IDX['knee'+S],IDX['ankle'+S],goal,pole,k)}}}
    for(let i=0;i<n;i++){const q=P[i];if(!init){this.tvx[i]=(q.x-this.tx[i])/h;this.tvy[i]=(q.y-this.ty[i])/h;this.tvz[i]=(q.z-this.tz[i])/h}this.tx[i]=q.x;this.ty[i]=q.y;this.tz[i]=q.z}
    this.fk=fk}
  /* ---- constraints from the rest (guard) shape ---- */
  buildConstraints(){const C=[],x=this.x,y=this.y,z=this.z;const d=(a,b)=>Math.hypot(x[a]-x[b],y[a]-y[b],z[a]-z[b]);const add=(a,b,st,range)=>{const L=d(a,b);C.push([a,b,L,st||1,range?L*(1-range):L,range?L*(1+range):L])};
    for(const b of B)if(b.pi>=0)add(b.i,b.pi,1);
    const I=n=>IDX[n];const braces=[['hipL','hipR'],['hipL','spine1'],['hipR','spine1'],['hipL','spine2',0,.04],['hipR','spine2',0,.04],['spine1','spine3',0,.06],['spine2','spine4',0,.06],['spine3','spine5',0,.05],
      ['clavL','clavR'],['shoulderL','shoulderR'],['shoulderL','spine4'],['shoulderR','spine4'],['shoulderL','spine3',0,.05],['shoulderR','spine3',0,.05],['clavL','spine4'],['clavR','spine4'],['neck1','spine4',0,.05],
      ['spine5','neck2',0,.2],['spine5','head',0,.35],['neck1','head',0,.25],['head','nose'],['headTop','nose'],['headTop','neck2',0,.2],   /* neck: wide ranges so it bends (head snaps) instead of acting as a rod */['jaw','nose'],['jaw','headTop'],['chin','jaw'],['chin','nose'],['earL','earR'],['earL','nose'],['earR','nose'],['eyeL','headTop'],['eyeR','headTop'],['eyeL','eyeR'],['browL','headTop'],['browR','headTop'],['earL','headTop'],['earR','headTop'],['chin','headTop'],
      ['heelL','ballL'],['heelR','ballR'],['ankleL','ballL'],['ankleR','ballR']];
    for(const[a,b,st,r]of braces)add(I(a),I(b),st||1,r);
    for(const S of['L','R']){for(const f of['index1','middle1','ring1','pinky1','thumb1'])add(I(f+S),I('wrist'+S));add(I('index1'+S),I('pinky1'+S));for(const t of['t1a','t3a','t5a'])add(I(t+S),I('heel'+S))}
    this.C=C;
    /* hinge limits: [proximal, joint, distal, sign] — the joint must stay on the anatomical side of the line */
    this.hinges=['L','R'].flatMap(S=>[[I('hip'+S),I('knee'+S),I('ankle'+S),1],[I('shoulder'+S),I('elbow'+S),I('wrist'+S),-1]]);
    this.minFold=['L','R'].flatMap(S=>[[I('hip'+S),I('ankle'+S),.12],[I('shoulder'+S),I('wrist'+S),.1]])}
  /* forward direction of the body (from the pelvis / chest particles) */
  fwd(){const x=this.x,z=this.z;const a=IDX.hipL,b=IDX.hipR;const lx=x[a]-x[b],lz=z[a]-z[b];/* left → forward is a +90° turn about y */return V.norm(V.n(-lz,0,lx))}
  /* ---- simulation step ---- */
  /* root motion: input → velocity (accelerated), face the opponent, stay inside the cage, no overlap */
  move(dt){const O=this.opp;let tx=0,tz=0;if(!this.ko){const m=Math.hypot(this.mv.x,this.mv.z);const k=m>1?1/m:1;const slow=this.clip?(this.clip.c.plant?0:.35):1;tx=this.mv.x*k*PH.walkSpeed*slow;tz=this.mv.z*k*PH.walkSpeed*slow}
    const a=Math.min(1,dt*9);this.vxr+=(tx-this.vxr)*a;this.vzr+=(tz-this.vzr)*a;this.cx+=this.vxr*dt;this.cz+=this.vzr*dt;
    const r=Math.hypot(this.cx,this.cz);if(r>PH.arenaR){this.cx*=PH.arenaR/r;this.cz*=PH.arenaR/r}
    if(O&&!this.ko){const dx=O.cx-this.cx,dz=O.cz-this.cz,d=Math.hypot(dx,dz);if(d<PH.minGap&&d>1e-4&&!O.ko){const push=(PH.minGap-d)*.5;this.cx-=dx/d*push;this.cz-=dz/d*push;O.cx+=dx/d*push;O.cz+=dz/d*push}
      if(!(this.clip&&this.clip.c.plant)){const want=Math.atan2(-dz,dx);let dy=want-this.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));this.yaw+=Math.max(-PH.turnRate*dt,Math.min(PH.turnRate*dt,dy))}}}
  step(dt){this.t+=dt;this.move(dt);this.computeTarget(dt);const S=PH.substeps,h=dt/S;for(let s=0;s<S;s++)this.sub(h);
    for(let i=0;i<this.n;i++){const tn=this.ko?PH.koTone:1;this.tone[i]+=(tn-this.tone[i])*Math.min(1,PH.toneRecover*dt)}
    if(E2.skinStep)E2.skinStep(this,dt)}
  sub(h){const n=this.n,x=this.x,y=this.y,z=this.z,vx=this.vx,vy=this.vy,vz=this.vz;const g=PH.gravity,Z=PH.zeta;
    for(let i=0;i<n;i++){const w=2*Math.PI*PH.freq[this.grp[i]]*this.tone[i]*this.fm[i];const k=w*w,c=2*Z*w;
      const ax=k*(this.tx[i]-x[i])+c*(this.tvx[i]-vx[i]),ay=k*(this.ty[i]-y[i])+c*(this.tvy[i]-vy[i])-g,az=k*(this.tz[i]-z[i])+c*(this.tvz[i]-vz[i]);
      const dmp=Math.exp(-PH.damp*h);vx[i]=(vx[i]+ax*h)*dmp;vy[i]=(vy[i]+ay*h)*dmp;vz[i]=(vz[i]+az*h)*dmp;
      this.ox[i]=x[i];this.oy[i]=y[i];this.oz[i]=z[i];x[i]+=vx[i]*h;y[i]+=vy[i]*h;z[i]+=vz[i]*h}
    for(let it=0;it<PH.iters;it++){this.solve();if(this.opp&&this.side===0)collide(this,this.opp,it===0,h);this.floor()}
    for(let i=0;i<n;i++){vx[i]=(x[i]-this.ox[i])/h;vy[i]=(y[i]-this.oy[i])/h;vz[i]=(z[i]-this.oz[i])/h;
      if(y[i]<=this.r[i]+1e-4){vx[i]*=1-PH.floorFric;vz[i]*=1-PH.floorFric;if(vy[i]<0)vy[i]=0}}}
  solve(){const x=this.x,y=this.y,z=this.z,iv=this.inv;
    for(const c of this.C){const a=c[0],b=c[1];const dx=x[b]-x[a],dy=y[b]-y[a],dz=z[b]-z[a];const D=Math.hypot(dx,dy,dz)||1e-9;let L=D<c[4]?c[4]:D>c[5]?c[5]:D;if(L===D)continue;
      const w=iv[a]+iv[b];const f=(D-L)/D/w*c[3];x[a]+=dx*f*iv[a];y[a]+=dy*f*iv[a];z[a]+=dz*f*iv[a];x[b]-=dx*f*iv[b];y[b]-=dy*f*iv[b];z[b]-=dz*f*iv[b]}
    /* hinges: knee in front of the hip–ankle line, elbow behind the shoulder–wrist line (body forward) */
    const F=this.fwd();for(const[a,j,b,sg]of this.hinges){const mx=(x[a]+x[b])/2,my=(y[a]+y[b])/2,mz=(z[a]+z[b])/2;const off=((x[j]-mx)*F.x+(z[j]-mz)*F.z)*sg;if(off<-.005){const k=(-off-.005)*.5;x[j]+=F.x*k*sg;z[j]+=F.z*k*sg}}
    for(const[a,b,mf]of this.minFold){const dx=x[b]-x[a],dy=y[b]-y[a],dz=z[b]-z[a];const D=Math.hypot(dx,dy,dz)||1e-9;if(D<mf){const f=(D-mf)/D*.5;x[a]+=dx*f;y[a]+=dy*f;z[a]+=dz*f;x[b]-=dx*f;y[b]-=dy*f;z[b]-=dz*f}}}
  floor(){const y=this.y;for(let i=0;i<this.n;i++){const r=this.r[i];if(y[i]<r)y[i]=r}}
  /* ---- impacts ---- */
  impact(p,nrm,J,zone){/* p: contact point, nrm: push direction, J: impulse (N·s) */const x=this.x,y=this.y,z=this.z;const k=Math.min(.95,J/6);
    for(let i=0;i<this.n;i++){const d=Math.hypot(x[i]-p.x,y[i]-p.y,z[i]-p.z);const f=Math.max(0,1-d/.38);if(f>0)this.tone[i]*=1-k*f}
    if(zone==='head'){/* head shots buckle the knees and loosen the spine */for(const nm of['kneeL','kneeR','hipL','hipR','spine1','spine2','spine3','neck1','neck2','head'])this.tone[IDX[nm]]*=1-k*.55}
    this.hits.push({p,nrm,J,zone,t:this.t});if(this.hits.length>12)this.hits.shift();if(E2.skinImpact)E2.skinImpact(this,p,nrm,J);if(this.onHit)this.onHit(p,J,zone)}
  poke(p,dir,J){/* external hit (mouse): impulse to particles near p */const x=this.x,y=this.y,z=this.z;let best=-1,bd=9;for(let i=0;i<this.n;i++){const d=Math.hypot(x[i]-p.x,y[i]-p.y,z[i]-p.z);if(d<bd){bd=d;best=i}}
    let zone='body';for(const c of CAPS){if(c.a===best||c.b===best){zone=c.z;break}}
    for(let i=0;i<this.n;i++){const d=Math.hypot(x[i]-p.x,y[i]-p.y,z[i]-p.z);const f=Math.max(0,1-d/.3);if(f>0){const dv=J*f*this.inv[i]*PH.impactScale*.6;this.vx[i]+=dir.x*dv;this.vy[i]+=dir.y*dv;this.vz[i]+=dir.z*dv}}
    this.impact(p,dir,J,zone)}
  setGuard(up){this.lowGuard=!up;this.base=up?E2.guard():E2.lowGuard()}
  setKO(v){this.ko=v;if(v){this.clip=null;for(let i=0;i<this.n;i++)this.tone[i]=Math.min(this.tone[i],.3)}}
}
E2.Body=Body;
/* closest point on segment ab to p */
function seg(ax,ay,az,bx,by,bz,px,py,pz){const dx=bx-ax,dy=by-ay,dz=bz-az;const L=dx*dx+dy*dy+dz*dz||1e-9;let t=((px-ax)*dx+(py-ay)*dy+(pz-az)*dz)/L;t=t<0?0:t>1?1:t;return[ax+dx*t,ay+dy*t,az+dz*t,t]}
/* attacker's strikers vs defender's capsules (both ways), inelastic momentum exchange */
function collide(A,Bd,detect,h){for(const[att,def]of[[A,Bd],[Bd,A]]){const x=att.x,y=att.y,z=att.z;
  for(const s of STRIKERS){const i=s.i;const rs=s.k==='hand'?.06:.05;
    for(const c of CAPS){const X=def.x,Y=def.y,Zz=def.z;const[cx,cy,cz,t]=seg(X[c.a],Y[c.a],Zz[c.a],X[c.b],Y[c.b],Zz[c.b],x[i],y[i],z[i]);
      const dx=x[i]-cx,dy=y[i]-cy,dz=z[i]-cz;const D=Math.hypot(dx,dy,dz);const R=rs+c.r;if(D>=R||D<1e-6)continue;
      const nx=dx/D,ny=dy/D,nz=dz/D;const pen=R-D;
      /* relative velocity along the normal (striker vs struck surface) */
      const svx=(x[i]-att.ox[i]),svy=(y[i]-att.oy[i]),svz=(z[i]-att.oz[i]);
      const cvx=((X[c.a]-def.ox[c.a])*(1-t)+(X[c.b]-def.ox[c.b])*t),cvy=((Y[c.a]-def.oy[c.a])*(1-t)+(Y[c.b]-def.oy[c.b])*t),cvz=((Zz[c.a]-def.oz[c.a])*(1-t)+(Zz[c.b]-def.oz[c.b])*t);
      const vn=((svx-cvx)*nx+(svy-cvy)*ny+(svz-cvz)*nz)/h;/* < 0: approaching */
      const ms=PH.strikerMass[s.k],mc=1/(def.inv[c.a]*(1-t)+def.inv[c.b]*t);
      /* positional separation by mass */const wa=1/ms/(1/ms+1/mc),wb=1-wa;x[i]+=nx*pen*wa;y[i]+=ny*pen*wa;z[i]+=nz*pen*wa;
      for(const[j,ww]of[[c.a,1-t],[c.b,t]]){X[j]-=nx*pen*wb*ww;Y[j]-=ny*pen*wb*ww;Zz[j]-=nz*pen*wb*ww}
      if(detect&&vn<-PH.minImpactSpeed){const J=-vn/(1/ms+1/mc)*PH.impactScale;const dvb=Math.min(PH.maxDv,J/mc);/* capped: a punch snaps the head, it does not launch the body */
        /* PBD: velocity = (x − ox)/h, so shifting ox adds a velocity change */
        for(const[j,ww]of[[c.a,1-t],[c.b,t]]){def.ox[j]+=nx*dvb*ww*h;def.oy[j]+=ny*dvb*ww*h;def.oz[j]+=nz*dvb*ww*h}
        /* part of the push travels into the connected chain (neck, upper spine) */for(const pj of[def.inv[c.a]>0?E2.BONES[c.a].pi:-1,E2.BONES[c.b].pi]){if(pj>=0){const d2=Math.min(PH.maxDv*.5,J/mc*.35);def.ox[pj]+=nx*d2*h;def.oy[pj]+=ny*d2*h;def.oz[pj]+=nz*d2*h}}
        const dva=J/ms;att.ox[i]-=nx*dva*.6*h;att.oy[i]-=ny*dva*.6*h;att.oz[i]-=nz*dva*.6*h;
        if(!def._lastHitT||def.t-def._lastHitT>.12){def._lastHitT=def.t;def.impact({x:cx,y:cy,z:cz},{x:-nx,y:-ny,z:-nz},J,c.z)}}}}}}
})();
