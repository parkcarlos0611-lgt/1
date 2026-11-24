// Drawing the volumetric smoke (docs/systems/104 B-3, steps V3 and V5): each pixel's ray marched through the grid's box
// at half the resolution, stopped at the scene's depth (so the cars and fences stand before it or in it), then laid
// over the picture at full resolution by a depth-aware upsample (of the four half-resolution samples about a pixel,
// those whose depth is near its own count most: no smoke bleeding over a car's edge).
//   몽글몽글: the grid's 25 cm cells are coarse, so the density's edge is eaten by cellular (Worley) noise in two octaves,
//   the round puffs of a cauliflower; the noise flows with the smoke's own velocity (two phases crossfaded) and drifts.
//   빛: the sun's share from the light's grid (light.ts), two lobes of scattering (a strong forward one: bright rims with
//   the sun behind), a little more for the light scattered again inside, the sky's light from above; the parcels' sums.
//   카툰 (V5): the march stops at the first point past a threshold of density, the surface; its normal from the density's
//   slope, its light in two or three bands with a blue shade (the toon look's), an outline where the surface's depth jumps
//   or the smoke ends, a thin see-through rim; as the smoke thins only the noise's puffs stay above the threshold, so it
//   breaks into ever smaller round blobs instead of fading. The exhaust's flames as stars (one frame each).
//   그림자: the same upsample pass darkens the ground and the cars under the smoke (shadow.ts).
import { program } from '../gpu';
import type { Atlas } from './atlas';
import { SHADOW_GLSL } from './shadow';

