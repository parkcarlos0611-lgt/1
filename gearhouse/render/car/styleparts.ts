// The machinery the drift-game style is checked on (docs/systems/109 section 10), beside the cars of stylecars.ts on
// the style check page (ui/stylecheck.ts): an engine on the workshop's stand, an engine in a bay drawn on its own (an
// in-line six with a turbo and a V8 at the front, a flat six at the rear), a suspension corner; each in the realistic
// look and in the drift look, so the two can be set side by side. Each stands on the floor at the mesh's middle.
import type { Mesh, V } from './mesh';
import type { StyleCar } from './stylecars';
import { DESIGN_F355, DESIGN_NSX, applyPatch, type Design, type DesignPatch } from '../../core/design';
import { designKit } from './design';
import { assemble } from './kit/assemble';
import { powertrainMesh, setPartStyle, partStyle, fromDesign, type PartStyle, type Site } from './powertrain';
import { standModel } from './powertrain/stand';
import { isSuspPart } from './suspension';

/** the mesh moved to stand on the floor about its own middle, its length what the picture must hold */
export function centred(M: Mesh, tris?: (t: number) => boolean): Mesh {
  const K: number[] = []; for (let t = 0; t < M.n; t++) if (!tris || tris(t)) K.push(t);
  const pick = <A extends Float32Array | Uint8Array | Int16Array>(a: A, w: number, make: (n: number) => A): A => { const o = make(K.length * w); K.forEach((t, i) => o.set(a.subarray(t * w, t * w + w), i * w)); return o; };
  const pos = pick(M.pos, 9, n => new Float32Array(n)), lo: V = [Infinity, Infinity, Infinity], hi: V = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i++) { lo[i % 3] = Math.min(lo[i % 3]!, pos[i]!); hi[i % 3] = Math.max(hi[i % 3]!, pos[i]!); }
  const length = Math.max(hi[0] - lo[0], hi[1] - lo[1], (hi[2] - lo[2]) * 1.3) * 1.12, d: V = [length / 2 - (lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]];
  for (let i = 0; i < pos.length; i++) pos[i] = pos[i]! + d[i % 3]!;
  const names = new Set(K.map(t => M.names?.[M.part[t]!] ?? '')), inside = (p: V) => p[0] >= lo[0] - 1 && p[0] <= hi[0] + 1 && p[1] >= lo[1] - 1 && p[1] <= hi[1] + 1;
  const { susp: _s, inner: _i, lines: _l, partLines, ...rest } = M; void _s; void _i; void _l;
  return { ...rest, decals: [], n: K.length, pos, col: pick(M.col, 3, n => new Uint8Array(n)), gloss: pick(M.gloss, 1, n => new Float32Array(n)), part: pick(M.part, 1, n => new Int16Array(n)), kind: pick(M.kind, 1, n => new Uint8Array(n)), tex: pick(M.tex, 1, n => new Uint8Array(n)), length,
    partLines: (partLines ?? []).filter(l => names.has(l.part ?? '') && inside(l.pts[0]!)).map(l => ({ ...l, pts: l.pts.map(p => [p[0] + d[0], p[1] + d[1], p[2] + d[2]] as V) })) }; }

/** a front-engined car's site and a rear-engined one's (an engine hung behind the rear axle, its gearbox ahead of it): the bays seen on their own */
const WHEELS = { f: { x: 850, y: 760, r: 320, w: 225, z: 320 }, r: { x: 3450, y: 770, r: 325, w: 255, z: 325 } };
export const FRONT_SITE: Site = { length: 4500, foot: 150, wheels: WHEELS, engine: { at: [1820, 0, 330], dir: '-x' } };
export const REAR_SITE: Site = { length: 4300, foot: 150, wheels: WHEELS, engine: { at: [WHEELS.r.x + 112, 0, 300], dir: '+x' } };
const design = (base: Design, p: DesignPatch): Design => applyPatch(base, p);
export const I6_TURBO = design(DESIGN_NSX, { engine: { layout: 'I6', cc: 3000, turbo: 1, intake: 'single', intercooler: true, grade: 1 } });
export const V8_NA = DESIGN_F355;
export const F6_NA = design(DESIGN_NSX, { engine: { layout: 'F6', cc: 3600, turbo: 0, intake: 'single', grade: 1 } });

const stand = (d: Design, style: PartStyle) => centred(standModel(d, 2, undefined, style).mesh);
/** an engine in its bay; the realistic look has no bay of its own: the engine alone, as the drift look's is compared with */
const bay = (d: Design, site: Site, style: PartStyle) => centred(powertrainMesh(fromDesign(d), site, { detail: 2, engineOnly: true, style, bay: true }).mesh);
/** a car's front corner with its body off: the suspension and the brake, the tyre and the rim's barrel */
function corner(style: PartStyle): Mesh { const was = partStyle(); setPartStyle(style);
  try { const { kit, tweak } = designKit(DESIGN_NSX, 2), A = assemble(kit, { tweak }), M = A.mesh, w = A.lines.wheels.f, N = M.names ?? [];
    return centred(M, t => { const n = N[M.part[t]!] ?? ''; if (!(isSuspPart(n) || /^(tyre|rim)/.test(n))) return false; if (n === 'steeringRack' || n === 'antiRollBar') return false;
      for (let k = 0; k < 3; k++) { const q = t * 9 + k * 3; if (Math.abs(M.pos[q]! - w.x) > 520 || M.pos[q + 1]! < 0) return false; } return true; }); }
  finally { setPartStyle(was); } }

const both = (id: string, name: string, f: (s: PartStyle) => Mesh): StyleCar[] => [{ id: `${id}_drift`, name: `${name} (드리프트)`, mesh: () => f('drift') }, { id: `${id}_real`, name: `${name} (사실)`, mesh: () => f('real') }];
export const STYLE_PARTS: StyleCar[] = [
  ...both('standV8', '받침대 위 V8', s => stand(V8_NA, s)), ...both('standI6', '받침대 위 직렬 6기통 터보', s => stand(I6_TURBO, s)), ...both('standF6', '받침대 위 수평대향 6기통', s => stand(F6_NA, s)),
  ...both('bayI6', '앞 엔진룸: 직렬 6기통 터보', s => bay(I6_TURBO, FRONT_SITE, s)), ...both('bayV8', '앞 엔진룸: V8', s => bay(V8_NA, FRONT_SITE, s)), ...both('bayF6', '뒤 엔진룸: 수평대향 6기통', s => bay(F6_NA, REAR_SITE, s)),
  ...both('corner', '서스펜션 앞 코너', corner),
];
