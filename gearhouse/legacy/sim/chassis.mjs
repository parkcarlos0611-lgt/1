// Chassis physics (plan 19-2): suspension, dampers, brakes, tyres and steering.
// Quasi-static models in SI units; figures are checked against period road-test ranges, see the table at the bottom.
//   ride:     corner wheel rate k (N/m) on the sprung corner mass -> natural frequency f = sqrt(k/m)/2pi
//   roll:     roll stiffness from spring rates on their spring track (leaf springs sit inboard) + anti-roll bar;
//             roll moment = sprung mass x g x (CG height - roll-axis height)
//   pitch:    load transfer m a h / wb split into front and rear spring deflections
//   grip:     bias-ply friction with load sensitivity, width and pressure; balance from front share of roll stiffness vs weight
//   brakes:   shoe force capacity from drum area and actuation efficiency; bias against the ideal dynamic split; drum heating per stop
export const SUSP_F = {
  beam:    { name: 'BEAM AXLE, LEAF SPRINGS',   year: 1900, unsprung: 56, rc: 0.36, sTrack: 0.72, ifs: false, cost: 0,  fric: 0.30 },
  trans:   { name: 'BEAM AXLE, TRANSVERSE LEAF', year: 1900, unsprung: 52, rc: 0.42, sTrack: 0.46, ifs: false, cost: -6, fric: 0.30 },
  wish:    { name: 'COIL SPRINGS, WISHBONES',   year: 1934, unsprung: 32, rc: 0.06, sTrack: 0.80, ifs: true,  cost: 25, fric: 0.04, tech: 'ifs' },
  torsion: { name: 'TORSION BARS, WISHBONES',   year: 1934, unsprung: 30, rc: 0.08, sTrack: 0.85, ifs: true,  cost: 30, fric: 0.03, tech: 'ifs' } };
export const SUSP_R = {
  live:    { name: 'LIVE AXLE, LEAF SPRINGS',   year: 1900, unsprung: 86, rc: 0.40, sTrack: 0.74, cost: 0,  fric: 0.30 },
  trans:   { name: 'LIVE AXLE, TRANSVERSE LEAF', year: 1900, unsprung: 80, rc: 0.46, sTrack: 0.46, cost: -6, fric: 0.30 },
  coil:    { name: 'LIVE AXLE, COIL SPRINGS',   year: 1938, unsprung: 82, rc: 0.30, sTrack: 0.70, cost: 14, fric: 0.04, tech: 'ifs' },
  swing:   { name: 'SWING AXLES',               year: 1934, unsprung: 46,  rc: 0.48, sTrack: 0.80, cost: 30, fric: 0.05, tech: 'ifs' } };
export const DAMPERS = {
  friction: { name: 'FRICTION DISCS',     year: 1900, eff: 0.55, cost: 0 },
  lever:    { name: 'LEVER HYDRAULIC',    year: 1925, eff: 0.85, cost: 8 },
  tube:     { name: 'TELESCOPIC',         year: 1934, eff: 1.0,  cost: 12 } };
export const STEERING = {
  worm:  { name: 'WORM AND SECTOR',       year: 1900, eff: 0.55, play: 0.30, cost: 0 },
  cam:   { name: 'CAM AND LEVER',         year: 1926, eff: 0.65, play: 0.20, cost: 4 },
  ball:  { name: 'RECIRCULATING BALL',    year: 1940, eff: 0.80, play: 0.10, cost: 10 } };
// bias-ply sizes: section width (in) - rim (in), with the years they were common
export const TYRES = [['5.00-19', 1928], ['5.25-18', 1928], ['5.50-17', 1932], ['6.00-17', 1932], ['5.50-16', 1935], ['6.00-16', 1935], ['6.50-16', 1936], ['7.00-16', 1937], ['6.40-15', 1946], ['6.70-15', 1946], ['7.10-15', 1948]];
export const tyresFor = y => TYRES.filter(t => t[1] <= y).map(t => t[0]);
export const tyreDims = s => { const [w, rim] = s.split('-').map(Number); return { w, rim, r: (rim * 25.4 / 2 + w * 25.4 * 0.96) / 1000 }; };   // section ~ as tall as wide on period bias tyres
export function chassisDefault(year) { const T = tyresFor(year);
  return { fs: 'beam', rs: 'live', kF: 18, kR: 22, damp: year >= 1934 ? 'lever' : 'friction', zeta: 0.25, arb: false, drum: 280, drumW: 45, bias: 0.55, tyre: T.includes('6.00-16') ? '6.00-16' : T[T.length - 1], psi: 28, steer: year >= 1926 ? 'cam' : 'worm', sRatio: 18 }; }
export function clampChassis(c, year, has = () => true) { const ok = (o, k) => o[k] && o[k].year <= year && (!o[k].tech || has(o[k].tech));
  if (!ok(SUSP_F, c.fs)) c.fs = 'beam'; if (!ok(SUSP_R, c.rs)) c.rs = 'live'; if (!ok(DAMPERS, c.damp)) c.damp = 'friction'; if (!ok(STEERING, c.steer)) c.steer = 'worm'; if (!tyresFor(year).includes(c.tyre)) c.tyre = chassisDefault(year).tyre;
  if (year < 1934) c.arb = false; return c; }

