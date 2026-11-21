import { describe, expect, it } from 'vitest';
import { Rig, UTILITY48 } from '../physics/rig';

describe('running-gear rig (review 24)', () => {
  it('settles on its springs and tyres without blowing up', () => {
    const r = new Rig(UTILITY48, { near: () => 0, far: () => 0 }, 0); r.run(1.5);
    expect(Number.isFinite(r.y)).toBe(true);
    const sag = UTILITY48.wheelR - r.ay[0]; expect(sag).toBeGreaterThan(0.01); expect(sag).toBeLessThan(0.06);       // tyre squash under load
    expect(Math.abs(r.th)).toBeLessThan(0.01); expect(r.tyres.every(t => t.contact > 0)).toBe(true);
  });
  it('rolls the body when only the near wheels climb a bump, and drives forward', () => {
    const bump = (x: number) => (x > 3 && x < 3.4 ? 0.12 * Math.sin((x - 3) / 0.4 * Math.PI) : 0);
    const r = new Rig(UTILITY48, { near: bump, far: () => 0 }, 1); r.run(0.5); r.throttle = 0.6; let maxRoll = 0;
    for (let i = 0; i < 60; i++) { r.run(0.05); maxRoll = Math.max(maxRoll, Math.abs(r.ph)); }
    expect(r.x).toBeGreaterThan(4); expect(maxRoll).toBeGreaterThan(0.005); expect(Number.isFinite(r.vx)).toBe(true);
  });
  it('drives on soft sand and over the course dunes (a sinking tyre is not pushed backwards)', async () => {
    const { SOILS } = await import('../physics/rig'); const { COURSE } = await import('../ui/course');
    const flat = new Rig(UTILITY48, { near: () => 0, far: () => 0, soil: () => SOILS.sand! }, 0); flat.run(0.8); flat.maxTorque = 1500; flat.throttle = 1; flat.run(2);
    expect(flat.vx).toBeGreaterThan(1.5);
    const dune = new Rig(UTILITY48, COURSE, 43); dune.run(0.8); dune.maxTorque = 1500; for (let i = 0; i < 60; i++) { dune.throttle = dune.vx < 5 ? 1 : 0; dune.run(0.1); }
    expect(dune.x).toBeGreaterThan(60);
  });
});
