// The live renderer (review 99; brief 72 steps 1-3 and the switch of step 5): the track drawn every frame with WebGL2,
// in the baked pictures' manner. The scene goes into a low-resolution picture with three layers (colour, which thing and
// part each pixel shows, depth); the light is the baked renderer's, stepped (a warm sun, sky from above, the ground's
// warmth from below, metal and glass mirroring sky, horizon and ground, paint's highlight in two steps), with real shadows
// from a shadow map; then a pass draws the dark outline round each thing and the thin lines between its parts from those
// layers, as the baked pictures have them. A car something stands before shows its light outline over just the hidden
// part. The picture is enlarged by whole pixels on the page.
import { freeGpu, gpuMesh, program, placeMesh, mul, translate, rot, scale, ATTR, styleUp, styleLines, type GpuMesh, type M4 } from './gpu';
import { STYLE, lineWeight, screenPx, makeAtlas, type Atlas } from './style';
import { RIG_BONES, poseRig } from '../car/suspension';
import { ENGINE_BONES, poseInternals } from '../car/powertrain/internals';
import { DIAL_BONES, poseDials } from '../car/interior/gauges';
/** the bones the shaders hold: a suspension's or an engine's insides, whichever needs more (three rows each; with the
 *  tyres' 32 and the four matrices about 220 of the 256 vertex rows WebGL2 promises) */
export const BONE_SLOTS = Math.max(RIG_BONES, ENGINE_BONES, DIAL_BONES);
/** a rotation (three rows) as a matrix */
const m4of = (R: number[][]): M4 => { const m = new Float32Array(16); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) m[c * 4 + r] = R[r]![c]!; m[15] = 1; return m; };
import type { GroundData } from './ground';
import { Woods } from './woods';
import { staticChunks } from './scenerylayer';
import type { Scenery } from '../../race/scenery';
import type { Mesh } from '../car/mesh';
import type { VolumeSmoke } from './volume/volume';

export interface LiveView { x: number; y: number; z: number; /** the world heading that points up the screen */ ang: number; pitch: number; mm: number; W: number; H: number; /** the target's height on the screen (0 top .. 1 bottom) */ cy: number;
  /** a perspective camera instead (the drive's chase, bonnet and cabin views): the eye, the vertical field of view (degrees), the
   *  near plane (m); turned by ang and tilted by pitch as the orthographic one, x, y, z then only where the shadows and the props gather */
  eye?: [number, number, number]; fov?: number; near?: number }
/** a tyre's shape this moment (review 101): its ring's give at 32 angles from straight down toward the front (m), the patch's shift (m, along and across) */
export interface LiveTyre { u: Float32Array; sx: number; sy: number }
export interface LiveCar { /** age: rust, fading, dirt (0..1) (review 104) */ wear?: [number, number, number]; /** FL FR RL RR */ tyres?: LiveTyre[]; g: GpuMesh; x: number; y: number; z: number; yaw: number; roll: number; pitch: number; /** each front wheel's own angle (rad, left +): the inner one more */ steerL: number; steerR: number; spin: number; player: boolean; /** head lamps alight 0..1, brakes on (review 117) */ lamps?: number; brake?: boolean; /** the crank's angle (degrees, 0..720): an engine's insides posed (the workshop's cutaway) */ crank?: number; /** each wheel's rise against the body (m) and lean (rad, top to the left +): the suspension's travel (review 120) */ travel?: number[]; camber?: number[]; /** a cabin's readings, in its rig's order (render/car/interior/gauges.ts stepDials); none: the needles at rest */ dials?: ArrayLike<number> | null }
export interface LiveProp { g: GpuMesh; x: number; y: number; z: number; h: number; /** its own placing (else by x, y, z, h), its outline's width, a name to follow it frame to frame (a moving piece) */ m?: M4; outline?: number; key?: string }
/** the drift-game style's switches (look 4, docs/systems/109 §5): the inverted hull's outline and the drawn lines
 *  (default on), the outline pass filling the gaps (default on); their widths (px at 1080 high: STYLE), the picture's
 *  device pixel ratio, the ink; the atlas (default on) */
export interface LiveStyle { outline?: boolean; lines?: boolean; post?: boolean; outPx?: number; linePx?: number; dpr?: number; ink?: [number, number, number]; atlas?: boolean }
export interface Skid { x: number; y: number; z: number; a: number }
/** a scene's set pieces off the renderer (LiveRenderer.takeScene): opaque to the screens that keep it */
export interface LiveScene { readonly ground: [WebGLVertexArrayObject | null, number]; readonly fence: [WebGLVertexArrayObject | null, number]; readonly track: { len: number; w: number; joint: number; start: number };
  readonly line: WebGLTexture | null; readonly gTex: unknown; readonly bTex: unknown; readonly props: Map<string, number>; readonly layer?: unknown }

const SUN_W = (() => { const v = [-0.45, 0.35, 0.82], l = Math.hypot(...v); return v.map(c => c / l) as [number, number, number]; })();   // toward the sun, world axes: from the upper left of the default view
const LIGHT = `
const vec3 SUN_C = vec3(1.0, 0.95, 0.84), SKY_C = vec3(0.6, 0.68, 0.82), GROUND_C = vec3(0.5, 0.45, 0.36);
const vec3 ENV_TOP = vec3(150., 176., 214.) / 255., ENV_HOR = vec3(236., 233., 224.) / 255., ENV_GROUND = vec3(92., 88., 68.) / 255.;
vec3 envAt(float rz) { if (rz < -0.06) return ENV_GROUND; if (rz < 0.22) return ENV_HOR; float t = min(1., (rz - 0.22) / 0.6); return mix(ENV_HOR, ENV_TOP, t); }
uniform highp sampler2DShadow uShadow; uniform mat4 uLight;
uniform int uLook;   // 0: the baked pictures' stepped light; 1: physically based, its brightness stepped; 2: physically based, smooth; 3: toon (review 92)
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
/* the photographed sky (review 124): a CC0 HDRI, four levels by roughness, RGBM; and its light on a surface as nine
   spherical-harmonic numbers per colour. Off (uSkyOn 0) the drawn sky below stands in */
uniform highp sampler2DArray uSky; uniform int uSkyOn; uniform float uSkyR; uniform vec3 uSH[9];
vec3 skyTex(vec3 r, float rough) { vec2 uv = vec2(atan(r.y, r.x) / 6.2831853 + 0.5, acos(clamp(r.z, -1., 1.)) / 3.14159265);
  float lv = rough < 0.25 ? rough / 0.25 : rough < 0.5 ? 1. + (rough - 0.25) / 0.25 : 2. + min(1., (rough - 0.5) / 0.3); int l0 = int(floor(lv)), l1 = min(3, l0 + 1);
  vec4 a = texture(uSky, vec3(uv, float(l0))), b = texture(uSky, vec3(uv, float(l1))); vec3 ca = a.rgb * a.rgb * a.a * uSkyR, cb = b.rgb * b.rgb * b.a * uSkyR; return mix(ca, cb, fract(lv)); }
vec3 shIrr(vec3 n) { float x = n.x, y = n.y, z = n.z; vec3 e = 3.14159265 * 0.282095 * uSH[0] + 2.0943951 * 0.488603 * (uSH[1] * y + uSH[2] * z + uSH[3] * x)
    + 0.785398 * (1.092548 * (uSH[4] * x * y + uSH[5] * y * z + uSH[7] * x * z) + 0.315392 * uSH[6] * (3. * z * z - 1.) + 0.546274 * uSH[8] * (x * x - y * y)); return max(e, vec3(0.)) / 3.14159265; }
vec3 skyR(vec3 r, float rough) { if (uSkyOn == 1) return (0.025 + 0.975 * uDay) * mix(vec3(0.75, 0.82, 1.), vec3(1.), uDay) * skyTex(r, rough);
  float z = r.z, soft = 0.02 + rough * 0.5;
  vec3 field = toLin(vec3(96., 104., 74.) / 255.), far = toLin(vec3(58., 66., 50.) / 255.), haze = toLin(vec3(222., 224., 220.) / 255.), top = toLin(vec3(120., 152., 200.) / 255.);
  vec3 sky = mix(haze, top, smoothstep(0.02, 0.7, z));
  float cl = vL(r.xy / (z + 0.12) * 1.7) * 0.6 + vL(r.xy / (z + 0.12) * 4.3 + 7.) * 0.4; cl = smoothstep(0.5, 0.78, cl) * smoothstep(0.03, 0.3, z) * (1. - smoothstep(0.05, 0.45, rough));
  sky = mix(sky, toLin(vec3(248., 246., 240.) / 255.) * 1.15, cl * 0.8);
  vec2 hd = r.xy / max(1e-3, length(r.xy)); float tree = 0.03 + 0.045 * vL(hd * 3.5 + 1.) + 0.025 * vL(hd * 14. + 5.);   /* the treeline's height, by bearing */
  vec3 low = mix(far, field, smoothstep(0., 0.35, -z));
  vec3 c = mix(low, sky, smoothstep(tree - soft, tree + soft, z));
  return (0.025 + 0.975 * uDay) * mix(vec3(0.75, 0.82, 1.), vec3(1.), uDay) * mix(c, mix(field, sky, smoothstep(-0.3, 0.5, z)), smoothstep(0.1, 0.6, rough)); }
vec3 irradiance(vec3 n) { if (uSkyOn == 1) return (0.025 + 0.975 * uDay) * (1.3 - 0.3 * uLightK) * shIrr(n); return (0.025 + 0.975 * uDay) * (1.3 - 0.3 * uLightK) * mix(toLin(ENV_GROUND), toLin(mix(ENV_HOR, ENV_TOP, 0.55)), 0.5 + 0.5 * n.z); }
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
  if (coat > 0.) { float Fc = (0.05 + 0.95 * pow(1. - nv, 5.)) * coat; col = col * (1. - Fc) + skyR(r, 0.05) * Fc * (0.85 + 0.45 * uSpecK) * mix(1., ao, 0.7)
      + (D_GGX(nh, 0.035) * V_Smith(nv, nl, 0.035) * 0.1 + D_GGX(nh, 0.2) * V_Smith(nv, nl, 0.2) * 0.06) * coat * uSpecK * SUN_E * nl * sh; }   /* the lacquer: a sharp glint and a broad sheen (review 111); a clearer mirror, sky a touch soft so its clouds don't break up the panels (review 132) */
  return col; }
// ---- PBR detail textures (review 103): seven layers (concrete, grass, metal, rubber, leather, canvas, wood), each a
// tile of known size; the albedo used for its light and dark only (the game keeps its colours), roughness and normals ----
uniform highp sampler2DArray uAlb, uNor, uRgh, uHiAlb, uHiNor; uniform int uTex, uHi; uniform int uHiIdx[7]; uniform float uTSize[7], uTLuma[7], uTRough[7];   /* uHi: the high-resolution layers (2K/4K) for some materials (review 114) */
struct Detail { float tone; float rough; vec3 n; };
/** a layer laid three ways (by the normal's main axes) at point p (m), on normal n: its tone, roughness offset, bent normal */
Detail detail(int L, vec3 p, vec3 n, float sa, float sn, float sr) { sa = max(sa, 0.12 * (uTexK - 1.)) * uTexK; sn *= uTexK; sr *= uTexK; Detail d; d.tone = 1.; d.rough = 0.; d.n = n; if (uTex == 0 || L < 0 || uLook == 3) return d;   /* toon: flat colour, no photographed grain */
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
/* ---- the toon look (review 92, items 1 and 2): uLook 3. The light in two or three flat bands of N·L (the cast shadow
   and the cars' occlusion folded in), each edge about a pixel soft; the shade not grey but the colour turned cooler
   (red to purple, yellow to orange, green to teal, grey to blue-grey), deeper and a little more saturated; no mirrors,
   no filmic curve: the colour is written as it is meant to be seen. uToonB: the bands (2 or 3); uToonS: how far the
   shade's hue moves (0: plain darker) ---- */
uniform float uToonB, uToonS;
vec3 rgb2hsv(vec3 c) { vec4 K = vec4(0., -1. / 3., 2. / 3., -1.), p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g)), q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); return vec3(abs(q.z + (q.w - q.y) / (6. * d + 1e-10)), d / (q.x + 1e-10), q.x); }
vec3 hsv2rgb(vec3 c) { vec3 p = abs(fract(c.xxx + vec3(1., 2. / 3., 1. / 3.)) * 6. - 3.); return c.z * mix(vec3(1.), clamp(p - 1., 0., 1.), c.y); }
/** a colour's shade at brightness dark: its hue turned toward blue-violet by the short way round, a grey given a blue cast */
vec3 toonShadeOf(vec3 c, float dark) { vec3 h = rgb2hsv(clamp(c, 0., 1.)); float d = 0.69 - h.x; d -= floor(d + 0.5);
  float hx = fract(h.x + clamp(d * 0.32, -0.1, 0.1) * uToonS), ws = smoothstep(0.25, 0.5, h.y); hx = mix(0.61, hx, ws);   /* the dull colours (concrete, earth, grey) all to blue-grey */
  vec3 s = hsv2rgb(vec3(hx, clamp(mix(0.2 + 0.1 * h.y, h.y * (1. + 0.25 * uToonS), ws) * min(1., uToonS + 0.2), 0., 1.), h.z * dark * (1. - 0.06 * uToonS)));
  s *= mix(vec3(1.), vec3(0.9, 0.93, 1.08), min(1., uToonS));   /* a cool cast over all the shade */
  return mix(c * dark, s, clamp(uToonS, 0., 1.)); }
/** a value to a few levels, each step about a pixel soft */
float poster(float x, float lv) { float y = x * lv, w = clamp(fwidth(y) * 0.7, 0.03, 0.5); return (floor(y) + smoothstep(0.5 - w, 0.5 + w, fract(y))) / lv; }
/** a photographed colour flattened: its brightness to a few levels, its hue kept */
vec3 posterC(vec3 c, float lv) { float L = max(1e-3, dot(c, vec3(0.3, 0.59, 0.11))); return c * mix(1., poster(L, lv) / L, 0.8); }
/** the light's strength t (0..1) to a band: 0 the shade, (0.5 the middle,) 1 the light */
float toonBand(float t) { float w = clamp(fwidth(t) * 0.8, 0.008, 0.12);
  if (uToonB < 2.5) return smoothstep(0.16 - w, 0.16 + w, t);
  return 0.5 * smoothstep(0.1 - w, 0.1 + w, t) + 0.5 * smoothstep(0.5 - w, 0.5 + w, t); }
/** a surface of colour c (sRGB) at p facing n, in bands: the sun's colour by the time of day, the head lamps' light added */
vec3 toonLight(vec3 c, vec3 n, vec3 l, float sh, float ao, vec3 p) {
  float b = toonBand(max(0., dot(n, l)) * sh * smoothstep(0.3, 0.65, ao));
  vec3 sunT = mix(vec3(1., 0.62, 0.42), vec3(1., 0.98, 0.94), smoothstep(0.2, 0.8, uDay)), lit = c * sunT * (0.2 + 0.8 * uDay) * (0.9 + 0.1 * uLightK);
  vec3 shade = toonShadeOf(c, 0.6) * (0.14 + 0.86 * uDay), mid = mix(shade, lit, 0.7);
  vec3 col = uToonB < 2.5 ? mix(shade, lit, b) : b < 0.5 ? mix(shade, mid, b * 2.) : mix(mid, lit, b * 2. - 1.);
  return col + c * min(vec3(1.), lampsAt(p, n) * 0.12); }
/** bright metal as a two-tone ramp: the sky above the mirrored horizon, the ground under it, a dark line between, the sun a white spot */
vec3 toonChrome(vec3 base, vec3 n, vec3 v, vec3 l, float sh) { vec3 r = reflect(-v, n); float w = clamp(fwidth(r.z), 0.004, 0.1);
  vec3 tint = mix(vec3(1.), base / max(1e-3, max(base.r, max(base.g, base.b))), 0.3), hi = vec3(0.84, 0.91, 1.) * tint, lo = vec3(0.42, 0.37, 0.32) * tint;
  vec3 c = mix(lo, hi, smoothstep(0.04 - w, 0.04 + w, r.z)); c *= 1. - 0.5 * (smoothstep(-0.06 - w, -0.06 + w, r.z) - smoothstep(0.04 - w, 0.04 + w, r.z));
  float nh = dot(n, normalize(l + v)), wh = clamp(fwidth(nh), 0.002, 0.05); c = mix(c, vec3(1.), smoothstep(0.975 - wh, 0.975 + wh, nh) * step(0.5, sh));
  return c * (0.15 + 0.85 * uDay); }
/** gloss as one or two crisp white shapes: the sun's spot, and a streak where the body's shoulder mirrors the sky just over the horizon on the sun's side */
float toonGloss(vec3 n, vec3 v, vec3 l, float sh, float g) { float nh = dot(n, normalize(l + v)), w = clamp(fwidth(nh), 0.002, 0.05), e = 0.9975 - 0.004 * g;
  float spot = smoothstep(e - w, e + w, nh) * step(0.5, sh);
  vec3 r = reflect(-v, n); float wz = clamp(fwidth(r.z), 0.003, 0.06), side = smoothstep(-0.25, 0.1, dot(normalize(r.xy + 1e-5), normalize(l.xy)));
  float streak = smoothstep(0.1 - wz, 0.1 + wz, r.z) * (1. - smoothstep(0.19 - wz, 0.19 + wz, r.z)) * side * step(0.35, g);
  return max(spot, streak * 0.9) * (0.2 + 0.8 * uDay); }
/** the cars' rim light: a sky-blue band where the surface turns away from the eye, most along the top */
vec3 toonRim(vec3 c, vec3 n, vec3 v) { float nv = dot(n, v), w = clamp(fwidth(nv), 0.005, 0.1), rim = 1. - smoothstep(0.3 - w, 0.3 + w, nv);
  return mix(c, vec3(0.62, 0.82, 1.) * (0.25 + 0.75 * uDay), rim * (0.35 + 0.3 * smoothstep(-0.3, 0.6, n.z))); }
`;
const OBJ_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec3 aCol; layout(location=3) in float aGloss; layout(location=4) in float aKind; layout(location=5) in float aPart; layout(location=6) in vec3 aSmo; layout(location=7) in vec4 aLamp; layout(location=8) in vec3 aLAx; layout(location=9) in vec3 aLRt; layout(location=10) in float aBone; out vec4 vLamp; flat out vec3 vLAx, vLRt, vLUp;
/* the drift-game style's layers (look 4, docs/systems/109 §5): the inverted hull's normal and the part's share of the outline; the normal smoothed per surface; the atlas's coordinates. uHull: the hull's width (px; 0: an ordinary draw), uVpx the picture's size */
layout(location=11) in vec4 aHull; layout(location=12) in vec3 aSurf; layout(location=13) in vec3 aAtl; uniform float uHull; uniform vec2 uVpx; out vec3 vFS, vAtl; flat out float vHS;
uniform mat4 uVP, uModel, uPrevVP, uPrevModel; uniform float uBias; out vec3 vSN;   // the smoothed normal (review 116; none where a piece has no such layer)
out vec4 vCur, vPrev;   // where this point is now and was a frame ago (the velocity layer, review 112)
uniform int uWheel; uniform float uSpin, uDef[32], uTyreR, uRim; uniform vec2 uShift; uniform vec4 uBone[${BONE_SLOTS * 3}];   // the suspension's or the engine's bones (uWheel 2): three rows each
out vec3 vWorld, vObj; flat out vec3 vN, vObjN, vCol; flat out float vGloss, vKind, vPart;
void main() { vec3 p = aPos, nr = aNor, ns = dot(aSmo, aSmo) > 0.25 ? aSmo : aNor, hn = aHull.xyz, sf = aSurf;
  if (uWheel == 1) {
    if (int(aKind + 0.5) == 5) {   // the tyre, shaped by its ring in the hub's frame (the ring keeps to the road; it does not turn with the wheel)
      float rho = length(p.xz), t = clamp((rho - uRim) / max(1., uTyreR - uRim), 0., 1.), a = atan(-p.x, -p.z);
      float fi = mod(a / 6.2831853 * 32. + 32., 32.); int i0 = int(floor(fi)); float d = mix(uDef[i0], uDef[(i0 + 1) % 32], fract(fi)) * t;
      vec2 dir = p.xz / max(rho, 1.); float low = max(0., dir.y * -1.); low *= low;
      p.xz -= dir * d; p.y += sign(p.y) * d * 0.5 * (1. - abs(2. * t - 1.));   // the tread pressed in, the walls bulging out beside it
      p.y += uShift.y * t * low; p.x -= uShift.x * t * low; }   // the patch pulled across and along by the forces
    else { float c = cos(uSpin), s = sin(uSpin); p = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z); nr = vec3(c * nr.x - s * nr.z, nr.y, s * nr.x + c * nr.z); ns = vec3(c * ns.x - s * ns.z, ns.y, s * ns.x + c * ns.z); hn = vec3(c * hn.x - s * hn.z, hn.y, s * hn.x + c * hn.z); sf = vec3(c * sf.x - s * sf.z, sf.y, s * sf.x + c * sf.z); } }
  if (uWheel == 2) { int b = int(aBone + 0.5) * 3; vec4 q = vec4(p, 1.); vec3 r0 = uBone[b].xyz, r1 = uBone[b + 1].xyz, r2 = uBone[b + 2].xyz;   // a suspension part carried by its bone
    p = vec3(dot(uBone[b], q), dot(uBone[b + 1], q), dot(uBone[b + 2], q)); nr = normalize(vec3(dot(r0, nr), dot(r1, nr), dot(r2, nr))); ns = normalize(vec3(dot(r0, ns), dot(r1, ns), dot(r2, ns))); hn = vec3(dot(r0, hn), dot(r1, hn), dot(r2, hn)); sf = vec3(dot(r0, sf), dot(r1, sf), dot(r2, sf)); }
  vec4 w = uModel * vec4(p, 1.); vWorld = w.xyz; vObj = p; vObjN = nr; vN = normalize(mat3(uModel) * nr); vSN = mat3(uModel) * ns; vLamp = aLamp; vLAx = normalize(mat3(uModel) * aLAx + 1e-9); vLRt = normalize(mat3(uModel) * aLRt + 1e-9); vLUp = normalize(mat3(uModel) * cross(aLAx, aLRt) + 1e-9); vCol = aCol; vGloss = aGloss; vKind = aKind; vPart = aPart;
  vFS = mat3(uModel) * sf; vAtl = aAtl; vHS = aHull.w;
  gl_Position = uVP * w; vCur = gl_Position; vPrev = uPrevVP * (uPrevModel * vec4(p, 1.));
  /* the inverted hull (look 4): each corner pushed out along its hull normal by uHull pixels times its part's share, the
     push measured on the screen (the normal's way there, normalised), so the outline keeps its width near and far */
  if (uHull > 0.) { vec3 hw = mat3(uModel) * hn; if (dot(hw, hw) > 1e-12 && aHull.w > 0.) { vec4 c1 = uVP * vec4(w.xyz + normalize(hw) * 0.05, 1.); vec2 d = (c1.xy / c1.w - gl_Position.xy / gl_Position.w) * uVpx; float L = length(d);
    if (L > 1e-5) gl_Position.xy += d / L * uHull * aHull.w * 2. / uVpx * gl_Position.w; } }
  gl_Position.z -= uBias * gl_Position.w; }`;
const OBJ_FS = `#version 300 es
precision highp float;
${LIGHT}
in vec3 vWorld, vObj, vSN; in vec4 vLamp; flat in vec3 vLAx, vLRt, vLUp; flat in vec3 vN, vObjN, vCol; flat in float vGloss, vKind, vPart;
uniform mat4 uModel; uniform vec3 uEyeD, uSun; uniform vec4 uCamP; vec3 uEye;   /* toward the eye: one direction for the orthographic camera, from each point for the perspective one (set first in main) */
 uniform vec2 uObj; uniform vec3 uWear; uniform float uObjZ, uCarH;
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
vec3 rustAt(float t) { vec3 R[6] = vec3[6](vec3(184, 104, 46), vec3(156, 80, 34), vec3(126, 60, 26), vec3(92, 42, 20), vec3(60, 30, 16), vec3(40, 21, 12)); float k = clamp(t, 0., 1.) * 4.999; int i = int(k); return mix(R[i], R[min(5, i + 1)], fract(k)) / 255.; } uniform float uOutline; uniform int uMode; uniform vec4 uSil; uniform float uGlass, uGlassR, uCarL;
uniform int uDecN; uniform vec3 uDecO[4], uDecN_[4], uDecUp[4]; uniform float uDecR[4]; uniform sampler2D uDecTex;
layout(location=0) out vec4 oCol; layout(location=1) out vec4 oId; layout(location=2) out vec4 oN; layout(location=3) out vec4 oV; in vec4 vCur, vPrev; uniform vec2 uSize;
vec4 velo() { vec2 d = (vCur.xy / vCur.w - vPrev.xy / vPrev.w) * 0.5 * uSize; return vec4(clamp(d / 128. + 0.5, 0., 1.), 0., 1.); }   /* pixels moved since the last frame, packed */   // oN: the normal and how mirror-like (for the traced reflections)
/* ---- the buildings' photographed materials (review 148, Poly Haven CC0): kinds 11.. (brick, painted boards, bare timber,
   corrugated iron, clay tiles, slates, render, concrete, sheet metal), each a tile of known size laid on a face by the
   face's own axes (level along it, and up it: courses lie level on a wall, tiles and corrugations run up a roof's
   slope), so the meshes need no picture coordinates. The picture gives the pattern about its mean colour; the face
   keeps the colour the building was given. Normal (GL), occlusion (red) and roughness (green) as photographed ---- */
