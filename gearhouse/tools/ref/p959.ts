// The 959's pictures (docs/systems/109): the shell drawn from the side, front, rear, top and three-quarter views, and
// the control cage as wires beside its subdivision.
//   npx tsx tools/ref/p959.ts <out dir> [mm=4]
// n33: the N33's lump "차체 B" instead (docs/systems/117 R1; glass=, dims= as for the 959's lump; masks against its blueprint)
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Build, KINDS } from '../../render/car/mesh';
import { plate, plateText } from '../../render/car/p959/parts';
import { p959Model, P959_LUMP, buildShell, shellSkin, fitPlate, type P959Opts } from '../../render/car/p959';
import type { Placed, FreeId } from '../../core/placed';
import { fitAll } from '../../render/car/attach';
import { stockParts, aimPart } from '../../render/car/attach/stock';
import { buildN33Shell, n33Skin } from '../../render/car/n33';
import { fineGrid, lineStat, measure, PANELS, turning } from '../../render/car/p959/check';
import { faceNormal } from '../../render/car/p959/subdiv';
import { edgeUse } from '../../render/car/p959/shell';
import { n33Model, N33_LUMP } from '../../render/car/n33';
import { joinMeshes, N33_CABIN } from '../../render/car/bodies';
import { interiorMesh, INTERIORS, TRIMS } from '../../render/car/interior';
import { N33_PANELS } from '../../render/car/n33/check';

const N33 = process.argv.includes('n33'), CAR = N33 ? 'n33' : 'p959', out = process.argv[2] ?? '.', mm = +(process.argv.find(a => a.startsWith('mm='))?.slice(3) ?? 4), W = Math.round((N33 ? 5400 : 4800) / mm), H = Math.round(3000 / mm), BG = [206, 202, 192];
mkdirSync(out, { recursive: true });
export function png(path: string, w: number, h: number, rgb: Uint8Array) { const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) rgb.subarray(y * w * 3, (y + 1) * w * 3).forEach((v, i) => { raw[y * (w * 3 + 1) + 1 + i] = v; });
  const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }), crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cr]); };
  const hd = Buffer.alloc(13); hd.writeUInt32BE(w, 0); hd.writeUInt32BE(h, 4); hd[8] = 8; hd[9] = 2; writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hd), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }
// ---- the drawing: the game's manner in small (two tones with a soft edge, one small highlight, a dark line round the
//      car and between its parts, the drawn lines on top), with the shell's own normals. Drawn at twice the size and halved.
type V3 = [number, number, number];
const FORM = process.argv.includes('form');   // continuous shading, to judge the forms (the default is the game's two tones)
// variants (docs/systems/109 S3): lamp=round|ellipsoid|square wheel=hollow5|dish|hole5 bf=std|aero|clean br=std|aero|clean; noplate=f|r|fr (plates off); at=x,y,z: the picture's centre; only=<view,...>
const arg = (k: string) => process.argv.find(a => a.startsWith(k + '='))?.slice(k.length + 1), AT = (arg('at') ?? (N33 ? '2340,0,650' : '2130,0,600')).split(',').map(Number) as V3, ONLY = arg('only')?.split(',');
// lump: the frame "차체 A" (docs/systems/115 F1) with any of the above put back; glass=none|stock|noQuarter|louvre; dims=wheelbase:150,width:-60,...
const DIMS = arg('dims') ? Object.fromEntries(arg('dims')!.split(',').map(kv => { const [k, v] = kv.split(':'); return [k!, +v!]; })) : undefined, given = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
// stockset: the 599's stock set as the builder puts it on since P2 (docs/systems/115): the openings flush, the lamps' sockets painted, the
// small parts and the openings as placed parts (with parts=stock)
const OPTS: P959Opts = ({ ...(process.argv.includes('lump') ? P959_LUMP : {}), ...(process.argv.includes('stockset') ? { lamp: 'none', openings: false, smalls: false } as P959Opts : {}), ...given({ lamp: arg('lamp') as never, wheel: arg('wheel') as never, bumperF: arg('bf') as never, bumperR: arg('br') as never, plate: arg('plate') ? plateText(arg('plate')!) : undefined }),
  ...(arg('noplate') !== undefined || !process.argv.includes('lump') ? { plateF: !arg('noplate')?.includes('f'), plateR: !arg('noplate')?.includes('r') } : {}), ...(arg('glass') ? { glass: arg('glass') === 'none' ? null : arg('glass') as never } : {}), ...(DIMS ? { dims: DIMS } : {}) });
