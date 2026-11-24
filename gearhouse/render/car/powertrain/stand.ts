// The engine designer's stand (docs/systems/101 1-1 and 1-2 ⑥, task M2): a design's engine alone (powertrainMesh with
// engineOnly) bolted by its bellhousing face to a workshop stand on the studio floor, and its exploded view: each part
// moved out along the way it comes off (the cam covers and the intake up, the sump down, the manifolds and the turbos out
// to their side, the belt drive off the front), each instance of a part by its own side. The parts' Korean names and the
// quality slider each answers to (the designer's labels), and the part under a point of the picture (the live
// renderer's orthographic camera worked backward: the tap and hover labels). Pure: meshes in, meshes out.
// The stand's frame is the car's (x along the crank, from the flange to the pulleys; y across; z up; mm), the mesh's
// middle at x = length / 2 as the renderer places a car.
// The cutaway (절단 보기): the block, the heads, the sump, the timing case and the bores cut open by the planes through the
// crank and each bank's axis (a V: the wedge between its banks taken out, from a little under the crank; a flat engine:
// its upper half; an in-line one: the intake's half), the decks and the heads' tops left off, the covers, the intake and
// what feeds it taken away, the engine's insides (internals.ts) put in on their bones.
import { Build, type Mesh } from '../mesh';
import { powertrainMesh, type PowertrainBuilt } from './index';
import { fromDesign } from './spec';
import { DRY_DROP, engineDims } from './engine';
import { Geo, type V } from './geo';
import { buildInternals, type CrankKind, type EngineRig } from './internals';
import type { Site } from './layout';
import type { Design, QualityPart } from '../../../core/design';

/** the mesh's length: the stand and the engine's longest (a V12's or an in-line six's) with its exploded parts */
export const STAND_LEN = 2400;
/** the crank's height on the stand (mm) */
const CRANK_Z = 760;
const SITE: Site = { length: STAND_LEN, foot: 0, wheels: { f: { x: 0, y: 760, r: 320, w: 220, z: 320 }, r: { x: STAND_LEN, y: 760, r: 320, w: 220, z: 320 } }, engine: { at: [0, 0, 0], dir: '+x' } };

