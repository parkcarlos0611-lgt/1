// node tools/dyncheck.mjs : the real-time car physics (sim/dyn.mjs) against the design report (sim/chassis.mjs, sim/drive.mjs).
// Standing still, 0-60 and top speed, 60-0 braking, steady skidpad, and the body's bounce frequency; then the side-view
// checks of plan 24-3: a single bump, leaving the ground over a crest (flight time against the ballistic one), a short ramp.
import { engineStats } from '../sim/engine.mjs';
import { simulate, GEARBOX } from '../sim/drive.mjs';
import { chassisDefault, chassisStats } from '../sim/chassis.mjs';
import { makeCar, stepCar, rpmOf, settle } from '../sim/dyn.mjs';

const CARS = [
  ['1938 OHV six, beam / live axle, hydraulic', { layout: 'I6', head: 'ohv', material: 'iron', bore: 85, stroke: 105, cr: 6, cam: 0.3, carbs: 1, carbSize: 1, quality: 0, year: 1938 }, { type: 'sync3', ratios: [2.9, 1.65, 1] }, 1938, {}, true],
  ['1932 side-valve four, mechanical brakes', { layout: 'I4', head: 'sv', material: 'iron', bore: 85, stroke: 105, cr: 5.2, cam: 0.3, carbs: 1, carbSize: 1, quality: 0, year: 1932 }, { type: 'crash3', ratios: [3.1, 1.8, 1] }, 1932, { damp: 'friction' }, false],
  ['1940 V8, coil wishbones, telescopic', { layout: 'V8', head: 'sv', material: 'iron', bore: 81, stroke: 95, cr: 6.2, cam: 0.4, carbs: 1, carbSize: 1.1, quality: 0, year: 1940 }, { type: 'sync3', ratios: [2.8, 1.6, 1] }, 1940, { fs: 'wish', kF: 16, kR: 20, damp: 'tube', tyre: '6.00-16' }, true]];
