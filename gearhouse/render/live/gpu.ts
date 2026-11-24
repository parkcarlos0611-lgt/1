// The live renderer's GPU side (review 99, brief 72 steps 1-3): WebGL2 programs, a mesh's buffers, matrices.
// Meshes keep the car files' axes (x back from the nose, y to the car's right, z up, mm); a model matrix puts them in
// the world (x east, y north, z up, metres).
import { KINDS, wheelsOf, type Mesh, type Decal, type V, decalPicture } from '../car/mesh';
import { surfaceNormals, hullNormals, hardEdgeLines } from '../car/edges';
import { outlineShare, autoAtlasUV } from './style';
import { boneAt, type SuspRig } from '../car/suspension';
import type { EngineRig } from '../car/powertrain/internals';

export type M4 = Float32Array;
export const m4 = (): M4 => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; };
/** a times b (column-major, as GL reads them) */
export function mul(a: M4, b: M4): M4 { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r]! * b[c * 4 + k]!; o[c * 4 + r] = s; } return o; }
export function translate(x: number, y: number, z: number): M4 { const m = m4(); m[12] = x; m[13] = y; m[14] = z; return m; }
export function scale(s: number): M4 { const m = m4(); m[0] = m[5] = m[10] = s; return m; }
/** turns about an axis through the origin: 'x', 'y' or 'z', by a (rad), the usual right-handed way */
export function rot(axis: 'x' | 'y' | 'z', a: number): M4 { const m = m4(), c = Math.cos(a), s = Math.sin(a);
  if (axis === 'z') { m[0] = c; m[1] = s; m[4] = -s; m[5] = c; } else if (axis === 'x') { m[5] = c; m[6] = s; m[9] = -s; m[10] = c; } else { m[0] = c; m[2] = -s; m[8] = s; m[10] = c; } return m; }
/** a mesh's own axes to the world: its middle (half its length along x) on the ground point (x, y, z) facing heading h
 *  (the nose, -x, toward h), mm to metres. The files' +y goes to the left of the heading: the baked renderer draws the
 *  files so (its mirror, asDrawn), and the cars, the stands and the sheets were all checked against those pictures */
export function placeMesh(len: number, x: number, y: number, z: number, h: number): M4 { const c = Math.cos(h), s = Math.sin(h), m = new Float32Array(16);
  m[0] = -c / 1000; m[1] = -s / 1000; m[4] = -s / 1000; m[5] = c / 1000; m[10] = 1 / 1000; m[15] = 1;
  m[12] = x + c * len / 2000; m[13] = y + s * len / 2000; m[14] = z; return m; }

export function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram { const p = gl.createProgram()!;
  for (const [t, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) { const s = gl.createShader(t)!; gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => `${i + 1} ${l}`).join('\n')); gl.attachShader(p, s); }
  gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p)); return p; }

/** one drawable piece: a vertex array (position, face normal, colour, gloss, kind, part) and its count */
export interface Part { vao: WebGLVertexArrayObject; n: number; lamps?: LampAt[]; /** its buffers, to free them */ bufs?: WebGLBuffer[]; /** what it was made from, for the drift-game style's layers added when first drawn so (styleUp) */ src?: { M: Mesh; tris: number[] }; styled?: boolean }
export const ATTR = { pos: 0, nor: 1, col: 2, gloss: 3, kind: 4, part: 5, smooth: 6, lamp: 7, lampAx: 8, lampRt: 9, /** the suspension's parts only: the bone each corner hangs on */ bone: 10,
  /** the drift-game style's layers (docs/systems/109 §5, styleUp): the inverted hull's normal and the part's share of the outline (-1: a raised seam strip, hidden while the drawn lines are on); the normal smoothed per surface; the atlas's coordinates */ hull: 11, surf: 12, atl: 13 } as const;
