// The EB110 on the car kit (render/car/cars/eb110.kit.ts, docs/systems/96_kit_conversion_plan.md step 2): it stays in
// budget, follows its sheet's outline, closes at every seam (wing down and up, its lines stretched), stands on its
// axles, and matches the panel-built render/car/mesh_eb110.ts at the parity test's six views. The kinds added for it
// (pocket head lamps, the bumper mass, the shelf and the bubble cabin, the glass engine cover, the capsule tail, the
// rear wing) are general: the EB110 takes the NSX's and the F355's tails and wheels, and those cars take its kinds.
import { describe, it, expect } from 'vitest';
import { wheelsOf, type Mesh } from '../render/car/mesh';
import { eb110Mesh } from '../render/car/mesh_eb110';
import { eb110KitMesh } from '../render/car/mesh_eb110_kit';
import { MESH_CARS } from '../render/car/meshcars';
import { assemble } from '../render/car/kit/assemble';
import { iou, seamCheck, silhouette, VIEWS } from '../render/car/kit/check';
import { EB110_DUCKTAIL, EB110_FIVE_SPOKE, EB110_FRAME_TAIL, EB110_KIT, EB110_POPUP_LAMPS, EB110_STAR_WHEEL } from '../render/car/cars/eb110.kit';
import { NSX_ACTIVE_WING, NSX_FIXED_LAMPS, NSX_KIT, NSX_POCKET_LAMPS } from '../render/car/cars/nsx.kit';
import { F355_FIXED_WING, F355_GLASS_DECK, F355_KIT, F355_POCKET_LAMPS } from '../render/car/cars/f355.kit';
import sheet from '../data/cars/spec/eb110.json';

const closed = (r: ReturnType<typeof seamCheck>) => { expect(r.open.map(e => `${e.names} ${e.a.map(Math.round)}`)).toEqual([]); expect(r.nonManifold.length).toBe(0); expect(r.duplicates).toBe(0); expect(r.overlaps).toBe(0); expect(r.seams).toBeGreaterThan(300); };
const wheelParts = (M: Mesh) => wheelsOf(M).every(w => w.tris.every(t => /^(tyre|rim|wheel|hub)/.test(M.names![M.part[t]!]!)));
const names = (M: Mesh) => new Set(M.names!.filter(Boolean));
/** the furthest point along axis `out` where axis `on` crosses c (the body only) */
function extent(M: Mesh, on: number, c: number, out: number, max: boolean, abs = false): number { let best = max ? -1e9 : 1e9; const p = M.pos;
  for (let t = 0; t < M.n; t++) { if (/^(mirror|wiper|tyre|rim|wheel|hub|exhaust|chassis|plate|wing)/.test(M.names![M.part[t]!] ?? '')) continue;
    for (let k = 0; k < 3; k++) { const a = t * 9 + k * 3, b = t * 9 + ((k + 1) % 3) * 3, ca = p[a + on]!, cb = p[b + on]!; if ((ca - c) * (cb - c) > 0 || ca === cb) continue; let v = p[a + out]! + (p[b + out]! - p[a + out]!) * (c - ca) / (cb - ca); if (abs) v = Math.abs(v); best = max ? Math.max(best, v) : Math.min(best, v); } } return best; }
const top = (M: Mesh, part: string) => { let z = -1e9; for (let i = 0; i < M.n * 9; i += 3) if (M.names![M.part[Math.floor(i / 9)]!] === part) z = Math.max(z, M.pos[i + 2]!); return z; };

