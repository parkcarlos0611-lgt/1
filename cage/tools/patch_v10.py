"""Cage Legends v10 patch: fight camp, interactive corner, press-conference motivation fix, hall of fame."""
import sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()

def rep(old, new):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'anchor found {n}x: {old[:80]!r}')
    s = s.replace(old, new)

# ---------- CSS ----------
rep('</style><div id="app"></div>', '''
/* v10: fight camp, corner, hall of fame */
.campo{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
.scout{display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px}.scout ul{margin:4px 0;padding-left:18px}.scout li{margin:2px 0}
.cnr{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:10px 0 4px}.cnr button{background:#1a1d24;border:1px solid #2a2e38;border-radius:8px;padding:7px 10px;color:#fff;font:700 12.5px 'Noto Sans KR',sans-serif;cursor:pointer;min-width:92px}.cnr button small{display:block;font-weight:400;font-size:10.5px;color:#aab;margin-top:2px}.cnr button.on{border-color:#f2b544;background:#3a2c0e}
.cscore{font-size:13px;color:#ffd88a;margin:6px 0}
.hof td small{color:var(--mu)}
</style><div id="app"></div>''')

# ---------- 1. fight config: apply camp + opponent motivation ----------
rep("if(this.hasAsset('air')&&nx.away)A.cardio+=1;",
    "if(this.hasAsset('air')&&nx.away)A.cardio+=1;"
    "if(nx.camp&&nx.camp.mods){for(const k in nx.camp.mods)A[k]=clamp((A[k]||10)+nx.camp.mods[k],1,20)}"
    "const OA=Object.assign({},o.A);const mot=clamp(nx.oppMot||0,-8,12);"
    "if(mot){for(const k of['heart','composure','aggression'])OA[k]=clamp((OA[k]||10)+mot*.25,1,20);if(mot>0)OA.cardio=clamp((OA.cardio||10)+mot*.1,1,20)}")
rep("A:o.A,stance", "A:OA,stance")
rep("if(nx.oppMot)AKEYS.forEach(k=>{});", "")

# ---------- 2. fight camp step (before the press conference) ----------
rep("function fightWeek(){", r'''/* ---------- v10: fight camp ---------- */
const CAMPS={
  strike:['🥊 타격 캠프','펀치력·정확도·핸드스피드·킥',{punchPow:1.2,accuracy:1.2,handSpd:.8,kicking:.8}],
  wrestle:['🤼 레슬링 캠프','테이크다운·TD방어·상위 컨트롤·클린치',{takedown:1.5,tdd:1.2,topCtl:1,clinchCtl:.8}],
  bjj:['🔒 주짓수 캠프','서브미션 공격·방어·하위 포지션·겟업',{subOff:1.5,subDef:1.5,bottom:1,getup:.8}],
  cond:['🫁 컨디셔닝 캠프','체력·회복·근력',{cardio:1.8,recovery:1.2,strength:.5}]};
const COUNTER={'타격':{strDef:1.6,footwork:1.2,chin:.4,fightIQ:1},'그래플링':{tdd:1.8,getup:1.4,subDef:1.2,fightIQ:1},'신체':{cardio:1,footwork:1,fightIQ:1.2,composure:1},'정신':{composure:1.2,fightIQ:1.2,heart:1}};
const CAMP_INT={light:['가벼운 캠프',.6,'피로도 -15, 부상 위험 없음'],normal:['정상 캠프',1,'피로도 +5'],hard:['지옥 캠프',1.6,'효과 1.6배 · 비용 증가 · 피로도에 따라 부상 위험']};
function scoutReport(o){const O=grpOvr(o.A);const g=O.g.slice().sort((a,b)=>b[1]-a[1]);const top=AKEYS.filter(k=>k!=='charisma').sort((a,b)=>(o.A[b]||10)-(o.A[a]||10));
  return{best:g[0][0],worst:g[g.length-1][0],str:top.slice(0,3),weak:top.slice(-3).reverse(),tot:O.tot}}
function campCost(P,int){const g=GYMS[P.gym]||[0,0,0,0,0,300];return Math.round((g[5]||300)*(int==='hard'?8:int==='light'?2:4))}
function campHurtRisk(P){return Math.round(clamp(8+(P.fat||0)*.5,8,55))}
function runCamp(P,o,focus,int){const sr=scoutReport(o);const base=focus==='counter'?COUNTER[sr.best]:CAMPS[focus][2];const k=CAMP_INT[int][1];const mods={};for(const a in base)mods[a]=+(base[a]*k).toFixed(2);
  let inj=false;if(int==='hard'&&Math.random()*100<campHurtRisk(P)){inj=true;for(const a in mods)mods[a]=+(mods[a]*.5).toFixed(2);mods.cardio=(mods.cardio||0)-1;mods.chin=(mods.chin||0)-.8;P.fat=clamp((P.fat||0)+10,0,100)}
  P.fat=clamp((P.fat||0)+(int==='light'?-15:int==='hard'?12:5),0,100);const cost=campCost(P,int);P.money-=cost;if(P.stats)P.stats.spend=(P.stats.spend||0)+cost;
  return{focus,int,mods,inj,cost,label:focus==='counter'?`🧠 맞춤 전략 (vs ${sr.best})`:CAMPS[focus][0]}}
function fightWeek(){''')

