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
export interface LiveCar { /** age: rust, fading, dirt (0..1) (review 104) */ wear?: [number, number, number]; /** FL FR RL RR */ tyres?: LiveTyre[]; g: GpuMesh; x: number; y: number; z: number; yaw: number; roll: number; pitch: number; /** each front wheel's own angle (rad, left +): the inner one more */ steerL: number; steerR: number; spin: number; player: boolean; /** head lamps alight 0..1, brakes on (review 117) */ lamps?: number; brake?: boolean; /** each wheel's rise against the body (m) and lean (rad, top to the left +): the suspension's travel (review 120) */ travel?: number[]; camber?: number[] }
export interface LiveProp { g: GpuMesh; x: number; y: number; z: number; h: number; /** its own placing (else by x, y, z, h), its outline's width, a name to follow it frame to frame (a moving piece) */ m?: M4; outline?: number; key?: string }
export interface Skid { x: number; y: number; z: number; a: number }

const SUN_W = (() => { const v = [-0.45, 0.35, 0.82], l = Math.hypot(...v); return v.map(c => c / l) as [number, number, number]; })();   // toward the sun, world axes: from the upper left of the default view
const LIGHT = `
const vec3 SUN_C = vec3(1.0, 0.95, 0.84), SKY_C = vec3(0.6, 0.68, 0.82), GROUND_C = vec3(0.5, 0.45, 0.36);
const vec3 ENV_TOP = vec3(150., 176., 214.) / 255., ENV_HOR = vec3(236., 233., 224.) / 255., ENV_GROUND = vec3(92., 88., 68.) / 255.;
vec3 envAt(float rz) { if (rz < -0.06) return ENV_GROUND; if (rz < 0.22) return ENV_HOR; float t = min(1., (rz - 0.22) / 0.6); return mix(ENV_HOR, ENV_TOP, t); }
uniform highp sampler2DShadow uShadow; uniform mat4 uLight;
uniform int uLook;   // 0: the baked pictures' stepped light; 1: physically based, its brightness stepped; 2: physically based, smooth
uniform float uTexK, uLightK, uSpecK;   // the strengths set on the page (review 109): textures, and the light (sun against sky, highlights, rays)
uniform float uDay;   // the time of day (review 117): 1 full day, toward 0 dusk then night (the sun lower, redder, dimmer; the sky darker)
#define SUN_E (mix(vec3(1.0, 0.52, 0.26), vec3(1.0, 0.95, 0.84), smoothstep(0.2, 0.8, uDay)) * 3.0 * uLightK * uDay * uDay)
vec3 toLin(vec3 c) { return pow(max(c, vec3(0.)), vec3(2.2)); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0., 1.); }
/* ---- the world as a mirror sees it (review 116), for the physically based looks: not a hard white band at the horizon
   but the fields below, a dark line of trees and stands along it, a hazy sky over it deepening upward, and clouds; all
   softened by roughness. Linear light. (The baked look keeps envAt.) ---- */
float hL(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.55); }
float vL(vec2 x) { vec2 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(mix(hL(i), hL(i + vec2(1, 0)), f.x), mix(hL(i + vec2(0, 1)), hL(i + vec2(1, 1)), f.x), f.y); }
uniform int uLmpN; uniform vec3 uLmpP[8], uLmpD[8];   // the head lamps alight (review 117): where, and the way they shine
/** the head lamps' light on a surface at p facing n: a beam a little below level, bright in its middle, spilling wider; by the square of the distance */
vec3 lampsAt(vec3 p, vec3 n) { vec3 s = vec3(0.); for (int i = 0; i < 8; i++) { if (i >= uLmpN) break; vec3 d = p - uLmpP[i]; float l = length(d); vec3 dl = d / max(l, 1e-3); float c = dot(dl, uLmpD[i]);
    float cone = smoothstep(0.94, 0.99, c) * 0.75 + smoothstep(0.72, 0.95, c) * 0.25; s += vec3(1., 0.86, 0.66) * 26. * cone * max(0., dot(n, -dl)) / (l * l + 0.6); } return s; }
uniform float uDeep;   // the colour's depth (review 116): 0 as before, 1 as set, 2 the most
vec3 skyR(vec3 r, float rough) { float z = r.z, soft = 0.02 + rough * 0.5;
  vec3 field = toLin(vec3(96., 104., 74.) / 255.), far = toLin(vec3(58., 66., 50.) / 255.), haze = toLin(vec3(222., 224., 220.) / 255.), top = toLin(vec3(120., 152., 200.) / 255.);
  vec3 sky = mix(haze, top, smoothstep(0.02, 0.7, z));
  float cl = vL(r.xy / (z + 0.12) * 1.7) * 0.6 + vL(r.xy / (z + 0.12) * 4.3 + 7.) * 0.4; cl = smoothstep(0.5, 0.78, cl) * smoothstep(0.03, 0.3, z) * (1. - smoothstep(0.05, 0.45, rough));
  sky = mix(sky, toLin(vec3(248., 246., 240.) / 255.) * 1.15, cl * 0.8);
  vec2 hd = r.xy / max(1e-3, length(r.xy)); float tree = 0.03 + 0.045 * vL(hd * 3.5 + 1.) + 0.025 * vL(hd * 14. + 5.);   /* the treeline's height, by bearing */
  vec3 low = mix(far, field, smoothstep(0., 0.35, -z));
  vec3 c = mix(low, sky, smoothstep(tree - soft, tree + soft, z));
  return (0.025 + 0.975 * uDay) * mix(vec3(0.75, 0.82, 1.), vec3(1.), uDay) * mix(c, mix(field, sky, smoothstep(-0.3, 0.5, z)), smoothstep(0.1, 0.6, rough)); }
vec3 irradiance(vec3 n) { return (0.025 + 0.975 * uDay) * (1.3 - 0.3 * uLightK) * mix(toLin(ENV_GROUND), toLin(mix(ENV_HOR, ENV_TOP, 0.55)), 0.5 + 0.5 * n.z); }
float D_GGX(float nh, float a) { float a2 = a * a, d = nh * nh * (a2 - 1.) + 1.; return a2 / (3.14159 * d * d); }
float V_Smith(float nv, float nl, float a) { float k = a * 0.5; return 0.25 / ((nv * (1. - k) + k) * (nl * (1. - k) + k)); }
vec2 envBRDF(float nv, float r) { vec4 rr = r * vec4(-1., -0.0275, -0.572, 0.022) + vec4(1., 0.0425, 1.04, -0.04); float a = min(rr.x * rr.x, exp2(-9.28 * nv)) * rr.x + rr.y; return vec2(-1.04, 1.04) * a + rr.zw; }
/** metallic-roughness shading (GGX, Smith, Schlick; the sky as an analytic light: its irradiance, and its reflection blurred by roughness), a clear coat for paint */
vec3 pbrX(vec3 baseSrgb, vec3 n, vec3 v, vec3 l, float sh, float metal, float rough, float coat, float ao, float sheen);
vec3 pbr(vec3 baseSrgb, vec3 n, vec3 v, vec3 l, float sh, float metal, float rough, float coat) { return pbrX(baseSrgb, n, v, l, sh, metal, rough, coat, 1., 0.); }
/** with the sky's light cut by occlusion (ao) and a soft sheen at grazing angles (cloth's fuzz, leather's and rubber's polish) */
vec3 pbrX(vec3 baseSrgb, vec3 n, vec3 v, vec3 l, float sh, float metal, float rough, float coat, float ao, float sheen) {
  vec3 alb = toLin(baseSrgb); float a = max(0.02, rough * rough); vec3 h = normalize(l + v);
  float nl = max(0., dot(n, l)), nv = max(1e-3, dot(n, v)), nh = max(0., dot(n, h)), vh = max(0., dot(v, h));
  /* the lacquer's depth (review 116): light crosses the clear coat and the pigment twice, longer the more glancing the
     view, so the colour deepens and saturates toward the edges, and the dull sky light it scatters is less */
  float deep = coat > 0. && metal < 0.5 ? uDeep * coat : 0.; alb = pow(alb, vec3(1. + deep * (0.3 + 1.2 * (1. - nv) * (1. - nv))));
  vec3 f0 = mix(vec3(0.04), alb, metal), F = f0 + (1. - f0) * pow(1. - vh, 5.), kd = (1. - F) * (1. - metal);
  vec3 col = (kd * alb / 3.14159 + D_GGX(nh, a) * V_Smith(nv, nl, a) * F * uSpecK) * SUN_E * nl * sh;
  vec3 r = reflect(-v, n); vec2 ab = envBRDF(nv, rough); vec3 envS = mix(skyR(r, rough), irradiance(r), clamp(rough * 1.4 - 0.3, 0., 1.));
  col += (kd * alb * irradiance(n) * (1. - 0.35 * deep) + envS * (f0 * ab.x + ab.y)) * ao;
  if (sheen > 0.) col += sheen * pow(1. - nv, 4.) * (alb * 0.6 + 0.4) * (irradiance(n) * ao + SUN_E * nl * sh * 0.25);
  if (coat > 0.) { float Fc = (0.04 + 0.96 * pow(1. - nv, 5.)) * coat; col = col * (1. - Fc) + skyR(r, 0.03) * Fc * (0.6 + 0.4 * uSpecK) * mix(1., ao, 0.7)
      + (D_GGX(nh, 0.06) * V_Smith(nv, nl, 0.06) * 0.06 + D_GGX(nh, 0.32) * V_Smith(nv, nl, 0.32) * 0.05) * coat * uSpecK * SUN_E * nl * sh; }   /* the lacquer: a sharp glint and a broad sheen (review 111) */
  return col; }
// ---- PBR detail textures (review 103): seven layers (concrete, grass, metal, rubber, leather, canvas, wood), each a
// tile of known size; the albedo used for its light and dark only (the game keeps its colours), roughness and normals ----
uniform highp sampler2DArray uAlb, uNor, uRgh, uHiAlb, uHiNor; uniform int uTex, uHi; uniform int uHiIdx[7]; uniform float uTSize[7], uTLuma[7], uTRough[7];   /* uHi: the high-resolution layers (2K/4K) for some materials (review 114) */
struct Detail { float tone; float rough; vec3 n; };
/** a layer laid three ways (by the normal's main axes) at point p (m), on normal n: its tone, roughness offset, bent normal */
Detail detail(int L, vec3 p, vec3 n, float sa, float sn, float sr) { sa = max(sa, 0.12 * (uTexK - 1.)) * uTexK; sn *= uTexK; sr *= uTexK; Detail d; d.tone = 1.; d.rough = 0.; d.n = n; if (uTex == 0 || L < 0) return d;
  vec3 q = p / uTSize[L], w = pow(abs(n), vec3(4.)); w /= (w.x + w.y + w.z); float fl = float(L);
  vec3 ax = vec3(q.zy, fl), ay = vec3(q.xz, fl), az = vec3(q.xy, fl);
  vec3 a = texture(uAlb, ax).rgb * w.x + texture(uAlb, ay).rgb * w.y + texture(uAlb, az).rgb * w.z;
  int hi = uHi == 1 ? uHiIdx[L] : -1; vec3 hx = vec3(q.zy, float(hi)), hy = vec3(q.xz, float(hi)), hz = vec3(q.xy, float(hi));
  if (hi >= 0) a = texture(uHiAlb, hx).rgb * w.x + texture(uHiAlb, hy).rgb * w.y + texture(uHiAlb, hz).rgb * w.z;
  float r = texture(uRgh, ax).r * w.x + texture(uRgh, ay).r * w.y + texture(uRgh, az).r * w.z;
  vec3 tx = (hi >= 0 ? texture(uHiNor, hx) : texture(uNor, ax)).xyz * 2. - 1., ty = (hi >= 0 ? texture(uHiNor, hy) : texture(uNor, ay)).xyz * 2. - 1., tz = (hi >= 0 ? texture(uHiNor, hz) : texture(uNor, az)).xyz * 2. - 1.;
  vec3 bend = vec3(0., tx.y, tx.x) * w.x + vec3(ty.x, 0., ty.y) * w.y + vec3(tz.xy, 0.) * w.z;
  d.tone = clamp(mix(1., dot(a, vec3(0.3, 0.59, 0.11)) / uTLuma[L], sa), 0.2, 2.2); d.rough = (r - uTRough[L]) * sr; d.n = normalize(n + bend * sn); return d; }
/** the linear colour to the screen: exposure, filmic curve, gamma; stepped in brightness for the stepped look */
uniform int uHDRo;   /* 1: write the light as it is (a wide range: highlights far above white, for the bloom), tone-mapped at the end */
vec3 present(vec3 c) { if (uHDRo == 1) return min(c * 0.6, vec3(48.)); vec3 s = pow(aces(c * 0.6), vec3(1. / 2.2));   /* exposure set so the concrete reads as bright as in the baked look */ if (uLook == 1) { float L = dot(s, vec3(0.3, 0.59, 0.11)), q = floor(L * 7. + 0.5) / 7.; s *= q / max(L, 1e-3); } return min(s, vec3(1.)); }
// ---- occlusion by rays against the cars' boxes (review 112): each car a box (body over its wheels); eight rays over the
//      surface traced against them exactly, so a car darkens the road under it and its neighbour's flank, wherever the
//      picture's own layers cannot see ----
uniform int uBoxN, uSelf; uniform vec3 uBoxC[6], uBoxE[6]; uniform vec2 uBoxR[6];
float rayBox(vec3 o, vec3 d, int i) { vec2 cs = uBoxR[i]; vec3 r = o - uBoxC[i]; vec3 lo = vec3(dot(r.xy, cs), dot(r.xy, vec2(-cs.y, cs.x)), r.z), ld = vec3(dot(d.xy, cs), dot(d.xy, vec2(-cs.y, cs.x)), d.z);
  vec3 inv = 1. / (ld + vec3(1e-6)), t0 = (-uBoxE[i] - lo) * inv, t1 = (uBoxE[i] - lo) * inv, tn = min(t0, t1), tf = max(t0, t1);
  float a = max(max(tn.x, tn.y), tn.z), b = min(min(tf.x, tf.y), tf.z); return b >= max(a, 0.) ? max(a, 0.) : -1.; }
float rtao(vec3 p, vec3 n) { if (uBoxN == 0) return 1.; vec3 t1 = normalize(abs(n.z) < 0.9 ? cross(n, vec3(0., 0., 1.)) : cross(n, vec3(1., 0., 0.))), t2 = cross(n, t1); float occ = 0.;
  for (int k = 0; k < 8; k++) { float a = float(k) * 2.39996 + 0.3, u = (float(k) + 0.5) / 8., st = sqrt(1. - u); vec3 d = (t1 * cos(a) + t2 * sin(a)) * sqrt(u) + n * st;   // cosine-weighted
    for (int i = 0; i < 6; i++) { if (i >= uBoxN) break; if (i == uSelf) continue; float t = rayBox(p + n * 0.03, d, i); if (t >= 0. && t < 2.5) { occ += 1. - t / 2.5; break; } } }
  return 1. - min(1., occ / 8. * 1.4) * 0.85; }
float lightAt(vec3 w) { vec4 l = uLight * vec4(w, 1.); vec3 q = l.xyz * 0.5 + 0.5; if (q.x <= 0. || q.y <= 0. || q.x >= 1. || q.y >= 1. || q.z >= 1.) return 1.; float t = 0., px = 1.6 / float(textureSize(uShadow, 0).x); for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) t += texture(uShadow, vec3(q.xy + vec2(i, j) * px, q.z - 0.0015)); return t / 9.; }   /* soft edges: nine filtered looks (review 111) */
`;
const OBJ_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec3 aCol; layout(location=3) in float aGloss; layout(location=4) in float aKind; layout(location=5) in float aPart; layout(location=6) in vec3 aSmo; layout(location=7) in vec4 aLamp; layout(location=8) in vec3 aLAx; layout(location=9) in vec3 aLRt; out vec4 vLamp; flat out vec3 vLAx, vLRt, vLUp;
uniform mat4 uVP, uModel, uPrevVP, uPrevModel; uniform float uBias; out vec3 vSN;   // the smoothed normal (review 116; none where a piece has no such layer)
out vec4 vCur, vPrev;   // where this point is now and was a frame ago (the velocity layer, review 112)
uniform int uWheel; uniform float uSpin, uDef[32], uTyreR, uRim; uniform vec2 uShift;
out vec3 vWorld, vObj; flat out vec3 vN, vObjN, vCol; flat out float vGloss, vKind, vPart;
void main() { vec3 p = aPos, nr = aNor, ns = dot(aSmo, aSmo) > 0.25 ? aSmo : aNor;
  if (uWheel == 1) {
    if (int(aKind + 0.5) == 5) {   // the tyre, shaped by its ring in the hub's frame (the ring keeps to the road; it does not turn with the wheel)
      float rho = length(p.xz), t = clamp((rho - uRim) / max(1., uTyreR - uRim), 0., 1.), a = atan(-p.x, -p.z);
      float fi = mod(a / 6.2831853 * 32. + 32., 32.); int i0 = int(floor(fi)); float d = mix(uDef[i0], uDef[(i0 + 1) % 32], fract(fi)) * t;
      vec2 dir = p.xz / max(rho, 1.); float low = max(0., dir.y * -1.); low *= low;
      p.xz -= dir * d; p.y += sign(p.y) * d * 0.5 * (1. - abs(2. * t - 1.));   // the tread pressed in, the walls bulging out beside it
      p.y += uShift.y * t * low; p.x -= uShift.x * t * low; }   // the patch pulled across and along by the forces
    else { float c = cos(uSpin), s = sin(uSpin); p = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z); nr = vec3(c * nr.x - s * nr.z, nr.y, s * nr.x + c * nr.z); ns = vec3(c * ns.x - s * ns.z, ns.y, s * ns.x + c * ns.z); } }
  vec4 w = uModel * vec4(p, 1.); vWorld = w.xyz; vObj = p; vObjN = nr; vN = normalize(mat3(uModel) * nr); vSN = mat3(uModel) * ns; vLamp = aLamp; vLAx = normalize(mat3(uModel) * aLAx + 1e-9); vLRt = normalize(mat3(uModel) * aLRt + 1e-9); vLUp = normalize(mat3(uModel) * cross(aLAx, aLRt) + 1e-9); vCol = aCol; vGloss = aGloss; vKind = aKind; vPart = aPart;
  gl_Position = uVP * w; vCur = gl_Position; vPrev = uPrevVP * (uPrevModel * vec4(p, 1.)); gl_Position.z -= uBias; }`;
const OBJ_FS = `#version 300 es
precision highp float;
${LIGHT}
in vec3 vWorld, vObj, vSN; in vec4 vLamp; flat in vec3 vLAx, vLRt, vLUp; flat in vec3 vN, vObjN, vCol; flat in float vGloss, vKind, vPart;
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
float vn3(vec3 x) { return vnoise(x); }
float fbm(vec3 p) { float a = 0.5, s = 0.; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s / 0.9375; }
vec3 rustAt(float t) { vec3 R[6] = vec3[6](vec3(184, 104, 46), vec3(156, 80, 34), vec3(126, 60, 26), vec3(92, 42, 20), vec3(60, 30, 16), vec3(40, 21, 12)); float k = clamp(t, 0., 1.) * 4.999; int i = int(k); return mix(R[i], R[min(5, i + 1)], fract(k)) / 255.; } uniform float uOutline; uniform int uMode; uniform vec4 uSil; uniform float uGlass;
uniform int uDecN; uniform vec3 uDecO[4], uDecN_[4], uDecUp[4]; uniform float uDecR[4]; uniform sampler2D uDecTex;
layout(location=0) out vec4 oCol; layout(location=1) out vec4 oId; layout(location=2) out vec4 oN; layout(location=3) out vec4 oV; in vec4 vCur, vPrev; uniform vec2 uSize;
vec4 velo() { vec2 d = (vCur.xy / vCur.w - vPrev.xy / vPrev.w) * 0.5 * uSize; return vec4(clamp(d / 128. + 0.5, 0., 1.), 0., 1.); }   /* pixels moved since the last frame, packed */   // oN: the normal and how mirror-like (for the traced reflections)
uniform float uLampOn, uBrake;   // this car's lamps alight, its brakes on (review 117)
/* ---- a lamp seen through its glass (review 117): what a real head lamp shows, drawn at its depth on the lamp's face.
   uv: across the face to its rim; A, Rt, Up: its axis and face; nG: the glass's (domed) normal. Behind the glass a
   parabolic bowl, silvered, deepest in the middle (the view through it shifts with the angle: parallax); the bulb and
   its socket standing in it; the bezel's shadow in the bowl where the sun is cut off; the glass's inner face fluted
   upright above, cut in prism blocks below, a ring at the rim, each bending the view a little and edged with a fine dark
   line; the outer face smooth, mirroring the world by Fresnel, the sun a hard glint. Alight: the filament white hot, the
   bowl filled with light, the flutes drawing it into upright streaks. Tail lamps the same behind red glass. ---- */
