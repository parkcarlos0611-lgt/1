/* ===== GroundMotion.js : pounce, ground-and-pound, submissions, knockdown pacing, referee positioning =====
   • Knockdowns are rarer (higher concussion thresholds, fewer body / leg knockdowns, fewer flash KOs).
   • KO / TKO: slow motion lasts longer and the fall plays out longer before the result scene.
   • Pounce: when a fighter jumps on a downed opponent he runs in low, reaches, and drops into the top
     position over ~0.6 s (no teleport).
   • Ground-and-pound: the striking arm is solved with IK every frame toward the opponent's actual head —
     cock back, drive down through the face (the body leans / shifts in when the head is out of reach),
     hold, retract. Damage lands on the contact frame, the head snaps, the opponent covers up when guarding.
   • Submissions: each hold has its own two-body arrangement and limb IK, so it reads at a glance:
       rear-naked / body-triangle choke — seated behind, arm across the throat, other hand behind the head,
         hooks in; defender pulls at the choking arm, head forced back;
       armbar — attacker on his back, legs over chest and face, the opponent's arm straight to his chest;
       triangle — attacker on his back, legs locked around head and arm, pulling the head down;
       kimura / americana — top pressure, opponent's arm bent behind the back / beside the head, attacker
         gripping wrist and elbow;
       arm-triangle / d'arce / guillotine — chest on the opponent's head, arms locked around neck and arm.
   • Referee: stands off at a distance, jogs in when a fighter is rocked or down and watches up close. */
(function(){
if(typeof Match==='undefined')return;
const V2={lerp:(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t})};
const sm=u=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u)};

/* ---------- knockdown pacing ---------- */
if(typeof KO!=='undefined'){KO.rockAt=.72;KO.kdAt=1.25;KO.koAt=1.85;KO.koOnKd.over=.6;KO.flash.max=.28;KO.flash.base=11}
{const ad=Match.prototype.knock;Match.prototype.knock=function(def,att,ko,kind){
    /* body / leg knockdowns (from the engine's body & leg branches) happen about half as often */
    if(!ko&&(kind==='body'||kind==='leg')&&Math.random()<.5)return;return ad.call(this,def,att,ko,kind)}}

/* ---------- KO / TKO: longer slow motion before the result scene ---------- */
{const fin=Match.prototype.finish;Match.prototype.finish=function(w,method,detail,delay){const r=fin.apply(this,arguments);
    if(/KO/.test(method||'')){this.slow=Math.max(this.slow||0,2.6);if(this.outro&&!this.outro.dec)this.outro.fallT+=1.8}return r}}

/* ---------- limb IK helpers (angles in the engine's pose convention) ---------- */
function legIK(F,P,side,T){const J=F.body.J,Hp=J[side==='ll'?'lH':'rH'];if(!Hp||!T)return;const L=F.body.L,L1=L.thigh,L2=L.shin,d=F.d||1;
  const vx=(T.x-Hp.x)*d,vy=T.y-Hp.y;let D=Math.hypot(vx,vy);D=clamp(D,(L1+L2)*.3,(L1+L2)*.985);const th=Math.atan2(vx,-vy);
  const a=Math.acos(clamp((L1*L1+D*D-L2*L2)/(2*L1*D),-1,1)),b=Math.acos(clamp((L1*L1+L2*L2-D*D)/(2*L1*L2),-1,1));
  P[side+'_h']=th+a+(P.rot||0);P[side+'_k']=Math.PI-b}
window.legIK=legIK;
/* blend an arm toward an IK solution by weight w */
function armTo(F,P,side,T,w){if(w<=0)return;const tmp=Object.assign({},P);armIK(F,tmp,side,T);P[side+'_s']+=(tmp[side+'_s']-P[side+'_s'])*w;P[side+'_e']+=(tmp[side+'_e']-P[side+'_e'])*w;P[side==='la'?'lo':'ro']=tmp[side==='la'?'lo':'ro']}

/* ---------- pounce: run in low, reach, drop into position ---------- */
Match.prototype.pounce=function(f){const o=f.opp;if(!o.down||o.down.ko||this.g)return;const pos=o.down.fwd?'back':'side';const P=GPOS[pos];
  const hx=o.body.J.hip?o.body.J.hip.x:o.x;const d=Math.sign(hx-f.x)||f.d||1;const lim=this.stage.R-1;const ax=clamp(hx-d*P.bx,-lim,lim);
  this.g={type:'pounce',att:f,def:o,t:0,pos,ax,d,x0:f.x,y0:f.body.J.hip?f.body.J.hip.y:.8};f.state='sprawl';f.act=null;f.queue=[];f.guard=null;f.d=d;f.gRate=40;
  this.ev(`${f.name} 쓰러진 상대를 덮칩니다!`)};
const RUN={lean:.62,chest:.12,head:-.25,ll_h:.95,ll_k:1.25,ll_a:.1,rl_h:-.35,rl_k:.9,rl_a:.5,la_s:1.25,la_e:1.0,ra_s:1.05,ra_e:1.2,tw:0};
function updPounce(M,dt){const g=M.g,f=g.att,o=g.def;g.t+=dt;const T=.64,u=g.t/T;const P=GPOS[g.pos];
  if(u<.55){const k=sm(u/.55);f.x=g.x0+(g.ax-g.d*.28-g.x0)*k;const ph=g.t*16;const p=Object.assign({},BASE_POSE,RUN);
    p.ll_h+=Math.sin(ph)*.25;p.rl_h-=Math.sin(ph)*.25;p.lean+=k*.15;p.free=0;p.y=0;f.gpose=p;f.cur=poseCopy(p);f.cur.free=0}
  else{const k=sm((u-.55)/.45);f.x=g.ax-g.d*.28*(1-k);const A=Object.assign({},BASE_POSE,RUN),B=Object.assign({},BASE_POSE,P.t);const p={};
    for(const c of PK){const a=A[c]!=null?A[c]:0,b=B[c]!=null?B[c]:0;p[c]=a+(b-a)*k}p.free=1;p.y=g.y0+((P.t.y||.3)-g.y0)*k;p.rot=(P.t.rot||0)*k;p.x=0;
    /* hands reach for the opponent while dropping */const OJ=o.body.J;if(OJ.mid){armTo(f,p,'la',V2.lerp(OJ.mid,OJ.sh,.6),k);armTo(f,p,'ra',V2.lerp(OJ.hip,OJ.mid,.5),k)}
    f.gpose=p;f.cur=poseCopy(p);f.cur.free=1}
  if(u>=1){o.down=null;M.startGround(f,o,g.pos,g.ax);const G=M.g;if(G){o.cur=poseCopy(o.gpose);o.cur.free=1;f.cur=poseCopy(f.gpose);f.cur.free=1;M.stage.shake=.06;SFXI.play('slam',.5)}
    M.ev(`${f.name} ${GPOS[g.pos].n}`)}}
{const ug=Match.prototype.updGrapple;Match.prototype.updGrapple=function(dt){if(this.g&&this.g.type==='pounce'){updPounce(this,dt);return}return ug.call(this,dt)}}

