// The N33's control cage (docs/systems/117 "다시 만든 차체 B"): the frame "차체 B", the first front-engined coupe's, as a
// coarse mesh of quads whose points are placed by hand on the blueprint (docs/reference/bnr33/bp_line_4view_hires.png,
// 5.5 mm a pixel; its plan 3.7 % narrow, its front and rear views 4.3 % wide) and checked against the photographs. The
// lines of points lie on the car's own lines. One level of subdivision (render/car/p959/subdiv.ts) makes the shell from
// it, finished as the 959's is (render/car/p959/shell.ts shellFrom). The lump has no openings: the lamps', the
// grille's, the glass's and the tail lamps' cells are body-coloured panels that keep their socket's tag for the parts.
// Units mm; x from the nose back, y from the centre line out (the half y >= 0 is authored, the other mirrored), z up
// from the ground. Sizes: length 4675, width 1780, height 1364, wheelbase 2720 (axles at 950 and 3670).
//
// The main sheet is a grid: ROWS run across the car (0 the front bumper's seam .. 26 the boot deck's trailing edge),
// COLUMNS run along it (0 the centre line .. 12 the side skirt's foot). A row is not a flat cut: it slides to lie on
// the car's lines (the screen's foot, the door's edges, the arches' spokes).
//   columns  0 the centre line
//            1 the bonnet's raised middle's edge / the screen's and the roof's third / the boot lid's third
//            2 the bonnet's flank / the screen's side edge / the roof's shoulder / the back window's side edge
//            3 the bonnet's shut line / the A pillar's crest / the drip rail / the C pillar's crest / the boot lid's side
//            4 the front wing's crest / the side glass's top / behind its point the rear quarter's shoulder crease
//            5 the wing's shoulder / the belt (the side glass's foot) / the rear wing's top flank
//            6 the upper side      7 the waist line (from the head lamp's tip, over both arches, to the tail)
//            8 the arches' rings; ahead of the front one the front bumper's seam, behind the rear one the rear bumper's
//              side seam; between the arches the door's middle
//            9 the lower door's line (the skirt's shadow)   10 the door's foot   11 the side skirt's crease   12 its foot
//   rows     0 the front seam (the lamps' foot)  1 the lamps' middle  2 the bonnet's and the wings' leading edge (the
//            lamps' top; rows 0 .. 2 run together at column 8: the lamp's pointed tip)   5-9 the front arch's spokes
//            9 the bonnet's trailing edge   10 the screen's foot, the A pillar's foot and the door's front edge
//            14 the screen's top   17 the B pillar and the door's rear edge (it sweeps forward to the sill)
//            19-23 the rear arch's spokes; 19 the back window's top, 20 the quarter glass's point, 23 the back
//            window's foot   26 the deck's trailing edge (the tail panel's top)
// Behind row 26 a strip wraps the tail (the tail lamps' top, their foot, the bumper's seam, the bumper's shelf edge);
// the bumpers hang on the seams as strips of their own, every point placed (the blank volumes of the lump).
import { ekey, type V } from '../p959/subdiv';
import type { Cage959, CageLine, Mat, Region, Tag } from '../p959/cage';
import type { GlassId } from '../../../core/frames';
import { DIM, frameOf, type FrameDims } from './frame';

export { DIM };
export const NR = 27, NC = 13;
/** the arches: the hubs, the cage's radius (the subdivided ring lands near archR and is trued to it), the rows of
 *  their spokes, the ring's column */
export const ARCH = { f: { x: DIM.axleF, z: DIM.hubZ, rows: [5, 9] as [number, number] }, r: { x: DIM.axleR, z: DIM.hubZ, rows: [19, 23] as [number, number] }, rc: 377, top: 8 };

