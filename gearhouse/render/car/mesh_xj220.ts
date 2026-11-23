// The 1992 Jaguar XJ220 as a low-polygon mesh (docs/systems/70_mesh_car_rules.md, reviews 127 and 128): built afresh
// as one smooth envelope in the manner of the D-type (mesh_jagD55.ts). A long low nose with the wide oval mouth and the
// large oval lamp covers on its corners, the cabin set forward under a wraparound screen, the fastback with its louvred
// black engine cover between broad rear haunches, the blade-shaped intake behind each door, the full-width tail wing.
//
// Proportions are the real car's (the sheet is a drawing: its wheelbase is 3 % long, its plan 5 % wide):
//   length 4930, wheelbase 2640, height 1150           auto-data.net, Wikipedia, conceptcarz (all agree)
//   width 2009 over the body, 2220 over the mirrors    Wikipedia; vehiclesizes.com (mirrors out)
//   track 1710 front, 1588 rear                        encycarpedia
//   tyres 255/45 ZR17 front, 345/35 ZR18 rear          661 and 699 mm across, 255 and 345 wide
//   overhangs 1285 front, 1005 rear; 100 mm clearance  no source: the sheet's shares of the length, and a guess
//   main heights (guessed from photographs)            wing crest 815 over the front axle, belt 826 at the door,
//                                                      haunch 934 over the rear axle, tail lip 976, roof 1150
// The design (shapes, flow, where things sit as shares of the real sizes) is from docs/reference/eb110_xj220_sheet.png.
// Every table below is in mm and is read through a monotone cubic curve, so the stations lie on one smooth surface:
// a section is a superellipse over the widest line (the flanks leaning in to the glass's foot) and a rounded tuck
// under it to the flat floor; the wheel arches are cut by moving the sections' points.
import { Build, type Kind, type Mesh, type V } from './mesh';

