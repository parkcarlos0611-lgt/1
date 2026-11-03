/* ===== DebugLayer.js : on-canvas debug overlay (F9 or ?debug=1) =====
   World space : hurt capsules (head/body/leg/arm), strike capsule (bright = active frames),
                 ragdoll particles + bones + soft shape links, violated joint limits (magenta),
                 floor/cage contacts (red), cage wall planes, referee position → target.
   Screen space: per-fighter action phase bar (startup/active/recovery + cancel window),
                 playback speed, input buffer, ragdoll energy / penetration / limit error, FPS. */
const DebugLayer={
  on:!!TUNING.debug.on,
  toggle(){this.on=!this.on;try{localStorage.setItem('cl_dbg',this.on?'1':'0')}catch(e){}},
  draw(M){if(!this.on)return;const S=M.stage,ctx=S.ctx;ctx.save();S.worldT(ctx);
    M.drawBoxes(ctx);
    /* cage walls */
    const W=S.R+TUNING.ragdoll.cageInset;ctx.strokeStyle='rgba(255,80,200,.6)';ctx.lineWidth=.012;ctx.setLineDash([.06,.05]);for(const x of[-W,W]){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,2.4);ctx.stroke()}ctx.setLineDash([]);
    ctx.strokeStyle='rgba(255,255,255,.35)';ctx.beginPath();ctx.moveTo(-W,0);ctx.lineTo(W,0);ctx.stroke();
    for(const f of M.f){const R=f.body.rag;if(!R)continue;const P=R.P;
      ctx.lineWidth=.012;ctx.strokeStyle='rgba(0,255,200,.9)';for(const[a,b]of R.C){ctx.beginPath();ctx.moveTo(P[a].x,P[a].y);ctx.lineTo(P[b].x,P[b].y);ctx.stroke()}
      ctx.strokeStyle='rgba(0,180,255,.35)';ctx.lineWidth=.006;for(const[a,b]of R.S){ctx.beginPath();ctx.moveTo(P[a].x,P[a].y);ctx.lineTo(P[b].x,P[b].y);ctx.stroke()}
      for(const l of R.L){const fl=R.flex(l);if(fl<l[4]-.02||fl>l[5]+.02){const p=P[l[1]];ctx.fillStyle='#ff00ff';ctx.beginPath();ctx.arc(p.x,p.y,.035,0,7);ctx.fill()}}
      for(const k in P){const p=P[k];const w=R.drive(k);ctx.fillStyle=R.contacts.has(k)?'#ff3030':`rgba(255,255,${Math.round(255*(1-w))},.95)`;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.012,p.r*.45),0,7);ctx.fill()}}
    /* referee: current position → where it wants to stand */
    const r=M.ref;if(r){const a=M.f[0],b=M.f[1];const mid=(a.x+b.x)/2;const tx=r._dbgT!=null?r._dbgT:mid+(mid>0?-1:1)*1.3;ctx.strokeStyle='#ffd84a';ctx.lineWidth=.012;ctx.beginPath();ctx.moveTo(r.x,.05);ctx.lineTo(tx,.05);ctx.stroke();ctx.fillStyle='#ffd84a';ctx.beginPath();ctx.arc(tx,.05,.04,0,7);ctx.fill();
      if(r._dbgPath){ctx.strokeStyle='rgba(255,216,74,.45)';ctx.beginPath();r._dbgPath.forEach((x,i)=>i?ctx.lineTo(x,.02+i*.004):ctx.moveTo(x,.02));ctx.stroke()}}
    if(M.dbgParry&&now_s()-M.dbgParry.t<.5){ctx.strokeStyle='#7fffd4';ctx.lineWidth=.02;ctx.beginPath();ctx.arc(M.dbgParry.x,M.dbgParry.y,.12,0,7);ctx.stroke()}
    /* screen-space panel */
    ctx.setTransform(S.dpr,0,0,S.dpr,0,0);ctx.font='11px ui-monospace,Menlo,monospace';const now=performance.now();this._fps=this._fps?this._fps*.92+(1000/Math.max(1,now-(this._lt||now)))*.08:60;this._lt=now;
    const lines=[`DEBUG (F9)  fps ${this._fps.toFixed(0)}  phase ${M.phase}  hitstop ${Math.max(0,M.hitstop).toFixed(2)}  arena ${S.arena?S.arena.kind+' '+S.arena.ft+'ft R='+S.R:''}${M.stopping?'  REF STOPPING':''}`];
    M.f.forEach((f,i)=>{const a=f.act;let s=`${i?'BLUE':'RED '} ${f.state}${f.hm?' hm:'+f.hm:''}${f.guard?' guard:'+f.guard:''} sta ${f.sta.toFixed(0)}/${f.staMax.toFixed(0)} stun ${f.stun.toFixed(0)}${typeof StunModel!=='undefined'?` conc ${(f.conc||0).toFixed(1)}/${StunModel.T(f).toFixed(0)} (${StunModel.ratio(f).toFixed(2)}) dng ${(f.dng||0).toFixed(0)}`:''}${f.planted?' feet '+f.planted.join('/'):''}`;
      if(a&&a.c)s+=`  ${a.key} ${CombatEngine.phase(a)} t=${a.t.toFixed(2)} x${a.speed.toFixed(2)}${a.outcome?' '+a.outcome:''}`;
      if(f.buf&&f.buf.q.length)s+=`  buf[${f.buf.q.map(e=>e.key).join(',')}]`;if(f.dbgCancel&&now/1000-f.dbgCancel.t<.6)s+=`  CANCEL(${f.dbgCancel.why})`;
      const R=f.body.rag;if(R){const st=R.stats();s+=`  RAG t=${st.t.toFixed(2)} KE ${st.ke.toFixed(2)} pen ${(st.pen*100).toFixed(1)}cm lim ${st.lim.toFixed(2)}${st.asleep?' ASLEEP':''}`}lines.push(s)});
    const x0=12,y0=(S.Hh||400)-14-lines.length*15-30;ctx.fillStyle='rgba(0,0,0,.66)';ctx.fillRect(x0-6,y0-12,Math.min(S.W-12,860),lines.length*15+40);ctx.fillStyle='#d6ffe8';lines.forEach((l,i)=>ctx.fillText(l,x0,y0+i*15));
    /* phase bars */
    M.f.forEach((f,i)=>{const a=f.act;const by=y0+lines.length*15+(i?10:0)-6,bx=x0,bw=280;ctx.fillStyle='#222';ctx.fillRect(bx,by,bw,6);if(!a||!a.c||!a.c.hit)return;const d=a.c.dur||.4,h=a.c.hit;const X=t=>bx+bw*clamp(t/d,0,1);
      ctx.fillStyle='#3b6fd1';ctx.fillRect(bx,by,X(h.t0)-bx,6);ctx.fillStyle='#e8473a';ctx.fillRect(X(h.t0),by,X(h.t1)-X(h.t0),6);ctx.fillStyle='#7a7f8a';ctx.fillRect(X(h.t1),by,bx+bw-X(h.t1),6);
      ctx.fillStyle='rgba(255,255,255,.35)';ctx.fillRect(bx,by-2,X(h.t0*CE.cancelFrac)-bx,2);ctx.fillStyle='#fff';ctx.fillRect(X(a.t)-1,by-3,2,12)});
    ctx.restore()}
};
try{if(localStorage.getItem('cl_dbg')==='1')DebugLayer.on=true}catch(e){}
window.addEventListener('keydown',e=>{if(e.code==='F9'){e.preventDefault();DebugLayer.toggle()}});
{const rd=Match.prototype.render;Match.prototype.render=function(dt){rd.call(this,dt);try{DebugLayer.draw(this)}catch(e){if(!this._dbgErr){this._dbgErr=1;console.warn('debug layer',e)}}}}
