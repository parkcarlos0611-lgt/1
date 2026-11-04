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
  let hv=th+a+(P.rot||0);hv-=Math.PI*2*Math.round((hv-.62)/(Math.PI*2));/* same angle, on the turn inside the hip's range */P[side+'_h']=hv;P[side+'_k']=Math.PI-b}
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
function subCat(name,AT){if(/리어 네이키드/.test(name))return'rnc';if(/바디 트라이앵글/.test(name))return'bodytri';if(/암바/.test(name))return AT?'armbarM':'armbarG';
  if(/^트라이앵글/.test(name))return AT?'armtri':'triangle';if(/기무라/.test(name))return AT?'kimuraT':'kimuraB';if(/아메리카나/.test(name))return'americana';return AT?'armtri':'triangle'}
/* the camera-side ("near") limbs of a fighter for a facing d — same rule as Body.draw */
const nearOf=(F,d)=>{const nl=(d>0)===(((F.body&&F.body.stance)||F.stance||1)>0);return nl?{arm:'la',leg:'ll',S:'lS',E:'lE',W:'lW',H:'lH',K:'lK',A:'lA',fArm:'ra',fLeg:'rl',fE:'rE',fW:'rW',fK:'rK',fA:'rA'}:{arm:'ra',leg:'rl',S:'rS',E:'rE',W:'rW',H:'rH',K:'rK',A:'rA',fArm:'la',fLeg:'ll',fE:'lE',fW:'lW',fK:'lK',fA:'lA'}};
/* place the elbow AND the wrist (shoulder → E → W): folded holds like the choking arm of a rear naked choke */
function arm2pt(F,P,side,E,W){const J=F.body.J,S=J[side==='la'?'lS':'rS'];if(!S)return;const d=F.d||1;const L=F.body.L;
  const e1=Math.hypot(E.x-S.x,E.y-S.y)||1e-6,k1=L.uarm/e1;const Ex={x:S.x+(E.x-S.x)*k1,y:S.y+(E.y-S.y)*k1};/* keep the bone length */
  const f1=Math.atan2((Ex.x-S.x)*d,-(Ex.y-S.y)),f2=Math.atan2((W.x-Ex.x)*d,-(W.y-Ex.y));const ta=(P.lean||0)+(P.chest||0)-(P.rot||0);
  const prev=P[side+'_s']||0,ns=f1-ta;P[side+'_s']=prev+(ns-prev-Math.PI*2*Math.round((ns-prev)/(Math.PI*2)));let el=f2-f1;el=Math.atan2(Math.sin(el),Math.cos(el));P[side+'_e']=clamp(el,-.03,2.62);P[side==='la'?'lo':'ro']=1}
