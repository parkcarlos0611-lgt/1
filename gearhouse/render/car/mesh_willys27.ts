// The 1927 Willys-Knight 70A sedan as a low-polygon mesh (docs/systems/70_mesh_car_rules.md; the manner of mesh_ssj.ts).
// Stations and heights are read off the part model's side view (data/cars/sheet/willys27.json), widths off its plan.
// The sheet draws this car tall and wide for its wheelbase (report: 2067 high, 0.89 m wheels, 1870-1920 wide), so:
//   x  as the sheet (wheel centres 653 and 3536 = the real 2883 mm wheelbase),
//   z  x 0.89 (1.83 m high, the real car's height / wheelbase 0.64), the tyres the real 5.25-20 (radius 390),
//   y  x 0.93 of the plan (1740 over the wings), the wheel centres on the real 1422 mm track.
import { Build, section, wing, type Mesh, type V } from './mesh';

const PAINT = '#55573c', TOPC = '#20211a', WING = '#2b2c30', CANVAS = '#333235', VISOR = '#2a2b26', NICKEL = '#9f9683', WOOD = '#c8742e', GLASS = '#b4b1bc';
const RUBBER = '#26242b', DARK = '#1c1b20', LENS = '#e6dfc4', RED = '#c22c2b', SEAM = '#35371f';
const FX = 653, RX = 3536, R = 390, WY = 711, TW = 135, L = 4322, ZS = 0.89, YS = 0.93;
const W = 662, BELT = 1179, SILL = 1230, HEAD = 1646, INSET = 22;   // the cabin: half width, belt, the windows' bottom and top, how deep the glass sits
type Tab = [number, number][];
/** linear reading of a table of [x, value] */
const at = (tab: Tab, x: number) => { if (x <= tab[0]![0]) return tab[0]![1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i]![0]) { const [x0, v0] = tab[i - 1]!, [x1, v1] = tab[i]!; return v0 + (v1 - v0) * (x - x0) / (x1 - x0); } return tab[tab.length - 1]![1]; };
const zs = (t: Tab): Tab => t.map(([x, z]) => [x, z * ZS]);
// half width along the car (plan view x 0.93; the back corners moved 50 back to the side view's body end)
const HALF: Tab = [[530, 280], [607, 300], [1344, 538], [1377, 547], [1520, 594], [1684, 637], [1734, W], [3850, W], [3940, 648], [4000, 610], [4035, 550], [4050, 490]];
const TOP: Tab = zs([[607, 1371], [760, 1375], [1408, 1407], [1513, 1404], [1728, 1425], [1780, 1449]]);                 // bonnet and scuttle
const BOT: Tab = zs([[607, 635], [3076, 638], [3087, 683], [3137, 817], [3216, 912], [3327, 976], [3463, 1001], [3584, 1004], [3709, 979], [3821, 911], [3897, 767], [3942, 935], [4007, 1076], [4035, 1226], [4050, 1280]]);   // the body's lower edge: over the rear wheel, up the tail
const RAIL: Tab = [[1780, 1630], [1812, 1680], [1878, 1708], [3882, 1708], [3980, 1700], [4034, 1672], [4050, 1640]];     // the top of the body's sides, where the roof begins
const ROOF: Tab = [[1800, 1700], [1872, 1778], [1977, 1803], [2571, 1830], [3008, 1833], [3585, 1832], [3809, 1822], [3933, 1797], [4007, 1752], [4041, 1700], [4052, 1662]];
const WIN: [number, number][] = [[1916, 2539], [2695, 3246], [3363, 3766]];   // the three side windows

/** the main skin's section at x: bonnet, scuttle, then the body up to the belt (carried up into the cabin so its side stays flat) */
const sec = (x: number) => ({ w: at(HALF, x), zb: at(BOT, x), zt: x <= 1780 ? at(TOP, x) : BELT + 75, top: x < 1513 ? 2.8 : x <= 1780 ? 3.2 : 10, bot: 6 });
/** how far out the skin stands at height z there */
const skin = (x: number, z: number) => { const { w, zb, zt, top, bot } = sec(x), zc = (zb + zt) / 2, h = (zt - zb) / 2, n = z >= zc ? top : bot, u = Math.min(1, Math.abs(z - zc) / h); return w * (1 - u ** n) ** (1 / n); };
/** a flat-sided, flat-topped ring (the cabin's solid parts) */
const rect = (x: number, w: number, zb: number, zt: number): V[] => [[x, -w, zb], [x, w, zb], [x, w, zt], [x, -w, zt]];
/** a roof ring: flat underneath, domed above */
const dome = (x: number, w: number, zb: number, zt: number, n = 3.4, k = 10): V[] => Array.from({ length: k + 1 }, (_, i) => { const t = i / k * Math.PI, c = Math.cos(t), s = Math.sin(t); return [x, w * Math.sign(c) * Math.abs(c) ** (2 / n), zb + (zt - zb) * s ** (2 / n)] as V; });

