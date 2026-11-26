// The 1929 Pontiac 6-29 sedan as a low-polygon mesh (docs/systems/70_mesh_car_rules.md). Heights and stations are read
// off the side view of the part model (data/cars/sheet/pontiac29.json), widths off its boxes (plan and front view put
// on the one width, 1703 mm); wheelbase 2794, track 1422 and the 5.00-20 tyre from data/cars/specs.json.
import { Build, section, wing, type Mesh, type V } from './mesh';

const PAINT = '#585941', TOP = '#2c2c30', CANVAS = '#34343a', WING = '#34353a', FRAME = '#3f4046', CHROME = '#c4c5c8', STEEL = '#8d8e92', GILT = '#b39a62', CREAM = '#d8cfae';
const GLASS = '#5d6870', SHINE = '#a3acb3', RUBBER = '#26242b', DARK = '#1c1b20', LENS = '#efe9cf', RED = '#c22c2b', SEAM = '#2c2d22', BOARD = '#2a2a2d';
const TRIM = '#6d6250', CLOTH = '#9a8c70', LINER = '#2a2622', FLOOR = '#1f1c1a', DASH = '#4b3524', DIAL = '#cfc8b2';   // the inside: taupe mohair, a dark headliner
const WINS = [[1776, 2220, 1233, 1520], [2448, 2931, 1233, 1520], [3101, 3373, 1233, 1520]] as const;   // the three side windows
const FX = 485, RX = 3279, R = 378, WY = 711, TW = 132, L = 4030, BELT = 1189, SILL = 570;
/** linear reading of a table of [x, value] */
const at = (tab: [number, number][], x: number) => { if (x <= tab[0]![0]) return tab[0]![1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i]![0]) { const [x0, v0] = tab[i - 1]!, [x1, v1] = tab[i]!; return v0 + (v1 - v0) * (x - x0) / (x1 - x0); } return tab[tab.length - 1]![1]; };
// bonnet and scuttle: half-width, top, bottom, how square the top is
const NOSE_W: [number, number][] = [[506, 248], [1302, 486], [1330, 515], [1588, 630]];
const NOSE_T: [number, number][] = [[506, 1220], [1302, 1236], [1420, 1246], [1588, 1243]];
const NOSE_B: [number, number][] = [[506, 600], [700, 556], [1302, 552], [1588, 585]];
// the body behind the scuttle: half-width at the belt (plan), the roof's top (side view)
const BODY_W: [number, number][] = [[1588, 642], [1843, 681], [2188, 695], [3567, 695], [3653, 666], [3707, 607], [3735, 511], [3750, 357]];
const ROOF_T: [number, number][] = [[1592, 1675], [1680, 1713], [2068, 1749], [2326, 1757], [3487, 1755], [3616, 1747], [3699, 1708], [3736, 1655], [3750, 1615]];
const TUCK: [number, number][] = [[3675, 603], [3732, 806], [3750, 990]];
const BX = [1588, 1700, 1843, 2188, 2600, 2839, 2890, 2960, 3060, 3170, 3279, 3390, 3500, 3567, 3653, 3707, 3735, 3750];
const bodyBottom = (x: number) => Math.max(x < 1700 ? 600 : SILL, R + Math.sqrt(Math.max(0, 440 * 440 - (x - RX) * (x - RX))), x > 3675 ? at(TUCK, x) : 0);
const roofEdge = (x: number) => Math.min(1612, at(ROOF_T, x) - 12);
/** a ring from its left half, bottom to top ([y, z] pairs), mirrored to the right */
const ring = (x: number, half: [number, number][]): V[] => [...half.map(([y, z]) => [x, y, z] as V), ...half.slice().reverse().map(([y, z]) => [x, -y, z] as V)];
/** a roof ring: flat underneath (the roof's edge), domed above */
const dome = (x: number, w: number, zb: number, zt: number, n = 4.2, k = 8): V[] => Array.from({ length: k + 1 }, (_, i) => { const t = i / k * Math.PI, c = Math.cos(t), s = Math.sin(t); return [x, w * Math.sign(c) * Math.abs(c) ** (2 / n), zb + (zt - zb) * s ** (2 / n)] as V; });
/** the body side's y at height z (a little tumblehome above the belt) */
const sideY = (x: number, z: number) => at(BODY_W, x) - (z > BELT ? 24 * (z - BELT) / (1612 - BELT) : 0);

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

