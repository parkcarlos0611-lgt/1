// The 1929 Plymouth Model U sedan as a low-polygon mesh (docs/systems/70_mesh_car_rules.md). Heights and lengths are
// read off the sheet's side view as the part model holds them (data/cars/sheet/plymU29.json, 8.62 mm a pixel at the
// real 2788 mm wheelbase), widths off its front, rear and plan views (overall 1.73 m across the wings, as the real car);
// the wheels stand at the real 1422 mm track on 4.75-20 tyres (750 mm across, where the sheet draws 768).
import { Build, type Mesh, type V } from './mesh';

const RUBBER = '#26242b', DARK = '#1b1b1c', LENS = '#efe9cf', RED = '#c22c2b';
const C = {
  L: 4051, YS: 1, ZS: 1, FX: 560, RX: 3348, R: 375, WY: 711, TW: 135, RIMK: 0.68, SPOKES: 14,
  PAINT: '#2a382d', TOP: '#28292a', WING: '#2d2e2f', ROOF: '#39393b', VISOR: '#2a2a2b', NICKEL: '#a59c8e', SHELLC: '#d6cfbc', SHELLG: 0.6, CORE: '#232428', BADGE: '#a59c8e',
  GLASS: '#a9abad', STREAK: '#cfd3d5', WOOD: '#4f3a28', SPOKE: '#2a382d', BOARDC: '#232325', TRIM: '#a59c8e', BEAD: '#3d5142', SEAM: '#131a15', HINGE: '#7d8c80', LAMPC: '#a59c8e', LAMPG: 0.9,
  // bonnet and scuttle: half-width, top, corner radius along x; the stations; the joint of bonnet and scuttle
  HW: [[556, 262], [1349, 495], [1430, 560], [1620, 625]] as Tab, HT: [[556, 1222], [865, 1232], [1349, 1238], [1451, 1258], [1517, 1267], [1560, 1280], [1620, 1288]] as Tab, HR: [[556, 105], [1349, 115], [1620, 170]] as Tab,
  HZB: 530, HX: [556, 700, 950, 1200, 1349, 1451, 1540, 1620], HJOIN: 1349, LOUV: [666, 1239, 657, 1080, 22],
  // the body: half-width along x from the cabin's front (XF) to its back (XB), its bottom, the belt, the cabin skin's top
  W: [[1610, 645], [1682, 675], [2085, 685], [2981, 695], [3562, 695], [3698, 675], [3782, 625], [3836, 544], [3866, 440]] as Tab, XF: 1610, XB: 3866, ZB: 504, BELT: 1183, CTOP: 1652, RZB: 1629, ARCH: 60,
  TUCK: [[3000, 0.975], [3600, 0.92], [3866, 0.86]] as Tab, LEAN: [[3600, 0], [3866, 70]] as Tab,
  WIN: [[1771, 2331], [2508, 3055], [3206, 3564]], WZ: [1250, 1595], SCREEN: [430, 1300, 1585], SBARS: false, REARWIN: [298, 1324, 1542], RBAR: false,
  // the roof: [x, top, half-width] (inside the cabin's length it is at least the cabin's width), its edge radius; the visor [tip x, z0, z1, root x, z0, z1, half-width]
  RF: [[1570, 1690, 520], [1596, 1726, 610], [1701, 1754, 660], [1895, 1782, 680], [2132, 1798, 690], [2387, 1810, 700], [3493, 1810, 700], [3686, 1782, 690], [3765, 1754, 650], [3820, 1720, 600], [3872, 1662, 440]], RR: 150,
  VIS: [1491, 1612, 1626, 1612, 1597, 1698, 540],
  SEAMS: [1680, 2415, 3125], HANDLES: [[2232, 2375, 1080], [2456, 2603, 1080]],
  SHELL: { x0: 456, x1: 556, w: 272, zb: 520, zt: 1231, r: 100, rim: 66 }, CAPH: 120,
  // wings: front [x, top, yIn, yOut, skirt y], rear [x, top, yOut]; the skirt's lowest; the rear wing's least inner edge
  FW: [[148, 732, 620, 800, 600], [171, 803, 610, 830, 580], [216, 851, 605, 850, 540], [288, 897, 600, 862, 480], [390, 918, 600, 866, 400], [540, 929, 600, 866, 300], [692, 905, 600, 866, 290], [842, 838, 600, 866, 335], [917, 790, 600, 866, 355], [993, 705, 600, 864, 378], [1069, 616, 600, 860, 400], [1144, 542, 600, 855, 420], [1220, 492, 602, 848, 445], [1295, 452, 605, 840, 465], [1370, 430, 610, 825, 500], [1476, 419, 620, 805, 560]],
  RW: [[2816, 370, 814], [2818, 526, 825], [2829, 641, 840], [2867, 739, 850], [2931, 817, 850], [2999, 860, 850], [3107, 908, 850], [3216, 933, 850], [3325, 937, 850], [3431, 910, 850], [3537, 851, 850], [3644, 762, 850], [3708, 668, 850], [3771, 530, 845], [3835, 426, 830], [3909, 379, 790], [3931, 362, 720]],
  FSKZ: 545, RWIN: 570, BOARD: [1400, 2820, 624, 832, 285, 353],
  LAMP: { x0: 330, x1: 502, y: 376, z: 975, r: 114, sy: 390, sz: 782 }, LBAR: { x: 432, y: 600, z: 782, c: '#a59c8e', g: 0.9 } as { x: number; y: number; z: number; c: string; g: number } | null,
  TAILS: [1], TAIL: { x: 3875, y: 564, z: 743, r: 60 },
  BF: { x: 2, y: 776, zs: [[456, 496], [368, 408]], clamp: 345, iron: 345 } as { x: number; y: number; zs: number[][]; clamp: number; iron: number } | null,
  BR: { x: 3995, y0: 443, y1: 798, zs: [[492, 537], [406, 450]], clamp: 475 } as { x: number; y0: number; y1: number; zs: number[][]; clamp: number } | null,
  SPARE: { x: 3950, z: 691 } as { x: number; z: number } | null, CRANK: false, TSPRING: false,
  // the dark under the car: its bottom, half-widths under the bonnet and the body, the rear wheel house [half-length, half-width, top]
  APRONX: 1144, U0: 270, UE: 300, UM: 592, HOUSE: [440, 632, 790],
};
type Tab = [number, number][];
/** linear reading of a table of [x, value] */
const at = (tab: Tab, x: number) => { if (x <= tab[0]![0]) return tab[0]![1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i]![0]) { const [x0, v0] = tab[i - 1]!, [x1, v1] = tab[i]!; return v0 + (v1 - v0) * (x - x0) / (x1 - x0); } return tab[tab.length - 1]![1]; };
const uniq = (a: number[]) => [...new Set(a.map(v => Math.round(v)))].sort((p, q) => p - q);
/** the builder with the sheet's cross and upright measures brought to the real car's (YS, ZS); the wheels are added unscaled */
class Car extends Build { ky = 1; kz = 1;
  override tri(a: V, b: V, c: V): this { const f = (p: V): V => [p[0], p[1] * this.ky, p[2] * this.kz]; return super.tri(f(a), f(b), f(c)); } }
