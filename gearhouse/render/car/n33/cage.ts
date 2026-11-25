// The N33's control cage (docs/systems/117 R1: the frame "차체 B", the first front-engined coupe's): a coarse mesh of
// quads placed by hand on the blueprint (docs/reference/bnr33/bp_line_4view_hires.png, 5.5 mm a pixel), its lines of
// points following the car's own lines. One level of subdivision (render/car/p959/subdiv.ts) makes the shell from it,
// finished as the 959's is (render/car/p959/shell.ts shellFrom). The lump has no openings: the lamps', the grille's,
// the glass's and the tail lamps' cells are body-coloured panels that keep their socket's tag for the parts to come.
// Units mm; x from the nose back, y from the centre line out (the half y >= 0 is authored, the other mirrored), z up
// from the ground. Sizes: length 4675, width 1780, height 1364, wheelbase 2720 (axles at 950 and 3670).
//
// The main sheet is a grid: ROWS run across the car (0 the front bumper's seam .. 26 the boot deck's trailing edge),
// COLUMNS run along it (0 the centre line .. 11 the side skirt's foot). A row is not a flat cut: it slides to lie on
// the car's lines (the screen's foot, the door's edges, the arches' spokes).
//   columns  0 centre line   1 a third out   2 the bonnet's raised middle's edge / the screen's edge / the roof's edge /
//            the back window's edge          3 the bonnet's shut line / the A pillar's crest / the drip rail / the C
//            pillar's outer edge / the boot lid's side   4 the front wing's crest / the side glass's top / the rear
//            quarter's shoulder crease       5 the wing's shoulder / the belt (the side glass's foot)   6 the upper side
//            / the tail lamps' top           7 the waist (the widest: the arches' tops, the door's character line) / the
//            tail lamps' foot                8 the bumpers' seams fore and aft; between the arches the lower door
//            9 the door's foot (the sill's top)   10 the side skirt's crease   11 the skirt's foot
//   rows     0 the front seam  1 the lamps' middle  2 the bonnet's leading edge (the lamps' top)  5-9 the front arch
//            10 the screen's foot and the door's front edge   14 the screen's top   17 the door's rear edge (the B
//            pillar)   19-23 the rear arch; 19 the back window's top, 20 the quarter glass's point   23 the back
//            window's foot   26 the deck's trailing edge (the tail panel's top)
import { ekey, type V } from '../p959/subdiv';
import type { Cage959, CageLine, Mat, Region, Tag } from '../p959/cage';
import type { GlassId } from '../../../core/frames';
import { DIM, frameOf, type FrameDims } from './frame';

export { DIM };
export const NR = 27, NC = 12;
/** the arches: the hubs, the cage's radius (the subdivided ring lands on archR), the rows, the top column */
export const ARCH = { f: { x: DIM.axleF, z: DIM.hubZ, rows: [5, 9] as [number, number] }, r: { x: DIM.axleR, z: DIM.hubZ, rows: [19, 23] as [number, number] }, rc: 377, top: 7 };