function tyre(b: Build, axis: 'x' | 'y', o: V, f: number) { const rim = 250, h = TW / 2;
  b.mat(RUBBER, 0.05, 'tyre').lathe(axis, o, [[-h, rim], [-h, R - 45], [-h + 32, R], [h - 32, R], [h, R - 45], [h, rim]], 20, false);
  b.mat(DARK, 0.05).lathe(axis, o, [[f * 0.45, 0], [f * 0.45, rim]], 20, false);                                     // the dark well behind the spokes
  b.mat(CREAM, 0.4, 'paint').lathe(axis, o, [[f, rim + 8], [f * 0.6, rim - 30]], 20, false);                                    // the cream rim
  b.mat(CHROME, 0.9, 'metal').lathe(axis, o, [[f * 0.5, 96], [f * 1.2, 84], [f * 1.45, 40], [f * 1.45, 0]], 12, false); }       // the large bright hub cap
function wheel(b: Build, x: number, s: 1 | -1, spin = 0) { const o: V = [x, s * WY, R], f = s * (TW / 2); tyre(b, 'y', o, f);
  b.mat(CREAM, 0.4, 'paint'); for (let k = 0; k < 16; k++) { const a = spin + k / 16 * Math.PI * 2, c = Math.cos(a), q = Math.sin(a); b.bar([x + c * 70, s * WY + f * 1.05, R + q * 70], [x + c * 226, s * WY + f * 0.62, R + q * 226], 13); } }
/** a window in the body side: the pane a little proud of the skin, a pale reflection across its top corner, a frame of bars round it */
function sideWindow(b: Build, s: 1 | -1, x0: number, x1: number, z0: number, z1: number) { const p = (x: number, z: number, o: number): V => [x, s * (sideY(x, z) + o), z];
  b.mat(GLASS, 0.5, 'glass').quad(p(x0, z0, 5), p(x1, z0, 5), p(x1, z1, 5), p(x0, z1, 5));
  const w = x1 - x0, h = z1 - z0; b.mat(SHINE, 0.5, 'shine').quad(p(x0 + w * 0.12, z1 - 14, 7), p(x0 + w * 0.5, z1 - 14, 7), p(x0 + w * 0.26, z0 + h * 0.3, 7), p(x0 + w * 0.12, z0 + h * 0.52, 7));
  b.mat(FRAME, 0.3).bar(p(x0 - 12, z0 - 12, 8), p(x1 + 12, z0 - 12, 8), 26, 14).bar(p(x0 - 12, z1 + 12, 8), p(x1 + 12, z1 + 12, 8), 26, 14).bar(p(x0 - 12, z0 - 12, 8), p(x0 - 12, z1 + 12, 8), 14, 26).bar(p(x1 + 12, z0 - 12, 8), p(x1 + 12, z1 + 12, 8), 14, 26); }

