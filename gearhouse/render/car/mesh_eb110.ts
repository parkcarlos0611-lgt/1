// The 1991-95 Bugatti EB110 GT as a low-polygon mesh (docs/systems/70_mesh_car_rules.md), built panel by panel from
// the dimension sheet data/cars/spec/eb110.json (docs/systems/80_eb110_spec_sheet.md) and the reference views.
//
// The car is separate volumes meeting at crisp edges, each smooth inside, and the mesh is built the same way: every
// panel is its own grid of points (its own part, so the renderer smooths inside it and keeps its border crisp), and
// neighbouring panels share their border points exactly, so there are no gaps and nothing lies on top of another.
//   bonnet      a nearly flat raised plateau, sharp-edged, a tongue reaching forward between the lamps; the lamp slots
//               are cut out of its front corners (flat flush glass over a dark pocket with the units at the back)
//   front wings rounded pontoons outboard of the bonnet's edge; beside each lamp the wing lies lower than the bonnet:
//               a wall drops from the bonnet's edge into a scooped trough (the amber indicator at its mouth) whose
//               floor rises backward and dies out toward the screen's corner; the crest starts at the indicator's tip
//   nose        the band under the lamps runs round into the wings; under the shut line the bumper, its own volume,
//               round in plan (the horseshoe, two barred intakes, the corner ducts, a thin splitter)
//   cabin       wrap-round screen, side glass leaning in 40 degrees, a narrow roof; hollow, with a simple interior
//   flanks      door and rear quarter, with the skirt's recess under a crisp shelf deepening to the intake's mouth
//   rear        the buttress slopes with six sunk holes, the engine cover's glass between them, the leaning tail
//               panel (lamp capsules, mesh slots, plate), the black valance and the rising diffuser
// Lines along the car (bonnet edge/belt E, wall foot F, crest R, widest line W, sill S, roof edge D, glass top T) are
// monotone cubics through short tables; sections are Bezier arcs between them. The nose is round in plan: its rows
// follow super-ellipses. Axes: x from the nose back, y across, z up; mm. Axles at 1040 and 3590 (exact).
// `wing` 0: the blade lies in the tail .. 1: raised 110 mm on its two struts, its trailing edge tilted up.
import { Build, type Mesh, type V } from './mesh';

const PAINT = '#1b3a8a', SEAM = '#0c1a45', FRAME = '#14151a', TRIM = '#25272d', SEAT = '#8d8e94', SEAT2 = '#6c6d73', GLASS = '#a9c2cc', SILVER = '#c4c7cc', CHROME = '#d4d6d9', RUBBER = '#26242b', DARK = '#131318', LENS = '#eef0f2', RED = '#c9221f', RED2 = '#8e1a1a', AMBER = '#e8901c', DEEP = '#0f2562';
const GLOSS = 0.6;
const L = 4400, FX = 1040, RX = FX + 2550, R = 326, WYF = 775, WYR = 809, TWF = 245, TWR = 310;   // the axles, the tyres' radius, half the tracks, the tyres' widths
const RAF = 350, RZF = 362, RAR = 362, RZR = 392, YINF = 600, YINR = 610;                             // the wheel arches (half-width and height over the hub); the wells' inner walls
const XJ = FX - RAF - 2, XC = 1246, XT = 1990, XG = 1546, SP = 2530, SC1 = 2890, S1 = 4330;           // the nose's last row (the front arch's edge), the screen's corner and top, the side glass's front and back, the intake's mouth, the last ring
type Tri = [V, V, V];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], un = (a: V): V => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t, mix = (a: V, b: V, t: number): V => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mir = (p: V, sg: number): V => [p[0], p[1] * sg, p[2]];
/** a smooth curve through a table of [x, value]: a monotone cubic (it never overshoots a point, so a level run stays level) */
function curve(tab: [number, number][]): (x: number) => number { const n = tab.length, h: number[] = [], d: number[] = [], m: number[] = [];
  for (let i = 0; i + 1 < n; i++) { h[i] = tab[i + 1]![0] - tab[i]![0]; d[i] = (tab[i + 1]![1] - tab[i]![1]) / h[i]!; }
  for (let i = 0; i < n; i++) { if (i === 0 || i === n - 1) { m[i] = d[i === 0 ? 0 : n - 2]!; continue; } const a = d[i - 1]!, c = d[i]!; if (a * c <= 0) { m[i] = 0; continue; } const w1 = 2 * h[i]! + h[i - 1]!, w2 = h[i]! + 2 * h[i - 1]!; m[i] = (w1 + w2) / (w1 / a + w2 / c); }
  return x => { if (x <= tab[0]![0]) return tab[0]![1]; if (x >= tab[n - 1]![0]) return tab[n - 1]![1]; let i = 0; while (x > tab[i + 1]![0]) i++; const t = (x - tab[i]![0]) / h[i]!, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * tab[i]![1] + (t3 - 2 * t2 + t) * h[i]! * m[i]! + (3 * t2 - 2 * t3) * tab[i + 1]![1] + (t3 - t2) * h[i]! * m[i + 1]!; }; }

// ---- the lines along the car ----
/** the bonnet's centre line (from the bumper's shut line to the screen's foot, carried on level to the screen's corners) */
const ZH = curve([[105, 405], [142, 428], [236, 478], [331, 524], [425, 565], [520, 607], [614, 648], [709, 692], [803, 730], [898, 758], [990, 776], [1085, 789], [XC, 795]]);
/** the bonnet's plateau: its height at (x, y), a slight crown */
/** the bonnet: flat across where the lamps are cut into it, so both lamps' top edges and the bonnet's edge between them lie on one straight line across the car (review 139, the photographs); its crown grows behind them */
const zHood = (x: number, y: number) => ZH(x) - 24 * sm(640, 1000, x) * (y / 630) ** 2;
/** the roof's and the deck's centre line */
const ZC = curve([[XT, 1094], [2060, 1104], [2124, 1108], [2266, 1115], [2361, 1118], [2502, 1115], [2644, 1110], [2786, 1097], [2928, 1082], [3070, 1066], [3211, 1048], [3353, 1027], [3495, 1003], [3637, 975], [3778, 949], [3950, 925], [4150, 898], [4300, 872], [4400, 852]]);
/** half the width at the widest line (the sheet's plan), and that line's height */
const WID = curve([[XJ, 880], [800, 888], [1000, 896], [1200, 908], [1500, 908], [2100, 925], [2400, 934], [2600, 954], [2800, 963], [3000, 975], [3200, 970], [3600, 965], [3800, 960], [4000, 950], [4100, 930], [4200, 890], [4300, 838], [S1, 826]]);
const ZW = curve([[XJ, 450], [FX, 500], [2000, 520], [3000, 590], [RX, 620], [4100, 600], [S1, 560]]);
/** the sill (rising behind the rear wheel: the diffuser), and how far it stands in from the widest line */
const ZS = curve([[XJ, 100], [760, 118], [1400, 122], [RX, 128], [3960, 185], [4061, 248], [4175, 345], [4266, 452], [S1, 535]]);
const UND = curve([[XJ, 45], [2400, 55], [3640, 45], [S1, 25]]);
/** E: the bonnet's edge, then the side glass's foot (the belt), then the foot of the buttress's slope */
const YE = curve([[440, 616], [600, 616], [XC, 652], [1392, 672], [XG, 688], [2000, 695], [SP, 700], [2800, 745], [3200, 790], [3600, 800], [4000, 800], [S1, 808]]);
const ZEB = curve([[XC, zHood(XC, 652)], [1392, 781], [XG, 791], [2000, 792], [SP, 806], [2800, 850], [3200, 885], [3600, 895], [4000, 872], [S1, 800]]);
const ZE = (x: number) => x <= XC ? zHood(x, YE(x)) : ZEB(x);
/** F: the foot of the wall that drops from the bonnet's edge into the trough (its height below the edge) */
const WALL = curve([[440, 0], [490, 18], [545, 38], [600, 54], [XJ, 52], [767, 40], [858, 24], [949, 10], [FX, 0]]);
/** R: the wing's crest (from the indicator's tip), the door's shoulder, the rear wing's top */
const YR = curve([[440, 729], [490, 748], [545, 763], [600, 775], [645, 784], [XJ, 792], [767, 804], [858, 812], [949, 818], [FX, 824], [1148, 830], [XC, 833], [1392, 822], [XG, 800], [2000, 790], [SP, 800], [2800, 840], [3200, 880], [3600, 885], [4000, 860], [S1, 818]]);
const ZR = curve([[440, zHood(440, 729)], [490, 560], [545, 576], [600, 592], [645, 608], [XJ, 625], [767, 662], [858, 702], [949, 730], [FX, 745], [1148, 752], [XC, 757], [1392, 768], [XG, 783], [2000, 782], [SP, 795], [2800, 840], [3200, 872], [3600, 880], [4000, 850], [S1, 760]]);
/** D: the roof's edge and the deck's; T: the side glass's top and the buttress's shoulder, below and outboard of it */
const YD = curve([[XT, 405], [SP, 418], [2800, 450], [3200, 530], [3600, 640], [3900, 710], [S1, 740]]);
const HT = curve([[XT, 44], [SP, 44], [3600, 40], [S1, 26]]);
/** how far the deck's rings bow back toward the centre line at the tail (it is round in plan) */
const BOWT = (s: number) => 30 * sm(4050, S1, s);
/** the skirt's recess: its depth (it deepens to the intake's mouth) and its lower edge, the sill's top */
const DEP = (x: number) => x < 1420 || x > SC1 + 1 ? 0 : 85 * sm(1420, 2600, x), ZSH = 412, ZL = curve([[1392, 300], [2200, 300], [2700, 225], [S1, 225]]);
/** the wheel arch's height at x: half an ellipse over each hub (0 away from the wheels) */
const archZ = (x: number) => { for (const [hx, ra, rz] of [[FX, RAF, RZF], [RX, RAR, RZR]] as const) { const dx = x - hx; if (Math.abs(dx) <= ra + 1e-6) return R + rz * Math.sqrt(Math.max(0, 1 - dx * dx / (ra * ra))); } return 0; };

