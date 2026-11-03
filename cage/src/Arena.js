/* ===== Arena.js : real-world arena scale + responsive camera =====
   World units: fighters are drawn at 0.9 × their real height (look.h × .9 in F2), so one
   world unit = 1/0.9 m. Arena widths are converted with the same factor, which puts the
   fighter-to-cage ratio at real-world proportions:
     UFC Octagon (30 ft / 9.14 m across)  → R = 4.11
     Apex / regional cage (25 ft / 7.62 m) → R = 3.43
     Ring (20 ft / 6.10 m inside ropes)    → R = 2.74
   (The old fixed R = 3.15 made a 1.8 m fighter about a quarter of the cage width instead of a fifth.)
   Camera: framing widened so fighters take up less of the screen, plus an aspect-ratio rule
   so tall/narrow viewports still show enough height and wide ones don't crop the fighters. */
const ARENA=tuneSection('arena',{
  unit:.9,                 // world units per metre (matches the F2 height scale)
  octagonFt:30, apexFt:25, ringFt:20,
  apexBelowLevel:1,        // promotions with production level below this fight in the 25 ft cage
  cam:{stand:{pad:3.5,min:5.0,max:7.6},ground:{pad:3.4,min:4.9,max:6.8},minVisH:2.6,maxVisH:3.1,floorY:{stand:.88,ground:.84}}   /* broadcast framing: fighter ≈ half the screen height */
});
const ftToR=ft=>ft*.3048*ARENA.unit/2;
function arenaFor(venue,level){if(String(venue||'').startsWith('ring'))return{kind:'ring',ft:ARENA.ringFt};const big=(level==null?1:level)>=ARENA.apexBelowLevel;return big?{kind:'octagon',ft:ARENA.octagonFt}:{kind:'apex',ft:ARENA.apexFt}}
{const _Stage=Stage;Stage=class extends _Stage{constructor(root,o){super(root,o);const a=arenaFor(this.venue,o&&o.level);this.arena=a;this.R=+ftToR(a.ft).toFixed(2)}}}
Stage.prototype.follow=function(dt,cx,span,ground){const C=this.cam,K=ARENA.cam,g=ground?K.ground:K.stand;
  let want=clamp(span+g.pad,g.min,g.max);const asp=(this.W||16)/(this.Hh||9);want=Math.max(want,K.minVisH*asp*(ground?.85:1));want=Math.max(Math.min(want,K.maxVisH*asp),span+1.6);/* narrow screens: frame by height */want/=(1+C.zoom);
  C.w+=(want-C.w)*Math.min(1,dt*3);C.x+=(clamp(cx,Math.min(0,-this.R+C.w*.3),Math.max(0,this.R-C.w*.3))-C.x)*Math.min(1,dt*4);
  C.gy+=((ground?K.floorY.ground:K.floorY.stand)-C.gy)*Math.min(1,dt*3);C.zoom*=Math.exp(-dt*2.5);this.shake*=Math.exp(-dt*9);
  C.kvx=(C.kvx||0)+(-(C.kx||0)*160-(C.kvx||0)*16)*dt;C.kx=(C.kx||0)+C.kvx*dt;C.kvy=(C.kvy||0)+(-(C.ky||0)*160-(C.kvy||0)*16)*dt;C.ky=(C.ky||0)+C.kvy*dt;
  C.shx=(Math.random()-.5)*this.shake+C.kx;C.shy=(Math.random()-.5)*this.shake+C.ky};
