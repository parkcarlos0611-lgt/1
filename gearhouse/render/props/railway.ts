// The railway beside the Millbrook motor course (docs/systems/71_track_props.md): an express locomotive and its tender,
// a corridor coach, the station building, a length of platform, the signal box, a telegraph pole and the parapet of
// the bridge over the river. Low-poly meshes in the cars' manner (render/car/mesh.ts), as render/props/stands.ts.
// Each prop's own axes: x along its length from 0 to its `length` (the rails run along x; a vehicle's front is x = 0),
// y across (- the side it faces: a building's front, a platform's edge), z up from the ground (for the train: from the
// rail tops); its anchor is the middle of its length at y = 0, z = 0. Wheels are `metal`, not `tyre`: nothing here is
// steered or spun by the cars' wheel finder.
import { Build, type Mesh, type V } from '../car/mesh';

const LOCO = '#27452c', COACH = '#2f5234', BLACK = '#1d1d20', DARK = '#26242a', STEEL = '#6f7378', BUFFER = '#a3302a', BRASS = '#b08d3c', WHITE = '#efeee8', CREAM = '#ddd3bb', GREEN = '#3f5a3c', DARKG = '#2c3f2a';
const BRICK = '#9a5b45', BRICK2 = '#7c4a3a', SLATE = '#555a61', ROOF = '#5a5f63', WOOD = '#8a6a48', CONCRETE = '#a7a29a', CONC2 = '#8f8a82', GLASS = '#9fb6c0', PANE = '#3b4850', IRON = '#4a4d52', ROOFGREY = '#74766f';
const GAUGE = 750;   // a rail's centre from the centre line

/** a profile turned about an upright axis at (x, y): [z, radius] pairs (chimneys, domes) */
function turnZ(b: Build, x: number, y: number, prof: [number, number][], seg = 10): Build {
  return b.loft(prof.map(([z, r]) => Array.from({ length: seg }, (_, i) => { const t = i / seg * Math.PI * 2; return [x + Math.cos(t) * r, y + Math.sin(t) * r, z] as V; }))); }
/** a plain disc wheel standing on the rail at x on side s (-1 | 1) */
function wheel(b: Build, x: number, s: number, r: number, seg = 10): Build { return b.lathe('y', [x, s * (GAUGE - 70), r], [[0, r], [s * 140, r]], seg); }
/** a spoked driving wheel: a steel tyre, a dark web behind, painted spokes and boss on the outer face */
function driver(b: Build, x: number, s: number, r: number, turn: number): void { const yi = s * (GAUGE - 70), d = s * 150;
  b.mat(STEEL, 0.5, 'metal').lathe('y', [x, yi, r], [[d, r * 0.86], [d, r], [0, r]], 12, false);
  b.mat(BLACK, 0.1).lathe('y', [x, yi, r], [[d * 0.8, 0], [d * 0.8, r * 0.86]], 12, false);
  b.mat(LOCO, 0.35, 'paint'); for (let k = 0; k < 10; k++) { const a = turn + k / 10 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), w = 45, y = yi + d;
    b.quad([x + c * r * 0.15 - sn * w, y, r + sn * r * 0.15 + c * w], [x + c * r * 0.86 - sn * w, y, r + sn * r * 0.86 + c * w], [x + c * r * 0.86 + sn * w, y, r + sn * r * 0.86 - c * w], [x + c * r * 0.15 + sn * w, y, r + sn * r * 0.15 - c * w]); }
  b.lathe('y', [x, yi, r], [[d * 1.05, 0], [d * 1.05, r * 0.22]], 8, false); }
/** a buffer at the end x of a vehicle, pointing along dir (-1 toward x = 0) */
function buffers(b: Build, x: number, dir: number, z: number, len = 380): void { b.mat(STEEL, 0.4, 'metal'); for (const y of [-870, 870]) b.lathe('x', [x, y, z], [[0, 90], [dir * (len - 60), 90], [dir * (len - 60), 220], [dir * len, 220]], 8); }
/** a splasher: the part of a disc of radius R about (x, zc) above z = zf, from y0 to y1 */
function splasher(b: Build, x: number, y0: number, y1: number, R: number, zc: number, zf: number): Build { const a0 = Math.asin((zf - zc) / R);
  const ring = (y: number) => Array.from({ length: 7 }, (_, i) => { const a = a0 + (Math.PI - 2 * a0) * i / 6; return [x + Math.cos(a) * R, y, zc + Math.sin(a) * R] as V; }); return b.loft([ring(y0), ring(y1)]); }
