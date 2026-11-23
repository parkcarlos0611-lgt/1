// The paddock of Millbrook (docs/systems/71_track_props.md): the members' clubhouse (a centre and a wing, 12 m each,
// stood end to end), a bay of four paddock garages, the petrol pumps, an advertising hoarding and the tea hut. Low-poly
// meshes in the cars' manner (render/car/mesh.ts), in the axes of render/props/stands.ts: x along the length from 0 to
// `length`, y across (the front faces -y), z up; the anchor is the middle of the length at y = 0, z = 0.
import { Build, type Mesh, type V } from '../car/mesh';

const CREAM = '#ddd3bb', GREEN = '#3f5a3c', DARKG = '#2c3f2a', IRON = '#4a4d52', WOOD = '#8a6a48', DARK = '#26242a', WHITE = '#efeee8', RED = '#9d3329', CONCRETE = '#a7a29a', GLASS = '#9fb6c0';
const TILE = '#9a5340', TAR = '#3b3a3d', CREOSOTE = '#5b4433', TIN = '#7d8387', TIN2 = '#6c7276', BLUE = '#2f4f77', YELLOW = '#d8b344', INSIDE = '#1d1b1f';

/** a round thing standing upright at (x, y): [height, radius] pairs from the bottom up */
function turn(b: Build, x: number, y: number, prof: [number, number][], seg = 12): Build {
  return b.loft(prof.map(([z, r]) => Array.from({ length: seg }, (_, i) => { const t = i / seg * Math.PI * 2; return [x + Math.cos(t) * r, y + Math.sin(t) * r, z] as V; }))); }
/** a pitched roof skin, ridge along x, over the walls y0..y1 whose tops are at z0: it overhangs `over` each way and is `t` thick */
function pitch(b: Build, x0: number, x1: number, y0: number, y1: number, z0: number, rise: number, over = 400, t = 180): Build {
  const ym = (y0 + y1) / 2, drop = over * rise / (ym - y0), ze = z0 - drop, zr = z0 + rise;
  const ring = (x: number): V[] => [[x, y0 - over, ze], [x, ym, zr], [x, y1 + over, ze], [x, y1 + over, ze + t], [x, ym, zr + t], [x, y0 - over, ze + t]];
  b.loft([ring(x0), ring(x1)], false);
  for (const x of [x0, x1]) { const r = ring(x); b.quad(r[0]!, r[1]!, r[4]!, r[5]!).quad(r[1]!, r[2]!, r[3]!, r[4]!); }
  return b; }
/** the gable walls' triangle (a prism under a pitched roof) */
function gable(b: Build, x0: number, x1: number, y0: number, y1: number, z0: number, rise: number): Build {
  return b.loft([x0, x1].map(x => [[x, y0, z0], [x, y1, z0], [x, (y0 + y1) / 2, z0 + rise]] as V[])); }
/** a window in a wall facing -y (s = -1) or +y (s = 1) at y: a white frame, the glass, a glazing bar */
function win(b: Build, xc: number, y: number, s: number, w: number, z0: number, z1: number): void {
  b.mat(WHITE, 0.3, 'boards').box(xc - w / 2 - 90, xc + w / 2 + 90, Math.min(y, y + s * 40), Math.max(y, y + s * 40), z0 - 90, z1 + 90);
  b.mat(GLASS, 0.5, 'glass').box(xc - w / 2, xc + w / 2, Math.min(y, y + s * 70), Math.max(y, y + s * 70), z0, z1);
  b.mat(WHITE, 0.3, 'boards').box(xc - 35, xc + 35, Math.min(y, y + s * 90), Math.max(y, y + s * 90), z0, z1); }