/* ---------- ground-and-pound ---------- */
const GNP={dur:.4,cock:.08,hit:.15,hold:.05};
Match.prototype.gStrike=function(f,kind,hand){const g=this.g;if(!g||g.type!=='ground'||g.sub||f.act||f.cdT>this.t2())return;const top=f===g.top,o=f.opp;f.cdT=this.t2()+(top?.32:.48);f.lastThrowT=this.t2();
  f.act={key:kind==='elbow'?'ge':'gp',c:{dur:GNP.dur,keys:[[0,{}],[GNP.dur,{}]]},t:0,speed:1,hit:true};f.gAtk={kind,hand:hand==='l'?'la':'ra',t:0,done:0,top};
  f.st.thr++;this.rs[f.side].thr++;f.sta-=top?2:3;g.idle=0};
function gnpLand(M,f,A){const g=M.g,o=f.opp;if(!g||g.type!=='ground'||M.phase!=='fight')return;const top=A.top;const T=o.body.J.hd;
  const blk=o.guard==='high'&&Math.random()<.65+ATT(o,'strDef')*.25;const base=(A.kind==='elbow'?6.5:4.6)*(top?1:.45);const dmg=base*(.6+ATT(f,'punchPow')*.6)*(top&&g.pos==='mount'?1.25:1);
  f.st.land++;if(!blk){f.st.sigL++;M.rs[f.side].sigL++;o.react.hv+=-9*f.d*(o.d||1);o.react.lv+=-3;SFXI.play('hit',.75);M.stage.impact(T.x,T.y,.9,'#fff',f.d);M.stage.shake=.05;M.hitstop=.05;M.stage.burst(T.x,T.y,f.d,4,'sweat',.6)}else{SFXI.play('block',.6);M.stage.impact(T.x,T.y,.5)}
  M.applyDmg(f,o,{zone:'head',dmg:blk?dmg*.2:dmg,kind:A.kind==='elbow'?'elbow':'punch',blocked:blk,cut:A.kind==='elbow'?1.3:1})}
/* overlay the strike on the ground pose: IK toward the head, lean / shift in to reach, land on the contact frame */
function gnpOverlay(M,f,P,dt){const A=f.gAtk;if(!A)return;A.t+=dt;const o=f.opp,J=f.body.J,OJ=o.body.J;if(!OJ.hd||!J.lS){f.gAtk=null;return}
  const S=J[A.hand==='la'?'lS':'rS'];const d=f.d||1;const head={x:OJ.hd.x-d*.035,y:OJ.hd.y+(A.kind==='elbow'?.03:.01)};
  const cockP={x:S.x-d*.1,y:S.y+.24};const t=A.t;let tgt,w,lean=0;
  if(t<GNP.cock){const k=sm(t/GNP.cock);tgt=cockP;w=k;lean=-.12*k}
  else if(t<GNP.hit){const k=Math.pow((t-GNP.cock)/(GNP.hit-GNP.cock),1.6);const thru={x:head.x+(head.x-cockP.x)*.08,y:head.y+(head.y-cockP.y)*.08};tgt=V2.lerp(cockP,thru,k);w=1;lean=-.12+.4*k}
  else if(t<GNP.hit+GNP.hold){tgt=head;w=1;lean=.28}
  else{const k=sm((t-GNP.hit-GNP.hold)/(GNP.dur-GNP.hit-GNP.hold));tgt=V2.lerp(head,cockP,k*.6);w=1-k;lean=.28*(1-k)}
  P.lean=(P.lean||0)+lean;
  /* out of reach? shift the body toward the head (horizontal) for the strike */
  const L=f.body.L,R=(L.uarm+L.farm+L.glove*.8)*.95;const gap=Math.hypot(head.x-S.x,head.y-S.y)-R;if(gap>0&&t>=GNP.cock){const k=Math.min(1,(t-GNP.cock)/(GNP.hit-GNP.cock))*(t<GNP.hit+GNP.hold?1:1-sm((t-GNP.hit-GNP.hold)/(GNP.dur-GNP.hit-GNP.hold)));P.x=(P.x||0)+Math.min(.22,gap)*k*Math.sign((head.x-S.x)*d||1)}
  if(A.kind==='elbow'){/* elbow: forearm folded, the elbow point drives down */P[A.hand+'_e']=2.35;const tmp=Object.assign({},P);armIK(f,tmp,A.hand,{x:tgt.x+d*.05,y:tgt.y+.16});P[A.hand+'_s']+=(tmp[A.hand+'_s']-P[A.hand+'_s'])*w}
  else armTo(f,P,A.hand,tgt,w);
  /* the other hand posts on the opponent's chest */const oh=A.hand==='la'?'ra':'la';armTo(f,P,oh,V2.lerp(OJ.mid,OJ.sh,.55),.8);
  if(!A.done&&t>=GNP.hit){A.done=1;gnpLand(M,f,A)}
  if(t>=GNP.dur)f.gAtk=null}

