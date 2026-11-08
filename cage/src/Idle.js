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
  const mv=Math.min(1,Math.abs(this.mvIn||0)*1.4),calm=(1-.65*mv)*(this.rock>0?.35:1)*1.85;/* idle amplitude (bigger, livelier) */const t=T()*tp+ph;
  const b1=Math.sin(t*3.6),b2=Math.sin(t*3.6+Math.PI),sw=Math.sin(t*1.25+1.3),br=Math.sin(t*.9),s2=Math.sin(t*2.1+.6);
  /* only: the upper body rocking forward / back, breathing, and the fists circling */
  p.lean+=.028*br*calm+.022*b1*calm;p.chest+=.026*Math.sin(t*.9+.5)*calm+.012*b2*calm;
  p.la_s+=.1*b1*calm+.035*s2*calm;p.la_e+=.16*b2*calm;p.ra_s+=.1*b2*calm+.035*s2*calm;p.ra_e+=.16*b1*calm;
  /* circling the cage (stick up / down): the feet travel sideways in depth, alternately, thighs and shins together */
  if(this.circ&&this._cw>.02){const q=this.cph||0,dir=Math.sign(this.circ),cw=this._cw,mag=Math.abs(this.circ);const A=(.05+.03*mag)*this.body.H*cw,zl={};const wgt={H:.45,K:.75,A:1,He:1,T:1};
    const zL=A*Math.sin(q),zR=-zL;for(const k in wgt){zl['l'+k]=zL*wgt[k]*dir;zl['r'+k]=zR*wgt[k]*dir}
    zl.lS=-zL*.2*dir;zl.lE=-zL*.25*dir;zl.lW=-zL*.3*dir;zl.lG=-zL*.3*dir;zl.rS=zL*.2*dir;zl.rE=zL*.25*dir;zl.rW=zL*.3*dir;zl.rG=zL*.3*dir;
    const upL=Math.max(0,Math.cos(q)),upR=Math.max(0,-Math.cos(q));/* the stepping foot is the one travelling along the direction */
    p.ll_k+=.34*upL*cw;p.rl_k+=.34*upR*cw;p.ll_h+=.14*upL*cw;p.rl_h+=.14*upR*cw;p.ll_a+=.12*upL*cw;p.rl_a+=.12*upR*cw;p.y=(p.y||0)-.01*this.body.H*cw;
    this.body._swing={l:Math.min(1,upL*2.5)*cw,r:Math.min(1,upR*2.5)*cw};this.body._zIdle=zl;return}}}


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
  const rg=rngOf((B.look&&B.look.name)||'x');ctx.save();
  /* soft irregular blotch: a stack of offset ellipses of one colour, so the edge is uneven like a real bruise */
  const blotch=(x,y,rx,ry,rot,col,a,n)=>{ctx.save();ctx.translate(x,y);ctx.rotate(rot);for(let i=0;i<n;i++){const ox=(rg(i*3+1)-.5)*rx*.5,oy=(rg(i*3+2)-.5)*ry*.5,k=.72+rg(i*3+3)*.4;const g=ctx.createRadialGradient(ox,oy,0,ox,oy,Math.max(rx,ry)*k);g.addColorStop(0,`rgba(${col},${a/n*1.7})`);g.addColorStop(.6,`rgba(${col},${a/n})`);g.addColorStop(1,`rgba(${col},0)`);ctx.fillStyle=g;ctx.save();ctx.scale(1,ry/rx);ctx.beginPath();ctx.arc(ox,oy*rx/ry,rx*k,0,7);ctx.fill();ctx.restore()}ctx.restore()};
  let dark=1;try{const sk=rgbOf((B.look&&B.look.skin)||'#c08360');if((sk[0]+sk[1]+sk[2])/3<115)dark=1.45}catch(e){}/* a bruise shows less on dark skin: stronger there */
  const e=G.eye,A=(.1*light+.55*s+swell*.2)*dark;/* strength: faint until 50 %, then fast */
  if(A>.02){
    /* 1 ageing ring: yellow-green outer edge and blue-grey middle appear on a heavy bruise */
    if(s>.2)blotch(e[0]-u*.1,e[1]+dn*u*.12,u*1.55,u*1.15,-.1*dn,'112,112,50',.32*s,3);
    if(s>.1)blotch(e[0]-u*.08,e[1]+dn*u*.1,u*1.25,u*.95,-.1*dn,'70,70,110',.4*Math.min(1,s*1.4),3);
    /* 2 the orbit: dark purple, thickest under the eye and over the brow bone */
    blotch(e[0]-u*.05,e[1]+dn*u*.14,u*1.0,u*.74,-.08*dn,'66,24,62',Math.min(.85,A),4);
    blotch(e[0]-u*.05,e[1]+dn*u*.38,u*.8,u*.32,-.05*dn,'44,14,40',Math.min(.75,A*.9),2);/* under-eye crescent */
    blotch(e[0]+u*.02,e[1]-dn*u*.34,u*.8,u*.26,-.12*dn,'50,18,52',Math.min(.6,A*.7),2);/* the swollen upper lid */
    /* 3 fine detail: broken vessels, a dark core, a swollen sheen */
    if(A>.3){ctx.strokeStyle=`rgba(120,20,40,${Math.min(.5,A*.55)})`;ctx.lineWidth=u*.025;ctx.lineCap='round';for(let i=0;i<7;i++){const a=rg(40+i)*Math.PI*2,r0=u*(.55+rg(60+i)*.35);ctx.beginPath();ctx.moveTo(e[0]+Math.cos(a)*r0,e[1]+dn*Math.sin(a)*r0*.7);ctx.lineTo(e[0]+Math.cos(a)*(r0+u*.16),e[1]+dn*Math.sin(a)*(r0+u*.16)*.7);ctx.stroke()}}
    if(swell>.25||s>.4){ctx.fillStyle=`rgba(255,235,225,${.08+.06*s})`;ctx.beginPath();ctx.ellipse(e[0]-u*.1,e[1]-dn*u*.36,u*.38,u*.1,-.1*dn,0,7);ctx.fill()}}
  /* the other places a punch lands: cheekbone, jaw / mouth corner, brow bone — later and lighter */
  const b2=clamp((d-.25)/.5,0,1)*.45+s*.3;
  if(b2>.04){const c=G.cheek;blotch(c[0],c[1],u*.9,u*.6,.2*dn,'80,40,70',b2,3);const l=G.lip;blotch(l[0]-u*.1,l[1]-dn*u*.15,u*.7,u*.5,0,'76,30,52',b2*.7,2)}
  if(s>.35){const f=G.brow;blotch(f[0]-u*.1,f[1]-dn*u*.15,u*.8,u*.35,-.1*dn,'70,28,64',s*.55,2)}
  /* the engine's cuts with a blood run (the earlier look) — detail added: a wavering run that thickens, a bright wet edge, drops, side runs */
  if(opt.cuts!==false&&B.cuts){for(const c of B.cuts){const P=G[CUT_AT[c.at]||'brow'];if(!P)continue;const sev=c.sev;
      ctx.save();ctx.translate(P[0],P[1]);ctx.rotate(-.25*dn);ctx.fillStyle='#4a0407';ctx.fillRect(-u*.45,-u*.05,u*.9,u*.1);ctx.fillStyle='#8a0a10';ctx.fillRect(-u*.38,-u*.02,u*.76,u*.04);ctx.restore();
      if(sev>.2){const L=u*(1+Math.min(3.6,sev*1.5)),w0=u*(.1+Math.min(.06,sev*.03));
        const run=(x0,L2,w,wob,al)=>{const g=ctx.createLinearGradient(0,P[1],0,P[1]+dn*L2);g.addColorStop(0,`rgba(168,10,16,${al})`);g.addColorStop(.7,`rgba(130,6,12,${al*.9})`);g.addColorStop(1,`rgba(110,5,10,${al*.6})`);ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x0-w,P[1]);ctx.bezierCurveTo(x0-w*.8+wob,P[1]+dn*L2*.35,x0-w*1.2-wob,P[1]+dn*L2*.7,x0-w*.5,P[1]+dn*L2);ctx.lineTo(x0+w*.5,P[1]+dn*L2*.98);ctx.bezierCurveTo(x0+w*1.2-wob,P[1]+dn*L2*.7,x0+w*.8+wob,P[1]+dn*L2*.35,x0+w,P[1]);ctx.closePath();ctx.fill();
          ctx.fillStyle=`rgba(255,120,110,${al*.18})`;ctx.fillRect(x0-w*.25,P[1],w*.3,dn*L2*.8);/* wet highlight */
          ctx.fillStyle=`rgba(120,6,12,${al})`;ctx.beginPath();ctx.ellipse(x0-w*.5,P[1]+dn*L2,w*.65,w*.9,0,0,7);ctx.fill()};/* the drop at the end */
        run(P[0],L,w0,u*.06*Math.sin(P[0]),.9);if(sev>.8)run(P[0]+u*.34,L*.62,w0*.6,-u*.05,.8);if(sev>1.4)run(P[0]-u*.3,L*.45,w0*.5,u*.04,.75)}}
    if(B.cuts.some(c=>c.at==='nose')||(B.redness||0)>.72){const n=G.nose;ctx.globalAlpha=.85;ctx.fillStyle='#8c0608';ctx.beginPath();ctx.moveTo(n[0]-u*.1,n[1]);ctx.lineTo(n[0]+u*.2,n[1]);ctx.lineTo(n[0]+u*.1,n[1]+dn*u*2.6);ctx.lineTo(n[0]-u*.2,n[1]+dn*u*2.6);ctx.closePath();ctx.fill();ctx.globalAlpha=1}}
  ctx.restore()};
