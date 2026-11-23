// The 1990 Lamborghini Diablo (the first, rear-drive car: pop-up head lamps, no rear wing) as a low-polygon mesh
// (docs/systems/70_mesh_car_rules.md, "Wedge cars: flat faces and narrow fillets"), built panel by panel after
// docs/systems/81_diablo_panel_plan.md from the sheet data/cars/spec/diablo.json.
//
// A wedge is flat faces meeting at edges, so every surface here is straight runs between a few lines along the car, and
// a bend is either sharp (over 40 degrees: the renderer keeps it crisp) or a narrow fillet with a guard row either side
// (so the smoothing stays inside the fillet and the flat faces shade evenly). Each panel is its own part; neighbours
// share their border points exactly (or meet along a straight edge), so nothing gaps.
//   nose        a thin wedge tip at z 340, square in plan with round corners (a super-ellipse); the bumper under it
//               (lamp strips, three cut intakes, the chin), the lid and the two pop-up lamp covers on top
//   front top   one near-flat face from the tip to the screen: 28 degrees over the lamps, 12 behind them
//   cabin       the screen's foot ahead of the front axle, the pillars leaning in 45 degrees, hollow with an interior
//   flank       the top edge K (the wing's crest, then the door's top, which dips at the side glass's front and climbs
//               to the rear shoulder), a rounded shoulder down to the crease Q on the widest line, a near-vertical
//               face, the sill; the scoop pressed into the door's foot runs to the slanted intake ahead of the rear
//               wheel; the rear arch is a cut polygon (raked front leg, flat top)
//   rear        the buttress ridges from the roof to the tail, the engine cover in the trough between them, the
//               shallow slope outboard of each ridge (quarter glass, the upper intake), the cut-off tail with its
//               black lamp band, the bumper standing proud, the dark valance with four pipes
// Axes: x from the nose back, y across, z up; mm. Axles at 1000 and 3650.
// `lamps` 0..1 raises the head lamp pods; `wing` 1 adds the optional rear wing.
import { Build, type Mesh, type V } from './mesh';

const PAINT = '#b0141c', GLOSS = 0.6, FRAME = '#14151a', DARK = '#131318', TRIM = '#25272d', GLASS = '#a9c2cc', SILVER = '#c4c7cc', CHROME = '#d4d6d9', RUBBER = '#26242b';
const LENS = '#eef0f2', RED = '#c9221f', AMBER = '#e8901c', SEAT = '#8a6b47', SEAT2 = '#5e4a32', SEAM = '#3a080c', WHITE = '#e6e4dc';
const L = 4460, FX = 1000, RX = 3650, RF = 314, RR = 333, WYF = 770, WYR = 820, TWF = 245, TWR = 335;   // the axles, the tyres' radii, half the tracks, the tyres' widths
const XJ = 640, ZS = 110, ZTIP = 340, WJ = 900, YINF = 600, YINR = 610;                                    // the nose's last row (the front arch's leading edge), the sill, the nose's tip line, half the width there, the wells' inner walls
const XA = 1150, XR0 = 1790, XR1 = 2690, S1 = 4330;                                                        // the screen's corner, the roof's front corner and its back edge, the deck's back edge
type Tri = [V, V, V];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], un = (a: V): V => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t, mix = (a: V, b: V, t: number): V => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mir = (p: V, sg: number): V => [p[0], p[1] * sg, p[2]];
/** straight runs through a table of [x, value] */
function lin(tab: [number, number][]): (x: number) => number { return x => { if (x <= tab[0]![0]) return tab[0]![1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i]![0]) { const [x0, v0] = tab[i - 1]!, [x1, v1] = tab[i]!; return v0 + (v1 - v0) * (x - x0) / (x1 - x0); } return tab[tab.length - 1]![1]; }; }
/** a smooth curve through a table of [x, value]: a monotone cubic (it never overshoots a point) */
function curve(tab: [number, number][]): (x: number) => number { const n = tab.length, h: number[] = [], d: number[] = [], m: number[] = [];
  for (let i = 0; i + 1 < n; i++) { h[i] = tab[i + 1]![0] - tab[i]![0]; d[i] = (tab[i + 1]![1] - tab[i]![1]) / h[i]!; }
  for (let i = 0; i < n; i++) { if (i === 0 || i === n - 1) { m[i] = d[i === 0 ? 0 : n - 2]!; continue; } const a = d[i - 1]!, c = d[i]!; if (a * c <= 0) { m[i] = 0; continue; } const w1 = 2 * h[i]! + h[i - 1]!, w2 = h[i]! + 2 * h[i - 1]!; m[i] = (w1 + w2) / (w1 / a + w2 / c); }
  return x => { if (x <= tab[0]![0]) return tab[0]![1]; if (x >= tab[n - 1]![0]) return tab[n - 1]![1]; let i = 0; while (x > tab[i + 1]![0]) i++; const t = (x - tab[i]![0]) / h[i]!, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * tab[i]![1] + (t3 - 2 * t2 + t) * h[i]! * m[i]! + (3 * t2 - 2 * t3) * tab[i + 1]![1] + (t3 - t2) * h[i]! * m[i + 1]!; }; }