const T = (s: string): (V | null)[] => s.trim().split(/\s*[;\n]\s*/).map(r => r.trim() === '-' ? null : r.trim().split(/[\s,]+/).map(Number) as V);
/** the columns, one row a line: x y z */
const COLS: (V | null)[][] = [
  // 0
  T(`28 0 572; 74 0 636; 108 0 705; 280 0 800; 480 0 858; 680 0 889; 860 0 912; 1040 0 935; 1200 0 950; 1300 0 957.1
     1370 0 962; 1540 0 1060; 1710 0 1155; 1880 0 1245; 2060 0 1320; 2300 0 1350; 2540 0 1363; 2790 0 1359.5; 2980 0 1350; 3170 0 1333
     3400 0 1278; 3620 0 1213; 3830 0 1140; 4040 0 1050; 4200 0 1020; 4350 0 1013; 4530 0 1002`),
  // 1
  T(`32 170 572; 77 170 636; 112 170 705; 280 149.2 798; 480 157.6 856; 680 166 887; 860 173.5 910; 1040 181.1 933; 1200 187.8 948; 1300 192 955.1
     1373 240 961; 1548 235 1058; 1718 230 1152; 1888 225 1241; 2068 215 1316; 2300 200 1346; 2540 200 1358; 2790 200 1355; 2980 200 1345; 3172 200 1328
     3402 200 1273; 3622 200 1208; 3832 200 1135; 4042 200 1046; 4201 200 1019; 4351 200 1012; 4529 200 1002`),
  // 2
  T(`52 330 572; 94 330 635; 128 330 704; 280 298.4 793; 480 315.2 851; 680 332 882; 860 347.1 905; 1040 362.2 928; 1200 375.6 943; 1300 384 950.1
     1392 470 955; 1556 460 1050; 1726 450 1143; 1896 440 1232; 2076 425 1305; 2300 410 1330; 2540 410 1342; 2790 410 1340; 2980 408 1330; 3180 400 1312
     3408 400 1258; 3628 395 1194; 3838 390 1122; 4048 385 1034; 4204 390 1015; 4353 385 1009; 4524 380 1000`),
  // 3
  T(`92 470 573; 116 475 634; 160 540 703; 288 662.9 723; 488 673.7 773; 688 684.5 814; 868 694.2 843.4; 1048 703.9 867.5; 1208 712.5 885.4; 1308 717.9 895
     1440 640 944; 1564 612 1040; 1734 590 1132; 1904 565 1222; 2084 518 1298; 2300 510 1308; 2540 510 1318; 2790 510 1316; 2980 512 1306; 3200 520 1290
     3420 530 1238; 3640 545 1170; 3850 560 1098; 4060 575 1015; 4210 570 1006; 4357 550 1000; 4512 520 995`),
  // 4
  T(`140 575 574; 165 585 633; 200 640 702; 294 710.9 717; 494 721.7 767; 694 732.5 808; 874 742.2 837.4; 1054 751.9 861.5; 1214 760.5 879.4; 1314 765.9 889
     1500 722 928; 1690 705 1030; 1840 668 1130; 1990 628 1222; 2130 580 1290; 2300 548 1292; 2540 545 1298; 2805 548 1296; 2990 580 1235; 3170 640 1110
     3310 705 975; 3600 712 985; 3880 700 992; 4090 690 995; 4220 665 996; 4362 640 993; 4490 610 990`),
  // 5
  T(`198 665 575; 215 680 632; 240 720 700; 360 770 734; 530 782 768; 700 796 796; 870 816 812; 1040 818 825; 1200 816 834; 1310 806 848
     1525 746 915; 1720 742 918; 1910 742 918; 2100 742 918; 2300 742 918; 2480 742 918; 2640 742 918; 2855 742 918; 3020 748 925; 3180 758 935
     3330 780 945; 3610 800 950; 3880 810 955; 4080 800 958; 4215 770 958; 4355 735 955; 4440 688 955`),
  // 6
  T(`262 735 576; 280 752 631; 310 782 696; 430 808 720; 590 840 740; 735 858 764; 880 872 778; 1035 874 784; 1180 870 780; 1300 854 775
     1535 808 830; 1720 798 830; 1910 798 830; 2100 798 830; 2300 798 830; 2480 798 830; 2640 798 830; 2855 798 830; 3020 798 830; 3240 830 850
     3420 846 862; 3640 860 872; 3860 866 875; 4060 842 876; 4200 808 880; 4345 772 880; 4440 728 880`),
  // 7
  T(`345 780 577; 372 806 622; 440 850 655; 530 858 688; 640 862 695; 761.5 886 652.5; 884.5 888 697.3; 1028.4 888 694.8; 1160.8 886 638.5; 1251.1 883 552.9
     1540 840 712; 1720 840 715; 1910 840 715; 2100 840 715; 2300 840 715; 2480 840 715; 2640 840 715; 2855 840 715; 3020 840 715; 3372.9 884 558.1
     3481.5 886 652.5; 3617.5 888 699.3; 3767.6 887 690.2; 3891.6 862 631; 4185 820 730; 4330 784 730; 4446 742 730`),
  // 8
  T(`430 822 578; 452 834 578; 492 846 578; 527 857 577; 558 868 575; 661.2 881 568.3; -; -; -; 1308.5 878 442.5
     1548 836 450; 1720 836 450; 1910 836 450; 2100 836 450; 2300 836 450; 2480 836 450; 2640 836 450; 2840 836 450; 3020 836 450; 3311.5 878 442.5
     -; -; -; 3986.2 858 531.3; 4170 817 532; 4320 780 536; 4440 740 600`),
  // 9
  T(`-; -; -; -; -; -; -; -; -; 1326.8 872 312.8
     1560 816 278; 1720 816 278; 1910 816 278; 2100 816 278; 2300 816 278; 2480 816 278; 2640 816 278; 2815 816 278; 3020 816 278; 3293.2 872 312.8
     -; -; -; -; -; -; -`),
  // 10
  T(`-; -; -; -; -; -; -; -; -; 1310.5 860 215.8
     1555 830 205; 1720 830 205; 1910 830 205; 2100 830 205; 2300 830 205; 2480 830 205; 2640 830 205; 2805 830 205; 3020 830 205; 3311.5 860 209.5
     -; -; -; -; -; -; -`),
  // 11
  T(`-; -; -; -; -; -; -; -; -; 1282.9 842 149
     1550 818 150; 1720 818 150; 1910 818 150; 2100 818 150; 2300 818 150; 2480 818 150; 2640 818 150; 2800 818 150; 3020 818 150; 3337.1 842 149
     -; -; -; -; -; -; -`),
];
/** the strip that wraps the tail's corner: the lines of columns 6 (the tail lamps' top), 7 (their foot) and 8 (the
 *  bumper's seam) carried on from row 26 round to the centre line, five steps; the deck's trailing edge (row 26,
 *  columns 5 .. 0) is the strip's top line, so the corner point (row 26, column 5) has three faces round it */
