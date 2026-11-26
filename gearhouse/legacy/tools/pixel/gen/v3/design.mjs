// Parametric body designer (stage A). ONE design record in millimetres drives the side, front and rear views.
// Ranges come from the measured cars (1930-49 replicas) and real extremes; nothing outside them can be drawn.
// Front/rear details are half-specs mirrored by the renderer -> headlamps, tail lamps, guards are always symmetric.
import { fillet, arc } from '../geom.mjs';
import { tire } from '../tire.mjs';
import { chassisUnder } from '../chassis.mjs';

const circ = (cy, cz, r, n = 18) => Array.from({ length: n }, (_, k) => [cy + Math.cos(k / n * 6.283) * r, cz + Math.sin(k / n * 6.283) * r]);
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// ---- era ranges (mm / deg), interpolated by year; [min, max] measured across the replicas + real extremes ----
const KEYS = {
  1930: { rake: [0, 8], roof: [1680, 1957], belt: [0.70, 0.78], hood: [0.66, 0.74], noseRound: [20, 80], crown: [40, 160], cabin: [1250, 2300] },
  1935: { rake: [4, 24], roof: [1580, 1900], belt: [0.66, 0.75], hood: [0.62, 0.72], noseRound: [40, 260], crown: [80, 320], cabin: [1250, 2400] },
  1940: { rake: [18, 40], roof: [1500, 1850], belt: [0.63, 0.72], hood: [0.60, 0.70], noseRound: [120, 420], crown: [160, 460], cabin: [1250, 2600] },
  1949: { rake: [28, 46], roof: [1480, 1800], belt: [0.62, 0.70], hood: [0.60, 0.69], noseRound: [180, 480], crown: [220, 520], cabin: [1250, 2700] } };
export function ranges(year) { const ks = Object.keys(KEYS).map(Number); let a = ks[0], b = ks[ks.length - 1]; for (const k of ks) { if (k <= year) a = k; if (k >= year && b >= k) b = k; }
  const A = KEYS[a], B = KEYS[b], t = b === a ? 0 : (year - a) / (b - a); return Object.fromEntries(Object.keys(A).map(k => [k, [lerp(A[k][0], B[k][0], t), lerp(A[k][1], B[k][1], t)]])); }
export const OPTIONS = {   // option lists with first year available (from the reference photos / catalogues)
  frontFender: [['separate', 1930], ['valanced', 1933], ['pontoonF', 1936], ['integrated', 1946]], rearFender: [['separate', 1930], ['skirted', 1938], ['integrated', 1946]],
  tail: [['upright', 1930], ['bustle', 1933], ['fastback', 1934], ['trunk', 1936]], grille: [['shell', 1930], ['vee', 1933], ['waterfall', 1934], ['prow', 1937], ['wide', 1939], ['teeth', 1940], ['bars', 1941], ['spinner', 1949]],
  gpattern: [['vbar', 1930], ['hbar', 1932], ['eggcrate', 1937], ['mesh', 1930]], lamp: [['stanchion', 1930], ['pod', 1934], ['fender', 1938]], tailLamp: [['bracket', 1930], ['fenderPod', 1935], ['bodyFlush', 1940]],
  wheel: [['wire', 1930], ['artillery', 1930], ['disc', 1932], ['steel', 1935], ['hubcap', 1935]], spare: [['rear', 1930], ['side', 1930], ['trunk', 1936]], rearWindow: [['single', 1930], ['split', 1935], ['wide', 1940]] };
export const optionsFor = (k, year) => OPTIONS[k].filter(([, y]) => y <= year).map(([n]) => n);

