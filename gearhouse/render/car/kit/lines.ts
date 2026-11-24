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
// across, the wheels' track) and every line, landmark and station follows, so a panel built from the lines follows too.
// The tweak's other dimensions (alpha 0.11, E1: the roof's height, the overhangs, the ride height, the cabin's place,
// the screen's rake) are a warp of the built body (makeWarp): one smooth map of space, the same for every panel, so two
// panels that shared a border point still share it (every seam stays closed) and no face folds over (each step of the
// map keeps the order of points along the axis it moves them on). The wheels and the engine are moved, not bent.
import { curve, clamp01, ginv, gp, inv01, type Tab, type V } from './geom';

export interface WheelSpec { /** the axle's station */ x: number; /** the tyre's radius */ r: number; /** half the track */ y: number; /** the tyre's width */ w: number; /** the rim's radius */ rim: number }
export interface ArchSpec { /** the arch's radius about the hub */ r: number; /** the well's inner wall (half-width) */ yin: number; /** its height over the hub when it is not round (half an ellipse; default r) */ rz?: number }
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
export interface NosePlan {
  /** 'round': a super-ellipse from the tip to the front arch; 'pointed': a prow drawn from the car's own table (straight
   *  tapering sides running forward to a tight corner and a blunt tip), the bumper's lines following the same plan */
  kind: 'round' | 'pointed' | 'wedge';
  /** the crest's foremost point (station) */ tip: At; /** the super-ellipse's power */ pow: number;
  /** 'pointed': the plan as shares, [along from the tip to the front arch, across from the centre line to the crest there], from [0, 0] to [1, 1] */
  plan?: Tab }
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
export interface Tweak { /** added between the arches */ wheelbase?: number; /** added to half the width (all y in proportion) */ halfWidth?: number;
  /** added to each wheel's distance from the centre line (the wells' inner walls go with them) */ halfTrack?: number;
  /** the warp (makeWarp): added to the roof's height (the glasshouse over the belt line scaled up or down) */ roof?: number;
  /** the body stretched ahead of the front arch and behind the rear arch */ overhangF?: number; overhangR?: number;
  /** the body raised over its wheels */ ride?: number;
  /** the cabin moved forward (the screen, the roof and the glass over the belt line with it; the bonnet ahead of it and the
   *  deck behind it give and take) */ cabin?: number;
  /** degrees the screen lies further back: its top (and the roof's front edge) goes back, its foot stays */ rake?: number }

export interface Arch { x: number; r: number; /** the hub's height (the tyre's radius) */ z: number; yin: number; /** the arch's height over the hub */ rz: number }
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
  /** the nose's plan as shares: how far along (tip to front arch) the crest is at a share across, and its inverse */
  nose: { along(f: number): number; across(v: number): number };
  /** the arches' height at x (0 clear of them) */
  archZ(x: number): number;
  stations: number[];
  /** the index of the station at a (a landmark or the sheet's mm), which must exist */
  at(a: At): number;
  /** the index of the station at x (mm in the car's frame, already through mx), which must exist */
  atX(x: number): number;
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
  const dT = tweak.halfTrack ?? 0, wheel = (s: WheelSpec): Wheel => ({ x: mx(s.x), r: s.r, y: my(s.y) + dT, w: s.w, rim: s.rim });
  const wheels = { f: wheel(S.wheels.f), r: wheel(S.wheels.r) };
  const arches = { f: { x: wheels.f.x, r: S.arches.f.r, z: wheels.f.r, yin: my(S.arches.f.yin) + dT, rz: S.arches.f.rz ?? S.arches.f.r }, r: { x: wheels.r.x, r: S.arches.r.r, z: wheels.r.r, yin: my(S.arches.r.yin) + dT, rz: S.arches.r.rz ?? S.arches.r.r } };
  const archZ = (x: number) => { for (const a of [arches.f, arches.r]) if (Math.abs(x - a.x) < a.r - 0.5) return a.z + a.rz / a.r * Math.sqrt(a.r * a.r - (x - a.x) ** 2); return 0; };
  // the stations: the arches' ends and every arcDeg round them, the car's own between
  const st = S.stations, pins = (st.pins ?? []).map(X), snap = st.snap ?? 20;
  const arc = (a: Arch) => { const n = Math.round(180 / st.arcDeg), out = [Math.round(a.x - a.r)]; for (let k = 1; k < n; k++) { const v = Math.round(a.x - a.r * Math.cos(k * st.arcDeg * Math.PI / 180)), p = pins.find(q => Math.abs(q - v) <= snap); out.push(p ?? v); } out.push(Math.round(a.x + a.r)); return out; };
  const stations = [...st.front.map(X), ...arc(arches.f), ...st.mid.map(X), ...arc(arches.r), ...st.rear.map(X)];
  for (let i = 1; i < stations.length; i++) if (!(stations[i]! > stations[i - 1]!)) throw new Error(`lines: stations out of order at ${stations[i]}`);
  const atX = (x: number) => { let best = -1, bd = 1; stations.forEach((s, i) => { const d = Math.abs(s - x); if (d < bd) { bd = d; best = i; } }); if (best < 0) throw new Error(`lines: no station at ${x}`); return best; }, at = (a: At) => atX(X(a));
  // the crest: round the nose along its plan, then its own line
  const xJ = stations[st.front.length]!, kw = w('crest')(xJ), tip = X(S.nose.tip), np = S.nose.pow;
  if (S.nose.kind === 'wedge') throw new Error('lines: nose plan wedge is not built yet');
  if (S.nose.kind === 'pointed' && !S.nose.plan) throw new Error('lines: a pointed nose needs its plan table');
  const planC = S.nose.kind === 'pointed' ? curve(S.nose.plan!) : null;
  const nose = planC ? { across: (v: number) => planC(clamp01(v)), along: inv01(planC) } : { across: (v: number) => ginv(v, np), along: (f: number) => gp(f, np) };
  const crestY = (x: number) => x < xJ ? kw * nose.across((x - tip) / (xJ - tip)) : w('crest')(x);
  const screen = X(S.centre.screen), gfoot = X(S.centre.glassFoot), b0 = X(S.belt[0]), b1 = X(S.belt[1]);
  return { sheet: S, tweak, length: S.length + dW, mx, my, X, Y, z, w, zTab: n => zT[n]!, wTab: n => wT[n]!,
    centre: x => x <= screen ? z('bonnet')(x) : x <= gfoot ? z('roof')(x) : z('deck')(x), half: x => w('half')(x),
    crest: x => [crestY(x), z('crest')(x)], belt: x => x >= b0 && x <= b1 ? [crestY(x), z('crest')(x)] : null, shoulder: x => [w('half')(x), z('shoulder')(x)],
    sill: S.levels.sill, foot: S.levels.foot, wheels, arches, nose, archZ, stations, at, atX, span: (a, b) => stations.slice(at(a), at(b) + 1) };
}

