/* ===== Roster.js : "선수 정보" — every fighter by weight class with record, age, height, weight, reach, style and all attributes ===== */
(function(){
if(typeof titleScreen==='undefined'||typeof poolFor==='undefined'||typeof window.fighterStats!=='function')return;
const css=`.rs2{max-width:1100px;margin:0 auto;padding:16px 14px 40px;color:#e6e6ea;font-family:"Noto Sans KR",sans-serif}.rs2 h2{font:400 18px/1 "Noto Sans KR",sans-serif;letter-spacing:.3em;margin:6px 0 14px;color:#fff}
.rs2 .wcs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}.rs2 .chip{background:transparent;border:1px solid rgba(255,255,255,.25);color:#cfcfd6;padding:7px 12px;border-radius:2px;font-size:13px;cursor:pointer}.rs2 .chip.on{border-color:#e9c45a;color:#fff;background:rgba(233,196,90,.12)}
.rs2 .cols{display:grid;grid-template-columns:minmax(210px,300px) 1fr;gap:14px;align-items:start}@media(max-width:700px){.rs2 .cols{grid-template-columns:1fr}}
.rs2 .lst{max-height:72vh;overflow:auto;border:1px solid rgba(255,255,255,.12)}.rs2 .it{display:flex;justify-content:space-between;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.07);cursor:pointer;font-size:14px}.rs2 .it.on{background:rgba(233,196,90,.14)}.rs2 .it small{opacity:.55}
.rs2 .det{border:1px solid rgba(255,255,255,.12);padding:14px 16px}.rs2 .det h3{margin:0 0 4px;font-size:22px}.rs2 .det .sub{opacity:.6;font-size:13px;margin-bottom:10px}.rs2 .kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:10px 0 14px}.rs2 .kv div{background:rgba(255,255,255,.06);padding:8px 10px}.rs2 .kv b{display:block;font-size:11px;opacity:.55;font-weight:500;margin-bottom:2px}.rs2 .kv span{font-size:16px}
.rs2 .attrs{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}.rs2 .ag h4{margin:0 0 4px;font-size:13px;letter-spacing:.1em;opacity:.8}.rs2 .ar{display:flex;justify-content:space-between;font-size:13px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.05)}`;
function screen(){if(!document.getElementById('rs2css')){const s=document.createElement('style');s.id='rs2css';s.textContent=css;document.head.appendChild(s)}
  const st={wc:'HW',i:0};const WL=(typeof WCK!=='undefined'?WCK:Object.keys(WC)).slice();
  const render=()=>{const L=poolFor(st.wc);if(st.i>=L.length)st.i=0;const f=L[st.i];const S=fighterStats({name:f.ko,look:(typeof lookFor==='function'?lookFor(f.rr):null)||{h:WC[st.wc].h}});
    const na=typeof ovrBar==='function'&&typeof attrTable==='function'?attrTable(f.A):'';
    app().innerHTML=`<div class="rs2"><button class="back2" data-bk>← 뒤로</button><h2>선수 정보</h2><div class="wcs">${WL.map(k=>`<button class="chip ${k===st.wc?'on':''}" data-wc="${k}">${WC[k].n}</button>`).join('')}</div>
      <div class="cols"><div class="lst">${L.map((x,i)=>`<div class="it ${i===st.i?'on':''}" data-i="${i}"><span>${x.ko||x.n}</span><small>${(Math.round(x.stars*2)/2).toFixed(1)}★ · ${x.rec.w}-${x.rec.l}</small></div>`).join('')}</div>
      <div class="det"><h3>${f.ko||f.n}</h3><div class="sub">${f.n} · ${f.nat} · ${WC[f.wc].n}</div>
        <div class="kv"><div><b>전적</b><span>${S.rec}</span></div><div><b>나이</b><span>${S.age}세</span></div><div><b>신장</b><span>${S.h}cm</span></div><div><b>체중</b><span>${S.w}kg</span></div><div><b>리치</b><span>${S.reach}cm</span></div><div><b>스타일</b><span>${S.style}</span></div><div><b>전성기</b><span>${f.pk}</span></div></div>${na}</div></div></div>`;
    const A=app();A.querySelector('[data-bk]').onclick=()=>titleScreen();A.querySelectorAll('[data-wc]').forEach(b=>b.onclick=()=>{st.wc=b.dataset.wc;st.i=0;render()});A.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{st.i=+b.dataset.i;render()})};
  render()}
const ts=window.titleScreen;window.titleScreen=function(){const r=ts.apply(this,arguments);const A=app(),tm=A.querySelector('.tm');if(tm&&!tm.querySelector('[data-r]')){const b=document.createElement('button');b.dataset.r='1';b.textContent='선수 정보';b.onclick=()=>{SFXI.init();screen()};const t=tm.querySelector('[data-t]');tm.insertBefore(b,t?t.nextSibling:null)}return r};
window.rosterScreen=screen;try{if(app().querySelector('.t2'))window.titleScreen()}catch(e){}/* the title may already be on screen */
})();
