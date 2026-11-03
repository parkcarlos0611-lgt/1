/* ===== Ragdoll2D.js : stable 2D ragdoll (position-based dynamics) =====
   Replaces Body.startRag / Body.stepRag of the inline engine.
   - Kinematic → physical blend: every joint is driven toward the last animated pose
     (rotated with the torso). Drive strength decays per joint; joints near the struck
     point go limp first (partial ragdoll), far joints keep their shape a little longer.
   - Impulse along the strike vector, applied at the struck joint and spread through
     the bone graph with falloff.
   - Rigid bones + soft shape constraints + joint angle limits (knee/elbow/spine/neck).
   - Sub-stepped CCD: per-frame displacement is split so no particle can cross the
     canvas floor or cage wall in one step; contacts resolve at velocity level with
     friction and low restitution; angular-velocity damping per bone; sleeping.
   World space: y up, floor at y = 0, cage walls at x = ±wall. */
const RAG_BONES=[['hip','mid'],['mid','sh'],['sh','nk'],['nk','hd'],['sh','lS'],['sh','rS'],['lS','lE'],['lE','lW'],['lW','lG'],['rS','rE'],['rE','rW'],['rW','rG'],['hip','lH'],['hip','rH'],['lH','lK'],['lK','lA'],['lA','lHe'],['lHe','lT'],['lA','lT'],['rH','rK'],['rK','rA'],['rA','rHe'],['rHe','rT'],['rA','rT']];
const RAG_SHAPE=[['hip','sh',.6],['mid','nk',.5],['sh','hd',.35],['lS','mid',.4],['rS','mid',.4],['lH','mid',.6],['rH','mid',.6],['lH','rH',1],['lS','rS',1]];
/* angle limits on chain a-b-c. sign: +1 = flexes toward facing (elbow), -1 = flexes away (knee), 0 = symmetric */
const RAG_LIMITS=[['lH','lK','lA',-1,-.05,2.55],['rH','rK','rA',-1,-.05,2.55],['lS','lE','lW',1,-.05,2.65],['rS','rE','rW',1,-.05,2.65],
  ['hip','mid','sh',0,-.7,.7],['mid','sh','nk',0,-.55,.55],['sh','nk','hd',0,-.9,.9],['lK','lA','lT',0,-2.4,2.4],['rK','rA','rT',0,-2.4,2.4]]  /* ankle: shin→foot turn is ~90° (1.57) when the foot is flat */;