// ---- the lines along the car ----
/** the front's top face: two straight runs (28 degrees over the lamps, 12 behind them), falling a little toward the sides */
const ZF = lin([[50, 385], [520, 632], [XA, 768]]), zTopF = (x: number, y: number) => ZF(x) - 28 * (y / 900) ** 2;
/** the nose in plan: every line round it is a super-ellipse from its foremost point to the front arch (x XJ) */
const NP = 5, g = (f: number) => 1 - (1 - Math.min(1, f) ** NP) ** (1 / NP), ginv = (v: number) => (1 - (1 - Math.max(0, Math.min(1, v))) ** NP) ** (1 / NP);
const KX0 = 50, KW = WJ - 50, crestX = (y: number) => KX0 + (XJ - KX0) * g(y / KW);
const YC = [0, 170, 330, 430, 450, 600, 720, 770], NC = YC.length, YP = YC[NC - 1]!, S0 = crestX(YP), SL = 215, SC = 450;   // the top's columns (lid edge 430, lamp cover 450-770, the pillar's foot 770); the cover's front and back rows
/** half the width at the widest line (the plan) */
const W = curve([[XJ, WJ], [1000, 915], [1400, 922], [2000, 945], [2500, 970], [3000, 1000], [3400, 1018], [RX, 1020], [3900, 1012], [4100, 992], [4250, 965], [4300, 948], [S1, 925]]);
/** K: the flank's top edge (the wing's crest, the door's top, the rear shoulder): 50 in from the widest line */
const yK = (x: number) => x <= XJ ? KW * ginv((x - KX0) / (XJ - KX0)) : W(x) - 50;
const ZK1 = lin([[XA, zTopF(XA, W(XA) - 50)], [1240, 715], [1400, 635]]), ZK2 = curve([[1400, 635], [1560, 678], [1750, 730], [1900, 758], [2100, 775], [2300, 786], [2500, 800], [2700, 830], [3000, 862], [3550, 890], [4000, 895], [S1, 888]]);
const zK = (x: number) => x <= XA ? zTopF(x, yK(x)) : x <= 1400 ? ZK1(x) : ZK2(x);
/** Q: the crease on the widest line, this far below K */
const dQ = (x: number) => 38 + 47 * sm(XA, 1400, x);
/** G: the side glass's foot, then the foot of the slope outboard of the buttress: inboard of K and a little above it */
const gW = lin([[XA, W(XA) - 50 - YP], [1240, 80], [1400, 55], [2500, 55], [3000, 45], [S1, 45]]), DG0 = zTopF(XA, YP) - zTopF(XA, W(XA) - 50);
const ptG = (x: number): V => [x, yK(x) - gW(x), zK(x) + lerp(DG0, 14, sm(XA, 1240, x))];
/** the roof: its centre line, a slight crown, its front edge bowed forward at the centre */
const ZR = curve([[1720, 1068], [1850, 1086], [2000, 1096], [2200, 1103], [2450, 1105], [2600, 1101], [XR1, 1094]]), YD = 490, zRoof = (x: number, y: number) => ZR(x) - 12 * (y / YD) ** 2;
const xRoof = (s: number, y: number) => s - 70 * (1 - (y / YD) ** 2) * (1 - (s - XR0) / (XR1 - XR0));
/** the buttress ridge (from the roof's edge to the tail), its outer edge in plan, and the engine cover between the ridges */
const ZB = curve([[XR1, zRoof(XR1, YD)], [3000, 1060], [3500, 1018], [4000, 962], [S1, 905]]), YRO = curve([[XR1, YD], [3000, 505], [3400, 560], [4000, 700], [S1, 790]]), YRI = 458, YCV = 450, XCV = 2725;
const ZCV = curve([[XCV, 955], [3300, 940], [4000, 915], [S1, 897]]);
/** the screen's pillar: a straight line from the bonnet's corner to the roof's */
const A0: V = [XA, YP, zTopF(XA, YP)], A1: V = [XR0, YD, zRoof(XR0, YD)], pillar = (x: number): V => mix(A0, A1, (x - XA) / (XR0 - XA));
/** E: the roof's edge (the pillar ahead of it, the ridge's outer edge behind); T: the rail a step below and outboard of it */
const ptE = (x: number): V => x <= XR0 ? pillar(x) : x <= XR1 ? [x, YD, zRoof(x, YD)] : [x, YRO(x), ZB(x)];
const ptT = (x: number): V => { if (x <= XR0) return pillar(x); const e = ptE(x), k = lerp(1, 0.25, sm(XR1, S1, x)); return [x, e[1] + 25 * k, e[2] - 28 * k]; };
/** the wheel arches: the front a half round, the rear a cut polygon (a raked front leg, a flat top, a steep back) */
const ARCHR = lin([[3262, ZS], [3285, 300], [3330, 480], [3400, 620], [3450, 680], [3500, 706], [3800, 712], [3870, 690], [3950, 620], [4010, 480], [4035, 300], [4045, ZS]]), RAF = 350;
const archZ = (x: number) => Math.abs(x - FX) < RAF ? RF + 0.99 * Math.sqrt(RAF * RAF - (x - FX) ** 2) : x > 3262 && x < 4045 ? ARCHR(x) : 0;

// ---- the stations ----
const SN = [S0, 185, SL, 255, 300, 350, 400, SC, 505, 520, 535, 580, XJ];                                  // the nose's rows behind its front edge (the bend at 520 between guard rows)
const SF = [XJ, ...[1, 2, 3, 4, 5, 6].map(k => Math.round(FX - RAF * Math.cos(k * 18 * Math.PI / 180))), XA, 1206, 1240, 1283, 1333, 1350, 1400, 1470, 1560, XR0, 1900, 2100, 2300, 2450, 2520, 2560, XR1, 2800, 2990, 3120,
  3262, 3285, 3330, 3400, 3450, 3500, RX, 3800, 3870, 3950, 4010, 4035, 4045, 4150, 4250, 4300, S1], NS = SF.length;
const at = (x: number) => { const i = SF.indexOf(x); if (i < 0) throw new Error(`diablo: no station at ${x}`); return i; };
const NK = 7;                                                                                              // the flank's chain: K, M, Q, Qg (guard), A 430, D 310 (the door's foot), B 205, S (the sill)
/** the shoulder between K and Q: one point bulged outward, so the three bends each stay under 40 degrees */
const shoulder = (K: V, Q: V): V => [lerp(K[0], Q[0], 0.62), lerp(K[1], Q[1], 0.62), lerp(K[2], Q[2], 0.3)];
function chain(x: number): V[] { const w = W(x), zk = zK(x), K: V = [x, w - 50, zk], Q: V = [x, w, zk - dQ(x)], t = sm(1350, 1600, x);
  const c: V[] = [K, shoulder(K, Q), Q, [x, w, Q[2] - 14], [x, w - 3 * t, 430], [x, w - 12 * t, 310], [x, w - 28 * t, 205], [x, w - 60 * t, ZS]], az = archZ(x);
  if (az > ZS) for (let k = 1; k <= NK; k++) if (c[k]![2] < az) { const lip = mix(c[k - 1]!, c[k]!, (c[k - 1]![2] - az) / (c[k - 1]![2] - c[k]![2])); for (let q = k; q <= NK; q++) c[q] = lip; break; }
  return c; }

