// The N33 in the drift-game style (docs/systems/117 R1): the frame "차체 B" (no openings, blank bumpers, the plain steel
// wheel, faint panel lines) from its hand-placed cage, subdivided and finished as the 959's shell is, and the mesh the
// game draws with its drawn lines and creases. The glass sets of the builder's second step are tags on the same cells.
import { Build, type Mesh, type MeshLine } from '../mesh';
import { shellFrom, type Shell959 } from '../p959/shell';
import type { P959Model } from '../p959';
import { emitShellFine } from './emit';
import { buildCageV3 } from './v3';
import { p959Lines } from '../p959/lines';
import { wheel, type WheelKind } from '../p959/parts';
import { subdivSkin, type Skin } from '../skin';
import type { V } from '../p959/subdiv';
import type { Mark } from '../p959/sockets';
import { fitPlate, drawPlate, stockPlace, type PlateFit } from '../p959/plates';
import type { PlateText } from '../p959/parts';
import { placedOf, freeParts, type Placed } from '../../../core/placed';
import { drawPlaced, fitAll, footprints } from '../attach';
import { cutShell, clipLines } from '../attach/holes';
import { crestUV } from '../p959/badge';
import { PLATE_W, PLATE_H } from '../p959/plates';
import { DIM, type CageOpts } from './cage';
import { frameOf, STOCK_FRAME, type Frame } from './frame';
export { buildCage, DIM, NR, NC, ARCH } from './cage';
export { frameOf, STOCK_FRAME, ZONES, type Frame } from './frame';

/** the shell: the cage subdivided, the arches trued with a lip and a well about the (stretched) hubs, no sockets sunk */
export function buildN33Shell(o: CageOpts = {}): Shell959 { const f = frameOf(o.dims);
  return shellFrom(buildCageV3(o), { arches: [{ x: f.archF[0], z: f.archF[1] }, { x: f.archR[0], z: f.archR[1] }], archR: DIM.archR }); }
export const n33Skin = (S: Shell959): Skin => subdivSkin({ P: S.P, F: S.F, N: S.N, tag: S.tag, nSub: S.nSub, parent: S.fine.parent });

/** the wheels' hubs on the stretched car: at the axles and the track (the tyre's outer face half a width out), on the ground */
export interface N33Hub { name: string; o: V; tyreR: number; rimR: number; width: number; archR: number; front: boolean }
export function n33Hubs(f: Frame = STOCK_FRAME, tyres: [number, number] = [245, 245]): N33Hub[] { const out: N33Hub[] = [];
  for (const s of [1, -1]) { out.push({ name: s > 0 ? 'hubFL' : 'hubFR', o: [f.axleF, s * (DIM.trackF / 2 * f.kY + tyres[0] / 2), DIM.hubZ], tyreR: DIM.tyreR, rimR: DIM.rimR, width: tyres[0], archR: DIM.archR, front: true });
    out.push({ name: s > 0 ? 'hubRL' : 'hubRR', o: [f.axleR, s * (DIM.trackR / 2 * f.kY + tyres[1] / 2), DIM.hubZ], tyreR: DIM.tyreR, rimR: DIM.rimR, width: tyres[1], archR: DIM.archR, front: false }); }
  return out; }

/** the plates' own places (docs/systems/115 P1a, by the generic skin): the front bumper's middle and the rear bumper's, on
 *  the stretched car; a plate is laid on the skin found along the car's axis from them (render/car/p959/plates.ts) */
export const n33Marks = (f: Frame = STOCK_FRAME): Mark[] => [{ name: 'plateF', o: f.at([0, 0, 425]), n: [-1, 0, 0], w: 335, h: 170 }, { name: 'plateR', o: f.at([4650, 0, 455]), n: [1, 0, 0], w: 335, h: 170 }];
export interface N33Opts extends CageOpts { paint?: string; wheel?: WheelKind; /** leave the wheels out (the skin alone) */ bare?: boolean; tyres?: [number, number]; brake?: boolean;
  /** the plates (default none: the lump's), their text, and their places when placed freely (core/placed.ts) */ plateF?: boolean; plateR?: boolean; plate?: PlateText; placed?: readonly Placed[] }
/** the lump as the builder's first step shows it (everything else of the car is a part still to come) */
export const N33_LUMP: N33Opts = { glass: null, wheel: 'steel' };
export function n33Model(o: N33Opts = {}): P959Model { const fr = frameOf(o.dims), S0 = buildN33Shell(o), b = new Build(), nn: number[] = [], paint = o.paint ?? '#b8bcc2';
  // the plates and the free parts fitted on the uncut shell, the hole parts' holes cut (docs/systems/115 P2) before it is laid in
  const skin = !o.bare && (o.plateF || o.plateR || freeParts(o.placed).length) ? n33Skin(S0) : null, fits: PlateFit[] = [];
  if (skin && (o.plateF || o.plateR)) {
    for (const m of n33Marks(fr)) { const id = m.name as 'plateF' | 'plateR'; if (!(id === 'plateF' ? o.plateF : o.plateR)) continue; const at = stockPlace(skin, m), p = placedOf(o.placed, id) ?? (at ? { id, at, rot: 0, tilt: 0, scale: 1 } : null), f = p ? fitPlate(skin, p, fits) ?? (at ? fitPlate(skin, { id, at, rot: 0, tilt: 0, scale: 1 }, fits) : null) : null;
      if (f && f.gap < 150) fits.push(f); } }
  const parts = skin && freeParts(o.placed).length ? fitAll(skin, o.placed!, fits.flatMap(f => footprints({ F: f.F, hw: PLATE_W / 2 * f.s, hh: PLATE_H / 2 * f.s, twin: false }))) : [];
  const holes = parts.filter(f => f.hole && f.ok).flatMap(f => f.hole!.cuts), C = holes.length ? cutShell(S0, skin!, holes) : null, S = C?.S ?? S0;
  emitShellFine(b, S, paint, nn);   // the narrow bands cut finer (docs/systems/108 S9)
  if (!o.bare) for (const h of n33Hubs(fr, o.tyres)) wheel(b, h, o.wheel ?? 'steel', o.brake !== false);
  for (const f of fits) drawPlate(b, f, o.plate);
  // the free parts (docs/systems/115 P1, P2: render/car/attach), measured for overlap against the plates
  const crests = skin ? drawPlaced(b, skin, o.placed, paint, [], { fits: parts, cut: C?.done ?? new Set() }).crests : [];
  const M: Mesh = b.mesh(o.dims ? fr.length : DIM.length);
  if (crests.length) M.uv = crestUV(M, crests);
  const lines = p959Lines(S, !o.glass) as MeshLine[];
  M.lines = C ? [...clipLines(lines, skin!, holes.filter(h => C.done.has(h.key))), ...C.rims] : lines;
  M.creases = [...S.crease].map(k => { const [a, c] = k.split('|').map(Number) as [number, number]; return [S.P[a]!, S.P[c]!] as [V, V]; });
  return { mesh: M, shell: S, normals: new Float32Array(nn), shellTris: nn.length / 9, ...(C ? { uncut: S0, holes: C.added } : {}) }; }
export const n33Mesh = (o: N33Opts = {}): Mesh => n33Model(o).mesh;
