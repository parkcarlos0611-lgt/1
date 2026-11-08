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
  return clamp(Math.max(a,sw+heavy),0,1)};

/* ---------- face damage ---------- */
const CUT_AT={brow:'brow',brow2:'brow2',nose:'nose',cheek:'cheek',fore:'fore',lip:'lip'};
/* G: geometry in the current drawing space: eye / brow / brow2 / nose / cheek / fore / lip points, u = eye width, down = +1 if y grows downward (sprite px), -1 if it grows upward (world) */
FX.wounds=function(ctx,B,G,opt){if(!FX.on)return;opt=opt||{};const o=B._owner,hp=o&&o.hp?o.hp.head:100,d=clamp(1-hp/100,0,1),light=clamp(d/.5,0,1),s=clamp((50-hp)/50,0,1);
  const swell=clamp(B.swell||0,0,1.5),u=G.u,dn=G.down;if(d<.02&&swell<.05&&!(B.cuts&&B.cuts.length))return;
  ctx.save();
  /* cheek redness */
  {const a=.07*light+.2*s;if(a>.01){const c=G.cheek,gr=ctx.createRadialGradient(c[0],c[1],0,c[0],c[1],u*1.7);gr.addColorStop(0,`rgba(170,55,45,${a})`);gr.addColorStop(1,'rgba(170,55,45,0)');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(c[0],c[1],u*1.7,0,7);ctx.fill()}}
  /* eye bruise: a dark purple ring that gets a yellow-green edge once it is old / heavy */
  {const a=.12*light+.5*s+swell*.18;if(a>.02){const e=G.eye,cx=e[0]-u*.05,cy=e[1]-dn*u*.1;ctx.save();ctx.translate(cx,cy);ctx.scale(1,.78);
    if(s>.25){const g2=ctx.createRadialGradient(0,0,u*.5,0,0,u*1.5);g2.addColorStop(0,`rgba(120,105,40,${.3*s})`);g2.addColorStop(1,'rgba(120,105,40,0)');ctx.fillStyle=g2;ctx.beginPath();ctx.arc(0,0,u*1.5,0,7);ctx.fill()}
    const g=ctx.createRadialGradient(0,0,u*.15,0,0,u*1.05);g.addColorStop(0,`rgba(62,22,58,${Math.min(.85,a)})`);g.addColorStop(.7,`rgba(78,32,70,${Math.min(.6,a*.7)})`);g.addColorStop(1,'rgba(78,32,70,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,u*1.05,0,7);ctx.fill();ctx.restore()}}
  /* scrapes once the head is under 50 % */
  if(s>.25){ctx.strokeStyle=`rgba(150,40,35,${.55*s})`;ctx.lineWidth=u*.05;ctx.lineCap='round';const c=G.cheek,f=G.fore;for(const[p,dx,dy]of[[c,-.5,.1],[c,.1,.35],[f,-.2,0],[f,.3,.2]]){ctx.beginPath();ctx.moveTo(p[0]+u*dx,p[1]+dn*u*dy);ctx.lineTo(p[0]+u*(dx+.45),p[1]+dn*u*(dy-.06));ctx.stroke()}}
  /* the engine's cuts with blood runs */
  if(opt.cuts!==false&&B.cuts)for(const c of B.cuts){const P=G[CUT_AT[c.at]||'brow'];if(!P)continue;const sev=c.sev,len=u*(.7+Math.min(.5,sev*.25));
    ctx.save();ctx.translate(P[0],P[1]);ctx.rotate(-.2*dn);ctx.strokeStyle='#4a0508';ctx.lineWidth=u*(.07+Math.min(.07,sev*.04));ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-len/2,0);ctx.lineTo(len/2,-dn*u*.06);ctx.stroke();ctx.strokeStyle='#b01016';ctx.lineWidth=u*.035;ctx.beginPath();ctx.moveTo(-len*.45,0);ctx.lineTo(len*.45,-dn*u*.06);ctx.stroke();ctx.restore();
    if(sev>.25){const L=u*(.8+Math.min(3,sev*1.5));const g=ctx.createLinearGradient(0,P[1],0,P[1]+dn*L);g.addColorStop(0,'rgba(150,8,12,.85)');g.addColorStop(1,'rgba(150,8,12,0)');ctx.strokeStyle=g;ctx.lineWidth=u*.11;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(P[0]+u*.08,P[1]);ctx.quadraticCurveTo(P[0]+u*.2,P[1]+dn*L*.5,P[0]+u*.1,P[1]+dn*L);ctx.stroke()}}
  ctx.restore()};
/* the eyelid for sprite faces: a skin-coloured lid sliding down over the eye, with a lash line when nearly closed */
FX.lid=function(ctx,G,a,skin){if(a<.03)return;const e=G.eye,u=G.u,w=u*1.25,h=u*.7*a;ctx.save();ctx.fillStyle=skin;ctx.beginPath();const top=e[1]-G.down*u*.42;ctx.ellipse(e[0],top+G.down*(h*.5),w*.5,Math.max(1,h*.55),0,0,7);ctx.fill();
  if(a>.35){ctx.strokeStyle='rgba(30,18,14,.85)';ctx.lineWidth=u*.07;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(e[0]-w*.42,top+G.down*h*.95);ctx.quadraticCurveTo(e[0],top+G.down*(h*1.15),e[0]+w*.42,top+G.down*h*.9);ctx.stroke()}ctx.restore()};
})();
