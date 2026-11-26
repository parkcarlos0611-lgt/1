// What the game page's screens share (docs/systems/101 3-2, 하나의 앱, 하나의 렌더러): the one WebGL canvas and its
// renderer, handed from screen to screen (each screen's set pieces kept aside while another shows, render/live
// renderer.ts takeScene); the builder's and the drive's own pages (their markup and their styles) mounted as screens;
// and the backdrop: the car standing on a piece of circuit, behind the title and the menus (ui/shell/titleset.ts).
import type { LiveRenderer, LiveScene, LiveProp } from '../../render/live/renderer';
import { titleGround, titleProps, titleView, titleSun, STEER } from './titleset';
import { designMesh } from '../../render/car/design';
import type { Mesh } from '../../render/car/mesh';
import type { Design } from '../../core/design';
import { partStyle } from '../../render/car/powertrain';

/** the renderer's scene owned by one screen at a time: the one leaving keeps its set pieces, the one coming puts its own
 *  back (or sets them up, the first time) */
export class Stage {
  private owner = ''; private kept = new Map<string, LiveScene>();
  constructor(readonly L: LiveRenderer | null, readonly canvas: HTMLCanvasElement) {}
  /** the scene handed to `who`; `setup` the first time; the canvas shown (the builder, the backdrop) or hidden (the
   *  drive draws it into its own picture) */
  use(who: string, show: boolean, setup?: (L: LiveRenderer) => void) { this.canvas.classList.toggle('gh-on', show && !!this.L); const L = this.L; if (!L || who === this.owner) return;
    if (this.owner) this.kept.set(this.owner, L.takeScene()); this.owner = who; const s = this.kept.get(who); if (s) L.putScene(s); else setup?.(L); }
  get now(): string { return this.owner; }
}

/** a page of its own (ui/drive.page.html, ui/builder3d.page.html) as a screen: its markup in a root of its own, its
 *  styles on only while it shows, the classes it puts on the body kept with it while it is away */
export class PageScreen {
  readonly root: HTMLElement; private style: HTMLStyleElement; private classes: string[] = []; private on = false;
  constructor(id: string, html: string, o: { dropCanvas?: boolean } = {}) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    this.style = document.createElement('style'); this.style.dataset.page = id; this.style.textContent = Array.from(doc.querySelectorAll('style')).map(s => s.textContent).join('\n'); this.style.media = 'not all'; document.head.append(this.style);
    for (const x of Array.from(doc.body.querySelectorAll('script, style, meta, title, link'))) x.remove();
    // the shared canvas stands in for the page's own WebGL one (the drive's own canvas is a 2D picture and stays)
    if (o.dropCanvas) doc.body.querySelector('canvas#view')?.remove();
    for (const f of Array.from(doc.body.querySelectorAll<HTMLFormElement>('form[onsubmit]'))) { f.removeAttribute('onsubmit'); f.addEventListener('submit', e => e.preventDefault()); }
    this.root = document.createElement('div'); this.root.className = 'gh-page'; this.root.dataset.page = id; this.root.append(...Array.from(doc.body.childNodes)); }
  /** on the page (the markup must be on it when its script is first mounted, for its sizes) */
  show(into: HTMLElement) { if (this.on) return; this.on = true; into.append(this.root); this.style.media = 'all'; for (const c of this.classes) document.body.classList.add(c); this.classes = []; }
  hide() { if (!this.on) return; this.on = false; this.classes = Array.from(document.body.classList).filter(c => !c.startsWith('gh-')); for (const c of this.classes) document.body.classList.remove(c); this.style.media = 'not all'; this.root.remove(); }
}

/** the renderer's look for a look of the settings (render/live/renderer.ts): drift 4, toon 3, the PBR ones 2 and 1, baked 0 */
export const LOOK_NUM: Record<string, number> = { baked: 0, stepped: 1, pbr: 2, toon: 3, drift: 4 };
/** the backdrop's render options for a look: the drift look's ink outline at its full weight (as the drive draws it),
 *  the others the soft outline they had */
export function backdropOpts(look: number, dpr: number, glassRefl = 1) {
  return look === 4 ? { look, glass: 0.8, glassRefl, rays: false, bloomK: 1, reflK: 1, dof: 0, outW: 1, outK: 1, style: { dpr } }
    : { look, glass: 0.8, glassRefl, rays: look > 0 && look < 3, bloomK: 1, reflK: 1.3, dof: 0, outW: 0.5, outK: 0.6 }; }

