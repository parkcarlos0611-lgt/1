// The 1991 Bugatti EB110 GT as a low-polygon mesh (docs/systems/70_mesh_car_rules.md; review 125: a 1990s technology
// test). No sheet for this car: the sizes are the real ones (length 4400, width 1940, height 1125, wheelbase 2550,
// track 1550 front and 1600 rear, 245/40 ZR18 and 325/30 ZR18 tyres on 18 inch BBS wheels), the shapes from memory of
// the car: a low wedge with the cabin far forward, a small horseshoe grille between two intakes, fixed lamps under
// clear covers in the nose's corners, a steep screen, a rounded glasshouse running back as a glazed, louvred cover
// over the V12, scissor doors (closed), a duct in each flank ahead of the rear wheel, four round tail lamps, four
// pipes, and a wing lying flush in the tail that rises at speed (`wing` 0 stowed .. 1 up).
import { Build, type Mesh, type V } from './mesh';

const PAINT = '#2a4f86', FRAME = '#2b2d31', TRIM = '#3a3b40', LEATHER = '#8c8c90', LEATHER2 = '#6f6f74', GLASS = '#a9c2cc', SILVER = '#c4c7cb', CHROME = '#c9cbcf', RUBBER = '#26242b', DARK = '#1c1b20', LENS = '#eef0f2', RED = '#c22c2b', AMBER = '#e0902a';
const L = 4400, FX = 900, RX = FX + 2550, R = 326, WYF = 775, WYR = 800, TWF = 245, TWR = 325;   // the axles, the tyres' radius, half the tracks, the tyres' widths
const RA = 356, YINF = 620, YINR = 610;                                                          // the wheel arches' radius; the wheel wells' inner walls
const X0 = 6, X1 = L - 8;                                                                        // the skin's first and last sections (the grille and the lamps stand out to 0 and L)
const FLOOR = 290, CX0 = 1500, CX1 = 2700;                                                       // the cabin's hollow: its floor, front and back
const EFLOOR = 640, EX0 = 2790, EX1 = 3740;                                                      // the engine bay's hollow under the glass cover
const P = 4;                                                                                     // how square the body's shoulders are
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = (a: V): V => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a: V, b: V, f: number): V => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
/** linear reading of a table of [x, value] */
const at = (tab: [number, number][], x: number) => { if (x <= tab[0]![0]) return tab[0]![1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i]![0]) { const [x0, v0] = tab[i - 1]!, [x1, v1] = tab[i]!; return v0 + (v1 - v0) * (x - x0) / (x1 - x0); } return tab[tab.length - 1]![1]; };
// the body along the car: half-width (plan); the height of its widest line; its underside; the top between the wings;
// how far the wings' crests stand above it
const HALF: [number, number][] = [[6, 600], [40, 730], [110, 810], [250, 868], [500, 900], [900, 918], [1500, 925], [2200, 935], [2800, 952], [3200, 967], [3450, 970], [3900, 963], [4200, 940], [4340, 900], [4392, 840]];
const EDGE: [number, number][] = [[6, 400], [300, 440], [900, 500], [1500, 530], [2700, 560], [3450, 600], [4000, 610], [4392, 600]];
const BOT: [number, number][] = [[6, 215], [150, 160], [400, 125], [700, 115], [3300, 115], [3800, 160], [4100, 240], [4392, 330]];
const DECK: [number, number][] = [[6, 415], [80, 470], [250, 520], [500, 570], [900, 650], [1250, 720], [1500, 765], [2000, 790], [2700, 815], [3000, 845], [3450, 878], [3900, 882], [4250, 858], [4392, 820]];
const WNG: [number, number][] = [[6, 0], [250, 20], [600, 60], [900, 75], [1250, 45], [1500, 15], [2000, 0], [2700, 10], [3100, 25], [3450, 30], [3900, 15], [4392, 0]];
/** the wheel arch's height at x: a half circle over each hub (0 away from the wheels) */
const archZ = (x: number) => { for (const hx of [FX, RX]) { const dx = x - hx; if (Math.abs(dx) <= RA + 1e-6) return R + Math.sqrt(Math.max(0, RA * RA - dx * dx)); } return 0; };
/** the skin's height at y across the body at x: the deck and the wings' crests, rolled over to the widest line at the edge */
const skinZ = (x: number, y: number) => { const w = at(HALF, x), ay = Math.abs(y), u = Math.min(1, ay / w), ze = Math.max(at(EDGE, x), archZ(x));
  const h = at(DECK, x) + at(WNG, x) * Math.exp(-(((ay - 0.8 * w) / (0.22 * w)) ** 2)); return ze + (h - ze) * (1 - u ** P) ** (1 / P); };