vec3 lampFace(vec2 uv, float flag, vec3 A, vec3 Rt, vec3 Up, vec3 nG, float sh) {
  float r = length(uv), D = 0.45; vec3 E = uEye; float vn = max(0.45, dot(E, A)); vec2 vt = vec2(dot(E, Rt), dot(E, Up)) / vn;
  float px = fwidth(uv.x) + fwidth(uv.y), keep = clamp(1.5 - px * 9., 0., 1.);   /* the fine work faded where it is finer than a pixel */
  float fx = uv.x * 11., fl = fract(fx) - 0.5; vec2 bend = vec2(fl * 0.12, 0.); float line = smoothstep(0.38, 0.5, abs(fl));
  if (uv.y < -0.2) { vec2 c = vec2(uv.x * 6., (uv.y + 0.2) * 7.), f = fract(c) - 0.5; bend = f * vec2(0.14, 0.12); line = max(smoothstep(0.4, 0.5, abs(f.x)), smoothstep(0.4, 0.5, abs(f.y))); }
  float ring = smoothstep(0.8, 0.83, r) * (1. - smoothstep(0.9, 0.93, r)); bend -= uv / max(r, 1e-3) * ring * 0.07; line = max(line, smoothstep(0.02, 0., abs(r - 0.815)) + smoothstep(0.02, 0., abs(r - 0.915)));
  bend *= keep; line *= keep * 0.35;
  vec2 q = uv + bend, p = q; for (int i = 0; i < 3; i++) p = q - vt * D * (1. - min(1., dot(p, p))); if (length(p) > 0.97) p *= 0.97 / length(p);   /* past the rim: the bowl's wall by the bezel */   /* where the eye's ray meets the bowl */
  float pr = length(p), h = D * (1. - min(1., pr * pr)); vec3 nb = normalize(A - (Rt * p.x + Up * p.y) * 2. * D);
  vec2 sv = vec2(dot(uSun, Rt), dot(uSun, Up)) / max(0.08, dot(uSun, A)); float inSun = dot(uSun, A) > 0. ? 1. - smoothstep(0.92, 1.04, length(p + sv * h)) : 0.;
  float ao = 0.55 + 0.45 * min(1., pr * pr);
  vec3 rr = reflect(-E, nb), hh = normalize(uSun + E);
  vec3 bowl = (skyR(rr, 0.08) * 0.75 + irradiance(A) * 0.9) * vec3(0.9, 0.9, 0.88) * ao * mix(0.6, 1., inSun * sh) + SUN_E * D_GGX(max(0., dot(nb, hh)), 0.05) * 0.05 * inSun * sh;   /* the bowl mirrors the world and, many times over, its own bright inside */
  bowl *= 0.94 + 0.06 * sin(pr * 48.);   /* the spinning's faint rings */
  vec2 sk = q - vt * D; float ds = length(sk); if (ds < 0.24 && ds > 0.11) bowl = mix(bowl, vec3(0.025, 0.024, 0.022), smoothstep(0.24, 0.2, ds));   /* the socket */
  vec2 pb = q - vt * D * 0.4; float db = length(pb) / 0.12; float glow = flag < 1.5 ? uLampOn : max(uLampOn * 0.35, uBrake);
  if (db < 1.) { vec3 ns = normalize(A * sqrt(1. - db * db) + (Rt * pb.x + Up * pb.y) / 0.12); bowl = mix(vec3(0.7, 0.68, 0.62) * (0.4 + 0.6 * max(0., dot(ns, uSun)) * sh), skyR(reflect(-E, ns), 0.02), 0.35) + vec3(1., 0.85, 0.6) * 40. * glow * (1. - db * db); }   /* the bulb */
  vec3 lit = flag < 1.5 ? vec3(1., 0.88, 0.7) : vec3(1., 0.12, 0.06);
  bowl += lit * glow * (flag < 1.5 ? 1.6 : 1.2) * (0.45 + 0.55 * pr) * (0.35 + 1.3 * pow(abs(sin(fx * 3.14159)), 3.) * keep + (1. - keep) * 0.5) * pow(vn, 0.7);   /* the bowl full of light, drawn into upright streaks by the flutes */
  vec3 col = bowl * (1. - line) * (flag < 1.5 ? vec3(0.95, 0.97, 1.) : vec3(0.85, 0.05, 0.035) + lit * glow * 2.);
  vec3 ng = normalize(nG); float nv = max(0., dot(ng, E)), F = 0.04 + 0.96 * pow(1. - nv, 5.);
  return col * (1. - F) + skyR(reflect(-E, ng), 0.01) * F * (0.8 + 0.2 * uSpecK) + SUN_E * D_GGX(max(0., dot(ng, hh)), 0.012) * 0.25 * F * max(0., dot(ng, uSun)) * sh * uSpecK; }
