// The live renderer (review 99; brief 72 steps 1-3 and the switch of step 5): the track drawn every frame with WebGL2,
// in the baked pictures' manner. The scene goes into a low-resolution picture with three layers (colour, which thing and
// part each pixel shows, depth); the light is the baked renderer's, stepped (a warm sun, sky from above, the ground's
// warmth from below, metal and glass mirroring sky, horizon and ground, paint's highlight in two steps), with real shadows
// from a shadow map; then a pass draws the dark outline round each thing and the thin lines between its parts from those
// layers, as the baked pictures have them. A car something stands before shows its light outline over just the hidden
// part. The picture is enlarged by whole pixels on the page.
import { gpuMesh, program, placeMesh, mul, translate, rot, ATTR, type GpuMesh, type M4 } from './gpu';
import type { GroundData } from './ground';
import type { Mesh } from '../car/mesh';

export interface LiveView { x: number; y: number; z: number; /** the world heading that points up the screen */ ang: number; pitch: number; mm: number; W: number; H: number; /** the target's height on the screen (0 top .. 1 bottom) */ cy: number }
export interface LiveCar { g: GpuMesh; x: number; y: number; z: number; yaw: number; roll: number; pitch: number; /** each front wheel's own angle (rad, left +): the inner one more */ steerL: number; steerR: number; spin: number; player: boolean }
export interface LiveProp { g: GpuMesh; x: number; y: number; z: number; h: number }
export interface Skid { x: number; y: number; z: number; a: number }

