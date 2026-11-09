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
/* faces for the referee and the coaches (character sheet): rigid head + neck down to the collar */
const REFS={ref:[['ref1','#e9b28b'],['ref2','#7a5236'],['ref3','#d9a07a'],['ref4','#dca883']],coach:[['coach3','#8a5a3c'],['coach5','#e0b090'],['coach7','#e3a982']]};
CO.pickRef=(lk,kind,idx)=>{const L=REFS[kind];if(!L)return;const c=L[idx!=null?idx%L.length:Math.floor(Math.random()*L.length)];lk.cutout=c[0];lk.skin=c[1];lk.headK=.126;lk.headDown=.014};
for(const k in REFS)REFS[k].forEach(c=>{try{load(c[0])}catch(e){}});
CO.variants=n=>{const c=CURATED[n];return c&&c.variants||null};CO.getVar=n=>{try{const v=+localStorage.getItem('cl_skin_'+n)||0;const c=CURATED[n];return c&&c.variants&&v<c.variants.length?v:0}catch(e){return 0}};CO.setVar=(n,v)=>{try{localStorage.setItem('cl_skin_'+n,String(v))}catch(e){}};
const CURATED={'Jon Jones':{cutout:'jones',skin:'#6b4a34',shorts:'#232326',glove:'#17171a',headK:0.138,headDown:.049},'Anderson Silva':{cutout:'silva',skin:'#8d5c34',shorts:'#1b1b1e',glove:'#17171a',headK:0.138,headDown:.049},
  'Alex Pereira':{cutout:'pereira',skin:'#c68d5a',shorts:'#1b1b1e',glove:'#17171a',headK:0.138,headDown:.049,tat:'',variants:[['pereira','머리 있는 버전'],['pereira2','삭발 버전']]},
  'Fedor Emelianenko':{cutout:'fedor',skin:'#e1a174',shorts:'#1b1b1e',glove:'#17171a',headK:0.138,headDown:.049,tat:''},'Mirko Cro Cop':{cutout:'cropcop',skin:'#e8a77a',shorts:'#1b1b1e',glove:'#17171a',headK:0.138,headDown:.049,tat:''},'Israel Adesanya':{cutout:'adesanya',skin:'#80502c',shorts:'#1b1b1e',glove:'#17171a',headK:0.138,headDown:.049,tat:''},
  'Conor McGregor':{cutout:'conor1',skin:'#e9a97c',shorts:'#1b1b1e',glove:'#17171a',headK:0.138,headDown:.049,tat:'',variants:[['conor1','짧은 머리'],['conor2','꽁지머리']]},'Cain Velasquez':{cutout:'cain',skin:'#dc9a6b',shorts:'#1b1b1e',glove:'#17171a',headK:0.138,headDown:.049,tat:''},'Jose Aldo':{cutout:'aldo',skin:'#c98c57',shorts:'#1b1b1e',glove:'#17171a',headK:0.138,headDown:.049,tat:''},'Junior dos Santos':{cutout:'jds',skin:'#d9966a',shorts:'#1b1b1e',glove:'#17171a',headK:0.138,headDown:.049,tat:''}};
if(typeof lookFor==='function'){const lf=lookFor;window.lookFor=function(f){const L=lf.apply(this,arguments);const C=CURATED[f&&f.n];if(C){Object.assign(L,C);if(C.variants){const v=CO.getVar(f.n);L.cutout=C.variants[v][0];if(v===1&&f.n==='Conor McGregor')L.headK=0.127;if(v===1&&f.n==='Alex Pereira'){L.skin='#c88c58';L.headK=0.121}}}return L}}
function load(name){let S=CO.sets[name];if(S)return S;S=CO.sets[name]={ready:false};
  fetch('assets/cutout/'+name+'/parts.json').then(r=>r.json()).then(m=>{S.meta=m;const im=new Image();im.onload=()=>{S.img=im;S.ready=true};im.src='assets/cutout/'+name+'/'+m.image}).catch(()=>{S.failed=true});
  /* the close-up of the head with neck and shoulder slope (used for the face when present) */
  S.pending=1;fetch('assets/cutout/'+name+'/head2.json').then(r=>r.json()).then(m=>{const base='assets/cutout/'+name+'/',im=new Image(),n=m.neck?new Image():null;const ld=i=>new Promise(res=>{i.onload=()=>{(i.decode?i.decode():Promise.resolve()).then(res,res)};i.onerror=res;});const ps=[ld(im)];im.src=base+m.image;if(n){ps.push(ld(n));n.src=base+m.neck}
    Promise.all(ps).then(()=>{/* published only when head AND neck are decoded, so the face never appears piece by piece */const h2={img:im,headH:m.headH,m,meta:{parts:{head2:{x:0,y:0,w:m.w,h:m.h,p0:m.p0,p1:m.p1}}}};if(n)h2.neck=n;S.h2=h2;try{if(window.FACEFX){FACEFX.skinMask(im);FACEFX.layer(im.width,im.height)}}catch(e){}/* warm the caches */S.pending=0;CO.warm=(CO.warm||0)+1})}).catch(()=>{S.pending=0});return S}
