// The N33 in the drift-game style (docs/systems/117 R1): the frame "차체 B" (no openings, blank bumpers, the plain steel
// wheel, faint panel lines) from its hand-placed cage, subdivided and finished as the 959's shell is, and the mesh the
// game draws with its drawn lines and creases. The glass sets of the builder's second step are tags on the same cells.
import { Build, type Mesh, type MeshLine } from '../mesh';
import { shellFrom, type Shell959 } from '../p959/shell';
import { emitShell, type P959Model } from '../p959';
import { p959Lines } from '../p959/lines';
import { wheel, type WheelKind } from '../p959/parts';
import { subdivSkin, type Skin } from '../skin';
import type { V } from '../p959/subdiv';
import { buildCage, DIM, type CageOpts } from './cage';
import { frameOf, STOCK_FRAME, type Frame } from './frame';
export { buildCage, DIM, NR, NC, ARCH } from './cage';
export { frameOf, STOCK_FRAME, ZONES, type Frame } from './frame';

/** the shell: the cage subdivided, the arches trued with a lip and a well about the (stretched) hubs, no sockets sunk */
export function buildN33Shell(o: CageOpts = {}): Shell959 { const f = frameOf(o.dims);
  return shellFrom(buildCage(o), { arches: [{ x: f.archF[0], z: f.archF[1] }, { x: f.archR[0], z: f.archR[1] }], archR: DIM.archR }); }
export const n33Skin = (S: Shell959): Skin => subdivSkin({ P: S.P, F: S.F, N: S.N, tag: S.tag, nSub: S.nSub, parent: S.fine.parent });

/** the wheels' hubs on the stretched car: at the axles and the track (the tyre's outer face half a width out), on the ground */
export interface N33Hub { name: string; o: V; tyreR: number; rimR: number; width: number; archR: number; front: boolean }
export function n33Hubs(f: Frame = STOCK_FRAME, tyres: [number, number] = [245, 245]): N33Hub[] { const out: N33Hub[] = [];
  for (const s of [1, -1]) { out.push({ name: s > 0 ? 'hubFL' : 'hubFR', o: [f.axleF, s * (DIM.trackF / 2 * f.kY + tyres[0] / 2), DIM.hubZ], tyreR: DIM.tyreR, rimR: DIM.rimR, width: tyres[0], archR: DIM.archR, front: true });
    out.push({ name: s > 0 ? 'hubRL' : 'hubRR', o: [f.axleR, s * (DIM.trackR / 2 * f.kY + tyres[1] / 2), DIM.hubZ], tyreR: DIM.tyreR, rimR: DIM.rimR, width: tyres[1], archR: DIM.archR, front: false }); }
  return out; }

export interface N33Opts extends CageOpts { paint?: string; wheel?: WheelKind; /** leave the wheels out (the skin alone) */ bare?: boolean; tyres?: [number, number]; brake?: boolean }
/** the lump as the builder's first step shows it (everything else of the car is a part still to come) */
export const N33_LUMP: N33Opts = { glass: null, wheel: 'steel' };
export function n33Model(o: N33Opts = {}): P959Model { const fr = frameOf(o.dims), S = buildN33Shell(o), b = new Build(), nn: number[] = [];
  emitShell(b, S, o.paint ?? '#b8bcc2', nn);
  if (!o.bare) for (const h of n33Hubs(fr, o.tyres)) wheel(b, h, o.wheel ?? 'steel', o.brake !== false);
  const M: Mesh = b.mesh(o.dims ? fr.length : DIM.length);
  M.lines = p959Lines(S, !o.glass) as MeshLine[];
  M.creases = [...S.crease].map(k => { const [a, c] = k.split('|').map(Number) as [number, number]; return [S.P[a]!, S.P[c]!] as [V, V]; });
  return { mesh: M, shell: S, normals: new Float32Array(nn), shellTris: nn.length / 9 }; }
export const n33Mesh = (o: N33Opts = {}): Mesh => n33Model(o).mesh;
