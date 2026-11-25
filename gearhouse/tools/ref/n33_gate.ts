// The N33's third cage, gate 1 (docs/systems/117 §15): the remade front third drawn through the photographs' own
// cameras (a perspective camera fitted to marks read off each photograph) and square on from the front and the side
// for the blueprint. tools/ref/n33_gate.py lays the pictures over the photographs.
//   npx tsx tools/ref/n33_gate.ts <out dir> [fit] [form] [old]
// fit: fit the cameras again from the marks and print them; form: continuous shading (to judge the surfaces);
// old: the second cage (the game's) through the same cameras, to compare
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Build, KINDS, type Mesh, type MeshLine } from '../../render/car/mesh';
import { emitShell } from '../../render/car/p959';
import { p959Lines } from '../../render/car/p959/lines';
import { wheel } from '../../render/car/p959/parts';
import { edgeUse, type Shell959 } from '../../render/car/p959/shell';
import { measure } from '../../render/car/p959/check';
import { buildN33ShellV3, V3 } from '../../render/car/n33/v3';
import { buildN33Shell, DIM } from '../../render/car/n33';

type V3d = [number, number, number];
const out = process.argv[2] ?? '.', FORM = process.argv.includes('form'), OLD = process.argv.includes('old'); mkdirSync(out, { recursive: true });
function png(path: string, w: number, h: number, rgb: Uint8Array) { const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) rgb.subarray(y * w * 3, (y + 1) * w * 3).forEach((v, i) => { raw[y * (w * 3 + 1) + 1 + i] = v; });
  const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }), crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cr]); };
  const hd = Buffer.alloc(13); hd.writeUInt32BE(w, 0); hd.writeUInt32BE(h, 4); hd[8] = 8; hd[9] = 2; writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hd), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }
const dot = (a: V3d, b: V3d) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], crs = (a: V3d, b: V3d): V3d => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], un = (a: V3d): V3d => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ---- the model: the shell with the gate's dark places for the lamps, the grille and the bumper's openings, the stock
//      glass, and four wheels of the real size (245/45 R17: radius 326, the rim's flange 232)
const S: Shell959 = OLD ? buildN33Shell({ glass: 'stock' }) : buildN33ShellV3({ glass: 'stock', face: true }), b = new Build(), nn: number[] = [];
emitShell(b, S, '#b9bdc3', nn);
const archR = OLD ? DIM.archR : V3.archR, rimR = OLD ? DIM.rimR : V3.rimR;
for (const s of [1, -1]) for (const [x, tr, front] of [[DIM.axleF, DIM.trackF, true], [DIM.axleR, DIM.trackR, false]] as const)
  wheel(b, { name: 'hub', o: [x, s * (tr / 2 + 122.5), DIM.hubZ], tyreR: DIM.tyreR, rimR, width: 245, archR, front }, 'n5', true);
const M: Mesh = b.mesh(DIM.length), NN = new Float32Array(nn), shellTris = nn.length / 9; M.lines = p959Lines(S, false) as MeshLine[];
const KIND_PAINT = KINDS.indexOf('paint'), KIND_GLASS = KINDS.indexOf('glass'), KIND_TYRE = KINDS.indexOf('tyre'), BG = [206, 202, 192];

// ---- cameras. A photograph's: the eye, the way it looks (yaw from the car's axis, pitch down, roll), the focal
//      length in the photograph's pixels. The car's visible side is -y in a photograph with its nose on the left.
interface Cam { w: number; h: number; pr: (p: V3d) => V3d; fwd: V3d }
interface Shot { name: string; w: number; h: number; p: number[]; marks: [V3d, [number, number]][]; /** taken from behind the car */ rear?: boolean }
const persp = (w: number, h: number, q: number[], k = 1): Cam => { const [ex, ey, ez, yaw, pitch, roll, lf] = q as [number, number, number, number, number, number, number], f = Math.exp(lf) * k;
  const fwd: V3d = [Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), -Math.sin(pitch)], r0 = un(crs(fwd, [0, 0, 1])), u0 = crs(r0, fwd), cr = Math.cos(roll), sr = Math.sin(roll);
  const right: V3d = [r0[0] * cr + u0[0] * sr, r0[1] * cr + u0[1] * sr, r0[2] * cr + u0[2] * sr], up: V3d = [u0[0] * cr - r0[0] * sr, u0[1] * cr - r0[1] * sr, u0[2] * cr - r0[2] * sr];
  return { w: w * k, h: h * k, fwd, pr: p => { const d: V3d = [p[0] - ex, p[1] - ey, p[2] - ez], z = Math.max(1, dot(d, fwd)); return [w * k / 2 + f * dot(d, right) / z, h * k / 2 - f * dot(d, up) / z, z]; } }; };
