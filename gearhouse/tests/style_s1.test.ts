import { describe, it, expect } from 'vitest';
import { Build, KINDS, type V } from '../render/car/mesh';
import { surfaceNormals, hullNormals, hardEdgeLines, weld, chain } from '../render/car/edges';
import { screenPx, worldPerPx, hullPush, outlineShare, makeAtlas, autoAtlasUV, ATLAS_CELLS, STYLE } from '../render/live/style';
import { lineQuads } from '../render/live/gpu';
import { STYLE_CARS } from '../render/car/stylecars';

/** a cube of side s from the origin, paint, its faces wound outward; `split` cuts the top face into four about its middle */
function cube(s = 1000, split = false) { const b = new Build().name('body').mat('#cc2222', 0.5, 'paint');
  const p = (x: number, y: number, z: number): V => [x * s, y * s, z * s];
  b.quad(p(0, 0, 0), p(0, 1, 0), p(1, 1, 0), p(1, 0, 0));   // bottom (-z)
  if (split) { const m = p(0.5, 0.5, 1); b.tri(p(0, 0, 1), p(1, 0, 1), m).tri(p(1, 0, 1), p(1, 1, 1), m).tri(p(1, 1, 1), p(0, 1, 1), m).tri(p(0, 1, 1), p(0, 0, 1), m); }
  else b.quad(p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1));   // top (+z)
  b.quad(p(0, 0, 0), p(1, 0, 0), p(1, 0, 1), p(0, 0, 1));   // -y
  b.quad(p(1, 1, 0), p(0, 1, 0), p(0, 1, 1), p(1, 1, 1));   // +y
  b.quad(p(0, 1, 0), p(0, 0, 0), p(0, 0, 1), p(0, 1, 1));   // -x
  b.quad(p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1));   // +x
  return b.mesh(s); }
/** the normal at a corner placed at point q (the first corner found there, in triangle t's order) */
const normalAt = (pos: Float32Array, N: Float32Array, q: V, t?: number) => { for (let c = 0; c < pos.length / 3; c++) { if (t !== undefined && Math.floor(c / 3) !== t) continue; if (Math.hypot(pos[c * 3]! - q[0], pos[c * 3 + 1]! - q[1], pos[c * 3 + 2]! - q[2]) < 0.01) return [N[c * 3]!, N[c * 3 + 1]!, N[c * 3 + 2]!]; } return null; };
/** two quads meeting along x at y = 0, the second folded down by `deg` */
function fold(deg: number, names: [string, string] = ['a', 'a'], kinds: [string, string] = ['paint', 'paint']) { const b = new Build(), a = deg * Math.PI / 180;
  b.name(names[0]).mat('#888888', 0.3, kinds[0] as never).quad([0, -500, 0], [0, 0, 0], [1000, 0, 0], [1000, -500, 0]);
  const y = 500 * Math.cos(a), z = -500 * Math.sin(a); b.name(names[1]).mat('#888888', 0.3, kinds[1] as never).quad([0, 0, 0], [0, y, z], [1000, y, z], [1000, 0, 0]);
  return b.mesh(1000); }

describe('the drift-game style: widths on the screen (docs/systems/109 §5.1)', () => {
  it('scales a width given at 1080 high by the picture, never under a pixel, held up on a dense small screen', () => {
    expect(screenPx(2.5, 1080)).toBeCloseTo(2.5); expect(screenPx(2.5, 2160)).toBeCloseTo(5); expect(screenPx(2.5, 540)).toBeCloseTo(1.25);
    expect(screenPx(0.5, 200)).toBe(1); expect(screenPx(2.5, 1170, 3)).toBeCloseTo(3.75);   // a phone held sideways: by its pixel ratio
  });
  it('pushes the hull by the distance under a perspective lens, so its width on the screen stays the same near or far', () => {
    const view = { H: 1080, fovDeg: 30 }, near = hullPush(2.5, view, 5), far = hullPush(2.5, view, 20);
    expect(far / near).toBeCloseTo(4);
    for (const d of [3, 5, 20, 80]) expect(hullPush(2.5, view, d) / worldPerPx(view, d)).toBeCloseTo(2.5);   // back to pixels: always 2.5
    const flat = { H: 1080, mm: 12 }; expect(hullPush(2.5, flat, 5)).toBeCloseTo(hullPush(2.5, flat, 50)); expect(hullPush(2.5, flat, 5)).toBeCloseTo(0.03);
  });
  it('gives each part its share of the outline: body and wheels whole, a glass frame 0.7, the cabin half', () => {
    expect(outlineShare('door', KINDS.indexOf('paint'))).toBe(1); expect(outlineShare('tyreF', KINDS.indexOf('tyre'))).toBe(1);
    expect(outlineShare('screenPane', KINDS.indexOf('glass'))).toBe(0.7); expect(outlineShare('windowFrame', KINDS.indexOf('plain'))).toBe(0.7);
    expect(outlineShare('seat', KINDS.indexOf('leather'))).toBe(0.5); expect(outlineShare('dash', KINDS.indexOf('plain'))).toBe(0.5);
    expect(STYLE.outlinePx).toBeGreaterThanOrEqual(2); expect(STYLE.linePx).toBeLessThan(STYLE.outlinePx);
  });
});