// placed=F:y,z,rot,tilt,scale/R:y,z,rot,tilt,scale (docs/systems/115 P1a): the plates placed freely, each at the skin met by a ray along the car's axis at (y, z)
const PLACED: Placed[] | undefined = arg('placed') ? (() => { const sk = shellSkin(buildShell({ ...OPTS, lamps: OPTS.lamp !== 'none' })); return arg('placed')!.split('/').map(e => { const [w, v] = e.split(':'), [y, z, rot, tilt, sc] = v!.split(',').map(Number), F = w === 'F';
  const h = sk.hit([F ? -800 : 5200, y!, z!], [F ? 1 : -1, 0, 0], 8000)!, p: Placed = { id: F ? 'plateF' : 'plateR', at: h.at!, rot: rot ?? 0, tilt: tilt ?? 0, scale: sc ?? 1 }, f = fitPlate(sk, p);
  console.log(`${p.id} at y ${y} z ${z}: ${f?.ok ? 'ok' : f?.why}, bracket ${f?.gap.toFixed(0)} mm`); return p; }); })() : undefined;
// parts=stock|odd (docs/systems/115 P1): the free surface parts, the lump's stock set or a set placed unusually (a GT wing on
// the roof, mirrors on the rear wings, a big turned crest on the door, louvres on the bonnet, vents, markers, a centre tip)
const PARTS: Placed[] | undefined = arg('parts') ? (() => { const sk = N33 ? n33Skin(buildN33Shell({ ...N33_LUMP, ...(DIMS ? { dims: DIMS } : {}) })) : shellSkin(buildShell({ ...OPTS, lamps: OPTS.lamp !== 'none' })), base = N33 ? 'bnr33' : 'p959';
  if (arg('parts') === 'stock') return stockParts(base, sk, DIMS);
  // parts=holes (docs/systems/115 P2): the hole parts placed unusually (projector lamps on the rear wings, square lamps on the
  // bonnet, round tail lamps in the nose, a grille on the bonnet, intakes behind the front wheels, a louvre in the roof, cut
  // vents in the doors, the tail lamp band low across the rear bumper's seam)
  if (arg('parts') === 'holes') { const L = N33 ? 4675 : 4260, H = N33 ? 1364 : 1281, a = (id: FreeId, o: V3, d: V3, x: Partial<Placed> = {}): Placed[] => { const p = aimPart(sk, { id, o, d }); return p ? [{ ...p, ...x }] : []; };
    const ps = [...a('lampEllipsoid', [L * 0.8, 1600, H * 0.6], [0, -1, 0], { scale: 0.7, sx: 1.3 }), ...a('lampSquare', [L * 0.13, 330, 3000], [0, 0, -1], { scale: 0.55, sx: 2 }), ...a('tailRound', [-600, 420, H * 0.33], [1, 0, 0]),
      ...a('grille', [L * 0.22, 0, 3000], [0, 0, -1], { scale: 0.55, sx: 1.2 }), ...a('sideIntake', [L * 0.29, 1600, H * 0.52], [0, -1, 0], { scale: 0.9 }), ...a('louvreCut', [L * 0.5, 0, 3000], [0, 0, -1], { scale: 1.1 }),
      ...a('ventCut', [L * 0.47, 1600, H * 0.4], [0, -1, 0], { rot: 15 }), ...a('tailBand', [L + 600, 0, H * 0.33], [-1, 0, 0], { scale: 0.8 })];
    const fs = fitAll(sk, ps); for (const f of fs) console.log(`${f.key}: ${f.ok ? 'ok' : f.why}${f.warn ? ' (' + f.warn + ')' : ''}, insides ${f.mesh.n}${f.twin ? ' x2' : ''}`); return ps; }
  const L = N33 ? 4675 : 4260, H = N33 ? 1364 : 1281, a = (id: FreeId, o: V3, d: V3, x: Partial<Placed> = {}): Placed[] => { const p = aimPart(sk, { id, o, d }); return p ? [{ ...p, ...x }] : []; };
  const ps = [...a('wingGT', [L * 0.52, 0, 3000], [0, 0, -1], { scale: 0.75, depth: 120, tilt: 12 }), ...a('mirror', [L * 0.78, 1600, H * 0.62], [0, -1, 0], { scale: 1.3, depth: 80, rot: 15 }),
    ...a('badge', [L * 0.5, 1600, H * 0.5], [0, -1, 0], { scale: 2.2, rot: 25 }), ...a('louvre', [L * 0.17, 0, 3000], [0, 0, -1], { scale: 1.1 }), ...a('vent', [L * 0.86, N33 ? 640 : 600, 3000], [0, 0, -1], { scale: 0.8 }),
    ...a('marker', [-500, 600, H * 0.33], [1, 0, 0], { scale: 1.2, rot: -20 }), ...a('exhaust1', [L + 600, 0, H * 0.45], [-1, 0, 0], { scale: 1.4, depth: 50 }), ...a('wingRing', [L * (N33 ? 0.91 : 0.95), 0, 3000], [0, 0, -1], { scale: N33 ? 0.85 : 0.8, depth: 220, tilt: 10, n: 0 })];
  const fs = fitAll(sk, ps); for (const f of fs) console.log(`${f.key}: ${f.ok ? 'ok' : f.why}${f.warn ? ' (' + f.warn + ')' : ''}, ${f.mesh.n} triangles${f.twin ? ' x2' : ''}`); return ps; })() : undefined;
