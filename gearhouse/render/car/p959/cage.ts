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
  T(`20 0 432; 130 0 556; 250 0 618; 380 0 664; 520 0 704; 660 0 739; 800 0 770; 940 0 798; 1080 0 825; 1250 0 857
     1430 0 889; 1562 0 982; 1695 0 1075; 1828 0 1166; 1960 0 1250; 2140 0 1281; 2320 0 1285; 2500 0 1276; 2675 0 1256; 2850 0 1226
     2992 0 1169; 3134 0 1112; 3276 0 1056; 3418 0 999; 3560 0 942; 3715 0 874; 3860 0 832; 3880 0 868; 4010 0 918; 4140 0 912; 4260 0 898`),
  // 1
  T(`22 160 431; 133 195 552; 253 208 613; 383 218 659; 523 228 699; 663 240 734; 803 255 765; 943 270 793; 1083 290 820; 1262 312 853
     1465 330 887; 1594 320 979; 1723 310 1071; 1852 300 1160; 1975 290 1244; 2140 290 1273; 2320 290 1277; 2500 288 1268; 2675 285 1248; 2852 280 1218
     2996 280 1162; 3138 281 1106; 3280 283 1050; 3422 285 993; 3564 286 937; 3717 270 870; 3860 255 829; 3882 150 866; 4010 142 916; 4140 135 910; 4258 130 897`),
  // 2
  T(`30 310 428; 150 330 546; 262 345 606; 390 362 652; 528 385 692; 668 415 727; 808 450 758; 948 490 787; 1110 535 818; 1330 590 858
     1632 655 898; 1722 624 976; 1812 592 1066; 1902 560 1154; 1990 512 1238; 2146 498 1252; 2322 490 1256; 2500 484 1247; 2675 478 1227; 2856 470 1198
     3002 468 1150; 3144 470 1095; 3286 474 1040; 3428 478 985; 3570 482 930; 3720 482 866; 3860 470 826; 3884 300 864; 4010 284 913; 4140 270 908; 4255 260 896`),
  // 3
  T(`48 420 424; 165 440 545; 268 455 606; 392 475 648; 530 500 686; 670 530 719; 810 562 750; 950 596 779; 1110 630 809; 1350 668 856
     1660 698 900; 1748 665 978; 1836 630 1066; 1923 596 1152; 2010 562 1228; 2152 553 1232; 2324 548 1236; 2500 542 1227; 2676 536 1207; 2860 528 1178
     3010 535 1128; 3152 548 1072; 3294 562 1015; 3436 572 962; 3575 578 915; 3722 575 860; 3860 560 828; 3884 450 866; 4010 426 912; 4140 406 907; 4250 390 896`),
  // 4
  T(`70 520 420; 194 533 564; 270 499 625; 346 533 686; 520 575 722; 668 610 752; 808 640 776; 948 664 797; 1100 686 820; 1345 708 862
     1660 722 894; 1752 695 968; 1842 665 1052; 1932 634 1134; 2022 600 1210; 2190 592 1216; 2360 588 1219; 2530 583 1210; 2705 590 1188; 2880 612 1146
     3015 655 1080; 3125 712 1002; 3205 765 925; 3360 760 898; 3500 740 888; 3690 700 868; 3855 650 842; 3884 600 872; 4010 568 913; 4135 542 907; 4238 520 897`),
  // 5
  T(`100 610 416; 162 615 539; 270 615 625; 378 615 711; 520 665 772; 668 702 798; 808 726 813; 948 741 825; 1095 750 838; 1340 754 864
     1620 748 878; 1760 750 874; 1900 750 871; 2030 748 869; 2150 746 868; 2310 744 868; 2450 742 868; 2590 742 868; 2760 750 870; 2900 760 874
     3020 772 880; 3120 782 888; 3200 790 898; 3350 815 885; 3490 815 876; 3680 800 868; 3840 780 866; 3890 735 880; 4010 705 914; 4125 680 908; 4212 660 897`),
  // 6
  T(`150 690 412; 194 697 564; 270 731 625; 346 697 686; 515 760 748; 672 806 780; 810 828 796; 945 838 803; 1085 840 808; 1300 834 822
     1480 820 848; 1630 820 850; 1780 820 850; 1930 820 850; 2080 820 850; 2240 820 850; 2410 820 850; 2585 822 850; 2760 834 852; 2940 852 852
     3075 866 850; 3212 872 847; 3345 872 845; 3470 868 846; 3600 862 852; 3710 854 862; 3815 844 874; 3905 832 884; 3990 818 892; 4070 801 896; 4150 780 898`),
  // 7
  T(`208 752 409; 262 772 505; 325 798 585; 405 824 648; 540 856 700; 680 880 724; 812 891 738; 942 894 743; 1075 894 745; 1260 886 752
     1458 868 772; 1612 867 772; 1765 867 772; 1918 867 772; 2070 867 772; 2232 867 772; 2404 867 772; 2580 868 772; 2758 886 770; 2950 905 765
     3080 916 762; 3212 920 760; 3342 919 760; 3465 915 763; 3600 908 772; 3712 899 786; 3818 888 802; 3910 875 818; 3996 858 832; 4078 836 844; 4160 790 852`),
  // 8
  T(`285 800 407; 345 820 462; 410 842 503; 485 862 532; 570 880 548; 663 896 553; 787 899 648; 940 900 682; 1093 899 648; 1217 896 553
     1442 880 600; 1600 876 600; 1755 876 600; 1910 876 600; 2065 876 600; 2228 876 600; 2400 876 600; 2572 878 600; 2745 896 596; 2935 916 551
     3059 921 646; 3212 922 680; 3353 921 651; 3468 917 574; 3600 911 618; 3712 902 645; 3818 890 662; 3910 876 673; 3996 858 679; 4080 836 682; 4165 800 682`),
  // 9
  T(`372 833 405; 415 848 405; 458 860 405; 500 870 406; 545 879 407; 589 888 410; -; -; -; 1291 888 410
     1445 878 402; 1598 876 400; 1752 876 400; 1906 876 400; 2060 876 400; 2224 876 400; 2396 876 400; 2562 877 400; 2730 890 400; 2859 906 400
     -; -; -; 3532 912 488; 3615 910 505; 3715 903 522; 3818 891 538; 3910 877 550; 3996 859 558; 4080 837 562; 4165 802 562`),
  // 10
  T(`-; -; -; -; -; -; -; -; -; 1297 880 262
     1452 870 262; 1600 866 262; 1752 866 262; 1904 866 262; 2056 866 262; 2220 866 262; 2390 866 262; 2552 867 262; 2722 880 262; 2854 896 262
     -; -; -; -; -; -; -; -; -; -; -`),
  // 11
  T(`-; -; -; -; -; -; -; -; -; 1269 868 170
     1455 860 168; 1600 856 166; 1752 856 166; 1904 856 166; 2056 856 166; 2220 856 166; 2390 856 166; 2552 857 166; 2722 870 167; 2881 884 168
     -; -; -; -; -; -; -; -; -; -; -`),
  // 12
  T(`-; -; -; -; -; -; -; -; -; 1241 820 118
     1455 805 118; 1600 800 118; 1752 800 118; 1904 800 118; 2056 800 118; 2220 800 118; 2390 800 118; 2552 801 118; 2722 812 118; 2911 836 118
     -; -; -; -; -; -; -; -; -; -; -`),
];
/** the strip that wraps the tail's corner: the lines of columns 7 (the wing's lower edge), 8 (the tail lamp's top) and
 *  9 (the bumper seam) carried on from row 30 round to the centre line, six steps; the line of column 6 becomes the
 *  trailing edge itself (row 30, columns 5 .. 0), so the corner point (row 30, column 6) has three faces round it */