const CL = 12000, CD = 7500, CE = 6000, CR = 2400, CV = 2400;   // the clubhouse: a piece's length, its depth, eaves, the roof's rise, the verandah's depth
/** what the clubhouse's centre and wing share: the rendered walls, the tiled roof, the verandah and balcony along the front */
function clubBody(b: Build, posts: number[], wins: number[], doors: number[]): void { const L = CL;
  b.mat(CONCRETE, 0.2, 'concrete').box(0, L, -CV, 0, 0, 180).box(-60, L + 60, -60, CD + 60, 0, 450);          // the verandah's floor and the plinth
  b.mat(CREAM, 0.3, 'render').box(0, L, 0, CD, 0, CE); gable(b, 0, L, 0, CD, CE, CR);                          // the walls
  b.mat(TILE, 0.25, 'tile'); pitch(b, -300, L + 300, 0, CD, CE, CR, 500, 200);                               // the tiled roof
  b.mat('#7f4433', 0.2, 'tile').box(-300, L + 300, CD / 2 - 110, CD / 2 + 110, CE + CR + 150, CE + CR + 290);   // the ridge tiles
  for (const x of wins) { win(b, x, 0, -1, 1300, 950, 2450); win(b, x, 0, -1, 1300, 3950, 5300); win(b, x, CD, 1, 1100, 1000, 2400); win(b, x, CD, 1, 1100, 3950, 5200); }
  for (const x of doors) { b.mat(DARKG, 0.35, 'boards').box(x - 650, x + 650, -50, 0, 3050, 5350); b.mat(GLASS, 0.5, 'glass').box(x - 520, x + 520, -80, -50, 3500, 5200); b.mat(DARKG, 0.35, 'boards').box(x - 40, x + 40, -100, -80, 3050, 5350); }   // french doors on to the balcony
  b.mat(WOOD, 0.2, 'timber').box(0, L, -CV, 0, 2880, 3050);                                                    // the balcony's deck
  b.mat(DARKG, 0.3, 'boards').box(0, L, -CV - 40, -CV + 40, 2780, 3080);                                       // its fascia
  b.mat(GREEN, 0.35, 'boards'); for (const x of posts) b.box(x - 80, x + 80, -CV + 20, -CV + 180, 180, 5320);   // the posts, ground to the verandah roof
  b.mat(WHITE, 0.3, 'boards').box(0, L, -CV + 70, -CV + 110, 3080, 3850);                                      // the balustrade, boarded
  b.mat(GREEN, 0.35, 'boards').box(0, L, -CV + 30, -CV + 150, 3850, 3950);                                     // its rail
  b.mat('#586a5c', 0.35, 'sheet').loft([-200, L + 200].map(x => [[x, 0, 5650], [x, -CV - 350, 5220], [x, -CV - 350, 5340], [x, 0, 5790]] as V[]));   // the verandah's leaded roof
}
/** the members' clubhouse, a wing (12 m): two storeys of cream render, a verandah below and a balcony above along the front, a tiled roof and a chimney */
export function clubhouseWing(): Mesh { const b = new Build(), L = CL;
  clubBody(b, [150, 3075, 6000, 8925, L - 150], [1600, 4550, 7450, 10400], []);
  b.mat('#9a5b45', 0.2, 'brick').box(L / 2 - 450, L / 2 + 450, CD / 2 + 600, CD / 2 + 1400, CE + 900, CE + CR + 1300);   // the chimney stack
  b.mat(CREAM, 0.3, 'render').box(L / 2 - 520, L / 2 + 520, CD / 2 + 530, CD / 2 + 1470, CE + CR + 1300, CE + CR + 1450);
  b.mat(TILE, 0.2, 'tile'); for (const x of [L / 2 - 220, L / 2 + 220]) turn(b, x, CD / 2 + 1000, [[CE + CR + 1450, 150], [CE + CR + 1850, 120]], 8);   // the pots
  return b.mesh(L); }
