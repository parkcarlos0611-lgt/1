// The N33's third cage (docs/systems/117 §15, §16): the body remade for an angular car by the style standard
// (docs/systems/108): big near-flat panels, the curvature kept to narrow bands, every character line either a pair of
// support loops (two lines of cage points 10 .. 30 mm apart, so that the one level of subdivision,
// render/car/p959/subdiv.ts, rounds only the band between them and leaves the panels flat) or a hard line.
//
// The front third (rows 0 .. 13) is placed from curves read off the blueprint; from the screen's foot back the points
// are the second cage's (cage.ts: its rows 10 .. 26 fit the blueprint's side view) laid on this cage's columns, with
// the deck flattened, the rear arch given its flare, the tail panel and the rear bumper built again as a box with a
// shelf. The game still draws the second cage; this one is drawn by tools/ref/n33_gate.ts until it is approved.
//
// Units mm; x from the nose back, y from the centre line out (the half y >= 0 is authored, the other mirrored), z up.
// Read from the blueprint (docs/reference/bnr33/bp_line_4view_hires.png, 5.5 mm a pixel) and the photographs.
//
//   columns   0 the centre line
//             1 the bonnet's raised middle: its edge        2 the foot of the ramp down from it (28 mm out)
//             3 the bonnet's flank, half way out            4 the flank's edge (20 mm in from the shut line)
//             5 the bonnet's shut line (a shallow valley: the wing's crest stands above the bonnet's edge);
//               behind the cowl the screen's side edge, the roof's shoulder, the back window's side edge
//             6 the front wing's crest; the A pillar's crest, the drip rail, the C pillar's crest, the boot lid's side
//             7 half way to column 8: the wing's top, the roof's edge, the C pillar's flank, the deck's shoulder (and
//               under the deck's trailing edge the step that rounds the tail's corner)
//             8 the wing's shoulder crease, its top; the side glass's top; the rear quarter's shoulder
//             9 its foot (16 mm out, 17 mm down); the belt
//            10 the wing's side, half way down; the upper side
//            11 the waist line: from the lamp's tip over the front arch, along the doors, over the rear arch to the tail
//            12 over each arch the flare's outer ring (30 mm outside the lip); between them a line under the waist;
//               behind the rear arch the head of the rear bumper's seam
//            13 the bumper's seam from the lamp's tip to the arch, then the arches' lips; between them the door's
//               middle; behind the rear arch the rear bumper's crease line
//            14 .. 17 between the arches: the lower door's line, the door's foot, the skirt's crease, its foot
//   rows      0 the lamps' foot (the bumper's seam across the nose)
//             1 the lamps' middle (the lens is two faces: upright below, leaning back above)
//             2 the bonnet's and the wings' leading edge (the lamps' top; it runs out and back to the lamp's tip)
//             3 the leading edge's support, 24 mm behind it
//             4, 5 the brow (the bonnet's steep front)      6 .. 11 the bonnet, and the front arch's spokes
//            12 the arch's last spoke (then the lip runs down columns 11 .. 15) and the cowl's support (25 mm before it)
//            13 the bonnet's trailing edge (the cowl), and the flare's ring behind the arch
//            14 the screen's foot and the door's front edge   18 the screen's top   21 the B pillar, the door's rear edge
//            23 .. 27 the rear arch's spokes (23 the back window's top, 27 its foot)   30 the deck's trailing edge
// Under the front seam the front bumper hangs as a strip: the ledge that stands out ahead of the lamps (its inner
// support, its edge a quarter round of 10 mm in four lines), the upright face, the step in under the upper bar, the
// face's foot, and the lip. Behind the deck's trailing edge the tail wraps down to the rear bumper's crease line (the
// lamps' top, their foot, the seam, the shelf and its edge's quarter round, the face), and the rear bumper's lower
// part hangs under that line.
import { ekey, type V } from '../p959/subdiv';
import type { Cage959, CageLine, Mat, Region, Tag } from '../p959/cage';
import { shellFrom, type Shell959 } from '../p959/shell';
import { buildCage as buildSecond, type CageOpts } from './cage';
import { DIM, frameOf } from './frame';

/** the third cage's own measurements: the arch's lip (a 245/45 R17 tyre of radius 326 stands 24 mm inside it), the
 *  cage's ring that subdivides onto it, the flare's width, and the wheel's rim as it is seen (the flange, not the seat) */
