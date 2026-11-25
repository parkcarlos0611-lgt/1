// The Porsche 959 in the drift-game style (docs/systems/109): the body shell from its hand-placed cage, the placeholder
// modules on their sockets, and the mesh the game draws, with the drawn lines and the creases.
import { Build, type Mesh, type MeshLine } from '../mesh';
import { DIM } from './cage';
import { buildShell, cut, type Shell959, type ShellOpts } from './shell';
import { sockets } from './sockets';
import { cornerNormals, type V } from './subdiv';
import { frameOf, type Frame } from './frame';
import { headLamp, mirror, plate, wheel, type LampKind, type PlateText, type WheelKind } from './parts';
import { crestPlate, crestUV, lettering, skinNear, type CrestFrame } from './badge';
import { subdivSkin, type Skin } from '../skin';
import { fitPlate, drawPlate, PLATE_W, PLATE_H, type PlateFit } from './plates';
import { placedOf, type Placed } from '../../../core/placed';
import { drawPlaced, fitAll, footprints } from '../attach';
import { cutShell, clipLines } from '../attach/holes';
export type { LampKind, WheelKind, PlateText } from './parts';
export { plateText, PLATE_SYLLABLES } from './parts';
export { buildCage, DIM } from './cage';
export { buildShell, type Shell959 } from './shell';
export { sockets } from './sockets';
export { p959Lines } from './lines';
export { fitPlate, drawPlate, stockPlace, snapCentre, PLATE_RULES, PLATE_W, PLATE_H, type PlateFit } from './plates';
/** the shell's skin for parts placed freely on it (render/car/skin.ts, docs/systems/115 §5-2) */
export const shellSkin = (S: Shell959): Skin => subdivSkin({ P: S.P, F: S.F, N: S.N, tag: S.tag, nSub: S.nSub, parent: S.fine.parent });
export { frameOf, stretchAt, STOCK_FRAME, ZONES, type Frame, type FrameDims } from './frame';
import { p959Lines } from './lines';

/** the car as built (every option at its default), or the lump "차체 A" (docs/systems/115 §4-1: P959_LUMP) with parts put
 *  back one by one: a lamp 'none' leaves its socket flush and painted, `details` off the other openings and the small
 *  parts (the tail lamp band, the side intakes, the lid's grille, the mirrors, the exhausts, the crest and the lettering),
 *  `glass` null the cabin in body colour with the panel lines faint (they come up once a glass set is picked) */
export interface P959Opts extends Omit<ShellOpts, 'lamps'> { paint?: string; lamp?: LampKind | 'none'; wheel?: WheelKind; plate?: PlateText;
  /** the front and the rear plate fitted (default both): a plate taken off leaves the bumper's own painted skin, which runs
   *  whole under it (the plate, its frame and its dark plinth are laid on the surface, nothing is cut for them) */ plateF?: boolean; plateR?: boolean;
  /** leave out the placeholder modules that are not part of the skin (wheels, lenses, mirrors, exhausts) */ bare?: boolean;
  /** the tyres' widths, front and rear (mm; default the real car's 235 and 255): the wheels' middles stay where they are */ tyres?: [number, number];
  /** the wheels' own disc and caliper (default on; off where the car's suspension is drawn with its brakes: render/car/bodies.ts) */ brake?: boolean;
  /** the crest on the front lid and the lettering across the tail (default: with the details; docs/systems/116) */ marks?: boolean;
  /** parts placed freely on the skin (docs/systems/115 P1a: the plates; core/placed.ts): a fitted plate with an entry sits
   *  at its place, one without at the car's own; a place no longer on the skin falls back to the car's own. P1: the free
   *  surface parts (render/car/attach), each at its place */ placed?: readonly Placed[];
  /** the car's own small parts (its mirrors, its exhaust tips, its crest) left off where `details` would draw them: they
   *  are free parts then (docs/systems/115 P1: "599 순정 세트" puts them on as free parts at their own places) */ smalls?: boolean }
