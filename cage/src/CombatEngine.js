/* ===== CombatEngine.js : input buffer, cancel windows, dynamic playback speed, weave/sway/parry =====
   Wraps the inline Match / F2 / In2 classes. All numbers live in TUNING.combat.

   Action phases (per move in MV):  startup [0,t0) → active [t0,t1] → recovery (t1,dur]
     playback speed = base speed × phase multiplier × outcome multiplier
       startup  : startupSpeed
       active   : 1, except hitDrag for hitDragT seconds right after contact
       recovery : hit → recoverySpeed · block/parried → blockRecoil · miss → whiffRecovery
     cancel window: while t < t0 × cancelFrac and nothing has connected, guard /
       backstep / weave / sway cancel the strike (part of its stamina comes back).
   Input buffer: a strike pressed while the fighter cannot act is kept for bufferMs and
     fires on the first frame the fighter can act (instead of being dropped).
   Buffer and parry windows run on the match's game clock (M.gt, advanced by sim dt), not
     wall time — a slow frame on a weak device must not expire inputs. */
const CE=TUNING.combat;
const now_s=()=>performance.now()/1000;
class InputBuffer{
  constructor(){this.q=[]}
  push(key,t){this.q.push({key,t});if(this.q.length>CE.bufferMax)this.q.shift()}
  expire(t){this.q=this.q.filter(e=>t-e.t<=CE.bufferMs/1000)}
  take(){return this.q.shift()}
  clear(){this.q.length=0}
}
const CombatEngine={
  phase(a){const h=a.c.hit;if(!h)return'move';return a.t<h.t0?'startup':a.t<=h.t1?'active':'recovery'},
  mul(a){const ph=this.phase(a);let m=1;
    if(ph==='startup')m=CE.startupSpeed;
    else if(ph==='active'){m=a.dragT>0?CE.hitDrag:1}
    else if(ph==='recovery'){m=a.outcome==='hit'?CE.recoverySpeed:a.outcome==='block'||a.outcome==='parried'?CE.blockRecoil:a.missed?CE.whiffRecovery:1}
    return m*(a.pmul||1)},   /* pmul: external multiplier (CombatPacingEngine: gassed / heavy-whiff recovery) */
  /* called once per sim step for each fighter before F2.update advances the clip */
  tick(f,dt){const a=f.act;if(!a||!a.c)return;if(a.base==null)a.base=a.speed;if(a.dragT>0)a.dragT-=dt;a.speed=a.base*this.mul(a)},
  canCancel(f){const a=f.act;if(!a||!a.c||!a.c.hit||a.hit||a.cancelled)return false;return a.t<a.c.hit.t0*CE.cancelFrac},
  cancel(f,why){const a=f.act;f.sta=Math.min(f.staMax,f.sta+a.c.hit.sta*(1.25-ATT(f,'cardio')*.5)*CE.cancelStaRefund);f.act=null;f.queue=[];f.dbgCancel={why,t:now_s()};return true}
};
/* ---- F2: playback speed + head movement timings ---- */
{const up=F2.prototype.update;F2.prototype.update=function(dt,M){CombatEngine.tick(this,dt);return up.call(this,dt,M)}}
{const hm=F2.prototype.headMove;F2.prototype.headMove=function(kind){const r=hm.call(this,kind);if(this.hm===kind&&this.isPlayer){this.hmT=(kind==='duck'?CE.weaveT:CE.swayT)+ATT(this,'footwork')*.12;this.sta-=CE.headMoveSta-1.2}return r}}
/* ---- In2: weave / sway keys, block-press timestamp for parry ---- */
{const key=In2.prototype.key;In2.prototype.key=function(e,dn){if(dn&&!e.repeat){if(e.code==='KeyG')this.ev.push('weave');if(e.code==='KeyV')this.ev.push('sway')}return key.call(this,e,dn)}}
{const poll=In2.prototype.poll;In2.prototype.poll=function(){
    /* gamepad: L3 = weave, R3 = sway */
    try{const gps=navigator.getGamepads?navigator.getGamepads():[];const gp=gps&&[...gps].find(g=>g);if(gp){for(const[i,n]of[[10,'weave'],[11,'sway']]){const p=gp.buttons[i]&&gp.buttons[i].pressed;if(p&&!this.gpPrev['h'+i])this.ev.push(n);this.gpPrev['h'+i]=p}}}catch(e){}
    const ev=poll.call(this);this.hmEv=[];const out=[];for(const e of ev){if(e==='weave'||e==='sway')this.hmEv.push(e);else{if(e==='blockp')this.lastBlockP=this.clock||0;out.push(e)}}
    if(this.block&&!this._blkHeld)this.lastBlockP=this.clock||0;this._blkHeld=this.block;return out}}
