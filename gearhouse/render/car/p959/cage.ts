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
import { DIM, frameOf, type FrameDims } from './frame';
import type { GlassId } from '../../../core/frames';

export { DIM };
export const NR = 31, NC = 13;
/** the arches: hub, the cage's radius (the subdivided ring lands on archR), rows and the top column */
export const ARCH = { f: { x: DIM.axleF, z: DIM.hubZ, rows: [5, 9] as [number, number] }, r: { x: DIM.axleR, z: DIM.hubZ - 2, rows: [19, 23] as [number, number] }, rc: 362, top: 8 };

const T = (s: string): (V | null)[] => s.trim().split(/\s*[;\n]\s*/).map(r => r.trim() === '-' ? null : r.trim().split(/[\s,]+/).map(Number) as V);
/** the columns, one row a line: x y z */
const COLS: (V | null)[][] = [
  // 0 centre line
  T(`20 0 432; 130 0 548; 250 0 596; 380 0 636; 520 0 672; 660 0 706; 800 0 739; 940 0 770; 1080 0 800; 1250 0 834
     1430 0 868; 1562 0 964; 1695 0 1060; 1828 0 1155; 1960 0 1250; 2140 0 1281; 2320 0 1285; 2500 0 1276; 2675 0 1256; 2850 0 1226
     2992 0 1169; 3134 0 1112; 3276 0 1056; 3418 0 999; 3560 0 942; 3715 0 866; 3860 0 802; 3872 0 868; 4010 0 940; 4140 0 930; 4260 0 906`),
  // 1
  T(`22 160 431; 132 195 546; 253 208 592; 383 218 632; 523 228 668; 663 240 702; 803 255 735; 943 270 766; 1083 290 796; 1262 312 831
     1465 330 868; 1594 320 962; 1723 310 1057; 1852 300 1151; 1975 290 1244; 2140 290 1273; 2320 290 1277; 2500 288 1268; 2675 285 1248; 2852 280 1218
     2996 280 1162; 3138 281 1106; 3280 283 1050; 3422 285 993; 3564 286 937; 3717 270 862; 3861 255 800; 3873 255 868; 4010 240 938; 4140 232 928; 4258 226 905`),
  // 2
  T(`30 310 428; 141 330 541; 262 345 584; 390 362 624; 528 385 660; 668 415.2 693.6; 808 450.6 726.7; 948 489.3 758.8; 1110 534.9 793.3; 1400 610.3 845
     1632 655 874; 1722 624 968; 1812 592 1060; 1902 560 1151; 1990 512 1238; 2146 498 1252; 2322 490 1256; 2500 484 1247; 2675 478 1227; 2856 470 1198
     3002 468 1150; 3144 470 1095; 3286 474 1040; 3428 478 985; 3570 482 930; 3720 482 858; 3864 470 798; 3876 470 868; 4010 450 935; 4140 436 926; 4254 426 904`),
  // 3
  T(`48 420 424; 155 425 533; 268 440.6 572.5; 392 464.6 611.1; 530 496.1 649.8; 670 529.8 685.9; 810 562.4 719.9; 950 592.2 752.2; 1110 621.8 787.1; 1430 667.9 847.3
     1660 698 876; 1748 665 970; 1836 630 1061; 1923 596 1150; 2010 562 1228; 2152 553 1232; 2324 548 1236; 2500 542 1227; 2676 536 1207; 2860 528 1178
     3010 535 1128; 3152 548 1072; 3294 562 1015; 3436 572 961; 3575 578 911; 3722 575 854; 3870 572 800; 3880 572 868; 4010 556 932; 4140 540 923; 4246 530 902`),
  // 4
  T(`70 520 420; 187 526 574; 270 489 640; 353 526 706; 520 586 771; 668 609.5 790.8; 808 631.7 807.2; 948 653.9 821.3; 1100 678 834.3; 1440 709.1 862
     1660 722 878; 1752 695 962; 1842 665 1049; 1932 634 1133; 2022 600 1210; 2190 592 1216; 2360 588 1219; 2530 583 1210; 2705 590 1188; 2880 612 1146
     3015 655 1080; 3125 712 1002; 3205 765 925; 3360 760 898; 3500 740 888; 3690 700 864; 3884 672 808; 3884 672 866; 4010 656 927; 4135 640 918; 4234 628 898`),
  // 5
  T(`100 610 416; 153 615 546; 270 615 640; 387 615 734; 520 680 800; 668 699 822.4; 808 715.3 837.2; 948 729.3 846.5; 1095 740.8 851.7; 1430 751.8 861.2
     1620 746 870; 1760 745.4 870; 1900 744.9 870; 2050 744.3 870; 2200 743.7 870; 2380 743.1 870; 2560 742.6 870; 2590 742 870; 2760 750 870; 2900 760 874
     3020 772 880; 3120 782 888; 3200 790 898; 3350 815 876; 3490 815 872; 3680 800 866; 3905 768 846; 3960 754 862; 4010 744 916; 4125 726 906; 4208 704 888`),
  // 6
  T(`150 690 412; 187 704 574; 270 741 640; 353 704 706; 515 800 770; 672 812.3 790.3; 810 824.8 804.9; 945 834.4 816.5; 1085 837.5 826.3; 1300 818.8 839.7
     1480 768 853; 1664 768 853; 1848 768 853; 2032 768 853; 2217 768 853; 2401 768 853; 2585 768 853; 2640 786 854; 2740 812 854; 2940 846 852
     3075 855.4 849.9; 3212 859.9 847.6; 3345 860.2 845.8; 3470 857.5 845; 3600 852.3 845.7; 3760 843.4 849.2; 3905 834 856; 3985 826 862; 4050 816 878; 4115 800 872; 4165 780 858`),
  // 7
  T(`208 752 409; 262 772 505; 325 798 585; 405 824 648; 540 874 676; 680 884 706; 812 889 728; 942 890 744; 1075 888 758; 1260 868 778
     1458 797 806; 1645 797 806; 1832 797 806; 2019 797 806; 2206 797 806; 2393 797 806; 2580 797 806; 2640 826 804; 2740 860 800; 2950 902 775
     3080 912.2 780.3; 3212 915.9 776.2; 3342 915.1 770.7; 3465 911.4 769.2; 3600 904.4 774.3; 3712 896.1 784.1; 3818 885.2 796.8; 3910 872.7 808.4; 3996 857.7 817.3; 4082 838.5 821.8; 4172 812 818`),
  // 8
  T(`285 800 407; 345 820 462; 410 842 503; 485 862 532; 570 884 548; 663 896 553; 787 899 648; 940 900 682; 1093 899 648; 1217 896 553
     1442 822 600; 1630 820 600; 1819 820 600; 2007 820 600; 2195 820 600; 2384 820 600; 2572 820 600; 2640 846 600; 2740 884 598; 2935 916 551
     3059 921 646; 3212 922 680; 3353 921 651; 3468 917 574; 3600 910.3 618; 3712 904 644.7; 3818 895.1 662.4; 3910 883.4 672.9; 3996 867.7 678.9; 4084 845.5 682; 4178 812 682`),
  // 9
  T(`372 833 407; 415 848 407; 458 860 407; 500 870 407; 545 879 407; 589 888 407; -; -; -; 1291 886 410
     1445 822 420; 1631 819 420; 1817 819 420; 2004 819 420; 2190 819 420; 2376 819 420; 2562 819 420; 2640 844 418; 2740 882 410; 2859 906 400
     -; -; -; 3532 912 488; 3615 911 505; 3715 905 522; 3818 895 538; 3910 883 550; 3996 869 558; 4084 849 562; 4178 814 562`),
  // 10
  T(`-; -; -; -; -; -; -; -; -; 1297 880 262
     1452 826 292; 1635 822 292; 1819 822 292; 2002 822 292; 2185 822 292; 2369 822 292; 2552 822 292; 2640 846 288; 2740 876 278; 2854 896 262
     -; -; -; -; -; -; -; -; -; -; -`),
  // 11
  T(`-; -; -; -; -; -; -; -; -; 1269 872 170
     1455 866 200; 1638 866 200; 1821 866 200; 2004 866 200; 2186 866 200; 2369 866 200; 2552 866 200; 2640 870 200; 2740 878 195; 2881 886 168
     -; -; -; -; -; -; -; -; -; -; -`),
  // 12
  T(`-; -; -; -; -; -; -; -; -; 1241 846 118
     1455 850 118; 1638 850 118; 1821 850 118; 2004 850 118; 2186 850 118; 2369 850 118; 2552 850 118; 2640 850 118; 2740 850 118; 2911 850 118
     -; -; -; -; -; -; -; -; -; -; -`),
];
/** the strip that wraps the tail's corner: the lines of columns 7 (the wing's lower edge), 8 (the tail lamp's top) and
 *  9 (the bumper seam) carried on from row 30 round to the centre line, six steps; the line of column 6 becomes the
 *  trailing edge itself (row 30, columns 5 .. 0), so the corner point (row 30, column 6) has three faces round it */
