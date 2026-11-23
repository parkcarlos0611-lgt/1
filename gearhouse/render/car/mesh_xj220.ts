// The 1992 Jaguar XJ220 as a low-polygon mesh: the long, low, flowing silver coupé with the cabin set forward under a
// wraparound screen, the louvred engine cover in the fastback, the blade-shaped side intakes, the full-width tail wing.
//
// Real figures (and where they are from):
//   length 4930, wheelbase 2640, height 1150 mm    auto-data.net, Wikipedia, conceptcarz (all agree)
//   width 2009 mm over the body, 2220 over mirrors  Wikipedia (2009 without mirrors), vehiclesizes.com (2220 mirrors out);
//                                                   others round the body to 2000 or 2007
//   track 1710 front / 1588 rear                    encycarpedia (autoboom: 1710 / 1590; ultimatecarpage says 1650 / 1650,
//                                                   which does not fit the staggered tyres: the first pair is used)
//   tyres 255/45 ZR17 front, 345/35 ZR18 rear       Wikipedia, wheel-size.com: 661 and 699 mm across, 255 and 345 wide
//   overhangs, ground clearance                     no source found: both are read off the sheet (front 1285, rear 1005,
//                                                   about 100 mm under the sills)
// Shapes read off the user's sheet (docs/reference/eb110_xj220_sheet.png, right column), in its pixels: X() and Z() turn
// the side view into mm (the sheet's wheelbase is drawn 3 % long, so the span between the axles is closed up to 2640 and
// the overhangs keep the rest), Y() the plan (its body is drawn 5 % wide for its mirrors: scaled to 2009). From the side
// view: the silhouette, the belt, the sills, the arches, the door's shut lines, the intake's outline, the fillers, the
// mirrors. From the plan: the half-widths, the screen's base arc, the side glass, the roof, the louvred cover, the lamp
// covers. From the front and rear views: the mouth, the indicators, the tail panel, lamps, exhausts and the wing's gap.
// Under the car: a dark flat floor, two venturi tunnels rising between a keel and the outer blocks at the back.
import { Build, type Kind, type Mesh, type V } from './mesh';

