// Millbrook's surroundings filled out (review 181, the site plan of review 165): the things the plan adds round the
// course, as low-poly meshes in the cars' manner (render/car/mesh.ts) and the axes of render/props/stands.ts: x along
// the length from 0 to `length`, y across (the front faces -y), z up; the anchor the middle of the length at y = 0, z = 0.
// The advertising boards (fictional firms of the period, lettered in a painted block face), a marshal's post with its
// flag board, a marquee, park benches, cast-iron street lamps, flagpoles, a notice board, a flower bed in a stone kerb,
// a low brick wall with a stone coping, a white post-and-rail fence, bunting on a cord, and a parked car of the period
// at a light detail (the game's own car meshes, their shape gathered into fewer faces).
import { Build, type Mesh, type V } from '../car/mesh';
import { MESH_CARS } from '../car/meshcars';
import { teaHut } from './paddock';

const CREAM = '#ddd3bb', WOOD = '#8a6a48', DARKG = '#2c3f2a', GREEN = '#3f5a3c', WHITE = '#efeee8', RED = '#9d3329', IRON = '#2f3134', GLASS = '#9fb6c0', STONE = '#cfc3a6', BRICK = '#96593f', SOIL = '#4a3a2c';

// ---- the boards' lettering: a block face, five by seven, each row's runs of ink one quad ----
const GLYPH: Record<string, string> = {
  A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110', D: '11110100011000110001100011000111110',
  E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000', G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001',
  I: '01110001000010000100001000010001110', J: '00111000100001000010000101001001100', K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
  M: '10001110111010110101100011000110001', N: '10001100011100110101100111000110001', O: '01110100011000110001100011000101110', P: '11110100011000111110100001000010000',
  Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001', S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100',
  U: '10001100011000110001100011000101110', V: '10001100011000110001100010101000100', W: '10001100011000110101101011010101010', X: '10001100010101000100010101000110001',
  Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111', "'": '00100001000100000000000000000000000', '&': '01100100101010001000101011001001101',
  '.': '00000000000000000000000000110001100', '-': '00000000000000011111000000000000000' };
/** a line of lettering on a face at y (facing -y), centred on xc, its foot at z0, `h` tall; the face is drawn mirrored
 *  (placeMesh), so the text runs toward -x to read left to right from in front */
function letter(b: Build, text: string, xc: number, z0: number, h: number, y: number, maxW: number): void {
  const px0 = h / 7, n = text.length, wide = n * 6 - 1, px = Math.min(px0, maxW / wide), x0 = xc + wide * px / 2, zb = z0 + (h - 7 * px) / 2;
  for (let i = 0; i < n; i++) { const g = GLYPH[text[i]!.toUpperCase()]; if (!g) continue; const gx = x0 - i * 6 * px;
    for (let r = 0; r < 7; r++) { let c = 0; while (c < 5) { if (g[r * 5 + c] !== '1') { c++; continue; } let e = c; while (e < 5 && g[r * 5 + e] === '1') e++;
      const xa = gx - c * px, xb = gx - e * px, za = zb + (6 - r) * px, zt = za + px; b.quad([xa, y, za], [xb, y, za], [xb, y, zt], [xa, y, zt]); c = e; } } } }

/** the firms on the boards (fictional, of the period): the name, the goods, the board's colour, the ink */
export const BRANDS: { name: string; goods: string; face: string; ink: string }[] = [
  { name: 'MERRIDALE', goods: 'TYRES', face: '#2f4a35', ink: '#efe6cc' }, { name: 'PELHAM', goods: 'SPARKING PLUGS', face: '#e9dfc4', ink: '#a8322a' },
  { name: 'KESTREL', goods: 'MOTOR OIL', face: '#203b66', ink: '#e2b23a' }, { name: 'ROYSTON', goods: 'PETROL', face: '#9d2f28', ink: '#efe6cc' },
  { name: "ASHBY'S", goods: 'TEA', face: '#e0b84a', ink: '#3b2a1e' }, { name: 'WEYCROFT', goods: 'ALES', face: '#5e2430', ink: '#efe6cc' },
  { name: 'TOLLAND', goods: 'BATTERIES', face: '#d9822b', ink: '#1d1d1f' }, { name: 'CORBEL', goods: 'LAMPS', face: '#ecebe4', ink: '#203b66' }];
