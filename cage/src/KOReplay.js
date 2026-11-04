/* ===== KOReplay.js : slow-motion KO — from 2 s before the finishing blow to 2 s after it =====
   Every simulation step records what is on screen (both fighters' and the referee's skeletons, facing, positions,
   camera, cage rotation) for the last ~2.2 s of game time. When a fight ends by KO / TKO the live action stops,
   those 2 s are played back at RATE speed (poses interpolated between recorded steps, so it stays smooth), and then
   the live action continues in slow motion for 2 s of game time while the KO'd fighter falls. */
(function(){
if(typeof Match==='undefined')return;
const KR={keep:2.2,before:2.0,after:2.0,rate:.4,postRate:.32};
const snapF=f=>{const B=f.body,J={};for(const k in B.J){const q=B.J[k];J[k]={x:q.x,y:q.y}}return{x:f.x,d:f.d,J,ang:Object.assign({},B.ang),bd:B.d}};
/* record after every step */
{const st=Match.prototype.step;Match.prototype.step=function(dt){const r=st.call(this,dt);if(this._rp)return r;
  this._gclock=(this._gclock||0)+dt;if(this.phase!=='fight'&&!(this.phase==='end'&&this._recOn))return r;
  const R=this._rec||(this._rec=[]);const S=this.stage,C=S.cam;
  R.push({gt:this._gclock,f:this.f.map(snapF),ref:this.ref&&this.ref.body.J.hd?snapF(this.ref):null,cam:{x:C.x,w:C.w,gy:C.gy,zoom:C.zoom},rot:S.rot||0});
  while(R.length>2&&this._gclock-R[0].gt>KR.keep)R.shift();return r}}
/* start the replay when the fight is stopped by a KO / TKO */
{const fin=Match.prototype.finish;Match.prototype.finish=function(w,method){const was=this.phase;const r=fin.apply(this,arguments);
  if(was!=='end'&&/KO/.test(method||'')&&this._rec&&this._rec.length>20&&!this._rpDone){this._rpDone=1;const R=this._rec;const end=R[R.length-1].gt;const fr=R.filter(s=>s.gt>=end-KR.before);
    this._rp={fr,t:fr[0].gt,end,hit:0};this.slow=0;this.hitstop=0;
    const el=document.createElement('div');el.className='korp';el.innerHTML='<b>KO</b> 슬로우 모션 리플레이';this.root.appendChild(el);this._rpEl=el}
  return r}}
const lerpJ=(a,b,u)=>{const o={};for(const k in a){const p=a[k],q=b[k]||p;o[k]={x:p.x+(q.x-p.x)*u,y:p.y+(q.y-p.y)*u}}return o};
const lerpA=(a,b,u)=>{const o={};for(const k in a){const p=a[k],q=b[k];o[k]=typeof p==='number'&&typeof q==='number'?p+(q-p)*u:p}return o};
/* playback */
{const lp=Match.prototype.loop;Match.prototype.loop=function(now){const rp=this._rp;if(!rp||!this.running)return lp.call(this,now);
  requestAnimationFrame(this.loop);const dt=Math.min(.05,(now-this.last)/1000);this.last=now;if(this.paused){this.render(0);return}
  rp.t+=dt*KR.rate;
  if(rp.t>=rp.end){/* back to live action, still slow, for the fall */this._rp=null;if(this._rpEl){this._rpEl.remove();this._rpEl=null}
    this.slow=KR.after/KR.postRate;this.slowK=KR.postRate;if(this.outro)this.outro.fallT=Math.max(this.outro.fallT||0,(this.outro.t||0)+KR.after/KR.postRate+.6);this.render(dt);return}
  const fr=rp.fr;let i=0;while(i<fr.length-2&&fr[i+1].gt<rp.t)i++;const A=fr[i],B=fr[Math.min(i+1,fr.length-1)];const u=B.gt>A.gt?clamp((rp.t-A.gt)/(B.gt-A.gt),0,1):0;
  /* put the recorded frame on the bodies, draw, restore the live state */
  const bodies=this.f.map((f,k)=>[f,A.f[k],B.f[k]]);if(this.ref&&A.ref&&B.ref)bodies.push([this.ref,A.ref,B.ref]);
  const save=bodies.map(([f])=>({f,x:f.x,d:f.d,J:f.body.J,ang:f.body.ang,bd:f.body.d,rag:f.body.rag}));
  const S=this.stage,C=S.cam,cs={x:C.x,w:C.w,gy:C.gy,zoom:C.zoom,rot:S.rot,shake:S.shake};
  try{for(const[f,a,b]of bodies){f.x=a.x+(b.x-a.x)*u;f.d=b.d;f.body.J=lerpJ(a.J,b.J,u);f.body.ang=lerpA(a.ang,b.ang,u);f.body.d=b.bd;f.body.rag=null}
    C.x=A.cam.x+(B.cam.x-A.cam.x)*u;C.w=A.cam.w+(B.cam.w-A.cam.w)*u;C.gy=A.cam.gy+(B.cam.gy-A.cam.gy)*u;C.zoom=A.cam.zoom;S.rot=A.rot+(B.rot-A.rot)*u;S.shake=0;
    if(!rp.hit&&rp.t>=rp.end-.02){rp.hit=1;S.cam.zoom=.08}
    this.render(dt*KR.rate)}
  finally{for(const s of save){s.f.x=s.x;s.f.d=s.d;s.f.body.J=s.J;s.f.body.ang=s.ang;s.f.body.d=s.bd;s.f.body.rag=s.rag}Object.assign(C,{x:cs.x,w:cs.w,gy:cs.gy,zoom:cs.zoom});S.rot=cs.rot;S.shake=cs.shake}}}
{const css=document.createElement('style');css.textContent='.korp{position:absolute;left:50%;top:13%;transform:translateX(-50%);z-index:45;pointer-events:none;color:#fff;font:700 15px/1 system-ui,sans-serif;letter-spacing:.06em;background:rgba(0,0,0,.45);padding:7px 14px;border-radius:999px;animation:korp 1s ease-in-out infinite alternate}.korp b{color:#ff5148;margin-right:6px}@keyframes korp{from{opacity:.65}to{opacity:1}}';document.head.appendChild(css)}
})();
