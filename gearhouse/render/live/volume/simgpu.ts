// The volumetric smoke's simulation on the GPU (docs/systems/104 B-1, B-2, step V2): the passes of the CPU reference
// (race/volume/sim.ts), one fragment a cell, each grid a 2D atlas of its slices (atlas.ts) in half-float textures drawn
// to. The sums are the reference's, line for line, so the two can be compared (the same input, a small grid: B-4 V2).
//   fields: scal (r smoke, g dust, b heat, a the cut: where a car has just been, V4), vel (x, y, z the faces' u, v, w), p (pressure), div, obs (xyz a solid's
//   velocity, w solid), curl (xyz the vorticity, w its size), vf (the confinement's force), light (half resolution)
// The textures sit on units 24..31, past the renderer's own, so its bindings are left as they were.
import { program } from '../gpu';
import { atlasLayout, ATLAS_GLSL, type Atlas } from './atlas';
import type { VolParams, VolEmit, VolBox } from '../../../race/volume/sim';
import { LIGHT_FS } from './light';

const VS = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2. - 1., 0., 1.); }`;
const HEAD = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
${ATLAS_GLSL}
uniform float uDt, uH; uniform int uOpen; uniform vec3 uO;
ivec3 cellHere() { return cellOf(ivec2(gl_FragCoord.xy)); }
const ivec3 X = ivec3(1, 0, 0), Y = ivec3(0, 1, 0), Z = ivec3(0, 0, 1);
bool solidAt(sampler2D obs, ivec3 c) { return at(obs, c).w > 0.5; }
/** the faces past the far walls: open, as the last face inside; closed, still (the reference's faceU/V/W) */
float faceU(sampler2D v, ivec3 c) { return c.x < uN.x ? at(v, c).x : uOpen == 1 ? at(v, ivec3(uN.x - 1, c.y, c.z)).x : 0.; }
float faceV(sampler2D v, ivec3 c) { return c.y < uN.y ? at(v, c).y : uOpen == 1 ? at(v, ivec3(c.x, uN.y - 1, c.z)).y : 0.; }
float faceW(sampler2D v, ivec3 c) { return c.z < uN.z ? at(v, c).z : uOpen == 1 ? at(v, ivec3(c.x, c.y, uN.z - 1)).z : 0.; }
vec3 VEL(sampler2D v, vec3 p) { return vec3(tri(v, p, vec3(0., .5, .5)).x, tri(v, p, vec3(.5, 0., .5)).y, tri(v, p, vec3(.5, .5, 0.)).z); }
vec3 back(sampler2D v, vec3 p, float fall) { float s = uDt / uH; vec3 a = VEL(v, p); vec3 m = p - (a - vec3(0., 0., fall)) * s * 0.5; vec3 b = VEL(v, m); return p - (b - vec3(0., 0., fall)) * s; }
const ivec3 NB[6] = ivec3[6](ivec3(1, 0, 0), ivec3(-1, 0, 0), ivec3(0, 1, 0), ivec3(0, -1, 0), ivec3(0, 0, 1), ivec3(0, 0, -1));
`;
const OUT1 = `out vec4 o;\n`, OUT2 = `layout(location=0) out vec4 o0; layout(location=1) out vec4 o1;\n`;
const SRC = {
  shift: `uniform sampler2D uA; uniform ivec3 uD; ${OUT1}
void main() { ivec3 c = cellHere(); if (c.z >= uN.z) { o = vec4(0.); return; } ivec3 s = c + uD; o = inside(s) ? at(uA, s) : vec4(0.); }`,
  inject: `uniform sampler2D uScal, uVel; uniform int uEN; uniform vec4 uE0[32], uE1[32], uE2[32]; ${OUT2}
float g(vec3 p, vec4 e) { vec3 d = (uO + p * uH - e.xyz) / e.w; float d2 = dot(d, d); return d2 > 4. ? 0. : exp(-d2); }
void main() { ivec3 c = cellHere(); if (c.z >= uN.z) { o0 = o1 = vec4(0.); return; } vec4 s = at(uScal, c), v = at(uVel, c); vec3 p = vec3(c);
  for (int k = 0; k < 32; k++) { if (k >= uEN) break; vec4 e = uE0[k], a = uE1[k], w = uE2[k]; float m = g(p + .5, e);
    if (m > 0.) { s.r += a.x * m; s.g += a.y * m; s.b += (a.z - s.b) * m; s.a *= max(0., 1. - 2. * m); }
    v.x += (w.x - v.x) * g(p + vec3(0., .5, .5), e) * 0.8; v.y += (w.y - v.y) * g(p + vec3(.5, 0., .5), e) * 0.8; v.z += (w.z - v.z) * g(p + vec3(.5, .5, 0.), e) * 0.8; }
  o0 = s; o1 = v; }`,
  obstacles: `uniform sampler2D uTop; uniform int uBN; uniform vec4 uB0[8], uB1[8], uB2[8]; ${OUT1}
void main() { ivec3 c = cellHere(); if (c.z >= uN.z) { o = vec4(0.); return; } vec3 w = uO + (vec3(c) + .5) * uH;
  float s = w.z < texelFetch(uTop, c.xy, 0).r ? 1. : 0.; vec3 v = vec3(0.);
  for (int k = 0; k < 8; k++) { if (k >= uBN) break; vec4 b = uB0[k]; vec3 e = uB1[k].xyz; vec2 d = w.xy - b.xy; float cs = cos(b.w), sn = sin(b.w); vec2 l = vec2(d.x * cs + d.y * sn, -d.x * sn + d.y * cs);
    if (abs(l.x) < e.x && abs(l.y) < e.y && abs(w.z - b.z) < e.z) { s = 1.; v = uB2[k].xyz; } }
  o = vec4(v, s); }`,
  carve: `uniform sampler2D uScal, uObs; ${OUT1}
void main() { ivec3 c = cellHere(); if (c.z >= uN.z) { o = vec4(0.); return; } if (solidAt(uObs, c)) { o = vec4(0., 0., 0., 1.); return; } vec4 s = at(uScal, c); vec2 m = vec2(0.);
  for (int k = 0; k < 6; k++) { ivec3 n = c + NB[k]; if (!inside(n)) continue; if (solidAt(uObs, n)) m += at(uScal, n).rg; }
  s.rg += m / 6.; o = s; }`,
  advect: `uniform sampler2D uScal, uVel, uObs; uniform float uSettle; ${OUT2}
void main() { ivec3 c = cellHere(); if (c.z >= uN.z) { o0 = o1 = vec4(0.); return; } vec3 p = vec3(c); vec4 s = vec4(0., 0., 0., 1.);
  if (!solidAt(uObs, c)) { vec4 a = tri(uScal, back(uVel, p + .5, 0.), vec3(.5)); s.r = a.r; s.b = a.b; s.a = a.a; s.g = tri(uScal, back(uVel, p + .5, uSettle), vec3(.5)).g; }
  vec3 v; v.x = tri(uVel, back(uVel, p + vec3(0., .5, .5), 0.), vec3(0., .5, .5)).x; v.y = tri(uVel, back(uVel, p + vec3(.5, 0., .5), 0.), vec3(.5, 0., .5)).y; v.z = tri(uVel, back(uVel, p + vec3(.5, .5, 0.), 0.), vec3(.5, .5, 0.)).z;
  o0 = s; o1 = vec4(v, 0.); }`,
  curl: `uniform sampler2D uVel; ${OUT1}
vec3 cvel(ivec3 c) { c = clampC(c); return 0.5 * (at(uVel, c).xyz + vec3(faceU(uVel, c + X), faceV(uVel, c + Y), faceW(uVel, c + Z))); }
void main() { ivec3 c = cellHere(); if (c.z >= uN.z) { o = vec4(0.); return; } float d = 1. / (2. * uH);
  vec3 xp = cvel(c + X), xm = cvel(c - X), yp = cvel(c + Y), ym = cvel(c - Y), zp = cvel(c + Z), zm = cvel(c - Z);
  vec3 w = vec3((yp.z - ym.z) - (zp.y - zm.y), (zp.x - zm.x) - (xp.z - xm.z), (xp.y - xm.y) - (yp.x - ym.x)) * d; o = vec4(w, length(w)); }`,
  vforce: `uniform sampler2D uCurl, uScal; uniform float uVort, uCutSwirl; ${OUT1}
void main() { ivec3 c = cellHere(); if (c.z >= uN.z) { o = vec4(0.); return; }
  vec3 g = vec3(at(uCurl, c + X).w - at(uCurl, c - X).w, at(uCurl, c + Y).w - at(uCurl, c - Y).w, at(uCurl, c + Z).w - at(uCurl, c - Z).w); vec3 N = g / (length(g) + 1e-5);
  vec4 s = at(uScal, c); float e = uVort * uH * min(1., (s.r + s.g) * 4.) * (1. + uCutSwirl * 4. * s.a * (1. - s.a)); o = vec4(e * cross(N, at(uCurl, c).xyz), 0.); }`,
  forces: `uniform sampler2D uVel, uVF, uScal; uniform float uAlpha, uBetaS, uBetaD, uDrag, uCutPush; uniform vec2 uWind; ${OUT1}
void main() { ivec3 c = cellHere(); if (c.z >= uN.z) { o = vec4(0.); return; } vec3 v = at(uVel, c).xyz, f = at(uVF, c).xyz; vec4 s = at(uScal, c), sb = at(uScal, c - Z);
  float T = (sb.b + s.b) / 2., S = (sb.r + s.r) / 2., D = (sb.g + s.g) / 2.;
  v.x += uDt * ((at(uVF, c - X).x + f.x) / 2. + uDrag * (uWind.x - v.x) - uCutPush * (s.a - at(uScal, c - X).a)); v.y += uDt * ((at(uVF, c - Y).y + f.y) / 2. + uDrag * (uWind.y - v.y) - uCutPush * (s.a - at(uScal, c - Y).a));
  v.z += uDt * ((at(uVF, c - Z).z + f.z) / 2. + uAlpha * T - uBetaS * S - uBetaD * D - uDrag * 0.3 * v.z - uCutPush * (s.a - sb.a)); o = vec4(v, 0.); }`,
  bounds: `uniform sampler2D uVel, uObs; ${OUT1}
void main() { ivec3 c = cellHere(); if (c.z >= uN.z) { o = vec4(0.); return; } vec3 v = at(uVel, c).xyz; vec4 oc = at(uObs, c); bool sq = oc.w > 0.5;
  if (c.x > 0) { vec4 r = at(uObs, c - X); bool sr = r.w > 0.5; if (sq || sr) v.x = sq && sr ? (oc.x + r.x) / 2. : sq ? oc.x : r.x; } else if (sq) v.x = oc.x;
  if (c.y > 0) { vec4 r = at(uObs, c - Y); bool sr = r.w > 0.5; if (sq || sr) v.y = sq && sr ? (oc.y + r.y) / 2. : sq ? oc.y : r.y; } else if (sq) v.y = oc.y;
  if (c.z > 0) { vec4 r = at(uObs, c - Z); bool sr = r.w > 0.5; if (sq || sr) v.z = sq && sr ? (oc.z + r.z) / 2. : sq ? oc.z : r.z; } else if (sq) v.z = oc.z;
  if (c.x == 0 && !sq) v.x = uOpen == 1 ? at(uVel, ivec3(1, c.y, c.z)).x : 0.; if (c.y == 0 && !sq) v.y = uOpen == 1 ? at(uVel, ivec3(c.x, 1, c.z)).y : 0.; if (c.z == 0 && !sq) v.z = 0.;
  o = vec4(v, 0.); }`,
  div: `uniform sampler2D uVel, uObs; ${OUT1}
void main() { ivec3 c = cellHere(); if (c.z >= uN.z || solidAt(uObs, c)) { o = vec4(0.); return; } vec3 v = at(uVel, c).xyz;
  o = vec4(faceU(uVel, c + X) - v.x + faceV(uVel, c + Y) - v.y + faceW(uVel, c + Z) - v.z, 0., 0., 0.); }`,
  jacobi: `uniform sampler2D uP, uDiv, uObs; ${OUT1}
void main() { ivec3 c = cellHere(); if (c.z >= uN.z || solidAt(uObs, c)) { o = vec4(0.); return; } float s = 0., n = 0.;
  for (int k = 0; k < 6; k++) { ivec3 q = c + NB[k]; if (!inside(q)) { if (uOpen == 1 && q.z >= 0) n += 1.; continue; } if (solidAt(uObs, q)) continue; s += at(uP, q).r; n += 1.; }
  o = vec4(n > 0. ? (s - at(uDiv, c).r) / n : 0., 0., 0., 0.); }`,
  project: `uniform sampler2D uVel, uP; ${OUT1}
float P(ivec3 c) { return any(lessThan(c, ivec3(0))) ? 0. : at(uP, c).r; }
void main() { ivec3 c = cellHere(); if (c.z >= uN.z) { o = vec4(0.); return; } vec3 v = at(uVel, c).xyz; float pc = at(uP, c).r;
  if (c.x > 0 || uOpen == 1) v.x -= pc - P(c - X); if (c.y > 0 || uOpen == 1) v.y -= pc - P(c - Y); if (c.z > 0) v.z -= pc - P(c - Z); o = vec4(v, 0.); }`,
  dissipate: `uniform sampler2D uScal, uObs; uniform float uFade, uCool, uK, uCutFade, uCutHold; uniform int uEdge; ${OUT1}
void main() { ivec3 c = cellHere(); if (c.z >= uN.z) { o = vec4(0.); return; } vec4 s0 = at(uScal, c); if (solidAt(uObs, c)) { o = s0; return; } vec2 s = s0.rg;
  for (int k = 0; k < 6; k++) { ivec3 q = c + NB[k]; if (!inside(q) || solidAt(uObs, q)) continue; vec4 rq = at(uScal, q); vec2 r = rq.rg; float hb = 1. - 0.85 * max(s0.a, rq.a); s += min(vec2(1. / 7.), uK * hb * (r + s0.rg) / 2.) * (r - s0.rg); }
  float f = exp(-uFade * uDt) * max(0., 1. - uCutHold * uDt * smoothstep(0.45, 0.85, s0.a) * (1. - smoothstep(0.9, 0.97, s0.a))); if (uOpen == 1 && uEdge > 0) { int e = min(min(min(c.x, c.y), min(uN.x - 1 - c.x, uN.y - 1 - c.y)), uN.z - 1 - c.z); if (e < uEdge) f *= 1. - uDt * 3. * (1. - float(e) / float(uEdge)); }
  o = vec4(s * f, s0.b * exp(-uCool * uDt), s0.a * exp(-uCutFade * uDt)); }`,
  light: LIGHT_FS,
} as const;
type PassName = keyof typeof SRC;
/** a texture of the atlas's size, half float, read texel by texel or (the drawing's) smoothly within a tile */
function atlasTex(gl: WebGL2RenderingContext, A: { w: number; h: number }, fmt: number, linear = false): WebGLTexture { const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, A.w, A.h); const f = linear ? gl.LINEAR : gl.NEAREST; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
const UNIT0 = 24;

