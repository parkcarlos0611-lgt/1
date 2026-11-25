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
import { freeParts } from '../../core/placed';
import { stockParts } from './attach/stock';
import type { Design, ModelBaseId } from '../../core/design';
import { MODEL_OWN, plateOk } from '../../core/design';
import { CAR_599, CAR_N33 } from '../../core/names';
import { Build, KINDS, type CarAnchors, type Mesh, type MeshLine } from './mesh';
import { p959Mesh, plateText, DIM, STOCK_FRAME, frameOf, buildShell, shellSkin, sockets, type Frame, type PlateText } from './p959';
import type { Skin } from './skin';
import type { Mark } from './p959/sockets';
import { interiorOfKit } from '../../core/frames';
import { n33Model, n33Skin, n33Marks, buildN33Shell, frameOf as n33FrameOf, STOCK_FRAME as N33_STOCK, DIM as N33_DIM } from './n33';
import { addSuspension, type SuspWheel } from './suspension';
import { suspFor } from './suspension/setup';
import { addPowertrain, fromDesign, type Detail } from './powertrain';
import type { Site } from './powertrain/layout';
import type { StyleOpt } from './powertrain/style';
import { interiorMesh, INTERIORS, TRIMS, P959_CABIN, P959_GAUGES, type CabinAnchors, type GaugeCar, type InteriorOptions } from './interior';

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

/** the interior a design asks for: its set (docs/systems/115 §4-3: the stock cabin or the drift one, buckets and a cage)
 *  in its trim; an older design's from its kit (stripped: the drift set; as built: stock in black; luxurious: in tan) */
const cabinFor = (d: Design): InteriorOptions => { const p = d.interior ?? interiorOfKit(d.kit.interior); return { ...INTERIORS[p.set], trim: p.trim }; };
/** a plate's text from the design (a text the plate cannot draw: one made from the design's id) */
function plateOf(d: Design): PlateText { const t = d.body.model?.plate; if (plateOk(t)) { try { return plateText(t); } catch { /* not drawable: below */ } }
  let h = 7; for (const c of d.id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return plateText(h); }

// ---- the 959 ----
/** its wheels as the suspension takes them: the hubs' stations and tracks (p959/sockets.ts), the design's tyre widths
 *  (the drawn wheel is the model's own, its middle kept), the wheel's closed back as the kit's wheels have it */
function p959Wheels(d: Design, f: Frame = frameFor(d)): { f: SuspWheel; r: SuspWheel } { const [wf, wr] = d.kit.tyres;
  return { f: { x: f.axleF, y: f.trackF / 2, r: DIM.tyreR, w: wf, rim: 222, back: 0.6 * wf / 2 }, r: { x: f.axleR, y: f.trackR / 2, r: DIM.tyreR - 2, w: wr, rim: 222, back: 0.6 * wr / 2 } }; }
/** the frame a design's body is stretched by (docs/systems/115 §4-4) */
function frameFor(d: Design): Frame { const f = d.body.frame; return f && Object.values(f.dims).some(v => v) ? frameOf(f.dims) : STOCK_FRAME; }
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
    ...(A.cowl ? { cowl: A.cowl.map(([w, x]) => [y(w), f.x(x)] as [number, number]) } : {}), ...(A.rear ? { rear: { seatX: [f.x(A.rear.seatX[0]), f.x(A.rear.seatX[1])] as [number, number], backTop: [f.x(A.rear.backTop[0]), z(A.rear.backTop[1])] as [number, number], shelf: [f.x(A.rear.shelf[0]), z(A.rear.shelf[1]), y(A.rear.shelf[2])] as [number, number, number] } } : {}),
    ...(A.doorIn ? { doorIn: A.doorIn.map(([h, w]) => [z(h), y(w)] as [number, number]) } : {}), ...(A.wellX !== undefined ? { wellX: f.x(A.wellX) } : {}), ...(A.rearHalf !== undefined ? { rearHalf: y(A.rearHalf) } : {}) }; }
