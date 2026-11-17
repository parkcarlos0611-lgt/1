// Parametric E1 body generator: design language (box | stream) + per-year limits + proportion clamps.
// Player-facing parameters are normalised; every one is clamped to the window the year/style allows.
import { fillet, arc, rrect } from './geom.mjs';
import { tire } from './tire.mjs';

// ---- era limits (from REFERENCE_ANALYSIS measurements; linear interpolation between key years) ----
// angles in degrees, radii in mm, ratios relative to wheelbase (WB) unless noted
const KEY = {
  box: {
    1930: { rake: [0, 6], roofR: [60, 220], noseR: [20, 60], bodyR: [40, 160], hWB: [0.60, 0.67], hoodWB: [0.38, 0.48], beltH: [0.72, 0.78], noseAhead: [0.02, 0.08], tail: ['upright', 'trunk'], fender: ['separate'], grille: ['flat'], glassRise: 0.12 },
    1935: { rake: [0, 14], roofR: [100, 320], noseR: [40, 160], bodyR: [80, 260], hWB: [0.55, 0.63], hoodWB: [0.38, 0.52], beltH: [0.70, 0.76], noseAhead: [0.03, 0.12], tail: ['upright', 'trunk', 'bustle'], fender: ['separate', 'valanced'], grille: ['flat', 'vee'], glassRise: 0.11 },
    1939: { rake: [6, 22], roofR: [160, 420], noseR: [80, 260], bodyR: [120, 340], hWB: [0.52, 0.60], hoodWB: [0.40, 0.55], beltH: [0.68, 0.74], noseAhead: [0.05, 0.16], tail: ['trunk', 'bustle'], fender: ['valanced', 'pontoonF'], grille: ['vee', 'waterfall'], glassRise: 0.11 },
  },
  stream: {
    1930: null, // streamline bodies not offered before 1933 (no deep-draw presses / research)
    1933: { rake: [14, 26], roofR: [200, 420], noseR: [120, 300], bodyR: [160, 360], hWB: [0.50, 0.58], hoodWB: [0.40, 0.50], beltH: [0.68, 0.74], noseAhead: [0.08, 0.18], tail: ['fastback', 'bustle'], fender: ['valanced', 'pontoonF'], grille: ['vee', 'waterfall'], glassRise: 0.10 },
    1936: { rake: [20, 36], roofR: [260, 520], noseR: [160, 380], bodyR: [220, 460], hWB: [0.46, 0.55], hoodWB: [0.42, 0.52], beltH: [0.66, 0.72], noseAhead: [0.12, 0.22], tail: ['fastback', 'bustle'], fender: ['pontoonF', 'skirted'], grille: ['waterfall', 'louvre'], glassRise: 0.10 },
    1939: { rake: [24, 42], roofR: [300, 600], noseR: [200, 460], bodyR: [260, 520], hWB: [0.45, 0.53], hoodWB: [0.42, 0.55], beltH: [0.64, 0.70], noseAhead: [0.14, 0.25], tail: ['fastback', 'bustle'], fender: ['pontoonF', 'skirted'], grille: ['waterfall', 'louvre'], glassRise: 0.10 },
  },
};
const lerp = (a, b, t) => a + (b - a) * t;
export function limits(year, style) {
  const tab = KEY[style]; const ys = Object.keys(tab).map(Number).filter(y => tab[y]).sort((a, b) => a - b);
  if (year < ys[0]) return null;                                     // style not yet available
  let a = ys[0], b = ys[ys.length - 1]; for (let i = 0; i + 1 < ys.length; i++) if (year >= ys[i] && year <= ys[i + 1]) { a = ys[i]; b = ys[i + 1]; }
  const A = tab[a], B = tab[b], t = b === a ? 0 : Math.min(1, Math.max(0, (year - a) / (b - a))), L = {};
  for (const k in A) L[k] = Array.isArray(A[k]) && typeof A[k][0] === 'number' ? [lerp(A[k][0], B[k][0], t), lerp(A[k][1], B[k][1], t)] : (t < 0.5 ? A[k] : B[k]);
  return L;
}

// Hard engineering rules independent of style (always enforced)
export const RULES = {
  minRoofOverSeat: 1000,     // seat cushion to roof (mm)
  seatZ: 520,                // seat height above floor-line reference
  minArchGap: 45,            // tyre to fender clearance
  minGround: 180,            // body bottom ground clearance
  maxGlassRakeFlat: 42,      // flat glass only in E1 -> V-split above 28 deg
};