describe('the drift-game style: normals per surface (doc 108 §3.4 items 1-3)', () => {
  it('splits the normals at a fold over the crease angle and keeps them whole under it', () => {
    for (const [deg, split] of [[60, true], [20, false]] as const) { const M = fold(deg), N = surfaceNormals(M.pos, M.n, M.kind);
      const a = normalAt(M.pos, N, [0, 0, 0], 0)!, b = normalAt(M.pos, N, [0, 0, 0], 2)!, d = a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
      if (split) expect(d).toBeLessThan(0.6); else expect(d).toBeCloseTo(1, 5); }
  });
  it('smooths across parts of one material (not per part), splits at a change of material and at a marked crease', () => {
    const across = fold(15, ['hood', 'wing']), N = surfaceNormals(across.pos, across.n, across.kind), a = normalAt(across.pos, N, [0, 0, 0], 0)!, b = normalAt(across.pos, N, [0, 0, 0], 2)!;
    expect(a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!).toBeCloseTo(1, 5);   // two panels, one surface: no step in the shading at their seam
    const mixed = fold(15, ['a', 'a'], ['paint', 'plain']), N2 = surfaceNormals(mixed.pos, mixed.n, mixed.kind);
    expect(normalAt(mixed.pos, N2, [0, 0, 0], 0)![2]).toBeCloseTo(-1, 5);   // the paint keeps its own face's normal (its face looks down -z)
    const N3 = surfaceNormals(across.pos, across.n, across.kind, { creases: [[[0, 0, 0], [1000, 0, 0]]] });
    expect(normalAt(across.pos, N3, [0, 0, 0], 0)![2]).toBeCloseTo(-1, 5);
  });
  it('weights by the angle at the corner, so cutting a face into more triangles does not tilt the normal', () => {
    const plain = cube(1000), cut = cube(1000, true), o = { crease: 100 };
    const n1 = normalAt(plain.pos, surfaceNormals(plain.pos, plain.n, plain.kind, o), [1000, 1000, 1000])!, n2 = normalAt(cut.pos, surfaceNormals(cut.pos, cut.n, cut.kind, o), [1000, 1000, 1000])!;
    for (const n of [n1, n2]) for (const c of n) expect(c).toBeCloseTo(1 / Math.sqrt(3), 5);
    expect(normalAt(cut.pos, surfaceNormals(cut.pos, cut.n, cut.kind), [1000, 1000, 1000])![0]).not.toBeCloseTo(1 / Math.sqrt(3), 2);   // at 35 degrees the cube's corners stay sharp
  });
  it('gives the hull one outward normal a point, whatever the shading splits', () => {
    const M = cube(1000), H = hullNormals(M.pos, M.n); for (let c = 0; c < M.n * 3; c++) { const x = M.pos[c * 3]!, y = M.pos[c * 3 + 1]!, z = M.pos[c * 3 + 2]!;
      expect(H[c * 3]!).toBeCloseTo((x > 0 ? 1 : -1) / Math.sqrt(3), 5); expect(H[c * 3 + 1]!).toBeCloseTo((y > 0 ? 1 : -1) / Math.sqrt(3), 5); expect(H[c * 3 + 2]!).toBeCloseTo((z > 0 ? 1 : -1) / Math.sqrt(3), 5); }
    expect(weld(M.pos, M.n).nv).toBe(8);
  });
});

