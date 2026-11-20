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

/** noise through band filters: the pencil's scratch, the eraser's rub, the wire brush, the spray gun's hiss, masking
 *  tape tearing off the roll. One channel plays at a time, its loudness and pitch set every frame */
const CH: Record<string, [number, number, number]> = { pencil: [4200, 1.2, 0.08], eraser: [900, 0.8, 0.18], scrape: [2600, 1.6, 0.22], spray: [6500, 0.5, 0.09], tape: [1400, 3, 0.2], brush: [700, 1, 0.1] };
export type SoundKind = '' | keyof typeof CH;
export class Sound {
  on = true; private ac: AudioContext | null = null; private noise: AudioBuffer | null = null; private ch: Record<string, { g: GainNode; f: BiquadFilterNode }> = {}; private t = 0;
  private amb: Record<string, { g: GainNode; f?: BiquadFilterNode; o?: OscillatorNode }> = {};
  start() { if (this.ac) return; try { const ac = new AudioContext(), len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = (b: BiquadFilterType, f: number, q: number) => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = Math.random(); const bp = ac.createBiquadFilter(); bp.type = b; bp.frequency.value = f; bp.Q.value = q; const g = ac.createGain(); g.gain.value = 0; s.connect(bp).connect(g).connect(ac.destination); s.start(0, Math.random() * 1.5); return { g, f: bp }; };
    for (const [k, [f, q]] of Object.entries(CH)) this.ch[k] = src('bandpass', f, q);
    this.amb.rain = src('lowpass', 1400, 0.4); this.amb.wind = src('lowpass', 380, 0.7);
    { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 38; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; const g = ac.createGain(); g.gain.value = 0; o.connect(lp).connect(g).connect(ac.destination); o.start(); this.amb.engine = { g, f: lp, o }; }
    this.ac = ac; this.noise = buf; } catch { this.ac = null; } }
  /** which tool noise plays this frame ('' for none); amount 0..1 scales it, pitch multiplies its band */
  play(kind: SoundKind, amount = 1, pitch = 1) { const ac = this.ac; if (!ac) return; this.t += 1; const now = ac.currentTime, j = 0.5 + 0.5 * Math.sin(this.t * 0.9) * Math.sin(this.t * 0.37);
    for (const [k, c] of Object.entries(this.ch)) { const on = this.on && k === kind, base = CH[k]!; c.g.gain.setTargetAtTime(on ? base[2] * Math.min(1, amount) * (0.6 + 0.4 * j) : 0, now, 0.02); if (on) c.f.frequency.setTargetAtTime(base[0] * pitch, now, 0.03); } }
  /** the sounds of the place, each on its own: rain, wind, a car's engine (amount 0..1, pitch for the engine's revs) */
  ambient(kind: 'rain' | 'wind' | 'engine', amount: number, pitch = 1) { const ac = this.ac, c = this.amb[kind]; if (!ac || !c) return; const now = ac.currentTime;
    c.g.gain.setTargetAtTime(this.on ? amount * (kind === 'engine' ? 0.12 : kind === 'rain' ? 0.25 : 0.15) : 0, now, 0.15); if (c.o) c.o.frequency.setTargetAtTime(32 * pitch, now, 0.2); }
  /** a short sound made on the spot: a spray can shaken (the ball rattling), a knock on the door */
  once(kind: 'shake' | 'knock') { const ac = this.ac, nb = this.noise; if (!ac || !nb || !this.on) return; const t0 = ac.currentTime;
    const burst = (at: number, f: number, q: number, dur: number, vol: number) => { const s = ac.createBufferSource(); s.buffer = nb; const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const g = ac.createGain();
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, at + dur); s.connect(bp).connect(g).connect(ac.destination); s.start(at, Math.random() * 1.5); s.stop(at + dur + 0.02); };
    const ping = (at: number, f: number, dur: number, vol: number, type: OscillatorType = 'sine') => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; const g = ac.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + 0.003); g.gain.exponentialRampToValueAtTime(0.0008, at + dur); o.connect(g).connect(ac.destination); o.start(at); o.stop(at + dur + 0.02); };
    if (kind === 'shake') for (let k = 0; k < 9; k++) { const at = t0 + k * 0.085 + Math.random() * 0.012; burst(at, 3200 + Math.random() * 900, 4, 0.05, 0.35); ping(at, 2300 + Math.random() * 500, 0.04, 0.05); if (k % 2) burst(at + 0.02, 900, 1.5, 0.06, 0.12); }   // the mixing ball clacking in the can
    else for (const [k, at] of [[0, 0], [1, 0.22], [2, 0.38]] as const) { burst(t0 + at, 180 + k * 10, 1.2, 0.12, 0.9); ping(t0 + at, 95, 0.14, 0.35, 'triangle'); }   // knock knock-knock on a wooden door
  }
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