/** square on: the blueprint's views at k pixels a millimetre */
const ortho = (w: number, h: number, fwd: V3d, at: V3d, k: number): Cam => { const right = un(crs(fwd, [0, 0, 1])), up = crs(right, fwd); return { w, h, fwd, pr: p => { const d: V3d = [p[0] - at[0], p[1] - at[1], p[2] - at[2]]; return [w / 2 + dot(d, right) * k, h / 2 - dot(d, up) * k, dot(d, fwd) + 1e5]; } }; };
// the marks: a point of the car and where the photograph shows it (the photograph's pixels)
const marks = (s: number, m: [V3d, [number, number]][]): [V3d, [number, number]][] => m.map(([p, q]) => [[p[0], p[1] * s, p[2]], q]);
const wheelMarks = (x: number, y: number, r: number, m: { top?: [number, number]; bottom?: [number, number]; front?: [number, number]; rear?: [number, number] }): [V3d, [number, number]][] =>
  [[[x, y, DIM.hubZ + r], m.top], [[x, y, DIM.hubZ - r], m.bottom], [[x - r, y, DIM.hubZ], m.front], [[x + r, y, DIM.hubZ], m.rear]].filter(e => e[1]) as [V3d, [number, number]][];
const BADGE: V3d = [95, 0, 641], STN: V3d = [2100, 500, 1298], STF: V3d = [2100, -500, 1298];
const SHOTS: Shot[] = [
  // the museum car: its rims' flanges (radius 232) and the front tyre's foot and front
  { name: 'museum', w: 1280, h: 715, p: [-2501.3, -3095.2, 1265.8, 0.6519, 0.1388, 0.0372, 7.3506], marks: marks(-1, [...wheelMarks(950, 857, 232, { top: [757, 413], bottom: [742, 588], front: [710, 505], rear: [799, 490] }), ...wheelMarks(950, 862, 326, { bottom: [736, 613], front: [687, 512] }),
    ...wheelMarks(3670, 862, 232, { top: [1127, 330], bottom: [1118, 444], front: [1103, 395], rear: [1146, 387] }), [BADGE, [292, 372]], [STN, [873, 141]], [STF, [627, 137]]]) },
  // the car in the car park: its tyres' outlines (its wheels are not the stock ones)
  { name: 'silver_r', w: 2080, h: 1386, p: [-5076.0, 5723.0, 701.5, -0.6806, 0.0084, -0.0053, 8.3878], marks: marks(1, [...wheelMarks(950, 862, 326, { top: [1040, 692], bottom: [1035, 1048], front: [1150, 850], rear: [920, 870] }),
    ...wheelMarks(3670, 867, 326, { top: [270, 690], bottom: [275, 960], front: [322, 840], rear: [215, 830] }), [BADGE, [1731, 709]], [STN, [801, 356]], [STF, [1189, 368]]]) },
  // the blue car from behind: its rims' flanges and its four tail lamps' centres
  { name: 'rear_blue', w: 900, h: 600, rear: true, p: [7169.6, 1722.1, 1165.0, -2.7038, 0.1357, 0.0043, 7.1870], marks: marks(1, [...wheelMarks(3670, 862, 232, { top: [703, 343], bottom: [700, 518], front: [728, 425], rear: [685, 440] }), ...wheelMarks(950, 857, 232, { top: [857, 252], bottom: [853, 350] }),
    [[4583, 430, 815], [423, 275]], [[4565, 595, 815], [500, 280]], [[4583, -430, 815], [107, 253]], [[4565, -595, 815], [62, 248]], [[3262, 0, 1317], [495, 80]], [[4472, 558, 984], [481, 206]], [[4472, -558, 984], [75, 206]]]) },
];
if (process.argv.includes('fit')) for (const s of SHOTS) { if (process.argv.includes('fitrear') && !s.rear) continue; const err = (q: number[]) => { const c = persp(s.w, s.h, q); let e = 0; for (const [p, m] of s.marks) { const a = c.pr(p); e += (a[0] - m[0]) ** 2 + (a[1] - m[1]) ** 2; } return e; };
  // Nelder-Mead from a few starts round a guess (the eye ahead of the nose on the visible side, at head height)
  let best: number[] = [], be = Infinity; const side = s.marks[0]![0][1] < 0 ? -1 : 1;
  for (let st = 0; st < 40; st++) { const rnd = (a: number) => (Math.sin(st * 12.9898 + a * 78.233) * 43758.5453 % 1) * 2, e0: V3d = [(s.rear ? 8000 : -3000) + 1500 * rnd(1), side * (4500 + 1500 * rnd(2)), 1400 + 400 * rnd(3)], to: V3d = [1800 - e0[0], -e0[1], 600 - e0[2]], l = Math.hypot(...to);
    let x = [e0[0], e0[1], e0[2], Math.atan2(to[1], to[0]), -Math.asin(to[2] / l), 0, Math.log(s.w * (1 + 0.8 * rnd(4)))], sx: number[][] = [x, ...x.map((_, i) => x.map((v, j) => j === i ? v + (i < 3 ? 400 : 0.08) : v))];
    for (let it = 0; it < 4000; it++) { sx.sort((a, c) => err(a) - err(c)); const n = x.length, cen = x.map((_, j) => sx.slice(0, n).reduce((t, v) => t + v[j]!, 0) / n), w = sx[n]!, refl = cen.map((c, j) => 2 * c - w[j]!);
      if (err(refl) < err(sx[0]!)) { const ex = cen.map((c, j) => 3 * c - 2 * w[j]!); sx[n] = err(ex) < err(refl) ? ex : refl; } else if (err(refl) < err(sx[n - 1]!)) sx[n] = refl; else { const con = cen.map((c, j) => (c + w[j]!) / 2); if (err(con) < err(w)) sx[n] = con; else sx = sx.map((v, i) => i ? v.map((q, j) => (q + sx[0]![j]!) / 2) : v); } }
    x = sx[0]!; if (err(x) < be) { be = err(x); best = x; } }
  const c = persp(s.w, s.h, best); console.log(`${s.name}: p: [${best.map((v, i) => v.toFixed(i < 3 ? 1 : 4)).join(', ')}]  rms ${Math.sqrt(be / s.marks.length).toFixed(1)} px, focal ${Math.exp(best[6]!).toFixed(0)} px`);
  for (const [p, m] of s.marks) { const a = c.pr(p); console.log(`   ${p.map(v => Math.round(v)).join(' ')}: photo ${m.join(' ')}, model ${a[0].toFixed(0)} ${a[1].toFixed(0)}`); } s.p = best; }

