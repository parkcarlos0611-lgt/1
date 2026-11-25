// The drive's cameras (alpha 0.12, the players' "the camera feels cramped"): a perspective chase from behind the car,
// near or far, the bonnet's view and the driver's seat, beside the older orthographic views (from above, turning with
// the car, and the cinematic trackside shots). Pure: the drive gives each frame the car's state and a ground height,
// and gets back an eye, a heading, a tilt and a field of view for the live renderer (render/live/renderer.ts LiveView).
// Also the touch pedals' mapping (a finger's height on the pedal to its opening) and the cycle of the views.
import type { Mesh } from '../render/car/mesh';

export type CamView = 'far' | 'near' | 'hood' | 'cabin' | 'cine' | 'top';
/** the views in the order the C key and the camera button go through them (the cabin only for a car with a seat) */
export const CAM_VIEWS: readonly { id: CamView; name: string }[] = [
  { id: 'far', name: '추격 (멀리)' }, { id: 'near', name: '추격 (가까이)' }, { id: 'hood', name: '보닛' }, { id: 'cabin', name: '운전석' },
  { id: 'cine', name: '시네마틱' }, { id: 'top', name: '위에서 (기존)' }];
export const CAM_DEFAULT: CamView = 'far';
export const isCamView = (v: unknown): v is CamView => CAM_VIEWS.some(c => c.id === v);
/** the perspective views (the rest are the orthographic renderer's own) */
export const perspective = (v: CamView) => v === 'far' || v === 'near' || v === 'hood' || v === 'cabin';
/** the next view after v, skipping those the car cannot have */
export function nextView(v: CamView, ok: (v: CamView) => boolean = () => true): CamView {
  const i = CAM_VIEWS.findIndex(c => c.id === v); for (let k = 1; k <= CAM_VIEWS.length; k++) { const c = CAM_VIEWS[(i + k) % CAM_VIEWS.length]!.id; if (ok(c)) return c; } return v; }

// ---- the touch pedals ----
/** a finger's place on an upright pedal as its opening 0..1: the bottom (dead) 0, the top 1, straight between. y is the
 *  finger's height on the screen (down +), top and h the pedal's; a finger that slides off it holds the end it left by */
export function pedalValue(y: number, top: number, h: number, dead = 0.08): number {
  if (!(h > 0)) return 0; const t = (top + h - y) / h; return Math.max(0, Math.min(1, (t - dead) / (1 - 2 * dead))); }

/** the pedals' state carried from step to step: the throttle and brake the car gets (0..1), the gear's direction, how long
 *  the brake has been held at a standstill */
export interface PedalState { throttle: number; brake: number; reverse: boolean; revHold: number }
/** one step's pedals: the analog amounts (a touch pedal's or a gamepad trigger's, -1 none), the keys held, Shift (half
 *  throttle from the keyboard), the gauge mode (a key opens it slowly) and the car's speed (m/s) */
export interface PedalIn { gasA: number; brakeA: number; gasKey: boolean; brakeKey: boolean; shift?: boolean; progressive?: boolean; speed: number }
/** the pedals for one step (review 169's reverse, alpha 0.12's analog pedals): an analog pedal sets its opening as far as
 *  it is pressed (quickly, not in one step), a key opens and closes it over time. Holding the brake (a key, or a pedal past
 *  a quarter) at a standstill for half a second engages reverse; then the brake drives backwards and the accelerator
 *  brakes; the accelerator (past an eighth) at a standstill puts it back in first. Changes s; returns what to tell the
 *  driver when the direction changes */
export function pedalStep(s: PedalState, i: PedalIn, dt: number): '후진' | '전진' | null {
  const gasK = i.gasKey || i.gasA > 0.12, brakeK = i.brakeKey || i.brakeA > 0.25; let said: '후진' | '전진' | null = null;
  if (!s.reverse) { s.revHold = brakeK && !gasK && i.speed < 0.4 ? s.revHold + dt : 0; if (s.revHold > 0.5) { s.reverse = true; s.revHold = 0; said = '후진'; } }
  else if (gasK && i.speed < 0.4) { s.reverse = false; said = '전진'; }
  const r = s.reverse, fwdK = r ? brakeK : gasK, stopK = r ? gasK : brakeK, fwdA = r ? i.brakeA : i.gasA, stopA = r ? i.gasA : i.brakeA, fwdKey = r ? i.brakeKey : i.gasKey, stopKey = r ? i.gasKey : i.brakeKey;
  const toward = (x: number, to: number, up: number, dn: number) => x < to ? Math.min(to, x + up * dt) : Math.max(to, x - dn * dt);
  if (fwdA >= 0 && !fwdKey) s.throttle = toward(s.throttle, fwdA, 8, 10);
  else if (fwdK && i.shift) s.throttle = toward(s.throttle, 0.5, i.progressive ? 0.55 : 2.2, 6);
  else s.throttle = Math.max(0, Math.min(1, s.throttle + (fwdK ? (i.progressive ? 0.55 : 2.2) : (i.progressive ? -3 : -6)) * dt));   /* review 147: a key opens the throttle over about half a second */
  if (stopA >= 0 && !stopKey) s.brake = toward(s.brake, stopA, 10, 12); else s.brake = Math.max(0, Math.min(1, s.brake + (stopK ? 5 : -8) * dt));
  return said; }

