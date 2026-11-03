/* ===== JudgeRefereeSystem.js : concussion/KO model, referee AI, doctor, 3-judge 10-point must =====
   Replaces Match.applyDmg / updRef / scoreRound / doctor and adds round stats. Loaded BEFORE
   CombatEngine.js so CombatEngine's outcome wrapper sits on top of the new applyDmg.

   KO model (StunModel) — no more flat random KO rolls on every hit:
     conc  : concussion gauge. Each clean head shot adds impact × combo × chin factor.
             impact = dmg × counter(1.6) × clean-on-the-chin(1.35); combo grows with every head
             shot inside comboWindow (systematic stun build-up from combinations).
             Decays between exchanges toward a permanent floor (damage taken this fight).
     T     : threshold = threshBase + chin × threshChin, lower when exhausted.
     conc/T ≥ rockAt → rocked (stagger) · ≥ kdAt → knockdown · ≥ koAt → KO
     flash KO: only a single big clean/counter shot above the fighter's flash threshold can
             end it instantly (probability ramps with the excess, capped).
   Referee AI (RefereeAIController):
     positioning — keeps a distance band from the pair, on the side with more room, never
             between the fighters; closes in on the ground; separates fighters at the bell;
     stoppage — "danger" builds from unanswered strikes on a rocked / downed / mounted
             fighter and drains when he defends intelligently (strikes back, guard up,
             escapes, sub attempts); over the limit the ref rushes in, waves it off → TKO.
   Doctor: bleed limit or a badly swollen eye triggers a check; stopping is probabilistic.
   ScoringEngine: per-round effective striking (impact-weighted), effective grappling
     (takedowns, control, near-submissions), aggression and octagon control, scored by three
     judges with different leanings and noise → 10-10 / 10-9 / 10-8 / 10-7 under the
     Unified Rules order (impact first; aggression, then cage control only when even). */