// ---- the body's warp: the tweak's dimensions past the sheet's own stretch ----
export interface BodyWarp {
  /** nothing to do (every dimension the base's own) */ none: boolean;
  /** a point of the body (the shell, its closures, the parts laid on it) moved */ body(p: V): V;
  /** the cabin's inside: moved whole with the cabin, then warped as the body (a lower roof brings its bulkhead down) */ inside(p: V): V;
  /** how far a part moved whole goes: the wheels (with the overhang ahead, never with the ride), the engine (and the ride) */ wheel: V; engine: V;
  /** the mesh's length after it */ length: number;
  /** the screen's top's move back (mm) for the rake asked */ rakeX: number;
}
const ramp = (a: number, b: number, x: number) => b === a ? (x >= b ? 1 : 0) : clamp01((x - a) / (b - a));
/** the warp for a tweak, from the car's landmarks: the screen's foot and the glass's foot (the sheet's centre line), the
 *  roof's front and back edges (the canopy's); every band and window is the car's own, so each base keeps its character.
 *  In order, each from the points the step before left:
 *    cabin   points over the belt line (a band 110 deep under it, blended) slide along: by the whole move from the screen's
 *            foot to the B pillar, by a share of it over the bonnet back from the front axle and over the deck forward from
 *            the rear arch; the arches, the sills and the floor stay
 *    rake    the glasshouse over the screen's foot, by its height (a share from the foot up to the screen's top): its top and
 *            the roof's front edge go back, the roof between them and the B pillar shortening
 *    roof    the glasshouse from the screen's foot to the glass's foot (blended in over 250 mm ahead and 300 behind) scaled
 *            in height over the belt line
 *    overhangs  the body ahead of the front arch and behind the rear arch stretched along the car
 *    ride    all of it raised over the wheels */
export function makeWarp(L: Lines, roofEdges: [At, At], t: Tweak): BodyWarp {
  const dC = -(t.cabin ?? 0), dH = t.roof ?? 0, dF = t.overhangF ?? 0, dR = t.overhangR ?? 0, up = t.ride ?? 0, deg = t.rake ?? 0, S = L.sheet;
  const XA = L.X(S.centre.screen), XG = L.X(S.centre.glassFoot), XR0 = L.X(roofEdges[0]), XR1 = L.X(roofEdges[1]), len = L.length;
  const fx = L.wheels.f.x, xRa = L.arches.r.x - L.arches.r.r, xF = L.arches.f.x - L.arches.f.r, xR = L.arches.r.x + L.arches.r.r;
  let zBelt = Infinity, zRoof = 0; for (let x = XA; x <= XR1; x += 20) zBelt = Math.min(zBelt, L.crest(x)[1]); for (let x = XR0; x <= XR1; x += 10) zRoof = Math.max(zRoof, L.centre(x));
  const zFoot = L.centre(XA), zTop = L.centre(XR0), run = XR0 - XA, a0 = Math.atan2(zTop - zFoot, run), a1 = Math.max(0.12, a0 - deg * Math.PI / 180);
  const rakeX = deg ? (zTop - zFoot) / Math.tan(a1) - run : 0, none = !dC && !dH && !dF && !dR && !up && !rakeX;
  // the cabin's slide along the car, and how much of it a point takes by its height
  const slide = (x: number) => x <= XA ? dC * ramp(fx, XA, x) : x <= XR1 ? dC : dC * (1 - ramp(XR1, xRa, x)), over = (z: number) => ramp(zBelt - 110, zBelt, z);
  const warp = (p: V, whole: boolean): V => { let [x, y, z] = p;
    if (dC) x += whole ? dC : slide(x) * over(z);
    const A = XA + dC, R0 = XR0 + dC, R1 = XR1 + dC, G = XG + dC;
    if (rakeX) x += rakeX * (x <= A ? ramp(A - 150, A, x) : 1 - ramp(R0, R1, x)) * ramp(zFoot, zTop, z);
    if (dH) z += dH * ramp(zBelt, zRoof, z) * (x <= G ? ramp(A - 250, A, x) : 1 - ramp(G, Math.min(G + 300, len), x));
    x = x < xF ? x * (xF + dF) / xF : x > xR ? xR + dF + (x - xR) * (len - xR + dR) / (len - xR) : x + dF;
    return [x, y, z + up]; };
  return { none, body: p => warp(p, false), inside: p => warp(p, true), wheel: [dF, 0, 0], engine: [dF, 0, up], length: len + dF + dR, rakeX };
}
