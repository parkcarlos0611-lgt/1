// The 1935 grand roadster as a low-polygon mesh (review 80, the first trial of true 3D modelling). Every number is
// read off the sheet's views as the part model holds them (data/cars/sheet/dueSSJ35.json: side outlines for heights,
// plan outlines for widths) at the car's real wheelbase (3175 mm); the front view's widths are not used (drawn wide).
import { Build, section, wing, type Mesh, type V } from './mesh';

const PAINT = '#a9a8ae', PAINT2 = '#55585f', CHROME = '#c9cbcf', TAN = '#b98a52', LEATHER = '#a06c38', GLASS = '#a9c2cc', RUBBER = '#26242b', DARK = '#1c1b20', LENS = '#efe9cf', RED = '#c22c2b';
const FX = 526, RX = 3701, R = 421, WY = 730, TW = 190, L = 4517;
/** linear reading of a table of [x, value] */
const at = (tab: [number, number][], x: number) => { if (x <= tab[0]![0]) return tab[0]![1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i]![0]) { const [x0, v0] = tab[i - 1]!, [x1, v1] = tab[i]!; return v0 + (v1 - v0) * (x - x0) / (x1 - x0); } return tab[tab.length - 1]![1]; };
// the body's half-width (plan view) and its top (side view) along the car
const HALF: [number, number][] = [[516, 300], [700, 350], [1059, 398], [1783, 489], [2191, 543], [2327, 561], [2915, 570], [3232, 570], [3522, 543], [3775, 498], [4001, 444], [4137, 389], [4228, 308], [4290, 150]];
const TOP: [number, number][] = [[516, 1175], [560, 1228], [700, 1245], [1150, 1245], [1832, 1263], [2140, 1265], [2210, 1240], [2296, 1150]];
const BELT: [number, number][] = [[2298, 1079], [2544, 1070], [2807, 1052], [3043, 1017], [3508, 1009], [3859, 1035], [3921, 1017], [3982, 965], [4052, 860], [4105, 719], [4140, 561], [4290, 480]];

function wheel(b: Build, x: number, s: 1 | -1, spin = 0) { const o: V = [x, s * WY, R], rim = R * 0.68, f = s * (TW / 2);
  b.mat(RUBBER, 0.05).lathe('y', o, [[-TW / 2, rim], [-TW / 2, R - 55], [-TW / 2 + 40, R], [TW / 2 - 40, R], [TW / 2, R - 55], [TW / 2, rim]], 20, false);
  b.mat(DARK, 0.05).lathe('y', o, [[f * 0.55, 0], [f * 0.55, rim]], 20, false);                     // the dark well behind the spokes
  b.mat(CHROME, 0.9).lathe('y', o, [[f, rim + 6], [f * 0.7, rim - 34]], 20, false).lathe('y', o, [[f * 0.6, 58], [f * 1.25, 34], [f * 1.25, 0]], 10, false);
  b.mat('#b9bbc0', 0.6); for (let k = 0; k < 14; k++) { const a = spin + k / 14 * Math.PI * 2, c = Math.cos(a), q = Math.sin(a); b.bar([x + c * 50, s * WY + f * 0.95, R + q * 50], [x + c * (rim - 30), s * WY + f * 0.62, R + q * (rim - 30)], 13); } }

