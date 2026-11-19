// A car body as data (prototype 1): side-view panels as control-point outlines in millimetres.
// x runs from the front of the car (0) to the back, z up from the ground. Nothing here is drawn by code
// that knows what a "sedan" is: every shape comes from the points, so any panel can be reshaped.

/** a control point: [x mm, z mm] or [x, z, 1] for a sharp corner (no rounding through it) */
export type Pt = [number, number] | [number, number, 1];

/** how a surface catches light: its curvature across and the rounding at its edges */
export type Surface =
  | 'side'      // a body side or door: gently curved top to bottom, small rounded edges
  | 'hood'      // hood side: flatter, crisp top edge
  | 'roof'      // strongly curved over the top
  | 'fender'    // a separate round fender: pillow-shaped, big radius
  | 'flat';     // a flat plate (running board top, rack)

export type Material = 'paint' | 'paint2' | 'black' | 'chrome' | 'glass' | 'rubber' | 'wood' | 'shadow' | 'canvas' | 'iron' | 'lens' | 'lensR' | 'white';

/** a part that can be swapped as a unit from another car */
/** the eleven places a part can be swapped (review 15): wheels are the eleventh, kept in WheelSpec */
export type Slot = 'grille' | 'lamp' | 'tail' | 'bumperF' | 'bumperR' | 'fenderF' | 'fenderR' | 'roof' | 'board' | 'spare';

export interface Panel {
  id: string;
  /** closed outline, clockwise or not */
  pts: Pt[];
  material: Material;
  surface: Surface;
  /** draw order: lower first */
  z: number;
  /** panels in the same group meet at a shut line drawn as a gap; different groups simply overlap */
  group?: string;
  /** edge rounding in px at 12.5 mm/px (default by surface) */
  bevel?: number;
  /** draw only where a panel whose id starts with this is already showing (two-tone areas, glass, things seen through glass) */
  clip?: string;
  /** circles cut out of the panel (wheel arches) */
  cut?: { x: number; z: number; r: number }[];
  /** swappable part this panel belongs to */
  slot?: Slot;
  /** small parts move as a whole when the car is stretched, instead of being stretched themselves */
  rigid?: boolean;
  /** the structure drawn inside the panel by the part library (render/car/flat.ts) */
  detail?: Detail;
}
/** structure inside a part: grille slats that follow its front edge, a fluted lens, a bright bumper bar, wood planks */
export type Detail =
  | { kind: 'grille'; pitch: number; shell?: number }
  | { kind: 'flutes'; pitch: number }
  | { kind: 'bar' }
  | { kind: 'planks'; pitch: number }
  | { kind: 'ribs'; pitch: number };

/** where the car's sections are, for stretching it: wheel centres, arch radius, cowl, cabin end, belt and roof heights */
export interface Landmarks { fx: number; rx: number; r: number; gap: number; cowl: number; cab: number; belt: number; roof: number }

/** details laid on top of the panels */
export type Feature =
  | { kind: 'seam'; pts: Pt[]; lit?: boolean }                                       // a shut line (door, hood, trunk)
  | { kind: 'trim'; pts: Pt[]; width?: number }                         // chrome moulding along a line
  | { kind: 'handle'; at: Pt; len?: number }                            // door handle
  | { kind: 'hinge'; at: Pt }                                           // exposed hinge knuckle
  | { kind: 'louvres'; x0: number; x1: number; z0: number; z1: number; n: number; slant?: number }
  | { kind: 'lamp'; at: Pt; r: number; facing: 'front' | 'rear' }      // headlamp bucket or tail lamp
  | { kind: 'bolt'; at: Pt }
  | { kind: 'cap'; at: Pt; h: number }                                  // radiator cap and its mascot post
  | { kind: 'plate'; x0: number; z0: number; w: number; h: number }     // blank number plate
  | { kind: 'highlight'; pts: Pt[]; width?: number }                    // a reflection band along a crown (fender top, roof)
  | { kind: 'crease'; pts: Pt[] }                                       // a pressed character line: lit above, shaded below
  | { kind: 'bead'; pts: Pt[] }                                         // welting where a fender meets the body
  | { kind: 'interior'; belt: number; seats: number[]; wheel?: number; seatH?: number };   // what is seen through the glass

export interface WheelSpec {
  /** centre x mm; z is the radius (it stands on the ground) */
  x: number;
  r: number;
  /** rim radius as a share of the tyre radius */
  rim: number;
  style: 'wire' | 'artillery' | 'disc';
  spokes: number;
  rimMaterial: Material;
  whitewall?: number;
  /** a spare carried on the body: its own centre height */
  z?: number;
  spare?: boolean;
  /** draw order among panels */
  zOrder?: number;
  /** hub cap: radius as a share of the rim, rings pressed into it */
  cap?: number; capRings?: number;
  /** a chrome trim ring on the rim */
  trim?: boolean;
}

export interface CarDesign {
  name: string;
  year: number;
  length: number;
  height: number;
  /** body colours: main and second tone */
  paint: string;
  paint2: string;
  panels: Panel[];
  features: Feature[];
  wheels: WheelSpec[];
  /** window surround: a shadowed reveal or a chrome frame */
  frame?: 'reveal' | 'chrome';
  marks?: Landmarks;
  id?: string;
}
