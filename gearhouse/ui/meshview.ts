// The 3D mesh cars as a page (review 80-82): every car as a low-polygon mesh, turned by hand, from any height.
import { drawMesh } from '../render/car/mesh';
import { MESH_CARS } from '../render/car/meshcars';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T, cv = $<HTMLCanvasElement>('view'), ctx = cv.getContext('2d')!;
const st = { yaw: 30, pitch: 40, res: 0.85, line: 3, glass: 0.8, rust: 0, fade: 0, dent: false, lamp: false, spin: false, roll: false, px: 2 }; let dirty = true, wheel = 0, car = MESH_CARS[0]!, M = car.mesh();
const pick = document.getElementById('car') as HTMLSelectElement; for (const c of MESH_CARS) pick.add(new Option(c.name, c.id));
pick.addEventListener('change', () => { car = MESH_CARS.find(c => c.id === pick.value) ?? car; M = car.mesh(wheel); dirty = true; });
function frame() { if (st.spin) { st.yaw = (st.yaw + 0.8) % 360; $<HTMLInputElement>('yaw').value = String(Math.round(st.yaw)); dirty = true; }
  if (st.roll) { wheel += 0.12; M = car.mesh(wheel); dirty = true; }
  if (dirty) { dirty = false; const W = Math.round(400 * st.res), H = Math.round(260 * st.res), t = performance.now(), p = drawMesh(M, st.yaw, st.pitch, 16.7 / st.res, W, H, { outline: st.line, glass: st.glass, wear: { rust: st.rust, fade: st.fade, dent: st.dent, lamp: st.lamp } });
    cv.width = W; cv.height = H; ctx.putImageData(new ImageData(new Uint8ClampedArray(p.rgba), W, H), 0, 0); cv.style.width = `${400 * st.px}px`; cv.style.height = `${260 * st.px}px`;
    $('stat').textContent = `삼각형 ${M.n.toLocaleString()}개 · 한 장 ${Math.round(performance.now() - t)} ms · ${(16.7 / st.res).toFixed(1)} mm/픽셀`; }
  requestAnimationFrame(frame); }
const bind = (id: string, f: (v: string) => void) => $(id).addEventListener('input', e => { f((e.target as HTMLInputElement).value); dirty = true; });
bind('yaw', v => { st.yaw = +v; }); bind('pitch', v => { st.pitch = +v; $('pitchv').textContent = `${v}°`; }); bind('res', v => { st.res = +v; $('resv').textContent = `${v}배`; }); bind('line', v => { st.line = +v; }); bind('glass', v => { st.glass = +v; $('glassv').textContent = `${Math.round(+v * 100)}%`; }); bind('rust', v => { st.rust = +v; }); bind('fade', v => { st.fade = +v; });
$<HTMLInputElement>('dent').addEventListener('change', e => { st.dent = (e.target as HTMLInputElement).checked; dirty = true; }); $<HTMLInputElement>('lamp').addEventListener('change', e => { st.lamp = (e.target as HTMLInputElement).checked; dirty = true; });
bind('px', v => { st.px = +v; $('pxv').textContent = `${v}배`; });
$<HTMLInputElement>('spin').addEventListener('change', e => { st.spin = (e.target as HTMLInputElement).checked; }); $<HTMLInputElement>('roll').addEventListener('change', e => { st.roll = (e.target as HTMLInputElement).checked; });
let drag: [number, number] | null = null;
cv.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); st.spin = false; $<HTMLInputElement>('spin').checked = false; });
cv.addEventListener('pointermove', e => { if (!drag) return; st.yaw = ((st.yaw + (e.clientX - drag[0]) * 0.6) % 360 + 360) % 360; st.pitch = Math.max(0, Math.min(90, st.pitch + (e.clientY - drag[1]) * 0.3)); drag = [e.clientX, e.clientY];
  $<HTMLInputElement>('yaw').value = String(Math.round(st.yaw)); $<HTMLInputElement>('pitch').value = String(Math.round(st.pitch)); $('pitchv').textContent = `${Math.round(st.pitch)}°`; dirty = true; });
cv.addEventListener('pointerup', () => { drag = null; });
requestAnimationFrame(frame);
