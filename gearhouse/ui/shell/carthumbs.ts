// The garage cards' pictures (docs/systems/110 §2-5, continued): each design's own car (its body, its parts, its
// paint) drawn by the game's renderer in the drift look, every card from one angle (the front three quarters from the
// left, the front wheels turned a little as on the title), instead of the drawn side view. Made lazily, one car a
// frame and only for the cards on screen, in the shared canvas just before the backdrop's own frame is drawn over it
// (the backdrop's `pre`), the plain background keyed out as the builder's part pictures are (ui/builder_thumbs.ts),
// kept per design (its signature) for the page's life. Without WebGL, or if a render fails, the cards keep their drawn
// pictures (ui/shell/ui.ts carPic).
import type { Design } from '../../core/design';
import { designSig } from '../../core/designstore';
import { designMesh } from '../../render/car/design';
import type { Mesh } from '../../render/car/mesh';
import type { LiveRenderer } from '../../render/live/renderer';
import { freeGpu } from '../../render/live/gpu';
import { STYLE, screenPx, lineWeight } from '../../render/live/style';
import { fit, keyDown, meshBox, sunFor } from '../builder_thumbs';

/** the one angle of every card: looking toward the rear right from the front left (as LiveView's ang), a little above */
export const CARD_CAM = { ang: 1.25 * Math.PI, pitch: 11 };
/** the front wheels turned a little to the left (rad): the near tyre's side and its wheel's face show */
export const CARD_STEER = { L: 0.3, R: 0.25 };
/** the picture's size on the card (CSS px; the card's picture plate is 5:2) */
export const CARD_W = 340, CARD_H = 136;

const PICS = new Map<string, string>();
export interface CarThumbs { /** a card's picture plate to fill with the design's render */ want(pic: HTMLElement, d: Design): void;
  /** forget the plates (the screen was left) */ clear(): void;
  /** make a picture due for a plate on screen; true if the canvas was drawn on */ pump(L: LiveRenderer, cv: HTMLCanvasElement): boolean }
export function carThumbs(): CarThumbs {
  const plates = new Map<HTMLElement, { d: Design; key: string; done: boolean }>(); let off = false, idle = 0, built: { key: string; M: Mesh } | null = null;
  const dpr = () => Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
  const show = (pic: HTMLElement, url: string) => { let img = pic.querySelector('img.gh-thumb') as HTMLImageElement | null;
    if (!img) { img = new Image(); img.className = 'gh-thumb'; img.alt = ''; img.decoding = 'async'; pic.append(img); } img.src = url; pic.classList.add('gh-has-thumb'); };
  const onScreen = (e: HTMLElement) => { if (!e.isConnected) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.bottom > -40 && r.top < innerHeight + 40; };
  function shoot(L: LiveRenderer, cv: HTMLCanvasElement, M: Mesh): string { const r = dpr(); let W = Math.round(CARD_W * r), H = Math.round(CARD_H * r), ss = 2; if (cv.width < W * ss || cv.height < H * ss) ss = 1;
    const k = Math.min(1, cv.width / (W * ss), cv.height / (H * ss)); W = Math.max(8, Math.floor(W * k)); H = Math.max(4, Math.floor(H * k));
    const f = fit(meshBox(M), M.length, CARD_CAM, W * ss, H * ss, 1), gl = L.gl, g = L.car(M), scene = L.takeScene();
    try { L.render({ x: f.x, y: f.y, z: f.z, ang: CARD_CAM.ang, pitch: CARD_CAM.pitch, mm: f.mm, W: W * ss, H: H * ss, cy: 0.5 },
        [{ g, x: 0, y: 0, z: 0, yaw: 0, roll: 0, pitch: 0, steerL: CARD_STEER.L, steerR: CARD_STEER.R, spin: 0, player: false }], [], [],
        { look: 4, glass: 0.8, rays: false, bloomK: 0, dof: 0, sun: sunFor(CARD_CAM), style: { dpr: r * ss } });
      const px = new Uint8Array(W * ss * H * ss * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W * ss, H * ss, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d')!.putImageData(new ImageData(keyDown(px, W * ss, H * ss, ss, screenPx(STYLE.outlinePx * lineWeight.k, H * ss, r * ss)), W, H), 0, 0); return c.toDataURL('image/png'); }
    finally { L.putScene(scene); freeGpu(gl, g); L.forget(M); } }
  return {
    want(pic, d) { const key = `${designSig(d)}|${dpr()}`, u = PICS.get(key); plates.set(pic, { d, key, done: !!u }); if (u) show(pic, u); idle = 0; },
    clear() { plates.clear(); built = null; },
    pump(L, cv) { if (off || !plates.size) return false; if (idle > 0) { idle--; return false; }
      const due = [...plates].filter(([p, j]) => !j.done && onScreen(p)); if (!due.length) { idle = 12; return false; }
      const [pic, job] = due[0]!, have = PICS.get(job.key); if (have) { for (const [p, j] of due) if (j.key === job.key) { show(p, have); j.done = true; } return false; }
      // the car built on one frame (a tenth of a second or two), drawn and read back on the next
      try { if (built?.key !== job.key) { built = { key: job.key, M: designMesh(job.d, 0, 0) }; return false; }
        const u = shoot(L, cv, built.M); built = null; PICS.set(job.key, u); show(pic, u); job.done = true; return true; }
      catch (e) { console.warn('garage pictures: kept the drawn ones', e); off = true; built = null; return false; } } }; }
