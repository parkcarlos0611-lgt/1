// A car's design (core/design.ts) made into the car kit's assembly spec and its mesh (docs/systems/98_alpha_interface_and_builder_plan.md,
// B1). The body is a base (a platform of the kit: render/car/cars/<id>.kit.ts, its lines and its panels sized for it) with
// the swap patches for the chosen kinds laid over it; a kind that is the base's own needs no patch. The face (the prow, the
// bumper, the grille, the head lamps, the auxiliary lamps) is render/car/face.ts's. The paint goes into
// the colours, the body's dimensions into the lines' tweak (the wheelbase, the width and the track stretch the lines; the
// roof, the overhangs, the ride, the cabin and the rake warp the built body: kit/lines.ts makeWarp), the tyres' widths and
// the rims' size into the wheels, the wing (the base's own for the tail chosen) and the diffuser when the kit has them.
import type { BaseId, BodyBase, Design, Face, NoseKind, TailKind, WheelKind } from '../../core/design';
import { FACE_KINDS, NOSES, TAILS, WHEELS, isModelBase } from '../../core/design';
import { MODEL_BODIES, type BodyMeshOpts } from './bodies';
import { faceKit } from './face';
import type { Mesh } from './mesh';
import { assemble } from './kit/assemble';
import type { Tweak } from './kit/lines';
import type { CarKit } from './kit/spec';
import { fromDesign, fromEngineSpec, type Detail, type PowertrainSpec } from './powertrain';
import { BAYS } from '../../race/fit';
import { enginePackage } from '../../race/designparts';
import { F355_CAPSULE_TAIL, F355_DISC_WHEEL, F355_FIVE_SPOKE, F355_FIXED_WING, F355_FRAME_TAIL, F355_KIT, F355_ROUND_TAIL } from './cars/f355.kit';
import { NSX_ACTIVE_WING, NSX_CAPSULE_TAIL, NSX_DISC_WHEEL, NSX_DUCKTAIL, NSX_KIT, NSX_ROUND_TAIL, NSX_STAR_WHEEL } from './cars/nsx.kit';
import { EB110_DUCKTAIL, EB110_FIVE_SPOKE, EB110_FIXED_WING, EB110_FRAME_TAIL, EB110_KIT, EB110_ROUND_TAIL, EB110_STAR_WHEEL } from './cars/eb110.kit';

/** a base: its kit, its own rim (in), the patch for every other tail and wheel (the face's: face.ts), its rear wing for each tail (a tail's
 *  patch that carries a wing of its own, or none, is overridden: the design's kit says whether there is one) */
interface Base {
  kit: CarKit; rim: number;
  tail: Record<TailKind, Partial<CarKit> | null>; wheel: Record<WheelKind, Partial<CarKit> | null>;
  wing: Record<TailKind, NonNullable<CarKit['wing']>>;
}
const each = <T>(w: T): Record<TailKind, T> => ({ frame: w, roundLamps: w, ducktail: w, capsule: w });
const BASE: Record<BaseId, Base> = {
  nsx: { kit: NSX_KIT, rim: 16,
    tail: { frame: null, roundLamps: NSX_ROUND_TAIL, ducktail: NSX_DUCKTAIL, capsule: NSX_CAPSULE_TAIL }, wheel: { fiveSpoke: null, disc: NSX_DISC_WHEEL, star: NSX_STAR_WHEEL },
    wing: each(NSX_ACTIVE_WING.wing!) },
  f355: { kit: F355_KIT, rim: 18,
    tail: { frame: F355_FRAME_TAIL, roundLamps: F355_ROUND_TAIL, ducktail: null, capsule: F355_CAPSULE_TAIL }, wheel: { fiveSpoke: F355_FIVE_SPOKE, disc: F355_DISC_WHEEL, star: null },
    wing: each(F355_FIXED_WING.wing!) },
  eb110: { kit: EB110_KIT, rim: 18,
    tail: { frame: EB110_FRAME_TAIL, roundLamps: EB110_ROUND_TAIL, ducktail: EB110_DUCKTAIL, capsule: null }, wheel: { fiveSpoke: EB110_FIVE_SPOKE, disc: null, star: EB110_STAR_WHEEL },
    wing: { ...each(EB110_FIXED_WING.wing!), capsule: EB110_KIT.wing! } },
};
/** the undertray's diffuser as the kit draws it */
const DIFFUSER = { fins: 5, depth: 40 };

/** a colour darkened toward black (the shut lines' shadow in the paint) */
function darken(hex: string, k: number): string {
  const n = parseInt(hex.replace('#', ''), 16), ch = (s: number) => Math.round(((n >> s) & 255) * k).toString(16).padStart(2, '0');
  return Number.isNaN(n) ? hex : `#${ch(16)}${ch(8)}${ch(0)}`;
}

