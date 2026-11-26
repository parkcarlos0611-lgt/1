// A contact sheet of a mesh car (review 80): headings across, straight to a PNG; a second row from the side (pitch 0).
//   npx tsx tools/ref/meshshot.ts <out.png> [car=ssj] [yaws=30,150,250] [pitch=40] [mm=16.7] [scale=2] [line=2]
//   car: the file render/car/mesh_<car>.ts, which exports `mesh(spin)`; age and glass: [rust=0..1] [fade=0..1] [dent=1] [lamp=1] [glass=0.7]
import { drawMesh } from '../../render/car/mesh';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
const arg = (k: string, d: string) => (process.argv.slice(3).find(a => a.startsWith(k + '=')) ?? `${k}=${d}`).slice(k.length + 1);
const out = process.argv[2]!, yaws = arg('yaws', '30,150,250').split(',').map(Number), pitch = +arg('pitch', '40'), mm = +arg('mm', '16.7'), scale = +arg('scale', '2'), line = +arg('line', '2');
const M = (await import(`../../render/car/mesh_${arg('car', 'ssj')}.ts`) as { mesh: (spin?: number) => import('../../render/car/mesh').Mesh }).mesh(), tw = Math.round(6000 / mm), th = Math.round(3900 / mm), rows = [pitch, 0], W = tw * yaws.length, H = th * rows.length, img = new Uint8Array(W * H * 3); for (let i = 0; i < W * H; i++) img.set([196, 190, 174], i * 3);
console.log('triangles', M.n);
rows.forEach((pt, r) => yaws.forEach((y, k) => { const t = performance.now(), p = drawMesh(M, pt === 0 ? [0, 180, 90][k % 3]! : y, pt, mm, tw, th, { outline: line, glass: +arg('glass', '0.7'), wear: { rust: +arg('rust', '0'), fade: +arg('fade', '0'), dent: arg('dent', '0') === '1', lamp: arg('lamp', '0') === '1' } }); if (!r && !k) console.log('a frame', Math.round(performance.now() - t), 'ms');
  for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) { const a = (j * tw + i) * 4, al = p.rgba[a + 3]! / 255; if (!al) continue; const b = ((r * th + j) * W + k * tw + i) * 3; for (let q = 0; q < 3; q++) img[b + q] = img[b + q]! * (1 - al) + p.rgba[a + q]! * al; } }));
const w2 = W * scale, h2 = H * scale, raw = Buffer.alloc((w2 * 3 + 1) * h2);
for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) { const s = (Math.floor(y / scale) * W + Math.floor(x / scale)) * 3, d = y * (w2 * 3 + 1) + 1 + x * 3; raw[d] = img[s]!; raw[d + 1] = img[s + 1]!; raw[d + 2] = img[s + 2]!; }
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cr]); };
const hd = Buffer.alloc(13); hd.writeUInt32BE(w2, 0); hd.writeUInt32BE(h2, 4); hd[8] = 8; hd[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hd), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); console.log(out, w2, 'x', h2);
