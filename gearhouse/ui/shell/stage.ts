// What the game page's screens share (docs/systems/101 3-2, 하나의 앱, 하나의 렌더러): the one WebGL canvas and its
// renderer, handed from screen to screen (each screen's set pieces kept aside while another shows, render/live
// renderer.ts takeScene); the builder's and the drive's own pages (their markup and their styles) mounted as screens;
// and the backdrop: the studio floor with a car turning on the turntable, behind the title and the menus.
import type { LiveRenderer, LiveScene } from '../../render/live/renderer';
import { studioFloor } from '../../render/live/studio';
import { designMesh } from '../../render/car/design';
import type { Mesh } from '../../render/car/mesh';
import type { Design } from '../../core/design';

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

/** the backdrop: the studio floor, a car on the turntable turning slowly (still when the screen is to be calm), drawn
 *  while a menu screen shows; the car framed right of the menu on a wide window, above it on a narrow one */
export class Backdrop {
  private M: Mesh | null = null; private key = ''; private g: ReturnType<LiveRenderer['car']> | null = null; private yaw = 2.3; private last = 0; private raf = 0; private drawn = false;
  calm = false; frames = 0; private at = 0; private cost = 0; private drewLast = false;
  constructor(private stage: Stage) {}
  /** the car on the turntable: a design (its body built only when it changed) */
  setDesign(d: Design) { const k = JSON.stringify([d.body, d.kit.tyres, d.kit.rim]); if (k === this.key) return; this.key = k; this.M = designMesh(d, 0, 0); this.g = null; this.drawn = false; }
  start() { this.stage.use('backdrop', true, L => { L.setGround(studioFloor()); L.setTrack(1, 30, 12, 0); }); if (this.raf) return; this.last = performance.now(); this.drawn = false; this.raf = requestAnimationFrame(t => this.frame(t)); }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }
  /** drawn again on the next frame (the window resized, the sky arrived) */
  redraw() { this.drawn = false; }
  private frame(now: number) { const el = Math.min(0.1, (now - this.last) / 1000); this.last = now; this.raf = requestAnimationFrame(t => this.frame(t));
    const L = this.stage.L, cv = this.stage.canvas; if (!L || !this.M || (this.calm && this.drawn)) return; if (!this.calm) this.yaw += el * 0.22;
    // a slow GPU (software GL) draws the turning car at a lower rate, the picture held between: what a frame cost is
    // seen in when the next one comes (the GPU's work done by then), and a frame drawn only after three times that
    // past the display's own frame (a fast GPU: every frame)
    if (this.drewLast) { const gap = now - this.at; this.cost = this.frames > 1 ? (this.cost ? this.cost * 0.6 + gap * 0.4 : gap) : Math.min(gap, 1500); this.drewLast = false; }
    if (this.drawn && now - this.at < Math.max(0, this.cost - 20) * 3) return;
    // at most about two million pixels (a large window at a high density is drawn a little softer)
    const k0 = Math.min(1.5, devicePixelRatio || 1), k = Math.min(k0, Math.sqrt(2.1e6 / Math.max(1, cv.clientWidth * cv.clientHeight))), W = Math.max(2, Math.round(cv.clientWidth * k)), H = Math.max(2, Math.round(cv.clientHeight * k)); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    this.g ??= L.car(this.M); const wide = innerWidth > 760, len = this.M.length, free = (wide ? W * 0.55 : W) , band = wide ? H : H * 0.45;
    const mm = Math.max(len * 1.25 / free, len * 0.6 / band), shift = wide ? W * 0.2 : 0, ang = 0.25, ox = -shift * mm / 1000;
    L.render({ x: Math.sin(ang) * ox, y: -Math.cos(ang) * ox, z: 0.55, ang, pitch: 14, mm, W, H, cy: wide ? 0.6 : 0.36 },
      [{ g: this.g, x: 0, y: 0, z: -0.015, yaw: this.yaw, roll: 0, pitch: 0, steerL: 0.14, steerR: 0.12, spin: 0, player: true, lamps: 0 }], [], [],
      { look: 2, glass: 0.8, rays: true, bloomK: 1, reflK: 1.3, dof: 0, outW: 0.5, outK: 0.6 });
    this.at = now; this.drewLast = true; this.drawn = true; this.frames++; }
}
