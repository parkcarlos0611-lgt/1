// The 1928 Buick Standard Six four-door sedan as a low-polygon mesh (docs/systems/70_mesh_car_rules.md; the manner of
// mesh_ssj.ts). Stations and heights are read off the part model's side view (data/cars/sheet/buick28.json), widths
// off its plan. Against the sheet (wheels of 419 radius, 1950-2000 wide):
//   x  as the sheet (wheel centres 596 and 3504 = the real 2908 mm wheelbase),
//   z  the sheet's less 44: the tyres are the real 5.00-19 (radius 375), the car sits that much lower (1.80 m high);
//      the wings' crowns come down another 30 to stay close over the smaller wheels,
//   y  the plan x 0.908 on the wings (1770 over all), x 0.853 on the body (1360 wide); wheel centres on the 1422 track.
import { Build, section, wing, type Mesh, type V } from './mesh';

const PAINT = '#22301f', BAND = '#41603a', TOPC = '#1c1d1e', WING = '#222225', CANVAS = '#2c2c2f', VISOR = '#3c3d3f', NICKEL = '#b4b1b1', WOOD = '#5a4636', GLASS = '#b8bdc5';
const RUBBER = '#26242b', DARK = '#1b1c1d', LENS = '#e9e6d6', RED = '#b02a3a', SEAM = '#121a10';
const TRIM = '#5f5d4e', CLOTH = '#8f8a72', LINER = '#252422', FLOOR = '#1c1b1a', DASH = '#4a3524', DIAL = '#cfcabb';   // the inside: grey-green mohair plush, a dark headliner
const FX = 596, RX = 3504, R = 375, WY = 711, TW = 130, L = 4288;
const W = 680, BELT = 1207, SILL = 1233, HEAD = 1650, EAVE = 1685, INSET = 22;   // the cabin: half width, belt, the windows' bottom and top, the roof's edge, how deep the glass sits
type Tab = [number, number][];
/** linear reading of a table of [x, value] */
const at = (tab: Tab, x: number) => { if (x <= tab[0]![0]) return tab[0]![1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i]![0]) { const [x0, v0] = tab[i - 1]!, [x1, v1] = tab[i]!; return v0 + (v1 - v0) * (x - x0) / (x1 - x0); } return tab[tab.length - 1]![1]; };
const HALF: Tab = [[586, 300], [604, 302], [1440, 514], [1548, 551], [1642, 600], [1746, 650], [1826, W], [3730, W], [3870, 627], [3940, 550], [3975, 450], [3990, 385]];
const TOP: Tab = [[604, 1257], [1291, 1266], [1527, 1263], [1675, 1276], [1746, 1289], [1826, 1289]];                         // bonnet and scuttle
const BOT: Tab = [[642, 542], [3080, 543], [3138, 681], [3225, 843], [3335, 909], [3419, 940], [3529, 940], [3651, 926], [3752, 868], [3846, 791], [3915, 701], [3971, 616], [3990, 606]];   // the body's lower edge, up over the rear wheel
const RAIL: Tab = [[1700, EAVE], [3900, EAVE], [3951, 1673], [3980, 1640], [3990, 1622]];                                      // the top of the body's sides, where the roof begins
const ROOF: Tab = [[1700, 1700], [1765, 1734], [1875, 1753], [2095, 1778], [2426, 1796], [3750, 1797], [3859, 1788], [3935, 1751], [3968, 1702], [3990, 1650]];
const WIN: [number, number][] = [[1864, 2517], [2601, 3258], [3324, 3783]];   // the three side windows

/** the main skin's section at x: bonnet, scuttle, then the body up to the belt (carried up into the cabin so its side stays flat) */
const sec = (x: number) => ({ w: at(HALF, x), zb: at(BOT, x), zt: x <= 1826 ? at(TOP, x) : BELT + 75, top: x <= 1527 ? 4 : x <= 1826 ? 3.6 : 10, bot: 6 });
/** how far out the skin stands at height z there */
const skin = (x: number, z: number) => { const { w, zb, zt, top, bot } = sec(x), zc = (zb + zt) / 2, h = (zt - zb) / 2, n = z >= zc ? top : bot, u = Math.min(1, Math.abs(z - zc) / h); return w * (1 - u ** n) ** (1 / n); };
/** a flat-sided, flat-topped ring (the cabin's solid parts) */
const rect = (x: number, w: number, zb: number, zt: number): V[] => [[x, -w, zb], [x, w, zb], [x, w, zt], [x, -w, zt]];
/** a roof ring: flat underneath, domed above */
const dome = (x: number, w: number, zb: number, zt: number, n = 3.4, k = 10): V[] => Array.from({ length: k + 1 }, (_, i) => { const t = i / k * Math.PI, c = Math.cos(t), s = Math.sin(t); return [x, w * Math.sign(c) * Math.abs(c) ** (2 / n), zb + (zt - zb) * s ** (2 / n)] as V; });