const SUN_W = (() => { const v = [-0.45, 0.35, 0.82], l = Math.hypot(...v); return v.map(c => c / l) as [number, number, number]; })();   // toward the sun, world axes: from the upper left of the default view
const LIGHT = `
const vec3 SUN_C = vec3(1.0, 0.95, 0.84), SKY_C = vec3(0.6, 0.68, 0.82), GROUND_C = vec3(0.5, 0.45, 0.36);
const vec3 ENV_TOP = vec3(150., 176., 214.) / 255., ENV_HOR = vec3(236., 233., 224.) / 255., ENV_GROUND = vec3(92., 88., 68.) / 255.;
vec3 envAt(float rz) { if (rz < -0.06) return ENV_GROUND; if (rz < 0.22) return ENV_HOR; float t = min(1., (rz - 0.22) / 0.6); return mix(ENV_HOR, ENV_TOP, t); }
uniform highp sampler2DShadow uShadow; uniform mat4 uLight;
float lightAt(vec3 w) { vec4 l = uLight * vec4(w, 1.); vec3 q = l.xyz * 0.5 + 0.5; if (q.x <= 0. || q.y <= 0. || q.x >= 1. || q.y >= 1. || q.z >= 1.) return 1.; return texture(uShadow, vec3(q.xy, q.z - 0.0015)); }
`;
const OBJ_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec3 aCol; layout(location=3) in float aGloss; layout(location=4) in float aKind; layout(location=5) in float aPart;
uniform mat4 uVP, uModel; uniform float uBias;
out vec3 vWorld, vObj; flat out vec3 vN, vObjN, vCol; flat out float vGloss, vKind, vPart;
void main() { vec4 w = uModel * vec4(aPos, 1.); vWorld = w.xyz; vObj = aPos; vObjN = aNor; vN = normalize(mat3(uModel) * aNor); vCol = aCol; vGloss = aGloss; vKind = aKind; vPart = aPart;
  gl_Position = uVP * w; gl_Position.z -= uBias; }`;
const OBJ_FS = `#version 300 es
precision highp float;
${LIGHT}
in vec3 vWorld, vObj; flat in vec3 vN, vObjN, vCol; flat in float vGloss, vKind, vPart;
uniform vec3 uEye, uSun; uniform vec2 uObj; uniform float uOutline; uniform int uMode; uniform vec4 uSil; uniform float uGlass;
uniform int uDecN; uniform vec3 uDecO[4], uDecN_[4], uDecUp[4]; uniform float uDecR[4]; uniform sampler2D uDecTex;
layout(location=0) out vec4 oCol; layout(location=1) out vec4 oId;
void main() {
  if (uMode == 1) { oCol = uSil; oId = vec4(0.); return; }
  vec3 n = vN; if (dot(n, uEye) < 0.) n = -n;
  vec3 base = vCol; int kind = int(vKind + 0.5);
  float sh = lightAt(vWorld);
  float d = max(0., dot(n, uSun)) * sh, up = 0.5 + 0.5 * n.z;
  float ne = dot(n, uEye), rz = 2. * ne * n.z - uEye.z;
  if (uMode == 2) {   // glass: mirrors more at a glancing angle, laid over at its own strength
    float F = 0.06 + 0.94 * pow(1. - abs(ne), 4.); vec3 env = envAt(rz), tint = kind == 4 ? base : vec3(150., 172., 182.) / 255.;
    float k = 0.62 + 0.45 * d + (n.z > 0.3 ? 0.1 : 0.); vec3 c = tint * (1. - 0.55 * (0.4 + F)) + env / k * 0.55 * (0.4 + F);
    oCol = vec4(min(vec3(1.), c * k), min(1., (kind == 4 ? uGlass + 0.15 : uGlass) + (1. - uGlass) * F * 0.7)); oId = vec4(0.); return; }
  if (kind == 1 && uDecN > 0) for (int i = 0; i < 4; i++) { if (i >= uDecN) break;
    vec3 dd = vObj - uDecO[i]; float depth = dot(dd, uDecN_[i]); if (abs(depth) > uDecR[i] * 0.8 || abs(dot(vObjN, uDecN_[i])) < 0.45) continue;
    vec3 rt = normalize(cross(uDecN_[i], uDecUp[i])); vec2 uv = vec2(dot(dd, rt), dot(dd, uDecUp[i])) / uDecR[i] * 0.5 + 0.5; if (any(lessThan(uv, vec2(0.))) || any(greaterThan(uv, vec2(1.)))) continue;
    vec4 t = texture(uDecTex, vec2((float(i) + uv.x) / 4., uv.y)); if (t.a > 0.5) base = t.rgb; }
  float dq = floor(d * 4. + 0.5) / 4.;
  vec3 diff = SUN_C * dq * 0.78 + (SKY_C * up + GROUND_C * (1. - up)) * 0.6, c;
  vec3 env = envAt(rz);
  if (vGloss > 0.7) { float tint = 0.55 + 0.45 * max(base.r, max(base.g, base.b)); c = min(vec3(1.), env * 0.82 * (base * 0.5 + 0.5) * tint + base * diff * 0.15); }
  else { vec3 h = normalize(uSun + uEye); float nh = max(0., dot(n, h)), g = vGloss, sp = g > 0.2 ? pow(nh, 6. + g * 110.) : 0., spec = (sp > 0.65 ? 1. : sp > 0.3 ? 0.5 : 0.) * sh;
    float refl = g > 0.3 ? 0.1 * g * (0.4 + 0.6 * up) : 0.; c = min(vec3(1.), base * diff * (1. - refl) + env * refl) + spec * (40. + 80. * g) / 255. * vec3(1., 0.97, 0.9); }
  oCol = vec4(min(c, vec3(1.)), 1.); oId = vec4(uObj, vPart / 255., uOutline / 8.); }`;
const GROUND_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec4 aCol; layout(location=2) in float aFlag;
uniform mat4 uVP; uniform float uBias; out vec3 vWorld; out vec4 vCol; flat out float vFlag;
void main() { vWorld = aPos; vCol = aCol; vFlag = aFlag; gl_Position = uVP * vec4(aPos, 1.); gl_Position.z -= uBias; }`;
const GROUND_FS = `#version 300 es
precision highp float;
${LIGHT}
in vec3 vWorld; in vec4 vCol; flat in float vFlag; uniform float uCell;
layout(location=0) out vec4 oCol; layout(location=1) out vec4 oId;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() { vec3 c = vCol.rgb;
  if (vFlag > 0.5) { vec2 cell = floor(vWorld.xy / vec2(uCell * 2., uCell)); float h = hash(cell); if (h > 0.955) c = vec3(107., 130., 83.) / 255.; else if (h > 0.91) c = vec3(83., 104., 63.) / 255.; }
  c = mix(c, vec3(24., 22., 20.) / 255., (1. - lightAt(vWorld + vec3(0., 0., 0.02))) * 0.43);
  oCol = vec4(c, vCol.a); oId = vec4(0.); }`;