const WRAP: V[][] = [
  T(`4505 655 912; 4540 530 918; 4558 380 920; 4565 190 921; 4567 0 921`) as V[],
  T(`4518 682 712; 4552 565 706; 4570 390 704; 4576 190 703; 4577 0 703`) as V[],
  T(`4512 684 598; 4552 570 596; 4572 395 595; 4580 190 595; 4581 0 595`) as V[],
];

/** the cells of the main grid: the car's own material and panel (the glass as the set picks it; the lamps, the grille
 *  and the tail lamps are the lump's painted panels with their sockets' tags) */
function cellOwn(i: number, j: number): Tag {
  if (j < 2 && i >= 10 && i < 14) return { region: 'shell', mat: 'glass', panel: 'windscreen' };
  if (j < 2 && i >= 19 && i < 23) return { region: 'shell', mat: 'glass', panel: 'rearWindow' };
  if (j === 4 && i >= 10 && i < 20) return { region: 'shell', mat: 'glass', panel: i < 17 ? 'doorGlass' : 'quarterGlass' };
  if (i < 2 && j < 2) return { region: 'shell', mat: 'paint', panel: 'nose', socket: 'grille', was: 'grille' };
  if (i < 2 && j < 7) return { region: 'shell', mat: 'paint', panel: 'nose', socket: 'headLamp', was: 'lens' };
  if (j >= 9) return { region: 'shell', mat: 'paint', panel: 'sill' };
  if (j >= 5 && i >= 10 && i < 17) return { region: 'shell', mat: 'paint', panel: 'door' };
  if (j < 4 && i >= 10 && i < 19) return { region: 'shell', mat: 'paint', panel: 'roof' };
  if (i < 10 && i >= 2 && j < 3) return { region: 'shell', mat: 'paint', panel: 'bonnet' };
  if (i < 10) return { region: 'shell', mat: 'paint', panel: 'wingF' };
  if (i >= 23 && j < 3) return { region: 'shell', mat: 'paint', panel: 'bootLid' };
  return { region: 'shell', mat: 'paint', panel: 'wingR' };
}
/** a cell as the glass set has it: none picked paints the cabin over; the quarter glass or the back window as the set says */
function cell(i: number, j: number, glass: GlassId | null): Tag { const t = cellOwn(i, j); if (t.mat !== 'glass') return t;
  return !glass || (glass === 'noQuarter' && t.panel === 'quarterGlass') ? { ...t, mat: 'paint', was: 'glass' } : glass === 'louvre' && t.panel === 'rearWindow' ? { ...t, mat: 'grille', was: 'glass' } : t; }

export interface CageOpts { /** the glass set on the cabin's cells (docs/systems/115 §4-2; default none: the cabin all body colour) */ glass?: GlassId | null;
  /** the frame's dimensions (docs/systems/115 §4-4): the cage stretched by them (frame.ts) */ dims?: Partial<FrameDims> }