// ---- the inside of the cabin (review 83): what shows through the glass ----
/** an open skin: rings joined as strips, not closed round */
function strips(b: Build, rings: V[][]) { for (let r = 0; r + 1 < rings.length; r++) { const A = rings[r]!, B = rings[r + 1]!; for (let i = 0; i + 1 < A.length; i++) b.quad(A[i]!, A[i + 1]!, B[i + 1]!, B[i]!); } }
/** a flat end over a ring */
function fan(b: Build, R: V[]) { const m: V = [R[0]![0], 0, R.reduce((s, p) => s + p[2], 0) / R.length]; for (let i = 0; i < R.length; i++) b.tri(m, R[i]!, R[(i + 1) % R.length]!); }
/** a wall along the car from lo(x) up to hi(x), standing at y(x, z), with window holes [x0, x1, z0, z1] */
function wall(b: Build, xs: number[], y: (x: number, z: number) => number, lo: (x: number) => number, hi: (x: number) => number, holes: readonly (readonly [number, number, number, number])[] = []) {
  const x0 = xs[0]!, xn = xs[xs.length - 1]!, cut = [...new Set([...xs, ...holes.flatMap(h => [h[0], h[1]])])].filter(x => x >= x0 && x <= xn).sort((a, c) => a - c);
  for (let i = 0; i + 1 < cut.length; i++) { const a = cut[i]!, c = cut[i + 1]!, h = holes.find(h => h[0] <= a && h[1] >= c), q = (a0: number, c0: number, a1: number, c1: number) => b.quad([a, y(a, a0), a0], [c, y(c, c0), c0], [c, y(c, c1), c1], [a, y(a, a1), a1]);
    if (h) { q(lo(a), lo(c), h[2], h[2]); q(h[3], h[3], hi(a), hi(c)); } else q(lo(a), lo(c), hi(a), hi(c)); } }
/** a panel across the car at x, half width w, with a hole [half width, z0, z1] */
function across(b: Build, x: number, w: number, z0: number, z1: number, hole?: readonly [number, number, number]) { const q = (ya: number, yb: number, za: number, zb: number) => b.quad([x, ya, za], [x, yb, za], [x, yb, zb], [x, ya, zb]);
  if (!hole) { q(-w, w, z0, z1); return; } const [hw, h0, h1] = hole; q(-w, w, z0, h0); q(-w, w, h1, z1); q(-w, -hw, h0, h1); q(hw, w, h0, h1); }
/** a side profile ([x, z] points) carried across the car */
const slab = (b: Build, prof: [number, number][], hw: number) => b.loft([-hw, hw].map(y => prof.map(([x, z]) => [x, y, z] as V)));
/** a bench seat: its dark base on the floor, the cushion, the raked back; x its front edge, top the cushion's height */
function seat(b: Build, x: number, floor: number, top: number, hw: number) {
  b.mat(FLOOR, 0.05).box(x + 30, x + 450, -hw + 20, hw - 20, floor, top - 150);
  b.mat(CLOTH, 0.15, 'canvas'); slab(b, [[x, top - 150], [x + 470, top - 190], [x + 470, top - 40], [x + 40, top], [x, top - 30]], hw);
  b.mat(CLOTH, 0.15, 'canvas'); slab(b, [[x + 420, top - 60], [x + 540, top - 80], [x + 600, top + 440], [x + 570, top + 480], [x + 500, top + 470]], hw); }