export function ssjMesh(spin = 0): Mesh { const b = new Build();
  // ---- the body: bonnet, scuttle, the tub cut down for the cockpit, the tail ----
  b.mat(PAINT, 0.45);
  const xs = [516, 560, 700, 880, 1059, 1400, 1783, 1930, 2140, 2210, 2296, 2300, 2985, 2990, 3232, 3522, 3775, 3921, 3982, 4052, 4105, 4140, 4228, 4290];
  b.loft(xs.map(x => { const cockpit = x >= 2300 && x <= 2985, zt = x < 2298 ? at(TOP, x) : cockpit ? 905 : at(BELT, x), zb = x < 600 ? 470 : x > 4140 ? 400 : x > 3900 ? 380 : 440;
    return section(x, at(HALF, x), zb, zt, x < 1900 ? 3.2 : x < 2300 ? 3.6 : cockpit ? 8 : 4, 6); }));
  // the cockpit's sides (the doors' tops) either side of the hollow
  for (const s of [1, -1]) b.loft([2302, 2544, 2807, 2988].map(x => { const w = at(HALF, x), zt = at(BELT, x); return [[x, s * (w - 62), 880], [x, s * (w - 2), 880], [x, s * (w - 2), zt - 14], [x, s * (w - 22), zt], [x, s * (w - 62), zt - 6]] as V[]; }));
  b.mat(DARK, 0.05).box(2304, 2986, -505, 505, 900, 912);                                             // the floor of the hollow
  b.mat(LEATHER, 0.25).box(2600, 2960, -480, 480, 912, 1010).loft([[2900, 1010], [2960, 1090], [3010, 1150]].map(([x, z]) => [[x, -490, 912], [x, 490, 912], [x, 490, z], [x, -490, z]] as V[]));   // the bench: cushion and back
  for (const y of [-240, 0, 240]) b.mat('#7c5128', 0.1).bar([2610, y, 1012], [2955, y, 1012], 8);     // its pleats
  // the folded hood under its cover behind the seats
  b.mat(TAN, 0.15).loft(([[2992, 540, 1050], [3070, 560, 1150], [3290, 568, 1200], [3420, 566, 1206], [3600, 550, 1170], [3730, 525, 1160], [3830, 495, 1090], [3868, 480, 1046]] as const).map(([x, w, zt]) => section(x, w, 1000, zt, 3, 6, 14)));
  // bonnet: the centre hinge, the side louvres, the door's shut lines
  b.mat(CHROME, 0.9).bar([640, 0, at(TOP, 640) + 3], [1925, 0, at(TOP, 1925) + 3], 14, 8);
  b.mat('#6d6c72', 0.1); for (const s of [1, -1]) for (let k = 0; k < 20; k++) { const x = 1090 + k * 34, y = s * (at(HALF, x) + 2); b.quad([x, y, 760], [x + 10, y, 760], [x + 10, y, 1010], [x, y, 1010]); }
  b.mat('#5b5a60', 0.1); for (const s of [1, -1]) { const y = (x: number) => s * (at(HALF, x) + 2); for (const x of [1932, 2400, 2905]) b.quad([x, y(x), 470], [x + 9, y(x), 470], [x + 9, y(x), x === 1932 ? 1230 : 1040], [x, y(x), x === 1932 ? 1230 : 1040]); b.quad([2400, y(2400), 470], [2905, y(2905), 470], [2905, y(2905), 479], [2400, y(2400), 479]); }
  b.mat(CHROME, 0.9); for (const s of [1, -1]) b.bar([2790, s * (at(HALF, 2790) + 8), 930], [2880, s * (at(HALF, 2880) + 8), 930], 14);   // door handles
  // ---- the nose: the grille's dark, its bright slats and centre bar, the filler cap ----
  b.mat(DARK, 0.05).box(505, 520, -232, 232, 520, 1135);
  b.mat(CHROME, 0.9); for (let k = -4; k <= 4; k++) b.box(497, 508, k * 50 - (k ? 7 : 13), k * 50 + (k ? 7 : 13), 520, 1140 + (k ? 0 : 20));
  b.box(497, 508, -240, 240, 1128, 1146).box(535, 585, -22, 22, 1240, 1292);
  // ---- the screen: two panes meeting in a V on a centre post, a bright frame ----
  for (const s of [1, -1]) { const bc: V = [2215, 0, 1275], bo: V = [2252, s * 558, 1262], to: V = [2388, s * 584, 1446], tc: V = [2352, 0, 1482];
    b.mat(GLASS, 0.5).quad(bc, bo, to, tc); b.mat(CHROME, 0.9).bar(bo, to, 26).bar(tc, to, 22).bar(bc, bo, 22); }
  b.mat(CHROME, 0.9).bar([2215, 0, 1275], [2352, 0, 1482], 26).box(2330, 2350, -55, 55, 1500, 1545);
  // ---- wings: one sweep from over the front wheel down to the sill, the rear wing over its wheel to the tail ----
  for (const s of [1, -1] as const) { b.mat(PAINT2, 0.45);
    wing(b, ([[48, 641, 440, 800], [112, 765, 430, 835], [258, 896, 425, 842], [526, 958, 420, 842], [790, 914, 400, 838], [1050, 790, 400, 820], [1316, 657, 430, 779], [1666, 518, 480, 740], [2105, 386, 545, 724], [2600, 370, 563, 724], [3122, 360, 565, 724]] as const).map(([x, z, yi, yo]) => [x, z, s * yi, s * yo] as [number, number, number, number]), [FX, R - 200]);
    wing(b, ([[3110, 300, 563, 724], [3149, 563, 563, 800], [3281, 815, 560, 842], [3508, 973, 545, 851], [3771, 987, 490, 845], [3996, 939, 450, 833], [4255, 693, 420, 740], [4412, 456, 440, 640], [4477, 324, 470, 580]] as const).map(([x, z, yi, yo]) => [x, z, s * yi, s * yo] as [number, number, number, number]), [RX, R - 200]);
    b.mat(CHROME, 0.9).box(2307, 3157, Math.min(s * 692, s * 728), Math.max(s * 692, s * 728), 322, 352);   // the bright sill strip
    // lamps: a bullet body, its lens; the tail lamp on the rear wing
    b.mat(CHROME, 0.9).lathe('x', [0, s * 425, 955], [[292, 132], [300, 142], [390, 138], [455, 104], [521, 26]], 14);
    b.mat(LENS, 0.6).lathe('x', [0, s * 425, 955], [[284, 0], [290, 126]], 14, false);
    b.mat(CHROME, 0.9).box(400, 426, s * 425 - 13, s * 425 + 13, 690, 830).lathe('x', [0, s * 310, 562], [[181, 46], [240, 30], [281, 14]], 10);
    b.mat(CHROME, 0.9).lathe('x', [0, s * 600, 770], [[4215, 30], [4250, 56], [4300, 56]], 10); b.mat(RED, 0.5).lathe('x', [0, s * 600, 770], [[4300, 50], [4318, 30], [4320, 0]], 10, false);
    b.mat(DARK, 0.05).bar([60, s * 345, 440], [330, s * 345, 470], 34);                               // bumper irons
    wheel(b, FX, s, spin); wheel(b, RX, s, spin); }
  // ---- across the nose and tail: the lamp bar, bumpers, axles, the dark under the car ----
  b.mat(CHROME, 0.9).box(322, 350, -425, 425, 797, 821).box(0, 42, -690, 690, 455, 502).box(0, 42, -690, 690, 378, 425).box(4440, 4482, -715, 715, 420, 466);
  for (const y of [-345, 345]) b.box(-6, 48, y - 22, y + 22, 368, 512);
  b.mat(DARK, 0.05).box(90, 600, -330, 330, 380, 500).box(600, 4150, -400, 400, 330, 445).bar([FX, -WY, R], [FX, WY, R], 60).bar([RX, -WY, R], [RX, WY, R], 80);
  // ---- the outside exhaust on the right: four bright pipes out of the bonnet side, down into the wing ----
  b.mat(CHROME, 0.9); for (let k = 0; k < 4; k++) { const x = 1150 + k * 170, w = -(at(HALF, x)); b.bar([x, w + 20, 830], [x + 45, w - 75, 770], 56).bar([x + 45, w - 75, 770], [x + 150, w - 95, 610], 56).bar([x + 150, w - 95, 610], [x + 215, w - 70, 500], 56); }
  // ---- the spare on the tail, its strap ----
  { const o: V = [4318, 0, 722], rim = R * 0.68; b.mat(RUBBER, 0.05).lathe('x', o, [[-90, rim], [-90, R - 55], [-50, R], [50, R], [90, R - 55], [90, rim]], 20, false);
    b.mat(DARK, 0.05).lathe('x', o, [[40, 0], [40, rim]], 20, false); b.mat(CHROME, 0.9).lathe('x', o, [[92, rim + 6], [60, rim - 34]], 20, false).lathe('x', o, [[50, 58], [110, 34], [110, 0]], 10, false);
    b.mat('#b9bbc0', 0.6); for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, c = Math.cos(a), q = Math.sin(a); b.bar([4318 + 86, c * 50, 722 + q * 50], [4318 + 55, c * (rim - 30), 722 + q * (rim - 30)], 13); }
    b.mat(LEATHER, 0.2); for (const a of [90, 210, 330]) { const t = a * Math.PI / 180; b.bar([4318 + 100, 0, 722], [4318 + 96, Math.cos(t) * (R + 4), 722 + Math.sin(t) * (R + 4)], 22, 30); } }
  return b.mesh(L); }
