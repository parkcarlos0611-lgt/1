/* ===== CareerManager.js : injury model, matchmaker, coaching staff, scheduler / fight-card UI =====
   InjuryModel — replaces the three separate injury rolls (training, hard camp, fight):
     weekly training risk = base × fatigue curve × plan load × age × conditioning × S&C coach,
     severity tiers (minor / moderate / serious) shift with fatigue; a minor knock far enough
     before a fight no longer cancels it; fight injuries scale with damage taken and finish type.
   Matchmaker — scores every available opponent on rank distance (aim slightly up when on a
     run), ELO and OVR closeness, form (winners meet winners), style clash (striker vs grappler
     sells), rematch avoidance, rivalries and star power, then picks with a little randomness.
     Each pick carries a short "why" shown on the offer card. Also builds whole event cards.
   Staff — five coaching roles × three levels with weekly salaries:
     striking / grappling (training quality), S&C (conditioning gains, injury risk),
     nutritionist (weight cut, fatigue recovery), cutman (skin in fights).
   Scheduler tab — 10-week planner (per-week training plan, fight/camp/injury/contract markers,
     projected fatigue and injury risk per week, one-click periodisation), staff management,
     matchmaking shortlist with "request this fight", and the upcoming event's fight card. */
const INJ=tuneSection('injury',{
  base:.008,                        // weekly risk at fatigue 60, average conditioning, age 28
  fatigue:[[0,.06],[40,.12],[55,.35],[65,.9],[75,1.9],[90,3.6],[100,5]],
  ageFrom:31, agePerYear:.07, condWeight:.45, sncPerLevel:.12, restPlanMul:.15,
  severity:{minor:[.62,1,2],moderate:[.3,3,5],serious:[.08,6,10]}, fatigueShift:.006,
  minorKeepsFight:true,
  campBase:3, campPerFatigue:.32, campMax:35,      // hard-camp injury % (was 8 + fat × 0.5, max 55)
  fight:{from:125,span:280,max:.3,koLossBonus:.08}
});
const MM=tuneSection('matchmaking',{
  wRank:1, wElo:.9, wOvr:.6, wForm:.8, wStyle:.7, wRival:2.2, wStar:.5, rematchPenalty:3.5, recentN:3, metBefore:1.6, noise:.9,
  upWhenStreak:2, styleGap:6
});
const STAFF_ROLES={
  strike:{n:'타격 코치',ic:'🥊',d:'타격 훈련 효율',sal:[350,900,2200]},
  grap:{n:'그래플링 코치',ic:'🤼',d:'레슬링·주짓수 훈련 효율',sal:[350,900,2200]},
  snc:{n:'S&C 코치',ic:'🏋️',d:'체력 훈련 효율 · 부상 위험↓',sal:[300,800,1900]},
  nutri:{n:'영양사',ic:'🥗',d:'감량 능력↑ · 피로 회복↑',sal:[200,550,1300]},
  cut:{n:'컷맨',ic:'🩹',d:'경기 중 출혈↓ (피부 내구 +)',sal:[100,300,800]}
};
const STAFF_LV=['지역','유명','엘리트'];
/* ---------- helpers ---------- */
function styleOf(A){const g=grpOvr(A).g;const d=g[0][1]-g[1][1];return d>MM.styleGap?'striker':d<-MM.styleGap?'grappler':'allround'}
const STYLE_N={striker:'타격가',grappler:'그래플러',allround:'올라운더'};
function lerpTable(T,x){for(let i=1;i<T.length;i++){if(x<=T[i][0]){const[a,va]=T[i-1],[b,vb]=T[i];return va+(vb-va)*(x-a)/(b-a)}}return T[T.length-1][1]}
function staffLv(P,r){return(P.staff&&P.staff[r])||0}
function infl(){return 1+((GG&&GG.y||2005)-2005)*.02}
/* ---------- InjuryModel ---------- */
const InjuryModel={
  weeklyRisk(P,planKey,fat,age){const plan=PLANS[planKey]||PLANS.bal;if(planKey==='rest')return INJ.base*INJ.restPlanMul*lerpTable(INJ.fatigue,fat);
    const load=clamp(.6+plan[2]/12,.4,1.6);const ag=1+Math.max(0,age-INJ.ageFrom)*INJ.agePerYear;
    const cond=1+INJ.condWeight*(.5-((P.A.cardio+P.A.recovery+P.A.strength)/60));const snc=1-staffLv(P,'snc')*INJ.sncPerLevel;
    return INJ.base*lerpTable(INJ.fatigue,fat)*load*ag*cond*snc},
  roll(fat){const S=INJ.severity;const sh=Math.max(0,fat-60)*INJ.fatigueShift;const w={minor:S.minor[0]-sh,moderate:S.moderate[0]+sh*.6,serious:S.serious[0]+sh*.4};
    const r=Math.random()*(w.minor+w.moderate+w.serious);const tier=r<w.minor?'minor':r<w.minor+w.moderate?'moderate':'serious';const[,a,b]=S[tier];
    const name=pick({minor:['손목 염좌','발가락 타박상','허벅지 타박','목 결림','팔꿈치 찰과상'],moderate:['무릎 염좌','갈비뼈 타박상','어깨 염좌','허리 통증','발목 염좌'],serious:['손 골절','어깨 탈구','무릎 인대 부분 파열','안와 골절']}[tier]);
    return{d:name,wk:a+Math.floor(Math.random()*(b-a+1)),tier}},
  weekly(C,msgs){const G=C.G,P=G.P;if(P.inj)return;const p=this.weeklyRisk(P,P.plan,P.fat,C.age());P._risk=p;if(Math.random()>=p)return;
    const inj=this.roll(P.fat);P.inj=inj;msgs.push(`🚑 훈련 중 부상: ${inj.d} (${inj.wk}주)`);
    if(P.next){const left=P.next.wk-absW(G.y,G.w);const keep=INJ.minorKeepsFight&&inj.tier==='minor'&&left>inj.wk+1;
      if(keep)msgs.push(`🩹 가벼운 부상 — ${dn(G.F[P.next.opp]||{n:'상대'})}전은 그대로 진행`);
      else if(left<inj.wk+1){msgs.push(`❌ 부상으로 ${dn(G.F[P.next.opp]||{n:'상대'})}전 취소`);P.next=null;P.hype-=10}}},
  campRisk(P){return Math.round(clamp(INJ.campBase+(P.fat||0)*INJ.campPerFatigue*(1-staffLv(P,'snc')*INJ.sncPerLevel),2,INJ.campMax))},
  fight(C,res,dmg,won){const P=C.G.P,F=INJ.fight;const ko=!won&&(res.method==='KO'||res.method==='TKO');const p=clamp((dmg-F.from)/F.span,0,F.max)+(ko?F.koLossBonus:0);
    if(Math.random()<p){const inj=pick([['코뼈 골절',5],['안와 골절',7],['손 골절',6],['무릎 인대',9],['갈비뼈 골절',5],['눈썹 봉합',3],['정강이 타박',2]]);P.inj={d:inj[0],wk:inj[1],tier:inj[1]>5?'serious':'moderate'};return P.inj}return null}
};
/* hook the core: training injuries, fight injuries, hard-camp risk */
Career.prototype.trainInjury=function(msgs){InjuryModel.weekly(this,msgs)};
Career.prototype.fightInjury=function(res,dmg,won){return InjuryModel.fight(this,res,dmg,won)};
campHurtRisk=function(P){return InjuryModel.campRisk(P)};
/* ---------- Matchmaker ---------- */
const Matchmaker={
  profile(f){if(f.id==='P'||f===GG.P){const P=GG.P;return{elo:P.elo||1500,ovr:grpOvr(P.A).tot,style:styleOf(P.A),streak:P.streak||0}}return{elo:f.elo||1500,ovr:grpOvr(f.A).tot,style:styleOf(f.A),streak:f.streak||0}},
  candidates(org,wc,o){const G=GG,W=WW,P=G.P;o=o||{};const R=W.rank(org,wc);const L=R.list.filter(f=>f.id!=='P'&&!f.inj&&f.act!==false);if(!L.length)return[];
    const pr=W.pRank();const myIdx=pr!=null&&pr>0?pr-1:L.length;const me=this.profile({id:'P'});
    const target=me.streak>=MM.upWhenStreak?myIdx-2:me.streak<0?myIdx+1:myIdx-1;
    const recent=P.hist.slice(0,MM.recentN).map(h=>h.opp);
    return L.map((f,i)=>{const p=this.profile(f);const why=[];let s=0;
      s-=MM.wRank*Math.abs(i-target)*.5;
      s-=MM.wElo*Math.abs(p.elo-me.elo)/120;s-=MM.wOvr*Math.abs(p.ovr-me.ovr)/6;
      if(Math.sign(p.streak)===Math.sign(me.streak)&&me.streak!==0){const k=Math.min(3,Math.abs(p.streak),Math.abs(me.streak))/3;s+=MM.wForm*k;if(k>.3)why.push(me.streak>0?'연승자끼리':'반등이 필요한 둘')}
      if(p.style!==me.style&&p.style!=='allround'&&me.style!=='allround'){s+=MM.wStyle;why.push(`${STYLE_N[me.style]} vs ${STYLE_N[p.style]}`)}
      if(P.rivals&&P.rivals[f.id]){s+=MM.wRival*Math.min(2,P.rivals[f.id]/3);why.push('라이벌')}
      if(f.real){s+=MM.wStar*.6;if(f.r>80)why.push('스타 매치')}
      const met=P.hist.filter(h=>h.opp===f.id).length;if(met){s-=MM.metBefore*met+(recent.includes(f.id)?MM.rematchPenalty:0);why.push(met>1?`${met+1}차전`:'재대결')}
      const rk=i+1;why.unshift(pr?`랭킹 #${rk} (나 #${pr})`:`랭킹 #${rk}`);if(Math.abs(p.ovr-me.ovr)<=4)why.push('실력 비슷');
      return{f,score:s,noise:Math.random()*MM.noise,why,rank:rk,ovr:p.ovr,elo:Math.round(p.elo),style:p.style}}).sort((a,b)=>b.score+b.noise-(a.score+a.noise))},
  pickFor(org,o){const G=GG,P=G.P;const R=WW.rank(org,P.wc);if(o&&o.title&&R.champ&&R.champ.id!=='P')return{f:R.champ,why:['타이틀전']};const c=this.candidates(org,P.wc,o);return c[0]||null},
  /* NPC pairing for event cards: closest ranks with the same scoring, minus the player-specific parts */
  pairNPC(org,wc,used){const L=WW.rank(org,wc).list.filter(f=>f.id!=='P'&&!f.inj&&!used.has(f.id));if(L.length<2)return null;
    let best=null;for(let i=0;i<Math.min(L.length,12);i++)for(let j=i+1;j<Math.min(L.length,i+4);j++){const a=L[i],b=L[j];const pa=this.profile(a),pb=this.profile(b);
      const s=-Math.abs(i-j)*.6-Math.abs(pa.elo-pb.elo)/150-Math.abs(pa.ovr-pb.ovr)/8+(pa.style!==pb.style?.5:0)+(a.real&&b.real?.6:0)+Math.random()*.8-i*.08;if(!best||s>best.s)best={a,b,s,ra:i+1,rb:j+1}}
    if(best){used.add(best.a.id);used.add(best.b.id)}return best}
};
Career.prototype.pickOpp=function(org,o){const r=Matchmaker.pickFor(org,o);this._lastWhy=r?r.why:null;return r?r.f:null};
{const fo=Career.prototype.fightOffer;Career.prototype.fightOffer=function(org,o){this._lastWhy=null;const of=fo.call(this,org,o);if(of){of.why=of.title?['타이틀전']:(this._lastWhy||[]).slice(0,4)}return of}}
/* ---------- staff effects ---------- */
{const tr=Career.prototype.train;Career.prototype.train=function(gym,plan){const P=this.G.P;const q=gym[4];const k=r=>1+staffLv(P,r)*.14;const g2=gym.slice();g2[4]=[q[0]*k('strike'),q[1]*k('grap'),q[2]*k('snc')];return tr.call(this,g2,plan)}}
{const wk=Career.prototype.week;Career.prototype.week=function(){const G=this.G,P=G.P;
    /* scheduler: the plan set for the coming week takes effect */
    const nxt=absW(G.y,G.w)+1;if(P.sched&&P.sched[nxt]){P.plan=P.sched[nxt]}
    const r=wk.call(this);
    let sal=0;for(const role in P.staff||{}){const lv=P.staff[role];if(lv>0)sal+=STAFF_ROLES[role].sal[lv-1]*infl()}if(sal){P.money-=sal;P.stats.spend+=sal}
    const nl=staffLv(P,'nutri');if(nl){P.A.weightCut=Math.min(18,(P.A.weightCut||10)+.012*nl);P.fat=clamp(P.fat-nl*.8,0,100)}
    if(P.sched){const now=absW(G.y,G.w);for(const k in P.sched)if(+k<=now)delete P.sched[k]}
    return r}}
{const fc=Career.prototype.fightCfg;Career.prototype.fightCfg=function(nx,cut){const c=fc.call(this,nx,cut);const cl=staffLv(this.G.P,'cut');if(cl)c.red.A.skin=clamp((c.red.A.skin||10)+cl*1.2,1,20);return c}}
/* ---------- scheduler projection ---------- */
function planFatDelta(P,key){const plan=PLANS[key]||PLANS.bal;return plan[2]-(staffLv(P,'nutri')*.8)}
function projectWeeks(n){const G=GG,P=G.P;const now=absW(G.y,G.w);let fat=P.fat;const out=[];let inj=P.inj?P.inj.wk:0;
  for(let i=1;i<=n;i++){const w=now+i;const key=(P.sched&&P.sched[w])||P.plan;if(inj>0){inj--;fat=clamp(fat-10,0,100)}else fat=clamp(fat+planFatDelta(P,key),0,100);
    const risk=inj>0?0:InjuryModel.weeklyRisk(P,key,fat,G.y-P.by);const y=G.y+Math.floor((G.w+i-1)/52),wk=((G.w+i-1)%52)+1;
    const tags=[];if(P.next){if(w===P.next.wk)tags.push(['fight','🥊 경기']);else if(w>=P.next.wk-8&&w<P.next.wk)tags.push(['camp',`🏕️ 캠프 D-${P.next.wk-w}`])}
    if(inj>0)tags.push(['inj','🚑 부상']);if(P.contract&&i===1)tags.push(['ctr',`📜 ${P.contract.left}경기 남음`]);
    out.push({w,y,wk,key,fat,risk,tags})}return out}