// ---- defaults: a 1930 family sedan measured on the town-sedan blueprint ----
export function newDesign(year = 1930, type = 'sedan4d') {
  const late = year >= 1938;
  return { year, type, wb: late ? 2900 : 2630, frontOH: late ? 780 : 560, rearOH: late ? 1150 : 760, width: late ? 1780 : 1700, tire: year < 1933 ? '4.75-19' : year < 1936 ? '5.50-17' : '6.00-16',
    roof: late ? 1720 : 1830, belt: late ? 0.67 : 0.74, hood: late ? 0.66 : 0.71, rake: late ? 26 : 4, cabin: type === 'coupe2d' ? 1450 : 2150, cowl: late ? 1000 : 820, noseRound: late ? 220 : 40, crown: late ? 300 : 90,
    tail: late ? 'trunk' : 'upright', deck: 0.62, frontFender: late ? 'pontoonF' : 'separate', rearFender: 'separate', fenderCrown: late ? 140 : 90, board: !late, doors: type === 'coupe2d' ? 2 : 4, frontDoor: 900,
    pillarB: 110, vent: year >= 1937, splitScreen: year >= 1934 && year < 1946, louvres: late ? 0 : 9, spear: late, spare: late ? 'trunk' : 'rear', wheel: late ? 'steel' : 'wire', whitewall: late ? 0.3 : 0,
    grille: late ? 'teeth' : 'shell', gpattern: late ? 'vbar' : 'vbar', grilleW: late ? 0.62 : 0.34, grilleH: late ? 0.42 : 0.62, lamp: late ? 'fender' : 'stanchion', lampR: late ? 95 : 120, lampY: late ? 0.78 : 0.46, lampZ: late ? 0.58 : 0.66,
    bumperBars: late ? 1 : 2, guards: late ? 2 : 0, fog: false, ornament: true, tailLamp: late ? 'fenderPod' : 'bracket', tailY: 0.8, rearWindow: late ? 'split' : 'single', paint: 'PAINT', fenderBlack: !late, roofTone: !late };
}
// keep every value inside the era / measured window (returns notes for anything clamped)
export function clampDesign(d) {
  const R = ranges(d.year), n = [], c = (k, lo, hi) => { const v = clamp(d[k], lo, hi); if (Math.abs(v - d[k]) > 1e-6) n.push(k); d[k] = v; };
  c('rake', ...R.rake); c('roof', ...R.roof); c('belt', ...R.belt); c('hood', ...R.hood); c('noseRound', ...R.noseRound); c('crown', ...R.crown); c('cabin', Math.max(R.cabin[0], d.type === 'coupe2d' ? 1200 : 1800), d.type === 'coupe2d' ? 1700 : R.cabin[1]);
  c('wb', 1867, 4430); c('width', 1146, 2215); c('frontOH', 380, 1400); c('rearOH', 300, 1700); c('cowl', 500, d.wb * 0.55); c('frontDoor', 800, 1150);
  for (const k of ['frontFender', 'rearFender', 'tail', 'grille', 'gpattern', 'lamp', 'tailLamp', 'wheel', 'spare', 'rearWindow']) { const map = { frontFender: 'frontFender', rearFender: 'rearFender', tail: 'tail', grille: 'grille', gpattern: 'gpattern', lamp: 'lamp', tailLamp: 'tailLamp', wheel: 'wheel', spare: 'spare', rearWindow: 'rearWindow' }; const ok = optionsFor(map[k], d.year); if (!ok.includes(d[k])) { n.push(k); d[k] = ok[ok.length - 1]; } }
  if (d.frontFender === 'integrated') { d.board = false; d.rearFender = 'integrated'; } if (d.rearFender === 'integrated' && d.frontFender === 'separate') d.rearFender = 'separate';
  return n; }