rep("  step1()}\nif(document.readyState", r'''  const step0=()=>{if(nx.camp){step1();return}const sr=scoutReport(o);const me=grpOvr(P.A);let foc='counter',int='normal';
    const opts=[['counter',`🧠 맞춤 전략`,`상대 최고 무기(${sr.best})를 봉쇄: ${Object.keys(COUNTER[sr.best]).map(k=>ANAME[k]).join('·')}`],...Object.entries(CAMPS).map(([k,v])=>[k,v[0],v[1]])];
    const draw=()=>{app().innerHTML=`<div class="page fw"><div class="fwh"><span class="H">FIGHT CAMP</span><b>훈련 캠프</b><em>${esc2(P.name)} vs ${dn(o)} · ${nx.ev}</em></div>
     <div class="card"><h3>🔍 상대 분석 — ${flag(o.nat)} ${dn(o)}</h3>${ovrBar(o.A)}<div class="scout"><div><b class="pos">강점</b><ul>${sr.str.map(k=>`<li>${ANAME[k]} <b class="${aCls(o.A[k])}">${Math.round(o.A[k])}</b></li>`).join('')}</ul></div><div><b class="neg">약점</b><ul>${sr.weak.map(k=>`<li>${ANAME[k]} <b class="${aCls(o.A[k])}">${Math.round(o.A[k])}</b></li>`).join('')}</ul></div></div>
      <p class="sm mu">내 종합 <b>${me.tot}</b> vs 상대 <b>${sr.tot}</b> · 상대는 <b>${sr.best}</b>이(가) 가장 강하고 <b>${sr.worst}</b>이(가) 가장 약해요.</p></div>
     <div class="card"><h3>🏕️ 캠프 방향</h3><div class="campo">${opts.map(([k,n,d])=>`<button class="bgc ${foc===k?'on':''}" data-f="${k}"><b>${n}</b><span>${d}</span></button>`).join('')}</div>
      <label>강도</label><div class="row wrap">${Object.entries(CAMP_INT).map(([k,v])=>`<button class="chip ${int===k?'on':''}" data-i="${k}">${v[0]} <small>$${fmtM(campCost(P,k))}</small></button>`).join('')}</div>
      <p class="sm mu">${CAMP_INT[int][2]}${int==='hard'?` · 현재 피로도 ${Math.round(P.fat||0)} → 부상 위험 <b class="neg">${campHurtRisk(P)}%</b>`:''}. 캠프 효과는 이번 경기에만 적용돼요.</p>
      <button class="btn full" data-go ${P.money<campCost(P,int)?'disabled':''}>캠프 시작 ▶</button>${P.money<campCost(P,int)?'<p class="sm neg">캠프 비용이 부족해요.</p>':''}</div></div>`;
      const A=app();A.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{foc=b.dataset.f;draw()});A.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{int=b.dataset.i;draw()});
      A.querySelector('[data-go]').onclick=()=>{const c=runCamp(P,o,foc,int);nx.camp=c;save();const txt=Object.entries(c.mods).filter(([,v])=>v).map(([k,v])=>`${ANAME[k]} ${v>0?'+':''}${v}`).join(' · ');
        CC.addFeed(`🏕️ ${c.label} (${CAMP_INT[int][0]}) 완료${c.inj?' · 스파링 중 부상':''}`,1);
        A.innerHTML=`<div class="page fw"><div class="fwh ${c.inj?'loss':'win'}"><span class="H" style="font-size:22px">${c.inj?'CAMP INJURY':'CAMP COMPLETE'}</span><b>${c.label}</b><em>${CAMP_INT[int][0]} · 비용 $${fmtM(c.cost)}</em></div><div class="card"><p>${c.inj?'🚑 스파링 중 부상을 입었어요. 효과가 절반으로 줄고 체력·맷집이 떨어진 채로 싸웁니다.<br>':''}이번 경기 보정: <b>${txt}</b></p><button class="btn full" data-n>기자회견으로 ▶</button></div></div>`;
        A.querySelector('[data-n]').onclick=step1}};draw()};
  step0()}
if(document.readyState''')

