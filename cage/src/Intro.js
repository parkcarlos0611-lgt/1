/* ===== Intro.js : the pre-fight introduction card =====
   Before round 1 the fight stops on a stats card (record, age, height / weight, reach, style) with a body portrait of each fighter.
   A rank can be typed for each fighter before the fight (saved by name); the card then shows it next to the name.
   Press START (or Enter / Space) to begin. Training and simulated fights skip the card. */
(function(){
if(typeof Match==='undefined'||typeof FDB==='undefined')return;
const STY={box:'복싱',kb:'킥복싱',mt:'무에타이',wr:'레슬링',bjj:'주짓수',judo:'유도',sambo:'삼보',kar:'가라데',tkd:'태권도',catch:'캐치레슬링',str:'타격',mma:'MMA'};
const hs=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0)/4294967296};
const getRank=n=>{try{return localStorage.getItem('cl_rank_'+n)||''}catch(e){return''}},setRank=(n,v)=>{try{localStorage.setItem('cl_rank_'+n,v)}catch(e){}};
window.fighterStats=function(c,wcKey){const r=FDB.find(x=>x.ko===c.name||x.n===c.name)||null;const wc=r?WC[r.wc]:null;const hm=(c.look&&c.look.h)||1.8;
  const h=Math.round(hm*100*10)/10;const w=wc?Math.round((wc.lb*.4536+ (hs((r&&r.n||c.name)+'w')*3.5))*10)/10:Math.round(hm*55);const reach=Math.round(h*(1+.015+hs((r&&r.n||c.name)+'r')*.055)*10)/10;
  const rec=r?`${r.frec.w}승 ${r.frec.l}패${r.frec.d?` ${r.frec.d}무`:''}`:(c.rec||'—');const age=r?Math.max(18,2025-r.by):Math.round(24+hs(c.name)*10);
  return{name:c.name,flag:c.flag||'',rec,age,h,w,reach,style:r?r.st.slice(0,2).map(x=>STY[x]||x).join(" / "):'MMA',key:r?r.n:c.name}};
function bust(canvas,f){const g=canvas.getContext('2d'),B=f.body;if(!B||!B.J||!B.J.hd)return;g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,canvas.width,canvas.height);
  const J=B.J,top=J.hd.y+.1*B.H,bot=J.hip.y-.05*B.H;const s=canvas.height/(top-bot);g.setTransform(s,0,0,-s,canvas.width/2-J.mid.x*s,top*s);try{B.draw(g,{noShadow:true,corner:f.corner})}catch(e){}g.setTransform(1,0,0,1,0,0)}
{const bh=Match.prototype.buildHUD;Match.prototype.buildHUD=function(){const r=bh.apply(this,arguments);const M=this;
  if(M.cfg.training||M.cfg.noIntro||M.quickEnd||M.phase!=='intro')return r;M._hold=true;
  const S=[fighterStats(M.cfg.red),fighterStats(M.cfg.blue)],org=(M.cfg.org&&M.cfg.org.short)||'FIGHT';
  const card=document.createElement('div');card.className='icard';
  const side=i=>`<div class="ic-s ic-s${i}"><canvas width="520" height="460"></canvas><div class="ic-n"><span class="ic-rk"><input maxlength="3" placeholder="순위" value="${getRank(S[i].key)}" data-rk="${i}"></span><b>${S[i].name}</b></div></div>`;
  const row=(l,a,b)=>`<div class="ic-r"><span>${a}</span><i>${l}</i><span>${b}</span></div>`;
  card.innerHTML=`<div class="ic-top"><b>${org}</b><span>${M.cfg.title||''} · ${M.cfg.wcName||''}</span></div><div class="ic-body">${side(0)}<div class="ic-mid">${row('전적',S[0].rec,S[1].rec)}${row('나이',S[0].age,S[1].age)}${row('신장 / 체중',`${S[0].h}cm / ${S[0].w}kg`,`${S[1].h}cm / ${S[1].w}kg`)}${row('리치',S[0].reach+'cm',S[1].reach+'cm')}${row('스타일',S[0].style,S[1].style)}<div class="ic-tip">순위 칸에 직접 입력할 수 있습니다 (예: 1, 5, C)</div></div>${side(1)}</div><button class="ic-go">경기 시작</button>`;
  if(!document.getElementById('iccss')){const st=document.createElement('style');st.id='iccss';st.textContent=`.icard{position:absolute;inset:0;z-index:60;background:radial-gradient(ellipse at 50% 30%,#1c2a22,#0a0e0c 70%);color:#f1f3f2;font-family:"Noto Sans KR",sans-serif;display:flex;flex-direction:column;align-items:center;padding:18px 24px;box-sizing:border-box}
  .ic-top{display:flex;gap:16px;align-items:center;margin-bottom:6px}.ic-top b{background:#c9a24a;color:#111;font:700 34px Oswald,Impact,sans-serif;padding:2px 22px;letter-spacing:.04em}.ic-top span{opacity:.7;letter-spacing:.14em;font-size:13px}
  .ic-body{flex:1;display:flex;width:100%;max-width:1180px;align-items:stretch;min-height:0}.ic-s{flex:1 1 0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;min-width:0}.ic-s canvas{max-width:100%;max-height:62vh}
  .ic-n{display:flex;align-items:center;gap:10px;margin-top:6px;font-size:clamp(20px,3.2vw,34px);font-weight:700}.ic-s1 .ic-n{flex-direction:row-reverse}.ic-rk input{width:46px;text-align:center;background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.4);font:700 20px Oswald,sans-serif;padding:4px 2px}.ic-rk input:placeholder-shown{font-size:12px}
  .ic-mid{flex:0 0 min(34vw,380px);display:flex;flex-direction:column;justify-content:center;gap:2px;margin:0 10px}.ic-r{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;background:rgba(10,18,14,.78);padding:12px 10px;text-align:center;font-size:clamp(13px,1.6vw,19px)}.ic-r i{font-style:normal;opacity:.55;font-size:.78em;min-width:5.5em}.ic-tip{margin-top:8px;font-size:11px;opacity:.5;text-align:center}
  .ic-go{margin-top:8px;background:#c9a24a;color:#111;border:0;padding:12px 44px;font:700 18px "Noto Sans KR",sans-serif;letter-spacing:.1em;cursor:pointer}`;document.head.appendChild(st)}
  M.root.appendChild(card);
  const cvs=card.querySelectorAll('canvas');let raf=0;const tick=()=>{bust(cvs[0],M.f[0]);bust(cvs[1],M.f[1]);raf=requestAnimationFrame(tick)};tick();
  card.querySelectorAll('[data-rk]').forEach(inp=>{inp.addEventListener('input',()=>setRank(S[+inp.dataset.rk].key,inp.value.trim()));inp.addEventListener('keydown',e=>e.stopPropagation())});
  const go=()=>{if(!M._hold)return;M._hold=false;cancelAnimationFrame(raf);card.remove();document.removeEventListener('keydown',kd);if(M.phase==='intro'){M.phase='fight';SFXI.play('bell');M.announce('ROUND 1','FIGHT!',1.1)}};
  const kd=e=>{if(e.target&&e.target.tagName==='INPUT')return;if(e.code==='Enter'||e.code==='Space'){e.preventDefault();go()}};document.addEventListener('keydown',kd);
  card.querySelector('.ic-go').onclick=go;M._introGo=go;if(M.pi==null)setTimeout(go,7000);
  return r}}
{const d=Match.prototype.destroy;Match.prototype.destroy=function(){document.querySelectorAll('.icard').forEach(e=>e.remove());return d.apply(this,arguments)}}
})();
