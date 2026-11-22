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
  /** parts this one runs into without a seam (a wing swept into the body): no dark outline where it meets them */
  join?: string[];
  /** circles cut out of the panel (wheel arches) */
  cut?: { x: number; z: number; r: number }[];
  /** swappable part this panel belongs to */
  slot?: Slot;
  /** small parts move as a whole when the car is stretched, instead of being stretched themselves */
  rigid?: boolean;
  /** the part's own colour, measured on the reference sheet: its tone steps are built from it instead of the material's (review 29) */
  color?: string;
  /** the structure drawn inside the panel by the part library (render/car/flat.ts) */
  detail?: Detail;
  /** the element of the car this panel is (hood, door, roof ...): a whole closed shape, hidden parts included */
  element?: string;
  /** how light falls on the panel: tone steps on a small grid over its own width (nx) and each column's height (nt).
   *  It belongs to the shape, so it stretches with it and is dithered afresh at any size. */
  shade?: { nx: number; nt: number; v: number[] };
}
/** structure inside a part: grille slats that follow its front edge, a fluted lens, a bright bumper bar, wood planks */
export type Detail =
  | { kind: 'grille'; pitch: number; shell?: number }
  | { kind: 'flutes'; pitch: number }
  | { kind: 'bar' }
  | { kind: 'planks'; pitch: number }
  | { kind: 'ribs'; pitch: number }
  | { kind: 'vbars'; pitch: number; ring?: number }
  /** a radiator core or grille as the sheet shows it (review 70): square wire, honeycomb cells, diamond wire, woven
   *  gauze, upright slats (bright metal when `metal`), or the fine tubes and fins of a tube core; pitch in mm */
  | { kind: 'core'; pattern: 'square' | 'honeycomb' | 'diamond' | 'woven' | 'slats' | 'tubes'; pitch: number; metal?: boolean }
  /** a wire mesh: bright wires both ways over a dark ground */
  | { kind: 'mesh'; pitch: number }
  /** a tyre seen face on: the tread blocks crowd together towards the top and bottom (the tread turns away), the
   *  shoulders are darker than the crown */
  | { kind: 'treadFace'; pitch: number }
  /** a radiator core: small dark cells in rows, a little lighter at the top */
  | { kind: 'cells'; pitch: number }
  /** a lamp's silvered reflector seen through its glass */
  | { kind: 'bowl' };

/** tone steps on a grid over a panel's box: x0 and z1 are its top left corner in mm */
export interface ToneMap { x0: number; z1: number; w: number; h: number; mm: number; steps: number; d: number[] }
/** where the car's sections are, for stretching it: wheel centres, arch radius, cowl, cabin end, belt and roof heights */
/** Method ZY: what the reference view shows of each element, kept with the element. `b` is the element's box when it was
 *  read (x0, x1, z0, z1 in mm), `x0`/`z1` the top left of the grid; each cell is material * 16 + tone step, or -1 where
 *  the view does not show the element (run-length coded: value, count). The cells move and stretch with the element. */
export interface ElementSkin { b: [number, number, number, number]; x0: number; z1: number; w: number; h: number; d: number[]; sig?: string }
/** common: the cells are steps of the game's own ramps (tools/ref/skin.py --common), so a car's skin and its parts share
 *  one palette with every other car and follow any paint; otherwise `tones` are the view's own colours */
export interface CarSkin { mm: number; paint: string; materials: Material[]; tones?: Partial<Record<Material, string[]>>; common?: boolean; elements: Record<string, ElementSkin> }
/** Method Z2: what the view shows of an element as shapes, not cells. Each region is one material at one step of the
 *  game's ramp, as outlines in mm (x, z pairs) read when the element's box was `b`; holes are further rings (even-odd).
 *  Regions are drawn in order over the element; they stretch with it and are drawn afresh at any scale. */
export interface ElementDecals { b: [number, number, number, number]; r: { m: Material; l: number; rings: number[][] }[]; sig?: string }
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
  /** an off-road tyre: tread blocks round the outer edge */
  tread?: boolean;
  /** what the hub cap is: chrome unless given (a painted or black hub on working vehicles) */
  capMaterial?: Material;
  /** a chrome trim ring on the rim */
  trim?: boolean;
  /** a pressed disc pierced by a ring of holes (review 72: the 1935 roadster's): how many, the ring's radius and each
   *  hole's radius as shares of the rim */
  holes?: number; holeRing?: number; holeSize?: number;
  /** the hub cap's badge: a roundel quartered in two colours (or one), its radius a share of the cap */
  badge?: { colors: string[]; r?: number };
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
  /** where each panel is lighter and darker, read off a reference view (tools/ref/tones.py); keyed by panel id */
  tones?: Record<string, ToneMap>;
  /** parts from the part library (render/car/parts.ts), expanded into panels before drawing */
  parts?: import('./parts').PartSpec[];
  /** tone steps added to the glass: 0 dark with reflections, 1 pale as on a studio drawing */
  glassLift?: number;
  /** how glossy the paint is, 0 (flat) to 1 (new lacquer, polished): the sky and horizon it gives back, the light on its crowns */
  gloss?: number;
  /** the bright metal's own colour (nickel is warmer and greyer than chrome); a cold blue-white chrome when not given */
  chrome?: string;
  /** pale period glass of this colour, drawn with a shadow under the frame and broad soft reflections; dark glass with streaks when not given */
  glassTint?: string;
  /** colour of the canvas (hoods, tilts); a light buff when not given */
  canvas?: string;
  /** method ZY: the reference view's detail, element by element (tools/ref/skin.py) */
  skin?: CarSkin;
  /** method Z2: the view's detail as shapes, element by element (tools/ref/decals.py) */
  decals?: Record<string, ElementDecals>;
  id?: string;
}