const WRAP: V[][] = [
  T(`4224 712 850; 4245 630 872; 4254 534 876; 4258 428 877; 4260 228 878; 4261 0 878`) as V[],
  T(`4232 722 682; 4250 632 682; 4257 536 682; 4259 430 682; 4260 229 682; 4261 0 682`) as V[],
  T(`4232 722 562; 4250 632 562; 4257 536 562; 4259 430 562; 4260 229 562; 4261 0 562`) as V[]];
/** the slot under the wing blade: its floor and roof part way through, at columns 0 .. 5. The floor is the engine lid
 *  running on, dark, to a short painted panel that rises from the tail lamp's top */
const SLOT_FLOOR: V[] = T(`4215 0 722; 4215 240 722; 4214 448 721; 4213 550 720; 4211 640 719; 4204 716 718`) as V[];
const SLOT_ROOF: V[] = T(`4075 0 892; 4075 240 891; 4073 448 890; 4070 550 889; 4066 646 887; 4060 722 884`) as V[];

export type Region = 'shell' | 'tail' | 'bumperF' | 'bumperR';
export type Mat = 'paint' | 'glass' | 'grille' | 'lamp' | 'amber' | 'lens' | 'dark';
export interface Tag { region: Region; mat: Mat; /** the panel's name (the part it is drawn and outlined as) */ panel: string; /** a socket's floor: the module that goes here */ socket?: string; /** the right side (y < 0 in the full cage) */ right?: boolean;
  /** the car's own material where the look painted the cell over (the lump's): its shading still splits where the car's does, at the hard edges round its glass and lamps */ was?: Mat }