const PAINT = '#b9bcc4', DARK = '#17181c', TRIM = '#2a2c33', RUBBER = '#222127', GLASS = '#a9c2cc', ALLOY = '#cdd0d6', CHROME = '#c9cbcf', LEATHER = '#5a6170', AMBER = '#e8902a', RED = '#c2282a', LINE = '#6c6f78';
const L = 4930, WB = 2640, EDGE = 14, KO = (2290 - 2 * EDGE) / 840.5, FX = EDGE + 471.5 * KO, RX = FX + WB, KW = WB / 1001.5;
const WYF = 855, WYR = 794, RF = 331, RR = 349, TWF = 255, TWR = 345, RIMF = 216, RIMR = 229, RAF = 372, RAR = 390, YINF = 705, YINR = 600;
/** the sheet's side view, pixels to mm: along the car (the span between the axles closed up to the real wheelbase), up from the ground; the plan's half-widths */
const X = (px: number) => px < 481.5 ? EDGE + (px - 10) * KO : px < 1483 ? FX + (px - 481.5) * KW : RX + (px - 1483) * KO;
const Z = (row: number) => (426 - row) * 1150 / 416;
const Y = (px: number) => px * 1004.5 / 396;
type T2 = [number, number][];
const tab = (t: T2, fx: (v: number) => number, fv: (v: number) => number): T2 => t.map(([x, v]) => [fx(x), fv(v)]);
const at = (t: T2, x: number) => { if (x <= t[0]![0]) return t[0]![1]; for (let i = 1; i < t.length; i++) if (x <= t[i]![0]) { const [x0, v0] = t[i - 1]!, [x1, v1] = t[i]!; return v0 + (v1 - v0) * (x - x0) / (x1 - x0); } return t[t.length - 1]![1]; };
const same = (v: number) => v;
// ---- the body along the car (sheet pixels): plan half-width; the crest of the wings (the side view's silhouette away
// from the cabin); the centre line (the bonnet lies below the wings, the deck drops under the tail wing); the underside
// (rising at the back: the diffuser); the height of the greatest width; how square the section is; where across the crest rises
const HALF = tab([[10, 91], [16, 137], [22, 150], [28, 174], [34, 202], [40, 220], [52, 242], [70, 276], [112, 316], [152, 340], [192, 357], [232, 370], [272, 380], [312, 387], [352, 394], [512, 394], [552, 387], [592, 382], [752, 381], [1032, 381], [1072, 391], [1232, 393], [1352, 396], [1552, 396], [1592, 392], [1632, 385], [1672, 377], [1712, 370], [1752, 359], [1792, 336], [1804, 323], [1816, 291], [1822, 274], [1828, 253], [1834, 225], [1840, 182], [1846, 150], [1852, 112]], X, Y);
const WING = tab([[10, 345], [16, 300], [22, 286], [28, 277], [40, 266], [60, 254], [100, 234], [140, 208], [180, 188], [220, 174], [260, 162], [300, 151], [340, 142], [380, 136], [420, 131], [500, 127], [600, 124], [760, 128], [1120, 114], [1265, 96], [1400, 88], [1500, 82], [1700, 82], [1740, 79], [1780, 73], [1852, 73]], X, Z);
const CEN = tab([[10, 345], [16, 300], [22, 288], [40, 270], [100, 240], [180, 204], [260, 180], [340, 160], [392, 142], [480, 138], [1100, 140], [1300, 100], [1500, 84], [1620, 85], [1700, 95], [1760, 112], [1852, 122]], X, Z);
const BOT = tab([[10, 372], [16, 382], [28, 388], [46, 391], [1560, 391], [1620, 382], [1700, 357], [1780, 340], [1820, 318], [1852, 292]], X, Z);
const ZW = tab([[10, 360], [22, 335], [100, 310], [300, 250], [500, 236], [700, 262], [1100, 270], [1300, 245], [1500, 225], [1700, 205], [1852, 190]], X, Z);
const NN = tab([[10, 2.6], [200, 3.0], [380, 4.4], [600, 5], [1150, 5], [1350, 5.5], [1650, 5.5], [1852, 6]], X, same);
const U0 = tab([[10, 0.3], [600, 0.3], [1300, 0.4], [1600, 0.6], [1852, 0.72]], X, same), U1 = tab([[10, 0.7], [600, 0.7], [1300, 0.8], [1600, 0.9], [1852, 0.92]], X, same);
// ---- the canopy (screen, side glass, roof, the fastback over the engine): its foot's half-width on the body, the half-
// width of its top (the A-pillar and the roof's edge), the centre line's height, the edge's height
const WG = tab([[392, 0], [397, 62], [407, 110], [425, 150], [448, 195], [508, 256], [612, 300], [700, 318], [762, 320], [1062, 320], [1150, 300], [1227, 265], [1300, 248], [1400, 240], [1500, 234], [1582, 215]], X, Y);
const WR = tab([[392, 0], [397, 62], [407, 110], [425, 150], [448, 195], [508, 256], [612, 300], [817, 192], [1062, 210], [1150, 235], [1227, 262], [1300, 232], [1540, 226], [1582, 205]], X, Y);
const ZR = tab([[392, 141], [540, 116], [817, 33], [860, 24], [900, 16], [940, 10], [1060, 10], [1100, 16], [1180, 21], [1220, 27], [1260, 36], [1340, 44], [1420, 56], [1460, 67], [1500, 80], [1582, 82]], X, Z);
const CANT = tab([[612, 128], [817, 45], [1062, 26], [1150, 45], [1227, 76], [1300, 84], [1500, 86], [1582, 84]], X, Z);
const C0 = X(650), C1 = X(1090), FLOOR = 190, XS0 = X(392), XS1 = X(612), XRF = X(817), XRB = X(1067), XQ = X(1227), XL0 = X(1252), XL1 = X(1582), XD0 = X(672), XD1 = X(1120);

