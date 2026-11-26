// The car kit (render/car/kit, docs/systems/97_model_benchmark.md): the F355 assembled from it stays in
// budget and closes at every seam, lamps down and up and with its lines stretched; the kinds added for it (pointed nose,
// buttress canopy, louvred deck, ducktail with sunk lamps, star wheel, sunk bumper lamps) are general: they swap onto
// the NSX, and the NSX's own kinds swap onto the F355; the NSX built on this copy still matches its original mesh.
import { describe, it, expect } from 'vitest';
import { wheelsOf, type Mesh } from '../render/car/mesh';
import { nsxMesh } from '../render/car/mesh_nsx';
import { f355KitMesh } from '../render/car/mesh_f355_kit';
import { assemble } from '../render/car/kit/assemble';
import { iou, seamCheck, silhouette, VIEWS } from '../render/car/kit/check';
import { F355_FIVE_SPOKE, F355_FRAME_TAIL, F355_KIT } from '../render/car/cars/f355.kit';
import { NSX_DISC_WHEEL, NSX_DUCKTAIL, NSX_KIT, NSX_POINTED_NOSE, NSX_ROUND_TAIL, NSX_STAR_WHEEL, NSX_SUNK_FRONT } from '../render/car/cars/nsx.kit';
import sheet from '../data/cars/spec/f355.json';

const closed = (r: ReturnType<typeof seamCheck>) => { expect(r.open.map(e => `${e.names} ${e.a.map(Math.round)}`)).toEqual([]); expect(r.nonManifold.length).toBe(0); expect(r.duplicates).toBe(0); expect(r.overlaps).toBe(0); expect(r.seams).toBeGreaterThan(300); };
const wheelParts = (M: Mesh) => wheelsOf(M).every(w => w.tris.every(t => /^(tyre|rim|wheel|hub)/.test(M.names![M.part[t]!]!)));
const names = (M: Mesh) => new Set(M.names!.filter(Boolean));
/** the furthest point along axis `out` where axis `on` crosses c (the body only) */
function extent(M: Mesh, on: number, c: number, out: number, max: boolean, abs = false): number { let best = max ? -1e9 : 1e9; const p = M.pos;
  for (let t = 0; t < M.n; t++) { if (/^(mirror|wiper|tyre|rim|wheel|hub|exhaust|chassis|plate)/.test(M.names![M.part[t]!] ?? '')) continue;
    for (let k = 0; k < 3; k++) { const a = t * 9 + k * 3, b = t * 9 + ((k + 1) % 3) * 3, ca = p[a + on]!, cb = p[b + on]!; if ((ca - c) * (cb - c) > 0 || ca === cb) continue; let v = p[a + out]! + (p[b + out]! - p[a + out]!) * (c - ca) / (cb - ca); if (abs) v = Math.abs(v); best = max ? Math.max(best, v) : Math.min(best, v); } } return best; }

describe('kit: the F355', () => {
  const M = f355KitMesh(0, 0);
  // (alpha 0.11, M1: the engine part is now the whole powertrain, render/car/powertrain: the budget went from 10,500 to 14,000)
  it('stays in budget (16,600 triangles with the powertrain and the suspension) and keeps the sheet\'s length', () => { expect(M.n).toBeLessThanOrEqual(16600); expect(M.length).toBe(4250); });
  it('has four wheels made of wheel parts only, on the sheet\'s axles', () => { const w = wheelsOf(M); expect(w.length).toBe(4); expect(wheelParts(M)).toBe(true); expect(w[1]!.hx - w[0]!.hx).toBeCloseTo(sheet.overall.wheelbase, 3); });
  it('carries the parts of the detail list', () => { const n = names(f355KitMesh(0, 1));
    for (const p of ['grille', 'fogF', 'indicatorF', 'sidelightF', 'badge', 'tailLamp', 'stopLamp', 'tailSlot', 'spoiler', 'intake', 'intakeGrille', 'engineCover', 'engineBay', 'intakePlenum', 'engineBlock', 'gearbox', 'buttress', 'rearPane', 'quarterPane', 'lampLid', 'lampPod', 'headlamp', 'bonnetVent', 'exhaust', 'wheel', 'hub']) expect(n.has(p), p).toBe(true); });
  it('raises its head lamps', () => { const front = (m: Mesh) => { let z = 1e9; for (let t = 0; t < m.n; t++) if (m.names![m.part[t]!] === 'lampLid') for (let k = 0; k < 3; k++) z = Math.min(z, m.pos[t * 9 + k * 3 + 2]!); return z; }; expect(front(f355KitMesh(0, 1)) - front(M)).toBeGreaterThan(60); });
  it('follows the sheet\'s outline: the side profile, the plan and the overall box within 40 mm (mean within 15)', () => {
    const tops = (sheet.profile.top as number[][]).filter(([x]) => x! >= 43 && x! <= 4102).map(([x, z]) => extent(M, 0, x!, 2, true) - z!);
    const plan = (sheet.plan.half as number[][]).filter(([x]) => x! > 120 && x! < 4160).map(([x, y]) => extent(M, 0, x!, 1, true, true) - y!);
    const mean = (e: number[]) => e.reduce((s, v) => s + Math.abs(v), 0) / e.length, worst = (e: number[]) => Math.max(...e.map(Math.abs));
    expect(worst(tops)).toBeLessThan(40); expect(mean(tops)).toBeLessThan(15); expect(worst(plan)).toBeLessThan(40); expect(mean(plan)).toBeLessThan(15);
    let zmax = 0, ymax = 0; for (let i = 0; i < M.n * 9; i += 3) { if (/^mirror/.test(M.names![M.part[Math.floor(i / 9)]!] ?? '')) continue; zmax = Math.max(zmax, M.pos[i + 2]!); ymax = Math.max(ymax, Math.abs(M.pos[i + 1]!)); }
    expect(Math.abs(zmax - sheet.overall.height)).toBeLessThan(10); expect(Math.abs(2 * ymax - sheet.overall.width)).toBeLessThan(15);
  });
});

