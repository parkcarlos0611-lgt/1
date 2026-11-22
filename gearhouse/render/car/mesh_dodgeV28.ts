// The 1928 Dodge Brothers Victory Six sedan as a low-polygon mesh (docs/systems/70_mesh_car_rules.md). Heights and
// stations are read off the side view of the part model (data/cars/sheet/dodgeV28.json). Its boxes are 1981 mm wide
// (the front view's reading); the car is about 1760, so every width is taken at 0.9 (SW), the body at 0.92.
// Wheelbase 2864, track 1422 and the 5.50-18 tyre from data/cars/specs.json.
import { Build, section, wing, type Mesh, type V } from './mesh';

const PAINT = '#2b3f61', BAND = '#44597a', TOP = '#2c2c30', CANVAS = '#313136', WING = '#45454d', CHROME = '#c4c5c8', NICKEL = '#b9b6b0', WOOD = '#5a463a', ALU = '#8c8a8a';
const GLASS = '#5d6870', SHINE = '#b7bdc5', RUBBER = '#26242b', DARK = '#1c1b20', LENS = '#e6dfc4', RED = '#c22c2b', SEAM = '#16203a';
const TRIM = '#5c626d', CLOTH = '#8b919b', LINER = '#26262a', FLOOR = '#1d1c1f', DASH = '#4a3526', DIAL = '#c9c7c0', FRAME = '#33333a';   // the inside: blue-grey broadcloth, a dark headliner
const WINS = [[1797, 2323, 1280, 1613], [2560, 3050, 1280, 1613], [3265, 3563, 1280, 1613]] as const;   // the three side windows
const FX = 565, RX = 3429, R = 376, WY = 711, TW = 150, L = 4225, BELT = 1236, SILL = 610, SW = 0.9;
/** linear reading of a table of [x, value] */
const at = (tab: [number, number][], x: number) => { if (x <= tab[0]![0]) return tab[0]![1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i]![0]) { const [x0, v0] = tab[i - 1]!, [x1, v1] = tab[i]!; return v0 + (v1 - v0) * (x - x0) / (x1 - x0); } return tab[tab.length - 1]![1]; };
// bonnet and scuttle: half-width, top, bottom
const NOSE_W: [number, number][] = ([[560, 304], [1385, 538], [1401, 560], [1640, 650]] as [number, number][]).map(([x, w]) => [x, w * SW]);
const NOSE_T: [number, number][] = [[560, 1275], [1385, 1296], [1500, 1304], [1640, 1306]];
const NOSE_B: [number, number][] = [[560, 660], [760, 624], [1385, 624], [1640, 640]];
// the body behind the scuttle: half-width at the belt (plan), the roof's top (side view), the belt moulding's edges
const BODY_W: [number, number][] = ([[1640, 650], [1680, 705], [1760, 726], [2326, 732], [3676, 732], [3799, 703], [3874, 612], [3900, 448]] as [number, number][]).map(([x, w]) => [x, w * 0.92]);
const ROOF_T: [number, number][] = [[1640, 1746], [1727, 1782], [1953, 1810], [2511, 1830], [3780, 1830], [3866, 1794], [3893, 1735], [3900, 1700]];
const BAND0: [number, number][] = [[1640, 1156], [3616, 1158], [3730, 1175], [3900, 1210]], BAND1: [number, number][] = [[1640, 1217], [3616, 1217], [3725, 1227], [3900, 1258]];
const BX = [1640, 1680, 1760, 2326, 2760, 2989, 3040, 3110, 3210, 3320, 3429, 3540, 3676, 3799, 3874, 3900];
const bodyBottom = (x: number) => Math.max(x > 3760 ? 650 : SILL, R + Math.sqrt(Math.max(0, 440 * 440 - (x - RX) * (x - RX))));
const roofEdge = (x: number) => Math.min(1690, at(ROOF_T, x) - 12);
/** a ring from its left half, bottom to top ([y, z] pairs), mirrored to the right */
const ring = (x: number, half: [number, number][]): V[] => [...half.map(([y, z]) => [x, y, z] as V), ...half.slice().reverse().map(([y, z]) => [x, -y, z] as V)];
/** a roof ring: flat underneath (the roof's edge), domed above */
const dome = (x: number, w: number, zb: number, zt: number, n = 4.2, k = 8): V[] => Array.from({ length: k + 1 }, (_, i) => { const t = i / k * Math.PI, c = Math.cos(t), s = Math.sin(t); return [x, w * Math.sign(c) * Math.abs(c) ** (2 / n), zb + (zt - zb) * s ** (2 / n)] as V; });
/** the body side's y at height z (a little tumblehome above the belt) */
const sideY = (x: number, z: number) => at(BODY_W, x) - (z > BELT ? 22 * (z - BELT) / (1690 - BELT) : 0);

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