export interface CageLine { kind: 'door' | 'bonnet' | 'boot' | 'bumper' | 'lamp' | 'crease' | 'panel' | 'trim' | 'vent' | 'glass'; name: string; path: number[]; closed?: boolean; w?: number;
  /** a line not on the cage's own lines: it lies between the cage paths a and b (the same number of points), the part t of the way from a to b; `span`: only this part of its length (0..1) */ between?: { a: number[]; b: number[]; t: number; span?: [number, number] } }
export interface Cage959 extends Cage { tag: Tag[]; /** the main grid's point numbers ([row][column], -1 none), the left half */ M: number[][]; /** the wrapped strip: [0..2] the lines of columns 7..9, [0..5] the steps */ W: number[][];
  /** cage edges whose shading is split (hard creases); a subset of the sharp edges */ crease: Set<string>; lines: CageLine[]; /** boundary loops of the modules, as cage point paths */ loops: Record<string, number[]>;
  /** the mirror image of each point (itself on the centre line) */ mirror: number[] }

/** what of the car's own openings the cage carries (docs/systems/115 §4-1: the lump "차체 A" has none of them) */
interface Look { lamps: boolean; details: boolean; glass: GlassId | null }
/** the material and panel of the main grid's cell between rows i, i+1 and columns j, j+1, as the look has it: a cell
 *  whose opening is not there keeps its panel's name and socket and is painted (the lump: its glass, lamps, grilles in body colour) */
function cell(i: number, j: number, L: Look): Tag { const t = cellOwn(i, j);
  if (t.mat === 'glass') return !L.glass || (L.glass === 'noQuarter' && t.panel === 'quarterGlass') ? { ...t, mat: 'paint', was: 'glass' } : L.glass === 'louvre' && t.panel === 'rearWindow' ? { ...t, mat: 'grille', was: 'glass' } : t;
  if (t.mat === 'lens') return L.lamps ? t : { ...t, mat: 'paint', was: 'lens', panel: 'wingF' };
  if (t.mat === 'grille' || t.mat === 'amber') return L.details ? t : { ...t, mat: 'paint', was: t.mat, panel: t.panel === 'sideIntake' || t.panel === 'tailLampEnd' ? 'wingR' : t.panel };
  return t; }
