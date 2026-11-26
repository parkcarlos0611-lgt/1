// The crash test (review 121, brief 74 step 2): a car's structure struck at set energies, front, side, corner;
// prints how deep it went, the worst node's travel, parts come away, the front wheels' toe, the radiator; and a picture.
//   npx tsx tools/dev/crash.ts [car=dueSSJ35] [out.png]
import { MESH_CARS } from '../../render/car/meshcars';
import { Damage } from '../../race/damage';
import { raceSpec } from '../../race/cars';
import { wheelsOf, drawMesh } from '../../render/car/mesh';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
const id = process.argv[2] ?? 'dueSSJ35', out = process.argv[3], M = MESH_CARS.find(c => c.id === id)!.mesh(), m = raceSpec(id).mass;
let t0 = performance.now(); const probe = new Damage(M); console.log('nodes', probe.n, 'beams', probe.ba.length, 'built in', Math.round(performance.now() - t0), 'ms');
const W = wheelsOf(M), front = W.filter(w => w.front);
const cases: [string, [number, number, number], [number, number, number], number][] = [];
for (const kmh of [15, 30, 50]) { const E = 0.5 * m * (kmh / 3.6) ** 2 * 0.6; cases.push([`front ${kmh} km/h`, [0, 0, 600], [1, 0, 0], E]); }
const side = Math.max(...Array.from({ length: M.n * 3 }, (_, v) => M.pos[v * 3 + 1]!));
cases.push(['side 30 km/h at the door', [M.length * 0.5, side, 700], [0, -1, 0], 0.5 * m * (30 / 3.6) ** 2 * 0.5]);
cases.push(['front corner 40 km/h', [200, side * 0.8, 650], [0.7, -0.7, 0], 0.5 * m * (40 / 3.6) ** 2 * 0.5]);
const shots: ArrayLike<number>[] = []; let last: Damage | null = null;
for (const [name, p, d, E] of cases) { const D = new Damage(M); t0 = performance.now(); const depth = D.impact(p, d, E, 360); const ms = performance.now() - t0;
  const fw = front.map(w => D.askew([w.hx, w.hy, w.hz])); D.rebuild();
  console.log(name.padEnd(28), 'E', (E / 1000).toFixed(0).padStart(4), 'kJ  depth', depth.toFixed(0).padStart(4), 'mm  worst', D.worst.toFixed(0).padStart(4), 'mm  taken', (D.taken / 1000).toFixed(0), 'kJ  loose', D.loose.map(l => l.name).join(',') || '-', ' toe', fw.map(f => (f.toe * 57.3).toFixed(1)).join('/'), ' radiator', D.radiator.toFixed(2), ' ', Math.round(ms), 'ms');
  last = D; if (out) { const p2 = drawMesh(D.mesh, 30, 35, 9, 700, 450, { outline: 2, glass: 0.7 }); shots.push(p2.rgba); } }
if (out && shots.length) { const w = 700, h = 450, cols = 3, rows = Math.ceil(shots.length / cols), Wd = w * cols, Hd = h * rows, img = Buffer.alloc((Wd * 3 + 1) * Hd);
  for (let y = 0; y < Hd; y++) img[y * (Wd * 3 + 1)] = 0;
  shots.forEach((rgba, k) => { const ox = (k % cols) * w, oy = Math.floor(k / cols) * h; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = (y * w + x) * 4, al = rgba[a + 3]! / 255, d = (oy + y) * (Wd * 3 + 1) + 1 + (ox + x) * 3; for (let q = 0; q < 3; q++) img[d + q] = Math.round(200 * (1 - al) + rgba[a + q]! * al); } });
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) { const d = y * (Wd * 3 + 1) + 1 + x * 3; if (img[d] === 0 && img[d + 1] === 0 && img[d + 2] === 0 && x >= shots.length % cols * w && y >= (rows - 1) * h && shots.length % cols) { img[d] = img[d + 1] = img[d + 2] = 200; } }
  const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }), crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cr]); };
  const hd = Buffer.alloc(13); hd.writeUInt32BE(Wd, 0); hd.writeUInt32BE(Hd, 4); hd[8] = 8; hd[9] = 2;
  writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hd), chunk('IDAT', deflateSync(img)), chunk('IEND', Buffer.alloc(0))])); console.log(out); }
void last;
