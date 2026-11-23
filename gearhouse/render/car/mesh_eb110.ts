// The 1991-95 Bugatti EB110 GT as a low-polygon mesh (docs/systems/70_mesh_car_rules.md), built afresh (review 128)
// as one smooth envelope in the manner of mesh_jagD55.ts.
//
// Proportions: the real car's only.
//   length 4400, width 1940, height 1125, wheelbase 2550, front track 1550, rear track 1618 mm; tyres 245/40 ZR18
//   and 325/30 ZR18 (radius 326)                      - auto-data.net, carsales.com.au, cararac.com, Wikipedia
//   Not published anywhere found: the overhangs (taken 1090 front, 760 rear, from the car's side elevation in
//   photographs: the sum is 4400 - 2550), the ground clearance (about 115), the main heights (wing crest 736 over the
//   front axle, belt 745-860, engine deck 1100 falling to 790 at the tail): those are read from photographs.
// Design: the user's sheet docs/reference/eb110_xj220_sheet.png (left column), for the shapes and their flow, each
//   feature carried over as a share of the real dimensions, never as the sheet's pixels.
//
// Construction: the body is one grid of points, a ring of 54 at each of some sixty stations. Five lines run the length
// of the car and every ring passes through them: the centre line's top (C), the wing crest that becomes the screen
// pillar, the roof's edge and the buttress's crest (A), the shoulder that is the side glass's foot (B), the widest
// line (W) and the sill (S). Each line is a smooth curve (a monotone cubic through a short table), so no station
// steps against its neighbour; between the lines a ring is a cubic (top), a parabola (glass, wing top) and two
// Bezier arcs (shoulder, flank), so the flanks lean in to the glass and tuck under to the sill. A ring is not flat:
// its top bows forward toward the centre line (BOW), so the nose and tail are round in plan and one ring lies along
// the windscreen's curved foot. The glass is the grid's own cells between those lines (the cabin is hollow behind
// it); the wheel arches are cut by sliding the flank's points up to the arch, none collapsed.
// `wing` 0: the blade lies in the tail .. 1: raised 110 mm on its two struts, its trailing edge tilted up.
import { Build, type Mesh, type V } from './mesh';

const PAINT = '#1b3a8a', SEAM = '#0c1a45', FRAME = '#14151a', TRIM = '#25272d', SEAT = '#8d8e94', SEAT2 = '#6c6d73', GLASS = '#a9c2cc', SILVER = '#c4c7cc', CHROME = '#d4d6d9', RUBBER = '#26242b', DARK = '#131318', LENS = '#eef0f2', RED = '#c9221f', RED2 = '#8e1a1a', AMBER = '#e8901c';
const GLOSS = 0.6;
const L = 4400, FX = 1040, RX = FX + 2550, R = 326, WYF = 775, WYR = 809, TWF = 245, TWR = 310;   // the axles, the tyres' radius, half the tracks, the tyres' widths
const RAF = 345, RAR = 362, YINF = 618, YINR = 628;                                                 // the wheel arches' radii; the wells' inner walls
const S0 = 110, S1 = 4340;                                                                          // the first and last rings (where their flanks stand; their centres reach 0 and 4400)
const SB = 1480, ST = 2010, SP = 2530;              // the rings along the screen's foot, the screen's top, the door glass's back edge
const PB = 2.2;                                                                        // the bow's shape across the car
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** a smooth curve through a table of [x, value]: a monotone cubic (it never overshoots a point, so a level run stays level) */
function curve(tab: [number, number][]): (x: number) => number { const n = tab.length, h: number[] = [], d: number[] = [], m: number[] = [];
  for (let i = 0; i + 1 < n; i++) { h[i] = tab[i + 1]![0] - tab[i]![0]; d[i] = (tab[i + 1]![1] - tab[i]![1]) / h[i]!; }
  for (let i = 0; i < n; i++) { if (i === 0 || i === n - 1) { m[i] = d[i === 0 ? 0 : n - 2]!; continue; } const a = d[i - 1]!, c = d[i]!; if (a * c <= 0) { m[i] = 0; continue; } const w1 = 2 * h[i]! + h[i - 1]!, w2 = h[i]! + 2 * h[i - 1]!; m[i] = (w1 + w2) / (w1 / a + w2 / c); }
  return x => { if (x <= tab[0]![0]) return tab[0]![1]; if (x >= tab[n - 1]![0]) return tab[n - 1]![1]; let i = 0; while (x > tab[i + 1]![0]) i++; const t = (x - tab[i]![0]) / h[i]!, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * tab[i]![1] + (t3 - 2 * t2 + t) * h[i]! * m[i]! + (3 * t2 - 2 * t3) * tab[i + 1]![1] + (t3 - t2) * h[i]! * m[i + 1]!; }; }

// ---- the five lines, each against the ring's place s (the flank's x), but for the centre line's height, which is against its own x ----
/** half the width at the widest line (plan) */
const W = curve([[110, 640], [122, 662], [150, 700], [200, 745], [300, 800], [400, 840], [500, 862], [600, 880], [800, 905], [1040, 915], [1500, 918], [2100, 928], [2400, 936], [2600, 952], [2800, 963], [3000, 970], [3300, 972], [3590, 970], [3800, 965], [4000, 952], [4100, 935], [4200, 905], [4290, 866], [4325, 846], [4337, 838], [4340, 835]]);   // the sheet's plan (data/cars/spec/eb110.json)
/** how far the ring's centre stands ahead of its flank: the round nose, the screen's curved foot, the tail (behind: negative) */
const BOW = curve([[110, 110], [600, 110], [1000, 200], [SB, 395], [1700, 250], [ST, 40], [2400, 0], [4050, 0], [4200, -8], [4340, -12]]);
/** the shoulder (the glass's foot) as a part of the half-width: the tumblehome; the crest/pillar/roof edge as a part of the shoulder's */
const FB = curve([[110, 0.93], [1100, 0.93], [SB, 0.895], [SP, 0.885], [3250, 0.9], [3590, 0.915], [4340, 0.93]]);
const FA = curve([[110, 0.8], [600, 0.84], [1100, 0.9], [SB, 0.943], [1650, 0.82], [1830, 0.71], [ST, 0.6], [SP, 0.595], [3000, 0.63], [3600, 0.72], [4340, 0.8]]);
/** the centre line's top against x: the nose's lip, the bonnet (15 degrees), the screen (23), the roof, the engine cover (9) down to the tail's edge */
const ZC = curve([[0, 345], [20, 352], [45, 362], [92, 410], [187, 466], [281, 513], [376, 557], [470, 599], [565, 640], [659, 683], [754, 721], [848, 750], [943, 768], [1085, 790], [1179, 839], [1321, 891], [1463, 938], [1604, 985], [1746, 1030], [1888, 1068], [1983, 1094], [2060, 1104], [2124, 1108], [2266, 1115], [2361, 1118], [2502, 1115], [2644, 1110], [2786, 1097], [2928, 1087], [3070, 1073], [3211, 1058], [3353, 1040], [3495, 1018], [3637, 990], [3778, 959], [3950, 945], [4150, 925], [4300, 905], [4360, 880], [4388, 850], [4397, 815], [4400, 780]]);   // the sheet's side profile
const xA = (s: number) => s - BOW(s) * (1 - FA(s) ** PB);
/** the A line's height: the wing's crest; along the screen the pillar lies in the screen's own surface; the roof's edge; the buttress's crest */
const ZA = curve([[110, 372], [122, 394], [150, 420], [220, 455], [410, 520], [610, 585], [860, 680], [1040, 748], [1250, 790], [1400, 808],
  ...[0, 1, 2, 3, 4, 5, 6].map(k => { const s = SB + (ST - SB) * k / 6; return [s, 812 + (ZC(xA(ST)) - 22 - 812) * k / 6] as [number, number]; }),   // the pillar: straight in the side view, from the wing's crest at the screen's corner to the roof
  [2120, 1090], [2266, 1097], [2361, 1100], [2502, 1097], [2644, 1090], [2800, 1074], [2928, 1062], [3070, 1058], [3353, 1026], [3637, 976], [3778, 946], [3950, 932], [4150, 912], [4240, 900], [4290, 893], [4325, 880], [4337, 862], [4340, 838]]);
