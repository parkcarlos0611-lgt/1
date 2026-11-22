// The 1935 grand roadster as a low-polygon mesh (review 80, the first trial of true 3D modelling). Every number is
// read off the sheet's views as the part model holds them (data/cars/sheet/dueSSJ35.json: side outlines for heights,
// plan outlines for widths) at the car's real wheelbase (3175 mm); the front view's widths are not used (drawn wide).
import { Build, section, wing, type Mesh, type V } from './mesh';

const PAINT = '#a9a8ae', PAINT2 = '#55585f', CHROME = '#c9cbcf', TAN = '#b98a52', LEATHER = '#a06c38', GLASS = '#a9c2cc', RUBBER = '#26242b', DARK = '#1c1b20', LENS = '#efe9cf', RED = '#c22c2b';
const FX = 526, RX = 3701, R = 421, WY = 716, TW = 190, L = 4517, SW = 1.06;   // SW: the plan read 1700 wide, the car is 1800 (specs: track 1422)
/** linear reading of a table of [x, value] */
const at = (tab: [number, number][], x: number) => { if (x <= tab[0]![0]) return tab[0]![1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i]![0]) { const [x0, v0] = tab[i - 1]!, [x1, v1] = tab[i]!; return v0 + (v1 - v0) * (x - x0) / (x1 - x0); } return tab[tab.length - 1]![1]; };
// the body's half-width (plan view) and its top (side view) along the car
const HALF: [number, number][] = ([[516, 300], [700, 350], [1059, 398], [1783, 489], [2191, 543], [2327, 561], [2915, 570], [3232, 570], [3522, 543], [3775, 498], [4001, 444], [4137, 389], [4228, 308], [4290, 150]] as [number, number][]).map(([x, w]) => [x, w * SW]);
const TOP: [number, number][] = [[516, 1175], [560, 1228], [700, 1245], [1150, 1245], [1832, 1263], [2140, 1265], [2210, 1240], [2296, 1150]];
const BELT: [number, number][] = [[2298, 1079], [2544, 1070], [2807, 1052], [3043, 1017], [3508, 1009], [3859, 1035], [3921, 1017], [3982, 965], [4052, 860], [4105, 719], [4140, 561], [4290, 480]];

function wheel(b: Build, x: number, s: 1 | -1, spin = 0) { const o: V = [x, s * WY, R], rim = R * 0.68, f = s * (TW / 2);
  b.name((x === FX ? 'tyreF' : 'tyreR')).mat(RUBBER, 0.05, 'tyre').lathe('y', o, [[-TW / 2, rim], [-TW / 2, R - 55], [-TW / 2 + 40, R], [TW / 2 - 40, R], [TW / 2, R - 55], [TW / 2, rim]], 20, false);
  b.name('wheel').mat(DARK, 0.05).lathe('y', o, [[f * 0.55, 0], [f * 0.55, rim]], 20, false);                     // the dark well behind the spokes
  b.name('rim').mat(CHROME, 0.9, 'metal').lathe('y', o, [[f, rim + 6], [f * 0.7, rim - 34]], 20, false).lathe('y', o, [[f * 0.6, 58], [f * 1.25, 34], [f * 1.25, 0]], 10, false);
  b.name('spoke').mat('#b9bbc0', 0.6, 'metal'); for (let k = 0; k < 14; k++) { const a = spin + k / 14 * Math.PI * 2, c = Math.cos(a), q = Math.sin(a); b.bar([x + c * 50, s * WY + f * 0.95, R + q * 50], [x + c * (rim - 30), s * WY + f * 0.62, R + q * (rim - 30)], 13); } }

