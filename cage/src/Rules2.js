/* ===== Rules2.js : kickboxing rules, ring ropes, stage flashes, removal of text effects / weave / step, new touch controls =====
   • Kickboxing: no takedowns, no ground game; while a fighter is down the other one waits (nobody can act).
   • Ring ropes stretch when a fighter leans on them and spring back when he lets go.
   • Floating text effects, the weave / sway / step / step-bounce features are removed.
   • Controls: an evade button on the left (two charge dots above it) and three tactic keys on the right. */
(function(){
if(typeof Match==='undefined')return;
const isKick=M=>!!(M.cfg&&M.cfg.ruleset==='kick');

/* ---------- kickboxing ---------- */
for(const k of['shoot','startTdAnim','startTdFight','pounce']){const o=Match.prototype[k];if(!o)continue;Match.prototype[k]=function(){if(isKick(this))return;return o.apply(this,arguments)}}
{const sg=Match.prototype.startGround;Match.prototype.startGround=function(){if(isKick(this)){this.g=null;for(const f of this.f)if(f.state==='ground'||f.state==='sprawl')f.state='stand';return}return sg.apply(this,arguments)}}
/* while a fighter is down (the count), nobody acts: the standing fighter waits, the downed one cannot get up early */
{const st=Match.prototype.step;Match.prototype.step=function(dt){if(isKick(this)&&this.phase==='fight'){for(const f of this.f){const o=f.opp;const wait=!!(o.down&&!o.down.ko)||!!(f.down&&!f.down.ko&&f.down.t<.8);
      if(wait){f.mvIn=0;f.noActK=1;f.act=null;f.queue=[];f.guard=null}else f.noActK=0}}
  return st.call(this,dt)}}
{const sk=F2.prototype.strike;F2.prototype.strike=function(){if(this.noActK)return false;return sk.apply(this,arguments)}}
{const up=F2.prototype.update;F2.prototype.update=function(dt,M){if(this.noActK){this.mvIn=0;this.guard=null}return up.call(this,dt,M)}}

/* ---------- ring ropes: stretch while leaned on, spring back on release ---------- */
{const st=Match.prototype.step;Match.prototype.step=function(dt){const r=st.call(this,dt);const S=this.stage;
  if(S.sides===4&&S._rp&&S.xc){const rp=S._rp,lim=S.xc-.3;
    for(const e of[-1,1]){const R=e>0?rp.R:rp.L;let P=0;for(const f of this.f){if(f.state==='ground'||f.state==='down')continue;const pen=e*f.x-(lim-.3);if(pen>0)P=Math.max(P,Math.min(1,pen/.3))}
      const target=P*.22;R.v+=((target-R.x)*150-R.v*(P>0?20:5))*dt;R.x=Math.max(0,Math.min(.3,R.x+R.v*dt));
      for(const f of this.f){const over=e*f.x-lim;if(over>0&&R.v<-.05)f.x-=e*Math.min(.03,-R.v*dt*.6)}}}
  return r}}

/* ---------- camera flashes: many when someone is hurt or down ---------- */
{const ad=Match.prototype.applyDmg;Match.prototype.applyDmg=function(att,def,o){const r0=def.rock>0;const r=ad.call(this,att,def,o);if(!r0&&def.rock>0&&this.stage.flashBurst)this.stage.flashBurst(1.1);return r}}
{const kn=Match.prototype.knock;Match.prototype.knock=function(def,att,ko){const r=kn.apply(this,arguments);if(this.stage.flashBurst)this.stage.flashBurst(ko?2.4:1.4);return r}}

/* ---------- text effects off ---------- */
if(typeof UILabels!=='undefined'){UILabels.draw=function(){};UILabels.add=function(){}}
{const ev=Match.prototype.ev;const EMO=/[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;Match.prototype.ev=function(m){return ev.call(this,typeof m==='string'?m.replace(EMO,'').trim():m)}}

/* ---------- weave / sway / step / step-bounce: gone ---------- */
F2.prototype.headMove=function(){return false};
{const key=In2.prototype.key;In2.prototype.key=function(e,dn){const c=e.code;if(c==='KeyG'){if(dn&&!e.repeat)this.ev.push('evade');return}if(c==='KeyV'||c==='KeyQ'&&!this.k.KeyL&&0){return}
    if(dn&&!e.repeat){if(c==='Digit1')this.ev.push('tac:in');else if(c==='Digit2')this.ev.push('tac:out');else if(c==='Digit3')this.ev.push('tac:no')}return key.call(this,e,dn)}}
{const poll=In2.prototype.poll;In2.prototype.poll=function(){const ev=poll.call(this);const out=[];for(const e of ev){if(e==='evade'||e==='weave'||e==='sway')this.evReq=1;else if(typeof e==='string'&&e.startsWith('tac:'))this.tacReq=e.slice(4);else if(typeof e==='string'&&(e==='step'||e.startsWith('step:')))continue;else out.push(e)}return out}}
{const fw=F2.prototype.footwork;F2.prototype.footwork=function(p,dt){this.bounce=false;return fw.call(this,p,dt)}}

/* ---------- touch controls ---------- */
{const bt=In2.prototype.buildTouch;In2.prototype.buildTouch=function(){bt.call(this);const tc=this.tc;if(!tc)return;
  const box=tc.querySelector('.tr4');if(box){for(const b of[...box.children]){if(!b.classList.contains('stc'))b.remove()}
    box.insertAdjacentHTML('afterbegin','<button class="b4 tac" data-tac="in"><small>인파이트</small></button><button class="b4 tac" data-tac="out"><small>아웃파이트</small></button><button class="b4 tac" data-tac="no"><small>노가드</small></button>');
    for(const b of box.querySelectorAll('[data-tac]')){b.addEventListener('touchstart',e=>{e.preventDefault();this.ev.push('tac:'+b.dataset.tac)},{passive:false});b.addEventListener('click',()=>{if(!('ontouchstart' in window))this.ev.push('tac:'+b.dataset.tac)})}}
  const ev=document.createElement('div');ev.className='evw';ev.innerHTML='<div class="dots"><i data-d="0"></i><i data-d="1"></i></div><button class="evb" data-evade><span class="fill"></span><small>회피</small></button>';tc.appendChild(ev);
  const b=ev.querySelector('[data-evade]');b.addEventListener('touchstart',e=>{e.preventDefault();this.ev.push('evade')},{passive:false});b.addEventListener('click',()=>{if(!('ontouchstart' in window))this.ev.push('evade')})}}
{const css=document.createElement('style');css.textContent=
 '.b4.tac{width:84px;height:46px;border-radius:12px}.b4.tac small{margin:0;font-size:12px;letter-spacing:.04em}.b4.tac.on{border-color:#e9c45a;background:rgba(233,196,90,.28)}'+
 '.evw{position:absolute;left:max(18px,calc(env(safe-area-inset-left) + 14px));bottom:calc(max(10px,env(safe-area-inset-bottom)) + var(--padH,372px) + 40px);display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:auto;z-index:3}'+
 '.evw .dots{display:flex;gap:10px}.evw .dots i{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.55);background:rgba(255,255,255,.12)}.evw .dots i.on{background:#7fd8ff;border-color:#d8f3ff;box-shadow:0 0 8px #7fd8ff}'+
 '.evw .evb{position:relative;overflow:hidden;width:84px;height:84px;border-radius:50%;border:2px solid rgba(255,255,255,.55);background:rgba(14,16,22,.66);color:#fff;display:flex;align-items:center;justify-content:center;touch-action:none}'+
 '.evw .evb .fill{position:absolute;left:0;right:0;bottom:0;height:0;background:linear-gradient(0deg,rgba(127,216,255,.55),rgba(127,216,255,.18));transition:height .1s linear}.evw .evb small{position:relative;font:500 13px "Noto Sans KR",sans-serif;letter-spacing:.12em}.evw .evb:active{border-color:#fff}'+
 '.mgr .evw,.mcl .evw{opacity:.3;pointer-events:none}';document.head.appendChild(css)}
/* HUD: charge dots and the cooldown fill follow the player's evade state */
{const hd=Match.prototype.hud;Match.prototype.hud=function(dt){const r=hd.call(this,dt);if(this.pi==null||!this.inp||!this.inp.tc)return r;const f=this.f[this.pi],ev=this.inp.tc.querySelector('.evw');if(!ev||!f.evCh)return r;
  const now=this.t2();const ready=f.evCh.map(t=>t<=now);ev.querySelectorAll('.dots i').forEach((d,i)=>d.classList.toggle('on',!!ready[i]));
  const next=Math.min(...f.evCh.filter(t=>t>now),Infinity);const fill=ev.querySelector('.fill');if(fill)fill.style.height=(ready.every(x=>x)?100:ready.some(x=>x)?100:(1-clamp((next-now)/4.5,0,1))*100)+'%';
  const bs=this.inp.tc.querySelectorAll('[data-tac]');bs.forEach(b=>b.classList.toggle('on',f.tactic===b.dataset.tac));return r}}
})();
