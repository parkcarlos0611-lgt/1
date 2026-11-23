// The start-line buildings of Millbrook (review 88): a grandstand bay, the clock tower, the timing box, the scoreboard,
// and the Members' Bridge over the track (its abutments, and its deck drawn above the cars). Low-poly meshes in the cars'
// manner (render/car/mesh.ts). Each prop's own axes: x along its length from 0 to its `length`, y across (+ toward the
// side it faces away from), z up; its anchor (where it stands) is the middle of its length at y = 0, z = 0.
import { Build, type Mesh, type V } from '../car/mesh';

const BRICK = '#96593f', CREAM = '#ddd3bb', GREEN = '#3f5a3c', DARKG = '#2c3f2a', ROOF = '#5a5f63', WOOD = '#8a6a48', DARK = '#26242a', WHITE = '#efeee8', RED = '#9d3329', CONCRETE = '#a7a29a', IRON = '#4a4d52', GLASS = '#9fb6c0';
/** a grandstand bay, 15 m: stepped timber seating rising away from the track (y +), a back wall, a pitched iron roof on columns */
export function grandstandBay(): Mesh { const b = new Build(), L = 15000, D = 10000, rows = 9;
  b.mat(BRICK, 0.2, 'brick').box(0, L, -600, 0, 0, 900);                                   // the front wall
  for (let r = 0; r < rows; r++) { const y0 = r * (D / rows), z = 900 + r * 520; b.mat(r % 2 ? WOOD : '#7d5f40', 0.2, 'timber').box(0, L, y0, y0 + D / rows, 0, z); b.mat('#6b5236', 0.15, 'timber').box(0, L, y0, y0 + 160, z, z + 300); }   // the steps and their benches
  b.mat(CREAM, 0.3, 'boards').box(0, L, D, D + 300, 0, 6600).box(-200, 0, -600, D + 300, 0, 6600).box(L, L + 200, -600, D + 300, 0, 6600);   // the back and ends
  b.mat(GREEN, 0.35, 'boards'); for (let x = 0; x <= L; x += 5000) b.box(x - 120, x + 120, -300, -60, 900, 8200);   // columns
  b.mat(ROOF, 0.4, 'corrugated').loft([[-400, -1200, 8000], [L + 400, -1200, 8000]].map(([x]) => [[x!, -1200, 8000], [x!, D + 400, 9400], [x!, D + 400, 9600], [x!, -1200, 8200]] as V[]));   // the roof falling toward the track
  b.mat(DARKG, 0.3, 'boards').box(-400, L + 400, -1300, -1150, 7600, 8250);                 // the fascia
  for (let x = 900; x < L; x += 2400) b.mat(RED, 0.3, 'boards').box(x, x + 1500, -1320, -1300, 7700, 8150);   // bunting panels
  return b.mesh(L); }
/** the clock tower (review 126): an Edwardian brick clock tower of the kind the period's clubs and works built (red
 *  brick with stone dressings; compare the square cupola and its ogee lead roof over the 1907 Brooklands clubhouse, and
 *  the brick clock towers of the 1900s with their stone quoins and copper caps). 3.6 m square, 16.6 m to the ball and 18.5 m to the top of the vane: a
 *  stone plinth; a brick shaft with stone quoins, a door under a fanlight, slit windows and a string course; the clock
 *  stage between two cornices, a white dial in a stone ring on each side; a louvred timber belfry; a copper ogee roof
 *  gone green, a gilt ball and weather vane. Its front (the door) faces -y. */