function cellOwn(i: number, j: number): Tag {
  if (j < 2 && i >= 10 && i < 14) return { region: 'shell', mat: 'glass', panel: 'windscreen' };
  if (j < 2 && i >= 19 && i < 24) return { region: 'shell', mat: 'glass', panel: 'rearWindow' };
  if (j === 4 && i >= 10 && i < 22) return { region: 'shell', mat: 'glass', panel: i < 17 ? 'doorGlass' : 'quarterGlass' };
  if (j < 2 && i >= 24 && i < 26) return { region: 'shell', mat: 'grille', panel: 'engineGrille' };
  if (i >= 26 && j < 6) return { region: 'tail', mat: 'paint', panel: 'wing' };
  if (j === 8 && i >= 28) return { region: 'shell', mat: 'amber', panel: 'tailLampEnd', socket: 'tailLamp' };
  if (i >= 1 && i < 3 && j >= 4 && j < 6) return { region: 'shell', mat: 'lens', panel: 'headLamp', socket: 'headLamp' };
  if (i === 17 && j === 7) return { region: 'shell', mat: 'grille', panel: 'sideIntake', socket: 'sideIntake' };
  if (j >= 9) return { region: 'shell', mat: 'paint', panel: 'sill' };
  if (j >= 5 && i >= 10 && i < 16) return { region: 'shell', mat: 'paint', panel: 'door' };
  if (j >= 2 && j < 4 && i >= 10 && i < 19) return { region: 'shell', mat: 'paint', panel: 'roof' };
  if (i >= 14 && i < 19 && j < 2) return { region: 'shell', mat: 'paint', panel: 'roof' };
  if (i < 10 && j < 3) return { region: 'shell', mat: 'paint', panel: 'bonnet' };
  if (i < 10) return { region: 'shell', mat: 'paint', panel: 'wingF' };
  return { region: 'shell', mat: 'paint', panel: 'wingR' };
}

export type BumperKind = 'std' | 'aero' | 'clean' | 'blank';
export interface CageOpts { bumperF?: BumperKind; bumperR?: BumperKind;
  /** the head lamps' lenses in their cells (default on; off: the cells painted, the lump's) */ lamps?: boolean;
  /** the car's other openings (default on; off: the lump's): the tail lamp band, the side intakes, the engine lid's grille, the door handles' lines */ details?: boolean;
  /** the glass set on the cabin's cells (docs/systems/115 §4-2; default the car's own; null: none, the cabin all body colour) */ glass?: GlassId | null;
  /** the frame's dimensions (docs/systems/115 §4-4): the cage stretched by them (render/car/p959/frame.ts) */ dims?: Partial<FrameDims> }