export function buildCage(o: CageOpts = {}): Cage959 { const glass = o.glass ?? null;
  const P: V[] = [], F: number[][] = [], tag: Tag[] = [], sharp = new Map<string, number>(), crease = new Set<string>();
  const pt = (p: V) => P.push([p[0], p[1], p[2]]) - 1, quad = (a: number, b: number, c: number, d: number, t: Tag) => { F.push([a, b, c, d]); tag.push(t); };
  const M: number[][] = Array.from({ length: NR }, (_, i) => Array.from({ length: NC }, (_, j) => COLS[j]![i] ? pt(COLS[j]![i]!) : -1));
  const hard = (a: number, b: number, s = 1, split = false) => { sharp.set(ekey(a, b), s); if (split) crease.add(ekey(a, b)); };
  const path = (p: number[], s = 1, split = false, closed = false) => { for (let q = 0; q + 1 < p.length; q++) hard(p[q]!, p[q + 1]!, s, split); if (closed) hard(p[p.length - 1]!, p[0]!, s, split); };
  const inArch = (i: number, j: number) => j >= ARCH.top && ((i >= ARCH.f.rows[0] && i < ARCH.f.rows[1]) || (i >= ARCH.r.rows[0] && i < ARCH.r.rows[1]));
  for (let i = 0; i + 1 < NR; i++) for (let j = 0; j + 1 < NC; j++) { const a = M[i]![j]!, b = M[i + 1]![j]!, c = M[i + 1]![j + 1]!, d = M[i]![j + 1]!;
    if (a < 0 || b < 0 || c < 0 || d < 0 || inArch(i, j)) continue; quad(a, b, c, d, cell(i, j, glass)); }
  // the tail: the wrapped strip. Its top line is row 26 read inward (column 5 the corner, then 4 .. 0); its middle band
  // (between the lamps' top and foot) the tail lamps' place, out to y 400, the garnish between them
  const W: number[][] = WRAP.map(l => l.map(pt)), K = WRAP[0]!.length, wl = (m: number, k: number) => m === 5 ? M[26]![5 - k]! : k === 0 ? M[26]![m]! : W[m - 6]![k - 1]!;
  for (let k = 0; k < K; k++) for (let m = 5; m < 8; m++) quad(wl(m, k), wl(m, k + 1), wl(m + 1, k + 1), wl(m + 1, k), m === 6 && k < 3 ? { region: 'shell', mat: 'paint', panel: 'tailPanel', socket: 'tailLamp', was: 'lamp' } : { region: 'shell', mat: 'paint', panel: m === 5 ? 'bootLid' : 'tailPanel' });
  // the bumpers: blank modules hung on the seam loops (docs/systems/115 §4-1: one shape, no openings). Each point of the
  // seam carries three more below it (the face's middle, its lower edge, the foot); `back` pushes them out along the
  // car's axis (most at the middle: by the fourth power of the share of the way the seam's point faces ahead or back, so
  // the corners stay round in plan), `side` across it by its share; at the arch they lie on its circle
  const strip = (seam: number[], region: Region, zs: [number, number, number], back: [number, number, number], side: [number, number, number], cx: number, arch: V[]) => { const rows: number[][] = [seam];
    for (let m = 0; m < 3; m++) rows.push(seam.map((s, k) => { if (k === 0) return pt(arch[m]!); const p = P[s]!, dx = p[0] - cx, l = Math.hypot(dx, p[1]) || 1, ax = Math.abs(dx) / l, ay = p[1] / l;
      // a point that would fall into the wheel's opening is held off the arch's circle (30 mm ahead of the front one, behind the rear one)
      const x = p[0] + Math.sign(dx) * ax ** 4 * back[m]!, ac = arch[m]![0], gap = region === 'bumperF' ? Math.min(x, ac - 30 * (1 - m / 4)) : Math.max(x, ac + 30 * (1 - m / 4));
      return pt([Math.abs(x - ac) < 200 ? gap : x, Math.max(0, p[1] + ay * side[m]!), m === 0 ? Math.min(zs[0]!, p[2] - 60) : zs[m]!]); }));   // the first row at least 60 under the seam where the seam runs low (the rear's side)
    for (let m = 0; m < 3; m++) for (let k = 0; k + 1 < seam.length; k++) { const q = [rows[m]![k]!, rows[m]![k + 1]!, rows[m + 1]![k + 1]!, rows[m + 1]![k]!]; if (region === 'bumperF') q.reverse(); quad(q[0]!, q[1]!, q[2]!, q[3]!, { region, mat: 'paint' as Mat, panel: region }); }
    return rows; };
  const A = ARCH, archAt = (a: { x: number; z: number }, z: number, y: number, front: boolean): V => { const t = Math.asin(Math.max(-1, Math.min(1, (z - a.z) / A.rc))); return [a.x + (front ? -1 : 1) * A.rc * Math.cos(t), y, z]; };
  const seamF = [5, 4, 3, 2, 1].map(i => M[i]![8]!).concat([8, 7, 6, 5, 4, 3, 2, 1, 0].map(j => M[0]![j]!));
  const seamR = [23, 24, 25, 26].map(i => M[i]![8]!).concat(W[2]!);
  const zf: [number, number, number] = [430, 235, 150], zr: [number, number, number] = [480, 340, 248];
  const BF = strip(seamF, 'bumperF', zf, [22, 14, 32], [12, 8, 6], 760, [archAt(A.f, zf[0], 884, true), archAt(A.f, zf[1], 872, true), archAt(A.f, zf[2], 846, true)]);
  const BR = strip(seamR, 'bumperR', zr, [86, 64, 22], [6, 8, -22], 3900, [archAt(A.r, zr[0], 860, false), archAt(A.r, zr[1], 855, false), archAt(A.r, zr[2], 842, false)]);

  const colPath = (j: number, i0: number, i1: number) => Array.from({ length: i1 - i0 + 1 }, (_, k) => M[i0 + k]![j]!), rowPath = (i: number, j0: number, j1: number) => Array.from({ length: j1 - j0 + 1 }, (_, k) => M[i]![j0 + k]!);
  const rowPath0 = () => Array.from({ length: 9 }, (_, j) => M[0]![j]!);
  // ---- sharp edges: the module seams (hard for the positions; the shading runs over them), and the creases (split)
  path(seamF); path(seamR); path([M[26]![8]!, ...W[2]!], 1, true);                                  // across the back the bumper stands out under the tail panel: a crease
  path(rowPath0(), 1, true);                                                                          // and across the front the lamps' band leans back from the bumper's top
  path(rowPath(10, 0, 4), 1, true);                                                                   // the screen's foot (the cowl)
  path(rowPath(2, 0, 7), 1, true);                                                                    // the bonnet's and the wings' leading edge over the lamps' band
  path(colPath(5, 10, 20), 1, true); path(colPath(4, 10, 20), 1, true);                               // the side glass's foot (the belt) and top
  path([...rowPath(10, 0, 2), ...colPath(2, 11, 14)]); path(rowPath(14, 0, 2)); path([...rowPath(19, 0, 2), ...colPath(2, 20, 23)]); path(rowPath(23, 0, 2));   // the screen's and the back window's edges
  path(colPath(4, 20, 26), 1, true); path(colPath(5, 20, 26), 1, true);                              // the rear quarter's two shoulder creases: the deck's flank (from the C pillar's foot) and the belt's run to the tail
  path([...rowPath(26, 0, 5)], 1, true);                                                              // the deck's trailing edge
  path(colPath(10, 9, 19), 0.6);                                                                      // the side skirt's crease: a tight radius

  // ---- the drawn lines (cage point paths; the shell follows them through the subdivision)
  const lines: CageLine[] = [
    { kind: 'bumper', name: 'frontBumperSeam', path: seamF.slice().reverse() }, { kind: 'bumper', name: 'rearBumperSeam', path: seamR },
    { kind: 'bonnet', name: 'bonnetShut', path: colPath(3, 2, 10) }, { kind: 'bonnet', name: 'bonnetFront', path: rowPath(2, 0, 3) }, { kind: 'bonnet', name: 'bonnetRear', path: rowPath(10, 0, 3) },
    { kind: 'door', name: 'doorFront', path: rowPath(10, 5, 9) }, { kind: 'door', name: 'doorRear', path: rowPath(17, 5, 9) }, { kind: 'door', name: 'doorFoot', path: colPath(9, 10, 17) }, { kind: 'door', name: 'doorTop', path: colPath(5, 10, 17) },
    { kind: 'panel', name: 'sillLine', path: colPath(10, 9, 19) },
    { kind: 'glass', name: 'windscreen', path: [...rowPath(10, 0, 2), ...colPath(2, 11, 14), ...rowPath(14, 0, 1).reverse()] },
    { kind: 'glass', name: 'sideGlass', path: [...colPath(4, 10, 20), ...colPath(5, 10, 20).reverse()], closed: true }, { kind: 'trim', name: 'bPillar', path: [M[17]![4]!, M[17]![5]!], w: 2.5 },
    { kind: 'glass', name: 'rearWindow', path: [...rowPath(19, 0, 2), ...colPath(2, 20, 23), ...rowPath(23, 0, 1).reverse()] },
    { kind: 'trim', name: 'dripRail', path: colPath(3, 10, 19) },
    { kind: 'boot', name: 'bootLid', path: [...rowPath(23, 0, 3), ...colPath(3, 24, 26), ...rowPath(26, 0, 2).reverse()] },
    { kind: 'crease', name: 'shoulder', path: colPath(4, 20, 26) }, { kind: 'crease', name: 'rearBelt', path: colPath(5, 20, 26) },
    { kind: 'crease', name: 'deckEdge', path: rowPath(26, 0, 5) },
  ];
  const lampRing = [...rowPath(0, 2, 7), ...rowPath(2, 2, 7).reverse()], tailRing = [wl(6, 0), wl(6, 1), wl(6, 2), wl(6, 3), wl(7, 3), wl(7, 2), wl(7, 1), wl(7, 0)];
  const loops: Record<string, number[]> = { frontBumper: seamF, rearBumper: seamR, headLamp: [...rowPath(0, 2, 7), M[1]![7]!, ...rowPath(2, 2, 7).reverse(), M[1]![2]!], grille: [...rowPath(0, 0, 2), M[1]![2]!, ...rowPath(2, 0, 2).reverse()],
    tailLamp: tailRing, frontBumperFoot: BF[3]!, rearBumperFoot: BR[3]!, frontBumperArch: BF.map(r => r[0]!), rearBumperArch: BR.map(r => r[0]!), sillFoot: colPath(11, 9, 19) };
  void lampRing;

  // ---- the other half
  const n = P.length, mirror: number[] = []; for (let v = 0; v < n; v++) mirror.push(Math.abs(P[v]![1]) < 1e-6 ? v : pt([P[v]![0], -P[v]![1], P[v]![2]]));
  for (let v = n; v < P.length; v++) mirror.push(mirror.indexOf(v));
  const nf = F.length; for (let k = 0; k < nf; k++) { F.push(F[k]!.map(v => mirror[v]!).reverse()); tag.push({ ...tag[k]!, right: true }); }
  for (const [key, s] of [...sharp]) { const [a, b] = key.split('|').map(Number) as [number, number], mk = ekey(mirror[a]!, mirror[b]!); sharp.set(mk, s); if (crease.has(key)) crease.add(mk); }
  // the glass's own lines only with glass (the belt, the cowl and the shoulder stay as creases of the shape)
  const drawn = lines.filter(l => !(!glass && /^(windscreen|sideGlass|rearWindow|bPillar|dripRail)$/.test(l.name)) && !(glass === 'noQuarter' && l.name === 'bPillar'))
    .map(l => glass === 'noQuarter' && l.name === 'sideGlass' ? { ...l, path: [...colPath(4, 10, 17), ...colPath(5, 10, 17).reverse()] } : l);
  if (glass === 'louvre') for (let i = 20; i < 23; i++) drawn.push({ kind: 'vent', name: `rearLouvre${i}`, path: rowPath(i, 0, 2) }, { kind: 'vent', name: `rearLouvre${i}h`, path: [], between: { a: rowPath(i, 0, 2), b: rowPath(i + 1, 0, 2), t: 0.5 } });
  // the frame's dimensions: every point moved by the stretch (the arches' zones only carried, so their rings stay round)
  if (o.dims) { const f = frameOf(o.dims); for (let v = 0; v < P.length; v++) P[v] = f.at(P[v]!); }
  return { P, F, sharp, tag, M, W, crease, lines: drawn, loops, mirror };
}