/** the backdrop: the stock car standing on a piece of circuit (ui/shell/titleset.ts: asphalt, kerb, tyres, cones,
 *  trees, hills), its front wheels turned, a low perspective camera drifting slowly round it (still when the screen is
 *  to be calm), drawn while a menu screen shows, in the game's look (the drift look by default: the PBR looks are off,
 *  docs/decisions 2026-11-25); the car framed right of the menu on a wide window, between the logo and the menu on a
 *  narrow one. `pre`: work done on the shared canvas before a frame (the garage's rendered cards), the frame then drawn
 *  over it */
export class Backdrop {
  private M: Mesh | null = null; private key = ''; private d: Design | null = null; private g: ReturnType<LiveRenderer['car']> | null = null; private t = 0; private last = 0; private raf = 0; private drawn = false;
  calm = false; frames = 0; private at = 0; private cost = 0; private drewLast = false; private props: LiveProp[] | null = null;
  /** the renderer's look (LOOK_NUM) and the toon glass's reflection, set from the settings */
  look = 4; glassRefl = 1;
  pre: ((L: LiveRenderer, cv: HTMLCanvasElement) => boolean) | null = null;
  constructor(private stage: Stage) {}
  /** the car on the set: a design (its body built only when it or the parts' style changed: the drift look's engines and suspensions) */
  setDesign(d: Design) { const k = JSON.stringify([d.body, d.kit.tyres, d.kit.rim, partStyle()]); this.d = d; if (k === this.key) return; this.key = k; this.M = designMesh(d, 0, 0); this.g = null; this.drawn = false; }
  start() { this.stage.use('backdrop', true, L => { L.setGround(titleGround()); L.setTrack(1, 30, 12, 0); }); if (this.raf) return; this.last = performance.now(); this.drawn = false; this.raf = requestAnimationFrame(t => this.frame(t)); }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }
  /** drawn again on the next frame (the window resized, the sky arrived) */
  redraw() { this.drawn = false; if (this.d) this.setDesign(this.d); }
  private frame(now: number) { const el = Math.min(0.1, (now - this.last) / 1000); this.last = now; this.raf = requestAnimationFrame(t => this.frame(t));
    const L = this.stage.L, cv = this.stage.canvas; if (!L || !this.M) return;
    // at most about two million pixels (a large window at a high density is drawn a little softer)
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches, k0 = Math.min(1.5, devicePixelRatio || 1), k = Math.min(k0, Math.sqrt(2.1e6 / Math.max(1, cv.clientWidth * cv.clientHeight))), W = Math.max(2, Math.round(cv.clientWidth * k)), H = Math.max(2, Math.round(cv.clientHeight * k)); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; this.drawn = false; }
    if (this.pre?.(L, cv)) this.drawn = false;
    if (this.calm && this.drawn) return; if (!this.calm) this.t += el;
    // a slow GPU (software GL) draws at a lower rate, the picture held between: what a frame cost is seen in when the
    // next one comes (the GPU's work done by then), and a frame drawn only after three times that past the display's
    // own frame (a fast GPU: every frame); a phone at most 30 frames a second (the drift is slow)
    if (this.drewLast) { const gap = now - this.at; this.cost = this.frames > 1 ? (this.cost ? this.cost * 0.6 + gap * 0.4 : gap) : Math.min(gap, 1500); this.drewLast = false; }
    if (this.drawn && now - this.at < Math.max(coarse ? 32 : 0, Math.max(0, this.cost - 20) * 3)) return;
    this.g ??= L.car(this.M); this.props ??= titleProps(L);
    const v = titleView(W, H, this.t, this.M.length);
    L.render(v, [{ g: this.g, x: 0, y: 0, z: -0.015, yaw: 0, roll: 0, pitch: 0, steerL: STEER.L, steerR: STEER.R, spin: 0, player: true, lamps: 0 }], this.props, [],
      { ...backdropOpts(this.look, k, this.glassRefl), sun: titleSun(v) });
    this.at = now; this.drewLast = true; this.drawn = true; this.frames++; }
}
