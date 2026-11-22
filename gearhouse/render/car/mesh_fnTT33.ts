// The 1933 Frazer Nash TT Replica as a low-polygon mesh (docs/systems/70_mesh_car_rules.md). Heights and lengths are
// read off the sheet's side view, widths off its plan (data/cars/sheet/fnTT33.json, 6.49 mm a pixel at the real
// wheelbase 2590); the wheels stand at the real track (specs: 1270, the sheet drew them 1450 apart) on 4.75-19 tyres.
// Open two-seater: narrow body, cutaway sides, slab tail, four cycle wings, twin aero screens, outside exhaust (left).
import { Build, section, wing, type Mesh, type V } from './mesh';

const PAINT = '#1f4a2c', PAINT2 = '#18281b', SEAM = '#143320', CHROME = '#b9babb', PIPE = '#a8a090', LEATHER = '#7a4426', LEATHER2 = '#905432', STRAP = '#8a4a26', GLASS = '#b9cfe0', RUBBER = '#25242a', DARK = '#1b1b1e', LENS = '#efe9cf', RED = '#c22c2b';
const FX = 370, RX = 2960, R = 364, WY = 635, TW = 125, L = 3382, FLOOR = 500;
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = (a: V): V => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** linear reading of a table of [x, value] */
const at = (tab: [number, number][], x: number) => { if (x <= tab[0]![0]) return tab[0]![1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i]![0]) { const [x0, v0] = tab[i - 1]!, [x1, v1] = tab[i]!; return v0 + (v1 - v0) * (x - x0) / (x1 - x0); } return tab[tab.length - 1]![1]; };
// the body along the car: half-width (plan), top and bottom (side view), how square its upper half is (front and rear views)
const HALF: [number, number][] = [[495, 214], [634, 279], [797, 349], [928, 364], [1187, 407], [1453, 427], [1675, 458], [1880, 460], [2000, 468], [2300, 455], [2582, 434], [2746, 426], [2942, 395], [3104, 346], [3234, 280], [3306, 202], [3336, 110]];
const TOP: [number, number][] = [[495, 918], [537, 924], [646, 959], [764, 983], [890, 990], [1646, 1026], [1701, 1035], [1880, 1032], [2560, 992], [2810, 956], [2977, 909], [3057, 880], [3155, 826], [3230, 767], [3293, 704], [3336, 620]];
const BOT: [number, number][] = [[495, 520], [830, 455], [1650, 450], [1900, 417], [3040, 412], [3290, 420], [3336, 470]];
const SQ: [number, number][] = [[495, 3.2], [890, 4.2], [1675, 4.8], [2560, 4.2], [2900, 3.4], [3336, 3]];
const BELT: [number, number][] = [[1880, 935], [1966, 795], [2014, 757], [2177, 749], [2428, 699], [2474, 773], [2503, 842], [2535, 868], [2560, 872]];   // the cutaway: the cockpit sides' top edge
const ring = (x: number, grow = 0, k = 20) => section(x, at(HALF, x) + grow, at(BOT, x) - grow, at(TOP, x) + grow, at(SQ, x), 6, k);
/** the skin's height at y across the body at x (upper half), and its half-width at height z */
const skinZ = (x: number, y: number) => { const w = at(HALF, x), zb = at(BOT, x), zt = at(TOP, x), n = at(SQ, x), u = Math.min(1, Math.abs(y) / w); return (zb + zt) / 2 + (zt - zb) / 2 * (1 - u ** n) ** (1 / n); };
const skinY = (x: number, z: number) => { const w = at(HALF, x), zb = at(BOT, x), zt = at(TOP, x), zc = (zb + zt) / 2, n = z >= zc ? at(SQ, x) : 6, u = Math.min(1, Math.abs(z - zc) / ((zt - zb) / 2)); return w * (1 - u ** n) ** (1 / n); };
/** a round pipe through points; one radius or one a point */
function tube(b: Build, pts: V[], r: number | number[], seg = 8, caps = true) { const n = pts.length;
  b.loft(pts.map((p, i) => { const d = norm(sub(pts[Math.min(n - 1, i + 1)]!, pts[Math.max(0, i - 1)]!)), u = norm(cross(d, Math.abs(d[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1])), v = cross(d, u), rr = typeof r === 'number' ? r : r[i]!;
    return Array.from({ length: seg }, (_, k) => { const t = k / seg * Math.PI * 2, c = Math.cos(t) * rr, s = Math.sin(t) * rr; return [p[0] + u[0] * c + v[0] * s, p[1] + u[1] * c + v[1] * s, p[2] + u[2] * c + v[2] * s] as V; }); }), caps); }
/** a profile turned about the upright axis through o: [height above o, radius] pairs */
function turn(b: Build, o: V, prof: [number, number][], seg = 10, caps = true) { b.loft(prof.map(([a, r]) => Array.from({ length: seg }, (_, i) => { const t = i / seg * Math.PI * 2; return [o[0] + Math.cos(t) * r, o[1] + Math.sin(t) * r, o[2] + a] as V; })), caps); }
/** a flat face filling a ring */
function fan(b: Build, R: V[]) { const m: V = [0, 0, 0]; for (const p of R) { m[0] += p[0] / R.length; m[1] += p[1] / R.length; m[2] += p[2] / R.length; } for (let i = 0; i < R.length; i++) b.tri(m, R[i]!, R[(i + 1) % R.length]!); }

function wheel(b: Build, x: number, s: 1 | -1, spin = 0) { const o: V = [x, s * WY, R], rim = 262, f = s * (TW / 2);
  b.mat(RUBBER, 0.05).lathe('y', o, [[-TW / 2, rim], [-TW / 2, R - 40], [-TW / 2 + 32, R], [TW / 2 - 32, R], [TW / 2, R - 40], [TW / 2, rim]], 20, false);
  b.mat(DARK, 0.05).lathe('y', o, [[f * 0.3, 0], [f * 0.3, rim]], 20, false).lathe('y', o, [[-f * 0.6, 150], [-f * 1.5, 150], [-f * 1.5, 0]], 12, false);   // the dark behind the spokes; the brake drum inboard
  b.mat(CHROME, 0.9).lathe('y', o, [[f, rim + 5], [f * 0.6, rim - 26]], 20, false).lathe('y', o, [[f * 0.5, 46], [f * 1.5, 30], [f * 1.5, 0]], 8, false);
  { const a = spin + 0.4, c = Math.cos(a) * 60, q = Math.sin(a) * 60; b.bar([x - c, s * WY + f * 1.45, R - q], [x + c, s * WY + f * 1.45, R + q], 16); }   // the knock-off nut's ears
  b.mat('#a9abae', 0.6); for (let k = 0; k < 16; k++) { const a = spin + k / 16 * Math.PI * 2, a2 = a + (k % 2 ? 0.5 : -0.5), yh = s * WY + f * (k % 2 ? 1.25 : 0.6); b.bar([x + Math.cos(a2) * 40, yh, R + Math.sin(a2) * 40], [x + Math.cos(a) * (rim - 22), s * WY + f * 0.7, R + Math.sin(a) * (rim - 22)], 10); } }

export function mesh(spin = 0): Mesh { const b = new Build();
  // ---- the body: bonnet and scuttle, the tub cut down to the floor, the slab tail ----
  b.mat(PAINT, 0.45);
  const xs = [495, 537, 646, 764, 890, 1100, 1300, 1500, 1675, 1790, 1876, 1880, 2200, 2556, 2560, 2680, 2810, 2977, 3057, 3155, 3230, 3293, 3336];
  b.loft(xs.map(x => { const pit = x >= 1880 && x <= 2556; return section(x, at(HALF, x), at(BOT, x), pit ? FLOOR : at(TOP, x), pit ? 8 : at(SQ, x), 6); }));
  // the cockpit's sides: from the scuttle down through the cutaway and up to the tail
  for (const s of [1, -1]) b.loft([1882, 1966, 2014, 2177, 2300, 2428, 2474, 2503, 2535, 2558].map(x => { const w = at(HALF, x), zt = at(BELT, x); return [[x, s * (w - 50), FLOOR], [x, s * (w - 2), FLOOR], [x, s * (w - 2), zt - 14], [x, s * (w - 20), zt], [x, s * (w - 50), zt - 6]] as V[]; }));
  b.mat(CHROME, 0.9); for (const s of [1, -1]) { const p = (x: number): V => [x, s * (at(HALF, x) - 8), at(BELT, x) + 2]; const X = [1900, 1966, 2014, 2177, 2428, 2474, 2503]; for (let i = 0; i + 1 < X.length; i++) b.bar(p(X[i]!), p(X[i + 1]!), 12); }   // the bright bead on the cutaway's edge
  b.mat(DARK, 0.05).box(1884, 2556, -405, 405, FLOOR - 10, FLOOR + 4);                                // the floor of the hollow
  b.mat('#2c2a2b', 0.1); fan(b, section(1886, at(HALF, 1886) - 14, FLOOR, at(TOP, 1886) - 14, at(SQ, 1886), 8));   // the dash: the scuttle's back face
  b.mat('#d8d2bf', 0.4); for (const y of [-250, -110, 110, 250]) b.lathe('x', [0, y, 900], [[1887, 0], [1891, 40]], 8, false);   // its dials
  b.mat('#232224', 0.05); fan(b, section(2554, at(HALF, 2554) - 14, FLOOR, at(TOP, 2554) - 14, at(SQ, 2554), 8));  // the dark behind the seats
  // two bucket seats: cushion and rounded back each
  for (const s of [1, -1]) { b.mat(LEATHER, 0.25).box(2100, 2450, Math.min(s * 30, s * 385), Math.max(s * 30, s * 385), FLOOR, 640);
    b.mat(LEATHER2, 0.25).loft(([[2430, 640, 880], [2475, 600, 950], [2520, 600, 990], [2550, 700, 975]] as const).map(([x, zb, zt]) => section(x, 185, zb, zt, 3, 6, 12).map(([px, py, pz]) => [px, py + s * 208, pz] as V)));
    b.mat('#5a3018', 0.1); for (const y of [90, 150, 210, 270, 330]) b.bar([2110, s * y, 642], [2425, s * y, 642], 8); }
  // bonnet: the centre hinge, side louvres, top louvres, two leather straps with buckles, the tail's panel seams
  b.mat(CHROME, 0.9).bar([560, 0, at(TOP, 560) + 3], [1670, 0, at(TOP, 1670) + 3], 12, 8);
  b.mat('#10271a', 0.1); for (const s of [1, -1]) { for (let k = 0; k < 12; k++) { const x = 850 + k * 32, y = (z: number) => s * (skinY(x + 7, z) + 3); b.quad([x, y(555), 555], [x + 13, y(555), 555], [x + 13, y(775), 775], [x, y(775), 775]); }
    for (let k = 0; k < 11; k++) { const x = 890 + k * 66, z = (y: number) => skinZ(x + 12, y) + 4; b.quad([x, s * 95, z(95)], [x + 24, s * 95, z(95)], [x + 24, s * 210, z(210)], [x, s * 210, z(210)]); } }
  b.mat(STRAP, 0.2); for (const x of [796, 1268]) b.loft([ring(x, 7), ring(x + 44, 7)], false);
  b.mat(CHROME, 0.9); for (const x of [796, 1268]) for (const s of [1, -1]) { const y = skinY(x + 22, 865) + 8; b.box(x - 12, x + 56, Math.min(s * y, s * (y + 10)), Math.max(s * y, s * (y + 10)), 840, 892); }
  b.mat(SEAM, 0.3); for (const x of [1672, 2668, 3083]) b.loft([ring(x, 3), ring(x + 9, 3)], false);
  b.mat(CHROME, 0.9); turn(b, [2921, 6, at(TOP, 2921) - 8], [[0, 74], [22, 74], [36, 56], [48, 0]], 12, false);     // the fuel filler on the tail
  // ---- the nose: the bright shell, the dark core behind its stone guard, badge and cap ----
  b.mat(CHROME, 0.9).loft([section(500, 205, 300, 946, 3.2, 6), section(336, 205, 300, 946, 3.2, 6), section(336, 172, 350, 908, 3.2, 6), section(360, 172, 350, 908, 3.2, 6)], false);
  b.mat(DARK, 0.05); fan(b, section(352, 173, 349, 909, 3.2, 6));
  b.mat('#5c5c58', 0.3); { const gy = (z: number) => { const u = Math.abs(z - 629) / 279, n = z > 629 ? 3.2 : 6; return 170 * (1 - Math.min(1, u) ** n) ** (1 / n); }, gz = (y: number) => 629 + 279 * (1 - (Math.abs(y) / 172) ** 3.2) ** (1 / 3.2);
    for (let k = -3; k <= 3; k++) b.quad([344, k * 46 - 4, 352], [344, k * 46 + 4, 352], [344, k * 46 + 4, gz(k * 46)], [344, k * 46 - 4, gz(k * 46)]);
    for (let k = 0; k < 9; k++) { const z = 400 + k * 58; b.quad([343, -gy(z), z - 4], [343, gy(z), z - 4], [343, gy(z), z + 4], [343, -gy(z), z + 4]); } }
  b.mat('#8a3030', 0.5).box(328, 336, -42, 42, 886, 938);
  b.mat(CHROME, 0.9); turn(b, [500, 0, 936], [[0, 30], [22, 30], [36, 18], [58, 34], [84, 28], [96, 0]], 10, false);
  // ---- twin aero screens: a raked bright frame each, its glass inside, on two short stanchions ----
  for (const s of [1, -1]) { const P = (y: number, v: number): V => [1800 + 80 * v, s * y, 1052 + 186 * v], pts = [P(92, 0), P(392, 0), P(392, 0.68), P(352, 1), P(132, 1), P(92, 0.68)];
    b.mat(GLASS, 0.5).quad(pts[0]!, pts[1]!, pts[2]!, pts[5]!).quad(pts[5]!, pts[2]!, pts[3]!, pts[4]!);
    b.mat(CHROME, 0.9); for (let i = 0; i < 6; i++) b.bar(pts[i]!, pts[(i + 1) % 6]!, 18);
    for (const y of [120, 364]) b.bar([1800, s * y, 1052], [1786, s * y, skinZ(1786, y) - 10], 20); }
  // ---- cycle wings on stays, a small marker on each ----
  for (const s of [1, -1] as const) { b.mat(PAINT, 0.45);
    wing(b, ([[87, 715, 580, 690], [136, 760, 562, 708], [203, 801, 552, 718], [290, 825, 550, 720], [376, 828, 550, 720], [468, 812, 550, 720], [546, 778, 550, 720], [683, 660, 550, 720], [736, 596, 552, 718], [779, 516, 558, 712], [835, 368, 572, 698], [843, 250, 590, 680]] as const).map(([x, z, yi, yo]) => [x, z, s * yi, s * yo] as [number, number, number, number]), [FX, R], 22, 28);
    wing(b, ([[2453, 503, 585, 685], [2475, 593, 565, 708], [2515, 675, 552, 718], [2573, 748, 550, 722], [2659, 805, 550, 722], [2759, 835, 550, 722], [2889, 845, 550, 722], [2998, 838, 550, 722], [3101, 810, 550, 722], [3192, 766, 552, 720], [3302, 686, 562, 710], [3334, 654, 572, 700], [3374, 568, 590, 682]] as const).map(([x, z, yi, yo]) => [x, z, s * yi, s * yo] as [number, number, number, number]), [RX, R], 22, 28);
    b.mat(PAINT2, 0.3).bar([700, s * 300, 460], [700, s * 562, 610], 22).bar([120, s * 300, 440], [150, s * 566, 720], 22).bar([2590, s * 420, 520], [2590, s * 562, 730], 22).bar([3270, s * 250, 440], [3270, s * 566, 680], 22);
    b.mat(CHROME, 0.9); turn(b, [376, s * 635, 836], [[0, 15], [22, 15], [32, 0]], 8, false); turn(b, [3255, s * 637, 728], [[0, 15], [22, 15], [32, 0]], 8, false);
    // head lamps on stands off the lamp bar; tail lamps on stalks beside the tail
    b.mat(CHROME, 0.9).lathe('x', [0, s * 322, 750], [[236, 116], [244, 126], [300, 121], [360, 94], [404, 28]], 14).box(310, 336, s * 322 - 14, s * 322 + 14, 470, 640);
    b.mat(LENS, 0.6).lathe('x', [0, s * 322, 750], [[222, 0], [228, 70], [237, 113]], 14, false);
    b.mat(DARK, 0.05).bar([3290, s * 431, 410], [3352, s * 431, 520], 20);
    b.mat(CHROME, 0.9).lathe('x', [0, s * 431, 560], [[3340, 30], [3356, 52], [3370, 52]], 10); b.mat(RED, 0.5).lathe('x', [0, s * 431, 560], [[3370, 42], [3380, 26], [3382, 0]], 10, false);
    b.mat(PAINT2, 0.3).bar([170, s * 290, 430], [840, s * 300, 430], 46, 70);                           // the frame's dumb irons
    wheel(b, FX, s, spin); wheel(b, RX, s, spin); }
  // ---- across: the lamp bar, front cross tube, axles, the dark under the car ----
  b.mat(CHROME, 0.9).box(312, 336, -340, 340, 462, 486);
  b.mat(DARK, 0.05).bar([185, -300, 430], [185, 300, 430], 40).bar([FX, -WY, R - 40], [FX, WY, R - 40], 50).bar([RX, -WY, R], [RX, WY, R], 60).bar([3290, -440, 410], [3290, 440, 410], 30).box(520, 3240, -370, 370, 300, 440);
  // ---- on the scuttle: the mirror on the right, the spot lamp on the left ----
  b.mat(CHROME, 0.9).bar([1760, -405, 1012], [1760, -500, 1012], 14).lathe('x', [0, -548, 1010], [[1748, 40], [1756, 64], [1768, 64]], 12);
  b.mat('#cfd6da', 0.6).lathe('x', [0, -548, 1010], [[1769, 0], [1769, 58]], 12, false);
  b.mat(CHROME, 0.9).lathe('x', [0, 490, 975], [[1712, 40], [1718, 47], [1745, 42], [1772, 14]], 10).bar([1745, 440, 950], [1745, 480, 965], 14);
  b.mat(LENS, 0.6).lathe('x', [0, 490, 975], [[1708, 0], [1712, 40]], 10, false);
  // ---- the outside exhaust on the left: out under the bonnet, along the body to the silencer, down and back ----
  b.mat(PIPE, 0.6); tube(b, [[690, 318, 470], [863, 392, 456], [1123, 440, 446], [1395, 478, 436]], 30);
  tube(b, [[1385, 482, 430], [1400, 488, 420], [1690, 494, 410], [1702, 494, 408]], [34, 58, 58, 38], 10);
  b.mat('#968e80', 0.6); tube(b, [[1700, 494, 406], [1790, 490, 378], [1875, 486, 356], [2100, 480, 352]], 24);
  b.mat(CHROME, 0.9); tube(b, [[1936, 485, 354], [1954, 485, 354]], 31);
  b.mat(DARK, 0.05).bar([1450, 380, 440], [1450, 470, 440], 18).bar([1640, 380, 440], [1640, 470, 440], 18).bar([2060, 380, 400], [2060, 470, 370], 16);   // its hangers
  return b.mesh(L); }