/** a flat disc across the axle at o */
function disc(b: Build, o: V, r: number, seg: number, a0 = 0) { for (let i = 0; i < seg; i++) { const a = a0 + i / seg * Math.PI * 2, c = a0 + (i + 1) / seg * Math.PI * 2; b.tri(o, [o[0] + Math.cos(a) * r, o[1], o[2] + Math.sin(a) * r], [o[0] + Math.cos(c) * r, o[1], o[2] + Math.sin(c) * r]); } }
/** a four-sided face wound so that it looks along n */
function face(b: Build, p: V, q: V, r: V, t: V, n: V) { if (dot(cross(sub(q, p), sub(t, p)), n) + dot(cross(sub(r, q), sub(p, q)), n) >= 0) b.quad(p, q, r, t); else b.quad(p, t, r, q); }
/** a triangle wound so that it looks along n */
function tri(b: Build, p: V, q: V, r: V, n: V) { if (dot(cross(sub(q, p), sub(r, p)), n) >= 0) b.tri(p, q, r); else b.tri(p, r, q); }
/** a flat many-sided face as a fan about its middle, looking along n */
function fan(b: Build, pts: V[], n: V) { const c: V = [0, 0, 0]; for (const p of pts) { c[0] += p[0] / pts.length; c[1] += p[1] / pts.length; c[2] += p[2] / pts.length; } for (let i = 0; i < pts.length; i++) tri(b, c, pts[i]!, pts[(i + 1) % pts.length]!, n); }
/** a box with its near face a quad (p, q, r, t going round) and its depth along d: the four walls and the far face */
function tube(b: Build, ring: V[], d: V, walls = true) { const c: V = [0, 0, 0]; for (const p of ring) { c[0] += p[0] / ring.length; c[1] += p[1] / ring.length; c[2] += p[2] / ring.length; }
  if (walls) for (let i = 0; i < ring.length; i++) { const p = ring[i]!, q = ring[(i + 1) % ring.length]!; if (Math.hypot(...sub(q, p)) < 0.5) continue; face(b, p, q, add(q, d), add(p, d), sub(c, mix(p, q, 0.5))); } }

/** an OZ-style five-hole light-alloy wheel: a bright lip, a dished face of five broad spokes over a dark well, a centre cap */
function wheel(b: Build, x: number, s: 1 | -1, spin = 0) { const front = x === FX, R = front ? RF : RR, wy = front ? WYF : WYR, tw = front ? TWF : TWR, o: V = [x, s * wy, R], rim = 222, h = tw / 2, f = s * h, SEG = 24;
  b.name(front ? 'tyreF' : 'tyreR').mat(RUBBER, 0.05, 'tyre').lathe('y', o, [[-h, rim], [-h, R - 30], [-h + 14, R - 9], [-h + 34, R], [h - 34, R], [h - 14, R - 9], [h, R - 30], [h, rim]], SEG, false);
  b.name('rim').mat(SILVER, 0.8, 'metal').lathe('y', o, [[f, rim + 3], [f - s * 6, rim - 6], [f - s * 30, rim - 16], [f - s * (front ? 70 : 150), rim - 20]], SEG, false);
  b.name('wheel').mat(DARK, 0.05); disc(b, [x, s * wy + f - s * (front ? 68 : 148), R], rim - 18, 12);
  // the face: five spokes, each a slab widening to the rim, dished in toward the hub
  const yo = s * wy + f - s * 30, yi = s * wy + f - s * (front ? 40 : 66), P = (r: number, a: number, y: number): V => [x + Math.cos(a) * r, y, R + Math.sin(a) * r], out: V = [0, s, 0];
  b.name('wheel').mat(SILVER, 0.55, 'metal');
  for (let k = 0; k < 5; k++) { const a = spin + (k / 5 + 0.25) * Math.PI * 2, r0 = 58, r1 = rim - 16, w0 = 0.52, w1 = 0.2, m = 0.5 * (r0 + r1), wm = 0.24, ym = lerp(yi, yo, 0.6);
    const A = [P(r0, a - w0, yi), P(m, a - wm, ym), P(r1, a - w1, yo)], B = [P(r0, a + w0, yi), P(m, a + wm, ym), P(r1, a + w1, yo)], back = (p: V): V => [p[0], p[1] - s * 26, p[2]];
    for (let q = 0; q < 2; q++) { face(b, A[q]!, A[q + 1]!, B[q + 1]!, B[q]!, out); face(b, A[q]!, A[q + 1]!, back(A[q + 1]!), back(A[q]!), sub(A[q]!, B[q]!)); face(b, B[q]!, B[q + 1]!, back(B[q + 1]!), back(B[q]!), sub(B[q]!, A[q]!)); } }
  b.lathe('y', o, [[yi - s * wy - s * 4, 74], [yi - s * wy + s * 2, 66], [yi - s * wy + s * 4, 0]], 10, false);
  b.name('hub').mat(FRAME, 0.3); disc(b, [x, yi + s * 5, R], 30, 8);
  b.name('hub').mat(CHROME, 0.8, 'metal'); for (let k = 0; k < 5; k++) { const a = spin + (k / 5 + 0.05) * Math.PI * 2; disc(b, [x + Math.cos(a) * 50, yi + s * 3, R + Math.sin(a) * 50], 8, 5); }
}

