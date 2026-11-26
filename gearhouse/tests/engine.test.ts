// The engine mesh module (doc 86): engines built from their specification, to be set into car meshes.
import { describe, it, expect } from 'vitest';
import { Build, wheelsOf } from '../render/car/mesh';
import { addEngine, ENGINES } from '../render/car/enginemesh';

const BUDGET: Record<0 | 1 | 2, [number, number]> = { 2: [1000, 1550], 1: [450, 800], 0: [150, 350] };

describe('engine meshes from their specification', () => {
  for (const id of Object.keys(ENGINES)) for (const det of [2, 1, 0] as const) it(`${id} at detail ${det}: within budget, no zero-area triangles, all parts named engine*`, () => {
    const b = new Build(), r = addEngine(b, ENGINES[id]!, [1000, 0, 300], { detail: det }), M = b.mesh(2000);
    expect(r.tris).toBe(M.n); expect(r.tris).toBeGreaterThanOrEqual(BUDGET[det][0]); expect(r.tris).toBeLessThanOrEqual(BUDGET[det][1]);
    for (let t = 0; t < M.n; t++) { const q = t * 9, p = M.pos, ux = p[q + 3]! - p[q]!, uy = p[q + 4]! - p[q + 1]!, uz = p[q + 5]! - p[q + 2]!, vx = p[q + 6]! - p[q]!, vy = p[q + 7]! - p[q + 1]!, vz = p[q + 8]! - p[q + 2]!;
      expect(Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx)).toBeGreaterThan(0.5); expect(Number.isFinite(p[q]!)).toBe(true); }
    expect(new Set(M.names!.filter(Boolean).map(n => n.startsWith('engine'))).has(false)).toBe(false);
    expect(wheelsOf(M)).toHaveLength(0);
  });
  it('plausible sizes as drawn, and the brace and engine within the reported bounds', () => {
    for (const id of Object.keys(ENGINES)) { const b = new Build(), r = addEngine(b, ENGINES[id]!, [0, 0, 0]);
      expect(r.scale).toBe(1); expect(r.size.len).toBeGreaterThan(400); expect(r.size.len).toBeLessThan(950); expect(r.size.wid).toBeGreaterThan(400); expect(r.size.wid).toBeLessThan(800); expect(r.size.hgt).toBeGreaterThan(380); expect(r.size.hgt).toBeLessThan(700);
      const M = b.mesh(1000); for (let i = 0; i < M.pos.length; i++) { expect(M.pos[i]!).toBeGreaterThanOrEqual(r.min[i % 3]! - 1e-3); expect(M.pos[i]!).toBeLessThanOrEqual(r.max[i % 3]! + 1e-3); } }
  });
  it('fits its box, scaled down about the crank end, in every direction', () => {
    const box = { len: 420, wid: 450, hgt: 400 }, o: [number, number, number] = [3000, 200, 350];
    for (const id of Object.keys(ENGINES)) for (const dir of ['x', '-x', 'y', '-y'] as const) { const b = new Build(), r = addEngine(b, ENGINES[id]!, o, { dir, box });
      expect(r.scale).toBeLessThan(1); expect(r.size.len).toBeLessThanOrEqual(box.len + 1e-6); expect(r.size.wid).toBeLessThanOrEqual(box.wid + 1e-6); expect(r.size.hgt).toBeLessThanOrEqual(box.hgt + 1e-6);
      const along = dir.endsWith('x') ? 0 : 1, sg = dir.startsWith('-') ? -1 : 1, acrossK = 1 - along;
      const a0 = sg > 0 ? r.min[along]! - o[along]! : o[along]! - r.max[along]!, a1 = sg > 0 ? r.max[along]! - o[along]! : o[along]! - r.min[along]!;
      expect(a0).toBeGreaterThanOrEqual(-1e-6); expect(a1).toBeLessThanOrEqual(box.len + 1e-6);      // the engine runs from the crank's end along dir
      expect(Math.max(o[acrossK]! - r.min[acrossK]!, r.max[acrossK]! - o[acrossK]!)).toBeLessThanOrEqual(box.wid / 2 + 1e-6);
      expect(r.max[2] - r.min[2]).toBeLessThanOrEqual(box.hgt + 1e-6); }
  });
  it('a different layout builds too: an inline six, a flat six, a supercharged V8', () => {
    for (const s of [{ layout: 'I', cylinders: 6, litres: 3.0 }, { layout: 'flat', cylinders: 6, litres: 3.6, plenum: 'twin' }, { layout: 'V', cylinders: 8, litres: 5.0, superchargers: 1, plenum: 'single' }] as const) {
      const b = new Build(), r = addEngine(b, s, [0, 0, 0]); expect(r.tris).toBeGreaterThan(300); expect(r.tris).toBeLessThan(1600); }
  });
});