interface Sec { w: number; zb: number; zw: number; n: number; cen: number; wing: number; u0: number; u1: number }
const sec = (x: number): Sec => { const zb = at(BOT, x), cen = at(CEN, x), wing = at(WING, x), lo = Math.min(cen, wing); return { w: at(HALF, x), zb, zw: Math.max(zb + 0.25 * (lo - zb), Math.min(zb + 0.8 * (lo - zb), at(ZW, x))), n: at(NN, x), cen, wing, u0: at(U0, x), u1: at(U1, x) }; };
const topZ = (s: Sec, u: number) => { const k = Math.min(1, Math.max(0, (u - s.u0) / (s.u1 - s.u0))), zt = s.cen + (s.wing - s.cen) * k * k * (3 - 2 * k); return s.zw + (zt - s.zw) * Math.max(0, 1 - u ** s.n) ** (1 / s.n); };
/** the lower flank: from the greatest width down, tucked under to the floor's edge */
const lower = (s: Sec): [number, number][] => [[s.w, s.zw], [0.985 * s.w, (s.zw + s.zb) / 2], [0.94 * s.w, s.zb + Math.min(45, 0.3 * (s.zw - s.zb))], [0.84 * s.w, s.zb]];
/** the skin's height at (x, y); its half-width at height z (the outermost point of the section there) */
const skin = (x: number, y: number) => { const s = sec(x); return topZ(s, Math.min(1, Math.abs(y) / s.w)); };
const outU = (s: Sec, z: number) => { let p = 1; for (let u = 0.99; u >= 0; u -= 0.01) { const a = topZ(s, u); if (a >= z) { const b = topZ(s, p); return a === b ? u : u + (p - u) * (a - z) / (a - b); } p = u; } return 0; };
const sideY = (x: number, z: number) => { const s = sec(x); if (z >= s.zw) return s.w * outU(s, z); const P = lower(s); for (let i = 1; i < P.length; i++) if (z >= P[i]![1]) { const [y0, z0] = P[i - 1]!, [y1, z1] = P[i]!; return y0 + (y1 - y0) * (z0 - z) / (z0 - z1 || 1); } return 0; };
/** how far back the nose's face lies at (y, z); how far forward the tail's */
const frontX = (y: number, z: number) => { for (let x = EDGE; x < 900; x += 3) if (z >= at(BOT, x) && sideY(x, z) >= Math.abs(y)) return x; return 900; };
const rearX = (y: number, z: number) => { for (let x = L - EDGE; x > L - 900; x -= 3) if (z >= at(BOT, x) && sideY(x, z) >= Math.abs(y)) return x; return L - 900; };
const archZ = (x: number) => { for (const [hx, r, ra] of [[FX, RF, RAF], [RX, RR, RAR]] as const) { const dx = x - hx; if (Math.abs(dx) <= ra + 1e-6) return r + Math.sqrt(Math.max(0, ra * ra - dx * dx)); } return 0; };
/** the line across the body that follows the glass's foot (the body's rings carry a point on it) */
const YC: T2 = [[X(10), 60], [X(100), 330], [X(300), 300], [X(385), 40]];
for (const px of [392, 397, 407, 425, 448, 475, 508, 560, 612, 700, 762, 1062, 1150, 1227, 1300, 1400, 1500, 1582]) YC.push([X(px), Math.max(40, at(WG, X(px)) - 30)]);
YC.push([X(1700), 420], [L, 200]);
const KO_ = 8;   // points round the shoulder
/** half a body section at x, from the centre line over the top, down the flank, to the centre of the floor: [y, z] */
function half(x: number, pit: boolean): [number, number][] { const s = sec(x), yc = Math.min(0.62 * s.w, at(YC, x)), uc = yc / s.w, arch = archZ(x), yin = x < 2500 ? YINF : YINR, out: [number, number][] = [];
  if (pit) out.push([0, FLOOR], [yc / 2, FLOOR], [yc, FLOOR]); else out.push([0, topZ(s, 0)], [yc / 3, topZ(s, uc / 3)], [yc * 2 / 3, topZ(s, uc * 2 / 3)]);
  const ua = arch > s.zw ? Math.max(uc + 0.02, outU(s, arch)) : 1, tc = Math.acos(uc ** (s.n / 2)), ta = Math.acos(Math.min(1, ua ** (s.n / 2)));
  for (let k = 0; k <= KO_; k++) { const t = tc + (ta - tc) * k / KO_, u = k === 0 ? uc : k === KO_ ? ua : Math.cos(t) ** (2 / s.n); out.push([u * s.w, topZ(s, u)]); }
  if (arch) { const ya = arch > s.zw ? ua * s.w : sideY(x, arch); if (arch <= s.zw) out.push([ya, arch]); else out.push([(ya + yin) / 2, arch]); out.push([yin, arch], [yin, s.zb]); }
  else out.push(...lower(s).slice(1));
  out.push([0, s.zb]); return out; }
/** half the canopy's section at x: across the top to its edge, down the side glass to the foot */
function canopy(x: number): [number, number][] { const wg = at(WG, x), wr = Math.min(wg, at(WR, x)), zr = at(ZR, x), foot = skin(x, wg) - 12, cant = Math.min(zr, Math.max(x < XS1 ? 0 : at(CANT, x), foot + 15)), out: [number, number][] = [];
  for (const u of [0, 0.35, 0.65, 0.87, 1]) out.push([u * wr, cant + (zr - cant) * Math.max(0, 1 - u ** 2.4) ** (1 / 2.4)]);
  out.push([wr + (wg - wr) * 0.58, cant + (foot - cant) * 0.45], [wg, foot]); return out; }
const canZ = (x: number, y: number) => { const P = canopy(x), a = Math.abs(y); for (let i = 1; i < P.length; i++) if (a <= P[i]![0]) { const [y0, z0] = P[i - 1]!, [y1, z1] = P[i]!; return z0 + (z1 - z0) * (a - y0) / (y1 - y0 || 1); } return P[P.length - 1]![1]; };

type Mat = [name: string, colour: string, gloss: number, kind: Kind];
const MATS: Record<string, Mat> = { body: ['body', PAINT, 0.6, 'paint'], hood: ['hood', PAINT, 0.6, 'paint'], fenderF: ['fenderF', PAINT, 0.6, 'paint'], fenderR: ['fenderR', PAINT, 0.6, 'paint'], door: ['door', PAINT, 0.6, 'paint'], sill: ['sill', PAINT, 0.6, 'paint'],
  bumperF: ['bumperF', PAINT, 0.6, 'paint'], bumperR: ['bumperR', PAINT, 0.6, 'paint'], cockpit: ['cockpit', DARK, 0.05, 'plain'], chassis: ['chassis', DARK, 0.05, 'plain'], glass: ['screenPane', GLASS, 0.5, 'glass'], louvre: ['grille', DARK, 0.1, 'plain'] };