export class GpuVolume {
  readonly A: Atlas; /** the light's grid, half the resolution */ readonly AL: Atlas; origin: [number, number, number] = [0, 0, 0];
  /** the fields (the current of each pair first) */ scal: WebGLTexture[]; vel: WebGLTexture[]; p: WebGLTexture[]; div: WebGLTexture; obs: WebGLTexture; curl: WebGLTexture; vf: WebGLTexture; light: WebGLTexture; top: WebGLTexture;
  private progs = new Map<PassName, WebGLProgram>(); private fbos = new Map<string, WebGLFramebuffer>(); private texId = new Map<WebGLTexture, number>(); private locs = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  /** the passes' time last frame (ms, measured by the GPU's timer where it has one) */
  constructor(readonly gl: WebGL2RenderingContext, readonly P: VolParams) {
    this.A = atlasLayout(P.nx, P.ny, P.nz, Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number)); this.AL = atlasLayout(P.nx >> 1, P.ny >> 1, P.nz >> 1);
    const F = gl.RGBA16F, mk = (lin = false) => atlasTex(gl, this.A, F, lin);
    this.scal = [mk(true), mk(true)]; this.vel = [mk(true), mk(true)]; this.p = [atlasTex(gl, this.A, gl.R16F), atlasTex(gl, this.A, gl.R16F)]; this.div = atlasTex(gl, this.A, gl.R16F); this.obs = mk(); this.curl = mk(); this.vf = mk(); this.light = atlasTex(gl, this.AL, F, true);
    this.top = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, this.top); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R32F, P.nx, P.ny); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.setTop(new Float32Array(P.nx * P.ny).fill(-1e9)); this.clear(); }
  private prog(n: PassName): WebGLProgram { let p = this.progs.get(n); if (!p) { p = program(this.gl, VS, HEAD + SRC[n]); this.progs.set(n, p); } return p; }
  private loc(p: WebGLProgram, name: string) { let m = this.locs.get(p); if (!m) { m = new Map(); this.locs.set(p, m); } if (!m.has(name)) m.set(name, this.gl.getUniformLocation(p, name)); return m.get(name)!; }
  private fbo(out: WebGLTexture[]): WebGLFramebuffer { const gl = this.gl, key = out.map(t => { let k = this.texId.get(t); if (k === undefined) { k = this.texId.size; this.texId.set(t, k); } return k; }).join(',');
    let f = this.fbos.get(key); if (!f) { f = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, f); out.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0)); gl.drawBuffers(out.map((_, i) => gl.COLOR_ATTACHMENT0 + i)); this.fbos.set(key, f); } return f; }
  /** one pass: its program, its inputs (sampler name to texture), its uniforms set by `u`, drawn over the outputs' atlas */
  private run(n: PassName, out: WebGLTexture[], ins: Record<string, WebGLTexture>, u?: (loc: (s: string) => WebGLUniformLocation | null) => void, A: Atlas = this.A): void { const gl = this.gl, p = this.prog(n);
    gl.useProgram(p); gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo(out)); gl.viewport(0, 0, A.w, A.h);
    const L = (s: string) => this.loc(p, s); gl.uniform3i(L('uN'), this.P.nx, this.P.ny, this.P.nz); gl.uniform1i(L('uCols'), this.A.cols); gl.uniform1f(L('uH'), this.P.h); gl.uniform1i(L('uOpen'), this.P.open ? 1 : 0); gl.uniform3fv(L('uO'), this.origin);
    let unit = UNIT0; for (const [name, t] of Object.entries(ins)) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(L(name), unit); unit++; }
    u?.(L); gl.drawArrays(gl.TRIANGLES, 0, 3);
    for (let k = UNIT0; k < unit; k++) { gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, null); } }
  private swap(f: WebGLTexture[]) { const t = f[0]!; f[0] = f[1]!; f[1] = t; }
  /** every field emptied */
  clear(): void { const gl = this.gl; for (const t of [...this.scal, ...this.vel, ...this.p, this.div, this.obs, this.curl, this.vf]) { gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo([t])); gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo([this.light])); gl.clearBufferfv(gl.COLOR, 0, [1, 0, 0, 1]); }
  /** the solid ground and fences' tops, a column each (world z; -1e9 none) */
  setTop(top: Float32Array): void { const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, this.top); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.P.nx, this.P.ny, gl.RED, gl.FLOAT, top.map(v => Number.isFinite(v) ? v : -1e9)); }
  /** the grid moved by whole cells */
  shift(di: number, dj: number, dk: number): void { if (!di && !dj && !dk) return;
    for (const f of [this.scal, this.vel, this.p]) { this.run('shift', [f[1]!], { uA: f[0]! }, L => this.gl.uniform3i(L('uD'), di, dj, dk)); this.swap(f); }
    this.origin = [this.origin[0] + di * this.P.h, this.origin[1] + dj * this.P.h, this.origin[2] + dk * this.P.h]; }
  inject(E: readonly VolEmit[]): void { if (!E.length) return; const gl = this.gl;
    for (let k0 = 0; k0 < E.length; k0 += 32) { const B = E.slice(k0, k0 + 32), e0 = new Float32Array(128), e1 = new Float32Array(128), e2 = new Float32Array(128);
      B.forEach((e, i) => { e0.set([e.x, e.y, e.z, e.r], i * 4); e1.set([e.smoke, e.dust, e.T, 0], i * 4); e2.set([e.vx, e.vy, e.vz, 0], i * 4); });
      this.run('inject', [this.scal[1]!, this.vel[1]!], { uScal: this.scal[0]!, uVel: this.vel[0]! }, L => { gl.uniform1i(L('uEN'), B.length); gl.uniform4fv(L('uE0'), e0); gl.uniform4fv(L('uE1'), e1); gl.uniform4fv(L('uE2'), e2); });
      this.swap(this.scal); this.swap(this.vel); } }
  obstacles(B: readonly VolBox[]): void { const gl = this.gl, b0 = new Float32Array(32), b1 = new Float32Array(32), b2 = new Float32Array(32), n = Math.min(8, B.length);
    B.slice(0, 8).forEach((b, i) => { b0.set([b.x, b.y, b.z, b.yaw], i * 4); b1.set([b.hx, b.hy, b.hz, 0], i * 4); b2.set([b.vx, b.vy, b.vz, 0], i * 4); });
    this.run('obstacles', [this.obs], { uTop: this.top }, L => { gl.uniform1i(L('uBN'), n); gl.uniform4fv(L('uB0'), b0); gl.uniform4fv(L('uB1'), b1); gl.uniform4fv(L('uB2'), b2); }); }
  /** the velocity's faces by a solid or a wall */
  private bounds() { this.run('bounds', [this.vel[1]!], { uVel: this.vel[0]!, uObs: this.obs }); this.swap(this.vel); }
  /** one step of dt: the reference's step(), pass for pass */
  step(dt: number, emits: readonly VolEmit[] = [], boxes: readonly VolBox[] = []): void { const gl = this.gl, P = this.P;
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.STENCIL_TEST); gl.disable(gl.BLEND); gl.disable(gl.SCISSOR_TEST); gl.depthMask(false); gl.bindVertexArray(null);
    const dtU = (L: (s: string) => WebGLUniformLocation | null) => gl.uniform1f(L('uDt'), dt);
    this.inject(emits); this.obstacles(boxes);
    this.run('carve', [this.scal[1]!], { uScal: this.scal[0]!, uObs: this.obs }); this.swap(this.scal);
    this.run('advect', [this.scal[1]!, this.vel[1]!], { uScal: this.scal[0]!, uVel: this.vel[0]!, uObs: this.obs }, L => { dtU(L); gl.uniform1f(L('uSettle'), P.settle); }); this.swap(this.scal); this.swap(this.vel);
    this.run('curl', [this.curl], { uVel: this.vel[0]! });
    this.run('vforce', [this.vf], { uCurl: this.curl, uScal: this.scal[0]! }, L => { gl.uniform1f(L('uVort'), P.vort); gl.uniform1f(L('uCutSwirl'), P.cutSwirl); });
    this.run('forces', [this.vel[1]!], { uVel: this.vel[0]!, uVF: this.vf, uScal: this.scal[0]! }, L => { dtU(L); gl.uniform1f(L('uAlpha'), P.alpha); gl.uniform1f(L('uBetaS'), P.betaS); gl.uniform1f(L('uBetaD'), P.betaD); gl.uniform1f(L('uDrag'), P.drag); gl.uniform1f(L('uCutPush'), P.cutPush); gl.uniform2fv(L('uWind'), P.wind); }); this.swap(this.vel);
    this.bounds();
    this.run('div', [this.div], { uVel: this.vel[0]!, uObs: this.obs });
    for (let i = 0; i < P.iters; i++) { this.run('jacobi', [this.p[1]!], { uP: this.p[0]!, uDiv: this.div, uObs: this.obs }); this.swap(this.p); }
    this.run('project', [this.vel[1]!], { uVel: this.vel[0]!, uP: this.p[0]! }); this.swap(this.vel); this.bounds();
    this.run('dissipate', [this.scal[1]!], { uScal: this.scal[0]!, uObs: this.obs }, L => { dtU(L); gl.uniform1f(L('uFade'), P.fade); gl.uniform1f(L('uCool'), P.cool); gl.uniform1f(L('uK'), P.spread * dt / (P.h * P.h)); gl.uniform1i(L('uEdge'), P.edge); gl.uniform1f(L('uCutFade'), P.cutFade); gl.uniform1f(L('uCutHold'), P.cutHold); }); this.swap(this.scal); }
  /** the light's grid: the share of the sun reaching each (half-resolution) cell */
  lightPass(sun: readonly number[], sigma = 4): void { const gl = this.gl;
    this.run('light', [this.light], { uScal: this.scal[0]! }, L => { gl.uniform3i(L('uNL'), this.AL.nx, this.AL.ny, this.AL.nz); gl.uniform1i(L('uColsL'), this.AL.cols); gl.uniform3fv(L('uSunG'), [...sun]); gl.uniform1f(L('uSigma'), sigma); }, this.AL); }
  /** a field read back to the CPU, laid out as the reference's arrays (for the comparison; slow) */
  read(which: 'scal' | 'vel' | 'light' = 'scal'): Float32Array[] { const gl = this.gl, A = which === 'light' ? this.AL : this.A, t = which === 'scal' ? this.scal[0]! : which === 'vel' ? this.vel[0]! : this.light;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo([t])); const px = new Float32Array(A.w * A.h * 4); gl.readPixels(0, 0, A.w, A.h, gl.RGBA, gl.FLOAT, px);
    const n = A.nx * A.ny * A.nz, out = [0, 1, 2, 3].map(() => new Float32Array(n));
    for (let k = 0; k < A.nz; k++) for (let j = 0; j < A.ny; j++) for (let i = 0; i < A.nx; i++) { const x = (k % A.cols) * A.nx + i, y = Math.floor(k / A.cols) * A.ny + j, q = i + A.nx * (j + A.ny * k), r = (y * A.w + x) * 4;
      for (let c = 0; c < 4; c++) out[c]![q] = px[r + c]!; }
    return out; }
  /** a field written from the CPU's arrays (the comparison's start) */
  write(which: 'scal' | 'vel', ch: Float32Array[]): void { const gl = this.gl, A = this.A, px = new Float32Array(A.w * A.h * 4);
    for (let k = 0; k < A.nz; k++) for (let j = 0; j < A.ny; j++) for (let i = 0; i < A.nx; i++) { const x = (k % A.cols) * A.nx + i, y = Math.floor(k / A.cols) * A.ny + j, q = i + A.nx * (j + A.ny * k), r = (y * A.w + x) * 4;
      for (let c = 0; c < 4; c++) px[r + c] = ch[c]?.[q] ?? 0; }
    const tmp = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, tmp); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, A.w, A.h, 0, gl.RGBA, gl.FLOAT, px); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const f = which === 'scal' ? this.scal : this.vel; this.run('shift', [f[0]!], { uA: tmp }, L => gl.uniform3i(L('uD'), 0, 0, 0)); gl.deleteTexture(tmp); }
  dispose(): void { const gl = this.gl; for (const t of [...this.scal, ...this.vel, ...this.p, this.div, this.obs, this.curl, this.vf, this.light, this.top]) gl.deleteTexture(t); for (const f of this.fbos.values()) gl.deleteFramebuffer(f); for (const p of this.progs.values()) gl.deleteProgram(p); }
}