/* ---- Match: buffer, cancel, head movement, impact outcome, parry ---- */
{const pi=Match.prototype.playerInput;Match.prototype.playerInput=function(dt){const f=this.f[this.pi],I=this.inp;f.buf=f.buf||new InputBuffer();this.gt=(this.gt||0)+dt;I.clock=this.gt;
    const hadAct=f.act;pi.call(this,dt);const t=this.gt;
    if(this.phase==='fight'&&f.state==='stand'){
      /* cancel window: guard, backstep or head movement during early startup */
      const back=I.mx*f.d<-.5;const hmE=(I.hmEv||[]).length>0;
      if(f.act&&f.act===hadAct&&CombatEngine.canCancel(f)&&(I.block||back||hmE)){CombatEngine.cancel(f,I.block?'guard':hmE?'head':'step');f.buf.clear();if(I.block&&!(f.gBreak>0))f.guard=I.my<-.5?'low':I.gtype||'high'}
      for(const e of I.hmEv||[]){if(!f.act&&!(f.hm&&f.hmT>.12))f.headMove(e==='weave'?'duck':'slipB')}
      /* flush buffered strikes */
      f.buf.expire(t);if(f.buf.q.length&&f.canStrike()&&!I.block){const e=f.buf.take();if(f.strike(e.key,this))f.lastKey=e.key}}
    else if(f.buf)f.buf.clear()};}
{const ds=Match.prototype.doStrike2;Match.prototype.doStrike2=function(f,key){
    if(f.act&&f.act.c.hit&&f.act.t>f.act.c.hit.t0&&f.queue.length<2){f.queue.push(key);f.lastKey=key;return}
    if(f.strike(key,this)){f.lastKey=key;return}
    if(f.isPlayer){(f.buf=f.buf||new InputBuffer()).push(key,this.gt||0)}}}
{const oh=Match.prototype.onHit;Match.prototype.onHit=function(att,def,act,zone,p){
    /* parry: block pressed within parryWindow before contact, on a punch/kick to head or body */
    if(def.isPlayer&&this.inp&&def.guard&&zone!=='leg'&&def.gst>0&&(this.gt||0)-(this.inp.lastBlockP==null?-9:this.inp.lastBlockP)<CE.parryWindow){
      act.outcome='parried';att.flinch=Math.max(att.flinch||0,CE.parryStun);att.queue=[];def.gst-=CE.parryGuardCost;att.sta-=act.c.hit.sta*.4;
      SFXI.play('block',1.1);this.stage.impact(p.x,p.y,.7);this.hitstop=.07;this.ev(`🤚 ${def.name} 패리! ${att.name}의 ${KEYN[act.key]||'공격'}을 쳐냈습니다`);this.dbgParry={t:now_s(),x:p.x,y:p.y};return}
    act.outcome='block';const r=oh.call(this,att,def,act,zone,p);return r}}
{const ad=Match.prototype.applyDmg;Match.prototype.applyDmg=function(att,def,o){const a=att.act;if(a&&a.c&&a.c.hit&&!a.outcome2){a.outcome2=1;a.outcome=o.blocked?'block':'hit';if(!o.blocked)a.dragT=CE.hitDragT}return ad.call(this,att,def,o)}}
/* knock(): pass struck zone, impulse scale and cage wall to the ragdoll */
{const kn=Match.prototype.knock;Match.prototype.knock=function(def,att,ko,kind){def.body._hit={zone:kind==='leg'?'leg':kind==='body'?'body':'head',power:clamp(.75+ATT(att,'punchPow')*.5,.6,1.3),wall:this.stage.R+TUNING.ragdoll.cageInset};return kn.call(this,def,att,ko,kind)}}
/* ---- game clock: Match.t2() runs on simulation time, not wall time ----
   Combo windows, concussion decay delay, whiff/spam/setup windows and cooldowns all read t2(). On wall
   time they kept running during hitstop / slow-motion, so presentation (freeze length) changed balance.
   Simulation time stops when the simulation stops. */
{const st=Match.prototype.step;Match.prototype.step=function(dt){this.simT=(this.simT||0)+dt;return st.call(this,dt)}}
Match.prototype.t2=function(){return this.simT||0};
