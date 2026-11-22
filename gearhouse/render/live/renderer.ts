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
/** a tyre's shape this moment (review 101): its ring's give at 32 angles from straight down toward the front (m), the patch's shift (m, along and across) */
export interface LiveTyre { u: Float32Array; sx: number; sy: number }
export interface LiveCar { /** age: rust, fading, dirt (0..1) (review 104) */ wear?: [number, number, number]; /** FL FR RL RR */ tyres?: LiveTyre[]; g: GpuMesh; x: number; y: number; z: number; yaw: number; roll: number; pitch: number; /** each front wheel's own angle (rad, left +): the inner one more */ steerL: number; steerR: number; spin: number; player: boolean }
export interface LiveProp { g: GpuMesh; x: number; y: number; z: number; h: number }
export interface Skid { x: number; y: number; z: number; a: number }

const SUN_W = (() => { const v = [-0.45, 0.35, 0.82], l = Math.hypot(...v); return v.map(c => c / l) as [number, number, number]; })();   // toward the sun, world axes: from the upper left of the default view
const LIGHT = `
const vec3 SUN_C = vec3(1.0, 0.95, 0.84), SKY_C = vec3(0.6, 0.68, 0.82), GROUND_C = vec3(0.5, 0.45, 0.36);
const vec3 ENV_TOP = vec3(150., 176., 214.) / 255., ENV_HOR = vec3(236., 233., 224.) / 255., ENV_GROUND = vec3(92., 88., 68.) / 255.;
vec3 envAt(float rz) { if (rz < -0.06) return ENV_GROUND; if (rz < 0.22) return ENV_HOR; float t = min(1., (rz - 0.22) / 0.6); return mix(ENV_HOR, ENV_TOP, t); }
uniform highp sampler2DShadow uShadow; uniform mat4 uLight;
uniform int uLook;   // 0: the baked pictures' stepped light; 1: physically based, its brightness stepped; 2: physically based, smooth
const vec3 SUN_E = vec3(1.0, 0.95, 0.84) * 3.0;
vec3 toLin(vec3 c) { return pow(max(c, vec3(0.)), vec3(2.2)); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0., 1.); }
vec3 irradiance(vec3 n) { return mix(toLin(ENV_GROUND), toLin(mix(ENV_HOR, ENV_TOP, 0.55)), 0.5 + 0.5 * n.z); }
float D_GGX(float nh, float a) { float a2 = a * a, d = nh * nh * (a2 - 1.) + 1.; return a2 / (3.14159 * d * d); }
float V_Smith(float nv, float nl, float a) { float k = a * 0.5; return 0.25 / ((nv * (1. - k) + k) * (nl * (1. - k) + k)); }
vec2 envBRDF(float nv, float r) { vec4 rr = r * vec4(-1., -0.0275, -0.572, 0.022) + vec4(1., 0.0425, 1.04, -0.04); float a = min(rr.x * rr.x, exp2(-9.28 * nv)) * rr.x + rr.y; return vec2(-1.04, 1.04) * a + rr.zw; }
/** metallic-roughness shading (GGX, Smith, Schlick; the sky as an analytic light: its irradiance, and its reflection blurred by roughness), a clear coat for paint */
vec3 pbr(vec3 baseSrgb, vec3 n, vec3 v, vec3 l, float sh, float metal, float rough, float coat) {
  vec3 alb = toLin(baseSrgb); float a = max(0.02, rough * rough); vec3 h = normalize(l + v);
  float nl = max(0., dot(n, l)), nv = max(1e-3, dot(n, v)), nh = max(0., dot(n, h)), vh = max(0., dot(v, h));
  vec3 f0 = mix(vec3(0.04), alb, metal), F = f0 + (1. - f0) * pow(1. - vh, 5.), kd = (1. - F) * (1. - metal);
  vec3 col = (kd * alb / 3.14159 + D_GGX(nh, a) * V_Smith(nv, nl, a) * F) * SUN_E * nl * sh;
  vec3 r = reflect(-v, n); vec2 ab = envBRDF(nv, rough); vec3 envS = mix(toLin(envAt(r.z)), irradiance(r), clamp(rough * 1.4, 0., 1.));
  col += kd * alb * irradiance(n) + envS * (f0 * ab.x + ab.y);
  if (coat > 0.) { float Fc = (0.04 + 0.96 * pow(1. - nv, 5.)) * coat; col = col * (1. - Fc) + toLin(envAt(r.z)) * Fc + D_GGX(nh, 0.06) * V_Smith(nv, nl, 0.06) * 0.04 * coat * SUN_E * nl * sh; }
  return col; }
// ---- PBR detail textures (review 103): seven layers (concrete, grass, metal, rubber, leather, canvas, wood), each a
// tile of known size; the albedo used for its light and dark only (the game keeps its colours), roughness and normals ----
uniform highp sampler2DArray uAlb, uNor, uRgh; uniform int uTex; uniform float uTSize[7], uTLuma[7], uTRough[7];
struct Detail { float tone; float rough; vec3 n; };
/** a layer laid three ways (by the normal's main axes) at point p (m), on normal n: its tone, roughness offset, bent normal */
Detail detail(int L, vec3 p, vec3 n, float sa, float sn, float sr) { Detail d; d.tone = 1.; d.rough = 0.; d.n = n; if (uTex == 0 || L < 0) return d;
  vec3 q = p / uTSize[L], w = pow(abs(n), vec3(4.)); w /= (w.x + w.y + w.z); float fl = float(L);
  vec3 ax = vec3(q.zy, fl), ay = vec3(q.xz, fl), az = vec3(q.xy, fl);
  vec3 a = texture(uAlb, ax).rgb * w.x + texture(uAlb, ay).rgb * w.y + texture(uAlb, az).rgb * w.z;
  float r = texture(uRgh, ax).r * w.x + texture(uRgh, ay).r * w.y + texture(uRgh, az).r * w.z;
  vec3 tx = texture(uNor, ax).xyz * 2. - 1., ty = texture(uNor, ay).xyz * 2. - 1., tz = texture(uNor, az).xyz * 2. - 1.;
  vec3 bend = vec3(0., tx.y, tx.x) * w.x + vec3(ty.x, 0., ty.y) * w.y + vec3(tz.xy, 0.) * w.z;
  d.tone = clamp(mix(1., dot(a, vec3(0.3, 0.59, 0.11)) / uTLuma[L], sa), 0.45, 1.7); d.rough = (r - uTRough[L]) * sr; d.n = normalize(n + bend * sn); return d; }
/** the linear colour to the screen: exposure, filmic curve, gamma; stepped in brightness for the stepped look */
vec3 present(vec3 c) { vec3 s = pow(aces(c * 0.6), vec3(1. / 2.2));   /* exposure set so the concrete reads as bright as in the baked look */ if (uLook == 1) { float L = dot(s, vec3(0.3, 0.59, 0.11)), q = floor(L * 7. + 0.5) / 7.; s *= q / max(L, 1e-3); } return min(s, vec3(1.)); }
float lightAt(vec3 w) { vec4 l = uLight * vec4(w, 1.); vec3 q = l.xyz * 0.5 + 0.5; if (q.x <= 0. || q.y <= 0. || q.x >= 1. || q.y >= 1. || q.z >= 1.) return 1.; return texture(uShadow, vec3(q.xy, q.z - 0.0015)); }
`;
const OBJ_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec3 aCol; layout(location=3) in float aGloss; layout(location=4) in float aKind; layout(location=5) in float aPart;
uniform mat4 uVP, uModel; uniform float uBias;
uniform int uWheel; uniform float uSpin, uDef[32], uTyreR, uRim; uniform vec2 uShift;
out vec3 vWorld, vObj; flat out vec3 vN, vObjN, vCol; flat out float vGloss, vKind, vPart;
void main() { vec3 p = aPos, nr = aNor;
  if (uWheel == 1) {
    if (int(aKind + 0.5) == 5) {   // the tyre, shaped by its ring in the hub's frame (the ring keeps to the road; it does not turn with the wheel)
      float rho = length(p.xz), t = clamp((rho - uRim) / max(1., uTyreR - uRim), 0., 1.), a = atan(-p.x, -p.z);
      float fi = mod(a / 6.2831853 * 32. + 32., 32.); int i0 = int(floor(fi)); float d = mix(uDef[i0], uDef[(i0 + 1) % 32], fract(fi)) * t;
      vec2 dir = p.xz / max(rho, 1.); float low = max(0., dir.y * -1.); low *= low;
      p.xz -= dir * d; p.y += sign(p.y) * d * 0.5 * (1. - abs(2. * t - 1.));   // the tread pressed in, the walls bulging out beside it
      p.y += uShift.y * t * low; p.x -= uShift.x * t * low; }   // the patch pulled across and along by the forces
    else { float c = cos(uSpin), s = sin(uSpin); p = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z); nr = vec3(c * nr.x - s * nr.z, nr.y, s * nr.x + c * nr.z); } }
  vec4 w = uModel * vec4(p, 1.); vWorld = w.xyz; vObj = p; vObjN = nr; vN = normalize(mat3(uModel) * nr); vCol = aCol; vGloss = aGloss; vKind = aKind; vPart = aPart;
  gl_Position = uVP * w; gl_Position.z -= uBias; }`;
const OBJ_FS = `#version 300 es
precision highp float;
${LIGHT}
in vec3 vWorld, vObj; flat in vec3 vN, vObjN, vCol; flat in float vGloss, vKind, vPart;
uniform mat4 uModel; uniform vec3 uEye, uSun; uniform vec2 uObj; uniform vec3 uWear; uniform float uObjZ, uCarH;
// ---- the 2D art laid on (review 105, PBR step 4): the part model's views of this car, each face taking the view it looks along ----
uniform sampler2D uArt, uArtLut; uniform int uArtOn; uniform highp int uWheel; uniform float uArtMM, uArtC; uniform vec4 uArtR[5]; uniform vec2 uArtO[5];
vec4 artAt(int v, float h, float vv) { vec4 r = uArtR[v]; vec2 px = vec2(uArtO[v].x + h / uArtMM, uArtO[v].y - vv / uArtMM);
  if (px.x < 0. || px.y < 0. || px.x >= r.z || px.y >= r.w) return vec4(0.); return texelFetch(uArt, ivec2(r.xy + px), 0); }
