// The N33's third cage (docs/systems/117 §15): the body remade for an angular car by the style standard
// (docs/systems/108): big near-flat panels, the curvature kept to narrow bands, every character line a pair of
// support loops (two lines of cage points 15 .. 30 mm apart) so that the one level of subdivision
// (render/car/p959/subdiv.ts) rounds only the band between them and leaves the panels flat.
//
// GATE 1: only the front third is new here (rows 0 .. 12: the nose, the lamps' band, the bonnet, the front wings to
// the A pillar's foot, the front arch, the front bumper). Behind it the cabin and the tail are a temporary STUB: the
// second cage's rows 10 .. 26 (cage.ts), its tail strip and its rear bumper, laid on this cage's columns. The game
// still draws the second cage; this one is drawn by tools/ref/n33_gate.ts until the front is approved.
//
// Units mm; x from the nose back, y from the centre line out (the half y >= 0 is authored, the other mirrored), z up.
// Read from the blueprint (docs/reference/bnr33/bp_line_4view_hires.png, 5.5 mm a pixel) and the photographs.
//
//   columns   0 the centre line
//             1 the bonnet's raised middle: its edge        2 the foot of the ramp down from it (28 mm out)
//             3 the bonnet's flank, half way out            4 the flank's edge (20 mm in from the shut line)
//             5 the bonnet's shut line (a shallow valley: the wing's crest stands above the bonnet's edge)
//             6 the front wing's crest
//             7 the wing's shoulder crease, its top         8 its foot (16 mm out, 17 mm down)
//             9 the wing's side, half way down
//            10 the line from the lamp's tip; over the arch the flare's outer ring (30 mm outside the lip)
//            11 the bumper's seam from the lamp's tip to the arch, then the arch's lip
//            12 .. 15 behind the arch: the lower door's line, the door's foot, the skirt's crease, its foot
//   rows      0 the lamps' foot (the bumper's seam across the nose)
//             1 the bonnet's and the wings' leading edge (the lamps' top; it runs out and back to the lamp's tip)
//             2 the leading edge's support, 24 mm behind it
//             3, 4 the brow (the bonnet's steep front)      5 .. 10 the bonnet, and the arch's spokes
//            11 the arch's last spoke (then the lip runs down columns 11 .. 15) and the cowl's support (25 mm before it)
//            12 the bonnet's trailing edge (the cowl), and the flare's ring behind the arch
//            13 .. 29 the stub: the second cage's rows 10 .. 26 (13 the screen's foot and the door's front edge)
// Under the seam the front bumper hangs as a strip of ten lines: the ledge that stands out ahead of the lamps (its
// inner support, its edge's two supports), the upright face, the step in under the upper bar (two supports), the
// face's foot, and the lip (its top, its edge, its underside).
import { ekey, type V } from '../p959/subdiv';
import type { Cage959, CageLine, Mat, Region, Tag } from '../p959/cage';
import { shellFrom, type Shell959 } from '../p959/shell';
import { buildCage as buildSecond, type CageOpts } from './cage';
import { DIM, frameOf } from './frame';

/** the third cage's own measurements: the arch's lip (a 245/45 R17 tyre of radius 326 stands 24 mm inside it), the
 *  cage's ring that subdivides onto it, the flare's width, and the wheel's rim as it is seen (the flange, not the seat) */
export const V3 = { archR: 350, ringR: 355, flare: 30, rimR: 232, rows: 30, cols: 16, front: 13 } as const;
/** the second cage's column each of this cage's columns takes in the stub (between two: laid between them) */
const OLD_COL = [0, 1, 1.3, 1.6, 1.85, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], OLD_ROW0 = 10;