/** a lamp's face found in a mesh (review 117): its middle and the way it looks (mm, the file's axes), its radius; 1 a head lamp, 2 a tail lamp */
export interface LampAt { c: [number, number, number]; ax: [number, number, number]; R: number; flag: number }
/** triangles of a mesh (by index) into a vertex array; `glass`: only the glass and shine, else everything but them */
function upload(gl: WebGL2RenderingContext, M: Mesh, tris: number[], about?: [number, number, number], bone?: number[]): Part {
  const n = tris.length * 3, P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Uint8Array(n * 3), G = new Float32Array(n), K = new Float32Array(n), Q = new Float32Array(n);
  tris.forEach((t, j) => { const q = t * 9, p = M.pos, ax = p[q + 3]! - p[q]!, ay = p[q + 4]! - p[q + 1]!, az = p[q + 5]! - p[q + 2]!, bx = p[q + 6]! - p[q]!, by = p[q + 7]! - p[q + 1]!, bz = p[q + 8]! - p[q + 2]!;
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (let k = 0; k < 3; k++) { const v = j * 3 + k; P[v * 3] = p[q + k * 3]! - (about?.[0] ?? 0); P[v * 3 + 1] = p[q + k * 3 + 1]! - (about?.[1] ?? 0); P[v * 3 + 2] = p[q + k * 3 + 2]! - (about?.[2] ?? 0);
      N[v * 3] = nx; N[v * 3 + 1] = ny; N[v * 3 + 2] = nz; C[v * 3] = M.col[t * 3]!; C[v * 3 + 1] = M.col[t * 3 + 1]!; C[v * 3 + 2] = M.col[t * 3 + 2]!; G[v] = M.gloss[t]!; K[v] = M.kind[t]!; Q[v] = M.part[t]!; } });
  const S = smoothNormals(P, N, K, Q), LP = lampFaces(P, N, K, Q, C, M.names);
  const vao = gl.createVertexArray()!; gl.bindVertexArray(vao); const bufs: WebGLBuffer[] = [];
  const buf = (loc: number, data: ArrayBufferView, size: number, type: number, normalized = false) => { const b = gl.createBuffer()!; bufs.push(b); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type, normalized, 0, 0); };
  buf(ATTR.pos, P, 3, gl.FLOAT); buf(ATTR.nor, N, 3, gl.FLOAT); buf(ATTR.col, C, 3, gl.UNSIGNED_BYTE, true); buf(ATTR.gloss, G, 1, gl.FLOAT); buf(ATTR.kind, K, 1, gl.FLOAT); buf(ATTR.part, Q, 1, gl.FLOAT); buf(ATTR.smooth, S, 3, gl.FLOAT); buf(ATTR.lamp, LP.uv, 4, gl.FLOAT); buf(ATTR.lampAx, LP.ax, 3, gl.FLOAT); buf(ATTR.lampRt, LP.rt, 3, gl.FLOAT);
  if (bone) { const B = new Float32Array(n); bone.forEach((b, j) => { B[j * 3] = B[j * 3 + 1] = B[j * 3 + 2] = b; }); buf(ATTR.bone, B, 1, gl.FLOAT); }
  gl.bindVertexArray(null); return { vao, n, lamps: LP.lamps, bufs, src: { M, tris } }; }
/** the faces of the lamps (review 117): the glass over a head lamp (glass in a part called a lens or lamp) or a lamp's
 *  lens; each lamp found as such faces that touch; for each corner the lamp's own flat coordinates (u, v across its face,
 *  -1..1 to its rim), which lamp (1 head, 2 tail: a red lens or a part called tail), its axis and its 'right', so the
 *  shader draws the lamp's insides (bowl, bulb, fluted glass) at their depth whatever the mesh holds behind the glass */
