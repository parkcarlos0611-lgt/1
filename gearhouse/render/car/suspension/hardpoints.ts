// The suspension's hardpoints (docs/systems/101, M3): where each corner's arms pivot on the chassis and where they
// hold the upright, the damper's two ends, the anti-roll bar, the tie rod. Millimetres in the car's frame (x from the
// nose back, y across, z up); a corner's `side` is the sign of its y.
// A base's axle is given as a short specification by its type (AxleSpec: lengths and heights about the wheel, so it
// follows the tyres a design fits and the track it sets), and made into the explicit points of each corner
// (Hardpoints) that the kinematics (kinematics.ts), the parts (parts.ts) and, from M4, the physics all read.
//   doubleWishbone   two A-arms and a coil-over on the lower one: the NSX (forged aluminium arms all round), the F355
//                    (steel wishbones all round), the EB110 (wishbones all round, two coil-overs a side at the rear)
//   macpherson       (alpha 0.13, M4) a strut: the lower arm, and the coil-over's body clamped in the upright, its top
//                    mount on the body (no upper arm); made from a base's wishbone (its lower arm, its brake, its tie rod)
//   multilink        (alpha 0.13, M4: the rear) the upper arm and the lower one each as two separate links, solved as
//                    the wishbones they amount to: a longer upper link, its pivots tilted for more anti-squat
//   beamLeaf         (the 1930s' beam axle on leaf springs, for the restoration work): named here, not built yet
import type { V } from './kinematics';
import { add, dist, mix, mul, sub } from './kinematics';

export type SuspType = 'doubleWishbone' | 'macpherson' | 'multilink' | 'beamLeaf';
/** the wheel a corner carries: the axle's station, half the track, the tyre's radius and width, the rim's radius,
 *  how far inboard of its middle the wheel's back is closed (the joints stand inboard of that) */
export interface SuspWheel { x: number; y: number; r: number; w: number; rim: number; back: number }

export interface WishboneSpec {
  type: 'doubleWishbone';
  /** the lower arm: its length across the car, its chassis pivots ahead of and behind the axle (x from the axle), how far
   *  its ball joint sits below the hub (0: as low as the rim lets it), how much higher its pivots stand than the joint */
  lower: { len: number; span: [number, number]; drop?: number; rise: number };
  /** the upper arm: the same; its ball joint this far inboard of the lower one (the kingpin's lean) and behind it (the
   *  caster), over the hub by `lift` (0: as high as the rim lets it), its pivots `fall` lower than the joint */
  upper: { len: number; span: [number, number]; lift?: number; fall: number; inset: number; trail: number };
  /** the caster (degrees: the upper ball joint behind the lower one), in place of the upper arm's trail where set */
  caster?: number;
  /** what the linkage is drawn and solved as: the wishbones themselves, or a multilink rear's links (solved alike) */
  kind?: 'doubleWishbone' | 'multilink';
  /** the coil-overs: each one's x from the axle, where along the lower arm it stands (0 the pivots, 1 the ball joint),
   *  the top mount (inboard of the tyre's inner wall, over the hub), the spring's radius and wire */
  damper: { dx: number[]; at: number; top: [number, number]; spring: [number, number]; body: number };
  /** the anti-roll bar: its axis (x from the axle, z from the ground), its bar's radius, where along the lower arm
   *  its drop link holds (and how far toward the bar's side of the arm), the link's length (the bar's end over the arm,
   *  or under it when negative) */
  bar?: { dx: number; z: number; r: number; at: number; link: number };
  /** the tie rod (front, on the rack) or the toe link (rear, on the chassis): its outer end from the lower ball joint
   *  (x, up); its inner end is set between the arms' pivot axes as far up as the outer end is between the ball joints, so the wheel keeps its toe through its travel,
   *  then `trim` mm lower (alpha 0.13, M4: that rule leaves the toe turning about 2 mrad in 40 mm, out at the front and in
   *  at the rear, on these arms; a millimetre and a half lower leaves a little of each, as the makers set it) */
  steer: { dx: number; up: number; rack: boolean; trim?: number };
  /** the brake: the disc's radius and thickness, the caliper's length round the disc and where it sits (degrees from
   *  straight ahead of the hub, upward) */
  brake: { r: number; t: number; caliper: number; at: number };
}
/** a MacPherson strut: the lower arm as a wishbone's; the strut's top mount inboard of the tyre's inner wall and over
 *  the hub (as a coil-over's), the upright's clamp on the strut `foot` mm over the hub; the caster; the spring and its
 *  body; the bar, the tie rod and the brake as a wishbone's */