export function clockTower(): Mesh { const b = new Build(), S = 3600, h = S / 2, cx = S / 2;
  const STONE = '#cfc7b3', STONE2 = '#bdb5a1', LEAD = '#6f767a', COPPER = '#6fa893', GILT = '#c9a646', DIAL = '#efebdd', INK = '#1e1c20';
  const Z1 = 700, ZS = 4700, Z2 = 9000, Z3 = 12000, ZB = 12450, ZL = 14300;   // plinth top, string course, lower cornice, upper cornice, belfry floor, belfry eaves
  // the four sides: 0 the front (-y), then round; a point `u` along a side, `d` out from the tower's middle, at height z
  const at = (k: number, u: number, d: number, z: number): V => k === 0 ? [cx + u, -d, z] : k === 1 ? [cx + d, u, z] : k === 2 ? [cx - u, d, z] : [cx - d, -u, z];
  const slab = (k: number, u0: number, u1: number, d0: number, d1: number, z0: number, z1: number) => { const p = at(k, u0, d0, z0), q = at(k, u1, d1, z1); b.box(Math.min(p[0], q[0]), Math.max(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[1], q[1]), z0, z1); };
  const band = (out: number, z0: number, z1: number) => b.box(cx - h - out, cx + h + out, -h - out, h + out, z0, z1);
  const arc = (k: number, uc: number, zc: number, r: number, d: number, a0: number, a1: number, seg: number): V[] => Array.from({ length: seg + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / seg; return at(k, uc + Math.cos(a) * r, d, zc + Math.sin(a) * r); });
  /** a flat ring (or a disc, r0 = 0) standing `d` out from side k, and its rim back to the wall */
  const ring = (k: number, uc: number, zc: number, r0: number, r1: number, d: number, back: number, a0 = 0, a1 = Math.PI * 2, seg = 20) => { const O = arc(k, uc, zc, r1, d, a0, a1, seg), I = arc(k, uc, zc, r0, d, a0, a1, seg), W = arc(k, uc, zc, r1, back, a0, a1, seg);
    for (let i = 0; i < seg; i++) { if (r0 > 0) b.quad(I[i]!, I[i + 1]!, O[i + 1]!, O[i]!); else b.tri(I[0]!, O[i]!, O[i + 1]!); if (back < d) b.quad(O[i]!, O[i + 1]!, W[i + 1]!, W[i]!); } };
  b.mat(STONE2, 0.2, 'render'); band(140, 0, Z1 - 120); band(90, Z1 - 120, Z1);                     // the plinth, stepped
  b.mat(BRICK, 0.2, 'brick').box(cx - h, cx + h, -h, h, Z1, Z3);                                    // the shaft and the clock stage
  b.mat(STONE, 0.2, 'render');
  for (const [z0, z1] of [[Z1, ZS], [ZS + 220, Z2 - 150]] as const) for (let z = z0, i = 0; z + 450 <= z1; z += 450, i++) for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {   // the quoins: long and short by turns
    const lx = (i + (sx * sy > 0 ? 0 : 1)) % 2 ? 620 : 380, ly = 1000 - lx, x0 = cx + sx * (h + 35), y0 = sy * (h + 35);
    b.box(Math.min(x0, x0 - sx * lx), Math.max(x0, x0 - sx * lx), Math.min(y0, y0 - sy * ly), Math.max(y0, y0 - sy * ly), z + 15, z + 435); }
  band(70, ZS, ZS + 90); band(110, ZS + 90, ZS + 220);                                              // the string course
  band(80, Z2 - 150, Z2); band(190, Z2, Z2 + 130); band(120, Z2 + 130, Z2 + 230);                   // the lower cornice, under the clock
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) { const x0 = cx + sx * (h + 45), y0 = sy * (h + 45); b.box(Math.min(x0, x0 - sx * 420), Math.max(x0, x0 - sx * 420), Math.min(y0, y0 - sy * 420), Math.max(y0, y0 - sy * 420), Z2 + 230, Z3 - 420); }   // the clock stage's corner pilasters
  band(60, Z3 - 420, Z3 - 300);   // the frieze
  band(170, Z3 - 130, Z3); band(290, Z3, Z3 + 110); band(380, Z3 + 110, Z3 + 230);                  // the upper cornice
  // the door under its fanlight, and the slit windows, each in dressed stone
  b.mat(STONE, 0.2, 'render'); slab(0, -850, -600, h, h + 60, Z1, 3050); slab(0, 600, 850, h, h + 60, Z1, 3050); ring(0, 0, 3050, 600, 850, h + 60, h, 0, Math.PI, 10); slab(0, -110, 110, h, h + 100, 3640, 3960); slab(0, -700, 700, h, h + 90, Z1 - 60, Z1 + 60);
  b.mat(DARKG, 0.3, 'boards'); slab(0, -600, 600, h, h + 25, Z1 + 60, 3000); b.mat(STONE, 0.2, 'render'); slab(0, -600, 600, h, h + 45, 3000, 3070);   // the door, the transom
  b.mat(INK, 0.1); ring(0, 0, 3070, 0, 600, h + 4, h + 4, 0, Math.PI, 10); b.mat(GLASS, 0.5, 'glass'); ring(0, 0, 3070, 0, 600, h + 20, h + 20, 0, Math.PI, 10);   // the fanlight
  b.mat(CREAM, 0.3, 'boards'); slab(0, -25, 25, h, h + 40, 3070, 3660); for (const a of [Math.PI / 4, 3 * Math.PI / 4]) b.bar(at(0, 0, h + 30, 3070), at(0, Math.cos(a) * 590, h + 30, 3070 + Math.sin(a) * 590), 40);   // its bars
  b.mat(GILT, 0.8, 'metal'); slab(0, 380, 440, h + 25, h + 80, 1750, 1900);                          // the door's handle
  const slit = (k: number, z: number, w = 520, t = 1500) => { b.mat(STONE, 0.2, 'render'); slab(k, -w / 2 - 170, w / 2 + 170, h, h + 70, z - 150, z); slab(k, -w / 2 - 150, w / 2 + 150, h, h + 55, z + t, z + t + 230);
    b.mat(INK, 0.1); slab(k, -w / 2, w / 2, h, h + 4, z, z + t); b.mat(GLASS, 0.5, 'glass'); slab(k, -w / 2, w / 2, h + 4, h + 18, z, z + t); b.mat(CREAM, 0.3, 'boards'); slab(k, -22, 22, h, h + 32, z, z + t); };
  for (let k = 0; k < 4; k++) { if (k) slit(k, 2000); slit(k, 6300); }
  // the clock: on each side a stone ring, a white dial, twelve batons (the quarters heavier) and the hands, at ten past ten
  const ZC = (Z2 + 230 + Z3 - 420) / 2, RD = 1020;
  for (let k = 0; k < 4; k++) { const D = h + 60, pt = (r: number, a: number, w: number, d: number): V => at(k, Math.sin(a) * r + Math.cos(a) * w, d, ZC + Math.cos(a) * r - Math.sin(a) * w);
    b.mat(STONE, 0.2, 'render'); ring(k, 0, ZC, RD, RD + 190, h + 130, h, 0, Math.PI * 2, 16); b.mat(DIAL, 0.3, 'plain'); ring(k, 0, ZC, 0, RD, D, D, 0, Math.PI * 2, 16);
    b.mat(INK, 0.15, 'plain'); ring(k, 0, ZC, RD - 40, RD, D + 14, D + 14, 0, Math.PI * 2, 16);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, w = i % 3 ? 34 : 62, r0 = i % 3 ? RD - 300 : RD - 340; b.quad(pt(r0, a, -w, D + 14), pt(r0, a, w, D + 14), pt(RD - 90, a, w, D + 14), pt(RD - 90, a, -w, D + 14)); }
    const hand = (a: number, len: number, w: number, d: number) => b.quad(pt(-len * 0.18, a, -w, d), pt(-len * 0.18, a, w, d), pt(len, a, w * 0.45, d), pt(len, a, -w * 0.45, d));
    hand((10 + 10 / 60) / 12 * Math.PI * 2, RD * 0.56, 62, D + 30); hand(10 / 60 * Math.PI * 2, RD * 0.84, 44, D + 44);
    b.mat(GILT, 0.8, 'metal'); ring(k, 0, ZC, 0, 75, D + 58, D + 30, 0, Math.PI * 2, 8); }
  // the lead flat over the cornice, the belfry (a boarded timber lantern, louvred each side) and its eaves
  b.mat(LEAD, 0.4, 'sheet').loft([[h + 380, Z3 + 230], [1500, ZB]].map(([r, z]) => [[cx - r!, -r!, z!], [cx + r!, -r!, z!], [cx + r!, r!, z!], [cx - r!, r!, z!]] as V[]));
  const hb = 1350;   // the belfry's half-width
  b.mat(INK, 0.05).box(cx - hb + 60, cx + hb - 60, -hb + 60, hb - 60, ZB, ZL);                        // the dark inside
  b.mat(CREAM, 0.3, 'boards').box(cx - hb, cx + hb, -hb, hb, ZB, ZB + 380).box(cx - hb, cx + hb, -hb, hb, ZL - 300, ZL);   // the boarding below and above the louvres
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) { const x0 = cx + sx * (hb + 30), y0 = sy * (hb + 30); b.box(Math.min(x0, x0 - sx * 330), Math.max(x0, x0 - sx * 330), Math.min(y0, y0 - sy * 330), Math.max(y0, y0 - sy * 330), ZB, ZL); }   // the corner posts
  for (let k = 0; k < 4; k++) { b.mat(CREAM, 0.3, 'boards'); slab(k, -45, 45, hb - 30, hb + 20, ZB + 380, ZL - 300);   // the mullion
    b.mat(DARKG, 0.3, 'boards'); for (let z = ZB + 400; z + 150 < ZL - 300; z += 190) b.quad(at(k, -hb + 300, hb - 110, z + 170), at(k, hb - 300, hb - 110, z + 170), at(k, hb - 300, hb + 10, z), at(k, -hb + 300, hb + 10, z)); }   // the louvres, sloping out
  b.mat(CREAM, 0.3, 'boards').box(cx - hb - 110, cx + hb + 110, -hb - 110, hb + 110, ZL, ZL + 110).box(cx - hb - 230, cx + hb + 230, -hb - 230, hb + 230, ZL + 110, ZL + 220);   // the eaves' mouldings
  // the copper roof, an ogee on a square plan, green with age; the gilt ball, the vane's arms and its arrow
  const ogee: [number, number][] = [[hb + 290, ZL + 220], [hb + 230, ZL + 330], [1330, ZL + 520], [1060, ZL + 760], [720, ZL + 1020], [430, ZL + 1330], [260, ZL + 1700], [150, ZL + 2100], [90, ZL + 2300]];
  b.mat(COPPER, 0.3, 'sheet').loft(ogee.map(([r, z]) => [[cx - r, -r, z], [cx + r, -r, z], [cx + r, r, z], [cx - r, r, z]] as V[]));
  const ZF = ZL + 2300, turnZ = (prof: [number, number][], seg = 8) => b.loft(prof.map(([z, r]) => Array.from({ length: seg }, (_, i) => { const t = i / seg * Math.PI * 2; return [cx + Math.cos(t) * r, Math.sin(t) * r, z] as V; })));
  b.mat(COPPER, 0.3, 'sheet'); turnZ([[ZF - 40, 130], [ZF + 60, 150], [ZF + 120, 70]]);
  b.mat(GILT, 0.8, 'metal'); turnZ([[ZF + 120, 40], [ZF + 200, 150], [ZF + 330, 200], [ZF + 460, 150], [ZF + 540, 40]]);   // the ball
  b.mat(INK, 0.3, 'metal').bar([cx, 0, ZF + 500], [cx, 0, ZF + 1900], 50).bar([cx - 420, 0, ZF + 900], [cx + 420, 0, ZF + 900], 36).bar([cx, -420, ZF + 900], [cx, 420, ZF + 900], 36);   // the spindle and the four points
  b.mat(GILT, 0.8, 'metal'); { const z = ZF + 1500, y = 0, q = (x0: number, z0: number, x1: number, z1: number, x2: number, z2: number) => b.tri([cx + x0, y, z + z0], [cx + x1, y, z + z1], [cx + x2, y, z + z2]);
    b.bar([cx - 620, y, z], [cx + 520, y, z], 44); q(-620, 0, -900, 0, -620, 130); q(-620, 0, -900, 0, -620, -130); q(520, 0, 900, 260, 760, 0); q(520, 0, 900, -260, 760, 0); }   // the arrow: a head, a swallow tail
  return b.mesh(S); }