function autoPlan(){const G=GG,P=G.P;const now=absW(G.y,G.w);P.sched={};let fat=P.fat;const camp=P.next&&P.next.camp;const focusPlan=camp?({strike:'str',wrestle:'wr',bjj:'gr',cond:'cond',counter:'spar'})[camp.focus]:'spar';
  for(let i=1;i<=10;i++){const w=now+i;let k='bal';
    /* periodisation: build in camp, taper the last 3 weeks, rest after the fight; a rest week whenever projected fatigue passes 62 */
    if(P.next){const d=P.next.wk-w;if(d<0&&d>=-2)k='rest';else if(d>=0&&d<=1)k='rest';else if(fat>62)k='rest';else if(d<=3)k='cond';else if(d<=8)k=focusPlan;else k=fat>50?'rest':'bal'}
    else k=fat>58?'rest':fat>40?'bal':i%3===0?'spar':'bal';
    P.sched[w]=k;fat=clamp(fat+planFatDelta(P,k),0,100)}}
/* ---------- scheduler tab ---------- */
(function(){const css=document.createElement('style');css.textContent=`
.schw{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:6px}
.swk{background:var(--bg3);border:1px solid var(--ln);border-radius:9px;padding:7px;font-size:11.5px;display:flex;flex-direction:column;gap:4px;min-height:132px}
.swk.fight{border-color:var(--red);box-shadow:0 0 0 1px var(--red) inset}.swk.camp{border-color:#6b4a12}.swk.inj{opacity:.7}
.swk b{font-size:12px}.swk select{padding:4px 6px;font-size:11.5px}.swk .tg{display:flex;flex-wrap:wrap;gap:3px}.swk .tg span{background:#0006;border-radius:5px;padding:1px 5px;font-size:10.5px}
.rk2{height:5px;border-radius:3px;background:#222;overflow:hidden}.rk2 i{display:block;height:100%}
.stf{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}.stc{background:var(--bg3);border:1px solid var(--ln);border-radius:9px;padding:10px;display:flex;flex-direction:column;gap:5px}
.stc .row{flex-wrap:wrap}.stc .row .btn{margin:2px}.stc .lv{display:flex;gap:3px}.stc .lv i{flex:1;height:6px;border-radius:3px;background:#2a2e38}.stc .lv i.on{background:var(--gold)}
.mmc{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--ln);font-size:13px}.mmc small{color:var(--mu)}.mmc .why{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px}.mmc .why span{font-size:11px;background:#1f5fd622;border:1px solid #1f5fd655;border-radius:999px;padding:1px 7px}
.fcard .bout{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #ffffff0d;font-size:13px}.fcard .bout .l{text-align:right}.fcard .bout.me{background:#d4141b1c;border-radius:6px}.fcard h4{margin:10px 0 2px;color:var(--gold);font-size:12px;letter-spacing:.12em}
.why2{font-size:11px;color:#9fc4ff}`;document.head.appendChild(css)})();
function tabSched(){const G=GG,P=G.P,el=$('#tabc');P.staff=P.staff||{};const weeks=projectWeeks(10);const cur=InjuryModel.weeklyRisk(P,P.plan,P.fat,CC.age());
  const rc=r=>r<.01?'#2fd47a':r<.025?'#e8c43a':'#e8473a';
  const sched=weeks.map(x=>`<div class="swk ${x.tags.map(t=>t[0]).join(' ')}"><b>${x.y}·${x.wk}주</b><div class="tg">${x.tags.map(t=>`<span>${t[1]}</span>`).join('')}</div>
    <select data-wk="${x.w}" ${x.tags.some(t=>t[0]==='inj')?'disabled':''}>${Object.entries(PLANS).map(([k,p])=>`<option value="${k}" ${x.key===k?'selected':''}>${p[0]}</option>`).join('')}</select>
    <span class="mu">피로 ${Math.round(x.fat)}</span><div class="rk2"><i style="width:${Math.min(100,x.risk*100/.06)}%;background:${rc(x.risk)}"></i></div><span style="color:${rc(x.risk)}">부상 ${(x.risk*100).toFixed(1)}%</span></div>`).join('');
  const staff=Object.entries(STAFF_ROLES).map(([k,r])=>{const lv=staffLv(P,k);const next=lv<3?Math.round(r.sal[lv]*infl()):null;return`<div class="stc"><b>${r.ic} ${r.n} ${lv?`<small class="gold">${STAFF_LV[lv-1]}</small>`:'<small class="mu">없음</small>'}</b><span class="sm mu">${r.d}</span><div class="lv">${[1,2,3].map(i=>`<i class="${i<=lv?'on':''}"></i>`).join('')}</div>
    <span class="sm">${lv?`주급 $${fmtM(r.sal[lv-1]*infl())}`:''}</span><div class="row">${next?`<button class="btn sm" data-hire="${k}">${lv?'업그레이드':'고용'} $${fmtM(next)}/주</button>`:''}${lv?`<button class="btn sm ghost" data-fire="${k}">해고</button>`:''}</div></div>`}).join('');
  const sal=Object.entries(P.staff).reduce((s,[k,lv])=>s+(lv?STAFF_ROLES[k].sal[lv-1]*infl():0),0);
  let mm='<p class="mu sm">소속 단체가 없어 매치메이킹 후보가 없습니다.</p>';if(P.org){const C=Matchmaker.candidates(P.org,P.wc).slice(0,5);
    mm=C.map((c,i)=>`<div class="mmc"><div><b>${flag(c.f.nat)} ${dn(c.f)}</b> <small>${c.f.rec.w}-${c.f.rec.l} · OVR ${c.ovr} · ELO ${c.elo} · ${STYLE_N[c.style]}</small><div class="why">${c.why.slice(0,4).map(w=>`<span>${esc2(w)}</span>`).join('')}</div></div><div><button class="btn sm ghost" data-prof="${c.f.id}">분석</button>${!P.next&&!P.inj&&P.contract?`<button class="btn sm" data-req="${c.f.id}">요청</button>`:''}</div></div>`).join('')||'<p class="mu sm">후보 없음</p>'}
  let card='';if(P.next){const nx=P.next;if(!nx.card)nx.card=buildCard(nx);const o=G.F[nx.opp];
    const bout=(b,me)=>`<div class="bout ${me?'me':''}"><div class="l">${b.a}</div><div class="mu sm">${b.wc}${b.t?' 👑':''}</div><div>${b.b}</div></div>`;
    card=`<div class="card fcard"><h3>📋 ${esc2(nx.ev)} 대진표</h3>${nx.card.map(s=>`<h4>${s.h}</h4>${s.b.map(b=>bout(b,b.me)).join('')}`).join('')}<p class="sm mu">매치 근거: ${(nx.why||[]).map(esc2).join(' · ')||'-'}</p></div>`}
  el.innerHTML=`${card}<div class="card"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h3 style="margin:0">📅 10주 스케줄러</h3><div class="row"><button class="btn sm gold" data-auto>⚙️ 자동 주기화</button><button class="btn sm ghost" data-clear>초기화</button></div></div>
    <p class="sm mu">주마다 훈련을 지정하면 그 주에 자동 적용돼요. 피로도와 부상 위험은 계획대로 진행했을 때의 예상치입니다. 지금 주간 부상 위험 <b style="color:${rc(cur)}">${(cur*100).toFixed(1)}%</b> (피로 ${Math.round(P.fat)} · S&C ${STAFF_LV[staffLv(P,'snc')-1]||'없음'})</p><div class="schw">${sched}</div></div>
   <div class="card"><h3>👥 코치진 <small class="mu">주급 합계 $${fmtM(sal)}</small></h3><div class="stf">${staff}</div></div>
   <div class="card"><h3>🧭 매치메이킹 후보 ${P.org?`<small class="mu">${orgName(P.org,G.y)} ${WC[P.wc].n} · 나: ${STYLE_N[styleOf(P.A)]}, OVR ${grpOvr(P.A).tot}, ELO ${Math.round(P.elo||1500)}</small>`:''}</h3>${mm}</div>`;
  el.querySelectorAll('[data-wk]').forEach(s=>s.onchange=()=>{P.sched=P.sched||{};P.sched[+s.dataset.wk]=s.value;save();tabSched()});
  el.querySelector('[data-auto]').onclick=()=>{autoPlan();save();tabSched();toast('⚙️ 경기 일정에 맞춰 훈련 주기를 짰어요')};el.querySelector('[data-clear]').onclick=()=>{P.sched={};save();tabSched()};
  el.querySelectorAll('[data-hire]').forEach(b=>b.onclick=()=>{const k=b.dataset.hire;P.staff[k]=Math.min(3,staffLv(P,k)+1);CC.addFeed(`👥 ${STAFF_ROLES[k].n} (${STAFF_LV[P.staff[k]-1]}) 합류`,1);save();tabSched()});
  el.querySelectorAll('[data-fire]').forEach(b=>b.onclick=()=>{const k=b.dataset.fire;P.staff[k]=0;save();tabSched()});
  el.querySelectorAll('[data-prof]').forEach(b=>b.onclick=()=>profileModal(G.F[b.dataset.prof]));
  el.querySelectorAll('[data-req]').forEach(b=>b.onclick=()=>{const f=G.F[b.dataset.req];const ok=Math.random()<.35+P.fame/200+(P.rivals[f.id]?.15:0);
    if(ok){const of=CC.fightOffer(P.org);if(of){of.opp=f.id;of.why=['요청한 매치'].concat((Matchmaker.candidates(P.org,P.wc).find(c=>c.f===f)||{why:[]}).why.slice(0,3));P.offers.push(of);save();toast(`📩 단체가 ${dn(f)}전을 제안했어요 (홈 탭)`)}}else{toast('단체가 이번엔 다른 매치를 원합니다');P.hype=clamp(P.hype+1,0,100)}save()})}