// ---- the drawing: the game's manner in small (two tones, a dark line round the car and between its parts, the drawn
//      lines on top), at twice the size and halved
function draw(c: Cam, lines = true): Uint8Array { const SS = 2, w = Math.round(c.w), h = Math.round(c.h), W = w / SS | 0, H = h / SS | 0, fwd = c.fwd, right = un(crs(fwd, [0, 0, 1])), up = crs(right, fwd);
  const zb = new Float32Array(w * h).fill(Infinity), id = new Int16Array(w * h).fill(-1), img = new Float32Array(w * h * 3);
  const LK = [-0.5, 0.62, 0.5], light = un([right[0] * LK[0]! + up[0] * LK[1]! - fwd[0] * LK[2]!, right[1] * LK[0]! + up[1] * LK[1]! - fwd[1] * LK[2]!, right[2] * LK[0]! + up[2] * LK[1]! - fwd[2] * LK[2]!]);
  for (let t = 0; t < M.n; t++) { const q = [0, 1, 2].map(k => [M.pos[t * 9 + k * 3]!, M.pos[t * 9 + k * 3 + 1]!, M.pos[t * 9 + k * 3 + 2]!] as V3d), sc = q.map(c.pr), fnm = un(crs([q[1]![0] - q[0]![0], q[1]![1] - q[0]![1], q[1]![2] - q[0]![2]], [q[2]![0] - q[0]![0], q[2]![1] - q[0]![1], q[2]![2] - q[0]![2]]));
    const [A, B, C] = sc as [V3d, V3d, V3d], den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]); if (Math.abs(den) < 1e-9) continue;
    const ff: V3d = dot(fnm, fwd) > 0 ? [-fnm[0], -fnm[1], -fnm[2]] : fnm, ns = t < shellTris ? [0, 1, 2].map(k => [NN[t * 9 + k * 3]!, NN[t * 9 + k * 3 + 1]!, NN[t * 9 + k * 3 + 2]!] as V3d) : [ff, ff, ff], kind = M.kind[t]!, base: V3d = [M.col[t * 3]!, M.col[t * 3 + 1]!, M.col[t * 3 + 2]!];
    const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(w - 1, Math.ceil(Math.max(A[0], B[0], C[0]))), y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(h - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) { const X = px + 0.5, Y = py + 0.5, l0 = ((B[1] - C[1]) * (X - C[0]) + (C[0] - B[0]) * (Y - C[1])) / den, l1 = ((C[1] - A[1]) * (X - C[0]) + (A[0] - C[0]) * (Y - C[1])) / den, l2 = 1 - l0 - l1; if (l0 < -1e-5 || l1 < -1e-5 || l2 < -1e-5) continue;
      const d = 1 / (l0 / A[2] + l1 / B[2] + l2 / C[2]), zi = py * w + px; if (d >= zb[zi]!) continue; zb[zi] = d; id[zi] = M.part[t]!;
      const n = un([ns[0]![0] * l0 + ns[1]![0] * l1 + ns[2]![0] * l2, ns[0]![1] * l0 + ns[1]![1] * l1 + ns[2]![1] * l2, ns[0]![2] * l0 + ns[1]![2] * l1 + ns[2]![2] * l2]);
      const nl = dot(n, light), lit = FORM ? 0.15 + 0.85 * Math.max(0, nl) : Math.max(0, Math.min(1, (nl - 0.18) / 0.08));
      const sh: V3d = kind === KIND_GLASS ? [0.9, 0.95, 1] : FORM && kind === KIND_PAINT ? [0.35 + 0.65 * lit, 0.35 + 0.65 * lit, 0.37 + 0.63 * lit] : [0.56 + 0.44 * lit, 0.6 + 0.4 * lit, 0.68 + 0.32 * lit], g = kind === KIND_TYRE ? 0.9 : 1;
      for (let k = 0; k < 3; k++) img[zi * 3 + k] = Math.min(255, base[k]! * sh[k]! * g); } }
  const ink = (zi: number, a = 1) => { for (let k = 0; k < 3; k++) img[zi * 3 + k] = img[zi * 3 + k]! * (1 - a) + 22 * a; };
  for (let i = 0; i < w * h; i++) if (!Number.isFinite(zb[i]!)) { img[i * 3] = BG[0]!; img[i * 3 + 1] = BG[1]!; img[i * 3 + 2] = BG[2]!; }
  const mark = new Uint8Array(w * h);
  for (let py = 2; py < h - 2; py++) for (let px = 2; px < w - 2; px++) { const zi = py * w + px, z = zb[zi]!; if (!Number.isFinite(z)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const zj = zi + dy * w + dx, z2 = zb[zj]!; if (!Number.isFinite(z2) || z2 - z > 90) mark[zi] = 2; else if (id[zj] !== id[zi] && z <= z2 && !mark[zi]) mark[zi] = 1; } }
  for (let py = 3; py < h - 3; py++) for (let px = 3; px < w - 3; px++) { let m = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const v = mark[(py + dy) * w + px + dx]!; if (v === 2 && dx * dx + dy * dy <= 5) m = 2; else if (v === 1 && Math.abs(dx) + Math.abs(dy) <= 1 && !m) m = 1; } if (m) ink(py * w + px); }
  const seg = (a: V3d, b2: V3d, wpx: number, tol: number) => { const A = c.pr(a), B = c.pr(b2), n = Math.max(1, Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) * 1.5));
    for (let i = 0; i <= n; i++) { const t = i / n, x = A[0] + (B[0] - A[0]) * t, yv = A[1] + (B[1] - A[1]) * t, d = A[2] + (B[2] - A[2]) * t, r = wpx / 2;
      for (let py = Math.floor(yv - r); py <= Math.ceil(yv + r); py++) for (let px = Math.floor(x - r); px <= Math.ceil(x + r); px++) { if (px < 0 || py < 0 || px >= w || py >= h || Math.hypot(px + 0.5 - x, py + 0.5 - yv) > r) continue; const zi = py * w + px; if (d > zb[zi]! + tol) continue; ink(zi); } } };
  if (lines && M.lines) for (const l of M.lines) { const n = l.pts.length; for (let q = 0; q + 1 < n || (l.closed && q < n); q++) seg(l.pts[q]! as V3d, l.pts[(q + 1) % n]! as V3d, 2.6 * (l.w ?? 1), 18); }
  const o2 = new Uint8Array(W * H * 3); for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) for (let k = 0; k < 3; k++) { let s = 0; for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) s += img[((py * SS + dy) * w + px * SS + dx) * 3 + k]!; o2[(py * W + px) * 3 + k] = s / (SS * SS); }
  return o2; }

