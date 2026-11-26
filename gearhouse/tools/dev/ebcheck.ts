// EB110 technology check (review 125): launch with and without four-wheel drive, ABS stop vs locked, the boost's lag, the wing.
import { raceSpec, type RaceSpec } from '../../race/cars';
import { Vehicle } from '../../race/vehicle';
import { Track } from '../../race/track';
const flat = new Track({ name: 'flat', pieces: [{ kind: 'straight', len: 8000, name: 'a' }, { kind: 'arc', radius: 400, turn: 180, name: 'b' }, { kind: 'straight', len: 8000, name: 'c' }, { kind: 'arc', radius: 400, turn: 180, name: 'd' }], start: { x: 0, y: 0, heading: 0 }, width: 30, easing: 30, banking: [], bumps: [], landmarks: [], joints: 12 });
const dt = 1 / 200, base = raceSpec('eb110');
const run = (spec: RaceSpec, label: string) => { const c = new Vehicle(spec, flat).place(100, 0, 0); let t = 0, t100 = 0, t200 = 0, vmax = 0, spin = 0, wingAt = 0;
  for (; t < 80; t += dt) { c.step(dt, { throttle: 1, brake: 0, steer: 0 }); const v = c.speed * 3.6; if (!t100 && v >= 100) t100 = t; if (!t200 && v >= 200) t200 = t; vmax = Math.max(vmax, v); if (t < 3) spin = Math.max(spin, c.slipX[2]!); if (!wingAt && c.wing > 0.5) wingAt = v; }
  const s = new Vehicle(spec, flat).place(100, 0, 100 / 3.6); let d = 0, absT = 0; for (let k = 0; k < 4000 && s.speed > 0.3; k++) { s.step(dt, { throttle: 0, brake: 1, steer: 0 }); d += s.speed * dt; if (s.absOn) absT += dt; }
  console.log(label.padEnd(18), '0-100', t100.toFixed(2), '0-200', t200.toFixed(1), 'top', vmax.toFixed(0), 'rear slip max', spin.toFixed(2), 'stop100', d.toFixed(1), 'm (ABS', absT.toFixed(1), 's)', 'wing up at', wingAt.toFixed(0)); };
run(base, 'EB110 GT');
run({ ...base, tech: { ...base.tech!, drive: undefined } }, 'rear drive only');
run({ ...base, tech: { ...base.tech!, abs: false } }, 'no ABS');
run({ ...base, tech: { ...base.tech!, turbo: undefined }, hp: Math.round(base.hp / 2.05) }, 'unblown');
// the boost's lag: at 2500 rpm in 3rd, throttle snapped open
{ const c = new Vehicle(base, flat).place(100, 0, 2500 / 60 * 2 * Math.PI * base.tyreR / (base.gears[2]! * base.final)); c.auto = false; c.gear = 3; const pts: string[] = [];
  for (let t = 0; t < 3; t += dt) { c.step(dt, { throttle: 1, brake: 0, steer: 0, gear: 3 }); if (Math.round(t * 200) % 50 === 0) pts.push(`${t.toFixed(2)}s ${(c.boost * base.tech!.turbo!.boost).toFixed(2)}bar ${Math.round(c.rpm)}`); } console.log('boost from 2500 rpm in 3rd:', pts.join(' | ')); }