export const V3 = { archR: 350, ringR: 355, flare: 30, rimR: 232, rows: 31, cols: 18, front: 14 } as const;
/** the second cage's column each of this cage's columns takes behind the cowl (between two: laid between them) */
const OLD_COL = [0, 1, 1.3, 1.6, 1.85, 2, 3, 3.5, 4, 5, 6, 7, 7.5, 8, 9, 10, 11, 12], OLD_ROW0 = 10;
/** the columns by name */
const CREST = 6, MID = 7, SHO = 8, BELT = 9, SIDE = 10, WAIST = 11, FLARE = 12, RING = 13, LOW = 14;

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
const yShut = pc([[308, 700], [500, 705], [1000, 710], [1400, 706], [1500, 698]]), zShut = pc([[308, 706], [400, 743], [500, 784], [700, 840], [1000, 869], [1300, 906], [1500, 928]]);
/** the wing's crest */
const yCrest = pc([[336, 726], [500, 740], [1000, 746], [1400, 742], [1500, 737]]), zCrest = pc([[336, 714], [400, 750], [500, 792], [700, 847], [1000, 876], [1300, 913], [1500, 930]]);
/** the shoulder crease's top (the side view's second line) */
const yShoulder = pc([[372, 762], [500, 783], [700, 792], [1000, 794], [1300, 786], [1500, 762]]), zShoulder = pc([[372, 705], [420, 738], [500, 778], [700, 833], [1000, 862], [1300, 900], [1500, 918]]);
/** the wing's side half way down */
const ySide = pc([[418, 792], [520, 832], [620, 852], [800, 862], [1100, 862], [1345, 850], [1420, 840]]), zSide = pc([[418, 678], [520, 722], [620, 752], [800, 782], [1000, 795], [1345, 815], [1420, 815]]);

/** the rows' places along the centre line (rows 2 .. 13), how much of the leading edge's sweep and of the cowl's each keeps */
const XC = [0, 0, 112, 136, 215, 320, 470, 620, 780, 940, 1090, 1220, 1305, 1330], FL = [0, 0, 1, 1, 0.9, 0.75, 0.5, 0.3, 0.12, 0, 0, 0, 0, 0], FC = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.3, 0.62, 1, 1];
/** the leading edge's and the cowl's sweep back at the bonnet's columns 0 .. 5 */
const LEAD = [0, 2, 7, 93, 180, 196], COWL = [0, 60, 72, 110, 167, 170];
/** the front arch's spokes (rows 6 .. 12): angles round the hub, from the rear horizontal over the top; then the lip down row 12 */
const SPOKE = [132, 114, 96, 78, 60, 44, 28], RING_DOWN = [28, 10.6, -6, -17, -28], RING_Y = [890, 886, 876, 864, 850];
/** the rear arch's (rows 23 .. 27), and the lip down row 23 ahead of it */
const SPOKE_R = [154, 122, 90, 58, 26], RING_DOWN_R = [169.5, 186, 197, 208];
const HUB = { x: DIM.axleF, z: DIM.hubZ }, HUB_R = { x: DIM.axleR, z: DIM.hubZ }, ring = (deg: number, r: number, y: number, h: { x: number; z: number } = HUB): V => [h.x + r * Math.cos(deg * Math.PI / 180), y, h.z + r * Math.sin(deg * Math.PI / 180)];
/** the front of a circle round the front hub at a height, the back of one round the rear hub */
const ringAt = (z: number, r: number) => HUB.x - Math.sqrt(Math.max(0, r * r - (z - HUB.z) * (z - HUB.z))), ringAtR = (z: number, r: number) => HUB_R.x + Math.sqrt(Math.max(0, r * r - (z - HUB_R.z) * (z - HUB_R.z)));

/** rows 0 and 2 (the lamps' foot and top), placed by hand; row 1 lies between them, the lens pushed 9 mm forward of the chord */
const FOOT = T(`78 0 592; 82 250 592; 88 330 592; 110 400 592; 135 480 592; 168 560 592; 215 640 592; 240 672 592; 262 700 592; 310 745 594; 345 772 596; 372 788 598; 386 794 599; 400 800 600`);
const TOP = T(`112 0 690; 114 283 692; 119 311 693; 205 540 702; 292 680 706; 308 700 706; 336 726 714; 354 744 711; 372 762 705; 392 776 698; 418 792 678; 434 801 658; 446 808 634; 456 812 606`);
/** the crest, the shoulder's two lines and the side (columns 6, 8, 9, 10) at rows 3 .. 5: x alone (their y and z from the curves) */
const WING_X: number[][] = [[358, 396, 416, 448], [404, 445, 465, 505], [470, 520, 540, 592]];
/** the waist line, the line under it and the seam at rows 3 .. 4 (row 5's are placed with the flare's corner) */
const WAIST_F = T(`490 824 650; 570 853 664`), UNDER_F = T(`498 828 625; 578 858 622`), SEAM_SIDE = T(`505 832 603; 585 862 598`);
/** the waist line over the front arch (rows 5 .. 12): above the flare's ring, into the door's line */
const WAIST_ARCH = T(`650 866 684; 760 868 706; 840 870 722; 925 872 732; 1020 872 734; 1118 872 732; 1215 871 728; 1290 870 724`);
/** row 13 at columns 6, 8, 9, 10, 11, 12: the wing at the A pillar's foot */
const ROW13 = T(`1490 737 930; 1492 762 918; 1490 778 902; 1420 840 815; 1345 870 722; 1330 874 600`);
/** the front bumper's outline in plan (its widest line: the ledge's edge and the face) under each of the seam's
 *  points from the third (the first two are on the arch's lip and the flare's ring) */
