// A car's design (docs/systems/98_alpha_interface_and_builder_plan.md): what the parts builder edits and saves, one
// JSON value per car. Data only; the body is made from it by render/car/design.ts (designKit, the car kit), the
// physics by race/design.ts (designSpec), the fit of its parts by race/fit.ts. The body is a base (a platform of the car
// kit whose panels are sized for it) with its panels' kinds swapped; the machinery is chosen freely, within what the
// engine's development grade allows (docs/systems/99, section 6-1).
// Format 2 (review 177): the engine's development grade and its details (intake, compression, lubrication, block, up to
// four turbos with a boost and an intercooler), the structure's and the panels' materials apart. Format 1's designs
// (saved in browsers, carried in links) are brought to it by normalise().
// Format 3 (alpha 0.11, E1): the body's dimensions beyond the wheelbase and the width (the track, the roof's height, the
// overhangs, the ride height, the cabin's place, the screen's rake), each within its base's own range (BODY_LIMITS); the
// EB110 a third base (K1), with its bumper-mass nose and capsule tail as kinds. Format 2's designs take the base's own
// dimensions (all zero) and load unchanged.
// Format 4 (alpha 0.12, M2: the engine designer): the engine's bore against its stroke (`bs`, the family's), each of its
// parts' quality (-3..+3 over the development grade: race/designparts.ts), and in-line and flat layouts beside the V's
// (the powertrain's meshes build all three). Format 3's designs take the old fixed bore/stroke (1.12) and every quality
// at 0, so they drive exactly as before.
// Format 4 besides (alpha 0.12, E2): the car's face in slots of its own. Format 3's `nose` (the prow, with its bumper) and `front`
// (plain or sunk: the grille and the lamps together) become the prow's plan (`nose`), the bumper, the grille, the head
// lamps (and their units' layout) and the auxiliary lamps, each swapped on every base; what cannot go together is said
// by faceLock (the builder greys it out with the reason). Format 3's designs take their base's own bumper and head lamps
// and the auxiliary lamps their `front` stood for (FRONT_AS): the same look.
// Format 5 (alpha 0.13, M4: the kinematic suspension): the suspension in a part of its own (`susp`): each axle's kind
// (double wishbones, a MacPherson strut, a multilink rear; the 1930s' beam axle on leaf springs named for the
// restoration work and not offered on the 1990s bases), the upper arm's length against the lower's, the roll centre's
// height, the springs as the wheel's frequency, the dampers' bump and rebound, the anti-roll bar, the static camber and
// toe, the front's caster. Format 4's designs take their base's own (SUSP_OWN), as a new design on that base has.
// The two halves of format 4 were made apart (M2 and E2) and are one format; neither half alone was published (alpha
// 0.11 wrote format 3), but a format-4 file written with only one of them (the engine's fields with a `front`, or the
// face's slots with no bore/stroke or quality) is read as format 3 is for the half it lacks (toV4).
// Format 6 (alpha 0.2, docs/systems/115 C1 and §7): the class chosen for the car (`tier`, a rung of race/tiers.ts: the
// cap it is developed under), and `fresh` on a new design whose class is not chosen yet (the builder opens on the class
// pick). The frame, the glass and the interior sets (F1) and the free parts (P1, P2) come into this format next, beside
// these. Formats 1 to 5 have no class: their figures place them (the rung they reach is taken as the chosen one when
// the builder opens them; the figures are race/design.ts's, which this file does not call), and until then no cap holds.
import { BODY_NAME } from './names';
import type { TierId } from '../race/tiers';

/** the kit's platforms (each a car built from the kit: its lines and its panels' measurements) */
export type BaseId = 'nsx' | 'f355' | 'eb110';
/** the bodies built whole from a hand-made model instead of the kit (docs/systems/109 S5: the 959's control cage,
 *  render/car/p959; the 993 next): their shape is the model's own, so they take no face, tail or wheel kinds and no
 *  stretched dimensions; what they swap is their model's own parts (Design['body']['model']). The render side's
 *  registry of them is render/car/bodies.ts */
export type ModelBaseId = 'p959';
/** what a design's body stands on: a kit base or a model-built body */
export type BodyBase = BaseId | ModelBaseId;
/** a model-built body's swaps (the 959's: render/car/p959 P959Opts): the bumpers, the head lamps, the wheels, the
 *  number plate's text. Each body reads the ones it has; a kit body has none */
export interface ModelSwaps { bumperF: 'std' | 'aero' | 'clean'; bumperR: 'std' | 'aero' | 'clean'; lamp: 'round' | 'ellipsoid' | 'square'; wheel: 'hollow5' | 'dish' | 'hole5';
  /** the plate's text, as "12가 3456" (render/car/p959 plateText) */ plate: string;
  /** the front and the rear plate taken off (absent: fitted, as every design before them; only a removed plate is kept,
   *  so an older design's signature does not change) */ plateF?: false; plateR?: false }
/** 'mass': the bumper a volume of its own standing ahead of the bonnet's front edge (the EB110's) */
export type NoseKind = 'round' | 'pointed' | 'mass';
/** format 3's front (to alpha 0.11): the bumper's lamps flush ('plain') or sunk ('sunk'), the grille the base's own */
export type FrontKind = 'plain' | 'sunk';
/** the bumper's shape (its lines' levels and how far each stands forward): 'upright' a near-upright face tucking under
 *  (the NSX's), 'crease' a crease on top, the face full at its middle and swept back to the lip (the F355's), 'wedge'
 *  leaning forward to a low lip (the EB110's), 'airdam' a deep chin with a splitter under it */
export type BumperKind = 'upright' | 'crease' | 'wedge' | 'airdam';
/** the centre intake: 'slot' a low slot with upright bars (the NSX's), 'oval' an oval grille with crossed bars and a badge
 *  (the F355's), 'horseshoe' a small shield on the bumper's middle between two barred intakes (the EB110's), 'mesh' one
 *  wide mouth with a mesh across it, 'none' a plain bumper */
export type GrilleKind = 'slot' | 'oval' | 'horseshoe' | 'mesh' | 'none';
/** the head lamps: covers that rise, fixed units in a pocket under a clear cover, lenses flush in the skin */
export type HeadKind = 'popup' | 'pocket' | 'fixed';
/** the lamp units' layout (a pop-up's pod, a pocket's units, a flush lens's): two square units, one wide one, two round ones */
export type PodKind = 'twin' | 'single' | 'round';
/** the bumper's auxiliary lamps: a flat strip (side and turn lamps, the fog lamps behind the outer intakes), round fog
 *  lamps sunk in recesses with the turn lamps in a slot, none */