const PAINT = '#b9bcc4', DARK = '#17181c', TRIM = '#2a2c33', RUBBER = '#222127', GLASS = '#a9c2cc', ALLOY = '#cdd0d6', CHROME = '#c9cbcf', LEATHER = '#5a6170', AMBER = '#e8902a', RED = '#c2282a', LINE = '#74777f', SLAT = '#3b3d44';
const L = 4930, FX = 1285, RX = FX + 2640;
const WYF = 855, WYR = 794, RF = 331, RR = 349, TWF = 255, TWR = 345, RIMF = 216, RIMR = 229, RAF = 357, RAR = 375, YINF = 705, YINR = 600;
type T2 = [number, number][];
/** a smooth curve through a table's points that never overshoots them (a monotone cubic) */
function curve(t: T2): (x: number) => number { const n = t.length, d: number[] = [], m: number[] = [];
  for (let i = 0; i + 1 < n; i++) d.push((t[i + 1]![1] - t[i]![1]) / (t[i + 1]![0] - t[i]![0]));
  for (let i = 0; i < n; i++) { if (i === 0) m.push(d[0]!); else if (i === n - 1) m.push(d[n - 2]!); else if (d[i - 1]! * d[i]! <= 0) m.push(0);
    else { const h0 = t[i]![0] - t[i - 1]![0], h1 = t[i + 1]![0] - t[i]![0], w1 = 2 * h1 + h0, w2 = h1 + 2 * h0; m.push((w1 + w2) / (w1 / d[i - 1]! + w2 / d[i]!)); } }
  return x => { if (x <= t[0]![0]) return t[0]![1]; if (x >= t[n - 1]![0]) return t[n - 1]![1]; let i = 0; while (x > t[i + 1]![0]) i++;
    const h = t[i + 1]![0] - t[i]![0], s = (x - t[i]![0]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * t[i]![1] + (s3 - 2 * s2 + s) * h * m[i]! + (-2 * s3 + 3 * s2) * t[i + 1]![1] + (s3 - s2) * h * m[i + 1]!; }; }
// ---- the body along the car: the plan's half-width; the wings' crest (the side view's outline away from the cabin);
// the centre line (bonnet, deck: it drops under the tail wing); the underside (rising at the back); the height of the
// widest line; how square the section is; where across the top the crest rises from the centre line's height
const HALF = curve([[0, 250], [12, 335], [30, 410], [55, 482], [95, 562], [175, 690], [288, 795], [396, 858], [504, 903], [611, 936], [719, 962], [827, 981], [934, 994], [1100, 1000], [1365, 1000], [1500, 990], [1650, 974], [1900, 968], [2700, 968], [2900, 985], [3100, 998], [3400, 1004.5], [4200, 1004.5], [4400, 998], [4560, 984], [4680, 958], [4770, 908], [4835, 835], [4880, 752], [4912, 655], [4930, 560]]);
const WING = curve([[0, 250], [12, 318], [30, 372], [55, 415], [95, 452], [150, 476], [256, 518], [364, 569], [471, 617], [579, 661], [687, 699], [794, 731], [902, 757], [1010, 779], [1117, 797], [1285, 815], [1650, 826], [2060, 826], [2500, 835], [2990, 862], [3360, 905], [3710, 934], [3970, 948], [4500, 952], [4700, 960], [4800, 970], [4930, 976]]);
const CEN = curve([[0, 250], [12, 316], [30, 368], [55, 408], [95, 442], [150, 485], [256, 535], [364, 590], [471, 640], [579, 684], [687, 722], [794, 752], [902, 776], [1042, 792], [1300, 802], [1700, 815], [2900, 835], [3450, 900], [3970, 945], [4290, 942], [4500, 915], [4660, 876], [4930, 842]]);
const BOT = curve([[0, 150], [16, 126], [60, 106], [110, 100], [4100, 100], [4300, 125], [4500, 185], [4700, 265], [4850, 335], [4900, 385], [4930, 450]]);
const ZW = curve([[0, 200], [30, 215], [256, 320], [800, 480], [1100, 535], [1285, 545], [1500, 535], [1866, 495], [2900, 500], [3450, 520], [3925, 560], [4500, 610], [4930, 650]]);
const NN = curve([[0, 2.6], [500, 3.2], [900, 4.2], [1285, 4.6], [1700, 4.2], [2300, 3.8], [3000, 3.8], [3925, 4.2], [4600, 4.4], [4930, 4.4]]);
const U0 = curve([[0, 0], [1100, 0.05], [1700, 0.3], [3000, 0.3], [3900, 0.45], [4500, 0.62], [4930, 0.68]]), U1 = curve([[0, 0.6], [3000, 0.7], [3900, 0.8], [4500, 0.86], [4930, 0.88]]);
// ---- the canopy (screen, side glass, roof, the fastback over the engine): its foot's half-width on the body; the
// half-width of its top (the A-pillar, then the roof's edge); the centre line's height; the edge's height as a share
// of the way from the foot to the centre line
const XS0 = 1042, XA = 1634, XH = 2168, XQ = 3250, XE = 4190, XL0 = 3350, XL1 = 4130, C0 = 1740, C1 = 2890, FLOOR = 190;
const WG = curve([[XS0, 0], [1055, 157], [1082, 279], [1131, 380], [1193, 494], [1354, 649], [XA, 761], [1866, 806], [2023, 811], [2815, 811], [3047, 761], [XQ, 672], [3442, 629], [3706, 609], [3970, 593], [XE, 545]]);
const WR = curve([[XA, 761], [XH, 487], [2500, 505], [2815, 532], [3047, 596], [XQ, 646], [3442, 540], [3970, 490], [XE, 440]]);
const ZR = curve([[XS0, 795], [1300, 840], [1600, 912], [1900, 1000], [XH, 1082], [2330, 1125], [2493, 1147], [2650, 1150], [2810, 1148], [3000, 1132], [XQ, 1100], [3550, 1056], [3760, 1020], [3900, 985], [4000, 962], [XE, 948]]);
const CF = curve([[XA, 0], [XH, 0.87], [2815, 0.86], [3047, 0.72], [XQ, 0.42], [3442, 0.22], [XE, 0.2]]);
/** the line across the body's top that follows the glass's foot (the sections carry a point on it: the cabin's edge) */
const YC = curve([[0, 75], [95, 170], [300, 270], [700, 300], [1000, 300], [1131, 350], [1193, 464], [1354, 619], [XA, 731], [1866, 776], [2023, 781], [2815, 781], [3047, 731], [XQ, 642], [3442, 600], [3970, 560], [XE, 515], [4500, 480], [L, 380]]);

interface Sec { w: number; zb: number; zw: number; n: number; cen: number; wing: number; u0: number; u1: number; tk: number }
const top0 = (s: Sec, u: number) => { const k = Math.min(1, Math.max(0, (u - s.u0) / (s.u1 - s.u0))), zt = s.cen + (s.wing - s.cen) * k * k * (3 - 2 * k); return s.zw + (zt - s.zw) * Math.max(0, 1 - u ** s.n) ** (1 / s.n); };
const SECS = new Map<number, Sec>();
/** the section's figures at x; the wing's height is raised until the section's highest point stands at the crest's table */
function sec(x: number): Sec { const key = Math.round(x * 20); let s = SECS.get(key); if (s) return s;
  const zb = BOT(x), cen = CEN(x), crest = WING(x), w = HALF(x); s = { w, zb, zw: Math.max(zb + 30, ZW(x)), n: NN(x), cen, wing: crest, u0: U0(x), u1: U1(x), tk: 0.1 * w };
  if (crest > cen) for (let it = 0; it < 3; it++) { let hi = cen; for (let u = 0.1; u < 1; u += 0.02) hi = Math.max(hi, top0(s, u)); s.wing += crest - hi; }
  SECS.set(key, s); return s; }
const topZ = top0;
/** the lower flank, from the widest line tucked under to the floor's edge: the point a share `f` of the way round; its y at height z */
const lowP = (s: Sec, f: number): [number, number] => { const t = f * Math.PI / 2; return [s.w - s.tk + s.tk * Math.cos(t) ** (2 / 2.6), s.zw - (s.zw - s.zb) * Math.sin(t) ** (2 / 2.6)]; };
const lowY = (s: Sec, z: number) => { const q = Math.min(1, Math.max(0, (s.zw - z) / (s.zw - s.zb))) ** 1.3; return s.w - s.tk + s.tk * Math.max(0, 1 - q * q) ** (1 / 2.6); };
/** the skin's height at (x, y); its half-width at height z (the outermost point of the section there) */
const skin = (x: number, y: number) => { const s = sec(x); return topZ(s, Math.min(1, Math.abs(y) / s.w)); };
const outU = (s: Sec, z: number) => { if (topZ(s, 1) >= z) return 1; let p = 1; for (let u = 0.98; u >= 0; u -= 0.02) { if (topZ(s, u) >= z) { let lo = u, hi = p; for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (topZ(s, m) >= z) lo = m; else hi = m; } return lo; } p = u; } return 0; };
const sideY = (x: number, z: number) => { const s = sec(x); return z >= s.zw ? s.w * outU(s, z) : z >= s.zb ? lowY(s, z) : 0; };
/** how far back the nose's face lies at (y, z); how far forward the tail's */
const FACE = new Map<string, number>();
const faceX = (y: number, z: number, rear: boolean) => { const key = `${y}|${z}|${rear}`; let v = FACE.get(key); if (v !== undefined) return v; const ok = (x: number) => z >= BOT(x) && sideY(x, z) >= Math.abs(y);
  let a = rear ? L : 0; const d = rear ? -1 : 1; if (!ok(a)) { let n = 0; while (!ok(a + d * 6) && n++ < 200) a += d * 6; let lo = a, hi = a + d * 6; for (let i = 0; i < 6; i++) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; } a = hi; }
  FACE.set(key, v = a); return v; };
