/* ===== Ground2.js : takedowns, the downed fighter, guard entry, position fights and the five submissions =====
   1. Every grappling move starts with a wind-up and is slower (ease in / out); depth is suggested with a scale + shadow lane.
   2. Takedown shots: slower, a feint / level change first, a soft recovery when they miss, single / double leg rebuilt with
      impact on the catch and layered drawing (the defender's far arm hidden, the near arm in front).
   3. A downed fighter lies on his back with his guard up (no ragdoll); the takedown button enters his guard through a short
      red / blue gauge, then the top-guard game continues.
   4. Position changes are a ring game: the arrow fills a red ring for the mover and a blue ring for the defender, stick / buttons
      push them, both fighters strain and breathe.
   5. Submissions: rear naked choke, guillotine, armbar, arm triangle, triangle — a red / blue tug-of-war gauge where every press
      costs 1-2 % stamina, the fresher fighter has the edge, 0 stamina decides the hold, and finishing is deliberately hard. */
(function(){
if(typeof Match==='undefined')return;
const rnd=Math.random;const ST=f=>clamp(f.sta/f.staMax,0,1);const EMPTY=f=>f.sta<=f.staMax*.012;
/* the engine scales every stamina decrease (MotionPhysics.staminaDrain): ground costs are exact percentages of the maximum */
const spend=(f,pct)=>{const k=typeof MP!=='undefined'?MP.staminaDrain:1;if(typeof MP!=='undefined')MP.staminaDrain=1;f.sta=Math.max(0,f.sta-f.staMax*pct);if(typeof MP!=='undefined')MP.staminaDrain=k;if(f.sta<.01)f.sta=0};
const L2=(a,b,u)=>({x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u});
const mk=o=>Object.assign({},BASE_POSE,o,{free:1});
const keyPose=(K,t)=>{let i=0;while(i<K.length-2&&t>K[i+1][0])i++;const a=K[i],b=K[Math.min(i+1,K.length-1)];const u=b[0]>a[0]?clamp((t-a[0])/(b[0]-a[0]),0,1):1;const e=u*u*(3-2*u);const p={};for(const k of PK){const x=a[1][k]!=null?a[1][k]:BASE_POSE[k]||0,y=b[1][k]!=null?b[1][k]:BASE_POSE[k]||0;p[k]=x+(y-x)*e}p.free=1;return p};
const nearOf=(F,d)=>{const nl=(d>0)===(((F.body&&F.body.stance)||F.stance||1)>0);return nl?{arm:'la',fArm:'ra',leg:'ll',fLeg:'rl'}:{arm:'ra',fArm:'la',leg:'rl',fLeg:'ll'}};

/* ---------- floating grunt / label near a fighter ---------- */
function popText(M,f,txt,cls){const S=M.stage,J=f.body.J;if(!J.hd||!M.root)return;const s=S.sc();const x=((J.hd.x-S.cam.x)*s+S.W/2),y=S.Hh*S.cam.gy-J.hd.y*s-36;
  const el=document.createElement('div');el.className='g2pop '+(cls||'');el.textContent=txt;el.style.left=x+'px';el.style.top=y+'px';M.root.appendChild(el);setTimeout(()=>el.remove(),1000)}
{const css=document.createElement('style');css.textContent='.g2pop{position:absolute;z-index:42;pointer-events:none;transform:translate(-50%,0);font:900 17px/1 system-ui,sans-serif;color:#fff;text-shadow:0 2px 0 #000,0 0 8px rgba(0,0,0,.7);animation:g2p 1s ease-out forwards}.g2pop.r{color:#ff6a62}.g2pop.b{color:#6aa8ff}@keyframes g2p{0%{opacity:0;margin-top:6px}20%{opacity:1}100%{opacity:0;margin-top:-26px}}'+
  '.gwc .gr{position:absolute;width:46px;height:46px;border-radius:50%;pointer-events:none;background:conic-gradient(#e8332f calc(var(--a)*1%),transparent 0),conic-gradient(from calc(360deg - var(--b)*3.6deg),#2f7be8 calc(var(--b)*1%),transparent 0);-webkit-mask:radial-gradient(circle,transparent 56%,#000 60%);mask:radial-gradient(circle,transparent 56%,#000 60%)}'+
  '.gwc .gr:before{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid rgba(255,255,255,.18)}.gwc .gr.u{left:calc(50% - 23px);top:-9px}.gwc .gr.d{left:calc(50% - 23px);bottom:-9px}.gwc .gr.l{left:-14px;top:calc(50% - 23px)}.gwc .gr.r{right:-14px;top:calc(50% - 23px)}'+
  '.sbtug{display:flex;overflow:hidden}.sbtug s{display:block;height:100%}.sbtug .r{background:linear-gradient(90deg,#c0231f,#ff5148)}.sbtug .b{background:linear-gradient(90deg,#4a8cff,#2563c9)}.sbs{display:flex;justify-content:space-between;font:700 12px/1 system-ui,sans-serif;margin-top:3px}.sbs .r{color:#ff6a62}.sbs .b{color:#6aa8ff}';document.head.appendChild(css)}

/* ---------- depth lane: a fighter pulled toward / pushed away from the camera is drawn a little larger / smaller ---------- */
{const st=Match.prototype.step;Match.prototype.step=function(dt){const r=st.call(this,dt);const k=Math.min(1,dt*7);for(const f of this.f){f._z=(f._z||0)+((f._zt||0)-(f._z||0))*k;f._zt=0}return r}}
{const D=Body.prototype.draw;Body.prototype.draw=function(ctx,o){const F=this._owner;const z=F&&F._z||0;if(Math.abs(z)<.012||!this.J.hip)return D.call(this,ctx,o);const sc=1+z*.07,x=this.J.hip.x;ctx.save();ctx.translate(x,0);ctx.scale(sc,sc);ctx.translate(-x,0);try{return D.call(this,ctx,o)}finally{ctx.restore()}}}
{const dr=F2.prototype.draw;F2.prototype.draw=function(ctx,o){this.body._owner=this;return dr.call(this,ctx,o)}}

/* ---------- 1. slower strikes (the wind-up is already in the strike clips) ---------- */
{const sk=F2.prototype.strike;F2.prototype.strike=function(key,M){const ok=sk.call(this,key,M);if(ok&&this.act&&!this.act.combo&&this.name!=='ref')this.act.speed*=.9;return ok}}

/* ---------- 2. takedown shot: feint, level change, then the step in; a miss ends with a stumble and a quick recovery ---------- */
MV.shoot.keys=[[0,{}],[.1,{lean:-.1,head:.12,ll_k:.5,rl_k:.55,la_s:.7,la_e:1.9,ra_s:.4,ra_e:2.4}],[.22,{lean:.2,ll_k:.7,rl_k:.8,ll_h:.4,la_s:.9,la_e:1.2,ra_s:.7,ra_e:1.5}],
  [.32,{lean:.75,head:-.2,ll_k:1.2,rl_k:1.2,ll_h:.8,la_s:.9,la_e:.9,ra_s:.8,ra_e:.9}],[.5,{lean:1.25,head:-.6,ll_h:1.4,ll_k:2.1,ll_a:.2,rl_h:-.9,rl_k:.3,rl_a:1.0,la_s:.15,la_e:.3,ra_s:.05,ra_e:.4,x:.2,lo:1,ro:1}],
  [.74,{lean:1.25,head:-.6,ll_h:1.4,ll_k:2.1,rl_h:-.9,rl_k:.3,la_s:.15,la_e:.3,ra_s:.05,ra_e:.4,x:.2,lo:1,ro:1}]];MV.shoot.dur=.74;
MV.shootMiss={n:'헛태클',dur:.95,ease:'io',keys:[[0,{lean:1.2,head:-.55,ll_h:1.3,ll_k:2.0,rl_h:-.9,rl_k:.4,la_s:.3,la_e:.5,ra_s:.2,ra_e:.6,x:.2}],[.18,{lean:1.0,head:-.4,ll_h:1.1,ll_k:1.7,rl_h:-.6,rl_k:.5,la_s:.7,la_e:.9,ra_s:.6,ra_e:1.0,x:.12}],
  [.5,{lean:.55,head:-.1,ll_h:.7,ll_k:1.1,rl_h:-.4,rl_k:.7,la_s:.95,la_e:1.5,ra_s:.6,ra_e:2.0,x:.04}],[.95,{}]]};
{const ug=Match.prototype.updGrapple;Match.prototype.updGrapple=function(dt){const g=this.g;
  if(g&&g.type==='shoot'){const f=g.att;if(!g._sl){g._sl=1;if(f.act)f.act.speed=.62}const x0=f.x;const r=ug.call(this,dt*.62);
    if(g.t<.14)f.x=x0;/* no lunge during the feint */
    if(g.done&&this.g===null&&f.state==='stand'&&!f.act){f.act={key:'shootMiss',c:MV.shootMiss,t:0,speed:.9};f.sta-=3}
    return r}
  if(g&&g.type==='sprawl'){/* the sprawler may lock a guillotine in the first moments */
    if(!g._w){g._w=1;g.t=Math.min(g.t,.0);const d=g.def;if(this.pi!=null&&d===this.f[this.pi])popText(this,d,'길로틴? (잽/테이크다운)','b')}
    if(g.t<.9&&g.def.ai&&!g._try&&g.t>.2){g._try=1;if(rnd()<clamp(.06+ATT(g.def,'subOff')*.28,.04,.4)*g.def.ai.diff){this.startGuillotine(g.def,g.att);return}}
    if(g.t>1.1){this.g=null;for(const x of this.f){x.state='stand';x.gpose=null}g.att.react.x-=g.att.d*.3;return}
    g.t+=dt;return}
  if(g&&g.type==='clinch'&&!g.sub){for(const f of[g.att,g.def])if(f.ai&&rnd()<dt*.035*ATT(f,'subOff')*f.ai.diff){this.startGuillotine(f,f.opp);return}}
  if(g&&g.type==='gentry'){this.updEntry(dt);return}
  return ug.call(this,dt)}}

/* ---------- takedown animations: wind-up first, slower, catch impact, layers ---------- */
{const STAND_A={free:1,y:.92,lean:.08,head:.06,ll_h:.3,ll_k:.3,rl_h:-.24,rl_k:.34,la_s:.95,la_e:1.75,ra_s:.55,ra_e:2.35,x:0},STAND_D={free:1,y:.9,lean:.12,head:.08,ll_h:.3,ll_k:.35,rl_h:-.3,rl_k:.4,la_s:1.0,la_e:1.8,ra_s:.9,ra_e:1.9,x:.62};
  for(const kind of['single','double']){const T=TDA[kind];if(T._v2)continue;T._v2=1;const mt=t=>t>=1?1:.24+.76*t;
    T.A=[[0,STAND_A],[.08,Object.assign({},STAND_A,{y:.96,lean:-.05,head:.14,la_s:1.1,la_e:1.4,ra_s:.7,ra_e:1.9,ll_k:.42,rl_k:.5})],[.17,Object.assign({},STAND_A,{y:.88,lean:.22,head:0,ll_h:.55,ll_k:.75,rl_h:-.4,rl_k:.7,la_s:.95,la_e:1.5,ra_s:.7,ra_e:1.8,x:.03})]].concat(T.A.map(([t,p])=>[mt(t),p]));
    T.D=[[0,STAND_D],[.1,Object.assign({},STAND_D,{y:.92,lean:.05,head:.12,la_s:1.15,la_e:1.5})],[.18,Object.assign({},STAND_D,{y:.9,lean:.2,ll_k:.4,rl_k:.45})]].concat(T.D.map(([t,p])=>[mt(t),p]));
    T.imp=mt(T.imp);T.dur=2.6;T.cat=mt(kind==='single'?.2:.22)+.015}
  TDA.slam&&(TDA.slam.dur=2.3);
  const ut=Match.prototype.updTdAnim;Match.prototype.updTdAnim=function(dt){const g=this.g;const A=TDA[g.kind],f=g.att,o=g.def;const r=ut.call(this,dt);if(this.g!==g){f._zt=0;o._zt=0;g.layers=null;return r}
    const t=clamp(g.t,0,1);f._zt=.55*Math.sin(Math.PI*clamp(t/.85,0,1));o._zt=-.3*Math.sin(Math.PI*clamp(t/.85,0,1));
    g.layers=[[o,['farArm','farLeg','torso','nearLeg','shorts','head']],[f,['farLeg','torso','nearLeg','shorts','head']],[f,['farArm','nearArm']],[o,['nearArm']]];
    /* the catch: the attacker's arms wrap the leg(s) — shoulders and the defender's torso recoil, the camera is jolted */
    if(!g.caught&&A.cat&&g.t>=A.cat&&(g.kind==='single'||g.kind==='double')){g.caught=1;SFXI.play('block',.9);this.stage.shake=Math.max(this.stage.shake||0,.12);this.stage.cam.zoom=Math.max(this.stage.cam.zoom||0,.08);this.hitstop=.06;
      try{JointPhys.kick(o,'lean',-4);JointPhys.kick(o,'chest',-2.2);JointPhys.kick(o,'head',3);JointPhys.kick(f,'chest',2.4);JointPhys.kick(f,'lean',1.6)}catch(e){}this.stage.impact(o.body.J.hip.x,.5,1.1)}
    return r}}

/* ---------- 3. the downed fighter: authored fall, lying with his guard up ---------- */
const LIE=[[0,{free:1,y:.86,lean:-.25,head:.2,ll_k:.5,rl_k:.6,ll_h:.15,la_s:1.9,la_e:1.3,ra_s:1.6,ra_e:1.6}],
  [.22,{free:1,y:.6,lean:-.5,rot:-.45,head:.25,ll_h:.9,ll_k:1.5,rl_h:.4,rl_k:1.3,la_s:1.9,la_e:1.5,ra_s:1.7,ra_e:1.8}],
  [.5,{free:1,y:.3,lean:-.1,rot:-1.2,head:.3,ll_h:1.3,ll_k:1.8,rl_h:.8,rl_k:1.6,la_s:2.0,la_e:1.9,ra_s:1.8,ra_e:2.1}],
  [.78,{free:1,y:.13,lean:.05,rot:-1.58,head:.32,chest:.1,ll_h:1.55,ll_k:1.95,ll_a:.4,rl_h:1.0,rl_k:1.75,rl_a:.4,la_s:2.15,la_e:2.0,ra_s:1.95,ra_e:2.25}]];
{const kn=Match.prototype.knock;Match.prototype.knock=function(def,att,ko,kind){const had=!!def.down;const r=kn.apply(this,arguments);
  if(!had&&def.down&&!ko&&def.body.rag){def.body.rag=null;def.body.ko=false;def.down.fall={t:0,x0:def.x,dir:att.d};def.down.fwd=false;def.gRate=16;def.act=null}return r}}
{const ud=Match.prototype.updDown;Match.prototype.updDown=function(f,dt){const r=ud.call(this,f,dt);const D=f.down;if(!D||D.ko||!D.fall||f.body.rag)return r;
  D.fall.t+=dt;const t=D.fall.t;f.state==='down'&&(f.x+=D.fall.dir*dt*Math.max(0,.9-t*1.4)*.8);
  if(f.act)return r;const p=keyPose(LIE,Math.min(t,.9));const br=Math.sin(D.t*3.1)*(.025+.05*(1-ST(f)));p.chest+=br;p.head+=br*.6;p.ll_k+=br*2;
  const g=this.g;if(g&&g.type==='gentry'&&g.def===f){const w=Math.sin(g.t*7.5);p.ll_h=1.7+w*.35;p.rl_h=.9-w*.3;p.ll_k=1.3+w*.3;p.rl_k=1.4-w*.3;p.la_s=2.3;p.ra_s=2.1}/* kicking him off */
  if(g&&g.type==='pounce'&&g.def===f){const u=clamp(g.t/.64,0,1);p.ll_h=1.5+.6*u;p.rl_h=1.0-.5*u;p.ll_k=1.9-.5*u;p.rl_k=1.7-.4*u}/* the legs open as he steps in */
  f.gpose=p;f.gRate=14;return r}}

/* ---------- guard entry: the takedown button on a downed fighter starts a red / blue gauge; fill it and he steps between the legs ---------- */
{const pn=Match.prototype.pounce;Match.prototype.pounce=function(f,force){const o=f.opp;if(!o.down||o.down.ko||this.g)return;
  if(!force){if(!o.down.fall){return pn.call(this,f)}/* not a controlled fall: the old path */
    this.g={type:'gentry',att:f,def:o,t:0,p:.45+(ATT(f,'takedown')-ATT(o,'bottom'))*.2};f.state='sprawl';f.act=null;f.queue=[];f.guard=null;f.gRate=14;o.down.getup=Math.max(o.down.getup,o.down.t+6);
    this.ev(`${f.name} 쓰러진 ${o.name}의 다리 사이로 파고듭니다!`);return}
  pn.call(this,f);const g=this.g;if(g&&g.type==='pounce'&&!o.down.fwd){const hx=o.body.J.hip?o.body.J.hip.x:o.x,lim=this.stage.R-1;g.pos='guard';g.ax=clamp(hx-g.d*GPOS.guard.bx,-lim,lim)}}}
Match.prototype.mashEntry=function(f){const g=this.g;if(!g||g.type!=='gentry')return;const k=.5+.6*ST(f);
  if(f===g.att)g.p+=(.045+ATT(f,'takedown')*.03)*k;else g.p-=(.05+ATT(f,'bottom')*.03)*k;spend(f,.006+rnd()*.006)};
Match.prototype.updEntry=function(dt){const g=this.g,f=g.att,o=g.def;g.t+=dt;if(!o.down){this.g=null;f.state='stand';return}
  const hx=o.body.J.hip?o.body.J.hip.x:o.x,d=Math.sign(hx-f.x)||f.d||1;f.d=d;const tgt=hx-d*(1.0-.25*clamp(g.p,0,1));f.x+=(tgt-f.x)*Math.min(1,dt*3);
  g.p+=dt*((ATT(f,'takedown')-ATT(o,'bottom'))*.04-.02);
  for(const x of[f,o])if(x.ai&&rnd()<dt*(2.5+(x===f?ATT(f,'takedown'):ATT(o,'bottom'))*4)*x.ai.diff*(.6+.4*ST(x)))this.mashEntry(x);
  const sw=Math.sin(g.t*4);const p=mk({y:.6-.04*g.p,lean:.8+.15*g.p+sw*.03,head:-.15,ll_h:.8,ll_k:1.35,ll_a:.2,rl_h:-.55,rl_k:1.05,rl_a:.7,la_s:1.3+sw*.1,la_e:.6,ra_s:1.15,ra_e:.7,x:0});f.gpose=p;f._zt=.3;
  const w=clamp(g.p,0,1);if(w>=1){this.g=null;f.state='stand';this.pounce(f,true);return}
  if(w<=0||g.t>6){this.g=null;f.state='stand';o.down.getup=o.down.t+.2;f.react.x-=f.d*.5;this.stage.shake=.05;SFXI.play('block',.7);this.ev(`🛡️ ${o.name} 발로 밀어내며 일어납니다!`)}};

/* ---------- 4. position changes: a ring game with strain and breathing ---------- */
Match.prototype.trans=function(f,dir){const g=this.g;if(!g||g.type!=='ground'||g.tr2||g.sub||g.trans)return;const role=f===g.top?'top':'bot';const to=(GTR[role][g.pos]||{})[dir==='fwd'?'right':dir==='back'?'left':dir];
  if(!to)return;if(role==='bot'&&to==='getup'&&g.pos==='mount')return;if(EMPTY(f))return;g.tr2={f,to,dir,t:0,p:0,q:0,gr:0,role};spend(f,.012);g.idle=0;const o=f.opp;if(o.ai&&o.ai.onOppTrans)o.ai.onOppTrans(dir);popText(this,f,'끙…','r')};
Match.prototype.mashTrans=function(f){const g=this.g;if(!g||!g.tr2)return;const tr=g.tr2;const k=.45+.65*ST(f);if(EMPTY(f))return;
  if(f===tr.f){tr.p+=(.05+ATT(f,tr.role==='top'?'topCtl':'bottom')*.035)*k}else{tr.q+=(.055+ATT(f,tr.role==='top'?'bottom':'topCtl')*.035)*k}spend(f,.006+rnd()*.006)};
{const ug=Match.prototype.updGround;Match.prototype.updGround=function(dt){const g=this.g;
  if(g&&g.tr2&&!g.sub){const tr=g.tr2,f=tr.f,o=f.opp;tr.t+=dt;
    tr.p+=dt*(.02+ATT(f,tr.role==='top'?'topCtl':'bottom')*.025);tr.q+=dt*(.03+ATT(o,tr.role==='top'?'bottom':'topCtl')*.025);
    for(const x of[f,o]){spend(x,dt*.005);if(x.ai&&rnd()<dt*(2.2+ATT(x,x===f?(tr.role==='top'?'topCtl':'bottom'):(tr.role==='top'?'bottom':'topCtl'))*4.2)*x.ai.diff)this.mashTrans(x)}
    tr.gr-=dt;if(tr.gr<=0){tr.gr=.7+rnd()*.7;popText(this,rnd()<.6?f:o,['끙…','으읏','후우…','흡'][Math.floor(rnd()*4)],rnd()<.5?'':'b');SFXI.play('roar',.12)}
    g.idle=0;if(tr.p>1)tr.p=1;if(tr.q>1)tr.q=1;
    if(tr.p>=1&&tr.p>=tr.q){g.tr2=null;this.applyTrans(f,tr.to)}
    else if(tr.q>=1){g.tr2=null;spend(f,.05);if(tr.to==='getup')g.gu=(g.gu||0)+.1;this.ev(`🛡️ ${o.name} 전환 차단`)}
    else if(EMPTY(f)||tr.t>7){g.tr2=null;this.ev(`${f.name}의 전환 실패`)}
    if(this.g!==g)return}
  return ug.call(this,dt)}}
/* the ground pose: breathing for both, effort for the movers, depth lane */
{const sg=Match.prototype.setGPose;Match.prototype.setGPose=function(){const r=sg.apply(this,arguments);const g=this.g;if(!g||g.type!=='ground'||g.sub)return r;const t=g.t||0;
  for(const f of[g.top,g.bot]){const P=f.gpose;if(!P)continue;const ph=f===g.top?0:1.7;const fat=1-ST(f);const br=Math.sin(t*(2.6+fat*1.6)+ph)*(.02+.035*fat);P.chest=(P.chest||0)+br;P.head=(P.head||0)-br*.7;P.la_s+=br*1.2;P.ra_s+=br*1.2}
  const tr=g.tr2;if(tr){const m=tr.f,o=m.opp,pm=m.gpose,po=o.gpose;if(pm&&po){const w=clamp(tr.p,0,1),v=clamp(tr.q,0,1);
    const wob=(P,k,ph)=>{P.lean+=Math.sin(t*5.2+ph)*.035*k;P.head+=Math.sin(t*4.1+ph)*.05*k;P.ll_h+=Math.sin(t*6.3+ph)*.16*k;P.rl_h+=Math.sin(t*6.3+ph+2.2)*.16*k;P.ll_k+=Math.abs(Math.sin(t*3.1+ph))*.18*k;P.la_s+=Math.sin(t*7+ph)*.08*k;P.ra_s+=Math.sin(t*7+ph+1)*.08*k};
    wob(pm,.5+w,0);wob(po,.5+v,1.9);
    const sgn=tr.dir==='up'?1:tr.dir==='down'?-1:0,lat=tr.dir==='fwd'?1:tr.dir==='back'?-1:0;pm.y=(pm.y||0)+.05*w*sgn;pm.lean-=.1*w*sgn;pm.x=(pm.x||0)+.1*w*lat*(g.d||1)*-1;pm.rot=(pm.rot||0)+.08*w*lat;
    m._zt=.45*w*(sgn>=0?1:-1)*(lat?.5:1);o._zt=-.3*v}}
  return r}}
{const pi=Match.prototype.playerInput;Match.prototype.playerInput=function(dt){const g=this.g;const f=this.f[this.pi];
  if(g&&(g.type==='gentry'||g.type==='ground'&&g.tr2&&!g.sub)&&f){const I=this.inp;const ev=I.poll();f.guard=null;f.mvIn=0;f.circ=0;f.stick=0;if(I.setMode)I.setMode(g.type==='gentry'?'td':'ground');
    for(const e of ev){if(e==='pause'){this.pause();continue}if(this.phase!=='fight')continue;if(g.type==='gentry')this.mashEntry(f);else this.mashTrans(f)}return}
  const r=pi.call(this,dt);
  /* ground: holding the stick in a direction starts that position change */
  const g2=this.g;if(g2&&g2.type==='ground'&&!g2.sub&&!g2.tr2&&f&&f.state==='ground'){const I=this.inp;const fwd=I.mx*f.d;const dir=I.my>.55?'up':I.my<-.55?'down':fwd>.55?'fwd':fwd<-.55?'back':null;
    if(dir&&dir===f._stkDir){f._stkT=(f._stkT||0)+dt;if(f._stkT>.28){f._stkT=0;this.trans(f,dir)}}else{f._stkDir=dir;f._stkT=0}}
  return r}}

/* ---------- 5. submissions ---------- */
/* gauge tuning: success is hard — the hold always bleeds away unless the attacker out-clicks and out-lasts the defender */
window.SUBK={a0:.025,a1:.013,d0:.024,d1:.013,skill:.045,sta:.07,drift:.03};
const SUBS2={guard:{bot:['암바','트라이앵글 초크'],top:[]},mount:{top:['암 트라이앵글 초크'],bot:['트라이앵글 초크']},side:{top:['암 트라이앵글 초크'],bot:[]},back:{top:['리어 네이키드 초크'],bot:[]},half:{top:[],bot:[]},guil:{top:['길로틴 초크'],bot:[]}};
GPOS.guil={n:'길로틴',t:{free:1,y:.84,lean:-.1},b:{free:1,y:.74,lean:1.2},bx:.34,same:false};
function availSubs(g,f){const role=f===g.top?'top':'bot';const out=((SUBS2[g.pos]||{})[role]||[]).slice();const tr=g.tr2;
  if(role==='bot'&&tr&&!out.includes('트라이앵글 초크')){const o=f.opp;/* the top man is mid-move into side / mount with his posture high, or the bottom man is trying to get his legs in */
    if(tr.f===o&&(tr.to==='side'||tr.to==='mount'))out.push('트라이앵글 초크');else if(tr.f===f&&(tr.to==='guard'||tr.to==='half'||tr.to==='sweep'||tr.to==='escape'))out.push('트라이앵글 초크')}
  return out}
Match.prototype.trySub=function(f){const g=this.g;if(!g||g.type!=='ground'||g.sub)return false;const list=availSubs(g,f);if(!list.length)return false;
  if(g.tr2&&!(f===g.top?false:list.includes('트라이앵글 초크')))return false;
  let name=list[0];if(list.length>1){const up=this.pi!=null&&f===this.f[this.pi]&&this.inp&&this.inp.my>.5;name=f.ai||up?(rnd()<.5?list[1]:list[0]):list[0];if(this.pi!=null&&f===this.f[this.pi]&&this.inp)name=this.inp.my>.5?list[1]:list[0]}
  const o=f.opp;const pe=clamp(.5+(ATT(f,'subOff')-ATT(o,'subDef'))*.5+(o.sta<25?.1:0)-(f.sta<25?.12:0),.2,.78);g.idle=0;f.st.sub++;this.rs[f.side].sub++;
  if(rnd()>pe){spend(f,.06);f.cdT=this.t2()+1.2;popText(this,o,'방어!','b');this.ev(`${f.name} ${name} 시도 — ${o.name}이(가) 막아냅니다`);return false}
  g.tr2=null;g.sub={att:f,def:o,name,p:.18,t:0,pt:0};spend(f,.03);this.ev(`🔒 ${f.name} ${name} 시도!`);SFXI.play('sub');this.subUI(1);return true};
Match.prototype.startGuillotine=function(att,def){if(this.g&&this.g.type!=='sprawl'&&this.g.type!=='clinch')return;if(att.state==='ground'||def.state==='down')return;
  const pe=clamp(.45+(ATT(att,'subOff')-ATT(def,'subDef'))*.5-(att.sta<25?.12:0),.18,.72);const ax=clamp((att.x+def.x)/2,-(this.stage.R-1),this.stage.R-1);att.st.sub++;this.rs[att.side].sub++;
  if(rnd()>pe){spend(att,.05);popText(this,def,'빠져나옴!','b');this.ev(`${att.name} 길로틴 시도 — ${def.name} 머리를 빼냅니다`);if(this.g&&this.g.type==='sprawl')this.g.t=Math.max(this.g.t,.9);return}
  att.d=Math.sign(def.x-att.x)||att.d||1;this.g=null;this.startGround(att,def,'guil',ax);const g=this.g;g.d=att.d;g.sub={att,def,name:'길로틴 초크',p:.2,t:0,pt:0};spend(att,.03);this.ev(`🔒 ${att.name} 길로틴 초크!`);SFXI.play('sub');this.subUI(1)};
Match.prototype.breakGuil=function(msg){const g=this.g;if(!g||g.pos!=='guil')return;const a=g.sub?g.sub.att:g.top,b=a.opp;this.g=null;this.subUI(0);for(const f of this.f){f.state='stand';f.gpose=null;f.act=null;f.queue=[];f.guard=null;f.cur=poseCopy(BASE_POSE)}
  const m=(a.x+b.x)/2;a.x=m-.55*(a.d||1);b.x=m+.55*(a.d||1);a.d=Math.sign(b.x-a.x)||1;b.d=-a.d;b.react.x+=a.d*.2;if(msg)this.ev(msg)};
Match.prototype.subPress=function(f){const s=this.g&&this.g.sub;if(!s)return;if(EMPTY(f))return;const k=.5+.7*ST(f);
  const K=window.SUBK;if(f===s.att)s.p+=(K.a0+ATT(f,'subOff')*K.a1)*k;else s.p-=(K.d0+ATT(f,'subDef')*K.d1)*k;spend(f,.01+rnd()*.01);if(rnd()<.18)popText(this,f,f===s.att?'꾸욱':'버텨!',f===s.att?'r':'b')};
Match.prototype.subTick=function(dt){const g=this.g,s=g.sub;s.t+=dt;const A=s.att,D=s.def;
  const K=window.SUBK;s.p+=dt*((ATT(A,'subOff')-ATT(D,'subDef'))*K.skill+(ST(A)-ST(D))*K.sta-K.drift);/* success is hard: the hold always bleeds away */
  spend(A,dt*.003);spend(D,dt*.003);
  for(const f of[A,D])if(f.ai)f.ai.subAI(dt,s);
  const end=(tap,msg)=>{this.subUI(0);if(g.pos==='guil'){if(tap){this.ev(`🏳️ ${D.name} 탭! ${s.name}`);g.sub=null;this.finish(A,'SUB',s.name,1.4)}else this.breakGuil(msg)}else if(tap){this.ev(`🏳️ ${D.name} 탭! ${s.name}`);this.finish(A,'SUB',s.name,1.4)}else{this.ev(msg);g.sub=null}};
  if(EMPTY(D)){end(true);return}/* nothing left to defend with */
  if(EMPTY(A)){end(false,`${A.name} 힘이 빠져 ${s.name} 실패`);return}
  if(s.p>=1)end(true);else if(s.p<=0||s.t>14){spend(A,.06);end(false,`${D.name} ${s.name} 탈출!`)}};

/* the clinch and sprawl hooks for the guillotine are in the input; the guard of a pose after a failed sub is a plain stand-up */
})();