/** an advertising board, 7 m: a painted face lettered with a firm's name and its goods, a border, timber legs stayed behind */
export function adBoard(arg = 0): Mesh { const b = new Build(), L = 7000, Z0 = 900, Z1 = 3300, B = BRANDS[((arg % BRANDS.length) + BRANDS.length) % BRANDS.length]!;
  b.mat(WOOD, 0.2, 'timber'); for (const x of [600, L / 2, L - 600]) b.box(x - 80, x + 80, 0, 160, 0, Z1 + 80).bar([x, 160, Z1 - 500], [x, 1700, 0], 120);
  b.mat('#75593d', 0.15, 'timber').box(0, L, -60, 0, Z0, Z1);
  b.mat(B.ink, 0.3, 'boards').box(-50, L + 50, -100, -60, Z0 - 50, Z1 + 50);            // the border
  b.mat(B.face, 0.3, 'boards').box(120, L - 120, -120, -100, Z0 + 120, Z1 - 120);        // the face
  b.mat(B.ink, 0.3, 'boards'); letter(b, B.name, L / 2, Z0 + 1050, 950, -132, L - 700); letter(b, B.goods, L / 2, Z0 + 320, 560, -132, L - 900);
  b.box(500, L - 500, -132, -120, Z0 + 960, Z0 + 1010);                                   // a rule between
  return b.mesh(L); }

/** a marshal's post, 3 m: a timber hut open to the track under a sloping roof, and beside it the flag board on two posts, its flags rolled in their slots */
export function marshalPost(): Mesh { const b = new Build(), L = 3000;
  b.mat(CREAM, 0.3, 'boards').box(0, 80, 0, 1400, 0, 2200).box(1520, 1600, 0, 1400, 0, 2200).box(0, 1600, 1320, 1400, 0, 2300).box(0, 1600, 0, 80, 0, 950);   // the walls, the front low
  b.mat(WOOD, 0.2, 'timber').box(0, 1600, -40, 120, 950, 1020);                           // the ledge
  b.mat('#4a4d52', 0.35, 'sheet').loft([-150, 1750].map(x => [[x, -300, 2200], [x, 1600, 2450], [x, 1600, 2520], [x, -300, 2270]] as V[]));   // the roof
  b.mat(WOOD, 0.2, 'timber').box(2000, 2080, 200, 280, 0, 2300).box(2900, 2980, 200, 280, 0, 2300);   // the flag board's posts
  b.mat(DARKG, 0.3, 'boards').box(1950, 3030, 140, 200, 1100, 2250);                     // the board
  const flags = ['#e6c22e', '#2c5aa0', '#c8302a', '#3a7a3a', '#efeee8', '#1d1d1f'];
  flags.forEach((c, k) => { const x = 2050 + (k % 3) * 330, z = k < 3 ? 1800 : 1300; b.mat(c, 0.2, 'canvas').box(x, x + 260, 90, 140, z, z + 320); });
  b.mat(WHITE, 0.3, 'boards').box(1950, 3030, 130, 140, 2120, 2250);                     // a white top rail
  return b.mesh(L); }

/** a marquee, 10 m by 8 (arg 0), or a refreshment kiosk (arg 1, the tea hut's kind): striped canvas on poles, a scalloped valance, open sides */
export function marquee(arg = 0): Mesh { if (arg === 1) return teaHut(); const b = new Build(), L = 10000, D = 8000, E = 2300, R = 1800, S = 1000;
  b.mat('#b7b2a6', 0.3, 'metal'); for (const x of [0, L / 2, L]) for (const y of [0, D]) b.bar([x, y, 0], [x, y, E], 70); b.bar([0, D / 2, 0], [0, D / 2, E + R], 90).bar([L, D / 2, 0], [L, D / 2, E + R], 90);
  for (let k = 0; k < L / S; k++) { const x0 = k * S, x1 = x0 + S; b.mat(k % 2 ? '#efe9da' : '#b04a3a', 0.15, 'canvas');
    b.quad([x0, -150, E - 50], [x1, -150, E - 50], [x1, D / 2, E + R], [x0, D / 2, E + R]).quad([x0, D / 2, E + R], [x1, D / 2, E + R], [x1, D + 150, E - 50], [x0, D + 150, E - 50]);
    for (const y of [-150, D + 150]) b.tri([x0, y, E - 50], [x1, y, E - 50], [(x0 + x1) / 2, y, E - 450]); }
  for (const x of [0, L]) { b.mat('#efe9da', 0.15, 'canvas').tri([x, -150, E - 50], [x, D + 150, E - 50], [x, D / 2, E + R]); }   // the gables
  b.mat(WOOD, 0.2, 'timber').box(1500, L - 1500, D / 2 - 400, D / 2 + 400, 700, 760); for (const x of [1600, L - 1600]) b.box(x - 40, x + 40, D / 2 - 300, D / 2 + 300, 0, 700);   // a trestle table
  b.mat(RED, 0.3, 'canvas').tri([L / 2 - 40, D / 2, E + R + 700], [L / 2 - 40, D / 2, E + R + 300], [L / 2 + 700, D / 2, E + R + 500]); b.mat('#b7b2a6', 0.3, 'metal').bar([L / 2, D / 2, E + R], [L / 2, D / 2, E + R + 750], 40);   // a pennant
  return b.mesh(L); }