describe('kit: the EB110', () => {
  const M = eb110KitMesh(0, 0);
  it('stays in budget (11,000 triangles with the engine) and keeps the sheet\'s length', () => { expect(M.n).toBeLessThanOrEqual(11000); expect(M.length).toBe(4400); });
  it('has four wheels made of wheel parts only, on the sheet\'s axles', () => { const w = wheelsOf(M); expect(w.length).toBe(4); expect(wheelParts(M)).toBe(true); expect(w[0]!.hx).toBeCloseTo(sheet.overall.axleF, 3); expect(w[1]!.hx - w[0]!.hx).toBeCloseTo(sheet.overall.wheelbase, 3); });
  it('carries the parts the user approved', () => { const n = names(M);
    for (const p of ['hood', 'wingF', 'bumperF', 'grille', 'splitter', 'badge', 'headCover', 'lampHousing', 'lampFin', 'reflector', 'headlamp', 'indicatorF', 'door', 'intake', 'quarter', 'roof', 'buttress', 'louvre', 'engineCover', 'enginePlenum', 'screenPane', 'sidePane',
      'screenFrame', 'tailPanel', 'tailRim', 'tailLamp', 'indicatorR', 'reverseLamp', 'tailMesh', 'valance', 'wing', 'wingBed', 'exhaust', 'mirror', 'wheel', 'hub']) expect(n.has(p), p).toBe(true); });
  it('keeps the head lamps\' tops and the bonnet between them on one straight line across', () => { const zs: number[] = []; for (let t = 0; t < M.n; t++) if (M.names![M.part[t]!] === 'headCover') for (let k = 0; k < 3; k++) { const i = t * 9 + k * 3; if (Math.abs(M.pos[i]! - 600) < 1) zs.push(M.pos[i + 2]!); }
    expect(zs.length).toBeGreaterThan(4); expect(Math.max(...zs) - Math.min(...zs)).toBeLessThan(0.5); expect(extent(M, 0, 600, 2, true)).toBeCloseTo(zs[0]!, 0); });
  it('scoops the wing beside each head lamp: the trough\'s floor lies under the bonnet\'s edge', () => { const A = assemble(EB110_KIT), row = A.skin.SHF[A.skin.SHF.findIndex(r => Math.abs(r[0]![0] - 600) < 1)]!; expect(row[0]![2] - row[1]![2]).toBeGreaterThan(45); expect(row[0]![2] - row[3]![2]).toBeGreaterThan(20); });
  it('raises its rear wing', () => { expect(top(eb110KitMesh(0, 1), 'wing') - top(M, 'wing')).toBeGreaterThan(90); });
  it('follows the sheet\'s outline: the side profile, the plan and the overall box within 40 mm (mean within 15)', () => {
    // the profile from the bumper's top back to the tail's top edge; the plan behind the lamps (ahead of them the sheet's widths were read 6-7 % too
    // large from a perspective render, its corrections_138) and clear of the front arch's cut (the widest line passes through the arch there)
    const tops = (sheet.profile.top as number[][]).filter(([x]) => x! >= 90 && x! <= 4370).map(([x, z]) => extent(M, 0, x!, 2, true) - z!);
    const plan = (sheet.plan.half as number[][]).filter(([x]) => x! >= 600 && x! < 4340 && !(x! > 690 && x! < 1100)).map(([x, y]) => extent(M, 0, x!, 1, true, true) - y!);
    expect(tops.length).toBeGreaterThan(30); expect(plan.length).toBeGreaterThan(14);
    const mean = (e: number[]) => e.reduce((s, v) => s + Math.abs(v), 0) / e.length, worst = (e: number[]) => Math.max(...e.map(Math.abs));
    expect(worst(tops)).toBeLessThan(40); expect(mean(tops)).toBeLessThan(15); expect(worst(plan)).toBeLessThan(40); expect(mean(plan)).toBeLessThan(15);
    let zmax = 0, ymax = 0; for (let i = 0; i < M.n * 9; i += 3) { if (/^mirror/.test(M.names![M.part[Math.floor(i / 9)]!] ?? '')) continue; zmax = Math.max(zmax, M.pos[i + 2]!); ymax = Math.max(ymax, Math.abs(M.pos[i + 1]!)); }
    expect(Math.abs(zmax - sheet.overall.height)).toBeLessThan(10); expect(Math.abs(2 * ymax - sheet.overall.width)).toBeLessThan(15);
  });
  it('is the registered EB110', () => { const e = MESH_CARS.find(c => c.id === 'eb110')!; expect(e.mesh(0).n).toBe(M.n); expect(names(e.mesh(0)).has('tailPanel')).toBe(true); });
});

describe('kit: the EB110\'s seams', () => {
  it('closes the shell: nothing open, over-used, duplicate or folded (wing down and up)', () => { closed(seamCheck(assemble(EB110_KIT))); closed(seamCheck(assemble(EB110_KIT, { wing: 1 }))); });
  it('a longer wheelbase and a wider body still close, and the shape follows', () => {
    const A = assemble(EB110_KIT, { tweak: { wheelbase: 150, halfWidth: 30 } }); closed(seamCheck(A));
    expect(A.mesh.length).toBe(4400 + 150); const w = wheelsOf(A.mesh); expect(w.length).toBe(4); expect(w[1]!.hx - w[0]!.hx).toBeCloseTo(sheet.overall.wheelbase + 150, 3);
    const half = (M: Mesh, part: string) => { let m = 0; for (let i = 0; i < M.n * 9; i += 3) if (M.names![M.part[Math.floor(i / 9)]!] === part) m = Math.max(m, Math.abs(M.pos[i + 1]!)); return m; };
    for (const p of ['door', 'engineCover', 'tailPanel', 'wing']) expect(half(A.mesh, p) - half(eb110KitMesh(), p), p).toBeGreaterThan(8);
  });
});