/** quads gathered by material, laid down one part each */
class Bins { private q = new Map<string, V[][]>(); add(k: string, a: V, b: V, c: V, d: V) { let l = this.q.get(k); if (!l) this.q.set(k, l = []); l.push([a, b, c, d]); }
  flush(b: Build) { for (const [k, l] of this.q) { const m = MATS[k]!; b.name(m[0]).mat(m[1], m[2], m[3]); for (const [p, q, r, s] of l) b.quad(p!, q!, r!, s!); } } }

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
/** a flat patch from a loop of points (a fan about their middle) */
function fan(b: Build, P: V[], lift: V = [0, 0, 0]): void { const m: V = [0, 0, 0]; for (const p of P) { m[0] += p[0] / P.length; m[1] += p[1] / P.length; m[2] += p[2] / P.length; } const c: V = [m[0] + lift[0], m[1] + lift[1], m[2] + lift[2]]; for (let i = 0; i < P.length; i++) b.tri(c, P[i]!, P[(i + 1) % P.length]!); }
/** a point on the flank at sheet (px, row), `out` mm proud of the skin; a line of bars through such points */
const onSide = (s: number, px: number, row: number, out = 3): V => { const x = X(px), z = Z(row); return [x, s * (sideY(x, z) + out), z]; };
const line = (b: Build, P: V[], t: number, t2 = t) => { for (let i = 0; i + 1 < P.length; i++) b.bar(P[i]!, P[i + 1]!, t, t2); };

function wheel(b: Build, hx: number, s: 1 | -1, spin: number) { const front = hx === FX, R = front ? RF : RR, TW = front ? TWF : TWR, rim = front ? RIMF : RIMR, wy = front ? WYF : WYR, o: V = [hx, s * wy, R], f = s * TW / 2, nm = front ? 'tyreF' : 'tyreR';
  b.name(nm).mat(RUBBER, 0.05, 'tyre').lathe('y', o, [[-TW / 2, rim], [-TW / 2, R - 34], [-TW / 2 + 30, R], [TW / 2 - 30, R], [TW / 2, R - 34], [TW / 2, rim]], 24, false);
  b.name('wheel').mat(DARK, 0.05).lathe('y', o, [[f * 0.3, 0], [f * 0.3, rim]], 24, false).lathe('y', o, [[f * 0.3, rim - 2], [f * 0.98, rim - 2]], 24, false);
  b.name('rim').mat(CHROME, 0.9, 'metal').lathe('y', o, [[f * 1.0, rim + 5], [f * 1.03, rim - 2], [f * 0.94, rim - 20]], 24, false);
  // the plain flat disc, dished a little to the centre cap; five small round holes
  const yf = (r: number) => f * (0.94 - 0.05 * (rim - 20 - r) / (rim - 20) + (r < 62 ? 0.07 * (1 - r / 62) : 0));
  b.name('spoke').mat(ALLOY, 0.7, 'metal').lathe('y', o, [rim - 20, rim * 0.72, rim * 0.42, 62].map(r => [yf(r), r] as [number, number]), 24, false);
  b.name('hub').mat(ALLOY, 0.8, 'metal').lathe('y', o, [[yf(62), 62], [yf(62) + s * 14, 52], [yf(62) + s * 20, 24], [yf(62) + s * 20, 0]], 14, false);
  b.name('hub').mat(TRIM, 0.3).lathe('y', o, [[yf(62) + s * 21, 22], [yf(62) + s * 21, 0]], 10, false);
  b.name('wheelHole').mat(DARK, 0.05); for (let k = 0; k < 5; k++) { const a = spin + k / 5 * Math.PI * 2 + 0.3, rr = rim * 0.57, c: V = [hx + Math.cos(a) * rr, s * wy + yf(rr) + s * 3, R + Math.sin(a) * rr];
    fan(b, Array.from({ length: 8 }, (_, i) => { const t = i / 8 * Math.PI * 2; return [c[0] + Math.cos(t) * 19, c[1], c[2] + Math.sin(t) * 19] as V; })); } }

