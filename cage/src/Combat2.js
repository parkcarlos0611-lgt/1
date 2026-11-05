/* ===== Combat2.js : guard, groggy / KO / TKO, evade, tactics, hooks / overhand, kicks, kick catch, wounds =====
   1. Guard: two directions + middle. Middle auto-defends straight / hook / upper, up covers head kicks and the overhand,
      down is the kick check. Guard stamina is halved (recovers a bit faster); at 0 the guard stays down until it is full again.
      A blocked blow does 35 % of its damage (60 % against a groggy defender).
   2. Groggy / KO: 30-40 % rarer (more with a good chin), a groggy fighter keeps fighting with penalties; groggy lasts 1-3 s by the
      blow; after a KO the winner may keep hitting for ~3 s; KO falls follow the last blow; TKO only on the floor, under back control
      or before getting up. Bleeding (cuts / doctor) is gone; skin flushes red over time instead.
   3. Evade (2 charges, 4.5 s each) and tactics (in-fighting / out-fighting / no guard).
   4. Hooks arc in to the temple, the overhand and the kicks get new shapes; the lead hand has the same swipes as the rear hand. */
(function(){
if(typeof Match==='undefined')return;
const rnd=Math.random;const now=M=>M.t2();
const isKick=M=>!!(M.cfg&&M.cfg.ruleset==='kick');
const LOWK=k=>k==='rlk'||k==='llk'||k==='calf';

if(typeof IFX!=='undefined'){Object.assign(IFX.tiers.blocked,{hs:3,shake:.035,zoom:.02})}
/* ================= 1. guard ================= */
Object.assign(GMATCH,{mid:{straight:1,hook:1,upper:1,body:.85,leg:0},top:{hook:1,straight:.3,upper:.2,body:.2,leg:0}});
{const up=F2.prototype.update;F2.prototype.update=function(dt,M){
  /* translate every legacy guard into the new three: AI too */
  const g=this.guard;if(g==='high'||g==='upp'||g==='body')this.guard='mid';else if(g==='hook')this.guard='top';
  if(this._gM0==null)this._gM0=this.gMax;const tIn=this.tactic==='in'?1.7:1;this.gMax=this._gM0*.5*tIn;if(this.gst>this.gMax)this.gst=this.gMax;
  if(this.gst<=.05)this._gBroken=1;if(this._gBroken&&this.gst>=this.gMax-.05)this._gBroken=0;
  if(this._gBroken||this.tactic==='no'){this.guardHeld=!!this.guard&&this.tactic!=='no';this.guard=null}else this.guardHeld=false;
  const r=up.call(this,dt,M);if(this.gst<this.gMax)this.gst=Math.min(this.gMax,this.gst+dt*1.4);return r}}
/* the player's guard direction: stick up = top, stick down = low, neutral = middle; touch: block swiped up / down */
{const pi=Match.prototype.playerInput;Match.prototype.playerInput=function(dt){const f=this.f[this.pi];const I=this.inp;const ko=this._ko&&this._ko.stage==='slow'&&this._freeT&&performance.now()<this._freeT&&f&&f===this.winner;
  let r;if(ko){/* a few seconds of free hits on the fallen fighter: strikes only */const poll=I.poll;I.poll=function(){return poll.call(this).filter(e=>typeof e==='string'&&/^(jab|punch|kick)/.test(e))};const ph=this.phase;this.phase='fight';try{r=pi.call(this,dt)}finally{this.phase=ph;I.poll=poll}return r}
  r=pi.call(this,dt);
  if(f&&this.phase==='fight'&&f.state==='stand'){
    if(I.evReq){I.evReq=0;this.evade(f)}if(I.tacReq){const t=I.tacReq;I.tacReq=null;this.setTactic(f,t)}
    if(f.guard||f.guardHeld){const up=I.my>.5||I.tgtype==='top'||I.tgtype==='tdd',dn=I.my<-.5||I.tgtype==='low';const want=f.tactic==='no'?null:up?'top':dn?'low':'mid';if(this._gBrokenFor(f)){f.guardHeld=!!want;f.guard=null}else f.guard=want}}
  return r}}
Match.prototype._gBrokenFor=function(f){return !!f._gBroken};
/* a guard that is down (broken): the hands drop a little below the normal middle guard */
{const fw=F2.prototype.footwork;F2.prototype.footwork=function(p,dt){fw.call(this,p,dt);if(this.state!=='stand'||this.act||this.gpose)return;
    if(this.guardHeld&&this._gBroken){p.la_s-=.28;p.ra_s-=.28;p.la_e+=.18;p.ra_e+=.18;p.lean+=.02}
    /* a slightly more upright fighting stance */p.lean-=.07;p.chest-=.02;
    }}
/* tactic stances change the BASE pose, so every strike starts from (and returns to) those hands: no guard = arms hanging and strikes leave from the hips */
{const tp=F2.prototype.targetPose;F2.prototype.targetPose=function(M){const b=tp.call(this,M);if(this.gpose||this.state!=='stand')return b;const tc=this.tactic;
    if(tc==='no'){b.la_s=.14;b.la_e=.32;b.ra_s=.06;b.ra_e=.28;b.head-=.04;b.lean-=.02;b.ll_k+=.04}
    else if(tc==='in'){b.la_s=.72;b.la_e=2.25;b.ra_s=.58;b.ra_e=2.55;b.head+=.07;b.lean+=.05;b.ll_k+=.08;b.rl_k+=.08}
    else if(tc==='out'){b.la_s=1.42;b.la_e=.42;b.ra_s=.62;b.ra_e=2.45;b.lean-=.03}
    if(this.guardHeld&&this._gBroken){b.la_s=Math.min(b.la_s,.75);b.ra_s=Math.min(b.ra_s,.6);b.la_e=Math.min(b.la_e,1.35);b.ra_e=Math.min(b.ra_e,1.7)}
    return b}}
/* the engine's guard checks: legacy names around the old branches */
{const oh=Match.prototype.onHit;Match.prototype.onHit=function(att,def,act,zone,p){
  /* groggy attackers miss more */
  if(att.rock>0&&rnd()<.3&&!act._rkRoll){act._rkRoll=1;act.hit=true;this.onMiss(att,act);return}
  /* evade: a dodged blow does nothing */
  if(act._dodged){act.hit=true;this.onMiss(att,act);return}
  if(def.evT>0&&!LOWK(act.key)&&!def.down&&act._evRoll==null){act._evRoll=rnd()<.7?1:0;if(act._evRoll){act._dodged=1;this.startEvade(def,att,act);act.hit=true;this.onMiss(att,act);return}}
  const g0=def.guard;const kickHead=act.c.leg&&act.c.hit.zone==='head';if(g0==='top'&&kickHead)def.guard='hook';
  try{return oh.call(this,att,def,act,zone,p)}finally{if(def.guard==='hook'&&g0==='top')def.guard='top';if(g0&&!def.guard&&def.gst>.05&&!def._gBroken)def.guard=g0}}}

/* ================= 2. groggy / KO / TKO ================= */
{const hit=StunModel.hit;StunModel.hit=function(M,att,def,dmg,o){const red=.3+.1*ATT(def,'chin');const c0=KO.concussMul,fm=KO.flash.max;KO.concussMul=c0*(1-red);KO.flash.max=fm*(1-red);try{return hit.call(this,M,att,def,dmg,o)}finally{KO.concussMul=c0;KO.flash.max=fm}}}
{const ad=Match.prototype.applyDmg;Match.prototype.applyDmg=function(att,def,o){
  if(o&&o.dmg!=null&&!o._c2){o._c2=1;const a=att.act;
    if(att.rock>0)o.dmg*=.8;/* groggy: weaker blows */
    if(att.rock>0&&a&&a.key==='knee'&&att.state==='clinch')o.dmg*=.7;
    if(def.evT>0&&!o.blocked)o.dmg*=.7;/* weaving takes the sting out */
    if(this._free&&def.down&&def.down.ko)o.dmg*=.2}
  if(o&&o.blocked&&def.body&&def.body.J.lG&&!o._bfx){o._bfx=1;const J=def.body.J,x=(J.lG.x+J.rG.x)/2+att.d*.0,y=(J.lG.y+J.rG.y)/2;const S=this.stage,pw=clamp((o.dmg||2)/2.4,.7,2);S.impact(x,y,1.3+pw*.7,'#bfe0ff',att.d);if(S.burst)S.burst(x,y,att.d,8+Math.round(pw*5),'spark',1.1+pw*.3);S.shake=Math.max(S.shake||0,.035+.02*pw);this.hitstop=Math.max(this.hitstop||0,.055+.015*pw);def.react.x-=att.d*.1*pw;try{JointPhys.kick(def,'lean',-2.2*pw);JointPhys.kick(def,'la_s',-1.6*pw);JointPhys.kick(def,'ra_s',-1.6*pw);JointPhys.kick(att,'chest',.9)}catch(e){}}
  const r0=def.rock>0,had=!!def.down;const r=ad.call(this,att,def,o);
  /* groggy lasts 1-3 s depending on the blow */
  if(!r0&&def.rock>0&&def._ko)def.rock=clamp(1+(def._ko.imp||4)/7,1,3);
  /* TKO: only on the floor / under back control / before getting up, at >= 90 % of the KO threshold, 40 % per blow */
  if(o&&!o.blocked&&o.zone==='head'&&this.phase==='fight'){
    const g=this.g;const floor=def.down&&!def.down.ko&&!def.down.tko||g&&g.type==='ground'&&g.bot===def;const back=g&&g.type==='ground'&&g.pos==='back'&&g.bot===def;
    if((floor||back)&&StunModel.ratio(def)>=.9&&rnd()<.4){if(def.down){def.down.ko=1;def.down.tko=1;def.down.getup=9999}def.body.ko=true;this.finish(att,'TKO','심판 스톱',2.4)}}
  /* a fighter with nothing left in the head goes down for good */
  if(this.phase==='fight'&&def.hp.head<=0&&def.state==='stand'&&!def.down&&!this.g){this.knock(def,att,true,'head');this.finish(att,'KO','타격',2.4)}
  return r}}
{const kn=Match.prototype.knock;Match.prototype.knock=function(def,att,ko,kind){def.body._lastKey=att.act&&att.act.key||att._lastKey2||'cross';if(ko)def.noClinch=1;return kn.call(this,def,att,ko,kind)}}
{const sr=Body.prototype.startRag;Body.prototype.startRag=function(vx,vy,hx,hy){const k=this._lastKey||'';const cat=/upp|upper/.test(k)?'up':/hook|ovh/.test(k)?'hook':/hk|bk|lk|teep|knee/.test(k)?'kick':'str';
  if(cat==='up'){vy*=1.9;vx*=.55;hy+=.5}else if(cat==='hook'){vx*=.75;hx*=.7;hy+=.2}else if(cat==='kick'){vx*=1.35;hx*=1.25}else{vx*=1.15;hx*=1.1}this._lastKey=null;return sr.call(this,vx,vy,hx,hy)}}
{const cl=Match.prototype.clinch;Match.prototype.clinch=function(f){if(this.phase!=='fight'||f.noClinch||f.opp.noClinch||f.opp.down)return;return cl.apply(this,arguments)}}
/* the only TKO is the one declared above (floor / back control / before getting up): the old referee, leg-kick and barrage stoppages are gone */
{const fin=Match.prototype.finish;Match.prototype.finish=function(w,method,detail){if(method==='TKO'&&detail!=='심판 스톱')return;return fin.apply(this,arguments)}}
/* after a KO the winner keeps hitting for ~3 s (no effect on the result, no takedowns) */
{const st=Match.prototype.step;Match.prototype.step=function(dt){if(this.phase==='end'&&this._free&&this.pi!=null&&performance.now()<(this._freeT||0))this.playerInput(dt);return st.call(this,dt)}}
{const fin=Match.prototype.finish;Match.prototype.finish=function(w,method){const was=this.phase;const r=fin.apply(this,arguments);if(was!=='end'&&/KO/.test(method||'')){this._free=1;this._freeT=performance.now()+3000;setTimeout(()=>{this._free=0},3200)}return r}}
{const ch=Match.prototype.checkHit;Match.prototype.checkHit=function(att,act){const def=att.opp;if(this._free&&def.down&&def.down.ko&&performance.now()<(this._freeT||0)){const s=def.state;def.state='stand';try{return ch.call(this,att,act)}finally{def.state=s}}return ch.call(this,att,act)}}
/* no bleeding system: no cuts, no doctor, no bleed meter */
Match.prototype.cutCheck=function(){};
{const up=F2.prototype.update;F2.prototype.update=function(dt,M){this.bleed=0;if(this.body&&this.body.cuts&&this.body.cuts.length)this.body.cuts.length=0;return up.call(this,dt,M)}}
{const st=document.createElement('style');st.textContent='.hbx.bl,[data-bl],.bleed,.bleedbar{display:none!important}';document.head.appendChild(st)}

/* ================= 3. evade ================= */
Match.prototype.evade=function(f){if(f.state!=='stand'||f.evT>0||f.act&&f.act.c.hit&&f.act.t<f.act.c.hit.t1||this.phase!=='fight')return false;const t=now(this);f.evCh=f.evCh||[0,0];const i=f.evCh.findIndex(x=>x<=t);if(i<0)return false;f.evCh[i]=t+4.5;f.evT=2.0;f.guard=null;return true};
/* the dodge itself: slip aside when they are close, lean back when they are far */
Match.prototype.startEvade=function(f,att,act){const gap=Math.abs(att.x-f.x)/(f.H||1.8);f.evA={t:0,dur:.9,kind:gap<.5?'slip':'back',sd:rnd()<.5?1:-1};SFXI.play('whiff',.6)};
{const up=F2.prototype.update;F2.prototype.update=function(dt,M){if(this.evT>0)this.evT=Math.max(0,this.evT-dt);if(this.evA){this.evA.t+=dt;if(this.evA.t>=this.evA.dur)this.evA=null}
  if(!this.evCh)this.evCh=[0,0];
  /* an incoming blow is judged while it is still winding up, so the dodge starts BEFORE contact */
  if(this.evT>0&&M&&this.state==='stand'){const q=this.opp,a=q.act;if(a&&a.c.hit&&a._evRoll==null&&!LOWK(a.key)&&a.t<a.c.hit.t0&&a.t>a.c.hit.t0*.12&&Math.abs(q.x-this.x)<(REACH[a.key]||1)*(q.H/1.6)+.2){a._evRoll=rnd()<.7?1:0;if(a._evRoll){a._dodged=1;M.startEvade(this,q,a)}}}
  /* the AI weaves against incoming strikes now and then */
  if(this.ai&&M&&M.phase==='fight'&&this.state==='stand'&&this.evT<=0){const o=this.opp;if(o.act&&o.act.c.hit&&o.act.t<o.act.c.hit.t0*.8&&Math.abs(o.x-this.x)<1.6&&rnd()<dt*.9*this.ai.diff*(.3+ATT(this,'strDef')))M.evade(this)}
  return up.call(this,dt,M)}}
{const sp=F2.prototype.spd;F2.prototype.spd=function(){return sp.call(this)*(this.evT>0?.82:1)}}
{const fw=F2.prototype.footwork;F2.prototype.footwork=function(p,dt){fw.call(this,p,dt);const e=this.evA;if(!e||this.state!=='stand')return;const u0=clamp(e.t/e.dur,0,1),k=Math.pow(Math.sin(Math.PI*u0),.7);
  if(e.kind==='slip'){p.lean+=.5*k;p.head+=.22*k;p.tw+=.55*k*e.sd;p.ll_k+=.4*k;p.rl_k+=.4*k;p.ll_h+=.18*k;p.y=(p.y||0)-.05*this.H*k;p.la_s+=.1*k;p.ra_s+=.1*k;this._zt=-.55*k}
  else{p.lean-=.55*k;p.head-=.12*k;p.chest-=.1*k;p.x=(p.x||0)-.08*k;p.la_s+=.25*k;p.ra_s+=.25*k;this._zt=.15*k}}}
/* a fighter who is weaving cannot run: forward speed is capped */
{const up=F2.prototype.update;F2.prototype.update=function(dt,M){if(this.evT>0&&this.mvIn*this.d>.8)this.mvIn=.8*this.d;return up.call(this,dt,M)}}

/* ================= 3b. tactics ================= */
Match.prototype.setTactic=function(f,t){f.tactic=f.tactic===t?null:t;f.outT=null};
{const fw=F2.prototype.footwork;F2.prototype.footwork=function(p,dt){fw.call(this,p,dt)}}
/* out-fighting: a red line at the jab's full reach; an opponent inside it gets locked on (white line) and then hit with a quick jab */
const OUT={reach:f=>{const L=f.body.L;return L.uarm+L.farm+L.glove*.8+.05*f.H}};
{const up=F2.prototype.update;F2.prototype.update=function(dt,M){const r=up.call(this,dt,M);
  if(this.tactic==='out'&&M&&M.phase==='fight'&&this.state==='stand'){const o=this.opp,gap=(o.x-this.x)*this.d,R=OUT.reach(this);
    if(!this.outT&&gap>0&&gap<=R+.05&&!this.act)this.outT={t:0,x:this.x+this.d*R};
    if(this.outT){this.outT.t+=dt;const k=Math.min(1,this.outT.t/.15);this.outT.x=(this.x+this.d*R)+(o.x-(this.x+this.d*R))*k;
      if(this.outT.t>=.5){if(this.canStrike()){this.strike('jab',M);if(this.act&&this.act.key==='jab')this.act.speed*=1.5;this.tactic=null;this.outT=null}else this.outT.t=.5}}}
  else this.outT=null;return r}}
{const rd=Match.prototype.render;Match.prototype.render=function(dt){window.__curMatch=this;rd.call(this,dt);const S=this.stage;const f=this.pi!=null?this.f[this.pi]:null;
  let box=this._ofl;if(!box){box=this._ofl=document.createElement('div');box.className='ofl';box.innerHTML='<i class="red"></i><i class="wht"></i>';this.root.appendChild(box)}
  const red=box.firstChild,wht=box.lastChild;if(!f||f.tactic!=='out'||this.phase!=='fight'){box.style.display='none';return}
  box.style.display='block';const sx=x=>(x-S.cam.x)*S.sc()+S.W/2;const R=OUT.reach(f),x=f.x+f.d*R;red.style.left=sx(x)+'px';red.classList.toggle('dim',!!f.outT);
  if(f.outT){wht.style.display='block';wht.style.left=sx(f.outT.x)+'px'}else wht.style.display='none'}}
{const css=document.createElement('style');css.textContent='.ofl{position:absolute;inset:0;pointer-events:none;z-index:6;display:none}.ofl i{position:absolute;top:0;bottom:0;width:5px;margin-left:-2.5px;border-radius:3px}.ofl .red{background:linear-gradient(180deg,rgba(255,40,55,.15),rgba(255,50,64,.95) 16%,rgba(255,50,64,.95) 84%,rgba(255,40,55,.15));box-shadow:0 0 8px 2px rgba(255,40,55,.95),0 0 30px 10px rgba(255,40,55,.5)}.ofl .red.dim{opacity:.55}.ofl .wht{display:none;background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,.98) 16%,rgba(255,255,255,.98) 84%,rgba(255,255,255,.2));box-shadow:0 0 8px 2px rgba(255,255,255,.95),0 0 30px 10px rgba(170,205,255,.6);width:6px;margin-left:-3px}';document.head.appendChild(css)}

/* ================= 4. strikes ================= */
/* hooks: the fist arcs in from the side (elbow high, forearm level) and lands on the temple */
{const fw=F2.prototype.footwork;F2.prototype.footwork=function(p,dt){fw.call(this,p,dt);const a=this.act;if(!a||!a.c||!a.c.hit||this.state!=='stand'||(a.key!=='lhook'&&a.key!=='rhook')||!this.opp||!this.opp.body.J.hd||typeof armIKUp==='undefined')return;
    const h=a.c.hit,t=a.t,d=this.d||1,side=a.c.hand==='l'?'la':'ra';this.body._eMinL=this.body._eMinR=null;if(side==='la')this.body._eMinL=-2.6;else this.body._eMinR=-2.6;
    const OJ=this.opp.body.J,J=this.body.J;const w=t<h.t0*.3?0:t<h.t0?(t-h.t0*.3)/(h.t0*.7):t<=h.t1+.05?1:Math.max(0,1-(t-h.t1-.05)/.14);if(w<=0)return;
    const pre=t<h.t0?1-(t-h.t0*.3)/(h.t0*.7):0;const temple={x:OJ.hd.x-d*.02,y:OJ.hd.y-.02};
    const T={x:temple.x-d*.46*pre,y:temple.y-.08*pre};const tmp=Object.assign({},p);const gap=armIKUp(this,tmp,side,T);
    p[side+'_s']+=(tmp[side+'_s']-p[side+'_s'])*w;p[side+'_e']+=(tmp[side+'_e']-p[side+'_e'])*w;
    p.tw+=(side==='ra'?-.55:.5)*w;p.lean+=.1*w;p.x=(p.x||0)+Math.min(.16,gap)*w*(1-pre);this._zt=Math.max(this._zt||0,.3*w)}}
/* overhand: deeper forward bend, rear leg driving back with the heel up, front knee bent (photos of the real punch) */
if(MV.ovh)for(const kf of MV.ovh.keys){const p=kf[1];if(p.lean!=null&&p.lean>=.5){p.ll_h=1.0;p.ll_k=1.35;p.ll_a=.1;p.rl_h=-.78;p.rl_k=.18;p.rl_a=1.0;p.chest=.18}}

/* ================= 5. kicks ================= */
/* oblique kick (replaces the calf kick): the lead foot stamps into the opponent's knee */
MV.calf={n:'오블리킥',dur:.5,keys:[[0,{}],[.09,{ll_h:.2,ll_k:1.35,rl_h:-.12,rl_k:.2,x:-.02,lean:-.04}],[.19,{ll_h:.95,ll_k:.3,ll_a:.55,lean:-.18,tw:-.35,rl_h:-.12,rl_k:.28,x:.1,la_s:.8,ra_s:.6},'o'],[.27,{ll_h:.95,ll_k:.3,ll_a:.55,lean:-.18,tw:-.35,rl_h:-.12,rl_k:.28,x:.1}],[.5,{}]],hit:{t0:.15,t1:.27,pt:'lA',zone:'leg',dmg:5.6,kind:'kick',sta:4.5},lunge:.06,leg:'l'};
if(typeof KEYN!=='undefined')KEYN.calf='오블리킥';
/* kick check: the knee comes up and the shin hangs straight down (the real check) */
if(MV.check)MV.check.keys[0][1]=Object.assign({},MV.check.keys[0][1],{ll_h:1.15,ll_k:1.15,ll_a:.1,rl_k:.25,lean:.04,la_s:.95,la_e:2.2,ra_s:.85,ra_e:2.25});
/* mid / low kick aims: the mid kick finds the ribs from the side, the low kick lands between knee and calf, the oblique on the knee */
{const fw=F2.prototype.footwork;F2.prototype.footwork=function(p,dt){fw.call(this,p,dt);const a=this.act;if(!a||!a.c||!a.c.hit||this.state!=='stand'||!this.opp||!this.opp.body.J.lK)return;const k=a.key;if(k!=='calf'&&k!=='rlk'&&k!=='llk')return;
    const h=a.c.hit,t=a.t;const w=t<h.t0*.25?0:t<h.t0?(t-h.t0*.25)/(h.t0*.75):t<=h.t1+.04?1:Math.max(0,1-(t-h.t1-.04)/.14);if(w<=0)return;const OJ=this.opp.body.J,d=this.d||1,side=a.c.leg==='r'?'rl':'ll';
    const T=k==='calf'?{x:OJ.lK.x-d*.03,y:OJ.lK.y}:{x:OJ.lK.x+(OJ.lA.x-OJ.lK.x)*.3-d*.03,y:OJ.lK.y+(OJ.lA.y-OJ.lK.y)*.3};
    const tmp=Object.assign({},p);legIK(this,tmp,side,T);p[side+'_h']+=(tmp[side+'_h']-p[side+'_h'])*w;p[side+'_k']+=(tmp[side+'_k']-p[side+'_k'])*w}}
/* the mid kick swings across the body: depth lane and a big hip turn */
{const fw=F2.prototype.footwork;F2.prototype.footwork=function(p,dt){fw.call(this,p,dt);const a=this.act;if(!a||!a.c||this.state!=='stand'||(a.key!=='rbk'&&a.key!=='lbk'))return;const h=a.c.hit;const w=clamp((a.t-h.t0*.4)/(h.t0*.6),0,1)*(a.t<=h.t1+.1?1:Math.max(0,1-(a.t-h.t1-.1)/.2));p.tw+=(a.key==='rbk'?.35:-.3)*w;this._zt=Math.max(this._zt||0,.4*w);if(this.opp)this.opp._zt=Math.min(this.opp._zt||0,-.2*w)}}
/* low kick ("calf kick") shape: the leg whips round low, the torso bends away */
if(MV.rlk&&!MV.rlk._v2){MV.rlk._v2=1;for(const kf of MV.rlk.keys){const p=kf[1];if(p.rl_h&&p.rl_h>.8){p.rl_h=.8;p.lean=-.22;p.tw=.95}}}

/* ================= 6. kick catch: the free hand uses the usual punches at 40 % ================= */
Match.prototype.catchPunch=function(kind){const g=this.g;if(!g||g.type!=='kcatch'||kind==='over')return;if(g.pun){g.q=kind;return}if(g.n>=8)return;g.pun={t:0,hit:0,kind:kind||'str'};g.n++};
{const pi=Match.prototype.playerInput;Match.prototype.playerInput=function(dt){const g=this.g;if(g&&g.type==='kcatch'&&this.pi!=null){const f=this.f[this.pi],I=this.inp;if(f===g.att){const ev=I.poll();f.mvIn=0;f.circ=0;g.mv=Math.abs(I.mx)>.25?Math.sign(I.mx)*clamp(Math.abs(I.mx),0,1):0;for(const e of ev){if(e==='pause'){this.pause();continue}if(this.phase!=='fight'||this.g!==g)continue;
        if(e.startsWith('td'))this.catchTD();else if(e==='clinch'||e==='escape')this.endCatch();else if(e.startsWith('punch:'))this.catchPunch({straight:'str',hook:'hook',upper:'upp',body:'body',over:'over'}[e.slice(6)]||'str')}return}}return pi.call(this,dt)}}
{const uc=Match.prototype.updCatch;Match.prototype.updCatch=function(dt){const g=this.g;const P=g&&g.pun;if(P&&!P._p){P._p=1;P.kind=P.kind||'str'}
  const r=uc.call(this,dt);return r}}

/* ================= 7. wounds: bruises, swelling, abrasions and cuts appear where a blow landed, slowly, as much as the skin lets them ================= */
const HEADSPOT={straight:[[.074,-.002],[.062,-.04],[.05,.032]],hook:[[.012,.026],[.044,-.012],[.052,.034]],upper:[[.05,-.068],[.07,-.045],[.03,-.07]],kick:[[.015,.02],[.045,-.05],[.01,-.03]]};
function woundSpot(key){const k=/upp/.test(key)?'upper':/hook|ovh/.test(key)?'hook':/hk|bk|lk|knee|teep|calf/.test(key)?'kick':'straight';const L=HEADSPOT[k];const p=L[Math.floor(rnd()*L.length)];return{w:p[0]+(rnd()-.5)*.012,h:p[1]+(rnd()-.5)*.012}}
{const ad=Match.prototype.applyDmg;Match.prototype.applyDmg=function(att,def,o){const r=ad.call(this,att,def,o);if(o&&!o.blocked&&o.dmg!=null&&def.body&&o.dmg>1.2){const key=att.act&&att.act.key||'jab';const soft=1.45-ATT(def,'skin')*1.0;const sev=clamp(o.dmg*soft/7,.18,1.3);const W=def.body._wounds||(def.body._wounds=[]);const t=performance.now()/1000;
    if(o.zone==='head'){const sp=woundSpot(key);const w={t0:t+.35,zone:'head',w:sp.w,h:sp.h,sev,ang:rnd()*3.1,kind:'bruise'};W.push(w);
      if(sev>.5)W.push({t0:t+1.2,zone:'head',w:sp.w,h:sp.h,sev:sev*.9,ang:w.ang,kind:'swell'});
      if(o.dmg>6&&rnd()<.55*soft&&sp.h>-.05)W.push({t0:t+.8,zone:'head',w:sp.w+.004,h:sp.h+.004,sev:Math.min(1.2,sev),ang:rnd()*1.2-.6,kind:'cut'});
      else if(rnd()<.5*soft)W.push({t0:t+.6,zone:'head',w:sp.w,h:sp.h,sev:sev*.8,ang:rnd()*3,kind:'scrape'});
      if(o.dmg>5&&rnd()<.4*soft&&def.body.J.hd)this.stage.burst(def.body.J.hd.x,def.body.J.hd.y,att.d,3+Math.round(soft*3),'blood',.8)}
    else if(o.zone==='body')W.push({t0:t+.5,zone:'body',w:.0+(rnd()-.5)*.03,h:(rnd()-.4)*.08,sev,ang:rnd()*3,kind:'bruise'});
    else W.push({t0:t+.5,zone:'legs',w:(rnd()-.5)*.02,h:.2+rnd()*.5,sev:sev*.8,ang:rnd()*3,kind:'bruise'});
    while(W.length>14)W.shift()}return r}}
{const nr=Match.prototype.nextRound;if(nr)Match.prototype.nextRound=function(){for(const f of this.f)if(f.body._wounds)for(const w of f.body._wounds)w.sev*=.72;return nr.apply(this,arguments)}}
{const D=Body.prototype.draw;Body.prototype.draw=function(ctx,o){const r=D.call(this,ctx,o);const Wd=this._wounds,J=this.J;if(!Wd||!Wd.length||!J.hd||this.look&&this.look.ref||o&&(o.onlyArm||o.part==='far'))return r;
    const H=this.H,d=this.d,a=this.ang.hd||0,now=performance.now()/1000;const up={x:d*Math.sin(a),y:Math.cos(a)},fw={x:d*Math.cos(a),y:-Math.sin(a)};
    const at=(wd)=>{if(wd.zone==='head')return{x:J.hd.x+up.x*wd.h*H+fw.x*wd.w*H,y:J.hd.y+up.y*wd.h*H+fw.y*wd.w*H};
      if(wd.zone==='body'){const m={x:(J.mid.x+J.sh.x)/2,y:(J.mid.y+J.sh.y)/2};return{x:m.x+d*(.05+wd.w)*H,y:m.y+wd.h*H}}
      const k=J.lK&&J.lH?wd.h:.5;const A=J.lH,B=J.lK;return A?{x:A.x+(B.x-A.x)*k+d*.01*H,y:A.y+(B.y-A.y)*k}:null};
    ctx.save();for(const wd of Wd){const v0=clamp((now-wd.t0)/4.5,0,1);if(v0<=0)continue;const v=v0*v0*(3-2*v0);const P=at(wd);if(!P)continue;const R=(wd.zone==='head'?.034:wd.zone==='body'?.05:.04)*H*(.6+.7*Math.min(1.2,wd.sev))*(.65+.45*v);const al=Math.min(1,wd.sev+.15)*v;if(R>.15){(window.__dbgW=window.__dbgW||[]).length<6&&window.__dbgW.push([wd.kind,wd.zone,+R.toFixed(3),+(P.x).toFixed(2),+(P.y).toFixed(2),+H.toFixed(2),+v.toFixed(2),+wd.sev.toFixed(2),wd.w,wd.h]);}
      if(wd.kind==='bruise'){const g=ctx.createRadialGradient(P.x,P.y,0,P.x,P.y,R*1.35);g.addColorStop(0,`rgba(112,36,72,${.5*al})`);g.addColorStop(.45,`rgba(176,48,56,${.42*al})`);g.addColorStop(1,'rgba(190,50,50,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(P.x,P.y,R*1.35,0,7);ctx.fill()}
      else if(wd.kind==='swell'){ctx.fillStyle=`rgba(208,78,70,${.32*al})`;ctx.beginPath();ctx.ellipse(P.x,P.y,R*.8,R*.64,wd.ang*.3,0,7);ctx.fill();ctx.strokeStyle=`rgba(110,24,32,${.45*al})`;ctx.lineWidth=.0045*H;ctx.beginPath();ctx.ellipse(P.x,P.y,R*.8,R*.64,wd.ang*.3,.15,Math.PI-.15);ctx.stroke();ctx.fillStyle=`rgba(255,235,225,${.3*al})`;ctx.beginPath();ctx.ellipse(P.x-R*.22,P.y+R*.2,R*.26,R*.14,-.5,0,7);ctx.fill()}
      else if(wd.kind==='scrape'){ctx.strokeStyle=`rgba(168,38,44,${.7*al})`;ctx.lineWidth=.004*H;ctx.lineCap='round';for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(P.x+Math.cos(wd.ang)*R*.5+i*R*.22,P.y+Math.sin(wd.ang)*R*.5-i*R*.12);ctx.lineTo(P.x-Math.cos(wd.ang)*R*.5+i*R*.22,P.y-Math.sin(wd.ang)*R*.5-i*R*.12);ctx.stroke()}}
      else{/* cut: a dark split, a brighter wet line inside and a blood run down the skin */const cx=Math.cos(wd.ang)*R*.62,cy=Math.sin(wd.ang)*R*.62;ctx.lineCap='round';ctx.strokeStyle=`rgba(86,6,12,${.95*al})`;ctx.lineWidth=.0075*H;ctx.beginPath();ctx.moveTo(P.x-cx,P.y-cy);ctx.lineTo(P.x+cx,P.y+cy);ctx.stroke();
        ctx.strokeStyle=`rgba(214,30,40,${.85*al})`;ctx.lineWidth=.0034*H;ctx.beginPath();ctx.moveTo(P.x-cx*.8,P.y-cy*.8);ctx.lineTo(P.x+cx*.8,P.y+cy*.8);ctx.stroke();
        const run=R*(.9+1.6*v)*wd.sev;ctx.strokeStyle=`rgba(150,12,20,${.75*al})`;ctx.lineWidth=.0055*H;ctx.beginPath();ctx.moveTo(P.x+cx*.3,P.y+cy*.3);ctx.quadraticCurveTo(P.x+cx*.2+d*R*.1,P.y-run*.5,P.x+cx*.1,P.y-run);ctx.stroke();ctx.fillStyle=`rgba(150,12,20,${.8*al})`;ctx.beginPath();ctx.arc(P.x+cx*.1,P.y-run,.0042*H,0,7);ctx.fill()}}
    ctx.restore();return r}}
/* ---------- the referee stands further back and runs in to a fallen fighter ---------- */
{const sp=F2.prototype.spd;F2.prototype.spd=function(){const b=sp.call(this);if(this.name==='ref'){const M=window.__curMatch;if(M&&M.phase==='end'&&M.f.some(f=>f.down&&f.down.ko))return b*2.7}return b}}
/* ---------- a shorter recovery after the blow (the wind-up and the blow itself stay slower) ---------- */
{const up=F2.prototype.update;F2.prototype.update=function(dt,M){const a=this.act;if(a&&a.c.hit&&!a._rec&&a.t>a.c.hit.t1+.02&&this.name!=='ref'){a._rec=1;a.speed*=1.3}return up.call(this,dt,M)}}
/* ---------- a groggy fighter's takedown shot often fails ---------- */
{const sh=Match.prototype.shoot;Match.prototype.shoot=function(f){if(f.rock>0&&Math.random()<.4){f.sta-=5;f.react.x-=f.d*.25;return}return sh.apply(this,arguments)}}
/* the clinch knee loses 30 % while groggy (handled in applyDmg) */

/* kick catch: whatever the punch clip does, the lead arm keeps holding the leg */
{const fw=F2.prototype.footwork;F2.prototype.footwork=function(p,dt){fw.call(this,p,dt);const M=window.__curMatch,g=M&&M.g;if(g&&g.type==='kcatch'&&this===g.att&&g.hold){p.la_s=g.hold.la_s;p.la_e=g.hold.la_e;p.lo=g.hold.lo}}}
})();