/** the lump as the builder's first step shows it: no openings, blank bumpers, the plain steel wheel, no plates, no glass */
export const P959_LUMP: P959Opts = { lamp: 'none', details: false, bumperF: 'blank', bumperR: 'blank', wheel: 'steel', plateF: false, plateR: false, glass: null };
const MAT: Record<string, [string, number, Parameters<Build['mat']>[2]]> = { glass: ['#20262c', 0.9, 'glass'], grille: ['#17181a', 0.1, 'grille'], dark: ['#1b1c1e', 0.05, 'plain'], lamp: ['#b3261e', 0.5, 'lens'], amber: ['#d9861c', 0.5, 'lens'], lens: ['#17181a', 0.1, 'plain'] };

/** the faces of a shell laid into a builder, a part per panel and material */
export function emitShell(b: Build, S: Shell959, paint: string, normals?: number[]): void { const groups = new Map<string, number[]>();
  S.tag.forEach((t, k) => { const key = `${t.panel}|${t.mat}`; (groups.get(key) ?? groups.set(key, []).get(key)!).push(k); });
  // the triangles (each quad cut once) and their normals: weighted by the corner angles of the triangles, split at the creases
  const T: [number, number, number][][] = S.F.map(f => cut(S.P, f)), flat = T.flat(), first: number[] = []; let n = 0; for (const t of T) { first.push(n); n += t.length; }
  const N = normals ? cornerNormals(S.P, flat, S.crease) : [];
  for (const [key, fs] of groups) { const [panel, mat] = key.split('|') as [string, string], m = MAT[mat]; b.name(panel); if (m) b.mat(m[0], m[1], m[2]); else b.mat(paint, 0.6, 'paint');
    for (const k of fs) T[k]!.forEach((t, q) => { b.tri(S.P[t[0]]!, S.P[t[1]]!, S.P[t[2]]!); if (normals) for (const c of N[first[k]! + q]!) normals.push(...c); }); } }

/** a head lamp in its socket on the stretched car: the socket's centre and its axes carried by the frame (across, up the
 *  lamp's slope), the lamp's half-axes scaled as its socket's are, so a lengthened nose takes an oval socket with an oval lamp */
function lampIn(b: Build, f: Frame, kind: LampKind, c0: V, u0: V, v0: V, a: number, bb: number): void { const c = f.at(c0), d = (w: V): V => { const q = f.at([c0[0] + w[0] * 10, c0[1] + w[1] * 10, c0[2] + w[2] * 10]); return [(q[0] - c[0]) / 10, (q[1] - c[1]) / 10, (q[2] - c[2]) / 10]; };
  const u = d(u0), v = d(v0), lu = Math.hypot(...u), lv = Math.hypot(...v), un: V = [u[0] / lu, u[1] / lu, u[2] / lu], vn: V = [v[0] / lv, v[1] / lv, v[2] / lv], n0: V = [vn[1] * un[2] - vn[2] * un[1], vn[2] * un[0] - vn[0] * un[2], vn[0] * un[1] - vn[1] * un[0]], ln = Math.hypot(...n0);
  headLamp(b, kind, c, un, vn, [n0[0] / ln, n0[1] / ln, n0[2] / ln], a * lu, bb * lv); }

/** the model: the mesh, the shell it was made from, and the shell's own shading normals (nine numbers a triangle, for
 *  the triangles that are the shell's: the first `shellTris`) */
export interface P959Model { mesh: Mesh; shell: Shell959; normals: Float32Array; shellTris: number;
  /** with hole parts (docs/systems/115 P2): the shell before its holes were cut (`shell` is the cut one, which has no
   *  surface coordinates) and the triangles each hole added to it, by its key (a twin's ends in ~) */ uncut?: Shell959; holes?: Map<string, number> }
