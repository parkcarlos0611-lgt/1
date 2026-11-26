// The 1927 Willys-Knight 70A sedan as a low-polygon mesh (docs/systems/70_mesh_car_rules.md; the manner of mesh_ssj.ts).
// Stations and heights are read off the part model's side view (data/cars/sheet/willys27.json), widths off its plan.
// The sheet draws this car tall and wide for its wheelbase (report: 2067 high, 0.89 m wheels, 1870-1920 wide), so:
//   x  as the sheet (wheel centres 653 and 3536 = the real 2883 mm wheelbase),
//   z  x 0.89 (1.83 m high, the real car's height / wheelbase 0.64), the tyres the real 5.25-20 (radius 390),
//   y  x 0.93 of the plan (1740 over the wings), the wheel centres on the real 1422 mm track.
import { Build, section, wing, type Mesh, type V } from './mesh';

const PAINT = '#55573c', TOPC = '#20211a', WING = '#2b2c30', CANVAS = '#333235', VISOR = '#2a2b26', NICKEL = '#9f9683', WOOD = '#c8742e', GLASS = '#b4b1bc';
const RUBBER = '#26242b', DARK = '#1c1b20', LENS = '#e6dfc4', RED = '#c22c2b', SEAM = '#35371f';
const TRIM = '#6b5340', CLOTH = '#9a7a58', LINER = '#2a2520', FLOOR = '#1e1b19', DASH = '#5a3a22', DIAL = '#cfc8b2', FRAME = '#26271f';   // the inside: brown mohair, a dark headliner
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

function tyre(b: Build, axis: 'x' | 'y', o: V, f: number, spin: number) { const rim = R * 0.63, h = TW / 2, p = (u: number, v: number, a: number): V => { const c = Math.cos(a) * v, q = Math.sin(a) * v; return axis === 'y' ? [o[0] + c, o[1] + u, o[2] + q] : [o[0] + u, o[1] + c, o[2] + q]; };
  b.mat(RUBBER, 0.05, 'tyre').lathe(axis, o, [[-h, rim], [-h, R - 45], [-h + 32, R], [h - 32, R], [h, R - 45], [h, rim]], 20, false);
  b.mat(DARK, 0.05).lathe(axis, o, [[f * 0.5, 0], [f * 0.5, rim]], 20, false);                                      // the dark well behind the spokes
  b.mat(PAINT, 0.45, 'paint').lathe(axis, o, [[f, rim + 5], [f * 0.72, rim - 30]], 20, false);                                // the rim, in the body's olive
  b.mat(NICKEL, 0.9, 'metal').lathe(axis, o, [[f * 0.6, 50], [f * 1.3, 40], [f * 1.45, 0]], 10, false);                       // hub cap
  b.mat('#8d8a72', 0.6, 'paint'); for (let k = 0; k < 20; k++) { const a = spin + k / 20 * Math.PI * 2; b.bar(p(f * 1.05, 42, a), p(f * 0.68, rim - 26, a + (k % 2 ? 0.3 : -0.3)), 10); } }   // wire spokes, crossed