const KO=tuneSection('ko',{
  concussMul:1, comboWindow:1.05, comboStep:.2, comboMax:1.9, counterMul:1.6, cleanMul:1.35, groundMul:.5,
  threshBase:10, threshChin:14, exhaustedMul:.82,
  decay:5.5, decayDelay:.95, permShare:.22, roundRecover:.55,
  rockAt:.62, kdAt:1, koAt:1.6, kdReset:.45, rockTime:[1.2,2.6],
  koOnKd:{over:.8,impFrom:5,impSpan:10,impMax:.35,secondKd:.35},   // KO chance when the knockdown threshold is crossed
  flash:{minImpact:7,base:10,chin:7,concBonus:3,slope:6,max:.5},
  aiDiffEase:true            // easy difficulty: AI opponents are easier to hurt (as before)
});
const REF=tuneSection('referee',{
  dist:{min:1.15,max:1.9,pad:.85}, groundDist:.95, wallMargin:.3, speed:1.2, rush:2.8,
  stopAt:30, groundHurt:.62, groundStopMul:1.5, stopHeart:.35, decay:4.5, defendMul:.3, defendT:1.1, stopDelay:.5, waveT:1.4,
  separateSpeed:.9
});
const GRAP=tuneSection('grappling',{subBias:.01,subHurtBonus:.03,subHurtFrom:.5});
const DOC=tuneSection('doctor',{base:.3,perSev:.28,swellStop:1.75,swellChance:.45});
const JUDGE=tuneSection('judging',{
  w:{edmg:1,sig:.3,kd:20,td:4.5,ctrl:.075,subNear:7,subAtt:1.2,agg:.5,oc:.04},
  close:.07, noise:.07, tenTen:{margin:.015,chance:.25},
  tenEight:{margin:.62,minEff:45,kdMargin:.35}, tenSeven:{margin:.85,kdDiff:3},
  judges:[{n:'심판 1',strike:1.15,grap:.85},{n:'심판 2',strike:1,grap:1},{n:'심판 3',strike:.88,grap:1.15}]
});
/* ---------- StunModel ---------- */
const StunModel={
  T(f){const chin=ATT(f,'chin');return(KO.threshBase+chin*KO.threshChin)*(f.sta<25?KO.exhaustedMul:1)},
  ratio(f){return(f.conc||0)/this.T(f)},
  tick(f,dt,now){if(!f.conc)return;if(now-(f.lastHeadT||0)<KO.decayDelay)return;const floor=f.concPerm||0;f.conc=Math.max(floor,f.conc-dt*KO.decay*(.6+ATT(f,'recovery')*.8))},
  /* returns 'ko' | 'kd' | 'rock' | 'flash' | null */
  hit(M,att,def,dmg,o){const now=M.t2();const chin=ATT(def,'chin');def.hh=(def.hh||[]).filter(t=>now-t<KO.comboWindow);def.hh.push(now);def.lastHeadT=now;
    const combo=Math.min(KO.comboMax,1+KO.comboStep*(def.hh.length-1));const imp=dmg*(o.counter?KO.counterMul:1)*(o.chin?KO.cleanMul:1)*(def.state==='ground'?KO.groundMul:1);
    const ease=KO.aiDiffEase&&def.ai?clamp(1.25-.35*M.diff,.6,1.05):1;
    const add=imp*combo*(1.25-chin*.5)*KO.concussMul*ease;def.conc=(def.conc||0)+add;def.concPerm=(def.concPerm||0)+add*KO.permShare;
    def._ko={imp:+imp.toFixed(1),combo:+combo.toFixed(2),r:+this.ratio(def).toFixed(2)};
    if(def.state!=='stand')return null;
    if((o.chin||o.counter)&&imp>=KO.flash.minImpact){const ft=KO.flash.base+chin*KO.flash.chin-this.ratio(def)*KO.flash.concBonus;const pr=clamp((imp-ft)/KO.flash.slope,0,KO.flash.max)*ease;if(Math.random()<pr)return'flash'}
    const r=this.ratio(def);if(r>=KO.koAt)return'ko';
    if(r>=KO.kdAt){const K=KO.koOnKd;const p=clamp((r-KO.kdAt)/(KO.koAt-KO.kdAt),0,1)*K.over+clamp((imp-K.impFrom)/K.impSpan,0,K.impMax)+((def.kdRd||0)>0?K.secondKd:0);return Math.random()<p?'ko':'kd'}if(r>=KO.rockAt&&!(def.rock>0))return'rock';return null}
};
/* ---------- applyDmg (body/leg logic kept from the original engine) ---------- */
Match.prototype.applyDmg=function(att,def,o){const{zone,kind}=o;let dmg=o.dmg;const rs=this.rs[att.side];rs.dmg+=dmg;const now=this.t2();def.recent.push(now);def.recent=def.recent.filter(t=>now-t<3.5);
  if(!o.blocked){rs.edmg=(rs.edmg||0)+dmg*(zone==='head'?1:zone==='body'?.8:.62)*(o.counter?1.15:1);RefereeAI.onDamage(this,att,def,dmg,zone)}
  if(zone==='head'){def.hp.head=Math.max(0,def.hp.head-dmg*(1.25-ATT(def,'chin')*.55));def.stun+=dmg*(2.6-ATT(def,'chin')*1.6)*(o.blocked?.25:1);if(!o.blocked)this.cutCheck(att,def,dmg,o)}
  else if(zone==='body'){def.hp.body=Math.max(0,def.hp.body-dmg*(1.15-ATT(def,'bodyT')*.45));def.sta-=dmg*(o.blocked?.6:1.6);if(!o.blocked&&def.state==='stand'&&def.hp.body<30&&dmg>7&&Math.random()<.35+(30-def.hp.body)/60){this.knock(def,att,def.hp.body<8,'body');return}}
  else{def.hp.legs=Math.max(0,def.hp.legs-dmg*(1.1-ATT(def,'strength')*.3));def.sta-=dmg*.4;if(def.state==='stand'&&def.hp.legs<25&&dmg>5&&Math.random()<.25+(25-def.hp.legs)/50){this.knock(def,att,false,'leg');return}if(def.hp.legs<=2){this.finish(att,'TKO','레그킥');return}}
  if(o.blocked||zone!=='head')return;
  const out=StunModel.hit(this,att,def,dmg,o);
  if(out==='flash'){this.ev(`⚡ ${att.name} 일격! 원펀치 KO`);this.knock(def,att,true,'head');return}
  if(out==='ko'){this.knock(def,att,true,'head');return}
  if(out==='kd'){this.knock(def,att,false,'head');def.conc*=1-KO.kdReset;def.kdRd=(def.kdRd||0)+1;return}
  if(out==='rock'){def.rock=KO.rockTime[0]+Math.random()*(KO.rockTime[1]-KO.rockTime[0]);this.ev(o.chin?`😵 ${def.name} 턱에 맞고 그로기!`:`😵 ${def.name} 휘청입니다!`);SFXI.play('roar',.9)}
  if(def.hp.head<=0)RefereeAI.stop(this,att,def,def.state==='ground'?'그라운드 앤 파운드':'펀치 연타')};
