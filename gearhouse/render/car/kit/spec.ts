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
  /** columns that follow a width line of the sheet behind the front edge (the columns between keep their shares) */
  rails?: { col: number; line: string }[];
  /** the crown measured over this half-width instead of the crest's (a plateau whose crown does not follow the wings) */
  crownOver?: At;
  /** the crest lies on the top's surface only as far as this station, then takes its own height line (default: to the screen's foot) */
  crestFrom?: At;
  /** the rows' bow starts at `from` (default the front arch) and dies out at column `col` (default at the crest) */
  bowFrom?: At; bowCol?: number;
}
/** the nose's cap: rows going round from the centre line to the front arch, in the standard section */
export interface NoseSpec {
  /** 'round': a super-ellipse in plan; 'pointed': the plan drawn from the sheet's table (lines.nose.plan), the bumper's lines on the same plan ('wedge' for later cars) */
  /** 'mass': the bumper a volume of its own standing ahead of the top's front edge: its lines super-ellipses in plan (`pow`)
   *  whatever the crest's plan, the apron between the top's edge and its top line straight in the middle */
  kind: 'round' | 'pointed' | 'wedge' | 'mass';
  /** 'mass': the apron's roll by the crest's half-width: straight (share `min` of the shoulder's roll) inside y0, the full roll from y1 */
  apron?: { y: [number, number]; min: number };
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
  /** the panel's columns (default to the shut line, TOP.SHUT); no shut line laid along its edge (an edge that is a real step) */ cols?: number; seam?: boolean;
  /** dark vents across the lid: the top's rows from..to, its columns c0..c1 */ vents?: { from: At; to: At; cols: [number, number] } }
/** the head lamps, a block of the front top's cells. 'popup': a cover hinged at its back edge over a dark well, the pod on its
 *  front; 'pocket': fixed lamps sunk in a scooped pocket (shallow at its front edge, `depth` at its back, the units on a
 *  face leaning back under the back edge), a flat glass cover flush with the top; 'fixed': a dark lens flush in the skin, the units seen in it */
export interface PopupSpec { kind: 'popup' | 'pocket' | 'fixed'; /** the cover's first and last rows (stations; '@front' the top's front edge) */ from: At; to: At; /** degrees it opens; the well's depth */ open: number; depth: number; /** the lenses across the pod's face (shares) and their height (shares) and lift */ lens: [number, number][]; lensV: [number, number, number];
  /** the block's columns (default the cover's, TOP.COVER) */ cols?: [number, number];
  /** 'pocket': the depth at its front edge; the units' face from this share of its length; the lenses drawn as round projectors (indices);
   *  a dark finned ramp down its inner side (its share of the width, the fins) */
  /** 'popup': `round` draws those lenses of the pod round too (a bright rim, the lens in it) */
  /** 'fixed': the units seen in the dark lens are `lens` across the block (round ones: `round`) */
  shallow?: number; faceFrom?: number; round?: number[]; ramp?: { share: number; fins: number } }
/** the shelf between an edge line standing in from the crest and the crest itself (a bubble cabin's foot, a plateau bonnet's
 *  edge): rows of four points, the edge E, the foot F of a wall dropping from it, the floor's middle M, the crest K */