/** a wheel on a wooden artillery centre: twelve flat spokes painted the body's green, a bright rim edge, a nickel cap */
function tyre(b: Build, axis: 'x' | 'y', o: V, f: number, spin: number) { const rim = R * 0.66, h = TW / 2, p = (u: number, v: number, a: number): V => { const c = Math.cos(a) * v, q = Math.sin(a) * v; return axis === 'y' ? [o[0] + c, o[1] + u, o[2] + q] : [o[0] + u, o[1] + c, o[2] + q]; };
  b.mat(RUBBER, 0.05, 'tyre').lathe(axis, o, [[-h, rim], [-h, R - 42], [-h + 30, R], [h - 30, R], [h, R - 42], [h, rim]], 20, false);
  b.mat(DARK, 0.05).lathe(axis, o, [[f * 0.45, 0], [f * 0.45, rim]], 20, false);                                     // the dark behind the spokes
  b.mat(NICKEL, 0.9, 'metal').lathe(axis, o, [[f, rim + 6], [f * 0.9, rim - 10]], 20, false);                                 // the rim's bright edge
  b.mat(PAINT, 0.45, 'paint').lathe(axis, o, [[f * 0.55, 92], [f * 1.05, 80], [f * 1.05, 0]], 12, false); b.mat(PAINT, 0.45, 'wood').lathe(axis, o, [[f * 0.9, rim - 10], [f * 0.62, rim - 34]], 20, false);   // the felloe and the hub's flange
  for (let k = 0; k < 12; k++) { const a = spin + k / 12 * Math.PI * 2; b.bar(p(f * 0.9, 70, a), p(f * 0.66, rim - 22, a), axis === 'y' ? 22 : 30, axis === 'y' ? 40 : 30); }
  b.mat(NICKEL, 0.9, 'metal').lathe(axis, o, [[f * 1.05, 44], [f * 1.5, 36], [f * 1.62, 0]], 10, false); }                    // hub cap

