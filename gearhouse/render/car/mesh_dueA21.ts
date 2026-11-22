// The 1921 Duesenberg Model A coupe as a low-polygon mesh (docs/systems/70_mesh_car_rules.md). Lengths and heights are
// read off the sheet's side view (data/cars/sheet/dueA21.json, at the real wheelbase 3404), widths off its front and rear
// views brought to the real track 1422 (they draw it 1536: SW). The sheet draws the wheels 18 % large: the tyres here
// are the real 33x5 (radius 419), the body set 75 mm lower (DZ: roof at 1.91 m) and the wings drawn in round the real
// wheels (KW). Closed two-door body: upright two-pane screen, two windows a side, padded roof, no bumpers, no spare.
import { Build, section, wing, type Mesh, type V } from './mesh';

const PAINT = '#222226', PAINT2 = '#1e1e21', ROOF = '#2c2c30', FRAME = '#3a3a41', SEAM = '#3c3c43', STRIPE = '#c9b4b0', NICKEL = '#d6cab8', GLASS = '#9fb4c0', RUBBER = '#222127', WHITE = '#f6f3ec', DARK = '#151517', IRON = '#4a4b54', LENS = '#efe9cf', RED = '#c22c2b';
// the interior: tan leather, darker leather on the doors and sides, a dark cloth headliner, a walnut dash
const UPH = '#8b5e3a', CARD = '#5f4630', HEADL = '#34302c', FLOORC = '#1b1a19', DASHC = '#5a3d24';
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
/** a colour darkened: k of its brightness */
const dim = (c: string, k: number) => '#' + [1, 3, 5].map(i => Math.round(parseInt(c.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
/** an end of the cabin at x, set `d` inside the skin, round an opening [half-width, z0, z1]: the part below the opening (if `lower`), beside it and above it up to `top` */
function endFace(b: Build, x: number, d: number, [gy, g0, g1]: readonly [number, number, number], lower: boolean, top: number): void { const Y = (z: number) => cabY(x, z) - d;
  if (lower) { const zs = [...cabSide(x).map(p => p[1]).filter(z => z < g0), g0], P: V[] = [...zs.map(z => [x, Y(z), z] as V), ...zs.slice().reverse().map(z => [x, -Y(z), z] as V)], m: V = [x, 0, (zs[0]! + g0) / 2]; for (let i = 0; i < P.length; i++) b.tri(m, P[i]!, P[(i + 1) % P.length]!); }
  const zt = Math.min(top, 1850), w = Y(g0); for (const s of [1, -1]) b.quad([x, s * gy, g0], [x, s * w, g0], [x, s * w, g1], [x, s * gy, g1]);
  b.quad([x, -w, g1], [x, w, g1], [x, w, zt], [x, -w, zt]); if (top > 1850) b.quad([x, -w, 1850], [x, w, 1850], [x, Y(top), top], [x, -Y(top), top]); }
/** a point of the sheet's wing brought in round the real wheel */
const near = (hx: number, x: number, z: number): [number, number] => [hx + (x - hx) * KW, HUB + (z - HUB) * KW];

function wheel(b: Build, x: number, s: 1 | -1, spin = 0) { const o: V = [x, s * WY, R], rim = 304, f = s * (TW / 2);
  b.mat(RUBBER, 0.05, 'tyre').lathe('y', o, [[-f, rim], [-f, R - 45], [-f * 0.5, R], [f * 0.5, R], [f, R - 30]], 20, false);
  b.mat(WHITE, 0.15).lathe('y', o, [[f, R - 30], [f, rim + 2]], 20, false);              // the white wall
  b.mat(DARK, 0.05).lathe('y', o, [[f * 0.3, 0], [f * 0.3, rim]], 20, false).lathe('y', o, [[-f * 0.6, 170], [-f * 1.4, 170], [-f * 1.4, 0]], 12, false);
  b.mat('#2c2c31', 0.4, 'paint').lathe('y', o, [[f, rim + 4], [f * 0.6, rim - 24]], 20, false);
  b.mat(NICKEL, 0.9, 'metal').lathe('y', o, [[f * 0.5, 52], [f * 1.35, 40], [f * 1.45, 0]], 8, false);
  b.mat('#5d5e68', 0.4, 'metal'); for (let k = 0; k < 16; k++) { const a = spin + k / 16 * Math.PI * 2, a2 = a + (k % 2 ? 0.45 : -0.45), yh = s * WY + f * (k % 2 ? 1.15 : 0.55); b.bar([x + Math.cos(a2) * 42, yh, R + Math.sin(a2) * 42], [x + Math.cos(a) * (rim - 20), s * WY + f * 0.7, R + Math.sin(a) * (rim - 20)], 11); } }

export function mesh(spin = 0): Mesh { const b = new Low(); b.dz = DZ;
  // ---- bonnet and cowl; the cabin with its turn-under; the padded roof with its peak over the screen ----
  b.mat(PAINT, 0.45, 'paint').loft([669, 704, 1000, 1300, 1500, 1722, 1900, 2050].map(x => section(x, at(HALF, x), at(BOT, x), at(TOP, x), at(SQ, x), 6)));
  // the cabin's skin, hollow: the turned-under sides and the bottom without a lid, the flat upper sides round the windows, the ends round the screen and the rear window
  const WINS = [[2250, 2800, 1372, 1818], [2996, 3354, 1405, 1806]] as const, SCR = [440, 1418, 1844] as const, RWN = [308, 1470, 1776] as const;
  { const R = [2046, 2196, 2915, 3384, 3696].map(cabRing), K = R[0]!.length; for (let r = 0; r + 1 < R.length; r++) for (let i = 0; i < K; i++) if (i !== 4 && i !== 6 && i !== 8) b.quad(R[r]![i]!, R[r]![(i + 1) % K]!, R[r + 1]![(i + 1) % K]!, R[r + 1]![i]!);
    for (const s of [1, -1]) { const q = (x0: number, x1: number, z0: number, z1: number) => b.quad([x0, s * WU, z0], [x1, s * WU, z0], [x1, s * WU, z1], [x0, s * WU, z1]);
      q(2046, 2250, 1300, 1850); q(2800, 2996, 1300, 1850); q(3354, 3696, 1300, 1850); for (const [x0, x1, z0, z1] of WINS) { q(x0, x1, 1300, z0); q(x0, x1, z1, 1850); } }
    endFace(b, 2046, 0, SCR, true, 1886); endFace(b, 3696, 0, RWN, true, 1886); }
  // ---- the interior, seen through the glass: floor and toe board, the sides' and ends' inner faces, shelf, headliner, dash, the one seat ----
  { const T = 20, X0 = 2046 + T, X1 = 3696 - T, FL = 540, YU = WU - T, HL = 1855, xr = 3080, xb = xr - 80, c1 = xb - 90, c0 = c1 - 490, zc = 960, zt = zc + 560, LX = [X0, 2196, 2915, xb], LZ = [FL, 749, 1100, 1200, 1300], iy = (x: number, z: number) => cabY(x, z) - T;
    b.mat(FLOORC, 0.05); for (let i = 0; i + 1 < LX.length; i++) { const x0 = LX[i]!, x1 = LX[i + 1]!; b.quad([x0, -iy(x0, FL), FL], [x0, iy(x0, FL), FL], [x1, iy(x1, FL), FL], [x1, -iy(x1, FL), FL]); }
    { const P: V[] = [...LZ.map(z => [X0, iy(X0, z), z] as V), ...LZ.slice().reverse().map(z => [X0, -iy(X0, z), z] as V)]; for (let i = 0; i < P.length; i++) b.tri([X0, 0, 900], P[i]!, P[(i + 1) % P.length]!); }   // the toe board
    b.mat(CARD, 0.25, 'leather');
    for (const s of [1, -1]) { for (let i = 0; i + 1 < LX.length; i++) for (let j = 0; j + 1 < LZ.length; j++) { const x0 = LX[i]!, x1 = LX[i + 1]!, z0 = LZ[j]!, z1 = LZ[j + 1]!; b.quad([x0, s * iy(x0, z0), z0], [x1, s * iy(x1, z0), z0], [x1, s * iy(x1, z1), z1], [x0, s * iy(x0, z1), z1]); }
      const q = (x0: number, x1: number, z0: number, z1: number) => b.quad([x0, s * YU, z0], [x1, s * YU, z0], [x1, s * YU, z1], [x0, s * YU, z1]);
      q(X0, 2250, 1300, HL); q(2800, 2996, 1300, HL); q(3354, X1, 1300, HL); for (const [x0, x1, z0, z1] of WINS) { q(x0, x1, 1300, z0); q(x0, x1, z1, HL); } }
    endFace(b, X0, T, SCR, false, HL); endFace(b, X1, T, RWN, false, 1822);
    b.mat(dim(CARD, 0.62), 0.1, 'canvas').quad([xb - 10, -YU, 1330], [xb - 10, YU, 1330], [X1, YU, 1330], [X1, -YU, 1330]);                               // the parcel shelf behind the seat
    b.mat(HEADL, 0.05, 'canvas').quad([X0, -YU, HL], [X0, YU, HL], [3560, YU, HL], [3560, -YU, HL]).quad([3560, -YU, HL], [3560, YU, HL], [X1, YU, 1822], [X1, -YU, 1822]);
    // the openings' reveals from the skin in to the lining
    b.mat(FRAME, 0.3); for (const s of [1, -1]) for (const [x0, x1, z0, z1] of WINS) { const P = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]] as const; for (let i = 0; i < 4; i++) { const [xa, za] = P[i]!, [xc, zd] = P[(i + 1) % 4]!; b.quad([xa, s * WU, za], [xc, s * WU, zd], [xc, s * YU, zd], [xa, s * YU, za]); } }
    for (const [xo, xi, [gy, g0, g1]] of [[2046, X0, SCR], [3696, X1, RWN]] as const) { const P = [[-gy, g0], [gy, g0], [gy, g1], [-gy, g1]] as const; for (let i = 0; i < 4; i++) { const [ya, za] = P[i]!, [yc, zd] = P[(i + 1) % 4]!; b.quad([xo, ya, za], [xo, yc, zd], [xi, yc, zd], [xi, ya, za]); } }
    // the dash under the screen: its back face towards the seat, the instrument plate in its middle
    { const r = (x: number): V[] => [[x, -iy(x, 1215) + 2, 1215], [x, iy(x, 1215) - 2, 1215], [x, YU - 2, 1400], [x, -YU + 2, 1400]]; b.mat(DASHC, 0.3, 'wood').loft([r(X0), r(X0 + 120)]);
      b.mat(NICKEL, 0.9, 'metal').box(X0 + 120, X0 + 125, -170, 170, 1262, 1352); }
    // the seat: a dark base, the cushion, the raked back, their pleats
    { const w = iy(c0, zc - 150) - 12, w2 = YU - 22, r = (x0: number, x1: number, y: number, z: number): V[] => [[x0, -y, z], [x1, -y, z], [x1, y, z], [x0, y, z]];
      b.mat(FLOORC, 0.05).box(c0 + 40, c1, -w + 20, w - 20, FL, zc - 140);
      b.mat(UPH, 0.25, 'leather').loft([r(c0 + 12, c1 + 30, w, zc - 150), r(c0, c1 + 30, w + 6, zc - 60), r(c0 + 14, c1 + 30, w, zc + 8), [[c0 + 60, -w + 22, zc + 22], [c1 + 30, -w + 22, zc - 18], [c1 + 30, w - 22, zc - 18], [c0 + 60, w - 22, zc + 22]]]);
      b.mat(UPH, 0.25, 'leather').loft([r(c1, xb, w + 6, zc - 50), r(xr - 100, xr - 8, w2, zt - 90), r(xr - 88, xr, w2 - 6, zt - 25), r(xr - 66, xr - 8, w2 - 26, zt)]);
      b.mat(dim(UPH, 0.5), 0.05); const np = Math.round((w - 40) / 115); for (let k = -np; k <= np; k++) { const y = k * (w - 40) / np, e = 8;
        b.quad([c1 - 4, y - e, zc - 20], [c1 - 4, y + e, zc - 20], [xr - 104, y * 1.1 + e, zt - 90], [xr - 104, y * 1.1 - e, zt - 90]);
        if (Math.abs(k) < np) b.quad([c0 + 60, y - e, zc + 26], [c0 + 60, y + e, zc + 26], [c1, y + e, zc - 11], [c1, y - e, zc - 11]); } } }
  b.mat(ROOF, 0.1, 'canvas').loft(([[2012, 570, 1866, 1922], [2030, 612, 1864, 1946], [2067, 634, 1862, 1971], [2246, 637, 1862, 1986], [3444, 637, 1862, 1981], [3594, 634, 1856, 1946], [3674, 616, 1830, 1900], [3701, 585, 1790, 1850]] as const).map(([x, w, zb, zt]) => section(x, w, zb, zt, 5, 6, 16)));
  // the screen on the cabin's front: two panes inside a frame and a centre bar
  { const X = 2040; b.mat(GLASS, 0.5, 'glass'); for (const s of [1, -1]) b.quad([X, s * 14, 1430], [X, s * 430, 1430], [X, s * 430, 1832], [X, s * 14, 1832]);
    b.mat(FRAME, 0.3).bar([X, -450, 1418], [X, 450, 1418], 26).bar([X, -450, 1844], [X, 450, 1844], 26).bar([X, 0, 1418], [X, 0, 1844], 30); for (const s of [1, -1]) b.bar([X, s * 440, 1406], [X, s * 440, 1856], 26); }
  // side windows: two a side, glass inside a frame standing just off the skin
  for (const s of [1, -1]) { const Y = s * (WU + 4);
    for (const [x0, x1, z0, z1] of [[2250, 2800, 1372, 1818], [2996, 3354, 1405, 1806]] as const) { b.mat(GLASS, 0.5, 'glass').quad([x0, Y, z0], [x1, Y, z0], [x1, Y, z1], [x0, Y, z1]);
      b.mat(FRAME, 0.3).bar([x0 - 12, Y, z0], [x1 + 12, Y, z0], 24).bar([x0 - 12, Y, z1], [x1 + 12, Y, z1], 24).bar([x0, Y, z0], [x0, Y, z1], 24).bar([x1, Y, z0], [x1, Y, z1], 24); }
    // the door: shut lines, three hinges, the handle; the belt's pinstripe from the bonnet to the back
    b.mat(SEAM, 0.2); for (const x of [2196, 2915]) { const Z = [520, 760, 1100, 1200, 1300, 1345]; for (let i = 0; i + 1 < Z.length; i++) b.bar([x, s * (cabY(x, Z[i]!) + 2), Z[i]!], [x, s * (cabY(x, Z[i + 1]!) + 2), Z[i + 1]!], 10); if (x === 2915) b.bar([x, s * (WU + 2), 1345], [x, s * (WU + 2), 1860], 10); }
    b.mat(NICKEL, 0.9, 'metal'); for (const z of [1776, 1335, 793]) b.box(2180, 2212, Math.min(s * (cabY(2196, z) + 2), s * (cabY(2196, z) + 12)), Math.max(s * (cabY(2196, z) + 2), s * (cabY(2196, z) + 12)), z - 32, z + 32);
    b.bar([2770, s * (cabY(2800, 1208) + 16), 1208], [2890, s * (cabY(2800, 1208) + 16), 1208], 16).bar([2880, s * cabY(2800, 1208), 1208], [2880, s * (cabY(2800, 1208) + 16), 1208], 14);
    b.mat(STRIPE, 0.3); { const P: V[] = ([[676, 1223], [1200, 1223], [1722, 1223], [1847, 1233], [1972, 1255], [2044, 1272]] as const).map(([x, z]) => [x, s * (skinY(x, z) + 3), z] as V); P.push(...([[2052, 1274], [2196, 1267], [2895, 1270], [3494, 1280], [3694, 1305]] as const).map(([x, z]) => [x, s * (cabY(x, z) + 3), z] as V));
      for (let i = 0; i + 1 < P.length; i++) if (i !== 5) b.bar(P[i]!, P[i + 1]!, 9); b.bar([3699, s * WU, 1305], [3699, s * 372, 1325], 9).bar([3699, s * 372, 1325], [3699, 0, 1333], 9); }
    // bonnet louvres
    b.mat(SEAM, 0.2); for (let k = 0; k < 16; k++) { const x = 910 + k * 44, y = (z: number) => s * (skinY(x + 8, z) + 3); b.quad([x, y(800), 800], [x + 16, y(800), 800], [x + 16, y(1075), 1075], [x, y(1075), 1075]); } }
  // the rear window: two panes in a frame
  { const X = 3701; b.mat(GLASS, 0.5, 'glass'); for (const s of [1, -1]) b.quad([X, s * 14, 1482], [X, s * 300, 1482], [X, s * 300, 1764], [X, s * 14, 1764]);
    b.mat(FRAME, 0.3).bar([X, -318, 1470], [X, 318, 1470], 24).bar([X, -318, 1776], [X, 318, 1776], 24).bar([X, 0, 1470], [X, 0, 1776], 26); for (const s of [1, -1]) b.bar([X, s * 308, 1460], [X, s * 308, 1786], 24); }
  b.mat(NICKEL, 0.9, 'metal').bar([690, 0, 1436], [2040, 0, 1440], 12, 8);                                       // the bonnet's centre hinge
  // ---- the nose: the nickel shell, dark core with its slats, badge, the cap with its mascot ----
  b.mat(NICKEL, 0.9, 'metal').loft([section(672, 272, 590, 1392, 3, 6), section(444, 272, 590, 1392, 3, 6), section(444, 230, 615, 1262, 3.4, 6), section(470, 230, 615, 1262, 3.4, 6)], false);
  b.mat('#39332b', 0.05).loft([section(462, 231, 614, 1263, 3.4, 6)]);
  b.mat('#6a6258', 0.3, 'metal'); for (let k = -4; k <= 4; k++) { const zt = 938 + 324 * (1 - (Math.abs(k * 46) / 230) ** 3.4) ** (1 / 3.4) - 6; b.quad([455, k * 46 - 4, 620], [455, k * 46 + 4, 620], [455, k * 46 + 4, zt], [455, k * 46 - 4, zt]); }
  b.mat('#b8322c', 0.5).lathe('x', [0, 0, 1318], [[436, 0], [440, 28]], 10, false);
  b.mat(NICKEL, 0.9, 'metal').loft([[0, 44], [34, 40], [58, 22], [84, 30], [118, 26], [124, 0]].map(([a, r]) => Array.from({ length: 10 }, (_, i) => { const t = i / 10 * Math.PI * 2; return [600 + Math.cos(t) * r!, Math.sin(t) * r!, 1386 + a!] as V; })), false).bar([600, -70, 1480], [600, 70, 1480], 14, 26);
  // ---- wings, running boards, lamps, wheels ----
  for (const s of [1, -1] as const) { b.mat(PAINT2, 0.45, 'paint');
    const yo: [number, number][] = [[15, 560], [40, 657], [90, 789], [265, 850], [640, 838], [1140, 765], [1516, 704], [1722, 700]], yi: [number, number][] = [[40, 420], [203, 430], [515, 452], [1140, 474], [1566, 505], [1722, 505]];
    wing(b, ([[55, 768], [75, 873], [125, 948], [200, 1008], [299, 1053], [449, 1083], [649, 1093], [774, 1078], [874, 1035], [973, 973], [1073, 873], [1173, 748], [1273, 636], [1373, 549], [1497, 499], [1722, 492]] as const).map(([x, z]) => { const [nx, nz] = near(FX, x, z); return [nx, nz, s * at(yi, x), s * at(yo, x)] as [number, number, number, number]; }), [FX, HUB], 45, 40);
    // the rear wing: deep, skirted outside the wheel, its crown against the body
    { const top: [number, number][] = [[3369, 499], [3399, 649], [3432, 786], [3474, 898], [3532, 986], [3594, 1048], [3606, 1248], [3696, 1272], [3993, 1252], [4243, 1173], [4418, 1048], [4517, 923], [4592, 748], [4642, 649], [4705, 594], [4737, 574]], ro: [number, number][] = [[3441, 700], [3491, 760], [3617, 840], [3867, 850], [4492, 845], [4667, 790], [4742, 660]], ri: [number, number][] = [[3441, 560], [3696, 560], [3929, 505], [4617, 455], [4727, 557]], A = R + 75;
      const rings = [3369, 3399, 3432, 3474, 3532, 3594, 3606, 3696, 3850, 3993, 4120, 4243, 4340, 4418, 4517, 4592, 4642, 4705, 4737].map(x => { const [nx, zt] = near(RX, x, at(top, x)), o = at(ro, x), i = at(ri, x), wd = o - i, ar = Math.abs(nx - RX) < A ? HUB + Math.sqrt(A * A - (nx - RX) ** 2) : 0, sk = Math.min(Math.max(nx < RX ? 494 : 512, ar), zt - 24), dep = zt - sk;
        return [[nx, s * i, zt - 12], [nx, s * (i + 0.45 * wd), zt], [nx, s * (o - 0.12 * wd), zt - 0.08 * dep - 8], [nx, s * o, zt - 0.3 * dep - 14], [nx, s * o, sk], [nx, s * i, sk]] as V[]; });
      b.loft(rings); b.mat(DARK, 0.05); for (let k = 0; k + 1 < rings.length; k++) { const P = rings[k]!, Q = rings[k + 1]!, d = (p: V): V => [p[0], p[1] - s * 6, p[2] - 4]; b.quad(d(P[4]!), P[5]!, Q[5]!, d(Q[4]!)); } }
    const bx0 = near(FX, 1722, 492)[0], bx1 = near(RX, 3369, 499)[0] + 10;
    b.mat(PAINT2, 0.3, 'paint').box(bx0, bx1, Math.min(s * 490, s * 700), Math.max(s * 490, s * 700), 424, 494);
    b.mat(NICKEL, 0.9, 'metal').box(bx0, bx1, Math.min(s * 690, s * 706), Math.max(s * 690, s * 706), 468, 497);
    b.mat(DARK, 0.05).box(RX - 430, RX + 300, Math.min(s * 380, s * 566), Math.max(s * 380, s * 566), 420, 1000);   // the rear wheel house
    // head lamps: nickel drums on posts; tail lamps on the rear wings
    b.mat(NICKEL, 0.9, 'metal').lathe('x', [0, s * 380, 1183], [[247, 120], [300, 123], [380, 108], [430, 78], [459, 28]], 14);
    b.mat('#e8e0d2', 0.9, 'metal').lathe('x', [0, s * 380, 1183], [[207, 116], [213, 129], [247, 129]], 14, false);
    b.mat(LENS, 0.6, 'lens').lathe('x', [0, s * 380, 1183], [[190, 0], [196, 70], [209, 117]], 14, false);
    b.mat('#2a2a30', 0.2).bar([330, s * 384, 1070], [330, s * 395, 560], 30);
    { const [tx, tz] = near(RX, 4560, 800); b.mat(NICKEL, 0.9, 'metal').lathe('x', [0, s * 705, tz], [[tx - 40, 34], [tx - 12, 56], [tx + 14, 56]], 10); b.mat(RED, 0.5).lathe('x', [0, s * 705, tz], [[tx + 14, 46], [tx + 24, 28], [tx + 26, 0]], 10, false); }
    b.mat(IRON, 0.3).bar([90, s * 400, 520], [460, s * 400, 560], 44, 70).bar([4150, s * 400, 560], [4330, s * 400, 520], 44, 70);   // the frame's horns front and rear
    b.mat('#34343b', 0.2).bar([110, s * 366, 440], [520, s * 366, 400], 60, 40); }                      // front springs
  // ---- between the wings: the tray under the bonnet, the front cross tube, the tank at the back, axles, the dark under the car ----
  b.mat(DARK, 0.05).box(440, 1560, -445, 445, 480, 600).box(700, 4100, -470, 470, 400, 500).box(3700, 4160, -500, 500, 420, 700);
  b.mat('#383840', 0.3).lathe('y', [70, 0, 532], [[-375, 34], [375, 34]], 8).box(4170, 4290, -430, 430, 470, 600);
  b.mat('#3a3c44', 0.4).lathe('y', [4240, 0, 628], [[-425, 40], [425, 40]], 8);
  b.mat(NICKEL, 0.9, 'metal').lathe('x', [0, 0, 532], [[20, 0], [24, 16], [40, 16]], 8, false);                  // the starting handle's boss
  b.dz = 0;
  b.mat(DARK, 0.05).bar([FX, -WY, R - 60], [FX, WY, R - 60], 60).bar([RX, -WY, R], [RX, WY, R], 80).lathe('y', [RX, 0, R], [[-110, 60], [-60, 130], [60, 130], [110, 60]], 10);
  for (const s of [1, -1] as const) { wheel(b, FX, s, spin); wheel(b, RX, s, spin); }
  return b.mesh(L); }
