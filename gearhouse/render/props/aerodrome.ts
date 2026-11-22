// The aerodrome inside the Millbrook motor course and the trees round it (docs/systems/71_track_props.md): a hangar bay,
// an aircraft works bay, a parked biplane, a windsock, three trees, a bush, straw bales. Low-poly meshes in the cars'
// manner (render/car/mesh.ts). Each prop's own axes: x along its length from 0 to its `length`, y across (its front
// faces -y), z up; its anchor is the middle of its length at y = 0, z = 0.
import { Build, section, type Mesh, type V } from '../car/mesh';

const CREAM = '#ddd3bb', GREEN = '#3f5a3c', DARKG = '#2c3f2a', WOOD = '#8a6a48', DARK = '#26242a', WHITE = '#efeee8', RED = '#9d3329', CONCRETE = '#a7a29a', IRON = '#4a4d52', GLASS = '#9fb6c0';
const BRICK = '#96593f', BRICK2 = '#84503a', SLATE = '#4b5057', SILVER = '#c6c7c0', STRAW = '#d3b668', STRAW2 = '#c4a65a';
/** a number 0..1 from a seed: the same every time, so a tree is the same tree in every bake */
const rnd = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
/** a faceted lump (a crown, a bush): rings of `seg` points round an ellipsoid, each point pushed in or out a little */
function blob(b: Build, c: V, r: V, seed: number, seg = 6, lats = [-0.75, -0.2, 0.35, 0.85]): void {
  b.loft(lats.map((s, j) => { const w = Math.sqrt(1 - s * s); return Array.from({ length: seg }, (_, i): V => { const t = (i + (j % 2) * 0.5) / seg * Math.PI * 2, k = 0.84 + 0.32 * rnd(seed + j * 17 + i * 3.3);
    return [c[0] + Math.cos(t) * r[0] * w * k, c[1] + Math.sin(t) * r[1] * w * k, c[2] + s * r[2] * (0.94 + 0.12 * rnd(seed + j * 5 + i))]; }); })); }

/** one 15 m bay of the big hangar: a barrel roof of corrugated iron on iron walls, the sliding doors part open on the dark inside; bays stand side by side */
export function hangarBay(): Mesh { const b = new Build(), L = 15000, D = 22000, H = 6000, RISE = 3600, N = 14, DH = 5400;
  const arch = (i: number): [number, number] => { const t = i / N * Math.PI; return [L / 2 - L / 2 * Math.cos(t), H + RISE * Math.sin(t)]; };
  b.mat('#a2a8a0', 0.3, 'metal').box(0, 160, 0, D, 0, H).box(L - 160, L, 0, D, 0, H).box(0, L, D - 160, D, 0, H);   // the side and back walls
  b.mat(CREAM, 0.3, 'paint').box(0, 900, -60, 160, 0, H).box(L - 900, L, -60, 160, 0, H).box(900, L - 900, -60, 160, DH + 250, H);   // the front's piers and lintel
  for (const y of [-60, D]) for (let i = 0; i < N; i++) { const [x0, z0] = arch(i), [x1, z1] = arch(i + 1); b.quad([x0, y, H], [x1, y, H], [x1, y, z1], [x0, y, z0]); }   // the gables under the arch
  b.mat(GREEN, 0.3, 'paint').box(L / 2 - 2600, L / 2 + 2600, -110, -60, H + 900, H + 2000); b.mat(CREAM, 0.3, 'paint').box(L / 2 - 2400, L / 2 + 2400, -130, -110, H + 1080, H + 1820);   // a plain name board
  b.mat(DARK, 0.05).box(900, L - 900, 0, 700, 0, DH + 250);                                  // the dark inside
  b.mat(IRON, 0.4, 'metal').box(300, L - 300, -330, -60, DH, DH + 250);                      // the door rail
  for (const [x, y] of [[900, -150], [2000, -260], [L - 4200, -150], [L - 5300, -260]] as const) { const w = 3300;   // four leaves, pushed back in pairs
    b.mat(y < -200 ? GREEN : DARKG, 0.35, 'paint').box(x, x + w, y, y + 90, 0, DH);
    b.mat(DARK, 0.1).box(x + 300, x + w - 300, y - 15, y, 3000, 4300); b.mat(GLASS, 0.5, 'glass').box(x + 300, x + w - 300, y - 30, y - 15, 3000, 4300);
    b.mat(CREAM, 0.3, 'paint').box(x + w / 2 - 50, x + w / 2 + 50, y - 45, y - 30, 3000, 4300).box(x + 300, x + w - 300, y - 45, y - 30, 3610, 3690); }
  for (let i = 0; i < N; i++) { const [x0, z0] = arch(i), [x1, z1] = arch(i + 1); b.mat(i % 2 ? '#a3abac' : '#b3bbbc', 0.4, 'metal').quad([x0, D + 200, z0], [x1, D + 200, z1], [x1, -500, z1], [x0, -500, z0]); }   // the roof sheets
  b.mat(DARKG, 0.3, 'paint'); for (let i = 0; i < N; i++) { const [x0, z0] = arch(i), [x1, z1] = arch(i + 1); b.quad([x0, -510, z0 - 350], [x1, -510, z1 - 350], [x1, -510, z1], [x0, -510, z0]); }   // the barge board
  return b.mesh(L); }