const VS = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2. - 1., 0., 1.); }`;
/** what both passes share: the box, the atlases read smoothly (a tile's bilinear, the slices mixed), the ray's ends */
const COMMON = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D; precision highp sampler3D;
uniform mat4 uInv; uniform vec2 uFull; uniform sampler2D uDepth, uScal, uVel, uLight; uniform vec3 uO, uSun; uniform float uH, uTime;
uniform ivec3 uN, uNL; uniform int uCols, uColsL; uniform vec2 uAS, uALS;   /* the grid, the light's grid; the atlases' sizes */
vec3 unproj(vec2 ndc, float z) { vec4 p = uInv * vec4(ndc, z, 1.); return p.xyz / p.w; }
vec4 smoothAt(sampler2D s, vec3 g, ivec3 N, int cols, vec2 size) { float z = clamp(g.z - .5, 0., float(N.z - 1)); int k0 = min(int(floor(z)), N.z - 2); float fz = z - float(k0);
  vec2 xy = clamp(g.xy, vec2(.5), vec2(N.xy) - .5); vec2 t0 = vec2(float((k0 % cols) * N.x), float((k0 / cols) * N.y)), t1 = vec2(float(((k0 + 1) % cols) * N.x), float(((k0 + 1) / cols) * N.y));
  return mix(texture(s, (t0 + xy) / size), texture(s, (t1 + xy) / size), fz); }
vec3 grid(vec3 p) { return (p - uO) / uH; }
float sunAt(vec3 p) { return smoothAt(uLight, grid(p) * 0.5, uNL, uColsL, uALS).r; }
${SHADOW_GLSL}
`;
const MARCH_FS = COMMON + `
uniform vec2 uHalf; uniform int uSteps, uToon, uHDR; uniform float uDay, uToonB; uniform sampler3D uNoise;
layout(location=0) out vec4 o0; layout(location=1) out vec4 o1;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float hg(float c, float g) { float g2 = g * g; return (1. - g2) / (4. * 3.14159 * pow(1. + g2 - 2. * g * c, 1.5)); }
/** the density at a point, its edge eaten by the flowing cellular noise; its dust's share in y */
vec2 dens(vec3 p) { vec3 g = grid(p); vec4 s = smoothAt(uScal, g, uN, uCols, uAS); float d = s.r + s.g; if (d < 0.004) return vec2(0.);
  vec3 N = vec3(uN); float e = min(min(min(g.x, g.y), min(N.x - g.x, N.y - g.y)), N.z - g.z); d *= clamp(e / 2., 0., 1.);   /* the box's sides: thinned over two cells */
  vec3 v = smoothAt(uVel, g, uN, uCols, uAS).xyz; float T = 1.6, a = fract(uTime / T), b = fract(uTime / T + .5), wa = abs(2. * a - 1.);
  vec3 q = p * 0.85 + vec3(0., 0., -uTime * 0.12);
  vec2 na = texture(uNoise, q - v * a * T * 0.85).rg, nb = texture(uNoise, q - v * b * T * 0.85 + 0.37).rg; vec2 n = mix(na, nb, wa);
  float base = n.r * 0.68 + n.g * 0.32;   /* 1 at a puff's middle */
  float k = uToon == 1 ? 0.55 : 0.42; return vec2(max(0., d * 1.25 - (1. - base) * k * (1. - 0.35 * smoothstep(0.4, 1.4, d))), s.g / max(d, 1e-3)); }
vec3 filmic(vec3 x) { return pow(clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0., 1.), vec3(1. / 2.2)); }
vec3 shadeOf(vec3 c) { return c * vec3(0.52, 0.58, 0.78); }
void main() { ivec2 f = ivec2(gl_FragCoord.xy) * 2; ivec2 m = ivec2(uFull) - 1;
  float zd = min(min(texelFetch(uDepth, min(f, m), 0).r, texelFetch(uDepth, min(f + ivec2(1, 0), m), 0).r), min(texelFetch(uDepth, min(f + ivec2(0, 1), m), 0).r, texelFetch(uDepth, min(f + 1, m), 0).r));
  vec2 ndc = gl_FragCoord.xy / uHalf * 2. - 1.; vec3 ro = unproj(ndc, -1.), re = unproj(ndc, zd * 2. - 1.), rd = normalize(re - ro); float tS = length(re - ro);
  vec3 B0 = uO, B1 = uO + vec3(uN) * uH, ia = 1. / rd, ta = (B0 - ro) * ia, tb = (B1 - ro) * ia, tmn = min(ta, tb), tmx = max(ta, tb);
  float t0 = max(max(max(tmn.x, tmn.y), tmn.z), 0.), t1 = min(min(min(tmx.x, tmx.y), tmx.z), tS);
  o1 = vec4(1e4, tS, 0., 1.); if (t0 >= t1) { o0 = vec4(0.); return; }
  float len = t1 - t0, dt = max(len / float(uSteps), uH * 0.45), j = hash(gl_FragCoord.xy + fract(uTime * 7.31) * 91.);
  vec3 SUN = vec3(1., 0.95, 0.84) * 3. * (0.25 + 0.75 * uDay), SKY = vec3(0.35, 0.42, 0.55) * (0.3 + 0.7 * uDay), DUST = vec3(0.62, 0.55, 0.42), GREY = vec3(0.86, 0.85, 0.83);
  float sigma = 4.;
  if (uToon == 1) {   // ---- the toon: the first point past the threshold, the surface ----
    float th = 0.2, tp = t0, prev = 0.; vec2 hit = vec2(0.); float th2 = -1.;
    for (int i = 0; i < 96; i++) { if (i >= uSteps) break; float t = t0 + (float(i) + j) * dt; if (t > t1) break; vec2 d = dens(ro + rd * t);
      if (d.x > th) { float a = tp, b = t; for (int k = 0; k < 4; k++) { float c = (a + b) * .5; if (dens(ro + rd * c).x > th) b = c; else a = c; } th2 = b; hit = d; break; }
      prev = d.x; tp = t; }
    if (th2 < 0.) { o0 = vec4(0.); return; }
    vec3 p = ro + rd * th2; float e = uH * 0.7;
    vec3 n = -normalize(vec3(dens(p + vec3(e, 0, 0)).x - dens(p - vec3(e, 0, 0)).x, dens(p + vec3(0, e, 0)).x - dens(p - vec3(0, e, 0)).x, dens(p + vec3(0, 0, e)).x - dens(p - vec3(0, 0, e)).x) + 1e-5);
    float lit = (dot(n, uSun) * 0.5 + 0.5) * mix(0.35, 1., sunAt(p)), band = uToonB > 2.5 ? (lit > 0.62 ? 1. : lit > 0.38 ? 0.6 : 0.2) : (lit > 0.5 ? 1. : 0.25);
    vec3 alb = mix(vec3(0.93, 0.92, 0.9), vec3(0.78, 0.68, 0.52), hit.y), c = mix(shadeOf(alb) * (0.55 + 0.45 * uDay), alb * (0.75 + 0.25 * uDay), band);
    c += vec3(0.9, 0.95, 1.) * 0.25 * pow(max(0., 1. - max(0., dot(n, -rd))), 3.) * uDay;   /* the rim against the sky */
    o0 = vec4(clamp(c, 0., 1.), 1.); o1 = vec4(th2, tS, 0., 1.); return; }
  // ---- the look as photographed: the light's transfer along the ray ----
  float cosT = dot(uSun, rd), phase = mix(hg(cosT, 0.62), hg(cosT, -0.25), 0.3) * 12.566;
  vec3 col = vec3(0.); float Tv = 1., hitT = 1e4;
  for (int i = 0; i < 96; i++) { if (i >= uSteps) break; float t = t0 + (float(i) + j) * dt; if (t > t1) break; vec3 p = ro + rd * t; vec2 d = dens(p); if (d.x < 0.002) continue;
    float tr = sunAt(p), hz = clamp((p.z - uO.z) / (float(uN.z) * uH), 0., 1.);
    vec3 alb = mix(GREY, DUST, d.y), L = SUN * (tr * phase + 0.45 * pow(tr, 0.3) * mix(1., phase, 0.25) + 0.2 * pow(tr, 0.1)) + SKY * (0.55 + 0.45 * hz) * (0.45 + 0.55 * sqrt(tr));
    float ext = sigma * d.x * min(dt, t1 - t); col += Tv * (1. - exp(-ext)) * alb * L; Tv *= exp(-ext); if (hitT > 9e3 && Tv < 0.7) hitT = t; if (Tv < 0.02) break; }
  float A = 1. - Tv; if (A < 0.003) { o0 = vec4(0.); return; } vec3 x = col / max(A, 1e-3) * 0.55; o0 = vec4((uHDR == 1 ? x : filmic(x)) * A, A); o1 = vec4(hitT, tS, 0., 1.); }`;