export interface StrutSpec { type: 'macpherson'; lower: WishboneSpec['lower']; top: [number, number]; foot: number; caster: number;
  damper: { spring: [number, number]; body: number }; bar?: WishboneSpec['bar']; steer: WishboneSpec['steer']; brake: WishboneSpec['brake'] }
export interface OtherSpec { type: 'beamLeaf' }
export type AxleSpec = WishboneSpec | StrutSpec | OtherSpec;
/** a base's suspension: its two axles and how its parts are finished */
export interface SuspSpec { front: AxleSpec; rear: AxleSpec; look: SuspLook }
export interface SuspLook { arms: string; armGloss: number; /** tubes (a fabricated arm) or forged blades */ armKind: 'tube' | 'forged'; upright: string; spring: string; damper: string; caliper: string; disc: string }

/** a corner's hardpoints */
export interface Hardpoints {
  type: SuspType; side: 1 | -1; front: boolean; wheel: SuspWheel;
  /** the wheel's centre */ wc: V;
  /** each arm's chassis pivots (front, rear) and its ball joint on the upright */
  lower: { f: V; r: V; bj: V }; upper: { f: V; r: V; bj: V };
  /** the tie rod or toe link: on the rack or the chassis, on the upright; `rack`: this corner steers */
  steer: { inner: V; outer: V; rack: boolean };
  /** each coil-over: its top mount on the chassis, its foot on the lower arm, the spring's seats (from the foot up to the
   *  lower one, from the top down to the upper one), the spring's radius and wire, the body's radius */
  dampers: { top: V; bot: V; seat: [number, number]; spring: [number, number]; body: number }[];
  /** the anti-roll bar's half: a point of its axis on this side, its arm's end, where its drop link holds the lower arm; its radius */
  bar?: { pivot: V; end: V; link: V; r: number };
  brake: { r: number; t: number; caliper: number; at: number };
  /** the travel the linkage is drawn through (mm from the static ride): up to the bump stop, down to full droop */
  travel: { bump: number; droop: number };
  /** the static setting (alpha 0.13): the upper pivots (a strut's top mount) moved outward by shims (mm: the wheel's
   *  top goes out, more positive camber), the toe link's inner end moved along +y (mm) */
  adj?: { camber: number; toe: number };
}

/** the travel drawn: the physics' stops (race/vehicle.ts: the bump stop past 90 mm up, the droop stop past 120 mm down) */
export const TRAVEL = { bump: 95, droop: 125 };

/** a double wishbone corner's points about its wheel */
export function wishbonePoints(S: WishboneSpec, w: SuspWheel, side: 1 | -1, front: boolean): Hardpoints {
  // across the car: `inb` mm inboard of the wheel's middle
  const P = (dx: number, inb: number, z: number): V => [w.x + dx, side * (w.y - inb), z];
  const bjIn = w.back + 24, lowZ = w.r - (S.lower.drop ?? Math.min(w.rim - 58, w.r - 150)), upZ = w.r + (S.upper.lift ?? w.rim - 66);
  const trail = S.caster === undefined ? S.upper.trail : Math.tan(S.caster * Math.PI / 180) * (upZ - lowZ);
  const lower = { f: P(S.lower.span[0], bjIn + S.lower.len, lowZ + S.lower.rise), r: P(S.lower.span[1], bjIn + S.lower.len, lowZ + S.lower.rise), bj: P(-trail / 2, bjIn, lowZ) };
  const ui = bjIn + S.upper.inset, upper = { f: P(S.upper.span[0], ui + S.upper.len, upZ - S.upper.fall), r: P(S.upper.span[1], ui + S.upper.len, upZ - S.upper.fall), bj: P(trail / 2, ui, upZ) };
  // the tie rod: its outer end on the upright's arm; its inner end between the two arms' pivot axes, as far up between
  // them as the outer end is between the ball joints (the rod then swings with the arms and the wheel keeps its toe)
  const outer = add(lower.bj, [S.steer.dx, side * -6, S.steer.up]), k = S.steer.up / (upper.bj[2] - lower.bj[2]);
  const inner: V = [outer[0], side * (Math.abs(lower.f[1]) + (Math.abs(upper.f[1]) - Math.abs(lower.f[1])) * k), lower.f[2] + (upper.f[2] - lower.f[2]) * k - (S.steer.trim ?? 0)];
  // the coil-overs: each stands in a plane across the car (so two side by side move as one)
  const mid = mix(lower.f, lower.r, 0.5), foot = mix([w.x, mid[1], mid[2]], [w.x, lower.bj[1], lower.bj[2]], S.damper.at);
  const dampers = S.damper.dx.map(dx => { const bot: V = [w.x + dx, foot[1], foot[2] + 22], top = P(dx, w.w / 2 + S.damper.top[0], w.r + S.damper.top[1]), L = Math.hypot(top[1] - bot[1], top[2] - bot[2]);
    return { top, bot, seat: [L * 0.5, 30] as [number, number], spring: S.damper.spring, body: S.damper.body }; });
  let bar: Hardpoints['bar'];
  if (S.bar) { const B = S.bar, leg = B.dx < 0 ? lower.f : lower.r, link = mix(leg, lower.bj, B.at), end = add(link, [0, 0, B.link]); bar = { pivot: [w.x + B.dx, end[1], B.z], end, link, r: B.r }; }
  return { type: S.kind ?? 'doubleWishbone', side, front, wheel: w, wc: [w.x, side * w.y, w.r], lower, upper, steer: { inner, outer, rack: S.steer.rack }, dampers, ...(bar ? { bar } : {}), brake: S.brake, travel: { ...TRAVEL } };
}

