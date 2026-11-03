/* ===== CombatPacingEngine.js : spacing, tempo and mind games — anti-slugfest rules =====
   Loaded after CombatEngine.js (wraps its wrappers). All numbers in TUNING.pacing.

   1. Stamina penalty   — throws are logged; beyond `spam.free` throws inside `spam.window` every extra
                          strike costs more stamina. Below `gassed.at` stamina a fighter is GASSED:
                          hits less hard, takes more (incl. concussion → more KDs / flash KOs), strikes
                          slower, guard refills slower.
   2. Whiff punishment  — a missed strike opens a vulnerability window sized by the strike's weight
                          (jab short, overhand / high kick long) and slows its recovery. Anything that
                          lands inside the window is a COUNTER: extra damage, counts as a counter for
                          the concussion model, and the AI is much keener to punish it.
   3. Reach / sweet spot — at contact, distance between the fighters ÷ the strike's reach (REACH × body
                          size): landing at the end of the punch/kick = sweet spot (+dmg), smothered =
                          jammed (−), over-reaching (−). Close tools (uppercut, knee, elbow, hooks) are exempt.
   4. Quick step        — burst step in/out (Shift+A/D, double-tap A/D, touch "스텝"); backstep is the
                          longer of the two; costs stamina, short cooldown, cancels strike startup.
   5. Feint             — fake the start of a cross/kick (B, touch "페인트"); an opponent who reacts
                          (guard, head movement, counter swing) is "bitten" and open for a moment.
   6. Jab tempo         — a jab/teep that lands or is blocked sets up the next power shot (+dmg) and
                          interrupts the opponent's rhythm.
   7. Reactive grappling — shooting or clinching on an opponent who is committed (mid-strike, whiffed,
                          rushing in) can't be sprawled and beats a lower defence.
   AI: paces itself (holds fire when spamming or gassed), backsteps heavy shots to make them whiff,
   steps in to attack, feints, leads with the jab, and punishes whiffs. */
