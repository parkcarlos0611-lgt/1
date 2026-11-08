/* ===== Cutout.js : a fighter's FACE (head, hair, beard) taken from a flat-colour reference picture =====
   Only the head part is used: it replaces the vector head on the normal vector body (whose skin tone is matched to the picture).
   (The full body rig below is kept in the file but is not used: CO.body = false.)
   assets/cutout/<name>/parts.png + parts.json come from tools/cutout_rig.py: the picture is flattened to solid colours, split into
   body parts (head, torso, trunks, upper / fore arms with gloves, thighs, shins, feet), and the areas each part hides behind the
   parts in front of it are filled in. Here each part is bound to the physics skeleton by its two bone points: rotated, mirrored
   for the facing side, stretched along the bone to the fighter's own limb length. A look with `cutout:'<name>'` uses it; every
   other fighter keeps the vector art. Toggle: CUTOUT.on  (?cutout=0 in the URL turns it off). */
(function(){
if(typeof Body==='undefined')return;
const CO=window.CUTOUT={on:!/[?&]cutout=0/.test(location.search),sets:{}};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const CURATED={'Jon Jones':{cutout:'jones',skin:'#7d5033',shorts:'#232326',glove:'#17171a'}};
if(typeof lookFor==='function'){const lf=lookFor;window.lookFor=function(f){const L=lf.apply(this,arguments);const C=CURATED[f&&f.n];if(C)Object.assign(L,C);return L}}
function load(name){let S=CO.sets[name];if(S)return S;S=CO.sets[name]={ready:false};
  fetch('assets/cutout/'+name+'/parts.json').then(r=>r.json()).then(m=>{S.meta=m;const im=new Image();im.onload=()=>{S.img=im;S.ready=true};im.src='assets/cutout/'+name+'/'+m.image}).catch(()=>{S.failed=true});return S}
CO.body=false;
CO.head=function(ctx,hd,nk,H,B,d){const lk=B.look;if(!CO.on||!lk||!lk.cutout)return false;const S=load(lk.cutout);if(!S.ready)return false;const ku=H*1.03/(S.meta.h*.935)*1.08;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';put(ctx,S,'head',nk,hd,d,ku,1,1,true);return true};
CO.ok=function(B){if(!CO.body)return false;const lk=B&&B.look;if(!CO.on||!lk||!lk.cutout)return false;const S=load(lk.cutout);return !!(S.ready&&B.J&&B.J.hd)};
/* map the sprite so that its bone p0->p1 lies on the world segment A->B (mirrored for d = -1); the sprite is stretched along the bone, clamped */
function put(ctx,S,name,A,Bp,d,ku,lo,hi,uniform){const P=S.meta.parts[name];if(!P)return;
  const m=d,vx=m*(P.p1[0]-P.p0[0]),vy=-(P.p1[1]-P.p0[1]),vl=Math.hypot(vx,vy)||1;let ux=Bp.x-A.x,uy=Bp.y-A.y;const ul=Math.hypot(ux,uy)||1e-6;ux/=ul;uy/=ul;
  const kl=uniform?ku:ku*clamp(ul/(vl*ku),lo,hi),kw=ku;
  const w=(dx,dy)=>{const sx=m*dx,sy=-dy,al=(sx*vx+sy*vy)/vl,pe=(-sx*vy+sy*vx)/vl;return[kl*al*ux-kw*pe*uy,kl*al*uy+kw*pe*ux]};
  const [a,b]=w(1,0),[c,e]=w(0,1);const tx=A.x-(a*P.p0[0]+c*P.p0[1]),ty=A.y-(b*P.p0[0]+e*P.p0[1]);
  ctx.save();ctx.transform(a,b,c,e,tx,ty);ctx.drawImage(S.img,P.x,P.y,P.w,P.h,0,0,P.w,P.h);ctx.restore()}
CO.draw=function(B,ctx,o){o=o||{};const S=CO.sets[B.look.cutout],J=B.J,H=B.H,d=B.d||1;const ku=H*1.03/(S.meta.h*.935);/* the figure is ~841 px tall in a 900 px picture */
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  const nearLead=(d>0)===(B.stance>0);const lead={S:'lS',E:'lE',W:'lW',H:'lH',K:'lK',A:'lA',T:'lT'},rear={S:'rS',E:'rE',W:'rW',H:'rH',K:'rK',A:'rA',T:'rT'};const N=nearLead?lead:rear,F=nearLead?rear:lead;
  const ON=o.only?(k=>o.only.indexOf(k)>=0):null;
  if(!o.noShadow&&!o.onlyArm&&o.part!=='far'&&(!ON||ON('torso'))){ctx.save();ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();let x0=1e9,x1=-1e9;for(const k in J){x0=Math.min(x0,J[k].x);x1=Math.max(x1,J[k].x)}ctx.ellipse((x0+x1)/2,0,Math.min(Math.max(.16*H,(x1-x0)/2+.05*H),.42*H),.032*H,0,0,Math.PI*2);ctx.fill();ctx.restore()}
  const arm=(S2,pre)=>{put(ctx,S,pre+'Up',J[S2.S],J[S2.E],d,ku,.8,1.3);put(ctx,S,pre+'Fo',J[S2.E],J[S2.W],d,ku,.8,1.3)};
  const leg=(S2,pre)=>{put(ctx,S,pre+'Thigh',J[S2.H],J[S2.K],d,ku,.8,1.25);put(ctx,S,pre+'Shin',J[S2.K],J[S2.A],d,ku,.8,1.25);put(ctx,S,pre+'Foot',J[S2.A],J[S2.T],d,ku,.85,1.2)};
  const torso=()=>put(ctx,S,'torso',J.hip,J.sh,d,ku,.8,1.3);
  const trunks=()=>{const ax=J.hip.x-J.mid.x,ay=J.hip.y-J.mid.y,al=Math.hypot(ax,ay)||1;put(ctx,S,'trunks',J.hip,{x:J.hip.x+ax/al*120*ku,y:J.hip.y+ay/al*120*ku},d,ku,1,1,true)};
  const head=()=>put(ctx,S,'head',J.nk,J.hd,d,ku,1,1,true);
  ctx.save();
  if(o.onlyArm)arm(N,'n');else if(o.part==='far')arm(F,'f');
  else if(ON){if(ON('farArm'))arm(F,'f');if(ON('farLeg'))leg(F,'f');if(ON('torso'))torso();if(ON('nearLeg'))leg(N,'n');if(ON('shorts'))trunks();if(ON('head'))head();if(ON('nearArm'))arm(N,'n')}
  else{if(o.part!=='body')arm(F,'f');leg(F,'f');torso();leg(N,'n');trunks();head();if(o.part!=='body')arm(N,'n')}
  ctx.restore()};
})();
