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
const L = 4400, FX = 1090, RX = FX + 2550, R = 326, WYF = 775, WYR = 809, TWF = 245, TWR = 310;   // the axles, the tyres' radius, half the tracks, the tyres' widths
const RAF = 345, RAR = 362, YINF = 618, YINR = 628;                                                 // the wheel arches' radii; the wells' inner walls
const S0 = 110, S1 = 4340;                                                                          // the first and last rings (where their flanks stand; their centres reach 0 and 4400)
const SB = Math.round(FX - RAF * Math.cos(126 * Math.PI / 180)), ST = 1900, SP = 2720;              // the rings along the screen's foot, the screen's top, the door glass's back edge
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
const W = curve([[110, 700], [122, 728], [150, 775], [200, 822], [280, 868], [380, 900], [500, 920], [700, 935], [1090, 945], [1600, 950], [2400, 957], [3000, 966], [3640, 970], [4000, 963], [4170, 945], [4240, 925], [4290, 895], [4325, 862], [4337, 848], [4340, 840]]);
/** how far the ring's centre stands ahead of its flank: the round nose, the screen's curved foot, the tail (behind: negative) */
const BOW = curve([[110, 110], [600, 110], [900, 190], [SB, 350], [1500, 235], [ST, 30], [2300, 0], [4050, 0], [4200, -22], [4340, -60]]);
/** the shoulder (the glass's foot) as a part of the half-width: the tumblehome; the crest/pillar/roof edge as a part of the shoulder's */
const FB = curve([[110, 0.93], [1000, 0.93], [SB, 0.895], [2720, 0.885], [3300, 0.9], [3640, 0.915], [4340, 0.93]]);
const FA = curve([[110, 0.8], [600, 0.84], [1000, 0.9], [SB, 0.943], [1500, 0.82], [1700, 0.71], [ST, 0.6], [2720, 0.595], [3100, 0.63], [3600, 0.72], [4340, 0.8]]);
/** the centre line's top against x: the nose's lip, the bonnet (15 degrees), the screen (23), the roof, the engine cover (9) down to the tail's edge */
const ZC = curve([[0, 410], [12, 432], [40, 448], [110, 464], [300, 508], [500, 556], [700, 607], [921, 665], [1100, 741], [1400, 868], [1700, 995], [1870, 1066], [2000, 1100], [2150, 1118], [2350, 1125], [2550, 1120], [2720, 1105], [2900, 1076], [3100, 1040], [3400, 982], [3700, 926], [4000, 875], [4250, 838], [4340, 826], [4385, 814], [4397, 800], [4400, 784]]);
const xA = (s: number) => s - BOW(s) * (1 - FA(s) ** PB);
/** the A line's height: the wing's crest; along the screen the pillar lies in the screen's own surface; the roof's edge; the buttress's crest */
const ZA = curve([[110, 398], [122, 420], [150, 438], [220, 460], [410, 512], [610, 566], [860, 648], [1000, 706], [1090, 732],
  ...[0, 1, 2, 3, 4, 5, 6].map(k => { const s = SB + (ST - SB) * k / 6; return [s, ZC(xA(s)) - 16 - k] as [number, number]; }),
  [2010, 1080], [2150, 1097], [2350, 1103], [2550, 1099], [2720, 1086], [2900, 1064], [3100, 1028], [3400, 971], [3700, 916], [4000, 866], [4240, 832], [4290, 824], [4325, 812], [4337, 798], [4340, 780]]);