/* ---------- submissions: per-hold body arrangements ---------- */
function subCat(name){if(/리어 네이키드|바디 트라이앵글/.test(name))return'rnc';if(/암바/.test(name))return'armbar';if(/^트라이앵글/.test(name))return'triangle';if(/기무라/.test(name))return'kimura';if(/아메리카나/.test(name))return'americana';return'headarm'}
function subOverlay(M,dt){const g=M.g,s=g.sub;const A=s.att,D=s.def;const aJ=A.body.J,dJ=D.body.J;if(!aJ.hd||!dJ.hd)return;
  const cat=s.cat||(s.cat=subCat(s.name));const t=g.t;const q=Math.sin(t*18)*.012,str=Math.sin(t*9);const d=g.d||1;const tight=clamp(s.p,0,1);
  const AT=A===g.top,ax=g.ax;let pa,pd,da,dd,xa,xd;
  const mk=(o)=>Object.assign({},BASE_POSE,o,{free:1});
  if(cat==='rnc'){/* seated behind, same facing */da=d;dd=d;xa=ax;xd=ax+d*.46;
    pa=mk({y:.15,rot:0,lean:.32+tight*.1,chest:.08,head:.25,ll_h:1.45,ll_k:1.25,ll_a:.2,rl_h:1.35,rl_k:1.4,rl_a:.2});
    pd=mk({y:.13,rot:0,lean:.02-tight*.1,chest:-.05,head:-.3-tight*.2+str*.06,ll_h:1.45+str*.15,ll_k:.35,rl_h:1.3-str*.15,rl_k:.6});}
  else if(cat==='armbar'){/* attacker on his back beside the defender's shoulder, legs across chest and face */
    {da=d;dd=-d;xa=ax;xd=ax+d*.72;pa=mk({y:.14,rot:-1.35,lean:.08,head:.35,ll_h:2.0,ll_k:1.0,rl_h:1.75,rl_k:1.2});pd=mk({y:.42,rot:0,lean:.6+str*.06,chest:.15,head:.2,ll_h:.4,ll_k:2.1,ll_a:-.3,rl_h:.1,rl_k:2.0,rl_a:-.3})}}
  else if(cat==='triangle'){/* attacker on his back, legs locked around the defender's head and arm */
    if(AT){/* rare: treat as top arm-triangle */}
    da=d;dd=-d;xa=ax;xd=ax+d*.55;pa=mk({y:.11,rot:-1.5,lean:.1,head:.4,ll_h:2.1,ll_k:1.6,rl_h:1.8,rl_k:1.9});pd=mk({y:.4,rot:0,lean:1.1+str*.06,chest:.2,head:.45+tight*.2,ll_h:.4,ll_k:2.1,ll_a:-.3,rl_h:.05,rl_k:2.0,rl_a:-.3})}
  else if(cat==='kimura'||cat==='americana'){/* top pressure from side control / half; bottom kimura from guard */
    if(AT){/* kneeling beside, posture up, cranking the bent arm */da=d;dd=-d;xa=ax-d*.12;xd=ax+d*.1;pa=mk({y:.42,rot:.2,lean:.45+tight*.1,head:-.05,ll_h:.25,ll_k:2.1,ll_a:-.3,rl_h:-.1,rl_k:2.0,rl_a:-.3});pd=mk({y:.1,rot:-1.55,lean:0,head:.3+str*.06,ll_h:1.0+str*.15,ll_k:1.4,rl_h:.4,rl_k:.8})}
    else{da=d;dd=-d;xa=ax;xd=ax+d*.5;pa=mk({y:.2,rot:-.8,lean:.45,head:.2,ll_h:1.6,ll_k:1.5,rl_h:1.2,rl_k:1.8});pd=mk({y:.4,rot:0,lean:.8,chest:.1,head:.2,ll_h:.4,ll_k:2.1,ll_a:-.3,rl_h:.05,rl_k:2.0,rl_a:-.3})}}
  else{/* head-and-arm chokes from the top: chest on the head */
    if(AT){da=d;dd=-d;xd=ax+d*.02;xa=ax-d*.12;pa=mk({y:.3,rot:1.2,lean:.35+tight*.1,head:-.2,ll_h:1.1,ll_k:1.8,ll_a:.2,rl_h:.7,rl_k:1.5,rl_a:.2});pd=mk({y:.1,rot:-1.55,lean:0,head:.15+str*.06,ll_h:.9+str*.2,ll_k:1.4,rl_h:.4,rl_k:.8})}
    else{da=d;dd=-d;xa=ax;xd=ax+d*.45;pa=mk({y:.18,rot:-1.1,lean:.5,head:.3,ll_h:1.8,ll_k:1.6,rl_h:1.5,rl_k:1.8});pd=mk({y:.4,rot:0,lean:1.05,chest:.2,head:.5,ll_h:.4,ll_k:2.1,ll_a:-.3,rl_h:.05,rl_k:2.0,rl_a:-.3})}}
  /* place + face (positions kept on the hold: the base ground pose resets x every frame) */if(s._xa==null){s._xa=A.x;s._xd=D.x}const k=Math.min(1,(dt||0)*7);s._xa+=(xa-s._xa)*k;s._xd+=(xd-s._xd)*k;A.x=s._xa;D.x=s._xd;A.d=da;D.d=dd;
  /* limb IK on top of the arrangement (uses last frame's joints) */
  const nk=dJ.nk,hd=dJ.hd,sh=dJ.sh,mid=dJ.mid;
  const nA=((A.d||1)>0)===((A.stance||1)>0)?'la':'ra',fA=nA==='la'?'ra':'la';/* the near arm does the choking (it is drawn over the neck) */
  if(cat==='rnc'){armIK(A,pa,nA,{x:nk.x+da*.07+q,y:nk.y-.01});armIK(A,pa,fA,{x:hd.x-da*.06,y:hd.y+.04});legIK(A,pa,'ll',{x:dJ.hip.x+da*.12,y:dJ.hip.y-.02});legIK(A,pa,'rl',{x:dJ.hip.x+da*.08,y:dJ.hip.y+.02});
    const cE=aJ[nA==='la'?'lE':'rE'],cW=aJ[nA==='la'?'lW':'rW'];armIK(D,pd,'la',V2.lerp(cE,cW,.5));armIK(D,pd,'ra',{x:cW.x+q,y:cW.y+.02})}
  else if(cat==='armbar'){const ch=V2.lerp(aJ.mid,aJ.sh,.6);armIK(D,pd,'la',ch);armIK(D,pd,'ra',{x:dJ.sh.x-dd*.05,y:Math.max(.05,dJ.sh.y-.12)});
    armIK(A,pa,'la',dJ.lW||ch);armIK(A,pa,'ra',V2.lerp(dJ.lE,dJ.lW,.6));
    legIK(A,pa,'ll',{x:nk.x+dd*.1,y:nk.y+.1});legIK(A,pa,'rl',{x:mid.x-dd*.1,y:mid.y+.06})}/* one leg across the face, one across the chest */
  else if(cat==='triangle'){legIK(A,pa,'ll',{x:nk.x+da*.1,y:nk.y+.1});legIK(A,pa,'rl',V2.lerp(aJ.lK,aJ.lA,.45));armIK(A,pa,'la',hd);armIK(A,pa,'ra',{x:hd.x+da*.04,y:hd.y+.05});
    armIK(D,pd,'la',V2.lerp(aJ.mid,aJ.sh,.4));armIK(D,pd,'ra',{x:aJ.hip.x,y:aJ.hip.y+.05})}
  else if(cat==='kimura'||cat==='americana'){const wrist=cat==='americana'?{x:hd.x+dd*.05,y:.05+tight*.04}:{x:sh.x-dd*.02,y:sh.y+.28+tight*.06};/* americana: wrist pinned by the head; kimura: arm bent up and cranked */
    armIK(D,pd,'la',wrist);armIK(D,pd,'ra',V2.lerp(aJ.sh,aJ.nk,.5));armIK(A,pa,'la',dJ.lW||wrist);armIK(A,pa,'ra',V2.lerp(dJ.lS,dJ.lE,.7))}
  else{armIK(A,pa,'la',{x:nk.x-da*.05+q,y:nk.y-.05});armIK(A,pa,'ra',{x:hd.x+da*.05,y:hd.y+.08});armIK(D,pd,'la',{x:hd.x+dd*.02,y:hd.y+.14});armIK(D,pd,'ra',V2.lerp(aJ.sh,aJ.mid,.4))}
  /* struggle */pd.lean+=Math.sin(t*11)*.04;pd.head+=Math.sin(t*15)*.06;
  A.gpose=pa;D.gpose=pd;A.gRate=D.gRate=14;
  /* the defender goes red as the hold tightens */D.body.redness=Math.max(D.body.redness||0,tight*.6)}

