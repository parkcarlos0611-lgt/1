// The 1936 Mercedes-Benz 540 K Special Roadster as a low-polygon mesh: black, a long bonnet behind an upright V
// radiator, wings in one sweep from the nose to the tail, three flexible exhausts out of the bonnet's right side, the
// folded hood behind two leather seats and the spare set into the sloping tail. Stations and heights are read off the
// reference sheet's side view (in its pixels: X() and Z() turn them into mm) at the real wheelbase (3290 mm); the sheet
// is drawn a little low and its plan narrow, so heights are raised 5 % and the widths set to the real car (1.88 m over
// the wings, 1.51 m track).
import { Build, section, type Mesh, type V } from './mesh';

const PAINT = '#16161a', CHROME = '#c9cbcf', LEATHER = '#7a4024', HOOD = '#6e3a20', SEAM = '#4a230e', GLASS = '#a9c2cc', RUBBER = '#26242b', WHITE = '#ece6d6', DARK = '#1c1b20', RED = '#c22c2b', LINE = '#3a3a42';
const X = (px: number) => (px - 100) * 2.836, Z = (py: number) => (568 - py) * 2.98;
const FX = X(360), WB = 3290, RX = FX + WB, R = 392, WY = 755, TW = 180, L = 5105;
const tab = (t: [number, number][], fx: (v: number) => number, fv: (v: number) => number) => t.map(([x, v]) => [fx(x), fv(v)] as [number, number]);
const at = (t: [number, number][], x: number) => { if (x <= t[0]![0]) return t[0]![1]; for (let i = 1; i < t.length; i++) if (x <= t[i]![0]) { const [x0, v0] = t[i - 1]!, [x1, v1] = t[i]!; return v0 + (v1 - v0) * (x - x0) / (x1 - x0); } return t[t.length - 1]![1]; };
const same = (v: number) => v;
// the body along the car: half-width (mm), top of the bonnet and scuttle, the cut-down doors' tops, the rear deck and tail, the underside
const HALF = tab([[268, 268], [400, 346], [600, 446], [840, 586], [930, 630], [1100, 682], [1290, 690], [1400, 655], [1560, 600], [1700, 535], [1780, 450], [1835, 310]], X, same);
const TOP = tab([[268, 192], [300, 188], [600, 181], [840, 178], [930, 184], [945, 190]], X, Z);
const BELT = tab([[945, 235], [1000, 248], [1100, 262], [1200, 262], [1265, 256], [1292, 228]], X, Z);
const DECK = tab([[1292, 222], [1560, 207], [1640, 215], [1700, 234], [1760, 292], [1810, 352], [1835, 420]], X, Z);
const BOT = tab([[268, 410], [330, 340], [1500, 340], [1700, 380], [1835, 410]], X, same);
const C0 = X(945), C1 = X(1292), FLOOR = 470;
const zTop = (x: number) => x < C0 ? at(TOP, x) : x > C1 ? at(DECK, x) : at(BELT, x);
const nTop = (x: number) => x < X(400) ? 4.5 - 1.6 * Math.max(0, (x - X(268)) / (X(400) - X(268))) : x < X(840) ? 2.9 : 3.2;
const skin = (x: number, y: number) => { const w = at(HALF, x), zb = at(BOT, x), h = (zTop(x) - zb) / 2, n = nTop(x); return zb + h + h * Math.max(0, 1 - Math.abs(y / w) ** n) ** (1 / n); };
const sideY = (x: number, z: number) => { const w = at(HALF, x), zb = at(BOT, x), h = (zTop(x) - zb) / 2, d = z - zb - h, n = d > 0 ? nTop(x) : 6; return w * Math.max(0, 1 - Math.abs(d / h) ** n) ** (1 / n); };
// the radiator stands upright and comes to a shallow V: the first stations are drawn forward to it at the centre line
const XN0 = X(268), XN1 = X(310), VEE = 75;
const nose = (p: V): V => { const t = Math.max(0, Math.min(1, (XN1 - p[0]) / (XN1 - XN0))); return [p[0] - t * VEE * Math.max(0, 1 - Math.abs(p[1]) / 268), p[1], p[2]]; };

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = (a: V): V => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** a round tube along a line of points (pipes, bumper blades, the cockpit's roll); `r` one radius or one per point */
function tube(b: Build, pts: V[], r: number | number[], seg = 8, ref: V = [0, 0, 1]): void {
  b.loft(pts.map((p, i) => { const d = norm(sub(pts[Math.min(pts.length - 1, i + 1)]!, pts[Math.max(0, i - 1)]!)), u = norm(cross(d, ref)), v = cross(d, u), rr = typeof r === 'number' ? r : r[i]!;
    return Array.from({ length: seg }, (_, k) => { const a = k / seg * Math.PI * 2, c = Math.cos(a) * rr, s = Math.sin(a) * rr; return [p[0] + u[0] * c + v[0] * s, p[1] + u[1] * c + v[1] * s, p[2] + u[2] * c + v[2] * s] as V; }); })); }
/** a teardrop wing: a crowned strip swept along [x, zTop, yIn, yOut, skirt] points, its outer edge carried down as a valance */
function fender(b: Build, path: [number, number, number, number, number][], hub: [number, number], crown = 90): void {
  b.loft(path.map((p, i) => { const a = path[Math.max(0, i - 1)]!, c = path[Math.min(path.length - 1, i + 1)]!, tx = c[0] - a[0], tz = c[1] - a[1], l = Math.hypot(tx, tz) || 1; let nx = -tz / l, nz = tx / l; if (nx * (p[0] - hub[0]) + nz * (p[1] - hub[1]) < 0) { nx = -nx; nz = -nz; }
    const [x, z, yi, yo, sk] = p, pt = (y: number, k: number): V => [x + nx * k, y, z + nz * k], ring: V[] = [pt(yi, -45)];
    for (let k = 0; k <= 5; k++) { const u = k / 5; ring.push(pt(yi + (yo - yi) * u, crown * Math.sin(Math.PI * (0.08 + 0.84 * u)) - crown * 0.35 * u * u)); }
    const e = ring[ring.length - 1]!; ring.push([e[0], yo + Math.sign(yo) * 6, e[2] - sk * 0.5], [e[0] - nx * 10, yo, e[2] - sk], [e[0] - nx * 30, yo - Math.sign(yo) * 40, e[2] - sk]); return ring; })); }

/** a wire spoke: a three-sided rod without ends */
function wire(b: Build, p: V, q: V, t: number): void { const d = norm(sub(q, p)), u = norm(cross(d, [0, 1, 0])), v = cross(d, u), ring = (o: V): V[] => [0, 1, 2].map(k => { const a = k / 3 * Math.PI * 2, c = Math.cos(a) * t / 2, s = Math.sin(a) * t / 2; return [o[0] + u[0] * c + v[0] * s, o[1] + u[1] * c + v[1] * s, o[2] + u[2] * c + v[2] * s] as V; }); b.loft([ring(p), ring(q)], false); }
/** the three-pointed star: a thin ring and three arms, in the plane across `axis` */
function star(b: Build, o: V, r: number, axis: 'x' | 'y', turn = 0, t = 8): void { b.lathe(axis, o, [[-t / 2, r], [t / 2, r], [t / 2, r - t]], 10, false);
  for (let k = 0; k < 3; k++) { const a = turn + Math.PI / 2 + k * Math.PI * 2 / 3, c = Math.cos(a) * (r - 2), q = Math.sin(a) * (r - 2); wire(b, o, axis === 'x' ? [o[0], o[1] + c, o[2] + q] : [o[0] + c, o[1], o[2] + q], t * 1.3); } }
function wheel(b: Build, x: number, s: 1 | -1, spin = 0) { const o: V = [x, s * WY, R], rim = 250, f = s * (TW / 2), nm = x === FX ? 'tyreF' : 'tyreR';
  b.name(nm).mat(RUBBER, 0.05, 'tyre').lathe('y', o, [[-TW / 2, rim], [-TW / 2, R - 50], [-TW / 2 + 38, R], [TW / 2 - 38, R], [TW / 2, R - 50], [TW / 2, rim]], 20, false);
  b.name(nm).mat(WHITE, 0.1, 'tyre').lathe('y', o, [[f * 1.03, rim + 4], [f * 1.08, rim + 52], [f * 1.04, R - 34]], 20, false);   // the whitewall
  b.name('wheel').mat(DARK, 0.05).lathe('y', o, [[f * 0.5, 0], [f * 0.5, rim]], 20, false);
  b.name('rim').mat(CHROME, 0.9, 'metal').lathe('y', o, [[f * 1.04, rim + 6], [f * 0.7, rim - 32]], 20, false).lathe('y', o, [[f * 0.6, 60], [f * 1.2, 40], [f * 1.2, 0]], 10, false);
  b.name('spoke').mat('#c3c5c9', 0.6, 'metal'); for (let row = 0; row < 2; row++) for (let k = 0; k < 18; k++) { const a = spin + (k + row * 0.5) / 18 * Math.PI * 2, lean = (k % 2 ? 1 : -1) * 0.42, b0 = a + lean, rr = rim - 24;
    const yin = s * WY + f * (row ? 0.98 : 0.45), yout = s * WY + f * (row ? 0.7 : 0.62); wire(b, [x + Math.cos(a) * 62, yin, R + Math.sin(a) * 62], [x + Math.cos(b0) * rr, yout, R + Math.sin(b0) * rr], 8); }
  b.name('hub').mat(CHROME, 0.9, 'metal').lathe('y', o, [[f * 0.95, 96], [f * 1.2, 92], [f * 1.34, 70], [f * 1.42, 30], [f * 1.44, 0]], 12, false);   // the hub cap, the star on it
  b.name('hub').mat('#3a3c44', 0.5, 'metal'); star(b, [x, s * WY + f * 1.44, R], 58, 'y', spin, 9); }

export function mb540kMesh(spin = 0): Mesh { const b = new Build();
  // ---- the body: bonnet, scuttle, the tub cut down for the cockpit, the rear deck falling to the tail ----
  b.name('body').mat(PAINT, 0.5, 'paint');
  const xs = [268, 285, 310, 400, 500, 600, 720, 840, 930].map(X).concat([C0 - 5, C0, C1, C1 + 5], [1400, 1560, 1640, 1700, 1760, 1810, 1835].map(X));
  b.loft(xs.map(x => { const pit = x >= C0 && x <= C1; return section(x, at(HALF, x), at(BOT, x), pit ? FLOOR : zTop(x), pit ? 8 : nTop(x), 6).map(nose); }));
  for (const s of [1, -1]) b.loft([C0 + 2, X(1000), X(1050), X(1100), X(1200), X(1265), C1 - 2].map(x => { const w = at(HALF, x), zt = at(BELT, x); return [[x, s * (w - 60), FLOOR], [x, s * (w - 2), FLOOR], [x, s * (w - 2), zt - 16], [x, s * (w - 22), zt], [x, s * (w - 60), zt - 6]] as V[]; }));   // the doors' tops
  // the cockpit: floor, dash, two seats, the leather roll along the doors
  b.name('cockpit').mat(DARK, 0.05).box(C0 + 4, C1 - 2, -650, 650, FLOOR - 10, FLOOR + 4);
  b.name('cockpit').mat('#5a3a22', 0.2, 'wood').box(C0, C0 + 20, -610, 610, FLOOR, at(TOP, C0) - 50);
  b.name('cockpit').mat('#d8d2bf', 0.4); for (const y of [-300, -150, 150, 300]) b.lathe('x', [0, y, 960], [[C0 + 20, 0], [C0 + 24, 46]], 10, false);
  for (const s of [1, -1]) { const y0 = Math.min(s * 30, s * 612), y1 = Math.max(s * 30, s * 612);
    b.name('seat').mat(LEATHER, 0.25, 'leather').box(X(1085), X(1205), y0, y1, FLOOR, 740)
      .loft(([[1188, 740], [1212, 930], [1238, 1070], [1262, 1125], [1282, 1105], [1290, 1040]] as [number, number][]).map(([px, z]) => { const x = X(px); return [[x, y0, FLOOR], [x, y1, FLOOR], [x, y1 - 30, z], [x, y0 + 30, z]] as V[]; }));
    b.name('seat').mat(SEAM, 0.1); for (let k = 0; k < 3; k++) { const y = s * (170 + k * 150); wire(b, [X(1090), y, 744], [X(1190), y, 744], 12); wire(b, [X(1206), y, 880], [X(1236), y, 1060], 12); }
    b.name('cockpit').mat(LEATHER, 0.25, 'leather'); tube(b, [X(960), X(1000), X(1050), X(1100), X(1200), X(1265), X(1288)].map(x => [x, s * (at(HALF, x) - 28), at(BELT, x) + 6] as V), 22, 6); }
  // ---- the folded hood behind the seats, under its cover; its seam and straps ----
  b.name('tonneau').mat(HOOD, 0.15, 'canvas').loft(([[1293, 640, 205], [1310, 688, 170], [1380, 688, 160], [1470, 660, 164], [1525, 625, 186], [1545, 590, 212]] as const).map(([px, w, py]) => section(X(px), w, Z(232), Z(py), 3.6, 6, 12)));
  b.name('tonneau').mat(SEAM, 0.1).bar([X(1320), 0, Z(156) + 2], [X(1540), 0, Z(192) + 2], 10); for (const y of [-420, 420]) b.bar([X(1400), y, Z(160)], [X(1400), y * 1.2, Z(205)], 26, 8);
  // ---- bonnet and doors: centre hinge, the bright waist line, louvres on the sides and top, shut lines, handles ----
  b.name('hood').mat(CHROME, 0.9, 'metal').bar([X(300), 0, at(TOP, X(300)) + 3], [X(600), 0, at(TOP, X(600)) + 3], 14, 8).bar([X(600), 0, at(TOP, X(600)) + 3], [X(840), 0, at(TOP, X(840)) + 3], 14, 8);
  for (const s of [1, -1]) { const wz = Z(246);
    b.name('hood').mat(CHROME, 0.9, 'metal'); { const P = [300, 420, 560, 700, 840, 930].map(px => [X(px), s * (sideY(X(px), wz) + 3), wz] as V); for (let i = 0; i + 1 < P.length; i++) wire(b, P[i]!, P[i + 1]!, 16); }
    b.name('hood').mat(LINE, 0.1); for (let x = X(505); x < X(800); x += 44) { const za = Z(312), zc = Z(262), ze = Z(350); b.quad([x, s * (sideY(x, za) + 3), za], [x + 14, s * (sideY(x, za) + 3), za], [x + 14, s * (sideY(x, zc) + 3), zc], [x, s * (sideY(x, zc) + 3), zc]);
      if (x < X(700)) b.quad([x, s * (sideY(x, ze) + 3), ze], [x + 14, s * (sideY(x, ze) + 3), ze], [x + 14, s * (sideY(x, ze + 60) + 3), ze + 60], [x, s * (sideY(x, ze + 60) + 3), ze + 60]); }
    for (let x = X(540); x < X(765); x += 50) { const y0 = s * 150, y1 = s * 250; b.quad([x, y0, skin(x, y0) + 3], [x + 16, y0, skin(x, y0) + 3], [x + 16, y1, skin(x, y1) + 3], [x, y1, skin(x, y1) + 3]); }
    b.name('body').mat(LINE, 0.1); const seam = (px: number, zl: number, zh: number, lean = 0) => { for (let k = 0; k < 5; k++) { const za = zl + (zh - zl) * k / 5, zc = zl + (zh - zl) * (k + 1) / 5, xa = X(px) + lean * k / 5, xc = X(px) + lean * (k + 1) / 5; b.quad([xa, s * (sideY(xa, za) + 3), za], [xa + 9, s * (sideY(xa + 9, za) + 3), za], [xc + 9, s * (sideY(xc + 9, zc) + 3), zc], [xc, s * (sideY(xc, zc) + 3), zc]); } };
    seam(815, 500, at(TOP, X(840)) - 30, 70); seam(885, 420, Z(246), 130); seam(1285, 400, Z(240));
    b.quad([X(885), s * (sideY(X(885), 420) + 3), 420], [X(1285), s * (sideY(X(1285), 400) + 3), 400], [X(1285), s * (sideY(X(1285), 409) + 3), 409], [X(885), s * (sideY(X(885), 429) + 3), 429]);
    b.name('body').mat(CHROME, 0.9, 'metal').bar([X(940), s * (sideY(X(940), Z(297)) + 9), Z(297)], [X(985), s * (sideY(X(985), Z(297)) + 9), Z(297)], 15);   // the door handle
    for (const z of [520, 800]) b.box(X(1285) - 4, X(1285) + 18, s * sideY(X(1285), z) + (s > 0 ? 0 : -8), s * sideY(X(1285), z) + (s > 0 ? 8 : 0), z, z + 34);   // the hinges
    // the little lamp on the scuttle's side
    const py = s * (at(HALF, X(872)) + 20), pz = at(TOP, X(872)) + 10; b.name('lamp').mat(CHROME, 0.9, 'metal').lathe('x', [0, py, pz], [[X(858), 40], [X(866), 46], [X(890), 38], [X(912), 0]], 8).bar([X(880), py, pz - 40], [X(880), s * (at(HALF, X(880)) - 30), pz - 120], 14);
    b.name('lens').mat('#f4ecd0', 0.6, 'lens').lathe('x', [0, py, pz], [[X(857), 0], [X(858), 40]], 8, false); }
  // ---- the radiator: a bright upright shell in a shallow V, a fine mesh core, its centre bar, the star standing on top ----
  { const W = 268, zb = 430, zt = at(TOP, XN0) + 4, x0 = XN0 - 6, ringAt = (x: number, inset: number) => section(x, W - inset, zb + inset, zt - inset, 4.5, 6).map(p => nose([p[0] + (XN0 - x0) * 0, p[1], p[2]]));
    const sh = (x: number, inset: number) => ringAt(XN0, inset).map(p => [p[0] + (x - XN0), p[1], p[2]] as V);
    b.name('shell').mat(CHROME, 0.9, 'metal').loft([sh(XN0 + 80, -3), sh(x0 - 6, -3), sh(x0 - 6, 30), sh(x0 + 26, 30)], false);
    const C = sh(x0 + 22, 28), px = x0 + 22 - VEE; b.name('core').mat(DARK, 0.05, 'grille'); for (let i = 0; i < C.length; i++) { const p = C[i]!, q = C[(i + 1) % C.length]!; if (p[1] * q[1] < 0) continue; b.quad(p, q, [px, 0, q[2]], [px, 0, p[2]]); }
    b.name('coreBar').mat(CHROME, 0.9, 'metal').bar([px - 6, 0, zb + 20], [px - 6, 0, zt - 20], 16, 14);
    b.name('shell').mat(CHROME, 0.9, 'metal').lathe('x', [0, 0, zt], [[XN0 - 40, 0], [XN0 - 40, 30], [XN0 - 8, 34], [XN0 + 4, 0]], 10, false).bar([XN0 - 18, 0, zt + 20], [XN0 - 18, 0, zt + 62], 12);
    star(b, [XN0 - 18, 0, zt + 112], 58, 'x', 0, 8);
    b.name('shell').mat('#2a4a9a', 0.6).lathe('x', [0, 0, zt - 62], [[x0 - 80, 0], [x0 - 78, 26]], 10, false); }   // the badge on the shell's brow
  // ---- the screen: two panes raked back in a V on a centre post, a bright frame ----
  { const xc = X(922), xo = X(948), yo = at(HALF, xo) * 0.9;
    for (const s of [1, -1]) { const foot: V[] = [0, 0.25, 0.5, 0.75, 1].map(f => { const x = xc + (xo - xc) * f, y = s * yo * f; return [x, y, skin(x, y) - 6] as V; }), to: V = [X(1032), s * (yo - 30), Z(108)], tc: V = [X(1010), 0, Z(102)];
      const top = (f: number): V => [tc[0] + (to[0] - tc[0]) * f, tc[1] + (to[1] - tc[1]) * f, tc[2] + (to[2] - tc[2]) * f];
      b.name('screenPane').mat(GLASS, 0.5, 'glass'); for (let i = 0; i < 4; i++) b.quad(foot[i]!, foot[i + 1]!, top((i + 1) / 4), top(i / 4));
      b.name('screenFrame').mat(CHROME, 0.9, 'metal').bar(foot[4]!, to, 28).bar(tc, to, 22); for (let i = 0; i < 4; i++) b.bar(foot[i]!, foot[i + 1]!, 22); }
    b.name('screenPost').mat(CHROME, 0.9, 'metal').bar([xc, 0, skin(xc, 0) - 6], [X(1010), 0, Z(102)], 26); }
  // ---- wings, running boards, lamps, wheels ----
  for (const s of [1, -1] as const) {
    b.name('fenderF').mat(PAINT, 0.5, 'paint');
    fender(b, ([[200, 345, 600, 800, 40], [218, 302, 500, 880, 80], [262, 278, 440, 930, 130], [330, 268, 420, 940, 150], [400, 272, 425, 940, 150], [480, 290, 450, 935, 130], [560, 318, 490, 928, 110], [650, 356, 540, 920, 90], [750, 396, 590, 912, 70], [850, 428, 640, 905, 50], [945, 448, 680, 900, 30]] as const)
      .map(([px, py, yi, yo, sk]) => [X(px), Z(py), s * yi, s * yo, sk] as [number, number, number, number, number]), [FX, R - 250]);
    b.name('fenderR').mat(PAINT, 0.5, 'paint');
    fender(b, ([[1300, 450, 680, 900, 30], [1325, 392, 660, 915, 70], [1375, 320, 620, 932, 120], [1445, 284, 590, 940, 150], [1520, 274, 575, 940, 160], [1600, 290, 550, 932, 150], [1680, 332, 510, 905, 120], [1750, 385, 440, 860, 80], [1812, 428, 330, 780, 40]] as const)
      .map(([px, py, yi, yo, sk]) => [X(px), Z(py), s * yi, s * yo, sk] as [number, number, number, number, number]), [RX, R - 250]);
    b.name('body').mat(PAINT, 0.5, 'paint').loft(([[215, 310, 500], [262, 284, 440], [330, 274, 420], [400, 278, 425], [480, 296, 450], [560, 324, 490]] as const).map(([px, py, yi]) => { const x = X(px), z = Z(py) - 28, w = Math.max(200, at(HALF, x) - 40); return [[x, s * w, z + 10], [x, s * (yi + 40), z], [x, s * (yi + 40), z - 140], [x, s * w, z - 160]] as V[]; }));   // the apron between bonnet and wing
    const y0 = Math.min(s * 670, s * 900), y1 = Math.max(s * 670, s * 900);
    b.name('board').mat(PAINT, 0.3, 'paint').box(X(940), X(1306), y0, y1, 318, 352);
    b.name('board').mat(CHROME, 0.9, 'metal'); for (const y of [735, 790, 845]) b.quad([X(952), s * y - 12, 354], [X(1296), s * y - 12, 354], [X(1296), s * y + 12, 354], [X(952), s * y + 12, 354]); b.box(X(940), X(1306), s * 900 - 8, s * 900 + 8, 322, 358);
    // head lamps: big bowls beside the radiator on the cross bar; tail lamps on the rear wings
    const ly = s * 405, lz = Z(244), lx = X(212);
    b.name('lamp').mat(CHROME, 0.9, 'metal').lathe('x', [0, ly, lz], [[lx + 10, 122], [lx + 20, 130], [lx + 70, 122], [lx + 125, 90], [lx + 165, 45], [lx + 180, 0]], 10).lathe('x', [0, ly, lz], [[lx, 130], [lx + 6, 136], [lx + 16, 122]], 12, false);
    b.name('lens').mat(CHROME, 0.95, 'metal').lathe('x', [0, ly, lz], [[lx + 16, 0], [lx + 34, 60], [lx + 64, 116]], 10, false);
    b.mat('#f4ecd0', 0.6, 'lens').lathe('x', [0, ly, lz], [[lx + 34, 0], [lx + 38, 16]], 6, false);
    b.mat(GLASS, 0.5, 'glass').lathe('x', [0, ly, lz], [[lx + 2, 0], [lx + 5, 74], [lx + 10, 122]], 10, false);
    b.name('lampStand').mat(CHROME, 0.9, 'metal').box(lx + 80, lx + 112, ly - 15, ly + 15, lz - 250, lz - 110);
    b.name('horn').mat(CHROME, 0.9, 'metal').lathe('x', [0, s * 185, 610], [[X(175), 62], [X(182), 66], [X(200), 30], [X(250), 20], [X(262), 0]], 8);
    const tx = X(1752), tz = Z(350), ty = s * 650;
    b.name('tailRim').mat(CHROME, 0.9, 'metal').lathe('x', [0, ty, tz], [[tx - 60, 0], [tx - 30, 34], [tx, 46], [tx + 30, 46]], 8).bar([tx - 10, ty, tz - 30], [tx - 10, ty, tz - 130], 16); b.name('tail').mat(RED, 0.5, 'lens').lathe('x', [0, ty, tz], [[tx + 30, 40], [tx + 46, 24], [tx + 50, 0]], 10, false);
    b.name('bumperFiron').mat(DARK, 0.05).bar([50, s * 320, 430], [X(290), s * 300, 450], 32);
    b.name('bumperR').mat(DARK, 0.05).bar([L - 50, s * 330, 430], [X(1780), s * 300, 440], 32);
    wheel(b, FX, s, spin); wheel(b, RX, s, spin); }
  b.name('lampStand').mat(CHROME, 0.9, 'metal').bar([X(250), -405, Z(244) - 120], [X(250), 405, Z(244) - 120], 26);   // the lamps' cross bar
  // the fog lamp before the radiator, the apron under it
  { const fx = X(158), fz = Z(318); b.name('lamp').mat(CHROME, 0.9, 'metal').lathe('x', [0, 0, fz], [[fx + 8, 76], [fx + 16, 82], [fx + 60, 72], [fx + 100, 40], [fx + 118, 0]], 10).bar([fx + 60, 0, fz - 60], [fx + 60, 0, 470], 22);
    b.name('lens').mat('#f1e7b8', 0.6, 'lens').lathe('x', [0, 0, fz], [[fx, 0], [fx + 4, 50], [fx + 10, 76]], 10, false); }
  b.name('body').mat(PAINT, 0.5, 'paint').loft([[X(205), 380, 520], [X(240), 440, 560], [X(300), 450, 560]].map(([x, w, zt]) => [[x!, -w!, 400], [x!, w!, 400], [x!, w!, zt!], [x!, -w!, zt!]] as V[]));
  // ---- bumpers: two bright blades bowed round the nose and the tail, overriders ----
  b.name('bumperF').mat(CHROME, 0.9, 'metal'); for (const z of [400, 462]) tube(b, [-860, -740, -460, 0, 460, 740, 860].map(y => [24 + (Math.abs(y) / 860) ** 2.4 * 190, y, z] as V), [14, 24, 24, 24, 24, 24, 14], 5);
  for (const y of [-320, 320]) b.box(-2, 52, y - 24, y + 24, 356, 520);
  b.name('bumperR').mat(CHROME, 0.9, 'metal'); for (const z of [400, 462]) tube(b, [-850, -735, -460, 0, 460, 735, 850].map(y => [L - 24 - (Math.abs(y) / 850) ** 2.4 * 170, y, z] as V), [14, 24, 24, 24, 24, 24, 14], 5);
  for (const y of [-330, 330]) b.box(L - 52, L + 2, y - 24, y + 24, 356, 520);
  b.name('chassis').mat(DARK, 0.05).box(X(300), X(1800), -320, 320, 280, 400).bar([FX, -WY, R], [FX, WY, R], 60).bar([RX, -WY, R], [RX, WY, R], 80).lathe('y', [RX, 0, R], [[-120, 60], [-70, 130], [70, 130], [120, 60]], 10);
  // ---- the outside exhaust: three flexible bright pipes out of the bonnet's right side, back and down into the wing ----
  b.name('exhaust').mat(CHROME, 0.85, 'metal'); for (const px of [520, 605, 690]) { const x = X(px), z = Z(292), w = -sideY(x, z);
    tube(b, [[x - 12, w + 30, z + 8], [x + 6, w - 10, z], [x + 50, w - 62, z - 40], [x + 150, w - 100, z - 140], [x + 260, w - 120, z - 250], [x + 330, w - 120, z - 330]], [56, 56, 46, 45, 45, 45], 7, [0, 0, 1]); }
  // ---- the spare, lying back in the sloping tail: whitewall, wire wheel, the star on its cap ----
  { const o: V = [X(1752), 0, Z(262)], rim = 250, RS = 385, m0 = b.mark();
    b.name('spare').mat(RUBBER, 0.05, 'tyre').lathe('x', o, [[-90, rim], [-90, RS - 50], [-52, RS], [52, RS], [90, RS - 50], [90, rim]], 20, false);
    b.name('spare').mat(WHITE, 0.1, 'tyre').lathe('x', o, [[93, rim + 4], [98, rim + 52], [94, RS - 34]], 20, false);
    b.name('spare').mat(DARK, 0.05).lathe('x', o, [[40, 0], [40, rim]], 20, false); b.mat(CHROME, 0.9, 'metal').lathe('x', o, [[94, rim + 6], [62, rim - 32]], 20, false).lathe('x', o, [[84, 96], [112, 90], [126, 60], [132, 0]], 12, false);
    b.name('spare').mat('#b9bbc0', 0.6, 'metal'); for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2, a2 = a + (k % 2 ? 0.42 : -0.42); wire(b, [o[0] + (k % 2 ? 88 : 50), Math.cos(a) * 62, o[2] + Math.sin(a) * 62], [o[0] + 62, Math.cos(a2) * (rim - 24), o[2] + Math.sin(a2) * (rim - 24)], 8); }
    b.name('spare').mat('#3a3c44', 0.5, 'metal'); star(b, [o[0] + 132, 0, o[2]], 58, 'x', 0, 9);
    b.tilt(m0, o, 41); }
  return b.mesh(L); }
export const mesh = mb540kMesh;