const RAG_STRUCK={head:'hd',body:'mid',leg:'lK'};
class Ragdoll2D{
  constructor(body,o){const T=TUNING.ragdoll,J=body.J,H=body.H;this.body=body;this.T=T;this.d=body.d||1;this.t=0;this.ko=!!o.ko;this.asleep=false;this.still=0;this.wall=o.wall||4;this.contacts=new Set();
    const dtF=1/60;this.P={};
    for(const k in J){if(k==='lSn'||k==='rSn')continue;const q=J[k],pv=body._pJ&&body._pJ[k]||q;
      const r=k==='hd'?.085*H:k==='lG'||k==='rG'?.032*H:k==='lT'||k==='rT'||k==='lHe'||k==='rHe'?.022*H:.03*H;
      this.P[k]={x:q.x,y:Math.max(q.y,r),ox:q.x,oy:q.y,vx:clamp((q.x-pv.x)/dtF*.4,-3,3)+(o.vx||0),vy:clamp((q.y-pv.y)/dtF*.4,-3,3)+(o.vy||0),r,inv:k==='hip'||k==='mid'?.7:k==='hd'?.9:1}}
    /* constraints */
    const len=(a,b)=>Math.hypot(J[a].x-J[b].x,J[a].y-J[b].y);
    this.C=RAG_BONES.filter(([a,b])=>J[a]&&J[b]).map(([a,b])=>[a,b,len(a,b),1]);
    const ss=this.ko?T.shapeStiffKO:1;this.S=RAG_SHAPE.filter(([a,b])=>J[a]&&J[b]).map(([a,b,s])=>[a,b,len(a,b),(s<1?s*ss:s)]);
    this.L=RAG_LIMITS.filter(l=>J[l[0]]&&J[l[1]]&&J[l[2]]);
    /* graph depth from struck joint → per-joint blend time constant + impulse falloff */
    const src=RAG_STRUCK[o.zone]||'hd';const adj={};for(const[a,b]of RAG_BONES){(adj[a]=adj[a]||[]).push(b);(adj[b]=adj[b]||[]).push(a)}
    const depth={[src]:0},Q=[src];while(Q.length){const k=Q.shift();for(const n of adj[k]||[])if(depth[n]==null){depth[n]=depth[k]+1;Q.push(n)}}this.depth=depth;
    const B=this.ko?T.blendKO:T.blendKD;this.w0=B.w0;this.tau=B.tau;
    const imp=(this.ko?T.impulseKO:T.impulseKD)*(o.power||1);const ix=o.hx!=null?o.hx:this.d*-imp,iy=o.hy!=null?o.hy:.4;const n=Math.hypot(ix,iy)||1;
    for(const k in this.P){const f=Math.pow(T.impulseFalloff,depth[k]||0);this.P[k].vx+=ix/n*imp*f;this.P[k].vy+=iy/n*imp*f}
    /* kinematic target: offsets from hip in the animated pose, rotated with the torso */
    const hp=J.hip;this.off={};for(const k in this.P)this.off[k]={x:J[k].x-hp.x,y:J[k].y-hp.y};this.ta0=Math.atan2(J.sh.x-hp.x,J.sh.y-hp.y);
    /* subtree of every joint, rooted at the hip — limit corrections rotate a whole limb segment */
    const par={hip:null},ord=['hip'];for(let i=0;i<ord.length;i++){for(const n of adj[ord[i]]||[])if(!(n in par)){par[n]=ord[i];ord.push(n)}}
    this.sub_={};for(const k of ord){this.sub_[k]=[k]}for(let i=ord.length-1;i>0;i--){const k=ord[i];this.sub_[par[k]].push(...this.sub_[k].filter(x=>x!==par[k]))}
    this.flex0=this.L.map(l=>this.flex(l))}
  /* signed bend of chain a-b-c, expressed so that the anatomical flexion direction is positive */
  flex(l){const[a,b,c,sg]=l,P=this.P;const A=P[a],B=P[b],C=P[c];const v1x=B.x-A.x,v1y=B.y-A.y,v2x=C.x-B.x,v2y=C.y-B.y;const ang=Math.atan2(v1x*v2y-v1y*v2x,v1x*v2x+v1y*v2y);return sg===0?ang:ang*sg*this.d}
  drive(k){const D=this.depth[k]||0;return this.w0*Math.exp(-this.t/(this.tau*(1+D*.45)))}
  step(dt){if(this.asleep)return;const T=this.T,P=this.P;this.t+=dt;
    let vmax=0;for(const k in P){const p=P[k];vmax=Math.max(vmax,Math.hypot(p.vx,p.vy))}
    const minR=.022*this.body.H;const n=clamp(Math.ceil(vmax*dt/(minR*.5)),1,T.maxSubsteps);const h=dt/n;
    for(let s=0;s<n;s++)this.sub(h);
    /* sleeping: kills micro-jitter once the body has settled */
    let mv=0;for(const k in P){const p=P[k];mv=Math.max(mv,Math.hypot(p.vx,p.vy))}
    if(this.t>.4&&mv<T.sleepSpeed){this.still+=dt;if(this.still>T.sleepTime){this.asleep=true;for(const k in P){P[k].vx=P[k].vy=0}}}else this.still=0}
  sub(h){const T=this.T,P=this.P;const damp=Math.pow(this.ko?T.koLinearDamping:T.linearDamping,h*60);
    for(const k in P){const p=P[k];p.vx*=damp;p.vy=p.vy*damp-T.gravity*h;const sp=Math.hypot(p.vx,p.vy);if(sp>T.maxSpeed){p.vx*=T.maxSpeed/sp;p.vy*=T.maxSpeed/sp}p.ox=p.x;p.oy=p.y;p.x+=p.vx*h;p.y+=p.vy*h}
    /* kinematic drive (partial blend): a velocity-neutral shape correction (x and ox move together),
       so it holds the animated shape without pumping energy into the body; scaled by h so it is substep-independent */
    const hp=P.hip;const ta=Math.atan2(P.sh.x-hp.x,P.sh.y-hp.y);const dr=ta-this.ta0;const cs=Math.cos(-dr),sn=Math.sin(-dr);
    for(const k in P){if(k==='hip')continue;const w=this.drive(k);if(w<.004)continue;const o=this.off[k];const tx=hp.x+o.x*cs-o.y*sn,ty=hp.y+o.x*sn+o.y*cs;const p=P[k];const ddx=(tx-p.x)*w*.35*h*60,ddy=(Math.max(ty,p.r)-p.y)*w*.35*h*60;p.x+=ddx;p.y+=ddy;p.ox+=ddx;p.oy+=ddy}
    for(let it=0;it<T.iterations;it++){
      for(const c of this.C)this.dist(c);for(const c of this.S)this.dist(c);
      for(const l of this.L)this.limit(l);
      this.collide()}
    /* velocities from positions, then contact response at velocity level */
    this.contacts.clear();
    for(const k in P){const p=P[k];p.vx=(p.x-p.ox)/h;p.vy=(p.y-p.oy)/h;const sp=Math.hypot(p.vx,p.vy);if(sp>T.maxSpeed){p.vx*=T.maxSpeed/sp;p.vy*=T.maxSpeed/sp}
      if(p.y<=p.r+1e-4){this.contacts.add(k);if(p.vy<0)p.vy=-p.vy*T.restitution;p.vx*=Math.max(0,1-T.friction*h*60*.5);const cd=Math.max(0,1-T.contactDamping*h*60);p.vx*=cd;p.vy*=cd}
      const W=this.wall-p.r;if(Math.abs(p.x)>=W-1e-4){this.contacts.add(k);const sd=Math.sign(p.x);if(p.vx*sd>0)p.vx=-p.vx*T.restitution;p.vy*=Math.max(0,1-T.friction*h*60*.3)}}
    /* angular velocity damping: remove part of each bone's relative spin */
    const ad=1-Math.pow(1-T.angularDamping,h*60);for(const[a,b]of this.C){const A=P[a],B=P[b];const bx=B.x-A.x,by=B.y-A.y,L=Math.hypot(bx,by)||1e-6;const nx=-by/L,ny=bx/L;const rv=(B.vx-A.vx)*nx+(B.vy-A.vy)*ny;const k=rv*ad*.5;
      const wa=A.inv/(A.inv+B.inv),wb=B.inv/(A.inv+B.inv);A.vx+=nx*k*wa*2;A.vy+=ny*k*wa*2;B.vx-=nx*k*wb*2;B.vy-=ny*k*wb*2}}
  dist(c){const[a,b,L,st]=c,A=this.P[a],B=this.P[b];const dx=B.x-A.x,dy=B.y-A.y,D=Math.hypot(dx,dy)||1e-6;const w=A.inv+B.inv;const f=(D-L)/D*st/w;A.x+=dx*f*A.inv;A.y+=dy*f*A.inv;B.x-=dx*f*B.inv;B.y-=dy*f*B.inv}
  /* joint limits as momentum-conserving PBD constraints:
     over-flexion → minimum a–c distance (law of cosines);  reverse bend → move the middle
     joint back across the a–c line (b +2/3, a and c −1/3 each, so no net impulse). */
  limit(l){const[a,b,c,sg,mn,mx]=l;const P=this.P,A=P[a],B=P[b],C=P[c];const f=this.flex(l);const k=this.T.limitStiffness;
    if(sg===0?Math.abs(f)>mx:f>mx){const La=Math.hypot(B.x-A.x,B.y-A.y),Lb=Math.hypot(C.x-B.x,C.y-B.y);const dmin=Math.sqrt(La*La+Lb*Lb+2*La*Lb*Math.cos(mx));
      const dx=C.x-A.x,dy=C.y-A.y,D=Math.hypot(dx,dy)||1e-6;if(D<dmin){const q=(dmin-D)/D*.5*k;A.x-=dx*q;A.y-=dy*q;C.x+=dx*q;C.y+=dy*q}}
    else if(sg!==0&&f<mn){const dx=C.x-A.x,dy=C.y-A.y,D=Math.hypot(dx,dy)||1e-6;const nx=-dy/D,ny=dx/D;const h=(B.x-A.x)*nx+(B.y-A.y)*ny;const q=-h*k;
      B.x+=nx*q*2/3;B.y+=ny*q*2/3;A.x-=nx*q/3;A.y-=ny*q/3;C.x-=nx*q/3;C.y-=ny*q/3}}
  collide(){const P=this.P;for(const k in P){const p=P[k];
      /* swept floor test: if the step crossed the floor, place the particle at the crossing point */
      if(p.y<p.r){if(p.oy>=p.r&&p.oy!==p.y){const t=(p.oy-p.r)/(p.oy-p.y);p.x=p.ox+(p.x-p.ox)*t}p.y=p.r}
      const W=this.wall-p.r;if(p.x>W)p.x=W;else if(p.x<-W)p.x=-W}}
  /* write particle positions back into the skeleton the renderer uses */
  writeBack(){const B=this.body,J=B.J,P=this.P;for(const k in P)J[k]={x:P[k].x,y:P[k].y};const mx=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});J.lSn=mx(J.lK,J.lA,.7);J.rSn=mx(J.rK,J.rA,.7);
    const an=(a,b)=>Math.atan2((b.x-a.x)*B.d,b.y-a.y);B.ang={ta:an(J.hip,J.sh),hd:an(J.nk,J.hd)+.1,lo:0,ro:0}}
  stats(){let ke=0,pen=0,lim=0;for(const k in this.P){const p=this.P[k];ke+=p.vx*p.vx+p.vy*p.vy;pen=Math.max(pen,p.r-p.y)}for(const l of this.L){const f=this.flex(l);lim=Math.max(lim,l[4]-f,f-l[5])}return{ke,pen,lim:Math.max(0,lim),asleep:this.asleep,t:this.t}}
}
/* ---- hook into the inline engine ---- */
Body.prototype.startRag=function(vx,vy,hx,hy){const hit=this._hit||{};this.rag=new Ragdoll2D(this,{vx,vy,hx,hy,ko:this.ko,zone:hit.zone,power:hit.power,wall:hit.wall});this._hit=null};
Body.prototype.stepRag=function(dt){this.rag.step(dt);this.rag.writeBack()};
