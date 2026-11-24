// The assembly spec's format (docs/systems/95_nsx_kit_breakdown.md, section 5): a car is data. The sheet's lines, the
// standard section's levels, each panel's kind and shape parameters, each part's kind and place, the colours. The kit's
// functions hold no car's numbers; every number a car needs is here, in its spec (render/car/cars/<id>.kit.ts).
// Positions are in the sheet's frame (mm; x from the nose back, y from the centre line out, z up); the panels and parts
// pass them through the line system, so a tweak to the lines (wheelbase, width) moves them with the body.
// Indices name rows of the shared grids (skin.ts) and points of the standard section (section.ts: FLANK, TOP, TAILP).
import type { EngineOpts, EngineSpec } from '../enginemesh';
import type { Kind } from '../mesh';
import type { At, LineSheet } from './lines';
import type { SectionSpec } from './section';
import type { V } from './geom';

/** the car's colours by role (each panel and part takes its colour from here) */
export interface Palette { paint: string; gloss: number; smoke: string; shade: string; black: string; frame: string; dark: string; trim: string; glass: string; silver: string; chrome: string; rubber: string; lens: string; red: string; amber: string; seat: string; seat2: string; seam: string; white: string; /** a wheel's painted face */ metal: string }
export type Colour = Exclude<keyof Palette, 'gloss'>;

/** the front top: rows from the nose's crest back to the screen's foot, TOP.N columns */
export interface FrontTopSpec {
  /** the columns' shares of the top's half-width at the screen (TOP.N - 1 values, 1 the crest) */
  shares: number[];
  /** the columns' shares of the nose's half-width at its front edge (TOP.N - 2 values, between the centre and the crest) */
  noseCols: number[];
  /** the cap's rows round the nose (shares from the crest toward `capTo`) and the rows ahead of the front arch (stations) */
  capRows: number[]; capTo: At; rows: At[];
  /** the crest leads the rows by this much at `rows[0]`, nothing at the arch */
  lead: number;
  /** where the columns move from the nose's spacing to the screen's */
  blend: [At, At];
  /** the top's half-width at the screen (the columns' base) */
  screenHalf: At;
  /** the rows bow forward toward the screen's bowed foot: depth at the screen, its growth, how it fades out to the crest */
  bow: { depth: number; pow: number; edge: number };
  /** the surface across: the wings' tops proud by `crown` (rising over `crownAt`), rolling off by `roll` to the crest */
  crown: number; crownAt: [At, At]; roll: number;
}
/** the nose's cap: rows going round from the centre line to the front arch, in the standard section */
export interface NoseSpec {
  /** 'round': a super-ellipse in plan; 'pointed': the plan drawn from the sheet's table (lines.nose.plan), the bumper's lines on the same plan ('wedge' for later cars) */
  kind: 'round' | 'pointed' | 'wedge';
  /** the bumper's lines on the centre line, one height per chain point from H down */
  levels: number[];
  /** how far back each of those lines sits on the centre line */
  reach: number[];
  /** the lamp strip's top rises by this much toward the corner */
  lampRise: number;
  /** where the rows turn into the flank (share of the half-width), the plan's exponent ahead of it, the bumper's plan power */
  turn: number; spread: number; pow: number;
  /** a shut line along the bumper's top edge (a bumper made as its own piece under the crease) */
  seam?: boolean;
}
export interface BonnetSpec { /** the cowl from this station (the bonnet's own columns end a row earlier) */ cowl: At; /** the cowl's columns from the centre */ cowlCols: number;
  /** dark vents across the lid: the top's rows from..to, its columns c0..c1 */ vents?: { from: At; to: At; cols: [number, number] } }
