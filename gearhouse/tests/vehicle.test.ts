import { describe, it, expect } from 'vitest';
import { raceSpec, torqueAt } from '../race/cars';
import { Vehicle, usefulLock } from '../race/vehicle';
import { Driver } from '../race/driver';
import { Track } from '../race/track';
import { millbrook } from '../race/millbrook';

const flat = new Track({ name: 'flat', pieces: [{ kind: 'straight', len: 8000, name: 'a' }, { kind: 'arc', radius: 400, turn: 180, name: 'b' }, { kind: 'straight', len: 8000, name: 'c' }, { kind: 'arc', radius: 400, turn: 180, name: 'd' }], start: { x: 0, y: 0, heading: 0 }, width: 30, easing: 30, banking: [], bumps: [], landmarks: [], joints: 12 });
const dt = 1 / 200;

describe('race cars', () => {
  it('make their rated power at their rated revs, and less either side', () => {
    for (const id of ['fordT23', 'dueSSJ35', 'bmw315']) { const c = raceSpec(id), P = (rpm: number) => torqueAt(c, rpm) * rpm * Math.PI / 30 / 745.7;
      expect(P(c.hpRpm)).toBeCloseTo(c.hp, 0); expect(P(c.hpRpm * 0.8)).toBeLessThan(c.hp); expect(P(c.hpRpm * 1.1)).toBeLessThan(c.hp); }
  });
  it('reach the top speed a road test of the day found, within 12 %', () => {
    for (const id of ['chevAB28', 'fnTT33']) { const c = raceSpec(id), car = new Vehicle(c, flat).place(100, 0, 0); let vmax = 0;
      for (let t = 0; t < 120; t += dt) { car.step(dt, { throttle: 1, brake: 0, steer: 0 }); vmax = Math.max(vmax, car.speed); }
      expect(Math.abs(vmax * 3.6 / c.topKmh - 1)).toBeLessThan(0.12); }
  });
  it('stop shorter with brakes on four wheels than on the rear two', () => {
    const stop = (id: string) => { const car = new Vehicle(raceSpec(id), flat).place(100, 0, 50 / 3.6); let d = 0; for (let t = 0; t < 30 && car.speed > 0.3; t += dt) { car.step(dt, { throttle: 0, brake: 1, steer: 0 }); d += car.speed * dt; } return d; };
    expect(stop('fordT23')).toBeGreaterThan(stop('plymU29') * 1.3);
  });
});
describe('on the Millbrook banking', () => {
  const T = millbrook();
  it('a fast car climbs the Members and holds it at speed, the tyres doing little', () => {
    const car = new Vehicle(raceSpec('dueSSJ35'), T).place(560, 0, 170 / 3.6), d = new Driver(T); let worst = 0, side = 0, n = 0;
    for (let t = 0; t < 14; t += dt) { car.step(dt, d.drive(car)); worst = Math.max(worst, Math.abs(car.off)); if (car.s > 900 && car.s < 1400) { side += Math.abs(car.tay); n++; } }
    expect(worst).toBeLessThan(T.spec.width / 2); expect(n).toBeGreaterThan(0); expect(side / n / 9.81).toBeLessThan(0.45);
  });
  it('the bump under the Members bridge lifts a fast car off its rear wheels', () => {
    const car = new Vehicle(raceSpec('dueSSJ35'), T).place(600, 0, 180 / 3.6), d = new Driver(T); let lifted = false;
    for (let t = 0; t < 4; t += dt) { car.step(dt, d.drive(car)); if (car.airborne[2] || car.airborne[3]) lifted = true; }
    expect(lifted).toBe(true);
  });
  it('the D-type matches its period figures (review 97): Le Mans speed, and the road test within its axle', () => {
    const run = (id: string, secs: number) => { const car = new Vehicle(raceSpec(id), flat).place(100, 0, 0); let t = 0, t60 = 0, vmax = 0;
      for (; t < secs; t += dt) { car.step(dt, { throttle: 1, brake: 0, steer: 0 }); if (!t60 && car.speed * 2.23694 >= 60) t60 = t; vmax = Math.max(vmax, car.speed * 3.6); } return { t60, vmax }; };
    const d = run('jagD55', 90);
    expect(d.vmax).toBeGreaterThan(270); expect(d.vmax).toBeLessThan(290);   // 278 km/h on the Mulsanne, 1955
    expect(d.t60).toBeGreaterThan(4.2); expect(d.t60).toBeLessThan(6.5);    // 4.7 s on a shorter axle (Road & Track 1956)
  });
  it('drums fade where discs hold on: six hard stops from 160 km/h', () => {
    const fade = (id: string) => { const car = new Vehicle(raceSpec(id), flat).place(100, 0, 160 / 3.6); const dist: number[] = [];
      for (let n = 0; n < 6; n++) { car.place(car.s, 0, 160 / 3.6); let d = 0; for (let k = 0; k < 8000 && car.speed > 0.3; k++) { car.step(dt, { throttle: 0, brake: 1, steer: 0 }); d += car.speed * dt; } dist.push(d); }
      return dist[5]! / dist[0]!; };
    expect(fade('napier33')).toBeGreaterThan(fade('jagD55'));
  });
  it('steers as the period did (review 100): the inner wheel more, heavy hands at a standstill, less lock asked at speed', () => {
    const car = new Vehicle(raceSpec('dueSSJ35'), flat).place(100, 0, 0);
    for (let t = 0; t < 0.3; t += dt) car.step(dt, { throttle: 0, brake: 1, steer: 1 });
    const parked = Math.abs(car.steer); expect(car.steerAt(0)).toBeGreaterThan(car.steerAt(1));   // a left turn: the left (inner) wheel turned more
    const moving = new Vehicle(raceSpec('dueSSJ35'), flat).place(100, 0, 20 / 3.6); for (let t = 0; t < 0.3; t += dt) moving.step(dt, { throttle: 0.2, brake: 0, steer: 1 });
    expect(Math.abs(moving.steer)).toBeGreaterThan(parked * 1.3);   // rolling, the tyres no longer scrub round: the hands go quicker
    expect(usefulLock(raceSpec('dueSSJ35'), 50, 0.9)).toBeLessThan(usefulLock(raceSpec('dueSSJ35'), 10, 0.9));
    expect(moving.sw / moving.steer).toBeCloseTo(17);   // the steering wheel turns by the ratio
  });
});