CO.body=false;
/* the neck as a bending strip: horizontal slices from the skull down to the shoulders, each turned by an angle between the head's and the trunk's, so the back of the neck folds when the head tips forward or back */
function neck(ctx,S2,hd,nk,B,d,ku,H,skin){const m=S2.m,P=S2.meta.parts.head2,p0=P.p0,y0=m.neckTop,y1=Math.round(m.neckTop+(m.neckBot-m.neckTop)*.45),W=m.w;/* only the top 45 % of the neck picture is used */const rr=m.neckRows&&m.neckRows[y1-2],qb=rr?[(rr[0]+rr[1])/2,y1]:[m.neckPivot[0],y1];const J=B.J,mm=d;
  const nrm=(x,y)=>{const l=Math.hypot(x,y)||1;return[x/l,y/l]};const uH=nrm(hd.x-nk.x,hd.y-nk.y),uT=nrm(nk.x-J.sh.x,nk.y-J.sh.y);const aH=Math.atan2(uH[1],uH[0])-Math.PI/2,aT=Math.atan2(uT[1],uT[0])-Math.PI/2;let da=aT-aH;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;
  const wh=(qx,qy)=>{const x=mm*(qx-p0[0])*ku,y=-(qy-p0[1])*ku,c=Math.cos(aH),s=Math.sin(aH);return{x:hd.x+c*x-s*y,y:hd.y+s*x+c*y}};
  const Wb=wh(qb[0],qb[1]);Wb.x+=d*.022*H;Wb.y-=.004*H;/* the base of the neck sits further toward the chest */const wt=(qx,qy)=>{const x=mm*(qx-qb[0])*ku,y=-(qy-qb[1])*ku,c=Math.cos(aT),s=Math.sin(aT);return{x:Wb.x+c*x-s*y,y:Wb.y+s*x+c*y}};
  const N=24,step=(y1-y0)/N,rows=m.neckRows;
  /* opaque backing: a solid skin column under the slices so no seam ever shows the background through the neck */
  const L=[],R=[];for(let i=0;i<=N;i++){const y=Math.min(y1-1,y0+i*step),t=i/N,sm=t*t*(3-2*t),r=rows&&rows[Math.round(y)];if(!r)continue;const cx=qb[0];
    for(const[side,x]of[[L,r[0]+4],[R,r[1]-4]]){const A=wh(x,y),Bt=wt(x,y);side.push({x:A.x+(Bt.x-A.x)*sm,y:A.y+(Bt.y-A.y)*sm})}}
  if(L.length>2){ctx.fillStyle=skin?shade(skin,-.02):'#6b4a34';ctx.beginPath();L.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));R.slice().reverse().forEach(q=>ctx.lineTo(q.x,q.y));ctx.closePath();ctx.fill()}
  for(let i=0;i<N;i++){const ya=y0+i*step,yb=ya+step,yc=(ya+yb)/2,t=(i+.5)/N,sm=t*t*(3-2*t),xc=qb[0];const A=wh(xc,yc),Bt=wt(xc,yc);const px=A.x+(Bt.x-A.x)*sm,py=A.y+(Bt.y-A.y)*sm,al=aH+da*sm;
    const ex=1.5;ctx.save();ctx.translate(px,py);ctx.rotate(al);ctx.scale(mm*ku,-ku);ctx.drawImage(S2.neck,0,ya-ex,W,step+2*ex,-xc,(ya-ex)-yc,W,step+2*ex);ctx.restore()}}
