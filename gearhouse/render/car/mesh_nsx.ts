// The 1990 Honda NSX (NA1: pop-up head lamps, the black roof) as a low-polygon mesh (docs/systems/70_mesh_car_rules.md),
// built panel by panel from the dimension sheet data/cars/spec/nsx.json (docs/systems/85_nsx_sheet.md).
//
// Every panel is its own grid of points (its own part), and neighbours share their border points, so nothing gaps.
//   nose        round in plan: rows going round from the centre line to the front arch, each line a super-ellipse; above
//               the shut line the bonnet's and the wings' leading edge, below it the bumper (thin combination lamps at
//               its top corners, a centre intake and two outer ones with the fog lamps, cut in)
//   front top   the long bonnet between its two shut lines, the wings beside it, the pop-up lamp covers flush in the
//               slope (hinged at their back edge), the dark cowl under the screen's bowed foot
//   canopy      ONE glossy black glasshouse on the red body: the screen with its black band, black pillars, the black
//               roof panel, the door glass, the black B pillar, the triangular quarter glass and the big rear glass,
//               all on one surface; the belt line is its crisp border; it ends as a rounded tongue lying between the
//               two body-coloured ridges of the rear wings
//   flank       a chain of twelve points at every station: the belt (or the wing's crest) K, a rounded shoulder down to
//               the widest line H (the door's soft crease, which runs into the side intake), the sill's crease, the foot;
//               the arches are cut by clamping the chain to the arch's height; the intake is cut in behind the door
//   tail        ONE frame seen from behind: the spoiler's blade across the top runs into the rear wings' tops, the wings'
//               rear faces come down the sides, and in the opening they frame the full-width lamp panel sits recessed
//               and upright, an open slot between its top and the blade (the deck shows through); under it the
//               bumper, a wide box standing proud with a crisp ledge and a plate recess; a dark valance let into its foot
//   inside      the cabin (dash, tunnel, two seats, the bulkhead with its small window) and, under the rear glass, a
//               dark engine bay with the transverse V6 of render/car/enginemesh.ts
// Axes: x from the nose back, y across, z up; mm. Axles at 930 and 3460. `lamps` 0..1 raises the head lamp pods.
import { Build, type Mesh, type V } from './mesh';
import { addEngine, ENGINES } from './enginemesh';

const PAINT = '#c8141e', GLOSS = 0.6, SMOKE = '#5a0c10', SHADE = '#1e0508', BLACK = '#0c0c0f', FRAME = '#14151a', DARK = '#131318', TRIM = '#25272d', GLASS = '#a9c2cc', SILVER = '#c9ccd0', CHROME = '#d4d6d9', RUBBER = '#26242b';
const LENS = '#eef0f2', RED = '#c9221f', AMBER = '#e8901c', SEAT = '#3a3a40', SEAT2 = '#63636b', SEAM = '#3d070b', WHITE = '#e6e4dc';
const L = 4405, FX = 930, RX = 3460, RF = 293, RR = 316, WYF = 755, WYR = 765, TWF = 205, TWR = 225;       // the axles, the tyres' radii, half the tracks, the tyres' widths
const RAF = 355, RAR = 352, YINF = 560, YINR = 630;                                                          // the arches' radii, the wells' inner walls
const X0 = 45, XJ = 575, KW = 790, XA = 1410, XR0 = 2050, XR1 = 2690, XQ = 2960, XG = 3520, XT1 = 4250;      // the top's front edge, the nose's last row (the front arch), half the top's width there, the pillar's foot, the roof's front corner and back edge, the quarter glass's tip, the rear glass's foot, the last station
type Tri = [V, V, V];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], un = (a: V): V => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t, mix = (a: V, b: V, t: number): V => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mir = (p: V, sg: number): V => [p[0], p[1] * sg, p[2]];
/** straight runs through a table of [x, value] */
function lin(tab: [number, number][]): (x: number) => number { return x => { if (x >= tab[0]![0]) return tab[0]![1]; for (let i = 1; i < tab.length; i++) if (x >= tab[i]![0]) { const [x0, v0] = tab[i - 1]!, [x1, v1] = tab[i]!; return v0 + (v1 - v0) * (x - x0) / (x1 - x0); } return tab[tab.length - 1]![1]; }; }
/** a smooth curve through a table of [x, value]: a monotone cubic (it never overshoots a point) */
function curve(tab: [number, number][]): (x: number) => number { const n = tab.length, h: number[] = [], d: number[] = [], m: number[] = [];
  for (let i = 0; i + 1 < n; i++) { h[i] = tab[i + 1]![0] - tab[i]![0]; d[i] = (tab[i + 1]![1] - tab[i]![1]) / h[i]!; }
  for (let i = 0; i < n; i++) { if (i === 0 || i === n - 1) { m[i] = d[i === 0 ? 0 : n - 2]!; continue; } const a = d[i - 1]!, c = d[i]!; if (a * c <= 0) { m[i] = 0; continue; } const w1 = 2 * h[i]! + h[i - 1]!, w2 = h[i]! + 2 * h[i - 1]!; m[i] = (w1 + w2) / (w1 / a + w2 / c); }
  return x => { if (x <= tab[0]![0]) return tab[0]![1]; if (x >= tab[n - 1]![0]) return tab[n - 1]![1]; let i = 0; while (x > tab[i + 1]![0]) i++; const t = (x - tab[i]![0]) / h[i]!, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * tab[i]![1] + (t3 - 2 * t2 + t) * h[i]! * m[i]! + (3 * t2 - 2 * t3) * tab[i + 1]![1] + (t3 - t2) * h[i]! * m[i + 1]!; }; }

