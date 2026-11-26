// The EB110's kit build against the panel-built mesh (docs/systems/96_kit_conversion_plan.md, step 2): side-by-side
// pictures (the original on the left, the kit build on the right) at the parity test's views, the silhouettes' IoU, the
// wing raised, and the swaps (the kit's other tails and wheels on the EB110).
//   npx tsx tools/ref/eb110kit.ts <out dir> [mm=5]
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { drawMesh, type Mesh } from '../../render/car/mesh';
import { eb110Mesh } from '../../render/car/mesh_eb110';
import { eb110KitMesh } from '../../render/car/mesh_eb110_kit';
import { assemble } from '../../render/car/kit/assemble';
import { iou, seamCheck, silhouette, VIEWS } from '../../render/car/kit/check';
import * as E from '../../render/car/cars/eb110.kit';

const out = process.argv[2] ?? '.', mm = +(process.argv.find(a => a.startsWith('mm='))?.slice(3) ?? 5), W = Math.round(5400 / mm), H = Math.round(2700 / mm), BG = [196, 190, 174];
mkdirSync(out, { recursive: true });
function png(path: string, w: number, h: number, rgb: Uint8Array) { const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) rgb.subarray(y * w * 3, (y + 1) * w * 3).forEach((v, i) => { raw[y * (w * 3 + 1) + 1 + i] = v; });
  const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }), crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cr]); };
  const hd = Buffer.alloc(13); hd.writeUInt32BE(w, 0); hd.writeUInt32BE(h, 4); hd[8] = 8; hd[9] = 2; writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hd), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }
/** a picture on the backdrop, as RGB */
function flat(M: Mesh, yaw: number, pitch: number): Uint8Array { const p = drawMesh(M, yaw, pitch, mm, W, H, { outline: 2, glass: 0.7, cy: 0.6 }), o = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { const a = p.rgba[i * 4 + 3]! / 255; for (let q = 0; q < 3; q++) o[i * 3 + q] = BG[q]! * (1 - a) + p.rgba[i * 4 + q]! * a; } return o; }
/** pictures in a grid, `cols` across */
function sheet(pics: Uint8Array[], cols: number): { w: number; h: number; rgb: Uint8Array } { const rows = Math.ceil(pics.length / cols), o = new Uint8Array(W * cols * H * rows * 3).fill(BG[0]!);
  pics.forEach((p, k) => { const cx = k % cols, cy = Math.floor(k / cols); for (let y = 0; y < H; y++) o.set(p.subarray(y * W * 3, (y + 1) * W * 3), ((cy * H + y) * W * cols + cx * W) * 3); }); return { w: W * cols, h: H * rows, rgb: o }; }
const save = (name: string, pics: Uint8Array[], cols: number) => { const s = sheet(pics, cols); png(`${out}/${name}.png`, s.w, s.h, s.rgb); };

const orig = eb110Mesh(0, 0), kit = eb110KitMesh(0, 0), lines: string[] = [`triangles: original ${orig.n} (no engine), kit ${kit.n} (with the engine)`];
for (const v of VIEWS) lines.push(`${v.name.padEnd(8)} IoU ${iou(silhouette(orig, v, mm, W, H).mask, silhouette(kit, v, mm, W, H).mask).toFixed(4)}`);
// with `diff`: where the silhouettes differ at each view (red: only the original covers it; blue: only the kit build)
if (process.argv.includes('diff')) save('eb110_kit_diff', VIEWS.map(v => { const a = silhouette(orig, v, mm, W, H).mask, b = silhouette(kit, v, mm, W, H).mask, d = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) d.set(a[i] && !b[i] ? [220, 30, 30] : b[i] && !a[i] ? [30, 70, 230] : a[i] ? [200, 200, 200] : [255, 255, 255], i * 3); return d; }), 3);
// left the original, right the kit build
save('eb110_kit_front34', [flat(orig, 35, 22), flat(kit, 35, 22), flat(orig, 90, 8), flat(kit, 90, 8)], 2);
save('eb110_kit_rear34', [flat(orig, 215, 22), flat(kit, 215, 22), flat(eb110Mesh(0, 1), 270, 8), flat(eb110KitMesh(0, 1), 270, 8)], 2);
save('eb110_kit_side_top', [flat(orig, 0, 0), flat(kit, 0, 0), flat(orig, 0, 89.9), flat(kit, 0, 89.9)], 2);
const swaps = Object.entries(E).filter(([n]) => n !== 'EB110_KIT') as [string, Partial<typeof E.EB110_KIT>][];
const pics: Uint8Array[] = [];
for (const [name, patch] of swaps) { const A = assemble({ ...E.EB110_KIT, ...patch }, { lamps: 1, wing: 1 }), r = seamCheck(A); pics.push(flat(A.mesh, /TAIL|WING/.test(name) ? 215 : 35, 22));
  lines.push(`swap ${name.padEnd(20)} triangles ${A.mesh.n}, open edges ${r.open.length}, over-used ${r.nonManifold.length}, duplicates ${r.duplicates}, folded ${r.overlaps}`); }
if (pics.length) save('eb110_kit_swaps', pics, 3);
console.log(lines.join('\n'));