function buildCard(nx){const org=nx.org,G=GG,P=G.P;const used=new Set([nx.opp,'P']);const wcs=ORGS[org].wcs.filter(w=>WW.rank(org,w).list.length>3);const bouts=[];
  for(let i=0;i<6;i++){const wc=wcs[i%wcs.length];const pr=Matchmaker.pairNPC(org,wc,used);if(pr)bouts.push({a:`${flag(pr.a.nat)} ${dn(pr.a)} <small class="mu">#${pr.ra}</small>`,b:`<small class="mu">#${pr.rb}</small> ${dn(pr.b)} ${flag(pr.b.nat)}`,wc:WC[wc].n})}
  const o=G.F[nx.opp];const me={a:`${esc2(P.name)}`,b:`${dn(o)} ${flag(o.nat)}`,wc:WC[P.wc].n,me:1,t:nx.title};
  const main=nx.title||nx.main?[me]:[bouts.shift()].filter(Boolean);const co=[bouts.shift()].filter(Boolean);const mc=nx.title||nx.main?bouts.splice(0,3):[me].concat(bouts.splice(0,2));
  return[{h:'MAIN EVENT',b:main},{h:'CO-MAIN',b:co},{h:'MAIN CARD',b:mc},{h:'PRELIMS',b:bouts}].filter(s=>s.b.length)}