const flat = () => ({ k: 0, grade: 0, bank: 0, h: 0, mu: 1 });
const fmt = (a, b) => `${a.toFixed(2)} vs ${b.toFixed(2)} (${((a / b - 1) * 100).toFixed(0)}%)`;
let worst = 0;
for (const [name, e, gb, year, chg, hyd] of CARS) {
  const es = engineStats({ ...e, year }), M = 1250, cfg = { ...chassisDefault(year), ...chg }, ch = chassisStats(cfg, { mass: M, engineKg: es.mass, wb: 2850, track: 1420, cgH: 0.58, hyd });
  const base = { es, gearbox: gb, final: 4.1, mass: M, cda: 1.05, crr: ch.crr, cfg, ch: { ...ch }, wb: 2850, track: 1420, cgH: 0.58, hyd };
  const rep = simulate({ es, engine: e, gearbox: gb, final: 4.1, tyreR: ch.tyreR, crr: ch.crr, mass: M - (es.mass - 200) - GEARBOX[gb.type].mass, cda: 1.05 / 0.6 * 0.6, driveFrac: 0.52 });
  console.log('\n' + name);
  // 1 standing still
  let C = makeCar(base); for (let i = 0; i < 3000; i++) stepCar(C, { gas: 0, brake: 0, steer: 0 }, flat, 0.001);
  console.log(`  at rest 3 s: drift ${C.s.toFixed(3)} m, heave ${(C.z * 1000).toFixed(1)} mm, roll ${(C.roll / Math.PI * 180).toFixed(2)} deg, rpm ${rpmOf(C).toFixed(0)}`);
  // 2 0-60 and top speed with automatic shifting
  C = makeCar(base); let t60 = null, vmax = 0; for (let i = 0; i < 120000; i++) { stepCar(C, { gas: 1, brake: 0, steer: 0, autoShift: true }, flat, 0.001); if (t60 == null && C.u >= 26.82) t60 = C.t; vmax = Math.max(vmax, C.u); }
  console.log(`  0-60 s: ${t60 ? fmt(t60, rep.zeroSixty || 99) : 'not reached'}   top mph: ${fmt(vmax * 2.237, rep.topMph)}`); if (t60) worst = Math.max(worst, Math.abs(t60 / rep.zeroSixty - 1)); worst = Math.max(worst, Math.abs(vmax * 2.237 / rep.topMph - 1));
  // 3 60-0 braking in neutral
  C = makeCar(base); C.u = 26.82; C.gear = 0; for (const c of C.corners) c.w = C.u / C.R0; let x0 = C.s; for (let i = 0; i < 20000 && C.u > 0.05; i++) stepCar(C, { gas: 0, brake: 1, steer: 0 }, flat, 0.001);
  const ft = (C.s - x0) * 3.281; console.log(`  60-0 ft: ${fmt(ft, ch.stop60)}`); worst = Math.max(worst, Math.abs(ft / ch.stop60 - 1));
  // 4 skidpad: 40 m radius, a steering loop holds the line, speed creeps up until the car cannot hold it
  C = makeCar(base); C.gear = 2; const R = 40, pad = () => ({ k: 1 / R, grade: 0, bank: 0, h: 0, mu: 1 }); let best = 0, vt = 8, iI = 0;
  for (let i = 0; i < 90000; i++) { const err = C.n * 1.2 + C.psi * 6; iI += err * 0.001; const steer = Math.max(-1, Math.min(1, (err + iI * 0.4) + (Math.atan(2.85 / R) / (34 * Math.PI / 180)) / Math.max(0.2, 9 / Math.max(9, C.u))));
    vt += 0.0006; const gas = C.u < vt ? 1 : 0.05; stepCar(C, { gas, brake: 0, steer, autoShift: false }, pad, 0.001);
    if (Math.abs(C.n) < 1.5 && i > 5000) best = Math.max(best, C.u * C.u / R / 9.81); if (Math.abs(C.n) > 4) break; }
  console.log(`  skidpad g: ${fmt(best, ch.latG)}`); worst = Math.max(worst, Math.abs(best / ch.latG - 1));
  // 5 bounce: lift the body 80 mm, let go, time the first half swing to the bottom
  C = makeCar(base); C.z = 0.08; let tb = null; for (let i = 0; i < 3000 && tb == null; i++) { const v0 = C.vz; stepCar(C, { gas: 0, brake: 0, steer: 0 }, flat, 0.001); if (v0 < 0 && C.vz >= 0) tb = C.t; }
  const f = tb ? 1 / (2 * tb) : 0; console.log(`  bounce Hz: ${fmt(f, (ch.fF + ch.fR) / 2)}`); worst = Math.max(worst, Math.abs(f / ((ch.fF + ch.fR) / 2) - 1));
  // 6 single bump: 50 mm half-sine, 0.6 m long, at 15 m/s in neutral; peak body acceleration and how long it keeps moving
  { const prof = s => (s > 20 && s < 20.6 ? 0.05 * Math.sin((s - 20) / 0.6 * Math.PI) : 0), rd = (s) => ({ k: 0, grade: 0, bank: 0, h: prof(s), mu: 1 }); rd.hf = s => prof(s);
    C = makeCar(base); settle(C, rd); C.u = 15; C.gear = 0; for (const c of C.corners) c.w = C.u / C.R0; let pk = 0, last = 0, vz0 = 0, tOff = null;
    for (let i = 0; i < 5000; i++) { stepCar(C, { gas: 0, brake: 0, steer: 0 }, rd, 0.001); const az = (C.vz - vz0) / 0.001; vz0 = C.vz; if (C.s > 19) { pk = Math.max(pk, Math.abs(az)); if (Math.abs(C.vz) > 0.02) last = C.t; } if (tOff == null && C.s - C.b > 20.6) tOff = C.t; }
    console.log(`  bump 50 mm at 15 m/s: peak body ${(pk / 9.81).toFixed(2)} g, still moving ${(last - tOff).toFixed(2)} s after the rear wheels clear it`); }
  // 7 crest: a 9 % ramp up, then the road drops away at 30 %; flight time against a thrown body's
  { const prof = s => (s < 30 ? 0 : s < 50 ? (s - 30) * 0.09 : Math.max(-4, 1.8 - (s - 50) * 0.3)), rd = s => ({ k: 0, grade: 0, bank: 0, h: prof(s), mu: 1 }); rd.hf = s => prof(s);
    C = makeCar(base); settle(C, rd); C.u = 22; C.gear = 0; for (const c of C.corners) c.w = C.u / C.R0; let air = 0, tAir = 0, maxStop = 0;
    for (let i = 0; i < 4000; i++) { stepCar(C, { gas: 0, brake: 0, steer: 0 }, rd, 0.001); if (C.air > 0) tAir += 0.001; air = Math.max(air, C.air); maxStop = Math.max(maxStop, C.bumpHit); }
    let tb = 0; for (let t = 0.01; t < 3; t += 0.001) { const y = 1.8 + 22 * 0.09 * t - 4.905 * t * t; if (y <= prof(50 + 22 * t)) { tb = t; break; } }   // a body thrown off the lip at the ramp's climb
    console.log(`  crest at 22 m/s: in the air ${fmt(air, tb)} against a thrown body, worst bump stop on landing ${(maxStop / 1000).toFixed(1)} kN`); worst = Math.max(worst, Math.abs(air / tb - 1) * 0.5); }
  // 8 a short 50 % ramp (27 deg, steeper than the approach angle) met at walking pace: the front bumper should touch
  { const prof = s => (s < 12 ? 0 : Math.min(0.4, (s - 12) * 0.5)), rd = s => ({ k: 0, grade: 0, bank: 0, h: prof(s), mu: 1 }); rd.hf = s => prof(s);
    C = makeCar(base); settle(C, rd); C.gear = 1; let scr = 0; for (let i = 0; i < 9000; i++) { stepCar(C, { gas: 0.5, brake: 0, steer: 0 }, rd, 0.001); scr = Math.max(scr, C.scrape); }
    console.log(`  50 % ramp: underside contact ${scr > 0 ? (scr / 1000).toFixed(1) + ' kN' : 'none'}, got to ${C.s.toFixed(1)} m`); }
}
console.log('\nworst deviation from the report: ' + (worst * 100).toFixed(0) + '%');