/** the timing box: a timber hut on legs above the line, windows all round, steps up the back */
export function timingBox(): Mesh { const b = new Build(), L = 5000, D = 3000, F = 2600, H = 2600;
  b.mat(DARKG, 0.3, 'boards'); for (const x of [200, L - 200]) for (const y of [-D / 2 + 200, D / 2 - 200]) b.box(x - 120, x + 120, y - 120, y + 120, 0, F);
  b.mat(CREAM, 0.3, 'boards').box(0, L, -D / 2, D / 2, F, F + 900).box(0, L, -D / 2, D / 2, F + H - 300, F + H);
  b.mat(GLASS, 0.5, 'glass').box(100, L - 100, -D / 2 + 60, D / 2 - 60, F + 900, F + H - 300); b.mat('#4a4540', 0.1).box(300, L - 300, -D / 2 + 300, D / 2 - 300, F, F + H - 400);   // the room seen through
  b.mat(GREEN, 0.3, 'boards'); for (let x = 0; x <= L; x += L / 4) b.box(x - 60, x + 60, -D / 2 - 10, D / 2 + 10, F + 900, F + H - 300);
  b.mat(ROOF, 0.4, 'corrugated').loft([[-300, 0, 0], [L + 300, 0, 0]].map(([x]) => [[x!, -D / 2 - 400, F + H], [x!, D / 2 + 400, F + H], [x!, 0, F + H + 900]] as V[]));
  b.mat(WOOD, 0.2, 'timber'); for (let k = 0; k < 8; k++) b.box(L - 1000, L - 200, D / 2 + k * 260, D / 2 + k * 260 + 280, 0, F - k * F / 8);   // the stair
  return b.mesh(L); }