const PACE=tuneSection('pacing',{
  spam:{window:2.0,free:4,extraCost:.45},
  gassed:{at:28,dmgOut:.8,dmgIn:1.2,speed:.86,guardRegen:.55},
  whiff:{base:.16,perWeight:.3,counterDmg:1.25,recovery:.85},
  sweet:{lo:.86,hi:1.06,bonus:1.18,jamFrom:.66,jamMul:.75,overFrom:1.12,overMul:.85},   // ratio = distance ÷ strike reach
  neutral:{pad:.28,enterAt:.32},   // AI waits just outside the opponent's reach, steps in only to attack
  step:{dur:.17,fwd:2.5,back:3.0,sta:3.5,cd:.42,doubleTap:.22},
  feint:{frac:.62,sta:1.2,cd:.55,bite:.5},
  setup:{window:1.3,bonus:1.12},
  react:{tddPenalty:5,clinchPenalty:5},
  ai:{backstepP:.45,stepInP:.55,feintP:.16,jabLead:.35,spamHold:.55,whiffPunishP:.55}
});
const STRIKE_W={jab:.2,bjab:.25,teep:.4,cross:.7,bcross:.65,lhook:.6,rhook:.75,lupp:.55,rupp:.7,ovh:1,blhook:.6,brhook:.7,rlk:.6,llk:.4,calf:.5,rbk:.8,lbk:.6,rhk:1,lhk:.85,knee:.7,kneeH:1,elbow:.5,sbf:.9};
const CLOSE_TOOLS=new Set(['lupp','rupp','knee','elbow','lhook','rhook','blhook','brhook']);
const PacingStats={whiffPun:0,feint:0,step:0,setup:0,sweet:0,jam:0,tdCounter:0};
function pm(k){PacingStats[k]++;if(window.__PM)window.__PM[k==='whiffPun'?'whiffPun':k]++}
const nowM=M=>M.t2();
const Pacing={
  gassed(f){return f.sta<PACE.gassed.at},
  weight(key){return STRIKE_W[key]!=null?STRIKE_W[key]:.6},
  /* range ratio at contact: distance between the fighters ÷ the strike's ideal reach (REACH, scaled by
     body size). ~1 = landed at the end of the punch/kick (sweet spot); low = smothered; high = over-reaching. */
  rangeRatio(att,act){const R=REACH[act.key];if(!R)return 1;const d=Math.abs(att.x-att.opp.x);return d/(R*att.H/1.6)},
  committed(M,f){const a=f.act;if(a&&a.c&&a.c.hit&&!a.feint&&a.t<=a.c.hit.t1)return true;if((f.whiffUntil||0)>nowM(M))return true;return!!(f.dash&&f.dash.fwd)},   /* mid-strike, just whiffed, or bursting forward */
  quickStep(M,f,dir){if(f.state!=='stand'||f.down||M.phase!=='fight')return false;const t=nowM(M);if((f.stepCd||0)>t)return false;
    if(f.act){if(CombatEngine.canCancel(f))CombatEngine.cancel(f,'step');else return false}
    const fwd=dir*f.d>0;const sp=(fwd?PACE.step.fwd:PACE.step.back)*(.8+ATT(f,'footwork')*.3+ATT(f,'speed')*.15)*(this.gassed(f)?.75:1);
    f.dash={v:dir*sp,t:PACE.step.dur,T:PACE.step.dur,fwd};f.stepCd=t+PACE.step.cd;f.sta-=PACE.step.sta;pm('step');return true},
  feint(M,f){if(!f.canStrike())return false;const t=nowM(M);if((f.feintCd||0)>t)return false;const o=f.opp;const key=Math.abs(o.x-f.x)>1.05?'rbk':pick(['cross','cross','rhook','ovh']);const c=MV[key];if(!c||!c.hit)return false;
    f.act={key,c,t:0,hit:false,adj:0,speed:1.7*(.82+ATT(f,c.leg?'kicking':'handSpd')*.36),feint:true};f.sta-=PACE.feint.sta;f.feintCd=t+PACE.feint.cd;
    if(o.ai)o.ai.onOppStrike(key);o._fntRx={t,guard:o.guard,hm:o.hm,act:o.act};pm('feint');return true}
};
/* ---- F2: dash motion, feint cut-off, gassed playback / guard regen ---- */
{const up=F2.prototype.update;F2.prototype.update=function(dt,M){const a=this.act;
    if(a&&a.c&&a.c.hit){if(a.pmul0==null)a.pmul0=1;a.pmul=(Pacing.gassed(this)?PACE.gassed.speed:1)*((a.missed||a.whiffSlow)?PACE.whiff.recovery:1)}
    const g0=this.gst;const r=up.call(this,dt,M);
    if(Pacing.gassed(this)&&this.gst>g0)this.gst=g0+(this.gst-g0)*PACE.gassed.guardRegen;
    if(this.dash){const D=this.dash;D.t-=dt;const k=Math.max(0,D.t/D.T);this.x+=D.v*dt*(.35+k*1.3);this.stepPh+=Math.abs(D.v)*dt*6;if(D.t<=0||this.state!=='stand')this.dash=null}
    /* feint: stop before the active frames; was the opponent fooled? */
    const b=this.act;if(b&&b.feint&&b.c.hit&&b.t>=b.c.hit.t0*PACE.feint.frac){this.act=null;const o=this.opp,rx=o._fntRx;
      if(M&&rx&&M.phase==='fight'){const bit=(o.guard&&!rx.guard)||(o.hm&&!rx.hm)||(o.act&&o.act!==rx.act&&o.act.c&&o.act.c.hit);if(bit){o.whiffUntil=Math.max(o.whiffUntil||0,nowM(M)+PACE.feint.bite);o.bitBy=this;if(this.isPlayer||o.isPlayer)M.ev(`🎭 ${o.name} 페인트에 반응!`)}}o._fntRx=null}
    return r}}
/* weight shift: heavier strikes load the hips back on startup and drive them through on contact */
{const fw=F2.prototype.footwork;F2.prototype.footwork=function(p,dt){fw.call(this,p,dt);const a=this.act;
    if(a&&a.c&&a.c.hit&&this.state==='stand'&&!a.feint){const w=Pacing.weight(a.key),h=a.c.hit;const u=a.t/Math.max(.04,h.t0);let s;
      if(u<1)s=-.45*Math.sin(Math.PI*u);else if(a.t<=h.t1+.04)s=1;else s=Math.max(0,1-(a.t-h.t1)/Math.max(.08,(a.c.dur||.4)-h.t1));
      p.x=(p.x||0)+s*w*.045*this.H;p.lean+=s*w*.07;if(a.c.hand==='r'||a.c.leg)this.body._heelLift=Math.max(0,s)*w*.05}else this.body._heelLift=0;
    if(this.feint&&a&&a.feint){p.lean+=.04}
    if(this.dash){const k=this.dash.t/this.dash.T;p.lean+=(this.dash.fwd?.08:-.1)*k;p.ll_k+=.12*k;p.rl_k+=.12*k}}}