/** one 15 m bay of the aircraft works: brick walls and tall windows under three teeth of a saw-tooth north-light roof (glass on the steep faces, slate on the long ones) */
export function factoryBay(): Mesh { const b = new Build(), L = 15000, D = 14000, H = 5600, T = L / 3, UP = 2400, RUN = 1000;
  b.mat(BRICK, 0.2, 'paint').box(0, L, 0, 300, 0, H).box(0, L, D - 300, D, 0, H).box(0, 300, 0, D, 0, H).box(L - 300, L, 0, D, 0, H);
  for (const y of [0, D]) for (let k = 0; k < 3; k++) b.tri([k * T, y, H], [k * T + T, y, H], [k * T + RUN, y, H + UP]);   // the gables of the teeth
  b.mat(BRICK2, 0.2, 'paint').box(0, L, -70, 0, 0, 600); for (let x = 0; x <= L; x += 3000) b.box(Math.max(0, x - 260), Math.min(L, x + 260), -70, 0, 600, H);   // the plinth and piers
  b.mat(CREAM, 0.3, 'paint').box(0, L, -110, 20, H - 150, H + 150);                          // the stone band at the eaves
  for (let x = 600; x < L; x += 3000) { const w = 1800, z0 = 1500, z1 = 4300;                // the windows
    b.mat(DARK, 0.1).box(x, x + w, -20, 0, z0, z1); b.mat(GLASS, 0.5, 'glass').box(x, x + w, -40, -20, z0, z1);
    b.mat(CREAM, 0.3, 'paint').box(x + w / 2 - 45, x + w / 2 + 45, -60, -40, z0, z1).box(x, x + w, -60, -40, z0 + 880, z0 + 960).box(x, x + w, -60, -40, z0 + 1840, z0 + 1920).box(x - 120, x + w + 120, -110, 0, z0 - 160, z0).box(x - 120, x + w + 120, -90, 0, z1, z1 + 220); }
  b.mat(GREEN, 0.35, 'paint').box(L - 2000, L - 800, -60, 0, 0, 1300);                        // a low hatch door under the last window
  for (let k = 0; k < 3; k++) { const x = k * T, f = (y: number, s: number, o = 0): V => [x + RUN * s + o, y, H + UP * s];
    b.mat(SLATE, 0.25, 'plain').quad([x + RUN, -250, H + UP], [x + T, -250, H], [x + T, D + 250, H], [x + RUN, D + 250, H + UP]);   // the slates
    b.mat(DARK, 0.1).quad(f(0, 0.12, 20), f(D, 0.12, 20), f(D, 0.92, 20), f(0, 0.92, 20)); b.mat(GLASS, 0.5, 'glass').quad(f(0, 0.12), f(D, 0.12), f(D, 0.92), f(0, 0.92));   // the north light
    b.mat(CREAM, 0.3, 'paint').quad(f(-250, 0), f(D + 250, 0), f(D + 250, 0.12), f(-250, 0.12)).quad(f(-250, 0.92), f(D + 250, 0.92), f(D + 250, 1), f(-250, 1));
    for (let y = 0; y <= D; y += 2000) b.bar(f(y, 0.12, -30), f(y, 0.92, -30), 110); }
  b.mat(IRON, 0.4, 'metal'); for (const x of [T, 2 * T]) b.box(x - 90, x + 90, -260, -70, 0, H + 100);   // the valleys' downpipes
  return b.mesh(L); }

