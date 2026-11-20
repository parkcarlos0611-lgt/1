// The side-view drive scene (review 24): one car on its running gear over a course, drawn in pixels without
// turning any picture. Sprung pictures (body, wheel houses, chassis) are drawn from their outlines at each whole
// degree of pitch (pose.ts); tyres, wheels, leaf springs, dampers and shafts are drawn every frame from the physics
// (running.ts). Used by the test-drive page (ui/testtrack.ts) and the frame tool (tools/ref/rigdemo.ts).
import { rasterizeFlat } from './flat';
import { turnDesign } from './pose';
import { Canvas, tyre, leafSpring, damper, shaft, paintSteps, IRON, type RGB } from './running';
import type { CarImage } from './raster';
import type { CarDesign } from './types';
import type { Rig, Ground } from '../../physics/rig';

/** where the running gear sits on a car's design (right-side coordinates, mm from the tail) */
export interface GearLayout {
  /** centre of mass along and above the ground in the design */
  cx: number; cz: number;
  /** per axle, front first: the spring's fixed eye and shackle pin along the car, their height, the damper's frame mount */
  springs: { fixed: number; shackle: number }[]; eyeZ: number; pinZ: number; damperTop: { x: number; z: number }[]; damperDx: number[];
  /** the transfer box's outputs to the front and rear shafts */
  outputs: { x: number; z: number }[];
  /** panels of the body design that belong to the running gear and are drawn with it, not with the body */
  running: string[];
}
export const LR48_LAYOUT: GearLayout = {
  cx: 1740, cz: 780, springs: [{ fixed: 3220, shackle: 2300 }, { fixed: 1160, shackle: 260 }], eyeZ: 365, pinZ: 380,
  damperTop: [{ x: 2610, z: 520 }, { x: 860, z: 520 }], damperDx: [-0.13, 0.13], outputs: [{ x: 1900, z: 380 }, { x: 1650, z: 380 }],
  running: ['houseF', 'houseR', 'horn', 'chassis', 'crossR'],
};
export type SurfaceKind = 'asphalt' | 'gravel' | 'dirt' | 'sand';
const SURF: Record<SurfaceKind, RGB[]> = {
  asphalt: [[108, 108, 112], [84, 84, 90], [66, 66, 72], [52, 52, 58]], gravel: [[176, 160, 132], [150, 134, 108], [126, 112, 90], [96, 86, 70]],
  dirt: [[150, 122, 92], [128, 102, 78], [106, 86, 66], [84, 68, 54]], sand: [[226, 204, 150], [208, 184, 130], [190, 166, 114], [168, 146, 98]] };

interface Dust { x: number; y: number; vx: number; vy: number; life: number; c: RGB }