// p: { year, style, type:'sedan4d'|'coupe2d', wb, tire, height, hood, rake, roofR, noseR, tail, fender, belt, ... } all 0..1 sliders except year/wb/tire/type
export function clampParams(p) {
  const L = limits(p.year, p.style), notes = [];
  if (!L) { const q = clampParams({ ...p, style: 'box' }); q.notes.unshift(`${p.style} not available in ${p.year} -> box`); return q; }
  const pick = (k, v) => { const [lo, hi] = L[k]; const x = lo + (hi - lo) * Math.min(1, Math.max(0, v)); if (v < 0 || v > 1) notes.push(`${k} clamped`); return x; };
  const choose = (k, v) => { if (L[k].includes(v)) return v; notes.push(`${k} ${v} not allowed in ${p.year} -> ${L[k][0]}`); return L[k][0]; };
  return {
    year: p.year, style: p.style, type: p.type || 'sedan4d', wb: p.wb, tire: p.tire,
    rake: pick('rake', p.rake ?? 0.5), roofR: pick('roofR', p.roofR ?? 0.5), noseR: pick('noseR', p.noseR ?? 0.5), bodyR: pick('bodyR', p.bodyR ?? 0.5),
    hWB: pick('hWB', p.height ?? 0.5), hoodWB: pick('hoodWB', p.hood ?? 0.5), beltH: pick('beltH', p.belt ?? 0.5), noseAhead: pick('noseAhead', p.nose ?? 0.5),
    tail: choose('tail', p.tail ?? L.tail[0]), fender: choose('fender', p.fender ?? L.fender[0]), grille: choose('grille', p.grille ?? L.grille[0]),
    glassRise: L.glassRise, paint: p.paint, fenderPaint: p.fenderPaint, notes,
  };
}