const MODEL0 = N33 ? n33Model({ ...N33_LUMP, ...given({ wheel: arg('wheel') as never }), ...(process.argv.includes('plates33') ? { plateF: true, plateR: true } : {}), ...(PARTS ? { placed: PARTS } : {}), ...(arg('glass') ? { glass: arg('glass') === 'none' ? null : arg('glass') as never } : {}), ...(DIMS ? { dims: DIMS } : {}), ...(arg('paint') ? { paint: arg('paint') } : {}) }) : p959Model({ ...OPTS, ...(PLACED || PARTS ? { placed: [...(PLACED ?? []), ...(PARTS ?? [])] } : {}) });
// cabin=n33Stock|n33Sport[:trim] (the N33's interior sets in its cabin, docs/systems/117 R2); cut=<z>: the shell's triangles above z left out (to see in)
const CAB = N33 && arg('cabin') ? arg('cabin')!.split(':') : null, CUT = arg('cut') ? +arg('cut')! : Infinity;
const MODEL = CAB ? { ...MODEL0, mesh: joinMeshes(MODEL0.mesh.length, MODEL0.mesh, interiorMesh({ ...INTERIORS[CAB[0] as 'n33Stock'], ...(CAB[1] ? { trim: CAB[1] as 'tan', ...(CAB[0] === 'n33Sport' ? { bucketColour: TRIMS[CAB[1] as 'tan'].seat } : {}) } : {}), cabin: N33_CABIN, length: MODEL0.mesh.length })) } : MODEL0, S = MODEL.shell, NN = MODEL.normals;
// plates=<a,b,...>: a sheet of number plates face on (two columns), instead of the car
const PLATES = arg('plates')?.split(','), M = PLATES ? (() => { const b = new Build(); PLATES.forEach((t, k) => plate(b, { name: 'plate', o: [0, (k % 2 ? -1 : 1) * 200, 420 - Math.floor(k / 2) * 215], n: [-1, 0, 0], w: 335, h: 170 }, /^\d+$/.test(t) ? plateText(+t) : plateText(t))); return b.mesh(0); })() : MODEL.mesh, shellTris = PLATES ? 0 : MODEL.shellTris;
// mirror=0 to draw the file's own axes; by default the car is drawn as the game draws it (+y on the left of the heading,
// render/live/gpu.ts placeMesh), so plates and anything one-sided read as they do in the game
const MIRRORED = arg('mirror') !== '0';
if (MIRRORED) { for (let i = 1; i < M.pos.length; i += 3) M.pos[i] = -M.pos[i]!; for (let i = 1; i < NN.length; i += 3) NN[i] = -NN[i]!; }
const KIND_PAINT = KINDS.indexOf('paint'), KIND_GLASS = KINDS.indexOf('glass'), KIND_TYRE = KINDS.indexOf('tyre');
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], crs = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], un = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
interface DrawO { wires?: { P: V3[]; F: number[][] }; lines?: boolean; mesh?: boolean }
function flat(yawDeg: number, pitchDeg: number, o: DrawO = {}): Uint8Array { const SS = 2, w = W * SS, h = H * SS, k = mm / SS, y = yawDeg * Math.PI / 180, p = pitchDeg * Math.PI / 180;
  // yaw 0: the car's left side, nose to the left; the eye looks along fwd
  const fwd: V3 = [Math.sin(y) * Math.cos(p), Math.cos(y) * Math.cos(p), -Math.sin(p)], right: V3 = un(crs(fwd, [0, 0, 1])), up = crs(right, fwd), cx = AT[0], cz = AT[2];
  const pr = (a: V3): V3 => { const q: V3 = [a[0] - cx, a[1] - AT[1], a[2] - cz]; return [w / 2 + dot(q, right) / k, h * 0.5 - dot(q, up) / k, dot(q, fwd)]; };
  const zb = new Float32Array(w * h).fill(Infinity), id = new Int16Array(w * h).fill(-1), img = new Float32Array(w * h * 3);
  const LK = [-0.5, 0.62, 0.5], light = un([right[0] * LK[0]! + up[0] * LK[1]! - fwd[0] * LK[2]!, right[1] * LK[0]! + up[1] * LK[1]! - fwd[1] * LK[2]!, right[2] * LK[0]! + up[2] * LK[1]! - fwd[2] * LK[2]!]), half = un([light[0] - fwd[0], light[1] - fwd[1], light[2] - fwd[2]]);
  if (o.mesh !== false) for (let t = 0; t < M.n; t++) { const q = [0, 1, 2].map(c => [M.pos[t * 9 + c * 3]!, M.pos[t * 9 + c * 3 + 1]!, M.pos[t * 9 + c * 3 + 2]!] as V3), sc = q.map(pr), fnm = un(crs([q[1]![0] - q[0]![0], q[1]![1] - q[0]![1], q[1]![2] - q[0]![2]], [q[2]![0] - q[0]![0], q[2]![1] - q[0]![1], q[2]![2] - q[0]![2]]));
    if (t < shellTris && (MIRRORED ? -1 : 1) * dot(fnm, fwd) > 0.02) continue;   // the shell's back faces (mirrored, its winding runs the other way)
    if (t < shellTris && Math.max(q[0]![2], q[1]![2], q[2]![2]) > CUT) continue;
    const ff: V3 = dot(fnm, fwd) > 0 ? [-fnm[0], -fnm[1], -fnm[2]] : fnm, ns = t < shellTris ? [0, 1, 2].map(c => [NN[t * 9 + c * 3]!, NN[t * 9 + c * 3 + 1]!, NN[t * 9 + c * 3 + 2]!] as V3) : [ff, ff, ff], kind = M.kind[t]!, base: V3 = [M.col[t * 3]!, M.col[t * 3 + 1]!, M.col[t * 3 + 2]!];
    const [A, B, C] = sc as [V3, V3, V3], den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]); if (Math.abs(den) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(w - 1, Math.ceil(Math.max(A[0], B[0], C[0]))), y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(h - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) { const X = px + 0.5, Y = py + 0.5, l0 = ((B[1] - C[1]) * (X - C[0]) + (C[0] - B[0]) * (Y - C[1])) / den, l1 = ((C[1] - A[1]) * (X - C[0]) + (A[0] - C[0]) * (Y - C[1])) / den, l2 = 1 - l0 - l1; if (l0 < -1e-5 || l1 < -1e-5 || l2 < -1e-5) continue;
      const d = l0 * A[2] + l1 * B[2] + l2 * C[2], zi = py * w + px; if (d >= zb[zi]!) continue; zb[zi] = d; id[zi] = M.part[t]!;
      const n = un([ns[0]![0] * l0 + ns[1]![0] * l1 + ns[2]![0] * l2, ns[0]![1] * l0 + ns[1]![1] * l1 + ns[2]![1] * l2, ns[0]![2] * l0 + ns[1]![2] * l1 + ns[2]![2] * l2]);
      const nl = dot(n, light), lit = FORM ? Math.max(0, nl) ** 1.5 : Math.max(0, Math.min(1, (nl - 0.18) / 0.08)), sp = kind === KIND_PAINT || kind === KIND_GLASS ? Math.max(0, Math.min(1, (Math.pow(Math.max(0, dot(n, half)), 90) - 0.5) / 0.15)) : 0;
      const sh: V3 = kind === KIND_GLASS ? [0.9, 0.95, 1] : [0.56 + 0.44 * lit, 0.6 + 0.4 * lit, 0.68 + 0.32 * lit], g = kind === KIND_TYRE ? 0.9 : 1;
      for (let c = 0; c < 3; c++) img[zi * 3 + c] = Math.min(255, base[c]! * sh[c]! * g + sp * 90); } }
  const ink = (zi: number, a = 1) => { for (let c = 0; c < 3; c++) img[zi * 3 + c] = img[zi * 3 + c]! * (1 - a) + 22 * a; };
  const bgc = (zi: number) => !Number.isFinite(zb[zi]!);
  for (let i = 0; i < w * h; i++) if (bgc(i)) { img[i * 3] = BG[0]!; img[i * 3 + 1] = BG[1]!; img[i * 3 + 2] = BG[2]!; }
  // the line round the car (3 px at this size) and between parts (2 px)
  const mark = new Uint8Array(w * h);
  for (let py = 2; py < h - 2; py++) for (let px = 2; px < w - 2; px++) { const zi = py * w + px, z = zb[zi]!; if (!Number.isFinite(z)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const zj = zi + dy * w + dx, z2 = zb[zj]!; if (!Number.isFinite(z2) || z2 - z > 90) mark[zi] = 2; else if (id[zj] !== id[zi] && z <= z2 && !mark[zi]) mark[zi] = 1; } }
  for (let py = 3; py < h - 3; py++) for (let px = 3; px < w - 3; px++) { let m = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const v = mark[(py + dy) * w + px + dx]!; if (v === 2 && dx * dx + dy * dy <= 5) m = 2; else if (v === 1 && Math.abs(dx) + Math.abs(dy) <= 1 && !m) m = 1; } if (m) ink(py * w + px); }
  const seg = (a: V3, b: V3, wpx: number, tol: number, col?: V3) => { const A = pr(a), B = pr(b), n = Math.max(1, Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) * 1.5));
    for (let i = 0; i <= n; i++) { const t = i / n, x = A[0] + (B[0] - A[0]) * t, yv = A[1] + (B[1] - A[1]) * t, d = A[2] + (B[2] - A[2]) * t, r = wpx / 2;
      for (let py = Math.floor(yv - r); py <= Math.ceil(yv + r); py++) for (let px = Math.floor(x - r); px <= Math.ceil(x + r); px++) { if (px < 0 || py < 0 || px >= w || py >= h || Math.hypot(px + 0.5 - x, py + 0.5 - yv) > r) continue; const zi = py * w + px; if (d > zb[zi]! + tol) continue;
        if (col) { img[zi * 3] = col[0]; img[zi * 3 + 1] = col[1]; img[zi * 3 + 2] = col[2]; } else ink(zi); } } };
  if (o.lines !== false && M.lines) for (const l of M.lines) { const n = l.pts.length; for (let q = 0; q + 1 < n || (l.closed && q < n); q++) if (Math.max(l.pts[q]![2], l.pts[(q + 1) % n]![2]) <= CUT) seg(l.pts[q]! as V3, l.pts[(q + 1) % n]! as V3, 3 * (l.w ?? 1), 18); }
  if (o.wires) for (const f of o.wires.F) f.forEach((a, q) => { const b = f[(q + 1) % f.length]!; if (a < b || !f.includes(b)) seg(o.wires!.P[a]!, o.wires!.P[b]!, 2, o.mesh === false ? 1e9 : 30, [20, 60, 170]); });
  const out2 = new Uint8Array(W * H * 3); for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) for (let c = 0; c < 3; c++) { let s = 0; for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) s += img[((py * SS + dy) * w + px * SS + dx) * 3 + c]!; out2[(py * W + px) * 3 + c] = s / (SS * SS); }
  return out2; }
