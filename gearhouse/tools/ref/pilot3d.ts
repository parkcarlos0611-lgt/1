// The SSJ pilot (review 92): the 2D part model's pictures beside the 3D model's, at the builder's scale, new and aged by
// the 2D wear system, and the other views. npx tsx tools/ref/pilot3d.ts <out.png> [mm=5]
import { readFileSync, writeFileSync } from 'node:fs'; import { deflateSync } from 'node:zlib';
import { viewDesign, type CarModel } from '../../render/car/model';
import { rasterizeFlat } from '../../render/car/flat';
import { applyWear } from '../../render/car/wear';
import { meshImage, type MeshView } from '../../render/car/mesh';
import { mesh } from '../../render/car/mesh_ssj';
import type { CarImage } from '../../render/car/raster';
const mm = +(process.argv[3] ?? 5), m = JSON.parse(readFileSync('data/cars/sheet/dueSSJ35.json', 'utf8')) as CarModel, M = mesh(), aged = { rust: 0.6, fade: 0.5, dent: true, lamp: true };
const flat = (v: 'left' | 'front' | 'rear' | 'top') => rasterizeFlat(viewDesign(m, v), { mm, shadow: true }), solid = (v: MeshView) => meshImage(M, v, mm);
const rows: CarImage[][] = [[flat('left'), solid('left')], [applyWear(flat('left'), aged), applyWear(solid('left'), aged)], [flat('front'), solid('front'), flat('rear'), solid('rear')], [flat('top'), solid('top')]];
const gap = 20, W = Math.max(...rows.map(r => r.reduce((a, im) => a + im.w + gap, gap))), H = rows.reduce((a, r) => a + Math.max(...r.map(im => im.h)) + gap, gap), img = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) img.set([226, 220, 206], i * 3);
let y = gap; for (const r of rows) { let x = gap; for (const im of r) { for (let j = 0; j < im.h; j++) for (let i = 0; i < im.w; i++) { const a = (j * im.w + i) * 4, al = im.rgba[a + 3]! / 255; if (!al) continue; const q = ((y + j) * W + x + i) * 3; for (let c = 0; c < 3; c++) img[q + c] = img[q + c]! * (1 - al) + im.rgba[a + c]! * al; } x += im.w + gap; } y += Math.max(...r.map(im => im.h)) + gap; }
const raw = Buffer.alloc((W * 3 + 1) * H); for (let yy = 0; yy < H; yy++) for (let x = 0; x < W; x++) { const q = (yy * W + x) * 3, d = yy * (W * 3 + 1) + 1 + x * 3; raw[d] = img[q]!; raw[d + 1] = img[q + 1]!; raw[d + 2] = img[q + 2]!; }
const T = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = T[(c ^ v) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const ch = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), rr = Buffer.alloc(4); rr.writeUInt32BE(crc(td)); return Buffer.concat([l, td, rr]); };
const hd = Buffer.alloc(13); hd.writeUInt32BE(W, 0); hd.writeUInt32BE(H, 4); hd[8] = 8; hd[9] = 2;
writeFileSync(process.argv[2]!, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', hd), ch('IDAT', deflateSync(raw)), ch('IEND', Buffer.alloc(0))])); console.log(process.argv[2], W, 'x', H);
