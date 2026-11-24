// The Porsche 959 in the drift-game style (docs/systems/109): the body shell from its hand-placed cage, the placeholder
// modules on their sockets, and the mesh the game draws, with the drawn lines and the creases.
import { Build, type Mesh, type MeshLine } from '../mesh';
import { DIM } from './cage';
import { buildShell, cut, type Shell959, type ShellOpts } from './shell';
import { sockets } from './sockets';
import type { V } from './subdiv';
export { buildCage, DIM } from './cage';
export { buildShell, type Shell959 } from './shell';
export { sockets } from './sockets';
export { p959Lines } from './lines';
import { p959Lines } from './lines';

export interface P959Opts extends ShellOpts { paint?: string; /** leave out the placeholder modules that are not part of the skin (wheels, lenses, mirrors, exhausts) */ bare?: boolean }
const MAT: Record<string, [string, number, Parameters<Build['mat']>[2]]> = { glass: ['#20262c', 0.9, 'glass'], grille: ['#17181a', 0.1, 'grille'], dark: ['#1b1c1e', 0.05, 'plain'], lamp: ['#b3261e', 0.5, 'lens'] };

/** the faces of a shell laid into a builder, a part per panel and material */
export function emitShell(b: Build, S: Shell959, paint: string, normals?: number[]): void { const groups = new Map<string, number[]>();
  S.tag.forEach((t, k) => { const key = `${t.panel}|${t.mat}`; (groups.get(key) ?? groups.set(key, []).get(key)!).push(k); });
  for (const [key, fs] of groups) { const [panel, mat] = key.split('|') as [string, string], m = MAT[mat]; b.name(panel); if (m) b.mat(panel === 'headLamp' ? '#d9dde0' : m[0], m[1], m[2]); else b.mat(paint, 0.6, 'paint');
    for (const k of fs) for (const t of cut(S.P, S.F[k]!)) { b.tri(S.P[t[0]]!, S.P[t[1]]!, S.P[t[2]]!); if (normals) for (const v of t) normals.push(...S.N[k]![S.F[k]!.indexOf(v)]!); } } }

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
      b.name('rim').mat('#c9ccd0', 0.75, 'metal').lathe('y', o, [[f, rim], [f - s * 14, rim - 12], [f - s * 40, rim * 0.5], [f - s * 55, 70], [f - s * 55, 0.5]], 20, false); }
    for (const m of K.mirrors) { const s = m.o[1] > 0 ? 1 : -1; b.name('mirror').mat(paint, 0.6, 'paint').box(m.o[0] - 30, m.o[0] + 60, Math.min(m.o[1], m.o[1] + s * 150), Math.max(m.o[1], m.o[1] + s * 150), m.o[2] + 10, m.o[2] + 105); } }
  const M = b.mesh(DIM.length);
  M.lines = p959Lines(S) as MeshLine[];
  M.creases = [...S.crease].map(k => { const [a, c] = k.split('|').map(Number) as [number, number]; return [S.P[a]!, S.P[c]!] as [V, V]; });
  return { mesh: M, shell: S, normals: new Float32Array(nn), shellTris: nn.length / 9 }; }