/** a body ring at x: a flat bottom of half-width wb at zb, upright sides at half-width w up to the shoulder zs less the
 *  corner radius r, the crown zt on the centre line; `lean` carries the bottom forward (a back panel that tucks under) */
function ring(x: number, w: number, wb: number, zb: number, zs: number, zt: number, r = 0, lean = 0): V[] {
  const h: Tab = [[wb, zb], [w, zb + (zs - r - zb) * 0.45], [w, zs - r], [w - r * 0.134, zs - r * 0.5], [w - r * 0.5, zs - r * 0.134], [w - r, zs], [(w - r) * 0.55, zs + (zt - zs) * 0.8]];
  const px = (z: number) => x - lean * Math.max(0, (zs - z) / Math.max(1, zs - zb)), L = h.map(([y, z]) => [px(z), y, z] as V);
  return [...L, [x, 0, zt], ...h.map(([y, z]) => [px(z), -y, z] as V).reverse()]; }
/** a wing: a crowned strip swept along a path seen from the side, with a skirt from its inner edge down to the body or
 *  frame. Each point is [x, zTop, yIn, yOut, ySkirt, zSkirt]; `hub` is the wheel's centre it stands over */
function wing2(b: Build, path: number[][], hub: [number, number], t = 40, crown = 40): void {
  b.loft(path.map((p, i): V[] => { const a = path[Math.max(0, i - 1)]!, c = path[Math.min(path.length - 1, i + 1)]!, tx = c[0]! - a[0]!, tz = c[1]! - a[1]!, l = Math.hypot(tx, tz) || 1; let nx = -tz / l, nz = tx / l; if (nx * (p[0]! - hub[0]) + nz * (p[1]! - hub[1]) < 0) { nx = -nx; nz = -nz; }
    const [x, z, yi, yo, ys, zs] = p as [number, number, number, number, number, number], ym = (yi + yo) / 2, o = (y: number, k: number): V => [x + nx * k, y, z + nz * k];
    return [[x, ys, zs], o(yi, -crown * 0.4), o(ym, crown * 0.6), o(yo, -crown * 0.6), o(yo, -t - crown * 0.6), o(yi, -t)]; })); }