export type AuxKind = 'strip' | 'round' | 'none';
/** 'capsule': one plain panel leaning back under the deck's edge, capsule lamps on it (the EB110's) */
export type TailKind = 'frame' | 'roundLamps' | 'ducktail' | 'capsule';
export type WheelKind = 'fiveSpoke' | 'disc' | 'star';
/** the block's arrangement: in-line (one bank), flat (two banks opposed) and V */
export type Layout = 'I4' | 'I6' | 'F4' | 'F6' | 'V6' | 'V8' | 'V10' | 'V12';
/** the engine's development grade: 1 a mass-production engine, 2 a high-performance production one (the NSX's C30A, the
 *  F355's F129B), 3 a sporting (homologation) one (the Diablo's), 4 one derived from racing (the McLaren F1's S70/2,
 *  the XJ220's JRV-6), 5 a racing engine (Group C, Formula 1) */
export type Grade = 1 | 2 | 3 | 4 | 5;
/** one throttle, a variable-length (resonance) intake, a throttle a cylinder */
export type Intake = 'single' | 'variable' | 'itb';
/** about 8.5:1 (a turbo engine's), 10:1, 11:1 and over */
export type Compression = 'low' | 'mid' | 'high';
export type Sump = 'wet' | 'dry';
export type Block = 'iron' | 'aluminium' | 'magnesium';
export type Valves = 2 | 3 | 4 | 5;
export type Turbos = 0 | 1 | 2 | 3 | 4;
/** the parts whose quality is set apart from the grade (docs/systems/101 1-1, 부품별 품질): -3 (cheap, fragile) .. +3 */
export type QualityPart = 'block' | 'head' | 'intake' | 'exhaust' | 'turbo';
export type EngineQuality = Record<QualityPart, number>;
/** the structure (the monocoque or the frame): steel, high-strength steel, aluminium, aluminium honeycomb, carbon fibre */
export type Structure = 'steel' | 'hss' | 'aluminium' | 'honeycomb' | 'cfrp';
/** the panels hung on it: steel, aluminium, glass fibre, carbon fibre */
export type Panels = 'steel' | 'aluminium' | 'frp' | 'cfrp';
/** the interior: stripped for lightness, as the base's own car, luxurious */
export type Interior = 'light' | 'standard' | 'luxury';

/** the body's dimensions a design changes from its base's own (mm; the rake in degrees), each within BODY_LIMITS */
export interface BodyDims {
  /** added between the arches (-150..+300) and to half the width (-40..+80) */ wheelbase: number; width: number;
  /** added to the track (both sides together: the wheels out from the body, the wells' inner walls with them) */ track: number;
  /** added to the roof's height (the glasshouse above the belt line scaled) */ roof: number;
  /** added to the overhangs: the body stretched ahead of the front arch, behind the rear arch */ overhangF: number; overhangR: number;
  /** the body raised over its wheels (the ground clearance with it) */ ride: number;
  /** the cabin moved forward (+: cab-forward; the screen, the roof and the glass go with it, the engine bay grows behind it) */ cabin: number;
  /** degrees the screen lies further back (+: more raked; its foot stays, its top goes back) */ rake: number }
export type DimKey = keyof BodyDims;
/** the face's slots (format 4): the prow is `nose` */
export interface Face { bumper: BumperKind; grille: GrilleKind; head: HeadKind; pod: PodKind; aux: AuxKind }
export type FaceKey = keyof Face;
/** an axle's kind (alpha 0.13): double wishbones, a MacPherson strut, a multilink (the rear), a beam axle on leaf springs
 *  (the 1930s' bases, for the restoration work: not offered on the 1990s bases) */
export type SuspKind = 'doubleWishbone' | 'macpherson' | 'multilink' | 'beamLeaf';
/** the roll centre's height: the arms' inner pivots set lower or higher (low: a softer start to the roll's geometric share, high: less roll, more jacking) */
export type RcPreset = 'low' | 'mid' | 'high';
/** one axle's suspension (format 5) */
export interface SuspAxle { type: SuspKind;
  /** the upper arm's length over the lower's (a strut has none) */ arm: number; rc: RcPreset;
  /** the springs as the wheel's natural frequency on them (Hz) */ hz: number;
  /** the dampers: a share of the critical damping going up (bump) and coming back (rebound) */ bump: number; rebound: number;
  /** the anti-roll bar, times the base's own (0: none) */ bar: number;
  /** degrees: the static camber (- the top in), the toe (+ in) */ camber: number; toe: number }
export interface SuspDesign { front: SuspAxle & { /** degrees */ caster: number }; rear: SuspAxle }
export type SuspField = keyof SuspAxle | 'caster';
export interface Design {
  /** the format's version */ v: 6;
  id: string; name: string;
  /** format 6: the class chosen (its caps the development's wall: the power by a restrictor, the top speed by a limiter);
   *  none: an older format's design not yet opened in the builder, placed by its figures, held to nothing */ tier?: TierId;
  /** format 6: a new design whose class is not chosen yet (the builder asks first); gone once it is */ fresh?: true;
  body: { base: BodyBase; nose: NoseKind; tail: TailKind; wheel: WheelKind; paint: string; gloss: number; structure: Structure; panels: Panels;
    /** a model-built body's own swaps (MODEL_BASES; a kit body: none). The face, tail and wheel kinds above stay in the
     *  file (they are what the body goes back to on a kit base) but a model body does not read them */ model?: ModelSwaps } & Face & BodyDims;
  engine: { grade: Grade; layout: Layout; /** cc */ cc: number; /** valves a cylinder */ valves: Valves;
    /** the red line (rpm) */ redline: number; intake: Intake; compression: Compression; sump: Sump; block: Block;
    turbo: Turbos; /** the boost at full (bar), when there are turbos */ boost: number; intercooler: boolean;
    /** two cam profiles */ vtec: boolean;
    /** the turbos sequential (the 959's: one blows alone at low revs, the second joins over about 4,300 rpm), so the
     *  boost comes earlier; only with two or more turbos (an older file: none) */ sequential?: boolean;
    /** the bore against the stroke (1: square; over 1 oversquare, revs freely; under 1 long-stroke, more torque low down) */ bs: number;
    /** each part's quality over the grade, -3..+3 (0 for all: the grade's own engine) */ quality: EngineQuality };
  drive: { gears: 5 | 6; gearbox: 'manual' | 'f1'; /** the final drive's ratio; 0: chosen for the top speed */ final: number; lsd: boolean; awd: boolean };
  kit: { abs: boolean; tcs: boolean; steering: 'manual' | 'hydraulic' | 'electric'; dampers: 'fixed' | 'adaptive'; wing: boolean; diffuser: boolean;
    /** tyres' widths front and rear (mm) and the rims (in) */ tyres: [number, number]; rim: 16 | 17 | 18; interior: Interior };
  /** the suspension (format 5) */ susp: SuspDesign;
}
/** format 5 (alpha 0.13): no class */
export interface DesignV5 extends Omit<Design, 'v' | 'tier' | 'fresh'> { v: 5 }
/** format 4 (alpha 0.12): no suspension of its own (its base's) */
export interface DesignV4 extends Omit<DesignV5, 'v' | 'susp'> { v: 4 }
/** the dimensions format 3 added (format 2's designs and older have the base's own: zero) */
type NewDims = Exclude<DimKey, 'wheelbase' | 'width'>;
/** the engine's fields format 4 added (format 3's designs and older: a bore 1.12 times the stroke, every quality 0) */
type NewEngine = 'bs' | 'quality';
/** format 3's body (alpha 0.11): the face as a nose and a front */
export type Body3 = Omit<Design['body'], FaceKey> & { front: FrontKind };
/** format 3 (alpha 0.11): V engines only, no bore/stroke or part quality; the face a nose and a front (a body that has the
 *  face's slots already keeps them) */