// Build a buildCar() spec from clamped params.
export function genBody(q) {
  const T = tire(q.tire), r = T.r, wb = q.wb, H = q.hWB * wb;
  const F = Math.round(q.noseAhead * wb + 380 + (q.style === 'stream' ? 120 : 0)), R = F + wb;
  const noseX = F - q.noseAhead * wb, hoodZ = H * (q.beltH + 0.02), beltZ = H * q.beltH;
  const cowlX = noseX + q.hoodWB * wb + 120, roofZ = H, rake = q.rake * Math.PI / 180;
  const wsTopX = cowlX + Math.tan(rake) * (roofZ - 60 - beltZ), roofFrontX = wsTopX + 60;
  // cabin length from body type; enforce seat + roof rules
  const cabin = q.type === 'coupe2d' ? 1180 : 1780; const roofRearX = Math.min(R + 200, roofFrontX + cabin);
  const sill = Math.max(RULES.minGround + 140, r * 1.25), bottom = q.fender === 'separate' ? sill : RULES.minGround + 160;
  const tailX = q.tail === 'fastback' ? R + 0.30 * wb : q.tail === 'trunk' || q.tail === 'bustle' ? R + 0.26 * wb : R + 0.20 * wb;
  const stream = q.style === 'stream';
  const glassTop = roofZ - (stream ? 150 : 110), glassBot = beltZ + 40;
  // ---- body outline ----
  const pts = [];
  pts.push([noseX + 40, bottom + 120, 0]);
  if (q.grille === 'flat') pts.push([noseX, bottom + 160, 0], [noseX, hoodZ - 40, q.noseR]);
  else pts.push([noseX - 30, bottom + 200, q.noseR * 0.5], [noseX + (stream ? 60 : 20), hoodZ - 40, q.noseR]);
  pts.push([noseX + 120, hoodZ, q.noseR * 0.6], [cowlX, hoodZ + 20, 0], [wsTopX, roofZ - 50, q.roofR * 0.4]);
  if (!stream) pts.push([wsTopX - 90, roofZ - 40, 0], [wsTopX - 60, roofZ, 40]);    // box: projecting visor
  pts.push([roofFrontX + 100, roofZ, q.roofR]);
  if (q.tail === 'fastback') {
    pts.push([roofRearX - 300, roofZ - 10, q.roofR], [tailX - 500, beltZ * 0.72, q.bodyR * 1.3], [tailX, bottom + 220, q.bodyR], [tailX - 60, bottom, 0]);
  } else {
    pts.push([roofRearX, roofZ, q.roofR], [roofRearX + (stream ? 220 : 40), glassBot, q.bodyR * 0.5]);
    if (q.tail === 'upright') pts.push([roofRearX + 60, bottom + 160, q.bodyR * 0.6], [roofRearX + 20, bottom, 0]);
    else if (q.type === 'coupe2d') pts.push([roofRearX + 420, beltZ - 60, q.bodyR * 1.4], [tailX - 120, beltZ * 0.62, q.bodyR * 1.2], [tailX, beltZ * 0.4, q.bodyR * 0.8], [tailX - 80, bottom, 0]);
    else pts.push([tailX - 240, beltZ - (q.tail === 'bustle' ? 40 : 0), q.bodyR], [tailX, beltZ * 0.55, q.bodyR], [tailX - 80, bottom, 0]);
  }
  pts.push([cowlX + 40, bottom, 0], [cowlX, bottom + 160, 0]);
  const body = fillet(pts);
  // ---- glass: front edge follows A-pillar rake, rear edge follows roof / quarter ----
  const aOff = Math.tan(rake) * (glassTop - glassBot);
  const g0 = cowlX + 90, gSplit = q.type === 'coupe2d' ? roofRearX - 340 : g0 + (roofRearX - g0) * 0.48;
  const rc = stream ? 90 : 45, glass = [fillet([[g0, glassBot, rc * 0.6], [g0 + aOff, glassTop, rc * 1.4], [gSplit - 50, glassTop, rc], [gSplit - 50, glassBot, rc * 0.6]])];
  const rearTop = q.tail === 'fastback' ? roofRearX - 360 : roofRearX - 120;
  glass.push(fillet([[gSplit + 50, glassBot, rc * 0.6], [gSplit + 50, glassTop, rc], [rearTop, glassTop, rc * (stream ? 2.2 : 1.6)], [rearTop + (stream ? 260 : 60), glassBot, rc * 0.6]]));
  // ---- fenders ----
  const fender = [], fp = q.fenderPaint || (q.fender === 'separate' ? 'black' : q.paint), gap = r + RULES.minArchGap + 25;
  if (q.fender === 'separate' || q.fender === 'valanced') {
    const val = q.fender === 'valanced' ? 120 : 0;
    fender.push({ paint: fp, wx: F, wz: r, wr: gap, smooth: 1, pts: [...arc(F, r, gap + 140 + val, gap + 140, 145, 30, 12), [cowlX + 60, bottom + 30, 0], [cowlX + 60, bottom - 30, 0], [F + gap * 0.95, r + gap * 0.35, 0], ...arc(F, r, gap, gap, 22, 150, 12), [F - gap - 90 - val * 0.3, r + gap * 0.52, 80]] });
    fender.push({ paint: fp, wx: R, wz: r, wr: gap, smooth: 1, pts: [[R - gap - 120, bottom - 20, 0], ...arc(R, r, gap + 140, gap + 120, 165, 22, 12), [R + gap + 250, bottom - 70, 0], [R + gap + 180, bottom - 110, 0], ...arc(R, r, gap, gap, 14, 166, 12)] });
  } else {
    fender.push({ paint: fp, wx: F, wz: r, wr: gap, smooth: 2, pts: [[noseX - 20, bottom + 60, 0], [noseX - 5, r + gap * 0.9, 0], [F - gap * 0.4, r + gap + 120, 0], [F + gap * 0.6, r + gap + 100, 0], [cowlX - 100, r + gap * 0.6, 0], [cowlX + 260, bottom + 20, 0], [cowlX + 280, bottom - 30, 0], [F + gap + 100, bottom - 30, 0], ...arc(F, r, gap, gap, 20, 165, 12)] });
    const skirt = q.fender === 'skirted';
    fender.push({ paint: fp, wx: R, wz: r, wr: skirt ? 1 : gap, smooth: 2, pts: skirt
      ? [[R - gap - 40, bottom - 40, 0], [R - gap - 20, r + gap * 0.6, 0], [R - gap * 0.3, r + gap + 80, 0], [R + gap * 0.6, r + gap + 60, 0], [R + gap + 260, r + 60, 0], [R + gap + 320, bottom - 20, 0]]
      : [[R - gap - 60, bottom - 30, 0], [R - gap - 20, r + gap * 0.6, 0], [R - gap * 0.3, r + gap + 80, 0], [R + gap * 0.6, r + gap + 60, 0], [R + gap + 260, r + 60, 0], [R + gap + 300, bottom - 20, 0], [R + gap, bottom - 30, 0], ...arc(R, r, gap, gap, 14, 166, 12)] });
  }
  // ---- details ----
  const doors = [[[cowlX + 40, beltZ], [cowlX + 40, bottom + 10]], [[gSplit, beltZ], [gSplit, bottom + 10]]];
  if (q.type === 'sedan4d') doors.push([[Math.min(roofRearX - 60, R - gap), beltZ], [Math.min(roofRearX - 60, R - gap), r + gap * 0.9]]);
  const parts = [], lamps = [], bumpers = [];
  if (q.grille === 'flat') parts.push({ pts: fillet([[noseX - 60, bottom + 150, 0], [noseX - 60, hoodZ - 60, 40], [noseX - 10, hoodZ - 10, 30], [noseX + 60, hoodZ - 10, 0], [noseX + 60, bottom + 150, 0]]), chrome: 1 });
  if (q.fender === 'separate' || q.fender === 'valanced') { parts.push({ e: [noseX - 150, hoodZ * 0.8, 105, 110], chrome: 1 }); lamps.push({ e: [noseX - 250, hoodZ * 0.8, 20, 90], ramp: 'lensW' }); parts.push({ pts: [[noseX - 170, hoodZ * 0.8 - 160], [noseX - 130, hoodZ * 0.8 - 160], [noseX - 130, hoodZ * 0.8 - 100], [noseX - 170, hoodZ * 0.8 - 100]], ramp: 'black', base: 1 }); }
  else lamps.push({ e: [noseX + 30, r + gap * 0.85, 30, 70], ramp: 'lensW', bezel: 'chrome' });
  const bo = stream ? 160 : 300; bumpers.push({ pts: [[noseX - bo - 80, bottom - 40], [noseX - bo, bottom - 40], [noseX - bo, bottom + 60], [noseX - bo - 80, bottom + 60]], smooth: 1 });
  bumpers.push({ pts: [[tailX + 120, bottom - 40], [tailX + 200, bottom - 40], [tailX + 200, bottom + 60], [tailX + 120, bottom + 60]], smooth: 1 });
  parts.push({ pts: [[noseX - bo - 40, bottom - 10], [noseX + 80, bottom - 10], [noseX + 80, bottom + 20], [noseX - bo - 40, bottom + 20]], ramp: 'black', base: 1 });
  parts.push({ pts: [[tailX - 100, bottom - 10], [tailX + 150, bottom - 10], [tailX + 150, bottom + 20], [tailX - 100, bottom + 20]], ramp: 'black', base: 1 });
  lamps.push({ e: [tailX - 40, beltZ * 0.6, 35, 45], ramp: 'lensR', bezel: 'chrome' });
  const trim = stream ? [{ pts: [[cowlX, beltZ + 10], [roofRearX, beltZ + 10], [tailX - 300, beltZ * 0.75]], w: 1, lv: 4 }] : [{ pts: [[noseX + 60, beltZ], [tailX - 60, beltZ]], w: 2, ramp: q.paint, lv: 4, lv2: 0 }];
  const louvres = stream ? [] : [{ x0: noseX + q.hoodWB * wb * 0.45, x1: cowlX - 120, step: 55, z0: hoodZ * 0.62, z1: hoodZ * 0.85 }];
  if (stream && q.grille === 'louvre') for (let k = 0; k < 6; k++) trim.push({ pts: [[noseX + 300 + k * 60, hoodZ * 0.75 - k * 45], [cowlX - 80, hoodZ * 0.75 - k * 45]], w: 1, lv: 4 });
  const boards = q.fender === 'separate' || q.fender === 'valanced' ? [{ paint: 'rubber', pts: [[cowlX + 40, bottom - 140], [R - gap - 100, bottom - 140], [R - gap - 100, bottom - 80], [cowlX + 40, bottom - 80]] }] : [];
  const aprons = boards.length ? [[[cowlX + 40, bottom - 82], [R - gap - 100, bottom - 82], [R - gap - 100, bottom + 2], [cowlX + 40, bottom + 2]]] : [];
  const geo = { F, R, r, gap, noseX, tailX, bottom, hoodZ, beltZ, cowlX, roofZ, roofRearX, gSplit, wsTopX, stream };
  return {
    id: `gen_${q.year}_${q.style}_${q.type}`, len: Math.ceil(tailX + 220), height: Math.ceil(H + 20), paint: q.paint, lowZ: bottom + 140, smooth: 0, glassSmooth: 0,
    body, arches: [{ x: F, z: r, r: gap }, { x: R, z: r, r: gap }], wheels: [{ x: F }, { x: R }], tire: q.tire,
    wheel: stream ? { style: 'steel', paint: q.paint, whitewall: 0.2 } : { style: 'wire', spokes: 24 },
    fenders: fender, boards, aprons, glass, frame: stream ? 'chrome' : 'reveal', doors, parts, lamps, bumpers, trim, louvres,
    tone: stream ? [] : [{ paint: 'black', pts: [[wsTopX - 200, roofZ - 55], [wsTopX - 200, roofZ + 200], [roofRearX + 300, roofZ + 200], [roofRearX + 300, roofZ - 55]], smooth: 0 }],
    handles: [[gSplit - 90, beltZ - 50]], geo,
  };
}
