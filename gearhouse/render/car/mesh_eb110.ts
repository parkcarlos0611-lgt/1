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
const ZH = curve([[142, 428], [236, 478], [331, 524], [425, 565], [520, 607], [614, 648], [709, 692], [803, 730], [898, 758], [990, 776], [1085, 789], [XC, 795]]);
/** the bonnet's plateau: its height at (x, y), a slight crown */
const zHood = (x: number, y: number) => ZH(x) - 24 * (y / 630) ** 2;
/** the roof's and the deck's centre line */
const ZC = curve([[XT, 1094], [2060, 1104], [2124, 1108], [2266, 1115], [2361, 1118], [2502, 1115], [2644, 1110], [2786, 1097], [2928, 1082], [3070, 1066], [3211, 1048], [3353, 1027], [3495, 1003], [3637, 975], [3778, 949], [3950, 925], [4150, 898], [4300, 872], [4400, 852]]);
/** half the width at the widest line (the sheet's plan), and that line's height */
const WID = curve([[XJ, 880], [800, 888], [1000, 896], [1200, 908], [1500, 908], [2100, 925], [2400, 934], [2600, 954], [2800, 963], [3000, 975], [3200, 970], [3600, 965], [3800, 960], [4000, 950], [4100, 930], [4200, 890], [4300, 838], [S1, 826]]);
const ZW = curve([[XJ, 450], [FX, 500], [2000, 520], [3000, 590], [RX, 620], [4100, 600], [S1, 560]]);
/** the sill (rising behind the rear wheel: the diffuser), and how far it stands in from the widest line */
const ZS = curve([[XJ, 100], [760, 118], [1400, 122], [RX, 128], [3960, 150], [4015, 215], [4150, 262], [4250, 340], [S1, 440]]);
const UND = curve([[XJ, 45], [2400, 55], [3640, 45], [S1, 25]]);
/** E: the bonnet's edge, then the side glass's foot (the belt), then the foot of the buttress's slope */
const YE = curve([[440, 616], [600, 616], [XC, 652], [1392, 672], [XG, 688], [2000, 695], [SP, 700], [2800, 745], [3200, 790], [3600, 800], [4000, 800], [S1, 808]]);
const ZEB = curve([[XC, zHood(XC, 652)], [1392, 781], [XG, 791], [2000, 792], [SP, 806], [2800, 850], [3200, 885], [3600, 895], [4000, 872], [S1, 800]]);
const ZE = (x: number) => x <= XC ? zHood(x, YE(x)) : ZEB(x);
/** F: the foot of the wall that drops from the bonnet's edge into the trough (its height below the edge) */
const WALL = curve([[440, 0], [490, 14], [545, 30], [600, 42], [XJ, 40], [767, 30], [858, 16], [949, 6], [FX, 0]]);
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
const BUMP: [number, number, number][] = [[385, 116, 880], [285, 66, 877], [235, 44, 873], [185, 36, 867], [130, 36, 858], [108, 46, 850], [100, 64, 835]];
const NB = 5, NL = BUMP.length, NK = NB + NL;                             // the chain's cells from the crest to the widest line, and below it
/** a point of the bumper's face at (y, z) (z between 100 and 428), for what is laid on it */
const BXF = curve(([[100, 64], [108, 46], [130, 36], [185, 36], [235, 44], [285, 66], [385, 116], [428, 142]] as [number, number][])), BW = curve([[100, 835], [108, 850], [130, 858], [185, 867], [235, 873], [285, 877], [385, 880], [450, 880]]);
const bump = (y: number, z: number, lift = 0): V => { const f = Math.min(0.999, Math.abs(y) / BW(z)), xf = BXF(z), x = xf + (XJ - xf) * (1 - (1 - f ** 2.6) ** (1 / 2.6)); return [x - lift * (1 - 0.6 * f), y + Math.sign(y) * lift * 0.8 * f, z]; };