export interface DesignV3 extends Omit<Design, 'v' | 'body' | 'engine' | 'susp'> { v: 3; body: Body3 | Design['body']; engine: Omit<Design['engine'], NewEngine | 'layout'> & { layout: 'V6' | 'V8' | 'V12' } }
/** format 2 (review 177 to alpha 0.10): the wheelbase and the width the body's only dimensions */
export interface DesignV2 extends Omit<DesignV3, 'v' | 'body'> { v: 2; body: Omit<Body3, NewDims> }
/** format 1 (before review 177): one material for the whole body, a turbo count that fixed the boost, no grade */
export interface DesignV1 extends Omit<Design, 'v' | 'body' | 'engine' | 'kit' | 'susp'> {
  v: 1; kit: Omit<Design['kit'], 'interior'>; body: Omit<Body3, 'structure' | 'panels' | NewDims> & { material: 'steel' | 'aluminium' };
  engine: { layout: 'V6' | 'V8' | 'V12'; cc: number; valves: Valves; redline: number; turbo: 0 | 1 | 2; vtec: boolean };
}
/** a change to a design, part by part (a fix offered by the fit check, race/fit.ts) */
export type DesignPatch = { [K in 'body' | 'engine' | 'drive' | 'kit']?: Partial<Design[K]> } & { susp?: { front?: Partial<SuspDesign['front']>; rear?: Partial<SuspAxle> } };
export const applyPatch = (d: Design, p: DesignPatch): Design =>
  normalise({ ...d, body: { ...d.body, ...p.body }, engine: { ...d.engine, ...p.engine }, drive: { ...d.drive, ...p.drive }, kit: { ...d.kit, ...p.kit }, susp: { front: { ...d.susp.front, ...p.susp?.front }, rear: { ...d.susp.rear, ...p.susp?.rear } } });

/** the kit's bases (the tables keyed by BaseId are the kit's) */
export const BASES: BaseId[] = ['nsx', 'f355', 'eb110'];
export const MODEL_BASES: ModelBaseId[] = ['p959'];
/** every body a design can stand on: the kit's bases, then the model-built bodies */
export const BODY_BASES: BodyBase[] = [...BASES, ...MODEL_BASES];
/** a model-built body (render/car/bodies.ts), not one of the kit's */
export const isModelBase = (b: BodyBase): b is ModelBaseId => (MODEL_BASES as string[]).includes(b);
/** the kit base a design stands on, or null for a model-built body */
export const kitBase = (b: BodyBase): BaseId | null => isModelBase(b) ? null : b;
export const BUMPERS959: ModelSwaps['bumperF'][] = ['std', 'aero', 'clean'];
export const LAMPS959: ModelSwaps['lamp'][] = ['round', 'ellipsoid', 'square'];
export const WHEELS959: ModelSwaps['wheel'][] = ['hollow5', 'dish', 'hole5'];
/** each model body's own swaps (its real car's); the plate a made-up number (a new design draws its own: designstore fromPreset) */
export const MODEL_OWN: Record<ModelBaseId, ModelSwaps> = { p959: { bumperF: 'std', bumperR: 'std', lamp: 'round', wheel: 'hollow5', plate: '08루 0599' } };
export const NOSES: NoseKind[] = ['round', 'pointed', 'mass'];
export const FRONTS: FrontKind[] = ['plain', 'sunk'];
export const BUMPERS: BumperKind[] = ['upright', 'crease', 'wedge', 'airdam'];
export const GRILLES: GrilleKind[] = ['slot', 'oval', 'horseshoe', 'mesh', 'none'];
export const HEADS: HeadKind[] = ['popup', 'pocket', 'fixed'];
export const PODS: PodKind[] = ['twin', 'single', 'round'];
export const AUXES: AuxKind[] = ['strip', 'round', 'none'];
export const FACE_KEYS: FaceKey[] = ['bumper', 'grille', 'head', 'pod', 'aux'];
export const FACE_KINDS: { [K in FaceKey]: Face[K][] } = { bumper: BUMPERS, grille: GRILLES, head: HEADS, pod: PODS, aux: AUXES };
/** each base's own face (its own car's): the slots a format-3 design had no say in take these */
export const FACE_OWN: Record<BodyBase, Face> = {
  nsx: { bumper: 'upright', grille: 'slot', head: 'popup', pod: 'twin', aux: 'strip' },
  f355: { bumper: 'crease', grille: 'oval', head: 'popup', pod: 'twin', aux: 'round' },
  eb110: { bumper: 'wedge', grille: 'horseshoe', head: 'pocket', pod: 'twin', aux: 'none' },
  /** a model body's face is its model's: these are only what the slots hold in its file */ p959: { bumper: 'wedge', grille: 'none', head: 'fixed', pod: 'round', aux: 'strip' } };
/** what format 3's front stood for on each base: the auxiliary lamps flush or sunk (the EB110's plain front has none: its
 *  turn lamps are at the troughs' mouths on the bonnet) */
export const FRONT_AS: Record<BodyBase, Record<FrontKind, AuxKind>> = { nsx: { plain: 'strip', sunk: 'round' }, f355: { plain: 'strip', sunk: 'round' }, eb110: { plain: 'none', sunk: 'round' }, p959: { plain: 'strip', sunk: 'strip' } };
/** a format-3 body's face: its base's own, the auxiliary lamps its front's */
export const faceOf3 = (base: BodyBase, front: FrontKind): Face => ({ ...FACE_OWN[base], aux: FRONT_AS[base][front] ?? FACE_OWN[base].aux });

// ---- the face's rules: what cannot go together (the builder greys the value out with the reason) ----
/** the bases on which a wide mesh grille runs out to the bumper's corners, where the fog lamps' recesses would be (the
 *  EB110's bumper is wide enough past its mouth for both) */
