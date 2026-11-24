// The assembly spec's format (docs/systems/95_nsx_kit_breakdown.md, section 5): a car is data. The sheet's lines, the
// standard section's levels, each panel's kind and shape parameters, each part's kind and place, the colours. The kit's
// functions hold no car's numbers; every number a car needs is here, in its spec (render/car/cars/<id>.kit.ts).
// All positions are in the sheet's frame (mm; x from the nose back, y from the centre line out, z up); the assembler
// passes them through the line system, so a tweak to the lines (wheelbase, width) moves them with the body.
import type { EngineOpts, EngineSpec } from '../enginemesh';
import type { At, LineSheet } from './lines';
import type { SectionSpec } from './section';
import type { Tab, V } from './geom';

/** the car's colours by role (each panel and part takes its colour from here) */
export interface Palette { paint: string; gloss: number; smoke: string; shade: string; black: string; frame: string; dark: string; trim: string; glass: string; silver: string; chrome: string; rubber: string; lens: string; red: string; amber: string; seat: string; seat2: string; seam: string; white: string; metal: string }

/** the front top: rows from the nose's crest back to the screen's foot, TOP.N columns */
export interface FrontTopSpec {
  /** the columns' shares of the top's half-width at the screen (TOP.N - 1 values, the crest last) */
  shares: number[];
  /** the columns' shares of the nose's half-width at the front edge */
  noseCols: number[];
  /** the cap's rows round the nose (shares from the crest to `capTo`) and the rows ahead of the arch (stations) */
  capRows: number[]; capTo: At; rows: At[];
  /** the crest leads the rows by this much at `rows[0]`, nothing at the arch */
  lead: number;
  /** where the columns move from the nose's spacing to the screen's (stations) */
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
  kind: 'round' | 'pointed' | 'wedge';
  /** the bumper's lines below the shut line, one height per chain point from H down (the rest follow the shoulder) */
  levels: number[];
  /** how far back each line sits on the centre line */
  reach: number[];
  /** the lamp strip's top rises by this much toward the corner */
  lampRise: number;
  /** where the rows turn into the flank (share of the half-width), the plan's exponent there, the bumper's plan power */
  turn: number; spread: number; pow: number;
}
export interface CanopySpec {
  kind: 'canopy' | 'wedge' | 'bubble';
  /** the roof: from its front corner to its back edge (stations), half-width, crown and its power; the front edge bowed forward by `bow` at the centre */
  roof: { from: At; to: At; half: At; crown: number; pow: number; bow: number };
  /** the screen: its rows as shares from the foot up, how much it bows out */
  screen: { rows: number[]; bow: number };
  /** the side: the pillar's band ahead of the roof (`pillar` mm wide, giving way to the rail over `railAt`), the rail
   *  (y, z offsets) narrowing to `edge` by `railEnd`; the glass blown out by `blow` between `blowIn` and `blowOut` */
  side: { pillar: number; railAt: [At, At]; rail: [number, number]; railEnd: At; edge: number; blow: number; blowIn: [At, At]; blowOut: [At, At]; to: At };
  /** the quarter glass's slanting edge: from the roof's back corner to `slantFoot` on the crest */
  slantFoot: At;
  /** the rear glass's rows (stations) from the roof's back edge to its foot */
  rear: At[];
  /** which side-strip rows are which: the B pillar from `bPillar` to `quarter`, then the quarter glass */
  bPillar: At; quarter: At;
  /** the clearer rear pane's gloss (under the glass's 0.5: less tint) */
  rearGloss: number;
  /** rear glass rows from its foot that are black (the tongue), columns from the edge that are black */
  rearBlackRows: number; rearBlackCols: number;
  /** the screen's black band rows (bottom, from the top) and columns (from the edge) */
  screenBand: { foot: number; top: number; cols: number };
}
export interface DeckSpec {
  kind: 'lid' | 'glass' | 'louvre';
  /** the deck's first station (behind the glass's foot) */
  from: At;
  /** its edge up to the ridge: y where it starts and ends rising, at the front and at the back; the back over `blend` */
  edge: { y0: [number, number]; y1: [number, number]; blend: [At, At] };
  /** the lid's columns (up to the shut line) and the boot lid's shut line's back row */
  lidCols: number; shut: At;
}
export interface TailSpec {
  kind: 'frame' | 'roundLamps' | 'capsule' | 'cut';
  /** the tail's rows going round from the last chain to the centre line (shares of its half-width) */
  shares: number[];
  /** how far back each chain point's line reaches on the centre line */
  reach: number[];
  /** the plan's power above and below the bumper's top (chain point `split`) */
  pow: [number, number]; split: number;
  /** the frame's opening: rows from the corner to the frame's inner edge */
  frameRows: number;
  /** how far the lamp panel and the valance stand in from the frame */
  lampIn: number; valIn: number;
  /** the spoiler's blade: from `bladeFrom` to the last station over the deck's centre columns, its underside, its leading edge */
  blade: { from: At; cols: number; under: number; lead: [number, number] };
  /** the plate's recess in the bumper (tail rows, chain points) and its depth */
  plateRows: [number, number]; plateDepth: number;
}
export interface UnderSpec { /** the floor's height at the centre line under the nose and the tail */ noseZ: number; tailZ: number }
export interface IntakeSpec { /** stations: front, rear; the depth's growth from `from` to `full` */ from: At; to: At; full: At; depth: number; /** its lips' rise and drop at the top and the foot */ lip: number; fins: number; finW: [number, number] }
export interface PopupSpec { kind: 'popup' | 'pocket' | 'fixed'; /** the cover's rows (stations) */ from: At; to: At; /** degrees it opens, the well's depth */ open: number; depth: number; lamps: number; lens: [number, number][] }
export interface BonnetSpec { /** the cowl from this station (the bonnet's columns end a row earlier) */ cowl: At; bonnetCols: number; cowlCols: number }
export interface DoorSpec { from: At; /** the door's rear edge above the intake / below it */ to: At; low: At; frontSeam: [number, number][]; rearSeam: [number, number][][] }
export interface CabinSpec { floor: number; from: number; to: number; dash: { reach: number; sweep: number; z: number; dz: number; foot: number }; tunnel: [number, number, number]; wheel: { x: number; y: number; z: number; r: number; col: [number, number] }; seats: { x: [number, number]; y: [number, number]; z: number; back: [number, number][] }; bulkhead: { window: [number, number]; hub: number; share: number } }
export interface BayCfg { x: [number, number]; y: [number, number]; z: [number, number, number] }