/** a park bench, 1.8 m: cast-iron ends, a slatted seat and back, painted green */
export function parkBench(): Mesh { const b = new Build(), L = 1800;
  b.mat(IRON, 0.4, 'metal'); for (const x of [80, L - 80]) { b.bar([x, -250, 0], [x, -200, 430], 50).bar([x, 250, 0], [x, 220, 430], 50).bar([x, -260, 430], [x, 260, 430], 60).bar([x, 230, 430], [x, 330, 850], 50); }
  b.mat('#3c5a3a', 0.3, 'timber'); for (let k = 0; k < 4; k++) b.box(0, L, -250 + k * 125, -150 + k * 125, 430, 470);
  for (let k = 0; k < 3; k++) { const z = 550 + k * 110, y = 250 + (z - 430) * 0.2; b.box(0, L, y, y + 40, z, z + 80); }
  return b.mesh(L); }

/** a cast-iron street lamp, 3.9 m: a stepped base, a fluted post, a ladder bar, a four-paned lantern and its cap */
export function streetLamp(): Mesh { const b = new Build(), L = 600, X = L / 2;
  b.mat(IRON, 0.45, 'metal').box(X - 220, X + 220, -220, 220, 0, 250).box(X - 160, X + 160, -160, 160, 250, 600);
  b.bar([X, 0, 600], [X, 0, 3100], 110).bar([X - 300, 0, 2900], [X + 300, 0, 2900], 40);
  b.box(X - 170, X + 170, -170, 170, 3100, 3180); b.mat('#f2dc9a', 0.6, 'glass').box(X - 150, X + 150, -150, 150, 3180, 3600);   // the panes
  b.mat(IRON, 0.45, 'metal'); for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.bar([X + dx! * 155, dy! * 155, 3180], [X + dx! * 155, dy! * 155, 3600], 25);
  b.loft([[[X - 210, -210, 3600], [X + 210, -210, 3600], [X + 210, 210, 3600], [X - 210, 210, 3600]], [[X - 40, -40, 3880], [X + 40, -40, 3880], [X + 40, 40, 3880], [X - 40, 40, 3880]]]);
  return b.mesh(L); }

/** a flagpole, 9 m: white, a gilt ball, a flag flying (arg: 0 red with a white cross band, 1 blue with a gold disc, 2 cream with a green band; club flags) */
export function flagpole(arg = 0): Mesh { const b = new Build(), L = 400, X = L / 2, H = 9000;
  b.mat(WHITE, 0.4, 'paint').bar([X, 0, 0], [X, 0, H], 120, 120).mat('#c9a646', 0.8, 'metal').box(X - 90, X + 90, -90, 90, H, H + 180);
  const cols = [['#b8302a', '#efeee8'], ['#20407a', '#d8b344'], ['#e6dcc0', '#3f6a3c']][((arg % 3) + 3) % 3]!, FW = 1800, FH = 1150, z1 = H - 200, z0 = z1 - FH;
  const wave = (t: number) => Math.sin(t * Math.PI * 1.6) * 180 * t;
  b.mat(cols[0]!, 0.2, 'canvas'); for (let k = 0; k < 6; k++) { const t0 = k / 6, t1 = (k + 1) / 6, xa = X - t0 * FW, xb = X - t1 * FW; b.quad([xa, wave(t0), z0], [xb, wave(t1), z0], [xb, wave(t1), z1], [xa, wave(t0), z1]); }
  b.mat(cols[1]!, 0.2, 'canvas'); for (let k = 0; k < 6; k++) { const t0 = k / 6, t1 = (k + 1) / 6, xa = X - t0 * FW, xb = X - t1 * FW, d = 12; b.quad([xa, wave(t0) - d, z0 + FH * 0.38], [xb, wave(t1) - d, z0 + FH * 0.38], [xb, wave(t1) - d, z0 + FH * 0.62], [xa, wave(t0) - d, z0 + FH * 0.62]); }
  return b.mesh(L); }

