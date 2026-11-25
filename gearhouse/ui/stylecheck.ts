// The drift-game style check (docs/systems/109, step S1): one car at a time on the studio's turntable in the live
// renderer's look 4 (render/live/renderer.ts): the inverted hull's outline, the drawn lines, the outline pass filling
// the gaps, two bands of light, the atlas. Switches for each layer, the widths, the light's direction, the camera.
// The cars come from render/car/stylecars.ts (one line a car). Built by tools/ref/buildsite.mjs:
//   node tools/ref/buildsite.mjs ui/stylecheck.ts ui/stylecheck.page.html <dir> index.html
// For the page tests: ?car=nsx&still=1&yaw=35 opens a car standing still; window.__style holds the state and the frames drawn.
import { LiveRenderer } from '../render/live/renderer';
import { studioFloor } from '../render/live/studio';
import { loadSky } from '../render/live/groundtex';
import { STYLE_CARS as CARS } from '../render/car/stylecars';
import { STYLE_PARTS } from '../render/car/styleparts';
import { setPartStyle, styleForLook } from '../render/car/powertrain';
import { STYLE, screenPx } from '../render/live/style';
import { hardEdgeLines } from '../render/car/edges';
import type { Mesh } from '../render/car/mesh';
import type { GpuMesh } from '../render/live/gpu';
import { dialState, stepDials, type DialState } from '../render/car/interior/gauges';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T, Q = new URLSearchParams(location.search);
const cv = $<HTMLCanvasElement>('cv');
// the cars, then the machinery on its own (an engine on the stand, in a bay, a suspension corner: ?car=bayI6_drift&pitch=32&tz=0.4)
const STYLE_CARS = [...CARS, ...STYLE_PARTS];
const st = { car: Q.get('car') ?? STYLE_CARS[0]!.id, look: +(Q.get('look') ?? 4), outline: true, lines: true, post: true, atlas: true, outPx: STYLE.outlinePx as number, linePx: STYLE.linePx as number,
  az: +(Q.get('az') ?? 70), el: +(Q.get('el') ?? 40), spin: !Q.has('still'), persp: true, pitch: +(Q.get('pitch') ?? 14), tz: +(Q.get('tz') ?? 0.55), yaw: +(Q.get('yaw') ?? 160), zoom: +(Q.get('zoom') ?? 1) };
let L: LiveRenderer | null = null, g: GpuMesh | null = null, M: Mesh | null = null, dirty = true, frames = 0, lineN = 0, last = performance.now();
try { L = new LiveRenderer(cv); L.setGround(studioFloor()); L.setTrack(1, 30, 12, 0); void loadSky(L).then(() => { dirty = true; }).catch(e => console.warn('sky', e)); }
catch (e) { $('stat').textContent = `이 기기에서 WebGL2를 쓸 수 없다: ${String(e)}`; }
const pick = $<HTMLSelectElement>('car'); for (const c of STYLE_CARS) pick.add(new Option(c.name, c.id)); pick.value = st.car;
// an interior's instruments: ?rpm=5200&kmh=140&boost=0.8 for a still; while the table turns the engine is run up and down
let dials: DialState | null = null, clock = 0; const Qn = (k: string) => Q.has(k) ? +Q.get(k)! : undefined;
function useCar(id: string) { const c = STYLE_CARS.find(k => k.id === id) ?? STYLE_CARS[0]!; st.car = c.id; setPartStyle(styleForLook(st.look)); M = c.mesh(); if (L) g = L.car(M); dials = M.dials ? dialState(M.dials) : null; lineN = M.lines?.length ?? hardEdgeLines(M).length; dirty = true; }
pick.addEventListener('change', () => useCar(pick.value));
// ---- the switches ----
const check = (id: string, key: 'outline' | 'lines' | 'post' | 'atlas' | 'spin' | 'persp') => { const el = $<HTMLInputElement>(id); el.checked = st[key]; el.addEventListener('change', () => { st[key] = el.checked; dirty = true; }); };
check('outline', 'outline'); check('lines', 'lines'); check('post', 'post'); check('atlas', 'atlas'); check('spin', 'spin'); check('persp', 'persp');
const slide = (id: string, key: 'outPx' | 'linePx' | 'az' | 'el' | 'pitch' | 'zoom', show: (v: number) => string) => { const el = $<HTMLInputElement>(id), out = $(`${id}v`); el.value = String(st[key]); out.textContent = show(st[key]);
  el.addEventListener('input', () => { st[key] = +el.value; out.textContent = show(st[key]); dirty = true; }); };
