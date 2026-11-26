// The 1935 BMW 315/1 Roadster as a low-polygon mesh (docs/systems/70_mesh_car_rules.md). Lengths and heights are read
// off the sheet's side view (data/cars/sheet/bmw315.json, at the real wheelbase 2400), widths off its plan brought to
// the real 1440 mm overall (the model's plan is 1668 wide: SW). The sheet draws the wheels 13 % large: the tyres here are
// the real 5.25-16 (radius 345) at the real tracks (1153 front, 1220 rear), the body set 30 mm lower (DZ) and the
// wheel arches drawn round the real wheels. Open two-seater; no emblem on nose, tail or caps (a standing decision).
import { Build, section, type Mesh, type V } from './mesh';

const PAINT = '#ddcfb4', PAINT2 = '#cdbf9f', SEAM = '#8f8468', CHROME = '#c9cbcf', LEATHER = '#82482a', LEATHER2 = '#995837', STRAP = '#8a4d2e', CANVAS = '#3d332f', GLASS = '#a9c6d6', RUBBER = '#26242b', DARK = '#1c1b1b', LENS = '#efe9cf', RED = '#c22c2b';
const FX = 511, RX = 2911, R = 345, WYF = 576, WYR = 610, TW = 135, L = 3634, SW = 1440 / 1668, DZ = -30, HUB = R - DZ, ARCH = 385, FLOOR = 440;
/** the builder with everything lowered by `dz`: the body is written in the sheet's heights */
class Low extends Build { dz = 0; override tri(a: V, b: V, c: V): this { const d = this.dz; return super.tri([a[0], a[1], a[2] + d], [b[0], b[1], b[2] + d], [c[0], c[1], c[2] + d]); } }
/** linear reading of a table of [x, value] */
const at = (tab: [number, number][], x: number) => { if (x <= tab[0]![0]) return tab[0]![1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i]![0]) { const [x0, v0] = tab[i - 1]!, [x1, v1] = tab[i]!; return v0 + (v1 - v0) * (x - x0) / (x1 - x0); } return tab[tab.length - 1]![1]; };
const wide = (t: [number, number][]) => t.map(([x, w]) => [x, w * SW] as [number, number]);
// the body along the car: half-width (plan), top and bottom (side view), how square its upper half is (front and rear views)
const HALF = wide([[62, 40], [67, 58], [87, 136], [127, 195], [140, 238], [300, 300], [468, 335], [802, 425], [1069, 497], [1336, 569], [1670, 600], [1804, 604], [2301, 604], [2505, 623], [2672, 619], [3006, 594], [3173, 565], [3384, 502], [3490, 419], [3553, 312], [3585, 156], [3595, 46]]);
const TOP: [number, number][] = [[62, 600], [73, 645], [147, 759], [261, 840], [423, 914], [570, 964], [651, 1024], [749, 1059], [847, 1075], [977, 1083], [1303, 1088], [1700, 1088], [1756, 1080], [2480, 940], [2540, 965], [3061, 1000], [3126, 979], [3191, 938], [3256, 870], [3321, 783], [3387, 697], [3452, 616], [3517, 528], [3574, 425], [3595, 372]];
const BOT: [number, number][] = [[62, 400], [75, 330], [100, 300], [900, 290], [3305, 275], [3574, 332], [3595, 348]];
const SQ: [number, number][] = [[62, 2.5], [423, 3], [977, 3.6], [1700, 4.4], [2480, 5], [3061, 4.5], [3400, 3.5], [3595, 2.5]];
const BELT: [number, number][] = [[1762, 950], [1830, 940], [1872, 922], [1954, 860], [2051, 821], [2182, 800], [2279, 798], [2345, 805], [2393, 840], [2442, 897], [2478, 930]];   // the doors' tops
const ring = (x: number, grow = 0, k = 20) => section(x, at(HALF, x) + grow, at(BOT, x) - grow, at(TOP, x) + grow, at(SQ, x), 6, k);
const inside = (x: number, y: number, z: number) => { const w = at(HALF, x), zb = at(BOT, x), zt = at(TOP, x), zc = (zb + zt) / 2, n = z >= zc ? at(SQ, x) : 6; return (Math.abs(y) / w) ** n + (Math.abs(z - zc) / ((zt - zb) / 2)) ** n <= 1; };
/** the skin: its height at y across the body at x, its half-width at height z, and how far back the nose's skin lies at (y, z) */
const skinZ = (x: number, y: number) => { const w = at(HALF, x), zb = at(BOT, x), zt = at(TOP, x), n = at(SQ, x), u = Math.min(1, Math.abs(y) / w); return (zb + zt) / 2 + (zt - zb) / 2 * (1 - u ** n) ** (1 / n); };
const skinY = (x: number, z: number) => { const w = at(HALF, x), zb = at(BOT, x), zt = at(TOP, x), zc = (zb + zt) / 2, n = z >= zc ? at(SQ, x) : 6, u = Math.min(1, Math.abs(z - zc) / ((zt - zb) / 2)); return w * (1 - u ** n) ** (1 / n); };
const skinX = (y: number, z: number) => { let a = 55, c = 900; for (let i = 0; i < 24; i++) { const m = (a + c) / 2; if (inside(m, y, z)) c = m; else a = m; } return c; };
// the wings: crown (side view), outer and inner edge (plan), front then rear
const FW_TOP: [number, number][] = [[8, 500], [10, 507], [23, 580], [49, 645], [85, 710], [130, 767], [187, 821], [252, 860], [326, 893], [407, 915], [505, 928], [602, 932], [700, 922], [798, 893], [895, 844], [993, 779], [1091, 707], [1189, 637], [1286, 567], [1384, 510], [1498, 458], [1628, 417], [1758, 391], [1889, 376], [2051, 368], [2250, 365]];
const FW_OUT = wide([[8, 600], [10, 693], [27, 756], [67, 798], [134, 822], [267, 826], [534, 795], [802, 756], [1069, 717], [1336, 685], [1670, 658], [1804, 670], [2004, 693], [2250, 728]]);
const FW_IN = wide([[8, 527], [140, 492], [200, 505], [334, 389], [468, 322], [802, 412], [1069, 484], [1336, 556], [1670, 585], [2250, 585]]);
const RW_TOP: [number, number][] = [[2244, 360], [2288, 401], [2320, 466], [2348, 547], [2380, 621], [2442, 710], [2540, 792], [2670, 862], [2800, 896], [2931, 909], [2996, 902], [3061, 881], [3126, 852], [3191, 808], [3256, 746], [3321, 674], [3387, 601], [3452, 531], [3517, 458], [3566, 393], [3622, 350]];
const RW_OUT = wide([[2244, 728], [2405, 771], [2505, 810], [2672, 828], [2839, 834], [3006, 830], [3173, 818], [3340, 787], [3474, 740], [3574, 700], [3622, 650]]);
const RW_IN = wide([[2244, 585], [2505, 605], [2672, 600], [3006, 575], [3173, 546], [3384, 483], [3474, 458], [3557, 505], [3622, 556]]);
const arch = (x: number, hx: number) => Math.abs(x - hx) < ARCH ? HUB + Math.sqrt(ARCH * ARCH - (x - hx) ** 2) : 0;
/** a full-skirted wing: a closed section at each station from the inner edge over the crown, down the outer skirt and back under */
function pontoon(b: Build, s: 1 | -1, xs: number[], top: [number, number][], out: [number, number][], inn: [number, number][], skirt: (x: number) => number) {
  const R6 = xs.map(x => { const zt = at(top, x), yi = at(inn, x), yo = at(out, x), wd = yo - yi, sk = Math.min(skirt(x), zt - 22), dep = zt - sk;
    return [[x, s * yi, zt - 10], [x, s * (yi + 0.45 * wd), zt], [x, s * (yo - 0.15 * wd), zt - 0.1 * dep - 6], [x, s * yo, zt - 0.4 * dep - 10], [x, s * yo, sk], [x, s * yi, sk]] as V[]; });
  b.mat(PAINT, 0.45, 'paint').loft(R6);
  b.mat(DARK, 0.05); for (let i = 0; i + 1 < R6.length; i++) { const A = R6[i]!, B = R6[i + 1]!, d = (p: V): V => [p[0], p[1] - s * 5, p[2] - 4]; if (A[4]![2] > 300 || B[4]![2] > 300) b.quad(d(A[4]!), A[5]!, B[5]!, d(B[4]!)); } }   // the dark under the arch

