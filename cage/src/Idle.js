/* ===== Idle.js : a living idle, blinking and face damage =====
   • Idle: when a fighter is standing and not attacking, the upper body keeps moving like a real fighter in a stance — breathing,
     shoulder turns, slight head bob, both fists circling a little, knees bouncing, the weight shifting from foot to foot.
     Moving up and down also swings the legs toward / away from the camera alternately (the depth map of Combat3), so the
     stance reads as 3D. Calmer while walking, still when stunned. Each fighter has his own phase and tempo.
   • Blink: every few seconds the eyelid closes and opens (window.FACEFX.blink(body) = 0..1 for every face renderer).
   • Face damage: eye bruising, redness, scrapes and the engine's cuts with blood, mild until the head is at 50 %, then
     growing quickly. Drawn by whichever head is on screen (FACEFX.wounds). */
(function(){
if(typeof F2==='undefined'||typeof Body==='undefined')return;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const FX=window.FACEFX={on:true};
const IDLE=window.IDLE={on:true};
const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0)/4294967296};
const T=()=>performance.now()/1000;

/* ---------- idle motion (pose layer) ---------- */
{const fw=F2.prototype.footwork;F2.prototype.footwork=function(p,dt){fw.call(this,p,dt);this.body._zIdle=null;
  if(!IDLE.on||this.body.rag||this.state!=='stand'||this.act||this.gpose||this.evA||this.down)return;
  const ph=this._iph||(this._iph=hash((this.name||'x')+'idle')*6.28),tp=.9+hash((this.name||'x')+'tempo')*.25;/* tempo 0.9..1.15 */
  const mv=Math.min(1,Math.abs(this.mvIn||0)*1.4),calm=(1-.65*mv)*(this.rock>0?.35:1);const t=T()*tp+ph;
  const b1=Math.sin(t*3.6),b2=Math.sin(t*3.6+Math.PI),sw=Math.sin(t*1.25+1.3),br=Math.sin(t*.9),s2=Math.sin(t*2.1+.6);
  /* upper body: breathing, shoulder turn, head bob */
  p.lean+=.016*br*calm+.012*b1*calm;p.chest+=.012*Math.sin(t*.9+.5)*calm;p.tw+=.07*sw*calm;p.head+=.022*Math.sin(t*3.6+.7)*calm-.01*sw*calm;
  /* fists circle a little, one after the other */
  p.la_s+=.06*b1*calm+.02*s2*calm;p.la_e+=.09*b2*calm;p.ra_s+=.06*b2*calm+.02*s2*calm;p.ra_e+=.09*b1*calm;
  /* legs: knee bounce (opposite phases), heel lift, weight shift */
  p.ll_k+=(.05+.05*b1)*calm;p.rl_k+=(.05+.05*b2)*calm;p.ll_h+=.035*sw*calm;p.rl_h-=.03*sw*calm;p.ll_a+=.05*b1*calm;p.rl_a+=.05*b2*calm;
  /* up and down also moves the legs toward / away from the camera, alternately */
  const A=.04*this.body.H*calm,z=A*Math.sin(t*1.8+.4),zl={};const w={H:0,K:.5,A:1,He:1,T:1};
  for(const k in w){zl['l'+k]=z*w[k];zl['r'+k]=-z*w[k]}
  zl.lS=-z*.35;zl.lE=-z*.4;zl.lW=-z*.45;zl.lG=-z*.5;zl.rS=z*.35;zl.rE=z*.4;zl.rW=z*.45;zl.rG=z*.5;
  this.body._zIdle=zl}}

/* ---------- blink ---------- */
FX.blink=function(B){if(!FX.on)return 0;const o=B._owner,name=(B.look&&B.look.name)||'x';let k=B._bk;const t=T();if(!k)k=B._bk={next:t+1+hash(name+'b')*3,t0:-9,dur:.15+hash(name+'d')*.05};
  if(t>=k.next){k.t0=t;k.next=t+2.4+Math.random()*3.8;if(Math.random()<.15)k.next=t+.35}/* sometimes a double blink */
  const u=(t-k.t0)/k.dur;let a=0;if(u>=0&&u<=1)a=u<.4?u/.4:1-(u-.4)/.6;
  const sw=clamp((B.swell||0)*.35,0,.45);/* a swollen eye never opens fully */const hp=o&&o.hp?o.hp.head:100;const heavy=clamp((50-hp)/50,0,1)*.22;
  return clamp(Math.max(a,sw+heavy,FX.hurt(B)*.97),0,1)};
/* being hit: the eyes squeeze shut and the mouth opens a little (black inside: a mouthpiece). Eases in fast, out slowly. */
FX.hurt=function(B){const o=B._owner;let h=0;if(o){if(o.hitF>0)h=Math.max(h,clamp(o.hitF/.14,0,1));if(o.flinch>0)h=Math.max(h,.7);if(o.rock>0)h=Math.max(h,.55)}if(B.ko)h=1;const c=B._hurt||0;B._hurt=c+(h-c)*(h>c?.6:.1);return B._hurt};
FX.mouth=function(ctx,P,w,hh,down,B){const h=FX.hurt(B);if(h<.08)return;ctx.save();ctx.fillStyle='#0b0708';ctx.beginPath();ctx.ellipse(P[0],P[1],w*.5,Math.max(w*.08,hh*h*.5),0,0,7);ctx.fill();ctx.restore()};

