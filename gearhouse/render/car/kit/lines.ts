// The car kit's line system (docs/systems/95_nsx_kit_breakdown.md, section 2): every car is drawn from the same set of
// lines along its length, read off its sheet, and every panel is built from them (never from numbers of its own).
//   centre(x)    the centre line's height: nose, bonnet, (screen), roof, rear glass, deck
//   half(x)      half the width at the widest line (the plan)
//   crest(x)     the flank's top edge: the front wing's crest, then the belt under the side glass, then the rear wing's
//                ridge ([y, z]); round the nose it follows the nose's plan
//   belt(x)      the belt line where the glasshouse meets the body (the crest between the screen's foot and the glass's foot)
//   shoulder(x)  the widest line ([y, z]: half(x) at the shoulder's height)
//   sill, foot   the heights of the sill's crease and of the foot (the standard section's levels)
//   arches       the wheel arches (centre, radius, the hub's height, the well's inner wall)
//   stations     the stations along the car where the standard section is laid: the car's own list between the
//                arches, and every few degrees round each arch
// The sheet is in the drawing's frame; a `Tweak` stretches it (the wheelbase between the arches, the half-width
// across) and every line, landmark and station follows, so a panel built from the lines follows too.
import { curve, clamp01, ginv, type Tab } from './geom';

export interface WheelSpec { /** the axle's station */ x: number; /** the tyre's radius */ r: number; /** half the track */ y: number; /** the tyre's width */ w: number; /** the rim's radius */ rim: number }
export interface ArchSpec { /** the arch's radius about the hub */ r: number; /** the well's inner wall (half-width) */ yin: number }
/** a station given as a number (mm) or as a landmark's name */
export type At = number | string;
export interface StationSpec {
  /** stations round each arch every this many degrees (the arch's ends are stations too) */
  arcDeg: number;
  /** stations ahead of the front arch, between the arches, behind the rear arch */
  front: At[]; mid: At[]; rear: At[];
  /** landmarks an arch's station snaps to when one lies within `snap` mm (a panel edge that must fall on a station) */
  pins?: At[]; snap?: number;
}
/** the plan of the nose ahead of the front arch: the crest's line round it */
export interface NosePlan { /** 'round': a super-ellipse from the tip to the front arch */ kind: 'round' | 'pointed' | 'wedge'; /** the crest's foremost point (station) */ tip: At; /** the super-ellipse's power */ pow: number }
export interface LineSheet {
  /** overall length (the mesh's length) */
  length: number;
  wheels: { f: WheelSpec; r: WheelSpec };
  arches: { f: ArchSpec; r: ArchSpec };
  /** named stations (mm along the car) the panels refer to */
  x: Record<string, number>;
  /** named half-widths (mm) the panels refer to */
  y: Record<string, number>;
  /** height lines, [x, z]: at least `bonnet`, `crest`, `shoulder`, `roof`, `deck` */
  z: Record<string, Tab>;
  /** width lines, [x, y]: at least `half` and `crest` */
  w: Record<string, Tab>;
  /** where the centre line passes from the bonnet to the roof and from the roof to the deck (landmarks) */
  centre: { screen: At; glassFoot: At };
  /** where the crest is the belt (the glasshouse's foot): from, to */
  belt: [At, At];
  nose: NosePlan;
  /** the standard section's levels: the sill's crease and the foot */
  levels: { sill: number; foot: number };
  stations: StationSpec;
}
/** a change to the sheet (mm): the proof that a car is a kit, not a carving */
export interface Tweak { /** added between the arches */ wheelbase?: number; /** added to half the width (all y in proportion) */ halfWidth?: number }

export interface Arch { x: number; r: number; /** the hub's height (the tyre's radius) */ z: number; yin: number }
export interface Wheel { x: number; r: number; y: number; w: number; rim: number }
export interface Lines {
  sheet: LineSheet; tweak: Tweak; length: number;
  /** the sheet's x and y into the car's frame (a panel or part placed by sheet numbers goes through these) */
  mx(x: number): number; my(y: number): number;
  /** a landmark's station / half-width; a number passes through mx / my */
  X(a: At): number; Y(a: At): number;
  /** a height line and a width line by name */
  z(name: string): (x: number) => number; w(name: string): (x: number) => number;
  /** a line's table (in the car's frame) */
  zTab(name: string): Tab; wTab(name: string): Tab;
  centre(x: number): number; half(x: number): number;
  crest(x: number): [number, number]; belt(x: number): [number, number] | null; shoulder(x: number): [number, number];
  sill: number; foot: number;
  wheels: { f: Wheel; r: Wheel }; arches: { f: Arch; r: Arch };
  /** the arches' height at x (0 clear of them) */
  archZ(x: number): number;
  stations: number[];
  /** the index of the station at x (a landmark or mm), which must exist */
  at(x: At): number;
  /** the stations from a to b (both included) */
  span(a: At, b: At): number[];
}

