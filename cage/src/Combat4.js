/* ===== Combat4.js : low kicks, leg damage that matters, guard damage, one-arm strikes, calmer movement =====
   • Low kicks (rlk / llk / calf): +60 % power on top of the earlier buff, a 1.7x wider strike box and a bit more reach.
   • Leg damage is used by the game: legs below 75 % slow the fighter down smoothly, a fighter with hurt legs kicks weaker,
     a hurt leg takes more from every following kick and goes down more easily (see the knock threshold in Match.applyDmg).
   • Guard damage: every blocked hit adds to the guarding arms' damage (slowly healing) — drawn as bruises on the forearms
     and a flash where the block landed.
   • With the no-guard tactic on, only the arm that strikes stays up: the other arm stays down while a punch is thrown. Normal stance keeps both hands up.
   • Walking is calmer: movement speed x0.78. */
(function(){
if(typeof F2==='undefined'||typeof Match==='undefined')return;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
if(typeof MV!=='undefined')for(const k of['rlk','llk','calf']){const c=MV[k];if(c&&c.hit)c.hit.dmg*=1.6}
if(typeof REACH!=='undefined'){REACH.rlk*=1.1;REACH.llk*=1.1;REACH.calf*=1.1}
{const sb=Match.prototype.strikeBox;Match.prototype.strikeBox=function(att,act){const r=sb.call(this,att,act);if(r&&act&&act.c&&act.c.hit&&act.c.hit.zone==='leg'&&act.c.leg)r.r*=1.7;return r}}
{const sp=F2.prototype.spd;F2.prototype.spd=function(){const lg=this.hp?this.hp.legs:100;return sp.call(this)*.78*(lg<75?.6+.4*clamp(lg/75,0,1):1)}}
{const ad=Match.prototype.applyDmg;Match.prototype.applyDmg=function(att,def,o){
  if(o&&att&&def){
    if(att.act&&att.act.c&&att.act.c.leg&&att.hp&&att.hp.legs<60&&!o.blocked)o.dmg*=.6+.4*att.hp.legs/60;/* hurt legs kick weaker */
    if(o.zone==='leg'&&!o.blocked&&def.hp)o.dmg*=1+(100-def.hp.legs)/160;/* a hurt leg takes more */
    if(o.blocked){def._armD=Math.min(60,(def._armD||0)+(o.dmg||1)*3.2+1.2);def._armFlash=.32;def.gst=Math.max(0,(def.gst||0)-(o.dmg||1)*.4)}}
  return ad.call(this,att,def,o)}}
{const up=F2.prototype.update;F2.prototype.update=function(dt,M){const r=up.call(this,dt,M);if(this._armD>0)this._armD=Math.max(0,this._armD-dt*.35);if(this._armFlash>0)this._armFlash-=dt;return r}}
/* only the striking arm stays up when there is no guard */
if(typeof Body!=='undefined'){const sv=Body.prototype.solve;Body.prototype.solve=function(p,x,d){const f=this._owner;
  if(p&&f&&f.body===this&&f.act&&f.act.c&&f.act.c.hand&&f.tactic==='no'&&!f.gpose&&f.state==='stand'&&!this.rag){const a=f.act,o=a.c.hand==='l'?'r':'l',dur=a.c.dur||.4;const w=clamp(a.t/.1,0,1)*clamp((dur-a.t)/.16,0,1);
    const tg=o==='l'?{la_s:.2,la_e:.45}:{ra_s:.16,ra_e:.4};for(const k in tg)p[k]+=(tg[k]-p[k])*w*.92}
  return sv.call(this,p,x,d)}}
})();
