// The Porsche 959's control cage (docs/systems/109): a coarse mesh of quads placed by hand, its lines of points
// following the car's own lines. One level of subdivision (subdiv.ts) makes the shell from it.
// Units mm; x from the nose back, y from the centre line out (the half y >= 0 is authored, the other mirrored), z up
// from the ground. Sizes: length 4260, width 1840, height 1280, wheelbase 2272 (axles at 940 and 3212).
//
// The main sheet is a grid: ROWS run across the car (0 the nose seam .. 30 the wing's trailing edge), COLUMNS run
// along it (0 the centre line .. 12 the sill's foot). A row is not a flat cut: it slides to lie on the car's lines
// (the screen's foot, the door's edges, the arches' spokes).
//   columns  0 centre line          1 a third out           2 bonnet's outer part / screen edge / roof edge / back window edge
//            3 bonnet shut line (the valley) / A pillar's crest / drip rail / C pillar
//            4 lamp pod's inner side / side glass top edge  5 wing crest / belt line (side glass foot) / wing blade's end
//            6 shoulder (the turn from top to side)         7 upper side / the wing's lower edge at the tail
//            8 waist (widest; the arches' top) / tail lamp top   9 bumper seams fore and aft; between the arches the lower door
//            10 door foot (sill top)   11 sill face   12 sill foot
//   rows     0 nose seam   1-3 head lamp (foot, middle, top)   5-9 front arch   10 screen foot and door front edge
//            14 screen top   17 door rear edge   19 back window top   19-23 rear arch   24 back window foot
//            26 the engine lid's end (the slot's lower lip)   27 the wing blade's leading edge   30 its trailing edge
import { ekey, type Cage, type V } from './subdiv';

export const DIM = { length: 4260, width: 1840, height: 1280, wheelbase: 2272, axleF: 940, axleR: 3212, trackF: 1504, trackR: 1550, hubZ: 320, tyreR: 320, archR: 355 } as const;
export const NR = 31, NC = 13;
/** the arches: hub, the cage's radius (the subdivided ring lands on archR), rows and the top column */
export const ARCH = { f: { x: DIM.axleF, z: DIM.hubZ, rows: [5, 9] as [number, number] }, r: { x: DIM.axleR, z: DIM.hubZ - 2, rows: [19, 23] as [number, number] }, rc: 362, top: 8 };

