// The car kit (docs/systems/95_nsx_kit_breakdown.md, section 6): the kit-built NSX matches the original mesh, its
// shell closes at every seam, and swapping lines, the tail and the wheels still assembles a closed body.
import { describe, it, expect } from 'vitest';
import { wheelsOf, type Mesh } from '../render/car/mesh';
import { nsxMesh } from '../render/car/mesh_nsx';
import { nsxKitMesh } from '../render/car/mesh_nsx_kit';
import { assemble } from '../render/car/kit/assemble';
import { iou, seamCheck, silhouette, VIEWS } from '../render/car/kit/check';
import { NSX_DISC_WHEEL, NSX_KIT, NSX_ROUND_TAIL } from '../render/car/cars/nsx.kit';
import { f355Mesh } from '../render/car/mesh_f355';
import { f355KitMesh } from '../render/car/mesh_f355_kit';
import { F355_KIT } from '../render/car/cars/f355.kit';

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

// The F355 on the same kit: the pointed nose with its openings cut as outlines, the flying buttresses, the louvred cover,
// the long scoop, the ducktail with sunk lamps, the star wheels, the V8 along the car.
describe('car kit: the F355', () => {
  const kit = f355KitMesh(0, 0);
  it('assembles within the budget (engine included), at the sheet\'s length', () => { expect(kit.length).toBe(4250); expect(kit.n).toBeLessThanOrEqual(10500); expect(f355KitMesh(0, 1).n).toBeLessThanOrEqual(10500); });
  it('closes the shell: nothing open, over-used, doubled or folded (lamps down and up)', () => { closed(seamCheck(assemble(F355_KIT, { lamps: 0 }))); closed(seamCheck(assemble(F355_KIT, { lamps: 1 }))); });
  it('keeps the hand-built car\'s silhouette at six views (IoU >= 0.97)', () => {
    const orig = f355Mesh(0, 0); for (const v of VIEWS) { const s = iou(silhouette(orig, v, MM, W, H).mask, silhouette(kit, v, MM, W, H).mask); expect(s, v.name).toBeGreaterThanOrEqual(0.97); }
  });
  it('finds four wheels on the sheet\'s axles and tracks, made of wheel parts only', () => {
    const w = wheelsOf(kit); expect(w.length).toBe(4); expect(wheelParts(kit)).toBe(true);
    expect(w.map(g => Math.round(g.hx)).sort((a, b) => a - b)).toEqual([1032, 1032, 3482, 3482]);
    expect(w.map(g => Math.round(Math.abs(g.hy))).sort((a, b) => a - b)).toEqual([757, 757, 808, 808]);
  });
  it('cuts the openings and lays the lamps the game names', () => {
    const names = new Set(kit.names!.filter(Boolean)); for (const n of ['grille', 'turnLamp', 'fogLamp', 'tailLamp', 'fogLampR', 'tailSlot', 'louvre', 'buttress', 'intake', 'lampLid', 'exhaust', 'plate']) expect(names.has(n), n).toBe(true);
    expect(new Set(f355KitMesh(0, 1).names!).has('headlamp')).toBe(true);
  });
  it('lays the V8 along the car in the bay (between the cover\'s ends, within the box given)', () => {
    const A = assemble(F355_KIT), M = A.mesh, e = A.panels.indexOf('engine'); let x0 = Infinity, x1 = -Infinity, y1 = 0;
    for (let t = 0; t < M.n; t++) if (A.panelOf[t] === e) for (let k = 0; k < 3; k++) { const x = M.pos[t * 9 + k * 3]!, y = Math.abs(M.pos[t * 9 + k * 3 + 1]!); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    expect(x1 - x0).toBeGreaterThan(500); expect(y1).toBeLessThanOrEqual(450); expect(x0).toBeGreaterThan(2900); expect(x1).toBeLessThan(3990);
  });
  it('a longer wheelbase and a wider body still close, and the shape follows', () => {
    const A = assemble(F355_KIT, { tweak: { wheelbase: 150, halfWidth: 30 } }); closed(seamCheck(A));
    expect(A.mesh.length).toBe(4250 + 150); const w = wheelsOf(A.mesh); expect(w.length).toBe(4);
    const xs = w.map(g => g.hx).sort((a, b) => a - b); expect(xs[3]! - xs[0]!).toBeCloseTo(2450 + 150, 3);
  });
});
