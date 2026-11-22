import { describe, it, expect } from 'vitest';
import { Smoke, curl } from '../race/smoke';
describe('smoke as parcels of gas (review 107)', () => {
  it('hot smoke rises and cools, dust settles, and both fade away', () => {
    const s = new Smoke(); s.wind = [0, 0]; s.emit('tyre', 0, 0, 0.2, 0, 0, 0); s.emit('dust', 5, 0, 1.0, 0, 0, 0);
    const T0 = s.parcels[0]!.T; for (let t = 0; t < 1.5; t += 1 / 60) s.step(1 / 60);
    const [hot, dust] = s.parcels; expect(hot!.z).toBeGreaterThan(0.6); expect(hot!.T).toBeLessThan(T0 * 0.5); expect(dust!.z).toBeLessThan(1.0);
    for (let t = 0; t < 8; t += 1 / 60) s.step(1 / 60); expect(s.parcels.length).toBe(0);
  });
  it('stirs with curl noise, a field without divergence', () => {
    const e = 0.01, div = (x: number, y: number, z: number) => (curl(x + e, y, z)[0] - curl(x - e, y, z)[0] + curl(x, y + e, z)[1] - curl(x, y - e, z)[1] + curl(x, y, z + e)[2] - curl(x, y, z - e)[2]) / (2 * e);
    let worst = 0, mag = 0; for (let k = 0; k < 20; k++) { const p = [k * 0.37, k * 0.91 % 3, k * 0.53 % 2] as const; worst = Math.max(worst, Math.abs(div(...p))); mag = Math.max(mag, Math.hypot(...curl(...p))); }
    expect(mag).toBeGreaterThan(0.3); expect(worst).toBeLessThan(mag * 0.3);
  });
});
