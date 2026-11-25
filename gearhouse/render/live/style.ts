// The drift-game style's numbers and pictures (docs/systems/109 §5, docs/systems/108 §2.4 and L1): the widths of its
// lines on the screen, each part's share of the outline, and the atlas its lamps, grilles, wheel faces and gauges are
// painted from. Pure: the renderer (render/live/renderer.ts, look 4) and the style check page (ui/stylecheck.ts) use
// these, and the tests check them.
import { KINDS } from '../car/mesh';
import { interiorSheet } from '../car/interior/atlas';
import type { GaugeCar } from '../car/interior/gauges';

/** the style's widths at a picture 1080 pixels high: the silhouette's outline and the drawn lines (doc 108 L1, raised 2026-11-25 to the user's choice: outline
 *  3.5-4 px, character lines 2.5-3 px, panel gaps 2 px) */
export const STYLE = { outlinePx: 3.75, linePx: 2.75, /** door, bonnet and lid gaps: a step thinner than the character lines */ panelPx: 2.0, ref: 1080, /** a line's lift toward the eye (m), so it never fights the surface under it */ lift: 0.004 } as const;
/** a width given at 1080 pixels high, in this picture's pixels: by its height, and never thinner than a fixed share of
 *  a device pixel ratio's (a phone's small but dense picture), nor under one pixel */
export function screenPx(px1080: number, H: number, dpr = 1): number { return Math.max(1, px1080 * Math.max(H / STYLE.ref, dpr / 2)); }
/** how much of the world (m) one pixel covers at distance `dist` (m) from the eye: a perspective camera of vertical
 *  field `fovDeg` over `H` pixels; or an orthographic one at `mm` millimetres a pixel (then `dist` does not matter) */
export function worldPerPx(view: { H: number; fovDeg?: number; mm?: number }, dist: number): number {
  return view.fovDeg ? 2 * dist * Math.tan(view.fovDeg * Math.PI / 360) / view.H : (view.mm ?? 1) / 1000; }
/** the hull's push (m) for a width of `px` pixels at that distance: the shader does the same in clip space, so the line
 *  stays `px` wide on the screen near or far */
export const hullPush = (px: number, view: { H: number; fovDeg?: number; mm?: number }, dist: number): number => px * worldPerPx(view, dist);
/** each part's share of the outline (docs/systems/109 §5.1): the body and the wheels whole, a glass's frame 0.7, the
 *  cabin's insides half */
export function outlineShare(name: string, kind: number): number {
  if (kind === KINDS.indexOf('glass') || /frame|surround|seal|rubber|pillarTrim/i.test(name)) return 0.7;
  if (/seat|dash|steer(ing)?Wheel|driver|helmet|cage|cockpit|interior|cabin|gauge|pedal|shift|lever|tunnel|harness|console|doorCard/i.test(name)) return 0.5;
  return 1; }