/** the members' clubhouse, the centre (12 m): the wing's storeys with a gabled front over the entrance, steps, the doors and a flagstaff */
export function clubhouseCentre(): Mesh { const b = new Build(), L = CL, M = L / 2;
  clubBody(b, [150, 3075, 4550, 7450, 8925, L - 150], [1600, 10400], [M, 3800, 8200]);
  b.mat(CREAM, 0.3, 'render').loft([-350, 0].map(y => [[M - 2700, y, CE - 250], [M + 2700, y, CE - 250], [M, y, CE + 2000]] as V[]));     // the gabled front
  b.mat(TILE, 0.25, 'tile'); { const ring = (y: number): V[] => [[M - 3200, y, CE - 370], [M, y, CE + 2130], [M + 3200, y, CE - 370], [M + 3200, y, CE - 170], [M, y, CE + 2330], [M - 3200, y, CE - 170]], r0 = ring(-750), r1 = ring(CD / 2);
    b.loft([r0, r1], false).quad(r0[0]!, r0[1]!, r0[4]!, r0[5]!).quad(r0[1]!, r0[2]!, r0[3]!, r0[4]!); }                                  // its roof, run back into the main one
  b.mat(WHITE, 0.3, 'boards').lathe('y', [M, -400, CE + 750], [[0, 620], [40, 620]], 14); b.mat(GLASS, 0.5, 'glass').lathe('y', [M, -450, CE + 750], [[0, 480], [30, 480]], 14);   // the round window
  b.mat(DARKG, 0.35, 'boards').box(M - 950, M + 950, -60, 0, 450, 2600); b.mat(GLASS, 0.5, 'glass').box(M - 800, M - 60, -90, -60, 1300, 2400).box(M + 60, M + 800, -90, -60, 1300, 2400);   // the entrance doors
  win(b, 3800, 0, -1, 1100, 950, 2450); win(b, 8200, 0, -1, 1100, 950, 2450);
  b.mat(CONCRETE, 0.2, 'concrete').box(M - 1700, M + 1700, -CV - 450, -CV, 0, 120).box(M - 1100, M + 1100, -700, 0, 180, 330);                // the steps
  b.mat(WHITE, 0.3, 'boards').bar([M, -700, CE + 2250], [M, -700, CE + 5600], 90);                                                        // the flagstaff
  b.mat(GREEN, 0.3, 'canvas').quad([M + 45, -700, CE + 5500], [M + 1500, -700, CE + 5350], [M + 1500, -700, CE + 4600], [M + 45, -700, CE + 4700]);
  b.mat(YELLOW, 0.3, 'canvas').quad([M + 45, -705, CE + 5200], [M + 1500, -705, CE + 5060], [M + 1500, -705, CE + 4880], [M + 45, -705, CE + 5000]);
  return b.mesh(L); }
/** the members' clubhouse as one piece is too long to sort: this is its centre (stand a clubhouseWing() each side) */
export function clubhouse(): Mesh { return clubhouseCentre(); }