/* hook into the ground pose update */
{const sg=Match.prototype.setGPose;Match.prototype.setGPose=function(){const r=sg.apply(this,arguments);const g=this.g;if(!g||g.type!=='ground')return r;const dt=this._gdt||0;
    if(g.sub){subOverlay(this,dt);return r}
    for(const f of[g.top,g.bot]){if(f.gAtk)gnpOverlay(this,f,f.gpose,dt)}
    /* covering up: the bottom fighter's forearms over the face */
    const b=g.bot,BJ=b.body.J;if(b.guard==='high'&&!b.gAtk&&BJ.hd){armTo(b,b.gpose,'la',{x:BJ.hd.x+(g.top.d||1)*-.06,y:BJ.hd.y+.06},.9);armTo(b,b.gpose,'ra',{x:BJ.hd.x+(g.top.d||1)*-.04,y:BJ.hd.y+.1},.9)}
    return r}}
{const ug=Match.prototype.updGround;Match.prototype.updGround=function(dt){this._gdt=dt;return ug.call(this,dt)}}
/* clear strike state when the ground phase ends */
{const st=Match.prototype.standUp;Match.prototype.standUp=function(){for(const f of this.f)f.gAtk=null;return st.apply(this,arguments)}}

/* ---------- referee: keep a distance, jog in to watch a hurt fighter ---------- */
if(typeof REF!=='undefined'){REF.dist={min:1.55,max:2.35,pad:1.1};REF.speed=.55;REF.rush=1.5;REF.groundDist=1.45}
if(typeof RefereeAI!=='undefined'){const tg=RefereeAI.target;RefereeAI.target=function(M){const[a,b]=M.f;const g=M.g;const lim=M.stage.R-REF.wallMargin;
    if(M.phase==='fight'&&!M.stopping&&!(g&&g.type==='ground')){const hurt=[a,b].find(f=>f.down||f.rock>0);if(hurt){const att=hurt.opp;const hx=hurt.body.J.hip?hurt.body.J.hip.x:hurt.x;let side=Math.sign(hx-att.x)||1;let t=hx+side*1.3;if(Math.abs(t)>lim){t=hx-side*1.3}M.ref.hurtWatch=1;return clamp(t,-lim,lim)}}
    M.ref.hurtWatch=0;return tg.call(this,M)}}
{const ur=Match.prototype.updRef;Match.prototype.updRef=function(dt){if(typeof REF!=='undefined'){const hw=this.ref&&this.ref.hurtWatch;REF.speed=hw?.95:.55}return ur.call(this,dt)}}

/* ---------- hands meet the mat: the arm bends at the shoulder and elbow separately and the open hand
   is planted on the canvas instead of the arm swinging through the floor ---------- */
{const sv=Body.prototype.solve;Body.prototype.solve=function(p,X,d){const J=sv.call(this,p,X,d);if(this.rag||!J.lS)return J;const L=this.L,Lg=L.glove*.8,FLOOR=.035;
  for(const s of['l','r']){const S=J[s+'S'],E=J[s+'E'],W=J[s+'W'],G=J[s+'G'];if(!G||Math.min(G.y,W.y)>=FLOOR)continue;
    /* palm flat on the mat, fingers pointing the way the hand was going */const dir=Math.sign(G.x-W.x)||(d||1);const tw={x:G.x-dir*Lg*.6,y:FLOOR+.012};
    const L1=L.uarm,L2=L.farm;let dx=tw.x-S.x,dy=tw.y-S.y;let D=Math.hypot(dx,dy)||1e-6;const mx=(L1+L2)*.995;if(D>mx){dx*=mx/D;dy*=mx/D;D=mx}const tx=S.x+dx,ty=S.y+dy;
    const ca=clamp((L1*L1+D*D-L2*L2)/(2*L1*D),-1,1),an=Math.acos(ca);const bx=dx/D,by=dy/D;
    const k1={x:S.x+(bx*Math.cos(an)-by*Math.sin(an))*L1,y:S.y+(bx*Math.sin(an)+by*Math.cos(an))*L1},k2={x:S.x+(bx*Math.cos(-an)-by*Math.sin(-an))*L1,y:S.y+(bx*Math.sin(-an)+by*Math.cos(-an))*L1};
    /* keep the elbow on the side it was already bending to (no flip), and above the mat */let el=Math.hypot(k1.x-E.x,k1.y-E.y)<Math.hypot(k2.x-E.x,k2.y-E.y)?k1:k2;if(el.y<FLOOR){const o2=el===k1?k2:k1;if(o2.y>el.y)el=o2}
    J[s+'E']=el;J[s+'W']={x:tx,y:Math.max(FLOOR,ty)};J[s+'G']={x:tx+dir*Lg,y:Math.max(FLOOR*.8,ty-.004)};
    this.ang=this.ang||{};this.ang[s+'o']=1/* open hand: fingers spread on the canvas */}
  return J}}