const COMP_FS = COMMON + `
uniform sampler2D uC, uD; uniform vec2 uHalf; uniform int uToon; uniform float uShadowK; uniform vec4 uStars[8]; uniform int uStarN; uniform mat4 uVP; out vec4 o;
void main() { vec2 fc = gl_FragCoord.xy; ivec2 F = ivec2(fc); float zd = texelFetch(uDepth, F, 0).r; vec2 ndc = fc / uFull * 2. - 1.; vec3 ro = unproj(ndc, -1.), pw = unproj(ndc, zd * 2. - 1.); float tS = length(pw - ro);
  vec2 hc = fc * 0.5 - 0.5; ivec2 b = ivec2(floor(hc)); vec2 fr = hc - vec2(b); ivec2 hm = ivec2(uHalf) - 1; vec4 c = vec4(0.); float ws = 0.; vec4 cs[4]; vec2 ds[4];
  for (int k = 0; k < 4; k++) { ivec2 q = clamp(b + ivec2(k & 1, k >> 1), ivec2(0), hm); vec4 s = texelFetch(uC, q, 0); vec2 d = texelFetch(uD, q, 0).xy; cs[k] = s; ds[k] = d;
    float bw = ((k & 1) == 1 ? fr.x : 1. - fr.x) * ((k >> 1) == 1 ? fr.y : 1. - fr.y), dw = 1. / (0.02 + abs(d.y - tS) / max(tS, 1.)); float w = (bw + 1e-3) * dw; c += s * w; ws += w; }
  c /= ws;
  if (uToon == 1) {   // the outline: where the smoke ends, or its surface's depth jumps between the samples
    float amn = min(min(cs[0].a, cs[1].a), min(cs[2].a, cs[3].a)), amx = max(max(cs[0].a, cs[1].a), max(cs[2].a, cs[3].a)), hmn = 1e4, hmx = 0.;
    for (int k = 0; k < 4; k++) if (cs[k].a > 0.5) { hmn = min(hmn, ds[k].x); hmx = max(hmx, ds[k].x); }
    bool edge = (amx > 0.5 && amn < 0.5) || (hmx - hmn > 0.35 + 0.04 * hmn); if (edge && c.a > 0.2) c = vec4(vec3(0.16, 0.15, 0.17), 1.);
    // the exhaust's flames: stars of yellow and orange, a frame each (their places on the screen, sizes in pixels)
    for (int k = 0; k < 8; k++) { if (k >= uStarN) break; vec4 s = uStars[k]; vec2 d = fc - s.xy; float r = length(d), a = atan(d.y, d.x) + s.w, sp = s.z * (0.55 + 0.45 * pow(abs(cos(a * 2.5)), 6.));
      if (r < sp) { vec3 sc = r < sp * 0.45 ? vec3(1., 0.95, 0.55) : vec3(1., 0.62, 0.18); if (r > sp - 1.6) sc = vec3(0.16, 0.15, 0.17); c = vec4(sc, 1.); } } }
  float s = zd < 1. ? smokeShadow(pw, uShadowK) : 1.;   /* the smoke's shadow on what is behind it */
  o = vec4(c.rgb, 1. - (1. - c.a) * s); }`;