export const MESH_TAKES_CORNERS: Record<BodyBase, boolean> = { nsx: true, f355: true, eb110: false, p959: false };
/** why a face slot's value cannot be chosen on this body as it stands (Korean), null when it can. The rules:
 *  round fog lamps and a mesh grille both want the bumper's corners (MESH_TAKES_CORNERS).
 *  What only needs re-fitting is not a rule: a grille and the lamps take their rows from the bumper chosen (render/car/face.ts) */
export function faceLock<K extends FaceKey>(b: Face & { base: BodyBase }, k: K, v: Face[K]): string | null {
  const corners = MESH_TAKES_CORNERS[b.base];
  if (k === 'grille' && v === 'mesh' && corners && b.aux === 'round') return '둥근 안개등이 범퍼 모서리를 차지합니다 (보조등을 띠나 없음으로 바꾸면 고를 수 있습니다)';
  if (k === 'aux' && v === 'round' && corners && b.grille === 'mesh') return '메시 그릴이 범퍼 모서리까지 차지해 안개등을 넣을 자리가 없습니다';
  return null; }
/** a body's face with what the rules do not allow put right: a strip for fog lamps the mesh leaves no room for */
export const fitFace = <B extends Face & { base: BodyBase }>(b: B): B => faceLock(b, 'aux', b.aux) ? { ...b, aux: 'strip' } : b;
export const TAILS: TailKind[] = ['frame', 'roundLamps', 'ducktail', 'capsule'];
export const WHEELS: WheelKind[] = ['fiveSpoke', 'disc', 'star'];
export const GRADES: Grade[] = [1, 2, 3, 4, 5];
export const INTAKES: Intake[] = ['single', 'variable', 'itb'];
export const COMPRESSIONS: Compression[] = ['low', 'mid', 'high'];
export const SUMPS: Sump[] = ['wet', 'dry'];
export const BLOCKS: Block[] = ['iron', 'aluminium', 'magnesium'];
export const STRUCTURES: Structure[] = ['steel', 'hss', 'aluminium', 'honeycomb', 'cfrp'];
export const PANELS: Panels[] = ['steel', 'aluminium', 'frp', 'cfrp'];
export const INTERIORS: Interior[] = ['light', 'standard', 'luxury'];
export const LAYOUTS: Layout[] = ['I4', 'I6', 'F4', 'F6', 'V6', 'V8', 'V10', 'V12'];
export const LAYOUT_NAME: Record<Layout, string> = { I4: '직렬 4', I6: '직렬 6', F4: '수평대향 4', F6: '수평대향 6', V6: 'V6', V8: 'V8', V10: 'V10', V12: 'V12' };
export const CYLINDERS: Record<Layout, number> = { I4: 4, I6: 6, F4: 4, F6: 6, V6: 6, V8: 8, V10: 10, V12: 12 };
/** how the layout's banks stand: one in-line bank, two opposed flat, two in a V */
export const BANKS = (l: Layout): 'I' | 'flat' | 'V' => l[0] === 'I' ? 'I' : l[0] === 'F' ? 'flat' : 'V';
export const QUALITY_PARTS: QualityPart[] = ['block', 'head', 'intake', 'exhaust', 'turbo'];
export const NO_QUALITY: EngineQuality = { block: 0, head: 0, intake: 0, exhaust: 0, turbo: 0 };
/** the bore/stroke every design had before format 4 (the NSX's 90 x 78, the F355's 85 x 77) */
export const BS_DEFAULT = 1.12;
/** the parts' physical ranges (no power cap: docs/systems/98 section 9). The wheelbase runs to +300 so the F355's
 *  platform can carry a long V12 (the McLaren F1's 2,718 mm, +268), the width to +80 a side (the Diablo's 2,040 mm) */
export const LIMITS = { wheelbase: [-150, 300], width: [-40, 80], cc: [1000, 8000], redline: [5000, 10000], tyre: [195, 335], final: [2.8, 4.8], boost: [0.3, 1.5],
  /** the bore over the stroke (a long-stroke 0.8 to a racing engine's 1.4) and a part's quality */ bs: [0.8, 1.4], quality: [-3, 3] } as const;
export const DIMS: DimKey[] = ['wheelbase', 'width', 'track', 'roof', 'overhangF', 'overhangR', 'ride', 'cabin', 'rake'];
export const NO_DIMS: BodyDims = { wheelbase: 0, width: 0, track: 0, roof: 0, overhangF: 0, overhangR: 0, ride: 0, cabin: 0, rake: 0 };
/** each base's ranges for its body's dimensions: as far as its lines take them with every body kind still closed at
 *  every seam (tests/car_design.test.ts tries each end on every kind) and the shapes still sound. The wheelbase and the
 *  width are every base's (LIMITS). The cabin: as far as the bonnet ahead of it and the deck behind it can give (the
 *  NSX's screen already stands ahead of the front wheels' backs, the EB110's fastback leaves little deck); the rake: as
 *  far as the roof between the screen's top and the B pillar can shorten; the ride: the EB110 sits lowest (100 mm) */
const BODY_RANGES: Record<BodyBase, Record<NewDims, readonly [number, number]>> = {
  nsx: { track: [-60, 80], roof: [-80, 60], overhangF: [-100, 200], overhangR: [-120, 200], ride: [-30, 50], cabin: [-80, 120], rake: [-5, 8] },
  f355: { track: [-60, 80], roof: [-80, 60], overhangF: [-120, 200], overhangR: [-100, 200], ride: [-30, 50], cabin: [-80, 150], rake: [-5, 8] },
  eb110: { track: [-50, 60], roof: [-60, 60], overhangF: [-120, 160], overhangR: [-80, 200], ride: [-25, 60], cabin: [-100, 120], rake: [-4, 5] },
  /** a model body is its model's shape: nothing stretches (its dimensions stay at zero) */ p959: { track: [0, 0], roof: [0, 0], overhangF: [0, 0], overhangR: [0, 0], ride: [0, 0], cabin: [0, 0], rake: [0, 0] } };
export const BODY_LIMITS = (b: BodyBase): Record<DimKey, readonly [number, number]> => isModelBase(b) ? { wheelbase: [0, 0], width: [0, 0], ...BODY_RANGES[b] } : { wheelbase: LIMITS.wheelbase, width: LIMITS.width, ...BODY_RANGES[b] };

// ---- the suspension (format 5) ----
export const SUSP_KINDS: SuspKind[] = ['doubleWishbone', 'macpherson', 'multilink', 'beamLeaf'];
export const SUSP_KIND_NAME: Record<SuspKind, string> = { doubleWishbone: '더블 위시본', macpherson: '맥퍼슨 스트럿', multilink: '멀티링크', beamLeaf: '일체 차축·판스프링' };
export const RC_PRESETS: RcPreset[] = ['low', 'mid', 'high'];
/** the settings' ranges: the arms' ratio, the wheel's frequency (a soft road car's 1 Hz to a stiff racer's 2.6), the
 *  dampers' shares of critical, the bar's times its base's own, the static camber, the toe and the caster (degrees) */
