// The woods for the live renderer (review 181): thousands of trees drawn at once (GPU instancing), in two levels of
// detail by their distance from the eye. Near ones are the low-poly trees of render/props/aerodrome.ts (a round-headed
// tree, a Scots pine, a poplar, a bush), each copy placed, turned and sized by its instance, lit, shadowed and outlined
// as everything else; far ones are cards that turn about the upright to face the eye, their crown drawn in the shader
// (an outline of lumps, a rounded normal for the light), one draw for all of them. Which trees are near is worked out
// again when the eye has moved a few metres or the density setting changed (race/scenery.ts: 풍경 밀도).
import { treeRound, treePine, treePoplar, bush } from '../props/aerodrome';
import { program } from './gpu';
import { DENSITY_SHARE, sceneryDensity, type Tree, type Density } from '../../race/scenery';
import type { Mesh } from '../car/mesh';

/** how near (m) a tree is drawn in 3D with the perspective camera, by the density (the belt closed along the fence put
 *  twice the trees near the eye, review 184: the nearer cut keeps the 3D trees' triangles about where they were); and
 *  how far any is drawn at all */
export const NEAR_3D: Record<Density, number> = { low: 90, mid: 110, high: 140 }, FAR_CARD = 2600;
const MESHES: (() => Mesh)[] = [treeRound, treePine, treePoplar, bush];

const VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec3 aCol; layout(location=3) in vec4 aI; layout(location=4) in vec2 aJ;
uniform mat4 uVP, uPrevVP; out vec3 vWorld, vN, vCol; out vec4 vCur, vPrev;
void main() { float c = cos(aI.w), s = sin(aI.w), k = aJ.x; vec3 p = aPos * k; vec3 w = vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z) + aI.xyz;
  vWorld = w; vN = vec3(c * aNor.x - s * aNor.y, s * aNor.x + c * aNor.y, aNor.z);
  float h = fract(sin(dot(aI.xy, vec2(12.9898, 78.233))) * 43758.5453); vCol = aCol * mix(vec3(0.86, 0.9, 0.84), vec3(1.1, 1.08, 1.02), h);   /* each tree its own shade of green */
  gl_Position = uVP * vec4(w, 1.); vCur = gl_Position; vPrev = uPrevVP * vec4(w, 1.); }`;
const DEPTH_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=3) in vec4 aI; layout(location=4) in vec2 aJ; uniform mat4 uVP;
void main() { float c = cos(aI.w), s = sin(aI.w); vec3 p = aPos * aJ.x; gl_Position = uVP * vec4(vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z) + aI.xyz, 1.); }`;
const DEPTH_FS = `#version 300 es
precision mediump float; out vec4 o; void main() { o = vec4(1.); }`;
const fsOf = (light: string) => `#version 300 es
precision highp float;
${light}
in vec3 vWorld, vN, vCol; in vec4 vCur, vPrev; uniform vec3 uSun, uEye; uniform vec2 uSize, uObj; uniform float uOutline;
layout(location=0) out vec4 oCol; layout(location=1) out vec4 oId; layout(location=2) out vec4 oN; layout(location=3) out vec4 oV;
vec4 velo() { vec2 d = (vCur.xy / vCur.w - vPrev.xy / vPrev.w) * 0.5 * uSize; return vec4(clamp(d / 128. + 0.5, 0., 1.), 0., 1.); }
void main() { vec3 n = normalize(vN); float sh = lightAt(vWorld + n * 0.05), ao = 0.75 + 0.25 * clamp(n.z * 0.5 + 0.5, 0., 1.);
  vec3 col = uLook == 3 ? toonLight(vCol, n, uSun, sh, ao, vWorld) : present(pbrX(vCol, n, uEye, uSun, sh, 0., 0.85, 0., ao, 0.3) + lampsAt(vWorld, n) * toLin(vCol) / 3.14159);
  oCol = vec4(clamp(col, 0., uHDRo == 1 && uLook != 3 ? 48. : 1.), 1.); oId = vec4(uObj, 0., uOutline / 8.); oN = vec4(n * 0.5 + 0.5, 0.); oV = velo(); }`;
