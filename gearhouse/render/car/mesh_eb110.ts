// The 1991-95 Bugatti EB110 GT as a low-polygon mesh (docs/systems/70_mesh_car_rules.md), rebuilt from the user's
// reference sheet docs/reference/eb110_xj220_sheet.png (left column: front, rear, both sides, top, underside).
//
// Real figures (web search, the sources agreeing unless noted):
//   length 4400, wheelbase 2550, front track 1550, rear track 1618 mm  - auto-data.net, carsales.com.au, cararac.com
//     (supercars.net / conceptcarz give the front track as 1549; the often quoted 1600 rear track was not confirmed)
//   width 1940 mm                                                       - auto-data.net, Wikipedia (1960 on carsales
//     and ultimatespecs is the Super Sport's figure: "the same as the GT's except the width and the rear track")
//   height 1125 mm                                                      - auto-data.net, carsales (Wikipedia 1114-1125,
//     supercars.net 1115)
//   tyres 245/40 ZR18 front, 325/30 ZR18 rear on 18x9 and 18x12 BBS wheels - carsales, conceptcarz (radius 326 mm)
//   scissor doors, a glazed engine cover, a wing in the tail raised at speed or by a switch (GT; the SS's is fixed),
//   fixed lamps instead of the prototypes' pop-ups                      - Wikipedia, supercars.net, Bugatti newsroom
//   No source gave the overhangs or the ground clearance: those are the sheet's.
//
// Read off the sheet (pixels; X(), Y() and Z() turn them into mm): the side view's silhouette (TOP = DECK + WNG), the
// shoulder line (EDGE) and the underside (BOT) at 2.667 mm a pixel along (4400 mm over 1650 px), the axles at 410 and
// 1383 px (973 px = 2595 mm: closed up to the real 2550, the 45 mm shared between the overhangs: 1120 front, 730
// rear), heights x1.031 (the sheet's roof stands 409 px = 1091 mm; the real 1125 is used); the plan's half-widths
// (HALF: the plan is drawn 6 % narrow, 681 px = 1816 mm, so it is scaled to the real 1940, as the front view has it:
// 737 px = 1966 mm); the screen's base arc, the roof panel, the louvred quarter lights, the slatted engine cover, the
// panel line and the slot in the tail from the top view; the lamps, the horseshoe and the intakes from the front view;
// the lamps, the grille band, the valance and the pipes from the rear view. The wheels are the real size (the sheet
// draws the rims large). `wing` 0: the blade lies flush in the tail .. 1: 110 mm up, its trailing edge raised.
import { Build, type Mesh, type V } from './mesh';