/** the design's body as the kit's assembly spec and the tweak to its lines */
export function designKit(d: Design, detail?: Detail): { kit: CarKit; tweak: Tweak } {
  const b = d.body; if (isModelBase(b.base)) throw new Error(`design: ${b.base} is a model-built body (render/car/bodies.ts), not the kit's`);
  const B = BASE[b.base]; if (!B) throw new Error(`design: no base ${b.base}`);
  // the face first (a tail's patch may carry lines of its own over the prow's: the deck's)
  let kit: CarKit = faceKit(b.base, b);
  for (const p of [B.tail[b.tail], B.wheel[b.wheel]]) if (p) kit = { ...kit, ...p };
  // the paint: its own shut lines' shadow unless it is the base's own colour
  const c = B.kit.colours;
  kit.colours = { ...c, paint: b.paint, gloss: b.gloss, seam: b.paint.toLowerCase() === c.paint.toLowerCase() ? c.seam : darken(b.paint, 0.3) };
  // the wheels: the tyres' widths, the rims scaled from the base's own size (the tyres' outer radius kept)
  const W = kit.lines.wheels, rk = d.kit.rim / B.rim, [tf, tr] = d.kit.tyres;
  if (rk !== 1 || tf !== W.f.w || tr !== W.r.w) kit.lines = { ...kit.lines, wheels: { f: { ...W.f, w: tf, rim: Math.round(W.f.rim * rk) }, r: { ...W.r, w: tr, rim: Math.round(W.r.rim * rk) } } };
  // the rear wing and the diffuser
  kit.wing = d.kit.wing ? B.wing[b.tail] : undefined; kit.diffuser = d.kit.diffuser ? DIFFUSER : undefined;
  // the suspension's settings (format 5: render/car/suspension/setup.ts; the physics builds the same corners)
  kit.susp = d.susp;
  const tweak: Tweak = {}; if (b.wheelbase) tweak.wheelbase = b.wheelbase; if (b.width) tweak.halfWidth = b.width; if (b.track) tweak.halfTrack = b.track / 2;
  for (const k of ['roof', 'overhangF', 'overhangR', 'ride', 'cabin', 'rake'] as const) if (b[k]) tweak[k] = b[k];
  // the powertrain: the design's engine and drive in the base's bay (render/car/powertrain)
  kit.engine = { ...kit.engine, opts: { ...kit.engine.opts, powertrain: designPowertrain(d), ...(detail === undefined ? {} : { detail }) } };
  return { kit, tweak };
}
/** the design's powertrain: its engine and drive; machinery that is the base's own car's keeps that engine's colours and label */
export function designPowertrain(d: Design): PowertrainSpec {
  if (isModelBase(d.body.base)) return fromDesign(d);
  const own = BASE[d.body.base].kit.engine.spec, o = fromEngineSpec(own), p = fromDesign(d, own), { colours: _c, crinkle: _k, label: _l, litres: _v, ...rest } = o; void _c; void _k; void _l; void _v;
  const same = Math.abs(p.litres - o.litres) < 0.06 && (Object.keys(rest) as (keyof typeof rest)[]).every(k => p[k] === o[k]);
  if (same) return { ...p, litres: o.litres, colours: o.colours, crinkle: o.crinkle, ...(o.label ? { label: o.label } : {}) };
  // an engine across the car too long for a gearbox on its end has it behind, under the crank (race/fit.ts: the Miura's arrangement)
  return BAYS[d.body.base]?.orient === 'mid-transverse' && enginePackage(d).length / 2 + 0.1 > 0.45 ? { ...p, gearboxBehind: true } : p; }

/** the design's car; `spin` turns the wheels, `lamps` 0..1 raises the head lamps, `wing` 0..1 an active rear wing (a fixed one stands always);
 *  `powertrain` the powertrain's detail (2 the builder's, the default; 1 or 0 a lighter car for the drive) */
export function designMesh(d: Design, spin = 0, lamps = 0, wing = 0, powertrain?: Detail, o: Omit<BodyMeshOpts, 'detail'> = {}): Mesh {
  // a model-built body (the 959): its own mesh, the machinery and the cabin in it (render/car/bodies.ts); no pop-up lamps or active wing
  if (isModelBase(d.body.base)) return MODEL_BODIES[d.body.base].mesh(d, { ...o, ...(powertrain === undefined ? {} : { detail: powertrain }) });
  const { kit, tweak } = designKit(d, powertrain); return assemble(kit, { spin, lamps, wing, tweak }).mesh;
}
/** the parts the builder's engine view lifts off a body (the deck's lids and glass) */
export const openParts = (base: BodyBase, kit: readonly string[]): readonly string[] => isModelBase(base) ? MODEL_BODIES[base].open : kit;

/** the kinds the builder offers on a base: every one closes on every base (tests/car_design.test.ts tries every combination) */
export function designChoices(base: BaseId): { nose: NoseKind[]; tail: TailKind[]; wheel: WheelKind[] } & { [K in keyof Face]: Face[K][] } {
  const B = BASE[base]; if (!B) throw new Error(`design: no base ${base}`);
  return { nose: NOSES, ...FACE_KINDS, tail: TAILS.filter(k => k in B.tail), wheel: WHEELS.filter(k => k in B.wheel) };
}

/** the mesh without the parts of these names (the builder's engine view: the deck's lids and glass lifted off) */
export function withoutParts(M: Mesh, names: readonly string[]): Mesh {
  const N = M.names ?? [], drop = new Set(N.flatMap((n, k) => names.includes(n) ? [k] : [])), keep: number[] = [];
  for (let t = 0; t < M.n; t++) if (!drop.has(M.part[t]!)) keep.push(t);
  const pick = <A extends Float32Array | Uint8Array | Int16Array>(a: A, w: number, make: (n: number) => A): A => { const o = make(keep.length * w); keep.forEach((t, i) => o.set(a.subarray(t * w, t * w + w), i * w)); return o; };
  return { ...M, n: keep.length, pos: pick(M.pos, 9, n => new Float32Array(n)), col: pick(M.col, 3, n => new Uint8Array(n)), gloss: pick(M.gloss, 1, n => new Float32Array(n)),
    part: pick(M.part, 1, n => new Int16Array(n)), kind: pick(M.kind, 1, n => new Uint8Array(n)), tex: pick(M.tex, 1, n => new Uint8Array(n)) }; }
