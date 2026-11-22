// The cars' pictures for the track (review 85, step 3): each car drawn from its 3D mesh at the track's scale, from
// 64 headings and in roll steps (the banking tips a car up to 30 degrees), baked once and kept. The headings the car
// shows first come first; the rest are baked a few a frame while it drives, the nearest baked one standing in till then.
import { drawMesh, type Mesh } from '../render/car/mesh';
import type { Wear } from '../render/car/wear';

export const HEADINGS = 64, ROLL_STEP = 0.1, ROLL_MAX = 0.6;
export interface Frame { canvas: HTMLCanvasElement; ax: number; ay: number }   // ax, ay: where the car's centre ground point is
export class CarSprites {
  private frames = new Map<string, Frame>(); private queue: [number, number][] = [];
  constructor(readonly mesh: Mesh, readonly mm: number, readonly opts: { outline: number; glass: number; wear?: Wear }) {}
  /** the heading index and roll step for a world heading (rad, 0 east, anticlockwise) and a roll (rad, left side up) */
  static key(heading: number, roll: number): [number, number] { const deg = (180 + heading * 180 / Math.PI) % 360, h = ((Math.round(deg / (360 / HEADINGS)) % HEADINGS) + HEADINGS) % HEADINGS;
    const r = Math.max(-ROLL_MAX, Math.min(ROLL_MAX, Math.round(roll / ROLL_STEP) * ROLL_STEP)); return [h, Math.round(r / ROLL_STEP)]; }
  bake(h: number, r: number): Frame { const id = `${h}:${r}`, have = this.frames.get(id); if (have) return have;
    const L = this.mesh.length, w = Math.ceil(L * 1.3 / this.mm), hh = Math.ceil(L * 1.15 / this.mm), cy = 0.6;
    const p = drawMesh(this.mesh, h * 360 / HEADINGS, 40, this.mm, w, hh, { outline: this.opts.outline, glass: this.opts.glass, wear: this.opts.wear, roll: r * ROLL_STEP, cy });
    const c = document.createElement('canvas'); c.width = w; c.height = hh; c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(p.rgba), w, hh), 0, 0);
    const f = { canvas: c, ax: w / 2, ay: hh * cy }; this.frames.set(id, f); return f; }
  has(h: number, r: number): boolean { return this.frames.has(`${h}:${r}`); }
  /** the frame for this heading and roll, or the nearest roll already baked (the wanted one is queued) */
  get(heading: number, roll: number): Frame { const [h, r] = CarSprites.key(heading, roll); if (this.has(h, r)) return this.bake(h, r);
    if (!this.queue.some(([a, b]) => a === h && b === r)) this.queue.unshift([h, r]);
    for (let d = 1; d <= 12; d++) for (const rr of [r - d, r + d]) if (this.has(h, rr)) return this.bake(h, rr);
    return this.bake(h, r); }
  /** bake waiting frames for up to `ms` milliseconds */
  work(ms: number): void { const t0 = performance.now(); while (this.queue.length && performance.now() - t0 < ms) { const [h, r] = this.queue.shift()!; this.bake(h, r); } }
  /** queue every heading at the level and the given rolls */
  prepare(rolls: number[]): void { for (const r of rolls) for (let h = 0; h < HEADINGS; h++) if (!this.has(h, r)) this.queue.push([h, r]); }
  get pending(): number { return this.queue.length; }
  get count(): number { return this.frames.size; }
}
