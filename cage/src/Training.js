/* ===== Training.js : heavy bag (physics), wrestling session, sparring — from the title screen and in career mode =====
   All three run on the normal match engine (same fighters, inputs, motions), with cfg.training set:
     bag     — one fighter vs a hanging heavy bag. The bag is a two-link pendulum (rope + bag) integrated with
               Verlet: strikes push it according to their power and height, it swings, twists back and settles;
               the hit box rides on the swinging bag. Counts strikes, total and best power.
     wrestle — vs a training partner; strikes are off, the partner shoots and clinches often; takedowns,
               sweeps, back takes and taps score points; a tap resets the drill instead of ending it.
     spar    — two 2-minute rounds with 16 oz gloves (40 % damage), no KO: a knockdown is a short stoppage,
               a finish resets both fighters.
   At the end a summary appears; in career mode the session gives small attribute gains and some fatigue. */
(function(){
if(typeof Match==='undefined')return;
const TRN={bag:{n:'샌드백 훈련',len:60,rounds:1},wrestle:{n:'레슬링 세션',len:120,rounds:1},spar:{n:'연습 스파링',len:120,rounds:2}};
window.TRN=TRN;

/* ---------- heavy bag: rope + bag as a 2-link Verlet pendulum ---------- */
class HeavyBag{constructor(x){this.ax=x;this.ay=2.5;this.L1=.55;this.L2=1.35;this.p1={x,y:this.ay-this.L1};this.p2={x,y:this.p1.y-this.L2};this.q1={...this.p1};this.q2={...this.p2};this.sq=0;this.tw=0;this.twv=0}
  step(dt){if(!(dt>0))return;const g=9.81,damp=Math.exp(-.55*dt);const S=4,h=dt/S;
    for(let k=0;k<S;k++){for(const[p,q]of[[this.p1,this.q1],[this.p2,this.q2]]){const vx=(p.x-q.x)*damp,vy=(p.y-q.y)*damp;q.x=p.x;q.y=p.y;p.x+=vx;p.y+=vy-g*h*h}
      for(let it=0;it<4;it++){/* rope from the ceiling, then the (heavier) bag */let dx=this.p1.x-this.ax,dy=this.p1.y-this.ay,D=Math.hypot(dx,dy)||1e-6;let f=(D-this.L1)/D;this.p1.x-=dx*f;this.p1.y-=dy*f;
        dx=this.p2.x-this.p1.x;dy=this.p2.y-this.p1.y;D=Math.hypot(dx,dy)||1e-6;f=(D-this.L2)/D;this.p1.x+=dx*f*.25;this.p1.y+=dy*f*.25;this.p2.x-=dx*f*.75;this.p2.y-=dy*f*.75}}
    this.sq*=Math.exp(-dt*9);this.twv+=(-60*this.tw-4*this.twv)*dt;this.tw+=this.twv*dt}
  /* a strike: velocity added along the bag, weighted by where it landed (low hits swing the bottom more) */
  hit(px,py,dir,J){const t=clamp((this.p1.y-py)/this.L2,0,1);const dv=Math.min(1.7,J*.075);const h=1/60;/* one frame of added velocity (Verlet: shift the current position) */
    this.p1.x+=dir*dv*(1-t)*.3*h;this.p2.x+=dir*dv*(.45+t*.75)*h;this.sq=Math.min(1,this.sq+J/14);this.twv+=dir*J*.25}
  center(){return{x:(this.p1.x+this.p2.x)/2,y:(this.p1.y+this.p2.y)/2}}
  draw(ctx){const p1=this.p1,p2=this.p2;const dx=p2.x-p1.x,dy=p2.y-p1.y,L=Math.hypot(dx,dy)||1e-6,ux=dx/L,uy=dy/L,nx=-uy,ny=ux;
    /* shadow on the canvas */{const cx=p2.x,rx=.5;ctx.save();ctx.translate(cx,0);ctx.scale(1,.12);const g=ctx.createRadialGradient(0,0,0,0,0,rx);g.addColorStop(0,'rgba(40,30,22,.32)');g.addColorStop(1,'rgba(40,30,22,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,rx,0,7);ctx.fill();ctx.restore()}
    const Q=this.q==null?.5:this.q,T=Q<.34?0:Q<.7?1:2;const w=.17*(1+this.sq*.18),Lb=L*(1-this.sq*.05);const tw=clamp(this.tw,-.5,.5);
    /* ceiling mount bolted to the underside of the front beam, a main chain to a swivel, then 3-4 chains to the bag's top rim */
    ctx.lineCap='round';const ax=this.ax,ay=this.ay;ctx.fillStyle=T===2?'#9aa0aa':'#55504a';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(ax-.12,ay-.035,.24,.05,.02);ctx.fill();ctx.fillStyle='#2b2b2e';ctx.beginPath();ctx.arc(ax,ay-.045,.025,0,7);ctx.fill();
    const sw={x:p1.x-ux*.24,y:p1.y-uy*.24};const chainCol=T===0?'#8a7a62':T===1?'#6f737b':'#b9bec7';
    const chain=(a,b,wd)=>{const d=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(2,Math.round(d/.045));if(T===0){ctx.strokeStyle=chainCol;ctx.lineWidth=wd*1.2;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();return}
      ctx.strokeStyle=chainCol;ctx.lineWidth=wd*.55;const an=Math.atan2(b.y-a.y,b.x-a.x);for(let i=0;i<n;i++){const t=(i+.5)/n;ctx.beginPath();ctx.ellipse(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,d/n*.62,i%2?wd*.35:wd*.9,an,0,7);ctx.stroke()}};
    chain({x:ax,y:ay-.05},sw,.026);
    if(T===2){/* spring + swivel for the pro bag */ctx.strokeStyle='#d0d4da';ctx.lineWidth=.008;ctx.beginPath();for(let i=0;i<=10;i++){const t=i/10,yy=ay-.06-t*.12;ctx.lineTo(ax+(i%2?.02:-.02),yy)}ctx.stroke()}
    ctx.fillStyle=T===2?'#d7dbe1':'#7a7064';ctx.beginPath();ctx.arc(sw.x,sw.y,.028,0,7);ctx.fill();
    const nCh=T===0?3:4;for(let i=0;i<nCh;i++){const f=nCh===3?[-1,0,1][i]:[-1,-.35,.35,1][i];const rim={x:p1.x+nx*w*.9*f,y:p1.y+ny*w*.9*f};chain(sw,rim,.016)}
    /* bag body: a rounded capsule, squashed on impact, with a darker side plane, straps and a seam */
    ctx.save();ctx.translate(p1.x,p1.y);ctx.rotate(Math.atan2(uy,ux)+Math.PI/2);
    const body=(x0,w0,col)=>{ctx.fillStyle=col;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x0-w0,-Lb,w0*2,Lb+.02,[w0*.55,w0*.55,w0*.8,w0*.8]);else ctx.rect(x0-w0,-Lb,w0*2,Lb);ctx.fill()};
    const BC=[['#9b7b52','#7d613f','#ad8c62'],['#7a2626','#5f1c1c','#8f3030'],['#1d1e22','#121316','#2c2e34']][T];
    body(0,w,BC[0]);body(-w*.42+tw*.05,w*.58,BC[1]);ctx.fillStyle=BC[2];ctx.beginPath();if(ctx.roundRect)ctx.roundRect(w*.25+tw*.04,-Lb*.92,w*.32,Lb*.82,w*.16);ctx.fill();
    if(T===0){/* worn canvas: duct-tape patches */ctx.fillStyle='#8d9094';for(const[y,x0]of[[-Lb*.35,-.06],[-Lb*.7,.02]]){ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x0,y,.11,.07,.015);ctx.fill()}}
    if(T===2){/* leather with a colour band and a logo plate */ctx.fillStyle=this.col||'#3a7bd5';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(-w,-Lb*.56,w*2,.07,.02);ctx.fill();ctx.fillStyle='rgba(255,255,255,.85)';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(-w*.55,-Lb*.42,w*1.1,.1,.03);ctx.fill()}
    ctx.fillStyle=T===2?'#3a3c42':'#2a2422';for(const y of[-.06,-Lb+.1]){ctx.beginPath();if(ctx.roundRect)ctx.roundRect(-w-.005,y-.03,w*2+.01,.05,.025);ctx.fill()}
    ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(-.004+tw*.06,-Lb+.12,.008,Lb-.2,.004);ctx.fill();
    ctx.restore()}}
window.HeavyBag=HeavyBag;

/* ---------- match hooks ---------- */
const T=M=>M&&M.cfg&&M.cfg.training;
{const st=Match.prototype.step;Match.prototype.step=function(dt){const tr=T(this);if(!tr)return st.call(this,dt);
    const[a,b]=this.f;this.trn=this.trn||{hits:0,pow:0,best:0,pts:0,td:0,sw:0,sub:0,kd:0,stops:0};
    if(tr==='bag'){if(!this.bag){this.bag=new HeavyBag(.9);this.bag.q=this.cfg.gymQ!=null?this.cfg.gymQ:.5;this.bag.col=this.cfg.org&&this.cfg.org.col;b.hidden=1;if(b.ai)b.ai.update=function(){this.f.mvIn=0};b.noAct=1}
      this.bag.step(dt);this.clock=this.rules.len;/* no time limit: the session ends with the button */const c=this.bag.center();b.x=c.x;b.d=-1;b.vx=0;b.mvIn=0;b.act=null;b.guard=null;b.state='stand';b.hp={head:100,body:100,legs:100};b.sta=b.staMax;b.stun=0;b.rock=0;b.conc=0;b.down=null;b.body.rag=null}
    if(tr==='wrestle'&&this.phase==='fight'){const ai=this.f[this.pi==null?1:1-this.pi];if(ai&&!this.g&&ai.state==='stand'){const dd=ai.opp.x-ai.x,dist=Math.abs(dd);
        if(dist>1.15)ai.x+=Math.sign(dd)*dt*.9;/* the partner keeps coming forward */
        else if(Math.random()<dt*.9){if(dist<.95&&Math.random()<.45)this.clinch(ai);else{ai.act=null;this.shoot(ai)}}}}
    const r=st.call(this,dt);this.ref.hidden=tr==='bag'?1:0;return r}}
/* the bag is drawn on the backdrop (under the fighter), the hidden partner is not drawn */
{const fd=F2.prototype.draw;F2.prototype.draw=function(ctx,o){if(this.hidden)return;return fd.call(this,ctx,o)}}
{const db=Stage.prototype.drawBack;Stage.prototype.drawBack=function(){const r=db.apply(this,arguments);const M=this._match;if(M&&M.bag){const ctx=this.ctx;ctx.save();this.worldT(ctx);M.bag.draw(ctx);ctx.restore()}return r}}
{const rd=Match.prototype.render;Match.prototype.render=function(dt){this.stage._match=this;return rd.call(this,dt)}}
/* hits on the bag move the bag instead of hurting anyone */
{const oh=Match.prototype.onHit;Match.prototype.onHit=function(att,def,act,zone,p){const tr=T(this);if(tr!=='bag')return oh.call(this,att,def,act,zone,p);
    const h=act.c.hit;const kick=h.kind==='kick'||h.kind==='knee';const pw=(h.dmg||6)*(.55+ATT(att,kick?'kicking':'punchPow')*.75+ATT(att,'strength')*.2)*(.55+.45*att.sta/att.staMax);
    const pt=p||{x:this.bag.center().x,y:1.2};this.bag.hit(pt.x,pt.y,att.d,pw);const t=this.trn;t.hits++;t.pow+=pw;t.best=Math.max(t.best,pw);
    SFXI.play('hit',.55+Math.min(.5,pw/20));this.stage.impact(pt.x,pt.y,.6+pw/12,'#fff',att.d);this.hitstop=.03+Math.min(.05,pw/300);this.stage.shake=Math.min(.08,.02+pw/250);att.st&&att.st.land++;
    if(this.trnUI)this.trnUI()}}
/* wrestling: strikes off */
{const sk=F2.prototype.strike;F2.prototype.strike=function(key,M){if(M&&T(M)==='wrestle'&&!(MV[key]&&MV[key].grab))return false;if(this.noAct)return false;return sk.call(this,key,M)}}
{const gs=Match.prototype.gStrike;Match.prototype.gStrike=function(f,k,h){if(T(this)==='wrestle')return;return gs.call(this,f,k,h)}}
/* sparring: 16 oz gloves */
{const ad=Match.prototype.applyDmg;Match.prototype.applyDmg=function(att,def,o){if(T(this)==='spar')o=Object.assign({},o,{dmg:o.dmg*.4});return ad.call(this,att,def,o)}}
{const kn=Match.prototype.knock;Match.prototype.knock=function(def,att,ko,kind){const tr=T(this);if(tr==='bag'||tr==='wrestle')return;if(tr==='spar'){this.trn.kd++;ko=false}return kn.call(this,def,att,ko,kind)}}
/* scoring for the wrestling drill */
{const tdA=Match.prototype.startTdAnim;Match.prototype.startTdAnim=function(f,o,k){const r=tdA.apply(this,arguments);if(T(this)==='wrestle'&&f.isPlayer!==false&&this.pi!=null&&f===this.f[this.pi]){this.trn.td++;this.trn.pts+=2;this.trnUI&&this.trnUI()}return r}}
{const ap=Match.prototype.applyTrans;Match.prototype.applyTrans=function(f,to){const r=ap.apply(this,arguments);if(T(this)==='wrestle'&&this.pi!=null&&f===this.f[this.pi]){if(to==='sweep'){this.trn.sw++;this.trn.pts+=2}else if(to==='back'||to==='mount'){this.trn.pts+=3}else this.trn.pts+=1;this.trnUI&&this.trnUI()}return r}}
/* finishes do not end a training session; the clock does */
{const fin=Match.prototype.finish;Match.prototype.finish=function(w,method,detail,delay,extra){const tr=T(this);if(!tr)return fin.apply(this,arguments);
    if(method==='DEC'||method==='DRAW'||this._trnDone){return this.trnEnd()}
    /* a tap / stoppage in training: score it, reset both fighters and keep going */
    const P=this.pi!=null?this.f[this.pi]:null;if(method==='SUB'){if(w===P){this.trn.sub++;this.trn.pts+=4}this.ev(`🏳️ 탭 — ${detail||''} (훈련 계속)`)}else{this.trn.stops++;this.ev('✋ 스파링 중단 — 리셋')}
    this.g=null;this.subUI&&this.subUI(0);this.slow=0;this.stopping=null;for(const f of this.f){f.down=null;f.body.rag=null;f.body.ko=false;f.state='stand';f.act=null;f.gpose=null;f.gAtk=null;f.rock=0;f.stun=0;f.hp.head=Math.max(f.hp.head,60);f.hp.body=Math.max(f.hp.body,60);f.hp.legs=Math.max(f.hp.legs,60)}
    const[a,b]=this.f;const m=(a.x+b.x)/2;a.x=m-.9;b.x=m+.9;a.d=1;b.d=-1;this.trnUI&&this.trnUI()}}
{const er=Match.prototype.endRound;Match.prototype.endRound=function(){const tr=T(this);if(tr&&this.round>=this.rules.rounds){this._trnDone=1;return this.trnEnd()}return er.apply(this,arguments)}}
/* summary + career gains */
Match.prototype.trnEnd=function(){if(this._trnShown)return;this._trnShown=1;this.phase='end';const tr=T(this),t=this.trn||{};const P=this.pi!=null?this.f[this.pi]:this.f[0];SFXI.play('bell');
  const lines=tr==='bag'?[['타격 수',t.hits],['총 파워',Math.round(t.pow)],['최고 파워',Math.round(t.best)],['평균',t.hits?Math.round(t.pow/t.hits):0]]
    :tr==='wrestle'?[['포인트',t.pts],['테이크다운',t.td],['스윕',t.sw],['탭 받아냄',t.sub]]
    :[['유효타',P.st?P.st.sigL||0:0],['녹다운',t.kd],['스톱',t.stops],['포인트',(P.st?P.st.sigL||0:0)+t.kd*5]];
  const score=tr==='bag'?Math.min(120,t.pow/2):tr==='wrestle'?t.pts*3:(P.st?P.st.sigL||0:0)*.8+t.kd*6;
  const gain=this.cfg.onTrain?this.cfg.onTrain(tr,score):null;
  const ov=document.createElement('div');ov.className='trnov';ov.innerHTML=`<div class="trnc"><h2 class="H">${TRN[tr].n} 완료</h2><table>${lines.map(([k,v])=>`<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>${gain?`<p class="gain">${gain}</p>`:''}<button class="btn" data-ok>확인</button></div>`;
  this.root.appendChild(ov);ov.querySelector('[data-ok]').onclick=()=>{this.destroy();this.onEnd&&this.onEnd({training:tr,score,stats:t})}};
/* live counter */
{const bh=Match.prototype.buildHUD;Match.prototype.buildHUD=function(){const r=bh.apply(this,arguments);const tr=T(this);if(tr){if(tr==='bag'){/* no opponent: no opponent bars, no commentary log */const op=this.root.querySelector('.hp2.s1');if(op)op.style.display='none';this.ev=function(){};if(this.H&&this.H.log)this.H.log.style.display='none'}const d=document.createElement('div');d.className='trnhud';this.root.appendChild(d);
    this.trnUI=()=>{const t=this.trn||{};d.innerHTML=`<b>${TRN[tr].n}</b> `+(tr==='bag'?`시간 제한 없음 · 타격 ${t.hits||0} · 파워 ${Math.round(t.pow||0)} · 최고 ${Math.round(t.best||0)} <button class="trnend">종료</button>`:tr==='wrestle'?`포인트 ${t.pts||0} · TD ${t.td||0} · 스윕 ${t.sw||0} · 탭 ${t.sub||0}`:`녹다운 ${t.kd||0} · 스톱 ${t.stops||0}`)};this.trnUI();d.addEventListener('click',e=>{if(e.target.classList.contains('trnend'))this.trnEnd()})}return r}}
{const css=document.createElement('style');css.textContent=`.trnhud{position:absolute;left:50%;top:84px;transform:translateX(-50%);background:rgba(20,20,24,.78);color:#fff;padding:6px 14px;border-radius:999px;font:600 13px 'Noto Sans KR',sans-serif;z-index:30;white-space:nowrap}.trnhud .trnend{margin-left:8px;background:#d33;color:#fff;border:0;border-radius:999px;padding:3px 12px;font:700 12px sans-serif;cursor:pointer}
.trnov{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(10,10,14,.55);z-index:60}.trnc{background:#16171c;color:#fff;border-radius:18px;padding:24px 28px;min-width:280px;text-align:center}
.trnc table{margin:12px auto;border-collapse:collapse}.trnc th{text-align:left;padding:4px 18px 4px 0;color:#aaa;font-weight:500}.trnc td{text-align:right;font-weight:700}.trnc .gain{color:#7fe08a;font-size:13px}`;document.head.appendChild(css)}

/* ---------- launching a session ---------- */
window.startTraining=function(kind,fA,fB,opts){opts=opts||{};const C=TRN[kind];if(kind!=='bag'){/* headgear for wrestling and sparring */fA=Object.assign({},fA,{look:Object.assign({},fA.look,{headgear:'#b3261e'})});fB=Object.assign({},fB,{look:Object.assign({},fB.look,{headgear:'#1f4fa6'})})}const rules=Object.assign({},orgRules('UFC',2020,true),{rounds:C.rounds,len:C.len,firstLen:0,venue:'cage8',standup:30});
  const root=document.createElement('div');document.body.appendChild(root);
  new Match(root,{level:.3,org:{short:'GYM',col:'#3a7bd5'},title:C.n,wcName:'TRAINING',rules,player:0,diff:opts.diff||.8,training:kind,gymQ:opts.gymQ!=null?opts.gymQ:.5,onTrain:opts.onTrain,red:fA,blue:fB},res=>{root.remove();opts.done&&opts.done(res)})};

/* title screen: training menu (pick any roster fighter) */
window.trainingMenu=function(){const st={kind:'bag',y:2020,wc:'LW',a:null,b:null,gq:.5};
  const render=()=>{if(!GG||GG.quick!==st.y){GG={P:null,opt:{diff:1},quick:st.y};WW=new World(GG);WW.init(st.y)}
    const L=Object.values(GG.F).filter(f=>f.act&&f.wc===st.wc&&(f.real||f.r>70)).sort((a,b)=>b.r-a.r).slice(0,40);if(!st.a||!L.includes(st.a))st.a=L[0];if(!st.b||!L.includes(st.b)||st.b===st.a)st.b=L[1];
    const opt=(f,sel)=>`<option value="${f.id}" ${f===sel?'selected':''}>${flag(f.nat)} ${dn(f)}</option>`;
    app().innerHTML=`<div class="page"><div class="ph"><button class="back" data-bk>←</button><h2 class="H">훈련</h2></div>
      <div class="card"><div class="row wrap">${Object.entries(TRN).map(([k,c])=>`<button class="chip ${st.kind===k?'on':''}" data-k="${k}">${c.n}</button>`).join('')}</div>
      <p class="sm mu">${st.kind==='bag'?'트레이닝 센터에서 끈에 매달린 샌드백을 시간 제한 없이 칩니다 (종료 버튼). 타격 위치와 파워에 따라 흔들립니다.':st.kind==='wrestle'?'타격 없이 2분 동안 테이크다운·스윕·포지션·서브미션으로 포인트를 땁니다.':'16온스 글러브로 2분 2라운드. KO 없이 리셋됩니다.'}</p>
      ${st.kind==='bag'?`<div class="row wrap">${[[0,'동네 체육관'],[.5,'프로 짐'],[1,'엘리트 센터']].map(([v,n])=>`<button class="chip ${st.gq===v?'on':''}" data-gq="${v}">${n}</button>`).join('')}</div>`:''}
      <div class="row wrap">${WCK.map(k=>`<button class="chip ${k===st.wc?'on':''}" data-wc="${k}">${WC[k].n}</button>`).join('')}</div>
      <label>내 선수</label><select data-a>${L.map(f=>opt(f,st.a)).join('')}</select>${st.kind==='bag'?'':`<label>파트너</label><select data-b>${L.map(f=>opt(f,st.b)).join('')}</select>`}</div>
      <button class="btn big full" data-go>시작</button></div>`;
    const A=app();A.querySelector('[data-bk]').onclick=titleScreen;A.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{st.kind=b.dataset.k;render()});A.querySelectorAll('[data-gq]').forEach(b=>b.onclick=()=>{st.gq=+b.dataset.gq;render()});A.querySelectorAll('[data-wc]').forEach(b=>b.onclick=()=>{st.wc=b.dataset.wc;st.a=st.b=null;render()});
    A.querySelector('[data-a]').onchange=e=>{st.a=GG.F[e.target.value];render()};const sb=A.querySelector('[data-b]');if(sb)sb.onchange=e=>{st.b=GG.F[e.target.value];render()};
    const fx=f=>({name:dn(f),flag:flag(f.nat),rec:`${f.rec.w}-${f.rec.l}`,A:f.A,stance:hsh(f.n+'st')<.22?-1:1,look:lookFor(f)});
    A.querySelector('[data-go]').onclick=()=>startTraining(st.kind,fx(st.a),fx(st.b),{gymQ:st.gq,done:render})};
  render()};
})();
/* bag session: frame the whole training room so the ceiling, beams and bag mount are visible */
{const fo=Stage.prototype.follow;Stage.prototype.follow=function(dt,cx,span,ground){const r=fo.apply(this,arguments);const M=this._match;if(M&&M.cfg&&M.cfg.training==='bag'){const C=this.cam;const asp=(this.W||16)/(this.Hh||9);const k=Math.min(1,dt*3);C.w+=(3.75*asp-C.w)*k;C.gy+=(.9-C.gy)*k}return r}}