export function diabloMesh(spin = 0, lamps = 0, wing = 0): Mesh { const b = new Build(); lamps = Math.max(0, Math.min(1, lamps));
  /** the cells of a grid of points (given for the car's right half) laid on both sides, wound outward (rows going back,
   *  columns going out and down); each cell cut along the diagonal that folds it less; `pick` chooses the cells */
  const cells = (P: V[][], pick: (i: number, j: number) => boolean = () => true) => { for (let i = 0; i + 1 < P.length; i++) for (let j = 0; j + 1 < Math.min(P[i]!.length, P[i + 1]!.length); j++) { if (!pick(i, j)) continue;
    const q = [P[i]![j]!, P[i + 1]![j]!, P[i + 1]![j + 1]!, P[i]![j + 1]!] as [V, V, V, V], nn = (p: V, r: V, s: V) => un(cross(sub(r, p), sub(s, p))), alt = dot(nn(q[0], q[1], q[2]), nn(q[0], q[2], q[3])) < dot(nn(q[1], q[2], q[3]), nn(q[1], q[3], q[0])) - 1e-9;
    const ts: Tri[] = alt ? [[q[1], q[2], q[3]], [q[1], q[3], q[0]]] : [[q[0], q[1], q[2]], [q[0], q[2], q[3]]];
    for (const t of ts) { const c = cross(sub(t[1], t[0]), sub(t[2], t[0])); if (Math.hypot(c[0], c[1], c[2]) < 0.5) continue; b.tri(t[0], t[1], t[2]); b.tri(mir(t[0], -1), mir(t[2], -1), mir(t[1], -1)); } } };
  /** the border of a block of cells, going round */
  const border = (P: V[][], i0: number, i1: number, j0: number, j1: number): V[] => { const r: V[] = []; for (let j = j0; j <= j1; j++) r.push(P[i0]![j]!); for (let i = i0 + 1; i <= i1; i++) r.push(P[i]![j1]!); for (let j = j1 - 1; j >= j0; j--) r.push(P[i1]![j]!); for (let i = i1 - 1; i > i0; i--) r.push(P[i]![j0]!); return r; };
  /** a pocket sunk from a ring by d: dark walls, and a back of the kind given */
  const pocket = (ring: V[], d: V, n: V, back: 'plain' | 'grille' = 'plain') => { b.mat(DARK, 0.05); tube(b, ring, d); b.mat(DARK, 0.05, back); fan(b, ring.map(p => add(p, d)), n); };

  // ---- the points ----
  // the front's top: rows from the nose's front edge back to the screen's foot; ten columns (YC, a guard, the crest K)
  const xTop = (s: number, y: number) => { const yy = Math.min(y, YP); return s <= SL ? s + (crestX(yy) - S0) * (SL - s) / (SL - S0) : s <= XJ ? s : s - 250 * (1 - (yy / YP) ** 2.2) * ((s - XJ) / (XA - XJ)) ** 1.3; };
  const STOP = [...SN, ...SF.slice(1, at(XA) + 1)], NT = STOP.length;
  const TF: V[][] = STOP.map(s => { const yk = Math.max(YP, yK(s)), ys = [...YC, Math.max(YP, yk - 15), yk]; return ys.map(y => { const x = xTop(s, y); return [x, y, zTopF(x, y)] as V; }); });
  // the nose: rows going round from the centre line to the front arch, each a share f of every line's width
  const NF = [...YC.map(y => y / KW), ...SN.slice(1).map(s => yK(s) / KW)], NN = NF.length;
  const crestOf = (i: number): V => i < NC ? TF[0]![i]! : TF[i - NC + 1]![NC + 1]!, ring = (xf: number, f: number): [number, number] => [xf + (XJ - xf) * g(f), WJ * f];
  /** the nose's upper rows: K, the shoulder, Q, its guard, the tip line */
  const NU: V[][] = NF.map((f, i) => { const K = crestOf(i), drop = Math.min(38, 0.6 * (K[2] - ZTIP)), [qx, qy] = ring(6, f), Q: V = [qx, qy, K[2] - drop], [tx, ty] = ring(0, f), T: V = [tx, ty, ZTIP]; return [K, shoulder(K, Q), Q, mix(Q, T, Math.min(0.5, 14 / (Q[2] - ZTIP))), T]; });
  /** the bumper under the tip line: [height, how far back the line starts]; lamp strip 300-262, intakes 250-160, the chin */
  const BUMP: [number, number][] = [[ZTIP, 0], [300, 6], [262, 12], [250, 14], [160, 30], [135, 36], [105, 30], [105, 130]];
  const NBP: V[][] = NF.map(f => BUMP.map(([z, xf]) => { const [x, y] = ring(xf, f); return [x, y, z] as V; }));
  // the flank
  const CH = SF.map(chain);
  // the ledge between G and K (from the screen's corner back), with a guard beside K
  const LG: V[][] = SF.slice(at(XA)).map((x, k) => { if (!k) return TF[NT - 1]!.slice(NC - 1); const G = ptG(x), K = CH[at(XA) + k]![0]!; return [G, mix(G, K, 1 - 15 / (K[1] - G[1])), K]; });
  // the upper side: E, the rail T, two points down the glass (or the slope), G
  const upper = (x: number): V[] => { const E = ptE(x), T = ptT(x), G = ptG(x), bl = 12 * (1 - sm(2520, XR1, x)) * sm(XA, 1400, x), out = (u: number): V => { const p = mix(T, G, u); return [p[0], p[1] + bl * 0.7, p[2] + bl * 0.7]; }; const qg = x >= 2520 && x <= 2990; return [E, T, out(qg ? lerp(0.05, 0.9, ((x - 2520) / 470) ** 1.1) : 1 / 3), out(qg ? 0.92 : 2 / 3), G]; };
  const US: V[][] = SF.slice(at(XA)).map(upper);
  // the roof: eight columns matching the screen's, rows at the stations
  const yRf = YC.map(y => y * YD / YP), SR = SF.slice(at(XR0), at(XR1) + 1), RFG: V[][] = SR.map(s => yRf.map(y => { const x = xRoof(s, y); return [x, y, zRoof(x, y)] as V; }));
  // the screen: from the front top's last row to the roof's first, bulging a little; its last column is the pillar
  const VS = [0, 0.07, 0.3, 0.55, 0.8, 0.95, 1], sFoot = TF[NT - 1]!.slice(0, NC), sTop = RFG[0]!;
  const SCR: V[][] = VS.map(v => sFoot.map((p, j) => { const q = mix(p, sTop[j]!, v), bl = 26 * 4 * v * (1 - v) * (1 - (j / (NC - 1)) ** 2); return [q[0] - bl * 0.4, q[1], q[2] + bl * 0.92] as V; }));
  // the deck behind the roof: the engine cover (three points), the ridge (two)
  const SD = SF.slice(at(XR1)), RD: V[][] = SD.map((x, k) => { const xc = k ? x : XCV, zc = ZCV(xc); return [[xc, 0, zc], [xc, 235, zc], [xc, YCV, zc], [x, YRI, ZB(x) + 1.5 * (1 - sm(XR1, 3400, x))], ptE(x)]; });

  // ---- the panels ----
  const iA = at(XA), iDF = at(1470), iDR = at(2560), iR = at(XR1), iH0 = at(2300), iH1 = at(2800), iAR = at(3262), iCW = STOP.indexOf(1108);
  const hole = (i: number, j: number) => i >= iH0 && i < iH1 && (j === 4 || j === 5);
  const isCover = (i: number, j: number) => i >= STOP.indexOf(SL) && i < STOP.indexOf(SC) && j >= 4 && j < 7;
  b.name('bumperF').mat(PAINT, GLOSS, 'paint'); cells(TF.slice(0, 2), (_, j) => j < NC - 1); cells(NU.slice(0, NC)); cells(NBP, (i, j) => !(j === 3 && (i < 2 || (i >= 4 && i < 6))) && !(j === 1 && i >= 4 && i < 10));
  b.name('wingF').mat(PAINT, GLOSS, 'paint'); cells(NU.slice(NC - 1)); cells(TF, (i, j) => (i >= 1 || j >= NC - 1) && (j >= 3 || i >= iCW) && !(i >= iCW && j < NC - 1) && !(i < 1 && j < NC - 1) && !isCover(i, j));
  cells(CH.slice(0, iDF + 1)); cells(LG.slice(0, iDF - iA + 1));
  b.name('hood').mat(PAINT, GLOSS, 'paint'); cells(TF, (i, j) => i >= 1 && i < iCW && j < 3);
  b.name('cowl').mat(FRAME, 0.15); cells(TF, (i, j) => i >= iCW && j < NC - 1);
  b.name('door').mat(PAINT, GLOSS, 'paint'); cells(CH.slice(iDF, iDR + 1), (i, j) => j < 5 && !hole(i + iDF, j)); cells(LG.slice(iDF - iA, iDR - iA + 1));
  b.name('sill').mat(PAINT, GLOSS, 'paint'); cells(CH.slice(iDF, iAR + 1), (i, j) => j >= 5 && !hole(i + iDF, j));
  b.name('quarter').mat(PAINT, GLOSS, 'paint'); cells(CH.slice(iDR), (i, j) => (j < 5 || i + iDR >= iAR) && !hole(i + iDR, j)); cells(LG.slice(iDR - iA));
  b.name('lampF').mat(LENS, 0.7); cells(NBP, (i, j) => j === 1 && i >= 4 && i < 7);
  b.name('indicatorF').mat(AMBER, 0.7); cells(NBP, (i, j) => j === 1 && i >= 7 && i < 10);
  b.name('roof').mat(PAINT, GLOSS, 'paint'); cells(RFG); cells(US, (i, j) => i + iA >= at(XR0) && i + iA < iR && j === 0); cells(US, (i, j) => i + iA >= at(2450) && i + iA < at(2520) && j > 0);
  b.name('screenPane').mat(GLASS, 0.5, 'glass'); cells(SCR, (i, j) => i >= 1 && i < 5 && j < NC - 2);
  b.name('screenFrame').mat(FRAME, 0.2); cells(SCR, (i, j) => !(i >= 1 && i < 5 && j < NC - 2)); cells(US, (i, j) => i + iA < at(1240) && j > 0);
  b.name('sidePane').mat(GLASS, 0.5, 'glass'); cells(US, (i, j) => i + iA >= at(1240) && i + iA < at(2450) && j > 0);
  // the upper intake behind the quarter glass: cut out of the slope
  const iU0 = at(3120) - iA, iU1 = at(3450) - iA, iQ0 = at(2520) - iA, iQ1 = at(2990) - iA, isQG = (i: number, j: number) => i >= iQ0 && i < iQ1 && j === 2, isUp = (i: number, j: number) => i >= iU0 && i < iU1 && (j === 1 || j === 2);
  b.name('buttress').mat(PAINT, GLOSS, 'paint'); cells(US, (i, j) => i + iA >= at(2520) && (j > 0 || i + iA >= iR) && !isUp(i, j) && !isQG(i, j));
  // the quarter glass on the slope behind the door glass, tapering to a point; a dark plate behind it
  b.name('quarterPane').mat(GLASS, 0.5, 'glass'); cells(US, isQG);
  b.name('quarterPane').mat(DARK, 0.05); cells(US.map(r => r.map(p => [p[0], p[1] - 30, p[2] - 40] as V)), isQG);
  b.name('buttress').mat(PAINT, GLOSS, 'paint'); cells(RD, (_, j) => j >= 2);
  b.name('engineCover').mat(PAINT, GLOSS, 'paint'); cells(RD, (i, j) => j < 2 && i + iR < at(4150)); b.name('deck').mat(PAINT, GLOSS, 'paint'); cells(RD, (i, j) => j < 2 && i + iR >= at(4150));
  b.name('grille'); for (const sg of [1, -1]) { const r = border(US, iU0, iU1, 1, 3).map(p => mir(p, sg)); pocket(r, [0, -sg * 45, -75], [0, sg * 0.5, 0.86]);
    b.name('grille').mat(FRAME, 0.2); for (const u of [0.3, 0.55, 0.8]) { const p = mix(US[iU0]![1]!, US[iU1]![1]!, u), q = mix(US[iU0]![3]!, US[iU1]![3]!, u), dn: V = [0, -sg * 14, -24]; b.bar(add(mir(p, sg), dn), add(mir(q, sg), dn), 16, 8); } }

  // ---- the front bumper's cuts: the centre intake, a brake duct each side ----
  b.name('grille'); { const r = border(NBP, 0, 2, 3, 4), full = [...r.slice(0, -1), ...r.slice(1, -1).reverse().map(p => mir(p, -1))]; pocket([...border(NBP, 0, 2, 3, 4).slice(1, 6), ...border(NBP, 0, 2, 3, 4).slice(1, 6).reverse().map(p => mir(p, -1))], [110, 0, 0], [-1, 0, 0], 'grille'); void full; }
  for (const sg of [1, -1]) pocket(border(NBP, 4, 6, 3, 4).map(p => mir(p, sg)), [110, 0, 0], [-1, 0, 0], 'grille');
  // the under-side: the nose's floor, then a flat floor between the sills
  b.name('chassis').mat(DARK, 0.05); for (let i = 0; i + 1 < NN; i++) for (const sg of [1, -1]) tri(b, mir(NBP[i]![7]!, sg), mir(NBP[i + 1]![7]!, sg), [XJ, 0, 105], [0, 0, -1]);
  for (let i = 0; i + 1 < NS; i++) { const pt = (r: number): V => archZ(SF[r]!) > ZS ? [SF[r]!, SF[r]! < 2400 ? YINF : YINR, ZS] : CH[r]![NK]!, p = pt(i), q = pt(i + 1);
    for (const sg of [1, -1]) face(b, mir(p, sg), mir(q, sg), [q[0], 0, ZS], [p[0], 0, ZS], [0, 0, -1]); }
  // the wheel wells: a dark roof from the arch's lip in to the inner wall, the wall itself, the ends
  for (const sg of [1, -1]) for (const [hx, R, x0, x1, yin] of [[FX, RF, XJ, 1400, YINF], [RX, RR, 3262, 4045, YINR]] as const) { const i0 = at(x0), i1 = at(x1), inn = (i: number): V => [SF[i]!, sg * yin, CH[i]![NK]![2]];
    for (let i = i0; i < i1; i++) { face(b, mir(CH[i]![NK]!, sg), mir(CH[i + 1]![NK]!, sg), inn(i + 1), inn(i), [0, 0, -1]); tri(b, [hx, sg * yin, R], inn(i), inn(i + 1), [0, sg, 0]); }
    for (const i of [i0, i1]) face(b, [SF[i]!, sg * yin, ZS], [SF[i]!, sg * (W(SF[i]!) - 60), ZS], [SF[i]!, sg * (W(SF[i]!) - 60), 300], [SF[i]!, sg * yin, 300], [i === i0 ? 1 : -1, 0, 0]); }
  b.bar([FX, -WYF, RF], [FX, WYF, RF], 50).bar([RX, -WYR, RR], [RX, WYR, RR], 70);

  // ---- the shut lines: thin dark ribbons laid on the skin (the lid, the lamp covers, the bumper's top line, the doors, the engine cover) ----
  { const UPV: V = [0, 0, 1], seam = (pts: V[], nrm: (i: number) => V, w = 9) => { const e = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)]!, c = pts[Math.min(pts.length - 1, i + 1)]!, n = un(nrm(i)), sd = un(cross(n, sub(c, a))), o = add(p, [n[0] * 2.5, n[1] * 2.5, n[2] * 2.5]); return [add(o, [sd[0] * w / 2, sd[1] * w / 2, sd[2] * w / 2]), sub(o, [sd[0] * w / 2, sd[1] * w / 2, sd[2] * w / 2]), n] as [V, V, V]; });
      for (const sg of [1, -1]) for (let i = 0; i + 1 < e.length; i++) face(b, mir(e[i]![0], sg), mir(e[i + 1]![0], sg), mir(e[i + 1]![1], sg), mir(e[i]![1], sg), mir(e[i]![2], sg)); };
    const CN: V[] = [[0, 0.5, 0.86], [0, 0.8, 0.6], [0, 1, 0.2], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]], plan = (P: V[]) => (i: number): V => { const t = sub(P[Math.min(P.length - 1, i + 1)]!, P[Math.max(0, i - 1)]!); return [-t[1], t[0], 0]; };
    b.name('seam').mat(SEAM, 0.1);
    seam(TF[1]!.slice(0, 4), () => UPV); seam(TF.slice(1, iCW + 1).map(r => r[3]!), () => UPV);
    if (lamps < 0.02) { const r = border(TF, STOP.indexOf(SL), STOP.indexOf(SC), 4, 7); seam([...r, r[0]!], () => UPV); }
    { const P = NU.slice(NC - 1).map(r => r[4]!); seam(P, plan(P)); }
    for (const i of [iDF, iDR]) { seam(CH[i]!.slice(0, 6), k => CN[k]!); seam(LG[i - iA]!, () => UPV); }
    seam(CH.slice(iDF, iH0 + 1).map(c => c[5]!), () => [0, 1, 0]);
    seam(RD[at(4150) - iR]!.slice(0, 3), () => UPV); }

  // ---- the scoop pressed into the door's foot: it deepens to the slanted intake ahead of the rear wheel ----
  { const dep = (x: number) => 95 * Math.min(1, (x - SF[iH0]!) / (2620 - SF[iH0]!)), inn = (i: number, j: number): V => { const p = CH[i]![j]!; return [p[0], p[1] - dep(p[0]), p[2] + (j === 4 ? -8 : j === 6 ? 8 : 0)]; };
    const IN: V[][] = []; for (let i = iH0; i <= iH1; i++) IN.push([CH[i]![4]!, inn(i, 4), inn(i, 5), inn(i, 6), CH[i]![6]!]);
    b.name('scoop').mat(PAINT, GLOSS, 'paint'); cells(IN, (i, j) => j === 0 || j === 3 || i + iH0 < iH1 - 1);
    for (const sg of [1, -1]) { const m = (p: V) => mir(p, sg), a = IN[IN.length - 2]!, c = IN[IN.length - 1]!; tri(b, m(a[1]!), m(a[3]!), m(c[3]!), [0, sg, 0]);
      b.name('grille').mat(DARK, 0.05); tri(b, m(a[1]!), m(c[1]!), m(c[3]!), [0, sg, 0]); face(b, m(c[0]!), m(c[1]!), m(c[3]!), m(c[4]!), [-1, 0, 0]); tri(b, m(c[0]!), m(c[4]!), m(CH[iH1]![5]!), [-1, 0, 0]);
      b.name('grille').mat(FRAME, 0.2); for (const u of [0.3, 0.6]) b.bar(m(add(mix(a[1]!, c[1]!, u), [0, 14, -4])), m(add(mix(a[3]!, c[3]!, 0.25 + u), [0, 14, 4])), 14, 8);
      b.name('scoop').mat(PAINT, GLOSS, 'paint'); } }

  // ---- the pop-up head lamps: the cover hinges up about its back edge; under it a dark well, on its front the two lamps ----
  { const i0 = STOP.indexOf(SL), i1 = STOP.indexOf(SC), ang = lamps * 31 * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang), ox = TF[i1]![5]![0], oz = TF[i1]![5]![2];
    const up = (p: V): V => { const dx = p[0] - ox, dz = p[2] - oz; return [ox + dx * ca + dz * sa, p[1], oz - dx * sa + dz * ca]; };
    const CV: V[][] = TF.slice(i0, i1 + 1).map(r => r.slice(4, 8).map(up));
    b.name('lampLid').mat(PAINT, GLOSS, 'paint'); cells(CV);
    for (const sg of [1, -1]) { const m = (p: V) => mir(p, sg);
      b.name('lampWell'); pocket(border(TF, i0, i1, 4, 7).map(m), [0, 0, -70], [0, 0, 1]);
      if (lamps > 0.02) { const f0 = m(CV[0]![0]!), f1 = m(CV[0]![3]!), g0 = m(TF[i0]![4]!), g1 = m(TF[i0]![7]!), h0 = m(TF[i1]![4]!), h1 = m(TF[i1]![7]!), fwd: V = [-1, 0, 0.2];
        b.name('lampPod').mat(PAINT, GLOSS, 'paint'); tri(b, f0, g0, h0, [0, -sg, 0]); tri(b, f1, g1, h1, [0, sg, 0]);
        b.name('lampPod').mat(FRAME, 0.2); face(b, f0, f1, g1, g0, fwd);
        const P = (u: number, v: number, lift: number): V => { const p = mix(mix(f0, f1, u), mix(g0, g1, u), v); return [p[0] - lift, p[1], p[2]]; };
        b.name('headlamp').mat(LENS, 0.7, 'lens'); for (const [u0, u1] of [[0.07, 0.47], [0.53, 0.93]] as const) face(b, P(u0, 0.16, 5), P(u1, 0.16, 5), P(u1, 0.86, 5), P(u0, 0.86, 5), fwd); } } }

  // ---- the tail: the panel leaning back to its foot, the black band sunk into it with the lamps, the bumper standing proud ----
  { const LEAN = 0.18, top: V[] = [...RD[RD.length - 1]!, ...US[US.length - 1]!.slice(1), ...LG[LG.length - 1]!.slice(1), CH[NS - 1]![1]!, CH[NS - 1]![2]!], NTP = top.length;
    const tp = (p: V, z: number): V => { const zz = Math.min(z, p[2]); return [p[0] + (p[2] - zz) * LEAN, p[1], zz]; }, ZT0 = 848, ZT1 = 650, ZFT = 600, jB = 9;   // the band's top and bottom, the panel's foot; the band reaches to column jB (G)
    const TP: V[][] = [top, top.map(p => tp(p, ZT0)), top.map(p => tp(p, ZT1)), top.map(p => tp(p, ZFT))];
    b.name('tailPanel').mat(PAINT, GLOSS, 'paint'); cells(TP, (i, j) => !(i === 1 && j < jB));
    const qf = TP[3]![NTP - 1]!; for (const sg of [1, -1]) tri(b, mir(top[NTP - 1]!, sg), mir(qf, sg), [S1, sg * qf[1], ZFT], [0, sg, 0]);
    b.name('tailBand'); { const r = [...TP[1]!.slice(0, jB + 1), ...TP[2]!.slice(0, jB + 1).reverse()], full = [...r, ...r.slice(1, -1).reverse().map(p => mir(p, -1))]; pocket(full, [-30, 0, 0], [1, 0, 0]); }
    const xb = (z: number) => S1 + (900 - z) * LEAN, slab = (y0: number, y1: number, z0: number, z1: number, lift: number): V[] => [[xb(z0) - lift, y0, z0], [xb(z0) - lift, y1, z0], [xb(z1) - lift, y1, z1], [xb(z1) - lift, y0, z1]];
    b.name('tailGrille').mat(DARK, 0.05, 'grille'); { const r = slab(-440, 440, ZT1 + 8, ZT0 - 8, 26); face(b, r[0]!, r[1]!, r[2]!, r[3]!, [1, 0, 0]); }
    for (const sg of [1, -1]) for (const [y0, y1, col, kind] of [[462, 592, RED, 'lens'], [606, 736, RED, 'lens'], [750, 846, AMBER, 'plain']] as const) { const r = slab(sg * y0, sg * y1, ZT1 + 16, ZT0 - 16, 7);
      b.name(kind === 'lens' ? 'tailLamp' : 'indicatorR').mat(col, 0.7, kind); face(b, r[0]!, r[1]!, r[2]!, r[3]!, [1, 0, 0]);
      b.name('tailLampRim').mat(FRAME, 0.2); tube(b, r, [-22, 0, 0]); }
    // the bumper: rows going round from the centre line to its front end on the flank; [height, its rearmost x, half-width]
    const YB = W(S1) + 4 - 126, OUT: [number, number, number, number][] = [...[4170, 4250, 4300, S1].map(x => [x, W(x) + 4, 0, 1] as [number, number, number, number]), ...[22.5, 45, 67.5, 90].map(d => { const a = d * Math.PI / 180; return [S1 + 126 * Math.sin(a), YB + 126 * Math.cos(a), Math.sin(a), Math.cos(a)] as [number, number, number, number]; }), [4456, 600, 1, 0], [4456, 300, 1, 0], [4456, 0, 1, 0]];
    const row = (lv: [number, number][]) => OUT.map(([x, y, nx, ny]) => lv.map(([z, inset]) => [x - nx * inset, Math.max(0, y - ny * inset), z] as V));
    b.name('bumperR').mat(PAINT, GLOSS, 'paint'); cells(row([[612, 76], [610, 14], [590, 0], [352, 0], [336, 8]]));
    b.name('valance').mat(PAINT, GLOSS, 'paint'); cells(row([[336, 14], [205, 26], [185, 76]]));
    b.name('valanceGrille').mat(DARK, 0.05, 'grille'); face(b, [4445, -430, 322], [4445, 430, 322], [4432, 430, 212], [4432, -430, 212], [1, 0, 0]);
    for (const sg of [1, -1]) face(b, [S1, sg * 870, ZS], [4372, sg * 870, 185], [4372, 0, 185], [S1, 0, ZS], [0, 0, -1]);
    b.name('exhaust').mat(CHROME, 0.8, 'metal'); for (const y of [-190, -70, 70, 190]) b.lathe('x', [0, y, 262], [[4380, 38], [4452, 38], [4452, 30], [4400, 30]], 10, false);
    b.name('exhaust').mat(DARK, 0.05); for (const y of [-190, -70, 70, 190]) b.lathe('x', [0, y, 262], [[4402, 0], [4402, 30]], 10, false);
    b.name('plate').mat(WHITE, 0.3).box(4455, 4460, -260, 260, 405, 515);
    b.name('lampR').mat(WHITE, 0.7); for (const sg of [1, -1]) { b.box(4418, 4442, Math.min(sg * 520, sg * 700), Math.max(sg * 520, sg * 700), 232, 292); } }

  // ---- the back of the cabin: the upright rear window between the buttresses, over the engine cover's front edge ----
  { const rt = RFG[RFG.length - 1]!, zc = ZCV(XCV);
    b.name('rearPane').mat(GLASS, 0.5, 'glass'); for (let j = 0; j + 2 < NC; j++) for (const sg of [1, -1]) face(b, mir(rt[j]!, sg), mir(rt[j + 1]!, sg), [XCV, sg * rt[j + 1]![1] * YCV / YRI, zc], [XCV, sg * rt[j]![1] * YCV / YRI, zc], [1, 0, 0.3]);
    b.name('screenFrame').mat(FRAME, 0.2); for (const sg of [1, -1]) tri(b, mir(rt[NC - 2]!, sg), [XCV, sg * YCV, zc], mir(RD[0]![3]!, sg), [1, 0, 0]); }
  // the engine cover's louvres (two banks of raised slats, open to the back) and its centre rib
  b.name('louvre').mat(PAINT, GLOSS, 'paint'); for (const sg of [1, -1]) for (let k = 0; k < 7; k++) { const x0 = 2850 + k * 150, x1 = x0 + 95, ya = sg * 95, yb = sg * 405, z0 = ZCV(x0) + 1, z1 = ZCV(x1) + 24;
    face(b, [x0, ya, z0], [x0, yb, z0], [x1, yb, z1], [x1, ya, z1], [0, 0, 1]); tri(b, [x0, ya, z0], [x1, ya, z1], [x1, ya, ZCV(x1)], [0, -sg, 0]); tri(b, [x0, yb, z0], [x1, yb, z1], [x1, yb, ZCV(x1)], [0, sg, 0]); }
  b.name('louvre').mat(DARK, 0.05); for (const sg of [1, -1]) for (let k = 0; k < 7; k++) { const x1 = 2850 + k * 150 + 95; face(b, [x1, sg * 95, ZCV(x1)], [x1, sg * 405, ZCV(x1)], [x1, sg * 405, ZCV(x1) + 24], [x1, sg * 95, ZCV(x1) + 24], [1, 0, 0]); }
  b.name('engineCover').mat(PAINT, GLOSS, 'paint'); b.loft([2800, 3400, 4000].map(x => [[x, -55, ZCV(x)], [x, -38, ZCV(x) + 14], [x, 38, ZCV(x) + 14], [x, 55, ZCV(x)]] as V[]));

  // ---- the cabin behind the glass: floor, door panels, bulkheads, dash, tunnel, wheel, two seats ----
  { const FL = 150, xa = 1180, xb = XR1 + 6, UPV: V = [0, 0, 1];
    b.name('cockpit').mat(DARK, 0.05); face(b, [xa, -800, FL], [xb, -800, FL], [xb, 800, FL], [xa, 800, FL], UPV); face(b, [xb, -800, FL], [xb, 800, FL], [xb, 800, ZCV(XCV) - 4], [xb, -800, ZCV(XCV) - 4], [-1, 0, 0]);
    b.name('cockpit').mat(TRIM, 0.1); for (const sg of [1, -1]) { const xs = [1240, 1400, XR0, 2300, xb]; for (let k = 0; k + 1 < xs.length; k++) { const p = ptG(Math.min(XR1, xs[k]!)), q = ptG(Math.min(XR1, xs[k + 1]!)); face(b, [xs[k]!, sg * (p[1] - 14), FL], [xs[k + 1]!, sg * (q[1] - 14), FL], [xs[k + 1]!, sg * (q[1] - 14), q[2] - 6], [xs[k]!, sg * (p[1] - 14), p[2] - 6], [0, -sg, 0]); } }
    // the dash: its top from the screen's foot back to a crest, its face down to the floor
    const crest = (y: number): V => [1290 + 150 * (Math.abs(y) / YP) ** 2, y * 0.96, 800 - 60 * (Math.abs(y) / YP) ** 2];
    b.name('cockpit').mat(TRIM, 0.15); for (const sg of [1, -1]) for (let j = 0; j + 1 < NC; j++) { const p = mir(sFoot[j]!, sg), q = mir(sFoot[j + 1]!, sg), lo = (v: V): V => [v[0] + 14, v[1] * 0.985, v[2] - 12], c0 = crest(p[1]), c1 = crest(q[1]);
      face(b, lo(p), lo(q), c1, c0, UPV); face(b, c0, c1, [c1[0] + 60, c1[1], 420], [c0[0] + 60, c0[1], 420], [1, 0, 0.3]); }
    b.name('cockpit').mat(TRIM, 0.15).box(1380, xb, -115, 115, FL, 350);
    b.name('steering').mat(FRAME, 0.2).lathe('x', [0, -380, 700], [[1470, 150], [1462, 172], [1478, 186], [1494, 172], [1486, 150]], 12, false).bar([1380, -380, 720], [1476, -380, 700], 40);
    for (const sg of [1, -1]) { const y0 = sg * 175, y1 = sg * 590;
      b.name('seat').mat(SEAT, 0.25, 'leather').box(1880, 2330, Math.min(y0, y1), Math.max(y0, y1), FL, 330).loft(([[2270, 330], [2360, 600], [2440, 840], [2500, 900]] as const).map(([x, z]) => [[x, y0 + sg * 15, FL], [x, y1 - sg * 15, FL], [x, y1 - sg * 15, z], [x, y0 + sg * 15, z]] as V[]));
      b.name('seat').mat(SEAT2, 0.1); for (const y of [y0 + sg * 140, y0 + sg * 275]) b.bar([1900, y, 332], [2270, y, 332], 8).bar([2362, y - 0, 604], [2440, y, 842], 8); } }

  // ---- the fittings ----
  // the door mirrors, standing on the ledge at the side glass's front corner
  for (const sg of [1, -1]) { const hs = (y: number, k: number): V[] => [[1350 + 18 * k, y, 700], [1500, y, 696 + 4 * k], [1505, y, 790 - 6 * k], [1385 + 22 * k, y, 800 - 8 * k], [1340 + 18 * k, y, 770 - 4 * k]];
    b.name('mirror').mat(PAINT, GLOSS, 'paint').loft([hs(sg * 905, 1.4), hs(sg * 925, 0), hs(sg * 1075, 0), hs(sg * 1098, 1.6)]).bar([1400, sg * 850, 690], [1420, sg * 915, 730], 60, 36);
    b.name('mirrorGlass').mat(SILVER, 0.9, 'metal'); face(b, [1507, sg * 935, 706], [1507, sg * 1070, 706], [1511, sg * 1070, 782], [1511, sg * 935, 782], [1, 0, 0]); }
  // the single wiper parked along the screen's foot
  { const onScr = (y: number, v: number, lift: number): V => { const f = Math.abs(y) / YP, x0 = xTop(XA, Math.abs(y)), p: V = [x0, y, zTopF(x0, Math.abs(y))], x1 = xRoof(XR0, f * YD), q: V = [x1, y * YD / YP, zRoof(x1, f * YD)], r = mix(p, q, v); return [r[0] - lift * 0.4, r[1], r[2] + lift * 0.92]; };
    b.name('wiper').mat(FRAME, 0.15).bar(onScr(-420, 0.1, 16), onScr(330, 0.085, 16), 16, 10).bar(onScr(60, 0.0, 14), onScr(-40, 0.09, 22), 14, 10); }
  // the side repeater on each front wing, the bull's shield on the nose
  for (const sg of [1, -1]) { b.name('repeater').mat(AMBER, 0.7).lathe('y', [560, sg * (W(560) > 0 ? WJ * ginv((560) / XJ) : WJ), 470], [[0, 20], [sg * 5, 16], [sg * 6, 0]], 8, false); }
  b.name('badge').mat(FRAME, 0.4); { const p = (x: number, y: number): V => [x, y, zTopF(x, y) + 3]; face(b, p(150, -22), p(150, 22), p(196, 16), p(196, -16), [0, 0, 1]); tri(b, p(196, -16), p(196, 16), p(212, 0), [0, 0, 1]); }
  // the optional rear wing: a blade on two struts over the tail
  if (wing > 0.5) { const sec = (y: number): V[] => [[4130, y, 1118], [4240, y, 1132], [4420, y, 1126], [4430, y, 1108], [4240, y, 1104]];
    b.name('spoiler').mat(PAINT, GLOSS, 'paint').loft([sec(-880), sec(-300), sec(300), sec(880)]);
    for (const sg of [1, -1]) { b.loft(([[4200, 896], [4300, 1106]] as [number, number][]).map(([x, z]) => [[x, sg * 560, z], [x + 130, sg * 560, z], [x + 130, sg * 584, z], [x, sg * 584, z]] as V[]), false); b.box(4125, 4440, Math.min(sg * 880, sg * 894), Math.max(sg * 880, sg * 894), 1085, 1150); } }

  for (const s of [1, -1] as const) { wheel(b, FX, s, spin); wheel(b, RX, s, spin); }
  return b.mesh(L); }
export const mesh = diabloMesh;