export const SUSP_LIMITS = { arm: [0.5, 1.0], hz: [1.0, 2.6], bump: [0.1, 0.6], rebound: [0.1, 0.8], bar: [0, 2.5], camber: [-3.5, 1], toe: [-0.5, 0.5], caster: [0, 10] } as const;
/** each base's own suspension (its real car's: double wishbones all round; the arms' ratio and the caster its hardpoints',
 *  render/car/suspension/hardpoints.ts; the springs at the frequencies the physics had before format 5, 1.35 and 1.5 Hz,
 *  the dampers at the 0.28 of critical it had both ways split into a softer bump and a firmer rebound) */
const OWN_AXLE = (arm: number, hz: number, camber: number, toe: number): SuspAxle => ({ type: 'doubleWishbone', arm, rc: 'mid', hz, bump: 0.24, rebound: 0.32, bar: 1, camber, toe });
export const SUSP_OWN: Record<BodyBase, SuspDesign> = {
  nsx: { front: { ...OWN_AXLE(0.7, 1.35, -0.5, 0), caster: 3.4 }, rear: OWN_AXLE(0.72, 1.5, -1, 0.1) },
  f355: { front: { ...OWN_AXLE(0.7, 1.35, -0.5, 0), caster: 3.0 }, rear: OWN_AXLE(0.71, 1.5, -1, 0.1) },
  eb110: { front: { ...OWN_AXLE(0.7, 1.35, -0.5, 0), caster: 2.9 }, rear: OWN_AXLE(0.7, 1.5, -1, 0.1) },
  /** the 959: double wishbones all round with two coil-overs a wheel (the ride height's hydraulics left out), a soft
   *  front for the rally car it came from, a little more rear camber under the engine */
  p959: { front: { ...OWN_AXLE(0.72, 1.3, -0.6, 0), caster: 4.5 }, rear: OWN_AXLE(0.72, 1.45, -1.2, 0.1) } };
/** why an axle's kind cannot be chosen (Korean), null when it can: the beam axle is the 1930s bases' (the restoration
 *  work's), a multilink is a rear's */
export function suspLock(front: boolean, k: SuspKind): string | null {
  if (k === 'beamLeaf') return '1930년대 차대용입니다 (복원 작업에서 쓸 수 있게 됩니다)';
  if (k === 'multilink' && front) return '멀티링크는 뒤 차축에만 씁니다';
  return null; }
/** why a setting does not apply to this kind (null when it does): a strut has no upper arm */
export function suspFieldLock(a: SuspAxle, f: SuspField): string | null { return f === 'arm' && a.type === 'macpherson' ? '스트럿에는 위 팔이 없습니다' : null; }

// ---- the engine's grade and what it allows ----
export const GRADE_NAME: Record<Grade, string> = { 1: '양산', 2: '양산 고성능', 3: '스포츠', 4: '경주 파생', 5: '경주' };
/** what each grade allows: the details in order from the plainest (a detail the grade does not allow falls back to
 *  the best one it does), the most turbos, the boost and the red line it can take. A grade allows all a lower one does */
export const GRADE_RULES: Record<Grade, { intake: Intake[]; compression: Compression[]; sump: Sump[]; block: Block[]; valves: Valves[];
  turbo: Turbos; boost: number; redline: number; vtec: boolean }> = {
  1: { intake: ['single', 'variable'], compression: ['low', 'mid'], sump: ['wet'], block: ['iron', 'aluminium'], valves: [2, 3, 4], turbo: 1, boost: 0.7, redline: 7500, vtec: false },
  2: { intake: ['single', 'variable'], compression: ['low', 'mid', 'high'], sump: ['wet', 'dry'], block: ['iron', 'aluminium'], valves: [2, 3, 4, 5], turbo: 2, boost: 1.0, redline: 9000, vtec: true },
  3: { intake: ['single', 'variable', 'itb'], compression: ['low', 'mid', 'high'], sump: ['wet', 'dry'], block: ['iron', 'aluminium'], valves: [2, 3, 4, 5], turbo: 4, boost: 1.2, redline: 9500, vtec: true },
  4: { intake: ['single', 'variable', 'itb'], compression: ['low', 'mid', 'high'], sump: ['wet', 'dry'], block: ['iron', 'aluminium', 'magnesium'], valves: [2, 3, 4, 5], turbo: 4, boost: 1.5, redline: 10000, vtec: true },
  5: { intake: ['single', 'variable', 'itb'], compression: ['low', 'mid', 'high'], sump: ['wet', 'dry'], block: ['iron', 'aluminium', 'magnesium'], valves: [2, 3, 4, 5], turbo: 4, boost: 1.5, redline: 10000, vtec: true } };
/** the lowest grade that allows an engine detail's value */
export function gradeFor<K extends 'intake' | 'compression' | 'sump' | 'block' | 'valves' | 'turbo' | 'vtec'>(k: K, v: Design['engine'][K]): Grade {
  for (const g of GRADES) { const R = GRADE_RULES[g], a = R[k];
    if (Array.isArray(a) ? (a as unknown[]).includes(v) : typeof a === 'number' ? (v as number) <= a : !v || a) return g; }
  return 5; }
/** why the builder greys an engine detail's value out at this grade (Korean), null when the grade allows it */
export function gradeLock<K extends 'intake' | 'compression' | 'sump' | 'block' | 'valves' | 'turbo' | 'vtec'>(grade: Grade, k: K, v: Design['engine'][K]): string | null {
  const g = gradeFor(k, v); return g <= grade ? null : `${g}등급(${GRADE_NAME[g]})부터 고를 수 있습니다`; }
/** the highest boost and red line a grade takes */
export const gradeBoost = (g: Grade) => Math.min(LIMITS.boost[1], GRADE_RULES[g].boost);
export const gradeRedline = (g: Grade) => Math.min(LIMITS.redline[1], GRADE_RULES[g].redline);

/** the two cars the kit was made from, as designs (the generators are checked against their real figures). The NSX:
 *  an aluminium monocoque and panels, the C30A's variable intake, 10.2:1, a wet sump; the F355: a steel structure and
 *  panels, the F129B's 11:1, a dry sump */