void main() {
  if (uMode == 1) { oCol = uSil; oId = vec4(0.); oN = vec4(0.); oV = velo(); return; }
  vec3 n = vN; if (dot(n, uEye) < 0.) n = -n;
  vec3 base = vCol; int kind = int(vKind + 0.5);
  float sh = lightAt(vWorld);
  float d = max(0., dot(n, uSun)) * sh, up = 0.5 + 0.5 * n.z;
  float ne = dot(n, uEye), rz = 2. * ne * n.z - uEye.z;
  if (uMode == 2) {   // glass: mirrors more at a glancing angle, laid over at its own strength
    if (uLook > 0 && kind == 4) discard;   /* the painted glints the baked pictures put on windows: the glass now mirrors the world itself (review 118) */
    if (uLook > 0 && vLamp.z > 0.5) { vec3 ns = normalize(vSN); if (dot(ns, n) < 0.) ns = -ns; oCol = vec4(present(lampFace(vLamp.xy, vLamp.z, vLAx, vLRt, vLUp, ns, sh)), 1.); oId = vec4(0.); oN = vec4(0.); oV = velo(); return; }   /* a lamp's glass: the lamp drawn on it (review 117) */
    if (uLook > 0) {   /* review 116: glass as glass. Nearly black in itself, a little green toward its edge (seen through its
         thickness); what lies behind shows through; the world mirrored by Fresnel off the smoothed surface (no white band,
         no facets); the sun a hard glint; a faint film of dust dulling the mirror in patches */
      vec3 ns = normalize(vSN); if (dot(ns, n) < 0.) ns = -ns; if (dot(ns, uEye) < 0.02) ns = n;
      float nv = max(0., dot(ns, uEye)), F = 0.04 + 0.96 * pow(1. - nv, 5.), edge = (1. - nv) * (1. - nv);
      vec3 P = vObj / 1000.; float dust = smoothstep(0.45, 0.85, fbm(P * 7.) * 0.7 + fbm(P * 40.) * 0.3) * 0.6;
      vec3 r = reflect(-uEye, ns), hg = normalize(uSun + uEye);
      vec3 mir = mix(skyR(r, 0.015), skyR(r, 0.35), dust) * (0.75 + 0.25 * uSpecK);
      float glint = D_GGX(max(0., dot(ns, hg)), mix(0.012, 0.06, dust)) * 0.25 * max(0., dot(ns, uSun)) * sh * uSpecK;
      vec3 tint = kind == 4 ? toLin(base) * 0.5 : mix(vec3(0.012, 0.014, 0.014), vec3(0.03, 0.06, 0.045), edge) + toLin(vec3(0.55, 0.52, 0.46)) * dust * 0.08 * (0.4 + 0.6 * sh);
      float absorb = kind == 4 ? 0.55 : uGlass * (0.3 + 0.4 * edge) + dust * 0.1;
      vec3 rgb = (mir + SUN_E * glint) * F + tint * (1. - F); float A = clamp(F + absorb * (1. - F), 0., 1.);
      oCol = vec4(present(rgb / max(A, 1e-3)) * A, A); oId = vec4(0.); oN = vec4(0.); oV = velo(); return; }
    float F = 0.06 + 0.94 * pow(1. - abs(ne), 4.); vec3 env = envAt(rz), tint = kind == 4 ? base : vec3(150., 172., 182.) / 255.;
    float k = 0.62 + 0.45 * d + (n.z > 0.3 ? 0.1 : 0.); vec3 c = tint * (1. - 0.55 * (0.4 + F)) + env / k * 0.55 * (0.4 + F);
    vec3 hg = normalize(uSun + uEye); float glint = D_GGX(max(0., dot(n, hg)), 0.03) * 0.04 * max(0., dot(n, uSun)) * sh * uSpecK;   /* the sun caught in the glass */
    float gA = min(1., (kind == 4 ? uGlass + 0.15 : uGlass) + (1. - uGlass) * F * 0.7); oCol = vec4((uHDRo == 1 ? toLin(min(vec3(1.), c * k)) * (1. + 2.5 * F) + SUN_E * glint * 0.6 : min(vec3(1.), c * k)) * gA, gA);   /* premultiplied */ oId = vec4(0.); oN = vec4(0.); oV = velo(); return; }
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
    { vec3 ns = normalize(vSN); if (dot(ns, n) < 0.) ns = -ns; if (dot(ns, uEye) > 0.02) nw = normalize(ns + nw - n); }   /* the smoothed surface, the detail's bend kept (review 116) */
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
    // each material's own (review 112): chrome nearly a mirror, the lacquer's faint orange peel, leather polished, cloth fuzzy, rubber's dull sheen, varnished wood
    float sheen = 0.; if (metal > 0.5 && vGloss > 0.7) rough = min(rough, 0.07);
    if (kind == 1) { vec3 q = vObj / 1000. * 45.; nw = normalize(nw + (vec3(vn3(q), vn3(q + 7.1), 0.) - 0.5) * 0.05); }
    else if (kind == 8) { sheen = 0.35; coat = max(coat, 0.15); } else if (kind == 7) { sheen = 0.6; rough = 0.95; } else if (kind == 5) { sheen = 0.18; } else if (kind == 6) coat = max(coat, 0.55); else if (kind == 9) { coat = 1.; rough = 0.05; }
    float ao = rtao(vWorld, nw);
    vec3 lit = pbrX(base, nw, uEye, uSun, sh, metal, rough, coat, ao, sheen);
    if (kind == 9 && vLamp.z > 0.5) { vec3 ns = normalize(vSN); if (dot(ns, n) < 0.) ns = -ns; lit = lampFace(vLamp.xy, vLamp.z, vLAx, vLRt, vLUp, ns, sh); }   /* a lamp's lens: the lamp drawn on it (review 117) */
    else lit += lampsAt(vWorld, nw) * toLin(base) * (1. - metal) / 3.14159;   /* the head lamps' light */
    oCol = vec4(present(lit), 1.); oId = vec4(uObj, vPart / 255., uOutline / 8.); oN = vec4(nw * 0.5 + 0.5, metal > 0.5 ? 1. - rough : coat * (1. - rough) * 0.5); oV = velo(); return; }
  float dq = floor(d * 4. + 0.5) / 4.;
  vec3 diff = SUN_C * dq * 0.78 + (SKY_C * up + GROUND_C * (1. - up)) * 0.6, c;
  vec3 env = envAt(rz);
  if (vGloss > 0.7) { float tint = 0.55 + 0.45 * max(base.r, max(base.g, base.b)); c = min(vec3(1.), env * 0.82 * (base * 0.5 + 0.5) * tint + base * diff * 0.15); }
  else { vec3 h = normalize(uSun + uEye); float nh = max(0., dot(n, h)), g = vGloss, sp = g > 0.2 ? pow(nh, 6. + g * 110.) : 0., spec = (sp > 0.65 ? 1. : sp > 0.3 ? 0.5 : 0.) * sh;
    float refl = g > 0.3 ? 0.1 * g * (0.4 + 0.6 * up) : 0.; c = min(vec3(1.), base * diff * (1. - refl) + env * refl) + spec * (40. + 80. * g) / 255. * vec3(1., 0.97, 0.9); }
  oCol = vec4(min(c, vec3(1.)), 1.); oId = vec4(uObj, vPart / 255., uOutline / 8.); oN = vec4(n * 0.5 + 0.5, 0.); oV = velo(); }`;
const GROUND_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec4 aCol; layout(location=2) in float aFlag;
uniform mat4 uVP, uPrevVP; uniform float uBias; out vec3 vWorld; out vec4 vCol; flat out float vFlag; out vec4 vCur, vPrev;
void main() { vWorld = aPos; vCol = aCol; vFlag = aFlag; gl_Position = uVP * vec4(aPos, 1.); vCur = gl_Position; vPrev = uPrevVP * vec4(aPos, 1.); gl_Position.z -= uBias; }`;
const GROUND_FS = `#version 300 es
precision highp float;
${LIGHT}
in vec3 vWorld; in vec4 vCol; flat in float vFlag; uniform float uCell; uniform vec3 uSun, uEye;
layout(location=0) out vec4 oCol; layout(location=1) out vec4 oId; layout(location=2) out vec4 oN; layout(location=3) out vec4 oV; in vec4 vCur, vPrev; uniform vec2 uSize;
vec4 velo() { vec2 d = (vCur.xy / vCur.w - vPrev.xy / vPrev.w) * 0.5 * uSize; return vec4(clamp(d / 128. + 0.5, 0., 1.), 0., 1.); }   /* pixels moved since the last frame, packed */   // oN: the normal and how mirror-like (for the traced reflections)
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() { vec3 c = vCol.rgb;
  if (vFlag > 0.5 && uLook == 0) { vec2 cell = floor(vWorld.xy / vec2(uCell * 2., uCell)); float h = hash(cell); if (h > 0.955) c = vec3(107., 130., 83.) / 255.; else if (h > 0.91) c = vec3(83., 104., 63.) / 255.; }
  if (uLook > 0) { vec3 nn = normalize(cross(dFdx(vWorld), dFdy(vWorld))); if (nn.z < 0.) nn = -nn; float sh = lightAt(vWorld + vec3(0., 0., 0.02));   // the ground as a rough, dull surface
    Detail dt = detail(vFlag > 0.5 ? 1 : 0, vWorld, nn, vFlag > 0.5 ? 0.8 : 0.7, 0.6, 0.4);
    oCol = vec4(present(pbrX(c * dt.tone, dt.n, uEye, uSun, sh, 0., clamp(0.92 + dt.rough, 0.3, 1.), 0., rtao(vWorld, dt.n), 0.) + lampsAt(vWorld, dt.n) * toLin(c * dt.tone) / 3.14159), vCol.a); oId = vec4(0.); oN = vec4(dt.n * 0.5 + 0.5, 0.); oV = velo(); return; }
  c = mix(c, vec3(24., 22., 20.) / 255., (1. - lightAt(vWorld + vec3(0., 0., 0.02))) * 0.43);
  oCol = vec4(c, vCol.a); oId = vec4(0.); oN = vec4(0.5, 0.5, 1., 0.); oV = velo(); }`;