// ---- the gauges' place ----
/** where the two dials go (picture pixels): from x0 (right of the on-screen wheel) to right (left of the pedals, or the
 *  picture's edge), their foot at bottom, r their wanted radius. Side by side where they fit; else one above the other (a
 *  phone held upright: the wheel and the pedals leave a narrow gap), smaller if even one does not fit; never under 18 */
export function dialPlace(x0: number, right: number, bottom: number, r: number): { r: number; speed: [number, number]; rpm: [number, number] } {
  const room = right - x0; if (room >= 4 * r + 8) return { r, speed: [x0 + r, bottom - r], rpm: [x0 + 3 * r + 8, bottom - r] };
  const rr = Math.max(18, Math.min(r, Math.floor(room / 2))), cx = x0 + Math.max(rr, room / 2);
  return { r: rr, speed: [cx, bottom - rr], rpm: [cx, bottom - 3 * rr - 6] }; }

// ---- springs ----
/** one step of a critically damped spring (natural frequency w, rad/s) from x moving at v toward target: [x, v]. Exact
 *  for a still target, so it neither overshoots nor goes unstable at a long frame */
export function spring(x: number, v: number, target: number, w: number, dt: number): [number, number] {
  const d = x - target, e = Math.exp(-w * dt), a = v + w * d; return [target + (d + a * dt) * e, (v - w * a * dt) * e]; }
/** the same for an angle: the short way round */
export function angSpring(x: number, v: number, target: number, w: number, dt: number): [number, number] {
  const d = Math.atan2(Math.sin(target - x), Math.cos(target - x)); const [y, u] = spring(0, v, d, w, dt); return [x + y, u]; }

// ---- the field of view ----
/** the vertical half-angle's tangent for a picture of this aspect (width / height): the base vertical angle in a wide
 *  picture, widened in a tall one so the picture is at least minH degrees across (a phone held upright still shows the
 *  road beside the car), never past maxV */
export function fovTan(aspect: number, baseV: number, minH = 62, maxV = 96): number {
  const t = Math.tan(baseV * Math.PI / 360), tH = Math.tan(minH * Math.PI / 360) / Math.max(0.2, aspect); return Math.min(Math.tan(maxV * Math.PI / 360), Math.max(t, tH)); }
/** the tilt (degrees down) that puts a point drop metres below the eye and dist ahead at carY of the picture's height
 *  (0 top .. 1 bottom), the vertical half-angle's tangent being tv */
export function aimPitch(drop: number, dist: number, tv: number, carY: number): number {
  return (Math.atan2(drop, dist) - Math.atan((2 * carY - 1) * tv)) * 180 / Math.PI; }