export interface ShelfSpec {
  /** its first row on the front top (a row ahead of the arch or a station); ahead of it the strip is a lamp of this colour (or the wing's top) */
  from: At; lamp?: Colour;
  /** the wall's height under the edge along the car (a height line of the sheet; 0 where there is none) */
  wall: string;
  /** how far out the wall's foot stands from the edge: where there is a wall, where there is none */
  out: [number, number];
  /** the floor's middle sags by this much, growing over [a, b] and dying out over [c, d] (a scooped trough) */
  sag: number; sagAt: [At, At, At, At];
  /** a dark slot along the floor: stations from, to; cells along it */
  slot?: { x: [number, number]; n: number };
}
/** a glass engine cover's bars: dark ribs across it, the first one's front edge, their pitch, count and breadth, their reach across (share of the cover's half-width) */
export interface RibSpec { from: number; pitch: number; n: number; width: number; span: number }
export interface CanopySpec {
  /** 'canopy': one black glasshouse; 'buttress': a body-coloured roof and pillars, an upright rear glass sunk between two
   *  flying buttresses that fall from the roof's back corners to their tips on the deck (the `slant` lines are their inner
   *  top edges, `side.edge` their tops' breadth, `slantFoot` and `side.to` their tips) ('wedge', 'bubble' for later cars) */
  kind: 'canopy' | 'buttress' | 'wedge' | 'bubble';
  /** 'bubble': a cabin standing on its own belt line inboard of the crest (the car's shelf between them, CarKit.shelf), the
   *  roof in the body's colour running on behind the cabin as a fastback as far as the glass's foot (`rear` is every station
   *  between). Lines of the sheet: the roof's edge (a width line; `roof.half` is not used), the belt (a width and a height
   *  line of this name), the drop from the roof's edge to the side glass's top (a height line; default `side.rail`).
   *  `cols`: the roof's columns as shares of its half-width (TOP.N - 1 values, the last 1), one of them following a width
   *  line; the side glass starts at `glassFrom` (frame ahead of it) and ends at the B pillar, the flank of the fastback
   *  behind it in the body's colour with sunk oval ports (blocks of its rows, the ovals' radii as shares of a cell, their
   *  depth); a glass engine cover in the roof's first `cols` columns between two stations, with its ribs */
  bubble?: { edge: string; belt: string; rail?: string; cols: number[]; follow?: { col: number; line: string }; glassFrom: At;
    ports?: { rows: [At, At][]; r: [number, number]; depth: number; seg: number };
    cover?: { from: At; to: At; cols: number; ribs?: RibSpec } };
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
  /** no pulls on the skin (a door opened from under its edge) */ noHandle?: boolean;
  /** the lower part's rear edge when it is not the intake's front (an intake let into the door itself) */ lowerTo?: At;
  /** the shut lines on the flank ([x, z]) */ frontSeam: [number, number][]; rearSeam: [number, number][][];
  /** the flush pull and the lock: x0, x1 and the corners' heights (x0 top, x1 top, x1 foot, x0 foot) */ handle: { pull: [number, number, number, number, number, number]; lock: [number, number, number, number, number, number] } }
export interface IntakeSpec { /** its front and back stations; the depth grows from `from` to `full` */ from: At; to: At; full: At; depth: number;
  /** the chain points its top and foot edges lie on (default: the widest line and the sill's crease); the foot's own inner rise (a ramp back out to the skin) */ span?: [number, number]; footLip?: number;
  /** the inner lips' rise at top and foot (at full depth); the rows whose inner faces are body coloured */ lip: number; paintRows: number;
  /** the top and foot walls in the body's colour too (a recess pressed in the panel, dark only at its mouth) */ paintWalls?: boolean;
  /** rounded corners: [front or back edge, chain point, row step, point step]; the fillet's share */ fillets: ['from' | 'to', number, number, number][]; fillet: number;
  /** the grille's fins: how many, and [out, back, width, thickness] */ fins: number; fin: [number, number, number, number] }
export interface DeckSpec {
  /** 'lid': a painted boot lid; 'louvre': an opening over the engine (a dark bay sunk under it) closed by a slotted cover,
   *  the engine seen between its slats ('glass' for later cars) */
  kind: 'lid' | 'glass' | 'louvre';
  /** 'glass': an opening over the engine (a dark bay sunk under it) closed by a glass pane with dark ribs across it */
  glass?: { open: [At, At]; depth: number; ribs?: RibSpec };
  /** no shut lines laid on the lid */
  noSeam?: boolean;
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
   *  no slot; its lamps sunk in round recesses, see TailLampSpec.sunk); 'capsule' (one plain panel from the deck's own edge
   *  (the tail's top edge follows the deck across) down to its foot line, chain point `split`, the dark valance under it: no
   *  blade, slot or bumper box; its lamps in capsule bezels laid on it, see TailLampSpec.capsule); 'cut' for later cars */
  kind: 'frame' | 'roundLamps' | 'ducktail' | 'capsule' | 'cut';
  /** the valance in the body's colour, dark only in the tail rows from..to (cut-outs round the exhausts) */
  cutouts?: [number, number];
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
  /** 'capsule': dark mesh slots laid on the panel, each side [y0, y1, z0, z1]; a dark bed strip across its top [half-width, z0, z1] */
  slots?: [number, number, number, number][]; bed?: [number, number, number];
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
  /** a capsule each side: a dark bezel with round ends from y0 to y1 at height z (half-height h; the bezel stands `grow` wider),
   *  the lenses in a row along it [name, colour, gloss, kind, y0, y1] (the first and last end round), a block low in it [colour, y0, y1, z0, z1] */
  capsule?: { y: [number, number]; z: number; h: number; grow: number; lift: [number, number]; lenses: [string, Colour, number, Kind, number, number][]; block?: [Colour, number, number, number, number] };
}
/** a rear wing: a blade across the tail lying on the deck. 'active': it lies in its bed and rises on its struts with the
 *  assembler's `wing` 0..1; 'fixed': it stands raised always */
