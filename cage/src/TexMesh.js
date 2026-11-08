/* ===== TexMesh.js : texture-mesh graphics. The 2D physics skeleton (Body.solve / ragdoll joints) is untouched;
   every fighter is painted from a body-part texture set (assets/fighters/<set>/parts.png + parts.json) that is
   bound to the joints (bone-attached cut-out mesh), with per-part damage layers (bruises, cuts, blood, swelling)
   painted into the part textures themselves so they move/deform with the limb.
   Per fighter: height / width / reach come from the skeleton, skin tone / glove strap / trunks colour from the look,
   and `look.tex` can name another texture set (default 'kane'). Disable with ?tex=0 or TexMesh.on=false. */
(function(){
if(typeof Body==='undefined')return;
const TM=window.TexMesh={on:!/[?&]tex=0/.test(location.search),sets:{},cache:{}};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
function loadSet(name){if(TM.sets[name])return TM.sets[name];const S=TM.sets[name]={ready:false,failed:false,name};
  fetch('assets/fighters/'+name+'/parts.json').then(r=>{if(!r.ok)throw 0;return r.json()}).then(meta=>{S.meta=meta;const im=new Image();im.onload=()=>{S.img=im;S.ready=true};im.onerror=()=>{S.failed=true};im.src='assets/fighters/'+name+'/'+meta.image}).catch(()=>{S.failed=true});return S}
loadSet('kane');
const setOf=b=>{const n=b.look&&b.look.tex||'kane';const S=loadSet(n);return S.ready?S:(n!=='kane'&&TM.sets.kane.ready?TM.sets.kane:S)};
TM.ok=function(b){if(!TM.on||!b||!b.J||!b.J.hd||!b.look||b.look.ref)return false;const S=setOf(b);return !!S.ready};

/* ---- colour variants of the atlas (skin tone, strap colour, trunks colour), cached ---- */
const hex=c=>{if(!c)return null;if(c[0]==='#'){let h=c.slice(1);if(h.length===3)h=h.replace(/./g,'$&$&');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]}const m=/(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(c);return m?[+m[1],+m[2],+m[3]]:null};
const REFSKIN=[226,152,108];
function variant(S,skin,strap,shorts){const key=S.name+'|'+skin+'|'+strap+'|'+shorts;if(TM.cache[key])return TM.cache[key];
  const im=S.img,c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);
  const sk=hex(skin),st=hex(strap),sh=hex(shorts);let recol=false;
  if(sk||st||sh){try{const id=g.getImageData(0,0,c.width,c.height),D=id.data;
    const rs=sk?[sk[0]/REFSKIN[0],sk[1]/REFSKIN[1],sk[2]/REFSKIN[2]]:null;const noChange=sk&&Math.abs(rs[0]-1)+Math.abs(rs[1]-1)+Math.abs(rs[2]-1)<.12;
    const shDark=!sh||(sh[0]+sh[1]+sh[2])<90;
    for(let i=0;i<D.length;i+=4){if(!D[i+3])continue;const r=D[i],gg=D[i+1],b=D[i+2],lum=(r+gg+b)/3;
      if(st&&r>140&&gg<95&&b<95&&r>gg*1.8){const k=lum/110;D[i]=clamp(st[0]*k,0,255);D[i+1]=clamp(st[1]*k,0,255);D[i+2]=clamp(st[2]*k,0,255);continue}
      if(rs&&!noChange&&r>gg+8&&gg>b&&lum>70&&lum<245&&!(r>150&&gg<95)){D[i]=clamp(r*rs[0],0,255);D[i+1]=clamp(gg*rs[1],0,255);D[i+2]=clamp(b*rs[2],0,255);continue}
      if(!shDark&&Math.max(r,gg,b)-Math.min(r,gg,b)<26&&lum<150){const k=(lum+18)/90;D[i]=clamp(sh[0]*k,0,255);D[i+1]=clamp(sh[1]*k,0,255);D[i+2]=clamp(sh[2]*k,0,255)}}
    g.putImageData(id,0,0);recol=true}catch(e){}}
  const dk=document.createElement('canvas');dk.width=c.width;dk.height=c.height;const gd=dk.getContext('2d');gd.drawImage(c,0,0);gd.globalCompositeOperation='source-atop';gd.fillStyle='rgba(30,12,10,.30)';gd.fillRect(0,0,dk.width,dk.height);
  return TM.cache[key]={a:c,dark:dk,recol}}

/* ---- per-body state: damage layers (one canvas per part, same size as the part texture) ---- */
function state(b,S){let s=b._tm;if(s&&s.S===S)return s;s=b._tm={S,dmg:{},dyn:null,dynKey:'',M:{}};return s}
function layer(s,part){let c=s.dmg[part];if(!c){const P=s.S.meta.parts[part];c=s.dmg[part]=document.createElement('canvas');c.width=P.w;c.height=P.h}return c}
function maskTo(s,c,part){const P=s.S.meta.parts[part],g=c.getContext('2d');g.save();g.globalCompositeOperation='destination-in';g.drawImage(s.S.img,P.x,P.y,P.w,P.h,0,0,P.w,P.h);g.restore()}

/* paint helpers (texture-space, part-local pixels) */
function bruise(g,x,y,r,a,hue){const gr=g.createRadialGradient(x,y,0,x,y,r);const c=hue==='red'?'150,30,30':hue==='yel'?'150,125,40':'92,40,90';gr.addColorStop(0,`rgba(${c},${a})`);gr.addColorStop(.6,`rgba(${c},${a*.55})`);gr.addColorStop(1,`rgba(${c},0)`);g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,7);g.fill()}
function scrape(g,x,y,r,a){g.strokeStyle=`rgba(140,30,28,${a})`;g.lineWidth=Math.max(1,r*.12);g.lineCap='round';for(let i=0;i<4;i++){const o=(Math.random()-.5)*r;g.beginPath();g.moveTo(x-r*.5,y+o);g.lineTo(x+r*.5+Math.random()*r*.2,y+o+(Math.random()-.5)*r*.3);g.stroke()}}
function cutMark(g,x,y,len,sev,drip){g.save();g.lineCap='round';g.strokeStyle='rgba(60,2,4,.95)';g.lineWidth=Math.max(1.5,len*.07*(.8+sev*.4));g.beginPath();g.moveTo(x-len*.5,y+len*.1);g.lineTo(x+len*.5,y-len*.08);g.stroke();
  g.strokeStyle='rgba(170,10,14,.85)';g.lineWidth=Math.max(1,len*.035);g.beginPath();g.moveTo(x-len*.45,y+len*.1);g.lineTo(x+len*.45,y-len*.08);g.stroke();
  if(drip&&sev>.5){const L=len*(.8+sev*.8);const gr=g.createLinearGradient(x,y,x,y+L);gr.addColorStop(0,'rgba(150,6,10,.8)');gr.addColorStop(1,'rgba(150,6,10,0)');g.strokeStyle=gr;g.lineWidth=Math.max(1.5,len*.09);g.beginPath();g.moveTo(x+len*.1,y);g.quadraticCurveTo(x+len*.18,y+L*.5,x+len*.1,y+L);g.stroke()}g.restore()}

