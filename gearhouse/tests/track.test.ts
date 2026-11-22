import { describe, it, expect } from 'vitest';
import { millbrook } from '../race/millbrook';

describe('Millbrook Outer Circuit', () => {
  const T = millbrook();
  it('is the outer circuit length and closes on itself', () => {
    expect(Math.abs(T.length - 4453)).toBeLessThan(25);
    const a = T.at(0), b = T.at(T.length - 1e-6); expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1.5);
  });
  it('turns once round, anticlockwise', () => { const total = T.nodes.reduce((s, n) => s + n.k, 0); expect(total * 180 / Math.PI).toBeCloseTo(360, 0); });
  it('banks the Members steeper and higher than the Byfleet', () => {
    const top = (name: string) => { let m = 0, slope = 0; for (const n of T.nodes) if (T.pieceAt(n.s) === name) { const z = Math.max(T.height(n.s, 15.25), T.height(n.s, -15.25)); m = Math.max(m, z); slope = Math.max(slope, Math.abs(T.slope(n.s, n.k > 0 ? -14 : 14).across)); } return { m, slope }; };
    const mem = top("Members' Banking"), byf = top('Byfleet Banking');
    expect(mem.m).toBeGreaterThan(9); expect(byf.m).toBeGreaterThan(6); expect(byf.m).toBeLessThan(mem.m);
    expect(Math.atan(mem.slope) * 180 / Math.PI).toBeGreaterThan(30); expect(Math.atan(byf.slope)).toBeLessThan(Math.atan(mem.slope));
    expect(T.height(300, 0)).toBeLessThan(0.01);                  // the home straight is flat
  });
  it('finds a point back from the world', () => {
    for (const s of [50, 900, 2000, 3500]) for (const off of [-10, 0, 12]) { const p = T.point(s, off), q = T.locate(p.x, p.y); expect(q.s).toBeCloseTo(s, 0); expect(q.off).toBeCloseTo(off, 0); }
  });
  it('rises on the inside of a left-hand banking to the outside', () => { const s = 1000; expect(T.at(s).k).toBeGreaterThan(0); expect(T.height(s, -15)).toBeGreaterThan(T.height(s, 15)); });
});
