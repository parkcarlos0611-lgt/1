/* ===== Frame.js : plain white frame ragdoll =====
   Every fighter is drawn as a bare white mannequin built on the same physics skeleton. Only the fighter's
   PHYSICAL traits are kept: height, reach (arm length), width / mass (bw), build (broad shoulders, soft, belly).
   No skin, face, hair, tattoo, trunks or gloves. The referee keeps his own outfit.  Toggle: FRAME.on */
(function(){
if(typeof Body==='undefined')return;
const FR=window.FRAME={on:true};const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const FILL='#f5f5f5',FARF='#d6d6d6',LINE='#7c7c80';
function shape(ctx,path,fill,lw){ctx.beginPath();path(ctx);ctx.lineJoin='round';ctx.lineWidth=lw*2;ctx.strokeStyle=LINE;ctx.stroke();ctx.fillStyle=fill;ctx.fill()}
function cap(ctx,a,b,r0,r1,fill,lw){shape(ctx,c=>{const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1e-5,nx=-dy/L,ny=dx/L;
  c.moveTo(a.x+nx*r0,a.y+ny*r0);c.lineTo(b.x+nx*r1,b.y+ny*r1);c.lineTo(b.x-nx*r1,b.y-ny*r1);c.lineTo(a.x-nx*r0,a.y-ny*r0);c.closePath();
  c.moveTo(a.x+r0,a.y);c.arc(a.x,a.y,r0,0,Math.PI*2);c.moveTo(b.x+r1,b.y);c.arc(b.x,b.y,r1,0,Math.PI*2)},fill,lw)}
const dot=(ctx,p,r,fill,lw)=>shape(ctx,c=>{c.moveTo(p.x+r,p.y);c.arc(p.x,p.y,r,0,Math.PI*2)},fill,lw);
FR.draw=function(B,ctx,o){o=o||{};const J=B.J,H=B.H,lk=B.look,d=B.d||1;if(!J.hd)return;
  const M=H*(B.W||1)*.86;const broad=lk.body==='broad'?1.14:1,belly=lk.belly||lk.body==='belly'?1:lk.body==='soft'?.4:0;const lw=.0035*H;
  const nearLead=(d>0)===(B.stance>0);const lead={S:'lS',E:'lE',W:'lW',G:'lG',H:'lH',K:'lK',A:'lA',He:'lHe',T:'lT'},rear={S:'rS',E:'rE',W:'rW',G:'rG',H:'rH',K:'rK',A:'rA',He:'rHe',T:'rT'};
  const N=nearLead?lead:rear,F=nearLead?rear:lead;
  const ON=o.only?(k=>o.only.indexOf(k)>=0):null;
  const Z=B._zJ||{},zs=k=>clamp(1+(Z[k]||0)*1.5,.7,1.55);
  const arm=(S,far)=>{const f=far?FARF:FILL,a=J[S.S],e=J[S.E],w=J[S.W],g=J[S.G];cap(ctx,a,e,.05*M*zs(S.S),.038*M*zs(S.E),f,lw);cap(ctx,e,w,.036*M*zs(S.E),.026*M*zs(S.W),f,lw);dot(ctx,e,.037*M*zs(S.E),f,lw);
    dot(ctx,{x:(w.x+g.x)/2,y:(w.y+g.y)/2},.036*M*zs(S.G),f,lw)};/* fist */
  const leg=(S,far)=>{const f=far?FARF:FILL,h=J[S.H],k=J[S.K],a=J[S.A],he=J[S.He],t=J[S.T];cap(ctx,h,k,.075*M*zs(S.H),.048*M*zs(S.K),f,lw);cap(ctx,k,a,.046*M*zs(S.K),.03*M*zs(S.A),f,lw);dot(ctx,k,.047*M*zs(S.K),f,lw);
    cap(ctx,he,t,.026*M*zs(S.A),.018*M*zs(S.T),f,lw);dot(ctx,a,.03*M*zs(S.A),f,lw)};
  const torso=()=>{const sp=[J.hip,J.mid,J.sh];cap(ctx,J.hip,J.mid,.082*M,.074*M*(1+belly*.2),FILL,lw);cap(ctx,J.mid,J.sh,.074*M*(1+belly*.2),.1*M*broad,FILL,lw);cap(ctx,J.sh,J.nk,.05*M,.034*M,FILL,lw);
    if(belly>0){const c={x:J.mid.x+d*.03*M*belly,y:J.mid.y};dot(ctx,c,.09*M*belly,FILL,lw)}};
  const pelvis=()=>cap(ctx,J.lH,J.rH,.08*M,.08*M,FILL,lw);
  const head=()=>{const r=.066*H;ctx.save();ctx.translate(J.hd.x,J.hd.y);ctx.rotate(-(B.ang&&B.ang.hd||0)*.9);ctx.scale(d,1);shape(ctx,c=>{c.ellipse(0,0,r*1.05,r*1.2,0,0,Math.PI*2)},FILL,lw);ctx.restore()};
  if(!o.noShadow&&!o.onlyArm&&o.part!=='far'&&(!ON||ON('torso'))){ctx.save();ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse((J.lA.x+J.rA.x)/2,0,.3*H,.032*H,0,0,Math.PI*2);ctx.fill();ctx.restore()}
  ctx.save();
  if(o.onlyArm)arm(N,false);else if(o.part==='far')arm(F,true);
  else if(ON){if(ON('farArm'))arm(F,true);if(ON('farLeg'))leg(F,true);if(ON('torso'))torso();if(ON('nearLeg'))leg(N,false);if(ON('shorts'))pelvis();if(ON('head'))head();if(ON('nearArm'))arm(N,false)}
  else{if(o.part!=='body')arm(F,true);leg(F,true);torso();leg(N,false);pelvis();head();if(o.part!=='body')arm(N,false)}
  ctx.restore()};
})();
