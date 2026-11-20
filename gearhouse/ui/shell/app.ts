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

/** noise through band filters: the pencil's scratch and the eraser's rub; more sounds join here */
export class Sound {
  on = true; private ac: AudioContext | null = null; private gains: Record<string, GainNode> = {}; private t = 0;
  start() { if (this.ac) return; try { const ac = new AudioContext(), len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), ch = buf.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const mk = (f: number, q: number) => { const src = ac.createBufferSource(); src.buffer = buf; src.loop = true; const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const g = ac.createGain(); g.gain.value = 0; src.connect(bp).connect(g).connect(ac.destination); src.start(); return g; };
    this.gains = { pencil: mk(4200, 1.2), eraser: mk(900, 0.8) }; this.ac = ac; } catch { this.ac = null; } }
  /** which noise is playing this frame ('' for none) */
  play(kind: '' | 'pencil' | 'eraser') { const ac = this.ac; if (!ac) return; this.t += 1; const now = ac.currentTime, j = 0.5 + 0.5 * Math.sin(this.t * 0.9) * Math.sin(this.t * 0.37);
    this.gains.pencil?.gain.setTargetAtTime(this.on && kind === 'pencil' ? 0.05 + 0.06 * j : 0, now, 0.02); this.gains.eraser?.gain.setTargetAtTime(this.on && kind === 'eraser' ? 0.12 + 0.1 * j : 0, now, 0.03); }
}

export class App {
  S = new Screen(W, H); ui: UI; sound = new Sound(); stack: Scene[] = []; world: World | null = null;
  private msg = ''; private msgAt = -99; private ctx: CanvasRenderingContext2D; private img: ImageData; private last = performance.now();
  constructor(private cv: HTMLCanvasElement, typer: HTMLInputElement | null) {
    this.ui = new UI(this.S, typer); cv.width = W; cv.height = H; this.ctx = cv.getContext('2d')!; this.img = this.ctx.createImageData(W, H);
    const toPx = (ev: PointerEvent) => { const r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) / r.width * W, (ev.clientY - r.top) / r.height * H] as const; };
    cv.addEventListener('pointermove', ev => { const [x, y] = toPx(ev); this.ui.move(x, y); });
    cv.addEventListener('pointerdown', ev => { this.sound.start(); const [x, y] = toPx(ev); this.ui.move(x, y); this.ui.down(x, y); ev.preventDefault(); });
    addEventListener('pointerup', () => this.ui.up());
    addEventListener('keydown', e => { if (this.ui.key(e)) { e.preventDefault(); return; } if (document.activeElement === typer) return; if (this.top?.key?.(this, e)) e.preventDefault(); });
    addEventListener('resize', () => this.fit()); this.fit();
    requestAnimationFrame(t => this.loop(t));
  }
  /** the biggest whole-number scale that fits; below 2 the canvas fills the window (crisp pixels either way) */
  fit() { const vw = innerWidth, vh = innerHeight - (this.cv.dataset.reserve ? +this.cv.dataset.reserve : 0), k = Math.min(vw / W, vh / H), n = Math.floor(k);
    const s = n >= 2 ? n : k; this.cv.style.width = Math.floor(W * s) + 'px'; this.cv.style.height = Math.floor(H * s) + 'px'; }
  get top(): Scene | undefined { return this.stack[this.stack.length - 1]; }
  push(s: Scene) { this.ui.endTyping(true); this.stack.push(s); s.enter?.(this); }
  pop() { this.ui.endTyping(true); const s = this.stack.pop(); s?.leave?.(this); }
  replace(s: Scene) { this.pop(); this.push(s); }
  toast(text: string) { this.msg = text; this.msgAt = performance.now() / 1000; }
  save() { if (this.world) store.set(this.world.sim.snapshot()); }
  private loop(now: number) { const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    this.ui.begin(); this.top?.frame(this, dt); this.ui.toast(this.msg, now / 1000 - this.msgAt); this.ui.end();
    this.cv.style.cursor = this.ui.hover ? 'pointer' : 'default'; this.S.blit(this.ctx, this.img); requestAnimationFrame(t => this.loop(t)); }
}
