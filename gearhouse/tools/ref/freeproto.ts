// The free body prototype's pictures (docs/systems/106): the four presets, two blends, a body joined from pieces of
// three cars, the same fixtures on three silhouettes, one fixture dragged to three places; offline, by drawMesh.
//   npx tsx tools/ref/freeproto.ts <out dir> [mm=6] [only=<name>]
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { drawMesh, type Mesh } from '../../render/car/mesh';
import { buildFree, type FreeCar } from '../../render/car/free/build';
import { blend, joinPieces, pieceOf, dragCurve } from '../../render/car/free/curves';
import { CANOPY, COKE, LONGTAIL, WEDGE } from '../../render/car/free/presets';
import { FIXTURE_SET, EB110_LAMP, NSX_DUCT, F355_TAIL_LAMPS, REAR_WING } from '../../render/car/free/library';
import type { Placed } from '../../render/car/free/fixture';

const out = process.argv[2] ?? '.', mm = +(process.argv.find(a => a.startsWith('mm='))?.slice(3) ?? 6), only = process.argv.find(a => a.startsWith('only='))?.slice(5);
const W = Math.round(5600 / mm), H = Math.round(2900 / mm), BG = [202, 196, 182];
mkdirSync(out, { recursive: true });
function png(path: string, w: number, h: number, rgb: Uint8Array) { const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) rgb.subarray(y * w * 3, (y + 1) * w * 3).forEach((v, i) => { raw[y * (w * 3 + 1) + 1 + i] = v; });
  const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }), crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cr]); };
  const hd = Buffer.alloc(13); hd.writeUInt32BE(w, 0); hd.writeUInt32BE(h, 4); hd[8] = 8; hd[9] = 2; writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hd), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])); }
function flat(M: Mesh, yaw: number, pitch: number): Uint8Array { const p = drawMesh(M, yaw, pitch, mm, W, H, { outline: 2, glass: 0.75, cy: 0.62 }), o = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { const a = p.rgba[i * 4 + 3]! / 255; for (let q = 0; q < 3; q++) o[i * 3 + q] = BG[q]! * (1 - a) + p.rgba[i * 4 + q]! * a; } return o; }
function sheet(pics: Uint8Array[], cols: number) { const rows = Math.ceil(pics.length / cols), o = new Uint8Array(W * cols * H * rows * 3).fill(BG[0]!);
  pics.forEach((p, k) => { const cx = k % cols, cy = Math.floor(k / cols); for (let y = 0; y < H; y++) o.set(p.subarray(y * W * 3, (y + 1) * W * 3), ((cy * H + y) * W * cols + cx * W) * 3); }); return { w: W * cols, h: H * rows, rgb: o }; }
const log: string[] = [];
const save = (name: string, pics: Uint8Array[], cols: number) => { if (only && only !== name) return; const s = sheet(pics, cols); png(`${out}/free_proto_${name}.png`, s.w, s.h, s.rgb); log.push(`wrote free_proto_${name}.png`); };
const note = (tag: string, c: FreeCar) => { log.push(`${tag.padEnd(28)} triangles ${c.mesh.n}, shell ${c.closure.tris} open ${c.closure.open} over ${c.closure.over}` + c.fixtures.map(f => ` | ${f.id} ${f.ok ? `ok (${f.cells} cells)` : `refused: ${f.why}`}`).join('')); return c; };
const views = (c: FreeCar) => [flat(c.mesh, 32, 20), flat(c.mesh, 0, 0), flat(c.mesh, 212, 22)];
const want = (n: string) => !only || only === n;
const PAINTS = ['#c8281e', '#e2b21c', '#1f4f9c', '#e8e6e0'];

if (want('presets')) save('presets', [WEDGE, CANOPY, COKE, LONGTAIL].flatMap((s, k) => views(note(s.name, buildFree(s, { colours: { paint: PAINTS[k]! } })))), 3);
if (want('blends')) save('blends', [[WEDGE, LONGTAIL], [CANOPY, COKE]].flatMap(([a, b], k) => [0.25, 0.5, 0.75].map(t => flat(note(`blend ${a!.name}-${b!.name} ${t}`, buildFree(blend(a!, b!, t), { colours: { paint: PAINTS[k + 1]! } })).mesh, 32, 20))), 3);
if (want('pieces')) { const mixd = joinPieces(pieceOf(WEDGE, 'nose'), pieceOf(CANOPY, 'cabin'), pieceOf(COKE, 'tail'));
  save('pieces', [...views(note('wedge nose + canopy cabin + coke tail', buildFree(mixd, { colours: { paint: '#2f7a4a' } }))), flat(buildFree(WEDGE).mesh, 0, 0), flat(buildFree(CANOPY).mesh, 0, 0), flat(buildFree(COKE).mesh, 0, 0)], 3); }
const set = (): Placed[] => FIXTURE_SET.map(f => ({ fixture: f }));
if (want('fixtures')) save('fixtures', [WEDGE, CANOPY, LONGTAIL].flatMap((s, k) => { const c = note(`fixtures on ${s.name}`, buildFree(s, { fixtures: set(), colours: { paint: PAINTS[[0, 2, 3][k]!]! } })); return [flat(c.mesh, 32, 20), flat(c.mesh, 212, 22), flat(c.mesh, 150, 16)]; }), 3);
if (want('drag')) save('drag', [1.3, 1.5, 1.68].flatMap((s, k) => { const c = note(`duct at s=${s}`, buildFree(COKE, { fixtures: [{ fixture: NSX_DUCT, s, a: [0.5, 0.58, 0.52][k]! }], colours: { paint: '#e2b21c' } })); return [flat(c.mesh, 0, 0), flat(c.mesh, 300, 14)]; }), 2);
if (want('lamps')) { const c = note('lamps close', buildFree(CANOPY, { fixtures: [{ fixture: EB110_LAMP }, { fixture: F355_TAIL_LAMPS }, { fixture: REAR_WING }] })); save('lamps', [flat(c.mesh, 40, 30), flat(c.mesh, 230, 18)], 2); }
if (want('morph')) save('morph', [-120, 0, 120].map(dv => flat(note(`roof dragged ${dv}`, buildFree(dragCurve(LONGTAIL, 'top', 2.3, dv, 0.35), { colours: { paint: '#1f4f9c' } })).mesh, 0, 0)), 3);
console.log(log.join('\n'));