const T = (s: string): (V | null)[] => s.trim().split(/\s*[;\n]\s*/).map(r => r.trim() === '-' ? null : r.trim().split(/[\s,]+/).map(Number) as V);
/** the columns, one row a line: x y z */
const COLS: (V | null)[][] = [
  // 0 centre line
  T(`20 0 432; 130 0 548; 250 0 596; 380 0 636; 520 0 672; 660 0 706; 800 0 740; 940 0 774; 1080 0 808; 1250 0 848
     1430 0 889; 1562 0 982; 1695 0 1075; 1828 0 1166; 1960 0 1250; 2140 0 1281; 2320 0 1285; 2500 0 1276; 2675 0 1256; 2850 0 1226
     2992 0 1169; 3134 0 1112; 3276 0 1056; 3418 0 999; 3560 0 942; 3715 0 874; 3860 0 830; 3872 0 874; 4010 0 918; 4140 0 912; 4260 0 898`),
  // 1
  T(`22 160 431; 133 195 545; 253 208 592; 383 218 632; 523 228 668; 663 240 702; 803 255 736; 943 270 770; 1083 290 804; 1262 312 845
     1465 330 887; 1594 320 979; 1723 310 1071; 1852 300 1160; 1975 290 1244; 2140 290 1273; 2320 290 1277; 2500 288 1268; 2675 285 1248; 2852 280 1218
     2996 280 1162; 3138 281 1106; 3280 283 1050; 3422 285 993; 3564 286 937; 3717 270 870; 3861 255 828; 3873 255 873; 4010 240 916; 4140 232 910; 4258 226 897`),
  // 2
  T(`30 310 428; 150 330 540; 262 345 586; 390 362 625; 528 385 660; 668 415 694; 808 450 728; 948 490 763; 1110 535 799; 1330 590 850
     1632 655 898; 1722 624 976; 1812 592 1066; 1902 560 1154; 1990 512 1238; 2146 498 1252; 2322 490 1256; 2500 484 1247; 2675 478 1227; 2856 470 1198
     3002 468 1150; 3144 470 1095; 3286 474 1040; 3428 478 985; 3570 482 930; 3720 482 866; 3864 470 826; 3876 470 872; 4010 450 913; 4140 436 908; 4254 426 896`),
  // 3
  T(`48 420 424; 165 425 538; 268 438 584; 392 462 620; 530 500 654; 670 530 687; 810 562 721; 950 596 757; 1110 630 795; 1350 668 850
     1660 698 900; 1748 665 978; 1836 630 1066; 1923 596 1152; 2010 562 1228; 2152 553 1232; 2324 548 1236; 2500 542 1227; 2676 536 1207; 2860 528 1178
     3010 535 1128; 3152 548 1072; 3294 562 1015; 3436 572 962; 3575 578 915; 3722 575 860; 3870 572 828; 3880 572 871; 4010 556 912; 4140 540 907; 4246 530 896`),
  // 4
  T(`70 520 420; 187 526 574; 270 489 640; 353 526 706; 520 575 750; 668 610 782; 808 640 800; 948 664 815; 1100 686 832; 1345 708 866
     1660 722 894; 1752 695 968; 1842 665 1052; 1932 634 1134; 2022 600 1210; 2190 592 1216; 2360 588 1219; 2530 583 1210; 2705 590 1188; 2880 612 1146
     3015 655 1080; 3125 712 1002; 3205 765 925; 3360 760 898; 3500 740 888; 3690 700 866; 3884 672 836; 3884 672 871; 4010 656 912; 4135 640 907; 4234 628 897`),
  // 5
  T(`100 610 416; 153 615 546; 270 615 640; 387 615 734; 520 665 792; 668 702 815; 808 726 828; 948 741 838; 1095 750 848; 1340 754 868
     1620 748 878; 1760 750 874; 1900 750 871; 2030 748 869; 2150 746 868; 2310 744 868; 2450 742 868; 2590 742 868; 2760 750 870; 2900 760 874
     3020 772 880; 3120 782 888; 3200 790 898; 3350 815 885; 3490 815 876; 3680 800 866; 3905 768 846; 3892 765 872; 4010 752 908; 4125 736 904; 4212 716 893`),
  // 6
  T(`150 690 412; 187 704 574; 270 741 640; 353 704 706; 515 762 762; 672 808 790; 810 830 804; 945 840 810; 1085 842 814; 1300 826 826
     1480 792 850; 1630 790 850; 1780 790 850; 1930 790 850; 2080 790 850; 2240 790 850; 2410 790 850; 2585 792 850; 2690 815 852; 2940 846 852
     3075 856 850; 3212 860 847; 3345 860 845; 3470 858 846; 3600 854 850; 3760 854 856; 3905 848 860; 3985 842 884; 4050 832 892; 4115 820 890; 4175 806 880`),
  // 7
  T(`208 752 409; 262 772 505; 325 798 585; 405 824 648; 540 856 705; 680 880 728; 812 891 741; 942 894 746; 1075 892 748; 1260 868 754
     1458 817 772; 1612 815 772; 1765 815 772; 1918 815 772; 2070 815 772; 2232 815 772; 2404 815 772; 2580 816 772; 2680 866 772; 2950 902 775
     3080 912 775; 3212 916 775; 3342 915 775; 3465 911 775; 3600 908 770; 3712 900 782; 3818 890 798; 3910 878 816; 3996 864 832; 4082 848 838; 4186 818 846`),
  // 8
  T(`285 800 407; 345 820 462; 410 842 503; 485 862 532; 570 880 548; 663 896 553; 787 899 648; 940 900 682; 1093 899 648; 1217 896 553
     1442 822 600; 1600 820 600; 1755 820 600; 1910 820 600; 2065 820 600; 2228 820 600; 2400 820 600; 2572 822 600; 2672 872 598; 2935 916 551
     3059 921 646; 3212 922 680; 3353 921 651; 3468 917 574; 3600 912 618; 3712 904 645; 3818 894 662; 3910 882 673; 3996 868 679; 4084 850 682; 4190 824 682`),
  // 9
  T(`372 833 405; 415 848 405; 458 860 405; 500 870 406; 545 879 407; 589 888 410; -; -; -; 1291 886 410
     1445 822 420; 1598 819 420; 1752 819 420; 1906 819 420; 2060 819 420; 2224 819 420; 2396 819 420; 2562 820 420; 2668 868 414; 2859 906 400
     -; -; -; 3532 912 488; 3615 911 505; 3715 905 522; 3818 895 538; 3910 883 550; 3996 869 558; 4084 851 562; 4190 826 562`),
  // 10
  T(`-; -; -; -; -; -; -; -; -; 1297 880 262
     1452 826 292; 1600 822 292; 1752 822 292; 1904 822 292; 2056 822 292; 2220 822 292; 2390 822 292; 2552 823 292; 2664 866 282; 2854 896 262
     -; -; -; -; -; -; -; -; -; -; -`),
  // 11
  T(`-; -; -; -; -; -; -; -; -; 1269 872 170
     1455 874 205; 1600 876 205; 1752 876 205; 1904 876 205; 2056 876 205; 2220 876 205; 2390 876 205; 2552 876 205; 2664 884 198; 2881 886 168
     -; -; -; -; -; -; -; -; -; -; -`),
  // 12
  T(`-; -; -; -; -; -; -; -; -; 1241 830 118
     1455 835 118; 1600 835 118; 1752 835 118; 1904 835 118; 2056 835 118; 2220 835 118; 2390 835 118; 2552 835 118; 2664 838 118; 2911 840 118
     -; -; -; -; -; -; -; -; -; -; -`),
];
/** the strip that wraps the tail's corner: the lines of columns 7 (the wing's lower edge), 8 (the tail lamp's top) and
 *  9 (the bumper seam) carried on from row 30 round to the centre line, six steps; the line of column 6 becomes the
 *  trailing edge itself (row 30, columns 5 .. 0), so the corner point (row 30, column 6) has three faces round it */