// ---- the nose: fourteen rows from the centre line round the corner to the front arch; each line of the nose is a
//      super-ellipse in plan, a row taking the same share f of every line's width ----
const FR = [0, 0.1, 0.2, 0.26, 0.4, 0.5, 0.575, 0.82, 0.9, 0.945, 0.968, 0.984, 0.993, 0.998, 1], NCR = FR.length - 1;
/** the crest line round the nose: the tongue's front edge (rows 0-3), the lamp's (3-7), the indicator's (7-9, its tip), then back along the wing */
const CREST: [number, number][] = [[352, 0], [352, 70], [353, 140], [355, 181], [358, 290], [362, 400], [368, 510], [378, 612], [396, 680], [440, 729], [490, 748], [545, 763], [600, 775], [645, 784]];
const IA = 3, IB = 7, IT = 9, I6 = 12;                                    // rows: the lamp's inner foot, its outer foot, the indicator's tip, the lamp's back corner
const sup = (xf: number, w: number, f: number, p = 2.6): [number, number] => [xf + (XJ - xf) * (1 - (1 - f ** p) ** (1 / p)), w * f];
/** the bumper's lines under the shut line: height, how far back the line starts on the centre line, half-width at the arch */
const BUMP: [number, number, number][] = [[368, 82, 880], [285, 48, 877], [235, 26, 873], [185, 16, 867], [130, 14, 858], [108, 24, 850], [100, 42, 835]];
const NB = 5, NL = BUMP.length, NK = NB + NL;                             // the chain's cells from the crest to the widest line, and below it
/** a point of the bumper's face at (y, z) (z between 100 and 428), for what is laid on it */
const BXF = curve(([[100, 42], [108, 24], [130, 14], [185, 16], [235, 26], [285, 48], [368, 82], [405, 105]] as [number, number][])), BW = curve([[100, 835], [108, 850], [130, 858], [185, 867], [235, 873], [285, 877], [368, 880], [450, 880]]);
const bump = (y: number, z: number, lift = 0): V => { const f = Math.min(0.999, Math.abs(y) / BW(z)), xf = BXF(z), x = xf + (XJ - xf) * (1 - (1 - f ** 2.6) ** (1 / 2.6)); return [x - lift * (1 - 0.6 * f), y + Math.sign(y) * lift * 0.8 * f, z]; };

/** the arc from the crest (or the indicator's edge) R down to the widest line H: g 0 a straight band (the nose's middle), 1 the wing's roll */
function band(Rp: V, H: V, g: number, t: number): V { const dz = Rp[2] - H[2], P1 = mix(mix(Rp, H, 1 / 3), [lerp(Rp[0], H[0], 0.6), lerp(Rp[1], H[1], 0.6), Rp[2] - 0.12 * dz], g), P2 = mix(mix(Rp, H, 2 / 3), [H[0], H[1], H[2] + 0.45 * dz], g), v = 1 - t;
  return [0, 1, 2].map(k => v * v * v * Rp[k]! + 3 * v * v * t * P1[k]! + 3 * v * t * t * P2[k]! + t * t * t * H[k]!) as V; }
/** the stations behind the nose: every 18 degrees round an arch, about 100 mm apart between */
const arcS = (hx: number, ra: number) => [...Array.from({ length: 11 }, (_, k) => Math.round(hx - ra * Math.cos(k * 18 * Math.PI / 180))), hx + ra + 2];
const SS = [XJ, ...arcS(FX, RAF), 1470, XG, 1700, 1845, XT, 2100, 2210, 2320, 2430, SP, 2620, 2710, 2800, SC1, SC1 + 22, 2980, 3120, RX - RAR - 2, ...arcS(RX, RAR), 4050, 4130, 4200, 4260, 4300, S1];
const ROWX = [...CREST.map(c => c[0]), ...SS], NR = ROWX.length;          // every row's place on the crest (the nose's rows, then the stations)
const rowOf = (x: number) => { const i = ROWX.indexOf(x, NCR); if (i < 0) throw new Error(`eb110: no station at ${x}`); return i; };

