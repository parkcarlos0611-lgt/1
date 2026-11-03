/* ===== UIManager.js : touch HUD additions, input bindings, combat read-outs =====
   Touch (landscape): a 2×2 cluster next to the action pad — ⇄ 스텝 (direction from the stick; neutral =
     backstep), 🎭 페인트, ⤵ 위브, ↶ 스웨이. Events go through the same In2 queue as keys, so the input
     buffer / cancel windows apply identically. Buttons fire on touchstart (no click delay) with a short
     vibration; the pad shrinks on short screens like the main pad.
   Keyboard: Shift+A/D or double-tap = quick step · B = feint · G / V = weave / sway (plus existing keys).
   HUD: stamina bar pulses red and shows GASSED when the fighter is gassed, amber while over the spam
     limit; floating labels over the impact point for the player's exchanges (COUNTER / WHIFF PUNISH /
     SWEET SPOT / JAMMED / PARRY / FEINT). Help tables list the new controls. */
(function(){const css=document.createElement('style');css.textContent=`
.tr4{position:absolute;right:max(360px,calc(env(safe-area-inset-right) + 356px));bottom:max(12px,env(safe-area-inset-bottom));display:grid;grid-template-columns:62px 62px;gap:8px;pointer-events:auto}
.b4{width:62px;height:58px;border-radius:14px;border:2px solid rgba(255,255,255,.35);background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.2),rgba(14,16,22,.62) 62%);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;touch-action:none;padding:0;transition:transform .06s}
.b4 b{font-size:20px;font-weight:400}.b4 small{font:600 10px 'Noto Sans KR',sans-serif;margin-top:3px}.b4.on{transform:scale(.9);border-color:#fff;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.4),rgba(242,181,68,.6) 62%)}
.b4.stp{border-color:rgba(120,220,255,.8)}.b4.fnt{border-color:rgba(255,160,230,.8)}.b4.wv,.b4.sy{border-color:rgba(160,255,190,.75)}
@media (max-height:420px){.tr4{transform:scale(.8);transform-origin:right bottom;right:max(272px,calc(env(safe-area-inset-right) + 268px))}}
@media (max-height:360px){.tr4{transform:scale(.7);right:max(236px,calc(env(safe-area-inset-right) + 232px))}}
.mcl .tr4 .stp,.mcl .tr4 .fnt{opacity:.25;pointer-events:none}
.hp2.gas .hsta s{background:linear-gradient(90deg,#c21818,#ff5a3a)!important;animation:gaspulse .5s infinite alternate}.hp2.spam .hsta s{background:linear-gradient(90deg,#e08a1a,#ff3a1a)!important}
.hp2 .gtag{display:none;font:700 10px Oswald,sans-serif;letter-spacing:.12em;color:#ff6a50;margin-top:2px}.hp2.gas .gtag{display:block}.s1 .gtag{text-align:right}
@keyframes gaspulse{to{opacity:.55}}`;document.head.appendChild(css)})();
/* touch cluster */
{const bt=In2.prototype.buildTouch;In2.prototype.buildTouch=function(){bt.call(this);const tc=this.tc;if(!tc)return;const box=document.createElement('div');box.className='tr4';
  box.innerHTML=`<button class="b4 stp" data-p="step"><b>⇄</b><small>스텝</small></button><button class="b4 fnt" data-p="feint"><b>🎭</b><small>페인트</small></button><button class="b4 wv" data-p="weave"><b>⤵</b><small>위브</small></button><button class="b4 sy" data-p="sway"><b>↶</b><small>스웨이</small></button>`;tc.appendChild(box);
  for(const b of box.querySelectorAll('[data-p]')){const a=b.dataset.p;b.addEventListener('touchstart',e=>{e.preventDefault();b.classList.add('on');if(navigator.vibrate)try{navigator.vibrate(6)}catch(_){}
      if(a==='step'){const mx=this.tmx||0;this.ev.push('step:'+(Math.abs(mx)>.2?Math.sign(mx):0))}else this.ev.push(a)},{passive:false});
    const up=e=>{e.preventDefault();b.classList.remove('on')};b.addEventListener('touchend',up);b.addEventListener('touchcancel',up)}}}