uniform highp sampler2DArray uBAlb, uBNor, uBPack; uniform int uBTex; uniform float uBSize[9]; uniform vec3 uBMean[9];
uniform float uLampOn, uBrake;   // this car's lamps alight, its brakes on (review 117)
uniform int uIsCar;   // a car's piece (the toon look's rim light)
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
/** a lamp in the toon look: a flat pale (or red) face, a darker ring at the rim, one round white glint; alight, near white */
vec3 toonLamp(vec2 uv, float flag) { float r = length(uv), w = clamp(fwidth(r), 0.01, 0.2), glow = flag < 1.5 ? uLampOn : max(uLampOn * 0.35, uBrake);
  vec3 c = mix(flag < 1.5 ? vec3(0.74, 0.8, 0.86) * (0.3 + 0.7 * uDay) : vec3(0.6, 0.07, 0.06) * (0.35 + 0.65 * uDay), flag < 1.5 ? vec3(1., 0.97, 0.84) : vec3(1., 0.32, 0.22), glow);
  c *= 1. - 0.3 * smoothstep(0.82 - w, 0.82 + w, r); float g = length(uv - vec2(-0.3, 0.34)); return mix(c, vec3(1.), 1. - smoothstep(0.17 - w, 0.17 + w, g)); }
/* ---- the drift-game style (look 4: the toon look's ground and props, these on the cars; docs/systems/109 §5): two bands
   of light with a soft edge between them, the shade the colour a little darker and bluer, one small crisp highlight
   and no mirrored world on the paint; the normals smoothed per surface and split at the creases (vFS, render/car/edges.ts);
   lamps, grilles and other painted detail from one atlas (render/live/style.ts); the outline an inverted hull (uMode 3)
   and the panel lines ribbons drawn after (LINE_VS) ---- */
in vec3 vFS, vAtl; flat in float vHS; uniform int uFR, uSeamOff, uAtlOn; uniform sampler2D uAtlas; uniform vec4 uAtl[7]; uniform vec3 uInk;
/** a corner's atlas coordinates (u, v repeating over the cell, the cell + 1) to its picture; nothing where there is none */
vec4 atlasAt(vec3 a) { if (uAtlOn == 0 || a.z < 0.5) return vec4(0.); int i = clamp(int(a.z + 0.5) - 1, 0, 6); vec4 r = uAtl[i]; return texture(uAtlas, r.xy + (0.004 + fract(a.xy) * 0.992) * r.zw); }
vec3 frLight(vec3 c, vec3 n, vec3 l, float sh, float ao, vec3 p) { float t = max(0., dot(n, l)) * sh * smoothstep(0.3, 0.65, ao), w = clamp(fwidth(t), 0.004, 0.08) + 0.035, b = smoothstep(0.13 - w, 0.13 + w, t);
  vec3 sunT = mix(vec3(1., 0.62, 0.42), vec3(1., 0.985, 0.95), smoothstep(0.2, 0.8, uDay)), lit = c * sunT * (0.2 + 0.8 * uDay) * (0.94 + 0.06 * uLightK);
  vec3 shade = (c * vec3(0.6, 0.63, 0.76) + vec3(0.01, 0.014, 0.03)) * (0.14 + 0.86 * uDay);   /* darker, a little bluer; a black part a dark blue-grey */
  return mix(shade, lit, b) + c * min(vec3(1.), lampsAt(p, n) * 0.12); }
/** the machinery's plain parts (look 4, docs/systems/109 section 10): a third, brighter band where the light falls square, and a soft pale edge where a face turns away from the eye, so a big flat face is not one tone */
vec3 frLight3(vec3 c, vec3 n, vec3 l, vec3 v, float sh, float ao, vec3 p) { vec3 col = frLight(c, n, l, sh, ao, p); float t = max(0., dot(n, l)) * sh, w = clamp(fwidth(t), 0.004, 0.08) + 0.03, hi = smoothstep(0.74 - w, 0.74 + w, t);
  float rim = (1. - smoothstep(0.12, 0.42, abs(dot(n, v)))) * (0.45 + 0.55 * clamp(n.z, 0., 1.)); return col * (1. + 0.14 * hi) + (c * 0.45 + 0.1) * 0.3 * rim * (0.2 + 0.8 * uDay); }
/** the one highlight: a small round spot where the sun mirrors, its edge a pixel */
float frGloss(vec3 n, vec3 v, vec3 l, float sh, float g) { float nh = dot(n, normalize(l + v)), w = clamp(fwidth(nh), 0.001, 0.03), e = 0.9994 - 0.0008 * g; return smoothstep(e - w, e + w, nh) * step(0.5, sh) * (0.2 + 0.8 * uDay); }
/** a lamp from the atlas (its face's own coordinates -1..1), lit when alight; the toon lamp where the atlas is off */
vec3 frLamp(vec2 uv, float flag) { if (uAtlOn == 0) return toonLamp(uv, flag); vec4 a = atlasAt(vec3(uv * 0.5 + 0.5, flag < 1.5 ? 1. : 2.)); float glow = flag < 1.5 ? uLampOn : max(uLampOn * 0.35, uBrake);
  vec3 c = a.a > 0.5 ? a.rgb * (0.35 + 0.65 * uDay) : toonLamp(uv, flag); return mix(c, flag < 1.5 ? vec3(1., 0.97, 0.86) : vec3(1., 0.3, 0.2), glow * 0.85); }