const OUTLINE: [number, number][] = [[520, 878], [470, 870], [425, 862], [398, 856], [372, 849], [345, 840], [318, 830], [266, 806], [218, 776], [170, 735], [146, 706], [124, 675], [84, 590], [58, 500], [46, 445], [36, 400], [17, 250], [8, 0]];
/** the rear bumper's outline in plan (its crease line, the widest): the arch's lip, a point along the side, the foot of
 *  the seam's upright, the corner; then the back, the eight steps in to the centre line (the first rounds the corner) */
const SIDE_R: [number, number][] = [[0, 884], [4190, 824], [4405, 756], [4484, 724]], BACK_R: [number, number][] = [[4560, 652], [4612, 550], [4619, 516], [4636, 400], [4645, 330], [4651, 262], [4653, 130], [4655, 0]];
/** the tail's lines under the deck's trailing edge at the eight steps in from the corner (x, y, and z where it is not
 *  the line's): the lamps' top, their foot, the seam (the tail panel's foot on the shelf) */
const TAIL_TOP: V[] = T(`4512 612 902; 4553 527 902; 4559 497 902; 4566 420 902; 4572 340 902; 4577 262 902; 4583 130 902; 4584 0 902`);
const TAIL_FOOT: V[] = T(`4530 632 750; 4570 536 732; 4575 504 732; 4581 425 732; 4586 343 732; 4590 264 732; 4595 131 732; 4596 0 732`);
const TAIL_SEAM: V[] = T(`4535 640 692; 4576 540 692; 4581 508 692; 4587 428 692; 4592 345 692; 4596 266 692; 4601 132 692; 4602 0 692`);
/** where the shelf's five lines cross the corner cell (the bumper's flat side behind the seam's upright): the part of
 *  the way from the seam's side of the cell to its corner on the crease line */
const TURN = [0.1, 0.2, 0.3, 0.4, 0.52];