/** a wooden (artillery) wheel on the axle across the car: tyre, the dark behind, felloe, flat spokes, hub and its bright cap */
function wheel(b: Build, x: number, s: 1 | -1, spin = 0) { const o: V = [x, s * C.WY, C.R], R = C.R, rim = R * C.RIMK, h = C.TW / 2, f = s * h, sec = R - rim;
  b.mat(RUBBER, 0.05).lathe('y', o, [[-h, rim], [-h, R - sec * 0.45], [-h * 0.45, R], [h * 0.45, R], [h, R - sec * 0.45], [h, rim]], 20, false);
  b.mat(DARK, 0.05).lathe('y', o, [[f * 0.35, 0], [f * 0.35, rim]], 20, false);
  b.mat(C.SPOKE, 0.3).lathe('y', o, [[f * 0.9, rim + 3], [f * 0.9, rim - 30], [f * 0.35, rim - 30]], 20, false).lathe('y', o, [[f * 0.4, 80], [f * 1.0, 64], [f * 1.1, 40]], 10, false);
  for (let k = 0; k < C.SPOKES; k++) { const a = spin + k / C.SPOKES * Math.PI * 2, c = Math.cos(a), q = Math.sin(a); b.bar([x + c * 50, s * C.WY + f * 0.6, R + q * 50], [x + c * (rim - 26), s * C.WY + f * 0.6, R + q * (rim - 26)], 24, 30); }
  b.mat(C.NICKEL, 0.9).lathe('y', o, [[f * 1.1, 42], [f * 1.1 + s * 30, 30], [f * 1.1 + s * 30, 0]], 10, false); }
interface Hole { p: V[]; n: V; bars?: boolean }