function wheel(b: Build, x: number, wy: number, s: 1 | -1, spin = 0) { const o: V = [x, s * wy, R], rim = 222, f = s * (TW / 2);
  b.mat(RUBBER, 0.05, 'tyre').lathe('y', o, [[-TW / 2, rim], [-TW / 2, R - 48], [-TW / 2 + 36, R], [TW / 2 - 36, R], [TW / 2, R - 48], [TW / 2, rim]], 20, false);
  b.mat(DARK, 0.05).lathe('y', o, [[-f * 0.9, 0], [-f * 0.9, rim]], 12, false);
  b.mat(PAINT, 0.45, 'paint').lathe('y', o, [[f, rim + 5], [f * 0.55, rim - 16], [f * 0.55, rim * 0.84], [f * 0.95, 96]], 20, false);                // the pressed disc, dished to its rim
  b.mat(CHROME, 0.9, 'metal').lathe('y', o, [[f * 0.95, 96], [f * 1.3, 78], [f * 1.5, 40], [f * 1.5, 0]], 12, false);                                 // the plain cap
  b.mat(DARK, 0.05); for (let k = 0; k < 8; k++) { const P = (a: number, r: number): V => [x + Math.cos(a) * r, s * wy + f * (0.95 - 0.4 * (r - 96) / (rim * 0.84 - 96)) + s * 3, R + Math.sin(a) * r], a = spin + k / 8 * Math.PI * 2; b.quad(P(a - 0.13, 128), P(a + 0.13, 128), P(a + 0.11, 162), P(a - 0.11, 162)); } }   // the ring of holes

