// The start-line buildings of Millbrook (review 88): a grandstand bay, the clock tower, the timing box, the scoreboard,
// and the Members' Bridge over the track (its abutments, and its deck drawn above the cars). Low-poly meshes in the cars'
// manner (render/car/mesh.ts). Each prop's own axes: x along its length from 0 to its `length`, y across (+ toward the
// side it faces away from), z up; its anchor (where it stands) is the middle of its length at y = 0, z = 0.
import { Build, type Mesh, type V } from '../car/mesh';

const CREAM = '#ddd3bb', GREEN = '#3f5a3c', DARKG = '#2c3f2a', ROOF = '#5a5f63', WOOD = '#8a6a48', DARK = '#26242a', WHITE = '#efeee8', RED = '#9d3329', CONCRETE = '#a7a29a', IRON = '#4a4d52', GLASS = '#9fb6c0';
/** a grandstand bay, 15 m: stepped timber seating rising away from the track (y +), a back wall, a pitched iron roof on columns */
export function grandstandBay(): Mesh { const b = new Build(), L = 15000, D = 10000, rows = 9;
  b.mat(CREAM, 0.3, 'paint').box(0, L, -600, 0, 0, 900);                                   // the front wall
  for (let r = 0; r < rows; r++) { const y0 = r * (D / rows), z = 900 + r * 520; b.mat(r % 2 ? WOOD : '#7d5f40', 0.2, 'wood').box(0, L, y0, y0 + D / rows, 0, z); b.mat('#6b5236', 0.15, 'wood').box(0, L, y0, y0 + 160, z, z + 300); }   // the steps and their benches
  b.mat(CREAM, 0.3, 'paint').box(0, L, D, D + 300, 0, 6600).box(-200, 0, -600, D + 300, 0, 6600).box(L, L + 200, -600, D + 300, 0, 6600);   // the back and ends
  b.mat(GREEN, 0.35, 'paint'); for (let x = 0; x <= L; x += 5000) b.box(x - 120, x + 120, -300, -60, 900, 8200);   // columns
  b.mat(ROOF, 0.4, 'metal').loft([[-400, -1200, 8000], [L + 400, -1200, 8000]].map(([x]) => [[x!, -1200, 8000], [x!, D + 400, 9400], [x!, D + 400, 9600], [x!, -1200, 8200]] as V[]));   // the roof falling toward the track
  b.mat(DARKG, 0.3, 'paint').box(-400, L + 400, -1300, -1150, 7600, 8250);                 // the fascia
  for (let x = 900; x < L; x += 2400) b.mat(RED, 0.3, 'paint').box(x, x + 1500, -1320, -1300, 7700, 8150);   // bunting panels
  return b.mesh(L); }
/** the clock tower: a square brick tower with a clock face each side, a lantern and a flag */
export function clockTower(): Mesh { const b = new Build(), S = 3200, H = 14000;
  b.mat('#9a5b45', 0.2, 'paint').box(0, S, -S / 2, S / 2, 0, H);
  b.mat(CREAM, 0.3, 'paint').box(-150, S + 150, -S / 2 - 150, S / 2 + 150, H - 2600, H - 2300).box(-150, S + 150, -S / 2 - 150, S / 2 + 150, H, H + 300);
  for (const [x, y, ax] of [[S / 2, -S / 2 - 20, 'y'], [S / 2, S / 2 + 20, 'y'], [-20, 0, 'x'], [S + 20, 0, 'x']] as const) { b.mat(WHITE, 0.4, 'plain').lathe(ax, [x, y, H - 1300], [[0, 0], [0, 900]], 16, false); b.mat(DARK, 0.1).bar([x, y + (ax === 'y' ? Math.sign(y) * 10 : 0), H - 1300], [x + (ax === 'x' ? Math.sign(x - S / 2) * 10 : 0), y, H - 700], 90).bar([x, y, H - 1300], [x + (ax === 'y' ? 500 : 0), y + (ax === 'x' ? 500 : 0), H - 1300], 90); }
  b.mat(ROOF, 0.4, 'metal').loft([[0, -S / 2, H + 300], [S, -S / 2, H + 300]].map(([x]) => [[x!, -S / 2 - 200, H + 300], [x!, S / 2 + 200, H + 300], [x!, 0, H + 2400]] as V[]));
  b.mat(DARK, 0.2, 'metal').bar([S / 2, 0, H + 2300], [S / 2, 0, H + 5200], 80); b.mat(RED, 0.3, 'paint').quad([S / 2, 0, H + 5100], [S / 2 + 1400, 0, H + 4900], [S / 2 + 1400, 0, H + 4300], [S / 2, 0, H + 4400]);
  return b.mesh(S); }
