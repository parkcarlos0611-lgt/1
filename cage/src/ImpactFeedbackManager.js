/* ===== ImpactFeedbackManager.js : hitstop, micro camera shake / zoom, impact particles, reaction weight =====
   Runs after the engine's own onHit (which still plays sounds and base particles) and replaces its
   feedback numbers with a tiered model, so feel is consistent and tunable:

     tier      when                                    hitstop   shake   zoom   reaction
     blocked   guard / check took it                   1 f       .010    —      ×.5
     light     dmg < 4 (jabs, touches)                 2 f       .014    .010   ×.6
     medium    dmg 4–8                                 3 f       .028    .022   ×.85
     heavy     dmg > 8                                 4 f       .045    .040   ×1
     crit      counter / whiff punish / sweet heavy    5 f       .065    .060   ×1.15  + shockwave, sparks
   (f = 1/60 s of near-frozen simulation; both fighters freeze together.)
   Particles: sweat spray scales with how much the defender is sweating, blood droplets when the face
   is cut or badly damaged, an expanding shock ring + radial sparks on crits. */
const IFX=tuneSection('impact',{
  tiers:{blocked:{hs:1,shake:.01,zoom:0,react:.5},light:{hs:2,shake:.014,zoom:.01,react:.6},medium:{hs:3,shake:.028,zoom:.022,react:.85},heavy:{hs:4,shake:.045,zoom:.04,react:1},crit:{hs:5,shake:.065,zoom:.06,react:1.15}},
  lightBelow:4, heavyAbove:8, ring:{life:.28,max:.45}, sparks:8
});
const ImpactFeedback={
  tier(h){if(h.blocked)return'blocked';const crit=h.counter||(h.tags&&(h.tags.includes('whiff')||h.tags.includes('sweet')&&h.dmg>IFX.heavyAbove));if(crit)return'crit';return h.dmg<IFX.lightBelow?'light':h.dmg>IFX.heavyAbove?'heavy':'medium'},
  apply(M,h,p,react0){const S=M.stage,T=IFX.tiers[this.tier(h)];const tier=this.tier(h);
    M.hitstop=T.hs/60;S.shake=T.shake;S.cam.zoom=T.zoom;if(tier!=='crit')S.scrFlash=Math.min(S.scrFlash||0,.04);
    /* reaction weight: scale what the engine just added to the defender's springs */
    const R=h.def.react;for(const k in react0){if(k==='x')continue;/* knockback distance is gameplay, not feel: leave it */if(typeof R[k]==='number')R[k]=react0[k]+(R[k]-react0[k])*T.react}
    if(h.blocked)return;const J=h.def.body.J;const at=p||J.hd;const dir=h.att.d;
    const sw=h.def.body.sweat||0;if(sw>.15||tier!=='light')S.burst(at.x,at.y,dir,Math.round(2+sw*6+(tier==='crit'?5:tier==='heavy'?3:0)),'sweat',.7+sw*.5);
    if(h.zone==='head'){const cut=h.def.body.cuts.length>0;if(cut&&tier!=='light'||!cut&&h.def.hp.head<55&&(tier==='heavy'||tier==='crit'))S.burst(J.hd.x+dir*.05,J.hd.y,dir,tier==='crit'?7:4,'blood',.9)}
    if(tier==='crit'){(S.ifx=S.ifx||[]).push({x:at.x,y:at.y,t:0,dir,sp:Array.from({length:IFX.sparks},()=>({a:Math.random()*Math.PI*2,v:.6+Math.random()*.8}))});if(M.pi!=null)S.scrFlash=Math.max(S.scrFlash||0,.07)}}
};
/* capture what applyDmg saw (final damage after pacing multipliers, flags) */
{const ad=Match.prototype.applyDmg;Match.prototype.applyDmg=function(att,def,o){const r=ad.call(this,att,def,o);/* o is mutated by the inner wrappers: read it afterwards */this._lastHit={att,def,dmg:o.dmg,blocked:!!o.blocked,counter:!!o.counter,tags:o.tags||[],zone:o.zone};return r}}
{const oh=Match.prototype.onHit;Match.prototype.onHit=function(att,def,act,zone,p){const r0=Object.assign({},def.react);this._lastHit=null;const r=oh.call(this,att,def,act,zone,p);const h=this._lastHit;
    if(h&&h.att===att&&this.phase!=='end')ImpactFeedback.apply(this,h,p,r0);
    else if(!h&&act.outcome==='block'){this.hitstop=IFX.tiers.blocked.hs/60;this.stage.shake=IFX.tiers.blocked.shake}   // checked kicks
    return r}}
/* draw shock rings + sparks in world space, on top of the fighters */
{const rd=Match.prototype.render;Match.prototype.render=function(dt){rd.call(this,dt);const S=this.stage,L=S.ifx;if(!L||!L.length)return;const ctx=S.ctx;ctx.save();S.worldT(ctx);ctx.globalCompositeOperation='lighter';
    for(const e of L){e.t+=dt;const k=e.t/IFX.ring.life;if(k>=1)continue;const r=.05+k*IFX.ring.max;
      ctx.strokeStyle=`rgba(255,240,210,${(1-k)*.75})`;ctx.lineWidth=.02*(1-k)+.004;ctx.beginPath();ctx.ellipse(e.x,e.y,r,r*.8,0,0,7);ctx.stroke();
      ctx.strokeStyle=`rgba(255,210,150,${(1-k)*.9})`;ctx.lineWidth=.008;for(const s of e.sp){const r1=r*.6*s.v,r2=r*1.15*s.v;ctx.beginPath();ctx.moveTo(e.x+Math.cos(s.a)*r1,e.y+Math.sin(s.a)*r1);ctx.lineTo(e.x+Math.cos(s.a)*r2,e.y+Math.sin(s.a)*r2);ctx.stroke()}}
    ctx.restore();S.ifx=L.filter(e=>e.t<IFX.ring.life)}}
