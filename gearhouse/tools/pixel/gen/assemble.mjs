// E1 assembly test: random year/style/body + catalogue props fitted to slots, redrawn at vehicle scale, with validation + design score.
import { clampParams, genBody, limits } from './bodygen.mjs';
import { tire } from './tire.mjs';
import { fillet } from './geom.mjs';

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const pick = (R, a) => a[Math.floor(R() * a.length)];

// slot option tables: id, years, requirements (fn of body), mapping data
const OPT = {
  wheel: [
    { id: 'wh_wire32', y: [1928, 1934], tire: '4.75-19', w: { style: 'wire', spokes: 30 }, tags: ['box'] },
    { id: 'wh_wire40', y: [1930, 1936], tire: '5.25-18', w: { style: 'wire', spokes: 40 }, tags: ['box'] },
    { id: 'wh_wire48ww', y: [1930, 1936], tire: '6.50-20', w: { style: 'wire', spokes: 48, whitewall: 0.22 }, tags: ['luxury'] },
    { id: 'wh_art10', y: [1928, 1933], tire: '4.75-19', w: { style: 'artillery', spokes: 10, paint: 'PAINT' }, tags: ['box'] },
    { id: 'wh_disc', y: [1932, 1939], tire: '5.50-17', w: { style: 'disc', paint: 'PAINT' }, tags: [] },
    { id: 'wh_steel_cap', y: [1934, 1939], tire: '6.00-16', w: { style: 'steel', paint: 'PAINT' }, tags: [] },
    { id: 'wh_fullcap', y: [1934, 1939], tire: '6.50-16', w: { style: 'hubcap', whitewall: 0.3 }, tags: ['stream'] },
    { id: 'wh_trimring', y: [1935, 1939], tire: '6.00-16', w: { style: 'trimring', paint: 'PAINT', whitewall: 0.25 }, tags: ['stream'] },
    { id: 'wh_cover', y: [1936, 1939], tire: '7.00-16', w: { style: 'hubcap', whitewall: 0.45 }, tags: ['stream', 'luxury'] },
  ],
  headlamp: [
    { id: 'hl_drum9_nickel', y: [1928, 1931], k: 'drum', ramp: 'brass', d: 230, need: b => b.sepFenders },
    { id: 'hl_drum9_chrome', y: [1930, 1933], k: 'drum', ramp: 'chrome', d: 230, need: b => b.sepFenders },
    { id: 'hl_tourer12', y: [1928, 1933], k: 'drum', ramp: 'chrome', d: 300, need: b => b.sepFenders },
    { id: 'hl_bullet8_tilt', y: [1932, 1935], k: 'bullet', ramp: 'chrome', d: 210, need: b => b.sepFenders },
    { id: 'hl_bullet10_body', y: [1934, 1936], k: 'bullet', ramp: 'PAINT', d: 250, need: b => b.sepFenders },
    { id: 'hl_tear_chrome', y: [1933, 1936], k: 'bullet', ramp: 'chrome', d: 220, need: b => b.sepFenders },
    { id: 'hl_pod_round', y: [1935, 1938], k: 'pod', d: 200, need: b => !b.sepFenders },
    { id: 'hl_flush_oval', y: [1937, 1939], k: 'flush', d: 240, need: b => !b.sepFenders },
    { id: 'hl_nose_flush', y: [1934, 1937], k: 'flush', d: 190, need: b => !b.sepFenders },
  ],
  bumper: [
    { id: 'bp_twin', y: [1928, 1934], k: 'twin' }, { id: 'bp_triple', y: [1933, 1936], k: 'triple' }, { id: 'bp_heavy_dip', y: [1932, 1937], k: 'heavy' },
    { id: 'bp_overriders', y: [1934, 1939], k: 'overriders' }, { id: 'bp_blade', y: [1935, 1939], k: 'blade' }, { id: 'bp_tube', y: [1928, 1933], k: 'tube' },
  ],
  hoodVent: [
    { id: 'hv_vShort', y: [1928, 1934], need: b => !b.stream }, { id: 'hv_vLong', y: [1928, 1933], need: b => !b.stream }, { id: 'hv_vGroups', y: [1930, 1935], need: b => !b.stream },
    { id: 'hv_horizontal', y: [1932, 1937] }, { id: 'hv_doors5', y: [1932, 1936], need: b => !b.stream }, { id: 'hv_speedlines', y: [1934, 1939] }, { id: 'hv_wrap', y: [1936, 1939], need: b => b.stream }, { id: 'hv_chromeBars', y: [1935, 1939] },
  ],
  trim: [{ id: 'tri_bead', y: [1928, 1935], need: b => !b.stream }, { id: 'tri_pinstripe', y: [1928, 1939] }, { id: 'tri_spear', y: [1934, 1939] }, { id: 'tri_twoTone', y: [1930, 1937] }, { id: 'tri_rocker', y: [1935, 1939] }],
  spare: [
    { id: 'sp_rearExposed', y: [1928, 1935], need: b => !b.stream && (b.tail === 'upright' || b.tail === 'trunk') }, { id: 'sp_rearCover', y: [1930, 1937], need: b => !b.stream && (b.tail === 'upright' || b.tail === 'trunk') },
    { id: 'sp_sideExposed', y: [1928, 1935], need: b => b.sepFenders }, { id: 'sp_sideCover', y: [1930, 1937], need: b => b.sepFenders }, { id: 'sp_inTrunk', y: [1934, 1939], need: b => b.tail !== 'upright' },
  ],
  trunk: [
    { id: 'tr_none', y: [1928, 1939] }, { id: 'tr_rack', y: [1928, 1933], need: b => b.tail === 'upright' }, { id: 'tr_box', y: [1928, 1935], need: b => b.tail === 'upright' || b.tail === 'trunk' },
    { id: 'tr_integrated', y: [1934, 1939], need: b => b.tail === 'trunk' || b.tail === 'bustle' },
  ],
  mascot: [{ id: 'ms_cap', y: [1928, 1932] }, { id: 'ms_motometer', y: [1928, 1931] }, { id: 'ms_wingcap', y: [1929, 1936] }, { id: 'ms_eagle', y: [1930, 1937] }, { id: 'ms_arrow', y: [1933, 1939] }, { id: 'ms_swan', y: [1930, 1936] }, { id: 'ms_hound', y: [1932, 1938] }, { id: 'ms_rocket', y: [1935, 1939] }],
  roof: [{ id: 'roo_insert', y: [1928, 1935], need: b => !b.stream }, { id: 'roo_turret', y: [1935, 1939] }, { id: 'roo_landau', y: [1928, 1936], need: b => !b.stream && b.type === 'sedan4d' }, { id: 'roo_leatherette', y: [1930, 1937], need: b => !b.stream }],
};
const PAINTS = ['paint.c1', 'paint.c2', 'paint.c3', 'paint.c4', 'paint.c5', 'paint.c6', 'paint.c7', 'paint.c8'];
export const PAINT_HEX = ['#2f3a4a', '#5c1c27', '#3f5a40', '#7d3a2c', '#4b6283', '#d8c9a0', '#1d1d22', '#6b5a3a'];