// the cards: a quad (u -1..1 across, v 0..1 up) turned about the upright to the eye; per tree its place, kind, size
const CARD_VS = `#version 300 es
layout(location=0) in vec2 aQ; layout(location=3) in vec4 aI; layout(location=4) in vec2 aJ;
uniform mat4 uVP, uPrevVP; uniform vec3 uEyeP; uniform vec4 uW, uH; out vec3 vWorld, vRt, vTo; out vec2 vQ; out vec4 vCur, vPrev; flat out float vKind, vSeed;
void main() { int k = int(aJ.y + 0.5); float w = uW[k] * aJ.x, h = uH[k] * aJ.x; vec2 to = uEyeP.xy - aI.xy; float l = length(to); to = l > 1e-3 ? to / l : vec2(1., 0.);
  vec3 rt = vec3(-to.y, to.x, 0.), d3 = normalize(uEyeP - aI.xyz - vec3(0., 0., h * 0.5)), nf = normalize(mix(vec3(to, 0.), d3, 0.85)), up = normalize(cross(nf, rt));   /* seen from above, the card leans back to face the eye (its foot kept) */
  vec3 p = aI.xyz + rt * aQ.x * w * 0.5 + up * (aQ.y * h);
  vWorld = p; vRt = rt; vTo = nf; vQ = aQ; vKind = aJ.y; vSeed = fract(sin(dot(aI.xy, vec2(12.9898, 78.233))) * 43758.5453);
  gl_Position = uVP * vec4(p, 1.); vCur = gl_Position; vPrev = uPrevVP * vec4(p, 1.); }`;
const cardFsOf = (light: string) => `#version 300 es
precision highp float;
${light}
in vec3 vWorld, vRt, vTo; in vec2 vQ; in vec4 vCur, vPrev; flat in float vKind, vSeed; uniform vec3 uSun, uEye; uniform vec2 uObj, uSize; uniform float uOutline; uniform vec3 uLeaf[4];
layout(location=0) out vec4 oCol; layout(location=1) out vec4 oId; layout(location=2) out vec4 oN; layout(location=3) out vec4 oV;
/** the crown's outline about its middle c with half-sizes r, its rim in lumps: 1 inside, and the rounded normal's lean */
float lumps(vec2 q, vec2 c, vec2 r, float n, out vec3 nl) { vec2 d = (q - c) / r; float a = atan(d.y, d.x), rr = 1. + 0.09 * sin(a * n + vSeed * 6.28) + 0.05 * sin(a * (n * 2. + 1.) + vSeed * 17.);
  float e = length(d) / rr; nl = vec3(d / rr, sqrt(max(0., 1. - e * e))); return e; }
void main() { int k = int(vKind + 0.5); vec2 q = vQ; vec3 nl = vec3(0., 0., 1.); float e = 2.; bool trunk = false;
  if (k == 0) { e = lumps(q, vec2(0., 0.66), vec2(0.96, 0.33), 5., nl); trunk = abs(q.x) < 0.07 && q.y < 0.45; }
  else if (k == 1) { e = lumps(q, vec2(0., 0.86), vec2(0.95, 0.13), 4., nl); trunk = abs(q.x) < 0.05 + 0.03 * (1. - q.y) && q.y < 0.9; }
  else if (k == 2) { float t = clamp((q.y - 0.08) / 0.92, 0., 1.), hw = 0.92 * pow(sin(3.14159 * t), 0.75) * (1. - 0.35 * t); e = hw > 0.01 ? abs(q.x) / hw : 2.; nl = vec3(q.x / max(hw, 0.01), (t - 0.5) * 0.6, sqrt(max(0., 1. - e * e))); trunk = abs(q.x) < 0.06 && q.y < 0.12; }
  else { e = lumps(q, vec2(0., 0.), vec2(1., 0.95), 3., nl); if (q.y < 0.) e = 2.; }
  if (e > 1. && !trunk) discard;
  vec3 base = e <= 1. ? uLeaf[k] * mix(0.86, 1.1, vSeed) : vec3(0.36, 0.29, 0.22); vec3 upv = normalize(cross(vTo, vRt)), n = e <= 1. ? normalize(vRt * nl.x + upv * nl.y + vTo * nl.z * 0.9 + vec3(0., 0., 0.25)) : vTo;
  float sh = lightAt(vWorld + vTo * 0.5), ao = e <= 1. ? 0.7 + 0.3 * clamp(nl.y * 0.5 + 0.5, 0., 1.) : 0.6;
  vec3 col = uLook == 3 ? toonLight(base, n, uSun, sh, ao, vWorld) : present(pbrX(base, n, uEye, uSun, sh, 0., 0.85, 0., ao, 0.3));
  oCol = vec4(clamp(col, 0., uHDRo == 1 && uLook != 3 ? 48. : 1.), 1.); oId = vec4(uObj, 0., uOutline / 8.); oN = vec4(n * 0.5 + 0.5, 0.); vec2 dv = (vCur.xy / vCur.w - vPrev.xy / vPrev.w) * 0.5 * uSize; oV = vec4(clamp(dv / 128. + 0.5, 0., 1.), 0., 1.); }`;

/** how far a crown's normals lean from each facet's own toward the way out from the tree's middle (0 flat facets, 1 a
 *  ball): rounded a little more on review so the near trees' low-poly crowns read calm, their facets still faintly there */