export function buildCage(o: CageOpts = {}): Cage959 { const look: Look = { lamps: o.lamps !== false, details: o.details !== false, glass: o.glass === undefined ? 'stock' : o.glass };
  const P: V[] = [], F: number[][] = [], tag: Tag[] = [], sharp = new Map<string, number>(), crease = new Set<string>();
  const pt = (p: V) => P.push([p[0], p[1], p[2]]) - 1, quad = (a: number, b: number, c: number, d: number, t: Tag) => { F.push([a, b, c, d]); tag.push(t); };
  const M: number[][] = Array.from({ length: NR }, (_, i) => Array.from({ length: NC }, (_, j) => COLS[j]![i] ? pt(COLS[j]![i]!) : -1));
  const hard = (a: number, b: number, s = 1, split = false) => { sharp.set(ekey(a, b), s); if (split) crease.add(ekey(a, b)); };
  const path = (p: number[], s = 1, split = false, closed = false) => { for (let q = 0; q + 1 < p.length; q++) hard(p[q]!, p[q + 1]!, s, split); if (closed) hard(p[p.length - 1]!, p[0]!, s, split); };
  const inArch = (i: number, j: number) => j >= ARCH.top && ((i >= ARCH.f.rows[0] && i < ARCH.f.rows[1]) || (i >= ARCH.r.rows[0] && i < ARCH.r.rows[1]));
  const slot = (i: number, j: number) => i === 26 && j < 5;
  for (let i = 0; i + 1 < NR; i++) for (let j = 0; j + 1 < NC; j++) { const a = M[i]![j]!, b = M[i + 1]![j]!, c = M[i + 1]![j + 1]!, d = M[i]![j + 1]!;
    if (a < 0 || b < 0 || c < 0 || d < 0 || inArch(i, j) || slot(i, j)) continue; quad(a, b, c, d, cell(i, j, look)); }
  // the tail's corner: the wrapped strip. Its top line is row 30 read inward (column 6 the corner, then 5 .. 0)
  const W: number[][] = WRAP.map(l => l.map(pt)), wl = (m: number, k: number) => m === 6 ? M[30]![6 - k]! : k === 0 ? M[30]![m]! : W[m - 7]![k - 1]!;
  for (let k = 0; k < 6; k++) for (let m = 6; m < 9; m++) { if (m === 7 && k >= 1) continue;   // the slot's rear mouth
    quad(wl(m, k), wl(m, k + 1), wl(m + 1, k + 1), wl(m + 1, k), m === 8 ? { region: 'shell', mat: !look.details ? 'paint' : k === 0 ? 'amber' : 'lamp', panel: k === 0 ? 'tailLampEnd' : 'tailLamp', socket: 'tailLamp', ...(look.details ? {} : { was: k === 0 ? 'amber' as const : 'lamp' as const, panel: 'wing' }) } : { region: 'tail', mat: 'paint', panel: 'wing' }); }
  // the slot under the blade: floor (the engine lid running on down to the lamp's top), side wall and roof (the blade's underside)
  const sf = SLOT_FLOOR.map(pt), sr = SLOT_ROOF.map(pt), fl: Tag = { region: 'tail', mat: 'dark', panel: 'wingSlot' }, rf: Tag = fl;
  for (let j = 0; j < 5; j++) { quad(M[26]![j]!, sf[j]!, sf[j + 1]!, M[26]![j + 1]!, fl); quad(sf[j]!, wl(8, 6 - j), wl(8, 5 - j), sf[j + 1]!, { region: 'tail', mat: 'paint', panel: 'tailPanel' });
    quad(M[27]![j]!, M[27]![j + 1]!, sr[j + 1]!, sr[j]!, rf); quad(sr[j]!, sr[j + 1]!, wl(7, 5 - j), wl(7, 6 - j), rf); }
  quad(M[26]![5]!, sf[5]!, sr[5]!, M[27]![5]!, fl); quad(sf[5]!, wl(8, 1), wl(7, 1), sr[5]!, fl);
  // the bumpers: placeholder modules hung on the seam loops. Each point of the seam carries three more below it
  // (the face's middle, the lip, the foot), set out from the seam's own point; at the arch they lie on its circle
  const strip = (seam: number[], region: Region, zs: [number, number, number], offs: [number, number, number], cx: number, arch: V[], name: string, what: (m: number, k: number) => [Mat, string] | null) => { const rows: number[][] = [seam];
    for (let m = 0; m < 3; m++) rows.push(seam.map((s, k) => { if (k === 0) return pt(arch[m]!); const p = P[s]!, dx = p[0] - cx, l = Math.hypot(dx, p[1]) || 1, o = offs[m]!; return pt([p[0] + dx / l * o, Math.max(0, p[1] + p[1] / l * o), m === 0 ? Math.min(zs[0]! + (p[2] - P[seam[seam.length - 1]!]![2]) * 0.2, p[2] - 40) : zs[m]!]); }));
    for (let m = 0; m < 3; m++) for (let k = 0; k + 1 < seam.length; k++) { const q = [rows[m]![k]!, rows[m]![k + 1]!, rows[m + 1]![k + 1]!, rows[m + 1]![k]!]; if (region === 'bumperF') q.reverse(); const w = what(m, k); quad(q[0]!, q[1]!, q[2]!, q[3]!, { region, mat: w ? w[0] : 'paint', panel: w ? w[1] : name }); }
    return rows; };
  const A = ARCH, onArch = (a: { x: number; z: number }, deg: number, y: number): V => [a.x + A.rc * Math.cos(deg * Math.PI / 180), y, a.z + A.rc * Math.sin(deg * Math.PI / 180)];
  const seamF = [5, 4, 3, 2, 1].map(i => M[i]![9]!).concat([9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(j => M[0]![j]!));
  const seamR = [23, 24, 25, 26, 27, 28, 29, 30].map(i => M[i]![9]!).concat(W[2]!);
  // the arch end of a bumper's lines: on the arch's circle at each line's height
  const archAt = (a: { x: number; z: number }, z: number, y: number, front: boolean): V => { const t = Math.asin(Math.max(-1, Math.min(1, (z - a.z) / A.rc))); return [a.x + (front ? -1 : 1) * A.rc * Math.cos(t), y, z]; };
  // the variants (docs/systems/109 S3): std the car's own; aero a deeper lip (front) or a diffuser (rear); clean without the corner vents;
  // blank (docs/systems/115 §4-1) the std shape in body colour all over: no indicator, intake, vent or exhaust slot
  const kf = o.bumperF ?? 'std', kr = o.bumperR ?? 'std', zf: [number, number, number] = kf === 'aero' ? [365, 150, 92] : [365, 180, 124], zr: [number, number, number] = kr === 'aero' ? [520, 290, 175] : [520, 295, 216];
  const BF = strip(seamF, 'bumperF', zf, kf === 'aero' ? [12, 34, -6] : [10, 4, -42], 700, [archAt(A.f, zf[0], 888, true), archAt(A.f, zf[1], 878, true), archAt(A.f, Math.max(zf[2], 120), 832, true)], 'bumperF',
    (m, k) => kf === 'blank' ? null : m === 0 && k >= 6 && k < 11 ? ['amber', 'indicatorF'] : m === 1 && k >= 9 ? ['grille', 'intakeF'] : m === 1 && k >= 1 && k < 5 && kf !== 'clean' ? ['grille', 'ventF'] : kf === 'aero' && m === 2 ? ['dark', 'lipF'] : null);
  const BR = strip(seamR, 'bumperR', zr, kr === 'aero' ? [-3, -14, -40] : [-3, -22, -64], 3600, [archAt(A.r, Math.min(zr[0], P[seamR[0]!]![2] - 40), 910, false), archAt(A.r, zr[1], 902, false), archAt(A.r, zr[2], 862, false)], 'bumperR',
    (m, k) => kr === 'blank' ? null : m === 1 && k >= 3 && k < 8 && kr !== 'clean' ? ['grille', 'ventR'] : m === 2 && (k >= 9 || kr === 'aero') ? ['dark', kr === 'aero' ? 'diffuser' : 'exhaustSlot'] : null);

  const colPath = (j: number, i0: number, i1: number) => Array.from({ length: i1 - i0 + 1 }, (_, k) => M[i0 + k]![j]!), rowPath = (i: number, j0: number, j1: number) => Array.from({ length: j1 - j0 + 1 }, (_, k) => M[i]![j0 + k]!);
  // ---- sharp edges: the module seams (hard for the positions; the shading runs over them), and the creases (split)
  path(seamF); path(seamR);
  path([28, 29, 30].map(i => M[i]![8]!).concat(W[1]!));                                  // the tail lamp's top
  path([0, 1, 2, 3, 4, 5].map(j => M[10]![j]!), 1, true);                                          // the screen's foot (the cowl)
  path([0, 1, 2, 3, 4, 5, 6].map(j => M[30]![j]!), 1, true); path([M[30]![7]!, ...W[0]!], 1, true);   // the blade's trailing edge, above and below
  path([0, 1, 2, 3, 4, 5].map(j => M[26]![j]!).concat([5, 4, 3, 2, 1, 0].map(j => M[27]![j]!)), 1, true);  // the slot's front mouth
  path([wl(8, 6), wl(8, 5), wl(8, 4), wl(8, 3), wl(8, 2), wl(8, 1), wl(7, 1), wl(7, 2), wl(7, 3), wl(7, 4), wl(7, 5), wl(7, 6)], 1, true);   // its rear mouth
  const lampRing = [M[1]![4]!, M[1]![5]!, M[1]![6]!, M[2]![6]!, M[3]![6]!, M[3]![5]!, M[3]![4]!, M[2]![4]!]; path(lampRing, 1, true, true);   // kept on the lump too: the lamp's face is a flat of its own on the pod (smoothed, it folds 30 degrees across)
  const intake = [M[17]![7]!, M[18]![7]!, M[18]![8]!, M[17]![8]!]; if (look.details) path(intake, 1, true, true);
  path(colPath(5, 10, 22), 1, true); path(colPath(4, 10, 22), 1, true);                       // the side glass's foot (the belt) and top
  path([...rowPath(10, 0, 2), ...colPath(2, 11, 14)]); path(rowPath(14, 0, 2)); path([...rowPath(19, 0, 2), ...colPath(2, 20, 24)]); path(rowPath(24, 0, 2));   // the screen's and the back window's edges
  path(colPath(4, 3, 9), 1, true);                                                           // the lamp pod's inner edge
  path(colPath(3, 0, 10), 1, true);                                                          // the bonnet's shut line, in the valley beside the lamp pod
  path(rowPath(0, 0, 5), 1, true);                                                           // the bonnet's leading edge on the bumper
  path(rowPath(26, 5, 7), 1, true); path(rowPath(27, 5, 6), 1, true); path(colPath(6, 25, 27), 1, true); path(sf, 1, true);      // the wing leg's front face; the slot's floor where the painted panel starts                                                               // the lamp pod's inner edge: a tight radius
  path(colPath(10, 9, 19), 1, true);                                                            // the door's foot, where the sill steps out

  // ---- the drawn lines (cage point paths; the shell follows them through the subdivision)
  const lines: CageLine[] = [
    { kind: 'bumper', name: 'frontBumperSeam', path: seamF.slice().reverse() }, { kind: 'bumper', name: 'rearBumperSeam', path: seamR },
    { kind: 'bonnet', name: 'bonnetShut', path: colPath(3, 0, 10) }, { kind: 'bonnet', name: 'bonnetRear', path: rowPath(10, 0, 3) },
    { kind: 'door', name: 'doorFront', path: rowPath(10, 5, 10) }, { kind: 'door', name: 'doorRear', path: rowPath(16, 5, 10) }, { kind: 'door', name: 'doorFoot', path: colPath(10, 10, 16) }, { kind: 'door', name: 'doorTop', path: colPath(5, 10, 16) },
    { kind: 'panel', name: 'sillLine', path: colPath(10, 9, 19) },
    { kind: 'glass', name: 'windscreen', path: [...rowPath(10, 0, 2), ...colPath(2, 11, 14), ...rowPath(14, 0, 1).reverse()] },
    { kind: 'glass', name: 'sideGlass', path: [...colPath(4, 10, 22), ...colPath(5, 10, 22).reverse()], closed: true }, { kind: 'trim', name: 'bPillar', path: [M[17]![4]!, M[17]![5]!], w: 2.5 },
    { kind: 'glass', name: 'rearWindow', path: [...rowPath(19, 0, 2), ...colPath(2, 20, 24), ...rowPath(24, 0, 1).reverse()] },
    { kind: 'trim', name: 'dripRail', path: colPath(3, 10, 19) },
    { kind: 'boot', name: 'engineLid', path: [...rowPath(24, 0, 2), M[25]![2]!, ...rowPath(26, 0, 2).reverse()] },
    { kind: 'panel', name: 'wingSeam', path: [...rowPath(26, 0, 6), M[26]![7]!] },
    { kind: 'lamp', name: 'headLampRim', path: lampRing, closed: true }, { kind: 'lamp', name: 'tailLampTop', path: [28, 29, 30].map(i => M[i]![8]!).concat(W[1]!) }, { kind: 'lamp', name: 'tailLampEnd', path: [M[28]![8]!, M[28]![9]!] },
    { kind: 'vent', name: 'sideIntake', path: intake, closed: true },
    ...[0.5].map(t => ({ kind: 'vent' as const, name: 'intakeFBar', path: [], between: { a: BF[1]!.slice(9), b: BF[2]!.slice(9), t, span: [0, 0.62] as [number, number] } })), { kind: 'vent', name: 'intakeFTop', path: [BF[2]![9]!, ...BF[1]!.slice(9)] }, { kind: 'vent', name: 'intakeFFoot', path: BF[2]!.slice(9) },
    ...[0.25, 0.5, 0.75].map((t, q) => ({ kind: 'vent' as const, name: `ventFSlat${q}`, path: [], between: { a: BF[1]!.slice(1, 6), b: BF[2]!.slice(1, 6), t } })), { kind: 'vent', name: 'ventFRim', path: [...BF[1]!.slice(1, 6), ...BF[2]!.slice(1, 6).reverse()], closed: true },
    ...[0.25, 0.5, 0.75].map((t, q) => ({ kind: 'vent' as const, name: `ventRSlat${q}`, path: [], between: { a: BR[1]!.slice(3, 9), b: BR[2]!.slice(3, 9), t } })), { kind: 'vent', name: 'ventRRim', path: [...BR[1]!.slice(3, 9), ...BR[2]!.slice(3, 9).reverse()], closed: true },
    { kind: 'vent', name: 'exhaustSlotTop', path: BR[2]!.slice(9) }, { kind: 'trim', name: 'tailLampWordBar', path: [], w: 1.6, between: { a: [M[30]![8]!, ...W[1]!].slice(3), b: [M[30]![9]!, ...W[2]!].slice(3), t: 0.5 } }, { kind: 'lamp', name: 'indicatorF', path: [BF[0]![6]!, ...BF[1]!.slice(6, 12), BF[0]![11]!] },
    ...[[24, 25, 0.5], [24, 25, 1], [25, 26, 0.5]].map(([i0, i1, t], q) => ({ kind: 'vent' as const, name: `engineLouvre${q}`, path: [], between: { a: rowPath(i0!, 0, 2), b: rowPath(i1!, 0, 2), t: t! } })),
    { kind: 'trim', name: 'doorHandle', path: [], w: 2, between: { a: colPath(7, 15, 16), b: colPath(8, 15, 16), t: 0.14, span: [0.3, 0.85] } },
    ...[0.25, 0.5, 0.75].map((t, q) => ({ kind: 'vent' as const, name: `sideIntakeSlat${q}`, path: [], between: { a: [M[17]![7]!, M[18]![7]!], b: [M[17]![8]!, M[18]![8]!], t } })),
    { kind: 'crease', name: 'podEdge', path: colPath(4, 3, 9) },
    { kind: 'crease', name: 'wingTrailingEdge', path: rowPath(30, 0, 6) }, { kind: 'crease', name: 'wingLowerEdge', path: [M[30]![7]!, ...W[0]!] }, { kind: 'vent', name: 'wingSlot', path: [...rowPath(26, 0, 5), ...rowPath(27, 0, 5).reverse()] },
  ];
  const loops: Record<string, number[]> = { frontBumper: seamF, rearBumper: seamR, headLamp: lampRing, sideIntake: intake,
    tailLamp: [M[28]![9]!, M[28]![8]!, M[29]![8]!, M[30]![8]!, ...W[1]!, ...W[2]!.slice().reverse(), M[30]![9]!, M[29]![9]!, M[28]![9]!],
    wing: [...rowPath(26, 0, 6)], frontBumperFoot: BF[3]!, rearBumperFoot: BR[3]!, frontBumperArch: BF.map(r => r[0]!), rearBumperArch: BR.map(r => r[0]!), sillFoot: colPath(12, 9, 19) };

  // ---- the other half
  const n = P.length, mirror: number[] = []; for (let v = 0; v < n; v++) mirror.push(Math.abs(P[v]![1]) < 1e-6 ? v : pt([P[v]![0], -P[v]![1], P[v]![2]]));
  for (let v = n; v < P.length; v++) mirror.push(mirror.indexOf(v));
  const nf = F.length; for (let k = 0; k < nf; k++) { F.push(F[k]!.map(v => mirror[v]!).reverse()); tag.push({ ...tag[k]!, right: true }); }
  for (const [key, s] of [...sharp]) { const [a, b] = key.split('|').map(Number) as [number, number], mk = ekey(mirror[a]!, mirror[b]!); sharp.set(mk, s); if (crease.has(key)) crease.add(mk); }
  // the lines of what is not there go with it: a blank bumper's vents and lamps, the lump's lamp rims, intakes, louvres and
  // handle, the glass's edges with no glass (the belt and the cowl stay as creases of the shape); a set of its own lines
  const gone = (n: string) => (kf === 'clean' && /^ventF/.test(n)) || (kr === 'clean' && /^ventR/.test(n)) || (kf === 'blank' && /^(ventF|intakeF|indicatorF)/.test(n)) || (kr === 'blank' && /^(ventR|exhaustSlot)/.test(n))
    || (!look.lamps && n === 'headLampRim') || (!look.details && /^(tailLamp|sideIntake|engineLouvre|doorHandle)/.test(n))
    || (!look.glass && /^(windscreen|sideGlass|rearWindow|bPillar|dripRail)$/.test(n)) || (look.glass === 'noQuarter' && n === 'bPillar');
  const drawn = lines.filter(l => !gone(l.name)).map(l => look.glass === 'noQuarter' && l.name === 'sideGlass' ? { ...l, path: [...colPath(4, 10, 17), ...colPath(5, 10, 17).reverse()] } : l);
  if (look.glass === 'louvre') for (let i = 20; i < 24; i++) drawn.push({ kind: 'vent', name: `rearLouvre${i}`, path: rowPath(i, 0, 2) }, ...[0.5].map(t => ({ kind: 'vent' as const, name: `rearLouvre${i}h`, path: [], between: { a: rowPath(i, 0, 2), b: rowPath(i + 1, 0, 2), t } })));
  // the frame's dimensions: every point moved by the stretch (the arches' zones only carried, so their rings stay round)
  if (o.dims) { const f = frameOf(o.dims); for (let v = 0; v < P.length; v++) P[v] = f.at(P[v]!); }
  return { P, F, sharp, tag, M, W, crease, lines: drawn, loops, mirror };
}