/* FootPlant: rear heel comes up as the hips drive through a rear-hand / kick */
if(typeof FP!=='undefined'){const pf=Body.prototype.plantFeet;Body.prototype.plantFeet=function(p){const r0=FP.rearHeel;FP.rearHeel=r0+(this._heelLift||0);try{return pf.call(this,p)}finally{FP.rearHeel=r0}}}
/* ---- Match: throw log / spam cost ---- */
{const ot=Match.prototype.onThrow;Match.prototype.onThrow=function(f,key){const t=nowM(this);f.thrLog=(f.thrLog||[]).filter(x=>t-x<PACE.spam.window);f.thrLog.push(t);
    const extra=f.thrLog.length-PACE.spam.free;if(extra>0&&MV[key]&&MV[key].hit){f.sta-=MV[key].hit.sta*PACE.spam.extraCost*extra;f.spam=extra}else f.spam=0;
    return ot.call(this,f,key)}}
/* ---- whiff: open a vulnerability window ---- */
{const om=Match.prototype.onMiss;Match.prototype.onMiss=function(att,act){const r=om.call(this,att,act);const w=Pacing.weight(act.key);att.whiffUntil=nowM(this)+PACE.whiff.base+w*PACE.whiff.perWeight;act.whiffSlow=1;
    const o=att.opp;if(o.ai&&o.state==='stand'&&!o.act&&w>=.55&&Math.random()<PACE.ai.whiffPunishP*this.diff&&!o.ai.cnt)o.ai.cnt={t:.04+o.ai.rt()*.4,whiff:1};return r}}
/* ---- contact: sweet spot / jam, whiff punish, setups ---- */
{const oh=Match.prototype.onHit;Match.prototype.onHit=function(att,def,act,zone,p){const t=nowM(this);const ctx={mul:1,tags:[]};
    if(!CLOSE_TOOLS.has(act.key)&&act.key!=='gp'&&act.key!=='ge'){const e=Pacing.rangeRatio(att,act);ctx.ext=e;if(window.__PM)(window.__PM.ext=window.__PM.ext||[]).push(+e.toFixed(2));if(e>=PACE.sweet.lo&&e<=PACE.sweet.hi){ctx.mul*=PACE.sweet.bonus;ctx.tags.push('sweet');pm('sweet')}else if(e<PACE.sweet.jamFrom){ctx.mul*=PACE.sweet.jamMul;ctx.tags.push('jam');pm('jam')}else if(e>PACE.sweet.overFrom){ctx.mul*=PACE.sweet.overMul;ctx.tags.push('over')}}
    if((def.whiffUntil||0)>t){ctx.counter=true;ctx.mul*=PACE.whiff.counterDmg;ctx.tags.push('whiff');pm('whiffPun');def.whiffUntil=0}
    if(Pacing.weight(act.key)>=.55&&(att.setupUntil||0)>t){ctx.mul*=PACE.setup.bonus;ctx.tags.push('setup');pm('setup');att.setupUntil=0}
    this._pctx=ctx;try{return oh.call(this,att,def,act,zone,p)}finally{this._pctx=null}}}
{const ad=Match.prototype.applyDmg;Match.prototype.applyDmg=function(att,def,o){const ctx=this._pctx;let m=1;
    if(ctx&&!o.blocked){m*=ctx.mul;if(ctx.counter)o.counter=true;o.tags=ctx.tags;
      if(ctx.tags.includes('whiff')&&(att.isPlayer||def.isPlayer||Math.random()<.3))this.ev(`⚡ ${att.name} 헛친 틈을 응징!`)}
    if(Pacing.gassed(att))m*=PACE.gassed.dmgOut;if(Pacing.gassed(def)&&!o.blocked)m*=PACE.gassed.dmgIn;o.dmg*=m;
    const a=att.act;if(a&&(a.key==='jab'||a.key==='bjab'||a.key==='teep'))att.setupUntil=nowM(this)+PACE.setup.window;
    return ad.call(this,att,def,o)}}
