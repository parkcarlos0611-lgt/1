/* ===== Combat3.js : 3D arcs, ground evade, guard pierce motion, per-part recovery and debuffs =====
   • Arc motion: hooks, overhand, uppercuts, elbows and all round kicks travel on an arc seen from above. From the side
     view that arc is a depth coordinate z: the glove / foot swings out toward (or away from) the camera and sweeps back
     across the centre line at the moment of impact (it grows, drops a little on screen and shrinks as it comes in).
   • Pound evade: the evade key while being pounded slips the head left or right.
   • Guard pierce (the 20 % roll in Match.onHit): a dedicated stagger for the defender and a follow-through for the attacker.
   • Head / body / leg damage recovers slowly, but never more than 40 % of the damage each hit did.
   • Body ≤ 50 %: weaker guard, longer evade cooldown. Body 0: lower guard, tiny guard stamina, one evade charge, longer cooldown.
   • Legs ≤ 50 %: slower, limping. Legs 0: crawling speed, no kicks with the injured leg, random falls while moving. */
(function(){
if(typeof F2==='undefined'||typeof Match==='undefined')return;
const clamp=(v,a,b)=>v<a?a:v>b?b:v,ss=u=>{u=clamp(u,0,1);return u*u*(3-2*u)};
const now=M=>M.t2?M.t2():performance.now()/1000;

/* ---------- 1. arcs (amplitude in body heights; leg kicks swing wider) ---------- */
const ARC={jab:.03,cross:.04,bjab:.03,bcross:.04,lhook:.22,rhook:.22,blhook:.19,brhook:.19,lupp:.09,rupp:.09,ovh:.26,sbf:.07,elbow:.15,lstr:.05,
  rlk:.27,llk:.22,rbk:.3,lbk:.25,rhk:.3,lhk:.27,calf:.25,knee:.11,kneeH:.11,teep:.05};
const HAND_J={S:0,E:.5,W:.85,G:1},LEG_J={H:0,K:.55,A:.9,He:1,T:1};
function arcZ(f){const a=f.act;if(!a||!a.c||!a.c.hit||f.state!=='stand'||f.body.rag)return null;const A=ARC[a.key];if(!A)return null;const h=a.c.hit,H=f.body.H,t=a.t;
  const tm=(h.t0+h.t1)/2;let s;if(t<tm)s=Math.cos(clamp(t/tm,0,1)*Math.PI/2)*ss(t/(h.t0*.55));else s=-.22*Math.sin(clamp((t-tm)/(h.t1+.1-tm),0,1)*Math.PI);
  const nearLead=(f.d>0)===(f.stance>0);const side=a.c.hand?((a.c.hand==='l')===nearLead?1:-1):((a.c.leg==='l')===nearLead?1:-1);const z=s*A*H*side;if(Math.abs(z)<.002)return null;
  const m={};if(a.c.hand){const p=a.c.hand;for(const k in HAND_J)m[p+k]=z*HAND_J[k]}else if(a.c.leg){const p=a.c.leg;for(const k in LEG_J)m[p+k]=z*LEG_J[k];m[p+'Sn']=z*.75}return m}
/* the trunk turns about the vertical axis: near shoulder / hip swing toward the camera, far ones away (hips lead the opposite way) */
function twistZ(f,m){const tw=f.cur&&f.cur.tw||0;if(Math.abs(tw)<.01)return m;const H=f.body.H,c=.11*H*Math.sin(tw*1.4),nearLead=(f.d>0)===(f.stance>0);const np=nearLead?'l':'r',fp=nearLead?'r':'l';m=m||{};
  const add=(pre,sgn,list)=>{for(const[k,w]of list)m[pre+k]=(m[pre+k]||0)+sgn*c*w};
  add(np,1,[['S',1],['E',.9],['W',.8],['G',.75],['H',-.5],['K',-.4],['A',-.3]]);add(fp,-1,[['S',1],['E',.9],['W',.8],['G',.75],['H',-.5],['K',-.4],['A',-.3]]);return m}
{const po=F2.prototype.pose;F2.prototype.pose=function(dt,M){this.body._zmap=twistZ(this,arcZ(this));return po.call(this,dt,M)}}

/* ---------- 2. kick balance (leg / body kicks hit harder) ---------- */
if(typeof MV!=='undefined')for(const k of['rlk','llk','rbk','lbk','calf']){const c=MV[k];if(c&&c.hit)c.hit.dmg*=1.3}

/* ---------- 3. part damage: recovery pools, debuff levels ---------- */
const lvlOf=hp=>hp<=0.5?2:hp<=50?1:0;
F2.prototype.bodyLvl=function(){return lvlOf(this.hp.body)};F2.prototype.legLvl=function(){return lvlOf(this.hp.legs)};
F2.prototype.hurtLeg=function(){const d=this._legD||{l:0,r:0};return d.l>=d.r?'l':'r'};
{const ad=Match.prototype.applyDmg;Match.prototype.applyDmg=function(att,def,o){
  /* a pound that the defender slipped */
  if(o&&def.gev&&def.gev.t<def.gev.dur*.8&&att.act&&(att.act.key==='gp'||att.act.key==='ge')&&Math.random()<.85){SFXI.play('whiff',.7);this.stage.burst&&def.body.J.hd&&this.stage.burst(def.body.J.hd.x,def.body.J.hd.y,att.d,2,'sweat',.5);return}
  const b={head:def.hp.head,body:def.hp.body,legs:def.hp.legs};const r=ad.call(this,att,def,o);
  const pool=def._pool||(def._pool={head:0,body:0,legs:0});
  for(const z of['head','body','legs']){const d=b[z]-def.hp[z];if(d>0)pool[z]+=d*.4}/* at most 40 % of each hit's damage can come back */
  if(o&&o.zone==='leg'){const D=def._legD||(def._legD={l:0,r:0});D[Math.random()<.65?'l':'r']+=o.dmg||1}
  return r}}
const REGEN={head:.22,body:.32,legs:.32};/* hp per second */
{const up=F2.prototype.update;F2.prototype.update=function(dt,M){const r=up.call(this,dt,M);if(!M||M.phase!=='fight'||this.body.rag)return r;
  const ph=this.hp;
  /* recovery */
  const pool=this._pool;if(pool&&!this.down){for(const z of['head','body','legs']){if(pool[z]>0&&ph[z]<100){const k=Math.min(REGEN[z]*dt,pool[z],100-ph[z]);ph[z]+=k;pool[z]-=k}}}
  if(this.pierceT>0)this.pierceT=Math.max(0,this.pierceT-dt);if(this.pierceFx>0)this.pierceFx=Math.max(0,this.pierceFx-dt);
  if(this.gev){this.gev.t+=dt;if(this.gev.t>=this.gev.dur)this.gev=null}
  /* body debuffs */
  const bl=this.bodyLvl();if(this._gM0!=null){this.gMax=this._gM0*.5*(this.tactic==='in'?1.7:1)*(bl===2?.4:bl===1?.8:1);if(this.gst>this.gMax)this.gst=this.gMax}
  if(this.evCh){const t=now(M);if(bl===2){if(this.evCh[1]<t+999)this.evCh[1]=t+9999}else if(this.evCh[1]>t+5000)this.evCh[1]=t+4.5}
  /* leg 0: random falls while moving */
  if(this.legLvl()===2&&this.state==='stand'&&!this.act&&!this.down&&Math.abs(this.mvIn||0)>.2){this._fallT=(this._fallT||0)-dt;if(this._fallT<=0){this._fallT=.5;if(Math.random()<.12&&(!this._fallCd||now(M)>this._fallCd)){this._fallCd=now(M)+5;M.ev(`${this.name} 다리가 풀려 쓰러집니다!`);M.knock(this,this.opp,false,'leg')}}}
  return r}}
{const ev=Match.prototype.evade;Match.prototype.evade=function(f){const t=now(this);const before=f.evCh?f.evCh.slice():null;const ok=ev.call(this,f);if(ok&&f.evCh){const bl=f.bodyLvl();const k=bl===2?1.9:bl===1?1.35:1;if(k>1){for(let i=0;i<f.evCh.length;i++)if(!before||f.evCh[i]!==before[i])f.evCh[i]=t+4.5*k}}return ok}}
{const sp=F2.prototype.spd;F2.prototype.spd=function(){const l=this.legLvl();return sp.call(this)*(l===2?.45:l===1?.85:1)}}
{const st=F2.prototype.strike;F2.prototype.strike=function(key,M){const c=MV[key];if(c&&c.leg&&this.legLvl()===2&&c.leg===this.hurtLeg())return false;return st.call(this,key,M)}}

/* ---------- 4. limp, lowered guard, guard-pierce motion, pound evade (pose layer) ---------- */
{const fw=F2.prototype.footwork;F2.prototype.footwork=function(p,dt){fw.call(this,p,dt);if(this.body.rag)return;
  const ll=this.legLvl(),bl=this.bodyLvl(),H=this.body.H;
  if(ll>0&&this.state==='stand'&&!this.act){const inj=this.hurtLeg()==='l'?'ll':'rl';const mv=Math.abs(this.mvIn||0)>.15;const ph=Math.sin((this.t||0)*(mv?7:2));
    p[inj+'_k']+=.12*ll+(mv?.1*(ph*.5+.5):0);p.lean+=.03*ll;p.y=(p.y||0)-(mv?.012*H*(ph*.5+.5)*ll:0);p.head+=.03*ll*ph;if(mv)p[inj+'_h']-=.12*ll*(ph*.5+.5)}
  if(bl===2&&!this.act&&this.state==='stand'){p.la_s-=.28;p.ra_s-=.22;p.la_e+=.25;p.ra_e+=.2;p.lean+=.05;p.ll_k+=.06;p.rl_k+=.06}
  if(this.pierceT>0){const u=this.pierceT/.6,k=Math.sin(Math.PI*clamp(1-u,0,1))*1.0+u*.6;/* arms flung open, head snapped back, knees buckle */
    p.la_s-=.95*k;p.ra_s-=.8*k;p.la_e=Math.max(.2,p.la_e-1.2*k);p.ra_e=Math.max(.2,p.ra_e-1.4*k);p.head-=.28*k;p.lean-=.2*k;p.chest-=.1*k;p.ll_k+=.28*k;p.rl_k+=.3*k;p.tw+=.12*k}
  if(this.pierceFx>0){const u=this.pierceFx/.4;p.lean+=.12*Math.sin(Math.PI*(1-u));p.tw+=.08*Math.sin(Math.PI*(1-u))}}}
{const tp=F2.prototype.targetPose;F2.prototype.targetPose=function(M){const b=tp.call(this,M);if(this.gev&&this.gpose&&b===this.gpose){const g=this.gev,u=clamp(g.t/g.dur,0,1),s=Math.sin(Math.PI*u);const q=Object.assign({},b);
    q.x=(q.x||0)+g.dir*.16*s;q.head=(q.head||0)+g.dir*(this.d||1)*.45*s;q.rot=(q.rot||0)+g.dir*(this.d||1)*.18*s;q.chest=(q.chest||0)+g.dir*(this.d||1)*.12*s;return q}return b}}
Match.prototype.gEvade=function(f,dir){const g=this.g;if(!g||g.type!=='ground'||f.gev||g.sub||g.trans||this.phase!=='fight')return false;const t=now(this);f.evCh=f.evCh||[0,0];const i=f.evCh.findIndex(x=>x<=t);if(i<0)return false;
  const bl=f.bodyLvl();f.evCh[i]=t+4.5*(bl===2?1.9:bl===1?1.35:1);f.gev={t:0,dur:.45,dir:dir||(Math.random()<.5?1:-1)};SFXI.play('whiff',.6);return true};
{const pi=Match.prototype.playerInput;Match.prototype.playerInput=function(dt){const f=this.f[this.pi],I=this.inp;const r=pi.call(this,dt);
  if(f&&I&&I.evReq&&this.phase==='fight'&&this.g&&this.g.type==='ground'&&f.state==='ground'){I.evReq=0;const mx=I.mx!=null?I.mx:(I.tmx||0);this.gEvade(f,mx>.2?1:mx<-.2?-1:0)}return r}}
/* AI: a pounded defender slips now and then */
{const up=F2.prototype.update;F2.prototype.update=function(dt,M){if(M&&this.ai&&M.g&&M.g.type==='ground'&&this.state==='ground'&&M.g.bot===this&&!this.gev){const o=this.opp;if(o.act&&(o.act.key==='gp'||o.act.key==='ge')&&o.act.t<.12&&Math.random()<dt*3*(.3+(this.ai.diff||.5)))M.gEvade(this,0)}return up.call(this,dt,M)}}
})();