/** a MacPherson corner's points about its wheel: the lower arm as a wishbone's; the strut from the upright's clamp (on
 *  the line from the lower ball joint to the top mount: the steering axis) up to the mount. Its `upper` is that line:
 *  the mount (both pivots) and the clamp's point (where an upper ball joint would be) */
export function strutPoints(S: StrutSpec, w: SuspWheel, side: 1 | -1, front: boolean): Hardpoints {
  const P = (dx: number, inb: number, z: number): V => [w.x + dx, side * (w.y - inb), z];
  const bjIn = w.back + 24, lowZ = w.r - (S.lower.drop ?? Math.min(w.rim - 58, w.r - 150)), topZ = w.r + S.top[1], tan = Math.tan(S.caster * Math.PI / 180);
  const bj = P(0, bjIn, lowZ), top = P(tan * (topZ - lowZ), w.w / 2 + S.top[0], topZ), k = (w.r + S.foot - lowZ) / (topZ - lowZ), foot = mix(bj, top, k);
  const lower = { f: P(S.lower.span[0], bjIn + S.lower.len, lowZ + S.lower.rise), r: P(S.lower.span[1], bjIn + S.lower.len, lowZ + S.lower.rise), bj };
  // the tie rod: its inner end between the lower arm's pivot axis and the top mount, as far up as its outer end stands
  const outer = add(bj, [S.steer.dx, side * -6, S.steer.up]), q = S.steer.up / (top[2] - bj[2]);
  const inner: V = [outer[0], side * (Math.abs(lower.f[1]) + (Math.abs(top[1]) - Math.abs(lower.f[1])) * q), lower.f[2] + (top[2] - lower.f[2]) * q];
  const L = dist(top, foot), dampers = [{ top, bot: foot, seat: [L * 0.42, 34] as [number, number], spring: S.damper.spring, body: S.damper.body }];
  let bar: Hardpoints['bar'];
  if (S.bar) { const B = S.bar, leg = B.dx < 0 ? lower.f : lower.r, link = mix(leg, lower.bj, B.at), end = add(link, [0, 0, B.link]); bar = { pivot: [w.x + B.dx, end[1], B.z], end, link, r: B.r }; }
  return { type: 'macpherson', side, front, wheel: w, wc: [w.x, side * w.y, w.r], lower, upper: { f: top, r: top, bj: foot }, steer: { inner, outer, rack: S.steer.rack }, dampers, ...(bar ? { bar } : {}), brake: S.brake, travel: { ...TRAVEL } };
}

/** an axle's two corners (+y first) */
export function axlePoints(S: AxleSpec, w: SuspWheel, front: boolean): [Hardpoints, Hardpoints] {
  if (S.type === 'doubleWishbone') return [wishbonePoints(S, w, 1, front), wishbonePoints(S, w, -1, front)];
  if (S.type === 'macpherson') return [strutPoints(S, w, 1, front), strutPoints(S, w, -1, front)];
  throw new Error(`suspension: ${S.type} is not built yet`); }

/** the hardpoints moved whole (the chassis' place in a car whose body is warped) */
export function movePoints(H: Hardpoints, d: V): Hardpoints { const m = (p: V) => add(p, d), arm = (a: { f: V; r: V; bj: V }) => ({ f: m(a.f), r: m(a.r), bj: m(a.bj) });
  return { ...H, wc: m(H.wc), lower: arm(H.lower), upper: arm(H.upper), steer: { ...H.steer, inner: m(H.steer.inner), outer: m(H.steer.outer) }, dampers: H.dampers.map(q => ({ ...q, top: m(q.top), bot: m(q.bot) })),
    ...(H.bar ? { bar: { ...H.bar, pivot: m(H.bar.pivot), end: m(H.bar.end), link: m(H.bar.link) } } : {}) }; }
void mul; void sub;