export function mesh(spin = 0): Mesh { const b = new Low(); b.dz = DZ;
  // ---- the body: the raked nose, bonnet and scuttle, the tub cut down to the floor, the long tail ----
  b.mat(PAINT, 0.45, 'paint');
  const xs = [62, 75, 100, 147, 200, 261, 340, 423, 500, 570, 651, 749, 847, 977, 1303, 1628, 1700, 1756, 1760, 2100, 2476, 2480, 2540, 2800, 3061, 3126, 3191, 3256, 3321, 3387, 3452, 3517, 3574, 3595];
  b.loft(xs.map(x => { const pit = x >= 1760 && x <= 2476; return section(x, at(HALF, x), at(BOT, x), pit ? FLOOR : at(TOP, x), pit ? 8 : at(SQ, x), 6); }));
  for (const s of [1, -1]) b.loft([1762, 1830, 1872, 1954, 2051, 2182, 2279, 2345, 2393, 2442, 2478].map(x => { const w = at(HALF, x), zt = at(BELT, x); return [[x, s * (w - 52), FLOOR], [x, s * (w - 2), FLOOR], [x, s * (w - 2), zt - 14], [x, s * (w - 20), zt], [x, s * (w - 52), zt - 6]] as V[]; }));
  b.mat(DARK, 0.05).box(1764, 2476, -465, 465, FLOOR - 10, FLOOR + 4);
  b.mat('#3a3330', 0.1).loft([section(1766, at(HALF, 1766) - 14, FLOOR, at(TOP, 1766) - 14, at(SQ, 1766), 8)]);   // the dash: the scuttle's back face
  b.mat('#d8d2bf', 0.4); for (const y of [-260, -120, 120, 260]) b.lathe('x', [0, y, 950], [[1767, 0], [1771, 42]], 8, false);
  // two seats: cushion and rounded back each
  for (const s of [1, -1]) { b.mat(LEATHER, 0.25, 'leather').box(2010, 2400, Math.min(s * 30, s * 445), Math.max(s * 30, s * 445), FLOOR, 610);
    b.mat(LEATHER2, 0.25, 'leather').loft(([[2370, 610, 800], [2410, 570, 880], [2450, 570, 925], [2474, 640, 915]] as const).map(([x, zb, zt]) => section(x, 215, zb, zt, 3, 6, 12).map(([px, py, pz]) => [px, py + s * 240, pz] as V)));
    b.mat('#5e331c', 0.1); for (const y of [100, 170, 240, 310, 380]) b.bar([2020, s * y, 612], [2365, s * y, 612], 8); }
  // the folded hood under its cover behind the seats
  b.mat(CANVAS, 0.15, 'canvas').loft(([[2462, 470, 990], [2483, 484, 1060], [2540, 492, 1085], [2768, 490, 1085], [2914, 462, 1081], [2996, 395, 1060], [3040, 300, 1030], [3069, 160, 1005]] as const).map(([x, w, zt]) => section(x, w, 870, zt, 2.3, 6, 16)));
  // bonnet: centre hinge, top louvres, side slots, two straps with buckles; the doors' shut lines and hinges; the boot handle
  b.mat(CHROME, 0.9, 'metal').bar([600, 0, at(TOP, 600) + 5], [847, 0, at(TOP, 847) + 5], 14, 8).bar([847, 0, at(TOP, 847) + 5], [1700, 0, at(TOP, 1700) + 5], 14, 8);
  b.mat(SEAM, 0.1); for (const s of [1, -1]) { for (let k = 0; k < 12; k++) { const x = 740 + k * 64, z = (y: number) => skinZ(x + 12, y) + 4; b.quad([x, s * 90, z(90)], [x + 24, s * 90, z(90)], [x + 24, s * 180, z(180)], [x, s * 180, z(180)]); }
    for (const z of [795, 824, 853, 883, 912]) { const y = (x: number) => s * (skinY(x, z + 6) + 3); b.quad([965, y(965), z], [1285, y(1285), z], [1285, y(1285), z + 11], [965, y(965), z + 11]); }
    const door: [number, number][] = [[1767, 919], [1726, 840], [1661, 710], [1604, 612], [1590, 547], [1604, 482], [1661, 441], [1791, 420], [2182, 425], [2222, 482], [2247, 580], [2271, 678], [2288, 780]], P = ([x, z]: [number, number]): V => [x, s * (skinY(x, z) + 2), z];
    for (let i = 0; i + 1 < door.length; i++) b.bar(P(door[i]!), P(door[i + 1]!), 9); }
  b.mat(STRAP, 0.2, 'leather'); for (const x of [822, 1248]) b.loft([ring(x, 7), ring(x + 44, 7)].map(r => r.filter(p => p[2] > 600)), false);
  b.mat(CHROME, 0.9, 'metal'); for (const s of [1, -1]) { for (const x of [822, 1248]) { const y = skinY(x + 22, 950) + 8; b.box(x - 10, x + 54, Math.min(s * y, s * (y + 10)), Math.max(s * y, s * (y + 10)), 928, 970); }
    for (const [x, z] of [[1712, 815], [1656, 720]] as const) { const y = skinY(x, z) + 6; b.bar([x - 16, s * y, z + 22], [x + 16, s * y, z - 22], 16); } }
  b.bar([3470, 0, skinZ(3470, 0) + 8], [3540, 0, skinZ(3540, 0) + 8], 18);
  // ---- the nose: two tall kidney grilles laid on the raked prow, bright frames, dark cores, upright bars ----
  for (const s of [1, -1]) { const kid = (k: number, off: number, bars = false) => { const rows = 8, cols = bars ? 1 : 3;
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const P = (u: number, v: number, yc = 0, hw = 0): V => { const z = 598 + 270 * k * (2 * v - 1), t = Math.abs(2 * v - 1), half = 68 * k * (1 - (0.9 * t) ** 4) ** 0.25, y = bars ? yc + hw * (2 * u - 1) : 86 + half * (2 * u - 1); return [skinX(y, z) - off, s * y, z + off * 0.7]; };
        if (!bars) b.quad(P(j / cols, i / rows), P((j + 1) / cols, i / rows), P((j + 1) / cols, (i + 1) / rows), P(j / cols, (i + 1) / rows));
        else for (const yc of [52, 86, 120]) b.quad(P(0, 0.06 + 0.88 * i / rows, yc, 5), P(1, 0.06 + 0.88 * i / rows, yc, 5), P(1, 0.06 + 0.88 * (i + 1) / rows, yc, 5), P(0, 0.06 + 0.88 * (i + 1) / rows, yc, 5)); } };
    b.mat(CHROME, 0.9, 'metal'); kid(1, 6); b.mat('#2a2824', 0.05); kid(0.86, 10); b.mat('#9a9c9e', 0.7); kid(0.84, 13, true); }
  // the apron between the wings under the nose, its two upright bright bars
  b.mat(PAINT2, 0.45, 'paint').loft(([[150, 560], [300, 660], [470, 760]] as const).map(([x, zt]) => section(x, at(FW_IN, x) + 6, 300, zt, 5, 6, 12)));
  b.mat(CHROME, 0.9, 'metal'); for (const s of [1, -1]) b.bar([140, s * 258, 345], [140, s * 258, 560], 24);
  // ---- the screen: one raked bright frame, two panes either side of a centre bar, on a post each side ----
  { const sx = (z: number) => 1694 + (z - 1010) * 0.36, P = (y: number, z: number): V => [sx(z), y, z], bot = (y: number) => skinZ(sx(1040), y) + 8;
    for (const s of [1, -1]) { const p0 = P(0, bot(0)), p1 = P(s * 290, bot(290)), p2 = P(s * 428, bot(428) + 6), p3 = P(s * 424, 1290), p4 = P(s * 395, 1320), p5 = P(0, 1322);
      b.mat(GLASS, 0.5, 'glass').quad(p0, p1, p4, p5).quad(p1, p2, p3, p4);
      b.mat(CHROME, 0.9, 'metal').bar(p0, p1, 20).bar(p1, p2, 20).bar(p2, p3, 24).bar(p3, p4, 22).bar(p4, p5, 22).bar(p2, [sx(1000) - 6, s * 440, skinZ(1700, 440) - 20], 30); }
    b.mat(CHROME, 0.9, 'metal').bar(P(0, bot(0)), P(0, 1322), 18); }
  // ---- wings: the front one sweeps from the nose over its wheel down to the sill, the rear one over its wheel to the tail's tip ----
  for (const s of [1, -1] as const) {
    pontoon(b, s, [8, 14, 23, 49, 85, 124, 130, 187, 252, 326, 407, 505, 602, 700, 798, 892, 898, 993, 1091, 1189, 1286, 1384, 1498, 1628, 1758, 1889, 2051, 2250], FW_TOP, FW_OUT, FW_IN, x => Math.max(x < FX ? 470 : 287, arch(x, FX)));
    pontoon(b, s, [2244, 2288, 2320, 2348, 2380, 2442, 2524, 2530, 2600, 2670, 2800, 2931, 2996, 3061, 3126, 3191, 3256, 3292, 3298, 3321, 3387, 3452, 3517, 3566, 3622], RW_TOP, RW_OUT, RW_IN, x => Math.max(x < RX ? 287 : at([[3298, 280], [3420, 295], [3574, 325], [3622, 335]], x), arch(x, RX)));
    b.mat(DARK, 0.05).box(FX - 200, FX + 260, Math.min(s * 200, s * 330), Math.max(s * 200, s * 330), 300, 690).box(RX - 370, RX + 370, Math.min(s * 300, s * 540), Math.max(s * 300, s * 540), 300, 740);   // the wheel houses
    // head lamps faired into the valley between wing and nose; tail lamps on the rear wings' tips
    b.mat(PAINT, 0.45, 'paint').lathe('x', [0, s * 322, 930], [[272, 98], [300, 102], [380, 95], [480, 70], [590, 20]], 14);
    b.mat(CHROME, 0.9, 'metal').lathe('x', [0, s * 322, 930], [[254, 94], [260, 106], [274, 106]], 14, false);
    b.mat(LENS, 0.6, 'lens').lathe('x', [0, s * 322, 930], [[244, 0], [249, 60], [257, 97]], 14, false);
    b.mat(CHROME, 0.9, 'metal').lathe('x', [0, s * 505, 470], [[3540, 30], [3575, 50], [3606, 50]], 10); b.mat(RED, 0.5).lathe('x', [0, s * 505, 470], [[3606, 42], [3618, 26], [3620, 0]], 10, false); }
  // ---- under the car: the dark, the axles, the exhaust's end on the right ----
  b.mat(DARK, 0.05).box(200, 3350, -400, 400, 262, 330);
  b.mat(CHROME, 0.9, 'metal').lathe('x', [0, -383, 262], [[3300, 34], [3440, 34]], 8, false); b.mat(DARK, 0.05).lathe('x', [0, -383, 262], [[3436, 0], [3436, 30]], 8, false);
  b.dz = 0;
  b.mat(DARK, 0.05).bar([FX, -WYF, R], [FX, WYF, R], 60).bar([RX, -WYR, R], [RX, WYR, R], 70);
  for (const s of [1, -1] as const) { wheel(b, FX, WYF, s, spin); wheel(b, RX, WYR, s, spin); }
  return b.mesh(L); }
