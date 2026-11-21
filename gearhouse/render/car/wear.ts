// Age on a drawn car (review 67), laid over a flat picture by what each pixel is (its material, its part): rust coming
// through low on the painted panels, a dent in the front wing that catches no light, a broken lamp glass, paint faded and
// gone chalky. For the part builder's preview of a car's condition; the customer's car uses the same marks (ui/world/car.ts).
import type { CarImage } from './raster';

export interface Wear { rust: number; dent: boolean; lamp: boolean; fade: number }
export const NEW: Wear = { rust: 0, dent: false, lamp: false, fade: 0 };
const hash = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vn = (x: number, y: number) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (hash(xi, yi) * (1 - u) + hash(xi + 1, yi) * u) * (1 - v) + (hash(xi, yi + 1) * (1 - u) + hash(xi + 1, yi + 1) * u) * v; };

export function applyWear(im: CarImage, w: Wear): CarImage {
  if (!w.rust && !w.dent && !w.lamp && !w.fade) return im;
  const rgba = new Uint8ClampedArray(im.rgba), mat = im.mat ?? [], ids = im.ids ?? [], H = im.h, top = im.groundY;
  const idOf = (i: number) => ids[im.owner[i]!] ?? '';
  // the front wing's dent: where on the wing, from its pixels
  let fx = 0, fy = 0, fn = 0; if (w.dent) for (let i = 0; i < im.w * H; i++) if (/^(x_)?fenderF/.test(idOf(i))) { fx += i % im.w; fy += (i / im.w) | 0; fn++; }
  if (fn) { fx /= fn; fy /= fn; }
  const r = Math.max(4, im.w * 0.03);
  for (let i = 0; i < im.w * H; i++) { if (rgba[i * 4 + 3]! < 10) continue; const m = mat[i], x = i % im.w, y = (i / im.w) | 0, j = i * 4;
    const painted = m === 'paint' || m === 'paint2';
    if (w.fade && painted) { const g = (rgba[j]! + rgba[j + 1]! + rgba[j + 2]!) / 3, k = w.fade * 0.45; rgba[j] = rgba[j]! + (g + 18 - rgba[j]!) * k; rgba[j + 1] = rgba[j + 1]! + (g + 16 - rgba[j + 1]!) * k; rgba[j + 2] = rgba[j + 2]! + (g + 10 - rgba[j + 2]!) * k; }
    if (w.rust && painted) { const low = Math.max(0, (y / top - 0.55) / 0.45), n = vn(x / 3.2, y / 3.2) * 0.65 + vn(x, y) * 0.35;
      if (n < w.rust * (0.25 + low * 0.75)) { const deep = n < w.rust * low * 0.35; rgba[j] = deep ? 92 : 132; rgba[j + 1] = deep ? 46 : 70; rgba[j + 2] = deep ? 22 : 34; } }
    if (fn && /^(x_)?fenderF/.test(idOf(i))) { const q = Math.hypot(x - fx, (y - fy) * 1.4) / r; if (q < 1) { const k = 0.62 + 0.38 * q; rgba[j] = rgba[j]! * k; rgba[j + 1] = rgba[j + 1]! * k; rgba[j + 2] = rgba[j + 2]! * k; } }
    if (w.lamp && (m === 'lens' || /lens/.test(idOf(i)))) { const sh = hash(x, y) < 0.3; rgba[j] = sh ? 196 : 62; rgba[j + 1] = sh ? 196 : 60; rgba[j + 2] = sh ? 186 : 56; } }
  return { ...im, rgba };
}