/* knockdown counter for scoring; concussion carried over */
{const kn=Match.prototype.knock;Match.prototype.knock=function(def,att,ko,kind){const was=!!def.down;const r=kn.call(this,def,att,ko,kind);if(!was&&def.down){RefereeAI.onKnock(this,att,def,ko)}return r}}
/* ---------- RefereeAI ---------- */
const RefereeAI={
  onDamage(M,att,def,dmg,zone){if(M.phase!=='fight'||M.stopping)return;const g=M.g;const bottom=g&&g.type==='ground'&&g.bot===def;const hurt=StunModel.ratio(def);const trouble=def.rock>0||!!def.down||bottom&&((g.pos==='mount'||g.pos==='back')&&hurt>REF.groundHurt||hurt>REF.groundHurt*1.5||def.hp.head<15);
    if(!trouble)return;const defend=this.defending(M,def);def.dng=(def.dng||0)+dmg*(zone==='head'?1:.5)*(defend?REF.defendMul:1);def.dngT=M.t2();
    const lim=REF.stopAt*(1-REF.stopHeart/2+ATT(def,'heart')*REF.stopHeart)*(def.rock>0&&def.state==='stand'?.85:1)*(bottom?REF.groundStopMul:1);
    if(def.dng>lim)this.stop(M,att,def,bottom||def.down?'그라운드 앤 파운드':'펀치 연타')},
  defending(M,f){const now=M.t2();if(now-(f.lastThrowT||-9)<REF.defendT)return true;if(f.state==='stand'&&f.guard&&f.gst>0&&!(f.gBreak>0))return true;const g=M.g;if(g&&g.type==='ground'&&(g.trans&&g.trans.f===f||g.sub&&g.sub.att===f))return true;return false},
  tick(M,dt){for(const f of M.f){if(f.dng>0)f.dng=Math.max(0,f.dng-dt*REF.decay)}},
  onKnock(M,att,def,ko){def.dng=(def.dng||0)+(ko?0:6)},
  stop(M,att,def,how){if(M.stopping||M.phase!=='fight')return;M.stopping={att,def,t:0,detail:`${how} (레프리 스톱)`};M.ev(`🛑 레프리가 뛰어듭니다!`);M.ref.wave=REF.waveT+REF.stopDelay},
  /* where the referee wants to stand */
  target(M){const[a,b]=M.f,R=M.stage.R,g=M.g,lim=R-REF.wallMargin;
    if(M.stopping){const s=M.stopping;return clamp((s.def.x*2+s.att.x)/3,-lim,lim)}
    if(M.phase==='break'||M.phase==='intro')return 0;
    if(g&&g.type==='ground'){const c=g.ax||((a.x+b.x)/2);const side=c>0?-1:1;let t=c+side*REF.groundDist;if(Math.abs(t)>lim)t=c-side*REF.groundDist;return clamp(t,-lim,lim)}
    const mid=(a.x+b.x)/2,span=Math.abs(a.x-b.x);const dist=clamp(span/2+REF.dist.pad,REF.dist.min,REF.dist.max);
    let side=mid>0?-1:1;let t=mid+side*dist;if(Math.abs(t)>lim){side=-side;t=mid+side*dist}
    /* never stand between the fighters or inside striking range */
    const lo=Math.min(a.x,b.x)-REF.dist.min*.8,hi=Math.max(a.x,b.x)+REF.dist.min*.8;if(t>lo&&t<hi)t=side<0?lo:hi;return clamp(t,-lim,lim)}
};
/* referee update replaces the original (ceremony branch kept) */
{const ur=Match.prototype.updRef;Match.prototype.updRef=function(dt){if(this.cer)return ur.call(this,dt);const r=this.ref;
  const tgt=RefereeAI.target(this);r._dbgT=tgt;const rush=!!this.stopping||r.wave>0;r.A={footwork:14,speed:rush?20:12};
  const gap=tgt-r.x;r.mvIn=Math.abs(gap)<.06?0:clamp(gap*1.6,-1,1)*(rush?REF.rush:REF.speed);const mid=(this.f[0].x+this.f[1].x)/2;r.d=Math.sign(mid-r.x)||1;
  r.update(dt,{checkHit(){},onMiss(){}});r.x=clamp(r.x,-this.stage.R,this.stage.R);
  r._dbgPath=[r.x];{let x=r.x;for(let i=0;i<12;i++){x+=clamp((tgt-x)*1.6,-1,1)*.08;r._dbgPath.push(x)}}
  /* poses: watching crouch, waving off, arms raised for the winner */
  if(r.wave>0){r.wave-=dt;const w=Math.sin(this.stage.t*14)*.35;r.gpose=poseCopy(Object.assign({},BASE_POSE,{lean:.18,chest:.05,head:.05,la_s:1.55+w,la_e:.15,ra_s:1.45-w,ra_e:.15,ll_h:.25,ll_k:.25,rl_h:-.2,rl_k:.25}))}
  else if(this.phase==='end'&&this.winner){r.gpose=poseCopy(Object.assign({},BASE_POSE,{la_s:2.9,la_e:.2,ra_s:.2,ra_e:.3,lean:0,head:0}))}
  else if(this.phase==='break'){r.gpose=poseCopy(Object.assign({},BASE_POSE,{lean:.02,la_s:1.5,la_e:.1,ra_s:-1.4,ra_e:.1}))}
  else{const g=this.g;r.gpose=poseCopy(Object.assign({},BASE_POSE,g&&g.type==='ground'?{lean:.45,chest:.2,head:-.15,ll_h:.7,ll_k:1.1,rl_h:.2,rl_k:1,la_s:.5,la_e:.6,ra_s:.4,ra_e:.6}:{lean:.12,chest:.05,head:.02,la_s:.45,la_e:.9,ra_s:.35,ra_e:1,ll_h:.22,ll_k:.3,rl_h:-.2,rl_k:.32}))}
  /* bell: walk the fighters back toward their corners */
  if(this.phase==='break'){for(const f of this.f){if(f.state!=='stand')continue;const want=f.side?1.15:-1.15;f.x+=clamp(want-f.x,-dt*REF.separateSpeed,dt*REF.separateSpeed)}}
  /* stoppage in progress */
  const S=this.stopping;if(S&&this.phase==='fight'){S.t+=dt;if(S.t>=REF.stopDelay||Math.abs(r.x-S.def.x)<.45){this.stopping=null;S.att.act=null;S.att.queue=[];this.finish(S.att,'TKO',S.detail,.9)}}}}