const VIEWS: Record<string, [number, number]> = { side: [0, 0], front: [90, 0], rear: [270, 0], top: [0, 89.9], front34: [35, 20], rear34: [215, 20], high34: [40, 40], rearhigh: [220, 42] };
// view=<name>:<yaw>:<pitch>[,...]: more views (a photograph's angle), drawn when only= names them
for (const v of arg('view')?.split(',') ?? []) { const [n, y, p] = v.split(':'); VIEWS[n!] = [+y!, +p!]; }
for (const [n, [yaw, pitch]] of Object.entries(VIEWS)) if (!ONLY || ONLY.includes(n)) png(`${out}/${CAR}_${n}.png`, W, H, flat(yaw, pitch));
if (!ONLY) { png(`${out}/${CAR}_cage_front34.png`, W, H, flat(35, 20, { wires: S.cage, mesh: false })); png(`${out}/${CAR}_cage_rear34.png`, W, H, flat(215, 20, { wires: S.cage, mesh: false }));
png(`${out}/${CAR}_wire_front34.png`, W, H, flat(35, 20, { wires: S, lines: false })); }
const use = [...edgeUse(S.F).values()], count = (f: (t: (typeof S.tag)[number]) => boolean) => S.F.reduce((s, f2, k) => s + (f(S.tag[k]!) ? f2.length - 2 : 0), 0);
console.log(`cage: ${S.cage.P.length} points, ${S.cage.F.length} faces; shell: ${S.P.length} points, ${S.F.length} faces`);
console.log(`triangles: all ${count(() => true)}; shell region ${count(t => t.region === 'shell')} (paint ${count(t => t.region === 'shell' && t.mat === 'paint')}, glass ${count(t => t.mat === 'glass')}, wells+floor ${count(t => t.panel === 'wheelWell' || t.panel === 'floor')}), tail ${count(t => t.region === 'tail')}, bumpers ${count(t => t.region === 'bumperF')} + ${count(t => t.region === 'bumperR')}`);
console.log(`edges: ${use.length}, open ${use.filter(u => u === 1).length}, over-used ${use.filter(u => u > 2).length}; mesh ${M.n} triangles`);

