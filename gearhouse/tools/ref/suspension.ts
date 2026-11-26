// The suspension's pictures (docs/systems/101, M3): a corner close up at full droop, at its static ride and at full
// bump, and each kit base with its body taken off so the four corners and the powertrain show.
//   npx tsx tools/ref/suspension.ts <out dir> [corners] [bare] [parts]
import { flat, save } from './powertrain';
import type { Mesh } from '../../render/car/mesh';
import { assemble, type Assembled } from '../../render/car/kit/assemble';
import { designKit } from '../../render/car/design';
import { DESIGN_NSX, DESIGN_F355, DESIGN_EB110, type Design } from '../../core/design';
import { isSuspPart, poseMesh, poseRig } from '../../render/car/suspension';

const pickTris = (M: Mesh, keep: (t: number) => boolean): Mesh => { const K: number[] = []; for (let t = 0; t < M.n; t++) if (keep(t)) K.push(t);
  const pick = <A extends Float32Array | Uint8Array | Int16Array>(a: A, w: number, make: (n: number) => A): A => { const o = make(K.length * w); K.forEach((t, i) => o.set(a.subarray(t * w, t * w + w), i * w)); return o; };
  return { ...M, decals: [], n: K.length, pos: pick(M.pos, 9, n => new Float32Array(n)), col: pick(M.col, 3, n => new Uint8Array(n)), gloss: pick(M.gloss, 1, n => new Float32Array(n)), part: pick(M.part, 1, n => new Int16Array(n)), kind: pick(M.kind, 1, n => new Uint8Array(n)), tex: pick(M.tex, 1, n => new Uint8Array(n)) }; };
const build = (d: Design, detail: 0 | 1 | 2 = 2): Assembled => { const { kit, tweak } = designKit(d, detail); return assemble(kit, { tweak }); };
const name = (A: Assembled, t: number) => A.mesh.names?.[A.mesh.part[t]!] ?? '';
/** the car with its body off: the suspension, the powertrain, the tyres and the rims' barrels (`faces`: the wheels whole) */
const bare = (A: Assembled, faces = false): Mesh => { const pt = A.panels.indexOf('engine'), su = A.panels.indexOf('suspension'), wh = A.panels.indexOf('wheel');
  return pickTris(A.mesh, t => A.panelOf[t] === pt || A.panelOf[t] === su || (A.panelOf[t] === wh && (faces || /^(tyre|rim)/.test(name(A, t))))); };
/** one corner of it: what stands within `r` mm of a wheel's centre */
const corner = (M: Mesh, c: [number, number, number], r: number): Mesh => pickTris(M, t => { for (let k = 0; k < 3; k++) { const q = t * 9 + k * 3; if (Math.abs(M.pos[q]! - c[0]) > r || Math.abs(M.pos[q + 1]! - c[1]) > r * 1.15) return false; } return true; });
const CARS: [string, Design][] = [['nsx', DESIGN_NSX], ['f355', DESIGN_F355], ['eb110', DESIGN_EB110]];

if (process.argv.includes('parts')) for (const [id, d] of CARS) for (const det of [2, 1, 0] as const) { const A = build(d, det), c: Record<string, number> = {}; let n = 0;
  for (let t = 0; t < A.mesh.n; t++) if (isSuspPart(name(A, t))) { n++; c[name(A, t)] = (c[name(A, t)] ?? 0) + 1; }
  console.log(`${id} detail ${det}: car ${A.mesh.n}, suspension ${n}  ` + Object.entries(c).map(([a, b]) => a + ':' + b).join(' ')); }

/** a corner's own neighbours: the suspension, the subframe it hangs on, the driveshaft, the tyre and the rim's barrel */
const NEAR = /^(subframe|subframeFront|driveshaft|cvJoint|cvBoot|strutBrace|tyre|rim)/;
if (process.argv.includes('corners')) for (const [id, d] of CARS) { const A = build(d), M = pickTris(bare(A), t => { const n = A.mesh.names![bare(A).part[t]!]!; return isSuspPart(n) || NEAR.test(n); }), rig = A.mesh.susp!, W = 640, H = 600, pics: Uint8Array[] = [];
  for (const k of [0, 2]) { const Hk = rig.corners[k]!;
    for (const t of [-Hk.travel.droop, 0, Hk.travel.bump]) { const tr = [0, 0, 0, 0]; tr[k] = t; const P = poseMesh(M, poseRig(rig, tr, 0, 0)), C = corner(P, Hk.wc, 640);
      // the picture's middle is the mesh's (half its length): the corner is set there
      const sh = C.length / 2 - Hk.wc[0], pos = Float32Array.from(C.pos); for (let i = 0; i < pos.length; i += 3) { pos[i] = pos[i]! + sh; pos[i + 1] = pos[i + 1]! - Hk.wc[1] * 0.6; }
      pics.push(flat({ ...C, pos }, k === 0 ? 232 : 128, 14, W, H, 1.75, 0.8)); } }
  save(`suspension_corner_${id}`, pics, 3, W, H); }

if (process.argv.includes('bare')) { const W = 1000, H = 560, pics: Uint8Array[] = [];
  for (const [, d] of CARS) { const A = build(d), M = bare(A); pics.push(flat(M, 215, 28, W, H, 4.8, 0.66), flat(M, 35, 24, W, H, 4.8, 0.66), flat(M, 0, 89.9, W, H, 4.8, 0.5), flat(M, 0, 3, W, H, 4.8, 0.72)); }
  save('suspension_car_bare', pics, 2, W, H);
  save('suspension_car_outside', CARS.flatMap(([, d]) => { const A = build(d); return [flat(A.mesh, 215, 20, W, H, 4.8, 0.66), flat(A.mesh, 35, 20, W, H, 4.8, 0.66)]; }), 2, W, H); }