/** a smooth curve through key points (monotone between them, straight beyond its ends) */
function pc(k: [number, number][]): (x: number) => number { const n = k.length, h: number[] = [], d: number[] = [], m: number[] = new Array<number>(n).fill(0);
  for (let i = 0; i + 1 < n; i++) { h.push(k[i + 1]![0] - k[i]![0]); d.push((k[i + 1]![1] - k[i]![1]) / h[i]!); }
  m[0] = d[0]!; m[n - 1] = d[n - 2]!;
  for (let i = 1; i + 1 < n; i++) m[i] = d[i - 1]! * d[i]! <= 0 ? 0 : 3 * (h[i - 1]! + h[i]!) / ((2 * h[i]! + h[i - 1]!) / d[i - 1]! + (h[i]! + 2 * h[i - 1]!) / d[i]!);
  return x => { if (x <= k[0]![0]) return k[0]![1] + m[0]! * (x - k[0]![0]); if (x >= k[n - 1]![0]) return k[n - 1]![1] + m[n - 1]! * (x - k[n - 1]![0]);
    let i = 0; while (x > k[i + 1]![0]) i++; const t = (x - k[i]![0]) / h[i]!, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * k[i]![1] + (t3 - 2 * t2 + t) * h[i]! * m[i]! + (-2 * t3 + 3 * t2) * k[i + 1]![1] + (t3 - t2) * h[i]! * m[i + 1]!; }; }
const lerp = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const T = (s: string): V[] => s.trim().split(/\s*;\s*/).map(r => r.trim().split(/[\s,]+/).map(Number) as V);

// ---- the car's lines as curves of x (the side view and the plan of the blueprint)
/** the bonnet's centre line (the side view's top line) */
const zC = pc([[100, 682], [112, 690], [136, 705], [215, 751], [320, 808], [470, 847], [620, 878], [780, 903], [940, 921], [1090, 938], [1220, 951], [1330, 957]]);
/** the raised middle's edge in plan (from the grille's corner out to the screen's) */
const yRise = (x: number) => 283 + (x - 112) * 112 / 1218;
/** the shut line: plan and height (the valley between the bonnet's flank and the wing's crest) */
const yShut = pc([[300, 700], [500, 705], [1000, 710], [1400, 706], [1500, 698]]), zShut = pc([[300, 698], [400, 741], [500, 784], [700, 840], [1000, 869], [1300, 906], [1500, 928]]);
/** the wing's crest */
const yCrest = pc([[330, 726], [500, 740], [1000, 746], [1400, 742], [1500, 737]]), zCrest = pc([[330, 712], [400, 750], [500, 792], [700, 847], [1000, 876], [1300, 913], [1500, 930]]);
/** the shoulder crease's top (the side view's second line) */
const yShoulder = pc([[372, 762], [500, 783], [700, 792], [1000, 794], [1300, 786], [1500, 762]]), zShoulder = pc([[372, 705], [420, 738], [500, 778], [700, 833], [1000, 862], [1300, 900], [1500, 918]]);
/** the wing's side half way down */
const ySide = pc([[432, 798], [520, 832], [620, 852], [800, 862], [1100, 862], [1345, 850], [1420, 840]]), zSide = pc([[432, 680], [520, 722], [620, 752], [800, 782], [1000, 795], [1345, 815], [1420, 815]]);

/** the rows' places along the centre line, how much of the leading edge's sweep and of the cowl's each keeps */
const XC = [0, 112, 136, 215, 320, 470, 620, 780, 940, 1090, 1220, 1305, 1330], FL = [0, 1, 1, 0.9, 0.75, 0.5, 0.3, 0.12, 0, 0, 0, 0, 0], FC = [0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.3, 0.62, 1, 1];
/** the leading edge's and the cowl's sweep back at the bonnet's columns 0 .. 5 */
const LEAD = [0, 2, 7, 84, 172, 188], COWL = [0, 60, 72, 110, 167, 170];
/** the arch's spokes (rows 5 .. 11): angles round the hub, from the rear horizontal over the top */
const SPOKE = [132, 114, 96, 78, 60, 44, 28], RING_DOWN = [28, 10.6, -6, -17, -28], RING_Y = [890, 886, 876, 864, 850];
const HUB = { x: DIM.axleF, z: DIM.hubZ }, ring = (deg: number, r: number, y: number): V => [HUB.x + r * Math.cos(deg * Math.PI / 180), y, HUB.z + r * Math.sin(deg * Math.PI / 180)];
/** the front of a circle round the hub at a height */
const ringAt = (z: number, r: number) => HUB.x - Math.sqrt(Math.max(0, r * r - (z - HUB.z) * (z - HUB.z)));

