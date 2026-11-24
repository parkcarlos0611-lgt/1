// The 959's pictures (docs/systems/109): the shell drawn from the side, front, rear, top and three-quarter views, and
// the control cage as wires beside its subdivision.
//   npx tsx tools/ref/p959.ts <out dir> [mm=4]
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { drawMesh, type Mesh } from '../../render/car/mesh';
import { p959Mesh, buildShell } from '../../render/car/p959';
import { edgeUse } from '../../render/car/p959/shell';

const out = process.argv[2] ?? '.', mm = +(process.argv.find(a => a.startsWith('mm='))?.slice(3) ?? 4), W = Math.round(4800 / mm), H = Math.round(2300 / mm), BG = [206, 202, 192];
mkdirSync(out, { recursive: true });
export function png(path: string, w: number, h: number, rgb: Uint8Array) { const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) rgb.subarray(y * w * 3, (y + 1) * w * 3).forEach((v, i) => { raw[y * (w * 3 + 1) + 1 + i] = v; });
  const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }), crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cr]); };
  const hd = Buffer.alloc(13); hd.writeUInt32BE(w, 0); hd.writeUInt32BE(h, 4); hd[8] = 8; hd[9] = 2; writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hd), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }
function flat(M: Mesh, yaw: number, pitch: number): Uint8Array { const p = drawMesh(M, yaw, pitch, mm, W, H, { outline: 2, glass: 0.85, cy: 0.6, smooth: true, studio: true }), o = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { const a = p.rgba[i * 4 + 3]! / 255; for (let q = 0; q < 3; q++) o[i * 3 + q] = BG[q]! * (1 - a) + p.rgba[i * 4 + q]! * a; } return o; }
const VIEWS: Record<string, [number, number]> = { side: [0, 0], front: [90, 0], rear: [270, 0], top: [0, 89.9], front34: [35, 20], rear34: [215, 20], high34: [40, 40], rearhigh: [220, 42] };
const M = p959Mesh(), S = buildShell();
for (const [n, [yaw, pitch]] of Object.entries(VIEWS)) png(`${out}/p959_${n}.png`, W, H, flat(M, yaw, pitch));
const use = [...edgeUse(S.F).values()], count = (f: (t: (typeof S.tag)[number]) => boolean) => S.F.reduce((s, f2, k) => s + (f(S.tag[k]!) ? f2.length - 2 : 0), 0);
console.log(`cage: ${S.cage.P.length} points, ${S.cage.F.length} faces; shell: ${S.P.length} points, ${S.F.length} faces`);
console.log(`triangles: all ${count(() => true)}; shell region ${count(t => t.region === 'shell')} (paint ${count(t => t.region === 'shell' && t.mat === 'paint')}, glass ${count(t => t.mat === 'glass')}, wells+floor ${count(t => t.panel === 'wheelWell' || t.panel === 'floor')}), tail ${count(t => t.region === 'tail')}, bumpers ${count(t => t.region === 'bumperF')} + ${count(t => t.region === 'bumperR')}`);
console.log(`edges: ${use.length}, open ${use.filter(u => u === 1).length}, over-used ${use.filter(u => u > 2).length}; mesh ${M.n} triangles`);

// ---- the silhouettes laid over the blueprint (docs/reference/959/bp_canepa_4view.jpg), at twice its scale: a mask per
//      view in the blueprint's own frame (side: x along, z up; plan: x along, y across; front: y across, z up)
if (process.argv.includes('masks')) { const K = 4260 / 730 / 2;
  const mask = (w: number, h: number, pr: (x: number, y: number, z: number) => [number, number]) => { const m = new Uint8Array(w * h * 3).fill(255), p = M.pos;
    for (let t = 0; t < M.n; t++) { const q = [0, 1, 2].map(k => pr(p[t * 9 + k * 3]!, p[t * 9 + k * 3 + 1]!, p[t * 9 + k * 3 + 2]!)), [A, B, C] = q as [[number, number], [number, number], [number, number]];
      const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(w - 1, Math.ceil(Math.max(A[0], B[0], C[0]))), y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(h - 1, Math.ceil(Math.max(A[1], B[1], C[1]))), den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]); if (Math.abs(den) < 1e-9) continue;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const X = x + 0.5, Y = y + 0.5, l0 = ((B[1] - C[1]) * (X - C[0]) + (C[0] - B[0]) * (Y - C[1])) / den, l1 = ((C[1] - A[1]) * (X - C[0]) + (A[0] - C[0]) * (Y - C[1])) / den; if (l0 < 0 || l1 < 0 || l0 + l1 > 1) continue; m[(y * w + x) * 3] = m[(y * w + x) * 3 + 1] = m[(y * w + x) * 3 + 2] = 0; } }
    return m; };
  png(`${out}/mask_side.png`, 1640, 560, mask(1640, 560, (x, _y, z) => [40 + x / K, 500 - z / K]));
  png(`${out}/mask_plan.png`, 1640, 760, mask(1640, 760, (x, y) => [40 + x / K, 380 - y / (1840 / 319 / 2)]));
  png(`${out}/mask_front.png`, 760, 560, mask(760, 560, (_x, y, z) => [380 + y / K, 500 - z / K])); }
