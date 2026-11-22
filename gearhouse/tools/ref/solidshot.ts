// A contact sheet of cars drawn as solids for the track game (review 73), straight to a PNG: one row a car, one
// column a heading. The check for every change to render/car/voxel.ts (docs/systems/68_track_solid_rules.md).
//   npx tsx tools/ref/solidshot.ts <out.png> [cars=dueSSJ35,bmw315,fnTT33,dueA21] [yaws=30,150,250] [cell=15] [zoom=1.5] [pitch=40] [scale=2]
import { solidOf, surfaceOf, drawSurface, texOf } from '../../render/car/voxel';
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const arg = (k: string, d: string) => (process.argv.slice(3).find(a => a.startsWith(k + '=')) ?? `${k}=${d}`).slice(k.length + 1);
const out = process.argv[2]!, cars = arg('cars', 'dueSSJ35,bmw315,fnTT33,dueA21').split(','), yaws = arg('yaws', '30,150,250').split(',').map(Number);
const cell = +arg('cell', '15'), zoom = +arg('zoom', '1.5'), pitch = +arg('pitch', '40'), scale = +arg('scale', '2'), MM = 16.7 / zoom, tw = Math.round(360 * zoom), th = Math.round(230 * zoom);
const BG = [196, 190, 174], W = tw * yaws.length, H = th * cars.length, img = new Uint8Array(W * H * 3); for (let i = 0; i < W * H; i++) img.set(BG, i * 3);
cars.forEach((c, r) => { const m = JSON.parse(readFileSync(new URL(`../../data/cars/sheet/${c}.json`, import.meta.url), 'utf8')), t = performance.now();
  const S = solidOf(m, cell), F = surfaceOf(S, texOf(m, 6), m.width), t1 = performance.now();
  yaws.forEach((y, k) => { const p = drawSurface(F, y, pitch, MM, tw, th); for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) { const a = (j * tw + i) * 4; if (!p.rgba[a + 3]) continue; const b = ((r * th + j) * W + k * tw + i) * 3; img[b] = p.rgba[a]!; img[b + 1] = p.rgba[a + 1]!; img[b + 2] = p.rgba[a + 2]!; } });
  console.log(c, 'build', Math.round(t1 - t), 'ms, a frame', Math.round((performance.now() - t1) / yaws.length), 'ms, cells', F.n); });
// PNG, enlarged by whole pixels
const w2 = W * scale, h2 = H * scale, raw = Buffer.alloc((w2 * 3 + 1) * h2);
for (let y = 0; y < h2; y++) { raw[y * (w2 * 3 + 1)] = 0; for (let x = 0; x < w2; x++) { const s = ((Math.floor(y / scale)) * W + Math.floor(x / scale)) * 3, d = y * (w2 * 3 + 1) + 1 + x * 3; raw[d] = img[s]!; raw[d + 1] = img[s + 1]!; raw[d + 2] = img[s + 2]!; } }
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cr]); };
const hd = Buffer.alloc(13); hd.writeUInt32BE(w2, 0); hd.writeUInt32BE(h2, 4); hd[8] = 8; hd[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hd), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); console.log(out, w2, 'x', h2);
