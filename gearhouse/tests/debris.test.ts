import { describe, it, expect } from 'vitest';
import { Debris } from '../race/debris';
describe('the fence pieces as bodies (review 112)', () => {
  it('fly, fall, bounce and come to rest lying on the ground; a car kicks them on', () => {
    const d = new Debris(); d.add({ kind: 'post', len: 1, x: 0, y: 0, z: 1, vx: 6, vy: 0, vz: 3, yaw: 0, pitch: 0, roll: 0, wy: 3, wp: 8, wr: 2, life: 60 });
    let top = 0; for (let t = 0; t < 6; t += 1 / 60) { d.step(1 / 60, () => 0); top = Math.max(top, d.pieces[0]!.z); }
    const p = d.pieces[0]!; expect(top).toBeGreaterThan(1.2); expect(p.z).toBeLessThan(0.2); expect(Math.hypot(p.vx, p.vy)).toBeLessThan(0.3); expect(p.x).toBeGreaterThan(1);
    const x0 = p.x; for (let t = 0; t < 1; t += 1 / 60) d.step(1 / 60, () => 0, [{ x: x0 - 0.5, y: 0, vx: 20, vy: 0, r: 2 }]); expect(d.pieces[0]!.x).toBeGreaterThan(x0 + 2);
  });
});