export interface V3Opts extends CageOpts { /** the gate's picture: the lamps', the grille's and the bumper openings' places shown dark (the lump paints them) */ face?: boolean }
export function buildCageV3(o: V3Opts = {}): Cage959 { const NR = V3.rows, NC = V3.cols, NF = V3.front, R = NR - 1;
  const P: V[] = [], F: number[][] = [], tag: Tag[] = [], sharp = new Map<string, number>(), crease = new Set<string>();
  const pt = (p: V) => P.push([p[0], p[1], p[2]]) - 1, quad = (a: number, b: number, c: number, d: number, t: Tag) => { F.push([a, b, c, d]); tag.push(t); };
  const G: (V | null)[][] = Array.from({ length: NR }, () => new Array<V | null>(NC).fill(null));

  // ---- the front: rows 0 .. 13
  FOOT.forEach((p, j) => { G[0]![j] = p; }); TOP.forEach((p, j) => { G[2]![j] = p; });
  FOOT.forEach((p, j) => { const m = lerp(p, TOP[j]!, 0.45), bulge = j < 2 || j === RING ? 0 : j === 2 || j >= WAIST ? 5 : 9; G[1]![j] = [m[0] - bulge, m[1], m[2]]; });
  for (let i = 3; i < NF; i++) { const row = G[i]!, fade = Math.min(1, (i - 2) / 3), bx = (j: number) => XC[i]! + LEAD[j]! * FL[i]! + COWL[j]! * FC[i]!;
    // the bonnet: the raised middle, the ramp, the flat flank down to the shut line
    row[0] = [bx(0), 0, zC(bx(0))]; row[1] = [bx(1), yRise(bx(1)), zC(bx(1)) - 3 * fade]; row[2] = [bx(2), yRise(bx(2)) + 28, zC(bx(2)) - 11 * fade];
    row[5] = [bx(5), yShut(bx(5)), zShut(bx(5))];
    for (const [j, t] of [[3, 0.5], [4, 1 - 20 / (row[5]![1] - row[2]![1])]] as const) { const q = lerp(row[2]!, row[5]!, t); row[j] = [bx(j), q[1], q[2]]; }
    if (i === 13) { [CREST, SHO, BELT, SIDE, WAIST, FLARE].forEach((j, k) => { row[j] = ROW13[k]!; }); row[MID] = lerp(row[CREST]!, row[SHO]!, 0.5); RING_DOWN.forEach((a, k) => { row[RING + k] = ring(k ? a : 20, V3.ringR + V3.flare, RING_Y[k]! - (k ? 10 : 11)); }); continue; }
    // the lip (column 13), the flare's ring (12) and the waist line over it (11); ahead of the arch the seam, the line under the waist and the waist from the lamp's tip
    if (i <= 4) { row[WAIST] = WAIST_F[i - 3]!; row[FLARE] = UNDER_F[i - 3]!; row[RING] = SEAM_SIDE[i - 3]!; }
    else { row[WAIST] = WAIST_ARCH[i - 5]!;
      if (i === 5) { row[FLARE] = ring(133, V3.ringR + V3.flare + 4, 878); row[RING] = [ringAt(594, V3.ringR + V3.flare), 879, 594]; }
      else { row[RING] = ring(SPOKE[i - 6]!, V3.ringR, 890); row[FLARE] = ring(i === 6 ? 126 : i === 12 ? 34 : SPOKE[i - 6]!, V3.ringR + V3.flare, 879); } }
    // the wing: its crest, its shoulder crease (two lines), its side
    const wx = i <= 5 ? WING_X[i - 3]! : [0.1, 0.28, 0.34, 0.62].map(w => row[5]![0] + (row[RING]![0] - row[5]![0]) * w), band = i === 3 ? [15, 10] : i === 4 ? [16, 14] : [16, 17];
    row[CREST] = [wx[0]!, yCrest(wx[0]!), zCrest(wx[0]!)]; row[SHO] = [wx[1]!, yShoulder(wx[1]!), zShoulder(wx[1]!)]; row[BELT] = [wx[2]!, yShoulder(wx[2]!) + band[0]!, zShoulder(wx[2]!) - band[1]!]; row[SIDE] = [wx[3]!, ySide(wx[3]!), zSide(wx[3]!)];
    row[MID] = lerp(row[CREST]!, row[SHO]!, 0.5);
    if (i === 12) RING_DOWN.forEach((a, k) => { if (k) row[RING + k] = ring(a, V3.ringR, RING_Y[k]!); }); }

  // ---- behind the cowl: the second cage's rows from the screen's foot back, on this cage's columns
  const old = buildSecond({ glass: o.glass ?? null }), oldAt = (i: number, c: number): V => { const c0 = Math.floor(c), p = old.P[old.M[i]![c0]!]!; return c === c0 ? p : lerp(p, old.P[old.M[i]![c0 + 1]!]!, c - c0); };
  for (let i = NF; i < NR; i++) for (let j = 0; j < NC; j++) { const oi = i - NF + OLD_ROW0, c = OLD_COL[j]!; if (old.M[oi]![Math.ceil(c)]! >= 0 && old.M[oi]![Math.floor(c)]! >= 0) G[i]![j] = oldAt(oi, c).slice() as V; }
  const oldFace = new Map<string, number>(); old.F.forEach((f, k) => oldFace.set(f.slice().sort((a, b) => a - b).join(','), k));
  const oldCell = (oi: number, oj: number): Tag => { const k = oldFace.get([old.M[oi]![oj]!, old.M[oi + 1]![oj]!, old.M[oi + 1]![oj + 1]!, old.M[oi]![oj + 1]!].sort((a, b) => a - b).join(',')); return k === undefined ? { region: 'shell', mat: 'paint', panel: 'wingR' } : { ...old.tag[k]! }; };
  // the roof's edge and the C pillar: the line half way between the drip rail and the side glass's top stands 4 mm out of
  // their chord (the edge a round of four lines), and on the pillar's flank 3 mm
  for (let i = 16; i <= 26; i++) { const a = G[i]![CREST]!, b = G[i]![SHO]!, m = G[i]![MID]!, d = Math.hypot(b[1] - a[1], b[2] - a[2]) || 1, k = i === 16 ? 2 : i <= 22 ? 4 : 3; m[1] += (a[2] - b[2]) / d * k; m[2] += (b[1] - a[1]) / d * k; }
  // the rear arch: its lip on the cage's ring and the flare's ring 30 mm outside it over the top (it fades at both ends)
  SPOKE_R.forEach((a, k) => { const i = 23 + k; G[i]![RING] = ring(a, V3.ringR, G[i]![RING]![1], HUB_R); G[i]![FLARE] = ring(k === 0 ? 148 : k === 4 ? 32 : a, V3.ringR + V3.flare, 879, HUB_R); });
  RING_DOWN_R.forEach((a, k) => { G[23]![LOW + k] = ring(a, V3.ringR, G[23]![LOW + k]![1], HUB_R); });
  // the boot deck: flat from the centre line out to the lid's side line
  for (let i = 28; i <= R; i++) { const a = G[i]![0]!, b = G[i]![CREST]!; for (let j = 1; j < CREST; j++) { const p = G[i]![j]!; p[2] = a[2] + (b[2] - a[2]) * p[1] / b[1]; } }
  // behind the rear arch: the waist line runs on to the tail at z 775 (there it becomes the lamps' foot); under it the
  // seam's head (the bumper's top, z 692) and the crease line (z 505); the seam's upright at x 4405 (the blueprint's)
  G[R - 1]![WAIST] = [4390, 756, 775]; G[R - 1]![FLARE] = [4405, 752, 692]; G[R - 1]![RING] = [SIDE_R[2]![0], SIDE_R[2]![1], 505];
  G[R]![SIDE] = [4458, 700, 838]; G[R]![WAIST] = [4466, 712, 775]; G[R]![FLARE] = [4470, 716, 692]; G[R]![RING] = [SIDE_R[3]![0], SIDE_R[3]![1], 505];

  const M: number[][] = G.map(r => r.map(p => p ? pt(p) : -1));
  const shown = (t: Tag, mat: Mat): Tag => o.face ? { ...t, mat } : t;
  const cell = (i: number, j: number): Tag => {
    if (i >= NF) return oldCell(i - NF + OLD_ROW0, j < 1 ? 0 : j < 5 ? 1 : j === 5 ? 2 : j < SHO ? 3 : j < WAIST ? j - 4 : j < RING ? 7 : j - 5);
    if (i < 2) return j < 1 ? shown({ region: 'shell', mat: 'paint', panel: 'nose', socket: 'grille', was: 'grille' }, 'grille') : j < 2 ? { region: 'shell', mat: 'paint', panel: 'nose' } : shown({ region: 'shell', mat: 'paint', panel: 'nose', socket: 'headLamp', was: 'lens' }, 'lens');
    if (j >= LOW + 1) return { region: 'shell', mat: 'paint', panel: 'sill' };
    return { region: 'shell', mat: 'paint', panel: i < 13 && j < 5 ? 'bonnet' : 'wingF' }; };
  const hard = (a: number, b: number, s = 1, split = false) => { sharp.set(ekey(a, b), Math.max(s, sharp.get(ekey(a, b)) ?? 0)); if (split) crease.add(ekey(a, b)); };
  const path = (p: number[], s = 1, split = false) => { for (let q = 0; q + 1 < p.length; q++) hard(p[q]!, p[q + 1]!, s, split); };
  const colPath = (j: number, i0: number, i1: number) => Array.from({ length: i1 - i0 + 1 }, (_, k) => M[i0 + k]![j]!), rowPath = (i: number, j0: number, j1: number) => Array.from({ length: j1 - j0 + 1 }, (_, k) => M[i]![j0 + k]!);
  const BUMPER_R_TAG: Tag = { region: 'bumperR', mat: 'paint', panel: 'bumperR' };

  // ---- the tail: lines wrapped round under the deck's trailing edge, each from the corner column (row 30) in to the
  //      centre line. The deck's edge itself, the lamps' top, middle and foot, the seam; then the bumper's upper part:
  //      the shelf's inner support, its edge (a quarter round of 12 mm: three lines), the face's top; last the crease line.
  //      The shelf has no depth at the corner column. Its five lines turn down there, across the cell before it (the
  //      bumper's flat side behind the seam's upright), and run on down the bumper's lower part
  const K = 8, at = (l: V[]) => l.map(p => pt(p));
  const tailLines: number[][] = [rowPath(R, 0, SHO).reverse(), [M[R]![BELT]!, ...at(TAIL_TOP)], [M[R]![SIDE]!, ...at(TAIL_TOP.map((p, k) => lerp(p, TAIL_FOOT[k]!, 0.5)))], [M[R]![WAIST]!, ...at(TAIL_FOOT)], [M[R]![FLARE]!, ...at(TAIL_SEAM)]];
  const SEAM_LINE = 4, SHELF: { t: (d: number) => number; z: number }[] = [{ t: d => 12 / d, z: 690 }, { t: d => 1 - 12 / d, z: 686 }, { t: d => 1 - 6 / d, z: 684.4 }, { t: d => 1 - 1.6 / d, z: 680 }, { t: () => 1, z: 674 }];
  const cA = P[M[R - 1]![FLARE]!]!, cB = P[M[R]![FLARE]!]!, cC = P[M[R]![RING]!]!, cD = P[M[R - 1]![RING]!]!;
  const turnE = TURN.map(t => pt(lerp(cB, cC, t))), turnB = TURN.map(t => pt(lerp(cA, cC, t))), turnC = TURN.map(t => pt(lerp(cD, cC, t)));
  SHELF.forEach((L, q) => tailLines.push([turnE[q]!, ...TAIL_SEAM.map(([x, y], k) => { const c = BACK_R[k]!, d = Math.hypot(c[0] - x, c[1] - y), t = Math.min(1, Math.max(q ? 0.3 + 0.15 * q : 0.25, L.t(d))); return pt([x + (c[0] - x) * t, y + (c[1] - y) * t, L.z]); })]));
  tailLines.push([M[R]![RING]!, ...BACK_R.map(([x, y]) => pt([x, y, 505]))]);
  for (let m = 0; m + 1 < tailLines.length; m++) for (let k = 0; k < K; k++) quad(tailLines[m]![k]!, tailLines[m]![k + 1]!, tailLines[m + 1]![k + 1]!, tailLines[m + 1]![k]!,
    m >= SEAM_LINE ? BUMPER_R_TAG : (m === 1 || m === 2) && k < 4 ? shown({ region: 'shell', mat: 'paint', panel: 'tailPanel', socket: 'tailLamp', was: 'lamp' }, 'lamp') : { region: 'shell', mat: 'paint', panel: m === 0 ? 'bootLid' : 'tailPanel' });
  // the corner cell: the five lines' turns
  { const A = M[R - 1]![FLARE]!, B = M[R]![FLARE]!, C = M[R]![RING]!, D = M[R - 1]![RING]!, n = TURN.length;
    quad(A, B, turnE[0]!, turnB[0]!, BUMPER_R_TAG); quad(A, turnB[0]!, turnC[0]!, D, BUMPER_R_TAG);
    for (let q = 0; q + 1 < n; q++) { quad(turnB[q]!, turnE[q]!, turnE[q + 1]!, turnB[q + 1]!, BUMPER_R_TAG); quad(turnB[q]!, turnB[q + 1]!, turnC[q + 1]!, turnC[q]!, BUMPER_R_TAG); }
    quad(turnB[n - 1]!, turnE[n - 1]!, C, turnC[n - 1]!, BUMPER_R_TAG); }

  // ---- the main grid: every cell whose four points are there
  for (let i = 0; i + 1 < NR; i++) for (let j = 0; j + 1 < NC; j++) { const a = M[i]![j]!, b = M[i + 1]![j]!, c = M[i + 1]![j + 1]!, d = M[i]![j + 1]!; if (a < 0 || b < 0 || c < 0 || d < 0 || (i === R - 1 && j === FLARE)) continue; quad(a, b, c, d, cell(i, j)); }
  const strip = (top: number[], lines: V[][], tagOf: (m: number, k: number) => Tag, front: boolean) => { const rows: number[][] = [top, ...lines.map(l => l.map(pt))];
    for (let m = 0; m + 1 < rows.length; m++) for (let k = 0; k + 1 < top.length; k++) { const q = [rows[m]![k]!, rows[m]![k + 1]!, rows[m + 1]![k + 1]!, rows[m + 1]![k]!]; if (front) q.reverse(); quad(q[0]!, q[1]!, q[2]!, q[3]!, tagOf(m, k)); }
    return rows; };

  // ---- the rear bumper's lower part under its crease line (from the arch back along column 13, the shelf's lines'
  //      ends across the corner cell's foot, then the tail's last line in to the centre line): the face tucking
  //      under, its foot, the underside
  const outR: [number, number][] = [...SIDE_R.slice(0, 3), ...TURN.map(t => [SIDE_R[2]![0] + (SIDE_R[3]![0] - SIDE_R[2]![0]) * t, SIDE_R[2]![1] + (SIDE_R[3]![1] - SIDE_R[2]![1]) * t] as [number, number]), SIDE_R[3]!, ...BACK_R], NB = outR.length - BACK_R.length;
  const creaseR = [...colPath(RING, R - 3, R - 1), ...turnC, ...tailLines[tailLines.length - 1]!], seamR = [...colPath(RING, R - 3, R - 1), M[R - 1]![FLARE]!, ...tailLines[SEAM_LINE]!];
  const lowerR: V[][] = [{ in: [4, 30], z: [420, 420] }, { in: [12, 60], z: [292, 330] }, { in: [60, 120], z: [286, 322] }].map(L => outR.map((c, k) => { const back = k >= NB + 1 ? 1 : k === NB ? 0.6 : k === NB - 1 ? 0.25 : 0, z = L.z[0]! + (L.z[1]! - L.z[0]!) * back, inn = L.in[0]! + (L.in[1]! - L.in[0]!) * back;
    if (k === 0) return [ringAtR(z, V3.ringR), c[1] - inn, z] as V;
    const a = outR[k - 1]!, b = outR[k + 1] ?? [a[0], -a[1]] as [number, number], a2 = k === 1 ? [P[creaseR[0]!]![0], 884] as [number, number] : a, tx = b[0] - a2[0], ty = b[1] - a2[1], tl = Math.hypot(tx, ty), n: [number, number] = [ty / tl, -tx / tl], sg = n[0] * (c[0] - 2000) + n[1] * c[1] > 0 ? 1 : -1;
    return [c[0] - n[0] * sg * inn, Math.max(0, c[1] - n[1] * sg * inn), z] as V; }));
  const BR = strip(creaseR, lowerR, () => BUMPER_R_TAG, false);

  // ---- the front bumper under its seam (from the arch forward along column 13, then row 0 in to the centre line)
  const seamF = [...colPath(RING, 1, 6).reverse(), ...rowPath(0, 0, RING).reverse()], NS = seamF.length;
  const O: [number, number][] = [[0, 0], [P[seamF[1]!]![0], P[seamF[1]!]![1]], ...OUTLINE];
  /** the bumper's lines: how far each stands in from (-) or out of the outline, and its height (null: from the seam's).
   *  The first five are the ledge: its inner support, then the edge as a quarter round of 10 mm in four lines */
  const LINES: { out: number; z: number | null; dz?: number }[] = [{ out: NaN, z: null, dz: -2 }, { out: NaN, z: null, dz: -5 }, { out: NaN, z: null, dz: -6.3 }, { out: NaN, z: null, dz: -10 }, { out: 0, z: null, dz: -15 },
    { out: 0, z: 444 }, { out: -9, z: 422 }, { out: -9, z: 275 }, { out: -9, z: 240 }, { out: -3, z: 232 }, { out: 10, z: 152 }, { out: -30, z: 138 }], STEP = 6, FOOT_LINE = 9, LIP_EDGE = 11;
  const bumper: V[][] = LINES.map((L, m) => seamF.map((v, k) => { const s = P[v]!, z = L.z ?? s[2] + L.dz!, lipOut = L.out === 10 ? (k >= 12 ? 10 : k <= 3 ? 4 : 4 + (k - 3) * 0.66) : L.out;
    if (k < 2) { const r = k ? V3.ringR + V3.flare : V3.ringR, y = (k ? 879 : 890) + (m < 4 ? 0 : Math.min(0, lipOut)), zz = m < 5 ? s[2] - [5, 10, 15, 21, 28][m]! : z; return [ringAt(zz, r), y, zz] as V; }   // by the arch the ledge is gone: its lines spread down the flat side
    const a = O[k - 1]!, b = O[k + 1] ?? [O[k - 1]![0], -O[k - 1]![1]] as [number, number], c = O[k]!, tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty), n: [number, number] = [ty / tl, -tx / tl], sg = n[0] * (c[0] - 2000) + n[1] * c[1] > 0 ? 1 : -1;
    if (m < 4) { const d = Math.hypot(c[0] - s[0], c[1] - s[1]), t = d < 45 ? [0.25, 0.5, 0.7, 0.88][m]! : [12 / d, 1 - 10 / d, 1 - 5 / d, 1 - 1.3 / d][m]!; return [s[0] + (c[0] - s[0]) * t, s[1] + (c[1] - s[1]) * t, z] as V; }
    return [c[0] + n[0] * sg * lipOut, Math.max(0, c[1] + n[1] * sg * lipOut), z] as V; }));
  // its faces: the paint, the two openings' places (the centre intake; the corner pocket of the lamp and the duct), the dark lip
  const bumperTag = (m: number, k: number): Tag => { const kk = NS - 2 - k;   // cells counted from the centre line out
    if (m >= FOOT_LINE) return { region: 'bumperF', mat: 'dark', panel: 'lipF' };
    if (m === STEP + 1 && kk < 2) return shown({ region: 'bumperF', mat: 'paint', panel: 'bumperF', socket: 'intake', was: 'grille' }, 'grille');
    if (m === STEP + 1 && kk >= 3 && kk < 8) return shown({ region: 'bumperF', mat: 'paint', panel: 'bumperF', socket: 'duct', was: 'grille' }, 'grille');
    return { region: 'bumperF', mat: 'paint', panel: 'bumperF' }; };
  const BF = strip(seamF, bumper, bumperTag, true);

  // ---- hard edges (positions) and creases (split shading). The panels' folds are not here: they are support loops,
  //      rounded by the subdivision and shaded smooth
  path(seamF); path(seamR);
  path(rowPath(0, 0, RING), 1, true);                                         // the lamps' foot on the bumper's ledge
  path(rowPath(2, 0, RING), 1, true);                                         // the bonnet's and the wings' leading edge over the lamps
  path(rowPath(13, 0, 5), 1, true);                                           // the cowl
  path(BF[FOOT_LINE]!, 1, true); path(BF[LIP_EDGE]!, 1, true); path(colPath(RING, 0, 5), 1, true);   // the painted face's foot over the lip, the lip's edge; the seam along the side where the ledge still stands
  // the cabin's and the tail's: the screen's foot, the belt and the side glass's top, the windows' edges, the C pillar's
  // crest, the deck's trailing edge, the tail panel's foot on the shelf, the rear bumper's foot, the shoulder, the waist,
  // the skirt's step
  path(rowPath(14, 0, SHO), 1, true); path(colPath(BELT, 14, 24), 1, true); path(colPath(SHO, 14, 24), 1, true);
  path([...rowPath(14, 0, 5), ...colPath(5, 15, 18)]); path(rowPath(18, 0, 5)); path([...rowPath(23, 0, 5), ...colPath(5, 24, 27)]); path(rowPath(27, 0, 5));
  path(colPath(CREST, 23, 27), 0.5);
  path(rowPath(R, 0, SHO), 1, true); path(tailLines[SEAM_LINE]!, 1, true); path(BR[2]!, 1, true);
  path(colPath(SHO, 24, R), 0.5); path(colPath(WAIST, 14, R), 0.45); path(colPath(LOW + 1, 14, 22), 1, true); path(colPath(LOW + 2, 14, 22), 1, true);

  // ---- the drawn lines
  const lines: CageLine[] = [
    { kind: 'bumper', name: 'frontBumperSeam', path: seamF.slice().reverse() }, { kind: 'bumper', name: 'rearBumperSeam', path: seamR },
    { kind: 'bonnet', name: 'bonnetShut', path: colPath(5, 2, 13) }, { kind: 'bonnet', name: 'bonnetFront', path: rowPath(2, 0, 5) }, { kind: 'bonnet', name: 'bonnetRear', path: rowPath(13, 0, 5) },
    { kind: 'lamp', name: 'lampTop', path: rowPath(2, 5, RING) }, { kind: 'lamp', name: 'grilleSide', path: colPath(1, 0, 2) }, { kind: 'lamp', name: 'lampInner', path: colPath(2, 0, 2) },
    { kind: 'crease', name: 'bonnetRise', path: colPath(1, 3, 13), w: 0.6 }, { kind: 'crease', name: 'shoulderF', path: colPath(SHO, 2, 13), w: 0.6 },
    { kind: 'crease', name: 'bumperStep', path: [], between: { a: BF[STEP]!, b: BF[STEP + 1]!, t: 0.5 }, w: 0.6 }, { kind: 'panel', name: 'lipLine', path: BF[FOOT_LINE]! },
    { kind: 'crease', name: 'archLipF', path: [], between: { a: colPath(RING, 6, 12), b: colPath(FLARE, 6, 12), t: 0.9 }, w: 0.6 }, { kind: 'crease', name: 'archLipR', path: [], between: { a: colPath(RING, 23, 27), b: colPath(FLARE, 23, 27), t: 0.9 }, w: 0.6 },
    { kind: 'door', name: 'doorFront', path: rowPath(14, BELT, LOW + 1) }, { kind: 'door', name: 'doorRear', path: rowPath(21, BELT, LOW + 1) }, { kind: 'door', name: 'doorFoot', path: colPath(LOW + 1, 14, 21) }, { kind: 'door', name: 'doorTop', path: colPath(BELT, 14, 21) },
    { kind: 'panel', name: 'sillLine', path: colPath(LOW + 2, 13, 23) },
    { kind: 'glass', name: 'windscreen', path: [...rowPath(14, 0, 5), ...colPath(5, 15, 18), ...rowPath(18, 0, 4).reverse()] },
    { kind: 'glass', name: 'sideGlass', path: [...colPath(SHO, 14, 24), ...colPath(BELT, 14, 24).reverse()], closed: true }, { kind: 'trim', name: 'bPillar', path: [M[21]![SHO]!, M[21]![BELT]!], w: 2.5 },
    { kind: 'glass', name: 'rearWindow', path: [...rowPath(23, 0, 5), ...colPath(5, 24, 27), ...rowPath(27, 0, 4).reverse()] },
    { kind: 'trim', name: 'dripRail', path: colPath(CREST, 14, 23) },
    { kind: 'boot', name: 'bootLid', path: [...rowPath(27, 0, CREST), ...colPath(CREST, 28, R), ...rowPath(R, 0, CREST - 1).reverse()] },
    { kind: 'crease', name: 'deckEdge', path: rowPath(R, 0, SHO) }, { kind: 'crease', name: 'waist', path: colPath(WAIST, 2, R), w: 0.6 }, { kind: 'crease', name: 'shoulder', path: colPath(SHO, 24, R), w: 0.6 },
    { kind: 'crease', name: 'bumperCreaseR', path: tailLines[tailLines.length - 1]!, w: 0.6 }, { kind: 'panel', name: 'tailFoot', path: tailLines[SEAM_LINE]! },
  ];
  const glass = o.glass ?? null, drawn = lines.filter(l => !(!glass && /^(windscreen|sideGlass|rearWindow|bPillar|dripRail)$/.test(l.name)));
  const loops: Record<string, number[]> = { frontBumper: seamF, rearBumper: seamR, headLamp: [...rowPath(0, 2, RING), ...rowPath(2, 2, RING).reverse()], grille: [...rowPath(0, 0, 1), ...rowPath(2, 0, 1).reverse()],
    tailLamp: [...tailLines[1]!.slice(0, 5), ...tailLines[3]!.slice(0, 5).reverse()], frontBumperFoot: BF[BF.length - 1]!, rearBumperFoot: BR[BR.length - 1]!, frontBumperArch: BF.map(r => r[0]!), rearBumperArch: BR.map(r => r[0]!), sillFoot: colPath(NC - 1, 12, 23) };

  // ---- the other half
  const n = P.length, mirror: number[] = []; for (let v = 0; v < n; v++) mirror.push(Math.abs(P[v]![1]) < 1e-6 ? v : pt([P[v]![0], -P[v]![1], P[v]![2]]));
  for (let v = n; v < P.length; v++) mirror.push(mirror.indexOf(v));
  const nf = F.length; for (let k = 0; k < nf; k++) { F.push(F[k]!.map(v => mirror[v]!).reverse()); tag.push({ ...tag[k]!, right: true }); }
  for (const [key, s] of [...sharp]) { const [a, b] = key.split('|').map(Number) as [number, number], mk = ekey(mirror[a]!, mirror[b]!); sharp.set(mk, s); if (crease.has(key)) crease.add(mk); }
  if (o.dims) { const f = frameOf(o.dims); for (let v = 0; v < P.length; v++) P[v] = f.at(P[v]!); }
  return { P, F, sharp, tag, M, W: tailLines, crease, lines: drawn, loops, mirror };
}

/** the third cage's shell: subdivided once, its arches trued to the lip's radius with a lip and a well */
export function buildN33ShellV3(o: V3Opts = {}): Shell959 { const f = frameOf(o.dims);
  return shellFrom(buildCageV3(o), { arches: [{ x: f.archF[0], z: f.archF[1] }, { x: f.archR[0], z: f.archR[1] }], archR: V3.archR }); }
export type { Region };
