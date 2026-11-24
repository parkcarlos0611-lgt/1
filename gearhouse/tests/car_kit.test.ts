// The car kit (docs/systems/95_nsx_kit_breakdown.md, section 6): the kit-built NSX matches the original mesh, its
// shell closes at every seam, and swapping lines, the tail and the wheels still assembles a closed body.
import { describe, it, expect } from 'vitest';
import { wheelsOf, type Mesh } from '../render/car/mesh';
import { nsxMesh } from '../render/car/mesh_nsx';
import { nsxKitMesh } from '../render/car/mesh_nsx_kit';
import { assemble } from '../render/car/kit/assemble';
import { iou, seamCheck, silhouette, VIEWS } from '../render/car/kit/check';
import { NSX_DISC_WHEEL, NSX_KIT, NSX_ROUND_TAIL } from '../render/car/cars/nsx.kit';

const MM = 12, W = Math.round(5600 / MM), H = Math.round(3000 / MM);
const closed = (r: ReturnType<typeof seamCheck>) => { expect(r.open.map(e => `${e.names} ${e.a.map(Math.round)}`)).toEqual([]); expect(r.nonManifold.length).toBe(0); expect(r.duplicates).toBe(0); expect(r.overlaps).toBe(0); expect(r.seams).toBeGreaterThan(300); };
const wheelParts = (M: Mesh) => wheelsOf(M).every(w => w.tris.every(t => /^(tyre|rim|wheel|hub)/.test(M.names![M.part[t]!]!)));

describe('car kit: parity with the original NSX', () => {
  const orig = nsxMesh(0, 0), kit = nsxKitMesh(0, 0);
  it('matches the silhouette at six views (IoU >= 0.98)', () => {
    for (const v of VIEWS) { const s = iou(silhouette(orig, v, MM, W, H).mask, silhouette(kit, v, MM, W, H).mask); expect(s, v.name).toBeGreaterThanOrEqual(0.98); }
  });
  it('keeps the triangle count within 10 % and the length', () => { expect(Math.abs(kit.n / orig.n - 1)).toBeLessThan(0.1); expect(kit.length).toBe(orig.length); });
  it('finds the same four wheels, made of wheel parts only', () => {
    const a = wheelsOf(orig), b = wheelsOf(kit); expect(b.length).toBe(4);
    b.forEach((w, i) => { expect(w.hx).toBeCloseTo(a[i]!.hx, 3); expect(w.hy).toBeCloseTo(a[i]!.hy, 3); expect(w.tris.length).toBe(a[i]!.tris.length); });
    expect(wheelParts(kit)).toBe(true);
  });
  it('keeps the parts the game names (lamps, lenses, panels)', () => {
    const names = (M: Mesh) => new Set(M.names!.filter(Boolean)); const a = names(nsxMesh(0, 1)), b = names(nsxKitMesh(0, 1));
    expect([...a].filter(n => !b.has(n))).toEqual([]); expect([...b].filter(n => !a.has(n))).toEqual([]);
  });
});

describe('car kit: seams', () => {
  it('closes the shell: every panel border shared, nothing open or folded (lamps down and up)', () => { closed(seamCheck(assemble(NSX_KIT, { lamps: 0 }))); closed(seamCheck(assemble(NSX_KIT, { lamps: 1 }))); });
});

describe('car kit: swaps', () => {
  it('a longer wheelbase and a wider body still close, and the shape follows', () => {
    const A = assemble(NSX_KIT, { tweak: { wheelbase: 150, halfWidth: 30 } }); closed(seamCheck(A));
    expect(A.mesh.length).toBe(4405 + 150); const w = wheelsOf(A.mesh), base = wheelsOf(nsxKitMesh());
    expect(w.length).toBe(4); expect(w[1]!.hx - w[0]!.hx).toBeCloseTo(base[1]!.hx - base[0]!.hx + 150, 3);
    const half = (M: Mesh) => { let m = 0; for (let i = 0; i < M.n * 9; i += 3) if (M.names![M.part[Math.floor(i / 9)]!] === 'door') m = Math.max(m, M.pos[i + 1]!); return m; };
    expect(half(A.mesh) - half(nsxKitMesh())).toBeGreaterThan(25);
  });
  it('the round-lamp tail assembles and closes', () => { const A = assemble({ ...NSX_KIT, ...NSX_ROUND_TAIL }); closed(seamCheck(A)); expect(A.mesh.names!.includes('tailLamp')).toBe(true); });
  it('the disc wheel assembles, closes, and still turns as a wheel', () => { const A = assemble({ ...NSX_KIT, ...NSX_DISC_WHEEL }); closed(seamCheck(A)); expect(wheelsOf(A.mesh).length).toBe(4); expect(wheelParts(A.mesh)).toBe(true); });
});