/** a parked biplane, about 8 m: a two-seat trainer with a radial engine, silver fabric wings in two bays of struts, a red fuselage, sitting back on its tailskid */
export function biplane(): Mesh { const b = new Build(), FUS = '#8d2f2b';
  const wing = (x0: number, c: number, z: number, half: number, dih: number, t = 100): void => { b.loft([-half, -half + 450, -half / 2, 0, half / 2, half - 450, half].map(y => { const tip = Math.abs(y) === half, x = x0 + (tip ? c * 0.22 : 0), cc = tip ? c * 0.6 : c, zz = z + Math.abs(y) * dih;
    return [[x, y, zz], [x + cc * 0.3, y, zz + t], [x + cc, y, zz + t * 0.3], [x + cc * 0.3, y, zz - t * 0.3]] as V[]; })); };
  b.mat(FUS, 0.3, 'canvas').loft([section(520, 400, -430, 440, 2.4, 3, 8), section(2200, 430, -480, 500, 2.6, 4, 8), section(4000, 380, -430, 470, 2.6, 4, 8), section(6400, 170, -180, 330, 2.6, 4, 8), section(7700, 40, 20, 240, 2.6, 4, 8)]);
  b.mat('#b9bbb6', 0.6, 'metal').lathe('x', [0, 0, 0], [[380, 300], [560, 420]], 8).lathe('x', [0, 0, 0], [[150, 110], [380, 300]], 8);   // the nose plate and crankcase
  b.mat('#3a3b3f', 0.3, 'metal'); for (let k = 0; k < 7; k++) { const t = k / 7 * Math.PI * 2 + 0.2; b.bar([330, Math.sin(t) * 180, Math.cos(t) * 180], [330, Math.sin(t) * 560, Math.cos(t) * 560], 190); }   // seven cylinders
  b.mat(WOOD, 0.4, 'wood').bar([110, -760, -660], [110, 760, 660], 70, 190); b.mat('#b9bbb6', 0.7, 'metal').lathe('x', [0, 0, 0], [[0, 40], [150, 120]], 6);   // the airscrew and its boss
  b.mat(SILVER, 0.35, 'canvas'); wing(900, 1450, 1380, 4600, 0.03); b.mat(SILVER, 0.35, 'canvas'); wing(1500, 1400, -400, 4300, 0.07);
  b.mat(SILVER, 0.35, 'canvas').loft([-1500, -900, 0, 900, 1500].map(y => { const a = Math.abs(y), x0 = 6450 + a * 0.35, x1 = a === 1500 ? 7600 : 7850; return [[x0, y, 190], [x0 + 300, y, 235], [x1, y, 200], [x0 + 300, y, 160]] as V[]; }));   // the tailplane
  b.mat(FUS, 0.3, 'canvas').loft([-25, 25].map(y => ([[6350, 250], [6900, 1050], [7350, 1300], [7800, 1200], [8000, 750], [7900, 60], [7600, 180]] as const).map(([x, z]): V => [x, y, z])));   // the fin and rudder
  b.mat(DARK, 0.05).box(2500, 3050, -250, 250, 380, 512).box(3550, 4100, -240, 240, 370, 492);   // the two cockpits
  b.mat(GLASS, 0.5, 'glass').quad([2480, -230, 500], [2480, 230, 500], [2380, 180, 700], [2380, -180, 700]).quad([3530, -220, 480], [3530, 220, 480], [3430, 170, 680], [3430, -170, 680]);
  b.mat('#b8b6ad', 0.3, 'paint'); for (const s of [-1, 1]) { for (const y of [2050, 3850]) b.bar([1250, s * y, 1380 + y * 0.03], [1850, s * y, -360 + y * 0.07], 70, 110).bar([2050, s * y, 1400 + y * 0.03], [2650, s * y, -350 + y * 0.07], 70, 110);   // two bays of struts
    b.bar([1250, s * 340, 1400], [1100, s * 380, 380], 60, 90).bar([2050, s * 340, 1410], [2150, s * 400, 420], 60, 90);                       // the cabane
    b.bar([1050, s * 380, -400], [1500, s * 820, -1380], 70, 100).bar([2000, s * 380, -430], [1500, s * 820, -1380], 70, 100); }             // the undercarriage legs
  b.bar([1500, -900, -1380], [1500, 900, -1380], 70);
  for (const s of [-1, 1]) { b.mat('#232224', 0.05).lathe('y', [1500, s * 940, -1400], [[-65, 190], [-65, 330], [65, 330], [65, 190]], 10); b.mat('#b9bbb6', 0.5, 'metal').lathe('y', [1500, s * 940, -1400], [[-80, 0], [-80, 200], [80, 200], [80, 0]], 10, false); }
  b.mat(IRON, 0.3, 'metal').bar([7250, 0, 60], [7650, 0, -450], 70);                         // the tailskid
  const M = b.mesh(0), p = M.pos, a = Math.atan2(1280, 6150), ca = Math.cos(a), sa = Math.sin(a); let x0 = Infinity, x1 = -Infinity, z0 = Infinity;   // set down on its wheels and skid
  for (let i = 0; i < p.length; i += 3) { const x = p[i]!, z = p[i + 2]!; p[i] = x * ca + z * sa; p[i + 2] = z * ca - x * sa; x0 = Math.min(x0, p[i]!); x1 = Math.max(x1, p[i]!); z0 = Math.min(z0, p[i + 2]!); }
  for (let i = 0; i < p.length; i += 3) { p[i] = p[i]! - x0; p[i + 2] = p[i + 2]! - z0; }
  return { ...M, length: Math.round(x1 - x0) }; }