/* where a hit lands on a part (part-local px), spread along/around the bone */
function spot(P,t0,t1,side){const bx=P.p0[0]+(P.p1[0]-P.p0[0])*(t0+Math.random()*(t1-t0)),by=P.p0[1]+(P.p1[1]-P.p0[1])*(t0+Math.random()*(t1-t0));const L=Math.hypot(P.p1[0]-P.p0[0],P.p1[1]-P.p0[1])||1;const nx=-(P.p1[1]-P.p0[1])/L,ny=(P.p1[0]-P.p0[0])/L;const o=(Math.random()-.5)*L*(side||.25);return[bx+nx*o,by+ny*o]}
TM.hit=function(b,o,blocked){const S=setOf(b);if(!S.ready)return;const s=state(b,S),M=S.meta,pt=M.parts;const dmg=o.dmg||5,z=o.zone;const a=clamp(.18+dmg*.035,.2,.7);
  let part,pos;
  if(z==='head'){part='head';const mk=Object.values(M.marks);const m=mk[Math.floor(Math.random()*mk.length)];pos=[m[0]+(Math.random()-.5)*20,m[1]+(Math.random()-.5)*20]}
  else if(z==='leg'){part=Math.random()<.6?'thigh_n':'thigh_f';pos=spot(pt[part],.35,.95,.4)}
  else{part=Math.random()<.85?'torso':'pelvis';pos=spot(pt[part],.2,.9,.5)}
  if(blocked){part=Math.random()<.5?'farm_n':'uarm_n';pos=spot(pt[part],.2,.9,.4)}
  const c=layer(s,part),g=c.getContext('2d');const r=(blocked?16:22+dmg*1.4)*(z==='head'?.8:1);
  bruise(g,pos[0],pos[1],r,blocked?a*.5:a,blocked?'red':Math.random()<.35?'red':'pur');
  if(!blocked&&(o.kind==='kick'||o.kind==='knee'||Math.random()<.4))scrape(g,pos[0],pos[1],r*.9,.5);
  maskTo(s,c,part)}

