// node tools/dyncheck.mjs : the real-time car physics (sim/dyn.mjs) against the design report (sim/chassis.mjs, sim/drive.mjs).
// Standing still, 0-60 and top speed, 60-0 braking, steady skidpad, and the body's bounce frequency.
import { engineStats } from '../sim/engine.mjs';
import { simulate, GEARBOX } from '../sim/drive.mjs';
import { chassisDefault, chassisStats } from '../sim/chassis.mjs';
import { makeCar, stepCar, rpmOf } from '../sim/dyn.mjs';

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
}
console.log('\nworst deviation from the report: ' + (worst * 100).toFixed(0) + '%');