/* ---------- per-step bookkeeping: concussion decay, danger decay, aggression, octagon control ---------- */
{const st=Match.prototype.step;Match.prototype.step=function(dt){st.call(this,dt);if(this.phase!=='fight')return;const now=this.t2();
  for(const f of this.f)StunModel.tick(f,dt,now);RefereeAI.tick(this,dt);
  const[a,b]=this.f;if(a.state==='stand'&&b.state==='stand'&&!this.g){const R=this.stage.R;
    for(const f of this.f){const o=f.opp,rs=this.rs[f.side];
      if(f.vx*f.d>.25&&o.vx*o.d<.05)rs.agg=(rs.agg||0)+dt;                                         // walking the opponent down
      if(Math.abs(o.x)>R*.6&&Math.abs(f.x)<Math.abs(o.x)-.3)rs.oc=(rs.oc||0)+dt}}}}               // owns the centre, opponent near the fence
/* throws count as "fighting back" for the referee */
{const ot=Match.prototype.onThrow;Match.prototype.onThrow=function(f,key){f.lastThrowT=this.t2();return ot.call(this,f,key)}}
{const gs=Match.prototype.gStrike;Match.prototype.gStrike=function(f,kind,hand){f.lastThrowT=this.t2();return gs.call(this,f,kind,hand)}}
/* near-submissions count for grappling scoring */
{const stk=Match.prototype.subTick;Match.prototype.subTick=function(dt){const s=this.g&&this.g.sub;if(s)s.p+=dt*(GRAP.subBias+(StunModel.ratio(s.def)>GRAP.subHurtFrom?GRAP.subHurtBonus:0));if(s&&s.p>.72&&!s.near){s.near=1;this.rs[s.att.side].subNear=(this.rs[s.att.side].subNear||0)+1}return stk.call(this,dt)}}
/* round transitions: concussion partially recovers between rounds; swollen-eye doctor check */
{const nr=Match.prototype.nextRound;Match.prototype.nextRound=function(){for(const f of this.f){f.conc=Math.max(f.concPerm||0,(f.conc||0)*KO.roundRecover);f.dng=0;f.hh=[];f.kdRd=0}this.ref.wave=0;return nr.call(this)}}
{const er=Match.prototype.endRound;Match.prototype.endRound=function(){if(this.phase!=='fight')return;this.stopping=null;
  if(this.round<this.rules.rounds){for(const f of this.f){if(f.body.swell>=DOC.swellStop&&Math.random()<DOC.swellChance){this.phase='break';SFXI.play('bell');this.scoreRound();this.rsAll.push(this.rs);this.ev(`🩺 닥터 체크: ${f.name}의 눈이 감겼습니다`);this.announce('DOCTOR','눈 부상으로 경기 중단',1.6);this.phase='fight';this.finish(f.opp,'TKO','닥터 스톱 (붓기)',.4);return}}}
  return er.call(this)}}