describe('the drift-game style: lines found at hard edges (docs/systems/109 §5.2)', () => {
  it('finds a cube\'s twelve edges as creases, joined into lines', () => {
    const L = hardEdgeLines(cube(1000)); expect(L.every(l => l.kind === 'crease')).toBe(true);
    let total = 0; for (const l of L) for (let i = 1; i < l.pts.length; i++) total += Math.hypot(l.pts[i]![0] - l.pts[i - 1]![0], l.pts[i]![1] - l.pts[i - 1]![1], l.pts[i]![2] - l.pts[i - 1]![2]);
    expect(total).toBeCloseTo(12000, 3); expect(L.length).toBe(12);   // three edges meet at each corner: a line ends there
  });
  it('joins segments end to end, closes a loop, and keeps kinds apart', () => {
    const at = (v: number): V => [v * 100, 0, 0];
    expect(chain([{ a: 0, b: 1, kind: 'crease' }, { a: 2, b: 1, kind: 'crease' }, { a: 2, b: 3, kind: 'crease' }], at).map(l => l.pts.length)).toEqual([4]);
    const loop = chain([{ a: 0, b: 1, kind: 'lamp' }, { a: 1, b: 2, kind: 'lamp' }, { a: 2, b: 0, kind: 'lamp' }], at); expect(loop.length).toBe(1); expect(loop[0]!.closed).toBe(true); expect(loop[0]!.pts.length).toBe(4);
    expect(chain([{ a: 0, b: 1, kind: 'crease' }, { a: 1, b: 2, kind: 'panel' }], at).length).toBe(2);
  });
  it('draws the seam between two named panels, the rim where paint meets trim, and nothing on a gentle fold', () => {
    expect(hardEdgeLines(fold(10, ['hood', 'wingF'])).map(l => l.kind)).toEqual(['panel']);
    expect(hardEdgeLines(fold(10, ['hood', 'grille'], ['paint', 'grille'])).map(l => l.kind)).toEqual(['trim']);
    expect(hardEdgeLines(fold(20))).toEqual([]); expect(hardEdgeLines(fold(10, ['hood', 'seam']))).toEqual([]);   // the kit's raised seam strips are left to the lines
    expect(hardEdgeLines(fold(10, ['seat', 'dash'], ['plain', 'leather']))).toEqual([]);   // no paint: no line
  });
  it('finds lines on every style car that has none of its own', () => {
    for (const c of STYLE_CARS) { const M = c.mesh(); const L = M.lines?.length ? M.lines : hardEdgeLines(M); expect(L.length, c.id).toBeGreaterThan(20); expect(L.some(l => l.kind === 'panel'), c.id).toBe(true); }
  });
  it('makes each segment of a line a ribbon of two triangles', () => {
    expect(lineQuads([{ pts: [[0, 0, 0], [100, 0, 0]] }]).n).toBe(6);
    expect(lineQuads([{ pts: [[0, 0, 0], [100, 0, 0], [0, 100, 0]], closed: true }]).n).toBe(18);
    const q = lineQuads([{ pts: [[0, 0, 0], [100, 0, 0]], w: 0.5 }]); expect(Array.from(q.S.filter((_, i) => i % 2 === 1))).toEqual([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
  });
});

describe('the drift-game style: the atlas (docs/systems/109 §5)', () => {
  it('lays its cells four to a row and leaves the round ones clear at their corners', () => {
    const A = makeAtlas(64); expect(A.rects.length).toBe(ATLAS_CELLS.length * 4); expect(A.data.length).toBe(64 * 64 * 4);
    expect(A.data[3]).toBe(0);   // the head lamp's cell, its corner: the surface shows through
    const c = 8 + 8 * 64; expect(A.data[c * 4 + 3]).toBe(255);   // its middle: painted
  });
  it('gives the faces of a grille the grille cell, repeating, and nothing to a mesh without one', () => {
    const b = new Build().mat('#222222', 0.2, 'grille').quad([0, 0, 0], [0, 300, 0], [0, 300, 120], [0, 0, 120]).mat('#cc2222', 0.4, 'paint').quad([0, 0, 200], [0, 300, 200], [0, 300, 300], [0, 0, 300]), M = b.mesh(500);
    const uv = autoAtlasUV(M.pos, M.kind, M.n)!; expect(uv[2]).toBe(ATLAS_CELLS.indexOf('grille') + 1); expect(uv[18 + 2]).toBe(0); expect(Math.max(...Array.from(uv.subarray(0, 18)).filter((_, i) => i % 3 === 0))).toBeGreaterThan(1);
    expect(autoAtlasUV(cube().pos, cube().kind, 12)).toBeNull();
  });
});