export interface WingSpec { kind: 'active' | 'fixed';
  /** its leading edge (station); its trailing edge this far ahead of the tail's top edge; half its span, and the half-width inside which it follows the deck */
  from: At; back: number; half: number; sit: number;
  /** its stations across (shares of the half span, 0..1) and its section going round: [share of the chord, offset along, height over the deck] */
  across: number[]; section: [number, number, number][];
  /** raised: the lift, the tilt (degrees, trailing edge up) about the pivot (station) */
  rise: number; tilt: number; pivot: At;
  /** the struts: their places across, breadth and thickness */
  struts: { y: number[]; w: number; t: number };
  /** the dark bed under it: from this station, this half-width, strips across */
  bed?: { from: At; half: number; n: number };
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
/** an intake each side of the bumper (nose rows, chain points), a fog lamp's lens in it [row, u0, u1, v0, v1, depth], body-coloured bars across it */
export interface OuterIntake { rows: [number, number]; cols: [number, number]; depth: number; fog?: [number, number, number, number, number, number]; slats?: number[] }
export interface CarKit {
  id: string;
  lines: LineSheet;
  section: SectionSpec;
  colours: Palette;
  top: FrontTopSpec;
  nose: NoseSpec;
  bonnet: BonnetSpec;
  bonnetBadge: { x: [number, number]; y: number; lift: number; colour?: Colour };
  /** the shelf between the edge line and the crest (a bubble cabin needs one) */
  shelf?: ShelfSpec;
  /** a rear wing over the deck */
  wing?: WingSpec;
  /** a diffuser under the tail (parts/diffuser.ts): fins across it, how far below the floor it starts at the rear axle */
  diffuser?: { fins: number; depth: number };
  /** a dark vent on the flank following the front arch's rim: its radii about the hub, its span (degrees from the back, upward), cells */
  archVent?: { r: [number, number]; deg: [number, number]; n: number };
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
  /** (a centre intake of no rows is left out; `shield`: a small grille laid on the bumper's middle, its outline [y, z], a body-coloured
   *  surround `grow` larger; `outer.slats`: body-coloured bars across each outer intake at these chain points; `patches`: dark
   *  ducts laid on the bumper's face each side [y0, y1, z0, z1]) */
  splitter?: { /** a thin dark blade under the nose: how far forward its edge reaches on the centre line, its half-width, its top and foot, the share of the nose it runs round */ reach: number; half: number; z: [number, number]; until: number };
  intakes: { shield?: { pts: [number, number][]; grow: number }; patches?: [number, number, number, number][];
    centre: { rows: number; cols: [number, number]; depth: number; bars: number[]; barX: number; barZ: [number, number];
      /** bars across it: their heights and half-length; a bright badge in its middle (half-width, z0, z1); its corners rounded by
       *  fillets of the skin: [nose row, chain point, row step, point step] and the fillet's share */
      slats?: { z: number[]; half: number }; badge?: [number, number, number]; fillets?: [number, number, number, number][]; fillet?: number;
      /** `follow`: the bars and the slats stand `barX` behind the bumper's face wherever they are (a face that curves or
       *  leans: `barX` is then a depth, not a place); `mesh`: a lattice across the whole mouth instead, [strips across, strips
       *  up] each cell, standing `barX` behind the face, the strips' breadth (mm) */
      follow?: boolean; mesh?: { n: [number, number]; w: number } };
    outer?: OuterIntake;
    /** a second pair of intakes beside the centre (a shield grille's barred intakes), cut as the outer ones */
    side?: OuterIntake;
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
