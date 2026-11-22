// A car's top speed and its 0-100 km/h on the flat, and a stop from 100 (the era test, review 94).
//   npx tsx tools/ref/topspeed.ts <id> [...]
import { raceSpec } from '../../race/cars';
import { Vehicle } from '../../race/vehicle';
import { Track } from '../../race/track';
const flat = new Track({ name: 'flat', pieces: [{ kind: 'straight', len: 30000, name: 'a' }, { kind: 'arc', radius: 400, turn: 180, name: 'b' }, { kind: 'straight', len: 30000, name: 'c' }, { kind: 'arc', radius: 400, turn: 180, name: 'd' }], start: { x: 0, y: 0, heading: 0 }, width: 30, easing: 30, banking: [], bumps: [], landmarks: [], joints: 12 }), dt = 1 / 200;
for (const id of process.argv.slice(2)) { const c = raceSpec(id), car = new Vehicle(c, flat).place(100, 0, 0); let t = 0, t100 = 0, vmax = 0;
  while (t < 150) { car.step(dt, { throttle: 1, brake: 0, steer: 0 }); t += dt; if (!t100 && car.speed >= 100 / 3.6) t100 = t; vmax = Math.max(vmax, car.speed); }
  const s = new Vehicle(c, flat).place(100, 0, 100 / 3.6); let d = 0; for (let k = 0; k < 6000 && s.speed > 0.3; k++) { s.step(dt, { throttle: 0, brake: 1, steer: 0 }); d += s.speed * dt; }
  const h = new Vehicle(c, flat).place(100, 0, 160 / 3.6); let fades = 0; for (let n = 0; n < 6; n++) { h.place(h.s, 0, 160 / 3.6); let dd = 0; for (let k = 0; k < 8000 && h.speed > 0.3; k++) { h.step(dt, { throttle: 0, brake: 1, steer: 0 }); dd += h.speed * dt; } fades = dd; }
  console.log(id.padEnd(9), 'top', Math.round(vmax * 3.6), 'km/h (book', c.topKmh + ')', ' 0-100', t100 ? t100.toFixed(1) + ' s' : '-', ' 100-0', d.toFixed(0), 'm', ' 6th stop from 160', fades.toFixed(0), 'm, brakes', Math.round(Math.max(...h.brakeT)), 'deg'); }