// ---- the silhouettes laid over the blueprint (docs/reference/959/bp_canepa_4view.jpg), at twice its scale: a mask per
//      view in the blueprint's own frame (side: x along, z up; plan: x along, y across; front: y across, z up)
if (process.argv.includes('masks')) { const K = 4260 / 730 / 2;
  const mask = (w: number, h: number, pr: (x: number, y: number, z: number) => [number, number], keep: (p: number[]) => boolean = () => true) => { const m = new Uint8Array(w * h * 3).fill(255), p = M.pos;
    for (let t = 0; t < M.n; t++) { const q = [0, 1, 2].map(k => pr(p[t * 9 + k * 3]!, p[t * 9 + k * 3 + 1]!, p[t * 9 + k * 3 + 2]!)), [A, B, C] = q as [[number, number], [number, number], [number, number]];
      const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(w - 1, Math.ceil(Math.max(A[0], B[0], C[0]))), y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(h - 1, Math.ceil(Math.max(A[1], B[1], C[1]))), den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]); if (Math.abs(den) < 1e-9) continue;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const X = x + 0.5, Y = y + 0.5, l0 = ((B[1] - C[1]) * (X - C[0]) + (C[0] - B[0]) * (Y - C[1])) / den, l1 = ((C[1] - A[1]) * (X - C[0]) + (A[0] - C[0]) * (Y - C[1])) / den; if (l0 < 0 || l1 < 0 || l0 + l1 > 1) continue; m[(y * w + x) * 3] = m[(y * w + x) * 3 + 1] = m[(y * w + x) * 3 + 2] = 0; } }
    for (const l of M.lines ?? []) { const n = l.pts.length; for (let q = 0; q + 1 < n || (l.closed && q < n); q++) { const a = l.pts[q]!, b = l.pts[(q + 1) % n]!; if (!keep(a) || !keep(b)) continue; const A = pr(a[0], a[1], a[2]), B = pr(b[0], b[1], b[2]), st = Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]));
      for (let i = 0; i <= st; i++) { const x = Math.round(A[0] + (B[0] - A[0]) * i / Math.max(1, st)), y = Math.round(A[1] + (B[1] - A[1]) * i / Math.max(1, st)); if (x >= 0 && y >= 0 && x < w && y < h) { m[(y * w + x) * 3] = 128; m[(y * w + x) * 3 + 1] = 0; m[(y * w + x) * 3 + 2] = 0; } } } }
    return m; };
  if (N33) { const k = 5.5 / 2, ky = 5.5 * 1.037 / 2, kf = 5.5 * 0.957 / 2;   // the N33's blueprint: 5.5 mm a pixel along and up; its plan 3.7 % narrow and its front 4.3 % wide against the car's 1,780 (docs/systems/117 R0)
    png(`${out}/mask_side.png`, 1780, 560, mask(1780, 560, (x, _y, z) => [40 + x / k, 500 - z / k], p => p[1]! >= 0));
    png(`${out}/mask_plan.png`, 1780, 760, mask(1780, 760, (x, y) => [40 + x / k, 380 - y / ky]));
    png(`${out}/mask_front.png`, 760, 560, mask(760, 560, (_x, y, z) => [380 + y / kf, 500 - z / k], p => p[0]! < 2000));
    png(`${out}/mask_rear.png`, 760, 560, mask(760, 560, (_x, y, z) => [380 + y / kf, 500 - z / k], p => p[0]! > 3000)); } else {
  png(`${out}/mask_side.png`, 1640, 560, mask(1640, 560, (x, _y, z) => [40 + x / K, 500 - z / K], p => p[1]! >= 0));
  png(`${out}/mask_plan.png`, 1640, 760, mask(1640, 760, (x, y) => [40 + x / K, 380 - y / (1840 / 319 / 2)]));
  png(`${out}/mask_front.png`, 760, 560, mask(760, 560, (_x, y, z) => [380 + y / K, 500 - z / K], p => p[0]! < 1700));
  png(`${out}/mask_rear.png`, 760, 560, mask(760, 560, (_x, y, z) => [380 + y / K, 500 - z / K], p => p[0]! > 2800)); } }