/** the outer chain of a row: NK + 1 points from the crest R (k 0) over the widest line (k NB) to the sill or the arch's lip (k NK) */
function chain(i: number): V[] {
  if (i <= NCR) { const f = FR[i]!, [cx, cy] = i < NCR ? CREST[i]! : [XJ, YR(XJ)], Rp: V = [cx, cy, i <= IT ? zHood(cx, cy) : ZR(cx)], [hx, hy] = sup(105, 880, f), H: V = [hx, hy, 405 + 45 * f ** 1.5];
    const g = Math.max(0.1, sm(420, 760, cy)), out: V[] = []; for (let k = 0; k <= NB; k++) out.push(band(Rp, H, g, k / NB));
    for (const [z, xf, w] of BUMP) { const [x, y] = sup(xf, w, f); out.push([x, y, z]); } return out; }
  const x = ROWX[i]!, w = WID(x), zW = ZW(x), zS = ZS(x), Rp: V = [x, YR(x), ZR(x)], H: V = [x, w, zW], yAt = (z: number) => w - UND(x) * ((zW - z) / (zW - zS)) ** 2, az = archZ(x), out: V[] = [];
  if (az > 0) { const at = (tau: number): V => tau <= 1 ? band(Rp, H, 1, tau) : [x, yAt(lerp(zW, zS, tau - 1)), lerp(zW, zS, tau - 1)]; let lo = 0, hi = 2; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (at(m)[2] > az) lo = m; else hi = m; }
    for (let k = 0; k <= NK; k++) out.push(at(lo * k / NK)); return out; }
  for (let k = 0; k <= NB; k++) out.push(band(Rp, H, 1, k / NB));
  if (zS > 200) { for (let k = 1; k <= NL; k++) { const z = lerp(zW, zS, k / NL); out.push([x, yAt(z), z]); } return out; }   // behind the rear wheel the flank ends at the rising diffuser
  const d = DEP(x), zl = ZL(x), zm = (zW + ZSH) / 2;
  out.push([x, yAt(zm), zm], [x, yAt(ZSH), ZSH], [x, yAt(ZSH) - d, ZSH - (d > 0 ? 10 : 8)], [x, yAt(zl) - d, zl + (d > 0 ? 10 : 8)], [x, yAt(zl), zl], [x, yAt((zl + zS) / 2), (zl + zS) / 2], [x, yAt(zS), zS]); return out; }

/** a flat disc across the axle at o */
function disc(b: Build, o: V, r: number, seg: number) { for (let i = 0; i < seg; i++) { const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2; b.tri(o, [o[0] + Math.cos(a0) * r, o[1], o[2] + Math.sin(a0) * r], [o[0] + Math.cos(a1) * r, o[1], o[2] + Math.sin(a1) * r]); } }
/** a four-sided face wound so that it looks along n */
function face(b: Build, p: V, q: V, r: V, t: V, n: V) { if (dot(cross(sub(q, p), sub(t, p)), n) + dot(cross(sub(r, q), sub(p, q)), n) >= 0) b.quad(p, q, r, t); else b.quad(p, t, r, q); }
/** a patch of nu by nv faces over f(u, v), 0..1 each way */
function patch(b: Build, f: (u: number, v: number) => V, nu: number, nv: number, n: V) { for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) face(b, f(i / nu, j / nv), f((i + 1) / nu, j / nv), f((i + 1) / nu, (j + 1) / nv), f(i / nu, (j + 1) / nv), n); }
/** a flat many-sided face as a fan about its middle, looking along n */
function fan(b: Build, pts: V[], n: V, lift = 0) { const c: V = [0, 0, 0]; for (const p of pts) { c[0] += p[0] / pts.length; c[1] += p[1] / pts.length; c[2] += p[2] / pts.length; } const up = (p: V): V => [p[0] + n[0] * lift, p[1] + n[1] * lift, p[2] + n[2] * lift];
  for (let i = 0; i < pts.length; i++) { const p = up(pts[i]!), q = up(pts[(i + 1) % pts.length]!), m = up(c); if (dot(cross(sub(p, m), sub(q, m)), n) >= 0) b.tri(m, p, q); else b.tri(m, q, p); } }