/** a fitting placed by the spec: what it is and where (sheet frame) */
export type PartSpec =
  | { part: 'wheel'; kind: 'fiveSpoke' | 'disc' | 'star'; spokes: number; dish: [number, number] }
  | { part: 'tailLamps'; kind: 'band' | 'round'; }
  | { part: 'mirror'; at: V; head: [number, number][]; loft: [number, number, number][]; stalk: [V, V, number, number]; glass: [V, V] }
  | { part: 'wiper'; arms: [number, number][]; lift: [number, number] }
  | { part: 'exhaust'; y: number[]; z: number; r: [number, number]; x: [number, number, number] }
  | { part: 'plate'; box: [number, number, number, number, number, number] }
  | { part: 'marker'; name: string; colour: keyof Palette; gloss: number; x: [number, number]; z: [number, number] }
  | { part: 'handle'; pull: [number, number, number, number, number, number]; lock: [number, number, number, number, number, number] }
  | { part: 'badge'; x: [number, number]; y: number }
  | { part: 'engine'; engine: EngineSpec; at: V; opts: EngineOpts };

export interface TailLampSpec {
  /** the lamp panel's chain points (top, middle, foot) the lamps are laid across */
  rows: [number, number, number];
  /** round indicator at each end: centre y, z, radius of its rim and its lens */
  indicator: { y: number; z: number; rim: number; lens: number };
  /** the rectangular lenses: [name, colour, y0, y1, z0, z1, lift] */
  patches: [string, keyof Palette, number, number, number, number, number][];
  /** the centre badge: the dark square and the bright badge on it */
  badge: { dark: [number, number, number]; bright: [number, number, number] };
  /** the round variant: lamps per side, their centres (y), height, radius */
  round?: { y: number[]; z: number; r: number };
}

export interface CarKit {
  id: string;
  lines: LineSheet;
  section: SectionSpec;
  colours: Palette;
  top: FrontTopSpec;
  nose: NoseSpec;
  bonnet: BonnetSpec;
  popup: PopupSpec;
  canopy: CanopySpec;
  door: DoorSpec;
  intake: IntakeSpec;
  deck: DeckSpec;
  tail: TailSpec;
  tailLamps: TailLampSpec;
  under: UnderSpec;
  cabin: CabinSpec;
  bay: BayCfg;
  /** the fuel flap's outline on the flank ([x, z]) and the side it is on */
  fuelFlap?: { pts: [number, number][]; side: 1 | -1 };
  /** the front bumper's intakes */
  intakes: { centre: { rows: number; depth: number; bars: number[]; barX: number; barZ: [number, number] }; outer: { rows: [number, number]; cols: [number, number]; depth: number; fog: [number, number, number, number, number] } };
  /** the front bumper's lamp strip: tail rows (nose rows) of the clear lamp and of the amber one */
  bumperLamps: { from: number; split: number; to: number };
  parts: PartSpec[];
  /** the wheel's look */
  wheel: { kind: 'fiveSpoke' | 'disc' | 'star'; spokes: number; dish: { f: number; r: number } };
}
export type { Tab };