const T = (s: string): (V | null)[] => s.trim().split(/\s*;\s*/).map(r => r.trim() === '-' ? null : r.trim().split(/[\s,]+/).map(Number) as V);
/** the rows, one a line, their points from the centre line out: x y z */
const ROWS: (V | null)[][] = [
  /*  0 */ `100 0 590; 104 295 590; 120 430 590; 152 520 590; 205 612 590; 262 692 590; 335 760 590; 400 800 590; 450 830 590; -; -; -; -`,
  /*  1 */ `114 0 646; 118 295 646; 135 430 645; 168 519 644; 222 609 640; 280 688 632; 352 754 622; 418 796 610; 480 838 591; -; -; -; -`,
  /*  2 */ `132 0 706; 136 296 706; 154 430 704; 188 517 700; 243 605 688; 302 682 672; 374 746 654; 440 790 634; 510 846 592; -; -; -; -`,
  /*  3 */ `300 0 811; 300 300 806; 310 472 784; 322 652 744; 352 700 732; 398 758 708; 452 802 678; 515 832 650; 560 862 590; -; -; -; -`,
  /*  4 */ `520 0 870; 520 325 866; 528 502 847; 540 688 824; 556 734 815; 586 792 780; 610 832 732; 628 856 688; 615 874 590; -; -; -; -`,
  /*  5 */ `700 0 900; 700 342 896; 704 520 878; 712 698 858; 722 742 850; 733 790 812; 740 841 756; 735 860 702; 679 888 588; -; -; -; -`,
  /*  6 */ `880 0 927; 880 358 922; 880 535 903; 880 703 884; 880 742 877; 874 794 836; 864 845 770; 852 866 724; 833.5 889 684.5; -; -; -; -`,
  /*  7 */ `1060 0 947; 1060 374 941; 1058 548 923.5; 1052 706 905; 1048 742 898; 1040 796 852; 1030 846 780; 1022 868 732; 1015.5 888 697.3; -; -; -; -`,
  /*  8 */ `1210 0 958; 1210 388 952; 1210 558 935.5; 1215 705 918; 1218 740 911; 1215 790 862; 1212 840 784; 1215 860 724; 1182 889 623; -; -; -; -`,
  /*  9 */ `1300 0 961; 1362 400 954; 1438 565 939; 1500 656 930; 1470 735 916; 1400 778 872; 1365 828 792; 1345 848 726; 1289 890 491; 1320.7 886 395; 1324.8 876 285; 1310.3 864 215; 1283 850 149`,
  /* 10 */ `1420 0 985; 1448 405 973; 1548 645 947; 1578 690 936; 1612 712 927; 1622 724 918; 1545 786 852; 1530 836 740; 1525 842 590; 1545 838 395; 1560 814 285; 1560 842 236; 1556 822 160`,
  /* 11 */ `1580 0 1074; 1598 385 1063; 1690 614 1041; 1722 660 1030; 1765 688 1000; 1790 725 920; 1790 786 853; 1790 836 742; 1785 842 590; 1770 838 395; 1770 814 285; 1770 842 236; 1770 822 160`,
  /* 12 */ `1740 0 1162; 1756 360 1151; 1828 578 1132; 1858 626 1120; 1900 650 1088; 1960 726 922; 1960 786 854; 1960 836 744; 1955 842 590; 1930 838 395; 1930 814 285; 1930 842 236; 1930 822 160`,
  /* 13 */ `1905 0 1249; 1916 335 1239; 1962 538 1220; 1992 584 1208; 2030 606 1173; 2130 726 924; 2130 786 856; 2130 836 747; 2120 842 590; 2090 838 395; 2090 814 285; 2090 842 236; 2090 822 160`,
  /* 14 */ `2070 0 1320; 2076 310 1313; 2092 492 1300; 2125 536 1290; 2165 558 1256; 2300 726 926; 2300 786 858; 2300 836 750; 2285 842 590; 2250 838 395; 2250 814 285; 2250 842 236; 2250 822 160`,
  /* 15 */ `2330 0 1356; 2330 300 1349; 2330 468 1333; 2336 522 1312; 2400 553 1284; 2470 726 928; 2470 786 860; 2470 836 752; 2450 842 592; 2400 838 396; 2400 814 286; 2400 842 237; 2400 822 160`,
  /* 16 */ `2600 0 1365; 2600 300 1358; 2600 468 1342; 2600 523 1320; 2610 554 1291; 2680 726 931; 2680 786 863; 2680 836 755; 2640 842 595; 2560 838 397; 2560 814 286; 2560 842 237; 2560 822 160`,
  /* 17 */ `2860 0 1358; 2860 300 1351; 2850 468 1335; 2830 523 1313; 2775 554 1285; 2878 727 934; 2880 788 866; 2882 838 758; 2868 843 600; 2796 838 398; 2712 814 287; 2712 842 238; 2712 822 160`,
  /* 18 */ `3060 0 1344; 3060 300 1337; 3055 462 1321; 3045 518 1298; 3040 575 1240; 3075 731 940; 3080 786 870; 3085 846 763; 3075 852 610; 3060 846 402; 3020 818 290; 3020 844 240; 3020 824 160`,
  /* 19 */ `3260 0 1317; 3264 300 1308; 3285 425 1295; 3270 505 1272; 3235 618 1140; 3250 736 945; 3265 812 870; 3280 856 768; 3331.2 888 491; 3299.3 882 395; 3295.2 872 285; 3309.7 860 215; 3337 846 149`,
  /* 20 */ `3470 0 1254; 3474 300 1246; 3490 476 1230; 3480 548 1200; 3420 708 968; 3424 738 950; 3440 826 862; 3450 862 772; 3470.2 889 645.7; -; -; -; -`,
  /* 21 */ `3670 0 1178; 3674 310 1170; 3688 512 1156; 3680 580 1124; 3670 714 968; 3670 792 918; 3670 844 842; 3670 872 774; 3670 888 703; -; -; -; -`,
  /* 22 */ `3870 0 1101; 3874 320 1094; 3886 548 1082; 3880 598 1050; 3870 708 967; 3880 786 916; 3890 840 838; 3895 866 773; 3869.8 889 645.7; -; -; -; -`,
  /* 23 */ `4050 0 1033; 4032 325 1030; 3985 562 1022; 4005 604 1004; 4050 696 965; 4055 772 912; 4060 824 838; 4065 848 772; 4008.8 890 491; -; -; -; -`,
  /* 24 */ `4200 0 1017; 4200 325 1014; 4200 480 1010.5; 4200 592 996; 4200 682 962; 4205 752 908; 4210 798 836; 4215 816 770; 4190 824 498; -; -; -; -`,
  /* 25 */ `4340 0 1010.5; 4340 325 1007.5; 4340 470 1002.5; 4340 578 990; 4340 666 958; 4340 724 905; 4345 760 825; 4375 760 700; 4375 766 505; -; -; -; -`,
  /* 26 */ `4492 0 1003; 4492 320 1000.5; 4488 450 995.5; 4472 558 984; 4445 642 955; 4448 688 898; 4462 708 775; 4468 714 684; 4474 722 600; -; -; -; -`,
].map(T);
/** the strip that wraps the tail's corner: the lines of columns 5 (the tail lamps' top), 6 (their foot), 7 (the bumper's
 *  seam) and 8 (the bumper's shelf edge) carried on from row 26 round to the centre line, four steps; the deck's
 *  trailing edge (row 26, columns 4 .. 0) is the strip's top line, so the corner point (row 26, column 4) has three
 *  faces round it */