/** the arc from the crest (or the indicator's edge) R down to the widest line H: g 0 a straight band (the nose's middle), 1 the wing's roll */
function band(Rp: V, H: V, g: number, t: number): V { const dz = Rp[2] - H[2], P1 = mix(mix(Rp, H, 1 / 3), [lerp(Rp[0], H[0], 0.6), lerp(Rp[1], H[1], 0.6), Rp[2] - 0.12 * dz], g), P2 = mix(mix(Rp, H, 2 / 3), [H[0], H[1], H[2] + 0.45 * dz], g), v = 1 - t;
  return [0, 1, 2].map(k => v * v * v * Rp[k]! + 3 * v * v * t * P1[k]! + 3 * v * t * t * P2[k]! + t * t * t * H[k]!) as V; }
/** the stations behind the nose: every 18 degrees round an arch, about 100 mm apart between */
const arcS = (hx: number, ra: number) => [...Array.from({ length: 11 }, (_, k) => Math.round(hx - ra * Math.cos(k * 18 * Math.PI / 180))), hx + ra + 2];
const SS = [XJ, ...arcS(FX, RAF), 1470, XG, 1700, 1845, XT, 2100, 2210, 2320, 2430, SP, 2620, 2710, 2800, SC1, SC1 + 22, 3010, 3120, RX - RAR - 2, ...arcS(RX, RAR), 4050, 4130, 4200, 4260, 4300, S1];
const ROWX = [...CREST.map(c => c[0]), ...SS], NR = ROWX.length;          // every row's place on the crest (the nose's rows, then the stations)
const rowOf = (x: number) => { const i = ROWX.indexOf(x, NCR); if (i < 0) throw new Error(`eb110: no station at ${x}`); return i; };