const PAINT = '#1f3fb8', SEAM = '#0d1c5c', FRAME = '#17181c', TRIM = '#2a2c33', SEAT = '#9c9da2', SEAT2 = '#7d7e84', GLASS = '#a9c2cc', SILVER = '#c9ccd0', CHROME = '#d4d6d9', RUBBER = '#26242b', DARK = '#131318', LENS = '#eef0f2', RED = '#c9221f', AMBER = '#e8901c';
const L = 4400, FX = 1120, RX = FX + 2550, R = 326, WYF = 775, WYR = 809, TWF = 245, TWR = 316;   // the axles, the tyres' radius, half the tracks, the tyres' widths
const RAF = 356, RAR = 372, YINF = 620, YINR = 630;                                                 // the wheel arches' radii (132 and 140 px); the wells' inner walls
/** the sheet's pixels to mm: along the car from the nose (the wheelbase closed up to the real one), up from the ground, across from the centre line (plan) */
const X = (px: number) => px < 410 ? px * FX / 410 : px < 1383 ? FX + (px - 410) * 2550 / 973 : RX + (px - 1383) * (L - RX) / 267;
const Z = (px: number) => px * 2.75, Y = (px: number) => px * 2.853;
const tab = (t: [number, number][], fv: (v: number) => number) => t.map(([x, v]) => [X(x), fv(v)] as [number, number]);
/** linear reading of a table of [x, value] */
const at = (t: [number, number][], x: number) => { if (x <= t[0]![0]) return t[0]![1]; for (let i = 1; i < t.length; i++) if (x <= t[i]![0]) { const [x0, v0] = t[i - 1]!, [x1, v1] = t[i]!; return v0 + (v1 - v0) * (x - x0) / (x1 - x0); } return t[t.length - 1]![1]; };
// the body along the car, in the sheet's pixels: half-width (plan); the shoulder (the widest line's height); the
// underside; the top on the centre line (the nose's wedge, then the waist under the glass, then the tail's deck); how
// far the front wings' crests stand above it
const NOSE: [number, number][] = [[2, 126], [31, 230], [61, 256], [91, 277], [121, 290], [151, 305], [181, 310], [211, 322], [241, 330], [271, 335]];
const TAIL: [number, number][] = [[1440, 340], [1470, 338], [1500, 333], [1530, 326], [1560, 318], [1590, 306], [1610, 290], [1630, 265]];
const HALF = tab([...NOSE, [480, 335], [540, 333], [840, 333], [930, 338], [1000, 340], ...TAIL], Y);
const EDGE = tab([[2, 98], [30, 110], [150, 170], [270, 222], [345, 245], [420, 258], [1000, 264], [1060, 280], [1200, 292], [1500, 295], [1590, 285], [1630, 268]], Z);
const BOT = tab([[2, 29], [540, 29], [600, 35], [1250, 38], [1598, 40], [1630, 120]], Z);
const DECK = tab([[2, 112], [30, 128], [345, 238], [455, 270], [600, 276], [880, 282], [1040, 295], [1060, 317], [1300, 326], [1380, 332], [1500, 332], [1530, 323], [1560, 315], [1590, 303], [1620, 281], [1630, 276]], Z);
const WNG = tab([[2, 0], [30, 3], [150, 46], [270, 64], [345, 58], [420, 27], [455, 12], [520, 0], [1630, 0]], Z);
const X0 = X(2), X1 = X(1630);                                           // the skin's first and last sections (the splitter and the bumper stand out to 0 and L)
const FLOOR = 210, CX0 = X(548), CX1 = X(1040);                          // the cabin's hollow: its floor, front (behind the front arch) and back (the door's rear edge)
const SX0 = X(625), SX1 = X(1128), ST = Z(164), SB = Z(69);              // the scallop along the flank into the intake ahead of the rear wheel
const P = 6, FOOT = 0.87, WALL = 0.84;                                   // how square the shoulders are; where the glass stands and the cabin's wall, as parts of the half-width
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = (a: V): V => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a: V, b: V, f: number): V => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
/** the wheel arch's height at x: a half circle over each hub (0 away from the wheels) */
const archZ = (x: number) => { for (const [hx, ra] of [[FX, RAF], [RX, RAR]] as const) { const dx = x - hx; if (Math.abs(dx) <= ra + 1e-6) return R + Math.sqrt(Math.max(0, ra * ra - dx * dx)); } return 0; };
/** how deep the flank's scallop is at x: from nothing behind the front wheel to the intake's mouth */
const dep = (x: number) => x < SX0 || x > SX1 ? 0 : Math.min(72, 24 + (x - SX0) * 48 / (X(1100) - SX0));
/** the skin's height at y across the body at x: the centre line's and the wings' crests, rolled over to the shoulder */
const skinZ = (x: number, y: number) => { const w = at(HALF, x), u = Math.min(1, Math.abs(y) / w), ze = Math.max(at(EDGE, x), archZ(x));
  const h = at(DECK, x) + at(WNG, x) * Math.exp(-(((u - 0.93) / 0.07) ** 2)); return ze + (h - ze) * (1 - u ** P) ** (1 / P); };
/** the skin's distance from the centre line at height z on the body's side at x (into the scallop where it runs) */
const sideY = (x: number, z: number) => { const w = at(HALF, x), ze = at(EDGE, x); if (z <= ze) return w - (z < ST - 6 && z > SB + 6 ? dep(x) : 0);
  let lo = 0.6 * w, hi = w; for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (skinZ(x, m) > z) lo = m; else hi = m; } return (lo + hi) / 2; };
// where the body's sections have their points across the top, as parts of the half-width; the doubled one is the
// cabin's wall, so it stands upright
const U = [-1, -0.985, -0.95, -0.9, -WALL, -WALL, -0.5, 0, 0.5, WALL, WALL, 0.9, 0.95, 0.985, 1];
const cab = (x: number) => x >= CX0 && x <= CX1;
/** a body section at x: the top across, then down one side (flank, scallop, sill, floor) and up the other; at a wheel it rises into the arch outboard of the well's wall */
function ring(x: number): V[] { const w = at(HALF, x), zb = at(BOT, x), ze = at(EDGE, x), arch = archZ(x), yin = x < 2400 ? YINF : YINR, c = cab(x), d = dep(x);
  const top: V[] = U.map((u, i) => [x, u * w, c && i >= 5 && i <= 9 ? FLOOR : skinZ(x, u * w)]);
  const sb = Math.max(Math.min(SB, ze - 20), zb + 60), st = Math.max(Math.min(ST, ze - 10), sb + 5);
  const low: [number, number][] = arch ? [[w, arch], [w, arch], [w, arch], [w, arch], [w, arch], [yin, arch], [yin, zb]]
    : [[w, st], [w - d, st - d * 0.25], [w - d, sb + d * 0.25], [w, sb], [0.995 * w, zb + 45], [0.97 * w, zb + 8], [0.9 * w, zb]];
  return [...top, ...low.map(([y, z]) => [x, y, z] as V), ...low.slice().reverse().map(([y, z]) => [x, -y, z] as V)]; }
/** the part a piece of the skin belongs to: `xm` the middle of its two sections, `i` its place round the section */
function partOf(xm: number, i: number, open: boolean, arch: boolean): string {
  if (arch && i >= 19 && i <= 23) return 'chassis'; if (i >= 20 && i <= 22) return xm > X(1598) ? 'bumperR' : 'chassis'; if (i === 18 || i === 19 || i === 23 || i === 24) return 'sill';
  if (open && i >= 4 && i <= 9) return 'cockpit'; if (xm < X(31)) return 'bumperF'; if (xm > X(1610)) return 'bumperR';
  const outer = i <= 3 || i >= 10; if (xm < X(345)) return outer ? 'fenderF' : 'hood'; if (xm < X(455)) return outer ? 'fenderF' : 'body'; if (xm < X(1040)) return outer ? 'door' : 'body'; return outer ? 'fenderR' : 'body'; }