/** rows 0 and 1 (the lamps' foot and top) and the wing's columns' first rows, placed by hand */
const FOOT = T(`78 0 592; 82 250 592; 88 330 592; 110 400 592; 135 480 592; 168 560 592; 215 640 592; 262 700 592; 310 745 594; 350 775 596; 385 795 598; 420 808 600`);
const TOP = T(`112 0 690; 114 283 692; 119 311 693; 196 540 696; 284 680 698; 300 700 698; 330 726 712; 372 762 705; 392 776 698; 432 798 680; 470 815 650; 486 822 606`);
/** columns 6 .. 9 at rows 2 .. 4: x alone (their y and z from the curves) */
const WING_X: number[][] = [[352, 396, 416, 462], [400, 445, 465, 515], [470, 520, 540, 600]];
/** columns 10 and 11 at rows 2 .. 3 (row 4's are the flare's corner and its ring at the seam) */
const TIP_LINE = T(`505 829 645; 575 855 636`), SEAM_SIDE = T(`520 838 603; 585 862 598`);
/** row 12 at columns 6 .. 10: the wing at the A pillar's foot */
const ROW12 = T(`1490 737 930; 1492 762 918; 1490 778 902; 1420 840 815; 1345 870 722`);
/** the front bumper's outline in plan (its widest line: the ledge's edge and the face) under each of the seam's
 *  points from the third (the first two are on the arch's lip and the flare's ring) */
const OUTLINE: [number, number][] = [[575, 884], [500, 872], [440, 858], [372, 838], [318, 816], [270, 790], [224, 758], [178, 716], [130, 655], [88, 572], [58, 488], [42, 425], [32, 375], [17, 250], [8, 0]];
/** the rear bumper under its upper line (the second cage's: the stub) */
const BUMPER_R: V[][] = [
  `4035.2 884 420; 4195 826 425; 4385 770 430; 4478 724 480; 4602 550 507; 4609 516 508; 4639 256 510; 4645 0 510`,
  `4046.2 880 350; 4200 822 355; 4388 766 360; 4472 718 375; 4574 544 383; 4580 510 384; 4606 254 385; 4610 0 385`,
  `4045.3 868 290; 4198 814 286; 4384 758 292; 4460 710 300; 4556 536 305; 4562 502 305; 4588 250 306; 4592 0 306`,
].map(T);