/* contact with the mat: every body in a hold rests on it (lowest body surface at y = 0), corrected each frame */
const GR_R={hip:.09,mid:.085,sh:.08,nk:.05,hd:.07,lK:.045,rK:.045,lA:.03,rA:.03,lHe:.006,rHe:.006,lT:.006,rT:.006};
const GR_TORSO=['hip','mid','sh','nk','hd'],GR_ALL=Object.keys(GR_R);
function groundGap(F,keys){const J=F.body.J,M=F.body.H*(F.body.W||1)*.86;let m=9;for(const k of keys||GR_TORSO){const q=J[k];if(!q)continue;const r=k==='hd'?.065*F.body.H:GR_R[k]*M;m=Math.min(m,q.y-r)}return m}
function subOverlay(M,dt){const g=M.g,s=g.sub;const A=s.att,D=s.def;const aJ=A.body.J,dJ=D.body.J;if(!aJ.hd||!dJ.hd)return;
  const AT=A===g.top;const cat=s.cat||(s.cat=subCat(s.name,AT));const t=g.t;const q=Math.sin(t*18)*.01,str=Math.sin(t*9);const e=g.d||1;const tight=clamp(s.p,0,1),ax=g.ax;
  const mk=o=>Object.assign({},BASE_POSE,o,{free:1});const L=(a,b,u)=>({x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u});
  let pa,pd,da,dd,xa,xd,layers;const nk=dJ.nk,hd=dJ.hd,sh=dJ.sh,mid=dJ.mid,hip=dJ.hip;
  if(cat==='rnc'||cat==='bodytri'){/* seated behind, chest to back, hooks in; both facing the same way */
    da=dd=e;xa=ax-e*.15;xd=ax+e*.16;
    pa=mk({y:.14,lean:-.34-tight*.06,chest:.14,head:.3,tw:0,ll_h:1.25,ll_k:1.45,ll_a:.3,rl_h:1.2,rl_k:1.5,rl_a:.3});
    pd=mk({y:.13,lean:-.24-tight*.12+str*.03,chest:-.02,head:-.12-tight*.25+str*.05,ll_h:1.55,ll_k:.3,ll_a:.1,rl_h:2.0+str*.08,rl_k:1.55,rl_a:.1});
    A.d=da;D.d=dd;const An=nearOf(A,da),Dn=nearOf(D,dd);
    /* hooks: heels inside the defender's thighs (body triangle: the near leg locks across the belly) */
    if(cat==='rnc'){legIK(A,pa,An.leg,{x:L(hip,dJ[Dn.K],.58).x,y:L(hip,dJ[Dn.K],.58).y+.03});legIK(A,pa,An.fLeg,{x:L(hip,dJ[Dn.fK],.5).x,y:L(hip,dJ[Dn.fK],.5).y+.03})}
    else{legIK(A,pa,An.leg,{x:mid.x+e*.16,y:mid.y-.04});legIK(A,pa,An.fLeg,{x:mid.x+e*.12,y:mid.y-.08})}
    /* choking arm: elbow under the chin, forearm across the throat, hand behind the neck gripping the far biceps */
    arm2pt(A,pa,An.arm,{x:nk.x+e*.12,y:nk.y-.08},{x:nk.x-e*.05+q,y:nk.y-.01});armIK(A,pa,An.fArm,{x:hd.x-e*.09,y:hd.y+.03});
    /* defender: two-on-one on the choking forearm */const cE=aJ[An.E],cW=aJ[An.W];if(cE&&cW){armIK(D,pd,Dn.arm,L(cE,cW,.35));armIK(D,pd,Dn.fArm,{x:cW.x+q,y:cW.y+.01})}
    layers=[[A,['farArm','farLeg']],[A,['torso','shorts','head']],[D,['farArm','farLeg']],[D,['torso','nearLeg','shorts','head']],[A,['nearLeg']],[A,['nearArm']],[D,['nearArm']]]}
  else if(cat==='armbarM'){/* from mount: seated on the chest at the shoulder, one leg over the face (heel down past the head),
      the other folded against the ribs; the arm straight up along the attacker's chest, thumb up, while he leans back */
    dd=e;da=-e;xd=ax+e*.32;xa=ax+e*.1;
    pd=mk({y:.14,rot:-1.57,lean:0,chest:0,head:.05+str*.05,ll_h:.25+str*.08,ll_k:.4,rl_h:.6,rl_k:1.15,rl_a:.2});
    pa=mk({y:.36,rot:0,lean:-.55-tight*.3,chest:.08,head:.3,ll_h:.95,ll_k:2.35,ll_a:.4,rl_h:.95,rl_k:2.35,rl_a:.4});
    A.d=da;D.d=dd;const An=nearOf(A,da),Dn=nearOf(D,dd);
    legIK(A,pa,An.leg,{x:hd.x-e*.16,y:.12});/* over the face */legIK(A,pa,An.fLeg,{x:mid.x-e*.08,y:.12});/* folded against the ribs */
    const ac=aJ.sh?L(aJ.mid,aJ.sh,.75):{x:sh.x,y:.8};armIK(D,pd,Dn.arm,{x:ac.x-e*.04,y:ac.y});armIK(D,pd,Dn.fArm,{x:aJ.hip?aJ.hip.x+e*.05:ax,y:aJ.hip?aJ.hip.y:.3});
    const dw=dJ[Dn.W]||ac;armIK(A,pa,An.arm,{x:dw.x,y:dw.y-.02});armIK(A,pa,An.fArm,{x:dw.x,y:dw.y-.08});
    layers=[[D,['farArm','farLeg','torso','nearLeg','shorts','head']],[A,['farArm','farLeg','torso','shorts','head']],[D,['nearArm']],[A,['nearLeg']],[A,['nearArm']]]}
  else if(cat==='armbarG'){/* from guard: attacker on his back with hips up, defender kneeling and leaning in; one leg over the face,
      one across the back, the defender's arm stretched down to the attacker's chest */
    da=e;dd=-e;xa=ax;xd=ax+e*.42;
    pa=mk({y:.18+tight*.06,rot:-1.4,lean:.12,chest:.1,head:.4});
    pd=mk({y:.42,lean:.85+str*.05,chest:.15,head:.25,ll_h:.35,ll_k:2.1,ll_a:-.3,rl_h:.1,rl_k:2.0,rl_a:-.3});
    A.d=da;D.d=dd;const An=nearOf(A,da),Dn=nearOf(D,dd);
    legIK(A,pa,An.leg,{x:hd.x-e*.14,y:hd.y-.1});/* calf across the face */legIK(A,pa,An.fLeg,{x:sh.x+e*.22,y:sh.y+.06});/* over the back */
    const grip=aJ.sh?L(aJ.mid,aJ.sh,.6):{x:ax-e*.35,y:.3};armIK(D,pd,Dn.arm,{x:grip.x,y:grip.y+.06});armIK(D,pd,Dn.fArm,{x:aJ.hip?aJ.hip.x+e*.05:ax,y:.05});
    const dw=dJ[Dn.W]||grip;armIK(A,pa,An.arm,dw);armIK(A,pa,An.fArm,{x:dw.x+e*.05,y:dw.y-.03});
    layers=[[D,['farArm','farLeg']],[A,['farArm','torso','shorts','head']],[D,['torso','nearLeg','shorts','head']],[A,['farLeg']],[D,['nearArm']],[A,['nearLeg']],[A,['nearArm']]]}
  else if(cat==='triangle'){/* from guard: legs locked around the head and one arm (knee pit over the ankle), head pulled down */
    da=e;dd=-e;xa=ax;xd=ax+e*.6;
    pa=mk({y:.14+tight*.05,rot:-1.45,lean:.1,chest:.12,head:.45});
    pd=mk({y:.4,lean:1.0+tight*.12,chest:.2,head:.5+tight*.15+str*.05,ll_h:.35,ll_k:2.1,ll_a:-.3,rl_h:.05,rl_k:2.0,rl_a:-.3});
    A.d=da;D.d=dd;const An=nearOf(A,da),Dn=nearOf(D,dd);
    legIK(A,pa,An.leg,{x:nk.x+e*.2,y:nk.y+.08});/* thigh along the neck, calf behind it */
    const kn=aJ[An.K];legIK(A,pa,An.fLeg,kn?{x:kn.x+e*.08,y:kn.y-.04}:{x:nk.x+e*.2,y:nk.y});/* the far foot locked under the near knee */
    armIK(A,pa,An.arm,{x:hd.x+e*.07,y:hd.y+.06});armIK(A,pa,An.fArm,{x:hd.x+e*.1,y:hd.y+.02});/* pulling the head down */
    armIK(D,pd,Dn.arm,{x:hd.x-e*.08,y:hd.y+.1});/* trapped arm across his own neck */armIK(D,pd,Dn.fArm,aJ.hip?{x:aJ.hip.x+e*.05,y:aJ.hip.y+.08}:{x:ax,y:.2});
    layers=[[D,['farArm','farLeg']],[A,['farArm','farLeg','torso','shorts','head']],[D,['torso','nearLeg','shorts','head']],[D,['nearArm']],[A,['nearLeg']],[A,['nearArm']]]}
  else if(cat==='kimuraB'){/* from guard: sits up on the far hip, grabs the wrist, reaches over the shoulder to grip his own wrist
      (figure four) and turns the bent arm behind the defender's back */
    da=e;dd=-e;xa=ax;xd=ax+e*.52;
    pa=mk({y:.14,rot:-1.0,lean:.4,chest:.12,head:.25,ll_h:1.6,ll_k:1.7,rl_h:1.5,rl_k:1.8});
    pd=mk({y:.42,lean:.55+str*.04,chest:.1,head:.15,ll_h:.35,ll_k:2.1,ll_a:-.3,rl_h:.1,rl_k:2.0,rl_a:-.3});
    A.d=da;D.d=dd;const An=nearOf(A,da),Dn=nearOf(D,dd);
    legIK(A,pa,An.leg,{x:hip.x+e*.14,y:hip.y+.12});legIK(A,pa,An.fLeg,{x:hip.x+e*.18,y:hip.y+.08});/* closed guard, ankles crossed behind */
    const E2={x:sh.x-e*.24,y:sh.y-.14},W2={x:E2.x+e*(.04+.14*tight),y:E2.y+.25};arm2pt(D,pd,Dn.arm,E2,W2);armIK(D,pd,Dn.fArm,aJ.hip?{x:aJ.hip.x-e*.18,y:.04}:{x:ax,y:.04});
    const dw=dJ[Dn.W]||W2,de=dJ[Dn.E]||E2;armIK(A,pa,An.arm,dw);armIK(A,pa,An.fArm,{x:de.x+e*.04,y:de.y+.05});
    layers=[[D,['farArm','farLeg']],[A,['farLeg','torso','shorts','head']],[D,['torso','nearLeg','shorts','head']],[D,['nearArm']],[A,['farArm']],[A,['nearLeg']],[A,['nearArm']]]}
  else if(cat==='kimuraT'||cat==='americana'){/* top: kneeling on the far side, chest over the defender; figure-four on the bent arm.
      americana: wrist pinned to the mat by the head, elbow lifted ("paintbrush"); kimura: hand cranked up and over */
    da=-e;dd=e;xd=ax+e*.25;xa=ax+e*.08;
    pd=mk({y:.14,rot:-1.57,lean:0,head:.05+str*.05,ll_h:.3+str*.1,ll_k:.6,rl_h:.7,rl_k:1.2,rl_a:.2});
    pa=mk({y:.42,lean:.8+tight*.1,chest:.1,head:-.05,ll_h:.25,ll_k:2.05,ll_a:-.3,rl_h:-.05,rl_k:1.95,rl_a:-.3});
    A.d=da;D.d=dd;const An=nearOf(A,da),Dn=nearOf(D,dd);let E2,W2;
    if(cat==='americana'){E2={x:sh.x-e*.12,y:.08+tight*.08};W2={x:E2.x-e*(.26-.08*tight),y:.06}}else{E2={x:sh.x+e*.06,y:sh.y+.1};W2={x:E2.x-e*(.04+.16*tight),y:E2.y+.24}}
    arm2pt(D,pd,Dn.arm,E2,W2);armIK(D,pd,Dn.fArm,aJ.hip?{x:aJ.hip.x,y:aJ.hip.y}:{x:ax,y:.3});
    const dw=dJ[Dn.W]||W2,de=dJ[Dn.E]||E2;armIK(A,pa,An.arm,{x:dw.x,y:dw.y+.02});armIK(A,pa,An.fArm,{x:de.x,y:de.y-.02});
    layers=[[A,['farLeg','nearLeg','farArm','torso','shorts','head']],[D,['farArm','farLeg','torso','nearLeg','shorts','head']],[D,['nearArm']],[A,['nearArm']]]}
  else{/* arm triangle / d'arce: chest on chest, head on the mat beside the defender's head trapping his own arm against his neck */
    da=-e;dd=e;xd=ax+e*.22;xa=ax+e*.42;
    pd=mk({y:.14,rot:-1.57,head:.1+tight*.1+str*.05,ll_h:.3+str*.1,ll_k:.7,rl_h:.6,rl_k:1.2,rl_a:.2});
    pa=mk({y:.32,rot:1.3,lean:.05,chest:.1,head:.2,ll_h:.55,ll_k:.8,ll_a:-.3,rl_h:.2,rl_k:.5,rl_a:-.3});
    A.d=da;D.d=dd;const An=nearOf(A,da),Dn=nearOf(D,dd);
    armIK(D,pd,Dn.arm,{x:hd.x-e*.1,y:hd.y+.2});/* his own arm pushed up across the neck */armIK(D,pd,Dn.fArm,aJ.hip?{x:aJ.hip.x,y:aJ.hip.y-.02}:{x:ax,y:.3});
    armIK(A,pa,An.arm,{x:nk.x-e*.02+q,y:nk.y+.02});armIK(A,pa,An.fArm,{x:hd.x-e*.08,y:hd.y+.12});
    layers=[[D,['farArm','farLeg','torso','nearLeg','shorts']],[A,['farArm','farLeg','torso','shorts','nearLeg','head']],[D,['head']],[D,['nearArm']],[A,['nearArm']]]}
  /* place + face (positions kept on the hold: the base ground pose resets x every frame) */if(s._xa==null){s._xa=A.x;s._xd=D.x}const k=Math.min(1,(dt||0)*7);s._xa+=(xa-s._xa)*k;s._xd+=(xd-s._xd)*k;A.x=s._xa;D.x=s._xd;A.d=da;D.d=dd;
  /* struggle */pd.lean+=Math.sin(t*11)*.03;pd.head+=Math.sin(t*15)*.05;
  /* rest both bodies on the mat (feedback on last frame's skeleton) *//* each hold sets the real contact height; this only lifts a body that would sink into the mat */const legsA=/^(kimuraT|americana|armtri)$/.test(cat)?GR_ALL:GR_TORSO;/* legs that are wrapped round the opponent (IK) don't decide the height */s._ga=clamp((s._ga||0)-groundGap(A,legsA)*.6,0,.4);s._gd=clamp((s._gd||0)-groundGap(D,GR_ALL)*.6,0,.4);pa.y+=s._ga;pd.y+=s._gd;
  s.layers=layers;A.gpose=pa;D.gpose=pd;A.gRate=D.gRate=14;
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

/* ---------- overhand: the elbow folds up toward the ceiling and the forearm comes down onto the chin;
   the lead hand stays glued to the face ---------- */
function armIKUp(F,P,side,T){const J=F.body.J,S=J[side==='la'?'lS':'rS'];if(!S||!T)return;const L=F.body.L,L1=L.uarm,L2=L.farm+L.glove*.8,d=F.d||1;
  const vx=(T.x-S.x)*d,vy=T.y-S.y;const D0=Math.hypot(vx,vy);const Dm=(L1+L2)*.8;/* keep the arm bent: the elbow stays high */let D=clamp(D0,(L1+L2)*.3,Dm);const th=Math.atan2(vx,-vy);
  const a=Math.acos(clamp((L1*L1+D*D-L2*L2)/(2*L1*D),-1,1)),b=Math.acos(clamp((L1*L1+L2*L2-D*D)/(2*L1*L2),-1,1));const ta=(P.lean||0)+(P.chest||0)-(P.rot||0);
  /* the elbow on the upper side of the shoulder–target line: upper arm raised, forearm angled down to the target */
  P[side+'_s']=th+a-ta;P[side+'_e']=-(Math.PI-b);return Math.max(0,D0-Dm)/* how far the body still has to come in */}
{const fw=F2.prototype.footwork;F2.prototype.footwork=function(p,dt){fw.call(this,p,dt);const a=this.act;this.body._eMinL=this.body._eMinR=null;if(!a||!a.c||!a.c.hit||this.state!=='stand'||a.key!=='ovh'||!this.opp||!this.opp.body.J.hd)return;if(a.c.hand==='l')this.body._eMinL=-2.6;else this.body._eMinR=-2.6;
    const h=a.c.hit,t=a.t;const J=this.body.J,OJ=this.opp.body.J,d=this.d||1;const side=a.c.hand==='l'?'la':'ra',off=side==='la'?'ra':'la';
    /* lead hand tight to the face for the whole punch */const g=Math.min(1,t/.08)*(t<=a.c.dur-.08?1:Math.max(0,(a.c.dur-t)/.08));if(J.hd){const tmp=Object.assign({},p);armIK(this,tmp,off,{x:J.hd.x+d*.07,y:J.hd.y-.04});p[off+'_s']+=(tmp[off+'_s']-p[off+'_s'])*g;p[off+'_e']+=(tmp[off+'_e']-p[off+'_e'])*g}
    const w=t<h.t0*.35?0:t<h.t0?(t-h.t0*.35)/(h.t0*.65):t<=h.t1+.05?1:Math.max(0,1-(t-h.t1-.05)/.14);if(w<=0)return;
    /* the fist arrives from above, angled down through the jaw */const chin={x:OJ.hd.x-d*.02,y:OJ.hd.y-.07};const pre=t<h.t0?(1-(t-h.t0*.35)/(h.t0*.65)):0;
    const T={x:chin.x+d*(.04-.1*pre),y:chin.y+.18*pre+.02*(1-pre)};const tmp=Object.assign({},p);const gap=armIKUp(this,tmp,side,T);
    p[side+'_s']+=(tmp[side+'_s']-p[side+'_s'])*w;p[side+'_e']+=(tmp[side+'_e']-p[side+'_e'])*w;/* step the body in so the bent arm still lands */p.x=(p.x||0)+Math.min(.3,gap)*w*(1-pre)}}

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

/* ---------- calf kick: the lead shin chops down across the opponent's lead calf ---------- */
{const fw=F2.prototype.footwork;F2.prototype.footwork=function(p,dt){fw.call(this,p,dt);const a=this.act;if(!a||!a.c||!a.c.hit||this.state!=='stand'||a.key!=='calf'||!this.opp||!this.opp.body.J.lK)return;
    const h=a.c.hit,t=a.t;const w=t<h.t0*.25?0:t<h.t0?(t-h.t0*.25)/(h.t0*.75):t<=h.t1+.04?1:Math.max(0,1-(t-h.t1-.04)/.14);if(w<=0)return;
    const OJ=this.opp.body.J;/* the calf: the back of the lower leg, a third of the way down from the knee */const c={x:OJ.lK.x+(OJ.lA.x-OJ.lK.x)*.5,y:OJ.lK.y+(OJ.lA.y-OJ.lK.y)*.5};
    const thru=t<h.t0?0:.1;/* the ankle swings slightly past the calf and a little downward */const T={x:c.x+this.d*thru,y:Math.max(.1,c.y-.1-thru*.3)};/* low path: the shin comes in under the knee */
    const tmp=Object.assign({},p);legIK(this,tmp,'ll',T);p.ll_h+=(tmp.ll_h-p.ll_h)*w;p.ll_k+=(tmp.ll_k-p.ll_k)*w;p.ll_a+=(.55-p.ll_a)*w*.6;/* foot turned over */p.tw-=.15*w;p.lean-=.05*w}}

/* ---------- overhand: a big, committed punch — deep forward bend, slower and costlier, harder-hitting ---------- */
if(typeof MV!=='undefined'&&MV.ovh){const o=MV.ovh;const k=1.32;o.dur=+(o.dur*k).toFixed(3);o.keys=o.keys.map(([t,p,e])=>e?[+(t*k).toFixed(3),p,e]:[+(t*k).toFixed(3),p]);
  /* bend the torso far forward at the strike, the head following the fist down */
  for(const kf of o.keys){const p=kf[1];if(p.lean!=null&&p.lean>=.4){p.lean=.68;p.chest=.14;p.head=.22;p.ll_k=.7;p.x=.15}else if(p.lean!=null&&p.lean>.3){p.lean=.5;p.chest=.1}}/* bent forward, but not folded over */
  o.hit=Object.assign({},o.hit,{t0:+(o.hit.t0*k).toFixed(3),t1:+(o.hit.t1*k).toFixed(3),dmg:+(o.hit.dmg*1.4).toFixed(1),sta:+(o.hit.sta*1.7).toFixed(1)});o.lunge=.3;REACH.ovh=1.12}

/* ---------- knee: standing knee from the kick button (swipe down) and the clinch knee aimed at the chin ----------
   In the clinch the torso stays upright and the knee drives up to the chin when the strike is accurate
   (otherwise the chest); a knee to the chin is only stopped by the upper (uppercut) guard. */
{const sk=F2.prototype.strike;F2.prototype.strike=function(key,M){const ok=sk.call(this,key,M);if(ok&&key==='knee'&&this.act){const acc=ATT(this,'accuracy');this.act.kTgt=Math.random()<.3+acc*.5?'chin':'chest'}return ok}}
{const fw=F2.prototype.footwork;F2.prototype.footwork=function(p,dt){fw.call(this,p,dt);const a=this.act;if(!a||a.key!=='knee'||!a.c||!a.c.hit||!this.opp||!this.opp.body.J.hd)return;
    const h=a.c.hit,t=a.t;const w=t<h.t0*.4?0:t<h.t0?(t-h.t0*.4)/(h.t0*.6):t<=h.t1+.04?1:Math.max(0,1-(t-h.t1-.04)/.14);if(w<=0)return;
    const OJ=this.opp.body.J,J=this.body.J,d=this.d||1;const chin=a.kTgt==='chin';const T=chin?{x:OJ.hd.x-d*.02,y:OJ.hd.y-.1}:{x:OJ.sh.x+(OJ.mid.x-OJ.sh.x)*.4,y:OJ.sh.y+(OJ.mid.y-OJ.sh.y)*.4};
    const Hp=J.rH;if(!Hp)return;/* thigh points the knee at the target, shin folded tight */const hA=Math.atan2((T.x-Hp.x)*d,-(T.y-Hp.y))+(p.rot||0);
    p.rl_h+=(hA-p.rl_h)*w;p.rl_k+=(2.35-p.rl_k)*w;p.rl_a+=(.6-p.rl_a)*w*.5;
    if(this.state==='clinch'||chin){p.lean+=(-.04-p.lean)*w*.8;p.head+=(.05-p.head)*w*.5}/* upright: hips drive up, not the head down */}}
{const oh=Match.prototype.onHit;Match.prototype.onHit=function(att,def,act,zone,p){if(act&&act.key==='knee'&&act.kTgt==='chin'){
      if(def.guard==='upp'){SFXI.play('block',.7);def.sta-=4;att.st&&att.st.thr++;this.hitstop=.04;if(typeof hitJiggle==='function')hitJiggle(def.body,'body',.01*def.H,att.d);this.ev&&this.ev(`🛡️ ${def.name} 어퍼 가드로 니킥을 막습니다`);return}
      /* any other guard does not stop a knee coming up the middle */const g0=def.guard;def.guard=null;try{return oh.call(this,att,def,act,'head',p)}finally{def.guard=g0}}
    return oh.call(this,att,def,act,zone,p)}}

{const fd=F2.prototype.draw;F2.prototype.draw=function(ctx,o){if(this.body)this.body._striking=!!(this.act&&this.act.c&&this.act.c.hit);return fd.call(this,ctx,o)}}

/* ---------- lead-hand attacks: 10 % less damage and 5 % quicker than the matching rear-hand attack;
   a lead power straight for the jab button's right swipe ---------- */
if(typeof MV!=='undefined'){const timeK=(c,k)=>{c.dur=+(c.dur*k).toFixed(3);c.keys=c.keys.map(([t,p,e])=>e?[+(t*k).toFixed(3),p,e]:[+(t*k).toFixed(3),p]);if(c.hit)c.hit=Object.assign({},c.hit,{t0:+(c.hit.t0*k).toFixed(3),t1:+(c.hit.t1*k).toFixed(3)})};
  const lead=(L,R)=>{const a=MV[L],b=MV[R];if(!a||!b||!a.hit||!b.hit)return;timeK(a,(b.dur/1.05)/a.dur);a.hit=Object.assign({},a.hit,{dmg:+(b.hit.dmg*.9).toFixed(2)})};
  if(MV.jab&&MV.cross&&!MV.lstr){const j=JSON.parse(JSON.stringify(MV.jab));j.n='앞손 스트레이트';j.keys=j.keys.map(k=>{const p=k[1];if(p&&(p.la_s!=null&&p.la_s>1.2)){p.tw=(p.tw||0)-.25;p.lean=(p.lean||0)+.08;p.x=(p.x||0)+.05}return k});
    j.hit=Object.assign({},j.hit,{dmg:+(MV.cross.hit.dmg*.9).toFixed(2),sta:+((MV.cross.hit.sta||4)*.9).toFixed(2)});j.lunge=Math.max(j.lunge||0,.08);MV.lstr=j;timeK(MV.lstr,(MV.cross.dur/1.05)/MV.lstr.dur)}
  lead('lhook','rhook');lead('lupp','rupp');lead('blhook','brhook');if(typeof KEYN!=='undefined')KEYN.lstr='앞손 스트레이트'}
})();