export interface StandModel { mesh: Mesh; built: PowertrainBuilt; /** the engine's bounds on the stand (mm, the mesh's frame) */ min: [number, number, number]; max: [number, number, number]; /** the cutaway's insides */ rig?: EngineRig }
/** the design's engine on its stand; `cut`: cut open with its insides (the crank's kind where the layout has a choice) */
export function standModel(d: Design, detail: 0 | 1 | 2 = 2, cut?: { crank?: CrankKind }): StandModel {
  const { mesh: E, built } = powertrainMesh(fromDesign(d), SITE, { detail, engineOnly: true }), eb = built.engine;
  // the engine moved so its middle stands at the mesh's middle, its crank at the stand's height
  const len = eb.max[0] - eb.min[0], x0 = STAND_LEN / 2 - len / 2 - eb.min[0], y0 = -(eb.min[1] + eb.max[1]) / 2, z0 = CRANK_Z;
  const pos = E.pos.slice(); for (let i = 0; i < pos.length; i += 3) { pos[i] = pos[i]! + x0; pos[i + 1] = pos[i + 1]! + y0; pos[i + 2] = pos[i + 2]! + z0; }
  const min: [number, number, number] = [eb.min[0] + x0, eb.min[1] + y0, eb.min[2] + z0], max: [number, number, number] = [eb.max[0] + x0, eb.max[1] + y0, eb.max[2] + z0];
  // the stand: a workshop engine stand of bare steel, low and open, all of it behind the bellhousing face but its two
  // feet: a cross-shaped head plate bolted to the face, an arm back to a slim post, a T-foot on castors
  const b = new Build(), fx = min[0] - 12, w = 0.5 * Math.max(300, max[1] - min[1]) + 60, reach = Math.min(0.55 * (max[0] - min[0]), 420), STEEL = '#8b8f94', DARK = '#3b3d40';
  b.name('stand').mat(STEEL, 0.5, 'metal').box(fx - 8, fx + 8, -150, 150, CRANK_Z - 18, CRANK_Z + 18).box(fx - 8, fx + 8, -18, 18, CRANK_Z - 150, CRANK_Z + 150)   // the head plate
    .mat(STEEL, 0.5, 'metal').box(fx - 250, fx - 8, -22, 22, CRANK_Z - 22, CRANK_Z + 22)                                   // the arm
    .mat(STEEL, 0.5, 'metal').box(fx - 290, fx - 240, -25, 25, 60, CRANK_Z + 30)                                           // the post
    .mat(DARK, 0.35, 'metal').box(fx - 300, fx - 230, -w, w, 30, 60)                                                          // the foot across
    .box(fx - 300, fx + reach, w - 70, w - 30, 30, 60).box(fx - 300, fx + reach, -w + 30, -w + 70, 30, 60)                    // the feet under the engine
    .mat(DARK, 0.3, 'plain').box(fx - 275, fx - 255, -12, 12, CRANK_Z + 30, CRANK_Z + 90);                                   // the turning handle
  b.name('stand').mat('#1a1a1a', 0.2, 'plain'); for (const [x, y] of [[fx - 265, w - 25], [fx - 265, -w + 25], [fx + reach - 25, w - 50], [fx + reach - 25, -w + 50]] as const) b.box(x - 18, x + 18, y - 18, y + 18, 0, 30);   // the castors
  if (!cut) return { mesh: merge(E, b.mesh(STAND_LEN), pos), built, min, max };
  // ---- the cutaway ----
  const S = fromDesign(d), D = engineDims(S), off: V = [x0, y0, z0 - (S.sump === 'dry' ? DRY_DROP * D.B : 0)];
  const at = (k: number): V => [off[0], off[1], off[2] + k * D.B];
  const planes: { o: V; n: V }[] = S.layout === 'I' ? [{ o: at(0), n: [0, -1, 0] }] : S.layout === 'flat' ? [{ o: at(-0.15), n: [0, 0, 1] }] : [{ o: at(-0.12), n: [0, -D.cs, D.sn] }, { o: at(-0.12), n: [0, D.cs, D.sn] }];
  // the faces left off: the decks (the block's tops along each bank) and the heads' tops
  const face = (name: string, p: Float32Array, i: number) => { const h = name === 'engineBlock' ? D.Hd : name === 'cylinderHead' ? D.Hd + D.Hh : -1; if (h < 0) return false;
    return D.S.some(s => { const a = D.ax(s); for (let k = 0; k < 3; k++) { const q = i + k * 3; if (Math.abs((p[q]! - off[0]) * a[0] + (p[q + 1]! - off[1]) * a[1] + (p[q + 2]! - off[2]) * a[2] - h) > 1) return false; } return true; }); };
  const rule = (n: string): 'keep' | 'clip' | 'drop' => CUT_CLIP.has(n) ? 'clip' : CUT_DROP.has(n) ? 'drop' : 'keep';
  const Ec = cutMesh({ ...E, pos }, rule, planes, face), ib = new Build(), still = new Geo(), { rig, bone } = buildInternals(ib, still, S, { cc: d.engine.cc, bs: d.engine.bs, crank: cut.crank, det: detail, off });
  const sb = new Build(); still.emit(sb); const Sm = cutMesh(sb.mesh(STAND_LEN), rule, planes), Im = ib.mesh(STAND_LEN); Im.bone = Uint8Array.from(bone);
  const all = mergeAll([Ec, Sm, Im, b.mesh(STAND_LEN)]); all.inner = rig;
  return { mesh: all, built, min, max, rig }; }

/** what the cutaway cuts open, and what it takes away */
const CUT_CLIP = new Set(['engineBlock', 'cylinderHead', 'sump', 'timingCover', 'cylinderBore']);
const CUT_DROP = new Set(['camCover', 'coilPack', 'oilFiller', 'intakePlenum', 'intakeRunner', 'intakeTrumpet', 'throttleBody', 'throttleLinkage', 'intakeActuator', 'intakeLabel', 'airbox', 'intakeHose', 'fuelRail', 'boostPipe', 'intercooler', 'coolantHose']);
/** a mesh with the region where every plane's dot(p - o, n) > 0 taken out of its clipped parts (the triangles cut along
 *  the planes), its dropped parts and the faces `face` names left off */
