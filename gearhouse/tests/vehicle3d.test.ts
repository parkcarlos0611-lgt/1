// The car in 3D (review 120): a body free in all six ways on its axles and tyres; collisions between cars as boxes.
import { describe, it, expect } from 'vitest';
import { raceSpec } from '../race/cars';
import { Vehicle } from '../race/vehicle';
import { Track } from '../race/track';
import { millbrook } from '../race/millbrook';
import { touch } from '../race/race';

const flat = (bumps: { s: number; height: number; len: number }[] = []) => new Track({ name: 'flat', pieces: [{ kind: 'straight', len: 4000, name: 'a' }, { kind: 'arc', radius: 100, turn: 180, name: 'b' }, { kind: 'straight', len: 4000, name: 'c' }, { kind: 'arc', radius: 100, turn: 180, name: 'd' }], start: { x: 0, y: 0, heading: 0 }, width: 40, easing: 10, banking: [], bumps, landmarks: [], joints: 12 });
const dt = 1 / 200, idle = { throttle: 0, brake: 0, steer: 0 };

describe('the car as a body in 3D', () => {
  it('stands level, its tyres carrying its whole weight', () => {
    for (const id of ['dueSSJ35', 'mb540k', 'jagD55']) { const c = new Vehicle(raceSpec(id), flat()).place(100, 0, 0);
      for (let t = 0; t < 2; t += dt) c.step(dt, { ...idle, brake: 1 });
      const sum = c.load.reduce((a, b) => a + b, 0); expect(Math.abs(sum / (c.spec.mass * 9.81) - 1)).toBeLessThan(0.01);
      expect(Math.abs(c.pitch)).toBeLessThan(0.01); expect(Math.abs(c.roll)).toBeLessThan(0.001); expect(Math.abs(c.zb)).toBeLessThan(0.01); }
  });
  it('squats as it pulls away and dives as it brakes', () => {
    const c = new Vehicle(raceSpec('dueSSJ35'), flat()).place(100, 0, 0); for (let t = 0; t < 2; t += dt) c.step(dt, { ...idle, throttle: 1 }); expect(c.pitch).toBeGreaterThan(0.004);
    for (let t = 0; t < 0.8; t += dt) c.step(dt, { ...idle, brake: 1 }); expect(c.pitch).toBeLessThan(-0.004);
  });
  it('leaves the ground over a sharp crest at speed and lands on its wheels', () => {
    const c = new Vehicle(raceSpec('dueSSJ35'), flat([{ s: 300, height: 0.8, len: 10 }])).place(200, 0, 140 / 3.6); let air = 0, upset = false;
    for (let t = 0; t < 6; t += dt) { c.step(dt, { ...idle, throttle: 0.3 }); if (c.airborne.every(Boolean)) air += dt; upset ||= c.upset; }
    expect(air).toBeGreaterThan(0.1); expect(upset).toBe(false); expect(c.airborne.some(Boolean)).toBe(false);
  });
  it('goes over the top of a banking taken far too fast, and falls down its earth bank', () => {
    const T = millbrook(), b = T.spec.banking[1]!, s = (b.s0 + b.s1) / 2, out = T.outerSide(s), W2 = T.spec.width / 2;
    const c = new Vehicle(raceSpec('napier33'), T).place(s - 200, out * (W2 - 3), 75); let over = false, fell = false;
    for (let t = 0; t < 8 && !fell; t += dt) { c.step(dt, { ...idle, throttle: 1 }); over ||= c.over; if (Math.abs(c.off) > W2 + 4 && c.base[2] < T.height(c.s, out * W2) - 1.5) fell = true; }
    expect(over).toBe(true); expect(fell).toBe(true);
  });
  it('rolls over when thrown onto its side, and knows it is upset', () => {
    const c = new Vehicle(raceSpec('fordT23'), flat()).place(100, 0, 0); c.om[0] = 6; c.v[2] = 3;
    for (let t = 0; t < 4; t += dt) c.step(dt, idle); expect(c.upset).toBe(true);
  });
  it('rolls its beam axles against their springs in a turn; a swing axle leans its wheels and lifts the car', () => {
    const turn = (id: string) => { const c = new Vehicle(raceSpec(id), flat()).place(4000 + 157 / 2, 0, 18); let zb = 0, n = 0;
      for (let t = 0; t < 6; t += dt) { c.step(dt, { throttle: 0.25, brake: 0, steer: 0.5 }); if (t > 3) { zb += c.zb; n++; } } return { c, zb: zb / n }; };
    const beam = turn('dueSSJ35'), swing = turn('mb540k');
    expect(Math.abs(beam.c.axles[0].d[1])).toBeGreaterThan(1e-4);   // the front axle rolled against its leaves
    expect(Math.abs(swing.c.camber[2]! - swing.c.camber[3]!)).toBeGreaterThan(0.01);   // the swing axle's wheels lean apart
    expect(swing.zb).toBeGreaterThan(beam.zb);   // jacked up
  });
  it('builds its side force as the tyre rolls (the relaxation length), not at once', () => {
    // at walking pace the tyre needs a few tenths of a metre of rolling, a good part of a tenth of a second
    const c = new Vehicle(raceSpec('dueSSJ35'), flat()).place(100, 0, 3); for (let t = 0; t < 1; t += dt) c.step(dt, { ...idle, throttle: 0.05 });
    c.steer = 0.15; c.sw = 0.15 * 17; const fy: number[] = []; for (let k = 0; k < 20; k++) { c.step(dt, { ...idle, throttle: 0.05, steer: 0.15 / (c.spec.steerLock * Math.PI / 180) }); fy.push(Math.abs(c.tfy[0]!)); }
    expect(fy[0]!).toBeLessThan(fy[8]! * 0.6);
  });
  it('two cars meeting push apart, trade speed, and the struck one turns', () => {
    const T = flat(), a = new Vehicle(raceSpec('chevAB28'), T).place(500, 0, 0), b = new Vehicle(raceSpec('chevAB28'), T).place(500, 4, 0);
    for (let t = 0; t < 0.5; t += dt) { a.step(dt, idle); b.step(dt, idle); }
    a.vy = 10; let p0 = NaN, hits = 0;   // a sideways into b, off its middle
    b.x += 1.2; let peakV = 0, peakR = 0, p1 = NaN;
    for (let t = 0; t < 1; t += dt) { a.step(dt, idle); b.step(dt, idle); const pb = a.spec.mass * a.vy + b.spec.mass * b.vy, h = touch(a, b); if (h && Number.isNaN(p1)) { p0 = pb; p1 = a.spec.mass * a.vy + b.spec.mass * b.vy; } hits += h; peakV = Math.max(peakV, b.vy); peakR = Math.max(peakR, Math.abs(b.r)); }
    expect(hits).toBeGreaterThan(0); expect(peakV).toBeGreaterThan(1.5);   /* a has scrubbed some of its 10 m/s over the gap on its tyres; an off-centre blow */ expect(peakR).toBeGreaterThan(0.05);
    expect(Math.abs(p1 / p0 - 1)).toBeLessThan(0.1);   // the blow itself keeps the momentum (the tyres take it away after)
  });
});