function lampFaces(P: Float32Array, N: Float32Array, K: Float32Array, Q: Float32Array, C: Uint8Array, names?: string[]): { uv: Float32Array; ax: Float32Array; rt: Float32Array; lamps: LampAt[] } {
  const n = P.length / 3, uv = new Float32Array(n * 4), ax = new Float32Array(n * 3), rt = new Float32Array(n * 3), lamps: LampAt[] = [];
  const flagOf = (v: number) => { const nm = names?.[Q[v]!] ?? '', k = K[v]!, red = C[v * 3]! > 140 && C[v * 3 + 1]! < 110;
    if (k === GLASS) return /tail/i.test(nm) ? 2 : /^(lens|lamps?|lampCover|headlamps?|headLamp)$/i.test(nm) ? 1 : 0;
    if (k === LENS) return red || /tail|stop/i.test(nm) ? 2 : 1; return 0; };
  const fl = new Uint8Array(n / 3); for (let t = 0; t < n / 3; t++) fl[t] = flagOf(t * 3);
  const up = Array.from({ length: n / 3 }, (_, i) => i), root = (i: number): number => { while (up[i] !== i) i = up[i] = up[up[i]!]!; return i; }, seen = new Map<string, number>();
  for (let v = 0; v < n; v++) { const t = Math.floor(v / 3); if (!fl[t]) continue; const k = `${Math.round(P[v * 3]! * 2)},${Math.round(P[v * 3 + 1]! * 2)},${Math.round(P[v * 3 + 2]! * 2)},${K[v]},${Q[v]}`, o = seen.get(k); if (o === undefined) seen.set(k, t); else up[root(t)] = root(o); }
  const grp = new Map<number, number[]>(); for (let t = 0; t < n / 3; t++) if (fl[t]) { const r = root(t), g = grp.get(r); if (g) g.push(t); else grp.set(r, [t]); }
  for (const ts of grp.values()) { let cx = 0, cy = 0, cz = 0, ax0 = 0, ay0 = 0, az0 = 0; for (const t of ts) for (let k = 0; k < 3; k++) { const v = t * 3 + k; cx += P[v * 3]!; cy += P[v * 3 + 1]!; cz += P[v * 3 + 2]!; ax0 += N[v * 3]!; ay0 += N[v * 3 + 1]!; az0 += N[v * 3 + 2]!; }
    const m = ts.length * 3; cx /= m; cy /= m; cz /= m; const al = Math.hypot(ax0, ay0, az0) || 1, a: [number, number, number] = [ax0 / al, ay0 / al, az0 / al];
    let u: [number, number, number] = Math.abs(a[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1]; { const d = u[0] * a[0] + u[1] * a[1] + u[2] * a[2]; u = [u[0] - a[0] * d, u[1] - a[1] * d, u[2] - a[2] * d]; const l = Math.hypot(...u) || 1; u = [u[0] / l, u[1] / l, u[2] / l]; }
    const r: [number, number, number] = [u[1] * a[2] - u[2] * a[1], u[2] * a[0] - u[0] * a[2], u[0] * a[1] - u[1] * a[0]];
    let R = 1; for (const t of ts) for (let k = 0; k < 3; k++) { const v = t * 3 + k, dx = P[v * 3]! - cx, dy = P[v * 3 + 1]! - cy, dz = P[v * 3 + 2]! - cz; R = Math.max(R, Math.hypot(dx * r[0] + dy * r[1] + dz * r[2], dx * u[0] + dy * u[1] + dz * u[2])); }
    const f = fl[ts[0]!]!; for (const t of ts) for (let k = 0; k < 3; k++) { const v = t * 3 + k, dx = P[v * 3]! - cx, dy = P[v * 3 + 1]! - cy, dz = P[v * 3 + 2]! - cz;
      uv.set([(dx * r[0] + dy * r[1] + dz * r[2]) / R, (dx * u[0] + dy * u[1] + dz * u[2]) / R, f, R], v * 4); ax.set(a, v * 3); rt.set(r, v * 3); }
    if (R > 35 && !lamps.some(l => Math.hypot(l.c[0] - cx, l.c[1] - cy, l.c[2] - cz) < Math.max(l.R, R))) lamps.push({ c: [cx, cy, cz], ax: a, R, flag: f }); }
  return { uv, ax, rt, lamps }; }
/** each corner's normal averaged over the faces that meet there, of the same part and kind, bent less than 40 degrees
 *  from its own face (review 116): a rounded wing or windscreen shades and mirrors smoothly, a crease stays sharp */
function smoothNormals(P: Float32Array, N: Float32Array, K: Float32Array, Q: Float32Array): Float32Array {
  const n = P.length / 3, S = new Float32Array(n * 3), at = new Map<string, number[]>(), key = (v: number) => `${Math.round(P[v * 3]! * 2)},${Math.round(P[v * 3 + 1]! * 2)},${Math.round(P[v * 3 + 2]! * 2)},${K[v]},${Q[v]}`;
  for (let v = 0; v < n; v++) { const k = key(v); const l = at.get(k); if (l) l.push(v); else at.set(k, [v]); }
  for (const l of at.values()) for (const v of l) { let x = 0, y = 0, z = 0; for (const u of l) { const d = N[v * 3]! * N[u * 3]! + N[v * 3 + 1]! * N[u * 3 + 1]! + N[v * 3 + 2]! * N[u * 3 + 2]!; if (d > 0.766) { x += N[u * 3]!; y += N[u * 3 + 1]!; z += N[u * 3 + 2]!; } }
    const h = Math.hypot(x, y, z); if (!(h > 1e-6)) { S[v * 3 + 2] = 1; continue; } S[v * 3] = x / h; S[v * 3 + 1] = y / h; S[v * 3 + 2] = z / h; }   /* never a zero normal (review 146) */
  // a lamp's lens (often a flat disc in the mesh) domed: each lens, found as the lens faces that touch, its normal leaning
  // out from its middle, so the glass and the bowl behind it shade from centre to rim
  const lens = (v: number) => K[v] === LENS, up = Array.from({ length: n / 3 }, (_, i) => i), root = (i: number): number => { while (up[i] !== i) i = up[i] = up[up[i]!]!; return i; };
  for (const l of at.values()) if (lens(l[0]!)) for (const v of l) up[root(Math.floor(v / 3))] = root(Math.floor(l[0]! / 3));
  const grp = new Map<number, number[]>(); for (let t = 0; t < n / 3; t++) if (lens(t * 3)) { const r = root(t), g = grp.get(r); if (g) g.push(t); else grp.set(r, [t]); }
  for (const ts of grp.values()) { let cx = 0, cy = 0, cz = 0; for (const t of ts) for (let k = 0; k < 3; k++) { cx += P[(t * 3 + k) * 3]!; cy += P[(t * 3 + k) * 3 + 1]!; cz += P[(t * 3 + k) * 3 + 2]!; } const m = ts.length * 3; cx /= m; cy /= m; cz /= m;
    let R = 1; for (const t of ts) for (let k = 0; k < 3; k++) { const v = t * 3 + k; R = Math.max(R, Math.hypot(P[v * 3]! - cx, P[v * 3 + 1]! - cy, P[v * 3 + 2]! - cz)); }
    for (const t of ts) for (let k = 0; k < 3; k++) { const v = t * 3 + k, nx = N[v * 3]!, ny = N[v * 3 + 1]!, nz = N[v * 3 + 2]!; let dx = (P[v * 3]! - cx) / R, dy = (P[v * 3 + 1]! - cy) / R, dz = (P[v * 3 + 2]! - cz) / R; const d = dx * nx + dy * ny + dz * nz; dx -= d * nx; dy -= d * ny; dz -= d * nz;
      const x = nx + dx * 0.6, y = ny + dy * 0.6, z = nz + dz * 0.6, h = Math.hypot(x, y, z) || 1; S[v * 3] = x / h; S[v * 3 + 1] = y / h; S[v * 3 + 2] = z / h; } }
  return S; }

/** a wheel's triangles about its hub, the tyre's cut finer (each into 16, the new corners on the arcs round the axle,
 *  not on the chords), so the ring's give bends the tread smoothly (review 101) */
function splitTyres(M: Mesh, tris: number[], hub: [number, number, number]): Mesh {
  const P: number[] = [], C: number[] = [], G: number[] = [], T: number[] = [], K: number[] = [], X: number[] = [];
  const polar = (v: number[]) => ({ r: Math.hypot(v[0]!, v[2]!), a: Math.atan2(v[2]!, v[0]!), y: v[1]! });
  const mid = (a: number[], b: number[]) => { const A = polar(a), B = polar(b); let d = B.a - A.a; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; const r = (A.r + B.r) / 2, an = A.a + d / 2; return [Math.cos(an) * r, (A.y + B.y) / 2, Math.sin(an) * r]; };
  const emit = (t: number, a: number[], b: number[], c: number[], depth: number): void => { if (depth === 0) { P.push(...a, ...b, ...c); C.push(M.col[t * 3]!, M.col[t * 3 + 1]!, M.col[t * 3 + 2]!); G.push(M.gloss[t]!); T.push(M.part[t]!); K.push(M.kind[t]!); X.push(M.tex[t]!); return; }
    const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); emit(t, a, ab, ca, depth - 1); emit(t, ab, b, bc, depth - 1); emit(t, ca, bc, c, depth - 1); emit(t, ab, bc, ca, depth - 1); };
  for (const t of tris) { const v = [0, 1, 2].map(k => [M.pos[t * 9 + k * 3]! - hub[0], M.pos[t * 9 + k * 3 + 1]! - hub[1], M.pos[t * 9 + k * 3 + 2]! - hub[2]]); emit(t, v[0]!, v[1]!, v[2]!, M.kind[t] === TYRE ? 2 : 0); }
  return { n: G.length, pos: new Float32Array(P), col: new Uint8Array(C), gloss: new Float32Array(G), part: new Int16Array(T), kind: new Uint8Array(K), tex: new Uint8Array(X), length: M.length };
}
/** a mesh on the GPU: the body, each road wheel apart (to steer and turn it about its hub), the glass apart (drawn last),
 *  and its decals as pictures */