export function cutMesh(M: Mesh, rule: (name: string) => 'keep' | 'clip' | 'drop', planes: { o: V; n: V }[], face?: (name: string, pos: Float32Array, i: number) => boolean): Mesh {
  const N = M.names ?? [], P: number[] = [], tri: number[] = [];   // the new corners, and the triangle each came from
  const f = (k: number, p: V) => { const { o, n } = planes[k]!; return (p[0] - o[0]) * n[0] + (p[1] - o[1]) * n[1] + (p[2] - o[2]) * n[2]; };
  /** a polygon cut to where plane k's f is <= 0 (sign -1) or >= 0 (sign 1) */
  const clip = (poly: V[], k: number, sign: number): V[] => { const out: V[] = []; for (let i = 0; i < poly.length; i++) { const a = poly[i]!, b = poly[(i + 1) % poly.length]!, fa = -sign * f(k, a), fb = -sign * f(k, b);
      if (fa <= 0) out.push(a); if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); } } return out; };
  for (let t = 0; t < M.n; t++) { const nm = N[M.part[t]!] ?? '', r = rule(nm), i = t * 9; if (r === 'drop' || (face && face(nm, M.pos, i))) continue;
    const T: V[] = [0, 1, 2].map(k => [M.pos[i + k * 3]!, M.pos[i + k * 3 + 1]!, M.pos[i + k * 3 + 2]!] as V);
    if (r === 'keep') { for (const p of T) P.push(...p); tri.push(t); continue; }
    // what is outside the region: outside the first plane, or inside it and outside the second, ...
    for (let k = 0; k < planes.length; k++) { let poly = T; for (let j = 0; j < k && poly.length >= 3; j++) poly = clip(poly, j, 1); if (poly.length >= 3) poly = clip(poly, k, -1);
      for (let j = 1; j + 1 < poly.length; j++) { P.push(...poly[0]!, ...poly[j]!, ...poly[j + 1]!); tri.push(t); } } }
  const n = tri.length, pick = <A extends Uint8Array | Float32Array | Int16Array>(src: A, w: number, make: (k: number) => A): A => { const o = make(n * w); tri.forEach((t, j) => { for (let k = 0; k < w; k++) o[j * w + k] = src[t * w + k]!; }); return o; };
  return { ...M, n, pos: new Float32Array(P), col: pick(M.col, 3, k => new Uint8Array(k)), gloss: pick(M.gloss, 1, k => new Float32Array(k)), part: pick(M.part, 1, k => new Int16Array(k)), kind: pick(M.kind, 1, k => new Uint8Array(k)), tex: pick(M.tex, 1, k => new Uint8Array(k)), ...(M.bone ? { bone: pick(M.bone, 1, k => new Uint8Array(k)) } : {}) }; }
/** meshes as one (each one's parts numbered after the last's), their bones kept */
function mergeAll(L: Mesh[]): Mesh { let M = L[0]!; for (const B of L.slice(1)) { const bone = M.bone || B.bone ? new Uint8Array(M.n + B.n) : null; if (bone) { if (M.bone) bone.set(M.bone); if (B.bone) bone.set(B.bone, M.n); }
    M = merge(M, B); if (bone) M.bone = bone; } return M; }

/** two meshes as one (the second's parts numbered after the first's) */
function merge(A: Mesh, B: Mesh, posA = A.pos): Mesh {
  const n = A.n + B.n, NA = A.names ?? [], off = NA.length, cat = <T extends Float32Array | Uint8Array>(a: T, b: T, make: (k: number) => T) => { const o = make(a.length + b.length); o.set(a); o.set(b, a.length); return o; };
  const part = new Int16Array(n); part.set(A.part); for (let t = 0; t < B.n; t++) part[A.n + t] = B.part[t]! + off;
  return { n, pos: cat(posA, B.pos, k => new Float32Array(k)), col: cat(A.col, B.col, k => new Uint8Array(k)), gloss: cat(A.gloss, B.gloss, k => new Float32Array(k)), part, kind: cat(A.kind, B.kind, k => new Uint8Array(k)),
    tex: cat(A.tex, B.tex, k => new Uint8Array(k)), length: STAND_LEN, names: [...NA, ...(B.names ?? [])], decals: [...(A.decals ?? []), ...(B.decals ?? [])] }; }