/** a patch lying on the body's top between x0..x1 and y0..y1, `lift` above the skin, in nx by ny pieces */
function lay(b: Build, x0: number, x1: number, y0: number, y1: number, lift: number, nx = 2, ny = 2) { const p = (i: number, j: number): V => { const x = x0 + (x1 - x0) * i / nx, y = y0 + (y1 - y0) * j / ny; return [x, y, skinZ(x, y) + lift]; };
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) b.quad(p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)); }
/** a flat shape laid on the body's flank, `lift` off the skin: [x, z] points round it (side `s`) */
function flank(b: Build, s: number, pts: [number, number][], lift = 4) { const q: V[] = pts.map(([x, z]) => [x, s * (sideY(x, z) + lift), z]), m: V = [0, 0, 0]; for (const p of q) { m[0] += p[0] / q.length; m[1] += p[1] / q.length; m[2] += p[2] / q.length; }
  m[1] = s * (sideY(m[0], m[2]) + lift); for (let i = 0; i < q.length; i++) b.tri(m, q[i]!, q[(i + 1) % q.length]!); }
/** a shut line on the flank through [x, z] points */
function seam(b: Build, s: number, pts: [number, number][], wd = 9) { for (let i = 0; i + 1 < pts.length; i++) { const [xa, za] = pts[i]!, [xb, zb] = pts[i + 1]!, l = Math.hypot(xb - xa, zb - za) || 1, nx = -(zb - za) / l * wd / 2, nz = (xb - xa) / l * wd / 2;
  const p = (x: number, z: number): V => [x, s * (sideY(x, z) + 2.5), z]; b.quad(p(xa - nx, za - nz), p(xb - nx, zb - nz), p(xb + nx, zb + nz), p(xa + nx, za + nz)); } }
/** how far back the nose's skin stands at y across it; the same for the tail (from the plan) */
const NOSEX = NOSE.map(([x, v]) => [Y(v), X(x)] as [number, number]), TAILX = TAIL.map(([x, v]) => [Y(v), X(x)] as [number, number]).reverse();
const noseX = (y: number) => at(NOSEX, Math.abs(y)), tailX = (y: number) => at(TAILX, Math.abs(y));
/** a panel on the nose's face (`end` 0) or the tail's (1), side `s`, y0..y1 from the centre line, z0..z1, `lift` proud of the skin: it follows the plan round the corners */
function face(b: Build, end: 0 | 1, s: number, y0: number, y1: number, z0: number, z1: number, lift: number) { const T = end ? TAILX : NOSEX, fx = (y: number) => end ? tailX(y) + lift : noseX(y) - lift;
  const ys = [y0, ...T.map(t => t[0]).filter(y => y > y0 + 1 && y < y1 - 1), y1]; for (let i = 0; i + 1 < ys.length; i++) { const ya = ys[i]!, yb = ys[i + 1]!; b.quad([fx(ya), s * ya, z0], [fx(yb), s * yb, z0], [fx(yb), s * yb, z1], [fx(ya), s * ya, z1]); } }
/** the horseshoe's outline at x: half-width w, from zb up to zt (an arch over straight sides drawing in to the foot) */
const shoe = (x: number, w: number, zb: number, zt: number): V[] => { const out: V[] = [[x, -w * 0.8, zb], [x, w * 0.8, zb]], zc = zt - w; for (let k = 0; k <= 8; k++) { const t = k / 8 * Math.PI; out.push([x, Math.cos(t) * w, zc + Math.sin(t) * w]); } return out; };
/** an oval facing backwards at x */
function oval(b: Build, x: number, y: number, z: number, ry: number, rz: number, seg = 12) { for (let i = 0; i < seg; i++) { const a = i / seg * Math.PI * 2, c = (i + 1) / seg * Math.PI * 2; b.tri([x, y, z], [x, y + Math.cos(a) * ry, z + Math.sin(a) * rz], [x, y + Math.cos(c) * ry, z + Math.sin(c) * rz]); } }