/** a notice board, 2 m: two posts, a cream board ruled with the day's notices, a little gabled roof */
export function noticeBoard(): Mesh { const b = new Build(), L = 2000;
  b.mat(DARKG, 0.3, 'timber').box(100, 200, 0, 100, 0, 2300).box(L - 200, L - 100, 0, 100, 0, 2300).box(0, L, -40, 100, 1000, 2100);
  b.mat(CREAM, 0.3, 'boards').box(120, L - 120, -60, -40, 1100, 2000);
  b.mat('#3b3a3d', 0.2, 'boards'); for (let k = 0; k < 6; k++) { const z = 1250 + k * 120; b.box(300, L - 300 - (k % 3) * 200, -64, -60, z, z + 40); }
  b.mat('#c8302a', 0.2, 'boards').box(300, 700, -64, -60, 1900, 1960);
  b.mat('#4a4d52', 0.35, 'sheet').loft([-100, L + 100].map(x => [[x, -300, 2150], [x, 30, 2400], [x, 360, 2150], [x, 360, 2210], [x, 30, 2460], [x, -300, 2210]] as V[]));
  return b.mesh(L); }

/** a flower bed, 12 m by 6: an oval of dark earth in a stone kerb, rings of flowers (red, pink, yellow, white) */
export function flowerBed(): Mesh { const b = new Build(), L = 12000, X = L / 2, RX = 6000, RY = 3000, N = 24;
  const ring = (k: number, z: number): V[] => Array.from({ length: N }, (_, i) => { const t = i / N * Math.PI * 2; return [X + Math.cos(t) * RX * k, Math.sin(t) * RY * k, z]; });
  b.mat(STONE, 0.25, 'render').loft([ring(1.03, 0), ring(1.03, 180), ring(0.97, 180), ring(0.97, 60)], false);
  b.mat(SOIL, 0.1, 'plain'); { const c: V = [X, 0, 90], r = ring(0.97, 60); for (let i = 0; i < N; i++) b.tri(c, r[i]!, r[(i + 1) % N]!); }
  const cols = ['#c8303a', '#d8607a', '#e2c040', '#efe9dc'], h = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  for (const [k, ci] of [[0.82, 0], [0.62, 1], [0.42, 2], [0.2, 3]] as const) { b.mat(cols[ci]!, 0.15, 'canvas'); const n = Math.round(30 * k) + 4;
    for (let i = 0; i < n; i++) { const t = (i + h(i + ci * 50) * 0.5) / n * Math.PI * 2, x = X + Math.cos(t) * RX * k, y = Math.sin(t) * RY * k, s = 230 + h(i * 3 + ci) * 120, z = 60 + 200 + h(i + 7) * 120;
      b.loft([[[x - s, y - s, 60], [x + s, y - s, 60], [x + s, y + s, 60], [x - s, y + s, 60]], [[x - s * 0.8, y - s * 0.8, z], [x + s * 0.8, y - s * 0.8, z], [x + s * 0.8, y + s * 0.8, z], [x - s * 0.8, y + s * 0.8, z]]]); } }
  return b.mesh(L); }

/** a low brick wall `arg` mm long (default 6 m): 0.8 m of red brick, a stone coping, a pier every 3 m and at each end */
export function lowWall(arg = 6000): Mesh { const b = new Build(), L = Math.max(500, arg), T = 340;
  b.mat(BRICK, 0.2, 'brick').box(0, L, -T / 2, T / 2, 0, 760); const n = Math.max(1, Math.round(L / 3000));
  for (let k = 0; k <= n; k++) { const x = Math.min(L - 220, Math.max(220, k * L / n)); b.box(x - 220, x + 220, -T / 2 - 60, T / 2 + 60, 0, 920); }
  b.mat(STONE, 0.25, 'render').box(-30, L + 30, -T / 2 - 40, T / 2 + 40, 760, 840);
  for (let k = 0; k <= n; k++) { const x = Math.min(L - 220, Math.max(220, k * L / n)); b.box(x - 250, x + 250, -T / 2 - 90, T / 2 + 90, 920, 1000); }
  return b.mesh(L); }