/** the timing box: a timber hut on legs above the line, windows all round, steps up the back */
export function timingBox(): Mesh { const b = new Build(), L = 5000, D = 3000, F = 2600, H = 2600;
  b.mat(DARKG, 0.3, 'paint'); for (const x of [200, L - 200]) for (const y of [-D / 2 + 200, D / 2 - 200]) b.box(x - 120, x + 120, y - 120, y + 120, 0, F);
  b.mat(CREAM, 0.3, 'paint').box(0, L, -D / 2, D / 2, F, F + 900).box(0, L, -D / 2, D / 2, F + H - 300, F + H);
  b.mat(GLASS, 0.5, 'glass').box(100, L - 100, -D / 2 + 60, D / 2 - 60, F + 900, F + H - 300); b.mat('#4a4540', 0.1).box(300, L - 300, -D / 2 + 300, D / 2 - 300, F, F + H - 400);   // the room seen through
  b.mat(GREEN, 0.3, 'paint'); for (let x = 0; x <= L; x += L / 4) b.box(x - 60, x + 60, -D / 2 - 10, D / 2 + 10, F + 900, F + H - 300);
  b.mat(ROOF, 0.4, 'metal').loft([[-300, 0, 0], [L + 300, 0, 0]].map(([x]) => [[x!, -D / 2 - 400, F + H], [x!, D / 2 + 400, F + H], [x!, 0, F + H + 900]] as V[]));
  b.mat(WOOD, 0.2, 'wood'); for (let k = 0; k < 8; k++) b.box(L - 1000, L - 200, D / 2 + k * 260, D / 2 + k * 260 + 280, 0, F - k * F / 8);   // the stair
  return b.mesh(L); }
/** the scoreboard: a black board of number frames on a timber gantry, a name board above */
export function scoreboard(): Mesh { const b = new Build(), L = 12000, Z = 2200, H = 4800;
  b.mat(WOOD, 0.2, 'wood'); for (let x = 600; x < L; x += 3600) b.box(x - 150, x + 150, -150, 150, 0, Z + H + 900).bar([x, 0, 0], [x, 1800, 0], 200).bar([x, 0, Z + H], [x, 1800, 0], 160);
  b.mat(DARK, 0.15, 'paint').box(0, L, -200, 0, Z, Z + H);
  b.mat(WHITE, 0.3, 'plain'); for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) { const x = 500 + c * 1120, z = Z + 400 + r * 1080; if ((r * 7 + c * 3) % 5 < 3) b.box(x, x + 700, -260, -200, z, z + 760); }   // the hung numbers
  b.mat(CREAM, 0.3, 'paint').box(1500, L - 1500, -260, -60, Z + H + 300, Z + H + 1300); b.mat(RED, 0.3, 'paint').box(1800, L - 1800, -300, -260, Z + H + 500, Z + H + 1100);
  return b.mesh(L); }
/** the Members' Bridge: one abutment (a concrete pier with a balustrade, stairs up); stood each side of the track */
/** H: its height to the deck (mm): taller where it stands on the low side of a banking (review 113) */
export function bridgeAbutment(H = 5800): Mesh { const b = new Build(), L = 7000, D = 3000;
  b.mat(CONCRETE, 0.25, 'paint').box(0, L, -D / 2, D / 2, 0, H).box(0, L, -D / 2 - 200, D / 2 + 200, H, H + 400);
  b.mat('#8f8a82', 0.2, 'paint'); for (let k = 0; k < 10; k++) b.box(L - 2000 - k * 400, L - 1600 - k * 400, D / 2, D / 2 + 1600, 0, H - k * H / 10);   // the steps beside it
  b.mat(CONCRETE, 0.25, 'paint'); for (let x = 200; x < L; x += 600) b.box(x, x + 180, -D / 2 - 150, -D / 2 + 50, H + 400, H + 1300); b.box(0, L, -D / 2 - 200, -D / 2 + 100, H + 1300, H + 1500);
  return b.mesh(L); }
/** the Members' Bridge deck: a 13 m span piece of the beam and footway over the track, from its underside at z = 0 (stood at the deck's height above the cars) */
export function bridgeDeck(): Mesh { const b = new Build(), L = 13000, D = 3000;
  b.mat(CONCRETE, 0.25, 'paint').box(0, L, -D / 2, D / 2, 0, 900); b.mat('#8b867e', 0.2, 'paint').box(0, L, -D / 2 - 250, -D / 2, 300, 900).box(0, L, D / 2, D / 2 + 250, 300, 900);
  b.mat(CONCRETE, 0.25, 'paint'); for (let x = 200; x < L; x += 600) for (const y of [-D / 2 - 100, D / 2 - 80]) b.box(x, x + 180, y, y + 180, 900, 1800); b.box(0, L, -D / 2 - 200, -D / 2 + 50, 1800, 2000).box(0, L, D / 2 - 50, D / 2 + 200, 1800, 2000);
  b.mat(WHITE, 0.3, 'paint').box(L / 2 - 2500, L / 2 + 2500, -D / 2 - 300, -D / 2 - 250, 350, 850); b.mat(GREEN, 0.3, 'paint').box(L / 2 - 2300, L / 2 + 2300, -D / 2 - 320, -D / 2 - 300, 450, 750);   // the sign: green on white
  return b.mesh(L); }