export function p959Mesh(o: P959Opts = {}): Mesh { return p959Model(o).mesh; }
export function p959Model(o: P959Opts = {}): P959Model { const lamps = o.lamp !== 'none', details = o.details !== false, marks = o.marks ?? details, fr = frameOf(o.dims);
  const S0 = buildShell({ ...o, lamps }), b = new Build(), paint = o.paint ?? '#b8bcc2', nn: number[] = [], K = sockets(fr);
  // the parts placed freely are fitted on the uncut shell (their places are its surface coordinates); the hole parts'
  // holes are then cut in it (docs/systems/115 P2: render/car/attach/holes.ts) before it is laid into the mesh
  const skin = !o.bare && o.placed?.length ? shellSkin(S0) : null, fits: PlateFit[] = [], plates: (() => void)[] = [];
  if (!o.bare) for (const m of K.marks) if (/^plate/.test(m.name) && (m.name === 'plateF' ? o.plateF : o.plateR) !== false) { const p = placedOf(o.placed, m.name as 'plateF' | 'plateR'), f = p && skin ? fitPlate(skin, p, fits) : null;
    if (f && f.gap < 150) { fits.push(f); plates.push(() => drawPlate(b, f, o.plate)); } else plates.push(() => plate(b, m, o.plate)); }
  const parts = skin ? fitAll(skin, o.placed!, fits.map(f => ({ F: f.F, hw: PLATE_W / 2 * f.s, hh: PLATE_H / 2 * f.s, twin: false })).flatMap(footprints)) : [];
  const holes = parts.filter(f => f.hole && f.ok).flatMap(f => f.hole!.cuts), C = holes.length ? cutShell(S0, skin!, holes) : null, S = C?.S ?? S0;
  emitShell(b, S, paint, nn); const crests: CrestFrame[] = [];
  if (!o.bare) { const sl = 38.7 * Math.PI / 180;
    for (const h0 of K.hubs) { const w = o.tyres ? o.tyres[h0.front ? 0 : 1] : h0.width, s = h0.o[1] > 0 ? 1 : -1, h = { ...h0, width: w, o: [h0.o[0], h0.o[1] + s * (w - h0.width) / 2, h0.o[2]] as V };
      wheel(b, h, o.wheel ?? 'hollow5', o.brake !== false); }
    if (lamps) for (const s of [1, -1]) lampIn(b, fr, o.lamp as LampKind ?? 'round', [270 + Math.sin(sl) * 14, s * 615, 640 - Math.cos(sl) * 14], [0, 1, 0], [Math.cos(sl), 0, Math.sin(sl)], 100, 122);
    const smalls = o.smalls !== false;
    if (details && smalls) for (const e of K.exhausts) b.name('exhaust').mat('#2a2b2d', 0.6, 'metal').lathe('x', [0, e.o[1], e.o[2]], [[e.o[0] - 60, e.r], [e.o[0] + 14, e.r], [e.o[0] - 50, e.r - 10]], 8, false);
    if (details && smalls) for (const m of K.mirrors) mirror(b, m, paint);
    for (const d of plates) d();
    if (skin) crests.push(...drawPlaced(b, skin, o.placed, paint, [], { fits: parts, cut: C?.done ?? new Set() }).crests);
    if (marks) for (const m of K.marks) { if (m.name === 'badge' && smalls) crests.push(crestPlate(b, m, skinNear(S.P, S.F, m.o, 120))); else if (m.name === 'porscheLettering') lettering(b, m, skinNear(S.P, S.F, m.o, 420)); } }
  const M = b.mesh(o.dims ? fr.length : DIM.length);
  if (crests.length) M.uv = crestUV(M, crests);
  const lines = p959Lines(S, o.glass === null).filter(l => !marks || o.bare || !/^tailLampWordBar/.test(l.name)) as MeshLine[];   // the bar drawn where the word goes, gone once the word is there
  M.lines = C ? [...clipLines(lines, skin!, holes.filter(h => C.done.has(h.key))), ...C.rims] : lines;
  M.creases = [...S.crease].map(k => { const [a, c] = k.split('|').map(Number) as [number, number]; return [S.P[a]!, S.P[c]!] as [V, V]; });
  return { mesh: M, shell: S, normals: new Float32Array(nn), shellTris: nn.length / 9, ...(C ? { uncut: S0, holes: C.added } : {}) }; }