function tyre(b: Build, axis: 'x' | 'y', o: V, f: number) { const rim = 244, h = TW / 2;
  b.mat(RUBBER, 0.05, 'tyre').lathe(axis, o, [[-h, rim], [-h, R - 50], [-h + 36, R], [h - 36, R], [h, R - 50], [h, rim]], 20, false);
  b.mat(DARK, 0.05).lathe(axis, o, [[f * 0.4, 0], [f * 0.4, rim]], 20, false);                                       // the dark behind the spokes
  b.mat(PAINT, 0.45, 'wood').lathe(axis, o, [[f * 0.94, rim + 2], [f * 0.55, rim - 36]], 20, false); b.mat(PAINT, 0.45, 'paint').lathe(axis, o, [[f * 0.5, 96], [f * 1.0, 80], [f * 1.0, 0]], 12, false);   // the painted felloe and hub
  b.mat(CHROME, 0.9, 'metal').lathe(axis, o, [[f, rim + 12], [f * 0.94, rim + 1]], 20, false);                                  // the thin bright ring
  b.mat(NICKEL, 0.9, 'metal').lathe(axis, o, [[f * 1.0, 52], [f * 1.5, 44], [f * 1.6, 0]], 10, false); }                        // the nickel cap
/** twelve wooden spokes: wide flat bars, painted */
function spokes(b: Build, axis: 'x' | 'y', o: V, f: number, spin = 0) { b.mat(PAINT, 0.45, 'wood');
  for (let k = 0; k < 12; k++) { const a = spin + k / 12 * Math.PI * 2, c = Math.cos(a), q = Math.sin(a), p = (r: number, d: number): V => axis === 'y' ? [o[0] + c * r, o[1] + d, o[2] + q * r] : [o[0] + d, o[1] + c * r, o[2] + q * r]; b.bar(p(70, f * 0.8), p(222, f * 0.62), axis === 'y' ? 40 : 22, axis === 'y' ? 22 : 40); } }
function wheel(b: Build, x: number, s: 1 | -1, spin = 0) { const o: V = [x, s * WY, R], f = s * (TW / 2); tyre(b, 'y', o, f); spokes(b, 'y', o, f, spin); }
/** a window in the body side: the pane a little proud of the skin, a pale reflection across its top corner, a wood garnish frame round it */
function sideWindow(b: Build, s: 1 | -1, x0: number, x1: number, z0: number, z1: number) { const p = (x: number, z: number, o: number): V => [x, s * (sideY(x, z) + o), z];
  b.mat(GLASS, 0.5, 'glass').quad(p(x0, z0, 5), p(x1, z0, 5), p(x1, z1, 5), p(x0, z1, 5));
  const w = x1 - x0, h = z1 - z0; b.mat(SHINE, 0.5, 'shine').quad(p(x0 + w * 0.12, z1 - 14, 7), p(x0 + w * 0.5, z1 - 14, 7), p(x0 + w * 0.26, z0 + h * 0.3, 7), p(x0 + w * 0.12, z0 + h * 0.52, 7));
  b.mat(WOOD, 0.25, 'wood').bar(p(x0 - 14, z0 - 14, 8), p(x1 + 14, z0 - 14, 8), 30, 14).bar(p(x0 - 14, z1 + 14, 8), p(x1 + 14, z1 + 14, 8), 30, 14).bar(p(x0 - 14, z0 - 14, 8), p(x0 - 14, z1 + 14, 8), 14, 30).bar(p(x1 + 14, z0 - 14, 8), p(x1 + 14, z1 + 14, 8), 14, 30); }