/** where a line along axis `c` through (a, b) on the other two axes meets a set of triangles: the farthest (or nearest) hit; NaN if none */
function probe(T: Tri[], ia: number, ib: number, ic: number, a: number, b: number, far = true): number { let best = NaN;
  for (const [p, q, r] of T) { const den = (q[ib]! - r[ib]!) * (p[ia]! - r[ia]!) + (r[ia]! - q[ia]!) * (p[ib]! - r[ib]!); if (Math.abs(den) < 1e-9) continue;
    const l0 = ((q[ib]! - r[ib]!) * (a - r[ia]!) + (r[ia]! - q[ia]!) * (b - r[ib]!)) / den, l1 = ((r[ib]! - p[ib]!) * (a - r[ia]!) + (p[ia]! - r[ia]!) * (b - r[ib]!)) / den, l2 = 1 - l0 - l1; if (l0 < -1e-6 || l1 < -1e-6 || l2 < -1e-6) continue;
    const v = l0 * p[ic]! + l1 * q[ic]! + l2 * r[ic]!; if (!(far ? v <= best : v >= best)) best = v; } return best; }

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
  const TOP: Tri[] = [], SIDE: Tri[] = [];
  /** the cells of a grid of points (given for the car's right half) laid on both sides, wound outward (rows going back,
   *  columns going out and down); each cell cut along the diagonal that folds it less; `pick` chooses the cells */
  const cells = (P: V[][], pick: (i: number, j: number) => boolean = () => true, keep?: Tri[], force?: boolean) => { for (let i = 0; i + 1 < P.length; i++) for (let j = 0; j + 1 < Math.min(P[i]!.length, P[i + 1]!.length); j++) { if (!pick(i, j)) continue;
    const q = [P[i]![j]!, P[i + 1]![j]!, P[i + 1]![j + 1]!, P[i]![j + 1]!] as [V, V, V, V], nn = (p: V, r: V, s: V) => un(cross(sub(r, p), sub(s, p))), alt = force ?? dot(nn(q[0], q[1], q[2]), nn(q[0], q[2], q[3])) < dot(nn(q[1], q[2], q[3]), nn(q[1], q[3], q[0])) - 1e-9;
    const ts: Tri[] = alt ? [[q[1], q[2], q[3]], [q[1], q[3], q[0]]] : [[q[0], q[1], q[2]], [q[0], q[2], q[3]]];
    for (const t of ts) { const c = cross(sub(t[1], t[0]), sub(t[2], t[0])); if (Math.hypot(c[0], c[1], c[2]) < 0.5) continue; keep?.push(t, [mir(t[0], -1), mir(t[2], -1), mir(t[1], -1)]); b.tri(t[0], t[1], t[2]); b.tri(mir(t[0], -1), mir(t[2], -1), mir(t[1], -1)); } } };

  // ---- the points ----
  const CH = Array.from({ length: NR }, (_, i) => chain(i));                                             // the outer chains
  /** the trough beside the bonnet: the bonnet's edge E, the wall's foot F, the floor's middle M (rows from the indicator's tip back) */
  const TR = (i: number): V[] => { const x = ROWX[i]!, yE = YE(x), zE = ZE(x), h = WALL(x), Rp = CH[i]![0]!, F: V = [x, yE + (h > 0 ? 10 : 6), zE - h], M = mix(F, Rp, 0.5); M[2] -= 12 * sm(440, 520, x) * (1 - sm(900, 1300, x)); return [[x, yE, zE], F, M, Rp]; };
  const rC = rowOf(XC), rT = rowOf(XT), rG = rowOf(XG), rP = rowOf(SP), rM = rowOf(SC1);
  // the bonnet: seven points across (four over the tongue, three more behind the lamp), rows bowing forward to the screen's curved foot
  const FT = [0, 70 / 181, 140 / 181, 1], yTng = (xe: number) => xe < 600 ? 181 + 93 * (xe - 355) / 245 : 274 * YE(xe) / 616;
  const hoodRow = (xe: number): V[] => { const yE = YE(xe), yT = yTng(xe), bw = xe <= 600 ? 0 : (XC - 1085) * ((xe - 600) / (XC - 600)) ** 1.5; return Array.from({ length: 7 }, (_, j) => { const y = j <= 3 ? FT[j]! * yT : yT + (yE - yT) * (j - 3) / 3, x = xe - bw * (1 - (y / yE) ** 2.2); return [x, y, j === 6 ? ZE(xe) : zHood(x, y)] as V; }); };
  const TONGUE: V[][] = [CH.slice(0, IA + 1).map(c => c[0]!), ...[435, 520, 600].map(x => hoodRow(x).slice(0, 4))], HOOD: V[][] = ROWX.slice(I6, rC + 1).map(hoodRow);
  // the roof and the deck: six points from the centre line to the edge D, the glass's top T, then the belt E
  const upper = (s: number): V[] => { const yD = YD(s), yC = Math.min(450, 0.78 * yD), yE = YE(s), bow = BOWT(s), xo = (y: number) => s + bow * (1 - (y / yE) ** 2.5), ys = [0, 0.3 * yC, 0.65 * yC, yC, (yC + yD) / 2, yD];
    const out: V[] = ys.map(y => [xo(y), y, ZC(xo(y)) - 14 * (y / yD) ** 2] as V), zD = out[5]![2]; out.push([xo(yD + 45), yD + 45, zD - HT(s)], [s, yE, ZE(s)]); return out; };
  const UP: V[][] = ROWX.slice(rT).map(upper);
  // the screen: from the bonnet's last row up to the roof's first, bulging a little; its side edge is the straight pillar line
  const sFoot = HOOD[HOOD.length - 1]!, sTop = UP[0]!.slice(0, 7), VS = [XC, 1392, XG, 1700, 1845, XT].map(x => (x - XC) / (XT - XC));
  const SCREEN: V[][] = VS.map(v => sFoot.map((p, j) => { const q = mix(p, sTop[j]!, v), bl = 22 * 4 * v * (1 - v) * (1 - (j / 6) ** 2); return [q[0] - bl * 0.4, q[1], q[2] + bl * 0.92] as V; }));
  const pillar = (x: number): V => mix(sFoot[6]!, sTop[6]!, (x - XC) / (XT - XC));
  /** the cabin's side ahead of the roof: belt E, the glass's front edge G, the pillar line */
  const SIDEF: V[][] = ROWX.slice(rC, rT + 1).map(x => { const e: V = [x, YE(x), ZE(x)], s = pillar(x); return [s, mix(e, s, x < XG ? 0.5 : 0.86 * (x - XG) / (XT - XG)), e]; });

  // ---- the panels ----
  const chainRows = (a: number, c: number) => CH.slice(a, c + 1), trRows = (a: number, c: number) => ROWX.slice(a, c + 1).map((_, k) => TR(a + k));
  b.name('wingF').mat(PAINT, GLOSS, 'paint'); cells(chainRows(0, rG - 1), (i, j) => i >= NCR || j < NB, SIDE); cells(trRows(IT, rG - 1), undefined, TOP);
  for (const sg of [1, -1]) for (const i of [IT, IT + 1]) TOP.push([mir(CH[i]![0]!, sg), mir(CH[i + 1]![0]!, sg), mir(CH[i]![1]!, sg)]);
  for (let i = 0; i < NCR; i++) for (let k = 0; k < NB; k++) for (const sg of [1, -1]) { const q = [CH[i]![k]!, CH[i + 1]![k]!, CH[i + 1]![k + 1]!, CH[i]![k + 1]!].map(p => mir(p, sg)) as [V, V, V, V]; TOP.push([q[0], q[1], q[2]], [q[0], q[2], q[3]]); }
  b.name('bumperF').mat(PAINT, GLOSS, 'paint'); cells(chainRows(0, NCR), (i, j) => j >= NB && !(i >= 1 && i < 6 && j >= NB + 2 && j < NB + 5));
  b.name('hood').mat(PAINT, GLOSS, 'paint'); cells(TONGUE, undefined, TOP); cells(HOOD, undefined, TOP);
  // the bumper's shut line: a thin dark seam along the nose from arch to arch
  b.name('bumperF').mat(SEAM, 0.1); for (const sg of [1, -1]) { const e = CH.slice(0, NCR + 1).map((c, i) => { const p = c[NB]!, up = un(sub(c[NB - 1]!, p)), dn = un(sub(c[NB + 1]!, p)), a = CH[Math.max(0, i - 1)]![NB]!, d = CH[Math.min(NCR, i + 1)]![NB]!, n = un(cross(sub(d, a), up)), o = (v: V, k: number): V => mir([p[0] + v[0] * k + n[0] * 3, p[1] + v[1] * k + n[1] * 3, p[2] + v[2] * k + n[2] * 3], sg); return [o(up, 7), o(dn, 7)] as [V, V]; });
    for (let i = 0; i < NCR; i++) face(b, e[i]![0], e[i + 1]![0], e[i + 1]![1], e[i]![1], [-1, sg, 0.3]); }
  b.name('door').mat(PAINT, GLOSS, 'paint'); cells(chainRows(rG - 1, rP), undefined, SIDE); cells(trRows(rG - 1, rP), undefined, TOP);
  b.name('quarter').mat(PAINT, GLOSS, 'paint'); cells(chainRows(rP, NR - 1), (i, j) => !(rP + i === rM && j >= NB + 2 && j < NB + 5), SIDE); cells(trRows(rP, NR - 1), undefined, TOP);
  b.name('grille').mat(DARK, 0.05); cells(chainRows(rM, rM + 1), (_, j) => j >= NB + 2 && j < NB + 5);                 // the side intake's mouth: the recess's slanting end
  const rH0 = rowOf(2620), rH1 = rowOf(2980), iE0 = rowOf(2710) - rT, iE1 = rowOf(Math.round(RX - RAR * Math.cos(108 * Math.PI / 180))) - rT, isCover = (i: number, j: number) => i >= iE0 && i < iE1 && j < 3;
  b.name('roof').mat(PAINT, GLOSS, 'paint'); cells(UP, (i, j) => j < 6 && !isCover(i, j), TOP); cells(UP, (i, j) => j === 6 && rT + i >= rP && !(rT + i >= rH0 && rT + i < rH1), TOP, false);
  b.name('engineCover').mat(GLASS, 0.5, 'glass'); cells(UP, isCover, TOP);
  b.name('screenPane').mat(GLASS, 0.5, 'glass'); cells(SCREEN, undefined, TOP);
  b.name('sidePane').mat(GLASS, 0.5, 'glass'); cells(UP, (i, j) => j === 6 && rT + i < rP); cells(SIDEF, (i, j) => j === 1 && rC + i >= rG);
  b.name('screenFrame').mat(FRAME, 0.2); cells(SIDEF, (i, j) => j === 0 || rC + i < rG);

  // where the skin is: its height at (x, y) on top, its distance from the centre line at (x, z) on the flank
  const zTop = (x: number, y: number) => { const z = probe(TOP, 0, 1, 2, x, y); if (Number.isNaN(z)) throw new Error(`eb110: no skin at ${x}, ${y}`); return z; };
  const ySide = (x: number, z: number) => { const y = probe(SIDE, 0, 2, 1, x, z); if (Number.isNaN(y)) throw new Error(`eb110: no flank at ${x}, ${z}`); return y; };
  const top = (x: number, y: number, lift = 4): V => [x, y, zTop(x, y) + lift], flank = (x: number, z: number, sg: number, lift = 4): V => [x, sg * (ySide(x, z) + lift), z];
  const UPV: V = [0, 0, 1];
  const seamSide = (pts0: [number, number][], sg: number, t = 9) => { const pts: [number, number][] = [pts0[0]!]; for (let i = 1; i < pts0.length; i++) { const a = pts0[i - 1]!, c = pts0[i]!, n = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) / 70)); for (let k = 1; k <= n; k++) pts.push([lerp(a[0], c[0], k / n), lerp(a[1], c[1], k / n)]); }
    const e = pts.map(([x, z], i) => { const a = pts[Math.max(0, i - 1)]!, c = pts[Math.min(pts.length - 1, i + 1)]!, l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1, nx = -(c[1] - a[1]) / l * t / 2, nz = (c[0] - a[0]) / l * t / 2; return [flank(x + nx, z + nz, sg, 3), flank(x - nx, z - nz, sg, 3)] as [V, V]; });
    for (let i = 0; i + 1 < e.length; i++) face(b, e[i]![0], e[i + 1]![0], e[i + 1]![1], e[i]![1], [0, sg, 0]); };

  // ---- the tail: the panel leaning back to its foot (the crease over the valance), the black valance, the floor and the diffuser ----
  const LEAN = 40, ZF = ZW(S1), tailTop = [...UP[UP.length - 1]!, ...CH[NR - 1]!.slice(0, NB + 1)], NT = tailTop.length, yFoot = WID(S1);
  const footX = (y: number) => S1 + (30 + LEAN) * (1 - (Math.abs(y) / yFoot) ** 2.5);
  const TAIL: V[][] = [0, 0.5, 1].map(v => tailTop.map((p, j) => { const y = j <= 5 ? p[1] : lerp(tailTop[5]![1], yFoot, ((j - 5) / (NT - 6)) ** 0.8), f: V = j === NT - 1 ? p : [footX(y), y, ZF]; return mix(p, f, v); }));
  b.name('tailPanel').mat(PAINT, GLOSS, 'paint'); cells(TAIL);
  /** a point of the tail panel at (y, z), set off it by lift */
  const tail = (y: number, z: number, lift = 4): V => { const ay = Math.min(Math.abs(y), YD(S1)), xt = S1 + 30 * (1 - (ay / YE(S1)) ** 2.5), zt = ZC(xt) - 14 * (ay / YD(S1)) ** 2; return [lerp(xt, footX(y), Math.max(0, Math.min(1, (zt - z) / (zt - ZF)))) + lift, y, z]; };
  b.name('valance').mat(DARK, 0.05); { const ys = [0, 200, 400, 600, 740, yFoot], lo = (y: number): V => [S1 + 20 * (1 - (y / yFoot) ** 2.5), Math.min(y, yFoot - UND(S1)), ZS(S1)]; cells([0, 0.5, 1].map(v => ys.map(y => mix([footX(y), y, ZF], lo(y), v)))); }
  b.name('chassis').mat(DARK, 0.05); for (let i = 0; i + 1 < NR; i++) { const az0 = archZ(ROWX[i]!) > 0 && i > NCR, az1 = archZ(ROWX[i + 1]!) > 0 && i + 1 > NCR, yin = ROWX[i]! < 2400 ? YINF : YINR;
    const pt = (r: number, arch: boolean): V => arch ? [ROWX[r]!, yin, ZS(ROWX[r]!)] : CH[r]![NK]!, p = pt(i, az0), q = pt(i + 1, az1), cx = (r: number) => r < NCR ? 42 : ROWX[r]!;
    for (const sg of [1, -1]) face(b, mir(p, sg), mir(q, sg), [cx(i + 1), 0, q[2]], [cx(i), 0, p[2]], [0, 0, -1]); }
  // ---- the wheel wells: a dark roof from the arch's lip in to the inner wall, the wall itself, the ends ----
  for (const sg of [1, -1]) for (const [hx, ra, yin] of [[FX, RAF, YINF], [RX, RAR, YINR]] as const) { const i0 = rowOf(hx - ra), i1 = rowOf(hx + ra), inn = (i: number): V => [ROWX[i]!, sg * yin, CH[i]![NK]![2]];
    for (let i = i0; i < i1; i++) { face(b, mir(CH[i]![NK]!, sg), mir(CH[i + 1]![NK]!, sg), inn(i + 1), inn(i), [0, 0, -1]); b.tri([hx, sg * yin, R], inn(i), inn(i + 1)); }
    for (const i of [i0, i1]) { const x = ROWX[i]!, zf = ZS(x); face(b, [x, sg * yin, zf], [x, sg * (WID(x) - 50), zf], mir(CH[i]![NK]!, sg), inn(i), [i === i0 ? 1 : -1, 0, 0]); }
    face(b, [hx - ra, sg * yin, ZS(hx - ra)], [hx + ra, sg * yin, ZS(hx + ra)], [hx + ra, sg * yin, R], [hx - ra, sg * yin, R], [0, sg, 0]); }
  b.bar([FX, -WYF, R], [FX, WYF, R], 50).bar([RX, -WYR, R], [RX, WYR, R], 70);
  // the splitter: a thin dark blade under the nose
  b.name('splitter').mat(FRAME, 0.15); { const edge = (i: number): V => { const [x, y] = sup(4, 852, Math.min(FR[i]!, 0.9)); return [x, y, 92]; }, P = Array.from({ length: 9 }, (_, i) => [edge(i), [CH[i]![NK]![0], CH[i]![NK]![1], 92] as V]); cells(P); cells(P.map(r => [[r[0]![0], r[0]![1], 84] as V, r[0]!])); }

  // ---- the cabin behind the glass: floor, door panels, the wall behind the seats, dash, tunnel, two seats ----
  { const FL = 150, xa = 1396, xb = SP - 6, ring = UP[rP - rT]!;
    b.name('cockpit').mat(DARK, 0.05); face(b, [xa, -700, FL], [xb, -700, FL], [xb, 700, FL], [xa, 700, FL], UPV);
    b.name('cockpit').mat(TRIM, 0.1); for (const sg of [1, -1]) { face(b, [xa, sg * (YE(xa) - 14), FL], [xb, sg * (YE(xb) - 14), FL], [xb, sg * (YE(xb) - 14), ZE(xb) - 6], [xa, sg * (YE(xa) - 14), ZE(xa) - 6], [0, -sg, 0]);
      for (let j = 0; j + 1 < ring.length; j++) { const p = ring[j]!, q = ring[j + 1]!, in2 = (v: V): V => [xb, sg * v[1] * 0.985, v[2] - 5]; face(b, in2(p), in2(q), [xb, sg * q[1] * 0.985, FL], [xb, sg * p[1] * 0.985, FL], [-1, 0, 0]); } }
    // the dash: its top from the screen's foot up to a crest, its face down to the floor
    const crest = (y: number): V => [1340 - 60 * (y / 650) ** 2 + 165 * (y / 650) ** 2.2, y, 812 - 40 * (y / 650) ** 2];
    b.name('cockpit').mat(TRIM, 0.15); for (const sg of [1, -1]) for (let j = 0; j < 6; j++) { const p = mir(sFoot[j]!, sg), q = mir(sFoot[j + 1]!, sg), lo = (v: V): V => [v[0] + 12, v[1] * 0.985, v[2] - 10], c0 = mir(crest(sFoot[j]![1] * 0.985), sg), c1 = mir(crest(sFoot[j + 1]![1] * 0.985), sg);
      face(b, lo(p), lo(q), c1, c0, UPV); face(b, c0, c1, [c1[0] + 50, c1[1], 430], [c0[0] + 50, c0[1], 430], [1, 0, 0.3]); }
    b.name('cockpit').mat(TRIM, 0.15).box(1500, xb, -105, 105, FL, 355);
    for (const sg of [1, -1]) { const y0 = sg * 150, y1 = sg * 520;
      b.name('seat').mat(SEAT, 0.25, 'leather').box(1890, 2340, Math.min(y0, y1), Math.max(y0, y1), FL, 335).loft(([[2270, 335], [2330, 620], [2400, 850], [2460, 880]] as const).map(([x, z]) => [[x, y0 + sg * 15, FL], [x, y1 - sg * 15, FL], [x, y1 - sg * 15, z], [x, y0 + sg * 15, z]] as V[]));
      b.name('seat').mat(SEAT2, 0.1); for (const y of [y0 + sg * 125, y0 + sg * 250]) b.bar([1910, y, 337], [2270, y, 337], 8).bar([2334, y, 624], [2402, y, 846], 8); } }
  // the engine under its glass: a dark tray
  b.name('engine').mat(DARK, 0.1); face(b, [2700, -440, 900], [3720, -440, 800], [3720, 440, 800], [2700, 440, 900], UPV);

  // ---- the head lamps: flat glass flush with the bonnet over a dark pocket; at the back the fluted halogen unit inboard
  //      and the round projector outboard, a black finned ramp down the inner side; the amber indicator at the trough's mouth ----
  for (const sg of [1, -1]) { const m = (p: V) => mir(p, sg), A = CH[IA]![0]!, B = CH[IB]![0]!, C = TR(I6)[0]!, Dd = HOOD[0]![3]!, N: V = [0, 0, 1];
    const rimPts = [...CH.slice(IA, IB + 1).map(c => c[0]!), ...[IT, IT + 1, IT + 2, I6].map(i => TR(i)[0]!), HOOD[0]![5]!, HOOD[0]![4]!, Dd, TONGUE[2]![3]!, TONGUE[1]![3]!].map(m);
    const dep = (x: number) => lerp(14, 72, Math.max(0, Math.min(1, (x - 355) / 245))), down = (p: V): V => [p[0], p[1], p[2] - dep(p[0])];
    /** the pocket's opening at (u, v), 0..1 from front to back and from the inner edge out, dz below the glass */
    const P = (u: number, v: number, dz = 0): V => { const q = mix(mix(A, B, v), mix(Dd, C, v), u); return m([q[0], q[1], q[2] + dz]); }, RV = 0.2;
    b.name('lampHousing').mat(DARK, 0.05); for (let i = 0; i < rimPts.length; i++) { const p = rimPts[i]!, q = rimPts[(i + 1) % rimPts.length]!; b.quad(p, q, down(q), down(p)); }
    b.name('lampTray').mat('#2c3038', 0.35); fan(b, rimPts.map(down), N);
    b.name('lampFin').mat(FRAME, 0.15); patch(b, (u, v) => P(u, v * RV, -dep(lerp(355, 600, u)) * v - 2), 3, 1, [0, sg, 1]);
    b.name('lampFin').mat('#3b3f47', 0.3); for (let k = 0; k < 6; k++) { const u = lerp(0.06, 0.72, k / 5), d = dep(lerp(355, 600, u)); face(b, P(u, 0.02, -3), P(u + 0.035, 0.02, -3), P(u + 0.035, RV - 0.02, -d + 4), P(u, RV - 0.02, -d + 4), [0, sg, 1]); }
    // the units: a face leaning back from the tray to just under the glass's back edge
    const W0 = 0.72, W1 = 0.98, F = (v: number, w: number, d = 0): V => { const u = lerp(W0, W1, w), p = P(u, v, lerp(-dep(lerp(355, 600, W0)) + 3, -7, w)); return [p[0] - d * 0.7, p[1], p[2] + d * 0.7]; }, NF: V = [-1, 0, 0.6];
    b.name('lampHousing').mat(DARK, 0.05); patch(b, (v, w) => F(lerp(RV, 0.98, v), w), 1, 1, NF);
    b.name('reflector').mat(SILVER, 0.75, 'metal'); patch(b, (v, w) => F(lerp(0.26, 0.6, v), lerp(0.08, 0.94, w), 2), 1, 1, NF);
    b.name('reflector').mat(LENS, 0.7); patch(b, (v, w) => F(lerp(0.28, 0.58, v), lerp(0.16, 0.86, w), 4), 1, 1, NF);
    b.name('reflector').mat('#a9adb2', 0.6); for (let k = 1; k < 7; k++) { const v = lerp(0.28, 0.58, k / 7); patch(b, (a, w) => F(v - 0.006 + 0.012 * a, lerp(0.16, 0.86, w), 5), 1, 1, NF); }
    b.name('reflector').mat(LENS, 0.7); patch(b, (v, w) => F(lerp(0.63, 0.96, v), lerp(0.16, 0.86, w), 3), 1, 1, NF);
    { const c = F(0.8, 0.52, 6), e1 = un(sub(F(0.9, 0.52, 6), F(0.7, 0.52, 6))), e2v = sub(F(0.8, 0.86, 6), F(0.8, 0.18, 6)), e2 = un(e2v), cr = cross(e1, e2), nn: V = cr[0] > 0 ? [-cr[0], -cr[1], -cr[2]] : cr;
      const r0 = Math.min(44, Math.hypot(e2v[0], e2v[1], e2v[2]) * 0.34), at = (r: number, t: number, d: number): V => [0, 1, 2].map(k => c[k]! + e1[k]! * r * Math.cos(t) + e2[k]! * r * Math.sin(t) + nn[k]! * d) as V, n10 = 10;
      b.name('reflector').mat(CHROME, 0.9, 'metal'); for (let i = 0; i < n10; i++) { const t0 = i / n10 * Math.PI * 2, t1 = (i + 1) / n10 * Math.PI * 2; face(b, at(r0, t0, 0), at(r0, t1, 0), at(r0 * 0.82, t1, 5), at(r0 * 0.82, t0, 5), nn); }
      b.name('lens').mat('#3a4048', 0.9, 'lens'); for (let i = 0; i < n10; i++) { const t0 = i / n10 * Math.PI * 2, t1 = (i + 1) / n10 * Math.PI * 2, q = [at(0, 0, 12), at(r0 * 0.82, t0, 5), at(r0 * 0.82, t1, 5)] as const; if (dot(cross(sub(q[1], q[0]), sub(q[2], q[0])), nn) >= 0) b.tri(q[0], q[1], q[2]); else b.tri(q[0], q[2], q[1]); } }
    b.name('headCover').mat(GLASS, 0.5, 'glass'); fan(b, rimPts, N);
    b.name('indicator').mat(AMBER, 0.7); fan(b, [CH[IB]![0]!, CH[IB + 1]![0]!, CH[IT]![0]!, TR(IT)[2]!, TR(IT)[1]!, TR(IT)[0]!].map(m), N);
    b.name('marker').mat(RED, 0.6); face(b, flank(1130, 702, sg), flank(1154, 702, sg), flank(1154, 724, sg), flank(1130, 724, sg), [0, sg, 0]); }

  // ---- the nose: the intakes' depths behind the bumper's openings and their bars, the horseshoe, the corner ducts, the badge ----
  { const k0 = NB + 2, k1 = NB + 5, back = (p: V): V => [p[0] + 75, p[1] * 0.96, p[2]];
    for (const sg of [1, -1]) { const m = (p: V) => mir(p, sg);
      b.name('grille').mat(DARK, 0.05, 'grille'); for (let i = 1; i < 6; i++) face(b, m(back(CH[i]![k0]!)), m(back(CH[i + 1]![k0]!)), m(back(CH[i + 1]![k1]!)), m(back(CH[i]![k1]!)), [-1, 0, 0]);
      b.name('grille').mat(DARK, 0.05); for (let i = 1; i < 6; i++) for (const k of [k0, k1]) face(b, m(CH[i]![k]!), m(CH[i + 1]![k]!), m(back(CH[i + 1]![k]!)), m(back(CH[i]![k]!)), [0, 0, k === k0 ? -1 : 1]);
      for (const i of [1, 6]) face(b, m(CH[i]![k0]!), m(CH[i]![k1]!), m(back(CH[i]![k1]!)), m(back(CH[i]![k0]!)), [0, i === 1 ? sg : -sg, 0]);
      b.name('bumperF').mat(PAINT, GLOSS, 'paint'); for (const k of [k0 + 1, k0 + 2]) for (let i = 1; i < 6; i++) { const z = CH[i]![k]![2], p = (r: number, dz: number, dx = 0): V => { const q = bump(sg * CH[r]![k]![1], z + dz); return [q[0] + dx, q[1], q[2]]; };
        face(b, p(i, -9), p(i + 1, -9), p(i + 1, 9), p(i, 9), [-1, 0, 0]); face(b, p(i, 9), p(i + 1, 9), p(i + 1, 9, 30), p(i, 9, 30), [0, 0, 1]); }
      b.name('grille').mat(DARK, 0.05, 'grille'); patch(b, (u, v) => bump(sg * lerp(700, 772, u), lerp(152, 280, v), 5), 2, 1, [-1, sg, 0]); }
    const shoe: [number, number][] = [[-34, 150], [-50, 225], [-48, 262], [-32, 284], [0, 292], [32, 284], [48, 262], [50, 225], [34, 150]], hs = (k: number, lift: number) => fan(b, shoe.map(([y, z]) => bump(y * k, 222 + (z - 222) * k, lift)), [-1, 0, 0]);
    b.name('grille').mat(PAINT, GLOSS, 'paint'); hs(1.14, 3); b.name('grille').mat(DARK, 0.05, 'grille'); hs(1, 6);
    b.name('badge').mat(RED, 0.5); fan(b, ([[-48, 0], [-30, 11], [30, 11], [48, 0], [30, -11], [-30, -11]] as const).map(([y, dx]) => top(165 + dx, y, 5)), UPV); }

  // ---- the flanks: the doors' edges, the curved vent behind the front wheel, the slot on the rear wing's top, the vent at the tail's corner ----
  for (const sg of [1, -1]) { b.name('door').mat(SEAM, 0.1);
    seamSide([[1520, 772], [1500, 650], [1462, 450], [1425, 305]], sg);                                                               // the front edge
    seamSide([[SP - 12, 786], [2500, 700], [2469, 561], [2425, 470], [2378, 400], [2320, 345], [2264, 305]], sg);                     // the back edge, sweeping down and forward
    seamSide([[1425, 302], [1700, 300], [2000, 300], [2264, 302]], sg, 7);                                                            // the foot
    b.name('grille').mat(DARK, 0.05); { const arc = (r: number, k: number): V => { const t = lerp(2, 66, k) * Math.PI / 180; return flank(FX + r * Math.cos(t), R + r * Math.sin(t), sg); }; for (let k = 0; k < 6; k++) face(b, arc(384, k / 6), arc(412, k / 6), arc(412, (k + 1) / 6), arc(384, (k + 1) / 6), [0, sg, 0]); }   /* the vent following the arch's rim */
    patch(b, (u, v) => { const x = lerp(2560, 2790, u); return top(x, sg * lerp(YE(x) + 22, lerp(YE(x), YR(x), 0.5 + 0.35 * (1 - u)), v)); }, 3, 1, UPV);        // the slot along the rear wing's top
    face(b, flank(4195, ZS(4195) + 22, sg), flank(4250, ZS(4250) + 22, sg), flank(4250, 500, sg), flank(4195, 500, sg), [0, sg, 0]); }                              // the tail's corner vent

  // ---- the glass's frames, the wiper ----
  { const strip = (ps: V[], to: V[], w: number) => { for (const sg of [1, -1]) { const e = ps.map((p, k) => { const d = un(sub(to[k]!, p)); return [mir([p[0], p[1] + 2.5, p[2] + 3.5], sg), mir([p[0] + d[0] * w, p[1] + d[1] * w + 2.5, p[2] + d[2] * w + 3.5], sg)] as [V, V]; }); for (let k = 0; k + 1 < e.length; k++) face(b, e[k]![0], e[k + 1]![0], e[k + 1]![1], e[k]![1], [0, sg * 0.5, 1]); } };
    b.name('screenFrame').mat(FRAME, 0.2); strip(sFoot, SCREEN[1]!, 34); strip(sTop, SCREEN[SCREEN.length - 2]!, 26);
    const cab = UP.slice(0, rP - rT + 1); strip(cab.map(r => r[7]!), cab.map(r => r[6]!), 24); strip(cab.map(r => r[6]!), cab.map(r => r[7]!), 20); strip(cab.map(r => r[6]!), cab.map(r => r[5]!), 10);
    { const r = cab[cab.length - 1]!; strip([r[6]!, r[7]!], [cab[cab.length - 2]![6]!, cab[cab.length - 2]![7]!], 34); }
    const sf = SIDEF.slice(rG - rC); strip(sf.map(r => r[2]!), sf.map(r => r[1]!), 24);
    b.name('wiper').mat(FRAME, 0.1); { const a = mix(SCREEN[0]![4]!, SCREEN[1]![4]!, 0.45), c = mix(SCREEN[0]![2]!, SCREEN[1]![2]!, 0.3); b.bar([a[0], -a[1], a[2] + 16], [c[0], c[1], c[2] + 16], 16, 10).bar([1120, 0, 800], [(a[0] + c[0]) / 2, (c[1] - a[1]) / 2, (a[2] + c[2]) / 2 + 16], 18, 10); } }

  // ---- behind the cabin: the buttress panel with its six sunk oval holes (two columns of three), cut into the slope itself ----
  for (const sg of [1, -1]) { const SL = 330, S = (x: number, f: number, d = 0): V => { const u = upper(x), t = u[6]!, e = u[7]!, q = mix(t, e, f), n = un(cross([1, 0, 0], sub(e, t))); return [x, sg * (q[1] - n[1] * d), q[2] - n[2] * d]; }, NS: V = [0, sg * 0.7, 0.7];
    const tri3 = (p: V, q: V, r: V) => { if (dot(cross(sub(q, p), sub(r, p)), NS) >= 0) b.tri(p, q, r); else b.tri(p, r, q); }, fr = [0, 0.29, 0.55, 1], fc = [0.155, 0.42, 0.7];
    for (const xs of [[2620, 2710, 2800], [2800, SC1, SC1 + 22, 2980]]) for (let r = 0; r < 3; r++) { const xa = xs[0]!, xb = xs[xs.length - 1]!, xc = (xa + xb) / 2, c: [number, number] = [xc, fc[r]!];
      const outer: [number, number][] = [...(r === 0 ? xs : [xa, xb]).map(x => [x, fr[r]!] as [number, number]), ...(r === 2 ? xs : [xa, xb]).slice().reverse().map(x => [x, fr[r + 1]!] as [number, number])];
      const inner: [number, number][] = Array.from({ length: 8 }, (_, k) => { const t = (k + 0.5) / 8 * Math.PI * 2; return [xc + 64 * Math.cos(t), c[1] + 0.105 * Math.sin(t)] as [number, number]; });
      const ang = (q: [number, number]) => Math.atan2((q[1] - c[1]) * SL, q[0] - c[0]), O = outer.slice().sort((p, q) => ang(p) - ang(q)), I = inner.slice().sort((p, q) => ang(p) - ang(q)), P3 = (q: [number, number]) => S(q[0], q[1]);
      b.name('buttress').mat(PAINT, GLOSS, 'paint'); let i = 0, k = 0; const A = (L2: [number, number][], n: number) => ang(L2[n % L2.length]!) + (n >= L2.length ? 2 * Math.PI : 0);
      while (i < O.length || k < I.length) { if (k >= I.length || (i < O.length && A(O, i + 1) <= A(I, k + 1))) { tri3(P3(O[i % O.length]!), P3(O[(i + 1) % O.length]!), P3(I[k % I.length]!)); i++; } else { tri3(P3(O[i % O.length]!), P3(I[(k + 1) % I.length]!), P3(I[k % I.length]!)); k++; } }
      b.name('louvre').mat(DEEP, 0.2); const m = S(xc + 8, c[1] + 0.02, 38); for (let n = 0; n < 8; n++) tri3(m, P3(I[n]!), P3(I[(n + 1) % 8]!)); } }
  b.name('engineCover').mat(FRAME, 0.1); for (let k = 0; k < 6; k++) { const x0 = 2775 + k * 150, us = [-0.9, -0.45, 0, 0.45, 0.9], yc = (x: number) => Math.min(450, 0.78 * YD(x)); for (let i = 0; i + 1 < us.length; i++) face(b, top(x0, us[i]! * yc(x0), 5), top(x0 + 64, us[i]! * yc(x0 + 64), 5), top(x0 + 64, us[i + 1]! * yc(x0 + 64), 5), top(x0, us[i + 1]! * yc(x0), 5), UPV); }

  // ---- the tail: a capsule of lamps a side (clear inboard, red, amber outboard, a red block low in it), six mesh slots across the top with two more
  //      at each side below, the plate's recess, the fog lamp on the valance, four pipes through the diffuser ----
  { const R1: V = [1, 0, 0], ZC0 = 700, HH = 60, cap = (lift: number, grow: number, y0: number, y1: number, endIn: boolean, endOut: boolean) => { for (const sg of [1, -1]) { patch(b, (u, v) => tail(sg * lerp(y0, y1, u), ZC0 + (HH + grow) * (2 * v - 1), lift), 2, 1, R1);
        for (const [on, yc, dir] of [[endIn, y0, -1], [endOut, y1, 1]] as const) if (on) { const r = HH + grow, pts = Array.from({ length: 6 }, (_, k) => { const t = -Math.PI / 2 + k / 5 * Math.PI; return tail(sg * (yc + dir * r * 0.9 * Math.cos(t)), ZC0 + r * Math.sin(t), lift); }); for (let k = 1; k + 1 < pts.length; k++) face(b, pts[0]!, pts[k]!, pts[k + 1]!, pts[k + 1]!, R1); } } };
    b.name('tailRim').mat(FRAME, 0.2); cap(3, 9, 512, 724, true, true);
    b.name('reverse').mat('#e9e4dc', 0.7); cap(7, 0, 512, 566, true, false);
    b.name('tail').mat(RED, 0.5, 'lens'); cap(7, 0, 566, 672, false, false);
    b.name('indicator').mat(AMBER, 0.7); cap(7, 0, 672, 724, false, true);
    b.name('tail').mat(RED2, 0.5, 'lens'); for (const sg of [1, -1]) patch(b, (u, v) => tail(sg * lerp(566, 660, u), lerp(636, 668, v), 10), 1, 1, R1);
    b.name('grille').mat(DARK, 0.05, 'grille'); for (let k = 0; k < 6; k++) { const y0 = -426 + k * 146; patch(b, (u, v) => tail(lerp(y0, y0 + 122, u), lerp(742, 770, v)), 1, 1, R1); }
    for (const sg of [1, -1]) for (const z of [690, 638]) patch(b, (u, v) => tail(sg * lerp(304, 426, u), z + v * 26), 1, 1, R1);
    b.name('wingBed').mat(FRAME, 0.1); patch(b, (u, v) => tail(lerp(-690, 690, u), lerp(806, 842, v)), 6, 1, R1);
    b.name('plate').mat('#16307a', 0.3); patch(b, (u, v) => tail(lerp(-250, 250, u), lerp(572, 668, v)), 2, 1, R1);
    b.name('plate').mat('#d9a514', 0.35); patch(b, (u, v) => tail(lerp(-222, 222, u), lerp(582, 658, v), 7), 2, 1, R1);
    b.name('tail').mat(RED2, 0.5, 'lens'); patch(b, (u, v) => [lerp(4285, 4318, v) + 5, lerp(-74, 74, u), ZS(lerp(4285, 4318, v)) - 5] as V, 1, 1, [1, 0, -1]);
    b.name('exhaust').mat(CHROME, 0.9, 'metal'); for (const sg of [1, -1]) for (const y of [225, 320]) b.lathe('x', [4262, sg * y, 372], [[-150, 44], [12, 44], [12, 36], [-140, 33]], 8, false); }   /* the GT's two pairs */

  // ---- the mirrors: heads standing out on upright stalks from the doors' top front corners ----
  for (const sg of [1, -1]) { const ring = (x: number, k: number): V[] => { const yc = 873, zc = 914, hw = 66 * k, hh = 50 * k; return ([[-1, -0.6], [-1, 0.6], [-0.6, 1], [0.6, 1], [1, 0.6], [1, -0.6], [0.6, -1], [-0.6, -1]] as const).map(([u, v]) => [x, sg * (yc + u * hw), zc + v * hh] as V); };
    b.name('mirror').mat(PAINT, GLOSS, 'paint').loft([ring(1640, 0.55), ring(1676, 0.92), ring(1750, 1), ring(1784, 0.96)]).bar([1700, sg * 790, 775], [1712, sg * 826, 880], 52, 26);
    b.name('mirror').mat(CHROME, 0.9, 'metal'); const r = ring(1787, 0.84); for (let i = 1; i + 1 < r.length; i++) b.tri(r[0]!, r[i]!, r[i + 1]!); }

  // ---- the wing (GT): the tail's trailing blade in its dark bed; raised, it stands on two struts, its trailing edge up ----
  { const x0 = 4085, xe = (y: number) => S1 + 30 * (1 - (Math.abs(y) / YE(S1)) ** 2.5) - 12, xp = 4240, zp = zTop(xp, 0), a = 10 * wing * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), lift = 110 * wing;
    const T = (p: V): V => { const dx = p[0] - xp, dz = p[2] - zp; return [xp + dx * ca - dz * sa, p[1], zp + dx * sa + dz * ca + lift]; };
    b.name('wing').mat(FRAME, 0.1); for (let i = 0; i < 8; i++) { const y0 = lerp(-690, 690, i / 8), y1 = lerp(-690, 690, (i + 1) / 8); for (const [u0, u1] of [[0, 0.5], [0.5, 1]] as const) { const x = (y: number, u: number) => lerp(4040, xe(y) - 6, u); face(b, top(x(y0, u0), y0, 3), top(x(y0, u1), y0, 3), top(x(y1, u1), y1, 3), top(x(y1, u0), y1, 3), UPV); } }
    b.name('wing').mat(PAINT, GLOSS, 'paint').loft([-725, -600, -450, -300, -150, 0, 150, 300, 450, 600, 725].map(y => { const x1 = xe(y), xm = (x0 + x1) / 2; return ([[x0, -4], [x0 + 28, 6], [xm, 9], [x1 - 26, 8], [x1, 2], [xm, -12]] as const).map(([x, dz]) => T([x, y, zTop(x, Math.min(Math.abs(y), 700)) + dz])); }));
    if (wing > 0.02) { b.name('wing').mat(FRAME, 0.2); for (const y of [-576, 576]) b.bar([xp, y, zTop(xp, y) - 12], T([xp, y, zTop(xp, y) - 8]), 54, 16); } }

  for (const s of [1, -1] as const) { wheel(b, FX, s, spin); wheel(b, RX, s, spin); }
  return b.mesh(L); }
export const mesh = eb110Mesh;
