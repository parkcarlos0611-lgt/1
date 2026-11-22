// The 1923 Ford Model T Fordor sedan as a low-polygon mesh (docs/systems/70_mesh_car_rules.md). Lengths are read off the
// sheet's side view as the part model holds them (data/cars/sheet/fordT23.json, 9.50 mm a pixel at the real 2540 mm
// wheelbase). The sheet draws this car tall and wide for its wheelbase (2146 high, 1868 across the wings, 846 mm wheels):
// every height and width is taken at 0.9 (YS, ZS), which gives the real 30 x 3.5 in wheel (762 mm), 1.93 m to the roof and
// 1.68 m across the wings; the numbers below are the sheet's, the wheels stand at the real 1422 mm track.
import { Build, type Mesh, type V } from './mesh';

const RUBBER = '#26242b', DARK = '#19191a', LENS = '#efe9cf', RED = '#c22c2b';
const C = {
  L: 3475, YS: 0.9, ZS: 0.9, FX: 427, RX: 2967, R: 381, WY: 711, TW: 100, RIMK: 0.77, SPOKES: 12,
  PAINT: '#232326', TOP: '#232326', WING: '#1d1d1e', ROOF: '#303034', VISOR: '#2b2b2e', NICKEL: '#8f8873', SHELLC: '#d8d0b4', SHELLG: 0.6, CORE: '#24242a', BADGE: '#8f8873',
  GLASS: '#acacac', STREAK: '#d0d2d3', WOOD: '#6a5637', SPOKE: '#8a6944', SPOKEK: 'wood' as const, BOARDC: '#4c4c50', TRIM: '#77777c', BEAD: '#3c3c3f', SEAM: '#0c0c0d', HINGE: '#4a4a4f', LAMPC: '#26272a', LAMPG: 0.45,
  // bonnet and scuttle: half-width, top, corner radius along x; the stations; the joint of bonnet and scuttle
  HW: [[471, 250], [1050, 385], [1110, 500], [1208, 600], [1300, 640]] as Tab, HT: [[471, 1337], [600, 1350], [1004, 1356], [1050, 1352], [1164, 1405], [1225, 1420], [1300, 1425]] as Tab, HR: [[471, 200], [1050, 200], [1110, 130], [1300, 100]] as Tab,
  HZB: 730, HX: [471, 600, 800, 1004, 1050, 1110, 1164, 1225, 1300], HJOIN: 1050, LOUV: [720, 992, 800, 1090, 6],
  // the body: half-width along x from the cabin's front (XF) to its back (XB), its bottom, the belt, the cabin skin's top
  W: [[1290, 640], [1330, 700], [1390, 730], [3200, 730], [3314, 686], [3379, 562], [3395, 430]] as Tab, XF: 1290, XB: 3395, ZB: 682, BELT: 1391, CTOP: 2035, RZB: 2013, ARCH: 60,
  TUCK: [[2700, 0.985], [3200, 0.86], [3395, 0.8]] as Tab, LEAN: [[3200, 0], [3395, 100]] as Tab,
  WIN: [[1443, 1942], [2072, 2545], [2658, 3114]], WZ: [1420, 1961], SCREEN: [450, 1470, 1890], SBARS: true, REARWIN: [354, 1525, 1889], RBAR: true,
  // the roof: [x, top, half-width] (inside the cabin's length it is at least the cabin's width), its edge radius; the visor [tip x, z0, z1, root x, z0, z1, half-width]
  RF: [[1250, 2058, 640], [1283, 2085, 700], [1335, 2106, 728], [1611, 2129, 734], [1982, 2142, 736], [3053, 2143, 736], [3262, 2141, 736], [3330, 2118, 700], [3375, 2085, 600], [3402, 2045, 440]], RR: 110,
  VIS: [1105, 1880, 1904, 1292, 1976, 2012, 584],
  SEAMS: [1405, 2005, 2600], HANDLES: [[1934, 2028, 1315], [2051, 2188, 1268]],
  SHELL: { x0: 372, x1: 471, w: 262, zb: 800, zt: 1342, r: 200, rim: 42 }, CAPH: 110,
  // wings: front [x, top, yIn, yOut, skirt y], rear [x, top, yOut]; the skirt's lowest; the rear wing's least inner edge
  FW: [[2, 982, 700, 880, 700], [15, 1010, 680, 915, 680], [58, 1036, 660, 930, 660], [118, 1062, 650, 934, 650], [241, 1090, 650, 934, 650], [364, 1098, 650, 934, 560], [607, 1067, 645, 934, 300], [689, 1030, 640, 934, 300], [771, 972, 635, 934, 310], [948, 775, 625, 934, 350], [1031, 720, 625, 934, 375], [1104, 688, 640, 925, 470], [1197, 675, 678, 900, 560]],
  RW: [[2482, 510, 892], [2483, 603, 900], [2508, 720, 925], [2548, 829, 946], [2616, 924, 946], [2707, 993, 946], [2820, 1042, 946], [2959, 1066, 946], [3101, 1059, 946], [3217, 1017, 946], [3333, 945, 946], [3421, 861, 930], [3452, 811, 915], [3471, 743, 880]],
  FSKZ: 650, RWIN: 660, BOARD: [1197, 2490, 682, 878, 455, 518],
  LAMP: { x0: 320, x1: 469, y: 388, z: 942, r: 118, sy: 388, sz: 640 }, LBAR: null as { x: number; y: number; z: number; c: string; g: number } | null,
  TAILS: [1], TAIL: { x: 3296, y: 300, z: 732, r: 72 },
  BF: null as { x: number; y: number; zs: number[][]; clamp: number; iron: number } | null,
  BR: null as { x: number; y0: number; y1: number; zs: number[][]; clamp: number } | null,
  SPARE: null as { x: number; z: number } | null, CRANK: true, TSPRING: true,
  // the dark under the car: its bottom, half-widths under the bonnet and the body, the rear wheel house [half-length, half-width, top]
  APRONX: 1104, U0: 450, UE: 290, UM: 592, HOUSE: [470, 690, 960],
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
  b.mat(RUBBER, 0.05, 'tyre').lathe('y', o, [[-h, rim], [-h, R - sec * 0.45], [-h * 0.45, R], [h * 0.45, R], [h, R - sec * 0.45], [h, rim]], 20, false);
  b.mat(DARK, 0.05).lathe('y', o, [[f * 0.35, 0], [f * 0.35, rim]], 20, false);
  b.mat(C.SPOKE, 0.3, C.SPOKEK).lathe('y', o, [[f * 0.9, rim + 3], [f * 0.9, rim - 30], [f * 0.35, rim - 30]], 20, false).lathe('y', o, [[f * 0.4, 80], [f * 1.0, 64], [f * 1.1, 40]], 10, false);
  for (let k = 0; k < C.SPOKES; k++) { const a = spin + k / C.SPOKES * Math.PI * 2, c = Math.cos(a), q = Math.sin(a); b.bar([x + c * 50, s * C.WY + f * 0.6, R + q * 50], [x + c * (rim - 26), s * C.WY + f * 0.6, R + q * (rim - 26)], 24, 30); }
  b.mat(C.NICKEL, 0.9, 'metal').lathe('y', o, [[f * 1.1, 42], [f * 1.1 + s * 30, 30], [f * 1.1 + s * 30, 0]], 10, false); }
