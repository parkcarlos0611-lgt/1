/* ===== FootPlant.js : foot-planting IK for standing poses =====
   Body.solve builds both legs from pose angles (forward kinematics) and then lowers the
   whole body until its single lowest point touches the mat, so in many stances one foot
   floats or both stand on tiptoe. This post-pass plants every *support* foot:
     1. a leg whose lowest point is within plantDist of the mat is a support leg
        (kicks, knees and high steps stay untouched; weight blends smoothly in between);
     2. its toe stays where it is horizontally; the sole is laid on the mat
        (lead heel down, rear heel slightly raised as in a real fighting stance);
     3. if a support leg cannot reach, the whole body sinks a little (bent knees),
     4. hip→knee→ankle is re-solved with 2-bone IK, knee bending toward the facing side.
   Runs only for upright, non-free poses (not ground grappling, not ragdoll). */
const FP=tuneSection('feet',{
  on:true,
  plantDist:.075,     // ×H: lowest foot point closer than this = fully planted
  releaseDist:.14,    // ×H: farther than this = free (kick / knee / step)
  leadHeel:.004,      // ×H heel height of the lead foot
  rearHeel:.03,       // ×H heel height of the rear foot (on the ball of the foot)
  maxSink:.06,        // ×H the body may lower this much so both feet reach the mat
  minHip:.32,         // ×H below this hip height the pose is not "standing" (sit-ups, getups)
  /* procedural stepping: a planted foot stays where it is; when the animated foot target drifts away by more
     than stepThr the foot steps there along an arc (toe-off, lift, set down). One foot at a time unless the
     error is huge (stepForce). Moving forward the lead foot goes first, backing up the rear foot. */
  step:true, stepThr:.11, stepThrMove:.06, stepForce:.26, overlap:.55, lead:.75, settle:.045, settleT:.45, stepDur:.11, stepLift:.07
});
function ik2(h,a,L1,L2,kd){/* knee position for hip h, ankle a; kd = preferred side (+1 forward) */
  let dx=a.x-h.x,dy=a.y-h.y;let D=Math.hypot(dx,dy)||1e-6;const mx=(L1+L2)*.999;if(D>mx){dx*=mx/D;dy*=mx/D;D=mx}
  const ca=clamp((L1*L1+D*D-L2*L2)/(2*L1*D),-1,1),ang=Math.acos(ca);const bx=dx/D,by=dy/D;
  const k1={x:h.x+(bx*Math.cos(ang)-by*Math.sin(ang))*L1,y:h.y+(bx*Math.sin(ang)+by*Math.cos(ang))*L1};
  const k2={x:h.x+(bx*Math.cos(-ang)-by*Math.sin(-ang))*L1,y:h.y+(bx*Math.sin(-ang)+by*Math.cos(-ang))*L1};
  return((k1.x-k2.x)*kd>=0?k1:k2)}