export function assemble(seed) {
  const R = rng(seed * 7919 + 13);
  const year = 1930 + Math.floor(R() * 10), wantStream = R() < 0.5, type = R() < 0.6 ? 'sedan4d' : 'coupe2d';
  const style = wantStream && limits(year, 'stream') ? 'stream' : 'box';
  const L = limits(year, style), paint = pick(R, PAINTS);
  const report = { seed, year, style, type, rejected: 0, picks: {}, notes: [] };
  if (wantStream && style === 'box') report.notes.push('stream not available -> box');
  // wheel first (tyre code drives body proportions)
  const ok = (o, b) => year >= o.y[0] && year <= o.y[1] && (!o.need || o.need(b));
  const wheels = OPT.wheel.filter(o => year >= o.y[0] && year <= o.y[1]); report.rejected += OPT.wheel.length - wheels.length;
  const wh = pick(R, wheels); report.picks.wheel = wh.id;
  const q = clampParams({ year, style, type, wb: 2700 + Math.round(R() * 6) * 100, tire: wh.tire, paint, rake: R(), roofR: R(), noseR: R(), bodyR: R(), height: R(), hood: R(), nose: R(), belt: R(),
    tail: pick(R, L.tail), fender: pick(R, L.fender), grille: pick(R, L.grille), fenderPaint: style === 'box' && R() < 0.7 ? 'black' : paint });
  const s = genBody(q), g = s.geo;
  const b = { stream: style === 'stream', sepFenders: q.fender === 'separate' || q.fender === 'valanced', tail: q.tail, type };
  const choose = slot => { const c = OPT[slot].filter(o => ok(o, b)); report.rejected += OPT[slot].length - c.length; const o = c.length ? pick(R, c) : null; report.picks[slot] = o ? o.id : '-'; return o; };
  // realism defaults
  Object.assign(s, { grad: [3.1, 1.4], glassStyle: 'period', wheel: { ...wh.w, paint: wh.w.paint === 'PAINT' ? paint : wh.w.paint } });
  // ---- headlamp ----
  const hl = choose('headlamp'); s.lamps = s.lamps.filter(l => l.ramp !== 'lensW'); s.parts = s.parts.filter(p => !p.e);
  if (hl) { const rr = hl.d / 2, lz = g.hoodZ * 0.8;
    if (hl.k === 'drum' || hl.k === 'bullet') { const lx = g.noseX - 150; s.parts.push({ e: [lx, lz, hl.k === 'bullet' ? rr * 1.25 : rr * 0.9, rr], ramp: hl.ramp === 'PAINT' ? paint : undefined, chrome: hl.ramp === 'chrome' ? 1 : 0, ...(hl.ramp === 'brass' ? { ramp: 'brass' } : {}) }); s.lamps.push({ e: [lx - rr * (hl.k === 'bullet' ? 1.15 : 0.85), lz, 18, rr * 0.85], ramp: 'lensW' }); s.parts.unshift({ pts: [[lx - 18, g.r + g.gap + 60], [lx + 18, g.r + g.gap + 60], [lx + 18, lz - rr + 10], [lx - 18, lz - rr + 10]], ramp: 'black', base: 1 }); }
    else if (hl.k === 'pod') { s.parts.push({ e: [g.noseX + 60, g.r + g.gap * 0.95, rr * 1.1, rr * 0.8], ramp: paint }); s.lamps.push({ e: [g.noseX - 30, g.r + g.gap * 0.95, 22, rr * 0.7], ramp: 'lensW', bezel: 'chrome' }); }
    else s.lamps.push({ e: [g.noseX + 20, g.r + g.gap * 0.85, 26, rr * 0.75], ramp: 'lensW', bezel: 'chrome' }); }
  // ---- bumpers ----
  const bp = choose('bumper'); s.bumpers = []; const bo = b.stream ? 160 : 300, zb = g.bottom + 20;
  const zs = { twin: [zb - 45, zb + 45], triple: [zb - 60, zb, zb + 60], heavy: [zb], overriders: [zb], blade: [zb], tube: [zb] }[bp.k];
  const h = { twin: 42, triple: 30, heavy: 80, overriders: 66, blade: 72, tube: 46 }[bp.k];
  s.bumperSets = [{ x0: g.noseX - bo - 120, x1: g.noseX - bo + 40, zs, h, clamp: bp.k === 'twin' || bp.k === 'triple' ? g.noseX - bo - 40 : null, iron: [[g.noseX - bo, zb], [g.noseX + 100, zb + 20]] },
                  { x0: g.tailX + 80, x1: g.tailX + 230, zs, h, clamp: bp.k === 'twin' || bp.k === 'triple' ? g.tailX + 150 : null, iron: [[g.tailX - 60, zb + 20], [g.tailX + 120, zb]] }];
  if (bp.k === 'overriders') s.parts.push({ pts: [[g.noseX - bo - 70, zb - 110], [g.noseX - bo - 30, zb - 110], [g.noseX - bo - 30, zb + 130], [g.noseX - bo - 70, zb + 130]], chrome: 1 });
  // ---- hood vents ----
  const hv = choose('hoodVent'), hx0 = g.noseX + (g.cowlX - g.noseX) * 0.42, hx1 = g.cowlX - 130, hz = g.hoodZ;
  s.louvres = []; const tr = s.trim.slice();
  if (hv) { const k = hv.id.slice(3);
    if (k === 'vShort') s.louvres = [{ x0: hx0, x1: hx1, step: 30, z0: hz * 0.64, z1: hz * 0.86 }];
    if (k === 'vLong') s.louvres = [{ x0: hx0 - 120, x1: hx1, step: 26, z0: hz * 0.5, z1: hz * 0.9 }];
    if (k === 'vGroups') for (let i = 0; i < 3; i++) { const a = hx0 + i * (hx1 - hx0) / 3; s.louvres.push({ x0: a, x1: a + (hx1 - hx0) / 3 - 120, step: 28, z0: hz * 0.6, z1: hz * 0.86 }); }
    if (k === 'horizontal') for (let i = 0; i < 6; i++) tr.push({ pts: [[hx0, hz * (0.62 + i * 0.05)], [hx1, hz * (0.62 + i * 0.05)]], w: 1, ramp: 'black', lv: 0 });
    if (k === 'doors5') s.louvres = [{ x0: hx0, x1: hx1, step: (hx1 - hx0) / 4, z0: hz * 0.6, z1: hz * 0.88 }];
    if (k === 'speedlines') for (let i = 0; i < 3; i++) tr.push({ pts: [[hx0 - 150, hz * (0.66 + i * 0.07)], [hx1, hz * (0.66 + i * 0.07)]], w: 1 });
    if (k === 'wrap') for (let i = 0; i < 6; i++) tr.push({ pts: [[g.noseX + 250 + i * 70, hz * (0.85 - i * 0.07)], [hx1, hz * (0.85 - i * 0.07)]], w: 1 });
    if (k === 'chromeBars') for (let x = hx0; x < hx1; x += 70) tr.push({ pts: [[x, hz * 0.62], [x, hz * 0.86]], w: 1 }); }
  // ---- side trim ----
  const tm = choose('trim'); s.trim = tr.filter(t => t.ramp !== paint);
  if (tm) { const k = tm.id.slice(4);
    if (k === 'bead') s.trim.push({ pts: [[g.noseX + 60, g.beltZ], [g.tailX - 60, g.beltZ]], w: 2, ramp: paint, lv: 4, lv2: 0 });
    if (k === 'pinstripe') { s.trim.push({ pts: [[g.noseX + 80, g.beltZ - 20], [g.tailX - 80, g.beltZ - 20]], w: 1, ramp: 'brass', lv: 3 }); s.trim.push({ pts: [[g.noseX + 80, g.beltZ - 50], [g.tailX - 80, g.beltZ - 50]], w: 1, ramp: 'brass', lv: 3 }); }
    if (k === 'spear') s.trim.push({ pts: [[g.cowlX - 200, g.beltZ - 160], [g.tailX - 300, g.beltZ - 120]], w: 2, seed: seed });
    if (k === 'twoTone') { s.tone = [...(s.tone || []), { paint: paint === 'paint.c6' ? 'paint.c1' : 'paint.c6', pts: [[g.cowlX, g.beltZ - 160], [g.cowlX, g.beltZ - 20], [g.tailX, g.beltZ - 20], [g.tailX, g.beltZ - 160]], smooth: 0 }]; s.trim.push({ pts: [[g.cowlX, g.beltZ - 20], [g.tailX - 100, g.beltZ - 20]], w: 1 }); }
    if (k === 'rocker') s.trim.push({ pts: [[g.cowlX + 60, g.bottom + 40], [g.R - g.gap - 40, g.bottom + 40]], w: 2 }); }
  // ---- spare ----
  const sp = choose('spare'), T = tire(q.tire);
  if (sp) { const k = sp.id.slice(3);
    if (k === 'rearExposed' || k === 'rearCover') s.parts.push({ pts: fillet([[g.tailX + 10, g.bottom + 60, 60], [g.tailX + 10, g.bottom + 60 + T.od, 60], [g.tailX + 150, g.bottom + 60 + T.od, 60], [g.tailX + 150, g.bottom + 60, 60]]), ramp: k === 'rearCover' ? paint : 'rubber', base: 1 });
    if (k === 'sideExposed' || k === 'sideCover') s.spares = [{ x: g.cowlX - 260, z: g.r + g.gap * 0.6, style: k === 'sideCover' ? 'hubcap' : 'wire', spokes: 32 }]; }
  // ---- trunk ----
  const tk = choose('trunk');
  if (tk && tk.id === 'tr_rack') s.parts.push({ pts: [[g.tailX, g.bottom + 150], [g.tailX + 300, g.bottom + 150], [g.tailX + 300, g.bottom + 175], [g.tailX, g.bottom + 175]], chrome: 1 });
  if (tk && tk.id === 'tr_box') { s.parts.push({ pts: fillet([[g.tailX, g.bottom + 180, 20], [g.tailX + 420, g.bottom + 180, 20], [g.tailX + 420, g.bottom + 560, 30], [g.tailX, g.bottom + 560, 30]]), ramp: 'black', base: 2 }); s.parts.push({ pts: [[g.tailX, g.bottom + 360], [g.tailX + 420, g.bottom + 360], [g.tailX + 420, g.bottom + 375], [g.tailX, g.bottom + 375]], chrome: 1 }); }
  // ---- mascot on the radiator cap ----
  const ms = choose('mascot'); const mx = g.noseX + 20, mz = g.hoodZ;
  if (ms) s.parts.push({ pts: { ms_cap: [[mx - 25, mz], [mx + 25, mz], [mx + 20, mz + 35], [mx - 20, mz + 35]], ms_motometer: [[mx - 25, mz], [mx + 25, mz], [mx + 30, mz + 90], [mx - 30, mz + 90]],
    ms_wingcap: [[mx - 20, mz], [mx + 20, mz], [mx + 90, mz + 60], [mx - 30, mz + 45]], ms_eagle: [[mx - 15, mz], [mx + 15, mz], [mx + 110, mz + 110], [mx, mz + 60], [mx - 80, mz + 110]],
    ms_arrow: [[mx - 40, mz], [mx + 20, mz], [mx + 160, mz + 40], [mx - 60, mz + 50]], ms_swan: [[mx - 50, mz], [mx + 40, mz], [mx + 10, mz + 40], [mx + 20, mz + 120], [mx - 5, mz + 120], [mx - 10, mz + 40]],
    ms_hound: [[mx - 30, mz], [mx + 30, mz], [mx + 140, mz + 50], [mx - 90, mz + 60]], ms_rocket: [[mx - 30, mz], [mx + 20, mz], [mx + 150, mz + 45], [mx - 70, mz + 70]] }[ms.id], chrome: 1 });
  // ---- roof ----
  const rf = choose('roof');
  if (rf && rf.id === 'roo_turret') s.tone = (s.tone || []).filter(t => t.paint !== 'black');
  if (rf && rf.id === 'roo_landau') { s.tone = [...(s.tone || []).filter(t => t.paint !== 'black'), { paint: 'black', pts: [[g.gSplit + 200, g.beltZ + 20], [g.gSplit + 200, g.roofZ + 300], [g.roofRearX + 400, g.roofZ + 300], [g.roofRearX + 400, g.beltZ + 20]], smooth: 0 }];
    s.trim.push({ pts: [[g.roofRearX - 260, g.roofZ - 220], [g.roofRearX - 120, g.roofZ - 300], [g.roofRearX + 40, g.beltZ + 60]], w: 2, free: 1 }); }
  // ---- design score ----
  const eraFit = Object.entries(report.picks).filter(([, id]) => id !== '-').map(([slot, id]) => { const o = OPT[slot].find(x => x.id === id); const c = (o.y[0] + o.y[1]) / 2, half = Math.max(1, (o.y[1] - o.y[0]) / 2); return Math.max(0, 1 - Math.abs(year - c) / (half * 1.6)); });
  const era = eraFit.reduce((a, v) => a + v, 0) / eraFit.length;
  const tags = [wh, hv].filter(Boolean).flatMap(o => o.tags || []); const harmony = Math.min(1, 0.7 + (tags.includes(style) ? 0.3 : 0) - (tags.includes(style === 'box' ? 'stream' : 'box') ? 0.3 : 0) + (q.notes.length ? -0.2 : 0));
  const Lm = limits(year, style), mid = k => (Lm[k][0] + Lm[k][1]) / 2, span = k => (Lm[k][1] - Lm[k][0]) / 2;
  const prop = 1 - (['hWB', 'hoodWB', 'beltH'].reduce((a, k) => a + Math.abs(q[k] - mid(k)) / span(k), 0) / 3) * 0.5;
  report.score = Math.round(40 * era + 35 * harmony + 25 * prop);
  report.parts = { era: +era.toFixed(2), harmony: +harmony.toFixed(2), proportion: +prop.toFixed(2) };
  report.body = { tail: q.tail, fender: q.fender, grille: q.grille, wb: q.wb, tire: q.tire, notes: q.notes };
  return { spec: s, report };
}
