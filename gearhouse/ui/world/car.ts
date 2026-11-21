// The customer's car (version one, step 2; review 55): the car's own 3D part model (data/cars) seen from its left side,
// drawn by the flat renderer in the customer's paint at the road's scale, with the job's damage put on the very parts it
// is on (rust on a fender, a dent in the hood, a broken lamp, a torn roof), the customer at the wheel behind the glass.
// The GPU lights it with the scene (render/place/front2gl.ts): its enamel giving back the sky, the chrome brighter, the
// glass reflecting, its shadow on the road, its lamps at night, its image in a wet road. It comes along the road from
// the right and stops at the kerb in front of the house, wheels turning, the engine slowing to idle and stopping.
import { viewDesign, type CarModel } from '../../render/car/model';
import { rasterizeFlat } from '../../render/car/flat';
import { pixels } from './pics';
import sedan from '../../data/cars/sedan29.json';
import imgDriver from '../../assets/people/driver_left.png';
import type { Damage } from '../../core/repair';

export const CAR_MM = 31, KERB_GROUND = 244;
/** material codes the GPU reads: 1 paint, 2 chrome, 3 glass, 4 rubber/black, 5 head lamp lens, 6 tail lamp, 7 other */
export interface CarSprite { w: number; h: number; rgba: Uint8ClampedArray; info: Uint8ClampedArray; groundY: number; hubs: [number, number, number][]; tail: [number, number]; front: number; head: [number, number] }
const MAT: Record<string, number> = { paint: 1, paint2: 1, chrome: 2, glass: 3, rubber: 4, black: 4, lens: 5, lensR: 6 };
const GLOSS: Record<number, number> = { 1: 0.55, 2: 0.95, 3: 0.7, 4: 0.12, 5: 0.6, 6: 0.5, 7: 0.15 };

