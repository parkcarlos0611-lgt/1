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

/** the road's scale: the house's front door (2.03 m) is 65 px at the house's depth (0.86), so 37 px a metre at the road's (1.00) */
export const CAR_MM = 27, KERB_GROUND = 244;
/** material codes the GPU reads: 1 paint, 2 chrome, 3 glass, 4 rubber/black, 5 head lamp lens, 6 tail lamp, 7 other */
export interface CarSprite { w: number; h: number; rgba: Uint8ClampedArray; info: Uint8ClampedArray; groundY: number; hubs: [number, number, number][]; tail: [number, number]; front: number; head: [number, number];
  /** the point under the car's middle, on the ground, in the picture */ anchor: [number, number] }
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
  let bx0 = w, bx1 = 0; for (let i = 0; i < w * h; i++) if (rgba[i * 4 + 3]! > 10) { bx0 = Math.min(bx0, i % w); bx1 = Math.max(bx1, i % w); }
  return { w, h, rgba, info, groundY: im.groundY, hubs, tail, front, head: hn ? [hx / hn, hy / hn] : [front + 3, im.groundY - 20], anchor: [(bx0 + bx1 + 1) / 2, im.groundY] }; }

/** the car turned: its pictures from the side (0°) round to its back (90°) every 7.5° (review 56). The part model
 *  has only the four flat views, so the car's solid is made from them: a point is inside the car where the side, the
 *  back and the top views all have car (the visual hull), and each outer face takes its colour from the view that
 *  faces the same way (the side view with the damage and the driver, the back view, the top). Turned, it is drawn
 *  point by point with a depth test; pinholes are closed. The ends (0° and 90°) are the flat views themselves. */
export function carTurns(side: CarSprite, colour: string): CarSprite[] {
  const m = JSON.parse(JSON.stringify(sedan)) as CarModel; m.paint = colour; m.paint2 = colour;
  const flat = (v: 'rear' | 'top' | 'front') => { const im = rasterizeFlat(viewDesign(m, v), { mm: CAR_MM, shadow: false }), info = new Uint8ClampedArray(im.w * im.h * 4), mat = im.mat ?? [];
    for (let i = 0; i < im.w * im.h; i++) if (im.rgba[i * 4 + 3]! > 10) { const c = MAT[mat[i] ?? ''] ?? 7; info[i * 4] = c; info[i * 4 + 1] = Math.round((GLOSS[c] ?? 0.1) * 255); info[i * 4 + 3] = 255; }
    return { w: im.w, h: im.h, rgba: im.rgba, info, groundY: im.groundY }; };
  const rear = flat('rear'), top = flat('top');
  const box = (p: { w: number; h: number; rgba: Uint8ClampedArray }) => { let x0 = p.w, x1 = -1, y0 = p.h, y1 = -1; for (let i = 0; i < p.w * p.h; i++) if (p.rgba[i * 4 + 3]! > 10) { const x = i % p.w, y = (i / p.w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return [x0, y0, x1, y1] as const; };
  const sb = box(side), rb = box(rear), tb = box(top), nx = sb[2] - sb[0] + 1, ny = rb[2] - rb[0] + 1, nz = side.groundY - sb[1];
  const at = (p: { w: number; rgba: Uint8ClampedArray }, x: number, y: number) => (y * p.w + x) * 4, on = (p: { w: number; h: number; rgba: Uint8ClampedArray }, x: number, y: number) => x >= 0 && y >= 0 && x < p.w && y < p.h && p.rgba[at(p, x, y) + 3]! > 10;
  const sideAt = (x: number, z: number) => [sb[0] + x, side.groundY - 1 - z] as const, rearAt = (y: number, z: number) => [rb[0] + y, rear.groundY - 1 - z] as const, topAt = (x: number, y: number) => [Math.round(tb[0] + x * (tb[2] - tb[0]) / (nx - 1)), Math.round(tb[1] + y * (tb[3] - tb[1]) / (ny - 1))] as const;
  const solid = new Uint8Array(nx * ny * nz), I = (x: number, y: number, z: number) => (z * ny + y) * nx + x;
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) { const [a, b] = sideAt(x, z); if (!on(side, a, b)) continue;
    for (let y = 0; y < ny; y++) { const [c, d] = rearAt(y, z), [e, f] = topAt(x, y); if (on(rear, c, d) && on(top, e, f)) solid[I(x, y, z)] = 1; } }
  const out: CarSprite[] = [side];
  for (let k = 1; k < 12; k++) { const th = k * 7.5 * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th), cx = nx / 2, cy = ny / 2;
    const fw = Math.ceil(nx * cs + ny * sn) + 6, fh = nz + 4, ox = fw / 2, rgba = new Uint8ClampedArray(fw * fh * 4), info = new Uint8ClampedArray(fw * fh * 4), zb = new Float32Array(fw * fh).fill(1e9);
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) { if (!solid[I(x, y, z)]) continue;
      const open = (xx: number, yy: number, zz: number) => xx < 0 || yy < 0 || zz < 0 || xx >= nx || yy >= ny || zz >= nz || !solid[I(xx, yy, zz)];
      const fL = open(x, y - 1, z) ? cs : -9, fRear = open(x + 1, y, z) ? sn : -9; if (fL < 0 && fRear < 0 && !open(x, y, z + 1)) continue;   // a face we see: the near side, the back, or the top
      const sxp = Math.round((x - cx) * cs + (y - cy) * sn + ox), syp = fh - 2 - z, dep = (y - cy) * cs - (x - cx) * sn; if (sxp < 0 || sxp >= fw) continue; const pi = syp * fw + sxp; if (dep >= zb[pi]!) continue; zb[pi] = dep;
      let src: { w: number; rgba: Uint8ClampedArray; info: Uint8ClampedArray }, j: number;
      if (fL >= fRear && fL > 0) { const [a, b] = sideAt(x, z); src = side; j = at(side, a, b); } else if (fRear > 0) { const [a, b] = rearAt(y, z); src = rear; j = at(rear, a, b); } else { const [a, b] = topAt(x, y); src = top; j = at(top, a, b); }
      const shade = fL >= fRear ? 1 : 0.92; rgba[pi * 4] = src.rgba[j]! * shade; rgba[pi * 4 + 1] = src.rgba[j + 1]! * shade; rgba[pi * 4 + 2] = src.rgba[j + 2]! * shade; rgba[pi * 4 + 3] = 255;
      info.set(src.info.subarray(j, j + 4), pi * 4); }
    for (let pass = 0; pass < 2; pass++) for (let y = 1; y < fh - 1; y++) for (let x = 1; x < fw - 1; x++) { const i = y * fw + x; if (rgba[i * 4 + 3]) continue; const nb = [i - 1, i + 1, i - fw, i + fw].filter(q => rgba[q * 4 + 3]); if (nb.length < 3) continue;   // pinholes closed
      for (let c = 0; c < 4; c++) { rgba[i * 4 + c] = nb.reduce((t, q) => t + rgba[q * 4 + c]!, 0) / nb.length; info[i * 4 + c] = info[nb[0]! * 4 + c]!; } }
    out.push({ w: fw, h: fh, rgba, info, groundY: fh - 2, hubs: [], tail: [0, 0], front: 0, head: [0, 0], anchor: [ox, fh - 2] }); }
  const rb2 = box(rear); out.push({ w: rear.w, h: rear.h, rgba: rear.rgba, info: rear.info, groundY: rear.groundY, hubs: [], tail: [(rb2[0] + rb2[2]) / 2 - 8, rear.groundY - 6], front: 0, head: [0, 0], anchor: [(rb2[0] + rb2[2] + 1) / 2, rear.groundY] });
  return out; }