/** the views that see this face, blended by how squarely; a view's pixel counts only where it shows this same part (else it shows what stands before it) */
vec4 artOn(vec3 p, vec3 n, float part) { vec3 w = pow(abs(n), vec3(4.)); w /= w.x + w.y + w.z; vec4 a = vec4(0.); float ws = 0.;
  float g = floor(texelFetch(uArtLut, ivec2(int(part), 0), 0).r * 255. + 0.5); if (g < 0.5) return vec4(0.);
  vec4 s = n.y > 0. ? artAt(0, p.x, p.z) : artAt(1, p.x, p.z); if (abs(s.a * 255. - g) < 0.5) { a += s * w.y; ws += w.y; }
  vec4 f = n.x < 0. ? artAt(2, uArtC + p.y, p.z) : artAt(3, uArtC - p.y, p.z); if (abs(f.a * 255. - g) < 0.5) { a += f * w.x; ws += w.x; }
  if (n.z > 0.) { vec4 t = artAt(4, p.x, uArtC - p.y); if (abs(t.a * 255. - g) < 0.5) { a += t * w.z; ws += w.z; } }
  return ws > 0.01 ? vec4(a.rgb / ws, ws) : vec4(0.); }
// ---- age (review 104), the 2D wear system's rules in the material's terms: noise in the thing's own axes ----
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float fbm(vec3 p) { float a = 0.5, s = 0.; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s / 0.9375; }
vec3 rustAt(float t) { vec3 R[6] = vec3[6](vec3(184, 104, 46), vec3(156, 80, 34), vec3(126, 60, 26), vec3(92, 42, 20), vec3(60, 30, 16), vec3(40, 21, 12)); float k = clamp(t, 0., 1.) * 4.999; int i = int(k); return mix(R[i], R[min(5, i + 1)], fract(k)) / 255.; } uniform float uOutline; uniform int uMode; uniform vec4 uSil; uniform float uGlass;
uniform int uDecN; uniform vec3 uDecO[4], uDecN_[4], uDecUp[4]; uniform float uDecR[4]; uniform sampler2D uDecTex;
layout(location=0) out vec4 oCol; layout(location=1) out vec4 oId; layout(location=2) out vec4 oN;   // oN: the normal and how mirror-like (for the traced reflections)
void main() {
  if (uMode == 1) { oCol = uSil; oId = vec4(0.); oN = vec4(0.); return; }
  vec3 n = vN; if (dot(n, uEye) < 0.) n = -n;
  vec3 base = vCol; int kind = int(vKind + 0.5);
  float sh = lightAt(vWorld);
  float d = max(0., dot(n, uSun)) * sh, up = 0.5 + 0.5 * n.z;
  float ne = dot(n, uEye), rz = 2. * ne * n.z - uEye.z;
  if (uMode == 2) {   // glass: mirrors more at a glancing angle, laid over at its own strength
    float F = 0.06 + 0.94 * pow(1. - abs(ne), 4.); vec3 env = envAt(rz), tint = kind == 4 ? base : vec3(150., 172., 182.) / 255.;
    float k = 0.62 + 0.45 * d + (n.z > 0.3 ? 0.1 : 0.); vec3 c = tint * (1. - 0.55 * (0.4 + F)) + env / k * 0.55 * (0.4 + F);
    oCol = vec4(min(vec3(1.), c * k), min(1., (kind == 4 ? uGlass + 0.15 : uGlass) + (1. - uGlass) * F * 0.7)); oId = vec4(0.); oN = vec4(0.); return; }
  if (kind == 1 && uDecN > 0) for (int i = 0; i < 4; i++) { if (i >= uDecN) break;
    vec3 dd = vObj - uDecO[i]; float depth = dot(dd, uDecN_[i]); if (abs(depth) > uDecR[i] * 0.8 || abs(dot(vObjN, uDecN_[i])) < 0.45) continue;
    vec3 rt = normalize(cross(uDecN_[i], uDecUp[i])); vec2 uv = vec2(dot(dd, rt), dot(dd, uDecUp[i])) / uDecR[i] * 0.5 + 0.5; if (any(lessThan(uv, vec2(0.))) || any(greaterThan(uv, vec2(1.)))) continue;
    vec4 t = texture(uDecTex, vec2((float(i) + uv.x) / 4., uv.y)); if (t.a > 0.5) base = t.rgb; }
  if (uLook > 0) {   // the physically based looks: each kind of material its metalness and roughness
    float metal = 0., rough = 0.6, coat = 0.;
    if (kind == 1) { rough = 0.55 - 0.3 * vGloss; coat = vGloss; } else if (kind == 2 || kind == 10) { metal = 1.; rough = vGloss > 0.7 ? 0.12 : 0.42; }
    else if (kind == 5) rough = 0.9; else if (kind == 7) rough = 0.95; else if (kind == 8) rough = 0.5; else if (kind == 6) rough = 0.65; else if (kind == 9) rough = 0.15;
    else if (vGloss > 0.7) { metal = 1.; rough = 0.15; } else rough = 0.85 - 0.6 * vGloss;
    // the material's detail, laid in the thing's own axes (it moves with it); bright metal and paint only a little
    int L = -1; float sa = 0., sn = 0., sr = 0.;
    if (kind == 1) { L = 2; sa = 0.; sn = 0.18; sr = 0.35; } else if (metal > 0.5) { L = 2; sa = 0.12; sn = 0.3; sr = 0.5; } else if (kind == 5) { L = 3; sa = 0.5; sn = 0.6; sr = 0.3; }
    else if (kind == 8) { L = 4; sa = 0.7; sn = 0.8; sr = 0.6; } else if (kind == 7) { L = 5; sa = 0.6; sn = 0.9; sr = 0.5; } else if (kind == 6) { L = 6; sa = 0.9; sn = 0.6; sr = 0.6; } else if (kind == 0) { L = 0; sa = 0.35; sn = 0.3; sr = 0.3; }
    vec3 no = vObjN; if (dot(normalize(mat3(uModel) * no), uEye) < 0.) no = -no;
    Detail dt = detail(L, vObj / 1000., no, sa, sn, sr); vec3 nw = normalize(mat3(uModel) * dt.n); if (dot(nw, uEye) < 0.) nw = n;
    if (uArtOn == 1 && uWheel == 0 && uMode == 0 && (kind == 0 || kind == 1 || kind == 7 || kind == 8 || kind == 10)) { vec4 art = artOn(vObj, no, vPart); if (art.a > 0.) base = mix(base, art.rgb, 0.85 * art.a); }   /* the painted detail of the 2D art: badges, lines, louvres, pleats */
    base *= dt.tone; rough = clamp(rough + dt.rough, 0.04, 1.);
    if (uWear != vec3(0.)) { vec3 P = vObj / 1000.; float Z = (vObj.z + uObjZ) / 1000., low = 1. - smoothstep(0.17, 0.64, Z / max(0.8, uCarH));   /* low down: by the car's own height */
      bool painted = kind == 1 || (kind == 0 && metal < 0.5);
      if (painted && uWear.y > 0.) {   // the sun takes the lacquer: most on what faces the sky; flat, paler, greyer; crazed when far gone
        float sky = 0.45 + 0.55 * max(0., nw.z), blot = smoothstep(0.3, 0.7, fbm(P * 6.7) * 0.75 + fbm(P * vec3(70., 4., 70.)) * 0.25 + (uWear.y - 0.5) * 0.8), a = min(1., uWear.y * sky * (0.5 + 0.5 * blot) * 1.6);
        float lm = dot(base, vec3(0.3, 0.59, 0.11)); base = mix(base, mix(vec3(lm), base, 0.35) + (0.7 - lm) * 0.55, a); coat *= 1. - a; rough = mix(rough, 0.78, a);
        if (a > 0.45) { vec3 q = P * 28.; float e = abs(fract(q.x + 0.3 * vnoise(q * 2.)) - 0.5) + abs(fract(q.y + q.z + 0.3 * vnoise(q * 2.3)) - 0.5); if (e < 0.08) base *= 0.82; } }   /* crazing: a fine net of cracks */
      if (painted && uWear.x > 0.) {   // rust: low down and in patches, its edge lifting to primer, streaks running down below it
        float field = fbm(P * 6.1 + 3.) * 0.8 + fbm(P * 45.) * 0.2, score = field * 0.62 + low * 0.52, t0 = 0.8 - uWear.x * 0.42;
        if (score >= t0) { float depth = (score - t0) / 0.16; base = rustAt(0.22 + depth * 0.7 + (fbm(P * 110.) - 0.5) * 0.45); metal = 0.; rough = 0.93; coat = 0.;
          vec3 g = vec3(fbm(P * 90. + vec3(0.02, 0, 0)), fbm(P * 90. + vec3(0, 0.02, 0)), fbm(P * 90. + vec3(0, 0, 0.02))) - fbm(P * 90.); nw = normalize(nw + normalize(mat3(uModel) * g + 1e-6) * min(0.6, length(g) * 2.) * min(1., depth)); }   /* the scale's rough surface */
        else if (score > t0 - 0.06 * (0.5 + uWear.x)) { base = h3(floor(P * 400.)) < 0.5 ? vec3(118, 84, 70) / 255. : vec3(92, 70, 60) / 255.; coat = 0.; rough = 0.82; }
        else if (abs(nw.z) < 0.6 && score > t0 - 0.16 && fbm(vec3(P.x * 60., P.z * 2.2, P.y * 60.)) > 0.66) base = mix(base, rustAt(0.5), 0.45 * uWear.x); }
      if (metal > 0.5) {   // bright metal: a milky film, then pitting through the plate to the nickel and rust
        rough = mix(rough, 0.45, uWear.y * 0.8); base = mix(base, vec3(0.62), uWear.y * 0.4);
        float nn = fbm(P * 33. + 7.) * 0.8 + low * 0.25; if (uWear.x > 0. && nn > 1.05 - uWear.x * 0.6) { metal = 0.; rough = 0.9; base = nn > 1.13 - uWear.x * 0.5 ? rustAt(0.35 + h3(floor(P * 500.)) * 0.35) : vec3(168, 136, 96) / 255.; } }
      if (uWear.z > 0.) {   // road dirt: thrown up low on the body and the wheels, dust settling on what faces up
        float dz = uWear.z * (1.15 - smoothstep(0.1, 0.9, Z)) * (0.6 + 0.9 * fbm(P * vec3(9., 9., 3.))) + uWear.z * 0.3 * max(0., nw.z) * fbm(P * 3.1);
        dz = clamp(dz, 0., 0.94); base = mix(base, mix(vec3(0.38, 0.31, 0.22), vec3(0.52, 0.46, 0.37), fbm(P * 21.)), dz); rough = mix(rough, 0.96, dz); coat *= 1. - dz; metal *= 1. - dz; } }
    oCol = vec4(present(pbr(base, nw, uEye, uSun, sh, metal, rough, coat)), 1.); oId = vec4(uObj, vPart / 255., uOutline / 8.); oN = vec4(nw * 0.5 + 0.5, metal > 0.5 ? 1. - rough : coat * (1. - rough) * 0.5); return; }
  float dq = floor(d * 4. + 0.5) / 4.;
  vec3 diff = SUN_C * dq * 0.78 + (SKY_C * up + GROUND_C * (1. - up)) * 0.6, c;
  vec3 env = envAt(rz);
  if (vGloss > 0.7) { float tint = 0.55 + 0.45 * max(base.r, max(base.g, base.b)); c = min(vec3(1.), env * 0.82 * (base * 0.5 + 0.5) * tint + base * diff * 0.15); }
  else { vec3 h = normalize(uSun + uEye); float nh = max(0., dot(n, h)), g = vGloss, sp = g > 0.2 ? pow(nh, 6. + g * 110.) : 0., spec = (sp > 0.65 ? 1. : sp > 0.3 ? 0.5 : 0.) * sh;
    float refl = g > 0.3 ? 0.1 * g * (0.4 + 0.6 * up) : 0.; c = min(vec3(1.), base * diff * (1. - refl) + env * refl) + spec * (40. + 80. * g) / 255. * vec3(1., 0.97, 0.9); }
  oCol = vec4(min(c, vec3(1.)), 1.); oId = vec4(uObj, vPart / 255., uOutline / 8.); oN = vec4(n * 0.5 + 0.5, 0.); }`;
const GROUND_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec4 aCol; layout(location=2) in float aFlag;
uniform mat4 uVP; uniform float uBias; out vec3 vWorld; out vec4 vCol; flat out float vFlag;
void main() { vWorld = aPos; vCol = aCol; vFlag = aFlag; gl_Position = uVP * vec4(aPos, 1.); gl_Position.z -= uBias; }`;
const GROUND_FS = `#version 300 es
precision highp float;
${LIGHT}
in vec3 vWorld; in vec4 vCol; flat in float vFlag; uniform float uCell; uniform vec3 uSun, uEye;
layout(location=0) out vec4 oCol; layout(location=1) out vec4 oId; layout(location=2) out vec4 oN;   // oN: the normal and how mirror-like (for the traced reflections)
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() { vec3 c = vCol.rgb;
  if (vFlag > 0.5 && uLook == 0) { vec2 cell = floor(vWorld.xy / vec2(uCell * 2., uCell)); float h = hash(cell); if (h > 0.955) c = vec3(107., 130., 83.) / 255.; else if (h > 0.91) c = vec3(83., 104., 63.) / 255.; }
  if (uLook > 0) { vec3 nn = normalize(cross(dFdx(vWorld), dFdy(vWorld))); if (nn.z < 0.) nn = -nn; float sh = lightAt(vWorld + vec3(0., 0., 0.02));   // the ground as a rough, dull surface
    Detail dt = detail(vFlag > 0.5 ? 1 : 0, vWorld, nn, vFlag > 0.5 ? 0.8 : 0.7, 0.6, 0.4);
    oCol = vec4(present(pbr(c * dt.tone, dt.n, uEye, uSun, sh, 0., clamp(0.92 + dt.rough, 0.3, 1.), 0.)), vCol.a); oId = vec4(0.); oN = vec4(dt.n * 0.5 + 0.5, 0.); return; }
  c = mix(c, vec3(24., 22., 20.) / 255., (1. - lightAt(vWorld + vec3(0., 0., 0.02))) * 0.43);
  oCol = vec4(c, vCol.a); oId = vec4(0.); oN = vec4(0.5, 0.5, 1., 0.); }`;
