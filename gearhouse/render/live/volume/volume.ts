// The volumetric smoke as the drive uses it (docs/systems/104 B): the grid following the player's car, the puffs taken
// from race/smoke.ts's emit (those inside the grid; the rest stay parcels, the far smoke), the cars as boxes, the ground
// and the fences as a height map, the steps (at most 1/30 s each), the light every second frame, and the drawing the
// renderer asks for at its smoke's place. Idle (nothing stepped, nothing drawn) once no puff has come for a while.
import { GpuVolume } from './simgpu';
import { VolumeDraw, type DrawView } from './draw';
import { TIERS, smokeTier, gpuCaps, type GpuCaps, type SmokeSetting, type SmokeTier } from './caps';
import { VOL_DEFAULT, VOL_KIND, type VolEmit, type VolBox } from '../../../race/volume/sim';
import type { SmokeKind } from '../../../race/smoke';

/** a car as the smoke sees it: where, its heading and velocity (world), its size (m) */
export interface VolCar { x: number; y: number; z: number; yaw: number; vx: number; vy: number; len: number; width: number; height: number }
/** how long after the last puff the grid goes idle (s): by then the smoke has faded (it lingers, docs/systems/103) */
const IDLE = 45;
/** the lower body and the cabin of each car near the grid, as the simulation's boxes (at most four cars) */
export function carBoxes(cars: readonly VolCar[]): VolBox[] { const out: VolBox[] = [];
  for (const c of cars.slice(0, 4)) { const H = c.height - 0.18, base = { yaw: c.yaw, vx: c.vx, vy: c.vy, vz: 0 }, fx = Math.cos(c.yaw), fy = Math.sin(c.yaw);
    out.push({ ...base, x: c.x, y: c.y, z: c.z + 0.18 + H * 0.3, hx: c.len / 2 * 0.95, hy: c.width / 2 * 0.92, hz: H * 0.3 });
    out.push({ ...base, x: c.x - fx * c.len * 0.06, y: c.y - fy * c.len * 0.06, z: c.z + 0.18 + H * 0.8, hx: c.len / 2 * 0.45, hy: c.width / 2 * 0.78, hz: H * 0.2 }); }
  return out; }