export const DESIGN_NSX: Design = { v: 6, id: 'nsx', name: BODY_NAME.nsx, body: { base: 'nsx', nose: 'round', ...faceOf3('nsx', 'plain'), tail: 'frame', wheel: 'fiveSpoke', ...NO_DIMS, wheelbase: 0, width: 0, paint: '#b0121b', gloss: 0.6, structure: 'aluminium', panels: 'aluminium' },
  engine: { grade: 2, layout: 'V6', cc: 2977, valves: 4, redline: 8000, intake: 'variable', compression: 'mid', sump: 'wet', block: 'aluminium', turbo: 0, boost: 0.8, intercooler: true, vtec: true, bs: BS_DEFAULT, quality: { ...NO_QUALITY } },
  drive: { gears: 5, gearbox: 'manual', final: 4.062, lsd: true, awd: false },
  kit: { abs: true, tcs: true, steering: 'manual', dampers: 'fixed', wing: false, diffuser: false, tyres: [205, 225], rim: 16, interior: 'standard' }, susp: structuredClone(SUSP_OWN.nsx) };
export const DESIGN_F355: Design = { v: 6, id: 'f355', name: BODY_NAME.f355, body: { base: 'f355', nose: 'pointed', ...faceOf3('f355', 'sunk'), tail: 'ducktail', wheel: 'star', ...NO_DIMS, wheelbase: 0, width: 0, paint: '#f5c300', gloss: 0.6, structure: 'steel', panels: 'steel' },
  engine: { grade: 2, layout: 'V8', cc: 3496, valves: 5, redline: 8500, intake: 'single', compression: 'high', sump: 'dry', block: 'aluminium', turbo: 0, boost: 0.8, intercooler: true, vtec: false, bs: BS_DEFAULT, quality: { ...NO_QUALITY } },
  drive: { gears: 6, gearbox: 'manual', final: 4.1, lsd: true, awd: false },
  kit: { abs: true, tcs: false, steering: 'hydraulic', dampers: 'adaptive', wing: false, diffuser: true, tyres: [225, 265], rim: 18, interior: 'standard' }, susp: structuredClone(SUSP_OWN.f355) };

/** the 1987 Porsche 959 (docs/systems/109; data/cars/spec/p959.json), on its own model-built body: the 2,849 cc flat
 *  six from the 956/962's (water-cooled four-valve heads on an air-cooled block, 8.3:1, a dry sump), two KKK turbos
 *  run in sequence with intercoolers at about 1.0 bar, 450 PS (444 hp) at 6,500 and 500 Nm at 5,000, the red line at
 *  7,600; six speeds (the first a crawler, G as Porsche called it: here the builder's six-speed box), four-wheel drive
 *  with the PSK's clutch varying the split (race/design.ts takes the base's own split); a steel monocoque under
 *  aramid and aluminium panels (here FRP's figure for the aramid); ABS; 235/45 ZR17 and 255/40 ZR17; 1,450 kg;
 *  317 km/h. The engine's quality figures land it on its power (tests/p959_game.test.ts) */
export const DESIGN_P959: Design = { v: 6, id: 'p959', name: '599', body: { base: 'p959', nose: 'round', ...faceOf3('p959', 'plain'), tail: 'frame', wheel: 'fiveSpoke', ...NO_DIMS, paint: '#b8bcc2', gloss: 0.6, structure: 'steel', panels: 'frp',
    model: { ...MODEL_OWN.p959 } },
  engine: { grade: 4, layout: 'F6', cc: 2849, valves: 4, redline: 7600, intake: 'single', compression: 'low', sump: 'dry', block: 'aluminium', turbo: 2, boost: 1.0, intercooler: true, vtec: false, sequential: true, bs: 1.4, quality: { ...NO_QUALITY, head: 1, intake: 1, exhaust: 1, turbo: 1 } },
  drive: { gears: 6, gearbox: 'manual', final: 0, lsd: true, awd: true },
  kit: { abs: true, tcs: false, steering: 'hydraulic', dampers: 'adaptive', wing: false, diffuser: false, tyres: [235, 255], rim: 17, interior: 'standard' }, susp: structuredClone(SUSP_OWN.p959) };

// ---- four more cars as designs: the figures' check (docs/systems/99, 1-8), not used to set them ----
// Each is built on one of the bases (the base is only the body: its panels' shapes and sizes), stretched toward the real
// car's wheelbase, width, height and overhangs (the EB110 on its own base); the machinery as the real car's. Real figures in race/cars.ts (NEW.diablo,
// NEW.eb110, NEW.xj220, with their sources) and, for the McLaren F1 (no RaceSpec), below.
/** the 1990 Lamborghini Diablo: 5.7 V12 four valves, 492 hp at 7,000, five speeds, rear drive; a tubular steel frame
 *  with aluminium and composite panels; 2,650 wheelbase, 2,040 wide; 245/40 ZR17 and 335/35 ZR17 */
export const DESIGN_DIABLO: Design = { v: 6, id: 'diablo', name: '시험 차 D', body: { base: 'f355', nose: 'pointed', ...faceOf3('f355', 'plain'), tail: 'frame', wheel: 'star', ...NO_DIMS, wheelbase: 200, width: 70, paint: '#7a1fa2', gloss: 0.6, structure: 'steel', panels: 'aluminium' },
  engine: { grade: 3, layout: 'V12', cc: 5707, valves: 4, redline: 7300, intake: 'single', compression: 'mid', sump: 'wet', block: 'aluminium', turbo: 0, boost: 0.8, intercooler: true, vtec: false, bs: BS_DEFAULT, quality: { ...NO_QUALITY } },
  drive: { gears: 5, gearbox: 'manual', final: 0, lsd: true, awd: false },
  kit: { abs: false, tcs: false, steering: 'manual', dampers: 'fixed', wing: false, diffuser: false, tyres: [245, 335], rim: 17, interior: 'standard' }, susp: structuredClone(SUSP_OWN.f355) };
/** the 1991 Bugatti EB110 GT, on its own base (the kit's EB110: render/car/cars/eb110.kit.ts, the real car's 2,550 mm
 *  wheelbase and 1,940 mm width): 3.5 V12 five valves, four IHI turbos with intercoolers at about 1.05 bar, 553 hp at
 *  8,000, 7.5:1, a dry sump; six speeds, four-wheel drive; a carbon-fibre monocoque (Aérospatiale's) with aluminium
 *  panels; a luxurious interior (leather, air conditioning: heavy for its materials); its active rear wing; 245/40 ZR18
 *  and 325/30 ZR18; 1,620 kg; 342 km/h */
export const DESIGN_EB110: Design = { v: 6, id: 'eb110', name: BODY_NAME.eb110, body: { base: 'eb110', nose: 'mass', ...faceOf3('eb110', 'plain'), tail: 'capsule', wheel: 'disc', ...NO_DIMS, paint: '#1b3a8a', gloss: 0.6, structure: 'cfrp', panels: 'aluminium' },
  engine: { grade: 3, layout: 'V12', cc: 3499, valves: 5, redline: 8250, intake: 'single', compression: 'low', sump: 'dry', block: 'aluminium', turbo: 4, boost: 1.0, intercooler: true, vtec: false, bs: BS_DEFAULT, quality: { ...NO_QUALITY } },
  drive: { gears: 6, gearbox: 'manual', final: 0, lsd: true, awd: true },
  kit: { abs: true, tcs: false, steering: 'hydraulic', dampers: 'fixed', wing: true, diffuser: false, tyres: [245, 325], rim: 18, interior: 'luxury' }, susp: structuredClone(SUSP_OWN.eb110) };