const WRAP: V[][] = [
  T(`4218 668 852; 4243 524 852; 4253 392 852; 4257 261 852; 4259 130 852; 4260 0 852`) as V[],
  T(`4224 680 682; 4247 535 682; 4255 400 682; 4258 266 682; 4259 133 682; 4260 0 682`) as V[],
  T(`4224 680 562; 4247 535 562; 4255 400 562; 4258 266 562; 4259 133 562; 4260 0 562`) as V[]];
/** the slot under the wing blade: its floor and roof half way through, at columns 0 .. 4 */
const SLOT_FLOOR: V[] = T(`4070 0 752; 4070 140 751; 4068 280 749; 4064 420 746; 4056 560 742`) as V[];
const SLOT_ROOF: V[] = T(`4075 0 872; 4075 140 871; 4073 280 869; 4069 420 866; 4060 560 862`) as V[];

export type Region = 'shell' | 'tail' | 'bumperF' | 'bumperR';
export type Mat = 'paint' | 'glass' | 'grille' | 'lamp' | 'dark';
export interface Tag { region: Region; mat: Mat; /** the panel's name (the part it is drawn and outlined as) */ panel: string; /** a socket's floor: the module that goes here */ socket?: string; /** the right side (y < 0 in the full cage) */ right?: boolean }
export interface CageLine { kind: 'door' | 'bonnet' | 'boot' | 'bumper' | 'lamp' | 'crease' | 'panel' | 'trim' | 'vent' | 'glass'; name: string; path: number[]; closed?: boolean; w?: number }
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
  if (j === 8 && i >= 27) return { region: 'shell', mat: 'lamp', panel: 'tailLamp', socket: 'tailLamp' };
  if (i >= 1 && i < 3 && j >= 4 && j < 6) return { region: 'shell', mat: 'lamp', panel: 'headLamp', socket: 'headLamp' };
  if (i === 17 && j >= 6 && j < 8) return { region: 'shell', mat: 'dark', panel: 'sideIntake', socket: 'sideIntake' };
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
  const slot = (i: number, j: number) => i === 26 && j < 4;
  for (let i = 0; i + 1 < NR; i++) for (let j = 0; j + 1 < NC; j++) { const a = M[i]![j]!, b = M[i + 1]![j]!, c = M[i + 1]![j + 1]!, d = M[i]![j + 1]!;
    if (a < 0 || b < 0 || c < 0 || d < 0 || inArch(i, j) || slot(i, j)) continue; quad(a, b, c, d, cell(i, j)); }
  // the tail's corner: the wrapped strip. Its top line is row 30 read inward (column 6 the corner, then 5 .. 0)
  const W: number[][] = WRAP.map(l => l.map(pt)), wl = (m: number, k: number) => m === 6 ? M[30]![6 - k]! : k === 0 ? M[30]![m]! : W[m - 7]![k - 1]!;
  for (let k = 0; k < 6; k++) for (let m = 6; m < 9; m++) { if (m === 7 && k >= 2) continue;   // the slot's rear mouth
    quad(wl(m, k), wl(m, k + 1), wl(m + 1, k + 1), wl(m + 1, k), m === 8 ? { region: 'shell', mat: 'lamp', panel: 'tailLamp', socket: 'tailLamp' } : { region: 'tail', mat: 'paint', panel: 'wing' }); }
  // the slot under the blade: floor (the engine lid running on down to the lamp's top), side wall and roof (the blade's underside)
  const sf = SLOT_FLOOR.map(pt), sr = SLOT_ROOF.map(pt), fl: Tag = { region: 'tail', mat: 'grille', panel: 'wingSlot' }, rf: Tag = { region: 'tail', mat: 'paint', panel: 'wing' };
  for (let j = 0; j < 4; j++) { quad(M[26]![j]!, sf[j]!, sf[j + 1]!, M[26]![j + 1]!, fl); quad(sf[j]!, wl(8, 6 - j), wl(8, 5 - j), sf[j + 1]!, { ...fl, mat: 'paint' });
    quad(M[27]![j]!, M[27]![j + 1]!, sr[j + 1]!, sr[j]!, rf); quad(sr[j]!, sr[j + 1]!, wl(7, 5 - j), wl(7, 6 - j), rf); }
  quad(M[26]![4]!, sf[4]!, sr[4]!, M[27]![4]!, rf); quad(sf[4]!, wl(8, 2), wl(7, 2), sr[4]!, rf);
  // the bumpers: placeholder modules hung on the seam loops. Each point of the seam carries three more below it
  // (the face's middle, the lip, the foot), set out from the seam's own point; at the arch they lie on its circle
  const strip = (seam: number[], region: Region, zs: [number, number, number], cx: number, arch: V[], name: string) => { const rows: number[][] = [seam];
    for (let m = 0; m < 3; m++) rows.push(seam.map((s, k) => { if (k === 0) return pt(arch[m]!); const p = P[s]!, dx = p[0] - cx, l = Math.hypot(dx, p[1]) || 1, o = [10, 4, -42][m]!; return pt([p[0] + dx / l * o, Math.max(0, p[1] + p[1] / l * o), zs[m]! + (m === 0 ? (p[2] - P[seam[seam.length - 1]!]![2]) * 0.2 : 0)]); }));
    for (let m = 0; m < 3; m++) for (let k = 0; k + 1 < seam.length; k++) { const q = [rows[m]![k]!, rows[m]![k + 1]!, rows[m + 1]![k + 1]!, rows[m + 1]![k]!]; if (region === 'bumperF') q.reverse(); quad(q[0]!, q[1]!, q[2]!, q[3]!, { region, mat: 'paint', panel: name }); }
    return rows; };
  const A = ARCH, onArch = (a: { x: number; z: number }, deg: number, y: number): V => [a.x + A.rc * Math.cos(deg * Math.PI / 180), y, a.z + A.rc * Math.sin(deg * Math.PI / 180)];
  const seamF = [5, 4, 3, 2, 1].map(i => M[i]![9]!).concat([9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(j => M[0]![j]!));
  const seamR = [23, 24, 25, 26, 27, 28, 29, 30].map(i => M[i]![9]!).concat(W[2]!);
  const BF = strip(seamF, 'bumperF', [285, 172, 124], 700, [onArch(A.f, 189.5, 884), onArch(A.f, 204, 874), onArch(A.f, 214, 832)], 'bumperF');
  const BR = strip(seamR, 'bumperR', [400, 285, 220], 3600, [onArch(A.r, 11, 908), onArch(A.r, -8, 900), onArch(A.r, -17, 862)], 'bumperR');

  // ---- sharp edges: the module seams (hard for the positions; the shading runs over them), and the creases (split)
  path(seamF); path(seamR);
  path([27, 28, 29, 30].map(i => M[i]![8]!).concat(W[1]!));                                  // the tail lamp's top
  path([0, 1, 2, 3].map(j => M[10]![j]!), 1, true);                                          // the screen's foot (the cowl)
  path([0, 1, 2, 3, 4, 5, 6].map(j => M[30]![j]!), 1, true); path([M[30]![7]!, ...W[0]!], 1, true);   // the blade's trailing edge, above and below
  path([0, 1, 2, 3, 4].map(j => M[26]![j]!).concat([4, 3, 2, 1, 0].map(j => M[27]![j]!)), 1, true);  // the slot's front mouth
  path([wl(8, 6), wl(8, 5), wl(8, 4), wl(8, 3), wl(8, 2), wl(7, 2), wl(7, 3), wl(7, 4), wl(7, 5), wl(7, 6)], 1, true);   // its rear mouth
  const lampRing = [M[1]![4]!, M[1]![5]!, M[1]![6]!, M[2]![6]!, M[3]![6]!, M[3]![5]!, M[3]![4]!, M[2]![4]!]; path(lampRing, 1, true, true);
  const intake = [M[17]![6]!, M[18]![6]!, M[18]![7]!, M[18]![8]!, M[17]![8]!, M[17]![7]!]; path(intake, 1, true, true);

  // ---- the drawn lines (cage point paths; the shell follows them through the subdivision)
  const colPath = (j: number, i0: number, i1: number) => Array.from({ length: i1 - i0 + 1 }, (_, k) => M[i0 + k]![j]!), rowPath = (i: number, j0: number, j1: number) => Array.from({ length: j1 - j0 + 1 }, (_, k) => M[i]![j0 + k]!);
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
    { kind: 'lamp', name: 'headLampRim', path: lampRing, closed: true }, { kind: 'lamp', name: 'tailLampTop', path: [27, 28, 29, 30].map(i => M[i]![8]!).concat(W[1]!) }, { kind: 'lamp', name: 'tailLampEnd', path: [M[27]![8]!, M[27]![9]!] },
    { kind: 'vent', name: 'sideIntake', path: intake, closed: true },
    { kind: 'crease', name: 'wingTrailingEdge', path: rowPath(30, 0, 6) }, { kind: 'crease', name: 'wingLowerEdge', path: [M[30]![7]!, ...W[0]!] }, { kind: 'vent', name: 'wingSlot', path: [...rowPath(26, 0, 4), ...rowPath(27, 0, 4).reverse()] },
  ];
  const loops: Record<string, number[]> = { frontBumper: seamF, rearBumper: seamR, headLamp: lampRing, sideIntake: intake,
    tailLamp: [M[27]![9]!, M[27]![8]!, M[28]![8]!, M[29]![8]!, M[30]![8]!, ...W[1]!, ...W[2]!.slice().reverse(), M[30]![9]!, M[29]![9]!, M[28]![9]!],
    wing: [...rowPath(26, 0, 6)], frontBumperFoot: BF[3]!, rearBumperFoot: BR[3]!, sillFoot: colPath(12, 9, 19) };

  // ---- the other half
  const n = P.length, mirror: number[] = []; for (let v = 0; v < n; v++) mirror.push(Math.abs(P[v]![1]) < 1e-6 ? v : pt([P[v]![0], -P[v]![1], P[v]![2]]));
  for (let v = n; v < P.length; v++) mirror.push(mirror.indexOf(v));
  const nf = F.length; for (let k = 0; k < nf; k++) { F.push(F[k]!.map(v => mirror[v]!).reverse()); tag.push({ ...tag[k]!, right: true }); }
  for (const [key, s] of [...sharp]) { const [a, b] = key.split('|').map(Number) as [number, number], mk = ekey(mirror[a]!, mirror[b]!); sharp.set(mk, s); if (crease.has(key)) crease.add(mk); }
  return { P, F, sharp, tag, M, W, crease, lines, loops, mirror };
}
