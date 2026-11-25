// The bodies built whole from a hand-made model instead of the car kit (docs/systems/109 S5): a design whose base is a
// model body (core/design.ts MODEL_BASES) takes its mesh, its suspension's wheels and its cabin from here, where a kit
// base's go through render/car/design.ts designKit and the kit's assembly. One entry a body; the 959 is the first
// (render/car/p959: its control cage, its parts on their sockets), and the cage-built cars after it (the 993 next)
// join with an entry of the same shape. What every entry gives:
//   mesh      the whole car for a design: the model's body with the design's swaps (Design['body']['model']) and paint,
//             the suspension drawn and rigged about the model's hubs (Mesh.susp: the renderer turns and steers the
//             wheels on it as on a kit car's), the powertrain in its bay, the interior from the cabin's anchors with its
//             needles rigged (Mesh.dials)
//   wheels    the wheels the suspension is built about (the physics' kinematic tables come from the same linkage:
//             render/car/designsusp.ts)
//   gauges    what the cabin's dials are drawn for (the red line, the top speed, the boost)
//   open      the parts lifted off for the builder's engine view
import type { Design, ModelBaseId } from '../../core/design';
import { MODEL_OWN, plateOk } from '../../core/design';
import { Build, KINDS, type Mesh, type MeshLine } from './mesh';
import { p959Mesh, plateText, DIM, type PlateText } from './p959';
import { addSuspension, type SuspWheel } from './suspension';
import { suspFor } from './suspension/setup';
import { addPowertrain, fromDesign, type Detail } from './powertrain';
import type { Site } from './powertrain/layout';
import type { StyleOpt } from './powertrain/style';
import { interiorMesh, INTERIORS, P959_CABIN, P959_GAUGES, type CabinAnchors, type GaugeCar, type InteriorOptions } from './interior';

export interface BodyMeshOpts { /** the powertrain's and the suspension's detail (2 the builder's, 1 the drive's) */ detail?: Detail; /** the look the machinery is drawn in (default: the setting's) */ style?: StyleOpt;
  /** the car's top speed (km/h) for the speedometer's scale (default: the real car's) */ topKmh?: number; /** leave the machinery out (a picture of the body alone) */ bare?: boolean }
export interface ModelBody { name: string; length: number; cabin: CabinAnchors; mesh(d: Design, o?: BodyMeshOpts): Mesh; wheels(d: Design): { f: SuspWheel; r: SuspWheel }; gauges(d: Design, topKmh?: number): GaugeCar; open: readonly string[] }

/** meshes laid into one: each one's parts renumbered after the ones before, its picture coordinates and needles' bones
 *  kept (zero where a mesh has none), its lines joined; the first mesh's rigs and creases stay */
export function joinMeshes(length: number, ...ms: Mesh[]): Mesh {
  const n = ms.reduce((s, m) => s + m.n, 0), names: string[] = [], pos = new Float32Array(n * 9), col = new Uint8Array(n * 3), gloss = new Float32Array(n), part = new Int16Array(n), kind = new Uint8Array(n), tex = new Uint8Array(n);
  const anyUv = ms.some(m => m.uv && m.uv.length === m.n * 9), uv = anyUv ? new Float32Array(n * 9) : undefined, anyDial = ms.some(m => m.dial), dial = anyDial ? new Uint8Array(n) : undefined;
  const lines: MeshLine[] = [], partLines: MeshLine[] = [], creases: NonNullable<Mesh['creases']> = []; let t0 = 0;
  for (const m of ms) { const off = names.length; pos.set(m.pos, t0 * 9); col.set(m.col, t0 * 3); gloss.set(m.gloss, t0); kind.set(m.kind, t0); tex.set(m.tex, t0);
    for (let t = 0; t < m.n; t++) part[t0 + t] = m.part[t]! + off;
    names.push(...(m.names ?? Array.from({ length: Math.max(...m.part) + 1 }, () => '')));
    if (uv && m.uv && m.uv.length === m.n * 9) uv.set(m.uv, t0 * 9); if (dial && m.dial) dial.set(m.dial, t0);
    lines.push(...(m.lines ?? [])); partLines.push(...(m.partLines ?? [])); creases.push(...(m.creases ?? [])); t0 += m.n; }
  const first = ms[0]!;
  return { n, pos, col, gloss, part, kind, tex, length, names, decals: ms.flatMap(m => m.decals ?? []), ...(lines.length ? { lines } : {}), ...(partLines.length ? { partLines } : {}), ...(creases.length ? { creases } : {}),
    ...(uv ? { uv } : {}), ...(dial ? { dial } : {}), ...(first.susp ? { susp: first.susp } : {}), ...(ms.find(m => m.dials) ? { dials: ms.find(m => m.dials)!.dials } : {}) }; }