// ---- the atlas (docs/systems/109 §5, shading): one picture for the painted detail. Each cell a square, its pictures
//      drawn to its edge; a corner's coordinates (u, v) run 0..1 over a cell and repeat in it (a grille's mesh tiles) ----
/* the last cell, 'interior', is the cabin's own sheet (render/car/interior/atlas.ts): the atlas's whole lower half, its regions found by the cabin's parts themselves */
export const ATLAS_CELLS = ['headLamp', 'tailLamp', 'grille', 'wheelFace', 'gauge', 'vent', 'interior'] as const;
export type AtlasCell = typeof ATLAS_CELLS[number];
/** the atlas: four cells a row, each `S / 4` square, and the cabin's sheet across the lower half; RGBA, alpha 0 where a cell shows the surface's own colour */
export interface Atlas { S: number; data: Uint8Array; /** each cell's place (u0, v0, du, dv) in 0..1, in ATLAS_CELLS' order */ rects: Float32Array }
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** a cell's picture at (u, v) in -1..1 (y up): [r, g, b, a] 0..1 */
function cellAt(c: Exclude<AtlasCell, 'interior'>, u: number, v: number): [number, number, number, number] {
  const r = Math.hypot(u, v), a = Math.atan2(v, u), aa = 1.5 / 64;
  switch (c) {
    case 'headLamp': { if (r > 0.98) return [0, 0, 0, 0]; const bowl = 0.62 + 0.3 * (1 - r * r), ring = sm(0.8, 0.8 + aa, r) * (1 - sm(0.88, 0.88 + aa, r)), bulb = 1 - sm(0.16, 0.16 + aa, Math.hypot(u, v + 0.05));
      const flute = Math.abs(((u * 6 + 60) % 1) - 0.5) > 0.44 && v > -0.25 ? 0.82 : 1, k = bowl * flute * (1 - 0.35 * ring); const g = 1 - sm(0.12, 0.12 + aa, Math.hypot(u + 0.32, v - 0.36));
      const base: [number, number, number] = [0.78 * k, 0.83 * k, 0.9 * k]; return [Math.max(base[0], bulb * 0.95, g), Math.max(base[1], bulb * 0.93, g), Math.max(base[2], bulb * 0.86, g), 1]; }
    case 'tailLamp': { if (Math.abs(u) > 0.98 || Math.abs(v) > 0.98) return [0, 0, 0, 0]; const bar = Math.abs(((v * 3 + 30) % 1) - 0.5) > 0.42 ? 0.6 : 1, cell = Math.abs(((u * 4 + 40) % 1) - 0.5) > 0.46 ? 0.7 : 1, edge = 1 - 0.3 * sm(0.86, 0.9, Math.max(Math.abs(u), Math.abs(v)));
      const lens = v > 0.5 && Math.abs(u) < 0.45 ? [0.86, 0.86, 0.84] : [0.68, 0.08, 0.07]; const k = bar * cell * edge; return [lens[0]! * k, lens[1]! * k, lens[2]! * k, 1]; }
    case 'grille': { const gx = Math.abs(((u + 1) * 4) % 1 - 0.5), gy = Math.abs(((v + 1) * 4) % 1 - 0.5), wire = Math.max(sm(0.36, 0.42, gx), sm(0.36, 0.42, gy)); const k = 0.06 + 0.16 * wire; return [k, k, k * 1.05, 1]; }
    case 'wheelFace': { if (r > 0.98) return [0, 0, 0, 0]; const spoke = Math.abs(Math.sin(a * 2.5)) < 0.32 && r > 0.22 && r < 0.86 ? 0 : 1, lip = sm(0.86, 0.86 + aa, r), hub = 1 - sm(0.2, 0.2 + aa, r), nut = r > 0.1 && r < 0.16 && Math.abs(Math.sin(a * 2.5)) > 0.9 ? 1 : 0;
      const metal = 0.72 + 0.18 * (1 - r), dark = 0.08; const k = spoke === 0 ? dark : metal * (1 - 0.25 * lip) * (hub ? 0.85 : 1) * (nut ? 0.6 : 1); return [k, k, k * 1.03, 1]; }
    case 'gauge': { if (r > 0.98) return [0, 0, 0, 0]; const ring = sm(0.86, 0.86 + aa, r); let k = 0.07 + 0.08 * ring; const tick = r > 0.66 && r < 0.8 && Math.abs(((a / (Math.PI * 2) * 24 + 24) % 1) - 0.5) > 0.42 && a < 1.9 && a > -2.6 + 0 ? 0.9 : 0;
      const needle = Math.abs(u * Math.sin(2.3) - v * Math.cos(2.3)) < 0.025 && u * Math.cos(2.3) + v * Math.sin(2.3) > -0.05 && r < 0.7 ? 1 : 0; const red = needle ? [0.95, 0.35, 0.1] : null;
      k = Math.max(k, tick); return red ? [red[0]!, red[1]!, red[2]!, 1] : [k, k, k, 1]; }
    case 'vent': { const s = Math.abs(((v + 1) * 5) % 1 - 0.5), k = s > 0.3 ? 0.05 : 0.22 - 0.3 * s; return [k, k, k, 1]; }
  } }
/** the placeholder atlas: the cells drawn by rule (a real one, painted, replaces it later; the cells keep their places).
 *  `car`: whose dials the cabin's sheet shows (its red line, its top speed; none: the 959's) */
export function makeAtlas(S = 1024, car?: GaugeCar): Atlas {
  const data = new Uint8Array(S * S * 4), C = S / 4, rects = new Float32Array(ATLAS_CELLS.length * 4);
  ATLAS_CELLS.forEach((c, i) => { if (c === 'interior') { rects.set([0, 0.5, 1, 0.5], i * 4); data.set(interiorSheet(S, car), S * (S / 2) * 4); return; }
    const cx = (i % 4) * C, cy = Math.floor(i / 4) * C; rects.set([cx / S, cy / S, C / S, C / S], i * 4);
    for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) { const p = cellAt(c, (x + 0.5) / C * 2 - 1, (y + 0.5) / C * 2 - 1), o = ((cy + y) * S + cx + x) * 4; for (let k = 0; k < 4; k++) data[o + k] = Math.round(Math.max(0, Math.min(1, p[k]!)) * 255); } });
  return { S, data, rects }; }
/** atlas coordinates for a mesh's grilles where it brings none (three numbers a corner, as Mesh.uv): each grille face
 *  laid flat along its own normal, the grille cell repeating every `pitch` mm */
export function autoAtlasUV(pos: ArrayLike<number>, kinds: ArrayLike<number>, nt: number, pitch = 90): Float32Array | null {
  const G = KINDS.indexOf('grille'), cell = ATLAS_CELLS.indexOf('grille') + 1, out = new Float32Array(nt * 9); let any = false;
  for (let t = 0; t < nt; t++) { if (kinds[t] !== G) continue; any = true; const q = t * 9, ax = pos[q + 3]! - pos[q]!, ay = pos[q + 4]! - pos[q + 1]!, az = pos[q + 5]! - pos[q + 2]!, bx = pos[q + 6]! - pos[q]!, by = pos[q + 7]! - pos[q + 1]!, bz = pos[q + 8]! - pos[q + 2]!;
    const n = [Math.abs(ay * bz - az * by), Math.abs(az * bx - ax * bz), Math.abs(ax * by - ay * bx)], m = n[0]! >= n[1]! && n[0]! >= n[2]! ? 0 : n[1]! >= n[2]! ? 1 : 2, [i, j] = m === 0 ? [1, 2] : m === 1 ? [0, 2] : [0, 1];
    for (let k = 0; k < 3; k++) out.set([pos[q + k * 3 + i!]! / pitch, pos[q + k * 3 + j!]! / pitch, cell], q + k * 3); }
  return any ? out : null; }
