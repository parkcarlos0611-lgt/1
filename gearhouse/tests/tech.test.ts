// Later technology (review 125), on the Bugatti EB110 GT: four-wheel drive through a viscous centre differential, a
// torque-sensing rear differential, ABS, four turbos, a speed-sensitive wing, and its period figures.
import { describe, it, expect } from 'vitest';
import { raceSpec, type RaceSpec } from '../race/cars';
import { Vehicle } from '../race/vehicle';
import { Track } from '../race/track';
const flat = new Track({ name: 'flat', pieces: [{ kind: 'straight', len: 8000, name: 'a' }, { kind: 'arc', radius: 400, turn: 180, name: 'b' }, { kind: 'straight', len: 8000, name: 'c' }, { kind: 'arc', radius: 400, turn: 180, name: 'd' }], start: { x: 0, y: 0, heading: 0 }, width: 30, easing: 30, banking: [], bumps: [], landmarks: [], joints: 12 });
/** the engine's revs set to the wheels' (the shaft turning with them, the clutch locked) */
const sync = (c: Vehicle) => { const f = c.spec.tech?.drive?.front ?? 0, wd = f * (c.w[0]! + c.w[1]!) / 2 + (1 - f) * (c.w[2]! + c.w[3]!) / 2; c.rpm = wd * c.spec.gears[c.gear - 1]! * c.spec.final * 30 / Math.PI; };
const dt = 1 / 200, eb = raceSpec('eb110'), go = { throttle: 1, brake: 0, steer: 0 };
const launch = (s: RaceSpec) => { const c = new Vehicle(s, flat).place(100, 0, 0); let t = 0, spin = 0; for (; t < 10 && c.speed * 3.6 < 100; t += dt) { c.step(dt, go); if (c.speed > 5) spin = Math.max(spin, c.slipX[2]!); }   /* once rolling (from rest any slip reads large) */ return { t, spin }; };
describe('the EB110 GT', () => {
  it('meets its period figures: about 340 km/h, 0-100 km/h near four seconds', () => {
    const c = new Vehicle(eb, flat).place(100, 0, 0); let vmax = 0; for (let t = 0; t < 70; t += dt) { c.step(dt, go); vmax = Math.max(vmax, c.speed * 3.6); }
    expect(vmax).toBeGreaterThan(325); expect(vmax).toBeLessThan(355); const l = launch(eb); expect(l.t).toBeGreaterThan(3.3); expect(l.t).toBeLessThan(4.4);
  });
  it('puts its power down on four wheels where the rears alone spin', () => {
    const awd = launch(eb), rwd = launch({ ...eb, tech: { ...eb.tech!, drive: undefined } });
    expect(awd.spin).toBeLessThan(rwd.spin / 5);   /* a brief slip as the clutch bites after a change, against the rears alone spinning up */ expect(rwd.spin).toBeGreaterThan(0.5); expect(awd.t).toBeLessThan(rwd.t);
  });
  it('the viscous coupling sends torque forward when the rears slip ahead', () => {
    const mk = (visc: number) => { const c = new Vehicle({ ...eb, tech: { ...eb.tech!, drive: { front: 0.27, visc } } }, flat).place(100, 0, 10); c.w[2] = c.w[3] = c.w[2]! * 1.3; sync(c); c.step(1 / 1000, go); return c; };
    const a = mk(60), b = mk(0); expect(a.Tw[0]! - b.Tw[0]!).toBeGreaterThan(100); expect(a.Tw[2]! - b.Tw[2]!).toBeLessThan(-100);   // what it takes from the rear it gives the front
  });
  it('the rear differential sends torque to the slower wheel, up to its bias', () => {
    const c = new Vehicle(eb, flat).place(100, 0, 10); c.w[2] = c.w[2]! * 1.2; sync(c); c.step(1 / 1000, go); expect(c.Tw[3]!).toBeGreaterThan(c.Tw[2]!); expect(c.Tw[3]! / c.Tw[2]!).toBeLessThanOrEqual(2.5 + 1e-6);
  });
  it('stops shorter with ABS, which keeps the wheels turning', () => {
    const stop = (s: RaceSpec) => { const c = new Vehicle(s, flat).place(100, 0, 100 / 3.6); let d = 0, locked = 0; for (let k = 0; k < 4000 && c.speed > 0.3; k++) { c.step(dt, { throttle: 0, brake: 1, steer: 0 }); d += c.speed * dt; if (c.w[0] === 0 && c.speed > 3) locked++; } return { d, locked }; };
    const a = stop(eb), b = stop({ ...eb, tech: { ...eb.tech!, abs: false } }); expect(a.d).toBeLessThan(b.d * 0.95); expect(a.locked).toBeLessThan(b.locked);
  });
  it('the turbos take time to blow (the lag) and fall back when the throttle shuts', () => {
    const c = new Vehicle(eb, flat).place(100, 0, 30); for (let t = 0; t < 1; t += dt) c.step(dt, { throttle: 0.05, brake: 0, steer: 0 }); const b0 = c.boost;
    for (let t = 0; t < 0.15; t += dt) c.step(dt, go); const b1 = c.boost; for (let t = 0; t < 2; t += dt) c.step(dt, go); const b2 = c.boost; for (let t = 0; t < 1.5; t += dt) c.step(dt, { throttle: 0, brake: 0, steer: 0 });
    expect(b0).toBeLessThan(0.15); expect(b1).toBeLessThan(0.6); expect(b2).toBeGreaterThan(0.9); expect(c.boost).toBeLessThan(0.3);
  });
  it('raises its wing at speed and stows it when slow, pressing the rear down', () => {
    const c = new Vehicle(eb, flat).place(100, 0, 150 / 3.6); for (let t = 0; t < 2; t += dt) c.step(dt, { throttle: 0.4, brake: 0, steer: 0 }); expect(c.wing).toBeGreaterThan(0.9); const rear = c.load[2]! + c.load[3]!;
    const d = new Vehicle({ ...eb, tech: { ...eb.tech!, wing: { ...eb.tech!.wing!, clA: 0 } } }, flat).place(100, 0, 150 / 3.6); for (let t = 0; t < 2; t += dt) d.step(dt, { throttle: 0.4, brake: 0, steer: 0 }); expect(rear).toBeGreaterThan(d.load[2]! + d.load[3]!);
    for (let t = 0; t < 8; t += dt) c.step(dt, { throttle: 0, brake: 0.6, steer: 0 }); expect(c.wing).toBeLessThan(0.1);
  });
});