// ---- side view spec for buildCar ----
export function sideSpec(d0, paint) {
  const d = { ...d0 }; clampDesign(d); const T = tire(d.tire), r = T.r, gap = r + 70, F = d.frontOH, Rx = F + d.wb, tailX = Rx + d.rearOH, H = d.roof;
  const beltZ = H * d.belt, hoodZ = H * d.hood, sill = d.frontFender === 'integrated' ? 300 : Math.max(r * 1.15, 420), noseX = 0;
  const cowlX = F + d.cowl, rk = d.rake * Math.PI / 180, wsTopX = cowlX + Math.tan(rk) * (H - 70 - beltZ), roofF = wsTopX + 70, roofR = Math.min(tailX - 300, roofF + d.cabin - (wsTopX - cowlX));
  const P = []; // body outline, clockwise from the front bottom
  const noseZ = hoodZ - (d.grille === 'shell' ? 0 : 80);
  P.push([noseX + 40, sill, 0], [noseX, sill + 120, 30], [noseX, noseZ - 30, d.noseRound]);
  P.push([cowlX - 60, hoodZ, Math.min(400, d.noseRound * 1.5)], [cowlX, hoodZ + 10, 20], [wsTopX, H - 70, 40], [roofF, H, d.crown], [roofR, H, d.crown]);
  if (d.tail === 'upright') P.push([roofR + 40, beltZ, 60], [roofR + 60, sill + 80, 40], [roofR + 30, sill, 0]);
  else if (d.tail === 'fastback') P.push([tailX - 380, beltZ * 0.82, 600], [tailX, sill + 280, 300], [tailX - 40, sill, 0]);
  else if (d.tail === 'bustle') P.push([roofR + 160, beltZ + 20, 260], [tailX - 120, beltZ * 0.7, 300], [tailX, sill + 220, 200], [tailX - 60, sill, 0]);
  else { const deckZ = H * d.deck; P.push([roofR + 260, beltZ + 40, 220], [tailX - 260, deckZ, 260], [tailX, deckZ - 220, 180], [tailX - 30, sill + 60, 60], [tailX - 70, sill, 0]); }
  const body = fillet(P);
  const arches = [{ x: F, z: r, r: gap }, { x: Rx, z: r, r: gap }];
  // fenders (separate shapes with the wheel arc as inner edge)
  const fenders = [], fz = r + gap * 0.55, crownZ = Math.min(hoodZ - 60, r + gap + d.fenderCrown), fp = d.fenderBlack && d.year < 1936 ? 'black' : paint;
  if (d.frontFender !== 'integrated') { const tailF = d.frontFender === 'pontoonF' ? cowlX + 500 : F + gap + 650, low = d.board ? sill - 20 : sill + 60;
    const pts = [[F - gap * 1.25, fz - 60, 60], [F - gap * 0.85, crownZ - 60, 160], [F, crownZ, 220], [F + gap * 0.9, crownZ - (d.frontFender === 'pontoonF' ? 30 : 110), 200],
      [tailF, d.frontFender === 'pontoonF' ? beltZ * 0.7 : low + 40, d.frontFender === 'pontoonF' ? 260 : 120], [tailF + 40, low, 0], [F + gap + 40, low, 0], ...arc(F, r, gap + 4, gap + 4, 12, 168, 12), [F - gap * 1.2, r + 60, 0]];
    if (d.frontFender === 'valanced') pts.splice(1, 0, [F - gap * 1.15, r - 40, 40]);
    fenders.push({ paint: fp, wx: F, wz: r, wr: gap, smooth: 2, pts }); }
  if (d.rearFender !== 'integrated') { const low = d.board ? sill - 20 : sill + 30, sk = d.rearFender === 'skirted';
    fenders.push({ paint: fp, wx: Rx, wz: r, wr: sk ? 1 : gap, smooth: 2, pts: [[Rx - gap * 1.25, low, 0], [Rx - gap * 1.0, crownZ - 80, 200], [Rx, crownZ - 20, 260], [Rx + gap * 1.0, crownZ - 120, 200], [Rx + gap * 1.3, low + 120, 120], [Rx + gap * 1.2, r + 40, 0], ...(sk ? [[Rx - gap * 1.2, r + 40, 0]] : arc(Rx, r, gap + 4, gap + 4, 12, 168, 12))] }); }
  // glass from the body outline (window system v2), pillars from the cabin layout
  const bX = cowlX + 60 + d.frontDoor, cutX = d.tail === 'fastback' ? roofR - 40 : roofR - 60;
  const open = d.type === 'coupe2d' ? [[null, bX, {}], [bX, null, { cut: [[cutX, H - 90], [cutX + 120, beltZ]] }]] : [[null, bX, {}], [bX, null, { cut: [[cutX, H - 90], [cutX + 80, beltZ]] }]];
  const win = { belt: beltZ, open, B: d.pillarB, A: 80, C: 120, drip: d.year < 1936 ? 110 : 150, frame: d.year < 1935 ? 'reveal' : 'chrome', vent: d.vent ? cowlX + 220 : null, seats: [bX - 60, cutX - 220], wheel: cowlX + 230, seatH: 230 };
  const rearDoorEnd = Math.min(roofR - 80, Rx - gap), doors = [[[cowlX + 30, beltZ], [cowlX + 30, sill + 20]], [[bX, beltZ], [bX, sill + 20]]];
  if (d.doors === 4) doors.push([[rearDoorEnd, beltZ], [rearDoorEnd, Math.max(sill + 20, r + gap * 0.9)]]);
  // details: lamps, bumpers, boards, louvres, trims, spare, handles
  const lamps = [], parts = [], trim = [], spares = [];
  const lr = d.lampR, lz = d.lamp === 'stanchion' ? hoodZ * 0.86 : d.lamp === 'pod' ? crownZ + lr * 0.6 : crownZ - lr * 0.9, lx = d.lamp === 'stanchion' ? noseX + 140 : F - gap * 0.55;
  lamps.push({ e: [lx, lz, lr * 0.55, lr], ramp: 'lensW', bezel: 'chrome' });
  if (d.lamp === 'stanchion') parts.push({ pts: [[lx + 20, lz - lr], [lx + 50, lz - lr], [lx + 60, crownZ - 20], [lx + 30, crownZ - 20]], chrome: 1 });
  if (d.lamp === 'pod') parts.push({ pts: [[lx - lr * 0.4, lz - lr * 0.9], [lx + lr * 1.6, crownZ + 10, 0], [lx + lr * 1.6, crownZ - 10], [lx - lr * 0.4, crownZ]], ramp: paint === 'PAINT' ? 'black' : paint, base: 2, smooth: 1 });
  const tz = d.tailLamp === 'bracket' ? crownZ : d.tailLamp === 'fenderPod' ? crownZ - 40 : beltZ * 0.82; lamps.push({ e: [tailX - (d.tailLamp === 'bodyFlush' ? 20 : 90), tz, 30, 45], ramp: 'lensR', bezel: 'chrome' });
  const bz = Math.max(r + 40, sill - 10), bars = d.bumperBars, bh = d.year < 1936 ? 55 : 95;
  const bumperSets = [{ x0: -90, x1: 180, zs: bars === 2 ? [bz - 45, bz + 45] : [bz], h: bh, clamp: d.guards ? 120 : null, iron: [[140, bz], [F - gap * 0.4, bz + 40]] }, { x0: tailX - 160, x1: tailX + 80, zs: bars === 2 ? [bz - 45, bz + 45] : [bz], h: bh, clamp: d.guards ? tailX - 40 : null, iron: [[Rx + gap * 0.6, bz + 30], [tailX - 140, bz]] }];
  const boards = d.board ? [{ paint: 'rubber', pts: [[F + gap + 40, sill - 40], [Rx - gap * 1.2, sill - 40], [Rx - gap * 1.2, sill + 5], [F + gap + 40, sill + 5]] }] : [];
  const aprons = d.board ? [[[F + gap + 40, sill + 5], [Rx - gap * 1.2, sill + 5], [Rx - gap * 1.2, sill + 60], [F + gap + 40, sill + 60]]] : [];
  const louvres = d.louvres ? [{ x0: noseX + 260, x1: noseX + 260 + d.louvres * 55, step: 55, z0: hoodZ * 0.62, z1: hoodZ * 0.86 }] : [];
  if (d.spear) trim.push({ pts: [[noseX + 200, hoodZ * 0.8], [cowlX + 400, beltZ * 0.92], [Rx - gap, beltZ * 0.9]], w: 1 });
  trim.push({ pts: [[cowlX, beltZ - 10], [roofR + 100, beltZ - 10]], w: d.year >= 1937 ? 2 : 1 });
  if (d.spare === 'rear') { const sz = sill + r + 40; parts.push({ pts: fillet([[tailX - 10, sz - r, 80], [tailX + 150, sz - r, 80], [tailX + 150, sz + r, 80], [tailX - 10, sz + r, 80]]), ramp: 'rubber', base: 1 }, { pts: [[tailX - 30, sz - 40], [tailX + 10, sz - 40], [tailX + 10, sz + 40], [tailX - 30, sz + 40]], ramp: 'iron', base: 2 }); }   // rear spare seen edge-on
  if (d.spare === 'side') spares.push({ x: F + gap + 260, z: r + gap * 0.55 });
  const tone = d.roofTone ? [{ paint: 'black', pts: [[wsTopX - 120, H - 50], [wsTopX - 120, H + 200], [roofR + 200, H + 200], [roofR + 200, H - 50]], smooth: 0 }] : [];
  const W = { wire: { style: 'wire', spokes: 32 }, artillery: { style: 'artillery', paint: 'wood' }, disc: { style: 'disc', paint }, steel: { style: 'steel', paint }, hubcap: { style: 'hubcap' } }[d.wheel] || { style: 'steel', paint };
  return { id: 'v3', len: Math.ceil(tailX + 140), height: Math.ceil(H + 40), paint, lowZ: sill + 150, grad: [3.1, 1.4], glassStyle: 'period', body, arches, wheels: [{ x: F }, { x: Rx }], tire: d.tire,
    wheel: { ...W, whitewall: d.whitewall }, fenders, boards, aprons, win, glass: [], doors, lamps, parts, trim, louvres, bumperSets, spares, tone, handles: [[bX - 90, beltZ - 60]].concat(d.doors === 4 ? [[rearDoorEnd - 90, beltZ - 60]] : []),
    under: chassisUnder({ F, R: Rx, r, frameZ: Math.max(r + 120, sill - 60), front: noseX + 120, rear: tailX - 120, exhaustZ: r - 90 }),
    geo: { F, R: Rx, r, gap, noseX, tailX, cowlX, wsTopX, roofF, roofR, beltZ, hoodZ, sill, H, bX } };
}