// ---- the lines along the car (the sheet's tables) ----
/** the front top's centre line: the nose, the long bonnet, the cowl, carried on to the pillars' feet */
const ZH = curve([[0, 440], [25, 475], [50, 493], [100, 516], [200, 563], [300, 604], [400, 639], [500, 669], [600, 698], [700, 721], [800, 739], [900, 751], [1000, 762], [1110, 776], [1250, 776], [XA, 760]]);
/** half the width at the widest line (the plan) */
const W = curve([[XJ, 860], [636, 876], [698, 882], [1200, 882], [1383, 866], [1632, 866], [1900, 869], [2500, 873], [2700, 878], [2950, 881], [3100, 893], [3250, 903], [3350, 905], [3600, 898], [3700, 892], [3750, 884], [3813, 870], [3875, 860], [3937, 852], [4000, 842], [4062, 834], [4124, 825], [4187, 812], [XT1, 799]]);
/** the nose in plan: super-ellipses from each line's foremost point to the front arch */
const gp = (f: number, p: number) => 1 - (1 - Math.min(1, Math.max(0, f)) ** p) ** (1 / p), ginv = (v: number, p: number) => (1 - (1 - Math.max(0, Math.min(1, v))) ** p) ** (1 / p);
const crestX = (y: number) => X0 + (XJ - X0) * gp(y / KW, 3), yKn = (x: number) => KW * ginv((x - X0) / (XJ - X0), 3);
/** K: the flank's top edge: the front wing's crest, the belt under the side glass, the rear wing's ridge */
const YKB = curve([[XJ, KW], [700, 812], [1217, 812], [1300, 796], [XA, 760], [2000, 762], [XR1, 765], [XQ, 752], [3040, 768], [3175, 785], [3351, 792], [3600, 790], [3900, 776], [4100, 765], [XT1, 758]]);
const yK = (x: number) => x < XJ ? yKn(x) : YKB(x);
/** the front top: nearly flat across, the wings' tops a touch proud, rolling off toward the crest */
const zF = (x: number, y: number) => { const sh = Math.min(1, y / (x < XJ ? KW : YKB(x))); return ZH(x) + 10 * sm(400, 800, x) * sh * sh - 28 * sh ** 4; };
const ZKB = curve([[XA, zF(XA, 760)], [1500, 734], [1750, 748], [2000, 757], [2250, 772], [2500, 790], [2750, 805], [2890, 826], [XQ, 858], [3040, 870], [3108, 877], [3175, 880], [XG, 880], [3700, 868], [3850, 862], [3950, 870], [4050, 888], [4150, 897], [XT1, 897]]);
const zK = (x: number) => x <= XA ? zF(x, yK(x)) : ZKB(x);
/** H: the widest line's height (the shoulder, then the door's soft crease that runs into the intake) */
const ZW = curve([[XJ, 500], [700, 520], [930, 540], [1450, 590], [2000, 597], [2500, 610], [XR1, 614], [XQ, 618], [3460, 610], [3900, 596], [XT1, 580]]);
/** the roof's and the rear glass's centre line; the roof's half-width; the canopy's cross-section (flat on top, rolling off to its edge) */
const ZR = curve([[1975, 1136], [XR0, 1152], [2100, 1160], [2250, 1169], [2400, 1170], [2550, 1165], [2650, 1156], [2700, 1149], [2800, 1126], [2900, 1102], [3000, 1073], [3200, 1003], [3400, 930], [3470, 902], [XG, 882]]), YD = 490, CROWN = 18, CP = 2.4;
const SH = [0, 0.2, 0.4, 0.6, 0.72, 0.84, 0.94, 1], NC = SH.length;                                         // the top's columns as shares of its half-width (the bonnet's shut line at 0.6)
const xRoof = (s: number, sh: number) => s - 75 * (1 - sh * sh) * (1 - (s - XR0) / (XR1 - XR0));
/** the slanting edge between the quarter glass and the rear glass, from the roof's back corner down to the belt */
const YS = curve([[XR1, YD], [2750, 600], [2820, 672], [2890, 722], [XQ, 752]]), ZS = curve([[XR1, ZR(XR1) - CROWN], [2750, 1092], [2820, 1018], [2890, 940], [2935, 888], [XQ, 858]]);   // review 155: eased into the belt at its foot, so the canopy's edge runs down in one sweep (no V where it meets the ridge)
/** the rear glass's edge behind the quarter glass: along the wing's ridge, then round its foot (the tongue) */
const GY = curve([[XQ, 752], [3040, 712], [3108, 694], [3200, 675], [3300, 645], [3400, 590], [3460, 520], [3495, 440], [3512, 350], [XG, 230]]);
const glassEdge = (x: number): V => x <= XQ ? [x, YS(x), ZS(x)] : [x, GY(x), zK(x)];
const glassPt = (x: number, sh: number): V => { const e = glassEdge(x); return [x, e[1] * sh, ZR(x) - (ZR(x) - e[2]) * sh ** CP]; };
/** the deck: the boot lid a flat floor between the wings, sinking a little toward the tail (the wings' ridges rise past it into the
 *  spoiler's ends, so the side view keeps the ridge's line); its edge up to the ridge steepens backward into the spoiler's end */
const ZD = curve([[XG, 880], [3600, 875], [3700, 866], [3850, 855], [4000, 845], [4150, 838], [4300, 828]]);
const zDeck = (x: number, y: number) => { const zc = x <= XG ? zK(x) : ZD(x), u = sm(3900, 4150, x); return zc + (zK(x) - zc) * sm(lerp(600, 590, u), lerp(715, 604, u), y); };
/** the wheel arches: round, over each hub */
const archZ = (x: number) => Math.abs(x - FX) < RAF - 0.5 ? RF + Math.sqrt(RAF * RAF - (x - FX) ** 2) : Math.abs(x - RX) < RAR - 0.5 ? RR + Math.sqrt(RAR * RAR - (x - RX) ** 2) : 0;

// ---- the flank ----
const NK = 11;                                                                                               // a chain's cells: K, three points down the shoulder, H, two down the door, the sill's crease and step, its face, its foot, the tuck
/** the shoulder's arc from K (level there) down to H (upright there) */
function band(K: V, H: V, t: number): V { const dz = K[2] - H[2], P1: V = [lerp(K[0], H[0], 0.6), lerp(K[1], H[1], 0.6), K[2] - 0.12 * dz], P2: V = [H[0], H[1], H[2] + 0.45 * dz], v = 1 - t;
  return [0, 1, 2].map(k => v * v * v * K[k]! + 3 * v * v * t * P1[k]! + 3 * v * t * t * P2[k]! + t * t * t * H[k]!) as V; }
/** how far the flank stands in from the widest line at height z (below H): the door's face, the sill's crease at 355 and the step under it, the foot at 125 */
const INSET = lin([[355, 14], [338, 30], [230, 36], [125, 46], [118, 90]]);
const inset = (x: number, z: number, zH: number) => { const std = z >= 355 ? 14 * (zH - z) / (zH - 355) : INSET(z), u = sm(3700, XT1, x); return u > 0 ? lerp(std, 46 * Math.max(0, (zH - z) / (zH - 125)) ** 1.5, u) : std; };
/** the flank's skin at station x and height z */
function surf(x: number, z: number): V { const K: V = [x, yK(x), zK(x)], H: V = [x, W(x), ZW(x)]; if (z >= K[2]) return K; if (z < H[2]) return [x, H[1] - inset(x, z, H[2]), z];
  let lo = 0, hi = 1; for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (band(K, H, m)[2] > z) lo = m; else hi = m; } return band(K, H, (lo + hi) / 2); }
/** the heights of the tail's lines (the spoiler's top edge, its trailing roll, its under-edge, the lamp panel's top, middle and foot, the
 *  bumper's top edge, the plate's top and foot, the valance's top, middle and foot) and how far back each reaches on the centre line */
const TAILZ = [897, 890, 872, 820, 745, 668, 655, 550, 425, 395, 290, 210], TAILX = [4300, 4308, 4298, 4296, 4302, 4310, 4390, 4402, 4403, 4398, 4370, 4320];
const LAMPIN = 22, VALIN = 35;                                                                               // how far the lamp panel and the valance stand in from the frame
/** the chain at station x: NK + 1 points from K down to the tuck under the sill (behind the rear wheel its levels move to the tail's); cut by the arches */
function chain(x: number): V[] { const K: V = [x, yK(x), zK(x)], H: V = [x, W(x), ZW(x)], zH = H[2], u = sm(3700, XT1, x), az = archZ(x), out: V[] = [K];
  const zs = [lerp(zH, 355, 0.38), lerp(zH, 355, 0.72), 355, 338, 230, 125, 118];
  for (let k = 1; k <= NK; k++) { let p: V = k < 4 ? band(K, H, k / 4) : k === 4 ? H : [x, H[1] - inset(x, zs[k - 5]!, zH), zs[k - 5]!];
    if (u > 0) p = surf(x, lerp(p[2], TAILZ[k]!, u)); if (az > 0 && p[2] < az) p = surf(x, az); out.push(p); }
  return out; }
/** the stations from the front arch back: every 18 degrees round an arch */
const arcS = (hx: number, ra: number) => Array.from({ length: 9 }, (_, k) => Math.round(hx - ra * Math.cos((k + 1) * 18 * Math.PI / 180)));
const SF = [XJ, ...arcS(FX, RAF).map(x => x === 643 ? 630 : x), FX + RAF, 1350, XA, 1500, 1620, 1750, 1900, XR0, 2200, 2350, 2500, 2600, XR1, 2750, 2820, 2890, XQ, 3040, RX - RAR, ...arcS(RX, RAR), RX + RAR, 3880, 3950, 4050, 4150, XT1], NS = SF.length;
const at = (x: number) => { const i = SF.indexOf(x); if (i < 0) throw new Error(`nsx: no station at ${x}`); return i; };