describe('kit: the F355\'s seams', () => {
  it('closes the shell: nothing open, over-used, duplicate or folded (lamps down and up)', () => { closed(seamCheck(assemble(F355_KIT, { lamps: 0 }))); closed(seamCheck(assemble(F355_KIT, { lamps: 1 }))); });
});

describe('kit: swaps on the F355', () => {
  it('a longer wheelbase and a wider body still close, and the shape follows', () => {
    const A = assemble(F355_KIT, { tweak: { wheelbase: 150, halfWidth: 30 } }); closed(seamCheck(A));
    expect(A.mesh.length).toBe(4250 + 150); const w = wheelsOf(A.mesh); expect(w.length).toBe(4); expect(w[1]!.hx - w[0]!.hx).toBeCloseTo(sheet.overall.wheelbase + 150, 3);
    const half = (M: Mesh, part: string) => { let m = 0; for (let i = 0; i < M.n * 9; i += 3) if (M.names![M.part[Math.floor(i / 9)]!] === part) m = Math.max(m, Math.abs(M.pos[i + 1]!)); return m; };
    for (const p of ['door', 'engineCover', 'buttress']) expect(half(A.mesh, p) - half(f355KitMesh(), p), p).toBeGreaterThan(10);
  });
  it('takes the kit\'s frame tail (blade, slot, lamp band) under its buttresses and louvred deck', () => { const A = assemble({ ...F355_KIT, ...F355_FRAME_TAIL }); closed(seamCheck(A)); expect(names(A.mesh).has('tailBand')).toBe(true); });
  it('takes the kit\'s five-spoke wheel', () => { const A = assemble({ ...F355_KIT, ...F355_FIVE_SPOKE }); closed(seamCheck(A)); expect(wheelsOf(A.mesh).length).toBe(4); expect(wheelParts(A.mesh)).toBe(true); });
});

describe('kit: the new kinds on the NSX', () => {
  it('the ducktail with sunk lamps', () => { const A = assemble({ ...NSX_KIT, ...NSX_DUCKTAIL }); closed(seamCheck(A)); expect(names(A.mesh).has('tailLamp')).toBe(true); });
  it('the star wheel', () => { const A = assemble({ ...NSX_KIT, ...NSX_STAR_WHEEL }); closed(seamCheck(A)); expect(wheelsOf(A.mesh).length).toBe(4); expect(wheelParts(A.mesh)).toBe(true); });
  it('the pointed nose', () => { closed(seamCheck(assemble({ ...NSX_KIT, ...NSX_POINTED_NOSE }))); closed(seamCheck(assemble({ ...NSX_KIT, ...NSX_POINTED_NOSE }, { tweak: { wheelbase: 150, halfWidth: 30 } }))); });
  it('the sunk fog lamps and turn lamp slots', () => { closed(seamCheck(assemble({ ...NSX_KIT, ...NSX_SUNK_FRONT }))); });
});

describe('kit: parity of the NSX on this copy of the kit', () => {
  const orig = nsxMesh(0, 0), A0 = assemble(NSX_KIT), kit = A0.mesh, MM = 6, W = Math.round(5600 / MM), H = Math.round(3000 / MM);
  it('matches the original mesh\'s silhouette at six views (IoU >= 0.9995) and its triangle count within 10 %', () => {
    for (const v of VIEWS) expect(iou(silhouette(orig, v, MM, W, H).mask, silhouette(kit, v, MM, W, H).mask), v.name).toBeGreaterThanOrEqual(0.9995);
    // (the original has only an engine: the kit build's powertrain and suspension are left out of the count; M1, M3)
    const body = kit.n - A0.panelOf.reduce((a, p) => a + (A0.panels[p] === 'engine' || A0.panels[p] === 'suspension' ? 1 : 0), 0); expect(Math.abs((body + 1062) / orig.n - 1)).toBeLessThan(0.1); expect(body).toBe(9436 - 1062);
  });
  it('still closes, with its own swaps', () => { closed(seamCheck(assemble(NSX_KIT))); closed(seamCheck(assemble({ ...NSX_KIT, ...NSX_ROUND_TAIL }))); closed(seamCheck(assemble({ ...NSX_KIT, ...NSX_DISC_WHEEL }))); });
});