interface Hole { p: V[]; n: V; bars?: boolean }

export function mesh(spin = 0): Mesh { const b = new Car(); b.ky = C.YS; b.kz = C.ZS;
  const { XF, XB, BELT, ZB, CTOP, RZB } = C, W = (x: number) => at(C.W, Math.min(x, XB)), HWf = (x: number) => at(C.HW, x), RWZ: Tab = C.RW.map(p => [p[0]!, p[1]!]), S = C.SHELL;
  const zbAt = (x: number) => Math.max(ZB, x > C.RW[1]![0]! && x < C.RX + 600 ? at(RWZ, x) - C.ARCH : 0);
  const side = (x: number) => x < XF ? HWf(x) : W(x);
  // ---- bonnet and scuttle: one skin from the radiator shell back to the cabin's front ----
  b.mat(C.PAINT, 0.45, 'paint');
  b.loft(C.HX.map(x => { const zt = at(C.HT, x); return ring(x, HWf(x), HWf(x), C.HZB, zt - 14, zt, at(C.HR, x)); }));
  // ---- the body below the belt: upright sides, tucked under at the back, cut up over the rear wheels ----
  const bx = uniq([XF, XB, ...C.W.map(p => p[0]), ...C.WIN.flat(), ...C.RW.map(p => p[0]!)]).filter(x => x >= XF && x <= XB);
  b.loft(bx.map(x => ring(x, W(x), W(x) * at(C.TUCK, x), zbAt(x), BELT, BELT, 0, at(C.LEAN, x))));
  // ---- the cabin: its skin as panels round the openings, the openings' reveals, the glass set in ----
  const holes: Hole[] = [], inWin = (x0: number, x1: number) => C.WIN.some(([a, c]) => x0 >= a! - 1 && x1 <= c! + 1), cz = [BELT, C.WZ[0]!, C.WZ[1]!, CTOP], yf = W(XF), yb = W(XB);
  b.mat(C.TOP, 0.45, 'canvas');
  for (const s of [1, -1]) { for (let i = 0; i + 1 < bx.length; i++) for (let j = 0; j < 3; j++) { const x0 = bx[i]!, x1 = bx[i + 1]!; if (j === 1 && inWin(x0, x1)) continue; b.quad([x0, s * W(x0), cz[j]!], [x1, s * W(x1), cz[j]!], [x1, s * W(x1), cz[j + 1]!], [x0, s * W(x0), cz[j + 1]!]); }
    for (const [x0, x1] of C.WIN as [number, number][]) holes.push({ p: [[x0, s * W(x0), cz[1]!], [x1, s * W(x1), cz[1]!], [x1, s * W(x1), cz[2]!], [x0, s * W(x0), cz[2]!]], n: [0, -s, 0] }); }
  const face = (x: number, yw: number, [gy, g0, g1]: number[], n: V, bars: boolean) => { const ys = [-yw, -gy!, gy!, yw], zs = [BELT, g0!, g1!, CTOP];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== 1 || j !== 1) b.quad([x, ys[i]!, zs[j]!], [x, ys[i + 1]!, zs[j]!], [x, ys[i + 1]!, zs[j + 1]!], [x, ys[i]!, zs[j + 1]!]);
    holes.push({ p: [[x, -gy!, g0!], [x, gy!, g0!], [x, gy!, g1!], [x, -gy!, g1!]], n, bars }); };
  face(XF, yf, C.SCREEN, [1, 0, 0], C.SBARS); face(XB, yb, C.REARWIN, [-1, 0, 0], false);
  const G = 24, inset = (h: Hole, d: number): V[] => h.p.map(q => [q[0] + h.n[0] * d, q[1] + h.n[1] * d, q[2] + h.n[2] * d] as V);
  b.mat(C.WOOD, 0.2, 'wood'); for (const h of holes) { const q = inset(h, G); for (let i = 0; i < 4; i++) b.quad(h.p[i]!, h.p[(i + 1) % 4]!, q[(i + 1) % 4]!, q[i]!); }
  b.mat(C.GLASS, 0.5, 'glass'); for (const h of holes) { const q = inset(h, G); b.quad(q[0]!, q[1]!, q[2]!, q[3]!); }
  const mix = (p: V, q: V, t: number): V => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  b.mat(C.STREAK, 0.5, 'shine'); for (const h of holes) { const q = inset(h, G - 3); b.quad(mix(q[0]!, q[1]!, 0.2), mix(q[0]!, q[1]!, 0.42), mix(q[3]!, q[2]!, 0.72), mix(q[3]!, q[2]!, 0.5)); }
  b.mat(C.WOOD, 0.2, 'wood'); for (const h of holes) if (h.bars) { const q = inset(h, G - 6); b.bar(mix(q[0]!, q[3]!, 0.36), mix(q[1]!, q[2]!, 0.36), 26).bar(mix(q[0]!, q[1]!, 0.5), mix(q[3]!, q[2]!, 0.5), 26); }
  if (C.RBAR) { const q = inset(holes[holes.length - 1]!, G - 6); b.bar(mix(mix(q[0]!, q[1]!, 0.5), mix(q[3]!, q[2]!, 0.5), 0.35), mix(q[3]!, q[2]!, 0.5), 22); }
  // ---- the roof and the visor ----
  b.mat(C.ROOF, 0.15, 'canvas');
  b.loft(C.RF.map(([x, zt, w0]) => { const w = x! >= XF && x! <= XB ? Math.max(w0!, W(x!) + 6) : w0!, zs = zt! - 6; return ring(x!, w, w, RZB, zs, zt!, Math.max(4, Math.min(C.RR, zs - RZB - 4))); }));
  { const [x0, a0, a1, x1, c0, c1, w] = C.VIS as [number, number, number, number, number, number, number], r = (x: number, k: number, z0: number, z1: number): V[] => [[x, -w * k, z0], [x, w * k, z0], [x, w * k, z1], [x, -w * k, z1]];
    b.mat(C.VISOR, 0.15, 'canvas').loft([r(x0, 0.94, a0, a1), r(x0 + 40, 1, a0 + (c0 - a0) * 0.15, a1 + (c1 - a1) * 0.3), r(x1, 1, c0, c1)]); }
  // ---- the bead along the belt, the doors' shut lines, the handles, the bonnet's hinge, louvres and joint ----
  b.mat(C.BEAD, 0.45); for (const s of [1, -1]) for (let i = 0; i + 1 < bx.length; i++) { const x0 = bx[i]!, x1 = bx[i + 1]!; b.quad([x0, s * (W(x0) + 5), BELT - 14], [x1, s * (W(x1) + 5), BELT - 14], [x1, s * (W(x1) + 5), BELT + 12], [x0, s * (W(x0) + 5), BELT + 12]); }
  b.quad([XB + 5, -yb, BELT - 14], [XB + 5, yb, BELT - 14], [XB + 5, yb, BELT + 12], [XB + 5, -yb, BELT + 12]);
  b.mat(C.SEAM, 0.1); for (const s of [1, -1]) { for (const x of C.SEAMS) { const y0 = s * (W(x) + 3), y1 = s * (W(x + 9) + 3); b.quad([x, y0, zbAt(x) + 10], [x + 9, y1, zbAt(x) + 10], [x + 9, y1, CTOP], [x, y0, CTOP]); }
    const [l0, l1, lz0, lz1, ln] = C.LOUV as [number, number, number, number, number]; for (let k = 0; k < ln; k++) { const x = l0 + (l1 - l0) * k / (ln - 1), y = s * (HWf(x) + 3); b.quad([x, y, lz0], [x + 11, y, lz0], [x + 11, y, lz1], [x, y, lz1]); }
    { const x = C.HJOIN, zt = at(C.HT, x) - 14 - at(C.HR, x); b.quad([x, s * (HWf(x) + 3), C.HZB], [x + 9, s * (HWf(x + 9) + 3), C.HZB], [x + 9, s * (HWf(x + 9) + 3), zt], [x, s * (HWf(x) + 3), zt]); } }
  b.mat(C.NICKEL, 0.9, 'metal'); for (const s of [1, -1]) for (const [x0, x1, z] of C.HANDLES) b.bar([x0!, s * (W(x0!) + 30), z!], [x1!, s * (W(x1!) + 30), z!], 16).bar([x1! - 12, s * (W(x1!) + 30), z!], [x1! - 12, s * W(x1!), z!], 14);
  b.mat(C.HINGE, 0.6).bar([S.x1 + 30, 0, at(C.HT, S.x1 + 30) + 2], [C.HJOIN, 0, at(C.HT, C.HJOIN) + 2], 14, 8);
  // ---- the nose: the radiator's shell, its dark core, the badge and the filler cap ----
  { const o = (x: number, d: number) => ring(x, S.w - d, S.w - d, S.zb + d, S.zt - d - 8, S.zt - d, Math.max(S.r - d, 12));
    b.mat(C.SHELLC, C.SHELLG, 'metal').loft([o(S.x1 + 6, 0), o(S.x0, 0), o(S.x0, S.rim), o(S.x0 + 34, S.rim)], false);
    b.mat(C.CORE, 0.05, 'grille').loft([o(S.x0 + 22, S.rim - 2), o(S.x0 + 40, S.rim - 2)]);
    b.mat(C.BADGE, 0.6).box(S.x0 - 4, S.x0 + 4, -55, 55, S.zt - S.rim + 12, S.zt - S.rim + 46);
    const cx = (S.x0 + S.x1) / 2; b.mat(C.NICKEL, 0.9, 'metal').box(cx - 26, cx + 26, -26, 26, S.zt - 4, S.zt + 40).box(cx - 9, cx + 9, -44, 44, S.zt + 40, S.zt + 62).box(cx - 8, cx + 8, -8, 8, S.zt + 62, S.zt + C.CAPH); }
  // ---- wings, running boards, lamps; each side ----
  for (const s of [1, -1] as const) { b.mat(C.WING, 0.45, 'paint');
    wing2(b, C.FW.map(([x, z, yi0, yo, ys]) => { const yi = x! > S.x1 ? Math.max(yi0!, side(x!) + 4) : yi0!; const sk = x! > C.APRONX - 10 ? yi : ys!; return [x!, z!, s * yi, s * yo!, s * sk, Math.max(Math.min(C.FSKZ, z! - 75), z! - 50 - 1.3 * (yi - sk))]; }), [C.FX, C.R / C.ZS - 150]);
    wing2(b, C.RW.map(([x, z, yo]) => { const yi = Math.max(C.RWIN, W(x!) - 25); return [x!, z!, s * yi, s * yo!, s * yi, z! - 60]; }), [C.RX, C.R / C.ZS - 150]);
    const [bx0, bx1, by0, by1, bz0, bz1] = C.BOARD as [number, number, number, number, number, number];
    b.mat(C.BOARDC, 0.1).box(bx0, bx1, Math.min(s * by0, s * by1), Math.max(s * by0, s * by1), bz0, bz1);
    b.mat(C.TRIM, 0.9, 'metal').box(bx0 + 60, bx1 - 10, Math.min(s * (by1 - 4), s * (by1 + 10)), Math.max(s * (by1 - 4), s * (by1 + 10)), bz0 + 6, bz1 + 4);
    const Lm = C.LAMP, lo: V = [0, s * Lm.y, Lm.z];
    b.mat(C.NICKEL, 0.9, 'metal').lathe('x', lo, [[Lm.x0, Lm.r - 10], [Lm.x0 + 8, Lm.r], [Lm.x0 + 46, Lm.r]], 14, false);
    b.mat(C.LAMPC, C.LAMPG, 'metal').lathe('x', lo, [[Lm.x0 + 46, Lm.r - 3], [Lm.x0 + (Lm.x1 - Lm.x0) * 0.62, Lm.r * 0.82], [Lm.x1 - 12, Lm.r * 0.45], [Lm.x1, Lm.r * 0.12]], 14);
    b.mat(LENS, 0.6, 'lens').lathe('x', lo, [[Lm.x0 - 5, 0], [Lm.x0 + 3, Lm.r - 10]], 14, false);
    b.mat(DARK, 0.05).bar([Lm.x0 + 80, s * Lm.y, Lm.z - Lm.r + 8], [Lm.x0 + 90, s * Lm.sy, Lm.sz], 30);
    if (C.TAILS.includes(s)) { const T = C.TAIL, to: V = [0, s * T.y, T.z]; b.mat(DARK, 0.05).bar([T.x - 60, s * (T.y - 30), T.z - 30], [T.x + 6, s * T.y, T.z], 24);
      b.mat(C.NICKEL, 0.9, 'metal').lathe('x', to, [[T.x, T.r - 14], [T.x + 10, T.r], [T.x + 34, T.r]], 10); b.mat(RED, 0.5).lathe('x', to, [[T.x + 34, T.r - 8], [T.x + 44, T.r - 22], [T.x + 46, 0]], 10, false); }
    if (C.BF) { b.mat(DARK, 0.05).bar([C.BF.x + 30, s * C.BF.iron, C.BF.zs[1]![0]! + 20], [S.x0 + 20, s * (C.BF.iron - 30), C.BF.zs[0]![1]!], 30); }
    if (C.BR) { const B = C.BR, y0 = Math.min(s * B.y0, s * B.y1), y1 = Math.max(s * B.y0, s * B.y1); b.mat(C.NICKEL, 0.9, 'metal'); for (const [z0, z1] of B.zs) b.box(B.x, B.x + 40, y0, y1, z0!, z1!);
      b.box(B.x - 4, B.x + 46, s * B.clamp - 20, s * B.clamp + 20, B.zs[1]![0]! - 8, B.zs[0]![1]! + 8); b.mat(DARK, 0.05).bar([XB - 120, s * (B.clamp - 20), B.zs[0]![0]! + 20], [B.x, s * B.clamp, B.zs[1]![1]! + 10], 30); } }
  // ---- across the car: the lamp bar, bumpers, the dark under the car and inside the wheel houses ----
  if (C.LBAR) { b.mat(C.LBAR.c, C.LBAR.g, 'metal').bar([C.LBAR.x, -C.LBAR.y, C.LBAR.z], [C.LBAR.x, C.LBAR.y, C.LBAR.z], 26); }
  if (C.BF) { const B = C.BF; b.mat(C.NICKEL, 0.9, 'metal'); for (const [z0, z1] of B.zs) b.box(B.x, B.x + 40, -B.y, B.y, z0!, z1!).box(B.x + 20, B.x + 110, -B.y, -B.y + 34, z0!, z1!).box(B.x + 20, B.x + 110, B.y - 34, B.y, z0!, z1!);
    for (const y of [-B.clamp, B.clamp]) b.box(B.x - 6, B.x + 46, y - 20, y + 20, B.zs[1]![0]! - 8, B.zs[0]![1]! + 8); }
  b.mat(DARK, 0.05).box(S.x0 + 40, XF + 40, -C.UE, C.UE, C.U0, C.HZB + 15).box(C.APRONX, XB - 70 - at(C.LEAN, XB), -C.UM, C.UM, C.U0, Math.min(ZB, C.HZB) + 15).box(C.RX - C.HOUSE[0]!, Math.min(C.RX + C.HOUSE[0]!, XB - 30 - at(C.LEAN, XB)), -C.HOUSE[1]!, C.HOUSE[1]!, C.U0, C.HOUSE[2]!).box(S.x0 - 150, S.x0 + 60, -C.UE + 20, C.UE - 20, C.U0 + 60, C.U0 + 150);
  if (C.CRANK) b.mat(C.NICKEL, 0.6, 'metal').bar([S.x0 - 150, 0, C.U0 + 105], [S.x0 - 215, 0, C.U0 + 105], 22).bar([S.x0 - 215, 0, C.U0 + 105], [S.x0 - 215, 60, C.U0 - 70], 22);
  if (C.SPARE) { const { x, z } = C.SPARE, o: V = [x, 0, z], R = C.R, rim = R * C.RIMK, h = C.TW / 2 + 5, sec = R - rim;
    b.mat(DARK, 0.05).box(XB - 30, x - h + 10, -150, 150, z - 200, z + 190);
    b.mat(RUBBER, 0.05, 'tyre').lathe('x', o, [[-h, rim], [-h, R - sec * 0.45], [-h * 0.45, R], [h * 0.45, R], [h, R - sec * 0.45], [h, rim]], 20, false);
    b.mat(DARK, 0.05).lathe('x', o, [[h * 0.35, 0], [h * 0.35, rim]], 20, false);
    b.mat(C.SPOKE, 0.3, C.SPOKEK).lathe('x', o, [[h * 0.9, rim + 3], [h * 0.9, rim - 30], [h * 0.35, rim - 30]], 20, false).lathe('x', o, [[h * 0.4, 80], [h, 64], [h * 1.1, 40]], 10, false);
    for (let k = 0; k < C.SPOKES; k++) { const a = k / C.SPOKES * Math.PI * 2, c = Math.cos(a), q = Math.sin(a); b.bar([x + h * 0.6, c * 50, z + q * 50], [x + h * 0.6, c * (rim - 26), z + q * (rim - 26)], 24, 30); }
    b.mat(C.NICKEL, 0.9, 'metal').lathe('x', o, [[h * 1.1, 42], [h * 1.1 + 30, 30], [h * 1.1 + 30, 0]], 10, false); }
  // ---- the wheels and axles at the real track and tyre size ----
  b.ky = 1; b.kz = 1;
  for (const s of [1, -1] as const) { wheel(b, C.FX, s, spin); wheel(b, C.RX, s, spin); }
  b.mat(DARK, 0.05).bar([C.FX, -C.WY, C.R - 30], [C.FX, C.WY, C.R - 30], 55).bar([C.RX, -C.WY, C.R], [C.RX, C.WY, C.R], 80).lathe('y', [C.RX, 0, C.R], [[-110, 60], [-60, 130], [60, 130], [110, 60]], 10);
  if (C.TSPRING) for (const s of [1, -1]) b.bar([C.FX + 20, 0, C.R + 190], [C.FX + 20, s * (C.WY - 110), C.R + 40], 50).bar([C.FX - 30, s * (C.WY - 90), C.R - 30], [C.FX + 700, s * 120, C.R + 20], 26);
  return b.mesh(C.L); }