const WRAP: V[][] = [
  `4543 527 902; 4549 497 902; 4570 250 902; 4574 0 902`,
  `4558 536 736; 4563 504 734; 4582 252 728; 4586 0 728`,
  `4565 540 660; 4570 508 659; 4587 254 656; 4591 0 655`,
  `4598 548 637; 4605 514 638; 4636 256 640; 4643 0 640`,
].map(s => T(s) as V[]);
/** the front bumper under its seam (the seam's points from the arch forward along column 8, then row 0 in to the
 *  centre line: 14 of them): four lines, each point under the seam's. The shelf's edge (the bumper stands out ahead of
 *  the lamps), the face's middle, its lower part, the lip's edge. At the arch (the first point) they lie on its ring */
const BUMPER_F: V[][] = [
  `621 884 510; 575 878 525; 520 868 540; 480 856 548; 452 848 553; 425 838 558; 362 818 566; 286 782 573; 198 716 577; 121 626 573; 68 522 573; 34 412 573; 16 295 573; 14 0 573`,
  `580 884 400; 540 880 420; 498 870 430; 455 858 436; 425 848 440; 395 838 444; 338 826 446; 258 788 448; 182 722 450; 110 630 450; 60 524 450; 26 414 450; 8 295 450; 6 0 450`,
  `575 880 290; 535 878 296; 492 868 296; 448 855 296; 415 845 296; 385 834 296; 330 822 296; 252 784 296; 176 718 296; 112 626 296; 66 522 296; 36 413 296; 23 295 296; 22 0 296`,
  `603 868 172; 552 870 172; 506 860 172; 460 847 172; 426 837 172; 395 826 172; 340 814 172; 264 776 172; 190 710 172; 128 618 172; 82 514 172; 52 408 172; 38 292 172; 37 0 172`,
].map(s => T(s) as V[]);
/** the rear bumper under its upper line (column 8 from the arch back to row 26, then the strip's last line in to the
 *  centre line: 8 points): three lines. The face's widest line, its lower part, the foot. Its upper band (between the
 *  seam and the shelf's edge) is the strip's last row and the grid's last cell of column 7 */