/** the windsock: a white mast on a concrete foot (the anchor is the mast), the red-and-white sock flying out along +x */
export function windsock(): Mesh { const b = new Build(), L = 1200, X = L / 2, H = 8000;
  b.mat(CONCRETE, 0.2, 'paint').box(X - 500, X + 500, -500, 500, 0, 250);
  b.mat(WHITE, 0.35, 'paint').loft([[130, 0], [100, 3000], [70, H]].map(([r, z]) => [[X - r!, -r!, z!], [X + r!, -r!, z!], [X + r!, r!, z!], [X - r!, r!, z!]] as V[]));
  b.mat(RED, 0.3, 'paint').box(X - 125, X + 125, -125, 125, 900, 1900);
  b.mat(IRON, 0.4, 'metal').bar([X, 0, H - 500], [X + 500, 0, H - 500], 50).lathe('x', [X + 260, 0, H - 500], [[0, 500], [60, 500]], 8, false);   // the swivel arm and hoop
  const st: [number, number, number][] = [[260, 500, 0], [900, 440, -60], [1500, 380, -160], [2100, 320, -300], [2700, 260, -480], [3200, 220, -680]];   // [along, radius, droop]
  for (let k = 0; k + 1 < st.length; k++) { const A = st[k]!, B = st[k + 1]!, ring = (s: [number, number, number]): V[] => Array.from({ length: 8 }, (_, i) => { const t = i / 8 * Math.PI * 2; return [X + s[0], Math.cos(t) * s[1], H - 500 + s[2] + Math.sin(t) * s[1]] as V; });
    b.mat(k % 2 ? WHITE : '#c8452e', 0.25, 'canvas').loft([ring(A), ring(B)], false); }
  b.mat(DARK, 0.05).loft([st[st.length - 1]!].map(s => Array.from({ length: 8 }, (_, i) => { const t = i / 8 * Math.PI * 2; return [X + s[0] - 10, Math.cos(t) * s[1] * 0.9, H - 500 + s[2] + Math.sin(t) * s[1] * 0.9] as V; })));   // the open tail
  return b.mesh(L); }

/** a round-headed tree (oak, elm), 12 m: a short trunk and three faceted lumps of crown */
export function treeRound(): Mesh { const b = new Build(), L = 9000, X = L / 2;
  b.mat('#5d4a38', 0.15, 'wood').bar([X, 0, 0], [X + 150, 0, 5200], 620, 560).bar([X + 100, 0, 3600], [X - 1500, 500, 6000], 300).bar([X + 100, 0, 3800], [X + 1700, -400, 6200], 300);
  b.mat('#4c6b35', 0.15, 'canvas'); blob(b, [X - 1500, 600, 6800], [3000, 2900, 2900], 3, 7);
  b.mat('#3f5c2e', 0.15, 'canvas'); blob(b, [X + 1700, -500, 7000], [2800, 2900, 2800], 11, 7);
  b.mat('#587a3c', 0.15, 'canvas'); blob(b, [X + 100, 200, 9000], [3300, 3200, 3000], 23, 7);
  return b.mesh(L); }

