/* ===== Touch2.js : the touch controls, rebuilt: black, quiet, text only; every button always on screen =====
   Left: floating stick + the evade button (with its two charge dots). Right: the action pad. Top right: tactics + stance.
   Sizes follow the viewport height (--u), so a phone in landscape shows all of it. No emoji anywhere (a small observer also
   strips any that old code still writes into the page). */
(function(){
if(typeof In2==='undefined')return;
const EMO=/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{23E9}-\u{23FA}\u{FE0F}\u{200D}]/gu;
const REPL={'🎵':'음악','🔇':'음소거','⛶':'전체화면','⏩':'','▶':''};
const clean=s=>s.replace(EMO,m=>REPL[m]!=null?REPL[m]:'');
function sweep(root){const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const L=[];let n;while(n=w.nextNode())if(EMO.test(n.nodeValue)){EMO.lastIndex=0;L.push(n)}EMO.lastIndex=0;for(const t of L){const v=clean(t.nodeValue);if(v!==t.nodeValue)t.nodeValue=v}}
{let pend=0;const mo=new MutationObserver(()=>{if(pend)return;pend=1;setTimeout(()=>{pend=0;try{sweep(document.body)}catch(e){}},250)});/* throttled: the HUD mutates every frame */mo.observe(document.body,{childList:true,subtree:true,characterData:true})}

const LABELS={stand:{td:'테이크다운',clinch:'클린치',punch:'펀치',jab:'잽',kick:'킥',block:'가드'},ground:{td:'연타',clinch:'클린치',punch:'전환',jab:'서브미션',kick:'파운딩',block:'방어'},clinch:{td:'길로틴',clinch:'탈출',punch:'펀치',jab:'잽',kick:'니킥',block:'탈출'}};
In2.prototype.setMode=function(mode){if(!this.tc||this.mode===mode)return;this.mode=mode;const L=LABELS[mode]||LABELS.stand;
  for(const b of this.tc.querySelectorAll('[data-a]')){const l=L[b.dataset.a];const s=b.querySelector('small');if(l&&s)s.textContent=l}
  this.tc.querySelectorAll('.sw').forEach(s=>s.style.opacity=mode==='stand'?1:0);this.tc.classList.toggle('mcl',mode==='clinch');this.tc.classList.toggle('mgr',mode==='ground')};
In2.prototype.buildTouch=function(){const tc=document.createElement('div');tc.className='tc2 t2ui';this.tc=tc;
  tc.innerHTML=`<div class="tz" data-z><div class="tbase"><div class="tknob"></div></div></div>
  <div class="evw"><div class="dots"><i></i><i></i></div><button class="evb" data-evade><span class="fill"></span><small>회피</small></button></div>
  <div class="tacs"><button data-tac="in">인파이트</button><button data-tac="out">아웃파이트</button><button data-tac="no">노가드</button><button data-stance>스탠스</button></div>
  <div class="act">
    <button data-a="td" class="ab ab-td"><small>테이크다운</small><i class="sw su">싱글</i><i class="sw sd">더블</i></button>
    <button data-a="clinch" class="ab ab-cl"><small>클린치</small></button>
    <button data-a="punch" class="ab ab-pu"><small>펀치</small><i class="sw sl">훅</i><i class="sw sr">어퍼</i><i class="sw su">오버</i><i class="sw sd">바디</i></button>
    <button data-a="jab" class="ab ab-ja"><small>잽</small><i class="sw sl">훅</i><i class="sw sr">어퍼</i><i class="sw sd">바디</i></button>
    <button data-a="kick" class="ab ab-ki"><small>킥</small><i class="sw sl">하이</i><i class="sw sr">로우</i><i class="sw su">오블</i><i class="sw sd">니킥</i></button>
    <button data-a="block" class="ab ab-bl" data-gd=""><small>가드</small><i class="sw su">상단</i><i class="sw sd">하단</i><em class="gd"><u></u><u></u><u></u></em></button>
  </div>`;
  this.root.appendChild(tc);
  /* stick */
  const z=tc.querySelector('[data-z]'),base=tc.querySelector('.tbase'),knob=tc.querySelector('.tknob');let id=null,ox=0,oy=0;
  z.addEventListener('touchstart',e=>{e.preventDefault();const t=e.changedTouches[0];id=t.identifier;ox=t.clientX;oy=t.clientY;const r=z.getBoundingClientRect();base.style.left=(ox-r.left)+'px';base.style.top=(oy-r.top)+'px';base.classList.add('on');this.tmx=0;this.tmy=0},{passive:false});
  z.addEventListener('touchmove',e=>{e.preventDefault();for(const t of e.changedTouches){if(t.identifier!==id)continue;const dx=t.clientX-ox,dy=t.clientY-oy;const L=Math.hypot(dx,dy),m=Math.min(1,L/50);const a=Math.atan2(dy,dx);knob.style.transform=`translate(${Math.cos(a)*m*45}px,${Math.sin(a)*m*45}px)`;
    const ux=L?dx/L*m:0,uy=L?-dy/L*m:0;this.tmx=Math.abs(ux)>.2?ux:0;this.tmy=Math.abs(uy)>.35?uy:0}},{passive:false});
  const end=e=>{for(const t of e.changedTouches){if(t.identifier!==id)continue;id=null;this.tmx=null;knob.style.transform='';base.classList.remove('on')}};z.addEventListener('touchend',end);z.addEventListener('touchcancel',end);
  const vib=()=>{if(navigator.vibrate)try{navigator.vibrate(8)}catch(_){}};
  /* action buttons with swipes */
  for(const b of tc.querySelectorAll('[data-a]')){const a=b.dataset.a;let sx=0,sy=0,sid=null,fired=false;const sw=()=>(a==='punch'||a==='kick'||a==='block'||a==='jab'||a==='td')&&this.mode!=='ground'&&this.mode!=='clinch';
    b.addEventListener('touchstart',e=>{e.preventDefault();const t=e.changedTouches[0];sid=t.identifier;sx=t.clientX;sy=t.clientY;fired=false;b.classList.add('on');vib();
      if(a==='block'){this.tblock=true;this.tgtype='mid';this.ev.push('blockp')}else if((a==='punch'||a==='kick'||a==='jab'||a==='td')&&sw()){/* decided on move / release */}else this.ev.push(a==='punch'?'punch:straight':a)},{passive:false});
    b.addEventListener('touchmove',e=>{e.preventDefault();if(!sw())return;for(const t of e.changedTouches){if(t.identifier!==sid)continue;const dx=t.clientX-sx,dy=t.clientY-sy;
      if(a==='block'){if(Math.max(Math.abs(dx),Math.abs(dy))>18){const h=Math.abs(dx)>=Math.abs(dy);this.tgtype=h?'mid':(dy>0?'low':'top')}continue}
      if(fired||Math.max(Math.abs(dx),Math.abs(dy))<22)continue;fired=true;const h=Math.abs(dx)>=Math.abs(dy);
      if(a==='td')this.ev.push(h?'td':(dy<0?'td:single':'td:double'));else if(a==='jab')this.ev.push(h?(dx<0?'jab:hook':'jab:upper'):(dy>0?'jab:body':'jab'));else if(a==='punch')this.ev.push('punch:'+(h?(dx<0?'hook':'upper'):(dy<0?'over':'body')));else this.ev.push('kick:'+(h?(dx<0?'high':'low'):(dy<0?'calf':'knee')))}},{passive:false});
    const up=e=>{e.preventDefault();if(a==='block'){this.tblock=false;this.tgtype=null}if((a==='punch'||a==='kick'||a==='jab'||a==='td')&&sw()&&!fired)this.ev.push(a==='punch'?'punch:straight':a==='jab'?'jab':a==='td'?'td':'kick:mid');b.classList.remove('on')};b.addEventListener('touchend',up);b.addEventListener('touchcancel',up)}
  /* evade, tactics, stance */
  const ev=tc.querySelector('[data-evade]');ev.addEventListener('touchstart',e=>{e.preventDefault();ev.classList.add('on');vib();this.ev.push('evade')},{passive:false});ev.addEventListener('touchend',()=>ev.classList.remove('on'));ev.addEventListener('click',()=>{if(!('ontouchstart' in window))this.ev.push('evade')});
  for(const b of tc.querySelectorAll('[data-tac]')){b.addEventListener('touchstart',e=>{e.preventDefault();vib();this.ev.push('tac:'+b.dataset.tac)},{passive:false});b.addEventListener('click',()=>{if(!('ontouchstart' in window))this.ev.push('tac:'+b.dataset.tac)})}
  const st=tc.querySelector('[data-stance]');const go=()=>{const M=window.__curMatch;if(M&&M.pi!=null&&M.switchStance)M.switchStance(M.f[M.pi])};st.addEventListener('touchstart',e=>{e.preventDefault();vib();go()},{passive:false});st.addEventListener('click',()=>{if(!('ontouchstart' in window))go()});
  this.mode=null;this.setMode('stand')};
/* HUD: evade charges / cooldown fill, tactic highlight, the current guard direction on the guard button, and a guard bar that grows with in-fighting */
{const hd=Match.prototype.hud;Match.prototype.hud=function(dt){const r=hd.call(this,dt);const H=this.H;
  this.f.forEach((f,i)=>{const w=H&&H.root.querySelector('.hp2.s'+i+' .hgst');if(!w)return;const base=(f._gM0||f.gMax*2)*.5;const k=clamp(f.gMax/base,.6,2);w.style.width=Math.min(100,52*k)+'%';w.style.transition='width .25s';const s=w.firstElementChild;if(s)s.className=f._gBroken?'brk':''});
  if(this.pi==null||!this.inp||!this.inp.tc)return r;const f=this.f[this.pi],tc=this.inp.tc;const now=this.t2();
  if(f.evCh){const ready=f.evCh.map(t=>t<=now);tc.querySelectorAll('.evw .dots i').forEach((d,i)=>d.classList.toggle('on',!!ready[i]));const next=Math.min(...f.evCh.filter(t=>t>now),Infinity);const fill=tc.querySelector('.evw .fill');if(fill)fill.style.height=(ready.some(x=>x)?100:(1-clamp((next-now)/4.5,0,1))*100)+'%';tc.querySelector('.evb').classList.toggle('act',f.evT>0)}
  tc.querySelectorAll('[data-tac]').forEach(b=>b.classList.toggle('on',f.tactic===b.dataset.tac));const bl=tc.querySelector('[data-a=block]');if(bl)bl.dataset.gd=f._gBroken?'broken':f.guard||(f.guardHeld?'broken':'');return r}}
{const css=document.createElement('style');css.textContent=`
.t2ui{--u:clamp(44px,12vh,88px);font-family:'Noto Sans KR',system-ui,sans-serif}
.t2ui .tz{width:46%;height:70%}
.t2ui .tbase{border:1px solid rgba(255,255,255,.28);background:rgba(8,8,10,.35)}.t2ui .tknob{background:rgba(8,8,10,.8);border:1px solid rgba(255,255,255,.55)}
.t2ui .act{position:absolute;right:max(10px,env(safe-area-inset-right));bottom:max(8px,env(safe-area-inset-bottom));width:calc(var(--u)*5.2);height:calc(var(--u)*4.35);pointer-events:none}
.t2ui .ab{position:absolute;pointer-events:auto;border:1px solid rgba(255,255,255,.36);background:rgba(8,8,10,.8);color:#ececf0;display:flex;align-items:center;justify-content:center;touch-action:none;-webkit-tap-highlight-color:transparent;padding:0;border-radius:50%;cursor:pointer}
.t2ui .ab small{font:500 calc(var(--u)*.2)/1 'Noto Sans KR',sans-serif;letter-spacing:.06em;margin:0;pointer-events:none}
.t2ui .ab.on{background:rgba(236,236,240,.92);color:#050506;border-color:#fff}
.t2ui .ab-td,.t2ui .ab-cl{width:calc(var(--u)*1.75);height:calc(var(--u)*.62);border-radius:4px;top:0}.t2ui .ab-td{left:0}.t2ui .ab-cl{right:0}
.t2ui .ab-pu{width:calc(var(--u)*1.38);height:calc(var(--u)*1.38);left:calc(var(--u)*1.91);top:calc(var(--u)*1.0)}
.t2ui .ab-ja{width:calc(var(--u)*1.15);height:calc(var(--u)*1.15);left:calc(var(--u)*.38);top:calc(var(--u)*2.55)}
.t2ui .ab-ki{width:calc(var(--u)*1.15);height:calc(var(--u)*1.15);right:calc(var(--u)*.38);top:calc(var(--u)*2.55)}
.t2ui .ab-bl{width:calc(var(--u)*1.15);height:calc(var(--u)*1.15);left:calc(var(--u)*2.02);top:calc(var(--u)*3.2)}
.t2ui .sw{width:auto!important;height:auto!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:none!important;cursor:default;position:absolute;font:500 calc(var(--u)*.14)/1 'Noto Sans KR',sans-serif;color:rgba(222,222,232,.85);pointer-events:none;font-style:normal;white-space:nowrap;transition:opacity .2s;letter-spacing:.04em}
.t2ui .sl{right:100%;top:50%;transform:translateY(-50%);margin-right:3px}.t2ui .sr{left:100%;top:50%;transform:translateY(-50%);margin-left:3px}.t2ui .su{bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:1px}.t2ui .sd{top:100%;left:50%;transform:translateX(-50%);margin-top:1px}
.t2ui .ab-td .su{bottom:100%;left:25%;transform:translateX(-50%)}.t2ui .ab-td .sd{top:auto;bottom:100%;left:75%;transform:translateX(-50%)}
.t2ui .ab-ja .sl{margin-right:2px}
.t2ui .gd{position:absolute;right:calc(var(--u)*.1);top:calc(var(--u)*.3);display:flex;flex-direction:column;gap:3px;font-style:normal;pointer-events:none}.t2ui .gd u{display:block;width:calc(var(--u)*.14);height:calc(var(--u)*.09);background:rgba(255,255,255,.18)}
.t2ui .ab-bl[data-gd=top] .gd u:nth-child(1),.t2ui .ab-bl[data-gd=mid] .gd u:nth-child(2),.t2ui .ab-bl[data-gd=low] .gd u:nth-child(3){background:#e9c45a}.t2ui .ab-bl[data-gd=broken]{border-color:#c0392b}
.t2ui .evw{position:absolute;left:max(14px,calc(env(safe-area-inset-left) + 10px));top:46%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:7px;pointer-events:auto;z-index:4}
.t2ui .evw .dots{display:flex;gap:9px}.t2ui .evw .dots i{width:calc(var(--u)*.18);height:calc(var(--u)*.18);border-radius:50%;border:1px solid rgba(255,255,255,.6);background:transparent}.t2ui .evw .dots i.on{background:#e9e9ec;border-color:#fff}
.t2ui .evb{position:relative;overflow:hidden;width:calc(var(--u)*1.15);height:calc(var(--u)*1.15);border-radius:50%;border:1px solid rgba(255,255,255,.4);background:rgba(8,8,10,.8);color:#ececf0;touch-action:none;padding:0}
.t2ui .evb .fill{position:absolute;left:0;right:0;bottom:0;height:0;background:rgba(236,236,240,.28);transition:height .1s linear}.t2ui .evb small{position:relative;font:500 calc(var(--u)*.2)/1 'Noto Sans KR',sans-serif;letter-spacing:.1em}.t2ui .evb.on,.t2ui .evb.act{border-color:#fff;background:rgba(236,236,240,.85);color:#050506}
.t2ui .tacs{position:absolute;right:max(10px,env(safe-area-inset-right));top:max(86px,21vh);display:flex;gap:6px;pointer-events:auto}
.t2ui .tacs button{height:calc(var(--u)*.5);min-height:28px;padding:0 11px;border:1px solid rgba(255,255,255,.34);background:rgba(8,8,10,.8);color:#ececf0;font:500 calc(var(--u)*.17)/1 'Noto Sans KR',sans-serif;letter-spacing:.05em;border-radius:3px;white-space:nowrap;touch-action:none}.t2ui .tacs button.on{background:rgba(236,236,240,.92);color:#050506;border-color:#fff}
.t2ui.mgr .evw,.t2ui.mcl .evw{opacity:.35;pointer-events:none}.t2ui.mgr .tacs,.t2ui.mcl .tacs{opacity:.35;pointer-events:none}
.htop button{background:rgba(8,8,10,.8)!important;border:1px solid rgba(255,255,255,.3)!important;color:#ececf0!important;border-radius:3px!important;font:500 12px 'Noto Sans KR',sans-serif!important;width:auto!important;min-width:34px;padding:0 9px}
`;document.head.appendChild(css)}
})();