/* ---------- referee at the result: stays in side view, faces the winner and raises his arm ---------- */
{const ur=Match.prototype.updRef;Match.prototype.updRef=function(dt){if(!this.cer){const r0=ur.call(this,dt);const r=this.ref,P=r.gpose;
      /* side-view referee poses: relaxed and upright while watching, hands on the knees when crouched in close */
      if(P&&!(r.wave>0)&&this.phase==='fight'){const crouch=(this.g&&this.g.type==='ground'||r.hurtWatch)&&Math.abs(r.vx||0)<.35;const RJ=r.body.J;
        if(crouch&&RJ.lK){Object.assign(P,{lean:.5,chest:.12,head:-.3,ll_h:.8,ll_k:1.25,ll_a:.1,rl_h:.4,rl_k:1.15,rl_a:.2});armIK(r,P,'la',{x:RJ.lK.x+(r.d||1)*.03,y:RJ.lK.y+.04});armIK(r,P,'ra',{x:RJ.rK.x+(r.d||1)*.03,y:RJ.rK.y+.04})}
        else Object.assign(P,{lean:.05,chest:.02,head:.04,tw:0,ll_h:.16,ll_k:.12,ll_a:.05,rl_h:-.14,rl_k:.14,rl_a:.1,la_s:.18,la_e:.4,ra_s:.05,ra_e:.45})}
      return r0}const r0=ur.call(this,dt);const r=this.ref,W=this.winner;
    const tgtX=W?(W.x+(W.opp?W.opp.x:0))/2:0;r.mvIn=clamp((tgtX-r.x)*2,-1,1)*.6;r.d=W?(Math.sign(W.x-r.x)||1):1;
    const up=r.raise&&W;r.gpose=poseCopy(Object.assign({},BASE_POSE,{lean:.02,chest:0,head:.02,tw:0,ll_h:.12,ll_k:.06,rl_h:-.1,rl_k:.06,la_s:up?2.75:.25,la_e:up?.25:.35,ra_s:.15,ra_e:.3}));r.gRate=6;
    r.update(dt,{checkHit(){},onMiss(){}});return r0}}

/* calmer overall movement: slower drift, quieter idle life and reaction springs */
if(typeof MP!=='undefined'){MP.speedMul=Math.min(MP.speedMul,.43)}
if(typeof MR!=='undefined'){MR.idle=.55;MR.variety=.75}

/* stronger hit feel: longer hitstop, more shake / zoom on every tier */
if(typeof IFX!=='undefined'){const T=IFX.tiers;for(const k in T){T[k].hs+=1;T[k].shake*=1.4;T[k].zoom*=1.35}}

/* ---------- hits: jiggle the struck part; kicks land where the leg visibly meets the body ---------- */
{const oh=Match.prototype.onHit;Match.prototype.onHit=function(att,def,act,zone,p){const h=act.c.hit;const kick=h.kind==='kick'||h.kind==='knee';
    if(kick&&def.body.J.hd&&this.strikeBox&&this.hurtBoxes){const sb=this.strikeBox(att,act);if(sb){let best=null;
        const cp=(a,b,q)=>{const dx=b.x-a.x,dy=b.y-a.y,L=dx*dx+dy*dy||1e-9;const t=clamp(((q.x-a.x)*dx+(q.y-a.y)*dy)/L,0,1);return{x:a.x+dx*t,y:a.y+dy*t}};
        for(const hb of this.hurtBoxes(def)){if(zone&&hb.z!==zone&&best)continue;for(let i=0;i<=8;i++){const s0={x:sb.a.x+(sb.b.x-sb.a.x)*i/8,y:sb.a.y+(sb.b.y-sb.a.y)*i/8};const c=cp(hb.a,hb.b,s0);const dd=Math.hypot(s0.x-c.x,s0.y-c.y)-hb.r*.8;if(!best||dd<best.dd)best={dd,s:s0,c,hb}}}
        if(best){/* contact point on the body surface; close a visible gap by stepping the kicker in a little */const nx=(best.s.x-best.c.x),ny=(best.s.y-best.c.y),nl=Math.hypot(nx,ny)||1;p={x:best.c.x+nx/nl*best.hb.r*.8,y:best.c.y+ny/nl*best.hb.r*.8};
          if(best.dd>0)att.x+=att.d*Math.min(.1,best.dd);}}}
    const r=oh.call(this,att,def,act,zone,p);
    const dmg=(h.dmg||5);if(typeof hitJiggle==='function'&&def.body)hitJiggle(def.body,zone,Math.min(.035,.008+dmg*.0018)*def.H,att.d,(h.pt||'')[0]==='r'?'r':'l');
    return r}}

/* ---------- the cage: clinch against the fence, back take on a fighter gripping the fence, back control
   seated against the cage. The fence is at ±stage.R; bodies are placed so backs / hands actually touch it. ---------- */
const CAGE={pinGap:.27,backGap:.24,reach:.75};
{const ug=Match.prototype.updGrapple;Match.prototype.updGrapple=function(dt){const r=ug.call(this,dt);const g=this.g;if(!g||g.type!=='clinch')return r;
    const R=this.stage.R,a=g.att,d=g.def;const wall=Math.sign(d.x-a.x)||1;const near=Math.abs(d.x)>R-CAGE.reach&&Math.sign(d.x)===wall;
    if(near){if(!g.cage){g.cage=1;g._pa=a.gpose;g._pd=d.gpose;this.ev(`🧱 ${a.name} 케이지로 밀어붙입니다`)}
      if(!g.cageBack&&g.t>2&&Math.random()<dt*.12*(.6+ATT(a,'clinchCtl')-ATT(d,'clinchCtl')*.5)){g.cageBack=1;this.ev(`🔙 ${a.name} 케이지에서 백을 잡습니다`)}
      const AJ=a.body.J,DJ=d.body.J,t=g.t;const PA=Object.assign({},BASE_POSE),PD=Object.assign({},BASE_POSE);const wob=Math.sin(t*7)*.03;
      if(g.cageBack){/* defender faces the fence and grips it, attacker locks the body from behind */d.d=wall;a.d=wall;d.x=wall*(R-CAGE.backGap);a.x=d.x-wall*.3;
        Object.assign(PD,{lean:.32+wob,chest:.1,head:-.1,ll_h:.25,ll_k:.45,rl_h:-.2,rl_k:.4});Object.assign(PA,{lean:.3,chest:.08,head:.05,ll_h:.3,ll_k:.5,rl_h:-.25,rl_k:.45});
        if(DJ.mid){armIK(d,PD,'la',{x:wall*(R-.02),y:1.32+wob*.3});armIK(d,PD,'ra',{x:wall*(R-.02),y:1.05})}
        if(AJ.sh&&DJ.mid){armIK(a,PA,'la',{x:DJ.mid.x+wall*.1,y:DJ.mid.y+.02});armIK(a,PA,'ra',{x:DJ.mid.x+wall*.08,y:DJ.mid.y-.06})}}
      else{/* defender's back flat on the fence, one hand gripping the fence overhead, attacker head on the chest driving in */d.d=-wall;a.d=wall;d.x=wall*(R-CAGE.pinGap);a.x=d.x-wall*.42;
        Object.assign(PD,{lean:-.14,chest:-.05,head:.15,ll_h:.2,ll_k:.25,rl_h:-.15,rl_k:.3});Object.assign(PA,{lean:.45+wob,chest:.12,head:.25,ll_h:.15,ll_k:.55,rl_h:-.45,rl_k:.35,rl_a:.5});
        if(DJ.sh&&AJ.sh){armIK(d,PD,'la',{x:wall*(R-.03),y:1.5});armIK(d,PD,'ra',{x:AJ.sh.x,y:AJ.sh.y-.05});armIK(a,PA,'la',{x:DJ.hip.x-wall*.02,y:DJ.hip.y+.08});armIK(a,PA,'ra',{x:DJ.mid.x-wall*.04,y:DJ.mid.y})}}
      a.gpose=PA;d.gpose=PD;a.gRate=d.gRate=12}
    else if(g.cage){g.cage=0;g.cageBack=0;if(g._pa)a.gpose=g._pa;if(g._pd)d.gpose=g._pd}
    return r}}
