// The powertrain's pictures (docs/systems/101, M1): the powertrain alone at a three-quarter view for each layout and
// its turbo variants, and a car with its body seen through so the powertrain shows in place.
//   npx tsx tools/ref/powertrain.ts <out dir> [mm=3]
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Build, drawMesh, type Mesh } from '../../render/car/mesh';
import { Geo } from '../../render/car/powertrain/geo';
import { buildEngine } from '../../render/car/powertrain/engine';
import { fromEngineSpec, type PowertrainSpec } from '../../render/car/powertrain/spec';
import { ENGINES } from '../../render/car/enginemesh';

const out = process.argv[2] ?? '.', mm = +(process.argv.find(a => a.startsWith('mm='))?.slice(3) ?? 3), BG = [196, 190, 174];
mkdirSync(out, { recursive: true });
export function png(path: string, w: number, h: number, rgb: Uint8Array) { const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) rgb.subarray(y * w * 3, (y + 1) * w * 3).forEach((v, i) => { raw[y * (w * 3 + 1) + 1 + i] = v; });
  const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }), crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cr]); };
  const hd = Buffer.alloc(13); hd.writeUInt32BE(w, 0); hd.writeUInt32BE(h, 4); hd[8] = 8; hd[9] = 2; writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hd), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }
export function flat(M: Mesh, yaw: number, pitch: number, W: number, H: number, mmpp = mm, cy = 0.6, glass = 0.7): Uint8Array { const p = drawMesh(M, yaw, pitch, mmpp, W, H, { outline: 2, glass, cy, shadow: false }), o = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { const a = p.rgba[i * 4 + 3]! / 255; for (let q = 0; q < 3; q++) o[i * 3 + q] = BG[q]! * (1 - a) + p.rgba[i * 4 + q]! * a; } return o; }
export function sheet(pics: Uint8Array[], cols: number, W: number, H: number): { w: number; h: number; rgb: Uint8Array } { const rows = Math.ceil(pics.length / cols), o = new Uint8Array(W * cols * H * rows * 3).fill(BG[0]!);
  pics.forEach((p, k) => { const cx = k % cols, cy = Math.floor(k / cols); for (let y = 0; y < H; y++) o.set(p.subarray(y * W * 3, (y + 1) * W * 3), ((cy * H + y) * W * cols + cx * W) * 3); }); return { w: W * cols, h: H * rows, rgb: o }; }
export const save = (name: string, pics: Uint8Array[], cols: number, W: number, H: number) => { const s = sheet(pics, cols, W, H); png(`${out}/${name}.png`, s.w, s.h, s.rgb); console.log(`${out}/${name}.png`); };

if (process.argv.includes('engine')) {
  const W = 420, H = 330, pics: Uint8Array[] = [];
  const eng = (s: PowertrainSpec, yaw: number, pitch: number) => { const g = new Geo(), o = buildEngine(g, s, 2); g.frame(null); const bb = g.bounds(), L = bb.max[0] + bb.min[0];
    const g2 = new Geo(); g2.frame(p => [p[0], p[1], p[2] + 150]); buildEngine(g2, s, 2); const b = new Build(); g2.emit(b); const M = b.mesh(L); void o; console.log(s.cylinders, s.intake, s.turbos, 'tris', M.n, 'size', bb.max.map((v, k) => Math.round(v - bb.min[k]!))); return flat(M, yaw, pitch, W, H, 2.6, 0.72); };
  const base = fromEngineSpec(ENGINES.nsx!);
  const vars: PowertrainSpec[] = [base, { ...fromEngineSpec(ENGINES.f355!) }, fromEngineSpec(ENGINES.eb110!), { ...base, intake: 'itb', grade: 3 }, { ...base, intake: 'single', turbos: 1 }, { ...fromEngineSpec(ENGINES.f355!), turbos: 2, intake: 'itb' }, { ...fromEngineSpec(ENGINES.diablo!), intake: 'itb' }, { ...base, turbos: 3, sump: 'dry', valves: 2, grade: 1 }];
  for (const v of vars) { pics.push(eng(v, 35, 28)); pics.push(eng(v, 215, 28)); pics.push(eng(v, 90, 10)); }
  save('pt_engine_dev', pics, 3, W, H);
}
