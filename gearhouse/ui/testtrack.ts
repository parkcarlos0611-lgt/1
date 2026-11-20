// Test drive page (review 24): drive the 1948 utility over the test course with the pedals, see its springs work,
// look through the body, change the springs and the transfer range. Bundled into one page by tools/ref/buildtrack.mjs.
import { Rig, UTILITY48, type RigSpec } from '../physics/rig';
import { Powertrain, UTILITY48_DRIVE } from '../physics/powertrain';
import { DriveScene, LR48_LAYOUT } from '../render/car/scene';
import { Canvas } from '../render/car/running';
import { COURSE, COURSE_END, kind } from './course';
import body from '../data/bodies/lr48_right.json';
import chassis from '../data/bodies/lr48_chassis_right.json';
import type { CarDesign } from '../render/car/types';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const cvEl = $<HTMLCanvasElement>('view'), ctx = cvEl.getContext('2d')!, W = 560, H = 230;
cvEl.width = W; cvEl.height = H;
const SPRINGS: Record<string, { k: number; c: number; label: string }> = { soft: { k: 0.6, c: 0.7, label: '부드럽게' }, std: { k: 1, c: 1, label: '표준' }, hard: { k: 1.6, c: 1.3, label: '단단하게' } };
let rig: Rig, scene: DriveScene, pt: Powertrain, lastAngles: number[] = [], pedal = 0, brake = 0, springs = 'std', range: 'high' | 'low' = 'high', built = false;

function spec(): RigSpec { const f = SPRINGS[springs]!; return { ...UTILITY48, spring: { ...UTILITY48.spring, k: [UTILITY48.spring.k[0] * f.k, UTILITY48.spring.k[1] * f.k], c: [UTILITY48.spring.c[0] * f.c, UTILITY48.spring.c[1] * f.c] } }; }
async function reset(rebuild: boolean) {
  const old = scene; rig = new Rig(spec(), COURSE, 3); rig.run(1.0); pt = new Powertrain(UTILITY48_DRIVE); pt.range = range;
  scene = new DriveScene(rig, COURSE, kind, { body: body as unknown as CarDesign, chassis: chassis as unknown as CarDesign }, LR48_LAYOUT, W, H);
  if (rebuild || !old) { const bar = $('progress'); bar.hidden = false;
    await scene.build(async (d, n) => { if (d % 3 === 0) { $('progressText').textContent = `차를 자세별로 그리는 중 ${d}/${n}`; (bar.querySelector('i') as HTMLElement).style.width = `${d / n * 100}%`; await new Promise(r => setTimeout(r, 0)); } });
    bar.hidden = true; built = true; }
  else Object.assign(scene, { body: (old as any).body, house: (old as any).house, chassis: (old as any).chassis });
  scene.xray = $<HTMLInputElement>('xray').checked; lastAngles = rig.tyres.map(t => t.angle);
}
const cv = new Canvas(W, H), image = new ImageData(W, H);
let last = performance.now(), acc = 0;
function frame(now: number) {
  requestAnimationFrame(frame); if (!built) return;
  const dt = Math.min(0.05, (now - last) / 1000); last = now; acc += dt;
  const STEP = 1 / 4000, n = Math.round(dt / STEP);
  // wheel speed from the tyres' turn, then the powertrain decides the torque
  const wW = -rig.tyres.reduce((s, t, k) => s + (t.angle - lastAngles[k]!), 0) / 4 / Math.max(dt, 1e-3); lastAngles = rig.tyres.map(t => t.angle);
  const torque = pt.update(dt, wW, pedal, rig.vx / rig.s.wheelR); rig.maxTorque = Math.abs(torque); rig.throttle = Math.sign(torque); rig.brake = brake;
  for (let i = 0; i < n; i++) rig.step(STEP);
  scene.step(dt); scene.draw(cv); image.data.set(cv.rgba); ctx.putImageData(image, 0, 0);
  if (acc > 0.1) { acc = 0; const kmh = rig.vx * 3.6;
    $('speed').textContent = `${Math.abs(kmh).toFixed(0)}`; $('rpm').textContent = `${Math.round(pt.rpm / 10) * 10}`; $('gear').textContent = pt.reversing ? 'R' : `${pt.gear}${range === 'low' ? 'L' : ''}`;
    $('surface').textContent = { asphalt: '포장', gravel: '자갈', dirt: '흙', sand: '모래' }[kind(rig.x)];
    rig.defl.forEach((a, i) => a.forEach((d, j) => { const el = $(`d${i}${j}`), v = Math.max(-1, Math.min(1, d / 0.09)), lo = Math.min(50, 50 - v * 50), hi = Math.max(50, 50 - v * 50);
      el.style.background = `linear-gradient(to bottom, transparent ${lo}%, var(--accent2) ${lo}%, var(--accent2) ${hi + 1}%, transparent ${hi + 1}%), var(--bg)`; el.title = `${(d * 1000).toFixed(0)} mm`; }));     // up: compressed, down: stretched
    $('pitch').textContent = `${(rig.th * 57.3).toFixed(1)}°`; $('roll').textContent = `${(rig.ph * 57.3).toFixed(1)}°`;
    $('pos').style.width = `${Math.max(0, Math.min(100, (rig.x / COURSE_END) * 100))}%`; }
}
// ---- controls: hold to drive, keys too ----
const hold = (id: string, on: () => void, off: () => void) => { const el = $(id); for (const e of ['pointerdown']) el.addEventListener(e, ev => { ev.preventDefault(); el.setPointerCapture((ev as PointerEvent).pointerId); el.classList.add('on'); on(); });
  for (const e of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(e, () => { el.classList.remove('on'); off(); }); };
hold('gas', () => (pedal = 1), () => (pedal = 0)); hold('back', () => (pedal = -0.7), () => (pedal = 0)); hold('brk', () => (brake = 1), () => (brake = 0));
addEventListener('keydown', e => { if (e.repeat) return; if (e.key === 'ArrowRight' || e.key === 'd') pedal = 1; if (e.key === 'ArrowLeft' || e.key === 'a') pedal = -0.7; if (e.key === ' ' || e.key === 'ArrowDown' || e.key === 's') { brake = 1; e.preventDefault(); } });
addEventListener('keyup', e => { if (['ArrowRight', 'd', 'ArrowLeft', 'a'].includes(e.key)) pedal = 0; if ([' ', 'ArrowDown', 's'].includes(e.key)) brake = 0; });
$('xray').addEventListener('change', () => (scene.xray = $<HTMLInputElement>('xray').checked));
for (const k of Object.keys(SPRINGS)) $(`sp-${k}`).addEventListener('change', () => { springs = k; void reset(false); });
for (const r of ['high', 'low'] as const) $(`rg-${r}`).addEventListener('change', () => { range = r; pt.range = r; pt.gear = 1; });
$('restart').addEventListener('click', () => void reset(false));
void reset(true).then(() => requestAnimationFrame(frame));