/** the depth scale of the ground at a screen row: the road 1.00, the yard in front of the garage 0.92 */
export const depthScale = (y: number) => 0.92 + Math.max(0, Math.min(1, (y - 172) / 72)) * 0.08;
/** the way in: along the road from the right, round into the drive, up it to stand before the right-hand garage door */
export const TURN_X = 470, TURN_R = 44, STOP_Y = 188;
export interface CarPath { x: number; y: number; yaw: number }
/** turning into the drive with the turned pictures is kept but switched off (planner, 2026-11-21): the car comes along the
 *  road and stops at the kerb before the house */
export const TURN_IN = false, KERB_X = 268;
/** where the car is at a distance `s` (screen pixels) along the way in, counted from where it stands at the end */
export function along(s: number): CarPath { if (!TURN_IN) return { x: KERB_X + s, y: KERB_GROUND, yaw: 0 }; const arc = TURN_R * Math.PI / 2, upLen = (KERB_GROUND - TURN_R * 0.75) - STOP_Y;
  if (s <= upLen) return { x: TURN_X - TURN_R, y: STOP_Y + s, yaw: 90 };
  if (s <= upLen + arc) { const f = (s - upLen) / arc, ph = (1 - f) * Math.PI / 2; return { x: TURN_X - TURN_R * Math.sin(ph), y: KERB_GROUND - TURN_R * (1 - Math.cos(ph)) * 0.75, yaw: ph * 180 / Math.PI }; }
  return { x: TURN_X + (s - upLen - arc), y: KERB_GROUND, yaw: 0 }; }

/** the car's movement: arriving along the way in (s from far to 0), standing, leaving back out and away to the left */
export interface CarMotion { s: number; v: number; wheel: number; state: 'arrive' | 'idle' | 'parked' | 'leave' | 'gone'; t: number; away?: number }
export function stepCar(c: CarMotion, dt: number, r: number) {
  c.t += dt; let ds = 0;
  if (c.state === 'arrive') { const target = Math.min(70, Math.max(0, c.s * 1.1), c.s > 0 && along(c.s).yaw > 0 ? 26 : 70); c.v += Math.max(-60 * dt, Math.min(30 * dt, target - c.v)); ds = -Math.min(c.v * dt, c.s); c.s += ds; if (c.s < 0.3 && c.v < 3) { c.s = 0; c.v = 0; c.state = 'idle'; c.t = 0; } }
  else if (c.state === 'idle' && c.t > 3.2) { c.state = 'parked'; c.t = 0; }
  else if (c.state === 'leave') { const p = along(c.s); c.v = Math.min(p.yaw > 0 ? 22 : 80, c.v + 20 * dt); if (TURN_IN && (p.yaw > 0 || c.s < 1)) { ds = c.v * dt; c.s += ds; } else { c.away = (c.away ?? 0) + c.v * dt; ds = c.v * dt; } if ((c.away ?? 0) > 700) c.state = 'gone'; }
  c.wheel += (c.state === 'leave' && (c.away ?? 0) > 0 ? ds : -ds) / r; }
