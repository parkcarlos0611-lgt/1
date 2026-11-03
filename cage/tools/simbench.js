/* Fast-forward balance bench: runs N AI-vs-AI fights through the real Match engine on a virtual
   clock (performance.now / setTimeout are virtualised, rendering skipped) and prints the finish
   distribution. Usage: node tools/simbench.js index.html [N] [weightclass] [rounds] */
const {chromium}=require('playwright');const path=require('path');
(async()=>{const file=path.resolve(process.argv[2]||'index.html'),N=+(process.argv[3]||30),wc=process.argv[4]||'LW',rounds=+(process.argv[5]||3);
const b=await chromium.launch();const p=await b.newPage({viewport:{width:640,height:360}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
for(const m of (process.env.BLOCK||'').split(',').filter(Boolean))await p.route('**/'+m,r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
await p.goto('file://'+file);await p.waitForTimeout(600);
const out=await p.evaluate(async([N,wc,rounds])=>{
  let vt=0;const Q=[];const realNow=performance.now.bind(performance);performance.now=()=>vt*1000;
  window.setTimeout=(fn,ms)=>{Q.push({t:vt+(ms||0)/1000,fn});return Q.length};const runQ=()=>{for(let i=0;i<Q.length;i++){const q=Q[i];if(q&&q.t<=vt){Q[i]=null;try{q.fn()}catch(e){}}}};
  window.requestAnimationFrame=()=>0;
  GG={P:null,opt:{diff:1},quick:2012};WW=new World(GG);WW.init(2012);const pool=Object.values(GG.F).filter(f=>f.act&&f.wc===wc&&(f.real||f.r>70)).sort((a,b)=>b.r-a.r).slice(0,30);
  const fx=f=>({name:dn(f),flag:'',rec:'',A:f.A,stance:hsh(f.n+'st')<.22?-1:1,look:lookFor(f)});
  const res=[];const t0=realNow();const PM={thr:0,land:0,secs:0,pocket:0,trade:0,dist:0,n:0,whiffPun:0,feint:0,step:0,setup:0,sweet:0,jam:0,tdCounter:0,gassedSecs:0};window.__PM=PM;const IMP=[],PEAK=[],COMBO=[];if(typeof StunModel!=="undefined"){const h=StunModel.hit.bind(StunModel);StunModel.hit=function(M,att,def,dmg,o){const r=h(M,att,def,dmg,o);if(def._ko){IMP.push(def._ko.imp);COMBO.push(def._ko.combo)}def._pk=Math.max(def._pk||0,StunModel.ratio(def));return r}}
  for(let n=0;n<N;n++){const a=pool[Math.floor(Math.random()*pool.length)];let c;do{c=pool[Math.floor(Math.random()*pool.length)]}while(c===a);
    const root=document.createElement('div');document.body.appendChild(root);const rules=Object.assign(orgRules('UFC',2012,false),{rounds});
    const M=new Match(root,{level:1.6,org:{short:'UFC',col:'#d20a0a'},title:'',wcName:'',rules,player:null,diff:1,allowSim:false,red:fx(a),blue:fx(c)},()=>{});M.running=false;M.hud=()=>{};
    const dt=1/60;let steps=0;const kd=[0,0],rock=[0,0];let pend=null;
    while(!M.result&&steps<60*60*30){vt+=dt;runQ();let sdt=dt;if(M.hitstop>0){M.hitstop-=dt;sdt=dt*.04}else if(M.slow>0){M.slow-=dt;sdt=dt*.25}
      if(!M.paused){M.step(sdt*GAME_SPEED);if(M.phase==='fight'){const[a1,b1]=M.f;const sd=sdt*GAME_SPEED;if(a1.state==='stand'&&b1.state==='stand'&&!M.g){PM.secs+=sd;const d=Math.abs(a1.x-b1.x);PM.dist+=d*sd;if(d<.95)PM.pocket+=sd;if(a1.act&&b1.act&&a1.act.c.hit&&b1.act.c.hit)PM.trade+=sd;for(const f of M.f)if(f.sta<30)PM.gassedSecs+=sd}}}steps++}
    const r=M.result||{method:'TIMEOUT',round:M.round};const ex=r.extra||{};
    res.push({m:r.method,d:r.detail,rd:r.round,t:Math.round(r.time||0),kd:(r.stats||[]).map(s=>s.kd),sig:(r.stats||[]).map(s=>s.sigL),cards:r.cards?r.cards.map(c=>c.map(x=>x.join('-')).join(' ')):null,dmgR:M.rsAll.map(rs=>rs.map(x=>Math.round(x.dmg)).join(':')).join(' '),ra:Math.round(a.r),rb:Math.round(c.r),w:r.winner});
    PM.thr+=M.f[0].st.thr+M.f[1].st.thr;PM.land+=M.f[0].st.sigL+M.f[1].st.sigL;PEAK.push(...M.f.map(f=>+(f._pk||0).toFixed(2)));M.destroy();root.remove();Q.length=0}
  const by={};for(const r of res){const k=r.m==='DEC'?(/만장|만장일치/.test(r.d)?'DEC-U':/스플릿/.test(r.d)?'DEC-S':/다수/.test(r.d)?'DEC-M':'DEC'):r.m;by[k]=(by[k]||0)+1}
  const fav=res.filter(r=>r.w>=0&&r.ra!==r.rb).map(r=>(r.w===0)===(r.ra>r.rb));
  const q=(A,p)=>{const B=[...A].sort((x,y)=>x-y);return B.length?B[Math.floor(p*(B.length-1))]:0};const dist=A=>`n${A.length} p10 ${q(A,.1)} p25 ${q(A,.25)} p50 ${q(A,.5)} p90 ${q(A,.9)} p99 ${q(A,.99)} max ${q(A,1)}`;
  const allR=res.filter(r=>r.cards).flatMap(r=>r.cards.flatMap(c=>c.split(' ')));const rc={};for(const c of allR){const k=c.split('-').sort().join('-');rc[k]=(rc[k]||0)+1}
  const mins=PM.secs*CLOCK_RATE/60;const pace={thrPerMinPerFighter:+(PM.thr/2/Math.max(.01,mins)).toFixed(1),sigLandPct:Math.round(PM.land/Math.max(1,PM.thr)*100),pocketPct:Math.round(PM.pocket/Math.max(.01,PM.secs)*100),tradePct:Math.round(PM.trade/Math.max(.01,PM.secs)*100),avgDist:+(PM.dist/Math.max(.01,PM.secs)).toFixed(2),gassedPct:Math.round(PM.gassedSecs/2/Math.max(.01,PM.secs)*100),whiffPunish:PM.whiffPun,feints:PM.feint,steps:PM.step,setups:PM.setup,sweet:PM.sweet,jam:PM.jam,tdCounter:PM.tdCounter,ext:PM.ext?dist(PM.ext):'-'};
  return{pace,roundCards:rc,headImpact:dist(IMP),combo:dist(COMBO),peakRatio:dist(PEAK),headHitsPerFight:(IMP.length/N).toFixed(1),n:N,ms:Math.round(realNow()-t0),by,r1fin:res.filter(r=>r.m!=='DEC'&&r.m!=='DRAW'&&r.rd===1).length,favWin:fav.length?Math.round(fav.filter(Boolean).length/fav.length*100)+'%':'-',
    kdPerFight:(res.reduce((s,r)=>s+r.kd.reduce((a,b)=>a+b,0),0)/N).toFixed(2),
    cards:res.filter(r=>r.cards).slice(0,6).map(r=>r.cards.join(' | ')+'  dmg '+r.dmgR+'  '+r.d),
    finishes:res.filter(r=>r.m!=='DEC').slice(0,10).map(r=>`${r.m} ${r.d} R${r.rd} ${r.t}s kd${r.kd.join('/')}`)}},[N,wc,rounds]);
console.log(JSON.stringify(out,null,1));if(errs.length)console.log('ERRORS',errs.slice(0,5));await b.close()})();
