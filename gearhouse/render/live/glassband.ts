// The toon glass's reflection (docs/systems/104 part A, review 183): the shader's band function (render/live/renderer.ts,
// the glass branch of the toon look) written out again in plain numbers, line for line, so it can be tested. The glass
// mirrors a drawn sky: the reflected ray R = reflect(-eye, n) read for its height, plus a tilt across the pane (from the
// pane's own normal: a windscreen near level, a side window aslant) and a little of the pane's height on the car (a
// bend, so a flat pane is not one colour). Three steps: the ground's dark below the horizon, a white band just above it,
// the sky's blue higher; the edges a pixel or two (the shader's fwidth, here `w`). Fresnel: weak and clear head-on (the
// cabin seen through), strong at a glancing angle. A small sun glint where R meets the sun.
// World and object axes alike: z up. The car's own axes are the object's (mm); its height in metres.

export type V3 = readonly [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** the GLSL smoothstep with a width that may be nothing (a hard step) */
const edge = (at: number, w: number, x: number) => w <= 0 ? (x >= at ? 1 : 0) : smooth(at - w, at + w, x);

/** the steps' heights in e (the reflected ray's tilted height): the ground below GROUND_E, the band to SKY_E, the sky above */
export const GROUND_E = 0, SKY_E = 0.2;
/** how much the pane's height on the car moves e (per share of the car's height), the share where it is nothing */
export const BEND = 1.3, BEND_AT = 0.78;
/** the sun glint: the cosine where it starts */
export const SUN_COS = 0.996;

/** the tilt across a pane by its normal (object axes, toward the eye): nothing for a pane lying back (a windscreen, a rear
 *  window), up to 0.8 for an upright one (a side window) */
export function paneSlant(no: V3): number { return 0.8 * (1 - smooth(0.3, 0.7, Math.abs(no[2]))); }
/** the pane's level axis: across it, square to its normal and to up (the same side of the picture for every pane seen) */
export function paneAcross(n: V3): V3 { const c: V3 = [-n[1], n[0], 0]; return Math.hypot(c[0], c[1]) < 1e-4 ? [1, 0, 0] : norm(c); }
/** the band's angle on the pane against the pane's level axis (radians; 0 level): where e stays the same, over the pane */
export function bandAngle(no: V3, carH = 1.2): number { const up = Math.hypot(no[0], no[1]);   // the pane's up axis rises by |n.xy| per metre along it
  const gUp = BEND / Math.max(0.8, carH) * up, gAcross = paneSlant(no); return Math.atan2(gAcross, Math.max(1e-6, gUp)); }

export interface BandIn {
  /** the pane's normal in the world, toward the eye; toward the eye; toward the sun (all unit) */
  n: V3; v: V3; sun: V3;
  /** the pane's normal in the car's own axes (toward the eye), the point in them (mm), the car's height (m); a prop's glass: carH 0 (no bend) */
  no: V3; p: V3; carH: number;
  /** the setting (0 off, 0.5 weak, 1 as made), the day (1 noon .. 0 night), the edge's half width in e (0: hard steps), lit by the sun (0..1) */
  k: number; day?: number; w?: number; sh?: number;
  /** the glass's own strength (the renderer's `glass`, 0.8) and its clearness (1; a tinted pane less) */
  glass?: number; clear?: number;
}
export interface BandOut { e: number; /** 0 ground, 1 band, 2 sky (between, on an edge) */ step: number; fres: number; sun: number; rgb: [number, number, number]; a: number }

/** the reflected ray's tilted height: what the steps are cut by */
export function bandE(n: V3, v: V3, no: V3, p: V3, carH: number): number {
  const nv = dot(n, v), R: V3 = [2 * nv * n[0] - v[0], 2 * nv * n[1] - v[1], 2 * nv * n[2] - v[2]];
  const s = paneSlant(no), tw = paneAcross(n), to = paneAcross(no);
  const bend = carH > 0 ? BEND * (p[2] / 1000 / Math.max(0.8, carH) - BEND_AT) : 0;
  return R[2] + 0.35 * s * dot(R, tw) + bend + s * dot(p, to) / 1000; }

/** the glass's colour, premultiplied (rgb already times a), as the shader writes it */
export function glassBand(i: BandIn): BandOut {
  const day = i.day ?? 1, w = i.w ?? 0, sh = i.sh ?? 1, nv = clamp(dot(i.n, i.v), 0, 1);
  const e = bandE(i.n, i.v, i.no, i.p, i.carH);
  const up = edge(GROUND_E, w, e), sky = edge(SKY_E, w, e), step = up + sky;   // 0 ground, 1 band, 2 sky
  const g = 1 - nv, fres = 0.1 + 0.9 * g * g;
  const tint: V3 = [0.12 * (0.3 + 0.7 * day), 0.16 * (0.3 + 0.7 * day), 0.24 * (0.3 + 0.7 * day)];
  const A0 = clamp(0.3 + 0.62 * (i.glass ?? 0.8), 0, 1) * (i.clear ?? 1) * (0.45 + 0.55 * smooth(0.1, 0.8, g));   // the tint: clear head-on, the cabin seen
  const lit = 0.25 + 0.75 * day;
  const cG: V3 = [0.16, 0.17, 0.19], cB: V3 = [0.95 * lit, 0.97 * lit, 1 * lit], cS: V3 = [0.55 * lit, 0.72 * lit, 0.92 * lit];
  const aG = 0.55 * fres, aB = 0.3 + 0.65 * fres, aS = 0.15 + 0.6 * fres;
  const mixv = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const c = mixv(mixv(cG, cB, up), cS, sky), lerp = (a: number, b: number, t: number) => a + (b - a) * t, ar = lerp(lerp(aG, aB, up), aS, sky) * clamp(i.k, 0, 1);
  const nvR = dot(i.n, i.v), R: V3 = [2 * nvR * i.n[0] - i.v[0], 2 * nvR * i.n[1] - i.v[1], 2 * nvR * i.n[2] - i.v[2]];
  const sun = edge(SUN_COS, w * 0.05, dot(R, i.sun)) * sh * clamp(i.k * 2, 0, 1) * day;
  let rgb: [number, number, number] = [c[0] * ar + tint[0] * A0 * (1 - ar), c[1] * ar + tint[1] * A0 * (1 - ar), c[2] * ar + tint[2] * A0 * (1 - ar)];
  let a = ar + A0 * (1 - ar);
  rgb = [rgb[0] + (1 - rgb[0]) * sun, rgb[1] + (1 - rgb[1]) * sun, rgb[2] + (1 - rgb[2]) * sun]; a = a + (1 - a) * sun;
  return { e, step, fres, sun, rgb, a }; }
