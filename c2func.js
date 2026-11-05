const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const rule=process.argv[3]||'UFC 룰';const p=await b.newPage({viewport:{width:1280,height:720}});const errs=[];p.on('pageerror',e=>errs.push(e.message+' '+(e.stack||'').slice(0,300)));
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(900);
await p.evaluate(()=>{const o=Match.prototype.buildHUD;Match.prototype.buildHUD=function(){window.__m=this;return o.apply(this,arguments)}});
await p.click('text=빠른 대전');await p.click('text='+rule);await p.click('text=시작');await p.waitForTimeout(3600);
const out=await p.evaluate(async()=>{const M=__m;M.paused=true;const log=[];const[a,b]=M.f;for(const f of M.f)if(f.ai){f.ai.update=function(){this.f.mvIn=0}}M.playerInput=function(){};
  const reset=()=>{M.g=null;M.phase='fight';M.clock=300;M.winner=null;M.outro=null;M._ko=null;for(const f of M.f){f.state='stand';f.down=null;f.act=null;f.gpose=null;f.queue=[];f.body.rag=null;f.sta=f.staMax;f.hp.head=f.hp.body=f.hp.legs=100;f.conc=0;f.rock=0;f.stun=0;f.guard=null;f._gBroken=0;f.gst=f.gMax;f.evT=0;f.evCh=[0,0];f.tactic=null;f.noClinch=0}a.x=-.4;b.x=.4;a.d=1;b.d=-1;for(let i=0;i<5;i++)M.step(1/60)};
  const run=n=>{for(let i=0;i<n;i++){M.step(1/60);M.render(1/60)}};
  // 1 guard: mid blocks straight, damage 35%
  reset();b.guard='mid';let dm=[];const ad=M.applyDmg.bind(M);let blockedD=0,openD=0;M.applyDmg=function(att,def,o){if(att===a&&o.dmg!=null){if(o.blocked)blockedD=o.dmg;else openD=o.dmg}return ad(att,def,o)};
  for(let n=0;n<30;n++){reset();b.guard=n%2?'mid':null;a.strike('jab',M);for(let i=0;i<40;i++){b.guard=n%2?'mid':null;run(1)}}
  log.push('guard: blocked dmg '+blockedD.toFixed(2)+' vs open '+openD.toFixed(2)+' ratio '+(blockedD/openD).toFixed(2)+' (guard stamina max '+b.gMax.toFixed(0)+')');M.applyDmg=ad;
  // 2 guard break stays down till full
  reset();b.gst=.01;run(2);log.push('gst .01 -> broken '+!!b._gBroken);b.guard='mid';run(2);log.push('guard while broken: '+b.guard);b.gst=b.gMax;run(2);log.push('after full: broken '+!!b._gBroken);
  // 3 evade
  reset();let dodged=0,tot=40;for(let n=0;n<tot;n++){reset();M.evade(b);const hp0=b.hp.head;a.strike('cross',M);run(45);if(b.hp.head>=hp0-.01)dodged++}log.push('evade active: '+dodged+'/'+tot+' blows fully dodged');
  reset();M.evade(b);log.push('charges after 1 use '+b.evCh.map(x=>(x-M.t2()).toFixed(1)).join(','));M.evade(b);b.evT=0;log.push('3rd use allowed? '+M.evade(b));
  reset();M.evade(b);b.evT=2;a.strike('rlk',M);let h0=b.hp.legs;run(45);log.push('low kick vs evade: leg hp '+(h0-b.hp.legs).toFixed(1)+' (not evadable)');
  // 4 tactics out
  reset();a.tactic='out';b.x=a.x+1.0;for(let i=0;i<4;i++)run(10);log.push('out: outT '+JSON.stringify(a.outT)+' act '+(a.act&&a.act.key));run(60);log.push('out after .8s: tactic '+a.tactic+' act '+(a.act&&a.act.key)+' speed '+(a.act&&a.act.speed));
  // 5 groggy duration
  reset();b.conc=0;let durs=[];for(let n=0;n<12;n++){reset();b.conc=b.constructor&&0;StunModel.hit(M,a,b,6+n,{chin:true});const r=StunModel.ratio(b);b.rock=0}log.push('stun model ratio after hit '+StunModel.ratio(b).toFixed(2));
  // 6 TKO on floor
  let tko=0;for(let n=0;n<60;n++){reset();b.state='down';b.down={t:.5,ko:0,getup:3,fwd:false};b.conc=StunModel.T(b)*1.2;M.applyDmg(a,b,{zone:'head',dmg:6,kind:'punch'});if(M.phase==='end'){tko++}}log.push('TKO when down at >=90%: '+tko+'/60 (~40% expected)');
  // standing: never
  let st=0;for(let n=0;n<60;n++){reset();b.conc=StunModel.T(b)*.95;const k=M.finish;let called=null;M.finish=function(w,m){called=m};M.applyDmg(a,b,{zone:'head',dmg:2,kind:'punch'});if(called==='TKO')st++;M.finish=k}log.push('TKO while standing: '+st+'/60');
  return log});
console.log(out.join('\n'));console.log(errs.join('\n')||'no errors');await b.close()})();