/* doctor: probabilistic decision instead of an automatic stop */
Match.prototype.doctor=function(f){this.ev(`🩺 닥터 체크: ${f.name}의 출혈`);this.announce('DOCTOR','컷 상태를 확인합니다',1.4);const sev=f.body.cuts.reduce((s,c)=>s+c.sev,0);
  const p=clamp(DOC.base+sev*DOC.perSev+(f.body.swell>1.4?.15:0)+(this.round>=this.rules.rounds?-.1:0),.05,.95);const stop=Math.random()<p;this.phase='break';this.ref.wave=1.2;
  setTimeout(()=>{if(this.phase==='end')return;this.phase='fight';if(stop){this.finish(f.opp,'TKO','닥터 스톱 (컷)',.4)}else{this.docCheck=0;f.bleed=55;f.body.cuts.forEach(c=>c.sev*=.7);this.ev('✅ 닥터: 경기 속행!');this.announce('계속!','',1)}},1500)};
/* ---------- ScoringEngine ---------- */
const ScoringEngine={
  scores(rs,J){const W=JUDGE.w;return[0,1].map(i=>{const r=rs[i];const st=(r.edmg||0)*W.edmg+r.sigL*W.sig+r.kd*W.kd;const gr=r.td*W.td+r.ctrl*W.ctrl+(r.subNear||0)*W.subNear+r.sub*W.subAtt;
      return{eff:st*J.strike+gr*J.grap,st,gr,agg:(r.agg||0)*W.agg+r.thr*.04,oc:(r.oc||0)*W.oc}})},
  judgeRound(rs,J){const S=this.scores(rs,J);const tot=S[0].eff+S[1].eff+1;const n=()=>(Math.random()+Math.random()+Math.random()-1.5)*JUDGE.noise*tot;
    let d=S[0].eff-S[1].eff+n();let basis='impact';
    if(Math.abs(d)/tot<JUDGE.close){const sec=(S[0].agg-S[1].agg)+(S[0].oc-S[1].oc)*.6;if(Math.abs(sec)>.2){d=sec;basis='aggression/control'}}
    const m=Math.abs(S[0].eff-S[1].eff)/tot;const w=d>0?0:1,l=1-w;const kdd=rs[w].kd-rs[l].kd;
    if(Math.abs(d)/tot<JUDGE.tenTen.margin&&basis==='impact'&&Math.random()<JUDGE.tenTen.chance)return{card:[10,10],basis:'even'};
    /* 10-8 needs impact + dominance: a lopsided margin with real volume, or a knockdown with clear control of the round */
    const big=S[w].eff>=JUDGE.tenEight.minEff;let lose=9;if(kdd>=JUDGE.tenSeven.kdDiff||m>JUDGE.tenSeven.margin&&kdd>=2)lose=7;else if(m>JUDGE.tenEight.margin&&big||kdd>=2||kdd>=1&&m>JUDGE.tenEight.kdMargin)lose=8;
    const card=w===0?[10,lose]:[lose,10];return{card,basis,m:+m.toFixed(2)}}
};
Match.prototype.scoreRound=function(){this.rbd=this.rbd||[];const notes=[];JUDGE.judges.forEach((J,j)=>{const r=ScoringEngine.judgeRound(this.rs,J);this.cards[j].push(r.card);notes.push(r)});
  this.rbd.push({round:this.round,notes,rs:this.rs.map(x=>({sig:x.sigL,edmg:Math.round(x.edmg||0),kd:x.kd,td:x.td,ctrl:Math.round(x.ctrl),agg:Math.round(x.agg||0),oc:Math.round(x.oc||0)}))})};
/* result screen: round-by-round cards per judge */
{const sr=Match.prototype.showResult;Match.prototype.showResult=function(){sr.call(this);const r=this.result;if(!this.rbd||!this.rbd.length||r.extra&&r.extra.whole)return;
  const ov=this.H.ov.querySelector('.ovb');const btn=ov&&ov.querySelector('[data-c]');if(!btn)return;const nm=JUDGE.judges.map(j=>j.n);
  const rows=this.rbd.map(b=>`<tr><th>R${b.round}</th>${b.notes.map(n=>`<td title="${n.basis}">${n.card[0]}-${n.card[1]}</td>`).join('')}<td class="sm" style="color:#aaa">유효타 ${b.rs[0].sig}:${b.rs[1].sig} · 다운 ${b.rs[0].kd}:${b.rs[1].kd} · TD ${b.rs[0].td}:${b.rs[1].td}</td></tr>`).join('');
  btn.insertAdjacentHTML('beforebegin',`<table class="rst rbd" style="font-size:12px"><tr><th></th>${nm.map(n=>`<th>${n}</th>`).join('')}<th></th></tr>${rows}</table>`)}}
