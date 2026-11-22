// The live renderer's GPU side (review 99, brief 72 steps 1-3): WebGL2 programs, a mesh's buffers, matrices.
// Meshes keep the car files' axes (x back from the nose, y to the car's right, z up, mm); a model matrix puts them in
// the world (x east, y north, z up, metres).
import { KINDS, wheelsOf, type Mesh, type Decal, decalPicture } from '../car/mesh';

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
export interface Part { vao: WebGLVertexArrayObject; n: number }
export const ATTR = { pos: 0, nor: 1, col: 2, gloss: 3, kind: 4, part: 5 } as const;
/** triangles of a mesh (by index) into a vertex array; `glass`: only the glass and shine, else everything but them */
function upload(gl: WebGL2RenderingContext, M: Mesh, tris: number[], about?: [number, number, number]): Part {
  const n = tris.length * 3, P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Uint8Array(n * 3), G = new Float32Array(n), K = new Float32Array(n), Q = new Float32Array(n);
  tris.forEach((t, j) => { const q = t * 9, p = M.pos, ax = p[q + 3]! - p[q]!, ay = p[q + 4]! - p[q + 1]!, az = p[q + 5]! - p[q + 2]!, bx = p[q + 6]! - p[q]!, by = p[q + 7]! - p[q + 1]!, bz = p[q + 8]! - p[q + 2]!;
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (let k = 0; k < 3; k++) { const v = j * 3 + k; P[v * 3] = p[q + k * 3]! - (about?.[0] ?? 0); P[v * 3 + 1] = p[q + k * 3 + 1]! - (about?.[1] ?? 0); P[v * 3 + 2] = p[q + k * 3 + 2]! - (about?.[2] ?? 0);
      N[v * 3] = nx; N[v * 3 + 1] = ny; N[v * 3 + 2] = nz; C[v * 3] = M.col[t * 3]!; C[v * 3 + 1] = M.col[t * 3 + 1]!; C[v * 3 + 2] = M.col[t * 3 + 2]!; G[v] = M.gloss[t]!; K[v] = M.kind[t]!; Q[v] = M.part[t]!; } });
  const vao = gl.createVertexArray()!; gl.bindVertexArray(vao);
  const buf = (loc: number, data: ArrayBufferView, size: number, type: number, normalized = false) => { const b = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type, normalized, 0, 0); };
  buf(ATTR.pos, P, 3, gl.FLOAT); buf(ATTR.nor, N, 3, gl.FLOAT); buf(ATTR.col, C, 3, gl.UNSIGNED_BYTE, true); buf(ATTR.gloss, G, 1, gl.FLOAT); buf(ATTR.kind, K, 1, gl.FLOAT); buf(ATTR.part, Q, 1, gl.FLOAT);
  gl.bindVertexArray(null); return { vao, n }; }

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
export interface GpuMesh { len: number; body: Part; glass: Part; wheels: { part: Part; glass: Part | null; hub: [number, number, number]; front: boolean; /** the tyre's outer and inner radius (mm) */ R: number; rim: number }[]; decals: Decal[]; decalTex: WebGLTexture | null; radius: number; height: number; width: number }
const GLASS = KINDS.indexOf('glass'), SHINE = KINDS.indexOf('shine'), TYRE = KINDS.indexOf('tyre');
export function gpuMesh(gl: WebGL2RenderingContext, M: Mesh, wheels = true): GpuMesh {
  const W = wheels ? wheelsOf(M) : [], inWheel = new Int32Array(M.n).fill(-1); W.forEach((w, k) => { for (const t of w.tris) inWheel[t] = k; });
  const isGlass = (t: number) => M.kind[t] === GLASS || M.kind[t] === SHINE, body: number[] = [], glass: number[] = [];
  for (let t = 0; t < M.n; t++) if (inWheel[t]! < 0) (isGlass(t) ? glass : body).push(t);
  let R = 0, Z = 0, Y = 0; for (let i = 0; i < M.pos.length; i += 3) { R = Math.max(R, Math.hypot(M.pos[i]! - M.length / 2, M.pos[i + 1]!)); Z = Math.max(Z, M.pos[i + 2]!); Y = Math.max(Y, Math.abs(M.pos[i + 1]!)); }
  const decals = (M.decals ?? []).slice(0, 4); let decalTex: WebGLTexture | null = null;
  if (decals.length) { const S = 128; decalTex = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, decalTex); const all = new Uint8Array(S * 4 * S * 4);
    decals.forEach((d, k) => { const pic = decalPicture(d, S); for (let j = 0; j < S; j++) all.set(pic.subarray(j * S * 4, (j + 1) * S * 4), (j * S * 4 + k * S) * 4); });
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, S * 4, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, all); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
  return { len: M.length, body: upload(gl, M, body), glass: upload(gl, M, glass), decals, decalTex, radius: R / 1000, height: Z / 1000, width: 2 * Y / 1000,
    wheels: W.map(w => { const hub: [number, number, number] = [w.hx, w.hy, w.hz], ts = w.tris.filter(t => !isGlass(t)), gs = w.tris.filter(isGlass);
      let R = 0, rim = Infinity; for (const t of w.tris) { if (M.kind[t] !== TYRE) continue; for (let k = 0; k < 3; k++) { const q = t * 9 + k * 3, r = Math.hypot(M.pos[q]! - w.hx, M.pos[q + 2]! - w.hz); R = Math.max(R, r); rim = Math.min(rim, r); } }
      const S = splitTyres(M, ts, hub); return { part: upload(gl, S, Array.from({ length: S.n }, (_, k) => k)), glass: gs.length ? upload(gl, M, gs, hub) : null, hub, front: w.front, R: R || w.r, rim: Number.isFinite(rim) ? rim : w.r * 0.7 }; }) }; }