/** the skin's distance from the centre line at height z on the body's side at x */
const sideY = (x: number, z: number) => { const w = at(HALF, x), ze = at(EDGE, x); if (z <= ze) return w * (1 - 0.005 * (ze - z) / Math.max(1, ze - at(BOT, x) - 140));
  let lo = 0.72 * w, hi = w; for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (skinZ(x, m) > z) lo = m; else hi = m; } return (lo + hi) / 2; };
// where the body's sections have their points across the top, as parts of the half-width; the doubled ones are the
// edges of the cabin's hollow (0.70) and the engine bay's (0.45), so their walls stand upright
const U = [-1, -0.97, -0.9, -0.8, -0.7, -0.7, -0.45, -0.45, -0.22, 0, 0.22, 0.45, 0.45, 0.7, 0.7, 0.8, 0.9, 0.97, 1];
const cab = (x: number) => x >= CX0 && x <= CX1, eng = (x: number) => x >= EX0 && x <= EX1;
/** a body section at x: the top across, then the underside (flank, sill, floor); at a wheel it rises into the arch outboard of the well's wall */
function ring(x: number): V[] { const w = at(HALF, x), zb = at(BOT, x), arch = archZ(x), yin = x < 2200 ? YINF : YINR, c = cab(x), e = eng(x);
  const top: V[] = U.map((u, i) => [x, u * w, c && i >= 5 && i <= 13 ? FLOOR : e && i >= 7 && i <= 11 ? EFLOOR : skinZ(x, u * w)]);
  const low: [number, number][] = arch ? [[w, arch], [w, arch], [yin, arch], [yin, zb]] : [[0.995 * w, zb + 140], [0.985 * w, zb + 50], [0.93 * w, zb + 6], [0.8 * w, zb]];
  return [...top, ...low.map(([y, z]) => [x, y, z] as V), ...low.slice().reverse().map(([y, z]) => [x, -y, z] as V)]; }
/** the part a piece of the skin belongs to: `xm` the middle of its two sections, `i` its place round the section */
function partOf(xm: number, i: number, openC: boolean, openE: boolean): string {
  if (i >= 20 && i <= 24) return 'chassis'; if (i === 19 || i === 25) return 'sill';
  if (openC && i >= 4 && i <= 13) return 'cockpit'; if (openE && i >= 6 && i <= 11) return 'chassis';
  if (xm < 130) return 'bumperF'; if (xm > 4280) return 'bumperR';
  const outer = i <= 3 || i >= 14; if (xm < 1260) return outer ? 'fenderF' : 'hood'; if (xm < 1480) return outer ? 'fenderF' : 'body'; if (xm < 2720) return outer ? 'door' : 'body'; return outer ? 'fenderR' : 'body'; }