export interface PopupSpec { kind: 'popup' | 'pocket' | 'fixed'; /** the cover's first and last rows (stations) */ from: At; to: At; /** degrees it opens; the well's depth */ open: number; depth: number; /** the lenses across the pod's face (shares) and their height (shares) and lift */ lens: [number, number][]; lensV: [number, number, number] }
export interface CanopySpec {
  /** 'canopy': one black glasshouse; 'buttress': a body-coloured roof and pillars, an upright rear glass sunk between two
   *  flying buttresses that fall from the roof's back corners to their tips on the deck (the `slant` lines are their inner
   *  top edges, `side.edge` their tops' breadth, `slantFoot` and `side.to` their tips) ('wedge', 'bubble' for later cars) */
  kind: 'canopy' | 'buttress' | 'wedge' | 'bubble';
  /** 'buttress': the rear glass's top edge sits [back, down] from the roof's back edge (the header between them); the quarter
   *  glass ends at `quarterTip`, narrowing from its top over its last `taper` rows (0..3); the glass's edge columns in black */
  buttress?: { header: [number, number]; quarterTip: At; taper: number };
  /** the roof: its front corner and back edge (stations), half-width, crown and its power; its front edge bowed forward by `bow` at the centre */
  roof: { from: At; to: At; half: At; crown: number; pow: number; bow: number };
  /** the screen: its rows as shares from the foot up, how much it bows out */
  screen: { rows: number[]; bow: number };
  /** the side strip (to `to`): the pillar's band ahead of the roof `pillar` wide, giving way to the rail over `railAt`;
   *  the rail (y, z offsets) narrowing to `edge` by `railEnd`; the glass blown out by `blow` between `blowIn` and `blowOut` */
  side: { pillar: number; railAt: [At, At]; rail: [number, number]; railEnd: At; edge: number; blow: number; blowIn: [At, At]; blowOut: [At, At]; to: At };
  /** the quarter glass's slanting edge ends on the crest here */
  slantFoot: At;
  /** the rear glass's rows (stations) from the roof's back edge to its foot */
  rear: At[];
  /** the B pillar from `bPillar` to `quarter`, then the quarter glass */
  bPillar: At; quarter: At;
  /** the rear pane's gloss (under the glass's 0.5: less tint) */
  rearGloss: number;
  /** black cell rows at the rear glass's foot (the tongue) and black columns at its edge */
  rearBlackRows: number; rearBlackCols: number;
  /** the screen's black band: rows at its foot, the row the top band starts, columns at its edge */
  screenBand: { foot: number; top: number; cols: number };
}
export interface DoorSpec { /** the door's front (station), its top's rear edge, its lower part's rear edge (the intake's front) */ from: At; to: At;
  /** the lower part's rear edge when it is not the intake's front (an intake let into the door itself) */ lowerTo?: At;
  /** the shut lines on the flank ([x, z]) */ frontSeam: [number, number][]; rearSeam: [number, number][][];
  /** the flush pull and the lock: x0, x1 and the corners' heights (x0 top, x1 top, x1 foot, x0 foot) */ handle: { pull: [number, number, number, number, number, number]; lock: [number, number, number, number, number, number] } }
export interface IntakeSpec { /** its front and back stations; the depth grows from `from` to `full` */ from: At; to: At; full: At; depth: number;
  /** the chain points its top and foot edges lie on (default: the widest line and the sill's crease); the foot's own inner rise (a ramp back out to the skin) */ span?: [number, number]; footLip?: number;
  /** the inner lips' rise at top and foot (at full depth); the rows whose inner faces are body coloured */ lip: number; paintRows: number;
  /** rounded corners: [front or back edge, chain point, row step, point step]; the fillet's share */ fillets: ['from' | 'to', number, number, number][]; fillet: number;
  /** the grille's fins: how many, and [out, back, width, thickness] */ fins: number; fin: [number, number, number, number] }
