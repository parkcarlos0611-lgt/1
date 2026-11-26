// The skidpad: a fixed radius on flat concrete, speed raised slowly, steering held to the line by a simple loop; the
// lateral g held before the car runs wide.  npx tsx tools/dev/skidpad.ts [car] [radius]
import { raceSpec } from '../../race/cars';
import { Vehicle } from '../../race/vehicle';
import { VehicleFlat } from '../../race/vehicle_flat';
import { Track } from '../../race/track';
const id = process.argv[2] ?? 'jagD55', Rr = +(process.argv[3] ?? 80), dt = 1 / 200;
const T = new Track({ name: 'pad', pieces: [{ kind: 'arc', radius: Rr, turn: 360, name: 'a' }], start: { x: 0, y: 0, heading: 0 }, width: 40, easing: 2, banking: [], bumps: [], landmarks: [], joints: 12 });
for (const C of [Vehicle, VehicleFlat] as const) { const c = new (C as typeof Vehicle)(raceSpec(id), T).place(10, 0, 8); let best = 0, steer = 0, vt = 8, bestBal = '';
  for (let k = 0; k < 200 * 120; k++) { const e = c.off, err = e + 0.6 * (c.vy / Math.max(1, c.speed)) * 0; steer = Math.max(-1.6, Math.min(1.6, 0.25 + 0.3 * -(-e) * 0 + (-e) * -0.15 + 0.6 * Math.atan2(-c.vy, Math.max(1, c.vx)) * 0)); 
    // aim: keep off ~ 0 with a PD on offset and heading error
    const hErr = Math.atan2(Math.sin(c.yaw - T.at(c.s).h), Math.cos(c.yaw - T.at(c.s).h)); steer = Math.max(-1.6, Math.min(1.6, 0.3 + (-e) * 0.25 - hErr * 1.5));
    vt += dt * 0.15; const thr = Math.max(0, Math.min(1, (vt - c.speed) * 0.5)); c.step(dt, { throttle: thr, brake: 0, steer });
    const lat = c.speed * c.speed / Rr / 9.81; if (Math.abs(c.off) < 1.5 && k > 2000) { if (lat > best) { best = lat; bestBal = `slipA ${c.slipA.map(a => (a * 57.3).toFixed(1)).join('/')} load ${c.load.map(x => Math.round(x / 100)).join('/')} steer ${steer.toFixed(2)}`; } } if (Math.abs(c.off) > 6) break; void err; }
  console.log(C.name, id, 'R', Rr, 'max lateral g', best.toFixed(3), bestBal); }