const WRAP: V[][] = [
  T(`4226 728 858; 4245 636 868; 4254 534 868; 4258 428 868; 4260 228 868; 4261 0 868`) as V[],
  T(`4238 740 682; 4252 640 682; 4257 536 682; 4259 430 682; 4260 229 682; 4261 0 682`) as V[],
  T(`4238 740 562; 4252 640 562; 4257 536 562; 4259 430 562; 4260 229 562; 4261 0 562`) as V[]];
/** the slot under the wing blade: its floor and roof half way through, at columns 0 .. 5 */
const SLOT_FLOOR: V[] = T(`4110 0 800; 4110 240 799; 4108 448 797; 4106 550 795; 4102 650 792; 4096 738 790`) as V[];
const SLOT_ROOF: V[] = T(`4075 0 878; 4075 240 877; 4073 448 876; 4070 550 875; 4066 650 874; 4060 738 873`) as V[];

export type Region = 'shell' | 'tail' | 'bumperF' | 'bumperR';
export type Mat = 'paint' | 'glass' | 'grille' | 'lamp' | 'amber' | 'lens' | 'dark';
export interface Tag { region: Region; mat: Mat; /** the panel's name (the part it is drawn and outlined as) */ panel: string; /** a socket's floor: the module that goes here */ socket?: string; /** the right side (y < 0 in the full cage) */ right?: boolean }
export interface CageLine { kind: 'door' | 'bonnet' | 'boot' | 'bumper' | 'lamp' | 'crease' | 'panel' | 'trim' | 'vent' | 'glass'; name: string; path: number[]; closed?: boolean; w?: number;
  /** a line not on the cage's own lines: it lies between the cage paths a and b (the same number of points), the part t of the way from a to b; `span`: only this part of its length (0..1) */ between?: { a: number[]; b: number[]; t: number; span?: [number, number] } }
export interface Cage959 extends Cage { tag: Tag[]; /** the main grid's point numbers ([row][column], -1 none), the left half */ M: number[][]; /** the wrapped strip: [0..2] the lines of columns 7..9, [0..5] the steps */ W: number[][];
  /** cage edges whose shading is split (hard creases); a subset of the sharp edges */ crease: Set<string>; lines: CageLine[]; /** boundary loops of the modules, as cage point paths */ loops: Record<string, number[]>;
  /** the mirror image of each point (itself on the centre line) */ mirror: number[] }

