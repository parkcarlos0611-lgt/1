// The Porsche 959 in the drift-game style (docs/systems/109): the body shell from its hand-placed cage, the placeholder
// modules on their sockets, and the mesh the game draws, with the drawn lines and the creases.
import { Build, type Mesh, type MeshLine } from '../mesh';
import { DIM } from './cage';
import { buildShell, cut, type Shell959, type ShellOpts } from './shell';
import { sockets } from './sockets';
import { cornerNormals, type V } from './subdiv';
export { buildCage, DIM } from './cage';
export { buildShell, type Shell959 } from './shell';
export { sockets } from './sockets';
export { p959Lines } from './lines';
import { p959Lines } from './lines';

export interface P959Opts extends ShellOpts { paint?: string; /** leave out the placeholder modules that are not part of the skin (wheels, lenses, mirrors, exhausts) */ bare?: boolean }
const MAT: Record<string, [string, number, Parameters<Build['mat']>[2]]> = { glass: ['#20262c', 0.9, 'glass'], grille: ['#17181a', 0.1, 'grille'], dark: ['#1b1c1e', 0.05, 'plain'], lamp: ['#b3261e', 0.5, 'lens'], amber: ['#d9861c', 0.5, 'lens'], lens: ['#dfe4e8', 0.8, 'lens'] };

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
  if (!o.bare) { const K = sockets();
    for (const h of K.hubs) { const s = h.o[1] > 0 ? 1 : -1, w = h.width, r = h.tyreR, rim = h.rimR;
      const o: V = [h.o[0], h.o[1] - s * w / 2, h.o[2]], f = s * w / 2;
      b.name(h.front ? 'tyreF' : 'tyreR').mat('#1c1c1e', 0.1, 'tyre').lathe('y', o, [[-f, r - 26], [-f * 0.8, r], [f * 0.8, r], [f, r - 26], [f, rim]], 20, false);
      // a placeholder for the 959's hollow five-spoke wheel (the wheel module comes in step S3): rim lip, a dark barrel, five spokes, a cap
      b.name('rim').mat('#c9ccd0', 0.5, 'plain').lathe('y', o, [[f, rim], [f - s * 10, rim - 14], [f - s * 70, rim - 20]], 20, false);
      b.name('wheel').mat('#232426', 0.05, 'plain').lathe('y', o, [[f - s * 70, rim - 20], [f - s * 80, 0.5]], 20, false);
      b.name('wheel').mat('#c9ccd0', 0.5, 'plain'); for (let q = 0; q < 5; q++) { const a = (q / 5 + 0.05) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), y = h.o[1] - s * 22; b.bar([o[0] + c * 40, y, o[2] + sn * 40], [o[0] + c * (rim - 18), y + s * 8, o[2] + sn * (rim - 18)], 74, 26); }
      b.name('hub').mat('#c9ccd0', 0.5, 'plain').lathe('y', o, [[f - s * 30, 62], [f - s * 12, 52], [f - s * 8, 0.5]], 10, false); }
    for (const e of K.exhausts) b.name('exhaust').mat('#2a2b2d', 0.6, 'metal').lathe('x', [0, e.o[1], e.o[2]], [[e.o[0] - 60, e.r], [e.o[0] + 14, e.r], [e.o[0] + 14, e.r - 9], [e.o[0] - 60, e.r - 9]], 10, false);
    for (const m of K.mirrors) { const s = m.o[1] > 0 ? 1 : -1, c: V = [m.o[0] + 20, m.o[1] + s * 120, m.o[2] + 62]; b.name('mirror').mat(paint, 0.6, 'paint').bar(m.o, [c[0], c[1] - s * 30, c[2] - 20], 26)
      .loft([[c[0] - 45, c[1], c[2]], [c[0] + 55, c[1] - s * 5, c[2]]].map(([x, y, z], q) => { const hw = q ? 62 : 40, hh = q ? 46 : 30; return [[x!, y! - s * hw, z! - hh], [x!, y! + s * hw, z! - hh * 0.8], [x!, y! + s * hw, z! + hh * 0.8], [x!, y! - s * hw, z! + hh]] as V[]; })); } }
  const M = b.mesh(DIM.length);
  M.lines = p959Lines(S) as MeshLine[];
  M.creases = [...S.crease].map(k => { const [a, c] = k.split('|').map(Number) as [number, number]; return [S.P[a]!, S.P[c]!] as [V, V]; });
  return { mesh: M, shell: S, normals: new Float32Array(nn), shellTris: nn.length / 9 }; }
