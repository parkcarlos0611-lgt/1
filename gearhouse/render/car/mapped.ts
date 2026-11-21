// A car drawn from a captured map (tools/ref/capture.py): every pixel knows its element, its material and its tone
// step. Drawn from the map's own tones it repeats the reference view; with another paint, wear or part it becomes
// a different car. Proportions can be brought to real figures after the capture (wheels keep their shape).
import { autoRamp } from './flat';

type RGB = [number, number, number];
export interface CarMap { id: string; view: string; mm: number; w: number; h: number; length: number; height: number; materials: string[];
  elements: { k: number; id: string; slot: string | null; z: number }[]; tones: Record<string, string[]>; e: number[]; m: number[]; l: number[] }
export interface MapImage { w: number; h: number; rgba: Uint8ClampedArray; element: Int16Array }
const hex = (s: string): RGB => { const v = parseInt(s.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const unrle = (a: number[], n: number): Int16Array => { const o = new Int16Array(n); let p = 0; for (let i = 0; i < a.length; i += 2) { o.fill(a[i]!, p, p + a[i + 1]!); p += a[i + 1]!; } return o; };

export function drawMap(M: CarMap, opt: { paint?: string; outline?: number; /** real overall height in mm: the body above the wheels is scaled to it */ height?: number; /** real overall length in mm */ length?: number; wheelTop?: number } = {}): MapImage {
  const N = M.w * M.h; let el = unrle(M.e, N), mt = unrle(M.m, N), lv = unrle(M.l, N), w = M.w, h = M.h;
  // ---- proportions: stretch along the car, and above the wheels in height, by nearest pixel so tones stay clean ----
  const W2 = opt.length ? Math.round(opt.length / M.mm) : w, keep = Math.round((opt.wheelTop ?? 0) / M.mm), H2 = opt.height ? Math.round(opt.height / M.mm) : h;
  if (W2 !== w || H2 !== h) { const e2 = new Int16Array(W2 * H2).fill(-1), m2 = new Int16Array(W2 * H2), l2 = new Int16Array(W2 * H2);
    for (let y = 0; y < H2; y++) { const fromBottom = H2 - 1 - y, sy = fromBottom < keep ? h - 1 - fromBottom : Math.min(h - 1 - keep, Math.max(0, Math.floor((y + 0.5) * (h - keep) / (H2 - keep))));
      for (let x = 0; x < W2; x++) { const sx = Math.min(w - 1, Math.floor((x + 0.5) * w / W2)), i = sy * w + sx, j = y * W2 + x; e2[j] = el[i]!; m2[j] = mt[i]!; l2[j] = lv[i]!; } }
    el = e2; mt = m2; lv = l2; w = W2; h = H2; }
  const ramps: Record<string, RGB[]> = {}; for (const [name, t] of Object.entries(M.tones)) ramps[name] = t.map(hex);
  if (opt.paint) { const n = M.tones.paint?.length ?? 8; ramps.paint = autoRamp(opt.paint, { steps: n, baseIdx: Math.floor(n * 0.45), dL: 0.52 / n, shift: 0.06 }).c; }
  const P = 3, Wd = w + P * 2, Hd = h + P * 2, rgba = new Uint8ClampedArray(Wd * Hd * 4), element = new Int16Array(Wd * Hd).fill(-1), th = opt.outline ?? 2;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : el[y * w + x]!);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (el[i]! < 0) continue; const name = M.materials[mt[i]!]!, r = ramps[name] ?? ramps.paint!, c = r[Math.min(r.length - 1, lv[i]!)]!, o = ((y + P) * Wd + x + P) * 4;
    rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = 255; element[(y + P) * Wd + x + P] = el[i]!; }
  // ---- the outline against the background, drawn outside the car so nothing of the picture is lost ----
  const OUT: RGB = [14, 13, 18];
  for (let y = -P; y < h + P; y++) for (let x = -P; x < w + P; x++) { if (at(x, y) >= 0) continue; let near = false;
    for (let dy = -th; dy <= th && !near; dy++) for (let dx = -th; dx <= th; dx++) if (Math.abs(dx) + Math.abs(dy) <= th && at(x + dx, y + dy) >= 0) { near = true; break; }
    if (near) { const o = ((y + P) * Wd + x + P) * 4; rgba[o] = OUT[0]; rgba[o + 1] = OUT[1]; rgba[o + 2] = OUT[2]; rgba[o + 3] = 255; } }
  return { w: Wd, h: Hd, rgba, element }; }