/** the 1992 Jaguar XJ220: the JRV-6, a 3.5 V6 from the Group C engine, four valves, two Garrett turbos with
 *  intercoolers at about 1.0 bar, 8.3:1, a dry sump, 542 hp at 7,200; five speeds, rear drive; a bonded aluminium
 *  honeycomb tub and aluminium panels, underbody venturis; 2,640 wheelbase, 2,220 wide (here as wide as the NSX's base
 *  stretches, 1,970); 255/45 ZR17 and 345/35 ZR18 (here 335 on 18 at both ends: the builder's one rim size); 1,470 kg */
export const DESIGN_XJ220: Design = { v: 6, id: 'xj220', name: '시험 차 E', body: { base: 'nsx', nose: 'round', ...faceOf3('nsx', 'plain'), tail: 'roundLamps', wheel: 'disc', ...NO_DIMS, wheelbase: 110, width: 80, paint: '#9aa1a6', gloss: 0.6, structure: 'honeycomb', panels: 'aluminium' },
  engine: { grade: 4, layout: 'V6', cc: 3498, valves: 4, redline: 7800, intake: 'single', compression: 'low', sump: 'dry', block: 'aluminium', turbo: 2, boost: 1.0, intercooler: true, vtec: false, bs: BS_DEFAULT, quality: { ...NO_QUALITY } },
  drive: { gears: 5, gearbox: 'manual', final: 0, lsd: true, awd: false },
  kit: { abs: false, tcs: false, steering: 'manual', dampers: 'fixed', wing: false, diffuser: true, tyres: [255, 335], rim: 18, interior: 'standard' }, susp: structuredClone(SUSP_OWN.nsx) };
/** the 1994 McLaren F1, from McLaren's published figures (as quoted by Wikipedia's article and Road & Track's 1994
 *  test; Gordon Murray's design notes for the materials): BMW S70/2 6,064 cc 60-degree V12, four valves, a throttle a
 *  cylinder, 10.5:1, a dry sump, 627 hp (468 kW) at 7,400 rpm, 650 Nm at 5,600, the limiter about 7,500; six speeds,
 *  rear drive, no limited-slip differential; no ABS, no power steering, no traction control; a carbon-fibre monocoque
 *  and carbon panels, a stripped interior (Murray's weight budget: thin glass, light seats, no deadening); 2,718
 *  wheelbase, 1,820 wide (here 1,860: the F355's arches need the room for its 315 mm rears), 1,140 high (the F355's roof 30
 *  lower), 4,287 long (both overhangs 100 shorter than the F355's), its screen laid well back (4 degrees past the F355's); Cd 0.32; ground-effect venturis with fans (here the
 *  undertray); 235/45 ZR17 and 315/45 ZR17; kerb 1,138 kg (about 1,140); 372 km/h on its production limiter, 386 km/h
 *  (240 mph, Ehra-Lessien 1998) with it raised; 0-100 km/h 3.2 s */
export const DESIGN_MCLAREN_F1: Design = { v: 6, id: 'mclarenf1', name: '시험 차 F', body: { base: 'f355', nose: 'pointed', ...faceOf3('f355', 'plain'), tail: 'frame', wheel: 'disc', ...NO_DIMS, wheelbase: 270, width: -20, roof: -30, overhangF: -100, overhangR: -100, rake: 4, paint: '#c9c3b6', gloss: 0.6, structure: 'cfrp', panels: 'cfrp' },
  engine: { grade: 4, layout: 'V12', cc: 6064, valves: 4, redline: 7500, intake: 'itb', compression: 'high', sump: 'dry', block: 'aluminium', turbo: 0, boost: 0.8, intercooler: true, vtec: false, bs: BS_DEFAULT, quality: { ...NO_QUALITY } },
  drive: { gears: 6, gearbox: 'manual', final: 0, lsd: false, awd: false },
  kit: { abs: false, tcs: false, steering: 'manual', dampers: 'fixed', wing: false, diffuser: true, tyres: [235, 315], rim: 17, interior: 'light' }, susp: structuredClone(SUSP_OWN.f355) };

/** a model body's swaps with what it does not have put back to its own */
export function fitModel(base: ModelBaseId, m: Partial<ModelSwaps> | undefined): ModelSwaps { const o = MODEL_OWN[base], one = <T>(v: unknown, of: readonly T[], d: T): T => of.includes(v as T) ? v as T : d;
  return { bumperF: one(m?.bumperF, BUMPERS959, o.bumperF), bumperR: one(m?.bumperR, BUMPERS959, o.bumperR), lamp: one(m?.lamp, LAMPS959, o.lamp), wheel: one(m?.wheel, WHEELS959, o.wheel),
    plate: plateOk(m?.plate) ? m!.plate!.replace(/\s+/g, '').replace(/^(\d{2}.)/, '$1 ') : o.plate,
    ...(m?.plateF === false ? { plateF: false as const } : {}), ...(m?.plateR === false ? { plateR: false as const } : {}) }; }
/** the syllables the plate's figures can be drawn for (render/car/p959/parts.ts PLATE_SYLLABLES: the same list) */
export const PLATE_SYLLABLES = '가나다라마바사아자거너더러머버서어저고노도로모보소오조구누두루무부수우주배하허호';
/** a plate's text as the old green plate takes it: two digits, a syllable the plate's font has, four digits */
export const plateOk = (t: unknown): t is string => { if (typeof t !== 'string') return false; const m = t.replace(/\s+/g, '').match(/^\d{2}(.)\d{4}$/); return !!m && PLATE_SYLLABLES.includes(m[1]!); };
const clamp = (v: number, [a, b]: readonly [number, number]) => Math.min(b, Math.max(a, v));
/** a value the grade allows: the asked one, else the best allowed one below it in the list's order */
const allowed = <T>(v: T, order: readonly T[], ok: readonly T[]): T => { for (let i = order.indexOf(v); i >= 0; i--) if (ok.includes(order[i]!)) return order[i]!; return ok[0]!; };
/** a format-1 design in format 3: the structure and the panels of its one material; the grade a high-performance
 *  production engine's (format 1's figures were set by the NSX's and the F355's); the intake, the compression, the sump
 *  and the block its base's own car's, the compression a turbo engine's middle one; its turbos' boost what format 1
 *  fixed (one 0.8 bar, two 1.0); the base's own dimensions */
