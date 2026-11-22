// The 1955 Jaguar D-type, the long-nose works car, as a low-polygon mesh (docs/systems/70_mesh_car_rules.md). No sheet
// for this car: the sizes are the real ones (length 4470, width 1638, height 1118 to the fin's top, wheelbase 2286,
// track 1270 front and 1220 rear, 6.50-16 tyres on Dunlop light-alloy disc wheels), the shapes read from photographs.
// One smooth envelope: an oval mouth, a long falling nose, the wings flowing into the body with the lamps under clear
// covers, the driver on the right behind a wrap-round screen, a metal cover over the passenger's side, the headrest
// fairing behind the driver running into the tall tail fin.
import { Build, section, type Mesh, type V } from './mesh';

/** the race number on its discs (6: the works car that won Le Mans in 1955) */
const NUMBER = '6';
const PAINT = '#1f4a36', SEAM = '#12281e', CHROME = '#c9cbcf', ALLOY = '#aeb2b6', LEATHER = '#5d6f4a', LEATHER2 = '#44523a', GLASS = '#a9c2cc', RUBBER = '#26242b', DARK = '#1c1b20', LENS = '#efe9cf', RED = '#c22c2b', WHITE = '#e9e6dc';
const FX = 1000, RX = FX + 2286, R = 360, TW = 165, WYF = 635, WYR = 610, L = 4470;   // the axles, the tyre's radius and width, half the tracks
const RA = 388, YINF = 518, YINR = 493;                                               // the wheel arches' radius; the wheel wells' inner walls
const FLOOR = 330, CX0 = 2170, CX1 = 2840, DY = 360;                                  // the driver's hollow: its floor, front and back; the driver's place across the car
const P = 2.7;                                                                         // how square the body's shoulders are
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = (a: V): V => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** linear reading of a table of [x, value] */
const at = (tab: [number, number][], x: number) => { if (x <= tab[0]![0]) return tab[0]![1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i]![0]) { const [x0, v0] = tab[i - 1]!, [x1, v1] = tab[i]!; return v0 + (v1 - v0) * (x - x0) / (x1 - x0); } return tab[tab.length - 1]![1]; };
// the body along the car: half-width (plan); the height of its widest line; its underside; then the top in three parts:
// the deck between the wings, how far the centre (bonnet bulge, scuttle) stands above it, how far the wings' crests do
const HALF: [number, number][] = [[0, 250], [60, 400], [150, 520], [300, 640], [500, 722], [750, 782], [1000, 812], [1300, 819], [1800, 806], [2500, 800], [2900, 808], [3286, 815], [3600, 792], [3900, 725], [4150, 625], [4330, 500], [4420, 380], [4470, 240]];
const EDGE: [number, number][] = [[0, 450], [300, 470], [1000, 500], [2300, 520], [3286, 520], [4000, 500], [4470, 470]];
const BOT: [number, number][] = [[0, 365], [150, 300], [400, 240], [700, 200], [1000, 180], [3400, 180], [3800, 230], [4200, 320], [4470, 400]];
const DECK: [number, number][] = [[0, 540], [60, 588], [150, 622], [400, 668], [700, 692], [1000, 702], [1400, 707], [1800, 717], [2100, 735], [2900, 735], [3286, 735], [3700, 705], [4100, 648], [4350, 590], [4470, 540]];
const CEN: [number, number][] = [[0, 0], [150, 10], [400, 30], [700, 55], [1000, 75], [1400, 95], [1800, 105], [2100, 100], [2300, 62], [2900, 45], [3400, 40], [4100, 20], [4470, 0]];
const WNG: [number, number][] = [[0, 0], [150, 25], [400, 70], [700, 108], [1000, 150], [1400, 112], [1800, 60], [2100, 28], [2500, 18], [2900, 52], [3286, 112], [3700, 80], [4100, 26], [4470, 0]];
/** the wheel arch's height at x: a half circle over each hub (0 away from the wheels) */
const archZ = (x: number) => { for (const hx of [FX, RX]) { const dx = x - hx; if (Math.abs(dx) <= RA + 1e-6) return R + Math.sqrt(Math.max(0, RA * RA - dx * dx)); } return 0; };
/** the skin's height at y across the body at x: deck, centre bulge and wing crest, rolled over to the widest line at the edge */
const skinZ = (x: number, y: number) => { const w = at(HALF, x), ay = Math.abs(y), u = Math.min(1, ay / w), ze = Math.max(at(EDGE, x), archZ(x));
  const h = at(DECK, x) + at(CEN, x) * Math.exp(-((ay / 300) ** 2)) + at(WNG, x) * Math.exp(-(((ay - 0.7 * w) / (0.26 * w)) ** 2)); return ze + (h - ze) * (1 - u ** P) ** (1 / P); };