/** the material and panel of the main grid's cell between rows i, i+1 and columns j, j+1 */
function cell(i: number, j: number): Tag {
  if (j < 2 && i >= 10 && i < 14) return { region: 'shell', mat: 'glass', panel: 'windscreen' };
  if (j < 2 && i >= 19 && i < 24) return { region: 'shell', mat: 'glass', panel: 'rearWindow' };
  if (j === 4 && i >= 10 && i < 22) return { region: 'shell', mat: 'glass', panel: i < 17 ? 'doorGlass' : 'quarterGlass' };
  if (j < 2 && i >= 24 && i < 26) return { region: 'shell', mat: 'grille', panel: 'engineGrille' };
  if (i >= 26 && j < 6) return { region: 'tail', mat: 'paint', panel: 'wing' };
  if (j === 8 && i >= 28) return { region: 'shell', mat: 'amber', panel: 'tailLampEnd', socket: 'tailLamp' };
  if (i >= 1 && i < 3 && j >= 4 && j < 6) return { region: 'shell', mat: 'lens', panel: 'headLamp', socket: 'headLamp' };
  if (i === 17 && j === 7) return { region: 'shell', mat: 'dark', panel: 'sideIntake', socket: 'sideIntake' };
  if (j >= 9) return { region: 'shell', mat: 'paint', panel: 'sill' };
  if (j >= 5 && i >= 10 && i < 17) return { region: 'shell', mat: 'paint', panel: 'door' };
  if (j >= 2 && j < 4 && i >= 10 && i < 19) return { region: 'shell', mat: 'paint', panel: 'roof' };
  if (i >= 14 && i < 19 && j < 2) return { region: 'shell', mat: 'paint', panel: 'roof' };
  if (i < 10 && j < 3) return { region: 'shell', mat: 'paint', panel: 'bonnet' };
  if (i < 10) return { region: 'shell', mat: 'paint', panel: 'wingF' };
  return { region: 'shell', mat: 'paint', panel: 'wingR' };
}