void main() { uEye = uCamP.w > 0.5 ? normalize(uCamP.xyz - vWorld) : uEyeD;
  if (uMode == 1) { oCol = uSil; oId = vec4(0.); oN = vec4(0.); oV = velo(); return; }
  if (uMode == 3) { oCol = vec4(uInk, 1.); oId = vec4(uObj, vPart / 255., 1.); oN = vec4(0.5, 0.5, 1., 0.); oV = velo(); return; }   /* the hull: ink, marked (alpha 1) so the outline pass leaves it be */
  if (uFR == 1 && uSeamOff == 1 && vHS < -0.5) discard;   /* the raised seam strips: the drawn lines stand in for them */
  vec3 n = vN; if (dot(n, uEye) < 0.) n = -n;
  vec3 base = vCol; int kind = int(vKind + 0.5);
  float sh = lightAt(vWorld);
  float d = max(0., dot(n, uSun)) * sh, up = 0.5 + 0.5 * n.z;
  float ne = dot(n, uEye), rz = 2. * ne * n.z - uEye.z;
  if (uMode == 2) {   // glass: mirrors more at a glancing angle, laid over at its own strength
    if (uLook == 3) {   /* toon glass (docs/systems/104 part A): a dark tint, clear head-on, over a drawn sky it mirrors. The reflected
         ray's height, tilted across the pane by its own normal (a windscreen near level, a side window aslant) and bent a
         little by the pane's height on the car, cut in three steps: the ground's dark, a white band just over the horizon,
         the sky's blue; the edges a pixel or two. The steps slide over the glass as the car or the eye moves. Fresnel for
         their strength, a small sun glint; uGlassR the setting (0 off). render/live/glassband.ts is the same in numbers */
      if (kind == 4) discard;
      if (vLamp.z > 0.5) { oCol = vec4(uFR == 1 ? frLamp(vLamp.xy, vLamp.z) : toonLamp(vLamp.xy, vLamp.z), 1.); oId = vec4(0.); oN = vec4(0.); oV = velo(); return; }
      vec3 sn = normalize(vSN); if (dot(sn, uEye) < 0.) sn = -sn; if (dot(sn, n) < 0.3) sn = n;   /* the smoothed normal: a curved pane's reflection bends over it */
      vec3 no = normalize(vObjN); if (dot(mat3(uModel) * no, uEye) < 0.) no = -no;
      vec3 R = reflect(-uEye, sn), tw = length(sn.xy) < 1e-4 ? vec3(1., 0., 0.) : normalize(vec3(-sn.y, sn.x, 0.)), to = length(no.xy) < 1e-4 ? vec3(1., 0., 0.) : normalize(vec3(-no.y, no.x, 0.));
      float sl = 0.8 * (1. - smoothstep(0.3, 0.7, abs(no.z))), bend = uIsCar == 1 ? 2.2 * (vObj.z / 1000. / max(0.8, uCarH) - 0.95) : 0.;
      vec3 pc = vObj - vec3(uIsCar == 1 ? uCarL * 0.5 : 0., 0., 0.);   /* from the car's middle (its x starts at the tail) */
      float e = R.z + 0.35 * sl * dot(R, tw) + bend + sl * dot(pc, to) / 1000., we = clamp(fwidth(e) * 0.75, 1e-4, 0.1);
      float up = smoothstep(-we, we, e), sky = smoothstep(0.12 - we, 0.12 + we, e), g = 1. - clamp(dot(sn, uEye), 0., 1.), fres = 0.04 + 0.96 * g * g * sqrt(g), lit = 0.25 + 0.75 * uDay;   /* a narrow band; fresnel falling off hard toward head-on */
      float clear = vGloss < 0.5 ? max(0.25, vGloss * 2.) : 1., A0 = clamp(0.3 + 0.62 * uGlass, 0., 1.) * clear * (0.45 + 0.55 * smoothstep(0.1, 0.8, g));
      vec3 c = mix(mix(vec3(0.16, 0.17, 0.19), vec3(0.86, 0.89, 0.93) * lit, up), vec3(0.55, 0.72, 0.92) * lit, sky);
      float ar = mix(mix(0.5 * fres, 0.25 + 0.5 * fres, up), 0.03 + 0.62 * fres, sky) * clamp(uGlassR, 0., 1.);   /* the band a little dimmer, the sky and the ground little head-on */
      float rs = dot(R, uSun), ws = clamp(fwidth(rs), 1e-4, 0.01), sun = smoothstep(0.996 - ws, 0.996 + ws, rs) * sh * clamp(uGlassR * 2., 0., 1.) * uDay;
      vec3 rgb = c * ar + vec3(0.12, 0.16, 0.24) * (0.3 + 0.7 * uDay) * A0 * (1. - ar); float A = ar + A0 * (1. - ar);
      oCol = vec4(mix(rgb, vec3(1.), sun), mix(A, 1., sun)); oId = vec4(0.); oN = vec4(0.); oV = velo(); return; }
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
      float clear = vGloss < 0.5 ? max(0.25, vGloss * 2.) : 1.;   /* review 154: a glass part given gloss under 0.5 is a clearer pane (an engine's cover) */
      float absorb = kind == 4 ? 0.55 : uGlass * clear * (0.3 + 0.4 * edge) + dust * 0.1;
      vec3 rgb = (mir + SUN_E * glint) * F + tint * (1. - F); float A = clamp(F + absorb * (1. - F), 0., 1.);
      oCol = vec4(present(rgb / max(A, 1e-3)) * A, A); oId = vec4(0.); oN = vec4(0.); oV = velo(); return; }
    float F = 0.06 + 0.94 * pow(1. - abs(ne), 4.); vec3 env = envAt(rz), tint = kind == 4 ? base : vec3(150., 172., 182.) / 255.;
    float k = 0.62 + 0.45 * d + (n.z > 0.3 ? 0.1 : 0.); vec3 c = tint * (1. - 0.55 * (0.4 + F)) + env / k * 0.55 * (0.4 + F);
    vec3 hg = normalize(uSun + uEye); float glint = D_GGX(max(0., dot(n, hg)), 0.03) * 0.04 * max(0., dot(n, uSun)) * sh * uSpecK;   /* the sun caught in the glass */
    float gC = kind == 4 || vGloss >= 0.5 ? 1. : max(0.25, vGloss * 2.), gA = min(1., (kind == 4 ? uGlass + 0.15 : uGlass * gC) + (1. - uGlass * gC) * F * 0.7); oCol = vec4((uHDRo == 1 ? toLin(min(vec3(1.), c * k)) * (1. + 2.5 * F) + SUN_E * glint * 0.6 : min(vec3(1.), c * k)) * gA, gA);   /* premultiplied */ oId = vec4(0.); oN = vec4(0.); oV = velo(); return; }
  if (kind == 1 && uDecN > 0) for (int i = 0; i < 4; i++) { if (i >= uDecN) break;
    vec3 dd = vObj - uDecO[i]; float depth = dot(dd, uDecN_[i]); if (abs(depth) > uDecR[i] * 0.8 || abs(dot(vObjN, uDecN_[i])) < 0.45) continue;
    vec3 rt = normalize(cross(uDecN_[i], uDecUp[i])); vec2 uv = vec2(dot(dd, rt), dot(dd, uDecUp[i])) / uDecR[i] * 0.5 + 0.5; if (any(lessThan(uv, vec2(0.))) || any(greaterThan(uv, vec2(1.)))) continue;
    vec4 t = texture(uDecTex, vec2((float(i) + uv.x) / 4., uv.y)); if (t.a > 0.5) base = t.rgb; }
  if (uLook > 0) {   // the physically based looks: each kind of material its metalness and roughness
    if (kind >= 11 && uBTex == 1) { int L = min(kind - 11, 8); vec3 no = normalize(vObjN); if (dot(mat3(uModel) * no, uEye) < 0.) no = -no;
      float hl = length(no.xy); vec3 T = hl > 0.08 ? vec3(-no.y, no.x, 0.) / hl : vec3(1., 0., 0.), B = hl > 0.08 ? cross(no, T) : vec3(0., 1., 0.);   /* level along the face, and up it */
      vec3 P = vObj / 1000., q = vec3(dot(P, T) / uBSize[L], -dot(P, B) / uBSize[L], float(L));
      float tb = uLook == 3 ? 1.5 : 0.;   /* toon: the photograph softened, so its pattern reads as shapes, not grain */
      vec3 a = texture(uBAlb, q, tb).rgb, tn = texture(uBNor, q, tb).xyz * 2. - 1., pk = texture(uBPack, q).rgb;
      base = vCol * clamp(a / uBMean[L], 0., 2.5) * (0.93 + 0.14 * vnoise(P * 0.6 + 3.));   /* and a broad unevenness, so a long wall is not one tile repeated */
      if (uLook == 3) { vec3 rr = clamp(a / uBMean[L], 0., 2.5); float lr = dot(rr, vec3(0.3, 0.59, 0.11)); base = vCol * mix(vec3(1.), rr / max(lr, 1e-3), 0.5) * mix(1., poster(lr * 0.5, 8.) * 2., 0.7); tn.xy *= 0.3; }   /* its tones to steps of a quarter, its relief shallow */
      if (L == 3) tn.xy *= mix(0.35, 2.5, clamp(1.6 - length(fwidth(q.xy)) / 0.006, 0., 1.));   /* the iron's corrugations are shallow in the photograph: deepened to read close to, and flattened where a pixel nears their pitch (no moire from afar) */
      vec3 nw = normalize(mat3(uModel) * normalize(T * tn.x + B * tn.y + no * max(0.25, tn.z))); if (dot(nw, uEye) < 0.) nw = n;
      float metal = L == 3 ? 0.2 : 0., rough = clamp(pk.g, 0.25, 1.), ao = rtao(vWorld, nw) * mix(1., pk.r, 0.55);
      if (uLook == 3) { oCol = vec4(clamp(toonLight(base, nw, uSun, sh, ao, vWorld), 0., 1.), 1.); oId = vec4(uObj, vPart / 255., uOutline / 8.); oN = vec4(nw * 0.5 + 0.5, 0.); oV = velo(); return; }
      vec3 lit = pbrX(base, nw, uEye, uSun, sh, metal, rough, 0., ao, 0.) + lampsAt(vWorld, nw) * toLin(base) * (1. - metal) / 3.14159;
      oCol = vec4(present(lit), 1.); oId = vec4(uObj, vPart / 255., uOutline / 8.); oN = vec4(nw * 0.5 + 0.5, 0.); oV = velo(); return; }
    float metal = 0., rough = 0.6, coat = 0.;
    if (kind == 1) { rough = 0.45 - 0.3 * vGloss; coat = min(1., vGloss * 1.25); } else if (kind == 2 || kind == 10) { metal = 1.; rough = vGloss > 0.7 ? 0.12 : 0.42; }
    else if (kind == 5) rough = 0.9; else if (kind == 7) rough = 0.95; else if (kind == 8) rough = 0.5; else if (kind == 6) rough = 0.65; else if (kind == 9) rough = 0.15;
    else if (vGloss > 0.7) { metal = 1.; rough = 0.15; } else rough = 0.85 - 0.6 * vGloss;
    // the material's detail, laid in the thing's own axes (it moves with it); bright metal and paint only a little
    int L = -1; float sa = 0., sn = 0., sr = 0.;
    if (kind == 1) { L = -1; } else if (metal > 0.5) { L = 2; sa = 0.12; sn = 0.3; sr = 0.5; } else if (kind == 5) { L = 3; sa = 0.5; sn = 0.6; sr = 0.3; }
    else if (kind == 8) { L = 4; sa = 0.7; sn = 0.8; sr = 0.6; } else if (kind == 7) { L = 5; sa = 0.6; sn = 0.9; sr = 0.5; } else if (kind == 6) { L = 6; sa = 0.9; sn = 0.6; sr = 0.6; } else if (kind == 0) { L = 0; sa = 0.35; sn = 0.3; sr = 0.3; }
    vec3 no = vObjN; if (dot(normalize(mat3(uModel) * no), uEye) < 0.) no = -no;
    Detail dt = detail(L, vObj / 1000., no, sa, sn, sr); vec3 nw = normalize(mat3(uModel) * dt.n); if (dot(nw, uEye) < 0.) nw = n;
    { vec3 ns = normalize(vSN); if (dot(ns, n) < 0.) ns = -ns; if (dot(ns, uEye) > 0.02) nw = kind == 1 ? ns : normalize(ns + nw - n); }   /* paint: the smoothed surface alone, so its mirror runs unbroken (review 132) */   /* the smoothed surface, the detail's bend kept (review 116) */
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
    if (kind == 1) {}   /* the lacquer smooth: its orange peel (a noisy normal) mottled every mirrored cloud (review 132) */
    else if (kind == 8) { sheen = 0.35; coat = max(coat, 0.15); } else if (kind == 7) { sheen = 0.6; rough = 0.95; } else if (kind == 5) { sheen = 0.18; } else if (kind == 6) coat = max(coat, 0.55); else if (kind == 9) { coat = 1.; rough = 0.05; }
    float ao = rtao(vWorld, nw);
    if (uLook == 3 && uFR == 1) { vec3 fs = dot(vFS, vFS) > 1e-14 ? normalize(vFS) : nw; if (dot(fs, n) < 0.) fs = -fs;   /* the surface's normal (look 4) */
      vec4 at = atlasAt(vAtl); base = mix(base, at.rgb, at.a); vec3 col;
      if (kind == 9 && vLamp.z > 0.5) col = frLamp(vLamp.xy, vLamp.z);
      else if (metal > 0.5 && at.a < 0.5) col = toonChrome(base, fs, uEye, uSun, sh);
      else { col = kind == 0 ? frLight3(base, fs, uSun, uEye, sh, ao, vWorld) : frLight(base, fs, uSun, sh, ao, vWorld); float g = kind == 1 ? coat : kind == 9 ? 1. : kind == 6 ? 0.3 : 0.; if (g > 0.05) col = mix(col, vec3(1.), frGloss(fs, uEye, uSun, sh, g)); }
      oCol = vec4(clamp(col, 0., 1.), 1.); oId = vec4(uObj, vPart / 255., uOutline / 8.); oN = vec4(fs * 0.5 + 0.5, 0.); oV = velo(); return; }
    if (uLook == 3) {   /* toon: bands and coloured shade; paint's gloss as crisp white shapes; chrome a two-tone ramp; the cars rimmed with sky blue */
      vec3 col;
      if (kind == 9 && vLamp.z > 0.5) col = toonLamp(vLamp.xy, vLamp.z);
      else if (metal > 0.5) col = toonChrome(base, nw, uEye, uSun, sh);
      else { col = toonLight(base, nw, uSun, sh, ao, vWorld); float g = kind == 1 ? coat : kind == 9 ? 1. : kind == 6 ? 0.3 : 0.; if (g > 0.05) col = mix(col, vec3(1.), toonGloss(nw, uEye, uSun, sh, g)); }
      if (uIsCar == 1) col = toonRim(col, nw, uEye);
      oCol = vec4(clamp(col, 0., 1.), 1.); oId = vec4(uObj, vPart / 255., uOutline / 8.); oN = vec4(nw * 0.5 + 0.5, 0.); oV = velo(); return; }
    vec3 lit = pbrX(base, nw, uEye, uSun, sh, metal, rough, coat, ao, sheen);
    if (kind == 9 && vLamp.z > 0.5) { vec3 ns = normalize(vSN); if (dot(ns, n) < 0.) ns = -ns; lit = lampFace(vLamp.xy, vLamp.z, vLAx, vLRt, vLUp, ns, sh); }   /* a lamp's lens: the lamp drawn on it (review 117) */
    else lit += lampsAt(vWorld, nw) * toLin(base) * (1. - metal) / 3.14159;   /* the head lamps' light */
    oCol = vec4(present(lit), 1.); oId = vec4(uObj, vPart / 255., uOutline / 8.); oN = vec4(nw * 0.5 + 0.5, metal > 0.5 ? 1. - rough : coat * (1. - rough) * 0.7); oV = velo(); return; }
  float dq = floor(d * 4. + 0.5) / 4.;
  vec3 diff = SUN_C * dq * 0.78 + (SKY_C * up + GROUND_C * (1. - up)) * 0.6, c;
  vec3 env = envAt(rz);
  if (vGloss > 0.7) { float tint = 0.55 + 0.45 * max(base.r, max(base.g, base.b)); c = min(vec3(1.), env * 0.82 * (base * 0.5 + 0.5) * tint + base * diff * 0.15); }
  else { vec3 h = normalize(uSun + uEye); float nh = max(0., dot(n, h)), g = vGloss, sp = g > 0.2 ? pow(nh, 6. + g * 110.) : 0., spec = (sp > 0.65 ? 1. : sp > 0.3 ? 0.5 : 0.) * sh;
    float refl = g > 0.3 ? 0.1 * g * (0.4 + 0.6 * up) : 0.; c = min(vec3(1.), base * diff * (1. - refl) + env * refl) + spec * (40. + 80. * g) / 255. * vec3(1., 0.97, 0.9); }
  oCol = vec4(min(c, vec3(1.)), 1.); oId = vec4(uObj, vPart / 255., uOutline / 8.); oN = vec4(n * 0.5 + 0.5, 0.); oV = velo(); }`;
const GROUND_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec4 aCol; layout(location=2) in float aFlag; layout(location=3) in vec3 aTrk;
uniform mat4 uVP, uPrevVP; uniform float uBias; out vec3 vWorld; out vec4 vCol; flat out float vFlag; out vec4 vCur, vPrev; out vec3 vTrk;
void main() { vWorld = aPos; vCol = aCol; vFlag = aFlag; vTrk = aTrk; gl_Position = uVP * vec4(aPos, 1.); vCur = gl_Position; vPrev = uPrevVP * vec4(aPos, 1.); gl_Position.z -= uBias * gl_Position.w; }`;
const GROUND_FS = `#version 300 es
precision highp float;
${LIGHT}
in vec3 vWorld; in vec4 vCol; flat in float vFlag; uniform float uCell; uniform vec3 uSun, uEyeD; uniform vec4 uCamP; vec3 uEye; in vec3 vTrk;
/* the perspective camera (uLinG: its near and far planes, 0 the orthographic one): the fields' one wide sheet, the lowest
   layer, set back a little from the eye; clipped at a near plane close to the eye a triangle kilometres across loses the
   depth's precision near the camera and would come up through the concrete 3 cm above it */
uniform vec2 uLinG;
/* ---- the concrete of the period's speed bowls (review 122), drawn by each point's place on the track (s along, o across,
   metres): laid in bays (nine strips across, a joint every uJoint m), each bay its own shade and finish (poured on its
   own day), a little proud of or sunk below its neighbour; the joints sealed with tar, the tar smeared wider over them
   in places; cracks across the bays, some sealed with tar, some open hairlines; patches where a bay was mended; the
   tyres' rubber laid dark and polished along the line the cars drive, two bands for the two wheel tracks, and its
   crumbs (marbles) beside it; oil dropped where cars stand by the start; grime and moss toward the edges; the start
   line whitewashed on, worn through in the wheel tracks and cracked with the concrete under it. Returns the colour's
   change, the roughness and a height (m) for the light's relief. ---- */
uniform float uLen, uTW, uJoint, uStart; uniform highp sampler2D uLine; uniform int uLineOn;
float hs(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vn2(vec2 x) { vec2 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(mix(hs(i), hs(i + vec2(1, 0)), f.x), mix(hs(i + vec2(0, 1)), hs(i + vec2(1, 1)), f.x), f.y); }
float fb2(vec2 p) { return vn2(p) * 0.5 + vn2(p * 2.1 + 3.) * 0.3 + vn2(p * 4.3 - 5.) * 0.2; }
/** the distance to the nearest edge of a cell pattern (cracks), and the cell's own random */
vec2 cracks(vec2 p) { vec2 i = floor(p), f = fract(p); float d1 = 9., d2 = 9.; float id = 0.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(x, y), o = vec2(hs(i + g), hs(i + g + 17.)) * 0.9, r = g + o - f; float d = dot(r, r); if (d < d1) { d2 = d1; d1 = d; id = hs(i + g + 3.); } else if (d < d2) d2 = d; }
  return vec2(sqrt(d2) - sqrt(d1), id); }
/* ---- the photographed materials (review 124, Poly Haven CC0): 0 the slab, 1 a second pour, 2 cracked concrete, 3 tar,
   4 rubbered track, 5 moss, 6 whitewash, 7 the verge's earth and gravel, 8 worn grass; each sampled in the track's own axes (metres along and across), each bay its
   own offset (the pours differ, and the joint hides the seam); laid over one another by masks and by height (tar fills
   the low ground first, moss grows in the hollows, whitewash keeps to the tops of the stones) ---- */
uniform highp sampler2DArray uGAlb, uGNor, uGPack; uniform int uGTex; uniform float uGSize[9];
struct GS { vec3 a; vec3 n; vec3 p; };
/** a layer's picture as detail about its own mean (the smallest mip): 1 on average, its light and dark and a little of its colour; the game keeps its own colours */
vec3 rel(vec3 a, int L) { vec3 m = textureLod(uGAlb, vec3(0.5, 0.5, float(L)), 12.).rgb; float lm = max(0.03, dot(m, vec3(0.3, 0.59, 0.11))), la = dot(a, vec3(0.3, 0.59, 0.11)); return mix(vec3(la), a, 0.15) / lm; }
GS gs(int L, vec2 st, vec2 off) { vec3 q = vec3(st / uGSize[L] + off, float(L)); float tb = uLook == 3 ? 3. : 0.;   /* toon: the photograph softened to patches of colour */
  GS g; g.a = rel(texture(uGAlb, q, tb).rgb, L); g.n = texture(uGNor, q, tb).rgb * 2. - 1.; g.p = texture(uGPack, q).rgb; return g; }
float W2t(float o) { return uTW / 2. - abs(o); }
/* the scratch race's grid (review 125), painted as the start line is: pairs 5 m either side of the middle, rows 9 m
   apart, each place an open box (a bar across in front, short lines back at its sides) and its number painted ahead of
   it, upright to a driver coming up to it; uGridN places, the numbers from a picture of hand-painted figures */
uniform highp sampler2D uDigits; uniform int uGridN;
float gridPaint(float s, float o) { if (uGridN == 0) return 0.; float b = uStart - s; if (b < 1. || b > 6. + 9. * float((uGridN + 1) / 2) + 1.) return 0.;
  float m = 0.; for (int r = 0; r < 8; r++) { if (2 * r >= uGridN) break; float front = uStart - 6. - 9. * float(r) + 2.7;
    for (int k = 0; k < 2; k++) { int n = 2 * r + k; if (n >= uGridN) break; float oc = k == 1 ? 5. : -5., x = o - oc, y = s - front;
      if (abs(x) < 1.25 && abs(y) < 0.07) m = 1.;   /* the bar across */
      if (abs(abs(x) - 1.2) < 0.05 && y < 0. && y > -1.3) m = 1.;   /* the side lines */
      if (y > 0.3 && y < 1.7 && abs(x) < 0.8) { vec2 uv = vec2((-x / 1.6 + 0.5 + float(n)) / 16., 1. - (y - 0.3) / 1.4); m = max(m, texture(uDigits, uv).r); } } }   /* the number */
  return m; }   /* how far inside the concrete's edge (m) */
struct Conc { vec3 tint; float rough; float h; float paint; float hb; float hb2; float cracked; float sealed; float joint; float rub; float oil; float edge; float edgeDark; float line; float mend; float dl; vec3 bay; };
Conc concrete(float s, float o) { Conc C; C.tint = vec3(1.); C.rough = 0.9; C.h = 0.; C.paint = 0.;
  float W2 = uTW / 2., sw = uTW / 9., u = mod(s, uJoint), v = o + W2, bi = floor(v / sw), bj = floor(s / uJoint), bv = mod(v, sw);
  float hb = hs(vec2(bi, bj)), hb2 = hs(vec2(bj, bi) + 7.);
  C.tint *= 1. + (hb - 0.5) * 0.08; C.tint *= mix(vec3(1.), vec3(1.03, 1.0, 0.95), hb2); C.bay = C.tint;   /* each bay its own pour */
  C.rough = 0.86 + (hb2 - 0.5) * 0.1; C.h += (hb - 0.5) * 0.003;   /* a bay proud or sunk a millimetre or two */
  // tar in the joints, and smeared over them here and there
  float dj = min(u, uJoint - u), dl = min(bv, sw - bv), smear = 0.04 + 0.09 * smoothstep(0.45, 0.8, vn2(vec2(s * 0.8, o * 0.8) + 11.));
  float tarJ = max(smoothstep(0.03, 0.012, dj), smoothstep(smear, smear - 0.025, dj) * 0.6), tarL = smoothstep(0.02, 0.008, dl) * (abs(o) < W2 - 0.1 ? 1. : 0.);
  // cracks: a few bays cracked across; most sealed, some open
  vec2 ck = cracks(vec2(s * 0.45, o * 0.7) + vec2(fb2(vec2(s, o) * 0.6) * 0.8)); float cracked = step(0.86, hs(vec2(bi + 31., bj))), crack = smoothstep(0.02, 0.006, ck.x) * cracked;   /* one bay in seven or so cracked */
  float sealed = step(0.4, ck.y), tarC = crack * sealed, open = crack * (1. - sealed) * smoothstep(0.02, 0.006, ck.x);
  // a mended patch in some bays
  vec2 pc = vec2(u / uJoint, bv / sw), p0 = vec2(0.1 + hb * 0.4, 0.1 + hb2 * 0.3); float mend = step(0.93, hb2) * step(p0.x, pc.x) * step(pc.x, p0.x + 0.35) * step(p0.y, pc.y) * step(pc.y, p0.y + 0.45);   /* one patch, in a bay in fifteen */
  if (mend > 0.) { C.tint *= vec3(0.84, 0.83, 0.82); C.rough = 0.78; C.h -= 0.0015; }
  // the rubber of the line the cars drive, two wheel tracks; its crumbs beside it
  float Lo = 0.; if (uLineOn == 1) { int i = int(mod(floor(s), uLen)); Lo = texelFetch(uLine, ivec2(i % 128, i / 128), 0).r; }
  float d = o - Lo, rub = 0.55 * (exp(-pow((d - 0.68) / 0.33, 2.)) + exp(-pow((d + 0.68) / 0.33, 2.))) + 0.25 * exp(-pow(d / 1.6, 2.));
  rub *= 0.7 + 0.6 * vn2(vec2(s * 0.05, 0.)); rub = clamp(rub, 0., 1.);
  float marb = step(0.985, hs(floor(vec2(s, o) * 22.))) * smoothstep(1.3, 2., abs(d)) * smoothstep(3.6, 2.4, abs(d));
  // oil where cars stand at the start, and dropped along the middle of the wheel tracks
  float ds = abs(s - uStart), oil = smoothstep(0.72, 0.86, fb2(vec2(s, o) * 0.9 + 4.)) * (smoothstep(40., 5., ds) * 0.7 + 0.2 * exp(-pow(d / 0.5, 2.)));
  // grime toward the edges, moss in the joints there
  float ein = W2 - abs(o), edgeN = fb2(vec2(s * 1.3, o * 1.3) + 21.), edge = smoothstep(1.6, 0., ein), edgeDark = smoothstep(0.06 + 0.14 * edgeN, 0.0, ein);   /* edgeDark now: the worn, chipped lip where the verge's earth shows */
  // ---- together ----
  vec3 tar = vec3(0.18, 0.17, 0.16); float tarAll = clamp(max(max(tarJ, tarL), tarC), 0., 1.);
  C.tint = mix(C.tint, C.tint * vec3(0.32, 0.31, 0.31), rub * 0.45); C.rough = mix(C.rough, 0.55, rub * 0.7);
  C.tint = mix(C.tint, vec3(0.45, 0.44, 0.42), marb * 0.6);
  C.tint = mix(C.tint, vec3(0.3, 0.28, 0.26), oil * 0.35); C.rough = mix(C.rough, 0.32, oil * 0.8);
  C.tint = mix(C.tint, C.tint * vec3(0.9, 0.88, 0.8) + vec3(0.02, 0.025, 0.), edge * 0.5); C.tint = mix(C.tint, vec3(0.45, 0.47, 0.36), edge * tarAll * 0.4);
  C.tint = mix(C.tint, vec3(0.52, 0.46, 0.36), edgeDark * 0.75);   /* earth in the chipped lip, not a black line (review 125) */
  C.tint = mix(C.tint, tar / 0.62, tarAll); C.rough = mix(C.rough, 0.38, tarAll); C.h += tarAll * 0.0015;   /* tar: dark, glossy, standing a little proud */
  C.tint *= 1. - open * 0.55; C.h -= open * 0.003;
  // the start line: whitewash, worn through where the wheels run, cracked with the concrete
  float line = max(smoothstep(0.17, 0.15, ds) * (abs(o) < W2 - 0.05 ? 1. : 0.), gridPaint(s, o));
  if (line > 0.) { float worn = clamp(rub * 1.1 + smoothstep(0.55, 0.8, fb2(vec2(s * 9., o * 3.))) * 0.6 + crack, 0., 1.), pnt = line * (1. - worn * 0.75);
    C.tint = mix(C.tint, vec3(1.45, 1.43, 1.36), pnt); C.rough = mix(C.rough, 0.62, pnt); C.h += pnt * 0.0008; C.paint = pnt; }
  C.hb = hb; C.hb2 = hb2; C.cracked = cracked; C.sealed = sealed; C.joint = max(tarJ, tarL); C.rub = rub; C.oil = oil; C.edge = edge; C.edgeDark = edgeDark; C.line = line; C.mend = mend; C.dl = dl;
  return C; }
layout(location=0) out vec4 oCol; layout(location=1) out vec4 oId; layout(location=2) out vec4 oN; layout(location=3) out vec4 oV; in vec4 vCur, vPrev; uniform vec2 uSize;
vec4 velo() { vec2 d = (vCur.xy / vCur.w - vPrev.xy / vPrev.w) * 0.5 * uSize; return vec4(clamp(d / 128. + 0.5, 0., 1.), 0., 1.); }   /* pixels moved since the last frame, packed */   // oN: the normal and how mirror-like (for the traced reflections)
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() { uEye = uCamP.w > 0.5 ? normalize(uCamP.xyz - vWorld) : uEyeD; float fd = gl_FragCoord.z;
  if (uLinG.x > 0. && vWorld.z < -0.028) { float n = uLinG.x, f = uLinG.y, z = 2. * n * f / (f + n - (fd * 2. - 1.) * (f - n)); z += max(0.4, z * 0.01); fd = min(0.9999999, 0.5 * ((f + n) / (f - n) - 2. * f * n / ((f - n) * z)) + 0.5); }
  gl_FragDepth = fd; vec3 c = vCol.rgb;
  if (vFlag > 0.5 && uLook == 0) { vec2 cell = floor(vWorld.xy / vec2(uCell * 2., uCell)); float h = hash(cell); if (h > 0.955) c = vec3(107., 130., 83.) / 255.; else if (h > 0.91) c = vec3(83., 104., 63.) / 255.; }
  bool verge = vTrk.z > 1.5; bool conc = vTrk.z > 0.5 && !verge; Conc C; bool photo = false; vec3 pa = vec3(0.), pn = vec3(0., 0., 1.); float pao = 1., prough = 0.9;
  if (conc) { C = concrete(vTrk.x, vTrk.y);
    if (uGTex == 1 && uLook > 0) { photo = true; vec2 st = vTrk.xy, bo = vec2(C.hb, C.hb2) * 7.31;
      GS b = gs(C.hb2 > 0.55 ? 1 : 0, st, bo); if (C.cracked > 0.5) { GS k = gs(2, st, bo); b.a = k.a; b.n = k.n; b.p = k.p; }
      float h = b.p.b; vec3 A = c * C.bay * b.a, N = b.n;   /* the concrete's own colour (lighter where it climbs), the bay's shade, the photograph's detail */ float R = b.p.g, O = b.p.r;
      // tar: in the joints, smeared over them, and down the cracks of a cracked bay where sealed (the low ground first)
      float tarCrack = C.cracked * C.sealed * smoothstep(0.42, 0.25, h);
      float tm = clamp(max(C.joint, tarCrack) + (C.joint > 0.05 ? (0.5 - h) * 0.6 : 0.), 0., 1.);
      if (tm > 0.) { GS t = gs(3, st, bo * 0.37); A = mix(A, t.a * vec3(0.17, 0.16, 0.15), tm); N = normalize(mix(N, t.n, tm)); R = mix(R, t.p.g * 0.7, tm); O = mix(O, t.p.r, tm); }
      // the rubber laid by the tyres, and the oil
      if (C.rub > 0.02) { GS r = gs(4, st, bo * 0.53); float rm = clamp(C.rub * 0.75 + (h - 0.5) * 0.3 * C.rub, 0., 1.); A = mix(A, A * r.a * 0.42, rm * 0.8); R = mix(R, r.p.g * 0.75, rm * 0.7); }
      A = mix(A, A * vec3(0.42, 0.4, 0.38), C.oil * 0.5); R = mix(R, 0.3, C.oil * 0.7);
      // moss and grime at the edges, in the hollows first
      if (C.edge > 0.02) { GS m = gs(5, st, bo * 0.21); float mm = clamp(C.edge * (0.6 + (0.5 - h) * 1.2) * smoothstep(0.35, 0.6, fb2(st * 0.4 + 9.)), 0., 1.); A = mix(A, m.a * vec3(0.3, 0.34, 0.2), mm * 0.85); N = normalize(mix(N, m.n, mm)); R = mix(R, m.p.g, mm); }
      if (C.edgeDark > 0.01 || C.edge > 0.3) { GS e = gs(7, st, vec2(0.)); vec3 earth = c * e.a * vec3(0.9, 0.78, 0.6); float lip = C.edgeDark * smoothstep(0.55, 0.35, h); A = mix(A, earth, max(lip, C.edge * 0.18)); N = normalize(mix(N, e.n, lip)); R = mix(R, 0.95, lip);   /* the lip chipped back to earth, dust blown on */
        GS gr = gs(8, st, vec2(0.)); float over = smoothstep(0.62, 0.8, fb2(st * vec2(0.9, 3.) + 5.)) * smoothstep(0.18, 0.02, W2t(vTrk.y)); A = mix(A, vCol.rgb * 0.0 + vec3(0.36, 0.42, 0.26) * gr.a, over * 0.9); N = normalize(mix(N, gr.n, over)); R = mix(R, 0.9, over); }   /* grass creeping over the edge */
      // the start line's whitewash, on the tops, worn through in the wheel tracks
      if (C.line > 0.) { GS w = gs(6, st, vec2(0.)); float pm = C.line * clamp(1. - C.rub * 1.2, 0., 1.) * smoothstep(0.15, 0.45, h + w.p.b * 0.3) * smoothstep(0.25, 0.5, fb2(st * vec2(7., 2.)) + 0.3);
        A = mix(A, w.a * vec3(0.9, 0.89, 0.85), pm); R = mix(R, 0.7, pm); }
      A *= C.mend > 0. ? 0.86 : 1.;   /* a mended patch darker */
      pa = A; pn = N; pao = O; prough = R; c = A; }
    else c *= C.tint; }
  if (verge) {   /* the verge (review 125): worn earth and gravel by the concrete, grass coming back over it outward, the field's own colour by two metres */
    float d = abs(vTrk.y) - uTW / 2., n1 = fb2(vTrk.xy * vec2(0.35, 1.1) + 3.), g = smoothstep(0.15, 1.5, d + (n1 - 0.5) * 1.3), ruts = smoothstep(0.55, 0.85, fb2(vTrk.xy * vec2(0.08, 2.5)));
    vec3 earthC = vec3(0.5, 0.44, 0.34), grassC = vCol.rgb * vec3(1.02, 1.0, 0.95);
    if (uGTex == 1 && uLook > 0) { photo = true; vec2 st = vTrk.xy; GS e = gs(7, st, vec2(0.)), gr = gs(8, st, vec2(0.37)); float gm = clamp(g + (gr.p.b - e.p.b) * 0.6 - ruts * 0.25 * (1. - g), 0., 1.);   /* the grass wins where it stands higher */
      vec3 A = mix(earthC * e.a, grassC * gr.a * 1.05, gm); A = mix(A, grassC, smoothstep(1.4, 2.1, d)); pa = A; pn = normalize(mix(e.n, gr.n, gm)); pn = normalize(mix(pn, vec3(0., 0., 1.), smoothstep(1.4, 2.1, d))); pao = mix(e.p.r, gr.p.r, gm); prough = mix(0.95, 0.9, gm); c = A; }
    else c = mix(mix(earthC, grassC, g), grassC, smoothstep(1.4, 2.1, d)); }
  else if (!conc && vFlag > 0.5 && uGTex == 1 && uLook > 0) {   /* the fields and the banks' grass: the photographed grass, laid on the world's own axes, two sizes mixed so it does not repeat */
    vec2 st = vWorld.xy; GS g1 = gs(8, st, vec2(0.)), g2 = gs(8, st * 0.37, vec2(0.51)); float m = smoothstep(0.35, 0.65, fb2(st * 0.05));
    photo = true; pa = c * mix(g1.a, g2.a, m) * mix(vec3(1.), vec3(1.06, 1.0, 0.9), fb2(st * 0.013)); pn = normalize(mix(g1.n, g2.n, m)); pao = mix(g1.p.r, g2.p.r, m); prough = 0.92; c = pa; }
  if (uLook > 0) { vec3 nn = normalize(cross(dFdx(vWorld), dFdy(vWorld))); if (nn.z < 0.) nn = -nn; float sh = lightAt(vWorld + vec3(0., 0., 0.02));   // the ground as a rough, dull surface
    if (uLook == 3) pn = normalize(vec3(pn.xy * 0.25, max(0.2, pn.z)));   /* toon: the photographed relief shallow */
    if (photo && !conc && !verge) { vec3 T = normalize(vec3(1., 0., 0.) - nn * nn.x), B = cross(nn, T); nn = normalize(T * pn.x + B * pn.y + nn * max(0.2, pn.z)); }
    if (conc || verge) { vec3 dpx = dFdx(vWorld), dpy = dFdy(vWorld), r1 = cross(dpy, nn), r2 = cross(nn, dpx); float det = dot(dpx, r1), k = clamp(1.6 - length(dpx) * 12., 0., 1.);   /* the relief by the height's change across the pixel (bump mapping), faded where a pixel spans more than the detail */
      if (conc) { vec3 gr = sign(det) * (dFdx(C.h) * r1 + dFdy(C.h) * r2) * k * (uLook == 3 ? 0.3 : 1.); nn = normalize(abs(det) * nn - gr); }
      if (photo) { vec2 dux = dFdx(vTrk.xy), duy = dFdy(vTrk.xy); float id = dux.x * duy.y - dux.y * duy.x; vec3 T = normalize((dpx * duy.y - dpy * dux.y) * sign(id)), B = normalize((dpy * dux.x - dpx * duy.x) * sign(id));   /* the track's own axes on the surface: along (s) and across (o) */
        T = normalize(T - nn * dot(T, nn)); B = cross(nn, T) * sign(dot(cross(nn, T), B)); nn = normalize(T * pn.x + B * pn.y + nn * max(0.2, pn.z)); } }
    Detail dt; if (photo) { dt.tone = 1.; dt.rough = 0.; dt.n = nn; } else dt = detail(vFlag > 0.5 ? 1 : 0, vWorld, nn, vFlag > 0.5 ? 0.8 : 0.7, conc ? 0.75 : 0.6, 0.4);
    float rough = photo ? clamp(prough, 0.2, 1.) : conc ? clamp(C.rough + dt.rough, 0.25, 1.) : clamp(0.92 + dt.rough, 0.3, 1.);
    if (uLook == 3) { vec3 tc = c; if (photo && !conc) { float lv = max(1e-3, dot(vCol.rgb, vec3(0.3, 0.59, 0.11))), r = dot(c, vec3(0.3, 0.59, 0.11)) / lv; tc = c / max(r, 1e-3) * mix(1., r, 0.3); } if (photo) tc = posterC(tc, 6.);   /* the grass's photographed patchiness mostly flattened away */ oCol = vec4(clamp(toonLight(tc, dt.n, uSun, sh, rtao(vWorld, dt.n), vWorld), 0., 1.), vCol.a); oId = vec4(0.); oN = vec4(dt.n * 0.5 + 0.5, 0.); oV = velo(); return; }   /* toon: the ground in flat bands, its shadows blue-grey */
    oCol = vec4(present(pbrX(c * dt.tone, dt.n, uEye, uSun, sh, 0., rough, 0., rtao(vWorld, dt.n) * (photo ? mix(1., pao, 0.8) : 1.), 0.) + lampsAt(vWorld, dt.n) * toLin(c * dt.tone) / 3.14159), vCol.a); oId = vec4(0.); oN = vec4(dt.n * 0.5 + 0.5, conc ? max(0., 0.5 - rough) * 0.5 : 0.); oV = velo(); return; }
  c = mix(c, vec3(24., 22., 20.) / 255., (1. - lightAt(vWorld + vec3(0., 0., 0.02))) * 0.43);
  oCol = vec4(c, vCol.a); oId = vec4(0.); oN = vec4(0.5, 0.5, 1., 0.); oV = velo(); }`;