/** a bay of four paddock garages, 14 m: creosoted timber under a corrugated iron roof, the doors standing open on the dark insides */
export function garageBay(): Mesh { const b = new Build(), N = 4, W = 3500, L = N * W, D = 5600, H = 2900, R = 1300;
  b.mat(INSIDE, 0.05).box(120, L - 120, 120, D - 120, 0, H - 100);                                           // the dark inside
  b.mat('#3a3733', 0.1).box(120, L - 120, -40, 130, 0, 40);                                                  // the floor at the thresholds
  b.mat(CREOSOTE, 0.15, 'timber').box(0, L, D - 120, D, 0, H).box(0, 120, 0, D, 0, H).box(L - 120, L, 0, D, 0, H); gable(b, 0, L, 0, D, H, R);   // the back, the ends and their gables
  b.mat('#4d3a2c', 0.15, 'timber').box(0, L, 0, 120, 2450, H);                                                 // the board over the doors
  for (let k = 0; k <= N; k++) { const x = k * W, a = k === 0 ? 0 : x - 200, c = k === N ? L : x + 200; b.mat(CREOSOTE, 0.15, 'timber').box(a, c, 0, 120, 0, 2450); if (k > 0 && k < N) b.mat('#2a2622', 0.05).box(x - 60, x + 60, 120, D - 120, 0, H - 80); }   // the posts between the doors, the partitions
  for (let k = 0; k < N; k++) { const x0 = k * W + (k === 0 ? 120 : 200), x1 = (k + 1) * W - (k === N - 1 ? 120 : 200), sw = [0.42, 0.2, 0.3, 0.5][k]!;   // each pair of doors, swung out by its own amount
    for (const [hx, s] of [[x0, -1], [x1, 1]] as const) { const w = (x1 - x0) / 2, tip: V = [hx + s * Math.sin(sw) * w, -60 - Math.cos(sw) * w, 1240];
      b.mat(GREEN, 0.3, 'boards').bar([hx, -60, 1240], tip, 70, 2400);
      b.mat(DARKG, 0.3, 'boards').bar([hx, -60, 2150], [tip[0], tip[1], 2150], 110, 130).bar([hx, -60, 330], [tip[0], tip[1], 330], 110, 130); }
    b.mat(WHITE, 0.3, 'boards').box((x0 + x1) / 2 - 260, (x0 + x1) / 2 + 260, -30, 0, 2530, 2830); }                                        // the number plate over them
  for (let k = 0; k < 7; k++) { b.mat(k % 2 ? TIN : TIN2, 0.45, 'corrugated'); pitch(b, -200 + k * (L + 400) / 7, -200 + (k + 1) * (L + 400) / 7, 0, D, H, R, 450, 90); }   // the iron roof, sheet by sheet
  b.mat(IRON, 0.4, 'metal').box(-200, L + 200, D / 2 - 120, D / 2 + 120, H + R + 60, H + R + 150);                                         // the ridge capping
  b.mat(RED, 0.4, 'metal'); turn(b, L + 500, 600, [[0, 290], [880, 290]], 10); b.mat('#5a6e52', 0.4, 'metal'); turn(b, L + 560, 1300, [[0, 290], [880, 290]], 10);   // oil drums at the end
  b.mat(WOOD, 0.2, 'timber').box(-900, -150, 300, 2300, 700, 780).box(-850, -770, 350, 430, 0, 700).box(-850, -770, 2170, 2250, 0, 700).box(-280, -200, 350, 430, 0, 700).box(-280, -200, 2170, 2250, 0, 700);   // a bench against the other end
  return b.mesh(L); }

