// The cars' pictures for the track (reviews 85-86): each car drawn from its 3D mesh at the track's scale and the
// camera's height, from 64 headings, in roll steps (the banking tips a car up to 30 degrees), with the front wheels at
// five steering steps and the wheels at three turns of their spokes, or blurred at speed. Baked as they are needed
// (the nearest baked picture stands in meanwhile), a few a frame, and the least recently shown let go past a limit.
import { drawMesh, type Mesh } from '../render/car/mesh';
import type { Wear } from '../render/car/wear';

export const HEADINGS = 64, ROLL_STEP = 0.1, ROLL_MAX = 0.6, STEER_STEPS = 2, SPINS = 3, BLUR = 3;
export interface Frame { canvas: HTMLCanvasElement; ax: number; ay: number; glints?: [number, number][] }   // ax, ay: where the car's centre ground point is
type Key = [h: number, r: number, st: number, sp: number];
export class CarSprites {
  private frames = new Map<string, Frame>(); private queue: Key[] = [];
  /** pitch: the camera's height (deg); lock: the front wheels' full lock (rad), the outer steering step */
  constructor(readonly mesh: Mesh, readonly mm: number, readonly pitch: number, readonly lock: number, readonly opts: { outline: number; glass: number; wear?: Wear }, readonly limit = 2400) {}   // limit: pictures kept (a phone keeps fewer)
  /** heading index, roll step, steering step, spin state, for a heading on screen (rad, 0 to the right, anticlockwise), a roll (rad, left side up),
   *  the front wheels' angle (rad, left +), and the wheels' turn (rad) and speed (m/s) */
  key(heading: number, roll: number, steer: number, wheelTurn: number, speed: number): Key { const deg = (180 + heading * 180 / Math.PI) % 360, h = ((Math.round(deg / (360 / HEADINGS)) % HEADINGS) + HEADINGS) % HEADINGS;
    const r = Math.round(Math.max(-ROLL_MAX, Math.min(ROLL_MAX, roll)) / ROLL_STEP), st = Math.max(-STEER_STEPS, Math.min(STEER_STEPS, Math.round(steer / this.lock * STEER_STEPS)));
    const sp = speed > 8 ? BLUR : ((Math.floor(wheelTurn / (Math.PI * 2 / 36)) % SPINS) + SPINS) % SPINS; return [h, r, st, sp]; }
  private id(k: Key): string { return k.join(':'); }
  private draw([h, r, st, sp]: Key): Frame { const L = this.mesh.length, w = Math.ceil(L * 1.3 / this.mm), hh = Math.ceil(L * 1.15 / this.mm), cy = 0.6;
    const one = (turn: number) => { const p = drawMesh(this.mesh, h * 360 / HEADINGS, this.pitch, this.mm, w, hh, { outline: this.opts.outline, glass: this.opts.glass, wear: this.opts.wear, roll: r * ROLL_STEP, steer: st / STEER_STEPS * this.lock, spin: turn, cy }); gl = p.glints ?? []; return p.rgba; };
    let gl: number[] = []; let rgba: Uint8ClampedArray; if (sp === BLUR) { const a = [0, 1, 2].map(k => one(k * Math.PI * 2 / 36 / SPINS * 4)); rgba = new Uint8ClampedArray(a[0]!.length); for (let i = 0; i < rgba.length; i++) rgba[i] = (a[0]![i]! + a[1]![i]! + a[2]![i]!) / 3; }   // the spokes smeared: three turns laid over each other
    else rgba = one(sp * Math.PI * 2 / 36);
    const c = document.createElement('canvas'); c.width = w; c.height = hh; c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(rgba), w, hh), 0, 0);
    return { canvas: c, ax: w / 2, ay: hh * cy, glints: gl.map(i => [i % w, Math.floor(i / w)] as [number, number]) }; }
  private take(k: Key): Frame | undefined { const id = this.id(k), f = this.frames.get(id); if (f) { this.frames.delete(id); this.frames.set(id, f); } return f; }   // shown: to the back of the line
  bake(k: Key): Frame { const have = this.take(k); if (have) return have; const f = this.draw(k); this.frames.set(this.id(k), f);
    while (this.frames.size > this.limit) this.frames.delete(this.frames.keys().next().value!); return f; }
  /** the frame for this pose, or the nearest one baked (the wanted one is queued) */
  get(k: Key): Frame { const have = this.take(k); if (have) return have; const id = this.id(k); if (!this.queue.some(q => this.id(q) === id)) this.queue.unshift(k);
    const [h, r, st, sp] = k, tries: Key[] = [[h, r, st, sp === BLUR ? 0 : BLUR], [h, r, st, 0], [h, r, 0, sp], [h, r, 0, 0], [h, r, 0, BLUR]];
    for (let d = 1; d <= 12; d++) for (const rr of [r - d, r + d]) tries.push([h, rr, 0, 0], [h, rr, 0, BLUR]);
    for (const t of tries) { const f = this.take(t); if (f) return f; } return this.bake([h, r, 0, sp]); }
  /** bake waiting frames for up to `ms` milliseconds */
  work(ms: number): void { const t0 = performance.now(); while (this.queue.length && performance.now() - t0 < ms) this.bake(this.queue.shift()!); if (this.queue.length > 400) this.queue.length = 400; }
  /** queue every heading at these rolls, wheels straight, still and blurred */
  prepare(rolls: number[]): void { for (const r of rolls) for (const sp of [0, BLUR]) for (let h = 0; h < HEADINGS; h++) this.queue.push([h, r, 0, sp]); }
  get pending(): number { return this.queue.length; }
  get count(): number { return this.frames.size; }
}

/** a scenery prop's pictures: one per heading (32), baked as first needed and kept */
export class PropSprites {
  private frames = new Map<number, Frame>(); static readonly STEPS = 32;
  private R = 0; private Z = 0;
  constructor(readonly mesh: Mesh, readonly mm: number, readonly pitch: number) { const p = mesh.pos; for (let i = 0; i < p.length; i += 3) { this.R = Math.max(this.R, Math.hypot(p[i]! - mesh.length / 2, p[i + 1]!)); this.Z = Math.max(this.Z, p[i + 2]!); } }
  /** the picture for a heading on screen (rad, 0 to the right, anticlockwise: where the prop's -x points) */
  get(heading: number): Frame { const n = PropSprites.STEPS, h = ((Math.round(((180 + heading * 180 / Math.PI) % 360) / (360 / n)) % n) + n) % n, have = this.frames.get(h); if (have) return have;
    const sp = Math.sin(this.pitch * Math.PI / 180), cp = Math.cos(this.pitch * Math.PI / 180), w = Math.ceil(2 * this.R / this.mm) + 12, hh = Math.ceil((2 * this.R * sp + this.Z * cp) / this.mm) + 12, top = (this.R * sp + this.Z * cp) / this.mm + 6;
    const p = drawMesh(this.mesh, h * 360 / n, this.pitch, this.mm, w, hh, { outline: 2, glass: 0.85, cy: top / hh });
    const c = document.createElement('canvas'); c.width = w; c.height = hh; c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(p.rgba), w, hh), 0, 0);
    const f = { canvas: c, ax: w / 2, ay: top }; this.frames.set(h, f); return f; }
}