export function mesh(spin = 0): Mesh { const b = new Car(); b.ky = C.YS; b.kz = C.ZS;
  const { XF, XB, BELT, ZB, CTOP, RZB } = C, W = (x: number) => at(C.W, Math.min(x, XB)), HWf = (x: number) => at(C.HW, x), RWZ: Tab = C.RW.map(p => [p[0]!, p[1]!]), S = C.SHELL;
  const zbAt = (x: number) => Math.max(ZB, x > C.RW[1]![0]! && x < C.RX + 600 ? at(RWZ, x) - C.ARCH : 0);
  const side = (x: number) => x < XF ? HWf(x) : W(x);
  // ---- bonnet and scuttle: one skin from the radiator shell back to the cabin's front ----
  b.mat(C.PAINT, 0.45);
  b.loft(C.HX.map(x => { const zt = at(C.HT, x); return ring(x, HWf(x), HWf(x), C.HZB, zt - 14, zt, at(C.HR, x)); }));
  // ---- the body below the belt: upright sides, tucked under at the back, cut up over the rear wheels ----
  const bx = uniq([XF, XB, ...C.W.map(p => p[0]), ...C.WIN.flat(), ...C.RW.map(p => p[0]!)]).filter(x => x >= XF && x <= XB);
  b.loft(bx.map(x => ring(x, W(x), W(x) * at(C.TUCK, x), zbAt(x), BELT, BELT, 0, at(C.LEAN, x))));
  // ---- the cabin: its skin as panels round the openings, the openings' reveals, the glass set in ----
  const holes: Hole[] = [], inWin = (x0: number, x1: number) => C.WIN.some(([a, c]) => x0 >= a! - 1 && x1 <= c! + 1), cz = [BELT, C.WZ[0]!, C.WZ[1]!, CTOP], yf = W(XF), yb = W(XB);
  b.mat(C.TOP, 0.45);
  for (const s of [1, -1]) { for (let i = 0; i + 1 < bx.length; i++) for (let j = 0; j < 3; j++) { const x0 = bx[i]!, x1 = bx[i + 1]!; if (j === 1 && inWin(x0, x1)) continue; b.quad([x0, s * W(x0), cz[j]!], [x1, s * W(x1), cz[j]!], [x1, s * W(x1), cz[j + 1]!], [x0, s * W(x0), cz[j + 1]!]); }
    for (const [x0, x1] of C.WIN as [number, number][]) holes.push({ p: [[x0, s * W(x0), cz[1]!], [x1, s * W(x1), cz[1]!], [x1, s * W(x1), cz[2]!], [x0, s * W(x0), cz[2]!]], n: [0, -s, 0] }); }
  const face = (x: number, yw: number, [gy, g0, g1]: number[], n: V, bars: boolean) => { const ys = [-yw, -gy!, gy!, yw], zs = [BELT, g0!, g1!, CTOP];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== 1 || j !== 1) b.quad([x, ys[i]!, zs[j]!], [x, ys[i + 1]!, zs[j]!], [x, ys[i + 1]!, zs[j + 1]!], [x, ys[i]!, zs[j + 1]!]);
    holes.push({ p: [[x, -gy!, g0!], [x, gy!, g0!], [x, gy!, g1!], [x, -gy!, g1!]], n, bars }); };
  face(XF, yf, C.SCREEN, [1, 0, 0], C.SBARS); face(XB, yb, C.REARWIN, [-1, 0, 0], false);
  const G = 24, inset = (h: Hole, d: number): V[] => h.p.map(q => [q[0] + h.n[0] * d, q[1] + h.n[1] * d, q[2] + h.n[2] * d] as V);
  b.mat(C.WOOD, 0.2); for (const h of holes) { const q = inset(h, G); for (let i = 0; i < 4; i++) b.quad(h.p[i]!, h.p[(i + 1) % 4]!, q[(i + 1) % 4]!, q[i]!); }
  b.mat(C.GLASS, 0.5); for (const h of holes) { const q = inset(h, G); b.quad(q[0]!, q[1]!, q[2]!, q[3]!); }
  const mix = (p: V, q: V, t: number): V => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  b.mat(C.STREAK, 0.5); for (const h of holes) { const q = inset(h, G - 3); b.quad(mix(q[0]!, q[1]!, 0.2), mix(q[0]!, q[1]!, 0.42), mix(q[3]!, q[2]!, 0.72), mix(q[3]!, q[2]!, 0.5)); }
  b.mat(C.WOOD, 0.2); for (const h of holes) if (h.bars) { const q = inset(h, G - 6); b.bar(mix(q[0]!, q[3]!, 0.36), mix(q[1]!, q[2]!, 0.36), 26).bar(mix(q[0]!, q[1]!, 0.5), mix(q[3]!, q[2]!, 0.5), 26); }
  if (C.RBAR) { const q = inset(holes[holes.length - 1]!, G - 6); b.bar(mix(mix(q[0]!, q[1]!, 0.5), mix(q[3]!, q[2]!, 0.5), 0.35), mix(q[3]!, q[2]!, 0.5), 22); }
  // ---- the roof and the visor ----
  b.mat(C.ROOF, 0.15);
  b.loft(C.RF.map(([x, zt, w0]) => { const w = x! >= XF && x! <= XB ? Math.max(w0!, W(x!) + 6) : w0!, zs = zt! - 6; return ring(x!, w, w, RZB, zs, zt!, Math.max(4, Math.min(C.RR, zs - RZB - 4))); }));
  { const [x0, a0, a1, x1, c0, c1, w] = C.VIS as [number, number, number, number, number, number, number], r = (x: number, k: number, z0: number, z1: number): V[] => [[x, -w * k, z0], [x, w * k, z0], [x, w * k, z1], [x, -w * k, z1]];
    b.mat(C.VISOR, 0.15).loft([r(x0, 0.94, a0, a1), r(x0 + 40, 1, a0 + (c0 - a0) * 0.15, a1 + (c1 - a1) * 0.3), r(x1, 1, c0, c1)]); }
  // ---- the bead along the belt, the doors' shut lines, the handles, the bonnet's hinge, louvres and joint ----
  b.mat(C.BEAD, 0.45); for (const s of [1, -1]) for (let i = 0; i + 1 < bx.length; i++) { const x0 = bx[i]!, x1 = bx[i + 1]!; b.quad([x0, s * (W(x0) + 5), BELT - 14], [x1, s * (W(x1) + 5), BELT - 14], [x1, s * (W(x1) + 5), BELT + 12], [x0, s * (W(x0) + 5), BELT + 12]); }
  b.quad([XB + 5, -yb, BELT - 14], [XB + 5, yb, BELT - 14], [XB + 5, yb, BELT + 12], [XB + 5, -yb, BELT + 12]);
  b.mat(C.SEAM, 0.1); for (const s of [1, -1]) { for (const x of C.SEAMS) { const y0 = s * (W(x) + 3), y1 = s * (W(x + 9) + 3); b.quad([x, y0, zbAt(x) + 10], [x + 9, y1, zbAt(x) + 10], [x + 9, y1, CTOP], [x, y0, CTOP]); }
    const [l0, l1, lz0, lz1, ln] = C.LOUV as [number, number, number, number, number]; for (let k = 0; k < ln; k++) { const x = l0 + (l1 - l0) * k / (ln - 1), y = s * (HWf(x) + 3); b.quad([x, y, lz0], [x + 11, y, lz0], [x + 11, y, lz1], [x, y, lz1]); }
    { const x = C.HJOIN, zt = at(C.HT, x) - 14 - at(C.HR, x); b.quad([x, s * (HWf(x) + 3), C.HZB], [x + 9, s * (HWf(x + 9) + 3), C.HZB], [x + 9, s * (HWf(x + 9) + 3), zt], [x, s * (HWf(x) + 3), zt]); } }
  b.mat(C.NICKEL, 0.9); for (const s of [1, -1]) for (const [x0, x1, z] of C.HANDLES) b.bar([x0!, s * (W(x0!) + 30), z!], [x1!, s * (W(x1!) + 30), z!], 16).bar([x1! - 12, s * (W(x1!) + 30), z!], [x1! - 12, s * W(x1!), z!], 14);
  b.mat(C.HINGE, 0.6).bar([S.x1 + 30, 0, at(C.HT, S.x1 + 30) + 2], [C.HJOIN, 0, at(C.HT, C.HJOIN) + 2], 14, 8);
  // ---- the nose: the radiator's shell, its dark core, the badge and the filler cap ----
  { const o = (x: number, d: number) => ring(x, S.w - d, S.w - d, S.zb + d, S.zt - d - 8, S.zt - d, Math.max(S.r - d, 12));
    b.mat(C.SHELLC, C.SHELLG).loft([o(S.x1 + 6, 0), o(S.x0, 0), o(S.x0, S.rim), o(S.x0 + 34, S.rim)], false);
    b.mat(C.CORE, 0.05).loft([o(S.x0 + 22, S.rim - 2), o(S.x0 + 40, S.rim - 2)]);
    b.mat(C.BADGE, 0.6).box(S.x0 - 4, S.x0 + 4, -55, 55, S.zt - S.rim + 12, S.zt - S.rim + 46);
    const cx = (S.x0 + S.x1) / 2; b.mat(C.NICKEL, 0.9).box(cx - 26, cx + 26, -26, 26, S.zt - 4, S.zt + 40).box(cx - 9, cx + 9, -44, 44, S.zt + 40, S.zt + 62).box(cx - 8, cx + 8, -8, 8, S.zt + 62, S.zt + C.CAPH); }
  // ---- wings, running boards, lamps; each side ----
  for (const s of [1, -1] as const) { b.mat(C.WING, 0.45);
    wing2(b, C.FW.map(([x, z, yi0, yo, ys]) => { const yi = x! > S.x1 ? Math.max(yi0!, side(x!) + 4) : yi0!; const sk = x! > C.APRONX - 10 ? yi : ys!; return [x!, z!, s * yi, s * yo!, s * sk, Math.max(Math.min(C.FSKZ, z! - 75), z! - 50 - 1.3 * (yi - sk))]; }), [C.FX, C.R / C.ZS - 150]);
    wing2(b, C.RW.map(([x, z, yo]) => { const yi = Math.max(C.RWIN, W(x!) - 25); return [x!, z!, s * yi, s * yo!, s * yi, z! - 60]; }), [C.RX, C.R / C.ZS - 150]);
    const [bx0, bx1, by0, by1, bz0, bz1] = C.BOARD as [number, number, number, number, number, number];
    b.mat(C.BOARDC, 0.1).box(bx0, bx1, Math.min(s * by0, s * by1), Math.max(s * by0, s * by1), bz0, bz1);
    b.mat(C.TRIM, 0.9).box(bx0 + 60, bx1 - 10, Math.min(s * (by1 - 4), s * (by1 + 10)), Math.max(s * (by1 - 4), s * (by1 + 10)), bz0 + 6, bz1 + 4);
    const Lm = C.LAMP, lo: V = [0, s * Lm.y, Lm.z];
    b.mat(C.NICKEL, 0.9).lathe('x', lo, [[Lm.x0, Lm.r - 10], [Lm.x0 + 8, Lm.r], [Lm.x0 + 46, Lm.r]], 14, false);
    b.mat(C.LAMPC, C.LAMPG).lathe('x', lo, [[Lm.x0 + 46, Lm.r - 3], [Lm.x0 + (Lm.x1 - Lm.x0) * 0.62, Lm.r * 0.82], [Lm.x1 - 12, Lm.r * 0.45], [Lm.x1, Lm.r * 0.12]], 14);
    b.mat(LENS, 0.6).lathe('x', lo, [[Lm.x0 - 5, 0], [Lm.x0 + 3, Lm.r - 10]], 14, false);
    b.mat(DARK, 0.05).bar([Lm.x0 + 80, s * Lm.y, Lm.z - Lm.r + 8], [Lm.x0 + 90, s * Lm.sy, Lm.sz], 30);
    if (C.TAILS.includes(s)) { const T = C.TAIL, to: V = [0, s * T.y, T.z]; b.mat(DARK, 0.05).bar([T.x - 60, s * (T.y - 30), T.z - 30], [T.x + 6, s * T.y, T.z], 24);
      b.mat(C.NICKEL, 0.9).lathe('x', to, [[T.x, T.r - 14], [T.x + 10, T.r], [T.x + 34, T.r]], 10); b.mat(RED, 0.5).lathe('x', to, [[T.x + 34, T.r - 8], [T.x + 44, T.r - 22], [T.x + 46, 0]], 10, false); }
    if (C.BF) { b.mat(DARK, 0.05).bar([C.BF.x + 30, s * C.BF.iron, C.BF.zs[1]![0]! + 20], [S.x0 + 20, s * (C.BF.iron - 30), C.BF.zs[0]![1]!], 30); }
    if (C.BR) { const B = C.BR, y0 = Math.min(s * B.y0, s * B.y1), y1 = Math.max(s * B.y0, s * B.y1); b.mat(C.NICKEL, 0.9); for (const [z0, z1] of B.zs) b.box(B.x, B.x + 40, y0, y1, z0!, z1!);
      b.box(B.x - 4, B.x + 46, s * B.clamp - 20, s * B.clamp + 20, B.zs[1]![0]! - 8, B.zs[0]![1]! + 8); b.mat(DARK, 0.05).bar([XB - 120, s * (B.clamp - 20), B.zs[0]![0]! + 20], [B.x, s * B.clamp, B.zs[1]![1]! + 10], 30); } }
  // ---- across the car: the lamp bar, bumpers, the dark under the car and inside the wheel houses ----
  if (C.LBAR) { b.mat(C.LBAR.c, C.LBAR.g).bar([C.LBAR.x, -C.LBAR.y, C.LBAR.z], [C.LBAR.x, C.LBAR.y, C.LBAR.z], 26); }
  if (C.BF) { const B = C.BF; b.mat(C.NICKEL, 0.9); for (const [z0, z1] of B.zs) b.box(B.x, B.x + 40, -B.y, B.y, z0!, z1!).box(B.x + 20, B.x + 110, -B.y, -B.y + 34, z0!, z1!).box(B.x + 20, B.x + 110, B.y - 34, B.y, z0!, z1!);
    for (const y of [-B.clamp, B.clamp]) b.box(B.x - 6, B.x + 46, y - 20, y + 20, B.zs[1]![0]! - 8, B.zs[0]![1]! + 8); }
  b.mat(DARK, 0.05).box(S.x0 + 40, XF + 40, -C.UE, C.UE, C.U0, C.HZB + 15).box(C.APRONX, XB - 70 - at(C.LEAN, XB), -C.UM, C.UM, C.U0, Math.min(ZB, C.HZB) + 15).box(C.RX - C.HOUSE[0]!, Math.min(C.RX + C.HOUSE[0]!, XB - 30 - at(C.LEAN, XB)), -C.HOUSE[1]!, C.HOUSE[1]!, C.U0, C.HOUSE[2]!).box(S.x0 - 150, S.x0 + 60, -C.UE + 20, C.UE - 20, C.U0 + 60, C.U0 + 150);
  if (C.CRANK) b.mat(C.NICKEL, 0.6).bar([S.x0 - 150, 0, C.U0 + 105], [S.x0 - 215, 0, C.U0 + 105], 22).bar([S.x0 - 215, 0, C.U0 + 105], [S.x0 - 215, 60, C.U0 - 70], 22);
  if (C.SPARE) { const { x, z } = C.SPARE, o: V = [x, 0, z], R = C.R, rim = R * C.RIMK, h = C.TW / 2 + 5, sec = R - rim;
    b.mat(DARK, 0.05).box(XB - 30, x - h + 10, -150, 150, z - 200, z + 190);
    b.mat(RUBBER, 0.05).lathe('x', o, [[-h, rim], [-h, R - sec * 0.45], [-h * 0.45, R], [h * 0.45, R], [h, R - sec * 0.45], [h, rim]], 20, false);
    b.mat(DARK, 0.05).lathe('x', o, [[h * 0.35, 0], [h * 0.35, rim]], 20, false);
    b.mat(C.SPOKE, 0.3).lathe('x', o, [[h * 0.9, rim + 3], [h * 0.9, rim - 30], [h * 0.35, rim - 30]], 20, false).lathe('x', o, [[h * 0.4, 80], [h, 64], [h * 1.1, 40]], 10, false);
    for (let k = 0; k < C.SPOKES; k++) { const a = k / C.SPOKES * Math.PI * 2, c = Math.cos(a), q = Math.sin(a); b.bar([x + h * 0.6, c * 50, z + q * 50], [x + h * 0.6, c * (rim - 26), z + q * (rim - 26)], 24, 30); }
    b.mat(C.NICKEL, 0.9).lathe('x', o, [[h * 1.1, 42], [h * 1.1 + 30, 30], [h * 1.1 + 30, 0]], 10, false); }
  // ---- the wheels and axles at the real track and tyre size ----
  b.ky = 1; b.kz = 1;
  for (const s of [1, -1] as const) { wheel(b, C.FX, s, spin); wheel(b, C.RX, s, spin); }
  b.mat(DARK, 0.05).bar([C.FX, -C.WY, C.R - 30], [C.FX, C.WY, C.R - 30], 55).bar([C.RX, -C.WY, C.R], [C.RX, C.WY, C.R], 80).lathe('y', [C.RX, 0, C.R], [[-110, 60], [-60, 130], [60, 130], [110, 60]], 10);
  if (C.TSPRING) for (const s of [1, -1]) b.bar([C.FX + 20, 0, C.R + 190], [C.FX + 20, s * (C.WY - 110), C.R + 40], 50).bar([C.FX - 30, s * (C.WY - 90), C.R - 30], [C.FX + 700, s * 120, C.R + 20], 26);
  return b.mesh(C.L); }
