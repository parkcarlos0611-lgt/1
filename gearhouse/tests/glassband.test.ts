import { describe, expect, test } from 'vitest';
import { bandAngle, bandE, glassBand, paneSlant, type V3, type BandIn } from '../render/live/glassband';

const norm = (a: V3): V3 => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
const SUN = norm([-0.45, 0.35, 0.82]);
/** a car standing still (its axes the world's): the windscreen lying back toward the nose (+x), a side window on the right (-y) */
const SCREEN = norm([0.3, 0, 0.95]), SIDE = norm([0, -0.9, 0.45]);   // as the NSX's
const at = (n: V3, v: V3, p: V3, o: Partial<BandIn> = {}): BandIn => ({ n, v, sun: SUN, no: n, p, carH: 1.17, k: 1, ...o });
/** toward the eye from a heading round the car (0 from the nose, +pi/2 from the left) and a height (radians) */
const eye = (yaw: number, pitch: number): V3 => [Math.cos(yaw) * Math.cos(pitch), Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch)];

describe('the toon glass reflection (docs/systems/104 A-3)', () => {
  test('the same point of glass changes with the view: the band is not stuck to the pane', () => {
    const p: V3 = [-200, -700, 950];
    const es = [eye(-0.6, 0.1), eye(-1.57, 0.1), eye(-2.5, 0.3), eye(-1.57, 0.8)].map(v => bandE(SIDE, v, SIDE, p, 1.17));
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) expect(Math.abs(es[i]! - es[j]!)).toBeGreaterThan(0.02);
    // and with the car turned under a still eye: its normals turn with it
    const turn = (a: V3, t: number): V3 => [a[0] * Math.cos(t) - a[1] * Math.sin(t), a[0] * Math.sin(t) + a[1] * Math.cos(t), a[2]];
    const v = eye(-1.3, 0.2), e0 = bandE(SIDE, v, SIDE, p, 1.17), e1 = bandE(turn(SIDE, 0.5), v, SIDE, p, 1.17);
    expect(Math.abs(e1 - e0)).toBeGreaterThan(0.05);
    // the colour follows
    const a = glassBand(at(SIDE, eye(-1.0, 0.05), p)), b = glassBand(at(SIDE, eye(-1.57, 0.7), p));
    expect(a.step).not.toBe(b.step);
  });
  test('head-on the glass is clear (the cabin seen), at a glancing angle it mirrors', () => {
    const p: V3 = [0, -700, 1100], head = glassBand(at(SIDE, SIDE, p)), glance = glassBand(at(SIDE, norm([0.85, -0.45, 0.28]), p));
    expect(head.a).toBeLessThan(0.7); expect(glance.a).toBeGreaterThan(head.a + 0.1);
    expect(glassBand(at(SIDE, SIDE, p, { k: 0 })).a).toBeLessThan(0.4);   // the tint alone: the cabin seen through
    expect(head.fres).toBeLessThan(0.15); expect(glance.fres).toBeGreaterThan(0.3);
  });
  test('the windscreen and the side window put the band at different angles', () => {
    expect(paneSlant(SCREEN)).toBeLessThan(0.05); expect(paneSlant(SIDE)).toBeGreaterThan(0.5);
    const ws = bandAngle(SCREEN), sd = bandAngle(SIDE);
    expect(Math.abs(ws)).toBeLessThan(0.05);   // near level
    expect(sd).toBeGreaterThan(0.3);            // aslant
    expect(bandAngle(norm([-0.6, 0, 0.8]))).toBeCloseTo(ws, 2);   // the rear window like the windscreen
  });
  test('the steps are cut, not graded: two or three values over the glass (the sun glint apart)', () => {
    const seen = new Set<string>();
    for (let y = -900; y <= 900; y += 30) for (let z = 750; z <= 1150; z += 20) for (const v of [eye(-1.2, 0.15), eye(-1.9, 0.35)]) {
      const r = glassBand(at(SIDE, v, [y * 0.3, -700, z], { sh: 0 })); seen.add(r.step.toFixed(3)); }
    expect([...seen].sort()).toEqual(expect.arrayContaining(['1.000']));
    expect(seen.size).toBeGreaterThanOrEqual(2); expect(seen.size).toBeLessThanOrEqual(3);
    for (const s of seen) expect(['0.000', '1.000', '2.000']).toContain(s);
    // with an edge width, the values between only on a thin edge
    const between = [] as number[]; for (let z = 600; z <= 1200; z += 1) { const st = glassBand(at(SIDE, eye(-1.57, 0.1), [0, -700, z], { w: 0.004 })).step; if (st % 1 > 0.01 && st % 1 < 0.99) between.push(z); }
    expect(between.length).toBeLessThan(12);
  });
  test('the setting: off leaves only the tint, weak less than as made; the sun glint where the ray meets the sun', () => {
    const p: V3 = [0, -700, 950], v = norm([0.8, -0.5, 0.2]);
    const off = glassBand(at(SIDE, v, p, { k: 0 })), weak = glassBand(at(SIDE, v, p, { k: 0.5 })), full = glassBand(at(SIDE, v, p, { k: 1 }));
    expect(off.a).toBeLessThan(weak.a); expect(weak.a).toBeLessThan(full.a); expect(off.sun).toBe(0);
    // the eye placed so the pane mirrors the sun to it
    const n = SIDE, d = SUN[0] * n[0] + SUN[1] * n[1] + SUN[2] * n[2], vs = norm([2 * d * n[0] - SUN[0], 2 * d * n[1] - SUN[1], 2 * d * n[2] - SUN[2]]);
    if (d > 0) { const g = glassBand(at(n, vs, p)); expect(g.sun).toBe(1); expect(g.a).toBe(1); }
    else { const flip: V3 = [-n[0], -n[1], n[2]], d2 = SUN[0] * flip[0] + SUN[1] * flip[1] + SUN[2] * flip[2], v2 = norm([2 * d2 * flip[0] - SUN[0], 2 * d2 * flip[1] - SUN[1], 2 * d2 * flip[2] - SUN[2]]);
      const g = glassBand(at(flip, v2, p, { no: flip })); expect(g.sun).toBe(1); expect(g.a).toBe(1); }
    expect(glassBand(at(SIDE, v, p, { sh: 0 })).sun).toBe(0);   // in shadow, none
  });
});