// ---- the parts' names and what each answers to ----
/** each part's Korean name and the quality slider it answers to (null: none of the five) */
export const PART_INFO: Record<string, { ko: string; q: QualityPart | null }> = {
  engineBlock: { ko: '엔진 블록', q: 'block' }, sump: { ko: '오일 섬프', q: 'block' }, oilPump: { ko: '드라이 섬프 펌프와 탱크', q: 'block' }, oilFilter: { ko: '오일 필터', q: 'block' }, dipstick: { ko: '오일 게이지', q: 'block' },
  oilFiller: { ko: '오일 주입구', q: 'head' }, cylinderHead: { ko: '실린더 헤드', q: 'head' }, camCover: { ko: '캠 커버', q: 'head' }, coilPack: { ko: '점화 코일', q: 'head' }, timingCover: { ko: '타이밍 커버', q: 'head' },
  intakePlenum: { ko: '흡기 플레넘', q: 'intake' }, intakeRunner: { ko: '흡기 러너', q: 'intake' }, intakeTrumpet: { ko: '흡기 나팔관 (개별 스로틀)', q: 'intake' }, throttleBody: { ko: '스로틀 바디', q: 'intake' },
  throttleLinkage: { ko: '스로틀 링크', q: 'intake' }, intakeActuator: { ko: '가변 흡기 작동기', q: 'intake' }, intakeLabel: { ko: '흡기 명판', q: 'intake' }, airbox: { ko: '에어박스', q: 'intake' }, airFilter: { ko: '에어 필터', q: 'intake' },
  intakeHose: { ko: '흡기 호스', q: 'intake' }, fuelRail: { ko: '연료 레일과 인젝터', q: 'intake' },
  exhaustManifold: { ko: '배기 매니폴드·헤더', q: 'exhaust' }, exhaustDownpipe: { ko: '배기 다운파이프', q: 'exhaust' }, heatShield: { ko: '열 차폐판', q: 'exhaust' },
  turbo: { ko: '터보차저', q: 'turbo' }, wastegate: { ko: '웨이스트게이트', q: 'turbo' }, intercooler: { ko: '인터쿨러', q: 'turbo' }, boostPipe: { ko: '부스트 파이프', q: 'turbo' },
  pulley: { ko: '풀리', q: null }, belt: { ko: '구동 벨트', q: null }, alternator: { ko: '발전기', q: null }, waterPump: { ko: '워터 펌프', q: null }, starter: { ko: '시동 모터', q: null },
  thermostat: { ko: '서모스탯', q: null }, coolantHose: { ko: '냉각수 호스', q: null }, stand: { ko: '엔진 받침대', q: null },
  // the cutaway's insides
  crankshaft: { ko: '크랭크축', q: 'block' }, conRod: { ko: '커넥팅 로드', q: 'block' }, piston: { ko: '피스톤', q: 'block' }, pistonRing: { ko: '피스톤 링', q: 'block' }, cylinderBore: { ko: '실린더 보어', q: 'block' },
  camshaft: { ko: '캠축', q: 'head' }, intakeValve: { ko: '흡기 밸브', q: 'head' }, exhaustValve: { ko: '배기 밸브', q: 'head' }, sparkPlug: { ko: '점화 플러그', q: 'head' } };
export const partName = (n: string) => PART_INFO[n]?.ko ?? n;

// ---- the exploded view ----
/** how far each part comes off at full spread (mm): up, out to its side, along the crank (+: off the front, the pulleys' end) */
const SPREAD: Record<string, [number, number, number]> = {
  camCover: [230, 40, 0], cylinderHead: [120, 30, 0], coilPack: [320, 30, 0], oilFiller: [300, 30, 0],
  intakePlenum: [460, 0, 0], intakeRunner: [380, 0, 0], intakeTrumpet: [420, 0, 0], throttleBody: [500, 0, 0], throttleLinkage: [480, 0, 0], intakeActuator: [500, 0, 0], intakeLabel: [470, 0, 0], airbox: [560, 0, 0], airFilter: [560, 60, 0],
  fuelRail: [350, 0, 0], intakeHose: [300, 200, 0],
  exhaustManifold: [0, 260, 0], exhaustDownpipe: [-60, 320, 0], heatShield: [40, 300, 0], turbo: [60, 400, 0], wastegate: [80, 420, 0], intercooler: [200, 380, 0], boostPipe: [180, 330, 0],
  sump: [-230, 0, 0], oilPump: [-200, 150, 0], oilFilter: [-60, 220, 80], dipstick: [150, 80, 0],
  timingCover: [0, 0, 160], pulley: [0, 0, 300], belt: [0, 0, 330], alternator: [0, 120, 280], waterPump: [0, 60, 260], thermostat: [60, 0, 240], coolantHose: [100, 60, 200], starter: [-40, 220, 0] };
/** each part number's spread at full (mm, the mesh's frame): by its name, out to the side its own middle is on */
function spreads(M: Mesh): Float32Array {
  const N = M.names ?? [], k = N.length, ys = new Float64Array(k), cnt = new Float64Array(k);
  for (let t = 0; t < M.n; t++) { const p = M.part[t]!, i = t * 9; ys[p] = ys[p]! + (M.pos[i + 1]! + M.pos[i + 4]! + M.pos[i + 7]!) / 3; cnt[p] = cnt[p]! + 1; }
  const out = new Float32Array(k * 3);
  for (let p = 0; p < k; p++) { const s = SPREAD[N[p] ?? ''], c = cnt[p]!; if (!s || !c) continue; const y = ys[p]! / c, side = y < -15 ? -1 : y > 15 ? 1 : 0;
    out[p * 3] = s[2]; out[p * 3 + 1] = s[1] * side; out[p * 3 + 2] = s[0]; }
  return out; }
