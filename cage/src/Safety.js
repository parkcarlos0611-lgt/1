/* ===== Safety.js : one place that guarantees the physics model ends up in a valid state =====
   (1) Floor contact: no joint may go below the floor (limbs are lifted to their own radius, the whole body is lifted
       if the torso sinks); in a settled ground position the lowest point rests exactly on the mat (no hovering).
   (2) Cancel safety net: whenever a move / ground state is cancelled or interrupted by any path, the fighter is
       released — leftover ground pose, ground state, free-pose, ground blend rate, queued moves or an action that
       outlived its duration are cleared, so nothing stays stuck. */
(function(){
if(typeof Body==='undefined'||typeof Match==='undefined')return;
const SF=window.SAFETY={floor:true,net:true,stats:{lifts:0,snaps:0,released:0,watchdog:0}};
/* joint radius as a fraction of body height (centre of the joint to the surface of the body) */
const R={hd:.066,nk:.04,sh:.05,mid:.05,hip:.06,lS:.04,rS:.04,lE:.03,rE:.03,lW:.025,rW:.025,lG:.03,rG:.03,lH:.06,rH:.06,lK:.045,rK:.045,lA:.03,rA:.03,lHe:.015,rHe:.015,lT:.015,rT:.015};
const TORSO=['hd','nk','sh','mid','hip'];

/* ---- (1) floor contact, applied to the solved joints ---- */
{const solve=Body.prototype.solve;Body.prototype.solve=function(p,X,d){const J=solve.call(this,p,X,d);if(!SF.floor||this.rag||!J.hip)return J;const H=this.H;
  /* depth arcs (Combat3): a joint swung toward the camera drops a little on screen */
  this._zJ=this._zmap||null;if(this._zmap)for(const k in this._zmap){const q=J[k];if(q){q.x-=(this.d||1)*Math.abs(this._zmap[k])*.35;q.y-=this._zmap[k]*.45}}
  /* settled ground position: rest the lowest point on the mat (limited, so slams / lifts in a transition keep their height) */
  {let low=0;if(this._snap){let m=1e9;for(const k in R){const q=J[k];if(q)m=Math.min(m,q.y-R[k]*H)}if(m>.004*H&&m<.45*H)low=m}
   this._sn=(this._sn||0)+(low-(this._sn||0))*.3;/* eased, so entering / leaving a position never pops */
   const sn=Math.min(this._sn,low||this._sn);if(sn>.002*H){for(const k in J)J[k].y-=sn;SF.stats.snaps++}}
  /* the torso never sinks into the mat */
  let lift=0;for(const k of TORSO){const q=J[k];if(q)lift=Math.max(lift,R[k]*H-q.y)}
  if(lift>0){for(const k in J)J[k].y+=lift;SF.stats.lifts++}
  /* limbs bend onto the mat instead of going through it */
  for(const k in R){const q=J[k];if(q&&q.y<R[k]*H)q.y=R[k]*H}
  J.lSn.x=J.lK.x+(J.lA.x-J.lK.x)*.7;J.lSn.y=J.lK.y+(J.lA.y-J.lK.y)*.7;J.rSn.x=J.rK.x+(J.rA.x-J.rK.x)*.7;J.rSn.y=J.rK.y+(J.rA.y-J.rK.y)*.7;
  return J}}

/* ---- (2) cancel safety net, once per step ---- */
{const step=Match.prototype.step;Match.prototype.step=function(dt){
  /* which bodies are in a settled ground position this frame (they rest on the mat) */
  const g=this.g;for(const f of this.f)f.body._snap=!!(g&&g.type==='ground'&&!g.trans&&!g.sub?1:g&&g.type==='ground'&&g.sub?1:0)||!!(f.down&&!f.down.ko&&0);
  const r=step.call(this,dt);
  if(SF.net&&this.phase==='fight'){for(const f of this.f){
    /* a ground state / pose with no ground fight and not lying down from a knockdown */
    if(!this.g&&!f.down&&!f.body.rag){if(f.state==='ground'||f.state==='sprawl'||f.gpose){f._rel=(f._rel||0)+dt;if(f._rel>.35){f.state='stand';f.gpose=null;f.act=f.act&&f.act.key==='getupT'?f.act:null;f.queue=[];f.cur.free=0;f.cur.y=0;f._rel=0;SF.stats.released++}}else f._rel=0}
    else f._rel=0;
    if(!this.g&&f.gRate>10&&!f.gpose)f.gRate=0;
    /* an action that has outlived its duration (cancel path that never ended it) */
    if(f.act&&f.act.c&&f.act.c.dur&&f.act.t>(f.act.c.dur/(f.act.speed||1))*1.8+.6&&!f.down){f.act=null;f.queue=[];SF.stats.watchdog++}
    if(!this.g&&f.state==='stand'&&f.cur.free&&!f.act&&!f.down&&!f.body.rag&&!f.gpose){f.cur.free=0;f.cur.y=0}}}
  return r}}
})();
