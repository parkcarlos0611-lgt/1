// The 1921 Duesenberg Model A coupe as a low-polygon mesh (docs/systems/70_mesh_car_rules.md). Lengths and heights are
// read off the sheet's side view (data/cars/sheet/dueA21.json, at the real wheelbase 3404), widths off its front and rear
// views brought to the real track 1422 (they draw it 1536: SW). The sheet draws the wheels 18 % large: the tyres here
// are the real 33x5 (radius 419), the body set 75 mm lower (DZ: roof at 1.91 m) and the wings drawn in round the real
// wheels (KW). Closed two-door body: upright two-pane screen, two windows a side, padded roof, no bumpers, no spare.
import { Build, section, wing, type Mesh, type V } from './mesh';

const PAINT = '#222226', PAINT2 = '#1e1e21', ROOF = '#2c2c30', FRAME = '#3a3a41', SEAM = '#3c3c43', STRIPE = '#c9b4b0', NICKEL = '#d6cab8', GLASS = '#9fb4c0', RUBBER = '#222127', WHITE = '#f6f3ec', DARK = '#151517', IRON = '#4a4b54', LENS = '#efe9cf', RED = '#c22c2b';
const FX = 584, RX = 3988, R = 419, WY = 711, TW = 135, L = 4742, DZ = -75, HUB = R - DZ, KW = 0.86, WU = 628;
/** the builder with everything lowered by `dz`: the body is written in the sheet's heights */
class Low extends Build { dz = 0; override tri(a: V, b: V, c: V): this { const d = this.dz; return super.tri([a[0], a[1], a[2] + d], [b[0], b[1], b[2] + d], [c[0], c[1], c[2] + d]); } }
/** linear reading of a table of [x, value] */
const at = (tab: [number, number][], x: number) => { if (x <= tab[0]![0]) return tab[0]![1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i]![0]) { const [x0, v0] = tab[i - 1]!, [x1, v1] = tab[i]!; return v0 + (v1 - v0) * (x - x0) / (x1 - x0); } return tab[tab.length - 1]![1]; };
// bonnet and cowl along the car: half-width, top, bottom, how square the top is
const HALF: [number, number][] = [[669, 264], [1722, 400], [2050, 520]], TOP: [number, number][] = [[669, 1407], [704, 1432], [1997, 1432], [2050, 1442]], BOT: [number, number][] = [[669, 609], [1300, 600], [1500, 500], [2050, 489]], SQ: [number, number][] = [[669, 3], [1722, 3.4], [2050, 4]];
const skinZ = (x: number, y: number) => { const w = at(HALF, x), zb = at(BOT, x), zt = at(TOP, x), n = at(SQ, x), u = Math.min(1, Math.abs(y) / w); return (zb + zt) / 2 + (zt - zb) / 2 * (1 - u ** n) ** (1 / n); };
const skinY = (x: number, z: number) => { const w = at(HALF, x), zb = at(BOT, x), zt = at(TOP, x), zc = (zb + zt) / 2, n = z >= zc ? at(SQ, x) : 6, u = Math.min(1, Math.abs(z - zc) / ((zt - zb) / 2)); return w * (1 - u ** n) ** (1 / n); };
// the cabin: flat sides above the belt, turned under below it; narrower below the belt at the cowl
const cabSide = (x: number): [number, number][] => { const wl = at([[2046, 520], [2196, WU]], x), zb = at([[2046, 489], [3384, 489], [3696, 640]], x); return [[0.8 * wl, zb], [0.86 * wl, zb + 260], [0.97 * wl, 1100], [wl, 1200], [WU, 1300], [WU, 1850], [WU - 45, 1886]]; };
const cabRing = (x: number): V[] => { const h = cabSide(x); return [...h.map(([y, z]) => [x, y, z] as V), ...h.slice().reverse().map(([y, z]) => [x, -y, z] as V)]; };
const cabY = (x: number, z: number) => { const h = cabSide(x).map(([y, zz]) => [zz, y] as [number, number]); return at(h, z); };
/** a point of the sheet's wing brought in round the real wheel */
const near = (hx: number, x: number, z: number): [number, number] => [hx + (x - hx) * KW, HUB + (z - HUB) * KW];