/** the outer chain of a row: NK + 1 points from the crest R (k 0) over the widest line (k NB) to the sill or the arch's lip (k NK) */
function chain(i: number): V[] {
  if (i <= NCR) { const f = FR[i]!, [cx, cy] = i < NCR ? CREST[i]! : [XJ, YR(XJ)], Rp: V = [cx, cy, i <= IT ? zHood(cx, cy) : ZR(cx)], [hx, hy] = sup(142, 880, f), H: V = [hx, hy, 428 + 22 * f * f];
    const g = Math.max(0.1, sm(420, 760, cy)), out: V[] = []; for (let k = 0; k <= NB; k++) out.push(band(Rp, H, g, k / NB));
    for (const [z, xf, w] of BUMP) { const [x, y] = sup(xf, w, f); out.push([x, y, z]); } return out; }
  const x = ROWX[i]!, w = WID(x), zW = ZW(x), zS = ZS(x), Rp: V = [x, YR(x), ZR(x)], H: V = [x, w, zW], yAt = (z: number) => w - UND(x) * ((zW - z) / (zW - zS)) ** 2, az = archZ(x), out: V[] = [];
  if (az > 0) { const at = (tau: number): V => tau <= 1 ? band(Rp, H, 1, tau) : [x, yAt(lerp(zW, zS, tau - 1)), lerp(zW, zS, tau - 1)]; let lo = 0, hi = 2; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (at(m)[2] > az) lo = m; else hi = m; }
    for (let k = 0; k <= NK; k++) out.push(at(lo * k / NK)); return out; }
  for (let k = 0; k <= NB; k++) out.push(band(Rp, H, 1, k / NB));
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
  const cells = (P: V[][], pick: (i: number, j: number) => boolean = () => true, keep?: Tri[]) => { for (let i = 0; i + 1 < P.length; i++) for (let j = 0; j + 1 < Math.min(P[i]!.length, P[i + 1]!.length); j++) { if (!pick(i, j)) continue;
    const q = [P[i]![j]!, P[i + 1]![j]!, P[i + 1]![j + 1]!, P[i]![j + 1]!] as [V, V, V, V], nn = (p: V, r: V, s: V) => un(cross(sub(r, p), sub(s, p))), alt = dot(nn(q[0], q[1], q[2]), nn(q[0], q[2], q[3])) < dot(nn(q[1], q[2], q[3]), nn(q[1], q[3], q[0])) - 1e-9;
    const ts: Tri[] = alt ? [[q[1], q[2], q[3]], [q[1], q[3], q[0]]] : [[q[0], q[1], q[2]], [q[0], q[2], q[3]]];
    for (const t of ts) { const c = cross(sub(t[1], t[0]), sub(t[2], t[0])); if (Math.hypot(c[0], c[1], c[2]) < 0.5) continue; keep?.push(t); b.tri(t[0], t[1], t[2]); b.tri(mir(t[0], -1), mir(t[2], -1), mir(t[1], -1)); } } };

  // ---- the points ----
  const CH = Array.from({ length: NR }, (_, i) => chain(i));                                             // the outer chains
  /** the trough beside the bonnet: the bonnet's edge E, the wall's foot F, the floor's middle M (rows from the indicator's tip back) */
  const TR = (i: number): V[] => { const x = ROWX[i]!, yE = YE(x), zE = ZE(x), h = WALL(x), Rp = CH[i]![0]!, F: V = [x, yE + (h > 0 ? 10 : 6), zE - h], M = mix(F, Rp, 0.5); M[2] -= 7 * sm(440, 520, x) * (1 - sm(900, 1300, x)); return [[x, yE, zE], F, M, Rp]; };
  const r6 = NCR - 2, rC = rowOf(XC), rT = rowOf(XT), rG = rowOf(XG), rP = rowOf(SP), rM = rowOf(SC1);
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
  b.name('door').mat(PAINT, GLOSS, 'paint'); cells(chainRows(rG - 1, rP), undefined, SIDE); cells(trRows(rG - 1, rP), undefined, TOP);
  b.name('quarter').mat(PAINT, GLOSS, 'paint'); cells(chainRows(rP, NR - 1), (i, j) => !(rP + i === rM && j >= NB + 2 && j < NB + 5), SIDE); cells(trRows(rP, NR - 1), undefined, TOP);
  b.name('grille').mat(DARK, 0.05); cells(chainRows(rM, rM + 1), (_, j) => j >= NB + 2 && j < NB + 5);                 // the side intake's mouth: the recess's slanting end
  const iE0 = rowOf(2710) - rT, iE1 = rowOf(Math.round(RX - RAR * Math.cos(108 * Math.PI / 180))) - rT, isCover = (i: number, j: number) => i >= iE0 && i < iE1 && j < 3;
  b.name('roof').mat(PAINT, GLOSS, 'paint'); cells(UP, (i, j) => (j < 6 || rT + i >= rP) && !isCover(i, j), TOP);
  b.name('engineCover').mat(GLASS, 0.5, 'glass'); cells(UP, isCover);
  b.name('screenPane').mat(GLASS, 0.5, 'glass'); cells(SCREEN, undefined, TOP);
  b.name('sidePane').mat(GLASS, 0.5, 'glass'); cells(UP, (i, j) => j === 6 && rT + i < rP); cells(SIDEF, (i, j) => j === 1 && rC + i >= rG);
  b.name('screenFrame').mat(FRAME, 0.2); cells(SIDEF, (i, j) => j === 0 || rC + i < rG);

  // where the skin is: its height at (x, y) on top, its distance from the centre line at (x, z) on the flank
  const zTop = (x: number, y: number) => { const z = probe(TOP, 0, 1, 2, x, y, false); if (Number.isNaN(z)) throw new Error(`eb110: no skin at ${x}, ${y}`); return z; };
  const ySide = (x: number, z: number) => { const y = probe(SIDE, 0, 2, 1, x, z, false); if (Number.isNaN(y)) throw new Error(`eb110: no flank at ${x}, ${z}`); return y; };
  const top = (x: number, y: number, lift = 4): V => [x, y, zTop(x, y) + lift], flank = (x: number, z: number, sg: number, lift = 4): V => [x, sg * (ySide(x, z) + lift), z];
  const UPV: V = [0, 0, 1];
  const seamSide = (pts: [number, number][], sg: number, t = 9) => { const e = pts.map(([x, z], i) => { const a = pts[Math.max(0, i - 1)]!, c = pts[Math.min(pts.length - 1, i + 1)]!, l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1, nx = -(c[1] - a[1]) / l * t / 2, nz = (c[0] - a[0]) / l * t / 2; return [flank(x + nx, z + nz, sg, 3), flank(x - nx, z - nz, sg, 3)] as [V, V]; });
    for (let i = 0; i + 1 < e.length; i++) face(b, e[i]![0], e[i + 1]![0], e[i + 1]![1], e[i]![1], [0, sg, 0]); };

  // ---- the tail: the panel leaning back to its foot (the crease over the valance), the black valance, the floor and the diffuser ----
  const LEAN = 40, ZF = ZW(S1), tailTop = [...UP[UP.length - 1]!, ...CH[NR - 1]!.slice(0, NB + 1)], NT = tailTop.length, yFoot = WID(S1);
  const footX = (y: number) => S1 + 30 * (1 - (Math.abs(y) / yFoot) ** 2.5) + LEAN;
  const TAIL: V[][] = [0, 0.5, 1].map(v => tailTop.map((p, j) => { const y = j <= 5 ? p[1] : lerp(tailTop[5]![1], yFoot, ((j - 5) / (NT - 6)) ** 0.8), f: V = j === NT - 1 ? p : [footX(y), y, ZF]; return mix(p, f, v); }));
  b.name('tailPanel').mat(PAINT, GLOSS, 'paint'); cells(TAIL);
  /** a point of the tail panel at (y, z), set off it by lift */
  const tail = (y: number, z: number, lift = 4): V => { const ay = Math.min(Math.abs(y), YD(S1)), xt = S1 + 30 * (1 - (ay / YE(S1)) ** 2.5), zt = ZC(xt) - 14 * (ay / YD(S1)) ** 2; return [lerp(xt, footX(y), Math.max(0, Math.min(1, (zt - z) / (zt - ZF)))) + lift, y, z]; };
  b.name('valance').mat(DARK, 0.05); { const ys = [0, 200, 400, 600, 740, yFoot], lo = (y: number): V => [S1 + 20 * (1 - (y / yFoot) ** 2.5), Math.min(y, yFoot - UND(S1)), ZS(S1)]; cells([0, 0.5, 1].map(v => ys.map(y => mix([footX(y), y, ZF], lo(y), v)))); }
  b.name('chassis').mat(DARK, 0.05); for (let i = 0; i + 1 < NR; i++) { const az0 = archZ(ROWX[i]!) > 0 && i > NCR, az1 = archZ(ROWX[i + 1]!) > 0 && i + 1 > NCR, yin = ROWX[i]! < 2400 ? YINF : YINR;
    const pt = (r: number, arch: boolean): V => arch ? [ROWX[r]!, yin, ZS(ROWX[r]!)] : CH[r]![NK]!, p = pt(i, az0), q = pt(i + 1, az1), cx = (r: number) => r < NCR ? 64 : ROWX[r]!;
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
  { const FL = 150, xa = XC + 40, xb = SP - 6, ring = UP[rP - rT]!;
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

  for (const s of [1, -1] as const) { wheel(b, FX, s, spin); wheel(b, RX, s, spin); }
  void [seamSide, top, flank, tail, bump, patch, fan, AMBER, RED, RED2, LENS, CHROME, SEAM, DEEP, r6, wing, WYF];
  return b.mesh(L); }
export const mesh = eb110Mesh;