/* skin-only mask of a sprite (white where it is skin): wounds are clipped to it, so blood and bruises stay on the face layer and turn with the head */
FX.skinMask=function(img){const C=FX._sm||(FX._sm={});if(C[img.src])return C[img.src];const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const g=c.getContext('2d');g.drawImage(img,0,0);let id;try{id=g.getImageData(0,0,c.width,c.height)}catch(e){return null}const D=id.data;
  for(let i=0;i<D.length;i+=4){const r=D[i],gg=D[i+1],b=D[i+2];const skin=D[i+3]>120&&r>gg&&gg>=b&&r-b>18&&(r+gg+b)/3>55;D[i]=D[i+1]=D[i+2]=255;D[i+3]=skin?255:0}g.putImageData(id,0,0);return C[img.src]=c};
FX.layer=function(w,h){let c=FX._ly;if(!c||c.width!==w||c.height!==h){c=FX._ly=document.createElement('canvas');c.width=w;c.height=h}return c};
FX.hasWounds=function(B){const o=B._owner,hp=o&&o.hp?o.hp.head:100;return hp<98||(B.swell||0)>.05||!!(B.cuts&&B.cuts.length)};
function rngOf(name){let h=2166136261;for(let i=0;i<name.length;i++){h^=name.charCodeAt(i);h=Math.imul(h,16777619)}return k=>{let a=(h^Math.imul(k+1,0x9E3779B1))>>>0;a=Math.imul(a^a>>>15,0x85ebca6b);a=Math.imul(a^a>>>13,0xc2b2ae35);return((a^a>>>16)>>>0)/4294967296}}
/* the eyelid for sprite faces: a skin-coloured lid sliding down over the eye, with a lash line when nearly closed */
FX.lid=function(ctx,G,a,skin){if(a<.03)return;const e=G.eye,u=G.u,w=u*1.25,h=u*.7*a;ctx.save();ctx.fillStyle=skin;ctx.beginPath();const top=e[1]-G.down*u*.42;ctx.ellipse(e[0],top+G.down*(h*.5),w*.5,Math.max(1,h*.55),0,0,7);ctx.fill();
  if(a>.35){ctx.strokeStyle='rgba(30,18,14,.85)';ctx.lineWidth=u*.07;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(e[0]-w*.42,top+G.down*h*.95);ctx.quadraticCurveTo(e[0],top+G.down*(h*1.15),e[0]+w*.42,top+G.down*h*.9);ctx.stroke()}ctx.restore()};
})();
