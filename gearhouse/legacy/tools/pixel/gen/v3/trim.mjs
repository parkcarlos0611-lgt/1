// Trim level on the drawing: wheels offered per trim, and how much brightwork the car carries.
//   BASIC    painted steel wheels, painted grille shell / lamp rims / bumpers, no mouldings or mascot
//   STANDARD + small hubcaps, chrome grille and bumpers, black lamp rims, no mouldings
//   DE LUXE  + full hubcaps / trim rings / whitewalls, chrome lamp rims, window reveals and belt moulding (as the measured car)
//   CUSTOM   + wire or knock-off wheels, wide whitewalls, a side spear and fog lamps
export const TRIM_NAMES = ['BASIC', 'STANDARD', 'DE LUXE', 'CUSTOM'];
export function wheelsFor(trim, year) {
  const w = ['disc']; if (year < 1936) w.push('artillery'); if (trim >= 1) w.push('smallcap'); if (trim >= 2) w.push('hubcap', 'trimring');
  if (trim >= 3) { w.push('wire'); if (year >= 1934) w.push('spinner'); } return w; }
export const WHEEL_NAMES = { disc: 'PAINTED STEEL', artillery: 'WOOD SPOKE', smallcap: 'SMALL HUBCAP', hubcap: 'FULL HUBCAP', trimring: 'TRIM RING', wire: 'WIRE WHEEL', spinner: 'KNOCK-OFF WIRE' };
export const wwMax = trim => (trim >= 3 ? 0.45 : trim >= 2 ? 0.3 : 0);
const wheelOf = (tv, paint, old = {}) => ({ ...old, style: tv.wheel === 'smallcap' ? 'disc' : tv.wheel, cap: tv.wheel !== 'disc', marker: true,
  paint: ['disc', 'smallcap', 'trimring'].includes(tv.wheel) ? (tv.trim === 0 ? 'black' : paint) : tv.wheel === 'artillery' ? 'wood' : old.paint || 'white', whitewall: Math.min(tv.ww || 0, wwMax(tv.trim)) });
export function trimSide(s, tv, paint) {
  if (!tv) return s; const t = tv.trim ?? 1; if (tv.wheel) s.wheel = wheelOf(tv, paint, s.wheel || {});
  if (t <= 1) { s.trim = (s.trim || []).filter(x => x.ramp && x.ramp !== 'chrome'); if (s.frame === 'chrome') s.frame = 'reveal'; (s.lamps || []).forEach(l => { if (l.bezel === 'chrome' && l.ramp === 'lensW') l.bezel = 'black'; }); }
  if (t === 0) { (s.parts || []).forEach(p => { if (p.chrome) { delete p.chrome; p.ramp = p.behind ? paint : 'black'; p.base = p.base ?? 2; } }); (s.bumperSets || []).forEach(b => { b.ramp = 'black'; }); (s.bumpers || []).forEach(b => { b.ramp = 'black'; }); }
  if (t === 3 && s.geo) { const g = s.geo, z = (g.beltZ || g.hoodZ) - 150; s.trim = [...(s.trim || []), { pts: [[g.F + g.gap * 0.6, z + 10], [(g.F + g.R) / 2, z], [g.R - g.gap * 0.4, z - 25]], w: 2 }]; }   // side spear
  return s; }
export function trimFront(f, tv, paint, rear = false) {
  if (!tv) return f; const t = tv.trim ?? 1;
  if (t <= 1) { (f.lamps || []).forEach(l => { if (l.bezel === 'chrome' && l.ramp === 'lensW') l.bezel = 'black'; }); f.parts = (f.parts || []).filter(p => !p.orn); }
  if (t === 0) { (f.grilles || []).forEach(g => { g.surround = paint; if (g.bars === 'chrome') g.bars = 'iron'; }); (f.bumpers || []).forEach(b => { b.ramp = 'black'; }); (f.parts || []).forEach(p => { if (p.chrome) { delete p.chrome; p.ramp = 'black'; } }); }
  if (t === 3 && !rear && !(f.lamps || []).some(l => l.fog)) { let zt = 0, yw = 0; for (const b of f.bumpers || []) for (const p of b.pts) { zt = Math.max(zt, p[1]); yw = Math.max(yw, Math.abs(p[0])); }
    if (zt) f.lamps.push({ fog: 1, y: yw * 0.45, z: zt + 90, r: 58, ramp: 'lensA', bezel: 'chrome' }); }
  return f; }