const ZB = curve([[110, 366], [122, 386], [150, 402], [220, 424], [410, 478], [610, 536], [860, 626], [1000, 686], [1090, 712], [SB, 770], [1600, 778], [2000, 788], [2400, 800], [2720, 822], [3000, 852], [3300, 872], [3640, 876], [3900, 862], [4150, 836], [4240, 824], [4290, 815], [4325, 801], [4337, 785], [4340, 764]]);
const ZW = curve([[110, 285], [300, 335], [600, 420], [1090, 510], [1600, 525], [2400, 545], [3000, 585], [3640, 615], [4100, 600], [4340, 560]]);
const ZS = curve([[110, 150], [300, 130], [700, 120], [3640, 125], [3900, 150], [4150, 185], [4340, 205]]);
/** how far the sill stands in from the widest line */
const UND = curve([[110, 30], [700, 45], [2400, 55], [3640, 45], [4340, 25]]);
/** the roof's fall at its edge (and the bonnet's and deck's at the crest) */
const MAI = curve([[110, -0.04], [400, 0], [SB, -0.05], [ST, -0.1], [2720, -0.12], [3200, -0.06], [4340, -0.04]]);
const YB = (s: number) => FB(s) * W(s), YA = (s: number) => FA(s) * YB(s);
/** the wheel arch's height at s: a half circle over each hub (0 away from the wheels) */
const archZ = (s: number) => { for (const [hx, ra] of [[FX, RAF], [RX, RAR]] as const) { const dx = s - hx; if (Math.abs(dx) <= ra + 1e-6) return R + Math.sqrt(Math.max(0, ra * ra - dx * dx)); } return 0; };
/** the scoop in the door and the rear wing ahead of the side intake: its depth at s (it deepens to the intake's mouth) */
const SC0 = FX + 0.24 * 2550, SC1 = 2990, scoop = (s: number) => s < SC0 || s > SC1 + 1 ? 0 : 58 * sm(SC0, 2640, s);