// ---- photographed props (review 125): Poly Haven CC0 glTF models with their own pictures (base colour, normal,
//      ao-rough-metal), drawn many at once (instanced), lit, shadowed and outlined as everything else ----
const PROP_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec2 aUV; layout(location=3) in vec4 aM0; layout(location=4) in vec4 aM1; layout(location=5) in vec4 aM2; layout(location=6) in vec4 aM3;
uniform mat4 uVP, uPrevVP; out vec3 vWorld, vN; out vec2 vUV; out vec4 vCur, vPrev;
void main() { mat4 M = mat4(aM0, aM1, aM2, aM3); vec4 w = M * vec4(aPos, 1.); vWorld = w.xyz; vN = normalize(mat3(M) * aNor); vUV = aUV; gl_Position = uVP * w; vCur = gl_Position; vPrev = uPrevVP * w; }`;
const PROP_FS = `#version 300 es
precision highp float;
${LIGHT}
in vec3 vWorld, vN; in vec2 vUV; in vec4 vCur, vPrev; uniform vec3 uSun, uEyeD; uniform vec4 uCamP; vec3 uEye; uniform vec2 uSize, uObj; uniform float uOutline; uniform highp sampler2D uPA, uPN, uPR;
layout(location=0) out vec4 oCol; layout(location=1) out vec4 oId; layout(location=2) out vec4 oN; layout(location=3) out vec4 oV;
vec4 velo() { vec2 d = (vCur.xy / vCur.w - vPrev.xy / vPrev.w) * 0.5 * uSize; return vec4(clamp(d / 128. + 0.5, 0., 1.), 0., 1.); }
void main() { uEye = uCamP.w > 0.5 ? normalize(uCamP.xyz - vWorld) : uEyeD; vec3 n = normalize(vN); if (dot(n, uEye) < 0.) n = -n;
  vec3 dp1 = dFdx(vWorld), dp2 = dFdy(vWorld); vec2 du1 = dFdx(vUV), du2 = dFdy(vUV); vec3 a = cross(dp2, n), b = cross(n, dp1), T = a * du1.x + b * du2.x, B = a * du1.y + b * du2.y;   /* the surface's own axes from the picture's, per pixel */
  float k = inversesqrt(max(1e-12, max(dot(T, T), dot(B, B)))), tb = uLook == 3 ? 1.5 : 0.; vec3 tn = texture(uPN, vUV, tb).xyz * 2. - 1.; if (uLook == 3) tn.xy *= 0.3; vec3 nw = normalize(T * k * tn.x + B * k * tn.y * -1. + n * tn.z); if (dot(nw, uEye) < 0.) nw = n;
  vec3 alb = texture(uPA, vUV, tb).rgb, arm = texture(uPR, vUV).rgb; float sh = lightAt(vWorld + n * 0.02), ao = rtao(vWorld, nw) * mix(1., arm.r, 0.8);
  if (uLook == 3) { vec3 col = arm.b > 0.5 && arm.g < 0.35 ? toonChrome(alb, nw, uEye, uSun, sh) : toonLight(posterC(alb, 6.), nw, uSun, sh, ao, vWorld); oCol = vec4(clamp(col, 0., 1.), 1.); oId = vec4(uObj, 0., uOutline / 8.); oN = vec4(nw * 0.5 + 0.5, 0.); oV = velo(); return; }   /* toon */
  vec3 lit = pbrX(alb, nw, uEye, uSun, sh, arm.b, clamp(arm.g, 0.06, 1.), 0., ao, 0.) + lampsAt(vWorld, nw) * toLin(alb) / 3.14159;
  oCol = vec4(present(lit), 1.); oId = vec4(uObj, 0., uOutline / 8.); oN = vec4(nw * 0.5 + 0.5, arm.b > 0.5 ? 1. - arm.g : 0.); oV = velo(); }`;
const DEPTHI_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=3) in vec4 aM0; layout(location=4) in vec4 aM1; layout(location=5) in vec4 aM2; layout(location=6) in vec4 aM3;
uniform mat4 uVP; void main() { gl_Position = uVP * mat4(aM0, aM1, aM2, aM3) * vec4(aPos, 1.); }`;
const DEPTH_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=10) in float aBone; uniform mat4 uVP, uModel; uniform int uSkin; uniform vec4 uBone[${BONE_SLOTS * 3}];   // a piece on bones casts its shadow where it is posed
void main() { vec3 p = aPos; if (uSkin == 1) { int b = int(aBone + 0.5) * 3; vec4 q = vec4(p, 1.); p = vec3(dot(uBone[b], q), dot(uBone[b + 1], q), dot(uBone[b + 2], q)); } gl_Position = uVP * uModel * vec4(p, 1.); }`;
const DEPTH_FS = `#version 300 es
precision mediump float; out vec4 o; void main() { o = vec4(1.); }`;
// ---- the drift-game style's drawn lines (look 4, docs/systems/109 §5.2): each segment a ribbon uW pixels wide on the
//      screen, its ends pushed out by half that (the joins close), lifted uLift metres toward the eye so it never fights
//      the surface it lies on, tested against the depth so a hidden line is hidden; a line on a suspension part posed
//      by that part's bone. The edge a pixel soft ----
const LINE_VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aQ; layout(location=2) in vec2 aS; layout(location=3) in float aBone;
uniform mat4 uVP, uModel; uniform vec2 uVpx; uniform float uW, uLift; uniform int uSkin; uniform vec4 uBone[${BONE_SLOTS * 3}]; uniform vec3 uEyeD; uniform vec4 uCamP; out float vD; flat out float vH;
vec3 posed(vec3 p) { if (uSkin == 0) return p; int b = int(aBone + 0.5) * 3; vec4 q = vec4(p, 1.); return vec3(dot(uBone[b], q), dot(uBone[b + 1], q), dot(uBone[b + 2], q)); }
void main() { vec3 wp = (uModel * vec4(posed(aP), 1.)).xyz, wq = (uModel * vec4(posed(aQ), 1.)).xyz, e = uCamP.w > 0.5 ? normalize(uCamP.xyz - wp) : uEyeD;
  vec4 cp = uVP * vec4(wp + e * uLift, 1.), cq = uVP * vec4(wq + e * uLift, 1.); vec2 d = (cq.xy / max(cq.w, 1e-4) - cp.xy / cp.w) * uVpx; float L = length(d); d = L > 1e-5 ? d / L : vec2(1., 0.);
  float hw = uW * aS.y * 0.5, h = hw + 0.5; vec2 off = vec2(-d.y, d.x) * aS.x * h - d * h;
  gl_Position = cp; gl_Position.xy += off * 2. / uVpx * cp.w; vD = aS.x * h; vH = hw; }`;