/* a takedown from the cage back take ends in back control */
{const sg=Match.prototype.startGround;Match.prototype.startGround=function(top,bot,pos,ax){if(this.g&&this.g.cageBack)pos='back';else if(this._tdFromCageBack){pos='back';this._tdFromCageBack=0}return sg.call(this,top,bot,pos,ax)}}
{const sa=Match.prototype.startTdAnim;Match.prototype.startTdAnim=function(f,o,k){if(this.g&&this.g.type==='clinch'&&this.g.cageBack)this._tdFromCageBack=1;return sa.apply(this,arguments)}}
/* back control near the fence: the attacker sits with his back against the cage, the opponent between his legs */
{const sp=Match.prototype.setGPose;Match.prototype.setGPose=function(){const g=this.g;let cage=0;if(g&&g.type==='ground'&&g.pos==='back'){const R=this.stage.R;if(Math.abs(g.ax)>R-1.4){const wall=Math.sign(g.ax)||1;g.ax=wall*(R-.33);g.d=-wall;cage=wall}}
    const r=sp.apply(this,arguments);if(cage&&!g.sub){const T=g.top.gpose,B=g.bot.gpose;if(T&&B){T.lean=-.5;T.chest=-.05;T.head=.15;T.y=.15;B.lean=-.3;B.head=.05}g.cageSit=1}else if(g)g.cageSit=0;return r}}
/* fighters never pass through the fence */
{const st=Match.prototype.step;Match.prototype.step=function(dt){const r=st.call(this,dt);const R=this.stage&&this.stage.R;if(R&&!(this.cfg&&this.cfg.training==='bag'))for(const f of this.f){const lim=R-.2;if(f.x>lim)f.x=lim;if(f.x<-lim)f.x=-lim}return r}}

/* ---------- nothing crosses the fence: torso / head push the whole body back; a foot or hand that reaches
   the fence is pulled onto it by bending the knee / elbow (two-bone IK, joint stays on its own side) ---------- */
function fenceIK(R,T,L1,L2,E0){let dx=T.x-R.x,dy=T.y-R.y;let D=Math.hypot(dx,dy)||1e-6;const mx=(L1+L2)*.995;if(D>mx){dx*=mx/D;dy*=mx/D;D=mx}
  const an=Math.acos(clamp((L1*L1+D*D-L2*L2)/(2*L1*D),-1,1));const bx=dx/D,by=dy/D;
  const k1={x:R.x+(bx*Math.cos(an)-by*Math.sin(an))*L1,y:R.y+(bx*Math.sin(an)+by*Math.cos(an))*L1},k2={x:R.x+(bx*Math.cos(-an)-by*Math.sin(-an))*L1,y:R.y+(bx*Math.sin(-an)+by*Math.cos(-an))*L1};
  const mid=Math.hypot(k1.x-E0.x,k1.y-E0.y)<Math.hypot(k2.x-E0.x,k2.y-E0.y)?k1:k2;return{mid,end:{x:R.x+dx,y:R.y+dy}}}
/* rotate bone a→b about a so b sits on the fence (x = sg*Wl), keeping its length; carry the joints below along */
function lim2(J,a,b,L,sg,Wl,kids){const A=J[a],B=J[b];if(!A||!B||B.x*sg<=Wl)return;const dx=sg*Wl-A.x;if(Math.abs(dx)>=L){/* cannot reach: point the bone at the fence */const nb={x:A.x+Math.sign(dx)*L*.999,y:A.y};const mx=nb.x-B.x,my=nb.y-B.y;J[b]=nb;for(const k of kids)if(J[k])J[k]={x:J[k].x+mx,y:J[k].y+my};return}
  const h=Math.sqrt(L*L-dx*dx);const c1={x:A.x+dx,y:A.y-h},c2={x:A.x+dx,y:A.y+h};const nb=Math.hypot(c1.x-B.x,c1.y-B.y)<Math.hypot(c2.x-B.x,c2.y-B.y)?c1:c2;
  /* rotate the children rigidly with the bone */const a0=Math.atan2(B.y-A.y,B.x-A.x),a1=Math.atan2(nb.y-A.y,nb.x-A.x),da=a1-a0,cs=Math.cos(da),sn=Math.sin(da);
  for(const k of kids)if(J[k]){const q=J[k];const rx=q.x-A.x,ry=q.y-A.y;J[k]={x:A.x+rx*cs-ry*sn,y:A.y+rx*sn+ry*cs}}J[b]=nb}
function fenceClamp(B){const Wl=window.__cageWall;if(!Wl||!B.J.hd||B.look&&B.look.ref&&false)return;const J=B.J,L=B.L;
  for(const sg of[1,-1]){const over=k=>J[k]?J[k].x*sg-Wl:-1;
    /* torso / head: move the whole figure */let ov=0;for(const k of['hip','mid','sh','nk','hd','lS','rS','lH','rH'])ov=Math.max(ov,over(k));
    if(ov>0){for(const k in J)J[k]={x:J[k].x-sg*ov,y:J[k].y}}
    /* legs / arms: the whole limb swings at the hip / shoulder (knee and elbow keep their own bend) just enough
       for its farthest point to rest on the fence */
    for(const s of['l','r']){if(rotClamp(J,s+'H',[s+'K',s+'A',s+'He',s+'T',s+'Sn'],sg,Wl))fenceLeg(J,s,sg,Wl);rotClamp(J,s+'S',[s+'E',s+'W',s+'G'],sg,Wl)}}}
