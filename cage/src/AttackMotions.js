/* ===== AttackMotions.js : rebuilt strike animation set =====
   Every strike is authored with the same five-beat structure, generated from its hit timing so gameplay
   (active frames t0..t1, duration, damage, reach) is unchanged:
     guard → LOAD (counter-twist, weight shift, small dip) → [CHAMBER for kicks / knees] → DRIVE (hips and
     shoulders turn, rear heel pivots on rear-hand shots, chin tucks behind the shoulder) → IMPACT (full
     extension, slight overshoot) → HOLD → RETRACT (back along the same line, hands back to the face) → guard.
   Arm angles are relative to the torso, so shots thrown with a forward lean (body shots, long cross) use a
   smaller shoulder angle to keep the fist at the target's height.
   The non-striking hand always guards the face; kicks counter-balance by leaning away and swinging the
   kicking-side arm down; body shots change level with the legs, not by folding at the waist alone.
   Each strike has 2–3 variants (e.g. jab: standard / step-in / flick; cross: rotational / long / short with
   the head off the line; hooks tight / wide; kicks standard / chopping / snap). A variant is picked per throw,
   never the same one twice in a row for the same fighter. Field reference (see m_moves): la/ra = lead / rear
   arm (s shoulder, e elbow), ll/rl = lead / rear leg (h hip, k knee, a ankle), tw twist, x hip shift. */
{/* block scope: keep helpers out of the global namespace */
const GL={la_s:.72,la_e:2.42},GR2={ra_s:.6,ra_e:2.48};
const mix=(...o)=>Object.assign({},...o);
/* build keys from beats; times derived from the clip's own hit window */
function buildKeys(c,P){const D=c.dur,h=c.hit,t0=h.t0,t1=h.t1;const K=[[0,{}]];
  if(P.load)K.push([+(t0*(P.chamber?.3:.42)).toFixed(3),P.load]);
  if(P.chamber)K.push([+(t0*.72).toFixed(3),P.chamber]);
  K.push([t0,P.drive]);K.push([+(t0+(t1-t0)*.42).toFixed(3),P.ext,'o']);K.push([t1,P.hold||P.ext]);
  if(P.retract)K.push([+(t1+(D-t1)*.45).toFixed(3),P.retract]);K.push([D,{}]);return K}
const ATK={
 jab:[
  {load:{la_s:1.05,la_e:1.5,tw:.06,lean:.12,ll_k:.38},drive:mix(GR2,{la_s:1.47,la_e:.4,tw:-.22,lean:.18,head:.12,x:.04,ll_h:.4}),ext:mix(GR2,{la_s:1.57,la_e:.03,tw:-.35,lean:.21,head:.16,chest:.04,x:.07,ll_h:.46,ll_k:.28,rl_k:.42}),hold:mix(GR2,{la_s:1.55,la_e:.1,tw:-.31,lean:.2,head:.15,x:.06,ll_h:.45,ll_k:.28,rl_k:.42}),retract:mix(GR2,{la_s:1.18,la_e:1.3,tw:-.1,lean:.15,x:.03})},
  {load:{la_s:1.0,la_e:1.6,lean:.16,ll_k:.5,rl_k:.5,x:.02},drive:mix(GR2,{la_s:1.45,la_e:.45,tw:-.25,lean:.24,head:.16,x:.1,ll_h:.55,ll_k:.42,rl_k:.5}),ext:mix(GR2,{la_s:1.56,la_e:.03,tw:-.36,lean:.27,head:.2,chest:.05,x:.15,ll_h:.6,ll_k:.42,rl_k:.55,rl_a:.6}),retract:mix(GR2,{la_s:1.15,la_e:1.35,tw:-.12,lean:.18,x:.06,ll_h:.42})},
  {load:{la_s:.9,la_e:1.4,lean:.08,tw:.04},drive:mix(GR2,{la_s:1.38,la_e:.35,tw:-.16,lean:.12,head:.05,x:.03,ra_s:.72,ra_e:2.3}),ext:mix(GR2,{la_s:1.47,la_e:.06,tw:-.24,lean:.13,head:.07,x:.05,ll_h:.4,ra_s:.72,ra_e:2.3}),retract:{la_s:1.0,la_e:1.2,tw:-.06,lean:.1,x:.02,ra_s:.65,ra_e:2.38}}],
 cross:[
  {load:{tw:-.2,ra_s:.6,ra_e:2.2,lean:.06,rl_k:.48,ll_k:.4,x:-.01},drive:mix(GL,{ra_s:1.2,ra_e:.7,tw:.48,lean:.2,rl_a:.8,rl_h:-.32,x:.05,head:.12}),ext:mix(GL,{ra_s:1.4,ra_e:.04,tw:.9,lean:.32,head:.2,chest:.1,rl_a:1.25,rl_h:-.44,rl_k:.22,ll_k:.46,x:.11}),hold:mix(GL,{ra_s:1.38,ra_e:.1,tw:.84,lean:.31,head:.19,chest:.09,rl_a:1.2,rl_h:-.42,rl_k:.24,ll_k:.46,x:.1}),retract:{ra_s:.9,ra_e:1.7,tw:.25,lean:.17,x:.04,la_s:.8,la_e:2.1,rl_a:.6}},
  {load:{tw:-.24,ra_s:.58,ra_e:2.25,lean:.08,rl_k:.5,ll_k:.45},drive:mix(GL,{ra_s:1.22,ra_e:.6,tw:.55,lean:.28,rl_a:.9,rl_h:-.4,x:.08,head:.16,ll_k:.5}),ext:mix(GL,{ra_s:1.3,ra_e:.03,tw:.95,lean:.42,head:.26,chest:.12,rl_a:1.35,rl_h:-.56,rl_k:.18,ll_k:.56,ll_h:.4,x:.17}),retract:{ra_s:.9,ra_e:1.7,tw:.3,lean:.22,x:.07,la_s:.78,la_e:2.15,rl_a:.7,rl_h:-.35}},
  {load:{tw:-.16,ra_s:.62,ra_e:2.15,lean:.12,ll_k:.5,rl_k:.45},drive:mix(GL,{ra_s:1.25,ra_e:.65,tw:.42,lean:.18,rl_a:.75,x:.03,head:.02,ll_k:.52}),ext:mix(GL,{ra_s:1.46,ra_e:.06,tw:.74,lean:.2,chest:.02,head:-.02,rl_a:1.1,rl_h:-.34,rl_k:.38,ll_k:.55,x:.05}),retract:{ra_s:.85,ra_e:1.8,tw:.2,lean:.14,la_s:.8,la_e:2.2,ll_k:.45}}],
 lhook:[
  {load:{tw:.32,la_s:1.0,la_e:1.65,lean:.12,ll_k:.52,ll_a:.3},drive:mix(GR2,{la_s:1.33,la_e:1.0,tw:-.2,lean:.2,head:.1,ll_a:.55,ll_k:.45}),ext:mix(GR2,{la_s:1.38,la_e:.55,tw:-.74,lean:.24,head:.14,chest:-.04,ll_a:.72,ll_h:.28,ll_k:.42,rl_k:.48,x:.03}),hold:mix(GR2,{la_s:1.36,la_e:.6,tw:-.7,lean:.23,head:.13,ll_a:.7,ll_h:.28,ll_k:.42,rl_k:.48,x:.03}),retract:mix(GR2,{la_s:1.1,la_e:1.55,tw:-.25,lean:.15,ll_a:.3})},
  {load:{tw:.4,la_s:.95,la_e:1.6,lean:.14,ll_k:.6,rl_k:.55,ll_a:.35},drive:mix(GR2,{la_s:1.3,la_e:1.15,tw:-.15,lean:.22,head:.12,ll_a:.6,ll_k:.55}),ext:mix(GR2,{la_s:1.34,la_e:.78,tw:-.95,lean:.2,head:.16,chest:-.06,ll_a:.8,ll_h:.25,ll_k:.55,rl_k:.55,x:.02}),retract:mix(GR2,{la_s:1.05,la_e:1.6,tw:-.3,lean:.16,ll_k:.48})}],
 rhook:[
  {load:{tw:-.3,ra_s:.75,ra_e:2.0,lean:.1,rl_k:.55},drive:mix(GL,{ra_s:1.27,ra_e:1.05,tw:.42,lean:.2,rl_a:.9,rl_h:-.3,head:.08}),ext:mix(GL,{ra_s:1.36,ra_e:.5,tw:1.06,lean:.27,head:.14,chest:.06,rl_a:1.25,rl_h:-.42,x:.08}),hold:mix(GL,{ra_s:1.34,ra_e:.54,tw:1.02,lean:.26,head:.13,rl_a:1.22,rl_h:-.4,x:.08}),retract:{ra_s:.95,ra_e:1.7,tw:.32,lean:.16,x:.03,la_s:.78,la_e:2.2,rl_a:.6}},
  {load:{tw:-.38,ra_s:.7,ra_e:2.05,lean:.12,rl_k:.6,ll_k:.5},drive:mix(GL,{ra_s:1.25,ra_e:1.2,tw:.45,lean:.18,rl_a:.95,rl_h:-.32,ll_k:.52}),ext:mix(GL,{ra_s:1.32,ra_e:.72,tw:1.22,lean:.22,head:.16,chest:.04,rl_a:1.3,rl_h:-.45,ll_k:.52,x:.06}),retract:{ra_s:.95,ra_e:1.7,tw:.35,lean:.15,la_s:.78,la_e:2.2,rl_a:.65}}],
 lupp:[
  {load:{lean:.36,ll_k:.75,rl_k:.65,la_s:.35,la_e:1.8,head:.2,tw:.25,chest:.08},drive:mix(GR2,{lean:.18,la_s:.78,la_e:1.9,tw:-.1,ll_k:.45,head:.06}),ext:mix(GR2,{lean:.02,la_s:1.06,la_e:1.7,tw:-.42,head:-.04,ll_k:.22,rl_k:.32,chest:-.08}),hold:mix(GR2,{lean:.03,la_s:1.04,la_e:1.7,tw:-.38,ll_k:.24,rl_k:.33}),retract:mix(GR2,{lean:.12,la_s:.9,la_e:1.8,ll_k:.38})},
  {load:{lean:.3,ll_k:.65,rl_k:.6,la_s:.45,la_e:1.7,head:.18,tw:.2},drive:mix(GR2,{lean:.2,la_s:.9,la_e:1.6,tw:-.12,ll_k:.48,x:.04}),ext:mix(GR2,{lean:.12,la_s:1.2,la_e:1.3,tw:-.45,head:.04,ll_k:.32,rl_k:.38,x:.06}),retract:mix(GR2,{lean:.14,la_s:.95,la_e:1.75,ll_k:.4})}],
 rupp:[
  {load:{lean:.4,ll_k:.75,rl_k:.75,ra_s:.25,ra_e:1.7,head:.2,tw:-.2,chest:.08},drive:mix(GL,{lean:.2,ra_s:.72,ra_e:1.9,tw:.3,rl_a:.85,rl_k:.5}),ext:mix(GL,{lean:.05,ra_s:1.02,ra_e:1.74,tw:.7,rl_a:1.18,x:.07,chest:-.06,ll_k:.35,rl_k:.3}),hold:mix(GL,{lean:.06,ra_s:1.0,ra_e:1.72,tw:.66,rl_a:1.15,x:.07,ll_k:.35,rl_k:.3}),retract:mix(GL,{lean:.14,ra_s:.75,ra_e:2.1,tw:.2,rl_a:.5})},
  {load:{lean:.34,ll_k:.65,rl_k:.7,ra_s:.35,ra_e:1.65,head:.18,tw:-.15},drive:mix(GL,{lean:.22,ra_s:.85,ra_e:1.65,tw:.35,rl_a:.9,x:.04}),ext:mix(GL,{lean:.14,ra_s:1.18,ra_e:1.32,tw:.75,rl_a:1.2,x:.09,ll_k:.4,rl_k:.35}),retract:mix(GL,{lean:.15,ra_s:.8,ra_e:2.0,tw:.22,rl_a:.5})}],
 ovh:[
  {load:{tw:-.3,ra_s:.25,ra_e:1.9,lean:.06,rl_k:.48,ll_k:.42,head:.05},chamber:mix(GL,{ra_s:2.25,ra_e:1.45,tw:.5,lean:.38,head:.12,rl_a:1.0,x:.06,ll_k:.5}),drive:mix(GL,{ra_s:1.7,ra_e:.6,tw:.85,lean:.5,head:.16,rl_a:1.15,rl_h:-.38,x:.1,ll_k:.55}),ext:mix(GL,{ra_s:1.24,ra_e:.12,tw:.98,lean:.56,head:.16,rl_a:1.2,rl_h:-.42,x:.13,ll_k:.58}),retract:{ra_s:.85,ra_e:1.8,tw:.35,lean:.25,x:.06,la_s:.78,la_e:2.2,ll_k:.45}}],
 bjab:[
  {load:{lean:.3,ll_k:.6,rl_k:.5,head:.06},drive:mix(GR2,{lean:.5,head:-.06,ll_k:.82,rl_k:.6,ll_h:.58,la_s:.72,la_e:.45,tw:-.18,x:.05}),ext:mix(GR2,{lean:.56,head:-.1,ll_k:.88,rl_k:.62,ll_h:.62,la_s:.8,la_e:.1,tw:-.26,x:.07}),retract:mix(GR2,{lean:.28,ll_k:.55,la_s:.85,la_e:1.4})}],
 bcross:[
  {load:{lean:.28,ll_k:.6,rl_k:.55,tw:-.2,head:.05},drive:mix(GL,{lean:.52,head:-.05,ll_k:.85,rl_k:.68,ll_h:.6,ra_s:.7,ra_e:.6,tw:.45,rl_a:.9,x:.07}),ext:mix(GL,{lean:.6,head:-.1,ll_k:.92,rl_k:.7,ll_h:.66,ra_s:.8,ra_e:.08,tw:.75,rl_a:1.15,x:.11}),retract:{lean:.3,ll_k:.6,rl_k:.5,ra_s:.85,ra_e:1.7,tw:.25,la_s:.78,la_e:2.2}}],
 blhook:[
  {load:{lean:.38,ll_k:.72,rl_k:.6,tw:.28},drive:mix(GR2,{lean:.48,ll_k:.82,rl_k:.64,la_s:.55,la_e:1.0,tw:-.2,head:-.02}),ext:mix(GR2,{lean:.52,ll_k:.86,rl_k:.66,la_s:.62,la_e:.55,tw:-.66,head:-.06,ll_a:.5}),retract:mix(GR2,{lean:.3,ll_k:.6,la_s:.85,la_e:1.55,tw:-.2})}],
 brhook:[
  {load:{lean:.38,ll_k:.72,rl_k:.6,tw:-.25},drive:mix(GL,{lean:.48,ll_k:.82,rl_k:.64,ra_s:.55,ra_e:1.0,tw:.4,rl_a:.9,x:.04}),ext:mix(GL,{lean:.52,ll_k:.86,rl_k:.66,ra_s:.62,ra_e:.55,tw:.9,rl_a:1.15,x:.07}),retract:{lean:.3,ll_k:.6,ra_s:.9,ra_e:1.7,tw:.3,la_s:.78,la_e:2.2}}],
 rlk:[
  {load:{tw:.3,lean:.02,rl_h:-.05,rl_k:1.1,x:.04,ll_a:.3},chamber:mix(GL,{rl_h:.5,rl_k:1.3,tw:.6,lean:-.06,ll_a:.4,x:.07,ra_s:.2,ra_e:1.8}),drive:mix(GL,{rl_h:.85,rl_k:.55,rl_a:.5,tw:.78,lean:-.1,ll_k:.2,ll_a:.45,x:.1,ra_s:-.1,ra_e:1.5}),ext:{tw:.88,lean:-.15,rl_h:.97,rl_k:.2,rl_a:.6,ll_h:.15,ll_k:.18,ll_a:.5,x:.12,la_s:.85,la_e:2.25,ra_s:-.3,ra_e:1.3},retract:{rl_h:.42,rl_k:1.25,tw:.45,x:.06,lean:-.04,la_s:.8,la_e:2.2}},
  {load:{tw:.25,rl_k:1.0,x:.03},chamber:mix(GL,{rl_h:.7,rl_k:1.15,tw:.7,lean:-.05,x:.08}),drive:mix(GL,{rl_h:.9,rl_k:.45,tw:.85,lean:-.08,ll_a:.45,x:.11,ra_s:-.15}),ext:{tw:.95,lean:-.1,rl_h:.85,rl_k:.28,rl_a:.7,ll_h:.12,ll_k:.25,ll_a:.55,x:.13,la_s:.85,la_e:2.25,ra_s:-.35,ra_e:1.25},retract:{rl_h:.35,rl_k:1.1,tw:.4,x:.05,la_s:.8,la_e:2.2}}],
 llk:[
  {load:{ll_h:0,ll_k:1.05,rl_h:-.15,x:-.04,tw:.1},chamber:mix(GR2,{ll_h:.45,ll_k:1.2,tw:-.2,lean:-.04}),drive:mix(GR2,{ll_h:.8,ll_k:.45,ll_a:.5,lean:-.08,tw:-.35,rl_k:.25}),ext:mix(GR2,{ll_h:.92,ll_k:.2,ll_a:.6,lean:-.11,tw:-.42,rl_h:-.1,rl_k:.22}),retract:mix(GR2,{ll_h:.35,ll_k:1.1,tw:-.15})}],
 calf:[
  {load:{ll_h:-.05,ll_k:1.15,rl_h:-.15,tw:.12},chamber:mix(GR2,{ll_h:.25,ll_k:1.0,tw:-.15}),drive:mix(GR2,{ll_h:.48,ll_k:.5,ll_a:.75,lean:-.06,tw:-.4,rl_k:.28}),ext:mix(GR2,{ll_h:.57,ll_k:.33,ll_a:.92,lean:-.09,tw:-.52,rl_h:-.1,rl_k:.26}),retract:mix(GR2,{ll_h:.2,ll_k:1.0,tw:-.15})}],
 rbk:[
  {load:{tw:.3,rl_h:.15,rl_k:1.25,x:.05,ll_a:.3},chamber:mix(GL,{rl_h:.95,rl_k:1.5,tw:.62,lean:-.16,ll_a:.45,x:.09,ra_s:.1,ra_e:1.7}),drive:mix(GL,{rl_h:1.42,rl_k:.6,rl_a:.45,tw:.85,lean:-.28,ll_k:.15,ll_a:.5,x:.12,ra_s:-.25,ra_e:1.35,la_s:.92,la_e:1.95}),ext:{tw:.96,lean:-.35,rl_h:1.57,rl_k:.2,rl_a:.5,ll_h:.1,ll_k:.13,ll_a:.5,x:.14,ra_s:-.42,ra_e:1.2,la_s:.95,la_e:1.95},retract:{rl_h:.78,rl_k:1.55,rl_a:.5,tw:.45,lean:-.12,x:.08,la_s:.9,la_e:1.95}},
  {load:{tw:.35,rl_k:1.15,x:.06,ll_a:.35},chamber:mix(GL,{rl_h:1.1,rl_k:1.35,tw:.75,lean:-.2,x:.13}),drive:mix(GL,{rl_h:1.45,rl_k:.5,tw:.92,lean:-.34,x:.17,ll_a:.55,ra_s:-.3}),ext:{tw:1.0,lean:-.42,rl_h:1.52,rl_k:.24,rl_a:.55,ll_h:.08,ll_k:.15,ll_a:.55,x:.2,ra_s:-.5,ra_e:1.15,la_s:1.0,la_e:1.9},retract:{rl_h:.7,rl_k:1.45,tw:.4,lean:-.1,x:.1,la_s:.9,la_e:1.95}}],
 lbk:[
  {load:{ll_h:.1,ll_k:1.2,rl_h:-.1,x:-.05,tw:.12},chamber:mix(GR2,{ll_h:.85,ll_k:1.45,tw:-.25,lean:-.12}),drive:mix(GR2,{ll_h:1.38,ll_k:.55,ll_a:.45,lean:-.22,tw:-.45,rl_k:.18}),ext:mix(GR2,{ll_h:1.52,ll_k:.2,ll_a:.5,lean:-.29,tw:-.52,rl_h:-.05,rl_k:.15,rl_a:.4}),retract:mix(GR2,{ll_h:.7,ll_k:1.4,tw:-.2,lean:-.1})}],
 rhk:[
  {load:{tw:.3,rl_h:.25,rl_k:1.35,x:.05,lean:-.05,ll_a:.35},chamber:mix(GL,{rl_h:1.35,rl_k:1.6,tw:.65,lean:-.28,ll_a:.45,x:.1,ra_s:0,ra_e:1.6,head:.12}),drive:mix(GL,{rl_h:2.05,rl_k:.6,rl_a:.45,tw:.9,lean:-.5,ll_k:.12,ll_a:.55,x:.14,ra_s:-.35,ra_e:1.2,la_s:1.02,la_e:1.85,head:.22}),ext:{tw:1.0,lean:-.58,rl_h:2.26,rl_k:.22,rl_a:.5,ll_h:.05,ll_k:.12,ll_a:.55,x:.16,ra_s:-.5,ra_e:1.1,la_s:1.05,la_e:1.85,head:.25},retract:{rl_h:1.0,rl_k:1.7,rl_a:.5,tw:.5,lean:-.24,x:.1,la_s:.9,la_e:1.95}},
  {load:{tw:.25,rl_k:1.1,x:.04,ll_a:.3},chamber:mix(GL,{rl_h:1.0,rl_k:1.25,tw:.6,lean:-.22,x:.08,head:.1}),drive:mix(GL,{rl_h:2.0,rl_k:.45,tw:.95,lean:-.52,x:.13,ll_a:.55,ra_s:-.4,ra_e:1.15,la_s:1.05,la_e:1.85,head:.22}),ext:{tw:1.05,lean:-.6,rl_h:2.22,rl_k:.18,rl_a:.5,ll_h:.05,ll_k:.1,ll_a:.55,x:.15,ra_s:-.55,ra_e:1.05,la_s:1.05,la_e:1.85,head:.26},retract:{rl_h:.9,rl_k:1.5,tw:.45,lean:-.2,x:.08,la_s:.9,la_e:1.95}}],
 lhk:[
  {load:{ll_h:.2,ll_k:1.3,rl_h:-.1,x:-.06,tw:.15},chamber:mix(GR2,{ll_h:1.3,ll_k:1.6,tw:-.3,lean:-.26,head:.12}),drive:mix(GR2,{ll_h:1.95,ll_k:.6,ll_a:.45,lean:-.45,tw:-.52,rl_k:.13,rl_a:.35,head:.2}),ext:mix(GR2,{ll_h:2.16,ll_k:.24,ll_a:.5,lean:-.52,tw:-.62,rl_h:-.05,rl_k:.12,rl_a:.4,head:.25}),retract:mix(GR2,{ll_h:.95,ll_k:1.7,ll_a:.5,tw:-.4,lean:-.2,x:-.02})}],
 teep:[
  {load:{lean:.04,ll_k:.5,rl_k:.45},chamber:mix(GR2,{ll_h:1.15,ll_k:1.9,rl_h:-.12,lean:-.12,la_s:.85}),drive:mix(GR2,{ll_h:1.4,ll_k:.7,ll_a:-.1,lean:-.24,rl_k:.18,x:.03}),ext:mix(GR2,{ll_h:1.46,ll_k:.04,ll_a:-.32,lean:-.32,rl_h:-.05,rl_k:.15,x:.07}),retract:mix(GR2,{ll_h:1.0,ll_k:1.6,lean:-.12})}],
 knee:[
  {load:mix({la_s:1.35,la_e:1.0,ra_s:1.3,ra_e:1.0},{lean:.12,rl_k:.6}),chamber:{la_s:1.55,la_e:.85,ra_s:1.5,ra_e:.85,rl_h:.6,rl_k:1.7,lean:.16,x:.05},drive:{la_s:1.6,la_e:.8,ra_s:1.55,ra_e:.8,rl_h:1.25,rl_k:2.2,rl_a:.5,lean:.14,x:.1,ll_k:.18,ll_a:.4},ext:{la_s:1.55,la_e:.9,ra_s:1.5,ra_e:.9,rl_h:1.52,rl_k:2.3,rl_a:.6,lean:.2,x:.13,ll_k:.15,ll_a:.45,chest:-.05},retract:{la_s:1.2,la_e:1.3,ra_s:1.0,ra_e:1.6,rl_h:.6,rl_k:1.5,lean:.12,x:.05}}],
 elbow:[
  {load:{tw:-.22,ra_s:1.15,ra_e:2.6,lean:.08},drive:mix(GL,{ra_s:1.75,ra_e:2.62,tw:.45,lean:.18,head:.08,rl_a:.8,x:.04}),ext:mix(GL,{ra_s:2.02,ra_e:2.66,tw:.85,lean:.26,head:.12,rl_a:1.05,x:.07}),retract:{ra_s:1.2,ra_e:2.5,tw:.3,lean:.14,la_s:.78,la_e:2.3}}],
 sbf:[
  {load:{tw:.5,lean:.05,rl_h:.1,x:.04},chamber:{tw:1.6,lean:.05,rl_h:.25,ll_h:-.12,x:.12,ra_s:.8,ra_e:1.5,head:.1},drive:{tw:-.4,ra_s:1.45,ra_e:.6,lean:.1,x:.24,rl_h:-.3,ll_h:.35,la_s:.8,la_e:2.3},ext:{tw:-1.2,ra_s:1.62,ra_e:.18,lean:.1,head:.05,x:.28,rl_h:-.4,ll_h:.4,la_s:.8,la_e:2.3},retract:{tw:-.5,ra_s:.9,ra_e:1.6,lean:.08,x:.14,la_s:.8,la_e:2.2}}]
};
/* install: variant 0 becomes the clip's default keys */
const ATK_VARIANTS={};for(const k in ATK){const c=MV[k];if(!c||!c.hit)continue;ATK_VARIANTS[k]=ATK[k].map(P=>buildKeys(c,P));c.keys=ATK_VARIANTS[k][0]}
/* pick a variant per throw, never the same twice in a row for this fighter */
{const sk=F2.prototype.strike;F2.prototype.strike=function(key,M){const ok=sk.call(this,key,M);const V=ATK_VARIANTS[key];if(ok&&V&&V.length>1&&this.act&&this.act.key===key){const last=(this._lastVar||{})[key];let i=Math.floor(Math.random()*V.length);if(i===last)i=(i+1)%V.length;(this._lastVar=this._lastVar||{})[key]=i;this.act.c=Object.assign({},this.act.c,{keys:V[i]});this.act.variant=i}return ok}}
/* variants carry the stylistic differences now: keep the random per-throw jitter small */
if(typeof MR!=='undefined')MR.variety=.5;
window.ATK_VARIANTS=ATK_VARIANTS}