const FLOOR = 610;   // the cockpit's floor: down by the frame, so the seat sits deep behind the doors
export function ssjMesh(spin = 0): Mesh { const b = new Build();
  // ---- the body: bonnet, scuttle, the tub cut down for the cockpit, the tail ----
  b.name('body').mat(PAINT, 0.45, 'paint');
  const xs = [516, 560, 700, 880, 1059, 1400, 1783, 1930, 2140, 2210, 2296, 2300, 2985, 2990, 3232, 3522, 3775, 3921, 3982, 4052, 4105, 4140, 4228, 4290];
  b.loft(xs.map(x => { const cockpit = x >= 2300 && x <= 2985, zt = x < 2298 ? at(TOP, x) : cockpit ? FLOOR : at(BELT, x), zb = x < 600 ? 470 : x > 4140 ? 400 : x > 3900 ? 380 : 440;
    return section(x, at(HALF, x), zb, zt, x < 1900 ? 3.2 : x < 2300 ? 3.6 : cockpit ? 8 : 4, 6); }));
  // the cockpit's sides (the doors' tops) either side of the hollow
  for (const s of [1, -1]) b.loft([2302, 2544, 2807, 2988].map(x => { const w = at(HALF, x), zt = at(BELT, x); return [[x, s * (w - 58), FLOOR], [x, s * (w - 2), FLOOR], [x, s * (w - 2), zt - 14], [x, s * (w - 22), zt], [x, s * (w - 58), zt - 6]] as V[]; }));
  b.name('cockpit').mat(DARK, 0.05).box(2304, 2986, -560, 560, FLOOR - 10, FLOOR + 4);
  b.name('cockpit').mat('#3a3436', 0.1).box(2300, 2318, -560, 560, FLOOR, 1150);   // the dash: the scuttle's back face
  b.name('cockpit').mat('#d8d2bf', 0.4); for (const y of [-330, -170, 170, 330]) b.lathe('x', [0, y, 1050], [[2318, 0], [2322, 42]], 10, false);   // its dials                                             // the floor of the hollow
  b.name('seat').mat(LEATHER, 0.25, 'leather').box(2560, 2930, -540, 540, FLOOR, 760).loft([[2880, 760], [2925, 880], [2965, 990], [2985, 1020]].map(([x, z]) => [[x, -545, FLOOR], [x, 545, FLOOR], [x, 545, z], [x, -545, z]] as V[]));   // the bench: cushion and back
  for (const y of [-360, -180, 0, 180, 360]) b.name('seat').mat('#7c5128', 0.1).bar([2570, y, 762], [2880, y, 762], 8).bar([2930, y, 885], [2970, y, 990], 8);     // its pleats
  // the folded hood under its cover behind the seats
  b.name('tonneau').mat(TAN, 0.15, 'canvas').loft(([[2995, 505, 1030], [3030, 530, 1100], [3140, 540, 1150], [3300, 535, 1160], [3440, 515, 1130], [3530, 490, 1075], [3560, 470, 1030]] as const).map(([x, w, zt]) => section(x, w * SW, 990, zt, 2.4, 6, 16)));
  b.name('tonneau').mat('#8d6537', 0.1).bar([3060, 0, 1140], [3480, 0, 1120], 10);   // its centre seam
  // bonnet: the centre hinge, the side louvres, the door's shut lines
  b.name('hood').mat(CHROME, 0.9, 'metal').bar([640, 0, at(TOP, 640) + 3], [1925, 0, at(TOP, 1925) + 3], 14, 8);
  b.name('hood').mat('#6d6c72', 0.1); for (const s of [1, -1]) for (let k = 0; k < 20; k++) { const x = 1090 + k * 34, y = s * (at(HALF, x) + 2); b.quad([x, y, 760], [x + 10, y, 760], [x + 10, y, 1010], [x, y, 1010]); }
  b.name('body').mat('#5b5a60', 0.1); for (const s of [1, -1]) { const y = (x: number) => s * (at(HALF, x) + 2); for (const x of [1932, 2400, 2905]) b.quad([x, y(x), 470], [x + 9, y(x), 470], [x + 9, y(x), x === 1932 ? 1230 : 1040], [x, y(x), x === 1932 ? 1230 : 1040]); b.quad([2400, y(2400), 470], [2905, y(2905), 470], [2905, y(2905), 479], [2400, y(2400), 479]); }
  b.name('body').mat(CHROME, 0.9, 'metal'); for (const s of [1, -1]) b.bar([2790, s * (at(HALF, 2790) + 8), 930], [2880, s * (at(HALF, 2880) + 8), 930], 14);   // door handles
  // ---- the nose: the grille's dark, its bright slats and centre bar, the filler cap ----
  b.name('core').mat(DARK, 0.05).box(505, 520, -232, 232, 520, 1135);
  b.name('coreBar').mat(CHROME, 0.9, 'metal'); for (let k = -4; k <= 4; k++) b.box(497, 508, k * 50 - (k ? 7 : 13), k * 50 + (k ? 7 : 13), 520, 1140 + (k ? 0 : 20));
  b.box(497, 508, -240, 240, 1128, 1146).box(535, 585, -22, 22, 1240, 1292);
  b.loft([section(560, 262, 498, 1172), section(494, 262, 498, 1172), section(494, 236, 518, 1150), section(530, 236, 518, 1150)], false);   // the shell: a bright ring round the grille
  b.name('shell').mat(RED, 0.6).box(488, 494, -40, 40, 1152, 1170);   // the badge
  // ---- the screen: two panes meeting in a V on a centre post, a bright frame ----
  // the panes' foot follows the scuttle's crown, so the glass and its frame stand on the body all the way across
  const skin = (x: number, y: number) => { const w = at(HALF, x), zt = at(TOP, x), h = (zt - 440) / 2; return 440 + h + h * Math.max(0, 1 - Math.abs(y / w) ** 3.6) ** (1 / 3.6) - 8; };
  for (const s of [1, -1]) { const foot: V[] = [0, 0.25, 0.5, 0.75, 1].map(f => { const x = 2205 + 40 * f, y = s * 520 * f; return [x, y, skin(x, y)]; }), to: V = [2388, s * 535, 1446], tc: V = [2352, 0, 1482];
    const top = (f: number): V => [tc[0] + (to[0] - tc[0]) * f, tc[1] + (to[1] - tc[1]) * f, tc[2] + (to[2] - tc[2]) * f];
    b.name('screenPane').mat(GLASS, 0.5, 'glass'); for (let i = 0; i < 4; i++) b.quad(foot[i]!, foot[i + 1]!, top((i + 1) / 4), top(i / 4));
    b.name('screenFrame').mat(CHROME, 0.9, 'metal').bar(foot[4]!, to, 26).bar(tc, to, 22); for (let i = 0; i < 4; i++) b.bar(foot[i]!, foot[i + 1]!, 22); }
  b.name('screenPost').mat(CHROME, 0.9, 'metal').bar([2205, 0, skin(2205, 0)], [2352, 0, 1482], 26);
  // ---- wings: one sweep from over the front wheel down to the sill, the rear wing over its wheel to the tail ----
  for (const s of [1, -1] as const) { b.name('fenderF').mat(PAINT2, 0.45, 'paint');
    wing(b, ([[48, 641, 560, 820], [112, 765, 540, 860], [258, 896, 535, 878], [526, 958, 535, 880], [790, 914, 520, 875], [1050, 790, 500, 855], [1316, 657, 500, 810], [1666, 518, 530, 765], [2105, 386, 575, 745], [2600, 370, 595, 745], [3122, 360, 597, 745]] as const).map(([x, z, yi, yo]) => [x, z, s * yi, s * yo] as [number, number, number, number]), [FX, R - 200]);
    b.name('fenderR').mat(PAINT2, 0.45, 'paint');
    wing(b, ([[3110, 300, 597, 745], [3149, 563, 597, 820], [3281, 815, 593, 870], [3508, 973, 575, 880], [3771, 987, 520, 875], [3996, 939, 475, 860], [4255, 693, 440, 765], [4412, 456, 460, 660], [4477, 324, 490, 600]] as const).map(([x, z, yi, yo]) => [x, z, s * yi, s * yo] as [number, number, number, number]), [RX, R - 200]);
    b.name('board').mat(CHROME, 0.9, 'metal').box(2307, 3157, Math.min(s * 712, s * 748), Math.max(s * 712, s * 748), 322, 352);   // the bright sill strip
    // lamps: a bullet body, its lens; the tail lamp on the rear wing
    b.name('lamp').mat(CHROME, 0.9, 'metal').lathe('x', [0, s * 395, 955], [[296, 118], [304, 127], [390, 123], [450, 92], [510, 22]], 14);
    b.name('lens').mat(LENS, 0.6, 'lens').lathe('x', [0, s * 395, 955], [[288, 0], [294, 112]], 14, false);
    b.name('lampStand').mat(CHROME, 0.9, 'metal').box(400, 426, s * 395 - 13, s * 395 + 13, 690, 830).lathe('x', [0, s * 310, 562], [[181, 46], [240, 30], [281, 14]], 10);
    b.name('tailRim').mat(CHROME, 0.9, 'metal').lathe('x', [0, s * 640, 770], [[4215, 30], [4250, 56], [4300, 56]], 10); b.name('tail').mat(RED, 0.5).lathe('x', [0, s * 640, 770], [[4300, 50], [4318, 30], [4320, 0]], 10, false);
    b.name('bumperFiron').mat(DARK, 0.05).bar([60, s * 345, 440], [330, s * 345, 470], 34);                               // bumper irons
    wheel(b, FX, s, spin); wheel(b, RX, s, spin); }
  // ---- across the nose and tail: the lamp bar, bumpers, axles, the dark under the car ----
  b.name('bumperF').mat(CHROME, 0.9, 'metal').box(322, 350, -400, 400, 797, 821).box(0, 42, -720, 720, 455, 502).box(0, 42, -720, 720, 378, 425).box(4440, 4482, -735, 735, 420, 466);
  for (const y of [-345, 345]) b.box(-6, 48, y - 22, y + 22, 368, 512);
  b.name('chassis').mat(DARK, 0.05).box(90, 600, -330, 330, 380, 500).box(600, 4150, -400, 400, 330, 445).bar([FX, -WY, R], [FX, WY, R], 60).bar([RX, -WY, R], [RX, WY, R], 80);
  // ---- the outside exhaust on the right: four bright pipes out of the bonnet side, down into the wing ----
  b.name('exhaust').mat(CHROME, 0.9, 'metal'); for (let k = 0; k < 4; k++) { const x = 1150 + k * 170, w = -(at(HALF, x)); b.bar([x, w + 20, 830], [x + 45, w - 75, 770], 56).bar([x + 45, w - 75, 770], [x + 150, w - 95, 610], 56).bar([x + 150, w - 95, 610], [x + 215, w - 70, 500], 56); }
  // ---- the spare on the tail, its strap ----
  { const o: V = [4318, 0, 722], rim = R * 0.68; b.name('spare').mat(RUBBER, 0.05, 'tyre').lathe('x', o, [[-90, rim], [-90, R - 55], [-50, R], [50, R], [90, R - 55], [90, rim]], 20, false);
    b.name('spare').mat(DARK, 0.05).lathe('x', o, [[40, 0], [40, rim]], 20, false); b.mat(CHROME, 0.9, 'metal').lathe('x', o, [[92, rim + 6], [60, rim - 34]], 20, false).lathe('x', o, [[50, 58], [110, 34], [110, 0]], 10, false);
    b.name('spare').mat('#b9bbc0', 0.6, 'metal'); for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, c = Math.cos(a), q = Math.sin(a); b.bar([4318 + 86, c * 50, 722 + q * 50], [4318 + 55, c * (rim - 30), 722 + q * (rim - 30)], 13); }
    b.name('spareStrap').mat(LEATHER, 0.2, 'leather'); for (const a of [90, 210, 330]) { const t = a * Math.PI / 180; b.bar([4318 + 100, 0, 722], [4318 + 96, Math.cos(t) * (R + 4), 722 + Math.sin(t) * (R + 4)], 22, 30); } }
  return b.mesh(L); }
export const mesh = ssjMesh;