const DEPTH_VS = `#version 300 es
layout(location=0) in vec3 aPos; uniform mat4 uVP, uModel; void main() { gl_Position = uVP * uModel * vec4(aPos, 1.); }`;
const DEPTH_FS = `#version 300 es
precision mediump float; out vec4 o; void main() { o = vec4(1.); }`;
const POST_VS = `#version 300 es
out vec2 vUv; void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUv = p; gl_Position = vec4(p * 2. - 1., 0., 1.); }`;
const POST_FS = `#version 300 es
precision highp float;
uniform sampler2D uCol, uId, uDepth, uN, uAO; uniform float uRange, uStep, uAOK, uReflK; uniform int uInner, uRays; uniform float uRayK, uOutW, uOutK, uInK;   /* the outline: its width (times the thing's own), how dark; the lines inside, how dark */ uniform mat4 uVP; uniform vec3 uVd, uSunD; in vec2 vUv; out vec4 o;
float obj(vec4 id) { return floor(id.r * 255. + 0.5) + floor(id.g * 255. + 0.5) * 256.; }
// ---- rays in the picture (review 106, brief 75 §1): a world direction as a step across the picture (pixels a metre)
//      and in the depth layer (its units a metre); the camera being orthographic, the same everywhere ----
vec3 toScreen(vec3 d) { vec4 c = uVP * vec4(d, 0.); vec2 sz = vec2(textureSize(uCol, 0)); return vec3(c.x * sz.x * 0.5, c.y * sz.y * 0.5, c.z * 0.5); }
float hsh(vec2 q) { return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }
void main() { ivec2 p = ivec2(gl_FragCoord.xy), sz = textureSize(uCol, 0); vec4 c = texelFetch(uCol, p, 0), id = texelFetch(uId, p, 0); float me = obj(id);
  float d0 = texelFetch(uDepth, p, 0).r; vec4 G = texelFetch(uN, p, 0); 
  if (uRays == 1 && d0 < 0.9999) { vec3 n = normalize(G.xyz * 2. - 1.); float M = 0.5 / uRange;   // M: a metre in the depth layer
    // occlusion and contact shadow, from their own layer, smoothed over 4 x 4 where the depth agrees (no pattern, no halo)
    vec2 aoS = vec2(0.); float aw = 0.; for (int i = -2; i <= 1; i++) for (int j = -2; j <= 1; j++) { ivec2 q = clamp(p + ivec2(i, j), ivec2(0), sz - 1); float w = exp(-abs(texelFetch(uDepth, q, 0).r - d0) / (0.15 * M)); aoS += texelFetch(uAO, q, 0).rg * w; aw += w; }
    aoS /= max(aw, 1e-4); c.rgb *= mix(1., aoS.r, uAOK) * mix(1., aoS.g, min(1., uRayK));
    // reflections: the eye's ray bounced off a mirror-like surface, marched across the picture until it passes behind something
    if (G.a > 0.04) { vec3 r = reflect(uVd, n), st = toScreen(r); float L = length(st.xy);
      if (L > 0.5) { float stepM = 1.2 / L; for (int k = 1; k <= 56; k++) { float t = float(k) * stepM; vec2 qf = vec2(p) + st.xy * t; ivec2 q = ivec2(qf);
          if (q.x < 0 || q.y < 0 || q.x >= sz.x || q.y >= sz.y) break; float rd = d0 + st.z * t, sd = texelFetch(uDepth, q, 0).r;
          if (rd > sd + 0.03 * M && rd - sd < 0.6 * M + abs(st.z) * stepM) { vec3 hc = (texelFetch(uCol, q, 0).rgb * 2. + texelFetch(uCol, clamp(q + ivec2(1, 0), ivec2(0), sz - 1), 0).rgb + texelFetch(uCol, clamp(q - ivec2(0, 1), ivec2(0), sz - 1), 0).rgb) / 4.; vec2 e = min(qf, vec2(sz) - qf) / vec2(sz) * 8.;
            float fade = clamp(min(e.x, e.y), 0., 1.) * (1. - float(k) / 56.); float F = G.a * (0.5 + 0.5 * pow(1. - max(0., dot(-uVd, n)), 3.)); c.rgb = mix(c.rgb, hc, clamp(F * fade * uRayK * uReflK, 0., 0.97)); break; } } } } }
  if (me > 0.) { float dp = texelFetch(uDepth, p, 0).r * 2. * uRange; int w = int(floor(floor(id.a * 8. + 0.5) * uOutW + 0.5)); float k = 1., ko = 1. - 0.8 * uOutK, ki = 1. - 0.5 * uInK;
    ivec2 dirs[4] = ivec2[4](ivec2(1, 0), ivec2(-1, 0), ivec2(0, 1), ivec2(0, -1));
    for (int s = 1; s <= 6; s++) { if (s > max(w, uInner)) break; for (int j = 0; j < 4; j++) { ivec2 q = p + dirs[j] * s; if (q.x < 0 || q.y < 0 || q.x >= sz.x || q.y >= sz.y) { if (s <= w) k = ko; continue; }
      vec4 iq = texelFetch(uId, q, 0); float oq = obj(iq), dq = texelFetch(uDepth, q, 0).r * 2. * uRange;
      if (s <= w && oq != me && (oq == 0. || dq > dp)) k = min(k, ko);
      else if (uInner == 1 && s == 1 && oq == me && k > ki && ((abs(iq.b - id.b) > 0.001 && dp - dq > 0.004) || dp - dq > uStep)) k = min(k, ki); } }
    c.rgb *= k; }
  o = vec4(c.rgb, 1.); }`;

// ---- the occlusion layer (review 111): twelve short rays over each surface against the depth layer; and a short ray to
//      the sun for the contact shadow. r: how much sky reaches, g: the contact shadow ----
const AO_FS = `#version 300 es
precision highp float;
uniform sampler2D uDepth, uN; uniform mat4 uVP; uniform vec3 uSunD; uniform float uRange; out vec4 o;
vec3 toScreen(vec3 d) { vec4 c = uVP * vec4(d, 0.); vec2 sz = vec2(textureSize(uDepth, 0)); return vec3(c.x * sz.x * 0.5, c.y * sz.y * 0.5, c.z * 0.5); }
void main() { ivec2 p = ivec2(gl_FragCoord.xy), sz = textureSize(uDepth, 0); float d0 = texelFetch(uDepth, p, 0).r; if (d0 > 0.9999) { o = vec4(1.); return; }
  vec3 n = normalize(texelFetch(uN, p, 0).xyz * 2. - 1.); float M = 0.5 / uRange, occ = 0.; int bx = (p.x & 3) + (p.y & 3) * 4; float rot = float((bx * 7) % 16) / 16. * 6.2831;
  vec3 t1 = normalize(abs(n.z) < 0.9 ? cross(n, vec3(0., 0., 1.)) : cross(n, vec3(1., 0., 0.))), t2 = cross(n, t1);
  for (int k = 0; k < 12; k++) { float a = rot + float(k) * 2.399, r = 0.06 + 0.5 * fract(float(k) * 0.618 + float(bx) * 0.0625), up = 0.3 + 0.65 * fract(float(k) * 0.381);
    vec3 st = toScreen((t1 * cos(a) + t2 * sin(a)) * r * sqrt(1. - up * up) + n * r * up); ivec2 q = p + ivec2(st.xy); if (q.x < 0 || q.y < 0 || q.x >= sz.x || q.y >= sz.y) continue;
    float sd = texelFetch(uDepth, q, 0).r, rd = d0 + st.z; if (sd < rd - 0.05 * M && rd - sd < 0.7 * M) occ += 1. - (rd - sd) / (0.7 * M); }
  float cs = 1.; if (dot(n, uSunD) > 0.1) { vec3 st = toScreen(uSunD); for (int k = 1; k <= 18; k++) { float t = float(k) * 0.04; ivec2 q = p + ivec2(st.xy * t); if (q.x < 0 || q.y < 0 || q.x >= sz.x || q.y >= sz.y) break;
    float sd = texelFetch(uDepth, q, 0).r, rd = d0 + st.z * t; if (sd < rd - 0.02 * M && rd - sd < 0.45 * M) { cs = mix(0.42, 0.9, t / 0.72); break; } } }   /* nearer blockers, darker (review 112) */
  o = vec4(1. - min(1., occ / 12. * 1.6) * 0.75, cs, 0., 1.); }`;
// ---- bloom (review 111): the light above white, halved four times and spread back up (a soft glow round highlights) ----
const DOWN_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform float uThresh; uniform int uFirst; in vec2 vUv; out vec4 o;
void main() { vec2 t = 1. / vec2(textureSize(uSrc, 0)); vec3 c = (texture(uSrc, vUv + t * vec2(-1, -1)).rgb + texture(uSrc, vUv + t * vec2(1, -1)).rgb + texture(uSrc, vUv + t * vec2(-1, 1)).rgb + texture(uSrc, vUv + t * vec2(1, 1)).rgb) * 0.25;
  if (uFirst == 1) { float L = max(c.r, max(c.g, c.b)), k = clamp(L - uThresh + 0.5, 0., 1.); k = k * k * 0.5 + max(0., L - uThresh - 0.5); c *= k / max(L, 1e-4);   /* a soft knee: only what is well above white glows */ c = min(c, vec3(24.)); } o = vec4(c, 1.); }`;
const UP_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc; in vec2 vUv; out vec4 o;
void main() { vec2 t = 1. / vec2(textureSize(uSrc, 0)); vec3 c = texture(uSrc, vUv).rgb * 4.;
  c += (texture(uSrc, vUv + vec2(t.x, 0.)).rgb + texture(uSrc, vUv - vec2(t.x, 0.)).rgb + texture(uSrc, vUv + vec2(0., t.y)).rgb + texture(uSrc, vUv - vec2(0., t.y)).rgb) * 2.;
  c += texture(uSrc, vUv + t).rgb + texture(uSrc, vUv - t).rgb + texture(uSrc, vUv + vec2(t.x, -t.y)).rgb + texture(uSrc, vUv + vec2(-t.x, t.y)).rgb; o = vec4(c / 16., 1.); }`;