# ---------- 3. interactive corner between rounds ----------
rep("this.f[0].x=-1.15;this.f[1].x=1.15;", "this.applyCorner();this.f[0].x=-1.15;this.f[1].x=1.15;")
rep('<p class="tip">🗣️ 코너: ${tip}</p><button class="btn" data-n>',
    '<p class="tip">🗣️ 코너: ${tip}</p>${this.cornerHTML()}<button class="btn" data-n>')
rep("this.H.ov.querySelector('[data-n]').onclick=()=>this.nextRound();",
    "this.H.ov.querySelector('[data-n]').onclick=()=>this.nextRound();this.cornerPick=this.cornerPick||'rest';this.H.ov.querySelectorAll('[data-cn]').forEach(b=>b.onclick=()=>{this.cornerPick=b.dataset.cn;this.H.ov.querySelectorAll('[data-cn]').forEach(x=>x.classList.toggle('on',x===b))});")
rep("  showResult(){const r=this.result;", r'''  cornerHTML(){if(this.pi==null)return'';const me=this.pi;let sc='';
    if(this.rules.judging!=='whole'){const last=this.cards.map(c=>c[c.length-1]).filter(Boolean);const won=last.filter(x=>x[me]>x[1-me]).length,lost=last.filter(x=>x[me]<x[1-me]).length;
      const tot=this.cards.map(c=>c.reduce((s,x)=>[s[0]+x[me],s[1]+x[1-me]],[0,0]));const lead=tot.filter(t=>t[0]>t[1]).length,trail=tot.filter(t=>t[0]<t[1]).length;
      sc=`<div class="cscore">📋 코너 채점: 이번 라운드 ${won>lost?'<b class="pos">우리가 가져갔다</b>':lost>won?'<b class="neg">내준 것 같다</b>':'반반이다'} · 누적 ${lead>trail?'리드 중':trail>lead?'<b class="neg">끌려가는 중</b>':'박빙'}</div>`}
    const P=this.f[me];const C=[['rest','🫁 회복','체력·데미지 회복'],['cut','🩹 컷맨',P.body.cuts.length?'출혈·붓기 처치':'붓기 처치'],['attack','🔥 압박','파워·정확도↑ 체력↓'],['defend','🛡️ 수비','타격·TD 방어↑'],['wrestle','🤼 레슬링','TD·상위 컨트롤↑']];
    const pk=this.cornerPick||'rest';return`${sc}<div class="cnr">${C.map(([k,n,d])=>`<button data-cn="${k}" class="${pk===k?'on':''}">${n}<small>${d}</small></button>`).join('')}</div>`}
  cpuCorner(f){const i=f.side,rs=this.rs;if(f.body.cuts.length&&(f.bleed||0)>8)return'cut';if(f.sta<45)return'rest';
    const mine=rs[i].sigL+rs[i].kd*16+rs[i].td*3.5,theirs=rs[1-i].sigL+rs[1-i].kd*16+rs[1-i].td*3.5;if(mine<theirs-4)return this.f[i].ai&&this.f[i].ai.gr?'wrestle':'attack';
    if(f.opp.hp.head<55)return'attack';return Math.random()<.5?'rest':'defend'}
  applyCorner(){const NM={rest:'회복',cut:'컷맨 처치',attack:'압박 지시',defend:'수비 지시',wrestle:'레슬링 지시'};
    for(const f of this.f){const ch=f.side===this.pi?(this.cornerPick||'rest'):this.cpuCorner(f);f.A0=f.A0||f.A;const A=Object.assign({},f.A0);const add=(k,v)=>A[k]=clamp((A[k]||10)+v,1,20);
      if(f.ai){f.ai.aggr0=f.ai.aggr0==null?f.ai.aggr:f.ai.aggr0;f.ai.aggr=f.ai.aggr0}
      if(ch==='rest'){f.sta=Math.min(f.staMax,f.sta+18);for(const k of['head','body','legs'])f.hp[k]=Math.min(100,f.hp[k]+5)}
      else if(ch==='cut'){f.body.cuts.forEach(c=>c.sev*=.45);f.bleed=(f.bleed||0)*.35;f.body.swell*=.6;f.hp.head=Math.min(100,f.hp.head+3)}
      else if(ch==='attack'){add('punchPow',1.5);add('accuracy',1.5);add('handSpd',1);add('aggression',3);f.sta=Math.max(10,f.sta-8);if(f.ai)f.ai.aggr=Math.min(1,f.ai.aggr+.2)}
      else if(ch==='defend'){add('strDef',2);add('tdd',2);add('footwork',1);add('aggression',-2);if(f.ai)f.ai.aggr=Math.max(0,f.ai.aggr-.15)}
      else if(ch==='wrestle'){add('takedown',2);add('topCtl',1.5);add('clinchCtl',1)}
      f.A=A;if(f.side!==this.pi)this.ev(`🗣️ ${f.name} 코너: ${NM[ch]}`)}}
  showResult(){const r=this.result;''')