function tyre(b: Build, axis: 'x' | 'y', o: V, f: number, spin: number) { const rim = R * 0.63, h = TW / 2, p = (u: number, v: number, a: number): V => { const c = Math.cos(a) * v, q = Math.sin(a) * v; return axis === 'y' ? [o[0] + c, o[1] + u, o[2] + q] : [o[0] + u, o[1] + c, o[2] + q]; };
  b.mat(RUBBER, 0.05).lathe(axis, o, [[-h, rim], [-h, R - 45], [-h + 32, R], [h - 32, R], [h, R - 45], [h, rim]], 20, false);
  b.mat(DARK, 0.05).lathe(axis, o, [[f * 0.5, 0], [f * 0.5, rim]], 20, false);                                      // the dark well behind the spokes
  b.mat(PAINT, 0.45).lathe(axis, o, [[f, rim + 5], [f * 0.72, rim - 30]], 20, false);                                // the rim, in the body's olive
  b.mat(NICKEL, 0.9).lathe(axis, o, [[f * 0.6, 50], [f * 1.3, 40], [f * 1.45, 0]], 10, false);                       // hub cap
  b.mat('#8d8a72', 0.6); for (let k = 0; k < 20; k++) { const a = spin + k / 20 * Math.PI * 2; b.bar(p(f * 1.05, 42, a), p(f * 0.68, rim - 26, a + (k % 2 ? 0.3 : -0.3)), 10); } }   // wire spokes, crossed

