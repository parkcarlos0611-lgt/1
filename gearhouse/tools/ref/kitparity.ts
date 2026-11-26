// The car kit's render checks (docs/systems/95_nsx_kit_breakdown.md, section 6): the kit-built NSX against the
// original mesh at the parity test's six views (a side-by-side and a pixel-difference picture each, the silhouettes'
// IoU), and the swap test's renders (a longer and wider body, the round-lamp tail, the disc wheel).
//   npx tsx tools/ref/kitparity.ts <out dir> [mm=6]
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { drawMesh, type Mesh } from '../../render/car/mesh';
import { nsxMesh } from '../../render/car/mesh_nsx';
import { nsxKitMesh } from '../../render/car/mesh_nsx_kit';
import { assemble } from '../../render/car/kit/assemble';
import { iou, seamCheck, silhouette, VIEWS } from '../../render/car/kit/check';
import { NSX_DISC_WHEEL, NSX_KIT, NSX_ROUND_TAIL } from '../../render/car/cars/nsx.kit';

const out = process.argv[2] ?? '.', mm = +(process.argv.find(a => a.startsWith('mm='))?.slice(3) ?? 6), W = Math.round(5600 / mm), H = Math.round(3000 / mm), BG = [196, 190, 174];
mkdirSync(out, { recursive: true });
function png(path: string, w: number, h: number, rgb: Uint8Array) { const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) rgb.subarray(y * w * 3, (y + 1) * w * 3).forEach((v, i) => { raw[y * (w * 3 + 1) + 1 + i] = v; });
  const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }), crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cr]); };
  const hd = Buffer.alloc(13); hd.writeUInt32BE(w, 0); hd.writeUInt32BE(h, 4); hd[8] = 8; hd[9] = 2; writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hd), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }
/** a picture on the backdrop, as RGB */
function flat(M: Mesh, yaw: number, pitch: number, lamps = false): Uint8Array { const p = drawMesh(M, yaw, pitch, mm, W, H, { outline: 2, glass: 0.7, cy: 0.6 }), o = new Uint8Array(W * H * 3); void lamps;
  for (let i = 0; i < W * H; i++) { const a = p.rgba[i * 4 + 3]! / 255; for (let q = 0; q < 3; q++) o[i * 3 + q] = BG[q]! * (1 - a) + p.rgba[i * 4 + q]! * a; } return o; }
/** pictures side by side */
function row(pics: Uint8Array[]): Uint8Array { const n = pics.length, o = new Uint8Array(W * n * H * 3); pics.forEach((p, k) => { for (let y = 0; y < H; y++) o.set(p.subarray(y * W * 3, (y + 1) * W * 3), (y * W * n + k * W) * 3); }); return o; }

const orig = nsxMesh(0, 0), kit = nsxKitMesh(0, 0), lines: string[] = [`triangles: original ${orig.n}, kit ${kit.n} (${((kit.n / orig.n - 1) * 100).toFixed(1)} %)`];
for (const v of VIEWS) {
  const a = silhouette(orig, v, mm, W, H), b = silhouette(kit, v, mm, W, H), score = iou(a.mask, b.mask);
  const pa = flat(orig, v.yaw, v.pitch), pb = flat(kit, v.yaw, v.pitch), d = new Uint8Array(W * H * 3); let px = 0;
  for (let i = 0; i < W * H; i++) { const ma = a.mask[i], mb = b.mask[i]; if (ma && !mb) d.set([220, 30, 30], i * 3); else if (mb && !ma) d.set([30, 70, 230], i * 3);
    else if (ma && mb) { const e = Math.abs(pa[i * 3]! - pb[i * 3]!) + Math.abs(pa[i * 3 + 1]! - pb[i * 3 + 1]!) + Math.abs(pa[i * 3 + 2]! - pb[i * 3 + 2]!); if (e > 30) px++; const g = Math.max(0, 235 - e * 2); d.set([g, g, g], i * 3); } else d.set([255, 255, 255], i * 3); }
  png(`${out}/parity_${v.name}.png`, W * 2, H, row([pa, pb])); png(`${out}/diff_${v.name}.png`, W, H, d);
  lines.push(`${v.name.padEnd(8)} IoU ${score.toFixed(4)}  pixels differing in colour ${px}`); }
// the swaps
const swaps: [string, Parameters<typeof assemble>[0], Parameters<typeof assemble>[1]][] = [
  ['stretch', NSX_KIT, { tweak: { wheelbase: 150, halfWidth: 30 } }], ['roundTail', { ...NSX_KIT, ...NSX_ROUND_TAIL }, {}], ['discWheel', { ...NSX_KIT, ...NSX_DISC_WHEEL }, {}]];
for (const [name, spec, o] of swaps) { const A = assemble(spec, o), r = seamCheck(A);
  png(`${out}/swap_${name}.png`, W * 3, H, row([flat(A.mesh, 0, 0), flat(A.mesh, 35, 22), flat(A.mesh, 215, 22)]));
  lines.push(`swap ${name.padEnd(10)} triangles ${A.mesh.n}, length ${A.mesh.length}, open edges ${r.open.length}, over-used ${r.nonManifold.length}, duplicates ${r.duplicates}, folded ${r.overlaps}`); }
png(`${out}/swap_compare_side.png`, W * 2, H, row([flat(kit, 0, 0), flat(assemble(NSX_KIT, { tweak: { wheelbase: 150, halfWidth: 30 } }).mesh, 0, 0)]));
png(`${out}/lamps_up.png`, W * 2, H, row([flat(nsxMesh(0, 1), 35, 22), flat(nsxKitMesh(0, 1), 35, 22)]));
console.log(lines.join('\n')); writeFileSync(`${out}/parity.txt`, lines.join('\n') + '\n');