export function migrate(d: DesignV1): DesignV3 {
  const { material, ...body } = d.body, P = d.body.base === 'f355' ? DESIGN_F355 : DESIGN_NSX, E = d.engine;
  return { ...d, v: 3, body: { ...NO_DIMS, ...body, structure: material, panels: material }, kit: { ...d.kit, interior: 'standard' },
    engine: { grade: 2, layout: E.layout, cc: E.cc, valves: E.valves, redline: E.redline, intake: P.engine.intake, compression: E.turbo ? 'mid' : P.engine.compression,
      sump: P.engine.sump, block: P.engine.block, turbo: E.turbo, boost: E.turbo === 2 ? 1.0 : 0.8, intercooler: true, vtec: E.vtec } };
}
/** any format brought to format 4 (toV5 then adds the suspension): format 1 through migrate(), format 2 with its base's own dimensions, format 3 with
 *  the old bore/stroke and every part's quality 0 (the fields read where a newer file has them) and its front as the
 *  face's slots (faceOf3). A format-4 file made while its halves were apart gets the half it lacks the same way */
export function toV4(d0: DesignV4 | DesignV3 | DesignV2 | DesignV1): DesignV4 {
  const d1 = d0.v === 1 ? migrate(d0) : d0;
  const d3: DesignV4 | DesignV3 = d1.v === 2 ? { ...d1, v: 3, body: { ...NO_DIMS, ...d1.body } } : d1;
  const e = d3.engine as DesignV3['engine'] & Partial<Pick<Design['engine'], NewEngine>>, b = d3.body;
  const body: Design['body'] = 'bumper' in b ? b : (({ front, ...rest }) => ({ ...rest, ...faceOf3(rest.base, front) }))(b);
  return { ...d3, v: 4, body, engine: { ...e, bs: e.bs ?? BS_DEFAULT, quality: { ...NO_QUALITY, ...e.quality } } };
}
/** any format brought to format 5: an older one through toV4, then its base's own suspension (SUSP_OWN) */
export function toV5(d0: DesignV5 | DesignV4 | DesignV3 | DesignV2 | DesignV1): DesignV5 {
  if (d0.v === 5) return d0; const d4 = toV4(d0), base = BODY_BASES.includes(d4.body.base) ? d4.body.base : 'nsx';
  return { ...d4, v: 5, susp: structuredClone(SUSP_OWN[base]) }; }
/** any format brought to format 6: an older one through toV5, with no class (its figures place it: see the header) */
export function toV6(d0: AnyDesign): Design { return d0.v === 6 ? d0 : { ...toV5(d0), v: 6 }; }
/** a design of any format */
export type AnyDesign = Design | DesignV5 | DesignV4 | DesignV3 | DesignV2 | DesignV1;
/** an axle's suspension inside its ranges (a kind it cannot have: the base's own) */
function fitAxle<A extends SuspAxle>(a: A, own: A, front: boolean): A { const L = SUSP_LIMITS, n = (k: keyof typeof L, v: unknown, d: number, q = 100) => Math.round(clamp(typeof v === 'number' && Number.isFinite(v) ? v : d, L[k]) * q) / q;
  const out = { ...own, ...a, type: SUSP_KINDS.includes(a.type) && !suspLock(front, a.type) ? a.type : own.type, rc: RC_PRESETS.includes(a.rc) ? a.rc : own.rc,
    arm: n('arm', a.arm, own.arm), hz: n('hz', a.hz, own.hz), bump: n('bump', a.bump, own.bump), rebound: n('rebound', a.rebound, own.rebound), bar: n('bar', a.bar, own.bar), camber: n('camber', a.camber, own.camber, 10), toe: n('toe', a.toe, own.toe, 100) };
  if ('caster' in own) (out as unknown as SuspDesign['front']).caster = n('caster', (a as unknown as SuspDesign['front']).caster, (own as unknown as SuspDesign['front']).caster, 10);
  return out; }
/** a design brought inside the limits and what its engine's grade allows (a loaded file, a slider's value); an older
 *  format is brought to format 4 first (toV4); a face the rules do not allow is put right (fitFace) */
export function normalise(d0: AnyDesign): Design {
  const d = toV6(d0), E = d.engine, g: Grade = GRADES.includes(E.grade) ? E.grade : 2, R = GRADE_RULES[g];
  const lim = BODY_LIMITS(BODY_BASES.includes(d.body.base) ? d.body.base : 'nsx'), dims = Object.fromEntries(DIMS.map(k => [k, clamp(Number.isFinite(d.body[k]) ? d.body[k] : 0, lim[k])])) as unknown as BodyDims;
  const q = (k: QualityPart) => { const v = E.quality?.[k]; return Number.isFinite(v) ? Math.round(clamp(v!, LIMITS.quality)) : 0; };
  const base = BODY_BASES.includes(d.body.base) ? d.body.base : 'nsx', { model: m0, ...body0 } = d.body, model = isModelBase(base) ? fitModel(base, m0) : undefined;
  return { ...d, body: fitFace({ ...body0, base, ...dims, gloss: clamp(d.body.gloss, [0, 1]), ...(model ? { model } : {}) }),
    engine: { ...E, grade: g, layout: LAYOUTS.includes(E.layout) ? E.layout : 'V6', cc: clamp(E.cc, LIMITS.cc), redline: clamp(E.redline, [LIMITS.redline[0], gradeRedline(g)]),
      intake: allowed(E.intake, INTAKES, R.intake), compression: allowed(E.compression, COMPRESSIONS, R.compression), sump: allowed(E.sump, SUMPS, R.sump),
      block: allowed(E.block, BLOCKS, R.block), valves: allowed(E.valves, [2, 3, 4, 5] as Valves[], R.valves), turbo: Math.min(E.turbo, R.turbo) as Turbos,
      boost: Math.round(clamp(E.boost, [LIMITS.boost[0], gradeBoost(g)]) * 100) / 100, vtec: E.vtec && R.vtec, ...(E.sequential ? { sequential: Math.min(E.turbo, R.turbo) >= 2 } : {}),
      bs: Math.round(clamp(Number.isFinite(E.bs) ? E.bs : BS_DEFAULT, LIMITS.bs) * 100) / 100,
      quality: Object.fromEntries(QUALITY_PARTS.map(k => [k, q(k)])) as EngineQuality },
    drive: { ...d.drive, final: d.drive.final ? clamp(d.drive.final, LIMITS.final) : 0 },
    kit: { ...d.kit, tyres: [clamp(d.kit.tyres[0], LIMITS.tyre), clamp(d.kit.tyres[1], LIMITS.tyre)] },
    susp: (o => ({ front: fitAxle(d.susp?.front ?? o.front, o.front, true), rear: fitAxle(d.susp?.rear ?? o.rear, o.rear, false) }))(SUSP_OWN[base]) };
}