/** cellular noise (Worley) in a 32³ tile, two octaves (4 and 8 cells across), 1 at a cell's point, 0 far from it */
export function worley(): Uint8Array { const S = 32, out = new Uint8Array(S * S * S * 2);
  for (const [ch, n] of [[0, 4], [1, 8]] as const) { const c = S / n, pts: number[] = []; let r = 1234 + n; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n * n * n; i++) pts.push(rnd(), rnd(), rnd());
    for (let z = 0; z < S; z++) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const gx = Math.floor(x / c), gy = Math.floor(y / c), gz = Math.floor(z / c); let best = 9;
      for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const a = gx + dx, b = gy + dy, e = gz + dz, w = (v: number) => ((v % n) + n) % n, k = (w(a) + n * (w(b) + n * w(e))) * 3;
        const px = (a + pts[k]!) * c, py = (b + pts[k + 1]!) * c, pz = (e + pts[k + 2]!) * c, d = Math.hypot(px - x - 0.5, py - y - 0.5, pz - z - 0.5) / c; if (d < best) best = d; }
      out[(x + S * (y + S * z)) * 2 + ch] = Math.round(255 * Math.max(0, 1 - best)); } }
  return out; }

export interface DrawView { VP: Float32Array; W: number; H: number; depth: WebGLTexture; col: WebGLTexture; /** the scene's framebuffer, bound again after */ fbo: WebGLFramebuffer; hdr: boolean; toon: boolean; toonBands?: number; sun: readonly number[]; day: number }
export interface DrawGrid { A: Atlas; AL: Atlas; origin: readonly number[]; h: number; scal: WebGLTexture; vel: WebGLTexture; light: WebGLTexture; steps: number; time: number; /** the exhaust's flames, world points (toon stars) */ flames: readonly [number, number, number][] }
export class VolumeDraw {
  private march: WebGLProgram; private comp: WebGLProgram; private noise: WebGLTexture; private half: { c: WebGLTexture; d: WebGLTexture; f: WebGLFramebuffer; w: number; h: number } | null = null;
  private compF = new Map<WebGLTexture, WebGLFramebuffer>(); private locs = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  constructor(readonly gl: WebGL2RenderingContext) { this.march = program(gl, VS, MARCH_FS); this.comp = program(gl, VS, COMP_FS);
    this.noise = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_3D, this.noise); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage3D(gl.TEXTURE_3D, 0, gl.RG8, 32, 32, 32, 0, gl.RG, gl.UNSIGNED_BYTE, worley()); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.REPEAT], [gl.TEXTURE_WRAP_R, gl.REPEAT]] as const) gl.texParameteri(gl.TEXTURE_3D, k, v); gl.bindTexture(gl.TEXTURE_3D, null); }
  private loc(p: WebGLProgram, n: string) { let m = this.locs.get(p); if (!m) { m = new Map(); this.locs.set(p, m); } if (!m.has(n)) m.set(n, this.gl.getUniformLocation(p, n)); return m.get(n)!; }
  private halfFor(W: number, H: number) { const gl = this.gl, w = Math.max(1, W >> 1), h = Math.max(1, H >> 1); if (this.half && this.half.w === w && this.half.h === h) return this.half;
    if (this.half) { gl.deleteTexture(this.half.c); gl.deleteTexture(this.half.d); gl.deleteFramebuffer(this.half.f); }
    const mk = () => { const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, w, h); for (const k of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, k, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    const c = mk(), d = mk(), f = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, c, 0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, d, 0); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    this.half = { c, d, f, w, h }; return this.half; }
  private common(p: WebGLProgram, v: DrawView, g: DrawGrid, inv: Float32Array) { const gl = this.gl, L = (n: string) => this.loc(p, n);
    gl.uniformMatrix4fv(L('uInv'), false, inv); gl.uniform2f(L('uFull'), v.W, v.H); gl.uniform3fv(L('uO'), [...g.origin]); gl.uniform3fv(L('uSun'), [...v.sun]); gl.uniform1f(L('uH'), g.h); gl.uniform1f(L('uTime'), g.time);
    gl.uniform3i(L('uN'), g.A.nx, g.A.ny, g.A.nz); gl.uniform3i(L('uNL'), g.AL.nx, g.AL.ny, g.AL.nz); gl.uniform1i(L('uCols'), g.A.cols); gl.uniform1i(L('uColsL'), g.AL.cols); gl.uniform2f(L('uAS'), g.A.w, g.A.h); gl.uniform2f(L('uALS'), g.AL.w, g.AL.h);
    const tex: [string, WebGLTexture, number][] = [['uDepth', v.depth, 24], ['uScal', g.scal, 25], ['uVel', g.vel, 26], ['uLight', g.light, 27]];
    for (const [n, t, u] of tex) { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(L(n), u); } }
  /** the smoke drawn over the scene's colour (its depth read; the scene's framebuffer bound again after, colour only) */
  draw(v: DrawView, g: DrawGrid): void { const gl = this.gl, inv = invert(v.VP); if (!inv) return; const H = this.halfFor(v.W, v.H);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.STENCIL_TEST); gl.disable(gl.BLEND); gl.depthMask(false); gl.bindVertexArray(null);
    // the march, at half the resolution
    gl.bindFramebuffer(gl.FRAMEBUFFER, H.f); gl.viewport(0, 0, H.w, H.h); gl.useProgram(this.march); this.common(this.march, v, g, inv); const M = (n: string) => this.loc(this.march, n);
    gl.uniform2f(M('uHalf'), H.w, H.h); gl.uniform1i(M('uSteps'), g.steps); gl.uniform1i(M('uToon'), v.toon ? 1 : 0); gl.uniform1i(M('uHDR'), v.hdr ? 1 : 0); gl.uniform1f(M('uDay'), v.day); gl.uniform1f(M('uToonB'), v.toonBands ?? 3);
    gl.activeTexture(gl.TEXTURE28); gl.bindTexture(gl.TEXTURE_3D, this.noise); gl.uniform1i(M('uNoise'), 28); gl.drawArrays(gl.TRIANGLES, 0, 3);
    // laid over the picture, the shadow with it
    let F = this.compF.get(v.col); if (!F) { F = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, F); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, v.col, 0); gl.drawBuffers([gl.COLOR_ATTACHMENT0]); this.compF.set(v.col, F); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, F); gl.viewport(0, 0, v.W, v.H); gl.useProgram(this.comp); this.common(this.comp, v, g, inv); const C = (n: string) => this.loc(this.comp, n);
    gl.activeTexture(gl.TEXTURE29); gl.bindTexture(gl.TEXTURE_2D, H.c); gl.uniform1i(C('uC'), 29); gl.activeTexture(gl.TEXTURE30); gl.bindTexture(gl.TEXTURE_2D, H.d); gl.uniform1i(C('uD'), 30);
    gl.uniform2f(C('uHalf'), H.w, H.h); gl.uniform1i(C('uToon'), v.toon ? 1 : 0); gl.uniform1f(C('uShadowK'), v.toon ? 0.55 : 0.7);
    const st: number[] = []; if (v.toon) for (const [x, y, z] of g.flames.slice(0, 8)) { const P = v.VP, cw = P[3]! * x + P[7]! * y + P[11]! * z + P[15]!; if (cw <= 0) continue;
      const sx = ((P[0]! * x + P[4]! * y + P[8]! * z + P[12]!) / cw * 0.5 + 0.5) * v.W, sy = ((P[1]! * x + P[5]! * y + P[9]! * z + P[13]!) / cw * 0.5 + 0.5) * v.H, px = Math.max(5, Math.min(26, v.H * 0.022 / Math.max(0.3, cw * 0.06)));
      st.push(sx, sy, px, (x * 7.3 + y * 3.1) % 6.28); }
    gl.uniform1i(C('uStarN'), st.length / 4); if (st.length) gl.uniform4fv(C('uStars'), st);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.disable(gl.BLEND);
    for (let u = 24; u <= 30; u++) { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(u === 28 ? gl.TEXTURE_3D : gl.TEXTURE_2D, null); }
    // the scene's framebuffer again, as the renderer left it for the glass (colour only, depth tested, not written)
    gl.bindFramebuffer(gl.FRAMEBUFFER, v.fbo); gl.viewport(0, 0, v.W, v.H); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE, gl.NONE, gl.NONE]); gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.activeTexture(gl.TEXTURE0); }
  dispose(): void { const gl = this.gl; gl.deleteProgram(this.march); gl.deleteProgram(this.comp); gl.deleteTexture(this.noise); if (this.half) { gl.deleteTexture(this.half.c); gl.deleteTexture(this.half.d); gl.deleteFramebuffer(this.half.f); } for (const f of this.compF.values()) gl.deleteFramebuffer(f); }
}
/** a 4x4 matrix's inverse (column-major), null if it has none */
export function invert(m: Float32Array): Float32Array | null { const a = Array.from(m), r = new Float32Array(16);
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; if (!d) return null; d = 1 / d;
  r[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d; r[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d; r[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d; r[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d;
  r[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d; r[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d; r[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d; r[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
  r[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d; r[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d; r[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d; r[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d;
  r[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d; r[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d; r[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d; r[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d; return r; }