export const LEAF_ROUND = 0.7;
/** a tree mesh as triangles in metres about its foot (the mesh's middle of its length), with normals rounded outward (a crown shades as a lump, not as facets) and its colours */
export function treeGeometry(M: Mesh): { pos: Float32Array; nor: Float32Array; col: Float32Array; n: number; w: number; h: number } {
  const n = M.pos.length / 9, pos = new Float32Array(n * 9), nor = new Float32Array(n * 9), col = new Float32Array(n * 9), half = M.length / 2; let zc = 0, w = 0, h = 0;
  for (let i = 0; i < M.pos.length; i += 3) zc += M.pos[i + 2]! / (n * 3000);
  for (let t = 0; t < n; t++) { const q = t * 9, P = [0, 1, 2].map(v => [(M.pos[q + v * 3]! - half) / 1000, M.pos[q + v * 3 + 1]! / 1000, M.pos[q + v * 3 + 2]! / 1000] as [number, number, number]);
    const ax = P[1]![0] - P[0]![0], ay = P[1]![1] - P[0]![1], az = P[1]![2] - P[0]![2], bx = P[2]![0] - P[0]![0], by = P[2]![1] - P[0]![1], bz = P[2]![2] - P[0]![2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const cx = (P[0]![0] + P[1]![0] + P[2]![0]) / 3, cy = (P[0]![1] + P[1]![1] + P[2]![1]) / 3, cz = (P[0]![2] + P[1]![2] + P[2]![2]) / 3; if (nx * cx + ny * cy + nz * (cz - zc) < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const leaf = M.kind[t] === 7; for (let v = 0; v < 3; v++) { const p = P[v]!; pos.set(p, q + v * 3); let rx = p[0], ry = p[1], rz = p[2] - zc; const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
      const m = leaf ? LEAF_ROUND : 0, mx = nx * (1 - m) + rx * m, my = ny * (1 - m) + ry * m, mz = nz * (1 - m) + rz * m, ml = Math.hypot(mx, my, mz) || 1; nor.set([mx / ml, my / ml, mz / ml], q + v * 3);
      col.set([M.col[t * 3]! / 255, M.col[t * 3 + 1]! / 255, M.col[t * 3 + 2]! / 255], q + v * 3); w = Math.max(w, Math.abs(p[0]), Math.abs(p[1])); h = Math.max(h, p[2]); } }
  return { pos, nor, col, n: n * 3, w: w * 2, h }; }

/** the programs, made once per context */
const PROGS = new WeakMap<WebGL2RenderingContext, [WebGLProgram, WebGLProgram, WebGLProgram]>();
interface Species { vao: WebGLVertexArrayObject; dvao: WebGLVertexArrayObject; n: number; inst: WebGLBuffer; count: number; bufs: WebGLBuffer[] }
export class Woods {
  private sp: Species[] = []; private card: { vao: WebGLVertexArrayObject; inst: WebGLBuffer; count: number; bufs: WebGLBuffer[] };
  private P3!: WebGLProgram; private PD!: WebGLProgram; private PC!: WebGLProgram; private W = [0, 0, 0, 0]; private H = [0, 0, 0, 0]; private leaf: number[] = [];
  private at: [number, number] | null = null; private ortho = false; private dens: Density | null = null; private u = new Map<string, WebGLUniformLocation | null>();
  /** what is drawn now: trees in 3D, as cards, and the 3D trees' triangles */
  stats = { near: 0, far: 0, tris: 0, all: 0 };
  constructor(private gl: WebGL2RenderingContext, light: string, private trees: Tree[]) {
    let P = PROGS.get(gl); if (!P) { P = [program(gl, VS, fsOf(light)), program(gl, DEPTH_VS, DEPTH_FS), program(gl, CARD_VS, cardFsOf(light))]; PROGS.set(gl, P); } [this.P3, this.PD, this.PC] = P;
    MESHES.forEach((f, k) => { const M = f(), g = treeGeometry(M), bufs: WebGLBuffer[] = [];
      let lr = 0, lg = 0, lb = 0, ln = 0; for (let t = 0; t < M.n; t++) if (M.kind[t] === 7) { lr += M.col[t * 3]!; lg += M.col[t * 3 + 1]!; lb += M.col[t * 3 + 2]!; ln++; } this.leaf.push(lr / ln / 255, lg / ln / 255, lb / ln / 255);
      this.W[k] = g.w; this.H[k] = g.h * 1.04;
      const inst = gl.createBuffer()!; bufs.push(inst);
      const vao = (depth: boolean) => { const a = gl.createVertexArray()!; gl.bindVertexArray(a);
        const b = (loc: number, d: Float32Array, size: number) => { const buf = gl.createBuffer()!; bufs.push(buf); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); };
        b(0, g.pos, 3); if (!depth) { b(1, g.nor, 3); b(2, g.col, 3); } this.instAttrs(inst); gl.bindVertexArray(null); return a; };
      this.sp.push({ vao: vao(false), dvao: vao(true), n: g.n, inst, count: 0, bufs }); });
    { const a = gl.createVertexArray()!, bufs: WebGLBuffer[] = []; gl.bindVertexArray(a); const q = gl.createBuffer()!; bufs.push(q); gl.bindBuffer(gl.ARRAY_BUFFER, q); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 0, 1, 0, 1, 1, -1, 0, 1, 1, -1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); const inst = gl.createBuffer()!; bufs.push(inst); this.instAttrs(inst); gl.bindVertexArray(null); this.card = { vao: a, inst, count: 0, bufs }; } }
  /** the instance's place and heading (4), size and kind (2) */
  private instAttrs(inst: WebGLBuffer) { const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, inst); gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 24, 0); gl.vertexAttribDivisor(3, 1); gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 2, gl.FLOAT, false, 24, 16); gl.vertexAttribDivisor(4, 1); }
  private loc(p: WebGLProgram, n: string) { const k = (p === this.P3 ? 'a' : p === this.PC ? 'c' : 'd') + n; if (!this.u.has(k)) this.u.set(k, this.gl.getUniformLocation(p, n)); return this.u.get(k)!; }
  /** which trees are near and which far, when the eye (x, y) has moved 6 m or more, the camera changed kind, or the density
   *  changed. ortho: the overhead camera, every tree within `seen` (m, a square about the eye) in 3D and none as cards */
  update(x: number, y: number, ortho: boolean, seen: number): void { const d = sceneryDensity();
    if (this.at && this.ortho === ortho && this.dens === d && Math.hypot(x - this.at[0], y - this.at[1]) < 6) return; this.at = [x, y]; this.ortho = ortho; this.dens = d;
    const share = DENSITY_SHARE[d], near: number[][] = [[], [], [], []], far: number[] = [], R2 = NEAR_3D[d] ** 2, F2 = FAR_CARD * FAR_CARD, reach = seen + 40; let all = 0;
    for (const t of this.trees) { if (t.rank >= share) continue; all++; const dx = t.x - x, dy = t.y - y;
      if (ortho) { if (Math.abs(dx) < reach && Math.abs(dy) < reach) near[t.kind]!.push(t.x, t.y, t.z, t.heading, t.size, t.kind); continue; }
      const r2 = dx * dx + dy * dy; if (r2 < R2) near[t.kind]!.push(t.x, t.y, t.z, t.heading, t.size, t.kind); else if (r2 < F2) far.push(t.x, t.y, t.z, t.heading, t.size, t.kind); }
    const gl = this.gl; let tris = 0, nn = 0;
    this.sp.forEach((s, k) => { gl.bindBuffer(gl.ARRAY_BUFFER, s.inst); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(near[k]!), gl.DYNAMIC_DRAW); s.count = near[k]!.length / 6; nn += s.count; tris += s.count * s.n / 3; });
    gl.bindBuffer(gl.ARRAY_BUFFER, this.card.inst); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(far), gl.DYNAMIC_DRAW); this.card.count = far.length / 6;
    this.stats = { near: nn, far: this.card.count, tris: tris + this.card.count * 2, all }; }
  /** the near trees into the shadow map */
  drawDepth(LV: Float32Array): void { const gl = this.gl; gl.useProgram(this.PD); gl.uniformMatrix4fv(this.loc(this.PD, 'uVP'), false, LV);
    for (const s of this.sp) if (s.count) { gl.bindVertexArray(s.dvao); gl.drawArraysInstanced(gl.TRIANGLES, 0, s.n, s.count); } }
  /** the trees into the picture: `setU` sets a program's shared uniforms (the light, the shadows, the camera, the look, which thing) before its draws */
  draw(setU: (p: WebGLProgram, outline: number) => void, eyeP: [number, number, number]): void { const gl = this.gl;
    if (this.sp.some(s => s.count)) { setU(this.P3, 1); for (const s of this.sp) if (s.count) { gl.bindVertexArray(s.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, s.n, s.count); } }
    if (this.card.count) { setU(this.PC, 1); gl.uniform3fv(this.loc(this.PC, 'uEyeP'), eyeP); gl.uniform4fv(this.loc(this.PC, 'uW'), this.W); gl.uniform4fv(this.loc(this.PC, 'uH'), this.H); gl.uniform3fv(this.loc(this.PC, 'uLeaf[0]'), this.leaf);
      gl.bindVertexArray(this.card.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.card.count); }
    gl.bindVertexArray(null); }
  free(): void { const gl = this.gl; for (const s of this.sp) { s.bufs.forEach(b => gl.deleteBuffer(b)); gl.deleteVertexArray(s.vao); gl.deleteVertexArray(s.dvao); } this.card.bufs.forEach(b => gl.deleteBuffer(b)); gl.deleteVertexArray(this.card.vao); this.sp = []; }
}
