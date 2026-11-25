// The Porsche 959 in the drift-game style (docs/systems/109): the body shell from its hand-placed cage, the placeholder
// modules on their sockets, and the mesh the game draws, with the drawn lines and the creases.
import { Build, type Mesh, type MeshLine } from '../mesh';
import { DIM } from './cage';
import { buildShell, cut, type Shell959, type ShellOpts } from './shell';
import { sockets } from './sockets';
import { cornerNormals, type V } from './subdiv';
import { headLamp, mirror, plate, wheel, type LampKind, type PlateText, type WheelKind } from './parts';
export type { LampKind, WheelKind } from './parts';
export { buildCage, DIM } from './cage';
export { buildShell, type Shell959 } from './shell';
export { sockets } from './sockets';
export { p959Lines } from './lines';
import { p959Lines } from './lines';

export interface P959Opts extends ShellOpts { paint?: string; lamp?: LampKind; wheel?: WheelKind; plate?: PlateText; /** leave out the placeholder modules that are not part of the skin (wheels, lenses, mirrors, exhausts) */ bare?: boolean }
const MAT: Record<string, [string, number, Parameters<Build['mat']>[2]]> = { glass: ['#20262c', 0.9, 'glass'], grille: ['#17181a', 0.1, 'grille'], dark: ['#1b1c1e', 0.05, 'plain'], lamp: ['#b3261e', 0.5, 'lens'], amber: ['#d9861c', 0.5, 'lens'], lens: ['#17181a', 0.1, 'plain'] };

/** the faces of a shell laid into a builder, a part per panel and material */
export function emitShell(b: Build, S: Shell959, paint: string, normals?: number[]): void { const groups = new Map<string, number[]>();
  S.tag.forEach((t, k) => { const key = `${t.panel}|${t.mat}`; (groups.get(key) ?? groups.set(key, []).get(key)!).push(k); });
  // the triangles (each quad cut once) and their normals: weighted by the corner angles of the triangles, split at the creases
  const T: [number, number, number][][] = S.F.map(f => cut(S.P, f)), flat = T.flat(), first: number[] = []; let n = 0; for (const t of T) { first.push(n); n += t.length; }
  const N = normals ? cornerNormals(S.P, flat, S.crease) : [];
  for (const [key, fs] of groups) { const [panel, mat] = key.split('|') as [string, string], m = MAT[mat]; b.name(panel); if (m) b.mat(m[0], m[1], m[2]); else b.mat(paint, 0.6, 'paint');
    for (const k of fs) T[k]!.forEach((t, q) => { b.tri(S.P[t[0]]!, S.P[t[1]]!, S.P[t[2]]!); if (normals) for (const c of N[first[k]! + q]!) normals.push(...c); }); } }

/** the model: the mesh, the shell it was made from, and the shell's own shading normals (nine numbers a triangle, for
 *  the triangles that are the shell's: the first `shellTris`) */
export interface P959Model { mesh: Mesh; shell: Shell959; normals: Float32Array; shellTris: number }
export function p959Mesh(o: P959Opts = {}): Mesh { return p959Model(o).mesh; }
export function p959Model(o: P959Opts = {}): P959Model { const S = buildShell(o), b = new Build(), paint = o.paint ?? '#b8bcc2', nn: number[] = [];
  emitShell(b, S, paint, nn);
  if (!o.bare) { const K = sockets(), sl = 38.7 * Math.PI / 180;
    for (const h of K.hubs) wheel(b, h, o.wheel ?? 'hollow5');
    for (const s of [1, -1]) headLamp(b, o.lamp ?? 'round', [270 + Math.sin(sl) * 14, s * 615, 640 - Math.cos(sl) * 14], [0, 1, 0], [Math.cos(sl), 0, Math.sin(sl)], [-Math.sin(sl), 0, Math.cos(sl)], 100, 122);
    for (const e of K.exhausts) b.name('exhaust').mat('#2a2b2d', 0.6, 'metal').lathe('x', [0, e.o[1], e.o[2]], [[e.o[0] - 60, e.r], [e.o[0] + 14, e.r], [e.o[0] - 50, e.r - 10]], 8, false);
    for (const m of K.mirrors) mirror(b, m, paint);
    for (const m of K.marks) if (/^plate/.test(m.name)) plate(b, m, o.plate); }
  const M = b.mesh(DIM.length);
  M.lines = p959Lines(S) as MeshLine[];
  M.creases = [...S.crease].map(k => { const [a, c] = k.split('|').map(Number) as [number, number]; return [S.P[a]!, S.P[c]!] as [V, V]; });
  return { mesh: M, shell: S, normals: new Float32Array(nn), shellTris: nn.length / 9 }; }