const ZB = curve([[110, 340], [122, 360], [150, 384], [220, 418], [410, 484], [610, 552], [860, 652], [1040, 722], [1250, 764], [SB, 790], [1700, 792], [2000, 790], [2300, 798], [SP, 808], [2800, 836], [3050, 860], [3300, 874], [3590, 882], [3900, 880], [4150, 874], [4240, 868], [4290, 860], [4325, 844], [4337, 824], [4340, 800]]);
const ZW = curve([[110, 285], [300, 335], [600, 430], [1040, 505], [1600, 520], [2400, 545], [3000, 590], [3590, 620], [4100, 610], [4340, 590]]);
const ZS = curve([[110, 150], [300, 130], [700, 120], [3590, 128], [3960, 150], [4015, 215], [4150, 262], [4250, 340], [4340, 455]]);   // rising behind the rear wheel: the diffuser (the sheet's bottom line)
/** how far the sill stands in from the widest line */
const UND = curve([[110, 30], [700, 45], [2400, 55], [3640, 45], [4340, 25]]);
/** the roof's fall at its edge (and the bonnet's and deck's at the crest) */
const MAI = curve([[110, -0.04], [400, 0], [SB, -0.05], [ST, -0.1], [SP, -0.12], [3150, -0.06], [4340, -0.04]]);
const YB = (s: number) => FB(s) * W(s), YA = (s: number) => FA(s) * YB(s);
/** the wheel arch's height at s: a half circle over each hub (0 away from the wheels) */
const archZ = (s: number) => { for (const [hx, ra] of [[FX, RAF], [RX, RAR]] as const) { const dx = s - hx; if (Math.abs(dx) <= ra + 1e-6) return R + Math.sqrt(Math.max(0, ra * ra - dx * dx)); } return 0; };
/** the scoop in the door and the rear wing ahead of the side intake: its depth at s (it deepens to the intake's mouth) */
const SC0 = 1500, SC1 = 2900, scoop = (s: number) => s < SC0 || s > SC1 + 1 ? 0 : 58 * sm(SC0, 2600, s);

// a ring's points, centre top to centre bottom: NCA across the top to the A line, NAB to the shoulder, the flank at TS, three underneath
const NCA = 7, NAB = 4, TS = [0, 0.2, 0.4, 0.6, 0.8, 1, 1.12, 1.24, 1.3, 1.5, 1.72, 1.86, 1.92, 2], JA = NCA, JB = NCA + NAB, JS = JB + TS.length - 1, NJ = JS + 4, SCK0 = 8, SCK1 = 11;
/** half a ring (y >= 0) at s */
function half(s: number): V[] { const w = W(s), yB = FB(s) * w, fa = FA(s), yA = fa * yB, bow = BOW(s), zC = ZC(s - bow), zA = ZA(s), zB = ZB(s), zW = ZW(s), yS = w - UND(s), zS = ZS(s), zF = zS - 12;
  const cr = sm(FX, SB, s) * (1 - sm(3300, 3900, s));                                                    // how sharp the edges at A and B are: the glass's edges, not the bonnet's or the tail's
  // the top is laid on the slope the centre line has there (a), so a ring that bows across a flat bonnet or the screen stays in its plane
  const a = Math.max(-0.3, Math.min(0.45, (ZC(s - bow + 15) - ZC(s - bow - 15)) / 30)) * sm(200, 450, s) * (1 - sm(4150, 4300, s)), xa = s - bow * (1 - fa ** PB), rA = zA - zC - a * (xa - s + bow);
  const crA = Math.max(cr, 0.75 * sm(420, 760, s) * (1 - sm(3300, 3900, s)));                              // the wing's crest is a defined edge from the lamps back (the car mixes creases with round forms)
  const mAi = MAI(s), mean = (zB - zA - a * (s - xa)) / (yB - yA), mAo = mAi + (Math.min(mAi, 0.55 * mean) - mAi) * crA, mBi = 2 * mean - mAo, mBo = mBi + (-0.6 - mBi) * cr;
  const xT = (y: number) => s - bow * (1 - (y / yB) ** PB), out: V[] = [];
  for (let j = 0; j < NCA; j++) { const t = j / NCA, t2 = t * t, t3 = t2 * t, y = yA * t; out.push([xT(y), y, zC + a * (xT(y) - s + bow) + (3 * t2 - 2 * t3) * rA + (t3 - t2) * yA * mAi]); }
  for (let j = 0; j < NAB; j++) { const d = (yB - yA) * j / NAB; out.push([xT(yA + d), yA + d, zA + a * (xT(yA + d) - xa) + mAo * d + (mean - mAo) / (yB - yA) * d * d]); }
  const dy = w - yB, b1 = [[yB, zB], [yB + 0.6 * dy, zB + 0.6 * dy * mBo], [w, zW + 0.45 * (zB - zW)], [w, zW]], b2 = [[w, zW], [w, zW - 0.45 * (zW - zS)], [yS + 0.35 * (w - yS), zS + 0.2 * (zW - zS)], [yS, zS]];
  const side = (tau: number): [number, number] => { const p = tau <= 1 ? b1 : b2, u = tau <= 1 ? tau : tau - 1, v = 1 - u, c = [v * v * v, 3 * v * v * u, 3 * v * u * u, u * u * u]; return [0, 1].map(k => c[0]! * p[0]![k]! + c[1]! * p[1]![k]! + c[2]! * p[2]![k]! + c[3]! * p[3]![k]!) as [number, number]; };
  const az = archZ(s), dep = scoop(s); let tc = 2; if (az > zS) { let lo = 0, hi = 2; for (let k = 0; k < 28; k++) { const m = (lo + hi) / 2; if (side(m)[1] > az) lo = m; else hi = m; } tc = Math.max(0.08, lo); }   // at a wheel the flank stops at the arch: its points slide up, keeping their order
  TS.forEach((t, k) => { const [y, z] = side(t * tc / 2); out.push([s, y - (k >= SCK0 && k <= SCK1 ? dep : 0), z]); });
  const bb = s < 1000 ? bow * (1 - sm(300, 600, s)) : s > 4050 ? bow : 0, xU = (y: number) => s - bb * (1 - (y / yS) ** PB);
  if (az > 0) { const yin = s < 2400 ? YINF : YINR; out.push([s, yin, az], [s, yin, zF], [s, 0, zF]); } else out.push([xU(yS - 45), yS - 45, zF], [xU(yS / 2), yS / 2, zF], [xU(0), 0, zF]);
  return out; }