if (process.argv.includes('report')) { const R = measure(S, N33 ? N33_PANELS : undefined);
  for (const p of R.panels) console.log(`${p.panel.name.padEnd(20)} lines ${String(p.lines).padStart(3)}  sign changes across ${p.across} (allowed ${p.panel.across ?? 0}) along ${p.along} (allowed ${p.panel.along ?? 0})  dimples ${p.dimples}  twist p95 ${p.twistP95.toFixed(1)} max ${p.twistMax.toFixed(1)}  off plane ${p.off.toFixed(1)} mm${p.panel.flat ? ' (flat)' : ''}`);
  console.log(`paint edges: < 8 deg ${R.smooth}, 8-20 ${R.soft}, 20-35 not creased ${R.mushy.length}, >= 35 not creased ${R.unmarked.length}; slivers ${R.slivers}`);
  const by = (l: typeof R.mushy) => { const m = new Map<string, number>(); for (const e of l) m.set(e.panel, (m.get(e.panel) ?? 0) + 1); return [...m].map(([k, v]) => `${k} ${v}`).join(', '); };
  console.log(`  20-35 by panel: ${by(R.mushy)}\n  >=35 by panel: ${by(R.unmarked)}`);
  for (const e of [...R.mushy, ...R.unmarked].sort((a, b) => b.deg - a.deg).slice(0, 60)) console.log(`   ${e.panel} ${e.deg.toFixed(1)} deg at ${e.at.map(v => Math.round(v)).join(' ')}`); }

