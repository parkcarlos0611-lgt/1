// Draw every body in data/cars to PNG sheets: each car at 1x and at 3x on a period paper background.
// npx tsx tools/renderCars.ts <out dir>
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { rasterize } from '../render/car/raster';
import { encodePNG } from './png';
import type { CarDesign } from '../render/car/types';
const out = process.argv[2] ?? 'out'; mkdirSync(out, { recursive: true });
const BG = [214, 205, 184];
for (const f of readdirSync('data/cars').filter(f => f.endsWith('.json'))) {
  const d = JSON.parse(readFileSync('data/cars/' + f, 'utf8')) as CarDesign, img = rasterize(d);
  for (const k of [1, 3]) { const W = img.w * k, H = img.h * k, px = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = (Math.floor(y / k) * img.w + Math.floor(x / k)) * 4, o = (y * W + x) * 4, a = img.rgba[s + 3]!;
      const gnd = Math.floor(y / k) >= img.groundY; for (let c = 0; c < 3; c++) px[o + c] = a ? img.rgba[s + c]! : gnd ? BG[c]! - 40 : BG[c]!; px[o + 3] = 255; }
    writeFileSync(`${out}/${f.replace('.json', '')}_${k}x.png`, encodePNG(W, H, px)); }
  console.log(f, `${img.w}x${img.h}px`, img.ms.toFixed(1) + ' ms'); }