/** the stations: close at the nose's and tail's lips, every 18 degrees round an arch, about 110 mm apart between */
const arcS = (hx: number, ra: number) => [hx - ra - 2, ...Array.from({ length: 11 }, (_, k) => Math.round(hx - ra * Math.cos(k * 18 * Math.PI / 180))), hx + ra + 2];
const SS = [S0, 122, 150, 200, 280, 355, 435, 515, 595, 665, ...arcS(FX, RAF), SB, 1590, 1700, 1800, 1900, ST, 2120, 2230, 2340, 2440, SP, 2640, 2750, 2830, SC1, SC1 + 22, 3010, 3120, ...arcS(RX, RAR), 4090, 4170, 4240, 4290, 4325, 4337, S1];
const IB = SS.indexOf(SB), IT = SS.indexOf(ST), IP = SS.indexOf(SP), IM = SS.indexOf(SC1), IL0 = SS.indexOf(355), IL1 = SS.indexOf(595), JL0 = 2;   // the head lamps' pockets: stations 355-595, the top's points 2 to the crest (review 134)

type Tri = [V, V, V];
/** where a line along axis `c` through (a, b) on the other two axes meets a set of triangles: the farthest (or nearest) hit; NaN if none */
function probe(T: Tri[], ia: number, ib: number, ic: number, a: number, b: number, far = true): number { let best = NaN;
  for (const [p, q, r] of T) { const den = (q[ib]! - r[ib]!) * (p[ia]! - r[ia]!) + (r[ia]! - q[ia]!) * (p[ib]! - r[ib]!); if (Math.abs(den) < 1e-9) continue;
    const l0 = ((q[ib]! - r[ib]!) * (a - r[ia]!) + (r[ia]! - q[ia]!) * (b - r[ib]!)) / den, l1 = ((r[ib]! - p[ib]!) * (a - r[ia]!) + (p[ia]! - r[ia]!) * (b - r[ib]!)) / den, l2 = 1 - l0 - l1; if (l0 < -1e-6 || l1 < -1e-6 || l2 < -1e-6) continue;
    const v = l0 * p[ic]! + l1 * q[ic]! + l2 * r[ic]!; if (!(far ? v <= best : v >= best)) best = v; } return best; }
/** a four-sided face wound so that it looks along n */
function face(b: Build, p: V, q: V, r: V, t: V, n: V) { const c = cross(sub(q, p), sub(t, p)); if (c[0] * n[0] + c[1] * n[1] + c[2] * n[2] >= 0) b.quad(p, q, r, t); else b.quad(p, t, r, q); }
/** a patch of nu by nv faces over f(u, v), 0..1 each way */
function patch(b: Build, f: (u: number, v: number) => V, nu: number, nv: number, n: V) { for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) face(b, f(i / nu, j / nv), f((i + 1) / nu, j / nv), f((i + 1) / nu, (j + 1) / nv), f(i / nu, (j + 1) / nv), n); }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** a flat disc across the axle at o */
function disc(b: Build, o: V, r: number, seg: number) { for (let i = 0; i < seg; i++) { const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2; b.tri(o, [o[0] + Math.cos(a0) * r, o[1], o[2] + Math.sin(a0) * r], [o[0] + Math.cos(a1) * r, o[1], o[2] + Math.sin(a1) * r]); } }
/** a pressed light-alloy wheel: a bright lip, a dished disc with a ring of holes, a dark centre */
function wheel(b: Build, x: number, s: 1 | -1, spin = 0) { const front = x === FX, wy = front ? WYF : WYR, tw = front ? TWF : TWR, o: V = [x, s * wy, R], rim = 240, h = tw / 2, f = s * h;
  b.name(front ? 'tyreF' : 'tyreR').mat(RUBBER, 0.05, 'tyre').lathe('y', o, [[-h, rim], [-h, R - 28], [-h + 26, R], [h - 26, R], [h, R - 28], [h, rim]], 20, false);
  b.name('rim').mat(SILVER, 0.8, 'metal').lathe('y', o, [[f, rim + 4], [f - s * 10, rim - 10], [f - s * 34, rim - 24]], 20, false);
  b.name('wheel').mat(SILVER, 0.5, 'metal').lathe('y', o, [[f - s * 34, rim - 24], [f - s * 30, 150], [f - s * 20, 62], [f - s * 20, 46]], 16, false);
  b.name('wheel').mat(DARK, 0.05); disc(b, [x, s * wy - f * 0.7, R], rim, 12);
  b.name('wheelHole').mat(DARK, 0.05); for (let k = 0; k < 12; k++) { const a = spin + k / 12 * Math.PI * 2, y = s * wy + f - s * 28, p = (r: number, da: number): V => [x + Math.cos(a + da) * r, y, R + Math.sin(a + da) * r];
    face(b, p(152, -0.12), p(192, -0.15), p(192, 0.15), p(152, 0.12), [0, s, 0]); }
  b.name('hub').mat(FRAME, 0.3); disc(b, [x, s * wy + f - s * 18, R], 46, 10); b.name('hub').mat(SILVER, 0.7, 'metal'); disc(b, [x, s * wy + f - s * 15, R], 20, 8);
}