export interface DeckSpec {
  /** 'lid': a painted boot lid; 'louvre': an opening over the engine (a dark bay sunk under it) closed by a slotted cover,
   *  the engine seen between its slats ('glass' for later cars) */
  kind: 'lid' | 'glass' | 'louvre';
  /** one column follows a width line of the sheet (a gutter, a buttress's foot) as far as `until`, easing back to its share by `ease` */
  rail?: { col: number; line: string; until: At; ease: At };
  /** 'louvre': the opening's rows (stations; across it takes the lid's columns), the bay's depth under it; the slots: the first
   *  one's front edge, pitch, count, width, their inner and outer ends across, their front walls' depth; the long slots clear
   *  of the raised centre panel reach in to `long`; the panel: its ends, half-width, rise, its top's inset */
  louvre?: { open: [At, At]; depth: number; slots: { from: number; pitch: number; n: number; width: number; y: [number, number]; long: number; wall: number }; panel?: { x: [number, number]; half: number; rise: number; inset: number } };
  /** the deck's first station (behind the glass's foot) */
  from: At;
  /** its edge up to the ridge: y where it starts and ends rising, at the front and at the back; the change over `blend` */
  edge: { y0: [number, number]; y1: [number, number]; blend: [At, At] };
  /** the lid's columns (its shut line on the next); the lid's back shut line (station) */
  lidCols: number; shut: At;
}
export interface TailSpec {
  /** 'frame' (one integrated frame round a smoked lamp band), 'roundLamps' (the same frame, round lamps), 'ducktail' (the deck
   *  swept up into a lip across the tail, the body-coloured lamp panel set in under it between the wings' ends: no blade,
   *  no slot; its lamps sunk in round recesses, see TailLampSpec.sunk); 'capsule', 'cut' for later cars */
  kind: 'frame' | 'roundLamps' | 'ducktail' | 'capsule' | 'cut';
  /** 'ducktail': a dark band along the lip's trailing face, tail rows from..to */
  band?: [number, number];
  /** the tail's rows going round from the last chain to the centre line (shares of its half-width) */
  shares: number[];
  /** how far back each chain point's line reaches on the centre line */
  reach: number[];
  /** the plan's power above and below chain point `split` */
  pow: [number, number]; split: number;
  /** the frame's rows from the corner (beside the slot) */
  frameRows: number;
  /** the opening's slanting end: the tail row it crosses at the lamp panel's top, middle and foot */
  opening: [number, number, number];
  /** how far the lamp panel and the valance stand in from the frame */
  lampIn: number; valIn: number;
  /** the spoiler's blade: from this station over the deck's first `cols` columns; its underside's height; its leading edge (back from `from`, height) */
  blade?: { from: At; cols: number; under: number; lead: [number, number] };
  /** the plate's recess: tail rows; its depth */
  plateRows: [number, number]; plateDepth: number;
}
export interface TailLampSpec {
  /** the round indicator at each end: centre, the rim's and the lens's radius, their lifts, points round */
  indicator?: { y: number; z: number; rim: number; lens: number; lift: [number, number]; seg: number };
  /** the rectangular lenses: name, colour, gloss, kind, y0, y1, z0, z1, lift */
  patches?: [string, Colour, number, Kind, number, number, number, number, number][];
  /** the centre badge: the dark square and the bright badge on it (half-width, z0, z1, lift) */
  badge: { dark: [number, number, number, number]; bright: [number, number, number, number] };
  /** the round kind: lamps each side (centres across), their height, radius, rim, lifts, points round, names, colours */
  round?: { y: number[]; z: number; r: number; rim: number; lift: [number, number]; seg: number; names: string[]; colours: Colour[] };
  /** lamps sunk in round recesses cut in the lamp panel: each one's block of tail rows [from, to] it is cut from, its centre
   *  across, their height, radius, the recess's depth, points round, the bright rim's breadth, names, colours */
  sunk?: { blocks: [number, number][]; y: number[]; z: number; r: number; depth: number; seg: number; rim: number; names: string[]; colours: Colour[] };
}
export interface CabinSpec { floor: number; x: [number, number]; floorHalf: number;
  /** the door cards: their stations, standing in from the crest by [y, z] */ cards: { x: At[]; inset: [number, number] };
  /** the dash: its crest `reach` behind the screen's foot (less `sweep` at the sides), `narrow` of its width, at `z` (less `drop` at the sides); its foot's offsets; its face's run back and foot */
  dash: { reach: number; sweep: number; narrow: number; z: number; drop: number; foot: [number, number, number]; face: [number, number] };
  /** the tunnel: from x, half-width, top */ tunnel: [number, number, number];
  /** the steering wheel: across (on `side`), height, its rim's profile [x, r], its column [[x, z], [x, z], thickness] */
  wheel: { y: number; side: 1 | -1; z: number; rim: [number, number][]; column: [[number, number], [number, number], number] };
  seats: { x: [number, number]; y: [number, number]; cushion: number; inset: number; back: [number, number][]; piping: { y: number[]; cushion: [number, number, number]; back: [[number, number], [number, number]]; w: number } };
  /** the bulkhead: behind the cabin by dx, at share `at` along the rear glass's first rows, inset [y share, z]; its window's column and heights; the fan's hub */
  bulkhead: { dx: number; at: number; inset: [number, number]; col: number; window: [number, number]; hub: number; /** a shelf running back from the window's foot */ shelf?: number } }
