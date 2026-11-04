/* ===== Grappling2.js : catching kicks, takedown entries by swipe, the takedown-defence stance =====
   • Takedown button: swipe up = single leg, swipe down = double leg (low level change), tap = read the opening.
   • Block button swiped up (keyboard V): takedown-defence stance — hips back, hands low. A shot into it is
     sprawled on most of the time; it does nothing against strikes.
   • Kick catch: press clinch while a body / leg kick is coming (or have the guard up when it lands) and the
     leg is trapped under the arm. While holding it: takedown button = trip / single-leg finish, punch or jab =
     a free-hand punch (the kicker is hopping and can barely defend), clinch = let go. The kicker mashes to hop out. */
(function(){
if(typeof Match==='undefined')return;
const T2=M=>M.t2();
const L=(a,b,u)=>({x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u});

/* ---------- takedown entry chosen by the swipe ---------- */
{const st=Match.prototype.startTdAnim;Match.prototype.startTdAnim=function(f,o,kind){if(f._tdKind&&TDA[f._tdKind])kind=f._tdKind;f._tdKind=null;return st.call(this,f,o,kind)}}

/* ---------- the defence stance: pose ---------- */
{const fw=F2.prototype.footwork;F2.prototype.footwork=function(p,dt){fw.call(this,p,dt);
    const on=this.state==='stand'&&this.guard==='tdd'&&!this.act;this._tddK=(this._tddK||0)+((on?1:0)-(this._tddK||0))*Math.min(1,dt*12);const k=this._tddK;if(k<.01)return;
    /* level down, hips back, chest over the knees, hands low and forward to meet the shot */
    p.lean+=(.32-p.lean*.2)*k;p.chest+=.05*k;p.head-=.12*k;p.ll_k+=.42*k;p.rl_k+=.38*k;p.ll_h+=.22*k;p.rl_h+=.05*k;p.ll_a-=.1*k;
    p.la_s+=(1.05-p.la_s)*k;p.la_e+=(.95-p.la_e)*k;p.ra_s+=(.9-p.ra_s)*k;p.ra_e+=(1.1-p.ra_e)*k}}

/* ---------- shot resolution: stance, entry type ---------- */
{const ug=Match.prototype.updGrapple;Match.prototype.updGrapple=function(dt){const g=this.g;
  if(g&&g.type==='kcatch'){this.updCatch(dt);return}
  if(g&&g.type==='shoot'&&!g.done&&g.t+dt>=.38){const f=g.att,o=g.def;const stance=o.guard==='tdd'||o._tddK>.5;
    if(stance){const p=clamp(.88-ATT(f,'takedown')*.18+ATT(o,'tdd')*.12-(o.sta<20?.15:0),.55,.97);
      if(Math.random()<p){g.done=1;this.g=null;f.state='stand';f.act=null;f.queue=[];f.react.x-=f.d*.3;f.flinch=.45;f.sta-=6;o.sta-=2;
        SFXI.play('block',.9);this.stage.shake=.05;this.hitstop=.05;this.ev(`🛡️ ${o.name} 태클 방어 자세 — 스프롤로 차단!`);return}
      g.spr=1}
    /* the double leg drives through harder, the single leg is harder to sprawl on */
    const kind=f._tdKind,A0=f.A,B0=o.A;f.A=Object.assign({},A0,{takedown:(A0.takedown||10)+(kind==='double'?1.2:kind==='single'?.6:0)});if(kind==='single'&&g.spr&&Math.random()<.35)g.spr=0;
    try{return ug.call(this,dt)}finally{f.A=A0;o.A=B0}}
  return ug.call(this,dt)}}

/* ---------- kick catch: timing window from the clinch button ---------- */
const CATCHABLE=k=>{const c=MV[k];return c&&c.leg&&c.hit&&c.hit.kind==='kick'&&c.hit.zone!=='head'};
{const cl=Match.prototype.clinch;Match.prototype.clinch=function(f){const o=f.opp,a=o.act;
  if(f.state==='stand'&&o.state==='stand'&&a&&CATCHABLE(a.key)&&!a.hit&&a.t<a.c.hit.t1+.03&&Math.abs(o.x-f.x)<1.6){f._catchT=T2(this)+.45;return}
  return cl.apply(this,arguments)}}
{const oh=Match.prototype.onHit;Match.prototype.onHit=function(att,def,act,zone,p){
  if(!this.g&&def.state==='stand'&&att.state==='stand'&&act&&CATCHABLE(act.key)&&zone!=='head'&&!(this.cfg&&this.cfg.training==='bag')){
    let pc=0;if(def._catchT>T2(this))pc=.8+ATT(def,'clinchStr')*.12;else if(def.guard&&def.guard!=='tdd'&&def.gst>0)pc=.18+ATT(def,'strDef')*.14+ATT(def,'clinchStr')*.1;else if(def.ai&&!def.act)pc=.04+ATT(def,'clinchStr')*.07;
    if(Math.random()<pc){def._catchT=0;this.applyDmg(att,def,{zone:'body',dmg:.26*act.c.hit.dmg*.25,kind:'kick',blocked:1});this.startCatch(def,att,act);return}}
  return oh.apply(this,arguments)}}

Match.prototype.startCatch=function(C,K,act){const leg=act.c.leg==='l'?'ll':'rl';
  this.g={type:'kcatch',att:C,def:K,t:0,leg,d:C.d,ax:C.x,pun:null,n:0,esc:0,ai:C.ai?{plan:Math.random()<.5?'td':'punch',t:.35+Math.random()*.35}:null};
  for(const x of[C,K]){x.state='sprawl';x.act=null;x.queue=[];x.guard=null;x.gRate=18;x.body.rag=null}K.d=-C.d;
  SFXI.play('block',.85);this.stage.shake=.05;this.hitstop=.06;this.ev(`🦵✋ ${C.name} ${K.name}의 킥을 잡았습니다!`)};
Match.prototype.endCatch=function(msg){const g=this.g;if(!g||g.type!=='kcatch')return;const C=g.att,K=g.def;this.g=null;
  for(const x of[C,K]){x.state='stand';x.gpose=null;x.act=null;x.guard=null}K.x+=K.d*-.28;K.react.x+=-K.d*.1;if(msg)this.ev(msg)};
Match.prototype.catchTD=function(){const g=this.g,C=g.att,K=g.def;const p=clamp(.78+(ATT(C,'takedown')-ATT(K,'tdd'))*.4+(K.sta<30?.08:0),.5,.95);
  if(Math.random()<p){this.g=null;C._tdKind='single';this.startTdAnim(C,K,'single');this.ev(`⬇️ 잡은 다리를 걸어 넘깁니다!`)}
  else this.endCatch(`${K.name} 한 발로 버티며 다리를 빼냅니다`)};
Match.prototype.catchPunch=function(){const g=this.g;if(g.pun){g.q=1;return}if(g.n>=4)return;g.pun={t:0,hit:0};g.n++};

/* ---------- the held-leg position and the free-hand punches ---------- */
Match.prototype.updCatch=function(dt){const g=this.g,C=g.att,K=g.def,d=g.d;g.t+=dt;
  C.x=g.ax;C.d=d;K.d=-d;K.x+=(C.x+d*.95-K.x)*Math.min(1,dt*10);
  const CJ=C.body.J,KJ=K.body.J;const hop=Math.max(0,Math.sin(g.t*10.5))*.035;
  const pc=Object.assign({},BASE_POSE,{lean:.16,chest:.05,head:.04,ll_h:.38,ll_k:.4,rl_h:-.32,rl_k:.42,rl_a:.35,la_s:.95,la_e:1.6,ra_s:.6,ra_e:2.3});
  const pk=Object.assign({},BASE_POSE,{y:hop,lean:-.18+Math.sin(g.t*9)*.05,chest:-.05,head:.12,la_s:1.7+Math.sin(g.t*8)*.25,la_e:.6,ra_s:.9,ra_e:1.9});
  const held=g.leg,sup=held==='ll'?'rl':'ll';pk[sup+'_h']=.05;pk[sup+'_k']=.18;pk[sup+'_a']=.15;
  /* the caught leg is pinned at the catcher's hip under his lead arm */
  if(CJ.mid){legIK(K,pk,held,{x:CJ.hip.x+d*.02,y:CJ.mid.y-.08});pk[held+'_a']=.55}else{pk[held+'_h']=1.45;pk[held+'_k']=.3}
  if(KJ.lK&&KJ.lA){const kn=held==='ll'?KJ.lK:KJ.rK,an=held==='ll'?KJ.lA:KJ.rA;armIK(C,pc,'la',L(kn,an,.6))}
  /* free (rear) hand: guard, or a punch to the jaw */
  if(g.pun&&KJ.hd){const P=g.pun;P.t+=dt;const u=P.t/.3;const w=u<.45?u/.45:Math.max(0,1-(u-.45)/.55);const tmp=Object.assign({},pc);armIK(C,tmp,'ra',{x:KJ.hd.x-d*.06,y:KJ.hd.y-.05});
    pc.ra_s+=(tmp.ra_s-pc.ra_s)*w;pc.ra_e+=(tmp.ra_e-pc.ra_e)*w;pc.tw=(pc.tw||0)+.25*w;pc.lean+=.06*w;
    if(u>=.45&&!P.hit){P.hit=1;const dmg=.26*MV.cross.hit.dmg*1.15*(.55+ATT(C,'punchPow')*.75+ATT(C,'strength')*.15)*(.55+.45*C.sta/C.staMax);
      const hp={x:KJ.hd.x-d*.05,y:KJ.hd.y-.04};this.applyDmg(C,K,{zone:'head',dmg,kind:'punch',p:hp,chin:Math.random()<.22});K.react.h=(K.react.h||0)-.3;K.react.x+=d*.04;C.st&&C.st.land++;
      SFXI.play('hit',.95);this.stage.impact(hp.x,hp.y,.9,'#fff',d);this.hitstop=.06;this.stage.shake=Math.max(this.stage.shake||0,.05);if(window.hitJiggle)try{hitJiggle(K.body,'head',1,d)}catch(e){}}
    if(u>=1){g.pun=null;if(g.q){g.q=0;this.catchPunch()}}}
  C.gpose=pc;K.gpose=pk;
  /* AI on either side */
  if(g.ai){g.ai.t-=dt;if(g.ai.t<=0){if(g.ai.plan==='td'){this.catchTD();return}if(!g.pun){if(g.n<2||Math.random()<.5)this.catchPunch();else if(Math.random()<.5){this.catchTD();return}else{this.endCatch();return}}g.ai.t=.3+Math.random()*.25}}
  if(K.ai)g.esc+=dt*(.18+ATT(K,'footwork')*.25+ATT(K,'clinchStr')*.12);
  if(g.esc>=1||g.t>2.8){this.endCatch(g.esc>=1?`${K.name} 다리를 빼냅니다`:null)}};

/* ---------- player input while a leg is held ---------- */
{const pi=Match.prototype.playerInput;Match.prototype.playerInput=function(dt){const g=this.g;if(!g||g.type!=='kcatch')return pi.call(this,dt);
  const f=this.f[this.pi],I=this.inp;const ev=I.poll();f.mvIn=0;f.circ=0;
  for(const e of ev){if(e==='pause'){this.pause();continue}if(this.phase!=='fight'||this.g!==g)continue;
    if(f===g.att){if(e.startsWith('td'))this.catchTD();else if(e==='jab'||e.startsWith('jab:')||e.startsWith('punch'))this.catchPunch();else if(e==='clinch'||e==='escape')this.endCatch()}
    else g.esc+=.1+ATT(f,'footwork')*.06}}}
})();
