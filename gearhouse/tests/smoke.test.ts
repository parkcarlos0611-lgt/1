import { describe, it, expect, vi } from 'vitest';
import { Smoke, curl } from '../race/smoke';
describe('smoke as parcels of gas (review 107)', () => {
  it('hot smoke rises and cools, dust settles, and both fade away', () => {
    const s = new Smoke(); s.wind = [0, 0]; s.emit('tyre', 0, 0, 0.2, 0, 0, 0); s.emit('dust', 5, 0, 1.0, 0, 0, 0);
    const T0 = s.parcels[0]!.T; for (let t = 0; t < 1.5; t += 1 / 60) s.step(1 / 60);
    const [hot, dust] = s.parcels; expect(hot!.z - hot!.r * 0.5).toBeGreaterThan(0.4); expect(hot!.T).toBeLessThan(T0 * 0.5); expect(dust!.z - dust!.r * 0.5).toBeLessThan(0.1);   // the hot off the ground, the dust down on it
    for (let t = 0; t < 6; t += 1 / 60) s.step(1 / 60); expect(s.parcels.length).toBe(2);   // lingers (docs/systems/103): still there after 7.5 s
    expect(s.parcels[0]!.r).toBeGreaterThan(2.5);   // and grown to a cloud metres across
    for (let t = 0; t < 20; t += 1 / 60) s.step(1 / 60); expect(s.parcels.length).toBe(0);
  });
  it('is bored through by a car: the parcels in its box shoved out sideways or over it, shrunk, a gap left', () => {
    const cloud = () => { const s = new Smoke(); s.wind = [0, 0]; for (let k = 0; k < 40; k++) s.emit('tyre', 10 + (k % 10) * 0.5, -1.5 + Math.floor(k / 10), 0.6, 0, 0, 0); return s; };
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.5), s = cloud(), ref = cloud(); rnd.mockRestore();
    for (let t = 0; t < 1; t += 1 / 60) { s.step(1 / 60); ref.step(1 / 60); }
    const car = { x: 4, y: 0, z: 0, yaw: 0, vx: 15, vy: 0, len: 4.4, width: 1.8, height: 1.3 };
    for (let t = 0; t < 0.8; t += 1 / 60) { car.x += car.vx / 60; s.cars = [car]; s.step(1 / 60); ref.step(1 / 60); }
    const inBox = s.parcels.filter(p => Math.abs(p.x - car.x) < 2.2 && Math.abs(p.y) < 0.9 && p.z < 1.3); expect(inBox).toHaveLength(0);
    const lane = s.parcels.filter(p => p.x > 10 && p.x < 14 && Math.abs(p.y) < 0.9 && p.z < 1.3); expect(lane).toHaveLength(0);   // the car's lane through the cloud empty behind it
    expect(s.parcels.some(p => Math.abs(p.vy) > 3 || p.vz > 3)).toBe(true); expect(s.parcels).toHaveLength(40); expect(s.parcels.filter((p, i) => p.r < ref.parcels[i]!.r * 0.9).length).toBeGreaterThan(5);   // shrunk where shoved
  });
  it('stirs with curl noise, a field without divergence', () => {
    const e = 0.01, div = (x: number, y: number, z: number) => (curl(x + e, y, z)[0] - curl(x - e, y, z)[0] + curl(x, y + e, z)[1] - curl(x, y - e, z)[1] + curl(x, y, z + e)[2] - curl(x, y, z - e)[2]) / (2 * e);
    let worst = 0, mag = 0; for (let k = 0; k < 20; k++) { const p = [k * 0.37, k * 0.91 % 3, k * 0.53 % 2] as const; worst = Math.max(worst, Math.abs(div(...p))); mag = Math.max(mag, Math.hypot(...curl(...p))); }
    expect(mag).toBeGreaterThan(0.3); expect(worst).toBeLessThan(mag * 0.3);
  });
});