const spreadCache = new WeakMap<Mesh, Float32Array>();
/** the mesh with its parts spread `k` of the way (0: as built, 1: fully apart) */
export function exploded(M: Mesh, k: number): Mesh {
  if (k <= 0) return M; let S = spreadCache.get(M); if (!S) { S = spreads(M); spreadCache.set(M, S); }
  const pos = M.pos.slice(); for (let t = 0; t < M.n; t++) { const p = M.part[t]!, dx = S[p * 3]! * k, dy = S[p * 3 + 1]! * k, dz = S[p * 3 + 2]! * k; if (!dx && !dy && !dz) continue;
    for (let v = 0; v < 3; v++) { const i = t * 9 + v * 3; pos[i] = pos[i]! + dx; pos[i + 1] = pos[i + 1]! + dy; pos[i + 2] = pos[i + 2]! + dz; } }
  return { ...M, pos }; }

// ---- the part under a point of the picture ----
/** the live renderer's view (render/live/renderer.ts LiveView) and where the mesh stands (a car's place, its heading 0) */
export interface PickView { x: number; y: number; z: number; ang: number; pitch: number; mm: number; W: number; H: number; cy: number }
/** the part's name under the picture's pixel (px, py from its top left, in the picture's own pixels), or null. The
 *  renderer's camera: orthographic, `mm` millimetres a pixel, turned to `ang`, tilted down by `pitch`; the mesh placed as a
 *  car at the origin heading 0 (world x = (length / 2 - x) / 1000, y = y / 1000, z = z / 1000 + carZ) */
export function pickPart(M: Mesh, v: PickView, px: number, py: number, carZ = 0): string | null {
  const { rx, up, vd, k, ox, oy } = camera(v);
  const P = M.pos, half = M.length / 2, sx = new Float64Array(3), sy = new Float64Array(3), sz = new Float64Array(3);
  let best = Infinity, hit = -1;
  for (let t = 0; t < M.n; t++) {
    for (let j = 0; j < 3; j++) { const i = t * 9 + j * 3, X = (half - P[i]!) / 1000, Y = P[i + 1]! / 1000, Z = P[i + 2]! / 1000 + carZ;
      sx[j] = ox + (X * rx[0]! + Y * rx[1]!) * k; sy[j] = oy - (X * up[0]! + Y * up[1]! + Z * up[2]!) * k; sz[j] = X * vd[0]! + Y * vd[1]! + Z * vd[2]!; }
    const d = (sx[1]! - sx[0]!) * (sy[2]! - sy[0]!) - (sx[2]! - sx[0]!) * (sy[1]! - sy[0]!); if (Math.abs(d) < 1e-9) continue;
    const u = ((px - sx[0]!) * (sy[2]! - sy[0]!) - (sx[2]! - sx[0]!) * (py - sy[0]!)) / d, w = ((sx[1]! - sx[0]!) * (py - sy[0]!) - (px - sx[0]!) * (sy[1]! - sy[0]!)) / d;
    if (u < 0 || w < 0 || u + w > 1) continue; const z = sz[0]! + u * (sz[1]! - sz[0]!) + w * (sz[2]! - sz[0]!); if (z < best) { best = z; hit = t; } }
  return hit < 0 ? null : (M.names ?? [])[M.part[hit]!] ?? null; }
function camera(v: PickView) { const a = v.ang - Math.PI / 2, cA = Math.cos(a), sA = Math.sin(a), SP = Math.sin(v.pitch * Math.PI / 180), CP = Math.cos(v.pitch * Math.PI / 180), k = 1000 / v.mm;
  const rx = [cA, sA, 0], ry = [-sA, cA, 0], up = [ry[0]! * SP, ry[1]! * SP, CP], vd = [ry[0]! * CP, ry[1]! * CP, -SP];
  return { rx, up, vd, k, ox: Math.round(v.W / 2 - (v.x * rx[0]! + v.y * rx[1]!) * k), oy: Math.round(v.H * v.cy + (v.x * up[0]! + v.y * up[1]! + v.z * up[2]!) * k) }; }
/** a point of the mesh (mm, its frame) on the picture (its pixels from the top left), as pickPart sees it */
export function onPicture(len: number, v: PickView, p: V, carZ = 0): [number, number] { const { rx, up, k, ox, oy } = camera(v), X = (len / 2 - p[0]) / 1000, Y = p[1] / 1000, Z = p[2] / 1000 + carZ;
  return [ox + (X * rx[0]! + Y * rx[1]!) * k, oy - (X * up[0]! + Y * up[1]! + Z * up[2]!) * k]; }