function rnd(x: number, y: number) { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/** the car's picture, or null until the driver's picture has loaded */
export function carSprite(colour: string, damages: Damage[]): CarSprite | null {
  const drv = pixels(imgDriver, 22, 42), DW = 22; if (!drv) return null;
  const m = JSON.parse(JSON.stringify(sedan)) as CarModel; m.paint = colour; m.paint2 = colour;
  const im = rasterizeFlat(viewDesign(m, 'left'), { mm: CAR_MM, shadow: false }), w = im.w, h = im.h, rgba = new Uint8ClampedArray(im.rgba), info = new Uint8ClampedArray(w * h * 4), ids = im.ids ?? [], mat = im.mat ?? [];
  const partOf = (i: number) => ids[im.owner[i]!] ?? '';
  for (let i = 0; i < w * h; i++) { if (rgba[i * 4 + 3]! < 10) continue; const code = MAT[mat[i] ?? ''] ?? 7; info[i * 4] = code; info[i * 4 + 1] = Math.round((GLOSS[code] ?? 0.1) * 255); info[i * 4 + 3] = 255; }
  // the damage, where it is
  const hurt = new Map(damages.map(d => [d.part, d]));
  for (let i = 0; i < w * h; i++) { if (rgba[i * 4 + 3]! < 10) continue; const x = i % w, y = (i / w) | 0, d = hurt.get(partOf(i)); if (!d) continue; const sev = d.severity ?? 0.5;
    if (d.kind === 'rust' && info[i * 4] === 1) { const n = rnd(x >> 1, y >> 1) * 0.6 + rnd(x, y) * 0.4, low = (y / h) ** 1.5; if (n < sev * 0.55 + low * 0.35) { const k = n < sev * 0.3 ? 1 : 0.6; rgba[i * 4] = 120 * k + 20; rgba[i * 4 + 1] = 62 * k + 10; rgba[i * 4 + 2] = 30 * k + 8; info[i * 4 + 1] = 20; } }   // rust: brown, dull, worst low down
    if (d.kind === 'dent' && info[i * 4] === 1) { const cx = w * (d.part === 'fenderR' ? 0.78 : d.part === 'hood' ? 0.3 : 0.14), cy = h * 0.55, r = 6 + sev * 5, q = Math.hypot(x - cx, (y - cy) * 1.4) / r; if (q < 1) { const k = 0.7 + 0.3 * q; rgba[i * 4] = rgba[i * 4]! * k; rgba[i * 4 + 1] = rgba[i * 4 + 1]! * k; rgba[i * 4 + 2] = rgba[i * 4 + 2]! * k; info[i * 4 + 1] = Math.round(info[i * 4 + 1]! * q); } }   // a dent: a dull, darker hollow that catches no sky
    if (d.kind === 'lamp' && (info[i * 4] === 5)) { rgba[i * 4] = 70; rgba[i * 4 + 1] = 66; rgba[i * 4 + 2] = 60; info[i * 4] = 7; if (rnd(x, y) < 0.3) { rgba[i * 4] = 190; rgba[i * 4 + 1] = 190; rgba[i * 4 + 2] = 180; } }   // the lens broken: dark, a few shards
    if (d.kind === 'roof' && partOf(i) === 'roof' && rnd(x >> 1, y) < sev * 0.5) { rgba[i * 4] = 30; rgba[i * 4 + 1] = 28; rgba[i * 4 + 2] = 26; } }
  // the customer at the wheel, seen through the front side window: darker behind the glass
  const glass0: number[] = []; for (let i = 0; i < w * h; i++) if (partOf(i) === 'glass0') glass0.push(i);
  if (glass0.length) { let gx0 = w, gx1 = 0, gy1 = 0; for (const i of glass0) { const x = i % w, y = (i / w) | 0; gx0 = Math.min(gx0, x); gx1 = Math.max(gx1, x); gy1 = Math.max(gy1, y); }
    const ox = Math.round((gx0 + gx1) / 2 - DW / 2), oy = gy1 - 22, inG = new Set(glass0);
    for (let y = 0; y < 42; y++) for (let x = 0; x < DW; x++) { const j = (y * DW + x) * 4; if (drv[j + 3]! < 128) continue; const X = ox + x, Y = oy + y, i = Y * w + X; if (X < 0 || Y < 0 || X >= w || Y >= h || !inG.has(i)) continue;
      rgba[i * 4] = rgba[i * 4]! * 0.35 + drv[j]! * 0.5; rgba[i * 4 + 1] = rgba[i * 4 + 1]! * 0.35 + drv[j + 1]! * 0.5; rgba[i * 4 + 2] = rgba[i * 4 + 2]! * 0.35 + drv[j + 2]! * 0.5; } }
  const hubs = m.wheels.map(wh => [im.X(wh.x), im.Y(wh.r), wh.r / CAR_MM] as [number, number, number]);
  const tp = m.parts.find(p => p.id === 'tailpipe'), tail: [number, number] = tp ? [im.X(tp.box.x[1]), im.Y((tp.box.z[0] + tp.box.z[1]) / 2)] : [w - 6, im.groundY - 6];
  let front = w, hx = 0, hy = 0, hn = 0; for (let i = 0; i < w * h; i++) { if (rgba[i * 4 + 3]! > 10) front = Math.min(front, i % w); if (info[i * 4] === 5 || (mat[i] === 'lens')) { hx += i % w; hy += (i / w) | 0; hn++; } }
  return { w, h, rgba, info, groundY: im.groundY, hubs, tail, front, head: hn ? [hx / hn, hy / hn] : [front + 3, im.groundY - 20] }; }

/** the car's movement along the road: arriving from the right, stopping at the kerb; leaving to the left */
export interface CarMotion { x: number; v: number; wheel: number; state: 'arrive' | 'idle' | 'parked' | 'leave' | 'gone'; t: number }
export const PARK_X = 196;   // where its front stops: before the path to the door
export function stepCar(c: CarMotion, dt: number, r: number) {
  c.t += dt;
  if (c.state === 'arrive') { const d = c.x - PARK_X, target = Math.min(70, Math.max(0, d * 1.25)); c.v += Math.max(-60 * dt, Math.min(30 * dt, target - c.v)); if (d < 0.4 && c.v < 2) { c.x = PARK_X; c.v = 0; c.state = 'idle'; c.t = 0; } }
  if (c.state === 'idle' && c.t > 3.2) { c.state = 'parked'; c.t = 0; }
  if (c.state === 'leave') { c.v = Math.min(80, c.v + 22 * dt); if (c.x < -260) c.state = 'gone'; }
  const dx = c.state === 'leave' ? -c.v * dt : -Math.min(c.v * dt, Math.max(0, c.x - PARK_X)); c.x += dx; c.wheel += -dx / r; }