const archZ = (x: number) => { for (const [hx, r, ra] of [[FX, RF, RAF], [RX, RR, RAR]] as const) { const dx = x - hx; if (Math.abs(dx) <= ra + 1e-6) return r + Math.sqrt(Math.max(0, ra * ra - dx * dx)); } return 0; };
const KS = 9;   // steps round the shoulder
/** half a body section at x, from the centre line over the top, down the flank, to the centre of the floor: [y, z];
 *  `dark` the first point of what faces the road or the wheel (the floor, the arch's roof and inner wall) */
function half(x: number, pit: boolean): { p: [number, number][]; dark: number } { const s = sec(x), yc = Math.min(0.62 * s.w, YC(x)), uc = yc / s.w, arch = archZ(x), yin = x < 2600 ? YINF : YINR, p: [number, number][] = [];
  for (const f of [0, 0.5, 0.93]) p.push([f * yc, pit ? FLOOR : topZ(s, f * uc)]);
  const over = arch > s.zw, ua = over ? Math.max(uc + 0.03, outU(s, arch)) : 1, tc = Math.acos(uc ** (s.n / 2)), ta = Math.acos(Math.min(1, ua ** (s.n / 2)));
  for (let k = 0; k <= KS; k++) { const u = k === 0 ? uc : k === KS ? ua : Math.cos(tc + (ta - tc) * k / KS) ** (2 / s.n); p.push([u * s.w, k === KS && over ? arch : topZ(s, u)]); }
  let dark: number;
  if (!arch) { for (const f of [0.35, 0.62, 0.85, 1]) p.push(lowP(s, f)); dark = p.length - 1; p.push([(s.w - s.tk) / 2, s.zb]); }
  else if (!over) { const zm = (s.zw + arch) / 2; p.push([lowY(s, zm), zm], [lowY(s, arch), arch]); dark = p.length - 1; p.push([yin, arch], [yin, s.zb], [yin / 2, s.zb]); }
  else { const ya = ua * s.w; dark = p.length - 1; p.push([ya - (ya - yin) / 3, arch], [ya - (ya - yin) * 2 / 3, arch], [yin, arch], [yin, s.zb], [yin / 2, s.zb]); }
  p.push([0, s.zb]); return { p, dark }; }
/** the canopy's figures at x, and half its section: across the top to its edge, down the side glass to the foot */
const can = (x: number) => { const wg = WG(x), wr = x <= XA ? wg : Math.min(wg, WR(x)), zr = ZR(x), foot = skin(x, wg) - 10, cant = x <= XA ? foot : foot + (zr - foot) * CF(x); return { wg, wr, zr, foot, cant }; };
const CU = [0, 0.35, 0.65, 0.87, 1], CP = 2.8;
function canopy(x: number): [number, number][] { const c = can(x), out: [number, number][] = CU.map(u => [u * c.wr, c.cant + (c.zr - c.cant) * Math.max(0, 1 - u ** CP) ** (1 / CP)]);
  out.push([c.wr + (c.wg - c.wr) * 0.55, c.cant + (c.foot - c.cant) * 0.5], [c.wg, c.foot]); return out; }
/** the canopy's height over its top at a share u of the top's half-width */
const canTop = (x: number, u: number): V => { const c = can(x); return [x, u * c.wr, c.cant + (c.zr - c.cant) * Math.max(0, 1 - Math.abs(u) ** CP) ** (1 / CP)]; };