/** a petrol pump: a tall round cabinet, a dial, a glass globe on top and a hose */
function pump(b: Build, x: number, colour: string): void {
  b.mat(IRON, 0.4, 'metal'); turn(b, x, 0, [[150, 360], [330, 360], [400, 290]], 8);
  b.mat(colour, 0.55, 'paint'); turn(b, x, 0, [[400, 280], [1750, 280], [1880, 220], [2050, 130]], 8);
  b.mat(WHITE, 0.4, 'plain').lathe('y', [x, -265, 1400], [[0, 190], [-30, 190]], 8);                       // the dial
  b.mat(DARK, 0.2).bar([x, -300, 1400], [x + 70, -300, 1500], 30);
  b.mat(WHITE, 0.7, 'glass'); turn(b, x, 0, [[2050, 100], [2120, 230], [2250, 290], [2380, 230], [2450, 100]], 8);   // the globe
  b.mat(DARK, 0.3).bar([x + 280, 0, 1650], [x + 420, -80, 1000], 55).bar([x + 420, -80, 1000], [x + 300, -200, 520], 55).bar([x + 300, -200, 520], [x + 255, -120, 900], 55);   // the hose, hung on its hook
}
/** a pair of petrol pumps on their island with a lamp post between them, 3.6 m */
export function fuelPumps(): Mesh { const b = new Build(), L = 3600, M = L / 2;
  b.mat(CONCRETE, 0.25, 'concrete').box(150, L - 150, -550, 550, 0, 150).box(0, 150, -400, 400, 0, 150).box(L - 150, L, -400, 400, 0, 150);
  b.mat(WHITE, 0.3, 'concrete').box(150, L - 150, -570, -550, 0, 150).box(150, L - 150, 550, 570, 0, 150);       // the kerb, whitewashed
  pump(b, 750, RED); pump(b, L - 750, GREEN);
  b.mat(DARKG, 0.4, 'metal'); turn(b, M, 0, [[150, 130], [900, 95], [950, 70], [4200, 55]], 8);            // the lamp post
  b.bar([M, 0, 4150], [M, -350, 4450], 60).bar([M, -350, 4450], [M, -700, 4380], 60).bar([M - 380, 0, 3500], [M + 380, 0, 3500], 50);
  b.mat(DARKG, 0.4, 'metal'); turn(b, M, -700, [[4260, 330], [4380, 110], [4440, 60]], 10);                 // its shade
  b.mat('#f2e6b8', 0.7, 'glass'); turn(b, M, -700, [[4080, 60], [4130, 130], [4260, 130]], 8);              // and the lamp
  b.mat(RED, 0.4, 'metal'); turn(b, M + 520, 250, [[150, 150], [520, 150], [560, 60], [640, 60]], 8);       // a can on the island
  return b.mesh(L); }

/** an advertising hoarding, 8 m: boards on timber legs, stayed behind, three plain panels of colour and stripes */
export function hoarding(): Mesh { const b = new Build(), L = 8000, Z0 = 900, Z1 = 3900, y = -110;
  b.mat(WOOD, 0.2, 'timber'); for (let x = 200; x <= L - 200; x += (L - 400) / 4) b.box(x - 90, x + 90, 0, 180, 0, Z1 + 100).bar([x, 180, Z1 - 600], [x, 2000, 0], 140);   // the legs and their stays
  b.box(0, L, 0, 60, Z0 + 300, Z0 + 450).box(0, L, 0, 60, Z1 - 450, Z1 - 300);                               // the rails behind
  b.mat('#75593d', 0.15, 'timber').box(0, L, -80, 0, Z0, Z1);                                                   // the boards
  b.mat(CREAM, 0.3, 'boards').box(-60, L + 60, y, -80, Z0 - 60, Z1 + 60);                                      // the painted face and its border
  const P = (L - 400) / 3, f = y - 20, g = y - 40;
  b.mat(RED, 0.3, 'boards').box(200, 100 + P, f, y, Z0 + 150, Z1 - 150);                                       // red, a cream band and a yellow line
  b.mat(CREAM, 0.3, 'boards').box(200, 100 + P, g, f, 2050, 2750); b.mat(YELLOW, 0.3, 'boards').box(200, 100 + P, g, f, 1500, 1680);
  b.mat(YELLOW, 0.3, 'boards').box(300 + P, 100 + 2 * P, f, y, Z0 + 150, Z1 - 150);                            // yellow, a green disc between green lines
  b.mat(GREEN, 0.3, 'boards').lathe('y', [200 + 1.5 * P, f, 2400], [[0, 820], [-20, 820]], 16).box(300 + P, 100 + 2 * P, g, f, Z0 + 150, Z0 + 420).box(300 + P, 100 + 2 * P, g, f, Z1 - 420, Z1 - 150);
  b.mat(BLUE, 0.3, 'boards').box(300 + 2 * P, 200 + 3 * P, f, y, Z0 + 150, Z1 - 150);                          // blue, white slanting stripes
  b.mat(WHITE, 0.3, 'boards'); for (let k = 0; k < 3; k++) { const x = 500 + 2 * P + k * 780; b.quad([x, g, Z0 + 350], [x + 380, g, Z0 + 350], [x + 1000, g, Z1 - 350], [x + 620, g, Z1 - 350]); }
  return b.mesh(L); }