export interface GpuMesh { len: number; body: Part; glass: Part; wheels: { part: Part; glass: Part | null; hub: [number, number, number]; front: boolean; /** the tyre's outer and inner radius (mm) */ R: number; rim: number }[]; decals: Decal[]; decalTex: WebGLTexture | null; /** the suspension's moving parts apart, each corner with its bone, and the rig that poses them (render/car/suspension) */ susp?: { part: Part; rig: SuspRig }; /** an engine's moving insides (the workshop's cutaway), each part on its bone */ inner?: { part: Part; rig: EngineRig }; radius: number; height: number; width: number; /** its lamps (review 117) */ lamps: LampAt[]; /** the drift-game style's drawn lines, made when first drawn (styleLines) */ lines?: { body: LinePart | null; susp: LinePart | null } }
const GLASS = KINDS.indexOf('glass'), SHINE = KINDS.indexOf('shine'), TYRE = KINDS.indexOf('tyre'), LENS = KINDS.indexOf('lens');
export function gpuMesh(gl: WebGL2RenderingContext, M: Mesh, wheels = true): GpuMesh {
  const W = wheels ? wheelsOf(M) : [], inWheel = new Int32Array(M.n).fill(-1); W.forEach((w, k) => { for (const t of w.tris) inWheel[t] = k; });
  const isGlass = (t: number) => M.kind[t] === GLASS || M.kind[t] === SHINE, body: number[] = [], glass: number[] = [];
  // a triangle with no area has no normal: on some GPUs (phones) normalising it gives NaN, drawn as white specks that the
  // bloom spreads (review 146). Such slivers (the centres of turned parts, caps, lens fans) are dropped here for every car.
  const P0 = M.pos, flat = (t: number) => { const i = t * 9, ux = P0[i + 3]! - P0[i]!, uy = P0[i + 4]! - P0[i + 1]!, uz = P0[i + 5]! - P0[i + 2]!, vx = P0[i + 6]! - P0[i]!, vy = P0[i + 7]! - P0[i + 1]!, vz = P0[i + 8]! - P0[i + 2]!;
    return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) < 0.5; };
  const rig = wheels ? M.susp : undefined, susp: number[] = [], bone: number[] = [], EB = M.inner ? M.bone : undefined, inner: number[] = [], innerB: number[] = [];
  for (let t = 0; t < M.n; t++) if (inWheel[t]! < 0 && !flat(t)) { if (EB && EB[t]! > 0) { inner.push(t); innerB.push(EB[t]!); continue; } const i = t * 9, b = rig ? boneAt(rig, M.names?.[M.part[t]!] ?? '', (P0[i]! + P0[i + 3]! + P0[i + 6]!) / 3, (P0[i + 1]! + P0[i + 4]! + P0[i + 7]!) / 3) : -1;
    if (b > 0) { susp.push(t); bone.push(b); } else (isGlass(t) ? glass : body).push(t); }
  let R = 0, Z = 0, Y = 0; for (let i = 0; i < M.pos.length; i += 3) { R = Math.max(R, Math.hypot(M.pos[i]! - M.length / 2, M.pos[i + 1]!)); Z = Math.max(Z, M.pos[i + 2]!); Y = Math.max(Y, Math.abs(M.pos[i + 1]!)); }
  const decals = (M.decals ?? []).slice(0, 4); let decalTex: WebGLTexture | null = null;
  if (decals.length) { const S = 128; decalTex = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, decalTex); const all = new Uint8Array(S * 4 * S * 4);
    decals.forEach((d, k) => { const pic = decalPicture(d, S); for (let j = 0; j < S; j++) all.set(pic.subarray(j * S * 4, (j + 1) * S * 4), (j * S * 4 + k * S) * 4); });
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, S * 4, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, all); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
  const bodyP = upload(gl, M, body), glassP = upload(gl, M, glass), lamps = [...(glassP.lamps ?? [])]; for (const l of bodyP.lamps ?? []) if (!lamps.some(k => Math.hypot(k.c[0] - l.c[0], k.c[1] - l.c[1], k.c[2] - l.c[2]) < Math.max(k.R, l.R))) lamps.push(l);
  return { len: M.length, body: bodyP, glass: glassP, lamps, ...(rig && susp.length ? { susp: { part: upload(gl, M, susp, undefined, bone), rig } } : {}), ...(M.inner && inner.length ? { inner: { part: upload(gl, M, inner, undefined, innerB), rig: M.inner } } : {}), decals, decalTex, radius: R / 1000, height: Z / 1000, width: 2 * Y / 1000,
    wheels: W.map(w => { const hub: [number, number, number] = [w.hx, w.hy, w.hz], ts = w.tris.filter(t => !isGlass(t) && !flat(t)), gs = w.tris.filter(t => isGlass(t) && !flat(t));
      let R = 0, rim = Infinity; for (const t of w.tris) { if (M.kind[t] !== TYRE) continue; for (let k = 0; k < 3; k++) { const q = t * 9 + k * 3, r = Math.hypot(M.pos[q]! - w.hx, M.pos[q + 2]! - w.hz); R = Math.max(R, r); rim = Math.min(rim, r); } }
      const S = splitTyres(M, ts, hub); return { part: upload(gl, S, Array.from({ length: S.n }, (_, k) => k)), glass: gs.length ? upload(gl, M, gs, hub) : null, hub, front: w.front, R: R || w.r, rim: Number.isFinite(rim) ? rim : w.r * 0.7 }; }) }; }

