// The engine workshop's cutaway drawn offline (render/car/powertrain/internals.ts): the stand's engine cut open with its
// insides posed on the CPU by the bones the live renderer uses (poseInternals), at a few crank angles, for a layout.
//   npx tsx tools/ref/cutaway.ts <out prefix> <layout I4|V8|...> [crank flat|cross] [angles 0,90] [yaw] [pitch]
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { drawMesh, type Mesh } from '../../render/car/mesh';
import { standModel } from '../../render/car/powertrain/stand';
import { poseInternals, type CrankKind } from '../../render/car/powertrain/internals';
import { DESIGN_F355, normalise, type Layout } from '../../core/design';

const [out = 'cutaway', layout = 'V8', crank = 'flat', angles = '0,90', yaw0, pitch0] = process.argv.slice(2), BG = [196, 190, 174];
function png(path: string, w: number, h: number, rgb: Uint8Array) { const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) rgb.subarray(y * w * 3, (y + 1) * w * 3).forEach((v, i) => { raw[y * (w * 3 + 1) + 1 + i] = v; });
  const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }), crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cr]); };
  const hd = Buffer.alloc(13); hd.writeUInt32BE(w, 0); hd.writeUInt32BE(h, 4); hd[8] = 8; hd[9] = 2; writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hd), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }
/** the mesh with its insides where the bones put them at crank angle θ */
function posed(M: Mesh, theta: number): Mesh { if (!M.inner || !M.bone) return M; const B = poseInternals(M.inner, theta), pos = M.pos.slice();
  for (let t = 0; t < M.n; t++) { const k = M.bone[t]!; if (!k) continue; const o = k * 12; for (let j = 0; j < 3; j++) { const i = t * 9 + j * 3, x = pos[i]!, y = pos[i + 1]!, z = pos[i + 2]!;
    pos[i] = B[o]! * x + B[o + 1]! * y + B[o + 2]! * z + B[o + 3]!; pos[i + 1] = B[o + 4]! * x + B[o + 5]! * y + B[o + 6]! * z + B[o + 7]!; pos[i + 2] = B[o + 8]! * x + B[o + 9]! * y + B[o + 10]! * z + B[o + 11]!; } }
  return { ...M, pos }; }
const d = structuredClone(DESIGN_F355); d.engine.layout = layout as Layout; if (layout === 'I4') { d.engine.cc = 1998; d.engine.valves = 4; d.engine.sump = 'wet'; }
const m = standModel(normalise(d), 2, { crank: crank as CrankKind }), I = layout[0] === 'I';
const yaw = yaw0 !== undefined ? +yaw0 : I ? 200 : 215, pitch = pitch0 !== undefined ? +pitch0 : I ? 18 : 42, W = 1400, H = 1000, mm = 0.85, zc = (m.min[2] + m.max[2]) / 2, cy = 0.5 + Math.cos(pitch * Math.PI / 180) * zc / mm / H;
for (const a of angles.split(',').map(Number)) { const p = drawMesh(posed(m.mesh, a), yaw, pitch, mm, W, H, { outline: 2, glass: 0.7, cy, shadow: false }), o = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { const al = p.rgba[i * 4 + 3]! / 255; for (let q = 0; q < 3; q++) o[i * 3 + q] = BG[q]! * (1 - al) + p.rgba[i * 4 + q]! * al; }
  png(`${out}_${a}.png`, W, H, o); console.log(`${out}_${a}.png`, m.rig?.order, m.mesh.n); }