// car: { mass (kg, kerb incl. engine), engineKg, wb (mm), track (mm), cgH (m), hyd (bool) }
export function chassisStats(c, car) {
  const F = SUSP_F[c.fs], R = SUSP_R[c.rs], Dm = DAMPERS[c.damp], St = STEERING[c.steer], ty = tyreDims(c.tyre), g = 9.81;
  const m = car.mass, wb = car.wb / 1000, t = (car.track || 1420) / 1000, h = car.cgH ?? 0.58, wf = Math.min(0.62, 0.44 + (car.engineKg || 250) / m * 0.32);
  const tyreKg = 9 + ty.w * 1.6 + ty.rim * 0.25, drumKg = Math.PI * (c.drum / 1000) * (c.drumW / 1000) * 0.012 * 7200 * 1.7;
  const uF = F.unsprung + 2 * (tyreKg + drumKg), uR = R.unsprung + 2 * (tyreKg + drumKg), msF = (m * wf - uF) / 2, msR = (m * (1 - wf) - uR) / 2, ms = 2 * (msF + msR);
  const kF = c.kF * 1000, kR = c.kR * 1000, fF = Math.sqrt(kF / msF) / (2 * Math.PI), fR = Math.sqrt(kR / msR) / (2 * Math.PI);
  // roll: springs act on their own track; a transverse leaf barely resists roll; the bar adds ~40% at the front
  const KF = kF * (t * F.sTrack) ** 2 / 2 * (c.arb ? 1.45 : 1), KR = kR * (t * R.sTrack) ** 2 / 2, rcAvg = F.rc * (1 - wf) + R.rc * wf;
  const roll = ms * g * Math.max(0.05, h - rcAvg) / (KF + KR) * 57.3;                   // degrees per g
  const pitch = a => { const dW = m * a * g * h / wb; return Math.atan((dW / 2 / kF + dW / 2 / kR) / wb) * 57.3; };
  // ride: comfortable near 1.0-1.2 Hz, harsh above, floaty below; leaf interleaf friction and heavy axles shake; damping near 0.25-0.3
  const fAvg = (fF + fR) / 2, fric = (F.fric + R.fric) / 2, z = c.zeta * Dm.eff, unsR = (uF + uR) / ms;
  const ride = Math.max(0, Math.min(1, 1 - Math.abs(fAvg - 1.1) * 0.55 - fric * 0.6 - Math.max(0, unsR - 0.28) * 1.0 - Math.abs(z - 0.27) * 1.4 + (fR > fF ? 0.04 : 0)));
  const control = Math.max(0, Math.min(1, 1 - Math.max(0, 0.22 - z) * 3 - Math.max(0, unsR - 0.28) * 0.8 - (F.ifs ? 0 : 0.06) - (c.rs === 'swing' ? 0.05 : 0)));   // wheels kept on a rough road
  // tyres: bias ply about 0.7, a little more for wider and softer; load sensitivity on the heavier axle
  const mu0 = 0.7 * (ty.w / 6) ** 0.18 * (1 + (28 - c.psi) * 0.004) * (0.94 + control * 0.06);
  const frontShare = KF / (KF + KR), balance = (frontShare - wf) * 1.6 + (wf - 0.5) * 0.9 + (c.rs === 'swing' ? -0.12 : 0) + 0.1;   // >0 understeer; cross-ply fronts and steering give way first
  const latG = mu0 * (1 - Math.abs(balance) * 0.18) * (1 - Math.min(0.12, roll / 100));
  // brakes: shoe capacity grows with drum area; rods and cables lose a third; bias against the ideal split at that decel
  const area = 4 * (c.drum / 1000) * (c.drumW / 1000), eff = car.hyd ? 0.92 : 0.62, cap = eff * area * 21000 / m;
  const muL = mu0 * 1.02, ideal = wf + h / wb * Math.min(cap, muL), dev = Math.abs(c.bias - ideal), decel = Math.min(cap, muL * (1 - dev * 1.6)) * (car.hyd ? 1 : 0.94);
  const stop60 = 26.82 ** 2 / (2 * decel * g) * 3.281;                                   // feet from 60 mph
  // fade: front drum temperature over repeated stops from 60 mph, cooling between them; linings fade near 260 C
  const ePer = 0.5 * m * 26.82 ** 2 * c.bias / 2, dT = ePer / (drumKg * 460); let T = 40, n = 0; while (T < 260 && n < 20) { T += dT; T -= (T - 30) * (0.05 + c.drum / 6000); n++; }
  // steering: turns lock to lock from the box ratio; effort from front load, tyre width and box efficiency
  const turns = c.sRatio * 2 * 34 / 360, effort = (m * wf * g) * (ty.w / 6) / c.sRatio / St.eff / 520;
  const cost = F.cost + R.cost + Dm.cost + St.cost + (c.arb ? 6 : 0) + (car.hyd ? 12 : 0) + (c.drum - 260) * 0.06 + (c.drumW - 40) * 0.12 + (ty.w - 6) * 4;
  return { wf, uF: Math.round(uF), uR: Math.round(uR), fF, fR, roll, dive: pitch(0.6), squat: pitch(0.3), ride, control, mu0, latG, balance, frontShare, cap, decel, stop60, fadeStops: n, drumKg, tyreR: ty.r, crr: 0.015 * (28 / c.psi) ** 0.45, turns, effort, play: St.play, ifs: F.ifs, cost: Math.round(cost) };
}
// Sanity ranges from period road tests (The Motor / Autocar data tables, US magazine tests 1935-49):
//   stopping from 60 mph: about 150-210 ft for hydraulic drums on bias tyres, 190-260 ft for rod or cable brakes
//   ride frequencies: 1.4-2.0 Hz for leaf-sprung beam axles, about 1.0-1.3 Hz for the soft independent cars of the late 1930s
//   lateral grip: roughly 0.55-0.70 g on cross-ply tyres