Body.prototype.plantFeet=function(p){if(!FP.on||this.rag||p.free){this._feet=null;this._hipX=null;return}const J=this.J,L=this.L,H=this.H,d=this.d||1;if(!J.hip||J.hip.y<FP.minHip*H){this._feet=null;this._hipX=null;return}
  const legs=[['l','lH','lK','lA','lHe','lT'],['r','rH','rK','rA','rHe','rT']];const leadSide='l';/* l* joints are always the lead leg (see Body.draw) */
  const ctl=this._standCtl;/* standing fighter: legs are support unless that leg is kicking / kneeing (set per frame by the fighter) */
  const info=legs.map(([s,h,k,a,he,t])=>{const lo=Math.min(J[he].y,J[t].y);let w=clamp((FP.releaseDist*H-lo)/((FP.releaseDist-FP.plantDist)*H),0,1);if(ctl)w=this._legFree===s?w:1;return{s,h,k,a,he,t,w,lo}});
  /* stepping state (advances only on real frames: _dt is set by the fighter's pose pass and consumed here) */
  const dt=this._dt||0;this._dt=0;let F=this._feet;if(F&&this._hipX!=null&&Math.abs(J.hip.x-this._hipX)>.6*H)F=null;if(!F)F=this._feet={};
  const vx=dt>0&&this._hipX!=null?clamp((J.hip.x-this._hipX)/dt,-5,5):0;if(dt>0)this._hipX=J.hip.x;
  if(FP.step){for(const g of info){if(g.w<.99){F[g.s]=null;continue}if(!F[g.s])F[g.s]={x:J[g.t].x,st:0,idle:0}}
    if(dt>0){const moving=Math.abs(vx)>.3;/* aim ahead of the body while moving so the foot lands where the hips are going */
      const aim=g=>J[g.t].x+(moving?vx*FP.stepDur*FP.lead*2:0);const err=g=>aim(g)-F[g.s].x;const ok=g=>F[g.s]&&!F[g.s].st;const thr=(moving?FP.stepThrMove:FP.stepThr)*H;
      for(const g of info){const s=F[g.s];if(s&&!s.st)s.idle=Math.abs(err(g))>FP.settle*H&&Math.abs(vx)<.3?s.idle+dt:0}
      const cand=this._legFree?[]:/* kicking: the support foot is the pivot and stays put */info.filter(g=>ok(g)&&(Math.abs(err(g))>thr||F[g.s].idle>FP.settleT));const busy=info.some(g=>F[g.s]&&F[g.s].st&&F[g.s].t<FP.overlap);
      if(cand.length&&(!busy||cand.some(g=>Math.abs(err(g))>FP.stepForce*H))){cand.sort((a,b)=>Math.abs(err(b))-Math.abs(err(a)));let g=cand[0];const pref=cand.find(c=>c.s===(vx*d>0?'l':'r'));if(pref&&Math.abs(vx)>.3)g=pref;
        const s=F[g.s];s.st=1;s.t=0;s.from=s.x;s.idle=0;s.dur=clamp(FP.stepDur+Math.abs(err(g))/H*.15,.09,.2)/(moving?Math.min(1.5,.8+Math.abs(vx)*.15):1)}
      for(const g of info){const s=F[g.s];if(!s||!s.st)continue;s.t+=dt/s.dur;const tgt=aim(g);if(s.t>=1){s.x=tgt;s.st=0;s.lift=0}else{s.cx=s.from+(tgt-s.from)*ease(s.t);s.lift=Math.sin(Math.PI*s.t)*FP.stepLift*H*Math.min(1,Math.abs(tgt-s.from)/(.2*H)+.35)}}}}
  /* targets: planted / stepping toe position; sole flat-ish on the mat (heel peels first while stepping) */
  const Lf=L.foot;for(const g of info){if(g.w<=0)continue;const hl=(g.s===leadSide?FP.leadHeel:FP.rearHeel)*H;const S=FP.step&&F[g.s];const lift=S&&S.st?S.lift:0;const tx=S?(S.st?S.cx:S.x):J[g.t].x;const hx=tx-d*Math.sqrt(Math.max(1e-6,Lf*Lf-hl*hl));
    g.toe={x:tx,y:lift};g.heel={x:hx,y:hl+lift*1.25};const fx=(g.toe.x-g.heel.x)/Lf,fy=(g.toe.y-g.heel.y)/Lf;g.ank={x:g.heel.x+fx*.25*Lf-fy*d*L.ank,y:g.heel.y+fy*.25*Lf+fx*d*L.ank}}
  /* sink the body if a planted leg cannot reach */
  let sink=0;for(const g of info){if(g.w<.5)continue;const D=Math.hypot(g.ank.x-J[g.h].x,g.ank.y-J[g.h].y);const over=D-(L.thigh+L.shin)*.995;if(over>0)sink=Math.max(sink,over)}
  sink=Math.min(sink,FP.maxSink*H);if(sink>0)for(const k in J)J[k]={x:J[k].x,y:J[k].y-sink};
  for(const g of info){if(g.w<=0)continue;const w=g.w;const mix=(a,b)=>({x:a.x+(b.x-a.x)*w,y:a.y+(b.y-a.y)*w});
    const ank=mix(J[g.a],g.ank);const knee=ik2(J[g.h],ank,L.thigh,L.shin,d);
    J[g.k]=mix(J[g.k],knee);J[g.a]=ank;J[g.he]=mix(J[g.he],g.heel);J[g.t]=mix(J[g.t],g.toe);
    /* the IK'd knee may differ from the blended one at partial weight — keep bone lengths */
    const kk=ik2(J[g.h],J[g.a],L.thigh,L.shin,d);if(w<1)J[g.k]=kk}
  /* nothing below the mat */
  let lo=0;for(const k of['lHe','lT','rHe','rT'])lo=Math.min(lo,J[k].y);if(lo<0)for(const k in J)J[k]={x:J[k].x,y:J[k].y-lo};
  const m=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});J.lSn=m(J.lK,J.lA,.7);J.rSn=m(J.rK,J.rA,.7);this.planted=info.map(g=>+g.w.toFixed(2))};
{const sv=Body.prototype.solve;Body.prototype.solve=function(p,X,d){const J=sv.call(this,p,X,d);if(!this.rag)this.plantFeet(p||{});return J}}