const P959: ModelBody = { name: CAR_599, length: DIM.length, cabin: P959_CABIN, anchors: P959_ANCHORS, wheels: p959Wheels, open: ['engineGrille', 'engineLid', 'rearWindow'],
  gauges: (d, topKmh) => ({ ...P959_GAUGES, redline: d.engine.redline, topKmh: topKmh ?? P959_GAUGES.topKmh, ...(d.engine.turbo ? { boostBar: d.engine.boost } : { boostBar: undefined }) }),
  mesh(d, o = {}) { const m = { ...MODEL_OWN.p959, ...d.body.model }, det = o.detail ?? 2, f = frameFor(d), anchors = anchorsOf(f);
    const body = p959Mesh({ ...(f === STOCK_FRAME ? {} : { dims: f.dims }), ...(d.body.glass !== undefined ? { glass: d.body.glass } : {}), ...(m.details === false ? { details: false } : {}), ...(m.smalls === false ? { smalls: false } : {}), ...(m.openings === false ? { openings: false } : {}), paint: d.body.paint, bumperF: m.bumperF, bumperR: m.bumperR, lamp: m.lamp, wheel: m.wheel, plate: plateOf(d), plateF: m.plateF !== false, plateR: m.plateR !== false, ...(d.body.parts ? { placed: d.body.parts } : {}), brake: !!o.bare, tyres: d.kit.tyres });
    // the paint's gloss as the design sets it (the model is made at 0.6)
    const P = KINDS.indexOf('paint'); for (let t = 0; t < body.n; t++) if (body.kind[t] === P) body.gloss[t] = d.body.gloss;
    if (o.bare) return body;
    // the suspension about the model's hubs, its rig on the body's mesh; the powertrain in the bay behind the cabin
    const b = new Build(), S = addSuspension(b, suspFor('p959', d.susp), p959Wheels(d, f), { detail: det, setup: d.susp, ...(o.style ? { style: o.style } : {}) });
    addPowertrain(b, fromDesign(d), siteOf(f), { detail: det, ...(o.style ? { style: o.style } : {}) });
    const mach = b.mesh(f.length), cab = interiorMesh({ ...cabinFor(d), cabin: f === STOCK_FRAME ? P959_CABIN : cabinOf(f), gauges: this.gauges(d, o.topKmh), length: f.length });
    return { ...joinMeshes(f.length, body, mach, cab), susp: S.rig, anchors }; } };

// ---- the N33 (docs/systems/117 R1, R2): its lump "차체 B", its glass sets and its own interior sets (right-hand drive:
//      the stock one with four dials, the four-spoke wheel and the centre stack's three gauges; the tuned one with a dished
//      wheel, buckets and a boost pod on the A pillar); its parts (R3) are still to come. The straight six lengthwise
//      under the bonnet, its clutch end at the bulkhead; its own multilinks (R4)
/** the N33's interior set for a design (the frame's two sets: stock, and the tuned one in the drift set's place) in its trim */
export const n33CabinFor = (d: Design): InteriorOptions => { const p = d.interior ?? interiorOfKit(d.kit.interior); return { ...INTERIORS[p.set === 'drift' ? 'n33Sport' : 'n33Stock'], trim: p.trim, ...(p.set === 'drift' ? { bucketColour: TRIMS[p.trim].seat } : {}) }; };
/** its cabin: the screen's foot at x 1370, z 962, its top at 2060, 1320; the doors 1530..2855, their skin's inside about
 *  800 from the middle at the elbow; the sill's top inside at 400; the rear wells from x 3290; right-hand drive */