/* ---------- face damage ---------- */
const CUT_AT={brow:'brow',brow2:'brow2',nose:'nose',cheek:'cheek',fore:'fore',lip:'lip'};
/* G: geometry in the current drawing space: eye / brow / brow2 / nose / cheek / fore / lip points, u = eye width, down = +1 if y grows downward (sprite px), -1 if it grows upward (world) */
FX.wounds=function(ctx,B,G,opt){if(!FX.on)return;opt=opt||{};const o=B._owner,hp=o&&o.hp?o.hp.head:100,d=clamp(1-hp/100,0,1),light=clamp(d/.5,0,1),s=clamp((50-hp)/50,0,1);
  const swell=clamp(B.swell||0,0,1.5),u=G.u,dn=G.down;if(d<.02&&swell<.05&&!(B.cuts&&B.cuts.length))return;
  ctx.save();
  /* eye bruise: a dark purple ring that gets a yellow-green edge once it is old / heavy */
  {const a=.12*light+.5*s+swell*.18;if(a>.02){const e=G.eye,cx=e[0]-u*.05,cy=e[1]-dn*u*.1;ctx.save();ctx.translate(cx,cy);ctx.scale(1,.78);
    if(s>.25){const g2=ctx.createRadialGradient(0,0,u*.5,0,0,u*1.5);g2.addColorStop(0,`rgba(120,105,40,${.3*s})`);g2.addColorStop(1,'rgba(120,105,40,0)');ctx.fillStyle=g2;ctx.beginPath();ctx.arc(0,0,u*1.5,0,7);ctx.fill()}
    const g=ctx.createRadialGradient(0,0,u*.15,0,0,u*1.05);g.addColorStop(0,`rgba(62,22,58,${Math.min(.85,a)})`);g.addColorStop(.7,`rgba(78,32,70,${Math.min(.6,a*.7)})`);g.addColorStop(1,'rgba(78,32,70,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,u*1.05,0,7);ctx.fill();ctx.restore()}}
  /* the engine's cuts with blood runs (the earlier look): a dark cut, a blood streak running down, a nose bleed when it is cut or the face is very red */
  if(opt.cuts!==false&&B.cuts){for(const c of B.cuts){const P=G[CUT_AT[c.at]||'brow'];if(!P)continue;const sev=c.sev;
      ctx.fillStyle='#5a0303';ctx.save();ctx.translate(P[0],P[1]);ctx.rotate(-.25*dn);ctx.fillRect(-u*.45,-u*.05,u*.9,u*.1);ctx.restore();
      if(sev>.25){const L=u*(1+Math.min(7,sev*3.4));ctx.globalAlpha=.85;ctx.fillStyle='#960808';ctx.beginPath();ctx.moveTo(P[0]-u*.22,P[1]);ctx.lineTo(P[0]+u*.25,P[1]);ctx.lineTo(P[0]+u*.1,P[1]+dn*L);ctx.lineTo(P[0]-u*.06,P[1]+dn*L*.9);ctx.closePath();ctx.fill();ctx.globalAlpha=1}}
    if(B.cuts.some(c=>c.at==='nose')||(B.redness||0)>.72){const n=G.nose;ctx.globalAlpha=.85;ctx.fillStyle='#8c0608';ctx.beginPath();ctx.moveTo(n[0]-u*.1,n[1]);ctx.lineTo(n[0]+u*.2,n[1]);ctx.lineTo(n[0]+u*.1,n[1]+dn*u*2.6);ctx.lineTo(n[0]-u*.2,n[1]+dn*u*2.6);ctx.closePath();ctx.fill();ctx.globalAlpha=1}}
  ctx.restore()};
FX.redOverlay=function(img,B){const red=B.redness||0,a=Math.min(.4,red*.45);if(a<.03)return null;const k=Math.round(a*25);const C=FX._rc||(FX._rc={});const key=img.src+k;if(C[key])return C[key];
  const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const g=c.getContext('2d');g.drawImage(img,0,0);let id;try{id=g.getImageData(0,0,c.width,c.height)}catch(e){return null}const D=id.data,al=k/25;
  for(let i=0;i<D.length;i+=4){const r=D[i],gg=D[i+1],b=D[i+2];const skin=D[i+3]>8&&r>gg&&gg>=b&&r-b>22&&(r+gg+b)/3>70;if(!skin){D[i+3]=0;continue}D[i]=184;D[i+1]=67;D[i+2]=58;D[i+3]=Math.round(255*al)}
  g.putImageData(id,0,0);return C[key]=c};
/* the eyelid for sprite faces: a skin-coloured lid sliding down over the eye, with a lash line when nearly closed */
FX.lid=function(ctx,G,a,skin){if(a<.03)return;const e=G.eye,u=G.u,w=u*1.25,h=u*.7*a;ctx.save();ctx.fillStyle=skin;ctx.beginPath();const top=e[1]-G.down*u*.42;ctx.ellipse(e[0],top+G.down*(h*.5),w*.5,Math.max(1,h*.55),0,0,7);ctx.fill();
  if(a>.35){ctx.strokeStyle='rgba(30,18,14,.85)';ctx.lineWidth=u*.07;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(e[0]-w*.42,top+G.down*h*.95);ctx.quadraticCurveTo(e[0],top+G.down*(h*1.15),e[0]+w*.42,top+G.down*h*.9);ctx.stroke()}ctx.restore()};
})();