slide('outPx', 'outPx', v => `${v.toFixed(1)} px`); slide('linePx', 'linePx', v => `${v.toFixed(2)} px`); slide('az', 'az', v => `${Math.round(v)}°`); slide('el', 'el', v => `${Math.round(v)}°`);
slide('pitch', 'pitch', v => `${Math.round(v)}°`); slide('zoom', 'zoom', v => `${v.toFixed(2)}배`);
for (const r of Array.from(document.querySelectorAll<HTMLInputElement>('input[name=look]'))) { r.checked = +r.value === st.look; r.addEventListener('change', () => { if (r.checked) { st.look = +r.value; useCar(st.car); } }); }   /* the machinery is rebuilt in the look's own style */
$('reset').addEventListener('click', () => { st.outPx = STYLE.outlinePx; st.linePx = STYLE.linePx; st.az = 70; st.el = 40; for (const id of ['outPx', 'linePx', 'az', 'el'] as const) { const el = $<HTMLInputElement>(id); el.value = String(st[id]); el.dispatchEvent(new Event('input')); } });
// ---- turning the car by hand ----
let drag: number | null = null;
cv.addEventListener('pointerdown', e => { drag = e.clientX; cv.setPointerCapture(e.pointerId); st.spin = false; $<HTMLInputElement>('spin').checked = false; });
cv.addEventListener('pointermove', e => { if (drag === null) return; st.yaw = (st.yaw + (e.clientX - drag) * 0.5) % 360; drag = e.clientX; dirty = true; });
cv.addEventListener('pointerup', () => { drag = null; }); cv.addEventListener('pointercancel', () => { drag = null; });
cv.addEventListener('wheel', e => { e.preventDefault(); st.zoom = Math.max(0.5, Math.min(2.5, st.zoom * (e.deltaY > 0 ? 1.1 : 1 / 1.1))); $<HTMLInputElement>('zoom').value = String(st.zoom); $('zoomv').textContent = `${st.zoom.toFixed(2)}배`; dirty = true; }, { passive: false });
addEventListener('resize', () => { dirty = true; });
function frame(now: number) { const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (st.spin) { st.yaw = (st.yaw + dt * 18) % 360; dirty = true; }
  if (dials && M?.dials) { clock += dt; const run = st.spin ? 0.5 - 0.5 * Math.cos(clock * 0.9) : 0, on = st.spin || Q.has('rpm');
    stepDials(dials, M.dials, { on, rpm: Qn('rpm') ?? 900 + 6200 * run, kmh: Qn('kmh') ?? 300 * run * run, boost: Qn('boost') ?? Math.max(0, run - 0.45) * 1.8, fuel: 0.7 }, st.spin ? dt : 100); }
  if (dirty && L && g && M) { dirty = false; const dpr = Math.min(2, devicePixelRatio || 1), W = Math.max(64, Math.min(2560, Math.round(cv.clientWidth * dpr))), H = Math.max(64, Math.min(1600, Math.round(cv.clientHeight * dpr)));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const len = M.length / 1000, ang = -0.9, pitch = st.pitch, t0 = performance.now(), az = st.az * Math.PI / 180, el = st.el * Math.PI / 180;
    // the camera: a lens of 28 degrees standing off far enough for the car to fill two thirds of the picture's width; or the builder's flat view
    const fov = 28, aspect = W / H, need = len * 1.05 / Math.min(1, aspect * 0.95), dist = need / 2 / Math.tan(fov * Math.PI / 360) / st.zoom, cp = Math.cos(pitch * Math.PI / 180), sp = Math.sin(pitch * Math.PI / 180), tz = st.tz;
    const eye: [number, number, number] = [-Math.cos(ang) * cp * dist, -Math.sin(ang) * cp * dist, tz + sp * dist];
    const mm = Math.max(len * 1000 * 1.3 / W, len * 1000 * 0.62 / H) / st.zoom;
    L.render({ x: 0, y: 0, z: tz, ang, pitch, mm, W, H, cy: 0.55, ...(st.persp ? { eye, fov, near: 0.2 } : {}) },
      [{ g, x: 0, y: 0, z: -0.015, yaw: st.yaw * Math.PI / 180, roll: 0, pitch: 0, steerL: 0.14, steerR: 0.12, spin: 0, player: true, dials: dials?.v }], [], [],
      { look: st.look, glass: +(Q.get('glass') ?? 0.8), rays: st.look !== 4, bloomK: st.look === 2 ? 1 : 0, dof: 0, art: false, outW: st.look === 2 ? 0.5 : 1, outK: st.look === 2 ? 0.6 : 1, sun: [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)],
        style: { outline: st.outline, lines: st.lines, post: st.post, atlas: st.atlas, outPx: st.outPx, linePx: st.linePx, dpr } });
    frames++; $('stat').textContent = `${M.n.toLocaleString()} 삼각형 · 선 ${lineN}개${M.lines?.length ? ' (모델에 표시한 선)' : ' (각진 모서리에서 찾은 선)'} · ${W}×${H} · 외곽선 ${screenPx(st.outPx, H, dpr).toFixed(1)} px, 선 ${screenPx(st.linePx, H, dpr).toFixed(1)} px · ${Math.round(performance.now() - t0)} ms`; }
  requestAnimationFrame(frame); }
useCar(st.car); requestAnimationFrame(frame);
(globalThis as { __style?: unknown }).__style = { st, get frames() { return frames; }, redraw() { dirty = true; }, useCar };   // for the page tests