const LINE_FS = `#version 300 es
precision highp float; in float vD; flat in float vH; uniform vec3 uInk; layout(location=0) out vec4 oCol;
void main() { float a = clamp(vH + 0.5 - abs(vD), 0., 1.); if (a < 0.01) discard; oCol = vec4(uInk, a); }`;
const POST_VS = `#version 300 es
out vec2 vUv; void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUv = p; gl_Position = vec4(p * 2. - 1., 0., 1.); }`;
const POST_FS = `#version 300 es
precision highp float;
uniform sampler2D uCol, uId, uDepth, uN, uAO; uniform float uRange, uStep, uAOK, uReflK; uniform int uInner, uRays, uToon; uniform int uFR; uniform vec3 uInk;   /* uFR: the drift-game style (look 4): the hull and the drawn lines make the lines; this pass only fills the gaps (a part standing proud of the one behind, a big step), in the same ink, and never beside a line already drawn (alpha 1 in the id layer) */   /* uToon: the toon look's lines (a darker tone of the thing's own colour; inner lines only at strong breaks) */ uniform float uRayK, uOutW, uOutK, uInK;   /* the outline: its width (times the thing's own), how dark; the lines inside, how dark */ uniform mat4 uVP; uniform vec3 uVd, uSunD; in vec2 vUv; out vec4 o;
/* the perspective camera (uLin: its near and far planes; 0 the orthographic one): the depth layer's value as metres from
   the eye, and where nothing was drawn the sky (the view's ray from uRx, uUpV and uTan), the far ground hazed toward it */
uniform vec2 uLin, uTan; uniform vec3 uRx, uUpV; uniform int uSky; uniform float uDay;
float dm(float d) { return uLin.x > 0. ? 2. * uLin.x * uLin.y / (uLin.y + uLin.x - (d * 2. - 1.) * (uLin.y - uLin.x)) : d * 2. * uRange; }
vec3 acesP(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0., 1.); }
vec3 skyAt(vec3 r) { float e = r.z, k = 0.25 + 0.75 * uDay; vec3 hz = vec3(0.70, 0.74, 0.76), zen = vec3(0.24, 0.40, 0.66), fld = vec3(0.30, 0.36, 0.25);
  vec3 c = e > 0. ? mix(hz, zen, pow(clamp(e, 0., 1.), 0.55)) : mix(hz, fld, clamp(-e * 14., 0., 1.)); c += vec3(1., 0.92, 0.75) * pow(max(0., dot(r, uSunD)), 24.) * 0.35;
  c *= k; return uSky == 2 ? c : pow(acesP(c), vec3(1. / 2.2)); }
float obj(vec4 id) { return floor(id.r * 255. + 0.5) + floor(id.g * 255. + 0.5) * 256.; }
/** the toon line's ink: the colour squared (deeper, more saturated), held dark */
vec3 toonInk(vec3 c) { vec3 d = c * c * 0.55; float L = dot(d, vec3(0.3, 0.59, 0.11)); return d * min(1., 0.13 / max(L, 1e-4)); }
// ---- rays in the picture (review 106, brief 75 §1): a world direction as a step across the picture (pixels a metre)
//      and in the depth layer (its units a metre); the camera being orthographic, the same everywhere ----
vec3 toScreen(vec3 d) { vec4 c = uVP * vec4(d, 0.); vec2 sz = vec2(textureSize(uCol, 0)); return vec3(c.x * sz.x * 0.5, c.y * sz.y * 0.5, c.z * 0.5); }
float hsh(vec2 q) { return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }
void main() { ivec2 p = ivec2(gl_FragCoord.xy), sz = textureSize(uCol, 0); vec4 c = texelFetch(uCol, p, 0), id = texelFetch(uId, p, 0); float me = obj(id);
  float d0 = texelFetch(uDepth, p, 0).r; vec4 G = texelFetch(uN, p, 0); vec3 ray = vec3(0.);
  if (uSky > 0) { vec2 q = (vec2(p) + 0.5) / vec2(sz) * 2. - 1.; ray = normalize(uVd + uRx * q.x * uTan.x + uUpV * q.y * uTan.y); if (d0 > 0.9999) { o = vec4(skyAt(ray), 1.); return; } } 
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
  if (me > 0. && !(uFR == 1 && id.a > 0.99)) { float dp = dm(texelFetch(uDepth, p, 0).r); int w = int(floor(floor(id.a * 8. + 0.5) * uOutW + 0.5)); float k = 1., ko = 1. - 0.8 * uOutK, ki = 1. - 0.5 * uInK; bool nearInk = false;
    ivec2 dirs[4] = ivec2[4](ivec2(1, 0), ivec2(-1, 0), ivec2(0, 1), ivec2(0, -1));
    for (int s = 1; s <= 6; s++) { if (s > max(w, uInner)) break; for (int j = 0; j < 4; j++) { ivec2 q = p + dirs[j] * s; if (q.x < 0 || q.y < 0 || q.x >= sz.x || q.y >= sz.y) { if (s <= w) k = ko; continue; }
      vec4 iq = texelFetch(uId, q, 0); float oq = obj(iq), dq = dm(texelFetch(uDepth, q, 0).r); if (uFR == 1 && s == 1 && iq.a > 0.99) nearInk = true;
      if (s <= w && oq != me && (oq == 0. || dq > dp)) k = min(k, ko);
      else if (uInner == 1 && s == 1 && oq == me && k > ki) {
        bool brk; if (uFR == 1) { float dz = dp - dq; brk = iq.a < 0.99 && ((abs(iq.b - id.b) > 0.001 && dz > 0.015) || dz > uStep * 1.6); }
        else if (uToon == 1) { float nd = dot(G.xyz * 2. - 1., texelFetch(uN, q, 0).xyz * 2. - 1.), dz = dp - dq; bool part = abs(iq.b - id.b) > 0.001;   /* toon: only strong breaks, a part's edge standing proud, a fold, a big step */
          brk = (part && (dz > 0.015 || (j % 2 == 0 && nd < 0.75))) || dz > uStep * 1.6 || (j % 2 == 0 && nd < 0.3 && dz > -0.002); }
        else brk = (abs(iq.b - id.b) > 0.001 && dp - dq > 0.004) || dp - dq > uStep;
        if (brk) k = min(k, ki); } } }
    if (uFR == 1) { if (nearInk && k > ko + 0.001) k = 1.; c.rgb = mix(c.rgb, uInk, clamp((1. - k) / 0.8, 0., 1.) * 0.9); }
    else if (uToon == 1) c.rgb = mix(c.rgb, toonInk(c.rgb), clamp((1. - k) / 0.8, 0., 1.)); else c.rgb *= k; }
  if (uSky > 0) c.rgb = mix(c.rgb, skyAt(vec3(ray.xy, max(ray.z, 0.))), smoothstep(90., 2600., dm(d0)) * 0.7);   /* the air between: the far ground toward the horizon's colour */
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
/* ---- the period's pictures (review 129): uFx 1, a 1930s newsreel on 35 mm nitrate (panchromatic black and white, a
   soft lens, grain that changes every frame and thickens in the shadows, the projector's flicker, the gate's weave, the
   print's scratches and dust, a darkened edge, the highlights' halation, a faint warm tone of the print); uFx 2, a 1990s
   television outside broadcast (a 625-line PAL picture: interlaced fields combing what moves, the colour carried at
   half the sharpness and bleeding sideways, the camera's edge enhancement ringing at hard edges, video's lifted blacks
   and hot reds, faint scanlines, a little tape noise). uFxK the strength 0..1, uFrame the frame (for the grain and
   scratches), uFxPx the size of a film or video pixel in screen pixels ---- */
uniform int uFx, uFrame; uniform float uFxK, uFxPx;
float hf(vec2 q) { return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }
float hf1(float x) { return fract(sin(x * 91.3458) * 47453.5453); }
/** film grain: clumps of silver a pixel or two across (value noise, two sizes), not a pixel's own speck */
float grain(vec2 q, float f) { vec2 o = vec2(hf1(f) * 97., hf1(f + 3.) * 61.); float a = 0.; for (int i = 0; i < 2; i++) { vec2 x = (q + o) / (i == 0 ? 1.7 : 0.9), b = floor(x), t = fract(x); t = t * t * (3. - 2. * t);
  a += mix(mix(hf(b), hf(b + vec2(1, 0)), t.x), mix(hf(b + vec2(0, 1)), hf(b + vec2(1, 1)), t.x), t.y) * (i == 0 ? 0.65 : 0.35); } return a - 0.5; }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0., 1.); }
float coc(float d) { return min(9., max(0., abs(d - uFocus) * 2. * uRange - 1.2) * uDof); }   /* sharp within 1.2 m of the focus */
void main() { vec2 sz = vec2(textureSize(uSrc, 0)), wv = vec2(0.);
  if (uFx == 1) { float f = float(uFrame); wv = vec2(hf1(f) - 0.5, (hf1(f + 7.) - 0.5) * 1.6 + sin(f * 0.21) * 0.6) * 1.6 * uFxK; }   /* the gate's weave: the frame not quite where the last one was */
  ivec2 p = clamp(ivec2(gl_FragCoord.xy + wv), ivec2(0), ivec2(sz) - 1); vec2 vUv2 = (vec2(p) + 0.5) / sz; vec3 c = texelFetch(uSrc, p, 0).rgb; float r0 = coc(texelFetch(uDepth, p, 0).r);
  if (uDof > 0. && r0 > 0.6) { vec3 acc = c; float wsum = 1.; for (int i = 0; i < 20; i++) { float a = float(i) * 2.39996, rr = sqrt((float(i) + 0.5) / 20.) * r0; vec2 q = vec2(p) + vec2(cos(a), sin(a)) * rr;
      float rq = coc(texelFetch(uDepth, ivec2(clamp(q, vec2(0.), sz - 1.)), 0).r), w = rq >= rr * 0.7 ? 1. : 0.15; acc += texture(uSrc, (q + 0.5) / sz).rgb * w; wsum += w; } c = acc / wsum; }
  // motion blur: each pixel smeared along its own motion across the picture since the last frame (the camera's for the
  // ground, a car's own against the camera's: one kept in shot stays sharp), as a shutter open for uMB of a frame
  vec2 mv = (texelFetch(uVel, p, 0).rg - 0.5) * 128. * uMB; float ml = length(mv);
  if (ml > 0.75) { vec3 acc = c; float n = 1., j = fract(float((p.x * 7 + p.y * 13) & 15) / 16. + 0.03);   /* a jittered start: no stepped copies */
    for (int i = 0; i < 20; i++) { float t = (float(i) + j) / 20. - 0.5; vec2 q = vec2(p) + mv * t; ivec2 qi = ivec2(clamp(q, vec2(0.), sz - 1.));
      vec2 mq = (texelFetch(uVel, qi, 0).rg - 0.5) * 128. * uMB; if (length(mq - mv) > 0.35 * ml + 1.) continue;   /* only what moves as this pixel does: a car is not smeared into the road */
      acc += texture(uSrc, (q + 0.5) / sz).rgb; n += 1.; } c = mix(c, acc / n, clamp(ml / 3., 0., 1.)); }
  if (uFx == 1) {   /* the period's soft lens: a little of the neighbours mixed in, more toward the edge */
    float e = length(vUv2 - 0.5), k = (0.25 + e * 0.6) * uFxK; vec3 b = (texelFetch(uSrc, clamp(p + ivec2(1, 0), ivec2(0), ivec2(sz) - 1), 0).rgb + texelFetch(uSrc, clamp(p - ivec2(1, 0), ivec2(0), ivec2(sz) - 1), 0).rgb + texelFetch(uSrc, clamp(p + ivec2(0, 1), ivec2(0), ivec2(sz) - 1), 0).rgb + texelFetch(uSrc, clamp(p - ivec2(0, 1), ivec2(0), ivec2(sz) - 1), 0).rgb) / 4.; c = mix(c, b, k); }
  if (uFx == 2) {   /* the colour at half the sharpness and late: chroma from a wider, shifted sample, the brightness kept */
    vec3 a = vec3(0.); for (int i = -3; i <= 3; i++) a += texelFetch(uSrc, clamp(p + ivec2(i * 2 - 2, 0), ivec2(0), ivec2(sz) - 1), 0).rgb; a /= 7.;
    float Lc = dot(c, vec3(0.299, 0.587, 0.114)), La = dot(a, vec3(0.299, 0.587, 0.114)); c = mix(c, a - La + Lc, 0.85 * uFxK);
    // the interlace: on alternate lines what moves is shown where it was a field earlier (half a frame of its motion back)
    vec2 mv = (texelFetch(uVel, p, 0).rg - 0.5) * 128.; if (((p.y / max(1, int(uFxPx))) & 1) == (uFrame & 1) && length(mv) > 1.) c = mix(c, texture(uSrc, (vec2(p) + 0.5 - mv * 0.5) / sz).rgb, 0.8 * uFxK); }
  c += texture(uBloom, vUv2).rgb * uBloomK * (uFx == 1 ? 1. + 0.8 * uFxK : 1.);
  if (uHDR == 1) {   /* the filmic curve on each channel bleaches a strong colour toward white as it brightens; on the
       brightness alone it keeps the hue: the two mixed by the colour's depth (review 116) */
    float L = dot(c, vec3(0.2126, 0.7152, 0.0722)); vec3 byL = c * (aces(vec3(L)).r / max(L, 1e-4)); float over = max(byL.r, max(byL.g, byL.b));
    if (over > 1.) byL = mix(byL / over, vec3(1.), clamp((over - 1.) * 0.5, 0., 1.));   /* past white: toward white, not clipped to another hue */
    c = pow(mix(aces(c), byL, clamp(uDeep * 0.55, 0., 0.85)), vec3(1. / 2.2)); }
  c = min(c, vec3(1.));
  if (uFx == 1) { float K = uFxK, f = float(uFrame); vec2 q = floor(gl_FragCoord.xy / max(1., uFxPx));
    // panchromatic film: red, green and blue to grey (a little less red than the eye: skies a shade light, red paint dark)
    float g = dot(c, vec3(0.24, 0.66, 0.10));
    g = mix(g, smoothstep(-0.05, 1.05, g), 0.55);   /* the film's S-curve: shoulders and toe */
    g *= 1. + (hf1(f * 1.37) - 0.5) * 0.09 * K;   /* the projector's flicker, frame to frame */
    float gr = grain(gl_FragCoord.xy / max(1., uFxPx), f) * (0.07 + 0.08 * (1. - g) * g * 4.) * K; g += gr;   /* grain, most in the middle tones */
    // scratches: a few running down the print, wandering a little, lasting a while; and dust: dark specks for a frame
    for (int i = 0; i < 3; i++) { float life = floor(f / (18. + float(i) * 11.)), on = step(0.55, hf1(life * 3.7 + float(i))), x = hf1(life + float(i) * 13.) * sz.x + sin(gl_FragCoord.y * 0.02 + f * 0.3) * 3.;
      g = mix(g, (i == 1 ? 0.92 : 0.12), on * K * 0.55 * smoothstep(1.2, 0., abs(gl_FragCoord.x - x))); }
    vec2 dq = floor(gl_FragCoord.xy / (3. * max(1., uFxPx))); if (hf(dq + f * 0.917) > 0.99985) g = mix(g, 0.05, K * 0.8);
    float v = length((vUv - 0.5) * vec2(1.15, 1.)); g *= 1. - smoothstep(0.38, 0.78, v) * 0.55 * K;   /* the lens's darkened edge */
    vec3 tone = mix(vec3(g), g * vec3(1.06, 1.0, 0.9) + vec3(0.02, 0.012, 0.), 0.6);   /* a faint warmth of the old print */
    c = mix(c, clamp(tone, 0., 1.), K); }
  if (uFx == 2) { float K = uFxK, f = float(uFrame);
    // edge enhancement: the camera's sharpening, a light ring at a dark edge and a dark one at a light edge
    vec3 l = texelFetch(uSrc, clamp(p - ivec2(2, 0), ivec2(0), ivec2(sz) - 1), 0).rgb, r = texelFetch(uSrc, clamp(p + ivec2(2, 0), ivec2(0), ivec2(sz) - 1), 0).rgb; float Lr = dot(l + r, vec3(0.15, 0.29, 0.06));
    float L0 = dot(c, vec3(0.299, 0.587, 0.114)); c = clamp(c + (L0 - Lr) * 0.35 * K, 0., 1.);
    // video's colour: blacks lifted, reds hot, a slight blue cast in the shade
    c = mix(c, c * vec3(1.02, 1.0, 0.985) * 0.93 + vec3(0.03, 0.03, 0.034), K * 0.8); float s = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(s), c, 1. + 0.12 * K);
    float line = mod(floor(gl_FragCoord.y / max(1., uFxPx)), 2.); c *= 1. - line * 0.06 * K;   /* the scanlines */
    c += (hf(floor(gl_FragCoord.xy / max(1., uFxPx)) + f * 1.3) - 0.5) * 0.035 * K;   /* tape noise */
    float v = length(vUv - 0.5); c *= 1. - smoothstep(0.55, 0.85, v) * 0.25 * K; }
  o = vec4(clamp(c, 0., 1.), 1.); }`;
// ---- smoke (review 107, brief 75 §2): each parcel a sphere of gas, ray-marched through in its own fragment ----
const SMOKE_VS = `#version 300 es
layout(location=0) in vec2 aCorner; layout(location=1) in vec4 aPR; layout(location=2) in vec4 aGas;   // corner of the card; centre and radius; density, heat, kind, seed
uniform mat4 uVP; uniform vec3 uRx, uUp; out vec2 vUv; flat out vec4 vGas; flat out float vR;
void main() { vUv = aCorner; vGas = aGas; vR = aPR.w; vec3 w = aPR.xyz + (uRx * aCorner.x + uUp * aCorner.y) * aPR.w; gl_Position = uVP * vec4(w, 1.); }`;
const SMOKE_FS = `#version 300 es
precision highp float;
in vec2 vUv; flat in vec4 vGas; flat in float vR; uniform vec3 uRx, uUp, uVd, uSun; uniform float uTime; uniform int uHDR, uToon; out vec4 o;
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
/** the gas's density at a point of the unit sphere: the parcel's own, falling to its edge, broken by moving noise (its finer swirls) */
float dens(vec3 q) { float r2 = dot(q, q); if (r2 > 1.) return 0.; vec3 n = q * 2.1 + vGas.w * 37. + vec3(0., 0., -uTime * 0.6);
  float b = vn(n) * 0.55 + vn(n * 2.3 + 11.) * 0.3 + vn(n * 5.1 - 7.) * 0.15; return vGas.x * max(0., (1. - r2) * 1.6 - 0.35) * smoothstep(0.25, 0.75, b + (1. - r2) * 0.35); }
float hg(float c, float g) { float g2 = g * g; return (1. - g2) / (4. * 3.14159 * pow(1. + g2 - 2. * g * c, 1.5)); }
/* the cartoon puff (the toon looks, docs/systems/103): a big round lobe and six smaller ones about it, each a ball facing
   the eye, the nearest surface wins; lit in three flat bands with a bluish shade, a dark line round every lobe's rim (the
   silhouette and the cauliflower's inner folds alike). As the parcel thins its lobes draw in a little, all together, and
   at the end it fades out softly (docs/systems/104 B-9: no popping, no breaking into dots). */
vec4 toonPuff(vec3 alb, float w) { float rho = vGas.x, sd = vGas.w, best = -9., rim = 0.; vec3 nb = vec3(0., 0., 1.);
  for (int k = 0; k < 7; k++) { float fk = float(k), a = sd * 6.283 + fk * 1.0472, hk = fract(sin(fk * 12.9898 + sd * 78.233) * 43758.5453);
    vec2 c = k == 0 ? vec2(0., -0.05) : vec2(cos(a), sin(a) * 0.8 + 0.1) * (0.42 + 0.1 * hk);
    float r = (k == 0 ? 0.6 : 0.3 + 0.1 * hk) * (0.85 + 0.15 * smoothstep(0.02, 0.25, rho));
    vec2 d = vUv - c; float q = dot(d, d); if (r < 0.02 || q > r * r) continue; float hz = sqrt(r * r - q), z = hz + (k == 0 ? 0.15 : 0.3 * hk - 0.1);
    if (z > best) { best = z; nb = vec3(d, hz) / r; rim = sqrt(q) > r - w ? 1. : 0.; } }
  if (best < -8.) return vec4(0.);
  vec3 n = normalize(uRx * nb.x + uUp * nb.y - uVd * nb.z); float lit = dot(n, uSun) * 0.5 + 0.5, band = lit > 0.64 ? 1. : lit > 0.4 ? 0.62 : 0.;
  vec3 shade = alb * vec3(0.52, 0.58, 0.78), c = mix(shade, alb, band); c = mix(c, vec3(0.16, 0.15, 0.17), rim); float A = smoothstep(0.015, 0.14, rho); return vec4(clamp(c, 0., 1.) * A, A); }
void main() { float lw = fwidth(vUv.x) * 1.7;   /* the toon's line, about two pixels (taken before any discard) */
  float r2 = dot(vUv, vUv); if (r2 > 1.) discard; float h = sqrt(1. - r2); int kind = int(vGas.z + 0.5);
  vec3 alb = kind == 1 ? vec3(0.62, 0.55, 0.42) : kind == 2 ? vec3(0.95) : kind == 3 ? vec3(0.62, 0.66, 0.72) : vec3(0.86, 0.85, 0.83);
  if (uToon == 1) { vec4 t = toonPuff(alb * 1.08, lw); if (t.a < 0.004) discard; o = t; return; }
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

// ---- the speed effects (docs/systems/114, render/live/trails.ts): thin ribbons through each anchor's recent places,
// widened across the eye's line in the vertex shader, never thinner than about a pixel (thinner: fainter instead) ----
const TRAIL_VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aT; layout(location=2) in vec3 aS;   // place; the trail's way; signed half width, opacity, kind
uniform mat4 uVP; uniform vec4 uCamP; uniform vec3 uVd; uniform vec2 uWpp; out float vA, vE; flat out float vK;
void main() { vec3 toEye = uCamP.w > .5 ? normalize(uCamP.xyz - aP) : -uVd, n = cross(aT, toEye); float l = length(n); n = l > 1e-4 ? n / l : vec3(0., 0., 1.);
  float wpp = uCamP.w > .5 ? uWpp.y * distance(uCamP.xyz, aP) : uWpp.x, hw = abs(aS.x), a = aS.y, lo = wpp * 0.8; if (hw < lo) { a *= hw / lo; hw = lo; }
  vA = a; vE = sign(aS.x); vK = aS.z; gl_Position = uVP * vec4(aP + n * hw * sign(aS.x), 1.); }`;
const TRAIL_FS = `#version 300 es
precision highp float;
in float vA, vE; flat in float vK; uniform int uHDR; out vec4 o;
void main() { float e = 1. - vE * vE, a = vA * smoothstep(0., .45, e); if (a < .003) discard;   /* a firm edge: drawn, not a glow */
  vec3 c = vK > .5 ? mix(vec3(1., .13, .1), vec3(1., .62, .5), e * e) : vec3(.93, .97, 1.);   /* a red light with a hot core; white with a little sky */
  if (uHDR == 1) c = pow(c, vec3(2.2)) * (vK > .5 ? 1.8 : 1.);
  o = vec4(c * a, a * (vK > .5 ? .5 : 1.)); }   /* premultiplied; the lamps' light adds more than it covers */`;