export function buick28Mesh(spin = 0): Mesh { const b = new Build();
  // ---- the skin: bonnet, scuttle, the body to the belt, cut up over the rear wheel, round at the back ----
  b.mat(PAINT, 0.45, 'paint');
  const xs = [604, 900, 1200, 1440, 1527, 1642, 1746, 1826, 1828, 2400, 3080, 3138, 3225, 3335, 3419, 3529, 3651, 3752, 3846, 3915, 3971, 3990];
  b.loft(xs.filter(x => x <= 1826).map(x => { const s = sec(x); return section(x, s.w, s.zb, s.zt, s.top, s.bot); }));
  const open = (x: number): V[] => { const s = sec(x), r = section(x, s.w, s.zb, s.zt, s.top, s.bot); return [r[8]!, r[9]!, ...r.slice(10), r[0]!, r[1]!]; };   // the body behind the scuttle without its lid: the cabin is hollow
  { const tub = xs.filter(x => x > 1826).map(open); strips(b, tub); fan(b, tub[0]!); fan(b, tub[tub.length - 1]!); }
  b.mat(NICKEL, 0.9, 'metal').loft([1518, 1534].map(x => { const s = sec(x); return section(x, s.w + 5, s.zb, s.zt + 5, s.top, s.bot); }));   // the bright band where bonnet meets scuttle
  b.bar([660, 0, at(TOP, 660) + 3], [1512, 0, at(TOP, 1512) + 3], 14, 8);                                                             // the bonnet's centre hinge
  for (const s of [1, -1]) { const q = (x: number, x1: number, z0: number, z1: number, o = 3) => b.quad([x, s * (skin(x, z0) + o), z0], [x1, s * (skin(x1, z0) + o), z0], [x1, s * (skin(x1, z1) + o), z1], [x, s * (skin(x, z1) + o), z1]);
    b.mat(BAND, 0.45, 'paint'); const bx = [1536, 1642, 1746, 1826, 1830, 3730, 3870, 3940]; for (let i = 0; i + 1 < bx.length; i++) q(bx[i]!, bx[i + 1]!, 1140, 1198);   // the lit band between the belt's two pin lines
    b.mat(NICKEL, 0.9, 'metal'); q(650, 1100, 1128, 1140, 4); q(1100, 1514, 1128, 1140, 4);                                                    // the bonnet's side hinge line
    b.mat(SEAM, 0.1); for (let k = 0; k < 26; k++) { const x = 808 + k * 23.4; q(x, x + 9, 690, 1015); }                               // 26 louvres
    q(1826, 1835, 600, 1140, 5); q(2553, 2566, 600, 1140, 5); q(3283, 3292, 925, 1140, 5);                                             // door shut lines
    b.mat(NICKEL, 0.9, 'metal').bar([2370, s * (W + 12), 1100], [2508, s * (W + 12), 1100], 16).bar([2588, s * (W + 12), 1100], [2726, s * (W + 12), 1100], 16);   // door handles
    const y = skin(1622, 1196); b.lathe('x', [0, s * (y + 26), 1196], [[1586, 12], [1596, 34], [1640, 36], [1657, 22]], 10); }          // scuttle lamps
  // ---- the cabin above the belt: solid ends, pillars and rails round the windows, the dark inside, the glass set in ----
  b.mat(TOPC, 0.45, 'paint'); for (const s of [1, -1]) { wall(b, [1765, 1864], () => s * W, () => BELT, () => EAVE); wall(b, [3783, 3870, 3940, 3975, 3990], x => s * at(HALF, x), () => BELT, x => at(RAIL, x)); }
  across(b, 3990, at(HALF, 3990), BELT, at(RAIL, 3990), [298, 1298, 1556]);
  b.box(1743, 1766, -W, W, BELT, 1318).box(1743, 1766, -W, W, 1640, EAVE).box(1743, 1766, -W, -500, 1318, 1640).box(1743, 1766, 500, W, 1318, 1640);   // the screen's surround
  for (const s of [1, -1]) { const y0 = Math.min(s * (W - 40), s * W), y1 = Math.max(s * (W - 40), s * W);
    b.box(1864, 3783, y0, y1, BELT, SILL).box(1864, 3783, y0, y1, HEAD, EAVE).box(2517, 2601, y0, y1, SILL, HEAD).box(3258, 3324, y0, y1, SILL, HEAD); }
  for (const s of [1, -1]) { const y = s * (W - INSET);
    b.mat(GLASS, 0.5, 'glass'); for (const [x0, x1] of WIN) b.quad([x0, y, SILL], [x1, y, SILL], [x1, y, HEAD], [x0, y, HEAD]);
    b.mat(WOOD, 0.3, 'wood'); for (const [x0, x1] of WIN) { const yw = s * (W - 12), a = 10; b.bar([x0, yw, SILL + a], [x1, yw, SILL + a], 20).bar([x0, yw, HEAD - a], [x1, yw, HEAD - a], 20).bar([x0 + a, yw, SILL], [x0 + a, yw, HEAD], 20).bar([x1 - a, yw, SILL], [x1 - a, yw, HEAD], 20); } }
  // the windscreen, one pane set in the cabin's front
  b.mat(GLASS, 0.5, 'glass').quad([1762, -500, 1318], [1762, 500, 1318], [1762, 500, 1640], [1762, -500, 1640]);
  b.mat(WOOD, 0.3, 'wood').bar([1758, -500, 1327], [1758, 500, 1327], 18).bar([1758, -500, 1631], [1758, 500, 1631], 18).bar([1758, -491, 1318], [1758, -491, 1640], 18).bar([1758, 491, 1318], [1758, 491, 1640], 18);
  // the back window in its wood surround
  b.mat(GLASS, 0.5, 'glass').quad([3994, -296, 1300], [3994, 296, 1300], [3994, 296, 1554], [3994, -296, 1554]);
  b.mat(WOOD, 0.3, 'wood').bar([3996, -310, 1298], [3996, 310, 1298], 22).bar([3996, -310, 1556], [3996, 310, 1556], 22).bar([3996, -299, 1288], [3996, -299, 1566], 22).bar([3996, 299, 1288], [3996, 299, 1566], 22);
  // ---- the inside: floor, toe board and dash, the panels' inner faces, headliner, seats, the shelf behind the rear seat ----
  { const fl = (x: number) => Math.max(at(BOT, x), 548) + 6, hw = (x: number) => at(HALF, Math.max(x, 1826)) - 44, e = (x: number) => at(RAIL, x) - 4, LX = [1770, 1864, 2400, 3080, 3400, 3783, 3870, 3940, 3962];
    b.mat(FLOOR, 0.05); strips(b, [1830, 3080, 3138, 3225, 3335, 3419, 3529, 3651, 3752, 3846, 3915, 3960].map(x => [[x, -hw(x) - 14, fl(x)], [x, hw(x) + 14, fl(x)]] as V[]));
    across(b, 1826 + 4, 680 - 20, 548, 1289);                                                                    // the toe board
    b.mat(DASH, 0.3, 'wood').box(1826 + 6, 1826 + 42, -680 + 46, 680 - 46, 1060, 1289);                                  // the dash's back face
    b.mat(DIAL, 0.3).box(1826 + 42, 1826 + 46, -170, 170, 1060 + 50, 1289 - 50);                                                      // its instrument board
    b.mat(TRIM, 0.12, 'canvas'); for (const s of [1, -1]) wall(b, LX, x => s * hw(x), fl, e, WIN.map(([x0, x1]) => [x0, x1, SILL, HEAD] as const));
    across(b, 1768, W - 44, 1285, e(1768), [500, 1318, 1640]); across(b, 3962, hw(3962), 1270, e(3962), [298, 1298, 1556]);
    strips(b, [3790, ...LX.filter(x => x > 3790)].map(x => [[x, -hw(x), 1270], [x, hw(x), 1270]] as V[]));   // the parcel shelf
    b.mat(LINER, 0.05, 'canvas'); strips(b, [1770, 3900, 3951, 3962].map(x => [[x, -hw(x) - 6, e(x)], [x, hw(x) + 6, e(x)]] as V[]));   // the headliner
    seat(b, 1990, 548, 920, 615); seat(b, 3790 - 580, 548, 1000, 590); }
  // the roof: a cloth top with a front peak, the visor under it
  b.mat(CANVAS, 0.15, 'canvas').loft([1700, 1765, 1875, 2095, 2426, 3100, 3750, 3859, 3935, 3968, 3990].map(x => dome(x, at(HALF, Math.max(x, 1826)) + 5, at(RAIL, x), at(ROOF, x))));
  b.mat(VISOR, 0.15, 'canvas').loft(([[1595, 600, 1583, 1602], [1680, 640, 1592, 1642], [1766, 655, 1604, 1680]] as const).map(([x, w, zb, zt]) => rect(x, w, zb, zt)));
  // ---- the nose: the tall nickel shell with its peaked crown, the dark core, the red badge, the winged cap ----
  b.mat(DARK, 0.05).box(508, 532, -258, 258, 486, 1160);
  b.mat(NICKEL, 0.9, 'metal').loft([section(606, 304, 478, 1262, 3.6), section(496, 304, 478, 1262, 3.6), section(496, 252, 500, 1168, 4), section(534, 252, 500, 1168, 4)], false);
  b.lathe('x', [0, 0, 1212], [[486, 0], [496, 36]], 12, false).box(540, 562, -10, 10, 1258, 1300).box(520, 580, -46, 46, 1298, 1318).box(536, 566, -16, 16, 1316, 1350);
  b.mat(RED, 0.5).lathe('x', [0, 0, 1212], [[480, 0], [486, 22]], 12, false);
  b.mat('#3a3b3c', 0.3); for (let k = -3; k <= 3; k++) b.box(503, 509, k * 62 - 5, k * 62 + 5, 500, 1160);   // the core's upright bars
  // ---- wings, running boards, lamps, wheels ----
  for (const s of [1, -1] as const) { const m = (p: readonly (readonly [number, number, number, number])[]) => p.map(([x, z, yi, yo]) => [x, z, s * yi, s * yo] as [number, number, number, number]);
    const front = [[137, 721, 600, 790], [165, 768, 575, 830], [221, 830, 550, 868], [331, 877, 542, 882], [441, 901, 540, 885], [573, 910, 540, 885], [706, 897, 540, 885], [816, 868, 540, 885], [904, 823, 540, 884], [993, 755, 540, 882], [1103, 646, 542, 878], [1213, 542, 548, 870], [1323, 437, 556, 860], [1434, 372, 566, 850], [1544, 345, 600, 838], [1687, 338, 640, 826]] as const;
    b.mat(WING, 0.45, 'paint'); wing(b, m(front), [FX, R - 150]);
    wing(b, m([[3004, 290, 645, 826], [3006, 397, 645, 832], [3015, 499, 645, 845], [3044, 604, 645, 860], [3099, 730, 645, 872], [3187, 834, 645, 880], [3298, 908, 645, 880], [3419, 945, 645, 880], [3529, 952, 645, 880], [3640, 934, 645, 880], [3750, 887, 645, 872], [3849, 813, 620, 850], [3926, 730, 580, 820], [3981, 636, 520, 790], [4037, 521, 500, 750], [4085, 425, 490, 715]]), [RX, R - 150]);
    // the front wing's inner skirt down to the frame, and the wheel house's dark on the bonnet side under the wing
    b.mat(WING, 0.3, 'paint'); for (let i = 0; i + 1 < 10; i++) { const p = front[i]!, q = front[i + 1]!, zv = (z: number) => Math.min(z - 90, 500); b.quad([p[0], s * (p[2] + 4), p[1] - 16], [q[0], s * (q[2] + 4), q[1] - 16], [q[0], s * 340, zv(q[1])], [p[0], s * 340, zv(p[1])]); }
    b.mat(DARK, 0.1); for (let i = 8; i < 11; i++) { const p = front[i]!, q = front[i + 1]!, v = (x: number, zt: number, j: number): V => { const z = 548 + (Math.max(553, zt - 30) - 548) * (j / 5) ** 2.5; return [x, s * (skin(x, z) + 8), z]; }; for (let j = 0; j < 5; j++) b.quad(v(p[0], p[1], j), v(q[0], q[1], j), v(q[0], q[1], j + 1), v(p[0], p[1], j + 1)); }   
    b.mat('#55545a', 0.1).box(1687, 3004, Math.min(s * 650, s * 826), Math.max(s * 650, s * 826), 300, 337);                     // running board
    b.mat(NICKEL, 0.9, 'metal').box(1690, 3002, Math.min(s * 820, s * 836), Math.max(s * 820, s * 836), 294, 334);                         // its bright edge
    // headlamp: a big nickel drum, its stay back to the shell
    b.mat(NICKEL, 0.9, 'metal').lathe('x', [0, s * 395, 933], [[309, 128], [316, 138], [372, 138], [404, 124], [424, 88], [430, 20]], 16);
    b.mat(LENS, 0.6, 'lens').lathe('x', [0, s * 395, 933], [[303, 0], [308, 124]], 16, false);
    b.mat(NICKEL, 0.9, 'metal').box(440, 468, s * 395 - 16, s * 395 + 16, 700, 930);
    b.mat(DARK, 0.05).bar([40, s * 250, 400], [240, s * 250, 440], 34).bar([3960, s * 600, 420], [4244, s * 600, 400], 34);       // bumper irons
    b.mat(NICKEL, 0.9, 'metal').box(0, 46, s * 390 - 26, s * 390 + 26, 262, 478);                                                          // front bumper clamps
    b.box(4240, 4276, Math.min(s * 395, s * 810), Math.max(s * 395, s * 810), 401, 464).box(4240, 4276, Math.min(s * 395, s * 810), Math.max(s * 395, s * 810), 291, 354).box(4236, 4288, s * 600 - 26, s * 600 + 26, 276, 480);   // the rear bumperette
    tyre(b, 'y', [FX, s * WY, R], s * (TW / 2), spin); tyre(b, 'y', [RX, s * WY, R], s * (TW / 2), spin); }
  // ---- across the car: lamp bar, front bumper, the tail lamp and plate on the left, axles, the dark under the car ----
  b.mat(NICKEL, 0.9, 'metal').box(440, 466, -395, 395, 905, 931).box(4, 40, -750, 750, 396, 463).box(4, 40, -750, 750, 278, 345).box(0, 46, -24, 24, 262, 478);
  b.box(4096, 4104, 470, 800, 492, 690).bar([3980, 600, 700], [4098, 640, 700], 22).lathe('x', [0, 654, 760], [[4076, 28], [4092, 50], [4112, 50]], 10);
  b.mat(DARK, 0.05).box(4104, 4108, 486, 784, 508, 674);
  b.mat(RED, 0.5).lathe('x', [0, 654, 760], [[4112, 42], [4120, 24], [4122, 0]], 10, false);
  b.mat(DARK, 0.05).box(180, 600, -340, 340, 380, 500).box(600, 1410, -340, 340, 360, 550).box(1406, 3010, -650, 650, 300, 548).box(3010, 3225, -560, 560, 350, 540).box(3225, 3890, -560, 560, 350, 840).box(3890, 3985, -500, 500, 300, 620)
    .bar([FX, -WY, R], [FX, WY, R], 60).bar([RX, -WY, R], [RX, WY, R], 80).box(3985, 4060, -110, 110, 600, 840);
  // ---- the spare on the back ----
  tyre(b, 'x', [4122, 0, 720], TW / 2, 0);
  return b.mesh(L); }
export const mesh = buick28Mesh;