/** a roof of one curve across the vehicle, from x0 to x1: half-width w, eaves at z, rise h */
function arcRoof(b: Build, x0: number, x1: number, w: number, z: number, h: number): Build {
  return b.loft([x0, x1].map(x => [[x, -w, z], [x, -w * 0.8, z + h * 0.62], [x, -w * 0.4, z + h], [x, w * 0.4, z + h], [x, w * 0.8, z + h * 0.62], [x, w, z]] as V[])); }

/** the express locomotive, a 4-6-0 of the 1930s, 12 m over the front buffers and the drag beam: dark green, the
 *  smokebox, frames and cab roof black, smoke deflectors beside the smokebox; its tender is `tender()` */
export function locomotive(): Mesh { const b = new Build(), L = 12000, RP = 1520, BZ = 2650, DR = 1000, drivers = [5300, 7400, 9500], bogie = [1500, 3300];
  b.mat(BLACK, 0.2, 'metal').box(500, L - 100, -640, 640, 850, 1450).box(1000, 3800, -620, 620, 380, 850);         // the frames, the bogie's frame
  b.box(450, L - 50, -1330, 1330, 1450, RP);                                                                        // the running plate
  b.mat(BUFFER, 0.3, 'paint').box(380, 500, -1250, 1250, 1000, 1480); buffers(380, -1, 1250);
  function buffers(x: number, dir: number, z: number) { b.mat(STEEL, 0.4, 'metal'); for (const y of [-870, 870]) b.lathe('x', [x, y, z], [[0, 90], [dir * 320, 90], [dir * 320, 220], [dir * 380, 220]], 8); }
  b.mat(BLACK, 0.2, 'metal').box(L - 200, L, -1250, 1250, 1000, 1450);                                              // the drag beam
  b.mat(STEEL, 0.4, 'metal'); for (const x of bogie) for (const s of [-1, 1]) wheel(b, x, s, 480);
  drivers.forEach((x, i) => { for (const s of [-1, 1]) driver(b, x, s, DR, i * 0 + (s > 0 ? 0.9 : 0.3)); });
  b.mat(BLACK, 0.3, 'metal').lathe('x', [1000, 0, BZ], [[0, 380], [80, 740], [200, 880], [1700, 880]], 16);          // the smokebox and its door
  b.box(1500, 2600, -620, 620, RP, 2050);                                                                           // its saddle
  turnZ(b, 1800, 0, [[3450, 250], [3880, 230], [3930, 290], [3990, 290]], 10);                                      // the chimney
  b.mat(WHITE, 0.3, 'plain'); for (const y of [-520, 520]) b.lathe('x', [760, y, 1750], [[0, 190], [30, 190]], 8);   // two route discs
  b.mat(LOCO, 0.4, 'paint').lathe('x', [2700, 0, BZ], [[0, 860], [5000, 880]], 16, false);                          // the boiler
  b.mat('#1f3824', 0.4, 'paint'); for (const x of [2700, 4400, 6100]) b.lathe('x', [x, 0, BZ], [[0, 885], [90, 885]], 16, false);   // its bands
  b.mat(LOCO, 0.4, 'paint').loft([7700, 9550].map(x => [[x, -900, RP], [x, 900, RP], [x, 900, 3300], [x, 700, 3560], [x, -700, 3560], [x, -900, 3300]] as V[]));   // the square-topped firebox
  turnZ(b, 5300, 0, [[3450, 340], [3740, 340], [3850, 220], [3890, 0]], 10);                                        // the dome
  b.mat(BRASS, 0.8, 'metal'); turnZ(b, 8400, 0, [[3560, 130], [3780, 110]], 6);                                     // the safety valves
  b.mat(LOCO, 0.4, 'paint'); for (const s of [-1, 1]) b.box(950, 2750, s * 1290, s * 1330, RP, 3250);                // the smoke deflectors
  for (const x of drivers) for (const s of [-1, 1]) splasher(b, x, s * 660, s * 930, DR + 90, DR, RP);
  b.mat(BRASS, 0.8, 'metal'); for (const s of [-1, 1]) b.box(drivers[1]! - 500, drivers[1]! + 500, s * 930, s * 945, 1850, 2000);   // the name plates (plain)
  b.mat(BLACK, 0.3, 'metal'); for (const s of [-1, 1]) b.lathe('x', [1900, s * 1130, 1050], [[0, 310], [1300, 310]], 10);   // the cylinders
  b.mat(STEEL, 0.6, 'metal'); for (const s of [-1, 1]) { const y = s * 990, pin = (x: number): V => [x - 330, y, DR - 330];
    b.bar(pin(drivers[0]!), pin(drivers[2]!), 130, 50);                                                             // the coupling rod
    b.bar([3200, s * 1130, 1050], [4300, s * 1130, 1050], 90).bar([4250, s * 1090, 1050], [drivers[1]! - 330, s * 1060, DR - 330], 140, 50); }   // the piston rod, the connecting rod
  b.mat(LOCO, 0.4, 'paint'); for (const s of [-1, 1]) b.box(9550, 11400, s * 1290, s * 1335, RP, 3450); b.box(9550, 9610, -1335, 1335, RP, 3450);   // the cab's sides and front
  b.mat(DARK, 0.1); for (const s of [-1, 1]) b.quad([10150, s * 1342, 2550], [11050, s * 1342, 2550], [11050, s * 1342, 3250], [10150, s * 1342, 3250]);   // its side windows
  b.box(9610, 9950, -800, 800, RP, 3200);                                                                           // the backhead in the cab's shadow
  arcRoof(b.mat(BLACK, 0.2, 'metal'), 9450, 11750, 1390, 3450, 430);
  return b.mesh(L); }

