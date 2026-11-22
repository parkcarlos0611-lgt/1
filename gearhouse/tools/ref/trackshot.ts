// A track's plan (review 84): the concrete shaded by its height (darker low, lighter up the banking), the edges, the
// landmarks; and a strip of cross-sections through each banking. npx tsx tools/ref/trackshot.ts <out.png> [m per px=4]
import { writeFileSync } from 'node:fs'; import { deflateSync } from 'node:zlib';
import { millbrook } from '../../race/millbrook';
const T = millbrook(), mpp = +(process.argv[3] ?? 4), out = process.argv[2]!;
let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const n of T.nodes) { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y); }
const pad = 120, W = Math.ceil((x1 - x0 + 2 * pad) / mpp), H0 = Math.ceil((y1 - y0 + 2 * pad) / mpp), SEC = 220, H = H0 + SEC, img = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) img.set(i < W * H0 ? [86, 112, 70] : [236, 232, 222], i * 3);
const put = (X: number, Y: number, c: number[]) => { X = Math.round(X); Y = Math.round(Y); if (X >= 0 && Y >= 0 && X < W && Y < H) img.set(c, (Y * W + X) * 3); };
const px = (x: number, y: number) => [(x - x0 + pad) / mpp, (y1 + pad - y) / mpp] as const;
// the surface: every pixel near the line, coloured by height
let hint: number | undefined; for (let Y = 0; Y < H0; Y++) for (let X = 0; X < W; X++) { const x = X * mpp + x0 - pad, y = y1 + pad - Y * mpp, q = T.locate(x, y, undefined);
  if (Math.abs(q.off) > T.spec.width / 2) continue; const z = T.height(q.s, q.off), joint = (q.s % T.spec.joints) < mpp * 0.6, g = Math.min(255, 150 + z * 9) - (joint ? 14 : 0); put(X, Y, [g, g, g - 6]); }
void hint;
for (const side of [-1, 1]) for (let s = 0; s < T.length; s += 0.5) { const p = T.point(s, side * T.spec.width / 2); const [X, Y] = px(p.x, p.y); put(X, Y, [40, 40, 40]); }
for (const l of T.spec.landmarks) for (let o = -22; o <= 22; o += 0.5) { const p = T.point(l.s, o); const [X, Y] = px(p.x, p.y); put(X, Y, l.kind === 'line' ? [250, 250, 250] : l.kind === 'bridge' ? [150, 80, 40] : [220, 180, 40]); }
for (const b of T.spec.bumps) for (let o = -15; o <= 15; o += 0.5) { const p = T.point(b.s, o); const [X, Y] = px(p.x, p.y); put(X, Y, [200, 40, 40]); }
// cross-sections at the middle of each banking, 10x exaggerated? no: true scale, 6 px a metre, inner edge on the left
T.spec.banking.forEach((b, j) => { const s = (b.s0 + b.s1) / 2, ox = 30 + j * (W / 2), oy = H0 + SEC - 30, k = 6;
  for (let u = -2; u <= T.spec.width + 2; u += 0.05) { const off = (T.at(s).k >= 0 ? -1 : 1) * (u - T.spec.width / 2), z = T.height(s, off); for (let zz = 0; zz <= z * k; zz++) put(ox + u * k, oy - zz, [150, 150, 144]); put(ox + u * k, oy - z * k, [30, 30, 30]); }
  for (let u = 0; u <= T.spec.width * k; u++) put(ox + u, oy + 1, [30, 30, 30]); });
const s2 = 1, raw = Buffer.alloc((W * 3 + 1) * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const q = (y * W + x) * 3, d = y * (W * 3 + 1) + 1 + x * 3; raw[d] = img[q]!; raw[d + 1] = img[q + 1]!; raw[d + 2] = img[q + 2]!; } void s2;
const Tc = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = Tc[(c ^ v) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const ch = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), r = Buffer.alloc(4); r.writeUInt32BE(crc(td)); return Buffer.concat([l, td, r]); };
const hd = Buffer.alloc(13); hd.writeUInt32BE(W, 0); hd.writeUInt32BE(H, 4); hd[8] = 8; hd[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', hd), ch('IDAT', deflateSync(raw)), ch('IEND', Buffer.alloc(0))]));
console.log(out, W, 'x', H, 'length', T.length);