/** a mesh's GPU side freed (review 121: a car's deformed mesh replaces the last) */
export function freeGpu(gl: WebGL2RenderingContext, g: GpuMesh): void { const parts: Part[] = [g.body, g.glass, ...(g.susp ? [g.susp.part] : []), ...(g.inner ? [g.inner.part] : []), ...g.wheels.flatMap(w => w.glass ? [w.part, w.glass] : [w.part])];
  for (const p of parts) { gl.deleteVertexArray(p.vao); for (const b of p.bufs ?? []) gl.deleteBuffer(b); } if (g.decalTex) gl.deleteTexture(g.decalTex);
  for (const l of [g.lines?.body, g.lines?.susp]) if (l) { gl.deleteVertexArray(l.vao); for (const b of l.bufs) gl.deleteBuffer(b); } }

// ---- the drift-game style's layers (docs/systems/109 §5), made the first time a piece is drawn in that look, so the
//      other looks cost nothing: the hull's normals and widths, the surface's normals, the atlas's coordinates ----
const PAINT_K = KINDS.indexOf('paint'), PLAIN_K = KINDS.indexOf('plain');
/** a piece's style layers added to its vertex array (once) */
export function styleUp(gl: WebGL2RenderingContext, p: Part): void { if (p.styled || !p.src) return; p.styled = true; const { M, tris } = p.src, nt = tris.length; if (!nt) return;
  const P = new Float32Array(nt * 9), K = new Uint8Array(nt), grp = new Int32Array(nt); tris.forEach((t, j) => { P.set(M.pos.subarray(t * 9, t * 9 + 9), j * 9); K[j] = M.kind[t]!; grp[j] = K[j] === PLAIN_K ? PAINT_K : K[j]!; });   /* paint and the plain trim beside it shade as one surface where they meet flush; any fold still splits them */
  const S = surfaceNormals(P, nt, grp, { creases: M.creases }), Hn = hullNormals(P, nt), H = new Float32Array(nt * 12);
  tris.forEach((t, j) => { const nm = M.names?.[M.part[t]!] ?? '', w = nm === 'seam' ? -1 : outlineShare(nm, M.kind[t]!); for (let k = 0; k < 3; k++) H.set([Hn[j * 9 + k * 3]!, Hn[j * 9 + k * 3 + 1]!, Hn[j * 9 + k * 3 + 2]!, w], (j * 3 + k) * 4); });
  let A: Float32Array | null = null; if (M.uv && M.uv.length === M.n * 9) { A = new Float32Array(nt * 9); tris.forEach((t, j) => A!.set(M.uv!.subarray(t * 9, t * 9 + 9), j * 9)); } else A = autoAtlasUV(P, K, nt);
  gl.bindVertexArray(p.vao); const bufs = p.bufs ?? (p.bufs = []);
  const buf = (loc: number, data: Float32Array, size: number) => { const b = gl.createBuffer()!; bufs.push(b); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); };
  buf(ATTR.hull, H, 4); buf(ATTR.surf, S, 3); if (A) buf(ATTR.atl, A, 3); gl.bindVertexArray(null); }