function wheel(b: Build, x: number, s: 1 | -1, spin = 0) { const o: V = [x, s * WY, R], rim = 304, f = s * (TW / 2);
  b.mat(RUBBER, 0.05).lathe('y', o, [[-f, rim], [-f, R - 45], [-f * 0.5, R], [f * 0.5, R], [f, R - 30]], 20, false);
  b.mat(WHITE, 0.15).lathe('y', o, [[f, R - 30], [f, rim + 2]], 20, false);              // the white wall
  b.mat(DARK, 0.05).lathe('y', o, [[f * 0.3, 0], [f * 0.3, rim]], 20, false).lathe('y', o, [[-f * 0.6, 170], [-f * 1.4, 170], [-f * 1.4, 0]], 12, false);
  b.mat('#2c2c31', 0.4).lathe('y', o, [[f, rim + 4], [f * 0.6, rim - 24]], 20, false);
  b.mat(NICKEL, 0.9).lathe('y', o, [[f * 0.5, 52], [f * 1.35, 40], [f * 1.45, 0]], 8, false);
  b.mat('#5d5e68', 0.4); for (let k = 0; k < 16; k++) { const a = spin + k / 16 * Math.PI * 2, a2 = a + (k % 2 ? 0.45 : -0.45), yh = s * WY + f * (k % 2 ? 1.15 : 0.55); b.bar([x + Math.cos(a2) * 42, yh, R + Math.sin(a2) * 42], [x + Math.cos(a) * (rim - 20), s * WY + f * 0.7, R + Math.sin(a) * (rim - 20)], 11); } }