export function mesh(spin = 0): Mesh { const b = new Build();
  // ---- bonnet and scuttle, the body to the belt, the cabin above it, the cloth roof, the visor ----
  b.mat(PAINT, 0.45, 'paint').loft([560, 660, 760, 960, 1170, 1385, 1401, 1500, 1640].map(x => section(x, at(NOSE_W, x), at(NOSE_B, x), at(NOSE_T, x), x < 1385 ? 3.6 + (x - 560) / 900 : 4.5, 6)));
  { const tub = BX.map(x => { const w = at(BODY_W, x), zb = bodyBottom(x); return [[x, w, BELT], [x, w, zb + 45], [x, w - 60, zb], [x, -(w - 60), zb], [x, -w, zb + 45], [x, -w, BELT]] as V[]; });   // open above: the cabin is hollow
    strips(b, tub); fan(b, tub[0]!); fan(b, tub[tub.length - 1]!); }
  b.mat(BAND, 0.45, 'paint'); for (const s of [1, -1]) wall(b, BX, x => s * (at(BODY_W, x) + 7), x => at(BAND0, x), x => at(BAND1, x));           // the broad belt moulding, sweeping up round the back
  across(b, 3902, at(BODY_W, 3900) + 7, at(BAND0, 3900), at(BAND1, 3900));
  b.mat(TOP, 0.35, 'paint'); for (const s of [1, -1]) wall(b, BX, (x, z) => s * sideY(x, z), () => BELT, roofEdge, WINS);
  across(b, 1640, at(BODY_W, 1640) - 10, BELT, roofEdge(1640), [470, 1326, 1650]); across(b, 3900, at(BODY_W, 3900), BELT, roofEdge(3900), [292, 1354, 1540]);
  b.mat(CANVAS, 0.12, 'canvas').loft([1640, 1727, 1953, 2250, 2511, 3100, 3780, 3866, 3893, 3900].map(x => dome(x, at(BODY_W, x) - 2, roofEdge(x), at(ROOF_T, x))));
  // ---- the inside: floor, toe board and dash, the panels' inner faces, headliner, seats, the shelf behind the rear seat ----
  { const fl = (x: number) => Math.max(bodyBottom(x), 640) + 6, IX = BX.filter(x => x > 1640 + 20 && x < 3872 - 10), e = (x: number) => roofEdge(x) - 3;
    b.mat(FLOOR, 0.05); strips(b, [1640 + 4, ...IX, 3872].map(x => { const w = at(BODY_W, x) - 20; return [[x, -w, fl(x)], [x, w, fl(x)]] as V[]; }));
    across(b, 1640 + 5, 598 - 16, 640, 1310);                                                                    // the toe board
    b.mat(DASH, 0.3, 'wood').box(1640 + 7, 1640 + 44, -598 + 30, 598 - 30, 1090, 1310);                                  // the dash's back face
    b.mat(DIAL, 0.3).box(1640 + 44, 1640 + 48, -170, 170, 1090 + 50, 1310 - 50);                                                      // its instrument board
    b.mat(TRIM, 0.12, 'canvas'); for (const s of [1, -1]) wall(b, [1640 + 9, ...IX, 3872], (x, z) => s * (sideY(x, z) - 28), fl, e, WINS);
    across(b, 1640 + 9, 598 - 28, 1310, e(1640 + 9), [470, 1326, 1650]); across(b, 3872, at(BODY_W, 3872) - 28, 1325, e(3872), [292, 1354, 1540]);
    strips(b, [3700, ...IX.filter(x => x > 3700), 3872].map(x => { const w = at(BODY_W, x) - 28; return [[x, -w, 1325], [x, w, 1325]] as V[]; }));   // the parcel shelf
    b.mat(LINER, 0.05, 'canvas'); strips(b, [1640 + 9, ...IX, 3872].map(x => { const w = at(BODY_W, x) - 26; return [[x, -w, e(x)], [x, w, e(x)]] as V[]; }));   // the headliner
    seat(b, 1900, 640, 1000, 615); seat(b, 3700 - 580, 640, 1010, 585); }
  b.mat(CANVAS, 0.12, 'canvas').loft(([[1546, 560, 1642, 1660], [1640, 600, 1632, 1722], [1727, 640, 1697, 1754]] as const).map(([x, w, z0, z1]) => [[x, -w, z0], [x, w, z0], [x, w, z1], [x, -w, z1]] as V[]));
  // ---- glass: the screen, three windows a side, the back light ----
  b.mat(GLASS, 0.5, 'glass').quad([1632, -470, 1326], [1632, 470, 1326], [1632, 470, 1650], [1632, -470, 1650]);
  b.mat(SHINE, 0.5, 'shine').quad([1630, 120, 1640], [1630, 410, 1640], [1630, 410, 1500], [1630, 260, 1400]);
  b.mat(FRAME, 0.3).bar([1630, -488, 1314], [1630, 488, 1314], 16, 24).bar([1630, -484, 1314], [1630, -484, 1660], 16, 26).bar([1630, 484, 1314], [1630, 484, 1660], 16, 26);
  b.mat(CHROME, 0.9, 'metal').bar([1620, 300, 1636], [1620, 240, 1500], 10);                                                    // the wiper
  for (const s of [1, -1] as const) for (const [x0, x1, z0, z1] of WINS) sideWindow(b, s, x0, x1, z0, z1);
  b.mat(GLASS, 0.5, 'glass').quad([3906, -292, 1354], [3906, 292, 1354], [3906, 292, 1540], [3906, -292, 1540]);
  b.mat(SHINE, 0.5, 'shine').quad([3908, -250, 1530], [3908, -40, 1530], [3908, -150, 1420], [3908, -250, 1450]);
  b.mat(WOOD, 0.25, 'wood').bar([3908, -306, 1340], [3908, 306, 1340], 14, 28).bar([3908, -306, 1554], [3908, 306, 1554], 14, 28).bar([3908, -306, 1340], [3908, -306, 1554], 14, 28).bar([3908, 306, 1340], [3908, 306, 1554], 14, 28);
  // ---- on the skin: bonnet hinges, louvres, the bright band at the scuttle, shut lines, handles, scuttle lamps ----
  b.mat(CHROME, 0.9, 'metal').bar([575, 0, at(NOSE_T, 575) + 3], [1383, 0, at(NOSE_T, 1383) + 3], 14, 8);
  b.loft([1387, 1403].map(x => section(x, at(NOSE_W, 1395) + 5, 830, at(NOSE_T, 1395) + 5, 4.5, 6)), false);
  for (const s of [1, -1]) { b.mat(SEAM, 0.1).bar([575, s * (at(NOSE_W, 575) * 0.975 + 2), 1146], [1383, s * (at(NOSE_W, 1383) * 0.975 + 2), 1150], 9);
    for (let k = 0; k < 18; k++) { const x = 668 + k * 35, y = s * (at(NOSE_W, x + 6) + 3); b.quad([x, y, 745], [x + 12, y, 745], [x + 12, y, 1060], [x, y, 1060]); }
    const y = (x: number) => s * (at(BODY_W, x) + 3); for (const [x, z0] of [[1730, 650], [2440, 620], [2462, 620], [3196, 930]] as const) b.quad([x, y(x), z0], [x + 8, y(x), z0], [x + 8, y(x), 1154], [x, y(x), 1154]);
    b.mat(CHROME, 0.9, 'metal').bar([2285, s * (at(BODY_W, 2285) + 24), 1118], [2415, s * (at(BODY_W, 2415) + 24), 1118], 18).bar([2500, s * (at(BODY_W, 2500) + 24), 1030], [2630, s * (at(BODY_W, 2630) + 24), 1030], 18);
    b.lathe('x', [0, s * (at(NOSE_W, 1536) + 14), 1208], [[1500, 0], [1508, 30], [1552, 30], [1568, 10]], 8); }
  // ---- the nose: the flat bright shell with its broad arched top, the dark core, the winged badge and motometer ----
  b.mat(CHROME, 0.9, 'metal').loft([section(575, 281, 676, 1284, 3.6), section(462, 281, 676, 1284, 3.6), section(462, 232, 716, 1180, 4), section(490, 232, 716, 1180, 4)], false);
  b.mat(DARK, 0.05).box(478, 565, -258, 258, 500, 1220);
  b.mat('#35353b', 0.1); for (let k = -5; k <= 5; k++) b.box(472, 480, k * 42 - 3, k * 42 + 3, 716, 1178);
  b.mat(CHROME, 0.9, 'metal').box(455, 463, -56, 56, 1200, 1250).box(452, 458, -14, 14, 1168, 1262);
  b.mat(NICKEL, 0.9, 'metal').lathe('x', [0, 0, 1284], [[488, 0], [490, 28], [530, 28], [532, 0]], 8).lathe('x', [0, 0, 1338], [[500, 0], [503, 26], [517, 26], [520, 0]], 10).box(505, 515, -44, 44, 1300, 1316);
  // ---- wings, running boards, lamps, wheels ----
  for (const s of [1, -1] as const) { const side = (p: readonly (readonly [number, number, number, number])[]) => p.map(([x, z, yi, yo]) => [x, z, s * yi, s * yo] as [number, number, number, number]);
    b.mat(WING, 0.45, 'paint');
    wing(b, side([[131, 700, 520, 800], [150, 800, 545, 850], [209, 870, 560, 872], [298, 915, 565, 880], [389, 945, 565, 880], [568, 968, 565, 880], [740, 938, 560, 880], [914, 838, 520, 880], [1007, 751, 480, 878], [1151, 601, 470, 875], [1270, 516, 470, 872], [1440, 452, 540, 870], [1640, 410, 610, 868]]), [FX, R - 200]);
    wing(b, side([[2800, 410, 620, 868], [2849, 556, 625, 874], [2891, 693, 625, 880], [2960, 804, 625, 880], [3038, 882, 625, 880], [3140, 934, 625, 880], [3265, 961, 625, 880], [3377, 964, 625, 880], [3492, 944, 625, 880], [3606, 896, 625, 880], [3699, 818, 620, 878], [3770, 715, 610, 872], [3834, 604, 600, 860], [3946, 377, 570, 800], [4004, 322, 560, 740]]), [RX, R - 200]);
    b.mat(ALU, 0.4, 'metal').box(1600, 2816, Math.min(s * 610, s * 866), Math.max(s * 610, s * 866), 352, 404);
    b.mat(CHROME, 0.9, 'metal').box(1640, 2812, Math.min(s * 862, s * 877), Math.max(s * 862, s * 877), 350, 410);
    b.mat(DARK, 0.3, 'paint').lathe('x', [0, s * 385, 996], [[330, 124], [400, 120], [450, 92], [486, 50], [492, 0]], 14);                              // the drum lamp: black bowl
    b.mat(CHROME, 0.9, 'metal').lathe('x', [0, s * 385, 996], [[296, 112], [296, 128], [336, 130], [342, 122]], 14, false);                            // its deep bright rim
    b.mat(LENS, 0.6, 'lens').lathe('x', [0, s * 385, 996], [[292, 0], [298, 112]], 14, false);
    b.mat(DARK, 0.05).bar([410, s * 385, 880], [410, s * 385, 832], 50).bar([420, s * 372, 820], [450, s * 340, 660], 34).bar([70, s * 300, 440], [360, s * 330, 480], 30);   // lamp stand, bumper iron
    b.mat(CHROME, 0.9, 'metal').box(-6, 48, s * 395 - 22, s * 395 + 22, 290, 516);                                                                      // front bumper clamp
    b.box(4120, 4160, Math.min(s * 378, s * 800), Math.max(s * 378, s * 800), 458, 516).box(4120, 4160, Math.min(s * 378, s * 800), Math.max(s * 378, s * 800), 366, 425);   // the split rear bumper
    b.box(4114, 4170, s * 560 - 18, s * 560 + 18, 325, 530);
    b.mat(DARK, 0.05).bar([3900, s * 560, 450], [4125, s * 560, 450], 34);
    wheel(b, FX, s, spin); wheel(b, RX, s, spin); }
  // ---- across the car: the lamp bar, bumpers, tail lamp and plate, the dark under the body, axles ----
  b.mat(CHROME, 0.9, 'metal').box(430, 452, -372, 372, 816, 850).box(0, 42, -780, 780, 443, 505).box(0, 42, -780, 780, 338, 400).lathe('x', [0, 0, 422], [[-8, 0], [-6, 50], [20, 50]], 10, false);
  b.mat(DARK, 0.05).bar([3990, 560, 800], [4090, 560, 811], 30).box(4082, 4096, 410, 740, 545, 715);
  b.mat(CHROME, 0.9, 'metal').lathe('x', [0, 560, 811], [[4080, 44], [4096, 60], [4130, 60]], 10); b.mat(RED, 0.5).lathe('x', [0, 560, 811], [[4130, 52], [4142, 32], [4144, 0]], 10, false);
  b.mat('#c9c7c2', 0.4).loft([[4096, 400, 536], [4100, 400, 536]].map(([x]) => [[x!, 404, 536], [x!, 746, 536], [x!, 746, 724], [x!, 404, 724]] as V[]), false);
  b.mat(DARK, 0.05).box(160, 700, -340, 340, 420, 660).box(680, 1420, -470, 470, 360, 660).box(1420, 2990, -625, 625, 404, 640).box(2990, 3905, -600, 600, 330, 680)
    .bar([FX, -WY, R - 60], [FX, WY, R - 60], 60).bar([RX, -WY, R], [RX, WY, R], 80);
  // ---- the spare on the back, on its carrier ----
  { const o: V = [4085, 0, 715]; b.mat(DARK, 0.05).box(3890, 4060, -160, 160, 630, 810); tyre(b, 'x', o, TW / 2); spokes(b, 'x', o, TW / 2); }
  return b.mesh(L); }