/** the drawn lines on the GPU: each segment a quad of six corners (its end, the other end, the side, the width's share, the bone) */
export interface LinePart { vao: WebGLVertexArrayObject; n: number; bufs: WebGLBuffer[] }
/** the ribbons' corners for polylines (mm, the mesh's axes): each segment two triangles, each corner its own end, the
 *  segment's other end and which side of the line it stands (the shader turns that into pixels on the screen) */
export function lineQuads(lines: { pts: V[]; closed?: boolean; w?: number; bone?: number }[]): { P: Float32Array; Q: Float32Array; S: Float32Array; B: Float32Array; n: number } {
  const P: number[] = [], Q: number[] = [], S: number[] = [], B: number[] = [];
  for (const l of lines) { const pts = l.closed && l.pts.length > 2 && Math.hypot(l.pts[0]![0] - l.pts[l.pts.length - 1]![0], l.pts[0]![1] - l.pts[l.pts.length - 1]![1], l.pts[0]![2] - l.pts[l.pts.length - 1]![2]) > 0.5 ? [...l.pts, l.pts[0]!] : l.pts;
    for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i]!, b = pts[i + 1]!; if (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) < 0.01) continue;
      for (const [p, q, s] of [[a, b, 1], [a, b, -1], [b, a, 1], [a, b, 1], [b, a, 1], [b, a, -1]] as [V, V, number][]) { P.push(...p); Q.push(...q); S.push(s, l.w ?? 1); B.push(l.bone ?? 0); } } }
  return { P: new Float32Array(P), Q: new Float32Array(Q), S: new Float32Array(S), B: new Float32Array(B), n: S.length / 2 }; }
