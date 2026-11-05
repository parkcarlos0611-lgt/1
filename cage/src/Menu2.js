/* ===== Menu2.js : plain title screen, All-Star Fight (by weight class), star ratings, two rule sets =====
   Career mode and the 2D Fighter Lab are gone from the menu. Each fighter exists once, at his best (peak rating).
   Rules: UFC (octagon, ground game) and Kickboxing (ring, no takedowns, no ground, wait while a fighter is down). */
(function(){
/* ---------- type: sober, small, spaced ---------- */
{const st=document.createElement('style');st.textContent=
 "html,body,.btn,.chip,select,input,.hud,.hud *,.H,.tc2,.tc2 *,.b4,.b4 *,.page,.page *{font-family:'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif!important;text-transform:none!important}"+
 ".H{letter-spacing:.04em!important;font-weight:500!important}"+
 ".title{background:#050506!important}.title .tbg{display:none!important}.t2{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:56px;background:#050506;color:#e9e9ec;padding:24px}"+
 ".t2 h1{margin:0;font:300 clamp(30px,6vw,64px)/1.1 'Noto Sans KR',system-ui,sans-serif!important;letter-spacing:.42em;text-indent:.42em;color:#f2f2f4}.t2 .tm{display:flex;flex-direction:column;gap:14px;width:min(280px,80vw)}"+
 ".t2 button{background:transparent;border:1px solid rgba(255,255,255,.28);color:#e9e9ec;padding:14px 20px;font:400 15px/1 'Noto Sans KR',system-ui,sans-serif!important;letter-spacing:.3em;text-indent:.3em;cursor:pointer;border-radius:2px}.t2 button:hover,.t2 button:active{background:rgba(255,255,255,.08);border-color:#fff}"+
 ".q2{max-width:880px;margin:0 auto;padding:18px 14px 40px;color:#e6e6ea}.q2 h2{font:400 18px/1 'Noto Sans KR',sans-serif!important;letter-spacing:.3em;margin:6px 0 18px;color:#fff}.q2 .row{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0;align-items:center}.q2 .lb{font-size:12px;letter-spacing:.2em;color:#9a9aa4;margin-right:6px}"+
 ".q2 .chip{background:transparent;border:1px solid rgba(255,255,255,.25);color:#cfcfd6;padding:8px 14px;border-radius:2px;font-size:13px;cursor:pointer}.q2 .chip.on{border-color:#e9c45a;color:#fff;background:rgba(233,196,90,.1)}"+
 ".q2 .vs2{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:start;margin-top:14px}.q2 .pc{border:1px solid rgba(255,255,255,.14);padding:12px;background:#0b0b0d}.q2 .pc select{width:100%;background:#111;color:#eee;border:1px solid #333;padding:9px;margin-bottom:10px;font-size:14px}"+
 ".q2 .side{font-size:11px;letter-spacing:.3em;margin-bottom:6px}.q2 .side.r{color:#e0554d}.q2 .side.b{color:#5b8ee6}.q2 .nm{font-size:17px;margin:2px 0 8px;font-weight:500}.q2 .mt{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#a4a4ae;margin:5px 0}.q2 .vsx{align-self:center;color:#777;letter-spacing:.2em;font-size:13px}"+
 ".q2 .go{display:block;width:100%;margin-top:22px;padding:15px;background:#e9e9ec;color:#050506;border:0;font:500 15px 'Noto Sans KR',sans-serif!important;letter-spacing:.4em;text-indent:.4em;cursor:pointer;border-radius:2px}.stars{display:inline-flex;gap:2px;vertical-align:middle}.stars svg{width:16px;height:16px}.stars.big svg{width:22px;height:22px}.back2{background:none;border:0;color:#aaa;font-size:13px;letter-spacing:.2em;cursor:pointer;padding:4px 0}"+
 "@media(max-width:620px){.q2 .vs2{grid-template-columns:1fr}.q2 .vsx{display:none}}";document.head.appendChild(st)}

/* ---------- the gold star (glossy), full / half / empty ---------- */
let SID=0;
function starSvg(fill){/* fill: 1 full, .5 half, 0 empty */const id='s'+(++SID);
  const poly='50,4 62,35 96,37 70,58 79,91 50,73 21,91 30,58 4,37 38,35';
  return `<svg viewBox="0 0 100 96"><defs><linearGradient id="g${id}" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#fff6c2"/><stop offset=".28" stop-color="#ffd54a"/><stop offset=".62" stop-color="#e5a50f"/><stop offset="1" stop-color="#a86b00"/></linearGradient>
  <linearGradient id="r${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffbe0" stop-opacity=".95"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="h${id}"><rect x="0" y="0" width="${fill>=1?100:fill>0?50:0}" height="96"/></clipPath></defs>
  <polygon points="${poly}" fill="#2a2a30" stroke="#55555e" stroke-width="3" stroke-linejoin="round"/>
  <g clip-path="url(#h${id})"><polygon points="${poly}" fill="url(#g${id})" stroke="#7a4a00" stroke-width="2.4" stroke-linejoin="round"/><polygon points="50,11 59,37 87,39 66,56 73,82 50,68 27,82 34,56 13,39 41,37" fill="none" stroke="#fff2a8" stroke-opacity=".55" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M50,9 L39,36 L13,39 L36,31 Z" fill="url(#r${id})"/><ellipse cx="38" cy="30" rx="7" ry="3.2" fill="#fff" fill-opacity=".55" transform="rotate(-38 38 30)"/></g></svg>`}
function stars(v,big){v=Math.round(clamp(v,.5,5)*2)/2;let h='';for(let i=1;i<=5;i++)h+=starSvg(v>=i?1:v>=i-.5?.5:0);return `<span class="stars${big?' big':''}" title="${v}">${h}</span>`}
window.starsHtml=stars;
const rateStars=pk=>clamp(1+(pk-62)/37*4,1,5);

/* ---------- the fighter pool: one version each, at his peak ---------- */
const POOL={};
function poolFor(wc){if(POOL[wc])return POOL[wc];const L=FDB.filter(r=>r.wc===wc).map(r=>{const A=attrsFor(r,r.pk);return{id:r.id,n:r.n,ko:r.ko,nat:r.nat,wc:r.wc,pk:r.pk,A,rec:r.frec,rec2:{w:r.frec.w,l:r.frec.l},rr:r,stars:rateStars(r.pk)}}).sort((a,b)=>b.pk-a.pk);return POOL[wc]=L}
const grp=(A,keys)=>keys.reduce((s,k)=>s+(A[k]||10),0)/keys.length;
const GS=[['타격',['punchPow','handSpd','accuracy','kicking','strDef']],['그래플링',['takedown','tdd','clinchCtl','topCtl','bottom','subOff','subDef']],['체력',['cardio','speed','strength','recovery']],['맷집',['chin','skin','bodyT','heart']]];
const gstar=(A,keys)=>clamp(Math.round(grp(A,keys)/20*5*2)/2,.5,5);
const card=f=>`<div class="nm">${dn2(f)}</div><div class="mt"><span>종합</span>${stars(f.stars,1)}</div>${GS.map(([n,k])=>`<div class="mt"><span>${n}</span>${stars(gstar(f.A,k))}</div>`).join('')}`;
const dn2=f=>(typeof KO_NAMES!=='undefined'&&0)?f.n:(f.ko||f.n);

/* ---------- title ---------- */
window.flag=function(){return''};
window.titleScreen=function(){app().innerHTML=`<div class="t2"><h1>CAGE LEGENDS</h1><div class="tm"><button data-q>빠른 대전</button><button data-t>연습</button><button data-f>전체 화면</button></div></div>`;
  const A=app();A.querySelector('[data-q]').onclick=()=>{SFXI.init();quickFight()};A.querySelector('[data-t]').onclick=()=>{SFXI.init();trainingMenu()};A.querySelector('[data-f]').onclick=()=>toggleFullscreen()};

/* ---------- all-star fight ---------- */
window.quickFight=function(){const st={wc:'HW',a:0,b:1,side:0,diff:1,rule:'ufc'};
  const render=()=>{const L=poolFor(st.wc);if(st.a>=L.length)st.a=0;if(st.b>=L.length||st.b===st.a)st.b=st.a===0?1:0;const fa=L[st.a],fb=L[st.b];
    const opt=(sel)=>L.map((f,i)=>`<option value="${i}" ${i===sel?'selected':''}>${dn2(f)}  ·  ${(Math.round(f.stars*2)/2).toFixed(1)}</option>`).join('');
    app().innerHTML=`<div class="q2"><button class="back2" data-bk>← 뒤로</button><h2>올스타 파이트</h2>
      <div class="row"><span class="lb">룰</span>${[['ufc','UFC 룰'],['kick','입식 룰']].map(([k,n])=>`<button class="chip ${st.rule===k?'on':''}" data-rule="${k}">${n}</button>`).join('')}</div>
      <div class="row"><span class="lb">체급</span>${WCK.map(k=>`<button class="chip ${k===st.wc?'on':''}" data-wc="${k}">${WC[k].n}</button>`).join('')}</div>
      <div class="vs2"><div class="pc"><div class="side r">RED</div><select data-a>${opt(st.a)}</select>${card(fa)}</div><div class="vsx">VS</div><div class="pc"><div class="side b">BLUE</div><select data-b>${opt(st.b)}</select>${card(fb)}</div></div>
      <div class="row" style="margin-top:16px"><span class="lb">조종</span>${['RED','BLUE','관전'].map((x,i)=>`<button class="chip ${st.side===i?'on':''}" data-side="${i}">${x}</button>`).join('')}</div>
      <div class="row"><span class="lb">난이도</span>${[['쉬움',.7],['보통',1],['어려움',1.3],['레전드',1.6]].map(([n,v])=>`<button class="chip ${st.diff===v?'on':''}" data-df="${v}">${n}</button>`).join('')}</div>
      <button class="go" data-go>시작</button></div>`;
    const A=app();A.querySelector('[data-bk]').onclick=titleScreen;
    A.querySelectorAll('[data-rule]').forEach(b=>b.onclick=()=>{st.rule=b.dataset.rule;render()});A.querySelectorAll('[data-wc]').forEach(b=>b.onclick=()=>{st.wc=b.dataset.wc;st.a=0;st.b=1;render()});
    A.querySelector('[data-a]').onchange=e=>{st.a=+e.target.value;render()};A.querySelector('[data-b]').onchange=e=>{st.b=+e.target.value;render()};
    A.querySelectorAll('[data-side]').forEach(b=>b.onclick=()=>{st.side=+b.dataset.side;render()});A.querySelectorAll('[data-df]').forEach(b=>b.onclick=()=>{st.diff=+b.dataset.df;render()});
    A.querySelector('[data-go]').onclick=()=>{const kick=st.rule==='kick';const rules=Object.assign({},orgRules('UFC',2020,true));
      if(kick){Object.assign(rules,{rounds:3,len:180,firstLen:0,gElbow:0,ruleset:'kick',venue:'ring'});rules.rounds=3}else{Object.assign(rules,{rounds:3,len:300,firstLen:0,ruleset:'ufc',venue:'cage8'})}
      const fx=f=>({name:dn2(f),flag:'',rec:'',A:f.A,stance:hsh(f.n+'st')<.22?-1:1,look:lookFor(f.rr)});
      const root=document.createElement('div');document.body.appendChild(root);
      new Match(root,{level:kick?1.2:1.6,org:{short:kick?'KICK':'UFC',col:kick?'#c8a24a':'#d20a0a'},title:kick?'입식 올스타 파이트':'올스타 파이트',wcName:WC[st.wc].en+(kick?' KICKBOXING':' BOUT'),rules,ruleset:kick?'kick':'ufc',player:st.side===2?null:st.side,diff:st.diff,allowSim:false,red:fx(fa),blue:fx(fb)},()=>{root.remove();render()})}};
  render()};
/* the old title may already be on screen */try{if(document.querySelector('#app .title'))window.titleScreen()}catch(e){}
})();
