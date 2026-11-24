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

// ---- the powertrain in a car ----
import { assemble, type Assembled } from '../../render/car/kit/assemble';
import { designKit } from '../../render/car/design';
import { DESIGN_NSX, DESIGN_F355, applyPatch, type Design, type DesignPatch } from '../../core/design';
import { NSX_KIT } from '../../render/car/cars/nsx.kit';
import { F355_KIT } from '../../render/car/cars/f355.kit';
import { EB110_KIT } from '../../render/car/cars/eb110.kit';
import type { CarKit } from '../../render/car/kit/spec';

const pickTris = (M: Mesh, keep: (t: number) => boolean): Mesh => { const K: number[] = []; for (let t = 0; t < M.n; t++) if (keep(t)) K.push(t);
  const pick = <A extends Float32Array | Uint8Array | Int16Array>(a: A, w: number, make: (n: number) => A): A => { const o = make(K.length * w); K.forEach((t, i) => o.set(a.subarray(t * w, t * w + w), i * w)); return o; };
  return { ...M, decals: [], n: K.length, pos: pick(M.pos, 9, n => new Float32Array(n)), col: pick(M.col, 3, n => new Uint8Array(n)), gloss: pick(M.gloss, 1, n => new Float32Array(n)), part: pick(M.part, 1, n => new Int16Array(n)), kind: pick(M.kind, 1, n => new Uint8Array(n)), tex: pick(M.tex, 1, n => new Uint8Array(n)) }; };
const isPt = (A: Assembled) => { const e = A.panels.indexOf('engine'); return (t: number) => A.panelOf[t] === e; };
const isWheel = (A: Assembled) => { const e = A.panels.indexOf('wheel'); return (t: number) => A.panelOf[t] === e; };
/** the powertrain alone, with the wheels */
export const alone = (A: Assembled): Mesh => { const p = isPt(A), w = isWheel(A); return pickTris(A.mesh, t => p(t) || w(t)); };
/** the car with its body seen through: every panel but the powertrain and the wheels drawn as glass, the cabin's inside and the bay's tub taken out */
export const seeThrough = (A: Assembled): Mesh => { const p = isPt(A), w = isWheel(A), ins = A.panels.indexOf('cabin'), bay = A.panels.indexOf('engineBay'), N = A.mesh.names ?? [];
  const M = pickTris(A.mesh, t => p(t) || w(t) || (A.panelOf[t] !== ins && A.panelOf[t] !== bay && N[A.mesh.part[t]!] !== 'engineBay' && N[A.mesh.part[t]!] !== 'chassis' && N[A.mesh.part[t]!] !== 'seam'));
  const P = new Set(CORE), kind = Uint8Array.from(M.kind); for (let t = 0; t < M.n; t++) { const n = N[M.part[t]!] ?? ''; if (!P.has(n) && !/^(tyre|rim|wheel|hub)/.test(n)) kind[t] = 3; } return { ...M, kind }; };
let CORE: string[] = [];
const des = (base: Design, p: DesignPatch): Assembled => { const { kit, tweak } = designKit(applyPatch(base, p)); return assemble(kit, { tweak }); };
const report = (name: string, A: Assembled) => { const p = isPt(A); let n = 0; const c: Record<string, number> = {}; for (let t = 0; t < A.mesh.n; t++) if (p(t)) { n++; const nm = A.mesh.names![A.mesh.part[t]!]!; c[nm] = (c[nm] ?? 0) + 1; }
  CORE = [...new Set([...CORE, ...Object.keys(c)])]; console.log(`${name}: car ${A.mesh.n}, powertrain ${n}`); if (process.argv.includes('parts')) console.log('   ' + Object.entries(c).map(([a, b]) => a + ':' + b).join(' ')); };
if (process.argv.includes('car')) {
  const W = 1000, H = 560, cars: [string, Assembled][] = [['NSX V6', assemble(NSX_KIT)], ['F355 V8', assemble(F355_KIT)], ['EB110 V12 4 turbos AWD', assemble(EB110_KIT as CarKit)],
    ['NSX V6 2 turbos', des(DESIGN_NSX, { engine: { turbo: 2, grade: 3, intake: 'single' } })], ['F355 V8 ITB', des(DESIGN_F355, { engine: { grade: 3, intake: 'itb' } })], ['F355 V12 4 turbos AWD', des(DESIGN_F355, { body: { wheelbase: 250 }, engine: { layout: 'V12', cc: 5000, grade: 4, turbo: 4, intake: 'itb' }, drive: { awd: true, gearbox: 'f1' } })]];
  for (const [n, A] of cars) report(n, A);
  save('powertrain_alone_rear34', cars.map(([, A]) => flat(alone(A), 215, 28, W, H, 4.8, 0.66)), 2, W, H);
  save('powertrain_alone_front34', cars.map(([, A]) => flat(alone(A), 35, 28, W, H, 4.8, 0.66)), 2, W, H);
  save('powertrain_alone_top', cars.map(([, A]) => flat(alone(A), 0, 89.9, W, H, 4.8, 0.5)), 2, W, H);
  save('powertrain_alone_side', cars.map(([, A]) => flat(alone(A), 0, 4, W, H, 4.8, 0.72)), 2, W, H);
  save('powertrain_in_car', cars.flatMap(([, A]) => [flat(seeThrough(A), 215, 26, W, H, 4.8, 0.66, 0.42), flat(seeThrough(A), 0, 89.9, W, H, 4.8, 0.5, 0.42)]), 2, W, H);
  save('powertrain_car_outside', cars.slice(0, 3).flatMap(([, A]) => [flat(A.mesh, 215, 22, W, H, 4.8, 0.66), flat(A.mesh, 35, 22, W, H, 4.8, 0.66), flat(A.mesh, 0, 0, W, H, 4.8, 0.72), flat(A.mesh, 270, 6, W, H, 4.8, 0.72)]), 2, W, H);
}