export const N33_CABIN: CabinAnchors = { side: -1, floorZ: 200, dashX: 1720, dashTopZ: 925, screenFoot: [1545, 948], screenTop: [2070, 1318], screenHalf: [612, 490], wheel: [1990, -372, 845], rake: 22,
  hip: [2410, -372, 505], recline: 23, half: 780, doorX: [1530, 2855], sillZ: 400, beltZ: 918, tunnelHalf: 110, tunnelZ: 340, rearX: 3330, shelfZ: 700, roofZ: 1310, roofHalf: 510,
  // the door skin's inside (the skin less 24 mm: 836 at the elbow, 812 at z 800, the belt's 732), the card's front edge nearly upright
  doorIn: [[400, 812], [560, 818], [700, 815], [800, 790], [860, 756], [918, 708]], doorLean: 50, wellX: 3300, rearHalf: 610,
  // the screen's foot as the cowl bows (measured on the shell: 1425 on the centre line, 1575 at the glass's corner)
  cowl: [[0, 1428], [200, 1440], [300, 1454], [400, 1478], [500, 1518], [560, 1550], [612, 1576], [700, 1600]],
  // the 2+2's rear seats between the doors' rear edge and the rear wells, their backs' top under the rear screen, the shelf to the screen's foot
  rear: { seatX: [2900, 3290], backTop: [3445, 905], shelf: [4020, 992, 520] } };
const n33FrameFor = (d: Design) => { const f = d.body.frame; return f && f.id === 'B33' && Object.values(f.dims).some(v => v) ? n33FrameOf(f.dims) : N33_STOCK; };
function n33Wheels(d: Design, f = n33FrameFor(d)): { f: SuspWheel; r: SuspWheel } { const [wf, wr] = d.kit.tyres;
  return { f: { x: f.axleF, y: f.trackF / 2, r: N33_DIM.tyreR, w: wf, rim: N33_DIM.rimR, back: 0.6 * wf / 2 }, r: { x: f.axleR, y: f.trackR / 2, r: N33_DIM.tyreR, w: wr, rim: N33_DIM.rimR, back: 0.6 * wr / 2 } }; }
const n33Site = (f: Frame): Site => { const z = (v: number) => f.at([0, 0, v])[2], tip = f.at([4560, 430, 300]);
  return { length: f.length, foot: 150 + f.ride, wheels: { f: { x: f.axleF, y: f.trackF / 2, r: N33_DIM.tyreR, w: 245, z: N33_DIM.hubZ }, r: { x: f.axleR, y: f.trackR / 2, r: N33_DIM.tyreR, w: 245, z: N33_DIM.hubZ } },
    engine: { at: [f.x(1640), 0, z(470)], dir: '-x' }, tips: { x: tip[0], z: tip[2], y: [tip[1] - 35, tip[1] + 35], r: 38 }, cabin: { floor: z(200), x: [f.x(1700), f.x(3290)], tunnel: [f.x(1700), 110, z(340)] } }; };