/** a flat disc across the axle at o */
function disc(b: Build, o: V, r: number, seg: number, a0 = 0) { for (let i = 0; i < seg; i++) { const a = a0 + i / seg * Math.PI * 2, c = a0 + (i + 1) / seg * Math.PI * 2; b.tri(o, [o[0] + Math.cos(a) * r, o[1], o[2] + Math.sin(a) * r], [o[0] + Math.cos(c) * r, o[1], o[2] + Math.sin(c) * r]); } }
/** a four-sided face wound so that it looks along n */
function face(b: Build, p: V, q: V, r: V, t: V, n: V) { if (dot(cross(sub(q, p), sub(t, p)), n) + dot(cross(sub(r, q), sub(p, q)), n) >= 0) b.quad(p, q, r, t); else b.quad(p, t, r, q); }
/** a triangle wound so that it looks along n */
function tri(b: Build, p: V, q: V, r: V, n: V) { const c = cross(sub(q, p), sub(r, p)); if (Math.hypot(c[0], c[1], c[2]) < 0.5) return; if (dot(c, n) >= 0) b.tri(p, q, r); else b.tri(p, r, q); }
/** a flat many-sided face as a fan about its middle, looking along n */
function fan(b: Build, pts: V[], n: V) { const c: V = [0, 0, 0]; for (const p of pts) { c[0] += p[0] / pts.length; c[1] += p[1] / pts.length; c[2] += p[2] / pts.length; } for (let i = 0; i < pts.length; i++) tri(b, c, pts[i]!, pts[(i + 1) % pts.length]!, n); }
/** the walls of a pocket: from a ring of points, d deep, facing the ring's middle */
function tube(b: Build, ring: V[], d: V) { const c: V = [0, 0, 0]; for (const p of ring) { c[0] += p[0] / ring.length; c[1] += p[1] / ring.length; c[2] += p[2] / ring.length; }
  for (let i = 0; i < ring.length; i++) { const p = ring[i]!, q = ring[(i + 1) % ring.length]!; if (Math.hypot(...sub(q, p)) < 0.5) continue; face(b, p, q, add(q, d), add(p, d), sub(c, mix(p, q, 0.5))); } }

/** the 1990 cast five-spoke wheel: a bright lip, a flat face of five broad spokes (the openings between them dark, laid on the face), a cap with five nuts */
function wheel(b: Build, x: number, s: 1 | -1, spin = 0) { const front = x === FX, R = front ? RF : RR, wy = front ? WYF : WYR, tw = front ? TWF : TWR, o: V = [x, s * wy, R], rim = front ? 196 : 209, h = tw / 2, f = s * h, SEG = 24;
  b.name(front ? 'tyreF' : 'tyreR').mat(RUBBER, 0.05, 'tyre').lathe('y', o, [[-f, R - 30], [-f * 0.72, R], [f * 0.72, R], [f * 0.94, R - 10], [f, R - 30], [f, rim]], SEG, false);
  b.name('rim').mat(SILVER, 0.8, 'metal').lathe('y', o, [[f, rim + 3], [f - s * 7, rim - 5], [f - s * 26, rim - 14]], SEG, false);
  b.name('wheel').mat(DARK, 0.05); disc(b, [x, s * wy - f * 0.6, R], R - 28, 10);
  const yo = f - s * 26, yi = f - s * (front ? 30 : 40), r1 = rim - 14, yAt = (r: number) => s * wy + lerp(yi, yo, Math.max(0, Math.min(1, (r - 60) / (r1 - 60))));
  b.name('wheel').mat('#dcdee1', 0.35, 'metal').lathe('y', o, [[yo, r1], [lerp(yi, yo, 0.35), 110], [yi, 60], [yi + s * 4, 44]], 15, false);
  b.name('wheel').mat(DARK, 0.05); for (let k = 0; k < 5; k++) { const a = spin + (k / 5 + 0.1) * Math.PI * 2, P = (r: number, da: number): V => [x + Math.cos(a + da) * r, yAt(r) + s * 2.5, R + Math.sin(a + da) * r], ro = r1 - 10;
    fan(b, [P(104, 0), P(116, -0.17), P(ro - 12, -0.36), P(ro, -0.3), P(ro, 0), P(ro, 0.3), P(ro - 12, 0.36), P(116, 0.17)], [0, s, 0]); }
  b.name('hub').mat(SILVER, 0.7, 'metal'); disc(b, [x, s * wy + yi + s * 8, R], 52, 10);
  b.name('hub').mat(FRAME, 0.4); for (let k = 0; k < 5; k++) { const a = spin + (k / 5 + 0.1) * Math.PI * 2; disc(b, [x + Math.cos(a) * 34, s * wy + yi + s * 10, R + Math.sin(a) * 34], 8, 5); }
}