# ---------- 4. hall of fame (survives retirement) ----------
rep("function retire(){const P=GG.P;const net=P.money+P.assets.reduce((s,a)=>s+ASSET_VAL.value(a),0);",
    "function legacy(){try{return JSON.parse(localStorage.getItem('cage_legacy')||'[]')}catch(e){return[]}}\n"
    "function hofModal(){const L=legacy();modal(`<h3>🏛️ 명예의 전당</h3><p class=\"sm mu\">은퇴한 내 선수들의 기록이 남아요.</p><table class=\"rk hof\"><thead><tr><th>선수</th><th>전적</th><th>벨트</th><th>순자산</th><th>평가</th></tr></thead><tbody>${L.map(h=>`<tr><td>${flag(h.nat)} <b>${esc2(h.name)}</b><br><small>${WC[h.wc]?WC[h.wc].n:''} · ${h.y0||''}–${h.y} · ${h.age}세 은퇴</small></td><td>${h.rec.w}-${h.rec.l}-${h.rec.d}<br><small>KO ${h.rec.ko} · 서브 ${h.rec.sub}</small></td><td>${h.belts.length?h.belts.map(b=>`👑 ${esc2(b)}`).join('<br>'):'-'}</td><td>$${fmtM(h.net)}</td><td>${h.hof?'🏛️ 헌액':h.fame>60?'🎤 해설위원':'-'}</td></tr>`).join('')}</tbody></table><button class=\"btn\" onclick=\"this.closest('.modal').remove()\">닫기</button>`,'wide')}\n"
    "function retire(){const P=GG.P;const net=P.money+P.assets.reduce((s,a)=>s+ASSET_VAL.value(a),0);"
    "if(!P._retired){P._retired=1;try{const L=legacy();L.unshift({name:P.name,nat:P.nat,wc:P.wc,rec:Object.assign({},P.rec),belts:P.belts.map(b=>`${orgName(b.org,b.y)} ${WC[b.wc].n} (${b.y})`),net,fame:Math.round(P.fame),y:GG.y,y0:P.hist.length?P.hist[P.hist.length-1].y:GG.y,age:CC.age(),hof:P.fame>85&&P.belts.length>0});localStorage.setItem('cage_legacy',JSON.stringify(L.slice(0,30)))}catch(e){}}")
rep('<button class="btn big ghost" data-ctrl>조작법</button>',
    '<button class="btn big ghost" data-ctrl>조작법</button>${legacy().length?\'<button class="btn big ghost" data-hof>🏛️ 명예의 전당</button>\':\'\'}')
rep("app().querySelector('[data-ctrl]').onclick=()=>ctrlHelp();",
    "app().querySelector('[data-ctrl]').onclick=()=>ctrlHelp();const hf=app().querySelector('[data-hof]');if(hf)hf.onclick=hofModal;")

open(dst, 'w', encoding='utf-8').write(s)
print('ok', len(s))