/** the skin's distance from the centre line at height z on the body's side at x */
const sideY = (x: number, z: number) => { const w = at(HALF, x), ze = at(EDGE, x); if (z <= ze) return w * (1 - 0.01 * (ze - z) / Math.max(1, ze - at(BOT, x) - 50));
  let lo = 0.72 * w, hi = w; for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (skinZ(x, m) > z) lo = m; else hi = m; } return (lo + hi) / 2; };
// where the body's sections have their points across the top, as parts of the half-width; the doubled ones are the
// edges of the driver's hollow, so its walls stand upright
const U = [-1, -0.97, -0.9, -0.79, -0.79, -0.62, -0.46, -0.3, -0.14, -0.14, 0, 0.14, 0.14, 0.3, 0.46, 0.62, 0.79, 0.79, 0.9, 0.97, 1], HOLE0 = 12, HOLE1 = 16;
/** a body section at x: the top across, then the underside; at a wheel the underside rises into the arch outboard of the well's wall */
function ring(x: number, open = false): V[] { const w = at(HALF, x), zb = at(BOT, x), arch = archZ(x), yin = x < 2200 ? YINF : YINR;
  const top: V[] = U.map((u, i) => [x, u * w, open && i >= HOLE0 && i <= HOLE1 ? FLOOR : skinZ(x, u * w)]);
  const low: [number, number][] = arch ? [[w, arch], [yin, arch], [yin, zb]] : [[0.99 * w, zb + 50], [0.93 * w, zb + 6], [0.8 * w, zb]];
  return [...top, ...low.map(([y, z]) => [x, y, z] as V), ...low.slice().reverse().map(([y, z]) => [x, -y, z] as V)]; }
