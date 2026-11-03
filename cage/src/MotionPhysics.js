/* ===== MotionPhysics.js : joint spring physics, light bouncy footwork, no shadows, lower stamina drain =====
   Joint physics — every pose channel (head, chest, lean, twist, shoulders, elbows, hips, knees, hip shift)
   carries a spring-damper offset (underdamped: it snaps, overshoots slightly and settles). Offsets are
   added to the animated pose right before the skeleton is solved, so hitboxes follow them too.
     • Hits push impulses into the channels by strike and zone:
         straight to the face → head snaps back, chest and lean follow, arms fly, knees dip, body pushed back
         hook / high kick     → head and torso whip sideways (twist), and for a head kick the legs scissor and
                                stumble with a dip of the hips
         uppercut             → head snaps up and back
         body shot            → folds forward, knees buckle
         leg kick             → kicked leg buckles at the knee / hip
     • The kicking leg recoils on contact (knee folds, hip drops) instead of passing through.
     • Inertia: accelerating / stopping makes the torso and arms lag and overshoot.
   Footwork — faster movement, and a light rhythmic bounce on the balls of the feet (hips rise and fall,
     feet stay planted through FootPlant), quicker when moving, damped while striking.
   Shadows — floor shadows (fighters, referee), the dark side of the lighting layer and CSS text/box
     shadows / drop-shadow filters in the match HUD are removed.
   Stamina — every decrease of stamina (and of max stamina) is scaled by `staminaDrain`. */
const MP=tuneSection('motion',{
  speedMul:1.22, bounce:{amp:.016,hz:2.3,moveHz:3.3,strikeDamp:.25},
  springs:{head:[140,9,.9],chest:[95,8,.5],lean:[85,8.5,.45],tw:[75,7,.7],la_s:[55,8.5,.8],la_e:[50,8,.9],ra_s:[55,8.5,.8],ra_e:[50,8,.9],   /* arms: damping ratio ≈ .6 (no flailing overshoot) */ll_h:[105,10,.7],ll_k:[105,10,.8],rl_h:[105,10,.7],rl_k:[105,10,.8],x:[45,9,.12]},
  hit:{head:1,body:1,leg:1,kickRecoil:1}, inertia:{lean:.03,arms:.05},
  staminaDrain:.6, noShadows:true
});
const JointPhys={
  st(f){return f._js||(f._js={})},
  kick(f,ch,v){if(!MP.springs[ch])return;const s=this.st(f);const c=s[ch]||(s[ch]={x:0,v:0});c.v+=v},
  step(f,dt){const s=this.st(f);for(const ch in s){const c=s[ch],[k,d,lim]=MP.springs[ch];c.v+=(-k*c.x-d*c.v)*dt;c.x+=c.v*dt;if(c.x>lim){c.x=lim;c.v=Math.min(0,c.v)}else if(c.x<-lim){c.x=-lim;c.v=Math.max(0,c.v)}}},
  apply(f,p){const s=f._js;if(!s)return;for(const ch in s){const x=s[ch].x;if(!x)continue;if(ch==='x')p.x=(p.x||0)+x*f.H;else p[ch]=(p[ch]||0)+x}},
  onHit(M,att,def,o){if(def.state!=='stand'||def.body.rag)return;const a=att.act;const key=a&&a.key||'';const cat=typeof GCAT==='function'?GCAT(key):'';const pw=clamp(o.dmg/9,.15,2.2);const rnd=()=>Math.random()*2-1;const H=MP.hit;
    if(o.blocked){this.kick(def,'lean',-1.2*pw);this.kick(def,'la_e',1.5*pw);this.kick(def,'ra_e',1.5*pw);this.kick(def,'x',-.25*pw);return}
    const kickHead=a&&a.c&&a.c.leg&&o.zone==='head';
    if(o.zone==='head'){const h=H.head;
      if(cat==='upper'){this.kick(def,'head',-(9+pw*9)*h);this.kick(def,'chest',-(3+pw*3)*h);this.kick(def,'lean',-(2+pw*2)*h)}
      else if(cat==='hook'||kickHead){const sd=(att.d*def.d>0?1:-1);this.kick(def,'tw',sd*(4+pw*6)*h);this.kick(def,'head',-(4+pw*6)*h);this.kick(def,'chest',-(1.5+pw*2)*h);this.kick(def,'lean',-(1+pw*2)*h)}
      else{this.kick(def,'head',-(6+pw*9)*h);this.kick(def,'chest',-(2+pw*3)*h);this.kick(def,'lean',-(1.5+pw*2.5)*h)}
      this.kick(def,'la_e',rnd()*3*pw);this.kick(def,'ra_e',rnd()*3*pw);this.kick(def,'la_s',(1+rnd())*1.5*pw);this.kick(def,'ra_s',(1+rnd())*1.5*pw);
      this.kick(def,'ll_k',1.6*pw);this.kick(def,'rl_k',1.6*pw);this.kick(def,'x',-.6*pw);
      if(kickHead){/* head kick: legs scissor / stumble, hips dip */this.kick(def,'ll_h',-(2.5+pw*3));this.kick(def,'rl_h',(2.5+pw*3));this.kick(def,'ll_k',2*pw);this.kick(def,'rl_k',3*pw);this.kick(def,'x',-.8*pw)}}
    else if(o.zone==='body'){const h=H.body;this.kick(def,'lean',(3+pw*4)*h);this.kick(def,'chest',(2+pw*3)*h);this.kick(def,'head',(1+pw*1.5)*h);this.kick(def,'ll_k',(2+pw*2.5)*h);this.kick(def,'rl_k',(2+pw*2.5)*h);this.kick(def,'la_s',-1.5*pw);this.kick(def,'ra_s',-1.5*pw);this.kick(def,'x',-.4*pw)}
    else{const h=H.leg;this.kick(def,'ll_k',(3.5+pw*5)*h);this.kick(def,'ll_h',-(1.5+pw*2)*h);this.kick(def,'lean',-(1+pw)*h);this.kick(def,'tw',(att.d*def.d>0?1:-1)*1.2*pw)}
    /* the kicking leg recoils off the target */
    if(a&&a.c&&a.c.leg){const pt=a.c.hit&&a.c.hit.pt||'r';const sd=pt[0]==='l'?'ll':'rl';const r=MP.hit.kickRecoil*(o.blocked?1.3:1);this.kick(att,sd+'_k',(4+pw*3)*r);this.kick(att,sd+'_h',-(1.5+pw*1.5)*r);this.kick(att,'lean',-1*r)}
    else if(a&&a.c&&a.c.hit){this.kick(att,'chest',.6*pw);this.kick(att,'x',.15*pw)}}
};
/* pose: springs + inertia + bounce, then the original footwork pass */
{const fw=F2.prototype.footwork;F2.prototype.footwork=function(p,dt){fw.call(this,p,dt);if(!(dt>0)||this.name==='ref')return;
    if(this.state==='stand'&&!this.body.rag&&!this.gpose){
      /* inertia: torso / arms lag behind changes of speed */
      const v=this.vx||0;const acc=(v-(this._pvx||0))/dt;this._pvx=v;if(Math.abs(acc)>.5){const k=clamp(acc*this.d,-30,30);JointPhys.kick(this,'lean',-k*MP.inertia.lean*dt*60*.05);JointPhys.kick(this,'la_s',-k*MP.inertia.arms*dt*60*.05);JointPhys.kick(this,'ra_s',-k*MP.inertia.arms*dt*60*.05)}
      /* bounce on the balls of the feet */
      const B=MP.bounce;const moving=Math.abs(v)>.3;this._bph=(this._bph||Math.random()*6)+dt*Math.PI*2*(moving?B.moveHz:B.hz);const damp=this.act?B.strikeDamp:this.guard?.6:1;
      const b=(.5+.5*Math.sin(this._bph))*B.amp*this.H*damp;p.y=(p.y||0)+b;p.ll_k=(p.ll_k||0)+(.5-.5*Math.sin(this._bph))*.06*damp;p.rl_k=(p.rl_k||0)+(.5-.5*Math.sin(this._bph))*.06*damp;this.body._heelLift=Math.max(this.body._heelLift||0,b*.9/this.H)}
    JointPhys.step(this,dt);if(this.state==='stand'||this.state==='clinch')JointPhys.apply(this,p)}}
