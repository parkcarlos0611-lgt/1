/* Career injury/matchmaking bench: runs careers week by week (fights simulated with simFight),
   reports injuries per year, weeks lost, fights per year. Usage: node tools/careerbench.js index.html [old] */
const {chromium}=require('playwright');const path=require('path');
(async()=>{const file=path.resolve(process.argv[2]||'index.html'),old=process.argv[3]==='old';const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
if(old)await p.route('**/CareerManager.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
await p.goto('file://'+file);await p.waitForTimeout(500);
const out=await p.evaluate(()=>{const res={};
  for(const [label,plan,camp] of [['균형(휴식 없음)','bal','normal'],['스파링 위주','spar','normal'],['지옥캠프','bal','hard'],['자동 주기화','auto','normal']]){let src={tr:0,camp:0,fight:0},inj=0,lost=0,fights=0,yrs=0,minor=0,canc=0,whyN=0,remat=0;
    for(let run=0;run<10;run++){const st={step:0,year:2008,nat:'KR',name:'T',wc:'LW',stance:1,bg:'prospect',st:['box','wr'],look:{skin:SKIN[1],hair:'#111',shorts:'#111',beard:false,hairLen:.08},alloc:{},h:null};startCareer(st);const P=GG.P;P.money=1e7;
      const opp=[];for(let w=0;w<52*5;w++){if(plan==='auto'){if(typeof autoPlan!=='undefined'){if(!P.sched||!Object.keys(P.sched).length||w%4===0)autoPlan()}else P.plan=P.fat>65?'rest':'bal'}else P.plan=plan;const had=!!P.inj;const r=CC.week();if(!had&&P.inj){inj++;src.tr++;if(P.inj.tier==='minor')minor++}if(P.inj)lost++;if(r.msgs.some(m=>m.includes('취소')))canc++;
        for(const o of P.offers.slice()){if(!P.next&&(o.kind==='fight'||o.kind==='contract')){if(o.why&&o.why.length)whyN++;CC.accept(o)}}
        if(P.next&&absW(GG.y,GG.w)>=P.next.wk-1){const nx=P.next;if(!nx.camp)nx.camp=runCamp(P,GG.F[nx.opp],'cond',camp);if(nx.camp.inj&&!nx._c){nx._c=1;inj++;src.camp++}
          const cfg=CC.fightCfg(nx,'safe');const s=simFight({A:cfg.red.A},{A:cfg.blue.A},cfg.rules);const had2=!!P.inj;if(opp.includes(nx.opp))remat++;opp.push(nx.opp);
          CC.resolve(nx,{winner:s.w,method:s.method,detail:s.detail,round:s.round,time:s.time,stats:[{hp:{head:100-Math.random()*70,body:100-Math.random()*50,legs:100-Math.random()*40}}]});if(!had2&&P.inj){inj++;src.fight++}fights++}}
      yrs+=5}
    res[label]={src:Object.fromEntries(Object.entries(src).map(([k,v])=>[k,+(v/yrs).toFixed(2)])),avgFat:0,injuriesPerYear:+(inj/yrs).toFixed(2),weeksLostPerYear:+(lost/yrs).toFixed(1),fightsPerYear:+(fights/yrs).toFixed(2),fightCancelsPerYear:+(canc/yrs).toFixed(2),minorShare:inj?Math.round(minor/inj*100)+'%':'-',offersWithReason:whyN,rematches:remat}}
  return res});
console.log((old?'OLD ':'NEW ')+JSON.stringify(out,null,1));if(errs.length)console.log('ERR',errs.slice(0,4));await b.close()})();