/** an 18 inch BBS wheel as the sheet draws it: a bright lip, a ring of holes round a smooth dished centre, a small dark cap; a low tyre */
function wheel(b: Build, x: number, s: 1 | -1, spin = 0) { const front = x === FX, wy = front ? WYF : WYR, tw = front ? TWF : TWR, o: V = [x, s * wy, R], rim = 246, h = tw / 2, f = s * h, N = 16;
  b.name(front ? 'tyreF' : 'tyreR').mat(RUBBER, 0.05, 'tyre').lathe('y', o, [[-h, rim], [-h, R - 30], [-h + 28, R], [h - 28, R], [h, R - 30], [h, rim]], 24, false);
  b.name('rim').mat(SILVER, 0.8, 'metal').lathe('y', o, [[f, rim + 5], [f - s * 8, rim - 8], [f - s * 30, rim - 22], [f - s * 36, rim - 30]], 24, false);                        // the lip and the barrel
  b.name('wheel').mat(DARK, 0.05).lathe('y', o, [[f - s * 44, rim - 28], [f - s * 44, 0]], 16, false).lathe('y', o, [[-f * 0.7, 0], [-f * 0.7, rim]], 12, false);       // the dark behind the holes; the wheel's back
  b.name('spoke').mat(SILVER, 0.5); for (let k = 0; k < N; k++) { const a = spin + (k + 0.5) / N * Math.PI * 2, c = Math.cos(a), q = Math.sin(a), y = s * wy + f - s * 36; b.bar([x + c * 160, y, R + q * 160], [x + c * (rim - 26), y, R + q * (rim - 26)], 10, 46); }   // the webs between the holes
  b.name('spoke').mat(SILVER, 0.5).lathe('y', o, [[f - s * 37, 174], [f - s * 30, 118], [f - s * 33, 46]], 16, false);                                                         // the smooth dished centre
  b.name('hub').mat(FRAME, 0.3).lathe('y', o, [[f - s * 33, 46], [f - s * 36, 0]], 12, false);
  b.name('hub').mat(SILVER, 0.7).lathe('y', o, [[f - s * 37, 22], [f - s * 39, 0]], 8, false);
}