const DEPTH_VS = `#version 300 es
layout(location=0) in vec3 aPos; uniform mat4 uVP, uModel; void main() { gl_Position = uVP * uModel * vec4(aPos, 1.); }`;
const DEPTH_FS = `#version 300 es
precision mediump float; out vec4 o; void main() { o = vec4(1.); }`;
const POST_VS = `#version 300 es
out vec2 vUv; void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUv = p; gl_Position = vec4(p * 2. - 1., 0., 1.); }`;
const POST_FS = `#version 300 es
precision highp float;
uniform sampler2D uCol, uId, uDepth, uN; uniform float uRange, uStep; uniform int uInner, uRays; uniform mat4 uVP; uniform vec3 uVd, uSunD; in vec2 vUv; out vec4 o;
float obj(vec4 id) { return floor(id.r * 255. + 0.5) + floor(id.g * 255. + 0.5) * 256.; }
// ---- rays in the picture (review 106, brief 75 §1): a world direction as a step across the picture (pixels a metre)
//      and in the depth layer (its units a metre); the camera being orthographic, the same everywhere ----
vec3 toScreen(vec3 d) { vec4 c = uVP * vec4(d, 0.); vec2 sz = vec2(textureSize(uCol, 0)); return vec3(c.x * sz.x * 0.5, c.y * sz.y * 0.5, c.z * 0.5); }
float hsh(vec2 q) { return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }
void main() { ivec2 p = ivec2(gl_FragCoord.xy), sz = textureSize(uCol, 0); vec4 c = texelFetch(uCol, p, 0), id = texelFetch(uId, p, 0); float me = obj(id);
  float d0 = texelFetch(uDepth, p, 0).r; vec4 G = texelFetch(uN, p, 0);
  if (uRays == 1 && d0 < 0.9999) { vec3 n = normalize(G.xyz * 2. - 1.); float M = 0.5 / uRange;   // M: a metre in the depth layer
    // ambient occlusion: eight short rays over the surface; where the scene stands nearer than the ray's end, the sky is hidden
    int bx = (p.x & 3) + (p.y & 3) * 4; float occ = 0., rot = float((bx * 7) % 16) / 16. * 6.2831;   /* an ordered turn of the kernel, 4 x 4: an even pattern, no grain */ vec3 t1 = normalize(abs(n.z) < 0.9 ? cross(n, vec3(0., 0., 1.)) : cross(n, vec3(1., 0., 0.))), t2 = cross(n, t1);
    for (int k = 0; k < 8; k++) { float a = rot + float(k) * 2.399, r = 0.08 + 0.3 * fract(float(k) * 0.618 + float(bx) * 0.0625), up = 0.35 + 0.6 * fract(float(k) * 0.381);
      vec3 o3 = (t1 * cos(a) + t2 * sin(a)) * r * sqrt(1. - up * up) + n * r * up; vec3 st = toScreen(o3); ivec2 q = p + ivec2(st.xy);
      if (q.x < 0 || q.y < 0 || q.x >= sz.x || q.y >= sz.y) continue; float sd = texelFetch(uDepth, q, 0).r, rd = d0 + st.z;
      if (sd < rd - 0.07 * M && rd - sd < 0.45 * M) occ += 1. - (rd - sd) / (0.45 * M); }   /* nearer blockers count more; far ones (the car's roof over the road) not at all */
    c.rgb *= 1. - min(1., occ / 8.) * 0.55;
    // contact shadow: a short ray toward the sun; the small things the shadow map is too coarse for
    if (dot(n, uSunD) > 0.15) { vec3 st = toScreen(uSunD); for (int k = 1; k <= 10; k++) { float t = float(k) * 0.035; ivec2 q = p + ivec2(st.xy * t); if (q.x < 0 || q.y < 0 || q.x >= sz.x || q.y >= sz.y) break;
      float sd = texelFetch(uDepth, q, 0).r, rd = d0 + st.z * t; if (sd < rd - 0.02 * M && rd - sd < 0.3 * M) { c.rgb *= 0.74; break; } } }
    // reflections: the eye's ray bounced off a mirror-like surface, marched across the picture until it passes behind something
    if (G.a > 0.04) { vec3 r = reflect(uVd, n), st = toScreen(r); float L = length(st.xy);
      if (L > 0.5) { float stepM = 1.2 / L; for (int k = 1; k <= 56; k++) { float t = float(k) * stepM; vec2 qf = vec2(p) + st.xy * t; ivec2 q = ivec2(qf);
          if (q.x < 0 || q.y < 0 || q.x >= sz.x || q.y >= sz.y) break; float rd = d0 + st.z * t, sd = texelFetch(uDepth, q, 0).r;
          if (rd > sd + 0.03 * M && rd - sd < 0.6 * M + abs(st.z) * stepM) { vec3 hc = texelFetch(uCol, q, 0).rgb; vec2 e = min(qf, vec2(sz) - qf) / vec2(sz) * 8.;
            float fade = clamp(min(e.x, e.y), 0., 1.) * (1. - float(k) / 56.); float F = G.a * (0.5 + 0.5 * pow(1. - max(0., dot(-uVd, n)), 3.)); c.rgb = mix(c.rgb, hc, clamp(F * fade, 0., 0.85)); break; } } } } }
  if (me > 0.) { float dp = texelFetch(uDepth, p, 0).r * 2. * uRange; int w = int(floor(id.a * 8. + 0.5)); float k = 1.;
    ivec2 dirs[4] = ivec2[4](ivec2(1, 0), ivec2(-1, 0), ivec2(0, 1), ivec2(0, -1));
    for (int s = 1; s <= 3; s++) { if (s > w) break; for (int j = 0; j < 4; j++) { ivec2 q = p + dirs[j] * s; if (q.x < 0 || q.y < 0 || q.x >= sz.x || q.y >= sz.y) { k = 0.2; continue; }
      vec4 iq = texelFetch(uId, q, 0); float oq = obj(iq), dq = texelFetch(uDepth, q, 0).r * 2. * uRange;
      if (oq != me && (oq == 0. || dq > dp)) k = 0.2;
      else if (uInner == 1 && s == 1 && oq == me && k > 0.5 && ((abs(iq.b - id.b) > 0.001 && dp - dq > 0.004) || dp - dq > uStep)) k = 0.5; } }
    c.rgb *= k; }
  o = vec4(c.rgb, 1.); }`;