/** the locomotive's tender, 7.6 m: a six-wheeled green tank with coal heaped between its raised sides; x = 0 couples to the locomotive */
export function tender(): Mesh { const b = new Build(), L = 7600;
  b.mat(BLACK, 0.2, 'metal').box(250, L - 400, -1000, 1000, 620, 1250).box(0, 250, -300, 300, 1000, 1200);          // the frames, the drawbar
  for (const x of [1400, 3700, 6000]) for (const s of [-1, 1]) b.box(x - 260, x + 260, s * 1000, s * 1090, 380, 800);   // axle boxes and springs
  b.mat(STEEL, 0.4, 'metal'); for (const x of [1400, 3700, 6000]) for (const s of [-1, 1]) wheel(b, x, s, 610, 12);
  b.mat(LOCO, 0.4, 'paint').box(250, L - 400, -1330, 1330, 1250, 2900);                                             // the tank
  for (const s of [-1, 1]) b.box(250, 5400, s * 1210, s * 1330, 2900, 3300); b.box(5300, 5420, -1330, 1330, 2900, 3300).box(250, 330, -1210, 1210, 2900, 3150);   // the coal space's sides, back and front
  b.mat('#1f3824', 0.4, 'paint').box(240, L - 390, -1340, 1340, 1250, 1400);                                        // the footing band
  const heap: [number, number][] = [[400, 3000], [1300, 3420], [2500, 3520], [3800, 3380], [5250, 3020]];
  b.mat('#17161a', 0.15).loft(heap.map(([x, h], i) => [[x, -1200, 2950], [x, -650, h - (i % 2) * 90], [x, 80, h + 130], [x, 700, h - 60 + (i % 2) * 110], [x, 1200, 2950]] as V[]));   // the coal
  b.mat(BLACK, 0.3, 'metal').box(6100, 6700, -350, 350, 2900, 3080); turnZ(b, 6400, 0, [[3080, 260], [3180, 260]], 8);   // the water filler
  b.mat(BUFFER, 0.3, 'paint').box(L - 500, L - 380, -1250, 1250, 1000, 1480); buffers(b, L - 380, 1, 1250);
  return b.mesh(L); }