export function eb110Mesh(spin = 0, wing = 0): Mesh { const b = new Build(); wing = Math.max(0, Math.min(1, wing));
  // ---- the body's grid ----
  const G = SS.map(half), NI = SS.length, g = (i: number, j: number, sg: number): V => { const p = G[i]![j]!; return [p[0], p[1] * sg, p[2]]; };
  const arch = SS.map(s => archZ(s) > 0), cells: Record<'paint' | 'screen' | 'glass' | 'mouth' | 'under' | 'pocket', V[][]> = { paint: [], screen: [], glass: [], mouth: [], under: [], pocket: [] }, TOP: Tri[] = [], SIDE: Tri[] = [];
  for (let i = 0; i + 1 < NI; i++) for (let j = 0; j + 1 < NJ; j++) for (const sg of [1, -1]) { const q = sg > 0 ? [g(i, j, sg), g(i + 1, j, sg), g(i + 1, j + 1, sg), g(i, j + 1, sg)] : [g(i, j, sg), g(i, j + 1, sg), g(i + 1, j + 1, sg), g(i + 1, j, sg)];
    const kind = i >= IL0 && i < IL1 && j >= JL0 && j < JA ? 'pocket' : i >= IB && i < IT && j < JA ? 'screen' : i >= IB && i < IP && j >= JA && j < JB ? 'glass' : i === IM && j >= JB + SCK0 - 1 && j <= JB + SCK1 ? 'mouth' : j > JS || (j === JS && (arch[i]! || arch[i + 1]!)) ? 'under' : 'paint';
    cells[kind].push(q); if (j < JB) TOP.push([q[0]!, q[1]!, q[2]!], [q[0]!, q[2]!, q[3]!]); else if (j < JS && sg > 0) SIDE.push([q[0]!, q[1]!, q[2]!], [q[0]!, q[2]!, q[3]!]); }
  // each cell is cut along the diagonal that folds it less, so a highlight's edge runs straighter across the cells
  const un = (p: V, q: V, r: V): V => { const c = cross(sub(q, p), sub(r, p)), l = Math.hypot(c[0], c[1], c[2]) || 1; return [c[0] / l, c[1] / l, c[2] / l]; }, dot = (p: V, q: V) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const emit = (qs: V[][]) => { for (const q of qs) { const [p0, p1, p2, p3] = q as [V, V, V, V]; if (dot(un(p0, p1, p2), un(p0, p2, p3)) >= dot(un(p1, p2, p3), un(p1, p3, p0)) - 1e-9) b.quad(p0, p1, p2, p3); else b.quad(p1, p2, p3, p0); } };
  b.name('body').mat(PAINT, GLOSS, 'paint'); emit(cells.paint);
  // the nose's and the tail's faces: upright strips between the ring's top and bottom edges, the corner fanned
  const LEAN = 52, endFace = (i: number, n: V, lean = 0) => { const s = SS[i]!, yB = YB(s), bow = BOW(s), yS = W(s) - UND(s), zS = ZS(s), zF = zS - 12, fz = (y: number) => Math.abs(y) < yS - 45 ? zF : zF + (Math.abs(y) - yS + 45) / 45 * 12, bx = (y: number) => s - bow * (1 - (Math.abs(y) / yB) ** PB), foot = (y: number): V => [bx(y) + lean * (1 - 0.4 * (Math.abs(y) / yB) ** 2), y, fz(y)];
    for (const sg of [1, -1]) { for (let j = 0; j < JB; j++) { const p = g(i, j, sg), q = g(i, j + 1, sg); face(b, p, q, foot(q[1]), foot(p[1]), n); if (lean) face(b, foot(p[1]), foot(q[1]), [bx(q[1]), q[1], fz(q[1])], [bx(p[1]), p[1], fz(p[1])], [0, 0, -1]); } const c = foot(g(i, JB, sg)[1]); for (let j = JB; j < JS; j++) b.tri(c, g(i, j, sg), g(i, j + 1, sg)); } };
  endFace(0, [-1, 0, 0]); endFace(NI - 1, [1, 0, 0], LEAN);   /* the tail's face leans back to its widest at the foot, over the rising diffuser */
  b.name('chassis').mat(DARK, 0.05); emit(cells.under);
  b.name('grille').mat(DARK, 0.05); emit(cells.mouth);
  b.name('screenPane').mat(GLASS, 0.5, 'glass'); emit(cells.screen); b.name('screenPane').mat(GLASS, 0.5, 'glass'); emit(cells.glass);
  // where the skin is: its height at (x, y) on top, its distance from the centre line at (x, z) on the flank, the nose's and tail's faces at y
  const zTop = (x: number, y: number) => { const z = probe(TOP, 0, 1, 2, x, y); if (Number.isNaN(z)) throw new Error(`eb110: no skin at ${x}, ${y}`); return z; };
  const ySide = (x: number, z: number) => { const y = probe(SIDE, 0, 2, 1, x, z); if (Number.isNaN(y)) throw new Error(`eb110: no flank at ${x}, ${z}`); return y; };
  const top = (x: number, y: number, lift = 4): V => [x, y, zTop(x, y) + lift], flank = (x: number, z: number, sg: number, lift = 4): V => [x, sg * (ySide(x, z) + lift), z];
  const noseX = (y: number) => S0 - BOW(S0) * (1 - (Math.abs(y) / YB(S0)) ** PB), tailX = (y: number) => S1 - BOW(S1) * (1 - (Math.abs(y) / YB(S1)) ** PB);
  const tailTop = (y: number) => zTop(tailX(y) - 6, y), tailFoot = ZS(S1) - 12;
  const nose = (y: number, z: number, lift = 4): V => [noseX(y) - lift, y, z], tail = (y: number, z: number, lift = 4): V => { const zt = tailTop(y); return [tailX(y) + LEAN * (1 - 0.4 * (Math.abs(y) / YB(S1)) ** 2) * Math.max(0, Math.min(1, (zt - z) / (zt - tailFoot))) + lift, y, z]; };
  const UP: V = [0, 0, 1];
  /** a line drawn on the top from one point to another; on the flank through points [x, z] */
  const seamTop = (x0: number, y0: number, x1: number, y1: number, n = 8, t = 9) => { const l = Math.hypot(x1 - x0, y1 - y0) || 1, ox = -(y1 - y0) / l * t / 2, oy = (x1 - x0) / l * t / 2, p = (i: number, k: number): V => { const f = i / n; return top(lerp(x0, x1, f) + ox * k, lerp(y0, y1, f) + oy * k, 3); }; for (let i = 0; i < n; i++) face(b, p(i, -1), p(i + 1, -1), p(i + 1, 1), p(i, 1), UP); };
  const seamSide = (pts: [number, number][], sg: number, t = 9) => { const e = pts.map(([x, z], i) => { const a = pts[Math.max(0, i - 1)]!, c = pts[Math.min(pts.length - 1, i + 1)]!, l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1, nx = -(c[1] - a[1]) / l * t / 2, nz = (c[0] - a[0]) / l * t / 2; return [flank(x + nx, z + nz, sg, 3), flank(x - nx, z - nz, sg, 3)] as [V, V]; });
    for (let i = 0; i + 1 < e.length; i++) face(b, e[i]![0], e[i + 1]![0], e[i + 1]![1], e[i]![1], [0, sg, 0]); };

  // ---- the wheel wells: dark over and behind each wheel ----
  b.name('chassis').mat(DARK, 0.05); for (const sg of [1, -1]) for (const [hx, ra, yin] of [[FX, RAF, YINF], [RX, RAR, YINR]] as const) { const y = sg * (yin + 3), a = (i: number): V => { const t = i / 8 * Math.PI; return [hx - Math.cos(t) * (ra - 3), y, R + Math.sin(t) * (ra - 3)]; };
    for (let i = 0; i < 8; i++) b.tri([hx, y, R], a(i), a(i + 1)); face(b, [hx - ra + 3, y, 110], [hx + ra - 3, y, 110], [hx + ra - 3, y, R], [hx - ra + 3, y, R], [0, sg, 0]); }
  b.bar([FX, -WYF, R], [FX, WYF, R], 50).bar([RX, -WYR, R], [RX, WYR, R], 70);

  // ---- the cabin behind the glass: floor, door panels, the wall behind the seats, dash, tunnel, two seats ----
  { const FL = 150, xb = SP - 6;
    b.name('cockpit').mat(DARK, 0.05); face(b, [SB + 30, -790, FL], [xb, -800, FL], [xb, 800, FL], [SB + 30, 790, FL], UP);
    b.name('cockpit').mat(TRIM, 0.1); for (const sg of [1, -1]) { face(b, [SB + 40, sg * (YB(SB + 40) - 26), FL], [xb, sg * (YB(xb) - 26), FL], [xb, sg * (YB(xb) - 26), ZB(xb) - 8], [SB + 40, sg * (YB(SB + 40) - 26), ZB(SB + 40) - 8], [0, -sg, 0]);
      for (let j = 0; j < JB; j++) { const p = g(IP, j, sg), q = g(IP, j + 1, sg), in2 = (v: V): V => [xb, v[1] * 0.985, v[2] - 5]; face(b, in2(p), in2(q), [xb, q[1] * 0.985, FL], [xb, p[1] * 0.985, FL], [-1, 0, 0]); } }
    // the dash: its top from the screen's foot up to a crest, its face down to the floor
    const crest = (y: number): V => [SB + 250 - 300 * (y / 800) ** 2, y, 815 - 62 * (y / 800) ** 2];
    b.name('cockpit').mat(TRIM, 0.15); for (const sg of [1, -1]) for (let j = 0; j < JA + 1; j++) { const p = g(IB, j, sg), q = g(IB, j + 1, sg), lo = (v: V): V => [v[0] + 12, v[1] * 0.985, v[2] - 10], c0 = crest(p[1] * 0.985), c1 = crest(q[1] * 0.985);
      face(b, lo(p), lo(q), c1, c0, UP); face(b, c0, c1, [c1[0] + 50, c1[1], 430], [c0[0] + 50, c0[1], 430], [1, 0, 0.3]); }
    b.name('cockpit').mat(TRIM, 0.15).box(SB + 200, xb, -105, 105, FL, 355);
    for (const sg of [1, -1]) { const y0 = sg * 170, y1 = sg * 560;
      b.name('seat').mat(SEAT, 0.25, 'leather').box(1890, 2340, Math.min(y0, y1), Math.max(y0, y1), FL, 335).loft(([[2270, 335], [2330, 620], [2400, 850], [2460, 880]] as const).map(([x, z]) => [[x, y0 + sg * 15, FL], [x, y1 - sg * 15, FL], [x, y1 - sg * 15, z], [x, y0 + sg * 15, z]] as V[]));
      b.name('seat').mat(SEAT2, 0.1); for (const y of [y0 + sg * 130, y0 + sg * 260]) b.bar([1910, y, 337], [2270, y, 337], 8).bar([2334, y, 624], [2402, y, 846], 8); } }

  // ---- the glass's frames: dark bands lying on the grid's own lines ----
  { const band = (line: [number, number][], din: [number, number], win: number, dout: [number, number], wout: number) => { for (const sg of [1, -1]) { const e = line.map(([i, j]) => { const p = g(i, j, sg), to = (d: [number, number], w: number): V => { const q = g(i + d[0], j + d[1], sg), l = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) || 1, k = Math.min(0.9, w / l); return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k + sg * 2.5 * Math.min(1, j / JA), p[2] + (q[2] - p[2]) * k + 3.5]; }; return [to(din, win), to(din, 0), to(dout, wout)] as [V, V, V]; });
        for (let k = 0; k + 1 < e.length; k++) for (const m of [0, 1]) face(b, e[k]![m]!, e[k + 1]![m]!, e[k + 1]![m + 1]!, e[k]![m + 1]!, [0, sg * 0.5, 1]); } };
    const run = (a: number, c: number) => Array.from({ length: c - a + 1 }, (_, k) => a + k);
    b.name('screenFrame').mat(FRAME, 0.2);
    band(run(IB, IP).map(i => [i, JA]), [0, -1], 24, [0, 1], 22);                       // the pillar and the roof's edge
    band(run(0, JA).map(j => [IB, j]), [1, 0], 34, [-1, 0], 8);                         // the screen's foot
    band(run(0, JA).map(j => [IT, j]), [-1, 0], 26, [1, 0], 8);                         // its top
    band(run(IB, IP).map(i => [i, JB]), [0, -1], 26, [0, 1], 7);                        // the belt
    band(run(JA, JB).map(j => [IP, j]), [-1, 0], 34, [1, 0], 8); }                      // the door glass's back edge

  // ---- the nose: the horseshoe low in its tip, the barred intakes beside it, the badge; the lamps under clear covers ----
  { /* review 136, from the sheet (data/cars/spec/eb110.json): the horseshoe 211-341 high, the intakes 124-300 with three slots, the ducts in the corners, the badge on the bonnet's lip, the shut line round the nose */
    const shoe: [number, number][] = [[-40, 211], [-56, 285], [-54, 315], [-36, 333], [0, 341], [36, 333], [54, 315], [56, 285], [40, 211]], fan = (k: number, lift: number) => { for (let i = 0; i < shoe.length; i++) { const q = shoe[(i + 1) % shoe.length]!; b.tri(nose(0, 280, lift), nose(q[0] * k, 280 + (q[1] - 280) * k, lift), nose(shoe[i]![0] * k, 280 + (shoe[i]![1] - 280) * k, lift)); } };
    b.name('grille').mat(PAINT, GLOSS, 'paint'); fan(1.12, 2); b.name('grille').mat(DARK, 0.05, 'grille'); fan(1, 5);
    for (const sg of [1, -1]) { b.name('grille').mat(DARK, 0.05); patch(b, (u, v) => nose(sg * lerp(82, 540, u), lerp(124, 300 - 26 * u * u, v)), 4, 1, [-1, 0, 0]);
      b.name('grille').mat(PAINT, GLOSS, 'paint'); for (const z of [166, 230]) patch(b, (u, v) => nose(sg * lerp(82, 540 - (z > 200 ? 14 : 0), u), z + v * 20, 6), 4, 1, [-1, 0, 0]);   /* two bars: three slots */
      b.name('grille').mat(DARK, 0.05); face(b, flank(300, 160, sg), flank(385, 160, sg), flank(385, 300, sg), flank(300, 300, sg), [0, sg, 0]); }   /* the brake duct in the bumper's corner */
    b.name('badge').mat(RED, 0.5); { const o: [number, number][] = [[-48, 0], [-30, 11], [30, 11], [48, 0], [30, -11], [-30, -11]]; for (let i = 1; i + 1 < o.length; i++) b.tri(top(150 + o[0]![1], o[0]![0], 5), top(150 + o[i]![1], o[i]![0], 5), top(150 + o[i + 1]![1], o[i + 1]![0], 5)); }
    b.name('body').mat(SEAM, 0.1); { const xs = (y: number) => 255 + 70 * (Math.abs(y) / 700) ** 2, n = 8; for (let i = 0; i < n; i++) { const y0 = lerp(-690, 690, i / n), y1 = lerp(-690, 690, (i + 1) / n); seamTop(xs(y0), y0, xs(y1), y1, 1, 7); } }   /* the bumper's shut line across the nose (z about 500) */
    for (const sg of [1, -1]) seamSide([[345, ZB(345) - 12], [470, 472], [600, 474], [690, 474]], sg, 7);
    // the head lamps (review 134, from the photographs and the 4-view drawing): a pocket cut into each front corner of the
    // bonnet, from its slope's inner part out to the wing's crest, sharp-edged in the smooth body (the grid's own cells
    // are left out there); flat glass flush over it; a dark tray sinking toward the back (14 mm at the front, 72 at the
    // back); at the back the two units leaning back under the glass, the fluted halogen reflector inboard and the round
    // projector outboard; black fins down the inner wall, the body-coloured outer wall up to the crest, the amber
    // indicator in the outer front corner, two orange heater loops printed on the glass.
    const NU = IL1 - IL0, NV = JA - JL0, dep = (u: number) => lerp(14, 72, u), RV = 0.22;   // RV: the inner side a black finned ramp down to the tray, so the pocket reads as a wedge from the front, as the car
    for (const sg of [1, -1]) {
      /** the pocket's opening at (u, v), 0..1 from front to back and from the inner edge to the crest, dz below it */
      const P = (u: number, v: number, dz = 0): V => { const fi = u * NU, fj = v * NV, i = Math.min(NU - 1, Math.floor(fi)), j = Math.min(NV - 1, Math.floor(fj)), a = fi - i, c = fj - j;
        const p00 = g(IL0 + i, JL0 + j, sg), p10 = g(IL0 + i + 1, JL0 + j, sg), p01 = g(IL0 + i, JL0 + j + 1, sg), p11 = g(IL0 + i + 1, JL0 + j + 1, sg);
        return [0, 1, 2].map(k => (p00[k]! * (1 - a) + p10[k]! * a) * (1 - c) + (p01[k]! * (1 - a) + p11[k]! * a) * c + (k === 2 ? dz : 0)) as V; };
      const N: V = [0, 0, 1], wall = (f: (t: number) => [number, number], n: number, nv: V) => { for (let k = 0; k < n; k++) { const [u0, v0] = f(k / n), [u1, v1] = f((k + 1) / n); face(b, P(u0, v0), P(u1, v1), P(u1, v1, -dep(u1)), P(u0, v0, -dep(u0)), nv); } };
      b.name('lampTray').mat('#2c3038', 0.35); patch(b, (u, v) => P(u, lerp(RV, 1, v), -dep(u)), NU, NV - 1, N);
      b.name('lampFin').mat(FRAME, 0.15); patch(b, (u, v) => P(u, v * RV, -dep(u) * v), NU, 2, [0, sg, 1]); wall(t => [0, lerp(RV, 1, t)], NV - 1, [1, 0, 0]); face(b, P(0, 0), P(0, RV), P(0, RV, -dep(0)), P(0, RV, -dep(0)), [1, 0, 0]);   /* the inner ramp and the shallow front wall */
      b.name('body').mat(PAINT, GLOSS, 'paint'); wall(t => [t, 1], NU, [0, -sg, 0]);                                  /* the outer wall: the wing's inner face */
      b.name('lampHousing').mat(DARK, 0.05); wall(t => [1, lerp(RV, 1, t)], NV - 1, [-1, 0, 0]); face(b, P(1, 0), P(1, RV), P(1, RV, -dep(1)), P(1, RV, -dep(1)), [-1, 0, 0]);
      b.name('lampFin').mat('#3b3f47', 0.3); for (let k = 0; k < 7; k++) { const u = lerp(0.05, 0.7, k / 6); face(b, P(u, 0.02, -1), P(u + 0.03, 0.02, -1), P(u + 0.03, RV - 0.02, -dep(u) + 3), P(u, RV - 0.02, -dep(u) + 3), [0, sg, 1]); }   /* the fins: lighter blades across the ramp */
      // the units: a face leaning back from the tray to just under the glass's back edge, set off from it by d toward the front and up
      const W0 = 0.74, W1 = 0.985, F = (v: number, w: number, d = 0): V => { const u = lerp(W0, W1, w), p = P(u, v, lerp(-dep(W0) + 3, -7, w)); return [p[0] - d * 0.7, p[1], p[2] + d * 0.7]; };
      b.name('lampHousing').mat(DARK, 0.05); patch(b, (v, w) => F(lerp(RV, 0.97, v), w), 2, 1, [-1, 0, 0.6]);
      b.name('reflector').mat(SILVER, 0.75, 'metal'); patch(b, (v, w) => F(lerp(0.27, 0.6, v), lerp(0.08, 0.94, w), 2), 1, 1, [-1, 0, 0.6]);   /* the halogen unit's chrome bezel */
      b.name('reflector').mat(LENS, 0.7); patch(b, (v, w) => F(lerp(0.29, 0.58, v), lerp(0.16, 0.86, w), 4), 1, 1, [-1, 0, 0.6]);
      b.name('reflector').mat('#a9adb2', 0.6); for (let k = 1; k < 8; k++) { const v = lerp(0.29, 0.58, k / 8); patch(b, (a, w) => F(v - 0.005 + 0.01 * a, lerp(0.16, 0.86, w), 5), 1, 1, [-1, 0, 0.6]); }   /* the fluted glass */
      b.name('reflector').mat(LENS, 0.7); patch(b, (v, w) => F(lerp(0.63, 0.96, v), lerp(0.16, 0.86, w), 3), 1, 1, [-1, 0, 0.6]);
      b.name('reflector').mat('#a9adb2', 0.6); for (let k = 1; k < 5; k++) { const v = lerp(0.63, 0.96, k / 5); patch(b, (a, w) => F(v - 0.005 + 0.01 * a, lerp(0.16, 0.86, w), 4), 1, 1, [-1, 0, 0.6]); }
      { // the projector: a chrome ring and its dark glass ball, round across the face
        const c = F(0.8, 0.52, 6), e1 = sub(F(0.9, 0.52, 6), F(0.7, 0.52, 6)), e2 = sub(F(0.8, 0.86, 6), F(0.8, 0.18, 6)), l1 = Math.hypot(...e1), l2 = Math.hypot(...e2), a1: V = [e1[0] / l1, e1[1] / l1, e1[2] / l1], a2: V = [e2[0] / l2, e2[1] / l2, e2[2] / l2], cr = cross(a1, a2), nn: V = cr[0] > 0 ? [-cr[0], -cr[1], -cr[2]] : cr;
        const r0 = Math.min(44, l2 * 0.3), at = (r: number, t: number, d: number): V => [0, 1, 2].map(k => c[k]! + a1[k]! * r * Math.cos(t) + a2[k]! * r * Math.sin(t) + nn[k]! * d) as V, n12 = 12;
        b.name('reflector').mat(CHROME, 0.9, 'metal'); for (let i = 0; i < n12; i++) { const t0 = i / n12 * Math.PI * 2, t1 = (i + 1) / n12 * Math.PI * 2; face(b, at(r0, t0, 0), at(r0, t1, 0), at(r0 * 0.82, t1, 5), at(r0 * 0.82, t0, 5), nn); }
        b.name('lens').mat('#3a4048', 0.9, 'lens'); for (let i = 0; i < n12; i++) { const t0 = i / n12 * Math.PI * 2, t1 = (i + 1) / n12 * Math.PI * 2, p = [at(0, 0, 12), at(r0 * 0.82, t0, 5), at(r0 * 0.82, t1, 5)] as const, cc = cross(sub(p[1], p[0]), sub(p[2], p[0])); if (cc[0] * nn[0] + cc[1] * nn[1] + cc[2] * nn[2] >= 0) b.tri(p[0], p[1], p[2]); else b.tri(p[0], p[2], p[1]); } }
      b.name('indicator').mat(AMBER, 0.6); face(b, top(372, sg * (YA(372) + 14), 4), top(372, sg * (YA(372) + 100), 4), top(425, sg * (YA(425) + 70), 4), top(432, sg * (YA(432) + 14), 4), N);   /* the amber wedge at the slot's outer foot, on the wing (the sheet) */
      b.name('lampTray').mat('#c48a45', 0.4); for (const [u0, u1, v0, v1] of [[0.08, 0.25, 0.3, 0.9], [0.31, 0.48, 0.28, 0.95]] as const) { const t = 0.009;   /* the heater loops, just under the glass */
        for (const [a0, a1, c0, c1] of [[u0, u0 + t, v0, v1], [u1 - t, u1, v0, v1]] as const) patch(b, (u, v) => P(lerp(a0, a1, u), lerp(c0, c1, v), -4), 1, 1, N); }
      b.name('headCover').mat(GLASS, 0.5, 'glass'); patch(b, (u, v) => P(u, v, -2), NU, NV, N);
      b.name('marker').mat(RED, 0.6); face(b, flank(1130, 695, sg), flank(1154, 695, sg), flank(1154, 717, sg), flank(1130, 717, sg), [0, sg, 0]); } }   // the round red marker on the wing

  // ---- the flanks (the sheet): the doors' edges, the curved vent behind the front wheel, the slot on the rear wing's top, the vent at the tail's corner ----
  for (const sg of [1, -1]) { b.name('door').mat(SEAM, 0.1);
    seamSide([[1520, ZB(1520) - 14], [1500, 650], [1462, 450], [1425, 305]], sg);                                                                  // the front edge
    seamSide([[SP - 12, ZB(SP - 12) - 14], [2500, 700], [2469, 561], [2425, 470], [2378, 400], [2320, 345], [2264, 305]], sg);                      // the back edge, sweeping down and forward
    seamSide([[1425, 302], [1700, 300], [2000, 300], [2264, 302]], sg, 7);                                                                         // the foot
    b.name('grille').mat(DARK, 0.05); { const arc = (r: number, k: number): V => { const t = lerp(2, 68, k) * Math.PI / 180; return flank(FX + r * Math.cos(t), R + r * Math.sin(t), sg); }; for (let k = 0; k < 6; k++) face(b, arc(382, k / 6), arc(412, k / 6), arc(412, (k + 1) / 6), arc(382, (k + 1) / 6), [0, sg, 0]); }   /* the vent following the arch's rim */
    face(b, flank(2570, ZB(2570) - 34, sg), flank(2780, ZB(2780) - 34, sg), flank(2780, ZB(2780) - 10, sg), flank(2570, ZB(2570) - 10, sg), [0, sg, 0]);                // the slot along the rear wing's top
    face(b, flank(4195, ZS(4195) + 22, sg), flank(4250, ZS(4250) + 22, sg), flank(4250, 500, sg), flank(4195, 500, sg), [0, sg, 0]); }                                  // the tail's corner vent

  // ---- behind the cabin: six oval holes in each buttress (two columns of three), the engine cover's slots between, the wing's bed ----
  b.name('louvre').mat('#0f2562', 0.2); for (const sg of [1, -1]) for (const xc of [2745, 2915]) for (const f of [0.24, 0.5, 0.76]) { const o = (k: number): V => { const t = k / 8 * Math.PI * 2, x = xc + 66 * Math.cos(t); return top(x, sg * lerp(YA(x), YB(x), f + 0.1 * Math.sin(t))); }, c = top(xc, sg * lerp(YA(xc), YB(xc), f), 1);
    for (let k = 0; k < 8; k++) { const p = o(k), q = o(k + 1), cc = cross(sub(p, c), sub(q, c)); if (cc[2] >= 0) b.tri(c, p, q); else b.tri(c, q, p); } }
  b.name('engineCover').mat(DARK, 0.05); for (let k = 0; k < 6; k++) { const x0 = 2790 + k * 142, us = [-0.74, -0.37, 0, 0.37, 0.74]; for (let i = 0; i + 1 < us.length; i++) face(b, top(x0, us[i]! * YA(x0)), top(x0 + 72, us[i]! * YA(x0 + 72)), top(x0 + 72, us[i + 1]! * YA(x0 + 72)), top(x0, us[i + 1]! * YA(x0)), UP); }
  b.name('engineCover').mat(SEAM, 0.1); for (const sg of [1, -1]) seamTop(2700, sg * 0.84 * YA(2700), 3700, sg * 0.84 * YA(3700), 8); seamTop(3700, -0.84 * YA(3700), 3700, 0.84 * YA(3700), 8); seamTop(2700, -0.84 * YA(2700), 2700, 0.84 * YA(2700), 8);
  b.name('body').mat(SEAM, 0.1); seamTop(3790, -YB(3790) + 14, 3790, YB(3790) - 14, 14);                                                                       // the tail panel's shut line

  // ---- the tail (the sheet): a capsule of lamps a side (clear inboard, red, amber outboard, a red block low in it), six mesh slots across the top with two more
  //      at each side below, the plate's recess, the black valance with the fog lamp, four pipes under the diffuser ----
  { const R1: V = [1, 0, 0], ZC0 = 712, HH = 70, Y0 = 452, Y1 = 762, cap = (lift: number, grow: number, y0: number, y1: number, endIn: boolean, endOut: boolean) => { for (const sg of [1, -1]) { patch(b, (u, v) => tail(sg * lerp(y0, y1, u), ZC0 + (HH + grow) * (2 * v - 1), lift), 2, 1, R1);
        for (const [on, yc, dir] of [[endIn, y0, -1], [endOut, y1, 1]] as const) if (on) for (let k = 0; k < 5; k++) { const t0 = -Math.PI / 2 + k / 5 * Math.PI, t1 = -Math.PI / 2 + (k + 1) / 5 * Math.PI, r = HH + grow, p = (t: number): V => tail(sg * (yc + dir * r * 0.85 * Math.cos(t)), ZC0 + r * Math.sin(t), lift), c = tail(sg * yc, ZC0, lift), cc = cross(sub(p(t0), c), sub(p(t1), c)); if (cc[0] >= 0) b.tri(c, p(t0), p(t1)); else b.tri(c, p(t1), p(t0)); } } };
    b.name('tailRim').mat(FRAME, 0.2); cap(3, 9, Y0 + 52, Y1 - 52, true, true);
    b.name('reverse').mat('#e9e4dc', 0.7); cap(7, 0, Y0 + 52, Y0 + 104, true, false);
    b.name('tail').mat(RED, 0.5, 'lens'); cap(7, 0, Y0 + 104, Y1 - 112, false, false);
    b.name('indicator').mat(AMBER, 0.7); cap(7, 0, Y1 - 112, Y1 - 52, false, true);
    b.name('tail').mat(RED2, 0.5, 'lens'); for (const sg of [1, -1]) patch(b, (u, v) => tail(sg * lerp(556, 656, u), lerp(648, 680, v), 10), 1, 1, R1);
    b.name('grille').mat(DARK, 0.05); for (let k = 0; k < 6; k++) { const y0 = -426 + k * 146; patch(b, (u, v) => tail(lerp(y0, y0 + 122, u), lerp(742, 774, v)), 1, 1, R1); }
    for (const sg of [1, -1]) for (const z of [688, 636]) patch(b, (u, v) => tail(sg * lerp(304, 426, u), z + v * 28), 1, 1, R1);
    b.name('plate').mat('#16307a', 0.3); patch(b, (u, v) => tail(lerp(-262, 262, u), lerp(548, 664, v)), 2, 1, R1);
    b.name('plate').mat('#d9a514', 0.35); patch(b, (u, v) => tail(lerp(-228, 228, u), lerp(560, 652, v), 7), 2, 1, R1);
    b.name('bumperR').mat(DARK, 0.05); patch(b, (u, v) => tail(lerp(-YB(S1) + 30, YB(S1) - 30, u), lerp(tailFoot, 536, v)), 6, 1, R1);
    b.name('tail').mat(RED2, 0.5, 'lens'); patch(b, (u, v) => tail(lerp(-74, 74, u), lerp(452, 505, v), 7), 1, 1, R1);
    b.name('exhaust').mat(CHROME, 0.9, 'metal'); for (const sg of [1, -1]) for (const y of [225, 320]) b.lathe('x', [4338, sg * y, 365], [[-150, 44], [12, 44], [12, 36], [-140, 33]], 8, false); }   /* the GT's two pairs */

  // ---- the mirrors: heads standing well out on upright stalks from the doors' top front corners ----
  for (const sg of [1, -1]) { const ring = (x: number, k: number): V[] => { const yc = 945, zc = 898, hw = 78 * k, hh = 46 * k; return ([[-1, -0.6], [-1, 0.6], [-0.6, 1], [0.6, 1], [1, 0.6], [1, -0.6], [0.6, -1], [-0.6, -1]] as const).map(([u, v]) => [x, sg * (yc + u * hw), zc + v * hh] as V); };
    b.name('mirror').mat(PAINT, GLOSS, 'paint').loft([ring(1630, 0.55), ring(1668, 0.92), ring(1748, 1), ring(1784, 0.96)]).bar([1700, sg * (YB(1700) - 8), ZB(1700) - 20], [1712, sg * 912, 862], 52, 26);
    b.name('mirror').mat(CHROME, 0.9, 'metal'); const r = ring(1787, 0.84); for (let i = 1; i + 1 < r.length; i++) b.tri(r[0]!, r[i]!, r[i + 1]!); }

  // ---- the wing (GT): the tail's trailing blade in its dark bed; raised, it stands on two struts, its trailing edge up ----
  { const x0 = 4080, se = 4322, xe = (y: number) => se - BOW(se) * (1 - (Math.abs(y) / YB(se)) ** PB) - 6, xp = 4240, zp = zTop(xp, 0), a = 10 * wing * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), lift = 110 * wing;
    const T = (p: V): V => { const dx = p[0] - xp, dz = p[2] - zp; return [xp + dx * ca - dz * sa, p[1], zp + dx * sa + dz * ca + lift]; };
    b.name('wing').mat(FRAME, 0.1); for (let i = 0; i < 8; i++) { const y0 = lerp(-700, 700, i / 8), y1 = lerp(-700, 700, (i + 1) / 8); for (const [u0, u1] of [[0, 0.3], [0.3, 0.65], [0.65, 1]] as const) { const x = (y: number, u: number) => lerp(4030, xe(y) - 8, u); face(b, top(x(y0, u0), y0, 3), top(x(y0, u1), y0, 3), top(x(y1, u1), y1, 3), top(x(y1, u0), y1, 3), UP); } }
    b.name('wing').mat(PAINT, GLOSS, 'paint').loft([-740, -600, -450, -300, -150, 0, 150, 300, 450, 600, 740].map(y => { const x1 = xe(y), xm = (x0 + x1) / 2; return ([[x0, -4], [x0 + 28, 5], [xm, 7], [x1 - 26, 6], [x1, 1], [xm, -12]] as const).map(([x, dz]) => T([x, y, zTop(x, y) + dz])); }));
    if (wing > 0.02) { b.name('wing').mat(FRAME, 0.2); for (const y of [-576, 576]) b.bar([xp, y, zTop(xp, y) - 12], T([xp, y, zTop(xp, y) - 8]), 54, 16); } }

  for (const s of [1, -1] as const) { wheel(b, FX, s, spin); wheel(b, RX, s, spin); }
  return b.mesh(L); }
export const mesh = eb110Mesh;