interface WheelDraw { hubZ: number; spin: number; def: Float32Array; sx: number; sy: number; R: number; rim: number }
type Piece = [{ vao: WebGLVertexArrayObject; n: number }, M4, WheelDraw?];
export class LiveRenderer {
  readonly gl: WebGL2RenderingContext; private obj: WebGLProgram; private ground: WebGLProgram; private depth: WebGLProgram; private post: WebGLProgram;
  private fbo: WebGLFramebuffer; private tCol: WebGLTexture; private tId: WebGLTexture; private tN: WebGLTexture; private tDepth: WebGLTexture; private W = 0; private H = 0;
  private sFbo: WebGLFramebuffer; private sTex: WebGLTexture; private S = 2048;
  private groundVao: WebGLVertexArrayObject | null = null; private groundN = 0; private fenceVao: WebGLVertexArrayObject | null = null; private fenceN = 0;
  private skidVao: WebGLVertexArrayObject; private skidBuf: WebGLBuffer; private kinds = new Map<string, GpuMesh>(); private cars = new Map<Mesh, GpuMesh>();
  private u = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>(); private blank: WebGLTexture; private arts = new Map<GpuMesh, { lut: WebGLTexture; tex: WebGLTexture; mm: number; C: number; rects: Float32Array; origins: Float32Array }>(); private tex: { alb: WebGLTexture; nor: WebGLTexture; rgh: WebGLTexture; size: Float32Array; luma: Float32Array; rough: Float32Array } | null = null;
  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, preserveDrawingBuffer: true }); if (!gl) throw new Error('no WebGL2'); this.gl = gl;
    this.obj = program(gl, OBJ_VS, OBJ_FS); this.ground = program(gl, GROUND_VS, GROUND_FS); this.depth = program(gl, DEPTH_VS, DEPTH_FS); this.post = program(gl, POST_VS, POST_FS);
    this.fbo = gl.createFramebuffer()!; this.tCol = gl.createTexture()!; this.tId = gl.createTexture()!; this.tN = gl.createTexture()!; this.tDepth = gl.createTexture()!;
    this.sFbo = gl.createFramebuffer()!; this.sTex = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, this.sTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, this.S, this.S); this.texParams(gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sFbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.sTex, 0); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.blank = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, this.blank); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); this.texParams(gl.NEAREST);   // what an unused sampler reads (never the picture being drawn)
    this.skidVao = gl.createVertexArray()!; this.skidBuf = gl.createBuffer()!; gl.bindVertexArray(this.skidVao); gl.bindBuffer(gl.ARRAY_BUFFER, this.skidBuf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 32, 28); gl.bindVertexArray(null); }
  private texParams(f: number) { const gl = this.gl; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
  private loc(p: WebGLProgram, name: string) { let m = this.u.get(p); if (!m) { m = new Map(); this.u.set(p, m); } if (!m.has(name)) m.set(name, this.gl.getUniformLocation(p, name)); return m.get(name)!; }
  private size(W: number, H: number) { if (W === this.W && H === this.H) return; const gl = this.gl; this.W = W; this.H = H;
    for (const [t, f, fmt, type] of [[this.tCol, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE], [this.tId, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE], [this.tN, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE], [this.tDepth, gl.DEPTH24_STENCIL8, gl.DEPTH_STENCIL, gl.UNSIGNED_INT_24_8]] as const) {
      gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, f, W, H, 0, fmt, type, null); this.texParams(gl.NEAREST); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tCol, 0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.tId, 0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, this.tN, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.TEXTURE_2D, this.tDepth, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
  private vaoOf(d: GroundData): WebGLVertexArrayObject { const gl = this.gl, vao = gl.createVertexArray()!; gl.bindVertexArray(vao);
    const b = (loc: number, data: ArrayBufferView, size: number, type: number, norm: boolean) => { const buf = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type, norm, 0, 0); };
    b(0, d.pos, 3, gl.FLOAT, false); b(1, d.col, 3, gl.UNSIGNED_BYTE, true); b(2, d.flag, 1, gl.FLOAT, false); gl.bindVertexArray(null); return vao; }
  /** the PBR detail textures: three pictures of the layers stacked top to bottom (albedo, normal, roughness), each layer
   *  a square tile; its size (m), mean brightness and roughness. Mipmapped, repeating, as texture arrays */
  setTextures(alb: HTMLImageElement, nor: HTMLImageElement, rgh: HTMLImageElement, layers: { size_m: number; luma_mean: number; rough_mean: number }[]) { const gl = this.gl, n = layers.length;
    const arr = (img: HTMLImageElement) => { const S = img.width, c = document.createElement('canvas'); c.width = S; c.height = S * n; const x = c.getContext('2d')!; x.drawImage(img, 0, 0); const px = x.getImageData(0, 0, S, S * n).data;
      const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D_ARRAY, t); gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, S, S, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.generateMipmap(gl.TEXTURE_2D_ARRAY); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT); return t; };
    this.tex = { alb: arr(alb), nor: arr(nor), rgh: arr(rgh), size: new Float32Array(layers.map(l => l.size_m)), luma: new Float32Array(layers.map(l => l.luma_mean)), rough: new Float32Array(layers.map(l => l.rough_mean)) }; }
  /** a car's 2D art (its part model's views stacked: left, right, front, rear, top), laid on its mesh's painted faces */
  setArt(g: GpuMesh, img: ImageBitmap, meta: { mm: number; C: number; views: Record<string, number[]> }, partGroups: number[]) { const gl = this.gl, t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img); this.texParams(gl.NEAREST); const V = ['left', 'right', 'front', 'rear', 'top'].map(v => meta.views[v]!);
    const lut = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, lut); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, partGroups.length, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(partGroups)); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); this.texParams(gl.NEAREST);
    this.arts.set(g, { lut, tex: t, mm: meta.mm, C: meta.C, rects: new Float32Array(V.flatMap(v => [v[0]!, v[1]!, v[2]!, v[3]!])), origins: new Float32Array(V.flatMap(v => [v[4]!, v[5]!])) }); }
  hasArt(g: GpuMesh): boolean { return this.arts.has(g); }
  setGround(d: GroundData) { this.groundVao = this.vaoOf(d); this.groundN = d.n; }
  setFence(d: GroundData) { this.fenceVao = this.vaoOf(d); this.fenceN = d.n; }
  /** the GPU copy of a prop's mesh (by kind) or a car's (by its mesh object), made once */
  prop(kind: string, make: () => Mesh): GpuMesh { let g = this.kinds.get(kind); if (!g) { g = gpuMesh(this.gl, make(), false); this.kinds.set(kind, g); } return g; }
  car(M: Mesh): GpuMesh { let g = this.cars.get(M); if (!g) { g = gpuMesh(this.gl, M, true); this.cars.set(M, g); } return g; }
  forget(M: Mesh) { this.cars.delete(M); }

  render(v: LiveView, cars: LiveCar[], props: LiveProp[], skids: Skid[], o: { glass?: number; /** 0 the baked look, 1 PBR stepped, 2 PBR smooth */ look?: number; /** lay the 2D art on (default yes) */ art?: boolean; /** the rays in the picture: occlusion, contact shadows, reflections (default yes) */ rays?: boolean } = {}) { const gl = this.gl; this.size(v.W, v.H);
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
    for (const i of [0, 1, 2, 8]) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, this.blank); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo); gl.viewport(0, 0, v.W, v.H); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
    gl.clearBufferfv(gl.COLOR, 0, [0.36, 0.45, 0.28, 1]); gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]); gl.clearBufferfv(gl.COLOR, 2, [0.5, 0.5, 1, 0]); gl.clearBufferfi(gl.DEPTH_STENCIL, 0, 1, 0);
    const texTo = (p: WebGLProgram) => { gl.uniform1i(this.loc(p, 'uTex'), this.tex ? 1 : 0); if (!this.tex) return; const t = this.tex;
      [t.alb, t.nor, t.rgh].forEach((x, i) => { gl.activeTexture(gl.TEXTURE3 + i); gl.bindTexture(gl.TEXTURE_2D_ARRAY, x); gl.uniform1i(this.loc(p, ['uAlb', 'uNor', 'uRgh'][i]!), 3 + i); });
      gl.uniform1fv(this.loc(p, 'uTSize'), t.size); gl.uniform1fv(this.loc(p, 'uTLuma'), t.luma); gl.uniform1fv(this.loc(p, 'uTRough'), t.rough); };
    const shadowTo = (p: WebGLProgram) => { texTo(p); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.sTex); gl.uniform1i(this.loc(p, 'uShadow'), 1); gl.uniformMatrix4fv(this.loc(p, 'uLight'), false, LV); };
    gl.useProgram(this.ground); gl.uniformMatrix4fv(this.loc(this.ground, 'uVP'), false, VP); gl.uniform1i(this.loc(this.ground, 'uLook'), o.look ?? 0); gl.uniform3fv(this.loc(this.ground, 'uSun'), SUN_W); gl.uniform3fv(this.loc(this.ground, 'uEye'), eye); gl.uniform1f(this.loc(this.ground, 'uCell'), Math.max(0.03, v.mm / 1000)); gl.uniform1f(this.loc(this.ground, 'uBias'), 0); shadowTo(this.ground);
    if (this.groundVao) { gl.bindVertexArray(this.groundVao); gl.drawArrays(gl.TRIANGLES, 0, this.groundN); }
    if (this.fenceVao && this.fenceN) { gl.bindVertexArray(this.fenceVao); gl.drawArrays(gl.TRIANGLES, 0, this.fenceN); }
    // skid marks: dark patches on the concrete, blended, nothing else written
    if (skids.length) { const S = skids.filter(m => near(m.x, m.y, 0)), f = new Float32Array(S.length * 6 * 8), r = 0.09;
      S.forEach((m, i) => { const q = [[-r, -r], [r, -r], [r, r], [-r, -r], [r, r], [-r, r]]; q.forEach(([dx, dy], j) => f.set([m.x + dx!, m.y + dy!, m.z + 0.01, 30 / 255, 28 / 255, 26 / 255, m.a, 0], (i * 6 + j) * 8)); });
      gl.bindBuffer(gl.ARRAY_BUFFER, this.skidBuf); gl.bufferData(gl.ARRAY_BUFFER, f, gl.DYNAMIC_DRAW); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE, gl.NONE]);
      gl.uniform1f(this.loc(this.ground, 'uBias'), 0.00002); gl.bindVertexArray(this.skidVao); gl.drawArrays(gl.TRIANGLES, 0, S.length * 6); gl.disable(gl.BLEND); gl.depthMask(true); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]); }
    gl.useProgram(this.obj); gl.uniformMatrix4fv(this.loc(this.obj, 'uVP'), false, VP); gl.uniform1i(this.loc(this.obj, 'uLook'), o.look ?? 0); gl.uniform3fv(this.loc(this.obj, 'uEye'), eye); gl.uniform3fv(this.loc(this.obj, 'uSun'), SUN_W); gl.uniform1f(this.loc(this.obj, 'uGlass'), o.glass ?? 0.8); shadowTo(this.obj);
    gl.uniform1i(this.loc(this.obj, 'uDecTex'), 2);
    const artTo = (g: GpuMesh | null) => { const a = g && o.art !== false ? this.arts.get(g) : undefined; gl.uniform1i(this.loc(this.obj, 'uArtOn'), a ? 1 : 0); gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, a ? a.tex : this.blank); gl.uniform1i(this.loc(this.obj, 'uArt'), 6); gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, a ? a.lut : this.blank); gl.uniform1i(this.loc(this.obj, 'uArtLut'), 7); if (!a) return;
      gl.uniform1f(this.loc(this.obj, 'uArtMM'), a.mm); gl.uniform1f(this.loc(this.obj, 'uArtC'), a.C); gl.uniform4fv(this.loc(this.obj, 'uArtR'), a.rects); gl.uniform2fv(this.loc(this.obj, 'uArtO'), a.origins); };
    artTo(null);
    let id = 1; const objU = (outline: number) => { gl.uniform2f(this.loc(this.obj, 'uObj'), (id & 255) / 255, ((id >> 8) & 255) / 255); gl.uniform1f(this.loc(this.obj, 'uOutline'), outline); id++; };
    const draw = (part: { vao: WebGLVertexArrayObject; n: number }, M: M4, w?: WheelDraw) => { if (!part.n) return; gl.uniformMatrix4fv(this.loc(this.obj, 'uModel'), false, M); gl.uniform1i(this.loc(this.obj, 'uWheel'), w ? 1 : 0);
      if (!w) gl.uniform1f(this.loc(this.obj, 'uObjZ'), 0); if (w) { gl.uniform1f(this.loc(this.obj, 'uSpin'), w.spin); gl.uniform1f(this.loc(this.obj, 'uObjZ'), w.hubZ); gl.uniform1fv(this.loc(this.obj, 'uDef'), w.def); gl.uniform2f(this.loc(this.obj, 'uShift'), w.sx, w.sy); gl.uniform1f(this.loc(this.obj, 'uTyreR'), w.R); gl.uniform1f(this.loc(this.obj, 'uRim'), w.rim); } gl.bindVertexArray(part.vao); gl.drawArrays(gl.TRIANGLES, 0, part.n); };
    const decals = (g: GpuMesh | null) => { const n = g ? g.decals.length : 0; gl.uniform1i(this.loc(this.obj, 'uDecN'), n); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, n ? g!.decalTex : this.blank); if (!g || !n) return;
      gl.uniform3fv(this.loc(this.obj, 'uDecO'), g.decals.flatMap(d => d.o)); gl.uniform3fv(this.loc(this.obj, 'uDecN_'), g.decals.flatMap(d => { const l = Math.hypot(...d.n); return d.n.map(x => x / l); }));
      gl.uniform3fv(this.loc(this.obj, 'uDecUp'), g.decals.flatMap(d => { const l = Math.hypot(...d.up); return d.up.map(x => x / l); })); gl.uniform1fv(this.loc(this.obj, 'uDecR'), g.decals.map(d => d.r)); };
    gl.uniform1i(this.loc(this.obj, 'uMode'), 0); gl.uniform1f(this.loc(this.obj, 'uBias'), 0); decals(null);
    const outlineP = Math.max(1, Math.min(2, Math.round(2 * 50 / v.mm))), outlineC = Math.max(1, Math.min(3, Math.round(3 * 50 / v.mm)));
    gl.uniform3f(this.loc(this.obj, 'uWear'), 0, 0, 0); for (const p of ps) { objU(outlineP); draw(p.g.body, placeMesh(p.g.len, p.x, p.y, p.z, p.h)); }
    // the cars a thing hides: their light outline first, tested against what stands before them (each pixel once), then the cars over it
    gl.uniform1i(this.loc(this.obj, 'uMode'), 1); gl.depthFunc(gl.GREATER); gl.depthMask(false); gl.enable(gl.STENCIL_TEST); gl.stencilFunc(gl.EQUAL, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE, gl.NONE]); gl.uniform1f(this.loc(this.obj, 'uBias'), 0.25 / R);
    cars.forEach((q, i) => { gl.uniform4f(this.loc(this.obj, 'uSil'), 1, 226 / 255, 168 / 255, q.player ? 0.6 : 0.4); for (const [part, M, w] of carM[i]!.opaque) draw(part, M, w); });
    gl.disable(gl.STENCIL_TEST); gl.disable(gl.BLEND); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]); gl.uniform1f(this.loc(this.obj, 'uBias'), 0); gl.uniform1i(this.loc(this.obj, 'uMode'), 0);
    cars.forEach((q, i) => { objU(outlineC); const m = carM[i]!; gl.uniform3fv(this.loc(this.obj, 'uWear'), q.wear ?? [0, 0, 0]); gl.uniform1f(this.loc(this.obj, 'uCarH'), q.g.height); artTo(q.g); decals(q.g); draw(q.g.body, m.body); decals(null); for (const [part, M, w] of m.opaque.slice(1)) draw(part, M, w); });
    // glass over all, at its own strength, nothing else written
    gl.uniform1i(this.loc(this.obj, 'uMode'), 2); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE, gl.NONE]);
    gl.uniform3f(this.loc(this.obj, 'uWear'), 0, 0, 0); for (const p of ps) draw(p.g.glass, placeMesh(p.g.len, p.x, p.y, p.z, p.h)); for (const m of carM) for (const [part, M, w] of m.glass) draw(part, M, w);
    gl.disable(gl.BLEND); gl.depthMask(true);
    // ---- the outlines, onto the page's canvas ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, v.W, v.H); gl.disable(gl.DEPTH_TEST); gl.useProgram(this.post);
    [this.tCol, this.tId, this.tDepth].forEach((t, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(this.loc(this.post, ['uCol', 'uId', 'uDepth'][i]!), i); });
    gl.uniform1i(this.loc(this.post, 'uInner'), (o.look ?? 0) === 0 ? 1 : 0); gl.uniform1i(this.loc(this.post, 'uRays'), (o.look ?? 0) > 0 && o.rays !== false ? 1 : 0); gl.uniformMatrix4fv(this.loc(this.post, 'uVP'), false, VP); gl.uniform3fv(this.loc(this.post, 'uVd'), vd); gl.uniform3fv(this.loc(this.post, 'uSunD'), SUN_W);
    gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, this.tN); gl.uniform1i(this.loc(this.post, 'uN'), 8); gl.uniform1f(this.loc(this.post, 'uRange'), R);   /* PBR: no lines over the shading inside a thing, its outline only */ gl.uniform1f(this.loc(this.post, 'uStep'), (60 + 2 * v.mm / Math.tan(Math.max(5, v.pitch) * Math.PI / 180)) / 1000);
    gl.bindVertexArray(null); gl.drawArrays(gl.TRIANGLES, 0, 3); }

  /** a car's pieces with their matrices: the body on its springs (rolled and pitched about its middle), each wheel at its
   *  hub, turned on its axle and the front ones steered */
  private carParts(q: LiveCar): { body: M4; opaque: Piece[]; glass: Piece[] } {
    const g = q.g, base = placeMesh(g.len, q.x, q.y, q.z, q.yaw), mid = translate(g.len / 2, 0, 0), back = translate(-g.len / 2, 0, 0);
    const body = mul(base, mul(mid, mul(rot('x', q.roll), mul(rot('y', q.pitch), back))));
    const opaque: Piece[] = [[g.body, body]], glass: Piece[] = [[g.glass, body]];
    for (const w of g.wheels) { const left = w.hub[1] > 0, M = mul(body, mul(translate(w.hub[0], w.hub[1], w.hub[2]), w.front ? rot('z', -(left ? q.steerL : q.steerR)) : translate(0, 0, 0)));
      const ty = q.tyres?.[(w.front ? 0 : 2) + (left ? 0 : 1)], def = new Float32Array(32); if (ty) for (let k = 0; k < 32; k++) def[k] = ty.u[k]! * 1000;
      const wd: WheelDraw = { hubZ: w.hub[2], spin: q.spin, def, sx: (ty?.sx ?? 0) * 1000, sy: (ty?.sy ?? 0) * 1000, R: w.R, rim: w.rim };
      opaque.push([w.part, M, wd]); if (w.glass) glass.push([w.glass, M, wd]); }
    return { body, opaque, glass }; }
}