export class DriveScene {
  W: number; H: number; SC = 100; camX = 0; camY = 0; far: [number, number] = [4, -3];
  private body: CarImage[] = []; private house: CarImage[] = []; private chassis: CarImage[] = []; private PAD = 250; private DEG = 8;
  private paint: RGB[]; private L0: number[] = []; private dust: Dust[] = [];
  xray = false; sky: RGB = [184, 205, 214];
  /** how the body is drawn (review 26): its shape never changes. It takes a new pose (a whole degree, drawn from its
   *  outlines) only when the car stands on a slope for a moment, not for each bounce; the bounce shows as the body
   *  moving up and down whole, and the springs and wheels moving under it. Speeding up and braking move it a little
   *  back and forth. */
  pose = 0; private pitchLP = 0; surge = 0; private surgeV = 0; private lastVx = 0;
  constructor(public rig: Rig, public ground: Ground, public kind: (x: number) => SurfaceKind, private designs: { body: CarDesign; chassis: CarDesign }, public L: GearLayout, W = 560, H = 230) {
    this.W = W; this.H = H; this.paint = paintSteps(designs.body.paint); this.camX = rig.x; this.camY = rig.y - L.cz / 1000;
  }
  /** draw every pose once; `tick` is called between poses so a page can show progress */
  async build(tick?: (done: number, all: number) => Promise<void> | void) {
    const L = this.L, b = this.designs.body, run = new Set(L.running), all = (this.DEG * 2 + 1) * 3; let done = 0;
    const one = async (d: CarDesign, o: { outline?: number }, k: number) => { const im = rasterizeFlat(turnDesign(d, k - this.DEG, L.cx, L.cz, this.PAD), { shadow: false, ...o }); done++; if (tick) await tick(done, all); return im; };
    for (let k = 0; k <= this.DEG * 2; k++) {
      this.body.push(await one({ ...b, wheels: [], panels: b.panels.filter(p => !run.has(p.id)) }, {}, k));
      this.house.push(await one({ ...b, wheels: [], features: [], panels: b.panels.filter(p => p.id.startsWith('house')) }, { outline: 1 }, k));
      this.chassis.push(await one({ ...this.designs.chassis, wheels: [] }, { outline: 1 }, k)); }
  }
  private sx = (wx: number) => this.W / 2 + (wx - this.camX) * this.SC;
  private sy = (wy: number) => this.H - 30 - (wy - this.camY) * this.SC;
  private P = (x: number, y: number, far = false): [number, number] => [this.sx(x) + (far ? this.far[0] : 0), this.sy(y) + (far ? this.far[1] : 0)];
  /** world point of a sprung design point as it is drawn: the pose's angle, the bounce, the surge */
  private sprung(xd: number, zd: number, side: number) { const r = this.rig, s = r.s, a = this.pose * Math.PI / 180, lx = (xd - this.L.cx) / 1000, lz = (zd - this.L.cz) / 1000;
    return { x: r.x + this.surge + lx * Math.cos(a) - lz * Math.sin(a), y: r.y + lx * Math.sin(a) + lz * Math.cos(a) + side * s.halfSpringTrack * r.ph }; }
  /** a sprung picture placed whole: no column is moved on its own, so its shape is exactly as drawn */
  private blit(cv: Canvas, set: CarImage[], side: number, only?: Parameters<Canvas['blit']>[3]) {
    const r = this.rig, img = set[this.pose + this.DEG]!, L = this.L, pad = this.PAD, ox = Math.round((r.x + this.surge - this.camX) * this.SC), oy = Math.round((r.y + side * 0.77 * r.ph - this.camY) * this.SC);
    cv.blit(img, (X, Y) => { const lx = (X + 0.5 - this.W / 2 - ox) / this.SC;
      const wz = (this.H - 30 - (Y + 0.5)) / this.SC - oy / this.SC;                    // height above the centre of mass, in the picture
      return [Math.floor(img.X(lx * 1000 + L.cx + pad)), Math.floor(img.Y(wz * 1000 + L.cz + pad))]; }, [0, 0, this.W, this.H], only);
    return img;
  }
  private corner(cv: Canvas, axle: 0 | 1, side: 1 | -1) {
    const r = this.rig, s = r.s, far = side < 0, L = this.L, hx = r.x + s.axleX[axle], ay = r.ay[axle] + side * s.halfSpringTrack * r.aph[axle], sp = L.springs[axle]!;
    const A = this.sprung(sp.fixed, L.eyeZ, side), Pp = this.sprung(sp.shackle, L.pinZ, side), S = { x: hx, y: ay + 0.075 }, l = 0.1, away = Math.sign(Pp.x - S.x);
    const E = (a: number) => ({ x: Pp.x + away * l * Math.sin(a), y: Pp.y - l * Math.cos(a) }), len = (a: number) => Math.hypot(A.x - S.x, A.y - S.y) + Math.hypot(S.x - E(a).x, S.y - E(a).y);
    const key = axle * 2 + (far ? 1 : 0); this.L0[key] ??= len(0);
    let lo = -0.9, hi = 0.9; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (len(m) < this.L0[key]!) lo = m; else hi = m; }   // the shackle swings so the spring keeps its length
    const e = E((lo + hi) / 2);
    leafSpring(cv, this.P(A.x, A.y, far), this.P(S.x, S.y, far), this.P(e.x, e.y, far), this.P(Pp.x, Pp.y, far));
    const T = this.sprung(L.damperTop[axle]!.x, L.damperTop[axle]!.z, side), B = { x: hx + L.damperDx[axle]!, y: ay - 0.05 };
    damper(cv, this.P(T.x, T.y, far), this.P(B.x, B.y, far));
  }
  private wheel(cv: Canvas, k: number) {
    const r = this.rig, t = r.tyres[k]!, far = t.side < 0;
    tyre(cv, t.p.map(q => this.P(q.x, q.y, far)), this.P(t.hub.x, t.hub.y, far), r.s.wheelR * 0.6 * this.SC, -t.angle, this.paint, { tread: true, capR: 0.07 * this.SC, round: r.s.wheelR * this.SC });
  }
  private groundFill(cv: Canvas, far: boolean) {
    for (let X = 0; X < this.W; X++) { const wx = this.camX + (X + 0.5 - (far ? this.far[0] : 0) - this.W / 2) / this.SC, g = far ? this.ground.far(wx) : this.ground.near(wx), top = Math.round(this.sy(g) + (far ? this.far[1] : 0)), R = SURF[this.kind(wx)];
      for (let Y = Math.max(0, top); Y < this.H; Y++) { const d = Y - top, n = ((Math.floor(wx * 100) * 73856093) ^ (Y * 19349663)) >>> 0;
        cv.px(X, Y, far ? R[d === 0 ? 2 : 3]!.map(v => v * 0.8) as RGB : d === 0 ? R[0]! : d === 1 ? R[1]! : n % 17 === 0 ? R[3]! : n % 29 === 0 ? R[0]! : R[2]!); } }
  }
  /** advance the camera and the dust by dt seconds */
  step(dt: number) {
    const r = this.rig;
    this.camX += (r.x + 0.15 - this.camX) * Math.min(1, dt * 10); this.camY += (r.y - this.L.cz / 1000 - this.camY) * Math.min(1, dt * 5);
    // the pose follows the slope the car stands on, not its bounce: a slow average of its pitch, with a margin so it
    // does not flick between two poses
    this.pitchLP += (r.th - this.pitchLP) * Math.min(1, dt / 0.35); const deg = this.pitchLP * 180 / Math.PI;
    if (Math.abs(deg - this.pose) > 0.75) this.pose = Math.max(-this.DEG, Math.min(this.DEG, Math.round(deg)));
    // a little surge: the body lags when the car speeds up and runs on when it brakes, on a stiff spring
    const ax = (r.vx - this.lastVx) / Math.max(dt, 1e-3), w = Math.PI * 2 * 1.6; this.lastVx = r.vx;
    this.surgeV += (-w * w * this.surge - 2 * 0.55 * w * this.surgeV - ax * 0.012) * dt; this.surge = Math.max(-0.03, Math.min(0.03, this.surge + this.surgeV * dt));
    for (const t of r.tyres) { if (t.side < 0 || t.contact === 0) continue; const so = this.ground.soil?.(t.hub.x); if (!so || so.dust <= 0) continue;
      const n = Math.min(4, (Math.abs(r.vx) * 0.35 + r.slip * 0.8) * so.dust * dt * 30); const c = SURF[this.kind(t.hub.x)][1]!;
      for (let i = 0; i < n; i++) if (Math.random() < n / Math.ceil(n)) this.dust.push({ x: t.hub.x - Math.sign(r.vx || 1) * r.s.wheelR * 0.8, y: this.ground.near(t.hub.x) + 0.05, vx: -Math.sign(r.vx || 1) * (0.5 + Math.random()) + r.vx * 0.2, vy: 0.4 + Math.random() * 0.8, life: 0.6 + Math.random() * 0.7, c }); }
    for (const d of this.dust) { d.x += d.vx * dt; d.y += d.vy * dt; d.vy -= 1.2 * dt; d.vx *= 1 - dt * 1.5; d.life -= dt; }
    this.dust = this.dust.filter(d => d.life > 0).slice(-260);
  }
  draw(cv: Canvas) {
    const r = this.rig, s = r.s; cv.dim = 0; cv.fill(this.sky);
    this.groundFill(cv, true);
    this.blit(cv, this.house, 1);
    cv.dim = 0.42; cv.dimTo = [52, 58, 74]; this.corner(cv, 0, -1); this.corner(cv, 1, -1); this.wheel(cv, 1); this.wheel(cv, 3); cv.dim = 0;
    this.blit(cv, this.chassis, 0);
    for (const axle of [0, 1] as const) { const hx = r.x + s.axleX[axle], ay = r.ay[axle];
      cv.disc(...this.P(hx, ay), 0.13 * this.SC, (dx, dy, q) => (q > 0.85 ? [14, 13, 18] : IRON[(-dx - dy) > 2 ? 3 : 2]!));
      const o = this.L.outputs[axle]!, out = this.sprung(o.x, o.z, 0), pin = { x: hx + (axle === 0 ? -0.17 : 0.17), y: ay - 0.02 };
      shaft(cv, this.P(out.x, out.y), this.P(pin.x, pin.y)); }
    this.corner(cv, 0, 1); this.corner(cv, 1, 1); this.wheel(cv, 0); this.wheel(cv, 2);
    if (!this.xray) this.blit(cv, this.body, 1);
    else { const before = cv.rgba.slice(); let img: CarImage | null = null;
      const edge = (x: number, y: number) => { const im = img!; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= im.w || Y >= im.h || im.rgba[(Y * im.w + X) * 4 + 3]! < 128) return true; } return false; };
      img = this.body[this.pose + this.DEG]!;
      this.blit(cv, this.body, 1, (_r, _g, _b, _a, x, y) => edge(x, y));
      for (let i = 0; i < this.W * this.H; i++) if (cv.rgba[i * 4] !== before[i * 4] || cv.rgba[i * 4 + 1] !== before[i * 4 + 1] || cv.rgba[i * 4 + 2] !== before[i * 4 + 2]) { cv.rgba[i * 4] = 236; cv.rgba[i * 4 + 1] = 240; cv.rgba[i * 4 + 2] = 228; } }
    for (const d of this.dust) { const [x, y] = this.P(d.x, d.y), a = Math.min(1, d.life * 1.6); if (a < 0.35 && ((x + y) & 1)) continue; cv.px(x, y, d.c); if (d.life > 0.8) { cv.px(x + 1, y, d.c); cv.px(x, y - 1, d.c); } }
    this.groundFill(cv, false);
  }
}