/* HUD: gassed / spam state on the stamina bar */
{const bh=Match.prototype.buildHUD;Match.prototype.buildHUD=function(){const r=bh.apply(this,arguments);this.H.root.querySelectorAll('.hp2').forEach(p=>p.insertAdjacentHTML('beforeend','<div class="gtag">GASSED</div>'));return r}}
{const hd=Match.prototype.hud;Match.prototype.hud=function(dt){const r=hd.call(this,dt);if(!this.H)return r;this.f.forEach((f,i)=>{const p=this.H.root.querySelector('.hp2.s'+i);if(!p)return;p.classList.toggle('gas',typeof Pacing!=='undefined'&&Pacing.gassed(f));p.classList.toggle('spam',(f.spam||0)>0)});return r}}
/* floating combat labels near the impact point (player's exchanges only) */
const UILabels={add(M,x,y,text,col){(M._lbl=M._lbl||[]).push({x,y,text,col,t:0})},
  draw(M){const L=M._lbl;if(!L||!L.length)return;const S=M.stage,ctx=S.ctx,m=(()=>{ctx.save();S.worldT(ctx);const t=ctx.getTransform();ctx.restore();return t})();
    ctx.save();ctx.setTransform(1,0,0,1,0,0);for(const l of L){l.t+=1/60;const k=l.t/.9;if(k>=1)continue;const p=m.transformPoint(new DOMPoint(l.x,l.y));const dpr=S.dpr;
      ctx.globalAlpha=k<.15?k/.15:1-Math.max(0,k-.5)/.5;ctx.font=`700 ${Math.round(15*dpr*(1+(k<.15?(.15-k)*2:0)))}px Oswald,Impact,sans-serif`;ctx.textAlign='center';ctx.lineWidth=3*dpr;ctx.strokeStyle='rgba(0,0,0,.75)';ctx.fillStyle=l.col;
      const y=p.y-(28+k*26)*dpr;ctx.strokeText(l.text,p.x,y);ctx.fillText(l.text,p.x,y)}ctx.restore();M._lbl=L.filter(l=>l.t<.9)}};
{const ad=Match.prototype.applyDmg;Match.prototype.applyDmg=function(att,def,o){const r=ad.call(this,att,def,o);if(this.pi!=null&&(att.isPlayer||def.isPlayer)&&!o.blocked){const J=def.body.J,p=o.zone==='head'?J.hd:o.zone==='body'?J.mid:J.lK;const t=o.tags||[];const me=att.isPlayer;
    const lab=t.includes('whiff')?['WHIFF PUNISH','#7fffd4']:o.counter?['COUNTER','#ffd84a']:t.includes('sweet')&&o.dmg>6?['SWEET SPOT','#fff']:t.includes('jam')?['JAMMED','#aab']:null;if(lab&&p)UILabels.add(this,p.x,p.y,lab[0],me?lab[1]:'#ff8a7a')}return r}}
{const ev=Match.prototype.ev;Match.prototype.ev=function(s){const r=ev.call(this,s);if(this.pi!=null&&typeof s==='string'){const f=this.f[this.pi];if(/패리/.test(s)&&f)UILabels.add(this,f.body.J.hd.x,f.body.J.hd.y,'PARRY','#7fffd4');if(/페인트에 반응/.test(s)){const o=s.includes(f.name)?f:f.opp;UILabels.add(this,o.body.J.hd.x,o.body.J.hd.y,'BIT ON FEINT','#ff9ae6')}}return r}}
{const rd=Match.prototype.render;Match.prototype.render=function(dt){rd.call(this,dt);try{UILabels.draw(this)}catch(e){}}}
/* help tables */
{const hp=Match.prototype.help;Match.prototype.help=function(){hp.call(this);const t=this.H.ov.querySelector('.hlp');if(t)t.insertAdjacentHTML('beforeend',[['퀵 스텝 (인·아웃)','⇄ 스텝 + 스틱 방향','Shift+A/D · A/D 두 번'],['페인트','🎭 페인트','B']].map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join(''))}}
{const ch=ctrlHelp;ctrlHelp=function(){ch();const m=document.querySelector('.modal:last-of-type .ctrl');if(m)m.insertAdjacentHTML('beforeend',[['퀵 스텝 (인·아웃)','Shift+A/D · A/D 두 번','—','⇄ 스텝'],['페인트','B','—','🎭 페인트']].map(r=>`<div><b>${r[0]}</b><span>⌨️ ${r[1]}</span><span>🎮 ${r[2]}</span><span>📱 ${r[3]}</span></div>`).join(''));
  const box=document.querySelector('.modal:last-of-type .mbox');if(box)box.insertAdjacentHTML('beforeend','<p style="font-size:12px;opacity:.85">거리 싸움: 상대 사거리 밖에서 기다리다 스텝으로 들어가 치고 빠지세요. 헛친 공격은 큰 틈을 만들고, 무작정 연타하면 스태미나가 바닥나 맞을 때 더 아프고 쉽게 다운돼요. 잽이 맞으면 다음 강타가 강해집니다.</p>')}}