/* faster, lighter movement */
{const sp=F2.prototype.spd;F2.prototype.spd=function(){return sp.call(this)*(this.name==='ref'?1:MP.speedMul)}}
/* impulses from hits (after damage is final) */
{const ad=Match.prototype.applyDmg;Match.prototype.applyDmg=function(att,def,o){const r=ad.call(this,att,def,o);try{JointPhys.onHit(this,att,def,o)}catch(e){}return r}}
/* the engine's own reaction springs would double up: keep them lighter */
if(typeof IFX!=='undefined'){const T=IFX.tiers;T.blocked.react=.35;T.light.react=.4;T.medium.react=.55;T.heavy.react=.65;T.crit.react=.75}
/* stamina: scale every decrease */
{const bh=Match.prototype.buildHUD;Match.prototype.buildHUD=function(){for(const f of this.f){for(const key of['sta','staMax']){let v=f[key];Object.defineProperty(f,key,{configurable:true,enumerable:true,get(){return v},set(n){v=n<v?v-(v-n)*MP.staminaDrain:n}})}}return bh.apply(this,arguments)}}
/* shadows off */
if(MP.noShadows){
  {const bd=Body.prototype.draw;Body.prototype.draw=function(ctx,o){return bd.call(this,ctx,Object.assign({},o||{},{noShadow:true}))}}
  const css=document.createElement('style');css.textContent='.mroot2 *{text-shadow:none!important;box-shadow:none!important}.mroot2 .hlow2{filter:none!important}';document.head.appendChild(css);
  if(typeof GFX!=='undefined')GFX.noDark=true;
}
