// Quick checks of the 3D car (review 120): standing still, a run up to speed, a stop, a lap of Millbrook by the driver.
//   npx tsx tools/dev/v3check.ts [car=dueSSJ35] [flat=1 to also run the old model]
import { raceSpec } from '../../race/cars';
import { Vehicle } from '../../race/vehicle';
import { VehicleFlat } from '../../race/vehicle_flat';
import { Driver } from '../../race/driver';
import { Track } from '../../race/track';
import { millbrook } from '../../race/millbrook';
const id = process.argv[2] ?? 'dueSSJ35', dt = 1 / 200;
const flat = new Track({ name: 'flat', pieces: [{ kind: 'straight', len: 8000, name: 'a' }, { kind: 'arc', radius: 400, turn: 180, name: 'b' }, { kind: 'straight', len: 8000, name: 'c' }, { kind: 'arc', radius: 400, turn: 180, name: 'd' }], start: { x: 0, y: 0, heading: 0 }, width: 30, easing: 30, banking: [], bumps: [], landmarks: [], joints: 12 });
for (const [name, Make] of [['3D', Vehicle], ...(process.argv[3] === '1' ? [['flat', VehicleFlat]] : [])] as const) {
  const C = Make as unknown as new (s: ReturnType<typeof raceSpec>, t: Track) => Vehicle;
  const a = new C(raceSpec(id), flat).place(100, 0, 0); let zmin = 9, zmax = -9;
  for (let t = 0; t < 3; t += dt) { a.step(dt, { throttle: 0, brake: 1, steer: 0 }); if (t > 1) { zmin = Math.min(zmin, a.zb); zmax = Math.max(zmax, a.zb); } }
  const st = { zb: a.zb.toFixed(3), pitch: (a.pitch * 57.3).toFixed(2), roll: (a.roll * 57.3).toFixed(2), load: a.load.map(x => Math.round(x)).join('/'), drift: [zmin.toFixed(3), zmax.toFixed(3)] };
  const b = new C(raceSpec(id), flat).place(100, 0, 0); let t = 0, t100 = 0, vmax = 0; const t0 = performance.now();
  for (; t < 60; t += dt) { b.step(dt, { throttle: 1, brake: 0, steer: 0 }); if (!t100 && b.speed * 3.6 >= 100) t100 = t; vmax = Math.max(vmax, b.speed * 3.6); }
  const ms = performance.now() - t0;
  const c = new C(raceSpec(id), flat).place(100, 0, 100 / 3.6); let d = 0; for (let k = 0; k < 6000 && c.speed > 0.3; k++) { c.step(dt, { throttle: 0, brake: 1, steer: 0 }); d += c.speed * dt; }
  const T = millbrook(), e = new C(raceSpec(id), T).place(T.spec.landmarks.find(l => l.kind === 'line')!.s - 4, 0, 0), dr = new Driver(T); let lap = 0, worst = 0, s0 = e.s, dist = 0, up = 0;
  for (let k = 0; k < 200 * 400; k++) { const p = e.s; e.step(dt, dr.drive(e)); dist += T.gap(p, e.s); worst = Math.max(worst, Math.abs(e.off)); if (e.upset) up++; if (dist >= T.length) { lap = k * dt; break; } }
  console.log(name, id, JSON.stringify({ stand: st, t100: t100.toFixed(1), vmax: vmax.toFixed(0), stop100: d.toFixed(1), lap: lap.toFixed(1), worstOff: worst.toFixed(1), over: e.over, upset: up, cpuMsPerSimSec: (ms / 60).toFixed(2) })); void s0; }
