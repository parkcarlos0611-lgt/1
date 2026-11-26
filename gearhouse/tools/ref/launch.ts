// A standing start, step by step (review 97): speed, gear, revs, the driven wheels' slip, every few tenths.
//   npx tsx tools/ref/launch.ts <id> [seconds=14]
import { raceSpec } from '../../race/cars';
import { Vehicle } from '../../race/vehicle';
import { Track } from '../../race/track';
const flat = new Track({ name: 'flat', pieces: [{ kind: 'straight', len: 30000, name: 'a' }, { kind: 'arc', radius: 400, turn: 180, name: 'b' }, { kind: 'straight', len: 30000, name: 'c' }, { kind: 'arc', radius: 400, turn: 180, name: 'd' }], start: { x: 0, y: 0, heading: 0 }, width: 30, easing: 30, banking: [], bumps: [], landmarks: [], joints: 12 }), dt = 1 / 200;
const id = process.argv[2]!, T = +(process.argv[3] ?? 14), car = new Vehicle(raceSpec(id), flat).place(100, 0, 0); let t = 0, next = 0, d = 0, q = 0;
const marks: Record<string, number> = {};
while (t < T) { car.step(dt, { throttle: 1, brake: 0, steer: 0 }); t += dt; d += car.speed * dt; const mph = car.speed * 2.23694;
  for (const [k, v] of [['0-60 mph', mph >= 60], ['0-100 km/h', car.speed * 3.6 >= 100], ['0-100 mph', mph >= 100]] as const) if (v && !marks[k]) marks[k] = t;
  if (!q && d >= 402.3) { q = t; marks[`1/4 mile (${Math.round(mph)} mph)`] = t; }
  if (t >= next) { next += 0.5; console.log(t.toFixed(1).padStart(5), 's', (car.speed * 3.6).toFixed(0).padStart(4), 'km/h  gear', car.gear, ' rpm', Math.round(car.rpm), ' slip', car.slipX.slice(2).map(s => s.toFixed(2)).join('/')); } }
console.log(Object.entries(marks).map(([k, v]) => `${k} ${v.toFixed(1)} s`).join(' · '));
