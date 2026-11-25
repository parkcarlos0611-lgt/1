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
//   anchors   where the speed effects start: the wing's tips, the tail lamps (render/live/trails.ts; also on the mesh)
import type { Design, ModelBaseId } from '../../core/design';
import { MODEL_OWN, plateOk } from '../../core/design';
import { CAR_599 } from '../../core/names';
import { Build, KINDS, type CarAnchors, type Mesh, type MeshLine } from './mesh';
import { p959Mesh, plateText, DIM, STOCK_FRAME, type Frame, type PlateText } from './p959';
import { addSuspension, type SuspWheel } from './suspension';
import { suspFor } from './suspension/setup';
import { addPowertrain, fromDesign, type Detail } from './powertrain';
import type { Site } from './powertrain/layout';
import type { StyleOpt } from './powertrain/style';
import { interiorMesh, INTERIORS, P959_CABIN, P959_GAUGES, type CabinAnchors, type GaugeCar, type InteriorOptions } from './interior';

export interface BodyMeshOpts { /** the powertrain's and the suspension's detail (2 the builder's, 1 the drive's) */ detail?: Detail; /** the look the machinery is drawn in (default: the setting's) */ style?: StyleOpt;
  /** the car's top speed (km/h) for the speedometer's scale (default: the real car's) */ topKmh?: number; /** leave the machinery out (a picture of the body alone) */ bare?: boolean }
export interface ModelBody { name: string; length: number; cabin: CabinAnchors; /** where the speed effects start (wing tips, tail lamps) */ anchors?: CarAnchors; mesh(d: Design, o?: BodyMeshOpts): Mesh; wheels(d: Design): { f: SuspWheel; r: SuspWheel }; gauges(d: Design, topKmh?: number): GaugeCar; open: readonly string[] }

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
function p959Wheels(d: Design, f: Frame = frameFor(d)): { f: SuspWheel; r: SuspWheel } { const [wf, wr] = d.kit.tyres;
  return { f: { x: f.axleF, y: f.trackF / 2, r: DIM.tyreR, w: wf, rim: 222, back: 0.6 * wf / 2 }, r: { x: f.axleR, y: f.trackR / 2, r: DIM.tyreR - 2, w: wr, rim: 222, back: 0.6 * wr / 2 } }; }
/** the frame a design's body is stretched by (docs/systems/115 §4-4) */
function frameFor(_d: Design): Frame { return STOCK_FRAME; }
/** the 959's powertrain site: the flat six hung behind the rear axle with its gearbox ahead, the two exhaust tips, the
 *  cabin's floor and tunnel (the same place as the style page's, render/car/styleparts.ts) */
const siteOf = (f: Frame): Site => { const z = (v: number) => f.at([0, 0, v])[2], tip = f.at([4258, 335, 256]);
  return { length: f.length, foot: 150 + f.ride, wheels: { f: { x: f.axleF, y: f.trackF / 2, r: DIM.tyreR, w: 235, z: DIM.hubZ }, r: { x: f.axleR, y: f.trackR / 2, r: DIM.tyreR - 2, w: 255, z: DIM.hubZ - 2 } },
    engine: { at: [f.axleR + 112, 0, z(440)], dir: '+x' }, tips: { x: tip[0], z: tip[2], y: [-tip[1], tip[1]], r: 40 }, cabin: { floor: z(170), x: [f.x(1350), f.x(2900)], tunnel: [f.x(1350), 110, z(330)] } }; };
/** the 959's speed-effect anchors (render/live/trails.ts): the wing blade's outer trailing corners (its top, where the
 *  air leaves it) and the tail-lamp bar's outer halves, a little behind their faces; left (+y) first */
const anchorsOf = (f: Frame): CarAnchors => ({ tips: [f.at([4215, 760, 885]), f.at([4215, -760, 885])], lamps: [f.at([4262, 560, 623]), f.at([4262, -560, 623])] });
const P959_ANCHORS = anchorsOf(STOCK_FRAME);
/** the cabin's anchors carried by the frame: every place and height as the surface is, the half widths by the width's scale */
export function cabinOf(f: Frame, A: CabinAnchors = P959_CABIN): CabinAnchors { const z = (v: number) => f.at([0, 0, v])[2], y = (v: number) => v * f.kY;
  return { ...A, floorZ: z(A.floorZ), dashX: f.x(A.dashX), dashTopZ: z(A.dashTopZ), screenFoot: [f.x(A.screenFoot[0]), z(A.screenFoot[1])], screenTop: [f.x(A.screenTop[0]), z(A.screenTop[1])], screenHalf: [y(A.screenHalf[0]), y(A.screenHalf[1])],
    wheel: f.at(A.wheel), hip: f.at(A.hip), half: y(A.half), doorX: [f.x(A.doorX[0]), f.x(A.doorX[1])], sillZ: z(A.sillZ), beltZ: z(A.beltZ), tunnelZ: z(A.tunnelZ), rearX: f.x(A.rearX), shelfZ: z(A.shelfZ), roofZ: z(A.roofZ), roofHalf: y(A.roofHalf),
    ...(A.doorIn ? { doorIn: A.doorIn.map(([h, w]) => [z(h), y(w)] as [number, number]) } : {}), ...(A.wellX !== undefined ? { wellX: f.x(A.wellX) } : {}), ...(A.rearHalf !== undefined ? { rearHalf: y(A.rearHalf) } : {}) }; }
const P959: ModelBody = { name: CAR_599, length: DIM.length, cabin: P959_CABIN, anchors: P959_ANCHORS, wheels: p959Wheels, open: ['engineGrille', 'engineLid', 'rearWindow'],
  gauges: (d, topKmh) => ({ ...P959_GAUGES, redline: d.engine.redline, topKmh: topKmh ?? P959_GAUGES.topKmh, ...(d.engine.turbo ? { boostBar: d.engine.boost } : { boostBar: undefined }) }),
  mesh(d, o = {}) { const m = { ...MODEL_OWN.p959, ...d.body.model }, det = o.detail ?? 2, f = frameFor(d), anchors = anchorsOf(f);
    const body = p959Mesh({ ...(f === STOCK_FRAME ? {} : { dims: f.dims }), paint: d.body.paint, bumperF: m.bumperF, bumperR: m.bumperR, lamp: m.lamp, wheel: m.wheel, plate: plateOf(d), plateF: m.plateF !== false, plateR: m.plateR !== false, brake: !!o.bare, tyres: d.kit.tyres });
    // the paint's gloss as the design sets it (the model is made at 0.6)
    const P = KINDS.indexOf('paint'); for (let t = 0; t < body.n; t++) if (body.kind[t] === P) body.gloss[t] = d.body.gloss;
    if (o.bare) return body;
    // the suspension about the model's hubs, its rig on the body's mesh; the powertrain in the bay behind the cabin
    const b = new Build(), S = addSuspension(b, suspFor('p959', d.susp), p959Wheels(d, f), { detail: det, setup: d.susp, ...(o.style ? { style: o.style } : {}) });
    addPowertrain(b, fromDesign(d), siteOf(f), { detail: det, ...(o.style ? { style: o.style } : {}) });
    const mach = b.mesh(f.length), cab = interiorMesh({ ...cabinFor(d), cabin: f === STOCK_FRAME ? P959_CABIN : cabinOf(f), gauges: this.gauges(d, o.topKmh), length: f.length });
    return { ...joinMeshes(f.length, body, mach, cab), susp: S.rig, anchors }; } };

/** the model-built bodies, by their base's id */
export const MODEL_BODIES: Record<ModelBaseId, ModelBody> = { p959: P959 };