/* head wounds: skin flush, eye swelling, cuts with blood runs; rebuilt only when the numbers change */
function headDyn(b,s){const B=b,key=B.redness.toFixed(2)+'|'+B.swell.toFixed(2)+'|'+(B.cuts||[]).map(c=>c.at+c.sev.toFixed(1)).join(',');if(s.dynKey===key&&s.dyn)return s.dyn;s.dynKey=key;
  const P=s.S.meta.parts.head,M=s.S.meta.marks;let c=s.dyn;if(!c){c=s.dyn=document.createElement('canvas');c.width=P.w;c.height=P.h}const g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);
  const R=clamp(B.redness||0,0,1);if(R>.04){const gr=g.createRadialGradient(M.cheek[0],M.cheek[1],5,M.cheek[0]-10,M.cheek[1]-20,120);gr.addColorStop(0,`rgba(190,40,40,${R*.55})`);gr.addColorStop(1,'rgba(190,40,40,0)');g.fillStyle=gr;g.fillRect(0,0,c.width,c.height);g.fillStyle=`rgba(190,50,45,${R*.18})`;g.fillRect(0,0,c.width,c.height)}
  const sw=clamp(B.swell||0,0,1.2);if(sw>.05){bruise(g,M.eye[0]+4,M.eye[1]+4,18+sw*20,.35+sw*.4,'pur');bruise(g,M.brow[0],M.brow[1]-6,14+sw*10,sw*.5,'red');bruise(g,M.cheek[0]+6,M.cheek[1]-4,12+sw*16,sw*.4,'pur')}
  const CP={brow:'brow',brow2:'brow',nose:'nose',cheek:'cheek',fore:'fore',lip:'lip'};
  for(const cu of(B.cuts||[])){const m=M[CP[cu.at]||'brow'];if(!m)continue;const off=cu.at==='brow2'?[-16,6]:[0,0];cutMark(g,m[0]+off[0],m[1]+off[1],20+cu.sev*8,cu.sev,true)}
  maskTo(s,c,'head');return c}

/* ---- drawing ---- */
function put(ctx,img,P,A,B,o){/* bone-attached cut-out: map part bone p0->p1 to joints A->B */
  const m=o.d,vx=m*(P.p1[0]-P.p0[0]),vy=-(P.p1[1]-P.p0[1]),vl=Math.hypot(vx,vy)||1;let ux=B.x-A.x,uy=B.y-A.y;const ul=Math.hypot(ux,uy)||1e-6;ux/=ul;uy/=ul;
  const ku=o.ku;let kl=o.uniform?ku:ku*clamp(ul/(vl*ku),.78,1.4);const kw=ku*(o.w||1);
  const w=(dx,dy)=>{const sx=m*dx,sy=-dy,al=(sx*vx+sy*vy)/vl,pe=(-sx*vy+sy*vx)/vl;return[kl*al*ux-kw*pe*uy,kl*al*uy+kw*pe*ux]};
  const [a,b]=w(1,0),[c,d]=w(0,1);const e=A.x-(a*P.p0[0]+c*P.p0[1]),f=A.y-(b*P.p0[0]+d*P.p0[1]);
  ctx.save();ctx.transform(a,b,c,d,e,f);ctx.drawImage(img,P.x,P.y,P.w,P.h,0,0,P.w,P.h);return true}