// ---- the bases ----
const DISC = '#8d9094';
/** the NSX (1990): forged aluminium double wishbones front and rear, a coil-over on each lower arm, bars both ends; 282 mm discs */
const NSX: SuspSpec = {
  front: { type: 'doubleWishbone', lower: { len: 330, span: [-150, 170], rise: 14 }, upper: { len: 232, span: [-175, 175], fall: 22, inset: 22, trail: 16 },
    damper: { dx: [0], at: 0.46, top: [135, 215], spring: [38, 6], body: 23 }, bar: { dx: -235, z: 250, r: 10, at: 0.62, link: 70 }, steer: { dx: -112, up: 52, rack: true, trim: 1.5 }, brake: { r: 141, t: 24, caliper: 110, at: 180 } },
  rear: { type: 'doubleWishbone', lower: { len: 300, span: [-160, 170], rise: 16 }, upper: { len: 215, span: [-150, 280], fall: 24, inset: 20, trail: 0 },
    damper: { dx: [64], at: 0.5, top: [150, 275], spring: [38, 6], body: 23 }, bar: { dx: 225, z: 168, r: 8.5, at: 0.62, link: -44 }, steer: { dx: 118, up: 50, rack: false, trim: 1.5 }, brake: { r: 141, t: 22, caliper: 96, at: 0 } },
  look: { arms: '#b4b7bb', armGloss: 0.55, armKind: 'forged', upright: '#9da0a4', spring: '#c9342b', damper: '#2a2c30', caliper: '#1b1b1e', disc: DISC } };
/** the F355 (1994): unequal-length steel wishbones all round, coil-overs with electronic dampers, bars both ends; 300 / 310 mm discs */
const F355: SuspSpec = {
  front: { type: 'doubleWishbone', lower: { len: 335, span: [-150, 170], rise: 14 }, upper: { len: 236, span: [-175, 175], fall: 22, inset: 22, trail: 18 },
    damper: { dx: [0], at: 0.46, top: [135, 215], spring: [38, 6], body: 23 }, bar: { dx: -235, z: 245, r: 10, at: 0.62, link: 70 }, steer: { dx: -112, up: 52, rack: true, trim: 1.5 }, brake: { r: 150, t: 26, caliper: 118, at: 180 } },
  rear: { type: 'doubleWishbone', lower: { len: 320, span: [-160, 170], rise: 16 }, upper: { len: 226, span: [-150, 280], fall: 24, inset: 20, trail: 0 },
    damper: { dx: [64], at: 0.5, top: [150, 275], spring: [38, 6], body: 23 }, bar: { dx: 225, z: 162, r: 9, at: 0.62, link: -44 }, steer: { dx: 118, up: 50, rack: false, trim: 1.5 }, brake: { r: 155, t: 26, caliper: 110, at: 0 } },
  look: { arms: '#232427', armGloss: 0.35, armKind: 'tube', upright: '#8f9296', spring: '#d8b21c', damper: '#c9c2a2', caliper: '#b3161b', disc: DISC } };
/** the EB110 (1991): double wishbones all round, a pull of two coil-overs a side at the rear (one ahead of the driveshaft,
 *  one behind), one at the front beside the front driveshaft; 332 mm discs */
const EB110: SuspSpec = {
  front: { type: 'doubleWishbone', lower: { len: 335, span: [-150, 180], rise: 14 }, upper: { len: 236, span: [-150, 300], fall: 22, inset: 22, trail: 18 },
    damper: { dx: [64], at: 0.5, top: [135, 215], spring: [38, 6], body: 23 }, bar: { dx: -235, z: 250, r: 10, at: 0.62, link: 70 }, steer: { dx: -112, up: 52, rack: true, trim: 1.5 }, brake: { r: 166, t: 28, caliper: 124, at: 180 } },
  rear: { type: 'doubleWishbone', lower: { len: 330, span: [-200, 200], rise: 16 }, upper: { len: 232, span: [-270, 270], fall: 24, inset: 20, trail: 0 },
    damper: { dx: [-84, 84], at: 0.46, top: [150, 275], spring: [33, 5.5], body: 20 }, bar: { dx: 255, z: 165, r: 9, at: 0.62, link: -44 }, steer: { dx: 128, up: 50, rack: false, trim: 1.5 }, brake: { r: 166, t: 28, caliper: 124, at: 0 } },
  look: { arms: '#2a2c30', armGloss: 0.35, armKind: 'tube', upright: '#a2a5a9', spring: '#1f4fa3', damper: '#2a2c30', caliper: '#3a3d42', disc: DISC } };
/** each kit base's suspension, by the kit's id */
export const SUSPENSION: Record<string, SuspSpec> = { nsx: NSX, f355: F355, eb110: EB110 };
