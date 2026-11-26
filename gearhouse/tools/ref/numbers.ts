// The race-number face (review 96): every figure on a disc, big, to check the shapes. npx tsx tools/ref/numbers.ts <out.png>
import { drawMesh, renumber } from '../../render/car/mesh';
import { mesh } from '../../render/car/mesh_jagD55';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
const texts: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '12', '107'], tw = 300, th = 260, W = tw * 6, H = th * 2, img = new Uint8Array(W * H * 3).fill(200);
texts.forEach((t, k) => { const M = renumber(mesh(), t), dx = M.length / 2 - 1130, pos = Float32Array.from(M.pos); for (let i = 0; i < pos.length; i += 3) pos[i] = pos[i]! + dx;
  const p = drawMesh({ ...M, pos, decals: M.decals!.map(d => ({ ...d, o: [d.o[0] + dx, d.o[1], d.o[2]] as [number, number, number] })) }, 90, 89.9, 1.6, tw, th, { outline: 0, cy: 0.5, studio: true, shadow: false });   // looking down on the bonnet's disc from above, the car's front at the bottom
  // centre the bonnet disc: the car is drawn about its middle, so shift the picture by the disc's place
  for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) { const a = (j * tw + i) * 4; if (!p.rgba[a + 3]) continue; const b = (((k / 6 | 0) * th + j) * W + (k % 6) * tw + i) * 3; img[b] = p.rgba[a]!; img[b + 1] = p.rgba[a + 1]!; img[b + 2] = p.rgba[a + 2]!; } });
const raw = Buffer.alloc((W * 3 + 1) * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = (y * W + x) * 3, d = y * (W * 3 + 1) + 1 + x * 3; raw[d] = img[s]!; raw[d + 1] = img[s + 1]!; raw[d + 2] = img[s + 2]!; }
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cr]); };
const hd = Buffer.alloc(13); hd.writeUInt32BE(W, 0); hd.writeUInt32BE(H, 4); hd[8] = 8; hd[9] = 2;
writeFileSync(process.argv[2]!, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hd), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