/* ---- reactive grappling ---- */
{const sh=Match.prototype.shoot;Match.prototype.shoot=function(f){const o=f.opp;const ctr=Pacing.committed(this,o);sh.call(this,f);const g=this.g;
    if(g&&g.type==='shoot'&&g.att===f&&ctr){g.counter=1;if(o.ai)o.ai.sprawlT=null;pm('tdCounter');this.ev(`🔄 ${f.name} 들어오는 순간 카운터 태클!`)}}}
{const ug=Match.prototype.updGrapple;Match.prototype.updGrapple=function(dt){const g=this.g;
    if(g&&g.type==='shoot'&&g.counter&&!g.done){const o=g.def;o.wantSprawl=false;g.spr=0;if(g.t+dt>=.38){const A0=o.A;o.A=Object.assign({},A0,{tdd:Math.max(1,(A0.tdd||10)-PACE.react.tddPenalty)});try{return ug.call(this,dt)}finally{o.A=A0}}}
    return ug.call(this,dt)}}
{const cl=Match.prototype.clinch;Match.prototype.clinch=function(f){const o=f.opp;if(!Pacing.committed(this,o))return cl.call(this,f);const A0=o.A;o.A=Object.assign({},A0,{clinchCtl:Math.max(1,(A0.clinchCtl||10)-PACE.react.clinchPenalty)});try{const r=cl.call(this,f);if(this.g&&this.g.type==='clinch')this.ev(`🔗 ${f.name} 달려드는 상대를 묶어 흐름을 끊습니다`);return r}finally{o.A=A0}}}
/* ---- player input: quick step, feint ---- */
{const key=In2.prototype.key;In2.prototype.key=function(e,dn){if(dn&&!e.repeat){const c=e.code;
      if(c==='KeyB')this.ev.push('feint');
      if(c==='KeyA'||c==='KeyD'||c==='ArrowLeft'||c==='ArrowRight'){const dir=(c==='KeyD'||c==='ArrowRight')?1:-1;const t=performance.now()/1000;
        if(e.shiftKey||(this._lastDir===dir&&t-(this._lastDirT||0)<PACE.step.doubleTap))this.ev.push('step:'+dir);this._lastDir=dir;this._lastDirT=t}
      if(c==='ShiftLeft'||c==='ShiftRight'){const k=this.k;const dir=(k.KeyD||k.ArrowRight)?1:(k.KeyA||k.ArrowLeft)?-1:0;if(dir)this.ev.push('step:'+dir)}}
    return key.call(this,e,dn)}}
{const poll=In2.prototype.poll;In2.prototype.poll=function(){const ev=poll.call(this);this.pacEv=[];const out=[];for(const e of ev){if(e==='feint'||e.startsWith('step:'))this.pacEv.push(e);else out.push(e)}return out}}
{const pi=Match.prototype.playerInput;Match.prototype.playerInput=function(dt){pi.call(this,dt);const f=this.f[this.pi],I=this.inp;if(!I||this.phase!=='fight'||f.state!=='stand')return;
    for(const e of I.pacEv||[]){if(e==='feint')Pacing.feint(this,f);else{let dir=+e.slice(5);if(!dir)dir=Math.abs(I.mx)>.2?Math.sign(I.mx):-f.d;Pacing.quickStep(this,f,dir)}}}}
/* ---- AI: pacing, footsies, feints, jab lead ---- */
{const ou=AI2.prototype.onOppStrike;AI2.prototype.onOppStrike=function(key){const f=this.f,o=f.opp;const w=Pacing.weight(key);
    /* read a heavy shot early → step out of range and make it whiff */
    if(f.state==='stand'&&!f.act&&w>=.6&&Math.random()<PACE.ai.backstepP*(.35+ATT(f,'footwork')*.65)*Math.min(1.2,this.diff)){this.stepOut={t:this.rt()*.7};return}
    return ou.call(this,key)}}
{const au=AI2.prototype.update;AI2.prototype.update=function(dt){const f=this.f,o=f.opp,M=this.M;
    /* in-and-out rhythm: hover just outside the opponent's reach, close to attack range only when about to strike */
    if(this.range0==null)this.range0=this.range;const oReach=Math.max(REACH.jab,ATT(o,'kicking')>.55?REACH.rbk:0)*o.H/1.6;
    this.range=this.next>PACE.neutral.enterAt&&!(o.rock>0)&&!(f.gr&&0)?Math.max(this.range0,oReach+PACE.neutral.pad):this.range0;
    if(f.state==='stand'&&M.phase==='fight'&&!f.down){
      if(this.stepOut){this.stepOut.t-=dt;if(this.stepOut.t<=0){this.stepOut=null;Pacing.quickStep(M,f,-f.d)}}
      /* hold fire while spamming or gassed: reset to range and breathe */
      if((f.spam>0||Pacing.gassed(f))&&this.next<.3)this.next+=PACE.ai.spamHold*(.5+Math.random()*.5);
      const dist=Math.abs(o.x-f.x);const want=this.range;
      if(!f.act&&this.next<.18&&!this.stepOut){
        if(dist>want+.2&&dist<want+1&&Math.random()<PACE.ai.stepInP*(.4+ATT(f,'footwork')*.6)*dt*6){if(Pacing.quickStep(M,f,f.d)){this.next=Math.min(this.next,.06)}}
        else if(dist<=want+.15&&Math.random()<PACE.ai.feintP*(.5+this.iq)*dt*4){Pacing.feint(M,f)}
        else if(dist<=1.05&&!(f.setupUntil>nowM(M))&&Math.random()<PACE.ai.jabLead*dt*3){if(f.strike('jab',M)){this.next=.25+Math.random()*.3}}}}
    return au.call(this,dt)}}
