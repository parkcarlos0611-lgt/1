// The live renderer's GPU side (review 99, brief 72 steps 1-3): WebGL2 programs, a mesh's buffers, matrices.
// Meshes keep the car files' axes (x back from the nose, y to the car's right, z up, mm); a model matrix puts them in
// the world (x east, y north, z up, metres).
import { KINDS, wheelsOf, type Mesh, type Decal, decalPicture } from '../car/mesh';
import { boneAt, type SuspRig } from '../car/suspension';

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
export interface Part { vao: WebGLVertexArrayObject; n: number; lamps?: LampAt[]; /** its buffers, to free them */ bufs?: WebGLBuffer[] }
export const ATTR = { pos: 0, nor: 1, col: 2, gloss: 3, kind: 4, part: 5, smooth: 6, lamp: 7, lampAx: 8, lampRt: 9, /** the suspension's parts only: the bone each corner hangs on */ bone: 10 } as const;
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
  gl.bindVertexArray(null); return { vao, n, lamps: LP.lamps, bufs }; }
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
export interface GpuMesh { len: number; body: Part; glass: Part; wheels: { part: Part; glass: Part | null; hub: [number, number, number]; front: boolean; /** the tyre's outer and inner radius (mm) */ R: number; rim: number }[]; decals: Decal[]; decalTex: WebGLTexture | null; /** the suspension's moving parts apart, each corner with its bone, and the rig that poses them (render/car/suspension) */ susp?: { part: Part; rig: SuspRig }; radius: number; height: number; width: number; /** its lamps (review 117) */ lamps: LampAt[] }
const GLASS = KINDS.indexOf('glass'), SHINE = KINDS.indexOf('shine'), TYRE = KINDS.indexOf('tyre'), LENS = KINDS.indexOf('lens');
export function gpuMesh(gl: WebGL2RenderingContext, M: Mesh, wheels = true): GpuMesh {
  const W = wheels ? wheelsOf(M) : [], inWheel = new Int32Array(M.n).fill(-1); W.forEach((w, k) => { for (const t of w.tris) inWheel[t] = k; });
  const isGlass = (t: number) => M.kind[t] === GLASS || M.kind[t] === SHINE, body: number[] = [], glass: number[] = [];
  // a triangle with no area has no normal: on some GPUs (phones) normalising it gives NaN, drawn as white specks that the
  // bloom spreads (review 146). Such slivers (the centres of turned parts, caps, lens fans) are dropped here for every car.
  const P0 = M.pos, flat = (t: number) => { const i = t * 9, ux = P0[i + 3]! - P0[i]!, uy = P0[i + 4]! - P0[i + 1]!, uz = P0[i + 5]! - P0[i + 2]!, vx = P0[i + 6]! - P0[i]!, vy = P0[i + 7]! - P0[i + 1]!, vz = P0[i + 8]! - P0[i + 2]!;
    return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) < 0.5; };
  const rig = wheels ? M.susp : undefined, susp: number[] = [], bone: number[] = [];
  for (let t = 0; t < M.n; t++) if (inWheel[t]! < 0 && !flat(t)) { const i = t * 9, b = rig ? boneAt(rig, M.names?.[M.part[t]!] ?? '', (P0[i]! + P0[i + 3]! + P0[i + 6]!) / 3, (P0[i + 1]! + P0[i + 4]! + P0[i + 7]!) / 3) : -1;
    if (b > 0) { susp.push(t); bone.push(b); } else (isGlass(t) ? glass : body).push(t); }
  let R = 0, Z = 0, Y = 0; for (let i = 0; i < M.pos.length; i += 3) { R = Math.max(R, Math.hypot(M.pos[i]! - M.length / 2, M.pos[i + 1]!)); Z = Math.max(Z, M.pos[i + 2]!); Y = Math.max(Y, Math.abs(M.pos[i + 1]!)); }
  const decals = (M.decals ?? []).slice(0, 4); let decalTex: WebGLTexture | null = null;
  if (decals.length) { const S = 128; decalTex = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, decalTex); const all = new Uint8Array(S * 4 * S * 4);
    decals.forEach((d, k) => { const pic = decalPicture(d, S); for (let j = 0; j < S; j++) all.set(pic.subarray(j * S * 4, (j + 1) * S * 4), (j * S * 4 + k * S) * 4); });
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, S * 4, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, all); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
  const bodyP = upload(gl, M, body), glassP = upload(gl, M, glass), lamps = [...(glassP.lamps ?? [])]; for (const l of bodyP.lamps ?? []) if (!lamps.some(k => Math.hypot(k.c[0] - l.c[0], k.c[1] - l.c[1], k.c[2] - l.c[2]) < Math.max(k.R, l.R))) lamps.push(l);
  return { len: M.length, body: bodyP, glass: glassP, lamps, ...(rig && susp.length ? { susp: { part: upload(gl, M, susp, undefined, bone), rig } } : {}), decals, decalTex, radius: R / 1000, height: Z / 1000, width: 2 * Y / 1000,
    wheels: W.map(w => { const hub: [number, number, number] = [w.hx, w.hy, w.hz], ts = w.tris.filter(t => !isGlass(t) && !flat(t)), gs = w.tris.filter(t => isGlass(t) && !flat(t));
      let R = 0, rim = Infinity; for (const t of w.tris) { if (M.kind[t] !== TYRE) continue; for (let k = 0; k < 3; k++) { const q = t * 9 + k * 3, r = Math.hypot(M.pos[q]! - w.hx, M.pos[q + 2]! - w.hz); R = Math.max(R, r); rim = Math.min(rim, r); } }
      const S = splitTyres(M, ts, hub); return { part: upload(gl, S, Array.from({ length: S.n }, (_, k) => k)), glass: gs.length ? upload(gl, M, gs, hub) : null, hub, front: w.front, R: R || w.r, rim: Number.isFinite(rim) ? rim : w.r * 0.7 }; }) }; }

/** a mesh's GPU side freed (review 121: a car's deformed mesh replaces the last) */
export function freeGpu(gl: WebGL2RenderingContext, g: GpuMesh): void { const parts: Part[] = [g.body, g.glass, ...(g.susp ? [g.susp.part] : []), ...g.wheels.flatMap(w => w.glass ? [w.part, w.glass] : [w.part])];
  for (const p of parts) { gl.deleteVertexArray(p.vao); for (const b of p.bufs ?? []) gl.deleteBuffer(b); } if (g.decalTex) gl.deleteTexture(g.decalTex); }
