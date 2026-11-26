// The face's slots (alpha 0.12, E2; render/car/face.ts) looked at and checked: grids of face combinations on each base
// (the front three-quarter and the front view), and, with `all`, every combination the rules allow on every base put
// through the seam check, lamps down and up (the tests sample these: tests/car_face.test.ts).
//   npx tsx tools/ref/face.ts <out dir> [mm=6] [all] [base=nsx]
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { drawMesh, type Mesh } from '../../render/car/mesh';
import { assemble } from '../../render/car/kit/assemble';
import { seamCheck } from '../../render/car/kit/check';
import { designKit } from '../../render/car/design';
import { AUXES, BASES, BUMPERS, DESIGN_EB110, DESIGN_F355, DESIGN_NSX, FACE_OWN, GRILLES, HEADS, NOSES, PODS, faceLock, FACE_KEYS, type BaseId, type Design, type Face, type NoseKind } from '../../core/design';

const out = process.argv[2] ?? '.', arg = (k: string) => process.argv.find(a => a.startsWith(k + '='))?.slice(k.length + 1), mm = +(arg('mm') ?? 6), only = arg('base');
const W = Math.round(3000 / mm), H = Math.round(1700 / mm), BG = [196, 190, 174];
mkdirSync(out, { recursive: true });
function png(path: string, w: number, h: number, rgb: Uint8Array) { const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) rgb.subarray(y * w * 3, (y + 1) * w * 3).forEach((v, i) => { raw[y * (w * 3 + 1) + 1 + i] = v; });
  const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }), crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cr]); };
  const hd = Buffer.alloc(13); hd.writeUInt32BE(w, 0); hd.writeUInt32BE(h, 4); hd[8] = 8; hd[9] = 2; writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hd), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }
/** the nose in a picture: the car drawn large, the picture's window on its front */
function flat(M: Mesh, yaw: number, pitch: number, cx: number, zoom = 1): Uint8Array { const FW = Math.round(5400 / mm * zoom), FH = Math.round(2700 / mm * zoom), p = drawMesh(M, yaw, pitch, mm / zoom, FW, FH, { outline: 2, glass: 0.7, cy: 0.6 }), o = new Uint8Array(W * H * 3), x0 = Math.round((FW - W) * cx), y0 = Math.round((FH - H) * (zoom > 1 ? 0.5 : 0.62));   // the front view: the bumper's lip to the bonnet's lamps
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y0 + y) * FW + x0 + x, a = p.rgba[i * 4 + 3]! / 255; for (let q = 0; q < 3; q++) o[(y * W + x) * 3 + q] = BG[q]! * (1 - a) + p.rgba[i * 4 + q]! * a; } return o; }
function sheet(pics: Uint8Array[], cols: number): { w: number; h: number; rgb: Uint8Array } { const rows = Math.ceil(pics.length / cols), o = new Uint8Array(W * cols * H * rows * 3).fill(BG[0]!);
  pics.forEach((p, k) => { const cx = k % cols, cy = Math.floor(k / cols); for (let y = 0; y < H; y++) o.set(p.subarray(y * W * 3, (y + 1) * W * 3), ((cy * H + y) * W * cols + cx * W) * 3); }); return { w: W * cols, h: H * rows, rgb: o }; }
const own = (b: BaseId) => ({ nsx: DESIGN_NSX, f355: DESIGN_F355, eb110: DESIGN_EB110 })[b];
type Fc = Partial<Face> & { nose?: NoseKind };
const made = (b: BaseId, f: Fc): Design => ({ ...own(b), body: { ...own(b).body, ...f } });
const mesh = (d: Design, lamps = 0) => { const { kit, tweak } = designKit(d, 0); return assemble(kit, { lamps, tweak }); };
const bad = (d: Design, lamps: number): string => { const r = seamCheck(mesh(d, lamps)); return r.open.length || r.nonManifold.length || r.duplicates || r.overlaps ? `open ${r.open.length} (${r.open.slice(0, 2).map(e => `${e.names} ${e.a.map(Math.round)}`).join('; ')}) nonManifold ${r.nonManifold.length} dup ${r.duplicates} overlaps ${r.overlaps}` : ''; };
const label = (f: Fc) => [f.nose, ...FACE_KEYS.map(k => f[k])].filter(Boolean).join(' ');

const bases = BASES.filter(b => !only || b === only);
if (process.argv.includes('all')) for (const b of bases) { const t0 = Date.now(); let n = 0, fails = 0;
  for (const nose of NOSES) for (const bumper of BUMPERS) for (const grille of GRILLES) for (const head of HEADS) for (const pod of PODS) for (const aux of AUXES) {
    const d = made(b, { nose, bumper, grille, head, pod, aux }); if (FACE_KEYS.some(k => faceLock(d.body, k, d.body[k]))) continue;
    for (const lamps of [0, 1]) { n++; let e = ''; try { e = bad(d, lamps); } catch (x) { e = String(x); } if (e) { fails++; if (fails < 25) console.log(`${b} ${label(d.body)} lamps ${lamps}: ${e}`); } } }
  console.log(`${b}: ${n} builds, ${fails} not closed, ${((Date.now() - t0) / 1000).toFixed(1)} s`); }

// ---- the pictures: each slot's values on each base (the other slots the base's own), then mixed faces ----
const GRID: [string, (b: BaseId) => Fc[]][] = [
  ['bumper', b => NOSES.flatMap(nose => BUMPERS.map(bumper => ({ nose, bumper })))],
  ['grille', b => BUMPERS.flatMap(bumper => GRILLES.map(grille => ({ bumper, grille, aux: grille === 'mesh' && FACE_OWN[b].aux === 'round' ? 'strip' as const : FACE_OWN[b].aux })))],
  ['lamps', b => [...HEADS.flatMap(head => PODS.map(pod => ({ head, pod }))), ...AUXES.map(aux => ({ aux })), ...AUXES.map(aux => ({ aux, bumper: BUMPERS[(BUMPERS.indexOf(FACE_OWN[b].bumper) + 1) % 4]! }))]],
];
if (!process.argv.includes('nopics')) for (const b of bases) for (const [name, list] of GRID) for (const [view, yaw, pitch, cx, zoom] of [['34', 52, 16, 0.3, 1], ['front', 90, 4, 0.5, 1.5]] as const) {
  const fs = list(b), cols = name === 'bumper' ? 4 : name === 'grille' ? 5 : 5;
  const pics = fs.map(f => { const d = made(b, f); return flat(mesh(d, f.head === 'popup' || (!f.head && FACE_OWN[b].head === 'popup' && name === 'lamps') ? 1 : 0).mesh, yaw, pitch, cx, zoom); });
  const s = sheet(pics, cols); png(`${out}/face_${b}_${name}_${view}.png`, s.w, s.h, s.rgb); console.log(`${out}/face_${b}_${name}_${view}.png: ${fs.map(label).join(' | ')}`); }