/* add the tab to the hub without touching the original tab table */
{const hb=hub;hub=function(){if(TAB==='sched'){TAB='home';hb();TAB='sched';const nav=$('.tabs');if(!nav)return;nav.querySelectorAll('button').forEach(b=>b.classList.remove('on'));addTab(nav,true);tabSched()}else{hb();const nav=$('.tabs');if(nav)addTab(nav,false)}}}
function addTab(nav,on){if(nav.querySelector('[data-sched]'))return;const b=document.createElement('button');b.dataset.sched=1;b.textContent='📅 스케줄';if(on)b.classList.add('on');b.onclick=()=>{TAB='sched';hub()};const tr=nav.querySelector('[data-tab="train"]');if(tr)tr.after(b);else nav.appendChild(b)}
/* show the matchmaking reason on offer cards in the home tab */
{const th=tabHome;tabHome=function(){th();const P=GG.P;P.offers.forEach((o,i)=>{if(!o.why||!o.why.length)return;const b=document.querySelector(`[data-acc="${i}"]`);const box=b&&b.closest('.offer');const sm=box&&box.querySelector('small');if(sm)sm.insertAdjacentHTML('beforeend',`<br><span class="why2">🧭 ${o.why.map(esc2).join(' · ')}</span>`)})}}
/* carry the offer's reason into the booked fight */
{const ac=Career.prototype.accept;Career.prototype.accept=function(of){const r=ac.call(this,of);const P=this.G.P;if(P.next&&of.why&&!P.next.why&&P.next.opp===of.opp)P.next.why=of.why;return r}}