const tagName = OLD ? 'old' : FORM ? 'form' : 'v3';
for (const s of SHOTS) { const k = 2 * Math.min(1, 1300 / s.w), c = persp(s.w, s.h, s.p, k); png(`${out}/${tagName}_${s.name}.png`, Math.round(c.w) / 2 | 0, Math.round(c.h) / 2 | 0, draw(c)); }
// square on, for the blueprint (5.5 mm a pixel there; here twice that size, drawn at four times and halved): the front
// (the picture's centre on the car's centre line, the ground at its row 500) and the front of the side
png(`${out}/${tagName}_front.png`, 760, 560, draw(ortho(1520, 1120, [1, 0, 0], [0, 0, 605], 4 / 5.5)));
png(`${out}/${tagName}_side.png`, 1780, 560, draw(ortho(3560, 1120, [0, 1, 0], [(890 - 40) * 2.75, 0, 605], 4 / 5.5)));
png(`${out}/${tagName}_rear.png`, 760, 560, draw(ortho(1520, 1120, [-1, 0, 0], [0, 0, 605], 4 / 5.5)));

const use = [...edgeUse(S.F).values()], tris = (f: (t: (typeof S.tag)[number]) => boolean) => S.F.reduce((s, f2, k) => s + (f(S.tag[k]!) ? f2.length - 2 : 0), 0);
console.log(`cage: ${S.cage.P.length} points, ${S.cage.F.length} faces; shell: ${S.F.length} faces, ${tris(() => true)} triangles (front bumper ${tris(t => t.region === 'bumperF')}); edges open ${use.filter(u => u === 1).length}, over-used ${use.filter(u => u > 2).length}`);
if (process.argv.includes('report')) { const R = measure(S, []), front = (l: typeof R.mushy) => l.filter(e => e.at[0] < 1500); for (const e of R.unmarked.filter(u => u.at[0] >= 1500 && u.at[1] > 0)) console.log(`   rear ${e.panel} ${e.deg.toFixed(1)} deg at ${e.at.map(v => Math.round(v)).join(' ')}`);
  console.log(`paint edges (whole car): < 8 deg ${R.smooth}, 8-20 ${R.soft}, 20-35 not creased ${R.mushy.length}, >= 35 not creased ${R.unmarked.length}; slivers ${R.slivers}`);
  console.log(`front third (x < 1500): 20-35 not creased ${front(R.mushy).length}, >= 35 not creased ${front(R.unmarked).length}`);
  for (const e of [...front(R.mushy), ...front(R.unmarked)].sort((a, c) => c.deg - a.deg).slice(0, 40)) console.log(`   ${e.panel} ${e.deg.toFixed(1)} deg at ${e.at.map(v => Math.round(v)).join(' ')}`); }
