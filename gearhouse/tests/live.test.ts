import { describe, it, expect } from 'vitest';
import { placeMesh, mul, rot, translate } from '../render/live/gpu';
import { groundData, fenceData } from '../render/live/ground';
import { millbrook } from '../race/millbrook';
import { millbrookScenery } from '../race/scenery';

const apply = (m: Float32Array, p: [number, number, number]) => [0, 1, 2].map(r => m[r]! * p[0] + m[4 + r]! * p[1] + m[8 + r]! * p[2] + m[12 + r]!);
describe('the live renderer (review 99)', () => {
  it('puts a mesh nose-first along its heading, its middle on the point, +y to the left as the baked pictures do', () => {
    const m = placeMesh(4000, 10, 20, 0, Math.PI / 2);   // heading north
    const nose = apply(m, [0, 0, 0]), tail = apply(m, [4000, 0, 0]), mid = apply(m, [2000, 0, 0]), side = apply(m, [2000, 800, 1000]);
    expect(mid[0]).toBeCloseTo(10); expect(mid[1]).toBeCloseTo(20); expect(nose[1]! - tail[1]!).toBeCloseTo(4);   // 4 m long, nose to the north
    expect(side[0]).toBeCloseTo(10 - 0.8); expect(side[2]).toBeCloseTo(1);   // +y west of a car heading north: its left
  });
  it('turns a front wheel about its upright (left lock: the front of the wheel to the left)', () => {
    const steer = mul(translate(500, 700, 400), rot('z', -0.3)), front = apply(mul(placeMesh(4000, 0, 0, 0, Math.PI / 2), steer), [-300, 0, 0]), hub = apply(placeMesh(4000, 0, 0, 0, Math.PI / 2), [500, 700, 400]);
    expect(front[0]!).toBeLessThan(hub[0]!);   // heading north, a left turn: the wheel's front goes west
  });
  it('builds the ground: the fields, the concrete all round, the fence with a gap where it is broken', () => {
    const T = millbrook(), g = groundData(T, millbrookScenery(T), 120); expect(g.n).toBeGreaterThan(T.length * 9 * 6);
    const all = fenceData(T, () => true).n, gap = fenceData(T, (s, m) => !(s > 0 && m > 100 && m < 110)).n; expect(gap).toBeLessThan(all);
  });
  it('lays every piece of the concrete on the surface, the bowl of a banking too: nothing stands clear of it to cut through a car (review 108)', () => {
    const T = millbrook(), g = groundData(T, millbrookScenery(T), 120); let worst = 0, n = 0;
    for (let t = 0; t < g.n / 3; t += 7) { const q = t * 9, cx = (g.pos[q]! + g.pos[q + 3]! + g.pos[q + 6]!) / 3, cy = (g.pos[q + 1]! + g.pos[q + 4]! + g.pos[q + 7]!) / 3, cz = (g.pos[q + 2]! + g.pos[q + 5]! + g.pos[q + 8]!) / 3;
      const l = T.locate(cx, cy); if (Math.abs(l.off) > T.spec.width / 2 - 0.2) continue; n++; worst = Math.max(worst, cz - T.height(l.s, l.off)); }
    expect(n).toBeGreaterThan(1000); expect(worst).toBeLessThan(0.06);
  });
});
