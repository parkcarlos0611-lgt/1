import { describe, it, expect } from 'vitest';
import { TyreRing, NODES } from '../race/tyre';

const run = (ring: TyreRing, load: number, ground: (x: number) => number, secs = 0.5, fy = 0) => { for (let t = 0; t < secs; t += 1 / 200) ring.step(1 / 200, load, 0, fy, ground); return ring; };
describe('the tyre as a ring of nodes (review 101)', () => {
  it('flattens under its load on the road, the patch widening as the load grows, round again in the air', () => {
    const flat = () => 0, r = run(new TyreRing(0.42, 5000), 5000, flat);
    expect(r.u[0]!).toBeCloseTo(r.rest, 3);                       // the bottom node gives by the standing sag
    expect(r.u[NODES / 2]!).toBeLessThan(0.002);                  // the top stays round
    const patch = (g: TyreRing) => [...g.u].filter(v => v > g.rest * 0.5).length, heavy = run(new TyreRing(0.42, 5000), 9000, flat);
    expect(patch(heavy)).toBeGreaterThan(patch(r));
    const air = run(new TyreRing(0.42, 5000), 0, flat, 1); expect(Math.max(...air.u)).toBeLessThan(0.001);
  });
  it('wraps over a ridge in the road smoothly: the nodes over it pressed in more, no sharp step between neighbours', () => {
    const ridge = (x: number) => Math.max(0, 0.02 * (1 - Math.abs(x - 0.05) / 0.06)), r = run(new TyreRing(0.42, 5000), 5000, ridge);
    const at = (a: number) => r.at(a), ahead = at(0.12), behind = at(-0.12); expect(ahead).toBeGreaterThan(behind + 0.005);
    let worst = 0; for (let k = 0; k < NODES; k++) worst = Math.max(worst, Math.abs(r.u[k]! - r.u[(k + 1) % NODES]!)); expect(worst).toBeLessThan(0.02);
  });
  it('lets its patch be pulled across by the side force', () => { const r = run(new TyreRing(0.42, 5000), 5000, () => 0, 0.5, 4000); expect(r.sy).toBeGreaterThan(0.01); });
});
