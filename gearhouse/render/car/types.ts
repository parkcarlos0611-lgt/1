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

export type Material = 'paint' | 'paint2' | 'black' | 'chrome' | 'glass' | 'rubber' | 'wood' | 'shadow' | 'canvas';

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
}

/** details laid on top of the panels */
export type Feature =
  | { kind: 'seam'; pts: Pt[] }                                         // a shut line (door, hood, trunk)
  | { kind: 'trim'; pts: Pt[]; width?: number }                         // chrome moulding along a line
  | { kind: 'handle'; at: Pt; len?: number }                            // door handle
  | { kind: 'hinge'; at: Pt }                                           // exposed hinge knuckle
  | { kind: 'louvres'; x0: number; x1: number; z0: number; z1: number; n: number; slant?: number }
  | { kind: 'lamp'; at: Pt; r: number; facing: 'front' | 'rear' }      // headlamp bucket or tail lamp
  | { kind: 'bolt'; at: Pt }
  | { kind: 'cap'; at: Pt; h: number }                                  // radiator cap and its mascot post
  | { kind: 'plate'; x0: number; z0: number; w: number; h: number };    // blank number plate

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
}