/** a post-and-rail fence `arg` mm long (default 10 m), painted white: a post every 2.5 m, two rails */
export function railFence(arg = 10000): Mesh { const b = new Build(), L = Math.max(500, arg); b.mat('#e8e3d6', 0.3, 'paint');
  const n = Math.max(1, Math.round(L / 2500)); for (let k = 0; k <= n; k++) { const x = k * L / n; b.bar([x, 0, 0], [x, 0, 1100], 90, 90); }
  b.bar([0, 0, 1000], [L, 0, 1000], 45, 90).bar([0, 0, 550], [L, 0, 550], 45, 90); return b.mesh(L); }

/** bunting `arg` mm long (default 10 m): a slim pole at the start, a cord sagging to the next pole, pennants red, cream and blue */
export function bunting(arg = 10000): Mesh { const b = new Build(), L = Math.max(1000, arg), H = 2900;
  b.mat(WHITE, 0.3, 'paint').bar([0, 0, 0], [0, 0, H + 100], 60); const z = (x: number) => H - 450 * Math.sin(Math.PI * x / L);
  b.mat('#6b6458', 0.2).bar([0, 0, H], [L / 2, 0, z(L / 2)], 12).bar([L / 2, 0, z(L / 2)], [L, 0, H], 12);
  const cols = ['#c8302a', '#efe9da', '#2c5aa0', '#e2b23a'], n = Math.floor(L / 550);
  for (let k = 0; k < n; k++) { const x0 = 150 + k * 550, x1 = x0 + 400, za = z(x0) - 15, zb = z(x1) - 15; b.mat(cols[k % cols.length]!, 0.15, 'canvas').tri([x0, 0, za], [x1, 0, zb], [(x0 + x1) / 2, 0, (za + zb) / 2 - 420]); }
  return b.mesh(L); }

/** the period cars that park at the course (the game's own 1920s and 1930s cars) */
export const PARKED = ['buick28', 'willys27', 'dodgeV28', 'pontiac29', 'plymU29', 'chevAB28', 'fordT23', 'bmw315', 'dueA21', 'fnTT33', 'dueSSJ35'];
/** a mesh at a light detail: its corners gathered on a grid `cell` mm (each gathering at the mean of its corners), the
 *  faces that fold away dropped; the colours, gloss and kinds of the faces kept */
export function lighten(M: Mesh, cell: number): Mesh { const n = M.pos.length / 9, key = (i: number) => `${Math.round(M.pos[i]! / cell)},${Math.round(M.pos[i + 1]! / cell)},${Math.round(M.pos[i + 2]! / cell)},${M.kind[Math.floor(i / 9)]! === 5 ? 1 : 0}`;
  const sum = new Map<string, [number, number, number, number]>(); for (let i = 0; i < M.pos.length; i += 3) { const k = key(i), s = sum.get(k) ?? [0, 0, 0, 0]; s[0] += M.pos[i]!; s[1] += M.pos[i + 1]!; s[2] += M.pos[i + 2]!; s[3]++; sum.set(k, s); }
  const keep: number[] = [], seen = new Set<string>(); for (let t = 0; t < n; t++) { const a = key(t * 9), b = key(t * 9 + 3), c = key(t * 9 + 6); if (a === b || b === c || a === c) continue; const id = [a, b, c].sort().join('|'); if (seen.has(id)) continue; seen.add(id); keep.push(t); }
  const pos = new Float32Array(keep.length * 9), col = new Uint8Array(keep.length * 3), gloss = new Float32Array(keep.length), part = new Int16Array(keep.length), kind = new Uint8Array(keep.length), tex = new Uint8Array(keep.length);
  keep.forEach((t, j) => { for (let v = 0; v < 3; v++) { const s = sum.get(key(t * 9 + v * 3))!; pos[j * 9 + v * 3] = s[0] / s[3]; pos[j * 9 + v * 3 + 1] = s[1] / s[3]; pos[j * 9 + v * 3 + 2] = s[2] / s[3]; }
    col.set(M.col.subarray(t * 3, t * 3 + 3), j * 3); gloss[j] = M.gloss[t]!; part[j] = M.part[t]!; kind[j] = M.kind[t]!; tex[j] = M.tex[t]!; });
  return { n: keep.length, pos, col, gloss, part, kind, tex, length: M.length, names: M.names }; }
const parked = new Map<number, Mesh>();
/** a parked car of the period (arg: which of PARKED), at a light detail; made once */
export function parkedCar(arg = 0): Mesh { const k = ((arg % PARKED.length) + PARKED.length) % PARKED.length; let m = parked.get(k);
  if (!m) { const e = MESH_CARS.find(c => c.id === PARKED[k])!; m = lighten(e.mesh(0), 150); parked.set(k, m); } return m; }