/* the leg that met the fence tucks in toward the other leg: the foot is set flat on the mat a little closer
   to the other foot (inside the fence), and the knee bends inward, toward the other leg — the ankle stays
   neutral instead of being cranked */
function fenceLeg(J,s,sg,Wl){const o=s==='l'?'r':'l';const H=J[s+'H'],K=J[s+'K'],A=J[s+'A'],He=J[s+'He'],T=J[s+'T'],OA=J[o+'A'];if(!H||!A||!He||!T)return;
  const Lf=Math.hypot(T.x-He.x,T.y-He.y)||.2;const dir=Math.sign(T.x-He.x)||sg;const aH=Math.hypot(A.x-He.x,A.y-He.y);const L1=Math.hypot(K.x-H.x,K.y-H.y),L2=Math.hypot(A.x-K.x,A.y-K.y);
  let ax=OA?A.x+(OA.x-A.x)*.95:A.x;/* right beside the other foot */const ay=OA?Math.max(.05,OA.y):Math.min(A.y,Math.max(.05,aH*.55));
  /* keep the whole foot (heel and toes) inside the fence */const reachOut=x=>Math.max(x+dir*Lf*.78,x-dir*Lf*.22)*sg;if(reachOut(ax)>Wl)ax-=sg*(reachOut(ax)-Wl);
  const r=fenceIK(H,{x:ax,y:ay},L1,L2,{x:H.x-sg*.3,y:K.y});/* pick the inward knee */const k2={x:2*((H.x+r.end.x)/2)-r.mid.x,y:r.mid.y};
  let knee=r.mid;{const mx=(H.x+r.end.x)/2,my=(H.y+r.end.y)/2,ux=r.end.x-H.x,uy=r.end.y-H.y,ul=Math.hypot(ux,uy)||1;const px=-uy/ul,py=ux/ul;const off=(r.mid.x-mx)*px+(r.mid.y-my)*py;const alt={x:r.mid.x-2*off*px,y:r.mid.y-2*off*py};
    /* the knee goes to the side of the other knee (they nearly overlap) */const OK=J[o+'K'];if(OK){if(Math.hypot(alt.x-OK.x,alt.y-OK.y)<Math.hypot(r.mid.x-OK.x,r.mid.y-OK.y))knee=alt}else if(alt.x*sg<r.mid.x*sg)knee=alt}
  /* knee and thigh follow the other leg almost exactly: aim the knee at a point just beside the other knee, keep bone lengths */
  {const OK=J[o+'K'];if(OK){const tk={x:OK.x+(knee.x-OK.x)*.12,y:OK.y+(knee.y-OK.y)*.12};const v={x:tk.x-H.x,y:tk.y-H.y},vl=Math.hypot(v.x,v.y)||1;const kk={x:H.x+v.x/vl*L1,y:H.y+v.y/vl*L1};
      const w={x:r.end.x-kk.x,y:r.end.y-kk.y},wl=Math.hypot(w.x,w.y)||1;const ae={x:kk.x+w.x/wl*L2,y:Math.max(.05,kk.y+w.y/wl*L2)};knee=kk;r.end=ae;if(r.end.x*sg>Wl)r.end={x:sg*Wl,y:r.end.y}}}
  J[s+'K']=knee;J[s+'A']=r.end;const A2=r.end;J[s+'He']={x:A2.x-dir*Lf*.22,y:Math.max(0,A2.y-aH*.8)};J[s+'T']={x:A2.x+dir*Lf*.78,y:0};
  for(const n of[s+'He',s+'T',s+'K',s+'A'])if(J[n].x*sg>Wl)J[n]={x:sg*Wl,y:J[n].y};if(J[s+'Sn'])J[s+'Sn']={x:J[s+'K'].x+(J[s+'A'].x-J[s+'K'].x)*.7,y:J[s+'K'].y+(J[s+'A'].y-J[s+'K'].y)*.7}}
/* the foot that met the fence turns down at the ankle: flat on the mat when it is low, toes pointing down
   (sole toward the fence) when it is raised — never past the fence or under the floor */
function footDown(J,s,sg,Wl){const A=J[s+'A'],He=J[s+'He'],T=J[s+'T'];if(!A||!He||!T)return;const fx=T.x-He.x,fy=T.y-He.y,L=Math.hypot(fx,fy)||1e-6;
  const low=A.y<.16;const want=low?{x:Math.sign(fx)||sg,y:0}:{x:sg*.35,y:-.94};const a0=Math.atan2(fy,fx),a1=Math.atan2(want.y,want.x);let da=a1-a0;da=Math.atan2(Math.sin(da),Math.cos(da));da=clamp(da,-1.4,1.4);
  const rot=(q,a)=>{const c=Math.cos(a),n=Math.sin(a);return{x:A.x+(q.x-A.x)*c-(q.y-A.y)*n,y:A.y+(q.x-A.x)*n+(q.y-A.y)*c}};
  let k=1;for(let it=0;it<8;it++){const h=rot(He,da*k),t=rot(T,da*k);if(Math.max(h.x*sg,t.x*sg)<=Wl+1e-4&&Math.min(h.y,t.y)>=-1e-4)break;k*=.7}
  J[s+'He']=rot(He,da*k);J[s+'T']=rot(T,da*k);for(const n of[s+'He',s+'T']){if(J[n].y<0)J[n]={x:J[n].x,y:0};if(J[n].x*sg>Wl)J[n]={x:sg*Wl,y:J[n].y}}}
function rotClamp(J,piv,keys,sg,Wl){const P=J[piv];if(!P)return;const pts=keys.filter(k=>J[k]);const f=th=>{const c=Math.cos(th),s=Math.sin(th);let m=-9;for(const k of pts){const q=J[k];const x=P.x+(q.x-P.x)*c-(q.y-P.y)*s;m=Math.max(m,x*sg-Wl)}return m};
  if(f(0)<=0)return false;/* swing the way that pulls the limb back inside */const dir=f(.05)<f(-.05)?1:-1;let lo=0,hi=2.2*dir;if(f(hi)>0){hi=(Math.PI-.05)*dir}
  for(let it=0;it<22;it++){const m=(lo+hi)/2;if(f(m)>0)lo=m;else hi=m}const c=Math.cos(hi),sn=Math.sin(hi);
  for(const k of pts){const q=J[k];J[k]={x:P.x+(q.x-P.x)*c-(q.y-P.y)*sn,y:P.y+(q.x-P.x)*sn+(q.y-P.y)*c}}
  /* a foot swung into the floor stays on the floor */for(const k of pts)if(J[k].y<0)J[k]={x:J[k].x,y:0};return true}
