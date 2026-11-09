/* ===== Corner.js : the corner break between rounds =====
   After the bell (rounds 1 and 2) the fighters walk to their corners, sit on a stool and recover while a coach holds an ice pack
   to their face. Recovery is automatic — there is no choice of corner instructions any more (it is always "rest").
   The coach is the referee figure (same renderer, same outline / shading upgrades) in a T-shirt and either trousers or fighter shorts.
   After about 12 s (or SKIP) the next round starts by itself. */
(function(){
if(typeof Match==='undefined'||typeof F2==='undefined')return;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const DUR=12,STOOL_X=2.45;
function armTo(F,P,side,T,w){if(w<=0)return;const tmp=Object.assign({},P);armIK(F,tmp,side,T);P[side+'_s']+=(tmp[side+'_s']-P[side+'_s'])*w;P[side+'_e']+=(tmp[side+'_e']-P[side+'_e'])*w;P[side==='la'?'lo':'ro']=tmp[side==='la'?'lo':'ro']}
const COACH_LOOKS=[
  {skin:'#d9a882',hair:'#2a2420',hs:'short',bd:'stub',cshort:0},
  {skin:'#8a5a3e',hair:'#1c1411',hs:'bald',bd:'goatee',cshort:1},
  {skin:'#e4b593',hair:'#8a7462',hs:'short',bd:null,cshort:1},
  {skin:'#6e4630',hair:'#141110',hs:'buzz',bd:'full',cshort:0}];
function mkCoach(M,side){const base=COACH_LOOKS[(side+Math.floor(Math.random()*2)*2)%COACH_LOOKS.length];const col=side?'#1f5fd6':'#c21818';
  const look=Object.assign({h:1.8*.9,bw:1.05,ref:1,_flat:1,name:'coach'+side,shorts:'#1d1e22',beard:!!base.bd},base,{cl:{shirt:col,shirtS:'#0000',boot:'#17171a',pants:'#26272c',pantsS:'#1c1d21'}});
  look.cl.shirtS=col==='#c21818'?'#8f1111':'#1646a0';
  const c=new F2({side,name:'coach'+side,look,x:0});c.A={footwork:14,speed:12};c.coachSide=side;return c}
const SEAT={free:1,y:.5,rot:0,lean:-.1,chest:.02,head:.1,tw:0,ll_h:1.5,ll_k:1.5,ll_a:.12,rl_h:1.38,rl_k:1.55,rl_a:.12,la_s:.42,la_e:.7,ra_s:.34,ra_e:.82};

function start(M){if(M.corner)return;M.cornerX=Math.min(STOOL_X,(M.stage.R||3)-.55);M.cornerPick='rest';
  M.corner={t:0,dur:DUR,seated:[0,0],coaches:[mkCoach(M,0),mkCoach(M,1)]};
  /* a slim, non-blocking bar: round stats and a skip button */
  const rs=M.rs,esc=n=>n;const bar=document.createElement('div');bar.className='cnrbar';
  bar.innerHTML=`<b>ROUND ${M.round} 종료</b><span>코너 휴식 · 코치가 처치 중</span><span class="cnrst">유효타 ${rs[0].sigL} : ${rs[1].sigL} · 다운 ${rs[0].kd} : ${rs[1].kd}</span><i class="cnrt"></i><button data-skip>SKIP ▶</button>`;
  M.root.appendChild(bar);M.corner.bar=bar;bar.querySelector('[data-skip]').onclick=()=>finish(M);
  if(!document.getElementById('cnrcss')){const st=document.createElement('style');st.id='cnrcss';st.textContent='.cnrbar{position:absolute;left:50%;bottom:44px;transform:translateX(-50%);display:flex;gap:14px;align-items:center;background:rgba(8,9,12,.82);border:1px solid rgba(255,255,255,.18);padding:8px 16px;border-radius:4px;color:#eceef2;font:500 13px "Noto Sans KR",sans-serif;z-index:30;white-space:nowrap}.cnrbar b{letter-spacing:.08em}.cnrbar .cnrt{display:block;width:90px;height:4px;background:rgba(255,255,255,.18);position:relative}.cnrbar .cnrt:after{content:"";position:absolute;left:0;top:0;bottom:0;width:var(--p,0%);background:#5fa8ff}.cnrbar button{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.3);padding:4px 10px;font:inherit;cursor:pointer}';document.head.appendChild(st)}}
function finish(M){const C=M.corner;if(!C)return;M.corner=null;if(C.bar)C.bar.remove();for(const f of M.f){f.gpose=null;f.seated=0}M.cornerX=null;if(M.phase==='break')M.nextRound()}
{const sb=Match.prototype.showBreak;Match.prototype.showBreak=function(){start(this)}}
Match.prototype.cpuCorner=function(){return'rest'};
/* every frame of the break */
{const st=Match.prototype.step;Match.prototype.step=function(dt){const r=st.call(this,dt);const C=this.corner;if(!C||this.phase!=='break')return r;
  C.t+=dt;const X=this.cornerX||STOOL_X;
  this.f.forEach((f,i)=>{const sx=i?X:-X,arrived=Math.abs(f.x-sx)<.08&&f.state==='stand';
    if(arrived){C.seated[i]=Math.min(1,C.seated[i]+dt*2.2);f.x=sx;const p=Object.assign({},BASE_POSE,SEAT);f.gpose=p;f.gRate=7;f.seated=C.seated[i];
      /* recovery: slow and automatic */
      f.sta=Math.min(f.staMax,f.sta+dt*3.6);f.hp.head=Math.min(100,f.hp.head+dt*.45);f.hp.body=Math.min(100,f.hp.body+dt*.55);f.hp.legs=Math.min(100,f.hp.legs+dt*.6);f.stun=0;f.rock=0;
      f.body.swell*=Math.exp(-dt*.14);f.body.cuts.forEach(c=>c.sev*=Math.exp(-dt*.1));f.bleed=(f.bleed||0)*Math.exp(-dt*.3);f._armD=Math.max(0,(f._armD||0)-dt*4)}
    else{f.gpose=null;f.seated=0}
    /* the coach stands in front of his fighter and holds the pack to the face */
    const c=C.coaches[i];c.state='stand';c.mvIn=0;c.x=sx+(i?-1:1)*.78;c.d=i?1:-1;c.guard=null;c.act=null;
    const J=f.body.J,sat=C.seated[i];const pose=Object.assign({},BASE_POSE,{lean:.3,chest:.1,head:.08,ll_h:.16,ll_k:.3,ll_a:.1,rl_h:-.06,rl_k:.26,rl_a:.1,la_s:.5,la_e:.8,ra_s:.5,ra_e:.9});
    if(sat>.6&&J.hd){const tg={x:J.hd.x+f.d*.1,y:J.hd.y-.02+Math.sin(C.t*5)*.012};armTo(c,pose,'ra',tg,1);armTo(c,pose,'la',{x:J.hd.x-f.d*.02,y:J.hd.y-.22},.8);C.pack=C.pack||[];C.pack[i]=tg}
    c.gpose=pose;c.gRate=8;c.update(dt,{checkHit(){},onMiss(){}});c.pose(dt,this)});
  if(C.bar){C.bar.querySelector('.cnrt').style.setProperty('--p',Math.min(100,C.t/C.dur*100)+'%')}
  if(C.t>=C.dur)finish(this);return r}}
/* the stools, the coaches and the ice packs */
Match.prototype.cornerDraw=function(ctx,layer){const C=this.corner;if(!C||this.phase!=='break')return;
  if(layer==='back'){this.f.forEach((f,i)=>{const sx=i?(this.cornerX||STOOL_X):-(this.cornerX||STOOL_X),col=i?'#1f5fd6':'#c21818';ctx.save();ctx.fillStyle='#141519';ctx.fillRect(sx-.2,0,.03,.44);ctx.fillRect(sx+.17,0,.03,.44);ctx.fillStyle='#22242a';ctx.fillRect(sx-.23,.42,.46,.05);ctx.fillStyle=col;ctx.fillRect(sx-.23,.455,.46,.015);ctx.restore()});return}
  for(const c of C.coaches)c.draw(ctx,{});
  (C.pack||[]).forEach((t,i)=>{if(!t||C.seated[i]<.6)return;ctx.save();ctx.translate(t.x,t.y);ctx.rotate(-.35*(i?-1:1));ctx.fillStyle='#bfe3ff';ctx.strokeStyle='#e9f6ff';ctx.lineWidth=.006;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(-.05,-.035,.1,.07,.015);else ctx.rect(-.05,-.035,.1,.07);ctx.fill();ctx.stroke();ctx.fillStyle='rgba(255,255,255,.6)';ctx.fillRect(-.035,-.02,.04,.012);ctx.restore()})};
})();