const DEPTH_VS = `#version 300 es
layout(location=0) in vec3 aPos; uniform mat4 uVP, uModel; void main() { gl_Position = uVP * uModel * vec4(aPos, 1.); }`;
const DEPTH_FS = `#version 300 es
precision mediump float; out vec4 o; void main() { o = vec4(1.); }`;
const POST_VS = `#version 300 es
out vec2 vUv; void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUv = p; gl_Position = vec4(p * 2. - 1., 0., 1.); }`;
const POST_FS = `#version 300 es
precision highp float;
uniform sampler2D uCol, uId, uDepth; uniform float uRange, uStep; in vec2 vUv; out vec4 o;
float obj(vec4 id) { return floor(id.r * 255. + 0.5) + floor(id.g * 255. + 0.5) * 256.; }
void main() { ivec2 p = ivec2(gl_FragCoord.xy), sz = textureSize(uCol, 0); vec4 c = texelFetch(uCol, p, 0), id = texelFetch(uId, p, 0); float me = obj(id);
  if (me > 0.) { float dp = texelFetch(uDepth, p, 0).r * 2. * uRange; int w = int(floor(id.a * 8. + 0.5)); float k = 1.;
    ivec2 dirs[4] = ivec2[4](ivec2(1, 0), ivec2(-1, 0), ivec2(0, 1), ivec2(0, -1));
    for (int s = 1; s <= 3; s++) { if (s > w) break; for (int j = 0; j < 4; j++) { ivec2 q = p + dirs[j] * s; if (q.x < 0 || q.y < 0 || q.x >= sz.x || q.y >= sz.y) { k = 0.2; continue; }
      vec4 iq = texelFetch(uId, q, 0); float oq = obj(iq), dq = texelFetch(uDepth, q, 0).r * 2. * uRange;
      if (oq != me && (oq == 0. || dq > dp)) k = 0.2;
      else if (s == 1 && oq == me && k > 0.5 && ((abs(iq.b - id.b) > 0.001 && dp - dq > 0.004) || dp - dq > uStep)) k = 0.5; } }
    c.rgb *= k; }
  o = vec4(c.rgb, 1.); }`;