/** a corridor coach, 15 m over buffers, green: seven compartments with a door each on the -y side, the corridor's
 *  large windows on the +y side, a vestibule and gangway at each end, on two four-wheeled bogies */
export function carriage(): Mesh { const b = new Build(), L = 15000, X0 = 300, X1 = L - 300, FL = 1250, W0 = 2250, W1 = 3050, TOP = 3300, HW = 1350, C0 = 1200, CP = 1800, N = 7;
  b.mat(BLACK, 0.2, 'metal').box(X0, X1, -1300, 1300, 1050, FL);                                                    // the underframe
  for (const s of [-1, 1]) b.bar([4300, s * 1100, 1050], [5800, s * 1100, 560], 70).bar([5800, s * 1100, 560], [9200, s * 1100, 560], 70).bar([9200, s * 1100, 560], [10700, s * 1100, 1050], 70);   // the truss rods
  b.box(6400, 7700, -1250, -750, 480, 1000).box(8300, 9000, 700, 1250, 560, 1000);                                  // battery boxes
  for (const c of [2500, L - 2500]) { b.mat(BLACK, 0.2, 'metal').box(c - 400, c + 400, -1000, 1000, 600, 1050);     // each bogie: bolster, side frames, wheels
    for (const s of [-1, 1]) b.box(c - 1750, c + 1750, s * 840, s * 930, 400, 660);
    b.mat(STEEL, 0.4, 'metal'); for (const x of [c - 1200, c + 1200]) for (const s of [-1, 1]) wheel(b, x, s, 480); }
  b.mat(COACH, 0.4, 'paint').box(X0, X1, -HW, HW, FL, W0).box(X0, X1, -HW, HW, W1, TOP).box(X0, X0 + 60, -HW, HW, W0, W1).box(X1 - 60, X1, -HW, HW, W0, W1);   // the body below and above the windows, the ends
  b.mat(GLASS, 0.5, 'glass').box(X0 + 60, X1 - 60, -HW + 30, HW - 30, W0, W1);
  b.mat('#3c302c', 0.1).box(X0 + 200, X1 - 200, -HW + 180, HW - 180, W0 - 50, W1 - 60);                             // the compartments seen through
  const pillar = (s: number, x0: number, x1: number) => b.box(x0, x1, s * (HW - 45), s * (HW + 4), W0, W1);
  b.mat(COACH, 0.4, 'paint'); for (const s of [-1, 1]) { pillar(s, X0, X0 + 300); pillar(s, X0 + 700, C0 + 110); pillar(s, C0 + N * CP - 110, X1 - 700); pillar(s, X1 - 300, X1); }   // the vestibules' small windows
  for (let k = 0; k < N; k++) { const x = C0 + k * CP; if (k) { pillar(-1, x - 110, x + 110); pillar(1, x - 220, x + 220); } pillar(-1, x + 500, x + 610); pillar(-1, x + 1190, x + 1300); }   // -y: quarter light, door, quarter light; +y: one large window
  b.mat('#2a4a2f', 0.4, 'paint'); for (let k = 0; k < N; k++) { const x = C0 + k * CP + 610; b.box(x, x + 580, -HW - 12, -HW, FL + 40, W0 - 20); }   // the compartment doors
  for (const x of [X0 + 300, X1 - 700]) for (const s of [-1, 1]) b.box(x, x + 400, s * (HW + 12), s * HW, FL + 40, W0 - 20);   // the vestibule doors
  b.mat(BRASS, 0.8, 'metal'); for (let k = 0; k < N; k++) { const x = C0 + k * CP + 1100; b.box(x, x + 60, -HW - 30, -HW - 12, 2000, 2130); }   // door handles
  arcRoof(b.mat(ROOFGREY, 0.2, 'paint'), X0 - 40, X1 + 40, HW + 40, TOP, 480);
  b.mat('#55574f', 0.2, 'metal'); for (let k = 0; k < N; k++) { const x = C0 + k * CP + 900; b.box(x - 150, x + 150, -110, 110, TOP + 470, TOP + 580); }   // roof ventilators
  b.mat(DARK, 0.1, 'canvas').box(60, X0, -480, 480, FL + 50, 3250).box(X1, L - 60, -480, 480, FL + 50, 3250);       // the gangways
  buffers(b, X0, -1, 1150, 300); buffers(b, X1, 1, 1150, 300);
  return b.mesh(L); }