/** a round pipe through points */
function tube(b: Build, pts: V[], r: number, seg = 8, caps = true) { const n = pts.length;
  b.loft(pts.map((p, i) => { const d = norm(sub(pts[Math.min(n - 1, i + 1)]!, pts[Math.max(0, i - 1)]!)), u = norm(cross(d, Math.abs(d[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1])), v = cross(d, u);
    return Array.from({ length: seg }, (_, k) => { const t = k / seg * Math.PI * 2, c = Math.cos(t) * r, s = Math.sin(t) * r; return [p[0] + u[0] * c + v[0] * s, p[1] + u[1] * c + v[1] * s, p[2] + u[2] * c + v[2] * s] as V; }); }), caps); }
/** a profile turned about the upright axis through o: [height above o, radius] pairs */
function turn(b: Build, o: V, prof: [number, number][], seg = 10, caps = true) { b.loft(prof.map(([a, r]) => Array.from({ length: seg }, (_, i) => { const t = i / seg * Math.PI * 2; return [o[0] + Math.cos(t) * r, o[1] + Math.sin(t) * r, o[2] + a] as V; })), caps); }
/** an oval patch lying on the body's top, `lift` above the skin: lamp covers, the number discs */
function patch(b: Build, cx: number, cy: number, rx: number, ry: number, lift: number, seg = 14) { const p = (f: number, i: number): V => { const t = i / seg * Math.PI * 2, x = cx + Math.cos(t) * rx * f, y = cy + Math.sin(t) * ry * f; return [x, y, skinZ(x, y) + lift]; };
  for (let i = 0; i < seg; i++) { b.tri([cx, cy, skinZ(cx, cy) + lift], p(0.5, i), p(0.5, i + 1)); b.quad(p(0.5, i), p(1, i), p(1, i + 1), p(0.5, i + 1)); } }
/** a line drawn on the body's top from one point to another (a panel's edge) */
function seam(b: Build, x0: number, y0: number, x1: number, y1: number, n = 8, t = 9) { const l = Math.hypot(x1 - x0, y1 - y0) || 1, ox = -(y1 - y0) / l * t / 2, oy = (x1 - x0) / l * t / 2;
  const p = (i: number, k: number): V => { const f = i / n, x = x0 + (x1 - x0) * f + ox * k, y = y0 + (y1 - y0) * f + oy * k; return [x, y, skinZ(x, y) + 3]; }; for (let i = 0; i < n; i++) b.quad(p(i, -1), p(i + 1, -1), p(i + 1, 1), p(i, 1)); }

/** a Dunlop light-alloy disc wheel: a dished disc with a ring of holes, pegs-driven, held by a three-eared spinner */
function wheel(b: Build, x: number, s: 1 | -1, spin = 0) { const wy = x === FX ? WYF : WYR, o: V = [x, s * wy, R], rim = 222, f = s * (TW / 2);
  b.name(x === FX ? 'tyreF' : 'tyreR').mat(RUBBER, 0.05, 'tyre').lathe('y', o, [[-TW / 2, rim], [-TW / 2, R - 50], [-TW / 2 + 42, R], [TW / 2 - 42, R], [TW / 2, R - 50], [TW / 2, rim]], 20, false);
  b.name('rim').mat(ALLOY, 0.6, 'metal').lathe('y', o, [[f, rim + 8], [f * 0.72, rim - 14], [f * 0.5, rim - 30]], 20, false);
  b.name('wheel').mat(ALLOY, 0.5, 'metal').lathe('y', o, [[f * 0.5, rim - 30], [f * 0.58, 150], [f * 0.9, 78], [f * 0.9, 0]], 20, false);   // the disc, dished in to the rim
  b.name('wheel').mat(DARK, 0.05).lathe('y', o, [[-f * 0.6, 0], [-f * 0.6, rim]], 12, false);                                              // its back
  b.name('wheelHole').mat(DARK, 0.05); for (let k = 0; k < 15; k++) { const a = spin + k / 15 * Math.PI * 2, c = Math.cos(a), q = Math.sin(a); b.bar([x + c * 158, s * wy + f * 0.6, R + q * 158], [x + c * 186, s * wy + f * 0.56, R + q * 186], 30, 8); }   // the ring of cooling holes
  b.name('hub').mat(CHROME, 0.9, 'metal').lathe('y', o, [[f * 0.9, 56], [f * 1.2, 46], [f * 1.3, 24], [f * 1.32, 0]], 10, false);
  for (let k = 0; k < 3; k++) { const a = spin + k / 3 * Math.PI * 2; b.bar([x + Math.cos(a) * 24, s * wy + f * 1.24, R + Math.sin(a) * 24], [x + Math.cos(a) * 84, s * wy + f * 1.16, R + Math.sin(a) * 84], 22, 14); }   // the spinner's three ears
}

export function jagDMesh(spin = 0): Mesh { const b = new Build();
  // ---- the body: one skin from the mouth to the tail, the wheel arches cut up into it, the driver's place hollowed ----
  const xs = [5, 30, 80, 150, 250, 380, 500, 1500, 1650, 1800, 1950, 2080, CX0 - 2, CX0, 2300, 2500, 2700, CX1, CX1 + 2, 3750, 3850, 3950, 4050, 4150, 4250, 4330, 4390, 4430, 4455, 4470];
  for (const hx of [FX, RX]) { xs.push(hx - RA - 2, hx + RA + 2); for (let d = 0; d <= 180; d += 20) xs.push(Math.round(hx - RA * Math.cos(d * Math.PI / 180))); }
  xs.sort((p, q) => p - q);
  b.name('body').mat(PAINT, 0.5, 'paint').loft(xs.map(x => ring(x, x >= CX0 && x <= CX1)));
  // the wheel wells: dark behind and over each wheel
  b.name('well').mat(DARK, 0.05); for (const s of [1, -1]) for (const hx of [FX, RX]) { const yin = s * ((hx === FX ? YINF : YINR) + 4), yo = s * (at(HALF, hx) - 40), a = (i: number, y: number): V => { const t = i / 12 * Math.PI; return [hx - Math.cos(t) * (RA - 4), y, R + Math.sin(t) * (RA - 4)]; };
    for (let i = 0; i < 12; i++) { b.tri([hx, yin, R], a(i, yin), a(i + 1, yin)); b.quad(a(i, yin), a(i + 1, yin), a(i + 1, yo), a(i, yo)); }
    b.quad([hx - RA + 4, yin, at(BOT, hx) + 2], [hx + RA - 4, yin, at(BOT, hx) + 2], [hx + RA - 4, yin, R], [hx - RA + 4, yin, R]); }
  // ---- the mouth: a dark oval in the nose ----
  b.name('grille').mat(DARK, 0.05).loft([section(0, 228, 378, 528, 2.4, 2.4, 16), section(20, 228, 378, 528, 2.4, 2.4, 16)]);
  // ---- the lamps in the wings' fronts: a bright bowl and its lens under a clear cover faired into the skin ----
  for (const s of [1, -1]) { const cx = 400, cy = s * 500;
    b.name('lamp').mat(DARK, 0.05); patch(b, cx, cy, 150, 105, 3); b.name('lamp').mat(CHROME, 0.9, 'metal'); patch(b, cx + 10, cy, 96, 88, 6, 12);
    b.name('lens').mat(LENS, 0.6, 'lens'); patch(b, cx + 10, cy, 76, 70, 9, 12); b.name('lampCover').mat(GLASS, 0.5, 'glass'); patch(b, cx, cy, 150, 105, 16); }
  // ---- the panels' edges: the bonnet's back edge, the cover over the passenger's side, the driver's door, louvres ----
  b.name('hood').mat(SEAM, 0.1); seam(b, 2085, -770, 2085, 770, 20);
  seam(b, 2200, -130, 2200, -640, 5); seam(b, 2200, -640, 2830, -640, 5); seam(b, 2830, -640, 2830, -130, 5); seam(b, 2830, -130, 2200, -130, 5);
  for (const s of [1, -1]) for (let k = 0; k < 9; k++) { const x = 1480 + k * 52; seam(b, x, s * 150, x, s * 300, 2, 16); }
  { const y = (x: number, z: number) => sideY(x, z) + 2; for (const x of [2260, 2800]) b.quad([x, y(x, 250), 250], [x + 9, y(x, 250), 250], [x + 9, y(x, 600), 600], [x, y(x, 600), 600]); b.quad([2260, y(2260, 250), 250], [2800, y(2800, 250), 250], [2800, y(2800, 259), 259], [2260, y(2260, 259), 259]); }
  b.name('strap').mat('#6b4a2c', 0.2, 'leather'); for (const s of [1, -1]) b.bar([2050, s * (sideY(2050, 640) + 4), 640], [2125, s * (sideY(2125, 640) + 4), 640], 30, 10);   // the bonnet's leather straps
  // ---- the number discs: on the bonnet, on each side behind the front wheel, on the tail ----
  // the number discs: decals laid on the paint, not parts (review 95), each read as on the works cars: the bonnet's
  // from in front of the car (the oncoming car told at a glance), the tail's from behind, each side's from that side
  const disc = { col: WHITE, text: NUMBER, ink: '#141414', num: true };
  b.decal({ ...disc, o: [1130, 0, skinZ(1130, 0)], n: [0, 0, 1], up: [1, 0, 0], r: 215 });
  b.decal({ ...disc, o: [3500, -330, skinZ(3500, -330)], n: [0, 0, 1], up: [-1, 0, 0], r: 190 });
  for (const s of [1, -1]) b.decal({ ...disc, o: [1810, s * sideY(1810, 500), 500], n: [0, s, 0], up: [0, 0, 1], r: 185 });
  // ---- the driver's place: a dark floor and dash, the seat, the headrest pad ----
  { const w = at(HALF, 2500), y0 = 0.14 * w + 3, y1 = 0.79 * w - 3;
    b.name('cockpit').mat(DARK, 0.05).box(CX0 + 2, CX1 - 2, y0, y1, FLOOR - 8, FLOOR + 3);
    b.name('cockpit').mat('#2a2d2b', 0.15).box(CX0 + 1, CX0 + 14, y0, y1, FLOOR, 700); b.mat('#d8d2bf', 0.4); for (const y of [DY - 90, DY + 70]) b.lathe('x', [0, y, 640], [[CX0 + 14, 0], [CX0 + 18, y > DY ? 60 : 44]], 10, false);   // the dash and its dials
    b.name('seat').mat(LEATHER, 0.25, 'leather').box(2470, 2790, y0 + 30, y1 - 30, FLOOR, 440).loft(([[2740, 440], [2790, 600], [2822, 730], [CX1 - 3, 760]] as const).map(([x, z]) => [[x, y0 + 20, FLOOR], [x, y1 - 20, FLOOR], [x, y1 - 20, z], [x, y0 + 20, z]] as V[]));
    b.name('seat').mat(LEATHER2, 0.1); for (const y of [DY - 110, DY, DY + 110]) b.bar([2480, y, 442], [2740, y, 442], 8).bar([2792, y, 604], [2824, y, 730], 8); }
  // ---- behind the driver: the headrest's fairing down the tail and the fin standing on it ----
  const shift = (r: V[], dy: number) => r.map(p => [p[0], p[1] + dy, p[2]] as V);
  const head: [number, number, number][] = [[CX1 + 4, 200, 968], [3000, 196, 962], [3300, 165, 905], [3650, 120, 820], [4000, 75, 725], [4300, 30, 640]];
  b.name('headFairing').mat(PAINT, 0.5, 'paint').loft(head.map(([x, w, zt]) => shift(section(x, w, at(DECK, x) - 80, zt, 2.4, 6, 12), DY)));
  b.name('headrest').mat(LEATHER, 0.25, 'leather').loft([shift(section(CX1 - 12, 135, 790, 950, 2.4, 2.4, 12), DY), shift(section(CX1 + 6, 150, 780, 958, 2.4, 2.4, 12), DY)]);
  const fin: [number, number, number][] = [[2930, 940, 968], [3080, 900, 1052], [3250, 860, 1104], [3420, 820, 1118], [3700, 760, 1082], [4000, 690, 985], [4250, 620, 850], [4400, 560, 700], [4450, 530, 610]];
  b.name('fin').mat(PAINT, 0.5, 'paint').loft(fin.map(([x, zb, zt]) => [[x, DY - 22, zb], [x, DY + 22, zb], [x, DY + 7, zt], [x, DY - 7, zt]] as V[]));
  // ---- the screen: one sheet of perspex wrapped round the driver, leaning in, on a thin bright foot ----
  { const plan: [number, number, number][] = [[2430, 95, 50], [2250, 100, 150], [2160, 170, 205], [2118, 370, 228], [2150, 560, 220], [2240, 668, 195], [2450, 690, 150], [2720, 690, 95]];
    const foot: V[] = plan.map(([x, y]) => [x, y, skinZ(x, y) - 4]), top: V[] = plan.map(([x, y, h], i) => { const dx = 2520 - x, dy = DY - y, l = Math.hypot(dx, dy) || 1, k = h * 0.28; return [x + dx / l * k, y + dy / l * k, foot[i]![2] + h]; });
    b.name('screenPane').mat(GLASS, 0.5, 'glass'); for (let i = 0; i + 1 < plan.length; i++) b.quad(foot[i]!, foot[i + 1]!, top[i + 1]!, top[i]!);
    b.name('screenFrame').mat(CHROME, 0.9, 'metal'); for (let i = 0; i + 1 < plan.length; i++) b.bar([foot[i]![0], foot[i]![1], foot[i]![2] + 6], [foot[i + 1]![0], foot[i + 1]![1], foot[i + 1]![2] + 6], 14); }
  b.name('mirror').mat(CHROME, 0.9, 'metal').bar([2060, DY, skinZ(2060, DY)], [2060, DY, skinZ(2060, DY) + 70], 12).lathe('x', [0, DY, skinZ(2060, DY) + 95], [[2040, 20], [2062, 46], [2068, 46]], 10);
  // ---- small things: the fuel filler, the tail lamps, the exhaust's two pipes under the left sill ----
  b.name('filler').mat(CHROME, 0.9, 'metal'); turn(b, [3900, -300, skinZ(3900, -300) - 4], [[0, 50], [16, 50], [24, 38]], 10);
  for (const s of [1, -1]) { const x = 4405, y = s * (at(HALF, x) - 60); b.name('tailRim').mat(CHROME, 0.9, 'metal').lathe('x', [0, y, 500], [[x - 10, 34], [x + 22, 34]], 8); b.name('tail').mat(RED, 0.5, 'lens').lathe('x', [0, y, 500], [[x + 22, 28], [x + 34, 16], [x + 36, 0]], 8, false); }
  b.name('exhaust').mat(CHROME, 0.9, 'metal'); for (const z of [150, 215]) tube(b, [[2150, -(at(HALF, 2150) - 70), z + 20], [2350, -(at(HALF, 2350) - 18), z], [2880, -(at(HALF, 2880) - 14), z]], 29, 8);
  b.name('chassis').mat(DARK, 0.05).bar([FX, -WYF, R], [FX, WYF, R], 50).bar([RX, -WYR, R], [RX, WYR, R], 70);   // the axles' lines through the wells
  for (const s of [1, -1] as const) { wheel(b, FX, s, spin); wheel(b, RX, s, spin); }
  return b.mesh(L); }
export const mesh = jagDMesh;