// a ring's points, centre top to centre bottom: NCA across the top to the A line, NAB to the shoulder, the flank at TS, three underneath
const NCA = 7, NAB = 4, TS = [0, 0.2, 0.4, 0.6, 0.8, 1, 1.12, 1.24, 1.3, 1.5, 1.72, 1.86, 1.92, 2], JA = NCA, JB = NCA + NAB, JS = JB + TS.length - 1, NJ = JS + 4, SCK0 = 8, SCK1 = 11;
/** half a ring (y >= 0) at s */
function half(s: number): V[] { const w = W(s), yB = FB(s) * w, fa = FA(s), yA = fa * yB, bow = BOW(s), zC = ZC(s - bow), zA = ZA(s), zB = ZB(s), zW = ZW(s), yS = w - UND(s), zS = ZS(s), zF = zS - 12;
  const cr = sm(FX, SB, s) * (1 - sm(3300, 3900, s));                                                    // how sharp the edges at A and B are: the glass's edges, not the bonnet's or the tail's
  // the top is laid on the slope the centre line has there (a), so a ring that bows across a flat bonnet or the screen stays in its plane
  const a = Math.max(-0.3, Math.min(0.45, (ZC(s - bow + 15) - ZC(s - bow - 15)) / 30)) * sm(200, 450, s) * (1 - sm(4150, 4300, s)), xa = s - bow * (1 - fa ** PB), rA = zA - zC - a * (xa - s + bow);
  const mAi = MAI(s), mean = (zB - zA - a * (s - xa)) / (yB - yA), mAo = mAi + (Math.min(mAi, 0.55 * mean) - mAi) * cr, mBi = 2 * mean - mAo, mBo = mBi + (-0.6 - mBi) * cr;
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
const SS = [S0, 122, 150, 200, 280, 380, 480, 580, 665, ...arcS(FX, RAF), 1545, 1660, 1780, ST, 2010, 2130, 2250, 2370, 2490, 2610, SP, 2830, 2920, SC1, SC1 + 22, 3100, 3190, ...arcS(RX, RAR), 4090, 4170, 4240, 4290, 4325, 4337, S1];
const IB = SS.indexOf(SB), IT = SS.indexOf(ST), IP = SS.indexOf(SP), IM = SS.indexOf(SC1);

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
  const arch = SS.map(s => archZ(s) > 0), cells: Record<'paint' | 'screen' | 'glass' | 'mouth' | 'under', V[][]> = { paint: [], screen: [], glass: [], mouth: [], under: [] }, TOP: Tri[] = [], SIDE: Tri[] = [];
  for (let i = 0; i + 1 < NI; i++) for (let j = 0; j + 1 < NJ; j++) for (const sg of [1, -1]) { const q = sg > 0 ? [g(i, j, sg), g(i + 1, j, sg), g(i + 1, j + 1, sg), g(i, j + 1, sg)] : [g(i, j, sg), g(i, j + 1, sg), g(i + 1, j + 1, sg), g(i + 1, j, sg)];
    const kind = i >= IB && i < IT && j < JA ? 'screen' : i >= IB && i < IP && j >= JA && j < JB ? 'glass' : i === IM && j >= JB + SCK0 - 1 && j <= JB + SCK1 ? 'mouth' : j > JS || (j === JS && (arch[i]! || arch[i + 1]!)) ? 'under' : 'paint';
    cells[kind].push(q); if (j < JB) TOP.push([q[0]!, q[1]!, q[2]!], [q[0]!, q[2]!, q[3]!]); else if (j < JS && sg > 0) SIDE.push([q[0]!, q[1]!, q[2]!], [q[0]!, q[2]!, q[3]!]); }
  // each cell is cut along the diagonal that folds it less, so a highlight's edge runs straighter across the cells
  const un = (p: V, q: V, r: V): V => { const c = cross(sub(q, p), sub(r, p)), l = Math.hypot(c[0], c[1], c[2]) || 1; return [c[0] / l, c[1] / l, c[2] / l]; }, dot = (p: V, q: V) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const emit = (qs: V[][]) => { for (const q of qs) { const [p0, p1, p2, p3] = q as [V, V, V, V]; if (dot(un(p0, p1, p2), un(p0, p2, p3)) >= dot(un(p1, p2, p3), un(p1, p3, p0)) - 1e-9) b.quad(p0, p1, p2, p3); else b.quad(p1, p2, p3, p0); } };
  b.name('body').mat(PAINT, GLOSS, 'paint'); emit(cells.paint);
  // the nose's and the tail's faces: upright strips between the ring's top and bottom edges, the corner fanned
  const endFace = (i: number, n: V) => { const s = SS[i]!, yB = YB(s), bow = BOW(s), yS = W(s) - UND(s), zS = ZS(s), zF = zS - 12, foot = (y: number): V => [s - bow * (1 - (Math.abs(y) / yB) ** PB), y, Math.abs(y) < yS - 45 ? zF : zF + (Math.abs(y) - yS + 45) / 45 * 12];
    for (const sg of [1, -1]) { for (let j = 0; j < JB; j++) { const p = g(i, j, sg), q = g(i, j + 1, sg); face(b, p, q, foot(q[1]), foot(p[1]), n); } const c = foot(g(i, JB, sg)[1]); for (let j = JB; j < JS; j++) b.tri(c, g(i, j, sg), g(i, j + 1, sg)); } };
  endFace(0, [-1, 0, 0]); endFace(NI - 1, [1, 0, 0]);
  b.name('chassis').mat(DARK, 0.05); emit(cells.under);
  b.name('grille').mat(DARK, 0.05); emit(cells.mouth);
  b.name('screenPane').mat(GLASS, 0.5, 'glass'); emit(cells.screen); b.name('screenPane').mat(GLASS, 0.5, 'glass'); emit(cells.glass);
  // where the skin is: its height at (x, y) on top, its distance from the centre line at (x, z) on the flank, the nose's and tail's faces at y
  const zTop = (x: number, y: number) => { const z = probe(TOP, 0, 1, 2, x, y); if (Number.isNaN(z)) throw new Error(`eb110: no skin at ${x}, ${y}`); return z; };
  const ySide = (x: number, z: number) => { const y = probe(SIDE, 0, 2, 1, x, z); if (Number.isNaN(y)) throw new Error(`eb110: no flank at ${x}, ${z}`); return y; };
  const top = (x: number, y: number, lift = 4): V => [x, y, zTop(x, y) + lift], flank = (x: number, z: number, sg: number, lift = 4): V => [x, sg * (ySide(x, z) + lift), z];
  const noseX = (y: number) => S0 - BOW(S0) * (1 - (Math.abs(y) / YB(S0)) ** PB), tailX = (y: number) => S1 - BOW(S1) * (1 - (Math.abs(y) / YB(S1)) ** PB);
  const nose = (y: number, z: number, lift = 4): V => [noseX(y) - lift, y, z], tail = (y: number, z: number, lift = 4): V => [tailX(y) + lift, y, z];
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
    const crest = (y: number): V => [1560 - 300 * (y / 800) ** 2, y, 800 - 62 * (y / 800) ** 2];
    b.name('cockpit').mat(TRIM, 0.15); for (const sg of [1, -1]) for (let j = 0; j < JA + 1; j++) { const p = g(IB, j, sg), q = g(IB, j + 1, sg), lo = (v: V): V => [v[0] + 12, v[1] * 0.985, v[2] - 10], c0 = crest(p[1] * 0.985), c1 = crest(q[1] * 0.985);
      face(b, lo(p), lo(q), c1, c0, UP); face(b, c0, c1, [c1[0] + 50, c1[1], 430], [c0[0] + 50, c0[1], 430], [1, 0, 0.3]); }
    b.name('cockpit').mat(TRIM, 0.15).box(1500, xb, -105, 105, FL, 355);
    for (const sg of [1, -1]) { const y0 = sg * 170, y1 = sg * 560;
      b.name('seat').mat(SEAT, 0.25, 'leather').box(2020, 2500, Math.min(y0, y1), Math.max(y0, y1), FL, 335).loft(([[2420, 335], [2490, 620], [2570, 850], [2640, 880]] as const).map(([x, z]) => [[x, y0 + sg * 15, FL], [x, y1 - sg * 15, FL], [x, y1 - sg * 15, z], [x, y0 + sg * 15, z]] as V[]));
      b.name('seat').mat(SEAT2, 0.1); for (const y of [y0 + sg * 130, y0 + sg * 260]) b.bar([2040, y, 337], [2420, y, 337], 8).bar([2494, y, 624], [2572, y, 846], 8); } }

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
  { /* review 131, heights as the sheet's front view's shares of the real 1125 mm (the view itself is drawn squashed): the intakes from 80 to 245, the horseshoe 85-280, the badge at 307 */
    const shoe: [number, number][] = [[-40, 88], [-56, 180], [-54, 236], [-36, 268], [0, 280], [36, 268], [54, 236], [56, 180], [40, 88]], fan = (k: number, lift: number) => { for (let i = 0; i + 1 < shoe.length; i++) b.tri(nose(0, 180, lift), nose(shoe[i + 1]![0] * k, 182 + (shoe[i + 1]![1] - 182) * k, lift), nose(shoe[i]![0] * k, 182 + (shoe[i]![1] - 182) * k, lift)); };
    b.name('grille').mat(SILVER, 0.8, 'metal'); fan(1.14, 2); b.name('grille').mat(DARK, 0.05, 'grille'); fan(1, 5);
    for (const sg of [1, -1]) { b.name('grille').mat(DARK, 0.05); patch(b, (u, v) => nose(sg * lerp(100, 475, u), lerp(80, 245, v)), 3, 1, [-1, 0, 0]); patch(b, (u, v) => nose(sg * lerp(540, 640, u), lerp(100, 235, v)), 1, 1, [-1, 0, 0]);
      b.name('grille').mat(PAINT, GLOSS, 'paint'); for (const z of [114, 158, 202]) patch(b, (u, v) => nose(sg * lerp(100, 475, u), z + v * 13, 6), 3, 1, [-1, 0, 0]); }   /* three bars a side, as the sheet */
    b.name('badge').mat(RED, 0.5); { const o: [number, number][] = [[-30, 0], [-17, 12], [17, 12], [30, 0], [17, -12], [-17, -12]]; for (let i = 1; i + 1 < o.length; i++) b.tri(nose(o[0]![0], 307 + o[0]![1], 5), nose(o[i + 1]![0], 307 + o[i + 1]![1], 5), nose(o[i]![0], 307 + o[i]![1], 5)); }
    for (const sg of [1, -1]) { const pk = (u: number, v: number, lift: number): V => { const x = lerp(278, 540, u); return top(x, sg * lerp(lerp(300, 262, u), lerp(688, 676, u), v), lift); };
      b.name('lamp').mat(DARK, 0.05); patch(b, (u, v) => pk(u, v, 3), 3, 4, UP);
      b.name('lens').mat(LENS, 0.6, 'lens'); for (const [v0, v1] of [[0.1, 0.48], [0.52, 0.92]] as const) patch(b, (u, v) => pk(lerp(0.12, 0.88, u), lerp(v0, v1, v), 7 + 34 * u), 2, 2, UP);   /* standing up toward the back of the pocket: the units face forward as on the sheet */
      b.name('lampCover').mat(GLASS, 0.5, 'glass'); patch(b, (u, v) => pk(u, v, 12), 3, 4, UP);
      b.name('lamp').mat(AMBER, 0.5, 'lens'); face(b, flank(610, 372, sg), flank(700, 372, sg), flank(700, 398, sg), flank(610, 398, sg), [0, sg, 0]); } }                  // the side repeater

  // ---- the flanks: the doors' edges, the intake behind the front wheel, the vent behind the rear one ----
  for (const sg of [1, -1]) { b.name('door').mat(SEAM, 0.1);
    seamSide([[1396, ZB(1396) - 14], [1402, 640], [1425, 500], [1478, 370], [1560, 250], [1650, 150]], sg);                                                    // the front edge, curving back round the wheel
    seamSide([[SP + 6, ZB(SP + 6) - 14], [SP + 6, 640], [SP, 520], [2690, 440], [2640, 372], [2575, 290], [2520, 215], [2490, 150]], sg);                      // the back edge, curving forward to the sill
    b.name('grille').mat(DARK, 0.05); face(b, flank(1470, 165, sg), flank(1530, 165, sg), flank(1570, 300, sg), flank(1500, 300, sg), [0, sg, 0]);
    face(b, flank(4120, 235, sg), flank(4180, 235, sg), flank(4180, 450, sg), flank(4120, 450, sg), [0, sg, 0]); }

  // ---- behind the cabin: the louvred quarter lights on the buttresses, the slots of the engine cover between them ----
  b.name('louvre').mat(DARK, 0.05); for (const sg of [1, -1]) for (let k = 0; k < 6; k++) { const s0 = 2795 + k * 104, V4 = [0.14, 0.38, 0.62, 0.86], p = (s: number, v: number): V => { const x = s, f = lerp(0.14, 0.86, v); return top(x, sg * lerp(YA(x), YB(x), f)); };   /* review 131: straight slats across the pane, as the sheet's plan */
    for (let i = 0; i + 1 < V4.length; i++) { const v0 = (V4[i]! - 0.14) / 0.72, v1 = (V4[i + 1]! - 0.14) / 0.72; face(b, p(s0, v0), p(s0 + 62, v0), p(s0 + 62, v1), p(s0, v1), UP); } }
  b.name('engineCover').mat(DARK, 0.05); for (let k = 0; k < 6; k++) { const x0 = 2905 + k * 118, us = [-0.74, -0.5, -0.25, 0, 0.25, 0.5, 0.74]; for (let i = 0; i + 1 < us.length; i++) face(b, top(x0, us[i]! * YA(x0)), top(x0 + 66, us[i]! * YA(x0 + 66)), top(x0 + 66, us[i + 1]! * YA(x0 + 66)), top(x0, us[i + 1]! * YA(x0)), UP); }
  b.name('engineCover').mat(SEAM, 0.1); for (const sg of [1, -1]) seamTop(2800, sg * 0.84 * YA(2800), 3660, sg * 0.84 * YA(3660), 8); seamTop(3660, -0.84 * YA(3660), 3660, 0.84 * YA(3660), 8); seamTop(2790, -0.84 * YA(2790), 2790, 0.84 * YA(2790), 8);
  b.name('body').mat(SEAM, 0.1); seamTop(3985, -YB(3985) + 12, 3985, YB(3985) - 12, 14);                                                                       // the tail panel's shut line

  // ---- the tail: three lamps a side (the outer amber), the grille band and badge between, the valance with its four pipes ----
  { const lamps: [number, number, string][] = [[452, 548, RED], [554, 650, RED], [656, 752, AMBER]];
    b.name('tailRim').mat(FRAME, 0.2); for (const sg of [1, -1]) patch(b, (u, v) => tail(sg * lerp(440, 764, u), lerp(575, 745, v), 3), 3, 1, [1, 0, 0]);
    for (const sg of [1, -1]) for (const [y0, y1, c] of lamps) { b.name('tail').mat(c, 0.5, 'lens'); patch(b, (u, v) => tail(sg * lerp(y0, y1, u), lerp(585, 735, v), 7), 1, 1, [1, 0, 0]); }
    b.name('grille').mat(DARK, 0.05); patch(b, (u, v) => tail(lerp(-425, 425, u), lerp(581, 739, v)), 6, 1, [1, 0, 0]);
    b.name('grille').mat(PAINT, GLOSS, 'paint'); for (const z of [608, 654, 700]) patch(b, (u, v) => tail(lerp(-425, 425, u), z + v * 12, 8), 6, 1, [1, 0, 0]);
    b.name('badge').mat(RED, 0.5); { const n = 8, o = (i: number, k: number): V => { const a = i / n * Math.PI * 2; return tail(Math.cos(a) * 92 * k, 660 + Math.sin(a) * 40 * k, 11 + (k < 1 ? 1 : 0)); }; for (let i = 0; i < n; i++) b.tri(tail(0, 660, 12), o(i, 1), o(i + 1, 1)); }
    b.name('tail').mat(RED2, 0.5, 'lens'); patch(b, (u, v) => tail(lerp(-72, 72, u), lerp(366, 400, v)), 1, 1, [1, 0, 0]);
    b.name('bumperR').mat(DARK, 0.05); for (const sg of [1, -1]) patch(b, (u, v) => tail(sg * lerp(240, 770, u), lerp(60, 318, v)), 3, 2, [1, 0, 0]); patch(b, (u, v) => tail(lerp(-195, 195, u), lerp(60, 238, v)), 2, 1, [1, 0, 0]);   /* review 131: the sheet's recesses, low */
    b.name('exhaust').mat(CHROME, 0.9, 'metal'); for (const sg of [1, -1]) for (const y of [455, 565]) b.lathe('x', [tailX(y), sg * y, 172], [[-40, 48], [12, 48], [12, 39], [-30, 36]], 10, false); }   /* the two pairs low in the recesses, as the sheet */

  // ---- the mirrors on their stalks ----
  for (const sg of [1, -1]) { const ring = (x: number, k: number): V[] => { const yc = 925, zc = 838, hw = 86 * k, hh = 50 * k; return ([[-1, -0.6], [-1, 0.6], [-0.6, 1], [0.6, 1], [1, 0.6], [1, -0.6], [0.6, -1], [-0.6, -1]] as const).map(([u, v]) => [x, sg * (yc + u * hw), zc + v * hh] as V); };
    b.name('mirror').mat(PAINT, GLOSS, 'paint').loft([ring(1480, 0.55), ring(1520, 0.92), ring(1600, 1), ring(1636, 0.96)]).bar([1556, sg * (YB(1556) - 6), ZB(1556) - 26], [1562, sg * 880, 800], 56, 26);
    b.name('mirror').mat(CHROME, 0.9, 'metal'); const r = ring(1639, 0.84); for (let i = 1; i + 1 < r.length; i++) b.tri(r[0]!, r[i]!, r[i + 1]!); }

  // ---- the wing: the tail's trailing blade in its dark bed, a slot of it showing ahead of the blade; raised, it stands on two struts, its trailing edge up ----
  { const x0 = 4212, se = 4322, xe = (y: number) => se - BOW(se) * (1 - (Math.abs(y) / YB(se)) ** PB) - 4, xp = 4300, zp = zTop(xp, 0), a = 10 * wing * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), lift = 110 * wing;
    const T = (p: V): V => { const dx = p[0] - xp, dz = p[2] - zp; return [xp + dx * ca - dz * sa, p[1], zp + dx * sa + dz * ca + lift]; };
    b.name('wing').mat(FRAME, 0.1); for (let i = 0; i < 8; i++) { const y0 = lerp(-690, 690, i / 8), y1 = lerp(-690, 690, (i + 1) / 8); for (const [u0, u1] of [[0, 0.3], [0.3, 0.65], [0.65, 1]] as const) { const x = (y: number, u: number) => lerp(4172, xe(y) - 8, u); face(b, top(x(y0, u0), y0, 3), top(x(y0, u1), y0, 3), top(x(y1, u1), y1, 3), top(x(y1, u0), y1, 3), UP); } }
    b.name('wing').mat(PAINT, GLOSS, 'paint').loft([-745, -600, -450, -300, -150, 0, 150, 300, 450, 600, 745].map(y => { const x1 = xe(y), xm = (x0 + x1) / 2; return ([[x0, -4], [x0 + 28, 5], [xm, 7], [x1 - 26, 6], [x1, 1], [xm, -12]] as const).map(([x, dz]) => T([x, y, zTop(x, y) + dz])); }));
    if (wing > 0.02) { b.name('wing').mat(FRAME, 0.2); for (const y of [-340, 340]) b.bar([xp, y, zTop(xp, y) - 12], T([xp, y, zTop(xp, y) - 8]), 54, 16); } }

  for (const s of [1, -1] as const) { wheel(b, FX, s, spin); wheel(b, RX, s, spin); }
  return b.mesh(L); }
export const mesh = eb110Mesh;