/** the station building, 14 m: brick under a slate roof with two chimneys, doors and windows to the platform (-y),
 *  and a canopy on iron columns over the platform, a cut valance along its edge. Its front wall is at y = 0 */
export function stationBuilding(): Mesh { const b = new Build(), L = 14000, D = 5200, H = 3600, R = 5700, CY = -3200, CZ = 3150;
  b.mat(BRICK, 0.2, 'paint').box(0, L, 0, D, 0, H).loft([0, L].map(x => [[x, 0, H], [x, D, H], [x, D / 2, R]] as V[]));   // the walls and gables
  b.mat(BRICK2, 0.2, 'paint').box(-40, L + 40, -40, D + 40, 0, 450);                                                // the plinth
  b.mat(SLATE, 0.3, 'plain'); for (const s of [0, 1]) { const y = (v: number) => s ? D - v : v;
    b.loft([-300, L + 300].map(x => [[x, y(-380), H - 250], [x, y(D / 2), R + 60], [x, y(D / 2), R + 180], [x, y(-380), H - 130]] as V[])); }   // the roof's two slopes
  b.mat(BRICK2, 0.2, 'paint'); for (const x of [3200, 10200]) b.box(x, x + 800, D / 2 - 380, D / 2 + 380, R - 500, R + 1100);   // chimney stacks
  b.mat(CREAM, 0.3, 'paint'); for (const x of [3200, 10200]) b.box(x - 60, x + 860, D / 2 - 440, D / 2 + 440, R + 1100, R + 1220);
  b.mat('#b06a48', 0.2, 'paint'); for (const x of [3200, 10200]) for (const dx of [200, 600]) b.box(x + dx - 110, x + dx + 110, D / 2 - 110, D / 2 + 110, R + 1220, R + 1560);   // the pots
  const doors: [number, number][] = [[1900, 2800], [6300, 7700], [11400, 12300]], wins: [number, number][] = [[3700, 4900], [8900, 10100]], back: [number, number][] = [[1500, 2700], [4700, 5900], [8100, 9300], [11300, 12500]];
  b.mat(CREAM, 0.3, 'paint'); for (const [x0, x1] of doors) b.box(x0 - 150, x1 + 150, -50, 0, 2350, 2600); for (const [x0, x1] of wins) b.box(x0 - 150, x1 + 150, -50, 0, 2350, 2600).box(x0 - 100, x1 + 100, -90, 0, 1020, 1120);   // lintels and sills
  for (const [x0, x1] of back) b.box(x0 - 150, x1 + 150, D, D + 50, 2350, 2600).box(x0 - 100, x1 + 100, D, D + 90, 1020, 1120);
  for (const x of [0, L]) b.box(x - 50, x + 50, D / 2 - 750, D / 2 + 750, 2350, 2600).box(x - 90, x + 90, D / 2 - 700, D / 2 + 700, 1020, 1120);
  b.mat(DARKG, 0.35, 'paint'); for (const [x0, x1] of doors) b.box(x0, x1, -30, 0, 0, 2350);                        // the doors
  b.mat(PANE, 0.5, 'paint'); for (const [x0, x1] of wins) b.box(x0, x1, -30, 0, 1120, 2350); for (const [x0, x1] of back) b.box(x0, x1, D, D + 30, 1120, 2350); for (const x of [0, L]) b.box(x - 30, x + 30, D / 2 - 600, D / 2 + 600, 1120, 2350);   // the windows' dark glass
  b.box(doors[1]![0] + 150, doors[1]![1] - 150, -45, -30, 1200, 2100);                                              // the booking hall door's lights
  b.mat(CREAM, 0.3, 'paint'); for (const [x0, x1] of wins) b.box((x0 + x1) / 2 - 35, (x0 + x1) / 2 + 35, -45, -30, 1120, 2350).box(x0, x1, -45, -30, 1700, 1760);   // glazing bars
  for (const [x0, x1] of back) b.box((x0 + x1) / 2 - 35, (x0 + x1) / 2 + 35, D + 30, D + 45, 1120, 2350).box(x0, x1, D + 30, D + 45, 1700, 1760);
  b.mat(DARKG, 0.3, 'paint').box(450, 1500, -45, 0, 950, 2250).box(12700, 13600, -45, 0, 950, 2250);                // poster boards: plain panels
  b.mat('#c9b56a', 0.3, 'paint').box(520, 1430, -60, -45, 1020, 2180); b.mat('#7f2f2a', 0.3, 'paint').box(12770, 13530, -60, -45, 1020, 2180); b.mat(CREAM, 0.3, 'paint').box(620, 1330, -70, -60, 1700, 1900).box(12870, 13430, -70, -60, 1250, 1450);
  b.mat(ROOF, 0.4, 'metal').loft([-300, L + 300].map(x => [[x, 0, 3520], [x, CY, CZ], [x, CY, CZ + 80], [x, 0, 3600]] as V[]));   // the canopy
  b.mat(GREEN, 0.35, 'paint'); for (let x = 1400; x < L; x += 3733) { b.box(x - 80, x + 80, CY + 380, CY + 540, 0, CZ + 40);   // its columns and their brackets
    b.bar([x, CY + 460, 2500], [x - 700, CY + 460, CZ + 20], 70).bar([x, CY + 460, 2500], [x + 700, CY + 460, CZ + 20], 70).bar([x, CY + 460, 2600], [x, CY + 1300, CZ + 120], 70); }
  b.box(-300, L + 300, CY + 420, CY + 500, CZ - 60, CZ + 40);                                                       // the beam along them
  b.mat(CREAM, 0.3, 'wood').box(-300, L + 300, CY - 50, CY, CZ - 230, CZ + 90).box(-300, -250, CY, 0, CZ - 150, CZ + 60).box(L + 250, L + 300, CY, 0, CZ - 150, CZ + 60);   // the valance
  for (let x = -300; x < L + 300; x += 400) b.tri([x, CY - 25, CZ - 230], [x + 400, CY - 25, CZ - 230], [x + 200, CY - 25, CZ - 420]);   // its cut edge
  b.mat(DARKG, 0.35, 'paint').box(L / 2 - 1700, L / 2 + 1700, CY - 110, CY - 50, CZ + 120, CZ + 620); b.mat(WHITE, 0.3, 'paint').box(L / 2 - 1500, L / 2 + 1500, CY - 130, CY - 110, CZ + 300, CZ + 440);   // the name board: a white bar on green
  return b.mesh(L); }