function drawPart(ctx,s,V,name,A,B,o,far){const P=s.S.meta.parts[name];if(!put(ctx,far?V.dark:V.a,P,A,B,o))return;
  const dl=s.dmg[name];if(dl)ctx.drawImage(dl,0,0);if(name==='head'){const hd=headDyn(o.body,s);ctx.drawImage(hd,0,0)}ctx.restore()}
const sub=(a,b,k)=>({x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k});
TM.draw=function(b,ctx,o){o=o||{};const S=setOf(b),s=state(b,S),J=b.J,H=b.H,d=b.d||1,lk=b.look;
  const skin=lk.skin,strap=o.corner||'#c21818',shorts=lk.shorts;const V=variant(S,skin,strap,shorts);
  const ku=H/S.meta.refH,Wd=clamp(b.W*.97,.85,1.25);
  const nearLead=(d>0)===(b.stance>0);const L={S:'lS',E:'lE',W:'lW',G:'lG',H:'lH',K:'lK',A:'lA',He:'lHe',T:'lT'},Rr={S:'rS',E:'rE',W:'rW',G:'rG',H:'rH',K:'rK',A:'rA',He:'rHe',T:'rT'};
  const N=nearLead?L:Rr,F=nearLead?Rr:L;
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  if(!o.noShadow){ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse((J.lA.x+J.rA.x)/2,0,.32*H,.035*H,0,0,Math.PI*2);ctx.fill()}
  const oo=Object.assign({},o,{body:b,d,ku,w:1});const wv=(w,u)=>Object.assign({},oo,{w:w,uniform:!!u});
  const arm=(Sx,pre,far)=>{drawPart(ctx,s,V,'uarm_'+pre,J[Sx.S],J[Sx.E],wv(Wd),far);
    /* forearm+glove: elbow -> glove centre */const gc=sub(J[Sx.W],J[Sx.G],.5);drawPart(ctx,s,V,'farm_'+pre,J[Sx.E],gc,wv(Wd),far)};
  const leg=(Sx,pre,far)=>{drawPart(ctx,s,V,'thigh_'+pre,J[Sx.H],J[Sx.K],wv(Wd),far);drawPart(ctx,s,V,'shin_'+pre,J[Sx.K],J[Sx.A],wv(Wd),far);drawPart(ctx,s,V,'foot',J[Sx.A],J[Sx.T],wv(1),far)};
  arm(F,'f',true);leg(F,'f',true);
  drawPart(ctx,s,V,'torso',J.hip,J.sh,wv(Wd*1.02),false);
  leg(N,'n',false);
  /* pelvis (belt + shorts waist): hangs from the hip along the trunk axis */
  {const ax=J.hip.x-J.mid.x,ay=J.hip.y-J.mid.y,al=Math.hypot(ax,ay)||1,len=95*ku;drawPart(ctx,s,V,'pelvis',J.hip,{x:J.hip.x+ax/al*len,y:J.hip.y+ay/al*len},wv(Wd*1.02,1),false)}
  drawPart(ctx,s,V,'head',J.nk,J.hd,wv(1,1),false);
  arm(N,'n',false);
  if(o.highlight){ctx.globalAlpha=o.highlight;ctx.globalCompositeOperation='lighter';ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(J.hd.x,J.hd.y,.1*H,0,7);ctx.fill()}
  ctx.restore();return true};

/* ---- hit hook: paint the injury into the part texture that was hit ---- */
if(typeof Match!=='undefined'){const ad=Match.prototype.applyDmg;Match.prototype.applyDmg=function(att,def,o){const r=ad.call(this,att,def,o);try{if(o&&TM.ok(def.body)&&(o.dmg||0)>1.5){if(o.blocked)TM.hit(def.body,o,true);else TM.hit(def.body,o,false)}}catch(e){}return r}}
document.addEventListener('keydown',e=>{if(e.code==='F9'){TM.on=!TM.on}});
})();
