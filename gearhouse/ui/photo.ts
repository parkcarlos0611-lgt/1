// A still photo mode for trying high-resolution PBR textures (review 114): the live renderer at the screen's own
// resolution (not the game's small picture enlarged), one car standing on the concrete, an orbit camera, and the
// detail textures switched between the game's 512 px set and 2K or 4K pictures of concrete, leather, cotton and metal
// plate (Poly Haven, CC0), served beside the page.
import { LiveRenderer } from '../render/live/renderer';
import { groundData } from '../render/live/ground';
import { millbrook } from '../race/millbrook';
import { millbrookScenery } from '../race/scenery';
import { MESH_CARS } from '../render/car/meshcars';
import { PROPS } from '../render/props/index';
import texAlb from '../assets/textures/pbr/albedo.jpg';
import texNor from '../assets/textures/pbr/normal.jpg';
import texRgh from '../assets/textures/pbr/rough.jpg';
import texMeta from '../assets/textures/pbr/pbr.json';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const cv = $<HTMLCanvasElement>('cv'), T = millbrook(), SCN = millbrookScenery(T), START = T.spec.landmarks.find(l => l.kind === 'line')!.s, L = new LiveRenderer(cv);
L.setGround(groundData(T, SCN, START)); L.setTrack(T.length, T.spec.width, T.spec.joints, START);
const load = (src: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
void Promise.all([texAlb, texNor, texRgh].map(load)).then(([a, n, r]) => { L.setTextures(a!, n!, r!, (texMeta as { layers: { size_m: number; luma_mean: number; rough_mean: number }[] }).layers); dirty = true; });
// the high-resolution sets: layer (0 concrete, 2 metal, 4 leather, 5 canvas) -> its pictures beside the page
const HI: [number, string][] = [[0, 'concrete'], [2, 'metal'], [4, 'leather'], [5, 'cotton']], hiImgs = new Map<number, { alb: HTMLImageElement; nor: HTMLImageElement }>();
let hiReady: Promise<void> | null = null;
const loadHi = () => hiReady ??= Promise.all(HI.map(async ([k, n]) => { const [alb, nor] = await Promise.all([load(`tex4k/${n}_alb.jpg`), load(`tex4k/${n}_nor.jpg`)]); hiImgs.set(k, { alb, nor }); })).then(() => {});
let res = 4096;
async function setRes(r: number) { res = r; $('stat').textContent = r === 512 ? '512 텍스처' : `${r === 4096 ? '4K' : '2K'} 텍스처 불러오는 중…`;
  if (r === 512) { L.setHiTextures(null); dirty = true; return; } await loadHi(); if (res !== r) return; const t0 = performance.now(); L.setHiTextures(hiImgs, r); dirty = true;
  $('stat').textContent = `${r === 4096 ? '4K' : '2K'} · GPU에 올린 시간 ${Math.round(performance.now() - t0)} ms · 텍스처 메모리 약 ${Math.round(HI.length * 2 * r * r * 4 * 1.33 / 1048576)} MB`; }
$<HTMLSelectElement>('res').addEventListener('change', e => void setRes(+(e.target as HTMLSelectElement).value));
// the car, standing on the home straight
const pick = $<HTMLSelectElement>('car'); for (const c of MESH_CARS) pick.add(new Option(c.name, c.id)); pick.value = 'dueSSJ35';
const s0 = START + 40, at = T.point(s0, 3), h0 = T.at(s0).h; let g = L.car(MESH_CARS.find(c => c.id === pick.value)!.mesh());
pick.addEventListener('change', () => { g = L.car(MESH_CARS.find(c => c.id === pick.value)!.mesh()); dirty = true; });
// the orbit camera
let ang = h0 + 2.4, pitch = 32, zoom = 3, dirty = true, focus = 0;   /* focus: metres from the car's middle toward its tail (the cockpit, the tonneau) or beside it (the road) */
const FOCUS: Record<string, [number, number]> = { car: [0, 0], cockpit: [0.75, 0], road: [0, -2.6] }; let fo: [number, number] = [0, 0]; void focus;
$<HTMLSelectElement>('focus').addEventListener('change', e => { fo = FOCUS[(e.target as HTMLSelectElement).value] ?? [0, 0]; dirty = true; }); const ptrs = new Map<number, { x: number; y: number }>(); let pinch = 0;
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y); } });
cv.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 1) { ang -= dx * 0.006; pitch = Math.max(12, Math.min(85, pitch + dy * 0.2)); dirty = true; }
  else if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()], d = Math.hypot(a!.x - b!.x, a!.y - b!.y); zoom = Math.max(0.6, Math.min(20, zoom * pinch / d)); pinch = d; $<HTMLInputElement>('zoom').value = String(zoom); dirty = true; } });
const up = (e: PointerEvent) => { ptrs.delete(e.pointerId); pinch = 0; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('wheel', e => { e.preventDefault(); zoom = Math.max(0.6, Math.min(20, zoom * (e.deltaY > 0 ? 1.15 : 1 / 1.15))); $<HTMLInputElement>('zoom').value = String(zoom); dirty = true; }, { passive: false });
$<HTMLInputElement>('zoom').addEventListener('input', e => { zoom = +(e.target as HTMLInputElement).value; dirty = true; });
addEventListener('resize', () => { dirty = true; });
function frame() { if (dirty) { dirty = false; const dpr = Math.min(2, devicePixelRatio || 1), W = Math.min(2560, Math.round(cv.clientWidth * dpr)), H = Math.min(1600, Math.round(cv.clientHeight * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const props = SCN.props.filter(q => Math.hypot(q.x - at.x, q.y - at.y) < 120).flatMap(q => { const f = PROPS[q.kind]; return f ? [{ g: L.prop(q.arg ? `${q.kind}@${q.arg}` : q.kind, () => f(q.arg)), x: q.x, y: q.y, z: q.z ?? 0, h: q.heading }] : []; });
    const t0 = performance.now();
    const fx = at.x - Math.cos(h0) * fo[0] + Math.sin(h0) * fo[1], fy = at.y - Math.sin(h0) * fo[0] - Math.cos(h0) * fo[1];
    L.render({ x: fx, y: fy, z: T.height(s0, 3) + (fo[1] ? 0 : 0.6), ang, pitch, mm: zoom, W, H, cy: 0.55 }, [{ g, x: at.x, y: at.y, z: T.height(s0, 3) - 0.02, yaw: h0, roll: 0, pitch: 0, steerL: 0.25, steerR: 0.21, spin: 0, player: true }], props, [], { look: 2, glass: 0.8, rays: true, bloomK: 1, reflK: 1.3, dof: 0, outW: 0.5, outK: 0.6 });
    if (!$('stat').textContent!.includes('불러오는')) $('stat').textContent = `${res === 512 ? '512' : res === 4096 ? '4K' : '2K'} 텍스처 · ${W}×${H} · ${zoom.toFixed(1)} mm/픽셀 · 그리기 ${Math.round(performance.now() - t0)} ms`; }
  requestAnimationFrame(frame); }
requestAnimationFrame(frame); void setRes(4096);