/** a 15 m length of platform: a brick face under paving slabs with a white edge line along the track side (its edge
 *  at y = 0, the platform behind toward +y), a gas lamp on an iron post and a bench */
export function platform(): Mesh { const b = new Build(), L = 15000, D = 4000, Z = 915;
  b.mat(BRICK2, 0.2, 'paint').box(0, L, 80, D, 0, Z - 70);                                                          // the face and the fill
  b.mat('#716d66', 0.15, 'plain').box(0, L, 800, D, Z - 70, Z - 15);                                                // the rolled surface
  for (let k = 0; k < 15; k++) b.mat(k % 2 ? CONCRETE : '#9c978f', 0.2, 'plain').box(k * 1000, k * 1000 + 1000, -120, 800, Z - 80, Z);   // the edge slabs
  b.mat(WHITE, 0.3, 'paint').box(0, L, -125, 160, Z - 30, Z + 8);                                                   // the white edge
  const lx = 3800, ly = 3100; b.mat(DARKG, 0.35, 'paint').box(lx - 110, lx + 110, ly - 110, ly + 110, Z - 15, Z + 650).box(lx - 55, lx + 55, ly - 55, ly + 55, Z + 650, Z + 3000).bar([lx - 380, ly, Z + 2750], [lx + 380, ly, Z + 2750], 45);   // the lamp post and its ladder bar
  b.mat('#f1e2a8', 0.5, 'plain').box(lx - 60, lx + 60, ly - 60, ly + 60, Z + 3050, Z + 3300);                       // the mantle
  b.mat(GLASS, 0.5, 'glass').loft([[110, Z + 3000], [190, Z + 3420]].map(([r, z]) => [[lx - r!, ly - r!, z!], [lx + r!, ly - r!, z!], [lx + r!, ly + r!, z!], [lx - r!, ly + r!, z!]] as V[]));   // the lantern
  b.mat(DARKG, 0.35, 'paint').loft([[230, Z + 3420], [40, Z + 3640]].map(([r, z]) => [[lx - r!, ly - r!, z!], [lx + r!, ly - r!, z!], [lx + r!, ly + r!, z!], [lx - r!, ly + r!, z!]] as V[]));   // its cap
  const bx = 9300, bl = 1900, by = 3000; b.mat(WOOD, 0.2, 'wood').box(bx, bx + bl, by, by + 480, Z + 400, Z + 450).box(bx, bx + bl, by + 470, by + 520, Z + 560, Z + 900);   // the bench: seat and back
  b.mat(IRON, 0.3, 'metal'); for (const x of [bx + 60, bx + bl / 2 - 30, bx + bl - 120]) b.box(x, x + 60, by + 30, by + 520, Z - 15, Z + 400).box(x, x + 60, by + 470, by + 540, Z + 400, Z + 900);
  return b.mesh(L); }