const n33Anchors = (f: Frame): CarAnchors => ({ tips: [f.at([4445, 640, 958]), f.at([4445, -640, 958])], lamps: [f.at([4535, 512, 815]), f.at([4535, -512, 815])] });
const N33: ModelBody = { name: CAR_N33, length: N33_DIM.length, cabin: N33_CABIN, anchors: n33Anchors(N33_STOCK), wheels: n33Wheels, open: ['bonnet'],
  gauges: (d, topKmh) => ({ ...P959_GAUGES, redline: d.engine.redline, topKmh: topKmh ?? 260, odoKm: 3300, tripKm: 33.3, ...(d.engine.turbo ? { boostBar: d.engine.boost } : { boostBar: undefined }) }),
  mesh(d, o = {}) { const m = { ...MODEL_OWN.bnr33, ...d.body.model }, det = o.detail ?? 2, f = n33FrameFor(d);
    // the stock car's own parts (docs/systems/117 R3): the lump's stock set at its places on this frame, beside whatever plates the design placed
    const placed = m.stock && !freeParts(d.body.parts).length ? [...(d.body.parts ?? []), ...stockParts('bnr33', modelSkin({ ...d, body: { ...d.body, parts: undefined } })!.skin, f === N33_STOCK ? undefined : f.dims)] : d.body.parts;
    const body = n33Model({ ...(f === N33_STOCK ? {} : { dims: f.dims }), glass: d.body.glass === undefined ? 'stock' : d.body.glass, paint: d.body.paint, wheel: m.wheel, brake: !!o.bare, tyres: d.kit.tyres,
      plate: plateOf(d), plateF: d.body.model?.plateF !== false, plateR: d.body.model?.plateR !== false, ...(placed ? { placed } : {}) }).mesh;   // a plate is on unless the design took it off (the builder's way; the lump's own swaps take both off)
    const P = KINDS.indexOf('paint'); for (let t = 0; t < body.n; t++) if (body.kind[t] === P) body.gloss[t] = d.body.gloss;
    if (o.bare) return body;
    const b = new Build(), S = addSuspension(b, suspFor('bnr33', d.susp), n33Wheels(d, f), { detail: det, setup: d.susp, ...(o.style ? { style: o.style } : {}) });
    addPowertrain(b, fromDesign(d), n33Site(f), { detail: det, ...(o.style ? { style: o.style } : {}) });
    const mach = b.mesh(f.length), cab = interiorMesh({ ...n33CabinFor(d), cabin: f === N33_STOCK ? N33_CABIN : cabinOf(f, N33_CABIN), gauges: this.gauges(d, o.topKmh), length: f.length });
    return { ...joinMeshes(f.length, body, mach, cab), susp: S.rig, anchors: n33Anchors(f) }; } };

/** the model-built bodies, by their base's id */
export const MODEL_BODIES: Record<ModelBaseId, ModelBody> = { p959: P959, bnr33: N33 };

/** the frame a model body's design is stretched by (its axles' places for the placed parts' figures, race/partsfig.ts) */
export const modelFrame = (d: Design): Frame | null => d.body.base === 'bnr33' ? n33FrameFor(d) : d.body.base === 'p959' ? frameFor(d) : null;
/** a model body's skin as the design builds it (render/car/skin.ts: the builder's picking and the placed parts' rules,
 *  docs/systems/115 §5-2), and its stock plates' marks; the last few kept (a build is about a tenth of a second) */
const SKINS = new Map<string, { skin: Skin; marks: Mark[] }>();
export function modelSkin(d: Design): { skin: Skin; marks: Mark[] } | null { if (d.body.base === 'bnr33') { const f = n33FrameFor(d), key = JSON.stringify(['n33', f.dims, d.body.glass ?? 'u']); let s = SKINS.get(key);
    if (!s) { s = { skin: n33Skin(buildN33Shell({ ...(f === N33_STOCK ? {} : { dims: f.dims }), glass: d.body.glass === undefined ? 'stock' : d.body.glass })), marks: n33Marks(f) }; if (SKINS.size > 4) SKINS.clear(); SKINS.set(key, s); } return s; }
  if (d.body.base !== 'p959') return null;
  const m = { ...MODEL_OWN.p959, ...d.body.model }, f = frameFor(d), key = JSON.stringify([f.dims, d.body.glass ?? 'u', m.details, m.openings, m.bumperF, m.bumperR, m.lamp]); let s = SKINS.get(key);
  if (!s) { const S = buildShell({ ...(f === STOCK_FRAME ? {} : { dims: f.dims }), ...(d.body.glass !== undefined ? { glass: d.body.glass } : {}), ...(m.details === false ? { details: false } : {}), ...(m.openings === false ? { openings: false } : {}), bumperF: m.bumperF, bumperR: m.bumperR, lamps: m.lamp !== 'none' });
    s = { skin: shellSkin(S), marks: sockets(f).marks.filter(k => /^plate/.test(k.name)) }; if (SKINS.size > 4) SKINS.clear(); SKINS.set(key, s); }
  return s; }