// ---- where on a car the bonnet's and the driver's eyes are (mesh millimetres: x back from the nose, y to the left, z up) ----
export interface CarEyes { len: number; height: number; /** the bonnet's eye: x back from the nose, z */ hood: [number, number]; /** the driver's eye (none: no seat in the mesh) */ seat: [number, number, number] | null }
export function carEyes(M: Mesh): CarEyes {
  const P = M.pos, n = M.n, len = M.length; let top = 0; for (let i = 2; i < n * 9; i += 3) top = Math.max(top, P[i]!);
  // the bonnet: the highest point of the car's front 40 % within 45 cm of the middle (its mascot, its scuttle), the eye a little above it at its back end
  const hx = len * 0.4; let hz = 0; for (let i = 0; i < n * 9; i += 3) { const x = P[i]!, y = P[i + 1]!, z = P[i + 2]!; if (x <= hx && Math.abs(y) < 450) hz = Math.max(hz, z); }
  if (!hz) for (let i = 0; i < n * 9; i += 3) if (P[i]! <= hx) hz = Math.max(hz, P[i + 2]!);   /* nothing near the middle (a plain box): the front's top */
  // the seat: the triangles of a part named so; the eye over its back half, the height of a sitting driver's eyes, under the roof
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity;
  if (M.names) for (let t = 0; t < n; t++) { if (M.names[M.part[t]!] !== 'seat') continue; for (let k = 0; k < 3; k++) { const j = t * 9 + k * 3, x = P[j]!, y = P[j + 1]!, z = P[j + 2]!; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); } }
  let seat: CarEyes['seat'] = null;
  if (x0 < x1) { const sx = x0 + (x1 - x0) * 0.62, sy = y1 - y0 > 700 ? y1 - 260 : (y0 + y1) / 2; let sz = z0 + 840, roof = Infinity;
    for (let i = 0; i < n * 9; i += 3) { const x = P[i]!, y = P[i + 1]!, z = P[i + 2]!; if (Math.abs(x - sx) < 250 && Math.abs(y - sy) < 200 && z > z0 + 500) roof = Math.min(roof, z); }
    if (roof < Infinity) sz = Math.min(sz, roof - 90); seat = [sx, sy, sz]; }
  return { len, height: top, hood: [hx, hz + 170], seat }; }

// ---- the camera rig ----
export interface CamCar { x: number; y: number; /** the body's foot (m) */ z: number; yaw: number; /** the world velocity */ vx: number; vy: number; speed: number; /** yaw rate (rad/s, left +) */ r: number; pitch: number; roll: number }
export interface CamShot { eye: [number, number, number]; /** heading up the picture (rad), tilt down (deg), vertical field of view (deg), near plane (m) */ ang: number; pitch: number; fov: number; near: number;
  /** the point the shadows gather round */ at: [number, number, number] }
/** the chase rigs: distance behind the car's middle beyond its half length, height over its foot, the base vertical
 *  field of view, how quickly the heading and the height follow (rad/s), where the car sits on the picture */
/** the cockpit's field of view setting (vertical degrees) */
export const CABIN_FOV = { min: 50, max: 75, def: 60 } as const;
/** the driver's head as the cockpit's camera takes it (docs/systems/118 D1): the eye where the rig posed it (mesh mm: x
 *  back from the nose, y left, z up), the head's turn (left +) and nod (forward +), rad */
export interface CabinHead { eye: [number, number, number]; yaw: number; pitch: number }
/** a point of the car's mesh (mm) in the world as the renderer places the body: rolled and pitched about the mesh's
 *  middle at its foot, then set on the car's place and heading (render/live/renderer.ts carParts, gpu.ts placeMesh) */
export function meshToWorld(c: CamCar, len: number, p: readonly [number, number, number]): [number, number, number] {
  const d0 = p[0] - len / 2, cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), cr = Math.cos(c.roll), sr = Math.sin(c.roll);
  const x1 = cp * d0 + sp * p[2], z1 = -sp * d0 + cp * p[2], y2 = cr * p[1] - sr * z1, z2 = sr * p[1] + cr * z1, mx = x1 + len / 2, ch = Math.cos(c.yaw), sh = Math.sin(c.yaw);
  return [c.x + (ch * len / 2 - ch * mx - sh * y2) / 1000, c.y + (sh * len / 2 - sh * mx + ch * y2) / 1000, c.z + z2 / 1000]; }