// ---- the end (review 111): depth of field (a lens focused on the camera's target: what is nearer or farther blurs by
//      its distance from it, gathered over a disc), the bloom added, the filmic curve and gamma ----
const FINAL_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc, uDepth, uBloom, uVel; uniform float uBloomK, uDof, uRange, uFocus, uMB, uDeep; uniform int uHDR; in vec2 vUv; out vec4 o;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0., 1.); }
float coc(float d) { return min(9., max(0., abs(d - uFocus) * 2. * uRange - 1.2) * uDof); }   /* sharp within 1.2 m of the focus */
void main() { ivec2 p = ivec2(gl_FragCoord.xy); vec2 sz = vec2(textureSize(uSrc, 0)); vec3 c = texelFetch(uSrc, p, 0).rgb; float r0 = coc(texelFetch(uDepth, p, 0).r);
  if (uDof > 0. && r0 > 0.6) { vec3 acc = c; float wsum = 1.; for (int i = 0; i < 20; i++) { float a = float(i) * 2.39996, rr = sqrt((float(i) + 0.5) / 20.) * r0; vec2 q = vec2(p) + vec2(cos(a), sin(a)) * rr;
      float rq = coc(texelFetch(uDepth, ivec2(clamp(q, vec2(0.), sz - 1.)), 0).r), w = rq >= rr * 0.7 ? 1. : 0.15; acc += texture(uSrc, (q + 0.5) / sz).rgb * w; wsum += w; } c = acc / wsum; }
  // motion blur: each pixel smeared along its own motion across the picture since the last frame (the camera's for the
  // ground, a car's own against the camera's: one kept in shot stays sharp), as a shutter open for uMB of a frame
  vec2 mv = (texelFetch(uVel, p, 0).rg - 0.5) * 128. * uMB; float ml = length(mv);
  if (ml > 0.75) { vec3 acc = c; float n = 1., j = fract(float((p.x * 7 + p.y * 13) & 15) / 16. + 0.03);   /* a jittered start: no stepped copies */
    for (int i = 0; i < 20; i++) { float t = (float(i) + j) / 20. - 0.5; vec2 q = vec2(p) + mv * t; ivec2 qi = ivec2(clamp(q, vec2(0.), sz - 1.));
      vec2 mq = (texelFetch(uVel, qi, 0).rg - 0.5) * 128. * uMB; if (length(mq - mv) > 0.35 * ml + 1.) continue;   /* only what moves as this pixel does: a car is not smeared into the road */
      acc += texture(uSrc, (q + 0.5) / sz).rgb; n += 1.; } c = mix(c, acc / n, clamp(ml / 3., 0., 1.)); }
  c += texture(uBloom, vUv).rgb * uBloomK;
  if (uHDR == 1) {   /* the filmic curve on each channel bleaches a strong colour toward white as it brightens; on the
       brightness alone it keeps the hue: the two mixed by the colour's depth (review 116) */
    float L = dot(c, vec3(0.2126, 0.7152, 0.0722)); vec3 byL = c * (aces(vec3(L)).r / max(L, 1e-4)); float over = max(byL.r, max(byL.g, byL.b));
    if (over > 1.) byL = mix(byL / over, vec3(1.), clamp((over - 1.) * 0.5, 0., 1.));   /* past white: toward white, not clipped to another hue */
    c = pow(mix(aces(c), byL, clamp(uDeep * 0.55, 0., 0.85)), vec3(1. / 2.2)); } o = vec4(min(c, vec3(1.)), 1.); }`;
// ---- smoke (review 107, brief 75 §2): each parcel a sphere of gas, ray-marched through in its own fragment ----
const SMOKE_VS = `#version 300 es
layout(location=0) in vec2 aCorner; layout(location=1) in vec4 aPR; layout(location=2) in vec4 aGas;   // corner of the card; centre and radius; density, heat, kind, seed
uniform mat4 uVP; uniform vec3 uRx, uUp; out vec2 vUv; flat out vec4 vGas; flat out float vR;
void main() { vUv = aCorner; vGas = aGas; vR = aPR.w; vec3 w = aPR.xyz + (uRx * aCorner.x + uUp * aCorner.y) * aPR.w; gl_Position = uVP * vec4(w, 1.); }`;
const SMOKE_FS = `#version 300 es
precision highp float;
in vec2 vUv; flat in vec4 vGas; flat in float vR; uniform vec3 uRx, uUp, uVd, uSun; uniform float uTime; uniform int uHDR; out vec4 o;
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
/** the gas's density at a point of the unit sphere: the parcel's own, falling to its edge, broken by moving noise (its finer swirls) */
float dens(vec3 q) { float r2 = dot(q, q); if (r2 > 1.) return 0.; vec3 n = q * 2.1 + vGas.w * 37. + vec3(0., 0., -uTime * 0.6);
  float b = vn(n) * 0.55 + vn(n * 2.3 + 11.) * 0.3 + vn(n * 5.1 - 7.) * 0.15; return vGas.x * max(0., (1. - r2) * 1.6 - 0.35) * smoothstep(0.25, 0.75, b + (1. - r2) * 0.35); }