/** the interior a design's kit asks for: stripped (the drift cabin: buckets, a cage), as built (black), luxurious (tan) */
const cabinFor = (d: Design): InteriorOptions => d.kit.interior === 'light' ? { ...INTERIORS.drift } : d.kit.interior === 'luxury' ? { ...INTERIORS.stock, trim: 'tan' } : { ...INTERIORS.stock };
/** a plate's text from the design (a text the plate cannot draw: one made from the design's id) */
function plateOf(d: Design): PlateText { const t = d.body.model?.plate; if (plateOk(t)) { try { return plateText(t); } catch { /* not drawable: below */ } }
  let h = 7; for (const c of d.id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return plateText(h); }

// ---- the 959 ----
/** its wheels as the suspension takes them: the hubs' stations and tracks (p959/sockets.ts), the design's tyre widths
 *  (the drawn wheel is the model's own, its middle kept), the wheel's closed back as the kit's wheels have it */
function p959Wheels(d: Design): { f: SuspWheel; r: SuspWheel } { const [wf, wr] = d.kit.tyres;
  return { f: { x: DIM.axleF, y: DIM.trackF / 2, r: DIM.tyreR, w: wf, rim: 222, back: 0.6 * wf / 2 }, r: { x: DIM.axleR, y: DIM.trackR / 2, r: DIM.tyreR - 2, w: wr, rim: 222, back: 0.6 * wr / 2 } }; }
/** the 959's powertrain site: the flat six hung behind the rear axle with its gearbox ahead, the two exhaust tips, the
 *  cabin's floor and tunnel (the same place as the style page's, render/car/styleparts.ts) */
const P959_SITE: Site = { length: DIM.length, foot: 150, wheels: { f: { x: DIM.axleF, y: DIM.trackF / 2, r: DIM.tyreR, w: 235, z: DIM.hubZ }, r: { x: DIM.axleR, y: DIM.trackR / 2, r: DIM.tyreR - 2, w: 255, z: DIM.hubZ - 2 } },
  engine: { at: [DIM.axleR + 112, 0, 440], dir: '+x' }, tips: { x: 4258, z: 256, y: [-335, 335], r: 40 }, cabin: { floor: 170, x: [1350, 2900], tunnel: [1350, 110, 330] } };
const P959: ModelBody = { name: '959', length: DIM.length, cabin: P959_CABIN, wheels: p959Wheels, open: ['engineGrille', 'engineLid', 'rearWindow'],
  gauges: (d, topKmh) => ({ ...P959_GAUGES, redline: d.engine.redline, topKmh: topKmh ?? P959_GAUGES.topKmh, ...(d.engine.turbo ? { boostBar: d.engine.boost } : { boostBar: undefined }) }),
  mesh(d, o = {}) { const m = { ...MODEL_OWN.p959, ...d.body.model }, det = o.detail ?? 2;
    const body = p959Mesh({ paint: d.body.paint, bumperF: m.bumperF, bumperR: m.bumperR, lamp: m.lamp, wheel: m.wheel, plate: plateOf(d), brake: !!o.bare, tyres: d.kit.tyres });
    // the paint's gloss as the design sets it (the model is made at 0.6)
    const P = KINDS.indexOf('paint'); for (let t = 0; t < body.n; t++) if (body.kind[t] === P) body.gloss[t] = d.body.gloss;
    if (o.bare) return body;
    // the suspension about the model's hubs, its rig on the body's mesh; the powertrain in the bay behind the cabin
    const b = new Build(), S = addSuspension(b, suspFor('p959', d.susp), p959Wheels(d), { detail: det, setup: d.susp, ...(o.style ? { style: o.style } : {}) });
    addPowertrain(b, fromDesign(d), P959_SITE, { detail: det, ...(o.style ? { style: o.style } : {}) });
    const mach = b.mesh(DIM.length), cab = interiorMesh({ ...cabinFor(d), cabin: P959_CABIN, gauges: this.gauges(d, o.topKmh), length: DIM.length });
    return { ...joinMeshes(DIM.length, body, mach, cab), susp: S.rig }; } };

/** the model-built bodies, by their base's id */
export const MODEL_BODIES: Record<ModelBaseId, ModelBody> = { p959: P959 };