export function xj220Mesh(spin = 0): Mesh { const b = new Build(), bins = new Bins();
  // ---- the body: one skin from the nose to the tail, the arches cut up into it, the cabin hollowed; its panels named ----
  const gen = [10, 13, 16, 22, 28, 40, 52, 70, 90, 112, 152, 192, 232, 272, 312, 672, 720, 762, 817, 880, 940, 1000, 1062, 1120, 1150, 1190, 1227, 1260, 1300, 1650, 1690, 1730, 1760, 1792, 1804, 1816, 1828, 1840, 1852].map(X);
  const xs: number[] = gen.filter(x => Math.abs(x - FX) > RAF + 25 && Math.abs(x - RX) > RAR + 25); xs.push(C0 - 2, C0, C1, C1 + 2, ...[385, 392, 397, 407, 425, 448].map(X));
  for (const [hx, ra] of [[FX, RAF], [RX, RAR]] as const) { xs.push(hx - ra - 3, hx + ra + 3); for (let k = 0; k <= 12; k++) xs.push(hx - ra * Math.cos(k / 12 * Math.PI)); }
  xs.sort((p, q) => p - q);
  const H = xs.map(x => half(x, x >= C0 && x <= C1)), NH = H[0]!.length;
  for (let i = 0; i + 1 < xs.length; i++) { const xa = xs[i]!, xb = xs[i + 1]!, xm = (xa + xb) / 2, A = H[i]!, B = H[i + 1]!, pit = xm > C0 - 3 && xm < C1 + 3, arch = archZ(xa) > 0 && archZ(xb) > 0, anyArch = archZ(xa) > 0 || archZ(xb) > 0;
    for (let j = 0; j + 1 < NH; j++) { let k: string;
      if (j < 3 && (pit || (xm > XS0 && xm < XQ))) k = 'cockpit';
      else if (j === NH - 2) k = 'chassis';
      else if (j >= NH - 5 && arch) k = 'chassis';
      else if (j >= NH - 4 && anyArch) k = 'chassis';
      else if (j >= NH - 3 && xm > RX + RAR) k = 'chassis';
      else if (xm < X(60)) k = 'bumperF'; else if (xm > X(1800)) k = 'bumperR';
      else if (j >= NH - 4 && xm > FX && xm < RX) k = 'sill';
      else if (xm < XD0) k = j < 6 ? 'hood' : 'fenderF'; else if (xm < XD1) k = j < 3 ? 'body' : 'door'; else k = j < 6 ? 'body' : 'fenderR';
      for (const s of [1, -1]) { const p = (h: [number, number], x: number): V => [x, s * h[0], h[1]]; bins.add(k, p(A[j]!, xa), p(A[j + 1]!, xa), p(B[j + 1]!, xb), p(B[j]!, xb)); } } }
  { const e = H[0]!, x = xs[0]!, f = H[NH - 1]!; void f; for (let j = 0; j + 1 < NH; j++) for (const s of [1, -1]) b.name('bumperF').mat(PAINT, 0.6, 'paint').tri([x, 0, (e[0]![1] + e[NH - 1]![1]) / 2], [x, s * e[j]![0], e[j]![1]], [x, s * e[j + 1]![0], e[j + 1]![1]]);
    const t = H[H.length - 1]!, xt = xs[xs.length - 1]!; for (let j = 0; j + 1 < NH; j++) for (const s of [1, -1]) b.name('bumperR').mat(PAINT, 0.6, 'paint').tri([xt, 0, (t[0]![1] + t[NH - 1]![1]) / 2], [xt, s * t[j]![0], t[j]![1]], [xt, s * t[j + 1]![0], t[j + 1]![1]]); }
  // ---- the canopy: the wraparound screen, the side glass drawn to a point, the roof, the fastback with the louvred cover ----
  const cx = [392, 397, 407, 425, 448, 475, 508, 560, 612, 660, 715, 762, 817, 860, 900, 940, 1000, 1067, 1100, 1150, 1190, 1227, 1252, 1300, 1340, 1400, 1460, 1500, 1540, 1582].map(X), CN = cx.map(canopy);
  for (let i = 0; i + 1 < cx.length; i++) { const xa = cx[i]!, xb = cx[i + 1]!, xm = (xa + xb) / 2, A = CN[i]!, B = CN[i + 1]!;
    for (let j = 0; j < 6; j++) { const top = j < 4; let k: string;
      if (xm < XRF) { if (!top && xm < XS1) continue; k = 'glass'; } else if (xm < XQ) k = top ? 'body' : 'glass'; else k = top && j < 3 && xm > XL0 && xm < XL1 ? 'louvre' : 'body';
      for (const s of [1, -1]) { const p = (h: [number, number], x: number): V => [x, s * h[0], h[1]]; bins.add(k, p(A[j]!, xa), p(A[j + 1]!, xa), p(B[j + 1]!, xb), p(B[j]!, xb)); } } }
  bins.flush(b);
  for (const s of [1, -1]) { const rail = (px: number, up = 4): V => { const P = canopy(X(px))[4]!; return [X(px), s * P[0], P[1] + up]; };
    b.name('screenFrame').mat(PAINT, 0.6, 'paint'); line(b, [612, 660, 715, 762, 817].map(p => rail(p, 2)), 24, 14); line(b, [817, 900, 1000, 1067, 1150, 1227].map(p => rail(p, 2)), 22, 12);
    b.name('screenFrame').mat(DARK, 0.1); { const P = canopy(X(1098)), q = (i: number, o: number): V => [X(1098) + o, s * (P[i]![0] + 4), P[i]![1] + 3]; line(b, [q(4, 0), q(5, -6), q(6, -14)], 46, 14); }   // the pillar behind the door glass
    { const P = canopy(X(772)), q = (i: number, o: number): V => [X(772) + o, s * (P[i]![0] + 4), P[i]![1] + 3]; line(b, [q(4, 0), q(5, -10), q(6, -22)], 14, 10); } }   // the quarter light's bar
  // the louvres' slats across the engine cover
  b.name('grille').mat('#3b3d44', 0.3); for (let k = 0; k < 9; k++) { const x = XL0 + 45 + k * (XL1 - XL0 - 90) / 8, w = at(WR, x) * 0.84; line(b, [-1, -0.55, 0, 0.55, 1].map(u => [x, u * w, canZ(x, u * w) + 2] as V), 34, 6); }
  b.name('grille').mat('#3b3d44', 0.3); line(b, [XL0 + 20, (XL0 + XL1) / 2, XL1 - 20].map(x => [x, 0, canZ(x, 0) + 4] as V), 26, 6);
  // ---- inside: the dash, the tunnel, two seats, the bulkhead behind them ----
  { const yd = at(YC, C0) - 12; b.name('cockpit').mat(TRIM, 0.1).box(C0 + 2, C0 + 250, -yd, yd, FLOOR, 705).box(C0 + 250, C1 - 40, -75, 75, FLOOR, 400);
    b.name('cockpit').mat(DARK, 0.05).box(C1 - 40, C1, -620, 620, FLOOR, 985);
    for (const s of [1, -1]) { const y0 = Math.min(s * 110, s * 590), y1 = Math.max(s * 110, s * 590);
      b.name('seat').mat(LEATHER, 0.25, 'leather').box(2160, 2640, y0, y1, FLOOR, 345).loft(([[2590, 345], [2680, 560], [2760, 780], [2800, 905], [2850, 890], [2875, 800]] as const).map(([x, z]) => [[x, y0 + 20, FLOOR + 40], [x, y1 - 20, FLOOR + 40], [x, y1 - 50, z], [x, y0 + 50, z]] as V[])); } }
  // ---- the nose: the wide oval mouth with its mesh and the badge, the low slot, the amber indicators ----
  { const MW = 553, MZ = 262, MH = 80, ys = [-1, -0.94, -0.8, -0.6, -0.35, 0, 0.35, 0.6, 0.8, 0.94, 1].map(u => u * MW), hz = (y: number) => MH * Math.sqrt(Math.max(0, 1 - (y / MW) ** 2)) * 0.98 + 2, P = (y: number, z: number, o = 4): V => [frontX(y, z) - o, y, z];
    b.name('core').mat(DARK, 0.05, 'grille'); for (let i = 0; i + 1 < ys.length; i++) { const ya = ys[i]!, yb = ys[i + 1]!; b.quad(P(ya, MZ - hz(ya)), P(yb, MZ - hz(yb)), P(yb, MZ), P(ya, MZ)).quad(P(ya, MZ), P(yb, MZ), P(yb, MZ + hz(yb)), P(ya, MZ + hz(ya))); }
    b.name('grille').mat('#4a4c53', 0.3); for (const dz of [-30, 30]) line(b, ys.slice(1, -1).map(y => P(y, MZ + dz * Math.min(1, hz(y) / 60), 8)), 8);
    for (const y of [-330, -165, 165, 330]) b.bar(P(y, MZ - hz(y) + 6, 8), P(y, MZ + hz(y) - 6, 8), 8);
    b.name('grille').mat(CHROME, 0.9, 'metal').bar(P(-55, MZ + 18, 10), P(40, MZ - 2, 10), 22, 6).bar(P(40, MZ - 2, 10), P(62, MZ - 22, 10), 14, 6);   // the leaping cat
    b.name('bumperF').mat(DARK, 0.05); { const sl = [-600, -400, -200, 0, 200, 400, 600]; for (let i = 0; i + 1 < sl.length; i++) b.quad(P(sl[i]!, 112, 5), P(sl[i + 1]!, 112, 5), P(sl[i + 1]!, 150, 5), P(sl[i]!, 150, 5)); }
    for (const s of [1, -1]) { b.name('lamp').mat(AMBER, 0.5, 'lens'); const yi = [600, 680, 760, 840]; for (let i = 0; i < 3; i++) b.quad(P(s * yi[i]!, 232), P(s * yi[i + 1]!, 232), P(s * yi[i + 1]!, 306), P(s * yi[i]!, 306));
      b.quad(onSide(s, 240, 282), onSide(s, 268, 282), onSide(s, 268, 268), onSide(s, 240, 268)); b.quad(onSide(s, 632, 250), onSide(s, 650, 250), onSide(s, 650, 238), onSide(s, 632, 238)); } }
  // ---- head lamps: two lamps in a dark bucket under each large oval cover faired into the nose's top corner ----
  for (const s of [1, -1]) { const cxl = X(150), cy = s * 650, loop = (rx: number, ry: number, lift: number, n = 14, ox = 0, oy = 0): V[] => Array.from({ length: n }, (_, i) => { const t = i / n * Math.PI * 2, c = Math.cos(t), d = Math.sin(t), x = cxl + ox + rx * Math.sign(c) * Math.abs(c) ** 0.75, y0 = cy + oy + ry * Math.sign(d) * Math.abs(d) ** 0.75, y = Math.sign(y0) * Math.min(Math.abs(y0), 0.965 * at(HALF, x)); return [x, y, skin(x, y) + lift] as V; });
    b.name('lamp').mat(DARK, 0.1); fan(b, loop(200, 205, 3));
    b.name('lens').mat('#f1f0e2', 0.6, 'lens'); for (const oy of [-88, 88]) fan(b, loop(70, 70, 7, 10, 20, oy), [0, 0, 4]);
    b.name('lampCover').mat(GLASS, 0.5, 'glass'); fan(b, loop(203, 208, 12), [0, 0, 6]); }
  // ---- the flanks: shut lines, the blade-shaped intake behind the door, the round fillers, the mirrors on their stalks ----
  for (const s of [1, -1] as const) {
    b.name('door').mat(LINE, 0.1); line(b, ([[672, 152], [672, 215], [673, 280], [678, 325], [698, 349], [760, 353], [900, 353], [1005, 351]] as const).map(([px, row]) => onSide(s, px, row)), 9);
    line(b, ([[1122, 124], [1121, 165], [1114, 210], [1095, 240], [1078, 258]] as const).map(([px, row]) => onSide(s, px, row)), 9);
    b.name('grille').mat(DARK, 0.05); { const I = [[1006, 333, 335], [1040, 302, 335], [1075, 270, 334], [1110, 256, 333], [1150, 251, 329], [1205, 250, 321], [1240, 255, 309], [1252, 264, 300], [1257, 278, 290]] as const; for (let i = 0; i + 1 < I.length; i++) { const [pa, ta, ba] = I[i]!, [pb, tb, bb] = I[i + 1]!, zm = (r0: number, r1: number) => (r0 + r1) / 2; b.quad(onSide(s, pa, ba, 4), onSide(s, pb, bb, 4), onSide(s, pb, zm(tb, bb), 4), onSide(s, pa, zm(ta, ba), 4)).quad(onSide(s, pa, zm(ta, ba), 4), onSide(s, pb, zm(tb, bb), 4), onSide(s, pb, tb, 4), onSide(s, pa, ta, 4)); } }
    b.name('door').mat(PAINT, 0.6, 'paint'); line(b, ([[700, 262], [820, 254], [940, 247], [1040, 240], [1100, 236]] as const).map(([px, row]) => onSide(s, px, row, 2)), 10);   // the crease running into the intake
    b.name('fenderR').mat(LINE, 0.1); { const R0 = 74, R1 = 62, ring = (r: number, i: number): V => { const t = i / 14 * Math.PI * 2, x = X(1280) + Math.cos(t) * r, z = Z(135) + Math.sin(t) * r; return [x, s * (sideY(x, z) + 3), z]; }; for (let i = 0; i < 14; i++) b.quad(ring(R0, i), ring(R0, i + 1), ring(R1, i + 1), ring(R1, i)); }
    // the mirror: a swept housing on a stalk from the door's top
    { const sect = (y: number, x0: number, x1: number, z0: number, z1: number): V[] => Array.from({ length: 8 }, (_, i) => { const t = (i + 0.5) / 8 * Math.PI * 2, c = Math.cos(t), d = Math.sin(t); return [(x0 + x1) / 2 + (x1 - x0) / 2 * Math.sign(c) * Math.abs(c) ** 0.6, s * y, (z0 + z1) / 2 + (z1 - z0) / 2 * Math.sign(d) * Math.abs(d) ** 0.6] as V; });
      const mx = X(672), mz = 805, root = sideY(mx + 60, mz) - 20;
      b.name('mirror').mat(PAINT, 0.6, 'paint').loft([sect(root, mx + 30, mx + 100, mz - 4, mz + 40), sect(930, mx + 20, mx + 120, mz, mz + 60), sect(960, mx, mx + 165, mz - 12, mz + 116), sect(1040, mx + 12, mx + 190, mz - 16, mz + 124), sect(1100, mx + 40, mx + 198, mz - 4, mz + 116), sect(1110, mx + 70, mx + 186, mz + 16, mz + 98)]);
      b.name('mirror').mat('#3d4450', 0.6).quad([mx + 192, s * 965, mz + 2], [mx + 201, s * 1096, mz + 8], [mx + 201, s * 1096, mz + 106], [mx + 192, s * 965, mz + 106]); }
    wheel(b, FX, s, spin); wheel(b, RX, s, spin); }
  // ---- the tail: the dark panel across it, the lamps in two rows each side, the slats between them, the wing, the exhausts ----
  { const P = (y: number, z: number, o = 4): V => [rearX(y, z) + o, y, z], ys = [-800, -700, -560, -280, 0, 280, 560, 700, 800], Z0 = 400, Z1 = 784;
    b.name('bumperR').mat(DARK, 0.05); for (let i = 0; i + 1 < ys.length; i++) for (const [za, zc] of [[Z0, 530], [530, 630], [630, Z1]] as const) b.quad(P(ys[i]!, za), P(ys[i + 1]!, za), P(ys[i + 1]!, zc), P(ys[i]!, zc));
    b.name('grille').mat('#34363d', 0.2); for (const z of [470, 510, 550, 590, 630]) line(b, [-540, -280, 0, 280, 540].map(y => P(y, z, 8)), 16, 6);
    for (const s of [1, -1]) { const lamp = (c: string, y0: number, y1: number, z0: number, z1: number) => { b.name('tail').mat(c, 0.5, 'lens'); const ym = (y0 + y1) / 2; for (const [ya, yb] of [[y0, ym], [ym, y1]] as const) b.quad(P(s * ya, z0, 8), P(s * yb, z0, 8), P(s * yb, z1, 8), P(s * ya, z1, 8)); };
      lamp(AMBER, 702, 835, 634, 722); lamp(RED, 610, 696, 634, 722); lamp('#e4e2da', 568, 604, 634, 722); lamp(RED, 706, 835, 538, 626); lamp('#a81f24', 568, 700, 538, 626);
      b.name('tailRim').mat(DARK, 0.05).bar(P(s * 560, 630, 9), P(s * 842, 630, 9), 8, 4);
      // the exhaust: one round pipe each side, low in the valance
      b.name('exhaust').mat(CHROME, 0.9, 'metal').lathe('x', [0, s * 647, 232], [[L - 260, 50], [L - 22, 58], [L - 2, 58], [L - 8, 46], [L - 120, 44]], 14, false);
      b.name('exhaust').mat(DARK, 0.05).lathe('x', [0, s * 647, 232], [[L - 110, 44], [L - 110, 0]], 10, false); }
    // the wing: a full-width blade between the tail's raised sides, two struts down to the deck
    const wx = [1742, 1765, 1792, 1816, 1834, 1846, 1852].map(X); b.name('wing').mat(PAINT, 0.6, 'paint').loft(wx.map((x, i) => { const w = at(HALF, x) * 0.9, zt = at(WING, x) - 6, th = [10, 30, 38, 36, 30, 24, 16][i]!; return [[x, -w, zt - th], [x, -w * 0.5, zt - th], [x, w * 0.5, zt - th], [x, w, zt - th], [x, w, zt], [x, w * 0.5, zt + 3], [x, -w * 0.5, zt + 3], [x, -w, zt]] as V[]; }));
    for (const s of [1, -1]) { const ex = [1690, 1742, 1792, 1816, 1834, 1846, 1852].map(X); b.name('wing').mat(PAINT, 0.6, 'paint'); for (let i = 0; i + 1 < ex.length; i++) { const q = (x: number, top: boolean): V => { const y = at(HALF, x) * 0.9; return [x, s * y, top ? at(WING, x) - 6 : skin(x, y) - 12]; }; b.quad(q(ex[i]!, false), q(ex[i + 1]!, false), q(ex[i + 1]!, true), q(ex[i]!, true)); } }
    for (const y of [-383, 383]) b.name('wing').mat(DARK, 0.2).box(X(1780), X(1822), y - 9, y + 9, skin(X(1800), y) - 10, at(WING, X(1800)) - 30); }
  // ---- under the car: the flat floor, the axles' lines, the keel and outer blocks that leave two venturi tunnels at the back ----
  b.name('chassis').mat(DARK, 0.05).bar([FX, -WYF, RF], [FX, WYF, RF], 50).bar([RX, -WYR, RR], [RX, WYR, RR], 70);
  { const dx = [1560, 1620, 1700, 1780, 1840].map(X), low = (x: number) => 100 + (x - dx[0]!) / (dx[4]! - dx[0]!) * 85;
    b.name('chassis').mat('#101114', 0.05).loft(dx.map(x => [[x, -145, low(x)], [x, 145, low(x)], [x, 145, at(BOT, x) + 12], [x, -145, at(BOT, x) + 12]] as V[]));
    for (const s of [1, -1]) b.loft(dx.map(x => { const w = at(HALF, x) * 0.82; return [[x, s * 487, low(x)], [x, s * w, low(x)], [x, s * w, at(BOT, x) + 12], [x, s * 487, at(BOT, x) + 12]] as V[]; })); }
  void sub; return b.mesh(L); }
export const mesh = xj220Mesh;