function linePart(gl: WebGL2RenderingContext, lines: { pts: V[]; closed?: boolean; w?: number; bone?: number }[]): LinePart | null { const L = lineQuads(lines); if (!L.n) return null;
  const vao = gl.createVertexArray()!, bufs: WebGLBuffer[] = []; gl.bindVertexArray(vao);
  ([[0, L.P, 3], [1, L.Q, 3], [2, L.S, 2], [3, L.B, 1]] as const).forEach(([loc, d, size]) => { const b = gl.createBuffer()!; bufs.push(b); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); });
  gl.bindVertexArray(null); return { vao, n: L.n, bufs }; }
/** a mesh's drawn lines on the GPU (made once): its own (Mesh.lines) or, without them, those found at its body's hard
 *  edges; a line on a suspension part on that part's bone (the wheels carry none) */
export function styleLines(gl: WebGL2RenderingContext, g: GpuMesh): { body: LinePart | null; susp: LinePart | null } {
  if (g.lines) return g.lines; const M = g.body.src?.M; if (!M) return g.lines = { body: null, susp: null };
  const own = M.lines?.length ? M.lines : hardEdgeLines(M, { tris: g.body.src!.tris }), rig = g.susp?.rig, body: typeof own = [], susp: (typeof own[number] & { bone: number })[] = [];
  for (const l of own) { const m = l.pts[Math.floor(l.pts.length / 2)]!, b = rig && l.part ? boneAt(rig, l.part, m[0], m[1]) : -1; if (b > 0) susp.push({ ...l, bone: b }); else body.push(l); }
  return g.lines = { body: linePart(gl, body), susp: linePart(gl, susp) }; }