const BUMPER_R: V[][] = [
  `4035.2 884 420; 4195 826 425; 4385 770 430; 4478 724 480; 4602 550 507; 4609 516 508; 4639 256 510; 4645 0 510`,
  `4046.2 880 350; 4200 822 355; 4388 766 360; 4472 718 375; 4574 544 383; 4580 510 384; 4606 254 385; 4610 0 385`,
  `4045.3 868 290; 4198 814 286; 4384 758 292; 4460 710 300; 4556 536 305; 4562 502 305; 4588 250 306; 4592 0 306`,
].map(s => T(s) as V[]);

/** the cells of the main grid: the car's own material and panel (the glass as the set picks it; the lamps, the grille
 *  and the tail lamps are the lump's painted panels with their sockets' tags) */
function cellOwn(i: number, j: number): Tag {
  if (j < 2 && i >= 10 && i < 14) return { region: 'shell', mat: 'glass', panel: 'windscreen' };
  if (j < 2 && i >= 19 && i < 23) return { region: 'shell', mat: 'glass', panel: 'rearWindow' };
  if (j === 4 && i >= 10 && i < 20) return { region: 'shell', mat: 'glass', panel: i < 17 ? 'doorGlass' : 'quarterGlass' };
  if (i < 2 && j < 1) return { region: 'shell', mat: 'paint', panel: 'nose', socket: 'grille', was: 'grille' };
  if (i < 2 && j < 7) return { region: 'shell', mat: 'paint', panel: 'nose', socket: 'headLamp', was: 'lens' };
  if (i === 25 && j === 7) return { region: 'bumperR', mat: 'paint', panel: 'bumperR' };
  if (j >= 10) return { region: 'shell', mat: 'paint', panel: 'sill' };
  if (j >= 5 && i >= 10 && i < 17) return { region: 'shell', mat: 'paint', panel: 'door' };
  if (j < 4 && i >= 10 && i < 19) return { region: 'shell', mat: 'paint', panel: 'roof' };
  if (i < 9 && i >= 2 && j < 3) return { region: 'shell', mat: 'paint', panel: 'bonnet' };
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
  const M: number[][] = Array.from({ length: NR }, (_, i) => Array.from({ length: NC }, (_, j) => ROWS[i]![j] ? pt(ROWS[i]![j]!) : -1));
  const hard = (a: number, b: number, s = 1, split = false) => { sharp.set(ekey(a, b), Math.max(s, sharp.get(ekey(a, b)) ?? 0)); if (split) crease.add(ekey(a, b)); };
  const path = (p: number[], s = 1, split = false, closed = false) => { for (let q = 0; q + 1 < p.length; q++) hard(p[q]!, p[q + 1]!, s, split); if (closed) hard(p[p.length - 1]!, p[0]!, s, split); };
  // the main grid: every cell whose four points are there (the arches' openings and the bumpers' places have none)
  for (let i = 0; i + 1 < NR; i++) for (let j = 0; j + 1 < NC; j++) { const a = M[i]![j]!, b = M[i + 1]![j]!, c = M[i + 1]![j + 1]!, d = M[i]![j + 1]!;
    if (a < 0 || b < 0 || c < 0 || d < 0) continue; quad(a, b, c, d, cell(i, j, glass)); }
  // the tail: the wrapped strip. Its top line is row 26 read inward (column 4 the corner, then 3 .. 0); between the lamps'
  // top and foot the tail lamps' place (out from y 395), the last row the rear bumper's upper band
  const W: number[][] = WRAP.map(l => l.map(pt)), K = WRAP[0]!.length, wl = (m: number, k: number) => m === 4 ? M[26]![4 - k]! : k === 0 ? M[26]![m]! : W[m - 5]![k - 1]!;
  for (let k = 0; k < K; k++) for (let m = 4; m < 8; m++) quad(wl(m, k), wl(m, k + 1), wl(m + 1, k + 1), wl(m + 1, k),
    m === 7 ? { region: 'bumperR', mat: 'paint', panel: 'bumperR' } : m === 5 && k < 2 ? { region: 'shell', mat: 'paint', panel: 'tailPanel', socket: 'tailLamp', was: 'lamp' } : { region: 'shell', mat: 'paint', panel: m === 4 ? 'bootLid' : 'tailPanel' });
  // the bumpers: blank volumes hung under their lines (docs/systems/115 §4-1: one shape, no openings)
  const strip = (top: number[], lines: V[][], region: Region) => { const rows: number[][] = [top, ...lines.map(l => l.map(pt))];
    for (let m = 0; m + 1 < rows.length; m++) for (let k = 0; k + 1 < top.length; k++) { const q = [rows[m]![k]!, rows[m]![k + 1]!, rows[m + 1]![k + 1]!, rows[m + 1]![k]!]; if (region === 'bumperF') q.reverse(); quad(q[0]!, q[1]!, q[2]!, q[3]!, { region, mat: 'paint' as Mat, panel: region }); }
    return rows; };
  const colPath = (j: number, i0: number, i1: number) => Array.from({ length: i1 - i0 + 1 }, (_, k) => M[i0 + k]![j]!), rowPath = (i: number, j0: number, j1: number) => Array.from({ length: j1 - j0 + 1 }, (_, k) => M[i]![j0 + k]!);
  const seamF = [...colPath(8, 1, 5).reverse(), ...rowPath(0, 0, 8).reverse()];
  const seamR = [...colPath(8, 23, 25), M[25]![7]!, M[26]![7]!, ...W[2]!], shelfR = [...colPath(8, 23, 26), ...W[3]!];
  const BF = strip(seamF, BUMPER_F, 'bumperF'), BR = strip(shelfR, BUMPER_R, 'bumperR');

  // ---- sharp edges: the module seams (hard for the positions; the shading runs over them), and the creases (split)
  path(seamF); path(seamR);
  path([M[26]![7]!, ...W[2]!], 1, true);                                                              // across the back the bumper's shelf stands out under the tail panel: a crease
  path(rowPath(0, 0, 8), 1, true);                                                                    // and across the front the lamps' band leans back from the bumper's shelf
  path(rowPath(10, 0, 4), 1, true);                                                                   // the screen's foot (the cowl)
  path(rowPath(2, 0, 8), 1, true);                                                                    // the bonnet's and the wings' leading edge over the lamps' band
  path(colPath(5, 10, 20), 1, true); path(colPath(4, 10, 20), 1, true);                               // the side glass's foot (the belt) and top
  path([...rowPath(10, 0, 2), ...colPath(2, 11, 14)]); path(rowPath(14, 0, 2)); path([...rowPath(19, 0, 2), ...colPath(2, 20, 23)]); path(rowPath(23, 0, 2));   // the screen's and the back window's edges
  path(rowPath(26, 0, 4), 1, true);                                                                   // the deck's trailing edge
  path(colPath(4, 20, 26), 0.5);                                                                      // the rear quarter's shoulder: a tight radius, not a fold
  path(colPath(7, 9, 24), 0.45);                                                                       // the waist line: a soft accent along the doors and the rear wing
  path(colPath(1, 2, 9), 0.5);                                                                        // the bonnet's raised middle
  path(colPath(11, 9, 19), 0.6, true);                                                                      // the side skirt's crease: a tight radius
  path([...W[3]!], 0.5, true); path(BF[1]!.slice(6), 0.5, true);                                                  // the bumpers' shelf edges: tight radii

  // ---- the drawn lines (cage point paths; the shell follows them through the subdivision)
  const lines: CageLine[] = [
    { kind: 'bumper', name: 'frontBumperSeam', path: seamF.slice().reverse() }, { kind: 'bumper', name: 'rearBumperSeam', path: seamR },
    { kind: 'bonnet', name: 'bonnetShut', path: colPath(3, 2, 9) }, { kind: 'bonnet', name: 'bonnetFront', path: rowPath(2, 0, 3) }, { kind: 'bonnet', name: 'bonnetRear', path: rowPath(9, 0, 3) },
    { kind: 'door', name: 'doorFront', path: rowPath(10, 5, 10) }, { kind: 'door', name: 'doorRear', path: rowPath(17, 5, 10) }, { kind: 'door', name: 'doorFoot', path: colPath(10, 10, 17) }, { kind: 'door', name: 'doorTop', path: colPath(5, 10, 17) },
    { kind: 'panel', name: 'sillLine', path: colPath(11, 9, 19) },
    { kind: 'glass', name: 'windscreen', path: [...rowPath(10, 0, 2), ...colPath(2, 11, 14), ...rowPath(14, 0, 1).reverse()] },
    { kind: 'glass', name: 'sideGlass', path: [...colPath(4, 10, 20), ...colPath(5, 10, 20).reverse()], closed: true }, { kind: 'trim', name: 'bPillar', path: [M[17]![4]!, M[17]![5]!], w: 2.5 },
    { kind: 'glass', name: 'rearWindow', path: [...rowPath(19, 0, 2), ...colPath(2, 20, 23), ...rowPath(23, 0, 1).reverse()] },
    { kind: 'trim', name: 'dripRail', path: colPath(3, 10, 19) },
    { kind: 'boot', name: 'bootLid', path: [...rowPath(23, 0, 3), ...colPath(3, 24, 26), ...rowPath(26, 0, 2).reverse()] },
    { kind: 'crease', name: 'deckEdge', path: rowPath(26, 0, 4) },
    { kind: 'crease', name: 'waist', path: colPath(7, 9, 24), w: 0.6 }, { kind: 'crease', name: 'lampLine', path: colPath(7, 2, 5), w: 0.6 }, { kind: 'crease', name: 'shoulder', path: colPath(4, 20, 26), w: 0.6 },
    { kind: 'crease', name: 'bonnetRise', path: colPath(1, 2, 9), w: 0.6 },
    // the arches' lips: a line a little outside each ring, where the lip's flat meets the wing's side (docs/systems/117 R3)
    { kind: 'crease', name: 'archLipF', path: [], between: { a: colPath(8, 5, 9), b: colPath(7, 5, 9), t: 0.5 }, w: 0.6 }, { kind: 'crease', name: 'archLipR', path: [], between: { a: colPath(8, 19, 23), b: colPath(7, 19, 23), t: 0.5 }, w: 0.6 },
  ];
  const loops: Record<string, number[]> = { frontBumper: seamF, rearBumper: seamR, headLamp: [...rowPath(0, 1, 7), M[1]![7]!, ...rowPath(2, 1, 7).reverse(), M[1]![1]!], grille: [...rowPath(0, 0, 1), M[1]![1]!, ...rowPath(2, 0, 1).reverse()],
    tailLamp: [wl(5, 0), wl(5, 1), wl(5, 2), wl(6, 2), wl(6, 1), wl(6, 0)], frontBumperFoot: BF[4]!, rearBumperFoot: BR[3]!, frontBumperArch: BF.map(r => r[0]!), rearBumperArch: BR.map(r => r[0]!), sillFoot: colPath(12, 9, 19) };

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