describe('kit: parity of the EB110 with the panel-built mesh', () => {
  const orig = eb110Mesh(0, 0), kit = eb110KitMesh(0, 0), MM = 6, W = Math.round(5600 / MM), H = Math.round(3000 / MM);
  it('matches its silhouette at six views (IoU >= 0.98), wing down and up', () => {
    for (const v of VIEWS) expect(iou(silhouette(orig, v, MM, W, H).mask, silhouette(kit, v, MM, W, H).mask), v.name).toBeGreaterThanOrEqual(0.98);
    const o1 = eb110Mesh(0, 1), k1 = eb110KitMesh(0, 1); for (const v of VIEWS) expect(iou(silhouette(o1, v, MM, W, H).mask, silhouette(k1, v, MM, W, H).mask), v.name).toBeGreaterThanOrEqual(0.98);
  });
  it('has the same wheels', () => { const a = wheelsOf(orig), b = wheelsOf(kit); expect(b.length).toBe(a.length); a.forEach((w, i) => { expect(b[i]!.hx).toBeCloseTo(w.hx, 3); }); });
});

describe('kit: swaps on the EB110', () => {
  it('takes the NSX\'s tail (one frame, the blade over a slot, the lamp band)', () => { const A = assemble({ ...EB110_KIT, ...EB110_FRAME_TAIL }); closed(seamCheck(A)); const n = names(A.mesh); expect(n.has('tailBand')).toBe(true); expect(n.has('spoiler')).toBe(true); expect(n.has('tailPanel')).toBe(false); });
  it('takes the F355\'s tail (the ducktail, lamps sunk in the panel)', () => { const A = assemble({ ...EB110_KIT, ...EB110_DUCKTAIL }); closed(seamCheck(A)); expect(names(A.mesh).has('stopLamp')).toBe(true); });
  it('takes the NSX\'s five-spoke wheel and the F355\'s star wheel', () => { for (const sw of [EB110_FIVE_SPOKE, EB110_STAR_WHEEL]) { const A = assemble({ ...EB110_KIT, ...sw }); closed(seamCheck(A)); expect(wheelsOf(A.mesh).length).toBe(4); expect(wheelParts(A.mesh)).toBe(true); } });
  it('takes pop-up head lamps, down and up', () => { closed(seamCheck(assemble({ ...EB110_KIT, ...EB110_POPUP_LAMPS }))); const A = assemble({ ...EB110_KIT, ...EB110_POPUP_LAMPS }, { lamps: 1 }); closed(seamCheck(A)); expect(names(A.mesh).has('lampPod')).toBe(true); });
  it('takes them together, stretched', () => { closed(seamCheck(assemble({ ...EB110_KIT, ...EB110_FRAME_TAIL, ...EB110_STAR_WHEEL, ...EB110_POPUP_LAMPS }, { lamps: 1, tweak: { wheelbase: 150, halfWidth: 30 } }))); });
});

describe('kit: the EB110\'s kinds on the other cars', () => {
  it('the NSX takes the pocket head lamps, the fixed lenses and the active wing', () => {
    const A = assemble({ ...NSX_KIT, ...NSX_POCKET_LAMPS }); closed(seamCheck(A)); expect(names(A.mesh).has('headCover')).toBe(true); expect(names(A.mesh).has('lampLid')).toBe(false);
    closed(seamCheck(assemble({ ...NSX_KIT, ...NSX_FIXED_LAMPS }))); closed(seamCheck(assemble({ ...NSX_KIT, ...NSX_POCKET_LAMPS }, { tweak: { wheelbase: 150, halfWidth: 30 } })));
    const dn = assemble({ ...NSX_KIT, ...NSX_ACTIVE_WING }), up = assemble({ ...NSX_KIT, ...NSX_ACTIVE_WING }, { wing: 1 }); closed(seamCheck(up)); expect(top(up.mesh, 'wing') - top(dn.mesh, 'wing')).toBeGreaterThan(100); });
  it('the F355 takes the glass engine cover, the pocket head lamps and a fixed wing', () => {
    const A = assemble({ ...F355_KIT, ...F355_GLASS_DECK }); closed(seamCheck(A)); let glass = 0; for (let t = 0; t < A.mesh.n; t++) if (A.mesh.names![A.mesh.part[t]!] === 'engineCover' && A.role[t] === 1) glass++; expect(glass).toBeGreaterThan(20);
    closed(seamCheck(assemble({ ...F355_KIT, ...F355_POCKET_LAMPS }))); const B = assemble({ ...F355_KIT, ...F355_FIXED_WING, ...F355_GLASS_DECK, ...F355_POCKET_LAMPS }); closed(seamCheck(B)); expect(top(B.mesh, 'wing') - top(B.mesh, 'spoiler')).toBeGreaterThan(100); });
});