CO.head=function(ctx,hd,nk,H,B,d){const lk=B.look;if(!CO.on||!lk||!lk.cutout)return false;const S=load(lk.cutout);if(S.h2){/* anchored on the head centre, hanging down along the neck line */ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';const ku=H*(lk.headK||.145)/S.h2.headH;const Lh=Math.hypot(hd.x-nk.x,hd.y-nk.y)||1,dn=H*(lk.headDown!=null?lk.headDown:.049);const hd2={x:hd.x-(hd.x-nk.x)/Lh*dn,y:hd.y-(hd.y-nk.y)/Lh*dn};/* head a little lower */if(S.h2.neck)neck(ctx,S.h2,hd2,nk,B,d,ku,H,lk.skin);if(S.h2.m.nofx){/* referee / coach: a skin neck joins the rigid head to the shoulders */const a={x:hd2.x+(nk.x-hd2.x)*.35,y:hd2.y+(nk.y-hd2.y)*.35},b={x:nk.x+(nk.x-hd2.x)*.12,y:nk.y+(nk.y-hd2.y)*.12};ctx.save();ctx.strokeStyle=lk.skin;ctx.lineWidth=.062*H;ctx.lineCap='butt';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore()}put(ctx,S.h2,'head2',hd2,nk,d,ku,1,1,true,c=>{if(!window.FACEFX)return;{const q=S.h2.m.fx;if(S.h2.m.nofx||(q&&q.blinkOnly)){if(q&&q.blinkOnly)FACEFX.lid(c,q.G,FACEFX.blink(B),q.lid);return}}const fx=S.h2.m.fx,G=fx?fx.G:{eye:[395,222],brow:[400,190],brow2:[352,205],nose:[470,268],cheek:[372,292],fore:[360,110],lip:[432,358],u:44,down:1},mo=fx?fx.mouth:[452,352,40,18];FACEFX.mouth(c,[mo[0],mo[1]],mo[2],mo[3],1,B);FACEFX.lid(c,G,FACEFX.blink(B),fx?fx.lid:'#745239');/* bruises and blood: drawn on a layer cut to the face's skin, in the sprite's own (head-turning) space */if(FACEFX.hasWounds(B)){const mk=FACEFX.skinMask(S.h2.img);if(mk){const ly=FACEFX.layer(S.h2.img.width,S.h2.img.height),g=ly.getContext('2d');g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.clearRect(0,0,ly.width,ly.height);FACEFX.wounds(g,B,G,{cuts:true});g.globalCompositeOperation='destination-in';g.drawImage(mk,0,0);g.globalCompositeOperation='source-over';c.drawImage(ly,0,0)}}});return true}if(!S.ready)return false;const ku=H*1.03/(S.meta.h*.935)*1.08;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';/* the neck: a solid column from the shoulders up under the jaw (the picture's head part carries only a stub of it) */
  {const L=Math.hypot(hd.x-nk.x,hd.y-nk.y)||1e-5,ux=(hd.x-nk.x)/L,uy=(hd.y-nk.y)/L;let nx=-uy,ny=ux;if(nx*d<0){nx=-nx;ny=-ny}const skin=lk.skin||'#7d5033';
   const Q=(aa,bb)=>({x:nk.x+ux*aa+nx*bb,y:nk.y+uy*aa+ny*bb});
   const poly=[Q(-.05*H,.05*H),Q(.04*H,.042*H),Q(L*.9,.036*H),Q(L*1.0,-.04*H),Q(.03*H,-.075*H),Q(-.05*H,-.1*H)];
   ctx.fillStyle=shade(skin,-.04);ctx.beginPath();poly.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();ctx.fill();
   ctx.fillStyle=shade(skin,-.16);ctx.beginPath();[Q(-.05*H,.05*H),Q(.04*H,.042*H),Q(L*.9,.036*H),Q(L*.95,.0),Q(.04*H,-.012*H),Q(-.05*H,.01*H)].forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();ctx.fill()}
  put(ctx,S,'head',nk,hd,d,ku,1,1,true);return true};
CO.ok=function(B){if(!CO.body)return false;const lk=B&&B.look;if(!CO.on||!lk||!lk.cutout)return false;const S=load(lk.cutout);return !!(S.ready&&B.J&&B.J.hd)};
/* map the sprite so that its bone p0->p1 lies on the world segment A->B (mirrored for d = -1); the sprite is stretched along the bone, clamped */
function put(ctx,S,name,A,Bp,d,ku,lo,hi,uniform,cb){const P=S.meta.parts[name];if(!P)return;
  const m=d,vx=m*(P.p1[0]-P.p0[0]),vy=-(P.p1[1]-P.p0[1]),vl=Math.hypot(vx,vy)||1;let ux=Bp.x-A.x,uy=Bp.y-A.y;const ul=Math.hypot(ux,uy)||1e-6;ux/=ul;uy/=ul;
  const kl=uniform?ku:ku*clamp(ul/(vl*ku),lo,hi),kw=ku;
  const w=(dx,dy)=>{const sx=m*dx,sy=-dy,al=(sx*vx+sy*vy)/vl,pe=(-sx*vy+sy*vx)/vl;return[kl*al*ux-kw*pe*uy,kl*al*uy+kw*pe*ux]};
  const [a,b]=w(1,0),[c,e]=w(0,1);const tx=A.x-(a*P.p0[0]+c*P.p0[1]),ty=A.y-(b*P.p0[0]+e*P.p0[1]);
  ctx.save();ctx.transform(a,b,c,e,tx,ty);ctx.drawImage(S.img,P.x,P.y,P.w,P.h,0,0,P.w,P.h);if(cb)cb(ctx);ctx.restore()}
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
/* load every curated face while the menus are showing, so the first fight has them already */
for(const k in CURATED){const c=CURATED[k];if(c.cutout)load(c.cutout);(c.variants||[]).forEach(v=>load(v[0]))}
})();