export interface V3Opts extends CageOpts { /** the gate's picture: the lamps', the grille's and the bumper openings' places shown dark (the lump paints them) */ face?: boolean }
export function buildCageV3(o: V3Opts = {}): Cage959 { const NR = V3.rows, NC = V3.cols, NF = V3.front;
  const P: V[] = [], F: number[][] = [], tag: Tag[] = [], sharp = new Map<string, number>(), crease = new Set<string>();
  const pt = (p: V) => P.push([p[0], p[1], p[2]]) - 1, quad = (a: number, b: number, c: number, d: number, t: Tag) => { F.push([a, b, c, d]); tag.push(t); };
  const G: (V | null)[][] = Array.from({ length: NR }, () => new Array<V | null>(NC).fill(null));

  // ---- the front: rows 0 .. 12
  FOOT.forEach((p, j) => { G[0]![j] = p; }); TOP.forEach((p, j) => { G[1]![j] = p; });
  for (let i = 2; i < NF; i++) { const row = G[i]!, fade = Math.min(1, (i - 1) / 3), bx = (j: number) => XC[i]! + LEAD[j]! * FL[i]! + COWL[j]! * FC[i]!;
    // the bonnet: the raised middle, the ramp, the flat flank down to the shut line
    row[0] = [bx(0), 0, zC(bx(0))]; row[1] = [bx(1), yRise(bx(1)), zC(bx(1)) - 3 * fade]; row[2] = [bx(2), yRise(bx(2)) + 28, zC(bx(2)) - 11 * fade];
    row[5] = [bx(5), yShut(bx(5)), zShut(bx(5))];
    for (const [j, t] of [[3, 0.5], [4, 1 - 20 / (row[5][1] - row[2][1])]] as const) { const q = lerp(row[2], row[5], t); row[j] = [bx(j), q[1], q[2]]; }
    if (i === 12) { ROW12.forEach((p, k) => { row[6 + k] = p; }); RING_DOWN.forEach((a, k) => { row[11 + k] = ring(k ? a : 20, V3.ringR + V3.flare, RING_Y[k]! - (k ? 10 : 11)); }); continue; }
    // the lip (column 11) and the flare's ring (column 10); ahead of the arch the seam and the lamp's tip line
    if (i <= 3) { row[10] = TIP_LINE[i - 2]!; row[11] = SEAM_SIDE[i - 2]!; }
    else if (i === 4) { row[10] = ring(133, V3.ringR + V3.flare + 4, 878); row[11] = [ringAt(594, V3.ringR + V3.flare), 879, 594]; }
    else { row[11] = ring(SPOKE[i - 5]!, V3.ringR, 890); row[10] = ring(i === 5 ? 126 : i === 11 ? 34 : SPOKE[i - 5]!, V3.ringR + V3.flare, 879); }
    // the wing: its crest, its shoulder crease (two lines), its side
    const wx = i <= 4 ? WING_X[i - 2]! : [0.1, 0.28, 0.34, 0.62].map(w => row[5]![0] + (row[11]![0] - row[5]![0]) * w), band = i === 2 ? [15, 10] : i === 3 ? [16, 14] : [16, 17];
    row[6] = [wx[0]!, yCrest(wx[0]!), zCrest(wx[0]!)]; row[7] = [wx[1]!, yShoulder(wx[1]!), zShoulder(wx[1]!)]; row[8] = [wx[2]!, yShoulder(wx[2]!) + band[0]!, zShoulder(wx[2]!) - band[1]!]; row[9] = [wx[3]!, ySide(wx[3]!), zSide(wx[3]!)];
    if (i === 11) RING_DOWN.forEach((a, k) => { if (k) row[11 + k] = ring(a, V3.ringR, RING_Y[k]!); }); }

  // ---- the stub: the second cage's rows from the screen's foot back, on this cage's columns
  const old = buildSecond({ glass: o.glass ?? null }), oldAt = (i: number, c: number): V => { const c0 = Math.floor(c), p = old.P[old.M[i]![c0]!]!; return c === c0 ? p : lerp(p, old.P[old.M[i]![c0 + 1]!]!, c - c0); };
  for (let i = NF; i < NR; i++) for (let j = 0; j < NC; j++) { const oi = i - NF + OLD_ROW0, c = OLD_COL[j]!; if (old.M[oi]![Math.ceil(c)]! >= 0 && old.M[oi]![Math.floor(c)]! >= 0) G[i]![j] = oldAt(oi, c); }
  const oldFace = new Map<string, number>(); old.F.forEach((f, k) => oldFace.set(f.slice().sort((a, b) => a - b).join(','), k));
  const oldCell = (oi: number, oj: number): Tag => { const k = oldFace.get([old.M[oi]![oj]!, old.M[oi + 1]![oj]!, old.M[oi + 1]![oj + 1]!, old.M[oi]![oj + 1]!].sort((a, b) => a - b).join(',')); return k === undefined ? { region: 'shell', mat: 'paint', panel: 'wingF' } : { ...old.tag[k]! }; };

  const M: number[][] = G.map(r => r.map(p => p ? pt(p) : -1));
  const shown = (t: Tag, mat: Mat): Tag => o.face ? { ...t, mat } : t;
  const cell = (i: number, j: number): Tag => {
    if (i >= NF) return oldCell(i - NF + OLD_ROW0, j < 1 ? 0 : j < 5 ? 1 : j - 3);
    if (i === 0) return j < 1 ? shown({ region: 'shell', mat: 'paint', panel: 'nose', socket: 'grille', was: 'grille' }, 'grille') : j < 2 ? { region: 'shell', mat: 'paint', panel: 'nose' } : shown({ region: 'shell', mat: 'paint', panel: 'nose', socket: 'headLamp', was: 'lens' }, 'lens');
    if (j >= 13) return { region: 'shell', mat: 'paint', panel: 'sill' };
    return { region: 'shell', mat: 'paint', panel: i < 12 && j < 5 ? 'bonnet' : 'wingF' }; };
  for (let i = 0; i + 1 < NR; i++) for (let j = 0; j + 1 < NC; j++) { const a = M[i]![j]!, b = M[i + 1]![j]!, c = M[i + 1]![j + 1]!, d = M[i]![j + 1]!; if (a < 0 || b < 0 || c < 0 || d < 0) continue; quad(a, b, c, d, cell(i, j)); }
  const hard = (a: number, b: number, s = 1, split = false) => { sharp.set(ekey(a, b), Math.max(s, sharp.get(ekey(a, b)) ?? 0)); if (split) crease.add(ekey(a, b)); };
  const path = (p: number[], s = 1, split = false) => { for (let q = 0; q + 1 < p.length; q++) hard(p[q]!, p[q + 1]!, s, split); };
  const colPath = (j: number, i0: number, i1: number) => Array.from({ length: i1 - i0 + 1 }, (_, k) => M[i0 + k]![j]!), rowPath = (i: number, j0: number, j1: number) => Array.from({ length: j1 - j0 + 1 }, (_, k) => M[i]![j0 + k]!);

  // ---- the stub's tail: the wrapped strip under the deck's trailing edge and the rear bumper (the second cage's, with
  //      this cage's three more columns laid between its second and third)
  const R = NR - 1, wide = (l: V[]): V[] => [...l.slice(0, 2), lerp(l[1]!, l[2]!, 0.15 / 1), lerp(l[1]!, l[2]!, 0.4), lerp(l[1]!, l[2]!, 0.7), ...l.slice(2)];   // [.., the old column 2, three between, the old column 1, 0]
  const W: number[][] = old.W.map(l => wide([l[0]!, l[1]!, l[2]!, l[3]!].map(v => old.P[v]!)).map(pt)), K = W[0]!.length;
  const wl = (m: number, k: number) => m === 7 ? M[R]![7 - k]! : k === 0 ? M[R]![m]! : W[m - 8]![k - 1]!;
  for (let k = 0; k < K; k++) for (let m = 7; m < 11; m++) quad(wl(m, k), wl(m, k + 1), wl(m + 1, k + 1), wl(m + 1, k),
    m === 10 ? { region: 'bumperR', mat: 'paint', panel: 'bumperR' } : m === 8 && k < 2 ? { region: 'shell', mat: 'paint', panel: 'tailPanel', socket: 'tailLamp', was: 'lamp' } : { region: 'shell', mat: 'paint', panel: m === 7 ? 'bootLid' : 'tailPanel' });
  const strip = (top: number[], lines: V[][], tagOf: (m: number, k: number) => Tag, front: boolean) => { const rows: number[][] = [top, ...lines.map(l => l.map(pt))];
    for (let m = 0; m + 1 < rows.length; m++) for (let k = 0; k + 1 < top.length; k++) { const q = [rows[m]![k]!, rows[m]![k + 1]!, rows[m + 1]![k + 1]!, rows[m + 1]![k]!]; if (front) q.reverse(); quad(q[0]!, q[1]!, q[2]!, q[3]!, tagOf(m, k)); }
    return rows; };
  const seamR = [...colPath(11, R - 3, R - 1), M[R - 1]![10]!, M[R]![10]!, ...W[2]!], shelfR = [...colPath(11, R - 3, R), ...W[3]!];
  const BR = strip(shelfR, BUMPER_R.map(l => [...l.slice(0, 4), ...wide(l.slice(4))]), () => ({ region: 'bumperR', mat: 'paint', panel: 'bumperR' }), false);

  // ---- the front bumper under its seam (from the arch forward along column 11, then row 0 in to the centre line)
  const seamF = [...colPath(11, 1, 5).reverse(), ...rowPath(0, 0, 11).reverse()], NS = seamF.length;
  const O: [number, number][] = [[0, 0], [P[seamF[1]!]![0], P[seamF[1]!]![1]], ...OUTLINE];
  /** the bumper's lines: how far each stands in from (-) or out of the outline, and its height (null: from the seam's) */
  const LINES: { out: number; z: number | null; dz?: number }[] = [{ out: NaN, z: null, dz: -2 }, { out: NaN, z: null, dz: -12 }, { out: 0, z: null, dz: -34 }, { out: 0, z: 444 }, { out: -9, z: 424 }, { out: -9, z: 262 }, { out: -9, z: 240 }, { out: -3, z: 232 }, { out: 30, z: 152 }, { out: -30, z: 138 }];
  const bumper: V[][] = LINES.map((L, m) => seamF.map((v, k) => { const s = P[v]!, z = L.z ?? s[2] + L.dz!, lipOut = L.out === 30 ? (k >= 9 ? 30 : k <= 3 ? 8 : 8 + 22 * (k - 3) / 6) : L.out;
    if (k < 2) { const r = k ? V3.ringR + V3.flare : V3.ringR, y = (k ? 879 : 890) + (m < 2 ? 0 : lipOut); return [ringAt(z, r), y, z] as V; }
    const a = O[k - 1]!, b = O[k + 1] ?? [O[k]![0], -O[k - 1]![1]] as [number, number], c = O[k]!, tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty), n: [number, number] = [ty / tl, -tx / tl], sg = n[0] * (c[0] - 2000) + n[1] * c[1] > 0 ? 1 : -1;
    if (m < 2) { const d = Math.hypot(c[0] - s[0], c[1] - s[1]), t = d < 45 ? (m ? 0.7 : 0.3) : m ? 1 - 18 / d : 12 / d; return [s[0] + (c[0] - s[0]) * t, s[1] + (c[1] - s[1]) * t, z] as V; }
    return [c[0] + n[0] * sg * lipOut, Math.max(0, c[1] + n[1] * sg * lipOut), z] as V; }));
  // its faces: the paint, the two openings' places (the centre intake; the corner pocket of the lamp and the duct), the dark lip
  const bumperTag = (m: number, k: number): Tag => { const kk = NS - 2 - k;   // cells counted from the centre line out
    if (m >= 7) return { region: 'bumperF', mat: 'dark', panel: 'lipF' };
    if (m === 5 && kk < 2) return shown({ region: 'bumperF', mat: 'paint', panel: 'bumperF', socket: 'intake', was: 'grille' }, 'grille');
    if (m === 5 && kk >= 3 && kk < 7) return shown({ region: 'bumperF', mat: 'paint', panel: 'bumperF', socket: 'duct', was: 'grille' }, 'grille');
    return { region: 'bumperF', mat: 'paint', panel: 'bumperF' }; };
  const BF = strip(seamF, bumper, bumperTag, true);

  // ---- hard edges (positions) and creases (split shading). The panels' folds are not here: they are support loops,
  //      rounded by the subdivision and shaded smooth
  path(seamF); path(seamR);
  path(rowPath(0, 0, 11), 1, true);                                           // the lamps' foot on the bumper's ledge
  path(rowPath(1, 0, 11), 1, true);                                           // the bonnet's and the wings' leading edge over the lamps
  path(rowPath(12, 0, 5), 1, true);                                           // the cowl
  path(BF[7]!, 1, true); path(BF[9]!, 1, true);                               // the painted face's foot over the lip, the lip's edge
  // the stub's (as the second cage's): the screen's foot, the belt and the side glass's top, the windows' edges, the
  // deck's trailing edge, the tail's shelf, the shoulder, the waist, the skirt
  path(rowPath(13, 0, 7), 1, true); path(colPath(8, 13, 23), 1, true); path(colPath(7, 13, 23), 1, true);
  path([...rowPath(13, 0, 5), ...colPath(5, 14, 17)]); path(rowPath(17, 0, 5)); path([...rowPath(22, 0, 5), ...colPath(5, 23, 26)]); path(rowPath(26, 0, 5));
  path(rowPath(R, 0, 7), 1, true); path([M[R]![10]!, ...W[2]!], 1, true); path(colPath(7, 23, R), 0.5); path(colPath(10, 13, R - 2), 0.45); path(colPath(14, 13, 22), 0.6, true); path([...W[3]!], 0.5, true);

  // ---- the drawn lines
  const lines: CageLine[] = [
    { kind: 'bumper', name: 'frontBumperSeam', path: seamF.slice().reverse() }, { kind: 'bumper', name: 'rearBumperSeam', path: seamR },
    { kind: 'bonnet', name: 'bonnetShut', path: colPath(5, 1, 12) }, { kind: 'bonnet', name: 'bonnetFront', path: rowPath(1, 0, 5) }, { kind: 'bonnet', name: 'bonnetRear', path: rowPath(12, 0, 5) },
    { kind: 'lamp', name: 'lampTop', path: rowPath(1, 5, 11) }, { kind: 'lamp', name: 'grilleSide', path: [M[0]![1]!, M[1]![1]!] }, { kind: 'lamp', name: 'lampInner', path: [M[0]![2]!, M[1]![2]!] },
    { kind: 'crease', name: 'bonnetRise', path: colPath(1, 2, 12), w: 0.6 }, { kind: 'crease', name: 'shoulderF', path: colPath(7, 1, 12), w: 0.6 },
    { kind: 'crease', name: 'bumperStep', path: [], between: { a: BF[4]!, b: BF[5]!, t: 0.5 }, w: 0.6 }, { kind: 'panel', name: 'lipLine', path: BF[7]! },
    { kind: 'crease', name: 'archLipF', path: [], between: { a: colPath(11, 5, 11), b: colPath(10, 5, 11), t: 0.9 }, w: 0.6 },
    { kind: 'door', name: 'doorFront', path: rowPath(13, 8, 13) }, { kind: 'door', name: 'doorRear', path: rowPath(20, 8, 13) }, { kind: 'door', name: 'doorFoot', path: colPath(13, 13, 20) }, { kind: 'door', name: 'doorTop', path: colPath(8, 13, 20) },
    { kind: 'panel', name: 'sillLine', path: colPath(14, 12, 22) },
    { kind: 'glass', name: 'windscreen', path: [...rowPath(13, 0, 5), ...colPath(5, 14, 17), ...rowPath(17, 0, 4).reverse()] },
    { kind: 'glass', name: 'sideGlass', path: [...colPath(7, 13, 23), ...colPath(8, 13, 23).reverse()], closed: true }, { kind: 'trim', name: 'bPillar', path: [M[20]![7]!, M[20]![8]!], w: 2.5 },
    { kind: 'glass', name: 'rearWindow', path: [...rowPath(22, 0, 5), ...colPath(5, 23, 26), ...rowPath(26, 0, 4).reverse()] },
    { kind: 'crease', name: 'deckEdge', path: rowPath(R, 0, 7) }, { kind: 'crease', name: 'waist', path: colPath(10, 12, R - 2), w: 0.6 },
  ];
  const glass = o.glass ?? null, drawn = lines.filter(l => !(!glass && /^(windscreen|sideGlass|rearWindow|bPillar)$/.test(l.name)));
  const loops: Record<string, number[]> = { frontBumper: seamF, rearBumper: seamR, headLamp: [...rowPath(0, 2, 11), ...rowPath(1, 2, 11).reverse()], grille: [...rowPath(0, 0, 1), ...rowPath(1, 0, 1).reverse()],
    frontBumperFoot: BF[10]!, rearBumperFoot: BR[3]!, frontBumperArch: BF.map(r => r[0]!), rearBumperArch: BR.map(r => r[0]!), sillFoot: colPath(15, 11, 22) };

  // ---- the other half
  const n = P.length, mirror: number[] = []; for (let v = 0; v < n; v++) mirror.push(Math.abs(P[v]![1]) < 1e-6 ? v : pt([P[v]![0], -P[v]![1], P[v]![2]]));
  for (let v = n; v < P.length; v++) mirror.push(mirror.indexOf(v));
  const nf = F.length; for (let k = 0; k < nf; k++) { F.push(F[k]!.map(v => mirror[v]!).reverse()); tag.push({ ...tag[k]!, right: true }); }
  for (const [key, s] of [...sharp]) { const [a, b] = key.split('|').map(Number) as [number, number], mk = ekey(mirror[a]!, mirror[b]!); sharp.set(mk, s); if (crease.has(key)) crease.add(mk); }
  if (o.dims) { const f = frameOf(o.dims); for (let v = 0; v < P.length; v++) P[v] = f.at(P[v]!); }
  return { P, F, sharp, tag, M, W, crease, lines: drawn, loops, mirror };
}

/** the third cage's shell: subdivided once, its arches trued to the lip's radius with a lip and a well */
export function buildN33ShellV3(o: V3Opts = {}): Shell959 { const f = frameOf(o.dims);
  return shellFrom(buildCageV3(o), { arches: [{ x: f.archF[0], z: f.archF[1] }, { x: f.archR[0], z: f.archR[1] }], archR: V3.archR }); }
export type { Region };