// ---- front / rear half-specs for buildFront (mirrored => symmetric lamps, guards, grille) ----
export function frontSpec(d0, paint, rear = false) {
  const d = { ...d0 }; clampDesign(d); const T = tire(d.tire), r = T.r, gap = r + 70, Wd = d.width, half = Wd / 2, H = d.roof, beltZ = H * d.belt, hoodZ = H * d.hood;
  const sill = d.frontFender === 'integrated' ? 300 : Math.max(r * 1.15, 420), track = Wd - 300, tw = T.section * 1.05, ty = track / 2;
  const cab = half - (d.year < 1936 ? 80 : 120), tumble = d.year < 1936 ? 20 : 70, crownZ = Math.min(hoodZ - 60, r + gap + d.fenderCrown), fp = d.fenderBlack && d.year < 1936 ? 'black' : paint;
  const sep = d.frontFender !== 'integrated', hoodHalf = sep ? Math.min(half * 0.42, 260 + (d.year - 1930) * 8) : half - 60;
  const body = fillet([[0, sill - 40, 0], [cab, sill - 40, 0], [cab, beltZ, 0],   // cowl / door sides run full width down to the sill behind the fenders (no empty triangles beside the hood)
    [cab - tumble, H - 160, 120], [cab - tumble - 70, H, 80], [0, H, 0]]);
  const fin = d.year < 1936 ? ty - tw * 0.7 : hoodHalf + 30;                                         // 1930s narrow cycle-type wings -> 1940s wide fenders reaching the hood
  const fender = side => { const s = side; return fillet([[s * fin, sill - 80, 0], [s * fin, crownZ - (d.year < 1936 ? 140 : 60), 120], [s * ((fin + half) / 2), crownZ, d.year < 1936 ? 140 : 260], [s * (half - 10), crownZ - 120, 120], [s * half, sill - 60, 0]]); };
  const under = [{ half: 1, pts: [[0, r - 40], [ty, r - 40], [ty, r + 20], [0, r + 20]], ramp: 'black', base: 1 }];
  if (rear) under.push({ half: 1, pts: fillet([[0, sill - 40], [cab - 20, sill - 40, 0], [cab, beltZ - 40, 80], [0, beltZ, 0]]), ramp: paint, base: 2 });   // rear deck / body panel
  if (sep) { if (!rear) under.push({ half: 1, pts: fillet([[0, 380], [hoodHalf, 380], [hoodHalf + 10, hoodZ - 60, 0], [hoodHalf * 0.7, hoodZ, 160], [0, hoodZ + 15, 0]]), ramp: paint, base: 2 });
    under.push({ half: 0, pts: fender(1), ramp: fp, base: 2 }, { half: 0, pts: fender(-1), ramp: fp, base: 2 }); if (!rear) under.push({ half: 1, pts: [[hoodHalf, sill - 60], [ty - tw, sill - 60], [ty - tw, sill + 40], [hoodHalf, sill + 40]], ramp: 'black', base: 1 }); }
  else under.push({ half: 1, pts: fillet([[0, sill], [half - 10, sill, 0], [half, crownZ - 100, 120], [half - 60, hoodZ, 140], [0, hoodZ + 20, 0]]), ramp: paint, base: 2 });
  const glass = rear ? (d.rearWindow === 'split' ? [fillet([[30, beltZ + 140, 0], [cab * 0.42, beltZ + 140, 40], [cab * 0.4, H - 150, 50], [30, H - 150, 0]])] : [fillet([[0, beltZ + 150, 0], [cab * (d.rearWindow === 'wide' ? 0.62 : 0.42), beltZ + 150, 50], [cab * (d.rearWindow === 'wide' ? 0.58 : 0.38), H - 140, 60], [0, H - 140, 0]])])
    : (d.splitScreen ? [fillet([[25, beltZ + 30, 0], [cab - tumble - 60, beltZ + 30, 30], [cab - tumble - 90, H - 120, 40], [25, H - 120, 0]])] : [fillet([[0, beltZ + 30, 0], [cab - tumble - 60, beltZ + 30, 30], [cab - tumble - 90, H - 120, 40], [0, H - 120, 0]])]);
  const bz = Math.max(r + 40, sill - 10), bh = d.year < 1936 ? 55 : 95, bumpers = (d.bumperBars === 2 ? [bz - 45, bz + 45] : [bz]).map(z => ({ half: 1, pts: [[0, z - bh / 2], [half + 30, z - bh / 2], [half + 55, z], [half + 30, z + bh / 2], [0, z + bh / 2]], smooth: 0 }));
  const parts = [], lamps = [], grilles = [];
  if (d.guards) { const gy = d.guards === 3 ? [0, half * 0.45] : [half * 0.4]; for (const y of gy) parts.push({ half: y ? 0 : 1, pts: fillet([[y - 28, bz - bh], [y + 28, bz - bh], [y + 30, bz + bh * 1.4, 20], [y - 30, bz + bh * 1.4, 20]]), chrome: 1 }, ...(y ? [{ half: 0, pts: fillet([[-y - 28, bz - bh], [-y + 28, bz - bh], [-y + 30, bz + bh * 1.4, 20], [-y - 30, bz + bh * 1.4, 20]]), chrome: 1 }] : [])); }
  if (!rear) {
    const gw = Math.max(160, Math.min(half * 0.95, half * 2 * d.grilleW)) / 2 * (sep ? 1 : 1.8), gh = (hoodZ - bz) * d.grilleH, g0 = bz + bh * 0.7, g1 = Math.min(hoodZ - 20, g0 + gh * 1.6);
    const shape = { shell: [[0, g0, 0], [gw, g0, 30], [gw, g1 - 80, 60], [gw * 0.8, g1, 60], [0, g1, 0]], vee: [[0, g0 - 40, 30], [gw, g0, 40], [gw, g1 - 60, 80], [0, g1, 0]], waterfall: [[0, g0, 0], [gw, g0 + 40, 60], [gw * 0.9, g1 - 120, 220], [gw * 0.3, g1, 140], [0, g1, 0]],
      prow: [[0, g0, 0], [gw, g0 + 30, 60], [gw * 0.7, (g0 + g1) / 2, 200], [gw * 0.2, g1, 80], [0, g1, 0]], wide: [[0, g0, 0], [gw * 2.1, g0, 60], [gw * 2.1, g0 + gh * 0.7, 60], [0, g0 + gh * 0.75, 0]],
      teeth: [[0, g0, 0], [gw * 1.7, g0, 40], [gw * 1.6, g0 + gh * 0.9, 80], [0, g0 + gh, 0]], bars: [[0, g0, 0], [gw * 2.2, g0, 50], [gw * 2.2, g0 + gh * 0.6, 50], [0, g0 + gh * 0.65, 0]], spinner: [[0, g0, 0], [gw * 2.3, g0, 70], [gw * 2.3, g0 + gh * 0.55, 70], [0, g0 + gh * 0.6, 0]] }[d.grille];
    grilles.push({ half: 1, pattern: d.grille === 'teeth' ? 'vbar' : d.grille === 'wide' || d.grille === 'bars' || d.grille === 'spinner' ? 'hbar' : d.gpattern, bars: d.grille === 'shell' ? 'black' : 'chrome', surround: 'chrome', pts: fillet(shape) });
    if (d.grille === 'spinner') parts.push({ pts: circ(0, g0 + gh * 0.3, 90), chrome: 1 });
    // headlamps - one value, mirrored: stanchion (on the tie bar), pod (on the fender crown), fender (faired in)
    const ly = clamp(d.lampY * half, hoodHalf + d.lampR * 0.6, half - d.lampR * 0.7), lz = d.lamp === 'stanchion' ? clamp(d.lampZ * hoodZ, crownZ + 40, hoodZ) : d.lamp === 'pod' ? crownZ + d.lampR * 0.9 : crownZ - d.lampR * 0.6;
    lamps.push({ y: ly, z: lz, r: d.lampR, ramp: 'lensW', bezel: 'chrome' });
    if (d.lamp === 'stanchion') parts.push({ half: 1, pts: [[hoodHalf - 20, lz - d.lampR - 60], [ly, lz - d.lampR - 60], [ly, lz - d.lampR - 35], [hoodHalf - 20, lz - d.lampR - 35]], chrome: 1 });
    if (d.lamp === 'pod') parts.push({ half: 0, pts: fillet([[ly - d.lampR * 0.7, crownZ, 0], [ly + d.lampR * 0.7, crownZ, 0], [ly + d.lampR * 0.5, lz, 40], [ly - d.lampR * 0.5, lz, 40]]), ramp: fp, base: 2 }, { half: 0, pts: fillet([[-ly - d.lampR * 0.7, crownZ, 0], [-ly + d.lampR * 0.7, crownZ, 0], [-ly + d.lampR * 0.5, lz, 40], [-ly - d.lampR * 0.5, lz, 40]]), ramp: fp, base: 2 });
    if (d.fog) lamps.push({ y: half * 0.42, z: bz + bh + 90, r: 70, ramp: 'lensA', bezel: 'chrome' });
    if (d.ornament) parts.push({ pts: [[-18, hoodZ + 10], [18, hoodZ + 10], [8, hoodZ + 90], [-8, hoodZ + 90]], chrome: 1 });
    parts.push({ pts: [[-170, bz - 150], [170, bz - 150], [170, bz - 60], [-170, bz - 60]], ramp: 'white', base: 2 });                                  // plate
  } else {
    const ty2 = clamp(d.tailY * half, hoodHalf + 60, half - 60), tz = d.tailLamp === 'bracket' ? crownZ - 20 : d.tailLamp === 'fenderPod' ? crownZ - 60 : beltZ * 0.85;
    lamps.push({ y: ty2, z: tz, r: d.tailLamp === 'bodyFlush' ? 55 : 45, ramp: 'lensR', bezel: 'chrome' });
    if (d.spare === 'rear') parts.push({ pts: circ(0, r + 120 + r, r * 0.95, 24), ramp: 'rubber', base: 1 }, { pts: circ(0, r + 120 + r, r * 0.45), chrome: 1 });
    else parts.push({ half: 1, pts: fillet([[0, beltZ * 0.42, 0], [cab * 0.75, beltZ * 0.45, 60], [cab * 0.7, beltZ - 30, 120], [0, beltZ, 0]]), ramp: paint, base: 3 }, { pts: [[-40, beltZ * 0.66], [40, beltZ * 0.66], [40, beltZ * 0.7], [-40, beltZ * 0.7]], chrome: 1 });   // trunk lid + handle
    parts.push({ pts: [[-170, bz + 70], [170, bz + 70], [170, bz + 160], [-170, bz + 160]], ramp: 'white', base: 2 });
  }
  return { width: Wd + 120, height: H + 40, paint, lowZ: sill + 200, frame: d.year < 1935 ? 'reveal' : 'chrome', glassStyle: 'period', hood: sep ? { half: hoodHalf, top: hoodZ, bottom: 400 } : null, cowlZ: beltZ,
    tire: d.tire, track, hub: 40, body, tone: d.roofTone ? [[0, H - 60], [half, H - 60], [half, H + 200], [0, H + 200]] : null, tonePaint: 'black',
    glass, interior: rear ? [] : [[cab * 0.45, beltZ + 140, 160, 55]], under, grilles, bumpers, lamps, parts, wiper: rear ? null : [-cab * 0.6, H - 150, -cab * 0.2, H - 260], wheelIn: rear ? null : [cab * 0.42, beltZ + 140, 160] };
}
export const rearSpec = (d, paint) => frontSpec(d, paint, true);