/** the scoreboard: a black board of number frames on a timber gantry, a name board above */
export function scoreboard(): Mesh { const b = new Build(), L = 12000, Z = 2200, H = 4800;
  b.mat(WOOD, 0.2, 'timber'); for (let x = 600; x < L; x += 3600) b.box(x - 150, x + 150, -150, 150, 0, Z + H + 900).bar([x, 0, 0], [x, 1800, 0], 200).bar([x, 0, Z + H], [x, 1800, 0], 160);
  b.mat(DARK, 0.15, 'boards').box(0, L, -200, 0, Z, Z + H);
  b.mat(WHITE, 0.3, 'plain'); for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) { const x = 500 + c * 1120, z = Z + 400 + r * 1080; if ((r * 7 + c * 3) % 5 < 3) b.box(x, x + 700, -260, -200, z, z + 760); }   // the hung numbers
  b.mat(CREAM, 0.3, 'boards').box(1500, L - 1500, -260, -60, Z + H + 300, Z + H + 1300); b.mat(RED, 0.3, 'boards').box(1800, L - 1800, -300, -260, Z + H + 500, Z + H + 1100);
  return b.mesh(L); }
/** the Members' Bridge: one abutment (a concrete pier with a balustrade, stairs up); stood each side of the track */
/** H: its height to the deck (mm): taller where it stands on the low side of a banking (review 113) */
export function bridgeAbutment(H = 5800): Mesh { const b = new Build(), L = 7000, D = 3000;
  b.mat(CONCRETE, 0.25, 'concrete').box(0, L, -D / 2, D / 2, 0, H).box(0, L, -D / 2 - 200, D / 2 + 200, H, H + 400);
  b.mat('#8f8a82', 0.2, 'concrete'); for (let k = 0; k < 10; k++) b.box(L - 2000 - k * 400, L - 1600 - k * 400, D / 2, D / 2 + 1600, 0, H - k * H / 10);   // the steps beside it
  b.mat(CONCRETE, 0.25, 'concrete'); for (let x = 200; x < L; x += 600) b.box(x, x + 180, -D / 2 - 150, -D / 2 + 50, H + 400, H + 1300); b.box(0, L, -D / 2 - 200, -D / 2 + 100, H + 1300, H + 1500);
  return b.mesh(L); }