/** a poplar, 17 m: a tall narrow spire of leaf almost to the ground */
export function treePoplar(): Mesh { const b = new Build(), L = 3600, X = L / 2;
  b.mat('#5a4c3c', 0.15, 'wood').bar([X, 0, 0], [X, 0, 3000], 420);
  const prof: [number, number][] = [[1400, 500], [3200, 1500], [6500, 1800], [10500, 1600], [14000, 1100], [16200, 550], [17000, 120]];
  b.mat('#4a6a34', 0.15, 'canvas').loft(prof.map(([z, r], j) => Array.from({ length: 6 }, (_, i): V => { const t = (i + (j % 2) * 0.5) / 6 * Math.PI * 2, k = 0.82 + 0.36 * rnd(j * 13 + i * 2.1); return [X + Math.cos(t) * r * k, Math.sin(t) * r * k, z + 500 * (rnd(j * 7 + i) - 0.5)]; })));
  return b.mesh(L); }

/** a Scots pine, 15 m: a tall bare reddish trunk, flat dark heads of needles at the top */
export function treePine(): Mesh { const b = new Build(), L = 7000, X = L / 2;
  b.mat('#8a5a40', 0.15, 'wood').loft([[260, 0, 0], [200, 150, 7000], [110, -100, 13000]].map(([r, dx, z]) => [[X + dx! - r!, -r!, z!], [X + dx! + r!, -r!, z!], [X + dx! + r!, r!, z!], [X + dx! - r!, r!, z!]] as V[]));
  b.bar([X + 150, 0, 8200], [X - 1900, 300, 10600], 200).bar([X + 100, 0, 9600], [X + 2000, -300, 11600], 200).bar([X + 150, 0, 6500], [X + 1500, 500, 7300], 150);
  const flat = [-0.7, -0.15, 0.4, 0.85];
  b.mat('#2f4b3a', 0.15, 'canvas'); blob(b, [X - 1900, 300, 11200], [1900, 1800, 1000], 5, 6, flat);
  b.mat('#28423a', 0.15, 'canvas'); blob(b, [X + 1900, -300, 12200], [2000, 1900, 1100], 31, 6, flat);
  b.mat('#36533c', 0.15, 'canvas'); blob(b, [X - 100, 0, 13800], [2600, 2400, 1300], 47, 6, flat);
  return b.mesh(L); }

/** a bush or a length of hedge, 4 m: three low lumps */
export function bush(): Mesh { const b = new Build(), L = 4000;
  b.mat('#3d5a30', 0.15, 'canvas'); blob(b, [900, 0, 650], [950, 900, 800], 61, 6);
  b.mat('#4a6a36', 0.15, 'canvas'); blob(b, [2050, 100, 800], [1200, 1050, 1000], 67, 6);
  b.mat('#42602f', 0.15, 'canvas'); blob(b, [3150, -50, 600], [900, 850, 750], 73, 6);
  return b.mesh(L); }

/** straw bales on a corner, 3.3 m: three in a row, two on top, one lying in front; each tied with two strings */
export function hayBales(): Mesh { const b = new Build(), L = 3300, BL = 1050, BW = 480, BH = 380;
  const bale = (x: number, y: number, z: number, k: number, along = true): void => { const lx = along ? BL : BW, ly = along ? BW : BL;
    b.mat(k % 2 ? STRAW : STRAW2, 0.1, 'canvas').box(x, x + lx, y, y + ly, z, z + BH);
    b.mat('#b39750', 0.1); for (const f of [0.28, 0.72]) along ? b.box(x + lx * f - 30, x + lx * f + 30, y - 12, y + ly + 12, z, z + BH + 12) : b.box(x - 12, x + lx + 12, y + ly * f - 30, y + ly * f + 30, z, z + BH + 12); };
  for (let k = 0; k < 3; k++) bale(40 + k * (BL + 35), 0, 0, k);
  bale(600, 20, BH, 1); bale(600 + BL + 40, -10, BH, 2);
  bale(1700, -560, 0, 0);
  return b.mesh(L); }