export function buildCage(): Cage959 {
  const P: V[] = [], F: number[][] = [], tag: Tag[] = [], sharp = new Map<string, number>(), crease = new Set<string>();
  const pt = (p: V) => P.push([p[0], p[1], p[2]]) - 1, quad = (a: number, b: number, c: number, d: number, t: Tag) => { F.push([a, b, c, d]); tag.push(t); };
  const M: number[][] = Array.from({ length: NR }, (_, i) => Array.from({ length: NC }, (_, j) => COLS[j]![i] ? pt(COLS[j]![i]!) : -1));
  const hard = (a: number, b: number, s = 1, split = false) => { sharp.set(ekey(a, b), s); if (split) crease.add(ekey(a, b)); };
  const path = (p: number[], s = 1, split = false, closed = false) => { for (let q = 0; q + 1 < p.length; q++) hard(p[q]!, p[q + 1]!, s, split); if (closed) hard(p[p.length - 1]!, p[0]!, s, split); };
  const inArch = (i: number, j: number) => j >= ARCH.top && ((i >= ARCH.f.rows[0] && i < ARCH.f.rows[1]) || (i >= ARCH.r.rows[0] && i < ARCH.r.rows[1]));
  const slot = (i: number, j: number) => i === 26 && j < 5;
  for (let i = 0; i + 1 < NR; i++) for (let j = 0; j + 1 < NC; j++) { const a = M[i]![j]!, b = M[i + 1]![j]!, c = M[i + 1]![j + 1]!, d = M[i]![j + 1]!;
    if (a < 0 || b < 0 || c < 0 || d < 0 || inArch(i, j) || slot(i, j)) continue; quad(a, b, c, d, cell(i, j)); }
  // the tail's corner: the wrapped strip. Its top line is row 30 read inward (column 6 the corner, then 5 .. 0)
  const W: number[][] = WRAP.map(l => l.map(pt)), wl = (m: number, k: number) => m === 6 ? M[30]![6 - k]! : k === 0 ? M[30]![m]! : W[m - 7]![k - 1]!;
  for (let k = 0; k < 6; k++) for (let m = 6; m < 9; m++) { if (m === 7 && k >= 1) continue;   // the slot's rear mouth
    quad(wl(m, k), wl(m, k + 1), wl(m + 1, k + 1), wl(m + 1, k), m === 8 ? { region: 'shell', mat: k === 0 ? 'amber' : 'lamp', panel: k === 0 ? 'tailLampEnd' : 'tailLamp', socket: 'tailLamp' } : { region: 'tail', mat: 'paint', panel: 'wing' }); }
  // the slot under the blade: floor (the engine lid running on down to the lamp's top), side wall and roof (the blade's underside)
  const sf = SLOT_FLOOR.map(pt), sr = SLOT_ROOF.map(pt), fl: Tag = { region: 'tail', mat: 'dark', panel: 'wingSlot' }, rf: Tag = { region: 'tail', mat: 'paint', panel: 'wing' };
  for (let j = 0; j < 5; j++) { quad(M[26]![j]!, sf[j]!, sf[j + 1]!, M[26]![j + 1]!, fl); quad(sf[j]!, wl(8, 6 - j), wl(8, 5 - j), sf[j + 1]!, { region: 'tail', mat: 'paint', panel: 'tailPanel' });
    quad(M[27]![j]!, M[27]![j + 1]!, sr[j + 1]!, sr[j]!, rf); quad(sr[j]!, sr[j + 1]!, wl(7, 5 - j), wl(7, 6 - j), rf); }
  quad(M[26]![5]!, sf[5]!, sr[5]!, M[27]![5]!, fl); quad(sf[5]!, wl(8, 1), wl(7, 1), sr[5]!, fl);
  // the bumpers: placeholder modules hung on the seam loops. Each point of the seam carries three more below it
  // (the face's middle, the lip, the foot), set out from the seam's own point; at the arch they lie on its circle
  const strip = (seam: number[], region: Region, zs: [number, number, number], cx: number, arch: V[], name: string, what: (m: number, k: number) => [Mat, string] | null) => { const rows: number[][] = [seam];
    for (let m = 0; m < 3; m++) rows.push(seam.map((s, k) => { if (k === 0) return pt(arch[m]!); const p = P[s]!, dx = p[0] - cx, l = Math.hypot(dx, p[1]) || 1, o = [10, 4, -42][m]!; return pt([p[0] + dx / l * o, Math.max(0, p[1] + p[1] / l * o), zs[m]! + (m === 0 ? (p[2] - P[seam[seam.length - 1]!]![2]) * 0.2 : 0)]); }));
    for (let m = 0; m < 3; m++) for (let k = 0; k + 1 < seam.length; k++) { const q = [rows[m]![k]!, rows[m]![k + 1]!, rows[m + 1]![k + 1]!, rows[m + 1]![k]!]; if (region === 'bumperF') q.reverse(); const w = what(m, k); quad(q[0]!, q[1]!, q[2]!, q[3]!, { region, mat: w ? w[0] : 'paint', panel: w ? w[1] : name }); }
    return rows; };
  const A = ARCH, onArch = (a: { x: number; z: number }, deg: number, y: number): V => [a.x + A.rc * Math.cos(deg * Math.PI / 180), y, a.z + A.rc * Math.sin(deg * Math.PI / 180)];
  const seamF = [5, 4, 3, 2, 1].map(i => M[i]![9]!).concat([9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(j => M[0]![j]!));
  const seamR = [23, 24, 25, 26, 27, 28, 29, 30].map(i => M[i]![9]!).concat(W[2]!);
  const BF = strip(seamF, 'bumperF', [340, 195, 124], 700, [onArch(A.f, 184, 886), onArch(A.f, 201, 876), onArch(A.f, 214, 832)], 'bumperF',
    (m, k) => m === 0 && k >= 6 && k < 11 ? ['amber', 'indicatorF'] : m === 1 && k >= 9 ? ['grille', 'intakeF'] : m === 1 && k >= 1 && k < 5 ? ['grille', 'ventF'] : null);
  const BR = strip(seamR, 'bumperR', [405, 255, 216], 3600, [onArch(A.r, 13, 908), onArch(A.r, -10, 900), onArch(A.r, -17, 862)], 'bumperR',
    (m, k) => m === 1 && k >= 3 && k < 8 ? ['grille', 'ventR'] : m === 1 && k >= 9 ? ['dark', 'exhaustSlot'] : null);

  const colPath = (j: number, i0: number, i1: number) => Array.from({ length: i1 - i0 + 1 }, (_, k) => M[i0 + k]![j]!), rowPath = (i: number, j0: number, j1: number) => Array.from({ length: j1 - j0 + 1 }, (_, k) => M[i]![j0 + k]!);
  // ---- sharp edges: the module seams (hard for the positions; the shading runs over them), and the creases (split)
  path(seamF); path(seamR);
  path([28, 29, 30].map(i => M[i]![8]!).concat(W[1]!));                                  // the tail lamp's top
  path([0, 1, 2, 3].map(j => M[10]![j]!), 1, true);                                          // the screen's foot (the cowl)
  path([0, 1, 2, 3, 4, 5, 6].map(j => M[30]![j]!), 1, true); path([M[30]![7]!, ...W[0]!], 1, true);   // the blade's trailing edge, above and below
  path([0, 1, 2, 3, 4, 5].map(j => M[26]![j]!).concat([5, 4, 3, 2, 1, 0].map(j => M[27]![j]!)), 1, true);  // the slot's front mouth
  path([wl(8, 6), wl(8, 5), wl(8, 4), wl(8, 3), wl(8, 2), wl(8, 1), wl(7, 1), wl(7, 2), wl(7, 3), wl(7, 4), wl(7, 5), wl(7, 6)], 1, true);   // its rear mouth
  const lampRing = [M[1]![4]!, M[1]![5]!, M[1]![6]!, M[2]![6]!, M[3]![6]!, M[3]![5]!, M[3]![4]!, M[2]![4]!]; path(lampRing, 1, true, true);
  const intake = [M[17]![7]!, M[18]![7]!, M[18]![8]!, M[17]![8]!]; path(intake, 1, true, true);
  path(colPath(5, 10, 22), 1, true); path(colPath(4, 10, 22), 1, true);                       // the side glass's foot (the belt) and top
  path([...rowPath(10, 0, 2), ...colPath(2, 11, 14)]); path(rowPath(14, 0, 2)); path([...rowPath(19, 0, 2), ...colPath(2, 20, 24)]); path(rowPath(24, 0, 2));   // the screen's and the back window's edges
  path(colPath(10, 9, 19), 0.6);                                                             // the door's foot, where the sill steps out

  // ---- the drawn lines (cage point paths; the shell follows them through the subdivision)
  const lines: CageLine[] = [
    { kind: 'bumper', name: 'frontBumperSeam', path: seamF.slice().reverse() }, { kind: 'bumper', name: 'rearBumperSeam', path: seamR },
    { kind: 'bonnet', name: 'bonnetShut', path: colPath(3, 0, 10) }, { kind: 'bonnet', name: 'bonnetRear', path: rowPath(10, 0, 3) },
    { kind: 'door', name: 'doorFront', path: rowPath(10, 5, 10) }, { kind: 'door', name: 'doorRear', path: rowPath(17, 5, 10) }, { kind: 'door', name: 'doorFoot', path: colPath(10, 10, 17) }, { kind: 'door', name: 'doorTop', path: colPath(5, 10, 17) },
    { kind: 'panel', name: 'sillLine', path: colPath(10, 9, 19) },
    { kind: 'glass', name: 'windscreen', path: [...rowPath(10, 0, 2), ...colPath(2, 11, 14), ...rowPath(14, 0, 1).reverse()] },
    { kind: 'glass', name: 'sideGlass', path: [...colPath(4, 10, 22), ...colPath(5, 10, 22).reverse()], closed: true }, { kind: 'trim', name: 'bPillar', path: [M[17]![4]!, M[17]![5]!], w: 2.5 },
    { kind: 'glass', name: 'rearWindow', path: [...rowPath(19, 0, 2), ...colPath(2, 20, 24), ...rowPath(24, 0, 1).reverse()] },
    { kind: 'trim', name: 'dripRail', path: colPath(3, 10, 19) },
    { kind: 'boot', name: 'engineLid', path: [...rowPath(24, 0, 2), M[25]![2]!, ...rowPath(26, 0, 2).reverse()] },
    { kind: 'panel', name: 'wingSeam', path: [...rowPath(26, 0, 6), M[26]![7]!] },
    { kind: 'lamp', name: 'headLampRim', path: lampRing, closed: true }, { kind: 'lamp', name: 'tailLampTop', path: [28, 29, 30].map(i => M[i]![8]!).concat(W[1]!) }, { kind: 'lamp', name: 'tailLampEnd', path: [M[28]![8]!, M[28]![9]!] },
    { kind: 'vent', name: 'sideIntake', path: intake, closed: true },
    ...[0.5].map(t => ({ kind: 'vent' as const, name: 'intakeFBar', path: [], between: { a: BF[1]!.slice(9), b: BF[2]!.slice(9), t } })), { kind: 'vent', name: 'intakeFTop', path: [BF[2]![9]!, ...BF[1]!.slice(9)] }, { kind: 'vent', name: 'intakeFFoot', path: BF[2]!.slice(9) },
    ...[0.25, 0.5, 0.75].map((t, q) => ({ kind: 'vent' as const, name: `ventFSlat${q}`, path: [], between: { a: BF[1]!.slice(1, 6), b: BF[2]!.slice(1, 6), t } })), { kind: 'vent', name: 'ventFRim', path: [...BF[1]!.slice(1, 6), ...BF[2]!.slice(1, 6).reverse()], closed: true },
    ...[0.25, 0.5, 0.75].map((t, q) => ({ kind: 'vent' as const, name: `ventRSlat${q}`, path: [], between: { a: BR[1]!.slice(3, 9), b: BR[2]!.slice(3, 9), t } })), { kind: 'vent', name: 'ventRRim', path: [...BR[1]!.slice(3, 9), ...BR[2]!.slice(3, 9).reverse()], closed: true },
    { kind: 'vent', name: 'exhaustSlotTop', path: [BR[2]![9]!, ...BR[1]!.slice(9)] }, { kind: 'vent', name: 'exhaustSlotFoot', path: BR[2]!.slice(9) }, { kind: 'lamp', name: 'indicatorF', path: [BF[0]![6]!, ...BF[1]!.slice(6, 12), BF[0]![11]!] },
    ...[[24, 25, 0.5], [24, 25, 1], [25, 26, 0.5]].map(([i0, i1, t], q) => ({ kind: 'vent' as const, name: `engineLouvre${q}`, path: [], between: { a: rowPath(i0!, 0, 2), b: rowPath(i1!, 0, 2), t: t! } })),
    { kind: 'trim', name: 'doorHandle', path: [], w: 2, between: { a: colPath(7, 16, 17), b: colPath(8, 16, 17), t: 0.14, span: [0.2, 0.75] } },
    { kind: 'crease', name: 'wingTrailingEdge', path: rowPath(30, 0, 6) }, { kind: 'crease', name: 'wingLowerEdge', path: [M[30]![7]!, ...W[0]!] }, { kind: 'vent', name: 'wingSlot', path: [...rowPath(26, 0, 5), ...rowPath(27, 0, 5).reverse()] },
  ];
  const loops: Record<string, number[]> = { frontBumper: seamF, rearBumper: seamR, headLamp: lampRing, sideIntake: intake,
    tailLamp: [M[28]![9]!, M[28]![8]!, M[29]![8]!, M[30]![8]!, ...W[1]!, ...W[2]!.slice().reverse(), M[30]![9]!, M[29]![9]!, M[28]![9]!],
    wing: [...rowPath(26, 0, 6)], frontBumperFoot: BF[3]!, rearBumperFoot: BR[3]!, sillFoot: colPath(12, 9, 19) };

  // ---- the other half
  const n = P.length, mirror: number[] = []; for (let v = 0; v < n; v++) mirror.push(Math.abs(P[v]![1]) < 1e-6 ? v : pt([P[v]![0], -P[v]![1], P[v]![2]]));
  for (let v = n; v < P.length; v++) mirror.push(mirror.indexOf(v));
  const nf = F.length; for (let k = 0; k < nf; k++) { F.push(F[k]!.map(v => mirror[v]!).reverse()); tag.push({ ...tag[k]!, right: true }); }
  for (const [key, s] of [...sharp]) { const [a, b] = key.split('|').map(Number) as [number, number], mk = ekey(mirror[a]!, mirror[b]!); sharp.set(mk, s); if (crease.has(key)) crease.add(mk); }
  return { P, F, sharp, tag, M, W, crease, lines, loops, mirror };
}