export function nsxMesh(spin = 0, lamps = 0): Mesh { const b = new Build(); lamps = Math.max(0, Math.min(1, lamps));
  /** the cells of a grid of points (given for the car's right half) laid on both sides, wound outward (rows going back,
   *  columns going out and down); each cell cut along the diagonal that folds it less; `pick` chooses the cells */
  const cells = (P: V[][], pick: (i: number, j: number) => boolean = () => true) => { for (let i = 0; i + 1 < P.length; i++) for (let j = 0; j + 1 < Math.min(P[i]!.length, P[i + 1]!.length); j++) { if (!pick(i, j)) continue;
    const q = [P[i]![j]!, P[i + 1]![j]!, P[i + 1]![j + 1]!, P[i]![j + 1]!] as [V, V, V, V], nn = (p: V, r: V, s: V) => un(cross(sub(r, p), sub(s, p))), alt = dot(nn(q[0], q[1], q[2]), nn(q[0], q[2], q[3])) < dot(nn(q[1], q[2], q[3]), nn(q[1], q[3], q[0])) - 1e-9;
    const ts: Tri[] = alt ? [[q[1], q[2], q[3]], [q[1], q[3], q[0]]] : [[q[0], q[1], q[2]], [q[0], q[2], q[3]]];
    for (const t of ts) { const c = cross(sub(t[1], t[0]), sub(t[2], t[0])); if (Math.hypot(c[0], c[1], c[2]) < 0.5) continue; b.tri(t[0], t[1], t[2]); b.tri(mir(t[0], -1), mir(t[2], -1), mir(t[1], -1)); } } };
  /** the strip between two lines of points with different numbers of points (A inboard, B outboard, both going back), on both sides, looking along n */
  const zip = (A: V[], B: V[], n: V) => { const len = (P: V[]) => { const s = [0]; for (let i = 1; i < P.length; i++) s.push(s[i - 1]! + Math.hypot(...sub(P[i]!, P[i - 1]!))); return s.map(v => v / (s[s.length - 1]! || 1)); }, ta = len(A), tb = len(B); let i = 0, j = 0;
    while (i + 1 < A.length || j + 1 < B.length) { const stepA = j + 1 >= B.length || (i + 1 < A.length && ta[i + 1]! <= tb[j + 1]!), t: Tri = stepA ? [A[i]!, A[i + 1]!, B[j]!] : [A[i]!, B[j + 1]!, B[j]!];
      for (const sg of [1, -1]) tri(b, mir(t[0], sg), mir(t[1], sg), mir(t[2], sg), n); if (stepA) i++; else j++; } };
  /** the border of a block of cells, going round */
  const border = (P: V[][], i0: number, i1: number, j0: number, j1: number): V[] => { const r: V[] = []; for (let j = j0; j <= j1; j++) r.push(P[i0]![j]!); for (let i = i0 + 1; i <= i1; i++) r.push(P[i]![j1]!); for (let j = j1 - 1; j >= j0; j--) r.push(P[i1]![j]!); for (let i = i1 - 1; i > i0; i--) r.push(P[i]![j0]!); return r; };
  /** a pocket sunk from a ring by d: dark walls, and a back of the kind given */
  const pocket = (ring: V[], d: V, n: V, back: 'plain' | 'grille' = 'plain') => { b.mat(DARK, 0.05); tube(b, ring, d); b.mat(DARK, 0.05, back); fan(b, ring.map(p => add(p, d)), n); };
  /** a patch inside the cell (i, j) of a grid: u along the rows' direction, v along the columns', lifted along n */
  const inCell = (P: V[][], i: number, j: number, u0: number, u1: number, v0: number, v1: number, lift: number, n: V, sg: number) => { const at2 = (u: number, v: number): V => { const p = mix(mix(P[i]![j]!, P[i + 1]![j]!, u), mix(P[i]![j + 1]!, P[i + 1]![j + 1]!, u), v); return mir([p[0] + n[0] * lift, p[1] + n[1] * lift, p[2] + n[2] * lift], sg); };
    face(b, at2(u0, v0), at2(u1, v0), at2(u1, v1), at2(u0, v1), mir(n, sg)); };
  const UPV: V = [0, 0, 1];

  // ---- the points ----
  // the flank's chains
  const CH = SF.map(chain), CJ = CH[0]!, CT = CH[NS - 1]!;
  // the front top: rows from its front edge (the crest round the nose) back to the screen's bowed foot; seven columns
  // (the bonnet's shut line the fourth, the lamp cover between the fifth and the seventh) and the crest K
  const FC = [0, 0.15, 0.3, 0.452, 0.557, 0.72, 0.886].map(f => f * KW), S0 = crestX(FC[6]!), SL = 250;
  const topRow = (s: number, r: number): V[] => { const kx = s < 0 ? lerp(S0, 300, r) : s < XJ ? s + 50 * (1 - sm(SL, XJ, s)) : s, ykx = yK(kx), t = s < 0 ? 0 : sm(630, 1350, s), bow = s > XJ ? 300 * ((s - XJ) / (XA - XJ)) ** 1.3 : 0;
    const row: V[] = FC.map((y0, j) => { const y = lerp(y0, SH[j]! * 760, t), x = s < 0 ? lerp(crestX(y), SL, r) : s - bow * (1 - Math.min(1, y / ykx) ** 1.6); return [x, y, zF(x, y)] as V; }); row.push([kx, ykx, zK(kx)]); return row; };
  const SN = [SL, 330, 440], iXJ = 3 + SN.length, iA = at(XA);
  const TFG: V[][] = [topRow(-1, 0), topRow(-1, 0.33), topRow(-1, 0.66), ...SN.map(s => topRow(s, 1)), ...SF.slice(0, iA + 1).map(s => topRow(s, 1))], NT = TFG.length;
  // the nose: rows going round from the centre line to the front arch, each a share f of every line's width; below the
  // shut line the bumper's lines (lamp strip 458-390, the centre intake 355-199, the outer ones 312-227, the lip)
  const NOSEZ = [0, 0, 0, 0, 458, 390, 355, 312, 227, 199, 130, 108], NOSEX = [0, 0, 0, 0, 8, 0, 0, 2, 13, 20, 34, 46];
  const noseK: V[] = [...TFG[0]!.slice(0, 7), ...TFG.slice(1, iXJ + 1).map(r => r[7]!)], NN = noseK.length;
  const NSG: V[][] = noseK.map((K, i) => { const f = i === NN - 1 ? 1 : K[1] / KW, t = sm(0.93, 1, f), ys = f ** lerp(1.15, 1, t), row: V[] = [K, K, K, K];
    for (let k = 4; k <= NK; k++) { const z = lerp(NOSEZ[k]! + (k === 4 ? 10 * f : 0), CJ[k]![2], t); row.push([NOSEX[k]! + (XJ - NOSEX[k]!) * gp(ys, 2.4), CJ[k]![1] * ys, z]); }
    for (let k = 1; k < 4; k++) row[k] = band(K, row[4]!, k / 4); return row; });
  // the tail's shell: the last chain carried round the corner to the centre line (the upper lines nearly square in plan, the bumper
  // rounder); rows 0-5 are the corner and the frame's side, the opening lies inboard; the same shell stood in is the lamp panel and the valance
  const TFR = [1, 0.985, 0.95, 0.88, 0.8, 0.78, 0.6, 0.45, 0.33, 0.24, 0], NR = TFR.length, tailP = (k: number) => k <= 5 ? 7 : 3.4;
  const TLG: V[][] = TFR.map(f => CT.map((c, k) => { const p = tailP(k); return [XT1 + (TAILX[k]! - XT1) * (1 - f ** p) ** (1 / p), c[1] * f, c[2]] as V; }));
  const LG: V[][] = TLG.map(r => r.map(p => [p[0] - LAMPIN, p[1], p[2]] as V)), VG: V[][] = TLG.map(r => r.map(p => [p[0] - VALIN, p[1], p[2]] as V));
  // the canopy: the roof (rows at the stations, bowed forward at the centre), the screen from the front top's last row up to it
  const SR = SF.slice(at(XR0), at(XR1) + 1), RFG: V[][] = SR.map(s => SH.map(sh => { const x = xRoof(s, sh); return [x, sh * YD, ZR(x) - CROWN * sh ** CP] as V; }));
  const VS = [0, 0.07, 0.3, 0.55, 0.8, 0.94, 1], sFoot = TFG[NT - 1]!, sTop = RFG[0]!;
  const SCR: V[][] = VS.map(v => sFoot.map((p, j) => { const q = mix(p, sTop[j]!, v), bl = 12 * 4 * v * (1 - v) * (1 - (j / (NC - 1)) ** 2); return [q[0] - bl * 0.4, q[1], q[2] + bl * 0.92] as V; }));
  // its side: the pillar's line (then the roof's edge, then the slanting edge) D, the rail T, two points down the glass, the belt E
  const A0 = sFoot[NC - 1]!, A1 = sTop[NC - 1]!, SU = SF.slice(iA, at(XQ) + 1);
  const upper = (x: number): V[] => { const E: V = [x, yK(x), zK(x)], D: V = x <= XR0 ? mix(A0, A1, (x - XA) / (XR0 - XA)) : x <= XR1 ? [x, YD, ZR(x) - CROWN] : glassEdge(x);
    const w = sm(1750, 2100, x), dE = sub(E, D), lE = Math.hypot(...dE) || 1, r = x <= XR1 ? w : 1 - sm(XR1, 2820, x), k = x <= XR1 ? Math.min(52, lE) * (1 - w) : Math.min(16, lE * 0.5);
    const T: V = [D[0] + dE[0] / lE * k, D[1] + dE[1] / lE * k + 108 * r, D[2] + dE[2] / lE * k - 42 * r];   // the pillar's band ahead of the roof, the rail beside it, a narrow edge behind
    const bl = 10 * sm(XA, 1700, x) * (1 - sm(2750, XQ, x)), out = (v: number): V => { const p = mix(T, E, v); return [p[0], p[1] + bl * 0.9 * 4 * v * (1 - v), p[2] + bl * 0.4 * 4 * v * (1 - v)]; }; return [D, T, out(1 / 3), out(2 / 3), E]; };
  const US: V[][] = SU.map(upper);
  // the rear glass: rows from the roof's back edge to its foot, each from the centre line to its edge
  const RGX = [XR1, 2750, 2820, 2890, XQ, 3040, 3108, 3200, 3300, 3400, 3460, 3495, 3512, XG], RGL: V[][] = RGX.map(x => SH.map(sh => glassPt(x, sh)));
  // the deck behind the glass: rows at the stations, the tail's shares across; the lid's last row is the lamp panel's top edge, the wings' the frame's
  const SDK = SF.slice(at(3569)), DC = TFR.slice().reverse(), DKG: V[][] = [...SDK.map(s => DC.map(t => [s, t * yK(s), zDeck(s, t * yK(s))] as V)), TLG.map((r, i) => i >= 5 ? LG[i]![3]! : r[0]!).reverse()];
  // the spoiler's blade bridging the wings over the deck's last 150 mm: its top (level with the ridges), its underside, its leading edge
  const BC = DC.slice(0, 7), BT: V[][] = [...[4150, XT1].map(s => BC.map(t => [s, t * yK(s), zK(s)] as V)), BC.map((_, j) => TLG[NR - 1 - j]![0]!)];
  const BU: V[][] = [BC.map((_, j) => TLG[NR - 1 - j]![2]!), BC.map(t => [XT1, t * yK(XT1), 878] as V), BC.map(t => [4157, t * yK(4150), 888] as V)];

  // ---- the panels: the red body ----
  const iCW = iXJ + at(FX + RAF), iC0 = 3, iC1 = iXJ + at(630), isCowl = (i: number, j: number) => j < 6 && (i > iCW || (i === iCW && j < 3)), isCover = (i: number, j: number) => i >= iC0 && i < iC1 && j >= 4 && j < 6;
  const iD0 = iA, iD1 = at(2750), iI0 = at(XR1), iI1 = at(XQ), iRA = at(RX - RAR), iFA = at(FX + RAF), hole = (i: number, k: number) => i >= iI0 && i < iI1 && k >= 4 && k < 7, isDoor = (i: number, k: number) => i >= iD0 && k < 7 && (k < 4 ? i < iD1 : i < iI0), isSill = (i: number, k: number) => k >= 7 && i >= iFA && i < iRA;
  const lampCell = (i: number, k: number) => k === 4 && i >= 4 && i < 9, mouthC = (i: number, k: number) => i < 3 && k >= 6 && k < 9, mouthO = (i: number, k: number) => i >= 4 && i < 6 && k === 7;
  b.name('hood').mat(PAINT, GLOSS, 'paint'); cells(TFG, (i, j) => j < 3 && !isCowl(i, j)); cells(NSG, (i, k) => i < 3 && k < 4);
  b.name('wingF').mat(PAINT, GLOSS, 'paint'); cells(TFG, (i, j) => j >= 3 && !isCover(i, j) && !isCowl(i, j)); cells(NSG, (i, k) => i >= 3 && k < 4); cells(CH.slice(0, iD0 + 1), (i, k) => !isSill(i, k));
  b.name('bumperF').mat(PAINT, GLOSS, 'paint'); cells(NSG, (i, k) => k >= 4 && !lampCell(i, k) && !mouthC(i, k) && !mouthO(i, k));
  b.name('cowl').mat(FRAME, 0.15); cells(TFG, (i, j) => isCowl(i, j));
  b.name('door').mat(PAINT, GLOSS, 'paint'); cells(CH, (i, k) => isDoor(i, k));
  b.name('sill').mat(PAINT, GLOSS, 'paint'); cells(CH, (i, k) => isSill(i, k));
  b.name('quarter').mat(PAINT, GLOSS, 'paint'); cells(CH, (i, k) => i >= iI0 && !isDoor(i, k) && !isSill(i, k) && !hole(i, k));
  zip([...RGL.slice(4).map(r => r[NC - 1]!), ...RGL[RGL.length - 1]!.slice(0, NC - 1).reverse()], [...SF.slice(at(XQ), at(3569)).map(s => [s, yK(s), zK(s)] as V), ...DKG[0]!.slice().reverse()], UPV);
  const iBl = at(4150) - at(3569);   // the deck's rows under the blade lie in its shade
  cells(DKG, (i, j) => j >= 6 || (j === 5 && i < iBl));
  b.name('bootLid').mat(PAINT, GLOSS, 'paint'); cells(DKG, (i, j) => j < 5 && i < iBl);
  b.name('tailSlot').mat(SHADE, 0.3, 'paint'); cells(DKG, (i, j) => j < 6 && i >= iBl);
  // the tail, volume by volume. The frame: the blade (top, trailing edge, underside, leading edge) and the wings' rear faces down to the bumper
  const wall = (A: V[], B: V[], n: V) => { for (const sg of [1, -1]) for (let i = 0; i + 1 < A.length; i++) face(b, mir(A[i]!, sg), mir(A[i + 1]!, sg), mir(B[i + 1]!, sg), mir(B[i]!, sg), mir(n, sg)); };
  const tri2 = (p: V, q: V, r: V, n: V) => { for (const sg of [1, -1]) tri(b, mir(p, sg), mir(q, sg), mir(r, sg), mir(n, sg)); };
  b.name('spoiler').mat(PAINT, GLOSS, 'paint'); cells(BT); cells([BU[2]!, BT[0]!]); cells(TLG, (i, k) => k < 2 && i >= 5);
  b.name('tailSlot').mat(SHADE, 0.3, 'paint'); cells(BU);
  b.name('quarter').mat(PAINT, GLOSS, 'paint'); cells(TLG, (i, k) => (k < 2 && i < 5) || (k === 2 && i < 5) || (k === 3 && i < 2) || (k === 4 && i < 1));
  tri2(TLG[2]![3]!, TLG[3]![3]!, TLG[2]![4]!, [1, 0, 0]); tri2(TLG[1]![4]!, TLG[2]![4]!, TLG[1]![5]!, [1, 0, 0]);
  wall([TLG[3]![3]!, TLG[2]![4]!, TLG[1]![5]!], [LG[3]![3]!, LG[2]![4]!, LG[1]![5]!], [0, -1, -1]); wall([TLG[5]![3]!, TLG[4]![3]!, TLG[3]![3]!], [LG[5]![3]!, LG[4]![3]!, LG[3]![3]!], [0, 0, -1]);   // the opening's reveal
  for (const sg of [1, -1]) fan(b, [TLG[5]![2]!, TLG[5]![3]!, LG[5]![3]!, DKG[DKG.length - 2]![5]!, BU[1]![5]!].map(p => mir(p, sg)), [0, -sg, 0]);   // the slot's end under the blade
  // the lamp panel: one smoked red lens across the opening, its outer ends cut slanting by the wings
  b.name('tailBand').mat(SMOKE, 0.85); cells(LG, (i, k) => (k === 3 && i >= 3) || (k === 4 && i >= 2)); tri2(LG[3]![3]!, LG[3]![4]!, LG[2]![4]!, [1, 0, 0]); tri2(LG[2]![4]!, LG[2]![5]!, LG[1]![5]!, [1, 0, 0]);
  // the bumper: the ledge from the lamp panel's foot out to its top edge, the face with the plate's recess, the corners; the valance let into its foot
  b.name('bumperR').mat(PAINT, GLOSS, 'paint'); cells(TLG.map((r, i) => [i >= 1 ? LG[i]![5]! : r[5]!, r[6]!])); tri2(TLG[1]![5]!, LG[1]![5]!, TLG[1]![6]!, [0, -1, 0.5]);
  cells(TLG, (i, k) => (k >= 6 && k < 9 && !(k === 7 && i >= 9)) || (k >= 9 && i < 5));
  wall(TLG.slice(5).map(r => r[9]!), VG.slice(5).map(r => r[9]!), [0, 0, -1]); wall(TLG[5]!.slice(9), VG[5]!.slice(9), [0, -1, 0]);
  b.name('valance').mat(TRIM, 0.15); cells(VG, (i, k) => k >= 9 && i >= 5 && !(k === 9 && i >= 6));
  b.name('valance').mat(DARK, 0.05, 'grille'); cells(VG, (i, k) => k === 9 && i >= 6);

  // ---- the canopy: one black glasshouse ----
  const iQ0 = at(2890) - iA, iB0 = at(XR1) - iA;   // review 154: the B pillar a broad black sail behind the door glass (about 200 mm, the photographs), the quarter glass behind it
  b.name('canopy').mat(BLACK, 0.75, 'paint'); cells(RFG); cells(SCR, (i, j) => i === 0 || i >= 5 || j >= 6); cells(US, (i, j) => j === 0 || (i >= iB0 && i < iQ0) || i === 0);
  cells(RGL, (i, j) => j >= 6 || i >= RGX.length - 3);
  b.name('screenPane').mat(GLASS, 0.5, 'glass'); cells(SCR, (i, j) => i > 0 && i < 5 && j < 6);
  b.name('sidePane').mat(GLASS, 0.5, 'glass'); cells(US, (i, j) => j > 0 && i > 0 && i < iB0);
  b.name('quarterPane').mat(GLASS, 0.5, 'glass'); cells(US, (i, j) => j > 0 && i >= iQ0);
  b.name('rearPane').mat(GLASS, 0.2, 'glass');   /* review 154: a clearer pane (glass gloss under 0.5 = less tint), so the engine shows */ cells(RGL, (i, j) => j < 6 && i < RGX.length - 3);

  // ---- the front bumper: the combination lamps, the intakes with the fog lamps ----
  b.name('sidelightF').mat(LENS, 0.7); cells(NSG, (i, k) => lampCell(i, k) && i < 6);
  b.name('indicatorF').mat(AMBER, 0.7); cells(NSG, (i, k) => lampCell(i, k) && i >= 6);
  b.name('grille'); { const r = [...NSG.slice(0, 4).map(p => p[6]!), NSG[3]![7]!, NSG[3]![8]!, ...NSG.slice(0, 4).reverse().map(p => p[9]!)], full = [...r, ...r.slice(1, -1).reverse().map(p => mir(p, -1))]; pocket(full, [120, 0, 0], [-1, 0, 0], 'grille');
    b.name('grille').mat(FRAME, 0.2); for (const y of [-190, 0, 190]) b.bar([70, y, 205], [70, y, 350], 12, 16); }
  for (const sg of [1, -1]) { b.name('grille'); pocket(border(NSG, 4, 6, 7, 8).map(p => mir(p, sg)), [90, 0, 0], [-1, 0, 0], 'grille');
    b.name('fogF').mat(LENS, 0.7); inCell(NSG, 5, 7, 0.0, 0.85, 0.1, 0.9, -45, [-1, 0, 0], sg); }
  // the under-side: the nose's floor, a flat floor between the sills, the tail's
  b.name('chassis').mat(DARK, 0.05); for (let i = 0; i + 1 < NN; i++) for (const sg of [1, -1]) tri(b, mir(NSG[i]![NK]!, sg), mir(NSG[i + 1]![NK]!, sg), [XJ, 0, 112], [0, 0, -1]);
  { const foot = [...TLG.slice(0, 6).map(r => r[NK]!), ...VG.slice(5).map(r => r[NK]!)]; for (let i = 0; i + 1 < foot.length; i++) for (const sg of [1, -1]) tri(b, mir(foot[i]!, sg), mir(foot[i + 1]!, sg), [XT1, 0, 205], [0, 0, -1]); }
  for (const [x0, x1, y, z0, z1] of [[XJ, FX + RAF, YINF, 118, 118], [FX + RAF, RX - RAR, 775, 118, 118], [RX - RAR, RX + RAR, YINR, 118, 118], [RX + RAR, XT1, 740, 122, 205]] as const) face(b, [x0, -y, z0], [x0, y, z0], [x1, y, z1], [x1, -y, z1], [0, 0, -1]);
  // the wheel wells: a dark roof from the arch's lip in to the inner wall, the wall itself, the ends
  for (const sg of [1, -1]) for (const [hx, ra, yin] of [[FX, RAF, YINF], [RX, RAR, YINR]] as const) { const i0 = at(hx - ra), i1 = at(hx + ra), inn = (i: number): V => [SF[i]!, sg * yin, CH[i]![NK]![2]];
    for (let i = i0; i < i1; i++) { face(b, mir(CH[i]![NK]!, sg), mir(CH[i + 1]![NK]!, sg), inn(i + 1), inn(i), [0, 0, -1]); tri(b, [hx, sg * yin, 118], inn(i), inn(i + 1), [0, sg, 0]); }
    for (const i of [i0, i1]) face(b, [SF[i]!, sg * yin, 118], [SF[i]!, sg * (W(SF[i]!) - 70), 118], [SF[i]!, sg * (W(SF[i]!) - 70), 330], [SF[i]!, sg * yin, 330], [i === i0 ? 1 : -1, 0, 0]); }
  b.bar([FX, -WYF, RF], [FX, WYF, RF], 50).bar([RX, -WYR, RR], [RX, WYR, RR], 60);

  // ---- the shut lines: thin dark ribbons laid on the skin ----
  { const seam = (pts: V[], nrm: (i: number) => V, w = 8) => { const e = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)]!, c = pts[Math.min(pts.length - 1, i + 1)]!, n = un(nrm(i)), sd = un(cross(n, sub(c, a))), o = add(p, [n[0] * 2.5, n[1] * 2.5, n[2] * 2.5]); return [add(o, [sd[0] * w / 2, sd[1] * w / 2, sd[2] * w / 2]), sub(o, [sd[0] * w / 2, sd[1] * w / 2, sd[2] * w / 2]), n] as [V, V, V]; });
      return (sgs: number[]) => { for (const sg of sgs) for (let i = 0; i + 1 < e.length; i++) face(b, mir(e[i]![0], sg), mir(e[i + 1]![0], sg), mir(e[i + 1]![1], sg), mir(e[i]![1], sg), mir(e[i]![2], sg)); }; };
    const both = [1, -1], side = (pts: [number, number][]) => seam(pts.map(([x, z]) => surf(x, z)), () => [0, 1, 0.25]);
    b.name('seam').mat(SEAM, 0.1);
    seam(TFG.slice(0, iCW + 1).map(r => r[3]!), () => UPV)(both);                                             // the bonnet's shut lines
    if (lamps < 0.02) { const r = border(TFG, iC0, iC1, 4, 6); seam([...r, r[0]!], () => UPV)(both); }        // the lamp covers
    side([[XA, 735], [XA + 4, 600], [XA + 6, 420], [XA + 8, 212]])(both);                                     // the door's front edge
    side([[2748, 803], [2740, 740], [2728, 680], [2712, 622]])(both); side([[2655, 350], [2600, 318], [2540, 266], [2480, 232], [2422, 210]])(both);   // its rear edge: upright to the intake, then sweeping forward under it to the sill
    seam(DKG.slice(0, at(3950) - at(3569) + 1).map(r => r[5]!), () => UPV)(both); seam(DKG[at(3950) - at(3569)]!.slice(0, 6), () => UPV)(both);   // the boot lid
    side([[2992, 652], [3080, 648], [3162, 652], [3166, 712], [3160, 772], [3075, 776], [2992, 770], [2988, 712], [2992, 652]])([-1]); }   // the fuel flap (left)

  // ---- the side intake behind the door: cut in, deepening backward to a dark grille ----
  { const dep = (x: number) => 150 * sm(XR1, 2890, x), inn = (i: number, k: number): V => { const p = CH[i]![k]!; return [p[0], p[1] - dep(p[0]), p[2] + (k === 4 ? -12 : k === 7 ? 12 : 0)]; };
    const IN: V[][] = []; for (let i = iI0; i <= iI1; i++) IN.push([CH[i]![4]!, inn(i, 4), inn(i, 5), inn(i, 6), inn(i, 7), CH[i]![7]!]);
    b.name('intake').mat(PAINT, GLOSS, 'paint'); cells(IN, (i, j) => j > 0 && j < 4 && i < 2);
    b.name('intake').mat(DARK, 0.05); cells(IN, (i, j) => j === 0 || j === 4 || i >= 2);
    // its corners rounded: a fillet of the skin left in the rear corners and the lower front one
    b.name('quarter').mat(PAINT, GLOSS, 'paint'); for (const sg of [1, -1]) for (const [i, k, di, dk] of [[iI1, 4, -1, 1], [iI1, 7, -1, -1], [iI0, 7, 1, -1]] as const) { const c = CH[i]![k]!; tri(b, mir(c, sg), mir(mix(c, CH[i + di]![k]!, 0.55), sg), mir(mix(c, CH[i]![k + dk]!, 0.55), sg), [0, sg, 0]); }
    for (const sg of [1, -1]) { const c = IN[IN.length - 1]!.map(p => mir(p, sg));
      b.name('intakeGrille').mat(DARK, 0.05, 'grille'); face(b, c[0]!, c[1]!, c[4]!, c[5]!, [-1, 0, 0]);
      b.name('intakeGrille').mat(FRAME, 0.2); const a = IN[IN.length - 2]!.map(p => mir(p, sg)); for (const u of [0.33, 0.66]) b.bar(add(mix(a[1]!, a[4]!, u), [0, sg * 10, 0]), add(mix(c[1]!, c[4]!, u), [-6, sg * 10, 0]), 14, 8); } }

  // ---- the pop-up head lamps: the cover hinges up about its back edge; under it a dark well, on its front the lamps ----
  { const ang = lamps * 23 * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang), ox = TFG[iC1]![5]![0], oz = TFG[iC1]![5]![2];
    const up = (p: V): V => { const dx = p[0] - ox, dz = p[2] - oz; return [ox + dx * ca + dz * sa, p[1], oz - dx * sa + dz * ca]; };
    const CV: V[][] = TFG.slice(iC0, iC1 + 1).map(r => r.slice(4, 7).map(up));
    b.name('lampLid').mat(PAINT, GLOSS, 'paint'); cells(CV);
    for (const sg of [1, -1]) { const m = (p: V) => mir(p, sg);
      b.name('lampWell'); pocket(border(TFG, iC0, iC1, 4, 6).map(m), [0, 0, -75], UPV);
      if (lamps > 0.02) { const f0 = m(CV[0]![0]!), f1 = m(CV[0]![2]!), g0 = m(TFG[iC0]![4]!), g1 = m(TFG[iC0]![6]!), h0 = m(TFG[iC1]![4]!), h1 = m(TFG[iC1]![6]!), fwd: V = [-1, 0, 0.2];
        b.name('lampPod').mat(PAINT, GLOSS, 'paint'); tri(b, f0, g0, h0, [0, -sg, 0]); tri(b, f1, g1, h1, [0, sg, 0]);
        b.name('lampPod').mat(FRAME, 0.2); face(b, f0, f1, g1, g0, fwd);
        const P = (u: number, v: number, lift: number): V => { const p = mix(mix(f0, f1, u), mix(g0, g1, u), v); return [p[0] - lift, p[1], p[2]]; };
        b.name('headlamp').mat(LENS, 0.7, 'lens'); for (const [u0, u1] of [[0.06, 0.48], [0.52, 0.94]] as const) face(b, P(u0, 0.12, 5), P(u1, 0.12, 5), P(u1, 0.8, 5), P(u0, 0.8, 5), fwd); } } }

  // ---- the tail's lamps in the smoked red panel: a round amber indicator at each end, the red run, a square clear reversing lamp either side of the badge's dark square ----
  { const CY = curve(([3, 4, 5] as const).map(k => [-TAILZ[k]!, CT[k]![1]] as [number, number])), TX = lin(([3, 4, 5] as const).map(k => [TAILZ[k]!, TAILX[k]!] as [number, number]));
    const lampAt = (y: number, z: number, lift: number, sg: number): V => { const f = Math.min(1, y / CY(-z)); return [XT1 + (TX(z) - XT1) * (1 - f ** 7) ** (1 / 7) - LAMPIN + lift, sg * y, z]; };
    const patch = (y0: number, y1: number, z0: number, z1: number, lift: number, sg: number) => face(b, lampAt(y0, z0, lift, sg), lampAt(y1, z0, lift, sg), lampAt(y1, z1, lift, sg), lampAt(y0, z1, lift, sg), [1, 0, 0]);
    for (const sg of [1, -1]) { const ring = (r: number, lift: number) => Array.from({ length: 14 }, (_, t) => { const a = t / 14 * Math.PI * 2; return [lampAt(662, 748 + r * Math.sin(a), lift, sg)[0], sg * (662 + r * Math.cos(a)), 748 + r * Math.sin(a)] as V; });   /* a flat disc standing just proud of the panel */
      b.name('indicatorR').mat(DARK, 0.3); fan(b, ring(56, 4), [1, 0, 0]); b.name('indicatorR').mat(AMBER, 0.75); fan(b, ring(49, 6), [1, 0, 0]);
      b.name('tailLamp').mat(RED, 0.7, 'lens'); patch(398, 598, 690, 806, 3, sg); b.name('stopLamp').mat(RED, 0.7, 'lens'); patch(194, 394, 690, 806, 3, sg);
      b.name('reverseLamp').mat(WHITE, 0.7); patch(98, 184, 700, 796, 4, sg); }
    b.name('badge').mat(DARK, 0.3); face(b, lampAt(88, 690, 3, -1), lampAt(88, 690, 3, 1), lampAt(88, 806, 3, 1), lampAt(88, 806, 3, -1), [1, 0, 0]);
    b.name('badge').mat(CHROME, 0.85, 'metal'); face(b, lampAt(34, 716, 5, -1), lampAt(34, 716, 5, 1), lampAt(34, 780, 5, 1), lampAt(34, 780, 5, -1), [1, 0, 0]); }
  // the flush door pulls under the glass's back corner, the lock beside them
  for (const sg of [1, -1]) { const P = (x: number, z: number): V => mir(add(surf(x, z), [0, 3, 1]), sg); b.name('handle').mat(FRAME, 0.3); face(b, P(2540, 726), P(2640, 730), P(2640, 704), P(2540, 700), [0, sg, 0.4]);
    b.name('handle').mat(CHROME, 0.8, 'metal'); face(b, P(2655, 726), P(2677, 727), P(2677, 707), P(2655, 706), [0, sg, 0.4]); }
  // the plate in its recess in the bumper's face; one round exhaust tip at each end of the valance
  { const r = [TLG[10]![7]!, TLG[9]![7]!, TLG[9]![8]!, TLG[10]![8]!]; b.name('bumperR'); pocket([...r, mir(r[2]!, -1), mir(r[1]!, -1)], [-26, 0, 0], [1, 0, 0]); }
  b.name('plate').mat(WHITE, 0.3).box(4383, 4390, -165, 165, 436, 538);
  b.name('exhaust').mat(CHROME, 0.8, 'metal'); for (const y of [-515, 515]) b.lathe('x', [0, y, 268], [[4270, 42], [4392, 42], [4392, 35], [4326, 35]], 10, false);
  b.name('exhaust').mat(DARK, 0.05); for (const y of [-515, 515]) fan(b, Array.from({ length: 10 }, (_, k) => [4328, y + 35 * Math.cos(k * Math.PI / 5), 268 + 35 * Math.sin(k * Math.PI / 5)] as V), [1, 0, 0]);
  for (const sg of [1, -1]) { b.name('markerR').mat(RED, 0.6); face(b, mir(add(surf(3990, 462), [0, 3, 0]), sg), mir(add(surf(4080, 462), [0, 3, 0]), sg), mir(add(surf(4080, 498), [0, 3, 0]), sg), mir(add(surf(3990, 498), [0, 3, 0]), sg), [0, sg, 0]);
    b.name('repeater').mat(AMBER, 0.7); face(b, mir(add(surf(1300, 568), [0, 3, 0]), sg), mir(add(surf(1372, 568), [0, 3, 0]), sg), mir(add(surf(1372, 598), [0, 3, 0]), sg), mir(add(surf(1300, 598), [0, 3, 0]), sg), [0, sg, 0]); }

  // ---- the cabin behind the glass: floor, door panels, dash, tunnel, wheel, two seats, the bulkhead with its small window ----
  { const FL = 160, xa = 1230, xb = 2700;
    b.name('cockpit').mat(DARK, 0.05); face(b, [xa, -740, FL], [xb, -740, FL], [xb, 740, FL], [xa, 740, FL], UPV);
    b.name('cockpit').mat(TRIM, 0.1); for (const sg of [1, -1]) { const xs = [1300, XA, 1750, 2250, xb]; for (let k = 0; k + 1 < xs.length; k++) { const p = (x: number): V => [x, yK(x) - 16, zK(x) - 6], q0 = p(xs[k]!), q1 = p(xs[k + 1]!); face(b, [q0[0], sg * q0[1], FL], [q1[0], sg * q1[1], FL], mir(q1, sg), mir(q0, sg), [0, -sg, 0]); } }
    const crest = (p: V): V => [p[0] + 210 - 60 * (p[1] / 760) ** 2, p[1] * 0.97, 800 - 40 * (p[1] / 760) ** 2];
    b.name('cockpit').mat(TRIM, 0.15); for (const sg of [1, -1]) for (let j = 0; j + 1 < NC; j++) { const p = sFoot[j]!, q = sFoot[j + 1]!, lo = (v: V): V => [v[0] + 14, v[1] * 0.985, v[2] - 12], c0 = crest(p), c1 = crest(q);
      face(b, mir(lo(p), sg), mir(lo(q), sg), mir(c1, sg), mir(c0, sg), UPV); face(b, mir(c0, sg), mir(c1, sg), [c1[0] + 70, sg * c1[1], 430], [c0[0] + 70, sg * c0[1], 430], [1, 0, 0.3]); }
    b.name('cockpit').mat(TRIM, 0.15).box(1450, xb, -110, 110, FL, 350);
    b.name('steering').mat(FRAME, 0.2).lathe('x', [0, -375, 690], [[1612, 150], [1604, 176], [1626, 176], [1620, 150]], 10, false).bar([1480, -375, 705], [1614, -375, 690], 36);
    for (const sg of [1, -1]) { const y0 = sg * 160, y1 = sg * 600;
      b.name('seat').mat(SEAT, 0.25, 'leather').box(2010, 2480, Math.min(y0, y1), Math.max(y0, y1), FL, 335).loft(([[2430, 335], [2520, 620], [2600, 870], [2650, 940]] as const).map(([x, z]) => [[x, y0 + sg * 20, FL], [x, y1 - sg * 20, FL], [x, y1 - sg * 20, z], [x, y0 + sg * 20, z]] as V[]));
      b.name('seat').mat(SEAT2, 0.1); for (const y of [y0 + sg * 150, y0 + sg * 290]) b.bar([2030, y, 337], [2430, y, 337], 8).bar([2524, y, 622], [2600, y, 868], 8); }
    // the bulkhead under the rear glass's front edge, a small upright window in it
    const xw = xb + 6, sec = [...SH.slice(0, NC - 1).map(sh => mix(glassPt(XR1, sh), glassPt(2750, sh), 0.27)), ...upper(xw)].map(p => [xw, p[1] * 0.985, p[2] - 7] as V), wy = sec[5]![1], wz0 = 860, wz1 = 1050;
    b.name('bulkhead').mat(DARK, 0.08); for (const sg of [1, -1]) { for (let j = 0; j < 5; j++) face(b, mir(sec[j]!, sg), mir(sec[j + 1]!, sg), [xw, sg * sec[j + 1]![1], wz1], [xw, sg * sec[j]![1], wz1], [1, 0, 0]);
      const out = [...sec.slice(5), [xw, sec[sec.length - 1]![1], FL] as V, [xw, wy, FL] as V]; for (let j = 0; j + 1 < out.length; j++) tri(b, [xw, sg * wy, 955], mir(out[j]!, sg), mir(out[j + 1]!, sg), [1, 0, 0]); }
    face(b, [xw, -wy, FL], [xw, wy, FL], [xw, wy, wz0], [xw, -wy, wz0], [1, 0, 0]);
    b.name('cabinPane').mat(GLASS, 0.5, 'glass'); face(b, [xw, -wy, wz0], [xw, wy, wz0], [xw, wy, wz1], [xw, -wy, wz1], [1, 0, 0]); }

  // ---- the engine bay under the rear glass: a dark tub, the transverse V6 in it ----
  { const x0 = 2708, x1 = 3545, yb = 625, zf = 200, zs = 700, zt = 872, yt = 708;
    b.name('engineBay').mat(DARK, 0.05); face(b, [x0, -yb, zf], [x1, -yb, zf], [x1, yb, zf], [x0, yb, zf], UPV); face(b, [x1, -yb, zf], [x1, yb, zf], [x1, yb, zs], [x1, -yb, zs], [-1, 0, 0]); face(b, [x1, -yb, zs], [x1, yb, zs], [x1, yt, zt], [x1, -yt, zt], [-1, 0, 0]);
    for (const sg of [1, -1]) { face(b, [x0, sg * yb, zf], [x1, sg * yb, zf], [x1, sg * yb, zs], [x0, sg * yb, zs], [0, -sg, 0]); face(b, [x0, sg * yb, zs], [x1, sg * yb, zs], [x1, sg * yt, zt], [x0, sg * yt, zt], [0, -sg, 0.5]); }
    addEngine(b, ENGINES.nsx!, [3150, -260, 400], { dir: 'y', box: { len: 620, wid: 680, hgt: 620 }, detail: 2 }); }

  // ---- the fittings ----
  // the door mirrors: a body-coloured head on a short stalk from the door's top front corner
  for (const sg of [1, -1]) { const hs = (y: number, k: number, dx = 0): V[] => ([[1668, 742], [1712, 702], [1806, 694], [1822, 776], [1816, 852], [1736, 866]] as const).map(([x, z]) => [1790 + (x - 1790) * k + dx, y, 780 + (z - 780) * k] as V);
    b.name('mirror').mat(PAINT, GLOSS, 'paint').loft([hs(sg * 808, 0.6, -30), hs(sg * 850, 0.96, -8), hs(sg * 965, 1), hs(sg * 988, 0.8)]).bar([1668, sg * 762, 738], [1730, sg * 815, 752], 56, 26);
    b.name('mirrorGlass').mat(SILVER, 0.9, 'metal'); face(b, [1823, sg * 852, 712], [1823, sg * 972, 712], [1827, sg * 972, 842], [1827, sg * 852, 842], [1, 0, 0]); }
  // the two wipers parked along the screen's foot
  { const onScr = (y: number, lift: number): V => { const a = Math.abs(y), row = SCR[1]!; let j = 0; while (j + 2 < NC && row[j + 1]![1] < a) j++; const p = mix(row[j]!, row[j + 1]!, (a - row[j]![1]) / (row[j + 1]![1] - row[j]![1])); return [p[0] - lift * 0.4, y, p[2] + lift * 0.92]; };
    b.name('wiper').mat(FRAME, 0.15); for (const [ya, yb2] of [[-640, -120], [-30, 500]] as const) { const m = (ya + yb2) / 2; b.bar(onScr(ya, 12), onScr(m, 14), 14, 10).bar(onScr(m, 14), onScr(yb2, 12), 14, 10); } }
  // the badge on the bonnet's nose
  b.name('badge').mat(CHROME, 0.8, 'metal'); { const p = (x: number, y: number): V => [x, y, zF(x, Math.abs(y)) + 3]; face(b, p(78, -34), p(78, 34), p(128, 34), p(128, -34), UPV); }

  for (const s of [1, -1] as const) { wheel(b, FX, s, spin); wheel(b, RX, s, spin); }
  return b.mesh(L); }
export const mesh = nsxMesh;
