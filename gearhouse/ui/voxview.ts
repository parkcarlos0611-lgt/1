// The track game's render test bench as a page (review 73): any of the sheet cars as a solid, drawn whole (A) or as
// stacked slices (B, fine or coarse), turned by hand, tilted, zoomed. The page around it is ui/voxview.page.html.
import { solidOf, surfaceOf, drawSurface, slicesOf, drawStack, type Solid, type Surface, type Pic } from '../render/car/voxel';
import type { CarModel } from '../render/car/model';
import ssj from '../data/cars/sheet/dueSSJ35.json';
import bmw from '../data/cars/sheet/bmw315.json';
import fn from '../data/cars/sheet/fnTT33.json';
import dueA from '../data/cars/sheet/dueA21.json';
import buick from '../data/cars/sheet/buick28.json';
import chev from '../data/cars/sheet/chevAB28.json';
import dodge from '../data/cars/sheet/dodgeV28.json';
import fordT from '../data/cars/sheet/fordT23.json';
import plym from '../data/cars/sheet/plymU29.json';
import pontiac from '../data/cars/sheet/pontiac29.json';
import willys from '../data/cars/sheet/willys27.json';

const CARS: [string, unknown][] = [['1935 그랜드 로드스터', ssj], ['1935 로드스터', bmw], ['1933 경스포츠', fn], ['1921 그랜드 쿠페', dueA], ['1928 4도어', buick],
  ['1928 경세단', chev], ['1928 6기통', dodge], ['1923 소형', fordT], ['1929 경4기통', plym], ['1929 6기통', pontiac], ['1927 슬리브', willys]];
const BASE_MM = 16.7;   // the track game's scale: a 5 m car about 300 px long
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const cv = $<HTMLCanvasElement>('view'), ctx = cv.getContext('2d')!, stat = $('stat');
const st = { car: 0, mode: 'A' as 'A' | 'B' | 'C' | 'AB', yaw: 30, pitch: 50, zoom: 1, cell: 15, spin: false, px: 2 };
const W = 400, H = 260;
let solid: Solid | null = null, surf: Surface | null = null, slices: Record<string, { z: number; pic: Pic }[]> = {}, key = '', dirty = true, building = false;

function sel(): string { return `${st.car}|${st.cell}`; }
function ensure(): boolean {
  if (key === sel() && solid) return true; if (building) return false; building = true; stat.textContent = '입체를 만드는 중…';
  setTimeout(() => { const t = performance.now(); const m = CARS[st.car]![1] as CarModel; solid = solidOf(m, st.cell); surf = surfaceOf(solid); slices = {}; key = sel();
    stat.dataset.build = `입체 ${Math.round(performance.now() - t)} ms, 겉면 칸 ${surf.n.toLocaleString()}개`; building = false; dirty = true; }, 30);
  return false; }
function slicesFor(every: number, mm: number) { const k = `${every}|${mm}`; return (slices[k] ??= slicesOf(solid!, mm, every)); }
function put(p: Pic, x: number) { const img = new ImageData(new Uint8ClampedArray(p.rgba), p.w, p.h); ctx.putImageData(img, x, 0); }

function frame() {
  if (st.spin) { st.yaw = (st.yaw + 0.6) % 360; ($<HTMLInputElement>('yaw')).value = String(Math.round(st.yaw)); dirty = true; }
  if (dirty && ensure()) { dirty = false; const mm = BASE_MM / st.zoom, two = st.mode === 'AB', w = two ? W / 2 : W, t = performance.now();
    cv.width = W; cv.height = H; ctx.clearRect(0, 0, W, H);
    const draw = (m: 'A' | 'B' | 'C', x: number) => { if (m === 'A') put(drawSurface(surf!, st.yaw, st.pitch, mm, w, H), x); else put(drawStack(slicesFor(m === 'B' ? 1 : 4, mm), solid!, st.yaw, st.pitch, mm, w, H), x); };
    if (two) { draw('A', 0); draw('B', W / 2); } else draw(st.mode as 'A' | 'B' | 'C', 0);
    if (two) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(W / 2, 0, 1, H); }
    cv.style.width = `${W * st.px}px`; cv.style.height = `${H * st.px}px`;
    stat.textContent = `${stat.dataset.build ?? ''} · 한 장 ${Math.round(performance.now() - t)} ms · ${(mm).toFixed(1)} mm/칸`; }
  requestAnimationFrame(frame); }

// controls
const bind = (id: string, f: (v: string) => void) => $(id).addEventListener('input', e => { f((e.target as HTMLInputElement).value); dirty = true; });
const carSel = $<HTMLSelectElement>('car'); CARS.forEach(([n], i) => carSel.add(new Option(n, String(i))));
bind('car', v => { st.car = +v; }); bind('yaw', v => { st.yaw = +v; }); bind('pitch', v => { st.pitch = +v; $('pitchv').textContent = `${v}°`; });
bind('zoom', v => { st.zoom = +v; $('zoomv').textContent = `${v}배`; }); bind('px', v => { st.px = +v; $('pxv').textContent = `${v}배`; });
bind('cell', v => { st.cell = +v; });
document.querySelectorAll<HTMLInputElement>('input[name=mode]').forEach(r => r.addEventListener('change', () => { st.mode = r.value as typeof st.mode; dirty = true; }));
$<HTMLInputElement>('spin').addEventListener('change', e => { st.spin = (e.target as HTMLInputElement).checked; });
// turn by dragging, zoom with the wheel or a pinch-free +/- on the slider
let drag: number | null = null;
cv.addEventListener('pointerdown', e => { drag = e.clientX; cv.setPointerCapture(e.pointerId); st.spin = false; $<HTMLInputElement>('spin').checked = false; });
cv.addEventListener('pointermove', e => { if (drag === null) return; st.yaw = ((st.yaw + (e.clientX - drag) * 0.6) % 360 + 360) % 360; drag = e.clientX; $<HTMLInputElement>('yaw').value = String(Math.round(st.yaw)); dirty = true; });
cv.addEventListener('pointerup', () => { drag = null; });
cv.addEventListener('wheel', e => { e.preventDefault(); st.zoom = Math.max(1, Math.min(4, Math.round((st.zoom + (e.deltaY < 0 ? 0.5 : -0.5)) * 2) / 2)); $<HTMLInputElement>('zoom').value = String(st.zoom); $('zoomv').textContent = `${st.zoom}배`; dirty = true; }, { passive: false });
requestAnimationFrame(frame);