export function mesh(spin = 0): Mesh { const b = new Low(); b.dz = DZ;
  // ---- bonnet and cowl; the cabin with its turn-under; the padded roof with its peak over the screen ----
  b.mat(PAINT, 0.45).loft([669, 704, 1000, 1300, 1500, 1722, 1900, 2050].map(x => section(x, at(HALF, x), at(BOT, x), at(TOP, x), at(SQ, x), 6)));
  b.loft([2046, 2196, 2915, 3384, 3696].map(cabRing));
  b.mat(ROOF, 0.1).loft(([[2012, 570, 1866, 1922], [2030, 612, 1864, 1946], [2067, 634, 1862, 1971], [2246, 637, 1862, 1986], [3444, 637, 1862, 1981], [3594, 634, 1856, 1946], [3674, 616, 1830, 1900], [3701, 585, 1790, 1850]] as const).map(([x, w, zb, zt]) => section(x, w, zb, zt, 5, 6, 16)));
  // the screen on the cabin's front: two panes inside a frame and a centre bar
  { const X = 2040; b.mat(GLASS, 0.5); for (const s of [1, -1]) b.quad([X, s * 14, 1430], [X, s * 430, 1430], [X, s * 430, 1832], [X, s * 14, 1832]);
    b.mat(FRAME, 0.3).bar([X, -450, 1418], [X, 450, 1418], 26).bar([X, -450, 1844], [X, 450, 1844], 26).bar([X, 0, 1418], [X, 0, 1844], 30); for (const s of [1, -1]) b.bar([X, s * 440, 1406], [X, s * 440, 1856], 26); }
  // side windows: two a side, glass inside a frame standing just off the skin
  for (const s of [1, -1]) { const Y = s * (WU + 4);
    for (const [x0, x1, z0, z1] of [[2250, 2800, 1372, 1818], [2996, 3354, 1405, 1806]] as const) { b.mat(GLASS, 0.5).quad([x0, Y, z0], [x1, Y, z0], [x1, Y, z1], [x0, Y, z1]);
      b.mat(FRAME, 0.3).bar([x0 - 12, Y, z0], [x1 + 12, Y, z0], 24).bar([x0 - 12, Y, z1], [x1 + 12, Y, z1], 24).bar([x0, Y, z0], [x0, Y, z1], 24).bar([x1, Y, z0], [x1, Y, z1], 24); }
    // the door: shut lines, three hinges, the handle; the belt's pinstripe from the bonnet to the back
    b.mat(SEAM, 0.2); for (const x of [2196, 2915]) { const Z = [520, 760, 1100, 1200, 1300, 1345]; for (let i = 0; i + 1 < Z.length; i++) b.bar([x, s * (cabY(x, Z[i]!) + 2), Z[i]!], [x, s * (cabY(x, Z[i + 1]!) + 2), Z[i + 1]!], 10); if (x === 2915) b.bar([x, s * (WU + 2), 1345], [x, s * (WU + 2), 1860], 10); }
    b.mat(NICKEL, 0.9); for (const z of [1776, 1335, 793]) b.box(2180, 2212, Math.min(s * (cabY(2196, z) + 2), s * (cabY(2196, z) + 12)), Math.max(s * (cabY(2196, z) + 2), s * (cabY(2196, z) + 12)), z - 32, z + 32);
    b.bar([2770, s * (cabY(2800, 1208) + 16), 1208], [2890, s * (cabY(2800, 1208) + 16), 1208], 16).bar([2880, s * cabY(2800, 1208), 1208], [2880, s * (cabY(2800, 1208) + 16), 1208], 14);
    b.mat(STRIPE, 0.3); { const P: V[] = ([[676, 1223], [1200, 1223], [1722, 1223], [1847, 1233], [1972, 1255], [2044, 1272]] as const).map(([x, z]) => [x, s * (skinY(x, z) + 3), z] as V); P.push(...([[2052, 1274], [2196, 1267], [2895, 1270], [3494, 1280], [3694, 1305]] as const).map(([x, z]) => [x, s * (cabY(x, z) + 3), z] as V));
      for (let i = 0; i + 1 < P.length; i++) if (i !== 5) b.bar(P[i]!, P[i + 1]!, 9); b.bar([3699, s * WU, 1305], [3699, s * 372, 1325], 9).bar([3699, s * 372, 1325], [3699, 0, 1333], 9); }
    // bonnet louvres
    b.mat(SEAM, 0.2); for (let k = 0; k < 16; k++) { const x = 910 + k * 44, y = (z: number) => s * (skinY(x + 8, z) + 3); b.quad([x, y(800), 800], [x + 16, y(800), 800], [x + 16, y(1075), 1075], [x, y(1075), 1075]); } }
  // the rear window: two panes in a frame
  { const X = 3701; b.mat(GLASS, 0.5); for (const s of [1, -1]) b.quad([X, s * 14, 1482], [X, s * 300, 1482], [X, s * 300, 1764], [X, s * 14, 1764]);
    b.mat(FRAME, 0.3).bar([X, -318, 1470], [X, 318, 1470], 24).bar([X, -318, 1776], [X, 318, 1776], 24).bar([X, 0, 1470], [X, 0, 1776], 26); for (const s of [1, -1]) b.bar([X, s * 308, 1460], [X, s * 308, 1786], 24); }
  b.mat(NICKEL, 0.9).bar([690, 0, 1436], [2040, 0, 1440], 12, 8);                                       // the bonnet's centre hinge
  // ---- the nose: the nickel shell, dark core with its slats, badge, the cap with its mascot ----
  b.mat(NICKEL, 0.9).loft([section(672, 272, 590, 1392, 3, 6), section(444, 272, 590, 1392, 3, 6), section(444, 230, 615, 1262, 3.4, 6), section(470, 230, 615, 1262, 3.4, 6)], false);
  b.mat('#39332b', 0.05).loft([section(462, 231, 614, 1263, 3.4, 6)]);
  b.mat('#6a6258', 0.3); for (let k = -4; k <= 4; k++) { const zt = 938 + 324 * (1 - (Math.abs(k * 46) / 230) ** 3.4) ** (1 / 3.4) - 6; b.quad([455, k * 46 - 4, 620], [455, k * 46 + 4, 620], [455, k * 46 + 4, zt], [455, k * 46 - 4, zt]); }
  b.mat('#b8322c', 0.5).lathe('x', [0, 0, 1318], [[436, 0], [440, 28]], 10, false);
  b.mat(NICKEL, 0.9).loft([[0, 44], [34, 40], [58, 22], [84, 30], [118, 26], [124, 0]].map(([a, r]) => Array.from({ length: 10 }, (_, i) => { const t = i / 10 * Math.PI * 2; return [600 + Math.cos(t) * r!, Math.sin(t) * r!, 1386 + a!] as V; })), false).bar([600, -70, 1480], [600, 70, 1480], 14, 26);
  // ---- wings, running boards, lamps, wheels ----
  for (const s of [1, -1] as const) { b.mat(PAINT2, 0.45);
    const yo: [number, number][] = [[15, 560], [40, 657], [90, 789], [265, 850], [640, 838], [1140, 765], [1516, 704], [1722, 700]], yi: [number, number][] = [[40, 420], [203, 430], [515, 452], [1140, 474], [1566, 505], [1722, 505]];
    wing(b, ([[55, 768], [75, 873], [125, 948], [200, 1008], [299, 1053], [449, 1083], [649, 1093], [774, 1078], [874, 1035], [973, 973], [1073, 873], [1173, 748], [1273, 636], [1373, 549], [1497, 499], [1722, 492]] as const).map(([x, z]) => { const [nx, nz] = near(FX, x, z); return [nx, nz, s * at(yi, x), s * at(yo, x)] as [number, number, number, number]; }), [FX, HUB], 45, 40);
    // the rear wing: deep, skirted outside the wheel, its crown against the body
    { const top: [number, number][] = [[3369, 499], [3399, 649], [3432, 786], [3474, 898], [3532, 986], [3594, 1048], [3606, 1248], [3696, 1272], [3993, 1252], [4243, 1173], [4418, 1048], [4517, 923], [4592, 748], [4642, 649], [4705, 594], [4737, 574]], ro: [number, number][] = [[3441, 700], [3491, 760], [3617, 840], [3867, 850], [4492, 845], [4667, 790], [4742, 660]], ri: [number, number][] = [[3441, 560], [3696, 560], [3929, 505], [4617, 455], [4727, 557]], A = R + 75;
      const rings = [3369, 3399, 3432, 3474, 3532, 3594, 3606, 3696, 3850, 3993, 4120, 4243, 4340, 4418, 4517, 4592, 4642, 4705, 4737].map(x => { const [nx, zt] = near(RX, x, at(top, x)), o = at(ro, x), i = at(ri, x), wd = o - i, ar = Math.abs(nx - RX) < A ? HUB + Math.sqrt(A * A - (nx - RX) ** 2) : 0, sk = Math.min(Math.max(nx < RX ? 494 : 512, ar), zt - 24), dep = zt - sk;
        return [[nx, s * i, zt - 12], [nx, s * (i + 0.45 * wd), zt], [nx, s * (o - 0.12 * wd), zt - 0.08 * dep - 8], [nx, s * o, zt - 0.3 * dep - 14], [nx, s * o, sk], [nx, s * i, sk]] as V[]; });
      b.loft(rings); b.mat(DARK, 0.05); for (let k = 0; k + 1 < rings.length; k++) { const P = rings[k]!, Q = rings[k + 1]!, d = (p: V): V => [p[0], p[1] - s * 6, p[2] - 4]; b.quad(d(P[4]!), P[5]!, Q[5]!, d(Q[4]!)); } }
    const bx0 = near(FX, 1722, 492)[0], bx1 = near(RX, 3369, 499)[0] + 10;
    b.mat(PAINT2, 0.3).box(bx0, bx1, Math.min(s * 490, s * 700), Math.max(s * 490, s * 700), 424, 494);
    b.mat(NICKEL, 0.9).box(bx0, bx1, Math.min(s * 690, s * 706), Math.max(s * 690, s * 706), 468, 497);
    b.mat(DARK, 0.05).box(RX - 430, RX + 300, Math.min(s * 380, s * 566), Math.max(s * 380, s * 566), 420, 1000);   // the rear wheel house
    // head lamps: nickel drums on posts; tail lamps on the rear wings
    b.mat(NICKEL, 0.9).lathe('x', [0, s * 380, 1183], [[247, 120], [300, 123], [380, 108], [430, 78], [459, 28]], 14);
    b.mat('#e8e0d2', 0.9).lathe('x', [0, s * 380, 1183], [[207, 116], [213, 129], [247, 129]], 14, false);
    b.mat(LENS, 0.6).lathe('x', [0, s * 380, 1183], [[190, 0], [196, 70], [209, 117]], 14, false);
    b.mat('#2a2a30', 0.2).bar([330, s * 384, 1070], [330, s * 395, 560], 30);
    { const [tx, tz] = near(RX, 4560, 800); b.mat(NICKEL, 0.9).lathe('x', [0, s * 705, tz], [[tx - 40, 34], [tx - 12, 56], [tx + 14, 56]], 10); b.mat(RED, 0.5).lathe('x', [0, s * 705, tz], [[tx + 14, 46], [tx + 24, 28], [tx + 26, 0]], 10, false); }
    b.mat(IRON, 0.3).bar([90, s * 400, 520], [460, s * 400, 560], 44, 70).bar([4150, s * 400, 560], [4330, s * 400, 520], 44, 70);   // the frame's horns front and rear
    b.mat('#34343b', 0.2).bar([110, s * 366, 440], [520, s * 366, 400], 60, 40); }                      // front springs
  // ---- between the wings: the tray under the bonnet, the front cross tube, the tank at the back, axles, the dark under the car ----
  b.mat(DARK, 0.05).box(440, 1560, -445, 445, 480, 600).box(700, 4100, -470, 470, 400, 500).box(3700, 4160, -500, 500, 420, 700);
  b.mat('#383840', 0.3).lathe('y', [70, 0, 532], [[-375, 34], [375, 34]], 8).box(4170, 4290, -430, 430, 470, 600);
  b.mat('#3a3c44', 0.4).lathe('y', [4240, 0, 628], [[-425, 40], [425, 40]], 8);
  b.mat(NICKEL, 0.9).lathe('x', [0, 0, 532], [[20, 0], [24, 16], [40, 16]], 8, false);                  // the starting handle's boss
  b.dz = 0;
  b.mat(DARK, 0.05).bar([FX, -WY, R - 60], [FX, WY, R - 60], 60).bar([RX, -WY, R], [RX, WY, R], 80).lathe('y', [RX, 0, R], [[-110, 60], [-60, 130], [60, 130], [110, 60]], 10);
  for (const s of [1, -1] as const) { wheel(b, FX, s, spin); wheel(b, RX, s, spin); }
  return b.mesh(L); }