/** the signal box: a timber cabin, windows all round, on a brick base, a slate hipped roof, steps up one end to its door */
export function signalBox(): Mesh { const b = new Build(), L = 7300, C = 6000, HD = 1800, F = 2700, S = 3600, T = 4800, E = 5050;
  b.mat(BRICK, 0.2, 'paint').box(0, C, -HD, HD, 0, F); b.mat(BRICK2, 0.2, 'paint').box(-40, C + 40, -HD - 40, HD + 40, 0, 400);
  b.mat(PANE, 0.5, 'paint'); for (const x of [1300, 3900]) b.box(x, x + 800, -HD - 25, -HD, 1000, 2000); b.mat(CREAM, 0.3, 'paint'); for (const x of [1300, 3900]) b.box(x - 100, x + 900, -HD - 45, -HD, 2000, 2180);   // the locking room's windows
  b.mat(CREAM, 0.3, 'wood').box(-80, C + 80, -HD - 80, HD + 80, F, S).box(-80, C + 80, -HD - 80, HD + 80, T, E);    // boarding below and above the windows
  b.mat(GLASS, 0.5, 'glass').box(-30, C + 30, -HD - 30, HD + 30, S, T); b.mat('#4a4540', 0.1).box(250, C - 250, -HD + 250, HD - 250, S - 100, T - 150);   // the glass, the room seen through
  b.mat(GREEN, 0.3, 'paint'); for (let x = 0; x <= C; x += C / 6) b.box(x - 55, x + 55, -HD - 85, HD + 85, S, T); for (const y of [-HD, -HD / 3, HD / 3, HD]) b.box(-85, C + 85, y - 55, y + 55, S, T);   // the window posts
  b.box(-90, C + 90, -HD - 90, HD + 90, S - 80, S).box(C + 30, C + 95, -HD + 250, -HD + 1100, F, T);                // the sill band, the door in the end
  b.mat(WHITE, 0.3, 'paint').box(1700, 4300, -HD - 110, -HD - 80, F + 250, F + 650); b.mat(DARK, 0.2, 'paint').box(1900, 4100, -HD - 125, -HD - 110, F + 380, F + 520);   // the name board (plain)
  b.mat(SLATE, 0.3, 'plain').loft([[[-450, -HD - 450, E], [C + 450, -HD - 450, E], [C + 450, HD + 450, E], [-450, HD + 450, E]], [[1700, 0, E + 1350], [C - 1700, 0, E + 1350], [C - 1700, 0, E + 1350], [1700, 0, E + 1350]]]);   // the hipped roof
  b.mat(BRICK2, 0.2, 'paint').box(700, 1250, HD - 500, HD + 50, E, E + 1500); b.mat(DARKG, 0.3, 'paint').bar([1700, 0, E + 1300], [1700, 0, E + 1800], 70).bar([C - 1700, 0, E + 1300], [C - 1700, 0, E + 1800], 70);   // the stack, the finials
  const sx0 = C + 100, sx1 = L - 60, y0 = -HD + 1250, n = 10, rise = F / n;
  b.mat(WOOD, 0.2, 'wood').box(C, L, -HD, y0, F - 90, F).box(L - 150, L - 30, -HD + 30, -HD + 150, 0, F - 90);      // the landing and its post
  for (let k = 1; k < n; k++) b.box(sx0, sx1, y0 + (k - 1) * 300, y0 + k * 300 + 40, F - k * rise - 60, F - k * rise);   // the treads
  for (const x of [sx0 - 40, sx1 + 40]) b.bar([x, y0, F - 180], [x, y0 + (n - 1) * 300 + 150, 0], 60, 240);         // the strings
  b.mat(CREAM, 0.3, 'paint').bar([L - 30, -HD, F + 1000], [L - 30, y0, F + 1000], 60).bar([L - 30, y0, F + 1000], [L - 30, y0 + (n - 1) * 300, rise + 1000], 60);   // the handrail
  for (const [y, z] of [[-HD + 30, F], [y0, F], [y0 + (n - 1) * 300, rise]] as const) b.bar([L - 30, y, z - 60], [L - 30, y, z + 1000], 60); b.bar([C, -HD, F + 1000], [L - 30, -HD, F + 1000], 60);
  return b.mesh(L); }

