// The game's shell (roadmap step 2): one canvas, one pixel buffer, one loop, a stack of scenes, the shared sound and the
// save. Every screen is a Scene; moving between screens is push, pop or replace. The running game (core/world) lives
// here so every scene reads and changes the same state.
import { Screen } from '../pixel/screen';
import { UI } from '../pixel/kit';
import type { World } from '../../core/world';

export interface Scene { id: string; frame(app: App, dt: number): void; key?(app: App, e: KeyboardEvent): boolean; enter?(app: App): void; leave?(app: App): void }
export const W = 480, H = 270;
const KEY = 'gearhouse.slice.save';                                         // the same save as the HTML desk, so both read one game
export const store = { get: () => { try { return localStorage.getItem(KEY); } catch { return null; } }, set: (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* private window */ } } };

export { Sound, type SoundKind } from './sound';
import { Sound } from './sound';

export class App {
  S = new Screen(W, H); ui: UI; sound = new Sound(); stack: Scene[] = []; world: World | null = null;
  /** a sharper layer under the pixel screen for close views of print (the directory, letters, catalogues): where a scene
   *  leaves the pixel screen clear (alpha 0) this layer shows through, so the pixel interface stays on top of it.
   *  Draw in game pixels: the context is already scaled by k (device pixels a game pixel). */
  fine(): { ctx: CanvasRenderingContext2D; k: number } { if (!this.fineCv) { const f = document.createElement('canvas'); f.style.position = 'absolute'; f.style.left = '0'; f.style.top = '0'; f.style.zIndex = '0'; f.style.pointerEvents = 'none';
      this.cv.parentElement!.insertBefore(f, this.cv); this.fineCv = f; this.fineCtx = f.getContext('2d')!; this.fit(); }
    this.fineUsed = true; const k = this.fineCv.width / W; this.fineCtx!.setTransform(k, 0, 0, k, 0, 0); return { ctx: this.fineCtx!, k }; }
  private fineCv: HTMLCanvasElement | null = null; private fineCtx: CanvasRenderingContext2D | null = null; private fineUsed = false;
  /** a sharper layer OVER the pixel screen (review 72: a car drawn at its full resolution while it stands at the scene's
   *  size). A scene hands it a job with after(); it runs once the interface is drawn, so it can leave out whatever the
   *  interface or anything nearer has covered since. Draw in game pixels: the context is scaled by k. */
  after(job: (o: { ctx: CanvasRenderingContext2D; k: number }) => void) { this.overJob = job; }
  private overCv: HTMLCanvasElement | null = null; private overCtx: CanvasRenderingContext2D | null = null; private overJob: ((o: { ctx: CanvasRenderingContext2D; k: number }) => void) | null = null;
  /** cars at their full resolution over the scene (review 72, kept as a setting, off by default): 'off' draws them on the
   *  scene's grid as before, 'wheels' only their wheels at full resolution, 'all' the whole car */
  hiCars: 'off' | 'wheels' | 'all' = 'off';
  private over(): { ctx: CanvasRenderingContext2D; k: number } { if (!this.overCv) { const f = document.createElement('canvas'); f.style.position = 'absolute'; f.style.left = '0'; f.style.top = '0'; f.style.zIndex = '2'; f.style.pointerEvents = 'none';
      this.cv.parentElement!.appendChild(f); this.overCv = f; this.overCtx = f.getContext('2d')!; this.fit(); }
    const k = this.overCv.width / W; this.overCtx!.setTransform(1, 0, 0, 1, 0, 0); this.overCtx!.clearRect(0, 0, this.overCv.width, this.overCv.height); this.overCtx!.setTransform(k, 0, 0, k, 0, 0); return { ctx: this.overCtx!, k }; }
  private msg = ''; private msgAt = -99; private ctx: CanvasRenderingContext2D; private img: ImageData; private last = performance.now();
  constructor(private cv: HTMLCanvasElement, typer: HTMLInputElement | null) {
    const holder = document.createElement('div'); holder.style.position = 'relative'; holder.style.lineHeight = '0'; cv.parentNode!.insertBefore(holder, cv); holder.appendChild(cv); cv.style.position = 'relative'; cv.style.zIndex = '1';
    this.ui = new UI(this.S, typer); cv.width = W; cv.height = H; this.ctx = cv.getContext('2d')!; this.img = this.ctx.createImageData(W, H);
    const toPx = (ev: PointerEvent) => { const r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) / r.width * W, (ev.clientY - r.top) / r.height * H] as const; };
    cv.addEventListener('pointermove', ev => { const [x, y] = toPx(ev); this.ui.move(x, y); });
    cv.addEventListener('pointerdown', ev => { this.sound.unlock(); const [x, y] = toPx(ev); this.ui.move(x, y); this.ui.down(x, y); ev.preventDefault(); });
    addEventListener('pointerup', () => { this.sound.unlock(); this.ui.up(); });
    for (const k of ['touchend', 'click', 'keydown'] as const) addEventListener(k, () => this.sound.unlock(), { capture: true });
    addEventListener('keydown', e => { if (this.ui.key(e)) { e.preventDefault(); return; } if (document.activeElement === typer) return; if (this.top?.key?.(this, e)) e.preventDefault(); });
    addEventListener('resize', () => this.fit()); this.fit();
    requestAnimationFrame(t => this.loop(t));
  }
  /** the biggest whole-number scale that fits; below 2 the canvas fills the window (crisp pixels either way) */
  fit() { const vw = innerWidth, vh = innerHeight - (this.cv.dataset.reserve ? +this.cv.dataset.reserve : 0), k = Math.min(vw / W, vh / H), n = Math.floor(k);
    const s = n >= 2 ? n : k; this.cv.style.width = Math.floor(W * s) + 'px'; this.cv.style.height = Math.floor(H * s) + 'px';
    for (const c of [this.overCv]) if (c) { const dpr = Math.min(3, devicePixelRatio || 1), cw = Math.floor(W * s), ch = Math.floor(H * s); c.style.width = cw + 'px'; c.style.height = ch + 'px'; c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
    if (this.fineCv) { const dpr = Math.min(3, devicePixelRatio || 1), cw = Math.floor(W * s), ch = Math.floor(H * s); this.fineCv.style.width = cw + 'px'; this.fineCv.style.height = ch + 'px'; this.fineCv.width = Math.round(cw * dpr); this.fineCv.height = Math.round(ch * dpr); } }
  get top(): Scene | undefined { return this.stack[this.stack.length - 1]; }
  push(s: Scene) { this.ui.endTyping(true); this.stack.push(s); s.enter?.(this); }
  pop() { this.ui.endTyping(true); const s = this.stack.pop(); s?.leave?.(this); }
  replace(s: Scene) { this.pop(); this.push(s); }
  toast(text: string) { this.msg = text; this.msgAt = performance.now() / 1000; }
  save() { if (this.world) store.set(this.world.sim.snapshot()); }
  private loop(now: number) { const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    this.fineUsed = false; this.ui.begin(); this.top?.frame(this, dt); if (!this.fineUsed && this.fineCv && this.fineCv.style.display !== 'none') this.fineCv.style.display = 'none'; else if (this.fineUsed && this.fineCv) this.fineCv.style.display = ''; this.ui.toast(this.msg, now / 1000 - this.msgAt); this.ui.end();
    if (this.overJob) { const job = this.overJob; this.overJob = null; const o = this.over(); this.overCv!.style.display = ''; job(o); } else if (this.overCv && this.overCv.style.display !== 'none') this.overCv.style.display = 'none';
    this.cv.style.cursor = this.ui.hover ? 'pointer' : 'default'; this.S.blit(this.ctx, this.img); requestAnimationFrame(t => this.loop(t)); }
}