export function willys27Mesh(spin = 0): Mesh { const b = new Build();
  // ---- the skin: bonnet, scuttle, the body to the belt, cut up over the rear wheel and up the tail ----
  b.mat(PAINT, 0.45);
  const xs = [607, 760, 1000, 1200, 1408, 1513, 1640, 1780, 1782, 2400, 3076, 3087, 3137, 3216, 3327, 3463, 3584, 3709, 3821, 3897, 3942, 4007, 4035, 4050];
  b.loft(xs.map(x => { const s = sec(x); return section(x, s.w, s.zb, s.zt, s.top, s.bot); }));
  b.mat('#4a4c34', 0.45).loft([1424, 1456].map(x => { const s = sec(x); return section(x, s.w + 7, s.zb, s.zt + 7, s.top, s.bot); }));   // the raised band between bonnet and scuttle
  b.mat(NICKEL, 0.9).bar([640, 0, at(TOP, 640) + 3], [1420, 0, at(TOP, 1420) + 3], 14, 8);                                               // the bonnet's centre hinge
  b.mat(SEAM, 0.1); for (const s of [1, -1]) { const q = (x: number, x1: number, z0: number, z1: number) => b.quad([x, s * (skin(x, z0) + 3), z0], [x1, s * (skin(x1, z0) + 3), z0], [x1, s * (skin(x1, z1) + 3), z1], [x, s * (skin(x, z1) + 3), z1]);
    for (let k = 0; k < 20; k++) { const x = 765 + k * 32.5; q(x, x + 11, 700, 985); }                                                    // 20 louvres
    q(1862, 1871, 625, BELT); q(2600, 2612, 625, BELT); q(3298, 3307, 885, BELT); }                                                       // door shut lines
  b.mat(NICKEL, 0.9); for (const s of [1, -1]) { b.bar([2440, s * (W + 12), 1098], [2585, s * (W + 12), 1098], 16).bar([2630, s * (W + 12), 1112], [2775, s * (W + 12), 1112], 16);   // door handles
    for (const [x, z] of [[1863, 1070], [1863, 750], [3301, 1012]] as const) b.box(x - 16, x + 16, Math.min(s * (W - 2), s * (W + 9)), Math.max(s * (W - 2), s * (W + 9)), z - 36, z + 36);   // hinges
    const y = skin(1644, 1197); b.lathe('x', [0, s * (y + 22), 1197], [[1612, 10], [1622, 28], [1660, 30], [1676, 22]], 8); }                                                              // scuttle lamps
  // ---- the cabin above the belt: solid ends, pillars and rails round the windows, the dark inside, the glass set in ----
  b.mat(TOPC, 0.45).loft([1780, 1812, 1878, 1916].map(x => rect(x, W, BELT, at(RAIL, x))));
  b.loft([3766, 3850, 3940, 4000, 4035, 4050].map(x => rect(x, at(HALF, x), BELT, at(RAIL, x))));
  for (const s of [1, -1]) { const y0 = Math.min(s * (W - 40), s * W), y1 = Math.max(s * (W - 40), s * W);
    b.box(1916, 3766, y0, y1, BELT, SILL).box(1916, 3766, y0, y1, HEAD, 1708).box(2539, 2695, y0, y1, SILL, HEAD).box(3246, 3363, y0, y1, SILL, HEAD); }
  b.mat(DARK, 0.05).box(1916, 3766, -(W - 30), W - 30, BELT + 6, 1702);
  for (const s of [1, -1]) { const y = s * (W - INSET);
    b.mat(GLASS, 0.5); for (const [x0, x1] of WIN) b.quad([x0, y, SILL], [x1, y, SILL], [x1, y, HEAD], [x0, y, HEAD]);
    b.mat(WOOD, 0.3); for (const [x0, x1] of WIN) { const yw = s * (W - 8), a = 12; b.bar([x0, yw, SILL + a], [x1, yw, SILL + a], 24).bar([x0, yw, HEAD - a], [x1, yw, HEAD - a], 24).bar([x0 + a, yw, SILL], [x0 + a, yw, HEAD], 24).bar([x1 - a, yw, SILL], [x1 - a, yw, HEAD], 24); } }
  // the back window: two panes in a wood frame
  b.mat(DARK, 0.05).box(4046, 4052, -330, 330, 1360, 1612);
  b.mat(GLASS, 0.5).quad([4054, -316, 1374], [4054, 316, 1374], [4054, 316, 1598], [4054, -316, 1598]);
  b.mat(WOOD, 0.3).bar([4056, -328, 1372], [4056, 328, 1372], 24).bar([4056, -328, 1600], [4056, 328, 1600], 24).bar([4056, -317, 1362], [4056, -317, 1610], 24).bar([4056, 317, 1362], [4056, 317, 1610], 24);
  b.mat(DARK, 0.05).bar([4056, 0, 1384], [4056, 0, 1588], 18);
  // the windscreen standing ahead of the corner posts: wood frame, two panes; the narrow panes in the posts
  b.mat(DARK, 0.05).box(1750, 1780, -495, 495, 1284, 1622);
  b.mat(GLASS, 0.5).quad([1748, -482, 1300], [1748, 482, 1300], [1748, 482, 1606], [1748, -482, 1606]);
  b.mat(WOOD, 0.3).bar([1744, -505, 1289], [1744, 505, 1289], 26).bar([1744, -505, 1616], [1744, 505, 1616], 26).bar([1744, -492, 1278], [1744, -492, 1628], 26).bar([1744, 492, 1278], [1744, 492, 1628], 26);
  b.mat(TOPC, 0.3).bar([1742, 0, 1300], [1742, 0, 1606], 24);
  b.mat(GLASS, 0.5); for (const s of [1, -1]) b.quad([1778, s * 548, 1290], [1778, s * 630, 1290], [1778, s * 630, 1600], [1778, s * 548, 1600]);
  // the roof: a cloth cap over the body's outline, the peak (visor) ahead of it
  b.mat(CANVAS, 0.15).loft([1800, 1872, 1977, 2571, 3008, 3585, 3809, 3933, 4007, 4041, 4052].map(x => dome(x, at(HALF, Math.max(x, 1780)) + 6, at(RAIL, x), at(ROOF, x))));
  b.mat(VISOR, 0.15).loft(([[1560, 565, 1593, 1620], [1607, 575, 1591, 1668], [1731, 605, 1622, 1734], [1800, 635, 1645, 1756], [1879, 645, 1703, 1774]] as const).map(([x, w, zb, zt]) => rect(x, w, zb, zt)));
  // ---- the nose: the radiator's dark core in its nickel shell, the diamond badge, the winged cap ----
  b.mat(DARK, 0.05).box(498, 522, -238, 238, 562, 1142);
  b.mat(NICKEL, 0.9).loft([section(606, 282, 497, 1228, 5), section(486, 282, 497, 1228, 5), section(486, 236, 560, 1140, 5), section(524, 236, 560, 1140, 5)], false);
  b.lathe('x', [0, 0, 1184], [[478, 0], [486, 40]], 4, false).box(532, 552, -9, 9, 1226, 1296).box(526, 558, -48, 48, 1290, 1312).box(534, 550, -14, 14, 1310, 1338);
  b.mat(DARK, 0.05).lathe('x', [0, 0, 1184], [[474, 0], [479, 22]], 4, false);
  // ---- wings, running boards, lamps, wheels ----
  for (const s of [1, -1] as const) { const m = (p: readonly (readonly [number, number, number, number])[]) => p.map(([x, z, yi, yo]) => [x, z, s * yi, s * yo] as [number, number, number, number]);
    const front = [[136, 678, 600, 770], [150, 722, 570, 805], [198, 779, 545, 842], [297, 847, 540, 866], [420, 895, 540, 870], [569, 918, 540, 870], [717, 913, 540, 870], [865, 880, 540, 868], [989, 825, 540, 866], [1088, 748, 545, 862], [1187, 649, 552, 855], [1286, 541, 562, 845], [1385, 458, 578, 830], [1484, 402, 594, 815], [1607, 374, 628, 804], [1738, 372, 655, 800]] as const;
    b.mat(WING, 0.45); wing(b, m(front), [FX, R - 150]);
    wing(b, m([[3061, 300, 640, 800], [3063, 497, 636, 812], [3078, 619, 632, 835], [3120, 735, 630, 852], [3202, 828, 630, 868], [3313, 886, 630, 870], [3462, 916, 630, 870], [3585, 916, 630, 870], [3709, 891, 630, 866], [3820, 832, 628, 850], [3907, 732, 620, 822], [3966, 616, 600, 790], [4015, 490, 570, 750], [4070, 400, 545, 705], [4110, 368, 530, 680]]), [RX, R - 150]);
    // the front wing's inner sweep down to the frame
    b.mat(WING, 0.3); for (let i = 0; i + 1 < 10; i++) { const p = front[i]!, q = front[i + 1]!, zv = (z: number) => Math.min(z - 90, 540); b.quad([p[0], s * (p[2] + 4), p[1] - 16], [q[0], s * (q[2] + 4), q[1] - 16], [q[0], s * 325, zv(q[1])], [p[0], s * 325, zv(p[1])]); }
    b.mat('#1e1e20', 0.1); for (let i = 8; i < 11; i++) { const p = front[i]!, q = front[i + 1]!, v = (x: number, zt: number, j: number): V => { const z = 571 + (Math.max(576, zt - 30) - 571) * (j / 5) ** 2.5; return [x, s * (skin(x, z) + 8), z]; }; for (let j = 0; j < 5; j++) b.quad(v(p[0], p[1], j), v(q[0], q[1], j), v(q[0], q[1], j + 1), v(p[0], p[1], j + 1)); }   // the wheel house's dark on the bonnet side under the wing
    b.mat('#232325', 0.1).box(1738, 3061, Math.min(s * 640, s * 800), Math.max(s * 640, s * 800), 338, 378);                    // running board
    b.mat(NICKEL, 0.9).box(1740, 3058, Math.min(s * 792, s * 808), Math.max(s * 792, s * 808), 332, 374);                         // its bright edge
    // headlamp: a drum front on a bowl, on its post; the tail lamp on the rear wing
    b.mat(NICKEL, 0.9).lathe('x', [0, s * 425, 985], [[240, 116], [246, 124], [300, 124], [371, 104], [433, 62], [460, 12]], 14);
    b.mat(LENS, 0.6).lathe('x', [0, s * 425, 985], [[234, 0], [239, 110]], 14, false);
    b.mat(NICKEL, 0.9).box(300, 330, s * 425 - 15, s * 425 + 15, 690, 866);
    b.lathe('x', [0, s * 683, 763], [[3912, 26], [3932, 46], [3962, 46]], 10).box(3925, 3950, s * 683 - 10, s * 683 + 10, 650, 720);
    b.mat(RED, 0.5).lathe('x', [0, s * 683, 763], [[3962, 40], [3970, 24], [3972, 0]], 10, false);
    b.mat(DARK, 0.05).bar([44, s * 300, 430], [300, s * 300, 470], 34).bar([4060, s * 400, 440], [4290, s * 356, 440], 34);       // bumper irons
    b.mat(NICKEL, 0.9).box(0, 46, s * 330 - 26, s * 330 + 26, 336, 520).box(4278, 4322, s * 345 - 26, s * 345 + 26, 352, 538);    // bumper clamps
    tyre(b, 'y', [FX, s * WY, R], s * (TW / 2), spin); tyre(b, 'y', [RX, s * WY, R], s * (TW / 2), spin); }
  // ---- across the car: lamp bar, bumpers (two bars front and rear), axles, the dark under the car ----
  b.mat(NICKEL, 0.9).box(322, 348, -425, 425, 836, 862).box(4, 40, -735, 735, 447, 504).box(4, 40, -735, 735, 354, 411).box(4284, 4320, -745, 745, 463, 520).box(4284, 4320, -745, 745, 370, 427);
  b.mat(DARK, 0.05).box(200, 610, -330, 330, 400, 520).box(600, 1130, -330, 330, 380, 575).box(1125, 3071, -640, 640, 300, 572).box(3071, 3935, -560, 560, 380, 900).box(3935, 4040, -560, 560, 370, 700)
    .bar([FX, -WY, R], [FX, WY, R], 60).bar([RX, -WY, R], [RX, WY, R], 80).box(3960, 4078, -90, 90, 690, 900);
  // ---- the spare on the back ----
  tyre(b, 'x', [4142, 0, 798], TW / 2, 0);
  return b.mesh(L); }
export const mesh = willys27Mesh;