/** a telegraph pole: a tarred pole with three cross-arms (across the line; the wires run along x) */
export function telegraphPole(): Mesh { const b = new Build(), T = 240, H = 8200;
  b.mat('#4a3b2e', 0.15, 'wood').loft([[130, 0], [85, H]].map(([r, z]) => [[T / 2 - r!, -r!, z!], [T / 2 + r!, -r!, z!], [T / 2 + r!, r!, z!], [T / 2 - r!, r!, z!]] as V[]));
  b.mat('#3d3127', 0.15, 'wood'); [1150, 1000, 850].forEach((w, k) => b.box(T / 2 - 150, T / 2 - 60, -w, w, H - 500 - k * 600, H - 400 - k * 600));
  b.mat(WHITE, 0.4, 'plain'); [1150, 1000, 850].forEach((w, k) => { for (const s of [-1, 1]) b.box(T / 2 - 150, T / 2 - 60, s * (w - 130) - 45, s * (w - 130) + 45, H - 400 - k * 600, H - 290 - k * 600); });   // the end insulators
  return b.mesh(T); }

/** the river bridge: one 15 m side parapet of the concrete span (stood each side of the line, its outer face -y):
 *  the deck's edge beam, solid ends, a middle pier and balusters between under a coping. All of it at or above the
 *  ground: the river and the span's shadow are drawn on the ground */
export function riverBridge(): Mesh { const b = new Build(), L = 15000, E = 2200, P = 500;
  b.mat(CONC2, 0.2, 'paint').box(0, L, -330, 260, 0, 320);                                                          // the deck's edge beam
  b.mat(CONCRETE, 0.25, 'paint').box(0, E, -280, 280, 320, 1250).box(L - E, L, -280, 280, 320, 1250).box(L / 2 - P, L / 2 + P, -260, 260, 320, 1130);   // the solid ends, the middle pier
  for (const [x0, x1] of [[E + 380, L / 2 - P - 300], [L / 2 + P + 380, L - E - 300]] as const) for (let x = x0; x < x1; x += 780) b.box(x, x + 240, -120, 120, 320, 960);   // balusters
  b.box(E, L - E, -230, 230, 960, 1130);                                                                            // the rail over them
  b.mat(CONC2, 0.2, 'paint').box(-60, E + 60, -340, 340, 1250, 1400).box(L - E - 60, L + 60, -340, 340, 1250, 1400);   // the ends' caps
  b.box(300, E - 300, -300, -280, 520, 1050).box(L - E + 300, L - 300, -300, -280, 520, 1050);                      // a sunk panel each end
  return b.mesh(L); }