export class LiveRenderer {
  readonly gl: WebGL2RenderingContext; private obj: WebGLProgram; private ground: WebGLProgram; private depth: WebGLProgram; private post: WebGLProgram;
  private fbo: WebGLFramebuffer; private tCol: WebGLTexture; private tId: WebGLTexture; private tDepth: WebGLTexture; private W = 0; private H = 0;
  private sFbo: WebGLFramebuffer; private sTex: WebGLTexture; private S = 2048;
  private groundVao: WebGLVertexArrayObject | null = null; private groundN = 0; private fenceVao: WebGLVertexArrayObject | null = null; private fenceN = 0;
  private skidVao: WebGLVertexArrayObject; private skidBuf: WebGLBuffer; private kinds = new Map<string, GpuMesh>(); private cars = new Map<Mesh, GpuMesh>();
  private u = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>(); private blank: WebGLTexture;
  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, preserveDrawingBuffer: true }); if (!gl) throw new Error('no WebGL2'); this.gl = gl;
    this.obj = program(gl, OBJ_VS, OBJ_FS); this.ground = program(gl, GROUND_VS, GROUND_FS); this.depth = program(gl, DEPTH_VS, DEPTH_FS); this.post = program(gl, POST_VS, POST_FS);
    this.fbo = gl.createFramebuffer()!; this.tCol = gl.createTexture()!; this.tId = gl.createTexture()!; this.tDepth = gl.createTexture()!;
    this.sFbo = gl.createFramebuffer()!; this.sTex = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, this.sTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, this.S, this.S); this.texParams(gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sFbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.sTex, 0); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.blank = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, this.blank); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); this.texParams(gl.NEAREST);   // what an unused sampler reads (never the picture being drawn)
    this.skidVao = gl.createVertexArray()!; this.skidBuf = gl.createBuffer()!; gl.bindVertexArray(this.skidVao); gl.bindBuffer(gl.ARRAY_BUFFER, this.skidBuf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 32, 28); gl.bindVertexArray(null); }
  private texParams(f: number) { const gl = this.gl; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
  private loc(p: WebGLProgram, name: string) { let m = this.u.get(p); if (!m) { m = new Map(); this.u.set(p, m); } if (!m.has(name)) m.set(name, this.gl.getUniformLocation(p, name)); return m.get(name)!; }
  private size(W: number, H: number) { if (W === this.W && H === this.H) return; const gl = this.gl; this.W = W; this.H = H;
    for (const [t, f, fmt, type] of [[this.tCol, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE], [this.tId, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE], [this.tDepth, gl.DEPTH24_STENCIL8, gl.DEPTH_STENCIL, gl.UNSIGNED_INT_24_8]] as const) {
      gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, f, W, H, 0, fmt, type, null); this.texParams(gl.NEAREST); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tCol, 0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.tId, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.TEXTURE_2D, this.tDepth, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
  private vaoOf(d: GroundData): WebGLVertexArrayObject { const gl = this.gl, vao = gl.createVertexArray()!; gl.bindVertexArray(vao);
    const b = (loc: number, data: ArrayBufferView, size: number, type: number, norm: boolean) => { const buf = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type, norm, 0, 0); };
    b(0, d.pos, 3, gl.FLOAT, false); b(1, d.col, 3, gl.UNSIGNED_BYTE, true); b(2, d.flag, 1, gl.FLOAT, false); gl.bindVertexArray(null); return vao; }
  setGround(d: GroundData) { this.groundVao = this.vaoOf(d); this.groundN = d.n; }
  setFence(d: GroundData) { this.fenceVao = this.vaoOf(d); this.fenceN = d.n; }
  /** the GPU copy of a prop's mesh (by kind) or a car's (by its mesh object), made once */
  prop(kind: string, make: () => Mesh): GpuMesh { let g = this.kinds.get(kind); if (!g) { g = gpuMesh(this.gl, make(), false); this.kinds.set(kind, g); } return g; }
  car(M: Mesh): GpuMesh { let g = this.cars.get(M); if (!g) { g = gpuMesh(this.gl, M, true); this.cars.set(M, g); } return g; }
  forget(M: Mesh) { this.cars.delete(M); }

  render(v: LiveView, cars: LiveCar[], props: LiveProp[], skids: Skid[], o: { glass?: number } = {}) { const gl = this.gl; this.size(v.W, v.H);
    // ---- the camera: orthographic, turned to v.ang, tilted down by v.pitch, v.mm millimetres a pixel, snapped to whole pixels ----
    const a = v.ang - Math.PI / 2, cA = Math.cos(a), sA = Math.sin(a), SP = Math.sin(v.pitch * Math.PI / 180), CP = Math.cos(v.pitch * Math.PI / 180), k = 1000 / v.mm, R = 900;
    const rx = [cA, sA, 0], ry = [-sA, cA, 0], up = [ry[0]! * SP, ry[1]! * SP, CP], vd = [ry[0]! * CP, ry[1]! * CP, -SP], c = [v.x, v.y, v.z], dot = (p: number[], q: number[]) => p[0]! * q[0]! + p[1]! * q[1]! + p[2]! * q[2]!;
    const VP = new Float32Array(16); VP[0] = rx[0]! * 2 * k / v.W; VP[4] = rx[1]! * 2 * k / v.W; VP[12] = Math.round(v.W / 2 - dot(c, rx) * k) * 2 / v.W - 1;
    VP[1] = up[0]! * 2 * k / v.H; VP[5] = up[1]! * 2 * k / v.H; VP[9] = up[2]! * 2 * k / v.H; VP[13] = 1 - 2 * Math.round(v.H * v.cy + dot(c, up) * k) / v.H;
    VP[2] = vd[0]! / R; VP[6] = vd[1]! / R; VP[10] = vd[2]! / R; VP[14] = -dot(c, vd) / R; VP[15] = 1;
    const eye = [-vd[0]!, -vd[1]!, -vd[2]!];
    // ---- the sun's view for the shadows: around the camera's target, as far as the picture reaches ----
    const reach = Math.min(160, Math.hypot(v.W, v.H / Math.max(0.2, SP)) * v.mm / 2000 + 12), lz = SUN_W.map(x => -x), lx0 = [lz[1]!, -lz[0]!, 0], ll = Math.hypot(lx0[0]!, lx0[1]!), lx = [lx0[0]! / ll, lx0[1]! / ll, 0];
    const ly = [lz[1]! * lx[2]! - lz[2]! * lx[1]!, lz[2]! * lx[0]! - lz[0]! * lx[2]!, lz[0]! * lx[1]! - lz[1]! * lx[0]!], LR = 200, LV = new Float32Array(16);
    const tx = Math.round(dot(c, lx) / (2 * reach / this.S)) * (2 * reach / this.S), ty = Math.round(dot(c, ly) / (2 * reach / this.S)) * (2 * reach / this.S);   // snapped to the map's texels: shadows hold still
    LV[0] = lx[0]! / reach; LV[4] = lx[1]! / reach; LV[8] = lx[2]! / reach; LV[12] = -tx / reach; LV[1] = ly[0]! / reach; LV[5] = ly[1]! / reach; LV[9] = ly[2]! / reach; LV[13] = -ty / reach;
    LV[2] = lz[0]! / LR; LV[6] = lz[1]! / LR; LV[10] = lz[2]! / LR; LV[14] = -dot(c, lz) / LR; LV[15] = 1;
    const near = (x: number, y: number, r: number) => Math.abs(x - v.x) < reach + r + 20 && Math.abs(y - v.y) < reach + r + 20;
    const ps = props.filter(p => near(p.x, p.y, p.g.radius)), carM = cars.map(q => this.carParts(q));
    // ---- the shadow map ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sFbo); gl.viewport(0, 0, this.S, this.S); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT); gl.disable(gl.BLEND); gl.disable(gl.STENCIL_TEST);
    gl.useProgram(this.depth); gl.uniformMatrix4fv(this.loc(this.depth, 'uVP'), false, LV);
    const drawD = (part: { vao: WebGLVertexArrayObject; n: number }, M: M4) => { if (!part.n) return; gl.uniformMatrix4fv(this.loc(this.depth, 'uModel'), false, M); gl.bindVertexArray(part.vao); gl.drawArrays(gl.TRIANGLES, 0, part.n); };
    for (const p of ps) drawD(p.g.body, placeMesh(p.g.len, p.x, p.y, p.z, p.h)); for (const m of carM) for (const [part, M] of m.opaque) drawD(part, M);
    // ---- the scene: colour, which thing, depth ----
    for (let i = 0; i < 3; i++) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, this.blank); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo); gl.viewport(0, 0, v.W, v.H); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.clearBufferfv(gl.COLOR, 0, [0.36, 0.45, 0.28, 1]); gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]); gl.clearBufferfi(gl.DEPTH_STENCIL, 0, 1, 0);
    const shadowTo = (p: WebGLProgram) => { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.sTex); gl.uniform1i(this.loc(p, 'uShadow'), 1); gl.uniformMatrix4fv(this.loc(p, 'uLight'), false, LV); };
    gl.useProgram(this.ground); gl.uniformMatrix4fv(this.loc(this.ground, 'uVP'), false, VP); gl.uniform1f(this.loc(this.ground, 'uCell'), Math.max(0.03, v.mm / 1000)); gl.uniform1f(this.loc(this.ground, 'uBias'), 0); shadowTo(this.ground);
    if (this.groundVao) { gl.bindVertexArray(this.groundVao); gl.drawArrays(gl.TRIANGLES, 0, this.groundN); }
    if (this.fenceVao && this.fenceN) { gl.bindVertexArray(this.fenceVao); gl.drawArrays(gl.TRIANGLES, 0, this.fenceN); }
    // skid marks: dark patches on the concrete, blended, nothing else written
    if (skids.length) { const S = skids.filter(m => near(m.x, m.y, 0)), f = new Float32Array(S.length * 6 * 8), r = 0.09;
      S.forEach((m, i) => { const q = [[-r, -r], [r, -r], [r, r], [-r, -r], [r, r], [-r, r]]; q.forEach(([dx, dy], j) => f.set([m.x + dx!, m.y + dy!, m.z + 0.01, 30 / 255, 28 / 255, 26 / 255, m.a, 0], (i * 6 + j) * 8)); });
      gl.bindBuffer(gl.ARRAY_BUFFER, this.skidBuf); gl.bufferData(gl.ARRAY_BUFFER, f, gl.DYNAMIC_DRAW); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
      gl.uniform1f(this.loc(this.ground, 'uBias'), 0.00002); gl.bindVertexArray(this.skidVao); gl.drawArrays(gl.TRIANGLES, 0, S.length * 6); gl.disable(gl.BLEND); gl.depthMask(true); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]); }
    gl.useProgram(this.obj); gl.uniformMatrix4fv(this.loc(this.obj, 'uVP'), false, VP); gl.uniform3fv(this.loc(this.obj, 'uEye'), eye); gl.uniform3fv(this.loc(this.obj, 'uSun'), SUN_W); gl.uniform1f(this.loc(this.obj, 'uGlass'), o.glass ?? 0.8); shadowTo(this.obj);
    gl.uniform1i(this.loc(this.obj, 'uDecTex'), 2);
    let id = 1; const objU = (outline: number) => { gl.uniform2f(this.loc(this.obj, 'uObj'), (id & 255) / 255, ((id >> 8) & 255) / 255); gl.uniform1f(this.loc(this.obj, 'uOutline'), outline); id++; };
    const draw = (part: { vao: WebGLVertexArrayObject; n: number }, M: M4) => { if (!part.n) return; gl.uniformMatrix4fv(this.loc(this.obj, 'uModel'), false, M); gl.bindVertexArray(part.vao); gl.drawArrays(gl.TRIANGLES, 0, part.n); };
    const decals = (g: GpuMesh | null) => { const n = g ? g.decals.length : 0; gl.uniform1i(this.loc(this.obj, 'uDecN'), n); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, n ? g!.decalTex : this.blank); if (!g || !n) return;
      gl.uniform3fv(this.loc(this.obj, 'uDecO'), g.decals.flatMap(d => d.o)); gl.uniform3fv(this.loc(this.obj, 'uDecN_'), g.decals.flatMap(d => { const l = Math.hypot(...d.n); return d.n.map(x => x / l); }));
      gl.uniform3fv(this.loc(this.obj, 'uDecUp'), g.decals.flatMap(d => { const l = Math.hypot(...d.up); return d.up.map(x => x / l); })); gl.uniform1fv(this.loc(this.obj, 'uDecR'), g.decals.map(d => d.r)); };
    gl.uniform1i(this.loc(this.obj, 'uMode'), 0); gl.uniform1f(this.loc(this.obj, 'uBias'), 0); decals(null);
    const outlineP = Math.max(1, Math.min(2, Math.round(2 * 50 / v.mm))), outlineC = Math.max(1, Math.min(3, Math.round(3 * 50 / v.mm)));
    for (const p of ps) { objU(outlineP); draw(p.g.body, placeMesh(p.g.len, p.x, p.y, p.z, p.h)); }
    // the cars a thing hides: their light outline first, tested against what stands before them (each pixel once), then the cars over it
    gl.uniform1i(this.loc(this.obj, 'uMode'), 1); gl.depthFunc(gl.GREATER); gl.depthMask(false); gl.enable(gl.STENCIL_TEST); gl.stencilFunc(gl.EQUAL, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]); gl.uniform1f(this.loc(this.obj, 'uBias'), 0.25 / R);
    cars.forEach((q, i) => { gl.uniform4f(this.loc(this.obj, 'uSil'), 1, 226 / 255, 168 / 255, q.player ? 0.6 : 0.4); for (const [part, M] of carM[i]!.opaque) draw(part, M); });
    gl.disable(gl.STENCIL_TEST); gl.disable(gl.BLEND); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]); gl.uniform1f(this.loc(this.obj, 'uBias'), 0); gl.uniform1i(this.loc(this.obj, 'uMode'), 0);
    cars.forEach((q, i) => { objU(outlineC); const m = carM[i]!; decals(q.g); draw(q.g.body, m.body); decals(null); for (const [part, M] of m.opaque.slice(1)) draw(part, M); });
    // glass over all, at its own strength, nothing else written
    gl.uniform1i(this.loc(this.obj, 'uMode'), 2); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
    for (const p of ps) draw(p.g.glass, placeMesh(p.g.len, p.x, p.y, p.z, p.h)); for (const m of carM) for (const [part, M] of m.glass) draw(part, M);
    gl.disable(gl.BLEND); gl.depthMask(true);
    // ---- the outlines, onto the page's canvas ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, v.W, v.H); gl.disable(gl.DEPTH_TEST); gl.useProgram(this.post);
    [this.tCol, this.tId, this.tDepth].forEach((t, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(this.loc(this.post, ['uCol', 'uId', 'uDepth'][i]!), i); });
    gl.uniform1f(this.loc(this.post, 'uRange'), R); gl.uniform1f(this.loc(this.post, 'uStep'), (60 + 2 * v.mm / Math.tan(Math.max(5, v.pitch) * Math.PI / 180)) / 1000);
    gl.bindVertexArray(null); gl.drawArrays(gl.TRIANGLES, 0, 3); }

  /** a car's pieces with their matrices: the body on its springs (rolled and pitched about its middle), each wheel at its
   *  hub, turned on its axle and the front ones steered */
  private carParts(q: LiveCar): { body: M4; opaque: [{ vao: WebGLVertexArrayObject; n: number }, M4][]; glass: [{ vao: WebGLVertexArrayObject; n: number }, M4][] } {
    const g = q.g, base = placeMesh(g.len, q.x, q.y, q.z, q.yaw), mid = translate(g.len / 2, 0, 0), back = translate(-g.len / 2, 0, 0);
    const body = mul(base, mul(mid, mul(rot('x', q.roll), mul(rot('y', q.pitch), back))));
    const opaque: [{ vao: WebGLVertexArrayObject; n: number }, M4][] = [[g.body, body]], glass: [{ vao: WebGLVertexArrayObject; n: number }, M4][] = [[g.glass, body]];
    for (const w of g.wheels) { const M = mul(body, mul(translate(w.hub[0], w.hub[1], w.hub[2]), mul(w.front ? rot('z', -(w.hub[1] > 0 ? q.steerL : q.steerR)) : translate(0, 0, 0), rot('y', -q.spin))));
      opaque.push([w.part, M]); if (w.glass) glass.push([w.glass, M]); }
    return { body, opaque, glass }; }
}
