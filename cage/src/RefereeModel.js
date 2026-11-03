/* ===== RefereeModel.js : new referee figure (front view) =====
   Generic official — black short-sleeve polo (collar, button placket, sleeve hems, chest patch),
   black slacks with belt and crease, polished shoes, blue exam gloves. Look (skin tone / hair) is
   picked per fight from generic presets. Poses blend smoothly between states set by RefereeAI:
     watch  — athletic ready stance, hands in front at the belt
     ground — crouched in close, hands on the knees
     break  — arms out, separating the fighters (between rounds)
     wave   — waving it off (stoppage)
     raise  — winner's arm up
   Shaded with gradients (overhead light), drawn in world units like the fighters. */
const REF_LOOKS=[{skin:'#7a4b33',hair:'bald'},{skin:'#e1b592',hair:'short',hc:'#3b2a1d'},{skin:'#c08a60',hair:'buzz',hc:'#1d1712'},{skin:'#efc9a6',hair:'side',hc:'#8e8e8e'},{skin:'#9a6847',hair:'short',hc:'#120e0b'},{skin:'#d8a77f',hair:'buzz',hc:'#5a4030'}];
function drawRefFront2(ctx0,r,t){
  /* GPU path: the referee lives on the near layer (with the cage), under the fighters */
  let ctx=ctx0;if(window.__gpuFig&&ctx0.canvas===window.__gpuFig&&window.__gpuNearX){ctx=window.__gpuNearX;ctx.setTransform(ctx0.getTransform())}
  ctx.save();ctx.filter='none';
  const lk=r._lk||(r._lk=REF_LOOKS[Math.floor(Math.random()*REF_LOOKS.length)]);const H=1.84,x=r.x;const mv=Math.min(1,Math.abs(r.vx||0)*2),ph=r.stepPh||0;
  const mode=r.raise===1||r.raise===-1?'raise':r.mode||'watch';const crouch=mode==='ground'?.15:mode==='watch'?.045:mode==='wave'?.03:0;
  const skin=lk.skin,skD=shade(skin,-.22),skL=shade(skin,.12),shirt='#17181d',shirtD='#0c0d10',shirtL='#2b2d34',pants='#141519',pantsL='#24262c',glove='#3d7be6',gloveL='#7fb0ff';
  const hip=(.5-crouch)*H+Math.abs(Math.sin(ph))*.01*mv,sh=(.815-crouch)*H,head=sh+.17;const sw=Math.sin(ph)*.06*mv;const kneeOut=mode==='ground'?.07:.02;
  /* shadow */
  ctx.fillStyle='rgba(0,0,0,.32)';ctx.beginPath();ctx.ellipse(x,0,.36,.045,0,0,7);ctx.fill();
  /* legs */
  const leg=(sx,off)=>{const k={x:x+sx*(.11+kneeOut)+off*.5,y:hip*.5},f={x:x+sx*.12+off,y:.07};const g=ctx.createLinearGradient(x+sx*.02,0,x+sx*.2,0);g.addColorStop(0,sx<0?pantsL:pants);g.addColorStop(1,sx<0?pants:shirtD);ctx.fillStyle=g;
    ctx.beginPath();ctx.moveTo(x+sx*.005,hip+.02);ctx.lineTo(x+sx*.165,hip+.02);ctx.quadraticCurveTo(k.x+sx*.075,k.y+.05,f.x+sx*.065,f.y);ctx.lineTo(f.x-sx*.06,f.y);ctx.quadraticCurveTo(k.x-sx*.06,k.y,x+sx*.005,hip-.08);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.07)';ctx.lineWidth=.008;ctx.beginPath();ctx.moveTo(x+sx*.085,hip-.04);ctx.quadraticCurveTo(k.x,k.y,f.x,f.y+.02);ctx.stroke();
    const sg=ctx.createLinearGradient(0,.0,0,.08);sg.addColorStop(0,'#2a2b30');sg.addColorStop(1,'#050506');ctx.fillStyle=sg;ctx.beginPath();ctx.ellipse(f.x+sx*.012,.038,.085,.04,0,0,7);ctx.fill();ctx.fillStyle='rgba(255,255,255,.22)';ctx.beginPath();ctx.ellipse(f.x-sx*.01,.058,.04,.008,0,0,7);ctx.fill()};
  leg(-1,sw);leg(1,-sw);
  /* torso (polo, tucked) */
  let g=ctx.createLinearGradient(x-.24,0,x+.24,0);g.addColorStop(0,shirtD);g.addColorStop(.3,shirtL);g.addColorStop(.55,shirt);g.addColorStop(1,shirtD);ctx.fillStyle=g;
  ctx.beginPath();ctx.moveTo(x-.235,sh);ctx.quadraticCurveTo(x,sh+.06,x+.235,sh);ctx.lineTo(x+.215,sh-.2);ctx.quadraticCurveTo(x+.17,hip+.1,x+.168,hip+.03);ctx.lineTo(x-.168,hip+.03);ctx.quadraticCurveTo(x-.17,hip+.1,x-.215,sh-.2);ctx.closePath();ctx.fill();
  const tg=ctx.createLinearGradient(0,sh+.04,0,sh-.18);tg.addColorStop(0,'rgba(255,255,255,.1)');tg.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=tg;ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.45)';ctx.lineWidth=.007;for(const k of[-1,1]){ctx.beginPath();ctx.moveTo(x+k*.12,hip+.05);ctx.quadraticCurveTo(x+k*.15,sh-.25,x+k*.19,sh-.12);ctx.stroke()}
  /* belt */
  ctx.fillStyle='#08080a';ctx.fillRect(x-.17,hip-.005,.34,.045);ctx.fillStyle='#b8bcc4';ctx.fillRect(x-.022,hip+.002,.044,.03);ctx.fillStyle='#6d7078';ctx.fillRect(x-.012,hip+.008,.024,.018);
  /* placket, buttons, collar, chest patch */
  ctx.fillStyle=shirtD;ctx.fillRect(x-.018,sh-.17,.036,.16);ctx.fillStyle='#3a3c44';for(const y of[sh-.05,sh-.1,sh-.15]){ctx.beginPath();ctx.arc(x,y,.007,0,7);ctx.fill()}
  ctx.fillStyle=shirtL;ctx.beginPath();ctx.moveTo(x-.085,sh+.035);ctx.lineTo(x-.012,sh-.035);ctx.lineTo(x-.03,sh-.07);ctx.lineTo(x-.105,sh+.005);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(x+.085,sh+.035);ctx.lineTo(x+.012,sh-.035);ctx.lineTo(x+.03,sh-.07);ctx.lineTo(x+.105,sh+.005);ctx.closePath();ctx.fill();
  ctx.fillStyle='#d9dbe0';ctx.fillRect(x-.17,sh-.13,.075,.03);ctx.fillStyle='#1a1b20';ctx.save();ctx.translate(x-.165,sh-.122);ctx.scale(1,-1);ctx.font='bold .02px sans-serif';ctx.fillText('REFEREE',0,0);ctx.restore();
  /* arms: target pose per state, blended */
  const T={watch:[[.1,-.2],[.05,-.35]],ground:[[.13,-.2],[.12,-.4]],break:[[.25,-.05],[.5,-.02]],wave:null,raise:null,idle:[[.04,-.26],[.05,-.52]]};
  r._arm=r._arm||{l:[[.04,-.26],[.05,-.52]],r:[[.04,-.26],[.05,-.52]]};
  for(const[side,sx]of[['l',-1],['r',1]]){let tgt;if(mode==='wave'){const w=Math.sin(t*14+(sx>0?0:Math.PI));tgt=[[.17,-.06],[.18+.22*w,.02]]}else if(mode==='raise'){tgt=r.raise===sx?[[.08,.25],[.1,.52]]:T.idle}else tgt=T[mode]||T.watch;
    const A=r._arm[side];for(let i=0;i<2;i++)for(let j=0;j<2;j++)A[i][j]+=(tgt[i][j]-A[i][j])*.22;
    const S={x:x+sx*.205,y:sh-.035},E={x:S.x+sx*A[0][0],y:S.y+A[0][1]},Wr={x:S.x+sx*A[1][0],y:S.y+A[1][1]};
    ctx.lineCap='round';ctx.strokeStyle=shirt;ctx.lineWidth=.135;ctx.beginPath();ctx.moveTo(S.x,S.y);ctx.lineTo(S.x+(E.x-S.x)*.6,S.y+(E.y-S.y)*.6);ctx.stroke();
    ctx.strokeStyle=shirtD;ctx.lineWidth=.137;ctx.beginPath();ctx.moveTo(S.x+(E.x-S.x)*.56,S.y+(E.y-S.y)*.56);ctx.lineTo(S.x+(E.x-S.x)*.6,S.y+(E.y-S.y)*.6);ctx.stroke();
    ctx.strokeStyle=skin;ctx.lineWidth=.088;ctx.beginPath();ctx.moveTo(S.x+(E.x-S.x)*.6,S.y+(E.y-S.y)*.6);ctx.lineTo(E.x,E.y);ctx.stroke();ctx.lineWidth=.076;ctx.beginPath();ctx.moveTo(E.x,E.y);ctx.lineTo(Wr.x,Wr.y);ctx.stroke();
    ctx.strokeStyle='rgba(0,0,0,.18)';ctx.lineWidth=.02;ctx.beginPath();ctx.moveTo(E.x+sx*.02,E.y);ctx.lineTo(Wr.x+sx*.02,Wr.y);ctx.stroke();
    const hx=Wr.x+(Wr.x-E.x)*.25,hy=Wr.y+(Wr.y-E.y)*.25;const gg=ctx.createRadialGradient(hx-.012,hy+.012,.005,hx,hy,.055);gg.addColorStop(0,gloveL);gg.addColorStop(1,glove);ctx.fillStyle=gg;ctx.beginPath();ctx.ellipse(hx,hy,.05,.06,Math.atan2(Wr.x-E.x,Wr.y-E.y)*-1,0,7);ctx.fill()}
  /* shoulders */
  ctx.fillStyle=shirt;ctx.beginPath();ctx.ellipse(x-.2,sh-.035,.062,.045,0,0,7);ctx.ellipse(x+.2,sh-.035,.062,.045,0,0,7);ctx.fill();
  /* neck + head */
  ctx.fillStyle=skD;ctx.beginPath();ctx.moveTo(x-.055,sh-.01);ctx.lineTo(x+.055,sh-.01);ctx.lineTo(x+.05,sh+.085);ctx.lineTo(x-.05,sh+.085);ctx.closePath();ctx.fill();
  const hy=head;ctx.save();ctx.translate(x,hy-.05);ctx.scale(1.14,1.14);ctx.translate(-x,-(hy-.05));const hg=ctx.createLinearGradient(x-.09,0,x+.09,0);hg.addColorStop(0,skD);hg.addColorStop(.35,skL);hg.addColorStop(.7,skin);hg.addColorStop(1,skD);ctx.fillStyle=hg;
  ctx.beginPath();ctx.moveTo(x,hy+.115);ctx.bezierCurveTo(x+.085,hy+.115,x+.09,hy+.03,x+.084,hy-.025);ctx.bezierCurveTo(x+.078,hy-.085,x+.04,hy-.118,x,hy-.122);ctx.bezierCurveTo(x-.04,hy-.118,x-.078,hy-.085,x-.084,hy-.025);ctx.bezierCurveTo(x-.09,hy+.03,x-.085,hy+.115,x,hy+.115);ctx.fill();
  ctx.fillStyle=skD;ctx.beginPath();ctx.ellipse(x-.088,hy,.015,.03,0,0,7);ctx.ellipse(x+.088,hy,.015,.03,0,0,7);ctx.fill();
  /* hair */
  const hc=lk.hc||skD;if(lk.hair==='bald'){ctx.fillStyle='rgba(255,255,255,.16)';ctx.beginPath();ctx.ellipse(x-.02,hy+.088,.042,.018,-.2,0,7);ctx.fill()}
  else{ctx.fillStyle=hc;ctx.beginPath();ctx.moveTo(x-.086,hy+.02);ctx.bezierCurveTo(x-.09,hy+.1,x-.05,hy+.125,x,hy+.127);ctx.bezierCurveTo(x+.05,hy+.125,x+.09,hy+.1,x+.086,hy+.02);
    if(lk.hair==='buzz'){ctx.lineTo(x+.08,hy+.05);ctx.bezierCurveTo(x+.06,hy+.09,x-.06,hy+.09,x-.08,hy+.05)}else if(lk.hair==='side'){ctx.lineTo(x+.082,hy+.06);ctx.bezierCurveTo(x+.04,hy+.075,x-.01,hy+.1,x-.07,hy+.06)}else{ctx.lineTo(x+.08,hy+.065);ctx.bezierCurveTo(x+.05,hy+.08,x-.05,hy+.08,x-.08,hy+.065)}
    ctx.closePath();ctx.fill();if(lk.hair==='buzz'){ctx.globalAlpha=.55}ctx.globalAlpha=1}
  /* face */
  const look=(r.d||1)*.006;ctx.fillStyle='#f4efe8';ctx.beginPath();ctx.ellipse(x-.032,hy+.012,.014,.008,0,0,7);ctx.ellipse(x+.032,hy+.012,.014,.008,0,0,7);ctx.fill();
  ctx.fillStyle='#1a120d';ctx.beginPath();ctx.arc(x-.032+look,hy+.012,.0065,0,7);ctx.arc(x+.032+look,hy+.012,.0065,0,7);ctx.fill();
  ctx.fillStyle=lk.hair==='bald'?skD:shade(hc,-.1);ctx.fillRect(x-.05,hy+.03,.034,.008);ctx.fillRect(x+.016,hy+.03,.034,.008);
  ctx.fillStyle=skD;ctx.beginPath();ctx.moveTo(x,hy+.008);ctx.lineTo(x+.017,hy-.035);ctx.lineTo(x-.012,hy-.038);ctx.closePath();ctx.fill();
  ctx.strokeStyle=shade(skin,-.4);ctx.lineWidth=.007;ctx.beginPath();ctx.moveTo(x-.025,hy-.062);ctx.quadraticCurveTo(x,hy-.068,x+.025,hy-.062);ctx.stroke();
  ctx.fillStyle='rgba(0,0,0,.12)';ctx.beginPath();ctx.ellipse(x,hy-.1,.05,.016,0,0,7);ctx.fill();
  ctx.restore();ctx.restore()}