export function mesh(spin = 0): Mesh { const b = new Build();
  // ---- bonnet and scuttle, the body to the belt, the cabin above it, the cloth roof ----
  b.mat(PAINT, 0.45, 'paint').loft([506, 600, 700, 900, 1100, 1302, 1330, 1420, 1500, 1588].map(x => section(x, at(NOSE_W, x), at(NOSE_B, x), at(NOSE_T, x), x < 1302 ? 3.4 + (x - 506) / 800 : 4.4, 6)));
  { const tub = BX.map(x => { const w = at(BODY_W, x), zb = bodyBottom(x); return [[x, w, BELT], [x, w, zb + 45], [x, w - 60, zb], [x, -(w - 60), zb], [x, -w, zb + 45], [x, -w, BELT]] as V[]; });   // open above: the cabin is hollow
    strips(b, tub); fan(b, tub[0]!); fan(b, tub[tub.length - 1]!); }
  b.mat(TOP, 0.35, 'paint'); for (const s of [1, -1]) wall(b, BX, (x, z) => s * sideY(x, z), () => BELT, roofEdge, WINS);
  across(b, 1588, 630, BELT, roofEdge(1588), [452, 1258, 1569]); across(b, 3750, at(BODY_W, 3750), BELT, roofEdge(3750), [330, 1315, 1550]);
  b.mat(CANVAS, 0.12, 'canvas').loft([1592, 1680, 1843, 2068, 2326, 2900, 3487, 3616, 3699, 3736, 3750].map(x => dome(x, at(BODY_W, x) - 2, roofEdge(x), at(ROOF_T, x))));
  // ---- the inside: floor, toe board and dash, the panels' inner faces, headliner, seats, the shelf behind the rear seat ----
  { const fl = (x: number) => Math.max(bodyBottom(x), 590) + 6, IX = BX.filter(x => x > 1588 + 20 && x < 3722 - 10), e = (x: number) => roofEdge(x) - 3;
    b.mat(FLOOR, 0.05); strips(b, [1588 + 4, ...IX, 3722].map(x => { const w = at(BODY_W, x) - 20; return [[x, -w, fl(x)], [x, w, fl(x)]] as V[]; }));
    across(b, 1588 + 5, 642 - 16, 590, 1250);                                                                    // the toe board
    b.mat(DASH, 0.3, 'wood').box(1588 + 7, 1588 + 44, -642 + 30, 642 - 30, 1040, 1250);                                  // the dash's back face
    b.mat(DIAL, 0.3).box(1588 + 44, 1588 + 48, -170, 170, 1040 + 50, 1250 - 50);                                                      // its instrument board
    b.mat(TRIM, 0.12, 'canvas'); for (const s of [1, -1]) wall(b, [1588 + 9, ...IX, 3722], (x, z) => s * (sideY(x, z) - 28), fl, e, WINS);
    across(b, 1588 + 9, 642 - 28, 1250, e(1588 + 9), [452, 1258, 1569]); across(b, 3722, at(BODY_W, 3722) - 28, 1290, e(3722), [330, 1315, 1550]);
    strips(b, [3560, ...IX.filter(x => x > 3560), 3722].map(x => { const w = at(BODY_W, x) - 28; return [[x, -w, 1290], [x, w, 1290]] as V[]; }));   // the parcel shelf
    b.mat(LINER, 0.05, 'canvas'); strips(b, [1588 + 9, ...IX, 3722].map(x => { const w = at(BODY_W, x) - 26; return [[x, -w, e(x)], [x, w, e(x)]] as V[]; }));   // the headliner
    seat(b, 1870, 590, 950, 640); seat(b, 3560 - 580, 590, 965, 610); }
  b.mat(CANVAS, 0.12, 'canvas').loft(([[1494, 600, 1594, 1606], [1570, 640, 1588, 1676], [1640, 658, 1634, 1699]] as const).map(([x, w, z0, z1]) => [[x, -w, z0], [x, w, z0], [x, w, z1], [x, -w, z1]] as V[]));   // the visor
  // ---- glass: the screen, three windows a side, the back light ----
  b.mat(GLASS, 0.5, 'glass').quad([1584, -452, 1258], [1584, 452, 1258], [1584, 452, 1569], [1584, -452, 1569]);
  b.mat(SHINE, 0.5, 'shine').quad([1582, 120, 1560], [1582, 400, 1560], [1582, 400, 1420], [1582, 250, 1330]);
  b.mat(FRAME, 0.3).bar([1582, -470, 1246], [1582, 470, 1246], 16, 24).bar([1582, -466, 1246], [1582, -466, 1590], 16, 26).bar([1582, 466, 1246], [1582, 466, 1590], 16, 26);
  b.mat(CHROME, 0.9, 'metal').bar([1572, 300, 1570], [1572, 230, 1440], 10);                                                    // the wiper
  for (const s of [1, -1] as const) for (const [x0, x1, z0, z1] of WINS) sideWindow(b, s, x0, x1, z0, z1);
  b.mat(GLASS, 0.5, 'glass').quad([3756, -330, 1315], [3756, 330, 1315], [3756, 330, 1550], [3756, -330, 1550]);
  b.mat(SHINE, 0.5, 'shine').quad([3758, -280, 1540], [3758, -60, 1540], [3758, -170, 1400], [3758, -280, 1440]);
  b.mat(FRAME, 0.3).bar([3758, -342, 1303], [3758, 342, 1303], 14, 24).bar([3758, -342, 1562], [3758, 342, 1562], 14, 24).bar([3758, -342, 1303], [3758, -342, 1562], 14, 24).bar([3758, 342, 1303], [3758, 342, 1562], 14, 24);
  // ---- on the skin: bonnet hinges, louvres, the bright band at the scuttle, shut lines, handles, scuttle lamps ----
  b.mat(CHROME, 0.9, 'metal').bar([520, 0, at(NOSE_T, 520) + 3], [1300, 0, at(NOSE_T, 1300) + 3], 14, 8);
  b.loft([1304, 1326].map(x => section(x, at(NOSE_W, 1315) + 5, 800, at(NOSE_T, 1315) + 5, 4.4, 6)), false);
  for (const s of [1, -1]) { b.mat(CHROME, 0.9, 'metal').bar([520, s * (at(NOSE_W, 520) * 0.975 + 2), 1100], [1300, s * (at(NOSE_W, 1300) * 0.975 + 2), 1104], 10);
    b.mat(SEAM, 0.1); for (let k = 0; k < 13; k++) { const x = 640 + k * 44, y = s * (at(NOSE_W, x + 8) + 3); b.quad([x, y, 690], [x + 14, y, 690], [x + 14, y, 985], [x, y, 985]); }
    const y = (x: number) => s * (at(BODY_W, x) + 3); for (const [x, z0] of [[1700, 610], [2345, 580], [2992, 880]] as const) b.quad([x, y(x), z0], [x + 9, y(x), z0], [x + 9, y(x), BELT - 4], [x, y(x), BELT - 4]);
    b.mat(CHROME, 0.9, 'metal').bar([2185, s * (at(BODY_W, 2185) + 22), 1060], [2300, s * (at(BODY_W, 2300) + 22), 1060], 16).bar([2395, s * (at(BODY_W, 2395) + 22), 1100], [2510, s * (at(BODY_W, 2510) + 22), 1100], 16);
    b.lathe('x', [0, s * 668, 1200], [[1488, 0], [1496, 22], [1540, 22], [1562, 8]], 8); }
  // ---- the nose: the bright shell with its arched top, the dark core, badge, crank cover, the gilt mascot ----
  b.mat(CHROME, 0.9, 'metal').loft([section(520, 258, 596, 1228, 3.4), section(400, 258, 596, 1228, 3.4), section(400, 214, 640, 1128, 3.4), section(430, 214, 640, 1128, 3.4)], false);
  b.mat(DARK, 0.05).box(416, 510, -236, 236, 480, 1160);
  b.mat('#3a3a40', 0.1); for (let k = -4; k <= 4; k++) b.box(410, 418, k * 46 - 3, k * 46 + 3, 640, 1125);
  b.mat(CHROME, 0.9, 'metal').box(394, 402, -34, 34, 1132, 1196).box(404, 416, -30, 30, 560, 640);
  b.mat(RED, 0.6).box(390, 395, -20, 20, 1146, 1182);
  b.mat(GILT, 0.8, 'metal').lathe('x', [0, 0, 1228], [[430, 0], [432, 26], [470, 26], [472, 0]], 8).box(425, 480, -9, 9, 1250, 1318).box(410, 490, -34, 34, 1276, 1292);
  // ---- wings, running boards, lamps, wheels ----
  for (const s of [1, -1] as const) { const side = (p: readonly (readonly [number, number, number, number])[]) => p.map(([x, z, yi, yo]) => [x, z, s * yi, s * yo] as [number, number, number, number]);
    b.mat(WING, 0.45, 'paint');
    wing(b, side([[118, 700, 520, 790], [140, 800, 540, 830], [250, 886, 560, 848], [339, 911, 565, 851], [512, 922, 565, 851], [683, 886, 560, 851], [856, 783, 520, 851], [1027, 619, 480, 848], [1195, 504, 480, 845], [1408, 420, 560, 842], [1590, 350, 640, 840]]), [FX, R - 200]);
    wing(b, side([[2742, 350, 640, 840], [2760, 517, 640, 846], [2800, 635, 640, 850], [2849, 729, 640, 851], [2919, 812, 640, 851], [3086, 898, 640, 851], [3208, 912, 640, 851], [3389, 864, 640, 851], [3528, 750, 630, 850], [3633, 582, 590, 838], [3715, 420, 560, 800], [3840, 364, 540, 720]]), [RX, R - 200]);
    b.mat(BOARD, 0.1).box(1580, 2752, Math.min(s * 640, s * 836), Math.max(s * 640, s * 836), 300, 344);
    b.mat(CHROME, 0.9, 'metal').box(1600, 2748, Math.min(s * 832, s * 846), Math.max(s * 832, s * 846), 298, 350);
    b.mat(STEEL, 0.6, 'metal').lathe('x', [0, s * 381, 950], [[286, 112], [300, 118], [345, 116], [404, 88], [448, 42], [460, 0]], 14);                // the bullet lamp
    b.mat(CHROME, 0.9, 'metal').lathe('x', [0, s * 381, 950], [[274, 108], [274, 122], [300, 124], [304, 118]], 14, false);
    b.mat(LENS, 0.6, 'lens').lathe('x', [0, s * 381, 950], [[272, 0], [276, 108]], 14, false);
    b.mat(DARK, 0.05).bar([405, s * 381, 840], [430, s * 330, 640], 34).bar([60, s * 265, 420], [330, s * 300, 450], 30);                      // lamp stand, bumper iron
    b.mat(CHROME, 0.9, 'metal').lathe('x', [0, s * 705, 946], [[352, 0], [356, 24], [400, 22], [420, 6]], 8);                                           // the lamp on the wing's crown
    b.box(-6, 46, s * 412 - 22, s * 412 + 22, 318, 494).box(-6, 46, s * 770 - 16, s * 770 + 16, 322, 490);                                    // front bumper clamps
    b.box(3936, 3976, Math.min(s * 358, s * 790), Math.max(s * 358, s * 790), 442, 492).box(3936, 3976, Math.min(s * 358, s * 790), Math.max(s * 358, s * 790), 350, 400);   // the split rear bumper
    b.box(3930, 3984, s * 400 - 20, s * 400 + 20, 330, 506).box(3930, 3984, s * 770 - 16, s * 770 + 16, 336, 500);
    b.lathe('x', [0, s * 667, 769], [[3740, 40], [3760, 62], [3784, 62]], 10); b.mat(RED, 0.5).lathe('x', [0, s * 667, 769], [[3784, 54], [3796, 34], [3798, 0]], 10, false);   // tail lamps
    b.mat(DARK, 0.05).bar([3760, s * 600, 440], [3940, s * 600, 440], 34);
    wheel(b, FX, s, spin); wheel(b, RX, s, spin); }
  // ---- across the car: bumpers, plate, the dark under the body, axles ----
  b.mat(CHROME, 0.9, 'metal').box(0, 40, -790, 790, 426, 478).box(0, 40, -790, 790, 334, 386);
  b.mat('#d9d6cf', 0.3).box(3790, 3800, 490, 800, 545, 690); b.mat(DARK, 0.05).box(3798, 3804, 506, 784, 560, 675);
  b.mat(DARK, 0.05).box(120, 620, -330, 330, 400, 600).box(600, 1340, -480, 480, 330, 600).box(1340, 2860, -640, 640, 345, 590).box(2860, 3760, -590, 590, 330, 640)
    .bar([FX, -WY, R - 60], [FX, WY, R - 60], 60).bar([RX, -WY, R], [RX, WY, R], 80);
  // ---- the spare on the back, on its carrier ----
  { const o: V = [3900, 0, 690]; b.mat(DARK, 0.05).box(3740, 3880, -140, 140, 630, 770); tyre(b, 'x', o, TW / 2);
    b.mat(CREAM, 0.4, 'paint'); for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, c = Math.cos(a), q = Math.sin(a); b.bar([3900 + TW / 2 * 1.05, c * 70, 690 + q * 70], [3900 + TW / 2 * 0.62, c * 226, 690 + q * 226], 13); } }
  return b.mesh(L); }