interface WheelDraw { hubZ: number; spin: number; def: Float32Array; sx: number; sy: number; R: number; rim: number }
type Piece = [{ vao: WebGLVertexArrayObject; n: number }, M4, WheelDraw?, Float32Array?];   // the last: a suspension piece's bones
export class LiveRenderer {
  readonly gl: WebGL2RenderingContext; private obj: WebGLProgram; private aoP: WebGLProgram; private downP: WebGLProgram; private upP: WebGLProgram; private finalP: WebGLProgram; readonly hdr: boolean;
  /** render targets after the scene: 0 occlusion, 1 the composed picture, 2-5 the bloom's halvings */ private rt: { t: WebGLTexture; f: WebGLFramebuffer; w: number; h: number }[] = []; private smoke: WebGLProgram; private smokeVao: WebGLVertexArrayObject | null = null; private smokeF: WebGLFramebuffer | null = null; private smokeBuf: WebGLBuffer | null = null; private ground: WebGLProgram; private depth: WebGLProgram; private post: WebGLProgram;
  private fbo: WebGLFramebuffer; private tCol: WebGLTexture; private tId: WebGLTexture; private tN: WebGLTexture; private tV: WebGLTexture; private prevVP: Float32Array | null = null; private prevCam: [number, number] | null = null; private prevM = new Map<string, M4>(); private ids = new WeakMap<GpuMesh, number>(); private nid = 0; private idOf(g: GpuMesh) { let k = this.ids.get(g); if (k === undefined) { k = this.nid++; this.ids.set(g, k); } return k; } private nextM = new Map<string, M4>(); private tDepth: WebGLTexture; private W = 0; private H = 0;
  private sFbo: WebGLFramebuffer; private sTex: WebGLTexture; private S = 2048;   // the shadow map's size: 4096 where the GPU allows and the pointer is fine (review 146: the full-window picture spread 2048 texels too thin, ~6 cm each, and small ledges cast stair-stepped shadows)
  private groundVao: WebGLVertexArrayObject | null = null; private groundN = 0; private fenceVao: WebGLVertexArrayObject | null = null; private fenceN = 0;
  private skidVao: WebGLVertexArrayObject; private skidBuf: WebGLBuffer; private kinds = new Map<string, GpuMesh>(); private cars = new Map<Mesh, GpuMesh>();
  private u = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>(); private blank: WebGLTexture; private arts = new Map<GpuMesh, { lut: WebGLTexture; tex: WebGLTexture; mm: number; C: number; rects: Float32Array; origins: Float32Array }>(); private tex: { alb: WebGLTexture; nor: WebGLTexture; rgh: WebGLTexture; size: Float32Array; luma: Float32Array; rough: Float32Array } | null = null;
  /** the volumetric smoke (docs/systems/104 B), set by the drive where the setting asks for it */ vol: VolumeSmoke | null = null;
  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, preserveDrawingBuffer: true }); if (!gl) throw new Error('no WebGL2'); this.gl = gl;
    this.obj = program(gl, OBJ_VS, OBJ_FS); this.ground = program(gl, GROUND_VS, GROUND_FS); this.depth = program(gl, DEPTH_VS, DEPTH_FS); this.propP = program(gl, PROP_VS, PROP_FS); this.depthI = program(gl, DEPTHI_VS, DEPTH_FS); this.post = program(gl, POST_VS, POST_FS); this.lineP = program(gl, LINE_VS, LINE_FS); this.smoke = program(gl, SMOKE_VS, SMOKE_FS);
    this.aoP = program(gl, POST_VS, AO_FS); this.downP = program(gl, POST_VS, DOWN_FS); this.upP = program(gl, POST_VS, UP_FS); this.finalP = program(gl, POST_VS, FINAL_FS);
    this.hdr = !!gl.getExtension('EXT_color_buffer_float'); gl.getExtension('OES_texture_float_linear');   /* a wide-range picture where the device can draw one */
    for (let k = 0; k < 6; k++) { this.rt.push({ t: gl.createTexture()!, f: gl.createFramebuffer()!, w: 0, h: 0 }); }
    this.fbo = gl.createFramebuffer()!; this.tCol = gl.createTexture()!; this.tId = gl.createTexture()!; this.tN = gl.createTexture()!; this.tV = gl.createTexture()!; this.tDepth = gl.createTexture()!;
    if ((gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) >= 8192 && !(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches)) this.S = 4096;
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
    b(0, d.pos, 3, gl.FLOAT, false); b(1, d.col, 3, gl.UNSIGNED_BYTE, true); b(2, d.flag, 1, gl.FLOAT, false); if (d.trk) b(3, d.trk, 3, gl.FLOAT, false); gl.bindVertexArray(null); return vao; }
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
  setGround(d: GroundData) { this.groundVao = this.vaoOf(d); this.groundN = d.n; this.setLayer(d.layer?.S ?? null); }
  /** the scenery's woods and still small things (review 181): built when another scenery comes (the old one freed), kept for the same one */
  private layer: { S: Scenery; woods: Woods | null; statics: LiveProp[] } | null = null;
  private setLayer(S: Scenery | null) { if (this.layer?.S === S) return; if (this.layer) { this.layer.woods?.free(); for (const p of this.layer.statics) freeGpu(this.gl, p.g); } this.layer = null; if (!S) return;
    const statics = staticChunks(S.detail ?? []).map(c => ({ g: gpuMesh(this.gl, c.mesh, false), x: c.origin[0], y: c.origin[1], z: 0, h: 0, m: mul(translate(...c.origin), scale(1 / 1000)), outline: 1 }));
    let woods: Woods | null = null; try { woods = S.trees?.length ? new Woods(this.gl, LIGHT, S.trees) : null; } catch (e) { console.warn('woods', e); }   /* the drive goes on without them */
    this.layer = { S, woods, statics }; }
  /** the woods drawn now (trees in 3D, as cards, triangles), for the page tests */
  get woodsStats() { return this.layer?.woods?.stats ?? null; }
  setFence(d: GroundData) { this.fenceVao = this.vaoOf(d); this.fenceN = d.n; }
  private frameN = 0; private propP!: WebGLProgram; private depthI!: WebGLProgram; private lineP!: WebGLProgram; private trailP: WebGLProgram | null = null; private trailVao: WebGLVertexArrayObject | null = null; private trailBuf: WebGLBuffer | null = null;
  /** the drift-game style's atlas (render/live/style.ts): the placeholder drawn by rule until a painted one is set */
  private atlas: { tex: WebGLTexture; rects: Float32Array } | null = null;
  setAtlas(a: Atlas) { const gl = this.gl; if (this.atlas) gl.deleteTexture(this.atlas.tex); const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, a.S, a.S, 0, gl.RGBA, gl.UNSIGNED_BYTE, a.data); gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); this.atlas = { tex: t, rects: a.rects }; }
  /** the photographed props (review 125): each model's buffers and pictures, and where its copies stand (their matrices) */
  private propModels = new Map<string, { vao: WebGLVertexArrayObject; n: number; alb: WebGLTexture; nor: WebGLTexture; arm: WebGLTexture; inst: WebGLBuffer; count: number }>();
  addPropModel(id: string, geo: { pos: Float32Array; nor: Float32Array; uv: Float32Array; idx: Uint32Array }, pics: { alb: TexImageSource; nor: TexImageSource; arm: TexImageSource }) { const gl = this.gl, vao = gl.createVertexArray()!; gl.bindVertexArray(vao);
    const b = (loc: number, d: Float32Array, size: number) => { const buf = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); };
    b(0, geo.pos, 3); b(1, geo.nor, 3); b(2, geo.uv, 2); const ib = gl.createBuffer()!; gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.idx, gl.STATIC_DRAW);
    const inst = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, inst); for (let k = 0; k < 4; k++) { gl.enableVertexAttribArray(3 + k); gl.vertexAttribPointer(3 + k, 4, gl.FLOAT, false, 64, k * 16); gl.vertexAttribDivisor(3 + k, 1); }
    gl.bindVertexArray(null);
    const tex = (img: TexImageSource) => { const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); return t; };
    this.propModels.set(id, { vao, n: geo.idx.length, alb: tex(pics.alb), nor: tex(pics.nor), arm: tex(pics.arm), inst, count: 0 }); }
  /** where a model's copies stand: each a matrix (column-major, the model's metres to the world's) */
  setPropInstances(id: string, mats: Float32Array) { const m = this.propModels.get(id); if (!m) return; const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, m.inst); gl.bufferData(gl.ARRAY_BUFFER, mats, gl.STATIC_DRAW); m.count = mats.length / 16; }
  /** the photographed sky (review 124): its four levels stacked in one picture (RGBM, sqrt rgb), the range, the nine numbers of its light */
  private sky: { tex: WebGLTexture; range: number; sh: Float32Array } | null = null;
  setSky(img: TexImageSource & { width: number; height: number }, range: number, sh: number[][]) { const gl = this.gl, w = img.width, h = img.height / 4, t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, w, h, 4, 0, gl.RGBA, gl.UNSIGNED_BYTE, img);   /* a stacked picture is cut into the layers */
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.sky = { tex: t, range, sh: new Float32Array(sh.flat()) }; }
  /** the ground's photographed materials (review 124): per layer its albedo, normal and packed (ao, rough, height)
   *  pictures, all of one size, and each layer's size on the ground (m) */
  private gTex: { alb: WebGLTexture; nor: WebGLTexture; pack: WebGLTexture; size: Float32Array } | null = null;
  setGroundMaterials(layers: { alb: TexImageSource; nor: TexImageSource; pack: TexImageSource }[], sizes: number[], res: number) { const gl = this.gl, n = layers.length, levels = Math.floor(Math.log2(res)) + 1, an = gl.getExtension('EXT_texture_filter_anisotropic');
    const arr = (pick: (l: typeof layers[number]) => TexImageSource) => { const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D_ARRAY, t); gl.texStorage3D(gl.TEXTURE_2D_ARRAY, levels, gl.RGBA8, res, res, n);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); layers.forEach((l, i) => gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, res, res, 1, gl.RGBA, gl.UNSIGNED_BYTE, pick(l))); gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
      if (an) gl.texParameterf(gl.TEXTURE_2D_ARRAY, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT))); return t; };
    this.gTex = { alb: arr(l => l.alb), nor: arr(l => l.nor), pack: arr(l => l.pack), size: new Float32Array(sizes) }; }
  /** the buildings' photographed materials (review 148): as the ground's, each layer three pictures; its tile's size (m) and mean colour (0..1, sRGB) */
  private bTex: { alb: WebGLTexture; nor: WebGLTexture; pack: WebGLTexture; size: Float32Array; mean: Float32Array } | null = null;
  setBuildingMaterials(layers: { alb: TexImageSource; nor: TexImageSource; pack: TexImageSource }[], sizes: number[], means: number[][], res: number) { const keep = this.gTex; this.setGroundMaterials(layers, sizes, res);
    const t = this.gTex!; this.gTex = keep; this.bTex = { alb: t.alb, nor: t.nor, pack: t.pack, size: t.size, mean: new Float32Array(means.flatMap(m => m.map(v => Math.max(8, v) / 255))) }; }
  /** the track for the concrete (review 122): its length and width, the joints' spacing, the start line's distance, and the line the cars drive (offset at each metre) */
  private trackU = { len: 1, w: 30, joint: 12, start: 0 }; private lineTex: WebGLTexture | null = null;
  /** the grid's numbers (review 125): sixteen places' figures side by side, white on nothing, in a heavy hand-painted face */
  private digits: WebGLTexture | null = null; gridN = 16;
  private makeDigits() { if (this.digits || typeof document === 'undefined') return; const gl = this.gl, S = 128, c = document.createElement('canvas'); c.width = S * 16; c.height = S; const x = c.getContext('2d')!;
    x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let n = 0; n < 16; n++) { const t = String(n + 1); x.font = `900 ${t.length > 1 ? 100 : 124}px Rockwell, 'Clarendon', Georgia, 'Times New Roman', serif`; x.save(); x.translate(n * S + S / 2, S / 2 + 4); x.scale(t.length > 1 ? 0.78 : 1, 1); x.fillText(t, 0, 0); x.restore(); }
    const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, c); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); this.digits = t; }
  setTrack(len: number, width: number, joint: number, start: number, line?: Float32Array) { this.trackU = { len, w: width, joint, start }; this.makeDigits(); if (!line) return; const gl = this.gl, rows = Math.ceil(line.length / 128), data = new Float32Array(rows * 128); data.set(line);
    const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 128, rows, 0, gl.RED, gl.FLOAT, data); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); this.lineTex = t; }
  /** the GPU copy of a prop's mesh (by kind) or a car's (by its mesh object), made once */
  prop(kind: string, make: () => Mesh): GpuMesh { let g = this.kinds.get(kind); if (!g) { g = gpuMesh(this.gl, make(), false); this.kinds.set(kind, g); } return g; }
  car(M: Mesh): GpuMesh { let g = this.cars.get(M); if (!g) { g = gpuMesh(this.gl, M, true); this.cars.set(M, g); } return g; }
  /** a car's mesh replaced by another (its deformed self, review 121): the new one on the GPU with the old one's art, the old one freed */
  swapCar(old: Mesh, M: Mesh): GpuMesh { const og = this.cars.get(old), g = gpuMesh(this.gl, M, true); this.cars.set(M, g);
    if (og) { const a = this.arts.get(og); if (a) { this.arts.set(g, a); this.arts.delete(og); } freeGpu(this.gl, og); this.cars.delete(old); } return g; }
  forget(M: Mesh) { this.cars.delete(M); }
  /** the scene's set pieces taken off (the ground, the fence, the track's line, the props' copies, the ground's and the
   *  buildings' materials), to be put back later: one renderer shows the game page's screens in turn (ui/shell), each
   *  its own scene, while the sky, the car textures and the GPU copies of the meshes stay loaded */
  takeScene(): LiveScene { const s: LiveScene = { ground: [this.groundVao, this.groundN], fence: [this.fenceVao, this.fenceN], track: { ...this.trackU }, line: this.lineTex, gTex: this.gTex, bTex: this.bTex,
      props: new Map([...this.propModels].map(([id, m]) => [id, m.count])), layer: this.layer }; this.layer = null;
    this.groundVao = null; this.groundN = 0; this.fenceVao = null; this.fenceN = 0; this.lineTex = null; this.gTex = null; this.bTex = null; for (const m of this.propModels.values()) m.count = 0;
    this.prevVP = null; this.prevM.clear(); return s; }
  /** a scene taken off put back (what was set meanwhile is dropped; props loaded meanwhile keep no copies) */
  putScene(s: LiveScene) { [this.groundVao, this.groundN] = s.ground; [this.fenceVao, this.fenceN] = s.fence; this.trackU = { ...s.track }; this.lineTex = s.line; this.gTex = s.gTex as typeof this.gTex; this.bTex = s.bTex as typeof this.bTex;
    for (const [id, m] of this.propModels) m.count = s.props.get(id) ?? 0; this.layer = (s.layer as typeof this.layer) ?? null; this.prevVP = null; this.prevM.clear(); }

  render(v: LiveView, cars: LiveCar[], props: LiveProp[], skids: Skid[], o: { glass?: number; /** 0 the baked look, 1 PBR stepped, 2 PBR smooth, 3 toon (review 92) */ look?: number; /** the toon look: its bands (2 or 3), how far its shade's hue moves (0 plain darker, 1 as set, up to 1.5) */ toonBands?: number; toonShade?: number; /** the toon glass's reflection: 0 off, 0.5 weak, 1 as made (default) (docs/systems/104 A) */ glassRefl?: number; /** lay the 2D art on (default yes) */ art?: boolean; /** the rays in the picture: occlusion, contact shadows, reflections (default yes) */ rays?: boolean; /** strengths: the textures, the light (1: as set) */ texK?: number; /** the time of day: 1 day (default), toward 0 dusk and night (review 117) */ day?: number; /** the concrete from photographed materials (default yes, once loaded) (review 124) */ photoGround?: boolean; /** the photographed sky in the mirrors and the light (default yes, once loaded) */ hdri?: boolean; /** the photographed props (review 125) */ props?: boolean; /** the period's pictures (review 129): 1 a 1930s newsreel, 2 a 1990s television broadcast; their strength; the size of a film or video pixel on screen */ fx?: number; fxK?: number; fxPx?: number; /** the colour's depth: deeper lacquer, the hue kept through the tone curve (0: as before; default 1) (review 116) */ deep?: number; lightK?: number; /** after the scene: occlusion and reflection strengths, bloom, depth of field (0 none; pixels of blur a metre from the focus) */ aoK?: number; reflK?: number; bloomK?: number; dof?: number; /** motion blur: the shutter, a share of a frame (0 none) */ mb?: number; /** the outline: width (times each thing's own; 0 none), darkness 0..1; the lines inside a thing (default: the baked look only), their darkness */ outW?: number; outK?: number; inner?: boolean; inK?: number; /** smoke parcels: centre, radius, density, heat, kind (0 tyre 1 dust 2 steam 3 exhaust), seed; and the time */ smoke?: { p: Float32Array; n: number; time: number };
    /** the sun's direction (toward it, world axes; default from the upper left of the default view) */ sun?: [number, number, number];
    /** the drift-game style (look 4, docs/systems/109 §5): the inverted hull's outline and the drawn lines (default on), the outline pass filling the gaps (default on); their widths (px at 1080 high: 2.5 and 1.75), the picture's device pixel ratio, the ink; the atlas (default on) */
    style?: LiveStyle;
    /** the speed effects' ribbons (render/live/trails.ts ribbon: RIBBON_FLOATS a vertex), how many vertices */ trails?: { v: Float32Array; n: number } } = {}) { const gl = this.gl; this.size(v.W, v.H);
    const fr = o.look === 4, look = fr ? 3 : o.look ?? 0, SUN = o.sun ? (() => { const l = Math.hypot(...o.sun!) || 1; return o.sun!.map(c => c / l) as [number, number, number]; })() : SUN_W, st = o.style ?? {}, ink = st.ink ?? [0.045, 0.045, 0.055];   /* look 4: the toon look's world, the style's cars */
    const toon = (look) === 3, toonTo = (p: WebGLProgram) => { gl.uniform1f(this.loc(p, 'uToonB'), o.toonBands ?? 3); gl.uniform1f(this.loc(p, 'uToonS'), o.toonShade ?? 1); };
    // ---- the camera: orthographic, turned to v.ang, tilted down by v.pitch, v.mm millimetres a pixel, snapped to whole pixels ----
    const a = v.ang - Math.PI / 2, cA = Math.cos(a), sA = Math.sin(a), SP = Math.sin(v.pitch * Math.PI / 180), CP = Math.cos(v.pitch * Math.PI / 180), k = 1000 / v.mm, R = 900;
    const rx = [cA, sA, 0], ry = [-sA, cA, 0], up = [ry[0]! * SP, ry[1]! * SP, CP], vd = [ry[0]! * CP, ry[1]! * CP, -SP], c = [v.x, v.y, v.z], dot = (p: number[], q: number[]) => p[0]! * q[0]! + p[1]! * q[1]! + p[2]! * q[2]!;
    const VP = new Float32Array(16), pv = v.fov && v.eye ? { e: v.eye, n: v.near ?? 0.2, f: 3000, ty: Math.tan(v.fov * Math.PI / 360) } : null;
    if (pv) { const sy = 1 / pv.ty, sx = sy * v.H / v.W, A = (pv.f + pv.n) / (pv.f - pv.n), B = -2 * pv.f * pv.n / (pv.f - pv.n);   // the perspective camera: a frustum from the eye
      for (let i = 0; i < 3; i++) { VP[i * 4] = rx[i]! * sx; VP[i * 4 + 1] = up[i]! * sy; VP[i * 4 + 2] = vd[i]! * A; VP[i * 4 + 3] = vd[i]!; }
      VP[12] = -dot(pv.e, rx) * sx; VP[13] = -dot(pv.e, up) * sy; VP[14] = -dot(pv.e, vd) * A + B; VP[15] = -dot(pv.e, vd); } else {
    VP[0] = rx[0]! * 2 * k / v.W; VP[4] = rx[1]! * 2 * k / v.W; VP[12] = Math.round(v.W / 2 - dot(c, rx) * k) * 2 / v.W - 1;
    VP[1] = up[0]! * 2 * k / v.H; VP[5] = up[1]! * 2 * k / v.H; VP[9] = up[2]! * 2 * k / v.H; VP[13] = 1 - 2 * Math.round(v.H * v.cy + dot(c, up) * k) / v.H;
    VP[2] = vd[0]! / R; VP[6] = vd[1]! / R; VP[10] = vd[2]! / R; VP[14] = -dot(c, vd) / R; VP[15] = 1; }
    const eye = [-vd[0]!, -vd[1]!, -vd[2]!], eyeTo = (p: WebGLProgram) => { gl.uniform3fv(this.loc(p, 'uEyeD'), eye); gl.uniform3fv(this.loc(p, 'uEye'), eye);   /* a shader with the one direction only (the woods') */ gl.uniform4f(this.loc(p, 'uCamP'), pv ? pv.e[0] : 0, pv ? pv.e[1] : 0, pv ? pv.e[2] : 0, pv ? 1 : 0); };
    if (this.prevCam && Math.hypot(v.x - this.prevCam[0], v.y - this.prevCam[1]) > 15) { this.prevVP = null; this.prevM.clear(); }   /* a cut (the car put back, a new shot): no smear from the jump */ this.prevCam = [v.x, v.y];
    // ---- the sun's view for the shadows: around the camera's target, as far as the picture reaches ----
    const reach = pv ? 75 : Math.min(160, Math.hypot(v.W, v.H / Math.max(0.2, SP)) * v.mm / 2000 + 12), lz = SUN.map(x => -x), lx0 = [lz[1]!, -lz[0]!, 0], ll = Math.hypot(lx0[0]!, lx0[1]!), lx = [lx0[0]! / ll, lx0[1]! / ll, 0];
    const ly = [lz[1]! * lx[2]! - lz[2]! * lx[1]!, lz[2]! * lx[0]! - lz[0]! * lx[2]!, lz[0]! * lx[1]! - lz[1]! * lx[0]!], LR = 200, LV = new Float32Array(16);
    const tx = Math.round(dot(c, lx) / (2 * reach / this.S)) * (2 * reach / this.S), ty = Math.round(dot(c, ly) / (2 * reach / this.S)) * (2 * reach / this.S);   // snapped to the map's texels: shadows hold still
    LV[0] = lx[0]! / reach; LV[4] = lx[1]! / reach; LV[8] = lx[2]! / reach; LV[12] = -tx / reach; LV[1] = ly[0]! / reach; LV[5] = ly[1]! / reach; LV[9] = ly[2]! / reach; LV[13] = -ty / reach;
    LV[2] = lz[0]! / LR; LV[6] = lz[1]! / LR; LV[10] = lz[2]! / LR; LV[14] = -dot(c, lz) / LR; LV[15] = 1;
    const seen = pv ? 650 : reach, near = (x: number, y: number, r: number) => Math.abs(x - v.x) < seen + r + 20 && Math.abs(y - v.y) < seen + r + 20;
    const W = this.layer?.woods; W?.update(pv ? pv.e[0] : v.x, pv ? pv.e[1] : v.y, !pv, seen);
    const ps = (this.layer ? props.concat(this.layer.statics) : props).filter(p => near(p.x, p.y, p.g.radius)), carM = cars.map(q => this.carParts(q));
    if (fr) { for (const q of cars) { const g = q.g; for (const p of [g.body, g.glass, ...(g.susp ? [g.susp.part] : []), ...(g.inner ? [g.inner.part] : []), ...(g.dials ? [g.dials.part] : []), ...g.wheels.flatMap(w => w.glass ? [w.part, w.glass] : [w.part])]) styleUp(gl, p); } if (!this.atlas && st.atlas !== false) this.setAtlas(makeAtlas(1024)); }   /* look 4: each car's style layers, made once */
    // the head lamps alight (review 117): each lamp's middle and beam in the world, the nearest eight
    const lmpP: number[] = [], lmpD: number[] = []; cars.forEach((q, i) => { if (!q.lamps) return; const B = carM[i]!.body; for (const l of q.g.lamps) { if (l.flag !== 1 || lmpP.length >= 24) continue;
        const [x, y, z] = l.c, [a, b, c] = l.ax, wx = B[0]! * x + B[4]! * y + B[8]! * z + B[12]!, wy = B[1]! * x + B[5]! * y + B[9]! * z + B[13]!, wz = B[2]! * x + B[6]! * y + B[10]! * z + B[14]!;
        let dx = B[0]! * a + B[4]! * b + B[8]! * c, dy = B[1]! * a + B[5]! * b + B[9]! * c, dz = B[2]! * a + B[6]! * b + B[10]! * c; const hl = Math.hypot(dx, dy) || 1; dx /= hl; dy /= hl; dz = -0.1; const dl = Math.hypot(dx, dy, dz);
        lmpP.push(wx + dx * 0.15, wy + dy * 0.15, wz); lmpD.push(dx / dl, dy / dl, dz / dl); } });
    const lampsTo = (p: WebGLProgram) => { gl.uniform1i(this.loc(p, 'uLmpN'), lmpP.length / 3); if (lmpP.length) { gl.uniform3fv(this.loc(p, 'uLmpP'), lmpP); gl.uniform3fv(this.loc(p, 'uLmpD'), lmpD); } };
    // ---- the shadow map ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sFbo); gl.viewport(0, 0, this.S, this.S); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT); gl.disable(gl.BLEND); gl.disable(gl.STENCIL_TEST);
    gl.useProgram(this.depth); gl.uniformMatrix4fv(this.loc(this.depth, 'uVP'), false, LV);
    const drawD = (part: { vao: WebGLVertexArrayObject; n: number }, M: M4, bones?: Float32Array) => { if (!part.n) return; gl.uniform1i(this.loc(this.depth, 'uSkin'), bones ? 1 : 0); if (bones) gl.uniform4fv(this.loc(this.depth, 'uBone'), bones); gl.uniformMatrix4fv(this.loc(this.depth, 'uModel'), false, M); gl.bindVertexArray(part.vao); gl.drawArrays(gl.TRIANGLES, 0, part.n); };
    for (const p of ps) drawD(p.g.body, (p.m ?? placeMesh(p.g.len, p.x, p.y, p.z, p.h))); for (const m of carM) for (const [part, M, , b] of m.opaque) drawD(part, M, b);
    if (this.propModels.size) { gl.useProgram(this.depthI); gl.uniformMatrix4fv(this.loc(this.depthI, 'uVP'), false, LV); for (const m of this.propModels.values()) if (m.count) { gl.bindVertexArray(m.vao); gl.drawElementsInstanced(gl.TRIANGLES, m.n, gl.UNSIGNED_INT, 0, m.count); } }
    W?.drawDepth(LV);
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
    const shadowTo = (p: WebGLProgram) => { texTo(p); boxTo(p); { const S = o.hdri !== false ? this.sky : null; gl.uniform1i(this.loc(p, 'uSkyOn'), S ? 1 : 0); gl.activeTexture(gl.TEXTURE9); gl.bindTexture(gl.TEXTURE_2D_ARRAY, S?.tex ?? null); gl.uniform1i(this.loc(p, 'uSky'), 9); if (S) { gl.uniform1f(this.loc(p, 'uSkyR'), S.range); gl.uniform3fv(this.loc(p, 'uSH'), S.sh); } } gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.sTex); gl.uniform1i(this.loc(p, 'uShadow'), 1); gl.uniformMatrix4fv(this.loc(p, 'uLight'), false, LV); };
    gl.useProgram(this.ground); lampsTo(this.ground); { const g = this.ground, t = this.trackU; gl.uniform1f(this.loc(g, 'uLen'), t.len); gl.uniform1f(this.loc(g, 'uTW'), t.w); gl.uniform1f(this.loc(g, 'uJoint'), t.joint); gl.uniform1f(this.loc(g, 'uStart'), t.start); gl.uniform1i(this.loc(g, 'uLineOn'), this.lineTex ? 1 : 0); gl.activeTexture(gl.TEXTURE12); gl.bindTexture(gl.TEXTURE_2D, this.lineTex ?? this.blank); gl.uniform1i(this.loc(g, 'uLine'), 12);
      gl.uniform1i(this.loc(g, 'uGridN'), this.digits ? this.gridN : 0); gl.activeTexture(gl.TEXTURE0 + 16); gl.bindTexture(gl.TEXTURE_2D, this.digits ?? this.blank); gl.uniform1i(this.loc(g, 'uDigits'), 16);
      const G = this.gTex; gl.uniform1i(this.loc(g, 'uGTex'), G && o.photoGround !== false ? 1 : 0); if (G) gl.uniform1fv(this.loc(g, 'uGSize'), G.size); ([[G?.alb ?? null, 'uGAlb', 13], [G?.nor ?? null, 'uGNor', 14], [G?.pack ?? null, 'uGPack', 15]] as const).forEach(([t, nm, u]) => { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D_ARRAY, t); gl.uniform1i(this.loc(g, nm), u); }); } gl.uniform1f(this.loc(this.ground, 'uDay'), o.day ?? 1); gl.uniformMatrix4fv(this.loc(this.ground, 'uVP'), false, VP); const hdrOn = this.hdr && (look) === 2 ? 1 : 0; gl.uniform1i(this.loc(this.ground, 'uHDRo'), hdrOn); gl.uniform1f(this.loc(this.ground, 'uSpecK'), 1); gl.uniformMatrix4fv(this.loc(this.ground, 'uPrevVP'), false, this.prevVP ?? VP); gl.uniform2f(this.loc(this.ground, 'uSize'), v.W, v.H); gl.uniform1i(this.loc(this.ground, 'uLook'), look); gl.uniform1f(this.loc(this.ground, 'uTexK'), o.texK ?? 1); gl.uniform1f(this.loc(this.ground, 'uLightK'), o.lightK ?? 1); gl.uniform3fv(this.loc(this.ground, 'uSun'), SUN); eyeTo(this.ground); gl.uniform2f(this.loc(this.ground, 'uLinG'), pv ? pv.n : 0, pv ? pv.f : 0); gl.uniform1f(this.loc(this.ground, 'uCell'), Math.max(0.03, v.mm / 1000)); gl.uniform1f(this.loc(this.ground, 'uBias'), 0); shadowTo(this.ground); toonTo(this.ground);
    if (this.groundVao) { gl.bindVertexArray(this.groundVao); gl.drawArrays(gl.TRIANGLES, 0, this.groundN); }
    if (this.fenceVao && this.fenceN) { gl.bindVertexArray(this.fenceVao); gl.drawArrays(gl.TRIANGLES, 0, this.fenceN); }
    // skid marks: dark patches on the concrete, blended, nothing else written
    if (skids.length) { const S = skids.filter(m => near(m.x, m.y, 0)), f = new Float32Array(S.length * 6 * 8), r = 0.09;
      S.forEach((m, i) => { const q = [[-r, -r], [r, -r], [r, r], [-r, -r], [r, r], [-r, r]]; q.forEach(([dx, dy], j) => f.set([m.x + dx!, m.y + dy!, m.z + 0.01, 30 / 255, 28 / 255, 26 / 255, m.a, 0], (i * 6 + j) * 8)); });
      gl.bindBuffer(gl.ARRAY_BUFFER, this.skidBuf); gl.bufferData(gl.ARRAY_BUFFER, f, gl.DYNAMIC_DRAW); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE, gl.NONE, gl.NONE]);
      gl.uniform1f(this.loc(this.ground, 'uBias'), 0.00002); gl.bindVertexArray(this.skidVao); gl.drawArrays(gl.TRIANGLES, 0, S.length * 6); gl.disable(gl.BLEND); gl.depthMask(true); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2, gl.COLOR_ATTACHMENT3]); }
    gl.useProgram(this.obj); lampsTo(this.obj); gl.uniform1f(this.loc(this.obj, 'uDay'), o.day ?? 1); gl.uniformMatrix4fv(this.loc(this.obj, 'uVP'), false, VP); gl.uniform1i(this.loc(this.obj, 'uHDRo'), hdrOn); gl.uniformMatrix4fv(this.loc(this.obj, 'uPrevVP'), false, this.prevVP ?? VP); gl.uniform2f(this.loc(this.obj, 'uSize'), v.W, v.H); gl.uniform1f(this.loc(this.obj, 'uSpecK'), o.reflK ?? 1); gl.uniform1f(this.loc(this.obj, 'uDeep'), o.deep ?? 1); gl.uniform1i(this.loc(this.obj, 'uLook'), look); gl.uniform1f(this.loc(this.obj, 'uTexK'), o.texK ?? 1); gl.uniform1f(this.loc(this.obj, 'uLightK'), o.lightK ?? 1); eyeTo(this.obj); gl.uniform3fv(this.loc(this.obj, 'uSun'), SUN); gl.uniform1f(this.loc(this.obj, 'uGlass'), o.glass ?? 0.8); gl.uniform1f(this.loc(this.obj, 'uGlassR'), o.glassRefl ?? 1); shadowTo(this.obj); toonTo(this.obj); gl.uniform1i(this.loc(this.obj, 'uIsCar'), 0);
    gl.uniform1i(this.loc(this.obj, 'uDecTex'), 2);
    { const A = fr && st.atlas !== false ? this.atlas : null; gl.uniform1i(this.loc(this.obj, 'uFR'), fr ? 1 : 0); gl.uniform1i(this.loc(this.obj, 'uSeamOff'), fr && st.lines !== false ? 1 : 0); gl.uniform1i(this.loc(this.obj, 'uAtlOn'), A ? 1 : 0); gl.uniform1f(this.loc(this.obj, 'uHull'), 0); gl.uniform2f(this.loc(this.obj, 'uVpx'), v.W, v.H); gl.uniform3fv(this.loc(this.obj, 'uInk'), ink);
      gl.activeTexture(gl.TEXTURE23); gl.bindTexture(gl.TEXTURE_2D, A ? A.tex : this.blank); gl.uniform1i(this.loc(this.obj, 'uAtlas'), 23); if (A) gl.uniform4fv(this.loc(this.obj, 'uAtl'), A.rects); }
    { const B = o.photoGround !== false ? this.bTex : null; gl.uniform1i(this.loc(this.obj, 'uBTex'), B ? 1 : 0); if (B) { gl.uniform1fv(this.loc(this.obj, 'uBSize'), B.size); gl.uniform3fv(this.loc(this.obj, 'uBMean'), B.mean); }
      ([[B?.alb ?? null, 'uBAlb', 20], [B?.nor ?? null, 'uBNor', 21], [B?.pack ?? null, 'uBPack', 22]] as const).forEach(([t, nm, u]) => { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D_ARRAY, t); gl.uniform1i(this.loc(this.obj, nm), u); }); }
    const artTo = (g: GpuMesh | null) => { const a = g && o.art !== false ? this.arts.get(g) : undefined; gl.uniform1i(this.loc(this.obj, 'uArtOn'), a ? 1 : 0); gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, a ? a.tex : this.blank); gl.uniform1i(this.loc(this.obj, 'uArt'), 6); gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, a ? a.lut : this.blank); gl.uniform1i(this.loc(this.obj, 'uArtLut'), 7); if (!a) return;
      gl.uniform1f(this.loc(this.obj, 'uArtMM'), a.mm); gl.uniform1f(this.loc(this.obj, 'uArtC'), a.C); gl.uniform4fv(this.loc(this.obj, 'uArtR'), a.rects); gl.uniform2fv(this.loc(this.obj, 'uArtO'), a.origins); };
    artTo(null);
    let id = 1; const objU = (outline: number) => { gl.uniform2f(this.loc(this.obj, 'uObj'), (id & 255) / 255, ((id >> 8) & 255) / 255); gl.uniform1f(this.loc(this.obj, 'uOutline'), outline); id++; };
    const draw = (part: { vao: WebGLVertexArrayObject; n: number }, M: M4, w?: WheelDraw, key?: string, bones?: Float32Array) => { if (!part.n) return; if (bones) gl.uniform4fv(this.loc(this.obj, 'uBone'), bones); gl.uniformMatrix4fv(this.loc(this.obj, 'uModel'), false, M); gl.uniformMatrix4fv(this.loc(this.obj, 'uPrevModel'), false, (key && this.prevM.get(key)) || M); if (key) this.nextM.set(key, M); gl.uniform1i(this.loc(this.obj, 'uWheel'), w ? 1 : bones ? 2 : 0);
      if (!w) gl.uniform1f(this.loc(this.obj, 'uObjZ'), 0); if (w) { gl.uniform1f(this.loc(this.obj, 'uSpin'), w.spin); gl.uniform1f(this.loc(this.obj, 'uObjZ'), w.hubZ); gl.uniform1fv(this.loc(this.obj, 'uDef'), w.def); gl.uniform2f(this.loc(this.obj, 'uShift'), w.sx, w.sy); gl.uniform1f(this.loc(this.obj, 'uTyreR'), w.R); gl.uniform1f(this.loc(this.obj, 'uRim'), w.rim); } gl.bindVertexArray(part.vao); gl.drawArrays(gl.TRIANGLES, 0, part.n); };
    const decals = (g: GpuMesh | null) => { const n = g ? g.decals.length : 0; gl.uniform1i(this.loc(this.obj, 'uDecN'), n); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, n ? g!.decalTex : this.blank); if (!g || !n) return;
      gl.uniform3fv(this.loc(this.obj, 'uDecO'), g.decals.flatMap(d => d.o)); gl.uniform3fv(this.loc(this.obj, 'uDecN_'), g.decals.flatMap(d => { const l = Math.hypot(...d.n); return d.n.map(x => x / l); }));
      gl.uniform3fv(this.loc(this.obj, 'uDecUp'), g.decals.flatMap(d => { const l = Math.hypot(...d.up); return d.up.map(x => x / l); })); gl.uniform1fv(this.loc(this.obj, 'uDecR'), g.decals.map(d => d.r)); };
    gl.uniform1i(this.loc(this.obj, 'uMode'), 0); gl.uniform1f(this.loc(this.obj, 'uBias'), 0); decals(null); gl.uniform1f(this.loc(this.obj, 'uLampOn'), 0); gl.uniform1f(this.loc(this.obj, 'uBrake'), 0);
    const tw = Math.max(0.7, Math.min(1.6, v.H / 540)) * Math.sqrt(16 / v.mm);   /* toon: the line by the scale and the picture's size, thicker close to */
    const outlineC = toon ? Math.max(1, Math.min(5, Math.round(3.2 * tw))) : Math.max(1, Math.min(3, Math.round(3 * 50 / v.mm))), outlineP = toon ? Math.max(1, Math.min(3, Math.round(2 * tw))) : Math.max(1, Math.min(2, Math.round(2 * 50 / v.mm)));
    gl.uniform3f(this.loc(this.obj, 'uWear'), 0, 0, 0); for (const p of ps) { objU(p.outline ?? outlineP); draw(p.g.body, (p.m ?? placeMesh(p.g.len, p.x, p.y, p.z, p.h)), undefined, p.key); }
    if (this.propModels.size && o.props !== false) { const P = this.propP; gl.useProgram(P); lampsTo(P); gl.uniform1f(this.loc(P, 'uDay'), o.day ?? 1); gl.uniformMatrix4fv(this.loc(P, 'uVP'), false, VP); gl.uniform1i(this.loc(P, 'uHDRo'), hdrOn); gl.uniformMatrix4fv(this.loc(P, 'uPrevVP'), false, this.prevVP ?? VP); gl.uniform2f(this.loc(P, 'uSize'), v.W, v.H);
      gl.uniform1f(this.loc(P, 'uSpecK'), o.reflK ?? 1); gl.uniform1f(this.loc(P, 'uDeep'), o.deep ?? 1); gl.uniform1i(this.loc(P, 'uLook'), Math.max(1, look)); gl.uniform1f(this.loc(P, 'uTexK'), o.texK ?? 1); gl.uniform1f(this.loc(P, 'uLightK'), o.lightK ?? 1); eyeTo(P); gl.uniform3fv(this.loc(P, 'uSun'), SUN); shadowTo(P); toonTo(P);
      gl.uniform1f(this.loc(P, 'uOutline'), outlineP);
      for (const m of this.propModels.values()) { if (!m.count) continue; gl.uniform2f(this.loc(P, 'uObj'), (id & 255) / 255, ((id >> 8) & 255) / 255); id++; ([[m.alb, 'uPA', 17], [m.nor, 'uPN', 18], [m.arm, 'uPR', 19]] as const).forEach(([t, nm, u]) => { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(this.loc(P, nm), u); });
        gl.bindVertexArray(m.vao); gl.drawElementsInstanced(gl.TRIANGLES, m.n, gl.UNSIGNED_INT, 0, m.count); }
      gl.useProgram(this.obj); }
    if (W) { W.draw((P, ow) => { gl.useProgram(P); lampsTo(P); gl.uniform1f(this.loc(P, 'uDay'), o.day ?? 1); gl.uniformMatrix4fv(this.loc(P, 'uVP'), false, VP); gl.uniform1i(this.loc(P, 'uHDRo'), hdrOn); gl.uniformMatrix4fv(this.loc(P, 'uPrevVP'), false, this.prevVP ?? VP); gl.uniform2f(this.loc(P, 'uSize'), v.W, v.H);   /* the woods (review 181) */
        gl.uniform1i(this.loc(P, 'uLook'), Math.max(1, look)); gl.uniform1f(this.loc(P, 'uLightK'), o.lightK ?? 1); gl.uniform1f(this.loc(P, 'uSpecK'), o.reflK ?? 1); eyeTo(P); gl.uniform3fv(this.loc(P, 'uSun'), SUN); shadowTo(P); toonTo(P);
        gl.uniform1f(this.loc(P, 'uOutline'), ow); gl.uniform2f(this.loc(P, 'uObj'), (id & 255) / 255, ((id >> 8) & 255) / 255); id++; }, pv ? pv.e : [v.x, v.y, v.z]); gl.useProgram(this.obj); }
    // the cars a thing hides: their light outline first, tested against what stands before them (each pixel once), then the cars over it
    gl.uniform1i(this.loc(this.obj, 'uMode'), 1); gl.depthFunc(gl.GREATER); gl.depthMask(false); gl.enable(gl.STENCIL_TEST); gl.stencilFunc(gl.EQUAL, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE, gl.NONE, gl.NONE]); gl.uniform1f(this.loc(this.obj, 'uBias'), 0.25 / R);
    cars.forEach((q, i) => { gl.uniform4f(this.loc(this.obj, 'uSil'), 1, 226 / 255, 168 / 255, q.player ? 0.6 : 0.4); for (const [part, M, w, b] of carM[i]!.opaque) draw(part, M, w, undefined, b); });
    gl.disable(gl.STENCIL_TEST); gl.disable(gl.BLEND); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2, gl.COLOR_ATTACHMENT3]); gl.uniform1f(this.loc(this.obj, 'uBias'), 0); gl.uniform1i(this.loc(this.obj, 'uMode'), 0);
    gl.uniform1i(this.loc(this.obj, 'uIsCar'), 1); const carIds: number[] = []; cars.forEach((q, i) => { carIds[i] = id; objU(fr ? 0 : outlineC);   /* look 4: the hull draws the cars' outline, not the outline pass */ const m = carM[i]!; gl.uniform1f(this.loc(this.obj, 'uLampOn'), q.lamps ?? 0); gl.uniform1f(this.loc(this.obj, 'uBrake'), q.brake ? 1 : 0); gl.uniform1i(this.loc(this.obj, 'uSelf'), boxIdx.get(q) ?? -1); gl.uniform3fv(this.loc(this.obj, 'uWear'), q.wear ?? [0, 0, 0]); gl.uniform1f(this.loc(this.obj, 'uCarH'), q.g.height); artTo(q.g); decals(q.g); draw(q.g.body, m.body, undefined, `c${this.idOf(q.g)}:0`); decals(null); m.opaque.slice(1).forEach(([part, M, w, b], j) => draw(part, M, w, `c${this.idOf(q.g)}:${j + 1}`, b)); });
    if (fr && cars.length) this.styleInk(v, cars, carM, carIds, VP, st, ink, pv ? pv.ty : 0, eyeTo, draw);
    // glass over all, at its own strength, nothing else written
    gl.uniform1i(this.loc(this.obj, 'uMode'), 2); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   /* premultiplied (review 116) */ gl.depthMask(false); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE, gl.NONE, gl.NONE]);
    gl.uniform3f(this.loc(this.obj, 'uWear'), 0, 0, 0); gl.uniform1i(this.loc(this.obj, 'uIsCar'), 0); for (const p of ps) draw(p.g.glass, (p.m ?? placeMesh(p.g.len, p.x, p.y, p.z, p.h))); gl.uniform1i(this.loc(this.obj, 'uIsCar'), 1); cars.forEach((q, i) => { gl.uniform1f(this.loc(this.obj, 'uLampOn'), q.lamps ?? 0); gl.uniform1f(this.loc(this.obj, 'uBrake'), q.brake ? 1 : 0); gl.uniform1f(this.loc(this.obj, 'uCarH'), q.g.height); gl.uniform1f(this.loc(this.obj, 'uCarL'), q.g.len); for (const [part, M, w] of carM[i]!.glass) draw(part, M, w); }); gl.uniform1f(this.loc(this.obj, 'uLampOn'), 0); gl.uniform1f(this.loc(this.obj, 'uBrake'), 0);
    gl.disable(gl.BLEND); gl.depthMask(true);
    // ---- after the scene (review 111): occlusion, then the picture composed (reflections, occlusion, outlines), the bloom, the end ----
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.STENCIL_TEST); gl.disable(gl.BLEND); gl.bindVertexArray(null); const rays = (look) > 0 && !toon && o.rays !== false && !pv, RT = this.rt;   /* toon: no traced reflections or occlusion (its shade is in bands) */
    const tex = (p: WebGLProgram, name: string, unit: number, t: WebGLTexture) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(this.loc(p, name), unit); };
    const to = (k: number | null) => { if (k === null) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, v.W, v.H); } else { gl.bindFramebuffer(gl.FRAMEBUFFER, RT[k]!.f); gl.viewport(0, 0, RT[k]!.w, RT[k]!.h); } };
    if (rays) { to(0); gl.useProgram(this.aoP); tex(this.aoP, 'uDepth', 0, this.tDepth); tex(this.aoP, 'uN', 1, this.tN); gl.uniformMatrix4fv(this.loc(this.aoP, 'uVP'), false, VP); gl.uniform3fv(this.loc(this.aoP, 'uSunD'), SUN); gl.uniform1f(this.loc(this.aoP, 'uRange'), R); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    to(1); gl.useProgram(this.post); tex(this.post, 'uAO', 9, RT[0]!.t); gl.uniform1f(this.loc(this.post, 'uAOK'), o.aoK ?? 1); gl.uniform1f(this.loc(this.post, 'uReflK'), o.reflK ?? 1);
    [this.tCol, this.tId, this.tDepth].forEach((t, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(this.loc(this.post, ['uCol', 'uId', 'uDepth'][i]!), i); });
    gl.uniform1i(this.loc(this.post, 'uInner'), (fr ? st.post !== false : o.inner ?? (look === 0 || toon)) ? 1 : 0); gl.uniform1i(this.loc(this.post, 'uFR'), fr ? 1 : 0); gl.uniform3fv(this.loc(this.post, 'uInk'), ink); gl.uniform1i(this.loc(this.post, 'uToon'), toon ? 1 : 0); gl.uniform1f(this.loc(this.post, 'uOutW'), o.outW ?? 1); gl.uniform1f(this.loc(this.post, 'uOutK'), o.outK ?? 1); gl.uniform1f(this.loc(this.post, 'uInK'), o.inK ?? 1); gl.uniform1f(this.loc(this.post, 'uRayK'), Math.min(1.8, o.lightK ?? 1)); gl.uniform1i(this.loc(this.post, 'uRays'), rays ? 1 : 0); gl.uniformMatrix4fv(this.loc(this.post, 'uVP'), false, VP); gl.uniform3fv(this.loc(this.post, 'uVd'), vd); gl.uniform3fv(this.loc(this.post, 'uSunD'), SUN);
    gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, this.tN); gl.uniform1i(this.loc(this.post, 'uN'), 8); gl.uniform1f(this.loc(this.post, 'uRange'), R); gl.uniform2f(this.loc(this.post, 'uLin'), pv ? pv.n : 0, pv ? pv.f : 0); gl.uniform1i(this.loc(this.post, 'uSky'), pv ? (hdrOn ? 2 : 1) : 0); gl.uniform1f(this.loc(this.post, 'uDay'), o.day ?? 1); gl.uniform3fv(this.loc(this.post, 'uRx'), rx); gl.uniform3fv(this.loc(this.post, 'uUpV'), up); gl.uniform2f(this.loc(this.post, 'uTan'), pv ? pv.ty * v.W / v.H : 0, pv ? pv.ty : 0);   /* PBR: no lines over the shading inside a thing, its outline only */ gl.uniform1f(this.loc(this.post, 'uStep'), (60 + 2 * v.mm / Math.tan(Math.max(5, v.pitch) * Math.PI / 180)) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    for (let i = 0; i < 6; i++) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, this.blank); }
    // smoke over the composed picture (after the outlines and the reflections, so neither shows through dense smoke),
    // depth-tested against the scene: parcels far to near, then the volume. Its own framebuffer: the picture and the depth
    if (!this.smokeF) this.smokeF = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, this.smokeF); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, RT[1]!.t, 0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.TEXTURE_2D, this.tDepth, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]); gl.viewport(0, 0, v.W, v.H); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.STENCIL_TEST);
    // the speed effects' ribbons first (docs/systems/114): over the outlines (they have none), under the smoke, which covers them where it is dense
    if (o.trails && o.trails.n) { const T = o.trails; if (!this.trailP) { this.trailP = program(gl, TRAIL_VS, TRAIL_FS); this.trailVao = gl.createVertexArray()!; gl.bindVertexArray(this.trailVao); this.trailBuf = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, this.trailBuf);
        for (let i = 0; i < 3; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 3, gl.FLOAT, false, 36, i * 12); } gl.bindVertexArray(null); }
      const P = this.trailP; gl.useProgram(P); gl.uniformMatrix4fv(this.loc(P, 'uVP'), false, VP); gl.uniform4f(this.loc(P, 'uCamP'), pv ? pv.e[0] : 0, pv ? pv.e[1] : 0, pv ? pv.e[2] : 0, pv ? 1 : 0); gl.uniform3fv(this.loc(P, 'uVd'), vd);
      gl.uniform2f(this.loc(P, 'uWpp'), v.mm / 1000, pv ? 2 * pv.ty / v.H : 0); gl.uniform1i(this.loc(P, 'uHDR'), hdrOn);
      gl.bindVertexArray(this.trailVao); gl.bindBuffer(gl.ARRAY_BUFFER, this.trailBuf); gl.bufferData(gl.ARRAY_BUFFER, T.v.subarray(0, T.n * 9), gl.DYNAMIC_DRAW);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.drawArrays(gl.TRIANGLES, 0, T.n); gl.bindVertexArray(null); gl.disable(gl.BLEND); gl.depthMask(true); gl.useProgram(this.obj); }
    if (o.smoke && o.smoke.n) { const S = o.smoke; if (!this.smokeVao) { this.smokeVao = gl.createVertexArray()!; gl.bindVertexArray(this.smokeVao); const corners = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, corners); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); this.smokeBuf = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, this.smokeBuf);
        gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(1, 1); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(2, 1); gl.bindVertexArray(null); }
      const idx = Array.from({ length: S.n }, (_, k) => k).sort((a, b) => dot([S.p[b * 8]!, S.p[b * 8 + 1]!, S.p[b * 8 + 2]!], vd) - dot([S.p[a * 8]!, S.p[a * 8 + 1]!, S.p[a * 8 + 2]!], vd)), sorted = new Float32Array(S.n * 8);
      idx.forEach((k, j) => sorted.set(S.p.subarray(k * 8, k * 8 + 8), j * 8));
      gl.useProgram(this.smoke); gl.uniformMatrix4fv(this.loc(this.smoke, 'uVP'), false, VP); gl.uniform3fv(this.loc(this.smoke, 'uRx'), rx); gl.uniform3fv(this.loc(this.smoke, 'uUp'), up); gl.uniform3fv(this.loc(this.smoke, 'uVd'), vd); gl.uniform3fv(this.loc(this.smoke, 'uSun'), SUN); gl.uniform1f(this.loc(this.smoke, 'uTime'), S.time); gl.uniform1i(this.loc(this.smoke, 'uHDR'), hdrOn); gl.uniform1i(this.loc(this.smoke, 'uToon'), toon ? 1 : 0);
      gl.bindVertexArray(this.smokeVao); gl.bindBuffer(gl.ARRAY_BUFFER, this.smokeBuf); gl.bufferData(gl.ARRAY_BUFFER, sorted, gl.DYNAMIC_DRAW);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, S.n);
      gl.disable(gl.BLEND); gl.depthMask(true); gl.useProgram(this.obj); }
    if (this.vol?.active) { this.vol.draw({ VP, W: v.W, H: v.H, depth: this.tDepth, col: RT[1]!.t, fbo: this.smokeF, hdr: hdrOn === 1, toon, toonBands: o.toonBands, sun: SUN, day: o.day ?? 1 }); gl.useProgram(this.obj); }   // the volumetric smoke (docs/systems/104 B: render/live/volume), its grid run by the drive
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(true);
    const bloomK = o.bloomK ?? 1;
    if (bloomK > 0) { gl.useProgram(this.downP); gl.uniform1f(this.loc(this.downP, 'uThresh'), hdrOn ? 1.7 : 0.9);
      for (let k = 2; k <= 5; k++) { to(k); tex(this.downP, 'uSrc', 0, RT[k - 1]!.t); gl.uniform1i(this.loc(this.downP, 'uFirst'), k === 2 ? 1 : 0); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.blank); }
      gl.useProgram(this.upP); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      for (let k = 4; k >= 2; k--) { to(k); tex(this.upP, 'uSrc', 0, RT[k + 1]!.t); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.blank); }
      gl.disable(gl.BLEND); }
    to(null); gl.useProgram(this.finalP); tex(this.finalP, 'uSrc', 0, RT[1]!.t); tex(this.finalP, 'uDepth', 1, this.tDepth); tex(this.finalP, 'uBloom', 2, RT[2]!.t); tex(this.finalP, 'uVel', 3, this.tV); gl.uniform1f(this.loc(this.finalP, 'uMB'), o.mb ?? 0);
    gl.uniform1f(this.loc(this.finalP, 'uBloomK'), bloomK > 0 ? bloomK * (hdrOn ? 0.55 : 0.4) : 0); gl.uniform1f(this.loc(this.finalP, 'uDof'), pv ? 0 : (o.dof ?? 0) * 0.8); gl.uniform1f(this.loc(this.finalP, 'uDeep'), o.deep ?? 1); gl.uniform1i(this.loc(this.finalP, 'uFx'), o.fx ?? 0); gl.uniform1f(this.loc(this.finalP, 'uFxK'), o.fxK ?? 1); gl.uniform1i(this.loc(this.finalP, 'uFrame'), this.frameN++); gl.uniform1f(this.loc(this.finalP, 'uFxPx'), o.fxPx ?? 1); gl.uniform1f(this.loc(this.finalP, 'uRange'), R); gl.uniform1f(this.loc(this.finalP, 'uFocus'), 0.5 + 0.6 * vd[2]! / (2 * R));   /* focused at the car's middle height over the target */ gl.uniform1i(this.loc(this.finalP, 'uHDR'), hdrOn);
    gl.drawArrays(gl.TRIANGLES, 0, 3); for (let i = 0; i < 4; i++) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, this.blank); }
    this.prevVP = VP; this.prevM = this.nextM; this.nextM = new Map(); }

  /** look 4's ink over the cars just drawn (docs/systems/109 §5.1-5.2): the inverted hull (each piece again, its faces
   *  toward the eye culled, pushed out along its hull normals by the outline's width on the screen, in ink, marked for
   *  the outline pass), then the drawn lines as ribbons, blended into the colour only */
  private styleInk(v: LiveView, cars: LiveCar[], carM: { body: M4; opaque: Piece[] }[], carIds: number[], VP: Float32Array, st: LiveStyle, ink: [number, number, number], ty: number,
    eyeTo: (p: WebGLProgram) => void, draw: (part: { vao: WebGLVertexArrayObject; n: number }, M: M4, w?: WheelDraw, key?: string, bones?: Float32Array) => void) { const gl = this.gl, dpr = st.dpr ?? 1;
    const det = (m: M4) => m[0]! * (m[5]! * m[10]! - m[6]! * m[9]!) - m[4]! * (m[1]! * m[10]! - m[2]! * m[9]!) + m[8]! * (m[1]! * m[6]! - m[2]! * m[5]!);
    if (st.outline !== false) { gl.uniform1i(this.loc(this.obj, 'uMode'), 3); gl.uniform1f(this.loc(this.obj, 'uHull'), screenPx((st.outPx ?? STYLE.outlinePx) * lineWeight.k, v.H, dpr)); gl.enable(gl.CULL_FACE);
      cars.forEach((q, i) => { const cid = carIds[i]!; gl.uniform2f(this.loc(this.obj, 'uObj'), (cid & 255) / 255, ((cid >> 8) & 255) / 255);
        for (const [part, M, w, b] of carM[i]!.opaque) { gl.cullFace(det(M) < 0 ? gl.BACK : gl.FRONT); draw(part, M, w, undefined, b); } });   /* a mirrored placing turns the winding over: cull what then faces the eye */
      gl.disable(gl.CULL_FACE); gl.uniform1f(this.loc(this.obj, 'uHull'), 0); gl.uniform1i(this.loc(this.obj, 'uMode'), 0); }
    if (st.lines === false) return; const P = this.lineP; gl.useProgram(P); gl.uniformMatrix4fv(this.loc(P, 'uVP'), false, VP); gl.uniform2f(this.loc(P, 'uVpx'), v.W, v.H); gl.uniform3fv(this.loc(P, 'uInk'), ink); eyeTo(P);
    gl.uniform1f(this.loc(P, 'uW'), screenPx((st.linePx ?? STYLE.linePx) * lineWeight.k, v.H, dpr)); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE, gl.NONE, gl.NONE]);
    cars.forEach((q, i) => { const L = styleLines(gl, q.g), m = carM[i]!; if (!L.body && !L.susp) return;
      const wpp = v.eye && ty ? 2 * Math.hypot(q.x - v.eye[0], q.y - v.eye[1], q.z - v.eye[2]) * ty / v.H : v.mm / 1000; gl.uniform1f(this.loc(P, 'uLift'), Math.max(STYLE.lift, Math.min(0.03, wpp * 1.5)));   /* a pixel and a half toward the eye, at least 4 mm */
      gl.uniformMatrix4fv(this.loc(P, 'uModel'), false, m.body);
      if (L.body) { gl.uniform1i(this.loc(P, 'uSkin'), 0); gl.bindVertexArray(L.body.vao); gl.drawArrays(gl.TRIANGLES, 0, L.body.n); }
      const sp = q.g.susp ? m.opaque.find(x => x[0] === q.g.susp!.part) : undefined; if (L.susp && sp?.[3]) { gl.uniform1i(this.loc(P, 'uSkin'), 1); gl.uniform4fv(this.loc(P, 'uBone'), sp[3]); gl.bindVertexArray(L.susp.vao); gl.drawArrays(gl.TRIANGLES, 0, L.susp.n); } });
    gl.disable(gl.BLEND); gl.depthMask(true); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2, gl.COLOR_ATTACHMENT3]); gl.useProgram(this.obj); }
  /** a car's pieces with their matrices: the body on its springs (rolled and pitched about its middle), each wheel at its
   *  hub, turned on its axle and the front ones steered */
  private carParts(q: LiveCar): { body: M4; opaque: Piece[]; glass: Piece[] } {
    const g = q.g, base = placeMesh(g.len, q.x, q.y, q.z, q.yaw), mid = translate(g.len / 2, 0, 0), back = translate(-g.len / 2, 0, 0);
    const body = mul(base, mul(mid, mul(rot('x', q.roll), mul(rot('y', q.pitch), back))));
    const opaque: Piece[] = [[g.body, body]], glass: Piece[] = [[g.glass, body]];
    // a car with a suspension rig: the linkage solved for each wheel's travel and steer (render/car/suspension), its parts by their
    // bones in one draw, each wheel where its upright carries it (the camber and the toe are the linkage's own)
    const pose = g.susp ? poseRig(g.susp.rig, (q.travel ?? [0, 0, 0, 0]).map(t => t * 1000), q.steerL, q.steerR, q.spin) : null; if (pose) opaque.push([g.susp!.part, body, undefined, pose.bones]);
    if (g.inner) opaque.push([g.inner.part, body, undefined, poseInternals(g.inner.rig, q.crank ?? 0)]);   // an engine's insides at the crank's angle, on their bones in one draw
    if (g.dials) opaque.push([g.dials.part, body, undefined, poseDials(g.dials.rig, q.dials, new Float32Array(BONE_SLOTS * 12))]);   // a cabin's needles at their readings (and its steering wheel), on their bones in one draw
    for (const w of g.wheels) { const left = w.hub[1] > 0, wi = (w.front ? 0 : 2) + (left ? 0 : 1), pw = pose?.wheels[wi];
      const M = pw ? mul(body, mul(translate(w.hub[0] + pw.wc[0] - pw.from[0], w.hub[1] + pw.wc[1] - pw.from[1], w.hub[2] + pw.wc[2] - pw.from[2]), m4of(pw.R))) : mul(body, mul(translate(w.hub[0], w.hub[1], w.hub[2] + (q.travel?.[wi] ?? 0) * 1000), mul(w.front ? rot('z', -(left ? q.steerL : q.steerR)) : translate(0, 0, 0), rot('x', -(q.camber?.[wi] ?? 0)))));
      const ty = q.tyres?.[(w.front ? 0 : 2) + (left ? 0 : 1)], def = new Float32Array(32); if (ty) for (let k = 0; k < 32; k++) def[k] = ty.u[k]! * 1000;
      const wd: WheelDraw = { hubZ: w.hub[2], spin: q.spin, def, sx: (ty?.sx ?? 0) * 1000, sy: (ty?.sy ?? 0) * 1000, R: w.R, rim: w.rim };
      opaque.push([w.part, M, wd]); if (w.glass) glass.push([w.glass, M, wd]); }
    return { body, opaque, glass }; }
}