float hg(float c, float g) { float g2 = g * g; return (1. - g2) / (4. * 3.14159 * pow(1. + g2 - 2. * g * c, 1.5)); }
void main() { float r2 = dot(vUv, vUv); if (r2 > 1.) discard; float h = sqrt(1. - r2); int kind = int(vGas.z + 0.5);
  vec3 alb = kind == 1 ? vec3(0.62, 0.55, 0.42) : kind == 2 ? vec3(0.95) : kind == 3 ? vec3(0.62, 0.66, 0.72) : vec3(0.86, 0.85, 0.83);
  vec3 sunL = uSun, eyeIn = uVd, SUN = vec3(1., 0.95, 0.84) * 3., SKY = vec3(0.35, 0.42, 0.55);
  float sigma = 3.2 * vR, cosT = dot(sunL, eyeIn);   // extinction over the sphere's size; the angle between the light's way and the eye's
  float phase = mix(hg(cosT, 0.62), hg(cosT, -0.25), 0.3);   // two lobes: strong forward (a glow and bright rims with the sun behind), a little back
  vec3 col = vec3(0.); float Tv = 1., dt = 2. * h / 7.;
  for (int i = 0; i < 7; i++) { float t = -h + (float(i) + 0.5) * dt; vec3 q = uRx * vUv.x + uUp * vUv.y + eyeIn * t; float d = dens(q); if (d < 0.002) continue;
    float s = 0.; for (int j = 1; j <= 3; j++) s += dens(q + sunL * float(j) * 0.28) * 0.28;   // toward the sun: how much gas the light crosses
    // multiple scattering, by octaves: each a weaker extinction and a flatter phase (light bounced again inside the gas)
    vec3 L = vec3(0.); float a = 1., b = 1., c = 1.; for (int k = 0; k < 3; k++) { L += a * SUN * exp(-sigma * s * b) * mix(1., phase * 12.566, c);   /* the phase measured against an even spread (1) */ a *= 0.5; b *= 0.45; c *= 0.5; }
    L += SKY * (0.55 + 0.45 * q.z) * exp(-sigma * 0.5 * s);   // the sky from above
    float ext = sigma * d * dt; col += Tv * (1. - exp(-ext)) * alb * L; Tv *= exp(-ext); if (Tv < 0.02) break; }
  float A = 1. - Tv; if (A < 0.004) discard; vec3 x = col / max(A, 1e-3) * 0.55; if (uHDR == 1) { o = vec4(x * A, A); return; } vec3 c = pow(clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0., 1.), vec3(1. / 2.2)); o = vec4(c * A, A); }   /* the scene's filmic curve */`;

interface WheelDraw { hubZ: number; spin: number; def: Float32Array; sx: number; sy: number; R: number; rim: number }
type Piece = [{ vao: WebGLVertexArrayObject; n: number }, M4, WheelDraw?];
export class LiveRenderer {
  readonly gl: WebGL2RenderingContext; private obj: WebGLProgram; private aoP: WebGLProgram; private downP: WebGLProgram; private upP: WebGLProgram; private finalP: WebGLProgram; readonly hdr: boolean;
  /** render targets after the scene: 0 occlusion, 1 the composed picture, 2-5 the bloom's halvings */ private rt: { t: WebGLTexture; f: WebGLFramebuffer; w: number; h: number }[] = []; private smoke: WebGLProgram; private smokeVao: WebGLVertexArrayObject | null = null; private smokeBuf: WebGLBuffer | null = null; private ground: WebGLProgram; private depth: WebGLProgram; private post: WebGLProgram;
  private fbo: WebGLFramebuffer; private tCol: WebGLTexture; private tId: WebGLTexture; private tN: WebGLTexture; private tV: WebGLTexture; private prevVP: Float32Array | null = null; private prevCam: [number, number] | null = null; private prevM = new Map<string, M4>(); private ids = new WeakMap<GpuMesh, number>(); private nid = 0; private idOf(g: GpuMesh) { let k = this.ids.get(g); if (k === undefined) { k = this.nid++; this.ids.set(g, k); } return k; } private nextM = new Map<string, M4>(); private tDepth: WebGLTexture; private W = 0; private H = 0;
  private sFbo: WebGLFramebuffer; private sTex: WebGLTexture; private S = 2048;
  private groundVao: WebGLVertexArrayObject | null = null; private groundN = 0; private fenceVao: WebGLVertexArrayObject | null = null; private fenceN = 0;
  private skidVao: WebGLVertexArrayObject; private skidBuf: WebGLBuffer; private kinds = new Map<string, GpuMesh>(); private cars = new Map<Mesh, GpuMesh>();
  private u = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>(); private blank: WebGLTexture; private arts = new Map<GpuMesh, { lut: WebGLTexture; tex: WebGLTexture; mm: number; C: number; rects: Float32Array; origins: Float32Array }>(); private tex: { alb: WebGLTexture; nor: WebGLTexture; rgh: WebGLTexture; size: Float32Array; luma: Float32Array; rough: Float32Array } | null = null;
  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, preserveDrawingBuffer: true }); if (!gl) throw new Error('no WebGL2'); this.gl = gl;
    this.obj = program(gl, OBJ_VS, OBJ_FS); this.ground = program(gl, GROUND_VS, GROUND_FS); this.depth = program(gl, DEPTH_VS, DEPTH_FS); this.post = program(gl, POST_VS, POST_FS); this.smoke = program(gl, SMOKE_VS, SMOKE_FS);
    this.aoP = program(gl, POST_VS, AO_FS); this.downP = program(gl, POST_VS, DOWN_FS); this.upP = program(gl, POST_VS, UP_FS); this.finalP = program(gl, POST_VS, FINAL_FS);
    this.hdr = !!gl.getExtension('EXT_color_buffer_float'); gl.getExtension('OES_texture_float_linear');   /* a wide-range picture where the device can draw one */
    for (let k = 0; k < 6; k++) { this.rt.push({ t: gl.createTexture()!, f: gl.createFramebuffer()!, w: 0, h: 0 }); }
    this.fbo = gl.createFramebuffer()!; this.tCol = gl.createTexture()!; this.tId = gl.createTexture()!; this.tN = gl.createTexture()!; this.tV = gl.createTexture()!; this.tDepth = gl.createTexture()!;
    this.sFbo = gl.createFramebuffer()!; this.sTex = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, this.sTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, this.S, this.S); this.texParams(gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sFbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.sTex, 0); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.blank = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, this.blank); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); this.texParams(gl.NEAREST);   // what an unused sampler reads (never the picture being drawn)
    this.skidVao = gl.createVertexArray()!; this.skidBuf = gl.createBuffer()!; gl.bindVertexArray(this.skidVao); gl.bindBuffer(gl.ARRAY_BUFFER, this.skidBuf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 12); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 32, 28); gl.bindVertexArray(null); }
  private texParams(f: number) { const gl = this.gl; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
  private loc(p: WebGLProgram, name: string) { let m = this.u.get(p); if (!m) { m = new Map(); this.u.set(p, m); } if (!m.has(name)) m.set(name, this.gl.getUniformLocation(p, name)); return m.get(name)!; }
  private size(W: number, H: number) { if (W === this.W && H === this.H) return; const gl = this.gl; this.W = W; this.H = H;
    for (const [t, f, fmt, type] of [[this.tCol, this.hdr ? gl.RGBA16F : gl.RGBA8, gl.RGBA, this.hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE], [this.tId, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE], [this.tN, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE], [this.tV, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE], [this.tDepth, gl.DEPTH24_STENCIL8, gl.DEPTH_STENCIL, gl.UNSIGNED_INT_24_8]] as const) {
      gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, f, W, H, 0, fmt, type, null); this.texParams(gl.NEAREST); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tCol, 0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.tId, 0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, this.tN, 0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT3, gl.TEXTURE_2D, this.tV, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.TEXTURE_2D, this.tDepth, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.rt.forEach((r, k) => { r.w = k < 2 ? W : Math.max(1, W >> (k - 1)); r.h = k < 2 ? H : Math.max(1, H >> (k - 1)); const wide = k > 0 && this.hdr;
      gl.bindTexture(gl.TEXTURE_2D, r.t); gl.texImage2D(gl.TEXTURE_2D, 0, wide ? gl.RGBA16F : gl.RGBA8, r.w, r.h, 0, gl.RGBA, wide ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null); this.texParams(k === 0 ? gl.NEAREST : gl.LINEAR);
      gl.bindFramebuffer(gl.FRAMEBUFFER, r.f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.t, 0); }); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
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
  /** high-resolution albedo and normal for some layers (review 114): `layers` maps a layer (0 concrete .. 6 wood) to its
   *  pictures; all drawn at `size` (2048 or 4096) into two texture arrays, mipmapped. null: back to the ordinary set */
  private hiTex: { alb: WebGLTexture; nor: WebGLTexture; idx: Int32Array } | null = null;
  setHiTextures(layers: Map<number, { alb: TexImageSource; nor: TexImageSource }> | null, size = 4096) { const gl = this.gl;
    if (this.hiTex) { gl.deleteTexture(this.hiTex.alb); gl.deleteTexture(this.hiTex.nor); this.hiTex = null; } if (!layers || !layers.size) return;
    const idx = new Int32Array(7).fill(-1), keys = [...layers.keys()]; keys.forEach((L, k) => { idx[L] = k; });
    const arr = (pick: (v: { alb: TexImageSource; nor: TexImageSource }) => TexImageSource) => { const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D_ARRAY, t); gl.texStorage3D(gl.TEXTURE_2D_ARRAY, Math.floor(Math.log2(size)) + 1, gl.RGBA8, size, size, keys.length);
      keys.forEach((L, k) => { const src = pick(layers.get(L)!), c = document.createElement('canvas'); c.width = size; c.height = size; c.getContext('2d')!.drawImage(src as CanvasImageSource, 0, 0, size, size); gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, k, size, size, 1, gl.RGBA, gl.UNSIGNED_BYTE, c); c.width = c.height = 1; });
      gl.generateMipmap(gl.TEXTURE_2D_ARRAY); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT); const an = gl.getExtension('EXT_texture_filter_anisotropic'); if (an) gl.texParameterf(gl.TEXTURE_2D_ARRAY, an.TEXTURE_MAX_ANISOTROPY_EXT, 8); return t; };
    this.hiTex = { alb: arr(v => v.alb), nor: arr(v => v.nor), idx }; }
  setGround(d: GroundData) { this.groundVao = this.vaoOf(d); this.groundN = d.n; }
  setFence(d: GroundData) { this.fenceVao = this.vaoOf(d); this.fenceN = d.n; }
  /** the GPU copy of a prop's mesh (by kind) or a car's (by its mesh object), made once */
  prop(kind: string, make: () => Mesh): GpuMesh { let g = this.kinds.get(kind); if (!g) { g = gpuMesh(this.gl, make(), false); this.kinds.set(kind, g); } return g; }
  car(M: Mesh): GpuMesh { let g = this.cars.get(M); if (!g) { g = gpuMesh(this.gl, M, true); this.cars.set(M, g); } return g; }
  forget(M: Mesh) { this.cars.delete(M); }

  render(v: LiveView, cars: LiveCar[], props: LiveProp[], skids: Skid[], o: { glass?: number; /** 0 the baked look, 1 PBR stepped, 2 PBR smooth */ look?: number; /** lay the 2D art on (default yes) */ art?: boolean; /** the rays in the picture: occlusion, contact shadows, reflections (default yes) */ rays?: boolean; /** strengths: the textures, the light (1: as set) */ texK?: number; /** the time of day: 1 day (default), toward 0 dusk and night (review 117) */ day?: number; /** the colour's depth: deeper lacquer, the hue kept through the tone curve (0: as before; default 1) (review 116) */ deep?: number; lightK?: number; /** after the scene: occlusion and reflection strengths, bloom, depth of field (0 none; pixels of blur a metre from the focus) */ aoK?: number; reflK?: number; bloomK?: number; dof?: number; /** motion blur: the shutter, a share of a frame (0 none) */ mb?: number; /** the outline: width (times each thing's own; 0 none), darkness 0..1; the lines inside a thing (default: the baked look only), their darkness */ outW?: number; outK?: number; inner?: boolean; inK?: number; /** smoke parcels: centre, radius, density, heat, kind (0 tyre 1 dust 2 steam 3 exhaust), seed; and the time */ smoke?: { p: Float32Array; n: number; time: number } } = {}) { const gl = this.gl; this.size(v.W, v.H);
    // ---- the camera: orthographic, turned to v.ang, tilted down by v.pitch, v.mm millimetres a pixel, snapped to whole pixels ----
    const a = v.ang - Math.PI / 2, cA = Math.cos(a), sA = Math.sin(a), SP = Math.sin(v.pitch * Math.PI / 180), CP = Math.cos(v.pitch * Math.PI / 180), k = 1000 / v.mm, R = 900;
    const rx = [cA, sA, 0], ry = [-sA, cA, 0], up = [ry[0]! * SP, ry[1]! * SP, CP], vd = [ry[0]! * CP, ry[1]! * CP, -SP], c = [v.x, v.y, v.z], dot = (p: number[], q: number[]) => p[0]! * q[0]! + p[1]! * q[1]! + p[2]! * q[2]!;
    const VP = new Float32Array(16); VP[0] = rx[0]! * 2 * k / v.W; VP[4] = rx[1]! * 2 * k / v.W; VP[12] = Math.round(v.W / 2 - dot(c, rx) * k) * 2 / v.W - 1;
    VP[1] = up[0]! * 2 * k / v.H; VP[5] = up[1]! * 2 * k / v.H; VP[9] = up[2]! * 2 * k / v.H; VP[13] = 1 - 2 * Math.round(v.H * v.cy + dot(c, up) * k) / v.H;
    VP[2] = vd[0]! / R; VP[6] = vd[1]! / R; VP[10] = vd[2]! / R; VP[14] = -dot(c, vd) / R; VP[15] = 1;
    const eye = [-vd[0]!, -vd[1]!, -vd[2]!];
    if (this.prevCam && Math.hypot(v.x - this.prevCam[0], v.y - this.prevCam[1]) > 15) { this.prevVP = null; this.prevM.clear(); }   /* a cut (the car put back, a new shot): no smear from the jump */ this.prevCam = [v.x, v.y];
    // ---- the sun's view for the shadows: around the camera's target, as far as the picture reaches ----
    const reach = Math.min(160, Math.hypot(v.W, v.H / Math.max(0.2, SP)) * v.mm / 2000 + 12), lz = SUN_W.map(x => -x), lx0 = [lz[1]!, -lz[0]!, 0], ll = Math.hypot(lx0[0]!, lx0[1]!), lx = [lx0[0]! / ll, lx0[1]! / ll, 0];
    const ly = [lz[1]! * lx[2]! - lz[2]! * lx[1]!, lz[2]! * lx[0]! - lz[0]! * lx[2]!, lz[0]! * lx[1]! - lz[1]! * lx[0]!], LR = 200, LV = new Float32Array(16);
    const tx = Math.round(dot(c, lx) / (2 * reach / this.S)) * (2 * reach / this.S), ty = Math.round(dot(c, ly) / (2 * reach / this.S)) * (2 * reach / this.S);   // snapped to the map's texels: shadows hold still
    LV[0] = lx[0]! / reach; LV[4] = lx[1]! / reach; LV[8] = lx[2]! / reach; LV[12] = -tx / reach; LV[1] = ly[0]! / reach; LV[5] = ly[1]! / reach; LV[9] = ly[2]! / reach; LV[13] = -ty / reach;
    LV[2] = lz[0]! / LR; LV[6] = lz[1]! / LR; LV[10] = lz[2]! / LR; LV[14] = -dot(c, lz) / LR; LV[15] = 1;
    const near = (x: number, y: number, r: number) => Math.abs(x - v.x) < reach + r + 20 && Math.abs(y - v.y) < reach + r + 20;
    const ps = props.filter(p => near(p.x, p.y, p.g.radius)), carM = cars.map(q => this.carParts(q));
    // the head lamps alight (review 117): each lamp's middle and beam in the world, the nearest eight
    const lmpP: number[] = [], lmpD: number[] = []; cars.forEach((q, i) => { if (!q.lamps) return; const B = carM[i]!.body; for (const l of q.g.lamps) { if (l.flag !== 1 || lmpP.length >= 24) continue;
        const [x, y, z] = l.c, [a, b, c] = l.ax, wx = B[0]! * x + B[4]! * y + B[8]! * z + B[12]!, wy = B[1]! * x + B[5]! * y + B[9]! * z + B[13]!, wz = B[2]! * x + B[6]! * y + B[10]! * z + B[14]!;
        let dx = B[0]! * a + B[4]! * b + B[8]! * c, dy = B[1]! * a + B[5]! * b + B[9]! * c, dz = B[2]! * a + B[6]! * b + B[10]! * c; const hl = Math.hypot(dx, dy) || 1; dx /= hl; dy /= hl; dz = -0.1; const dl = Math.hypot(dx, dy, dz);
        lmpP.push(wx + dx * 0.15, wy + dy * 0.15, wz); lmpD.push(dx / dl, dy / dl, dz / dl); } });
    const lampsTo = (p: WebGLProgram) => { gl.uniform1i(this.loc(p, 'uLmpN'), lmpP.length / 3); if (lmpP.length) { gl.uniform3fv(this.loc(p, 'uLmpP'), lmpP); gl.uniform3fv(this.loc(p, 'uLmpD'), lmpD); } };
    // ---- the shadow map ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sFbo); gl.viewport(0, 0, this.S, this.S); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT); gl.disable(gl.BLEND); gl.disable(gl.STENCIL_TEST);
    gl.useProgram(this.depth); gl.uniformMatrix4fv(this.loc(this.depth, 'uVP'), false, LV);
    const drawD = (part: { vao: WebGLVertexArrayObject; n: number }, M: M4) => { if (!part.n) return; gl.uniformMatrix4fv(this.loc(this.depth, 'uModel'), false, M); gl.bindVertexArray(part.vao); gl.drawArrays(gl.TRIANGLES, 0, part.n); };
    for (const p of ps) drawD(p.g.body, (p.m ?? placeMesh(p.g.len, p.x, p.y, p.z, p.h))); for (const m of carM) for (const [part, M] of m.opaque) drawD(part, M);
    // ---- the scene: colour, which thing, depth ----
    for (const i of [0, 1, 2, 8, 9]) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, this.blank); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo); gl.viewport(0, 0, v.W, v.H); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2, gl.COLOR_ATTACHMENT3]);
    gl.clearBufferfv(gl.COLOR, 0, [0.36, 0.45, 0.28, 1]); gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]); gl.clearBufferfv(gl.COLOR, 2, [0.5, 0.5, 1, 0]); gl.clearBufferfv(gl.COLOR, 3, [0.5, 0.5, 0, 1]); gl.clearBufferfi(gl.DEPTH_STENCIL, 0, 1, 0);
    const texTo = (p: WebGLProgram) => { gl.uniform1i(this.loc(p, 'uTex'), this.tex ? 1 : 0); const H = this.hiTex; gl.uniform1i(this.loc(p, 'uHi'), H ? 1 : 0);
      gl.activeTexture(gl.TEXTURE10); gl.bindTexture(gl.TEXTURE_2D_ARRAY, H ? H.alb : this.tex?.alb ?? null); gl.uniform1i(this.loc(p, 'uHiAlb'), 10); gl.activeTexture(gl.TEXTURE11); gl.bindTexture(gl.TEXTURE_2D_ARRAY, H ? H.nor : this.tex?.nor ?? null); gl.uniform1i(this.loc(p, 'uHiNor'), 11);
      gl.uniform1iv(this.loc(p, 'uHiIdx'), H ? H.idx : new Int32Array(7).fill(-1)); if (!this.tex) return; const t = this.tex;
      [t.alb, t.nor, t.rgh].forEach((x, i) => { gl.activeTexture(gl.TEXTURE3 + i); gl.bindTexture(gl.TEXTURE_2D_ARRAY, x); gl.uniform1i(this.loc(p, ['uAlb', 'uNor', 'uRgh'][i]!), 3 + i); });
      gl.uniform1fv(this.loc(p, 'uTSize'), t.size); gl.uniform1fv(this.loc(p, 'uTLuma'), t.luma); gl.uniform1fv(this.loc(p, 'uTRough'), t.rough); };
    const boxes = cars.slice().sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y)).slice(0, 6), boxIdx = new Map(boxes.map((q, i) => [q, i]));
    const boxTo = (p: WebGLProgram) => { gl.uniform1i(this.loc(p, 'uBoxN'), boxes.length); gl.uniform1i(this.loc(p, 'uSelf'), -1); if (!boxes.length) return;
      gl.uniform3fv(this.loc(p, 'uBoxC'), boxes.flatMap(q => { const H = q.g.height; return [q.x, q.y, q.z + 0.18 + (H - 0.18) / 2]; }));
      gl.uniform3fv(this.loc(p, 'uBoxE'), boxes.flatMap(q => [q.g.len / 2000 * 0.9, q.g.width / 2 * 0.85, (q.g.height - 0.18) / 2 * 0.8])); gl.uniform2fv(this.loc(p, 'uBoxR'), boxes.flatMap(q => [Math.cos(q.yaw), Math.sin(q.yaw)])); };
    const shadowTo = (p: WebGLProgram) => { texTo(p); boxTo(p); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.sTex); gl.uniform1i(this.loc(p, 'uShadow'), 1); gl.uniformMatrix4fv(this.loc(p, 'uLight'), false, LV); };
    gl.useProgram(this.ground); lampsTo(this.ground); gl.uniform1f(this.loc(this.ground, 'uDay'), o.day ?? 1); gl.uniformMatrix4fv(this.loc(this.ground, 'uVP'), false, VP); const hdrOn = this.hdr && (o.look ?? 0) === 2 ? 1 : 0; gl.uniform1i(this.loc(this.ground, 'uHDRo'), hdrOn); gl.uniform1f(this.loc(this.ground, 'uSpecK'), 1); gl.uniformMatrix4fv(this.loc(this.ground, 'uPrevVP'), false, this.prevVP ?? VP); gl.uniform2f(this.loc(this.ground, 'uSize'), v.W, v.H); gl.uniform1i(this.loc(this.ground, 'uLook'), o.look ?? 0); gl.uniform1f(this.loc(this.ground, 'uTexK'), o.texK ?? 1); gl.uniform1f(this.loc(this.ground, 'uLightK'), o.lightK ?? 1); gl.uniform3fv(this.loc(this.ground, 'uSun'), SUN_W); gl.uniform3fv(this.loc(this.ground, 'uEye'), eye); gl.uniform1f(this.loc(this.ground, 'uCell'), Math.max(0.03, v.mm / 1000)); gl.uniform1f(this.loc(this.ground, 'uBias'), 0); shadowTo(this.ground);
    if (this.groundVao) { gl.bindVertexArray(this.groundVao); gl.drawArrays(gl.TRIANGLES, 0, this.groundN); }
    if (this.fenceVao && this.fenceN) { gl.bindVertexArray(this.fenceVao); gl.drawArrays(gl.TRIANGLES, 0, this.fenceN); }
    // skid marks: dark patches on the concrete, blended, nothing else written
    if (skids.length) { const S = skids.filter(m => near(m.x, m.y, 0)), f = new Float32Array(S.length * 6 * 8), r = 0.09;
      S.forEach((m, i) => { const q = [[-r, -r], [r, -r], [r, r], [-r, -r], [r, r], [-r, r]]; q.forEach(([dx, dy], j) => f.set([m.x + dx!, m.y + dy!, m.z + 0.01, 30 / 255, 28 / 255, 26 / 255, m.a, 0], (i * 6 + j) * 8)); });
      gl.bindBuffer(gl.ARRAY_BUFFER, this.skidBuf); gl.bufferData(gl.ARRAY_BUFFER, f, gl.DYNAMIC_DRAW); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE, gl.NONE, gl.NONE]);
      gl.uniform1f(this.loc(this.ground, 'uBias'), 0.00002); gl.bindVertexArray(this.skidVao); gl.drawArrays(gl.TRIANGLES, 0, S.length * 6); gl.disable(gl.BLEND); gl.depthMask(true); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2, gl.COLOR_ATTACHMENT3]); }
    gl.useProgram(this.obj); lampsTo(this.obj); gl.uniform1f(this.loc(this.obj, 'uDay'), o.day ?? 1); gl.uniformMatrix4fv(this.loc(this.obj, 'uVP'), false, VP); gl.uniform1i(this.loc(this.obj, 'uHDRo'), hdrOn); gl.uniformMatrix4fv(this.loc(this.obj, 'uPrevVP'), false, this.prevVP ?? VP); gl.uniform2f(this.loc(this.obj, 'uSize'), v.W, v.H); gl.uniform1f(this.loc(this.obj, 'uSpecK'), o.reflK ?? 1); gl.uniform1f(this.loc(this.obj, 'uDeep'), o.deep ?? 1); gl.uniform1i(this.loc(this.obj, 'uLook'), o.look ?? 0); gl.uniform1f(this.loc(this.obj, 'uTexK'), o.texK ?? 1); gl.uniform1f(this.loc(this.obj, 'uLightK'), o.lightK ?? 1); gl.uniform3fv(this.loc(this.obj, 'uEye'), eye); gl.uniform3fv(this.loc(this.obj, 'uSun'), SUN_W); gl.uniform1f(this.loc(this.obj, 'uGlass'), o.glass ?? 0.8); shadowTo(this.obj);
    gl.uniform1i(this.loc(this.obj, 'uDecTex'), 2);
    const artTo = (g: GpuMesh | null) => { const a = g && o.art !== false ? this.arts.get(g) : undefined; gl.uniform1i(this.loc(this.obj, 'uArtOn'), a ? 1 : 0); gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, a ? a.tex : this.blank); gl.uniform1i(this.loc(this.obj, 'uArt'), 6); gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, a ? a.lut : this.blank); gl.uniform1i(this.loc(this.obj, 'uArtLut'), 7); if (!a) return;
      gl.uniform1f(this.loc(this.obj, 'uArtMM'), a.mm); gl.uniform1f(this.loc(this.obj, 'uArtC'), a.C); gl.uniform4fv(this.loc(this.obj, 'uArtR'), a.rects); gl.uniform2fv(this.loc(this.obj, 'uArtO'), a.origins); };
    artTo(null);
    let id = 1; const objU = (outline: number) => { gl.uniform2f(this.loc(this.obj, 'uObj'), (id & 255) / 255, ((id >> 8) & 255) / 255); gl.uniform1f(this.loc(this.obj, 'uOutline'), outline); id++; };
    const draw = (part: { vao: WebGLVertexArrayObject; n: number }, M: M4, w?: WheelDraw, key?: string) => { if (!part.n) return; gl.uniformMatrix4fv(this.loc(this.obj, 'uModel'), false, M); gl.uniformMatrix4fv(this.loc(this.obj, 'uPrevModel'), false, (key && this.prevM.get(key)) || M); if (key) this.nextM.set(key, M); gl.uniform1i(this.loc(this.obj, 'uWheel'), w ? 1 : 0);
      if (!w) gl.uniform1f(this.loc(this.obj, 'uObjZ'), 0); if (w) { gl.uniform1f(this.loc(this.obj, 'uSpin'), w.spin); gl.uniform1f(this.loc(this.obj, 'uObjZ'), w.hubZ); gl.uniform1fv(this.loc(this.obj, 'uDef'), w.def); gl.uniform2f(this.loc(this.obj, 'uShift'), w.sx, w.sy); gl.uniform1f(this.loc(this.obj, 'uTyreR'), w.R); gl.uniform1f(this.loc(this.obj, 'uRim'), w.rim); } gl.bindVertexArray(part.vao); gl.drawArrays(gl.TRIANGLES, 0, part.n); };
    const decals = (g: GpuMesh | null) => { const n = g ? g.decals.length : 0; gl.uniform1i(this.loc(this.obj, 'uDecN'), n); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, n ? g!.decalTex : this.blank); if (!g || !n) return;
      gl.uniform3fv(this.loc(this.obj, 'uDecO'), g.decals.flatMap(d => d.o)); gl.uniform3fv(this.loc(this.obj, 'uDecN_'), g.decals.flatMap(d => { const l = Math.hypot(...d.n); return d.n.map(x => x / l); }));
      gl.uniform3fv(this.loc(this.obj, 'uDecUp'), g.decals.flatMap(d => { const l = Math.hypot(...d.up); return d.up.map(x => x / l); })); gl.uniform1fv(this.loc(this.obj, 'uDecR'), g.decals.map(d => d.r)); };
    gl.uniform1i(this.loc(this.obj, 'uMode'), 0); gl.uniform1f(this.loc(this.obj, 'uBias'), 0); decals(null); gl.uniform1f(this.loc(this.obj, 'uLampOn'), 0); gl.uniform1f(this.loc(this.obj, 'uBrake'), 0);
    const outlineP = Math.max(1, Math.min(2, Math.round(2 * 50 / v.mm))), outlineC = Math.max(1, Math.min(3, Math.round(3 * 50 / v.mm)));
    gl.uniform3f(this.loc(this.obj, 'uWear'), 0, 0, 0); for (const p of ps) { objU(p.outline ?? outlineP); draw(p.g.body, (p.m ?? placeMesh(p.g.len, p.x, p.y, p.z, p.h)), undefined, p.key); }
    // the cars a thing hides: their light outline first, tested against what stands before them (each pixel once), then the cars over it
    gl.uniform1i(this.loc(this.obj, 'uMode'), 1); gl.depthFunc(gl.GREATER); gl.depthMask(false); gl.enable(gl.STENCIL_TEST); gl.stencilFunc(gl.EQUAL, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE, gl.NONE, gl.NONE]); gl.uniform1f(this.loc(this.obj, 'uBias'), 0.25 / R);
    cars.forEach((q, i) => { gl.uniform4f(this.loc(this.obj, 'uSil'), 1, 226 / 255, 168 / 255, q.player ? 0.6 : 0.4); for (const [part, M, w] of carM[i]!.opaque) draw(part, M, w); });
    gl.disable(gl.STENCIL_TEST); gl.disable(gl.BLEND); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2, gl.COLOR_ATTACHMENT3]); gl.uniform1f(this.loc(this.obj, 'uBias'), 0); gl.uniform1i(this.loc(this.obj, 'uMode'), 0);
    cars.forEach((q, i) => { objU(outlineC); const m = carM[i]!; gl.uniform1f(this.loc(this.obj, 'uLampOn'), q.lamps ?? 0); gl.uniform1f(this.loc(this.obj, 'uBrake'), q.brake ? 1 : 0); gl.uniform1i(this.loc(this.obj, 'uSelf'), boxIdx.get(q) ?? -1); gl.uniform3fv(this.loc(this.obj, 'uWear'), q.wear ?? [0, 0, 0]); gl.uniform1f(this.loc(this.obj, 'uCarH'), q.g.height); artTo(q.g); decals(q.g); draw(q.g.body, m.body, undefined, `c${this.idOf(q.g)}:0`); decals(null); m.opaque.slice(1).forEach(([part, M, w], j) => draw(part, M, w, `c${this.idOf(q.g)}:${j + 1}`)); });
    // smoke: parcels far to near, blended over what is drawn, hidden behind what stands before them
    if (o.smoke && o.smoke.n) { const S = o.smoke; if (!this.smokeVao) { this.smokeVao = gl.createVertexArray()!; gl.bindVertexArray(this.smokeVao); const corners = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, corners); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); this.smokeBuf = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, this.smokeBuf);
        gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(1, 1); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(2, 1); gl.bindVertexArray(null); }
      const idx = Array.from({ length: S.n }, (_, k) => k).sort((a, b) => dot([S.p[b * 8]!, S.p[b * 8 + 1]!, S.p[b * 8 + 2]!], vd) - dot([S.p[a * 8]!, S.p[a * 8 + 1]!, S.p[a * 8 + 2]!], vd)), sorted = new Float32Array(S.n * 8);
      idx.forEach((k, j) => sorted.set(S.p.subarray(k * 8, k * 8 + 8), j * 8));
      gl.useProgram(this.smoke); gl.uniformMatrix4fv(this.loc(this.smoke, 'uVP'), false, VP); gl.uniform3fv(this.loc(this.smoke, 'uRx'), rx); gl.uniform3fv(this.loc(this.smoke, 'uUp'), up); gl.uniform3fv(this.loc(this.smoke, 'uVd'), vd); gl.uniform3fv(this.loc(this.smoke, 'uSun'), SUN_W); gl.uniform1f(this.loc(this.smoke, 'uTime'), S.time); gl.uniform1i(this.loc(this.smoke, 'uHDR'), hdrOn);
      gl.bindVertexArray(this.smokeVao); gl.bindBuffer(gl.ARRAY_BUFFER, this.smokeBuf); gl.bufferData(gl.ARRAY_BUFFER, sorted, gl.DYNAMIC_DRAW);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE, gl.NONE, gl.NONE]); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, S.n);
      gl.disable(gl.BLEND); gl.depthMask(true); gl.useProgram(this.obj); }
    // glass over all, at its own strength, nothing else written
    gl.uniform1i(this.loc(this.obj, 'uMode'), 2); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   /* premultiplied (review 116) */ gl.depthMask(false); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE, gl.NONE, gl.NONE]);
    gl.uniform3f(this.loc(this.obj, 'uWear'), 0, 0, 0); for (const p of ps) draw(p.g.glass, (p.m ?? placeMesh(p.g.len, p.x, p.y, p.z, p.h))); cars.forEach((q, i) => { gl.uniform1f(this.loc(this.obj, 'uLampOn'), q.lamps ?? 0); gl.uniform1f(this.loc(this.obj, 'uBrake'), q.brake ? 1 : 0); for (const [part, M, w] of carM[i]!.glass) draw(part, M, w); }); gl.uniform1f(this.loc(this.obj, 'uLampOn'), 0); gl.uniform1f(this.loc(this.obj, 'uBrake'), 0);
    gl.disable(gl.BLEND); gl.depthMask(true);
    // ---- after the scene (review 111): occlusion, then the picture composed (reflections, occlusion, outlines), the bloom, the end ----
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.STENCIL_TEST); gl.disable(gl.BLEND); gl.bindVertexArray(null); const rays = (o.look ?? 0) > 0 && o.rays !== false, RT = this.rt;
    const tex = (p: WebGLProgram, name: string, unit: number, t: WebGLTexture) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(this.loc(p, name), unit); };
    const to = (k: number | null) => { if (k === null) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, v.W, v.H); } else { gl.bindFramebuffer(gl.FRAMEBUFFER, RT[k]!.f); gl.viewport(0, 0, RT[k]!.w, RT[k]!.h); } };
    if (rays) { to(0); gl.useProgram(this.aoP); tex(this.aoP, 'uDepth', 0, this.tDepth); tex(this.aoP, 'uN', 1, this.tN); gl.uniformMatrix4fv(this.loc(this.aoP, 'uVP'), false, VP); gl.uniform3fv(this.loc(this.aoP, 'uSunD'), SUN_W); gl.uniform1f(this.loc(this.aoP, 'uRange'), R); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    to(1); gl.useProgram(this.post); tex(this.post, 'uAO', 9, RT[0]!.t); gl.uniform1f(this.loc(this.post, 'uAOK'), o.aoK ?? 1); gl.uniform1f(this.loc(this.post, 'uReflK'), o.reflK ?? 1);
    [this.tCol, this.tId, this.tDepth].forEach((t, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(this.loc(this.post, ['uCol', 'uId', 'uDepth'][i]!), i); });
    gl.uniform1i(this.loc(this.post, 'uInner'), (o.inner ?? (o.look ?? 0) === 0) ? 1 : 0); gl.uniform1f(this.loc(this.post, 'uOutW'), o.outW ?? 1); gl.uniform1f(this.loc(this.post, 'uOutK'), o.outK ?? 1); gl.uniform1f(this.loc(this.post, 'uInK'), o.inK ?? 1); gl.uniform1f(this.loc(this.post, 'uRayK'), Math.min(1.8, o.lightK ?? 1)); gl.uniform1i(this.loc(this.post, 'uRays'), (o.look ?? 0) > 0 && o.rays !== false ? 1 : 0); gl.uniformMatrix4fv(this.loc(this.post, 'uVP'), false, VP); gl.uniform3fv(this.loc(this.post, 'uVd'), vd); gl.uniform3fv(this.loc(this.post, 'uSunD'), SUN_W);
    gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, this.tN); gl.uniform1i(this.loc(this.post, 'uN'), 8); gl.uniform1f(this.loc(this.post, 'uRange'), R);   /* PBR: no lines over the shading inside a thing, its outline only */ gl.uniform1f(this.loc(this.post, 'uStep'), (60 + 2 * v.mm / Math.tan(Math.max(5, v.pitch) * Math.PI / 180)) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    for (let i = 0; i < 6; i++) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, this.blank); }
    const bloomK = o.bloomK ?? 1;
    if (bloomK > 0) { gl.useProgram(this.downP); gl.uniform1f(this.loc(this.downP, 'uThresh'), hdrOn ? 1.7 : 0.9);
      for (let k = 2; k <= 5; k++) { to(k); tex(this.downP, 'uSrc', 0, RT[k - 1]!.t); gl.uniform1i(this.loc(this.downP, 'uFirst'), k === 2 ? 1 : 0); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.blank); }
      gl.useProgram(this.upP); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      for (let k = 4; k >= 2; k--) { to(k); tex(this.upP, 'uSrc', 0, RT[k + 1]!.t); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.blank); }
      gl.disable(gl.BLEND); }
    to(null); gl.useProgram(this.finalP); tex(this.finalP, 'uSrc', 0, RT[1]!.t); tex(this.finalP, 'uDepth', 1, this.tDepth); tex(this.finalP, 'uBloom', 2, RT[2]!.t); tex(this.finalP, 'uVel', 3, this.tV); gl.uniform1f(this.loc(this.finalP, 'uMB'), o.mb ?? 0);
    gl.uniform1f(this.loc(this.finalP, 'uBloomK'), bloomK > 0 ? bloomK * (hdrOn ? 0.55 : 0.4) : 0); gl.uniform1f(this.loc(this.finalP, 'uDof'), (o.dof ?? 0) * 0.8); gl.uniform1f(this.loc(this.finalP, 'uDeep'), o.deep ?? 1); gl.uniform1f(this.loc(this.finalP, 'uRange'), R); gl.uniform1f(this.loc(this.finalP, 'uFocus'), 0.5 + 0.6 * vd[2]! / (2 * R));   /* focused at the car's middle height over the target */ gl.uniform1i(this.loc(this.finalP, 'uHDR'), hdrOn);
    gl.drawArrays(gl.TRIANGLES, 0, 3); for (let i = 0; i < 4; i++) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, this.blank); }
    this.prevVP = VP; this.prevM = this.nextM; this.nextM = new Map(); }

  /** a car's pieces with their matrices: the body on its springs (rolled and pitched about its middle), each wheel at its
   *  hub, turned on its axle and the front ones steered */
  private carParts(q: LiveCar): { body: M4; opaque: Piece[]; glass: Piece[] } {
    const g = q.g, base = placeMesh(g.len, q.x, q.y, q.z, q.yaw), mid = translate(g.len / 2, 0, 0), back = translate(-g.len / 2, 0, 0);
    const body = mul(base, mul(mid, mul(rot('x', q.roll), mul(rot('y', q.pitch), back))));
    const opaque: Piece[] = [[g.body, body]], glass: Piece[] = [[g.glass, body]];
    for (const w of g.wheels) { const left = w.hub[1] > 0, wi = (w.front ? 0 : 2) + (left ? 0 : 1), M = mul(body, mul(translate(w.hub[0], w.hub[1], w.hub[2] + (q.travel?.[wi] ?? 0) * 1000), mul(w.front ? rot('z', -(left ? q.steerL : q.steerR)) : translate(0, 0, 0), rot('x', -(q.camber?.[wi] ?? 0)))));
      const ty = q.tyres?.[(w.front ? 0 : 2) + (left ? 0 : 1)], def = new Float32Array(32); if (ty) for (let k = 0; k < 32; k++) def[k] = ty.u[k]! * 1000;
      const wd: WheelDraw = { hubZ: w.hub[2], spin: q.spin, def, sx: (ty?.sx ?? 0) * 1000, sy: (ty?.sy ?? 0) * 1000, R: w.R, rim: w.rim };
      opaque.push([w.part, M, wd]); if (w.glass) glass.push([w.glass, M, wd]); }
    return { body, opaque, glass }; }
}