export class VolumeSmoke {
  caps: GpuCaps; tier: SmokeTier = 'parcels'; sim: GpuVolume | null = null; private drawer: VolumeDraw | null = null;
  private pending: VolEmit[] = []; private flames: [number, number, number][] = []; private time = 0; private lastPuff = -1e9; private frame = 0; private idle = true; private topAt: string | null = null;
  /** the last frame's times (ms): the simulation's and the drawing's, by the GPU's timer where there is one, else the CPU's wait */
  ms = { step: 0, draw: 0 }; private timer: { ext: unknown; q: ['step' | 'draw', WebGLQuery][] } | null = null;
  /** 연기 크기: the puffs' size against the full (크게) one; 보통 about half */ size = 1;
  constructor(readonly gl: WebGL2RenderingContext) { this.caps = gpuCaps(gl); const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'); if (ext) this.timer = { ext, q: [] }; }
  /** the setting, and (a test) the capabilities taken as the device's: the tier, the grid made or let go */
  set(s: SmokeSetting, caps: GpuCaps = this.caps): SmokeTier { const t = smokeTier(s, caps); if (t === this.tier) return t; this.tier = t; this.sim?.dispose(); this.sim = null; this.idle = true; this.topAt = null;
    if (t === 'low' || t === 'mid' || t === 'high') { const g = TIERS[t]; try { this.sim = new GpuVolume(this.gl, { ...VOL_DEFAULT, nx: g.nx, ny: g.ny, nz: g.nz, h: g.h, iters: g.iters }); this.drawer ??= new VolumeDraw(this.gl); }
      catch (e) { console.warn('volume smoke: falling back to the parcels', e); this.sim = null; this.tier = 'parcels'; } }
    return this.tier; }
  /** drawn this frame (a grid with smoke in it) */
  get active(): boolean { return !!this.sim && !this.idle; }
  private box(): [number, number, number, number, number, number] | null { const S = this.sim; if (!S) return null; const o = S.origin, P = S.P; return [o[0], o[1], o[2], o[0] + P.nx * P.h, o[1] + P.ny * P.h, o[2] + P.nz * P.h]; }
  /** a puff from race/smoke.ts's emit: taken (true) when it is inside the grid (a metre in from its sides), else left a parcel */
  take(kind: SmokeKind, x: number, y: number, z: number, vx: number, vy: number, vz: number, amount = 1): boolean { const b = this.box(); if (!b || this.topAt === null) return false;
    if (x < b[0] + 1 || y < b[1] + 1 || x > b[3] - 1 || y > b[4] - 1 || z < b[2] || z > b[5] - 1) return false; const K = VOL_KIND[kind], a = Math.min(1, amount), r = K.r * this.size * (0.75 + 0.35 * a);
    this.pending.push({ x, y, z: z + r * 0.35, r,   /* a big puff's middle a little up, not half in the ground */ smoke: K.smoke * a, dust: K.dust * a, T: K.T * (0.7 + 0.3 * a), vx, vy, vz }); if (kind === 'exhaust') this.flames.push([x, y, z]);
    this.lastPuff = this.time; if (this.idle) { this.sim!.clear(); this.idle = false; } return true; }
  /** one frame: the grid kept about `at` (the player's car; `floor` the ground there), the steps run with the puffs and the cars */
  step(dt: number, at: readonly [number, number, number], cars: readonly VolCar[], ground: (x: number, y: number) => number): void { const S = this.sim; if (!S) return; this.time += dt; this.frame++;
    const P = S.P, h = P.h, cx = S.origin[0] + P.nx * h / 2, cy = S.origin[1] + P.ny * h / 2, oz = Math.floor((at[2] - 1.2) / h) * h;
    const want = (): [number, number, number] => [Math.round((at[0] - P.nx * h / 2) / h) * h, Math.round((at[1] - P.ny * h / 2) / h) * h, oz];
    if (this.topAt === null || (this.idle && (Math.abs(at[0] - cx) > 2 || Math.abs(at[1] - cy) > 2))) { S.origin = want(); this.newTop(ground); }
    else if (Math.abs(at[0] - cx) > 4 || Math.abs(at[1] - cy) > 4 || Math.abs(oz - S.origin[2]) > 1.4) { const w = want(); S.shift(Math.round((w[0] - S.origin[0]) / h), Math.round((w[1] - S.origin[1]) / h), Math.round((w[2] - S.origin[2]) / h)); this.newTop(ground); }
    if (!this.idle && this.time - this.lastPuff > IDLE) { this.idle = true; S.clear(); }
    if (this.idle) { this.pending.length = 0; this.flames.length = 0; return; }
    const b = this.box()!, near = cars.filter(c => c.x > b[0] - 4 && c.y > b[1] - 4 && c.x < b[3] + 4 && c.y < b[4] + 4), boxes = carBoxes(near);
    const t0 = this.begin(); const n = Math.max(1, Math.ceil(dt * 30 - 1e-6)); for (let k = 0; k < n; k++) S.step(dt / n, k ? [] : this.pending, boxes);
    this.pending.length = 0; if (this.frame % 2 === 0) S.lightPass(sunGrid); this.end('step', t0); }
  /** the solid tops of the grid's columns, from the ground and the fences (when the grid has moved) */
  private newTop(ground: (x: number, y: number) => number): void { const S = this.sim!, P = S.P, top = new Float32Array(P.nx * P.ny);
    for (let j = 0; j < P.ny; j++) for (let i = 0; i < P.nx; i++) top[i + P.nx * j] = ground(S.origin[0] + (i + 0.5) * P.h, S.origin[1] + (j + 0.5) * P.h); S.setTop(top); this.topAt = S.origin.join(','); }
  /** drawn over the scene (the renderer's call, at its smoke's place) */
  draw(v: DrawView): void { const S = this.sim; if (!S || this.idle || !this.drawer) return; const t0 = this.begin();
    this.drawer.draw(v, { A: S.A, AL: S.AL, origin: S.origin, h: S.P.h, scal: S.scal[0]!, vel: S.vel[0]!, light: S.light, steps: TIERS[this.tier as 'mid'].steps, time: this.time, flames: this.flames });
    this.flames.length = 0; this.end('draw', t0); }
  // ---- timing: the GPU's timer where it has one (read a few frames late), else nothing (the frame time's difference is measured outside) ----
  private begin(): WebGLQuery | null { const T = this.timer; if (!T) return null; const gl = this.gl, ext = T.ext as { TIME_ELAPSED_EXT: number }, q = gl.createQuery()!; gl.beginQuery(ext.TIME_ELAPSED_EXT, q); return q; }
  private end(tag: 'step' | 'draw', q: WebGLQuery | null): void { if (!q) return; const gl = this.gl, ext = this.timer!.ext as { TIME_ELAPSED_EXT: number }; gl.endQuery(ext.TIME_ELAPSED_EXT); this.timer!.q.push([tag, q]); }
  /** the queries done since: their times kept (ms); call once a frame */
  poll(): void { const T = this.timer; if (!T) return; const gl = this.gl;
    while (T.q.length) { const [tag, q] = T.q[0]!; if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; this.ms[tag] = (gl.getQueryParameter(q, gl.QUERY_RESULT) as number) / 1e6; gl.deleteQuery(q); T.q.shift(); }
    if (this.idle) { this.ms.step = 0; this.ms.draw = 0; } }
}
/** the sun's way in grid steps (unit length): the renderer's SUN_W */
const sunGrid = (() => { const v = [-0.45, 0.35, 0.82], l = Math.hypot(...v); return v.map(c => c / l); })();