window.fenceClamp=fenceClamp;
{const sv=Body.prototype.solve;Body.prototype.solve=function(p,X,d){const J=sv.call(this,p,X,d);if(!this.rag)fenceClamp(this);return J}}
/* ragdoll: particles cannot pass the fence either */
{const sr=Body.prototype.stepRag;Body.prototype.stepRag=function(dt){const r=sr.call(this,dt);const Wl=window.__cageWall;if(Wl&&this.rag){for(const k in this.rag.P){const q=this.rag.P[k];if(q.x>Wl){q.x=Wl;q.px=Math.max(q.px,Wl)}else if(q.x<-Wl){q.x=-Wl;q.px=Math.min(q.px,-Wl)}}
    const J=this.J;for(const k in J){if(J[k].x>Wl)J[k]={x:Wl,y:J[k].y};else if(J[k].x<-Wl)J[k]={x:-Wl,y:J[k].y}}}return r}}

/* ---------- step-bounce toggle: touch button above the strike buttons, Q on the keyboard ---------- */
if(typeof In2!=='undefined'){const bt=In2.prototype.buildTouch;In2.prototype.buildTouch=function(){bt.call(this);const tc=this.tc;if(!tc)return;const box=tc.querySelector('.tr4');if(!box)return;
    const b=document.createElement('button');b.className='b4 bnc';b.innerHTML='<b>⤒</b><small>스탭 밟기</small>';box.insertBefore(b,box.firstChild);
    const sync=()=>b.classList.toggle('on',!!this.bounceOn);b.addEventListener('touchstart',e=>{e.preventDefault();this.bounceOn=!this.bounceOn;sync();if(navigator.vibrate)try{navigator.vibrate(8)}catch(_){}},{passive:false});b.addEventListener('click',()=>{this.bounceOn=!this.bounceOn;sync()});this._bncSync=sync}
  addEventListener('keydown',e=>{if((e.key==='q'||e.key==='Q')&&!/INPUT|SELECT|TEXTAREA/.test((e.target||{}).tagName||'')){const M=window.__curMatch;if(M&&M.inp){M.inp.bounceOn=!M.inp.bounceOn;if(M.inp._bncSync)M.inp._bncSync();M.ev&&M.ev(M.inp.bounceOn?'⤒ 스탭 밟기 ON':'스탭 밟기 OFF')}}})}
{const st=Match.prototype.step;Match.prototype.step=function(dt){window.__curMatch=this;return st.call(this,dt)}}
{const css=document.createElement('style');css.textContent='.b4.bnc{border-color:rgba(255,200,90,.9)}.b4.bnc.on{transform:none;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.4),rgba(242,181,68,.75) 62%)}';document.head.appendChild(css)}

/* ---------- overhand: the looping right hand is aimed at the head over its active frames ---------- */
{const fw=F2.prototype.footwork;F2.prototype.footwork=function(p,dt){fw.call(this,p,dt);const a=this.act;if(!a||!a.c||!a.c.hit||this.state!=='stand'||a.key!=='ovh'||!this.opp||!this.opp.body.J.hd)return;
    const h=a.c.hit,t=a.t;const w=t<h.t0*.45?0:t<h.t0?(t-h.t0*.45)/(h.t0*.55):t<=h.t1+.05?1:Math.max(0,1-(t-h.t1-.05)/.12);if(w<=0)return;
    const OJ=this.opp.body.J;/* land on the side / top of the head, coming over the guard */const T={x:OJ.hd.x-this.d*.04,y:OJ.hd.y+.03};const side=a.c.hand==='l'?'la':'ra';
    const tmp=Object.assign({},p);armIK(this,tmp,side,T);p[side+'_s']+=(tmp[side+'_s']-p[side+'_s'])*w;p[side+'_e']+=(tmp[side+'_e']-p[side+'_e'])*w}}

/* ---------- the old quick-step: button removed, no player quick steps (weave and step-bounce remain) ---------- */
if(typeof In2!=='undefined'){const bt=In2.prototype.buildTouch;In2.prototype.buildTouch=function(){bt.call(this);const tc=this.tc;if(tc){const st=tc.querySelector('.tr4 .stp');if(st)st.remove()}}}
if(typeof Pacing!=='undefined'){const qs=Pacing.quickStep;Pacing.quickStep=function(M,f,dir){if(f&&f.isPlayer===true)return false;return qs.apply(this,arguments)}}

/* ---------- no quick steps for anyone ---------- */
if(typeof Pacing!=='undefined')Pacing.quickStep=function(){return false};
/* bruise / sweat paint only once per fighter per frame (the clinch draws arms in separate passes) */
if(typeof paintFighterFX==='function'){const pf=paintFighterFX;window.paintFighterFX=function(ctx,f){if(f&&f._noFx)return;return pf(ctx,f)}}
/* ---------- clinch grips: the far arm wraps the opponent's back (hidden behind the bodies), the near arm comes
   up over the shoulder to the neck (collar tie, visible); both bent in tight toward the opponent ---------- */
{const ug=Match.prototype.updGrapple;Match.prototype.updGrapple=function(dt){const r=ug.call(this,dt);const g=this.g;if(!g||g.type!=='clinch'||g.cage)return r;
    for(const f of[g.att,g.def]){const o=f.opp,P=f.gpose,OJ=o.body.J;if(!P||!OJ.sh)continue;const nearLead=((f.d||1)>0)===((f.stance||1)>0);const near=nearLead?'la':'ra',far=nearLead?'ra':'la';const od=o.d||-f.d;
      const wob=Math.sin((g.t||0)*6+(f===g.att?0:1.7))*.012;
      armIK(f,P,far,{x:OJ.sh.x-od*.07,y:(OJ.sh.y+OJ.mid.y)/2+wob});/* hand on the far side of his back */
      armIK(f,P,near,{x:OJ.nk.x-od*.03,y:OJ.nk.y+.03+wob});/* collar tie behind the head */
      P[near+'_e']=Math.max(P[near+'_e'],1.15);P[far+'_e']=Math.max(P[far+'_e'],1.25);/* bent in tight */
      P.lean=Math.max(P.lean||0,.22);P.head=(P.head||0)+.05}
    return r}}
})();