export const RIGS = { far: { back: 6.2, up: 2.45, fov: 62, wYaw: 3.0, wZ: 3.6, carY: 0.64 }, near: { back: 3.4, up: 1.6, fov: 66, wYaw: 4.2, wZ: 4.8, carY: 0.68 } } as const;
export class DriveCam {
  yaw = 0; yawV = 0; z = 0; zV = 0; dist = 0; distV = 0; fov = 62; fovV = 0; /** a drag's turn round the car (rad), and its tilt (deg) */ orbit = 0; tilt = 0; private held = 0;
  private fresh = true;
  /** put straight behind the car (a new car, a jump back on the track) */
  reset() { this.fresh = true; }
  /** a drag on the picture: turn round the car and tilt; let go, it comes back after a moment */
  drag(dx: number, dy: number) { this.orbit = Math.max(-Math.PI, Math.min(Math.PI, this.orbit - dx * 0.008)); this.tilt = Math.max(-8, Math.min(25, this.tilt + dy * 0.12)); this.held = 1.2; }
  /** the cockpit's vertical field of view (degrees, the setting 운전석 시야: 50..75) */ cabinFov = CABIN_FOV.def;
  step(view: CamView, c: CamCar, E: CarEyes, ground: (x: number, y: number) => number, aspect: number, dt: number, carY?: number, head?: CabinHead): CamShot {
    const L = E.len / 1000, fw = Math.min(1, c.speed / 55);   // fw: how fast, 0 standing .. 1 about 200 km/h
    const heading = c.speed > 2 ? Math.atan2(c.vy, c.vx) : c.yaw;
    if (this.held > 0) this.held -= dt; else { this.orbit *= Math.exp(-2.5 * dt); this.tilt *= Math.exp(-2.5 * dt); }
    if (view === 'cabin' && E.seat) return this.cockpit(c, E, aspect, head);
    if (view === 'hood' || view === 'cabin') {   // on the car: its heading, a little of its pitch and roll's swing
      const [ex, ez] = E.hood, f = (E.len / 2 - ex) / 1000, ch = Math.cos(c.yaw), sh = Math.sin(c.yaw);
      const eye: [number, number, number] = [c.x + ch * f, c.y + sh * f, c.z + ez / 1000]; this.fresh = true;
      const fov = 64 + 6 * fw, tv = fovTan(aspect, fov);
      return { eye, ang: c.yaw + this.orbit, pitch: 4.5 - c.pitch * 180 / Math.PI * 0.5 + this.tilt, fov: Math.atan(tv) * 360 / Math.PI, near: 0.06, at: [c.x + ch * 25, c.y + sh * 25, c.z] }; }
    const R = view === 'near' ? RIGS.near : RIGS.far;
    // the heading: where the car goes, a little ahead into a turn (by the yaw rate), followed on a spring
    const lead = Math.max(-0.32, Math.min(0.32, c.r * 0.22)), want = heading + lead;
    const dist = L / 2 + R.back + 1.6 * fw, zWant = c.z + R.up + 0.35 * fw, fov = R.fov + 7 * fw;
    if (this.fresh) { this.yaw = want; this.yawV = 0; this.z = zWant; this.zV = 0; this.dist = dist; this.distV = 0; this.fov = fov; this.fovV = 0; this.fresh = false; }
    [this.yaw, this.yawV] = angSpring(this.yaw, this.yawV, want, R.wYaw, dt);
    [this.dist, this.distV] = spring(this.dist, this.distV, dist, 2.2, dt);
    [this.fov, this.fovV] = spring(this.fov, this.fovV, fov, 1.8, dt);
    const a = this.yaw + this.orbit, ex = c.x - Math.cos(a) * this.dist, ey = c.y - Math.sin(a) * this.dist;
    // the height on its own spring over the car's, never nearer the ground there than 70 cm (a banking's slope behind the car)
    [this.z, this.zV] = spring(this.z, this.zV, zWant, R.wZ, dt); const gz = ground(ex, ey) + 0.7; if (this.z < gz) { this.z = gz; this.zV = Math.max(0, this.zV); }
    const tv = fovTan(aspect, this.fov), drop = this.z - (c.z + 0.55);
    const pitch = aimPitch(drop, this.dist, tv, carY ?? R.carY) + this.tilt;
    return { eye: [ex, ey, this.z], ang: a, pitch, fov: Math.atan(tv) * 360 / Math.PI, near: 0.6, at: [c.x + Math.cos(a) * 30, c.y + Math.sin(a) * 30, c.z] }; }
  /** the driver's own eye (docs/systems/118 D1): in the head the rig posed (else the seat's), carried with the body's roll
   *  and pitch, looking where the head turns; the field of view the setting's; the near plane 5 cm so the dash is whole */
  private cockpit(c: CamCar, E: CarEyes, aspect: number, head?: CabinHead): CamShot { this.fresh = true;
    const p = head?.eye ?? E.seat!, eye = meshToWorld(c, E.len, p), ang = c.yaw + this.orbit + (head?.yaw ?? 0), tv = fovTan(aspect, Math.max(CABIN_FOV.min, Math.min(CABIN_FOV.max, this.cabinFov)));
    const pitch = 6 - c.pitch * 180 / Math.PI * 0.85 + (head?.pitch ?? 0) * 180 / Math.PI + this.tilt;   /* the head keeps a little of the horizon against the body's pitch */
    return { eye, ang, pitch, fov: Math.atan(tv) * 360 / Math.PI, near: 0.05, at: [c.x + Math.cos(c.yaw) * 25, c.y + Math.sin(c.yaw) * 25, c.z] }; }
}