export function makeLines(S: LineSheet, tweak: Tweak = {}): Lines {
  const fx = S.wheels.f.x, rx = S.wheels.r.x, xa = fx + S.arches.f.r, xb = rx - S.arches.r.r, dW = tweak.wheelbase ?? 0;
  const wMax = Math.max(...S.w.half!.map(p => p[1])), ky = 1 + (tweak.halfWidth ?? 0) / wMax;
  const mx = (x: number) => x + dW * clamp01((x - xa) / (xb - xa)), my = (y: number) => y * ky;
  const X = (a: At) => typeof a === 'number' ? mx(a) : (() => { const v = S.x[a]; if (v === undefined) throw new Error(`lines: no landmark ${a}`); return mx(v); })();
  const Y = (a: At) => typeof a === 'number' ? my(a) : (() => { const v = S.y[a]; if (v === undefined) throw new Error(`lines: no half-width ${a}`); return my(v); })();
  const zT: Record<string, Tab> = {}, wT: Record<string, Tab> = {}, zC: Record<string, (x: number) => number> = {}, wC: Record<string, (x: number) => number> = {};
  for (const [k, t] of Object.entries(S.z)) { zT[k] = t.map(([x, z]) => [mx(x), z]); zC[k] = curve(zT[k]!); }
  for (const [k, t] of Object.entries(S.w)) { wT[k] = t.map(([x, y]) => [mx(x), my(y)]); wC[k] = curve(wT[k]!); }
  const z = (n: string) => { const f = zC[n]; if (!f) throw new Error(`lines: no height line ${n}`); return f; }, w = (n: string) => { const f = wC[n]; if (!f) throw new Error(`lines: no width line ${n}`); return f; };
  const wheel = (s: WheelSpec): Wheel => ({ x: mx(s.x), r: s.r, y: my(s.y), w: s.w, rim: s.rim });
  const wheels = { f: wheel(S.wheels.f), r: wheel(S.wheels.r) };
  const arches = { f: { x: wheels.f.x, r: S.arches.f.r, z: wheels.f.r, yin: my(S.arches.f.yin) }, r: { x: wheels.r.x, r: S.arches.r.r, z: wheels.r.r, yin: my(S.arches.r.yin) } };
  const archZ = (x: number) => { for (const a of [arches.f, arches.r]) if (Math.abs(x - a.x) < a.r - 0.5) return a.z + Math.sqrt(a.r * a.r - (x - a.x) ** 2); return 0; };
  // the stations: the arches' ends and every arcDeg round them, the car's own between
  const st = S.stations, pins = (st.pins ?? []).map(X), snap = st.snap ?? 20;
  const arc = (a: Arch) => { const n = Math.round(180 / st.arcDeg), out = [Math.round(a.x - a.r)]; for (let k = 1; k < n; k++) { const v = Math.round(a.x - a.r * Math.cos(k * st.arcDeg * Math.PI / 180)), p = pins.find(q => Math.abs(q - v) <= snap); out.push(p ?? v); } out.push(Math.round(a.x + a.r)); return out; };
  const stations = [...st.front.map(X), ...arc(arches.f), ...st.mid.map(X), ...arc(arches.r), ...st.rear.map(X)];
  for (let i = 1; i < stations.length; i++) if (!(stations[i]! > stations[i - 1]!)) throw new Error(`lines: stations out of order at ${stations[i]}`);
  const at = (a: At) => { const x = X(a); let best = -1, bd = 1; stations.forEach((s, i) => { const d = Math.abs(s - x); if (d < bd) { bd = d; best = i; } }); if (best < 0) throw new Error(`lines: no station at ${a} (${x})`); return best; };
  // the crest: round the nose along its plan, then its own line
  const xJ = stations[st.front.length]!, kw = w('crest')(xJ), tip = X(S.nose.tip), np = S.nose.pow;
  const crestY = (x: number) => x < xJ ? kw * ginv((x - tip) / (xJ - tip), np) : w('crest')(x);
  const screen = X(S.centre.screen), gfoot = X(S.centre.glassFoot), b0 = X(S.belt[0]), b1 = X(S.belt[1]);
  return { sheet: S, tweak, length: S.length + dW, mx, my, X, Y, z, w, zTab: n => zT[n]!, wTab: n => wT[n]!,
    centre: x => x <= screen ? z('bonnet')(x) : x <= gfoot ? z('roof')(x) : z('deck')(x), half: x => w('half')(x),
    crest: x => [crestY(x), z('crest')(x)], belt: x => x >= b0 && x <= b1 ? [crestY(x), z('crest')(x)] : null, shoulder: x => [w('half')(x), z('shoulder')(x)],
    sill: S.levels.sill, foot: S.levels.foot, wheels, arches, archZ, stations, at, span: (a, b) => stations.slice(at(a), at(b) + 1) };
}
