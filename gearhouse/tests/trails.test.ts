import { describe, it, expect } from 'vitest';
import { trailLook, Trail, ribbon, CarTrails, toWorld, anchorsOf, TRAIL, RIBBON_FLOATS, SPEED_FX } from '../render/live/trails';
import { placeMesh } from '../render/live/gpu';

/** a car driven straight east at kmh for `secs`, its trails stepped at 60 Hz: the vertices of the last frame */
function drive(kmh: number, secs: number, brake = 0, level = 1, day = 1) {
  const ct = new CarTrails({ tips: [[4200, 760, 880], [4200, -760, 880]], lamps: [[4260, 560, 620], [4260, -560, 620]] }); let out: number[] = [];
  for (let f = 0; f <= secs * 60; f++) { const t = f / 60; out = []; ct.step(t, { len: 4260, x: kmh / 3.6 * t, y: 0, z: 0, yaw: 0, roll: 0, pitch: 0, kmh, brake }, level, day, out); }
  return { ct, out };
}

describe('speed effects (trails)', () => {
  it('stays off when slow and fades in from about 80 km/h', () => {
    expect(trailLook(40, 0, 1).air.k).toBe(0); expect(trailLook(TRAIL.onKmh, 0, 1).air.k).toBe(0); expect(trailLook(TRAIL.onKmh, 1, 1).lamp.k).toBe(0);
    const a = trailLook(100, 0, 1).air.k, b = trailLook(130, 0, 1).air.k, c = trailLook(200, 0, 1).air.k;
    expect(a).toBeGreaterThan(0); expect(b).toBeGreaterThan(a); expect(c).toBeCloseTo(TRAIL.airA, 5);
    expect(drive(50, 1).out.length).toBe(0);
  });
  it('grows longer with speed, between 0.3 and 0.6 s', () => {
    expect(trailLook(90, 0, 1).air.life).toBeGreaterThanOrEqual(0.3); expect(trailLook(300, 0, 1).air.life).toBeCloseTo(0.6, 5);
    expect(trailLook(200, 0, 1).air.life).toBeGreaterThan(trailLook(120, 0, 1).air.life);
    // the kept history follows the length: about the life, not the whole drive
    const { ct } = drive(200, 2); expect(ct.tr[0]!.span(2)).toBeLessThan(trailLook(200, 0, 1).life + 0.1); expect(ct.tr[0]!.span(2)).toBeGreaterThan(0.4);
  });
  it('brightens and lengthens the lamps under braking, not the air', () => {
    const off = trailLook(150, 0, 1, 0.5), on = trailLook(150, 1, 1, 0.5);
    expect(on.lamp.k).toBeGreaterThan(off.lamp.k * 1.5); expect(on.lamp.life).toBeGreaterThan(off.lamp.life); expect(on.air.k).toBe(off.air.k);
    expect(trailLook(150, 0, 1, 1).lamp.k).toBeLessThan(trailLook(150, 0, 1, 0).lamp.k);   // faint by day
  });
  it('follows the setting and thins in smoke', () => {
    expect(trailLook(200, 0, SPEED_FX.off).air.k).toBe(0); expect(drive(200, 1, 0, 0).out.length).toBe(0);
    expect(trailLook(200, 0, SPEED_FX.weak).air.k).toBeLessThan(trailLook(200, 0, SPEED_FX.mid).air.k);
    expect(trailLook(200, 0, 1, 1, 1).air.k).toBeLessThan(trailLook(200, 0, 1, 1, 0).air.k * 0.5);
  });
  it('draws a tapering, fading ribbon behind the car', () => {
    const { out } = drive(200, 1); expect(out.length % RIBBON_FLOATS).toBe(0); expect(out.length).toBeGreaterThan(0);
    const n = out.length / RIBBON_FLOATS; let maxA = 0; for (let i = 0; i < n; i++) { maxA = Math.max(maxA, out[i * RIBBON_FLOATS + 7]!); expect(out[i * RIBBON_FLOATS]!).toBeLessThanOrEqual(200 / 3.6 + 1e-3); }
    expect(maxA).toBeLessThanOrEqual(TRAIL.airA + 1e-6);
    const tr = new Trail(); for (let k = 0; k < 10; k++) tr.push(k * 0.02, k, 0, 0, 1);
    const o: number[] = []; ribbon(tr, 0.18, { k: 1, life: 0.3, w: 0.02 }, 0, o);
    const oldest = o.slice(0, RIBBON_FLOATS), newest = o.slice(o.length - RIBBON_FLOATS);
    expect(Math.abs(newest[6]!)).toBeGreaterThan(Math.abs(oldest[6]!)); expect(newest[7]!).toBeGreaterThan(oldest[7]!);
  });
  it('places anchors as the renderer places the mesh', () => {
    const p: [number, number, number] = [4200, 760, 880], M = placeMesh(4260, 3, -2, 0.4, 0.7), w = toWorld(p, 4260, 3, -2, 0.4, 0.7, 0, 0);
    const e = [0, 1, 2].map(r => M[r]! * p[0] + M[4 + r]! * p[1] + M[8 + r]! * p[2] + M[12 + r]!);
    for (let i = 0; i < 3; i++) expect(w[i]!).toBeCloseTo(e[i]!, 6);
  });
  it('finds a kit car\'s rear corners from its bounds', () => {
    const pos = new Float32Array([0, -800, 0, 0, 800, 0, 0, 0, 1200, 4000, -850, 300, 4000, 850, 300, 4000, 0, 1000, 3900, 850, 900, 3900, -850, 900, 3950, 0, 700]);
    const A = anchorsOf({ n: 3, pos, length: 4000 } as never);
    expect(A.tips[0][1]).toBeGreaterThan(700); expect(A.tips[1][1]).toBeLessThan(-700); expect(A.tips[0][2]).toBeGreaterThan(800); expect(A.lamps[0][0]).toBeGreaterThan(3900);
  });
});
