/* ===== KOReplay.js : KO cinematic — live slow motion, a wipe, then the replay =====
   Every simulation step records what is on screen (both fighters' and the referee's skeletons, facing, positions,
   camera, cage rotation). When a fight ends by KO / TKO:
     1. the live action continues in slow motion for ~2 s of game time (the fall),
     2. a wipe transition,
     3. replay: from 2 s before the finishing blow to just after it, slowed down (poses interpolated between
        recorded steps), with a REPLAY label,
     4. a wipe back, and the normal result sequence carries on. */
(function(){
if(typeof Match==='undefined')return;
const KR={keep:5,before:2.0,afterRp:.7,slowGame:2.0,slowK:.32,rate:.4,wipe:.7};
const snapF=f=>{const B=f.body,J={};for(const k in B.J){const q=B.J[k];J[k]={x:q.x,y:q.y}}return{x:f.x,d:f.d,J,ang:Object.assign({},B.ang),bd:B.d}};
/* record after every step (also through the slow-motion fall, so the replay can run a little past the blow) */
{const st=Match.prototype.step;Match.prototype.step=function(dt){const r=st.call(this,dt);const K=this._ko;if(K&&K.stage==='replay')return r;
  this._gclock=(this._gclock||0)+dt;if(this.phase!=='fight'&&!(K&&K.stage==='slow'))return r;
  const R=this._rec||(this._rec=[]);const S=this.stage,C=S.cam;
  R.push({gt:this._gclock,f:this.f.map(snapF),ref:this.ref&&this.ref.body.J.hd?snapF(this.ref):null,cam:{x:C.x,w:C.w,gy:C.gy,zoom:C.zoom},rot:S.rot||0});
  while(R.length>2&&this._gclock-R[0].gt>KR.keep)R.shift();return r}}
/* a KO / TKO starts the sequence with the live slow motion */
{const fin=Match.prototype.finish;Match.prototype.finish=function(w,method){const was=this.phase;const r=fin.apply(this,arguments);
  if(was!=='end'&&/KO/.test(method||'')&&this._rec&&this._rec.length>20&&!this._ko){this._ko={stage:'slow',koT:this._gclock||0,t:0};this.hitstop=0;
    this.slow=KR.slowGame/KR.slowK;this.slowK=KR.slowK;if(this.outro)this.outro.fallT=Math.max(this.outro.fallT||0,99)/* held until the replay is over */}
  return r}}
const lerpJ=(a,b,u)=>{const o={};for(const k in a){const p=a[k],q=b[k]||p;o[k]={x:p.x+(q.x-p.x)*u,y:p.y+(q.y-p.y)*u}}return o};
const lerpA=(a,b,u)=>{const o={};for(const k in a){const p=a[k],q=b[k];o[k]=typeof p==='number'&&typeof q==='number'?p+(q-p)*u:p}return o};
function wipe(M,label){const el=document.createElement('div');el.className='kowipe';el.innerHTML=label?`<span>${label}</span>`:'';M.root.appendChild(el);setTimeout(()=>el.remove(),KR.wipe*1000+80)}
function drawFrame(M,rp,dt){const fr=rp.fr;let i=0;while(i<fr.length-2&&fr[i+1].gt<rp.t)i++;const A=fr[i],B=fr[Math.min(i+1,fr.length-1)];const u=B.gt>A.gt?clamp((rp.t-A.gt)/(B.gt-A.gt),0,1):0;
  const bodies=M.f.map((f,k)=>[f,A.f[k],B.f[k]]);if(M.ref&&A.ref&&B.ref)bodies.push([M.ref,A.ref,B.ref]);
  const save=bodies.map(([f])=>({f,x:f.x,d:f.d,J:f.body.J,ang:f.body.ang,bd:f.body.d,rag:f.body.rag}));
  const S=M.stage,C=S.cam,cs={x:C.x,w:C.w,gy:C.gy,zoom:C.zoom,rot:S.rot,shake:S.shake};
  try{for(const[f,a,b]of bodies){f.x=a.x+(b.x-a.x)*u;f.d=b.d;f.body.J=lerpJ(a.J,b.J,u);f.body.ang=lerpA(a.ang,b.ang,u);f.body.d=b.bd;f.body.rag=null}
    C.x=A.cam.x+(B.cam.x-A.cam.x)*u;C.w=A.cam.w+(B.cam.w-A.cam.w)*u;C.gy=A.cam.gy+(B.cam.gy-A.cam.gy)*u;C.zoom=A.cam.zoom;S.rot=A.rot+(B.rot-A.rot)*u;S.shake=0;
    /* the finishing blow lands again: impact particles at the defender's head */
    if(!rp.hit&&rp.t>=rp.koT){rp.hit=1;const L=M.winner&&M.winner.opp||M.f[1];const hd=L.body.J.hd;if(hd){S.impact(hd.x,hd.y,1.4,'#fff',-(L.d||1));S.burst(hd.x,hd.y,-(L.d||1),16,'sweat',1.4);if(S.cam)S.cam.zoom=.1}}
    M.render(dt)}
  finally{for(const s of save){s.f.x=s.x;s.f.d=s.d;s.f.body.J=s.J;s.f.body.ang=s.ang;s.f.body.d=s.bd;s.f.body.rag=s.rag}Object.assign(C,{x:cs.x,w:cs.w,gy:cs.gy,zoom:cs.zoom});S.rot=cs.rot;S.shake=cs.shake}}
/* sequencing */
{const lp=Match.prototype.loop;Match.prototype.loop=function(now){const K=this._ko;if(!K||!this.running)return lp.call(this,now);
  if(K.stage==='slow'){const r=lp.call(this,now);if(this.slow<=0&&this._ko===K){/* live slow motion over: wipe into the replay */K.stage='wipeIn';K.t=0;wipe(this,'REPLAY')}return r}
  requestAnimationFrame(this.loop);const dt=Math.min(.05,(now-this.last)/1000);this.last=now;if(this.paused){this.render(0);return}K.t+=dt;
  if(K.stage==='wipeIn'){/* the screen is covered half-way through the wipe: switch to the replay then */if(K.t<KR.wipe*.5){this.render(dt);return}
    const R=this._rec||[];const t0=K.koT-KR.before,t1=K.koT+KR.afterRp;const fr=R.filter(s=>s.gt>=t0&&s.gt<=t1);
    if(fr.length<4){K.stage='done';this.outro&&(this.outro.fallT=(this.outro.t||0)+.6);return}
    K.rp={fr,t:fr[0].gt,end:fr[fr.length-1].gt,koT:K.koT,hit:0};K.stage='replay';K.t=0;const el=document.createElement('div');el.className='korp';el.innerHTML='<b>●</b> REPLAY';this.root.appendChild(el);K.el=el}
  if(K.stage==='replay'){K.rp.t+=dt*KR.rate;drawFrame(this,K.rp,dt*KR.rate);
    if(K.rp.t>=K.rp.end){K.stage='wipeOut';K.t=0;wipe(this,'')}return}
  if(K.stage==='wipeOut'){if(K.t<KR.wipe*.5){drawFrame(this,K.rp,0);return}
    if(K.el){K.el.remove();K.el=null}K.stage='done';this._ko=Object.assign(K,{stage:'done'});if(this.outro)this.outro.fallT=(this.outro.t||0)+.8;this.slow=0;this.slowK=null;this.render(dt);return}
  return lp.call(this,now)}}
/* 'done' leaves the normal loop running */
{const lp=Match.prototype.loop;Match.prototype.loop=function(now){if(this._ko&&this._ko.stage==='done'){const k=this._ko;this._ko=null;this._koDone=k}return lp.call(this,now)}}
{const css=document.createElement('style');css.textContent=
 '.korp{position:absolute;left:50%;top:13%;transform:translateX(-50%);z-index:45;pointer-events:none;color:#fff;font:800 15px/1 system-ui,sans-serif;letter-spacing:.14em;background:rgba(0,0,0,.5);padding:8px 16px;border-radius:999px}.korp b{color:#ff3b30;margin-right:8px;animation:korb 1s steps(2) infinite}@keyframes korb{50%{opacity:0}}'+
 '.kowipe{position:absolute;inset:0;z-index:60;pointer-events:none;overflow:hidden}.kowipe:before,.kowipe:after{content:"";position:absolute;top:-20%;bottom:-20%;width:140%;left:-160%;transform:skewX(-18deg);animation:kow '+KR.wipe+'s cubic-bezier(.6,0,.4,1) forwards}'+
 '.kowipe:before{background:#0c0c0f}.kowipe:after{background:#c8102e;width:14%;margin-left:-14%;animation-delay:.03s}'+
 '.kowipe span{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:#fff;font:900 46px/1 system-ui,sans-serif;letter-spacing:.2em;opacity:0;animation:kot '+KR.wipe+'s ease forwards}'+
 '@keyframes kow{0%{left:-160%}50%{left:-20%}100%{left:130%}}@keyframes kot{0%,30%{opacity:0}45%,60%{opacity:1}75%,100%{opacity:0}}';document.head.appendChild(css)}
})();
