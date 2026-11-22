// The 1935 Auburn 851 Supercharged Speedster as a low-polygon mesh: cream boat-tail two-seater, pointed V grille, teardrop
// wings, four flexible exhausts out of the bonnet's right side. Heights and stations are read off the reference sheet's
// side view (in its pixels: X() and Z() turn them into mm) at the real wheelbase (127 in, 3226 mm); the sheet's overhangs
// are drawn long and its plan narrow, so the overhangs are closed up to the real length (about 4.95 m) and the widths
// are set to the real car (1.8 m over the wings, 1.47 m track).
import { Build, section, type Mesh, type V } from './mesh';

const PAINT = '#e6d5ac', CHROME = '#c9cbcf', LEATHER = '#7a4024', SEAM = '#56290f', GLASS = '#a9c2cc', RUBBER = '#26242b', WHITE = '#ece6d6', DARK = '#1c1b20', RED = '#c22c2b', LINE = '#8f8262';
const FX = 830, WB = 3226, RX = FX + WB, R = 365, WY = 735, TW = 165, L = 5014;
/** the sheet's side view, pixels to mm: along the car (the overhangs closed up) and up from the ground */
const X = (px: number) => px < 425 ? FX + (px - 425) * 2.554 : px < 1525 ? FX + (px - 425) * 2.933 : RX + (px - 1525) * 2.554;
const Z = (py: number) => (570 - py) * 2.933;
const tab = (t: [number, number][], fx: (v: number) => number, fv: (v: number) => number) => t.map(([x, v]) => [fx(x), fv(v)] as [number, number]);
const at = (t: [number, number][], x: number) => { if (x <= t[0]![0]) return t[0]![1]; for (let i = 1; i < t.length; i++) if (x <= t[i]![0]) { const [x0, v0] = t[i - 1]!, [x1, v1] = t[i]!; return v0 + (v1 - v0) * (x - x0) / (x1 - x0); } return t[t.length - 1]![1]; };
const same = (v: number) => v;
// the body along the car: half-width (mm), top of the bonnet and scuttle, the doors' tops, the tail's deck, the underside
const HALF = tab([[262, 205], [275, 250], [300, 290], [425, 345], [600, 400], [800, 500], [955, 610], [1050, 665], [1200, 680], [1340, 650], [1476, 430], [1560, 345], [1670, 235], [1768, 125], [1830, 55], [1865, 14]], X, same);
const TOP = tab([[262, 196], [275, 178], [300, 166], [420, 158], [900, 153], [955, 158], [1000, 172]], X, Z);
const BELT = tab([[1000, 172], [1040, 200], [1100, 213], [1235, 207], [1330, 198]], X, Z);
const DECK = tab([[1330, 197], [1400, 211], [1500, 238], [1650, 296], [1800, 368], [1865, 398]], X, Z);
const BOT = tab([[262, 478], [330, 400], [520, 381], [1400, 381], [1560, 400], [1700, 440], [1865, 482]], X, same);
const C0 = X(1000), C1 = X(1330), FLOOR = 470;
const zTop = (x: number) => x < C0 ? at(TOP, x) : x > C1 ? at(DECK, x) : at(BELT, x);
const nTop = (x: number) => x < X(900) ? 2.8 : x <= C1 ? 3.1 : Math.max(2.2, 3.1 - (x - C1) / 1500);
/** the skin's height at (x, y) and its half-width at height z (the body's sections are superellipses) */
const skin = (x: number, y: number) => { const w = at(HALF, x), zb = at(BOT, x), h = (zTop(x) - zb) / 2, n = nTop(x); return zb + h + h * Math.max(0, 1 - Math.abs(y / w) ** n) ** (1 / n); };
const sideY = (x: number, z: number) => { const w = at(HALF, x), zb = at(BOT, x), h = (zTop(x) - zb) / 2, d = z - zb - h, n = d > 0 ? nTop(x) : 6; return w * Math.max(0, 1 - Math.abs(d / h) ** n) ** (1 / n); };
// the nose: the grille leans back and comes to a prow; the first stations of the body are sheared to it
const XN0 = X(262), XN1 = X(345), VEE = 130;
const nose = (p: V): V => { const t = Math.max(0, Math.min(1, (XN1 - p[0]) / (XN1 - XN0))); return [p[0] - t * 0.26 * (1100 - p[2]) - t * t * VEE * Math.max(0, 1 - Math.abs(p[1]) / 205), p[1], p[2]]; };

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = (a: V): V => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** a round tube along a line of points (pipes, bumper blades, the cockpit's roll); `r` one radius or one per point */
function tube(b: Build, pts: V[], r: number | number[], seg = 8, ref: V = [0, 0, 1]): void {
  b.loft(pts.map((p, i) => { const d = norm(sub(pts[Math.min(pts.length - 1, i + 1)]!, pts[Math.max(0, i - 1)]!)), u = norm(cross(d, ref)), v = cross(d, u), rr = typeof r === 'number' ? r : r[i]!;
    return Array.from({ length: seg }, (_, k) => { const a = k / seg * Math.PI * 2, c = Math.cos(a) * rr, s = Math.sin(a) * rr; return [p[0] + u[0] * c + v[0] * s, p[1] + u[1] * c + v[1] * s, p[2] + u[2] * c + v[2] * s] as V; }); })); }
/** a teardrop wing: a crowned strip swept along [x, zTop, yIn, yOut, skirt] points, its outer edge carried down as a valance */
function fender(b: Build, path: [number, number, number, number, number][], hub: [number, number], crown = 90): void {
  b.loft(path.map((p, i) => { const a = path[Math.max(0, i - 1)]!, c = path[Math.min(path.length - 1, i + 1)]!, tx = c[0] - a[0], tz = c[1] - a[1], l = Math.hypot(tx, tz) || 1; let nx = -tz / l, nz = tx / l; if (nx * (p[0] - hub[0]) + nz * (p[1] - hub[1]) < 0) { nx = -nx; nz = -nz; }
    const [x, z, yi, yo, sk] = p, pt = (y: number, k: number): V => [x + nx * k, y, z + nz * k], ring: V[] = [pt(yi, -45)];
    for (let k = 0; k <= 6; k++) { const u = k / 6; ring.push(pt(yi + (yo - yi) * u, crown * Math.sin(Math.PI * (0.08 + 0.84 * u)) - crown * 0.35 * u * u)); }
    const e = ring[ring.length - 1]!; ring.push([e[0], yo + Math.sign(yo) * 6, e[2] - sk * 0.5], [e[0] - nx * 10, yo, e[2] - sk], [e[0] - nx * 30, yo - Math.sign(yo) * 40, e[2] - sk]); return ring; })); }

/** a wire spoke: a three-sided rod without ends */
function wire(b: Build, p: V, q: V, t: number): void { const d = norm(sub(q, p)), u = norm(cross(d, [0, 1, 0])), v = cross(d, u), ring = (o: V): V[] => [0, 1, 2].map(k => { const a = k / 3 * Math.PI * 2, c = Math.cos(a) * t / 2, s = Math.sin(a) * t / 2; return [o[0] + u[0] * c + v[0] * s, o[1] + u[1] * c + v[1] * s, o[2] + u[2] * c + v[2] * s] as V; }); b.loft([ring(p), ring(q)], false); }
function wheel(b: Build, x: number, s: 1 | -1, spin = 0) { const o: V = [x, s * WY, R], rim = 232, f = s * (TW / 2), nm = x === FX ? 'tyreF' : 'tyreR';
  b.name(nm).mat(RUBBER, 0.05, 'tyre').lathe('y', o, [[-TW / 2, rim], [-TW / 2, R - 48], [-TW / 2 + 36, R], [TW / 2 - 36, R], [TW / 2, R - 48], [TW / 2, rim]], 20, false);
  b.name(nm).mat(WHITE, 0.1, 'tyre').lathe('y', o, [[f * 1.03, rim + 4], [f * 1.08, rim + 50], [f * 1.04, R - 34]], 20, false);   // the whitewall
  b.name('wheel').mat(DARK, 0.05).lathe('y', o, [[f * 0.5, 0], [f * 0.5, rim]], 20, false);
  b.name('rim').mat(CHROME, 0.9, 'metal').lathe('y', o, [[f * 1.04, rim + 6], [f * 0.7, rim - 32]], 20, false).lathe('y', o, [[f * 0.6, 60], [f * 1.2, 40], [f * 1.2, 0]], 10, false);
  b.name('spoke').mat('#c3c5c9', 0.6, 'metal'); for (let row = 0; row < 2; row++) for (let k = 0; k < 24; k++) { const a = spin + (k + row * 0.5) / 24 * Math.PI * 2, lean = (k % 2 ? 1 : -1) * 0.42, b0 = a + lean, rr = rim - 24;
    const yin = s * WY + f * (row ? 0.98 : 0.45), yout = s * WY + f * (row ? 0.7 : 0.62); wire(b, [x + Math.cos(a) * 62, yin, R + Math.sin(a) * 62], [x + Math.cos(b0) * rr, yout, R + Math.sin(b0) * rr], 8); }
  b.name('hub').mat(CHROME, 0.9, 'metal').lathe('y', o, [[f * 0.95, 92], [f * 1.2, 86], [f * 1.38, 62], [f * 1.5, 30], [f * 1.54, 0]], 14, false);   // the big domed cap
  for (const e of [0, Math.PI]) { const a = spin + e; b.bar([x + Math.cos(a) * 20, s * WY + f * 1.52, R + Math.sin(a) * 20], [x + Math.cos(a) * 70, s * WY + f * 1.42, R + Math.sin(a) * 70], 16, 10); } }

export function auburn851Mesh(spin = 0): Mesh { const b = new Build();
  // ---- the body: nose, bonnet, scuttle, the tub cut down for the cockpit, the boat tail to its point ----
  b.name('body').mat(PAINT, 0.45, 'paint');
  const xs = [262, 275, 300, 345, 425, 520, 620, 760, 900, 955].map(X).concat([C0 - 5, C0, C1, C1 + 5], [1400, 1476, 1560, 1670, 1768, 1830, 1865].map(X));
  b.loft(xs.map(x => { const pit = x >= C0 && x <= C1; return section(x, at(HALF, x), at(BOT, x), pit ? FLOOR : zTop(x), pit ? 8 : nTop(x), 6).map(nose); }));
  for (const s of [1, -1]) b.loft([C0 + 2, X(1040), X(1100), X(1170), X(1235), C1 - 2].map(x => { const w = at(HALF, x), zt = at(BELT, x); return [[x, s * (w - 60), FLOOR], [x, s * (w - 2), FLOOR], [x, s * (w - 2), zt - 16], [x, s * (w - 22), zt], [x, s * (w - 60), zt - 6]] as V[]; }));   // the doors' tops
  // the cockpit: floor, dash, two bucket seats, the leather roll round the opening
  b.name('cockpit').mat(DARK, 0.05).box(C0 + 4, C1 - 2, -640, 640, FLOOR - 10, FLOOR + 4);
  b.name('cockpit').mat('#4a2c1a', 0.2, 'wood').box(C0, C0 + 20, -600, 600, FLOOR, 1140);
  b.name('cockpit').mat('#d8d2bf', 0.4); for (const y of [-300, -150, 150, 300]) b.lathe('x', [0, y, 1040], [[C0 + 20, 0], [C0 + 24, 44]], 10, false);
  for (const s of [1, -1]) { const y0 = Math.min(s * 30, s * 600), y1 = Math.max(s * 30, s * 600);
    b.name('seat').mat(LEATHER, 0.25, 'leather').box(2770, 3110, y0, y1, FLOOR, 740)
      .loft(([[3060, 740], [3130, 930], [3215, 1100], [3290, 1168], [3360, 1150], [3410, 1085]] as const).map(([x, z]) => [[x, y0, FLOOR], [x, y1, FLOOR], [x, y1 - 30, z], [x, y0 + 30, z]] as V[]));
    b.name('seat').mat(SEAM, 0.1); for (let k = 0; k < 3; k++) { const y = s * (165 + k * 150); b.bar([2780, y, 742], [3075, y, 742], 8).bar([3112, y, 880], [3205, y, 1085], 8); } }
  b.name('cockpit').mat(LEATHER, 0.25, 'leather').box(3410, C1 - 2, -600, 600, FLOOR, 1040);   // the padded shelf behind the seats
  b.name('cockpit').mat(LEATHER, 0.25, 'leather'); { const side = (s: number): V[] => [X(1045), X(1100), X(1170), X(1235), X(1300)].map(x => [x, s * (at(HALF, x) - 30), at(BELT, x) + 8] as V);
    tube(b, [...side(1), [C1 + 14, 520, at(BELT, C1) + 12], [C1 + 34, 300, at(BELT, C1) + 14], [C1 + 40, 0, at(BELT, C1) + 14], [C1 + 34, -300, at(BELT, C1) + 14], [C1 + 14, -520, at(BELT, C1) + 12], ...side(-1).reverse()], 24, 6); }
  // ---- bonnet and doors: the centre hinge, the bright vent strips, the top louvres, the shut lines, the handles ----
  b.name('hood').mat(CHROME, 0.9, 'metal').bar([X(310), 0, at(TOP, X(310)) + 3], [X(420), 0, at(TOP, X(420)) + 3], 14, 8).bar([X(420), 0, at(TOP, X(420)) + 3], [X(900), 0, at(TOP, X(900)) + 3], 14, 8);
  for (const s of [1, -1]) { const z0 = Z(240), z1 = Z(222), xa = X(505), xb = X(855), ya = s * (sideY(xa, z0) + 4), yb = s * (sideY(xb, z0) + 4);
    b.name('hood').mat(CHROME, 0.9, 'metal').loft([[[xa, ya - s * 6, z0 - 8], [xa, ya + s * 8, z0 - 8], [xa, ya + s * 8, z1 + 8], [xa, ya - s * 6, z1 + 8]], [[xb, yb - s * 6, z0 - 8], [xb, yb + s * 8, z0 - 8], [xb, yb + s * 8, z1 + 8], [xb, yb - s * 6, z1 + 8]]]);
    b.name('hood').mat('#3c3a36', 0.1).quad([xa + 14, ya + s * 9, z0], [xb - 14, yb + s * 9, z0], [xb - 14, yb + s * 9, z1], [xa + 14, ya + s * 9, z1]);
    b.name('hood').mat(LINE, 0.1); for (const [p0, p1] of [[480, 580], [640, 760]] as const) for (let x = X(p0); x < X(p1); x += 38) { const y0 = s * 150, y1 = s * 265; b.quad([x, y0, skin(x, y0) + 3], [x + 12, y0, skin(x, y0) + 3], [x + 12, y1, skin(x, y1) + 3], [x, y1, skin(x, y1) + 3]); }
    // shut lines: bonnet front and back, the door (hinged at the back), the sill
    b.name('body').mat(LINE, 0.1); const seam = (px: number, zl: number, zh: number) => { const x = X(px); for (let k = 0; k < 5; k++) { const za = zl + (zh - zl) * k / 5, zc = zl + (zh - zl) * (k + 1) / 5; b.quad([x, s * (sideY(x, za) + 3), za], [x + 9, s * (sideY(x + 9, za) + 3), za], [x + 9, s * (sideY(x + 9, zc) + 3), zc], [x, s * (sideY(x, zc) + 3), zc]); } };
    seam(430, 560, 1170); seam(912, 420, 1170); seam(945, 430, 1020); seam(1235, 430, 1040);
    b.quad([X(945), s * (sideY(X(945), 430) + 3), 430], [X(1235), s * (sideY(X(1235), 430) + 3), 430], [X(1235), s * (sideY(X(1235), 439) + 3), 439], [X(945), s * (sideY(X(945), 439) + 3), 439]);
    b.name('body').mat(CHROME, 0.9, 'metal').bar([X(962), s * (sideY(X(962), 895) + 9), 895], [X(1005), s * (sideY(X(1005), 895) + 9), 895], 15);   // the door handle
    for (const z of [560, 930]) b.box(X(1235) - 4, X(1235) + 18, s * sideY(X(1235), z) + (s > 0 ? 0 : -8), s * sideY(X(1235), z) + (s > 0 ? 8 : 0), z, z + 34); }   // the hinges
  // ---- the grille: a leaning shield come to a prow, dark behind bright upright bars, a bright rim and spine ----
  { const G: [number, number][] = [[0, 1128], [120, 1122], [172, 1085], [186, 980], [178, 840], [150, 690], [95, 560], [0, 470]], face = (y: number, z: number, out = 0): V => { const p = nose([XN0, y, z]); return [p[0] - out, y, z]; };
    for (const s of [1, -1]) { b.name('core').mat(DARK, 0.05, 'grille'); for (let i = 0; i + 1 < G.length; i++) b.quad(face(0, G[i]![1], 4), face(s * G[i]![0], G[i]![1], 4), face(s * G[i + 1]![0], G[i + 1]![1], 4), face(0, G[i + 1]![1], 4));
      b.name('coreBar').mat(CHROME, 0.9, 'metal'); for (let k = 1; k <= 4; k++) { const y = k * 37, zl = y < 95 ? 470 + y * 0.95 : y < 150 ? 560 + (y - 95) * 2.36 : 690 + (y - 150) * 5.3; b.bar(face(s * y, zl + 6, 10), face(s * y, 1112 - k * 3, 10), 9); }
      for (const z of [640, 790, 940]) b.bar(face(0, z, 12), face(s * (z < 700 ? 128 : 176), z, 12), 8);
      b.name('shell').mat(CHROME, 0.9, 'metal'); tube(b, G.map(([y, z]) => face(s * y, z, 12)), 13, 6, [1, 0, 0]); }
    b.name('shell').mat(CHROME, 0.9, 'metal').bar(face(0, 470, 16), face(0, 1130, 16), 20, 16);
    b.box(X(292), X(312), -16, 16, at(TOP, X(300)), at(TOP, X(300)) + 46); }   // the mascot on the prow
  // ---- the screen: two low panes in a V on a centre post ----
  { const xc = X(940), xo = X(985), yo = at(HALF, xo) * 0.86;
    for (const s of [1, -1]) { const foot: V[] = [0, 0.25, 0.5, 0.75, 1].map(f => { const x = xc + (xo - xc) * f, y = s * yo * f; return [x, y, skin(x, y) - 6] as V; }), to: V = [xo + 85, s * (yo - 12), 1352], tc: V = [xc + 70, 0, 1386];
      const top = (f: number): V => [tc[0] + (to[0] - tc[0]) * f, tc[1] + (to[1] - tc[1]) * f, tc[2] + (to[2] - tc[2]) * f];
      b.name('screenPane').mat(GLASS, 0.5, 'glass'); for (let i = 0; i < 4; i++) b.quad(foot[i]!, foot[i + 1]!, top((i + 1) / 4), top(i / 4));
      b.name('screenFrame').mat(CHROME, 0.9, 'metal').bar(foot[4]!, to, 26).bar(tc, to, 20); for (let i = 0; i < 4; i++) b.bar(foot[i]!, foot[i + 1]!, 22); }
    b.name('screenPost').mat(CHROME, 0.9, 'metal').bar([xc, 0, skin(xc, 0) - 6], [xc + 70, 0, 1386], 26); }
  // ---- the tail: its bright centre strip and the fin at the point ----
  b.name('body').mat(CHROME, 0.9, 'metal'); { const P = [1345, 1420, 1500, 1575, 1650, 1725, 1800, 1850].map(px => [X(px), 0, at(DECK, X(px)) + 3] as V); for (let i = 0; i + 1 < P.length; i++) b.bar(P[i]!, P[i + 1]!, 14, 8);
    const xa = X(1790), xb = X(1845), xt = X(1872); b.loft([[[xa, -3, at(DECK, xa)], [xa, 3, at(DECK, xa)], [xa, 0, at(DECK, xa) + 8]], [[xb, -9, at(DECK, xb) - 6], [xb, 9, at(DECK, xb) - 6], [xb, 0, at(DECK, xb) + 62]], [[xt, -3, 478], [xt, 3, 478], [xt, 0, 540]]]); }
  // ---- wings, lamps, wheels ----
  for (const s of [1, -1] as const) {
    b.name('fenderF').mat(PAINT, 0.45, 'paint');
    fender(b, ([[150, 400, 640, 740, 40], [175, 345, 520, 810, 70], [215, 312, 430, 868, 120], [280, 290, 385, 890, 150], [350, 280, 372, 895, 160], [425, 278, 375, 895, 160], [505, 288, 392, 890, 150], [585, 312, 420, 872, 130], [665, 350, 455, 842, 100], [740, 395, 500, 800, 70], [810, 436, 545, 760, 40], [880, 462, 590, 715, 20]] as const)
      .map(([px, py, yi, yo, sk]) => [X(px), Z(py), s * yi, s * yo, sk] as [number, number, number, number, number]), [FX, R - 250]);
    b.name('fenderR').mat(PAINT, 0.45, 'paint');
    fender(b, ([[1325, 448, 640, 715, 20], [1345, 392, 600, 800, 60], [1385, 340, 520, 862, 120], [1440, 310, 450, 890, 160], [1510, 298, 400, 895, 175], [1585, 304, 340, 890, 165], [1655, 326, 300, 868, 135], [1715, 356, 290, 820, 95], [1765, 388, 310, 740, 55], [1800, 414, 380, 660, 25]] as const)
      .map(([px, py, yi, yo, sk]) => [X(px), Z(py), s * yi, s * yo, sk] as [number, number, number, number, number]), [RX, R - 250]);
    b.name('body').mat(PAINT, 0.45, 'paint').loft(([[205, 318, 450], [270, 294, 400], [345, 282, 385], [425, 280, 388], [520, 292, 405]] as const).map(([px, py, yi]) => { const x = X(px), z = Z(py) - 28, w = at(HALF, x) - 30; return [[x, s * w, z + 10], [x, s * (yi + 40), z], [x, s * (yi + 40), z - 130], [x, s * w, z - 150]] as V[]; }));   // the apron between bonnet and wing
    b.name('board').mat(CHROME, 0.9, 'metal').box(X(880), X(1328), Math.min(s * 655, s * 700), Math.max(s * 655, s * 700), 372, 398);   // the bright sill strip
    // head lamps: bullets on the wing valances; tail lamps at the rear wings' ends
    const ly = s * 455, lz = Z(250), lx = X(318);
    b.name('lamp').mat(CHROME, 0.9, 'metal').lathe('x', [0, ly, lz], [[lx + 10, 104], [lx + 18, 112], [lx + 90, 108], [lx + 160, 82], [lx + 225, 40], [lx + 262, 0]], 12).lathe('x', [0, ly, lz], [[lx, 112], [lx + 6, 117], [lx + 14, 104]], 16, false);
    b.name('lens').mat(CHROME, 0.95, 'metal').lathe('x', [0, ly, lz], [[lx + 14, 0], [lx + 26, 36], [lx + 44, 76], [lx + 58, 100]], 12, false);
    b.mat('#f4ecd0', 0.6, 'lens').lathe('x', [0, ly, lz], [[lx + 30, 0], [lx + 34, 14]], 8, false);
    b.mat(GLASS, 0.5, 'glass').lathe('x', [0, ly, lz], [[lx + 3, 0], [lx + 6, 62], [lx + 10, 104]], 14, false);
    b.name('lampStand').mat(CHROME, 0.9, 'metal').box(lx + 80, lx + 110, ly - 14, ly + 14, lz - 190, lz - 100);
    const tx = X(1800), tz = Z(414) - 10, ty = s * 520;
    b.name('tailRim').mat(CHROME, 0.9, 'metal').lathe('x', [0, ty, tz], [[tx - 40, 26], [tx, 48], [tx + 46, 48]], 10); b.name('tail').mat(RED, 0.5, 'lens').lathe('x', [0, ty, tz], [[tx + 46, 42], [tx + 66, 26], [tx + 70, 0]], 10, false);
    b.name('bumperFiron').mat(DARK, 0.05).bar([60, s * 330, 445], [X(300), s * 300, 470], 32);
    b.name('bumperR').mat(DARK, 0.05).bar([L - 40, s * 150, 440], [X(1740), s * 110, 455], 26);
    b.name('bumperR').mat(CHROME, 0.9, 'metal'); tube(b, [[L - 70, s * 70, 440], [L - 22, s * 110, 440], [L - 22, s * 190, 440], [L - 80, s * 250, 440]], 20, 6); b.box(L - 42, L, s * 150 - 18, s * 150 + 18, 392, 492);
    wheel(b, FX, s, spin); wheel(b, RX, s, spin); }
  // ---- the front bumper: two bright blades bowed round the nose, overriders ----
  b.name('bumperF').mat(CHROME, 0.9, 'metal'); for (const z of [415, 478]) tube(b, [-800, -700, -520, -300, 0, 300, 520, 700, 800].map(y => [24 + (Math.abs(y) / 800) ** 2.4 * 150, y, z] as V), [14, 24, 24, 24, 24, 24, 24, 24, 14], 6);
  for (const y of [-330, 330]) b.box(-2, 50, y - 22, y + 22, 372, 522);
  b.name('chassis').mat(DARK, 0.05).box(X(300), X(1700), -300, 300, 300, 420).bar([FX, -WY, R], [FX, WY, R], 60).bar([RX, -WY, R], [RX, WY, R], 80).lathe('y', [RX, 0, R], [[-120, 60], [-70, 130], [70, 130], [120, 60]], 10);
  // ---- the outside exhaust: four flexible bright pipes out of the bonnet's right side, down into the wing ----
  b.name('exhaust').mat(CHROME, 0.85, 'metal'); for (const px of [585, 662, 740, 818]) { const x = X(px), z = Z(288), w = -sideY(x, z);
    tube(b, [[x - 10, w + 30, z + 6], [x + 8, w - 8, z], [x + 40, w - 60, z - 30], [x + 95, w - 92, z - 130], [x + 150, w - 100, z - 270], [x + 185, w - 96, z - 420]], [58, 58, 46, 45, 45, 45], 8, [1, 0, 0]); }
  return b.mesh(L); }
export const mesh = auburn851Mesh;