type Mat = [name: string, colour: string, gloss: number, kind: Kind];
const MATS: Record<string, Mat> = { body: ['body', PAINT, 0.6, 'paint'], cockpit: ['cockpit', DARK, 0.05, 'plain'], chassis: ['chassis', DARK, 0.05, 'plain'], glass: ['screenPane', GLASS, 0.5, 'glass'], louvre: ['grille', DARK, 0.1, 'plain'] };
const nrm = (p: V, q: V, r: V): V => { const x = (q[1] - p[1]) * (r[2] - p[2]) - (q[2] - p[2]) * (r[1] - p[1]), y = (q[2] - p[2]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[2] - p[2]), z = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]), l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
/** quads gathered by material, laid down one part each (the paint is one part: no outline across the smooth skin) */
class Bins { private q = new Map<string, V[][]>(); add(k: string, a: V, b: V, c: V, d: V) { let l = this.q.get(k); if (!l) this.q.set(k, l = []); l.push([a, b, c, d]); }
  flush(b: Build) { const flat = (p: V, q: V, r: V) => Math.hypot((q[1] - p[1]) * (r[2] - p[2]) - (q[2] - p[2]) * (r[1] - p[1]), (q[2] - p[2]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[2] - p[2]), (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) < 1;
    for (const k of Object.keys(MATS)) { const l = this.q.get(k); if (!l) continue; const m = MATS[k]!; b.name(m[0]).mat(m[1], m[2], m[3]); for (const [p, q, r, s] of l) { const A = [p!, q!, r!, s!] as const, fold = (i: number) => { const a = nrm(A[i]!, A[(i + 1) % 4]!, A[(i + 2) % 4]!), c = nrm(A[i]!, A[(i + 2) % 4]!, A[(i + 3) % 4]!); return a[0] * c[0] + a[1] * c[1] + a[2] * c[2]; }, i = fold(1) > fold(0) + 1e-9 ? 1 : 0;   // split along the flatter diagonal
      const t: [V, V, V][] = [[A[i]!, A[(i + 1) % 4]!, A[(i + 2) % 4]!], [A[i]!, A[(i + 2) % 4]!, A[(i + 3) % 4]!]]; for (const [u, v, w] of t) if (!flat(u, v, w)) b.tri(u, v, w); } } } }

/** a flat patch from a loop of points (a fan about their middle) */
function fan(b: Build, P: V[], lift: V = [0, 0, 0]): void { const m: V = [0, 0, 0]; for (const p of P) { m[0] += p[0] / P.length; m[1] += p[1] / P.length; m[2] += p[2] / P.length; } const c: V = [m[0] + lift[0], m[1] + lift[1], m[2] + lift[2]]; for (let i = 0; i < P.length; i++) b.tri(c, P[i]!, P[(i + 1) % P.length]!); }
/** a band through points, `t` wide across `w` (a direction for every point, or one for all) */
function band(b: Build, P: V[], t: number, w: V | ((i: number) => V)): void { const o = (i: number, k: number): V => { const d = typeof w === 'function' ? w(i) : w, p = P[i]!; return [p[0] + d[0] * t / 2 * k, p[1] + d[1] * t / 2 * k, p[2] + d[2] * t / 2 * k]; }; for (let i = 0; i + 1 < P.length; i++) b.quad(o(i, -1), o(i + 1, -1), o(i + 1, 1), o(i, 1)); }
/** a point on the flank at (x, z), `out` mm proud of the skin; a line `t` wide drawn on the flank through [x, z] points */
const onSide = (s: number, x: number, z: number, out = 3): V => [x, s * (sideY(x, z) + out), z];
function sideLine(b: Build, s: number, P: [number, number][], t: number, out = 3): void { for (let i = 0; i + 1 < P.length; i++) { const [x0, z0] = P[i]!, [x1, z1] = P[i + 1]!, l = Math.hypot(x1 - x0, z1 - z0) || 1, nx = -(z1 - z0) / l * t / 2, nz = (x1 - x0) / l * t / 2;
  b.quad(onSide(s, x0 - nx, z0 - nz, out), onSide(s, x1 - nx, z1 - nz, out), onSide(s, x1 + nx, z1 + nz, out), onSide(s, x0 + nx, z0 + nz, out)); } }
/** an oval patch lying on the body's top, `lift` above the skin, kept inside the plan's edge: the lamp covers */
function oval(b: Build, cx: number, cy: number, rx: number, ry: number, lift: number, seg = 14, ring = 0): void { const p = (f: number, i: number): V => { const t = i / seg * Math.PI * 2, x = cx + Math.cos(t) * rx * f, y0 = cy + Math.sin(t) * ry * f, y = Math.sign(y0) * Math.min(Math.abs(y0), 0.955 * HALF(x)); return [x, y, skin(x, y) + lift]; };
  for (let i = 0; i < seg; i++) { if (ring) { b.quad(p(1, i), p(1, i + 1), p(ring, i + 1), p(ring, i)); continue; } b.tri(p(0, 0), p(0.55, i), p(0.55, i + 1)); b.quad(p(0.55, i), p(1, i), p(1, i + 1), p(0.55, i + 1)); } }
/** a disc facing along y */
const disc = (b: Build, o: V, r: number, seg: number) => fan(b, Array.from({ length: seg }, (_, i) => { const t = i / seg * Math.PI * 2; return [o[0] + Math.cos(t) * r, o[1], o[2] + Math.sin(t) * r] as V; }));

/** a road wheel: the plain flat disc of the XJ220's Speedlines, dished a little to the centre cap, five round holes */
function wheel(b: Build, hx: number, s: 1 | -1, spin: number) { const front = hx === FX, R = front ? RF : RR, TW = front ? TWF : TWR, rim = front ? RIMF : RIMR, wy = front ? WYF : WYR, o: V = [hx, s * wy, R], f = s * TW / 2, SEG = 20;
  b.name(front ? 'tyreF' : 'tyreR').mat(RUBBER, 0.05, 'tyre').lathe('y', o, [[-TW / 2, rim], [-TW / 2, R - 34], [-TW / 2 + 30, R], [TW / 2 - 30, R], [TW / 2, R - 34], [TW / 2, rim]], SEG, false);
  b.name('wheel').mat(DARK, 0.05); disc(b, [hx, s * wy + f * 0.25, R], rim, SEG);
  b.name('rim').mat(CHROME, 0.9, 'metal').lathe('y', o, [[f, rim + 5], [f * 1.03, rim - 3], [f * 0.94, rim - 22]], SEG, false);
  const yf = (r: number) => f * (0.94 - 0.06 * (rim - 22 - r) / (rim - 22));
  b.name('spoke').mat(ALLOY, 0.7, 'metal').lathe('y', o, [rim - 22, rim * 0.74, rim * 0.42, 62].map(r => [yf(r), r] as [number, number]), SEG, false);
  b.name('hub').mat(ALLOY, 0.8, 'metal').lathe('y', o, [[yf(62), 62], [yf(62) + s * 14, 52], [yf(62) + s * 20, 26]], 10, false); disc(b, [hx, s * wy + yf(62) + s * 20, R], 26, 10);
  b.name('wheelHole').mat(DARK, 0.05); for (let k = 0; k < 5; k++) { const a = spin + k / 5 * Math.PI * 2 + 0.3, rr = rim * 0.58; disc(b, [hx + Math.cos(a) * rr, s * wy + yf(rr) + s * 3, R + Math.sin(a) * rr], 20, 8); } }

/** the head lamps' ovals (review 130): centre along and across, half-sizes along and across (mm) */
const XHL = 600, YHL = 665, RHX = 265, RHY = 190;
export function xj220Mesh(spin = 0): Mesh { const b = new Build(), bins = new Bins();
  // ---- the body: one skin from the nose to the tail, the arches cut up into it, the cabin hollowed ----
  const xs: number[] = [0, 12, 30, 55, 95, 140, 200, 270, 350, 440, 530, 620, 710, 800, 870, C0 - 2, C0, 1850, 1960, 2070, 2180, 2290, 2400, 2510, 2620, 2730, 2815, C1, C1 + 2, 3000, 3100, 3200, 3300, 3400, 3480, 4370, 4440, 4520, 4600, 4680, 4760, 4830, 4880, 4912, L];
  for (const [hx, ra] of [[FX, RAF], [RX, RAR]] as const) { xs.push(hx - ra - 3, hx + ra + 3); for (let k = 0; k <= 10; k++) xs.push(hx - ra * Math.cos(k / 10 * Math.PI)); }
  xs.sort((p, q) => p - q);
  const H = xs.map(x => half(x, x >= C0 && x <= C1)), NH = H[0]!.p.length;
  for (let i = 0; i + 1 < xs.length; i++) { const xa = xs[i]!, xb = xs[i + 1]!, xm = (xa + xb) / 2, A = H[i]!, B = H[i + 1]!, pit = xm > C0 - 3 && xm < C1 + 3, dark = Math.min(A.dark, B.dark);
    for (let j = 0; j + 1 < NH; j++) { const k = j >= dark ? 'chassis' : j < 3 && (pit || (xm > 1131 && xm < XQ)) ? 'cockpit' : 'body';
      for (const s of [1, -1]) { const p = (h: [number, number], x: number): V => [x, s * h[0], h[1]]; bins.add(k, p(A.p[j]!, xa), p(A.p[j + 1]!, xa), p(B.p[j + 1]!, xb), p(B.p[j]!, xb)); } } }
  for (const [e, x] of [[H[0]!.p, 0], [H[H.length - 1]!.p, L]] as const) { const zm = (e[0]![1] + e[NH - 1]![1]) / 2; for (let j = 0; j + 1 < NH; j++) for (const s of [1, -1]) bins.add('body', [x, 0, zm], [x, s * e[j]![0], e[j]![1]], [x, s * e[j + 1]![0], e[j + 1]![1]], [x, 0, zm]); }
  // ---- the canopy: the wraparound screen, the side glass drawn to a point, the roof, the fastback with the louvred cover ----
  const cx = [1047, 1060, 1082, 1131, 1193, 1270, 1354, 1450, 1540, XA, 1740, 1850, 1960, 2060, XH, 2280, 2390, 2500, 2610, 2720, 2815, 2930, 3047, 3150, XQ, XL0, 3450, 3550, 3650, 3760, 3860, 3960, 4060, XL1, XE], CN = cx.map(canopy);
  for (let i = 0; i + 1 < cx.length; i++) { const xa = cx[i]!, xb = cx[i + 1]!, xm = (xa + xb) / 2, A = CN[i]!, B = CN[i + 1]!;
    for (let j = 0; j < 6; j++) { const k = j >= 4 ? (xm < XQ ? 'glass' : 'body') : xm < XH ? 'glass' : j < 3 && xm > XL0 && xm < XL1 ? 'louvre' : 'body';
      for (const s of [1, -1]) { const p = (h: [number, number], x: number): V => [x, s * h[0], h[1]]; bins.add(k, p(A[j]!, xa), p(A[j + 1]!, xa), p(B[j + 1]!, xb), p(B[j]!, xb)); } } }
  for (const [e, x, k] of [[CN[0]!, cx[0]!, 'glass'], [CN[CN.length - 1]!, XE, 'body']] as const) for (let j = 0; j < 6; j++) for (const s of [1, -1]) bins.add(k, [x, 0, e[6]![1]], [x, s * e[j]![0], e[j]![1]], [x, s * e[j + 1]![0], e[j + 1]![1]], [x, 0, e[6]![1]]);
  bins.flush(b);
  for (const s of [1, -1]) { const rail = (x: number, k = 4, up = 3): V => { const P = canopy(x)[k]!; return [x, s * (P[0] + 2), P[1] + up]; };
    b.name('screenFrame').mat(PAINT, 0.6, 'paint'); for (const [x0, x1] of [[XA, 1810], [1810, 1990], [1990, XH]] as const) b.bar(rail(x0), rail(x1), 30, 12);   // the A-pillar
    b.name('screenFrame').mat(DARK, 0.1).bar(rail(2880), rail(2872, 5), 44, 12).bar(rail(2872, 5), rail(2858, 6, 6), 44, 12); }                                  // the pillar behind the door glass
  // the louvres' slats across the engine cover
  b.name('grille').mat(SLAT, 0.3); for (let k = 0; k < 7; k++) { const x = XL0 + 70 + k * (XL1 - XL0 - 140) / 6; band(b, [-0.87, -0.65, -0.35, 0, 0.35, 0.65, 0.87].map(u => { const p = canTop(x, u * 0.97); return [p[0], p[1], p[2] + 7] as V; }), 40, [1, 0, 0]); }
  // ---- inside: the dash, the tunnel, two seats, the bulkhead behind them ----
  { const yd = YC(C0) - 70; b.name('cockpit').mat(TRIM, 0.1).box(C0 + 2, C0 + 230, -yd, yd, FLOOR, 770).box(C0 + 230, C1 - 40, -85, 85, FLOOR, 400);
    b.name('cockpit').mat(DARK, 0.05).box(C1 - 40, C1 - 2, -680, 680, FLOOR, 1000);
    for (const s of [1, -1]) { const y0 = Math.min(s * 125, s * 610), y1 = Math.max(s * 125, s * 610);
      b.name('seat').mat(LEATHER, 0.25, 'leather').box(2200, 2680, y0, y1, FLOOR, 350).loft(([[2630, 350], [2710, 600], [2790, 860], [2832, 930]] as const).map(([x, z]) => [[x, y0 + 20, FLOOR + 40], [x, y1 - 20, FLOOR + 40], [x, y1 - 50, z], [x, y0 + 50, z]] as V[])); } }
  // ---- the nose: the wide oval mouth with its mesh and the leaping cat, the low slot, the amber indicators ----
  { const MW = 555, MZ = 262, MH = 78, ys = [-1, -0.92, -0.72, -0.4, 0, 0.4, 0.72, 0.92, 1].map(u => u * MW), hz = (y: number) => MH * Math.sqrt(Math.max(0, 1 - (y / MW) ** 2)) * 0.96 + 3, P = (y: number, z: number, o = 5): V => [faceX(y, z, false) - o, y, z];
    b.name('core').mat('#0c0d10', 0.05); for (let i = 0; i + 1 < ys.length; i++) { const ya = ys[i]!, yb = ys[i + 1]!; b.quad(P(ya, MZ - hz(ya)), P(yb, MZ - hz(yb)), P(yb, MZ), P(ya, MZ)).quad(P(ya, MZ), P(yb, MZ), P(yb, MZ + hz(yb)), P(ya, MZ + hz(ya))); }
    // review 130 (against the sheet): the mouth's horizontal slats, dark grey on black, five across its height, each following the oval
    b.name('coreBar').mat('#70747e', 0.5, 'metal'); for (let k = 1; k <= 5; k++) { const z = MZ - MH + k * 2 * MH / 6, w = MW * Math.sqrt(Math.max(0, 1 - ((z - MZ) / MH) ** 2)) * 0.96; b.quad(P(-w, z - 9, 12), P(w, z - 9, 12), P(w, z + 9, 12), P(-w, z + 9, 12)); }
    // the leaping cat in silver at the mouth's top middle, leaping to the car's left as seen from ahead
    // the leaping cat: a long body stretched in a leap, head forward (to the car's left seen from ahead), tail trailing; small convex pieces
    b.name('grille').mat(CHROME, 0.95, 'metal'); { const C = (y: number, z: number): V => P(y, MZ + 40 + z, 16), piece = (q: [number, number][]) => b.quad(C(q[0]![0], q[0]![1]), C(q[1]![0], q[1]![1]), C(q[2]![0], q[2]![1]), C(q[3]![0], q[3]![1]));
      piece([[-70, -6], [60, 6], [60, 26], [-70, 12]]); piece([[60, 6], [100, 14], [100, 34], [60, 26]]); piece([[100, 18], [122, 24], [118, 36], [100, 34]]);   /* body, shoulders, head */
      piece([[-70, -6], [-120, -22], [-124, -12], [-70, 12]]); piece([[40, 4], [78, -16], [84, -10], [52, 10]]); piece([[-50, -2], [-92, -26], [-86, -30], [-40, 4]]); }
    b.name('bumperF').mat(DARK, 0.05); { const sl = [-600, -300, 0, 300, 600]; for (let i = 0; i + 1 < sl.length; i++) b.quad(P(sl[i]!, 118, 4), P(sl[i + 1]!, 118, 4), P(sl[i + 1]!, 152, 4), P(sl[i]!, 152, 4)); }
    for (const s of [1, -1]) { b.name('lamp').mat(AMBER, 0.5, 'lens'); const yi = [650, 690, 790, 830], zz = (i: number) => i === 0 || i === 3 ? [252, 284] : [240, 296]; for (let i = 0; i < 3; i++) { if (i === 0) b.mat('#e9e6dc', 0.6, 'lens'); else b.mat(AMBER, 0.5, 'lens'); const [za, zb] = zz(i) as [number, number], [zc, zd] = zz(i + 1) as [number, number]; b.quad(P(s * yi[i]!, za), P(s * yi[i + 1]!, zc), P(s * yi[i + 1]!, zd), P(s * yi[i]!, zb)); }   /* a pill, its inner end white */
      b.quad(onSide(s, 640, 400), onSide(s, 715, 400), onSide(s, 715, 436), onSide(s, 640, 436)); b.quad(onSide(s, 1688, 468), onSide(s, 1736, 468), onSide(s, 1736, 500), onSide(s, 1688, 500)); } }
  // ---- head lamps: the large oval cover on each corner of the nose (its edge a fine line in the paint), and in it a
  //      clear window over two lamps in a dark bucket ----
  // review 130 (against the sheet): wide horizontal ovals flush with the paint, a fine dark outline; under the clear cover
  // the lamps sit low and small in a silvered recess, so the cover reads in the body's own colour as on the sheet
  for (const s of [1, -1]) { const cxl = XHL, cy = s * YHL;
    b.name('lampCover').mat(LINE, 0.1); oval(b, cxl, cy, RHX, RHY, 4, 24, 0.94);
    b.name('lamp').mat('#c4c7ce', 0.6, 'paint'); oval(b, cxl, cy, RHX * 0.94, RHY * 0.94, 2, 20);   /* the cover in the body's colour, as the sheet draws it */
    b.name('lens').mat('#f1f0e2', 0.6, 'lens'); for (const oy of [-0.36, 0.36]) oval(b, cxl + RHX * 0.25, cy + oy * RHY, RHX * 0.24, RHY * 0.22, 6, 10, 0.01); }
  // ---- the flanks: shut lines, the blade-shaped intake behind the door, the round fillers, the mirrors on their stalks ----
  for (const s of [1, -1] as const) {
    b.name('door').mat(LINE, 0.1); sideLine(b, s, [[1795, 770], [1795, 590], [1798, 400], [1812, 280], [1865, 215], [2030, 202], [2400, 202], [2663, 208]], 9);
    sideLine(b, s, [[2973, 800], [2970, 720], [2952, 600], [2905, 515], [2857, 470]], 9);
    // the intake: a blade from a point low on the door, widening back and up into the rear wing
    b.name('grille').mat(DARK, 0.05); { const I: [number, number, number][] = [[2666, 258, 252], [2760, 335, 250], [2850, 420, 252], [2945, 468, 256], [3050, 484, 266], [3190, 486, 288], [3280, 468, 322], [3318, 430, 365]];
      for (let i = 0; i + 1 < I.length; i++) { const [xa, ta, ba] = I[i]!, [xb, tb, bb] = I[i + 1]!; b.quad(onSide(s, xa, ba, 4), onSide(s, xb, bb, 4), onSide(s, xb, (tb + bb) / 2, 4), onSide(s, xa, (ta + ba) / 2, 4)).quad(onSide(s, xa, (ta + ba) / 2, 4), onSide(s, xb, (tb + bb) / 2, 4), onSide(s, xb, tb, 4), onSide(s, xa, ta, 4)); } }
    b.name('filler').mat(LINE, 0.1); { const ring = (r: number, i: number): V => { const t = i / 12 * Math.PI * 2; return onSide(s, 3390 + Math.cos(t) * r, 800 + Math.sin(t) * r); }; for (let i = 0; i < 12; i++) b.quad(ring(72, i), ring(72, i + 1), ring(61, i + 1), ring(61, i)); }
    // the mirror: a swept housing on a stalk from the door's top
    { const sect = (y: number, x0: number, x1: number, z0: number, z1: number): V[] => Array.from({ length: 8 }, (_, i) => { const t = (i + 0.5) / 8 * Math.PI * 2, c = Math.cos(t), d = Math.sin(t); return [(x0 + x1) / 2 + (x1 - x0) / 2 * Math.sign(c) * Math.abs(c) ** 0.6, s * y, (z0 + z1) / 2 + (z1 - z0) / 2 * Math.sign(d) * Math.abs(d) ** 0.6] as V; });
      const mx = 1800, mz = 815, root = sideY(mx + 60, mz) - 25;
      b.name('mirror').mat(PAINT, 0.6, 'paint').loft([sect(root, mx + 30, mx + 100, mz - 4, mz + 36), sect(905, mx + 20, mx + 125, mz, mz + 60), sect(935, mx, mx + 170, mz - 16, mz + 120), sect(1030, mx + 12, mx + 196, mz - 22, mz + 128), sect(1110, mx + 50, mx + 200, mz - 6, mz + 116)]);
      b.name('mirror').mat('#3d4450', 0.6).quad([mx + 199, s * 945, mz - 4], [mx + 204, s * 1100, mz + 4], [mx + 204, s * 1100, mz + 108], [mx + 199, s * 945, mz + 110]); }
    wheel(b, FX, s, spin); wheel(b, RX, s, spin); }
  // ---- the tail: the dark band across it, two lamp units each side, the slats between them, the wing, the exhausts ----
  // review 130 (against the sheet): the black band from lamp to lamp at the lamps' height, fine horizontal slats across
  // it, a bright strip where the JAGUAR letters stand; each lamp cluster two rows: amber outside and clear inside above,
  // red the full width below; under the band the dark valance with two recesses and the big round exhausts out wide
  { const P = (y: number, z: number, o = 4): V => [faceX(y, z, true) + o, y, z], ys = [-466, -350, -175, 0, 175, 350, 466], Z0 = 470, Z1 = 680;
    b.name('bumperR').mat('#121316', 0.1); for (let i = 0; i + 1 < ys.length; i++) for (let za = Z0; za < Z1; za += 30) { const zc = Math.min(Z1, za + 30); b.quad(P(ys[i]!, za), P(ys[i + 1]!, za), P(ys[i + 1]!, zc), P(ys[i]!, zc)); }   /* between the clusters, in strips that follow the tail */
    b.name('grille').mat('#2b2d33', 0.25); for (let z = 500; z <= 620; z += 24) b.quad(P(-450, z - 5, 7), P(450, z - 5, 7), P(450, z + 5, 7), P(-450, z + 5, 7));
    b.name('grille').mat('#c9ccd2', 0.8, 'metal').quad(P(-190, 648, 7), P(190, 648, 7), P(190, 664, 7), P(-190, 664, 7));   /* the badge's letters, as a bright strip */
    for (const s of [1, -1]) { const lamp = (c: string, y0: number, y1: number, z0: number, z1: number) => { b.name('tail').mat(c, 0.5, 'lens'); const n = Math.max(2, Math.ceil((z1 - z0) / 20)), m = Math.max(2, Math.ceil((y1 - y0) / 45)); for (let k = 0; k < n; k++) for (let j = 0; j < m; j++) { const za = z0 + (z1 - z0) * k / n, zb = z0 + (z1 - z0) * (k + 1) / n, ya = y0 + (y1 - y0) * j / m, yb = y0 + (y1 - y0) * (j + 1) / m; b.quad(P(s * ya, za, 12), P(s * yb, za, 12), P(s * yb, zb, 12), P(s * ya, zb, 12)); } };   /* in strips, so it follows the tail's curve and stands proud of the band */
      lamp('#e9e4dc', 470, 560, 588, 668); lamp(AMBER, 566, 740, 588, 668); lamp(RED, 470, 740, 502, 582); }   /* on the tail's flat face, where the sheet puts them in from its corners */
    // the wing: a full-width blade between the tail's raised sides, two struts down to the deck
    const wx = [4690, 4760, 4830, 4890, L]; b.name('wing').mat(PAINT, 0.6, 'paint').loft(wx.map((x, i) => { const w = HALF(x) * 0.86, zt = WING(x) - 5, th = [10, 30, 36, 30, 16][i]!; return [[x, -w, zt - th], [x, 0, zt - th], [x, w, zt - th], [x, w, zt], [x, 0, zt + 4], [x, -w, zt]] as V[]; }));
    b.name('wing').mat(DARK, 0.1); { const sx = [4735, 4800, 4860, 4915], sy = [-0.8, -0.4, 0, 0.4, 0.8], q = (x: number, u: number): V => { const y = u * HALF(x); return [x, y, skin(x, y) + 5]; }; for (let i = 0; i + 1 < sx.length; i++) for (let j = 0; j + 1 < sy.length; j++) b.quad(q(sx[i]!, sy[j]!), q(sx[i + 1]!, sy[j]!), q(sx[i + 1]!, sy[j + 1]!), q(sx[i]!, sy[j + 1]!)); }   // the shadow in the gap under the blade
    for (const y of [-383, 383]) b.name('wing').mat(DARK, 0.2).box(4790, 4835, y - 9, y + 9, skin(4810, y) - 10, WING(4810) - 30);
    // under the tail: the dark venturi block rising to the back, one round exhaust each side low in it
    const dx = [4310, 4500, 4700, 4850, L - 30], low = (x: number) => 100 + 110 * ((x - 4310) / 620) ** 1.5;
    b.name('chassis').mat('#101114', 0.05).loft(dx.map(x => { const w = Math.min(840, HALF(x) - 70); return [[x, -w, low(x)], [x, w, low(x)], [x, w, BOT(x) + 14], [x, -w, BOT(x) + 14]] as V[]; }));
    b.name('bumperR').mat('#1d1f24', 0.15); for (const y of [-430, 430]) b.quad(P(y - 160, 150, 5), P(y + 160, 150, 5), P(y + 160, 400, 5), P(y - 160, 400, 5));   /* the valance's two recesses */
    for (const s of [1, -1]) { b.name('exhaust').mat(CHROME, 0.9, 'metal').lathe('x', [0, s * 700, 230], [[L - 90, 62], [L - 20, 70], [L - 8, 70], [L - 14, 56], [L - 90, 54]], 14, false);
      b.name('exhaust').mat(DARK, 0.05); fan(b, Array.from({ length: 12 }, (_, i) => { const t = i / 12 * Math.PI * 2; return [L - 70, s * 700 + Math.cos(t) * 55, 230 + Math.sin(t) * 55] as V; })); } }
  b.name('chassis').mat(DARK, 0.05).bar([FX, -WYF, RF], [FX, WYF, RF], 50).bar([RX, -WYR, RR], [RX, WYR, RR], 70);   // the axles' lines through the wells
  return b.mesh(L); }
export const mesh = xj220Mesh;
