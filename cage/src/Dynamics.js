/* ===== Dynamics.js : weight and inertia on the pose pipeline (physics realism) =====
   • Inertia: outside attacks and ground actions, the pose channels follow the animation through a critically damped spring
     (heavier fighters respond a little slower; the arms and head are quicker than the legs), so guard changes, steps, hit
     reactions and the return from a move carry weight instead of being linear blends.
     During an attack / ground action the filter is bypassed and re-seeded each frame, so hit timing, reach and every authored
     pose are exactly what they were; the return from a move is then a smooth follow-through from the last attack pose.
   • Mass: knock-back, head snap and stagger from a blow scale with sqrt(attacker mass / defender mass).
   Toggle: DYNAMICS.on */
(function(){
if(typeof F2==='undefined'||typeof Body==='undefined'||typeof Match==='undefined')return;
const DY=window.DYNAMICS={on:true};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const CH={lean:30,chest:34,head:40,tw:32,la_s:44,la_e:44,ra_s:44,ra_e:44,ll_h:28,ll_k:28,ll_a:30,rl_h:28,rl_k:28,rl_a:30};
const KEYS=Object.keys(CH);
const mass=f=>{const b=f.body,W=b.W||1;return b.H*b.H*W*W*20};
/* the filter runs only for the pose that F2.pose passes to Body.solve */
{const po=F2.prototype.pose;F2.prototype.pose=function(dt,M){this.body._dyn=!DY.on?0:(!this.act&&!this.gpose&&this.state==='stand'&&!this.body.rag)?Math.min(dt,1/30):-1;return po.call(this,dt,M)}}
{const solve=Body.prototype.solve;Body.prototype.solve=function(p,X,d){const dt=this._dyn;this._dyn=0;if(!dt||this.rag||!p||p.free){if(dt&&p)this._pf=null;return solve.call(this,p,X,d)}
  const S=this._pf||(this._pf={x:{},v:{}});const m=clamp(1.1-(this.W||1)*.12,.82,1.05);let q=p;
  for(let i=0;i<KEYS.length;i++){const k=KEYS[i],t=p[k];if(t==null)continue;
    if(dt<0||S.x[k]==null){S.x[k]=t;S.v[k]=0;continue}/* attack / ground: pass through, keep the state in step */
    if(q===p)q=Object.assign({},p);const w=CH[k]*m,x=S.x[k],v=S.v[k];const a=-w*w*(x-t)-2*w*v;S.v[k]=v+a*dt;S.x[k]=x+S.v[k]*dt;q[k]=S.x[k]}
  return solve.call(this,q,X,d)}}
/* heavier attackers move the defender more, heavier defenders move less */
{const oh=Match.prototype.onHit;Match.prototype.onHit=function(att,def,act,zone,p){const R=def.react,keys=['x','hv','lv','kv','tw','arm'];const b={};for(const k of keys)b[k]=R[k]||0;
  const r=oh.call(this,att,def,act,zone,p);const k=clamp(Math.sqrt(mass(att)/mass(def)),.72,1.35);for(const key of keys){const d=(R[key]||0)-b[key];if(d)R[key]=b[key]+d*k}return r}}
})();