/** a round pipe through points */
function tube(b: Build, pts: V[], r: number, seg = 8, caps = true) { const n = pts.length;
  b.loft(pts.map((p, i) => { const d = norm(sub(pts[Math.min(n - 1, i + 1)]!, pts[Math.max(0, i - 1)]!)), u = norm(cross(d, Math.abs(d[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1])), v = cross(d, u);
    return Array.from({ length: seg }, (_, k) => { const t = k / seg * Math.PI * 2, c = Math.cos(t) * r, s = Math.sin(t) * r; return [p[0] + u[0] * c + v[0] * s, p[1] + u[1] * c + v[1] * s, p[2] + u[2] * c + v[2] * s] as V; }); }), caps); }
/** an oval patch lying on the body's top, `lift` above the skin: lamp beds and covers, the ducts on the shoulders */
function patch(b: Build, cx: number, cy: number, rx: number, ry: number, lift: number, seg = 14) { const p = (f: number, i: number): V => { const t = i / seg * Math.PI * 2, x = cx + Math.cos(t) * rx * f, y = cy + Math.sin(t) * ry * f; return [x, y, skinZ(x, y) + lift]; };
  for (let i = 0; i < seg; i++) { b.tri([cx, cy, skinZ(cx, cy) + lift], p(0.5, i), p(0.5, i + 1)); b.quad(p(0.5, i), p(1, i), p(1, i + 1), p(0.5, i + 1)); } }
/** a flat shape laid on the body's flank, `lift` off the skin: [x, z] points round it (side `s`) */
function flank(b: Build, s: number, pts: [number, number][], lift = 5) { const q: V[] = pts.map(([x, z]) => [x, s * (sideY(x, z) + lift), z]), m: V = [0, 0, 0]; for (const p of q) { m[0] += p[0] / q.length; m[1] += p[1] / q.length; m[2] += p[2] / q.length; }
  m[1] = s * (sideY(m[0], m[2]) + lift); for (let i = 0; i < q.length; i++) b.tri(m, q[i]!, q[(i + 1) % q.length]!); }
/** the horseshoe's outline at x: half-width w, from zb up to zt (an arch over straight sides drawing in to the foot) */
const shoe = (x: number, w: number, zb: number, zt: number): V[] => { const out: V[] = [[x, -w * 0.72, zb], [x, w * 0.72, zb]], zc = zt - w; for (let k = 0; k <= 8; k++) { const t = k / 8 * Math.PI; out.push([x, Math.cos(t) * w, zc + Math.sin(t) * w]); } return out; };

/** an 18 inch BBS wheel: a deep bright rim, a ring of thin spokes to a small centre, the brake dark behind them, a low tyre */
function wheel(b: Build, x: number, s: 1 | -1, spin = 0) { const front = x === FX, wy = front ? WYF : WYR, tw = front ? TWF : TWR, o: V = [x, s * wy, R], rim = 236, h = tw / 2, f = s * h, N = 12;
  b.name(front ? 'tyreF' : 'tyreR').mat(RUBBER, 0.05, 'tyre').lathe('y', o, [[-h, rim], [-h, R - 34], [-h + 30, R], [h - 30, R], [h, R - 34], [h, rim]], 24, false);
  b.name('rim').mat(SILVER, 0.75, 'metal').lathe('y', o, [[f, rim + 6], [f - s * 8, rim - 8], [f - s * 40, rim - 20], [f - s * 55, rim - 24]], 24, false);
  b.name('wheel').mat(DARK, 0.05).lathe('y', o, [[f - s * 75, 0], [f - s * 75, rim - 22]], 16, false).lathe('y', o, [[-f * 0.7, 0], [-f * 0.7, rim]], 12, false);   // the brake's dark behind the spokes; the wheel's back
  b.name('wheel').mat('#8d9096', 0.5, 'metal').lathe('y', o, [[f - s * 74, 150], [f - s * 66, 150], [f - s * 66, 60]], 16, false);                                 // the brake disc
  b.name('spoke').mat(SILVER, 0.7, 'metal'); for (let k = 0; k < N; k++) { const a = spin + k / N * Math.PI * 2, c = Math.cos(a), q = Math.sin(a); b.bar([x + c * 50, s * wy + f - s * 30, R + q * 50], [x + c * (rim - 20), s * wy + f - s * 50, R + q * (rim - 20)], 26, 14); }
  b.name('hub').mat(SILVER, 0.8, 'metal').lathe('y', o, [[f - s * 40, 66], [f - s * 26, 58], [f - s * 20, 34], [f - s * 18, 0]], 12, false);
  b.name('hub').mat(PAINT, 0.5).lathe('y', o, [[f - s * 17, 0], [f - s * 17, 30]], 10, false);                                                                     // the blue badge in the centre
}

export function eb110Mesh(spin = 0, wing = 0): Mesh { const b = new Build(); wing = Math.max(0, Math.min(1, wing));
  // ---- the body: one skin from the nose to the tail, the arches cut up into it, the cabin and the engine bay hollowed; each panel its own part ----
  const xs = [X0, 40, 80, 130, 190, 250, 330, 420, 500, 1260, 1370, 1480, CX0 - 2, CX0, 1650, 1800, 1950, 2100, 2250, 2400, 2550, CX1, CX1 + 2, 2720, EX0 - 2, EX0, 2900, 3000, 3900, 4000, 4100, 4200, 4280, 4340, X1];
  for (const hx of [FX, RX]) { xs.push(hx - RA - 2, hx + RA + 2); for (let d = 0; d <= 180; d += 15) xs.push(Math.round(hx - RA * Math.cos(d * Math.PI / 180))); }
  xs.push(EX1, EX1 + 2); xs.sort((p, q) => p - q);
  { const rings = xs.map(x => ring(x)), K = rings[0]!.length, parts = new Map<string, [V, V, V, V][]>();
    for (let r = 0; r + 1 < rings.length; r++) { const A = rings[r]!, B = rings[r + 1]!, xa = xs[r]!, xb = xs[r + 1]!, oc = cab(xa) || cab(xb), oe = eng(xa) || eng(xb);
      for (let i = 0; i < K; i++) { const nm = partOf((xa + xb) / 2, i, oc, oe); if (!parts.has(nm)) parts.set(nm, []); parts.get(nm)!.push([A[i]!, A[(i + 1) % K]!, B[(i + 1) % K]!, B[i]!]); } }
    for (const [nm, qs] of parts) { if (nm === 'sill') b.name(nm).mat(FRAME, 0.15); else if (nm === 'chassis') b.name(nm).mat(DARK, 0.05); else if (nm === 'cockpit') b.name(nm).mat(TRIM, 0.1); else b.name(nm).mat(PAINT, 0.6, 'paint');
      for (const q of qs) b.quad(...q); }
    for (const [nm, Rg] of [['bumperF', rings[0]!], ['bumperR', rings[rings.length - 1]!]] as const) { b.name(nm).mat(PAINT, 0.6, 'paint'); const m: V = [Rg[0]![0], 0, 0]; for (const p of Rg) m[2] += p[2] / Rg.length; for (let i = 0; i < K; i++) b.tri(m, Rg[i]!, Rg[(i + 1) % K]!); } }
  b.name('chassis').mat(DARK, 0.05).bar([FX, -WYF, R], [FX, WYF, R], 60).bar([RX, -WYR, R], [RX, WYR, R], 80);   // the axles' lines through the wells
  // ---- the nose: the small horseshoe between two intakes, a slim slot under them, the turn lamps ----
  b.name('grille').mat(CHROME, 0.9, 'metal').loft([shoe(2, 62, 286, 404), shoe(X0 + 1, 62, 286, 404)]);
  b.name('core').mat(DARK, 0.1, 'grille').loft([shoe(0, 50, 294, 394), shoe(X0 + 1, 50, 294, 394)]);
  b.name('grille').mat(DARK, 0.05); for (const s of [1, -1]) b.box(1, X0 + 1, s * 105, s * 490, 300, 372); b.box(1, X0 + 1, -500, 500, 234, 268);
  for (const s of [1, -1]) b.name('lens').mat(AMBER, 0.5, 'lens').box(0, X0 + 1, s * 520, s * 580, 318, 352);
  b.name('bumperF').mat(FRAME, 0.15).box(X0, 120, -560, 560, at(BOT, X0) - 12, at(BOT, X0) + 4);                    // the splitter's dark lip
  // ---- the lamps in the nose's corners: a dark bed, two bright lamps side by side, under a clear cover faired into the skin ----
  for (const s of [1, -1]) { const cx = 330, cy = s * 655;
    b.name('lamp').mat(DARK, 0.05); patch(b, cx, cy, 170, 150, 3);
    for (const dy of [-62, 62]) { b.name('lamp').mat(CHROME, 0.9, 'metal'); patch(b, cx + 10, cy + dy, 62, 56, 6, 10); b.name('lens').mat(LENS, 0.6, 'lens'); patch(b, cx + 10, cy + dy, 48, 44, 9, 10); }
    b.name('lampCover').mat(GLASS, 0.5, 'glass'); patch(b, cx, cy, 170, 150, 15); }
  // ---- the glasshouse: sections from the screen's foot over the roof and down the engine cover to the tail ----
  // each: x, the foot's place across (part of the half-width), the top edge's half-width and height, the crown's height, how far the corners sweep back
  const G: [number, number, number, number, number, number][] = [[1290, 0.70, 600, 0, 0, 190], [2020, 0.74, 520, 1085, 1108, 50], [2330, 0.74, 535, 1100, 1125, 20], [2650, 0.74, 530, 1088, 1112, 0], [2760, 0.74, 520, 1068, 1092, 0],
    [3100, 0.69, 480, 1000, 1020, 0], [3450, 0.63, 440, 942, 956, 0], [3750, 0.57, 430, 906, 913, 0], [3950, 0.52, 440, 0, 0, 0]];
  const sec = ([x, f, yt, zt, zc, bow]: [number, number, number, number, number, number]): V[] => { const yb = f * at(HALF, x + bow), foot = (s: number): V => [x + bow, s * yb, skinZ(x + bow, yb) - 3];
    const top = [-1, -0.5, 0, 0.5, 1].map(u => { const y = u * yt, px = x + bow * (y / yb) ** 2; return [px, y, zt ? zt + (zc - zt) * (1 - u * u) : skinZ(px, y) + 5] as V; }); return [foot(-1), ...top, foot(1)]; };
  const C = G.map(sec); { const m = C[0]!.map((p, i) => { const q = lerp(p, C[1]![i]!, 0.5); return (i === 0 || i === 6 ? [q[0], q[1], skinZ(q[0], q[1]) - 3] : [q[0], q[1], q[2] + 16]) as V; }); C.splice(1, 0, m); }   // the screen bowed a little
  const band = (k: number, i: number, dz = 0) => { const A = C[k]!, B = C[k + 1]!, d = (p: V): V => [p[0], p[1], p[2] + dz]; b.quad(d(A[i]!), d(A[i + 1]!), d(B[i + 1]!), d(B[i]!)); };
  b.name('screenPane').mat(GLASS, 0.5, 'glass'); for (const k of [0, 1]) for (let i = 1; i <= 4; i++) band(k, i);                                    // the windscreen
  b.name('screenPane').mat(GLASS, 0.5, 'glass'); for (const k of [0, 1, 2, 3, 5]) for (const i of [0, 5]) band(k, i);                                 // the side windows and the quarter lights
  b.name('screenPane').mat(GLASS, 0.5, 'glass'); for (const k of [5, 6, 7]) for (let i = 1; i <= 4; i++) band(k, i);                                  // the glass over the engine
  b.name('body').mat(PAINT, 0.6, 'paint'); for (const k of [2, 3, 4, 8]) for (let i = 1; i <= 4; i++) band(k, i); for (const k of [6, 7, 8]) for (const i of [0, 5]) band(k, i);   // the roof; the sails beside the engine cover
  b.name('cockpit').mat(DARK, 0.05); for (const k of [2, 3, 4]) for (let i = 1; i <= 4; i++) band(k, i, -14);                                         // the headliner
  b.name('screenFrame').mat(FRAME, 0.2); for (const i of [0, 5]) band(4, i);                                                                           // the pillars behind the doors
  for (const i of [1, 5]) { for (let k = 0; k < 3; k++) b.bar(C[k]![i]!, C[k + 1]![i]!, 34, 20); for (let k = 3; k < 5; k++) b.bar(C[k]![i]!, C[k + 1]![i]!, 20, 12); for (let k = 5; k < 9; k++) b.bar(C[k]![i]!, C[k + 1]![i]!, 26, 12); }
  for (const i of [0, 6]) for (let k = 0; k < 6; k++) b.bar(C[k]![i]!, C[k + 1]![i]!, 16);                                                             // the waist rail under the glass
  for (const k of [2, 5, 8]) for (let i = 1; i < 5; i++) b.bar(C[k]![i]!, C[k]![i + 1]!, k === 8 ? 40 : 26, 10);                       // the screen's header, the engine cover's front and back edges
  for (let k = 5; k < 8; k++) b.bar(C[k]![3]!, C[k + 1]![3]!, 18, 8);                                                                                  // the cover's spine
  for (const x of [3480, 3550, 3620, 3690]) { let k = 5; while (k < 7 && C[k + 1]![3]![0] < x) k++; const f = (x - C[k]![3]![0]) / (C[k + 1]![3]![0] - C[k]![3]![0]);   // the louvres across the glass
    for (let i = 1; i < 5; i++) { const p = lerp(C[k]![i]!, C[k + 1]![i]!, f), q = lerp(C[k]![i + 1]!, C[k + 1]![i + 1]!, f); b.bar([p[0], p[1], p[2] + 4], [q[0], q[1], q[2] + 4], 36, 8); } }
  // ---- the cabin: the dash, the tunnel, the doors' linings, two seats in grey leather, the wall behind them ----
  { const w = 0.7 * at(HALF, 2100) - 4;
    b.name('cockpit').mat(TRIM, 0.1).box(1300, CX0 + 150, -w, w, 700, 772).box(CX0, CX0 + 120, -w, w, FLOOR, 700);                                     // the dash and its face
    b.name('cockpit').mat(LEATHER2, 0.2, 'leather').box(CX0 + 120, CX1 - 20, -90, 90, FLOOR, 470); for (const s of [1, -1]) b.box(CX0 + 2, CX1 - 2, s * (w - 14), s * w, FLOOR, 770);   // the tunnel; the doors' inner faces
    b.name('cockpit').mat(LEATHER2, 0.2, 'leather').box(CX1 - 16, CX1 - 2, -w, w, FLOOR, 830);                                                         // the wall behind the seats
    for (const s of [1, -1]) { const y0 = s * 130, y1 = s * (w - 50);
      b.name('seat').mat(LEATHER, 0.25, 'leather').box(2080, 2520, y0, y1, FLOOR, 430).loft(([[2470, 430, 0], [2540, 640, 0], [2600, 820, 20], [2640, 930, 60], [2655, 985, 90]] as const).map(([x, z, n]) => [[x, y0 + s * n, FLOOR + 60], [x, y1 - s * n, FLOOR + 60], [x, y1 - s * n, z], [x, y0 + s * n, z]] as V[]));
      b.name('seat').mat(LEATHER2, 0.1); for (const y of [y0 + s * 150, y0 + s * 300]) b.bar([2100, y, 432], [2470, y, 432], 10).bar([2474, y, 440], [2596, y, 815], 10); } }
  // ---- the V12 under the glass: the block, two cam covers, the intake between them with its twelve runners ----
  b.name('chassis').mat('#34353a', 0.2).box(2880, 3640, -250, 250, EFLOOR, 705);
  b.name('chassis').mat('#9da1a8', 0.6, 'metal'); for (const s of [1, -1]) b.box(2900, 3620, s * 120, s * 270, 705, 770);
  b.name('chassis').mat('#c3c6ca', 0.7, 'metal'); tube(b, [[2920, 0, 790], [3600, 0, 790]], 52, 8); for (const s of [1, -1]) for (let k = 0; k < 6; k++) { const x = 2975 + k * 114; b.bar([x, s * 30, 800], [x, s * 150, 772], 44, 30); }
  b.name('chassis').mat(RED, 0.3); for (const s of [1, -1]) b.box(2990, 3530, s * 165, s * 225, 770, 776);                                             // the covers' red strips
  // ---- the flanks: the big duct ahead of each rear wheel, the small one on the shoulder behind the door's glass, mirrors ----
  for (const s of [1, -1]) { b.name('door').mat(DARK, 0.05); flank(b, s, [[2360, 452], [2600, 478], [2850, 528], [3050, 590], [3050, 330], [2850, 372], [2600, 424]]);
    b.name('fenderR').mat(DARK, 0.05); patch(b, 3010, s * 800, 150, 48, 4, 10);
    b.name('door').mat(FRAME, 0.15).box(2100, 2190, s * (sideY(2150, 640) - 4), s * (sideY(2150, 640) + 5), 632, 648);                                 // the door's pull
    const mz = skinZ(1640, 700);
    b.name('mirror').mat(FRAME, 0.15).bar([1640, s * 730, mz - 10], [1640, s * 850, mz + 60], 40, 22);
    b.name('mirror').mat(PAINT, 0.6, 'paint').loft(([[1585, 28, 22], [1615, 56, 44], [1668, 62, 50]] as const).map(([x, hy, hz]) => [[x, s * (890 - hy), mz + 75 - hz], [x, s * (890 + hy), mz + 75 - hz], [x, s * (890 + hy), mz + 75 + hz], [x, s * (890 - hy), mz + 75 + hz]] as V[]));
    b.name('mirror').mat('#aeb9c2', 0.8, 'metal').box(1668, 1671, s * 838, s * 942, mz + 33, mz + 117); }
  // ---- the tail: a dark mesh panel with four round red lamps, the dark valance with four pipes ----
  b.name('core').mat(DARK, 0.1, 'grille').box(X1, X1 + 3, -720, 720, 640, 775);
  for (const y of [-640, -500, 500, 640]) { b.name('tailRim').mat(FRAME, 0.3).lathe('x', [0, y, 708], [[X1, 62], [X1 + 5, 62]], 12); b.name('tail').mat(RED, 0.5, 'lens').lathe('x', [0, y, 708], [[X1 + 5, 54], [X1 + 8, 40], [X1 + 8, 0]], 12, false); }
  b.name('bumperR').mat(FRAME, 0.15).box(X1, X1 + 3, -640, 640, 340, 480);
  for (const y of [-330, -240, 240, 330]) { b.name('exhaust').mat(CHROME, 0.9, 'metal').lathe('x', [0, y, 410], [[X1 - 90, 36], [L, 36], [L, 28], [L - 60, 28]], 10, false); b.name('exhaust').mat(DARK, 0.05).lathe('x', [0, y, 410], [[L - 60, 0], [L - 60, 28]], 8, false); }
  // ---- the wing: a blade lying flush in the tail; up, it stands ~110 mm higher on two struts, its trailing edge 10° up ----
  { const x0 = 4030, x1 = 4368, z0 = skinZ(x0, 0), a = 10 * wing * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), lift = 110 * wing;
    const T = (p: V): V => { const dx = p[0] - x0, dz = p[2] - z0; return [x0 + dx * ca - dz * sa, p[1], z0 + dx * sa + dz * ca + lift]; };
    const top = (x: number, y: number) => skinZ(x, y) + 8;
    b.name('body').mat(DARK, 0.05); for (const [ya, yb] of [[-690, 0], [0, 690]] as const) for (const [xa, xb] of [[x0 + 10, 4200], [4200, x1 - 10]] as const) b.quad([xa, ya, skinZ(xa, ya) + 3], [xa, yb, skinZ(xa, yb) + 3], [xb, yb, skinZ(xb, yb) + 3], [xb, ya, skinZ(xb, ya) + 3]);   // the bed it lies in
    b.name('wing').mat(PAINT, 0.6, 'paint').loft([-705, -560, -380, -190, 0, 190, 380, 560, 705].map(y => ([[x0, -12], [x0 + 60, 0], [(x0 + x1) / 2, 2], [x1 - 30, 0], [x1, -8], [x1 - 40, -24], [x0 + 60, -28]] as const).map(([x, dz]) => T([x, y, top(x, y) + dz]))));
    if (wing > 0.02) { b.name('wing').mat(FRAME, 0.2); for (const y of [-380, 380]) { const x = x0 + 150; b.bar([x, y, skinZ(x, y) - 10], T([x, y, top(x, y) - 20]), 60, 16); } } }
  for (const s of [1, -1] as const) { wheel(b, FX, s, spin); wheel(b, RX, s, spin); }
  return b.mesh(L); }
export const mesh = eb110Mesh;
