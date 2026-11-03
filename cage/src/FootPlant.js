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
  minHip:.32          // ×H below this hip height the pose is not "standing" (sit-ups, getups)
});
function ik2(h,a,L1,L2,kd){/* knee position for hip h, ankle a; kd = preferred side (+1 forward) */
  let dx=a.x-h.x,dy=a.y-h.y;let D=Math.hypot(dx,dy)||1e-6;const mx=(L1+L2)*.999;if(D>mx){dx*=mx/D;dy*=mx/D;D=mx}
  const ca=clamp((L1*L1+D*D-L2*L2)/(2*L1*D),-1,1),ang=Math.acos(ca);const bx=dx/D,by=dy/D;
  const k1={x:h.x+(bx*Math.cos(ang)-by*Math.sin(ang))*L1,y:h.y+(bx*Math.sin(ang)+by*Math.cos(ang))*L1};
  const k2={x:h.x+(bx*Math.cos(-ang)-by*Math.sin(-ang))*L1,y:h.y+(bx*Math.sin(-ang)+by*Math.cos(-ang))*L1};
  return((k1.x-k2.x)*kd>=0?k1:k2)}
Body.prototype.plantFeet=function(p){if(!FP.on||this.rag||p.free)return;const J=this.J,L=this.L,H=this.H,d=this.d||1;if(!J.hip||J.hip.y<FP.minHip*H)return;
  const legs=[['l','lH','lK','lA','lHe','lT'],['r','rH','rK','rA','rHe','rT']];const leadSide='l';/* l* joints are always the lead leg (see Body.draw) */
  const info=legs.map(([s,h,k,a,he,t])=>{const lo=Math.min(J[he].y,J[t].y);const w=clamp((FP.releaseDist*H-lo)/((FP.releaseDist-FP.plantDist)*H),0,1);return{s,h,k,a,he,t,w,lo}});
  /* targets: toe keeps its x; sole flat-ish on the mat */
  const Lf=L.foot;for(const g of info){if(g.w<=0)continue;const hl=(g.s===leadSide?FP.leadHeel:FP.rearHeel)*H;const tx=J[g.t].x;const hx=tx-d*Math.sqrt(Math.max(1e-6,Lf*Lf-hl*hl));
    g.toe={x:tx,y:0};g.heel={x:hx,y:hl};const fx=(g.toe.x-g.heel.x)/Lf,fy=(g.toe.y-g.heel.y)/Lf;g.ank={x:g.heel.x+fx*.25*Lf-fy*d*L.ank,y:g.heel.y+fy*.25*Lf+fx*d*L.ank}}
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