/** the tea hut, 4.5 m: a timber hut with a serving hatch and counter under a striped awning, a tarred roof and a stove pipe */
export function teaHut(): Mesh { const b = new Build(), L = 4500, D = 3000, H = 2400, R = 900;
  b.mat(INSIDE, 0.05).box(80, L - 80, 80, D - 80, 0, H - 60);                                                // the dark inside
  b.mat(GREEN, 0.3, 'boards').box(0, L, 0, 80, 0, 1050).box(0, L, D - 80, D, 0, H).box(0, 80, 0, D, 0, H).box(L - 80, L, 0, D, 0, H);   // the walls; the front below the hatch
  b.box(0, 700, 0, 80, 1050, H).box(3500, L, 0, 80, 1050, H).box(700, 3500, 0, 80, 2050, H);               // and round it
  b.mat(CREAM, 0.3, 'boards'); gable(b, 0, L, 0, D, H, R); b.box(-30, L + 30, -30, D + 30, H - 140, H);        // the gables and a cream band at the eaves
  b.box(620, 700, -30, 0, 1050, 2050).box(3500, 3580, -30, 0, 1050, 2050);                                   // the hatch's frame
  b.mat(WOOD, 0.25, 'timber').box(560, 3640, -420, 60, 1000, 1070);                                            // the counter
  b.mat('#b9bcc0', 0.7, 'metal'); turn(b, 1300, -150, [[1070, 150], [1420, 150], [1470, 60]], 8); b.mat(WHITE, 0.4, 'plain'); for (const x of [1900, 2150, 2400]) b.box(x, x + 110, -300, -190, 1070, 1160);   // the urn and cups
  for (let k = 0; k < 6; k++) { const x0 = 500 + k * 533, x1 = x0 + 533; b.mat(k % 2 ? CREAM : RED, 0.2, 'canvas').loft([x0, x1].map(x => [[x, -20, 2250], [x, -1500, 1880], [x, -1500, 1650], [x, -1500, 1880], [x, -20, 2290]] as V[]), false); }   // the awning and its valance
  b.mat(DARKG, 0.3, 'metal').bar([520, -1480, 1880], [520, -30, 1300], 40).bar([3680, -1480, 1880], [3680, -30, 1300], 40);   // its stays
  b.mat(DARKG, 0.35, 'boards').box(L, L + 40, 1000, 1850, 0, 2000); b.mat(GLASS, 0.5, 'glass').box(L + 40, L + 60, 1150, 1700, 1200, 1800);   // the door in the end
  win(b, 2250, D, 1, 900, 1200, 1900);
  b.mat(TAR, 0.15, 'sheet'); pitch(b, -250, L + 250, 0, D, H, R, 350, 110);                                   // the tarred roof
  b.mat(IRON, 0.4, 'metal'); turn(b, 3700, D - 700, [[H + 300, 80], [H + 1500, 80]], 8); turn(b, 3700, D - 700, [[H + 1500, 170], [H + 1650, 40]], 8);   // the stove pipe and its cowl
  b.mat(CREAM, 0.3, 'boards').box(900, 3600, -360, -300, H + 60, H + 620); b.mat(RED, 0.3, 'boards').box(1050, 3450, -380, -360, H + 250, H + 430);   // the board on the roof: a red stripe
  b.mat(WOOD, 0.2, 'timber').box(-1500, -300, -1300, -700, 720, 790).box(-1450, -1370, -1250, -750, 0, 720).box(-430, -350, -1250, -750, 0, 720);   // a table beside it
  b.box(-1500, -300, -1900, -1600, 420, 480).box(-1450, -1370, -1880, -1620, 0, 420).box(-430, -350, -1880, -1620, 0, 420);                   // and its bench
  return b.mesh(L); }