export function willys27Mesh(spin = 0): Mesh { const b = new Build();
  // ---- the skin: bonnet, scuttle, the body to the belt, cut up over the rear wheel and up the tail ----
  b.mat(PAINT, 0.45, 'paint');
  const xs = [607, 760, 1000, 1200, 1408, 1513, 1640, 1780, 1782, 2400, 3076, 3087, 3137, 3216, 3327, 3463, 3584, 3709, 3821, 3897, 3942, 4007, 4035, 4050];
  b.loft(xs.filter(x => x <= 1780).map(x => { const s = sec(x); return section(x, s.w, s.zb, s.zt, s.top, s.bot); }));
  const open = (x: number): V[] => { const s = sec(x), r = section(x, s.w, s.zb, s.zt, s.top, s.bot); return [r[8]!, r[9]!, ...r.slice(10), r[0]!, r[1]!]; };   // the body behind the scuttle without its lid: the cabin is hollow
  { const tub = xs.filter(x => x > 1780).map(open); strips(b, tub); fan(b, tub[0]!); fan(b, tub[tub.length - 1]!); }
  b.mat('#4a4c34', 0.45, 'paint').loft([1424, 1456].map(x => { const s = sec(x); return section(x, s.w + 7, s.zb, s.zt + 7, s.top, s.bot); }));   // the raised band between bonnet and scuttle
  b.mat(NICKEL, 0.9, 'metal').bar([640, 0, at(TOP, 640) + 3], [1420, 0, at(TOP, 1420) + 3], 14, 8);                                               // the bonnet's centre hinge
  b.mat(SEAM, 0.1); for (const s of [1, -1]) { const q = (x: number, x1: number, z0: number, z1: number) => b.quad([x, s * (skin(x, z0) + 3), z0], [x1, s * (skin(x1, z0) + 3), z0], [x1, s * (skin(x1, z1) + 3), z1], [x, s * (skin(x, z1) + 3), z1]);
    for (let k = 0; k < 20; k++) { const x = 765 + k * 32.5; q(x, x + 11, 700, 985); }                                                    // 20 louvres
    q(1862, 1871, 625, BELT); q(2600, 2612, 625, BELT); q(3298, 3307, 885, BELT); }                                                       // door shut lines
  b.mat(NICKEL, 0.9, 'metal'); for (const s of [1, -1]) { b.bar([2440, s * (W + 12), 1098], [2585, s * (W + 12), 1098], 16).bar([2630, s * (W + 12), 1112], [2775, s * (W + 12), 1112], 16);   // door handles
    for (const [x, z] of [[1863, 1070], [1863, 750], [3301, 1012]] as const) b.box(x - 16, x + 16, Math.min(s * (W - 2), s * (W + 9)), Math.max(s * (W - 2), s * (W + 9)), z - 36, z + 36);   // hinges
    const y = skin(1644, 1197); b.lathe('x', [0, s * (y + 22), 1197], [[1612, 10], [1622, 28], [1660, 30], [1676, 22]], 8); }                                                              // scuttle lamps
  // ---- the cabin above the belt: solid ends, pillars and rails round the windows, the dark inside, the glass set in ----
  b.mat(TOPC, 0.45, 'paint');
  // the cabin's front face: open behind the screen's bay and the narrow panes in the posts
  const front = (x: number, w: number, zt: number) => { const q = (ya: number, yb: number, za: number, zb: number) => b.quad([x, ya, za], [x, yb, za], [x, yb, zb], [x, ya, zb]);
    q(-w, w, BELT, 1284); q(-w, w, 1622, zt); for (const s of [1, -1]) { q(s * 495, s * 548, 1284, 1622); q(s * 630, s * w, 1284, 1622); q(s * 548, s * 630, 1284, 1290); q(s * 548, s * 630, 1600, 1622); } };
  front(1780, W, 1630);
  for (const s of [1, -1]) { wall(b, [1780, 1812, 1878, 1916], () => s * W, () => BELT, x => at(RAIL, x)); wall(b, [3766, 3850, 3940, 4000, 4035, 4050], x => s * at(HALF, x), () => BELT, x => at(RAIL, x));
    b.quad([1748, s * 495, 1284], [1780, s * 495, 1284], [1780, s * 495, 1622], [1748, s * 495, 1622]); }                                   // the bay's cheeks, sill and head
  for (const z of [1284, 1622]) b.quad([1748, -495, z], [1780, -495, z], [1780, 495, z], [1748, 495, z]);
  strips(b, [1780, 1802].map(x => [[x, -W, at(RAIL, x)], [x, W, at(RAIL, x)]] as V[]));
  across(b, 4050, at(HALF, 4050), BELT, at(RAIL, 4050), [318, 1372, 1600]);
  for (const s of [1, -1]) { const y0 = Math.min(s * (W - 40), s * W), y1 = Math.max(s * (W - 40), s * W);
    b.box(1916, 3766, y0, y1, BELT, SILL).box(1916, 3766, y0, y1, HEAD, 1708).box(2539, 2695, y0, y1, SILL, HEAD).box(3246, 3363, y0, y1, SILL, HEAD); }
  for (const s of [1, -1]) { const y = s * (W - INSET);
    b.mat(GLASS, 0.5, 'glass'); for (const [x0, x1] of WIN) b.quad([x0, y, SILL], [x1, y, SILL], [x1, y, HEAD], [x0, y, HEAD]);
    b.mat(WOOD, 0.3, 'wood'); for (const [x0, x1] of WIN) { const yw = s * (W - 8), a = 12; b.bar([x0, yw, SILL + a], [x1, yw, SILL + a], 24).bar([x0, yw, HEAD - a], [x1, yw, HEAD - a], 24).bar([x0 + a, yw, SILL], [x0 + a, yw, HEAD], 24).bar([x1 - a, yw, SILL], [x1 - a, yw, HEAD], 24); } }
  // the back window: two panes in a wood frame
  b.mat(GLASS, 0.5, 'glass').quad([4054, -316, 1374], [4054, 316, 1374], [4054, 316, 1598], [4054, -316, 1598]);
  b.mat(WOOD, 0.3, 'wood').bar([4056, -328, 1372], [4056, 328, 1372], 24).bar([4056, -328, 1600], [4056, 328, 1600], 24).bar([4056, -317, 1362], [4056, -317, 1610], 24).bar([4056, 317, 1362], [4056, 317, 1610], 24);
  b.mat(DARK, 0.05).bar([4056, 0, 1384], [4056, 0, 1588], 18);
  // the windscreen standing ahead of the corner posts: wood frame, two panes; the narrow panes in the posts
  b.mat(GLASS, 0.5, 'glass').quad([1748, -482, 1300], [1748, 482, 1300], [1748, 482, 1606], [1748, -482, 1606]);
  b.mat(WOOD, 0.3, 'wood').bar([1744, -505, 1289], [1744, 505, 1289], 26).bar([1744, -505, 1616], [1744, 505, 1616], 26).bar([1744, -492, 1278], [1744, -492, 1628], 26).bar([1744, 492, 1278], [1744, 492, 1628], 26);
  b.mat(FRAME, 0.3).bar([1742, 0, 1300], [1742, 0, 1606], 24);
  b.mat(GLASS, 0.5, 'glass'); for (const s of [1, -1]) b.quad([1778, s * 548, 1290], [1778, s * 630, 1290], [1778, s * 630, 1600], [1778, s * 548, 1600]);
  // ---- the inside: floor, toe board and dash, the panels' inner faces, headliner, seats, the shelf behind the rear seat ----
  { const fl = (x: number) => Math.max(at(BOT, x), 572) + 6, hw = (x: number) => at(HALF, Math.max(x, 1780)) - 44, e = (x: number) => at(RAIL, x) - 4, LX = [1786, 1916, 2400, 3076, 3400, 3766, 3850, 3940, 4000, 4022];
    b.mat(FLOOR, 0.05); strips(b, [1784, 3076, 3087, 3137, 3216, 3327, 3463, 3584, 3709, 3821, 3897, 3942, 4007, 4040].map(x => [[x, -hw(x) - 14, fl(x)], [x, hw(x) + 14, fl(x)]] as V[]));
    across(b, 1780 + 4, 662 - 20, 572, 1284);                                                                    // the toe board
    b.mat(DASH, 0.3, 'wood').box(1780 + 6, 1780 + 42, -662 + 46, 662 - 46, 1060, 1284);                                  // the dash's back face
    b.mat(DIAL, 0.3).box(1780 + 42, 1780 + 46, -170, 170, 1060 + 50, 1284 - 50);                                                      // its instrument board
    b.mat(TRIM, 0.12, 'canvas'); for (const s of [1, -1]) wall(b, LX, x => s * hw(x), fl, e, WIN.map(([x0, x1]) => [x0, x1, SILL, HEAD] as const));
    front(1786, W - 44, e(1786)); across(b, 4022, hw(4022), 1340, e(4022), [318, 1372, 1600]);
    strips(b, [3830, ...LX.filter(x => x > 3830)].map(x => [[x, -hw(x), 1340], [x, hw(x), 1340]] as V[]));   // the parcel shelf
    b.mat(LINER, 0.05, 'canvas'); strips(b, [1786, 1812, 1878, 2571, 3882, 3980, 4022].map(x => [[x, -hw(x) - 6, e(x)], [x, hw(x) + 6, e(x)]] as V[]));   // the headliner
    seat(b, 2010, 572, 930, 600); seat(b, 3830 - 580, 572, 960, 570); }
  // the roof: a cloth cap over the body's outline, the peak (visor) ahead of it
  b.mat(CANVAS, 0.15, 'canvas').loft([1800, 1872, 1977, 2571, 3008, 3585, 3809, 3933, 4007, 4041, 4052].map(x => dome(x, at(HALF, Math.max(x, 1780)) + 6, at(RAIL, x), at(ROOF, x))));
  b.mat(VISOR, 0.15, 'canvas').loft(([[1560, 565, 1593, 1620], [1607, 575, 1591, 1668], [1731, 605, 1622, 1734], [1800, 635, 1645, 1756], [1879, 645, 1703, 1774]] as const).map(([x, w, zb, zt]) => rect(x, w, zb, zt)));
  // ---- the nose: the radiator's dark core in its nickel shell, the diamond badge, the winged cap ----
  b.mat(DARK, 0.05).box(498, 522, -238, 238, 562, 1142);
  b.mat(NICKEL, 0.9, 'metal').loft([section(606, 282, 497, 1228, 5), section(486, 282, 497, 1228, 5), section(486, 236, 560, 1140, 5), section(524, 236, 560, 1140, 5)], false);
  b.lathe('x', [0, 0, 1184], [[478, 0], [486, 40]], 4, false).box(532, 552, -9, 9, 1226, 1296).box(526, 558, -48, 48, 1290, 1312).box(534, 550, -14, 14, 1310, 1338);
  b.mat(DARK, 0.05).lathe('x', [0, 0, 1184], [[474, 0], [479, 22]], 4, false);
  // ---- wings, running boards, lamps, wheels ----
  for (const s of [1, -1] as const) { const m = (p: readonly (readonly [number, number, number, number])[]) => p.map(([x, z, yi, yo]) => [x, z, s * yi, s * yo] as [number, number, number, number]);
    const front = [[136, 678, 600, 770], [150, 722, 570, 805], [198, 779, 545, 842], [297, 847, 540, 866], [420, 895, 540, 870], [569, 918, 540, 870], [717, 913, 540, 870], [865, 880, 540, 868], [989, 825, 540, 866], [1088, 748, 545, 862], [1187, 649, 552, 855], [1286, 541, 562, 845], [1385, 458, 578, 830], [1484, 402, 594, 815], [1607, 374, 628, 804], [1738, 372, 655, 800]] as const;
    b.mat(WING, 0.45, 'paint'); wing(b, m(front), [FX, R - 150]);
    wing(b, m([[3061, 300, 640, 800], [3063, 497, 636, 812], [3078, 619, 632, 835], [3120, 735, 630, 852], [3202, 828, 630, 868], [3313, 886, 630, 870], [3462, 916, 630, 870], [3585, 916, 630, 870], [3709, 891, 630, 866], [3820, 832, 628, 850], [3907, 732, 620, 822], [3966, 616, 600, 790], [4015, 490, 570, 750], [4070, 400, 545, 705], [4110, 368, 530, 680]]), [RX, R - 150]);
    // the front wing's inner sweep down to the frame
    b.mat(WING, 0.3, 'paint'); for (let i = 0; i + 1 < 10; i++) { const p = front[i]!, q = front[i + 1]!, zv = (z: number) => Math.min(z - 90, 540); b.quad([p[0], s * (p[2] + 4), p[1] - 16], [q[0], s * (q[2] + 4), q[1] - 16], [q[0], s * 325, zv(q[1])], [p[0], s * 325, zv(p[1])]); }
    b.mat('#1e1e20', 0.1); for (let i = 8; i < 11; i++) { const p = front[i]!, q = front[i + 1]!, v = (x: number, zt: number, j: number): V => { const z = 571 + (Math.max(576, zt - 30) - 571) * (j / 5) ** 2.5; return [x, s * (skin(x, z) + 8), z]; }; for (let j = 0; j < 5; j++) b.quad(v(p[0], p[1], j), v(q[0], q[1], j), v(q[0], q[1], j + 1), v(p[0], p[1], j + 1)); }   // the wheel house's dark on the bonnet side under the wing
    b.mat('#232325', 0.1).box(1738, 3061, Math.min(s * 640, s * 800), Math.max(s * 640, s * 800), 338, 378);                    // running board
    b.mat(NICKEL, 0.9, 'metal').box(1740, 3058, Math.min(s * 792, s * 808), Math.max(s * 792, s * 808), 332, 374);                         // its bright edge
    // headlamp: a drum front on a bowl, on its post; the tail lamp on the rear wing
    b.mat(NICKEL, 0.9, 'metal').lathe('x', [0, s * 425, 985], [[240, 116], [246, 124], [300, 124], [371, 104], [433, 62], [460, 12]], 14);
    b.mat(LENS, 0.6, 'lens').lathe('x', [0, s * 425, 985], [[234, 0], [239, 110]], 14, false);
    b.mat(NICKEL, 0.9, 'metal').box(300, 330, s * 425 - 15, s * 425 + 15, 690, 866);
    b.lathe('x', [0, s * 683, 763], [[3912, 26], [3932, 46], [3962, 46]], 10).box(3925, 3950, s * 683 - 10, s * 683 + 10, 650, 720);
    b.mat(RED, 0.5).lathe('x', [0, s * 683, 763], [[3962, 40], [3970, 24], [3972, 0]], 10, false);
    b.mat(DARK, 0.05).bar([44, s * 300, 430], [300, s * 300, 470], 34).bar([4060, s * 400, 440], [4290, s * 356, 440], 34);       // bumper irons
    b.mat(NICKEL, 0.9, 'metal').box(0, 46, s * 330 - 26, s * 330 + 26, 336, 520).box(4278, 4322, s * 345 - 26, s * 345 + 26, 352, 538);    // bumper clamps
    tyre(b, 'y', [FX, s * WY, R], s * (TW / 2), spin); tyre(b, 'y', [RX, s * WY, R], s * (TW / 2), spin); }
  // ---- across the car: lamp bar, bumpers (two bars front and rear), axles, the dark under the car ----
  b.mat(NICKEL, 0.9, 'metal').box(322, 348, -425, 425, 836, 862).box(4, 40, -735, 735, 447, 504).box(4, 40, -735, 735, 354, 411).box(4284, 4320, -745, 745, 463, 520).box(4284, 4320, -745, 745, 370, 427);
  b.mat(DARK, 0.05).box(200, 610, -330, 330, 400, 520).box(600, 1130, -330, 330, 380, 575).box(1125, 3071, -640, 640, 300, 572).box(3071, 3200, -560, 560, 380, 600).box(3200, 3935, -560, 560, 380, 800).box(3935, 4040, -560, 560, 370, 700)
    .bar([FX, -WY, R], [FX, WY, R], 60).bar([RX, -WY, R], [RX, WY, R], 80).box(3960, 4078, -90, 90, 690, 900);
  // ---- the spare on the back ----
  tyre(b, 'x', [4142, 0, 798], TW / 2, 0);
  return b.mesh(L); }
export const mesh = willys27Mesh;