export interface BaySpec { x: [number, number]; /** the tub's half-width and its top's */ y: [number, number]; /** floor, the side's step, top */ z: [number, number, number] }
export interface MirrorSpec { /** the head's centre (the part moves with it) */ at: V; /** the head's outline [x, z] */ head: [number, number][]; /** its stations across: [y, scale, x offset] */ loft: [number, number, number][]; /** the stalk: from, to, width, depth */ stalk: [V, V, number, number]; /** the glass: two corners */ glass: [V, V] }
export interface WiperSpec { /** the screen's row it lies on */ row: number; arms: [number, number][]; lift: [number, number]; bar: [number, number] }
export interface ExhaustSpec { /** the pipe's start, its end, the dark cap's place */ x: [number, number, number]; r: [number, number]; y: number[]; z: number; seg: number; cap: number }
export interface WheelLook {
  /** 'fiveSpoke': a flat cast face, dark openings laid on it; 'disc': a dished plate with vents; 'star': separate spokes standing
   *  proud of a deep dark well, broad at the hub and tapering to the rim */
  kind: 'fiveSpoke' | 'disc' | 'star'; seg: number;
  tyre: { shoulder: number; tread: number; bulge: number; roll: number };
  /** the rim's lip: [rise, step in, drop, face in, face drop] */ lip: [number, number, number, number, number];
  /** the dark disc behind the face: [share of half-width, radius less, points] */ back: [number, number, number];
  /** how far in the face's centre sits, front and rear */ dish: { f: number; r: number };
  /** the face's profile radii: centre, middle, hub; how far along its middle sits; its gloss */ face: [number, number, number]; faceMid: number; faceGloss: number;
  spokes: number; phase: number;
  /** fiveSpoke: the dark openings between spokes */ openings: { lift: number; rim: number; r: [number, number, number]; a: [number, number, number] };
  /** disc: the round vents */ vents: { r: number; size: number; seg: number; lift: number };
  /** star: the spokes' roots' radius and their waist's, the half-angles at the waist and at the rim (radians), how deep the
   *  well behind them is and how thick the spokes' flanks, the brake disc's radius in the well (0: none) */
  star?: { r: [number, number]; a: [number, number]; well: number; thick: number; brake: number };
  hub: { cap: [number, number, number]; nuts: number; nut: [number, number, number, number] };
}
export interface CarKit {
  id: string;
  lines: LineSheet;
  section: SectionSpec;
  colours: Palette;
  top: FrontTopSpec;
  nose: NoseSpec;
  bonnet: BonnetSpec;
  bonnetBadge: { x: [number, number]; y: number; lift: number };
  popup: PopupSpec;
  canopy: CanopySpec;
  door: DoorSpec;
  intake: IntakeSpec;
  deck: DeckSpec;
  tail: TailSpec;
  tailLamps: TailLampSpec;
  under: { /** the axles' bar thickness, front and rear */ axle: [number, number] };
  cabin: CabinSpec;
  /** the engine bay's tub behind the cabin (not for a deck that sinks its own) */
  bay?: BaySpec;
  /** the fuel flap's outline on the flank ([x, z]) and its side */
  fuelFlap?: { pts: [number, number][]; side: 1 | -1 };
  /** flank lamps: x0, x1, z0, z1 */
  marker?: [number, number, number, number]; repeater: [number, number, number, number];
  /** dark slots and other flat patches laid on the flank: name, colour, gloss, x0, x1, z0, z1 */
  flankPatches?: [string, Colour, number, number, number, number, number][];
  /** the front bumper's intakes: the centre one (nose rows from the centre, chain points), the outer ones with the fog lamps [row, u0, u1, v0, v1, depth] */
  intakes: { centre: { rows: number; cols: [number, number]; depth: number; bars: number[]; barX: number; barZ: [number, number];
      /** bars across it: their heights and half-length; a bright badge in its middle (half-width, z0, z1); its corners rounded by
       *  fillets of the skin: [nose row, chain point, row step, point step] and the fillet's share */
      slats?: { z: number[]; half: number }; badge?: [number, number, number]; fillets?: [number, number, number, number][]; fillet?: number };
    outer?: { rows: [number, number]; cols: [number, number]; depth: number; fog: [number, number, number, number, number, number] };
    /** a round lamp sunk in a recess cut from a block of the bumper's cells (nose rows, chain points): centre, radius, depth, points round */
    fog?: { rows: [number, number]; cols: [number, number]; y: number; z: number; r: number; depth: number; seg: number } };
  /** the front bumper's lamp strip: nose rows from, the clear lamp's end (the amber one's start), to */
  /** `col`: the chain point under whose line the strip lies (default the widest line); `depth`: the strip sunk as a dark slot,
   *  the lenses at its back; `amberFirst`: the amber lens inboard */
  bumperLamps: { from: number; split: number; to: number; col?: number; depth?: number; amberFirst?: boolean };
  plate: [number, number, number, number, number, number];
  exhaust: ExhaustSpec;
  engine: { spec: EngineSpec; at: V; opts: EngineOpts };
  mirror: MirrorSpec;
  wiper: WiperSpec;
  wheel: WheelLook;
}