/** the Members' Bridge deck: a 13 m span piece of the beam and footway over the track, from its underside at z = 0 (stood at the deck's height above the cars) */
export function bridgeDeck(): Mesh { const b = new Build(), L = 13000, D = 3000;
  b.mat(CONCRETE, 0.25, 'concrete').box(0, L, -D / 2, D / 2, 0, 900); b.mat('#8b867e', 0.2, 'concrete').box(0, L, -D / 2 - 250, -D / 2, 300, 900).box(0, L, D / 2, D / 2 + 250, 300, 900);
  b.mat(CONCRETE, 0.25, 'concrete'); for (let x = 200; x < L; x += 600) for (const y of [-D / 2 - 100, D / 2 - 80]) b.box(x, x + 180, y, y + 180, 900, 1800); b.box(0, L, -D / 2 - 200, -D / 2 + 50, 1800, 2000).box(0, L, D / 2 - 50, D / 2 + 200, 1800, 2000);
  b.mat(WHITE, 0.3, 'boards').box(L / 2 - 2500, L / 2 + 2500, -D / 2 - 300, -D / 2 - 250, 350, 850); b.mat(GREEN, 0.3, 'boards').box(L / 2 - 2300, L / 2 + 2300, -D / 2 - 320, -D / 2 - 300, 450, 750);   // the sign: green on white
  return b.mesh(L); }