// debug=<panel name start>: every line of that panel whose curvature changes sign, with its turning at each point
{ const dbg = process.argv.find(a => a.startsWith('debug='))?.slice(6); if (dbg) { const G = fineGrid(S), P = S.P, vn: V3[] = P.map(() => [0, 0, 0] as V3); S.F.forEach(f => { const n = faceNormal(P, f); for (const v of f) { vn[v]![0] += n[0]; vn[v]![1] += n[1]; vn[v]![2] += n[2]; } });
  for (const p of (N33 ? N33_PANELS : PANELS).filter(q => q.name.startsWith(dbg))) { const line = (idx: number[], label: string, allow: number) => { const vs = idx.filter(v => v >= 0); if (vs.length < 4 || vs.length !== idx.length) return; const pts = vs.map(v => P[v]!), st = lineStat(pts, vs.map(v => un(vn[v]!))); if (st.changes <= allow && !st.dimples) return;
      console.log(`${p.name} ${label}: changes ${st.changes} dimples ${st.dimples}  k = ${turning(pts, vs.map(v => un(vn[v]!))).map(v => v.toFixed(1)).join(' ')}`); };
    for (let j = p.cols[0] * 2; j <= p.cols[1] * 2; j++) line(Array.from({ length: (p.rows[1] - p.rows[0]) * 2 + 1 }, (_, k) => G[p.rows[0] * 2 + k]![j]!), `along col ${j / 2}`, p.along ?? 0);
    for (let i = p.rows[0] * 2; i <= p.rows[1] * 2; i++) line(Array.from({ length: (p.cols[1] - p.cols[0]) * 2 + 1 }, (_, k) => G[i]![p.cols[0] * 2 + k]!), `across row ${i / 2}`, p.across ?? 0); } } }