export function eb110Mesh(spin = 0, wing = 0): Mesh { const b = new Build(); wing = Math.max(0, Math.min(1, wing));
  // ---- the body: one skin from the nose to the tail, the arches cut up into it, the cabin hollowed; each panel its own part ----
  const xs = [...NOSE.map(p => X(p[0])), ...TAIL.map(p => X(p[0])), CX0 - 2, CX0, X(600), SX0 - 2, SX0, X(700), X(790), X(880), X(960), X(1000), CX1, CX1 + 2, X(1060), X(1100), SX1, SX1 + 2, X(1200), X(1598)];
  for (const [hx, ra] of [[FX, RAF], [RX, RAR]] as const) { xs.push(hx - ra - 2, hx + ra + 2); for (let d = 0; d <= 180; d += 15) xs.push(Math.round(hx - ra * Math.cos(d * Math.PI / 180))); }
  xs.sort((p, q) => p - q);
  { const rings = xs.map(x => ring(x)), K = rings[0]!.length, parts = new Map<string, [V, V, V, V][]>(), same = (p: V, q: V) => Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) < 0.01;
    for (let r = 0; r + 1 < rings.length; r++) { const A = rings[r]!, B = rings[r + 1]!, xa = xs[r]!, xb = xs[r + 1]!, oc = cab(xa) || cab(xb), ar = archZ(xa) > 0 || archZ(xb) > 0;
      for (let i = 0; i < K; i++) { const j = (i + 1) % K; if (same(A[i]!, A[j]!) && same(B[i]!, B[j]!)) continue; const nm = partOf((xa + xb) / 2, i, oc, ar); if (!parts.has(nm)) parts.set(nm, []); parts.get(nm)!.push([A[i]!, A[j]!, B[j]!, B[i]!]); } }
    for (const [nm, qs] of parts) { if (nm === 'chassis') b.name(nm).mat(DARK, 0.05); else if (nm === 'cockpit') b.name(nm).mat(TRIM, 0.1); else b.name(nm).mat(PAINT, 0.6, 'paint');
      for (const q of qs) b.quad(...q); }
    for (const [nm, Rg] of [['bumperF', rings[0]!], ['bumperR', rings[rings.length - 1]!]] as const) { b.name(nm).mat(PAINT, 0.6, 'paint'); const m: V = [Rg[0]![0], 0, 0]; for (const p of Rg) m[2] += p[2] / Rg.length; for (let i = 0; i < K; i++) b.tri(m, Rg[i]!, Rg[(i + 1) % K]!); } }
  b.name('chassis').mat(DARK, 0.05).bar([FX, -WYF, R], [FX, WYF, R], 60).bar([RX, -WYR, R], [RX, WYR, R], 80);   // the axles' lines through the wells
  // ---- the nose (front view): the small horseshoe low at the tip between two barred intakes, a duct in each corner, the badge, the splitter ----
  b.name('grille').mat(PAINT, 0.6, 'paint').loft([shoe(X0 - 4.5, 60, 118, 300), shoe(X0 + 1, 60, 118, 300)]);
  b.name('core').mat(DARK, 0.1, 'grille').loft([shoe(X0 - 5, 46, 128, 288), shoe(X0 + 1, 46, 128, 288)]);
  for (const s of [1, -1]) { b.name('grille').mat(DARK, 0.05); face(b, 0, s, 100, 527, 128, 268, 3); face(b, 0, s, 580, 790, 150, 282, 4);
    b.name('grille').mat(PAINT, 0.6, 'paint'); for (const z of [221, 168]) face(b, 0, s, 100, 527, z - 7, z + 7, 5);                      // the intake's two bars
    b.name('lens').mat(AMBER, 0.5, 'lens'); lay(b, 300, 350, s * 705, s * 750, 5, 1, 1); flank(b, s, [[X(200), Z(137)], [X(232), Z(137)], [X(232), Z(147)], [X(200), Z(147)]]); }   // the turn lamps beside the head lamps; the side repeaters
  b.name('grille').mat(RED, 0.5); { const cx = X0 + 50, p = (i: number): V => { const a = i / 10 * Math.PI * 2, x = cx + Math.cos(a) * 22, y = Math.sin(a) * 44; return [x, y, skinZ(x, y) + 4]; }; for (let i = 0; i < 10; i++) b.tri([cx, 0, skinZ(cx, 0) + 4], p(i), p(i + 1)); }   // the red oval badge
  b.name('bumperF').mat(PAINT, 0.6, 'paint').loft([-732, -656, -360, 360, 656, 732].map(y => { const x = noseX(y) - X0; return [[x, y, 72], [x + 70, y, 72], [x + 70, y, 90], [x, y, 90]] as V[]; }));   // the splitter's lip
  // ---- the head lamps (top and front views): two square lamps side by side in each corner of the nose, under a clear cover flush with the skin ----
  for (const s of [1, -1]) { b.name('lamp').mat(DARK, 0.05); lay(b, 306, 572, s * 335, s * 688, 3);
    b.tri([306, s * 335, skinZ(306, 335) + 3], [306, s * 250, skinZ(306, 250) + 3], [420, s * 335, skinZ(420, 335) + 3]);                 // the pocket's dark point towards the centre
    for (const [ya, yb] of [[350, 506], [516, 672]] as const) { b.name('lamp').mat(CHROME, 0.9, 'metal'); lay(b, 316, 562, s * ya, s * yb, 6, 1, 1); b.name('lens').mat(LENS, 0.6, 'lens'); lay(b, 328, 550, s * (ya + 12), s * (yb - 12), 9, 1, 1); }
    b.name('lampCover').mat(GLASS, 0.5, 'glass'); lay(b, 306, 572, s * 335, s * 688, 15);
    b.name('fenderF').mat(SEAM, 0.2); lay(b, X(248), X(302), s * Y(258), s * Y(298), 4, 2, 1); }                                         // the brake vents on the wings' tops
  // ---- the glasshouse: sections from the screen's base over the roof and down the engine cover to the deck ----
  // each: the centre's x, how far back its corners are swept, the cant rail's half-width and height, the crown's height, the foot's x
  const G: [number, number, number, number, number, number][] = [[X(345), X(480) - X(345), 725, 0, 0, X(540)], [X(724), X(775) - X(724), 520, Z(378), Z(387), X(700)], [X(810), 0, 528, Z(384), Z(403), X(810)],
    [X(900), 0, 532, Z(388), Z(409), X(900)], [X(1040), 0, 532, Z(387), Z(408), X(1040)], [X(1060), 0, 536, Z(396), Z(403), X(1060)], [X(1140), 0, 536, Z(389), Z(395), X(1140)],
    [X(1260), 0, 536, Z(374), Z(379), X(1260)], [X(1330), 0, 536, Z(355), Z(358), X(1330)], [X(1382), 0, 536, 0, 0, X(1382)]];
  const footY = (k: number, xf: number) => (k >= 5 ? [0.83, 0.8, 0.78, 0.775, 0.775][k - 5]! : FOOT) * at(HALF, xf);
  const sec = ([x, bow, yt, zt, zc, xf]: [number, number, number, number, number, number], k: number): V[] => { const yf = footY(k, xf), foot = (s: number): V => [xf, s * yf, skinZ(xf, yf) - 2];
    const top = [-1, -0.74, -0.4, 0, 0.4, 0.74, 1].map(u => { const y = u * yt, px = x + bow * Math.abs(u) ** 3; return [px, y, zt ? zt + (zc - zt) * (1 - u * u) : skinZ(px, y) + (k ? 6 : 3)] as V; }); return [foot(-1), ...top, foot(1)]; };
  const C = G.map(sec), NC = C.length;
  const band = (k: number, i: number, dz = 0) => { const A = C[k]!, B = C[k + 1]!, d = (p: V): V => [p[0], p[1], p[2] + dz]; b.quad(d(A[i]!), d(A[i + 1]!), d(B[i + 1]!), d(B[i]!)); };
  b.name('screenPane').mat(GLASS, 0.5, 'glass'); for (let i = 1; i <= 6; i++) band(0, i);                                                    // the windscreen, wrapped round to the pillars
  b.name('screenPane').mat(GLASS, 0.5, 'glass'); for (const k of [1, 2, 3]) for (const i of [0, 7]) band(k, i); for (const i of [0, 8]) b.tri(C[0]![i]!, C[1]![i ? 7 : 1]!, C[1]![i]!);   // the side windows, a point at the front
  b.name('body').mat(PAINT, 0.6, 'paint'); for (let k = 1; k < NC - 1; k++) for (let i = 1; i <= 6; i++) band(k, i); for (const k of [4, 8]) for (const i of [0, 7]) band(k, i); for (const i of [0, 8]) b.tri(C[0]![i]!, C[0]![i ? 7 : 1]!, C[1]![i ? 7 : 1]!);   // the roof and the engine cover's frame; the pillar behind the door
  b.name('cockpit').mat(DARK, 0.05); for (const k of [1, 2, 3]) for (let i = 1; i <= 6; i++) band(k, i, -14);                                // the headliner
  // the louvred quarter lights: dark glass leaning in to the cover's edge, five panes between body-colour slats
  { const q = (k: number, i: number, f: number, g: number, off: number): V => { const A = C[k]!, B = C[k + 1]!, lo = lerp(A[i ? 8 : 0]!, B[i ? 8 : 0]!, f), hi = lerp(A[i ? 7 : 1]!, B[i ? 7 : 1]!, f), p = lerp(lo, hi, g); return [p[0], p[1] + (i ? 1 : -1) * off, p[2] + off * 0.6]; };
    b.name('screenPane').mat(DARK, 0.5); for (const k of [5, 6]) for (const i of [0, 7]) band(k, i); for (const i of [0, 1]) b.tri(q(7, i, 0, 0, 0), q(7, i, 0, 1, 0), q(7, i, 0.8, 0, 0));
    b.name('body').mat(PAINT, 0.6, 'paint'); for (const i of [0, 1]) { b.quad(q(7, i, 0, 1, 0), q(7, i, 1, 1, 0), q(7, i, 1, 0, 0), q(7, i, 0.8, 0, 0));
      for (const [k, f] of [[5, 0], [5, 0.56], [6, 0.08], [6, 0.46], [6, 0.83]] as const) b.bar(q(k, i, f, 0.03, 6), q(k, i, f, 0.97, 6), 22, 12); b.bar(q(7, i, 0.02, 0.03, 6), q(7, i, 0.02, 0.9, 6), 22, 12);
      for (const k of [5, 6]) { b.bar(q(k, i, 0, 0, 6), q(k, i, 1, 0, 6), 20, 12); b.bar(q(k, i, 0, 1, 6), q(k, i, 1, 1, 6), 26, 12); } } }
  // the slatted engine cover (top view): six dark slots across between body-colour slats, in a frame that widens to the back
  { const ex0 = X(1090), ex1 = X(1345), hw = (x: number) => Y(128) + (Y(143) - Y(128)) * (x - ex0) / (ex1 - ex0);
    const roof = (x: number, y: number, lift: number): V => { let k = 5; while (k < NC - 2 && C[k + 1]![4]![0] < x) k++; const f = (x - C[k]![4]![0]) / (C[k + 1]![4]![0] - C[k]![4]![0]); return [x, y, C[k]![4]![2] + (C[k + 1]![4]![2] - C[k]![4]![2]) * f + lift]; };
    const xsE = [ex0, X(1140), X(1260), X(1330), ex1]; b.name('grille').mat(DARK, 0.05); for (let i = 0; i + 1 < xsE.length; i++) { const xa = xsE[i]!, xb = xsE[i + 1]!; b.quad(roof(xa, -hw(xa), 3), roof(xa, hw(xa), 3), roof(xb, hw(xb), 3), roof(xb, -hw(xb), 3)); }
    b.name('body').mat(PAINT, 0.6, 'paint'); for (let i = 0; i <= 6; i++) { const x = ex0 + (ex1 - ex0) * i / 6; b.bar(roof(x, -hw(x) - 8, 7), roof(x, hw(x) + 8, 7), i === 0 || i === 6 ? 30 : 22, 12); }
    for (const s of [1, -1]) for (let i = 0; i + 1 < xsE.length; i++) { const xa = xsE[i]!, xb = xsE[i + 1]!; b.bar(roof(xa, s * hw(xa), 7), roof(xb, s * hw(xb), 7), 24, 12); } }
  // the frames: the screen's pillars and header, the rail over the doors, the waist under the glass, the door glass's divider
  b.name('screenFrame').mat(FRAME, 0.2); for (const i of [1, 7]) { b.bar(C[0]![i]!, C[1]![i]!, 44, 22); for (let k = 1; k < 4; k++) b.bar(C[k]![i]!, C[k + 1]![i]!, 24, 14); }
  for (let i = 1; i < 7; i++) { b.bar(C[1]![i]!, C[1]![i + 1]!, 30, 12); b.bar(C[0]![i]!, C[0]![i + 1]!, 26, 10); }
  for (const i of [0, 8]) { for (let k = 0; k < 4; k++) b.bar(C[k]![i]!, C[k + 1]![i]!, 18, 14); b.bar(C[1]![i]!, C[1]![i ? 7 : 1]!, 22, 12); b.bar(C[4]![i]!, C[4]![i ? 7 : 1]!, 30, 14); }
  // ---- the cabin: the dash under the screen, the tunnel, the doors' linings, two seats in grey leather, the wall behind them ----
  { const w = WALL * at(HALF, X(800)) - 4, xb = (y: number) => G[0]![0] + G[0]![1] * Math.abs(y / 725) ** 3 + 14, ys = [-700, -537, -290, 0, 290, 537, 700];
    b.name('cockpit').mat(DARK, 0.05); for (let i = 0; i + 1 < ys.length; i++) { const ya = ys[i]!, yb = ys[i + 1]!, p = (x: number, y: number): V => [x, y, skinZ(x, y) + 2]; b.quad(p(xb(ya), ya), p(xb(yb), yb), p(CX0 + 4, yb), p(CX0 + 4, ya)); }   // the dash top
    b.name('cockpit').mat(TRIM, 0.1).box(CX0, CX0 + 190, -w, w, FLOOR, 735);                                                                 // the dash's face
    b.name('cockpit').mat(TRIM, 0.15).box(CX0 + 190, CX1 - 20, -100, 100, FLOOR, 430); for (const s of [1, -1]) b.box(CX0 + 2, CX1 - 2, s * (w - 14), s * w, FLOOR, 730);   // the tunnel; the doors' inner faces
    b.name('cockpit').mat(TRIM, 0.1).box(CX1 - 16, CX1 - 2, -w, w, FLOOR, 800);                                                              // the wall behind the seats
    for (const s of [1, -1]) { const y0 = s * 125, y1 = s * 520;
      b.name('seat').mat(SEAT, 0.25, 'leather').box(1930, 2400, y0, y1, FLOOR, 400).loft(([[2350, 400, 0], [2430, 600, 0], [2510, 800, 20], [2560, 900, 70], [2580, 960, 110]] as const).map(([x, z, n]) => [[x, y0 + s * n, FLOOR + 60], [x, y1 - s * n, FLOOR + 60], [x, y1 - s * n, z], [x, y0 + s * n, z]] as V[]));
      b.name('seat').mat(SEAT2, 0.1); for (const y of [y0 + s * 130, y0 + s * 265]) b.bar([1950, y, 402], [2350, y, 402], 10).bar([2356, y, 410], [2506, y, 795], 10); } }
  // ---- the flanks (side view): the doors' curved shut lines, the intake's dark mouth ahead of the rear wheel, the vent behind it, mirrors on stalks ----
  for (const s of [1, -1]) { b.name('door').mat(SEAM, 0.3);
    seam(b, s, ([[459, 274], [476, 256], [495, 236], [517, 210], [536, 182], [546, 155], [550, 125], [553, 80]] as const).map(([x, z]) => [X(x), Z(z)]));                    // the front edge, round the wheel arch
    seam(b, s, ([[1040, 293], [1040, 239], [1036, 215], [1030, 194], [1015, 164], [985, 119], [960, 94], [940, 82]] as const).map(([x, z]) => [X(x), Z(z)]));               // the rear edge, curving forward to the sill
    seam(b, s, [[X(553), Z(80)], [X(700), Z(80)], [X(940), Z(82)]], 7);
    b.name('door').mat(DARK, 0.05); flank(b, s, [[X(1098), ST - 16], [SX1 - 3, ST - 16], [SX1 - 3, SB + 16], [X(1098), SB + 16]], 3); b.quad([SX1 + 0.5, s * (at(HALF, SX1) + 1), ST - 4], [SX1 + 0.5, s * (at(HALF, SX1) - 72), ST - 14], [SX1 + 0.5, s * (at(HALF, SX1) - 72), SB + 14], [SX1 + 0.5, s * (at(HALF, SX1) + 1), SB + 4]);
    b.name('fenderR').mat(SEAM, 0.2); for (const [xa, xb] of [[1568, 1590], [1590, 1607]] as const) flank(b, s, [[X(xa), Z(184)], [X(xb), Z(184)], [X(xb), Z(108)], [X(xa), Z(108)]], 5);                          // the vent behind the rear wheel
    b.name('bumperF').mat(SEAM, 0.2); flank(b, s, [[X(52), Z(96)], [X(96), Z(98)], [X(96), Z(50)], [X(52), Z(50)]]);                                                     // the corner duct, seen from the side
    // the mirror (side view 632-712 px, 78-130 px down from the roof; the front view has it standing out past the body)
    const mx = X(660), yb = FOOT * at(HALF, mx) + 20, zb = skinZ(mx, yb), my = MIRROR, mz = Z(305);
    b.name('mirror').mat(PAINT, 0.6, 'paint').bar([mx - 20, s * yb, zb - 8], [mx - 20, s * (my - 30), mz - 40], 50, 34);
    b.name('mirror').mat(PAINT, 0.6, 'paint').loft(([[mx - 100, 40, 34], [mx - 50, 70, 62], [mx + 85, 78, 72]] as const).map(([x, hy, hz]) => [[x, s * (my - hy), mz - hz], [x, s * (my + hy), mz - hz], [x, s * (my + hy), mz + hz], [x, s * (my - hy), mz + hz]] as V[]));
    b.name('mirror').mat('#aeb9c2', 0.8, 'metal').box(mx + 85, mx + 88, s * (my - 66), s * (my + 66), mz - 60, mz + 60); }
  // ---- the top's shut lines (top view): across the tail ahead of the wing, the engine cover's back edge ----
  b.name('body').mat(SEAM, 0.3); lay(b, X(1483), X(1483) + 9, -Y(315), Y(315), 2.5, 1, 8); lay(b, X(1384), X(1384) + 8, -Y(205), Y(205), 2.5, 1, 4);
  // ---- the tail (rear view): three square lamps a side (amber outermost, two red), a barred grille band between them with the oval badge, the bumper, the dark valance, four pipes in two pairs ----
  for (const s of [1, -1]) { b.name('tailRim').mat(FRAME, 0.3).box(X1 - 4, X1 + 3, s * 438, s * 746, 580, 734);
    for (const [ya, yb, col] of [[450, 540, RED], [548, 638, RED], [646, 736, AMBER]] as const) b.name('tail').mat(col, 0.5, 'lens').box(X1, X1 + 7, s * ya, s * yb, 592, 724); }
  b.name('grille').mat(DARK, 0.1).box(X1 - 4, X1 + 3, -430, 430, 588, 728);
  b.name('grille').mat(PAINT, 0.6, 'paint'); for (const z of [592, 635, 681, 724]) b.box(X1, X1 + 8, -432, 432, z - 6, z + 6); for (const y of [-430, 430]) b.box(X1, X1 + 8, y - 8, y + 8, 586, 730);
  b.name('grille').mat(LENS, 0.4); oval(b, X1 + 9, 0, 658, 92, 46); b.name('grille').mat(RED, 0.5); oval(b, X1 + 11, 0, 658, 78, 34);
  b.name('bumperR').mat(PAINT, 0.6, 'paint').loft([-805, -756, -500, 0, 500, 756, 805].map(y => { const x = Math.abs(y) > 756 ? tailX(y) - 4 : X1 - 4, o = Math.abs(y) > 756 ? 30 : 58.5; return [[x, y, 548], [x + o, y, 512], [x + o, y, 432], [x, y, 398]] as V[]; }));
  { const vx = (z: number) => X(1598) + (z - at(BOT, X(1598))) * (X1 - X(1598)) / (at(BOT, X1) - at(BOT, X(1598))) + 5, vq = (y0: number, y1: number, z0: number, z1: number) => b.quad([vx(z0), y0, z0 - 2], [vx(z0), y1, z0 - 2], [vx(z1), y1, z1 - 2], [vx(z1), y0, z1 - 2]);
    b.name('bumperR').mat(DARK, 0.05); vq(-181, 181, 112, 262); for (const s of [1, -1]) vq(s * 214, s * 668, 128, 322);                       // the diffuser in the middle, the pipes' dark panels
    b.name('tail').mat('#7a1512', 0.4, 'lens'); vq(-88, 88, 282, 318);                                                                          // the third brake lamp (unlit)
    for (const y of [-524, -411, 411, 524]) { b.name('exhaust').mat(CHROME, 0.9, 'metal').lathe('x', [0, y, 214], [[vx(214) - 60, 52], [vx(214) + 42, 52], [vx(214) + 42, 40], [vx(214) - 20, 40]], 10, false); b.name('exhaust').mat(DARK, 0.05).lathe('x', [0, y, 214], [[vx(214) - 20, 0], [vx(214) - 20, 40]], 8, false); } }
  // ---- the wing: the tail's trailing blade behind the dark slot; up, it stands 110 mm higher on two struts, its trailing edge 12 degrees up ----
  b.name('grille').mat(DARK, 0.05); lay(b, X(1555), X(1583), -Y(222), Y(222), 3, 1, 6);
  { const x0 = X(1586), x1 = X1 + 6, z0 = skinZ(x0, 0), a = 12 * wing * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), lift = 110 * wing, span = 730;
    const T = (p: V): V => { const dx = p[0] - x0, dz = p[2] - z0; return [x0 + dx * ca - dz * sa, p[1], z0 + dx * sa + dz * ca + lift]; };
    const top = (x: number, y: number) => skinZ(Math.min(x, X1), y) + 9 - Math.max(0, x - X1) * 0.8;
    b.name('body').mat(DARK, 0.05); lay(b, x0 + 8, X1, -span + 12, span - 12, 2.5, 2, 4);                                                       // the bed it lies in
    b.name('wing').mat(PAINT, 0.6, 'paint').loft([-span, -560, -380, -190, 0, 190, 380, 560, span].map(y => ([[x0, -7], [x0 + 40, 0], [(x0 + x1) / 2, 1], [x1 - 20, 0], [x1, -5], [x1 - 30, -15], [x0 + 40, -17]] as const).map(([x, dz]) => T([x, y, top(x, y) + dz]))));
    if (wing > 0.02) { b.name('wing').mat(FRAME, 0.2); for (const y of [-330, 330]) { const x = (x0 + x1) / 2; b.bar([x, y, skinZ(x, y) - 10], T([x, y, top(x, y) - 14]), 50, 16); } } }
  for (const s of [1, -1] as const) { wheel(b, FX, s, spin); wheel(b, RX, s, spin); }
  return b.mesh(L); }
/** how far out the mirrors' middles stand (the sheet has them 1037 mm out at their tips: 2075 mm over the mirrors) */
const MIRROR = 962;
export const mesh = eb110Mesh;
