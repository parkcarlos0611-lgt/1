// The kit-built F355 (render/car/mesh_f355_kit.ts) beside the hand-built one (render/car/mesh_f355.ts): the six views
// side by side with the silhouettes' IoU, the head lamps up, the swap test (a longer, wider body), and the kit car's
// front and rear beside the reference renders when their folder is given.
//   npx tsx tools/ref/kitf355.ts <out dir> [mm=6] [ref=<folder with render_front.png, render_rear.png>]
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { drawMesh, type Mesh } from '../../render/car/mesh';
import { f355Mesh } from '../../render/car/mesh_f355';
import { f355KitMesh } from '../../render/car/mesh_f355_kit';
import { assemble } from '../../render/car/kit/assemble';
import { iou, seamCheck, silhouette, VIEWS } from '../../render/car/kit/check';
import { F355_KIT } from '../../render/car/cars/f355.kit';

const out = process.argv[2] ?? '.', arg = (k: string) => process.argv.find(a => a.startsWith(k + '='))?.slice(k.length + 1), mm = +(arg('mm') ?? 6), W = Math.round(5600 / mm), H = Math.round(3000 / mm), BG = [196, 190, 174];
mkdirSync(out, { recursive: true });
function png(path: string, w: number, h: number, rgb: Uint8Array) { const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) rgb.subarray(y * w * 3, (y + 1) * w * 3).forEach((v, i) => { raw[y * (w * 3 + 1) + 1 + i] = v; });
  const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }), crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cr]); };
  const hd = Buffer.alloc(13); hd.writeUInt32BE(w, 0); hd.writeUInt32BE(h, 4); hd[8] = 8; hd[9] = 2; writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hd), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }
/** an 8-bit RGB or RGBA PNG (no interlace) read back as RGB, scaled to w x h (nearest) */
function readPng(path: string, w: number, h: number): Uint8Array { const b = readFileSync(path); let p = 8, iw = 0, ih = 0, ct = 2; const id: Buffer[] = [];
  while (p < b.length) { const l = b.readUInt32BE(p), t = b.toString('ascii', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + l); if (t === 'IHDR') { iw = d.readUInt32BE(0); ih = d.readUInt32BE(4); ct = d[9]!; } else if (t === 'IDAT') id.push(d); p += 12 + l; }
  const bpp = ct === 6 ? 4 : 3, raw = inflateSync(Buffer.concat(id)), st = iw * bpp, px = new Uint8Array(iw * ih * bpp);
  for (let y = 0; y < ih; y++) { const f = raw[y * (st + 1)]!, row = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)); for (let x = 0; x < st; x++) { const a = x >= bpp ? px[y * st + x - bpp]! : 0, up = y ? px[(y - 1) * st + x]! : 0, c = x >= bpp && y ? px[(y - 1) * st + x - bpp]! : 0;
    const pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c), pred = f === 1 ? a : f === 2 ? up : f === 3 ? (a + up) >> 1 : f === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? up : c) : 0; px[y * st + x] = (row[x]! + pred) & 255; } }
  const o = new Uint8Array(w * h * 3).fill(255), k = Math.min(w / iw, h / ih), ox = (w - iw * k) / 2, oy = (h - ih * k) / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const sx = Math.floor((x - ox) / k), sy = Math.floor((y - oy) / k); if (sx < 0 || sy < 0 || sx >= iw || sy >= ih) continue; for (let q = 0; q < 3; q++) o[(y * w + x) * 3 + q] = px[(sy * iw + sx) * bpp + q]!; }
  return o; }
function flat(M: Mesh, yaw: number, pitch: number, m = mm): Uint8Array { const w = Math.round(5600 / m), h = Math.round(3000 / m), p = drawMesh(M, yaw, pitch, m, w, h, { outline: 2, glass: 0.7, cy: 0.6 }), o = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { const a = p.rgba[i * 4 + 3]! / 255; for (let q = 0; q < 3; q++) o[i * 3 + q] = BG[q]! * (1 - a) + p.rgba[i * 4 + q]! * a; } return o; }
function row(pics: Uint8Array[], w = W, h = H): Uint8Array { const n = pics.length, o = new Uint8Array(w * n * h * 3); pics.forEach((p, k) => { for (let y = 0; y < h; y++) o.set(p.subarray(y * w * 3, (y + 1) * w * 3), (y * w * n + k * w) * 3); }); return o; }

const orig = f355Mesh(0, 0), kit = f355KitMesh(0, 0), A = assemble(F355_KIT), r = seamCheck(A), lines: string[] = [`triangles: hand-built ${orig.n}, kit ${kit.n}`, `seams: open ${r.open.length}, over-used ${r.nonManifold.length}, duplicates ${r.duplicates}, folded ${r.overlaps}, seams ${r.seams}`];
for (const v of VIEWS) { const s = iou(silhouette(orig, v, mm, W, H).mask, silhouette(kit, v, mm, W, H).mask); png(`${out}/f355_${v.name}.png`, W * 2, H, row([flat(orig, v.yaw, v.pitch), flat(kit, v.yaw, v.pitch)])); lines.push(`${v.name.padEnd(8)} IoU vs hand-built ${s.toFixed(4)}`); }
png(`${out}/f355_lamps_up.png`, W * 2, H, row([flat(f355Mesh(0, 1), 35, 12), flat(f355KitMesh(0, 1), 35, 12)]));
const S = assemble(F355_KIT, { tweak: { wheelbase: 150, halfWidth: 30 } }), rs = seamCheck(S);
png(`${out}/f355_stretch.png`, W * 2, H, row([flat(kit, 0, 0), flat(S.mesh, 0, 0)])); lines.push(`stretch: length ${S.mesh.length}, open ${rs.open.length}, over-used ${rs.nonManifold.length}, duplicates ${rs.duplicates}, folded ${rs.overlaps}`);
// close views of the ends (a frame 2.6 m across), beside the reference renders when given
const m2 = 2.6, w2 = Math.round(2600 / m2), h2 = Math.round(1500 / m2), ref = arg('ref');
const close = (M: Mesh, yaw: number, pitch: number) => { const p = drawMesh(M, yaw, pitch, m2, w2, h2, { outline: 1, glass: 0.7, cy: 0.62 }), o = new Uint8Array(w2 * h2 * 3);
  for (let i = 0; i < w2 * h2; i++) { const a = p.rgba[i * 4 + 3]! / 255; for (let q = 0; q < 3; q++) o[i * 3 + q] = BG[q]! * (1 - a) + p.rgba[i * 4 + q]! * a; } return o; };
for (const [name, yaw, pitch] of [['front', 90, 3], ['rear', 270, 6]] as const) {
  const pics = [close(f355Mesh(0, 0), yaw, pitch), close(kit, yaw, pitch)], file = ref && `${ref}/render_${name}.png`;
  if (file && existsSync(file)) pics.unshift(readPng(file, w2, h2)); png(`${out}/f355_close_${name}.png`, w2 * pics.length, h2, row(pics, w2, h2)); }
console.log(lines.join('\n')); writeFileSync(`${out}/f355_kit.txt`, lines.join('\n') + '\n');
